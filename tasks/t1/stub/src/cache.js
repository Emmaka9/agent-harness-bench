// Naive stub: partially wrong on purpose (no validation, strict > expiry,
// has/size ignore expiry).
export class LRUTTLCache {
  constructor(options = {}) {
    this.capacity = options.capacity;
    this.ttlMs = options.ttlMs;
    this.now = options.now || Date.now;
    this.map = new Map();
  }

  set(key, value) {
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.now() > entry.expires) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key) {
    return this.map.has(key);
  }

  delete(key) {
    return this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }
}
