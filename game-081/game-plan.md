# Salve & Scale

**Genre:** First-person adventure with a trail-linking healing puzzle (Bumble Basket's rules, rethemed)
**Engine:** three.js r165, no asset files: every model, texture, sound and tune is made in code
**Status:** v1.0.2

---

## Concept

You are the healer of Gloamhollow, the kingdom under the hills where the monsters live. You run
the **Lantern Clinic** at Hollow's Crossing: goblins limp in with thorns in their feet, slimes
come in with curdled cores, skeletons rattle in with hexes carved into their ribs. You walk the
clinic in first person, greet patients at the reception desk, send them to the exam table and look
inside them through the **Lumen Lens**, a crystal that shows a creature's body as a grid of glowing
afflictions.

Treating a patient is the puzzle. Drag a trail through neighbouring afflictions where every hop
shares something you can sense: the same **form** (two thorns), the same **aura** (two crimson
motes), the same **depth** (two grave ones) or the same **nature** (two venoms). Release a trail of
three or more and they are purged, mended, dispelled or soothed. It is Bumble Basket's
word-ladder matching, and the way the healer grows is the way the bee grew: you start sensing only
form, and each act of the story teaches a new sense.

Between clinic days you go out on calls like an emergency doctor: to a bramble-choked forest
hollow, a drowned crypt, a dragon's forge and finally the Overlord's citadel, finding hurt monsters
where they fell and treating them in the field.

Someone is hurting them. A band of rogue adventurers, the **Gilded Company**, is cutting its way
through Gloamhollow for trophies and a bounty on the "Dark Overlord". But the Overlord, Grimwald
the Gentle, is not evil. He is sick. The Company slipped a cursed crown into a tribute chest, and
its madness is spreading through the kingdom as the Gloam Fever. The last patient is the Overlord
himself: treat his madness, then stand beside him while he lays the evidence you gathered before
the court and exposes the Company.

Riffs on: Two Point Hospital's warmth, Theme Hospital's patient flow, Bumble Basket's (game-058)
puzzle, Spiritfarer's kindness, and the old "the monsters were the good guys" twist.

## Core loop

1. **Clinic day.** Patients wait on the benches. Talk to one, and they hop onto the exam table.
2. **Scan.** Use the Lumen Lens. The view drops into the X-ray: the patient's body glows as a
   hologram behind a grid of afflictions shaped like their silhouette. Meet the treatment goals
   before your Focus runs out.
3. **Reward.** The patient pays in moonpetals (coins) and renown (experience). Renown levels give
   skill points for the **Grimoire of Mending**. Moonpetals buy remedies at the apothecary shelf.
4. **Story beats.** Clasp the mimic receptionist, Ossa the skeleton nurse and Pip the wisp keep the
   story moving. When a call comes in, the map table opens a quest.
5. **Quest.** Walk the location, find hurt monsters (each a field scan), disarm the Company's
   traps, open relic chests, find the evidence, and treat the boss patient behind the gate. Coming
   home ends the act and teaches the next sense.
6. **Rest** at the cot to start a new clinic day with new walk-in patients.

## The healing puzzle (the scan)

### Afflictions
Every mote on the grid has four traits.

| Trait | Sense that links it | Values |
|---|---|---|
| **Form** (kind) | Eye of Form | 16 forms, below |
| **Aura** (hue) | Aura Sight | crimson, ember, gold, verdant, azure, violet, rose |
| **Depth** (severity) | Depth Sense | minor, serious, grave |
| **Nature** (school) | Root Lore | Venom, Wound, Hex, Blight |

| Nature | Forms (auras) | Treatment verb |
|---|---|---|
| **Venom** | Nightshade (violet, azure) · Wyrmbile (verdant, gold) · Spider-bite (crimson, verdant) · Rot-spore (verdant, ember, rose) | purge |
| **Wound** | Gash (crimson, rose) · Bruise (violet, azure, gold) · Thorn (verdant, ember) · Fracture (gold) | mend |
| **Hex** | Sigil (violet, rose, azure) · Wither (ember, gold) · Nightmare (azure, violet) · Chain (gold, crimson) | dispel |
| **Blight** | Scorch (ember, crimson) · Holy Fire (gold, rose) · Frostbite (azure) · Acid (verdant, gold) | soothe |

33 natural form and aura pairs, which the **Codex of Ailments** records as you treat them.

### Rules (ported from game-058 and kept pure in `js/sim/scan.js`)
- The grid is the patient's silhouette (7 wide × 8 tall, the Overlord 8 × 9): cells outside the
  body are holes.
- Press a mote and drag through its 8 neighbours; every hop must share a trait you can sense.
  Release with 3 or more to treat them. Each treatment costs one **Focus**. Dragging back undoes a
  hop.
- Treated motes vanish, the rest fall toward the bottom of the body and new ones well up from the
  top, skipping fixed cells.
- A trail of **7 or more** leaves a **Lifebloom** where it ended: it links to anything and scores a
  bonus when treated.
- **Scar tissue** fills a cell and has 1–2 layers; treating next to it softens a layer.
- **Bound** motes are wrapped in a curse chain and can't join a trail until a treatment next to
  them unbinds them.
- No legal trail left: the board reshuffles for free.
- Out of Focus: drink a free **Tonic** for 5 more (once per scan, caps it at one star), or step back
  and try again later.

### Reagent vials (in-scan power-ups)
One vial per sense you have. Each asks for a set ("8 thorns", "10 violet", "10 grave", "12 hex");
treated motes that fit pour in. A full vial holds a charge (up to 2) and asks for a new set.

| Vial | Power | Effect |
|---|---|---|
| Form | ⚗️ **Purging Draught** | tap a mote: treat every mote of that form |
| Aura | 🔮 **Prism Salve** | tap a mote: its neighbours take its aura |
| Depth | 🗡️ **Lancet Burst** | tap a spot: treat the 3 × 3 around it |
| Nature | 🪶 **Phoenix Feather** | your next trail can hop between any motes |

Powers never cost Focus.

### Goals (tickets, up to 4)
Treat N of a form, aura, depth or nature; grow N lifeblooms; soften N scars; unbind N motes; treat
any N. Stars: one for healing, two with 20% Focus left, three with 40%. Leftover Focus becomes
bonus moonpetals.

### Multi-phase scans
The final boss is three boards in a row (Wrath, Lies, the Diadem), each with its own silhouette,
forms and goals. Focus carries over plus a top-up between phases.

## Senses: the progression

| Act | Location | Senses | What's new on the grid |
|---|---|---|---|
| I · Thorns | Bramblewood Hollow | Form | one aura per form, serious only; venom and wounds |
| II · Hexes | The Drowned Crypt of Vell | + Aura | forms come in several auras; hexes arrive |
| III · Embers | Emberpeak Forge | + Depth | minor, serious and grave motes; scar tissue; blights |
| IV · The Fever | Gloamspire Citadel | + Nature | all 16 forms; bound motes |

Each act's boss teaches the next sense: you learn it by seeing it in the boss's body.

## Grimoire of Mending (skill tree)

Three branches of five, each node needing the one before it. Costs 1, 1, 1, 2, 2.

| Branch | Nodes |
|---|---|
| 🌿 **Herbalism** | Deep Breath (+2 Focus) · Steeped Vials (vials need 2 fewer) · Strong Tonic (the tonic gives +8) · Brimming (start each scan with a Draught charge) · Verdant Heart (+3 more Focus) |
| ✨ **Hexcraft** | Bloom Lore (lifeblooms from trails of 6) · Unbinding Word (one treatment strips two binding layers) · Radiant Bloom (a treated lifebloom also treats its neighbours) · Deep Vials (vials hold 3 charges) · Lantern Soul (every 5th trail is a free Phoenix trail) |
| 🩸 **Surgery** | Steady Hand (trails of 6+ give back 1 Focus) · Wide Lancet (the Lancet also hits the four cells beyond the 3 × 3) · Debride (scar softens 2 layers at once) · Triage (your first trail costs no Focus) · Master's Touch (trails of 5+ give back 1 Focus) |

Skill points: one per renown level, plus one for every boss healed.

## Remedies and relics

| Remedy (apothecary shelf, carry 3 of each) | Price | Effect in a scan |
|---|---|---|
| Smelling Salts | 25 | +3 Focus |
| Calm Draught | 20 | reshuffle the grid |
| Starpetal Tonic | 40 | fill the fullest vial |

| Relic (in each of the first three calls' relic chests) | Effect |
|---|---|
| Owl-Feather Quill (Bramblewood) | +1 Focus |
| Moonlit Lens (Vell) | vials need 1 fewer |
| Dragonscale Glove (Emberpeak) | start every scan with a Lancet charge (when you have Depth Sense) |

The Citadel's relic chest holds a purse instead; its prize is Vessa's ledger, the last piece of evidence, on a lectern in the Overlord's study.

| Clinic upgrade (bought once at the apothecary shelf) | Price | Effect |
|---|---|---|
| Padded Exam Table | 120 | +1 Focus |
| Bigger Satchel | 150 | carry 5 of each remedy |
| Moonflower Vase | 180 | +25% renown |
| Lumen Chandelier | 260 | vials need 1 fewer |
| Copper Still | 340 | a free remedy every time you rest |

Moonpetals come from patients (more for stars, story patients and bosses), traps and chests; renown
from patients. Every renown level gives a skill point.

## Story

**Gloamhollow**, the kingdom under the hills. For three hundred years the Overlord **Grimwald the
Gentle**, a towering horned old king who grows moonflowers and writes bad poetry, has kept the
Peace of Lanterns: monsters keep below, surface folk keep above, and both leave each other be.

**You**, the Healer, inherited the Lantern Clinic from your teacher. With you:
- **Clasp**, a mimic who works reception from inside her own lid, keeps the ledger and gossips.
- **Ossa Marrowfield**, a skeleton head nurse, your old teacher's partner, dry and kind.
- **Pip**, a wisp who lives in the Lumen Lens; the cursor in every scan is Pip.

**The Gilded Company**, from the surface city of Aurelune: **Sir Aldric Goldspur** (paladin and
glory hound, lance and sword), **Vessa Nightquill** (rogue, poisons), **Magister Corvin Hale**
(hexmage, curses) and **Sister Lumina** (zealot, holy fire). They are paid by the trophy and
promised a dukedom if the "Dark Overlord" falls.

### Act I: Thorns
Opening day. Nib the goblin hobbles in with thorns in his foot from a hedge of thornwire on the
forest road. Gloop the slime has swallowed something sour. Clasp reports screaming in Bramblewood
Hollow. In the hollow: a Myconid with spore rot, an imp with an arrow wound, and **Mother
Bramblehide**, an owlbear shot full of golden-fletched arrows defending her cubs. Evidence: a
**gilded arrow** with the Company's crest. Healing her, you see her blood shimmer in colours: you
learn **Aura Sight**.

### Act II: Hexes
Skeletons come in with sigils carved on their ribs. A ghost child, Wisp, cannot stop crying. In
the Drowned Crypt of Vell, the old monster cemetery, every spirit is bound by hex-chains, and the
**Weeping Lady**, the crypt's banshee warden, has been hexed so she screams without end. Evidence:
a **hex scroll** signed "C. H." Healing her teaches you to feel how deep a wound goes: **Depth
Sense**.

### Act III: Embers
Kobold miners come in burned. Emberpeak Forge, the dragon's mountain, is full of smoke: **Ignatia
the Ember Wyrm** was lanced through the wing while her egg was stolen. Inside her you see the four
natures of hurt at once: **Root Lore**. Evidence: a **broken gilded lance**. Ignatia warns you that
the Overlord has not answered a summons in weeks.

### Act IV: The Fever
The Gloam Fever spreads; monsters come in raving. Pip shows you the fever's source: the Citadel.
Gloamspire is half dark, its gargoyles and golems mad. In Grimwald's study you find **Vessa's
ledger**: the Company sent a "tribute" crown, the Diadem of Wrath, to drive the Overlord mad, so the
surface would pay them to kill him. In the throne room Grimwald rages. The last scan has three
phases: his **Wrath**, the **Lies** whispered into him and the **Diadem** itself.

### Ending
Grimwald wakes. At the Lantern Court, before monster and surface envoys alike, he lays out the
arrow, the scroll, the lance and the ledger. The Company is exposed and stripped of its gold; their
sentence is a year as orderlies at the Lantern Clinic (Sir Aldric mopping slime). The kingdom's
lanterns relight. The clinic stays open: post-game clinic days go on with every sense.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD / arrows (↑↓) | left stick | left-side stick |
| Look | mouse (click to lock) / ← → | right stick | drag on the right side |
| Sprint | Shift | L3 / LB | double-tap the stick (hold) |
| Interact / talk | E / Space / click | A | ✋ button |
| Journal (skills, codex, evidence) | J / Tab | Y | 📖 button |
| Pause | P / Esc | Start | ❚❚ |
| Scan: trail | drag with the mouse | — | drag |
| Scan: power | click a vial, then a mote | — | tap a vial, then a mote |
| Scan: hint | H | — | wait a few seconds |

## Look and sound

- **World:** three.js with ACES tone mapping, a PMREM environment, PCF soft shadows (on Beautiful) from a key
  light, height fog, a bloom pass and a final grade pass (vignette, grain, per-location colour
  grade). Walls, floors and ceilings are built from the map grid with procedural canvas textures
  (planks, flagstones, bark, basalt), plus instanced props (candles, mushrooms, roots, books,
  bottles), glowing crystals, fake volumetric light shafts, animated water and lava shaders.
- **Monsters:** fourteen species built in code from lathe, tube and displaced-icosphere parts with
  MeshPhysicalMaterial: sheen for fur and cloth, clearcoat for slime and chitin, iridescence on
  dragon scales, transmission for the slime's jelly, a fresnel shader for ghosts, shell-textured
  fur for the owlbear. Idle animations breathe, blink and sway. `dev/models.html` shows them all
  on a neutral background.
- **The Lumen Lens:** the scan scene is a dark blue lab. The patient floats behind the grid in an
  X-ray shader (fresnel rim, scan lines, a sweeping scan band, glowing "organs"), the grid cells
  are glass tiles on the silhouette, and each affliction is a small 3D glyph (a thorn spike, a
  sigil ring, a flame, a venom droplet) lit in its aura's colour and scaled by depth.
- **Sound:** Web Audio only. A lute-and-music-box clinic theme, a calm arpeggio for scans, darker
  modal themes for each quest, a boss theme and an ending theme, all sequenced in code. Talk
  blips pitched per character, footsteps by floor type, pentatonic hop notes, a whoosh, chime,
  shimmer or hiss per nature when motes are treated.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, world, talk, scan, menus, ending), the fixed-step loop, input routing, debug hooks |
| `js/config.js` | Version, save key, step, movement tuning |
| `js/rng.js` | Seeded mulberry32 with saveable state, and an object-state variant for the scan |
| `js/sim/data/ailments.js` | Forms, auras, depths, natures, senses, vials, powers, rules |
| `js/sim/data/species.js` | Fourteen species: names, silhouettes (scan masks), affliction leanings |
| `js/sim/data/skills.js` | The Grimoire, remedies and relics |
| `js/sim/data/maps.js` | The clinic and four quest maps as ASCII grids with entity legends |
| `js/sim/data/story.js` | Acts, story patients and their scans, walk-in templates, every line of dialogue |
| `js/sim/scan.js` | The healing puzzle: pure, plain-object state, serializable mid-scan |
| `js/sim/search.js` | Any-move check, hints, best trail |
| `js/sim/world.js` | First-person movement, collision, entities from state, interaction, routes |
| `js/sim/game.js` | Campaign: newGame, step, act(), objectives, rewards, serialize |
| `js/sim/bot.js` | A scan bot and a campaign bot that walks the real maps and plays the whole game |
| `js/view/stage.js` | Renderer, cameras, post chain, environment |
| `js/view/shaders.js` | X-ray, ghost, slime, fur shell, water, lava, sky, light shaft, mote glow |
| `js/view/textures.js` | Procedural canvas textures |
| `js/view/models.js` | The fourteen monsters and the cast |
| `js/view/props.js` | Furniture and dungeon dressing |
| `js/view/level.js` | Builds a map's geometry, lights and props |
| `js/view/board.js` | The scan grid, motes, trail rope and Pip in the Lumen scene |
| `js/view/fx.js` | Particles |
| `js/view/view.js` | World and scan rendering, portraits |
| `js/ui.js` | HUD, dialogue, scan HUD, journal (skills, codex, bestiary, evidence), shop, map, screens |
| `js/input.js` | Keyboard, mouse lock, gamepad and touch merged; a menu press queue |
| `js/audio.js` | Music and effects |
| `js/save.js` | Guarded localStorage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the scan rules, every story scan
and generated walk-in being solvable by the bot, the maps (every entity reachable, gates gating),
dialogue, determinism and save round trips (mid-scan too), and has the campaign bot walk and heal
its way through the whole game. `browsertest.mjs` drives the real game on desktop, two touch-only
phones and with storage blocked.

## Balance notes

Tuned against the bots (`ONLY=scans,campaign node game-081/dev/simtest.mjs`):

- **Goal sizes.** Bumble Basket's numbers did not carry over: with the first goals the perfect scan
  bot kept 70–90% of its Focus on every scan. Count goals were scaled by 2.6, then per patient (story
  and quest scans in acts II–IV by 1.1–2.0) until the perfect bot, with no skills, keeps 35–60% and
  the casual bot (skill 0.6) heals almost every scan, using the tonic on a few. Nib, the first
  patient, stays easy on purpose. Act I walk-ins got less Focus (10–12) instead of bigger goals.
- **The simtest's floors and ceilings**: the casual bot must heal every scan (tonic allowed) on 60%
  of ten seeds, the perfect bot on 90%, and the perfect bot must not keep more than ~60% of its Focus.
- **Economy.** Coins piled up past 3,000 with nothing to buy, so patient rewards were cut to about a
  third and five clinic upgrades (120–340) give coins a purpose. The campaign bot ends with
  ~450–550 moonpetals after buying them all.
- **The campaign** (two seeds, two skills): about 7.6 minutes of walking, 35 patients healed, renown
  level 10, ten skills learned, 30 of 33 codex entries. With skills and upgrades stacked the later
  acts are easy: the perfect bot averages 3.0 stars and the casual one 2.8, and neither needs a tonic.
  A person is slower at spotting long trails than either bot, so this is left gentle on purpose (it is
  a cozy game), but it is the first thing to revisit after a human playtest.
- **Traps** were moved until each one sits on a chokepoint (the maps test checks that disarming it
  opens something new).

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Colour-blind mode (a pattern per aura).

## Changelog

### v1.0.2 (2026-10-16)
- The waiting-room fireplace looked like a stone box with a black panel stuck on the front, and it
  stood sideways to the wall. Props were turned to face their first open neighbour, so the hearth
  against the south wall faced east; now anything with a wall beside it backs onto that wall. The
  hearth is rebuilt as a fireplace built into the wall: a stone surround with a recessed sooty
  firebox, a mantel with candles and moonflowers, a chimney breast up to the ceiling, a hearthstone,
  andirons, logs, glowing embers and a fire made of crossed flame sheets with a new noise shader
  (`fireMaterial` in `js/view/shaders.js`). Stone is sized per part so the blocks match.

### v1.0.1 (2026-10-16)
- Fixed flickering stripes on the study floor on phones. The rug builder grouped `,` cells into
  rectangles but let a later rectangle grow back over cells an earlier one had claimed, so the study
  got two overlapping rugs at the same height, which z-fought; each rug also had a full-size gold
  plane 4 mm under it. Now there is one rug per connected patch, its border is a ring around it rather
  than a plane beneath, both sit on a polygon offset above the floor, and the camera's near plane
  moved from 0.05 to 0.1 for more depth precision. The use ring and wainscot panels got the same
  margin. The browser test checks that no two floor coverings overlap.

### v1.0.0 (2026-10-15)
- First release.
