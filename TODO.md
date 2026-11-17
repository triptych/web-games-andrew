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

## Common core (`lib/core`)

The shared library and its audit are in [lib/core/README.md](lib/core/README.md) and [docs/common-core.md](docs/common-core.md) (PR #368). No game uses it yet. Every game must stay standalone for itch.io: import from `/lib` (the exporter copies it into the zip) or copy the file into the game, and never add an npm or CDN dependency.

- [ ] **Switch the scaffold to `lib/core`.** In `.claude/commands/scaffold-game.md` §2S, replace the templates for `js/rng.js`, `js/save.js`, `js/input.js` and the audio plumbing with imports from `lib/core`. Use `makeRng(seed, { hashSeed: true })` in new games. Rerun the scaffold's own `simtest`, `browsertest` and `dev/smoketest.mjs` on an untouched scaffold, and export it with `dev/itch/export.mjs` to confirm the zip runs on its own.
- [ ] **Check the Space-on-button input fix (game-078).** These `input.js` copies call `preventDefault` on Space without exempting a focused `<button>`, so Space may not press a focused menu button: 031, 035, 041, 042, 045, 046, 054, 055, 059, 060, 061, 062, 063, 066, 069, 070, 071, 073, 074, 075, 100. Test each one. Where the bug shows, switch to `lib/core/input.js` or patch the copy, and bump the patch version.
- [ ] **Bring the iOS audio fixes to the other games.** Only game-100 loops a silent `<audio>` (so iOS plays Web Audio with the ringer on silent) and resumes an `interrupted` context after a phone call. Check a few games on an iPhone with the ringer switch on silent. If they are mute, extend `AudioCore` or copy `unlockMedia()` and the `statechange` handler.
- [ ] **Migrate existing games one at a time, only when a game is opened for other work.** Use `node dev/core/simtest.mjs` to see which copies are drop-in (same random numbers, so seeds and saves survive). Not drop-in: `makeRng` in 045–050, 056 and 057; `hash3` in 129; `vnoise`/`fbm` in 063, 069 and 073. Run the game's own tests, and bump its patch version (`js/config.js`, `js/gamedata.js`, `CHANGELOG.md`, `status.md`).
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

## Repo housekeeping: remote branches

Found on 2026-10-24. The agent session could not delete remote branches (the GitHub proxy blocks it), so this is left to do from a normal clone or the GitHub branches page.

- [ ] **Delete the fully merged branches.** Every commit on these is already in `main`, so nothing is lost. Run `git push origin --delete <name>` for each, or `git branch -r --merged origin/main` to list them again.
  - `claude/amazing-ptolemy-6d3zop`
  - `claude/awesome-faraday-tbdas6`
  - `claude/beautiful-hypatia-uzf6xv`
  - `claude/beautiful-keller-maeuzb`
  - `claude/blissful-cerf-9mc661`
  - `claude/bold-turing-oke2z3`
  - `claude/brave-davinci-xbkg4k`
  - `claude/charming-brahmagupta-2iu600`
  - `claude/charming-lamport-dhnflw`
  - `claude/compassionate-hamilton-najudg`
  - `claude/confident-dijkstra-mo0qxx`
  - `claude/cool-mayer-0orcta`
  - `claude/determined-carson-pwyqrq`
  - `claude/determined-johnson-pd5ofy`
  - `claude/determined-ritchie-ljz92f`
  - `claude/dreamy-bell-u49pdo`
  - `claude/eager-mayer-1wlddj`
  - `claude/eager-turing-ncm8vk`
  - `claude/ecstatic-cray-eofsy3`
  - `claude/elegant-allen-kqfsdm`
  - `claude/elegant-ride-upb4qn`
  - `claude/eloquent-cannon-f17wqg`
  - `claude/epic-mccarthy-e7qvov`
  - `claude/epic-noether-v1arw5`
  - `claude/festive-dirac-qv5dj9`
  - `claude/funny-carson-p25e6u`
  - `claude/gallant-cray-o0izdx`
  - `claude/gallant-lovelace-ppn5ji`
  - `claude/game-086-slips`
  - `claude/game-090-dialogue-fixes`
  - `claude/game-090-head-shape`
  - `claude/game-share-previews`
  - `claude/happy-fermat-tmc79n`
  - `claude/keen-brahmagupta-osdfhd`
  - `claude/keen-volta-vtezuu`
  - `claude/laughing-fermat-mss9f9`
  - `claude/laughing-sagan-6bzjfc`
  - `claude/loving-lovelace-t1mjty`
  - `claude/modest-franklin-t3fqck`
  - `claude/modest-shannon-gy52wp`
  - `claude/modest-wozniak-b3czcg`
  - `claude/nice-hypatia-44dmss`
  - `claude/pensive-cerf-n5vws6`
  - `claude/pensive-knuth-ba1w3b`
  - `claude/practical-shannon-q3rvgf`
  - `claude/relaxed-heisenberg-4h97y0`
  - `claude/relaxed-mendel-4wpec5`
  - `claude/serene-bell-lh3kh5`
  - `claude/sleepy-allen-jd4uha`
  - `claude/sleepy-fermi-kltmm4`
  - `claude/sleepy-fermi-p61ekn`
  - `claude/sleepy-meitner-gc0hqd`
  - `claude/sweet-fermi-obi641`
  - `claude/vibrant-archimedes-2shv8f`
  - `claude/vibrant-archimedes-yx9r7q`
  - `claude/vibrant-ramanujan-nrk0is`
  - `claude/vibrant-ride-6cdo14`
  - `claude/vibrant-ride-s9qz5h`
  - `claude/vibrant-ritchie-76t3zk`
  - `claude/vigilant-cray-sqragm`
  - `claude/wonderful-meitner-fgnp0w`
  - `colorverse-constellation-reflow`
  - `copilot/fix-deploy-job`
- [ ] **Review, then delete or merge, the branches with commits not in `main`.** Most had PRs that were merged earlier, so these commits may already be in `main` under different hashes. Check each with `git diff origin/main...origin/<name>` before deleting.
  - `claude/adoring-fermat-3mh863`: NEONFALL intro scroll, no-hit respawn grace, overmap in the game picture (3 commits, 11 files)
  - `claude/game-090-character-models`: game-090 character model refinements (1 commit; same message as `tender-faraday-vaqdoc`)
  - `claude/tender-faraday-vaqdoc`: game-090 character model refinements (1 commit; same message as `game-090-character-models`)
  - `claude/game-090-character-models-v2`: game-090 dialogue name tag and portrait framing (1 commit)
  - `claude/game-090-model-overhaul`: game-090 heads built from a skull profile (1 commit)
  - `claude/kind-planck-p7ynkm`: blog post about BRICKVADERS, game-060 (1 commit)
  - `claude/peaceful-volta-3g3byx`: let the itch exporter run from a copy outside the repo (1 commit)
  - `colorverse-v2-pixel-rebuild`: Colorverse: keep the Constellation from reflowing when a skill is learned (1 commit)
