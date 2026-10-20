// Classifies one testsprite invocation. Returns findings; the caller decides ask / deny. Unknown commands are silent.
// Classes (docs/design/06-hooks.md): B fan-out spend, C destructive or overwrite, D secret in argv, E conflicting install.
export const DEFAULT_THRESHOLD = 3;

// Flags that take no value. Any other flag is assumed to consume the next word (fails open on a miscount).
const BOOLEAN = new Set(['--all', '--wait', '--no-wait', '--allow-empty', '--no-auto-heal', '--skip-preflight', '--no-cancel-on-interrupt',
  '--gh-output', '--dry-run', '--verbose', '--debug', '--help', '-h', '--version', '--run', '--confirm', '--force', '--no-agent', '--from-env',
  '--until-fail', '--skip-dependencies', '--pause', '--resume', '--yes', '-y', '--history', '--include-analysis', '--plan-template',
  '--no-browser', '--clear-credentials', '--set-secret']);

// Command paths, longest match wins.
const PATHS = [
  'project list', 'project get', 'project create', 'project update', 'project delete', 'project docs upload', 'project credential', 'project auto-auth',
  'project env list', 'project env get', 'project env create', 'project env update', 'project env delete', 'project env set-default',
  'project sign-in get', 'project sign-in set',
  'test list', 'test get', 'test result', 'test steps', 'test diff', 'test code get', 'test code put', 'test lint', 'test scaffold', 'test open',
  'test wait', 'test cancel', 'test failure get', 'test failure summary', 'test artifact get', 'test create', 'test create-batch', 'test update',
  'test delete', 'test delete-batch', 'test plan accept', 'test plan put', 'test plan generate', 'test run', 'test rerun', 'test flaky',
  'usage', 'doctor', 'auth status', 'auth remove', 'agent list', 'agent status', 'agent install', 'tunnel list', 'tunnel status', 'tunnel start', 'tunnel stop',
  'schedule list', 'schedule get', 'schedule run list', 'schedule create', 'schedule update', 'schedule delete',
  'testlist list', 'testlist get', 'testlist create', 'testlist update', 'testlist delete', 'testlist add', 'testlist remove', 'testlist run',
  'ci init', 'ci run', 'setup', 'completion',
];
const READ_ONLY = new Set(['project list', 'project get', 'project env list', 'project env get', 'project sign-in get', 'test list', 'test get',
  'test result', 'test steps', 'test diff', 'test code get', 'test lint', 'test scaffold', 'test open', 'test wait', 'test cancel', 'test failure get',
  'test failure summary', 'test artifact get', 'usage', 'doctor', 'auth status', 'agent list', 'agent status', 'tunnel list', 'tunnel status',
  'schedule list', 'schedule get', 'schedule run list', 'testlist list', 'testlist get', 'completion']);
const DELETES = new Set(['project delete', 'test delete', 'test delete-batch', 'schedule delete', 'testlist delete', 'project env delete', 'auth remove']);
const OVERWRITES = new Set(['setup', 'agent install', 'test code put', 'test plan put', 'ci init', 'test scaffold']);
const RUNNERS = new Set(['test run', 'test rerun', 'test create-batch', 'test create', 'ci run', 'testlist run', 'test flaky']);
const SECRET_FLAGS = new Map([
  ['--password', '--password-file'], ['--credential', '--credential-file'], ['--client-secret', '--client-secret-file'],
  ['--refresh-token', '--refresh-token-file'], ['--api-key', null],
]);

const REDIRECT = /^\d*(>>?|<)/;

// args: tokens after the program. Returns { path, positionals, flags: Map }.
export function parseArgs(args) {
  const words = [], flags = new Map();
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (REDIRECT.test(t) || t === '&') { if (/^\d*(>>?|<)$/.test(t)) i++; continue; }
    if (t.startsWith('-')) {
      const eq = t.indexOf('=');
      if (eq > 0) { flags.set(t.slice(0, eq), t.slice(eq + 1)); continue; }
      if (BOOLEAN.has(t) || i + 1 >= args.length || args[i + 1].startsWith('-')) { flags.set(t, true); continue; }
      flags.set(t, args[++i]);
      continue;
    }
    words.push(t);
  }
  let path = '';
  for (let k = words.length; k > 0; k--) {
    const cand = words.slice(0, k).join(' ');
    if (PATHS.includes(cand)) { path = cand; break; }
  }
  return { path, positionals: words.slice(path ? path.split(' ').length : 0), flags };
}

