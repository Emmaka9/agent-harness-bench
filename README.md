# agent-harness-bench

**Does the agent harness matter as much as the model?** A 144-run controlled benchmark of two LLMs (glm-5.3-flash, deepseek-v4-flash) × three coding-agent harnesses (Claude Code 2.1.319, opencode 1.19.5, pi 0.73.1) on 8 custom agentic-coding tasks, graded by hidden `node --test` suites.

**Headline result — full ranking** (solve rate on hidden tests; CI = cluster bootstrap over the 8 tasks, 10k reps):

| Rank | Combo | Solve rate | 95% CI | Test frac | Mean wall |
|---|---|---|---|---|---|
| 1 | **claude / glm-5.3-flash** | **100%** (24/24) | [100–100] | 100% | 59s |
| 2 | opencode / glm-5.3-flash | 96% (23/24) | [88–100] | 100% | 20s |
| 3 | pi / glm-5.3-flash | 88% (21/24) | [75–96] | 99% | 19s |
| 4 | claude / deepseek-v4-flash | 83% (20/24) | [67–100] | 98% | 54s |
| 5 | pi / deepseek-v4-flash | 63% (15/24) | [38–88] | 98% | 34s |
| 6 | opencode / deepseek-v4-flash | 50% (12/24) | [29–75] | 96% | 20s |

- **Model effect:** glm-5.3-flash beat deepseek-v4-flash on every harness (paired same-task/same-seed W/T/L, zero losses).
- **Harness effect:** the harness choice barely matters for glm, but is decisive for deepseek — Claude Code lifts deepseek from 50% (opencode) to 83% (paired W/T/L 9/14/1, no losses).
- **Zero infra noise:** 0 timeouts, 0 rate-limit failures, 0 grade errors, and 144/144 runs verified to have requested exactly the assigned model (per-request logging proxy).

Full analysis, per-task matrix, failure-mode analysis, and method notes: **[REPORT.md](REPORT.md)**.

## Why a custom benchmark

Public benchmarks need Docker/pip and measure the model, not the model-through-harness. This benchmark asks the harness question: identical tasks, identical gateway, identical prompts — only the agent harness changes. Everything runs against one Anthropic-compatible gateway; opencode (which lacks an Anthropic-compatible provider in 1.19.5) goes through the gateway's OpenAI wire. A logging proxy verifies every request's model id and records token usage uniformly.

## The 8 tasks

Plain Node ESM, builtins only, injectable clock (no real sleeps), 17–28 hidden tests each:

| task | type | files |
|---|---|---|
| t1 | LRU+TTL cache | single-file |
| t2 | token-bucket rate limiter | single-file |
| t3 | CSV aggregator (RFC 4180 quoting, CRLF, malformed rows) | single-file |
| t4 | event-bus subscription-leak fix | 4-file mini-repo |
| t5 | partial-update feature | 5-file mini-repo |
| t6 | extract shared validation util (refactor) | mini-repo |
| t7 | JSON-schema subset validator | single-file |
| t8 | dependency topo-sort with cycle errors | single-file |

Each task ships `spec.md` (the exact prompt), `skeleton/` (starting state), `tests/` (hidden grader), `reference/` (verified solution), `stub/` (must fail). Grading copies the agent's sandbox into a fresh `/tmp` stage with tests in `__grade__/`, runs `node --test --test-reporter=tap`, and parses per-test results.

## Repo layout

```
runner/       the harness: run.mjs (matrix runner, isolation, journal),
              grade.mjs (hidden-test grader), proxy.mjs (logging proxy),
              analyze.mjs (bootstrap stats + head-to-heads), smoke.mjs (gate checks),
              redact.mjs (token scrubber), lib.mjs
tasks/        t1..t8: spec.md, skeleton/, tests/ (hidden), reference/, stub/
runs/         journal-pilot.jsonl, journal-full.jsonl — one record per run:
              per-test results, token usage, model verification, transcript path
logs/         raw agent transcripts (full-*.out.txt[.gz], pilot-*, smoke-*),
              proxy request journals (proxy-*-w*.jsonl), gateway findings (gates/)
configs/      harness invocation/isolation templates (harness-configs.json)
REPORT.md     the full benchmark report
```

The 144 `logs/full-*.out.txt` transcripts are the raw evidence behind every number in the report; the five largest are gzipped (54MB → 516K etc.). Journals are the compact ground truth (per-test, per-token).

## Reproducing

```bash
# 1. vendor the harnesses (pinned versions)
cd vendor && npm install && cd ..

# 2. point at your gateway (Anthropic-compatible + OpenAI wire)
export ANTHROPIC_AUTH_TOKEN=...   # used by configs/ + proxy

# 3. smoke the pipeline, pilot, then the full matrix
node runner/smoke.mjs
node runner/run.mjs --phase pilot --concurrency 1
node runner/run.mjs --phase full  --concurrency 1   # resumable journal

# 4. ranking + stats
node runner/analyze.mjs --phase full --reps 10000
```

**Gateway constraints we hit (your gateway may differ):** hard cap of 2 concurrent requests/token (→ run sequentially); requests with `max_tokens <= 64` are fast-pathed to a different model regardless of the requested id (see `logs/gates/GATE-A-FINDING.md` — validate the *requested* model, and remap claude's aux-model slots to the run's model).

## Method notes & caveats

- The statistical unit is the task (n=8), so CIs are wide; ranks within overlapping CIs are ties. The strongest claims are the paired contrasts (consistent across seeds and tasks).
- Seeds are neutral prompt variants, not temperature changes; harness system prompts/tool ergonomics are uncontrolled — this measures model-through-harness as shipped.
- The gateway's model id is what we control; served-model identity behind the gateway is not independently verifiable (documented quirk above).
- All 30 unsolved runs were genuine `wrong_solution` grades; deepseek repeats semantically identical mistakes across seeds and harnesses (15 seed-identical failure signatures) — e.g. reschedule-after-terminal semantics in t4.

## License

MIT — see [LICENSE](LICENSE).
