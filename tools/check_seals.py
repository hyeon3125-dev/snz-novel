#!/usr/bin/env python3
"""봉인 5종 검사 (WB v3.0 §0, 불변식 3) — 신규 텍스트 표면 검사.

봉인: Observer 정체 / ARIA 기원 완전판 / Cycle 총 횟수 / O-class 개체 정체 / 메인 시스템 의도.
본문 라인(script.js 의 lines[].t)은 정본이므로 검사 제외 — 봉인은 본문에 원래 없다 (구조적 보장).
검사 대상: 게임 코드·UI 문언·어노테이션 등 신규 작성물 전부.

한계: 키워드 그렙은 완전하지 않음 — 신규 서사 텍스트 추가 시 봉인 비접촉 육안 검수 병행 (아키텍처 §8).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

# 봉인 항목을 '단정'하는 표현 패턴 (등장 자체가 아니라 해제 시도를 잡는다)
FORBIDDEN = [
    r"Observer(의|는|가)?\s*(정체|기원|행방)\s*(는|은|를|가)?\s*[^?\s]",  # 정체 단정
    r"ARIA(의)?\s*기원(은|는)\s*",
    r"(Cycle|사이클)\s*(총\s*)?횟수(는|은)?\s*\d",
    r"O-class[^\n]{0,20}(정체|이름|개체)(는|은)\s*",
    r"메인\s*시스템(의)?\s*의도(는|은)\s*",
]

SCAN_FILES = (
    [ROOT / "game" / f for f in
     ["state.js", "director.js", "stage.js", "input.js", "main.js", "index.html", "style.css"]]
    + sorted((ROOT / "tools" / "annotations").glob("*.json"))   # 언어판 추가 시 자동 포함
    + [ROOT / "README.md", ROOT / "GUIDE.md", ROOT / "tools" / "LOCALIZATION.md"]
)


def script_new_surfaces(path):
    """script.js 에서 본문 라인을 제외한 표면(라벨·메타)만 추출."""
    js = path.read_text(encoding="utf-8")
    s = json.loads(js[len("window.SCRIPT = "):].rstrip().rstrip(";"))
    out = []
    out += [u["label"] for u in s["units"].values()]
    for sc in s["scenes"].values():
        if sc.get("interaction"):
            out.append(json.dumps(sc["interaction"], ensure_ascii=False))
    return "\n".join(out)


def main():
    errors = 0
    targets = [(p, p.read_text(encoding="utf-8")) for p in SCAN_FILES if p.exists()]
    for sjs in sorted((ROOT / "game").glob("script*.js")):   # 언어판 추가 시 자동 포함
        targets.append((f"{sjs} (본문 외 표면)", script_new_surfaces(sjs)))
    for path, text in targets:
        for pat in FORBIDDEN:
            for m in re.finditer(pat, text):
                errors += 1
                print(f"SEAL VIOLATION {path}: {m.group(0)[:60]}")
    if errors:
        print(f"\n봉인 검사 실패 — {errors}건")
        return 1
    print(f"봉인 검사 통과 — {len(targets)}개 표면, 위반 0건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
