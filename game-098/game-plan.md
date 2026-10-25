# Wyrmbond

**Genre:** Dragon-taming tactics RPG: Advance Wars battles, close-up duels, an idle hatchery and a breeding nest
**Engine:** three.js r165, no asset files (models, maps, portraits, eggs, music and sound are all made in code)
**Status:** v1.0.0. Twelve chapters in four acts, 22 dragon species (5 bred-only hybrids), endless Wild Hunts, and a bot that plays the whole campaign on every seed.

---

## Concept

You are Kestrel, the last apprentice of the last free roost in the Skyreach Isles. The Obsidian Empress has collared every dragon she could find with the Chain: iron and binding-hymns that keep dragons docile and drain their fire into something buried under her throne. You raise a single hatchling, then a flock, and fight your way from a hill-village to that throne, freeing chained dragons as you go.

It borrows from three places:

- **Advance Wars** for the battles: a tiled map, terrain stars, fliers with no cover, ground units that dig in, villages and roosts you claim with a two-turn capture for income and healing, roosts you call reinforcements from (the factory), an enemy that musters soldiers at its keeps, commander powers that charge as you fight, the HP-in-tenths badge, and the cut to a close-up head-to-head battle on every attack.
- **Fire Emblem** for the story and the people: a lord who must not fall, guests who fight beside you for a chapter or three, a forecast before every fight, and scenes before and after each chapter.
- **Dragon-raising games** (the idle and breeding kind) for the roost: eggs that hatch in real time while you're away, tap-to-warm, feeding and training rings, a gold hoard, genes you can see, traits that pass from parent to egg, and hybrids that only breeding can make.

The look is a bright, painterly Flash-era cartoon: toon shading in three bands, ink outlines on everything, a brush-painted texture on every board, big friendly eyes on the dragons, parchment UI with chunky pressed-down buttons and a paper-grain overlay.

## Core loop

1. **At the roost** (a 3D diorama with your flock wandering about and eggs glowing in their hearths): hatch what's ready, put new eggs in the incubators, feed, train, breed, shop, collect the hoard.
2. **On the Journey map**, pick the next chapter (or a Wild Hunt), pick the flock that flies (each chapter has a slot count; the rest can be called mid-battle), and watch the opening scene.
3. **The battle**: your phase, then the Chain's. Each unit moves and acts once: Attack (a forecast, then the close-up fight), a Skill, Claim a property, Unchain a collared dragon, or Wait. Win by the chapter's objective; lose if Kestrel falls.
4. **Results**: gold (more for a good rank), story eggs and unlocks, the dragons you freed join the stable, every incubating egg grows warmer. The closing scene. Back to the roost.

Real time passes the whole while: eggs keep warming and training rings keep training during battles, and for up to 8 hours while you're away.

## Battles

### The board
Maps are 12×9 to 16×12 tiles. Each terrain has a move cost per move type (`null` = impassable) and defence stars.

| Terrain | Stars | Walk | Fly | Swim | Ride | Wheel | Notes |
|---|---|---|---|---|---|---|---|
| Grassland | 1 | 1 | 1 | 2 | 1 | 1 | |
| Forest | 2 | 2 | 1 | 3 | 3 | 2 | |
| Hills | 2 | 2 | 1 | 3 | 2 | 2 | |
| Mountain | 4 | 3 | 2 | – | – | – | |
| Sea | 0 | – | 1 | 1 | – | – | |
| Shallows | 0 | 2 | 1 | 1 | – | – | |
| Road / Bridge | 0 | 1 | 1 | 2/1 | 1 | 1 | |
| Bog | 0 | 3 | 1 | 1 | – | – | |
| Lava | 0 | – | 1 | – | – | – | Lavaborn walk it and heal 20% |
| Snowfield | 1 | 2 | 1 | 3 | 2 | 2 | |
| Ruins | 2 | 1 | 1 | 2 | 2 | 2 | Wild Hunt eggs hide here |
| Wyrm Shrine | 2 | 1 | 1 | 2 | 1 | 1 | Heals anyone 20% |
| Crag | 0 | – | 2 | – | – | – | Fliers only |
| Village / Roost / Stronghold | 3/3/4 | 1 | 1 | 2 | 1 | 1 | Property: income, healing |

