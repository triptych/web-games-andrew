# Ten New Games in the Garden: 049 to 058

*By Andrew Wooldridge*

The collection just reached 58 games. Each new one gets a statue in the [Garden of Games](index.html), the walkable three.js island that serves as the launcher. The newest games stand closest to the hub, so these ten are the first ones you'll pass.

This batch covers a lot of ground: a 100-floor roguelike, a match-3 RPG, a gacha battler, a night drive with no goal, a recreation of a classic browser RPG, a DOOM-like, a helicopter bullet-hell, a castle-defence game, a twin-stick bug shooter and a cosy fruit puzzle.

They all follow the same rules: no asset files, and every model, texture, icon and piece of music is made in code. Every game plays on a phone as well as on a desktop. Each one also has a `dev/` folder where a bot plays the game headlessly to tune its difficulty, and a Playwright harness that runs it in real Chromium on desktop and on touch-only phones.

Here's a quick look at each one.

---

## 049 · [Lanterndeep](game-049/)

**Turn-based 3D roguelike · three.js**

The lamps of Lastlight are going out. Your teacher Maren went down to tend the First Lantern a year ago and never came back. You take her spare lantern and go down the Hundred Stairs: **100 procedurally generated floors across ten worlds**, among them a bioluminescent grotto, a drowned library, a dwarven forge split by lava, a clockwork machine and a vault among the stars.

The lantern is the main idea. It sets how far you can see, and it also works as your clock: it burns oil every turn, and when the oil runs out the Hush gathers. Every tenth floor holds a Warden, a multi-phase boss whose area attacks are marked on the grid before they land. You pick from three heroes, with procedural loot, 70 monster species and quests from wandering Wayfarers. Maren's ten journal pages are hidden along the way, and finding them unlocks the best of three endings.

The bot in `dev/` plays all 100 floors with each hero to balance the difficulty.

## 050 · [Tomebound](game-050/)

**Match-3 fantasy RPG with an idle village · three.js**

A smudge of living ink has scattered the thirteen greatest books of the Great Library of Lumenhall. You fight monsters Puzzle Quest-style on a shared 8×8 board of 3D gems. Matching gems gives you mana, damage, gold and XP, and every gem you take is one the monster can't have. Matches of four or five make Line gems, Bombs and Prisms. There are 19 spells, potions you brew yourself, and procedural gear.

Back home, a floating-island village rebuilds itself in real time, even while the game is closed, across 13 buildings. Each book you return grants a permanent bonus, and the Library heals as the books come home. Professor Hootsworth the owl keeps the story cheerful.

## 051 · [Sigilborn](game-051/)

**Gacha auto-battler with an idle citadel · three.js**

Every hero in Sigilborn is **procedurally generated**: race, class, element, rarity, stat rolls with a grade, traits, a skill kit with generated names, a painted anime face and a chibi 3D body. One in fifty is a Radiant. Battles use Summoners War-style attack-bar turns, so speed is a stat you build up, and you can let them play out on auto or pick skills and targets yourself.

You play the Overlord, made in a deep character creator, and you have a lot to do: eight campaign regions with bosses, elemental Rifts, the roguelite Endless Spire and an Arena of rival Overlords. Between fights your floating citadel keeps working, with a Treasury, a mine you can dig in 3D, a real-time farm and kitchen, a forge, and expeditions. A progression bot plays three weeks of the game to tune the curve.

## 052 · [Nightline](game-052/)

**Lo-fi synthwave night-drive simulator · three.js**

This one has no goals and no crashes. You set a cruise speed, signal for a lane change, and drive through an endless, rain-soaked city built in chunks as you go. It has five districts: neon downtown, a paper-lantern night market, a skyway, a harbour and residential heights. Every kilometre or so there's a place to pull in: a noodle bar, a diner, a record shop, an overlook, a laundromat. Parked, the camera frames the scene while the rain falls, and each visit goes in your night log.

Every sign and tail light reflects in the wet road, and the frame is rendered at 240 lines with bloom and scanlines. Three **generative radio stations** (synthwave, lo-fi hip-hop and slow analogue ambient) make up their own tracks as you drive. Turn on Drift mode and the car drives itself.

## 053 · [Legend of the Jade Wyrm](game-053/)

**Legend of the Green Dragon-style RPG · three.js**

A tribute to the old LoGD browser games that recreates the whole online experience with no server. You get daily forest fights, beat your master to level up, and face the Jade Wyrm at level 15. Kill it and you start over at level 1 with a permanent gift. The village has everything the original had, from the inn and the bard to marriage, guilds and raven mail.

The clever part: **the other players are simulated**. Sixty of them, each with a personality and a real-clock schedule, log in and out, chat in the square, level up, die, marry, form guilds, and attack you if you sleep in the fields. The text-first pages sit inside a three.js frame with an oak beam, crossed swords and a window onto a low-poly village.

