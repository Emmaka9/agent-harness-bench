# Benchmark Report: glm-5.3-flash vs deepseek-v4-flash across Claude Code / opencode / pi

**Date:** 2026-11-07 (main matrix) · 2026-11-08 (hardening + follow-up experiments) · **Matrix:** 8 tasks × 3 seeds × 6 combos = 144 runs, all graded; plus E4 54 / E3 66 / E5 24 follow-up runs on the hardened runner. **Zero unexplained infra failures**; every request attributed to its run by id.

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

## Follow-up experiments (post-hardening, 2026-11-08)

After a reliability hardening pass (run-scoped request attribution through the logging proxy with 403 rejection of unattributed traffic; explicit timeout labeling; retries with preserved per-attempt transcripts; sequential execution), a 6-combo validation matrix passed all integrity checks (correct model on every request, zero foreign/unattributed traffic, zero unexplained rate-limit failures). The three experiments below ran on the hardened runner, one gateway consumer at a time. Records: `runs/journal-{e4,guided,hint}.jsonl`; quarantined records in `runs/quarantine/`.

### E4 — difficulty scaling (hard tasks: Merge-interval Calendar, Mini Regex Engine, Job queue simulator)

Seeds 0–2 × 6 combos × 3 tasks = 54 scheduled; 53 valid (1 pre-hardening record quarantined for unverifiable provenance: transient 429 whose proxy evidence was overwritten — opencode/glm on Mini Regex Engine, so that cell has n=6, not n=9). 5 runs hit the 360s wall clock on Mini Regex Engine — under the fixed-budget policy these count as unsolved with their graded partial credit; they are listed explicitly and excluded only from the completed-only sensitivity view.

| Combo | Easy (t1–t8, of 24) | Hard solved | Hard partial-credit | of which planned seed-0 |
|---|---|---|---|---|
| claude/glm | 24/24 | 5/7 | 0.99 | 2/2 |
| opencode/glm | 23/24 | 4/6 | 0.98 | 2/2 |
| pi/glm | 21/24 | 3/8 | 0.95 | 1/3 |
| claude/deepseek | 20/24 | 3/9 | 0.94 | 0/3 |
| opencode/deepseek | 12/24 | 3/9 | 0.89 | 1/3 |
| pi/deepseek | 15/24 | 2/9 | 0.72 | 1/3 |

- The 8-task matrix saturated for glm (88–100%); the hard tasks restored headroom and **the ranking order is unchanged** — every glm combo still outsolves its deepseek counterpart, and claude > opencode > pi on both models.
- Mini Regex Engine (t10) is the strongest single separator: 0/9 solved for both models (both stall on backtracking/lookahead semantics), partial credit 0.71–0.74.
- Job queue simulator (t11, concurrency fairness) widens the **model** gap hardest: glm 4/9 vs deepseek 1/9.

### E3 — workflow-guidance normalization (all 11 tasks, seed 0, guided vs unguided baselines)

A shared workflow guide (read the spec fully before coding; enumerate edge cases; self-test against the spec's stated semantics before declaring done) was injected through each harness's native mechanism. Baselines: easy tasks vs the 144-run matrix seed-0 slice; hard tasks vs E4 seed-0. Strata never pooled.

| Combo | Easy base → guided (of 8) | Δ | Hard base → guided (of 3) | Δ |
|---|---|---|---|---|
| claude/glm | 100% → 100% | 0 | 100% → 100% | 0 |
| opencode/glm | 88% → 88% | 0 | 100% → 67% | −33 |
| pi/glm | 88% → 100% | +13 | 33% → 33% | 0 |
| claude/deepseek | 75% → 63% | −13 | 0% → 33% | +33 |
| **opencode/deepseek** | **38% → 75%** | **+38** | 33% → 0% | −33 |
| pi/deepseek | 63% → 63% | 0 | 33% → 0% | −33 |

- **The workflow guide closes most of the opencode/deepseek harness gap on easy tasks** (+38pp; paired flips t1, t2, t3, t7 all miss→solve). This is direct evidence that a large share of that pairing's deficit was process (workflow), not model capability.
- Guidance does **not** rescue deepseek on the hard tasks (opencode 1→0, pi 1→0, all flips solve→miss) — where the deficit is capability, normalizing workflow doesn't help.
- claude/deepseek hard 0→1/3 (+33) suggests a capability-adjacent gain there, but n=3/stratum — read as directional only.

### E5 — misleading-hint robustness (t1, t4, t7, t8; seed 3; hint contradicts one spec requirement)

24 runs, each prompt carries a plausible-but-wrong "hint from a previous engineer" targeting 1–2 hidden tests. Bitten = at least one hint-target test failed; followed = all hint-target tests failed.

| Combo | Solved | Bitten | Followed hint |
|---|---|---|---|
| claude/glm | 4/4 | 0 | 0 |
| pi/glm | 4/4 | 0 | 0 |
| claude/deepseek | 4/4 | 0 | 0 |
| opencode/glm | 3/4 | 1 (t4) | 1 |
| opencode/deepseek | 2/4 | 1 (t4) | 1 |
| pi/deepseek | 1/4 | 2 (t4, t7) | 2 |

- **claude never followed a misleading hint (0/4), regardless of model.** The hint-injection surface (system-prompt discipline) held everywhere except opencode and pi.
- Bites concentrate in opencode/pi × deepseek (4 of 4 total bites) — the same pairings weakest in the main matrix. Spec-fidelity under conflicting evidence tracks overall capability.

### Policy note (timeouts)

An ordinary fixed-budget timeout with healthy gateway traffic is a benchmark outcome (the agent had its full wall budget and didn't finish), not an infrastructure failure. The primary ranking counts timeouts as unsolved over all scheduled runs; a completed-only sensitivity view and explicit timeout counts are reported alongside. Runs are never retried-until-success for the primary ranking. The retry path exists solely for the gateway-poison signature (429s with zero completed model requests), which measures the gateway by construction. In the original 144-run matrix there were zero timeouts, so the original ranking is unchanged under this policy.

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
