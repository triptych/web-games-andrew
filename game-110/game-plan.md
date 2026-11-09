# Doom & Doilies

**Genre:** Idle clicker / incremental, with RPG trimmings
**Engine:** three.js r165. Art: generated PNGs in `assets/` (made with fal, see *Generated art*), with every sprite and texture still painted in code as the fallback; no sound files, every note is synthesised
**Status:** v1.5.0

---

## Concept

The Dread Lady Noxia is the Overlord of the Realm: horns, cape, red eyes, a castle on a crag. She would much rather be baking. And sewing, decorating, and throwing lovely parties. The kingdom must never find out.

It is an idle game in the line of Cookie Clicker and the RPG idlers: click to make **charm**, spend it on **minions** who make charm for you, and on **upgrades** that make everything better. On top of the number going up sits one tension that gives the game its character: **dread**, the Overlord's reputation, which fades — faster the cosier the castle gets — and has to be kept up by cackling, scaring off heroes, and running the occasional evil scheme. A feared overlord makes more and collects tribute; a suspected one gets heroes at the gate.

It looks like an HD-2D game (hand-drawn pixel sprites in a lit 3D diorama): the castle is a dollhouse cut open at the front, four rooms side by side, seen through a tilt-shift lens. Everything you buy appears in it.

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

### The cemetery and Skull Swap
- **The cemetery** lies out past the Ballroom's far door: a raised, moonlit graveyard with an iron fence, a gate, a dead tree, lanterns, pumpkins and mist. It is always open to visit (the 🪦 Graves button, G, Q/E after the last open room, or a tap on it in the whole castle); the Overlord waits by the gate. Its five **gravestones** are mini-games, and their progress is kept forever, through every relocation.
- **Skull Swap** (the middle grave) opens when you **employ 25 minions** in a lair: about five to ten minutes in for an attentive player, early enough to be a reward for getting going and late enough that the castle comes first. The closed grave says so, with your progress. The other four graves are *Not Yet Dug*: reserved for future mini-games.
- **The board** ([js/sim/match3.js](js/sim/match3.js)): 7×7 tokens drawn in the game's style (a cute skull, a cupcake, yarn, a candle, a black rose, a teacup; five kinds until level 4, then six). Swap neighbours to line up three or more; a swap that makes no match swaps back for free. Four in a line make a **line-clearer** (it clears its row or column when it goes); five, or an L or T, make a **jack-o'-lantern** (it clears the 3×3 around it); specials caught in a blast go off too. Cascades score more. If no move is left, the board shuffles.
- **Levels** rotate between a score goal, collecting two kinds of token, and clearing **cobwebs** (a match on a webbed cell clears it). Each goal is a share of what a sensible player reaches in the moves given (about 175 points a move with five kinds, 100 with six, measured with the bot), rising from 45% at level 1 to 90% from level 31, with fewer moves every six levels. Levels are endless; a loss just retries the level. Stars: three with 30% of the moves left, two with 12%.
- **Rewards** are paid into the castle on a win: charm worth 90, 150 or 240 seconds of production (one, two or three stars) and gold of `(3 + 0.6 × level) × the tribute scale × (0.6 + 0.2 × stars)`. Five trophies: clear levels 1, 10, 25 and 50, and ten three-star levels.
- **Controls:** drag a token onto a neighbour, or tap one and then a neighbour; arrow keys move a cursor, Space or Enter picks a token up and an arrow swaps it. After seven idle seconds a possible move wiggles. Esc goes back to the graves.

- **The castle keeps quiet during a mini-game.** While Skull Swap, Curl Up & Dye or Rest in Paws is open, the sim is hushed (`{ t: 'hush', on }`, sent by main.js each frame, never saved): no visitor arrives and those already there wait, so a hero can't gossip behind your back; minions, tribute and schemes carry on. Only the mini-game's own events reach the sounds and toasts; trophies, heirlooms and newly opened graves are held and shown when you close it.

