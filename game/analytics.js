/* SCALAR: NODE ZERO — analytics.js (선택적·엔진 외부)
 *
 * 프라이버시 우선: 쿠키 0 · PII 0 · Do-Not-Track 존중 · 오프라인/차단 시 조용히 무동작.
 * 5레이어 엔진은 이 파일이 없거나 비활성이어도 한 글자도 다르지 않게 동작한다 (불변식 1: 0-dep).
 * 엔진의 이벤트 호출은 전부 `window.ANALYTICS && ...` 가드 — 이 파일은 순수 부가물.
 *
 * 활성화: 아래 ENDPOINT 에 GoatCounter 카운트 URL 을 넣으면 켜진다. 비우면 네트워크 호출 0.
 *   1) goatcounter.com 가입(무료·비영리) → 코드 선택(예: scalar-nodezero)
 *   2) ENDPOINT = "https://<코드>.goatcounter.com/count"
 *   3) 대시보드에서 방문/유입/이벤트(read/start·read/vol/NN·read/min/MM·read/end·read/judge/…) 확인
 * Plausible 등으로 바꾸려면 loadBeacon()/send() 두 곳만 교체.
 */
"use strict";
(function () {
  var ENDPOINT = "";  // ← 비어 있으면 비활성 (네트워크 호출 0). 운영 시 GoatCounter 카운트 URL.

  function dntOn() {
    var d = (typeof navigator !== "undefined" && (navigator.doNotTrack || navigator.msDoNotTrack))
      || (typeof window !== "undefined" && window.doNotTrack);
    return d === "1" || d === "yes";
  }
  var on = !!ENDPOINT && !dntOn() && typeof document !== "undefined";

  window.ANALYTICS = {
    enabled: on,
    /* 읽기 결 이벤트 — 페이지뷰가 아니라 '실제로 읽는가'. 실패해도 조용히. */
    event: function (name) {
      if (!on) return;
      try {
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({ path: name, title: name, event: true });
        }
      } catch (e) { /* 분석은 읽기를 방해하지 않는다 */ }
    },
  };

  if (!on) return;
  // 쿠키리스 비콘 — async, 실패/차단/오프라인 시 엔진 무영향. 초기 1회 방문 자동 집계.
  try {
    var s = document.createElement("script");
    s.async = true;
    s.src = "//gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", ENDPOINT);
    document.head.appendChild(s);
  } catch (e) { /* no-op */ }
})();
