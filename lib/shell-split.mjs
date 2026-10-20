// Best-effort shell splitting for the guard. Not a parser: anything odd throws and the caller fails open.
// Splits on ; & | newline ( ) and backticks (so $(...) bodies become their own segments), honors quotes and backslashes.
export function splitCommands(cmd) {
  const segs = [];
  let toks = [], cur = '', has = false, q = null;
  const endTok = () => { if (has) toks.push(cur); cur = ''; has = false; };
  const endSeg = () => { endTok(); if (toks.length) segs.push(toks); toks = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; else cur += c; continue; }
    if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && i + 1 < cmd.length) cur += cmd[++i];
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < cmd.length) { cur += cmd[++i]; has = true; continue; }
    if (c === '#' && !has) { while (i < cmd.length && cmd[i] !== '\n') i++; endSeg(); continue; }
    if (c === ' ' || c === '\t') { endTok(); continue; }
    if (c === '&' && (cmd[i - 1] === '>' || cmd[i - 1] === '<')) { while (/[0-9-]/.test(cmd[i + 1] || '')) i++; continue; }   // 2>&1
    if (';&|\n()`'.includes(c)) { endSeg(); continue; }
    cur += c; has = true;
  }
  if (q) throw new Error('unbalanced quote');
  endSeg();
  return segs;
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const WRAPPERS = new Set(['env', 'command', 'time', 'nohup', 'exec', 'builtin']);

// Returns the tokens after the testsprite program in a segment, or null when the segment is not a testsprite call.
export function testspriteArgs(seg) {
  let i = 0;
  while (i < seg.length && (ASSIGN.test(seg[i]) || WRAPPERS.has(seg[i]) || (seg[i].startsWith('-') && i > 0 && WRAPPERS.has(seg[0])))) i++;
  if (i >= seg.length) return null;
  const base = seg[i].split('/').pop();
  if (base === 'testsprite') return seg.slice(i + 1);
  if (base === 'npx' || base === 'bunx') {
    for (let j = i + 1; j < seg.length; j++) {
      if (seg[j].startsWith('@testsprite/testsprite-cli')) return seg.slice(j + 1);
      if (!seg[j].startsWith('-')) return null;
    }
  }
  return null;
}
