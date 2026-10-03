# Keepfire — game plan

**Genre:** lane defense (Plants vs. Zombies) × castle defense × incremental
**Engine:** three.js r165 (importmap from unpkg), vanilla JS modules, DOM UI, Web Audio. No asset files: every model, texture, icon, sound and song is generated in code.
**Targets:** desktop (mouse/keyboard) and phones (touch only, portrait and landscape).

## Pitch

Emberhold is the last keep in Aldmere, and its Keepfire is the last flame the
Night-tide has not put out. The keep starts as one squat tower with a single
archer on it. Waves of fantasy monsters march in from the right along five
lanes. Every kill pays gold. Spend it, mid-wave, on party members you place on
the walls or out in the field (archers, a gold-brewing alchemist, knights,
pyromancers throwing fireballs, a frost witch, dwarves hurling exploding
barrels, clerics, a ballista, a druid, a storm caller), level them up, and grow
the castle itself: taller walls, new towers with more fighting platforms, a
wider bailey to fight in, a forge, a treasury, and the Keepfire beacon that can
scorch a whole lane.

Between waves you pick one of three procedurally generated relics. Six regions
of ten waves each end in a boss; after the dragon Vael falls the Long Night
goes on forever. When progress slows you can **Rekindle**: start over from
wave 1 for Embers that buy permanent upgrades. That is the incremental loop.

## Core loop

```
             ┌──────────── War Council (between waves) ────────────┐
             │ pick a relic · upgrade castle · place/level party    │
             └───────────────┬──────────────────────────────────────┘
                             ▼ Sound the Horn
 wave: monsters walk the lanes → party fires → kills pay gold → spend gold
       mid-wave (place, level up) → tap ember motes and powerup orbs →
       fire powerups and the Keepfire → final horde flag → clear
                             │
            wall falls? ─────┴──► retry the wave (from its snapshot, keeping
                                  all the gold earned in the attempt) or Rekindle
```

Within a wave the pressure is PvZ's: gold flows in, cards recharge, the lanes
fill. Between waves it is an incremental game's: numbers grow, costs grow
geometrically, relics stack.

## The battlefield

- **5 lanes** along x, 1 cell wide, spaced 1.15 world units in z. The wall's
  front face is x = 0; monsters spawn at x = 10.8 and the visible field ends
  around x = 10.3.
- **Lane opening** (tutorial pacing, PvZ-style): waves 1–2 use only the centre
  lane, waves 3–4 the middle three, wave 5 on all five.
- **Field cells**: columns 0…5 in front of the wall (x ∈ [c, c+1]). The bailey
  starts 3 columns deep; Bailey upgrades open columns 4, 5, 6.
- **Wall slots**: each lane may have a tower. A tower of tier *t* has *t*
  fighting platforms, stepped back and up from the wall (slot *k* at
  x = −0.55 − 0.9k). Units on wall slots are safe from melee; monsters
  that reach the wall hit the wall instead.
- **Obstacles**: each region's battlefield is generated from a seed: a few
  field cells hold a boulder, a gravestone, a crystal or a stump and cannot be
  built on. Never more than one per lane, never in column 0.

## Party (11 cards)

Cards unlock by wave. Placing a card puts it on recharge (PvZ). Tap a placed
unit for its panel: level up (up to 10) or sell for 60% of the gold invested.
Perks arrive at levels 3, 6 and 10.

