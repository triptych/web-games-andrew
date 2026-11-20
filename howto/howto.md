# How the games in this collection are made

This guide describes the shared approach visible in the newest thirty games, **game-114 through game-143**, and the practical process for making another game in the collection. It is a map of recurring approaches, not a claim that every game uses the same engine or folder layout. The newest games range from a tiny Canvas relaxation game to large three.js simulations, and the right architecture depends on what the game needs.

For current project conventions, use this guide alongside the living references: [`docs/generic/learnings.md`](../docs/generic/learnings.md), [`docs/generic/sounds.md`](../docs/generic/sounds.md), [`docs/threejs/threejs-api.md`](../docs/threejs/threejs-api.md), framework-specific docs in `docs/`, and the individual game's `game-plan.md`. The plan and code for a particular game are the authority when details differ.

## 1. What the latest thirty have in common

### Each game is an independent web app

Games live in numbered folders (`game-114/` … `game-143/`). Each can be opened directly, linked from the collection, and installed as a web app. A typical folder has an `index.html`, `style.css`, a `manifest.webmanifest`, and a `game-plan.md`. The plan is a design and engineering record: it describes the game loop, state, controls, content, modules, tests, balance findings, and changes. Larger games add `js/` modules, `dev/` harnesses, and sometimes `art/` or `audio/` asset-generation notes.

The app shell usually links back to the game collection, declares mobile viewport and theme metadata, loads shared accessibility/audio/PWA helpers where appropriate, and starts the game's entry module. CSS and UI are designed for both desktop and phones; a canvas game may use DOM panels around its canvas, while a DOM-first game can render the whole experience as HTML.

### The game is designed as a complete loop, not just a screen

Plans begin with a player-facing premise and turn it into repeatable decisions: gather and build, explore and return, aim and rescue, solve and learn, or prepare and defend. Progression is made legible through unlocks, chapters, jobs, levels, a journal, collections, or an ending. Tutorials, hints, maps, logs, and feedback are part of the design when they help a player understand the rules. The best plans specify what success and failure mean, what changes persist, and how a run or session ends.

### Data and rules are kept understandable

The recent games represent levels, dialogue, quests, items, enemies, building recipes, card effects, or puzzle rules as tables and plain objects where that helps. This makes content easier to review and extend, and lets tests check cross-references such as whether every named item has art or every quest reward exists. The game's state is usually plain data that can be saved, inspected, and restored. Random content uses a seed where repeatability matters.

Many recent larger games adopt a **simulation/view split**. The simulation owns the rules and mutable game state; it accepts input and elapsed time, then emits events. Rendering, interface, and sound respond to that state and those events. This separation lets automated players use the real rules without a browser, keeps visual effects from deciding outcomes, and makes replays and saves much more reliable. This is a strong default for a substantial rules-driven game, but not a requirement for every small or presentation-led game.

### The presentation fits the game instead of forcing one engine

The thirty games demonstrate several useful approaches:

- **Three.js** for 3D worlds, vehicles, dioramas, first-person scenes, lighting, and models. Some games draw their own pixel art or textures in code and place them in a 3D scene; others combine procedural stand-ins with imported models or illustrations.
- **Canvas 2D** for pixel-art tables, maps, scenes, and custom 2D rendering, often with DOM menus for crisp text and accessible controls.
- **DOM-first HTML/CSS/JS** for visual novels, management panels, and text-heavy games where semantic interface elements are a better fit than drawing everything into a canvas.
- **Layered rendering** when the visual idea calls for it: a canvas or 3D stage can sit under DOM controls, or a stage can be composited through a shader for a particular palette or transition.

The important choice is not “which engine is fashionable?” but “which rendering approach makes this game's interactions clear and keeps its complexity manageable?” three.js is used extensively, but vanilla Canvas and DOM are equally legitimate. Keep runtime dependencies small; the repository's local copies and import-map patterns are documented under `docs/`.

### Art and sound may be generated, authored, or drawn in code

Procedural art is a recurring strength: geometry, pixel sprites, textures, icons, effects, and fallback sounds can be drawn or synthesized in JavaScript. This makes assets easy to recolour, keeps a game playable without external files, and supports a coherent visual style. Newer projects also use generated illustrations, portraits, audio, or 3D models when those materially improve the result. Their `dev/art/README.md` and `dev/audio/README.md` record prompts, source-to-output steps, filenames, and fallback behavior.

Use a **working fallback** for optional media. A missing image, sound, or model should not strand the player or stop a test. Validate asset references and loading failures. Prefer procedural stand-ins for essential geometry and synthesised UI sounds; use meaningful placeholders for major art. Keep licenses and provenance clear, and don't let generated assets replace game readability or tested interaction.

