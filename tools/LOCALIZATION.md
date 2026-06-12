# 언어판 추가 절차서 (Localization Guide)

> EN판 구축·교정(2026-06) 경험의 박제. 일본어판·중국어판(간체/번체) 등 후속 언어판은 이 절차를 따른다.
> **대원칙: KO(`manuscript/SNZ_Final_Part1~3.md` → `game/script.js`)가 구조 정본.** 언어판은 번역만 다르고
> 유닛 순서·권 소속·씬 구조·라인 수·연출 앵커까지 KO와 1:1이어야 한다 — `verify_parity.py`가 이를 강제한다.

## 0. 산출물 목록 (언어 코드 `xx` 기준)

| 산출물 | 경로 | 비고 |
|---|---|---|
| 원고 3부작 | `manuscript/SNZ_XX_Part1~3.md` | Part1=Vol.1~6, Part2=Vol.7~12, Part3=Vol.13~16+AE |
| 사이드카 | `tools/annotations/xx.json` | `en.json` 복제 후 수정 (아래 §3) |
| 빌드 | `game/script.xx.js` | 파서 산출물 — 직접 편집 금지 |
| 게임 통합 | `index.html` 로더, `stage.js` STR, `state.js` | 아래 §5 |

## 1. 절차 (순서 고정)

```bash
cd tools
# ① 빌드
python3 parse_snz.py ../manuscript/SNZ_XX_Part1.md ../manuscript/SNZ_XX_Part2.md ../manuscript/SNZ_XX_Part3.md \
        -o ../game/script.xx.js -a annotations/xx.json --skip-report skip_report_xx.txt
# ② 구조 패리티 (1차 게이트 — 여기서 원고 결함이 전부 드러난다)
python3 verify_parity.py ../game/script.xx.js
# ③ 원문 무결성 (원고 ↔ 빌드 양방향 전수)
python3 verify_integrity.py ../game/script.xx.js ../manuscript/SNZ_XX_Part*.md -a annotations/xx.json
# ④ 그래프 / 봉인 / 스모크
node validate_graph.mjs ../game/script.xx.js
python3 check_seals.py            # annotations·script 글롭 — 자동 포함됨
SNZ_LANG=xx node smoke_headless.mjs   # smoke에 언어 분기 추가 필요 (§5)
# ⑤ 실브라우저
node browser_test.mjs
```

②가 0건이 될 때까지 **원고를 고친다** (빌드나 검증기를 원고에 맞추지 말 것 — KO가 정본).
CI(`verify.yml`)는 `game/script.*.js` 전부에 패리티·무결성을 자동 적용한다.

## 2. 원고 형식 — 파서가 인식하는 것

- 씬 경계 `-----`, 배너 `=====`(5개 이상). 비어 있지 않은 한 줄 = lines[] 한 엔트리.
- 헤더 변형 (EN에서 실제 등장한 것 전부 지원):
  - 챕터: `## Vol.1 Ch.1 — Title` / `## Vol.6 — Ch.43 “Title”`
  - ◆ 배너: `## ◆ Daily Log — DL-01 “…”` + 내부 `## DL-01 “…” — 인물` (같은 유닛으로 병합)
  - 배너 없는 단독: `## BA-01 “…”` / `## Daily Log 13 — “…”` / `## Interlude 04 — “…”` (둘 다 지원 — **DL-13/14처럼 표기가 섞여 있을 수 있음**)
  - 무번호 Fragment 3편(ff01~03)은 등장 순서로 번호 부여 → **배치 순서가 곧 ID** (§4-1)
  - 제목이 달라 자동 매칭이 안 되는 유닛(EN Cold Open 사례)은 `unit_aliases`로 강제: `{"Letting Go": "co01"}`
- **인용부호**: 헤더 정규식은 `「」`·`“”`만 인식. 일판은 `「」`라 무수정 통과 예상,
  중판에서 `『』`·전각 따옴표를 쓰면 `parse_snz.py`의 `RE_PROLOGUE`/`RE_INLINE_SUB`/`RE_FRAGMENT` 문자 클래스에 추가할 것.

## 3. 사이드카 (annotations/xx.json) 작성 규칙

`en.json`을 복제한 뒤:

1. `faction`/`seeds`/`gate`/`unit_gates`/`reach_rules`/`sound`: **KO(all.json)와 동일하게** — 유닛/씬 ID 체계가 같으므로 그대로 둔다. 게이트는 17건 전부 (EN 16건 시절 기록은 폐기됨).
2. `fx`/`interaction` 라인 앵커: 패리티 100%면 KO와 같은 씬 ID·라인 인덱스가 그대로 맞는다. 단 **앵커 라인의 번역문이 의도(잔향·소실·균열 등)와 결이 맞는지 육안 확인** 후 확정.
3. `interaction`의 `choices` 텍스트만 해당 언어로 번역 (예: EN `["Answer","ARIA"]`).
4. **auto_fx 금지 — 명시 앵커만.** KO는 정형구 자동 태깅을 쓰지만 번역문은 서로 다른 KO 문장이 같은 문장으로 수렴해 과발화한다
   (실사례: KO `잠깐이 있었다.`(트리거)와 `잠깐 있었다.`(비트리거)가 EN에서 둘 다 "There was a pause."). pause_b 8곳의 명시 앵커를 `en.json`에서 복사.
