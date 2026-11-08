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
// analyze.mjs post-REVIEW-20261108-0345): gateway-degraded, runner/grade errors,
// 429-with-zero-requests. Ordinary fixed-budget timeouts are benchmark OUTCOMES and
// count as unsolved; they are NOT excluded and NOT retried-until-success.
function isInfraInvalid(r) {
  return Boolean(
    r.failure === 'gateway_degraded' ||
    r.failure === 'runner_error' ||
    r.failure === 'grade_error' ||
    (r.modelCheck?.saw429 && (r.usage?.requests ?? 0) === 0)
  );
}
const full = read('journal-full.jsonl').filter((r) => !isInfraInvalid(r));
const e4recs = fs.existsSync(path.join(RUNS, 'journal-e4.jsonl')) ? read('journal-e4.jsonl').filter((r) => !isInfraInvalid(r)) : [];
const guided = fs.existsSync(path.join(RUNS, 'journal-guided.jsonl')) ? read('journal-guided.jsonl').filter((r) => !isInfraInvalid(r)) : [];
const hinted = fs.existsSync(path.join(RUNS, 'journal-hint.jsonl')) ? read('journal-hint.jsonl').filter((r) => !isInfraInvalid(r)) : [];
// Replacement runs (FOLLOWUP-FOUR-RUNS-20261108): four hardened-runner t10-s0 reruns of
// compromised E4 cells. Selection policy (documented in runs/e4-replace/README.md):
//   replace-policy (default for published tables): for the four replaced runIds, use the
//     latest valid e4-replace record INSTEAD OF the retained/quarantined original; all
//     other cells unchanged. Rationale: the originals lack run-scoped attribution
//     (3 retained pre-hardening) or verifiable provenance (1 quarantined), so the
//     hardened rerun is the best-evidence record for those cells.
//   retain-policy (sensitivity): keep originals; the replacement records exist but do
//     not enter aggregates. Shows whether any conclusion depends on the swap.
const e4replace = fs.existsSync(path.join(RUNS, 'journal-e4-replace.jsonl'))
  ? read('journal-e4-replace.jsonl').filter((r) => !isInfraInvalid(r))
  : [];
