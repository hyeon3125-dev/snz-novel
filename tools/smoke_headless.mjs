#!/usr/bin/env node
/* 헤드리스 스모크 테스트 — v3 5부 전체를 최소 DOM 스텁 위에서 구동.
 * 커버: 완주·저장/복원·핵심 인터랙션·회수 게이트 공명/묵음·
 *       도달 상태 분기(full/silent)·v2 저장 격리.
 * 시각 fx 는 reduced-motion 경로로 로직만 검증 (시각 품질은 로컬 브라우저 UX 패스).
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const GAME = new URL("../game/", import.meta.url).pathname;
const LANG = ["en", "jp"].includes(process.env.SNZ_LANG) ? process.env.SNZ_LANG : "ko";   // SNZ_LANG=en|jp 으로 언어판 회귀
const SUF = LANG === "en" ? "_en" : (LANG === "jp" ? "_jp" : "");
const SCRIPT_FILE = LANG === "en" ? "script.en.js" : (LANG === "jp" ? "script.jp.js" : "script.js");
const T = LANG === "en"
  ? { begin: "Begin", resume: "Continue", reach: "Full Recall", silent: "Silent Run", unasked: "The Unasked", choice: "Answer" }
  : LANG === "jp"
  ? { begin: "読みはじめる", resume: "続きを読む", reach: "完全回収", silent: "沈黙走行", unasked: "問わなかったもの", choice: "答え" }
  : { begin: "읽기 시작", resume: "이어서 읽기", reach: "완전 회수", silent: "침묵 주행", unasked: "묻지 않은 것들", choice: "답" };
const FILES = [SCRIPT_FILE, "state.js", "director.js", "stage.js", "input.js", "main.js"];

// ── 최소 DOM 스텁 ──
function makeElement(tag) {
  const el = {
    tag, children: [], className: "", textContent: "", hidden: false,
    _innerHTML: "", _listeners: {}, _attrs: {}, style: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    prepend(c) { this.children.unshift(c); },
    after(c) { if (this.parent) this.parent.children.push(c); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); },
    cloneNode() { return makeElement(this.tag); },
    querySelectorAll() { return []; },
    addEventListener(name, fn) { (this._listeners[name] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] ?? null; },
    removeAttribute(k) { delete this._attrs[k]; },
    scrollTo() {}, closest() { return null; },
    get previousElementSibling() {
      const i = this.parent ? this.parent.children.indexOf(this) : -1;
      return i > 0 ? this.parent.children[i - 1] : null;
    },
    get scrollHeight() { return 0; },
    set innerHTML(v) { this._innerHTML = v; if (v === "") this.children = []; },
    get innerHTML() { return this._innerHTML; },
    click() { (this._listeners.click || []).forEach((fn) => fn({ stopPropagation() {} })); },
  };
  return el;
}

function makeDom() {
  const byId = {};
  for (const id of ["viewport", "flow", "hud", "title-screen", "tap-space",
                    "crack-overlay", "gesture-hint", "choice-box", "lens-mask"]) {
    byId[id] = makeElement("div");
  }
  const docListeners = {};
  const document = {
    documentElement: makeElement("html"),
    body: makeElement("body"),
    activeElement: null,
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => makeElement(tag),
    addEventListener: (name, fn) => { (docListeners[name] ||= []).push(fn); },
    dispatch: (name, ev) => (docListeners[name] || []).slice().forEach((fn) => fn(ev)),
  };
  return { document, byId };
}

function makeStorage(backing) {
  return {
    getItem: (k) => (k in backing ? backing[k] : null),
    setItem: (k, v) => { backing[k] = String(v); },
    removeItem: (k) => { delete backing[k]; },
    key: (i) => Object.keys(backing)[i] ?? null,
    get length() { return Object.keys(backing).length; },
  };
}

function bootGame(backing) {
  const { document, byId } = makeDom();
  let timeOffset = 0;
  const RealNow = Date.now.bind(Date);
  const FakeDate = class extends Date {};
  FakeDate.now = () => RealNow() + timeOffset;
  const sandbox = {
    LANG,
    document,
    localStorage: makeStorage(backing),
    matchMedia: () => ({ matches: false }),
    navigator: {},
    requestAnimationFrame: (fn) => fn(),
    setTimeout, clearTimeout, setInterval, clearInterval,
    console: { debug() {}, log: console.log, error: console.error, warn: console.warn },
    Date: FakeDate,
    JSON, Promise, Math,
    _tick: (ms) => { timeOffset += ms; },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of FILES) {
    vm.runInContext(readFileSync(GAME + f, "utf-8"), ctx, { filename: f });
  }
  document.dispatch("DOMContentLoaded");
  return { ctx: sandbox, document, byId };
}

const tapEvent = { target: { closest: () => null } };
const tick = () => new Promise((r) => setImmediate(r));
let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log("  ✓", msg);
  else { console.error("  ✗ FAIL:", msg); failures++; }
};
const settingsPreset = (extra) => JSON.stringify(Object.assign(
  { reducedMotion: true, autoResolveInteractions: true, volume: 0 }, extra));

async function playToEnd(g, maxTaps) {
  const flow = g.byId.flow;
  let taps = 0;
  while (!flow.children.some((c) => c.className.includes("end-card")) && taps < maxTaps) {
    g.document.dispatch("click", tapEvent);
    g.ctx._tick(2000);  // pause_b/seat 락 무력화 (가짜 시계)
    await tick();
    taps++;
  }
  return taps;
}

// ════ 1. 완주 (전 5부) — 응답 주행 → 도달 상태 full ════
console.log("[1] v3 5부 완주 (선택 응답) → 완전 회수");
{
  const store = { scalar_settings: settingsPreset({}) };
  const g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"))[0].click();
  const S = g.ctx.SCRIPT;
  const taps = await playToEnd(g, S.meta.lineCount + 300 + 50);
  const flow = g.byId.flow;
  const lines = flow.children.filter((c) => c.className.includes("line") && !c.className.includes("fx-echo")).length;
  const cards = flow.children.filter((c) => c.className.includes("unit-card"));
  check(flow.children.some((c) => c.className.includes("end-card")), `완주: ${taps}탭`);
  // loss 1줄은 소실되므로 lineCount-1 허용
  check(lines >= S.meta.lineCount - 1 && lines <= S.meta.lineCount,
        `라인 전수 출력: ${lines}/${S.meta.lineCount} (loss 소실 ≤1)`);
  check(cards.length === Object.keys(S.units).length, `유닛 카드 전수: ${cards.length}/${Object.keys(S.units).length}`);
  const seeds = JSON.parse(store["scalar3_seeds" + SUF] || "{}");
  check(Object.keys(seeds).length === S.meta.seedTotal,
        `복선 ${S.meta.seedTotal}건 전량 마킹 (실제 ${Object.keys(seeds).length})`);
  check(JSON.parse(store["scalar3_flags" + SUF] || "{}").priority_answer === T.choice, "timeout_choice 응답 플래그 기록");
  const endReach = flow.children.find((c) => c.className.includes("end-card"))
    .children.find((c) => c.className === "end-reach");
  check(endReach && endReach.textContent.startsWith(T.reach), `도달 상태: ${endReach && endReach.textContent}`);
  const resonant = cards.filter((c) => c.className.includes("resonant")).map((c) => c.textContent);
  const expGates = Object.values(S.units).filter((u) => u.gate).length;
  check(resonant.length === expGates, `회수 공명 ${expGates}유닛 (gate 어노테이션 전량): 실제 ${resonant.length}`);
  check(resonant.length > 0, "회수 근거가 있는 유닛만 공명");
  check(g.ctx.STATE.getCracks() >= 1, "crack 누적 기록 (영구)");
  // 완독 판정 — 메타에 지정된 마지막 본편 유닛 통과 시 1회 생성
  const judge = JSON.parse(store["scalar3_judgement" + SUF] || "null");
  check(judge && judge.triggered && ["hwagam", "eidos", "altair", "geumhwi"].includes(judge.faction),
        `완독 판정 1회 생성: ${judge && judge.faction} (공가 제외 — 불변식 10)`);
  check(flow.children.some((c) => c.className === "judge-card"), "판정 화면 (판권면 자리) 출력");
  const tel = JSON.parse(store["scalar3_telemetry" + SUF] || "{}");
  check(tel.scenes >= S.meta.sceneCount && tel.choiceOffered >= 1,
        `읽기 결 집계: 씬 ${tel.scenes} · 선택 제시 ${tel.choiceOffered}`);
}

// ════ 2. 침묵 주행 — 선택 회피 → 후기 ════
console.log("[2] 침묵 주행 (선택 회피) → 후기");
{
  const store = { scalar_settings: settingsPreset({ autoSkipChoices: true }) };
  const g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"))[0].click();
  await playToEnd(g, g.ctx.SCRIPT.meta.lineCount + 300 + 50);
  const flow = g.byId.flow;
  const cards = flow.children.filter((c) => c.className.includes("unit-card")).map((c) => c.textContent);
  const choiceCount = Object.values(g.ctx.SCRIPT.scenes)
    .filter((s) => s.interaction && s.interaction.type === "timeout_choice").length;
  check(JSON.parse(store["scalar3_unchosen" + SUF]).length === choiceCount,
        `비선택 ${choiceCount}건 기록 (실패가 아니라 기록)`);
  check(cards.some((t) => t === T.unasked), "침묵 주행 전용 후기 1씬");
  const endReach = flow.children.find((c) => c.className.includes("end-card"))
    .children.find((c) => c.className === "end-reach");
  check(endReach && endReach.textContent.startsWith(T.silent), `도달 상태: ${endReach && endReach.textContent}`);
}

// ════ 3. 회수 게이트 묵음 — seed 미보유 시 fx 억제 (director 단위) ════
console.log("[3] 회수 게이트 묵음/공명 (director)");
{
  const store = { scalar_settings: settingsPreset({}) };
  const g = bootGame(store);
  g.ctx.STATE.load();
  g.ctx.DIRECTOR.start("p05_c078_s01", 0);  // seat fx + s_alone 게이트
  let op = g.ctx.DIRECTOR.step();  // unit
  check(op.type === "unit" && op.resonance === false, "seed 미보유 → 공명 없음");
  op = g.ctx.DIRECTOR.step();      // hold 인터랙션 (start 게이트)
  check(op.type === "interaction" && op.spec.type === "hold", "씬 진입 인터랙션 (hold)");
  g.ctx.DIRECTOR.interactionDone();
  op = g.ctx.DIRECTOR.step();      // 첫 줄
  check(op.type === "line" && op.fx === null, "묵음: seat fx 억제");
  g.ctx.STATE.markSeed("s_alone");
  g.ctx.DIRECTOR.start("p05_c078_s01", 0);
  g.ctx.DIRECTOR.step(); g.ctx.DIRECTOR.interactionDone();
  op = g.ctx.DIRECTOR.step();
  check(op.type === "line" && op.fx === "seat", "보유: seat fx 풀버전");
}

// ════ 4. 저장/이어읽기 (기존 회귀) ════
console.log("[4] 중간 이탈 → 이어읽기");
{
  const store = { scalar_settings: settingsPreset({}) };
  let g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"))[0].click();
  for (let i = 0; i < 137; i++) { g.document.dispatch("click", tapEvent); g.ctx._tick(2000); await tick(); }
  const saved = JSON.parse(store["scalar3_progress" + SUF]);
  check(saved && saved.lineIdx > 0, `진행 자동 저장: ${saved.sceneId} @${saved.lineIdx}`);
  g = bootGame(store);
  const btns = g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"));
  check(btns.length === 2 && btns[0].textContent === T.resume, "이어서 읽기 노출");
  btns[0].click();
  const restored = g.byId.flow.children.filter((c) => c.className.includes("line")).length;
  check(restored === saved.lineIdx, `맥락 복원 ${saved.lineIdx}줄`);
  g.document.dispatch("click", tapEvent); g.ctx._tick(2000); await tick();
  const lineEls = g.byId.flow.children.filter((c) => c.className.includes("line"));
  check(lineEls.length === restored + 1, "재개 후 진행 정상");
}

// ════ 4.5 점프 스킵 비선택(skipped)은 도달 상태에 불산입 (§v2.1 3-1) ════
console.log("[4.5] skipped 비선택 → 침묵 주행 불산입");
{
  const skipped = [1, 2, 3].map((i) => ({ sceneId: "in02_s02", ts: i, skipped: true }));
  const store = {
    scalar_settings: settingsPreset({}),
    ["scalar3_unchosen" + SUF]: JSON.stringify(skipped),
    ["scalar3_progress" + SUF]: JSON.stringify({ sceneId: "epi_s01", lineIdx: 0, ts: 1 }),
  };
  const g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"))[0].click();
  await playToEnd(g, 800);
  const endReach = g.byId.flow.children.find((c) => c.className.includes("end-card"))
    .children.find((c) => c.className === "end-reach");
  check(endReach && !endReach.textContent.startsWith(T.silent),
        `skipped ×3은 침묵 판정 아님: ${endReach && endReach.textContent}`);
  check(g.ctx.STATE.getUnchosenAsked().length === 0, "제시받은 비선택 0건 유지");
}

// ════ 5. v2 기록 안내 + 좌표 격리 ════
console.log("[5] v2 기록 안내 + 좌표 격리");
{
  const oldProgress = JSON.stringify({ sceneId: "v16_c200_s01", lineIdx: 3 });
  const store = { scalar2_progress: oldProgress, scalar2_settings: settingsPreset({}) };
  let g = bootGame(store);
  check(g.byId["title-screen"].children.some((c) => c.className === "title-notice"), "안내 1회");
  check(!store.scalar3_progress, "v2 진행 좌표를 v3로 이식하지 않음");
  check(store.scalar2_progress === oldProgress, "v2 진행 좌표 원본 유지");
  g = bootGame(store);
  check(!g.byId["title-screen"].children.some((c) => c.className === "title-notice"), "재안내 없음");
}

// ════ 6. 손상·예비 v3 저장 좌표는 신규 시작으로 복구 ════
console.log("[6] 무효 v3 진행 좌표 복구");
{
  const key = "scalar3_progress" + SUF;
  const store = {
    scalar_settings: settingsPreset({}),
    [key]: JSON.stringify({ sceneId: "pre03_s02", lineIdx: 99 }),
  };
  const g = bootGame(store);
  const btns = g.byId["title-screen"].children.filter((c) => c.className.includes("title-btn"));
  check(btns.length === 1 && btns[0].textContent === T.begin, "무효 이어읽기 제거 → 처음부터");
  check(store[key] === "null", "손상된 좌표 초기화");
}

console.log(`[lang=${LANG}] `, failures ? `\n스모크 실패 — ${failures}건` : "\n스모크 전부 통과");
process.exit(failures ? 1 : 0);
