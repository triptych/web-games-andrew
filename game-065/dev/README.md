# Scrapwright — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-065/dev/simtest.mjs` | Headless tests of the pure simulation. **Purity:** `js/sim` never imports three, touches the DOM or calls `Math.random`. **Word:** the letters m-o-n never appear together anywhere in the game folder, nor in any string the game can show (names, registry entries, techniques, traits, items, dialogue). **Data:** 250 COM-bots in 126 lines, every evolution reachable and adding parts, every technique, trait, item, recipe, blueprint and program card well-formed, every bot obtainable somewhere. **Maps:** 64 maps with rows of equal width, every warp paired, every entity on a reachable tile, every encounter table naming real bots. **Battle:** type chart, damage, status, atmospheres, catching, switching and AI on scripted fights. **Determinism:** same seed, same game. **Save:** serialize → load round trips mid-story. **Pilot:** the autoplayer finishes the story (eight Forgemasters, the Syndicate, the Furnace Four and the Champion) from a new game. `ONLY=purity,word,data,maps,battle,determinism,save,pilot`, `SEEDS=1,2,3`, `VERBOSE=1`. |
| `node game-065/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). Desktop: title → New Game (name and look) → the opening → Ma Bellows → pick Embrit → keyboard walking → a wild battle won with Fight → catch with a Reboot Spike from the bag → a trainer who spots you → level-up evolution and its new-parts screen → the wreck-repair welding minigame → every pause-menu panel (Team, Summary, Bag with a Patch Kit, Registry and an entry, Map, Settings) → Boiler Station → Parts Exchange → Workbench → Locker → the ending → save, reload, Continue. Then touch-only phones at 390×844 and 844×390 with real CDP touches: title and new game, controls finger-sized and clear of the HUD, the D-pad walks, A talks, a whole battle by touch with the battle box and gauges on screen, every panel fits, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`, `VERBOSE=1`. Screenshots in `dev/shots/`. |
| `node game-065/dev/play.mjs "index.html?debug=1&quick=1" script.js [w h]` | Opens the real game and runs a snippet: the body of an async function given `page, shot, wait, key, rt` (`rt('expr')` evaluates with `rt`, `app` and `g` bound). `TOUCH=1` for a touch phone, `LOG=1` to echo the console. |
| `node game-065/dev/shoot.mjs "dev/gallery.html?from=1&n=30" name [w h] [frames]` | Screenshot any page. `dev/gallery.html` renders bots in a grid (`?people=1` for the cast), `dev/scene.html?map=gasket&x=12&y=9` renders one map. |

The browser scripts need `playwright` and a static server on port 8065:

```bash
python3 -m http.server 8065          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-065/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws this game at about one frame a second (every metal surface runs a noise shader, and shadows and bloom are on), so the browser test teleports with `__rt.tp`, runs at `?fast=4` with instant text and the lowest graphics tier, and waits on the view's frame counter rather than wall time.

## Debug hooks (`?debug=1`)

`window.__rt`: `app`, `view`, `game`, `mode`, `world`, `tp(map, x, y, dir)`, `give(id, n)`, `bot(name, lv)`, `wild(name, lv)`, `heal()`, `story(n)`, `species`. Also `?fast=N` (animation and text speed), `?seed=N`, and `?quick=1&map=&x=&y=&starter=&lv=` to skip the opening with a starter in hand.

## The pilot

`js/sim/pilot.js` plays the whole story through the real `Game` API: it walks with breadth-first paths across the map graph, talks to whoever the objective needs, picks techniques by expected damage, switches out of bad matchups, throws spikes at bots it lacks, heals at stations, grinds before Forgemasters when underlevelled and keeps its best six in the party. A run from a new game to the Starward Ticket takes about a second. Its runs found real bugs: a stalemate when both bots only had techniques the other resisted (the struggle move, Sputter, is now typeless), a warp that dropped the player inside a wall, a Furnace Four door that opened before its member was beaten, a COM-bot that appeared nowhere, and a void bot whose specialist trait one-shot whole teams.
