// Implement the merge-interval calendar described in spec.md.
// Export mergeIntervals(intervals, opts) and findFreeSlots(intervals, window, minDurationMs, opts).

export function mergeIntervals(intervals, opts) {
  // TODO: validate (now, then each interval in input order), sort stably by start,
  // merge overlapping AND touching runs, keep the label of the earlier-starting source.
  return [];
}

export function findFreeSlots(intervals, window, minDurationMs, opts) {
  // TODO: validate opts (now, then offsetMin), then intervals; merge; clip to the
  // offset-shifted window; return gaps of length >= minDurationMs as {start, end}.
  return [];
}
