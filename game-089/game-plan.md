# Dragonroll

**Genre:** 3D board game × turn-based RPG (Monopoly meets Final Fantasy)
**Engine:** three.js r165, no asset files (every model, face, tune and sound is made in code)
**Status:** v1.0.0

---

## Concept

Pyrrhax the Ember Wyrm sleeps in the crater of Mount Ember, in the middle of Emberwyld Isle. When he wakes, he'll burn the island. You have a few laps of the island to get ready.

The island *is* the board: forty chunky tiles in a ring round the volcano, across four regions (sunny Meadowvale, mushroom-lit Whisperwood, the white sands of Glimmer Coast, snowy Frostfang Peaks). Roll two dice and hop your hero round it. Encounters and wandering monsters cut to a Final Fantasy style battle: your party on the right, the monsters on the left, a turn-order bar, Attack / Skills / Items / Defend / Run, elemental weaknesses and a Valor gauge for big Burst moves. Towns have a shop, an inn, a tavern where companions join you, and a forge that turns monster materials into gear no shop sells. Dungeons hold bosses that guard the four Dragonbane Shards. Deeds are property, Monopoly style: buy them, upgrade them, and two rival adventurers (Baron Goldbuckle and Mirabel Moonshade) pay you a toll when they land there, as you pay them on theirs.

After the last lap, passing Hearthstone wakes the dragon. Win, and you get a rank. Lose, and you get one more lap to prepare.

It riffs on Monopoly and Fortune Street (laps, salaries, deeds and tolls, a free-parking fountain, a portal corner), Mario Party (stopping at shops as you pass, items that change your roll), and Final Fantasy (the battle layout, the swirl into battle, a turn-order bar from FFX, Limit-like Bursts). The tone is a bright storybook: chibi heroes on board-game pedestals, cel shading with ink outlines, nothing grim.

## Core loop

1. **Roll** (or use a Loaded Die, Swift Boots or a Warp Scroll).
2. **Walk** that many spaces. Every space walked earns road coins (3 a space on lap 1, one more each lap), paid as one sum where you stop, so the first lap isn't a famine; rivals earn them too. Passing Hearthstone is a lap: salary, deed income, and new wandering monsters. Passing a town or an open dungeon offers a stop. Walking into a wandering monster stops you for a fight.
3. **Land**: a battle, a deed to buy or upgrade (or a rival's toll to pay), a town, a dungeon, a chest, a Fate card, or a corner (feast, shrine, fountain, portal).
4. The **rivals** take their turns: they buy deeds, fight, pay tolls and drive off monsters, shown quickly on the board.
5. Doubles roll again. Every turn the party rests a little on the road (10% HP, 12% MP).

Standard games are five laps (about 30–40 minutes); Short is three, Epic seven. From two laps before the end you may climb Mount Ember early, for fame.

## The board (js/sim/board.js)

Space 0 is **Hearthstone** (front-right). Each side has nine spaces:

| Side | Region | Spaces 1–9 |
|---|---|---|
| 1–9 | Meadowvale | Encounter, Sunny Orchard, Fate, Encounter, **Brookhollow**, Encounter, Old Windmill, Treasure, **Goblin Warren** |
| 10 | — | **Crossroads Shrine**: full heal and a blessing for the next battle |
| 11–19 | Whisperwood | Encounter, Glowcap Grove, Treasure, Encounter, **Hollow Oak Crypt**, Fate, **Fernwick**, Encounter, Elven Treehouse |
| 20 | — | **Fountain of Fortune**: every tax, pickpocketed coin and lost gold; land to take it |
| 21–29 | Glimmer Coast | Encounter, Pearl Docks, Fate, Encounter, **Saltbreeze Harbor**, Treasure, Encounter, Gull Lighthouse, **Sunken Grotto** |
| 30 | — | **Wyrm Portal**: go to any space (going "backwards" past Hearthstone counts as a lap) |
| 31–39 | Frostfang Peaks | Encounter, Crystal Mine, Treasure, Encounter, **Frostfang Caverns**, Encounter, **Hammerhold**, Fate, Hot Spring Lodge |

### Deeds

| Region | Deeds (price) | Owning both |
|---|---|---|
| Meadowvale | Sunny Orchard 110, Old Windmill 130 | Harvest Bounty: salary +30% |
| Whisperwood | Glowcap Grove 170, Elven Treehouse 190 | Sylvan Grace: +10% max HP |
| Glimmer Coast | Pearl Docks 230, Gull Lighthouse 250 | Trade Winds: shops 15% off |
| Frostfang | Crystal Mine 290, Hot Spring Lodge 320 | Dwarven Kinship: forge 25% off |

Toll = price × (0.25, 0.45, 0.7, 1.0) by level, ×2 for a whole region. Income each lap = price × (0.15, 0.25, 0.38, 0.55). Upgrading costs price × 0.55 × the next level. Visiting your own deed collects half a lap's rent. Deeds sell back for half of what went into them. Nobody goes bankrupt: a toll takes what you have.

### Wandering monsters

1 + ⌊lap / 2⌋ monsters (up to four) roam the board, standing on encounter, deed, chest and Fate spaces, never right in front of you. They're topped up each lap. Walking into one stops you: the monster (at your level plus its region's danger) and an escort or two. Beating it clears the road and pays 30% more gold; losing to it sends it wandering off, so it can't pin you down. Rivals who land on one fight it in their own (abstract) way.

