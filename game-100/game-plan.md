# Glitterball Groove

**Genre:** Real-time match-3 arcade puzzle
**Engine:** three.js r165, no asset files (everything is built in code: geometry, shaders, sound, the font)
**Status:** v1.0.0 in progress

---

## Concept

A 70s disco party in a match-3. Swap neighbouring tokens on a glowing 8×8 dance floor, chain combos before the beat drops, fill the groove meter and hit **Disco Fever**. A giant mirrorball turns over the board, spotlights sweep the wall, a chasing dance floor runs away from you, and a funky band plays along on a look-ahead sequencer that the whole picture pulses to. The twist is the frame: the game is a *console*. The whole picture (the board, the HUD, every menu) is drawn onto one low-res canvas inside a WebGL CRT tube, so it bends, glows and scan-lines together, and it opens with a power screen, a BIOS boot and an arcade attract loop (logo, demo play, the Hall of Fame, how to play) before you ever see a menu.

It riffs on Bejeweled Blitz (real-time, special gems, the speed streak), Candy Crush (stripes and bombs by shape) and an Atari-era attract mode with three-letter initials.

## Core loop

Power on → boot pre-roll → attract loop (press anything) → menu → pick a floor → 3-2-1 → play until the clock or the moves run out → game over → initials if the score made the table → Hall of Fame → menu.

A game, in Dance-Off: 60 seconds. You swap, tokens clear, new ones fall in from above, and *you can keep swapping while they fall*. Every special you make, every level you pass and every Fever adds seconds. The clock only runs out if you stop making things happen.

## Mechanics

### The board
8×8 cells, row 0 on top. Six token colours (five on levels 1–2, six from level 3): a **record** (magenta), a **mirrorball** (cyan), a **star** (gold), a **heart** (orange), a **daisy** (lime), a **gem** (violet). Each has its own silhouette, so colour is never the only cue.

A token is *settled* when it is idle and at rest in its cell. Only settled tokens match, and only settled neighbours can be swapped. Everything else (falling, sliding, clearing) is the sim animating itself on the fixed step: a token carries a visual offset (`ox`, `oy`, in cells) that shrinks to zero, and falls with `TIMING.gravity` rows/s², so the player can act on one column while another is still dropping.

### Swapping
Two settled neighbours trade places over `TIMING.swap` (0.11 s). A swap is **legal** if it makes a match, or if it involves a Glitterball, or if both tokens are specials. An illegal swap nudges both tokens towards each other and back (`bounce`, 0.2 s), costs nothing and sets no clock. A swap asked for while its tokens are still busy is **held for 0.4 s** (`queued`) and runs the moment they settle, so a fast hand is never punished by the animation.

### Matches and what they make
All runs of three or more are found each step; runs that share a cell are one **shape**.
| Shape | Makes | Where |
|---|---|---|
| 3 in a line | nothing | |
| 4 in a line | **Funk Beam**, clears its whole row (or column, matching the line) when it goes off | on the swapped token, else the middle |
| L, T or + (a horizontal and a vertical run crossing) | **Boom Box**, clears 3×3 | on the swapped token, else the crossing |
| 5 or more in a line | **Glitterball** (a wild: matches nothing itself) | on the swapped token, else the middle |

A special keeps its colour (the Glitterball has none), so it matches again like any token; when it is cleared, by a match or by another special's blast, it goes off, and anything it hits that is also special goes off in turn, after a short `chainLag`. Beams sweep along their line at `beamStep` seconds per cell.

### Glitterball and combinations
- **Glitterball + a plain token:** clears every token of that colour, nearest first.
- **Glitterball + Glitterball:** clears the whole board.
- **Glitterball + beam or bomb:** every token of that colour becomes that special (beams alternate row and column) and they all go off.
- **Beam + beam:** a cross. **Bomb + bomb:** 5×5. **Bomb + beam:** a fat cross three lines wide.

### Score, combo, Fever
- A token is worth 10. A wave pays `(tokens × 10 + special bonuses + shape bonus) × multiplier`.
- **Combo** counts match waves landed within 1.6 s of each other (cascades and fast swaps both count). The multiplier is `1 + 0.5 × (combo − 1)`, capped at combo 12 (×6.5). The groove shouts for it: GROOVY, FUNKY, RIGHT ON, FAR OUT…
- **Groove meter:** each cleared token adds 1.1%, specials 4%, a combo of 3+ a little more. At 100% **Disco Fever** starts for 8 s: **×2 score**, the meter drains as the clock runs, the board and the whole room go rainbow, the band modulates up a tone, and a random token turns into a special every 1.3 s.
- **Levels:** `10000 × n(n+1)/2` points to reach level n+1. Each level changes the room (Sunset Strip, Purple Haze, Avocado Lounge, Cosmic Cyan, Hot Tub Funk), hands out time or moves, and from level 3 adds the sixth colour. Time bonuses shrink 10% per level (to a floor of 30%), so very long runs do end.

