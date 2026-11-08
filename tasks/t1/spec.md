LRU + TTL Cache

Create `src/cache.js` exporting a single named ESM class, `LRUTTLCache`: an in-memory cache combining least-recently-used (LRU) eviction with per-entry time-to-live (TTL) expiry. Node.js builtins only, no external packages. ESM.

Constructor — `new LRUTTLCache(options)` with `options = {capacity, ttlMs, now}`:
- `capacity`: required integer >= 1.
- `ttlMs`: required finite number >= 0.
- `now`: optional function returning the current time in milliseconds; defaults to `Date.now`.
Validation runs in the order capacity, then ttlMs, then now, and throws a `TypeError` with exactly one of these messages: `"capacity must be an integer >= 1"`, `"ttlMs must be a finite number >= 0"`, `"now must be a function or undefined"`.

Keys use Map key semantics (SameValueZero). Values are arbitrary. An entry written at time `t` has deadline `t + ttlMs` and is expired iff `now() >= deadline` (so at exactly the deadline it is already expired). Expiry is lazy: expired entries stay stored until they are accessed or evicted; nothing expires on its own.

Behavior:
- `set(key, value)`: stores `value` with a fresh deadline (`now() + ttlMs`) and makes `key` most-recently-used, whether or not `key` already exists (even if the existing entry is expired). Returns `undefined`. Afterwards, while more than `capacity` entries are stored, evict the least-recently-used stored entry, without regard to expiry.
- `get(key)`: if `key` is absent or expired, remove the entry if it was stored and return `undefined`. Otherwise return the value and make `key` most-recently-used.
- `has(key)`: returns `true` iff `key` is stored and unexpired; it never changes recency. If stored but expired, it removes the entry and returns `false`.
- `delete(key)`: removes the entry if stored (regardless of expiry) and returns `true`; otherwise returns `false`.
- `size`, a getter property: the number of stored entries that are not expired; it never mutates state.

Recency is a strict total order with no ties: inserting a key places it at the most-recently-used position, and each `set` and each successful (unexpired) `get` moves the key there. All other operations leave recency unchanged.
