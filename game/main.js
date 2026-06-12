/* SCALAR: NODE ZERO — main.js
 * 부트스트랩 + 오케스트레이션. 로드 순서: script → state → director → stage → input → main (§2)
 */
"use strict";

(function () {
  const S = window.SCRIPT;
  let ended = false;
  let interacting = false;

  function unitOf(sceneId) { return S.scenes[sceneId].unit; }
  function unitLabel(sceneId) { return S.units[unitOf(sceneId)].label; }

  function handleInteraction(op) {
    interacting = true;
    window.STAGE.showGesture(op.spec.type);
    window.INPUT.requestGesture(op.spec, {
      holdProgress: window.STAGE.holdProgress,
      traceProgress: window.STAGE.traceProgress,
      showChoices: window.STAGE.showChoices,
      hideChoices: window.STAGE.hideChoices,
    }).then((result) => {
      window.STAGE.hideGesture();
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
          window.STAGE.renderLine(op.t, op.fx);
          window.STATE.saveProgress(op.sceneId, op.lineIdx);
          return;
        case "unit": {
          window.STAGE.setFaction(op.faction, op.transition);
          window.STAGE.setSound(op.bgm, op.faction);
          window.STAGE.renderUnitCard(op.label, { resonance: op.resonance });
          window.STAGE.setHud(op.label);
          return;
        }
        case "interaction":
          handleInteraction(op);
          return;
        case "scene-break":
          window.STAGE.renderSceneBreak();
          continue;  // 여백은 탭을 소비하지 않는다
        case "end": {
          ended = true;
          if (op.reach === "silent") {
            window.STAGE.renderSilentEpilogue(window.STATE.getUnchosen());
          }
          window.STAGE.renderEnd(op);
          window.INPUT.disable();
          return;
        }
      }
    }
  }

  /* 이어서 읽기: 현재 씬의 읽은 부분까지 즉시 재구성 */
  function restoreContext(sceneId, lineIdx) {
    const sc = S.scenes[sceneId];
    document.body.setAttribute("data-faction", sc.faction);
    window.STAGE.renderUnitCard(unitLabel(sceneId), {}, true);
    window.STAGE.setHud(unitLabel(sceneId));
    for (let i = 0; i < lineIdx && i < sc.lines.length; i++) {
      window.STAGE.renderLine(sc.lines[i].t, null, true);
    }
    const u = S.units[sc.unit];
    window.STAGE.setSound(u.sound && u.sound.bgm, sc.faction);
  }

  function startReading(progress) {
    window.STAGE.hideTitle();
    window.STAGE.clearFlow();
    ended = false;
    if (progress) {
      restoreContext(progress.sceneId, progress.lineIdx);
      window.DIRECTOR.start(progress.sceneId, progress.lineIdx);
    } else {
      window.STATE.clearProgress();
      window.DIRECTOR.start(S.order[0], 0);
      advance();  // 첫 비트 자동 출력
    }
    window.INPUT.enable();
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
