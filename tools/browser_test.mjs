#!/usr/bin/env node
/* 실브라우저 순차 기능 테스트 (Playwright + Chromium).
 * 헤드리스 스텁이 못 보는 것(실제 CSS 가시성·터치·오디오·콘솔 에러)을 검증한다.
 * 실행: node tools/browser_test.mjs   (사전: npm i -D playwright && npx playwright install chromium)
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 4123;
const BASE = `http://localhost:${PORT}`;

let failures = 0;
const check = (cond, msg) => {
  if (cond) console.log("  ✓", msg);
  else { console.error("  ✗ FAIL:", msg); failures++; }
};

function collectErrors(page, sink) {
  page.on("pageerror", (e) => sink.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") sink.push("console: " + m.text()); });
}

async function freshPage(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  collectErrors(page, errors);
  return { ctx, page, errors };
}

async function setProgress(page, sceneId, lineIdx, extra = {}) {
  await page.goto(BASE + "/game/");
  await page.evaluate(([sid, idx, ex]) => {
    localStorage.clear();
    localStorage.setItem("scalar2_progress", JSON.stringify({ sceneId: sid, lineIdx: idx, ts: Date.now() }));
    for (const [k, v] of Object.entries(ex)) localStorage.setItem(k, JSON.stringify(v));
  }, [sceneId, lineIdx, extra]);
  await page.reload();
  await page.getByText("이어서 읽기").click();
}

const lineCount = (page) => page.locator("#flow .line").count();

const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await sleep(1200);

const browser = await chromium.launch();
try {
  // ════ 1. 데스크톱 — 신규 시작 흐름 ════
  console.log("[1] 데스크톱: 타이틀 → 시작 → 진행");
  {
    const { ctx, page, errors } = await freshPage(browser);
    await page.goto(BASE + "/game/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    check(await page.locator("#title-screen").isVisible(), "타이틀 표시");
    await page.getByText("읽기 시작").click();
    await sleep(300);
    check(await page.locator("#title-screen").isHidden(), "시작 후 타이틀이 실제로 사라짐 (CSS 가시성)");
    check(await page.locator("#flow .unit-card").count() === 1, "첫 유닛 카드(Prologue) 자동 출력");
    for (let i = 0; i < 8; i++) { await page.mouse.click(300, 400); await sleep(60); }
    check(await lineCount(page) >= 7, `탭 진행: 라인 ${await lineCount(page)}개 출력`);
    check((await page.locator("#hud").textContent()).includes("Prologue"), "HUD 챕터 표시");
    // 저장 → 새로고침 → 이어읽기
    await page.reload();
    await page.getByText("이어서 읽기").click();
    await sleep(300);
    const restored = await lineCount(page);
    await page.mouse.click(300, 400); await sleep(120);
    check(await lineCount(page) === restored + 1, `이어읽기: ${restored}줄 복원 후 정상 진행`);
    check(errors.length === 0, `콘솔 에러 0건${errors.length ? " — " + errors[0] : ""}`);
    await ctx.close();
  }

  // ════ 2. 모바일 에뮬레이션 — 터치 시작 흐름 ════
  console.log("[2] 모바일(390×844·터치): 시작 → 탭 진행");
  {
    const { ctx, page, errors } = await freshPage(browser, {
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    await page.goto(BASE + "/game/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByText("읽기 시작").tap();
    await sleep(300);
    check(await page.locator("#title-screen").isHidden(), "터치로 시작 — 타이틀 사라짐");
    for (let i = 0; i < 6; i++) { await page.touchscreen.tap(200, 500); await sleep(60); }
    check(await lineCount(page) >= 5, `터치 탭 진행: 라인 ${await lineCount(page)}개`);
    check(errors.length === 0, `콘솔 에러 0건${errors.length ? " — " + errors[0] : ""}`);
    await ctx.close();
  }

  // ════ 3. fx — echo 씬 + BGM(AudioContext) 무사고 ════
  console.log("[3] fx: echo (v07_c053_s03) + core_inner BGM");
  {
    const { ctx, page, errors } = await freshPage(browser);
    await setProgress(page, "v07_c053_s03", 0);
    for (let i = 0; i < 6; i++) { await page.mouse.click(300, 400); await sleep(80); }
    check(await page.locator("#flow .line", { hasText: "닫지 마" }).count() >= 1, "echo 대상 라인 출력");
    check(errors.length === 0, `fx·오디오 경로 콘솔 에러 0건${errors.length ? " — " + errors[0] : ""}`);
    await ctx.close();
  }

  // ════ 4. timeout_choice — 선택지 표시·선택·기록 ════
  console.log("[4] 인터랙션: timeout_choice (in05_s02)");
  {
    const { ctx, page, errors } = await freshPage(browser);
    await setProgress(page, "in05_s02", 0);
    for (let i = 0; i < 30 && !(await page.locator("#choice-box .choice-btn").count()); i++) {
      await page.mouse.click(300, 400); await sleep(70);
    }
    check(await page.locator("#choice-box").isVisible(), "선택지 박스 실제 표시 (CSS 가시성)");
    check(await page.locator(".choice-btn").count() === 2, "선택지 2개 (답 / ARIA)");
    await page.locator(".choice-btn", { hasText: "답" }).click();
    await sleep(200);
    check(await page.locator("#choice-box").isHidden(), "선택 후 박스 숨김");
    const flag = await page.evaluate(() => JSON.parse(localStorage.getItem("scalar2_flags") || "{}"));
    check(flag.in05_answer === "답", "선택 플래그 기록");
    await page.mouse.click(300, 400); await sleep(100);
    check(errors.length === 0, `콘솔 에러 0건${errors.length ? " — " + errors[0] : ""}`);
    await ctx.close();
  }

  // ════ 5. hold 제스처 — 누르고 있어야 진행 ════
  console.log("[5] 인터랙션: hold (v16_c199_s01)");
  {
    const { ctx, page, errors } = await freshPage(browser);
    await setProgress(page, "v16_c199_s01", 0);
    await page.mouse.click(300, 400); await sleep(100);   // 유닛 카드
    await page.mouse.click(300, 400); await sleep(100);   // 인터랙션 발동
    check(await page.locator("#gesture-hint").isVisible(), "제스처 힌트 표시 (누르고 있기)");
    const before = await lineCount(page);
    await page.mouse.move(300, 400);
    await page.mouse.down(); await sleep(3000); await page.mouse.up();
    await sleep(300);
    check(await page.locator("#gesture-hint").isHidden(), "충족 후 힌트 숨김");
    check(await lineCount(page) > before, "hold 충족 → 진행");
    check(errors.length === 0, `콘솔 에러 0건${errors.length ? " — " + errors[0] : ""}`);
    await ctx.close();
  }

  // ════ 6. 루트 리다이렉트 ════
  console.log("[6] 루트 → game/ 리다이렉트");
  {
    const { ctx, page } = await freshPage(browser);
    await page.goto(BASE + "/");
    await page.waitForURL("**/game/**", { timeout: 5000 }).catch(() => {});
    check(page.url().includes("/game/"), "메타 리프레시 동작");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n브라우저 테스트 실패 — ${failures}건` : "\n브라우저 테스트 전부 통과");
process.exit(failures ? 1 : 0);
