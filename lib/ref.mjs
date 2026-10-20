// Prints the installed CLI's own guidance, schema, help and version.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findCliPackage, VERIFIED_CLI } from './state.mjs';

const NOT_FOUND = 'testsprite CLI not found on PATH. Install: npm install -g @testsprite/testsprite-cli (Node ^20.19 || ^22.13 || >=24), or run it without installing: npx @testsprite/testsprite-cli';
const USAGE = 'usage: sprite-ref skill verify|onboard|ci | schema plan | help <command path...> | version';

const fail = (msg) => { process.stderr.write(msg + '\n'); process.exit(2); };

function locate() {
  const found = findCliPackage();
  if (found) return found;
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dir = path.join(root, '@testsprite', 'testsprite-cli');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return { dir, version: String(pkg.version || ''), bin: null };
  } catch { return null; }
}

export function main(argv) {
  const [topic, ...rest] = argv;
  const ok = (topic === 'skill' && rest.length === 1 && ['verify', 'onboard', 'ci'].includes(rest[0]))
    || (topic === 'schema' && rest.length === 1 && rest[0] === 'plan')
    || (topic === 'help' && rest.length > 0 && rest.every((w) => /^[a-z0-9-]+$/.test(w)))
    || (topic === 'version' && rest.length === 0);
  if (!ok) fail(USAGE);

  const cli = locate();
  if (!cli) fail(NOT_FOUND);

  if (topic === 'version') {
    const inRange = cli.version.startsWith(VERIFIED_CLI);
    process.stdout.write(`CLI ${cli.version}; verified range ${VERIFIED_CLI}x; ${inRange ? 'in range' : 'out of range'}\n`);
  } else if (topic === 'help') {
    const bin = cli.bin || (() => {
      const b = JSON.parse(fs.readFileSync(path.join(cli.dir, 'package.json'), 'utf8')).bin;
      return path.join(cli.dir, typeof b === 'string' ? b : b.testsprite);
    })();
    const env = { ...process.env, TESTSPRITE_NO_TELEMETRY: '1', TESTSPRITE_NO_UPDATE_NOTIFIER: '1', TESTSPRITE_NO_SKILL_WARNING: '1', NO_COLOR: '1' };
    try {
      process.stdout.write(execFileSync(bin, [...rest, '--help'], { env, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (e) {
      fail(`testsprite ${rest.join(' ')} --help failed: ${e.killed ? 'timed out after 10 s' : String(e.stderr || e.message).split('\n')[0]}`);
    }
  } else {
    const file = topic === 'skill' ? path.join('skills', `testsprite-${rest[0]}.skill.md`) : path.join('schemas', 'plan.schema.json');
    try {
      process.stdout.write(fs.readFileSync(path.join(cli.dir, file)));
    } catch { fail(`${file} not found in ${cli.dir}`); }
  }
}
