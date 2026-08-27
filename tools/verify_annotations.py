#!/usr/bin/env python3
"""Validate v3 annotation evidence and seed/gate causality."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


PREFIX = "window.SCRIPT = "


def load_script(path):
    text = Path(path).read_text(encoding="utf-8")
    return json.loads(text[len(PREFIX):].rstrip().rstrip(";"))


def merge(base, override):
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            merge(base[key], value)
        else:
            base[key] = value
    return base


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("-a", "--annotations", action="append", default=[])
    args = ap.parse_args()
    ann = {}
    for path in args.annotations:
        merge(ann, json.loads(Path(path).read_text(encoding="utf-8")))
    script = load_script(args.script)
    errors = []

    chapter_units = [unit for unit in script["units"].values()
                     if unit.get("kind") == "chapter"]
    chapters = {unit.get("ch"): unit.get("part") for unit in chapter_units}
    expected_chapters = {
        ch: 1 if ch <= 12 else 2 if ch <= 26 else 3 if ch <= 46
        else 4 if ch <= 64 else 5
        for ch in range(1, 79)
    }
    if len(chapter_units) != 78 or chapters != expected_chapters:
        errors.append("chapter architecture is not Part 1~5 / Ch.1~78")
    if script["scenes"][script["order"][0]]["unit"] != "pro":
        errors.append("story does not start with prologue")
    if script["scenes"][script["order"][-1]]["unit"] != "epi":
        errors.append("story does not end with epilogue")
    last_chapter = next((script["scenes"][sid]["unit"] for sid in reversed(script["order"])
                         if script["units"][script["scenes"][sid]["unit"]].get("kind") == "chapter"), None)
    if script["meta"].get("judgementUnit") != last_chapter:
        errors.append(f"judgementUnit is not the final chapter: {script['meta'].get('judgementUnit')}")

    for key, expected in ann.get("anchors", {}).items():
        sid, kind = key.split("#", 1)
        scene = script["scenes"].get(sid)
        if not scene:
            errors.append(f"anchor scene missing: {key}")
            continue
        if kind.startswith("fx:"):
            index = int(kind.split(":", 1)[1])
            actual = scene["lines"][index]["t"] if index < len(scene["lines"]) else None
            if actual != expected:
                errors.append(f"anchor text mismatch: {key}")
        elif kind == "interaction" and expected not in [line["t"] for line in scene["lines"]]:
            errors.append(f"interaction evidence missing: {key}")

    unit_pos = {}
    for index, sid in enumerate(script["order"]):
        unit_pos.setdefault(script["scenes"][sid]["unit"], index)
    seed_pos = {}
    for uid, unit in script["units"].items():
        seeds = unit.get("seed") or []
        for seed in seeds if isinstance(seeds, list) else [seeds]:
            seed_pos[seed] = min(seed_pos.get(seed, 10**9), unit_pos[uid])
    for uid, unit in script["units"].items():
        gate = unit.get("gate") or {}
        for seed in gate.get("seeds", []):
            if seed not in seed_pos:
                errors.append(f"undefined gate seed: {uid} -> {seed}")
            elif seed_pos[seed] >= unit_pos[uid]:
                errors.append(f"gate seed is not earlier: {uid} -> {seed}")
    if script["meta"]["reachRules"]["fullSeedsMin"] > script["meta"]["seedTotal"]:
        errors.append("fullSeedsMin exceeds seedTotal")

    if errors:
        print(f"어노테이션 검증 실패 — {len(errors)}건")
        for error in errors[:50]:
            print("  ✗", error)
        return 1
    print(f"어노테이션 검증 100% — anchors {len(ann.get('anchors', {}))}, "
          f"seeds {len(seed_pos)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
