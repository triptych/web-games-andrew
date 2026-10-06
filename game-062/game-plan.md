# Kraken's Gambit

**Genre:** Chess variant with sea events (strategy)
**Engine:** three.js r165 (ES modules, import map), no asset files
**Target:** any screen, desktop or phone, mouse, touch or keyboard
**Status:** v1.0.0, complete

---

## Concept

Chess on the high seas. The Royal Navy (white) and the Pirates (black) play real chess with fleets of procedurally modelled, cel-shaded ships on an 8×8 patch of sea framed by a wooden dock. Between moves **the sea plays too**: after any move there's a chance of a sea event, such as the Kraken dragging a ship under, a mermaid luring one away, a storm driving every ship a square downwind, or a whirlpool spinning a ring of them.

The tone is light and playful (bright sky, toon water, ink outlines, a squeezebox shanty), but the chess underneath is exact and the AI is a real alpha-beta searcher. The sea is chaotic, never unfair: it can't break the rules of chess and it never decides a game by itself.

---

## The fleets

| Chess | Piece | Model |
|---|---|---|
| King | **Flagship** | Biggest hull, stern castle with gilded windows, three masts with three tiers of sail, a gold crown with a cross, a royal flag |
| Queen | **Man-o'-War** | Two gun decks with cannon muzzles, three masts, a coronet with ball-tipped points |
| Rook | **Lighthouse** | Striped tower on a rocky islet, gallery and railing, glowing lantern room. A *building*: storms and mermaids can't move it |
| Bishop | **Schooner** | Tall triangular sails set on a reach (so they face the camera), swallowtail pennant |
| Knight | **Longship** | Seahorse figurehead, curled stern, round shields along the rail, striped square sail. It *leaps* when it moves |
| Pawn | **Dinghy** | Rowboat with oars, thwarts, a stubby emblem sail and a stern lantern |

Navy: cream hulls, a blue band, gold trim, white sails with a blue anchor. Pirates: dark hulls, a red band, black sails with a skull and crossbones. All of it is drawn into canvases at load: planks, copper sheathing, gunports, sail cloth, emblems, flags, shields and tower stripes.

---

## Sea events

