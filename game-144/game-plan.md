# NEBULA REQUIEM

**Genre:** 3D side-scrolling bullet-hell shoot-'em-up (horizontal, arcade style) with an anime story
**Engine:** three.js r165 (import map), sim/view layout; art by fal, music, effects and voices by ElevenLabs
**Status:** v1.0.1

---

## Concept

The Requiem, a choir-fleet of biomechanical angels, came out of the Veil Nebula six days ago, singing, and every star it
sings to goes dark. At Saturn it met humanity's Aegis fleet and erased it. The carrier *Lumen Ark* has three prototype
Seraph fighters left, and three pilots. You fly one of them, alone, through six stages to the Requiem Heart inside a
dying star.

Minute to minute it is a bullet-heaven shooter in the CAVE tradition: your gun fires on its own, the screen fills with
coloured bullets, only the glowing dot at your cockpit can be hit, and brushing past bullets (grazing) charges your
pilot's super. It riffs on the late-90s/2000s arcade shooters with 3D camera work and huge set-piece enemies: capital
ships bigger than the screen that you fly along, whose turrets and engines you destroy, and six colossal bosses —
a dreadnought, a crystal serpent, an organ-wall engine with an eye, a war robot, an alien Mother of Eyes and an angel
machine. Power-ups stack into named synergies that can break the game in your favour.

## Core loop

Pick a pilot and difficulty → opening cutscene → a stage (≈95 s of scripted waves, sometimes a capital ship, radio
chatter from Commander Mei) → WARNING → the pilot's words with the boss → a multi-phase boss → stage clear tally →
the next stage, with cutscenes after stages 2, 4 (Kaito) and 5 → the pilot's own ending → results. Losing every ship
offers a continue (score resets to zero). Survival mode ("The Endless Choir") is waves forever, a boss every 8 waves,
until the last ship goes.

## Mechanics (every rule here has a line in `dev/simtest.mjs`)

### Ship
- Moves at the pilot's speed; **focus** (held) moves slower, tightens the gun and shows the hitbox.
- The **hitbox** is tiny (0.14–0.18 units); bullets are 0.12–0.34. **Graze**: a bullet that passes within 1.05 units
  without hitting scores and fills Burst, once per bullet.
- **Auto-fire** always. Sora: spread vulcan (3→9 streams with power), focus narrows to a stream. Kaito: lance shots
  that pierce 2–5 enemies, focus fires one beam that pierces everything. Lyra: needles that home on the nearest target
  (they prefer an exposed boss core), focus fires them straight.
- **Bomb** (X): clears every bullet into stars, burns everything on screen for 2.6 s, 3.2 s invulnerable. Refilled to 3
  after a death.
- **Warp** (C): with a charge, blink 7 units in the held direction (forward by default), cutting bullets and damaging
  enemies on the path; never into a wall. Charges come back every 6 s up to the warp level.
- **Burst** (Space) when the gauge is full: Starfall Volley (blades rain over the whole screen), Halberd Lance (a beam
  the height of the sky that eats bullets), Wraith Swarm (homing phantoms that eat bullets). Double score during Burst.
- **Hit**: a shield charge absorbs it (and clears nearby bullets); otherwise a life is lost, the screen is cleared and
  a power level, an option and a rocket pod drop as capsules to pick back up.

### Power-ups (`js/sim/data/powerups.js`)
P power (1–6) · B bomb · S shield charge (max 5) · R rocket pods (max 4) · O option drone (max 4) · W warp level (max 3)
· H halo blades that shred bullets (max 2) · X Overdrive (10 s: double rate, full power) · T Chrono (8 s: bullets at
45 % speed) · M Magnet (20 s) · U 1UP. Carriers and cruisers always drop one; others sometimes.