const REPLACED_RUNIDS = new Set([
  't10-s0-opencode-glm-5.3-flash',
  't10-s0-pi-glm-5.3-flash',
  't10-s0-claude-deepseek-v4-flash',
  't10-s0-opencode-deepseek-v4-flash',
]);
// Both views keyed by runId (latest attempt wins inside each source).
const latestBy = (arr) => {
  const m = new Map();
  for (const r of arr) m.set(r.runId, r);
  return m;
};
function mergeReplace(baseArr, replArr) {
  const base = latestBy(baseArr);
  const repl = latestBy(replArr.filter((r) => REPLACED_RUNIDS.has(r.runId)));
  for (const [rid, r] of repl) base.set(rid, r); // replacement wins for replaced cells only
  return [...base.values()];
}
let e2 = null;
if (fs.existsSync(path.join(RUNS, 'e2-taxonomy.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(RUNS, 'e2-taxonomy.json'), 'utf8'));
  e2 = Array.isArray(raw) ? { rows: raw } : raw; // saved as bare array of 29 rows
}

// scored: has a grade and is not infra-invalid. Timed-out runs KEEP their graded
// score and count as unsolved (class !== 'solved') — fixed-budget policy; their
// failure === 'timeout' stays on the record but does not disqualify them here.
const scored = (r) => r.score && r.score.total > 0 && !(r.failure && r.failure !== 'timeout');
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
  // Strata-matched comparison (REVIEW-20261108-0247 #1, tightened by REVIEW-20261108-0345 #2):
  // both sides restricted to the SAME task set AND matched on exact
  // task|seed|harness|model keys. Fixed-budget policy: ordinary timeouts count as
  // unsolved on BOTH sides (they are benchmark outcomes). Rows report matched n and
  // any unmatched records so unequal sets are visible, never silently pooled.
  const HARD = ['t9', 't10', 't11'];
  const key = (r) => [r.task, r.seed, r.harness, r.model].join('|');
  const baseEasy = new Map(full.filter((r) => scored(r) && r.seed === 0 && !HARD.includes(r.task)).map((r) => [key(r), r]));
  const baseHard = new Map(mergeReplace(e4recs, e4replace).filter((r) => scored(r) && r.seed === 0).map((r) => [key(r), r]));
  const rows = [];
  const combos = [...new Set([...full, ...e4recs, ...guided].map((r) => `${r.harness}/${r.model}`))];
  for (const c of combos) {
    const [h, m] = c.split('/');
    const gEasy = guided.filter((r) => scored(r) && r.harness === h && r.model === m && !HARD.includes(r.task));
    const gHard = guided.filter((r) => scored(r) && r.harness === h && r.model === m && HARD.includes(r.task));
    const solved = (arr) => arr.filter((r) => r.score.class === 'solved').length;
    const row = { combo: c };
    // easy stratum: matched keys only
    const mEasy = gEasy.filter((r) => baseEasy.has(key(r)));
    const unEasy = gEasy.length - mEasy.length;
    if (gEasy.length || [...baseEasy.values()].some((r) => r.harness === h && r.model === m)) {
      const bEasy = mEasy.map((r) => baseEasy.get(key(r)));
      const bPct = bEasy.length ? (100 * solved(bEasy) / bEasy.length).toFixed(0) : '-';
      const gPct = mEasy.length ? (100 * solved(mEasy) / mEasy.length).toFixed(0) : '-';
      row.stratum = 'easy (t1-t8)';
      row.base = `${solved(bEasy)}/${bEasy.length} (${bPct}%)`;
      row.guided = `${solved(mEasy)}/${mEasy.length} (${gPct}%)`;
      row.delta = bEasy.length && mEasy.length ? (100 * solved(mEasy) / mEasy.length - 100 * solved(bEasy) / bEasy.length).toFixed(0) : '?';
      row.matchedN = bEasy.length;
      row.unmatchedGuided = unEasy;
      row.paired = mEasy.map((r) => ({ task: r.task, b: baseEasy.get(key(r)).score.class === 'solved', g: r.score.class === 'solved' }));
    }
    // hard stratum: matched keys only (baseline = E4 seed-0, incl. timeouts as unsolved)
    const mHard = gHard.filter((r) => baseHard.has(key(r)));
    const unHard = gHard.length - mHard.length;
    if (gHard.length || [...baseHard.values()].some((r) => r.harness === h && r.model === m)) {
      const bHard = mHard.map((r) => baseHard.get(key(r)));
      const bHPct = bHard.length ? (100 * solved(bHard) / bHard.length).toFixed(0) : '-';
      const gHPct = mHard.length ? (100 * solved(mHard) / mHard.length).toFixed(0) : '-';
      row.stratumHard = 'hard (t9-t11), E4 seed-0 baseline';
      row.baseHard = `${solved(bHard)}/${bHard.length} (${bHPct}%)`;
      row.guidedHard = `${solved(mHard)}/${mHard.length} (${gHPct}%)`;
      row.deltaHard = bHard.length && mHard.length ? (100 * solved(mHard) / mHard.length - 100 * solved(bHard) / bHard.length).toFixed(0) : '?';
      row.matchedNHard = bHard.length;
      row.unmatchedGuidedHard = unHard;
      row.pairedHard = mHard.map((r) => ({ task: r.task, b: baseHard.get(key(r)).score.class === 'solved', g: r.score.class === 'solved' }));
    }
    rows.push(row);
  }
  return rows;
}

// ---------------- E4: difficulty scaling ----------------
function e4() {
  const HARD = ['t9', 't10', 't11'];
  const compute = (e4src) => {
    const hard = e4src.filter((r) => scored(r) && HARD.includes(r.task));
    const rows = [];
    for (const h of ['claude', 'opencode', 'pi']) {
      for (const m of ['glm-5.3-flash', 'deepseek-v4-flash']) {
        const hh = hard.filter((r) => r.harness === h && r.model === m);
        const hs = (a) => a.filter((r) => r.score.class === 'solved').length;
        const pc = mean(hh.map((r) => r.score.passed / r.score.total));
        rows.push({ combo: `${h}/${m}`, hard: `${hs(hh)}/${hh.length}`, hardPartial: hh.length ? pc.toFixed(2) : '-' });
      }
    }
    const hardSeed0 = hard.filter((r) => r.seed === 0);
    const hardExtra = hard.filter((r) => r.seed > 0);
    const hs = (a) => a.filter((r) => r.score.class === 'solved').length;
    return {
      rows,
      hardN: hard.length,
      plannedSeed0N: hardSeed0.length,
      exploratoryExtraN: hardExtra.length,
      hardSeed0Rows: rows.map((r) => {
        const [h, m] = r.combo.split('/');
        const hs0 = hardSeed0.filter((x) => x.harness === h && x.model === m);
        const hsx = hardExtra.filter((x) => x.harness === h && x.model === m);
        return { combo: r.combo, seed0: `${hs(hs0)}/${hs0.length}`, extraSeeds: `${hs(hsx)}/${hsx.length}` };
      }),
    };
  };
  const retained = compute(e4recs);
  const replaced = compute(mergeReplace(e4recs, e4replace));
  // task-level breakdown (replace-policy): per hard task, per-model solved/total + partial
  const HARD_TASKS = ['t9', 't10', 't11'];
  const hardReplaced = mergeReplace(e4recs, e4replace).filter((r) => scored(r) && HARD_TASKS.includes(r.task));
  const hardByTask = {};
  for (const t of HARD_TASKS) {
    hardByTask[t] = {};
    for (const m of ['glm-5.3-flash', 'deepseek-v4-flash']) {
      const rs = hardReplaced.filter((r) => r.task === t && r.model === m);
      const s = rs.filter((r) => r.score.class === 'solved').length;
      const pc = rs.length ? mean(rs.map((r) => r.score.passed / r.score.total)) : null;
      hardByTask[t][m === 'glm-5.3-flash' ? 'glm' : 'ds'] = `${s}/${rs.length}` + (pc !== null ? ` pc ${pc.toFixed(2)}` : '');
    }
  }
  const changed = [];
  for (let i = 0; i < retained.rows.length; i++) {
    if (retained.rows[i].hard !== replaced.rows[i].hard || retained.rows[i].hardPartial !== replaced.rows[i].hardPartial) {
      changed.push({ combo: retained.rows[i].combo, retain: retained.rows[i].hard + ' pc ' + retained.rows[i].hardPartial, replace: replaced.rows[i].hard + ' pc ' + replaced.rows[i].hardPartial });
    }
  }
  const easy = full.filter((r) => scored(r) && !HARD.includes(r.task));
  return {
    ...replaced,
    hardByTask,
    rows: replaced.rows.map((r) => {
      const [h, m] = r.combo.split('/');
      const he = easy.filter((x) => x.harness === h && x.model === m);
      const hs = (a) => a.filter((x) => x.score.class === 'solved').length;
      return { ...r, easy: `${hs(he)}/${he.length}` };
    }),
    replacementSensitivity: { policy: 'replace (default): hardened rerun wins for the 4 replaced t10-s0 cells; retain = originals kept', changedCells: changed, retainedView: retained.rows, replacedRunIds: [...REPLACED_RUNIDS], replacementRecordsUsed: latestBy(e4replace).size },
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
