# Quarantine

Records and transcripts excluded from model-quality rankings pending re-validation.
Nothing quarantined here is deleted — it is evidence, just not trusted evidence.
(For records that WERE lost, see the third note below.)

## e4-quarantined.jsonl
- `t10-s0-claude-glm-5.3-flash` (2026-11-08T04:35Z): timed out at 360s AND its proxy window
  saw HTTP 429s AND produced 0/22 with 56 logged requests. Mixed infra signal (the
  2026-11-08 04:20–04:46 gateway congestion window when the operator's own session was
  streaming against the same token). Its transcript is
  `transcripts/quarantined-timeout-t10-s0-claude-glm.out.txt`.

## transcripts/
- `full-t11-s0-claude-glm-5.3-flash.out.txt`: 80-byte stub from the killed first E4
  attempt (2026-11-07 22:58 EST); no journal record ever referenced it (the run died
  before journaling). Kept for completeness.
- `quarantined-timeout-t10-s0-claude-glm.out.txt`: transcript of the quarantined record above.

Note: journal-full.pre-hardening-snapshot.jsonl initially sat here and was moved to
../archive/ — it is a full backup of the original 144-run journal (attempt history
for nothing; its presence made run.mjs's maxAttempt scan believe every original
runId had already been attempted once, silently starting re-runs at attempt 2).
Quarantine journals must contain ONLY quarantined attempt records.

## 2026-11-08 second addition
- t10-s0-opencode-glm-5.3-flash (attempt 1, from journal-e4): pre-hardening provenance.
  Proxy journal shows saw429=true + errors=1; the underlying per-request records were
  overwritten by later self-tests, so the 21/22 score cannot be re-verified. Quarantined
  (not deleted) per reliability directive #2. E4 t10/glm seed-0 has no valid opencode
  record; sensitivity analyses should treat it as missing rather than imputed.

## 2026-11-08 third note — proxy journal provenance
- logs/proxy-full-w0.jsonl: split by date boundary 2026-11-08T03:50Z. Original matrix
  + E1/E2-era traffic (1219 records, one 429 — 03:48:22Z, the storm's first — last
  non-429 2026-11-08T03:48Z) stays in the file; the committed file's final 58 records
  (03:52-03:58, start of the 429-storm) moved to
  logs/post-matrix/proxy-e4baseline-era-w0.jsonl.
- Accounting: the committed file (1ca2f7c) held 1278 records = 1219 preserved + 58 moved
  + 1 record (2026-11-08T04:00:20.291Z, status-undefined gateway error) that survives in
  neither split file — lost in the same re-split, folded into the loss total below.
- ~174 additional unattributed 429-era proxy records (03:58-04:46 UTC, appended to the
  working copy after the last commit) were lost during this re-split (git checkout
  ordering error by the operator agent). No live journal record references them; the
  runs they belonged to were already purged/quarantined pre-hardening. The 429 storm
  itself is documented in REPORT.md and logs/gates/GATE-E-FINDING.md.
