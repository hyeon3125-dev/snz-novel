/* SCALAR: NODE ZERO — main.js
 * 부트스트랩 + 오케스트레이션. 로드 순서: script → state → director → stage → input → main (§2)
 * v2.1: 읽기 결 계측(판정용) · 목차 점프(조용히 — 불변식 9) · 밑줄 · 남은 두께 · Easter egg shake
 */
"use strict";

(function () {
  const S = window.SCRIPT;
  let ended = false;
  let interacting = false;
  let started = false;
  let disarmEgg = null;

  const ORDER_IDX = {};
  if (S && S.order) S.order.forEach((sid, i) => { ORDER_IDX[sid] = i; });

  /* ── 읽기 결 이벤트 (선택적 분석 — 없거나 비활성이면 무동작) ──
   * 페이지뷰가 아니라 '얼마나 깊이 읽는가'를 본다: 시작·권 도달·체류 분·완독. */
  let aMaxVol = 0;
  let aTimers = [];
  function track(name) { if (window.ANALYTICS && window.ANALYTICS.event) window.ANALYTICS.event(name); }
  function armReadingTimers() {
    aTimers.forEach(clearTimeout); aTimers = [];
    [[5, "05"], [20, "20"], [60, "60"]].forEach(([min, tag]) => {
      aTimers.push(setTimeout(() => track("read/min/" + tag), min * 60000));
    });
  }
  function clearReadingTimers() { aTimers.forEach(clearTimeout); aTimers = []; }

  function unitOf(sceneId) { return S.scenes[sceneId].unit; }
  function unitLabel(sceneId) { return S.units[unitOf(sceneId)].label; }
  function currentSceneId() {
    const c = window.DIRECTOR.current();
    if (c) return c.sceneId;
    const p = window.STATE.getProgress();
    return p ? p.sceneId : S.order[0];
  }

  /* ── 읽기 결 계측 (§v2.1 2-2) — 씬 단위 합산만, 개별 로그 없음 ──
   * 기대 체류는 글자 수 기반 외부 앵커 (자기 중앙값 기준은 정의상 항상 0.5가 되므로 쓰지 않는다) */
  let meter = null;
  function ensureMeter(sceneId) {
    if (meter && meter.sceneId === sceneId) return;
    closeMeter();
    meter = { sceneId, unit: unitOf(sceneId), start: Date.now(),
              chars: 0, gesture: false, pause: false };
  }
  function closeMeter() {
    if (!meter) return;
    const dwell = Math.min(Date.now() - meter.start, 180000);  // 덮어둔 책은 계측하지 않는다
    const expected = 600 + meter.chars * 60;
    window.STATE.recordScene(meter.unit, dwell > expected, meter.gesture,
      meter.pause ? { dwelled: dwell > expected + 2200 } : null);
    meter = null;
  }

  function armEgg() {
    if (disarmEgg) { disarmEgg(); disarmEgg = null; }
    const spec = window.DIRECTOR.easterShake();
    if (spec) disarmEgg = window.INPUT.armShakeEgg(() => window.STAGE.easterShake());
  }

  function updateThickness() {
    if (!started || ended) { window.STAGE.setThickness(null); return; }
    const i = ORDER_IDX[currentSceneId()] || 0;
    window.STAGE.setThickness(1 - i / (S.order.length - 1));
  }

  function handleInteraction(op) {
    interacting = true;
    ensureMeter(op.sceneId);
    meter.gesture = true;
    window.STAGE.showGesture(op.spec.type);
    window.INPUT.requestGesture(op.spec, {
      holdProgress: window.STAGE.holdProgress,
      traceProgress: window.STAGE.traceProgress,
      showChoices: window.STAGE.showChoices,
      hideChoices: window.STAGE.hideChoices,
    }).then((result) => {
      window.STAGE.hideGesture();
      if (result.cancelled) return;  // 점프로 해제 — 기록도 진행도 없음
      if (op.spec.type === "silence") window.STATE.recordSilence(!result.silenceResets);
      if (op.spec.type === "timeout_choice") window.STATE.recordChoice(result.choice !== undefined);
      if (result.unchosen) {
        window.STATE.addUnchosen(op.sceneId);  // 실패가 아니라 기록 (불변식 5)
      } else if (result.choice !== undefined && op.spec.flag) {
        window.STATE.setFlag(op.spec.flag, result.choice);
      }
      window.DIRECTOR.interactionDone();
      interacting = false;
      advance();  // 충족 즉시 다음 비트
    });
  }

  /* 한 번의 탭 = 보이는 것 하나가 나올 때까지 step */
  function advance() {
    if (ended || interacting) return;
    for (;;) {
      const op = window.DIRECTOR.step();
      switch (op.type) {
        case "line":
          ensureMeter(op.sceneId);
          meter.chars += op.t.length;
          if (op.fx && (op.fx.tag || op.fx) === "pause_b") meter.pause = true;
          window.STAGE.renderLine(op.t, op.fx, false,
            { sceneId: op.sceneId, lineIdx: op.lineIdx - 1 });
          window.STATE.saveProgress(op.sceneId, op.lineIdx);
          return;
        case "unit": {
          window.STAGE.setFaction(op.faction, op.transition);
          window.STAGE.setSound(op.bgm, op.faction);
          window.STAGE.renderUnitCard(op.label, { resonance: op.resonance });
          window.STAGE.setHud(op.label);
          armEgg();
          updateThickness();
          const uv = S.units[op.unit] && S.units[op.unit].vol;  // 권 도달 깊이 (1회씩)
          if (uv && uv > aMaxVol) { aMaxVol = uv; track("read/vol/" + (uv < 10 ? "0" : "") + uv); }
          return;
        }
        case "interaction":
          handleInteraction(op);
          return;
        case "judgement":  // 완독 판정 (§v2.1 2-3) — 판권면의 자리. 닫으면(탭) AE로
          window.STAGE.renderJudgement(op.judgement);
          track("read/judge/" + op.judgement.faction);
          return;
        case "scene-break":
          window.STAGE.renderSceneBreak();
          armEgg();
          updateThickness();
          continue;  // 여백은 탭을 소비하지 않는다
        case "end": {
          ended = true;
          closeMeter();
          clearReadingTimers();
          track("read/end");
          if (op.reach === "silent") {
            // 후기는 제시받고 고르지 않은 것만 — 점프로 마주치지 않은 것은 묻지 않은 것이 아니다
            window.STAGE.renderSilentEpilogue(window.STATE.getUnchosenAsked());
          }
          window.STAGE.renderEnd(op);
          window.STAGE.setThickness(null);
          window.INPUT.disable();
          return;
        }
      }
    }
  }

  /* 이어서 읽기: 현재 씬의 읽은 부분까지 즉시 재구성. 마지막 줄은 '다시 펼친 페이지'로 */
  function restoreContext(sceneId, lineIdx) {
    const sc = S.scenes[sceneId];
    document.body.setAttribute("data-faction", sc.faction);
    window.STAGE.renderUnitCard(unitLabel(sceneId), {}, true);
    window.STAGE.setHud(unitLabel(sceneId));
    let last = null;
    for (let i = 0; i < lineIdx && i < sc.lines.length; i++) {
      last = window.STAGE.renderLine(sc.lines[i].t, null, true, { sceneId, lineIdx: i });
    }
    if (last) last.classList.add("reopen");  // 눈이 읽던 글줄을 찾는 순간
    const u = S.units[sc.unit];
    window.STAGE.setSound(u.sound && u.sound.bgm, sc.faction);
    return last;
  }

  /* ── 목차 점프 (§v2.1 3-1) — 조용히 처리한다. 안내 없음 (불변식 9) ── */
  function processSkips(fromIdx, toIdx) {
    for (let i = fromIdx + 1; i < toIdx; i++) {
      const sc = S.scenes[S.order[i]];
      if (sc.interaction && sc.interaction.type === "timeout_choice") {
        window.STATE.addUnchosen(sc.id, true);  // skipped — 도달 상태·판정 불산입
      }
    }
  }
  function jumpTo(sceneId, lineIdx) {
    if (ORDER_IDX[sceneId] === undefined) return;
    if (interacting) { window.INPUT.cancelGesture(); interacting = false; }
    window.STAGE.hideGesture();
    window.STAGE.hideChoices();
    const from = ORDER_IDX[currentSceneId()] || 0;
    const to = ORDER_IDX[sceneId];
    if (to > from) processSkips(from, to);
    closeMeter();
    ended = false;
    window.STAGE.clearFlow();
    if (lineIdx > 0) {
      restoreContext(sceneId, lineIdx);
      window.DIRECTOR.start(sceneId, lineIdx);
    } else {
      window.DIRECTOR.start(sceneId, 0);
    }
    window.STATE.saveProgress(sceneId, lineIdx || 0);
    window.INPUT.enable();
    armEgg();
    updateThickness();
    if (!lineIdx) advance();  // 유닛 카드/첫 비트
  }

  /* 목차 모델 — Arc → Vol → 유닛. 방문 여부 표시 없음. 서브 문서는 배치 그대로 */
  const ARC_RANGE = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12], 5: [13, 14], 6: [15, 16] };
  function tocModel() {
    const seen = {};
    const units = [];
    S.order.forEach((sid) => {
      const uid = S.scenes[sid].unit;
      if (seen[uid]) return;
      seen[uid] = true;
      const u = S.units[uid];
      units.push({ uid, label: u.label, vol: u.vol, arc: u.arc, ch: u.ch });
    });
    const groups = [];
    const prelude = units.filter((u) => u.vol === null);
    if (prelude.length) {
      groups.push({ label: window.STR.tocPrelude, vols: [{ label: "", units: prelude }] });
    }
    for (let a = 1; a <= 6; a++) {
      const [lo, hi] = ARC_RANGE[a];
      const vols = [];
      for (let v = lo; v <= hi; v++) {
        const vu = units.filter((u) => u.vol === v);
        if (!vu.length) continue;
        const chs = vu.filter((u) => u.ch).map((u) => u.ch);
        vols.push({ label: window.STR.tocVol(v, Math.min(...chs), Math.max(...chs)), units: vu });
      }
      if (vols.length) groups.push({ label: window.STR.tocArc(a, lo, hi), vols });
    }
    const marks = window.STATE.getMarks()
      .filter((m) => S.scenes[m.sceneId] && S.scenes[m.sceneId].lines[m.lineIdx])
      .sort((a, b) => (ORDER_IDX[a.sceneId] - ORDER_IDX[b.sceneId]) || (a.lineIdx - b.lineIdx))
      .map((m) => {
        const t = S.scenes[m.sceneId].lines[m.lineIdx].t;
        return { sceneId: m.sceneId, lineIdx: m.lineIdx,
                 text: t.length > 44 ? t.slice(0, 44) + "…" : t };
      });
    return { groups, marks };
  }
  function firstSceneOfUnit(uid) {
    return S.order.find((sid) => S.scenes[sid].unit === uid);
  }
  function toggleToc() {
    if (!started) return;
    if (window.STAGE.tocVisible()) { window.STAGE.hideToc(); return; }
    window.STAGE.showToc(tocModel(), {
      onJump: (uid) => jumpTo(firstSceneOfUnit(uid), 0),
      onJumpMark: (sceneId, lineIdx) => jumpTo(sceneId, lineIdx + 1),
      onThickness: updateThickness,
    });
  }

  function startReading(progress) {
    window.STAGE.hideTitle();
    window.STAGE.clearFlow();
    ended = false;
    started = true;
    track(progress ? "read/resume" : "read/start");
    armReadingTimers();
    if (progress) {
      restoreContext(progress.sceneId, progress.lineIdx);
      window.DIRECTOR.start(progress.sceneId, progress.lineIdx);
    } else {
      window.STATE.clearProgress();
      window.DIRECTOR.start(S.order[0], 0);
      advance();  // 첫 비트 자동 출력
    }
    window.INPUT.enable();
    armEgg();
    updateThickness();
  }

  function boot() {
    if (!S || !S.order || !S.order.length) {
      document.body.textContent = "script.js 가 없습니다 — tools/parse_snz.py 로 생성하세요.";
      return;
    }
    window.STATE.load();
    window.STAGE.init();
    window.INPUT.init();
    window.INPUT.on("advance", advance);

    /* 밑줄 — 독자가 남기는 기록 */
    window.INPUT.on("mark", (e) => {
      const sid = e.el.getAttribute("data-sid");
      if (!sid) return;
      const li = Number(e.el.getAttribute("data-li"));
      window.STAGE.setMarked(e.el, window.STATE.toggleMark(sid, li));
    });

    /* 목차 진입 — HUD 탭 (안내 없음) */
    const hud = document.getElementById("hud");
    if (hud) hud.addEventListener("click", (e) => { e.stopPropagation(); toggleToc(); });

    const s = window.STATE.getSettings();
    if (s.reducedMotion === null) {
      s.reducedMotion = typeof matchMedia !== "undefined"
        && matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (s.reducedMotion) document.documentElement.classList.add("reduced-motion");
    document.body.setAttribute("data-faction", "trio");

    const progress = window.STATE.getProgress();
    window.STAGE.showTitle({
      canContinue: !!progress,
      legacyNotice: window.STATE.detectLegacy(),
      onContinue: () => startReading(progress),
      onStart: () => startReading(null),
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
