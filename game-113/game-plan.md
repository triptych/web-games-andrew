# Crystal Crescendo

**Genre:** HD-2D story RPG with rhythm battles
**Engine:** three.js r165 (import map, CDN). Art: generated PNGs in `assets/` (made with fal, see *Generated art*), with every sprite and tile still painted in code as the fallback; no sound files, every note is synthesised
**Layout:** sim/view (pure seeded simulation in `js/sim/`, a view that only reads it, `dev/` harnesses)
**Status:** v1.0.0 (see *Build status* at the end for what is verified and what is open)

---

## Concept

A helpless princess, freed from a crystal by a knight who doesn't make it, falls into an underground river and wakes
on the beach of a drowned city. There she befriends O.T.T.O., a mechanical transport AI who has waited 1,142 years
for a passenger. Together they travel the realm recruiting three more princesses whose princes the dragon has taken.

Every battle is a **music duel**. Each princess plays one layer of the song: Lyra the **beat**, Seraphine the
**melody**, Marigold the **lyrics** and Ingrid the **harmony**. The band grows from one drum to a four-part
arrangement over the course of the story, and the music gets fuller with it, in battle and in the field.

The look is HD-2D, in the spirit of party RPGs like Octopath Traveler: pixel-art characters as upright billboards in
a lit 3D diorama, with tilt-shift blur, bloom, warm point lights and a vignette. The rhythm side is a 4-lane
falling-note game with call-and-response turns.

## Story

### Characters
| Id | Who | Role |
|---|---|---|
| `lyra` | Lyra, Princess of Vellmoor. Thinks she is helpless. | **Beat**, lane 1 (the Heartdrum). Plain damage, the strongest taps. |
| `sera` | Seraphine, Princess of the Coral Spires (Marisonde). Elegant, melancholy, secretly mischievous. Prince: Aldric. | **Melody**, lane 2 (the Shell Harp). Damage + heals the most-hurt princess. |
| `mari` | Marigold, Princess of Sunreach. A loud farmer with a crown. Prince: Fenwick, a terrible poet. | **Lyrics**, lane 3 (her voice). Damage + a ward that soaks enemy hits. Her notes show sung syllables. |
| `ingrid` | Ingrid, Princess of Frosthold. Proud, wants to fight alone. Prince: Hakon. | **Harmony**, lane 4 (the Rime Horn). Long held notes: big damage + resonance (a damage multiplier). |
| `otto` | O.T.T.O., Omni-Terrain Transport Operator of Aurelune. A brass walking carriage with one glass eye. Speaks in capitals. | Drives the band between places (the route map). Secretly the heart of the Colossus. |
| `bram` | Sir Bram of Vellmoor, the knight from the prologue. | Captured; freed in the ending. |
| `vorthrax` | Vorthrax, the Hush Eternal. A dragon who silences song because every song ends. | Final boss. |
| `colossus` | AUREL-ONE, the Singing Colossus of Aurelune, asleep for a thousand years without its heart. | Arrives in the final battle when Otto merges with it. |

The lieutenants are Maelstra the Tidewyrm, Baron Hollowhay (a scarecrow) and Rimefang (a frozen wolf-knight). Each
holds one of the three seals on the Hush Spire. The Obsidian Warden guards the Crystal Hollow and the Spire.

### Chapters
0. **Prologue: the Crystal Hollow.** Lyra and six other princesses are sealed in crystal. Bram fights the Warden,
   Vorthrax arrives and flattens him, and Bram uses his last strength to crack Lyra's crystal. She falls through a
   fissure into the underground river.
