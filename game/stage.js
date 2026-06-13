/* SCALAR: NODE ZERO — stage.js
 * 실제 렌더 (Architecture v2.0 §2, §4, §6).
 * 연출은 본문 문체의 번역 — 기본값은 정적(靜寂). 효과 1개가 들어가면 주변은 침묵.
 * 사운드: Web Audio 절차 합성 — 에셋 파일 0, 의존성 0. 모든 전이 2초+ 페이드.
 */
"use strict";

/* UI 시스템 문언 (작품 외부 톤, 최소한 — §8). 서사 텍스트는 전부 각본 데이터에서.
 * 가문 문양 묘사(sigils)는 L0 확정 텍스트 (§v2.1 2-3) — 봉인 비접촉 검수 완료. */
window.STR = (window.LANG === "en") ? {
  titleSub: "A Deterministic Interactive Novel",
  begin: "Begin", resume: "Continue", restart: "From the Beginning",
  legacyNotice: "Save data from the old version (scalar_*) was found. This edition does not use it.",
  end: "End",
  reach: { full: "Full Recall", standard: "Standard", silent: "Silent Run" },
  unasked: "The Unasked",
  gesture: { hold: "press and hold", release: "let go", silence: "", trace: "trace it", timeout_choice: "" },
  toc: "Contents", tocBack: "Back", tocClose: "Close", tocMarks: "Underlined",
  tocPrelude: "Prelude", tocArc: (n, lo, hi) => "Arc " + n + " — Vol." + lo + "~" + hi,
  tocVol: (n, lo, hi) => "Vol." + n + (lo ? " — Ch." + lo + "~" + hi : ""),
  thicknessToggle: "Remaining thickness",
  judgeRead: (f) => "You read in the way of " + f + ".",
  judgeSeeds: (o, t) => "Recall " + o + "/" + t,
  judgePace: { slow: "the kind that lingers", fast: "the kind that moves on" },
  judgeDays: (n) => "Read across " + n + (n === 1 ? " day." : " days."),
  factionNames: { hwagam: "Hwagam", eidos: "Eidos", altair: "Altair", geumhwi: "Geumhwi" },
  sigils: {
    hwagam: "A flame inside a mirror. Whether it is reflected or confined, there is no telling.",
    eidos: "A circle within a circle. The inner circle's edge is slightly off.",
    altair: "A grid. One cell is empty. It looks as if it had been empty from the start.",
    geumhwi: "Five vertical lines. The spacing is not even. The last line stands a little farther.",
  },
} : {
  titleSub: "결정론적 인터랙티브 노벨",
  begin: "읽기 시작", resume: "이어서 읽기", restart: "처음부터",
  legacyNotice: "이전 버전(scalar_*)의 진행 기록이 발견되었습니다. 새 판은 그 기록을 사용하지 않습니다.",
  end: "끝",
  reach: { full: "완전 회수", standard: "표준", silent: "침묵 주행" },
  unasked: "묻지 않은 것들",
  gesture: { hold: "누르고 있기", release: "놓기", silence: "", trace: "따라 긋기", timeout_choice: "" },
  toc: "목차", tocBack: "뒤로", tocClose: "닫기", tocMarks: "밑줄 친 곳",
  tocPrelude: "序", tocArc: (n, lo, hi) => "Arc " + n + " — Vol." + lo + "~" + hi,
  tocVol: (n, lo, hi) => "Vol." + n + (lo ? " — Ch." + lo + "~" + hi : ""),
  thicknessToggle: "남은 두께 표시",
  judgeRead: (f) => f + "의 방식으로 읽었습니다.",
  judgeSeeds: (o, t) => "회수 " + o + "/" + t,
  judgePace: { slow: "오래 머무는 쪽", fast: "앞으로 가는 쪽" },
  judgeDays: (n) => n + "일에 걸쳐 읽었습니다.",
  factionNames: { hwagam: "화감", eidos: "에이도스", altair: "알타이르", geumhwi: "금휘" },
  sigils: {
    hwagam: "불꽃이 거울 안에 있다. 비추는 것인지 갇힌 것인지 알 수 없다.",
    eidos: "원 안에 원. 안쪽 원의 가장자리가 조금 어긋나 있다.",
    altair: "격자. 한 칸이 비어있다. 처음부터 비어있었던 것처럼 보인다.",
    geumhwi: "세로선 다섯 개. 간격이 같지 않다. 마지막 선이 조금 더 멀다.",
  },
};
if (window.LANG === "jp") window.STR = {
  titleSub: "決定論的インタラクティブノベル",
  begin: "読みはじめる", resume: "続きを読む", restart: "最初から",
  legacyNotice: "以前のバージョン(scalar_*)の進行記録が見つかりました。この版ではそれを使用しません。",
  end: "終わり",
  reach: { full: "完全回収", standard: "標準", silent: "沈黙走行" },
  unasked: "問わなかったもの",
  gesture: { hold: "押し続ける", release: "離す", silence: "", trace: "なぞる", timeout_choice: "" },
  toc: "目次", tocBack: "戻る", tocClose: "閉じる", tocMarks: "傍線を引いた箇所",
  tocPrelude: "序", tocArc: (n, lo, hi) => "Arc " + n + " — Vol." + lo + "~" + hi,
  tocVol: (n, lo, hi) => "Vol." + n + (lo ? " — Ch." + lo + "~" + hi : ""),
  thicknessToggle: "残りの厚みを表示",
  judgeRead: (f) => f + "の流儀で読みました。",
  judgeSeeds: (o, t) => "回収 " + o + "/" + t,
  judgePace: { slow: "長く留まるほう", fast: "先へ進むほう" },
  judgeDays: (n) => n + "日にわたって読みました。",
  factionNames: { hwagam: "ファガム", eidos: "エイドス", altair: "アルタイル", geumhwi: "グムヒ" },
  sigils: {
    hwagam: "炎が鏡の中にある。映しているのか、閉じ込められているのか分からない。",
    eidos: "円の中に円。内側の円の縁が少しずれている。",
    altair: "格子。一マスが空いている。最初から空いていたように見える。",
    geumhwi: "縦線が五本。間隔が均等ではない。最後の線が少し遠い。",
  },
};

