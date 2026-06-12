<div align="center">

# SCALAR: NODE ZERO

**결정론적 인터랙티브 노벨 · A Deterministic Interactive Novel**

<br/>

[![](https://img.shields.io/badge/📖_16_Volumes_·_200_Chapters_+_46_Side_Stories-F37021?style=for-the-badge&labelColor=111111)](manuscript/)
[![](https://img.shields.io/badge/🎮_Play_in_Browser-F37021?style=for-the-badge&labelColor=111111)](https://hyeon3125-dev.github.io/snz-novel/)

[![](https://img.shields.io/badge/No_AI_·_No_Server_·_No_Build-111111?style=flat-square&labelColor=111111&color=222222)](#구조--architecture)
[![](https://img.shields.io/badge/Runtime_Dependencies-0-F37021?style=flat-square&labelColor=111111)](game/)
[![](https://img.shields.io/badge/Content-CC_BY--NC--SA_4.0-F37021?style=flat-square&labelColor=111111)](LICENSE-CONTENT.md)
[![](https://img.shields.io/badge/Code-MIT-F37021?style=flat-square&labelColor=111111)](LICENSE)
[![verify](https://github.com/hyeon3125-dev/snz-novel/actions/workflows/verify.yml/badge.svg)](https://github.com/hyeon3125-dev/snz-novel/actions/workflows/verify.yml)

<br/>

### ▶ 지금 바로 플레이 · Play now
**[hyeon3125-dev.github.io/snz-novel](https://hyeon3125-dev.github.io/snz-novel/)**
설치 없음 · 회원가입 없음 · 폰/PC 브라우저면 충분 — *no install, no signup, just a browser*

</div>

---

```
A complete psychological-SF novel that runs as a game in your browser.
No AI. No server. No build step. Zero runtime dependencies.
The full manuscript ships in this repo — read it as markdown, or play it.
```

심리 SF 장편 『SCALAR: NODE ZERO』의 **완결 원고 전문과 그것을 옮긴 인터랙티브 노벨**입니다.
원고도, 게임도, 엔진도 전부 이 레포에 있습니다 — 문화를 향유하는 데 자본이 발목 잡을 이유가 없기 때문입니다.
비영리 향유·공유·2차 창작은 자유, 상업적 이용만 별도 라이선스가 필요합니다.

*Everything is in this repository — the manuscript, the game, the engine. Culture should not be gated by capital: non-commercial reading, sharing, and derivative works are free. Only commercial use requires a separate license.*

---

## Read / Play · 읽기 / 플레이

**🎮 As a game** — open **[hyeon3125-dev.github.io/snz-novel](https://hyeon3125-dev.github.io/snz-novel/)** in any browser. That's it.
**게임으로** — 위 링크를 브라우저에서 열면 끝입니다. 폰도 됩니다(진동·흔들기 인터랙션은 폰이 더 좋습니다). 진행은 자동 저장되어 닫았다 열면 읽던 곳에서 이어집니다.

**📖 As a novel** — read the markdown three-parter in [`manuscript/`](manuscript/) directly.
**원고로** — [`manuscript/`](manuscript/)의 마크다운 3부작을 그대로 읽으면 됩니다.

**🛠 For developers** — static files; clone and serve locally, fully offline-capable.
**개발자용** — 정적 파일이라 클론 후 아무 웹서버로나 열리고, 오프라인에서도 동작합니다.

```bash
git clone git@github.com:hyeon3125-dev/snz-novel.git
cd snz-novel/game
python3 -m http.server 4100        # or npx serve, nginx, GitHub Pages …
# → http://localhost:4100
```

| | EN | KR |
|---|---|---|
| **Advance** | Tap / click / space — the pace belongs to the reader | 탭/클릭/스페이스 — 읽는 속도는 전적으로 독자의 것 |
| **Interactions** | Hold · release · stay silent · shake · trace. Not choosing is also recorded as a choice | 길게 누르기·놓기·침묵·흔들기·따라 긋기. 선택하지 않는 것도 선택으로 기록 |
| **Save** | Automatic (localStorage) — reopen and continue | 자동 저장 — 닫았다 열면 읽던 곳에서 |
| **Accessibility** | Respects reduced-motion; every gesture has a tap fallback | 움직임 축소 존중, 모든 제스처에 탭 대체 경로 |

> **🛠 "나도 이런 걸 만들어 보고 싶다"** — 내 소설로 이런 게임을 만들고 싶거나, 이런 아키텍처를 직접 만들어 보고 싶다면: **[만들기 가이드 → GUIDE.md](GUIDE.md)**. 코딩을 몰라도 따라올 수 있게 썼고, 전 과정이 무료입니다.
> *Want to make your own? See the [maker's guide](GUIDE.md) — written for non-developers too, every step free.*

---

## 구조 · Architecture

```
manuscript/   the canonical manuscript — source of everything   원고 전문 (정본)
game/         the game — static files, zero deps                게임 본체
tools/        conversion & verification pipeline                변환·검증 파이프라인
```

**5-layer engine** — facts and presentation are both deterministic; the same choices always tell the same story.
**5레이어 엔진** — 사실 판단도 표현도 결정론적. 같은 선택은 언제나 같은 이야기.

```
script → state → director → stage → input → main
(각본)   (진행)   (연출결정)   (렌더)   (입력)
```

| File | Role · 역할 |
|---|---|
| `game/script.js` | **The entire script as data** (machine-converted from manuscript) — 1,366 scenes · 11,608 lines · 각본 데이터 전체, 코드가 아니라 데이터 |
| `game/state.js` | Progress · foreshadow tracking · saves — 진행·복선 추적·세이브 (localStorage) |
| `game/director.js` | Scene → stage command compiler; recall gates & reach states — 연출 결정·회수 게이트·도달 상태 판정 |
| `game/stage.js` | Rendering · 8 staging effects · 7 faction text grammars · procedural Web Audio — 렌더·연출 8종·가문 문법 7종·절차 합성 사운드 |
| `game/input.js` | Input normalization + 6 gesture interactions — 입력 정규화 + 제스처 6종 |
| `game/main.js` | Bootstrap & orchestration — 부트스트랩·오케스트레이션 |

---

## 설계 원칙 · Design Principles

1. **Staging translates prose, never decorates it** — no effect without textual grounding; when one effect speaks, everything around it stays silent.
   **연출은 장식이 아니라 문체의 번역** — 원고에 근거 없는 효과는 없다. 효과 1개가 들어가면 주변은 침묵.
2. **Faction themes are text grammar, not color** — ledger prefixes (Hwagam), a lens mask (Eidos), numeric columns (Altair), ruled paper margins (Geumhwi), a near-empty screen (Gongga), drifting glyphs (Observer).
   **가문 테마는 색이 아니라 텍스트 문법** — 기록 양식 프리픽스·렌즈 마스크·수치 컬럼·괘선과 여백·비어 있는 화면·표류하는 글자.
3. **Not choosing is a record, not a failure** — unanswered choices accumulate and shape the ending's reach state.
   **비선택은 실패가 아니라 기록** — 고르지 않은 것들이 쌓여 결말부 도달 상태에 반영된다.
4. **One ending; branches are reach states** — 16 foreshadow recalls "ring only for those who saw them". What you missed stays missed.
   **엔딩은 하나, 분기는 도달 상태** — 복선 16건의 회수는 "본 사람에게만 울린다".
5. **Silence is the default soundtrack** — every sound is procedurally synthesized via Web Audio; zero audio assets.
   **기본값은 정적(靜寂)** — 모든 소리는 Web Audio 절차 합성. 오디오 에셋 0개.

---

## 원고 불변 원칙 · Manuscript Integrity

Every narrative line in the game is **byte-identical** to the manuscript — a bidirectional exhaustive diff (`verify_integrity.py`) gates every build, re-verified by CI on every push. All game metadata (staging, interactions, recall gates) lives in a sidecar ([`tools/annotations/all.json`](tools/annotations/all.json)), each entry annotated with its textual grounding.

게임의 모든 서사 라인은 원고와 **한 글자도 다르지 않습니다.** 빌드 게이트가 양방향 전수 대조하고, CI가 매 푸시마다 재검증합니다. 연출·인터랙션·복선 게이트 등 게임 메타데이터는 전부 사이드카에 있으며 항목마다 원고 근거를 주석으로 답니다.

```bash
cd tools
python3 parse_snz.py ../manuscript/SNZ_Final_Part1.md ../manuscript/SNZ_Final_Part2.md ../manuscript/SNZ_Final_Part3.md \
        -o ../game/script.js -a annotations/all.json      # manuscript → script data
python3 verify_integrity.py ../game/script.js ../manuscript/SNZ_Final_Part*.md \
        -a annotations/all.json                            # gate: 100% verbatim, both directions
node validate_graph.mjs ../game/script.js                  # scene graph: reachability · orphans · cycles
python3 check_seals.py                                     # narrative seals stay sealed
node smoke_headless.mjs                                    # 26 headless regression checks
```

---

## 라이선스 · License

| | License | Terms |
|---|---|---|
| **Narrative content** 서사 콘텐츠 (원고·각본 데이터·설정) | [CC BY-NC-SA 4.0](LICENSE-CONTENT.md) | Non-commercial enjoyment, sharing, and derivatives are free. Commercial use (publishing · merchandise · adaptations · commercial AI training) requires a separate license — 상업적 이용은 별도 계약 |
| **Code** 코드 (엔진·도구·스타일) | [MIT](LICENSE) | Free for any use — 제한 없음 |

---

<div align="center">

*Scalar Inc. · Seoul, Korea · 2026*

</div>
