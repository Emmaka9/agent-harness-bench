#!/usr/bin/env node
// Logging proxy: 127.0.0.1:<port> -> freeinference.org/anthropic
// Records one JSON line per request into a journal file: model, status, usage, 429s.
// Usage: node proxy.mjs <port> <journal-file> [upstream-base-url]
// Auth token is read from env ANTHROPIC_AUTH_TOKEN (never logged).
//
// Run attribution (v2): clients embed a run id as the FIRST path segment,
// e.g. POST http://127.0.0.1:8910/<runId>/v1/messages — the proxy records
// rec.run = <runId>, strips the prefix, and forwards the remainder upstream.
// Requests whose first path segment is not a run id (or whose run id does not
// match allowRun regex) are rejected 403 with no upstream contact: unattributed
// traffic cannot pollute per-run usage. A run id must match /<task>-s<seed>-<harness>-<model>.a<attempt>/
// pattern used by run.mjs.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { URL } from 'node:url';

const port = Number(process.argv[2]);
const journalFile = process.argv[3];
const upstreamBase = process.argv[4] || process.env.BENCH_UPSTREAM || 'https://freeinference.org/anthropic';
const upstream = new URL(upstreamBase);

const journal = fs.createWriteStream(journalFile, { flags: 'a' });
const state = { count: 0, byModel: {}, statusCounts: {}, byRun: {}, rejected: 0 };

function logRec(rec) {
  journal.write(JSON.stringify(rec) + '\n');
  state.count++;
  state.byModel[rec.model] = (state.byModel[rec.model] || 0) + 1;
  state.statusCounts[rec.status] = (state.statusCounts[rec.status] || 0) + 1;
  if (rec.run) state.byRun[rec.run] = (state.byRun[rec.run] || 0) + 1;
}

// Run id embedded by the harness client: `<task>-s<seed>-<harness>-<model>.a<attempt>`.
// Model names contain dots/hyphens, so the general shape is checked, not a strict grammar.
const RUN_ID_RE = /^\/(t\d+-s\d+-[a-z]+-[\w.-]+\.a\d+)\/(.*)$/s;

const server = http.createServer((req, res) => {
  const started = Date.now();
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    // ---- attribution: first path segment must be the run id ----
    const m = RUN_ID_RE.exec(req.url);
    if (!m) {
      state.rejected++;
      const rec = { ts: started, method: req.method, path: req.url, model: null, status: 403, ms: 0, rejected: 'no_run_id', reqBytes: body.length };
      logRec(rec);
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'unattributed_request', message: 'first path segment must be the run id: /<runId>/v1/messages' } }));
      return;
    }
    const runId = m[1];
    const upstreamPath = m[2] || '';

    const headers = { ...req.headers };
    // Rebuild host/auth headers for upstream; strip proxy-specific ones.
    headers.host = upstream.host;
    delete headers['content-length'];
    if (process.env.ANTHROPIC_AUTH_TOKEN) {
      headers['x-api-key'] = process.env.ANTHROPIC_AUTH_TOKEN;
      headers.authorization = `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`;
    }
    delete headers['accept-encoding']; // keep responses uncompressed so we can parse usage

    let model = null;
    try { model = JSON.parse(body.toString('utf8')).model; } catch {}

    // OpenAI-wire clients (opencode via @ai-sdk/openai-compatible) hit /chat/completions
    // (their baseURL is the proxy root). Anthropic-wire clients hit /v1/messages.
    // NOTE: after run-id stripping, upstreamPath has NO leading slash
    // ('chat/completions'), so the prefix table is checked both bare and slashed.
    const OPENAI_PREFIXES = ['chat/completions', 'completions', 'models', '/chat/completions', '/completions', '/models'];
    const isOpenAI = OPENAI_PREFIXES.some((p) => upstreamPath.startsWith(p)) || (upstreamPath.startsWith('/v1/') && !upstreamPath.startsWith('/v1/messages'));
    const path = isOpenAI
      ? new URL(process.env.BENCH_UPSTREAM_OPENAI || 'https://freeinference.org/v1').pathname.replace(/\/$/, '') + '/' + upstreamPath
      : upstream.pathname.replace(/\/$/, '') + '/' + upstreamPath;
    const upreq = (upstream.protocol === 'http:' ? http : https).request(
      { hostname: upstream.hostname, port: upstream.port || (upstream.protocol === 'http:' ? 80 : 443), path, method: req.method, headers },
      (upres) => {
        const rchunks = [];
        upres.on('data', (c) => rchunks.push(c));
        upres.on('end', () => {
          const rbody = Buffer.concat(rchunks);
          const rec = {
            ts: started, run: runId, method: req.method, path: upstreamPath, model,
            status: upres.statusCode, ms: Date.now() - started,
            reqBytes: body.length, resBytes: rbody.length,
          };
          // Parse usage from the response (non-streaming JSON). For SSE, count events.
          const ct = upres.headers['content-type'] || '';
          try {
            if (ct.includes('text/event-stream')) {
              const text = rbody.toString('utf8');
              const usageEvents = extractUsageObjects(text);
              if (usageEvents.length) { rec.sseUsageEvents = usageEvents.length; rec.lastUsage = usageEvents[usageEvents.length - 1]; }
              rec.sse = true;
            } else if (ct.includes('json')) {
              const j = JSON.parse(rbody.toString('utf8'));
              if (j.usage) rec.usage = j.usage;
              if (j.model) rec.responseModel = j.model;
              if (j.error) rec.error = String(j.error?.message || JSON.stringify(j.error)).slice(0, 300);
            }
          } catch { /* unparseable body: keep rec without usage */ }
          logRec(rec);
          res.writeHead(upres.statusCode, upres.headers);
          res.end(rbody);
        });
      }
    );
    upreq.on('error', (e) => {
      logRec({ ts: started, run: runId, method: req.method, path: upstreamPath, model, status: 0, ms: Date.now() - started, error: String(e) });
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_upstream_error', message: String(e) } }));
    });
    upreq.end(body);
  });
});

// Extract complete "usage": {...} objects from SSE text, balancing braces so nested
// objects (e.g. OpenAI-wire prompt_tokens_details) parse. The previous flat regex
// captured truncated JSON and silently dropped all OpenAI-wire usage.
function extractUsageObjects(text) {
  const out = [];
  for (const m of text.matchAll(/"usage":\s*\{/g)) {
    let depth = 0, inStr = false, esc = false, start = m.index + m[0].length - 1;
    let end = -1;
    for (let i = start; i < text.length && i < start + 4096; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = !inStr;
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0) { try { out.push(JSON.parse(text.slice(start, end + 1))); } catch {} }
  }
  return out;
}

// Control endpoint for stats/stop on a separate small server? Keep simple: SIGTERM writes final state.
process.on('SIGTERM', () => {
  journal.write(JSON.stringify({ ts: Date.now(), type: 'proxy_summary', ...state }) + '\n');
  journal.end(() => process.exit(0));
});
process.on('SIGINT', () => process.emit('SIGTERM'));

server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ ok: true, port, upstream: upstreamBase }));
});
server.on('error', (e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
