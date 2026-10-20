// Hook tests: stdin JSON in, stdout out. Every child runs with a throwaway HOME, a throwaway plugin data dir and no TestSprite credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, tmp, SECRET } from './helpers.mjs';

const hook = (name) => path.join(ROOT, 'hooks', name);

function env(extra = {}) {
  const t = tmp();
  const e = {
    HOME: t, PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
    CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PLUGIN_DATA: path.join(t, 'data'),
    TESTSPRITE_API_URL: 'http://127.0.0.1:9', TESTSPRITE_NO_TELEMETRY: '1', ...extra,
  };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  return e;
}
function runHook(cmd, args, payload, { cwd = ROOT, e = env() } = {}) {
  const r = spawnSync(cmd, args, { input: JSON.stringify(payload), cwd, env: e, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr, env: e };
}
// Through guard.sh, the entry hooks.json points at (the prefilter, then guard.mjs).
const guard = (command, extra = {}, e) => runHook('sh', [hook('guard.sh')], { hook_event_name: 'PreToolUse', tool_name: 'Bash', session_id: 's1', tool_input: { command }, ...extra }, { e });
const decision = (r) => (r.out ? JSON.parse(r.out).hookSpecificOutput.permissionDecision : 'silent');

// ---------- guard ----------
const SILENT = [
  'testsprite project list', 'testsprite test list --project p1 --output json', 'testsprite test run abc --wait', 'testsprite test run a b c --wait --env staging',
  'testsprite test create --type backend --project p --name x --code-file f.py --run --wait', 'testsprite test plan accept --project p --only prop_1 prop_2',
  'testsprite project create --type frontend --name x --url https://x.example.com --password-file ./pw', 'testsprite test run --all --dry-run', 'testsprite test create --plan-template',
  'testsprite setup --no-agent', 'testsprite setup --from-env --no-agent', 'testsprite test flaky t1 --runs 3', 'testsprite test lint --plan-from-dir ./plans',
  'testsprite ci init github --project p --env e', 'testsprite frobnicate --all', 'testsprite test run "abc', 'echo hello', 'ls -la', 'testsprite --version',
  'testsprite test artifact get r1 --out .testsprite/runs/r1', 'testsprite test run --help', 'testsprite usage', 'testsprite project docs upload spec.json --project p --role api-doc',
  'testsprite test flaky t1 --runs 2', 'testsprite test rerun --skip-terminal a b c', 'testsprite test cancel run_1', 'testsprite test open t1 --no-browser',
  'git commit -m "document the testsprite setup"', 'cat docs/testsprite.md', 'grep -rn "test run --all" docs/testsprite-notes.md',
];
const ASK = [
  'testsprite test run --all --project p --wait', 'testsprite test rerun --all --project p', 'testsprite test run a b c d', 'testsprite test create-batch --plans p.jsonl --run --wait',
  'testsprite testlist run tl1', 'testsprite ci run --project p', 'testsprite test plan generate --project p', 'testsprite test flaky t1', 'testsprite test flaky t1 --runs 10',
  'testsprite schedule create --name n --target-type project --target-id p --cron "0 3 * * *"', 'testsprite schedule update s1 --cron "0 4 * * *"',
  'testsprite project docs upload prd.md --project p --role prd', 'testsprite project delete p1 --confirm', 'testsprite test delete t1 --confirm',
  'testsprite test delete-batch t1 t2 --confirm', 'testsprite schedule delete s1 --confirm', 'testsprite project env delete p e --confirm', 'testsprite tunnel stop --all --confirm',
  'testsprite auth remove', 'testsprite test code put t --code-file f.py --expected-version v --force', 'testsprite setup', 'testsprite setup --api-key sk-x', 'testsprite agent install',
  'testsprite project env create p --name e --url https://x.example.com --username u --password hunter2', 'testsprite project credential p --type "Bearer token" --credential tok',
  'testsprite project auto-auth p --client-secret s3', 'testsprite project auto-auth p --refresh-token r', 'testsprite project env create p --name e --password=hunter2',
  'testsprite test run --all --dry-run --password x', 'cd app && FOO=1 testsprite project delete p1 --confirm', 'npx @testsprite/testsprite-cli@latest test run --all',
  'testsprite test run --all 2>&1 | tail -3', 'testsprite project list && testsprite project delete p --confirm', 'echo $(testsprite test run --all)', 'env CI=1 testsprite ci run --project p',
  // wrapper forms the `if: Bash(testsprite *)` filter never matched
  'npx -y @testsprite/testsprite-cli test run --all --project p', 'npx --yes @testsprite/testsprite-cli@latest project delete p --confirm', 'bunx @testsprite/testsprite-cli test run --all',
  './node_modules/.bin/testsprite project delete p --confirm', '/usr/local/bin/testsprite test delete t1 --confirm', 'time testsprite test run --all --project p',
  'env FOO=1 testsprite test run --all --project p', 'nohup testsprite test run --all --project p &', 'cd app && ./node_modules/.bin/testsprite ci run --project p',
  // rule fixes in 0.1.1: flaky follows the threshold, --set-secret overwrites a repo secret, a boolean flag must not eat the next id
  'testsprite test flaky t1 --runs 4', 'testsprite ci init github --project p --set-secret', 'testsprite ci init github --project p --force --set-secret',
  'testsprite test rerun --skip-terminal a b c d', 'testsprite test rerun --all --skip-terminal --project p',
];
for (const c of SILENT) test(`guard silent: ${c}`, () => { const r = guard(c); assert.equal(r.code, 0); assert.equal(decision(r), 'silent', r.out); });
for (const c of ASK) test(`guard ask: ${c}`, () => {
  const r = guard(c); assert.equal(r.code, 0);
  assert.equal(decision(r), 'ask', r.out || '(no output)');
  assert.ok(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason.startsWith('TestSprite:'));
});

test('guard never returns allow', () => {
  for (const c of [...SILENT, ...ASK]) assert.ok(!/"allow"/.test(guard(c).out), c);
});
test('guard messages carry the file-based remedy and never echo the secret', () => {
  const r = guard('testsprite project env create p --name e --password hunter2');
  const reason = JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /--password-file/);
  assert.ok(!reason.includes('hunter2'));
});
test('guard: guard=false silences asks but not the read-only agents', () => {
  const e = env({ CLAUDE_PLUGIN_OPTION_GUARD: 'false' });
  assert.equal(decision(guard('testsprite test run --all', {}, e)), 'silent');
  assert.equal(decision(guard('testsprite test rerun t1', { agent_type: 'failure-triager' }, e)), 'deny');
});
test('guard: confirm_runs_over governs flaky checks too', () => {
  const at = (n) => env({ CLAUDE_PLUGIN_OPTION_CONFIRM_RUNS_OVER: String(n) });
  assert.equal(decision(guard('testsprite test flaky t1 --runs 4', {}, at(5))), 'silent');
  assert.equal(decision(guard('testsprite test flaky t1 --runs 6', {}, at(5))), 'ask');
  assert.equal(decision(guard('testsprite test flaky t1 --runs 4', {}, at(3))), 'ask');
});
test('guard: confirm_runs_over is honored', () => {
  assert.equal(decision(guard('testsprite test run a b c d', {}, env({ CLAUDE_PLUGIN_OPTION_CONFIRM_RUNS_OVER: '5' }))), 'silent');
  assert.equal(decision(guard('testsprite test run a b c d e f', {}, env({ CLAUDE_PLUGIN_OPTION_CONFIRM_RUNS_OVER: '5' }))), 'ask');
});
for (const agent of ['failure-triager', 'coverage-auditor', 'testsprite:failure-triager']) {
  test(`guard denies non-read-only testsprite commands for ${agent}`, () => {
    for (const c of ['testsprite test rerun t1', 'testsprite project delete p --confirm', 'testsprite test run t1', 'testsprite test code put t --code-file f.py --expected-version v', 'testsprite test cancel run_1'])
      assert.equal(decision(guard(c, { agent_type: agent })), 'deny', c);
    for (const c of ['testsprite test list --project p', 'testsprite test artifact get r1 --out d', 'testsprite test failure get r1', 'testsprite test steps t --run-id r1', 'testsprite test code get t --out f.py'])
      assert.equal(decision(guard(c, { agent_type: agent })), 'silent', c);
  });
}
test('guard: other agents and the main thread are not restricted by the read-only rule', () => {
  assert.equal(decision(guard('testsprite test rerun t1', { agent_type: 'general-purpose' })), 'silent');
});
test('guard stamps run attempts into a recorded session', () => {
  const e = env();
  const f = path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 's1.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ head: null, startedAt: 1, linkedRoots: ['/x'], attempts: [] }));
  guard('testsprite test run abc --wait', {}, e);
  guard('testsprite test list', {}, e);
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).attempts.length, 1);
});
test('guard fails open on garbage input', () => {
  for (const [cmd, args] of [[process.execPath, [hook('guard.mjs')]], ['sh', [hook('guard.sh')]]]) {
    const r = spawnSync(cmd, args, { input: 'testsprite not json', env: env(), encoding: 'utf8' });
    assert.equal(r.status, 0); assert.equal(r.stdout, '');
  }
});
test('guard.sh: a command that does not mention testsprite never starts Node', () => {
  // PATH holds only `cat`: an unrelated command must exit 0 with no Node available; a testsprite command has to reach for Node and fail.
  const bin = tmp(); fs.symlinkSync('/bin/cat', path.join(bin, 'cat'));
  const noNode = { ...env(), PATH: bin };
  const payload = (command) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
  const unrelated = spawnSync('/bin/sh', [hook('guard.sh')], { input: payload('ls -la && git status'), env: noNode, encoding: 'utf8' });
  assert.equal(unrelated.status, 0); assert.equal(unrelated.stdout, '');
  const related = spawnSync('/bin/sh', [hook('guard.sh')], { input: payload('testsprite test run --all'), env: noNode, encoding: 'utf8' });
  assert.notEqual(related.status, 0, 'a testsprite command is handed to Node');
});

