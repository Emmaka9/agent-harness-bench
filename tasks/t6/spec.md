Extract Validation Utility

You are given a mini-repo where `src/orders.js` and `src/users.js` each contain
their own near-duplicate validation helpers (email format, positive integer id,
non-empty string with a length cap). Extract the shared validators into a new
module `src/validate.js` and rewrite both call-site modules to use it, keeping
their public behavior byte-for-byte identical. Node.js builtins only, no
external packages. ESM. Do not modify the exported APIs of `src/orders.js`
(`createOrder`, `getOrder`, `orderCount`) or `src/users.js`
(`registerUser`, `getUser`, `userCount`).

`src/validate.js` must export exactly these three named functions (each declared with
`export function`) and nothing else:

- `isEmail(s)`: true iff `s` is a string that matches
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (at least one non-whitespace, non-`@`
  character before and after the `@`, and a dot plus more non-whitespace/non-`@`
  characters after it). Anything that is not a string is false.
- `isPositiveInt(n)`: true iff `n` is a number, an integer (`Number.isInteger`),
  and `> 0`. So `0`, `-1`, `1.5`, `NaN`, `Infinity`, `'3'`, `null`, and
  `undefined` are all false.
- `isNonEmptyString(s, maxLen)`: true iff `s` is a string with length >= 1 and,
  when `maxLen` is provided (`!== undefined`), length <= `maxLen`. Whitespace
  is not trimmed: `' '` has length 1 and is true. `''` is false; non-strings
  are false. A string longer than `maxLen` is false.

After the refactor, `src/orders.js` and `src/users.js` must contain no
duplicated validation logic: no email regex and no inline length/type checks of
their own; they import and call the validators from `src/validate.js`. The
validators must be the single implementation used by both modules. Preserve all
current behavior exactly:

- `createOrder(user, email, qty)` still throws `TypeError` when `user` is not a
  non-empty string of length <= 40, when `email` fails `isEmail`, or when `qty`
  fails `isPositiveInt`, in that order, and otherwise behaves exactly as now.
- `registerUser(name, email)` still throws `TypeError` when `name` is not a
  non-empty string of length <= 20 or when `email` fails `isEmail`, in that
  order, and otherwise behaves exactly as now.
- `getOrder(id)` / `getUser(id)` return the stored record or `null`;
  `orderCount()` / `userCount()` return the number of stored records; the
  stored record shapes and the id assignment (both counters start at 1 and
  increment per successful create) are unchanged.