1. **The Drowned Beach and Aurelune.** Lyra wakes on glowing sand, meets Otto, receives the Heartdrum and fights a
   Shardcrab (the tutorial, which can't be lost). Otto explains the Four Royal Songs. In the drowned city the
   statue of the Colossus has a chest-hollow "the shape of a small carriage" (foreshadowing). The Great Lift leads
   to the surface and unlocks Otto's route map.
2. **Marisonde, the Coral Spires.** Seraphine is crying on the pier and joins. Boss: Maelstra in the Drowned Grotto.
3. **Sunreach.** The windmills have stopped. Marigold joins. Boss: Baron Hollowhay. The windmills turn again.
4. **Frosthold.** Ingrid refuses help, until Lyra's speech about harmony ("it's just what happens when nobody has to
   play alone"). Boss: Rimefang at the frozen gate. All three seals are broken.
5. **The Hush Spire.** The Obsidian Warden (a rematch "for Bram"), then Vorthrax with the princes and Bram in
   crystal cages. **The final battle is scripted:**
   - At 45% HP the Hush knocks out Ingrid, Marigold and Seraphine one by one, and their layers drop out of the music.
   - Lyra keeps the beat alone ("My heartbeat."), in a solo phrase she can't fail.
   - Otto: "PLEASE KEEP THE BEAT. I HAVE AN ERRAND." / "HOME." He drives off.
   - The Colossus AUREL-ONE bursts up from Aurelune with Otto as its heart ("I WAS NEVER ONLY A CARRIAGE. I WAS ITS
     HEART."), revives the band, and the last verse adds golden Colossus notes on the Crescendo key. The Colossus's
     cannon finishes the dragon.
6. **Ending.** The crystals shatter, and the princes, Bram and the choir princesses are freed. Each couple gets a
   line, and Vorthrax, diminished, asks to hear the song again. Lyra: "Songs end. That's why we sing them again.
   Everyone — from the top!" Credits.

All dialogue is in [js/sim/data/script.js](js/sim/data/script.js): `SCENES` for the field and `BATTLE_TALK` for the
in-battle interludes (the tutorial, `hush`, `otto` and `colossus`).

## Core loop

Walk a small diorama map, talk to people, open chests, touch Song Crystals (which save and heal), duel the roaming
monsters you walk into (symbol encounters, no random battles), reach the story trigger, fight the boss, and have
Otto drive you to the next place on the route map. A HUD line always says what to do next (`objective()` in
`js/sim/story.js`), and the bot follows the same pointer.

## Battle rules (precise; `js/sim/battle.js`)

- A battle is one song: key, mode, tempo (the enemy's `bpm`) and a four-chord loop, composed from a seed
  ([js/sim/song.js](js/sim/song.js)). It is played in **phrases of 2 bars** after a **1-bar count-in**.
- Phrases alternate **PLAY** (the party's notes; hits deal damage) and **GUARD** (the enemy's riff falls in the same
  lanes; hits block). PLAY comes first.
- **Lanes:** 4, one per recruited princess, by lane order. Keys D F J K or ← ↓ ↑ →; touch pads under the lanes;
  gamepad d-pad left/down plus X/B (see Controls).
- **Judgment** windows (seconds; Normal 0.045 / 0.085 / 0.130, Easy and Hard in `config.js`): PERFECT, GREAT, GOOD,
  otherwise a miss when the note passes. A press with no note in range is ignored (no penalty).
- Presses arrive with the **song time they were made at** (`inp.lanes: [{lane, t}]`), clamped to the last 0.25 s,
  so frame timing never costs accuracy.
- **Hold notes** (Ingrid's lane always, the last melody or lyric note sometimes, enemy roars): press in time, hold to
  the end. Releasing within 0.14 s of the end counts as complete; releasing earlier gives partial credit.
- **Party hit damage** = power × role × judgment (1 / 0.75 / 0.45) × combo (1 + min(combo, 60)/60) × resonance ×
  (Crescendo ×2). Role effects: melody heals the most-hurt princess (6% of her max HP at PERFECT); lyrics add a ward
  (capped at about 60% of Marigold's HP) that soaks enemy damage; a completed harmony hold adds resonance (cap 1.6,
  decays 0.12 at each guard).
- **Enemy notes:** PERFECT is a parry (a small counter-hit), GREAT blocks, GOOD lets half through, a miss hits that
  lane's princess for `atk` (×1.5 for a missed roar). At 0 HP a princess is knocked out: her lane goes silent, her
  pending notes vanish, and no new notes are written for her.
- **Auto battle** (a setting and the AUTO button, `main.js`): while on, each sim step's lane presses, held lanes and
  Crescendo come from `botInput` at skill 0.9 instead of the player; talk phrases still wait for the player's confirm.
- **Crescendo** meter: +2.2 / +1.2 / +0.4 per judgment (charms change it). At 100, Space / ★ revives knocked-out
  princesses at 35%, heals everyone 15% and doubles damage until the end of the next PLAY phrase.
- **Win:** the enemy reaches 0 HP. Results show XP (`enemy.xp × (0.7 + 0.5 × accuracy)`), drops, level-ups, a
  rank S–D, and combo. **Lose:** every princess is down. Then *Try again* (full health) or *Return to the Song
  Crystal*. An Encore Bell, if carried, revives the band once automatically. Knocked-out princesses get back up at
  25% HP for the next fight.
- **Note density** scales with difficulty (0/1/2) and thins per lane when 3–4 princesses play, so a full band stays
  playable (about 9 notes per bar at Normal).
- **Final battle** (`B.final`): HP is clamped at 44% until the Colossus wakes. The phrase queue after the Hush is
  `talk:hush, count, solo, talk:otto, count, solo, guard, talk:colossus, count`, then normal alternation with
  `colossus` notes (lane −1, played with the Crescendo key, 6.5% of max HP each). During the Hush, Lyra can't drop
  below 1 HP. Time freezes during talk phrases; each talk is followed by a 1-bar count-in.

## Field rules (`js/sim/field.js`)

- Maps are 24×16 ASCII grids ([js/sim/data/maps.js](js/sim/data/maps.js), `TILES` legend). The player is a circle
  of radius 0.3 at speed 3.6 tiles/s, sliding along solid tiles; NPCs block too.
- **Interact** (A) picks the nearest NPC, sign, chest or Song Crystal within 1.25 tiles. Chests give items or charms
  (`G.opened` is kept for the whole game). Crystals heal fully, save, and set `G.lastCrystal`.
- **Otto** stands at `map.travel` once `metOtto` is set: talking to him opens the route map (`WORLD`). Aurelune's lift
  is a sign: the first use plays `lift` (sets `surface` and the chapter 2 card), later uses open the map directly.
- **Triggers** (`{x, y, w, h, scene, need, not, once, push}`) start a scene on entry. `push` moves the player back
  after a "blocked" scene. Exits need flags (`need` and `blocked` scene).
- **Roaming enemies** wander around home; inside 3.6 tiles they chase. Touching one starts a battle
  (`from: 'field'`); a win removes it until the map is re-entered. After a battle there are 1.5 s of grace.
- Followers (the recruited princesses walking behind Lyra) are view-only, drawn from a breadcrumb trail of the
  player's positions.

## Modes (`G.mode`)

`scene` → `field` ↔ `battle` → `results` | `defeat`; `worldmap` → `travel` → `field`; `ending` (credits, then the
title). Scenes can start battles (`from: 'scene'`), and the scene resumes after the results.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Talk / confirm | Space / Enter / Z | A | A button |
| Band menu | M / Tab | Y | ☰ |
| Pause | P / Esc | Start | ❚❚ |
| Lanes 1–4 (battle) | D F J K or ← ↓ ↑ → | d-left, d-down, X, B (or LB/LT/RT/RB) | tap the lane pads |
| Crescendo / Colossus | Space | A | ★ |
| Auto battle on/off (in a duel) | Tab | Back / Select | AUTO |

## Look and sound

- **View** (`js/view/`): `stage.js` handles the renderer and post-processing (tilt-shift, then bloom with the
  threshold above 1, then a grade/vignette/grain/flash pass, then ACES), modelled on game-093's stage. `pixel.js` is
  a pixel painter with auto-shading and outlines; `people.js` draws princesses, NPCs, Otto and the princes from a
  `look` (directions down/up/side, 3 walk frames, battle poses idle/play/hurt/ko); `monsters.js` draws one body plan
  per `sprite` id plus the huge dragon, warden and Colossus; `tiles.js` makes procedural tile textures per theme;
  `fieldview.js` builds the instanced tile diorama, props, point lights (lanterns, crystals), water and actors;
  `battleview.js` has the battle stage per area theme (party on the left in a diagonal, the enemy on the right),
  lights pulsing on the beat, note sparks flying from princess to enemy, hit/hurt/KO/crescendo effects, the Colossus
  rise and the cannon. Characters are upright billboards with blob shadows.
- **Highway** (`js/ui/highway.js`): Canvas 2D over the scene, 4 lanes bottom-centre (the full width on portrait
  phones), with notes falling to a hit line above the touch pads. Enemy notes are spiky and dark red-violet; party
  notes are in the lane colour. Lyric notes show their syllable, holds have tails, and gold Colossus notes span all
  lanes. Note lead is in beats (speed setting 1–5 → 4, 3.2, 2.6, 2.1, 1.7 beats), never longer than the 1-bar
  count-in.
- **Audio** (`js/audio.js`, Web Audio, no files):
  - Party notes sound **only when hit**, scheduled at the note's exact time on the AudioContext clock (an early hit
    waits for the beat; a late hit plays at once).
  - Instruments: Lyra's drum kit (kick, snare, tom), Seraphine's plucked harp, Marigold's formant "voice" (vowel
    from the syllable), Ingrid's organ/horn chords with a sub.
  - Enemy riffs are pre-scheduled in the enemy's `timbre` (pluck, hush, buzz, bell, growl). A quiet backing (pad +
    shaker) always plays so the tempo is audible.
  - Field music uses `fieldPhrase()` with only the recruited lanes, so the world's music gets fuller as the band
    grows.
- **Sync:** in battle, `main.js` advances the sim from the audio clock (`ctx.currentTime` deltas) when audio runs at
  `fast=1`, so `B.t` and the AudioContext stay locked (`audioT = anchor + songT`). There is a user offset (ms) in
  Settings for calibration. Resuming from pause shows a 3-2-1 countdown before the sim steps again.

## Module overview

| Path | Responsibility | State |
|---|---|---|
| `js/config.js` | VERSION, SAVE_KEY, STEP, windows, roles, tuning | done |
| `js/rng.js` | mulberry32, `hash3`, `strSeed` | done |
| `js/sim/data/chars.js` | princesses (stats, colours, looks), NPCs | done |
| `js/sim/data/enemies.js` | 16 enemies, `AREA_ENEMIES` | done |
| `js/sim/data/items.js` | items, charms | done |
| `js/sim/data/maps.js` | 7 maps (`hollow`, `beach`, `aurelune`, `marisonde`, `sunreach`, `frosthold`, `spire`), `WORLD` route map, `chestsOf`, `crystalOf` | done |
| `js/sim/data/script.js` | `SCENES`, `BATTLE_TALK` | done |
| `js/sim/song.js` | `composeSong`, `phraseNotes` (play/guard/solo/colossus), `fieldPhrase`, lyric bank | done |
| `js/sim/party.js` | levels, HP, power, charms, items, `join` (sets `<id>Joined`) | done |
| `js/sim/battle.js` | the duel (above), `startBattle`, `stepBattle`, `endBattle`, `afterDefeat` | done |
| `js/sim/story.js` | scene runner, route map, `objective()`, `warpToCrystal` | done |
| `js/sim/field.js` | `loadMap`, `stepField`, collision, interaction, triggers, roaming enemies | done |
| `js/sim/game.js` | `newGame(seed, difficulty)` (starts the `prologue` scene on `hollow`), `step` (`inp.cmd` runs a menu command), `act`, serialize | done |
| `js/sim/bot.js` | auto-player: BFS path to `objective()`, saves at each crystal, opens chests, heals, battles at a skill level | done |
| `js/view/stage.js` | renderer, post chain (tilt-shift → bloom → grade → ACES), adapted from game-093 | done |
| `js/view/pixel.js`, `people.js`, `monsters.js`, `portraits.js` | the pixel painter, every person (4 views/poses, Otto, the Archivist), 17 monster body plans, dialogue portraits | done |
| `js/view/tiles.js`, `fieldview.js` | themes and tile textures; the field diorama (instanced blocks, props, lights, water, actors, followers, scene effects) | done |
| `js/view/battleview.js`, `fx.js`, `view.js` | the battle theatre, particles and flying notes, the swirl between stages and the grade | done |
| `js/ui/ui.js`, `js/ui/highway.js` | screens, HUDs, dialogue, band menu, route map, results, credits; the Canvas 2D note highway | done |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/main.js` | instruments, scheduling and field music; keyboard/pad/touch with stamped lane presses; guarded storage; the loop driven by the audio clock in duels | done |
| `dev/simtest.mjs` | purity, maps, song, battle rules, save, the bot plays the whole story | done |
| `dev/browsertest.mjs`, `dev/play.mjs`, `dev/gallery.html`, `dev/shot.mjs`, `dev/preview.mjs` | see [dev/README.md](dev/README.md) | done |

## Testing

- `simtest.mjs`: purity grep, map validity (rows 24 wide, chest counts, every NPC/trigger/exit/crystal reachable
  from the spawn by BFS), song invariants (no overlapping notes in a lane, holds inside the phrase, lyrics on lane 2
  only), battle rules (perfect hit damages, a missed guard hurts, KO silences a lane, crescendo revives, hold release
  rules, the tutorial can't be lost, the final script reaches the Colossus and the win), determinism and a save round
  trip mid-battle, and **the bot plays the whole story** from the prologue to the credits at two skill levels, with a
  balance table (battles fought, deaths, levels per chapter).
- `browsertest.mjs`: desktop (title → prologue lines → field movement with real keys → a battle with real D/F/J/K
  presses → pause and countdown → save & quit → continue), touch phones 390×844 and 844×390 (lane pads, stick,
  A, ≥ 44 px, no sideways scroll), and blocked storage.

## Balance notes

The bot plays the story walking straight to each objective, so it fights only the monsters in its way (about 14
duels, ending around level 9). A human who fights more will be stronger. With the first pass of numbers a perfect
bot finished bosses in about 30 s and even skill 0.55 was rarely hurt, so every enemy's HP went up ×2.3 (×2.8 for
bosses) and attack ×1.7, and Frosthold and the Spire got another ×1.2 attack. The bot's miss rate is
`(1 − skill) × 0.5`.

| Skill | Whole story | Trash duel | Boss duel | Defeats |
|---|---|---|---|---|
| 1.0 | ~11 min | ~20 s, never hurt | 50–75 s | 0 |
| 0.75 | ~16 min | 25–35 s, down to ~70% HP | 95–115 s, down to 37–90% | 0–1 |
| 0.55 | ~19 min | 30–40 s, down to ~20–60% | 120–170 s, often near 0 | lost Maelstra once at level 2 |

## Build status

- Everything in the module table is written and pushed. `simtest.mjs` passes (2,900+ checks; the bot finishes the
  story at two skills). `browsertest.mjs` drives desktop, the final battle, two phone orientations and blocked storage.
- Debug namespace `window.__ccr`, harness port 8113, save key `crystal-crescendo.v1`. three.js is served offline in
  the harnesses from `dev/package` (repo root; `npm pack three@0.165.0`), since unpkg returns 403 in the sandbox.
- Lessons from the browser work (also in docs/generic/learnings.md):
  - Press times are converted with the frame's real song-time ratio, not the `fast` factor: a capped slow frame
    covers less song time than real time, and scaling by `fast` put every real key press half a second early.
  - A waiting line is re-shown by the frame loop if the box was hidden (a debug skip once hid the tutorial's
    first line).
  - SwiftShader takes ~15 s to compile a duel's shaders; tests wait on state.

## Generated art

`assets/` holds the art, and `js/view/assets.js` loads it before the first frame. Each file is optional: a missing
manifest, file or network leaves the key out and the game uses the sprite painted in code (`pixel.js`, `people.js`,
`monsters.js`, `tiles.js`), so nothing breaks and the sim and browser tests don't depend on the art.

| Folder | What | How the game uses it |
|---|---|---|
| `assets/monsters/` | the 16 enemies and the Colossus | `SpriteLib.monster`, the Colossus rising in the final duel and the statue in Aurelune; fitted into the painted sprite's logical box at 4x, so on-screen size is unchanged |
| `assets/portraits/` | 23 dialogue portraits (princesses, Bram, the princes, townsfolk, the six sealed princesses, O.T.T.O., the Archivist) | `portrait()` for the dialogue box, the band cards and the battle HUD; the dragon, wardens and Colossus reuse their monster art |
| `assets/people/` | a 3x3 walk sheet per person: front, back, side by idle, step, step | `SpriteLib.person`; O.T.T.O. dims for the unlit variant |
| `assets/poses/` | idle, play, hurt, ko, cheer for Lyra, Seraphine, Marigold, Bram and four of the sealed princesses | battle and scene poses. A person with no pose sheet gets them made from the walk sprites (a knock-out is the side view turned on its back) |
| `assets/tiles/` | one 3x3 sheet per area (ground, ground2, path, dock, wall, cliff, house, roof, top) | `tileTexture`, mirrored per variant; ground, path and cliff are blended to repeat without a seam |
| `assets/props/` | palm, oak, pine, three glow colours of cave mushroom, coral, flowers, wheat, grass | `propPx` |

How it was made, in `dev/assets/` (Python with Pillow and numpy, no other dependencies): each picture was generated on a
flat magenta background with fal's `fal-ai/nano-banana-2` (and its `/edit` endpoint, with the person's portrait as the
reference, for the walk and pose sheets), then cut out by `cutout.py`, fitted and sliced by `export_monsters.py`,
`export_portraits.py`, `export_people.py` (which finds the figures on a sheet by the gaps between them, because the model
doesn't always draw the grid it was asked for) and `export_tiles_props.py`, and shrunk by `optimize.py` (256 colours,
about 1.7 MB in all). The prompt templates are in [dev/assets/README.md](dev/assets/README.md). The model declined three pose
sheets (Ingrid, and the sealed princesses `choir2` and `choir3`) under its content policy, so those three use the
derived poses above.

## Open questions / next steps

- A human pass with headphones on a real GPU: timing feel, the default audio offset, note speed, and whether Normal
  is too dense with four princesses.
- Mid-scene saves are not made (only in the field and on the route map), so quitting during a long scene replays it.
- The ending could show the band playing a final concert on the battle stage (currently a scene and the credits).

## Changelog

### v1.2.0 (2026-11-09)
- **New art, generated with fal.** Every monster and boss, every portrait, a walk sheet for everyone who walks, battle
  poses for the band, terrain tiles for all seven places and the props are now PNGs in `assets/` (see *Generated art*).
  The sprites painted in code remain as the fallback for any missing file. The simulation is untouched.

### v1.1.0 (2026-11-02)
- **Auto battle.** An AUTO button in the battle HUD (Tab, or Back on a gamepad) and an *Auto battle* setting hand the
  band's lanes, holds and Crescendo to the same bot the tests use, at skill 0.9: it plays well, not perfectly, and it
  can be switched on or off at any moment of a duel. Story lines inside a battle still wait for the player, and the
  results say when a duel was played on auto (all of it or part). The setting is remembered.

### v1.0.0 (2026-11-02)
- First release: the story from the Crystal Hollow to the credits across seven maps; four-lane call-and-response
  duels composed from seeds, a layer per princess; levels, items, charms; Otto's route map; the scripted final battle
  with the Hush and the Colossus; HD-2D dioramas and a battle theatre in three.js; synthesised instruments with the
  band's notes sounding only when hit; touch, keyboard and gamepad; the sim test and the browser harness.
