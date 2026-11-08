// Minimal EventEmitter-like Bus. Exported API: class Bus.
export class Bus {
  constructor() {
    this._handlers = new Map();
  }

  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return this;
  }

  off(type, handler) {
    const set = this._handlers.get(type);
    if (set) set.delete(handler);
    return this;
  }

  emit(type, payload) {
    const set = this._handlers.get(type);
    if (!set || set.size === 0) return 0;
    let n = 0;
    for (const handler of [...set]) {
      handler(payload);
      n++;
    }
    return n;
  }

  listenerCount(type) {
    const set = this._handlers.get(type);
    return set ? set.size : 0;
  }
}
