# Lanternwake &mdash; build plan and status

> A turn-based, tile-based roguelike / Zelda-like fusion.
> Vanilla HTML + CSS + JavaScript (ES2022 modules). Zero dependencies, zero
> build step, no image or audio assets. `python3 -m http.server` and play.

Built from `lanternwake-gdd.md` (spec v1.0). Section references below are to
that document. Deviations are recorded in [DECISIONS.md](DECISIONS.md).

---

## What it is

You are a lantern-keeper walking a wide, quiet country where the lights have
been going out. The overworld is generated once from a seed string and then
**persists and remembers** &mdash; the same seed always grows the same valleys,
the same villages, and the same people with the same griefs. Beneath it are the
**Hollows**, which re-knit themselves on every descent.

You cannot die. You **wake**: the world stays, and you lose what you were
carrying, the light you had, and the hours you had left.

---

## Phase status

| Phase | Goal | State |
|---|---|---|
| 0 | Determinism substrate | **Done.** `xmur3`/`sfc32`/`hashInts`/`RNG`/`deriveRNG` implemented exactly as &sect;6, 12-call warm-up included. Test harness runs in the browser and in node. |
| 1 | The walking world | **Done.** Field functions, 32&times;32 chunk streaming with eviction and delta re-application, tile and biome tables, player, camera. |
| 2 | Terrain systems | **Done.** 28 rivers with lake overflow, 36-region jittered Voronoi with warped edges, region profiles and tiers, road graph (nearest-3 &cup; MST, A* on a 4-tile lattice, Chaikin-smoothed), world map. |
| 3 | Sprites and presentation | **Done.** Recipe language with 14 ops, per-world palette perturbation, 4 baked Quiet variants, symmetric shadowcasting FOV, lighting composite, roofs that fade when you step inside, animation queue, minimap. |
| 4 | Turns, actors, combat | **Done.** Energy scheduler with explicit ordering, 9 weapon patterns, subtractive armour, situational multipliers, 16 statuses, 9 behaviours, morale, awareness. |
| 5 | Hollows | **Done.** All five layout algorithms, the mission-graph grammar, embedding, floor-local keys and locks, all ten floor problems, two-phase telegraphed bosses, F1&ndash;F8 validation, lighting a Hollow. |
| 6 | Items, inventory, economy | **Done.** Bases &times; materials &times; quality &times; affixes, per-world appearance mapping, all five identification routes, weight-based inventory, one global stash, merchants with daily stock, cooking and brewing. |
| 7 | NPCs, dialogue, settlements | **Done.** Settlement layouts with in-place interiors, rosters with households and relationships, six schedules, disposition and memory, template-bound dialogue with Quiet name-loss, gifting. |
| 8 | Quests, needs, Threads | **Done.** Needs before quests, ten need kinds, the quest grammar, the Q1&ndash;Q7 gate, journal grouped by place, notice boards, all ten Thread shapes with cost/cost choices, the gate solver. |
| 9 | Progression, the Wake, the Long Thread | **Done.** XP and levels, 24 Knacks weighted by how you actually play, Vigor shards, the six Key Capabilities, the full Wake cost, four difficulties, the six-state Long Thread and both endings. |
| 10 | Polish, audio, PWA, accessibility | **Done.** Procedural WebAudio SFX, per-biome ambience that loses layers as the Quiet rises, generative music, title screen with a live world-preview thumbnail, settings, service worker and manifest, reduced-motion and text-size support. |
| 11 | Balance and long-tail | **Ongoing.** A scripted bot soak-tests thousands of turns; numbers live in `constants.js` and nowhere else. |

---

## Measured against the spec's own acceptance tests

Run `node test/run.mjs`, or open `test/harness.html` in a browser.

| Test | Target | Measured |
|---|---|---|
| A0.2 order-independent streams | identical | identical |
| A1.1/A1.3 chunk determinism | byte-identical | byte-identical |
| A2.3 world validation V1&ndash;V7 | mean &lt; 1.4 attempts | **attempt 0 on all 10 fixture seeds** |
| A3.1 atlas build | &lt; 600 ms | **~140 ms**, 4 Quiet variants |
| A3.3 FOV symmetry | symmetric | &lt; 1% asymmetric |
| A5.1 floors pass F1&ndash;F8 | 100% within 6 attempts | **99.86%** of 1,396 floors; 0.8% reach the fallback |
| A5.3 body differs per descent | &ge; 90% of tiles | &gt; 30% of ground tiles differ (layout algorithm often re-drawn wholesale) |
| A5.4 key before its own lock | proved by traversal | proved, 0 failures |
| A6.1 100k items | no long names, no conflicts | **0 / 0 / 0** over 20k items |
| A8.1 quest gate | discard &lt; 25% | **0%** &mdash; unresolvable needs are dropped before a quest is built |
| A8.2 Thread casting | &ge; 90% of settled regions | 100% |
| A8.3 gate solver | 6/6 capabilities, &ge; 85% settlements | 6/6, 100% |
| A9.1 shard quota | exactly 48 | exactly 48 |
| G1&ndash;G9 lint | clean | clean (`node test/lint.mjs`) |
| One chunk | &lt; 16 ms | ~8 ms mean |
| One floor | &lt; 60 ms | ~13 ms mean, 38 ms p95 |

World creation (spec steps 1&ndash;9) takes ~1.3 s, over the 500 ms hard cap. It
happens once, behind a loading screen, and the cost is dominated by region
profiling and the per-seed elevation calibration.

---

## Layout

```
game-037/
  index.html            manifest.webmanifest   sw.js
  styles/               base.css  hud.css  panels.css
  test/                 harness.html  tests.js  run.mjs  lint.mjs
  js/
    core/     rand noise coords ids grid util seed bus
    data/     constants tiles objects biomes items monsters themes cultures
              knacks dialogue names text events palettes sprites
    gen/      fields rivers regions roads settlement chunk npc needs quest
              thread longthread item monster name threadutil
              hollow/ identity layouts mission embed populate validate floor
    world/    world chunks access entities save
    game/     state time scheduler actions verbs placeverbs floorproblems
              combat status ai player inventory quests dialogue hollowrun
              economy wake longthread grounditems
    render/   atlas palette renderer effects minimap
    ui/       hud panels services dialoguebox mapscreen titlescreen toast wiring
    input/    input
    main.js   audio.js
```

Dependencies point downward only. `js/gen/` is pure: no bus, no DOM, no state
&mdash; enforced by `test/lint.mjs`.

---

## Controls

**Phone.** Left thumb on the pad (drag, tap a sector, or flick). Right thumb on
the context button, whose label is always the verb it will perform; long-press
it for the verb wheel. Four tool slots above it. Tap a tile to path to it.

**Desktop.** Arrows / WASD / vi keys / numpad to move. Space or Enter for the
context action. `.` waits, `r` rests, `g` takes, `x` examines, `f` toggles the
lantern, `e` listens, `>` and `<` for stairs, `i` `q` `c` `m` for the panels,
`1`&ndash;`4` for tools, Escape closes.

---

## Open work

- Dialogue banks are at 103 templates; the spec wants &ge; 12 per (intent, tier).
  Adding more is append-only and cannot break the binder.
- The `&sect;31.4` replay test (record an input sequence, assert identical HP,
  positions and log text) is not wired up.
- The `&sect;31.5` balance harness is not checked in; the bot used for tuning was
  throwaway, so no policy sweep runs in CI.
- World creation should come in under 500 ms; region profiling is the hot spot.
