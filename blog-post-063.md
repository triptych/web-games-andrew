# Tee & Sorcery: A Fantasy Golf RPG in the Browser

*By Andrew Wooldridge*

Game 063 in the collection is [Tee & Sorcery](https://triptych.github.io/web-games-andrew/game-063/). It's golf, but every hole is a little adventure: you level up, buy better clubs, cast spells on your ball, and at the end of each realm you play a boss hole where the cup stays sealed until you've beaten the boss *with your golf ball*.

In the kingdom of **Fairhaven**, every argument (border quarrels, inheritance, who gets the last scone) is settled with a round of golf. At the heart of the Royal Clubhouse sits the **Golden Tee**, the peg the first shot of the world was struck from. Then **Lord Bogey**, a sorcerer who has never once made par, crashes the festival, shatters the Tee into five shards and curses every hole in the land. *"If I can never make par, then NOBODY shall!"*

You play **Pip**, a caddie who has never played a real round, and who trips over an old sand wedge stuck in a rock while running away. Pip pulls it free. It complains.

Like every game here, it uses no asset files. Every character, face, course, texture and note of music is made in code. It's built with three.js and plays on a phone as well as on a desktop.

---

## A talking wedge

The wedge is **Wedgewick the Wise**, formerly Archmage of the Greens, who has been stuck in a club for 300 years after losing a bet. *"Long story. Bad lie."* He's your mentor, your spellbook and your running commentary for the whole quest, and he does most of the teaching:

> Next stop, the Sandsea Dunes. Pack sunscreen. I burn easily. I am made of metal.

The story is nine short scenes, two to eight lines each, typed out with a voice blip pitched to each speaker and a portrait rendered from the 3D character. You can skip any of them. The tone is Saturday-morning cartoon: nothing is scary, nobody dies, and every boss is grumpy and then sorry.

## The golf has to work on its own

The first rule I set was that if you stripped out all the RPG parts, it should still be a nice little golf game. So every shot is real 3D golf:

- **Aim** left or right, and pick from four clubs: Driver, Iron, Wedge and Putter. The game picks one for you based on distance and lie, and switches to the putter on the green.
- A dotted arc of glowing orbs shows where a full-power, perfect shot would go, with tick marks for 25, 50 and 75% power. Wind isn't in the preview. Reading the flag is your job.
- The **swing meter** takes three presses: one to start, one to set power, and one to stop the marker in the sweet spot on the way back. Hit the glowing zone for a **PERFECT** strike, which flies straight and a little further. Early or late and the ball hooks or slices by how much you missed.

Under that is a physics simulation that runs at 240 steps a second. The ground is a heightfield, and the ball bounces or rolls on it with different friction for each surface. A ball rolling over a crest can take off again. Tree trunks, windmill blades and walls are solid, but tree canopies are soft and just soak up speed. Each club has backspin that bites on the first landing, so drives run out and wedges stop.

The cup can lip out. Come in too fast and the ball rattles round the edge and keeps going, which is exactly as annoying as it should be.

## Twenty holes, five realms

There are five realms with four holes each: three regular holes and a boss hole. I wanted every realm to *play* differently, not just look different:

| Realm | What's different |
|---|---|
| **Meadowmere** | A turning windmill in the fairway, spring mushrooms that bounce the ball, ponds |
| **Sandsea Dunes** | Sand everywhere, quicksand that stops the ball dead, an island green, a pyramid, strong wind |
| **Frostpeak** | Sheet ice where the ball barely stops, snowdrifts where it barely starts, a frozen lake with holes in it |
| **Cinder Caldera** | Lava rivers and geysers that fling the ball into the sky on a rhythm |
| **Sky Citadel** | Floating islands over nothing, bouncy clouds, a teleport rune and low gravity |

Some of my favourite hole names are Sheepish Start, Quicksand Gulch, Icicle Run, Avalanche Ridge and Starfall Stair. As Wedgewick says about the Caldera: *"Lava is a hazard, like water but rude."*

Each hole gets one to three stars: one for finishing, two for par or better, three for under par. If you go past the stroke limit, the curse wins and you can retry. That's the only way to fail.

## Boss holes

At the end of each realm the cup sits under a shimmering **Bogey Seal**. To break it you have to hit the boss's weak spot with your ball, and the boss gets a turn after every one of your shots.

| Boss | How it plays |
|---|---|
| **Grubbins the Gopher King** | Pops up from one of six molehills round the green, then burrows somewhere else. He'll kick your ball away if it stops near him. |
| **Duneborn** | A sandworm coiled round the green. Only the head takes damage; the coils bounce your ball away. |
| **Big Frosty** | A yeti on an icy throne behind three ice walls. He throws snowballs that bury your ball in a drift. |
| **Double Bogey** | A two-headed magma ogre on a ledge behind a lava moat, so you need loft. His stomp shoves your ball away. |
| **Lord Bogey** | Floats round the green behind two orbiting shield orbs and teleports after each shot. |
| **Triple Bogey** | Bogey's final form: a three-headed dragon. The fire head leaves a fire patch, the frost head an ice patch, and the storm head changes the wind. |

The bosses were the most fun to write dialogue for. Grubbins was promised all the golf balls he could eat, and after you beat him he admits: *"Golf balls are actually very hard to chew."* Big Frosty turns out to be lonely because nobody ever asks him to play. Double Bogey's heads can't agree on anything, including whether to fight you:

> **LEFT HEAD:** We crush the tiny golfer!
> **RIGHT HEAD:** We could also just… let them through? I am tired.

And at the top of the Sky Citadel, Wedgewick recognises Lord Bogey. He's **Bogart**, Wedgewick's old apprentice, who took a fourteen on the first hole 300 years ago and ran off when everyone laughed.

## The RPG part

The RPG layer is there to make the golf richer, not slower. A hole still takes two to five minutes.

You earn XP by finishing holes (more for being under par) and by bonking monsters with your ball: Puffslimes in the meadow, scarabs in the dunes, penguins on the mountain, ember imps in the caldera and Bogey wisps in the sky. Each level gives you two points to spend on four stats:

- **Power** makes the ball go further.
- **Control** slows the swing meter, shows more of the preview arc, and softens hooks and slices.
- **Luck** widens the PERFECT zone, adds a bit of gold, and sometimes gives you a lucky bounce off a tree.
- **Magic** gives you more MP for spells.

Gold comes from coins and gems on the course and from finishing bonuses, and you spend it at Old Man Eagle's **Pro Shop** in the Clubhouse. There are six club sets (from Willow Woods up to Dragonbone, plus Starforged after the ending), six balls and six charms. The balls are my favourite: the Feather ball ignores most of the wind, the Slime ball bounces more, the Iron Heart hits bosses harder, and the Comet leaves a trail.

Spells come back to Wedgewick one at a time, as you recover each shard:

| Spell | What it does to your next shot |
|---|---|
| **Mulligan** | Rewinds your last shot and gives the stroke back |
| **Gust Ward** | No wind, no hook, no slice |
| **Fireball** | Burns through trees, brambles and ice walls, and does double damage to bosses |
| **Frost Step** | Freezes water and lava under the ball so it skates across |
| **Seeker** | The ball curves toward the cup near the end |

Each one changes what a good shot is. Frost Step means a lake is suddenly a shortcut, and Fireball lets you go straight through a wood instead of round it. There are also power-up crystals on the course that give you a Rocket Tee, a Sticky Ball, a Spring Ball or a Ghost Ball that passes through everything.

## A storybook look

The characters are chibis with huge heads, built from simple shapes with toon shading and ink outlines. Their faces are painted onto a canvas in code, with eyes, highlights, brows, a mouth and blush, and they switch between happy, surprised, angry, sad and blinking. There are no animation files: everyone bobs, walks, swings, cheers and slumps procedurally.

The courses use one terrain shader per hole. It's driven by a surface mask built from the same shapes the physics uses, so what you see is exactly what the ball feels. Fairways get mown stripes, greens get a fine checkerboard, sand gets wind ripples, ice gets cracks and quicksand swirls. Ink lines where surfaces meet make the edges read like an illustration in a picture book.

Water has foam at the shore and moving ripples. Lava glows and has a cracked crust that drifts. In the Sky Citadel, the void shows the sky through it with clouds drifting below the islands. Over all of it there's a little bloom on magic and lava and a warm storybook colour grade with faint paper grain.

Between holes you walk Pip round a **floating-island world map**, with the five realms circling a central mountain and the Sky Citadel above. A tilt-shift blur makes it look like a miniature diorama.

A few things are there just to make shots easy to read: a shadow under the ball at all times so you can tell how high it is, a glowing trail coloured by your spell, and a pulsing ring where the ball is going to land.

## The sound

All the sound is Web Audio, with no audio files. Each realm has its own short theme with its own instruments: flute and pizzicato in Meadowmere, oud-like plucks and a hand drum in the dunes, celesta and bells on Frostpeak, low brass and taiko in the Caldera, and harp and a choir pad in the sky. Bosses get faster, minor-key versions, and there's a march for the map and a cosy waltz for the Clubhouse.

The effects cover a swing whoosh, a different contact sound for each club, a chime for PERFECT strikes, bounces for each surface, the cup rattle and drop, splashes, lava hiss, coins, monster poofs, boss roars, the seal shattering and a level-up fanfare.

## On a phone

On a desktop you aim with the arrow keys or A and D (Shift for fine aim), change clubs with up and down, and swing with Space. Number keys cast spells, Q opens your item pouch and V shows the whole hole from above.

On a phone you drag anywhere to aim and tap a big SWING button three times. The spell and item buttons sit in the bottom-left. Every button is at least 44 pixels so your thumb can hit it, and it works in portrait and landscape. There's also a *Gentle swing* setting that slows the meter and widens the PERFECT zone, for younger players.

## What the bot found

As with the other recent games, the `dev/` folder has test harnesses, and the most useful one was a bot that plays golf.

`simtest.mjs` checks that the simulation is pure (no three.js, no DOM and no `Math.random`) and deterministic, fires random shots from random spots on every hole to make sure the ball never goes through the ground or gets stuck in a tree, and checks every boss can be beaten through the real hit path. Then two bots play all twenty holes: a search bot with perfect timing has to make par or better on every hole, and a noisy bot with human-like timing errors has to finish every hole inside the stroke limit. **The pars in the game were set from those bots.**

Watching the bots play found a lot of problems I wouldn't have spotted by hand:

- **Drives rolled 85 yards.** The ball kept all its flight speed when it landed. That's where the per-club backspin came from.
- **The cup was far too big.** The bot was chipping in from 100 yards. It shrank, and so did the speed a ball can drop in at.
- **The noisy bot kept hooking into the woods.** It planned for perfect shots and then missed. Now it checks every shot it's thinking about against a hook, a slice, a fat and a thin strike, and picks one that's safe if it goes wrong.
- **The sandworm couldn't be hit from more than six yards**, because it kept moving while you aimed. Now it holds still while you line up and moves on its own turn.
- **Beating Lord Bogey looked like losing.** His health resets when he becomes Triple Bogey, so the bot saw the winning hit as negative damage and never took it. Boss progress now counts across both forms.
- **Late-game Power turned par 5s into par 3s.** Each point of Power now adds half as much speed as it used to.

`browsertest.mjs` then plays the game in real Chromium: it makes a hero, skips the prologue, walks the map, swings with real key presses, uses a Mulligan, holes out, goes shopping, reloads and continues, and hits a boss. Then it does the same on touch-only phones in portrait and landscape, checks that every control is big enough and nothing overlaps, and fails on any console error.

The whole game is about 8,000 lines of plain JavaScript modules with no build step.

## Play it

[Play Tee & Sorcery](https://triptych.github.io/web-games-andrew/game-063/), or find its statue in the [Garden of Games](https://triptych.github.io/web-games-andrew/) with the rest of the collection. If you want to see how it's built, the [design doc](https://github.com/triptych/web-games-andrew/blob/main/game-063/game-plan.md) covers everything from the physics to the boss turns.

As Pip tells Lord Bogey near the end: *"Golf is not about the score. It is about the walk, and the friends, and the one good shot that brings you back."*

Grab your wedge. Mind the lava. Have fun!
