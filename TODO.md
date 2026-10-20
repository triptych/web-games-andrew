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
