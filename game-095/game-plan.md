# Hauntly Manor

**Genre:** point-and-click mystery adventure (lighthearted, spooky but never scary)
**Engine:** three.js r165, no asset files: every model, texture, icon, face and sound is made in code
**Status:** v1.0.0 in progress

---

## Concept

Halloween night. Four friends, one sleepover, one very old house on Hollow Hill that nobody has entered in a hundred years, and a dare to stay until sunrise. Doors slam, music boxes tinkle, a candle floats, something giggles. Is it a raccoon in the walls, drafty pipes, a prankster... or something else? You search six rooms, solve a handful of cozy puzzles, work out what is haunting the manor, and discover a ghost who is not scary at all. She is Winnie, eleven years old, whose birthday party nobody came to in a storm a hundred and thirty years ago, and who has been waiting for friends ever since. The last act is the party she never had.

It is a game for an afternoon (about 20 to 30 minutes), for anyone old enough to read a diary page: gentle, silly, with no way to die, lose an item or get stuck. It riffs on classic point-and-click adventures (Monkey Island's inventory and hotspots, Scooby-Doo's mystery gang) and on Monument Valley's cut-away dioramas for the look.

## Core loop

Tap things in a room to look at them or pick them up; carry items in a pack; tap an item and then a thing to use it, or tap two items to combine them; read what the friends say; collect clues in the journal; open the next room. The case board turns clues into a deduction; the deduction unlocks the finale.

## The house

