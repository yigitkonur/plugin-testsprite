// Stop gate: once per change set, ask for a TestSprite verdict or an explicit "unverified because ...". Deterministic, no LLM. Fails open.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readStdinJson, readSession, writeSession } from '../lib/session.mjs';

const SKIP = [/\.mdx?$/i, /^docs\//, /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Gemfile\.lock)$/,
  /(^|\/)tsconfig[^/]*\.json$/, /(^|\/)\.(eslintrc|prettierrc)[^/]*$/, /(^|\/)(eslint|prettier|biome)\.config\./, /^\.github\//, /(^|\/)\.testsprite\//, /^\.claude\//,
  /\.(test|spec)\.[a-z]+$/, /(^|\/)(tests?|__tests__)\//];
const VERDICT = /testsprite|verified|unverified|could not run|not verified/i;

const git = (cwd, args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

try {
  const input = await readStdinJson();
  const session = readSession(input.session_id);
  if (!session || !session.linkedRoots?.length || input.stop_hook_active) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!root) process.exit(0);

  const files = new Set();
  if (session.head) for (const f of (git(root, ['diff', '--name-only', `${session.head}..HEAD`]) || '').split('\n')) if (f) files.add(f);
  for (const f of (git(root, ['ls-files', '-m', '-o', '--exclude-standard']) || '').split('\n')) {
    if (!f) continue;
    try { if (fs.statSync(path.join(root, f)).mtimeMs > session.startedAt) files.add(f); } catch { /* deleted */ }
  }

  const relevant = [...files].filter((f) => !SKIP.some((re) => re.test(f)) && session.linkedRoots.some((r) => path.join(root, f).startsWith(r + path.sep)));
  if (!relevant.length) process.exit(0);

  let newest = 0;
  for (const f of relevant) { try { newest = Math.max(newest, fs.statSync(path.join(root, f)).mtimeMs); } catch { /* deleted */ } }
  if (!newest) newest = session.startedAt;

  const msg = String(input.last_assistant_message || '');
  if ((session.attempts || []).some((a) => a.t > newest) || VERDICT.test(msg) || msg.trim().endsWith('?')) process.exit(0);
  if ((session.nagged_for || 0) >= newest) process.exit(0);

  session.nagged_for = newest;
  writeSession(input.session_id, session);

  let id = '?';
  try { id = JSON.parse(fs.readFileSync(path.join(session.linkedRoots[0], '.testsprite', 'config.json'), 'utf8')).projectId; } catch { /* keep ? */ }
  const shown = relevant.slice(0, 2).join(', ') + (relevant.length > 2 ? `, +${relevant.length - 2}` : '');
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `Files changed under linked TestSprite project ${id} (${shown}) and no TestSprite verdict is recorded. Run /testsprite:verify, or say 'unverified because <reason>' in the reply.`,
  }));
} catch {
  process.exit(0);
}
