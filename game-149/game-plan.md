# Echoheart Academy

**Genre:** [derive from concept]
**Engine:** three.js r165, no asset files   ← or "Vanilla JS: Canvas 2D, no asset files" if RENDERER = canvas
**Status:** v1.0.0 in progress

---

## Concept

An upbeat anime visual novel RPG: a boy whose only magic is echoing other people's spells enrols at Lumina Academy, makes friends, plays magical mini-games, and uncovers the kindly principal's plot to steal his classmates' magic.

[What the player does minute to minute, what they're working toward, and the tone. Name the games it riffs on.]

## Core loop

[One run, round, level or day from start to finish.]

## Mechanics

### [Mechanic]
[Rules precise enough to write a sim test against.]

## Content

[Tables: enemies, levels, items, upgrades, characters. Numbers go in js/config.js or js/sim/data/; this says what they are for.]

## Story

[Optional. Characters, chapters, the ending. A defined ending, or say plainly that the game is endless.]

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Action | Space / Z | A | A button |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

[Palette, camera, models or sprites (all procedural), post-processing. Music and effects (all Web Audio).]

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, debug hooks |
| `js/sim/` | Pure simulation: no DOM, renderer, `Math.random` or clock. `game.js` rules, `bot.js` auto-player |
| `js/view/` | Reads the sim and answers its events |
| `js/ui.js` | DOM screens, HUD, settings, touch deck |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the rules, determinism and save round trips, and has the bot play [the whole game]. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

[What the bot found and what was changed because of it.]

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.

## Changelog

### v1.0.0 (YYYY-MM-DD)
- First release: [one line per feature].
