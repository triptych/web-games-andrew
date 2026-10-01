# Lanterndeep — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-049/dev/simtest.mjs` | Checks that `js/sim/` never imports three.js, touches the DOM or calls `Math.random`; generates floors 1–100 on three seeds each and checks the stairs are reachable; then a bot plays a full 100-floor run with each hero (Lantern mode, rekindling on death). Every turn: no NaN, the hero on walkable ground, no monster inside a wall, no floor taking more than 6,000 turns. Every floor start: a save/load round-trip must reproduce the run byte for byte. Finally, determinism: same seed → same run. `SEEDS=4` for more runs, `FLOORS=30` to stop early, `CLS=witch` / `FROM=3` to pick runs. |
| `BALANCE=1 node game-049/dev/simtest.mjs` | Adds a per-world table: deaths, floors, turns per floor, average hero level, lowest HP %, potions drunk per floor, and the most HP lost to the Warden. `DEATHS=1` prints every death (floor and killer); `DUMP=1` prints the map of any floor the bot got stuck on. |
| `node game-049/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: title (attract demo) → How to Play → hero select → prologue → keyboard play, auto-explore, tap-to-travel, pack / journal / map / pause, a targeted skill, a level-up perk, a Warden fight and its stairs, death and Rekindle, save + reload + Continue, all ten worlds and ten arenas (must not render black), and the ending choice. Phones (touch only) at 390×844 and 844×390: every control ≥ 44 px, on screen and clear of the HUD; real CDP touch on a tile moves the hero. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8049` from the repo root). |

No network to unpkg.com? Fetch three.js once and the browser test serves the
CDN requests from disk — still the genuine r165:

```bash
cd game-049/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) renders at a few frames per second, so the browser
test waits on game state rather than wall-clock time.

## Balance notes (bot, 4 seeds × 3 heroes, Lantern mode)

All twelve runs reach the ending; 0–7 rekindles per run. Per world the bot's
lowest HP sits around 40–75% and it drinks 0.6–2.3 potions a floor; Wardens take
30–100% of its health. The curve came from these runs, not from playing:

- A linear damage curve made worlds 1–7 trivial and 8–10 a wall. Monster damage
  now has a per-world trim (`WORLD_DMG` in `js/sim/monsters.js`) and HP a gentle
  quadratic.
- Frostveil's freeze-locks killed the same hero twenty times: after a freeze or
  stun wears off the hero is immune for three turns.
- The Hush's shades were full floor-100 monsters: a Warden's summons now have
  55% health and 70% damage, and the Hush keeps at most three.
- The Grotto Toad's telegraphed charge was the top killer in world 2 and was trimmed.

## Debug hooks

Load the game with `?debug=1` to get `window.__ld` (it also disables the automatic quality downgrade):

| Hook | Effect |
|---|---|
| `__ld.run` / `__ld.G` | The live run and the controller |
| `__ld.start(cls, mode, seed)` | Start a run (`warden`/`ranger`/`witch`, `lantern`/`ironwick`) |
| `__ld.toFloor(n)` | Jump to floor `n` (1–100) |
| `__ld.god(on)` | The hero takes no damage |
| `__ld.killAll()` / `__ld.killBoss()` | Clear the floor / fell the Warden |
| `__ld.spawnNear(species, d)` | Spawn an awake monster in sight |
| `__ld.xp(n)` / `__ld.hurt(n)` | Grant experience / deal damage |
| `__ld.reveal()` | Mark the whole floor as seen |
| `__ld.step()` | Let the bot take one action |
| `__ld.brightness()` | Mean brightness of a freshly rendered frame |
| `__ld.quality(q)` | Force a quality tier (0 high, 1 medium, 2 low) |