### Curl Up & Dye
- **A spooky beauty salon** in the grave left of Skull Swap, after the old girls' dress-up and makeover games: opens when you **employ 40 minions**. Pick anyone from a gallery of eighteen clients (Lady Noxia, all twelve minions, the kitten, the critic, the bard, the hero and a goblin henchman); they take the chair in front of a gilded mirror, hats off, drawn at 2–4× from their own sprites ([js/salonview.js](js/salonview.js)), with a few cobwebs, leaves, bones and beetles in their hair from the crypt.
- **Hair** is sixteen strands framing the face, a crown and a fringe, all painted with the pixel painter. **Wash:** shampoo makes suds and loosens the grime, rinse washes both away (and the hair stays dark and wet for a while). **Cut:** drag the scissors across the strands (the snipped ends fall); a grow tonic adds length. **Dye:** a brush colours single strands (streaks) or the crown, from ten colours. **Style:** drag a straightener, waver, curler or crimper over strands; hold the hairspray for big hair; five fringes. **Make-up:** lipstick and eyeshadow in any colour, blush, lashes, glitter, and stamped face stickers (heart, star, bat, stitches, tear). **Extras:** a tiara, a witch's hat, a crown of roses, cat ears or a bridal veil, and a bow (any colour), bat, spider, skull or rose clip. Every brush also has a whole-head button, so all of it works by keyboard too.
- **Wishes** ([js/sim/salon.js](js/sim/salon.js)): each client asks for three things from three of five categories (hair colour, streaks or a rainbow; length; texture, big hair or a fringe; a make-up ask, or none at all; a top or a clip), never one their own hair already meets, coloured by their tastes. The chips tick as each comes true. Stars are wishes granted, but the third only for clean hair. The sim judges the look the screen sends (`salonDone`), after sanitizing it.
- **Rewards**: a paying client arrives every 90 seconds (seating one starts the wait); between them any client can sit for a free **practice cut**. A paying client pays charm worth 40, 75 or 120 seconds of production by stars and gold of `4 × the tribute scale × (0.6 + 0.2 × stars)`; no stars, no fee. Five trophies: style 1, 10 and 50 paying clients, ten three-star makeovers, and three stars from every client.

### Rest in Paws
- **A spooky pet shelter** in the grave right of Skull Swap: opens when you **employ 30 minions**. Six pets ([js/sim/pets.js](js/sim/pets.js)), each painted with the pixel painter in four moods (idle, happy, sad, blinking) with a second frame for wings and a wagging tail:
  | Pet | Loves | Helps the castle (per level of bond) |
  |---|---|---|
  | Pudding, a Moon Cat 🐈‍⬛ | fish | visitors call +6% more often |
  | Biscuit, a Hellhound Pup 🐕 | biscuit bones | cackles +10% |
  | Nibbles, a Fruit Bat 🦇 | figs | tribute +10% |
  | Stitches, a Patchwork Bunny 🐇 | carrots | crafting by hand +15% |
  | Sir Croaksworth, a Royal Toad 🐸 | crunchy beetles | reputation fades 5% slower |
  | Professor Hoot, a Barn Owl 🦉 | mouse cookies | all charm +3% |
- **Adopting**: pick a pet from the shelter, name them (16 characters) and bring them home. One pet lives with the Overlord at a time; swapping sends the other back to the shelter, which remembers your bond with every pet. The pet is kept through relocations.
- **In the castle** the pet trots beside the Overlord from room to room and to the cemetery gate, wanders a little, hops when she crafts and cheers when she cackles, sends up a heart now and then when content and a sigh when neglected, and wears what you dressed them in. A click on the pet is a pat (once every 15 s it counts) and never crafts.
- **Needs**: Fed, Clean and Happy, each 0..1, fade on their own (empty in 2 h, 4 h and 1.5 h), while you're away too. A pet whose needs average 35% or more is content and gives its whole bonus; below that, half, and the pet looks sad. A need crossing 25% says so in a toast. Nothing worse ever happens.
- **The nursery** ([js/petview.js](js/petview.js)), a 128×128 crypt room with a bowl, a bed, a moonlit window and a portrait of the Overlord with a puppy: **Feed** — six treats; the pet trots to the bowl and munches; the favourite fills 45% and the rest 30%, and a full pet turns away. **Groom** — burrs, cobwebs and mud cling to the fur in proportion to how grubby the pet is; brush out burrs and cobwebs, sponge the mud into suds, rinse the suds away (or use the "all over" buttons). **Play** — tap the floor to toss a ball, yarn or a feather; the pet runs (or flies) to it and pounces; or cuddle by stroking. **Dress up** — a bow, a bell collar, a witch hat, a scarf or a crown.
- **Bond**: care earns bond (10 per full need filled, +2 for the favourite, 2 per toy caught or 0.5 when already happy, 1 per pat); levels 2–5 at 20, 60, 120 and 200. The bonus is the pet's per-level share × level. The sim validates every bit of care (`petCare`), so it can't be spammed: a full pet won't eat, grooming only counts if it improves, toys have a 0.8 s cooldown.
- Four trophies: adopt a pet, reach bond 5 with one, bond 3 with all six, and 200 bits of care.

