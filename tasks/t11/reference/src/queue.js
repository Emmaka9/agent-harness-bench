// Reference solution: deterministic clock-driven job queue simulator.
export class JobQueue {
  #now;
  #maxConcurrent;
  #maxAttempts;
  #jobs = new Map(); // id -> job record (insertion order = add order)
  #order = []; // ids in insertion order

  constructor(options) {
    const { now, maxConcurrent, maxAttempts } = options ?? {};
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new TypeError('maxConcurrent must be an integer >= 1');
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new TypeError('maxAttempts must be an integer >= 1');
    }
    if (typeof now !== 'function') {
      throw new TypeError('now must be a function');
    }
    this.#now = now;
    this.#maxConcurrent = maxConcurrent;
    this.#maxAttempts = maxAttempts;
  }

  add(job) {
    const { id, priority, deps, durationMs, deadlineMs } = job ?? {};
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('job.id must be a non-empty string');
    }
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      throw new TypeError('job.priority must be a finite number');
    }
    if (!Array.isArray(deps)) {
      throw new TypeError('job.deps must be an array');
    }
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
      throw new TypeError('job.durationMs must be a finite number >= 0');
    }
    if (deadlineMs !== undefined && (typeof deadlineMs !== 'number' || !Number.isFinite(deadlineMs))) {
      throw new TypeError('job.deadlineMs must be a finite number');
    }
    if (deps.includes(id)) {
      throw new Error('self dependency: ' + id);
    }
    const existing = this.#jobs.get(id);
    if (existing !== undefined) {
      throw new Error('duplicate job: ' + id);
    }
    const record = {
      id,
      priority,
      deps: deps.slice(),
      durationMs,
      deadlineMs: deadlineMs === undefined ? null : deadlineMs,
      state: 'pending', // pending | retrying | running | done | failed | expired | blocked
      attempts: 0,
      startedAt: null,
      retryAt: null,
      seq: this.#order.length,
    };
    this.#jobs.set(id, record);
    this.#order.push(id);
    return id;
  }

  #isTerminal(state) {
    return state === 'done' || state === 'failed' || state === 'expired' || state === 'blocked';
  }

  // Terminal deps poison a job: expired/failed/blocked deps make it blocked.
  // Returns 'ok' when no dep poisons, or 'blocked'.
  #depStatus(record, t) {
    let allDone = true;
    for (const depId of record.deps) {
      const dep = this.#jobs.get(depId);
      if (dep === undefined) {
        allDone = false; // dep not added yet: job simply waits
        continue;
      }
      if (dep.state === 'done') continue;
      allDone = false;
      if (dep.state === 'expired' || dep.state === 'failed' || dep.state === 'blocked') {
        return { blocked: true };
      }
    }
    return { blocked: false, allDone };
  }

  tick() {
    const t = this.#now();

    // 1. Expiry first: pending and retrying jobs past their deadline.
    for (const id of this.#order) {
      const record = this.#jobs.get(id);
      if (
        (record.state === 'pending' || record.state === 'retrying') &&
        record.deadlineMs !== null &&
        t >= record.deadlineMs
      ) {
        record.state = 'expired';
        record.retryAt = null;
      }
    }

    // 2. Blocked propagation, repeated until fixpoint (a blocked job blocks
    //    its own dependents; blocked is terminal).
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of this.#order) {
        const record = this.#jobs.get(id);
        if (record.state !== 'pending' && record.state !== 'retrying') continue;
        const dep = this.#depStatus(record, t);
        if (dep.blocked) {
          record.state = 'blocked';
          record.retryAt = null;
          changed = true;
        }
      }
    }

    // 3. Start eligible jobs while capacity remains: priority desc, then
    //    insertion order. Newly started jobs are retried for capacity so a
    //    pass fills every slot it can.
    for (;;) {
      if (this.#runningCount() >= this.#maxConcurrent) break;
      let best = null;
      for (const id of this.#order) {
        const record = this.#jobs.get(id);
        const retryDue =
          record.state === 'retrying' && record.retryAt !== null && t >= record.retryAt;
        if (record.state !== 'pending' && !retryDue) continue;
        if (record.deadlineMs !== null && t >= record.deadlineMs) continue; // never run past deadline
        const dep = this.#depStatus(record, t);
        if (dep.blocked || !dep.allDone) continue;
        if (
          best === null ||
          record.priority > best.priority ||
          (record.priority === best.priority && record.seq < best.seq)
        ) {
          best = record;
        }
      }
      if (best === null) break;
      best.state = 'running';
      best.attempts += 1;
      best.startedAt = t;
    }

    // 4. Finish checks for running jobs (including ones started this pass).
    for (const id of this.#order) {
      const record = this.#jobs.get(id);
      if (record.state !== 'running') continue;
      if (t < record.startedAt + record.durationMs) continue; // still running
      // The attempt completes now. Deterministic success rule: an attempt
      // fails iff the job's id ends with '!'.
      const fails = record.id.endsWith('!');
      if (!fails) {
        record.state = 'done';
        record.startedAt = null;
        continue;
      }
      if (record.attempts < this.#maxAttempts) {
        record.state = 'retrying';
        record.retryAt = t + 100 * Math.pow(2, record.attempts - 1);
        record.startedAt = null;
      } else {
        record.state = 'failed';
        record.startedAt = null;
      }
    }

    return undefined;
  }

  #runningCount() {
    let n = 0;
    for (const record of this.#jobs.values()) {
      if (record.state === 'running') n++;
    }
    return n;
  }

  stats() {
    const counts = { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 };
    for (const record of this.#jobs.values()) {
      const key = record.state === 'retrying' ? 'pending' : record.state;
      counts[key] += 1;
    }
    return counts;
  }
}
