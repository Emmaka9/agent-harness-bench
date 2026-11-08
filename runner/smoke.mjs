#!/usr/bin/env node
// P1 Gate B: 6 smoke runs (3 harnesses x 2 models) on a trivial write-one-file task.
// Verifies: harness runs headless, calls the gateway with the target model, writes the file, exits 0.
// Usage: node runner/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BENCH, VENDOR_BIN, buildInvocation, makeRunHome, spawnHarness, journalAppend } from './lib.mjs';

const RUNS = path.join(BENCH, 'runs');
const LOGS = path.join(BENCH, 'logs');
const STAGE = path.join(BENCH, 'stage');
const PROXY_PORT = 8901;
const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;
const GATEWAY = 'https://freeinference.org/anthropic';
const MODELS = ['glm-5.3-flash', 'deepseek-v4-flash'];
const HARNESSSES = ['claude', 'opencode', 'pi'];
const TIMEOUT_MS = 180_000;

const token = process.env.ANTHROPIC_AUTH_TOKEN;
if (!token) { console.error('ANTHROPIC_AUTH_TOKEN not set'); process.exit(1); }

// Trivial smoke task sandbox
const smokeSandbox = path.join(STAGE, 'smoke-sandbox');
fs.rmSync(smokeSandbox, { recursive: true, force: true });
fs.mkdirSync(smokeSandbox, { recursive: true });
fs.writeFileSync(path.join(smokeSandbox, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
fs.writeFileSync(
  path.join(smokeSandbox, 'README.md'),
  'This project has a small utility.\n'
);
const PROMPT = 'Create a file named util.mjs in the current directory containing an exported function `greet(name)` that returns the string `Hello, <name>!` (e.g. greet("Ada") === "Hello, Ada!"). Use ESM. Do not create any other files. When done, verify it runs with: node -e "import(\'./util.mjs\').then(m=>console.log(m.greet(\'Ada\')))" and stop.';

// Start proxy
const proxyJournal = path.join(LOGS, 'smoke-proxy.jsonl');
fs.rmSync(proxyJournal, { force: true });
const proxy = spawn(process.execPath, [path.join(BENCH, 'runner', 'proxy.mjs'), String(PROXY_PORT), proxyJournal, GATEWAY], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ANTHROPIC_AUTH_TOKEN: token },
});
await new Promise((res, rej) => {
  proxy.stdout.on('data', (d) => { if (String(d).includes('"ok":true')) res(); });
  proxy.on('exit', (c) => rej(new Error(`proxy exited ${c}`)));
  setTimeout(() => rej(new Error('proxy start timeout')), 5000);
});
console.log('proxy up on', PROXY_PORT);

const journal = path.join(LOGS, 'smoke-journal.jsonl');
fs.rmSync(journal, { force: true });
const results = [];

for (const model of MODELS) {
  for (const harness of HARNESSSES) {
    const runId = `smoke-${harness}-${model}`;
    const runHome = makeRunHome(BENCH, runId);
    const sandbox = path.join(STAGE, `${runId}-sandbox`);
    fs.rmSync(sandbox, { recursive: true, force: true });
    fs.cpSync(smokeSandbox, sandbox, { recursive: true });

    const { argv, env, configFiles } = buildInvocation(harness, model, PROMPT, runHome, PROXY_URL, token);
    for (const cf of configFiles) {
      fs.mkdirSync(path.dirname(cf.path), { recursive: true });
      fs.writeFileSync(cf.path, cf.content);
    }

    const outFile = path.join(LOGS, `${runId}.out.txt`);
    const t0 = Date.now();
    console.log(`RUN ${runId}: ${path.basename(argv[0])} ${argv.slice(1).join(' ').slice(0, 120)}...`);
    const exit = await spawnHarness(argv, env, sandbox, outFile, TIMEOUT_MS);
    const wallMs = Date.now() - t0;

    // Check the file was written correctly
    let fileOk = false;
    let fileErr = '';
    const utilPath = path.join(sandbox, 'util.mjs');
    if (fs.existsSync(utilPath)) {
      try {
        const m = await import(utilPath + `?t=${Math.random()}`);
        fileOk = m.greet('Ada') === 'Hello, Ada!';
        if (!fileOk) fileErr = 'greet returned wrong value';
      } catch (e) { fileErr = String(e).slice(0, 200); }
    } else { fileErr = 'util.mjs missing'; }

    const rec = { runId, harness, model, exitCode: exit.code, timedOut: exit.timedOut, wallMs, fileOk, fileErr: fileErr.slice(0, 200) };
    results.push(rec);
    journalAppend(journal, rec);
    console.log('  ->', JSON.stringify(rec));
    fs.rmSync(runHome, { recursive: true, force: true });
  }
}

proxy.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 500));

// Analyze proxy journal: verify requested models
const proxyRecs = fs.readFileSync(proxyJournal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byModel = {};
for (const r of proxyRecs) {
  if (r.type === 'proxy_summary') continue;
  byModel[r.model] = (byModel[r.model] || 0) + 1;
}
console.log('\nProxy journal: requests by requested-model:', JSON.stringify(byModel));
const bad = Object.keys(byModel).filter((m) => !MODELS.includes(m));
if (bad.length) console.log('!! UNEXPECTED MODELS REQUESTED:', bad);

console.log('\n===== GATE B SUMMARY =====');
for (const r of results) {
  const ok = r.exitCode === 0 && !r.timedOut && r.fileOk;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.runId} exit=${r.exitCode} timeout=${r.timedOut} fileOk=${r.fileOk} ${r.fileErr} wall=${Math.round(r.wallMs / 1000)}s`);
}
