// Create-time validation for the item schema:
//   name: string whose trimmed length is >= 1
//   qty:  a finite integer >= 0
//   tags: optional array of strings
// Unknown fields are ignored.

function isValidName(value) {
  return typeof value === 'string' && value.trim().length >= 1;
}

function isValidQty(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidTags(value) {
  return Array.isArray(value) && value.every((t) => typeof t === 'string');
}

export function validateCreate(doc) {
  const errors = {};
  if (!isValidName(doc?.name)) errors.name = 'invalid';
  if (!isValidQty(doc?.qty)) errors.qty = 'invalid';
  if (doc?.tags !== undefined && !isValidTags(doc.tags)) errors.tags = 'invalid';
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}
