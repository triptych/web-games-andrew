# Game Ideas: New Mechanics, New Subjects

Written 2026-11-13, after game-133. Twenty ideas for what to build next.

The two older idea lists are still valid but cover different ground:

- [suggestions.md](suggestions.md) lists classic genres the collection lacks (flow puzzle, snake, solitaire, word game).
- [future_games.md](../../future_games.md) looked at theme clusters when the collection had 33 games.

This list starts from what the 133 games already do well and asks a different question: **what mechanic has no game
here yet, and what subject would make it fun?** Every idea below is built around one rule the player has not met in
this collection, in the way game-039 (Wakeform) is built on "you have no weapon" and game-068 (Haven Road) on "heal
the people instead of hurting the monsters".

## What the collection already has plenty of

Worth knowing before picking, so a new game does not land in a full cluster:

| Cluster | Count (roughly) | Examples |
| --- | --- | --- |
| First-person and top-down dungeon crawlers | 15+ | 006, 021, 026, 031, 101, 129, 132 |
| Match-3 and merge | 8 | 002, 050, 088, 100, 108, 118, 128 |
| Shoot-'em-ups and arena shooters | 15+ | 001, 024, 040, 055, 074, 106, 117 |
| Idle and incremental | 8 | 034, 056, 065, 085, 110, 115 |
| Visual novels and point-and-click | 10 | 028, 033, 044, 095, 127, 130, 133 |
| Card, slot and casino roguelikes | 5 | 047, 048, 091, 116 |
| Tactics on a grid | 5 | 064, 097, 098, 103, 112 |

## What it has little or none of

- Word and typing games (none)
- Programming or automation puzzles (none)
- Deduction games where the player works out the answer, not the character (none)
- Fluid, wind, shadow or paper as the thing you play with (none)
- Music making as play (113 is rhythm combat; nothing lets you compose)
- Stealth (only 077, on a pool table)
- Photography, language learning, ecosystems, social logic (none)

## The ideas at a glance

| # | Working title | Genre path | The one new rule |
| --- | --- | --- | --- |
| 1 | Tidewriter | puzzle | Words you write on a beach are erased by a tide that rises and falls |
| 2 | Ghostwriter's Desk | arcade | Your typos are real words, and they come true |
| 3 | Floorscript | puzzle | The program is painted on the floor; golems run whatever they walk over |
| 4 | Kaiten Junction | strategy | You do not cook: you lay the conveyor belt that carries the food |
| 5 | The Parrot Saw Everything | story | Your only witness repeats sounds; you place them on a timeline |
| 6 | Lift Operator, 1929 | story | Secrets spread between passengers who share a lift, and you choose who shares |
| 7 | Shadowstage | puzzle | The hero walks on shadows, so you move the lamps and props, not the hero |
| 8 | Creasewood | puzzle | The level is a sheet of paper and you fold it to join far-apart places |
| 9 | Gargoyle Shift | arcade | You can only move while nobody is looking at you |
| 10 | Yesterday's Crew | strategy | A one-raccoon heist where every earlier attempt plays back beside you |
| 11 | Reset Crew | dungeon | You are the staff who put the dungeon back together between hero parties |
| 12 | Heirloom | rpg | You are the sword. Heroes come and go; you pick who carries you |
| 13 | Cloudfisher | cozy | Fish the sky for weather, then pour it out where it is wanted |
| 14 | Hum & Hive | cozy | A garden that is a music sequencer, played by the bees that fly through it |
| 15 | Jarworld | cozy | Stock a sealed terrarium, close the lid, and see if it lives 100 days |
| 16 | Damworks | strategy | Real flowing water on a grid, and beavers to steer it |
| 17 | Stringcutters | arcade | Kite fighting in a visible, changing wind |
| 18 | Cryptid Quarterly | arcade | Photograph monsters for a tabloid, where blurrier pictures sell better |
| 19 | First Day at Grimsby Monster School | story | Nobody speaks your language, and you fill in the dictionary yourself |
| 20 | Seating Plan | puzzle | Seat the wedding guests by logic, then watch the reception play out |

---

## Puzzle

### 1. Tidewriter

**Pitch.** A lighthouse keeper's child writes words in the sand with driftwood letters, and the sea keeps taking them
back.