// ---------- session start ----------
// config: 'tracked' (committed), 'untracked' (just written, never added) or 'ignored' (hidden by .gitignore); only differs in a git repo.
function linkedDir({ git = false, config = 'tracked' } = {}) {
  const d = tmp();
  fs.mkdirSync(path.join(d, '.testsprite'));
  fs.writeFileSync(path.join(d, '.testsprite', 'config.json'), JSON.stringify({ projectId: 'proj_8f0f6' }));
  if (git) {
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    g('init', '-q'); fs.mkdirSync(path.join(d, 'src')); fs.writeFileSync(path.join(d, 'src', 'a.ts'), '1');
    if (config === 'ignored') fs.writeFileSync(path.join(d, '.gitignore'), '.testsprite/\n');
    g('add', config === 'untracked' ? 'src' : '-A'); g('commit', '-qm', 'init');
  }
  return d;
}
const sessionStart = (cwd, payload = {}, e = env()) =>
  runHook('sh', [hook('session-start.sh')], { hook_event_name: 'SessionStart', source: 'startup', session_id: 'sess1', cwd, ...payload }, { cwd, e });

test('SessionStart: unlinked repo is silent but still exports the nag opt-out once', () => {
  const d = tmp(); const envFile = path.join(d, 'envfile');
  const e = env({ CLAUDE_ENV_FILE: envFile });
  const a = sessionStart(d, {}, e); const b = sessionStart(d, { source: 'compact' }, e);
  assert.equal(a.out, ''); assert.equal(b.out, ''); assert.equal(a.code, 0);
  assert.equal(fs.readFileSync(envFile, 'utf8'), 'export TESTSPRITE_NO_SKILL_WARNING=1\n');
});
test('SessionStart: linked repo injects facts, records a baseline, never prints a key', () => {
  const d = linkedDir({ git: true });
  const e = env({ TESTSPRITE_API_KEY: SECRET });
  const r = sessionStart(d, {}, e);
  assert.equal(r.code, 0);
  const ctx = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(ctx.hookEventName, 'SessionStart');
  assert.match(ctx.additionalContext, /proj_8f0f6/);
  assert.match(ctx.additionalContext, /run_in_background/);
  assert.match(ctx.additionalContext, /API key from env/);
  assert.ok(!r.out.includes(SECRET) && !r.err.includes(SECRET));
  assert.ok(ctx.additionalContext.length < 1200, 'context stays small');
  const s = JSON.parse(fs.readFileSync(path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 'sess1.json'), 'utf8'));
  assert.ok(s.head && s.startedAt && s.linkedRoots.length === 1);
});
test('SessionStart: compact keeps the baseline and reports attempts', () => {
  const d = linkedDir({ git: true }); const e = env();
  sessionStart(d, {}, e);
  const f = path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 'sess1.json');
  const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.attempts = [{ t: 5 }]; s.startedAt = 111; fs.writeFileSync(f, JSON.stringify(s));
  const r = sessionStart(d, { source: 'compact' }, e);
  assert.match(JSON.parse(r.out).hookSpecificOutput.additionalContext, /1 TestSprite run command/);
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).startedAt, 111);
});
test('SessionStart: reports the CLI missing and duplicate official skills', () => {
  const d = linkedDir(); fs.mkdirSync(path.join(d, '.claude', 'skills', 'testsprite-verify'), { recursive: true });
  const ctx = JSON.parse(sessionStart(d).out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /CLI not found on PATH/);
  assert.match(ctx, /Official testsprite-\* skills are also installed/);
});

