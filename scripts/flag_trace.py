#!/usr/bin/env python3
"""Flag-trace: every `testsprite ...` command path and --flag written in the plugin must exist in the
pinned CLI surface (ci/pinned/<version>/, produced by capture_cli_help.py from @testsprite/testsprite-cli).

Run:  python3 -I scripts/flag_trace.py [--pinned DIR] [files or directories...]
      default targets: README.md skills agents hooks lib docs/design   default pinned: newest ci/pinned/*
Exit: 0 when every checked command and flag is known, 1 otherwise.

What is checked: in Markdown, any code-block line or inline code span; in .mjs/.sh/.yml/.json files, every line.
A segment containing the token `testsprite` (or `@testsprite/testsprite-cli`) is parsed: the following words form
the command path (longest prefix present in commands.txt); every `--flag` after it must be in that command's help or
be a global flag. A line containing `trace:ignore` is skipped (intentional bad example).
What is NOT checked: unprefixed mentions like `test plan accept` in prose (reported separately as advisory).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[1:]
if "--pinned" in args:
    i = args.index("--pinned")
    HELP = Path(args[i + 1])
    del args[i:i + 2]
else:
    HELP = sorted((ROOT / "ci" / "pinned").iterdir(), key=lambda p: [int(x) for x in p.name.split(".")])[-1]
PINNED_VERSION = HELP.name
TEXT_SUFFIXES = {".md", ".mjs", ".sh", ".yml", ".yaml", ".json", ".py"}

commands = {c for c in (HELP / "commands.txt").read_text().splitlines() if c and c != "(top)"}
flags_by_cmd = {}
for row in (HELP / "flags.tsv").read_text().splitlines():
    cmd, flag = row.split("\t")
    flags_by_cmd.setdefault(cmd, set()).add(flag)
GLOBALS = flags_by_cmd.get("(top)", set()) | {"--help", "--version"}
GLOBAL_WITH_VALUE = {"--profile", "--output", "--endpoint-url", "--request-timeout"}
TOP_GROUPS = {c.split()[0] for c in commands}

WORD = re.compile(r"^[a-z][a-z0-9-]*$")
# tokens allowed before the program in a real invocation
PREFIX_OK = re.compile(r"^([A-Z_][A-Z0-9_]*=.*|npx|-y|--yes|sprite-run|--|\$|env|exec|time|nohup|node)$")
PROGRAM = {"testsprite", "@testsprite/testsprite-cli", "@testsprite/testsprite-cli@latest", "@testsprite/testsprite-cli@0.15.0"}


def segments(text, markdown=True):
    """Yield (lineno, segment, in_block) for code-block lines and inline code spans (every line in non-Markdown files)."""
    in_block = not markdown
    for n, line in enumerate(text.splitlines(), 1):
        if markdown and line.strip().startswith("```"):
            in_block = not in_block
            continue
        if "trace:ignore" in line:  # intentional bad example / hidden command mention
            continue
        chunks = [line] if in_block else re.findall(r"`([^`]+)`", line)
        for ch in chunks:
            ch = re.sub(r"\s#\s.*$", "", ch)  # trailing shell comment
            for seg in re.split(r"&&|\|\||;|\||\$\(|\n", ch):
                yield n, seg.strip(), in_block


def children(path):
    """Subcommand names directly under `path` (empty for a leaf command)."""
    depth = len(path.split())
    return {c.split()[depth] for c in commands if c.startswith(path + " ") and len(c.split()) == depth + 1}


def parse(tokens):
    """tokens after the program token -> (command path, flags)"""
    i, words = 0, []
    while i < len(tokens):
        t = tokens[i]
        if t in GLOBAL_WITH_VALUE:
            i += 2
            continue
        if t.startswith("--") and t.split("=")[0] in GLOBALS:
            i += 1
            continue
        if WORD.match(t):
            words.append(t)
            i += 1
            continue
        break
    path = ""
    for k in range(len(words), 0, -1):
        cand = " ".join(words[:k])
        if cand in commands:
            path = cand
            break
    flags = [t.split("=")[0] for t in tokens if t.startswith("--") and re.match(r"^--[a-z0-9][a-z0-9-]*", t)]
    bad_sub = None
    if path:
        kids = children(path)
        nxt = len(path.split())
        if kids and len(words) > nxt and words[nxt] not in kids:
            bad_sub = f"{path} {words[nxt]}"
    return path, words, flags, bad_sub


def check_file(path):
    problems, checked, advisory = [], 0, []
    for n, seg, in_block in segments(path.read_text(), path.suffix == ".md"):
        toks = [t.strip("`\"'(),") for t in seg.split()]
        toks = [t for t in toks if t]
        for idx, t in enumerate(toks):
            if t in PROGRAM:
                if not all(PREFIX_OK.match(x) for x in toks[:idx]):
                    break  # prose that merely mentions the word, not an invocation
                rest = toks[idx + 1:]
                if not rest or not WORD.match(rest[0]):
                    break  # bare mention of the program, a flag-only call, or a placeholder
                cmd, words, flags, bad_sub = parse(rest)
                checked += 1
                if bad_sub:
                    problems.append((n, f"UNKNOWN SUBCOMMAND: testsprite {bad_sub}"))
                    break
                if not cmd:
                    problems.append((n, f"UNKNOWN COMMAND: testsprite {' '.join(words) or rest[0]}"))
                    break
                known = flags_by_cmd.get(cmd, set()) | GLOBALS
                for f in flags:
                    if f not in known:
                        problems.append((n, f"UNKNOWN FLAG for `{cmd}`: {f}"))
                break
        else:
            # advisory: unprefixed `test run ...` style spans
            if not in_block and toks and toks[0] in TOP_GROUPS and len(toks) > 1 and WORD.match(toks[1]):
                cmd, _, flags, bad_sub = parse(toks)
                if bad_sub:
                    advisory.append((n, f"unprefixed, unknown subcommand: {bad_sub}"))
                elif not cmd:
                    advisory.append((n, f"unprefixed, unknown command: {' '.join(toks[:3])}"))
                else:
                    for f in flags:
                        if f not in (flags_by_cmd.get(cmd, set()) | GLOBALS):
                            advisory.append((n, f"unprefixed `{cmd}`: unknown flag {f}"))
    return checked, problems, advisory


def main():
    targets = [Path(a) for a in args] or [ROOT / t for t in ("README.md", "skills", "agents", "hooks", "lib", "docs/design")]
    files = []
    for t in targets:
        files += sorted(p for p in t.rglob("*") if p.is_file() and p.suffix in TEXT_SUFFIXES) if t.is_dir() else [t]
    total, bad, adv = 0, 0, 0
    for f in files:
        if not f.exists():
            continue
        checked, problems, advisory = check_file(f)
        total += checked
        bad += len(problems)
        adv += len(advisory)
        status = "OK " if not problems else "BAD"
        print(f"{status} {f.name}: {checked} testsprite command mentions checked, {len(problems)} problems, {len(advisory)} advisory")
        for n, msg in problems:
            print(f"     line {n}: {msg}")
        for n, msg in advisory:
            print(f"     (advisory) line {n}: {msg}")
    print(f"\nTOTAL: {total} command mentions checked against {len(commands)} command paths / "
          f"{sum(len(v) for v in flags_by_cmd.values())} flag rows (CLI {PINNED_VERSION}); problems: {bad}; advisory: {adv}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
