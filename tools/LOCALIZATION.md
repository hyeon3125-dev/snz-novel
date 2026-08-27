# 언어판 추가 절차서

> 한국어 5부작(`manuscript/SNZ_KO_Part1~5.md`)이 구조 정본입니다. 번역판은 문장만 달라지고 유닛 순서, Part·Chapter, 씬 경계, 라인 수, 연출 위치는 1:1이어야 합니다.

## 산출물

언어 코드가 `xx`라면 다음만 추가합니다.

- `manuscript/SNZ_XX_Part1.md` … `SNZ_XX_Part5.md`
- `tools/annotations/xx.json` — 번역이 필요한 선택지·효과 낱말만
- `game/script.xx.js` — 파서가 만드는 산출물; 직접 편집하지 않음

공통 연출·가문·복선·회수 게이트는 모두 `tools/annotations/base.json`에 있습니다. 언어별 파일에 복제하지 마세요.

## 번역 규칙

1. KO의 헤더와 `-----` 씬 경계를 같은 위치에 둡니다.
2. 비어 있지 않은 KO 한 줄은 번역판에서도 정확히 한 줄입니다. 문단을 합치거나 쪼개지 않습니다.
3. 헤더는 `# Part N`, `## Part.N Ch.N — 제목`, `## Interlude N`, `## Epilogue` 형식을 유지합니다.
4. 대화·독백·이탤릭의 형태를 보존합니다. 한국어 문장을 그대로 남기거나 편집 메모를 넣지 않습니다.
5. 호칭과 존댓말은 단어 치환이 아니라 관계 변화의 시점에 맞춰 번역합니다.

## 언어별 사이드카

최소 파일은 다음 형태입니다.

```json
{
  "fx": {
    "p04_c057_s11": {
      "0": { "word": "localized blank word" }
    }
  },
  "interaction": {
    "in02_s02": {
      "choices": ["localized answer", "ARIA"]
    }
  }
}
```

씬 ID와 줄 번호는 KO와 같습니다. `base.json`의 공통 설정을 언어 파일에 다시 적지 않습니다.

## 빌드와 검증

`package.json`에 해당 언어의 빌드 명령을 한 줄 추가한 뒤 아래 게이트를 통과시킵니다.

```bash
npm run build
python3 tools/verify_rebuild.py game/script.xx.js manuscript/SNZ_XX_Part*.md \
  -a tools/annotations/base.json -a tools/annotations/xx.json
python3 tools/verify_integrity.py game/script.xx.js manuscript/SNZ_XX_Part*.md \
  -a tools/annotations/base.json -a tools/annotations/xx.json
python3 tools/verify_parity.py game/script.xx.js
node tools/validate_graph.mjs game/script.xx.js
python3 tools/check_seals.py
SNZ_LANG=xx node tools/smoke_headless.mjs
```

완료 기준은 결정론적 재빌드, 원문 위치·순서 무결성, KO 구조·연출 패리티, 그래프, 봉인, 완주 스모크가 모두 통과하고 번역 표식 및 한국어 잔존이 0건인 상태입니다. 마지막으로 실제 브라우저에서 제목, 언어 전환, 선택지, 목차, 이어읽기를 확인합니다.
