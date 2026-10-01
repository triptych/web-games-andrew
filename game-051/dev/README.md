# Sigilborn — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-051/dev/simtest.mjs` | Checks that `js/sim/`, `js/data/` and `js/core/` never import three.js, touch the DOM or call `Math.random`; generates 3,000 heroes (names, skills, looks, stats finite, all races/classes appear, ~2 % Radiants, generation deterministic, power rises with every star and a fresh evolve keeps most of it); 20,000 Mystic pulls (hard pity never exceeded, effective 5★ rate with soft pity, never 1–2★) plus Common odds and the ten-pull 4★ floor; 2,000 Sigilstones enhanced toward +15 (no duplicate substats, finite values); battles across the campaign, Spire, Arena and every Rift tier (every event number finite, HP in range, every battle ends, same seed → same battle); then the idle systems (Treasury accrue/collect, mining down a layer, plant/water/harvest, an expedition, quests, shop, wheel) and a save round-trip plus migration of an old save. |
| `BOT=1 DAYS=21 node game-051/dev/simtest.mjs` | Adds a progression bot that plays N days, four sessions a day: collects, farms, mines, summons, levels, evolves (fodder from weaker heroes), equips and enhances, spends talents, upgrades buildings, pushes the campaign, climbs the Spire, runs Rifts and the Arena, sends expeditions, claims quests. Prints stage, Spire floor, Overlord level and the top five heroes per day. `SEED=` and `SESSIONS=` change the run; `TRACE=1` prints each phase. |
| `node game-051/dev/browsertest.mjs` | Real Chromium + WebGL + three.js r165. Desktop: title → Begin → character creator (randomize, hair, weapon, name) → intro → citadel → Mystic summon with reveal → campaign 1-1 on auto at 3× → results → a manual battle (skill + target tap) → elixir level-up and auto-equip → a mine strike by tapping the rock face → planting a crop by tapping a plot → a wheel spin → crafting → sending an expedition → claiming a main quest → every 3D stage renders non-black → save, reload, Continue. Phones (touch only) at 390×844 and 844×390: every visible button ≥ 40 px tall and on screen on ten main screens, the tab bar by tap, and a full battle. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. |
| `node game-051/dev/smoke.mjs` | Visits every screen on a phone and a desktop viewport and screenshots it (`ONLY=mine,farm` / `SIZES='[[390,844,"phone"]]'` to narrow). |
| `node game-051/dev/shots.mjs "<page>" out.png [w] [h]` | One screenshot of any page in the game folder; `EVAL='…'` runs code first (with `?debug=1`, `window.__sb` has the hooks below). `dev/viewer.html?mode=heroes|monsters&seed=N` renders a grid of generated heroes or monsters. |
| `node game-051/dev/contact.mjs out.png cols width a.png b.png …` | Tiles screenshots into one contact sheet. |

Browser scripts need `playwright` and a static server (`python3 -m http.server 8050` from the repo root).
If `import 'playwright'` fails because it is installed globally, link it: `mkdir -p game-051/dev/node_modules && ln -s "$(npm root -g)/playwright" game-051/dev/node_modules/playwright`.

No network to unpkg.com? Fetch three.js once and the browser scripts serve the CDN
requests from disk — still the genuine r165:

```bash
cd game-051/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) renders at a few frames per second, so the browser
test waits on game state rather than wall-clock time.

## Balance notes (bot, seed 2026, four sessions a day)

The curve came from the bot, not from hand play:

- Enemies sit on a single **power ladder** of every (star, level) pair, 1★ L1 … 6★ L40. Campaign stage *i* is rung `1 + 2.5·i`; Spire floor *f* is rung `4 + 1.7·(f−1)`, then ×1.05 per floor past 100. A `curveDiff` multiplier stands in for the gear, talents and buffs a player has by then (steep for the first 20 stages, gentle after).
- With a linear 2.25-rung slope the bot cleared the whole of region 4 on day 2; with 2.5 and the late-game softening it reads: region 3 on day 1, region 4 by day 3, a plateau at region 6 while it builds 5★s and gear, a first 6★ around day 19, region 8 by day 21.
- 5★ → 6★ needed five 5★ fodder and stalled the bot for good; evolution fodder is now `[1, 2, 3, 3, 4]` by star.
- First-clear gems were halved (10 / 60 for bosses) after the bot's first day ended with four ten-pulls.

## Debug hooks

Load the game with `?debug=1` to get `window.__sb`:

| Hook | Effect |
|---|---|
| `__sb.G.S` | The live save |
| `__sb.go(id, params)` / `__sb.current()` | Navigate / current screen id |
| `__sb.newGame()` | Fresh save (two starter heroes) |
| `__sb.summon(S, sigil, n)` | Summon without the reveal |
| `__sb.grant(bundle)` / `__sb.grantGear(n, tier)` | Give resources / random Sigilstones |
| `__sb.skip(mins)` | Move the clock forward (idle systems) |
| `__sb.brightness()` | Mean brightness of the current 3D stage |
| `__sb.mineCellScreen(r, c)` / `__sb.farmPlotScreen(i)` | Screen position of a mine block / farm plot |
| `__sb.setQuality(q)` | Force a quality tier (0 high, 1 medium, 2 low, `null` auto) |
