# Shared Workflow Guide (E3 instruction-normalization study)

This file is injected verbatim into each agent's instruction mechanism during E3 runs.
It is deliberately harness-agnostic. It does NOT contain any task-specific information.

## How to work on this task

Follow this exact sequence:

1. **Read the spec twice.** First pass: skim for the overall shape. Second pass:
   build an explicit mental list of EVERY explicit requirement: exact function/class
   names, exact export names, exact error messages, exact field names, exact
   ordering rules, and — most importantly — every edge case sentence. Spec sentences
   beginning with "if", "unless", "when", "otherwise", "must not", or "ignore" each
   describe a distinct behavior you must implement. List them.

2. **Write a plan of the implementation** in a scratch file or in your head:
   data structures, function signatures, and — for every edge case you listed —
   the one-line mechanism that handles it.

3. **Implement.**

4. **Self-review against your edge-case list, item by item.** For EACH edge case
   sentence in the spec, point to the exact line(s) of your code that implement it.
   If you cannot point to a line, you have missed it — implement it now.

5. **Check consistency rules:** when the spec defines ordering of operations
   (e.g. "validate A first, then B"), verify your code performs them in exactly
   that order. When the spec says a state is or is not mutated by an operation,
   verify your code mutates exactly what is allowed.

6. **If the task is a bug fix:** also verify the FIX handles every call pattern in
   the spec, not just the obviously-broken one. Look specifically for: state that
   should be cleaned up but isn't; registrations or records that should be replaced
   or revived but are only appended; operations on already-terminal or already-removed
   items.

7. **Before finishing:** re-read the spec's export/type contract one final time and
   confirm names and shapes match EXACTLY.
