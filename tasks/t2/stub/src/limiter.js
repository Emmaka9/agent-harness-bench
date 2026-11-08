// Naive stub: integer-token buckets, no fractional refill, no lazy time tracking.
export class TokenBucketLimiter {
  constructor(options) {
    this.rate = options.rate;
    this.burst = options.burst;
    this.buckets = new Map();
  }

  #bucket(key) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: Math.floor(this.burst), lastMs: Date.now() };
      this.buckets.set(key, b);
    }
    return b;
  }

  allow(key, cost = 1) {
    const b = this.#bucket(key);
    if (cost > this.burst) throw new RangeError('cost exceeds burst');
    b.tokens = Math.floor(b.tokens); // no fractional refill
    if (b.tokens >= cost) {
      b.tokens -= cost;
      return true;
    }
    return false;
  }

  retryAfterMs(key, cost = 1) {
    const b = this.#bucket(key);
    if (b.tokens >= cost) return 0;
    return (cost - b.tokens) * 1000 / this.rate;
  }
}