### Mastery
Charm made in a room (by minions and by hand) raises its mastery level at 100, 500, 2,500 … (×5). Each level is +3% to that hobby. Every four levels the room's centrepiece grows (more cake tiers, a longer gown, a bigger bouquet, a taller teacup tower).

### Relocation and the Grimoire
- Legend = `floor(cbrt(charm made in all lairs / 1e12))`; relocating banks the new points. Each point is +2% charm forever; points are also spent on perks without losing the bonus.
- Five lairs in turn: Gloomspire Keep (none), Cinder Caldera (cooking +50%), Frostfang Spire (sewing +50%), Mirewood Manor (decorating +50%), the Eclipse Citadel (entertaining +50%), each with its own palette.
- Relocating leaves behind charm, minions, upgrades, décor, gold and henchmen; keeps legend, perks, heirlooms, trophies and stats.
- **Perks** (thirteen): Head Start, An Old Reputation, The Golden Ladle, Night Owl, The Long Nap, Kitten Whisperer, Lingering Guests, The Eternal Scowl, A Hoard of Tribute, Seasoned Hobbyist, The Henchman Union, Bargain Hunter, Overlord Eternal (1 to 100 points).

### Trophies
103, each +1% charm (89 in the castle, and five each for Skull Swap and Curl Up & Dye and four for Rest in Paws): lifetime charm, charm per second, minion counts (1, 50, 100 of each), crafts, cackles, visitors, heroes, maximum dread, being caught in an apron, schemes, heirlooms, relocations, all décor, a full payroll, mastery 10 in each hobby.

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

- **Sprites** ([assets.js](js/view/assets.js), [art.js](js/view/art.js)): generated art first (see *Generated art*), and the fallback below painted in code with game-093's volumetric pixel painter (hue-shifted ramps, contact lines, selective outlines). The Overlord in three poses (idle, craft with happy closed eyes, cackle with arms high and cape flared) with a tool for each room (whisk, needle and thread, feather duster, teacup); twelve minions; four visitors; a goblin henchman; sixteen centrepieces.
- **The castle** ([castle.js](js/view/castle.js), [tex.js](js/view/tex.js)): four rooms 12 × 8 × 7, joined by doorways with portcullises in their side walls, with pixel textures per room (bricks and pink-cream checks; striped wallpaper and planks; stone and flagstones with a carpet runner; panelling and black-and-white marble), re-coloured per lair; arched windows with a shader sky; a hearth, counters, jars and copper pots; a sewing table and bolts of fabric; a fireplace, portraits and candelabras; a stage with curtains, a buffet and string lights; battlements, towers and mountains outside.
- **Effects** ([fx.js](js/view/fx.js)): one point-sprite system drawing pixelated hearts, notes, stars, coins and smoke; shockwave rings; floaters in the DOM.
- **Post** ([stage.js](js/view/stage.js)): tilt-shift focused on the free area, bloom on flames and glows, a grade that follows dread, a little grain. Three quality levels and a calm mode.
- **Sound** ([audio.js](js/audio.js)): a music-box waltz with pizzicato bass and a pad, C major when cosy and A minor when feared; crafting pops on a pentatonic scale that climbs with flow, a timbre per room; a formant cackle; doorbell, meow, fanfare, sad trombone, thunder, coins, chimes.

## Generated art

