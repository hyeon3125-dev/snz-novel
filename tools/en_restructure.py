#!/usr/bin/env python3
"""EN 원고 구조 교정 (1회성 수술 스크립트, 실행 후 기록용으로 보존).

KO 정본(SNZ_Final_Part1~3)의 물리 배치를 기준으로 EN 3부작을 일치시킨다:
- 유닛 15개 재배치 (ba01, ff01~03, dl07, in03, dl08, dl13, ss01, dl03, dl10, ss02, ss11, ss03, in06)
- 번역 초고 중복 블록 물리 삭제 (DL-01/02/09 — 정본은 ◆ 배너판)
- Dawn 씬은 KO ff01 4번째 씬의 번역 — 초고 블록에서 분리해 제자리(ff01 뒤·Vol.3 헤더 뒤)에 보존
- KO가 본문으로 렌더하는 메타 라인의 EN 누락분 보충 (ss04 봉인 유지 주석, v05_c042 인터루드 표지)
- EN 신규 잔재 삭제 (중복 Vol.3 헤더, 삼중 구분자, in03 잉여 문단 — 잉여 문단은 internal-notes 보관)

모든 절단·삽입 경계는 내용 단언 후에만 수행 — 단언 실패 시 파일 무변경.
"""
from pathlib import Path

MS = Path(__file__).parent.parent / "manuscript"


def load(name):
    return (MS / name).read_text(encoding="utf-8").split("\n")


def save(name, lines):
    (MS / name).write_text("\n".join(lines), encoding="utf-8")


def expect(lines, lineno, prefix):
    got = lines[lineno - 1]
    assert got.startswith(prefix), f"line {lineno}: expected {prefix!r}, got {got!r}"


def cut(lines, a, b):
    """1-based inclusive [a,b] 절단 — 절단된 블록을 반환, 원본은 None 마킹."""
    block = [l for l in lines[a - 1:b] ]
    for i in range(a - 1, b):
        lines[i] = None
    return block


# ════════ Part 1 ════════
p1 = load("SNZ_EN_Part1.md")
SEP = "-----"
BAN = "=" * 60

expect(p1, 73, "# SCALAR: NODE ZERO")
expect(p1, 75, "## Fragment — “Hold”")
expect(p1, 103, SEP)
expect(p1, 105, "# SCALAR: NODE ZERO")
expect(p1, 107, "## Fragment — “The Cell”")
expect(p1, 133, SEP)
expect(p1, 135, "# SCALAR: NODE ZERO")
expect(p1, 137, "## Fragment — “Was”")
expect(p1, 167, SEP)
expect(p1, 169, BAN[:5])
ff01 = cut(p1, 73, 104)
ff02 = cut(p1, 105, 134)
ff03 = cut(p1, 135, 168)

# DL-01 번역 초고 삭제 (정본 ◆판은 2975~) — Dawn(2957~2969)은 ff01 4씬으로 잔류
expect(p1, 2901, BAN[:5])
expect(p1, 2903, "# SCALAR: NODE ZERO")
expect(p1, 2905, "## DL-01 “Never Asked” — Hangyeol·Dohee")
expect(p1, 2943, "*DL-01 “Never Asked” — end*")
expect(p1, 2945, BAN[:5])
expect(p1, 2947, "# SCALAR: NODE ZERO (EN)")
expect(p1, 2949, "# Volume 3 — Anomalous")
expect(p1, 2951, "# Volume 3 — Anomalous")   # 중복 헤더 (EN 신규 잔재)
expect(p1, 2953, SEP)
expect(p1, 2955, SEP)                         # 중복 구분자
expect(p1, 2957, "Dawn.")
cut(p1, 2903, 2946)
cut(p1, 2951, 2952)
cut(p1, 2955, 2956)
p1[2902 - 1] += "\n" + "\n".join(ff01).rstrip("\n") + "\n"   # ff01 → Vol.2 종료 직후 (KO 2901)

# ff02 → Vol.3 Ch.18 종료 직후, Volume 4 헤더 앞 (KO 3889)
expect(p1, 3905, BAN[:5])
expect(p1, 3907, "# Volume 4 — Divergence")
p1[3904 - 1] += "\n" + "\n".join(ff02).rstrip("\n") + "\n"

