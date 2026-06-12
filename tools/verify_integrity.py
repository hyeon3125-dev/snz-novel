#!/usr/bin/env python3
"""원문 무결성 양방향 검증기 — 빌드 게이트 (Architecture v2.0 §3-1, 불변식 2).

1. 정방향: script.js 의 모든 서사 라인이 원문 md 에 한 글자도 다르지 않게 존재.
2. 역방향: 원문의 모든 서사 라인(스킵 화이트리스트 제외)이 script.js 에 존재 — 누락 0.
3. 총량: 원문 서사 라인 수 == script.js 라인 수 (1:1 변환 보장).

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
    ap.add_argument("-a", "--annotations", default=None,
                    help="annotations json (drop_ranges 동일 적용)")
    args = ap.parse_args()
    script_path, sources = args.script, args.sources
    drop_ranges = {}
    if args.annotations and Path(args.annotations).exists():
        drop_ranges = json.loads(Path(args.annotations).read_text(encoding="utf-8")) \
            .get("drop_ranges", {})

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
    src_set = {t for _, _, t in src_lines}

    game_lines = []  # [(sceneId, idx, t)]
    for sid in script["order"]:
        for i, entry in enumerate(script["scenes"][sid]["lines"]):
            game_lines.append((sid, i, entry["t"]))
    game_set = {t for _, _, t in game_lines}

    errors = 0

    # 1. 정방향: 게임 라인 → 원문 존재
    fwd_fail = [(sid, i, t) for sid, i, t in game_lines if t not in src_set]
    if fwd_fail:
        errors += len(fwd_fail)
        print(f"FAIL 정방향: 원문에 없는 라인 {len(fwd_fail)}건")
        for sid, i, t in fwd_fail[:10]:
            print(f"  {sid}[{i}]: {t[:70]}")

    # 2. 역방향: 원문 라인 → 게임 존재
    rev_fail = [(f, ln, t) for f, ln, t in src_lines if t not in game_set]
    if rev_fail:
        errors += len(rev_fail)
        print(f"FAIL 역방향: script.js 에 누락된 원문 라인 {len(rev_fail)}건")
        for f, ln, t in rev_fail[:10]:
            print(f"  {f}:{ln}: {t[:70]}")

    # 3. 총량 (중복 라인 포함 1:1)
    if len(src_lines) != len(game_lines):
        errors += 1
        print(f"FAIL 총량: 원문 서사 {len(src_lines)}줄 ≠ script {len(game_lines)}줄")

    if errors:
        print(f"\n무결성 검증 실패 — {errors}건. 변환 결과물 폐기 요망.")
        return 1
    print(f"무결성 100% — 서사 {len(src_lines)}줄 전량 일치 "
          f"(씬 {script['meta']['sceneCount']}, 고유 라인 {len(src_set)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
