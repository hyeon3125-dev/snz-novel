#!/usr/bin/env python3
"""원문→각본 순서 무결성 검증기 — 빌드 게이트 (Architecture v3 §3-1).

원문의 모든 서사 라인과 각본의 ``(sceneId, lineIdx, text)`` 열을 전체
순서대로 비교한다. 같은 문장이 다른 위치에 중복돼도 통과시키지 않는다.

불일치 1건이라도 발견 시 exit 1 — 변환 결과물 사용 금지.

사용:
    python3 verify_integrity.py game/script.js "<Part md>" [추가 Part...]
"""
import json
import re
import sys
from pathlib import Path

# parse_snz 와 동일한 분류 규칙을 공유 (규칙 자체의 검토는 skip-report 육안 검수로 보완)
sys.path.insert(0, str(Path(__file__).parent))
from parse_snz import (EDITORIAL_PATTERNS, RE_BANNER_SEP, RE_SCENE_SEP, apply_drops)


def narrative_lines(text):
    """원문에서 서사 라인만 추출 (줄번호 포함)."""
    out = []
    for lineno, raw in enumerate(text.split("\n"), 1):
        line = raw.rstrip()
        if not line.strip():
            continue
        if RE_SCENE_SEP.match(line) or RE_BANNER_SEP.match(line):
            continue
        if line.startswith("#"):
            continue
        if any(pat.match(line.strip()) for _, pat in EDITORIAL_PATTERNS):
            continue
        out.append((lineno, line))
    return out


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("sources", nargs="+")
    ap.add_argument("-a", "--annotations", action="append", default=[],
                    help="annotations json (drop_ranges 동일 적용)")
    args = ap.parse_args()
    script_path, sources = args.script, args.sources
    drop_ranges = {}
    for ann_path in args.annotations:
        if Path(ann_path).exists():
            drop_ranges.update(json.loads(Path(ann_path).read_text(encoding="utf-8"))
                               .get("drop_ranges", {}))

    js = Path(script_path).read_text(encoding="utf-8")
    if not js.startswith("window.SCRIPT = "):
        print("FAIL: script.js 형식 불일치 (window.SCRIPT = ... 기대)")
        return 1
    script = json.loads(js[len("window.SCRIPT = "):].rstrip().rstrip(";"))

    src_lines = []  # [(file, lineno, line)]
    for src in sources:
        text = apply_drops(Path(src).read_text(encoding="utf-8"),
                           drop_ranges.get(Path(src).name))
        src_lines += [(Path(src).name, ln, t) for ln, t in narrative_lines(text)]
    game_lines = []  # [(sceneId, idx, t)]
    for sid in script["order"]:
        for i, entry in enumerate(script["scenes"][sid]["lines"]):
            game_lines.append((sid, i, entry["t"]))
    errors = []
    if len(src_lines) != len(game_lines):
        errors.append(f"총량: 원문 서사 {len(src_lines)}줄 ≠ script {len(game_lines)}줄")

    for pos, (src, built) in enumerate(zip(src_lines, game_lines)):
        sf, sln, st = src
        sid, idx, bt = built
        if st != bt:
            errors.append(
                f"순번 {pos}: {sf}:{sln} {st[:60]!r} ≠ {sid}[{idx}] {bt[:60]!r}"
            )
            if len(errors) >= 21:
                break

    if errors:
        print(f"무결성 검증 실패 — {len(errors)}건")
        for error in errors:
            print("  ✗", error)
        return 1
    print(f"무결성 100% — 서사 {len(src_lines)}줄이 위치·순서까지 일치 "
          f"(씬 {script['meta']['sceneCount']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
