Mini Regex Engine

Create `src/regex.js` exporting two named ESM functions, `compile` and `matchCount`. Node.js builtins only, no external packages. ESM.

`compile(pattern)` parses the pattern and returns `{ test, exec }`, two functions on the compiled pattern:
- `test(s)` returns `true` iff the pattern matches somewhere in the subject string `s`.
- `exec(s)` returns `null` if the pattern matches nowhere, otherwise `{ index, groups }` for the leftmost match: `index` is the match's starting position and `groups` is an array whose element 0 is the full matched text and element k is the text captured by the k-th group, or `undefined` if that group did not participate in the match.

`matchCount(pattern, s)` returns the number of non-overlapping leftmost matches: after each match, scanning resumes at the end of that match; an empty match advances the scan by one character instead of looping forever.

Supported syntax:
- Any literal character except the metacharacters `\ ( ) [ ] * + ? ^ $ . |`.
- `\` escapes the next character, giving it its literal meaning (`\*`, `\(`, `\\`, ...). A backslash as the last character of the pattern is invalid.
- `.` matches any single character except `\n`.
- Quantifiers `*` (0 or more), `+` (1 or more) and `?` (0 or 1) are greedy with backtracking: the quantified body first takes as many repetitions as possible, then gives them back until the remainder matches. A quantifier applies to the preceding atom (literal, escaped character, `.`, class or group), never to an anchor, and quantifiers never stack (`a**`, `a*?` are invalid).
- Character classes `[...]`: members are single characters or inclusive ranges `a-z`; `-` is a literal dash when it is the first member or immediately before the closing `]`; `\` escapes the next character; a leading `^` negates the class, and a negated class matches `\n` like any other character not listed. A class must contain at least one member: an unescaped `]` immediately after `[` or `[^` is an error, and a reversed range such as `[z-a]` is an error.
- Anchors `^` (start of subject) and `$` (end of subject) are zero-width and refer to the whole subject, so `a^b` matches nothing.
- Groups `(...)` capture and may be quantified and alternated. Groups are numbered left to right by their opening parentheses; an inner group gets a larger number than its enclosing group. Captures reflect the last completed repetition of an enclosing quantifier. Repetition stops when the body fails or matches the empty string, and an empty iteration is not taken once the quantifier's minimum is already satisfied; captures then read as before that attempt, so `(a*)*` on `''` leaves group 1 `undefined` while `(a*)+` on `''` captures `''`.
- Alternation `|` separates alternatives, tried left to right; the reported match is the one greedy backtracking finds first, not the longest one.

`compile` throws a `TypeError` whose message is exactly `'invalid pattern: ' + reason` for an invalid pattern, with reason one of: `'unbalanced parentheses'` (a `(` without its `)` or a stray `)`), `'trailing backslash'`, `'quantifier with nothing to quantify'`, `'bad character class'`. Calling `test`, `exec` or `matchCount` with a non-string subject throws a `TypeError` with message `'subject must be a string'`.
