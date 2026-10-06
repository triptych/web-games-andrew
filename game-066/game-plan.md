# SCRAPWRIGHT — design notes

A turn-based creature-collecting RPG in three.js r165 with no asset files, set on **Midden**, the planet the galaxy throws its junk at. You play a scrap kid from Cinderwick who finds, repairs, builds and evolves **COM-bots** (Companion Mechanoids), earns eight Cog Seals from the Forgemasters, beats the Furnace Four and the Champion at the Brass Crown Arena, and wins the **Starward Ticket**: passage off-world on the old liner *Aurelia*.

The style is steampunk: brass, copper, rivets, gauges, boilers and steam over rusted spaceship wreckage, with a sepia grade, bloom, film grain and a gear-iris transition.

## The rule on one word

The three letters m-o-n never appear together anywhere in the game: files, identifiers, on-screen text, data. The creatures are COM-bots, currency is cogs (⚙), the dex is the Registry. `dev/simtest.mjs` checks every file and every string the game can display.

## Architecture

```
js/config.js        constants, stat names, statuses, atmospheres
js/rng.js           seeded RNG (no Math.random anywhere in the sim)
js/sim/             pure simulation — no three.js, no DOM
  data/types.js     16 types and the chart
  data/parts.js     78 parts in 7 slots, each with stat weights and a part technique
  data/moves.js     170 techniques with a small effect DSL
  data/traits.js    55 traits
  data/species.js   126 evolution lines → 250 COM-bots
  data/items.js     149 items: repairs, spikes, battle chips, modules, kits, materials, 44 program cards, 8 blueprints, key items
  data/maps.js      64 maps: 9 towns, 8 routes, 6 dungeons, interiors, the Arena
  data/story.js     the cast, Forgemasters, rival teams, scripts, objectives
  dex.js            builds SPECIES from the lines (stats from parts, learnsets, evolutions)
  unit.js           a COM-bot: stats, temperament, calibration, XP, learning, evolution
  battle.js         the turn-based engine; emits events for the view
  ai.js             four levels of opponent
  world.js          grid movement, ledges, sludge, tools, warps, trainer sight
  game.js           state, scripts, prompts, battles, shops, crafting, saving
  pilot.js          an autoplayer that finishes the story (tests only)
js/view/            three.js: renderer + post, sky, materials (noise-weathered metal), procedural
                    bots (botgen), people, overworld, battle stage, particles, portraits
js/ui/              DOM: HUD, dialogue, battle UI, panels, prompts, title and new game
js/audio.js         Web Audio: synthesised music themes and sound effects
js/input.js         keyboard + touch D-pad and buttons
js/main.js          boot, the mode machine, event routing, saving, debug hooks
```

The simulation emits events (`step`, `enterMap`, `spotted`, `battleStart`, battle `hit`/`faint`/`spike`…) and sets one `pending` prompt at a time (`say`, `ask`, `learn`, `evolve`, `evolved`, `repair`, `shop`, `bench`, `locker`, `ending`). `main.js` routes events to the view, UI and audio, shows the pending prompt and answers it with `game.respond(value)`. Nothing in `js/sim` waits on the view, so the pilot plays the same game headless.

## COM-bots are built from parts

Every bot is a set of parts in seven slots: chassis, locomotion, head, eyes, arms, back and an overlay (crest, antenna, glow). Each part has stat weights and tags, and the species' base stats are derived from its parts and types. The same part list drives `js/view/botgen.js`, which assembles the 3D model from procedural pieces (boiler drums, egg pods, treads, spider legs, hover jets, saw arms, smokestacks, dish antennas…) in the line's palette. The registry portraits are renders of those models.

**Evolution installs parts.** Each stage of a line adds or swaps parts (a Furnacle gains a second smokestack and piston arms), gains a trait, and the new parts bring their part techniques. The evolved screen lists exactly what was installed. Lines evolve by level (100), by installing an upgrade kit crafted at the workbench (19) or by high sync, the bond that grows as a bot fights and travels with you (5).

## Getting bots

- **Wild**: walking through scrap drifts (and the sludge, on the hover skiff) can start a battle. Weaken the bot and throw a **Reboot Spike** (or Brass, Tesla, Clockwork…). Status and low hull help.
- **Wrecks**: eleven dormant bots lie half-buried around Midden. Bring the listed salvage and weld three joints in a timing minigame; better welds give better calibration (the hidden per-stat quality).
- **Blueprints**: eight blueprints, found in houses and wrecks, build a bot at the workbench from materials.
- **Titans**: rare legendary bots sleeping in deep places, awake after the story.
- **Starters**: Embrit (blaze), Bubblet (hydro) or Mossbit (moss), rebuilt by Ma Bellows. Vex Coppervane, the rival, takes the one strong against yours.

