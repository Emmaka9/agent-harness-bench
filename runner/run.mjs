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
import { BENCH, buildInvocation, makeRunHome, spawnHarness, killTrackedChildren, journalAppend, readJournal, nowIso } from './lib.mjs';
import { gradeSolution } from './grade.mjs';

const RUNS = path.join(BENCH, 'runs');
const STAGE = path.join(BENCH, 'stage');
const LOGS = path.join(BENCH, 'logs');
const TASKS_DIR = path.join(BENCH, 'tasks');
const HIDDEN = path.join(BENCH, 'hidden-tests'); // chmod 000 while runs are live
const PROXY_PORT = 8910;
// Upstream override for self-tests only (proxy.mjs honors BENCH_UPSTREAM too).
// Never set in production runs; the default is the established gateway.
const GATEWAY = process.env.BENCH_UPSTREAM || 'https://freeinference.org/anthropic';
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
const HARNESS_FILTER = argOf('--harnesses', null);
const TASK_FILTER = argOf('--tasks', null);
const SEED_FILTER = argOf('--seeds', null);

const models = MODEL_FILTER ? MODEL_FILTER.split(',') : MODELS;
const harnesses = HARNESS_FILTER ? HARNESS_FILTER.split(',') : HARNESSSES;
const seeds = SEED_FILTER ? SEED_FILTER.split(',').map(Number) : SEEDS;

// task list
let taskIds;
if (PHASE === 'pilot') {
  taskIds = ['t1', 't4'];
} else if (PHASE === 'guided') {
  // E3: instruction-normalization — all tasks, seed 0 only (guide is the treatment)
  taskIds = allTaskIds();
  if (!SEED_FILTER) seeds.splice(0, seeds.length, 0);
} else if (PHASE === 'hint') {
  // E5: misleading-hint robustness — tasks with a designed hint, seed 3 only
  taskIds = allTaskIds();
  if (!SEED_FILTER) seeds.splice(0, seeds.length, 3);
} else if (PHASE === 'e4') {
  // E4: difficulty-scaling baseline — the hard tasks (t9,t10,t11), unguided, seed 0.
  // Separate phase name so its journal never mixes with the original 8-task matrix.
  taskIds = ['t9', 't10', 't11'];
} else if (PHASE === 'e4-replace') {
  // Replacement runs for specific compromised E4 cells (FOLLOWUP-FOUR-RUNS-20261108):
  // same protocol as E4 (hard tasks, unguided, original prompts, fixed budgets), but a
  // SEPARATE journal + proxy journal + transcript prefix so original E4 records,
  // quarantine evidence, and transcripts stay byte-identical. Provenance lives in
  // runs/e4-replace/README.md. Never mixed into E4 aggregates unless the published
  // selection policy says so.
  taskIds = ['t9', 't10', 't11'];
} else if (PHASE === 'validate') {
  // Reliability validation: one tiny smoke run per requested combo, no grading matrix.
  taskIds = TASK_FILTER ? TASK_FILTER.split(',') : ['t1'];
  if (!SEED_FILTER) seeds.splice(0, seeds.length, 0);
  if (!MODEL_FILTER) { console.error('--validate needs --models and --tasks filters'); process.exit(1); }
} else {
  taskIds = allTaskIds();
}
if (TASK_FILTER && PHASE !== 'validate') taskIds = taskIds.filter((t) => TASK_FILTER.split(',').includes(t));
function allTaskIds() {
  return fs.readdirSync(TASKS_DIR).filter((d) => /^t\d+$/.test(d)).sort();
}
const REPO_TASKS = new Set(['t4', 't5', 't6']); // mini-repo tasks get longer timeout

// token
const token = process.env.ANTHROPIC_AUTH_TOKEN;
if (!token) { console.error('ANTHROPIC_AUTH_TOKEN not set'); process.exit(1); }

