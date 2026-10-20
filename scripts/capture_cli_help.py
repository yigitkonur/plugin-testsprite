#!/usr/bin/env python3
"""Walk the TestSprite CLI's command tree and record the pinned surface (commands.txt, flags.tsv).

Offline and read-only: throwaway HOME, no API key, telemetry and update checks off; only `--help` is run.

  python3 -I scripts/capture_cli_help.py [--cli testsprite] [--out ci/pinned/<version>] [--help-dir DIR]

--cli       program to run (default: `testsprite` on PATH)
--out       where commands.txt and flags.tsv go (default: ci/pinned/<cli --version>)
--help-dir  also keep the raw help text per command (not committed; used to diff by hand)
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = tempfile.mkdtemp(prefix="ts-help-")
ENV = {
    "PATH": os.environ.get("PATH", ""),
    "HOME": SCRATCH,
    "NO_COLOR": "1",
    "TESTSPRITE_NO_TELEMETRY": "1",
    "TESTSPRITE_NO_UPDATE_NOTIFIER": "1",
    "TESTSPRITE_NO_SKILL_WARNING": "1",
    "TESTSPRITE_API_URL": "http://127.0.0.1:9",
    "DO_NOT_TRACK": "1",
}


def run(cli, args):
    p = subprocess.run([cli, *args], cwd=SCRATCH, env=ENV, capture_output=True, text=True, timeout=60)
    return p.returncode, p.stdout


def subcommands(text):
    out, inside = [], False
    for line in text.splitlines():
        if line.startswith("Commands:"):
            inside = True
            continue
        if inside:
            if line and not line.startswith(" "):
                break
            m = re.match(r"^  ([a-z][a-z0-9|-]*)\b", line)
            if m and m.group(1) != "help":
                out.append(m.group(1).split("|")[0])
    return out


def flags(text):
    found = set()
    for line in text.splitlines():
        if re.match(r"^\s{2,}-", line):
            found.update(re.findall(r"--[a-z0-9][a-z0-9-]*", line))
    return sorted(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cli", default="testsprite")
    ap.add_argument("--out")
    ap.add_argument("--help-dir")
    a = ap.parse_args()
    rc, ver = run(a.cli, ["--version"])
    if rc != 0:
        sys.exit(f"cannot run `{a.cli} --version`")
    ver = ver.strip().split()[-1]
    out = Path(a.out) if a.out else ROOT / "ci" / "pinned" / ver
    out.mkdir(parents=True, exist_ok=True)
    helpdir = Path(a.help_dir) if a.help_dir else None
    if helpdir:
        helpdir.mkdir(parents=True, exist_ok=True)
    seen, queue, rows = [], [[]], []
    while queue:
        path = queue.pop(0)
        rc, text = run(a.cli, [*path, "--help"])
        if rc != 0 or not text.startswith("Usage: testsprite" + (" " + " ".join(path) if path else "")):
            continue  # not a real command (e.g. a line inside an 'Exit codes:' block)
        if helpdir:
            (helpdir / f"{'-'.join(path) or 'top'}.txt").write_text(text)
        seen.append(" ".join(path) or "(top)")
        rows += [f"{' '.join(path) or '(top)'}\t{f}" for f in flags(text)]
        for sub in subcommands(text):
            cand = [*path, sub]
            if cand not in queue and " ".join(cand) not in seen:
                queue.append(cand)
    (out / "commands.txt").write_text("\n".join(sorted(set(seen))) + "\n")
    (out / "flags.tsv").write_text("\n".join(sorted(set(rows))) + "\n")
    print(f"cli {ver}  commands: {len(set(seen))}  flag-rows: {len(set(rows))}  out: {out}")


if __name__ == "__main__":
    sys.exit(main())