# DL-02/DL-09 번역 초고 삭제 (정본 ◆판은 7107~) + ff03 → Ch.30 종료 직후 (KO 7004)
expect(p1, 6991, BAN[:5])
expect(p1, 6993, "# SCALAR: NODE ZERO")
expect(p1, 6995, "## DL-02 “The Shape” — ARIA·Hangyeol")
expect(p1, 7101, "# Volume 5 — Role + Interlude")
cut(p1, 6991, 7100)
p1[6990 - 1] += "\n" + "\n".join(ff03).rstrip("\n") + "\n"

# v05_c042 꼬리: 삼중 구분자(EN 신규 잔재) → KO 10021~10023 미러 (인터루드 표지 + 메타 라인)
expect(p1, 10076, SEP)
expect(p1, 10078, SEP)
expect(p1, 10080, SEP)
expect(p1, 10082, "## Archive-02 — “The Blank”")
cut(p1, 10078, 10081)
p1[10076 - 1] += "\n\n# Interlude — after Vol.5 / before Vol.6\n\n*Character build-up · political dynamics · pacing*\n"

# v06_c043 s03 임의 분할 제거 (KO는 한 씬)
expect(p1, 10583, "“I know.”")
expect(p1, 10585, SEP)
expect(p1, 10587, "A third document.")
cut(p1, 10585, 10586)

# BA-01 → Prologue 직후, Volume 1 앞 (KO 71)
expect(p1, 10435, BAN[:5])
expect(p1, 10437, "# SCALAR: NODE ZERO")
expect(p1, 10439, "## BA-01 “Seoan’s Eye”")
expect(p1, 10527, "*BA-01 “Seoan’s Eye” — end*")
expect(p1, 10529, BAN[:5])
expect(p1, 10531, "# Volume 6 — Convergence Arc")
ba01 = cut(p1, 10437, 10528)
expect(p1, 71, BAN[:5])
p1[72 - 1] += "\n" + "\n".join(ba01).rstrip("\n") + "\n"

# 파트 표지의 구성 설명도 새 순서로
expect(p1, 5, "*(Prologue / FF / Ch.1~62 / DL / BA-01)*")
p1[5 - 1] = "*(Prologue / BA-01 / Ch.1~62 / FF / DL)*"

save("SNZ_EN_Part1.md", [l for l in p1 if l is not None])

# ════════ Part 2 ════════
p2 = load("SNZ_EN_Part2.md")

# dl07 → ba02 직후, Volume 8 앞 (KO 2001)
expect(p2, 1985, "*BA-02")
expect(p2, 1987, BAN[:5])
expect(p2, 1989, "# Volume 8 — First Decode Arc")
expect(p2, 3333, BAN[:5])
expect(p2, 3337, "## DL-07 “A Rainy Day” — ARIA·Hangyeol")
expect(p2, 3379, "*DL-07")
dl07 = cut(p2, 3333, 3380)

# in03: 잉여 문단(5191) 제거 — KO 정본에서 삭제된 문단의 번역 (internal-notes 보관)
expect(p2, 5189, "This time, too, it remained.")
expect(p2, 5191, "This time too. That person knew the weight")
expect(p2, 5195, "*Interlude-03 “A Moment” — end*")
expect(p2, 5197, "*Placement: right after Vol.9")
expect(p2, 5199, SEP)
cut(p2, 5191, 5192)
expect(p2, 5041, "## Interlude-03 “A Moment”")
in03 = cut(p2, 5041, 5199)
while in03 and not (in03[-1] or "").strip().startswith("*Placement"):
    in03.pop()
in03 = [l for l in in03 if l is not None]

# dl08 (KO: in03 직후, ba04 앞)
expect(p2, 7215, BAN[:5])
expect(p2, 7219, "## DL-08 “A Day Off” — Kangwi·Muyul")
expect(p2, 7261, "*DL-08")
expect(p2, 7263, BAN[:5])
expect(p2, 7265, "# Volume 11 — Fracture Arc")
dl08 = cut(p2, 7215, 7262)

