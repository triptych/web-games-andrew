# FABLECART

**Genre:** Fantasy RPG game maker, inside a retro console that is itself a game
**Engine:** Vanilla JS: Canvas 2D (a 288×180 low-res buffer scaled by whole numbers), no asset files
**Status:** v1.0.0

---

## Concept

FABLECART is a pocket fantasy console. Power it on and you are the Tinker, walking round a little workshop room. Four machines stand against the back wall: the **Shelf** (your cartridges), the **Stage** (where you build scenes), the **Press** (where you make stickers) and the **TV** (where you play). Walk into one and it opens. The room is not a menu dressed up: it is a cartridge like any other, run by the same engine as the games made on it.

Games are made of **stickers**: a princess, a dragon, a castle, a chest, a door. Stickers are *alive*. Each carries a few rules ("when I touch a hero, hurt it", "every 2.6 seconds, if a hero is near, shoot a fireball") and nothing else tells them what to do. Stick a Princess, a Dragon and a Castle into a scene and press play: the dragon hunts the princess, her sparkles hurt it, it drops a key when it dies, and the castle opens for a key. Swap the Princess for a Knight and a different game happens.

The rules are written in **blocks**: coloured pieces you drag or tap into a stack. There is no text to type. Every built-in sticker is made of the same blocks you get, so you can open the Dragon, change what its fireball does, and the cart keeps your version. New stickers are drawn on a 12×12 grid in the console's sixteen colours.

Riffs on: Scratch and Mario Maker for the making, PICO-8 for the fantasy console, Zelda for the starter cartridge, Dreams for stickers that are alive.

## Core loop

Walk to the Press → draw or change a sticker, give it rules, watch it live on the test stage above → walk to the Stage → stick it into scenes with other stickers → ▶ Play → fix what felt wrong → Share the cartridge as a code.

## The sticker world (the pure sim, `js/sim/`)

A scene is 24×14 cells; a sticker is 1 cell (or 2×2). Each sticker has a position, health, facing, a small motion state and timers. Each step, in order: queued *hurt* rules, last step's *shouts*, a tap on a sticker, then every sticker's rules, then movement, then the defeated run their *when I am defeated* rules, then scene changes and the lose check.

**Events (gold blocks):** when I appear, always, every N seconds, when I touch TAG, when TAG comes within R, when button A/B is pressed (with a wait; holding fires again), when I am tapped, when I am hurt, when I am defeated, when I hear MESSAGE.
**Move:** steer with the stick, chase TAG, run from TAG, wander, walk a direction, fly forward, stand still. Movement blocks set a motion that lasts a few tenths of a second, so `always` keeps renewing it and `every 3 s → chase for 1.5 s` works too.
**Fight:** hurt WHO by N, heal, knock away, shoot STICKER. WHO is me, it (the other sticker in the event), the nearest TAG, or every TAG within R.
**Look:** say, effect, play sound. **World:** make N of STICKER (here, in front, around, random, at it), turn WHO into STICKER, remove WHO, give or take an item (coin, key, gem, star), score, go to the next/previous/first scene, YOU WIN, GAME OVER.
**Logic:** if/otherwise on a condition, repeat N, set or change a variable (A, B, C), shout a message. Conditions: touching TAG, TAG within R, my health, you have ITEM, variable, by chance, how many TAG there are. Any condition can be negated.

A sticker's tags are its own tags, `solid` if it is solid, and **its sticker id**, so "touch dragon" and "how many goblin" work with nothing declared. Hero stickers (tag `hero`) are not special except that when the last one falls the game is lost and heroes travel between scenes through doors keeping their health and the bag.

Guards: at most 130 live stickers (a breeding sticker stops there), 160 blocks run per sticker per step, 8 rules per sticker, 30 blocks per rule, nesting 4 deep.

## Content

28 stickers: heroes Princess (shoots sparkles, holds A to keep firing) and Knight (sword swing); Fairy (follows, heals); foes Dragon (big boss, breathes fireballs, drops a key), Goblin, Slime, Bat, Goblin Hut (makes goblins until destroyed); places Castle (win with a key), Door to Next, Door Back; props Tree, Rock, Chest, Open Chest, Campfire, Signpost; items Coin, Gem, Heart, Key; magic Sparkle, Fireball; and the console's own Tinker, Shelf, Table, Press, TV (hidden from the palette). Four backgrounds (meadow, forest, cave, snow) and the workshop.

