// Naive stub: partially wrong on purpose (no validation, no priority,
// no retry backoff, stats keys drift, deps barely handled).
export class JobQueue {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.maxConcurrent = options.maxConcurrent;
    this.maxAttempts = options.maxAttempts;
    this.jobs = []; // { id, priority, deps, durationMs, deadlineMs, state, attempts }
  }

  add(job) {
    if (this.jobs.some((j) => j.id === job.id)) {
      throw new Error('duplicate job: ' + job.id);
    }
    this.jobs.push({
      id: job.id,
      priority: job.priority,
      deps: job.deps || [],
      durationMs: job.durationMs,
      deadlineMs: job.deadlineMs === undefined ? null : job.deadlineMs,
      state: 'pending',
      attempts: 0,
      startedAt: null,
    });
    return job.id;
  }

  tick() {
    const t = this.now();

    // expiry
    for (const job of this.jobs) {
      if (
        job.state === 'pending' &&
        job.deadlineMs !== null &&
        t >= job.deadlineMs
      ) {
        job.state = 'expired';
      }
    }

    // blocked propagation (one pass only, no fixpoint)
    for (const job of this.jobs) {
      if (job.state !== 'pending') continue;
      for (const depId of job.deps) {
        const dep = this.jobs.find((j) => j.id === depId);
        if (dep && (dep.state === 'expired' || dep.state === 'failed')) {
          job.state = 'blocked';
          break;
        }
      }
    }

    // start jobs in insertion order (ignores priority)
    let running = this.jobs.filter((j) => j.state === 'running').length;
    for (const job of this.jobs) {
      if (running >= this.maxConcurrent) break;
      if (job.state !== 'pending') continue;
      const ready = job.deps.every((depId) => {
        const dep = this.jobs.find((j) => j.id === depId);
        return dep && dep.state === 'done';
      });
      if (!ready) continue;
      job.state = 'running';
      job.startedAt = t;
      job.attempts += 1;
      running += 1;
    }

    // finish running jobs (only ones started in an earlier pass)
    for (const job of this.jobs) {
      if (job.state !== 'running') continue;
      if (job.startedAt === t) continue; // just started this pass
      if (t < job.startedAt + job.durationMs) continue;
      if (job.id.endsWith('!')) {
        // always retry forever, no backoff schedule and no terminal failure
        job.state = 'pending';
        job.startedAt = null;
      } else {
        job.state = 'done';
        job.startedAt = null;
      }
    }

    return undefined;
  }

  stats() {
    const counts = { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 };
    for (const job of this.jobs) {
      if (job.state in counts) counts[job.state] += 1;
    }
    return counts;
  }
}
