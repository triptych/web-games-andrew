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

`phase6.test.js` covers the long-season layer specifically: coin and the day
counter, quests and lore, recipe knowledge gating, trade pricing, the expanded
`requires`/effects vocabulary (`minStat`/`minCoin`/`minDay`/`questActive`/
`noneFlags`/`notItem`/`visited`), and the integrity properties that matter once
the graph has hubs in it — no orphans, no dead ends, all thirteen endings
reachable and terminal, no re-enterable hub granting items/coin/XP on entry
(which would be farmable), every quest/lore/recipe id referenced by the story
actually defined, and the three "can this run be locked out?" invariants: the
watch branch rejoins the main plot, each ward component has an ungated route,
and losing the cellar slime can't strand you without the key.

`state.js` reads/writes `localStorage` for save/load; the test files shim
a minimal in-memory `localStorage` on `globalThis` before importing it,
since Node has no global `localStorage`.

### Running the Playwright drivers in a sandbox

All the drivers below call `chromium.launch()`. If the environment already has a
Chromium that doesn't match the build Playwright wants to download, point
`PW_CHROMIUM_PATH` at the binary and they'll use it instead:

```bash
PW_CHROMIUM_PATH=/path/to/chrome node game-033/tests/smoke.playwright.mjs
```

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

## Manual smoke test (`smoke-season.playwright.mjs`)

Phase 6 (the long season). Same setup as above. Drives the real page through
the new systems end to end and fails on any console error or failed assertion:

```bash
node game-033/tests/smoke-season.playwright.mjs
```

Checks that: the HUD shows the day and the purse; the Journal and Trade buttons
stay hidden until they're earned; the Cellar Key opens the workroom and the
journal found there unlocks the Journal panel (with a live quest, a settled
quest, and a lore entry in it) and teaches the Burn Salve recipe; untaught
recipes stay off the brewing list; brewing an order and handing it over at the
counter pays coin; sleeping advances the day; and Peddler Ock's cart buys, sells,
and closes again when you walk away from it.
