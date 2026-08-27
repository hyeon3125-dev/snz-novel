#!/usr/bin/env python3
"""Rebuild a committed script from its sources and require semantic equality."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PREFIX = "window.SCRIPT = "


def load(path: Path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith(PREFIX):
        raise ValueError(f"invalid script wrapper: {path}")
    return json.loads(text[len(PREFIX):].rstrip().rstrip(";"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("sources", nargs="+")
    ap.add_argument("-a", "--annotations", action="append", default=[])
    args = ap.parse_args()

    with tempfile.TemporaryDirectory(prefix="snz-rebuild-") as tmp:
        generated = Path(tmp) / "script.js"
        cmd = [sys.executable, str(ROOT / "tools/parse_snz.py"), *args.sources,
               "-o", str(generated)]
        for ann in args.annotations:
            cmd += ["-a", ann]
        subprocess.run(cmd, cwd=ROOT, check=True, stdout=subprocess.PIPE, text=True)
        expected, actual = load(Path(args.script)), load(generated)
        if expected != actual:
            print(f"재현 빌드 실패 — {args.script}가 정본/어노테이션 산출물과 다릅니다")
            for key in ("meta", "order", "units", "scenes"):
                if expected.get(key) != actual.get(key):
                    print(f"  ✗ first differing section: {key}")
                    break
            return 1
    print(f"재현 빌드 100% — {args.script}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
