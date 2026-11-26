# The Last Apprentice — game plan

**Genre:** gothic visual novel with ward-lock puzzles between chapters.
**Engine:** vanilla HTML/CSS/JS. The painted stage is composited in Canvas 2D and drawn through a WebGL fragment
shader; everything else is DOM. Sim/view split per the scaffold skill: a pure seeded simulation in `js/sim/`, the
view only reads `G` and drains `G.events`.
**Media:** every image generated with fal, every track, effect and voice with ElevenLabs
([dev/art/README.md](dev/art/README.md), [dev/audio/README.md](dev/audio/README.md)).

## The idea: colour as the reward

Every painting in the game (27 places, 35 illustrations, 13 portraits, the title) is generated in **full colour**.
[js/view/stage.js](js/view/stage.js) composites the backdrop, the illustration and the portraits into an offscreen
canvas, uploads it as a texture and draws it through a shader that greys each of seven bands of hue until its ward
has been opened:

| Ward | Place | Hue band (HSV hue) | Word |
|---|---|---|---|
| The Rose Ward | Hollowmere | crimson 0.955–0.035 | Kindling |
| The Forge Ward | Cinderhold | amber 0.035–0.105 | Making |
| The Tide Ward | Merrowgate | sapphire 0.45–0.64 | Passage |
| The Heartwood Ward | the Eldwood | verdant 0.2–0.45 | Growing |
| The Sun Ward | Aurelfield | gold 0.105–0.2 | Seeing |
| The Star Ward | the Starfall Peaks | indigo 0.64–0.74 | Binding |
| The Last Ward | Vael Sanctum | violet 0.74–0.955 | Dreaming |

Band edges are soft (±0.018) so no seam shows between a restored band and a grey one. When a ward opens its band
returns as a **ripple** from the centre of the screen with a ring of its colour; vignette, darkening and film grain
are strongest in the grey world and fade as colour returns; with all seven back, saturation is lifted a little.
Particles follow the same arc: grey ash at first, coloured motes from the restored hues, and petals at the end.
The UI accent warms from pewter to gold (`--warm`), name plates take their speaker's colour once it has returned,
and the title painting shows only the book's gold until the story has been finished once, then everything.
Without WebGL the composite is drawn with `filter: grayscale(1 − restored/7)`.

## The story

Three hundred years ago the Cinereal Order raised seven wards and locked away the magic of Velmaris; colour,
dyes, music and dreams drained away after it. A month ago Ostrander Vael, the last sorcerer, died at Ravenmoor.
You, a scavenger, find his book; it binds you with a **geas**, and his echo in its margins (the Codex) sends you to
open the wards. The Order's Hierarch, Odrane, who built the wards with Ostrander and has fed on them since, sends
Inquisitor Caius Morrow after you.

| Chapter | Place | Scenes, ward, camp |
|---|---|---|
| Prologue: Ash and Vellum | Ravenmoor | prologue, flight |
| One: The Drowned Rose | Hollowmere | hollowmere · Rose Ward · rose-bloom · hierarch |
| Two: Hammer and Hush | Cinderhold | cinderhold · caius-forge · Forge Ward · forge-bloom · night 1 |
| Three: Salt and Ink | Merrowgate | merrowgate · storm · Tide Ward · tide-bloom · night 2 |
| Four: The Sleeping Wood | the Eldwood | eldwood · Heartwood Ward · wood-bloom · night 3 |
| Five: The Golden Silence | Aurelfield | aurelfield · caius-sun · Sun Ward · sun-bloom · night 4 |
| Six: Where the Stars Were Kept | the Starfall Peaks | starfall · confession · bridge · Star Ward · star-bloom · night 5 |
| Seven: The Last Ward | Vael Sanctum | sanctum · throne · Last Ward · dream-bloom |
| Epilogue: The World in Colour | Velmaris | epilogue |

**Companions:** Edda Thornwick (a blind cartographer), Aldwin (a deserter knight turned blacksmith), Kestrel (a
smuggler with a forbidden tattoo), Ione (the last dryad, asleep in stone inside the Heartwood Ward). Caius Morrow
can turn. Script format, flags and conditions: [js/sim/data/story.js](js/sim/data/story.js).

### What choices decide

