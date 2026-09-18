# Emberbrood — Game Design Document

**game-038** · An 8-bit procedurally generated dragon battler
Vanilla HTML / CSS / JS · no libraries · no build step · no asset files · mobile-first

---

## 0. One paragraph

The Emberlines that hold the sky together are going out, and the dragons that
once tended them have forgotten their own names. You are the last sworn Warden
of the Broodwell: you walk out into a guttering country, fight the ashbound
wyrms you meet, **bind** the ones you can save, **raise** them at your hatchery,
**breed** them to carry lineages that have thinned to a single living animal,
and use that brood to relight five Emberlines before the sky finishes falling.
Battles are Final Fantasy-shaped — a party of three, turn order by speed, a
command menu, MP, statuses, elemental weakness — and every dragon in the game,
including the ones you hatch, is generated from a genome that also draws its
sprite.

---

## 1. Pillars

1. **Every dragon is a specific animal.** Genes decide stats, moves, temperament
   *and* the 32×32 sprite. No two rosters look alike; a dragon you bred is
   visibly your dragon's child.
2. **Turn-based battle you can read.** Nothing is hidden behind an animation.
   Turn order is visible, damage is explained in the log, elemental matchups are
   shown the moment a move is highlighted (once the species is known).
3. **Binding is the second win condition.** Every fight can end with a kill or a
   capture, and the capture is the harder, more interesting play.
4. **The brood outlives the run.** Levels, bonds, lineages and generations all
   persist; the late game is beatable mainly *because* of animals you made.
5. **Phone-first.** Portrait layout, thumb-reachable commands, no hover, no
   keyboard requirement. Keyboard is a bonus, not the baseline.
6. **Zero assets.** Sprites drawn in code from genes, music and SFX synthesised,
   the whole world a pure function of one seed string.

---

## 2. Story

### 2.1 Premise

The world of **Aurehal** is threaded by **Emberlines** — five ley-veins of
living fire that run from the horizon into the **Ember Spire**. Dragons were the
Emberlines' keepers: a brood nesting on a line kept it burning, and the line in
return kept the brood's memory — its names, its songs, its knowledge of its own
lineage.

A century ago the **Concord of Ash**, rather than negotiate with dragons, bound
the great sundrake **Vaelorax** into the Spire's furnace and drew all five lines
through it at once. Cities got light. The broods got nothing, and began to
**gutter**: a dragon cut off from its line forgets, then goes feral, then goes
**ashbound** — grey-scaled, nameless, hostile, burning what it used to tend.

Your mentor **Maerin Colde**, last Warden of the Broodwell, spent forty years
proving you can bring an ashbound dragon back by binding it gently, feeding it,
and giving it a lineage to belong to. She died two weeks before the game starts.
You inherit her hatchery, her seal, one egg, and her unfinished argument with
the Concord.

### 2.2 Acts

| Act | Region | Drive | Boss |
|---|---|---|---|
| I | **The Guttering Vale** | Prove Maerin's method works: bind an ashbound dragon and bring it back. | **Cinderfang**, an ashbound drake that killed Maerin's last hatchling |
| II | **The Salt Marches** | The Tide line is drowning. Find the Drowned Chorus; meet **Kessa Vane**, a Concord warden who is *not* wrong. | **Morvaleth**, tidewyrm of the sunken chorus-hall |
| III | **Cindermarch & the Spire's Skirt** | Get inside the Concord. Learn what powers the furnace, and what it costs. | **Kessa Vane** and her stitched chimera, **Aurex** |
| IV | **The Riven Peaks** | The Gale and Stone lines need a keeper that does not exist any more — so make one. Requires a **bred** dragon of generation ≥2 carrying a Skyward trait. | **Ythrax**, stormcaller of the Riven Throne |
| V | **The Hollow Sun** | Inside the Spire. Vaelorax is awake, in pain, and has been listening to you the whole game. | **Vaelorax**, three phases |

### 2.3 Endings

Decided at the final choice, gated by what your save can prove:

- **Unbind** — free Vaelorax and let the cities go dark. Available always.
- **Succession** — put a dragon *you bred* on the line in Vaelorax's place,
  willingly. Requires a bred dragon of generation ≥3, bond 100, stage Elder.
- **Rekindle** — split the five lines back out across five broods you have
  actually restored. Requires one dragon of each of the five Elder lineages at
  stage Wyrm or better.

Each ending writes a different epilogue over the same map.

### 2.4 Voice

Plain, unsentimental, close to the ground. Dragons are animals with histories,
not power fantasies. The Concord is a bureaucracy that made a defensible call a
hundred years ago and cannot now unmake it. Nobody is evil; Kessa is the most
honest person in the game.

