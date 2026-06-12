/* SCALAR: NODE ZERO — input.js
 * 입력 수집·정규화 (Architecture v2.0 §2, §5).
 * 기본 진행: 탭/클릭/스페이스/엔터 → advance.
 * 인터랙션 6종 (§5-2): hold / release / silence / timeout_choice / shake / trace.
 * 접근성 (§5-4): settings.holdAssist → 모든 제스처를 탭으로 대체.
 */
"use strict";

window.INPUT = (function () {
  const handlers = { advance: [], any: [] };
  let enabled = false;
  let gesture = null;      // 진행 중인 제스처 {spec, resolve, cleanup...}
  let lockUntil = 0;       // fx 강제 박자 (pause_b/seat)

  function emit(name, payload) {
    (handlers[name] || []).forEach((fn) => fn(payload));
  }
  function isInteractive(el) {
    return !!(el && el.closest && el.closest("button, a, input, [data-no-advance]"));
  }
  function now() { return Date.now(); }

  /* ── 기본 진행 ── */
  function onTap(e) {
    if (gesture) return;                  // 제스처 중엔 일반 진행 정지
    if (!enabled || now() < lockUntil) return;
    if (isInteractive(e.target)) return;
    emit("advance", { via: "tap" });
  }
  function onKey(e) {
    emit("any", {});
    if (gesture) return;
    if (!enabled || now() < lockUntil) return;
    if (e.code === "Space" || e.code === "Enter") {
      if (isInteractive(document.activeElement)) return;
      e.preventDefault();
      emit("advance", { via: "key" });
    }
  }

  function init() {
    document.addEventListener("click", (e) => { emit("any", {}); onTap(e); });
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", (e) => { emit("any", {}); markPressStart(e); });
    document.addEventListener("pointermove", markPressMove);
    document.addEventListener("pointerup", markPressEnd);
    document.addEventListener("pointercancel", markPressEnd);
  }

  /* ── 밑줄 (길게 누르기) — 독자가 남기는 기록. 제스처 중·진행 락 중엔 비활성 ── */
  let press = null;  // {el, x, y, timer}
  function markPressStart(e) {
    if (!e || gesture || !enabled) return;
    const el = e.target && e.target.closest && e.target.closest(".line");
    if (!el) return;
    press = {
      el, x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        emit("mark", { el });
        lockUntil = Math.max(lockUntil, now() + 450);  // 손을 떼며 생기는 탭 진행 흡수
        press = null;
      }, 600),
    };
  }
  function markPressMove(e) {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) markPressEnd();
  }
  function markPressEnd() {
    if (press) { clearTimeout(press.timer); press = null; }
  }

  /* ── Easter egg shake (§v2.1 2-1) — 안내·차단·기록 없음, 응답만. disarm 함수 반환 ── */
  function armShakeEgg(onShake) {
    let last = null, energy = 0, lastX = null, sw = 0, fired = false;
    const fire = () => { if (!fired) { fired = true; onShake(); } };
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      if (last) energy += Math.abs(a.x - last.x) + Math.abs(a.y - last.y);
      last = { x: a.x, y: a.y };
      if (energy > 60) fire();
    };
    const onMove = (e) => {
      if (lastX !== null && Math.abs(e.clientX - lastX) > 24) sw++;
      lastX = e.clientX;
      if (sw > 14) fire();
    };
    if (typeof window.addEventListener === "function") {
      window.addEventListener("devicemotion", onMotion);
      document.addEventListener("pointermove", onMove);
    }
    return () => {
      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("devicemotion", onMotion);
        document.removeEventListener("pointermove", onMove);
      }
    };
  }

  /* ── 제스처 공통 ── */
  function settings() { return window.STATE.getSettings(); }

  function finishGesture(result) {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.timer) clearTimeout(g.timer);
    if (g.interval) clearInterval(g.interval);
    (g.cleanups || []).forEach((fn) => fn());
    g.resolve(result || {});
  }

  function listen(target, name, fn) {
    target.addEventListener(name, fn);
    gesture.cleanups.push(() => target.removeEventListener(name, fn));
  }

  /* spec.type별 제스처 가동. resolve(result)로 완료.
   * result: {unchosen:true} | {choice:"…"} | {} */
  function requestGesture(spec, ui) {
    return new Promise((resolve) => {
      gesture = { spec, resolve, cleanups: [] };
      const s = settings();

      // 접근성/테스트: 탭 대체 경로 (§5-4)
      if (s.autoResolveInteractions) {
        const r = spec.type === "timeout_choice"
          ? (s.autoSkipChoices ? { unchosen: true } : { choice: spec.choices[0] })
          : {};
        return finishGesture(r);
      }
      if (s.holdAssist && spec.type !== "timeout_choice") {
        listen(document, "click", function once() { finishGesture({}); });
        return;
      }

      switch (spec.type) {
        case "hold": {  // 누르고 있어야 — 손을 대고 있는 것
          const need = (spec.seconds || 2.5) * 1000;
          let downAt = 0;
          listen(document, "pointerdown", () => {
            downAt = now();
            ui.holdProgress(0);
            gesture.interval = setInterval(() => {
              const p = (now() - downAt) / need;
              ui.holdProgress(Math.min(1, p));
              if (p >= 1) finishGesture({});
            }, 80);
          });
          listen(document, "pointerup", () => {
            clearInterval(gesture && gesture.interval);
            if (gesture) ui.holdProgress(null);  // 떼면 처음부터
          });
          break;
        }
        case "release": {  // 누른 채로 시작 → 놓아야 끝남 (티코의 "놓는 손")
          let held = false;
          listen(document, "pointerdown", () => { held = true; ui.holdProgress(1); });
          listen(document, "pointerup", () => {
            if (held && now() - gesture.startAt > 600) finishGesture({});
          });
          gesture.startAt = now();
          break;
        }
        case "silence": {  // 아무것도 안 해야 — 침묵이 답
          const need = (spec.seconds || 4) * 1000;
          let t0 = now(), resets = 0;
          const reset = () => { t0 = now(); resets++; };  // 동요 횟수 — 판정의 침묵 결 (§v2.1 2-2)
          handlers.any.push(reset);
          gesture.cleanups.push(() => {
            handlers.any.splice(handlers.any.indexOf(reset), 1);
          });
          gesture.interval = setInterval(() => {
            if (now() - t0 >= need) finishGesture({ silenceResets: resets });
          }, 200);
          break;
        }
        case "timeout_choice": {  // 미선택도 선택 (§5-3)
          ui.showChoices(spec.choices, (choice) => finishGesture({ choice }));
          gesture.timer = setTimeout(() => {
            ui.hideChoices();
            finishGesture({ unchosen: true });
          }, spec.timeoutMs || 8000);
          gesture.cleanups.push(() => ui.hideChoices());
          break;
        }
        // shake는 Easter egg로 강등 (§v2.1 2-1) — 차단형 제스처에서 제외, armShakeEgg 참조
        case "trace": {  // 흐린 자국을 따라 — 본 사람만 봄
          let dist = 0, lastP = null, down = false;
          listen(document, "pointerdown", () => { down = true; lastP = null; });
          listen(document, "pointerup", () => { down = false; });
          listen(document, "pointermove", (e) => {
            if (!down) return;
            if (lastP) dist += Math.hypot(e.clientX - lastP.x, e.clientY - lastP.y);
            lastP = { x: e.clientX, y: e.clientY };
            ui.traceProgress(Math.min(1, dist / 600));
            if (dist >= 600) finishGesture({});
          });
          break;
        }
        default:
          finishGesture({});
      }
    });
  }

  return {
    init,
    enable() { enabled = true; },
    disable() { enabled = false; },
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    lock(ms) { lockUntil = Math.max(lockUntil, now() + ms); },  // pause_b/seat 강제 박자
    requestGesture,
    cancelGesture() { if (gesture) finishGesture({ cancelled: true }); },  // 점프 시 진행 중 제스처 해제
    armShakeEgg,
    gestureActive() { return !!gesture; },
  };
})();
