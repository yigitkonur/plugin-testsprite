// Next-version bump for a Claude Code plugin repo. Zero dependencies.
//   node scripts/release.mjs [--bump auto|patch|minor|major] [--force] [--dry-run]
// Prints key=value lines (released, version, tag, previous, bump) for $GITHUB_OUTPUT.
// Installers gate updates on the computed version, so a shipped change that does not
// change `version` never reaches anyone. This script is the only thing that bumps it.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SHIPPED = ['skills', 'agents', 'hooks', 'bin', 'lib'];
const PLUGIN = '.claude-plugin/plugin.json';
const MARKET = '.claude-plugin/marketplace.json';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const bumpArg = opt('--bump', 'auto');
const force = flag('--force');
const dry = flag('--dry-run');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const out = (k, v) => console.log(`${k}=${v}`);

const plugin = JSON.parse(fs.readFileSync(PLUGIN, 'utf8'));
const name = plugin.name;
const current = plugin.version;
const prefix = `${name}--v`;

const tags = git('tag', '--list', `${prefix}*`, '--sort=-v:refname').split('\n').filter(Boolean);
const previous = tags[0] || '';
const range = previous ? `${previous}..HEAD` : 'HEAD';

const changed = git('diff', '--name-only', ...(previous ? [previous, 'HEAD'] : ['--root', 'HEAD']), '--', ...SHIPPED)
  .split('\n').filter(Boolean);
if (!changed.length && !force) {
  console.error(`nothing to release: no change under ${SHIPPED.join(', ')} since ${previous || 'the start'}`);
  out('released', 'false');
  process.exit(0);
}

const subjects = git('log', '--no-merges', '--format=%h%x09%s', range).split('\n').filter(Boolean)
  .map((l) => l.split('\t')).filter(([, s]) => !/^chore\(release\)/.test(s));
const bodies = git('log', '--no-merges', '--format=%B', range);

let bump = bumpArg;
if (bump === 'auto') {
  const breaking = /BREAKING CHANGE/.test(bodies) || subjects.some(([, s]) => /^\w+(\([^)]*\))?!:/.test(s));
  const feat = subjects.some(([, s]) => /^feat(\([^)]*\))?:/.test(s));
  bump = breaking ? 'major' : feat ? 'minor' : 'patch';
}
let [maj, min, pat] = current.split('.').map(Number);
if (bump === 'major' && maj === 0) bump = 'minor'; // 0.x: a breaking change is a minor, never a surprise 1.0.0
if (bump === 'major') { maj += 1; min = 0; pat = 0; }
else if (bump === 'minor') { min += 1; pat = 0; }
else pat += 1;
const next = `${maj}.${min}.${pat}`;

// Rewrite the exact old string so the hand-formatted JSON keeps its layout.
const swap = (file, expected) => {
  const text = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`("version"\\s*:\\s*)"${current.replace(/\./g, '\\.')}"`, 'g');
  const n = (text.match(re) || []).length;
  if (n !== expected) throw new Error(`${file}: expected ${expected} "version": "${current}", found ${n}`);
  if (!dry) fs.writeFileSync(file, text.replace(re, `$1"${next}"`));
};
swap(PLUGIN, 1);
swap(MARKET, 2); // metadata.version and the plugin entry

if (!dry) {
  const m = JSON.parse(fs.readFileSync(MARKET, 'utf8'));
  const entry = m.plugins.find((p) => p.name === name);
  const seen = [JSON.parse(fs.readFileSync(PLUGIN, 'utf8')).version, m.metadata?.version, entry?.version];
  if (seen.some((v) => v !== next)) throw new Error(`manifests disagree after bump: ${seen.join(' / ')}`);

  const log = fs.readFileSync('CHANGELOG.md', 'utf8');
  if (!new RegExp(`^## ${next.replace(/\./g, '\\.')}\\b`, 'm').test(log)) { // a hand-written entry wins
    const lines = subjects.length
      ? subjects.map(([h, s]) => `- ${s} (${h})`).join('\n')
      : '- Automated release; no functional change.';
    fs.writeFileSync('CHANGELOG.md', log.replace(/^# Changelog\n\n/, `# Changelog\n\n## ${next}\n\n${lines}\n\n`));
  }
}

out('released', 'true');
out('version', next);
out('tag', `${prefix}${next}`);
out('previous', previous || 'none');
out('bump', bump);