// ---------- queue ----------
const journalFile = path.join(RUNS, `journal-${PHASE}.jsonl`);
fs.mkdirSync(RUNS, { recursive: true });
// Resume set: only records that are (a) scored AND (b) infrastructure-valid count as
// "done". A record whose run was poisoned (saw 429s with zero completed requests),
// timed out, or failed with a runner/grade/infra error is NOT done — it will be re-run.
// The superseded record stays on disk (it is history) but a fresh attempt with a new
// attempt number is appended, and analysis excludes infra-invalid records anyway.
function isInfraInvalid(r) {
  return Boolean(
    r.timedOut ||
    r.failure === 'gateway_degraded' ||
    r.failure === 'runner_error' ||
    r.failure === 'grade_error' ||
    r.failure === 'timeout' ||
    (r.modelCheck?.saw429 && (r.usage?.requests ?? 0) === 0)
  );
}
const done = new Set(
  readJournal(journalFile)
    .filter((r) => r.score && !isInfraInvalid(r))
    .map((r) => r.runId)
);
// Highest attempt number already journaled per runId (for transcript naming on resume/retry).
// Scans the live journal AND every quarantine journal (runs/quarantine/*.jsonl) so a
// re-run never overwrites quarantined evidence — quarantined attempts keep their
// transcripts, the new attempt continues the numbering.
const maxAttempt = new Map();
const quarantineJournals = fs.existsSync(path.join(RUNS, 'quarantine'))
  ? fs.readdirSync(path.join(RUNS, 'quarantine')).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(RUNS, 'quarantine', f))
  : [];
for (const jf of [journalFile, ...quarantineJournals]) {
  for (const r of readJournal(jf)) {
    const a = r.attempt ?? 1;
    if (!maxAttempt.has(r.runId) || maxAttempt.get(r.runId) < a) maxAttempt.set(r.runId, a);
  }
}

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
const proxyPids = new Set();
for (let i = 0; i < CONC; i++) {
  const proxyJournal = path.join(LOGS, `proxy-${PHASE}-w${i}.jsonl`);
  proxyJournals.push(proxyJournal);
  const p = spawn(process.execPath, [path.join(BENCH, 'runner', 'proxy.mjs'), String(PROXY_PORT + i), proxyJournal, GATEWAY], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ANTHROPIC_AUTH_TOKEN: token },
  });
  proxyPids.add(p.pid);
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
  for (const p of lockedMasters) { try { fs.chmodSync(p, 0o755); } catch (e) { console.error('unlock failed for', p, String(e)); } }
  console.error('unlockMasters: done (finalized=true)');
}
// Clean shutdown: kill tracked harness process groups, stop proxies, unlock masters.
// `finalized` guards double-entry (signal + uncaughtException racing is possible).
let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`\nshutting down cleanly (code ${code})`);
  // 1. Kill every tracked harness child (whole process group) so no detached
  //    harness survives the runner.
  try { await killTrackedChildren(); } catch {}
  // 2. Stop the proxies (they hold the gateway auth and the ports).
  for (const p of proxies) { try { p.kill('SIGTERM'); } catch {} }
  await new Promise((r) => setTimeout(r, 500));
  for (const p of proxies) { try { p.kill('SIGKILL'); } catch {} }
  // 3. Unlock masters last: after nothing that could read them is alive.
  unlockMasters();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
// Also arm the common non-signal exits: an uncaught error must not orphan children.
process.on('uncaughtException', (e) => { console.error('uncaughtException:', e); shutdown(120); });
process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); shutdown(121); });

// ---------- worker pool ----------
let idx = 0;
async function worker(wid) {
  const proxyUrl = `http://127.0.0.1:${PROXY_PORT + wid}`;
  const proxyJournal = proxyJournals[wid];
  while (idx < pending.length && !shuttingDown) {
    const q = pending[idx++];
    const runId = runIdOf(q);
    try {
      // Resume semantics: if this runId already has journaled attempts (all infra-
      // invalid, hence still pending), continue the attempt counter so the fresh
      // run gets its own transcript file and never overwrites quarantined evidence.
      const startAttempt = (maxAttempt.get(runId) || 0) + 1;
      const rec = await runOne(q, runId, proxyUrl, proxyJournal, startAttempt === 1 ? 1 : startAttempt);
      if (shuttingDown) break; // shutdown began mid-run: don't append a half-dead record
      journalAppend(journalFile, rec);
      const tag = rec.score ? (rec.score.class === 'solved' ? 'SOLVED' : `${rec.score.passed}/${rec.score.total}`) : rec.failure;
      console.log(`[${nowIso()}] w${wid} ${runId}: ${tag} (${Math.round(rec.wallMs / 1000)}s)`);
    } catch (e) {
      if (!shuttingDown) {
        journalAppend(journalFile, { runId, ...q, failure: 'runner_error', error: String(e).slice(0, 300), ts: nowIso() });
        console.log(`[${nowIso()}] w${wid} ${runId}: RUNNER_ERROR ${String(e).slice(0, 150)}`);
      }
    }
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));

