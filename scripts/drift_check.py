#!/usr/bin/env python3
"""Nightly drift canary: compare the CLI surface of the newest published CLI with the pinned one.

  python3 -I scripts/drift_check.py <fresh-dir>      (fresh-dir from capture_cli_help.py --out <dir>)

Exit 1 when a command or flag that the pinned surface has is gone from the fresh one (the plugin may cite it).
Additions are printed as a notice and do not fail.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
pinned = sorted((ROOT / "ci" / "pinned").iterdir(), key=lambda p: [int(x) for x in p.name.split(".")])[-1]
fresh = Path(sys.argv[1])


def rows(d):
    return (set((d / "commands.txt").read_text().split("\n")) - {""}, set((d / "flags.tsv").read_text().split("\n")) - {""})


(pc, pf), (fc, ff) = rows(pinned), rows(fresh)
for label, a, b in (("commands removed", pc - fc, None), ("flags removed", pf - ff, None)):
    if a:
        print(f"{label} since {pinned.name}:")
        for x in sorted(a):
            print("  -", x.replace("\t", "  "))
for label, a in (("commands added", fc - pc), ("flags added", ff - pf)):
    if a:
        print(f"{label} (notice):")
        for x in sorted(a):
            print("  +", x.replace("\t", "  "))
removed = (pc - fc) or (pf - ff)
print("DRIFT: removals found" if removed else "no removals")
sys.exit(1 if removed else 0)
