#!/usr/bin/env node
/* 씬 그래프 검증 — order 전 씬 도달 가능, next 참조 무결, 고아 씬 0, 완주 경로 보장. */
import { readFileSync } from "node:fs";

const path = process.argv[2] || new URL("../game/script.js", import.meta.url).pathname;
const js = readFileSync(path, "utf-8");
const PREFIX = "window.SCRIPT = ";
if (!js.startsWith(PREFIX)) { console.error("FAIL: script.js 형식 불일치"); process.exit(1); }
const S = JSON.parse(js.slice(PREFIX.length).trimEnd().replace(/;$/, ""));

let errors = 0;
const fail = (msg) => { console.error("FAIL:", msg); errors++; };

// 1. order ↔ scenes 정합
for (const sid of S.order) if (!S.scenes[sid]) fail(`order에 있으나 scenes에 없음: ${sid}`);
for (const sid of Object.keys(S.scenes)) if (!S.order.includes(sid)) fail(`scenes에 있으나 order에 없음: ${sid}`);

// 2. next 참조 무결 + unit 존재
for (const sid of S.order) {
  const sc = S.scenes[sid];
  if (sc.next !== null && !S.scenes[sc.next]) fail(`${sid}.next가 미존재 씬 참조: ${sc.next}`);
  if (!S.units[sc.unit]) fail(`${sid}.unit 미등록: ${sc.unit}`);
  if (!Array.isArray(sc.lines) || sc.lines.length === 0) fail(`${sid} 빈 씬`);
}

// 3. 완주 경로: 첫 씬에서 next 체인으로 전 씬 도달 (M1: 선형)
const visited = new Set();
let cur = S.order[0];
let hops = 0;
while (cur !== null && hops <= S.order.length) {
  if (visited.has(cur)) { fail(`순환 감지: ${cur}`); break; }
  visited.add(cur);
  cur = S.scenes[cur].next;
  hops++;
}
const unreachable = S.order.filter((sid) => !visited.has(sid));
if (unreachable.length) fail(`도달 불가 씬 ${unreachable.length}개 (예: ${unreachable.slice(0, 5).join(", ")})`);

// 4. 종착점이 정확히 1개
const ends = S.order.filter((sid) => S.scenes[sid].next === null);
if (ends.length !== 1) fail(`종착 씬이 ${ends.length}개 (1개여야 함): ${ends.slice(0, 5).join(", ")}`);

if (errors) { console.error(`\n그래프 검증 실패 — ${errors}건`); process.exit(1); }
console.log(`그래프 무결 — 씬 ${S.order.length}개 전부 ${S.order[0]} → ${ends[0]} 선형 도달, 고아 0, 순환 0`);
