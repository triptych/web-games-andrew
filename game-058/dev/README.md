# Bumble Basket — dev harnesses

Plain Node scripts. There's no build step and no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-058/dev/simtest.mjs` | Headless checks on the real rules. It confirms `js/sim/` never imports three.js, touches the DOM or calls `Math.random`, and that the level data is consistent: goals only ask for fruit that spawns, obstacles sit on the blanket, and there's one colour per kind before Colour sense. Board invariants are checked after every move of 40 bot games: every cell filled, unique ids, a legal trail always exists, jars and goals in range. Then the trail rules for each sense, including diagonals and word-ladder trails; harvest, gravity and refill; golden fruit; all four power-ups; jars filling and earning charges; leaf piles, frost and frozen fruit staying put; win, stars, out of moves, +5 continue and power-ups after the last move; determinism; hints and dead-board shuffles; Picnic baskets adding kinds. Last comes a **balance gate**: on every level a strong bot must win at least 90% of seeds and a casual one at least 70%. |
| `BALANCE=1 node game-058/dev/simtest.mjs` | Same, with 24 seeds per level and a table of win rate, moves left and 3-star rate for the casual and strong bots. |
| `node game-058/dev/browsertest.mjs` | Real Chromium with WebGL. **Desktop**: the title's self-playing demo, the map, a level card, a trail drawn with the mouse (mid-drag the rope and count bubble must show, and clear on release), then views checked against the sim after gravity and refill. Also: a too-short trail spends nothing, pause and resume, Paint Pollen and Rainbow Wings from their jars, a win with stars then Next, out of moves then +5, the Colour sense card, Picnic and packing up, the album, and settings that persist. **Touch-only phones** at 390×844 and 844×390: taps through the menus, a trail drawn by finger with CDP touch events, a Buzz Bomb used by touch, every HUD element on screen, ≥ 44 px buttons, the blanket clear of the HUD, and finger-sized cells. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. It needs `playwright` and a static server (`python3 -m http.server 8058` from the repo root). `ONLY=desktop` or `ONLY=phones` runs one part. |

No network to unpkg.com? Fetch three.js once and point the browser test at
it. CDN requests are then served from disk, and it's still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-058/dev/browsertest.mjs
```

Software WebGL (SwiftShader) runs this game at a few frames per second. The
browser test finishes animations through a debug hook and checks game state,
rather than waiting on wall-clock time.

## Debug hooks

Load the game with `?debug=1` to get `window.__bb` (add `&seed=N` for
repeatable blankets):

| Hook | Effect |
|---|---|
| `__bb.game` / `__bb.mode` / `__bb.busy` / `__bb.save` | The live sim, the app mode, whether an animation is playing, the save |
| `__bb.start(i)` / `__bb.picnic()` | Jump into level `i` (0-based, skipping the cards) or a Picnic |
| `__bb.best(maxLen, goalWeight)` | A good legal trail from the game's own search |
| `__bb.play(path)` | Play a trail directly (bypasses input) |
| `__bb.cellScreen(r, c)` | Screen position of a cell's fruit, for driving real input |
| `__bb.give(power)` | Charge a jar: `honey`, `paint`, `bomb` or `rainbow` |
| `__bb.win()` / `__bb.setMoves(n)` | Put every goal one fruit short, or set the moves left |
| `__bb.finish()` | Run all pending animations to the end now |
| `__bb.thumb(kind, colour, golden)` | A fruit thumbnail as a data URL |

## Balance notes

Move budgets are tuned against `js/sim/bot.js`. At skill 1 it searches
trails up to 14 long. At skill 0.4 it stops at 8 and adds noise, which stands
in for a casual player. With the shipped budgets the casual bot wins about 90%
of seeds or more on most levels and finishes with 35–50% of its moves left.
That's why the star thresholds are high (★★ at 20% left, ★★★ at 40%).
Golden-fruit goals need a trail of seven, so a player has to look for long
trails on those levels.

More senses make linking easier: a blanket with all four senses has about a
60% chance that two neighbours link. Later gardens make up for it with more
variety, bigger goals and obstacles rather than fewer moves.
