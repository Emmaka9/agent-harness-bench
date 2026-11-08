// Naive extracted validators (stub quality).

export function isEmail(s) {
  return typeof s === 'string' && s.includes('@');
}

export function isPositiveInt(n) {
  return n > 0;
}

export function isNonEmptyString(s, maxLen) {
  return typeof s === 'string' && s.length > 0 && s.length <= (maxLen ?? Infinity);
}
