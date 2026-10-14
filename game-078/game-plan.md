# Sugarplum Drop

**Genre:** Physics merge puzzle (Suika-style), cozy Christmas
**Engine:** Vanilla JS: Canvas 2D, no asset files
**Status:** v1.0.0 — complete: eleven treats, physics, merging and cascades, chains, the Christmas Miracle, saves, best score, music and sound, mouse/touch/keyboard/gamepad

---

## Concept

A light Christmas candy puzzle with physics. Drop small candies into a glass jar; when two of the same treat touch, they merge into the next one up the ladder, and the new one is checked again, so one drop can set off a cascade. Candies grow into bigger candies and then into Christmas things: a gingerbread man, a holly wreath, an ornament, a present, a snow globe, a gingerbread house, and finally the golden Jingle Bell. Let the pile rise over the striped line for three seconds and the jar is full.

It riffs on **Suika Game** (the watermelon game) and its ancestors: the same drop-and-merge loop and the same "where do I put this peppermint?" tension, dressed as a jar of Christmas sweets on a snowy night with a music box playing carols. It is meant to be gentle: no timer, no lives, a game lasts as long as you keep the jar tidy.

## Core loop

1. A treat hangs from a candy-cane hook at the top of the jar; the next one is shown in the HUD.
2. Aim (mouse, finger, arrows or stick) and drop. A dotted guide shows where it will land.
3. It falls, bounces gently, rolls and settles. Touching its twin, it merges; the result may merge again.
4. Half a second later the next treat is ready. Repeat until the pile stays over the line.

## Mechanics

### Dropping
- The dropper moves at `DROP.speed` (9 units/s) on keys or the stick, or jumps under the mouse or finger. It stays a treat's radius from each wall.
- After a drop the dropper is empty for `DROP.cooldown` (0.5 s). A press in the last `DROP.buffer` (0.25 s) of the cooldown is kept and fires the moment it ends; an earlier one is ignored.
- Only the first five treats are ever dropped, weighted 34/26/19/13/8 (peppermint … gingerbread man), rolled from the seeded RNG.

### Physics (`js/sim/game.js`)
- Treats are discs in a 10 × 14 jar (y down, floor at y = 14), gravity 30 units/s², a fixed 1/120 s step.
- Sequential impulses, 10 passes per step, with **speculative contacts**: a pair may close its gap during the step but never pass it, so fast drops don't sink in. An overlap that does happen is pushed apart by a small velocity bias (10 % of the overlap a step, at most 1.2 units/s) and by 6 position passes that move bodies but never add speed.
- Coulomb friction (μ 0.4) at the contact point turns the discs, so treats roll and tumble; mass ∝ r^1.5 (see Balance notes), moment of inertia of a solid disc.
- Linear and angular damping keep a pile from jittering: a heap left alone comes to rest (simtest checks it).

### Merging
- After the physics, two treats of the same kind within 0.03 units of touching merge into the next treat at their midpoint, with their average velocity and a small upward pop. Each treat merges at most once a step.
- The new treat starts at its parents' size and swells to its own over 0.14 s, shoving its neighbours aside by position only.
- It is checked again on the next step: **cascades** happen on their own.
- Two **Jingle Bells** make a **Christmas Miracle**: both vanish, +120.

### Scoring
| Made | Points | | Made | Points |
|---|---|---|---|---|
| Gumdrop | 1 | | Ornament | 21 |
| Lollipop | 3 | | Present | 28 |
| Truffle | 6 | | Snow Globe | 36 |
| Gingerbread Man | 10 | | Gingerbread House | 45 |
| Holly Wreath | 15 | | Jingle Bell | 55 |

Merges within 0.75 s of each other build a **chain**; a merge at chain *n* scores an extra ⌊points × (n − 1) / 2⌋. The best score and the biggest treat ever made are kept.

### The line
A treat older than 1 s (so not one still falling) with its top above y = 2.6 fills the danger timer; with nothing over the line it drains twice as fast. At 3 s the jar is full and the game ends. The line pulses and the screen edges glow red while the timer runs.

## Content: the ladder

| # | Treat | Radius | Look |
|---|---|---|---|
| 0 | Peppermint | 0.34 | Red-and-white swirl |
| 1 | Gumdrop | 0.47 | Green sugared dome |
| 2 | Lollipop | 0.62 | Pink with a white, yellow and teal spiral |
| 3 | Truffle | 0.74 | Chocolate, white drizzle, sprinkles |
| 4 | Gingerbread Man | 0.92 | Iced cookie with gumdrop buttons |
| 5 | Holly Wreath | 1.10 | Leaves, berries and a red bow |
| 6 | Ornament | 1.30 | Red glass bauble, gold band, gold cap |
| 7 | Present | 1.52 | Blue paper, gold ribbon and bow |
| 8 | Snow Globe | 1.76 | A tree and a cabin in falling snow |
| 9 | Gingerbread House | 2.02 | Iced roof, candy-cane corners, lit windows |
| 10 | Jingle Bell | 2.34 | Gold with holly and berries |

