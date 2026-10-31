# Quill & Legion

**Genre:** Fantasy tactics roguelike: Heroes-style creature stacks on a hex field, every battle order a card from a Spire-style deck, a branching three-book campaign
**Engine:** three.js r165 with custom ink shaders, no asset files
**Status:** v1.0.0. Three books, 12 creatures to recruit, 25 foes and 3 bosses, 52 cards, 21 relics, 12 encounters; a bot that plays the whole campaign

---

## Concept

You are the General of one legion, marching through an old adventure module. Your army is a handful of creature **stacks**: twenty-two pikemen are one stack, five dire wolves another, two knights errant a third. A stack's number is its strength. It hits harder the more of them there are and loses them as it is hurt, and the losses stay lost. Between battles you choose a road across a branching map, spend gold at **dwellings** to recruit and reinforce, buy and erase orders at the **scriptorium**, rest at **campfires**, and stumble into strange **encounters**.

In battle you deploy the stacks on your side of a hex field, and then every *order* is a card. Each turn you draw five and have three ink. Every stack may move once for free (positioning is the Heroes half), but attacks, spells, wards and tactics are cards (the Spire half), and the foe shows its intent above each of its stacks before you commit. Retaliation, flanking, archers at someone's elbow and walkers that can't reach turn the hex grid into the puzzle the deck is played on.

It riffs on two games in genre only, with original content throughout. From **Heroes of Might and Magic** come the stack counts, dwellings, attack-against-defence maths, one strike back per round, flyers and shooters. From **Slay the Spire** come the deck, ink, intents, the branching map, card rewards, relics and boss relics, campfire upgrades and erasing cards.

The look is a 1970s fantasy rulebook: everything is pen-and-ink line art on cream paper. Models are hatched with pen strokes that thicken into cross-hatching in shadow, outlined by a boiling hand-drawn line, with a thin watercolour wash in a few spot colours (cerulean for you, burnt orange for the foe, mustard, olive). The text is set like an old module, with drop caps and Uncial headings.

## Core loop

1. **The map.** A book is 8 floors of nodes plus a boss. From where you stand you may go to any node your road connects to. Floor 0 is always a skirmish, the middle floor a hoard, the last a campfire. Every map has a dwelling within the first few floors and another before the boss.
2. **A node.** Skirmish or lair → battle → spoils. Dwelling → recruit. Scriptorium → buy, erase. Campfire → rest or inscribe. Encounter → a page of text and a choice. Hoard → a relic and gold.
3. **The boss.** Beat it and the legion is restored to full strength, you choose one of three boss relics, and the next book begins. Beat the third and the campaign is won.
4. **Losing.** Lose every stack in a battle and the campaign is over. Seeds, gold, level and score are shown; start again.

## The battle

### The field
A 9×6 odd-r hex grid ([js/sim/hex.js](js/sim/hex.js)). You deploy in columns 0–1 and the foe stands in 7–8. Two to five rocks block the middle; walkers path around them and flyers pass over. Before the fight you may rearrange your stacks: tap one, then a hex of your lines (a friend there swaps).

### A turn
- **Start:** your Ward drops away, your stacks may move and attack again, burns tick and trolls regenerate. You draw 5 cards (the discard is shuffled back when the draw pile runs out) and fill the inkwell to 3. Every foe picks and shows its **intent**.
- **Free move:** tap one of your stacks, then a gold hex within its speed. Once a turn per stack. An attack that walks up uses this move.
- **Cards:** pick a card, then (if it needs one) which stack carries it out, then the target. An attack or spell shows a forecast first; a second tap gives the order.
- **End turn:** the hand is discarded (Doubts and orphaned signature cards fade), then each foe carries out its intent in turn, fastest first.

### Damage (Heroes-style)
`damage = count × dmg × multiplier × attack/defence × modifiers`

