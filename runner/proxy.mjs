#!/usr/bin/env node
// Logging proxy: 127.0.0.1:<port> -> freeinference.org/anthropic
// Records one JSON line per request into a journal file: model, status, usage, 429s.
// Usage: node proxy.mjs <port> <journal-file> [upstream-base-url]
// Auth token is read from env ANTHROPIC_AUTH_TOKEN (never logged).
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { URL } from 'node:url';

const port = Number(process.argv[2]);
const journalFile = process.argv[3];
const upstreamBase = process.argv[4] || process.env.BENCH_UPSTREAM || 'https://freeinference.org/anthropic';
const upstream = new URL(upstreamBase);

const journal = fs.createWriteStream(journalFile, { flags: 'a' });
const state = { count: 0, byModel: {}, statusCounts: {} };

function logRec(rec) {
  journal.write(JSON.stringify(rec) + '\n');
  state.count++;
  state.byModel[rec.model] = (state.byModel[rec.model] || 0) + 1;
  state.statusCounts[rec.status] = (state.statusCounts[rec.status] || 0) + 1;
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
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
    const OPENAI_PREFIXES = ['/chat/completions', '/completions', '/models'];
    const isOpenAI = OPENAI_PREFIXES.some((p) => req.url.startsWith(p)) || (req.url.startsWith('/v1/') && !req.url.startsWith('/v1/messages'));
    const path = isOpenAI
      ? new URL(process.env.BENCH_UPSTREAM_OPENAI || 'https://freeinference.org/v1').pathname.replace(/\/$/, '') + req.url
      : upstream.pathname.replace(/\/$/, '') + req.url;
    const upreq = https.request(
      { hostname: upstream.hostname, port: 443, path, method: req.method, headers },
      (upres) => {
        const rchunks = [];
        upres.on('data', (c) => rchunks.push(c));
        upres.on('end', () => {
          const rbody = Buffer.concat(rchunks);
          const rec = {
            ts: started, method: req.method, path: req.url, model,
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
      logRec({ ts: started, method: req.method, path: req.url, model, status: 0, ms: Date.now() - started, error: String(e) });
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
