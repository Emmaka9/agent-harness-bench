#!/usr/bin/env node
// Analysis: ranking table + cluster-bootstrap CIs + paired stats from the journal.
// Usage: node runner/analyze.mjs [--phase full] [--reps 10000]
import fs from 'node:fs';
import path from 'node:path';
import { BENCH, readJournal } from './lib.mjs';

const PHASE = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : 'full';
const REPS = Number(process.argv.includes('--reps') ? process.argv[process.argv.indexOf('--reps') + 1] : 10000);
const journalFile = path.join(BENCH, 'runs', `journal-${PHASE}.jsonl`);
const recs = readJournal(journalFile).filter((r) => r.runId && (r.score || r.failure));

const MODELS = ['glm-5.3-flash', 'deepseek-v4-flash'];
const HARNESSSES = ['claude', 'opencode', 'pi'];
const combos = [];
for (const m of MODELS) for (const h of HARNESSSES) combos.push({ model: m, harness: h });

// ---------- per-run classification ----------
// solved = all hidden tests pass; partial = tests-passed fraction; failures classified.
const byCombo = new Map(combos.map((c) => [key(c), []]));
for (const r of recs) {
  const k = key({ model: r.model, harness: r.harness });
  if (!byCombo.has(k)) continue;
  const solved = r.score && r.score.class === 'solved' ? 1 : 0;
  const frac = r.score && r.score.total > 0 ? r.score.passed / r.score.total : 0;
  const failure = r.failure || (r.score && r.score.class === 'solved' ? null : (r.score ? 'wrong_solution' : 'unknown'));
  byCombo.get(k).push({ task: r.task, seed: r.seed, solved, frac, wallMs: r.wallMs, failure, usage: r.usage, timedOut: r.timedOut });
}

// ---------- cluster bootstrap over tasks ----------
// resample tasks with replacement; within each task, average seeds; then average tasks.
function clusterBootstrap(runs, statFn, reps = REPS, seed = 42) {
  const tasks = [...new Set(runs.map((r) => r.task))];
  const byTask = new Map(tasks.map((t) => [t, runs.filter((r) => r.task === t)]));
  let s = seed >>> 0;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const stats = [];
  for (let i = 0; i < reps; i++) {
    const sample = [];
    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[Math.floor(rand() * tasks.length)];
      sample.push(...byTask.get(t));
    }
    stats.push(statFn(sample));
  }
  stats.sort((a, b) => a - b);
  return { lo: stats[Math.floor(0.025 * reps)], hi: stats[Math.ceil(0.975 * reps) - 1], mean: stats[Math.floor(reps / 2)] };
}

const solveRate = (runs) => runs.reduce((a, r) => a + r.solved, 0) / runs.length;
const testFrac = (runs) => runs.reduce((a, r) => a + r.frac, 0) / runs.length;

// ---------- report ----------
const rows = [];
for (const c of combos) {
  const runs = byCombo.get(key(c));
  if (!runs || !runs.length) { rows.push({ ...c, n: 0 }); continue; }
  const boot = clusterBootstrap(runs, solveRate);
  const bootFrac = clusterBootstrap(runs, testFrac);
  const solved = runs.reduce((a, r) => a + r.solved, 0);
  const failureCounts = {};
  for (const r of runs) if (r.failure) failureCounts[r.failure] = (failureCounts[r.failure] || 0) + 1;
  rows.push({
    ...c, n: runs.length,
    solveRate: solveRate(runs), solveLo: boot.lo, solveHi: boot.hi,
    testFrac: testFrac(runs), fracLo: bootFrac.lo, fracHi: bootFrac.hi,
    meanWallS: runs.reduce((a, r) => a + r.wallMs, 0) / runs.length / 1000,
    solved, failureCounts,
    tokensIn: runs.reduce((a, r) => a + (r.usage?.input || 0), 0),
    tokensOut: runs.reduce((a, r) => a + (r.usage?.output || 0), 0),
    timeouts: runs.filter((r) => r.timedOut).length,
  });
}

