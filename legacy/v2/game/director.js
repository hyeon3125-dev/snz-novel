/* SCALAR: NODE ZERO — director.js
 * 씬 단위 연출 결정 (Architecture v2.0 §2). 각본 태그 → 스테이지 명령 컴파일.
 *
 * step() 이 내보내는 명령:
 *   {type:"unit", unit, label, faction, arc, bgm, resonance, transition}
 *   {type:"interaction", spec, sceneId}            — 충족 전 진행 차단 (main이 INPUT에 위임)
 *   {type:"line", t, fx, sceneId, lineIdx}          — fx는 게이트 묵음 적용 후
 *   {type:"scene-break"}
 *   {type:"end", reach, seedsOwned, seedTotal}
 *
 * 회수 게이트 (§7-1): 유닛 gate.seeds 전량 보유 → 공명(resonance), 일부/전무 → fx·sound 묵음.
 * 도달 상태 게이트 (§7-3): unit.reach 요건 미달 유닛은 통째 스킵.
 */
"use strict";

window.DIRECTOR = (function () {
  let cur = null;          // 현재 씬
  let lineIdx = 0;
  let pendingUnit = null;  // 유닛 카드 대기
  let pendingInteraction = null;  // {spec, at} — 미충족 인터랙션
  let interactionDoneFor = null;  // 충족된 씬 id
  let muted = false;       // 현재 유닛 회수 게이트 묵음 여부

  const S = () => window.SCRIPT;
  const scene = (id) => S().scenes[id];
  const unit = (id) => S().units[id];

  /* ── 도달 상태 (§7-3): 엔딩 분기가 아니라 도달 상태 분기 ──
   * 점프로 마주치지 않은 선택(skipped)은 불산입 — 비선택은 제시받은 것의 기록 (불변식 9) */
  function computeReach() {
    const r = S().meta.reachRules;
    const seeds = window.STATE.countSeeds();
    const unchosen = window.STATE.getUnchosenAsked().length;
    if (unchosen >= r.silentUnchosenMin) return "silent";
    if (seeds >= Math.min(r.fullSeedsMin, S().meta.seedTotal) && unchosen <= r.fullUnchosenMax) return "full";
    return "standard";
  }

  /* ── 가문 판정 (§v2.1 2-2) — 판정은 비율이다 (불변식 8). 공가는 판정 대상이 아니다 (불변식 10).
   * 표본 미달 항은 중립값 0.5 — 분모 1~2짜리 비율이 판정을 좌우하지 않도록. */
  const FACTIONS = ["hwagam", "eidos", "altair", "geumhwi"];
  function ratio(num, den, minSamples) {
    return den >= (minSamples || 3) ? num / den : 0.5;
  }
  function computeScores() {
    const t = window.STATE.telemetry();
    const seedUnitsSeen = Object.keys(t.units)
      .filter((uid) => unit(uid) && unit(uid).seed).length;
    const seeds = ratio(window.STATE.countSeeds(), seedUnitsSeen, 3);
    const activeTap = ratio(t.scenes - t.gestureSeen, t.scenes, 10);
    const silence = ratio(t.silenceClean, t.silenceOffered, 2);
    const choiceRate = ratio(t.choiceMade, t.choiceOffered, 2);
    const unchosenR = ratio(t.choiceOffered - t.choiceMade, t.choiceOffered, 2);
    const slow = ratio(t.slow, t.scenes, 10);
    const fast = t.scenes >= 10 ? 1 - slow : 0.5;
    const pause = ratio(t.pauseDwelled, t.pauseSeen, 2);
    return {
      hwagam:  seeds * 0.5 + activeTap * 0.3 + choiceRate * 0.2,
      eidos:   silence * 0.4 + unchosenR * 0.4 + slow * 0.2,
      altair:  fast * 0.5 + choiceRate * 0.3 + seeds * 0.2,
      geumhwi: pause * 0.5 + slow * 0.3 + unchosenR * 0.2,
    };
  }
  function judgeLeader(scores) {
    const top = Math.max(...FACTIONS.map((f) => scores[f]));
    const tied = FACTIONS.filter((f) => scores[f] >= top - 1e-9);
    if (tied.length === 1) return tied[0];
    // 동점: 먼저 올라간 가문 — 최초 선두 도달 순서, 기록 없으면 고정 순서
    const order = window.STATE.telemetry().leaders;
    for (const f of order) if (tied.indexOf(f) !== -1) return f;
    return tied[0];
  }
  function computeJudgement() {
    const t = window.STATE.telemetry();
    const scores = computeScores();
    const slowR = ratio(t.slow, t.scenes, 10);
    return {
      faction: judgeLeader(scores),
      scores,
      seedsOwned: window.STATE.countSeeds(),
      seedTotal: S().meta.seedTotal,
      pace: slowR > 0.5 ? "slow" : "fast",
      days: Object.keys(t.days).length || 1,
    };
  }
  function reachAllows(u) {
    if (!u.reach) return true;
    if (u.reach.reach === "full") return computeReach() === "full";
    return true;
  }

  function gateState(u) {
    if (!u.gate || !u.gate.seeds) return null;
    const owned = u.gate.seeds.filter((s) => window.STATE.hasSeed(s)).length;
    return { owned, total: u.gate.seeds.length, full: owned === u.gate.seeds.length };
  }

  function firstSceneOfUnit(uid) {
    return S().order.find((sid) => sid.indexOf(uid + "_s") === 0);
  }

  function enterScene(sid, idx) {
    cur = scene(sid);
    lineIdx = idx || 0;
    const u = unit(cur.unit);
    const g = gateState(u);
    muted = !!(g && !g.full);  // 놓친 것은 놓친 채로 — 씬은 그대로, 연출만 묵음
    const spec = cur.interaction;
    pendingInteraction = null;
    interactionDoneFor = null;
    if (spec && spec.type === "shake") return;  // Easter egg 강등 (§v2.1 2-1): 차단·안내·기록 없음
    if (spec && idx === 0) {
      pendingInteraction = { spec, at: spec.at === "end" ? "end" : "start" };
    } else if (spec && idx > 0) {
      // 이어읽기 복원: 시작 게이트는 이미 통과한 것으로 간주, end 게이트는 유지
      if (spec.at === "end") pendingInteraction = { spec, at: "end" };
      else interactionDoneFor = sid;
    }
  }

  function start(sceneId, idx) {
    enterScene(sceneId, idx);
    pendingUnit = (idx || 0) === 0 && firstSceneOfUnit(cur.unit) === cur.id ? cur.unit : null;
  }

  /* 완료 유닛의 떡밥 마킹 — "떡밥 씬 통과 → seeds[id]=true" (§7-1)
   * + 유닛 경계마다 현재 선두 가문 표본 (동점 타이브레이크용) */
  let judgementPending = null;
  function unitDone(uid) {
    const sd = unit(uid).seed;
    if (sd) (Array.isArray(sd) ? sd : [sd]).forEach((s) => window.STATE.markSeed(s));
    window.STATE.recordLeader(judgeLeader(computeScores()));
    // 완독 판정 트리거 (§v2.1 3-2): Ch.200 마지막 씬 통과 시 1회
    if (unit(uid).ch === 200 && !window.STATE.getJudgement()) {
      judgementPending = window.STATE.setJudgement(computeJudgement());
    }
  }

  /* 다음 씬으로 — 도달 상태 게이트 미달 유닛은 통째 건너뜀 */
  function advanceScene() {
    let nextId = cur.next;
    const prevUnit = cur.unit;
    for (;;) {
      if (!nextId) {
        unitDone(prevUnit);  // 마지막 유닛도 통과 처리
        cur = null;
        return { type: "end", ...endPayload() };
      }
      const nx = scene(nextId);
      if (nx.unit !== prevUnit) unitDone(prevUnit);
      if (nx.unit === prevUnit || reachAllows(unit(nx.unit))) break;
      // 유닛 스킵: 해당 유닛의 마지막 씬까지 통과
      let sid = nextId;
      while (scene(sid).next && scene(scene(sid).next).unit === nx.unit) sid = scene(sid).next;
      nextId = scene(sid).next;
    }
    const sameUnit = scene(nextId).unit === prevUnit;
    enterScene(nextId, 0);
    pendingUnit = !sameUnit && firstSceneOfUnit(cur.unit) === cur.id ? cur.unit : null;
    return { type: "scene-break", sceneId: cur.id, sameUnit };
  }

  function endPayload() {
    return { reach: computeReach(), seedsOwned: window.STATE.countSeeds(),
             seedTotal: S().meta.seedTotal };
  }

  function step() {
    if (judgementPending) {  // 판정 화면 (§v2.1 2-3) — 닫으면(다음 탭) AE로 자동 진행
      const j = judgementPending;
      judgementPending = null;
      return { type: "judgement", judgement: j };
    }
    if (!cur) return { type: "end", ...endPayload() };

    if (pendingUnit) {
      const uid = pendingUnit;
      pendingUnit = null;
      const u = unit(uid);
      const g = gateState(u);
      return {
        type: "unit", unit: uid, label: u.label,
        faction: scene(firstSceneOfUnit(uid)).faction,
        arc: u.arc,
        bgm: (u.sound && u.sound.bgm) || null,
        // 회수 공명 — 본 사람에게만 울림. 완독자의 재독에서는 떡밥 쪽에서 미리 울린다 (역방향 공명)
        resonance: !!(g && g.full) || !!(window.STATE.getJudgement() && u.seed),
        transition: (u.arc || 1) >= 4 ? "fast" : "slow",  // Vol.10+ 단축 전환 (§6-4)
      };
    }

    if (pendingInteraction && pendingInteraction.at === "start"
        && interactionDoneFor !== cur.id) {
      return { type: "interaction", spec: pendingInteraction.spec, sceneId: cur.id };
    }

    if (lineIdx < cur.lines.length) {
      const entry = cur.lines[lineIdx];
      lineIdx++;
      return {
        type: "line", t: entry.t,
        fx: muted ? null : (entry.fx || null),  // 게이트 묵음 (§7-1)
        sceneId: cur.id, lineIdx,
      };
    }

    if (pendingInteraction && pendingInteraction.at === "end"
        && interactionDoneFor !== cur.id) {
      return { type: "interaction", spec: pendingInteraction.spec, sceneId: cur.id };
    }

    return advanceScene();
  }

  return {
    start,
    step,
    interactionDone() { interactionDoneFor = cur ? cur.id : null; pendingInteraction = null; },
    current() { return cur ? { sceneId: cur.id, lineIdx, faction: cur.faction } : null; },
    /* 현재 씬의 Easter egg shake 스펙 (§v2.1 2-1) — 있으면 main이 수동 리스너만 무장 */
    easterShake() {
      return cur && cur.interaction && cur.interaction.type === "shake" ? cur.interaction : null;
    },
    computeReach,
    computeJudgement,
  };
})();
