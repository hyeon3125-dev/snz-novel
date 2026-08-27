/* SCALAR: NODE ZERO — state.js
 * 진행 상태·게이트·세이브 (Architecture v3 §7-4, localStorage v3)
 * v2 서사 좌표는 이식하지 않고 같은 origin의 /legacy/v2/에서 보존한다.
 */
"use strict";

window.STATE = (function () {
  /* 진행 상태는 언어판별로 분리 (씬 ID 체계는 같아도 진행 위치·읽은 맥락이 다름).
   * 설정·구버전 안내·언어 선택은 공유. */
  const SUF = window.LANG === "en" ? "_en" : (window.LANG === "jp" ? "_jp" : "");
  const K = {
    progress: "scalar3_progress" + SUF,
    seeds: "scalar3_seeds" + SUF,
    unchosen: "scalar3_unchosen" + SUF,
    cracks: "scalar3_cracks" + SUF,
    save: "scalar3_save" + SUF,
    flags: "scalar3_flags" + SUF,
    telemetry: "scalar3_telemetry" + SUF,
    judgement: "scalar3_judgement" + SUF,
    marks: "scalar3_marks" + SUF,
    settings: "scalar_settings",
    legacyNotified: "scalar3_legacy_notified",
    lang: "scalar_lang",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* 저장 실패는 진행을 막지 않는다 */ }
  }

  const st = {
    progress: null,   // { sceneId, lineIdx }
    seeds: {},        // { 복선id: true } — M5 회수 게이트
    unchosen: [],     // [ {sceneId, ts, skipped?} ] — M3 비선택 기록 (skipped = 점프로 마주치지 않음)
    cracks: 0,        // crack 연출 누적 (영구) — M2
    telemetry: null,
    judgement: null,
    marks: {},        // { "sceneId:lineIdx": true }
    settings: { reducedMotion: null, holdAssist: false, volume: 0.8, thickness: true },
    slots: [null, null, null],
  };

  /* 판정용 집계 (불변식 8: 판정은 비율) — 개별 로그 없이 합산값만 보관 */
  function freshTelemetry() {
    return {
      scenes: 0, slow: 0,            // 방문 씬 수 / 기대 체류(글자수 기반) 초과 씬 수
      gestureSeen: 0,                // 인터랙션을 실제로 마주친 씬 수
      silenceOffered: 0, silenceClean: 0,   // 침묵 제시 / 동요 없이 통과
      choiceOffered: 0, choiceMade: 0,      // 선택 제시(점프 스킵 제외) / 시간 내 선택
      pauseSeen: 0, pauseDwelled: 0,        // pause_b 씬 / 강제 박자 이후 추가 체류
      units: {},                     // 방문 유닛 — seeds_ratio 분모 산출용
      leaders: [],                   // 가문별 최초 선두 도달 순서 (동점 시: 먼저 올라간 가문)
      firstTs: Date.now(), days: {}, // "N일에 걸쳐 읽음"
    };
  }

  function load() {
    st.progress = read(K.progress, null);
    st.seeds = read(K.seeds, {});
    st.unchosen = read(K.unchosen, []);
    st.cracks = read(K.cracks, 0);
    st.telemetry = read(K.telemetry, null) || freshTelemetry();
    st.judgement = read(K.judgement, null);
    st.marks = read(K.marks, {});
    let sharedSettings = read(K.settings, null);
    if (!sharedSettings) {
      sharedSettings = read("scalar2_settings", {});
      write(K.settings, sharedSettings); // 설정만 copy-on-read; v2 원본은 유지한다.
    }
    st.settings = Object.assign(st.settings, sharedSettings);
    st.slots = read(K.save, [null, null, null]);
  }

  /* v2/구버전 기록 감지 → 보관판 안내 1회 (키 자체는 건드리지 않음). */
  function detectLegacy() {
    if (read(K.legacyNotified, false)) return false;
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.indexOf("scalar2_") === 0
          || (k.indexOf("scalar_") === 0 && k !== K.settings && k !== K.lang))) {
        found = true; break;
      }
    }
    if (found) write(K.legacyNotified, true);
    return found;
  }

  return {
    load,
    detectLegacy,

    /* 진행 */
    getProgress() { return st.progress; },
    saveProgress(sceneId, lineIdx) {
      st.progress = { sceneId, lineIdx, ts: Date.now() };
      write(K.progress, st.progress);
    },
    clearProgress() { st.progress = null; write(K.progress, null); },

    /* 회수 게이트 (§7-1) */
    markSeed(id) { st.seeds[id] = true; write(K.seeds, st.seeds); },
    hasSeed(id) { return !!st.seeds[id]; },
    countSeeds() { return Object.keys(st.seeds).filter((k) => st.seeds[k]).length; },

    /* 선택 기록 (timeout_choice 응답 등) */
    setFlag(key, value) {
      st.flags = st.flags || read(K.flags, {});
      st.flags[key] = value;
      write(K.flags, st.flags);
    },
    getFlag(key) {
      st.flags = st.flags || read(K.flags, {});
      return st.flags[key];
    },

    /* 언어 선택 (공유 키) — 변경 후 새로고침으로 해당 각본 로드 */
    setLang(lang) { write(K.lang, lang); },
    getLang() { return window.LANG || "ko"; },

    /* 비선택 기록 (M3) — 실패가 아니라 기록 (불변식 5).
     * skipped=true: 네비게이션 점프로 마주치지 않은 선택 — 기록은 남기되
     * 도달 상태·판정에는 불산입 (비선택은 "제시받고 고르지 않음"의 기록). */
    addUnchosen(sceneId, skipped) {
      const e = { sceneId, ts: Date.now() };
      if (skipped) e.skipped = true;
      st.unchosen.push(e);
      write(K.unchosen, st.unchosen);
    },
    getUnchosen() { return st.unchosen.slice(); },
    getUnchosenAsked() { return st.unchosen.filter((e) => !e.skipped); },

    /* 균열 누적 (M2) — 영구, 어떤 경로로도 초기화하지 않는다 (§v2.1 4) */
    addCrack() { st.cracks++; write(K.cracks, st.cracks); return st.cracks; },
    getCracks() { return st.cracks; },

    /* ── 판정용 집계 (§v2.1 2-2) ── */
    telemetry() { return st.telemetry; },
    recordScene(unitId, isSlow, hadGesture, pause) {
      const t = st.telemetry;
      t.scenes++;
      if (isSlow) t.slow++;
      if (hadGesture) t.gestureSeen++;
      if (pause) { t.pauseSeen++; if (pause.dwelled) t.pauseDwelled++; }
      t.units[unitId] = 1;
      const day = new Date().toISOString().slice(0, 10);
      t.days[day] = 1;
      write(K.telemetry, t);
    },
    recordSilence(clean) {
      st.telemetry.silenceOffered++;
      if (clean) st.telemetry.silenceClean++;
      write(K.telemetry, st.telemetry);
    },
    recordChoice(made) {
      st.telemetry.choiceOffered++;
      if (made) st.telemetry.choiceMade++;
      write(K.telemetry, st.telemetry);
    },
    recordLeader(faction) {  // 최초 선두 도달 순서 — 동점 타이브레이크 (§v2.1 2-2)
      if (st.telemetry.leaders.indexOf(faction) === -1) {
        st.telemetry.leaders.push(faction);
        write(K.telemetry, st.telemetry);
      }
    },

    /* ── 완독 판정 — 1회 생성 (§v2.1 3-2) ── */
    getJudgement() { return st.judgement; },
    setJudgement(j) {
      if (st.judgement) return st.judgement;  // triggered: 재생성 없음
      st.judgement = Object.assign({ triggered: true, ts: Date.now() }, j);
      write(K.judgement, st.judgement);
      return st.judgement;
    },

    /* ── 밑줄 — 독자의 기록 (게임은 판단하지 않는다) ── */
    toggleMark(sceneId, lineIdx) {
      const k = sceneId + ":" + lineIdx;
      if (st.marks[k]) delete st.marks[k]; else st.marks[k] = true;
      write(K.marks, st.marks);
      return !!st.marks[k];
    },
    isMarked(sceneId, lineIdx) { return !!st.marks[sceneId + ":" + lineIdx]; },
    getMarks() {  // [{sceneId, lineIdx}] — 각본 순서 정렬은 호출 측에서
      return Object.keys(st.marks).map((k) => {
        const i = k.lastIndexOf(":");
        return { sceneId: k.slice(0, i), lineIdx: Number(k.slice(i + 1)) };
      });
    },

    /* 설정 */
    getSettings() { return st.settings; },
    setSetting(key, value) { st.settings[key] = value; write(K.settings, st.settings); },

    /* 세이브 슬롯 3 */
    saveSlot(n) {
      if (n < 0 || n > 2 || !st.progress) return false;
      st.slots[n] = { progress: st.progress, seeds: st.seeds,
                      unchosen: st.unchosen, cracks: st.cracks, ts: Date.now() };
      write(K.save, st.slots);
      return true;
    },
    loadSlot(n) {
      const s = st.slots[n];
      if (!s) return false;
      st.progress = s.progress; st.seeds = s.seeds || {};
      st.unchosen = s.unchosen || []; st.cracks = s.cracks || 0;
      write(K.progress, st.progress); write(K.seeds, st.seeds);
      write(K.unchosen, st.unchosen); write(K.cracks, st.cracks);
      return true;
    },
    getSlots() { return st.slots.slice(); },

    reset() {
      // cracks는 영구(§v2.1 4 — 초기화 로직 없음), 판정도 완독의 기록이므로 유지
      Object.values(K).forEach((k) => {
        if (k !== K.legacyNotified && k !== K.cracks && k !== K.judgement) localStorage.removeItem(k);
      });
      load();
    },
  };
})();
