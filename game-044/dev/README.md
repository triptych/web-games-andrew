# The Story Thief of Greymantle — dev harnesses

Plain Node scripts using Playwright, with no build step and no test framework. They
need a static server on the **repo root**:

```bash
python3 -m http.server 8044      # from the repo root; BASE defaults to http://127.0.0.1:8044
```

If Playwright is installed globally rather than in this folder, link it:
`ln -s "$(npm root -g)" node_modules` (git-ignored). `PW_CHROMIUM_PATH` overrides
the browser binary.

| Command (from the repo root) | What it does |
|---|---|
| `node game-044/dev/walkthrough.mjs` | Plays the whole game through the real UI: verb buttons, clicks on the scene, satchel clicks, dialogue choices. Nothing teleports. (1) The perfect route to *The Keeper's Daughter*, checking every puzzle gate (Gran won't let you leave without a goodbye, the troll blocks the bridge, a wrong riddle keeps the door shut, Brimble blocks the stair…) and a final score of 200/200. (2) **Continue** from the autosave, then *The Broken Loom*. (3) **Continue** again, then *The Gift of Rowan*. (4) Three deaths, each followed by **Turn back a page**, checking that scene, satchel and score are restored. Fails on any console error. `VERBOSE=1` lists every passing check. |
| `node game-044/dev/mobiletest.mjs` | An emulated phone driven **only by touch**, in portrait (390×844) and landscape (844×390): title → How to Play → Begin → prologue → talk to Gran → take the cake → use it from the satchel → Book of Tales → menu → help → save. Before every tap it checks the target is on screen, topmost at its centre and not under the fade layer. Also checks tap-target size, no sideways scroll, and that the scene and the bar both fit. Screenshots go to `dev/shots/mobile-*.png`. |
| `node game-044/dev/shots.mjs [scene …]` | Screenshots the title and any scenes (e.g. `cottage green bridge`) into `dev/shots/` (git-ignored). Uses the `?debug=1` hooks. |

## Debug hooks

- `window.__story` is always present and read-only: current scene, busy/running,
  player position, score, satchel, flags, visible hotspots, `spotAt(x, y)`. The
  walkthrough uses it to find where to click; it never changes game state.
- `?debug=1` also exposes `window.__game` (engine internals, `enterScene`,
  `sceneArt`) and outlines the hovered hotspot.

## Bugs the harnesses caught

- **"How to Play" did nothing, and "Begin" showed a black screen** (reported
  from a phone, but it happened everywhere). Storybook pages were layered under
  the title (z-index 70 vs 80), and the prologue was drawn under the black fade
  left over from leaving the title. Pages now sit above the title and lift any
  fade when they open. The walkthrough missed both because Playwright clicks
  straight through `pointer-events:none` layers, so both harnesses now check
  that each target really is the topmost, un-faded element before tapping it.
- **Phones on their side had no room for the verb bar**: the menu button ended
  up off the bottom of the screen. Short landscape screens now put the bar
  beside the scene.

- **The road out of the village couldn't be clicked.** The notice board's hotspot
  sat over the only exit north, so every click there looked at the board. The
  board moved beside Gran's gate and the lamp post moved to the inn.
- **The same thing in the Whispering Pines**: the signpost covered the path up the
  mountain. The signpost now stands beside the fork instead of in it.
- **Walking through the troll.** When a walk target could be reached on the grid
  but not by any path (the troll blocks the bridge), A* gave up and Rowan walked in a
  straight line through him. Unreachable targets now go to the nearest cell A*
  actually reached.
