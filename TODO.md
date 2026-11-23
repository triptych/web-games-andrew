# TODO

## After merging PR #369: dialog buttons and tabs no longer scroll away

PR #369 pinned the Done / OK / Close button and the tab bar of every dialog in 71 games (see `CHANGELOG.md` and
[learnings.md § Dialogs: the Buttons and Tabs Never Scroll](docs/generic/learnings.md#6-dialogs-the-buttons-and-tabs-never-scroll-required-all-games)).
It passed `dev/smoketest.mjs` for all 71 games, desktop and phone, and a headless Chromium dialog sweep. What is left:

- [ ] **Check on real phones.** Sticky strips with negative offsets inside a scrolling card were only checked in headless Chromium. Open a long dialog on iOS Safari and Android Chrome, in portrait and landscape: game-027's cauldron, game-139's deck, game-080's shop, game-134's Settings at 844 × 390, and game-072's Upgrades. Check that the button row sits flush with the card's bottom edge, that nothing shows through it, and that the card doesn't scroll sideways.
- [ ] **Re-export the itch.io builds that include a fixed game.** `game-072/frosty-fling.zip` was built before the fix. Rebuild it with `/export-itch` (and any other itch upload of a game listed in the changelog entry).
- [ ] **Reconcile game-072's build.** `game-072/src/build.sh` would drop 29 lines from `game-072/index.html`, which was edited by hand after its last build. Port those lines back into `src/` so the build reproduces the page, then rebuild.
- [ ] **Per-game changelogs.** Step 6 of `/scaffold-game` asks for each version in the game's `game-plan.md` changelog. The 71 patch versions are only in the root `CHANGELOG.md`. Add a one-line entry to each game's plan, or decide that one root entry is enough for a sweep like this.
- [ ] **`status.md`.** Its notes still describe these games at their old versions. Mention the dialog fix where a row lists the version.
- [ ] **The `← Games` link covers the top of some dialogs.** In game-055, game-056 and game-064 the fixed link sits over a card's heading when the card fills the screen. A pinned header (game-056's Keep) can now sit under it permanently. Give those screens the template's `calc(52px + var(--safe-t))` top padding, or hide the link while a dialog is open.
- [ ] **Screens deliberately left unpinned.** Review them and pin any that turn out long in practice:
  - game-057's game-over card and game-064's game-over modal (buttons follow a short stats block).
  - game-088's win/lose result sheet (`overflow: visible` for its ribbon).
  - game-053's title menu, which needs a scroll on an 844 × 390 landscape phone.
  - The full-screen endings and credits of game-033, game-055, game-113 and game-137.
- [ ] **Add the dialog sweep to the repo as a test.** It ran from a scratch script outside the repo. It opens each dialog at 1280 × 640 and 390 × 700, adds 2400 px of filler before the foot, and checks the buttons with `elementFromPoint`, both at the top and after `scrollTop = 1e6`, and the tabs after scrolling. Commit it as `dev/dialogtest.mjs`, or fold the check into `dev/smoketest.mjs`, so a new game can't ship the bug again. Things it must handle:
  - Finish open animations before measuring.
  - Skip roots that are menus.
  - Ignore loading overlays.
  - Put the filler inside a nested foot's wrapper (game-139's story card, game-085's naming form).
- [ ] **Dialogs built entirely in JavaScript.** The sweep only sees dialogs already in the page. Those found by reading the code were fixed (game-063, 065, 069, 072, 087). Any other game that creates a dialog element when it opens should be opened once in play and checked by hand.

## 2.x upgrades: which games to rebuild next

