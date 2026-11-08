// Reference solution: LRU + TTL cache.
export class LRUTTLCache {
  #capacity;
  #ttlMs;
  #now;
  #entries = new Map(); // key -> { value, deadline } ; Map order = recency (first = LRU, last = MRU)

  constructor(options) {
    const { capacity, ttlMs, now } = options ?? {};
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new TypeError('capacity must be an integer >= 1');
    }
    if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new TypeError('ttlMs must be a finite number >= 0');
    }
    if (now !== undefined && typeof now !== 'function') {
      throw new TypeError('now must be a function or undefined');
    }
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#now = now === undefined ? Date.now : now;
  }

  set(key, value) {
    this.#entries.delete(key); // drop old record (expired or not), re-insert as MRU
    this.#entries.set(key, { value, deadline: this.#now() + this.#ttlMs });
    while (this.#entries.size > this.#capacity) {
      const lru = this.#entries.keys().next().value;
      this.#entries.delete(lru); // eviction ignores expiry
    }
    return undefined;
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (this.#now() >= entry.deadline) {
      this.#entries.delete(key); // lazy expiry: remove on access
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry); // refresh recency
    return entry.value;
  }

  has(key) {
    const entry = this.#entries.get(key);
    if (entry === undefined) return false;
    if (this.#now() >= entry.deadline) {
      this.#entries.delete(key); // lazy expiry; recency of the rest is untouched
      return false;
    }
    return true; // no recency change
  }

  delete(key) {
    return this.#entries.delete(key); // regardless of expiry
  }

  get size() {
    const t = this.#now();
    let n = 0;
    for (const entry of this.#entries.values()) {
      if (t < entry.deadline) n++;
    }
    return n; // pure read: never mutates state
  }
}
