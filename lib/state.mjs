// Offline state summary. Never spawns the testsprite CLI; never reads a key value into any output.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const VERIFIED_CLI = '0.15.';
const PKG = '@testsprite/testsprite-cli';

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

// Walk PATH for `testsprite`, realpath it, climb to the package.json named PKG.
// Returns { dir, version, bin } or null.
export function findCliPackage(env = process.env) {
  for (const d of (env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    const bin = path.join(d, 'testsprite');
    let real;
    try { fs.accessSync(bin, fs.constants.X_OK); real = fs.realpathSync(bin); } catch { continue; }
    for (let dir = path.dirname(real); ; dir = path.dirname(dir)) {
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg && pkg.name === PKG) return { dir, version: String(pkg.version || ''), bin };
      if (path.dirname(dir) === dir) break;
    }
  }
  return null;
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function nearestConfig(start) {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const p = path.join(dir, '.testsprite', 'config.json');
    const cfg = readJson(p);
    if (cfg && cfg.projectId) return { id: String(cfg.projectId), configPath: p };
    if (path.dirname(dir) === dir) return null;
  }
}

// Presence only: the key value is matched but never stored.
function fileHasKey(home, profile) {
  let text;
  try { text = fs.readFileSync(path.join(home, '.testsprite', 'credentials'), 'utf8'); } catch { return false; }
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const s = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (s) { section = s[1].trim(); continue; }
    if (section === profile && /^\s*(api[_-]?key|testsprite_api_key)\s*[=:]\s*\S/i.test(line)) return true;
  }
  return false;
}

const hasSkills = (dir) => {
  try { return fs.readdirSync(dir).some((n) => n.startsWith('testsprite-')); } catch { return false; }
};

export function readState(start = process.cwd(), opts = {}) {
  const env = opts.env || process.env;
  const home = env.HOME || os.homedir();
  const cwd = path.resolve(start);

  const pkg = findCliPackage(env);
  const cli = {
    present: !!pkg,
    path: pkg ? pkg.bin : null,
    version: pkg ? pkg.version : null,
    verified: !!pkg && pkg.version.startsWith(VERIFIED_CLI),
  };

  const profile = env.TESTSPRITE_PROFILE || 'default';
  const auth = {
    source: env.TESTSPRITE_API_KEY ? 'env' : fileHasKey(home, profile) ? 'file' : 'none',
    profile,
    apiUrlOverride: !!env.TESTSPRITE_API_URL,
  };

  const cfg = nearestConfig(cwd);
  const project = cfg ? { id: cfg.id, source: 'config', configPath: cfg.configPath }
    : env.TESTSPRITE_PROJECT_ID ? { id: env.TESTSPRITE_PROJECT_ID, source: 'env', configPath: null }
    : null;

  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const head = root ? git(cwd, ['rev-parse', 'HEAD']) : null;
  // A unit is linked by a config git tracks, one it has not tracked yet (init just wrote it), or the nearest one above the working
  // directory (covers a config hidden by an ignore rule, which neither listing shows).
  // Real paths, so one directory reached through a symlinked spelling (macOS /var vs /private/var) is listed once.
  const linked = new Set();
  const addUnit = (configPath) => {
    const dir = path.dirname(path.dirname(configPath));
    try { linked.add(fs.realpathSync(dir)); } catch { linked.add(dir); }
  };
  if (root) {
    for (const args of [['ls-files', '--', '*.testsprite/config.json'], ['ls-files', '-o', '--exclude-standard', '--', '*.testsprite/config.json']]) {
      for (const f of (git(root, args) || '').split('\n').filter(Boolean)) addUnit(path.join(root, f));
    }
  }
  if (cfg) addUnit(cfg.configPath);
  const linkedRoots = [...linked];

  const gitInfo = { head };
  if (opts.since && root) {
    const out = git(root, ['diff', '--name-only', `${opts.since}..HEAD`]);
    gitInfo.changedSince = out ? out.split('\n').filter(Boolean) : [];
  }

  return {
    cli, auth, project,
    officialSkillsPresent: hasSkills(path.join(root || cwd, '.claude', 'skills')) || hasSkills(path.join(home, '.claude', 'skills')),
    bgTasksDisabled: env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS === '1',
    linkedRoots,
    git: gitInfo,
  };
}

export function formatText(s) {
  const c = s.cli;
  const lines = [
    c.present ? `CLI ${c.version} at ${c.path} (verified range ${VERIFIED_CLI}x${c.verified ? '' : '; this version is outside it'}).` : 'CLI not found on PATH.',
    `Auth: ${s.auth.source === 'none' ? 'no API key' : `key from ${s.auth.source}`}, profile ${s.auth.profile}${s.auth.apiUrlOverride ? ', API URL overridden by env' : ''}.`,
    s.project ? `Project: ${s.project.id} (from ${s.project.source}${s.project.configPath ? `: ${s.project.configPath}` : ''}).` : 'Project: none resolved.',
    `Linked roots: ${s.linkedRoots.length ? s.linkedRoots.join(', ') : 'none'}.`,
    `Official testsprite skills installed: ${s.officialSkillsPresent ? 'yes' : 'no'}. Background tasks disabled: ${s.bgTasksDisabled ? 'yes' : 'no'}.`,
    `Git HEAD: ${s.git.head || 'not a repo'}.`,
  ];
  if (s.git.changedSince) lines.push(`Changed since baseline: ${s.git.changedSince.length} files.`);
  return lines.join('\n') + '\n';
}

export function main(argv) {
  let json = false, since, target;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') json = true;
    else if (argv[i] === '--since') since = argv[++i];
    else target = argv[i];
  }
  const s = readState(target || process.cwd(), { since });
  process.stdout.write(json ? JSON.stringify(s, null, 2) + '\n' : formatText(s));
}
