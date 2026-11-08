# Task authoring template (P2)

Each task directory: `bench/tasks/<id>/`
- `spec.md`      — the EXACT prompt text given to the agent (no test names, no "the tests check that...")
- `skeleton/`    — the initial files the agent starts from (copied into every sandbox). MUST include
                   `package.json` with `{"type":"module"}`. Pure node builtins only.
- `reference/`   — a known-good full solution (for calibration only; never shown to agents)
- `stub/`        — a naive/low-effort solution that MUST fail at least one hidden test
- `tests/`       — hidden tests, one or more `gNN_<name>.test.mjs` files, ESM, node builtins only

## Hard rules for hidden tests

1. Import ONLY `node:*` builtins and the solution module under test by RELATIVE path.
2. Deterministic: use an injected `now`/clock parameter or fixed fixtures. NEVER `setTimeout`,
   `performance.now` differences, real sleeps, or Math.random without a seeded PRNG.
3. Grade runtime < 60s total for the whole suite (target < 10s).
4. Use `node:test` + `node:assert/strict`. Test names must be unique and stable strings
   (they become the per-test partial-credit keys).
5. Each test file starts with:
   import { test } from 'node:test';
   import assert from 'node:assert/strict';
   import { <exports> } from '../<path-inside-sandbox>.js';
   (the runner copies tests into <sandbox>/__grade__/ and rewrites the import path to the
   actual solution location — see grade.mjs; keep the relative import pointing at the
   solution path as it exists INSIDE the sandbox, prefixed '../')
6. Cover: happy path, edge cases, spec'd error behavior. 8–20 tests per task.
7. Do not mention the tests' existence, names, or counts in spec.md. The spec describes
   REQUIRED BEHAVIOR precisely enough that a correct implementation passes.

## Spec.md rules

- Full export contract: exact file path(s), exact export names/signatures.
- Behavior spec: precise enough to implement unambiguously (tie-break rules, error types,
  edge-case semantics must all be pinned down).
- State the constraint: "Node.js builtins only, no external packages. ESM."
- ~150-400 words. No headers other than the task title. No "your code will be tested with..."
