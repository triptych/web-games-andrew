# Atlas of Ink

**Genre:** Fantasy RPG-flavoured commission game (a cartography sim with a hold-to-focus skill shot)
**Engine:** Vanilla JS: Canvas 2D, no asset files
**Status:** v1.0.0 released

---

## Concept

You are a cartographer in a fantasy kingdom, and your quill carries a scrying spell. Six clients (a farmer, a dwarven prospector, an adventurer, a ship captain, a pilgrim and the king) each want a map of a part of the island, and each will **use** it. The adventurer walks the road your chart suggests, the captain sails the lane it shows, the farmer ploughs where it says plains. The game is judged on what happens to them, so accuracy is the whole point: a swamp you drew as meadow, a reef you never found, a coast you hurried.

The kingdom is hidden. You chart it a disc at a time. Hold the scry key to focus, release to cast: standing still builds focus, moving bleeds it, and a steady cast is wide and true while a rushed one is small, smudged and blind to anything small (a town, an ore vein, a reef). Every client has a clock, so every cast is a decision between speed and truth.

Tone: warm, a little dry, paper and brass. Riffs on Cartographer-themed puzzle games, Papers-Please-style "judged by consequences" loops and the scry-a-circle fantasy of old Ultima maps. No combat, nothing to lose but stars.

## Core loop

A **season** is six commissions in a fixed order of rising difficulty. For each:

1. **Brief.** The client speaks, says what they want and how they will judge it. The shaded country is outlined on the sheet. The clock waits.
2. **Chart.** Fly the quill, hold to focus, release to scry. Ink lands on a blank sheet.
3. **Hand over** (Enter / E / ✓, with a confirmation), or time runs out and the client takes what there is.
4. **Result.** The client uses the chart. Their journey plays out on the map. 0 to 3 stars and points (100 per star, plus 2 per second left if any stars were earned).

After the sixth, the season ends with a rank (Apprentice Scribe → Royal Cartographer by total stars) and a best-season record.

## Mechanics

### The world
A 72 × 44 cell island built from a seed (value-noise elevation under a radial falloff, moisture for biomes, rivers traced downhill, lakes where they run out). Terrain: deep sea, sea, shoals, beach, plains, forest, hills, mountains, swamp, desert, river, lake. Features sit on the right ground: towns on plains, harbours on beaches next to open sea, farms, ruins, ore veins in hills and mountains, shrines, a lighthouse, and reefs, three of which are always placed on the sea lane between every pair of harbours (and checked so a lane remains). A world is rejected and rebuilt with a nudged seed unless it is a real island with enough of everything, including a 20 × 14 window with at least three ore veins and three shrines.

### The spell
- **Focus.** Press the scry key: a channel begins. Holding still (stick under 0.15) builds focus at `1 / focusTime` per second (1 s to full); moving bleeds it at `1.6 × stick` per second. The quill moves at 55% speed while channelling.
- **Radius.** `minR + (maxR − minR) × focus` = 2.2 to 5.6 cells.
- **Error.** Each cell in the disc is inked as the true terrain except with probability `0.01 + 0.6 × (1 − focus)^1.5`, when it is inked as a plausible confusion (plains ↔ forest, hills ↔ mountains, sea ↔ shoal, …). A full-focus cast is 99% true; a tap is about 60% wrong.
- **Features.** A cast with focus below 0.35 cannot resolve a feature at all. At or above it, every feature in the disc is found (and a *found* event fires).
- **Confidence.** Every cell remembers how steady the cast that inked it was. A cell is only overwritten by a cast at least as steady, so a rushed tap never spoils good ink, but you can redo faded ink. The view draws unsure ink pale.
- **Release.** Release (or letting go of the key) casts. A press and release inside one fixed step is a tap and still casts.

### Commissions

| Client | Task | Judged on |
|---|---|---|
| Farmer Hobb | Chart the shaded 16 × 11 country; find the plains | F1 of plains found vs. plains inked rightly: ≥ 0.85 / 0.65 / 0.4 → 3 / 2 / 1 stars |
| Brunna Deepdelve | Find every ore vein in a 20 × 14 country | Veins found: all → 3, ≥ 60% → 2, ≥ 30% → 1 |
| Sir Kael | Find a ruin said to be in a 14 × 10 zone and chart a road from his town | The route he walks: your chart's cheapest road, walked on the true terrain (below) |
| Captain Mara | Find a harbour in a zone and chart a sea lane to it | The same, by ship, with reefs |
| Sister Ione | Find every shrine in a 20 × 14 country | As the prospector |
| King Aldric | Chart the whole 28 × 18 borderlands | Cells charted truly: ≥ 80% / 60% / 35% |