### Synergies (two things held together)
| Synergy | Needs | Effect |
|---|---|---|
| AEGIS JUMP | shield + warp | warps leave a bullet-eating wake |
| SWARM ARRAY | rockets + 2 options | options launch rockets too |
| SUN WHEEL | halo + shield | bigger halo; cut bullets become your shots |
| NOVA BARRAGE | Overdrive + rockets | rockets ×3 rate |
| PHASE SHIFT | Chrono + warp | free warps, ×3 recharge |
| CATACLYSM | Overdrive + 3 bombs | bombs ×3 damage, 1.5× longer |
| SERAPH WINGS | 4 options + power 6 | options fire piercing lances |
| STARFIELD | Magnet + halo | halo-cut bullets become stars |
| GOLDEN HOUR | Magnet + Overdrive | stars ×3, Burst fills ×2 |

### Scoring
Kills × chain tier (1 + one per 10 kills in a chain, up to ×9; the chain breaks after 1.6 s without a kill); big
enemies cancel nearby bullets into stars; stars 50 × tier (×3 in Golden Hour); graze 20 × tier; boss phase bonuses for
speed; extends at 0.5 M, 1.5 M, 3 M, 6 M, 10 M (and every 5 M in survival).

### Capital ships (`js/sim/capital.js`)
Hull blocks are walls: the ship is pushed out of them; pinned against the left edge by the scroll, it crashes. Shots
and enemy bullets stop at walls. Turrets and engines are mounted enemies; breaking every engine brings the whole ship
down (+50 000, bullets cancelled, three capsules). Stage 3 is a 330-unit mothership corridor generated from a seed; it
is proved in `simtest` never narrower than 5.2 units and always passable past its pillars, over 60 seeds. Each of its
five engines broken takes 7 % off the Choirmaster's HP.

### Bosses (`js/sim/bosses.js`)
Each phase has its own HP bar and a time limit (a timed-out phase gives no bonus). Parts are mounted enemies; breaking
them removes their attacks. Fairness rules: no aimed fire from closer than 3.2 units; beams are telegraphed (a thin
flickering line) before they fire.

| Stage | Boss | Phases | Gimmick |
|---|---|---|---|
| 1 Saturn's Grave | BELLWETHER, dreadnought | 3 | solid hull; the core is shut until both stern engines are broken |
| 2 Veil of Glass | HALCYON WYRM | 3 | a crystal serpent whose body segments shoot; breath beam; segments pop into rings |
| 3 Cathedral Ark | THE CHOIRMASTER | 3 | a wall of pipes; the eye opens 4 s, shuts 2.5 s; sweeping tentacle beams |
| 4 Iron Halo Foundry | TITAN ORDINAL (Voss) | 3 | cannon arm, missile pods, a beam sword lunge |
| 5 Leviathan Deep | XEL'THUUN | 3 | six tentacle eyes, eggs that hatch, flower storms |
| 6 Requiem Heart | SERAPHINE NULL | 4 | named movements: Gloria, Wings of Light, Lacrimosa, Requiem |

## Story

Scenes are data (`js/sim/data/story.js`); `storyPlan(pilot)` says which play when. Each pilot has an introduction,
their own line before every boss and their own ending; Kaito gets a scene after Voss falls, Sora meets her sister Hikari
and Lyra faces Seraphine before the final stage. Every line is voiced. The ending is defined: the Heart breaks and the
star relights; survival mode is endless.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Focus | Shift / Z (hold) | RB / RT / X | FOCUS (hold) |
| Bomb | X | A | BOMB |
| Warp | C | B | WARP |
| Burst | Space | Y | BURST |
| Pause | P / Esc | Start | ❚❚ |
| Next line / skip scene | Enter, Space, Z / Esc | A | tap / Skip |

## Look and sound

