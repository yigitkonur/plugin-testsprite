// PreToolUse guard for TestSprite commands. Escalates to `ask` or `deny`, never `allow`; silence defers to the normal permission flow.
// Anything it cannot parse is silent (fail open): this raises friction on common footguns, it is not a security boundary.
import { splitCommands, testspriteArgs } from '../lib/shell-split.mjs';
import { parseArgs, classify, isReadOnly, isRunAttempt } from '../lib/guard-rules.mjs';
import { readStdinJson, optionOn, optionNumber, readSession, writeSession } from '../lib/session.mjs';

const READ_ONLY_AGENTS = /(^|:)(failure-triager|coverage-auditor)$/;

try {
  const input = await readStdinJson();
  if (input.tool_name !== 'Bash' || typeof input.tool_input?.command !== 'string') process.exit(0);

  const calls = [];
  for (const seg of splitCommands(input.tool_input.command)) {
    const args = testspriteArgs(seg);
    if (args) calls.push(parseArgs(args));
  }
  if (!calls.length) process.exit(0);

  // Stamp run attempts so the Stop gate knows a run was tried after the last edit (only in sessions the SessionStart hook recorded).
  const session = input.session_id ? readSession(input.session_id) : null;
  if (session && calls.some(isRunAttempt)) {
    session.attempts = [...(session.attempts || []), { t: Date.now() }].slice(-50);
    writeSession(input.session_id, session);
  }

  const reasons = [];
  let decision = null;
  if (READ_ONLY_AGENTS.test(input.agent_type || '')) {
    for (const c of calls) {
      if (!isReadOnly(c) && c.path !== '') { decision = 'deny'; reasons.push(`TestSprite: \`${c.path}\` is not read-only; this agent returns findings to the caller and does not run it.`); }
    }
  }
  if (!decision && optionOn('guard', true)) {
    const threshold = optionNumber('confirm_runs_over', 3);
    for (const c of calls) for (const f of classify(c, { threshold })) { decision = 'ask'; reasons.push(f.reason); }
  }
  if (!decision) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: [...new Set(reasons)].join('\n') },
  }));
} catch {
  process.exit(0);
}
