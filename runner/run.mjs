#!/usr/bin/env node
// Matrix runner: (task x seed x harness x model) runs with per-run isolation, hidden tests,
// grading, journaling. Resumable: skips run ids already journaled with a score.
//
// Usage: node runner/run.mjs --phase <pilot|full> [--concurrency 2] [--models a,b] [--tasks t1,t2]
//
// Gateway has a hard cap of ~2 concurrent requests -> default concurrency 2.
// Queue order: outer (task, seed) -> inner combos, so all 6 combos of a cell run close
// together (paired comparisons robust to gateway drift).
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BENCH, buildInvocation, makeRunHome, spawnHarness, journalAppend, readJournal, nowIso } from './lib.mjs';
import { gradeSolution } from './grade.mjs';

const RUNS = path.join(BENCH, 'runs');
const STAGE = path.join(BENCH, 'stage');
const LOGS = path.join(BENCH, 'logs');
const TASKS_DIR = path.join(BENCH, 'tasks');
const HIDDEN = path.join(BENCH, 'hidden-tests'); // chmod 000 while runs are live
const PROXY_PORT = 8910;
const GATEWAY = 'https://freeinference.org/anthropic';
const MODELS = ['glm-5.3-flash', 'deepseek-v4-flash'];
const HARNESSSES = ['claude', 'opencode', 'pi'];
const SEEDS = [0, 1, 2];
const TIMEOUT = { single: 360_000, repo: 540_000 };

// ---------- args ----------
const args = process.argv.slice(2);
function argOf(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const PHASE = argOf('--phase', 'pilot');
const CONC = Number(argOf('--concurrency', '2'));
const MODEL_FILTER = argOf('--models', null);
const TASK_FILTER = argOf('--tasks', null);
const SEED_FILTER = argOf('--seeds', null);

const models = MODEL_FILTER ? MODEL_FILTER.split(',') : MODELS;
const harnesses = HARNESSSES;
const seeds = SEED_FILTER ? SEED_FILTER.split(',').map(Number) : SEEDS;

// task list
let taskIds;
if (PHASE === 'pilot') {
  taskIds = ['t1', 't4'];
} else {
  taskIds = fs.readdirSync(TASKS_DIR).filter((d) => /^t\d+$/.test(d)).sort();
  if (TASK_FILTER) taskIds = taskIds.filter((t) => TASK_FILTER.split(',').includes(t));
}
const REPO_TASKS = new Set(['t4', 't5', 't6']); // mini-repo tasks get longer timeout

// token
const token = process.env.ANTHROPIC_AUTH_TOKEN;
if (!token) { console.error('ANTHROPIC_AUTH_TOKEN not set'); process.exit(1); }

// ---------- queue ----------
const journalFile = path.join(RUNS, `journal-${PHASE}.jsonl`);
fs.mkdirSync(RUNS, { recursive: true });
const done = new Set(readJournal(journalFile).filter((r) => r.score).map((r) => r.runId));

const queue = [];
for (const task of taskIds) {
  for (const seed of seeds) {
    for (const model of models) {
      for (const harness of harnesses) {
        queue.push({ task, seed, model, harness });
      }
    }
  }
}
const pending = queue.filter((q) => !done.has(runIdOf(q)));
console.log(`phase=${PHASE} queue=${queue.length} done=${done.size} pending=${pending.length} concurrency=${CONC}`);
if (!pending.length) { console.log('nothing to do'); process.exit(0); }

// ---------- proxies: one per worker ----------
// A shared proxy journal would double-attribute usage when two workers' runs overlap
// in time (each run's [t0,t1] window swallows its neighbor's requests). One proxy per
// worker gives exact per-run attribution.
// Pre-flight: a stale proxy from a killed previous invocation holds the port -> fail fast
// with a clear message instead of "proxy w0 exited 1".
for (let i = 0; i < CONC; i++) {
  try {
    const dead = await new Promise((res) => {
      const s = http.createServer();
      s.once('error', () => res(false)); // port busy
      s.once('listening', () => s.close(() => res(true)));
      s.listen(PROXY_PORT + i, '127.0.0.1');
    });
    if (!dead) throw new Error(`port ${PROXY_PORT + i} busy — kill stale proxies: pkill -f 'runner/proxy.mjs ${PROXY_PORT + i}'`);
  } catch (e) {
    console.error(`pre-flight: ${e.message}`); process.exit(1);
  }
}
const proxies = [];
const proxyJournals = [];
for (let i = 0; i < CONC; i++) {
  const proxyJournal = path.join(LOGS, `proxy-${PHASE}-w${i}.jsonl`);
  proxyJournals.push(proxyJournal);
  const p = spawn(process.execPath, [path.join(BENCH, 'runner', 'proxy.mjs'), String(PROXY_PORT + i), proxyJournal, GATEWAY], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ANTHROPIC_AUTH_TOKEN: token },
  });
  await new Promise((res, rej) => {
    p.stdout.on('data', (d) => { if (String(d).includes('"ok":true')) res(); });
    p.on('exit', (c) => rej(new Error(`proxy w${i} exited ${c}`)));
    setTimeout(() => rej(new Error('proxy start timeout')), 5000);
  });
  proxies.push(p);
}
console.log(`proxies up on ${PROXY_PORT}..${PROXY_PORT + CONC - 1}`);

