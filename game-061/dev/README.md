# STARWRIGHT — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-061/dev/simtest.mjs` | Headless tests of the pure simulation (about 25 s). Purity: `js/sim` never imports three, touches the DOM or calls `Math.random`. Determinism: the same seed gives byte-identical galaxies, systems and mission boards, case- and whitespace-insensitive. Galaxy rules on 50 seeds: four Warp-I neighbours with a station, everything reachable at Warp III, the core only at Warp V, home belts and stations present, shard 1 ≤ 3 Warp-I jumps, the warlord's haven ≤ 8 Warp-II jumps. 2 700+ generated missions all point at things that exist. The economy can't be pumped by buy→sell cycling, and dumped prices recover. A flight bot undocks, cruises to the belt, mines a full hold, cruises home around the star, docks and unloads. A combat bot survives ten sim-minutes of ambushes in a danger-3 system. A **macro bot** plays the whole progression through the real `Game` actions to the ending. `ONLY=purity,determinism,galaxy,quests,economy,flight,combat,macro`, `SEEDS=50`, `MACRO_SEEDS=MACRO-2,MACRO-3`, `VERBOSE=1`. |
| `node game-061/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). Desktop: title → NEW VOYAGE with a typed seed → LAUNCH → build a Refinery from the BUILD tab → shipyard showcase → UNDOCK → W throttle, mouse steering, T targets → mine with Q → dock at Hearth with E, UNLOAD ALL → dock at the Waypost, SELL ALL RAW, accept a mission → galaxy map, ENGAGE WARP → pause, settings, resume → die and wake at Hearth → SAVE & QUIT, reload, CONTINUE. Then touch-only phones at 390×844 and 844×390: real CDP touches through the menus, controls ≥ 44 px and not covering HUD readouts, relative stick steers, throttle rail, FIRE, ❚❚, the map, no sideways scroll, canvas not clipped. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-061/dev/play.mjs name "js;;js;;SHOT:x;;js" [waitMs] [w h] [touch] [query]` | Opens the real game with `?debug=1`, runs snippets (`S` = `window.__sw`) with a pause between them, takes `SHOT:` screenshots along the way and a final one. |
| `node game-061/dev/persist.mjs` | Die → respawn → save & quit → reload → continue. |

The browser scripts need `playwright` and a static server on port 8061:

```bash
python3 -m http.server 8061          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-061/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders at a few frames a second, so the browser test teleports the ship next to things instead of flying every leg; flight itself is covered by the sim bots.

## The macro bot

`dev/macrobot.mjs` plays through the real game actions (build, refine, research, upgrade, trade, missions, warp, story) and replaces flight with time costs derived from ship stats (cruise legs, mining rate × a 60% aiming/heat duty cycle, 55 s per jump). It follows a fixed upgrade plan and makes clumsy choices: it wanders between systems, waits on the refinery, and never sells when Hearth's storage fills. It is a progression proof and a pacing probe, not a model of a good player. On the two regression seeds it reaches the warp drive at about 41–43 minutes and the ending at 15–18 bot-hours. Two other seeds stall in the late game because of those bot limitations. Its first runs found real design problems:

- the refinery ate every unit of raw ore, so builds that cost ore never became affordable (now there's a reserve and a per-recipe stock cap)
- the Level 1 refinery ran one recipe at a time (now every enabled recipe runs a batch each cycle)
- "befriend two species" was impossible before Warp II (the chapter now uses your Waypost's species)
- shard sites and the warlord's haven could be out of reach (the generator now guarantees them)
- titanium was about 5% of the home belt's ore
- Shipyard Lv 5 needed Command Core Lv 8

## Debug hooks (`?debug=1`)

`window.__sw`: `game`, `world`, `mode`, `app`, `view`, `hud`, `menus`, `maps`, `input`, `give(item, n)` (hold), `store(item, n)` (Hearth), `credits(n)`, `god(on)`, `tp(id)`, `warpTo(systemId)`, `snap()` (camera), `hash`. `?seed=TEXT` starts a voyage in that universe; `?fast=N` runs N× simulation per frame.
