#!/usr/bin/env node
// Experiment analysis for E3 (guided), E4 (hard tasks), E5 (misleading hints).
//
// E3: journal-guided.jsonl (seed 0, guide injected) vs unguided seed-0 baseline
//     from journal-full.jsonl. Question: does normalizing workflow guidance close
//     the harness gap, especially opencode+deepseek vs claude+deepseek?
// E4: journal-full.jsonl t9,t10,t11 vs t1..t8 — does glm's saturation (100%)
//     break on harder tasks? does the harness gap widen when headroom returns?
// E5: journal-hint.jsonl (seed 3 + misleading hint) vs seed-3-free expectation.
//     Question: which combo follows plausible-but-wrong hints (pattern follower)
//     vs holds the spec line (spec fidelity)?
//
// Usage: node runner/experiments.mjs
import fs from 'node:fs';
import path from 'node:path';
import { BENCH } from './lib.mjs';

const RUNS = path.join(BENCH, 'runs');
const read = (f) => fs.readFileSync(path.join(RUNS, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// Infra-invalid records are excluded from every experiment comparison (same rule as
// analyze.mjs): timeouts, gateway-degraded, runner/grade errors, 429-with-zero-requests.
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
const full = read('journal-full.jsonl').filter((r) => !isInfraInvalid(r));
const e4recs = fs.existsSync(path.join(RUNS, 'journal-e4.jsonl')) ? read('journal-e4.jsonl').filter((r) => !isInfraInvalid(r)) : [];
const guided = fs.existsSync(path.join(RUNS, 'journal-guided.jsonl')) ? read('journal-guided.jsonl').filter((r) => !isInfraInvalid(r)) : [];
const hinted = fs.existsSync(path.join(RUNS, 'journal-hint.jsonl')) ? read('journal-hint.jsonl').filter((r) => !isInfraInvalid(r)) : [];
let e2 = null;
if (fs.existsSync(path.join(RUNS, 'e2-taxonomy.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(RUNS, 'e2-taxonomy.json'), 'utf8'));
  e2 = Array.isArray(raw) ? { rows: raw } : raw; // saved as bare array of 29 rows
}

const scored = (r) => r.score && r.score.total > 0 && !r.failure;
const frac = (n, d) => (d ? (n / d).toFixed(2) : 'n/a');
const pct = (arr) => {
  const s = arr.filter(scored);
  if (!s.length) return 'n/a';
  const pass = s.filter((r) => r.score.class === 'solved').length;
  return `${(100 * pass / s.length).toFixed(0)}% (${pass}/${s.length})`;
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---------------- E3: guided vs unguided ----------------
function e3() {
  if (!guided.length) return null;
  // Strata-matched comparison (REVIEW-20261108-0247 #1): both sides restricted to the
  // SAME task set. Guided runs on easy tasks (t1-t8) pair against the full-matrix seed-0
  // baseline; guided runs on hard tasks (t9-t11) pair against the E4 seed-0 baseline.
  // The two strata are reported separately and never pooled.
  const HARD = ['t9', 't10', 't11'];
  const easyGuide = guided.filter((r) => !HARD.includes(r.task));
  const hardGuide = guided.filter((r) => HARD.includes(r.task));
  const base0 = full.filter((r) => scored(r) && r.seed === 0 && !HARD.includes(r.task));
  const base0Hard = e4recs.filter((r) => scored(r) && r.seed === 0);
  const rows = [];
  const combos = [...new Set([...base0, ...easyGuide, ...base0Hard, ...hardGuide].map((r) => `${r.harness}/${r.model}`))];
  for (const c of combos) {
    const [h, m] = c.split('/');
    const b = base0.filter((r) => r.harness === h && r.model === m);
    const g = easyGuide.filter((r) => scored(r) && r.harness === h && r.model === m);
    const bH = base0Hard.filter((r) => r.harness === h && r.model === m);
    const gH = hardGuide.filter((r) => scored(r) && r.harness === h && r.model === m);
    const solved = (arr) => arr.filter((r) => r.score.class === 'solved').length;
    const bPct = b.length ? (100 * solved(b) / b.length).toFixed(0) : '-';
    const gPct = g.length ? (100 * solved(g) / g.length).toFixed(0) : '-';
    const delta = b.length && g.length ? (100 * solved(g) / g.length - 100 * solved(b) / b.length).toFixed(0) : '?';
    // paired per-task deltas
    const paired = [];
    for (const t of [...new Set(g.map((r) => r.task))]) {
      const bt = b.find((r) => r.task === t);
      const gt = g.find((r) => r.task === t);
      if (bt && gt) paired.push({ task: t, b: bt.score.class === 'solved', g: gt.score.class === 'solved' });
    }
    const row = { combo: c };
    if (b.length || g.length) {
      row.base = `${solved(b)}/${b.length} (${bPct}%)`;
      row.guided = `${solved(g)}/${g.length} (${gPct}%)`;
      row.delta = delta;
      row.paired = paired;
      row.stratum = 'easy (t1-t8)';
    }
    if (bH.length || gH.length) {
      const gHPct = gH.length ? (100 * solved(gH) / gH.length).toFixed(0) : '-';
      const bHPct = bH.length ? (100 * solved(bH) / bH.length).toFixed(0) : '-';
      row.baseHard = `${solved(bH)}/${bH.length} (${bHPct}%)`;
      row.guidedHard = `${solved(gH)}/${gH.length} (${gHPct}%)`;
      row.deltaHard = bH.length && gH.length ? (100 * solved(gH) / gH.length - 100 * solved(bH) / bH.length).toFixed(0) : '?';
      row.pairedHard = [];
      for (const t of [...new Set(gH.map((r) => r.task))]) {
        const bt = bH.find((r) => r.task === t);
        const gt = gH.find((r) => r.task === t);
        if (bt && gt) row.pairedHard.push({ task: t, b: bt.score.class === 'solved', g: gt.score.class === 'solved' });
      }
      row.stratumHard = 'hard (t9-t11), E4 seed-0 baseline';
    }
    rows.push(row);
  }
  return rows;
}

// ---------------- E4: difficulty scaling ----------------
function e4() {
  const HARD = ['t9', 't10', 't11'];
  const hard = e4recs.filter((r) => scored(r) && HARD.includes(r.task));
  const easy = full.filter((r) => scored(r) && !HARD.includes(r.task));
  const rows = [];
  for (const h of ['claude', 'opencode', 'pi']) {
    for (const m of ['glm-5.3-flash', 'deepseek-v4-flash']) {
      const he = easy.filter((r) => r.harness === h && r.model === m);
      const hh = hard.filter((r) => r.harness === h && r.model === m);
      const hs = (a) => a.filter((r) => r.score.class === 'solved').length;
      // partial credit on hard tasks
      const pc = mean(hh.map((r) => r.score.passed / r.score.total));
      rows.push({
        combo: `${h}/${m}`,
        easy: hs(easy.filter((r) => r.harness === h && r.model === m)) ? `${hs(he)}/${he.length}` : `0/${he.length}`,
        hard: `${hs(hh)}/${hh.length}`,
        hardPartial: hh.length ? pc.toFixed(2) : '-',
      });
    }
  }
  // stub baselines from journal if graded runs exist for stubs (not tracked) — report task-level:
  const hardByTask = {};
  for (const t of HARD) {
    const rs = hard.filter((r) => r.task === t);
    hardByTask[t] = rs.map((r) => `${r.harness.slice(0, 2)}:${r.score.passed}/${r.score.total}`).join(' ');
  }
  // Planned vs exploratory split (REVIEW-20261108-0247): seed 0 was the pre-registered E4
  // design; seeds 1/2 were added afterwards for power. Report both, keep them separable.
  const hardSeed0 = hard.filter((r) => r.seed === 0);
  const hardExtra = hard.filter((r) => r.seed > 0);
  return {
    rows, hardByTask,
    hardN: hard.length,
    plannedSeed0N: hardSeed0.length,
    exploratoryExtraN: hardExtra.length,
    hardSeed0Rows: rows.map((r) => {
      const [h, m] = r.combo.split('/');
      const hs0 = hardSeed0.filter((x) => x.harness === h && x.model === m);
      const hsx = hardExtra.filter((x) => x.harness === h && x.model === m);
      const hs = (a) => a.filter((x) => x.score.class === 'solved').length;
      return { combo: r.combo, seed0: `${hs(hs0)}/${hs0.length}`, extraSeeds: `${hs(hsx)}/${hsx.length}` };
    }),
  };
}

// E5: misleading hints ----------------
// Each hint contradicts one spec requirement; the tests covering it:
const HINT_TESTS = {
  t1: [/expired entry return their falsy result/, /failed \(expired\) get removes the entry/],
  t4: [/terminal may be scheduled again/],
  t7: [/Object\.is for primitives/],
  t8: [/duplicate node entries treated as a set/],
};

function e5() {
  if (!hinted.length) return null;
  const HINT_TASKS = ['t1', 't4', 't7', 't8'];
  const rows = [];
  for (const r of hinted.filter(scored)) {
    if (!HINT_TASKS.includes(r.task)) continue;
    const pats = HINT_TESTS[r.task] || [];
    const hintTests = r.score.tests.filter((tt) => pats.some((p) => p.test(tt.name)));
    const hintFailed = hintTests.filter((tt) => !tt.pass);
    rows.push({
      runId: r.runId,
      solved: r.score.class === 'solved',
      passed: `${r.score.passed}/${r.score.total}`,
      hintTargetTests: hintTests.length,
      hintTargetFailed: hintFailed.map((tt) => tt.name),
      hintFollowed: hintTests.length > 0 && hintFailed.length === hintTests.length,
      // partial following: at least one hint-target test failed
      hintBitten: hintFailed.length > 0,
      totalMisses: r.score.total - r.score.passed,
    });
  }
  // combo-level bite rate
  const byCombo = {};
  for (const r of rows) {
    const k = r.runId.split('-').slice(2).join('-'); // harness-model
    byCombo[k] = byCombo[k] || { runs: 0, bitten: 0, followed: 0, solved: 0 };
    byCombo[k].runs++;
    if (r.hintBitten) byCombo[k].bitten++;
    if (r.hintFollowed) byCombo[k].followed++;
    if (r.solved) byCombo[k].solved++;
  }
  return { rows, byCombo };
}

// ---------------- report ----------------
const out = { generated: new Date().toISOString(), e3: e3(), e4: e4(), e5: e5(), e2Summary: e2 ? {  total: (e2.rows ?? []).length,
  byPrimary: (e2.rows ?? []).reduce((m, r) => { m[r.primary] = (m[r.primary] || 0) + 1; return m; }, {}),
  byComboModel: (e2.rows ?? []).reduce((m, r) => {
    const model = r.runId.includes('glm') ? 'glm' : 'deepseek';
    const h = r.runId.split('-')[2];
    const k = `${h}/${model}`;
    m[k] = m[k] || { n: 0, spec_misread: 0, edge_case_miss: 0 };
    m[k].n++;
    if (r.primary === 'spec_misread') m[k].spec_misread++;
    if (r.primary === 'edge_case_miss') m[k].edge_case_miss++;
    return m;
  }, {}),
} : null };

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(RUNS, 'experiments.json'), JSON.stringify(out, null, 2));
console.log('\nwrote runs/experiments.json');
