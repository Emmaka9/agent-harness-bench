Job queue simulator

Create `src/queue.js` exporting a single named ESM class, `JobQueue`: a deterministic, clock-driven scheduler for simulated jobs. Node.js builtins only, no external packages. ESM.

Constructor — `new JobQueue(options)` with `options = {now, maxConcurrent, maxAttempts}`:
- `now`: required function returning the current simulated time in milliseconds. It is called whenever the queue needs the time; it is never called by the constructor.
- `maxConcurrent`: required integer >= 1 — the maximum number of simultaneously running jobs.
- `maxAttempts`: required integer >= 1 — the maximum number of times any one job may be started.
Validation runs in the order maxConcurrent, then maxAttempts, then now, and throws a `TypeError` with exactly one of these messages: `"maxConcurrent must be an integer >= 1"`, `"maxAttempts must be an integer >= 1"`, `"now must be a function"`.

Jobs are added with `add(job)` where `job = {id, priority, deps, durationMs, deadlineMs}`:
- `id`: a required non-empty string. `priority`: a required finite number (higher runs first). `deps`: a required array of job ids (possibly empty). `durationMs`: a required finite number >= 0. `deadlineMs`: an optional finite number; when omitted the job has no deadline.
- `run` is not part of the job — jobs are simulated; the queue only tracks their lifecycle.
- Validation happens in the order id, priority, deps, durationMs, deadlineMs and throws a `TypeError` with exactly one of these messages: `"job.id must be a non-empty string"`, `"job.priority must be a finite number"`, `"job.deps must be an array"`, `"job.durationMs must be a finite number >= 0"`, `"job.deadlineMs must be a finite number"`. Each dep need not exist yet, but a dep that equals the job's own id throws `Error('self dependency: ' + id)`.
- Adding an id that already exists and is in a non-terminal state throws `Error('duplicate job: ' + id)`; re-adding an id in a terminal state also throws this same error. A job is terminal once it is done, failed, expired or blocked. Validation order: the TypeError checks first (id, priority, deps, durationMs, deadlineMs), then the self-dependency check, then the duplicate check.
- `add` returns the job's id.

The job lifecycle. A job is one of: pending, running, retrying, done, failed, expired, blocked.
- `tick()` advances the simulation by one scheduling pass and returns `undefined`. It reads `now()` once at the start; that single time value governs the whole pass.
- Expiry first: at the start of the pass, every pending or retrying job with `deadlineMs` defined and `now() >= deadlineMs` becomes expired. Expiry propagates before anything else happens.
- Then, while fewer than `maxConcurrent` jobs are running and at least one job is eligible, start jobs. A job is eligible when it is pending (or retrying with `now() >= retryTime`), all of its deps are done, and it is not past its deadline (deadlineMs undefined, or `now() < deadlineMs`). Eligible jobs start in priority order (higher priority first); among equal priorities, insertion order breaks the tie (the earlier `add` wins). Starting fills every available slot: after each start the search repeats, so a pass may start several jobs. A job that starts consumes one attempt: its attempt count becomes 1 on its first start, 2 on the next, and so on. A retrying job's restart consumes another attempt and its attempt count continues from where it was.
- A running job whose start time `t` (the `now()` value of the pass that started it) satisfies `now() >= t + durationMs` finishes at the end of the same pass and becomes done. Jobs that started in this pass are also checked for finishing, so `durationMs` 0 jobs complete within the pass that started them.
- Retry: to keep success/failure deterministic without injected randomness, a job's attempt fails iff the job's id ends with the character `'!'`; any other job's attempt succeeds. (So an id like `'email!'` always fails every attempt, and `'email'` always succeeds on its first attempt.)
  - On a failed attempt with attempt count `a < maxAttempts`: the job becomes retrying, with retry time `(the pass time at which the failure was processed) + 100 * 2^(a - 1)` — 100 ms after the first failure, 200 ms after the second, 400 ms after the third. It becomes eligible again once a pass reads `now() >= retryTime`, provided its deps are all done and capacity remains.
  - On a failed attempt with `a >= maxAttempts`: the job becomes failed. Failure is terminal.
  - Expiry beats retrying: a retrying job whose `deadlineMs` is defined and has `now() >= deadlineMs` becomes expired instead of running again.
- Blocked: when a job's deps include a job that is expired, failed or blocked, the job becomes blocked (checked when the job would otherwise be considered for starting). Blocked is terminal and propagates: a dependent of a blocked job also becomes blocked.
- `stats()` returns `{pending, running, done, failed, expired, blocked}` — exactly these six keys with integer counts. `retrying` jobs are counted under `pending`. The returned object is a fresh plain object each call; mutating it must not affect the queue.

One `tick()` performs the full pass in the order above and stops; calling `tick()` repeatedly drives the simulation forward. Nothing runs without a `tick()`.
