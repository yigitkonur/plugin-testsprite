// PreToolUse guard for TestSprite commands. Escalates to `ask` or `deny`; silence defers to the normal permission flow.
// The one `allow` it ever returns is for a read it can vouch for end to end (isStrictRead): one command, no shell syntax, a read-only path.
// Anything it cannot parse is silent (fail open): this raises friction on common footguns, it is not a security boundary.
import { splitCommands, testspriteArgs } from '../lib/shell-split.mjs';
import { parseArgs, classify, isReadOnly, isRunAttempt, isStrictRead } from '../lib/guard-rules.mjs';
import { readStdinJson, optionOn, optionNumber, readSession, writeSession, codex } from '../lib/session.mjs';

const READ_ONLY_AGENTS = /(^|:)(failure-triager|coverage-auditor)$/;
const FIRST_RUN = 'TestSprite: first billable run in this session (about 0.5 credit for a frontend test, 0.2 for a backend rerun). Say what it tests and approve to continue.';
const nthRun = (n) => `TestSprite: billable run ${n} in this session. Check \`testsprite usage\` and confirm it is still the run you mean before spending more.`;

// Returns { decision, reason } or null (silent).
function decide(input, raw, calls) {
  const guardOn = optionOn('guard', true);
  const reasons = [];
  let decision = null;
  if (READ_ONLY_AGENTS.test(input.agent_type || '')) {
    for (const c of calls) {
      if (!isReadOnly(c) && c.path !== '') { decision = 'deny'; reasons.push(`TestSprite: \`${c.path}\` is not read-only; this agent returns findings to the caller and does not run it.`); }
    }
  }

  // Count run attempts per session (only in sessions the SessionStart hook recorded). The Stop gate reads the stamps;
  // the first run and every fifth ask the user, so a fix-and-rerun loop cannot spend silently.
  const runs = calls.filter(isRunAttempt).length;
  const session = !decision && runs && input.session_id ? readSession(input.session_id) : null;
  let consentAt = 0;
  if (session) {
    const before = session.runCount ?? (session.attempts || []).length;
    session.runCount = before + runs;
    session.attempts = [...(session.attempts || []), { t: Date.now() }].slice(-50);
    writeSession(input.session_id, session);
    for (let k = 1; k <= runs && !consentAt; k++) if (before + k === 1 || (before + k) % 5 === 0) consentAt = before + k;
  }

  if (!decision && guardOn) {
    const threshold = optionNumber('confirm_runs_over', 3);
    for (const c of calls) for (const f of classify(c, { threshold })) { decision = 'ask'; reasons.push(f.reason); }
    if (consentAt) { decision = 'ask'; reasons.push(consentAt === 1 ? FIRST_RUN : nthRun(consentAt)); }
  }
  if (decision) return { decision, reason: [...new Set(reasons)].join('\n') };
  if (guardOn && calls.length === 1 && isStrictRead(raw, input.cwd)) return { decision: 'allow', reason: 'TestSprite plugin: a single read-only command with no shell syntax.' };
  return null;
}

try {
  const input = await readStdinJson();
  if (input.tool_name !== 'Bash' || typeof input.tool_input?.command !== 'string') process.exit(0);
  const raw = input.tool_input.command;

  const calls = [];
  for (const seg of splitCommands(raw)) {
    const args = testspriteArgs(seg);
    if (args) calls.push(parseArgs(args));
  }
  // No testsprite call: only the plugin's own helpers (sprite-state, sprite-detect, sprite-ref) can still earn an allow.
  let out = calls.length ? decide(input, raw, calls)
    : optionOn('guard', true) && isStrictRead(raw, input.cwd) ? { decision: 'allow', reason: 'TestSprite plugin: a single read-only helper command with no shell syntax.' } : null;
  // Codex rejects `ask` ("unsupported permissionDecision:ask", then runs the command) and has no use for our `allow`.
  // So there an ask becomes a deny that tells the model to get the user's yes and rerun with TESTSPRITE_CONFIRMED=1 in front.
  if (out && codex) {
    if (out.decision === 'allow' || (out.decision === 'ask' && /(^|[\s;&|(])TESTSPRITE_CONFIRMED=1\s/.test(raw))) out = null;
    else if (out.decision === 'ask') out = { decision: 'deny', reason: `${out.reason}\nAsk the user to confirm. On a yes, rerun the same command with TESTSPRITE_CONFIRMED=1 in front of it.` };
  }
  if (out) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: out.decision, permissionDecisionReason: out.reason } }));
} catch {
  process.exit(0);
}
