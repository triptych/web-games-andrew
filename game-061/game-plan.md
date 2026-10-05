# STARWRIGHT

**Genre:** Space exploration / mining / trading sim with light combat (in the spirit of Elite, Freelancer, Starpoint Gemini and No Man's Sky, scaled to a browser)
**Engine:** three.js r165 (ES modules, import map, `EffectComposer` + `UnrealBloomPass`), Web Audio, DOM/CSS for the HUD and menus
**Assets:** none. Every ship, planet, star, asteroid, station, alien face, name, quest, sound and note is generated in code from one **seed**.
**Status:** v1.0.0

---

## 1. Concept

You are a newly licensed **Wright** of the Free Guild: a builder-pilot with a tiny one-seat skiff, a few hundred credits and the deed to a derelict outpost, **Hearth**, orbiting a planet at the edge of the galaxy. The galaxy is large, procedurally generated and full of strangers.

Mine asteroids, scoop gas and starlight, scan planets, salvage wrecks and trade with alien species. Bring it all home to rebuild Hearth into a thriving station, and use what Hearth makes to rebuild your ship: bigger holds, stronger lasers, shields and finally a **warp drive** that takes you to other stars. Each warp tier reaches further, and something waits at the galactic core: the source of the **Lattice Signal** that every species has heard and none can reach.

The pillars, in order:
1. **Gathering**: mining is tactile and juicy (a beam that cuts, rocks that crack, ore that streams into the hold).
2. **Building**: Hearth grows visibly, module by module, and you can fly around it.
3. **Upgrading**: every upgrade changes how the ship flies, what it can mine and where it can go.
4. **Trading and diplomacy**: each species wants and makes different things, and remembers how you treat it.
5. **Exploring**: every system is new, and the map fills in as you fly.
6. **Light combat**: raiders and hostile aliens ambush you now and then. Fights are short and readable, and you can always run.

### The seed
A seed (any text, e.g. `ORION-7`, or a random one) determines the whole universe: star positions, systems, planets, belts, species, their faces, names, languages and economies, the stations, your starting ship design, and the mission boards. The seed appears on the title screen, in the pause menu and in the save, and `?seed=TEXT` in the URL starts a voyage in that universe. Two players with the same seed get the same galaxy. What happens in it (depleted rocks, prices you moved, quests you took) is your own save.

---

## 2. Look and feel

### Space
- **Skybox:** a per-system procedural nebula (FBM noise on the inside of a sphere, coloured from the system's palette and tinted by its star), three layers of point stars, and a faint galactic band whose angle comes from the system's position in the galaxy. Each system looks different from the moment you arrive.
- **Star:** an emissive sphere with an animated granulation shader, a soft additive corona and a radial halo sprite, plus a directional key light coloured by spectral class (M red → O blue). Bloom makes it the brightest thing in the sky.
- **Planets:** one shader handles every type: rocky, desert, ocean, terran, ice, lava (emissive cracks), toxic, gas giant and ice giant (banded, with turbulent storms). The planet type picks the palette and the noise style. Each planet has a fresnel atmosphere shell, a day/night terminator, and city lights on the dark side of inhabited worlds. Some gas giants have banded, semi-transparent rings, and some planets have moons.
- **Asteroids:** eight noise-displaced base rocks, drawn as instanced meshes per composition. Stony, metallic, icy and carbonaceous rocks use different colours and roughness, and crystalline rocks glow from emissive veins. Belts read as rivers of rock: collidable clusters plus thousands of instanced dust rocks that are only for the look.
- **Ships:** procedurally assembled from parts (a lathe-turned fuselage, wings, engine nacelles, fins, a cockpit canopy, greebles), mirrored for symmetry and merged into one geometry with vertex colours for the paint scheme. A ship's class adds parts and size. Engines have glowing nozzles, cones that flare with throttle and ribbon trails. The player's ship is generated from the seed and can be re-rolled at the shipyard.
- **Stations:** alien stations are assembled in the species' style language (ring, spindle, spiky, organic pod-cluster, crystalline lattice) and colours, with blinking docking lights and slow rotation. **Hearth is built from the modules you have built**, laid out around the command core, so it visibly grows.
- **Effects:** additive laser bolts, a cutting mining beam with sparks and ore streams, explosions (flash, fireball sprites, sparks, debris and a shockwave ring), a shield hit bubble, cruise speed-lines and space dust, and the warp sequence (charge glow, star streaks, FOV punch, white flash, arrival bloom).
- **Post:** bloom, vignette, a touch of chromatic aberration at speed, and ACES tone mapping. Quality tiers scale the pixel ratio, bloom and particle budgets, chosen by pointer type and adjusted by measured frame rate.

### Interface
A clean, glassy sci-fi HUD in DOM and CSS:
- **Palette:** deep navy glass, cyan edges (`#5ef0ff`), amber for anything you can press (`#ffb547`), coral for danger (`#ff5470`), mint for good news (`#6bffb0`). Panels have clipped corners and faint scanlines.
- **Fonts:** Orbitron for headings and numbers, Rajdhani for body text (Google Fonts, falling back to system sans).
- **In flight:**
  - top left: hull, shield, energy, fuel and cargo bars
  - top centre: system name, the current alert and the speed readout
  - top right: credits and data
  - bottom left: an **Elite-style 3D scanner** (an ellipse with stalked blips)
  - bottom centre: throttle and cruise gauge, and mining heat
  - bottom right: target card (name, type, distance, composition, hostility)
  - right: quest tracker
  - left: toast stream ("+6 Ferrite", "Cargo full")
- **World markers** are drawn on a 2D overlay canvas: brackets on POIs, off-screen arrows, a lead pip on hostiles, the nav-target diamond, and distance labels.
- **Menus** are full-screen panels with tabs, slid in over a dimmed, blurred world: Station (market, missions, services, talk), Hearth (overview, build, refinery, fabricator, shipyard, research, storage), Galaxy map, System map, Journal (quests, codex, stats), Settings and Pause.
- **Alien portraits** are drawn procedurally on a 2D canvas from each species' body plan (insectoid, cephalopod, reptilian, avian, crystalline, fungoid, mammalian, amphibian), with eye count, mouth type, crests, antennae, markings and palette. A species' face appears on its stations, comms and codex entry.

---

## 3. Controls

| Action | Keyboard | Mouse | Gamepad | Touch |
|---|---|---|---|---|
| Steer (yaw/pitch) | A D / ← → yaw, ↑ ↓ pitch | ship steers toward the cursor (deadzone in the centre) | left stick | left-side drag stick |
| Throttle | W / S (X = full stop) | wheel | right stick Y / LB-RB | throttle slider |
| Boost | Shift | | B | BOOST |
| Fire weapons | Space | left button | RT | FIRE |
| Mining beam | Q | right button | LT | MINE |
| Interact (dock, scan, salvage, pick up) | E | | A | contextual ACT button |
| Next target / nearest POI | T / R | click a marker | RB tap / Y | tap a marker |
| Cruise / autopilot to target | C | | X | CRUISE |
| Galaxy map | G | | Back | MAP |
| System map | Tab / N | | | SYS |
| Journal | J | | | LOG |
| Pause / back | Esc / P | | Start | ❚❚ |
| Mute | M | | | in settings |

Mouse steering can be switched off in Settings (then the mouse only fires and mines), and Y can be inverted. On touch, the left drag stick is **relative** (it anchors where your thumb lands), the action buttons sit in the bottom right, menus are thumb-sized, and the pause button is top right. Keyboard control takes over from the mouse the moment a steering key is pressed.

---

## 4. The galaxy

### Generation (`js/sim/galaxy.js`)
- **150 systems** in a four-armed spiral disc about 110 ly in radius, placed by rejection sampling along log spirals plus scatter (minimum spacing 4 ly).
- **Home** sits on the rim. **The Core** ("The Lattice") is at the centre, inside a **void** with no systems within 24 ly, so only a Warp V drive (30 ly) can reach it.
- **Connectivity fix-up:** at Warp III range (16 ly) every system must be reachable from home. Disconnected components get bridging systems added at the midpoint of their closest pair until they are. Home always has at least four systems within Warp I range (7 ly), including one with a station. The tests check both rules on 50 seeds.
- **Danger** (0–5) rises toward the core and in pirate and hostile territory. **Richness** rises with danger: rarer rocks, better loot.
- **Territories:** eight species, each with a home system spread around the disc. Systems join the nearest home within a territory radius (Voronoi), and the rest are unclaimed frontier. A few frontier systems become **Reaver** (pirate) havens.

### A system (generated on first visit from a sub-seed of the galaxy seed)
- **Star:** spectral class M, K, G, F, A, B or O, or a white dwarf. Class sets the colour, size, luminosity and the frost line.
- **Planets:** 2–8 on static orbits. The type comes from the orbit's temperature (inside the frost line: lava, desert, rocky, terran, ocean, toxic; outside: ice, gas giant, ice giant). Each has a size, a tilt and a spin, maybe rings and moons, maybe an inhabited flag, and a "scan value".
- **Belts:** 0–3 rings of asteroid **clusters**. Composition comes from distance (icy beyond the frost line, metallic close in) and richness. Crystalline rocks (Iridium, Voidstone) only appear at danger ≥ 2.
- **Stations:** 0–3 for the territory's species (outpost, trade hub, shipyard, refinery or embassy), each orbiting a planet. Reaver havens get a pirate den.
- **Points of interest:** derelicts (salvage, sometimes a trap), anomalies (scan for Exotic Matter and data, sometimes a precursor shard), resource caches, nav beacons (reveal nearby systems on the map) and quest locations.
- **Ambient traffic:** NPC traders fly between stations and planets so inhabited systems feel alive.

### Scale and travel
Stars are 300–900 units across, planets 40–260 and orbits 2 000–22 000. Normal flight tops out at 50–140 u/s, which is right for mining and dogfights. **Cruise** (C) charges for 1.5 s and then accelerates up to 3 000 u/s. While cruising the ship steers itself to the nav target and drops out on arrival. You can't engage cruise near a station (mass lock) or with hostiles within 1 200 u. In dangerous systems, cruising can be **interdicted** by raiders.

**Warp** (Galaxy map → pick a star in range → ENGAGE, or H with a plotted target) costs **Warp Cells**, one per 4 ly rounded up, charges for 3 s and plays the warp tunnel. You arrive at the edge of the target system, facing its star.

---

## 5. Gathering

### Resources
| Tier | Resource | Where |
|---|---|---|
| 1 | Ferrite, Silicate | stony and metallic rocks everywhere |
| 1 | Water Ice, Carbon | icy and carbonaceous rocks, mostly outer belts |
| 2 | Titanium, Cuprite | metallic rocks (mining laser II) |
| 2 | Helium-3 | gas giant atmospheres (gas scoop) |
| 3 | Iridium | crystalline rocks, danger ≥ 2 (laser III) |
| 4 | Voidstone | crystalline rocks, danger ≥ 3 (laser IV) |
| 4 | Exotic Matter | anomalies, Voidstone rocks, precursor sites |

### Mining
Hold **Q** (or the right mouse button) with an asteroid near the crosshair and in range. The beam locks on, cuts and heats the laser, and ore streams into the hold at the laser's rate, in proportions set by the rock's composition. Rocks shrink as they are depleted, crack apart at zero, and regrow after 20 minutes of game time. Each rock has a **hardness**, and a laser below that tier can't cut it ("Laser too weak: need Mk III"). Overheating locks the beam until it cools. A full hold stops mining.

### Other gathering
- **Fuel scooping:** with a scoop, skim a star's corona (inside 1.6× its radius) to refill Warp Cells. Closer than 1.25× cooks the hull.
- **Gas scooping:** with a Mk II scoop, skim a gas giant's upper atmosphere slowly to collect Helium-3.
- **Scanning:** hold E near a planet for **Survey Data**. A first scan pays far more, and inhabited and exotic worlds pay extra. Anomalies give Exotic Matter, data and lore.
- **Salvage:** derelicts and dead raiders drop canisters of resources, goods, credits and rare components.

**Data** is a wallet of its own: sell it at any station's cartographer for credits, or feed it to Hearth's Research Lab.

---

## 6. Hearth (your base)

Hearth starts as a derelict **Command Core** with four empty module slots. You build and upgrade modules with credits and materials from Hearth's own storage. Docking at Hearth offers **Unload all** to move the hold into storage. Every module draws power, and when demand outstrips supply, production slows proportionally.

| Module | Does | Notes |
|---|---|---|
| Command Core (Lv 1–8) | sets module slots (5 + 2/level), the module level cap (1, 2, 2, 3, 4, 5…) and power +6 | the main upgrade track |
| Solar Array | +8 power per level | |
| Silo | +250 storage per level | storage starts at 300 |
| Refinery | every enabled recipe runs one batch per cycle (6 s ÷ level) from storage | keeps a raw **reserve** (default 20) for building, and pauses a recipe once its product reaches a **stock cap** (default 150) |
| Fabricator | crafts Warp Cells, Repair Nanites, Mining Charges, drones and the Lattice Key | instant |
| Shipyard | allows ship upgrades up to Mk = level, and hull classes | needed for any upgrade |
| Drone Bay | mining drones bring home-belt ore over time | idle income |
| Hydroponics | grows Food Rations over time | sell them |
| Research Lab | turns Data into Research Points (and unlocks research) | |
| Trade Depot | auto-sells surplus you mark, at 75% of base price | |
| Defense Grid | turrets; protects Hearth from raids | raids while you're away take storage unless defense ≥ raid strength |
| Embassy | +standing gains, diplomatic missions, better prices | |
| Warp Beacon | **Recall**: jump home from anywhere for 2 cells | late game |

Production runs on game time (while you play), so a long trip comes home to full silos.

### Research (Research Lab)
| Tech | RP | Effect |
|---|---|---|
| Warp Theory | 20 | unlocks Warp Drive I (the first big goal) |
| Efficient Refining | 30 | refinery +30% |
| Deep Core Mining | 40 | mining yield +20% |
| Ion Thrusters | 40 | +10% speed and turn |
| Cartography | 35 | data sells for +50% |
| Xenolinguistics | 45 | +10% sell prices with aliens, faster standing |
| Shield Harmonics | 60 | shields +25%, faster regen |
| Drone Swarm | 60 | drone output ×2 |
| Advanced Fabrication | 90 | unlocks Mk IV components |
| Subspace Folding | 120 | warp cells cost 25% less per jump |
| Exotic Physics | 180 | unlocks Mk V components and the Lattice Key |

---

## 7. The ship

**Hull classes:** Skiff → Prospector → Corsair → Voyager → Leviathan. Each class raises base hull, cargo and size, adds parts to the generated model, and caps component Mk (Mk ≤ hull class; the warp drive may run one Mk ahead).

| Component | Mk I → Mk V |
|---|---|
| Engine | top speed 50 → 140, acceleration |
| Thrusters | turn rate 1.2 → 2.6 rad/s |
| Shield | 40 → 320 capacity, regen 4 → 18/s after a 3 s delay |
| Armor | hull ×1.0 → ×2.0 |
| Cargo Hold | +0 → +300 units |
| Mining Laser | 2 → 12 ore/s, hardness = Mk, range 160 → 260 |
| Weapons | pulse blaster → twin → plasma: 6 → 26 per bolt, 4 → 6.5/s |
| Scanner | POI range 2 500 → 9 000, scan speed, shows rock composition (Mk II) and hidden anomalies (Mk III) |
| Warp Drive | none → 7 / 11 / 16 / 22 / 30 ly |
| Fuel Tank | 4 → 16 Warp Cells |
| Scoop | none → fuel (Mk I) → fuel + gas (Mk II) |

Upgrades are built at Hearth's Shipyard for credits and materials. Some alien shipyards also sell components, for credits only, at a mark-up. **Paint** and **design re-roll** are free at the shipyard.

**Destruction:** the hold is lost, a repair fee (10% of credits, minimum 0) is charged and you wake up docked at Hearth. Upgrades are never lost.

---

## 8. Species, trade and standing

### Species (`js/sim/species.js`)
Eight per galaxy, each generated from the seed:
- **Name and language:** a phoneme set (consonant clusters, vowels, an apostrophe habit) generates the species name, its system and station names, and greetings.
- **Body plan and portrait:** body plan, palette, eyes, mouth, crest, markings.
- **Temperament:** Mercantile, Scholarly, Martial, Mystic, Hive or Nomadic. It changes prices, mission types, greetings and how fast standing moves.
- **Tastes:** three goods they **crave** (pay 1.4–1.9×), three they **make** (sell 0.55–0.8×), and one **taboo** (contraband: they won't buy it, and carrying it into their space risks a fine).
- **Ship and station style:** colours and shape language.
- **Standing** with you, from −100 to +100. It rises with trade, missions and killing raiders in their space, and falls with failed missions and contraband. Bands: Hostile < −50 < Wary < 0 < Neutral < 25 < Friendly < 60 < Allied. Friendly gets better prices and more missions; Allied unlocks their shipyard's best stock and a story beat.
- One species per galaxy is **Martial and hostile by nature** (the "swarm"). Its space spawns alien raiders, and it can be calmed but never allied. The **Reavers** are multi-species pirates who are always hostile.

### Markets (`js/sim/economy.js`)
Every station has a market for all 10 raw resources, 9 refined goods and 14 trade goods (Food Rations, Med Kits, Machinery, Electronics, Starsilk, Spice, Xeno Art, Nebula Wine, Arms, Bio-Gel, Data Cores, Gemstones, Antiquities, Stims). The price is the base price, times an **economy** modifier (agricultural, mining, industrial, high-tech, refinery, military, tourism, frontier), times the species' crave/make taste, times a **supply** term. Selling pushes the price down and buying pushes it up, by a few percent per unit batch, and both recover toward baseline over time, so dumping 300 Ferrite at one station is worse than spreading it around. Buy price is sell price × 1.12. Each station's cartographer buys Data, and its services refuel Warp Cells and repair the hull.

---

## 9. Quests

### The main arc: "The Lattice Signal"
Systems, names and the relic sites all come from the seed.

| # | Quest | Goal |
|---|---|---|
| 1 | First Light | mine 20 Ferrite and unload it at Hearth |
| 2 | Foundations | build a Refinery |
| 3 | Open for Business | sell anything at the Waypost (meet your first species) |
| 4 | Eyes on the Sky | build a Research Lab and scan 3 planets |
| 5 | Breaking the Bubble | research Warp Theory, install Warp Drive I, jump to another system |
| 6 | Echoes | the Signal: find the first **Precursor Shard** in an anomaly in system X |
| 7 | Friends Next Door | reach Friendly with the species that runs your local Waypost; they give you a chart to the second shard |
| 8 | The Warlord's Hoard | the second shard is held by the Reaver warlord in system Y. Beat them |
| 9 | Deep Signal | the third shard lies in a hidden anomaly (Scanner Mk III) in the hostile species' space |
| 10 | The Key | research Exotic Physics and fabricate the **Lattice Key** at Hearth |
| 11 | Heart of the Galaxy | install Warp Drive V, jump to the Core, survive the Lattice Wardens and activate the Lattice |

The ending is a short cinematic sequence of text over the Core. Afterwards the Lattice lets you warp to any visited system from anywhere, and free play continues.

### Mission boards (`js/sim/quests.js`)
Each station offers 3–6 missions, regenerated every 8 game-minutes from (station seed, epoch). Up to 6 can be active.
- **Delivery:** carry sealed cargo to a station (same system before warp, 1–2 jumps after).
- **Procurement:** bring N of an item the station needs.
- **Mining contract:** deliver N of a specific raw resource.
- **Bounty:** destroy a named raider captain in a system ("Grix the Ashen, last seen near the Tellu belt"). The target spawns when you approach the marked location.
- **Clear the nest:** destroy N raiders at a belt.
- **Survey:** scan K planets in a system.
- **Salvage:** recover a black box from a wreck that the mission creates.
- **Charting:** visit an uncharted system and scan an anomaly there.
- **Envoy:** carry a diplomatic message to another species' home station (standing with both).

Rewards scale with distance and danger: credits, standing, sometimes data or rare materials. Mission text comes from templates flavoured by species temperament. The journal shows objectives and a **TRACK** button that sets the nav target (and the galaxy route when the target is in another system).

---

## 10. Combat (light)

- **Raiders:** Reaver Skiffs (fast, fragile), Gunships (sturdy) and Warlords (named mission bosses with escorts). **Hostile aliens:** Swarm drones in packs, and Lancers. **Lattice Wardens** guard the core.
- **Where:** ambushes at belts in dangerous systems (a "contacts inbound" warning, then they arrive), interdictions while cruising, mission targets, and raids on Hearth.
- **AI:** approach, then orbit-strafe at range and fire with lead. Fragile ships break off when hurt. Packs flank. Bolts are dodgeable and readable.
- **Player:** forward hardpoints with **aim assist** (bolts bend toward the lead point of a hostile inside a 7° cone), and a lead pip drawn on targets. Shields soak first and regenerate after a delay. Boost burns energy to escape.
- **Loot:** canisters (credits, resources, salvage). A tractor beam pulls them in within 70 u.

---

## 11. Progression pacing

Measured by the macro bot (`dev/macrobot.mjs`). It's a clumsy player that wanders, waits on the refinery and follows a fixed plan, so real players should be noticeably faster.

| Milestone | Bot time (seeds MACRO-2 / MACRO-3) |
|---|---|
| Refinery built | 2 min |
| Research Lab | 14 min |
| Warp Drive I | 41–43 min |
| First Precursor Shard | 54–56 min |
| Warlord chapter begins | 95–105 min |
| Third shard | 6–8 h |
| Lattice Key | 11–14 h |
| Ending | 15–18 h |

Design changes the bot forced, all now in the game: the refinery's raw reserve and stock cap, parallel refinery lines, the "Friends Next Door" chapter (was "befriend two species", impossible before Warp II), generator guarantees for shard 1 (≤ 3 Warp-I jumps) and a Reaver haven 3–6 Warp-II jumps out, richer titanium and crystal belts, lower mid- and late-game credit costs, 40% higher mission pay, and module level 5 at Core 6 instead of Core 8.

## 12. Sound (all Web Audio)
- **Generative music:** each system picks a root and mode from its seed. Slow detuned-saw pads go through a resonant low-pass, sparse bell arpeggios through a feedback delay, and a sub drone. A **combat layer** (pulse bass and noise drums) fades in when hostiles are engaged, and a warm **docked** layer plays in stations.
- **Engine:** a continuous filtered noise plus a saw whose pitch and cutoff follow throttle and speed, with a whoosh for boost and a rumble in cruise.
- **SFX:** pulse lasers, a mining beam (buzz plus crackle, pitched by heat), ore ticks rising in pitch, rock crack, shield hit, hull hit, explosions (noise burst, sub drop), pickups, docking clamps, cruise engage and drop, warp charge and jump, a scan sweep, an interdiction klaxon, a quest-complete chime, a purchase "ka-ching", UI hover and click, and alien comm burbles (formant blips pitched by species).
- Mute (M), with separate music and sound volumes in Settings, and silent in a background tab (`lib/page-audio.js`).

---

## 13. Architecture

```
game-061/
├── index.html          import map (three r165), DOM HUD, menus, touch controls
├── style.css
├── game-plan.md
├── js/
│   ├── main.js         boot, mode machine (title → flight ⇄ docked/menus/map → warp), fixed-step loop, debug hooks
│   ├── config.js       every table: items, recipes, components, hulls, modules, techs, factions
│   ├── rng.js          FNV hash, sfc32 RNG, sub-seeding
│   ├── save.js         guarded localStorage
│   ├── audio.js        music + SFX
│   ├── input.js        keyboard, mouse, gamepad, touch
│   ├── sim/            pure: no three, no DOM, no Math.random
│   │   ├── vec.js      small vector helpers
│   │   ├── names.js    phoneme-based name generator
│   │   ├── species.js  species generation
│   │   ├── galaxy.js   galaxy + system generation
│   │   ├── economy.js  markets
│   │   ├── ship.js     ship stats from components
│   │   ├── base.js     Hearth: modules, power, production, research
│   │   ├── quests.js   mission generation, tracking, rewards
│   │   ├── story.js    the main arc
│   │   ├── ai.js       enemy behaviour
│   │   ├── world.js    in-system flight sim (player, rocks, enemies, bolts, loot, POIs)
│   │   └── game.js     the persistent game state and every action on it (trade, build, warp, dock…)
│   ├── view/           three.js
│   │   ├── renderer.js renderer, composer, bloom, final pass, quality tiers
│   │   ├── sky.js      nebula + stars
│   │   ├── bodies.js   star, planets, atmospheres, rings
│   │   ├── asteroids.js
│   │   ├── shipgen.js  procedural ships
│   │   ├── stations.js alien stations and Hearth
│   │   ├── fx.js       bolts, beams, particles, explosions, trails, warp tunnel
│   │   ├── portrait.js procedural alien faces (2D canvas)
│   │   └── view.js     scene orchestration, camera, sync from the sim
│   └── ui/
│       ├── dom.js      tiny helpers
│       ├── hud.js      bars, scanner, target card, markers overlay, toasts, tracker
│       ├── menus.js    station, Hearth, journal, settings, pause, title
│       └── maps.js     galaxy map + system map (pan, zoom, pinch, side panel)
└── dev/
    ├── simtest.mjs     determinism, galaxy rules on many seeds, flight/combat sim, quests, macro-bot pacing
    ├── macrobot.mjs    plays the full progression through the real game actions
    ├── browsertest.mjs real Chromium: desktop flow + touch-only phones
    ├── play.mjs        run snippets against the live game and screenshot
    ├── persist.mjs     die → respawn → save → reload → continue
    └── README.md
```

The **sim/view split** follows game-040: `js/sim/` never imports three.js, touches the DOM or calls `Math.random`, and a test greps for this. The sim announces events on a bounded `fx` queue, and the main loop drains it into the view, audio and UI. The flight sim runs on a fixed 1/60 s step, and edge-triggered inputs only fire on the first sub-step.

### Event catalogue (sim → view/audio/ui)
`fire`, `efire`, `hit` (shield|hull, pos), `ehit`, `explode` (pos, size), `mine` (rock, amount, res), `rockBreak`, `pickup` (items), `cargoFull`, `heat`, `overheat`, `scanStart`, `scanDone`, `scoop`, `cruise` (on/off/charge), `interdict`, `ambush`, `dockReady`, `warpCharge`, `warp`, `arrive`, `death`, `toast` (text, kind), `quest` (id, state), `story` (stage), `standing` (species, delta), `levelUp`.

---

## 14. Testing
- `dev/simtest.mjs` (Node, no browser):
  - the same seed gives byte-identical galaxies and systems, and different seeds differ
  - galaxy rules on 50 seeds: home has a Warp-I neighbour with a station, everything is reachable at Warp III, the core is only reachable at Warp V
  - every mission generated on 200 boards points at things that exist
  - the flight sim mines a rock, docks, fights raiders and survives 10 sim-minutes with no NaN
  - the economy can't be pumped by buy/sell cycling at one station
  - a **macro bot** plays the whole progression through the real `game.js` actions (mining yield modelled from ship stats) and prints the milestone times against the targets above
- `dev/browsertest.mjs` (Playwright, SwiftShader):
  - desktop: title, then new voyage with a typed seed, fly, mine, dock at Hearth, unload, build, upgrade, the galaxy map, warp, the station market and missions, pause and settings, save and continue
  - touch-only phones at 390×844 and 844×390: controls ≥ 44 px, nothing covered, no sideways scroll
  - fails on any console error, page error or failed request