// ---------- hidden tests: readable grade-source + locked masters ----------
const masterPaths = (ts) => [HIDDEN, ...ts.flatMap((t) => ['tests', 'reference', 'stub'].map((d) => path.join(TASKS_DIR, t, d)))].filter((p) => fs.existsSync(p));
// Self-heal: a previous crashed/killed phase may have left masters locked (no finalize).
for (const p of masterPaths(taskIds)) fs.chmodSync(p, 0o755);

// Grading happens while other runs are live, so masters stay chmod 000 the whole phase.
// The grader reads from a private /tmp copy (mode 700) instead of the locked masters.
const gradeSrc = fs.mkdtempSync(path.join(os.tmpdir(), `bench-grade-src-${PHASE}-`));
fs.chmodSync(gradeSrc, 0o700);
for (const t of taskIds) {
  fs.cpSync(path.join(TASKS_DIR, t, 'tests'), path.join(gradeSrc, t), { recursive: true });
}
// lock masters: hidden-tests copies + the task trees themselves (tests/reference/stub
// contain the solutions — an agent wandering from its sandbox must not read them)
fs.rmSync(HIDDEN, { recursive: true, force: true });
fs.mkdirSync(HIDDEN, { recursive: true });
for (const t of taskIds) {
  fs.cpSync(path.join(TASKS_DIR, t, 'tests'), path.join(HIDDEN, t), { recursive: true });
}
const lockedMasters = masterPaths(taskIds);
for (const p of lockedMasters) fs.chmodSync(p, 0o000); // same-UID reads fail without DAC override
let finalized = false;
function unlockMasters() {
  if (finalized) return;
  finalized = true;
  for (const p of lockedMasters) { try { fs.chmodSync(p, 0o755); } catch {} }
}
process.on('SIGINT', () => { unlockMasters(); process.exit(130); });
process.on('SIGTERM', () => { unlockMasters(); process.exit(143); });