**How it plays.** The screen is a beach in side-on slices: dry sand at the top, wet sand in the middle, the surf at
the bottom. Letter tiles wash in with each wave and sit where the wave left them. Drag tiles into rows to spell words.
A word scores more the closer it is to the water, because it will be washed away sooner, and a word that is washed
away pays out a second time as "sea glass" if it survived at least two waves. The tide line moves on a visible
schedule (a tide table at the side), so the player can plan: build a long word high up over several waves, or cash
short ones at the water's edge.

**What is new here.** The collection has no word game at all. The tide gives a word game something it does not
normally have: position and timing matter as much as vocabulary.

**Extras.** A daily beach with a seeded letter order; storms that throw tiles high up the beach; a crab that walks
off with a vowel; a message in a bottle that asks for one specific long word across a whole session.

**Build notes.** Vanilla Canvas 2D, a bundled word list, pointer drag for phones. The simulation (tide, tiles,
scoring) is small and fits the sim/view layout well.

### 3. Floorscript

**Pitch.** You run a bakery staffed by clay golems that cannot be told anything. They only do what the floor says.

**How it plays.** A golem walks forward until something stops it. You paint rune tiles on the bakery floor: turn
left, turn right, pick up, put down, wait, "if carrying flour, turn". When a golem steps on a rune it does that one
thing. Orders come in (three loaves, one pie), ingredients sit in bins, ovens take time, and the golems walk the
loops you drew. Each level gives a floor plan, a tile budget and an order sheet. Later levels add a second and third
golem sharing the same floor, so one painted program must work for all of them, and collisions jam the kitchen.

**What is new here.** No game in the collection is a programming puzzle. Putting the program in the space, where
walking is execution, means the player never reads code: they watch a golem walk into a wall and see the bug.

**Extras.** Par scores for fewest tiles and fastest batch; a sandbox kitchen; a golem that reads runes mirrored.

**Build notes.** Vanilla Canvas 2D on a grid, or three.js with an overhead camera. Levels are plain data. The sim is
fully deterministic, so `dev/` tests can assert that each level's reference solution passes.

### 7. Shadowstage

**Pitch.** A shadow puppet has to cross the stage, and the only ground it can stand on is shadow.

**How it plays.** A small 3D stage with a white backdrop. Props (a chair, a ladder, a teapot, a cut-out castle) stand
between a lamp and the backdrop and throw shadows on it. The puppet lives on the backdrop and walks along the tops of
shadows on its own, turning round at gaps. The player never touches the puppet. They slide and turn the props, move
the lamp closer (bigger, softer shadows) or further away, and switch between two lamps to make the ground change
under the puppet's feet. Each scene ends when the puppet reaches the stage door.

**What is new here.** A puzzle about light, in a collection with strong three.js lighting already. It is also a
platformer where the player is the level designer in real time.

**Extras.** Coloured lamps whose shadows overlap into a third colour only one puppet can walk on; a second puppet
that must meet the first; a "performance" replay of the solved scene with music.

**Build notes.** Three.js. The shadow outline needs to be computed in the sim, not read back from the renderer:
project each prop's silhouette polygon from the lamp onto the backdrop plane and use that for collision.

### 8. Creasewood

**Pitch.** A paper fox wants to get home across a map that is, quite literally, a sheet of paper.

**How it plays.** Each level is a square sheet with paths, rivers and cliffs drawn on it. The fox walks drawn paths
only. Drag an edge or corner to fold the sheet along a crease line: the folded flap lies over another part of the
map, and paths on the flap now join paths underneath it. Unfold, refold another way, and walk the fox across each new
join. Some sheets are printed on both sides, so a fold shows the back. A level allows a set number of creases, and
used creases stay in the paper as weak lines that later folds snap to.

**What is new here.** Nothing in the collection changes the shape of the level itself. The crease memory makes early
folds matter later.

**Extras.** Scissors levels (one cut allowed); an origami finish where the solved sheet folds itself into an animal
for a collection shelf.

**Build notes.** Vanilla Canvas 2D is enough if folds are limited to horizontal, vertical and 45-degree lines on a
grid. Three.js would make the folding animation nicer but is not needed for the logic.

### 20. Seating Plan

**Pitch.** You are the wedding planner. Forty guests, eight tables, and Aunt Dot must not sit near the band.

**How it plays.** A logic puzzle in two halves. First, drag guests to seats using the clue cards: "the twins sit
together", "Uncle Rex is not at a table with anyone he owes money", "nobody under ten next to the cake". Clues can be
positional, relational or conditional. Second, press Begin and the reception runs as a small simulation: guests talk
to their neighbours, feuds flare, friendships form, the cake survives or does not. A perfect plan gives a calm, happy
party; a plan that only breaks a soft clue gives a funny incident and a lower star rating, not a failure.

