// Per-session state shared by the three hooks, kept under ${CLAUDE_PLUGIN_DATA}/sessions/<session_id>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Claude Code sets CLAUDE_PLUGIN_DATA, Codex PLUGIN_DATA; either host may be absent in tests.
const dataDir = (env) => env.CLAUDE_PLUGIN_DATA || env.PLUGIN_DATA || path.join(os.tmpdir(), 'testsprite-plugin-data');
export const sessionFile = (id, env = process.env) =>
  path.join(dataDir(env), 'sessions', `${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);

export function readSession(id, env = process.env) {
  try { return JSON.parse(fs.readFileSync(sessionFile(id, env), 'utf8')); } catch { return null; }
}

export function writeSession(id, obj, env = process.env) {
  const f = sessionFile(id, env);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(obj));
  fs.renameSync(`${f}.tmp`, f);
}

export function pruneSessions(env = process.env, days = 14) {
  const dir = path.dirname(sessionFile('x', env));
  try {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      if (Date.now() - fs.statSync(p).mtimeMs > days * 864e5) fs.unlinkSync(p);
    }
  } catch { /* nothing to prune */ }
}

export const codex = process.argv.includes('--host=codex');

// userConfig values reach hooks as CLAUDE_PLUGIN_OPTION_<KEY>; Codex has no plugin settings, so TESTSPRITE_<KEY> is the same switch.
const opt = (name, env) => env[`CLAUDE_PLUGIN_OPTION_${name.toUpperCase()}`] || env[`TESTSPRITE_${name.toUpperCase()}`];
export function optionOn(name, fallback, env = process.env) {
  const v = opt(name, env);
  return v == null || v === '' ? fallback : !/^(false|0|no|off)$/i.test(v);
}
export function optionNumber(name, fallback, env = process.env) {
  const n = Number(opt(name, env));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export async function readStdinJson() {
  let s = '';
  for await (const c of process.stdin) s += c;
  return JSON.parse(s);
}