## Battles (js/sim/battle.js)

**Turn order** is a count-down per unit, like FFX's CTB: acting pushes a unit back by 100 / speed (×1.5 slowed, ×0.67 hasted, ×0.7 defending, ×0.8 for an item). The bar at the top shows the next eight turns. The sim resolves the player's command and every enemy turn after it at once, as ordered `b_*` events, and stops when a party member is up again; the view plays them back.

**Damage** = power × ATK² / (ATK + 0.7 × DEF) (MAG and RES for spells), ±10%, ×1.5 on a weakness, ×0.5 on a resistance, ×1.6 critical (physical only), ×0.5 when defending. Statuses: poison and burn (damage each turn), stun, slow, haste, power, guard, ward, regen, frost rune (physical hits turn to frost), focus, weakened.

**Valor** fills as the party deals and takes damage. Full, it lets whoever is up use their **Burst**: Lionheart, Starfall Barrage, Arcane Cataclysm, Sanctuary (heal and raise everyone), Wild Hunt, Broadside, Mountain's Wrath.

**Grit**: once a battle, a hero above half health survives a blow that would knock them out, with 1 HP. **Early laps**: monsters deal 30% less damage on lap 1 and 15% less on lap 2, while you're alone in starting gear; an ambush only brings a pair from lap 2.

**Win**: XP, gold, monster materials, sometimes a potion. KO'd members get up with 1 HP. **Run**: 70% (never from bosses or the dragon). **Lose**: a fifth of your gold goes in the Fountain, and you wake at the corner behind you with half HP.

**XP** is a share of the party's next level per enemy, more for tougher foes: progress stays steady however the dice fall. Far ahead of the island's pace (level 2 + 3 per lap) it falls off sharply, so a lap of dungeon-crawling can't put you ten levels past the story. Monster levels follow your level plus the region's danger (Meadowvale a level gentler, Frostfang two harder), pushed up a little when you fall behind the pace.

### The party

You pick a hero; up to two companions join from taverns (others wait in reserve and can be swapped in at any tavern). The party shares one level.

| Who | Role | Skills (level) | Burst |
|---|---|---|---|
| **Knight** | Tough, shield | Shield Bash (1), Rally (3), Valor Strike (6), Whirlwind (10), Radiant Blade ✨ (15) | Lionheart |
| **Ranger** | Fast, crits | Twin Shot (1), Snare Arrow (3), Arrow Rain (6), Thunder Arrow ⚡ (10), Eagle Eye (15) | Starfall Barrage |
| **Mage** | Spells | Fireball 🔥 (1), Frost Nova ❄️ (3), Chain Lightning ⚡ (6), Arcane Ward (10), Meteor 🔥 (15) | Arcane Cataclysm |
| Pip Thistledown (Brookhollow) | Halfling cleric | Mend, Smite ✨, Purify, Prayer, Revive, Blessing | Sanctuary |
| Sylva Moonleaf (Fernwick) | Elven druid archer | Thorn Volley, Regrowth, Moonshot ✨, Vine Snare | Wild Hunt |
| Captain Bram Barnacle (Saltbreeze) | Pirate brawler | Cutlass Flurry, Swig o' Grog, Cannonball 🔥, Sea Shanty | Broadside |
| Grumli Stoneboots (Hammerhold) | Dwarf rune-smith | Rune Hammer ❄️, Stoneskin, Earthquake, Rune of Frost | Mountain's Wrath |

### Monsters

| Region | Monsters | Dungeon boss (and its shard) |
|---|---|---|
| Meadowvale | Jellybounce Slime, Goblin Scrapper (steals gold), Thornback Boar, Bumble Brute | King Grubnose (calls guards, eats) — Shard of Embers |
| Whisperwood | Shroomling, Will-o'-Wisp, Webweaver Spider, Mossy Treant | Mother Mossback (spore storms, regrows) — Shard of Leaves |
| Glimmer Coast | Crusher Crab, Drowned Deckhand, Gale Harpy, Volt Eel | Queen Brinetooth (tentacles, ink, tidal wave) — Shard of Tides |
| Frostfang | Frost Imp, Rime Wolf, Snowpaw Yeti, Ice Golem | The Frost Warden (blizzard, ice armour) — Shard of Rime |

