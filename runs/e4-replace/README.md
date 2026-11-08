# E4 replacement runs — FOLLOWUP-FOUR-RUNS-20261108

Four fresh seed-0 Mini-Regex-Engine (t10) runs on the hardened runner, replacing
specific compromised E4 records. Provenance, selection policy, and sensitivity
analysis live here; raw evidence is appended to `runs/journal-e4-replace.jsonl`
with transcripts `logs/e4-replace-*.out.txt` and proxy journal
`logs/proxy-e4-replace-w0.jsonl`.

## Replaced cells and why

| runId | status of original | reason for replacement |
|---|---|---|
| t10-s0-opencode-glm-5.3-flash | quarantined (attempt 1 in runs/quarantine/e4-quarantined.jsonl): saw429+errors=1, proxy evidence overwritten, 21/22 unverifiable | only valid-looking record for this cell is provenance-compromised |
| t10-s0-pi-glm-5.3-flash | retained in journal-e4 (attempt 1, 04:41:01Z): pre-hardening runner, time-window attribution, no run-scoped foreign/unattributed counters; window overlapped operator gateway session during 429 storm | attribution unverifiable at run scope |
| t10-s0-claude-deepseek-v4-flash | retained in journal-e4 (attempt 1, 04:44:12Z): same pre-hardening provenance | same |
| t10-s0-opencode-deepseek-v4-flash | retained in journal-e4 (attempt 1, 04:46:34Z): same pre-hardening provenance | same |

The three retained originals stay in `runs/journal-e4.jsonl` byte-identical — they are
history, not deleted. The quarantined op/glm attempt-1 record and its transcript also
stay untouched; this replacement continues the attempt numbering (attempt 2+) so no
evidence is overwritten.

## Execution provenance (filled in at run time)

- Trigger: cross-session peer message FOLLOWUP-FOUR-RUNS-20261108 (relay for user request).
- Runner: hardened runner with run-scoped attribution (`<runId>.a<attempt>` first path
  segment, 403 unattributed, foreignRequests/unattributedRejected counters); explicit
  360s fixed budget (t10 is a single-file task); original spec.md prompt, no guide, no
  hint (seed 0); masters locked during runs; sequential (--concurrency 1).
- Executed 2026-11-08 22:54–23:08 UTC, two sequential invocations (glm×{opencode,pi},
  then deepseek×{claude,opencode}), one gateway consumer at a time, no competing
  supervisor traffic. op/glm ran as attempt 2 (continues the quarantined attempt-1
  numbering); the other three ran as attempt 1.

## Outcomes (raw records in runs/journal-e4-replace.jsonl)

| runId | attempt | outcome | wall | integrity |
|---|---|---|---|---|
| t10-s0-opencode-glm-5.3-flash | a2 | wrong_solution 21/22 | 111s | foreign:0 unattr:0 saw429:false anyOtherModel:false |
| t10-s0-pi-glm-5.3-flash | a1 | wrong_solution 21/22 | 219s | foreign:0 unattr:0 saw429:false anyOtherModel:false |
| t10-s0-claude-deepseek-v4-flash | a1 | wrong_solution 21/22 | 113s | foreign:0 unattr:0 saw429:false anyOtherModel:false |
| t10-s0-opencode-deepseek-v4-flash | a1 | **timeout** (graded 21/22, counts UNSOLVED) | 360s | foreign:0 unattr:0 saw429:false anyOtherModel:false |

Zero solves; the hidden test "quantified groups capture the last completed repetition"
failed in all four replacements (consistent with all 17 original E4 t10 records).
pi/glm transcript is 405MB raw → committed gzipped (`.out.txt.gz`), journal keeps the
logical `.out.txt` name (repo-wide convention, README.md:53).

## Selection policy (analysis)

**Replace-policy (default for published tables):** for the four replaced runIds, the
latest valid `journal-e4-replace.jsonl` record replaces the retained/quarantined
original in E4 and in the E3 hard-stratum baseline; all other cells unchanged.
**Retain-policy (sensitivity):** originals kept; replacements excluded.

### Before/after (fixed-budget counting, timeouts unsolved)

E4 per-combo hard rows:
- claude/glm: 5/9 pc 0.87 → 5/9 pc 0.87 (no replaced cell in this combo; unchanged)
- opencode/glm: 4/8 pc 0.86 → **4/9 pc 0.87** (cell completed: quarantined record replaced)
- pi/glm: 3/9 pc 0.95 → 3/9 pc 0.96
- claude/deepseek: 3/9 pc 0.94 → 3/9 pc 0.95
- opencode/deepseek: 3/9 pc 0.89 → 3/9 pc 0.89 (replacement timed out at 21/22 graded —
  same unsolved status as the retained 20/22 original)
- pi/deepseek: 2/9 pc 0.72 → 2/9 pc 0.72 (unchanged)

E4 t10 seed-0 cells (replace-policy): glm 0/2 unsolved + cl/glm 21/22-timeout unsolved;
deepseek 0/3 unsolved (op/ds timeout; cl/ds, pi/ds 21/22 wrong_solution). "0 solved for
either model on t10" is unchanged and now rests entirely on run-scoped-attributed records.

E3 hard stratum (baseline = E4 seed-0):
- retain: op/glm n=2 (quarantined excluded), all others n=3 → deltas 0, 0, 0, +33, −33, −33
- replace: all six rows matched n=3; **deltas unchanged** (every replaced baseline stays
  unsolved: 21/22 wrong_solution ×3, timeout ×1).

### Conclusion sensitivity

No ranking, ordering, or E3-delta conclusion changes between retain and replace
policies. Changes are strictly: op/glm cell n=8→9, three partial-credit means move
≤0.02, op/ds t10-s0 evidence upgrades from pre-hardening to run-scoped-attributed
(timeout outcome), E3 op/glm hard row n=2→3. The 54-scheduled / 53-observed E4 header
becomes 54 scheduled / 57 observed (53 original + 4 replacements) with 4 replaced cells
governed by the selection policy above.

## Historical caveats (unchanged, still apply)

- ~175 proxy records lost in the journal re-split (see runs/quarantine/README.md third
  note) — these replacements do NOT recover them; no attempt was made to reconstruct
  or fabricate them.
- The gateway's served-model identity behind requested-model labels remains
  unverifiable (GATE-A quirk); these runs verify request labels via run-scoped proxy
  attribution, not served-model echoes.
