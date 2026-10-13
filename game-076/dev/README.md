# TALEWRIGHT — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-076/dev/simtest.mjs` | The runtime in Node, no browser: the runtime files are loaded into a `vm` sandbox with a fake canvas. **purity** (every runtime file registers in `TW_MODULES`, has no `import`/`export` and never contains a closing script tag, so it can be inlined into an export); **assets** (every tile frame of every tileset, every sprite preset and face, every object, all 19 monster families × 3 sizes × 8 palettes, every icon and song); **schema** (`validate()` is idempotent on the sample, rejects junk, clamps hostile sizes, tiles, positions, text, stats and party, drops unknown commands, no prototype pollution); **rules** (switches, variable maths, random ranges, gold, items, text codes, choices and their branches, conditional branches, party, EXP and level-ups with learned skills, transfers, battles won, lost-and-continued and lost-to-game-over, The End, chest pages flipped by a self switch, save/load, the autorun loop guard, shops, equipment, damage maths, the EXP curve); **sample** (every event in the sample game can be reached on foot); **meta** (every one of the 38 quests and 40 trophies can be earned and none is earned on a blank project; every chapter has quests and scenes; every command's feature is granted by a chapter); **play** (a god-mode bot plays *The Lantern of Fernhollow* from the title screen to The End through the real interpreter: the intro, the Elder's choice, the gated road, Pip joining, chests, the lever puzzle, the boss, the homecoming); **balance** (a mortal bot that heals when hurt plays it three times and prints how it went). `ONLY=purity,assets,schema,rules,sample,meta,play,balance`. |
| `node game-076/dev/browsertest.mjs` | Real Chromium. **story**: the first-run choice, the prologue, painting through the real palette and map, undo/redo, the start flag, a playtest, Chapter 0 finishing (its scene, the restored-tools card, Chapter 1), an event made entirely through the UI (double-click, graphic picker, Insert ▸ Show Text) and a playtest that talks to it. **sample**: Free Mode, the sample game, every big dialog (Database and all its tabs, Forge, Export, Trophy Case, Emporium, Journal, Settings), buying a theme, a branching event in the editor, a full playtest (intro, menu, battle, shop). **export**: the Export dialog's three downloads; the standalone HTML opened *by itself from `file://`* in a fresh browser and played to the first map; the runtime player opening the project file; Import. **phone**: a touch-only 390×844 phone (no sideways scroll, drawers, tap painting, on-screen controls that move the hero, ≥ 44 px). **storage**: `localStorage` blocked. Fails on any console error, page error or failed request. `ONLY=story,sample,export,phone,storage`. Screenshots in `dev/shots/`. |
| `node game-076/dev/edshot.mjs name "js" [waitMs] [w h] [touch]` | Opens the editor with fresh storage, runs a snippet after boot, screenshots `dev/shots/name.png`. |
| `node game-076/dev/play.mjs name "js" [waitMs] [w h] [query]` | Opens `dev/runtime.html` (the sample game in the bare runtime; `?at=map,x,y` starts there), runs a snippet, screenshots. |
| `game-076/dev/assets.html` + `node game-076/dev/shot.mjs game-076/dev/assets.html out.png` | A sheet of every generated tile, sprite, object, monster and icon (`?only=tiles|chars|objs|mons|icons&z=3`). |

The browser scripts need `playwright` and a static server on port 8076:

```bash
python3 -m http.server 8076          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-076/dev/node_modules
```

## Debug hooks

The editor exposes `window.__tal`: `TW` (the runtime), `store` (the open project, undo, the library), `meta` (the Atelier save: chapter, quests, Ink…), `atelier`, `view()` (the map view), `curMap()`, `openMap(id)`, `setTool(id)`, `setLayer(n)`, `startPlaytest({ at })`, `openSample()`, `newEvent(map, x, y, template)`, `buildStandalone(project)`, `buildPlayer()`, `bus`.

A running playtest is `window.__twGame` (a `TW.Game`): `scene`, `state` (party, items, switches…), `map` (the map scene and its events), `ui`, `battle`, `startBattle(troop)`, `shop(goods)`, `openMenu()`, `save(slot)`, `load(slot)`. An exported game is `window.TW.game`.