Plus Mimics in chests (from lap 2) and Ember Whelps. **Pyrrhax** is fire: he resists fire and is weak to frost. Each shard you carry takes 6% off his DEF and RES. Below half HP he takes to the air (harder hits, Inferno) and hatches two whelps.

## Gear, items and the forge

Weapons come in kinds (blade, bow, hammer, staff) and five shop tiers; each member holds their own kinds. Armour and charms suit anyone. A town's shop sells tiers up to the lap plus its own bonus (Brookhollow 0, Fernwick and Saltbreeze 1, Hammerhold 2).

The **forge** makes gear no shop sells from materials and gold: Boarhide Jerkin, Glowcap Staff, Thornbark Bow (poisons), Silkweave Robe, Pearlsteel Saber (holy), Tidecaller Staff (frost spells +35%), Coral Mail, Frostbite Blade, Glacier Maul, Rimefrost Bow (frost), Yeti Furcoat, the **Dragonward Amulet** (fire damage −40%, from four regions' materials) and **Dragonbane** (all four shards: anyone can wield it, frost, ×1.6 damage to dragons).

Items: Potion, Hi-Potion, Ether, Phoenix Feather, Remedy, Fire Bomb, Frost Flask, Smoke Bomb, Picnic Basket, and three board items: the Loaded Die (choose 2–12), Swift Boots (three dice) and the Warp Scroll (fly to a town).

## Fate cards

Lucky Find, A Bard's Ballad, Fairy Ring (full heal), Tailwind (+3 spaces), Secret Path (to the next town), Pickpockets!, Ambush!, Harvest Festival (each rival gives you 30), The Crown's Tax (15 a deed, into the Fountain), Wandering Priest (a blessing), A Strange Bundle (materials), Travelling Merchant (potions), The Mountain Rumbles (−15% HP), Shimmering Door (to the Portal), Four-Leaf Clover (next roll +2), Sudden Storm (to the Shrine), Treasure Map (to the next dungeon), Old Hermit's Lesson (XP).

## The ending

Rank S/A/B/C from a score: fame (battles, dungeons, deeds, an early climb), gold, deeds, level, and +1000 for slaying the dragon. Losing to him twice ends the game.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Roll | ROLL button | Space / Enter | A |
| Choose | Buttons | Arrows, Enter / Space | D-pad, A |
| Back / pause | ☰ | Esc / P | B / Start |
| Turn / zoom the board | Drag · pinch / wheel | — | — |
| Map · party · bag | Buttons | M · Tab · B | Y · X |
| A space's details | Tap the tile | — | — |
| Battle targets | Tap a ▼ marker or a name | Arrows, Enter | D-pad, A |

Battles have an **Auto** button (a good bot plays for you) and a speed toggle.

## Look and sound

Cel shading throughout: `MeshToonMaterial` with a stepped gradient, a soft rim light, inverted-hull ink outlines on every model, and painted canvas faces with blinking eyes (the toon kit and faces come from game-063). Post: NaN sanitiser, half-size bloom with a threshold above 1 (only lava, magic, lamps and glows bloom), and a storybook grade (saturation, warmth, vignette, grain), which also does the Final Fantasy **battle swirl**: the screen twists, zooms and shatters to white.

The island is a heightfield coloured by region (four grasses, sand, snow, volcanic rock), with a toon sea shader that reads the terrain's height for shallows, breathing shore foam and wave lines; a gradient sky; drifting toon clouds; ~1,000 instanced trees, pines, palms, giant mushrooms, flowers, rocks, crystals, sheep and hay bales; every town, dungeon, deed and corner as its own little diorama (a turning windmill, a lighthouse with a sweeping beam, a portal swirl, flags that ripple); and the volcano with lava rivers, smoke and Pyrrhax asleep in the crater, stirring as the laps pass. Tokens are chibi figurines on gold-rimmed pedestals. The dice are rounded toon cubes that tumble, bounce twice and land on the sim's numbers.

Battle fields are themed by region (meadow, forest, beach, snow, a torch-lit dungeon, the volcano crater with lava pools and embers), with lunges, slash arcs, arrows, fireballs, ice bursts, lightning, holy beams, meteors, dragon fire, damage numbers, WEAK!/CRITICAL! tags and camera shake.

Music is seven original tunes on a look-ahead sequencer (title, the island, towns, dungeons, battles, bosses, the dragon), with written melodies over chords, arpeggios, bass and drums; jingles for victory, levels, shards and laps; effects for every event.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, acting, music cues, input routing, auto-battle, debug hooks |
| `js/sim/game.js` | The phase machine: dice, laps, deeds, towns, dungeons, chests, fate, rivals, roamers, the dragon, saves |
| `js/sim/battle.js` | CTB battles: commands, skills, statuses, enemy AI, bursts, loot |
| `js/sim/party.js` | Member stats from level and gear, skills, equipping |
| `js/sim/bot.js` | The auto-player for tests, balance and the Auto button |
| `js/sim/data.js`, `board.js` | Every table; the forty spaces |
| `js/view/view.js` | The director: plays events on the board or the battle field, the swirl |
| `js/view/island.js` | Terrain, sea, sky, tiles, landmarks, scenery, the volcano |
| `js/view/boardview.js` | Tokens, roamers, dice, the follow camera, board events |
| `js/view/battleview.js` | Arenas, units, battle events and effects |
| `js/view/chars.js`, `monsters.js`, `props.js`, `anim.js` | Models and poses |
| `js/view/toon.js`, `face.js`, `stage.js`, `fx.js`, `dice.js`, `portraits.js` | Toon kit, faces, renderer and post, particles, dice, UI portraits |
| `js/ui.js` | Screens, HUD, decision cards, town, party, bag, battle menus |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound and music, input, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the board, every rule (dice, laps, tolls, towns, every skill and burst, items, dungeons and shards, roamers, every Fate card, the dragon), determinism and save round trips (mid-battle too), a fuzz of thousands of random actions, and has bots play whole games for every class at two skills. `browsertest.mjs` drives the real game on desktop by mouse and keyboard, on touch-only phones in both orientations, and with storage blocked. `gallery.html` shows every model on a neutral background.

## Balance notes

- First pass: XP fixed per monster and monster levels by lap. A party that lost one fight fell behind the island and never caught up (bots were knocked out seven times a game and still level 4 at the dragon). Monster levels now follow the party, and XP is a share of the next level.
- Then the opposite: a run of dungeons (each scaling with the party) carried bots to level 20 by lap 2. Cleared dungeons now close until the next lap, boss XP is smaller, and XP falls off sharply past the island's pace.
- Battles went 12–14 party turns: enemy HP is now 0.62× (bosses 0.85×), enemy attack 1.5×. Normal fights take two or three rounds and cost a quarter of the party's HP.
- Only ~1.5 encounters a lap on the board: wandering monsters made the RPG half thicker; dungeons are a battle and a boss (not two battles) so a game is about 30 fights.
- The table (8 seeds, standard length): a strong bot wins every game (often climbing early) at level 18–19; a casual bot wins about 95%, at level ~21, with about one dragon defeat in three games.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Local hot-seat multiplayer instead of AI rivals.
- More Fate cards and events, a bestiary.

## Changelog

### v1.0.2 (2026-10-21)
- Early battles were too hard: a level-1 Mage could take 75% of its HP from one crit in the starting meadow, and a Yeti's maul was 119–193% of a level-1 hero's. Monsters now deal 30% less on lap 1 and 15% less on lap 2; **Grit** lets a hero above half health survive one knockout blow a battle with 1 HP; an ambush on lap 1 no longer forces a second monster. In 90 bot games at skill 0.5: lap-1 battles lost 13.1% → 5.0%, lap-1 knockouts 66 → 24, lap-2 battles lost 11.7% → 4.2%; the strong bot still wins 90/90.

### v1.0.1 (2026-10-21)
- Corner tiles are square to the board: turned diagonally, their slab overlapped the neighbours' and the tops flickered on phones. The fountain's water and coins are lifted clear of its basin. Board camera near plane 0.5 → 2.
- The camera follows a rival's token while it hops (aiming at the square ahead), instead of staying where they rolled while they walked off screen.
- Road coins: every space walked pays 3 gold (+1 a lap), you and the rivals alike. In bot games it roughly doubles gold by turn 3 (35 → 68) and turn 6 (143 → 228) and adds about a tenth over a whole game. Floating words stay inside the screen.

### v1.0.0 (2026-10-21)
- First release: the 40-space board on a 3D island, three heroes and four companions, 20 monsters, 4 dungeons and bosses, Pyrrhax in two phases, deeds and tolls with two AI rivals, wandering monsters, towns with shop, inn, tavern and forge, 13 recipes, 18 Fate cards, CTB battles with bursts, seven tunes, saves.
