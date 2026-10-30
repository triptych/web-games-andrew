# STARBLAZER '86

**Genre:** Vertical arcade shooter (a shmup in the manner of Galaga, 1942 and Raiden)
**Engine:** Vanilla JS: Canvas 2D, no asset files
**Status:** v1.3.0 complete (balance is bot-derived; see Open questions)

---

## Concept

An 8-bit space shooter as a 1986 console cabinet would have shipped it: a 224×288 pixel screen, a fighter you steer with a thumb and a stream of shots, and waves of enemies that get stranger and meaner the longer you last. The point of the game is *feel*: a Galaga grid that sways and dives at you, a boss that fills the screen with bullets and then comes apart in a rainbow chain of explosions, medals that ring up in pitch, and a chiptune that picks up speed when the boss arrives.

Tone: loud, bright, a little silly, and fair. Nothing is a surprise: bonus stages announce that nothing shoots, bosses announce themselves with a warning, the death-ray draws a line before it fires.

## Core loop

1. A wave announces itself ("WAVE 6", "BONUS STAGE", "WARNING!") for 2.2 s (3.4 s for a boss) while the sky scrolls.
2. Its enemies arrive on timed orders. Shoot them; dodge what they shoot; grab the capsules and medals that drop.
3. When the sky is empty the wave is clear: a perfect clear (nothing escaped) pays a bonus, the stars race by, and the next wave begins.
4. Lose all your ships and the game is over: enter your initials if the score made the table.

## Mechanics

### The ship
- Moves at 118 px/s (+16 per Speed capsule, up to three) in eight directions on the whole sky below y = 34; diagonals are no faster. The hit box for bullets is a 2.6 px circle, for enemy bodies 4.5 px.
- **Fire** is held (a tap always fires at least once, even if the key goes up before a simulation step). Gap between volleys 0.15 s at level 1 down to 0.12 s at level 5.
- **Weapon levels:** 1 single, 2 twin, 3 triple (centre and two angled), 4 five-way, 5 seven-way with a piercing core (2 damage, goes through up to three enemies). A lost ship costs two levels.
- **Bomb:** a ring that grows from the ship at 420 px/s for 0.85 s. It wipes every enemy bullet it crosses and hurts every enemy it crosses once (30 damage, 45 to a boss) and makes the ship invulnerable for 1.7 s. Two at the start, five at most.
- **Lives:** three, up to seven; an extra life at 20,000 points and every 60,000 after. A ship that dies takes the bullets within 70 px with it and comes back after 1.4 s, invulnerable for 2.6 s.
- **Shield capsule (H):** absorbs one hit.

### The hangar
After every boss the ship flies itself to the mothership (any capsules still falling are scooped up on the way), parks in its hangar and the shop opens. Nothing happens while you shop; **Launch** flies back out into the next wave. A game saved in the hangar comes back to it.

**Credits** are earned from kills (drone 1, weaver 1, striker 2, saucer 4, dart 1, cruiser 10, carrier 20, mine 2; 2 each in a bonus stage), medals (3), a perfect wave (10) or perfect bonus stage (50), and bosses (60 × (round + 1) + 20 × its number).

| Upgrade | Levels | What a level does | Prices |
|---|---|---|---|
| Engines | 5 | +8 ship speed | 40 60 90 130 180 |
| Cannons | 5 | +20% shot damage | 50 75 110 160 220 |
| Rapid Fire | 4 | shoots 7% faster | 45 70 105 150 |
| Bomb Bay | 3 | carry one more bomb (and stocks one) | 60 100 160 |
| Magnet | 3 | bigger pick-up reach, and capsules and medals drift in | 30 55 90 |
| Shield Core | 2 | 1: a shield at the start of each wave. 2: and on respawn | 80 160 |

Upgrades are kept when a ship is lost. **Supplies:** an extra ship (150, not past 7 lives), a bomb (50), a weapon refit (100, the gun back to level 5).

### Power-ups
Capsules fall slowly and are lost off the bottom. **P** power (a gun level), **S** speed, **B** bomb, **H** shield, **1** a life (from the second round of bosses on), **M** a medal. Past a maximum a capsule is worth points instead (P 1000, the others 500). Enemies that blink with a coloured halo carry a capsule of that colour; any kill has a small chance to drop one and a bigger one to drop a medal. Medals are worth 100, 200 ... 1000 in turn as you collect them and start again from 100 when you die.

### Score and chains
Each kill within 1.5 s of the last raises the chain; every six kills in a row add one to the multiplier (x1 to x5). Bonus-stage kills are a flat 200. A perfect normal wave pays 500 × the wave number; a perfect bonus stage pays 10,000 and a bomb. A boss pays 5000 × (round + 1) + 2500 × its number.

### Enemies

