// Reference solution: mini regex engine.

const QUANT_CHARS = ['*', '+', '?'];

function quantError() {
  return new TypeError('invalid pattern: quantifier with nothing to quantify');
}

// ---------------- parser ----------------

// Produces { node, groupCount } or throws TypeError('invalid pattern: ' + reason).
function parse(pattern) {
  if (typeof pattern !== 'string') {
    throw new TypeError('invalid pattern: pattern must be a string');
  }
  let i = 0;
  let groupCounter = 0;

  const peek = () => (i < pattern.length ? pattern[i] : undefined);

  function parseAlternation() {
    const options = [parseConcat()];
    while (peek() === '|') {
      i++;
      options.push(parseConcat());
    }
    if (options.length === 1) return options[0];
    return { type: 'alt', options };
  }

  function parseConcat() {
    const items = [];
    for (;;) {
      const c = peek();
      if (c === undefined || c === ')' || c === '|') break;
      items.push(parsePiece());
    }
    if (items.length === 0) return { type: 'empty' };
    if (items.length === 1) return items[0];
    return { type: 'seq', items };
  }

  function parsePiece() {
    const c = pattern[i];
    if (c === '*' || c === '+' || c === '?') throw quantError();

    let atom;
    if (c === '^') {
      i++;
      atom = { type: 'anchor', anchor: 'start' };
    } else if (c === '$') {
      i++;
      atom = { type: 'anchor', anchor: 'end' };
    } else if (c === '(') {
      i++;
      const index = ++groupCounter;
      const inner = parseAlternation();
      if (peek() !== ')') throw new TypeError('invalid pattern: unbalanced parentheses');
      i++;
      atom = { type: 'group', index, node: inner };
    } else if (c === '[') {
      i++;
      atom = parseClass();
    } else if (c === '.') {
      i++;
      atom = { type: 'dot' };
    } else if (c === '\\') {
      i++;
      if (i >= pattern.length) throw new TypeError('invalid pattern: trailing backslash');
      atom = { type: 'literal', char: pattern[i] };
      i++;
    } else {
      atom = { type: 'literal', char: c };
      i++;
    }

    const q = pattern[i];
    if (q === '*' || q === '+' || q === '?') {
      if (atom.type === 'anchor') throw quantError();
      i++;
      if (QUANT_CHARS.includes(pattern[i])) throw quantError();
      const min = q === '+' ? 1 : 0;
      const max = q === '?' ? 1 : Infinity;
      return { type: 'rep', child: atom, min, max };
    }
    return atom;
  }

  // pattern[i] is just past '['. Returns a class node.
  function parseClass() {
    let negated = false;
    if (pattern[i] === '^') {
      negated = true;
      i++;
    }
    const members = []; // { lo, hi } inclusive code-unit ranges
    let count = 0;
    for (;;) {
      if (i >= pattern.length) throw new TypeError('invalid pattern: bad character class');
      let lo;
      if (pattern[i] === '\\') {
        i++;
        if (i >= pattern.length) throw new TypeError('invalid pattern: trailing backslash');
        lo = pattern[i];
        i++;
      } else if (pattern[i] === ']') {
        if (count === 0) throw new TypeError('invalid pattern: bad character class');
        i++;
        break;
      } else {
        lo = pattern[i];
        i++;
      }
      if (pattern[i] === '-' && i + 1 < pattern.length && pattern[i + 1] !== ']') {
        i++; // consume '-'
        let hi;
        if (pattern[i] === '\\') {
          i++;
          if (i >= pattern.length) throw new TypeError('invalid pattern: trailing backslash');
          hi = pattern[i];
          i++;
        } else {
          hi = pattern[i];
          i++;
        }
        if (lo.charCodeAt(0) > hi.charCodeAt(0)) {
          throw new TypeError('invalid pattern: bad character class');
        }
        members.push({ lo: lo.charCodeAt(0), hi: hi.charCodeAt(0) });
      } else {
        members.push({ lo: lo.charCodeAt(0), hi: lo.charCodeAt(0) });
      }
      count++;
    }
    return { type: 'class', negated, members };
  }

  const node = parseAlternation();
  if (peek() === ')') throw new TypeError('invalid pattern: unbalanced parentheses');
  attachResetRanges(node);
  return { node, groupCount: groupCounter };
}

// Group-index range [lo, hi] covered by a node's subtree (inclusive; empty range = lo > hi).
function groupRange(node) {
  switch (node.type) {
    case 'group': {
      const [lo, hi] = groupRange(node.node);
      return [Math.min(lo, node.index), Math.max(hi, node.index)];
    }
    case 'seq': {
      let lo = Infinity;
      let hi = -Infinity;
      for (const item of node.items) {
        const [l, h] = groupRange(item);
        lo = Math.min(lo, l);
        hi = Math.max(hi, h);
      }
      return [lo, hi];
    }
    case 'alt': {
      let lo = Infinity;
      let hi = -Infinity;
      for (const opt of node.options) {
        const [l, h] = groupRange(opt);
        lo = Math.min(lo, l);
        hi = Math.max(hi, h);
      }
      return [lo, hi];
    }
    case 'rep':
      return groupRange(node.child);
    default:
      return [Infinity, -Infinity];
  }
}

