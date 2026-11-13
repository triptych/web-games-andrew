# UFOops!

**Genre:** Arcade abduction action (side view), eight episodes and a boss
**Engine:** Vanilla JS: Canvas 2D. Art painted with fal, music, effects and voices by ElevenLabs, with code-drawn and synthesised fallbacks.
**Status:** v1.0.0 released

---

## Concept

A casual, cartoony 2D game styled like a 1980s Saturday-morning TV cartoon. You are Zib, a little green one-eyed alien flying a slightly defective Model 7-B saucer (one dent, one duct-tape patch, an antenna that won't stay straight). Fly around the countryside beaming up cows, chickens, pigs, sheep and the odd farmer, carry them up to the Mother Ship, and get graded on a report card by Mother herself: a doting, bossy alien matriarch with a purple beehive and pink cat-eye glasses.

The countryside fights back: shotgun farmers, agents in black suits whose sunglasses bounce the beam, tinfoil-hat conspiracy nuts whose hats zap it back and whose flash cameras dazzle you, army tanks, laser batteries, fighter jets and, at the end, General Grumbles in the Buzzkill 9000, a tank the size of a barn.

Riffs on the abduction games of the arcade era, Defender-style horizontal sweeps and the "report card between levels" of 80s and 90s licensed cartoon games. No real show, characters or art are copied; every character is original.

## Core loop

One **episode**:

1. **Episode card.** Title, Mother's briefing (spoken), quota, her special order, the clock. The clock waits.
2. **Play.** Beam up walkers into the hold (4 slots, more with upgrades). Fly up under the Mother Ship to bank them. Bonk enemies with dropped specimens, dodge everything else, grab pickups.
3. **Dock.** Once the quota is banked, hover under Mother for 1.4 s. Or keep grabbing extras until the clock gets close. At the buzzer Mother hauls you up with whatever you carry.
4. **Report card.** Quota, variety, special order, extras, dents, time bonus. A grade from D to A+ (F if the quota was missed), with Mother's spoken verdict. Pick one of three repairs from her workshop.

Eight episodes; the eighth is the boss. Run out of saucers and the show is CANCELLED!, with an arcade Continue (score halves) that replays the episode.

## Mechanics

All rules live in `js/sim/` and each has a test in `dev/simtest.mjs` (section `rules`).

### The saucer
- Floaty flight: velocity chases the stick (`UFO.speed` 10 u/s). Diagonals are no faster. Kept inside the level and between `CEIL` and `FLOOR`.
- Slower while beaming (×0.62), when tangled in a net (×0.45) and by 5% for each specimen aboard. Turbo ×1.5; Turbo Thrusters +10% per level.
- **Hull** pips (3, up to 6). A hit costs a pip, knocks the last specimen loose, adds a **defect** and gives 1.6 s of blinking. The last pip crashes the saucer: a life is lost, the hold spills, a spare arrives 2.2 s later. Hull and defects are repaired between episodes.
- **Defects** (0–3) make the saucer glitch: every second, a `0.012 + 0.075 × defects` chance of a **sputter** (the engine cuts out and you sink), a **hiccup** (a hop in a random direction) or a **honk** (the beam cuts out). Duct Tape clears them; Factory Recall halves the rate.

### The beam
- A cone under the saucer, wider towards the ground (`BEAM.top + depth × BEAM.spread`). Held, not toggled.
- Lifts walkers at `BEAM.lift / weight` and pulls them under the saucer; a walker that leaves the cone, or is let go, falls and lands (dazed if from high up).
- Caught when it reaches the saucer, if the hold has room; otherwise it hangs under the saucer.
- Energy 0–100: drains 20/s while on, recharges 28/s off. At 0 it overheats and locks until it is back to 35.
- Agents deflect it; tinfoil hats backfire (a hit after 0.45 s in the cone); tanks, lasers and the boss are too heavy.

### Dropping
- The drop button lets the last specimen fall. Landing on an enemy's head: a human enemy is **bonked** (stunned 5 s, and now beamable, worth 250–400 when banked; HQ sends a replacement 14 s later); a tank or laser battery is **wrecked** (300, back in 16 s); the boss loses a hit point. The specimen bounces off unharmed and can be beamed again.

### Enemies
| Enemy | Moves | Attack | Notes |
|---|---|---|---|
| Shotgun Farmer | patrols | 3-pellet spread, 0.75 s wind-up, reach 7 | beamable when bonked |
| Agent in Black | walks under you | one net: slows you and jams the beam for 2.6 s | beam bounces off; beamable when bonked |
| Tinfoil Hat Dude | follows you | camera flash within 4.4: controls reversed for 2.4 s | beam backfires; beamable when bonked |
| Army Tank | patrols | aimed shell | too heavy; a drop wrecks it |
| Laser Battery | still | marks your column for 1.15 s, then fires up it | too heavy; a drop wrecks it |
| Fighter jet | flies across | a lane announced 1.4 s ahead | episodes 6–8 |
| Buzzkill 9000 | follows you | 3-shell spreads, and every third attack a laser | 6 hit points, only drops hurt it |

### Pickups
Every 8–13 s a bubble floats somewhere near you for 11 s: Spare Part (+1 hull), Duct Tape (no defects), Turbo, Mega Beam (wider and faster), Force Field (6 s of nothing hurts), Overtime (+15 s), Gold Star (+500).

### The report card
`gradeFor` in `js/sim/game.js`: start at 1 point; +2 for no hits, +1 for two or fewer; +2 for four kinds banked, +1 for three; +1 for the special order; +1 per two extras over the quota (up to 2). 7+ is A+, 5–6 A, 4 B, 2–3 C, else D. The finale scores the win (+2) and the time left instead of variety. Grade bonuses: D 100 … A+ 1600. Time bonus 10 per second left; extras 50 each.

### Upgrades (one of three offered per report card)
Reinforced Hull (+1 pip, ×3), Roomier Hold (+1 slot, ×4), Wide-Angle Beam (+20%, ×3), Turbo Thrusters (+10% speed, ×3), Coolant Coil (−25% drain, ×2), Extended Warranty (+1 life, ×2), Factory Recall (glitches halved, ×1).

## Content

| # | Episode | Theme | Quota | Order | New |
|---|---|---|---|---|---|
| 1 | Moo-ving Day | farm | 5 | Cow | shotgun farmer |
| 2 | Pig Out! | farm | 7 | Pig | tinfoil hat |
| 3 | Night of the Living Barn | night | 8 | Farmer | agents |
| 4 | Corn-fused | corn | 9 | Sheep | golden cow (rare, 500) |
| 5 | Small Town, Big Trouble | town | 10 | Townie | tank |
| 6 | Army Surplus | base | 10 | Golden Cow | laser battery, jets |
| 7 | Hangar Zero | desert | 12 | Agent | everything |
| 8 | Mother Knows Best | finale | boss | — | the Buzzkill 9000 |

Walkers: cow 100, chicken 50, pig 80, sheep 80, farmer 150, townie 150, golden cow 500. Farmers, townies and golden cows run from the beam.

## Story

Zib is on his first solo collecting trip and Mother is on the radio the whole time. She briefs each episode, cheers a full hold, sighs at every crash ("That's coming out of your allowance") and grades every episode. At the end General Grumbles builds a tank the size of a barn; six cows from a great height later, Zib flies home for supper. "That's all, folks! See you next Saturday!"

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Fly | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Beam (hold) | Space / Z | A / RT | BEAM |
| Drop | X / C / Shift | B / X / LT | DROP |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Art** (`art/`, 1.1 MB of WebP): 17 sprites, 7 painted backdrops, 7 pickup icons and three portraits of Mother (pleased, delighted, stern), painted with fal `nano-banana-2` to one shared "1980s Saturday-morning cartoon cel" style prompt and cut out of a key colour by `dev/art/export.py`. See `dev/art/README.md`.
- Backdrops scroll at 0.35 parallax and are tiled mirror-image so the joins are seamless; the walkers' ground strip is drawn in code over the painting's own ground line.
- Everything still has a code-drawn version (`js/view/sprites.js`, `js/view/scenery.js`) drawn until the painting arrives, or if it never does.
- Comic pop-up words (BONK!, KA-BLAM!, MOO!), particles, screen shake, a sunburst on the episode cards, a red rubber-stamp grade, "Commercial Break!" for the pause screen and optional TV scanlines.
- **Sound** (`audio/`, 3.8 MB): four music tracks, 27 effects and 47 voice lines from ElevenLabs (see `dev/audio/README.md`). Mother speaks every briefing, verdict and radio call; Zib yelps; General Grumbles taunts. Anything that fails to load falls back to the Web Audio synth (a chiptune sequencer, synthesised effects and Mother's cartoon gibberish).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the attract demo, screens following the sim's phase, the fixed-step loop, input routing, debug hooks |
| `js/sim/game.js` | Phases (brief, play, report, over, won), the saucer, banking and docking, grades, upgrades, continue, save |
| `js/sim/world.js` | Level setup and spawning |
| `js/sim/actors.js` | The beam, walkers, enemies, shots, jets, pickups, getting hurt |
| `js/sim/bot.js` | The auto-pilot (tests, balance, attract mode) |
| `js/sim/data.js` | Walkers, enemies, pickups, upgrades, episodes, Mother's lines |
| `js/view/view.js`, `art.js`, `sprites.js`, `scenery.js` | Camera, painted art with code-drawn fallbacks, effects |
| `js/ui.js` | HUD, Mother's speech bubble, episode card, report card, settings, touch deck |
| `js/audio.js`, `js/voicelines.js` | Recorded music, effects and voices with a synth fallback; line text → voice file |
| `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, 96 rules, the episode data, determinism and save round trips, and has the bot play whole games at three skill levels. `browsertest.mjs` drives the real page on desktop, two touch-only phones and with storage blocked, and checks every painting and sound file loads.

## Balance notes

The bot found the first big problem: shotgun pellets at 13 u/s with a 0.45 s wind-up could not be dodged at all, so the *perfect* bot lost more often than a sloppy one (it hovered steadily in range). Pellets went to 10 u/s with a 0.9 s range, the wind-up to 0.75 s, and the reach became a distance (7) rather than a horizontal band; the bot learned to back off during a wind-up.

Current table (8 seeds per skill, `node game-134/dev/simtest.mjs`):

| Skill | Finishes the game | Avg. episode reached | Avg. score | Minutes |
|---|---|---|---|---|
| 1 (perfect) | 88% | 7.8 | 28,500 | 8.5 |
| 0.6 | 63% | 7.0 | 19,700 | 5.1 |
| 0.3 | 0% | 5.5 | 11,700 | 3.6 |

Bands asserted in the simtest: the perfect bot finishes at least 75% of seeds, the weak bot less often, and still reaches episode 3 on average. Continue (half score) lets any player see the end.

## Open questions / next steps

- A human pass on real hardware: balance was tuned by a bot, and the game has only run under headless Chromium.
- Walkers have one painted pose each; a walk cycle or a lifted pose would add life.

## Changelog

### v1.0.0 (2026-11-13)
- First release: eight episodes and a boss, the beam, the hold and banking, drops and bonks, seven enemies, seven pickups, glitches, report cards with grades and upgrades, continues.
- Painted art (fal) and recorded music, effects and voices (ElevenLabs), with code-made fallbacks.
- Sim test (purity, rules, data, determinism, bot balance) and browser test (desktop, phones, blocked storage, art and sound loading).