| Kind | Health | Score | Moves | Fires (from wave) |
|---|---|---|---|---|
| Drone | 1, +1 per 10 waves | 100 | Bézier swoops, V waves, bonus stages | an aimed shot (2) |
| Weaver | 1, +1 per 10 | 120 | pincers from both edges | straight down (2) |
| Striker | 1, +1 per 6 | 150 | the Galaga grid: flies in, sways, dives at you, wraps round and returns | aimed shots (3) |
| Saucer | 10, +2 per 3 | 300 | strafes the full width | two aimed shots (6) |
| Dart | 1 | 150 | steers a little toward you, then runs straight | none |
| Cruiser | 90, +15 per 3 | 800 | hangs and drifts for 17 s; carries a capsule | a three-way fan (8) |
| Carrier | 160, +25 per 3 | 1500 | hangs and drifts; launches drones every 2.6 s | a pair of straight shots (11) |
| Mine | 3, +1 per 8 | 200 | drifts down | bursts into a ring of eight bullets when destroyed |
| March | (drones or strikers) | | a 3×6 block that ping-pongs across the sky and drops a row at each edge; only the front rank fires | |

Fire rate scales with the wave (gaps divide by 1 + 0.075 × wave) and so does bullet speed (up to +85%). At most 90 enemy bullets exist at once.

### Waves
A wave is a few **pieces**, each a list of timed spawn orders, drawn by weight from those unlocked: lines (1), V and pincer (2), the Galaga grid (3), saucers and the march (6), darts (7), cruisers (8), carriers (11), mines (12). The first wave to use a piece is built around it. Two pieces up to wave 7, three to 15, four to 25, five after. At most one *heavy* piece (grid, march, cruiser, carrier) a wave until wave 20. Wave 1 has nothing that shoots. Every fourth wave (4, 9, 14 ...) is a **bonus stage**: five groups of eight drones on five different curves, nothing fires. Every fifth (5, 10, 15 ...) is a **boss**.

### Bosses
Each enters untouchable over 3 s, then fights in three phases keyed on its health. A round is all three; each round after the first has 50% more health and fires 20% faster.
- **Mothership (wave 5, 420 HP):** a fan of five aimed shots; from two-thirds down, side cannons stream bullets straight down; from a third down, rings of fourteen with a rotating start and a call for drones.
- **Crab Warden (wave 10, 1100 HP):** cycles every seven seconds between a spiral (three arms, four when hurt), a curtain of twelve bullets with two gaps in it, and aimed bursts from its claws.
- **The Overlord (wave 15, 1700 HP):** cycles between the beam (it drifts over you, draws a flashing line for a second and then fires a column of light for a second), rotating double rings, and a strafe with a rain of bullets from the top.

A dying boss shakes for 2.4 s while explosions go off across its hull, every bullet on screen turns to sparks, and it pays out points, a P, an S, a B and five medals (and a 1UP from the second round on).

## Story

You are a rookie pilot on the carrier **Aurora**, defending the Sol Gate against the **Brood**. **Mira** is the flight controller on the mothership: warm, quick and a little sarcastic, she talks you through your first days. Her voice in the game is a 24×24 pixel bust (a mirrored map for the hair, head and headset, with eyes, brows and mouth drawn on top so she can blink, talk and react).

