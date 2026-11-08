// Stub mini regex engine: parses and matches the easy cases, but cuts several
// corners. Not a correct implementation.

function splitTop(s, sep) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function toChars(pattern) {
  const out = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '\\') {
      out.push(pattern[i + 1]);
      i += 2;
    } else {
      out.push(pattern[i]);
      i += 1;
    }
  }
  return out;
}

export function compile(pattern) {
  // Naive validation.
  let depth = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '(') depth++;
    else if (pattern[i] === ')') depth--;
    else if (pattern[i] === '\\') i++;
  }
  if (depth !== 0) throw new TypeError('invalid pattern: unbalanced parentheses');
  if (pattern.endsWith('\\')) throw new TypeError('invalid pattern: trailing backslash');

  const alternations = splitTop(pattern, '|');

  function matchSeq(chars, i, s, pos, caps) {
    if (i === chars.length) return pos;
    const c = chars[i];
    const next = chars[i + 1];
    const isQuant = next === '*' || next === '+' || next === '?';
    if (isQuant) {
      // Greedy: consume as many as possible, no backtracking.
      let count = 0;
      let p = pos;
      while (p < s.length && charMatches(c, s[p])) {
        p++;
        count++;
      }
      if (next === '+' && count === 0) return -1;
      if (next === '?' && count > 1) return -1;
      return matchSeq(chars, i + 2, s, p, caps);
    }
    if (c === '^') {
      if (pos !== 0) return -1;
      return matchSeq(chars, i + 1, s, pos, caps);
    }
    if (c === '$') {
      if (pos !== s.length) return -1;
      return matchSeq(chars, i + 1, s, pos, caps);
    }
    if (c === '(') {
      // Treat group contents as a sub-sequence of characters; ignore nesting.
      let end = -1;
      for (let k = i + 1; k < chars.length; k++) {
        if (chars[k] === ')') {
          end = k;
          break;
        }
      }
      const inner = chars.slice(i + 1, end);
      const startPos = pos;
      const p = matchSeq(inner, 0, s, pos, caps);
      if (p === -1) return -1;
      caps.push(s.slice(startPos, p));
      return matchSeq(chars, end + 1, s, p, caps);
    }
    if (!charMatches(c, s[pos])) return -1;
    return matchSeq(chars, i + 1, s, pos + 1, caps);
  }

  function charMatches(c, ch) {
    if (c === '.') return ch !== '\n';
    if (c === '[') return true; // classes not really supported
    return c === ch;
  }

  function tryAlternations(s) {
    for (const alt of alternations) {
      const chars = toChars(alt);
      for (let start = 0; start <= s.length; start++) {
        const caps = [];
        const end = matchSeq(chars, 0, s, start, caps);
        if (end !== -1) {
          return { index: start, end, caps };
        }
      }
    }
    return null;
  }

  return {
    test(s) {
      return tryAlternations(s) !== null;
    },
    exec(s) {
      const m = tryAlternations(s);
      if (m === null) return null;
      return { index: m.index, groups: [s.slice(m.index, m.end), ...m.caps] };
    },
  };
}

export function matchCount(pattern, s) {
  const c = compile(pattern);
  let count = 0;
  let from = 0;
  for (;;) {
    const m = tryCount(c, s, from);
    if (m === null) break;
    count++;
    from = m.end > m.index ? m.end : m.index + 1;
  }
  return count;
}

function tryCount(compiled, s, from) {
  // Reuse the compiled matcher but restricted to starts >= from.
  const saved = compiled.exec;
  for (let start = from; start <= s.length; start++) {
    // No way to force a start; approximate by slicing.
    const sub = s.slice(start);
    const m = compiled.exec(sub);
    if (m !== null) {
      return { index: start + m.index, end: start + m.index + m.groups[0].length };
    }
  }
  return null;
}
