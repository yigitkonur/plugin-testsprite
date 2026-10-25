// Update every user-, project- and local-scope install of a plugin, including the disabled ones.
//   node scripts/update-installs.mjs [plugin@marketplace]      (default: testsprite@plugin-testsprite)
// Claude Code's background auto-update only touches ENABLED plugins, so an install that is
// deliberately left off (`claude plugin disable ...`) never moves. This walks the install
// records, refreshes the marketplace once, and runs `claude plugin update` for each install.
// Enabled/disabled state is left exactly as it was. Safe to run from cron.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const id = process.argv[2] || 'testsprite@plugin-testsprite';
const market = id.split('@')[1];
const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const records = JSON.parse(fs.readFileSync(path.join(home, 'plugins', 'installed_plugins.json'), 'utf8'));
const entries = (records.plugins?.[id] || [])
  .map((e) => (e.scope === 'user' ? { ...e, projectPath: os.homedir() } : e)) // user scope has no project; run from home
  .filter((e) => e.projectPath);

const run = (args, cwd) => spawnSync('claude', args, { cwd, encoding: 'utf8', timeout: 180_000 });
const stamp = () => new Date().toISOString();

const refresh = run(['plugin', 'marketplace', 'update', market], undefined);
console.log(`${stamp()} marketplace ${market}: ${refresh.status === 0 ? 'refreshed' : 'refresh failed'}`);

let failed = 0;
let latest = '';
for (const e of entries) {
  if (!fs.existsSync(e.projectPath)) { console.log(`${stamp()} skip ${e.projectPath} (gone)`); continue; }
  const r = run(['plugin', 'update', id, '--scope', e.scope], e.projectPath);
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  const line = text.split('\n').filter((l) => /updated|already|rror|not installed/i.test(l)).pop() || `exit ${r.status}`;
  latest = (text.match(/to (\d[\w.+-]*) for scope|latest version \((\d[\w.+-]*)\)/) || []).slice(1).find(Boolean) || latest;
  if (r.status !== 0) failed += 1;
  console.log(`${stamp()} ${e.projectPath} [${e.scope}]: ${line.trim()}`);
}

// A git worktree resolves to its main checkout, so `update` there says "already latest" and leaves the
// worktree's own record behind. Reinstall such an entry and put its on/off state back.
const fresh = JSON.parse(fs.readFileSync(path.join(home, 'plugins', 'installed_plugins.json'), 'utf8')).plugins?.[id] || [];
for (const e of fresh.filter((x) => x.scope !== 'user' && x.projectPath && latest && x.version !== latest && fs.existsSync(x.projectPath))) {
  const file = path.join(e.projectPath, '.claude', e.scope === 'local' ? 'settings.local.json' : 'settings.json');
  let wasOn = true;
  try { wasOn = JSON.parse(fs.readFileSync(file, 'utf8')).enabledPlugins?.[id] !== false; } catch { /* no file: treat as on */ }
  const steps = [['uninstall', id, '--scope', e.scope], ['install', id, '--scope', e.scope], ...(wasOn ? [] : [['disable', id, '--scope', e.scope]])];
  const bad = steps.find((s) => run(['plugin', ...s], e.projectPath).status !== 0);
  if (bad) failed += 1;
  console.log(`${stamp()} ${e.projectPath} [${e.scope}]: ${bad ? `repair failed at ${bad[0]}` : `repaired ${e.version} -> ${latest}, ${wasOn ? 'enabled' : 'left disabled'}`}`);
}
process.exit(failed ? 1 : 0);
