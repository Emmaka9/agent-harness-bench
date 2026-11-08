# Benchmark Report: glm-5.3-flash vs deepseek-v4-flash across Claude Code / opencode / pi

**Date:** 2026-11-07 · **Matrix:** 8 tasks × 3 seeds × 6 combos = 144 runs · **All 144 graded, zero anomalies** (no timeouts, no 429s, no grade errors, no wrong-model requests).

## Ranking (primary: hidden-test solve rate; secondary: per-test fraction)

| Rank | Combo | Solve rate | 95% CI | Test frac | Mean wall | Tokens in/out | Timeouts |
|---|---|---|---|---|---|---|---|
| 1 | **claude / glm-5.3-flash** | **100%** (24/24) | [100–100] | 100% | 59s | 1.01M / 168k | 0 |
| 2 | opencode / glm-5.3-flash | 96% (23/24) | [88–100] | 100% | 20s | 1.36M / 47k | 0 |
| 3 | pi / glm-5.3-flash | 88% (21/24) | [75–96] | 99% | 19s | 421k / 50k | 0 |
| 4 | **claude / deepseek-v4-flash** | 83% (20/24) | [67–100] | 98% | 54s | 370k / 175k | 0 |
| 5 | pi / deepseek-v4-flash | 63% (15/24) | [38–88] | 98% | 34s | 109k / 110k | 0 |
| 6 | opencode / deepseek-v4-flash | 50% (12/24) | [29–75] | 96% | 20s | 2.13M / 73k | 0 |

The [100–100] interval for 24/24 is a degenerate empirical bootstrap interval, not a guarantee of perfect performance on new tasks. CIs are cluster-bootstrap over tasks (10k reps) — the task sample (n=8), not the 24 runs, is the statistical unit, so CIs are wide and adjacent ranks within overlapping CIs should be read as ties. That said, the paired design sharpens several contrasts:

## Paired head-to-heads (same task+seed, n=24 pairs each)

- **Harness effect on glm:** claude ≥ opencode (W/T/L 1/23/0) — near-perfect everywhere; claude ≥ pi (3/21/0); opencode ≈ pi (3/20/1).
- **Harness effect on deepseek:** claude > opencode (**9 wins, 14 ties, 1 loss**) — the clearest harness effect in the study; claude ≥ pi (5/19/0); pi ≈ opencode (opencode-vs-pi 1/19/4).
- **Model effect:** glm ≥ deepseek on every harness (claude 4/20/0, opencode **11/13/0**, pi 6/18/0) — glm-5.3-flash beats deepseek-v4-flash regardless of harness.

## Per-task solve matrix (of 3 seeds)

| task | cl:glm | op:glm | pi:glm | cl:ds | op:ds | pi:ds |
|---|---|---|---|---|---|---|
| t1 LRU+TTL cache | 3/3 | 3/3 | 2/3 | 1/3 | 1/3 | 1/3 |
| t2 token bucket | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| t3 CSV aggregator | 3/3 | 2/3 | 2/3 | 3/3 | 1/3 | 2/3 |
| t4 event-bus leak fix | 3/3 | 3/3 | 3/3 | 1/3 | 0/3 | 0/3 |
| t5 partial-update feature | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| t6 extract validation util | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| t7 JSON-schema validator | 3/3 | 3/3 | 2/3 | 3/3 | 1/3 | 1/3 |
| t8 topo-sort | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 |

glm-5.3-flash's only drops: 1 run each of t1/t3/t7 (pi) and t3 (opencode). deepseek-v4-flash collapses hardest on **t4** (reschedule-after-terminal semantics: the same 2 tests recur across all 3 harnesses, but Claude/deepseek solved one of the three t4 runs — a recurring observed weakness, not a universal failure; the spec states the behavior explicitly at `tasks/t4/spec.md:29`).

## Failure modes (all 29 unsolved runs were `wrong_solution`; zero infra failures)

- deepseek repeats **consistent semantic mistakes across seeds and harnesses** (15 seed-identical failure signatures) — these are recurring errors in the observed model/harness combinations, not proof of a model-only cause: t4 reschedule semantics (8 occurrences), t1 constructor validation messages (7), t7 `Object.is` enum edge (5), t3 empty-quoted-field rows (4).
- opencode/deepseek is the weakest observed pairing. This experiment does not isolate which harness differences caused the gap.

## Efficiency

- Speed depends on harness: glm vs deepseek averaged 58.85 vs 54.00 seconds under Claude, 19.84 vs 19.71 under opencode, and 18.83 vs 33.55 under pi. GLM used more recorded input tokens under Claude and pi, and fewer under opencode. These counters do not establish monetary cost.
- opencode sends the most raw input tokens (no caching: 1.36M–2.13M in) while producing the fewest output tokens — it re-sends growing context each turn.
- claude is the slowest harness (system-prompt + tool overhead) but the most accurate; pi the leanest.

## Method notes (what this benchmark does and doesn't measure)

- 8 custom Node-ESM agentic-coding tasks (3 single-file bugfix/feature, 1 refactor, 4 multi-file), hidden `node --test` suites (17–28 tests/task), graded in staged /tmp copies; masters chmod 000 during runs; verified no task reads the reference solutions.
- Identical task prompts across harnesses; per-run fresh HOME/XDG/config isolation; every request logged through a local proxy: **144/144 runs sent exactly the requested model identifier** (`modelCheck.anyOtherModel = 0`). This verifies outgoing request labels, not the gateway's actual served model identity; the documented gateway routing quirk makes that distinction material.
- All harnesses were pinned/piped through one gateway; claude aux-model slots were remapped to the run's model.
- Gateway caps at 2 concurrent requests/token → all runs sequential (documented in `logs/gates/GATE-E-FINDING.md`); `max_tokens≤64` fast-path quirk documented in `logs/gates/GATE-A-FINDING.md`.
- opencode usage reconstructed from its own transcripts/proxy journal (OpenAI-wire SSE usage needed a balanced-brace parser — fixed mid-session, before the matrix ran).
- Seeds 1/2 are neutral-sentence prompt variants, not temperature changes (temperature is whatever each harness defaults to — an uncontrolled variable).
- Other uncontrolled variables: harness system prompts, tool ergonomics (edit vs rewrite), agentic loop structure. The benchmark measures **model-through-harness as shipped**, which is exactly the question asked.
- n=8 tasks: statistical unit is the task; differences <~15pp in solve rate are within CI noise. The paired contrasts (claude>opencode on deepseek; glm>deepseek everywhere) are consistent across seeds and tasks and are the strongest claims here.

## Verdict

1. **glm-5.3-flash through Claude Code** — perfect 24/24; the combination to pick when accuracy matters most.
2. **glm-5.3-flash through opencode or pi** — statistically tied with the leader for glm; pi had the lowest observed mean wall time and recorded input-token count for glm; monetary cost was not measured.
3. **deepseek-v4-flash through Claude Code** — the best deepseek combination by a clear paired margin.
4. **deepseek through opencode/pi** — drops to 50–63%; the harness choice matters more for deepseek than for glm.

Artifacts: `runs/journal-{pilot,full}.jsonl` (all records: per-test results, token usage, model verification), `logs/pilot-*.out.txt` + `logs/full-*.out.txt` (transcripts), `logs/gates/*.md` (gateway findings), `runner/{run,grade,analyze,proxy,redact}.mjs`. Gateway token redacted from any shared artifacts via `runner/redact.mjs`.
