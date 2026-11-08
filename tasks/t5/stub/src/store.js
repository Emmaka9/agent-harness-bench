// In-memory document store (naive version).

export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class Store {
  constructor() {
    this.docs = new Map();
    this.nextId = 1;
  }

  create(doc) {
    const id = String(this.nextId++);
    const stored = Object.assign({ id }, doc);
    this.docs.set(id, stored);
    return stored;
  }

  get(id) {
    const doc = this.docs.get(id);
    return doc === undefined ? null : doc;
  }

  list() {
    return Array.from(this.docs.values());
  }

  delete(id) {
    if (!this.docs.has(id)) {
      throw new NotFoundError(`no such id: ${id}`);
    }
    this.docs.delete(id);
    return true;
  }

  // Naive: mutates the stored object in place and overwrites with undefined.
  update(id, patch) {
    if (!this.docs.has(id)) {
      throw new NotFoundError(`no such id: ${id}`);
    }
    const doc = this.docs.get(id);
    Object.assign(doc, patch);
    return doc;
  }
}
