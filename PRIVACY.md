# Privacy · 프라이버시

## English

**The reading engine collects nothing and needs no network.** Your progress, underlines, and reading-pace data are stored only in your own browser (`localStorage`) and never leave your device.

The hosted page may additionally include an **optional, cookieless analytics beacon**:

- **No cookies. No fingerprinting. No personal data.** Visits are counted without identifying you.
- **Do-Not-Track is honoured** — if your browser sends DNT, nothing is sent.
- It records only **aggregate reading-depth signals**: reading started/resumed, which volume was reached, time-spent milestones (5 / 20 / 60 min), and completion. This answers one question — *is the work actually being read?* — not *who* is reading.
- It is loaded **outside the reading engine**, deferred and failure-tolerant. If it is disabled, blocked, or you are offline, the story works identically.
- In this source it is **off by default** (`game/analytics.js`, `ENDPOINT = ""`). When enabled, it uses [GoatCounter](https://www.goatcounter.com/) — an open-source, privacy-first, cookieless analytics service. Data, if collected, belongs to the project, not an ad network.

To opt out beyond DNT: block `gc.zgo.at`, or read offline / from a local clone — the experience is unchanged.

## 한국어

**읽기 엔진은 아무것도 수집하지 않고 네트워크도 필요 없습니다.** 진행 상태·밑줄·읽기 속도 데이터는 전부 본인 브라우저(`localStorage`)에만 저장되며 기기를 떠나지 않습니다.

호스팅된 페이지는 **선택적인 쿠키리스 분석 비콘**을 추가로 포함할 수 있습니다:

- **쿠키 없음. 핑거프린팅 없음. 개인정보 없음.** 신원을 식별하지 않고 방문만 셉니다.
- **Do-Not-Track 존중** — 브라우저가 DNT를 보내면 아무것도 전송하지 않습니다.
- 기록하는 것은 **집계된 읽기 깊이 신호**뿐입니다: 읽기 시작/이어읽기, 도달한 권, 체류 시간 구간(5 / 20 / 60분), 완독. *작품이 실제로 읽히는가*만 보고, *누가* 읽는지는 보지 않습니다.
- **읽기 엔진 밖에서** 지연 로드되며 실패에 관대합니다. 비활성·차단·오프라인이어도 이야기는 동일하게 동작합니다.
- 이 소스에서는 **기본 비활성**입니다(`game/analytics.js`, `ENDPOINT = ""`). 활성화 시 [GoatCounter](https://www.goatcounter.com/)(오픈소스·프라이버시 우선·쿠키리스)를 사용하며, 수집되더라도 데이터는 광고 네트워크가 아니라 프로젝트 소유입니다.

DNT 외에 추가로 거부하려면: `gc.zgo.at`를 차단하거나, 오프라인/로컬 클론으로 읽으면 됩니다 — 경험은 동일합니다.
