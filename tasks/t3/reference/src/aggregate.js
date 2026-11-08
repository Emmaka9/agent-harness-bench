// Reference solution: RFC4180-style CSV parsing + grouped aggregation.

// Tokenize csvText into rows (arrays of string fields). A line break is LF,
// CRLF, or a lone CR; CRLF counts as one break. A line break with nothing at
// all between it and the previous one (or the start of the input) is an empty
// line and emits nothing, so the first returned row is the header. A line
// holding only `""` or only `,` is NOT empty: it is a real one-field row.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  // 0 = field start (a quote here opens a quoted section),
  // 1 = inside quotes, 2 = after the closing quote / plain field body.
  let state = 0;
  let lineHasChars = false; // anything consumed since the last line break
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
    state = 0;
  };
  const endRow = () => {
    // The pending field after a trailing comma is a real field: "a,\n"
    // yields ["a", ""]. A break with nothing consumed since the previous
    // break is an empty line and emits no row.
    endField();
    rows.push(row);
    row = [];
    lineHasChars = false;
  };

  while (i < n) {
    const ch = text[i];
    if (state === 1) {
      // Inside quotes every character, including breaks, is field content.
      lineHasChars = true;
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          state = 2; // closing quote
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (state === 0 && ch === '"') {
      state = 1; // a quote opens a quoted section only at field start
      lineHasChars = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      lineHasChars = true;
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1; // CRLF is one break
      if (lineHasChars) endRow();
      lineHasChars = false;
      i += 1;
      continue;
    }
    field += ch;
    state = 2;
    lineHasChars = true;
    i += 1;
  }
  // Final row when the input does not end with a line break. A trailing line
  // break leaves lineHasChars === false, which emits no synthetic row.
  if (lineHasChars) endRow();
  return rows;
}

function parseNumber(value) {
  const s = value.trim();
  if (s === '') return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

export function aggregate(csvText, opts) {
  const { groupCol, valueCol, ops } = opts ?? {};
  const rows = parseCsvRows(csvText ?? '');
  if (rows.length === 0) return []; // no non-empty line: there is no header row

  const header = rows[0];
  const gi = header.indexOf(groupCol);
  const vi = header.indexOf(valueCol);
  if (gi === -1 || vi === -1) return []; // requested column not in the header

  const groups = new Map(); // group value -> accumulator (insertion-ordered)
  for (const row of rows.slice(1)) {
    if (row.length !== header.length) continue; // malformed: silently skipped
    const g = row[gi];
    let acc = groups.get(g);
    if (acc === undefined) {
      acc = { count: 0, sum: 0, n: 0, min: 0, max: 0 };
      groups.set(g, acc);
    }
    acc.count += 1;
    const v = parseNumber(row[vi]);
    if (v === null) continue;
    acc.sum += v;
    acc.n += 1;
    if (acc.n === 1 || v < acc.min) acc.min = v;
    if (acc.n === 1 || v > acc.max) acc.max = v;
  }

  return [...groups].map(([g, acc]) => {
    const obj = { group: g };
    for (const op of ops) {
      if (op === 'count') obj.count = acc.count;
      else if (op === 'sum') obj.sum = acc.n > 0 ? acc.sum : 0;
      else if (op === 'min') obj.min = acc.n > 0 ? acc.min : null;
      else if (op === 'max') obj.max = acc.n > 0 ? acc.max : null;
      else if (op === 'mean') obj.mean = acc.n > 0 ? Math.round((acc.sum / acc.n) * 1000) / 1000 : null;
    }
    return obj;
  });
}
