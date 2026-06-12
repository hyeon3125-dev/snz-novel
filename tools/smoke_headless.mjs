#!/usr/bin/env node
/* 헤드리스 스모크 테스트 — 최소 DOM 스텁 위에서 5레이어 전체를 구동.
 * 커버: 완주(전 3부)·저장/복원·인터랙션 7건(자동 충족)·회수 게이트 공명/묵음·
 *       도달 상태 분기(full/silent)·침묵 주행 후기·도달 게이트 유닛 스킵.
 * 시각 fx 는 reduced-motion 경로로 로직만 검증 (시각 품질은 로컬 브라우저 UX 패스).
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const GAME = new URL("../game/", import.meta.url).pathname;
const FILES = ["script.js", "state.js", "director.js", "stage.js", "input.js", "main.js"];

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

// ════ 1. 완주 (전 3부) — 응답 주행 → 도달 상태 full ════
console.log("[1] 전 3부 완주 (선택 응답) → 완전 회수");
{
  const store = { scalar2_settings: settingsPreset({}) };
  const g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.tag === "button")[0].click();
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
  const seeds = JSON.parse(store.scalar2_seeds || "{}");
  check(Object.keys(seeds).length === 16, `복선 16건 전량 마킹 (실제 ${Object.keys(seeds).length})`);
  check(JSON.parse(store.scalar2_flags || "{}").in05_answer === "답", "timeout_choice 응답 플래그 기록");
  const endReach = flow.children.find((c) => c.className.includes("end-card"))
    .children.find((c) => c.className === "end-reach");
  check(endReach && endReach.textContent.startsWith("완전 회수"), `도달 상태: ${endReach && endReach.textContent}`);
  const resonant = cards.filter((c) => c.className.includes("resonant")).map((c) => c.textContent);
  check(resonant.length === 17, `회수 공명 17유닛 (gate 어노테이션 전량): 실제 ${resonant.length}`);
  check(resonant.some((t) => t.includes("Ch.51")), "공명 예시: Vol.6 Ch.51 (서안 흉터 회수)");
  check(cards.some((c) => c.textContent.includes("空家")), "완전 회수 → SS-12 「空家」 개방");
  check(g.ctx.STATE.getCracks() >= 1, "crack 누적 기록 (영구)");
}

// ════ 2. 침묵 주행 — 선택 회피 → ae03/ae04/ss12 스킵 + 후기 ════
console.log("[2] 침묵 주행 (선택 회피) → 게이트 유닛 스킵 + 후기");
{
  const store = { scalar2_settings: settingsPreset({ autoSkipChoices: true }) };
  const g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.tag === "button")[0].click();
  await playToEnd(g, g.ctx.SCRIPT.meta.lineCount + 300 + 50);
  const flow = g.byId.flow;
  const cards = flow.children.filter((c) => c.className.includes("unit-card")).map((c) => c.textContent);
  check(JSON.parse(store.scalar2_unchosen).length === 1, "비선택 기록 (실패가 아니라 기록)");
  check(!cards.some((t) => t.includes("空家")), "침묵 주행 → SS-12 스킵");
  check(!cards.some((t) => t.includes("After Ending 03")), "침묵 주행 → AE-03 스킵");
  check(cards.some((t) => t === "묻지 않은 것들"), "침묵 주행 전용 후기 1씬");
  const endReach = flow.children.find((c) => c.className.includes("end-card"))
    .children.find((c) => c.className === "end-reach");
  check(endReach && endReach.textContent.startsWith("침묵 주행"), `도달 상태: ${endReach && endReach.textContent}`);
}

// ════ 3. 회수 게이트 묵음 — seed 미보유 시 fx 억제 (director 단위) ════
console.log("[3] 회수 게이트 묵음/공명 (director)");
{
  const store = { scalar2_settings: settingsPreset({}) };
  const g = bootGame(store);
  g.ctx.STATE.load();
  g.ctx.DIRECTOR.start("v16_c199_s01", 0);  // seat fx + s_alone 게이트
  let op = g.ctx.DIRECTOR.step();  // unit
  check(op.type === "unit" && op.resonance === false, "seed 미보유 → 공명 없음");
  op = g.ctx.DIRECTOR.step();      // hold 인터랙션 (start 게이트)
  check(op.type === "interaction" && op.spec.type === "hold", "씬 진입 인터랙션 (hold)");
  g.ctx.DIRECTOR.interactionDone();
  op = g.ctx.DIRECTOR.step();      // 첫 줄
  check(op.type === "line" && op.fx === null, "묵음: seat fx 억제");
  g.ctx.STATE.markSeed("s_alone");
  g.ctx.DIRECTOR.start("v16_c199_s01", 0);
  g.ctx.DIRECTOR.step(); g.ctx.DIRECTOR.interactionDone();
  op = g.ctx.DIRECTOR.step();
  check(op.type === "line" && op.fx === "seat", "보유: seat fx 풀버전");
}

// ════ 4. 저장/이어읽기 (기존 회귀) ════
console.log("[4] 중간 이탈 → 이어읽기");
{
  const store = { scalar2_settings: settingsPreset({}) };
  let g = bootGame(store);
  g.byId["title-screen"].children.filter((c) => c.tag === "button")[0].click();
  for (let i = 0; i < 137; i++) { g.document.dispatch("click", tapEvent); g.ctx._tick(2000); await tick(); }
  const saved = JSON.parse(store.scalar2_progress);
  check(saved && saved.lineIdx > 0, `진행 자동 저장: ${saved.sceneId} @${saved.lineIdx}`);
  g = bootGame(store);
  const btns = g.byId["title-screen"].children.filter((c) => c.tag === "button");
  check(btns.length === 2 && btns[0].textContent === "이어서 읽기", "이어서 읽기 노출");
  btns[0].click();
  const restored = g.byId.flow.children.filter((c) => c.className.includes("line")).length;
  check(restored === saved.lineIdx, `맥락 복원 ${saved.lineIdx}줄`);
  g.document.dispatch("click", tapEvent); g.ctx._tick(2000); await tick();
  const lineEls = g.byId.flow.children.filter((c) => c.className.includes("line"));
  check(lineEls.length === restored + 1, "재개 후 진행 정상");
}

// ════ 5. 구버전 키 안내 (기존 회귀) ════
console.log("[5] 구버전 scalar_* 키 안내");
{
  const store = { scalar_node_state: "{}", scalar2_settings: settingsPreset({}) };
  let g = bootGame(store);
  check(g.byId["title-screen"].children.some((c) => c.className === "title-notice"), "안내 1회");
  g = bootGame(store);
  check(!g.byId["title-screen"].children.some((c) => c.className === "title-notice"), "재안내 없음");
}

console.log(failures ? `\n스모크 실패 — ${failures}건` : "\n스모크 전부 통과");
process.exit(failures ? 1 : 0);
