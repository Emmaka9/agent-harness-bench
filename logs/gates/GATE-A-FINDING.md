# Gate A finding: gateway fast-path rewrites max_tokens<=64 requests to qwen3.6-35b

Discovered 2026-11-07 during gateway smoke tests.

## Behavior

POST https://freeinference.org/anthropic/v1/messages with `"max_tokens": N` where N <= 64
returns `response.model: "qwen3.6-35b"` REGARDLESS of the requested `model` field
(verified for both glm-5.3-flash and deepseek-v4-flash, deterministic across repeats,
both with and without tools, with and without system field).

At max_tokens >= 65, routing is correct and `response.model` echoes the requested model.

## Implication for the benchmark

Claude Code sends some auxiliary requests (e.g. haiku-slot calls: topic detection,
session naming, etc.) with small max_tokens. Those calls will be silently served by
qwen3.6-35b. Plan countermeasure: map ALL THREE claude model slots (opus/sonnet/haiku)
to the run's model for every bench run, and verify via proxy journal that every request
carried the target model id (requests with mt<=64 will show responseModel=qwen3.6-35b —
the proxy must compare REQUESTED model, not responseModel, and flag any request whose
requested model != target).

The proxy.mjs already records the requested `model` from the request body — the runner
will validate on that field, and additionally flag any responseModel != requested model
as `aux_served_by_other_model` (expected for mt<=64 aux calls under claude; should not
occur for the main agentic loop, which uses large max_tokens).

## Raw evidence

- mt=64  deepseek-v4-flash -> "model":"qwen3.6-35b"  (x2)
- mt=64  glm-5.3-flash     -> "model":"qwen3.6-35b"  (x4 across two rounds)
- mt=65  deepseek-v4-flash -> "model":"deepseek-v4-flash"  (x4)
- mt=65  glm-5.3-flash     -> "model":"glm-5.3-flash"  (x2)
- mt=8 with tools array   -> "model":"qwen3.6-35b"
- Boundary deterministic at 64/65 across repeats with 1s gaps.

See logs/gates/proxy-smoke.jsonl for the journaled requests.