**What is new here.** Constraint logic with people in place of numbers, and a pay-off scene that shows the
consequences. The collection's puzzles are all about tiles and blocks.

**Extras.** A campaign of events (wedding, school reunion, a dragon's birthday, a peace treaty dinner); generated
puzzles with a guaranteed unique solution; a gossip column that reports what happened.

**Build notes.** Vanilla JS with DOM for the tables and cards, which also makes it accessible by keyboard. Needs a
small constraint solver in `dev/` to check each puzzle has exactly one perfect answer.

---

## Arcade

### 2. Ghostwriter's Desk

**Pitch.** You type letters for the ghosts of a haunted post office, and every typing mistake you make happens.

**How it plays.** Ghosts queue at the desk and dictate. Type what they say before their patience runs out. The twist
is in the mistakes: if a slip turns a word into another real word, the letter is sent that way and the result walks
into the room. "Send beer" typed as "send bear" delivers a bear, which sits on the desk and blocks part of the next
letter. "Dear" as "deer", "ghost" as "goat", "witch" as "which". Mistakes that are not words just cost time. Clearing
a visitor needs its own word typed cleanly. Skilled players can make deliberate "typos" when a ghost's request can be
improved: a ghost who asks for a "storm" is happier with a "story".

**What is new here.** The first typing game in the collection, and one where errors produce comedy instead of a red
underline.

**Extras.** A mischief score for the best accidental words; a nightly shift structure with a different ghost family
each night; an on-screen keyboard mode for phones with shorter words.

**Build notes.** Vanilla JS and DOM text with a Canvas 2D scene behind. The core data is a hand-built table of
near-miss word pairs with a consequence for each; start with about 150 pairs.

### 9. Gargoyle Shift

**Pitch.** You are a cathedral gargoyle who is tired of the north tower and would like a better view. Statues do not
move. Not while anyone is watching.

**How it plays.** A top-down or isometric cathedral full of tourists, choirboys, a verger and pigeons, each with a
visible cone of sight. You move freely only while no cone touches you. The moment someone looks, you freeze in
whatever pose you held, and they stay suspicious only if you are somewhere a statue should not be (a plinth, a niche
and a rooftop are fine; the middle of the aisle is not). So the route is a chain of dashes between believable resting
places. Later levels let you create distractions: ring a bell, drop a hymn book, release the pigeons.

**What is new here.** Stealth is almost absent from the collection. This is stealth without hiding: you are always in
plain sight, and the question is whether you look like you belong.

**Extras.** Other gargoyles to wake and lead in a line; a rainy level where you must end each move under a spout; a
photographer whose flash freezes you for longer.

**Build notes.** Three.js with a fixed camera, or Canvas 2D top-down. Sight cones and "valid perch" tiles are the
whole rule set, so the sim is small.

### 17. Stringcutters

**Pitch.** A rooftop kite-fighting festival. Last kite in the sky wins.

**How it plays.** Side-on view of a city skyline. You hold the string: let it out, reel it in, and lean left or
right. The wind is drawn on screen as drifting streaks, and it changes with height and over time, with gusts, lulls
and rooftop updraughts. A kite's string is its weapon and its weakness: cross an opponent's string while you are
reeling in fast and you cut theirs. Tension matters, since a slack string cuts nothing and a tight one snaps in a
gust. Rounds are short and the bracket is eight kites.

**What is new here.** Wind as a field the player reads and uses. The collection's physics games are about
throwing and bouncing; this one is about holding on.

**Extras.** Kite shapes with different handling (diamond, box, dragon); glass-coated string as a limited power-up;
a free-flying calm mode with no opponents.

**Build notes.** Vanilla Canvas 2D. The string is a short chain of verlet points, and the wind is a coarse grid of
vectors that scrolls.

### 18. Cryptid Quarterly

**Pitch.** You are the only staff photographer at a failing tabloid. The editor wants monsters on the cover, and the
readers only believe a photograph if it is terrible.

**How it plays.** First-person in the woods, at a loch or over a desert highway at night, with a camera and twelve
shots per roll. Creatures appear briefly at the edges of things. Each photo is scored on what is in the frame and on
how believable it looks, and belief goes up with blur, distance, bad light and something in the way. A sharp, centred
picture of the lake monster is "obviously a model". So the best shot is taken while turning, through branches, at
dusk, with the creature half out of frame. Back at the office you pick the cover, write the headline from word tiles,
and see the sales.

**What is new here.** A photography game, which the collection lacks, with a scoring rule that turns the usual
instinct upside down.

**Extras.** A rival paper that scoops you if you wait too long; hoaxers in costumes who must not end up on the
cover; a scrapbook of every creature and its best worst photo.

**Build notes.** Three.js. Score a photo in the sim from the camera's frustum, each subject's screen area, the
camera's turn speed at the moment of the shot and the light level, not from the rendered pixels.

---

## Story

### 5. The Parrot Saw Everything

**Pitch.** A jewel has gone from a locked seaside hotel. Nobody saw anything, except the parrot in the lobby, who
repeats what it hears.

**How it plays.** Each case gives a floor plan, a handful of suspects and one parrot. Ask the parrot and it says
things it heard that night: a door slam, "not now, Gerald", a clock striking, a cough, a line from a song on the
wireless. The sounds come out in no order. The player drags each one onto a timeline and a room, using fixed anchors
(the clock strikes, the radio programme listing, the creak of one known stair) to place the rest. When the timeline
holds together, the gap in it is the theft, and the player names who was where. Wrong accusations cost reputation,
not the case.

**What is new here.** A deduction game where the player does the reasoning. The mysteries already in the collection
(095, 104) are adventures that carry the player to the answer.

**Extras.** Later witnesses with their own flaws: a cat who only reports smells, a baby monitor with gaps, a
grandfather clock that is ten minutes fast. Synthesised parrot voice with WebAudio.

**Build notes.** Vanilla JS and DOM, with drag and keyboard placement. Each case is a data file of events; a checker
in `dev/` confirms the clues give exactly one consistent timeline.

### 6. Lift Operator, 1929

**Pitch.** You work the lift at the Hotel Meridian. You hear everything, you say nothing, and you decide who rides
with whom.

**How it plays.** A cross-section of an art deco hotel with one lift, then two. Guests call it from floors and want
other floors. That is the surface game, and it is a pleasant time-management one. Under it, each guest carries
secrets, and two guests alone in the lift together for more than a floor or two will talk. A secret told moves on:
the banker tells the singer, the singer tells the detective next trip. The player steers this by timing: hold the
doors, skip a floor, send someone the long way round. Each evening has a goal that only the right chain of
conversations will reach: get the warning to the heiress, keep the telegram from the husband, bring the two shy
musicians together.

**What is new here.** Gossip as a resource that the player routes, with an arcade game as the control surface. No
other game in the collection has information moving between characters as its main system.

**Extras.** A notebook that fills in who knows what; guests who lie; a week-long story told across seven evenings;
tips that buy a faster motor or a quieter bell.

**Build notes.** Vanilla Canvas 2D with DOM dialogue. The secret graph is simple data: who holds which fact, and
which pairs will share.

### 19. First Day at Grimsby Monster School

**Pitch.** You are the first human exchange student at a school for monsters, and you do not speak a word of
Monstrish.

**How it plays.** Teachers and classmates speak in glyphs. At first the player understands nothing and gets by on
context: the canteen troll points at a bowl and says two glyphs; the timetable has a glyph next to a picture of a
bell. The player keeps a notebook and writes a guess under each glyph. Guesses then appear in place of the glyphs in
all later speech, right or wrong, so a bad guess produces sentences that almost make sense. Lessons, lunch, a
detention and a school play all need the player to understand, and then to answer by putting glyphs together. The
language is small (about 60 words), regular, and fully learnable in one playthrough.

**What is new here.** Learning a language is the whole game. The feeling of a sentence suddenly reading clearly is a
reward none of the other 133 games gives.

**Extras.** Word order that differs from English; a rude word the player is taught on purpose by a classmate; an
end-of-term exam that is a real conversation.

**Build notes.** Vanilla JS and DOM for text, Canvas 2D or CSS for scenes. Glyphs can be drawn in code from a few
strokes each, so no font file is needed.

---

## Strategy

### 4. Kaiten Junction

**Pitch.** A conveyor-belt sushi bar on a night train, and you are not the chef. You are the one who lays the belt.

**How it plays.** The chef makes plates at a steady rate and puts them on the belt. Customers sit at the counter and
each wants certain plates, and gets cross if the wrong ones keep going past. Between services, the player builds the
belt on a grid: straight track, curves, splitters that send every second plate left, colour gates that only pass red
plates, a loop that holds plates until someone wants them, a hatch back to the kitchen for plates that have gone
round too long. During service the player only watches and flips one or two manual switches. Each carriage is a new
layout with new regulars.

**What is new here.** An automation and logistics puzzle. It is a cooking game where the interesting part is the
plumbing.

**Extras.** A fussy food critic whose plate must arrive within three seats of the kitchen; a carriage with two chefs;
endless mode with a growing counter.

**Build notes.** Vanilla Canvas 2D or three.js overhead. Deterministic sim on a fixed tick, levels as data.

### 10. Yesterday's Crew

**Pitch.** One raccoon, one night, one clockwork museum, and a crew of five. All five are you.

**How it plays.** Each attempt is a 60-second loop. On the first, you run in and hold a door lever. Time rewinds. On
the second, your first self runs in and holds the lever exactly as you did, and you go through the door and stand on
the pressure plate. The third self carries the ladder. Earlier selves replay their inputs exactly, so if a later self
changes what an earlier one was relying on (takes the ladder they were about to climb), that earlier self carries on
blindly and fails, and the plan falls apart on screen. A heist is solved when all the recordings together get the
jewel out in one shared minute.

**What is new here.** Co-operation with your own past, planned across loops. Nothing in the collection uses
recorded play as a game piece.

**Extras.** Guards on fixed patrols that react to every self; a per-level limit on selves, with a bonus for using
fewer; a final replay with all the raccoons shown at once, which is the reward.

**Build notes.** Vanilla Canvas 2D, top-down. This depends on a fully deterministic sim driven by recorded inputs on
a fixed tick, which is how the sim/view games here are already written.

### 16. Damworks

**Pitch.** Beaver & Daughters, Civil Engineers. The valley floods every spring and the villages would like it not to.

**How it plays.** A valley seen from above, on a grid with height. Water is a real cellular simulation: it flows
downhill, pools, overflows and soaks away. Each level names what must be wet and what must be dry by the end of the
thaw: fill the mill pond, keep the school dry, get a stream to the orchard. The player has a few beavers and assigns
them to build dams from nearby trees, dig channels and open sluices. Trees are limited, and cutting them changes how
fast the ground drains. Then the snow melts and everything the player built is tested at once.

**What is new here.** Fluid as the main system. The plan-then-watch rhythm is like tower defence, but nothing is
attacking: the opponent is gravity.

**Extras.** A free-build valley with seasons; otters who want a slide; a drought level played the other way round.

**Build notes.** Canvas 2D for a first version, three.js with a heightfield and a water surface for a later one.
Water as integer depth per cell, moved to lower neighbours each tick, is enough and is cheap.

---

## Dungeon

### 11. Reset Crew

**Pitch.** Every dungeon has heroes. This one also has staff. You are the night shift who put it all back before the
next party arrives at nine.

**How it plays.** A shift starts with a short replay of the last heroes going through a room: they smash the urns,
set off the dart trap, kill the skeletons, loot the chest and prop the secret door open with a chair. Then the room
is yours and the clock is running. Sweep up, glue the urns, reload the darts, put the skeletons back together (the
bones are mixed up), refill the chest with level-appropriate treasure, light the torches, hide the secret door. The
next party's rating depends on how well the room matches the brief: an untidy dungeon gets a poor review, and one
with the wrong skull on the wrong skeleton gets a confused one.

**What is new here.** The collection has more than fifteen dungeon crawlers and none from this side of the counter.
It is a memory game and a time-management game wearing the collection's favourite subject.

**Extras.** A boss room where the boss is a colleague who needs waking and feeding; hero parties with tastes (the
speedrunner, the completionist, the one who reads every plaque); a staff room to upgrade between shifts.

**Build notes.** Three.js with a fixed isometric camera would suit the house style and could reuse dungeon props
from earlier games. The sim is a list of object states compared against a target list.

---

## RPG

### 12. Heirloom

**Pitch.** You are a sword. You have been a sword for nine hundred years. Heroes are a thing that happens to you.

**How it plays.** A generational RPG seen from the weapon's point of view. Each chapter is one wielder's life: a farm
boy, a mercenary captain, a queen, a thief who stole you. You do not control them directly. In a fight you choose how
to be swung (guard, lunge, sing, refuse), and between fights you speak in the wielder's dreams to push them one way
or another. Wielders grow old, die, give you away or lose you in a river, and their time with you leaves a mark: an
inscription, a notch, a new name. Those marks are the levelling system. At the end of each life you choose the next
hand from whoever is nearby, and that choice sets the next chapter.

**What is new here.** The party member that stays is the item, and the heroes are the things that are swapped. The
collection's many RPGs all keep the hero and change the gear.

**Extras.** Long gaps (a century in a barrow) that change the world between chapters; a rival blade; an ending
decided by the full list of names you were given.

**Build notes.** Vanilla JS, mostly text and portraits with a simple turn-based fight view. Content-heavy rather
than system-heavy: five lives of about 20 minutes each is a good first scope.

---

## Cozy

### 13. Cloudfisher

**Pitch.** A small airship, a long line and a sky full of weather. Below you, farmers are waiting for rain.

**How it plays.** Lower a line from your airship into the cloud layers. Different heights hold different catches:
mist near the top, fat rain clouds in the middle, thunderheads low down, and now and then a rainbow or a cold front.
The catch goes into jars in the hold. Then you fly over the patchwork country below and pour: rain on the dry
orchard, snow for the ski village, a breeze for the windmill, fog for the smugglers if you are that sort of captain.
Each delivery changes the land, and the land changes what forms in the sky the next day. There is no failure, only
towns that are more or less pleased.

**What is new here.** Fishing, which the collection does not have, turned upside down, with a second half where the
catch is used on a living map.

**Extras.** Mixing jars (rain and sun make a rainbow); a festival calendar that asks for particular weather; rare
catches such as a lost balloon or a very small dragon.

**Build notes.** Three.js with a low camera for the fishing and a tilt down for delivery, or a two-layer Canvas 2D
view. Fits the cozy path next to game-052 and game-122.

### 14. Hum & Hive

**Pitch.** A garden where every flower is a note and the bees are the musicians.

**How it plays.** Plant flowers on a small meadow. Each kind has a sound (bluebells chime, foxgloves are a soft bass,
poppies are a hand drum), and its place on the meadow sets the pitch. Bees leave the hive and fly a route from flower
to flower, and each visit plays the note. Draw a bee's route with a finger and it loops for ever, so three bees on
three routes make three interlocking parts. A hedgehog who lives in the garden hums a tune each morning, and matching
it is the gentle goal; the rest of the time it is an instrument. Honey from well-visited flowers buys new seeds and
new sounds.

**What is new here.** A game where the player composes. Game-113 uses rhythm for battles, but nothing here lets the
player make music and keep it.

**Extras.** Save and share a garden as a short code; weather that changes the scale (rain is minor); a night garden
with moths and a different set of sounds.

**Build notes.** Vanilla Canvas 2D with WebAudio oscillators and envelopes, no samples. Bee flight time between
flowers must be quantised to the beat so that any garden sounds in time.

### 15. Jarworld

**Pitch.** A big glass jar, some soil, a lid. Whatever you seal inside has to get along for a hundred days.

**How it plays.** Choose what goes in: moss, a fern, springtails, a snail, two woodlice, a pinch of fungus, a little
water. Close the lid and run time forward. Inside, a small food web runs on light, water, air and waste: plants make
air, animals use it, fungus breaks down what dies and feeds the plants. Too many snails and the moss is gone by day
twenty; too few decomposers and the jar goes sour. The player can only watch, move the jar nearer the window, and
decide whether to open the lid, which resets the day count. Surviving jars go on a shelf and keep living.

**What is new here.** An ecosystem sim where the play is in the setting up and the observing. It is the opposite of
an idle game: numbers that must stay level, not go up.

**Extras.** Stranger jars (a desert jar, a pond jar, a jar with a very small dragon who eats nothing but sunlight); a
field notebook that records each species' rises and falls as a chart; a seed code for sharing a jar.

**Build notes.** Three.js for the glass and the life inside it, with the sim as a handful of population and resource
numbers stepped once per day.

---

## Suggested first picks

If choosing three to build first:

1. **Floorscript (#3)**. It fills the biggest mechanic gap (programming), is fully deterministic and easy to test,
   and its levels are data.
2. **Lift Operator, 1929 (#6)**. The most original system on the list, with a setting the collection has not used,
   and small in scope for a first version (one lift, one evening).
3. **Ghostwriter's Desk (#2)**. The first typing game, quick to build, and funny from the first minute.

For a seasonal slot, **Seating Plan (#20)** suits a wedding or holiday-dinner theme, and **Cloudfisher (#13)** is the
best fit for the cozy path.

## When one of these is built

- Strike it through here with the game number and date, as [suggestions.md](suggestions.md) does.
- Write the full design in the new game's own `game-plan.md`; this file stays a list of pitches.
