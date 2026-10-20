import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run, fakeCli, tmp, SECRET } from './helpers.mjs';

const state = (t, opts = {}) => JSON.parse(run('sprite-state', ['--json', ...(opts.args || [])], { home: t, ...opts }).out);

test('CLI absent', () => {
  const t = tmp();
  const s = state(t, { cwd: t });
  assert.deepEqual(s.cli, { present: false, path: null, version: null, verified: false });
  assert.equal(s.auth.source, 'none');
  assert.equal(s.auth.apiUrlOverride, true);
  assert.equal(s.project, null);
  assert.equal(s.git.head, null);
});

test('CLI present, in range and out of range', () => {
  const a = tmp(), b = tmp();
  const ok = state(a, { binDirs: [fakeCli(a)], cwd: a });
  assert.equal(ok.cli.version, '0.15.0');
  assert.equal(ok.cli.verified, true);
  const old = state(b, { binDirs: [fakeCli(b, '0.16.1')], cwd: b });
  assert.equal(old.cli.verified, false);
  assert.match(run('sprite-state', [], { home: b, binDirs: [path.join(b, 'bin')], cwd: b }).out, /outside it/);
});

test('auth: none / env / file / profile', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, '.testsprite'));
  const cred = path.join(t, '.testsprite', 'credentials');
  fs.writeFileSync(cred, `[other]\napi_key = abc\n[default]\nendpoint = x\n`);
  assert.equal(state(t, { cwd: t }).auth.source, 'none');
  assert.equal(state(t, { cwd: t, env: { TESTSPRITE_API_KEY: 'k' } }).auth.source, 'env');
  assert.equal(state(t, { cwd: t, env: { TESTSPRITE_PROFILE: 'other' } }).auth.source, 'file');
  fs.writeFileSync(cred, `[default]\napi_key = abc\n`);
  const s = state(t, { cwd: t });
  assert.equal(s.auth.source, 'file');
  assert.equal(s.auth.profile, 'default');
});

test('apiUrlOverride false when unset', () => {
  const t = tmp();
  assert.equal(state(t, { cwd: t, env: { TESTSPRITE_API_URL: undefined } }).auth.apiUrlOverride, false);
});

test('official skills present (repo and home)', () => {
  const t = tmp(), h = tmp();
  assert.equal(state(h, { cwd: t }).officialSkillsPresent, false);
  fs.mkdirSync(path.join(t, '.claude', 'skills', 'testsprite-verify'), { recursive: true });
  assert.equal(state(h, { cwd: t }).officialSkillsPresent, true);
  fs.mkdirSync(path.join(h, '.claude', 'skills', 'testsprite-ci'), { recursive: true });
  assert.equal(state(h, { cwd: h }).officialSkillsPresent, true);
});

test('nested config.json resolution, env fallback, bg tasks', () => {
  const t = tmp();
  const deep = path.join(t, 'a', 'b');
  fs.mkdirSync(deep, { recursive: true });
  fs.mkdirSync(path.join(t, 'a', '.testsprite'));
  fs.writeFileSync(path.join(t, 'a', '.testsprite', 'config.json'), '{"projectId":"p-cfg"}');
  const s = state(t, { cwd: deep, env: { TESTSPRITE_PROJECT_ID: 'p-env', CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' } });
  assert.deepEqual(s.project, { id: 'p-cfg', source: 'config', configPath: path.join(t, 'a', '.testsprite', 'config.json') });
  assert.equal(s.bgTasksDisabled, true);
  assert.deepEqual(s.linkedRoots, [path.join(t, 'a')]);
  const e = state(t, { cwd: t, env: { TESTSPRITE_PROJECT_ID: 'p-env' } });
  assert.deepEqual(e.project, { id: 'p-env', source: 'env', configPath: null });
});

test('git repo: linkedRoots, head, changedSince', () => {
  const t = tmp();
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: t, stdio: 'ignore' });
  g('init', '-q');
  fs.mkdirSync(path.join(t, 'web', '.testsprite'), { recursive: true });
  fs.writeFileSync(path.join(t, 'web', '.testsprite', 'config.json'), '{"projectId":"p1"}');
  fs.writeFileSync(path.join(t, 'x.txt'), '1');
  g('add', '.'); g('commit', '-qm', 'one');
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: t, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(t, 'y.txt'), '2');
  g('add', '.'); g('commit', '-qm', 'two');
  const s = state(t, { cwd: t, args: ['--since', base] });
  assert.deepEqual(s.linkedRoots, [path.join(t, 'web')]);
  assert.match(s.git.head, /^[0-9a-f]{40}$/);
  assert.deepEqual(s.git.changedSince, ['y.txt']);
});

