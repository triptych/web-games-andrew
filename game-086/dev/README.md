# Colorverse — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-086/dev/simtest.mjs` | Headless, in Node (a second or two). **purity**: the pure modules never touch the DOM, storage, the clock or `Math.random`. **art**: every mosaic rasterises with every pixel drawn, uses every colour at least 3 times, and has no two colours too alike to tell apart once painted (redmean distance ≥ 48, ≥ 30 for the all-grey Hush); portraits crop inside their art. **rules**: wrong paint, painting over it, locked pixels, smart and plain brushes, pour reaches exactly its connected number, burst, True Hand, Starburst charges, Supernova, Moonlit Lanterns, Gilded Frame, streak and catcher, completion rewards paid once, a finished page can't be painted or undone, the time-lapse order, Final Flourish at 90%, buying skills. **save**: round trip; broken JSON, old versions, tampered cells, unknown skills, skills missing a prerequisite and a false "done" are all rejected or dropped. **story**: unlock order (Book Two after the Colorverse, each bonus set behind its own skill), every page has both scenes, every speaker exists, no `[` `]` in lines. **bot**: plays all 29 story pages and the 6 bonus pages buying skills cheapest-first, checks the whole Constellation is learnable, and prints Glimmer and skills after each chapter. `ONLY=purity,art,rules,save,story,bot`, `VERBOSE=1`. |
| `node game-086/dev/browsertest.mjs` | Real Chromium, real input. **desktop**: Begin, the prologue by Enter and clicks, wheel zoom, a right click earns Glimmer, a wrong click makes a mistake, Ctrl+Z, a drag paints what it crosses, number keys, Wick finished by real clicks, the reward card, the after-scene, Comet's page, Esc to the chart, a skill learned by click, the gallery and a PNG download, a reload keeps it all. **phones** at 390×844 and 844×390 (touch only): taps through the title and dialogue; the canvas fills its stage; a CDP two-finger pinch zooms and paints nothing; a late second finger undoes the first finger's dab; a two-finger drag pans; a tap paints one pixel; a one-finger drag paints a run; Move pans with one finger and the next tap after it still lands; 44 px controls on screen; nothing under the back link; no sideways scroll. **nostorage**: boots and paints with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-086/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1&fasttext`, runs a snippet in the page (`return` prints a value), screenshots `dev/shots/name.png`. |
| `node game-086/dev/shot.mjs [page] [name] [w h]` | Screenshots a dev page, by default `dev/gallery.html`: every mosaic and portrait with its palette, pixel counts and any colours that are too alike. `gallery.html?only=dragon,castle&scale=12`. Judge art here before judging it in the game. |

The browser scripts need `playwright` and a static server on port 8086:

```bash
python3 -m http.server 8086          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-086/dev/node_modules
```

(On Windows without symlink rights, `mklink /J` makes a junction instead.) `PW_CHROMIUM_PATH` points at
another Chromium. The harnesses answer Google Fonts requests with an empty stylesheet; the game falls
back to system fonts.

Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__cv`: `app`, `state`, `paint` (the painting screen; `paint.painter` is the canvas, camera and
gestures), `ART_BY_ID`, `show(screen)`, `openChart()`, `openSkills()`, `openGallery()`, `startPage(id)`,
`beginJourney()`, `nearlyDone(id, leave)` (paint all but the last `leave` pixels), `finish(id)` (mark a
page restored), `give(n)` (Glimmer). `&fasttext` shows each dialogue line at once.

## Touch gotcha (learned here)

`touch-action: none` is not enough on its own. Chromium still builds a fling from a one-finger drag on
the canvas and then swallows the next tap anywhere on the page, say on a colour swatch, to "stop" it.
The canvas also cancels `touchstart` and `touchmove` (`{ passive: false }`). The phone test's "Move
pans… and the next tap still lands" step catches a regression.
