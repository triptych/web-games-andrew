# Legend of the Jade Wyrm — dev harnesses

Plain Node scripts, no build step, no test framework. They need `playwright` and a
static server run from the **repo root**:

```bash
python3 -m http.server 8053
```

| Command (from `game-053/dev`) | What it does |
|---|---|
| `node browsertest.mjs` | Real Chromium + WebGL (SwiftShader) + three.js r165. **Desktop:** the creation wizard by clicking (a bad name is rejected; pronouns, race, specialty, summary) → the first-day page (10 forest fights, the admin's welcome letter, the mail badge) → **every page in the registry** renders a title with no errors → commentary (post with colour codes, someone answers, the deed) → hotkeys ignored while typing, Esc leaves the box → the Gloamwood by hotkeys until out of turns (fights with auto-fight, events) → **all 24 forest events** offer a choice and resolve (the old man's guessing game is played out) → question and beat the master, level 2, news → buy and trade in gear → bank deposit/withdraw → inn: ale, gossip, flirting (one a day), the bard, marrying Corwin, a room, sleep → a new day (turns, sobriety, the spouse buff) → dying (gold lost, news, the death text shown before the Pale Shore), tormenting a soul, resurrection for 100 favour → PvP against a sleeping warrior → level 15, the Jade Wyrm, the Wyrm-kill reset (title, gift, spouse kept, deed, news, the square reacts, the Standing Stone opens) → mail with a reply → export, reload, log back in, import into a second slot → **40 simulated days** (no NaN or negative stats, the Herald fills, population steady, a spread of levels) → Hall of Heroes, the Roll, a profile, Esc → classic pacing: a new day after 6 real hours, and sleeping early logs out with a countdown. **Phones** at 390×844 and 844×390, touch only: tap through, every nav button ≥ 40 px and on screen, no horizontal overflow, a tapped fight, the vitals/online drawer, the bottom bar. Fails on any console error or warning, page error or failed request. Screenshots go to `shots/`. `ONLY=desktop` / `ONLY=phones`, `VERBOSE=1`. |
| `node shots.mjs out.png [w] [h]` | One screenshot after a quick start. `START=0` stays on the login, `EVAL='…'` runs code first (`__jw` hooks below), `WAIT=ms`, `Q=high\|low\|off`. |
| `node views.mjs out.png [minutes]` | Every page's 3D view, snapped, in a contact sheet, at a time of day (720 = noon, 1300 = night). `VIEWS=a,b,c` for a subset. |
| `node foes.mjs out.png` | One foe of every body kind in its fight view, in a contact sheet. |
| `node debug.mjs script.js` | Quick start, then runs `script.js` as the body of an async function with `page` in scope. |

If `import 'playwright'` fails because it is installed globally, link it:
`mkdir -p node_modules && ln -s "$(npm root -g)/playwright" node_modules/playwright`.

No network to unpkg.com? Fetch three.js once and the scripts serve the CDN requests
from disk — still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

SwiftShader renders at a frame or two per second with shadows on, so the tests run
with `quality: 'low'` and the scripts snap the camera instead of waiting for tweens.

## Debug hooks

Load the game with `?debug=1` (and optionally `&seed=anything` for a repeatable realm) to get `window.__jw`:

| Hook | Effect |
|---|---|
| `__jw.quickStart({ name, sex, race, spec, pacing, slot })` | Skip the wizard |
| `__jw.game.goto(id, arg)` | Open any page (`__jw.PAGES` lists them) |
| `__jw.game.newDay()` | Simulate a day on the server and roll the player over |
| `__jw.game.tick()` | One tick of the live loop (commentary, mail, online list, classic dawn) |
| `__jw.p`, `__jw.w` | The live player and world |
| `__jw.scene.setView(name)`, `.snapView()`, `.setTime(minutes, alive)`, `.showFoe(creature)` | The 3D layer |
| `__jw.enter(slot)`, `__jw.logout(msg)`, `__jw.showTitle()` | Login screen |
| `__jw.S`, `__jw.W`, `__jw.R`, `__jw.ui`, `__jw.audio` | Modules |

## Bugs the harness caught

- **Dying skipped the death text.** `die()` cleared the fight, so the refresh after the killing blow found no fight and jumped straight to the Pale Shore. The fight now stays until you leave its result page.
- **Level-15 NPCs had `null` experience in saves.** Their starting XP was interpolated towards `expForNext(15) = Infinity`, which JSON writes as `null`.
- **Hotkeys fired while typing in the commentary box** (pressing F in a sentence went to the forest). Hotkeys now ignore text fields, and Esc leaves the field.
- **The phone drawer opened behind its own scrim**: `#app` is a stacking context, so the scrim (outside it) covered the drawer (inside it). The scrim now lives inside `#app`.
- **Landscape phones got the tablet layout**, leaving about 100 px for text. Short screens now get the phone layout with a shorter header and scene window.
- **Cameras inside trees**: the forest scatter didn't know about the camera positions. Trees now keep clear of every view's camera and line of sight.
- **The Wyrm's cave was inside the mountain mesh**, hiding the dragon.
- **Logging out from a nav action** left a pending refresh that rendered a page with no player.