### Input, accessibility, persistence, and installability are product features

Keyboard, pointer, touch, and sometimes gamepad are treated as ways to play the same game, not separate rule systems. Controls should be discoverable, hit areas usable on phones, and pointer coordinates mapped through the rendered canvas bounds. For touch, handle pointer events directly and account for browser viewport/safe-area behavior. Keep text readable and controls labeled; use the shared accessibility helper where appropriate.

Saves should be versioned and guarded: browsers or private modes can deny storage, and the game should still start and play. Save plain serializable state, validate it on load, and test a round trip mid-game. Pause or quiet audio when the page is hidden; resume audio after browser interruptions. The collection also provides PWA helpers and generation scripts for manifests/icons. Follow the current project instructions for adding those pieces rather than copying an old manifest by hand.

## 2. A useful architecture for a substantial game

Use the following split as a starting point, then adapt it to the actual game:

```text
game-NNN/
  index.html              app shell, HUD/panels, canvas, entry module
  style.css               responsive layout and visual system
  game-plan.md            design, state, modules, controls, tests, decisions
  js/
    main.js               boot, modes, timing, connects input/sim/view/UI/audio
    config.js             version, save key, fixed step, tuning constants
    rng.js                seeded random generator (or shared core helper)
    sim/                  pure rules, data, state transitions, bot/solver
    view/                 canvas/three.js rendering and visual effects
    ui.js                 DOM panels, prompts, HUD and accessible feedback
    input.js              keyboard/pointer/touch/gamepad to game commands
    audio.js              sound and music reacting to game events
    save.js               guarded, versioned persistence
  dev/
    README.md             how to run the available checks
    simtest.mjs            rules, determinism, content, save and bot checks
    browsertest.mjs        real page flow on desktop and touch devices
```

Small games can have fewer modules. A DOM story may use a scene runner and DOM view; a focused Canvas game can keep its renderer and rules close together if separation adds no clarity. Split by responsibility when code grows. Avoid making every feature its own abstraction prematurely.

For the simulation/view pattern, treat the simulation API as a small contract, for example `newGame(seed)`, `step(state, input, dt)`, `act(state, command)`, `serialize(state)` and `deserialize(data)`. Keep it free of DOM, rendering libraries, storage, wall-clock reads, and ambient randomness. Input enters explicitly; time enters as `dt`; randomness comes from the game's seeded generator. The view reads state and renders it. Simulation events describe meaningful changes (`itemPickedUp`, `doorOpened`, `battleEnded`); the view, UI, and audio can each respond without inventing separate rule changes.

Use a fixed simulation step with an accumulator for real-time rules. Cap unusually long frames and bound catch-up work so a suspended tab does not create a huge simulation jump. Make one-shot actions edge-triggered and queue them if no simulation step ran yet. Keep menu navigation inputs in order when multiple presses can arrive between frames. These details prevent taps from disappearing at low frame rates and prevent a held button from firing more than intended.

## 3. Creation process

### Step 1: Choose a next number and establish the brief

Check the highest existing `game-NNN` folder and the repository's current branch situation before choosing the next number; parallel work can make numbering stale. Write a short concept: player role, moment-to-moment action, longer-term goal, tone, and what makes this game distinct from the collection. Pick the rendering approach based on the interaction and visual target. Check the scaffold instructions and current engine documentation before coding.

### Step 2: Design the smallest complete playable loop

Write down the primary action, its feedback, the main obstacle or decision, the reward, and how the player starts again or finishes. Decide the controls and mobile interaction early. Define progression and failure/recovery before content expands. For a puzzle, specify the rules and prove generated puzzles can be solved. For an economy or combat game, identify the resources, sinks, damage, and expected pace. For exploration, define navigation, landmarks, return paths, and the consequence of exploration.

Put this in `game-plan.md` before the implementation grows. Record key state fields, commands, events, content tables, module responsibilities, and how the game will be tested. Keep numerical tuning in code/config as the source of truth and update the plan when it changes.

### Step 3: Build rules before polish

Implement the simplest playable version of the central mechanic. If using sim/view, build the pure rules first and drive them with a tiny bot or scripted sequence. Make content data-driven where it helps. Ensure state can be serialized and restored. Add a basic view and obvious feedback, then confirm the player can complete one full loop with keyboard and touch. Avoid building a large asset set before the loop is fun and understandable.

Add a bot, solver, or scripted player when it can do real work: exercise all actions, prove a route or puzzle is possible, expose balance issues, or serve as an attract demo. It must use the same commands/rules as a human. A test-only oracle that bypasses the real movement or combat rules can hide the bugs the bot is meant to find.

