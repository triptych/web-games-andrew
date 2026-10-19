# Quillsworn — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-087/dev/simtest.mjs` | Headless, in Node (about a second). **purity**: `js/sim/`, `js/sim/data/`, `js/book/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock, and never import the UI. **text**: word counts, the markup parser (400 fuzzed strings stay well-formed; a crossing marker stays literal), typographer’s quotes, the Lens and Thalion’s verdicts. **rules**: levels, the high-water mark (no XP twice for deleted and retyped words), pasted words, every quest’s unlocks and rewards, bounties by date, characters, the loom, the world, the Well, talents and points, duels (damage, recovery, taunts, time out, drops, the training dummy), relics, moving and deleting, find and replace (no XP), snapshots, streaks, Free Pen, night words. **data**: every scene line’s speaker and mood, placeholders, lessons and relics the quests name, foes, talent prerequisites, the order rooms open in, every sigil, foe and mood draws. **book**: the HTML, print, manuscript and Markdown outputs; the EPUB is a stored zip with `mimetype` first, right CRCs, every manifest item present, every XHTML/OPF/NCX/SVG file well-formed, and `unzip -t` agrees if it is installed. **save**: core and novels round-trip; unknown versions and a save with no apprentice are rejected; a missing novel is dropped; ids never collide after a load; old saves get new fields; word counts are recounted from the text. **bot**: an apprentice who writes 1,700 and then 800 words a day plays the whole guild road to the finale, with the day and level at each quest. `ONLY=purity,text,rules,data,book,save,bot`, `VERBOSE=1`. |
| `node game-087/dev/browsertest.mjs` | Real Chromium, real input. **desktop**: title, prologue by Enter and clicks (pen name typed, a sigil clicked, a calling), the Charter typed into, the Spark turned in, 160 words typed earn XP, the high-water mark, a paste earns none, Ctrl+B, Reading view, + Chapter, Ctrl+S and the split save keys, First Ink, a character typed until fleshed out, a bond in the web, an Imp duel won by typing with the words landing in the scene, Free Pen from Settings, a structure and a beat and a woven thread, a place pinned by clicking the map, a draw kept from the Well, a talent and a relic by click, the Lens, a snapshot, the Library and Board, the Bindery (HTML, EPUB and Markdown downloads with drop caps, appendices and the map plate, the print proof), a reload and Continue, a backup. **phones** (touch only, real taps) at 390×844 and 844×390: the prologue by taps, the dock, the chapter drawer, typing on the page, then every room checked for sideways scroll, controls under 44 px and anything over the back link. **resume**: a reload after the pen name and before the calling; Continue asks for the calling and begins the road. **endgame**: a 40,000-word novel marked complete in the Charter, the finale, the Lamp of Vellmere, no second scene tripping over it. **nostorage**: `localStorage` throws; the title and a banner warn, writing works, the banner downloads a backup. Fails on any console error, page error or failed request. `ONLY=desktop,phones,resume,endgame,nostorage`. Screenshots in `dev/shots/` (the desktop run also leaves `bt-book.epub` there). |
| `node game-087/dev/shot.mjs [page] [name] [w h]` | Screenshots a dev page, by default `dev/gallery.html`: Thalion in every mood, every foe, every sigil charge, maps from four seeds. Judge art here before judging it in the game. |
| `node game-087/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1&fasttext`, runs a snippet (`return` prints a value), screenshots `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8087:

```bash
python3 -m http.server 8087          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-087/dev/node_modules
```

`PW_CHROMIUM_PATH` points at another Chromium. The harnesses answer Google Fonts requests with an empty
stylesheet; the game falls back to system fonts.

To check an EPUB against the standard, run [EPUBCheck](https://github.com/w3c/epubcheck) on the one the
desktop run leaves behind: `java -jar epubcheck.jar game-087/dev/shots/bt-book.epub` (v5.1.0 reports no
errors or warnings for it, with the map plate, appendices and drop caps on).

Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__qs`: `app` (the shell: `S`, `settings`, `sound`, `ctx()`, `after()`, `go()`, `speak()`, `printHtml`,
`lastExport`, `duel`), `S` (the state), `room`, `A` (every action in `js/sim/actions.js`), `go(room)`, `modalOpen()`,
`dialogueOpen()`, `saveNow()`, `days(n)` (move the clock n days, for streaks and bounties), `xp(n)`,
`quickStart(name, calling)` (skip the prologue). `&fasttext` shows Thalion’s lines at once.