---

## 3. Elements

Eight. Every dragon has a primary and (often) a secondary.

| Element | Feel | Strong vs | Weak vs |
|---|---|---|---|
| **Ember** | fire, forge, anger | Verdant, Gloam | Tide, Stone |
| **Tide** | water, salt, memory | Ember, Stone | Verdant, Storm |
| **Gale** | wind, height, speed | Verdant, Stone | Storm, Radiant |
| **Stone** | earth, weight, patience | Storm, Ember | Tide, Verdant |
| **Verdant** | growth, rot, green | Tide, Stone | Ember, Gale |
| **Storm** | lightning, noise | Tide, Gale | Stone, Gloam |
| **Gloam** | ash, forgetting, dusk | Radiant, Verdant | Ember, Storm |
| **Radiant** | line-fire, naming, dawn | Gloam, Storm | Gale, Radiant |

Multipliers: strong ×2.0, weak ×0.5, neutral ×1.0. Against a two-element
defender the multipliers **multiply** (so ×4 and ×0.25 both exist — "sundered"
and "shrugged off", both called out in the log).

---

## 4. Dragons

### 4.1 Genome

```js
{
  id, name, lineageId, elements: [primary, secondary|null],
  genes: {
    body:    'serpent'|'drake'|'wyvern'|'quad'|'amphithere',
    wings:   'membrane'|'feathered'|'finned'|'twin'|'vestigial',
    horns:   'crown'|'swept'|'spiral'|'antler'|'none',
    tail:    'spade'|'fan'|'spikes'|'whip'|'club',
    crest:   'none'|'frill'|'mane'|'sail'|'plates',
    pattern: 'plain'|'banded'|'spotted'|'mottled'|'gradient'|'veined',
    hue, hue2, sat, light, eye,        // colour genes, 0-360 / 0-1
    size,                               // 0.8 - 1.25 sprite + stat weight
  },
  essence: { hp, mp, atk, mag, def, res, spd },   // 0-15 each, the "IV" layer
  growth:  from lineage, modified by temperament
  level, xp, bond (0-100), stage: 'egg'|'hatchling'|'drake'|'wyrm'|'elder',
  temperament, traits: [...], moves: [...] (max 6),
  broodRole: 'ember'|'ash'|'neuter',     // ember × ash can breed
  generation, parents: [name, name]|null, ashbound: bool
}
```

Stat at level L:
`floor( (base + essence/2) * (1 + growth * L/50) * sizeWeight ) + levelFlat`

### 4.2 Lineages (species families)

Twelve, each with a base stat spread, a growth profile, a preferred element
pair, a gene bias (so a Ridgeback *looks* like a Ridgeback), a signature move
and a signature trait. Five of them are the **Elder lineages** the Rekindle
ending needs: Emberwyrm, Tidechorus, Skyward, Stonefather, Verdant Coil.

### 4.3 Growth stages

| Stage | Entered at | Effect |
|---|---|---|
| Egg | — | incubating, not battle-legal |
| Hatchling | hatch | small sprite, ×0.75 stats, 2 move slots |
| Drake | level 12 | ×1.0, 4 slots, first trait unlocks |
| Wyrm | level 28 + bond ≥ 40 | ×1.25, 6 slots, second trait |
| Elder | level 45 + bond ≥ 75 + generation ≥ 2 | ×1.45, Ember Surge upgraded |

Stage changes redraw the sprite (bigger frame, extra horn/crest detail) and are
announced with a full-screen "kindling" moment.

### 4.4 Temperaments

Ten (Bold, Wary, Fond, Sullen, Bright, Ravenous, Patient, Skittish, Proud,
Hollow). Each shifts two growth rates ±10% and changes bond gain rate, Ember
Surge charge rate, and a line of flavour text in the roster. **Hollow** is what
ashbound dragons get until you restore them.

### 4.5 Bond

0–100. Rises from: fighting alongside you, feeding, resting at the Broodwell,
winning with low HP, being the one that lands a finishing blow on a boss. Falls
from: fainting, being boxed for a long time, being used as breeding stock
repeatedly without rest. Bond gives a flat damage/accuracy bonus, gates stages,
gates the Succession ending, and decides whether a dragon obeys a risky command
at low HP.

---

## 5. Sprites — procedural 8-bit

A dragon sprite is a **pure function of its genes**, drawn once into an
offscreen 32×32 (48×48 for Wyrm+) canvas and cached by gene hash.

- A 5-stop palette ramp is derived from `hue/hue2/sat/light` (shadow, dark,
  main, light, highlight) plus a separate membrane/eye colour.