### Step 4: Establish the visual and audio language

Choose a small palette, type system, shape language, camera/framing rules, and sound palette. Build a representative screen/scene first and check it at desktop and phone sizes. Use code-made art when it is faster, more consistent, or essential for fallback. Generate/import assets only for a clear purpose; retain notes and source material in the game's development folders. Keep the UI crisp and readable even when the game stage has pixelation, bloom, film grain, or other effects.

For audio, map sounds to events and use a small number of musical layers that support the game's pace. Unlocking audio should be tied to a user gesture where browsers require it. Provide a mute/volume route, respect hidden tabs, and keep synthesized fallback sound for missing files where possible.

### Step 5: Add the real app shell and finish the game

Add responsive layout, accessible labels, help/control hints, pause/settings, guarded versioned saves, and the back-to-games link. Add PWA metadata/assets using the repo scripts and current docs. Keep static paths relative to the game folder so both direct hosting and the collection work. Confirm the game remains playable when storage is blocked and optional media fails.

Complete enough content to deliver the intended arc: levels, chapters, missions, cards, jobs, scenes, unlocks, or an endless mode. Add onboarding and recovery from failure. Capture important decisions and known limitations in `game-plan.md` rather than leaving them implicit.

## 4. Verification and balancing

The repo-wide browser smoke test is a baseline for loading, console errors, failed requests, navigation, and layout. It is not a substitute for playing or testing rules. Many recent games add a game-specific `dev/` harness; read its README and use the checks the project already provides. The precise scripts differ by game, so don't assume all folders have identical tests.

For a sim-driven game, useful checks include:

- **Rule tests:** each command, mechanic, boundary, unlock, and end condition.
- **Determinism:** same seed and commands produce the same result.
- **Save round trips:** save and restore at representative states, including during a battle or active puzzle.
- **Data validation:** references resolve, values are in range, generated content obeys its constraints.
- **Reachability/solvability:** use the actual movement or rule implementation, not a weaker approximation.
- **Bot and balance runs:** test easy, typical, and skilled behavior; inspect why it wins, loses, or stalls.
- **Browser flows:** boot and finish representative actions on desktop and touch-only phone sizes; check layout, real input, audio start, and blocked storage.

Use test outputs to improve the design. Common findings in recent plans include soft locks in resource economies, impossible routes, ambiguous controls, unbalanced abilities, generators producing unfair layouts, portrait framing errors, effects obscuring the board, and the view mutating state. Tune one cause at a time and record the outcome. A bot completing a game is evidence that the rules can be exercised; it is not proof that a human will enjoy the pacing, so play it yourself as well.

## 5. Collection integration and release

When the game is ready to appear in the collection, update its metadata in `js/gamedata.js` with the correct folder, title, description, genre, tags, and version details used by the launchers. Check that the title, description, icon, and genre look right in the Garden, classic launcher, and Pocket Garden as applicable. Generate or update icons, manifest, and share metadata through the project's documented scripts. Update `README.md`, `CHANGELOG.md`, and `status.md` where the current project workflow expects them. Ensure the game has a return link and static assets resolve at its deployed URL. Review Git changes for accidental generated/test artifacts before release.

The collection is static HTML/CSS/JS. Most games do not need a build step or runtime package installation. Keep the game independently playable and avoid adding a dependency unless the benefit is clear. Follow repository documentation for deployment and do not check in secrets, generated scratch data, or machine-specific paths.

## 6. Where to look for examples

These links point to representative patterns in the latest thirty; use each game's plan and source together:

- **Three.js with a full sim/view split and bot-driven jobs:** [Hard Hat Harbor](../game-135/).
- **Pure Canvas 2D and DOM panels:** [Solitaire from Outer Space](../game-116/) and [Rainglass](../game-122/).
- **Data-driven narrative and pure scene runner:** [The First Dragon Prince](../game-127/).
- **Procedural world, seeded research, and idle progress:** [SEEDFALL](../game-125/).
- **Blended 3D/Canvas/DOM architecture:** [Gemheart Saga](../game-128/) and [HOLLOWDEEP](../game-129/).
- **Generated art/audio with code fallback:** [Hearthwick](../game-115/) and [GIANT'S VAULT](../game-132/).
- **Puzzle generation with solver-backed guarantees:** [The Last Apprentice](../game-140/).
- **State, bot, and balance documentation in depth:** [Doom & Doilies](../game-143/game-plan.md).

The collection's practices keep evolving. When a game proves a reusable technique or exposes a recurring bug, add the lesson to the relevant `docs/` reference and update the scaffold guidance if it changes how future games should start. This `howto.md` is an overview; the engine docs and game-specific plans remain the detailed source of truth.
