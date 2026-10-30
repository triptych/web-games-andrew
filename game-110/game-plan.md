# Doom & Doilies

**Genre:** Idle clicker / incremental, with RPG trimmings
**Engine:** three.js r165, no asset files
**Status:** v1.1.0

---

## Concept

The Dread Lady Noxia is the Overlord of the Realm: horns, cape, red eyes, a castle on a crag. She would much rather be baking. And sewing, decorating, and throwing lovely parties. The kingdom must never find out.

It is an idle game in the line of Cookie Clicker and the RPG idlers: click to make **charm**, spend it on **minions** who make charm for you, and on **upgrades** that make everything better. On top of the number going up sits one tension that gives the game its character: **dread**, the Overlord's reputation, which fades — faster the cosier the castle gets — and has to be kept up by cackling, scaring off heroes, and running the occasional evil scheme. A feared overlord makes more and collects tribute; a suspected one gets heroes at the gate.

It looks like an HD-2D game (Octopath Traveler's pixel sprites in a lit 3D diorama): the castle is a dollhouse cut open at the front, four rooms side by side, seen through a tilt-shift lens. Everything you buy appears in it.

## Core loop

1. Craft by clicking the castle (Space, a tap). Quick crafting builds **flow** (up to ×2).
2. Hire minions; each opens and fills its hobby's room. Buy the upgrades that appear.
3. Watch the dread meter. Cackle before it slips. Greet visitors when they knock.
4. Spend tribute gold on décor and henchmen; send henchmen on schemes.
5. When charm made in all lairs reaches 1e12, **relocate** for legend and start again in a new lair, a little stronger each time.

Minutes: crafting, buying, cackling, visitors. Hours: rooms opening, abilities unlocking, décor filling the castle, mastery centrepieces growing. Days: relocations, heirlooms, the Grimoire, trophies.

## Mechanics

### Charm and crafting
- A craft makes `(1 × click mods × the room's hobby multiplier × trophies × legend + cps × clickPct) × flow × buffs`. The first craft makes exactly 1.
- **Flow**: each craft within 0.6 s of the last adds 6 (max 100); after 0.6 s idle it drains at 26/s. Flow multiplies crafting by `1 + flow/100` (×1.5 more with Rhythm of the Whisk).
- Crafting in a room adds to that room's **mastery**.

### Minions (twelve, three per hobby)
| Hobby | Room | Minions (cost / base charm per second) |
|---|---|---|
| Cooking 🧁 | Kitchen | Imp Sous-Chef 15 / 0.1 · Bubbling Cauldron 150 / 0.8 · Gingerbread Golem 1,800 / 6 |
| Sewing 🧵 | Sewing Loft | Spider Seamstress 22K / 40 · Haunted Loom 280K / 240 · Bat-Wing Atelier 3.6M / 1,400 |
| Decorating 🕯️ | Great Hall | Gargoyle Florist 48M / 8K · Candle Wraith 650M / 46K · Living Portrait 9B / 260K |
| Entertaining 🎻 | Ballroom | Skeleton Quartet 130B / 1.5M · Mimic Buffet 1.9T / 8.6M · Lich Party Planner 28T / 50M |

Each costs 15% more than the last (`cost × 1.15^owned`); ×10, ×100 and Max buy the geometric sum. A minion is listed once you own the one before it or have made 40% of its price. **Rooms are locked until their first minion is hired** (the Kitchen is always open): a locked room is dim and cobwebbed, its button shows a 🔒 and says which minion opens it, Q/E skip it, and the sim refuses to switch to it, so crafting can't raise a locked room's mastery. Hiring the first minion blows the cobwebs away and brings the lights up. Every new lair starts with only the Kitchen open.

### Upgrades (147)
- **Minion tiers** (96): each minion ×2 at 1, 5, 25, 50, 100, 150, 200, 250 owned, priced at ×10, ×50, ×500, ×5e4 … of its base cost.
- **Room mastery** (12): ×1.5 to a whole hobby at 10, 50 and 150 of its minions.
- **Synergies** (6): pairs across rooms (imps and spiders, cauldrons and wraiths, golems and gargoyles, looms and skeletons, portraits and mimics, bats and liches): the first +1% per partner, the partner +0.2% per first. Need 15 of each.
- **Crafting** (9): three ×2s, then six that add 1% of charm per second to every craft.
- **Everything else** (24): flow, dread decay, cackle strength and cooldown, tribute, minions that emit dread, a stronger tier bonus, visitor frequency and length, kitten frenzy length, the three ability unlocks, Taste Test cooldown, offline rate and cap, faster schemes.

### Dread (the reputation)
- 0–100, starting at 50. Each second it falls by `(0.22 + 0.0012 × minions) × decay mods`, less any dread emitted by décor and upgraded minions.
- **Cackle** (5 s cooldown): +14 dread (more with upgrades) and frightens off any hero present.
- Tiers: **Suspected** (<20) ×0.8 charm, heroes ×3 as likely; **Unsettling** ×1; **Feared** (50+) ×1.15 and tribute; **Dreaded** (80+) ×1.3 and double tribute. Fear Itself makes the bonuses half again as big.
- Tribute: `0.1 gold/s × tier × mods × (1 + log10(1 + cps) / 3)`.
- The view reads dread everywhere: the window sky (storm and stars → clouds and a rainbow), moonlight, the colour grade, the HUD icon, and the waltz's key.

### Visitors
One every 70–190 s (faster with upgrades and décor), at most two at once, each for 14 s.
| Visitor | Greeted | Ignored |
|---|---|---|
| A Lost Kitten 🐈 | Cuddle Frenzy: all charm ×7 for 60 s | wanders off |
| A Food Critic 🧐 | Rave review: `min(15% of charm in hand, 900 s of cps) + 13` | leaves |
| A Wandering Bard 🪕 | Encore: crafting ×13 for 15 s | leaves |
| A Hero at the Gate 🗡️ | Scared off: +18 dread, gold | gossips about the doilies: −15 dread |
Visitors don't call while you're away.

### Abilities
| Ability | Unlock | Cooldown | Effect |
|---|---|---|---|
| Cackle 😈 | — | 5 s | +dread, scares heroes |
| Taste Test 🥄 | The Tasting Spoon (2K) | 5 min | crafting ×10 for 15 s |
| Thunderstorm ⛈️ | A Weather Machine (150K) | 10 min | dread to 100 and held for 45 s, triple tribute, a little gold |
| Grand Soirée 💃 | Engraved Invitations (50M) | 15 min | all charm ×3 for 60 s, −20 dread |

### Gold: décor and henchmen
- **Décor** (twelve pieces, 25 to 12,000 gold), kept for one lair and placed in the castle: Gloom Banners, Black-Rose Bouquets, the Bat Chandelier, a Brooding Pipe Organ, a Cauldron-Shaped Oven, the Spinning Wheel of Fate, the Thunder Spire, a Velvet Throne, a Fountain of Bubbling Punch, the Mirrorball of Doom, the Grand Cake Display, a Mannequin Parade.
- **Henchmen**: `8 × 1.5^n` gold each, up to ten.

### Schemes
A board of three cards; starting one sends its henchmen and puts a new card in its place. They finish on their own, while you're away too.
- **Evil schemes** (seven): dread and gold. *Menace the Turnip Festival*, *Rename a Mountain "Mount Doom"*, *Steal Every Spoon in the Kingdom*, *Curse a Bridge (Gently)*, *An Ominous Fog Rollout*, *Demand Tribute, Politely*, *Raise an Unnecessarily Spooky Tower*.
- **Secret commissions** (six): charm (worth 300–5,000 s of production), sometimes a little gold, a small dread cost, and a 3–20% chance of an **heirloom**. *An Anonymous Bake Sale*, *Win the Village Pie Contest (in a Fake Moustache)*, *Knit Sweaters for the Orphanage*, *the Princess's Wedding Dress*, *Redecorate the Heroes' Guild (Incognito)*, *Cater the Royal Ball (Disguised as a Duchess)*.
- **Heirlooms** (twelve), kept forever: +10% to a hobby, slower dread decay, stronger cackles, more visitors, more tribute, stronger crafting, +5% charm, better offline rate. *Portrait of Mother*: "She'd be so proud. Of the evil. Not the doilies."

### Mastery
Charm made in a room (by minions and by hand) raises its mastery level at 100, 500, 2,500 … (×5). Each level is +3% to that hobby. Every four levels the room's centrepiece grows (more cake tiers, a longer gown, a bigger bouquet, a taller teacup tower).

### Relocation and the Grimoire
- Legend = `floor(cbrt(charm made in all lairs / 1e12))`; relocating banks the new points. Each point is +2% charm forever; points are also spent on perks without losing the bonus.
- Five lairs in turn: Gloomspire Keep (none), Cinder Caldera (cooking +50%), Frostfang Spire (sewing +50%), Mirewood Manor (decorating +50%), the Eclipse Citadel (entertaining +50%), each with its own palette.
- Relocating leaves behind charm, minions, upgrades, décor, gold and henchmen; keeps legend, perks, heirlooms, trophies and stats.
- **Perks** (thirteen): Head Start, An Old Reputation, The Golden Ladle, Night Owl, The Long Nap, Kitten Whisperer, Lingering Guests, The Eternal Scowl, A Hoard of Tribute, Seasoned Hobbyist, The Henchman Union, Bargain Hunter, Overlord Eternal (1 to 100 points).

### Trophies
89, each +1% charm: lifetime charm, charm per second, minion counts (1, 50, 100 of each), crafts, cackles, visitors, heroes, maximum dread, being caught in an apron, schemes, heirlooms, relocations, all décor, a full payroll, mastery 10 in each hobby.

### Time away
On load, and after any frame gap over two seconds, the sim runs the same rules in ten-second chunks at the offline rate (50%, up to 100% with upgrades, perks and an heirloom), up to the cap (8 h, up to 32 h). Dread keeps fading and heroes keep gossiping; schemes finish. A welcome-back sheet sums it up.

## Story and tone

There is no ending; it is an idle game. The story is told in flavour: minion and upgrade descriptions, scheme names, and a **gossip ticker** whose headlines follow how the castle is doing ("OVERLORD SEEN IN APRON. Castle declines to comment." when Suspected; "Thunder over the Dark Castle again. Villagers lock their doors and bake protective pies." when Dreaded).

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Craft | Space / Enter | A | Click or tap the castle |
| Cackle | C or 1 | X | 😈 button |
| Abilities | 2 · 3 · 4 | — | ability buttons |
| Rooms | Q / E, ← / → | LB / RB | room buttons |
| Whole castle | Tab | — | 🏰 All, then tap a room |
| Greet a visitor | V | Y | tap them, or the callout |
| Menu | Esc / P | B / Start | ☰ |

## Look and sound

- **Sprites** ([art.js](js/view/art.js)): painted in code with game-093's volumetric pixel painter (hue-shifted ramps, contact lines, selective outlines). The Overlord in three poses (idle, craft with happy closed eyes, cackle with arms high and cape flared) with a tool for each room (whisk, needle and thread, feather duster, teacup); twelve minions; four visitors; a goblin henchman; sixteen centrepieces.
- **The castle** ([castle.js](js/view/castle.js), [tex.js](js/view/tex.js)): four rooms 12 × 8 × 7, joined by doorways with portcullises in their side walls, with pixel textures per room (bricks and pink-cream checks; striped wallpaper and planks; stone and flagstones with a carpet runner; panelling and black-and-white marble), re-coloured per lair; arched windows with a shader sky; a hearth, counters, jars and copper pots; a sewing table and bolts of fabric; a fireplace, portraits and candelabras; a stage with curtains, a buffet and string lights; battlements, towers and mountains outside.
- **Effects** ([fx.js](js/view/fx.js)): one point-sprite system drawing pixelated hearts, notes, stars, coins and smoke; shockwave rings; floaters in the DOM.
- **Post** ([stage.js](js/view/stage.js)): tilt-shift focused on the free area, bloom on flames and glows, a grade that follows dread, a little grain. Three quality levels and a calm mode.
- **Sound** ([audio.js](js/audio.js)): a music-box waltz with pizzicato bass and a pad, C major when cosy and A minor when feared; crafting pops on a pentatonic scale that climbs with flow, a timbre per room; a formant cackle; doorbell, meow, fanfare, sad trombone, thunder, coins, chimes.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title and play, the command queue, the fixed-step loop, keys and canvas taps, events, saving, time away, debug hooks |
| `js/sim/game.js` | The rules: `newGame`, `step`, `act`, `rates`, prices, offline `away`, `serialize`/`deserialize` |
| `js/sim/data.js` | Every table: hobbies, minions, upgrades, décor, abilities, visitors, schemes, heirlooms, perks, lairs, trophies |
| `js/sim/bot.js` | An auto-player that sends the same commands: tests, balance, the title-screen demo |
| `js/view/view.js` | Camera framing, minions and décor following the sim, the Overlord, visitors, event effects, picking |
| `js/view/layout.js` | Where minions stand: slots clear of every measured piece of furniture, décor and window (pure, tested in Node) |
| `js/view/castle.js`, `tex.js`, `art.js`, `sprites.js`, `fx.js`, `stage.js`, `pixel.js` | The castle, its textures, every sprite, the texture cache and icons, particles and billboards, post-processing, the pixel painter |
| `js/ui.js`, `js/news.js`, `js/fmt.js` | DOM HUD, tabs, sheets, toasts; the gossip ticker; number formatting |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key and pad presses, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule, offline time, determinism and saves, and has three bots play eight hours each for the balance table; `browsertest.mjs` drives the real game on desktop, a fresh page after two hours away, touch-only phones in both orientations, and with storage blocked.

## Balance notes

From the bot table (seed 9001, eight hours each):

| Player | 1M | 1B | 1T (first relocation) | Relocations in 8 h | Suspected |
|---|---|---|---|---|---|
| Attentive (6 crafts/s, looks every second) | 6 min | 29 min | 1.6 h | 4 (★8) | 0% |
| Casual (2/s, every 30 s) | 17 min | 44 min | 2.3 h | 2 (★2) | 0% |
| Idle (checks in every 10 min) | 1.5 h | 3.4 h | 7.1 h | 1 (★1) | 40% |

- The first draft (legend base 1e9, cost ×~8 per minion, Dreaded ×1.4) reached the first relocation in 22 minutes and maxed everything in a day. The minion curve now steepens from ×10 to ×14.7 per step, the tiers are ×1.15 and ×1.3, mastery is +3% per ×5, and legend starts at 1e12.
- Gold ran far ahead of décor (40,000 spare by the end of a run); décor prices tripled and tribute dropped to 0.1/s.
- The idle player spends 40% of the time Suspected: that is the pressure to buy the upgrades and décor that emit dread, or to come back and cackle.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. Nobody has heard the music.
- More lairs' worth of content past the fifth relocation (the lairs cycle).
- A sixth hobby (gardening?), seasonal events, and a portrait of Noxia for the welcome-back sheet.

## Changelog

### v1.1.0 (2026-10-30)
- Changed: rooms are locked until their first minion is hired. Before, a room with no minions only looked locked: you could go there with its button, Q/E or the whole-castle view and craft there, raising its mastery (and growing its centrepiece) before owning a single minion of that hobby. Now the sim refuses to switch to a locked room (`roomOpen()`), a locked room's button shows a 🔒 and a tap says which minion opens it, Q/E skip locked rooms, a tap on one in the whole castle gives the same hint, and a save made in a locked room loads in the Kitchen. Opening a room blows its cobwebs away in a burst of dust and sparkles while its lights fade up.

### v1.0.2 (2026-10-30)
- Fixed: visitors walked through walls. The rooms had no doors, and a visitor's starting point was worked out in the Kitchen's coordinates, so in any other room they slid in from the far side of the castle, through every wall on the way. Every side wall now has a doorway near the front with a stone frame and a portcullis, the doorways of neighbouring rooms line up into one passage, and visitors wait behind the next wall while the portcullis rises, walk in along a lane at the front of the room, and leave the way they came, the gate dropping behind them. Furniture and décor at the front were moved back to keep the lane clear, and the camera shows a little more of each room so both doorways are in shot ([castle.js](js/view/castle.js), [view.js](js/view/view.js)).

### v1.0.1 (2026-10-30)
- Fixed: a gingerbread golem could stand inside the kitchen counter (and, in other rooms, minions inside the hearth, the sewing table, the stage or the organ, and portraits over a window). Minion spots were scattered without knowing where the furniture was. The castle now measures every piece of furniture, décor and window in each room and keeps every spot clear of them, with room for each minion's bob, hop or flutter ([layout.js](js/view/layout.js), [castle.js](js/view/castle.js)).
- Fixed: décor popped in by scaling about the middle of the room, so a piece briefly slid outwards as it appeared; each piece now grows in place.

### v1.0.0 (2026-10-30)
- First release: crafting with flow, twelve minions in four rooms, 147 upgrades, dread and its tiers, cackling, four visitors, three abilities, twelve décor pieces, henchmen and schemes, twelve heirlooms, room mastery, 89 trophies, five lairs and a thirteen-perk Grimoire, time away; the HD-2D castle with procedural sprites, a dread-driven sky and grade, and a generative waltz; sim and browser harnesses.
