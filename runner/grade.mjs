#!/usr/bin/env node
// Hidden-test grader: stages tests into a temp dir, runs node --test with explicit file
// list (Node v22.23.4 does not expand directory args), parses TAP for per-test results.
// Usage: import { gradeSolution } from './grade.mjs'
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

// Copy hidden tests next to the solution so relative imports '../src/...' resolve.
// Layout: <stage>/__grade__/gNN_*.test.mjs ; solution at <stage>/<original sandbox files>
// Tests import '../src/cache.js' -> resolves to <stage>/src/cache.js. So the sandbox
// contents are copied into <stage>/ (at top level), and tests go into <stage>/__grade__/.
export function gradeSolution(sandboxDir, hiddenTestsDir, timeoutMs = 60_000) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-grade-'));
  try {
    // copy sandbox contents (the agent's solution) to stage root
    for (const e of fs.readdirSync(sandboxDir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === '__grade__') continue;
      const s = path.join(sandboxDir, e.name);
      const d = path.join(stage, e.name);
      if (e.isDirectory()) fs.cpSync(s, d, { recursive: true });
      else fs.copyFileSync(s, d);
    }
    // copy hidden tests into stage/__grade__/
    const gradeDir = path.join(stage, '__grade__');
    fs.mkdirSync(gradeDir, { recursive: true });
    const testFiles = [];
    for (const e of fs.readdirSync(hiddenTestsDir, { withFileTypes: true })) {
      const s = path.join(hiddenTestsDir, e.name);
      const d = path.join(gradeDir, e.name);
      if (e.isDirectory()) fs.cpSync(s, d, { recursive: true });
      else { fs.copyFileSync(s, d); if (e.name.endsWith('.test.mjs')) testFiles.push(d); }
    }
    // index.js aggregator (some tasks ship one for the node --test quirk)
    const idx = path.join(gradeDir, 'index.js');
    if (fs.existsSync(idx)) testFiles.push(idx);

    if (!testFiles.length) return { ok: false, class: 'grade_error', total: 0, passed: 0, tests: [], error: 'no test files found' };

    // Node v22.23.4: directory args to --test fail with MODULE_NOT_FOUND -> pass explicit files.
    // index.js aggregator imports the individual files; when present pass only it to avoid double-run.
    const argvFiles = idx && testFiles.includes(idx) && testFiles.length > 1 ? [idx] : testFiles;
    const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...argvFiles], {
      cwd: stage, timeout: timeoutMs, encoding: 'utf8', killSignal: 'SIGKILL',
    });
    const tap = res.stdout || '';
    const tests = parseTAP(tap);
    const passed = tests.filter((t) => t.pass).length;
    const total = tests.length;
    // Re-grade once on any failure to rule out env flake (deterministic tests shouldn't flake)
    let final = { tests, passed, total };
    if (total === 0 || passed < total) {
      const res2 = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...argvFiles], {
        cwd: stage, timeout: timeoutMs, encoding: 'utf8', killSignal: 'SIGKILL',
      });
      const tests2 = parseTAP(res2.stdout || '');
      if (tests2.length > tests.length || countPass(tests2) > passed) {
        final = { tests: tests2, passed: countPass(tests2), total: tests2.length };
      }
    }
    const { tests: ft, passed: fp, total: ftot } = final;
    if (ftot === 0) return { ok: false, class: 'grade_error', total: 0, passed: 0, tests: [], error: (res.stderr || 'no TAP output').slice(0, 300) };
    return {
      ok: fp === ftot,
      class: fp === ftot ? 'solved' : 'wrong_solution',
      total: ftot, passed: fp,
      tests: ft.map((t) => ({ name: t.name, pass: t.pass })),
      gradeMs: res.duration || null,
    };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function countPass(tests) { return tests.filter((t) => t.pass).length; }

export function parseTAP(tap) {
  const tests = [];
  // TAP from node --test: each assertion "ok N - <name>" / "not ok N - <name>".
  // Subtests are indented; count only top-level (non-indented) assertions to avoid double counting.
  const lines = tap.split('\n');
  for (const line of lines) {
    const m = line.match(/^(not )?ok \d+ - (.+?)(?: #|$)/);
    if (m && !line.startsWith('    ')) {
      tests.push({ pass: !m[1], name: m[2].slice(0, 120) });
    }
  }
  return tests;
}
