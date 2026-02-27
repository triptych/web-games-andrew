# Game 011 — Nonogram Fleet: Changelog

## v1.0.1 — 2026-02-27

### Added
- **Airship sprite** — player scout ship `sprites/airship.png` (credit: bevouliin.com) displayed on splash screen (centered, gently bobbing) and on the left panel of the battle screen (slow cruising bob animation)
- **Sprite attribution** — "Sprite by bevouliin.com" credit line added to splash screen bottom-left, stacked above the existing music credit

---

## v1.0.0 — 2026-02-27 — Phase 3 Complete

### Added
- **Intro / How-to-play screen** — illustrated `intro` scene with mini nonogram diagram, mode description boxes, and start button
- **Mission briefing crawl** — `briefing` scene with star-wars-style scrolling story text, character-by-character reveal, and skip support
- **Procedural audio** — full Web Audio sound system (`sounds.js`): background music, UI click, fire/miss, hit, ship sunk, level complete, puzzle failed, game over
- **Level progression** — 8 escalating level configs with increasing fleet density and shrinking missile budgets
- **Level-complete tally overlay** — shots-remaining bonus score calculation, breakdown panel, "NEXT LEVEL" button
- **Ship-sunk banner** — per-ship destruction message shown in HUD
- **Explosion & fire effects** — hit cells show persistent flame + smoke particles; sunk ships trigger multi-cell burst + dual shockwave rings
- **Clue satisfaction highlight** — row/col clue numbers turn green when their line is correctly solved
- **Ship tally panel** — right-side panel lists every enemy vessel with segment pip indicators that update on hit/sunk

---

## v0.2.0 — Phase 2: Puzzle Logic & Fleet

- Full nonogram puzzle engine: clue generation, line-satisfaction checking, auto-solve detection
- Fleet placement: random non-overlapping ship placement on 10×10 grid
- Fire mode: left-click to fire torpedoes, hit/miss/already-fired detection
- Drag-to-paint solve mode: hold left/right mouse button to paint/mark multiple cells
- Tab key and mode-switch button to toggle Solve ↔ Fire mode
- Auto-switch to Fire Mode on puzzle solve
- Revealed cell states: hit (orange), sunk (red), miss (dot marker)
- Shot budget enforcement: depleted shots triggers puzzle-failed event

---

## v0.1.0 — Phase 1: Scaffolding

- Kaplay 1280×720 canvas, letterboxed, crisp pixel rendering
- Starfield background (static dots + nebula blobs) shared across scenes
- Splash scene with title, subtitle, blink prompt, version/credit tags
- Game scene skeleton with EventBus, state singleton, HUD labels (score, lives, missiles, level)
- Module layout: `main`, `config`, `state`, `events`, `grid`, `puzzle`, `fleet`, `ui`, `sounds`