| Card | Wave | Cost | Place | Power | Perks (3 / 6 / 10) |
|---|---|---|---|---|---|
| Archer | 1 | 75 | any | arrows down the lane, hits flyers | pierce 1 / twin shot / 25% crit |
| Alchemist | 2 | 50 | any | brews 12 gold every 10 s (PvZ's sunflower) | +30% gold / mending draught for neighbours / +60% gold |
| Knight | 3 | 100 | field | high-HP blocker, sword | −25% damage taken / cleave / taunts 3 lanes |
| Palisade | 4 | 75 | field | very high-HP barricade | spikes / iron-shod +50% HP / thornwall slows |
| Pyromancer | 6 | 175 | any | fireballs with splash and burn | bigger blast / burning ground / twin fireballs |
| Frost Witch | 8 | 150 | any | ice shards that slow | longer slow / 15% freeze / shatter (frozen foes take ×2) |
| Dwarf Bombardier | 11 | 200 | any | lobs exploding barrels (ground only, splash reaches neighbour lanes) | knockback / cluster bomblets / mega keg |
| Cleric | 14 | 125 | any | heals nearby units and repairs the wall; holy bolts (×2 vs undead) | bigger heals / cleanse & shield / sanctuary aura |
| Ballista | 18 | 250 | any | bolt that pierces the whole lane | faster reload / stun / twin bolt |
| Druid | 22 | 175 | field | roots the first foes ahead in thorns | longer roots / roots 4 / entangle whole lane |
| Storm Caller | 26 | 300 | any | chain lightning across lanes | +2 jumps / stun / storm surge |

Damage types: **physical, fire, frost, shock, holy**. Regions and elite
affixes resist or are weak to some of them, so a balanced party matters.

## Castle upgrades (the Keep panel)

| Upgrade | Levels | Effect |
|---|---|---|
| Walls | 1–15 | max wall HP ×1.28 per level; looks: palisade → stone → banded stone with banners |
| Towers (per lane) | tier 0–3 | each tier adds a fighting platform on that lane; the centre tower starts at tier 1 |
| Bailey | 3–6 columns | how deep into the field you can build |
| Forge | 0–20 | +12% damage for the whole party per level |
| Treasury | 0–12 | +8% gold per kill, interest at wave end, slow income during waves |
| Keepfire Beacon | 0–10 | unlocks and powers the Keepfire (a lane-long firestorm charged by kills) |
| Spiked Ramparts | 0–8 | monsters hitting the wall take damage |

The castle model is built from this state: towers rise floor by floor with
balconies and conical or crenellated roofs, walls change material, and the
central keep gets bigger as total investment grows (more turrets, banners,
the beacon brazier on top).

Wall HP refills between waves.

## Monsters

Every run rolls its own species from the run seed. A region's roster says
which **archetype** fills each role and which **body plan** to use; the
generator then rolls proportions, palette (region palette + hue jitter),
features (horns, ears, tusks, eye count and glow, helmets, armour, weapons,
tails, wings, spikes) and a name ("Mossback Gnasher", "Cinderjaw Reaver").
Each individual also jitters slightly in size and tint.

Body plans: **biped** (goblin → troll), **quadruped** (wolves, lizards, hounds,
drakelings), **flyer** (bats, imps, drakes, marsh flies), **blob** (slimes),
**wraith** (floating cloaks), **siege** (catapults with crews), plus six
hand-composed bosses.

| Archetype | Behaviour | Counter |
|---|---|---|
| Grunt | walks, hits blockers and the wall | anything |
| Runner | fast, fragile | early damage, slows |
| Shieldbearer | frontal shield absorbs projectile hits | barrels, lightning, Keepfire (bypass the shield) |
| Ranged | stops at range and shoots field units / the wall | ballista, burst damage |
| Flyer | flies over blockers straight to the wall | archers, mages, ballista (barrels can't hit air) |
| Sapper | runs in and explodes on a blocker or the wall | kill it early; palisades soak it |
| Shaman | heals nearby monsters | focus fire |
| Leaper | vaults over the first blocker | a second blocker |
| Burrower | tunnels under the field; only explosions hurt it until it surfaces | barrels, meteors, earthquake |
| Splitter | splits into two smaller copies on death | splash |
| Brute | slow, huge HP, smashes blockers | everything |
| Siege | stops far out and lobs boulders at the wall | ballista, storm, Keepfire |
| Treasure carrier | runs in, turns and flees; drops a powerup and a sack of gold | burst |

**Elite affixes** (from wave 5, chance rising with the wave): Armoured
(−40% physical), Warded (−40% magic), Swift, Regenerating, Giant, Vampiric,
Explosive (bursts on death), Frenzied (faster as it bleeds). Elites glow and
carry the affix in their name.

## Regions and bosses

| # | Region | Look | Roster | Resists | Boss (wave 10·n) |
|---|---|---|---|---|---|
| I | Greenmarch | spring meadows, oaks, standing stones, day → dusk | goblins, wolves, goblin archers, bats, goblin sappers, hobgoblin shields, trolls | — | **Bramblejaw, the Warg King**: goblin chieftain on a giant warg; howls up wolf packs, lunges across lanes |
| II | Mirefen | swamp, dead willows, reeds, fog, fireflies | bog ghouls, marsh lizards, lizardfolk shields, slimes, will-o'-wisps, mud lurkers (burrow), bog hags (heal), bog trolls | frost −, shock + | **The Mire Mother**: a vast toad; spits acid at the party, submerges to heal, spawns tadpole slimes |
| III | Ashen Pass | volcanic pass, basalt, lava rivers, ash fall | orcs, hellhounds, orc warlocks, imps, kobold sappers, orc catapults, reavers (leap), ogres | fire − | **Warlord Skarn**: an orc warlord on a war-rig; hurls axes, war-cries, stomps the field |
| IV | Frostfell | snowfields, ice spires, blue pines, snowfall | frostkin, snow wolves, ice knights, frost wraiths, frost shamans, ice worms (burrow), yetis, frost giants (siege) | frost −−, fire + | **The Rime Colossus**: an ice giant; freezes party members, raises ice walls, hurls boulders |
| V | Gloamhold | necropolis, gravestones, dead trees, green moon | skeletons, ghoul hounds, death knights, skeleton archers, banshees, necromancers, plague blobs, bone giants, ghouls (leap) | undead: holy ++, fire + | **Morvane the Lich**: teleports between lanes, raises the dead, bone shield, soul drain |
| VI | Dragonspire | obsidian spires, red sky, ember fall, bones | kobolds, drakelings, dragonguard, cultists, drakes, kobold firebombers, kobold ballistas, wyrmspawn, dragonkin (leap) | fire −−, shock + | **Vael, the Black Sun**: the dragon; flies (air), breathes fire down a lane, summons drakes, lands at half health |

Each region keeps its battlefield for its ten waves while the time of day
advances from morning to night, so every boss fight is at night.

After wave 60, **the Long Night**: regions cycle with darker grading, every
tenth wave is a boss again, and scaling never stops.

## Waves (procedural)

`genWave(wave, region, seed)`:

- **Budget** grows with the wave (≈ 6 + 4.2w + 0.11w²); every archetype has
  a cost. Boss waves spend half on escorts.
- **Roster growth**: a region introduces its archetypes one per wave; a new
  species gets a "New foe" card before the wave starts.
- **Groups**: 3–4 groups separated by lulls, then the **final horde** (≈35% of
  the budget, denser, with a horn and banner), like PvZ's flags. A progress
  bar with flags shows where you are.
- **Elites** from wave 5, **treasure carriers** from wave 3.
- **Scaling**: HP × (1 + 0.1(w−1)) · 1.085^(w−1); damage × (1 + 0.06(w−1)) · 1.03^(w−1);
  bounty × (1 + 0.12(w−1)). Bounty grows slower than HP, which is what keeps the
  castle upgrades meaningful and makes the late game a wall that Rekindling climbs.
- **Frenzy**: 45 s after a wave's schedule ends, its monsters speed up and shrug
  off crowd control, so a wave can never stall (a frozen, regenerating elite
  against a healed blocker once did).

## Pickups and powerups (during a wave)

- **Gold** from kills flies to the counter by itself.
- **Ember motes** drift down from the sky every 10–14 s; tap for bonus gold
  (PvZ's sun). They fade after 8 s.
- **Powerup orbs** drop from kills (≈3.5%, more from elites, always from
  treasure carriers and bosses). Tap to stash in the quickbar (3 slots). Each
  orb rolls a type and a rarity (common ×1, rare ×1.5, epic ×2.2):
  Meteor (tap a spot), Frost Nova, Thunderstorm, Rally Horn, Mending Light,
  Midas Touch, Arrow Rain (tap a lane), Earthquake. Power scales with the wave.
- **Keepfire**: charges from kills; tap it, then a lane.

## Relics (between waves, procedural)

Pick one of three (four with the Ember perk), or take gold instead. You hold
at most eight relics; a ninth replaces one you choose. (Uncapped relics let the
party outscale any HP curve, which the balance bot found in its first run.) Rarity: common, rare, epic,
legendary; affixes 1/2/2/unique+1. Stat affixes: damage, attack speed, gold,
wall strength, crit chance, crit damage, party health, blast radius, slow,
card recharge, party cost, powerup drops, Keepfire charge, per-unit damage,
per-element damage. Legendary uniques: Flamefletch (arrows ignite), Bulwark
Oath (blockers reflect), Cluster Kegs, Ember Heart (burning ground), Winter's
Grip (slowed foes take +25%), Stormglass (+2 jumps), Phoenix Feather (the
wall survives one lethal blow a wave), Hunter's Mark (first hit ×2), Second
Wind (party regenerates), Warhorn of Aldmere (waves start with Rally), Gilded
Ledger (double interest), Treasure Sense (a carrier every wave).

Names are assembled from the affixes ("Ashen Sigil of Swiftness") and the
icon is drawn on a canvas from the relic's noun, rarity and colours.

## Incremental meta: Rekindling

Reach wave 15 and you may **Rekindle**: the run resets to wave 1, and you get
Embers = ⌊0.5 · best wave^1.4⌋. The Ember Tree (permanent):

| Perk | Ranks | Effect |
|---|---|---|
| Hearth's Warmth | 10 | +20% starting gold |
| Old Stones | 10 | +8% wall HP |
| Battle Hymns | 10 | +6% party damage |
| Quick Hands | 5 | −6% card recharge |
| Prospector | 10 | +6% gold from foes |
| Veterans | 3 | new party members arrive one level higher |
| Scavenger | 5 | +15% powerup drops |
| Lodestone | 1 | ember motes and powerup orbs collect themselves |
| Masonry | 4 | start with another tower |
| Time Warp | 1 | ×3 game speed |
| Relic Lore | 1 | four relics to choose from |
| Forward Camp | 3 | start at wave 6 / 11 / 16 with the gold to match |
| Deep Pockets | 1 | one more powerup slot |

Saves go to localStorage at every wave start; the Treasury keeps earning
while you are away (capped at two hours, a quarter rate).

## Controls

- **Place**: tap a card, then a glowing slot (or drag the card onto the field).
- **Unit panel**: tap a placed unit. **Keep panel**: tap the castle or the
  Keep button (pauses the game).
- **Pickups**: tap them (generous hit radius in screen space).
- **Keys**: 1–9/0/- select cards, Q/W/E powerups, F Keepfire, Space start
  wave / pause, S speed, K keep, Esc cancel / pause, M mute.
- **Phones**: in portrait the camera swings behind the castle so the lanes run
  up the screen (the castle sits at the bottom); in landscape the castle is on
  the left, and on landscape phones the camera crops most of the keep and
  "Sound the Horn" moves into the card bar so the lanes stay big enough to tap.
  Tap targets ≥ 44 px; the card bar scrolls sideways; pickups have a larger
  touch radius than mouse radius.

## Presentation

- **Camera** fitted to the play area every resize: the bounding box of keep +
  field is projected and the distance and target are solved so it fills the
  space between the HUD bars on any aspect ratio.
- **Look**: low-poly flat-shaded models built from merged primitives with
  vertex colours (one geometry per species part, one material per actor for
  hit flashes). Canvas-painted ground with a PvZ lane checker, biome scenery,
  gradient sky dome with sun/moon and clouds, layered mountain silhouettes,
  fog, static shadow map (re-rendered only when the castle changes), instanced
  blob shadows and HP bars, pooled point lights, additive particles, bloom on
  medium/high quality.
- **Juice**: hit flashes, knockback, screen shake on barrels and boss stomps,
  floating damage numbers (crits bigger), gold coins flying to the counter,
  dust when the castle grows, wall cracks and smoke at low HP, slow-mo on the
  boss kill.
- **Audio**: synthesised SFX (bow, fireball, barrel boom, ice chime, zap,
  ballista thunk, coins, wall crunch, monster voices pitched per species, boss
  roars, horns) and a generative medieval score per region (drone, plucked
  lute arpeggios, frame drum in battle, a horn lead for bosses).
- **Thumbnails**: unit cards, bestiary entries and wave previews are rendered
  from the same procedural models into an offscreen target.

## Story

Light and in the margins: region title cards, a line from Castellan Brannoc
before each region, a taunt from each boss, party barks as tips, and an ending
after Vael. The Night-tide comes from the Black Sun, Vael's eclipse; the
Keepfire is what it wants.

## Architecture

```
game-056/
  index.html  style.css  game-plan.md
  js/config.js        all tuning data: units, castle, archetypes, regions, relic & powerup tables
  js/sim/rng.js       mulberry32 + hash (no Math.random in the sim)
  js/sim/species.js   procedural species (body plan params, palette, name)
  js/sim/waves.js     procedural wave composition and spawn schedule
  js/sim/relics.js    procedural relic generator + aggregated modifiers
  js/sim/world.js     the simulation: grid, units, enemies, projectiles, pickups, waves, events
  js/sim/bosses.js    six boss behaviours
  js/sim/meta.js      economy helpers, save/load (de)serialisation, rekindle
  js/sim/bot.js       an auto-player (tests, balance, the title attract mode)
  js/view/scene.js    renderer, camera fit, lights, sky, post
  js/view/terrain.js  procedural battlefield per region
  js/view/castle.js   procedural castle from castle state
  js/view/models.js   procedural unit / monster / boss models
  js/view/fx.js       particles, projectiles, beams, numbers, lights
  js/view/view.js     sim → scene sync, picking
  js/view/thumbs.js   offscreen thumbnails
  js/audio.js         SFX + generative music
  js/ui.js            DOM HUD, panels, screens
  js/main.js          boot, state machine, loop, input, saves
  dev/simtest.mjs     headless: purity, invariants, determinism, bot campaign + balance
  dev/browsertest.mjs Playwright: desktop flows + touch-only phones, no console errors
```

`js/sim/` never imports three.js, never touches the DOM and never calls
`Math.random`, so a wave replays exactly from its seed and the bot can play
the whole campaign in Node.

## Testing

- `simtest.mjs`: purity scan, per-tick invariants (no NaN, enemies inside
  bounds, HP ≤ max, gold ≥ 0), determinism (same seed and inputs → same
  state hash), every archetype and boss exercised, save round-trip, rekindle
  maths, and a bot campaign through all 60 waves with a balance table
  (waves needing retries, wall HP left, gold curve).
- `browsertest.mjs`: title → new game → place cards → wave → pickups →
  unit panel → keep panel → relic choice → boss → defeat/retry → ember tree;
  touch-only phones in portrait and landscape; zero console errors.

## Balance (bot-derived)

See `dev/README.md`. Early regions are learnable, each region's boss is the
real check (the first boss takes the wall to 0% for the bot), Mirefen and Ashen
Pass press hardest mid-campaign, IV–V give breathing room and Vael takes many
attempts. Retries keep their gold, so a stuck wave is always winnable by
grinding; Rekindling makes it faster.

## Open questions

- Whether mid-wave castle upgrades should pause (they do now: it is a
  single-player game and phones need the breathing room).
- Balance is bot-derived first; hand-play should decide boss HP.