- **Hope** (kindness, courage) and **mercy** (to enemies) accumulate from choices; bonds from what you say to
  each companion.
- **Nights at the fire** (five; two talks a night): each companion has three talks heard in order (Caius one).
  The third sets their epilogue variant. Aldwin's third (his promise to come back) **saves him at the bridge**.
- `mercy >= 3` turns Caius (he then helps at the bridge, and Aldwin lives).
- `hope >= 12` offers mercy to the Hierarch as he crumbles (`HOPE_MERCY_ODRANE` in [js/config.js](js/config.js)).
- `condemned` (choosing to condemn Ostrander after his confession) changes the Codex's last words.

## The ward-locks

[js/sim/ward.js](js/sim/ward.js). Each ward is 2–4 concentric rings of eight slots holding the seven runes and
blanks; each ring must show its key rune in the window at the top, outer ring first. Turning ring *i* also turns
the rings in `couple[i]` (by ±1). Every start state is a scramble of the solved state by real moves, kept only if
its shortest solution (breadth-first search over every reachable state, from the goal) lies in the ward's band,
so every ward is solvable and roughly as hard as intended. **Hint** shows the next turn on a shortest path;
**Codex** solves it; **story mode** (Settings) shows the next turn all the time.

| Ward | Rings | Coupling | Shortest solution over 60 seeds |
|---|---|---|---|
| Rose | 2 | none | 4–6 |
| Forge | 2 | outer drags inner | 4–8 |
| Tide | 3 | middle drags inner backwards | 6–8 |
| Heartwood | 3 | a chain, outer → inner | 6–10 |
| Sun | 3 | a cycle | 6 |
| Star | 4 | a chain with one reversal | 6–12 |
| Last | 4 | a cross: 0→2, 1→3, 2→1, 3→0 | 8 |

Input: drag a ring round (each eighth of a turn is one move), tap the right or left half of a ring, the ⟲ ◎ ⟳
buttons, or ↑ ↓ to pick a ring and ← → to turn it; H hints, U lets the Codex open it.

## Balance (dev/simtest.mjs, bot routes)

| Route | Hope | Mercy | Outcome |
|---|---|---|---|
| kind, Aldwin first | 32 | 4 | Caius turns, Aldwin lives, mercy for Odrane |
| kind, Edda and Kestrel | 32 | 4 | as above |
| harsh, Aldwin first | 9 | 0 | Aldwin lives (his third talk), Caius does not turn, no mercy |
| harsh, never Aldwin | 8 | 0 | Aldwin falls at the bridge |
| harsh, no talks | 7 | 0 | Aldwin falls |

Every route reaches the epilogue; one playthrough is about 350–420 lines and 28 choices.

## Modules

| File | Role |
|---|---|
| `js/sim/game.js` | `newGame`, `act(G, cmd)` (advance, choose, turn, hint, unseal, sit, sleep, travel), save/load |
| `js/sim/scene.js` | the script runner: directives, dialogue, choices, the stage in `G.stage`; `lintScript` |
| `js/sim/ward.js` | ward-locks: turning, BFS distances, hints, seeded scrambles |
| `js/sim/rules.js` | effects (`hope+1`, `b.edda+1`, `flag:x`) and conditions (`hope>=12`, `talk.aldwin>=3`) |
| `js/sim/bot.js` | kind / harsh / random policies for tests and the debug autoplay |
| `js/sim/data/` | cast, chapters and wards, story scripts, camp talks, lore |
| `js/view/stage.js` | compositor, WebGL hue shader, ripple, particles |
| `js/view/ward.js` | the ward-lock canvas: rings, runes, drag and tap, the opening blaze |
| `js/vn.js` | the dialogue box: typing, voices, auto, skip, log |
| `js/ui.js` | HUD, ward panel, camp, road map, journal, slots, ending |
| `js/audio.js` | music crossfades, decoded effects, voice clips, synth fallback |
| `js/main.js` | boot, routing, the hold while a ward opens, debug hooks (`window.__tla`) |

## Testing

See [dev/README.md](dev/README.md): `simtest.mjs` (purity, data and media, rules, wards, determinism, routes) and
`browsertest.mjs` (desktop, two touch-only phones, blocked storage).

## Changelog


### v1.1.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

- **1.0.0**: first release.
