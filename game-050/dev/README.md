# Tomebound — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-050/dev/simtest.mjs` | 1. Purity: `js/sim/` never imports three.js, touches the DOM, calls `Math.random` or reads the clock. 2. Board: 60 seeded battles of random moves, every spell and every potion; after each action the board must be full with unique ids, no standing match and at least one legal move — **and replaying the event stream onto a mirror (exactly what the 3D view does) must reproduce the board gem for gem**. 3. Determinism: same seed, same battle. 4. Data: every wing map fully reachable on 30 seeds, items finite, books and spells described. 5. Campaign: a bot starts a new game with each class and plays it to the ending — managing the town (idle time simulated: ~8 s per turn plus a 2-hour break every 12 battles), gear, stats, quests, potions, spell ranks and book study — with invariants after every battle and a save/load round-trip at every new wing. `SEEDS=4 CLS=mage` to vary. |
| `BALANCE=1 node game-050/dev/simtest.mjs` | Adds a per-wing table: battles, patrols, loss %, boss tries/losses, turns per battle, HP lost, hero level in→out, game minutes. `BOSSLOG=1` prints every boss fight. |
| `node game-050/dev/duel.mjs` | Class vs. monster probe at fixed levels (bot-allocated stats, a magic item per slot, no books): win %, turns, HP lost, damage per turn. `RANK=guardian LEVELS=1,10,20,30 N=100`. |
| `node game-050/dev/browsertest.mjs` | Real Chromium + WebGL + the genuine three.js r165. Desktop: title → How to Play → create a hero → prologue → build a Lumber Camp on a tapped plot → collect a basket bubble → Hero / Library / Quests → Adventure → wing map → pre-battle → a battle played with real mouse drags and a tap-tap swap, a spell, a win → a Keeper fight with its story, a potion and the returned book → forge, alchemist, mage tower and scriptorium → save, age the save 3 hours, reload, Continue → away summary → every wing's stage renders (not black) → menu. Phones (touch only, CDP input) at 390×844 and 844×390: new game by taps, controls ≥ 44 px and on screen, a battle with a real swipe, HUD clear of the board. Fails on any console error, page error or failed request. Shots in `dev/shots/`. Needs `playwright` (symlink it into `dev/node_modules/` — ESM ignores `NODE_PATH`) and a static server: `python3 -m http.server 8050` from the repo root. `ONLY=desktop` / `ONLY=phones`. |
| `node game-050/dev/probe.mjs [title\|town\|battle] [WxH]` | One screenshot of one screen, for iterating on visuals. `EVAL='js'` prints an expression. |

No network to unpkg.com? Fetch three.js once and the browser scripts serve the CDN
requests from disk — still the genuine r165:

```bash
cd game-050/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) runs at a few frames per second, so the browser test
waits on game state (`__tb.state()`), not on wall-clock time.

## Debug hooks

Load with `?debug=1` for `window.__tb` (also disables the automatic quality downgrade):
`state()`, `newGame(cls, name)`, `skipStory()`, `give({gold…})`, `xp(n)`, `books(n)`,
`fight(ctx)`, `botMove()`, `best()`, `mana(n)`, `win()`, `lose()`, `god()`,
`clearTo(wing, kind)`, `basket(id, n)`, `age(ms)`, `plotScreen(i)`, `cellCenter(x, y)`,
`brightness()`, `quality(q)`, `snap()`.

## Balance notes (bot, 3 seeds × 2 classes)

Every run reaches the ending in roughly 80–125 battles (~6–9 hours of real play),
finishing around level 33–35. The curve came from the bot's tables, not from playing:

- **Linear beats quadratic.** The first monster HP curve (`0.75 L²`) outran the hero's
  damage per turn (4 → 19 from level 1 to 30) and fights stretched to 40+ turns. Monster
  HP and skull damage are now near-linear, and hero damage gets a small per-level term
  (`+0.12 × level` per skull, `+2% × level` spell power).
- **Books, ranks and forged gear compound.** With linear monsters the bot's late fights
  dropped to 3–5 turns, so monsters get a per-wing trim (`WING_HP`, `WING_DMG` in
  `js/sim/monsters.js`) — more HP than damage, so late fights get longer rather than spikier.
- **Spiky damage, not big numbers, killed the Mage.** The Observatory Guardian one-shot the
  Mage in two turns (big skull cascades at 9% of max HP per skull). Late-wing damage
  multipliers were flattened, the Mage starts every fight behind a Mana Ward (20% of max
  HP), and the bot's Mage spends more points on Vitality.
- **Stun-lock.** Quake/Wail could stun twice in a row. After a stun wears off, the victim
  shrugs off stuns for its next two turns (as in game-049).
- **Resistances need a way round.** Fire-resistant bosses walled the fire-heavy Mage until
  the bot (and the HUD) weighed resistances; Starmaw resists Spark instead of Fire.
- **An event with two paid choices soft-locked a run** when the bot had no gold. Every
  event now has a free choice.
- **Training Yard and quests were two thirds of all XP** in the first table; both were cut
  so that battles are about half of a run's XP.