Allies can be passed through; enemies block. **Fliers get no defence stars** (Advance Wars air units), so a wyvern is fast and fragile and a drake on a mountain is a wall.

### Damage
One blow from `a` to `d`:

```
mult  = element × class × traits × power × rally × commander power
cut   = Thick Hide, Aquatic on water, Lavaborn vs Ember, ward, Iron Discipline, pylons
raw   = (a.ATK × mult − d.DEF × 0.5) × (0.5 + 0.5 × a.HP/a.HPmax) × (1 − 0.06 × stars) × cut
blow  = max(1, raw) × (1 + luck 0–8%) × (crit ? 1.5 : 1)
```

- **Element wheel**: 🔥 Ember › 🌿 Verdant › 🪨 Stone › ⚡ Storm › 💧 Tide › 🔥 Ember (+30% / −25%). ☀️ Lumen and 🌑 Umbra each have the edge over the other. ✨ Aether (Aurelion, Kestrel) and ⛓️ Iron (the Chain's soldiers) are neutral.
- **Class chart** (Advance Wars' damage table in miniature): Skyhook ballistas ×1.7 against wyverns, lancers ×1.3 against drakes, wyverns ×1.4 against siege, wyrms ×1.3 against foot soldiers, hounds ×1.25 against the tamer, and so on (`CLASS_MULT` in `js/sim/data.js`).
- **A wounded attacker hits softer** (half damage at 0 HP), so trading first matters.
- **Counters**: the defender strikes back if it's alive, in range, not stunned and not siege. **Flurry**: 6+ more speed strikes a second time. **First Strike** counters before the blow lands.
- Crits: 4% base, +8% Keen, +12% Nightstalker, +1% per bond heart.

The forecast shows each side's damage as a range and as a share of the other's HP, who strikes twice, First Strike, and whether you'd knock out a dragon you could free.

### Actions
- **Attack** (direct units move and attack; siege engines move *or* fire, range 2–3).
- **Skill** (one per species, rests 2–5 turns; never countered). Kinds: bolt, blast (3×3), chain lightning, push (hurts more against a wall), stun (the target loses its next turn), drain, heal (one or 3×3), ward (−30–40% damage for 2 turns, Thornwall also pricks), rally (+25% damage), refresh (Tailwind: a spent ally acts again), nova (heal allies, sear foes around you).
- **Claim**: a property takes 20 capture points; each claim takes the unit's HP in tenths (dragons claim at half speed, Kestrel and foot soldiers at full). Stepping off resets it. Properties pay 100 gold a turn and heal their owner's units 20%.
- **Unchain** (Kestrel only): a collared dragon at or below half health, next to Kestrel. The chance is `0.95 − 1.4 × HP share + 0.6% per Kestrel level` (20–95%), certain at a quarter or less. A freed dragon changes sides at once and joins the stable.
- **Call** (tap an empty roost you own): bring a stabled dragon onto the map for `120 + 25 × level` gold. It acts next turn.
- **Wyrmsong** (commander power): the meter fills from damage dealt (34 per full HP bar) and taken (22). The song grows with the story: *Ember Song* (+20% damage, +1 move), *Storm Song* (+25%, +1 move, heal 20%), *Wyrmbond Anthem* (+30%, +2 move, heal 30%, shake off stuns). It lasts until your next turn.
- Enemy commanders: **Grisk** — Pack Howl (+20% damage, +1 move); **Varek** — Iron Discipline (−30% damage taken); **Sablethorn** — Bog Hex (your units lose 10% HP and a move next turn); **Nyxara** — Obsidian Eclipse (+25% damage, heal 20%).

### Objectives
Rout (collared strays don't count: they flee when their captors fall), defeat the commander, seize the enemy stronghold (or rout), hold for N turns, bring Kestrel to a tile, free a story dragon. You lose if Kestrel falls, if the Chain claims your stronghold, if a turn limit runs out, or if every dragon is down with none left to call. A hard cap of 60 turns ends a stalemate.

Ranks: `100 − 4 × (turns over par) − 10 × faints + 4 × recruits`, par = 0.55 × (width + height). S +50% gold, A +25%, B +10%.

## The roost

### Eggs
| Rarity | Warmth needed |
|---|---|
| 1★ | 2½ min |
| 2★ | 4 min |
| 3★ | 8 min |
| 4★ | 15 min |
| 5★ | 30 min |

Real time warms every egg in an incubator (2 to start, up to 4). A tap adds 3 seconds; a Hearthcoal adds 5 minutes to all; every victory adds 2 minutes to all. Time away counts up to 8 hours (the game reads the wall clock and hands the sim an `idle` command; the sim itself never reads the clock). Eggs come from the story, Wild Hunts (ruins and the loot roll), the Market, and breeding. The basket holds 16.

### Dragons
- **Stats** = `(base + growth × (level − 1)) × (0.85 + gene × 0.02) + trained points`. Genes are 0–15 per stat (shown as E–S grades), so an S-grade dragon has about a third more than an E-grade one of the same species and level.
- **Levels** 1–40; XP to the next level is `100 × (1 + 0.1 × (level − 1))`. Battle XP is `8 + 32 × damage share (+30 for a knockout, +40 more for a commander)`, scaled by the level gap (0.25×–2.5×).
- **Stages**: Hatchling (1–5), Juvenile (6–11), Adult (12+, can breed), Elder (25+). The model grows at each.
- **Bond** 0–10: +1 per victory (2 with Loyal) and per Sunfruit; +1% crit each.
- **Care**: Roast Boar (+30 XP), Glimmerfish (+100 XP), Sunfruit (+1 bond), Ironroot (+1 trained point in a stat, up to 5; HP gets 2). Training rings (1 to start, up to 3) give 1 XP every 8 seconds of real time. The stable gathers a gold hoard (1 per 30 seconds per dragon) to collect.
- **Kestrel** levels with the flock: never more than one level under the party's average.

### Breeding
Two adults that aren't resting. The egg's species is either parent's, or a hybrid if their elements make one (25%; 60% for Lumen + Umbra). Each gene is `0.6 × the better parent + 0.4 × the worse + (−1.5 … +2.5)`, so lines improve over generations. The egg gets its species' trait, each parent's other traits with 50% each (up to 2), and a 12% chance of a mutation. Colour is the parents' average with a nudge; gilded parents make gilded eggs a quarter of the time (1 in 64 otherwise). Parents rest 10 minutes.

## Content

### Species
| Species | Element | Body | Moves | Reach | ★ | Skill | Trait |
|---|---|---|---|---|---|---|---|
| Cinderwing | Ember | wyvern | fly 6 | 1 | 2 | Flare Burst (bolt) | Swift |
| Ripplefin | Tide | serpent | swim 5 | 1 | 2 | Tidal Crash (push) | Aquatic |
| Mossling | Verdant | drake | walk 5 | 1 | 2 | Bloom (heal) | Regrowth |
| Magmaback | Ember | drake | walk 4 | 1 | 2 | Magma Shell (ward) | Lavaborn |
| Pyrewyrm | Ember | wyrm | walk 4 | 1–2 | 4 | Inferno (blast) | Lavaborn |
| Frostmaw | Tide | drake | walk 4 | 1 | 3 | Frostbite (stun) | Thick Hide |
| Abyssal Leviathan | Tide | serpent | swim 5 | 1–2 | 4 | Maelstrom (blast) | Aquatic |
| Thornback | Verdant | drake | walk 4 | 1 | 2 | Thornwall (ward) | Thorns |
| Sylvan Wyrm | Verdant | wyrm | fly 5 | 1 | 4 | Lifebloom (area heal) | Regrowth |
| Zephyrling | Storm | wyvern | fly 7 | 1 | 2 | Tailwind (refresh) | Swift |
| Thunderhorn | Storm | wyvern | fly 5 | 1–2 | 3 | Chain Lightning | Skybreaker |
| Tempest Wyrm | Storm | wyrm | fly 6 | 1–2 | 4 | Thunderstorm (blast) | First Strike |
| Pebblescale | Stone | drake | walk 4 | 1 | 1 | Stoneskin (ward) | Mountain-born |
| Granitewing | Stone | wyvern | fly 5 | 1 | 3 | Petrify Gaze (stun) | Thick Hide |
| Geode Wyrm | Stone | wyrm | walk 3 | 1 | 4 | Quake (blast round itself) | Mountain-born |
| Solaris | Lumen | wyvern | fly 6 | 1 | 5 | Radiance (nova) | First Strike |
| Noctyx | Umbra | wyvern | fly 6 | 1 | 5 | Shadow Bite (drain) | Nightstalker |
| Obsidian Drake *(Ember + Stone)* | Ember | drake | walk 4 | 1 | 4 | Magma Shell | Lavaborn |
| Mistral Serpent *(Tide + Storm)* | Storm | serpent | swim 6 | 1–2 | 4 | Chain Lightning | Swift |
| Lotus Wyrm *(Verdant + Tide)* | Verdant | serpent | swim 5 | 1 | 4 | Lifebloom | Aquatic |
| Blazewing *(Ember + Storm)* | Ember | wyvern | fly 7 | 1 | 4 | Flare Burst | Nightstalker |
| Aurelion *(Lumen + Umbra)* | Aether | wyrm | fly 6 | 1–2 | 5 | Prism Breath (blast) | Sturdy |

### The Chain
Chain Knight (foot, claims), Chainhound (fast beast that hunts the tamer), Chain Lancer (cavalry, gores drakes), Skyhook Ballista (siege 2–3, shreds fliers), Chain Hexer (Umbra, binds a foe for a turn), and commanders: Captain Grisk, General Varek, Mother Sablethorn, Empress Nyxara. Chain Pylons are structures that shield Nyxara and Vorthax (20% each). The Chain musters at its keeps when it has the coin, picking ballistas when you field many fliers.

### Traits
Swift, Aquatic, Regrowth, Lavaborn, Thick Hide, Thorns, Skybreaker, First Strike, Mountain-born, Nightstalker, Sturdy, Brave, Keen Eye, Hardy, Loyal, Vigilant. The last ten (and a few species traits) can mutate in through breeding.

## Story

**Prologue.** Brannoc, old roostkeeper of Emberfall, sets three warm eggs before Kestrel. You choose: Cinderwing (fire, flies), Ripplefin (water, swims) or Mossling (leaf, walks and heals).

**Act I — Emberfall.**
1. *The Egg of Emberfall*: raiders hit the village the morning your egg hatches. Brannoc and his old Magmaback Ashka hold the gate. Afterwards Captain Grisk's collared wyvern carries Brannoc off, and Pip the roost-kobold makes you keeper.
2. *Chains on the Wind*: Ashen Ford. You learn to claim villages and to sing a collared storm-wyvern free.
3. *Grisk's Den*: a hill-fort with a roost to call from and a keep the Chain musters at. Grisk yields: Brannoc went west to General Varek. Breeding and Wild Hunts open.

**Act II — The Gale Coast.**
4. *Sera of the Gale*: Sera Vael, last sky-knight of the Gale Order, and her Tempest Wyrm Skyla join you. Skyhook ballistas.
5. *The Lighthouse of Tidesreach*: hold the beacon for 8 turns while two keeps pour soldiers at you, until the scattered Gale fleet comes home.
6. *Varek's Blockade*: Varek was Brannoc's first apprentice; he believes chains keep dragons alive against the Wane. Brannoc has been moved to the Chainforge. Sera teaches you the Storm Song.

**Act III — Mire and Frost.**
7. *The Witch of Mirewood*: Mother Sablethorn, who wrote the binding-hymns. Her death weakens every collar.
8. *Thornheart Grove*: free the Sylvan Wyrm from its shrine without letting it fall. It tells you what the Great Chain really is: every collar is a link, and it pours their fire into Vorthax, the eldest dragon, beneath the throne.
9. *Frostpeak Pass*: walk Kestrel through a pass of ballista nests. Brannoc's journal: the third verse of the Wyrmbond is sung to the one who made the chains.

**Act IV — The Obsidian Reach.**
10. *The Burning March*: Varek's last stand over the lava. He yields, not to you but to the dragons, and joins you. The Wyrmbond Anthem.
11. *Brannoc*: break into the Chainforge and reach his cell; free a Noctyx at the anvils. Brannoc gives you the last Solaris egg.
12. *The Great Chain*: Nyxara on the Obsidian Throne, Vorthax bound in the pit, four pylons. Break them and Vorthax remembers the song and turns on her. Ten thousand collars crack across the Isles. Vorthax's last gift is an egg of dawn and dusk: the first Aurelion.

The game has a defined ending, and the roost carries on after it: Wild Hunts, breeding, and the dex of 22 species.

**Wild Hunts** (from chapter 3): a generated 14×10 map in one of seven terrains, Chain poachers at about your flock's level, one or two collared strays to free, sometimes an egg in the ruins. The generator rejects any seed where the two sides can't reach each other on foot.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Cursor | Arrows / WASD | D-pad | — |
| Select, confirm | Space / Enter / Z | A | Tap |
| Back | Esc / X | B | Tap empty ground, right-click |
| Next ready unit | Tab | X | ⏭ |
| Wyrmsong | Q | LB | 🎵 |
| End turn | E | Y | End Turn |
| Pause | P | Start | ❚❚ |
| Pan / zoom | — | — | Drag, wheel, pinch, 🔍 |

Tapping an enemy while a unit is selected picks the best tile in reach to strike from (most cover, then least walking) and goes straight to the forecast. On a portrait phone battles open zoomed in on Kestrel, and the camera follows each move.

## Look and sound

- **Board**: one canvas texture per map painted with brush dabs (each terrain's colour, bleeding a little into its neighbours), roads stroked in two passes so their joins stay clean, a faint grid. Tile tops sit at terrain heights with earth skirts; the whole board floats on an island over an animated sea (or lava). Props are batched per material and merged (one draw call per material, plus ink).
- **Models** (`js/view/models.js`): four body plans from parameters; horns, frills, plates, spikes, crystals, leaves, feathers and glows from each species' `look`; collared dragons wear an iron collar and glow purple. People and soldiers, horses, hounds, ballistas, pylons, eggs. Toon materials (a 3-step ramp) with inverted-hull ink outlines.
- **The close-up fight**: the same scene, 600 units away: two terrain islands painted from the attacker's and defender's tiles, a painted backdrop, both fighters at 2.3× scale. Breath streams in the element's colours, bolts, orbs and lunges, hit flashes, crits, thorns, falling.
- **The roost**: a grassy plateau with a tower, the keeper's house, a pond, a training ring and four hearths; the flock wanders, trained dragons hop about the ring, ready eggs wobble and glow.
- **UI**: parchment sheets with 4 px ink borders, Fredoka and Cinzel Decorative (with system fallbacks), pressed-down buttons, portraits painted in Canvas 2D for every speaker, a paper-grain overlay.
- **Music** (Web Audio, generated): a four-voice band with a pad, bass, plucked arpeggios, a lead whose phrases are composed every two bars from the chord, and drums: a gentle title theme, a pentatonic roost tune without drums, a marching battle theme, and a faster minor boss theme. **Effects**: roars pitched by stage, breath per element, hits and crits, songs that rise when a chain breaks, egg cracks, coins.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the story flow, the real-time clock, the fixed-step loop, input routing, map drag/pinch, debug hooks |
| `js/sim/data.js` | Elements, terrain, classes, species, the Chain, skills, traits, powers, names |
| `js/sim/story.js` | Acts, chapters, maps, armies, objectives, rewards and every line of dialogue |
| `js/sim/map.js` | Map parsing, move costs, Dijkstra reach, distance fields, the Wild Hunt generator |
| `js/sim/dragons.js` | Genes, stats, levels, stages, eggs, breeding |
| `js/sim/battle.js` | Units, the damage formula and forecast, attacks, skills, claims, unchaining, calls, powers, phases, objectives, rewards |
| `js/sim/ai.js` | The planner both sides use; threat maps; mustering |
| `js/sim/game.js` | `newGame`, `act`, `step`, the roost commands, save format |
| `js/sim/bot.js` | The keeper bot: battles, roost care, grinding, the whole campaign |
| `js/view/stage.js` | Renderer, sky, board, props, water, banners, highlights, camera, picking, arena, roost diorama |
| `js/view/models.js`, `paint.js`, `fx.js`, `view.js` | Models, the toon/ink/brush toolkit, particles and tweens, event playback and thumbnails |
| `js/ui/ui.js`, `roostui.js`, `portraits.js` | Screens, dialogue, battle HUD and forecasts; the roost panels; painted portraits and eggs |
| `js/play.js` | The battle controller |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key queue, music and sound, guarded storage, seeded RNG, tuning |

The sim is pure: no DOM, no three.js, no `Math.random`, no clock. Every action goes through `act(G, cmd)` and resolves at once; the view plays the events as a queue and the controller treats undrained events as busy.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the tables and maps, the rules, the roost, determinism and save round trips, and has the bot play the whole campaign on several seeds. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked. `dev/models.html` shows every model on a neutral background.

## Balance notes

What the bot found, and what changed because of it:

- **Levelling was far too fast.** The first run reached level 40 by the finale: fish gave 220 XP, the bot bought four a visit, and every level cost 100. Now food is +30/+100, training is slower, and each level costs 10% more than the last. Six campaigns now reach the finale at about level 22–25 against enemies of level 20.
- **Wild Hunts stalled** with only collared strays left (the bot won't knock out a dragon it could free). Strays are prisoners, not soldiers: rout ignores them.
- **Chapter 8 stalled** at higher levels: any blow would kill the Sylvan Wyrm, so the bot never wore it down. The dragon you came to free can't be knocked below 1 HP by your side and stays collared to its shrine.
- **Kestrel kept dying** in later chapters. The tamer's level only rose from its own actions, ten levels behind the flock by Act III. Kestrel now levels with the flock, has more HP and defence growth, follows the flock instead of chasing strays, and values a bodyguard dragon beside it.
- **The finale fell in 4–8 turns.** Each pylon now shields Nyxara and Vorthax by 20% (80% with all four), so breaking them first is the way through.

A typical campaign (6 seeds): 24–32 battles, of which 10–14 are Wild Hunts, 2–6 story losses, 30+ hatched and 10–19 bred along the way.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. Draw calls are batched, but a big late-game map with 25 dragons has not been profiled on a phone.
- The AI plays one unit at a time, one move ahead. It doesn't plan combined attacks or hold a choke point on purpose.
- A dex screen for the 22 species, and a way to rename an egg before it hatches.
- Weather and fog of war (both Advance Wars staples) are not in.

## Changelog

### v1.0.0 (2026-10-25)
- First release: twelve story chapters in four acts with scenes and painted portraits; Advance Wars battles (terrain stars, property claims and income, calling from roosts, enemy mustering, commander powers, HP badges) with a close-up cut-in for every fight; 22 procedural dragon species with skills, traits, genes and stages; unchaining collared dragons; an idle hatchery in real time, feeding, training rings, a hoard and a market; breeding with inherited genes and traits and five hybrids; endless generated Wild Hunts; music and sound made in Web Audio; touch, mouse, keyboard and gamepad; Node and browser harnesses.
