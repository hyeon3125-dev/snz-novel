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

  /* ── 도달 상태 (§7-3): 엔딩 분기가 아니라 도달 상태 분기 ── */
  function computeReach() {
    const r = S().meta.reachRules;
    const seeds = window.STATE.countSeeds();
    const unchosen = window.STATE.getUnchosen().length;
    if (unchosen >= r.silentUnchosenMin) return "silent";
    if (seeds >= Math.min(r.fullSeedsMin, S().meta.seedTotal) && unchosen <= r.fullUnchosenMax) return "full";
    return "standard";
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

  /* 완료 유닛의 떡밥 마킹 — "떡밥 씬 통과 → seeds[id]=true" (§7-1) */
  function markSeedsOf(uid) {
    const sd = unit(uid).seed;
    if (!sd) return;
    (Array.isArray(sd) ? sd : [sd]).forEach((s) => window.STATE.markSeed(s));
  }

  /* 다음 씬으로 — 도달 상태 게이트 미달 유닛은 통째 건너뜀 */
  function advanceScene() {
    let nextId = cur.next;
    const prevUnit = cur.unit;
    for (;;) {
      if (!nextId) {
        markSeedsOf(prevUnit);  // 마지막 유닛도 통과 처리
        cur = null;
        return { type: "end", ...endPayload() };
      }
      const nx = scene(nextId);
      if (nx.unit !== prevUnit) markSeedsOf(prevUnit);
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
        resonance: !!(g && g.full),                  // 회수 공명 — 본 사람에게만 울림
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
    computeReach,
  };
})();
