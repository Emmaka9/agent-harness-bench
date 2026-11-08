Event Bus Subscriber Leak

You are given a mini-repo: `src/bus.js` exports `Bus`, an EventEmitter-like
pub/sub class; `src/scheduler.js` exports `Scheduler`, which schedules jobs on
a `Bus`. The repo has a bug: some code path fails to unsubscribe a
`'job:done'` handler, leaking subscribers. Fix it. Keep every public API and
signature unchanged; do not delete files; adding files is fine. Node.js
builtins only, ESM, no external packages.

`Bus` provides exactly: `on(type, handler)` (adds, returns `this`), `off(type,
handler)` (removes; unknown handler/type ignored; returns `this`),
`emit(type, payload)`, `listenerCount(type)` (0 for unknown types). The same handler function registered twice on a type counts once.
`emit` returns the count invoked, runs them in registration order, and
snapshots the list when it begins: a handler added during an emit runs only
in later emits; one removed during an emit still runs later in that emit.

`Scheduler(bus, options)`, `options = {now}`; validate `bus` first, then
`now`. `bus` must provide `on`, `off`, `emit` as functions, else `TypeError`
(`'bus must provide on, off and emit'`). `now` must be a function or undefined
(default `Date.now`), else `TypeError` (`'now must be a function or
undefined'`). `now` is called exactly: once per successful `start`, once per
job-transitioning `cancel`, and once by the done handler when a payload lacks
a finite `atMs`. Nothing else invokes it.

`schedule(id, runAtMs)`: validate `id` (non-empty string) then `runAtMs`
(finite number), else `TypeError`. If the id maps to a non-terminal job throw
`Error('duplicate job id')`. Creates exactly one `'job:done'` subscription and
returns `{id, runAtMs, status: 'pending', startedAt: null, endedAt: null,
durationMs: null}`. Rescheduling a terminal id replaces that record.

`start(id)`: only a `pending` job moves to `running` with
`startedAt = now()`, returning true; any other job returns false unchanged.

`cancel(id)`: unknown or terminal jobs return false. A `pending` or `running`
job moves to `cancelled`, sets `endedAt = now()`, returns true, and MUST
unsubscribe its `'job:done'` handler, so a later `emit('job:done', {id})` is a
no-op: status and `endedAt` stay unchanged, for started and never-started
jobs alike.

Emitting `'job:done'` with payload `{id, atMs}` moves a non-terminal job with
that id to `done`, sets `endedAt = atMs` (or `now()` if `atMs` is not finite),
unsubscribes, and sets `durationMs = endedAt - startedAt` if started, else
null. Terminal jobs, other ids and non-object payloads are ignored.

`status(id)` returns the status string or null. `snapshot()` returns a fresh
array of fresh view objects each call. `stats()` returns counts:
`{total, pending, running, done, cancelled}`.

