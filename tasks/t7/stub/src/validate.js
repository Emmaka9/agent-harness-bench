// Naive, incomplete attempt at the JSON schema subset validator.
export function validateSchema(schema, value) {
  const errors = [];
  if (schema.type && typeof value !== schema.type) {
    errors.push(`invalid type at ${''}`);
  }
  if (schema.required) {
    for (const name of schema.required) {
      if (value[name] === undefined) {
        errors.push(`missing ${name}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