// ---------- stop gate ----------
function stopSetup() {
  const d = linkedDir({ git: true });
  const e = env({ CLAUDE_PLUGIN_OPTION_STOP_GATE: 'true' });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim();
  const f = path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 'sess1.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const s = { head, startedAt: Date.now() - 20000, linkedRoots: [d], attempts: [] };
  fs.writeFileSync(f, JSON.stringify(s));
  return { d, e, f, s };
}
const stop = ({ d, e }, msg = 'Done.', extra = {}) =>
  runHook('sh', [hook('stop-gate.sh')], { hook_event_name: 'Stop', session_id: 'sess1', cwd: d, last_assistant_message: msg, stop_hook_active: false, ...extra }, { cwd: d, e });
const edit = (d, rel, text = 'x') => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), text); };

test('Stop gate: blocks once for a code change with no verdict, again only for a newer change', async () => {
  const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed');
  const first = stop(x); assert.equal(JSON.parse(first.out).decision, 'block');
  assert.match(JSON.parse(first.out).reason, /proj_8f0f6/);
  assert.match(JSON.parse(first.out).reason, /unverified because/);
  assert.equal(stop(x).out, '', 'same change set does not block twice');
  await new Promise((r) => setTimeout(r, 30)); edit(x.d, 'src/b.ts', 'newer');
  assert.equal(JSON.parse(stop(x).out).decision, 'block');
});
test('Stop gate: works end to end when the config is untracked or gitignored (the state right after init)', () => {
  for (const config of ['untracked', 'ignored']) {
    const d = linkedDir({ git: true, config });
    const e = env({ CLAUDE_PLUGIN_OPTION_STOP_GATE: 'true' });
    sessionStart(d, {}, e);
    const f = path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 'sess1.json');
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(s.linkedRoots, [d], `${config}: the session records the link`);
    s.startedAt -= 20000; fs.writeFileSync(f, JSON.stringify(s));
    edit(d, 'src/a.ts', 'changed');
    const r = stop({ d, e });
    assert.equal(JSON.parse(r.out).decision, 'block', `${config}: ${r.out || '(no output)'}`);
  }
});
test('Stop gate: silent for docs-only and test-only changes', () => {
  const x = stopSetup(); edit(x.d, 'README.md'); edit(x.d, 'docs/a.md'); edit(x.d, 'src/a.test.ts'); edit(x.d, 'package-lock.json');
  assert.equal(stop(x).out, '');
});
test('Stop gate: silent when the reply carries a verdict, asks a question, or says unverified', () => {
  for (const msg of ['Done. Unverified because no credentials are configured.', 'TestSprite run r1 passed.', 'Which environment should I use?',
    'Not verified: there is no API key.', 'checkout happy path · passed. Dashboard: https://www.testsprite.com/dashboard/runs/x', 'run_8f3a2c failed on step 4.']) {
    const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed'); assert.equal(stop(x, msg).out, '', msg);
  }
});
test('Stop gate: a reply that only says typecheck or lint is "verified" still gets the nudge', () => {
  for (const msg of ['I verified the typecheck passes.', 'Done. Everything is verified.', 'Fixed it; tests pass and lint is clean.', 'Updated the TestSprite docs.']) {
    const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed'); assert.equal(JSON.parse(stop(x, msg).out).decision, 'block', msg);
  }
});
test('Stop gate: silent when a run was attempted after the last edit', () => {
  const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed');
  const s = JSON.parse(fs.readFileSync(x.f, 'utf8')); s.attempts = [{ t: Date.now() + 5000 }]; fs.writeFileSync(x.f, JSON.stringify(s));
  assert.equal(stop(x).out, '');
});
test('Stop gate: honors stop_hook_active, the option, a missing session and files outside linked roots', () => {
  const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed');
  assert.equal(stop(x, 'Done.', { stop_hook_active: true }).out, '');
  assert.equal(stop({ ...x, e: { ...x.e, CLAUDE_PLUGIN_OPTION_STOP_GATE: 'false' } }).out, '');
  assert.equal(stop({ ...x, e: { ...x.e, CLAUDE_PLUGIN_OPTION_STOP_GATE: undefined } }).out, '', 'unset means off (default false in 0.1.0)');
  assert.equal(stop(x, 'Done.', { session_id: 'other' }).out, '');
  const y = stopSetup(); const s = JSON.parse(fs.readFileSync(y.f, 'utf8')); s.linkedRoots = ['/somewhere/else']; fs.writeFileSync(y.f, JSON.stringify(s)); edit(y.d, 'src/a.ts', 'changed');
  assert.equal(stop(y).out, '');
});
test('Stop gate: non-git directory is a no-op', () => {
  const d = tmp(); const e = env({ CLAUDE_PLUGIN_OPTION_STOP_GATE: 'true' });
  const f = path.join(e.CLAUDE_PLUGIN_DATA, 'sessions', 'sess1.json'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ head: null, startedAt: 1, linkedRoots: [d], attempts: [] })); edit(d, 'src/a.ts');
  assert.equal(stop({ d, e }).out, '');
});
test('Stop gate: committed changes since the baseline count too', () => {
  const x = stopSetup(); edit(x.d, 'src/a.ts', 'committed change');
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'change'], { cwd: x.d });
  assert.equal(JSON.parse(stop(x).out).decision, 'block');
});
test('Stop gate: a tracked change is still seen when thousands of untracked files exist, and it stays fast', () => {
  const x = stopSetup(); edit(x.d, 'src/a.ts', 'changed');
  fs.mkdirSync(path.join(x.d, 'node_modules'));
  for (let i = 0; i < 3500; i++) fs.writeFileSync(path.join(x.d, 'node_modules', `f${i}.js`), 'x');
  const t0 = Date.now(); const r = stop(x); const ms = Date.now() - t0;
  assert.equal(JSON.parse(r.out).decision, 'block');
  assert.ok(ms < 2000, `took ${ms} ms`);
});
