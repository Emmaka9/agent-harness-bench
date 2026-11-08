// Naive stub: partially wrong on purpose (no validation, touching intervals not
// merged, keeps the later label, exclusive min-duration boundary, ignores offsetMin).

export function mergeIntervals(intervals, opts) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start < last.end) {
      // strictly overlapping only: touching intervals stay separate
      last.end = Math.max(last.end, iv.end);
      last.label = iv.label; // keeps the LATER interval's label
    } else {
      out.push({ start: iv.start, end: iv.end, label: iv.label });
    }
  }
  return out;
}

export function findFreeSlots(intervals, window, minDurationMs, opts) {
  const merged = mergeIntervals(intervals, opts);
  const slots = [];
  let cursor = window.start;
  for (const block of merged) {
    const s = Math.max(block.start, window.start);
    const e = Math.min(block.end, window.end);
    if (s < e) {
      if (s > cursor) slots.push({ start: cursor, end: s });
      cursor = Math.max(cursor, e);
    }
  }
  if (cursor < window.end) slots.push({ start: cursor, end: window.end });
  // exclusive boundary: drops gaps of exactly minDurationMs
  return slots.filter((g) => g.end - g.start > minDurationMs);
}
