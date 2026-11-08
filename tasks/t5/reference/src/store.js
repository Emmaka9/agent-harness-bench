// In-memory document store.
// Documents are plain objects; `create` assigns a string id and stores
// `{id, ...doc}`. `update` is copy-on-write: it never mutates the
// previously stored object, so earlier snapshots stay intact.

export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class Store {
  constructor() {
    this.docs = new Map(); // id -> doc
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

  update(id, patch) {
    if (!this.docs.has(id)) {
      throw new NotFoundError(`no such id: ${id}`);
    }
    const current = this.docs.get(id);
    const next = Object.assign({}, current);
    for (const key of Object.keys(patch)) {
      if (key === 'id') continue; // a patch can never change the id
      if (patch[key] === undefined) continue; // undefined does not overwrite
      next[key] = patch[key];
    }
    this.docs.set(id, next);
    return next;
  }
}
