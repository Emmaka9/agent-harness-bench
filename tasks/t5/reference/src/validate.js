// Field validation for the item schema:
//   name: string whose trimmed length is >= 1
//   qty:  a finite integer >= 0
//   tags: array of strings
// Unknown fields are ignored. `undefined` counts as "missing".

function isValidName(value) {
  return typeof value === 'string' && value.trim().length >= 1;
}

function isValidQty(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidTags(value) {
  return Array.isArray(value) && value.every((t) => typeof t === 'string');
}

export const validators = {
  name: isValidName,
  qty: isValidQty,
  tags: isValidTags,
};

export function validateCreate(doc) {
  const errors = {};
  if (!validators.name(doc?.name)) errors.name = 'invalid';
  if (!validators.qty(doc?.qty)) errors.qty = 'invalid';
  if (doc?.tags !== undefined && !validators.tags(doc.tags)) errors.tags = 'invalid';
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}