export const isRunAttempt = ({ path, flags }) =>
  RUNNERS.has(path) && (path !== 'test create' || flags.has('--run')) && (path !== 'test create-batch' || flags.has('--run'));

export function isReadOnly({ path, flags }) {
  if (flags.has('--dry-run') || flags.has('--help') || flags.has('-h') || flags.has('--version')) return true;
  if (path === 'test create' && flags.has('--plan-template')) return true;
  return path === '' ? false : READ_ONLY.has(path);
}

// Returns [{ cls, decision: 'ask', reason }]
export function classify(parsed, { threshold = DEFAULT_THRESHOLD } = {}) {
  const { path, positionals, flags } = parsed;
  const out = [];
  const add = (cls, reason) => out.push({ cls, decision: 'ask', reason });

  for (const [flag, fileForm] of SECRET_FLAGS) {
    if (flags.has(flag)) {
      add('D', `TestSprite: \`${flag}\` puts a secret on the command line, where it lands in the transcript and shell history. ` +
        (fileForm ? `Use \`${fileForm}\` with a file path instead.`
          : 'Have the user run `! testsprite setup --no-agent` (masked prompt), or export TESTSPRITE_API_KEY and use `testsprite setup --from-env --no-agent`.'));
    }
  }
  if (flags.has('--dry-run') || flags.has('--help') || flags.has('-h') || flags.has('--version')) return out;

  if (path === 'agent install' || (path === 'setup' && !flags.has('--no-agent'))) {
    add('E', 'TestSprite: this writes testsprite-verify, testsprite-onboard and testsprite-ci into .claude/skills, duplicating the guidance this plugin provides. ' +
      'Use `testsprite setup --no-agent` to configure credentials without installing skills.');
  }
  if (DELETES.has(path)) {
    add('C', `TestSprite: \`${path}\` deletes data${path === 'project delete' ? ' (cascades to sub-projects, tests and backend fixtures; there is no restore window)' : ''}. The CLI's own --confirm is satisfied by the model, so confirm with the user.`);
  } else if (path === 'tunnel stop' && flags.has('--all')) {
    add('C', 'TestSprite: `tunnel stop --all` revokes every live tunnel on the account, including ones another process owns. Confirm with the user.');
  } else if (OVERWRITES.has(path) && flags.has('--force')) {
    add('C', `TestSprite: \`${path} --force\` overwrites an existing file or bypasses a version check. Confirm with the user.`);
  }

  const ids = positionals.length;
  if ((path === 'test run' || path === 'test rerun') && (flags.has('--all') || ids > threshold)) {
    add('B', `TestSprite: \`${path}${flags.has('--all') ? ' --all' : ''}\` ${flags.has('--all') ? 'starts one billable run per test in the project' : `with ${ids} ids starts ${ids} billable runs`} ` +
      '(frontend 0.5 credit, backend 0.2). The number of tests is not known to this check. Check the balance first: `testsprite usage`. Approve to continue.');
  } else if (path === 'test create-batch' && flags.has('--run')) {
    add('B', 'TestSprite: `test create-batch --run` creates up to 50 tests and starts a billable run for each (frontend 0.5 credit). Check `testsprite usage` first.');
  } else if (path === 'testlist run' || path === 'ci run') {
    add('B', `TestSprite: \`${path}\` runs every test it targets and bills each run. Check \`testsprite usage\` and the test count first.`);
  } else if (path === 'test plan generate') {
    add('B', 'TestSprite: `test plan generate` bills per stage that runs (exploration, strategy, proposals); the amount is not published, and a frontend project with no stored test account explores public pages only and still bills.');
  } else if (path === 'test flaky') {
    const runs = Number(flags.get('--runs') ?? 5);
    if (!(runs < 5)) add('B', `TestSprite: \`test flaky\` replays ${Number.isFinite(runs) ? runs : 'several'} times, each billed like a rerun (about ${(runs * 0.5) || 2.5} credits for a frontend test). Approve to continue.`);
  } else if (path === 'schedule create' || (path === 'schedule update' && flags.has('--cron'))) {
    add('B', 'TestSprite: a schedule bills every firing like a run and is plan-gated. The CLI prints the frequency and estimated cost; confirm it with the user.');
  } else if (path === 'project docs upload' && flags.get('--role') === 'prd') {
    add('B', 'TestSprite: uploading a PRD costs 0.5 credit per document (an API spec, `--role api-doc`, is free).');
  }
  return out;
}