5. `drop_ranges` 금지 — 원고 결함은 원고에서 고친다 (EN에서 메커니즘 폐기).

## 4. 함정 카탈로그 — EN에서 실제 발견된 결함 유형과 검출 방법

전부 `verify_parity.py`가 잡는다. 증상별 대응:

| # | 결함 (EN 실사례) | 패리티 출력 | 대응 |
|---|---|---|---|
| 1 | **유닛 재배치** — 15개가 KO와 다른 위치 (BA-01이 Part1 말미, FF 3편이 서두 묶음, in06은 자기 배치주석과도 불일치) | `유닛 순서 불일치` diff | 원고에서 블록 이동. `en_restructure.py` 패턴(경계 전수 단언 → 절단 → 삽입) 참고 |
| 2 | **번역 초고 중복** — DL-01/02/09가 초고+개정본 2회 수록 | `유닛 집합 불일치` (잉여 `dl01_2` 등) | KO 씬 구조와 1:1인 판(◆ 배너판)만 남기고 초고 삭제 |
| 3 | **씬 오귀속** — KO ff01 4번째 씬(Dawn)이 DL-01 초고 뒤에 붙어 있었음. *"원작에 없는 추가 창작"으로 오판하기 쉬움 — 반드시 KO 전 유닛과 씬/라인 구조 대조 후 판단* | 한쪽 유닛 씬 수 부족 + 다른 곳 잉여 | 제자리로 이동 (삭제 아님) |
| 4 | **임의 씬 분할/병합** — v06_c043 s03이 4+12로 쪼개짐 | `씬 구조: KO [16] ≠ [4,12]` | 잉여 `-----` 제거 (또는 누락 시 삽입) |
| 5 | **잉여/결락 문단** — KO에서 삭제된 IN-03 문단의 번역이 잔존; ss04 봉인주석·v05_c042 표지 결락 | 씬 라인 수 ±1 | KO 기준으로 삭제/보충. 서사 문단 삭제 시 internal-notes(비공개)에 원문 보관 |
| 6 | **편집 잔재 누수/과스킵** — `**— Volume 1, end —**`(쉼표 변형)가 본문으로 누수; `*Vol.N Block — end*`(KO는 본문 렌더)가 과스킵 | 씬 수 ±1 (유닛 꼬리) | `parse_snz.py` EDITORIAL_PATTERNS 조정. **분류 규칙(확정)**: KO가 스킵하면 스킵, KO가 렌더하면 렌더, KO에 대응물이 없으면 원고에서 삭제 |
| 7 | **Volume 헤더 위치 차이** → 서브 유닛 권 소속(vol/arc) 어긋남 | `{unit}.vol: KO n ≠ m` | `# Volume N` 헤더 위치를 KO와 일치 (서브 유닛은 시작 시점의 cur_vol 상속) |
| 8 | **헤더 중복** — `# Volume 3` 2회 등 | 보통 #7로 발현 | 1개만 남김 |

KO가 **본문으로 렌더하는 메타 라인** (번역판에도 있어야 함 — 작품의 메타 장치, L0 확정):
`*Vol.N Block M [전면판] 종료*` 12곳 · `*全 16卷 200章 + BA 4 + SS 8 + AE 4 — 完結*` 1곳 ·
ss04 서두 `*기원 봉인 유지 — …*` · v05_c042 꼬리 `*캐릭터 빌드업 · 정치역학 · 호흡 조절*` ·
각 유닛 서두의 이탤릭 배경 표지(`*— 지금으로부터 한참 뒤, …*` 류) · 작중 로그 이탤릭(`*다음은 당신입니다.*` 등).
— 외울 필요 없음: 패리티 라인 수 대조가 자동 검출.

## 5. 게임 통합 체크리스트

- [ ] `index.html` 로더의 언어 분기: `script' + (lang === "en" ? ".en" : ...)` 확장 + 언어 판별(`navigator.language`)
- [ ] `state.js`: `SUF` 키 접미사에 새 언어 추가 (진행 상태 언어별 분리)
- [ ] `stage.js`: `window.STR` 테이블에 새 언어 UI 문언 (타이틀 버튼·도달 상태·제스처 힌트·묻지 않은 것들)
- [ ] 타이틀 `showTitle()`의 언어 토글 배열에 `["xx", "표기명"]` 추가
- [ ] `smoke_headless.mjs`: `T` 문언 테이블 + `SNZ_LANG=xx` 분기 (expGates는 17 고정 — 언어 분기 금지)
- [ ] `browser_test.mjs` [6] 언어 전환 시나리오에 케이스 추가
- [ ] `verify.yml`: 무결성 스텝 추가 (패리티·봉인은 글롭이라 자동)
- [ ] `README.md` 언어 표기 갱신
- [ ] 봉인 5종 비접촉 육안 검수 — 신규 텍스트(UI 문언·choices 번역) 한정

## 6. 완료 기준

패리티 100% (유닛 255 · 씬 1,366 · 라인 11,608 — KO와 동일 수치) ·
무결성 100% · 그래프 무결 · 봉인 0건 · 스모크/브라우저 전부 통과 · CI green.