**Dragon's Hoard** is the built-in cartridge: two scenes (the meadow with goblins, a hut and slimes; the dragon's keep with bats and campfires). Kill the dragon, take its key, open the castle. It is read-only; *Copy to edit* puts a copy on your shelf.

## Console, carts and sharing

A cartridge is plain JSON (`{ v, name, goal, stickers, scenes }`). `stickers` holds your own stickers and overrides of built-ins (an override replaces the built-in in that cart only; *Original* undoes it). The Shelf holds 12 carts in `localStorage`; a share code is `FC1:` plus base64 of the JSON. **Import runs everything through `sanitizeCart`**, which rebuilds the cart key by key from the catalogue (known blocks only, clamped numbers, ids that can't be `__proto__`, text without markup, hidden console blocks stripped), so a code is data, never code.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Walk | Arrows / WASD | Stick / d-pad | Drag on the left of the picture |
| Button A (hold to repeat) | Space / Z / J | A | A button |
| Button B | X / K | X | B button |
| Pause | P / Esc | Start | ❚❚ |
| Tap a sticker | Click | | Tap |
| Stage | click or drag; right-click erases; Delete removes the selected | | tap, drag |

## Look and sound

Everything is drawn in code in one 16-colour palette (Sweetie-16, CC0). A sticker is its 12×12 art plus a one-pixel white die-cut border baked once into a canvas. Backgrounds are procedural. The picture is a 288×180 buffer scaled by a whole number where it can be; text, speech bubbles and the goal banner are drawn after the scale at full resolution. Sound is all Web Audio: a boot jingle, effects per event, and a small look-ahead sequencer with three square-and-triangle tunes (room, play, make).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, mode machine (boot, room, play, stage, press), layout in px from `visualViewport`, fixed-step loop, input and event routing, debug hooks |
| `js/sim/blocks.js` | The block catalogue (events, actions, conditions) and the import sanitiser |
| `js/sim/stickers.js` | The 28 built-in stickers: art, stats and rules in block language |
| `js/sim/world.js` | The interpreter and the world: scenes, rules, touch, damage, motion, doors, win and lose, save |
| `js/sim/cart.js` | Cart schema, sanitising, share codes, snapping, the starter cart and the console room |
| `js/sim/bot.js` | Auto-player for tests and balance |
| `js/view/view.js`, `sprites.js` | Canvas 2D view, particles, boot screen, text; baked sprites and backgrounds |
| `js/ui/screens.js` | Screen stack, toasts, settings, touch deck |
| `js/ui/shelf.js`, `stage.js`, `press.js` | The Shelf, Sticker Book and share dialog; the Stage editor; the Sticker Press (pixel editor, stats, tags, draggable block editor, live test stage) |
| `js/input.js`, `audio.js`, `save.js`, `rng.js`, `config.js` | Input merge, sound and music, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every block's behaviour, hostile imports, determinism, save round trips, the console room and has the bot play the starter cart at three skill levels. `browsertest.mjs` drives the real console on desktop, on touch-only phones in both orientations and with storage blocked.

## Balance notes

Bot win rates on Dragon's Hoard: skill 1 about 90%, skill 0.5 about half, skill 0.2 under 10%, standing still never. The first draft was a walkover even for a slow bot; the bot's reaction lag was widened so skill matters. A heart sitting at a door's arrival point healed the hero for free (found by a test) and was moved.

## Open questions / next steps

- Nobody has played it. The bot proves the starter cart is winnable and the tests prove the editors work, but how the Press *feels* to a first-time maker on a phone is unproven.
- Blocks can't yet pass values between stickers beyond three global variables and shouts. A per-sticker variable and "turn toward" would open up puzzles.
- Mid-game saves of a running game are in the sim (`serialize`) but the console only saves carts.
- Only run in headless Chromium, never on a real touchscreen.

## Changelog

### v1.0.0 (2026-10-25)
- First release: the console room, Shelf, Stage, Sticker Press with a pixel editor and draggable block editor, 28 stickers, the Dragon's Hoard cartridge, sharing by code, a bot and full harnesses.
