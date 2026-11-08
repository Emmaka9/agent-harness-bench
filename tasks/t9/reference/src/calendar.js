// Reference solution: merge-interval calendar.
const NOW_MSG = 'now must be a function or undefined';
const OFFSET_MSG = 'offsetMin must be a finite number';
const INTERVAL_MSG = 'invalid interval: start must be < end';

function resolveNow(opts) {
  const now = opts?.now;
  if (now !== undefined && typeof now !== 'function') {
    throw new TypeError(NOW_MSG);
  }
  return now === undefined ? Date.now : now;
}

function validate(intervals) {
  // Check start < end per interval in input order; first failure throws.
  for (const iv of intervals) {
    if (!(iv.start < iv.end)) {
      throw new TypeError(INTERVAL_MSG);
    }
  }
}

export function mergeIntervals(intervals, opts) {
  resolveNow(opts);
  validate(intervals);
  // Stable copy sorted by start (Array.prototype.sort is stable in V8 >= 7.0).
  const sorted = intervals
    .map((iv) => ({ start: iv.start, end: iv.end, label: iv.label }))
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of sorted) {
    const last = out.length ? out[out.length - 1] : undefined;
    if (last && iv.start <= last.end) {
      // Overlap or exact touch: extend. Label rule: the run keeps the label of
      // its earliest-starting source; on equal starts the sorted order has
      // already placed the earlier input entry first, so `last` holds it.
      if (iv.end > last.end) last.end = iv.end;
    } else {
      out.push({ start: iv.start, end: iv.end, label: iv.label });
    }
  }
  for (const m of out) {
    if (m.label === undefined) delete m.label;
  }
  return out;
}

export function findFreeSlots(intervals, window, minDurationMs, opts) {
  const now = resolveNow(opts);
  const offsetMin = opts?.offsetMin;
  if (offsetMin !== undefined && !(typeof offsetMin === 'number' && Number.isFinite(offsetMin))) {
    throw new TypeError(OFFSET_MSG);
  }
  validate(intervals);
  const shift = (offsetMin === undefined ? 0 : offsetMin) * 60000;
  const wStart = window.start + shift;
  const wEnd = window.end + shift;
  void now; // options are validated; results depend only on the inputs

  const merged = mergeIntervals(intervals, opts);
  const slots = [];
  let cursor = wStart;
  for (const block of merged) {
    const s = Math.max(block.start, wStart);
    const e = Math.min(block.end, wEnd);
    if (s >= e) continue; // disjoint from the window, or zero-length edge clip
    if (s > cursor) addSlot(slots, cursor, s, minDurationMs);
    if (e > cursor) cursor = e;
  }
  if (cursor < wEnd) addSlot(slots, cursor, wEnd, minDurationMs);
  return slots;
}

function addSlot(slots, start, end, minDurationMs) {
  // Inclusive boundary: a gap of exactly minDurationMs is returned.
  if (end - start >= minDurationMs) slots.push({ start, end });
}
