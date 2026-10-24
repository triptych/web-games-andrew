# TODO

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