- Body plans are drawn as declarative part lists: spine curve → body blob →
  limbs → neck → head → jaw → horns → wings → tail → crest → pattern pass →
  outline pass → eye.
- The pattern pass (bands/spots/veins) is applied only to pixels already in the
  body mask, so it never leaks outside the silhouette.
- Two frames per dragon: wings up / wings down, plus a 1px vertical bob, giving
  idle animation for free.
- Everything is `imageSmoothingEnabled = false` and integer-scaled, so it stays
  crisp at any zoom on any DPR.
- Ashbound dragons are drawn through a desaturation + ash-speckle filter, so a
  freed dragon visibly regains its colour.

Tiles, items, UI icons, the region map and the towns use the same pixel
machinery at 16×16.

---

## 6. Battle

### 6.1 Shape

Three active dragons vs. one to four enemies. A **round** collects one command
per living ally, then resolves every actor (allies + enemies) in speed order.
The upcoming order is drawn as a queue strip so the player can plan.

Commands per dragon: **Strike** (basic, free), **Skills** (MP), **Item**,
**Guard** (halve damage, +MP, +Surge), **Bind** (capture attempt, Warden's
action), **Flee**.

### 6.2 Damage

```
phys = (atk * 2 + level) * power/100 * (1 - def/(def + 140))
magi = (mag * 2 + level) * power/100 * (1 - res/(res + 140))
final = base * element * stab * bond(1 + bond/400) * guard * variance(0.92-1.08)
crit: 5% + spd/500, ×1.75
```

### 6.3 Statuses

Burn (dot, −atk), Soak (−def, +storm damage taken), Chill (−spd), Blight (dot,
scaling), Stun (lose turn), Fear (−atk, may not act), Muzzle (no skills),
Haste (+spd), Barrier (−25% damage), Regen (heal over time), Ashen (no capture,
MP drain). Durations 2–4 rounds, each with a cure item and a cleansing move.

### 6.4 Ember Surge

A shared party meter fills from damage dealt/taken and Guard. At 100% any
dragon can spend it for a lineage ultimate (visually a full-screen colour flash
+ shake + the dragon drawn large). Elder-stage dragons get the upgraded version.

### 6.5 Enemy AI

Weighted move tables with conditions: "if ally below 30% → heal", "if player
resistant → switch element", "if round ≥ 4 → signature". Bosses run scripted
phases keyed to HP thresholds, with a telegraphed wind-up turn before the big
one — the log says what is coming, and you get one round to answer it.

---

## 7. Binding (capture)

```
rate = bindPower
     * (1 - hp/maxhp)^1.3            // must be hurt
     * statusBonus (1.0 - 2.0)        // chill/stun/soak help most
     * levelFactor (yours vs theirs)
     * rarityFactor (lineage)
     * wardenRank bonus
     * (ashbound ? 0.45 : 1.0)        // unless cleansed this battle
```

Rolled against `random()`. Four bindings of increasing power plus two
specialists (Moonlit Snare — better at night/in dungeons; Elder Snare — the only
thing that holds a boss-tier wyrm, one-per-act). A failed bind is consumed and
costs the Warden's action, so binding is a real tempo decision.

Ashbound dragons must first be hit with a **Clearwater Draught** or a Radiant
cleansing move; doing so restores their colour mid-battle and reveals their true
name, which is the emotional payoff of the entire capture loop.

---

## 8. Raising

- **XP**: `floor(baseXP * enemyLevel^1.45 / 8)`, split across participants, +25%
  to the dragon that landed the last hit. Curve `xpToNext = 12 * L^1.8 + 20L`.
- **Training items** raise a single essence stat by 1 (cap 15).
- **Memory Stones** teach a move outside the lineage list.
- **Feeding** raises bond and temporarily buffs one stat for the next battle.
- **Resting** at the Broodwell restores HP/MP, raises bond, advances incubation.
- **Broodex** records every lineage and gene combination seen, with rewards at
  milestones.

---

## 9. Breeding

At the Broodwell, pair two dragons with opposite `broodRole`, both level ≥ 10,
bond ≥ 30, not currently incubating.

**Inheritance**
- Each visual gene: 45% parent A, 45% parent B, 10% mutation (random or a small
  drift from the parents' mean hue).
- Primary element: parent A's primary (65%) or B's (35%). Secondary: 50% chance
  to inherit either parent's secondary, 12% chance of a *new* element if the
  parents' elements form a known **pairing** (Ember+Tide → Storm, Gale+Stone →
  Storm, Gloam+Radiant → Radiant, …).
- Essence: for three randomly chosen stats take `max(parentA, parentB)`, for the
  rest take a rounded average with ±2 drift.