- **Attack vs defence:** +5% per point the attacker's Attack beats the defender's Defence (to ×3), −2.5% per point below (to ×0.3). The General's Attack and Defence add to every creature of yours; foes get +1 per book.
- **Flanking:** +20% for each *other* stack of the attacker's side touching the target (to +60%). Pincer and Pack Hunt raise the per-stack bonus.
- **Ranged:** archers and mages shoot anywhere, at half with a foe beside them. A shot is never struck back. A shooter forced to strike back in melee does it at half.
- **Strike back:** a stack hit in melee strikes back once a round at full strength (Griffins every time; Braced pikemen at double). Stunned stacks don't.
- **Ward:** soaks damage before health and lasts until its owner's next turn.
- **Statuses:** Weak (deal 25% less), Vulnerable (take 50% more), Rooted (can't move), Stunned (lose the next action; bosses are immune for 2 turns after), Burning (damage each turn), Might (+X% damage), Haste (+2 speed), Braced, Challenging. Durations count down at the end of their owner's turn.
- **Hurt:** damage removes Ward, then the wounded top creature, then whole creatures. Healing raises the fallen, up to the number the stack started the battle with.

### The foe's mind ([battle.js](js/sim/battle.js) → `pickIntent`, `doIntent`)
Each foe has a weighted move list (never the same move three times running); bosses cycle through theirs in order. Attacking walkers choose the nearest stack they can reach this turn (hunters prefer the weakest); shooters prefer your hardest hitter. If the intended target has moved out of reach they go for whoever they can reach, and otherwise advance. A **Challenge** forces every foe that can reach the challenger to attack it. Intents show the damage they would do now; a "?" means the target may be out of reach.

### Winning
Kill every foe. In a boss battle, killing the boss is enough: the rest flee. After a victory a third of each surviving stack's fallen rejoin (half with the Barber-Surgeon's Kit). A stack wiped out is gone, and its signature card leaves the deck.

## Content

### The legion (recruitable; [data.js](js/sim/data.js) → `CREATURES`)
| Creature | Tier | Health | Dmg | Atk | Def | Spd | Cost | Signature card |
|---|---|---|---|---|---|---|---|---|
| Pikemen | 1 | 10 | 2 | 4 | 5 | 2 | 15 | Set Pikes: ward, strike back double |
| Longbowmen | 1 | 8 | 3 | 5 | 3 | 2 | 20 | Aimed Shot: 150%, pierces Ward |
| Dire Wolves | 2 | 20 | 5 | 6 | 3 | 4 | 40 | Pack Hunt: +40% per flanker, no strike back |
| Dwarf Shieldwall | 2 | 26 | 4 | 5 | 9 | 2 | 50 | Shield Wall: ward them and their neighbours |
| Hedge Mages | 3 | 22 | 7 | 7 | 4 | 2 | 75 | Mending Words: heal 8 per mage |
| Griffins (fly, answer every blow) | 3 | 40 | 9 | 8 | 7 | 5 | 105 | Swoop: dive on anyone and fly home |
| Knights Errant | 4 | 70 | 15 | 11 | 10 | 4 | 200 | Couched Lance: +30% per hex galloped |
| Hill Ogres | 4 | 90 | 16 | 9 | 7 | 2 | 180 | Boulder Smash: knock back, Weaken |
| Elder Oaks | 5 | 160 | 22 | 10 | 14 | 1 | 360 | Grasping Roots: root and hurt all within 2 |
| Moonhorns | 5 | 120 | 20 | 13 | 12 | 5 | 400 | Moonlight: heal and cleanse all within 2 |
| Copper Drakes (fly) | 6 | 200 | 32 | 15 | 13 | 5 | 720 | Copper Breath: a line of two, burns |
| Golden Wyrm (fly) | 7 | 420 | 60 | 22 | 20 | 6 | 1800 | Sunfire: scorch every foe |

Dwellings sell up to the book's tier cap (3, 5, 7), usually including a creature you already field. Stock per visit: tier 1 ~20, tier 7 one, growing 60% a book.

### The foe
| Book | Skirmishes | Lairs (elites) | Boss |
|---|---|---|---|
| I · The Gloaming Marches | Goblin Rabble, Goblin Slingers, Skeletons, Worg Riders, Brigands | Orc Reavers + Shamans, Ogre Brutes, Worgs + Orcs | **Grubnak the Goblin King**: summons goblins, war-cries, heavy blows |
| II · The Barrow Fens | Bog Zombies, Ghouls (root), Mire Cultists (Vulnerable, Doubt), Lizardfolk, Giant Spiders (web), Wraiths (fly, drain) | Fen Trolls (regenerate), Basilisks (stunning gaze), Wraiths + Spiders | **Mother Murkwater, the Fen Hag**: zombies, a roar of Vulnerable, curses, a stunning hex |
| III · The Cinder Throne | Hellhounds (burn), Gargoyles (fly, ward), Minotaurs, Salamanders (burn) | Fire Giants (sweep), the Gloomeye (stun, weaken), Minotaurs + Salamanders | **Ashmaw the Red**: roar, breath along a line, sweep, salamanders |