# in03 + dl08 → dl06 직후, ba04 앞 (KO 5283·5441)
expect(p2, 5421, "*DL-06")
expect(p2, 5423, BAN[:5])
p2[5422 - 1] += "\n" + BAN + "\n\n# SCALAR: NODE ZERO\n\n" + "\n".join(in03).rstrip("\n") + "\n\n" + "\n".join(dl08).rstrip("\n") + "\n"

# dl13·ss01·dl03·dl10 → in05 직후 (KO 7283~7574, 순서 dl13→ss01→dl03→dl10)
expect(p2, 8429, BAN[:5])
expect(p2, 8433, "## SS-01 “The Verifier” — Gadeung")
expect(p2, 8537, "*SS-01")
expect(p2, 8539, BAN[:5])
expect(p2, 8543, "## DL-03")
expect(p2, 8593, "*DL-03")
expect(p2, 8595, BAN[:5])
expect(p2, 8599, "## DL-10")
expect(p2, 8643, "*DL-10")
expect(p2, 8645, BAN[:5])
expect(p2, 8649, "## Daily Log 13")
expect(p2, 8694, "*DL-13")
expect(p2, 8696, BAN[:5])
ss01 = cut(p2, 8429, 8538)
dl03 = cut(p2, 8539, 8594)
dl10 = cut(p2, 8595, 8644)
dl13 = cut(p2, 8645, 8695)
expect(p2, 7213, "*Interlude 05")
group = "\n".join(dl13 + ss01 + dl03 + dl10).rstrip("\n")
p2[7214 - 1] += "\n" + group + "\n"

# ss02·ss11 → dl14 직후, Volume 12 앞 (KO 8785~9003, 순서 ss02→ss11)
expect(p2, 9923, BAN[:5])
expect(p2, 9927, "## SS-11 “Without the Lens” — Tiko")
expect(p2, 9969, "*SS-11")
expect(p2, 9971, BAN[:5])
expect(p2, 9975, "## SS-02 “The Observer” — Tiko")
expect(p2, 10123, "*SS-02")
expect(p2, 10125, BAN[:5])
ss11 = cut(p2, 9923, 9970)
ss02 = cut(p2, 9971, 10124)
expect(p2, 8743, "*DL-14")
expect(p2, 8745, BAN[:5])
expect(p2, 8747, "# Volume 12 — Fracture Arc 2")
p2[8744 - 1] += "\n" + "\n".join(ss02 + ss11).rstrip("\n") + "\n"

save("SNZ_EN_Part2.md", [l for l in p2 if l is not None])

# ════════ Part 3 ════════
p3 = load("SNZ_EN_Part3.md")

# ss03 → ss06 직후 (KO 1346)
expect(p3, 1246, BAN[:5])
expect(p3, 1250, "## SS-03 “Enduring” — Hangyeol")
expect(p3, 1372, "*SS-03")
expect(p3, 1374, BAN[:5])
ss03 = cut(p3, 1246, 1373)
expect(p3, 1456, "*SS-06")
expect(p3, 1458, BAN[:5])
p3[1457 - 1] += "\n" + "\n".join(ss03).rstrip("\n") + "\n"

# ss04: 봉인 유지 주석 보충 (KO 2693 — 본문 렌더 라인)
expect(p3, 2654, "*Placement: mid-Vol.14*")
p3[2654 - 1] += "\n\n*Origin seal maintained — no disclosure of ARIA’s origin in this file*"

# in06 → Ch.195와 Ch.196 사이 (KO 4737 — 자기 배치 주석과도 일치)
expect(p3, 4000, BAN[:5])
expect(p3, 4004, "## Interlude 06 — “The Last Table”")
expect(p3, 4092, "*Interlude 06")
expect(p3, 4094, BAN[:5])
expect(p3, 4096, "# Volume 16 — Final Arc")
in06 = cut(p3, 4000, 4093)
expect(p3, 4776, "*Ch.195")
expect(p3, 4778, SEP)
expect(p3, 4780, "## Vol.16 — Ch.196 “Before the Choice”")
p3[4779 - 1] += "\n" + "\n".join(in06).rstrip("\n") + "\n"

save("SNZ_EN_Part3.md", [l for l in p3 if l is not None])
print("EN 구조 교정 완료 — 단언 전부 통과")