// Store on every rep node the group range that must be reset before a new iteration.
function attachResetRanges(node) {
  switch (node.type) {
    case 'rep': {
      const [lo, hi] = groupRange(node.child);
      node.resetLo = lo;
      node.resetHi = hi;
      attachResetRanges(node.child);
      return;
    }
    case 'seq':
      for (const item of node.items) attachResetRanges(item);
      return;
    case 'alt':
      for (const opt of node.options) attachResetRanges(opt);
      return;
    case 'group':
      attachResetRanges(node.node);
      return;
    default:
      return;
  }
}

// ---------------- matcher ----------------

function matchNode(node, s, pos, caps, cont) {
  switch (node.type) {
    case 'empty':
      return cont(pos);
    case 'literal':
      return pos < s.length && s[pos] === node.char ? cont(pos + 1) : false;
    case 'dot':
      return pos < s.length && s[pos] !== '\n' ? cont(pos + 1) : false;
    case 'class': {
      if (pos >= s.length) return false;
      const code = s.charCodeAt(pos);
      let inside = false;
      for (const m of node.members) {
        if (code >= m.lo && code <= m.hi) {
          inside = true;
          break;
        }
      }
      if (inside === node.negated) return false;
      return cont(pos + 1);
    }
    case 'anchor':
      if (node.anchor === 'start' ? pos !== 0 : pos !== s.length) return false;
      return cont(pos);
    case 'seq': {
      const items = node.items;
      const run = (k, p) =>
        k === items.length ? cont(p) : matchNode(items[k], s, p, caps, (p2) => run(k + 1, p2));
      return run(0, pos);
    }
    case 'alt': {
      for (const opt of node.options) {
        if (matchNode(opt, s, pos, caps, cont)) return true;
      }
      return false;
    }
    case 'group': {
      const idx = node.index;
      const start = pos;
      const old = caps[idx];
      const ok = matchNode(node.node, s, pos, caps, (end) => {
        const prev = caps[idx];
        caps[idx] = [start, end];
        if (cont(end)) return true;
        caps[idx] = prev;
        return false;
      });
      if (!ok) caps[idx] = old;
      return ok;
    }
    case 'rep': {
      const { min, max, child } = node;
      const reset = (capsArr) => {
        if (node.resetLo <= node.resetHi) {
          for (let k = node.resetLo; k <= node.resetHi; k++) capsArr[k] = undefined;
        }
      };
      // needMin: how many more iterations the minimum still requires.
      const rep = (needMin, count, p) => {
        if (count < max) {
          const snapshot = caps.slice();
          reset(caps);
          const advanced = matchNode(child, s, p, caps, (np) => {
            if (np === p && needMin === 0) {
              // Zero-width iteration once the minimum is met: rejected, captures rolled back.
              caps.splice(0, caps.length, ...snapshot);
              return false;
            }
            return rep(Math.max(0, needMin - 1), count + 1, np);
          });
          if (advanced) return true;
          caps.splice(0, caps.length, ...snapshot);
        }
        return needMin === 0 ? cont(p) : false;
      };
      return rep(min, 0, pos);
    }
    default:
      throw new Error('unreachable');
  }
}

// Leftmost match starting at an index >= from; anchors are relative to s itself.
function search(node, groupCount, s, from) {
  for (let start = from; start <= s.length; start++) {
    const caps = new Array(groupCount + 1).fill(undefined);
    let end = -1;
    if (matchNode(node, s, start, caps, (e) => { end = e; return true; })) {
      return { index: start, end, caps };
    }
  }
  return null;
}

function requireSubject(s) {
  if (typeof s !== 'string') {
    throw new TypeError('subject must be a string');
  }
}

// ---------------- public API ----------------

export function compile(pattern) {
  const { node, groupCount } = parse(pattern);

  const exec = (s) => {
    requireSubject(s);
    const m = search(node, groupCount, s, 0);
    if (m === null) return null;
    const groups = new Array(groupCount + 1);
    groups[0] = s.slice(m.index, m.end);
    for (let k = 1; k <= groupCount; k++) {
      const cap = m.caps[k];
      groups[k] = cap === undefined ? undefined : s.slice(cap[0], cap[1]);
    }
    return { index: m.index, groups };
  };

  const test = (s) => {
    requireSubject(s);
    return search(node, groupCount, s, 0) !== null;
  };

  return { test, exec };
}

export function matchCount(pattern, s) {
  const { node, groupCount } = parse(pattern);
  requireSubject(s);
  let count = 0;
  let from = 0;
  for (;;) {
    const m = search(node, groupCount, s, from);
    if (m === null) break;
    count++;
    from = m.end > m.index ? m.end : m.index + 1;
  }
  return count;
}
