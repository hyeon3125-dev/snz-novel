#!/usr/bin/env python3
"""SNZ Final Part md → game/script.js 변환기 (Architecture v2.0 §3).

사용:
    python3 parse_snz.py "<본문 Part md 경로>" [추가 Part...] -o ../game/script.js

원칙:
- 서사 라인은 원문 그대로 (한 글자도 변경 금지) — verify_integrity.py 가 게이트.
- 서사 외 라인(헤더·구분자·편집 주석)은 명시적 화이트리스트로만 스킵하고 전량 리포트.
- 물리적 한 줄 = lines[] 한 엔트리 (탭 1회 = 1문단).
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ──────────────── 구분자 ────────────────
RE_SCENE_SEP = re.compile(r"^-{5,}\s*$")     # 씬 경계
RE_BANNER_SEP = re.compile(r"^={5,}\s*$")    # 서브 문서 배너 (씬 경계로 동일 취급)

# ──────────────── 편집 주석 (서사 아님 — 스킵 화이트리스트) ────────────────
EDITORIAL_PATTERNS = [
    ("placement_bracket", re.compile(r"^\*\[.*\]\*$")),                       # *[배치: ...]*
    ("placement_meta", re.compile(r"^\*(배치|시점|사건|삽입 위치)\s*[::].*\*$")),
    ("compile_note", re.compile(r"^\*Ch\.[\d~.]+\s*(통합본|v\d).*\*$")),       # *Ch.1~6 통합본 ...*
    ("end_marker", re.compile(r"^\*.{0,60}— ?끝\*$")),                        # *Prologue 「0」— 끝*
    ("end_marker_sub", re.compile(r"^\*(Archive|Observation|Calculation|Order|Deletion|Fragment)-\d+ 끝\*$")),
    ("end_marker_vol", re.compile(r"^\*\*— ?Volume \d+ 끝 ?—\*\*$")),
    ("blueprint_note", re.compile(r"^\*?#? ?\*?Blueprint v[\d.]+.*\*?$")),
    # 편집 테저/요약 (작중 로그 "*다음에 오는 사람에게*" 류와 구분 — '다음:' 콜론이 편집 표지)
    ("next_teaser", re.compile(r"^\*다음: .*\*$")),
    ("vol_close_note", re.compile(r"^\*Vol\.\d+ — .*(종료|완결)\*$")),
    ("paren_note", re.compile(r"^\*\(.*\)\*$")),  # 전체 괄호 이탤릭 = 작가 주석
]

# ──────────────── 헤더 분류 ────────────────
# 챕터: "## Vol.1 Ch.1 — Observation" / "## Vol.4 Ch.19 「이탈」" / "## Vol.6 — Ch.43 「기록원」 [전면판]"
RE_CHAPTER = re.compile(r"^## Vol\.(\d+)\s*(?:—\s*)?Ch\.(\d+)\s*(?:—\s*)?(.*)$")
RE_PROLOGUE = re.compile(r"^## Prologue\s*—\s*「(.+)」")
RE_VOLUME = re.compile(r"^# Volume (\d+)\b")
RE_DIAMOND = re.compile(r"^## ◆ (.+)$")  # 서브 문서 배너 헤더
# 권 내장 인터루드: "## Archive-01 — 「기록」" 등
RE_INLINE_SUB = re.compile(r"^## (Archive|Observation|Calculation|Order|Deletion)-(\d+)\s*—\s*「(.+)」")
# Fragment: "## Fragment — 「보류」" / "## Fragment-01 — 「방향」"
RE_FRAGMENT = re.compile(r"^## Fragment(?:-(\d+))?\s*—\s*「(.+)」")
# ◆ 배너 내부의 실제 시작 헤더: "## BA-01 「서안의 눈」" / "## DL-01 「물어본 적」— 한결·도희"
RE_INNER_SUB = re.compile(r"^## (BA|DL|SS|IN|AE)-(\d+)\b")
RE_CH_RANGE = re.compile(r"^## Ch\.[\d~]+(\s+v\d+)?\s*$")  # "## Ch.53~62 v2" (권 부배너)
# Part2~3 변형: "## Interlude-03 「잠시」" / "## Interlude 04 — 「몇 분」" / "## After Ending 01 — 「Seat 이후」"
RE_INTERLUDE = re.compile(r"^## Interlude[- ](\d+)\b")
RE_AFTER_ENDING = re.compile(r"^## After Ending (\d+)\b")
RE_SUB_RANGE = re.compile(r"^## (?:BA|DL|SS|IN|AE)-\d+\s*[~+]")  # "## AE-01 ~ AE-04 + ..." (그룹 배너)

INLINE_PREFIX = {
    "Archive": "arch", "Observation": "obs", "Calculation": "calc",
    "Order": "ord", "Deletion": "del",
}
DIAMOND_TYPES = [  # (배너 내 표기, id 접두사)
    ("Battle Archive", "ba"), ("Daily Log", "dl"), ("Side Story", "ss"),
    ("Interlude", "in"), ("After Ending", "ae"), ("Cold Open", "co"),
]


def apply_drops(text, ranges):
    """소스에서 명시적 제외 구간(중복 블록 등)을 빈 줄로 치환 — 줄번호 보존.

    annotations의 drop_ranges 로만 발동. 사용 시 사유를 어노테이션에 기록할 것.
    파서·검증기가 동일하게 적용해 1:1 총량 검증이 유지된다.
    """
    if not ranges:
        return text
    lines = text.split("\n")
    for start, end in ranges:
        for i in range(start - 1, min(end, len(lines))):
            lines[i] = ""
    return "\n".join(lines)


class Parser:
    def __init__(self):
        self.units = []          # [{id, label, kind, vol, ch}]
        self.unit_ids = set()
        self.cur_unit = None     # 현재 unit dict
        self.cur_scene_lines = []
        self.scenes = []         # [{unit, lines}] (id는 마지막에 부여)
        self.cur_vol = None
        self.ff_seq = 0          # 무번호 Fragment 순번
        self.skipped = []        # [(사유, 줄번호, 원문)]

    # ── unit/scene 전환 ──
    def close_scene(self):
        if self.cur_scene_lines:
            self.scenes.append({"unit": self.cur_unit["id"], "lines": self.cur_scene_lines})
        self.cur_scene_lines = []

    def start_unit(self, uid, label, kind, vol=None, ch=None):
        self.close_scene()
        if vol is None:
            vol = self.cur_vol  # 서브 문서는 배치 권역의 권 번호를 상속 (Arc 산출용)
        if uid in self.unit_ids:  # 중복 id 방지 (동명 Fragment 등)
            base, n = uid, 2
            while f"{base}_{n}" in self.unit_ids:
                n += 1
            uid = f"{base}_{n}"
        self.unit_ids.add(uid)
        self.cur_unit = {"id": uid, "label": label, "kind": kind, "vol": vol, "ch": ch}
        self.units.append(self.cur_unit)

    def skip(self, reason, lineno, text):
        self.skipped.append((reason, lineno, text))

    # ── 헤더 처리. True = 소비됨 ──
    def handle_header(self, line, lineno):
        m = RE_CHAPTER.match(line)
        if m:
            vol, ch = int(m.group(1)), int(m.group(2))
            self.start_unit(f"v{vol:02d}_c{ch:03d}", line[3:].strip(), "chapter", vol, ch)
            self.skip("header:chapter", lineno, line)
            return True
        m = RE_PROLOGUE.match(line)
        if m:
            self.start_unit("pro", line[3:].strip(), "prologue")
            self.skip("header:prologue", lineno, line)
            return True
        m = RE_DIAMOND.match(line)
        if m:
            body = m.group(1)
            for name, prefix in DIAMOND_TYPES:
                if body.startswith(name):
                    mn = re.search(r"(?:" + re.escape(prefix.upper()) + r"-)?(\d+)", body)
                    if mn:
                        uid = f"{prefix}{int(mn.group(1)):02d}"
                    else:  # Cold Open 등 무번호
                        self.ff_seq_co = getattr(self, "ff_seq_co", 0) + 1
                        uid = f"{prefix}{self.ff_seq_co:02d}"
                    self.start_unit(uid, body.strip(), "sub")
                    self.skip("header:diamond", lineno, line)
                    return True
            # 미지의 ◆ 유형 → 그래도 unit으로 (id는 순번)
            self.start_unit(f"sub{len(self.units):03d}", body.strip(), "sub")
            self.skip("header:diamond_unknown", lineno, line)
            return True
        m = RE_INLINE_SUB.match(line)
        if m:
            kind, num, title = m.group(1), int(m.group(2)), m.group(3)
            self.start_unit(f"{INLINE_PREFIX[kind]}{num:02d}", line[3:].strip(), "interlude")
            self.skip("header:inline_sub", lineno, line)
            return True
        m = RE_FRAGMENT.match(line)
        if m:
            # ◆ Cold Open 배너 직후의 내부 Fragment 헤더는 같은 unit → 스킵
            if self.cur_unit and self.cur_unit["kind"] == "sub" and m.group(2) in self.cur_unit["label"]:
                self.skip("header:inner_banner", lineno, line)
                return True
            if m.group(1):  # Fragment-01 (권 내장)
                self.start_unit(f"fr{int(m.group(1)):02d}", line[3:].strip(), "fragment")
            else:           # 무번호 FF (보류/칸/있었다)
                self.ff_seq += 1
                self.start_unit(f"ff{self.ff_seq:02d}", line[3:].strip(), "fragment")
            self.skip("header:fragment", lineno, line)
            return True
        if RE_SUB_RANGE.match(line):  # "## AE-01 ~ AE-04 + ..." 그룹 배너 (INNER_SUB보다 먼저)
            self.skip("header:sub_range", lineno, line)
            return True
        m = RE_INNER_SUB.match(line)
        if m:
            # ◆ 배너 내부의 실제 시작 헤더 (예: "## DL-01 ...") → 같은 unit
            expect = f"{m.group(1).lower()}{int(m.group(2)):02d}"
            if self.cur_unit and self.cur_unit["id"].startswith(expect):
                self.skip("header:inner_banner", lineno, line)
            else:  # 배너 없이 등장 → 신규 unit
                self.start_unit(expect, line[3:].strip(), "sub")
                self.skip("header:inner_sub_standalone", lineno, line)
            return True
        m = RE_INTERLUDE.match(line)
        if m:
            uid = f"in{int(m.group(1)):02d}"
            if self.cur_unit and self.cur_unit["id"].startswith(uid):
                self.skip("header:inner_banner", lineno, line)
            else:  # "## Interlude-03 「잠시」"처럼 ◆ 배너 없이 등장
                self.start_unit(uid, line[3:].strip(), "sub")
                self.skip("header:interlude_standalone", lineno, line)
            return True
        m = RE_AFTER_ENDING.match(line)
        if m:
            uid = f"ae{int(m.group(1)):02d}"
            if self.cur_unit and self.cur_unit["id"].startswith(uid):
                self.skip("header:inner_banner", lineno, line)
            else:
                self.start_unit(uid, line[3:].strip(), "sub")
                self.skip("header:after_ending", lineno, line)
            return True
        m = RE_VOLUME.match(line)
        if m:
            self.cur_vol = int(m.group(1))
            self.close_scene()
            self.skip("header:volume", lineno, line)
            return True
        if RE_CH_RANGE.match(line):
            self.skip("header:ch_range", lineno, line)
            return True
        if line.startswith("#"):
            # 그 외 모든 헤더: 파일 타이틀 / "# SCALAR: NODE ZERO" 배너 / "# Interlude ..." 등
            self.skip("header:other", lineno, line)
            return True
        return False

    # ── 메인 루프 ──
    def feed(self, text):
        for lineno, raw in enumerate(text.split("\n"), 1):
            line = raw.rstrip()
            if not line.strip():
                continue
            if RE_SCENE_SEP.match(line) or RE_BANNER_SEP.match(line):
                self.close_scene()
                self.skip("separator", lineno, line)
                continue
            if self.handle_header(line, lineno):
                continue
            for reason, pat in EDITORIAL_PATTERNS:
                if pat.match(line.strip()):
                    self.skip(f"editorial:{reason}", lineno, line)
                    break
            else:
                if self.cur_unit is None:
                    self.skip("orphan_before_first_unit", lineno, line)
                    continue
                self.cur_scene_lines.append(line)
        self.close_scene()


def vol_to_arc(vol):
    """BP v4.0 6-Arc 매핑."""
    if vol is None:
        return None
    for arc, (lo, hi) in enumerate([(1, 3), (4, 6), (7, 9), (10, 12), (13, 14), (15, 16)], 1):
        if lo <= vol <= hi:
            return arc
    return None


def build_script(parser, annotations, src_hashes, part_label):
    ann_faction = annotations.get("faction", {})
    ann_fx = annotations.get("fx", {})
    ann_inter = annotations.get("interaction", {})
    ann_sound = annotations.get("sound", {})
    ann_gate = annotations.get("gate", {})
    ann_seeds = annotations.get("seeds", {})
    ann_unit_gates = annotations.get("unit_gates", {})

    order = []
    scenes_out = {}
    per_unit_count = {}
    unit_ids = {u["id"] for u in parser.units}

    # 어노테이션 참조 무결성 — 오타 키는 빌드 실패
    bad = []
    scene_ids_planned = set()
    for sc in parser.scenes:
        n = per_unit_count.get(sc["unit"], 0) + 1
        per_unit_count[sc["unit"]] = n
        scene_ids_planned.add(f"{sc['unit']}_s{n:02d}")
    per_unit_count.clear()

    def ref_ok(key):
        if key.startswith("_"):
            return True  # _doc/_reason 류 주석 키
        if key.startswith("vol:"):
            return key[4:].isdigit()
        return key in unit_ids or key in scene_ids_planned
    for name, mapping in [("faction", ann_faction), ("fx", ann_fx), ("interaction", ann_inter),
                          ("sound", ann_sound), ("gate", ann_gate), ("seeds", ann_seeds),
                          ("unit_gates", ann_unit_gates)]:
        bad += [f"{name}:{k}" for k in mapping if not ref_ok(k)]
    if bad:
        raise SystemExit(f"[parse_snz] 어노테이션 참조 오류 (미존재 unit/scene): {bad}")

    unit_by_id = {u["id"]: u for u in parser.units}
    for sc in parser.scenes:
        n = per_unit_count.get(sc["unit"], 0) + 1
        per_unit_count[sc["unit"]] = n
        sid = f"{sc['unit']}_s{n:02d}"
        order.append(sid)
        unit = unit_by_id[sc["unit"]]
        faction = (ann_faction.get(sid) or ann_faction.get(sc["unit"])
                   or (ann_faction.get(f"vol:{unit['vol']}") if unit["vol"] else None) or "trio")
        lines = []
        fx_map = ann_fx.get(sid, {})
        auto_fx = annotations.get("auto_fx", {})
        for i, t in enumerate(sc["lines"]):
            entry = {"t": t}
            fx = fx_map.get(str(i)) or auto_fx.get(t)  # 수동 태그 우선, 정형구 자동 태깅 보조
            if fx:
                entry["fx"] = fx  # 문자열 태그 또는 {tag, ...params}
            lines.append(entry)
        scenes_out[sid] = {
            "id": sid,
            "unit": sc["unit"],
            "faction": faction,
            "lines": lines,
            "interaction": ann_inter.get(sid) or None,
            "sound": ann_sound.get(sid) or None,
            "next": None,
            "gate": ann_gate.get(sid) or None,
        }
    for i, sid in enumerate(order):
        scenes_out[sid]["next"] = order[i + 1] if i + 1 < len(order) else None

    units_out = {}
    for u in parser.units:
        units_out[u["id"]] = {
            "label": u["label"], "kind": u["kind"], "vol": u["vol"], "ch": u["ch"],
            "arc": vol_to_arc(u["vol"]),
            "seed": ann_seeds.get(u["id"]),          # 이 유닛 완료 시 마킹할 복선 id
            "gate": ann_gate.get(u["id"]),           # 회수 게이트: {"seed": id} — 미보유 시 연출 묵음
            "reach": ann_unit_gates.get(u["id"]),    # 도달 상태 게이트: {"reach": "full"}
            "sound": ann_sound.get(u["id"]),         # {"bgm": 키}
        }
    return {
        "meta": {
            "part": part_label,
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sources": src_hashes,
            "sceneCount": len(order),
            "lineCount": sum(len(s["lines"]) for s in scenes_out.values()),
            "reachRules": annotations.get("reach_rules",
                                          {"fullSeedsMin": 16, "fullUnchosenMax": 2, "silentUnchosenMin": 3}),
            "seedTotal": len({sid for v in ann_seeds.values()
                              for sid in (v if isinstance(v, list) else [v])}),
        },
        "order": order,
        "units": units_out,
        "scenes": scenes_out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+", help="SNZ Final Part md 경로")
    ap.add_argument("-o", "--output", required=True, help="script.js 출력 경로")
    ap.add_argument("-a", "--annotations", default=None, help="annotations json (faction 등)")
    ap.add_argument("--skip-report", default=None, help="스킵 라인 리포트 출력 경로")
    args = ap.parse_args()

    annotations = {}
    if args.annotations and Path(args.annotations).exists():
        annotations = json.loads(Path(args.annotations).read_text(encoding="utf-8"))

    drop_ranges = annotations.get("drop_ranges", {})
    parser = Parser()
    src_hashes = []
    labels = []
    for src in args.sources:
        text = Path(src).read_text(encoding="utf-8")
        src_hashes.append({"file": Path(src).name,
                           "sha256": hashlib.sha256(text.encode()).hexdigest()[:16]})
        m = re.search(r"## (Part \d+)", text[:200])
        labels.append(m.group(1) if m else Path(src).name)
        parser.feed(apply_drops(text, drop_ranges.get(Path(src).name)))

    script = build_script(parser, annotations, src_hashes, " + ".join(labels))
    out = Path(args.output)
    out.write_text("window.SCRIPT = "
                   + json.dumps(script, ensure_ascii=False, separators=(",", ":"))
                   + ";\n", encoding="utf-8")

    if args.skip_report:
        rep = [f"{reason}\t{lineno}\t{text}" for reason, lineno, text in parser.skipped]
        Path(args.skip_report).write_text("\n".join(rep) + "\n", encoding="utf-8")

    by_reason = {}
    for reason, _, _ in parser.skipped:
        by_reason[reason] = by_reason.get(reason, 0) + 1
    print(f"[parse_snz] units={len(parser.units)} scenes={script['meta']['sceneCount']} "
          f"lines={script['meta']['lineCount']} → {out}")
    for r in sorted(by_reason):
        print(f"  skip {r}: {by_reason[r]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
