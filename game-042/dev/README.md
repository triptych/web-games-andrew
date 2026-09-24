# POPGUN PIP — dev harnesses

Plain Node scripts, no build step, no test framework. Run from `game-042/`.

| Command | What it does |
|---|---|
| `node dev/gentest.mjs [seeds]` | The generator's contract over *seeds* × 25 levels (default 6): exit and non-gated shards reachable with the world's baseline gadgets; every gated pocket unreachable **without** its gadget and reachable **with** all of them; no enemy spawned in terrain; generation cost. `node dev/gentest.mjs 10` = 3,423 checks over 250 levels |
| `node dev/ascii.mjs <seed> <world> <index> [gadgets\|base] [x0] [x1]` | Prints a level as text with the cells reachable for a gadget set (`.`), shards (`0 1 2`), vaults (`V`) — the fastest way to see *why* a gate leaks |
| `node dev/simtest.mjs` | The real simulation in Node: jump heights, short hops, double jump; stomp, snail shells, Pricklepuff, frost freezing enemies into platforms; ? blocks, bricks, hidden blocks; rockets clearing red rock, frost freezing a bubble stair and it melting, ground-pounding through a cracked floor; pits costing a heart, dying; flagpole → castle → clear on real levels; bounded events; determinism; a shooting bot beating all five bosses; the music composer |
| `node dev/mobiletest.mjs` | An emulated phone (touch, `isMobile`, dpr 3) driven **only** by CDP touch: title → NEW GAME → map → level; D-pad walks, A jumps with the D-pad still held, B autofires; pause / RESUME / EXIT; every control ≥44 css px, on screen, not overlapping, and below the game view in portrait; the canvas is an integer multiple of device pixels. `LANDSCAPE=1` for 844×390 |
| `node dev/flowtest.mjs` | The screen state machine in Chromium: clear a level → map walks on; vault item → gadget panel → resume; boss → gadget → World 2; lose every life → GAME OVER → map with progress kept; the save survives a reload |
| `node dev/shots.mjs` | Screenshots of title, map, a level of every theme, a boss arena and pause at 390×844, 844×390 and 1280×800 into `dev/shots/` (git-ignored); fails on any console error |

The browser scripts need Playwright and a static server for the **repo root**:

```bash
python3 -m http.server 8042      # from the repo root; BASE defaults to http://127.0.0.1:8042
```

If Playwright is installed globally rather than in this folder, link it: `ln -s "$(npm root -g)" node_modules` (git-ignored).

## Bugs these caught

- A shaft room's ceiling had a gap over the chimney mouth, so Spring Boots could drop in from above — the Sticky Mitts gate leaked.
- The red-rock bunker was five tiles tall, one more than a single jump, and blocked a World 1 route.
- The validator's wall-climb program kicked off the shaft room's walls forever and never landed there.
- A stomped snail shell was kicked by the same stomp one frame later.
- The flagpole only triggered when Pip touched the thin pole in mid-air; walking into its base block did nothing.
- Bottomless pits drew the backdrop's hill colour and read as solid ground.