The Seraphs, every enemy kind and the bosses are Meshy text-to-3D models (`models/`, fitted in `js/view/meshy.js`;
see `dev/meshy/README.md`); the procedural models in `js/view/models.js` stand in while they load and keep the
bosses' animated weak points. Side view from slightly above and to the left, leaning round for bosses; shake, flashes and a refraction shockwave on
big hits (all toned down by the Calm setting or `prefers-reduced-motion`). Painted fal backdrops far behind (dimmed per
stage so the bullets stay readable), a nebula shader and streaking starfield, and per-stage 3D scenery that drifts at
its depth. Bullets are one instanced draw call shaped in the fragment shader (orb, rice, needle, big, star), coloured
per stage. ACES tone mapping, Unreal bloom with a threshold above most of the scene, a fixed pool of point lights for
explosions. Music, effects and voices from ElevenLabs; guns, grazes and UI are synthesised. See `dev/art/README.md`
and `dev/audio/README.md`.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with attract demo, play, done), the fixed-step loop, scenes, input routing, debug hooks |
| `js/sim/game.js` | `newGame`, `step`, story and survival flow, continues, save/load |
| `js/sim/player.js` | Ship, guns, options, rockets, halo, bombs, warp, Burst, pickups, synergies, graze, walls |
| `js/sim/enemies.js`, `patterns.js`, `core.js` | Enemy movement and fire, the bullet library, scoring, drops, damage, kills |
| `js/sim/capital.js`, `bosses.js`, `stages.js` | Capital ships, the six bosses, stage scripts and the survival director |
| `js/sim/bot.js` | The dodging auto-player (tests, balance, attract mode) |
| `js/sim/data/*.js` | Pilots, stages, bosses, cast, enemies, power-ups, synergies, the story script |
| `js/view/` | `stage.js` renderer/camera/post, `sky.js` backgrounds, `models.js`, `fx.js` bullets/particles, `view.js` |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js` | DOM screens, HUD, cutscenes; input merge; sound; guarded storage |

## Testing

See [dev/README.md](dev/README.md).

## Balance notes

Tuned against the bot (`js/sim/bot.js`: 18 candidate moves, linear bullet look-ahead, bombs when there is no safe
move; skill sets reaction rate, how many bullets it notices and look-ahead). Normal difficulty, story mode:

| Pilot | Skill 1 | Skill 0.6 | Skill 0.3 |
|---|---|---|---|
| Sora | usually clears (0–3 deaths) | falls in stages 1–4 | falls in stage 1 |
| Kaito | clears, 0–2 deaths | about half clear | falls in stages 1–3 |
| Lyra | usually clears | often clears | falls in stage 1 |

`simtest` asserts the bands: a perfect bot wins at least half its runs, a skill-0.3 bot never wins and averages stage
≤ 3, and better bots get further. What the bot found:
- The first pass let bosses die in 7–32 s for all their phases: guns were too strong. Damage was cut by ~40 % and boss
  HP scaled by stage (the player is far stronger by stage 6), giving 40–100 s fights.
- The Bellwether's engines sat in the hull's line of fire, so the core never opened (perfect bot: 4 deaths there).
  They moved above and below the stern.
- Boss parts far behind the boss were culled as "off screen" while it flew in, so the Bellwether started engineless.
  Parts now live and die with their host.
- 36 % of stage-1 deaths were the Bellwether's second phase; it was toned down to first-boss density.
- Point-blank aimed fire and a full-screen sweeping breath beam caused unreadable deaths; both rules changed.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person and SwiftShader is not a GPU.
- A portrait phone shows the 16:9 field as a band across the middle; a rotated vertical mode would use the screen better.
- More boss variety in survival (they repeat with more HP after six).

## Changelog

### v1.2.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

### v1.1.0 (2026-11-21)
- The three Seraphs, all 21 enemy kinds and the six bosses are now Meshy 3D models (30 GLBs, 15 MB after shrinking
  the textures), each turned and sized to face its way; bosses keep their procedural weak points and effects.
  `dev/models.html` shows them all; the browser test checks every one loads.

### v1.0.1 (2026-11-21)
- Fixed square halos round bright objects: a sanitize pass before the bloom zeroes NaN/infinite pixels and caps the rest.

### v1.0.0 (2026-11-21)
- First release: three pilots with voiced stories and endings, six stages, capital ships, six bosses, eleven power-ups
  and nine synergies, survival mode, three difficulties, fal art and ElevenLabs audio, touch, gamepad and keyboard.