`assets/` holds the art and `js/view/assets.js` loads it before the first frame (`await loadAssets()` in `main.js`). Every file is optional: a
missing manifest, file or network leaves the key out and the game uses the sprite painted in code ([art.js](js/view/art.js),
[tex.js](js/view/tex.js)), so nothing breaks and the sim and browser tests don't depend on the art. A picture is sized by the logical
size of the painted sprite it replaces, so nothing on screen moved.

| Folder | What | How the game uses it |
|---|---|---|
| `assets/overlord/` | the Overlord with each of four tools, three poses a sheet | `SpriteLib.overlord`; her cells are wider than her painted sprite, her height is unchanged |
| `assets/minions/`, `visitors/`, `henchman.png` | the twelve minions, four visitors, the goblin | castle billboards, the shop icons, the salon's gallery and wishes |
| `assets/stations/` | the four centrepieces, one cell per mastery tier | `SpriteLib.station` |
| `assets/tokens/` | the six Skull Swap tokens, the jack-o'-lantern, the scissors and paw | the Skull Swap board and goals (smoothed, not hard pixels); the icons over the graves |
| `assets/pets/` | six pets: idle, happy, sad, blink (and a flap or wag frame); five accessories | the nursery, the castle pet, the shop; accessories are drawn over the pet at its head and neck |
| `assets/tiles/` | nine greyscale swatches: brick, stone, wallpaper, planks, panelling, check, marble, flagstones, carpet | coloured per lair by a gradient map, repeated by their own `rep` scale, filtered and mipmapped |

How it was made, and what the exporters cope with, is in [dev/assets/README.md](dev/assets/README.md). Still painted in code: the
salon's chair and client (its hair painting needs the sprite's pixels), the banners, the window sky, the 3D décor and the particles.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title and play, the command queue, the fixed-step loop, keys and canvas taps, events, saving, time away, debug hooks |
| `js/sim/game.js` | The rules: `newGame`, `step`, `act`, `rates`, prices, offline `away`, `serialize`/`deserialize` |
| `js/sim/data.js` | Every table: hobbies, minions, upgrades, décor, abilities, visitors, schemes, heirlooms, perks, lairs, trophies |
| `js/sim/match3.js` | Skull Swap: boards, swaps, cascades, specials, cobwebs, goals, stars, levels, a bot (pure; the board keeps its own random state) |
| `js/m3view.js` | The Skull Swap board on a canvas: plays back a swap's steps, drag, tap and key input |
| `js/sim/salon.js` | Curl Up & Dye: the eighteen clients, their wishes, and judging a finished look (pure) |
| `js/sim/pets.js` | Rest in Paws: the six pets, foods and outfits, needs that fade, care and bond, and each pet's bonus (pure) |
| `js/petview.js` | The pet shelter and nursery: adopting, feeding, grooming, playing and dressing up on a pixel canvas |
| `js/salonview.js` | The salon: the client gallery, the chair (hair strands, make-up, accessories painted with the pixel painter), the tools and brushes, the result |
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

### v1.5.0 (2026-11-09)
- Changed: **new art for every sprite, made with fal** (`fal-ai/nano-banana-2/edit`, each from the painted sprite it replaces): the Overlord with all four tools and three poses, twelve minions, four visitors, the goblin, the sixteen centrepieces, the Skull Swap tokens and the grave icons, six pets with four moods and five accessories, and nine room textures coloured per lair. Loaded from `assets/` (1.0 MB) with the painted sprites kept as the fallback. The simulation is untouched.
- Added: [js/view/assets.js](js/view/assets.js) and [dev/assets/](dev/assets/README.md) (the cut-out, slicing and optimising scripts).

### v1.4.0 (2026-11-04)
- Added: **Rest in Paws**, the cemetery's third mini-game: a spooky pet shelter in the grave right of Skull Swap, open at 30 minions. Adopt a moon cat, a hellhound pup, a fruit bat, a patchwork bunny, a royal toad or a barn owl, name them, and look after them in a pixel nursery: feed them (each has a favourite), brush out burrs and cobwebs, scrub and rinse the mud, toss a ball, yarn or feather for them to pounce on, cuddle them, and dress them in a bow, bell, witch hat, scarf or crown. Your pet follows the Overlord around the castle and helps: more visitors, stronger cackles, more tribute, stronger crafting, slower-fading dread or more charm, growing over five levels of bond, and halved when their needs run low. Click them in the castle for a pat. Four new trophies.

