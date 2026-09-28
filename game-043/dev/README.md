# GLIMMERGLEN — dev harnesses

Plain Node scripts, no build step, no test framework. Run from `game-043/`.

| Command | What it does |
|---|---|
| `node dev/simtest.mjs` | The real simulation in Node (180 checks): determinism; the prologue played with the A button (clearing, tilling, planting, watering, the Job Board); crops growing and seasons; lots, building, move-ins, the Carpenter's discount, the Storehouse, talking and gifts; crafting, placing and running a furnace, cooking, shops, the shipping bin, tag-ingredient allocation; the job board (take, turn in, assign a villager, morning resolution); combat (a bot winning, guarding a telegraphed hit, no fleeing bosses, fainting, items, overworld encounters, first strike); companions; every dungeon/cave floor connected; **a bot playing the whole main quest** — five village levels, five gates (each blocked without its relic and opened with it), five dungeons, five bosses with plausible level/gear, five shards — to the festival and the post-game; glimmers and gates; animals and the greenhouse; a villager story; save/load round trip; fifty simulated days |
| `node dev/gentest.mjs [seeds]` | The world generator's contract (default 24 seeds; 80 seeds = 7,320 checks): deterministic; 18 lots; a dungeon and cave per region; with *k* relics exactly regions 1…*k*+1 are reachable; every site, glimmer, forage spot and lot sign reachable with every relic; every secret pocket shut without its own relic; roads clear; floors connected |
| `node dev/balance.mjs` | Win rate / HP left / rounds for a player of each chapter's expected level and gear against 1–3 monsters of each region (60 fights per row) |
| `node dev/ascii.mjs <seed> [step]` | Prints the overworld as text (`&` thicket, `X` thorns, `O` boulders, `-` shallows, `@` dark hollow, `*` glimmer, `D`/`C` dungeon/cave, `L` lot sign). `node dev/ascii.mjs <seed> floor d1 3` prints a dungeon floor |
| `node dev/mobiletest.mjs` | An emulated phone (touch, dpr 3) driven **only** by CDP touch: title → creator → letter → the Glen; every control ≥44 css px, on screen, not overlapping; whole-number canvas scaling; the floating joystick walks; A talks to the Mayor, pulls a weed, rebuilds the Job Board; hotbar taps; menu tabs, map, board; a battle won with the Attack button; save to a slot, reload, Continue. `LANDSCAPE=1` for 844×390 (51 checks each) |
| `node dev/flowtest.mjs` | Desktop, keyboard and mouse: the creator's name/seed, WASD/1–8/I/Esc/M, sleeping from the cabin door → morning report and autosave, a lot sign → build → move-in, the Mayor's village celebration, a dungeon boss → shard → Heartwood, music moods (glen/dungeon/boss), the festival cutscene, post-game |
| `node dev/shots.mjs` | Screenshots of title, creator, letter, the Glen, bag, map, battle, night and a dungeon at 390×844, 844×390 and 1280×800 into `dev/shots/` (git-ignored); fails on any console error |
| `node dev/tour.mjs [WxH]` | Screenshots of states that take hours to reach: a fully grown village by day, night, winter and rain; every biome; a dungeon door, a secret pocket, a cave, a boss floor and battle; every panel (forge, upgrades, stations, cooking, crafting, board, barn, build, village, map, gift, shipping, storehouse, greenhouse, fairy rings, chests, journal…); the festival |
| `node dev/sprites.mjs heart\|people\|monsters\|items\|buildings\|objects` | A sheet of every sprite a painter makes |
| `node dev/perf.mjs` | Frame time and `draw()` cost at phone and desktop sizes |

The browser scripts need Playwright and a static server for the **repo root**:

```bash
python3 -m http.server 8043      # from the repo root; BASE defaults to http://127.0.0.1:8043
```

If Playwright is installed globally rather than in this folder, link it: `ln -s "$(npm root -g)" node_modules` (git-ignored). `PW_CHROMIUM_PATH` overrides the browser binary.

## Bugs these caught

- **A region that could never be entered**: roads carved across natural shallows kept them as shallow water, which you can only cross with the Lilypad Charm — found inside that very region. Roads now bridge natural shallows; only gate and pocket tiles (tracked in a mask) stay as obstacles.
- **A region sign placed on the only bridge**, after the road was carved, sealing the region off; the same for a cave facade landing on the dungeon road, and a fairy ring landing on a road (awake glimmers are solid).
- **A cave inside a ring of interior cliffs** with no road in; roads may now cut passes through interior (never border) cliffs.
- **Facing your own tile**: the facing point was a continuous offset, so standing near the bottom of a tile and pressing A at a door did nothing. Facing is now the tile beside yours.
- **An unwinnable first boss**: a plant minion healed the boss for 30% of the *boss's* max HP every other turn. Heals are capped by the healer's own size.
- **Level 1 lost 95% of fights against a pair of monsters**, which region 1 spawns constantly; monster HP grew quadratically, so late triple groups were brutal. Curves flattened; group size now scales with your level.
- **Glim floats in front of the Heartwood**, so pressing A there talked to Glim instead of returning the shard. Talking to Glim with a shard returns it.
- The dialog typewriter's timer outlived a closed dialog and crashed on the next tick; battle playback could run after the battle view was torn down.
- `Pix.get` didn't floor its coordinates, so every "only on the canopy" sparkle and blossom silently failed.
- Seven lots in one seed in 60 didn't fit; lot fitting now relaxes the Glen's margin before giving up.
