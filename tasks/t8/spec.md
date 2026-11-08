Dependency Topological Sort

Create `src/topo.js` exporting one named ESM function, `order(nodes, edges)`. `nodes` is an array of string ids; `edges` is an array of `[before, after]` pairs meaning `before` must appear before `after` in the result. The function returns an array containing every node exactly once, respecting all edge constraints, and never mutates its arguments. Node.js builtins only, no external packages. ESM.

Determinism: the result is the unique order produced by repeatedly taking, among all nodes whose prerequisites are already emitted and that are not yet emitted, the alphabetically smallest id (plain `<` comparison on the strings). Nodes with no edges participate in this same selection process.

Errors, checked in this order:
1. Unknown nodes: if any edge endpoint is not found in `nodes` (using exact string equality), throw `new Error("unknown node: x")` where `x` is the first offending endpoint, scanning edges in order and each edge as `[before, after]` (before first, then after). This check runs over all edges before any ordering work and even when the graph is also cyclic. Duplicate entries in `nodes` are not an error; treat the node list as a set. A duplicate edge (the same `[before, after]` pair appearing more than once) imposes the same single constraint as one copy of that edge and is not an error.
2. Cycles: if the graph has a cycle, throw `new Error("cycle detected: a -> b -> a")`. The message is `"cycle detected: "` followed by a cycle path: an actual node id, then `" -> "` repeated, ending with that same starting id again, tracing real edges of the graph through distinct nodes (e.g. `b -> c -> b`). Any cycle and any starting node inside it are acceptable — the message must name real ids joined by `" -> "`, start and end with the same id, and every step must follow an edge. A self-edge such as `["a", "a"]` is a cycle; its message is exactly `cycle detected: a -> a`.

Examples:
- `order(["b","a","c"], [["a","b"]])` returns `["a","b","c"]`: "a" precedes "b", and among the free nodes "a" and "c" the alphabetically smallest is emitted first, then "b" and "c" compete.
- `order(["c","b","a"], [])` returns `["a","b","c"]`.
- `order(["a"], [["a","a"]])` throws `cycle detected: a -> a`.
- With `nodes ["a","b","c","d"]` and edges `[["d","b"],["c","d"]]`, the result is `["a","c","d","b"]`.