**Travel commissions.** The client plans with A\* over *your* chart (blank parchment costs 6, a found reef is a wall, a found harbour is open water). They then walk that path on the *real* terrain. If any cell is impassable for them (water for a walker, land or an unfound reef for a ship) they turn back or wreck and earn no stars. Otherwise efficiency = best true cost / walked true cost, and extra hazards (swamp and mountain on foot, shoals by sea) beyond the best route's own: 3 stars needs ≥ 85% and none, 2 needs ≥ 60% and ≤ 3. A goal you never found cannot be reached at all.

Foot costs: beach 1.2, plains 1, forest 2, hills 3, desert 3, river 4 (a ford), swamp 6, mountain 9, water impassable. Ship costs: deep and sea 1, shoal 4, all land impassable.

### Time
Rough limits (`time` per commission, derived from route length for travellers): farm 40 s, ore 50 s, route and sail 55 to 90 s, shrine 50 s, survey 75 s. The perfect bot uses 13 to 28% of each; a person is expected to need two to four times that.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move the quill | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Scry (hold, release) | Space / Z / J | A or X | SCRY button (hold) |
| Hand over | Enter / E | Y | ✓ |
| Pause | P / Esc | Start | ❚❚ |
| Reread the commission | | | Brief |

## Look and sound

A parchment sheet on a dark desk, baked at device resolution. The player's chart is a watercolour wash per cell (hash-jittered), with hand-drawn symbols (mountain ranges, hill arcs, trees, swamp reeds, desert stipple, sea waves, grass tufts, river curves) and a wobbly inked coastline where sea meets land. Unsure ink is pale. Feature icons (town, harbour anchor, barn, ruin, ore gem, shrine star, red reef spikes, lighthouse) are vector paths with handwritten labels; the shaded country is a dashed red rectangle. The quill is a feather with a focus ring around the nib, a dotted ring at full size, and a spell edge that shakes when focus is poor. On a result the client's route is traced on the sheet with a traveller (a walker or a ship) at its head and a red X where it failed. The title screen charts a real map in the background, played by the bot. On a phone the sheet is bigger than the screen and the camera follows the quill.

Sound (all Web Audio): a hum that rises with focus, a quill scratch and sine thud on a cast (a dull fizzle if rushed), a chime for a find, paper rustle on hand-over, a rising arpeggio per star, a falling one for none, and a quiet music box over a slow pad.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, play, over), the fixed-step loop, input routing, the title attract demo, debug hooks |
| `js/sim/world.js` | The island: elevation, biomes, rivers, features, reefs on the lanes, validity |
| `js/sim/path.js` | A\* with a binary heap, eight ways, no squeezing past walls |
| `js/sim/commission.js` | The six clients, how a season is generated and checked, how each client uses a chart |
| `js/sim/game.js` | `newGame`, `step`, the spell, `deliver`, `next`, save and load |
| `js/sim/bot.js` | The auto-player: lattice sweeps for regions, optimistic A\* exploration for travellers |
| `js/view/view.js` | Canvas 2D: baked parchment and ink layers, icons, quill, journeys, camera |
| `js/ui.js` | DOM screens (brief, confirm, result, end), HUD, settings, touch deck |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge with hold edges, sound and music, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, worlds across seeds, the spell's rules, that every commission is solvable and judged as described, determinism and save round trips, and has the bot play whole seasons. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

The bot found the first problems. Time limits started at 70 to 140 s and the perfect bot used 5 to 18% of them, so they were cut to roughly 40 to 90 s. A route bot that skipped lattice points whose centre was already inked sometimes never found a hidden goal (the zone was covered with gaps); it now sweeps the whole zone. Shrine and ore regions came out under-populated on some seeds until the world itself was made to guarantee three of each in a 20 × 14 window. The travel judge compared the best route's cost (which treats the goal cell as cost 1) with a walked cost that counted the goal's real terrain, so a perfect chart on a forest goal scored 2 stars; both now treat start and goal alike.

Current table (10 seeds, bot at steady focus vs. hasty focus 0.5): farm 3.0 / 2.7, ore 3.0 / 3.0, route 2.9 / 2.6, sail 2.8 / 2.3, shrine 2.9 / 3.0, survey 3.0 / 2.2 average stars. A bot that does nothing earns nothing.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person and the prospector and pilgrim are easy for it, because it sweeps everything. A person who skips ground without hills will be quicker; the clocks may want tightening after real play.
- A mouse option (hold the button and the quill follows the pointer) would suit desktop better than keys.
- Roads, a legend, and letting the player ink labels would give the sheet more of an atlas feel.
- More commission kinds (a wizard who wants ley lines, a smuggler who wants coves) would extend the season.

## Changelog

### v1.0.0 (2026-11-06)
- First release: six clients, the focus-and-release scry spell with confidence-weighted ink, travel commissions that are walked or sailed on the true terrain, a seeded island with rivers and lane reefs, the title demo, touch, keyboard and gamepad, sound and music, and the sim, browser and bot harnesses.