### Modes
- **Dance-Off:** 60 s, +1 s for a beam, +2 a Boom Box, +3 a Glitterball, +3 starting Fever, +3 a level.
- **Slow Jam:** 30 moves and no clock; a Boom Box, a Glitterball, Fever and a level each hand out 1–3 moves. A refused swap costs no move.

In both, when time or moves run out the board is allowed to finish what it started (up to 9 s) and every point it pays still counts.

### Shuffles
When the board is calm and no swap would work, it deals the colours again (specials stay) until there is a move and no ready-made match, and the tokens spin as it does.

## Controls

| Action | Keyboard | Gamepad | Mouse | Touch |
|---|---|---|---|---|
| Select / swap | Arrows move the cursor; **Space** grabs, then an arrow swaps | D-pad, A, then D-pad | Drag a token towards a neighbour, or click two | Same |
| Hint | **H** | | | Shown after 4.5 s idle |
| Pause | **P** / **Esc** | Start | The ❚❚ button | Same |
| Menus | Up / Down / Enter, Left / Right on settings | D-pad, A, B | Click | Tap; sliders drag |
| Initials | Type letters; Enter | | Click the pad | Tap the pad |

A press is never merged or lost: key presses go into a FIFO of which the game takes one per frame; swap commands wait for the next sim step.

## Look and sound

### The picture
One composer: **RenderPass** (the party) → **RenderPass** (the UI canvas, as a texture, over it) → NaN sanitiser → **UnrealBloom** → **CRT tube** → **OutputPass** (Khronos neutral tone mapping). The tube is our own pass: barrel curvature (less on a tall phone), a hint of chromatic aberration, scanlines locked to the UI's pixel rows, an aperture-grille mask, a vignette, a rolling hum bar, row-tearing glitches on big moments, and a power-on collapse. Pointers are mapped back through the same bend (`crtBend`) before they reach the board or a menu, and a browser test fails if the two disagree.

- **Sky shader:** a sunburst of palette bands and rays, a sun disc, mirrorball light spots rotating over the wall, and a perspective dance floor of chasing tiles with a glowing horizon. The room palette cross-fades on a level change.
- **The mirrorball:** ~850 instanced chrome tiles, a dark core, 90 twinkling glints that only show on the camera side, a cord. It hangs behind the logo in menus and behind the glass tiles during play.
- **Spotlights:** six additive cone beams that sweep faster in Fever, tinted from the room.
- **The board:** dark glass tiles with four glowing edge bars each that pulse in a wave to the beat, flash the cleared token's colour, and go rainbow in Fever; a chrome and neon frame; 72 marquee bulbs chasing round it; the tile bars and bulbs run under 3 Hz so nothing strobes.
- **Tokens:** vertex-coloured body + unlit glow mesh each, spinning, swaying, pulsing on the beat, squashing on landing. Chrome ones reflect a purpose-built environment of coloured panels. Specials get white arrows (beams), orbiting rings and spikes (bombs), or a rainbow-faceted ball with a halo.
- **Effects:** a pooled GPU point sprite system with glint stars (1,800), expanding rings, lasers, lightning bolts and confetti. Colours go past 1.0 so bloom picks the hot parts.
- **Dancers:** a white-suit pointer and an afro in a magenta jumpsuit, built from capsules and cones, dance on the band's beat beside the logo and menus in landscape.
- **The UI canvas:** a whole number of CSS pixels per UI pixel (never fewer than 2), a baked 5×7 pixel font, panels with neon edges, a wavy rainbow logo, pixel icons for the tokens.

### The band
A 25 ms timer schedules every 16th note that falls in the next 120 ms on the audio clock. Four-on-the-floor kick, claps on 2 and 4, open hats on the off-beats, an octave-bouncing bass with ghost notes, a wah-guitar chop, electric-piano stabs, a string pad, a plucked string run on the fourth bar and a brass riff, over Am7 | Dm7 | G7 | Cmaj7 at 118 BPM. Bass and strings duck on every kick (the side-chain pump). Layers come in with intensity (menu: kick, hats, bass, piano; play: + claps, guitar, strings; combo 4+ or Fever: + brass and the run). Fever modulates up two semitones. `beat()` hands the view the band's position: the floor, the tiles, the ball and the tokens all pulse on the kick.

