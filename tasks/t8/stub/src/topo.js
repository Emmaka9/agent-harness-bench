// Naive topological sort (input-order tie-breaking, no error handling).
export function order(nodes, edges) {
  const indeg = new Map(nodes.map((n) => [n, 0]));
  for (const [, after] of edges) {
    indeg.set(after, (indeg.get(after) ?? 0) + 1);
  }
  const result = [];
  const emitted = new Set();
  while (result.length < nodes.length) {
    let pick = null;
    for (const n of nodes) {
      if (!emitted.has(n) && (indeg.get(n) ?? 0) === 0) {
        pick = n;
        break;
      }
    }
    if (pick === null) break; // cyclic or stuck: return what we have so far
    emitted.add(pick);
    result.push(pick);
    for (const [b, a] of edges) {
      if (b === pick) indeg.set(a, indeg.get(a) - 1);
    }
  }
  return result;
}