## Battles

Turn-based singles, six bots a side. Four techniques each, with PP. Kinetic techniques use Torque against Plating; Energy techniques use Arc against Shield; Clock decides who moves first. Type effectiveness from a 16-type chart, critical hits, accuracy and evasion stages, five statuses (Overheat, Corrosion, Short Circuit, Frozen Gears, Powered Down) and five atmospheres (Heat Wave, Acid Rain, Dust Storm, Static Storm, Smog). Traits change the rules (Hover ignores grit, Storm Coil feeds on volt). Battle chips raise stats for a fight, modules are held items. When every technique is out of PP a bot uses Sputter, typeless with recoil, so no fight can stall.

Trainers spot you along their line of sight. Forgemasters, the Syndicate bosses, the Furnace Four and the Champion use the strongest AI, which scores techniques by expected damage, switches out of bad matchups and uses items.

## The road

Cinderwick → Rustfield Flats → **Gasket Gulch** (Cassia, gear) → Cogdune Wastes and the wreck of the *Halcyon* (Sgt. Slag of the Rust Syndicate; the Cutter Torch) → **Boilerburg** (Smokestack Sal, steam) → Sparkmarsh → **Voltspire** (Volta Ferris, volt) → Tumbledown Canyon and the first titan's cave → **Grindstone** (Bramwell Thorne, grit; the Lift Coil) → the Sludgeway → **Port Brackwater** (Captain Ondine Brack, hydro; the Hover Skiff) → the Mirefen Refinery (Madame Verdigris) → **Fumehollow** (Dr. Lysander Mire, toxic) → the Frostline Shelf → **Rimehaven** (Ivarra Frostwhistle, frost; the Arc Lantern) → Skyrail Heights and the dark Heliograph Station → **Aetherton** (Admiral Hexa Vane, aero) → the Syndicate airship *Leviathan* (Baron Oxide) → Victory Causeway → the **Brass Crown Arena**: Rook Ironside (iron), Seraphine Static (signal), Morrow Hollowell (rust), Ashka Nyx (void), then Champion Vex. Win, and the *Aurelia* lifts off. After the ending you can keep exploring, fill the Registry, wake the titans and visit Ma Bellows for one last gift.

Tools open the map as you go: Steam Boots to run, the Cutter Torch through chained fences, the Lift Coil to shift engine blocks, the Hover Skiff over sludge, the Arc Lantern in the dark station, and the Circuit Pass for the Arena.

## Economy and crafting

Cogs come from trainers and selling salvage. Materials (scrap metal, copper wire, springs, rubber, brass gears, glass lenses, moss fibre, coolant…) come from sparkling heaps and wild bots. The workbench crafts 37 recipes: spikes, repair kits, battle chips, modules and upgrade kits, plus blueprint builds. The Parts Exchange in each town sells a stock that grows with your seals and program cards that teach techniques to compatible bots. The Locker stores up to 240 bots and repairs them.

## Look and sound

- Overworld: tile maps rendered as instanced junk piles, ship hulls, cranes, boilers, tesla towers and buildings with painted signs; swaying wire-weed drifts (a shader that bends away from the player), oil-film sludge, biome skies and fog, point lights from lamps, a lantern in dark places, and your lead bot following you.
- Battle stage: a brass ring for Circuit battles or a scuffed clearing in the wild, a foundry hall with spinning gears and braziers for Forgemasters, technique effects per type (projectiles, beams, bolts, steam, rings), debris that bursts off fainted bots, atmospheres with rain, dust and lightning.
- Post: bloom, a grade pass with sepia, vignette, grain, chromatic fringe, heat haze and flashes, and the gear-iris wipe. Four graphics tiers, chosen automatically from the frame rate.
- Audio: every sound and every music theme synthesised with Web Audio; dialogue blips per speaker.

## Controls

Arrows or WASD move, Shift runs (with Steam Boots), Z / Space / Enter is A, X / Backspace is B, Esc / M / Tab opens the menu. On touch screens: a D-pad, A, B (hold to run) and Menu; every menu is also tappable.

## Testing

See [dev/README.md](dev/README.md): `simtest.mjs` (purity, the word rule, data, maps, battles, determinism, saves and the pilot finishing the story) and `browsertest.mjs` (desktop and touch phones in Chromium).

## Open

- Tuned by the pilot and by reading numbers, not by human players; the Furnace Four may need a touch of grinding.
- Not yet played on a real phone or GPU (SwiftShader only).
