import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SECRET = 'ts_PLANTED_SECRET_0123456789';

export const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-')));

// Fake CLI package at <t>/pkg with bin symlink in <t>/bin. Returns the bin dir.
export function fakeCli(t, version = '0.15.0') {
  const pkg = path.join(t, 'pkg', 'node_modules', '@testsprite', 'testsprite-cli');
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(pkg, 'skills'));
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@testsprite/testsprite-cli', version, bin: { testsprite: 'dist/cli.js' } }));
  fs.writeFileSync(path.join(pkg, 'dist', 'cli.js'), '#!/usr/bin/env node\nconsole.log("fake");\n', { mode: 0o755 });
  fs.writeFileSync(path.join(pkg, 'skills', 'testsprite-verify.skill.md'), '# fake verify skill\n');
  fs.mkdirSync(path.join(t, 'bin'));
  fs.symlinkSync(path.join(pkg, 'dist', 'cli.js'), path.join(t, 'bin', 'testsprite'));
  return path.join(t, 'bin');
}

// Runs a plugin bin with a hermetic env. extra overrides; undefined deletes.
export function run(bin, args, { home, binDirs = [], cwd = ROOT, env = {} } = {}) {
  const e = {
    HOME: home,
    PATH: [...binDirs, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
    TESTSPRITE_API_URL: 'http://127.0.0.1:9',
    TESTSPRITE_NO_TELEMETRY: '1',
    ...env,
  };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  const r = spawnSync(process.execPath, [path.join(ROOT, 'bin', bin), ...args], { cwd, env: e, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
