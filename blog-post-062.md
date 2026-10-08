# Rotten to the Core: A Fruity Diablo in the Browser

*By Andrew Wooldridge*

Game 062 in the collection is [Rotten to the Core](https://triptych.github.io/web-games-andrew/game-062/). It's Diablo with the tone turned all the way to silly: you're a piece of fruit with a butter knife, the monsters are rotten fruit and their pests, and the loot is kitchenware.

Something rotten has crawled up from under the village of **Tristrawberry**. You grow a fruit hero, head down the cellar stairs and squash your way through twelve procedurally generated levels to **Durian the Diabolical**, the stinkiest thing in the Great Orchard.

Like every game here, it uses no asset files. Every fruit, monster, dungeon, texture and note of music is made in code. It's built with three.js and plays on a phone as well as on a desktop.

---

## The Diablo loop, but juicier

The structure will feel familiar to anyone who has played Diablo: town, dungeon, loot, back to town. What changes is the vocabulary:

- Health is **Freshness**, and mana is **Juice**. They sit in two glass globes at the bottom of the screen, with a sloshing wave on top.
- Gold is **Sugar**.
- Town portals are **Portal Pies**.
- Your health potion is Strawberry Jam and your mana potion is Orange Juice.
- Everything that dies bursts into juice, and the splats stay on the floor.

That last one does a lot of work. By the end of a big fight the floor is painted in grape purple, tomato red and lemon yellow, so you can see where the fight went.

## Grow a hero

The character creator lets you pick from sixteen kinds of fruit, eight colourways, six eyes, six mouths and twelve hats, with a live 3D preview standing in town. Then you choose one of three classes:

| Class | Main stat | Skills |
|---|---|---|
| **Melon Knight** | Crunch | Slice, Rind Bash, Big Slice, Juice Up!, Pit Leap, Blender |
| **Seed Ranger** | Zip | Seed Shot, Pomegranate Pop, Pip Spray, Somersault, Peel Trap, Raisin Rain |
| **Citromancer** | Zest | Zest Bolt, Caramelize, Brain Freeze, Chain Lime-ning, Peel-port, Melon Meteor |

That's eighteen skills, and I'm still proud of "Chain Lime-ning". Like Diablo III, every skill scales from your weapon's damage, so finding a better bread knife makes your fireballs better too. You get one skill point per level, skills rank up to 20, and any skill you've learned can go on any button. The fourth attribute, **Pulp**, is your health.

## Kitchenware with affixes

Loot comes in four rarities: Common, **Juicy** (magic), **Ripe** (rare, with a random name) and **Golden** (uniques). Weapons climb through tiers like Butter Knife → Bread Knife → Santoku → Obsidian Peeler, and shields go from Pot Lid to Wok to Cauldron Lid. Armour includes Tea Cozies, Cork Boots and Wicker Basket Mail.

The fourteen Golden uniques were the most fun part to write:

- **The Big Squeeze**, a cleaver
- **Grandma's Rolling Pin**
- **Melon Collie**, a candy necklace
- **Fresh Prince of Bel-Pear**, body armour
- **Oven Mitts of Fury**
- **The Wok Lord**, a pie-tin shield
- **Kiwirt's Spare Leg**, a baguette you get from a quest (more on that below)

Ripe and Golden items drop unidentified, and you take them to Deckard Cane to find out what they are. There's a nine-slot paper doll, a 40-slot backpack, a 60-slot stash and comparison tooltips. Drops lean towards your class, so a Citromancer finds mostly wands and orbs.

## Three acts, one generator

The dungeon is twelve levels in three acts, with a boss at the bottom of each one:

- **The Root Cellar**: rectangular rooms, corridors and pillar halls. *"The cellar smells… fermented."*
- **The Jam Catacombs**: rounded rooms and sticky jam pools that halve your speed. *"The jam down here has opinions."*
- **The Rotten Core**: blobby caves, wandering tunnels and lakes of boiling fruit punch.

It's one generator with three looks. Rooms are joined by a minimum spanning tree plus about a quarter more connections, so the levels have loops instead of being one long branch. The entrance goes in the room farthest from the boss arena, and every level is flood-filled to make sure you can reach all of it. If a crate or barrel would seal off part of the floor, it gets removed, and if the level fails the checks, it's thrown away and generated again.

Each level is filled with crates, jam jars, cider barrels, exploding soda kegs, picnic-basket chests, Smoothie Shrines, monster packs, quest objects, and the occasional pie that turns out to be a mimic.

## The rotten menagerie

There are fourteen monster types, and each one has its own brain:

- **Moldy Grapes** shamble towards you with their arms out, like zombies.
- **Fruit Flies** swarm.
- **Banana Peeltons** are bony peels, and **Peelton Pitchers** throw peels like boomerangs.
- **Apple Worms** in bowler hats burrow underground and pop up next to you.
- **Eggplant Shamans** heal their friends and bring them back from the dead, so you learn to kill them first.
- **Rotten Tomatoes** run at you and burst.
- **Sour Lemons** leave acid puddles, and **Prickly Pears** are needle turrets.
- **Coconut Crabs** are armoured and charge.
- **Jack o' Lanterns** throw fireballs and blink away when you get close.
- **Chili Imps** explode when they die, and **Durian Brutes** slam the ground and leave stink clouds.

Champions and named uniques come with elite affixes like Extra Juicy, Speedy, Spicy, Frosty, Stinky and Bouncy. Every attack has a windup, and the big ones show a red circle on the floor before they land, so if you get hit, it's usually because you didn't move.

The three bosses each get an act:

| Act | Boss |
|---|---|
| 1 · The Root Cellar | **The Juicer** ("Ahh… FRESH FRUIT!") charges and sprays juice, then calls in grapes at half health |
| 2 · The Jam Catacombs | **Mangophisto, Lord of Chutney** floats, lobs chutney, rains fire and summons Chili Imps over three phases |
| 3 · The Rotten Core | **Durian the Diabolical** slams, sprays spikes, fills the arena with stink, and fires a huge stink nova you have to walk out of |

Beat Durian and you unlock **Overripe** difficulty, and after that **Rotten**, with tougher monsters and better loot.

## Tristrawberry

The town is where most of the jokes live. You'll meet:

- **Deckard Cane**, a candy cane elder who identifies your items. *"Stay a while and glisten!"*
- **Granny Smith**, who heals you and sells potions. *"Back in my day we fought rot with a spoon."*
- **Grapeswold**, the blacksmith. *"I forge kitchenware. For WAR."*
- **Olivia**, the oracle, who sells magic goods and pies. *"The olives told me you would come."*
- **Kiwirt**, a shady kiwi on a toothpick leg who sells mystery smoothies (that's the gambling). *"Don't look at the leg. Everyone looks at the leg."*

Each of them talks in Animal Crossing-style gibberish pitched to their character. There are six quests, including finding Granny's lost recipe book, bringing Grapeswold the fuzzy **Anvil of Furry**, and getting Kiwirt's spare leg back from the Toothpick Thief. When you return it, Kiwirt decides it's too sticky now and lets you keep it, which is how you end up hitting things with a baguette.

There's also a Wishing Well that works as a waypoint, so you don't have to walk all the way down every time.

## Making fruit look good

Every character is built from **lathe profiles**, the same trick you'd use to turn a vase on a lathe. Each fruit gets a procedural skin: dimpled citrus, seeded strawberries, striped melons, diamond-patterned pineapples, fuzzy kiwis with a sheen, and mouldy versions for the rotten monsters. They have eyes with highlights that blink, mouths, blush, eyebrows, hats, and Rayman-style floating gloves and shoes.

There are no animation files. Everything is procedural: fruit squash when they're hit, bounce when they walk, wind up before they swing, wobble when they're stunned, and pop when they die.

The dungeons have a few tricks of their own:

- Walls that stand between the camera and your hero are **cut away in the vertex shader**, so you never lose sight of yourself.
- **Fog of war** is a texture with one pixel per tile, eased every frame. Places you've been fade to a cool, washed-out memory.
- Your hero carries a warm light, and a pool of eight point lights gets reassigned every frame to the nearest torches, glowing mushrooms and explosions.
- The boiling fruit punch in Act 3 has its own shader.
- Each act gets its own colour grade, and the screen pulses when your Freshness gets low.

On phones the game starts at a lower quality setting, and on any device it drops a level automatically if frames get slow.

## The sound

All the sound is Web Audio, with no audio files. Each area has its own generative score: a lute waltz in town, drones and drips in the cellar, sneaky pizzicato in the jam, toms and dark pads in the core, a driving boss track and a victory fanfare. The effects include squishes, splats, seed shots, freezes, zaps, meteors, chest opens and glass breaking. When you die, you get a sad trombone.

## On a phone

On a desktop it plays like Diablo: click to move, click a monster to attack it until it pops, right-click or 1–4 for skills. WASD works too.

On a phone, you drag on the left side of the screen to walk and tap the ground or a monster to act. A big ⚔️ button attacks the nearest enemy, and the round skill buttons aim themselves. If there's no enemy nearby, ⚔️ picks up the nearest loot or opens the nearest chest instead. Walking over an item also picks it up.

That last part came from a bug. In the first release, the invisible joystick area in the bottom-left corner sat on top of everything and swallowed every tap there, so you couldn't pick up loot that landed in that corner. Version 1.0.2 fixed it, and the phone test now taps a loot label inside the joystick area to make sure it stays fixed.

## Tested by a bot

As with the other recent games, the `dev/` folder has test harnesses:

- `simtest.mjs` checks that the simulation is pure (no three.js, no DOM and no `Math.random`), generates 480 levels and checks each one, generates 6,000 items, tests every skill of every class, and then has a **bot play each class from a brand-new hero all the way to Durian's death**. The bot usually finishes in 33 to 55 simulated minutes, at level 23 to 28.
- `browsertest.mjs` plays the game in real Chromium with real mouse clicks and key presses, then does the same on touch-only phones in portrait and landscape, and checks that every panel fits on the screen.

The whole game is about 9,000 lines of plain JavaScript modules with no build step.

## Play it

[Play Rotten to the Core](https://triptych.github.io/web-games-andrew/game-062/), or find its statue in the [Garden of Games](https://triptych.github.io/web-games-andrew/) with the rest of the collection. If you want to see how it's built, the [design doc](https://github.com/triptych/web-games-andrew/blob/main/game-062/game-plan.md) covers everything from the dungeon generator to the boss phases.

Grab a butter knife. Hold your nose. Have fun!
