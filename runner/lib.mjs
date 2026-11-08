#!/usr/bin/env node
// Shared library for the benchmark runner: harness spawn, isolation, journal.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const BENCH = path.resolve(import.meta.dirname, '..');
export const VENDOR_BIN = path.join(BENCH, 'vendor', 'node_modules', '.bin');

// ---------- config instantiation ----------
// Reads bench/configs/harness-configs.json and fills <PROMPT>, <MODEL>, <PROXY>,
// <RUNHOME>, <TOKEN> placeholders for a specific run.
export function buildInvocation(harness, model, prompt, runHome, proxyUrl, token) {
  const cfg = JSON.parse(fs.readFileSync(path.join(BENCH, 'configs', 'harness-configs.json'), 'utf8'));
  const h = cfg[harness];
  if (!h) throw new Error(`unknown harness ${harness}`);

  const subst = (v) => {
    if (typeof v === 'string') {
      return v
        .replaceAll('<PROMPT>', prompt)
        .replaceAll('<MODEL>', model)
        .replaceAll('<PROXY>', proxyUrl)
        .replaceAll('<RUNHOME>', runHome)
        .replaceAll('<TOKEN>', token);
    }
    if (Array.isArray(v)) return v.map(subst);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k.replaceAll('<MODEL>', model)] = subst(val);
      return out;
    }
    return v;
  };

  const argv = h.argv.map(subst);
  let bin = h.bin;
  if (bin.includes('/')) bin = path.resolve(BENCH, bin); // relative to bench/
  argv.unshift(bin);

  const proxyUrlOpenAI = proxyUrl; // same local proxy; it forwards to the gateway's OpenAI wire when the path starts with /v1/chat
  const substOpenAI = (v) => {
    if (typeof v === 'string') {
      return v
        .replaceAll('<PROXY_OPENAI>', proxyUrlOpenAI)
        .replaceAll('<PROMPT>', prompt)
        .replaceAll('<MODEL>', model)
        .replaceAll('<PROXY>', proxyUrl)
        .replaceAll('<RUNHOME>', runHome)
        .replaceAll('<TOKEN>', token);
    }
    if (Array.isArray(v)) return v.map(substOpenAI);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k.replaceAll('<MODEL>', model)] = substOpenAI(val);
      return out;
    }
    return v;
  };

  const configFiles = [];
  for (const [file, content] of Object.entries(h.config_files || {})) {
    const target = substOpenAI(file);
    configFiles.push({ path: target, content: JSON.stringify(substOpenAI(content), null, 2) + '\n' });
  }

  const env = {
    HOME: path.join(runHome, 'home'),
    ...Object.fromEntries(Object.entries(h.isolation_env || {}).map(([k, v]) => [k, subst(v)])),
    ...Object.fromEntries(Object.entries(h.extra_env || {}).map(([k, v]) => [k, subst(v)])),
  };

  return { argv, env, configFiles };
}

// ---------- run environment ----------
// Create a fresh per-run home: empty home dir, no dotfiles, nothing from the operator.
export function makeRunHome(root, runId) {
  const runHome = path.join(root, 'home', runId);
  fs.rmSync(runHome, { recursive: true, force: true });
  fs.mkdirSync(path.join(runHome, 'home'), { recursive: true });
  return runHome;
}

// ---------- harness spawn ----------
// Spawns the harness detached in its own process group so we can kill the whole tree.
export function spawnHarness(argv, env, cwd, outPath, timeoutMs) {
  return new Promise((resolve) => {
    const out = fs.openSync(outPath, 'a');
    // Scrub operator-env leakage: harnesses must reach the gateway only via their own
    // per-run config files (pointing at the run proxy). Inherited ANTHROPIC_*/OPENAI_*/
    // CLAUDE_*/PI_*/XDG_* vars from the operator shell would override that isolation.
    const inherited = { ...process.env };
    for (const k of Object.keys(inherited)) {
      if (/^(ANTHROPIC_|OPENAI_|CLAUDE_|PI_|XDG_)/.test(k)) delete inherited[k];
    }
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env: { ...inherited, ...env, PATH: process.env.PATH, PWD: cwd, OLDPWD: cwd },
      detached: true,
      stdio: ['ignore', out, out],
    });
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, timeoutMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      fs.closeSync(out);
      resolve({ code, signal, timedOut: signal === 'SIGKILL' });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      fs.closeSync(out);
      resolve({ code: -1, signal: null, timedOut: false, spawnError: String(e) });
    });
  });
}

// ---------- journal ----------
export function journalAppend(journalFile, rec) {
  fs.appendFileSync(journalFile, JSON.stringify(rec) + '\n');
}

export function readJournal(journalFile) {
  if (!fs.existsSync(journalFile)) return [];
  return fs
    .readFileSync(journalFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// ---------- util ----------
export function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
export function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
export function copyDir(src, dest) {
  mkdirp(dest);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
export function nowIso() { return new Date().toISOString(); }
