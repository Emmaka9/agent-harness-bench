// Naive stub: simple line-splitting CSV (no quote handling), no malformed-row
// skipping beyond the basics, no null semantics for empty groups, no order
// guarantee, and mean rounded differently.
export function aggregate(csvText, opts) {
  const { groupCol, valueCol, ops } = opts;
  const lines = String(csvText ?? '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',');
  const gi = header.indexOf(groupCol);
  const vi = header.indexOf(valueCol);

  const groups = new Map();
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',');
    if (fields.length !== header.length) continue;
    const g = fields[gi];
    const raw = fields[vi];
    if (!groups.has(g)) groups.set(g, { count: 0, sum: 0, vals: [] });
    const acc = groups.get(g);
    acc.count += 1;
    const v = Number(raw.trim());
    if (Number.isFinite(v)) {
      acc.sum += v;
      acc.vals.push(v);
    }
  }

  const result = [];
  for (const [g, acc] of groups) {
    const obj = { group: g, count: acc.count };
    for (const op of ops) {
      if (op === 'count') {
        obj.count = acc.count;
      } else if (op === 'sum') {
        obj.sum = acc.sum;
      } else if (op === 'min') {
        obj.min = acc.vals.length ? Math.min(...acc.vals) : null;
      } else if (op === 'max') {
        obj.max = acc.vals.length ? Math.max(...acc.vals) : null;
      } else if (op === 'mean') {
        obj.mean = acc.vals.length ? Math.round(acc.sum / acc.vals.length * 1000) / 1000 : null;
      }
    }
    result.push(obj);
  }
  return result;
}