rows.sort((a, b) => (b.solveRate ?? 0) - (a.solveRate ?? 0) || (b.testFrac ?? 0) - (a.testFrac ?? 0));
console.log('=== RANKING (primary: solve rate; secondary: per-test fraction) ===');
console.log('rank combo                          n   solve  95% CI        testFrac 95% CI        wall_s  tok_in  tok_out  timeouts  failures');
rows.forEach((r, i) => {
  const name = `${r.harness}/${r.model}`.padEnd(24);
  if (!r.n) { console.log(`${String(i + 1).padStart(2)}  ${name}  n=0`); return; }
  const ci = `[${(r.solveLo * 100).toFixed(0)}–${(r.solveHi * 100).toFixed(0)}%]`;
  const ciF = `[${(r.fracLo * 100).toFixed(0)}–${(r.fracHi * 100).toFixed(0)}%]`;
  console.log(`${String(i + 1).padStart(2)}  ${name}  ${String(r.n).padStart(3)}  ${(r.solveRate * 100).toFixed(0).padStart(5)}%  ${ci.padEnd(12)}  ${(r.testFrac * 100).toFixed(0).padStart(5)}%  ${ciF.padEnd(12)}  ${r.meanWallS.toFixed(0).padStart(5)}  ${String(r.tokensIn).padStart(6)}  ${String(r.tokensOut).padStart(7)}  ${String(r.timeouts).padStart(3)}  ${JSON.stringify(r.failureCounts)}`);
});

// ---------- paired head-to-heads ----------
console.log('\n=== PAIRED HEAD-TO-HEAD (same task+seed) ===');
function pairwise(aKey, bKey) {
  const A = byCombo.get(aKey) || [], B = byCombo.get(bKey) || [];
  const mapB = new Map(B.map((r) => [`${r.task}-s${r.seed}`, r]));
  let win = 0, tie = 0, loss = 0; const diffs = [];
  for (const a of A) {
    const b = mapB.get(`${a.task}-s${a.seed}`);
    if (!b) continue;
    diffs.push({ task: a.task, seed: a.seed, d: a.solved - b.solved, df: a.frac - b.frac });
    if (a.solved > b.solved) win++; else if (a.solved < b.solved) loss++; else tie++;
  }
  // Wilcoxon at this n is low-power; report W/T/L + mean frac diff (documented in report)
  const n = diffs.length;
  const meanD = diffs.length ? diffs.reduce((s, d) => s + d.df, 0) / diffs.length : 0;
  return { win, tie, loss, meanFracDiff: meanD, n };
}
for (const m of MODELS) {
  const r1 = pairwise(key({ model: m, harness: 'claude' }), key({ model: m, harness: 'opencode' }));
  const r2 = pairwise(key({ model: m, harness: 'claude' }), key({ model: m, harness: 'pi' }));
  const r3 = pairwise(key({ model: m, harness: 'opencode' }), key({ model: m, harness: 'pi' }));
  console.log(`${m}: claude-vs-opencode W/T/L=${r1.win}/${r1.tie}/${r1.loss} (Δfrac=${r1.meanFracDiff.toFixed(2)}) | claude-vs-pi W/T/L=${r2.win}/${r2.tie}/${r2.loss} (Δfrac=${r2.meanFracDiff.toFixed(2)}) | opencode-vs-pi W/T/L=${r3.win}/${r3.tie}/${r3.loss} (Δfrac=${r3.meanFracDiff.toFixed(2)})`);
}
for (const h of HARNESSSES) {
  const r1 = pairwise(key({ model: 'glm-5.3-flash', harness: h }), key({ model: 'deepseek-v4-flash', harness: h }));
  console.log(`${h}: glm-vs-deepseek W/T/L=${r1.win}/${r1.tie}/${r1.loss} (Δfrac=${r1.meanFracDiff.toFixed(2)})`);
}

// ---------- per-task matrix ----------
console.log('\n=== PER-TASK SOLVE MATRIX ===');
const allTasks = [...new Set(recs.map((r) => r.task))].sort();
const header = 'task  ' + combos.map((c) => `${c.harness.slice(0, 2)}:${c.model === 'glm-5.3-flash' ? 'glm' : 'ds'}`).map((s) => s.padEnd(7)).join('');
console.log(header);
for (const t of allTasks) {
  const cells = combos.map((c) => {
    const runs = (byCombo.get(key(c)) || []).filter((r) => r.task === t);
    return runs.length ? `${runs.reduce((a, r) => a + r.solved, 0)}/${runs.length}`.padEnd(7) : '-'.padEnd(7);
  });
  console.log(t.padEnd(5) + ' ' + cells.join(''));
}

function key(c) { return `${c.harness}/${c.model}`; }