Counts grow 7% a floor and 5% a book.

### Cards (52)
- **Starter:** Strike ×5, Hold Fast ×3, Onslaught, Firebolt, plus one signature card per starting stack.
- **Common:** Double Time, Volley, Shield Bash, Rally Cry, Scout Ahead, Quickened Step, Frostbind, Hex of Frailty, Enfeeble, Feint, Guiding Bolt, Spark Shower, Raise Earthwork (it may never wall the field in two), Entrench.
- **Uncommon:** Challenge, Pincer, Cleave, Chain Lightning, Haste, Bless, Dimension Door, Last Stand, Study the Field, Ink Reserve, Second Wind, Field Dressing.
- **Rare:** Meteor (hits yours too), Raise the Fallen, Battle Fury, Prayer of Valor, Slumber, War Host, Sucking Mire.
- **Signature:** 12, one per creature (table above).
- **Curses:** Doubt (fades at the end of the turn; foes shuffle it into your discard), Old Wound, Guilt.

Every card but a curse can be inscribed (upgraded) once. Spell damage is `base + per × Lore`.

### Relics (21)
Ledger, Banner of the Old Keep, Inkwell of Plenty, Barber-Surgeon's Kit, Boots of Striding, Dwarven Whetstone, Tower Shield Crest, Lantern of Lore, Tithe Purse, Ever-burning Candle, Wardstone, War Drum, Ivory Twenty-Sider (a natural 20 triples), Bottomless Satchel, Sigil of Command, Horn of the Last Charge, Cartographer's Case; boss relics with a price: Crown of the Usurper, Grail of the Fen, Brass Astrolabe, Warhorn of the Hosts.

### The General
Experience from battles (45, lairs 75, bosses 120) raises the General's level (100, then +30 a level). Each level offers three boons: +3 Attack, +3 Defence, +1 Lore, 120 gold, a 15% muster for every stack, +1 first-turn draw, +1 first-turn ink.

### Encounters (12)
The Wishing Well, the Hermit Sage, the Goblin Peddler (who can be robbed, a fight), the Shrine of the Pale God, the Wounded Knight, the Mushroom Ring, the Abandoned Armory, the Dragon's Riddle, the Sellsword Camp, the Chained Tome, the Old Battlefield, the Fey Crossroads.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Choose a card | Tap it | 1–9, [ ] | LB / RB, X |
| Choose a stack / hex | Tap it | Arrows + Enter, Tab | D-pad + A |
| Move a stack (free) | Tap it, then a gold hex | Tab / arrows + Enter | D-pad + A |
| Give an aimed order | Tap the target twice | Enter twice | A twice |
| Cancel | Tap empty ground, right-click | Esc | B |
| End turn | End Turn | E | Y |
| Pause | ❚❚ / ☰ | P, Esc | Start |

On a portrait phone the field turns so your lines are at the bottom of the screen and the arrows follow it.

## Look and sound

