# Benchmark Report: glm-5.3-flash vs deepseek-v4-flash across Claude Code / opencode / pi

**An exploratory study on a fixed set of 11 custom tasks — not a general ranking.** All conclusions below are observations about these tasks, these harness versions, and this gateway; they do not establish general superiority of any model or harness.

**Date:** 2026-11-07 (main matrix) · 2026-11-08 (hardening + follow-up experiments) · **Matrix:** 8 tasks × 3 seeds × 6 combos = 144 runs, all graded; plus E4 54 scheduled (53 original observed + 4 replacement reruns of compromised seed-0 Mini-Regex-Engine cells) / E3 66 / E5 24 follow-up runs. **Zero unexplained infra failures.** Request attribution by run ID applies to E3, E5, the validation matrix, all replacement runs, all local tests, and 50 of 53 original E4 records; the 3 exceptions are seed-0 Mini-Regex-Engine E4 records that ran on the pre-hardening runner (time-window attribution + requested-model checks; superseded by run-scoped replacements in the published tables). The original 144-run matrix predates run-scoped attribution and was verified by per-worker proxy isolation + requested-model **label** checks instead (`modelCheck.anyOtherModel = 0` everywhere — outgoing request labels, not served-model echoes).

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

- deepseek repeats **consistent semantic mistakes across seeds and harnesses** — its 25 unsolved runs collapse to 9 distinct failure signatures (15 signature-by-seed cells) — recurring errors in the observed model/harness combinations, not proof of a model-only cause: t4 reschedule semantics (8 deepseek occurrences), t1 constructor-validation messages (6), t7 `Object.is` enum edge (4), t3 empty-quoted-field rows (3); the same failure families appear 1× each in isolated glm runs (t1, t7, t3), so they signal task difficulty as well as model weakness.
- opencode/deepseek is the weakest observed pairing. This experiment does not isolate which harness differences caused the gap.

## Efficiency

- Speed depends on harness: glm vs deepseek averaged 58.85 vs 54.00 seconds under Claude, 19.84 vs 19.71 under opencode, and 18.83 vs 33.55 under pi. GLM used more recorded input tokens under Claude and pi, and fewer under opencode. These counters do not establish monetary cost.
- opencode sends the most raw input tokens (no caching: 1.36M–2.13M in) while producing the fewest output tokens — it re-sends growing context each turn.
- claude is the slowest harness (system-prompt + tool overhead) but the most accurate; pi the leanest.

## Follow-up experiments (post-hardening, 2026-11-08)