## Controls

| Action | Mouse | Touch | Keyboard | Gamepad |
|---|---|---|---|---|
| Aim | Hover over the jar | Drag anywhere | ← → / A D | Stick / d-pad |
| Drop | Click | Lift the finger | Space / ↓ / S / Z | A |
| Pause | ❚❚ | ❚❚ | P / Esc | Start |

A finger can go down anywhere on the screen; only its x matters, so it never hides the treat it is aiming.

## Look and sound

- **Look:** a snowy night: a starry gradient sky, a moon, two snowy hills with pines and a lit cabin window (baked once per size), falling snow, and a string of twinkling lights across the top. The jar is translucent glass with shine streaks and a red bow; the line is candy-cane striped; the hook is a candy cane. Treats are drawn in code (`js/view/items.js`), baked into one sprite per size and rotated with `drawImage`. Merges burst into sparkles in the treat's colour, a ring and a floating score; big merges shake the jar; a miracle flashes gold. The merge ladder sits beside the jar in landscape and under it in portrait, lighting up as you make each treat.
- **Sound:** all Web Audio. A soft drop, thumps on hard landings, a pop plus a bell note that climbs with the treat on each merge, sleigh bells on big merges and a chord of bells on a miracle. **Music:** a music box (sine bells with inharmonic partials through a generated reverb) playing *Jingle Bells* (1857) and *We Wish You a Merry Christmas* (traditional), both public domain, with a bell bass and sleigh bells on the beat, scheduled with a look-ahead clock.
- **Title:** the bot plays a demo game behind the menu, silently.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title demo, play, over), the fixed-step loop, input routing, saves, debug hooks |
| `js/config.js` | Jar, physics, drop, danger and merge tuning; the ladder |
| `js/rng.js` | Seeded mulberry32 with weighted picks; a stateless hash |
| `js/sim/game.js` | Pure simulation: dropper, disc physics, merging, scoring, the line, serialize/deserialize |
| `js/sim/bot.js` | Auto-player: tries 29 positions and scores where the treat lands |
| `js/view/view.js` | Canvas 2D: layout, background, jar, dropper and guide, treats, particles, the ladder |
| `js/view/items.js` | The eleven treats drawn in code; `paintIcon` for DOM canvases |
| `js/ui.js` | DOM screens, HUD, toasts, settings |
| `js/input.js` | Keyboard, gamepad, mouse and touch → `{ dx, aimClient, drop }` and a press queue |
| `js/audio.js` | Effects and the music box |
| `js/save.js` | Guarded localStorage: game, settings, best score |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule (aiming, dropping, the buffered press, merging, cascades, chains, the miracle, the line), that a heap comes to rest without sinking into itself and that rolling treats turn the right way, determinism and save round trips, then has the bot play whole games at two skills with per-step invariants and prints the balance table. `browsertest.mjs` drives the real game with real keys, a real mouse and real CDP touches on desktop, touch-only phones in both orientations, and with storage blocked. `treats.html` is a gallery of every treat on a neutral and a dark background.

## Balance notes

From `SEEDS=8 node dev/simtest.mjs` (the bot drops every half second, much faster than a person):

| Bot | Score | Drops | Biggest treat (avg) | Game length (sim) |
|---|---|---|---|---|
| Careful (skill 1) | ~6,500 | ~370 | Gingerbread House (9.0) | ~3 min |
| Careless (skill 0.5, half its drops random) | ~3,800 | ~250 | Snow Globe (7.9) | ~2 min |

- The jar is a little roomier than Suika's (the Jingle Bell is 47 % of the jar's width), so even careless play reaches ornaments and presents: this is meant to be a light game. The careful bot made a Jingle Bell in one game of eight and has never made a miracle, so the top of the ladder is a real goal.
- **Mass ∝ r²** let a pile press small treats deep into big ones: a peppermint in a bottom corner under a present stayed 0.12 units inside it for 40 seconds. Mass ∝ r^1.5 and a gentle velocity bias for overlaps fixed it; the simtest now samples overlap as a share of the smaller treat's radius and fails if it is over 25 % in more than 2 % of samples.
- Treating a body against a wall as immovable in the position pass (so its neighbour takes the whole push) made overlaps far *worse* (from 15 to 12,000 deep samples), and was taken out.
- The chain bonus roughly doubles a careful player's score; it rewards setting up cascades, which is the skill this genre is about.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and the harness Chromium is not a phone.
- Maybe: a "hold" slot to swap the current treat, daily seeds, a shake button that nudges the jar once a game.

## Changelog

### v1.0.0 (2026-10-14)
- First release: eleven procedural treats from peppermint to Jingle Bell; disc physics with rolling and friction; merges that cascade; chains; the Christmas Miracle; the line with a warning; a buffered drop press; mouse, touch, keyboard and gamepad; a bot-played demo behind the title; saves, Continue and best score; a music box playing two public-domain carols; `dev/simtest.mjs`, `dev/browsertest.mjs`, `dev/play.mjs` and a treat gallery.
