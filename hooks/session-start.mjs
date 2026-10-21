// SessionStart: records the session baseline and injects a few facts when the repo is linked. Fails open.
import fs from 'node:fs';
import path from 'node:path';
import { readState, VERIFIED_CLI } from '../lib/state.mjs';
import { readStdinJson, readSession, writeSession, pruneSessions } from '../lib/session.mjs';

try {
  const input = await readStdinJson();
  const cwd = input.cwd || process.cwd();
  const s = readState(cwd);
  if (!s.linkedRoots.length && !s.project) process.exit(0);

  let session = readSession(input.session_id);
  if (!session || input.source === 'startup') {
    session = { head: s.git.head, startedAt: Date.now(), linkedRoots: s.linkedRoots, attempts: [] };
  } else {
    session.linkedRoots = s.linkedRoots;
  }
  writeSession(input.session_id, session);
  pruneSessions();

  let version = '?';
  try { version = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_PLUGIN_ROOT || '.', '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch { /* keep ? */ }

  let local = false;
  const units = s.linkedRoots.map((r) => {
    let id = '?', target = '';
    try {
      const c = JSON.parse(fs.readFileSync(path.join(r, '.testsprite', 'config.json'), 'utf8'));
      id = c.projectId;
      if (typeof c.targetUrl === 'string' && /^https?:\/\/[^\s]+$/.test(c.targetUrl)) {
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+\/?$/.test(c.targetUrl);
        local ||= isLocal;
        target = ` (app ${c.targetUrl}${isLocal ? ', reached through TestSprite\'s own tunnel' : ''})`;
      }
    } catch { /* keep ? */ }
    return `${path.relative(cwd, r) || '.'} → ${id}${target}`;
  });
  const lines = [
    `TestSprite plugin ${version}. ${s.cli.present ? `CLI ${s.cli.version} (verified range ${VERIFIED_CLI}x${s.cli.verified ? '' : '; this version is outside it'}).` : 'CLI not found on PATH.'} ` +
      `Auth: ${s.auth.source === 'none' ? 'no API key found' : `API key from ${s.auth.source}`}${s.auth.apiUrlOverride ? ', API URL overridden by environment' : ''}.`,
    units.length ? `Linked units: ${units.join('; ')}.` : `Project: ${s.project.id} (from ${s.project.source}).`,
    session.attempts?.length ? `${session.attempts.length} TestSprite run command(s) have been issued in this session.` : 'No TestSprite run has been issued in this session.',
    "Before you report a code change under a linked unit as done, get a TestSprite verdict with the verify skill: in this repo that run is the live check of the change. Otherwise end your reply with 'Unverified because <reason>', where the reason is what blocked you (no CLI, no key, no reachable target), not that you did not try. Docs, config and test-file edits are exempt. Just run it: the plugin asks the user to approve the first billable run." +
      (local ? ' For a local app, check that its saved URL answers and test the copy already running there; never start a second copy on another port, because the tunnel targets the saved one.' : ''),
    'Long TestSprite commands (plan generate, --local, --all, ci run) run with run_in_background. Fan-out spend, deletions and overwrites are confirmed with the user.',
  ];
  if (s.officialSkillsPresent) lines.push('Official testsprite-* skills are also installed in .claude/skills (duplicate guidance).');
  if (s.bgTasksDisabled) lines.push('Background tasks are disabled: keep --timeout below the foreground command limit.');

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } }));
} catch {
  process.exit(0);
}
