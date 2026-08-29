# Hearthbound — Tests

## Unit tests (`node --test`)

Pure-logic tests for `config.js`, `state.js`, `dialogueEngine.js`, and
`story.js` — no browser/DOM required, since none of those modules touch
the DOM directly.

```bash
cd game-033
npm test
# equivalent to: node --test tests/*.test.js
```

Covers: XP curve, enemy level-scaling (`enemyScaleForLevel`/`scaledEnemy`),
equip-slot stacking (trinket + charm, bonus + penalty), brewing
(`state.brew`/`canBrew`), save/load round-trips, dialogue-engine condition
gating (`choiceIsAvailable`) and effect application, and story-graph
integrity (every node/choice/battle reference resolves, the graph is
reachable from `start`).

`state.js` reads/writes `localStorage` for save/load; the test files shim
a minimal in-memory `localStorage` on `globalThis` before importing it,
since Node has no global `localStorage`.

## Manual smoke test (`smoke.playwright.mjs`)

Not part of `npm test` — it drives the real page in headless Chromium via
Playwright, so it needs a static file server for the repo root and the
`playwright` package. Run manually when touching DOM-facing modules
(`vnRenderer.js`, `inventory.js`, `battle.js`, `brewing.js`, `ui.js`,
`statsPanel.js`, `main.js`):

```bash
# from the repo root
python3 -m http.server 8765 &
node game-033/tests/smoke.playwright.mjs
```

It boots the title screen, starts a new game, plays through the opening
slice (Mira → cellar → slime battle → thanks → brewing lesson), opens the
inventory/brewing panels, brews a Vigor Draught, and fails if any browser
console error was logged.

## Manual smoke test (`smoke-ending.playwright.mjs`)

Same setup as above. Drives the "called the watch" branch all the way to
its distinct ending (Phase 4) and asserts the ending screen shows the
right text.

```bash
node game-033/tests/smoke-ending.playwright.mjs
```

## Manual smoke test (`smoke-mobile.playwright.mjs`)

Phase 5 (mobile pass). Same setup as above, but boots the page with
Playwright's `devices['iPhone 13']` emulation (390px-wide viewport, touch
enabled) and drives everything with `.tap()` instead of `.click()`:

```bash
node game-033/tests/smoke-mobile.playwright.mjs
```

Checks that: the page never overflows horizontally on a 390px viewport;
every HUD button, battle-menu button, and inventory action button meets a
~40px minimum touch target; the battle canvas scales down to fit the
viewport width; and tapping a modal's dimmed backdrop (the touch-only
equivalent of pressing Escape) closes the inventory and settings panels.
