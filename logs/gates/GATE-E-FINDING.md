# Gate E finding: gateway enforces concurrency limit 2 per token

Discovered during the deepseek pilot half (2026-11-07).

## Evidence

Gateway 429 body (captured in `logs/pilot-t1-s0-opencode-deepseek-v4-flash.out.txt`):

```json
{"error":{"code":"concurrency_limit_exceeded","message":"Too many concurrent requests (limit: 2)","limit":2,"role":"REDACTED-PLAN"}}
```

At runner concurrency 2, one opencode run immediately hit 7 consecutive 429s
(opencode fires a model call for session-title generation in parallel with the
main loop; claude code can likewise make aux-model calls). The run exhausted
its client retries in 7s and exited 1.

## Consequence

- Runner concurrency must be **1**: a single harness keeps in-flight requests
  ≤ 2 on its own, but two harnesses in parallel overshoot as soon as either one
  issues an internal second request.
- This roughly doubles the full-matrix wall clock vs. the concurrency-2 plan
  (observed pilot speeds suggest ~2.5–4h; acceptable).

## Runner fixes applied

1. `is429Signature` now treats proxy-observed HTTP 429 as primary evidence and
   matches `concurrency_limit` in transcripts (the body text does not contain
   "429" or "rate limit", so the old regex missed it → the run would have been
   misclassified `wrong_solution` instead of retried as `gateway_degraded`).
2. The misclassified journal line was purged; the run re-executes.
3. All matrix runs go through at concurrency 1 (worker count 1 ⇒ one proxy).

## Classification note

Runs whose proxy window shows 429s but which still produced gradable work keep
the work and are NOT retried (the gateway may 429 a background/aux call while
the main loop proceeds — punishing the combo for harness background chatter
would bias the comparison).