### v1.3.0 (2026-11-02)
- Added: **Curl Up & Dye**, the cemetery's second mini-game: a spooky hairdresser and makeover salon in the style of the old dress-up flash games. It opens at 40 minions. Pick any of eighteen clients (Lady Noxia, every minion, the four visitors and a henchman), then wash out the cobwebs, cut strand by strand, dye streaks, curl, crimp and spray, add a fringe, make-up and stickers, and top it off with a tiara, a witch's hat or a bow. Grant their three wishes for stars; a paying client every 90 seconds pays charm and gold, and practice cuts in between are free. Five new trophies. Salon variants of the sprites take their hats off for the chair.
- Changed: the castle keeps quiet while a mini-game is open. No visitors arrive and those already there wait (so a hero can no longer gossip while you play), castle toasts and sounds are suppressed, and trophies, heirlooms and newly opened graves are shown when you close the mini-game.

### v1.2.0 (2026-10-30)
- Added: **the cemetery**, a 3D graveyard past the Ballroom with five gravestones, each a mini-game. **Skull Swap**, a match-three of the game's own art (skulls, cupcakes, yarn, candles, roses, teacups, jack-o'-lanterns, cobwebs), opens when you employ 25 minions and pays charm and gold into the castle for every level cleared; four more graves are waiting for future games. A 🪦 Graves button, G and Q/E reach it, and the whole-castle view includes it. Five new trophies. The match-three is pure and seeded like the rest of the sim, balanced by a bot over 30 levels, and its board plays back each swap's steps as animations with sounds that climb with each cascade.

### v1.1.0 (2026-10-30)
- Changed: rooms are locked until their first minion is hired. Before, a room with no minions only looked locked: you could go there with its button, Q/E or the whole-castle view and craft there, raising its mastery (and growing its centrepiece) before owning a single minion of that hobby. Now the sim refuses to switch to a locked room (`roomOpen()`), a locked room's button shows a 🔒 and a tap says which minion opens it, Q/E skip locked rooms, a tap on one in the whole castle gives the same hint, and a save made in a locked room loads in the Kitchen. Opening a room blows its cobwebs away in a burst of dust and sparkles while its lights fade up.

### v1.0.2 (2026-10-30)
- Fixed: visitors walked through walls. The rooms had no doors, and a visitor's starting point was worked out in the Kitchen's coordinates, so in any other room they slid in from the far side of the castle, through every wall on the way. Every side wall now has a doorway near the front with a stone frame and a portcullis, the doorways of neighbouring rooms line up into one passage, and visitors wait behind the next wall while the portcullis rises, walk in along a lane at the front of the room, and leave the way they came, the gate dropping behind them. Furniture and décor at the front were moved back to keep the lane clear, and the camera shows a little more of each room so both doorways are in shot ([castle.js](js/view/castle.js), [view.js](js/view/view.js)).

### v1.0.1 (2026-10-30)
- Fixed: a gingerbread golem could stand inside the kitchen counter (and, in other rooms, minions inside the hearth, the sewing table, the stage or the organ, and portraits over a window). Minion spots were scattered without knowing where the furniture was. The castle now measures every piece of furniture, décor and window in each room and keeps every spot clear of them, with room for each minion's bob, hop or flutter ([layout.js](js/view/layout.js), [castle.js](js/view/castle.js)).
- Fixed: décor popped in by scaling about the middle of the room, so a piece briefly slid outwards as it appeared; each piece now grows in place.

### v1.0.0 (2026-10-30)
- First release: crafting with flow, twelve minions in four rooms, 147 upgrades, dread and its tiers, cackling, four visitors, three abilities, twelve décor pieces, henchmen and schemes, twelve heirlooms, room mastery, 89 trophies, five lairs and a thirteen-perk Grimoire, time away; the HD-2D castle with procedural sprites, a dread-driven sky and grade, and a generative waltz; sim and browser harnesses.