After a reliability hardening pass (run-scoped request attribution through the logging proxy with 403 rejection of unattributed traffic; explicit timeout labeling; retries with preserved per-attempt transcripts; sequential execution), a 6-combo validation matrix passed all integrity checks (correct model on every request, zero foreign/unattributed traffic, zero unexplained rate-limit failures). E3, E5, validation, the four replacement runs, and 50 of 53 original E4 records ran on the hardened runner, one gateway consumer at a time; the 3 E4 exceptions are seed-0 Mini-Regex-Engine records from 04:41–04:46 UTC that ran on the pre-hardening runner (time-window attribution + requested-model checks — `modelCheck.anyOtherModel = false` — but no run-scoped foreign/unattributed counters, and their window overlapped the operator's own gateway session during the 429 storm; all three were later replaced, see E4 section). Records: `runs/journal-{e4,guided,hint,e4-replace}.jsonl`; quarantined records in `runs/quarantine/`.

**Evidence limitation (disclosed):** ~175 proxy records from the 429-storm era (2026-11-08 03:58–04:46 UTC) were lost during the post-hardening journal re-split (operator error during `git checkout` reordering; documented in `runs/quarantine/README.md`) — 1 committed record (04:00:20Z) plus ~174 uncommitted appended records. No live journal record references them — they belonged to runs already purged or quarantined before the hardening pass — but their loss is real and limits retrospective verification of that era.

**Timeout policy:** an ordinary fixed-budget timeout with healthy gateway traffic is a benchmark outcome (the agent had its full wall budget and didn't finish), not an infrastructure failure. All experiment tables below count timeouts as unsolved over all **scheduled** runs; runs are never retried-until-success. Partial-credit means keep the graded fraction of timed-out runs (their work was graded; zeroing them would give claude/glm 0.77 instead of 0.87 and pi/glm 0.85 instead of 0.95). The retry path exists solely for the gateway-poison signature (429s with zero completed model requests), which measures the gateway by construction. Where a cell is smaller than its cohort (quarantined record), the missing record is stated explicitly rather than imputed.

### E4 — difficulty scaling (hard tasks: Merge-interval Calendar, Mini Regex Engine, Job queue simulator)

Seeds 0–2 × 6 combos × 3 tasks = **54 scheduled**; 53 observed + 1 missing (pre-hardening opencode/glm record on Mini Regex Engine quarantined for unverifiable provenance: transient 429 whose proxy evidence was overwritten). Three further seed-0 Mini-Regex-Engine records (pi/glm, claude/deepseek, opencode/deepseek — 04:41–04:46 UTC) also ran on the pre-hardening runner (time-window attribution only; requested-model checks pass; disclosed rather than silently pooled). **Replacement runs (2026-11-08 22:54–23:08 UTC):** all four compromised seed-0 Mini-Regex-Engine cells were re-run on the hardened runner with run-scoped attribution (provenance + selection policy in `runs/e4-replace/README.md`); the tables below use those replacements for the four cells (replace-policy) — results: opencode/glm 21/22, pi/glm 21/22, claude/deepseek 21/22, opencode/deepseek **timed out** (graded 21/22, counted unsolved). **Zero solves**; no conclusion changes under the retain-policy sensitivity (same rows, op/glm cell stays n=8). Fixed-budget counting: timeouts are unsolved.

| Combo | Easy (t1–t8, of 24) | Hard solved (fixed-budget) | Hard partial-credit | planned seed-0 | exploratory seeds 1–2 |
|---|---|---|---|---|---|
| claude/glm | 24/24 | **5/9** | 0.87 | 2/3 | 3/6 |
| opencode/glm | 23/24 | **4/9** | 0.87 | 2/3 | 2/6 |
| pi/glm | 21/24 | **3/9** | 0.96 | 1/3 | 2/6 |
| claude/deepseek | 20/24 | **3/9** | 0.95 | 0/3 | 3/6 |
| opencode/deepseek | 12/24 | **3/9** | 0.89 | 1/3 | 2/6 |
| pi/deepseek | 15/24 | **2/9** | 0.72 | 1/3 | 1/6 |

- **Model ordering holds on hard tasks** — every glm combo outsolves (or ties) its deepseek counterpart at n=9. **Harness ordering does not fully hold**: on deepseek, pi (2/9) now trails opencode (3/9), reversing the easy-task order, and claude/deepseek ties opencode/deepseek at 3/9. On glm, claude > opencode > pi persists.
- Mini Regex Engine (t10) is the hardest single task: **0 solved for either model** (glm 0/9; deepseek 0/9 — both struggle with greedy-quantifier backtracking semantics; the recurring failure is the hidden test "quantified groups capture the last completed repetition", failed by all 18 records including all four replacements; pi/deepseek twice completed full 0/22 stalls). Mean partial credit 0.75 (glm) vs 0.72 (deepseek); the per-run spread is wide: 6 runs hit the 360s wall clock (graded 0–21/22 — three of them still reached 21/22), two completed pi/deepseek runs graded 0/22, and every other run reached 19–21/22.
- Job queue simulator (t11, concurrency fairness) widens the **model** gap hardest: glm 4/9 vs deepseek 1/9 (fixed-budget).

### E3 — workflow-guidance normalization (all 11 tasks, seed 0, matched-key comparison)

A shared workflow guide (read the spec fully before coding; enumerate edge cases; self-test against the spec's stated semantics before declaring done) was injected through each harness's native mechanism. Baselines: easy tasks vs the 144-run matrix seed-0 slice; hard tasks vs E4 seed-0. Comparisons use the **exact intersection of matching task/seed/harness/model keys** on both sides; matched n and unmatched records are reported. Timeouts count as unsolved on both sides.

| Combo | Easy base → guided (matched n=8) | Δ | Hard base → guided (matched n) | Δ |
|---|---|---|---|---|
| claude/glm | 8/8 → 8/8 | 0 | 2/3 → 2/3 (n=3) | 0 |
| opencode/glm | 7/8 → 7/8 | 0 | 2/3 → 2/3 (n=3, replacement baseline; 1 guided record unmatched under the retain-policy) | 0 |
| pi/glm | 7/8 → 8/8 | +13 | 1/3 → 1/3 (n=3) | 0 |
| claude/deepseek | 6/8 → 5/8 | −13 | 0/3 → 1/3 (n=3) | +33 |
| **opencode/deepseek** | **3/8 → 6/8** | **+38** | 1/3 → 0/3 (n=3) | −33 |
| pi/deepseek | 5/8 → 5/8 | 0 | 1/3 → 0/3 (n=3) | −33 |

- **The workflow guide closes most of the opencode/deepseek harness gap on easy tasks** (+38pp; paired flips: t1, t2, t3, t7 miss→solve, offset by t8 solve→miss). Within this study's limits (seed 0, n=8 matched cells), this is evidence that a large share of that pairing's deficit on these tasks was process (workflow), not model capability.
- Guidance does **not** rescue deepseek on the hard tasks (opencode 1→0, pi 1→0; in both pairings the single paired flip is t9 solve→miss) — where the deficit is capability, normalizing workflow doesn't help. (pi/glm's easy +13 is its t7 miss→solve.)
- claude/deepseek hard 0→1/3 (+33) suggests a capability-adjacent gain there, but n=3/stratum — read as directional only.

### E5 — misleading-hint robustness (t1, t4, t7, t8; seed 3; hint contradicts one spec requirement)

24 runs, each prompt carries a plausible-but-wrong "hint from a previous engineer" targeting 1–2 hidden tests. Bitten = at least one hint-target test failed; followed = all hint-target tests failed. **Measurement caveat:** hint-target failures are a proxy — they show the hint-contradicted behavior was wrong, not that the hint *caused* the error. There are no matched no-hint seed-3 controls (seed 3 is the hint treatment by design), so causal claims are qualified accordingly; a baseline-free reading is that these are observed failures exactly where the hints point.

| Combo | Solved | Bitten | Followed hint |
|---|---|---|---|
| claude/glm | 4/4 | 0 | 0 |
| pi/glm | 4/4 | 0 | 0 |
| claude/deepseek | 4/4 | 0 | 0 |
| opencode/glm | 3/4 | 1 (t4) | 1 |
| opencode/deepseek | 2/4 | 1 (t4) | 1 |
| pi/deepseek | 1/4 | 2 (t4, t7) | 2 |

- **claude never had a hint-target failure (0/4), regardless of model** — consistent with holding the spec line under conflicting evidence. pi/glm also stayed clean.
- **3 of the 4 bites are deepseek pairings** (opencode/deepseek t4, pi/deepseek t4 + t7) — the two weakest main-matrix pairings (50%, 62.5%); the fourth, opencode/glm on t4, is an outlier in the second-strongest pairing (95.8%). With no no-hint controls these failures cannot be causally attributed to the hints — treat as suggestive, not established.

## Method notes (what this benchmark does and doesn't measure)

- 8 custom Node-ESM agentic-coding tasks (3 single-file bugfix/feature, 1 refactor, 4 multi-file), hidden `node --test` suites (20–28 tests/task), graded in staged /tmp copies; masters chmod 000 during runs; verified no task reads the reference solutions.
- Identical task prompts across harnesses; per-run fresh HOME/XDG/config isolation; every request logged through a local proxy: **144/144 runs sent exactly the requested model identifier** (`modelCheck.anyOtherModel = 0`). This verifies outgoing request labels, not the gateway's actual served model identity; the documented gateway routing quirk makes that distinction material.
- All harnesses were pinned/piped through one gateway; claude aux-model slots were remapped to the run's model.
- Gateway caps at 2 concurrent requests/token → all runs sequential (documented in `logs/gates/GATE-E-FINDING.md`); `max_tokens≤64` fast-path quirk documented in `logs/gates/GATE-A-FINDING.md`.
- opencode usage reconstructed from its own transcripts/proxy journal (OpenAI-wire SSE usage needed a balanced-brace parser — fixed mid-session, before the matrix ran).
- Seeds 1/2 are neutral-sentence prompt variants, not temperature changes (temperature is whatever each harness defaults to — an uncontrolled variable).
- Other uncontrolled variables: harness system prompts, tool ergonomics (edit vs rewrite), agentic loop structure. The benchmark measures **model-through-harness as shipped**, which is exactly the question asked.
- n=8 tasks (11 with the E4 hard tasks): the statistical unit is the task; repeats (seeds) are re-worded prompts of the same task, not new task samples. Differences <~15pp in solve rate are within CI noise. The paired contrasts (claude>opencode on deepseek; glm>deepseek everywhere) are consistent across seeds and tasks and are the strongest claims here — but they describe these tasks only.

## Reproducing the analysis

- Harness versions are pinned in `configs/harness-configs.json` (Claude Code 2.1.319, opencode 1.19.5, pi 0.73.1) and vendored under `vendor/` (see README "Reproducing" for the full run sequence).
- **Seed meaning:** a seed is a prompt variant, not a random-state or temperature control. Seed 0 = the task's `spec.md` verbatim; seeds 1/2 append one neutral sentence ("work carefully..." / "aim for a clean, readable implementation..."); seed 3 (E5 only) appends the misleading hint. Task content, tests, and time budgets are identical across seeds.
- Time budgets: 360s wall clock for single-file tasks (t10 among them), 540s for multi-repo tasks (t4/t5/t6). Ordinary timeouts count as unsolved; no retry-until-success. Retries exist only for the gateway-poison signature (429s + zero completed requests), max 3 attempts with backoff; every attempt's transcript and score are preserved on the record (`rec.attempts`).
- Scoring: all-or-nothing solve = every hidden test passes; partial credit = passed/total. Grading runs in a staged /tmp copy while masters are chmod 000.
- Exclusions: `isInfraInvalid` = gateway_degraded | runner_error | grade_error | 429-with-zero-requests (excluded everywhere). Ordinary timeouts are never excluded. Quarantined records (see `runs/quarantine/README.md`) enter no aggregate.
- Replacement policy (E4): for the four compromised t10-s0 runIds listed in `runs/e4-replace/README.md`, the latest valid `runs/journal-e4-replace.jsonl` record replaces the original in published tables; the retain-policy sensitivity view is reported in `runs/experiments.json` (`e4.replacementSensitivity`) and changed no conclusion.
- Regenerate: `node runner/analyze.mjs --phase full --reps 10000` (main ranking) and `node runner/experiments.mjs` (writes `runs/experiments.json`; E3/E4/E5 + replacement sensitivity). Run order, retry rules, and per-phase journals are in `runner/run.mjs`; the proxy's run-scoped attribution rules are in `runner/proxy.mjs`.

## Verdict (observed on these 11 tasks only)

1. **glm-5.3-flash through Claude Code** — perfect 24/24 on the 8-task matrix and the top hard-task cell (5/9); the strongest observed combination in this study. This is not a claim of general superiority.
2. **glm-5.3-flash through opencode or pi** — statistically tied with the leader for glm on the main matrix; pi had the lowest observed mean wall time and recorded input-token count for glm. Token counters are not monetary cost.
3. **deepseek-v4-flash through Claude Code** — the strongest deepseek pairing observed, by a clear paired margin on the main matrix.
4. **deepseek through opencode/pi** — drops to 50–63% on the main matrix; the harness choice mattered more for deepseek than for glm on these tasks. On the hard tasks this ordering partially reversed (see E4), so the harness effect is not a stable generalization.

## Limitations (consolidated)

- **11 distinct custom tasks total; repeats are not independent task samples.** The statistical unit is the task; seeds are prompt re-wordings of the *same* task (see Method notes), so n=8 or n=11 tasks is the true sample size and CIs reflect task-sampling uncertainty only. No claim extends beyond these tasks.
- **Requested-model labels were checked; served-model identity was not independently verified.** The proxy verifies every request carried the assigned model id; what the gateway actually served behind that id cannot be verified from here (documented routing quirk, `logs/gates/GATE-A-FINDING.md`).
- **Guidance comparisons (E3) have limited replication** — seed 0 only, n=8 easy / n=3 hard matched cells per combo; deltas of ±33pp rest on 1–3 paired flips.
- **Hint experiments (E5) lack matched no-hint controls** — seed 3 is the hint treatment by design; "bitten" outcomes are a proxy (failures located where hints point), not proof the hints caused them.
- **~175 historical proxy records were lost** in the journal re-split (disclosed above and in `runs/quarantine/README.md`). The four replacement runs repair specific evidence gaps but do not recreate lost history.
- Other uncontrolled variables: harness system prompts, tool ergonomics, agentic loop structure, per-harness temperature defaults, gateway load during the observation window.

Artifacts: `runs/journal-{pilot,full}.jsonl` (main-matrix records: per-test results, token usage, model verification) plus `runs/journal-{e4,guided,hint,validate,e4-replace}.jsonl` (follow-up phases, see section above; `runs/e4-replace/README.md` documents replacement provenance + selection policy), `logs/pilot-*.out.txt` + `logs/full-*.out.txt` (main-matrix transcripts; follow-up transcripts under `logs/e4-*`, `logs/guided-*`, `logs/hint-*`, `logs/validate-*`, `logs/e4-replace-*`), `logs/gates/*.md` (gateway findings), `runner/{run,grade,analyze,proxy,redact}.mjs`. Gateway token redacted from any shared artifacts via `runner/redact.mjs`.