// ---------- finalize ----------
// NOTE: do NOT set `finalized` here — that flag belongs to unlockMasters() (it makes
// unlock idempotent). Pre-setting it made unlockMasters() early-return and leave the
// masters locked after every normal completion (found by the shutdown self-test).
if (!finalized) {
  for (const p of proxies) { try { p.kill('SIGTERM'); } catch {} }
  unlockMasters();
}
fs.rmSync(gradeSrc, { recursive: true, force: true });
console.log('done. journal:', journalFile);

// ---------- per-run ----------
function runIdOf(q) { return `${q.task}-s${q.seed}-${q.harness}-${q.model}`; }

async function runOne(q, runId, proxyUrl, proxyJournal, attempt, attemptLog) {
  attempt = attempt || 1;
  attemptLog = attemptLog || [];
  const { task, seed, model, harness } = q;
  const specMd = fs.readFileSync(path.join(TASKS_DIR, task, 'spec.md'), 'utf8');
  const prompt = seed >= 1 && seed <= 2 ? seedVariant(specMd, seed) : specMd;
  const guide = PHASE === 'guided' ? fs.readFileSync(path.join(BENCH, 'logs', 'gates', 'E3-INSTRUCTIONS.md'), 'utf8') : null;
  const hint = seed === 3 ? misleadHint(task) : null;
  const runHome = makeRunHome(BENCH, runId);
  const sandbox = path.join(STAGE, `${runId}-sandbox`);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.cpSync(path.join(TASKS_DIR, task, 'skeleton'), sandbox, { recursive: true });

  // E3 guided phase: inject the shared workflow guide via the harness's native mechanism
  // (claude: CLAUDE.md in cwd; opencode: AGENTS.md in cwd; pi: --append-system-prompt file)
  if (guide) {
    if (harness === 'claude') fs.writeFileSync(path.join(sandbox, 'CLAUDE.md'), guide);
    if (harness === 'opencode') fs.writeFileSync(path.join(sandbox, 'AGENTS.md'), guide);
    if (harness === 'pi') fs.writeFileSync(path.join(runHome, 'guide.md'), guide);
  }
  // E5 hint phase: append the misleading hint to the prompt
  const finalPrompt = hint ? prompt + '\n\nHint from a previous engineer: ' + hint : prompt;

  // Run attribution: the proxy URL carries `<runId>.a<attempt>` as its first path
  // segment. The harness SDKs append /v1/messages (or /chat/completions) to this
  // base, so every request arrives at the proxy as /<runId>.a<attempt>/... and is
  // attributable to exactly this run+attempt — no time windows involved.
  const runScopedProxy = `${proxyUrl}/${runId}.a${attempt}`;
  const { argv, env, configFiles } = buildInvocation(harness, model, finalPrompt, runHome, runScopedProxy, token);
  // pi guided: append system prompt from the guide file
  if (guide && harness === 'pi') {
    const gi = argv.indexOf('--append-system-prompt');
    if (gi === -1) {
      argv.push('--append-system-prompt', path.join(runHome, 'guide.md'));
    } else { argv[gi + 1] = path.join(runHome, 'guide.md'); }
  }
  for (const cf of configFiles) {
    fs.mkdirSync(path.dirname(cf.path), { recursive: true });
    fs.writeFileSync(cf.path, cf.content);
  }

  // Per-attempt transcript: attempt 1 keeps the historical name; retries get .a<n>
  // before the extension so each attempt's transcript is preserved independently.
  const outFile = attempt === 1
    ? path.join(LOGS, `${PHASE}-${runId}.out.txt`)
    : path.join(LOGS, `${PHASE}-${runId}.a${attempt}.out.txt`);
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
  // Explicit timeout recording (#5): a timed-out run is infra-invalid regardless of
  // what grading later found in its sandbox — the agent never got to finish, so the
  // score says nothing about model quality.
  if (exit.timedOut) failure = 'timeout';

  // proxy stats: attribution by run id, not by time window. Only records carrying
  // this run's exact id count; anything else is either another run's traffic or
  // unattributed (the proxy 403s those, and both cases are excluded here).
  const allRecs = readJournal(proxyJournal);
  const mine = allRecs.filter((r) => r.run === `${runId}.a${attempt}`);
  // foreign = another run's records that OVERLAP this run's wall window (t0..now) —
  // genuine cross-run mixing. Records from earlier sequential runs (before t0) are
  // history in the shared per-worker journal, not mixing; the old 60s lookback
  // miscounted those as "foreign" on every run after the first.
  const foreign = allRecs.filter((r) => r.run && r.run !== `${runId}.a${attempt}` && r.ts >= t0);
  const unattributed = allRecs.filter((r) => r.rejected === 'no_run_id' && r.ts >= t0);
  const usage = sumUsage(mine);
  const modelCheck = {
    requests: mine.length,
    byModel: mine.reduce((m, r) => { if (r.model) m[r.model] = (m[r.model] || 0) + 1; return m; }, {}),
    distinctModels: [...new Set(mine.map((r) => r.model).filter(Boolean))],
    anyOtherModel: mine.some((r) => r.model && r.model !== model),
    saw429: mine.some((r) => r.status === 429),
    errors: mine.filter((r) => r.status === 0 || r.error).length,
    // integrity counters: any nonzero value here means attribution or client config is broken
    foreignRequests: foreign.length,
    unattributedRejected: unattributed.length,
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
  attemptLog.push({
    attempt,
    exitCode: rec.exitCode,
    timedOut: rec.timedOut,
    wallMs: rec.wallMs,
    score: rec.score,
    failure: rec.failure,
    usage: rec.usage,
    modelCheck: rec.modelCheck,
    transcript: rec.transcript,
  });

  // gateway_degraded: harness failed with a 429/rate-limit signature and produced no gradable
  // work -> retry the whole run (fresh attempt, backoff). Non-429 failures are never retried.
  // Poison signature (learned twice): the run saw 429s AND completed zero model requests
  // (usage.requests===0) — its 0/N score is gateway noise, not model failure. This must
  // trigger even when score.total>0 (graded against the full suite), hence the passed===0
  // && requests===0 test rather than the old score.total===0 gate that 429-poison slipped past.
  const zeroWork = !rec.usage || rec.usage.requests === 0;
  const poisoned = is429Signature(rec) && zeroWork && score && score.passed === 0;
  const degenerated = !failure && (!score || score.total === 0) && is429Signature(rec);
  if (!failure && (poisoned || degenerated) && attempt < 3) {
    console.log(`  ${runId}: gateway_degraded (poison=${poisoned} degenerated=${degenerated}), retry attempt ${attempt + 1}/3`);
    await sleep(30_000 * attempt);
    return runOne(q, runId, proxyUrl, proxyJournal, attempt + 1, attemptLog);
  }
  if (!failure && (poisoned || degenerated)) {
    rec.failure = 'gateway_degraded'; // exhausted retries; recorded, not counted as model failure
    attemptLog[attemptLog.length - 1].failure = 'gateway_degraded';
  }
  // Preserve every attempt's outcome on the final record (#6): the retry chain's
  // earlier transcripts and scores stay inspectable via rec.attempts.
  if (attemptLog.length > 1) rec.attempts = attemptLog;
  return rec;
}

function is429Signature(rec) {
  // Primary evidence: this run's OWN attributed requests (by run id) saw HTTP 429s.
  // Applies even for exit-0 runs — a pi run that 429'd every request still exits 0.
  if (rec.modelCheck && rec.modelCheck.saw429) return true;
  if (rec.exitCode === 0 && rec.score && rec.score.total > 0 && rec.usage && rec.usage.requests > 0) return false;
  // Secondary: transcript tail mentions rate limiting (harness-side retries).
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

// E5: plausible-but-wrong hint per task (the documented edge the spec contradicts).
// A model following spec fidelity ignores these; a pattern-follower gets misled.
function misleadHint(task) {
  const hints = {
    t1: 'the previous implementation returned the stored value from get() for expired entries and only removed them during size(); that behavior passed review, consider keeping it.',
    t4: 'rescheduling an id whose job is terminal used to throw like duplicate ids do; that behavior passed review, consider keeping it.',
    t7: 'enum membership checking with == (loose equality) is fine for primitives here; Object.is is only for NaN edge cases nobody hits in practice.',
    t8: 'duplicate node entries in the input used to be rejected with an error; that behavior passed review, consider keeping it.',
  };
  return hints[task] || '';
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