- **Comms (every wave):** a strip at the top of the screen types out a line as the wave begins, while play goes on. Waves 1-15 have their own lines, which double as a tutorial (blinking halos carry power-ups; formations dive, so keep moving; bonus stages are safe; bombs for emergencies; watch for the beam's warning line); later waves draw on pools of lines for normal waves, bonus stages and returning bosses. She also reacts to losing a ship, a perfect clear, an extra ship and a last life (rationed to one every nine seconds).
- **Cutscenes (blocking, skippable):** `intro` (bridge) at the start of a new game; `boss0`, `boss1`, `boss2` (the observation window, the boss looming) as the first three bosses arrive; `dock0` (hangar bay) after the first boss, which explains the hangar; `finale` (hangar bay) after the Overlord, which promotes you and says the Brood will be back. Play Again skips the intro; Continue skips everything it has seen.
- **Callsign:** Rookie until the first boss falls, then Pilot, Ace, and Starblazer.
- **Quips:** a line from Mira on the game-over sheet (by how far you got) and at the top of the Hangar on ordinary visits.
- **Voice:** with the Announcer voice on, her cutscene lines are spoken in a bright female speech-synthesis voice if the device has one. **Story & comms** in Settings turns the cutscenes, the comm strip and the quips off.
- The script is data ([js/story.js](js/story.js)); the sim does not know about it. The comm and cutscene boxes are sized for the longest line, and simtest fails if a line does not fit.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Floating stick, constant speed (direction only): a touch anywhere that is not a button |
| Fire | Space / Z / J (hold) | A / bumpers (hold) | FIRE (hold), or automatic |
| Bomb | X / B / K / Shift | B / X | BOMB |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Screen:** a 224×288 buffer, drawn with smoothing off, with bloom (the buffer shrunk twice and added back with `lighter`), then an integer upscale and a bilinear step down to the window, scanlines, a vignette and a neon frame (Settings turns the CRT effects off).
- **Sprites:** left halves drawn as character maps, mirrored, auto-outlined, with a white flash twin; four sector colourways re-colour every enemy (sector = five waves: Deep Space, Violet Reach, Emerald Belt, Ember Front). The sky is a dithered gradient with scrolling dithered nebulae and a baked pixel planet.
- **Explosions:** see [fx.js](js/view/fx.js). Fireballs walk down a colour ramp, rings race out, debris cools as it flies; ramps by enemy colour (ice, toxic, gold, plasma, fire) and a rainbow ramp for bombs and bosses.
- **Sound:** pulse waves (12.5/25/50% duty), a triangle bass and noise drums; four sector keys, a boss tune, a bonus tune; a robot announcer (browser speech synthesis, optional) for the bosses. See [docs/generic/sounds.md](../docs/generic/sounds.md).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title demo, play, over), the fixed-step loop, input routing, debug hooks |
| `js/sim/game.js` | The ship, bullets, bombs, power-ups, scoring, lives, the wave cycle, save and load |
| `js/sim/enemies.js` | Enemy types, analytic paths, the formation and dive logic, firing patterns |
| `js/sim/waves.js` | The wave planner and its pieces, the bonus stage |
| `js/sim/bosses.js` | The three bosses, their phases and their deaths |
| `js/sim/bot.js` | The auto-player (dodging, aiming, power-ups, bombs; skill = reaction time; spends credits in the hangar) |
| `js/story.js` | Mira's script: cutscenes, per-wave comms, reactions, quips (plain data) |
| `js/view/portrait.js` | Mira's pixel portrait |
| `js/sim/upgrades.js` | The hangar's upgrade and supply tables, prices and `offer()` |
| `js/sim/util.js`, `js/rng.js`, `js/config.js` | Shared helpers, seeded RNG, tuning |
| `js/view/view.js` | The layers, banners, HUD, bloom and present step |
| `js/view/sprites.js`, `font.js`, `fx.js` | Pixel art, the bitmap font, explosions and the starfield |
| `js/audio.js` | Effects and the chiptune sequencer |
| `js/ui.js`, `js/input.js`, `js/save.js` | Screens and tables, keyboard/gamepad/touch, guarded storage and high scores |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule, 60 planned waves, that waves 1-40 are all clearable, every boss, determinism and saves, and bot games at three skills. `browsertest.mjs` drives the real game on desktop (real keys), two touch-only phones and with storage blocked, and checks that the canvas is really drawing.

## Balance notes

The first bot dodged with perfect information and no reaction time and reached wave 68 without dying at any "skill", so skill became a reaction time (it holds each move for 0.08 s at skill 1 up to 0.5 s at 0.2). The printed table then showed that enemies fired only 0-6 shots a wave: the weapon killed them before their first shot. Health now grows with the wave for every type, the first shot comes within half a gap, and fire rate and bullet speed ramp harder. Current table with the hangar (4 seeds, up to 25 minutes): skill 1 reaches wave ~55 and is still alive at 25 minutes; skill 0.6 dies around wave 27 (it was 16 before the hangar, and 36 before the extra health and fire-rate ramp); skill 0.3 around wave 9. A boss that killed the perfect bot three times on wave 15 turned out to be the bot ignoring the beam's warning line.

## Open questions / next steps

- A human pass on a real phone and with real speakers: the bot is not a person, and the sound has only been tested for errors.
- The wave generator is endless; there is no ending and no continue-credits screen.
- A second weapon family (a laser, homing missiles) and ground targets would give the early waves more variety.
- Two-player alternating turns, as on the cabinets.
- A story that goes on after the finale (new Brood factions per sector).

## Changelog

### v1.3.0 (2026-10-30)
- A story: Mira, the flight controller, introduces every wave in a comm strip, with six cutscenes (the intro, the first three bosses, the hangar tutorial and the finale), reactions, quips, a climbing callsign and a Story setting.

### v1.2.0 (2026-10-30)
- The hangar: after each boss the ship docks with the mothership and spends credits on permanent upgrades (engines, cannons, rapid fire, bomb bay, magnet, shield core) and supplies. Enemies get tougher a little faster from wave 9 to keep pace.

### v1.1.0 (2026-10-30)
- A speech-synthesis announcer for the bosses (a warning as each arrives, a line when it dies), with a Settings switch.

### v1.0.3 (2026-10-30)
- The ring on the ringed planet is no longer clipped at its ends.

### v1.0.2 (2026-10-30)
- The stick is constant speed with a short leash: no rubber band, and a few px of pull-back stops the ship.

### v1.0.1 (2026-10-30)
- A faster ship (118 px/s), a stick that reaches full speed after ~30 px with a small dead zone, and the whole screen as the stick area (the BOMB and FIRE buttons keep their own touches).

### v1.0.0 (2026-10-30)
- First release: the ship, five weapon levels, bombs, shields, medals and chains, nine kinds of enemy, a wave planner with a Galaga grid and a Space-Invaders march, bonus stages, three bosses, explosions, a chiptune soundtrack, an attract demo, high scores with initials, saves, keyboard, gamepad and touch, a calm mode.
