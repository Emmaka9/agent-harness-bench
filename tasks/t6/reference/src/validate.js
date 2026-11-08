// Shared validators extracted from src/orders.js and src/users.js.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(s) {
  return typeof s === 'string' && EMAIL_RE.test(s);
}

export function isPositiveInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

export function isNonEmptyString(s, maxLen) {
  return (
    typeof s === 'string' &&
    s.length >= 1 &&
    (maxLen === undefined || s.length <= maxLen)
  );
}
