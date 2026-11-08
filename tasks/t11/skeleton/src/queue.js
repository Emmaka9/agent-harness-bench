// Implement the JobQueue class described in spec.md.
export class JobQueue {
  constructor(options) {
    // TODO: validate {now, maxConcurrent, maxAttempts} in the specified order
    // and throw the specified TypeErrors.
  }

  add(job) {
    // TODO: validate the job shape, self-dependency and duplicates;
    // store the job as pending and return its id.
  }

  tick() {
    // TODO: one scheduling pass in the specified order —
    // expiry, then starts up to maxConcurrent (priority then insertion order),
    // then finish checks, retries with backoff, and blocked propagation.
  }

  stats() {
    // TODO: return {pending, running, done, failed, expired, blocked}
    // as a fresh object each call.
  }
}
