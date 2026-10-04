# Hivebreaker — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-057/dev/simtest.mjs` | Headless checks on the real simulation: `js/sim/` never imports three.js, touches the DOM or calls `Math.random`; 200 sectors (40 seeds × 5) generate with every room role, every free floor tile reachable, vents in every combat room, clear doorways, no overlapping rooms and three data logs; 40 escape routes (pad reachable, three holdouts) and horde arenas; same seed and inputs → same world; two minutes of tick invariants per sector (finite numbers, nothing inside walls, HP ≤ max, no negative ammo or salvage); every weapon at Mk I and Mk III damages and kills; every bug acts and dies; every boss spawns, uses its patterns, changes phase, dies and opens the way on; a save round-trip; and bot campaigns (a perfect bot and a fallible one) through all five sectors and the escape. |
| `BALANCE=1 node game-057/dev/simtest.mjs` | The campaign over four seeds for a perfect bot on Marine and Nightmare and a fallible one (skill 0.6) on Recruit and Marine, with a per-sector table of deaths, time, kills, damage taken, salvage and loadout. |
| `node game-057/dev/browsertest.mjs` | Real Chromium + WebGL: title with its attract demo → New Operation → difficulty → intro → sector card → move (WASD), aim and fire (mouse), roll, grenade, pulse, swap → a sealed room clears → Supply Depot purchase → a data log → pause, map, settings, controls → a boss → field upgrade → elevator → Sector II with the loadout saved → death, SIGNAL LOST, retry → codex. Then sectors III–V, the Brood Mother, cutting Ellie free, the escape, the dropship and the ending, and Horde Mode. Then touch-only phones at 390×844 and 844×390: both sticks, ROLL, grenade, tapping the weapon panel, USE at a terminal, every HUD panel on screen and 44 px tap targets. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8057` from the repo root). `ONLY=desktop|flows|phones` runs one part. |

No network to unpkg.com? Fetch three.js once and point the browser test at it —
CDN requests are then served from disk, still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-057/dev/browsertest.mjs
```

Software WebGL (SwiftShader) renders this game at a few frames per second, so
the browser test steps the simulation through debug hooks and checks game
state rather than waiting on wall-clock time.

## Debug hooks

Load the game with `?debug=1` to get `window.__hb`:

| Hook | Effect |
|---|---|
| `__hb.world` / `__hb.mode` / `__hb.G` / `__hb.meta()` | The live world, the app mode, all app state, the save |
| `__hb.advance(sec, input?)` | Step the simulation synchronously (events reach the view, sound and HUD as usual) |
| `__hb.bot(sec)` | Let the auto-player drive for a while, then snap the camera |
| `__hb.toSector(n)` | Start a campaign at sector `n` (5 = the escape) with a mid-game loadout |
| `__hb.toRoom(type)` / `__hb.toBoss()` | Teleport into the first unvisited room of a type, or the boss arena |
| `__hb.god(on)` / `__hb.killAll()` / `__hb.give(id, mk)` | Invulnerability, clear the bugs, add a gun |
| `__hb.screen(x, y, h)` / `__hb.snapCam()` / `__hb.skipCard()` | World → screen position, recentre the camera, dismiss a sector card |

## Balance notes

Difficulty is tuned against `js/sim/bot.js`. At skill 1 it sees every bullet
and aims true; lower skills miss a share of incoming bullets, react late and
aim loosely. On Marine the perfect bot clears the campaign without dying; a
skill-0.4 bot (closer to a first-time player) dies a few times, mostly in
the Reactor Core and the Hive; on Nightmare even the 0.6 bot needs many
attempts at the Brood Mother. Recruit adds 40% health and softens damage
and bullet speed for anyone who wants the story.

Two generation rules keep the swarm moving: props keep either no gap or a
two-tile gap to walls and to each other (a one-tile or diagonal gap pins the
bigger bugs), and a bug that ends up outside its sealed room crawls back in
through a vent.
