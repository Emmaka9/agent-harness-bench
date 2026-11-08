function isObjectValue(v) {
  return v !== null && !Array.isArray(v) && typeof v === 'object';
}

function typeMatches(type, v) {
  switch (type) {
    case 'object':
      return isObjectValue(v);
    case 'array':
      return Array.isArray(v);
    case 'string':
      return typeof v === 'string';
    case 'boolean':
      return typeof v === 'boolean';
    case 'number':
      return typeof v === 'number' && !Number.isNaN(v);
    case 'null':
      return v === null;
    default:
      return true;
  }
}

// Structural equality used by `enum`: primitives (incl. null) via Object.is,
// arrays elementwise with equal length, objects with equal own key sets.
function structurallyEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!structurallyEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isObjectValue(a) && isObjectValue(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.hasOwn(b, k)) return false;
      if (!structurallyEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

function childPath(path, key) {
  return path === '' ? key : `${path}.${key}`;
}

function visit(schema, value, path, errors) {
  if (Object.hasOwn(schema, 'type')) {
    if (!typeMatches(schema.type, value)) {
      errors.push(`${path}: expected ${schema.type}`);
    }
  }

  if (isObjectValue(value)) {
    if (Array.isArray(schema.required)) {
      for (const name of schema.required) {
        if (!Object.hasOwn(value, name)) {
          errors.push(`${path}: missing required property "${name}"`);
        }
      }
    }
    if (schema.properties !== null && typeof schema.properties === 'object') {
      for (const key of Object.keys(schema.properties)) {
        if (Object.hasOwn(value, key)) {
          visit(schema.properties[key], value[key], childPath(path, key), errors);
        }
      }
    }
  }

  if (Array.isArray(value) && Object.hasOwn(schema, 'items')) {
    for (let i = 0; i < value.length; i++) {
      visit(schema.items, value[i], `${path}[${i}]`, errors);
    }
  }

  if (Object.hasOwn(schema, 'enum') && Array.isArray(schema.enum)) {
    let found = false;
    for (const candidate of schema.enum) {
      if (structurallyEqual(candidate, value)) {
        found = true;
        break;
      }
    }
    if (!found) {
      errors.push(`${path}: value not in enum`);
    }
  }
}

export function validateSchema(schema, value) {
  const errors = [];
  visit(schema, value, '', errors);
  return { ok: errors.length === 0, errors };
}