| Room | What is in it | Gate |
|---|---|---|
| Grand Foyer (hub) | family portrait (Winnie's age), cold spot, blank card in the clock, candles in a tiny raincoat, the attic hatch, four doors | none |
| Parlor | music box, guest list (number of guests), key hiding places, window, stuffed cat | none |
| Kitchen | floury footprints, calendar (party day), cookie jar (diary page), broom closet, pantry with a 3-number lock, oven, icebox | none |
| Library | diary, the shelf rhyme, five titled books, secret compartment, quill, inkwell, globe, rocking chair | brass key (hidden in the parlor) |
| Attic | sheet music (the melody), trunk, mirror (five reflections), rocking horse, dust-sheet dolls | broom (kitchen) on the hatch |
| Ballroom | long table, pedestal, easel, bare wall, tall windows | the case solved |

## Puzzles (all in [js/sim/world.js](js/sim/world.js))

- **The key**: one of the sofa, the teapot and the fireplace holds the brass key (seeded). The other two give a silly line.
- **The pantry lock**: three single digits, in order: Winnie's age (portrait plate), the day of her party (kitchen calendar), her number of guests (parlor guest list). The cookie-jar diary page says what the three numbers are. All three are in the journal under Codes.
- **The bookshelf**: pull three of five titled books in the order the framed rhyme gives; a wrong pull pops them all back. The seed decides which title sits where and the order. The compartment holds the winding key.
- **The music box**: wind it, then play the four coloured notes on the sheet music in the attic (seeded). It gives the star key and the box itself.
- **The oven**: cake mix goes in; it dings after six seconds (the sim clock). Take the cake out.
- **Combining**: ink + quill → inked quill; inked quill + card → invitation; frosting + plain cake → frosted cake; frosted cake + candles → birthday cake.
- **The case board**: three of five pieces of evidence (cold spot, footprints, giggle, diary, mirror) let you name the culprit. Raccoon, pipes and prankster are each ruled out with the evidence that does it; the lonely ghost is right and opens the ballroom.
- **The party**: cake on the table, streamers on the wall, music box on the pedestal, invitation on the easel, in any order. The fourth one makes Winnie appear.
- **Winnie's talk**: two rounds of three choices (warm, funny, brave). Every choice is kind; the one you say last decides the epilogue.
- **The shy ghosts**: a small Winnie peeks from one of three seeded spots in each room. Finding all six is optional and shows on the ending screen.

Nothing can be lost, consumed in the wrong place or locked out: wrong tries cost nothing. simtest proves a bot finishes from any state random play can reach.

## Story

Winifred "Winnie" Hauntly turned eleven on Halloween 130 years ago. She had planned the whole party (cake, streamers, her mother's lullaby on the music box) and every invited child wrote back to say sorry, the storm. She stood at the window all day. That night she could not seem to go to bed, so she stayed and waited, because someone should be here when friends finally came. She leaves the doors open. She is shy, giggles when startled, and makes the house do small kind things (lamps that turn on, a candle that floats toward the right spot). The four friends:

- **Maya**: the leader. Notebook, writes down the numbers, says the sensible thing.
- **Theo**: the nervous one with a thermometer and a flashlight. Brave at the end.
- **June**: the artist. Frosts the cake, hooks the cord, finds the nice thing in everything.
- **Dev**: the joker. Eats a hundred-year-old crumb. Wants to put a ghost in his backpack.

Three endings by tone (warm, funny, brave), one epilogue each. The game is not endless: it ends with the party and a "Play Again" with a new seed.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Look, take, go | Tap or click a thing | ← → / A D pick a hotspot, Enter / Space taps it | d-pad, A |
| Use an item | Tap it in the pack, then tap a thing | 1 – 9 picks the item | |
| Combine | Tap one pack item, then another | | |
| Read on | Tap the box, or anywhere | Enter / Space | A |
| Journal / map / hint | 📓 🗺️ 💡 | J / M / H | Y |
| Show what can be tapped | ✨ | G | |
| Pause | ❚❚ | Esc / P | Start |

There is no touch deck: a point-and-click game needs only taps. Every control is at least 44 px.

## Look and sound

Each room is a cut-away diorama (no front wall or ceiling) seen from a fixed camera that fits the room to any screen, portrait phones included, and drifts a hair towards the pointer. Palette: moonlit indigo and plum with candle-gold light; each room has its own wallpaper hue, shifted by the seed. Walls, floors, rugs, portraits, book spines, clock face, calendar, sheet music and mirror are canvas textures drawn in code. The four friends are seen from behind, as if you were following them in; the speaker hops. Winnie is a lathe-built sheet whose hem ripples, with big dark eyes and pink cheeks. A flashlight (a point light) follows the pointer; candle lights flicker; dust motes drift; sparkles burst when something is found. Ambient spooks (a candle gutters, a draft, a giggle, a sheet swoops across the wall, a creak) are harmless and cosmetic; calm mode turns them off (and follows prefers-reduced-motion).

Sound is Web Audio only: a look-ahead sequencer plays a creepy-cute waltz in A minor (music box over a plucked bass, with a generated reverb) while you explore, a slower one on the title and a brighter one for the party; wind under everything. Effects: pickups, clue chimes, creaks, the pantry's clunk, the oven's bell, the music-box notes (a pentatonic scale), Winnie's giggle, a fanfare for the case and the ending.

## Module overview

| Path | Responsibility |
|---|---|
| [js/main.js](js/main.js) | Boot, modes, the fixed-step clock, tap and key routing, events, debug hooks |
| [js/sim/game.js](js/sim/game.js) | `newGame(seed)`, `act(G, action)`, `step(G, dt)`, hints, objective, serialize (pure) |
| [js/sim/world.js](js/sim/world.js) | Every hotspot, what a tap and each item does, the locks, the case board, the talk (pure) |
| [js/sim/data.js](js/sim/data.js) | Items, recipes, rooms, clues, suspects, Winnie's talk and the epilogues |
| [js/sim/layout.js](js/sim/layout.js) | The seeded layout: key spot, codes, books, melody, hues, ghost spots |
| [js/sim/plan.js](js/sim/plan.js) | The story as ordered steps with three hints each and the actions that finish them |
| [js/sim/bot.js](js/sim/bot.js) | An auto-player that follows the plan from any state |
| [js/view/stage.js](js/view/stage.js) | Renderer, camera fit, lights, picking, hover, effects that answer events |
| [js/view/rooms.js](js/view/rooms.js) | The six rooms and their hotspot proxies; poses what the rules say each frame |
| [js/view/props.js](js/view/props.js), [props2.js](js/view/props2.js) | Procedural furniture |
| [js/view/kit.js](js/view/kit.js) | Materials, canvas textures, mesh helpers |
| [js/view/characters.js](js/view/characters.js) | The four friends and Winnie |
| [js/view/fx.js](js/view/fx.js), [icons.js](js/view/icons.js) | Sparkles, dust, glints; item icons and faces drawn on canvases |
| [js/ui.js](js/ui.js) | HUD, pack, dialogue, choices, the lock and melody overlays, the journal, screens |
| [js/input.js](js/input.js), [audio.js](js/audio.js), [save.js](js/save.js), [rng.js](js/rng.js), [config.js](js/config.js) | Key queue, sound, guarded storage, seeded RNG, tuning |

## Rules this layout keeps

1. The sim is pure: no DOM, three.js, `Math.random`, clock or storage (simtest greps for it). A tap is an action applied the moment it happens (nothing can be lost or merged); `step` only moves the clock.
2. The view reads `G` and drains `G.events`; it never writes `G`. Models and effects answer events (`give`, `clue`, `room`, `spook`, `place`, `party`...).
3. The canvas is sized in px from `visualViewport`; taps are mapped through its `getBoundingClientRect()`.
4. Storage is guarded; saves carry a version and an unknown one is rejected.
5. Screens opened from other screens get a z-index from the open stack; a press that began outside a screen does not click inside it.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, 600 layouts, every rule, the world's consistency, determinism and save round trips, a bot that plays 24 seeds, the hint walk-through and 48 random games. `browsertest.mjs` plays the real game with a real mouse, keyboard and touches, on the desktop and two touch-only phones, and checks that every hotspot is on screen and uncovered in every room.

## Open questions / next steps

- On a portrait phone the room is small (it is width-limited); landscape is the comfortable shape. The ✨ button sparkles on every hotspot, which is how touch players find things without hover.
- The prose and the jokes have had no human reader but their author, and the puzzles were only played by a bot and a test mouse. A human pass on real hardware (and a real touchscreen) is the biggest thing missing.
- Rooms could take small animated touches on solving (the pantry doors swing; the trunk lid lifts; nothing else moves).
- More diary pages and a second shy-ghost game (find all six on a new seed for a hat on Winnie in the epilogue).

## Changelog

### v1.0.0 (2026-10-23)
- First release: six cut-away rooms, four friends and Winnie, seven puzzles, a case board, a party finale with a talk and three epilogues, procedural music and sound, a bot that finishes every seed.