Rolled after every move once both fleets have left harbour (from the Pirates' first move on). The **sea state** sets the chance: Mirror Calm 0% (plain chess), Calm 12%, Choppy 22%, Tempest 38%. Each event can be switched off in setup.

| Event | Effect | Weight |
|---|---|---|
| 🐙 The Kraken | Drags one non-king piece to Davy Jones' Locker (weighted towards pawns, rarely the queen) | 3 |
| 🧜 Mermaid's Song | One ship drifts to an empty neighbouring square | 3 |
| ⛈️ Storm | Every ship slides one square downwind (N/S/E/W), a column moving as one; lighthouses stand firm; pawns can't run aground on rank 1/8 | 2 |
| 🌀 Whirlpool | The eight squares around a centre rotate one place clockwise (not if a lighthouse is in the ring) | 1.5 |
| 🐬 Dolphins | Push a pawn one square forward, promoting it to a Man-o'-War if it reaches the far shore | 2 |
| 👻 Ghost Ship | Sails along rank 3–6; every ship on it flees one square homeward | 1.5 |
| ⚓ Salvage | Raises a sunk piece back to an empty square in its home ranks | 1.5 |
| 🐉 Sea Serpent | Swaps two non-king pieces of one fleet within three squares | 2 |

**Fairness rules** (`js/sim/seaEvents.js`): every candidate outcome is applied to a copy and rejected if a king is missing, a pawn would sit on rank 1 or 8, the side that just moved would be in check (an illegal position), the side to move would have no legal move (mate or stalemate by the sea), or the material is a dead draw. Up to ten candidates per event type, then the next type by weight, then calm water. Castling rights and en passant are dropped when an event moves the pieces they depend on. An event resets the fifty-move count.

---

## Game loop

1. Title → **Plot Your Voyage**: vs Computer or Two Captains (hotseat), fleet, enemy captain (5 levels), sea state, events.
2. Tap a ship: legal squares glow on the water (dots for moves, red rings for captures). Tap a target to sail.
3. Captures fire a cannon: muzzle flash, smoke, a cannonball arc, a splash, the victim heels over and sinks with bubbles.
4. The sea may act: a banner names the event and its creature plays it out.
5. The computer replies from a Web Worker (the sea keeps animating while it thinks).
6. Check rings the ship's bell and pulses the king's square. Mate, stalemate, the fifty-move rule, threefold repetition, insufficient material or resignation end the voyage.

Undo takes back to your previous turn (two plies against the computer), events included. The game autosaves after every move.

---

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Select / move | Tap or click a ship, then a square | Arrows move a cursor, Enter selects |
| Camera | Drag to orbit, wheel or pinch to zoom | F turns the board |
| Undo / hint | Toolbar | U / H |
| Chess symbols over ships | Toolbar (Labels) | L |
| Sound / music | Toolbar | M / N |
| Menu | Toolbar | Esc |

Hovering a ship with a mouse shows its name, chess role and square.

---

## AI (`js/sim/ai.js`)

Negamax alpha-beta with iterative deepening, a 256k-entry transposition table, quiescence on captures and promotions, MVV-LVA and killer and history ordering, a check extension, repetition and fifty-move draws, and simplified piece-square tables with a middlegame/endgame king blend and a bishop-pair bonus. The clock is injected so the module stays pure.

| Level | Name | Search |
|---|---|---|
| 1 | Cabin Boy | depth 1, ±140 cp noise, 22% random move |
| 2 | Deckhand | depth 2, ±60 cp noise, 5% random move |
| 3 | Bosun | depth 3, ±20 cp noise |
| 4 | First Mate | iterative deepening to depth 5, 0.9 s |
| 5 | Captain | iterative deepening to depth 9, 2.2 s |

The AI doesn't anticipate sea events. Nobody can.

---

## Look

- **Cel shading:** `MeshToonMaterial` with a three-step gradient map, plus ink outlines from three's `OutlineEffect` (inverted-hull pass). Water, sky and particles opt out of outlines.
- **Board:** one shader plane: chequered shallows and deeps, toon ripples, caustic lines, glints, rope-lane grid lines. Every highlight (selection, moves, captures, last move, check, hint, hover) is read from an 8×8 marks texture.
- **Ocean:** a 200×200 vertex wave plane, banded colour, foam streaks, glints, surf rings around the dock and every island, fog to the horizon.
- **Scenery:** plank dock with brass coordinate plaques, pilings with rope wraps and sagging ropes, lanterns, barrels, crates, a rope coil and an anchor. Six palm islands (one with a hut), sea stacks, a giant lighthouse with a sweeping beam, toon clouds, circling gulls and three ships sailing the horizon.
- **Creatures:** a Kraken with tapered, suckered tentacles (rebuilt every frame from animated control points) and a big-eyed head; a mermaid with a scaled tail, coral hair and a waving arm; a pod of leaping dolphins; a translucent green ghost galleon trailing mist; a sea serpent of travelling humps with a horned head; a spiral whirlpool shader; storm clouds, rain, wind streaks and lightning.
- **Weather:** a single `uStorm` uniform darkens sky, sea, board and lights together.
- Piece thumbnails for the HUD are rendered from the real models at load.

---

## Sound (`js/audio.js`, all synthesised)

| Sound | Trigger |
|---|---|
| Surf (breathing low-passed noise) + gull calls | Always (ambience) |
| Wooden creak | A ship moves |
| Cannon boom + hit splash | Capture |
| Ship's bell | Check |
| Rising arpeggio | Promotion |
| Stinger (good / bad / neutral) | Any sea event |
| Growl / harp glissando / wind + thunder / swirl / clicks and whistles / ghost choir / bubbles and chimes / hiss | Each event |
| Fanfare / lament | Game over |
| A D-dorian shanty in 6/8: squeezebox, bass, tambourine | Music (toggle) |

---

## Module overview

| File | Responsibility |
|---|---|
| `js/sim/chess.js` | 0x88 board, legal move generation, make/unmake, Zobrist hashing, SAN, FEN, perft |
| `js/sim/ai.js` | Evaluation and search |
| `js/sim/seaEvents.js` | Event definitions, generators, fairness checks |
| `js/sim/game.js` | `Match`: moves, events, captures, log, result, undo, save/load, `applyRecord` |
| `js/sim/rng.js` | Seeded RNG with saveable state |
| `js/aiWorker.js` | Runs the AI off the main thread (falls back to the main thread if workers fail) |
| `js/view/stage.js` | Renderer, camera, orbit controls, outlines, lights, sky, ocean, weather, HUD-aware framing |
| `js/view/toon.js` | Toon materials and every procedural canvas texture |
| `js/view/ships.js` | Parametric hulls, sails, rigging, crowns, figureheads; merged per material and cached |
| `js/view/board3d.js` | Board shader, ship items, move/capture/sink/rise/promote animations |
| `js/view/creatures.js` | Creature models and one animation per sea event |
| `js/view/scenery.js` | Dock, islands, clouds, gulls, passing ships |
| `js/view/fx.js` | Pooled sprite particles, cannonballs, rain |
| `js/view/anim.js` | Promise-based tweens |
| `js/ui/hud.js` | DOM HUD, setup screen, dialogs |
| `js/ui/thumbs.js` | Renders piece thumbnails from the 3D models |
| `js/audio.js` | Web Audio sound and music |
| `js/save.js` | Guarded localStorage (voyage + preferences) |

The sim never touches the DOM, three.js, `Math.random` or the clock, and the sim test checks this. The view replays `Match.play()` records (`{ move, event }`), and `applyRecord()` is the single description of how a record moves pieces. The sim test runs it against the real board for thousands of plies, so the view's ship map can't drift.

---

## Testing

See [dev/README.md](dev/README.md). `dev/simtest.mjs` runs perft, AI checks and ~35 000 plies of Tempest chaos with invariants. `dev/browsertest.mjs` plays real games in Chromium on desktop and touch-only phones and forces every event.

---

## Changelog

### v1.0.0 (2026-10-06)
- First release: full chess rules, five AI levels, hotseat, eight sea events with creatures, procedural cel-shaded fleets and scenery, synthesised sound and music, undo, hints, autosave, touch and keyboard play, headless and browser tests.
