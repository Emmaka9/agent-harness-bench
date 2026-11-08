export class TokenBucketLimiter {
  #rate;
  #burst;
  #now;
  #buckets = new Map();

  constructor(options) {
    const { rate, burst, now } = options;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new TypeError('rate must be a finite number > 0');
    }
    if (typeof burst !== 'number' || !Number.isFinite(burst) || burst <= 0) {
      throw new TypeError('burst must be a finite number > 0');
    }
    if (now !== undefined && typeof now !== 'function') {
      throw new TypeError('now must be a function or undefined');
    }
    this.#rate = rate;
    this.#burst = burst;
    this.#now = now === undefined ? Date.now : now;
  }

  #getBucket(key) {
    let bucket = this.#buckets.get(key);
    if (bucket === undefined) {
      bucket = { tokens: this.#burst, lastMs: this.#now() };
      this.#buckets.set(key, bucket);
    }
    return bucket;
  }

  #checkCost(cost) {
    if (cost > this.#burst) {
      throw new RangeError('cost exceeds burst');
    }
  }

  #refill(bucket) {
    const t = this.#now();
    const elapsed = t - bucket.lastMs;
    bucket.tokens = Math.min(this.#burst, bucket.tokens + (elapsed * this.#rate) / 1000);
    bucket.lastMs = t;
  }

  allow(key, cost = 1) {
    this.#checkCost(cost);
    const bucket = this.#getBucket(key);
    this.#refill(bucket);
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }

  retryAfterMs(key, cost = 1) {
    this.#checkCost(cost);
    const bucket = this.#buckets.get(key);
    if (bucket === undefined) return 0;
    const t = this.#now();
    const elapsed = t - bucket.lastMs;
    const tokens = Math.min(this.#burst, bucket.tokens + (elapsed * this.#rate) / 1000);
    if (tokens >= cost) return 0;
    return ((cost - tokens) * 1000) / this.#rate;
  }
}
