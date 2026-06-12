/* SCALAR: NODE ZERO — state.js
 * 진행 상태·게이트·세이브 (Architecture v2.0 §7-4, localStorage v2)
 * 키: scalar2_* — 구버전 scalar_* 는 감지 시 폐기 안내 1회.
 */
"use strict";

window.STATE = (function () {
  /* 진행 상태는 언어판별로 분리 (씬 ID 체계는 같아도 진행 위치·읽은 맥락이 다름).
   * 설정·구버전 안내·언어 선택은 공유. */
  const SUF = window.LANG === "en" ? "_en" : "";
  const K = {
    progress: "scalar2_progress" + SUF,
    seeds: "scalar2_seeds" + SUF,
    unchosen: "scalar2_unchosen" + SUF,
    cracks: "scalar2_cracks" + SUF,
    save: "scalar2_save" + SUF,
    flags: "scalar2_flags" + SUF,
    settings: "scalar2_settings",
    legacyNotified: "scalar2_legacy_notified",
    lang: "scalar2_lang",
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
    unchosen: [],     // [ {sceneId, ts} ] — M3 비선택 기록
    cracks: 0,        // crack 연출 누적 (영구) — M2
    settings: { reducedMotion: null, holdAssist: false, volume: 0.8 },
    slots: [null, null, null],
  };

  function load() {
    st.progress = read(K.progress, null);
    st.seeds = read(K.seeds, {});
    st.unchosen = read(K.unchosen, []);
    st.cracks = read(K.cracks, 0);
    st.settings = Object.assign(st.settings, read(K.settings, {}));
    st.slots = read(K.save, [null, null, null]);
  }

  /* 구버전(AI 게임) scalar_* 키 감지 → 폐기 안내 1회 (키 자체는 건드리지 않음) */
  function detectLegacy() {
    if (read(K.legacyNotified, false)) return false;
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("scalar_") === 0) { found = true; break; }
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

    /* 비선택 기록 (M3) — 실패가 아니라 기록 (불변식 5) */
    addUnchosen(sceneId) {
      st.unchosen.push({ sceneId, ts: Date.now() });
      write(K.unchosen, st.unchosen);
    },
    getUnchosen() { return st.unchosen.slice(); },

    /* 균열 누적 (M2) */
    addCrack() { st.cracks++; write(K.cracks, st.cracks); return st.cracks; },
    getCracks() { return st.cracks; },

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
      Object.values(K).forEach((k) => { if (k !== K.legacyNotified) localStorage.removeItem(k); });
      load();
    },
  };
})();