// A config that git does not track (just written by init, or hidden by a global ignore of dot-directories) still links the unit.
function gitRepo(t) {
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: t, stdio: 'ignore' });
  g('init', '-q');
  fs.writeFileSync(path.join(t, 'x.txt'), '1');
  g('add', 'x.txt'); g('commit', '-qm', 'one');
  return g;
}
const writeConfig = (dir, id = 'p1') => {
  fs.mkdirSync(path.join(dir, '.testsprite'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.testsprite', 'config.json'), JSON.stringify({ projectId: id }));
};

test('git repo: an untracked config links the repo root', () => {
  const t = tmp(); gitRepo(t); writeConfig(t);
  assert.deepEqual(state(t, { cwd: t }).linkedRoots, [t]);
});

test('git repo: a gitignored config links the repo from the working directory', () => {
  const t = tmp(); const g = gitRepo(t);
  fs.writeFileSync(path.join(t, '.gitignore'), '.testsprite/\n'); g('add', '.gitignore'); g('commit', '-qm', 'ignore');
  writeConfig(t);
  assert.deepEqual(state(t, { cwd: t }).linkedRoots, [t]);
  fs.mkdirSync(path.join(t, 'src'));
  assert.deepEqual(state(t, { cwd: path.join(t, 'src') }).linkedRoots, [t]);
});

test('git repo: a symlinked spelling of the working directory does not list the unit twice', () => {
  const t = tmp(); gitRepo(t); writeConfig(t);
  const alias = path.join(tmp(), 'alias'); fs.symlinkSync(t, alias);
  assert.deepEqual(state(t, { cwd: alias }).linkedRoots, [t]);
});

test('git repo: tracked and untracked units are both linked, once each', () => {
  const t = tmp(); const g = gitRepo(t);
  writeConfig(path.join(t, 'web')); g('add', '.'); g('commit', '-qm', 'web');
  writeConfig(path.join(t, 'api'));
  const roots = state(t, { cwd: path.join(t, 'web') }).linkedRoots.sort();
  assert.deepEqual(roots, [path.join(t, 'api'), path.join(t, 'web')]);
});

test('SECRET never appears in any output', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, '.testsprite'));
  fs.writeFileSync(path.join(t, '.testsprite', 'credentials'), `[default]\napi_key = ${SECRET}\n`);
  const bin = fakeCli(t);
  for (const env of [{ TESTSPRITE_API_KEY: SECRET }, {}]) {
    const runs = [
      run('sprite-state', ['--json'], { home: t, env, binDirs: [bin], cwd: t }),
      run('sprite-state', [], { home: t, env, binDirs: [bin], cwd: t }),
      run('sprite-ref', ['version'], { home: t, env, binDirs: [bin], cwd: t }),
      run('sprite-ref', ['skill', 'verify'], { home: t, env, binDirs: [bin], cwd: t }),
      run('sprite-ref', ['help', 'bad;rm'], { home: t, env, binDirs: [bin], cwd: t }),
    ];
    for (const r of runs) assert.ok(!(r.out + r.err).includes('ts_PLANTED'), r.out + r.err);
  }
  assert.equal(state(t, { cwd: t }).auth.source, 'file');
});

test('human text is at most 8 lines', () => {
  const t = tmp();
  const r = run('sprite-state', [], { home: t, cwd: t });
  assert.ok(r.out.trim().split('\n').length <= 8);
});