Effects: a swap tick, a refused-swap buzz, landing thuds, noise pops per cleared token, FM bells that climb a pentatonic scale with the combo, laser zaps, a boom, a glitter arpeggio, riser + brass for Fever, fanfares, a sad trombone, countdown beeps, a coin, and a CRT power-on whine.

### The pre-roll
1. **Power:** a console that is off, a red LED, "PRESS ANY KEY TO POWER ON". (This is also the first gesture, so audio starts here.)
2. **Boot:** the tube collapses open, a typed BIOS check of fake hardware, a loading bar, the logo arrives with a brass sting.
3. **Attract loop:** the logo and PRESS START (with the arcade 1UP / HI-SCORE header), **demo play** (a bot plays a real game on the real board), the **Hall of Fame** for each mode (rows slide in one at a time), and **how to play**; any press goes to the menu. The menu returns to the loop after 40 s idle.

### High scores
Eight entries per mode, kept in localStorage, pre-filled with a house band so the table is never empty. A score that makes the table opens an arcade initials entry: type three letters, or up, down and Enter, or tap the on-screen pad.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the screen machine, the fixed-step loop, key and pointer routing, hints, debug hooks |
| `js/config.js` | Tuning (shared with the tests): board size, timings, score, Fever, modes, levels, rooms |
| `js/sim/game.js` | The pure real-time board: tokens, gravity, swaps, shapes, specials and combos, combo, Fever, levels, shuffles, save/load |
| `js/sim/bot.js` | An auto-player (skill-dialled) for the tests and the attract demo |
| `js/view/stage.js` | Renderer, post chain, the CRT shader, camera framing from the UI layout, picking through the bend |
| `js/view/backdrop.js` | Sky shader, mirrorball, glints, beams, lights |
| `js/view/board3d.js` | Tiles, frame, marquee, tokens following the sim, cursor and hint rings, events → effects |
| `js/view/tokens.js` | Token geometry and materials |
| `js/view/fx.js` | Particles, rings, lasers, bolts, confetti |
| `js/view/dancers.js` | The two dancers |
| `js/ui/ui.js` | Every screen, menus, HUD, entry, hit rectangles |
| `js/ui/gfx.js`, `js/ui/font.js` | Canvas drawing helpers, pixel icons, the 5×7 font |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js` | Key/pointer/pad queues, the band and effects, guarded storage + scores, seeded RNG |

The sim imports nothing from the view, UI, audio or input; `simtest.mjs` greps for that.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every shape, special and combination, the combo, Fever, levels, the clock and the moves, held swaps, shuffles, determinism and save round trips, and has a bot play whole games of both modes on many seeds with per-step invariants. `browsertest.mjs` drives the real game: desktop with real keys and mouse (including a drag and two clicks mapped back through the CRT bend), through the whole flow to a high score typed on the keyboard; touch-only phones in both orientations with real touches; blocked storage; and it fails on any console error.

## Balance notes

The first bot run never lost: time bonuses outpaced the clock (a bot that makes a special every ~8 swaps and levels up every ~20 s earned a second per second). Specials now give 1/2/3 s (beam/bomb/Glitterball), Fever 3, a level 3, a level's bonuses shrink 10% per level, and the "+1 s every fourth combo" bonus was dropped entirely (sustained combos made it infinite). Fever's meter per token went from 1.7% to 1.1% (38 Fevers in 400 s was a Fever every 10 s). The combo window went from 2.4 s to 1.6 s so a slow hand loses the streak. The level line went from 2,500 to 10,000 points because the bots reached level 20+. Today a quick bot lasts ~3 minutes in Dance-Off and a slower one ~2, Fever comes about every 20–30 s, and the scores land in the tens to hundreds of thousands (the house band's table is set against that). Slow Jam is relaxed by design: a better bot isn't much better off, since the moves are the limit and cascades dominate.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, SwiftShader is not a GPU (frame rate, bloom and CRT cost on a low-end phone are unmeasured), and nobody has heard the band.
- The Low quality setting drops MSAA and bloom; a Medium tier is unproven.
- Dancers only appear in landscape; portrait has the room for them below the menu.

## Changelog

### v1.0.0 (2026-10-26)
- First release: real-time match-3 sim with beams, Boom Boxes, Glitterballs and their combinations, combo, Fever, levels and rooms; Dance-Off and Slow Jam; three.js party scene with a CRT tube; power screen, boot, attract loop, Hall of Fame with initials entry; a procedural disco band; desktop, touch and gamepad controls; sim and browser harnesses.
