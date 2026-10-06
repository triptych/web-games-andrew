# Worldroot — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-065/dev/simtest.mjs` | 1. **Purity**: `js/sim/` never imports three.js, touches the DOM, calls `Math.random` or reads the clock. 2. **Data**: unique ids, every upgrade and heartwood level has text and a price, tree costs only rise. 3. **Shop maths**: bulk cost equals the sum of single costs, "max" never overspends and leaves the next one unaffordable. 4. **Offline**: `offline(1h)` at 100% matches ticking an hour; the 8 h cap and 50% base apply; keepers and the gardener keep buying while away; one summary event and nothing else. 5. **Save/determinism**: same seed, same game; a JSON round trip mid-game plays on identically; older saves are filled in, bad ones rejected. 6. **Pacing**: active and casual bots play 48 hours and an idle bot 72, with invariants every minute (finite, non-negative motes, sap in range, integer spirit counts…) and windows for Sprout, Sapling, first rebirth and the World Tree; every trial completed, four realms; every wisp gift and spell happens; trials really restrict. 7. **The wilds**: kinship grows (offline too) and multiplies its spirit; one party at a time, no early return, an odyssey comes home while away; every relic and set findable, duplicates pay amber; one herb per bed, ripe before harvest, ~6% glimmering; whispers claim and reroll; Mab's stall; the wick never stretches spells; feats pay amber and never count toward Radiance; gold badges open titles; a save from before the wilds loads and plays on. The bots tend the wilds during the pacing runs. |
| `node game-065/dev/pace.mjs` | The balance table: when each stage, rebirth, trial and realm happens. `PROFILE=active\|casual\|idle`, `HOURS=n`, `SEED=n`. |
| `node game-065/dev/browsertest.mjs` | Real Chromium + WebGL + the genuine three.js r165. **Desktop**: title, help, 12 real clicks on the seed, buy a Firefly, Nourish, an upgrade, a stage-up and its lore banner, catch a golden wisp by clicking it, cast Verdant Surge, rebirth through the dialog, buy heartwood, begin and leave a trial, bind a realm, the Wilds (claim a whisper, send a party and welcome it home, plant and harvest, buy a bed and a spark colour), journal awards, feats, badges (wear a title), codex, stats, lore, settings, export. **Offline**: a fresh page whose save is two hours old shows "While you were away" with motes gained. **Phones** (touch only, CDP input, 390×844 and 844×390): start, tap the seed, buy, nourish, every tab by touch, plant a herb in the Wilds by touch, controls finger-sized and on screen, nothing covering tap points, no sideways scroll, catch a wisp by touch. Fails on any console error, page error or failed request. `ONLY=desktop\|offline\|phones`; `NOSTORAGE=1` makes `localStorage` throw. Screenshots in `dev/shots/`. |
| `node game-065/dev/shot.mjs "<page>" name [WxH] [frames]` | One screenshot, for iterating on visuals. `PRE='js'` runs before the page loads (e.g. seed `localStorage`), `EVAL='js'` after. |
| `dev/view.html?g=<level>&s=<season>` | Just the clearing and the tree at any growth level and season, for working on the tree. |
| `dev/creature.html?c=<model>&yaw=<rad>&pose=walk\|stop&t=<s>` | Any model close up in the game's night lighting: `fox`, `treant`, `stag`, `dryad`, `well`, `stone`, `cap`, `crystal`, `island`. `n=<count>` puts a few foxes in a row. |

The browser scripts need `playwright` (symlink it in: ESM ignores `NODE_PATH`) and a static server from the repo root:

```bash
mkdir -p game-065/dev/node_modules && ln -s "$(npm root -g)/playwright" game-065/dev/node_modules/playwright
python3 -m http.server 8065
```

No network to unpkg.com? Fetch three.js once and the scripts serve the CDN requests from disk (still the genuine r165):

```bash
cd game-065/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) runs at a few frames per second, so the tests wait on game state, not on the clock. In `?debug=1` the
frame-time cap is 250 ms.

## Debug hooks

Load with `?debug=1` for `window.__wr`:
`state()` (started, motes, motes/s, tree, stage, spirits, upgrades, wisp, rebirths, heartwood, realms, trial, frames, quality, growth, modal, tab, clicks),
`give(n)`, `tree(level)`, `gens([...])`, `wisp()`, `wispScreen()`, `treeScreen(frac)` (client coordinates for real clicks),
`offline(seconds)`, `speed(n)`, `autoplay(on)` (the balance bot plays in the browser), `season(i)`, `save()`, `snap()`, `closeModal()`,
`brightness()`, `debugCam()`, `bursts()` (spark pool health), `foxScreens()` / `screens(kind, lift)` (where each creature is on screen), `creatureCost()` (draw objects and triangles per creature). `state()` also reports `calls` and `tris` for the last frame. `?q=0|1|2` forces a quality tier.
