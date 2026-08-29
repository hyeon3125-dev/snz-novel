#!/usr/bin/env python3
"""언어판 ↔ KO 구조 패리티 검증기 (빌드 게이트).

KO(script.js)가 구조 정본이다. 신규 언어판 빌드가 KO와 다음 항목에서 1:1인지 전수 대조:

  1. 유닛 집합 + 순서 (재배치·누락·중복 초고 유닛 검출)
  2. 유닛 속성: kind / part / ch
  3. 유닛별 씬 수 + 씬별 라인 수·형태 (임의 분할·줄 밀림·잉여 문단·결락 라인·편집 잔재 누수)
  4. meta: sceneCount / lineCount / seedTotal
  5. 유닛 어노테이션 패리티: seed / gate / reach / sound(bgm)
  6. 씬 어노테이션 패리티: faction / fx / interaction 전 필드 / gate / sound

EN판 교정(2026-06)에서 수동으로 했던 대조를 상설화한 것 — 일/중(간·번) 등 후속 언어판의 1차 게이트.
사용:  python3 verify_parity.py ../game/script.en.js [--ref ../game/script.js]
"""
import argparse
import json
import sys
from pathlib import Path


FACTION_TERMS = {
    "en": {
        "화감": "Hwagam", "금휘": "Geumhwi", "에이도스": "Eidos",
        "알타이르": "Altair", "공가": "Gongga",
    },
    "jp": {
        "화감": "ファガム", "금휘": "グムヒ", "에이도스": "エイドス",
        "알타이르": "アルタイル", "공가": "ゴンガ",
    },
}

FORBIDDEN_LOCALE_TERMS = {
    "en": ("Geumhui", "Dohui", "Minsiu", "Tico", "internal routines"),
    "jp": ("観測者", "空席", "後継者", "火鑑", "金輝"),
}


def load(path):
    js = Path(path).read_text(encoding="utf-8")
    return json.loads(js[len("window.SCRIPT = "):].rstrip().rstrip(";"))


def unit_order(s):
    out = []
    for sid in s["order"]:
        u = s["scenes"][sid]["unit"]
        if not out or out[-1] != u:
            out.append(u)
    return out


def fx_of(line):
    fx = line.get("fx")
    return fx.get("tag") if isinstance(fx, dict) else fx


def localized_fx_error(line):
    """Locale-specific fx payload must still point at visible source text."""
    fx = line.get("fx")
    if not isinstance(fx, dict) or fx.get("tag") != "blank":
        return None
    word = fx.get("word")
    if not isinstance(word, str) or not word or word not in line.get("t", ""):
        return f"blank.word {word!r} is not present in the localized line"
    return None


def line_shape(line):
    """언어와 무관한 줄 형태. 같은 줄 수로 위장한 번역 밀림을 잡는다."""
    text = line.get("t", "").strip()
    italic = len(text) >= 2 and text.startswith("*") and text.endswith("*")
    dialogue = ((text.startswith("“") and text.endswith("”")) or
                (text.startswith("「") and text.endswith("」")))
    return italic, dialogue