- **The ink pipeline** ([js/view/ink.js](js/view/ink.js), [stage.js](js/view/stage.js)): every model uses one shader that turns half-Lambert tone into screen-space pen hatching (one layer, then cross-hatching, then a third and stipple in the deepest shadow), each line thinning and breaking along its length, over a thin grainy watercolour wash on paper. The scene is drawn twice, once in colour and once as normals with a depth texture, and a composite pass draws the outlines from depth and normal edges in ink. The edge lookup is jittered by noise so the line wobbles like a pen, and the noise steps four times a second so the line boils like a hand-drawn cartoon (still in calm mode). The same pass lays paper grain, fibres, foxing and a vignette over everything.
- **The ground** is one shader: paper with grass ticks and stipple, a watercolour blot of the book's colour, a hand-inked hex grid with a printed dot in each hex, and a double frame.
- **Miniatures** ([models.js](js/view/models.js)): 37 procedural creatures built from spheres, cones, lathes and extruded shapes, merged into one mesh per pigment, on round pewter bases with a cerulean or burnt-orange rim. Stacks show one to three figures by number. Portraits for cards, dwellings and the info panel are rendered by the same pipeline.
- **Effects:** ink splats, scribbled stars, flames, frost, sparks, puffs, ward rings and arrows; floating numbers and status words in DOM.
- **UI:** cream paper, double ink rules, Fraunces (a soft 1970s serif) and Uncial Antiqua, hand-drawn SVG glyphs roughened by an SVG turbulence filter. The map is an SVG chart with dotted roads, a compass rose and the legion's banner.
- **Sound** ([audio.js](js/audio.js)): all Web Audio. A look-ahead sequencer plays a plucked lute-like line and a drone in a mode per scene (dorian on the map, phrygian in battle, a darker mode for bosses) with frame drums in battle and a noise-impulse reverb. Effects: parchment rustles for cards, quill scratches, clashes and parries, bow twangs, spell whooshes, roars.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title diorama, screen routing from `G.screen`, the loop, input routing, saves, debug hooks |
| `js/sim/hex.js` | Odd-r hex neighbours, distance, reach, paths, distance fields |
| `js/sim/data.js` | Every table: creatures, foes, cards, relics, boons, acts, encounters |
| `js/sim/battle.js` | The battle: deployment, the free move, cards, damage, intents and the foe's turn |
| `js/sim/game.js` | The campaign: maps, nodes, rewards, dwellings, shop, camp, events, boons, books, `act()`, saves |
| `js/sim/bot.js` | The auto-player: dry-runs every play with `preview()` and scores it; habits for the rest |
| `js/view/ink.js` | Ink, ground and wash shaders, the composite pass, effect sprites |
| `js/view/stage.js` | Renderer, the two-pass pipeline, camera fitting, picking, scenery, portraits |
| `js/view/models.js` | The procedural miniatures and scenery |
| `js/view/view.js` | Figures, tags, highlights, the event queue and its animations |
| `js/play.js` | The battle controller: taps and keys to commands, highlights, hints, forecasts |
| `js/ui.js`, `js/glyphs.js` | DOM screens, cards, the map; hand-drawn SVG glyphs |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, keys and gamepad, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the data, the hex maths, every battle rule and every card, the campaign's nodes and every encounter option, determinism and save round trips, and has the bot play whole campaigns at two skills. `browsertest.mjs` drives the real game on desktop by real mouse and keys, on touch-only phones in both orientations, and with storage blocked. `models.html` shows every miniature on its own.

## Balance notes

- Movement was first a card (March) like everything else. The bot showed the result: walkers took three turns to cross the field, the first boss fight lasted 17 turns, and decks were a third March. Every stack now has one free move a turn; Double Time is a card for a second.
- Book II was a wall: the bot carried 700 gold unspent into it because its greedy route never passed a dwelling. It now looks three floors ahead, dwellings are a little commoner, and every map has one early and one late.
- Tier-one creatures were by far the best value per gold, so armies became 150 pikemen. They now cost 15 and 20 (from 10 and 14), and attack against defence does the rest: pikemen barely scratch a gargoyle.
- Book II and III encounter counts were cut about 40%, the foe's per-book bonus halved, and the bosses' health cut (Grubnak 620 → 400, Murkwater 1250 → 650, Ashmaw 4400 → 2100).
- Current table (`SEEDS=16`): the perfect bot wins about one run in five and nearly always reaches Book III; at skill 0.6 it wins none and averages about 24 floors. A person who positions for flanks and plays around intents should do better than a greedy bot.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, the balance comes from it, and SwiftShader is not a GPU.
- More creatures per tier and a second boss per book would add replay; an ascension ladder would give the win something to climb.
- The foe picks targets greedily one stack at a time; a coordinated focus-fire AI would make lairs nastier.

## Changelog

### v1.0.0 (2026-10-31)
- First release: three books, a branching map of eight node kinds, 12 creatures, 25 foes and 3 bosses, 52 cards, 21 relics, 7 boons, 12 encounters; deploy, free moves, cards, intents, strike-backs and flanking on a hex field; the ink-and-paper shader look with procedural miniatures and portraits; generated modal music; mouse, touch, keyboard and gamepad; saves.