## 054 · [Pale Engine](game-054/)

**DOOM-style FPS with procedural levels and monsters · three.js**

It's Io, in 2291. The station's Pale Engine has drilled through the bottom of everything, and you are the last Warden, with an AI called VESPER in your ear that has its own reasons for wanting you at the bottom. Ten levels in three episodes are generated from a seed, and a bot walks every level through the real collision code before you play it.

Each run rolls its own monster species from ten archetypes. They follow you, fight each other, stagger, and can be finished off with the blade for health. There are nine weapons up to a Singularity Cannon, DOOM's inverted-colour invulnerability, baked lightmaps lit by every muzzle flash, an industrial-metal score, an automap, par times and an Endless Descent mode.

## 055 · [Rotorstorm](game-055/)

**Top-down helicopter bullet-hell · vanilla JS + hand-written WebGL2**

No libraries at all here, just vanilla JavaScript and hand-written WebGL2. A storm-steering AI called MERIDIAN has turned on the cities it protected, and you fly the AH-77 Kestrel through six operations over archipelago, jungle, desert, ice, neon city and volcano. The CPU and the GPU share one noise function, so gunboats spawn exactly on the water the shader paints.

Six multi-phase bosses fight with named spell cards. You graze bullets to charge Overdrive, wipe the screen with an EMP, rescue civilians, and spend salvage on a 28-node skill tree. The ending changes with the number of survivors you saved.

## 056 · [Keepfire](game-056/)

**Castle defence × Plants vs. Zombies × incremental · three.js**

Aldmere's last keep starts as one tower with one archer. Procedurally generated monsters march down five lanes, and every kill pays gold that you spend mid-wave on your party: alchemists, knights, pyromancers, a frost witch, dwarf bombardiers, a ballista, a druid, a storm caller and more.

The best part is watching the **castle model rebuild itself from your upgrades**: towers rise, walls go from logs to banded stone, and the Keepfire beacon appears on top, ready to burn a whole lane. There are six biomes, six multi-phase bosses, relics after every wave, and a permanent Ember Tree for when you choose to start a new run.

## 057 · [Hivebreaker](game-057/)

**Twin-stick bug-swarm shooter · three.js**

Think Enter the Gungeon meets Alien Breed. A black-site base under the ice of Erebus has gone silent with the President's daughter inside, and one Colonial Marine goes down through five procedurally generated sectors to get her out. Rooms seal behind you as **swarms of hundreds** of bugs pour out of the vents. Each bug type is one instanced draw call, with legs and wings animated in the vertex shader.

You can dodge-roll, throw grenades, erase bullets with the Shock Pulse, and carry four of nine guns, upgraded up to Mk III. Five bosses lead to a timed escape. It plays with keyboard and mouse, a gamepad, or touch twin-sticks.

## 058 · [Bumble Basket](game-058/)

**Cosy fruit puzzle · three.js**

The newest game is the gentlest. Drag a bumblebee along a trail of fruit on a picnic blanket, where each fruit you hop to only has to **share one trait** with the last: kind, colour, size or family. So trails wander like a word ladder instead of needing identical pieces. The bee learns each trait as a "sense", one garden at a time.

Full jars earn power-ups like the Honey Dipper and Rainbow Wings, and trails of seven grow golden fruit that links to anything. There are thirty levels in four gardens, an endless Picnic mode, an 81-stamp Fruit Album, and sixteen kinds of fruit with faces that blink and beam, plus ukulele-style music. A bot has to win each level often enough before it ships.

---

## By the numbers

| # | Game | Genre | Tech |
|---|------|-------|------|
| 049 | Lanterndeep | Turn-based 3D roguelike | three.js |
| 050 | Tomebound | Match-3 RPG + idle village | three.js |
| 051 | Sigilborn | Gacha auto-battler + idle citadel | three.js |
| 052 | Nightline | Synthwave night drive | three.js |
| 053 | Legend of the Jade Wyrm | LoGD-style RPG | three.js |
| 054 | Pale Engine | DOOM-style FPS | three.js |
| 055 | Rotorstorm | Helicopter bullet-hell | Vanilla JS + WebGL2 |
| 056 | Keepfire | Castle defence / lanes / incremental | three.js |
| 057 | Hivebreaker | Twin-stick swarm shooter | three.js |
| 058 | Bumble Basket | Cosy fruit puzzle | three.js |

## Play them

Open [the Garden](index.html), walk up from the dock, and look for the newest statues near the hub. The holographic carousel there shows the newest games first. If you'd rather click than walk, the [classic card grid](classic.html) has all 58.

If you want to see how a game is built, every folder has a `game-plan.md` design doc and a `dev/` folder with its test bots. Have fun!
