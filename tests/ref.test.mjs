import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { run, fakeCli, tmp } from './helpers.mjs';

const NOT_FOUND = 'testsprite CLI not found on PATH. Install: npm install -g @testsprite/testsprite-cli (Node ^20.19 || ^22.13 || >=24), or run it without installing: npx @testsprite/testsprite-cli\n';

test('skill verify prints the packaged file', () => {
  const t = tmp();
  const r = run('sprite-ref', ['skill', 'verify'], { home: t, binDirs: [fakeCli(t)], cwd: t });
  assert.equal(r.code, 0);
  assert.equal(r.out, '# fake verify skill\n');
});

test('missing skill file reports without stack', () => {
  const t = tmp();
  const r = run('sprite-ref', ['skill', 'ci'], { home: t, binDirs: [fakeCli(t)], cwd: t });
  assert.equal(r.code, 2);
  assert.doesNotMatch(r.err, /\n\s+at /);
});

test('version in and out of range', () => {
  const a = tmp(), b = tmp();
  assert.match(run('sprite-ref', ['version'], { home: a, binDirs: [fakeCli(a)], cwd: a }).out, /0\.15\.0.*in range/);
  assert.match(run('sprite-ref', ['version'], { home: b, binDirs: [fakeCli(b, '0.16.0')], cwd: b }).out, /out of range/);
});

test('CLI missing => exit 2 with exact message', () => {
  const t = tmp();
  // npm root -g fallback could find a real global install; point npm at an empty prefix
  const r = run('sprite-ref', ['version'], { home: t, cwd: t, env: { npm_config_prefix: t } });
  assert.equal(r.code, 2);
  assert.equal(r.err, NOT_FOUND);
});

test('unknown topic and injection are rejected with usage, exit 2', () => {
  const t = tmp();
  for (const args of [['bogus'], ['skill', 'nope'], ['help', 'test;id'], ['help', '$(id)'], ['help'], ['help', 'Test']]) {
    const r = run('sprite-ref', args, { home: t, binDirs: [fakeCli(tmp())], cwd: t });
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, /^usage: sprite-ref/);
  }
});

const REAL = process.env.TS_TEST_CLI_BIN;
test('real CLI: help equals testsprite --help, version 0.15.0', { skip: !REAL }, () => {
  const t = tmp();
  const env = { HOME: t, PATH: [REAL, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter), TESTSPRITE_NO_TELEMETRY: '1', TESTSPRITE_NO_UPDATE_NOTIFIER: '1', TESTSPRITE_NO_SKILL_WARNING: '1', NO_COLOR: '1' };
  const expected = execFileSync(path.join(REAL, 'testsprite'), ['test', 'run', '--help'], { env, encoding: 'utf8' });
  const r = run('sprite-ref', ['help', 'test', 'run'], { home: t, binDirs: [REAL], cwd: t });
  assert.equal(r.out, expected);
  assert.match(run('sprite-ref', ['version'], { home: t, binDirs: [REAL], cwd: t }).out, /0\.15\.0.*in range/);
  assert.match(run('sprite-ref', ['schema', 'plan'], { home: t, binDirs: [REAL], cwd: t }).out, /"\$schema"|"type"/);
});
