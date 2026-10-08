# Twenty Games in Eight Days: How 046 to 065 Were Built with an LLM

*By Andrew Wooldridge*

Between September 29 and October 6, twenty new games went into this collection, from [Quiverspire](https://triptych.github.io/web-games-andrew/game-046/) (046) to [Worldroot](https://triptych.github.io/web-games-andrew/game-065/) (065). Together they add up to about **154,000 lines of JavaScript**, plus another **13,000 lines of test bots and browser harnesses**. None of it uses an image file, a sound file or a model file.

Almost every line was written by Claude, working in [Claude Code](https://claude.ai/code) sessions that run in the cloud and are started from claude.ai. This post explains how that works: what goes into a session, what comes out, and the parts that still need a person.

---

## The short version

Each game is **one Claude Code session**. It starts from a short pitch, and the session titles are a fair record of how short those pitches were:

- "Archero clone game in Three.js" → [Quiverspire](https://triptych.github.io/web-games-andrew/game-046/)
- "Slay the Spire poker solitaire game" → [Ashes & Aces](https://triptych.github.io/web-games-andrew/game-047/)
- "Doom-style FPS with Three.js" → [Pale Engine](https://triptych.github.io/web-games-andrew/game-054/)
- "Fruit-based Diablo clone game" → [Rotten to the Core](https://triptych.github.io/web-games-andrew/game-062/)
- "Fantasy RPG golf game design" → [Tee & Sorcery](https://triptych.github.io/web-games-andrew/game-063/)
- "Magical forest idle clicker game" → [Worldroot](https://triptych.github.io/web-games-andrew/game-065/)

The session gets a fresh cloud container with this repo cloned into it and its own git branch. It runs in auto permission mode, so it can write files, run Node, start a local server and drive a headless Chromium without stopping to ask. It writes a design document, builds the game, writes bots that play it, tests it in a real browser on desktop and phone screens, updates the launcher and the docs, and commits and pushes. The branch becomes a pull request, I play the game, and anything I find goes back into the same session as a follow-up message.

The time from pitch to a finished v1.0.0 varied a lot:

| Game | Session started | v1.0.0 pushed | Elapsed |
|------|-----------------|---------------|---------|
| Worldroot (065) | 05:30 UTC | 06:51 UTC | ~1 h 20 min |
| Rotten to the Core (062) | 01:11 UTC | 03:14 UTC | ~2 h |
| Tee & Sorcery (063) | 00:59 UTC | 03:03 UTC | ~2 h |
| Pale Engine (054) | 20:37 UTC | 03:15 UTC next day, polish until 03:51 | ~6.5 h |

The rest of this post is about why the results are playable games rather than impressive-looking demos that fall over. In short: the repo does a lot of the prompting, and the model checks its own work against bots and a real browser instead of trusting itself.

---

## The repo is most of the prompt

A one-line pitch can work because the repo already holds the conventions, so each session doesn't have to come up with them again. Four things matter most.

### 1. A docs folder written for the next agent

[`docs/README.md`](https://github.com/triptych/web-games-andrew/blob/main/docs/README.md) opens with this line:

> This directory is the **canonical reference for AI-assisted development** in this repo. When you build or modify a game and learn something reusable — a confirmed API pattern, a non-obvious gotcha, an architecture that worked — fold it back into the matching doc here so the next agent benefits.

The docs are there for each session to read before it starts, and the sessions add to them before they finish. [`docs/generic/learnings.md`](https://github.com/triptych/web-games-andrew/blob/main/docs/generic/learnings.md) is now 5,300 lines long, and most of its recent sections were written by the session that built the game they describe. The README also says how to write an entry: name the game that proved it, show the code that actually works, and **lead with the symptom** ("everything is pale lavender and the rim light is 1.0 everywhere → the tube is inside out"), so a later agent debugging the same problem finds it by searching for what it sees.

There are also engine notes: [`threejs-api.md`](https://github.com/triptych/web-games-andrew/blob/main/docs/threejs/threejs-api.md) for the three.js r165 patterns used here, a Web Audio cookbook in [`sounds.md`](https://github.com/triptych/web-games-andrew/blob/main/docs/generic/sounds.md), and notes for Kaplay, Phaser 4 and a hand-written software renderer.

### 2. A scaffold command

[`.claude/commands/scaffold-game.md`](https://github.com/triptych/web-games-andrew/blob/main/.claude/commands/scaffold-game.md) is a slash command that sets up a new game folder for Kaplay, Phaser 4, three.js or a home-made 3D renderer. It also holds lessons from earlier games. One example is the warning to **write `index.html` with the Write tool and nothing else**, because a stray character before `<!DOCTYPE html>` once made a game render that character as page text, and the bug was first blamed on the screenshot.

### 3. House rules every game follows

- **No asset files.** Every model, texture, icon, portrait and song is made in code.
- **Phones count as much as desktops.** Touch controls, 44 px buttons, no sideways scroll, portrait and landscape.
- **Never crash.** A blocked `localStorage` means the game plays on without saving, audio pauses in a hidden tab, and there is always a back link to the launcher.
- **A `game-plan.md` and a `dev/` folder** in every game.

### 4. An architecture that earlier games proved out

The most important convention came from [Starcadet](https://triptych.github.io/web-games-andrew/game-040/) (040): **split the game into a pure simulation and a renderer.**

`js/sim/` holds the rules of the game. It never imports three.js, never touches the DOM and never calls `Math.random` (it uses a seeded RNG). `js/view/` reads the simulation's state each frame and draws it. A test enforces the rule by searching the source, so it can't quietly wear away:

```js
for (const file of listFiles(join(jsDir, 'sim'))) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (/from\s+['"]three/.test(code)) fail(`${file} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${file} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${file} is non-deterministic`);
}
```

Seventeen of these twenty games have a `js/sim/` folder like this. The other three (the Nightline driving sim, the Jade Wyrm text RPG and the Pale Engine FPS) are organised differently, but still have headless bots where it matters, such as Pale Engine's bot that walks every level through the real collision code. Everything below depends on this split. Because the rules run in plain Node with no browser, a bot can play the whole game in seconds, and the same seed always gives the same game.

---

## What a session actually does

Every session has followed roughly the same steps, and the commit history shows them.

### Step 1: Write the design document

Before any code, the session writes `game-plan.md`. These are real design documents of 80 to 380 lines, with a pitch, a story, the core mechanics, numbers and an architecture section. When the genre has well-known classics, the plan studies them. Worldroot's plan opens with a table of what the best idle games do and where each idea will live in the code:

| Idea | Borrowed from | In Worldroot |
|---|---|---|
| Click for currency, buildings for income, ~15% cost growth | Cookie Clicker | Twelve spirits, `COST_RATIO = 1.15` |
| Buy ×1 / ×10 / ×100 / max | AdVenture Capitalist | Bulk cost by geometric series |
| Milestones: owning N doubles output | AdVenture Capitalist | ×2 at 50, 100, 150… owned |

Pinning a game to the genre it builds on goes a long way toward making it feel right.

### Step 2: Build the simulation first

The first commit of a big game is usually titled "work in progress" and holds the design doc and the pure simulation. [Keepfire](https://triptych.github.io/web-games-andrew/game-056/)'s first commit was "design doc and pure simulation with bot-balanced campaign". The castle, the monsters and the music came in the second commit, once the rules were known to work.

### Step 3: Write bots that play the game

This step contributes the most to how the games play, and it's the reason the docs contain a section titled ["Tune difficulty with bots, not vibes"](https://github.com/triptych/web-games-andrew/blob/main/docs/generic/learnings.md).

In most games, `dev/simtest.mjs` checks the simulation's purity, its determinism and its save/load round trip, and then **lets bots play the game**. What the bots do depends on the genre:

- Lanterndeep's bot descends all 100 floors with each of the three heroes.
- Rotten to the Core's bot explores, fights with a rotation for each class, loots, equips by score, sells in town and takes the stairs, all the way to the final boss.
- Tee & Sorcery's bot clones the world and plays candidate golf shots with the real ball physics, so it can prove all twenty holes playable and set the pars.
- BRICKVADERS' bot clears every stage of two full loops.
- Worldroot runs active, casual and idle bots for 48 to 72 simulated hours each.
- STARWRIGHT's "macro bot" plays the whole economy through the real game actions: building, refining, trading, research and the story.

Model-written code is full of bugs that look fine when you read it. The bots are how the model finds them without me. A few the docs record:

- **Worldroot could be finished in 17 minutes.** The first bot run beat the whole idle game in 17 minutes, because every purchase paid for itself in seconds. After retuning, a first run takes about 50. The docs now say to measure *payback* (cost ÷ added income), not prices.
- **A ranged hero shot the same wall corner for 150 simulated minutes.** In Rotten to the Core, line of sight sampled the path every 0.3 tiles and projectiles moved every 0.25. Where a shot grazed a corner, one said "clear" and the other hit the wall. The fix was an exact grid traversal shared by vision, aggro and aiming.
- **The golf bot's pathfinder reached 3% of the map.** Distances were stored in a `Float32Array`, so the float64 key popped from the heap was always slightly larger than the stored value, and nearly every node was skipped. The fix was `Float64Array`.
- **The golf bot wouldn't take the winning shot.** The final boss's HP resets when he transforms, so the bot scored the killing blow as a loss. It now counts damage across phases.
- **STARWRIGHT's refinery ate the ore the player needed for building**, a story chapter required a ship tier the player couldn't reach yet, and the warlord's base could spawn outside warp range. The macro bot found each of these within a few minutes of machine time.

Every one of these is the kind of thing a quick playtest misses and a player hits on day three.

### Step 4: Build the renderer and the juice

With the rules settled, the session builds the part you see. This is where "no asset files" turns into actual work:

- [Rotten to the Core](https://triptych.github.io/web-games-andrew/game-062/) builds its fruit heroes on a lathe, with procedural skins and painted faces.
- [Sister Circuit](https://triptych.github.io/web-games-andrew/game-059/) draws its pixel-art fighters from a 2D skeleton rig through a palette-indexed rasteriser, so a boss's rage colours are just a palette swap.
- [BRICKVADERS](https://triptych.github.io/web-games-andrew/game-060/) renders every sprite pixel as an instanced 3D box inside a 240×320 render target, then adds bloom and a CRT pass.
- [Worldroot](https://triptych.github.io/web-games-andrew/game-065/)'s World Tree is one mesh that grows in the vertex shader.
- [Kraken's Gambit](https://triptych.github.io/web-games-andrew/game-064/) models a whole cel-shaded fleet of chess pieces in code, and its AI is an alpha-beta search running in a Web Worker on a move generator checked with perft.
- [Rotorstorm](https://triptych.github.io/web-games-andrew/game-055/) skips libraries altogether and uses hand-written WebGL2.

Music and sound are generated with the Web Audio API, following recipes in `docs/generic/sounds.md`.

### Step 5: Test in a real browser, on desktop and on phones

Each game's `dev/browsertest.mjs` uses Playwright to drive real Chromium with the real three.js. On desktop it clicks through the game with real input. Then it does the same on **touch-only phones** at 390×844 and 844×390, using real touch events. It fails on any console error, page error or failed request. It also checks that buttons are finger-sized and on screen, that nothing covers the spots it taps, and that the page never scrolls sideways.

To make this possible, each game exposes a `?debug=1` hook (`window.__wr`, for example, in Worldroot) that reports the game's state and can jump to any point in it. The container renders WebGL in software at a few frames per second, so the tests wait for game state rather than for a set time.

The browser tests catch things the simulation tests can't:

- **STARWRIGHT's mining-beam shader didn't compile**, but only when the beam first appeared, because shaders compile when first drawn. The test caught it because it goes mining. The docs now say: *make the browser test trigger every effect at least once.*
- **Worldroot's Nourish button had no listener at all.** Only a test that clicks the real button finds that.
- **Double-click didn't work in Rotten to the Core's inventory.** The first click rebuilt the panel, so the second click landed on a new element.

### Step 6: Write it down, ship it

The last commit of a session adds the game to the launcher (its `genre` field decides which path its statue stands on in the [Garden](https://triptych.github.io/web-games-andrew/)), updates the README, CHANGELOG and status file, writes `dev/README.md`, and adds the reusable lessons to `docs/`. A typical final commit message reads like a release note, ending with something like *"simtest 893 passed; browsertest desktop and both phone orientations pass with no console errors."*

---

## What still needs a person

The bots and the headless browser catch a lot, but not everything. A few things came up again and again.

**Real phones in real hands.** The browser tests use touch events, but they aren't a thumb on a phone with a URL bar. These bugs all showed up on real phones:

- Bumble Basket stretched its canvas to `100vh`, which on a phone with a URL bar is taller than the visible area, so every tap picked the fruit *below* the one under your finger.
- In Rotten to the Core, the bug report was simply "items aren't getting picked up". The invisible joystick zone covered the bottom-left third of the screen and swallowed every tap there. The fix made the zone a region rather than an element, and added walk-over pickup.
- In Worldroot, the trees in the distance "look like they are hovering over the landscape instead of connected to it." The ground mesh was rebuilt from a fan into a 90×160 grid so the trees sit on the hills.

Each of these took one sentence from me and one follow-up turn in the same session, and each one also got a new browser test so it can't come back.

**Taste.** BRICKVADERS' first aliens were too close to the classic Space Invaders octopus, crab and squid. They were replaced with original designs: GLOOP, BUZZ and PEEPER. Its enemy shots were near-white like the ball, so they were recoloured to danger reds and magentas.

**Small hands-on fixes.** A few commits came from my own machine: loot that teleported in Quiverspire, button presses that were dropped on high-refresh screens in Sister Circuit, and a hotkey clash in the Garden.

**Coordination.** On the night of October 6, three sessions ran at once: the fruit Diablo, the golf RPG and the sea chess. **All three claimed `game-062`**, since each saw the same next free number on `main`. Whichever merged first kept the number, and the other two renamed their folders (to 063 and 064) and merged `main` back in. The fix is easy, but it's a real cost of running several agents in parallel.

---

## The knowledge compounds

The pattern I find most interesting isn't in any single game. It's that each session leaves the repo a little smarter for the next one.

You can see it in the docs. A STARWRIGHT entry is titled "The payload-shadows-event-name bug, *again*", because game-040 had already written down the same trap. A Worldroot entry ends with "game-034's lesson, again". The sim/view split that every game here uses came from game-040. The rule to tune difficulty with bots came from game-039.

It also works backwards. On October 4, a session audited **games 001–036** against the conventions the later games had settled on. It wrote [`dev/smoketest.mjs`](https://github.com/triptych/web-games-andrew/blob/main/dev/README.md), which loads every game on desktop and on a touch-only phone, and found nine early games that crashed outright when `localStorage` was blocked. It fixed all of them, made every early game go quiet in a background tab, and recorded the work in [`docs/refresh-plan.md`](https://github.com/triptych/web-games-andrew/blob/main/docs/refresh-plan.md).

---

## By the numbers

| # | Game | What it is | Engine | Game JS lines | Test/bot lines |
|---|------|-----------|--------|--------------:|---------------:|
| 046 | Quiverspire | Archero-style arena archer | three.js | 6,862 | 380 |
| 047 | Ashes & Aces | Deck-builder × poker solitaire | three.js | 10,306 | 681 |
| 048 | SPINFRAME | Slot machine as RPG combat | Vanilla JS | 7,809 | 684 |
| 049 | Lanterndeep | 100-floor roguelike | three.js | 8,104 | 454 |
| 050 | Tomebound | Match-3 RPG + idle village | three.js | 7,411 | 766 |
| 051 | Sigilborn | Gacha auto-battler | three.js | 13,046 | 846 |
| 052 | Nightline | Synthwave night drive | three.js | 4,979 | 353 |
| 053 | Legend of the Jade Wyrm | LoGD-style RPG | three.js | 6,264 | 706 |
| 054 | Pale Engine | DOOM-style FPS | three.js | 10,505 | 781 |
| 055 | Rotorstorm | Helicopter bullet-hell | Vanilla JS + WebGL2 | 8,502 | 520 |
| 056 | Keepfire | Castle defence × lanes | three.js | 7,199 | 582 |
| 057 | Hivebreaker | Twin-stick swarm shooter | three.js | 9,309 | 668 |
| 058 | Bumble Basket | Cosy fruit puzzle | three.js | 4,808 | 792 |
| 059 | Sister Circuit | Neon beat-'em-up | three.js | 8,020 | 582 |
| 060 | BRICKVADERS | Breakout × Space Invaders | three.js | 5,480 | 409 |
| 061 | STARWRIGHT | Procedural space sim | three.js | 7,998 | 1,051 |
| 062 | Rotten to the Core | Fruity Diablo | three.js | 9,037 | 792 |
| 063 | Tee & Sorcery | Fantasy golf RPG | three.js | 8,038 | 857 |
| 064 | Kraken's Gambit | Chess where the sea plays too | three.js | 5,364 | 524 |
| 065 | Worldroot | Idle World Tree clicker | three.js | 5,277 | 644 |
| | **Total** | | | **154,318** | **13,072** |

---

## If you want to try this yourself

A few things made the biggest difference:

1. **Keep a docs folder addressed to the agent, and require it to be updated.** Ask for confirmed code, the game that proved it, and the symptom first.
2. **Separate the rules from the rendering, and enforce it with a test.** A pure, seeded simulation is what makes bots, determinism checks and save tests cheap.
3. **Make the model prove the game is playable.** A bot that plays to the ending finds soft-locks, runaway economies and unwinnable bosses, and the model is good at writing bots.
4. **Test in a real browser on phone sizes, and fail on any console error.** Give the game a debug hook so tests can wait on state, not on time.
5. **Write the design doc first.** It keeps a long session on track, and it's a great record afterwards.
6. **Stay the playtester.** Play on your own phone and report what feels wrong in plain words. "The trees look like they're hovering" was enough.

Every game folder has its `game-plan.md` and its `dev/` folder, so you can read the design and run the bots yourself. Or just open [the Garden](https://triptych.github.io/web-games-andrew/) and play. The newest statues are closest to the hub.
