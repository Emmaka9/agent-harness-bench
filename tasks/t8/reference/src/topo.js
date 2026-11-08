// Dependency topological sort with deterministic alphabetical tie-breaking.

function findCyclePath(remaining, adj) {
  const color = new Map([...remaining].map((n) => [n, 0])); // 0 white, 1 gray, 2 black
  const stack = [];
  let cycle = null;

  function dfs(n) {
    color.set(n, 1);
    stack.push(n);
    for (const m of [...adj.get(n)].sort()) {
      if (cycle) return;
      if (!remaining.has(m)) continue;
      if (color.get(m) === 1) {
        cycle = stack.slice(stack.indexOf(m));
        return;
      }
      if (color.get(m) === 0) dfs(m);
    }
    stack.pop();
    color.set(n, 2);
  }

  for (const n of [...remaining].sort()) {
    if (cycle) break;
    if (color.get(n) === 0) dfs(n);
  }
  cycle.push(cycle[0]); // close the loop: start id repeated at the end
  return cycle;
}

export function order(nodes, edges) {
  const nodeSet = new Set(nodes);
  for (const [before, after] of edges) {
    if (!nodeSet.has(before)) throw new Error(`unknown node: ${before}`);
    if (!nodeSet.has(after)) throw new Error(`unknown node: ${after}`);
  }

  const adj = new Map();
  const indeg = new Map();
  for (const n of nodes) {
    if (!adj.has(n)) {
      adj.set(n, new Set());
      indeg.set(n, 0);
    }
  }
  for (const [before, after] of edges) {
    const outs = adj.get(before);
    if (!outs.has(after)) {
      outs.add(after);
      indeg.set(after, indeg.get(after) + 1);
    }
  }

  const remaining = new Set(nodes);
  const result = [];
  while (remaining.size > 0) {
    let pick = null;
    for (const n of remaining) {
      if (indeg.get(n) === 0 && (pick === null || n < pick)) pick = n;
    }
    if (pick === null) {
      throw new Error(`cycle detected: ${findCyclePath(remaining, adj).join(' -> ')}`);
    }
    remaining.delete(pick);
    result.push(pick);
    for (const m of adj.get(pick)) {
      indeg.set(m, indeg.get(m) - 1);
    }
  }
  return result;
}
