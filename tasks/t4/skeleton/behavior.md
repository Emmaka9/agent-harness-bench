# Behavior invariants

`src/bus.js` exports `Bus`, an EventEmitter-like pub/sub. `src/scheduler.js`
exports `Scheduler`, which schedules jobs on a `Bus` and must hold ALL of the
following invariants at all times.

1. Every scheduled, non-terminal (`pending` or `running`) job holds exactly
   one subscription on the `'job:done'` event.
2. Once a job reaches a terminal state (`done` or `cancelled`) it holds ZERO
   subscriptions; the scheduler must not leak subscribers.
3. After a successful `cancel(id)`, emitting `'job:done'` for that id has no
   effect on the job: its status stays `cancelled` and its `endedAt` is
   unchanged.
4. A `cancel` of a job that has been started (`running`) and a `cancel` of a
   job that has never been started (`pending`) behave identically with respect
   to invariants 1-3.

The suite under `test/` (run with `node --test`) encodes these invariants.
One of its cases is currently red: the shipped `src/scheduler.js` violates
the invariants. Fix the module so every case is green without changing any
public API.
