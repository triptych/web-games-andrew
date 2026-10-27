# Hemlock Hollow: dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-104/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock, and never import the view, UI, audio or storage. **data**: the map is closed, connected and every exit has a way back; every id a rule names exists; every room has a picture; patrol rooms have a hiding place and all three patrol lines; every recipe, herb and spell is well formed; the world holds twice the herbs the story needs. **parser**: the sentences a player types come out as the right verb and nouns. **rules**: the opening, the dark, light and the Herbal, every way to die (well, bog, mushrooms, nightshade, hemlock, poison in a flask, dread 100, a failed veil, the wagons), the patrols and hiding, the Mill password, the Oak, Dray's flask, the tonic, Tobias and the uniform, Moll, the Infirmary gates, the trapped vault door both ways (jam it, or cure Bryony), the Vaults, Vesper and the ward-stone, and all three endings. **saves**: determinism, a save round trip at six points of the story, version rejection. **walkthrough**: the bot plays the whole story and wins with a perfect score and the best ending on four seeds; a player who never hides is shown what that costs. **fuzz**: seeded random sentences, half of them from deep in the story, with invariants after each (ember and dread in range, no negative stock, every item somewhere, every save round trip exact). `ONLY=purity,data,parser,rules,saves,walkthrough,fuzz`, `FUZZ=n`, `VERBOSE=1`. |
| `node game-104/dev/browsertest.mjs` | Real Chromium. **desktop**: the title and back link, How to Play, New Game, the chapter card, a picture that is strictly black and white, real keys typing commands (Enter submits, Up recalls), the tap shortcuts composing "take kettle", Esc pauses, Save & Quit → Continue restores the game and its transcript, a death shows the death screen and Restore brings you back, and the whole story played through the UI reaches the "Dawn Over Ashwick" screen with 100 points. **phones** (touch only, real taps) at 390×844 and 844×390: the menus, the shortcut chips are on and compose commands, controls are finger-sized, the transcript keeps room to be read, no sideways scroll, the pause screen stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-104/dev/shot.mjs [scene] [dread]` | Screenshots `dev/gallery.html`: every scene with its people, drawn the way the game draws them. `dread=70` shows the black creeping in from the edges. Judge a picture here before it goes in a room. |
| `node game-104/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1&fast=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-104/dev/preview.mjs` | Writes the 1200×630 Library preview, `garden/img/games/game-104.jpg`, from a moment set up through the debug hooks. |

The browser scripts need `playwright` and a static server on port 8104:

```bash
python3 -m http.server 8104          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-104/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. There is no CDN dependency (the only network requests are two optional Google Fonts, which the scripts answer with an empty stylesheet, so the game falls back to a system serif).

The tests open the game with `&fast=1` (text prints instantly) and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hh`: `G` (the game), `mode` (`title`, `play`, `dead`, `over`), `seen` (a count of every sim event drained), `ui`, `view`, `audio`, `start(seed)` (skips the title), `run(command)` (as if typed), `walk(n)` (the first n commands of the walkthrough through the real UI path, with the careful player's hiding), `autowin()`, `status()`, `scene()`. `&fast=1` prints text instantly; it does nothing without `debug=1`.