Audited on 2026-11-20 across all 143 games. A **2.x upgrade** means what game-012 (Arcana Pull) and game-027 (Alchemist's Lattice) got:
keep the v1 design whole, finish what its plan left open, and rebuild it to `/scaffold-game` §2S. That means a pure seeded sim in
`js/sim/`, a three.js or Canvas 2D view, DOM screens, a bot, and `dev/simtest.mjs` and `dev/browsertest.mjs`. It also gets
generated media from Step 2G: fal paintings, plus ElevenLabs music, effects and voices with a synth fallback.

What the audit found:

- 98 games already have the sim/view split, and 20 have both fal art and ElevenLabs audio (012, 085, 115, 126–137, 139–143).
- 33 games have no `dev/` harness at all: 002–011, 013–015, 018–021, 023–026, 028–031, 033–038, 044 and 072. game-033, 037 and 038
  have their own `tests/` or `test/` folder.
- 13 games still run on Kaplay (002, 004, 005, 006, 008, 009, 010, 011, 013, 015, 016, 017, 032) and two on Phaser (028, 035).
- 72 sim/view games have no image or audio files. Many of them meant to look procedural; for the character- and story-led ones,
  generated art and audio is the biggest upgrade left.
- Three games talk through the browser's `speechSynthesis` (106, 107, 109). Real ElevenLabs voices would replace it.

### Tier 1: full 2.x rebuilds, best first

Each one is its own PR. Each takes the game from an old engine or no harness to the scaffold, and from emoji, shapes or nothing to
painted and voiced media.

- [ ] **game-009 Chronicles of the Ember Crown** (Kaplay, party turn-based RPG). Four classes, 12 battles, a journey map and NG+,
  with 11 images. It follows the game-012 pattern: a bot balances the 12 fights. Paint the heroes and foes, and add battle barks
  rationed like game-126's. Finish the polish and endgame phases it never checked off.
- [ ] **game-015 Tamagoji** (Kaplay, virtual pet). Five species and four life stages, drawn as emoji. Phases 2–3 are unbuilt. A pet
  sim depends on its character art: use fal sprites for each species, stage and mood (`nano-banana-2/edit` from the base sprite, so
  each pet keeps its identity as it grows), plus ElevenLabs chirps and a lullaby theme. Offline catch-up fits the sim (game-034 and
  game-065 do it).
- [ ] **game-008 Centipede Tower Defense** (Kaplay). This is the most finished early game, and its shooter/tower-defense hybrid
  appears nowhere else in the collection. A bot in Node can balance its waves, which Kaplay never allowed. Use a three.js view,
  fal sprites for the towers, centipedes and ship, and a music track for each wave set.
- [ ] **game-033 Hearthbound** (vanilla DOM and canvas visual novel). It has the most writing in the repo: 195 nodes, about 15,800
  words and 13 endings, but only 17 images. Its engine is already vanilla and unit-tested, so this is a media-led 2.0 rather than an
  engine change. Move the story engine into `js/sim/` behind the scaffold's harnesses (keep its 109 tests). Paint the backgrounds
  and the cast, add a theme for each season, and voice the key scenes.
- [ ] **game-013 Petal & Purse** (Kaplay, cozy flower-shop idle game). Paint each flower by rarity and growth stage, and paint the
  shop. A pure idle sim lets a bot answer its open
  questions (how long a session should feel, whether to add prestige or wilting).
- [ ] **game-020 The River** (Canvas 2D narrative roguelite; rated Complete). It has companions, crafting and endings but no media.
  Painted riverbank scenes, voiced travellers and music by river stretch would lift it the most of the remaining text-led games.
- [ ] **game-018 Village of the Wandering Blade** (three.js r165, 3D countryside and village building, 6,100 lines, no harness).
  Move it to the sim/view layout and settle the open questions the plan never decided (win condition, endless scaling, permadeath), using the bot's balance tables.
- [ ] **game-044 The Story Thief of Greymantle** (Canvas 2D point-and-click fairy tale). It predates the sim/view scaffold: its `dev/`
  has walkthrough and mobile scripts but no sim, `simtest` or `browsertest`. A point-and-click game depends on its scenes: paint the 10 scenes and 15 items, and voice the narrator.

### Tier 2: retire Kaplay and Phaser from the smaller games

These are small enough that a 2.x is mostly a port. Do them only when a game is opened anyway, or as a batch to delete
`lib/kaplay`.

- [ ] **game-035 N2 Overdrive** (Phaser 4, tube shooter). Its tunnel is naturally 3D, so a three.js view fits better. It needs
  ElevenLabs music more than art. game-028 left Phaser in v2.0.0; `lib/phaser` is still loaded by game-019, 020, 021, 022 and this one.
- [ ] **game-011 Nonogram Fleet** (Kaplay): fal ships to reveal, and a sim that a solver test can check, like game-017's.
- [ ] **game-006 raycasting FPS** (Kaplay, 70 images already). It overlaps 021, 026, 031 and 054, so port it only if it gets its own
  hook.
- [ ] **game-002, 004, 005, 010, 016, 017, 032.** Plain ports with no media push. game-004 overlaps 008 and 068, and game-010 overlaps
  115 Hearthwick, so leave them on 1.x unless the owner wants them. game-016 and game-017 already have browser tests and are fine
  as they are.

### Tier 3: media-only upgrades for sim/view games with no assets

These already follow the scaffold. A painted and voiced view is a minor version when it sits on top of the old one (game-110 v1.5,
game-113 v1.2), and a 2.0 when the view is redone around it. Best candidates, all character- or story-led:

- [ ] **game-093 Dawnshard Saga** (HD-2D JRPG): painted sprites and portraits, as game-113 Crystal Crescendo got.
- [ ] **game-103 Crown & Crumpet** (cozy tactics): portraits and voices for the princess and her rescued party.
- [ ] **game-119 The Hero's Merchant**: its "painted chibi sprites" are drawn in code. Replace them with fal sprites.
- [ ] **game-095 Hauntly Manor** (point-and-click): six painted rooms and a voiced cast.
- [ ] **game-047 Ashes & Aces** (deckbuilder × poker solitaire): painted cards, like game-012 and game-139.
- [ ] **game-090 Verdant Protocol, 097 Hollow Gambit, 098 Wyrmbond, 089 Dragonroll, 081 Salve & Scale, 063 Tee & Sorcery**
  (RPGs and tactics with a cast): portraits and monster or unit art.
- [ ] **game-107 Kaiju Roll, 109 STARBLAZER '86, 106 INTRUDER ALERT '84**: replace `speechSynthesis` with ElevenLabs voices (the
  reporter and commander in 107, Mira in 109), keeping the captions and the line rationing.
- [ ] **Audio-only follow-ups.** These games have fal art but procedural sound: 027 (its plan suggests cast voices), 110, 113, 121,
  125 and 138. Each gets a patch or minor bump, not a 2.x.

### Not recommended for 2.x

- **Procedural on purpose:** arcade games whose look is their identity, such as 039, 041, 045, 052, 060, 070, 075, 092 and 100,
  and the maker and fantasy-console games (076, 084, 099).
- **Already up to standard:** 012, 027 and everything from game-126 on.
- **game-072 Frosty Fling:** reconcile its `src/build.sh` first (see above).
- **The early dungeon crawlers** (003, 021, 025, 026, 029, 031, 032): seven overlapping games, and the newer 049, 101, 129 and 132
  do the genre better. Upgrade at most one, chosen by the owner. 031 and 036 are worth keeping as they are for their hand-written
  software renderers.

### Checklist for every 2.x (from the game-012 and game-027 PRs)

- [ ] Keep the v1 design and say so in `game-plan.md`, with the v1 plan linked from git history. Finish the open items.
- [ ] Follow the §2S rules 1–9, and import `rng`, `save` and `input` from `lib/core` once the scaffold switches (see below).
- [ ] Follow the Step 2G pipeline: run a pilot first, add `dev/art/README.md` and `dev/audio/README.md`, and keep a synth or
  procedural fallback for every asset.
- [ ] Pin the dialog buttons and tabs (learnings § 6). Check touch-only phones in both orientations, and check blocked storage.
- [ ] Use a new save key or version, so a v1 save is ignored cleanly and not half-loaded.
- [ ] Bump the major version in `js/config.js`, `js/gamedata.js` (update the description to name the art and sound), `CHANGELOG.md`,
  the `status.md` row and the `game-plan.md` changelog. Regenerate the preview and icons.
- [ ] Re-export the itch.io zip with `/export-itch`.

## Common core (`lib/core`)

The shared library and its audit are in [lib/core/README.md](lib/core/README.md) and [docs/common-core.md](docs/common-core.md) (PR #368). No game uses it yet. Every game must stay standalone for itch.io: import from `/lib` (the exporter copies it into the zip) or copy the file into the game, and never add an npm or CDN dependency.

- [ ] **Switch the scaffold to `lib/core`.** In `.claude/commands/scaffold-game.md` §2S, replace the templates for `js/rng.js`, `js/save.js`, `js/input.js` and the audio plumbing with imports from `lib/core`. Use `makeRng(seed, { hashSeed: true })` in new games. Rerun the scaffold's own `simtest`, `browsertest` and `dev/smoketest.mjs` on an untouched scaffold, and export it with `dev/itch/export.mjs` to confirm the zip runs on its own.
- [ ] **Pre-existing test failures found on the way.** game-063's phone check (club buttons overlap the lie readout at 390×844) and game-054's exit-switch steps with `SEED=767923` fail on `main` too. In `dev/smoketest.mjs`, game-014's desktop view fails on an aborted MP3 request (`sound/Cyberpunk Moonlight Sonata.mp3`) and game-053 fails on both views with "back link has no size"; both fail on `main` too.
- [ ] **iOS audio: check on a real iPhone.** `lib/ios-audio.js` (PR #376) now gives every game game-100's fix: a silent loop so the ringer switch doesn't mute it, and interrupted contexts resumed. Chromium can't reproduce either, so open two or three games on an iPhone with the switch on silent, take a call mid-game, and confirm the sound comes back.
- [ ] **Migrate existing games one at a time, only when a game is opened for other work.** Use `node dev/core/simtest.mjs` to see which copies are drop-in (same random numbers, so seeds and saves survive). Not drop-in: `makeRng` in 045–050, 056, 057 and 143 (143 has a distinct seed mix); `hash3` in 129; `vnoise`/`fbm` in 063, 069 and 073. Run the game's own tests, and bump its patch version (`js/config.js`, `js/gamedata.js`, `CHANGELOG.md`, `status.md`).
- [ ] **Shared dev-harness helpers.** Most games' `dev/*.mjs` define the same `check`, `until`, `shot`, `backLinkOk`, `reportErrors`, `nostorage` and `tapSel`, plus the SwiftShader launch and the unpkg/Google Fonts routing. Move them into `dev/lib/harness.mjs`. It is dev-only, so the itch rule doesn't apply.
- [ ] **`lib/three/` view helpers.** Canvas-texture builders (73 games), the bloom chain (48) and toon/ink passes (6). Pass `THREE` in as an argument, as `lib/round-bloom.js` takes its pass, so `lib/core` stays free of three.js and each game keeps its own import map.
- [ ] **CRT pass and bitmap font.** game-075 and game-092 share a byte-identical `view/font.js` and two 169-line `crt.js` files (game-084 has its own CRT pass). Extract them the next time a game wants that look.
- [ ] **Menu screen stack.** About 60 games have their own `openScreen`/`closeScreen` with focus moves and Escape handling. This needs a shared markup contract first (`.screen`, `data-act` buttons, `#toasts`), then a `lib/core/screens.js`.
- [ ] **Keep `lib/core` honest.** When a game finds a bug in a module, fix it in `lib/core`, add a test to `dev/core/simtest.mjs` or `browsertest.mjs`, and list the games whose own copies still have the bug here.

## Accessibility

The shared baseline is `lib/a11y.js` (PR #131). What is left is per-game work.

- [ ] **Announce game events.** Call `window.A11Y.announce(msg)` for score changes, dialogue, toasts, banners, level up and game over. Start with the newest games (084–088), whose `#praise`, `#banner`, `#toasts` and `#dialogue` elements are not all live regions.
- [ ] **DOM controls for canvas-only games 002–041.** About 28 games have no `<button>` at all. Add real Start, Pause and Restart buttons, a visible text description of the controls and goal, and an `h1`.
- [ ] **Reduced motion in JS.** Make screen shake, flashes and parallax read `window.A11Y.reducedMotion` and default to off. Port game-088's "Calm effects" setting to other games. Keep flashes under 3 per second.
- [ ] **Remove bare `outline: none`** where no `:focus-visible` replacement exists (for example game-050 `.node-btn:focus` and game-072 `#stage`). The `lib/a11y.js` ring covers them, but the original rules should go.
- [ ] **Clickable non-buttons.** About 39 files attach click behaviour to `div`, `span` or `li`. Convert them to `<button>` so they are focusable.
- [ ] **Keyboard alternatives** for drag-only and hold-only mechanics. game-016 has no key handling at all.
- [ ] **Icon buttons and toggles.** Review the auto-generated `aria-label`s and add `aria-pressed` to mute and speed toggles (033, 045, 046, 048, 049).
- [ ] **Tabs and dialogs.** Verify the auto-added tab roles and dialog semantics in 065, 073, 081, 084, 085 and 088. Add `aria-controls` and make sure the background is inert while a modal is open.
- [ ] **Text size and contrast.** About 52 games use fonts of 10px or smaller. Raise the minimum to 12–14px and check muted or secondary colours against 4.5:1.
- [ ] **Colour-only information.** Check match-3 and tile games and status bars. Add shapes or icons and a colourblind palette option.
- [ ] **Hub and garden.** Confirm the Library is keyboard-reachable before the 3D scene loads, and that the carousel in `css/styles.css` has a visible `:focus-visible` style.
- [ ] **Verify.** Run axe and a screen-reader pass (VoiceOver or NVDA), and run `dev/smoketest.mjs` with CDN access.
