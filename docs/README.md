# Documentation Index

This directory is the **canonical reference for AI-assisted development** in this repo. When you build or modify a game and learn something reusable — a confirmed API pattern, a non-obvious gotcha, an architecture that worked — fold it back into the matching doc here so the next agent benefits. (See **Maintaining these docs** below.)

## Kaplay
- [kaplay/kaplay-api.md](kaplay/kaplay-api.md) — Kaplay v4000 API overview

## Phaser
- [phaser/phaser4-api.md](phaser/phaser4-api.md) — Phaser 4.0.0 full API reference

## three.js
- [threejs/threejs-api.md](threejs/threejs-api.md) — three.js r165 patterns used in this repo (import map, render loop, gotchas)

## Generic
- [generic/learnings.md](generic/learnings.md) — Architecture patterns and lessons learned across all games
- [generic/sounds.md](generic/sounds.md) — Procedural Web Audio API sound design patterns
- [generic/suggestions.md](generic/suggestions.md) — Future game ideas and backlog

---

## Maintaining these docs

**When to update:** After finishing or substantially changing a game, ask "what did I learn that a future agent would want before touching a similar game?" If the answer isn't already written here, add it. Capture *reusable* knowledge — confirmed-working API calls, gotchas that cost you time, patterns worth copying — **not** a play-by-play of the game (that belongs in the game's own `game-plan.md` / `CHANGELOG.md`).

**Where it goes — pick by topic, not by game:**

| Learning is about… | Put it in |
|--------------------|-----------|
| A Kaplay API call, component, or quirk | [kaplay/kaplay-api.md](kaplay/kaplay-api.md) |
| A Phaser 4 API, scene, or config detail | [phaser/phaser4-api.md](phaser/phaser4-api.md) |
| A three.js pattern, addon, or gotcha | [threejs/threejs-api.md](threejs/threejs-api.md) |
| Architecture, module layout, event/state patterns, bugs & fixes that span engines | [generic/learnings.md](generic/learnings.md) |
| A procedural Web Audio sound recipe or sound-design principle | [generic/sounds.md](generic/sounds.md) |
| A future game idea or backlog item | [generic/suggestions.md](generic/suggestions.md) |

A new engine (not Kaplay/Phaser/three.js) gets its own `docs/<engine>/<engine>-api.md` file and a new section in this index.

**How to write a good entry:**
- **Attribute it.** Tag the learning with the game that proved it, e.g. "*(game-024)*" or a `[game-024](../../game-024/)` link, so its provenance and a reference implementation are findable.
- **Show the confirmed code**, kept minimal. These docs document what *actually works in this repo*, not the general API — a 6-line snippet that runs beats a paragraph of prose.
- **Lead gotchas with the symptom** ("window resizes but render is squashed →") so an agent debugging the same issue finds it by searching the symptom.
- **Prefer editing an existing section** over appending a near-duplicate. If a pattern graduates from "not used by any game" to "in use," update that note in place.
- **Fix stale claims** you notice while editing (e.g. "both games use…" when there are now twelve). Doc rot misleads the next agent.

**Keep the index honest:** if you add a doc file or a major new section, add/refresh its line in this index. If you add a new engine, also update the "Technologies Used" and "Developer Documentation" sections of the root [README.md](../README.md).

**Relationship to other docs:**
- `game-###/game-plan.md` — design + phase changelog for *one* game. Game-specific narrative lives there, reusable lessons get lifted into `docs/`.
- Auto-memory `MEMORY.md` (outside the repo, loaded each session) — a terse pointer index; for engine details it should *point at* these docs rather than duplicate them.
