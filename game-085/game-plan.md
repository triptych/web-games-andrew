# WanderQuest

**Genre:** Idle caravan RPG (mobile first)
**Engine:** Vanilla JS: Canvas 2D (a pseudo-3D road) + DOM panels, no asset files
**Status:** v1.0.0

---

## Concept

An idle adventure where you run a caravan that travels a realm gone dark. Your grandmother's wagon drives itself from town to town: it trades, fights whatever comes down the road, takes on quests and travellers, and keeps going while the game is closed. You check in each day to see what the road brought you, spend what it earned, pick up the morning post and steer it towards the next Waystone.

It riffs on idle RPGs (Idle Slayer, Melvor's offline progress, the "check in each morning" loop of mobile idlers), on trade-route games (Merchant of Venice boards, Port Royale's buy-low-sell-high) and on caravan stories (The Banner Saga's travelling train, Oregon Trail's rations and camps). The tone is cosy: letters from Grandmother Odessa, painted towns, oxen.

The road is drawn like a 1980s racing game: a pseudo-3D road with curves and hills that runs to the horizon, the caravan's carts as real perspective boxes in a train along it, and battles staged on the verge with the camera swinging out to watch.

## Core loop

**Minute to minute (when you're watching):** the caravan rolls along a road; every few miles a fight plays out beside the wagons, an event happens (a cache, a shrine, a wanderer, a broken wheel, a storm) or the caravan reaches a town, where it rests at the inn, trades, takes quests and moves on. Tap the scene or **Rally** to hurry the oxen.

**Each check-in (the real loop):** open the game → the **chronicle** tells you what happened while you were away (miles, towns, fights, gold, quests, gear, level-ups, highlights) → open the **morning post** → hire travellers, upgrade carts and the wagon, sort gear → set standing orders or a course → challenge a Warden if the odds are good → close the game.

**The long arc:** light six Waystones by beating their Wardens; each opens the roads into the next region. Beating the Hollow King at Starhaven is the ending; after it the **Night Roads** go on for ever, each tier darker and richer.

## Mechanics

All rules live in `js/sim/` and run on whole-second ticks (one tick = one real second). Time away runs the same ticks quietly (`advance`), so being away for an hour is exactly the same as watching for an hour; `simtest.mjs` checks this.

### Travel
- Speed `0.14 mi/s × (1 + 6% × Wheels) × Scout bonus × (0.6 if out of rations) × Rally 1.5 × storm 0.7 × shrine 1.25`.
- Roads are 30–80 miles (map distance × 0.4). A fight comes every ~11 miles (×1.3 at night), a road event every ~26 miles, both drawn from an exponential so they never come on a schedule.
- **Camp:** when party health falls below the standing order (default 50%) or everyone is down, the caravan stops and recovers at 1.2%/s until 92%. Downed travellers get up at 25%.
- **Rally:** 20 s at 1.5× speed, 60 s cooldown. Space, the A button, the Rally button or a tap on the scene.

### Supplies
- Each traveller eats a ration every 2 minutes on the road. The larder holds 40 (+25 per Larder level); rations cost 2g in Meadowmere and 45% more per region out. Out of rations: 60% speed, 85% attack, 30% recovery.
- The **inn** in every town heals everyone fully for 1.5g × party level per traveller (half health if you can't pay).

### Trade
- Each town makes some goods (price × 0.62), wants some (× 1.35), and prices the rest by how far the good has come (+10% per region). Prices drift ±10% over a 5-day cycle with a seeded phase per town and good.
- Buying and selling pushes the price (1.2% a unit) and the push fades by a unit every 40 s, so you can't drain one town.
- **Auto-trade** (on by default): fill the larder, sell what fetches ≥ 112% of its cost and ≥ 95% of base, buy goods for quests at a fair price, then spend up to 60% of the purse on local bargains (≤ 80% of base).
- Manual trade on the Town tab: +5 / −5 per good.

### Fights
- Encounters: 1 + 0.6 × (party − 1) monsters (+1 at 35%), up to 6, from the region's families around the road's danger level; 6% have an Elite (×1.7 health, ×1.3 attack, better loot).
- Rounds in speed order. Damage `atk² / (atk + def) × 0.85–1.15 × (1 ± 4% per level of difference)`. Travellers focus the weakest foe; monsters pick at random (Guards draw half the attacks). Healers heal the most wounded below 70%; Alchemists throw a bomb at every foe on every third turn; Scouts crit 20% for ×1.8; a Bard's song is +10% attack; anyone below 35% drinks a potion if there is one.
- Win: experience (× level-gap penalty when over-levelled, × Banner, Cook, Bard and shrine), gold, materials by family, 10% gear (60% from Elites). Rout: lose min(10% of the purse, 15 + 6 × level) and 30% of the biggest cargo stack (Guards reduce both), then camp.
- The caravan stands still for 5 s + 0.4 s a round while the view plays the fight.

### Travellers and their carts
Eight classes join the Captain (you). Each fights and brings a cart that does something for the caravan; cart levels (up to 10, capped at 1 + caravan level ÷ 3) cost gold and the class's material, plus crystal from level 4.

| Class | In a fight | The cart |
|---|---|---|
| Captain | balanced | Grandmother's wagon itself: hold, lantern (upgraded separately) |
| Guard | tank, draws attacks | Armoury Cart: party defence +5 + 2/lvl %, smaller losses in a rout |
| Cook | weak | Kitchen Cart: 1 meat → 3 + lvl rations every ~110 s; "well fed" +4 + lvl % experience |
| Smith | hits hard | Forge Cart: 2 ore + 1 hide/timber → gear every ~260 s, luckier with level |
| Alchemist | bombs every 3rd turn | Apothecary Cart: 2 herbs → a potion every ~150 s (heals 30 + 4/lvl %) |
| Trader | weak | Merchant Cart: +8/lvl hold, sells 4 + 2/lvl % dearer, buys 3 + lvl % cheaper |
| Scout | fast, crits | Outrider's Cart: +4 + 2/lvl % speed, more caches and wanderers |
| Healer | heals | Chapel Wagon: party recovers 60 + 15/lvl % faster |
| Bard | +10% party attack | Stage Wagon: plays every town for gold, +3 + lvl % experience and gold |

Party size by caravan level: 2 at 1, 3 at 3, 4 at 6, 5 at 10, 6 at 15, 7 at 21, 8 at 28. Recruits come from taverns (two per visit, biased by region) or meet you on the road and wait three game days.

### Gear
Weapon, armour, charm. Stats scale with item level × rarity (Common 1, Fine 1.25, Rare 1.6, Epic 2.1, Legendary 2.8); Rare and better often have a second stat. A traveller can wear gear up to two levels above their own. Auto-equip gives each new piece to whoever gains most; auto-sell sells Common and Fine pieces nobody wants (not ones somebody will grow into). The pack holds 24.

### The wagon's upgrades
Iron-shod Wheels (+6% speed, 20 levels), Deeper Hold (+10 cargo, 20), **Great Lantern** (+2 h of travel while you're away, from 8 h to 24 h, 8 levels), Larder (+25 rations, 12), Caravan Banner (+3% experience and gold, 20).

### Quests
- Notice boards: three per visit. **Courier** (go to a town), **Delivery** (carry N of a good to a town; auto-trade buys them and won't sell them), **Bounty** (kill N of a family in a region). Up to five at once; auto-accept is on by default.
- **Daily contracts:** three each real day, 2.5× rewards and a guaranteed Rare-or-better piece of gear.
- **Morning post:** a gift each real day, 10% bigger for every day in a row (up to +100%).

### Standing orders
**Quests** (towards quest targets, Wardens it can beat if auto-challenge is on, then trade), **Trade** (best profit per minute for the cargo or the best bargains for an empty hold), **Explore** (least-visited towns), **Hold** (stay put). A course set on the map overrides them until the caravan arrives; setting a course back the way you came turns the caravan round on the spot. The planner avoids regions more than four levels above the party.

### Wardens
One per region at its capital: the Thornback (8), the Glass Sphinx (15), the Drowned Witch (22), Rimeclaw (29), the Cinder Colossus (36), the Hollow King (44). A Warden has 6–12× a monster's health, acts 2–5 times a round and brings two of its region's monsters. The Town tab shows your odds (16 simulated fights on their own random streams; G is not touched). Win → the Waystone burns, the next region's roads open and Grandmother writes. After the ending, the Hollow King can be fought again on the **Night Roads**: each win adds a tier (+10 monster levels everywhere, +15% party attack per tier, +50% gold).

### The Scrapbook
A seventh tab keeps a record of everything (`js/sim/book.js`, written by the rules as things happen):
- **People:** Grandmother Odessa, everyone who rode with the caravan, and every wanderer who asked to join, with what became of them (rides with you, parted ways, went their own way), when and where they were met.
- **Monsters:** every family and Warden in the realm, region by region. Met ones have a portrait and how many were seen, defeated and how strong; the rest are dark silhouettes marked ???, so the page is a collection to fill.
- **Things:** every piece of gear found, by name (best rarity, item level, how many, when and from where; the 500 most notable are kept), the goods ledger (bought, sold, profit) and materials gathered.
- **Places:** every town by region, with first visit and visits; unvisited towns are ??? and dark-Waystone regions say so.
- **Travel log:** totals, then every road driven (the last 1,000), grouped by day on the road, with miles, fights and gold; the journal below.
- **Letters:** every letter of Grandmother's you've read, to read again.
A badge says when there's something new. It looks like a scrapbook: lined paper, taped polaroids with drawn portraits (the same drawing code as the road, `js/view/portraits.js`) and handwritten captions in Caveat.

### Time away
On Continue, or when the tab comes back after more than 30 s hidden, the sim runs `min(seconds away, Great Lantern hours)` quietly, then the **chronicle** sheet shows the difference and up to 30 highlights. A day away runs in ~0.1 s.

## Content

- **Six regions, 19 towns, 29 roads** (`js/sim/data.js`): Meadowmere, the Amber Wastes, Mirewood, Frostfang Peaks, Emberreach, Starhaven, in a spiral round the map.
- **13 goods**, 6 materials, **27 monster families** in 9 body shapes, 6 Wardens.
- Gear names from 7 material tiers (Copper → Dawnforged), 25 base items and 12 suffixes.
- 60 first names and 30 surnames for travellers.

## Story

Grandmother Odessa drove the wagon for fifty years. When the Hollow King's fog rose, the Waystones went dark and towns lost each other; hers is the last lantern still lit. She gives you the wagon and Old Tam, her guard of thirty years. Her letters arrive at the start, on lighting each Waystone, and at the ending; each region has a short introduction in the journal. The ending is defined (the sixth Waystone); the Night Roads after it are endless.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Rally | Space / Z | X | Rally button, or tap the road |
| Tabs | 1–7 | — | Tab bar |
| Move through buttons | Arrows | D-pad | — |
| Press | Enter / Space | A | Tap |
| Menu / back | Esc / P | B / Start | ☰ |

## Look and sound

- **The road** (`js/view/view.js`): 150 segments of 200 world units projected by a pinhole camera behind, above and slightly right of the last cart. Curves are a sideways offset accumulated segment by segment, hills a height per segment; both come from stateless value noise over the segment index, so the road never needs storing and never changes when you come back. Segments fade into the sky's haze with distance. Six biomes cross-fade (grass stripes, road and verge colours, mountains, props, weather). Day and night follow the game clock (a 12-minute day): sky gradient, sun and moon on an arc, stars, lit windows, the lead wagon's lantern glow, a vignette.
- **Carts** (`js/view/sprites.js`) are boxes projected corner by corner through the road's own projection: wheels with spokes that turn with the miles, a canopy of hoops in the traveller's colour, the cart's emblem on the back, the lantern on the lead wagon's pole, two oxen. Travellers walk beside their carts, sit round a fire at camp and step out to fight.
- **Fights** are staged on the verge to the right; the camera eases forward and out to frame them, roadside props and houses clear out of the way, the round's script plays back hit by hit with lunges, flashes and damage numbers, and the camera drifts back after.
- **Monsters** (`js/view/creatures.js`): nine body shapes (beast, biped, brute, spirit, crawler, serpent, flyer, blob, golem) plus drake and king, coloured per family. `dev/gallery.html` shows them all.
- **Sound** (`js/audio.js`): Web Audio, no files. Hits, heals, victory and rout jingles, coins, an arrival bell, level-ups, rare-loot chimes; a plucked travelling tune with a reverb tail whose scale changes by region and slows at night.
- **UI:** a warm leather-and-parchment dock with seven tabs (Road, Caravan, Pack, Quests, Map, Town, Scrapbook); the map is parchment with region washes, lit Waystones and quest markers. Cinzel for headings, Nunito for text, Caveat for the scrapbook's handwriting, system fallbacks.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the title's demo caravan, the fixed-step loop, catching up after time away, autosave, keys, debug hooks |
| `js/sim/data.js` | Regions, towns, roads, goods, materials, classes, monsters, gear names, upgrades, the story |
| `js/sim/game.js` | `newGame`, `step`, `tick`, `advance`, `command`, `checkIn`, arrival, road fights and events, Wardens, chronicle, saves |
| `js/sim/party.js` | Travellers, stats, experience, gear, equipping and selling |
| `js/sim/battle.js` | Foes, `resolveBattle` (pure, on copies), odds |
| `js/sim/economy.js` | Prices, pressure, buying and selling, auto-trade, rations |
| `js/sim/world.js` | The road graph, speed, day and night, the planner |
| `js/sim/quests.js` | Notice boards, taverns, quests, daily contracts, the morning post |
| `js/sim/bot.js` | A player who checks in: claims the post, hires, upgrades, heads for Wardens |
| `js/sim/book.js` | The scrapbook's records: people, monsters, Wardens, gear, goods, materials, places, roads, letters |
| `js/view/view.js`, `sprites.js`, `creatures.js`, `map.js`, `portraits.js` | The pseudo-3D road, carts and props, monsters, the realm map, the scrapbook's portraits |
| `js/ui/ui.js`, `panels.js`, `fmt.js` | Screens, HUD, status strip, the six panels (rebuilt only when their structure changes), pickers, the chronicle |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Keys and gamepad, sound, guarded storage with the save time, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the road network and gates, every rule, the scrapbook's records, determinism (including play = time away) and saves, and has the bot play the whole realm at two skills. `browsertest.mjs` drives the real game on desktop by mouse and keyboard (including a two-hours-old save), on touch-only phones in both orientations and with storage blocked. `dev/gallery.html` shows every monster, cart and prop.

## Balance notes

From the bot table (`SEEDS=3`, the median of three):
- The first draft was finished in **7 hours** by a level-20 party: monsters' attack grew too slowly, Wardens acted once a round, and gear doubled a traveller's attack. Monsters now grow faster (health 40 + 18L, attack 7 + 3.2L), Wardens act 2–5 times, damage carries ±4% per level of difference, gear is about half as strong and needs the wearer within two levels of it, and the XP curve is `25 l² × 1.075^l`.
- Now: the attentive bot (checking in every 30 minutes) lights the first Waystone at 3–4 game hours and the last at 70–140; the casual bot (every 8 hours, spending less) at 9–17 and 90–110. With the Great Lantern at 8–24 hours a day, that is roughly one to two weeks of daily check-ins.
- The casual bot never lit a Waystone until it learned to set a course for a Warden when its odds looked good, as a player reading the Town tab would.
- A brand-new caravan left alone for two hours was routed in up to 30% of its fights, and each rout took 10% of the purse. Starter gear from Grandmother, camping at 50%, gentler roads near Hearthford and a rout loss capped by level brought it to 3–10%.
- Late-game gold piles up (hundreds of thousands) once the upgrades are bought: there is no late gold sink yet.

## Open questions / next steps

- A human pass on real phones: the bot is not a person, and SwiftShader is not a GPU.
- A late-game gold sink (cosmetic wagons, a caravanserai to build, Night Roads tiers that cost to kindle).
- More road events and more letters; travellers with names and stories of their own.
- Push notifications would suit the genre, but a static page can't send them.

## Changelog

### v1.0.0 (2026-10-18)
- First release: a self-driving caravan on a pseudo-3D road through six regions; trade with price pressure, auto-battles staged beside the wagons, nine traveller classes with working carts (cooking, forging, brewing, healing, trading, scouting, performing), gear, upgrades, quests, daily contracts and the morning post, six Wardens and Waystones, the Night Roads; time away with a chronicle; Grandmother Odessa's letters; a Scrapbook of every person, monster, item, town and road; procedural sound; simtest, browsertest and a gallery page.
