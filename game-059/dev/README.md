# Sister Circuit — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-059/dev/simtest.mjs` | Plays every stage headlessly with the bot (`js/sim/bot.js`), in Node. Fails on an exception, a NaN position, or a stage that doesn't reach its clear within the time budget (continues are counted, as a player would use them). `DIFF=easy\|normal\|hard`, `STAGES=0,3`, `SEEDS=3`. `MODE=bossrush` plays all seven bosses back to back; `MODE=survival` plays to wave 8. |
| `node game-059/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: boot, title and attract demo, Story → prologue → stage card → dialogue → a keyboard fight (chain, special, jump kick) through the first locked wave → pause, move list, settings → stage clear → results → safehouse purchase → stage 2 → boss dialogue, WARNING card and boss bar → death → CONTINUE? → GAME OVER → title. Then every stage and its boss, Boss Rush and Survival. Then touch-only phones at 390×844 and 844×390: the stick walks Juno, ATK attacks, pause by tap, 44 px targets on screen, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|flows\|phones`. Screenshots in `dev/shots/`. |
| `node game-059/dev/spritesheet.mjs [juno,punk]` | Bakes characters in Node and writes PNG sheets plus side portraits. |
| `node game-059/dev/strip.mjs juno idle,kick` / `ANIMS=walk,run node … strip.mjs juno x` | A few frames of one character, big. |
| `node game-059/dev/cast.mjs idle,slam,hurt` | One row per character (`KEYS=` to choose). |
| `node game-059/dev/portraits.mjs` | Every dialogue portrait in one sheet. |
| `node game-059/dev/objects.mjs` | The prop / item / FX atlas. |
| `node game-059/dev/shot.mjs "stage=2&x=3100&t=6" name` | Screenshots `dev/viewtest.html`: the view with the bot playing, warped to an x position and sim time. |
| `node game-059/dev/play.mjs name "js run after boot" [wait] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots. |

The browser scripts need `playwright` and a static server on port 8059:

```bash
python3 -m http.server 8059          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-059/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

## Debug hooks (`?debug=1`)

`window.__sc`: `mode`, `world`, `session`, `ui`, `view`, `start(mode, difficulty, stage, character)`, `god(on)`, `killAll()`, `warp(x)`, `skipDialog()`, `clearStage()`.