// ---------- worker pool ----------
let idx = 0;
async function worker(wid) {
  const proxyUrl = `http://127.0.0.1:${PROXY_PORT + wid}`;
  const proxyJournal = proxyJournals[wid];
  while (idx < pending.length) {
    const q = pending[idx++];
    const runId = runIdOf(q);
    try {
      const rec = await runOne(q, runId, proxyUrl, proxyJournal);
      journalAppend(journalFile, rec);
      const tag = rec.score ? (rec.score.class === 'solved' ? 'SOLVED' : `${rec.score.passed}/${rec.score.total}`) : rec.failure;
      console.log(`[${nowIso()}] w${wid} ${runId}: ${tag} (${Math.round(rec.wallMs / 1000)}s)`);
    } catch (e) {
      journalAppend(journalFile, { runId, ...q, failure: 'runner_error', error: String(e).slice(0, 300), ts: nowIso() });
      console.log(`[${nowIso()}] w${wid} ${runId}: RUNNER_ERROR ${String(e).slice(0, 150)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));

// ---------- finalize ----------
unlockMasters();
fs.rmSync(gradeSrc, { recursive: true, force: true });
for (const p of proxies) p.kill('SIGTERM');
console.log('done. journal:', journalFile);

// ---------- per-run ----------
function runIdOf(q) { return `${q.task}-s${q.seed}-${q.harness}-${q.model}`; }

async function runOne(q, runId, proxyUrl, proxyJournal, attempt = 1) {
  const { task, seed, model, harness } = q;
  const specMd = fs.readFileSync(path.join(TASKS_DIR, task, 'spec.md'), 'utf8');
  const prompt = seed === 0 ? specMd : seedVariant(specMd, seed);
  const runHome = makeRunHome(BENCH, runId);
  const sandbox = path.join(STAGE, `${runId}-sandbox`);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.cpSync(path.join(TASKS_DIR, task, 'skeleton'), sandbox, { recursive: true });

  const { argv, env, configFiles } = buildInvocation(harness, model, prompt, runHome, proxyUrl, token);
  for (const cf of configFiles) {
    fs.mkdirSync(path.dirname(cf.path), { recursive: true });
    fs.writeFileSync(cf.path, cf.content);
  }

  const outFile = path.join(LOGS, `${PHASE}-${runId}.out.txt`);
  const t0 = Date.now();
  const exit = await spawnHarness(argv, env, sandbox, outFile, REPO_TASKS.has(task) ? TIMEOUT.repo : TIMEOUT.single);
  const wallMs = Date.now() - t0;

  // grade — reads the private /tmp grade source (masters are locked during the phase)
  let score = null, failure = null;
  try {
    const g = gradeSolution(sandbox, path.join(gradeSrc, task));
    score = { class: g.class, passed: g.passed, total: g.total, tests: g.tests };
  } catch (e) {
    failure = 'grade_error';
    score = { class: 'grade_error', passed: 0, total: 0, tests: [], error: String(e).slice(0, 200) };
  }
  if (exit.timedOut && (!score || score.total === 0)) failure = 'timeout';

  // proxy stats for this run window (worker-local journal -> exact attribution)
  const proxyRecs = readJournal(proxyJournal).filter((r) => r.ts >= t0 && r.ts <= t0 + wallMs + 1000);
  const usage = sumUsage(proxyRecs);
  const modelCheck = {
    requests: proxyRecs.length,
    byModel: proxyRecs.reduce((m, r) => { if (r.model) m[r.model] = (m[r.model] || 0) + 1; return m; }, {}),
    distinctModels: [...new Set(proxyRecs.map((r) => r.model).filter(Boolean))],
    anyOtherModel: proxyRecs.some((r) => r.model && r.model !== model),
    saw429: proxyRecs.some((r) => r.status === 429),
    errors: proxyRecs.filter((r) => r.status === 0 || r.error).length,
  };

  fs.rmSync(runHome, { recursive: true, force: true });
  // keep sandbox for inspection? remove to save disk; transcripts + grade live in logs/journal
  fs.rmSync(sandbox, { recursive: true, force: true });

  const rec = {
    runId, task, seed, harness, model, ts: nowIso(), attempt,
    exitCode: exit.code, timedOut: exit.timedOut, wallMs,
    score, failure, usage, modelCheck,
    transcript: outFile.replace(BENCH + '/', ''),
  };

  // gateway_degraded: harness failed with a 429/rate-limit signature and produced no gradable
  // work -> retry the whole run (fresh attempt, backoff). Non-429 failures are never retried.
  if (!failure && (!score || score.total === 0) && attempt < 3 && is429Signature(rec)) {
    console.log(`  ${runId}: gateway_degraded, retry attempt ${attempt + 1}/3`);
    await sleep(30_000 * attempt);
    return runOne(q, runId, proxyUrl, proxyJournal, attempt + 1);
  }
  if (!failure && (!score || score.total === 0) && is429Signature(rec)) {
    rec.failure = 'gateway_degraded'; // exhausted retries; recorded, not counted as model failure
  }
  return rec;
}

function is429Signature(rec) {
  if (rec.exitCode === 0 && rec.score && rec.score.total > 0) return false;
  // Primary evidence: the run's proxy window saw HTTP 429s (gateway concurrency_limit_exceeded).
  if (rec.modelCheck && rec.modelCheck.saw429) return true;
  const t = rec.transcript ? path.join(BENCH, rec.transcript) : null;
  if (t && fs.existsSync(t)) {
    const txt = fs.readFileSync(t, 'utf8').slice(-4000);
    if (/429|rate.?limit|too many (concurrent )?requests|concurrency_limit/i.test(txt)) return true;
  }
  return false;
}

function sumUsage(recs) {
  const u = { requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, sse429: 0 };
  for (const r of recs) {
    if (r.status === 429) u.sse429++;
    if (r.usage) {
      u.requests++;
      u.input += r.usage.input_tokens || 0;
      u.output += r.usage.output_tokens || 0;
      u.cacheRead += r.usage.cache_read_input_tokens || 0;
      u.cacheWrite += r.usage.cache_creation_input_tokens || 0;
    } else if (r.lastUsage) {
      u.requests++;
      u.input += r.lastUsage.input_tokens || 0;
      u.output += r.lastUsage.output_tokens || 0;
    }
  }
  return u;
}

function seedVariant(spec, seed) {
  // Seeds 1/2 add a neutral variation sentence so repeats are not byte-identical prompts.
  // Task content identical -> still comparable across seeds.
  const v = [
    '',
    '\n\nNote: work carefully and double-check edge cases before finishing.',
    '\n\nNote: aim for a clean, readable implementation; correctness matters most.',
  ][seed];
  return spec + v;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