- Moves: the hatchling knows its lineage's level-1 moves plus up to two **egg
  moves** either parent knows and this lineage can normally learn.
- Lineage: the offspring takes the mother-role lineage 70% of the time, else the
  other, unless a **Lineage Charm** is consumed to force it.
- Generation: `max(parents) + 1`, capped growth bonus `+2% per generation, max
  +10%`. Bred dragons are strictly, visibly better — that is the point.
- Rare **throwback**: 3% chance to roll an Elder lineage if either parent is
  within one step of it, announced with its own dialogue.

Eggs incubate over N battles (12 down to 4 with Warmth Stones/Brood Incense).
The egg's sprite is a 16×16 shell whose speckle pattern is drawn from the
child's actual genes — you can guess the colour before it hatches.

---

## 10. Items (~90)

Ten categories: Restorative, Cure, Battle, Binding, Food, Training, Relic
(equippable), Material, Breeding, Key. Every item is `{ id, name, kind, price,
rarity, desc, effect }` where `effect` is data interpreted by one resolver, so
items work identically from the battle menu, the field menu and a shop preview.

Each dragon has two equip slots (**Harness** and **Relic**) with stat mods and
occasional on-hit / on-turn behaviour.

Materials feed a small **Forge** at Cindermarch: 14 recipes turning battle drops
into relics and high-tier bindings.

---

## 11. Quests

- **Main chain** — 18 steps across five acts, each with a state predicate
  (`reach node`, `bind a dragon of element X`, `win boss`, `hatch an egg`,
  `own a bred generation-2 dragon`) re-tested on every relevant event.
- **Authored side quests** — 12, mostly small human problems that happen to need
  a dragon.
- **Board quests** — procedurally generated per town and refreshed per act:
  hunt (defeat N of element/lineage), bind (capture a lineage), deliver, forage
  (collect N materials), breed (produce a dragon with trait/element), champion
  (defeat a generated named dragon with a generated title). Rewards scale with
  act and difficulty, and generated quests are **validated against what the
  world can actually provide** before they are offered.

---

## 12. World

A node graph of 28 locations across 5 regions, drawn as a pixel map with routes.
Node kinds: **town**, **wild**, **roost** (3–5 room mini-dungeon with a boss and
a chest), **landmark** (story), **spire** (act finales).

At a node: Explore (encounter / forage / vignette), Rest, Shop, Board, Talk,
Delve, Travel. Encounter tables are per-region and per-act, with level bands
that follow your party so the world stays relevant without being flat.

---

## 13. UI / mobile

Single-column, portrait-first, with a fixed top status bar and a bottom action
strip that is always thumb-reachable. Screens are full-page panels, never
stacked modals. Every tap target ≥ 44 px. Safe-area insets respected. Landscape
and desktop get the same layout capped at 720 px with the canvas scaled up.

Battle screen top-to-bottom: enemy row (tappable targets) → turn queue →
battlefield with your three dragons → log → command strip.

Keyboard: arrows/WASD move the cursor, Enter confirms, Esc backs out, 1–9 pick
menu entries. Everything is reachable by touch alone.

---

## 14. Save

One `localStorage` key. The save holds the seed string, the full roster (genes
are small), inventory, quest state, world flags, act, Broodex and settings.
Sprites, encounter tables, generated quests and the map are all re-derived. Save
on: battle end, capture, hatch, level, quest change, screen change, and
`visibilitychange`/`pagehide`. Three slots plus an autosave.

---

## 15. Audio

WebAudio only. Square/pulse/triangle/noise voices in a tiny sequencer: a town
theme, a field theme, a battle theme, a boss theme, and a hatching sting, each
generated from short note tables. ~22 SFX. Fully playable muted.

---

## 16. Build phases

1. Core: rand, bus, util, state, save.
2. Data: elements, lineages, moves, traits, items, world, story.
3. Generators: dragon, sprite, encounter, quest.
4. Battle engine (headless-testable) + AI + capture.
5. UI shell: title, map, location, roster, dragon view, inventory.
6. Battle UI.
7. Breeding, hatchery, training, shops, forge.
8. Quests, story chain, dialogue.
9. Audio.
10. Mobile pass, balance pass, test harness, docs.

## 17. Acceptance

- A new player can reach the first bind within three minutes on a phone.
- The game can be completed to at least one ending; all three endings reachable.
- No `Math.random()` in world generation; a seed reproduces the same world.
- Headless test harness covers: genome determinism, breeding inheritance, damage
  formula, capture curve, XP curve, quest predicates, save round-trip.
- No asset file of any kind ships with the game.
