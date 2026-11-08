#!/usr/bin/env node
// Token redaction for report/archival (plan P7): removes the gateway token from any
// artifact that will be shared. Run before sending results anywhere.
// Usage: node runner/redact.mjs <file-or-dir> [...]
import fs from 'node:fs';
import path from 'node:path';

function token() {
  // settings.json env or process env
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.claude', 'settings.json'), 'utf8'));
    return s.env?.ANTHROPIC_AUTH_TOKEN || null;
  } catch { return null; }
}

const TOKEN = token();
if (!TOKEN) { console.error('no token found; nothing to redact'); process.exit(1); }
const REPLACEMENTS = [
  [TOKEN, '<REDACTED_TOKEN>'],
  [Buffer.from(TOKEN).toString('base64'), '<REDACTED_TOKEN_B64>'],
];

function redactFile(f) {
  const txt = fs.readFileSync(f, 'utf8');
  let out = txt, hits = 0;
  for (const [needle, rep] of REPLACEMENTS) {
    if (needle && needle.length > 8) {
      const n = out.split(needle).length - 1;
      if (n) { out = out.split(needle).join(rep); hits += n; }
    }
  }
  if (hits) { fs.writeFileSync(f, out); }
  return hits;
}

function walk(p, stats) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) walk(path.join(p, e), stats);
  } else if (st.size < 50 * 1024 * 1024) {
    try { const h = redactFile(p); if (h) { stats.files++; stats.hits += h; console.log(`redacted ${h} occurrence(s): ${p}`); } } catch {}
  }
}

const stats = { files: 0, hits: 0 };
for (const p of process.argv.slice(2)) walk(path.resolve(p), stats);
console.log(`done: ${stats.hits} occurrence(s) redacted across ${stats.files} file(s)`);