def interaction_shape(sc):
    """현지화 문자열만 지우고 동작을 결정하는 전 필드를 비교한다."""
    it = sc.get("interaction")
    if not isinstance(it, dict):
        return it
    shaped = dict(it)
    if "choices" in shaped:
        shaped["choices"] = ["<localized>"] * len(shaped["choices"])
    return shaped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="검증 대상 언어판 script.js")
    ap.add_argument("--ref", default=str(Path(__file__).parent.parent / "game" / "script.js"),
                    help="구조 정본 (기본: KO game/script.js)")
    args = ap.parse_args()
    ko, xx = load(args.ref), load(args.target)
    target_name = Path(args.target).name
    locale = "en" if ".en." in target_name else "jp" if ".jp." in target_name else None
    errors = []

    # 1. 유닛 집합 + 순서
    ouk, oux = unit_order(ko), unit_order(xx)
    if set(ouk) != set(oux):
        errors.append(f"유닛 집합 불일치 — 누락: {sorted(set(ouk)-set(oux))}, 잉여: {sorted(set(oux)-set(ouk))}")
    elif ouk != oux:
        import difflib
        d = [l for l in difflib.unified_diff(ouk, oux, "KO", "대상", lineterm="", n=1)][2:]
        errors.append("유닛 순서 불일치 (원고 내 배치가 KO와 다름):\n    " + "\n    ".join(d[:40]))

    # 2~3. 유닛 속성 + 씬/라인 구조
    def struct(s):
        d = {}
        for sid in s["order"]:
            sc = s["scenes"][sid]
            d.setdefault(sc["unit"], []).append(len(sc["lines"]))
        return d
    stk, stx = struct(ko), struct(xx)
    for u in ouk:
        if u not in xx["units"]:
            continue
        for attr in ("kind", "part", "ch"):
            if ko["units"][u][attr] != xx["units"][u][attr]:
                errors.append(f"{u}.{attr}: KO {ko['units'][u][attr]} ≠ 대상 {xx['units'][u][attr]}"
                              " (Part 헤더 위치/배치 확인)")
        if stk.get(u) != stx.get(u):
            errors.append(f"{u} 씬 구조: KO {stk.get(u)} ≠ 대상 {stx.get(u)}"
                          " (씬 분할/잉여·결락 라인/편집 잔재 누수)")

    # 4. meta
    for k in ("edition", "schemaVersion", "sceneCount", "lineCount", "seedTotal", "judgementUnit"):
        if ko["meta"][k] != xx["meta"][k]:
            errors.append(f"meta.{k}: KO {ko['meta'][k]} ≠ 대상 {xx['meta'][k]}")

    # 5. 유닛 어노테이션
    for u in ouk:
        if u not in xx["units"]:
            continue
        for key in ("seed", "gate", "reach", "sound"):
            if ko["units"][u].get(key) != xx["units"][u].get(key):
                errors.append(f"{u}.{key}: KO {ko['units'][u].get(key)} ≠ 대상 {xx['units'][u].get(key)}")

    # 6. 씬 어노테이션 (구조가 같을 때만 의미 있음 — 같은 씬 id끼리 대조)
    for sid in ko["order"]:
        a, b = ko["scenes"][sid], xx["scenes"].get(sid)
        if b is None:
            continue
        if a["faction"] != b["faction"]:
            errors.append(f"{sid}.faction: KO {a['faction']} ≠ 대상 {b['faction']}")
        if interaction_shape(a) != interaction_shape(b):
            errors.append(f"{sid}.interaction: KO {interaction_shape(a)} ≠ 대상 {interaction_shape(b)}")
        if (a.get("gate") is None) != (b.get("gate") is None) or a.get("gate") != b.get("gate"):
            errors.append(f"{sid}.gate: KO {a.get('gate')} ≠ 대상 {b.get('gate')}")
        if a.get("sound") != b.get("sound"):
            errors.append(f"{sid}.sound: KO {a.get('sound')} ≠ 대상 {b.get('sound')}")
        if len(a["lines"]) == len(b["lines"]):
            for i, (la, lb) in enumerate(zip(a["lines"], b["lines"])):
                if fx_of(la) != fx_of(lb):
                    errors.append(f"{sid}[{i}].fx: KO {fx_of(la)} ≠ 대상 {fx_of(lb)}")
                for label, line in (("KO", la), ("대상", lb)):
                    fx_error = localized_fx_error(line)
                    if fx_error:
                        errors.append(f"{sid}[{i}].fx ({label}): {fx_error}")
                if line_shape(la) != line_shape(lb):
                    errors.append(f"{sid}[{i}].shape: KO {line_shape(la)} ≠ 대상 {line_shape(lb)}"
                                  " (이탤릭/대화 줄 밀림·인용부호 형식 확인)")
                if locale:
                    for ko_term, localized_term in FACTION_TERMS[locale].items():
                        if (ko_term in la.get("t", "")) != (localized_term in lb.get("t", "")):
                            errors.append(
                                f"{sid}[{i}].faction-term: KO {ko_term!r} ↔ {locale} {localized_term!r}"
                                " (가문명 누락·오역 확인)"
                            )

    if locale:
        visible = "\n".join(
            [u["label"] for u in xx["units"].values()]
            + [line.get("t", "") for sc in xx["scenes"].values() for line in sc["lines"]]
        )
        for term in FORBIDDEN_LOCALE_TERMS[locale]:
            if term in visible:
                errors.append(f"{locale} 금지 표기 잔존: {term!r}")

    if errors:
        print(f"패리티 검증 실패 — {len(errors)}건 (KO가 구조 정본):")
        for e in errors[:80]:
            print("  ✗", e)
        if len(errors) > 80:
            print(f"  … 외 {len(errors)-80}건")
        return 1
    print(f"패리티 100% — 유닛 {len(ouk)} · 씬 {ko['meta']['sceneCount']} · 라인 {ko['meta']['lineCount']}"
          f" 전 항목 KO와 1:1 ({Path(args.target).name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
