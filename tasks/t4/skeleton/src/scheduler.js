// Scheduler built on top of Bus. Exported API: class Scheduler.
// See behavior.md for the invariants this module must hold.
import { Bus } from './bus.js';

const DONE = 'job:done';

export class Scheduler {
  constructor(bus, options = {}) {
    if (!bus || typeof bus.on !== 'function' || typeof bus.off !== 'function' || typeof bus.emit !== 'function') {
      throw new TypeError('bus must provide on, off and emit');
    }
    if (options.now !== undefined && typeof options.now !== 'function') {
      throw new TypeError('now must be a function or undefined');
    }
    this._bus = bus;
    this._now = options.now === undefined ? Date.now : options.now;
    /** @type {Map<string, any>} */
    this._jobs = new Map();
  }

  schedule(id, runAtMs) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('id must be a non-empty string');
    }
    if (typeof runAtMs !== 'number' || !Number.isFinite(runAtMs)) {
      throw new TypeError('runAtMs must be a finite number');
    }
    if (this._jobs.has(id)) {
      throw new Error('duplicate job id');
    }
    const job = {
      id,
      runAtMs,
      status: 'pending',
      startedAt: null,
      endedAt: null,
    };
    const handler = (event) => {
      if (!event || typeof event !== 'object') return;
      if (event.id !== id) return;
      job.status = 'done';
      job.endedAt = Number.isFinite(event.atMs) ? event.atMs : this._now();
      this._bus.off(DONE, handler);
    };
    job._handler = handler;
    this._jobs.set(id, job);
    this._bus.on(DONE, handler);
    return this._view(job);
  }

  start(id) {
    const job = this._jobs.get(id);
    if (!job || job.status !== 'pending') return false;
    job.status = 'running';
    job.startedAt = this._now();
    return true;
  }

  cancel(id) {
    const job = this._jobs.get(id);
    if (!job) return false;
    if (job.status === 'done' || job.status === 'cancelled') return false;
    if (job.startedAt === null) {
      // Nothing has started yet: just mark it cancelled.
      job.status = 'cancelled';
      job.endedAt = this._now();
      return true;
    }
    this._bus.off(DONE, job._handler);
    job.status = 'cancelled';
    job.endedAt = this._now();
    return true;
  }

  status(id) {
    const job = this._jobs.get(id);
    return job ? job.status : null;
  }

  _view(job) {
    const durationMs =
      job.status === 'done' && job.startedAt !== null && job.endedAt !== null
        ? job.endedAt - job.startedAt
        : null;
    return {
      id: job.id,
      runAtMs: job.runAtMs,
      status: job.status,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
      durationMs,
    };
  }

  snapshot() {
    return [...this._jobs.values()].map((job) => this._view(job));
  }

  stats() {
    const counts = { total: 0, pending: 0, running: 0, done: 0, cancelled: 0 };
    for (const job of this._jobs.values()) {
      counts.total++;
      counts[job.status]++;
    }
    return counts;
  }
}