window.STAGE = (function () {
  let $flow, $viewport, $hud, $title, $crack, $gesture, $choices, $toc, $thickness;
  let lossQueue = [];      // 다음 진행 시 소실될 라인 요소들
  let crackLevel = 0;

  /* ════════════════ 사운드 (절차 합성) ════════════════ */
  const Sound = (function () {
    let ac = null, master = null, bed = null, bedKey = null;
    const AC = typeof AudioContext !== "undefined" ? AudioContext
      : (typeof webkitAudioContext !== "undefined" ? webkitAudioContext : null);

    function ensure() {
      if (!AC) return false;
      if (!ac) {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = (window.STATE.getSettings().volume || 0.8) * 0.5;
        master.connect(ac.destination);
      }
      return true;
    }
    function resume() { if (ac && ac.state === "suspended") ac.resume(); }

    /* 지속 베드(BGM 결) — 가문/구역별. 기본값은 무음 (있는 구간이 예외) */
    const BEDS = {
      // 일상(식탁) — 낮고 따뜻한 패드
      daily: (t) => [osc("sine", 110, 0.05), osc("sine", 165, 0.025)],
      // Echo Core 내부 — 저역 드론
      core_inner: (t) => [osc("sine", 55, 0.07), osc("sine", 82.5, 0.02)],
      // 화감 — 형광등 험 (낮은 지속음)
      hwagam: (t) => [osc("sawtooth", 120, 0.012, 400)],
      // 알타이르 — 단속적 연산 펄스
      altair: (t) => [pulse(660, 0.012, 1.6)],
      // 에이도스/금휘/공가/observer/trio — 정적
    };
    function osc(type, freq, gain, lpf) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ac.createGain(); g.gain.value = 0;
      let node = o;
      if (lpf) {
        const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lpf;
        o.connect(f); node = f;
      }
      node.connect(g); g.connect(master); o.start();
      g.gain.linearRampToValueAtTime(gain, ac.currentTime + 2.5);  // 2초+ 페이드 인
      return { o, g };
    }
    function pulse(freq, gain, period) {
      const v = osc("sine", freq, 0);
      const lfo = ac.createOscillator(); lfo.frequency.value = 1 / period;
      const lg = ac.createGain(); lg.gain.value = gain;
      lfo.connect(lg); lg.connect(v.g.gain); lfo.start();
      v.lfo = lfo;
      return v;
    }
    function setBed(key) {
      if (!ensure() || key === bedKey) return;
      bedKey = key;
      if (bed) {  // 2초+ 페이드 아웃 후 정지
        const old = bed;
        old.forEach((v) => v.g.gain.linearRampToValueAtTime(0, ac.currentTime + 2.2));
        setTimeout(() => old.forEach((v) => { v.o.stop(); if (v.lfo) v.lfo.stop(); }), 2600);
        bed = null;
      }
      const make = BEDS[key];
      if (make) bed = make();
    }

    /* 단발 SFX — fx 태그 트리거 (§4) */
    function sfx(kind) {
      if (!ensure()) return;
      const t = ac.currentTime;
      const g = ac.createGain(); g.connect(master);
      if (kind === "echo_pad") {        // 잔향 패드
        const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = 220;
        o.connect(g); g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        o.start(t); o.stop(t + 1.9);
      } else if (kind === "glass") {    // 유리 응력음
        const n = noise(0.4); const f = ac.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 18;
        n.connect(f); f.connect(g);
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      } else if (kind === "impact") {   // 저역 임팩트
        const o = ac.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.4);
        o.connect(g); g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.start(t); o.stop(t + 0.55);
      }
    }
    function noise(dur) {
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.start();
      return src;
    }
    function setVolume(v) { if (master) master.gain.value = v * 0.5; }
    return { setBed, sfx, resume, setVolume, available: () => !!AC };
  })();

  /* ════════════════ 기본 렌더 ════════════════ */
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function emphasize(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  function reduced() {
    return document.documentElement.classList.contains("reduced-motion");
  }

  function init() {
    $viewport = document.getElementById("viewport");
    $flow = document.getElementById("flow");
    $hud = document.getElementById("hud");
    $title = document.getElementById("title-screen");
    $crack = document.getElementById("crack-overlay");
    $gesture = document.getElementById("gesture-hint");
    $choices = document.getElementById("choice-box");
    $toc = document.getElementById("toc");
    $thickness = document.getElementById("thickness");
    crackLevel = window.STATE.getCracks();
    applyCrack();
    document.addEventListener("click", Sound.resume, { once: true });
    document.addEventListener("keydown", Sound.resume, { once: true });
  }

  function scrollToEnd() {
    $viewport.scrollTo({ top: $viewport.scrollHeight, behavior: "auto" });
  }

  /* 가문 문법 장식 (§6-2): 색이 아니라 텍스트가 놓이는 방식 */
  let lineSeq = 0;
  function decorate(p, t) {
    const f = document.body.getAttribute("data-faction");
    lineSeq++;
    if (f === "hwagam") {  // 기록 양식 위에 서사 — 타임스탬프·항목번호 프리픽스
      const pre = document.createElement("span");
      pre.className = "hg-prefix";
      const h = String(7 + (lineSeq % 11)).padStart(2, "0");
      const m = String((lineSeq * 7) % 60).padStart(2, "0");
      pre.textContent = h + ":" + m + " · " + String(lineSeq).padStart(3, "0");
      p.prepend(pre);
    } else if (f === "altair") {  // 우측 수치 컬럼 — 의미 있는 값만
      const mch = t.match(/(\d+(?:\.\d+)?)\s*%/);
      const col = document.createElement("span");
      col.className = "at-col";
      col.textContent = mch ? mch[1] + "%" : "";
      p.appendChild(col);
    }
  }

  function renderLine(t, fx, instant, ref) {
    flushLoss();  // 직전 loss 라인은 다음 출력 순간 소실 — 독자도 잃는다
    const p = document.createElement("p");
    p.className = "line" + (instant ? " instant" : "");
    if (fx && (fx.tag || fx) === "blank" && fx.word && t.includes(fx.word)) {
      // 문장 중간에 실제 공백 (§4 blank) — 끝내 채워지지 않음
      p.innerHTML = emphasize(t).replace(
        new RegExp(fx.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        '<span class="fx-blank" aria-label="공백"></span>');
    } else {
      p.innerHTML = emphasize(t);
    }
    if (ref) {  // 밑줄 좌표 — 독자의 기록 복원
      p.setAttribute("data-sid", ref.sceneId);
      p.setAttribute("data-li", String(ref.lineIdx));
      if (window.STATE.isMarked(ref.sceneId, ref.lineIdx)) p.classList.add("marked");
    }
    decorate(p, t);
    $flow.appendChild(p);
    if (!instant && fx) applyFx(p, typeof fx === "string" ? fx : fx.tag);
    scrollToEnd();
    return p;
  }

  /* ════════════════ fx 8종 (§4) ════════════════ */
  function applyFx(p, tag) {
    switch (tag) {
      case "echo": {  // 이전 줄 잔상 1회
        const prev = p.previousElementSibling;
        if (prev && !reduced()) {
          const ghost = prev.cloneNode(true);
          ghost.className = "line fx-echo-ghost";
          prev.after(ghost);
          setTimeout(() => ghost.remove(), 1400);
        }
        Sound.sfx("echo_pad");
        break;
      }
      case "loss":  // 단어 단위 탈색→소실 — 다음 진행 시 발동
        lossQueue.push(p);
        break;
      case "blank":  // renderLine에서 처리
        break;
      case "crack": {  // 균열 누적, 회복 없음
        crackLevel = window.STATE.addCrack();
        applyCrack();
        Sound.sfx("glass");
        break;
      }
      case "shake_s":
      case "shake_m": {
        const cls = tag === "shake_m" ? "fx-shake-m" : "fx-shake-s";
        if (reduced()) {
          document.body.classList.add("fx-flash");  // 움직임 축소: 색 변화 대체 (§5-4)
          setTimeout(() => document.body.classList.remove("fx-flash"), 400);
        } else {
          $viewport.classList.add(cls);
          setTimeout(() => $viewport.classList.remove(cls), 500);
          if (navigator.vibrate) navigator.vibrate(tag === "shake_m" ? 80 : 30);
        }
        Sound.sfx("impact");
        break;
      }
      case "seat": {  // 0.8초 정지 + UI 숨김 + 완전 무음
        document.body.classList.add("fx-seat");
        window.INPUT.lock(800);
        setTimeout(() => document.body.classList.remove("fx-seat"), 800);
        break;
      }
      case "light":  // 색온도 30초 전이 — DL-12·Ch.200 전용
        document.body.classList.add("fx-light");
        break;
      case "pause_b":  // 강제 박자 1.2초
        window.INPUT.lock(1200);
        break;
    }
  }

  function flushLoss() {
    lossQueue.splice(0).forEach((p) => {
      if (reduced()) { p.remove(); return; }
      const words = p.textContent.split(/(\s+)/);
      p.innerHTML = "";
      words.forEach((w, i) => {
        const sp = document.createElement("span");
        sp.textContent = w;
        sp.style.transition = "opacity 0.5s " + (i * 60) + "ms, filter 0.5s " + (i * 60) + "ms";
        p.appendChild(sp);
      });
      requestAnimationFrame(() => {
        p.querySelectorAll("span").forEach((sp) => {
          sp.style.opacity = "0"; sp.style.filter = "blur(3px)";
        });
      });
      setTimeout(() => p.remove(), words.length * 60 + 700);  // 스크롤백에서도 사라짐
    });
  }

  function applyCrack() {
    if (!$crack) return;
    $crack.setAttribute("data-level", String(Math.min(crackLevel, 5)));
  }

  /* ════════════════ 가문 시점 전환 (§6-3) ════════════════ */
  function setFaction(faction, transition) {
    const curF = document.body.getAttribute("data-faction");
    if (curF === faction) return;
    const ms = reduced() ? 0 : (transition === "fast" ? 300 : 600);
    document.body.classList.add("faction-switching");
    setTimeout(() => {
      document.body.setAttribute("data-faction", faction);
      lineSeq = 0;
      document.body.classList.remove("faction-switching");
    }, ms);
    // 가문 사운드 결 (BGM 미지정 시): 화감 험 / 알타이르 펄스, 그 외 정적
    return ms;
  }

  function setSound(bgm, faction) {
    Sound.setBed(bgm || ({ hwagam: "hwagam", altair: "altair" })[faction] || null);
  }

  /* ════════════════ 카드·인터랙션 UI ════════════════ */
  function renderSceneBreak(instant) {
    const d = document.createElement("div");
    d.className = "scene-break" + (instant ? " instant" : "");
    $flow.appendChild(d);
  }

  function renderUnitCard(label, opts, instant) {
    const d = document.createElement("div");
    d.className = "unit-card" + ((opts && opts.resonance) ? " resonant" : "") + (instant ? " instant" : "");
    d.textContent = label;
    $flow.appendChild(d);
    scrollToEnd();
  }

  function renderEnd(payload) {
    const wrap = document.createElement("div");
    wrap.className = "end-card";
    const t = document.createElement("div");
    t.className = "end-title";
    t.textContent = window.STR.end;
    wrap.appendChild(t);
    if (payload) {
      const r = document.createElement("div");
      r.className = "end-reach";
      const name = window.STR.reach[payload.reach] || "";
      r.textContent = name + " — " + payload.seedsOwned + "/" + payload.seedTotal;
      wrap.appendChild(r);
    }
    $flow.appendChild(wrap);
    scrollToEnd();
  }

  /* 침묵 주행 후기 (§7-3): 묻지 않은 것들의 목록이 빈칸으로 */
  function renderSilentEpilogue(unchosen) {
    renderSceneBreak(false);
    const h = document.createElement("div");
    h.className = "unit-card";
    h.textContent = window.STR.unasked;
    $flow.appendChild(h);
    unchosen.forEach(() => {
      const p = document.createElement("p");
      p.className = "line";
      const b = document.createElement("span");
      b.className = "fx-blank wide";
      p.appendChild(b);
      $flow.appendChild(p);
    });
    scrollToEnd();
  }

  /* ════════════════ 완독 판정 화면 (§v2.1 2-3) — 책의 판권면 위치 ════════════════ */
  function renderJudgement(j) {
    const S = window.STR;
    const wrap = document.createElement("div");
    wrap.className = "judge-card";
    const read = document.createElement("div");
    read.className = "judge-read";
    read.textContent = S.judgeRead(S.factionNames[j.faction] || j.faction);
    wrap.appendChild(read);
    const sig = document.createElement("div");
    sig.className = "judge-sigil";
    sig.textContent = S.sigils[j.faction] || "";
    wrap.appendChild(sig);
    const stats = document.createElement("div");
    stats.className = "judge-stats";
    stats.textContent = S.judgeSeeds(j.seedsOwned, j.seedTotal)
      + " · " + S.judgePace[j.pace] + " · " + S.judgeDays(j.days);
    wrap.appendChild(stats);
    $flow.appendChild(wrap);
    scrollToEnd();
  }

  /* ════════════════ 남은 두께 — 숫자 없이, 오른손에 남은 페이지의 물성 ════════════════ */
  function setThickness(remainRatio) {
    if (!$thickness) return;
    const on = window.STATE.getSettings().thickness !== false && remainRatio !== null;
    $thickness.hidden = !on;
    if (on) {
      const r = Math.max(0, Math.min(1, remainRatio));
      $thickness.style.height = "calc((100vh - 4.8rem) * " + r.toFixed(4) + ")";
    }
  }

  /* ════════════════ 목차 (§v2.1 3-1) — 방문 표시 없음: 게임은 독자를 판단하지 않는다 ════════════════ */
  function tocBtn(text, cls, fn) {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = text;
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
  }
  function showToc(model, handlers) {
    renderTocLevel({ kind: "root" }, model, handlers);
    $toc.hidden = false;
  }
  function hideToc() { if ($toc) { $toc.hidden = true; $toc.innerHTML = ""; } }
  function renderTocLevel(level, model, handlers) {
    const S = window.STR;
    $toc.innerHTML = "";
    const list = document.createElement("div");
    list.className = "toc-list";

    if (level.kind === "root") {
      model.groups.forEach((grp) => {
        list.appendChild(tocBtn(grp.label, "toc-item", () => {
          if (grp.vols.length === 1) renderTocLevel({ kind: "units", units: grp.vols[0].units, back: { kind: "root" } }, model, handlers);
          else renderTocLevel({ kind: "vols", grp, back: { kind: "root" } }, model, handlers);
        }));
      });
      if (model.marks.length) {
        list.appendChild(tocBtn(S.tocMarks, "toc-item toc-marks", () => {
          renderTocLevel({ kind: "marks", back: { kind: "root" } }, model, handlers);
        }));
      }
    } else if (level.kind === "vols") {
      level.grp.vols.forEach((v) => {
        list.appendChild(tocBtn(v.label, "toc-item", () => {
          renderTocLevel({ kind: "units", units: v.units, back: level }, model, handlers);
        }));
      });
    } else if (level.kind === "units") {
      level.units.forEach((u) => {
        list.appendChild(tocBtn(u.label, "toc-item", () => { hideToc(); handlers.onJump(u.uid); }));
      });
    } else if (level.kind === "marks") {
      model.marks.forEach((m) => {
        list.appendChild(tocBtn(m.text, "toc-item toc-mark-line", () => {
          hideToc(); handlers.onJumpMark(m.sceneId, m.lineIdx);
        }));
      });
    }
    $toc.appendChild(list);

    const foot = document.createElement("div");
    foot.className = "toc-foot";
    if (level.back) foot.appendChild(tocBtn(S.tocBack, "toc-foot-btn", () => renderTocLevel(level.back, model, handlers)));
    if (level.kind === "root") {
      const on = window.STATE.getSettings().thickness !== false;
      const t = tocBtn(S.thicknessToggle, "toc-foot-btn" + (on ? " active" : ""), () => {
        window.STATE.setSetting("thickness", !(window.STATE.getSettings().thickness !== false));
        handlers.onThickness();
        renderTocLevel(level, model, handlers);
      });
      foot.appendChild(t);
    }
    foot.appendChild(tocBtn(S.tocClose, "toc-foot-btn", hideToc));
    $toc.appendChild(foot);
  }
  function tocVisible() { return !!($toc && !$toc.hidden); }

  /* 밑줄 토글 시각 반영 + Easter egg shake (§v2.1 2-1: 안내 없음, 기록 없음) */
  function setMarked(el, on) { if (on) el.classList.add("marked"); else el.classList.remove("marked"); }
  function easterShake() {
    if (reduced()) return;
    $viewport.classList.add("fx-shake-s");
    setTimeout(() => $viewport.classList.remove("fx-shake-s"), 500);
    if (navigator.vibrate) navigator.vibrate(20);
  }

  /* 제스처 표시 — 최소한의 UI 문언 (§8: 작품 외부 톤) */
  function showGesture(type) {
    $gesture.textContent = window.STR.gesture[type] || "";
    $gesture.setAttribute("data-type", type);
    $gesture.hidden = false;
  }
  function hideGesture() { $gesture.hidden = true; $gesture.removeAttribute("style"); }
  function holdProgress(p) {
    if (p === null) { $gesture.style.opacity = ""; return; }
    $gesture.style.opacity = String(0.4 + p * 0.6);
  }
  function traceProgress(p) { holdProgress(p); }

  function showChoices(choices, onPick) {
    $choices.innerHTML = "";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = c;
      b.addEventListener("click", (e) => { e.stopPropagation(); onPick(c); });
      $choices.appendChild(b);
    });
    $choices.hidden = false;
  }
  function hideChoices() { $choices.hidden = true; $choices.innerHTML = ""; }

  function setHud(label) { $hud.textContent = label || ""; }
  function clearFlow() { $flow.innerHTML = ""; lossQueue = []; }

  /* ════════════════ 타이틀 (씬으로 취급) ════════════════ */
  function showTitle(opts) {
    $title.innerHTML = "";
    const h = document.createElement("div");
    h.className = "title-name";
    h.textContent = "SCALAR: NODE ZERO";
    const sub = document.createElement("div");
    sub.className = "title-sub";
    sub.textContent = window.STR.titleSub;
    $title.appendChild(h); $title.appendChild(sub);
    const mkBtn = (text, fn) => {
      const b = document.createElement("button");
      b.className = "title-btn";
      b.textContent = text;
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      $title.appendChild(b);
    };
    if (opts.canContinue) mkBtn(window.STR.resume, opts.onContinue);
    mkBtn(opts.canContinue ? window.STR.restart : window.STR.begin, opts.onStart);

    /* 언어 선택 — 진행 상태는 언어판별 분리 보존 */
    const langRow = document.createElement("div");
    langRow.className = "title-lang";
    [["ko", "한국어"], ["en", "English"], ["jp", "日本語"]].forEach(([code, label]) => {
      const b = document.createElement("button");
      b.className = "lang-btn" + (window.LANG === code ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.LANG === code) return;
        window.STATE.setLang(code);
        location.reload();
      });
      langRow.appendChild(b);
    });
    $title.appendChild(langRow);

    if (opts.legacyNotice) {
      const n = document.createElement("div");
      n.className = "title-notice";
      n.textContent = window.STR.legacyNotice;
      $title.appendChild(n);
    }
    $title.hidden = false;
  }
  function hideTitle() { $title.hidden = true; }

  return {
    init, renderLine, renderSceneBreak, renderUnitCard, renderEnd, renderSilentEpilogue,
    renderJudgement, setThickness, showToc, hideToc, tocVisible, setMarked, easterShake,
    setFaction, setSound, setHud, clearFlow, showTitle, hideTitle,
    showGesture, hideGesture, holdProgress, traceProgress, showChoices, hideChoices,
    setVolume: Sound.setVolume,
  };
})();
