# TEE & SORCERY — a fantasy golf RPG

**Genre:** Golf × light RPG (story quest, levels, gear, spells, boss holes)
**Engine:** three.js r165 (import map, ES modules), no asset files — every model, face, texture, tune and sound is generated in code
**Target:** desktop (mouse + keyboard) and phones (touch, portrait and landscape)
**Status:** v1.0.0

---

## 1. Pitch

Golf, but every hole is a little adventure. A clumsy caddie named **Pip** pulls a talking sand wedge out of a stone and sets off across five storybook realms to win back the shattered **Golden Tee** from **Lord Bogey**, a sorcerer who has never once made par and has decided nobody else will either.

Every shot is real 3D golf (aim, club, a three-press swing meter, wind, bounces, rolls, greens with slope), but the course is full of RPG business: slimes to bonk for XP, coins and mana orbs to roll through, power-up crystals, spells that set your ball on fire or walk it across a lake, and at the end of each realm a **boss hole** where the cup is sealed until you have beaten the boss *with your golf ball*.

Tone: Saturday-morning cartoon. Chibi characters with huge heads and painted anime faces, toon shading with ink outlines, bright saturated worlds, puns everywhere. Nothing is scary, nobody dies; bosses are grumpy, then sorry.

### Design pillars
1. **The golf must feel good on its own.** Crisp swing meter, readable flight (ground shadow under the ball, landing ring), honest physics, satisfying cup drop. If you stripped the RPG out it should still be a nice little golf game.
2. **The RPG makes the golf richer, not slower.** Levels and gear change how the ball flies (power, control, luck, mana); spells are new shots, not menus. A hole is still 2–5 minutes.
3. **Every realm feels different to play,** not just to look at: ice slides, sand plugs, lava burns, geysers launch, clouds bounce, the sky has no ground to land on.
4. **Storybook look:** toon shading, outlines, painterly terrain shaders, bloom on magic, tilt-shift on the diorama map.
5. **Phones are first-class:** one-thumb aim and swing, 44 px targets, both orientations.

---

## 2. Story

### The world
The kingdom of **Fairhaven** settles every dispute — border quarrels, inheritance, who gets the last scone — with a round of golf. At the heart of the Royal Clubhouse sits the **Golden Tee**, the peg from which the very first shot of the world was struck. Its magic keeps the five realms green, the winds fair and the cups where they belong.

### Cast
| Character | Role | Look |
|---|---|---|
| **Pip** (name and look chosen by the player) | Caddie at the Royal Clubhouse; the hero. Never played a real round. | Chibi, feathered beret, argyle tunic, little cape |
| **Wedgewick** | A grumpy wizard trapped in a sand wedge since a bad bet 300 years ago. Pip's club, mentor and running commentary. | A floating wedge with painted eyes, a pointy hat on the grip and a wisp of beard |
| **Queen Birdie** | Ruler of Fairhaven. Cheerful, very competitive. | Crown, cape of blue feathers |
| **Old Man Eagle** | Runs the Pro Shop. Has a story for everything. | Bald, huge white moustache, tartan, eagle-feather cap |
| **Lord Bogey** | The villain. A sorcerer who never once made par; now cursed the land so nobody can. | Purple robes, crooked hat, a golf-club staff, permanent scowl |
| **Grubbins the Gopher King** | Boss of Meadowmere | A round gopher in a crown, buck teeth |
| **Duneborn** | Boss of the Sandsea | A segmented sandworm with a gem eye |
| **Big Frosty** | Boss of Frostpeak | A round white yeti, blue face, horns |
| **Double Bogey** | Boss of Cinder Caldera | A two-headed magma ogre whose heads argue |
| **Triple Bogey** | Lord Bogey's final form | A three-headed dragon: fire, frost and storm heads |
| Fescue, Zephyrine, Yodel, Cinder, Lady Albatross | Local guides, one per realm | NPC chibis from the same builder |

### Plot, in nine beats
1. **Prologue — the Club in the Stone.** Festival day at the Royal Clubhouse. Lord Bogey crashes it, shatters the Golden Tee into five **Tee Shards** and hands each to a champion: "If *I* can't make par, *nobody* can!" Every hole in the land becomes Bogey-cursed. Pip, fleeing, trips over an old wedge stuck in a rock and pulls it free. It complains. Queen Birdie dubs Pip *Royal Caddie-Knight*.
2. **Meadowmere.** Shepherdess Fescue's meadows are riddled with gopher holes. Grubbins the Gopher King was promised "all the golf balls he can eat". Beat him; he apologises and hands over Shard 1. Wedgewick remembers a spell: **Gust Ward**.
3. **Sandsea Dunes.** Caravan-master Zephyrine's oasis is drying up. Duneborn coils beneath the green. Shard 2, and the spell **Fireball**.
4. **Frostpeak.** Yodel the hermit warns of the Yeti. Big Frosty turns out to be lonely — nobody ever plays through. Shard 3, spell **Frost Step**.
5. **Cinder Caldera.** Smith Cinder's forge is out. Double Bogey's two heads can't agree on anything, including whether to fight. Shard 4, spell **Seeker**.
6. **The Sky Citadel.** Lady Albatross flies Pip up to Bogey's floating fortress.
7. **Lord Bogey.** Wedgewick recognises him: *Bogart*, his old apprentice, laughed off the course 300 years ago after a 14 on the first hole. Bogey fights with the fifth shard.
8. **Triple Bogey.** Bogey fuses with the shard and becomes a three-headed dragon. Pip knocks out all three heads.
9. **Epilogue.** The Golden Tee is restored. Bogey, deflated, admits he just wanted someone to play with. Pip invites him for a round. He becomes the Clubhouse's greenskeeper. Wedgewick decides being a club isn't so bad. Festival, fireworks, credits. Free Play and the Starforged clubs unlock.

Dialogue is short (2–8 lines per scene), skippable, typed out with a per-character voice blip.

---

## 3. Core golf

### 3.1 A turn
`aim → swing → flight → rest → (boss acts) → aim …` until the ball drops or the stroke limit is reached.

### 3.2 Aiming
- **Aim** left/right (keys, or drag horizontally anywhere). The aim camera sits behind the ball.
- **Club**: Driver, Iron, Wedge, Putter. Auto-picked from distance and lie (putter on the green), changeable.
- **Preview**: a dotted arc of glowing orbs shows the flight at **full** power with no wind and a perfect strike; a ring marks where it first lands, and tick marks along the arc show 25/50/75% power carries. How much of the arc you see depends on **Control**. Wind is not in the preview — reading the wind flag is the skill.
- **Overhead view** (V / MAP button) shows the whole hole from above.
- **Spells and items** are armed before the swing and apply to the next shot.

### 3.3 The swing meter (three presses)
1. Press: the marker starts at the **sweet spot** and runs up the power bar.
2. Press again: sets **power** (0–100%). If you don't press, it bounces off the top and comes back down.
3. The marker runs back toward the sweet spot. Press when it is inside the **perfect zone**:
   - inside → **PERFECT**: straight, +5% distance, sparkles, double boss damage.
   - early/late → the shot **hooks or slices** in proportion to the miss.
   - not at all → a big shank.

Meter speed is set by the club (putter slowest) and the **Control** stat; the perfect zone's width by **Luck**. *Gentle swing* in settings slows the meter and widens the zone for younger players.

### 3.4 Physics (simulation at 240 Hz)
- **Flight**: gravity, quadratic air drag, wind (scaled by ball type), sidespin curve from a hook/slice.
- **Ground**: a heightfield. On contact the ball either bounces (restitution and tangential friction by surface) or rolls (rolling friction by surface, gravity along the slope). Rolling over a crest can launch it again — the same integrator handles both.
- **Obstacles**: spheres, capsules (tree trunks, windmill blades, logs) and boxes (walls, ruins). Tree canopies are *soft*: they eat speed instead of reflecting.
- **Cup**: radius 0.34. The ball drops if it passes over the cup at under 4.6 u/s (or drops into it from above); faster balls lip out with a deflection.
- **Backspin**: each club keeps only part of its speed on the first landing (driver 42%, iron 30%, wedge 16%), so drives release and wedges check up.
- **Hazards**: water and lava (+1 stroke, replay from the previous lie), out of bounds and the void (same). Quicksand stops the ball dead and leaves a bad lie. A ball a boss knocks into trouble comes back with no penalty.

### 3.5 Surfaces
| Surface | Bounce | Roll | Lie (power) | Where |
|---|---|---|---|---|
| Tee | — | fairway | 100% | every hole |
| Fairway | medium | medium | 100% | everywhere |
| Rough | low | heavy | 80% | edges |
| Green | medium-low | light | putter | every hole |
| Sand | none (plugs) | very heavy | 60% (wedge 85%) | bunkers, the Sandsea |
| Ice | high | almost none | 100% | Frostpeak |
| Snow | none | very heavy | 70% | Frostpeak |
| Quicksand | none | stops dead | 50% | Sandsea |
| Ash | low | heavy | 85% | Cinder Caldera |
| Cloud (bouncy) | very high | medium | 100% | Sky Citadel |
| Water / lava / void | hazard | | | |

### 3.6 Scoring
- Score names: Hole-in-One, Albatross, Eagle, Birdie, Par, Bogey, Double Bogey (Lord Bogey heckles you), …
- **Stars**: ★ finished, ★★ par or better, ★★★ under par.
- **Stroke limit**: par + 4 (boss holes par + 6). Over it, the curse wins: retry or go back to the map. No other fail state.

---

## 4. The RPG layer

### 4.1 Stats
| Stat | Effect per point |
|---|---|
| **POW** Power | +1% ball speed (≈ +2% carry) |
| **CTL** Control | meter 3% slower (to 55%), +4% of the preview arc shown, −4% hook/slice |
| **LCK** Luck | perfect zone +6% wider, +3% gold, chance for a lucky bounce off a tree |
| **MAG** Magic | +2 max MP (base 6) |

Start: 1 / 1 / 1 / 1. Each level gives **2 points** to allocate (or press *Auto*).

### 4.2 Experience
- Finishing a hole: 30 XP, +15 per stroke under par, ×2 the first time.
- Monsters: 6–14 XP each (bonk them with the ball).
- Bosses: 120 XP.
- XP to next level: `40 + 30·(L−1)`. Level cap 25.

### 4.3 Gold
Coins on the course (1 each, gems 10), a finishing bonus (`20 + 15 per stroke under par`), a first-clear bonus, and monster drops. Spent at Old Man Eagle's **Pro Shop** in the Clubhouse.

### 4.4 Gear (one club set, one ball, one charm)
**Club sets** (stock grows as realms are cleared)
| Set | Cost | Bonus |
|---|---|---|
| Willow Woods | start | — |
| Oakheart | 150 | POW +2, CTL +1 |
| Silversteel | 420 | POW +3, CTL +3 |
| Frostforged | 800 | POW +5, CTL +3, LCK +1 |
| Dragonbone | 1400 | POW +7, CTL +4 |
| Starforged | 2600 (after the ending) | POW +9, CTL +6, LCK +3 |

**Balls**
| Ball | Cost | Effect |
|---|---|---|
| Pebble | start | — |
| Feather | 120 | wind −45% |
| Slime | 200 | bounce +30%, roll +15% |
| Iron Heart | 350 | +1 boss damage, wind −20%, roll −15% |
| Clover | 500 | LCK +3, gold +25% |
| Comet | 1200 | POW +2, wind −50%, comet trail |

**Charms**: Rabbit's Foot (LCK +2), Owl Feather (CTL +2), Ogre Belt (POW +2), Moonstone (MAG +2), Mulligan Coin (Mulligan costs 2 MP), Golden Tee Pin (all +1).

### 4.5 Spells (MP; full MP at the start of each hole, orbs refill)
| Spell | MP | Learnt | Effect on the next shot |
|---|---|---|---|
| **Mulligan** | 4 | prologue | Rewind the last shot: ball back, stroke refunded |
| **Gust Ward** | 2 | Meadowmere | No wind and no hook/slice |
| **Fireball** | 3 | Sandsea | Burns through trees, brambles and ice walls; ×2 boss damage; ignites monsters |
| **Frost Step** | 3 | Frostpeak | Freezes water and lava under the ball: it skips and rolls across |
| **Seeker** | 4 | Cinder Caldera | The ball curves toward the cup in the last stretch |

### 4.6 Power-ups (consumable items; dropped by crystals on the course, sold in the shop)
| Item | Effect on the next shot |
|---|---|
| **Rocket Tee** | +35% power |
| **Sticky Ball** | stops dead where it first lands |
| **Spring Ball** | super bounce |
| **Ghost Ball** | passes through every obstacle |
| **Mana Potion** | +4 MP now |

Course pickups (roll or fly through them): coins, gems, mana orbs, and **crystals** that give one of the four ball items.

---

## 5. Worlds and holes

Five realms, four holes each (three regular holes and a boss hole): **20 holes**. Each realm has its own palette, sky, props, monster, music, hazard and physical twist.

| # | Realm | Twist | Monster | Palette |
|---|---|---|---|---|
| 1 | **Meadowmere** | mushroom springs, a windmill, ponds | Puffslime | spring greens, sky blue |
| 2 | **Sandsea Dunes** | sand everywhere, quicksand, oasis islands, strong wind | Scarab | gold, terracotta, teal |
| 3 | **Frostpeak** | ice fairways, snowdrifts, frozen lake with holes, steep drops | Penguin | white, ice blue, pine |
| 4 | **Cinder Caldera** | lava rivers, geysers that launch the ball, ash | Ember imp | obsidian, magma, red sky |
| 5 | **Sky Citadel** | floating islands over the void, bouncy clouds, low gravity | Bogey wisp | dusk violet, marble, starlight |

### Holes
| Hole | Name | Par | Notes |
|---|---|---|---|
| 1-1 | Sheepish Start | 3 | Tutorial. Straight, one bunker, a slime |
| 1-2 | Windmill Way | 4 | Turning windmill in the fairway; pond left |
| 1-3 | Mushroom Hollow | 4 | Dogleg right around a wood; spring mushrooms |
| 1-4 | **Burrow Royale** | 7 | Boss: Grubbins pops up between molehills |
| 2-1 | Oasis Approach | 4 | Island green in the oasis |
| 2-2 | Pyramid Pass | 4 | A stone pyramid at the bend; long, windy |
| 2-3 | Quicksand Gulch | 3 | A ring of quicksand guards the green |
| 2-4 | **The Sunken Coil** | 8 | Boss: Duneborn circles the green |
| 3-1 | Icicle Run | 3 | Downhill ice: hit soft |
| 3-2 | Frozen Lake | 3 | Across a frozen lake with open water holes |
| 3-3 | Avalanche Ridge | 4 | Switchback round a ravine |
| 3-4 | **Yeti's Throne** | 6 | Boss: Big Frosty behind ice walls |
| 4-1 | Lava Lane | 4 | Carry the lava river |
| 4-2 | Geyser Garden | 4 | Geysers fling the ball skywards; a long last leg |
| 4-3 | Obsidian Spiral | 4 | Round the caldera rim, or across the lava lake |
| 4-4 | **Double Trouble** | 7 | Boss: Double Bogey's two heads on a ledge |
| 5-1 | Cloudhopper | 4 | Island to island |
| 5-2 | Rune Bridges | 5 | Narrow bridges, cloud bumpers, a teleport rune |
| 5-3 | Starfall Stair | 5 | Rising islands |
| 5-4 | **The Final Tee** | 9 | Boss: Lord Bogey, then Triple Bogey |

Pars were set from the bots (see §10 and `dev/README.md`): a search bot with perfect strikes makes par or better on every hole, and a noisy, risk-aware bot with human-like timing errors finishes every hole inside the stroke limit and averages close to par over the twenty.

### 5.1 Bosses
A boss hole's cup is under a **Bogey Seal** (a shimmering dome) until the boss is beaten. The boss is beaten by hitting its weak spot with the ball. Damage per hit: 1, +1 for a PERFECT strike, ×2 with Fireball, +1 with the Iron Heart ball. Bosses move in real time and **act after every stroke**.

| Boss | HP | Pattern | Turn action |
|---|---|---|---|
| **Grubbins** | 4 | Pops up from one of six molehills round the green | Burrows to another hill; kicks your ball away if it rests near him |
| **Duneborn** | 4 | Coils round the green in a ring of sand; only the head takes damage, the coils bounce the ball | Slithers to a new spot on the ring (it holds still while you aim) |
| **Big Frosty** | 4 | Sits on an icy throne behind three ice walls (two hits each, or one Fireball) | Hurls a snowball that leaves a snowdrift where your ball lies, or rebuilds a wall |
| **Double Bogey** | 2 + 2 | Two heads above a stone ledge behind a lava moat — loft it | Stomps: a shockwave shoves a nearby ball away (no penalty if it lands in trouble) |
| **Lord Bogey** | 3 | Floats round the green behind two orbiting shield orbs | Teleports to another spot |
| **Triple Bogey** | 2 + 2 + 2 | Three heads: fire, frost, storm | Each living head breathes: a fire patch, an ice patch, or a new wind |

---

## 6. Modes and flow

```
Title ─ New Quest → Hero creator → Prologue → World Map
      └ Continue → World Map
World Map (diorama): walk between nodes
   ├ Clubhouse → Pro Shop · Equipment · Stats · Spellbook
   └ Hole node → [story scene] → Hole intro (fly-over) → play → result → [story] → map
Pause: Resume · Mulligan rules · Retry hole · Settings · Quit to map
```

- **World map**: a floating island diorama. The five realms sit round a central mountain, with the Sky Citadel above. Pip walks a path between little flag nodes. Each node shows its stars. Tilt-shift blur sells the miniature.
- **Free Play**: any cleared hole can be replayed from the map for better stars, gold and XP.
- **Save**: one slot, auto-saved after every hole and every shop visit. Storage access is guarded; with storage blocked the game plays without saving.

---

## 7. Look

### 7.1 Characters
Chibi proportions (head ≈ 45% of height), built from merged primitives with vertex colours, a stepped toon material with a rim light and an inverted-hull ink outline. Faces are painted onto a canvas texture (eyes with highlights, brows, mouth, blush) with expressions: normal, happy, surprised, angry, sad, blink. Rigs are pivots (body, head, arms, legs) animated procedurally: idle bob, walk, address, backswing, follow-through, cheer, slump, talk.

### 7.2 Terrain shader
One patched `MeshToonMaterial` per hole. A **surface mask texture** (generated from the same signed-distance functions the simulation uses) blends:
- **rough**: two-tone noise, darker towards the out-of-bounds
- **fairway**: mown stripes across the line of play
- **green**: fine checkerboard mowing, a lighter collar
- **sand**: wind ripples and speckle
- **ice / snow / ash / quicksand / cloud**: realm specials (cracks, sparkle, swirl, puff)
- **ink contours** where surfaces meet, so edges read like a storybook illustration

### 7.3 Water, lava, void
- **Water**: masked by the same texture, with a foam band at the shore, moving toon ripples and a sky tint.
- **Lava**: emissive, with a moving cracked crust; blooms.
- **Void**: the sky shows through; clouds drift below the islands.

### 7.4 Sky and atmosphere
Gradient sky dome with a sun glow and painted clouds, a distant mountain ring, fog matched to the horizon. Realm palettes: Meadowmere noon, Sandsea hazy gold, Frostpeak with aurora, Caldera red-black with drifting embers, Sky Citadel dusk with stars.

### 7.5 Readability aids
A blob shadow under the ball at all times (height reads at a glance), a glowing trail ribbon (colour by spell), a pulsing landing ring, a waving flag, wind flag and compass.

### 7.6 Effects
Pooled particles: dust, sand spray, splash rings, steam, sparkles, stars, confetti, embers, snow. Coins pop out of defeated monsters. Hole-out confetti; fireworks under par; a pillar of light on level-up.

### 7.7 Post
RenderPass → UnrealBloom (half-resolution, high threshold — only magic, lava and highlights glow) → **Storybook pass** (warm grade, vignette, faint paper grain, tilt-shift on the map) → OutputPass. Three quality tiers (pixel ratio, shadows, bloom, grass density); phones start a tier down and drop after sustained slow frames.

### 7.8 UI
DOM over the canvas. Parchment panels with gold trim, a rounded friendly font for text and a carved serif for titles (Google Fonts, falling back to system fonts). Dialogue box with a 3D-rendered portrait of the speaker. HUD: hole / par / strokes top-left, wind compass and MP top-right, club and swing meter bottom, spell and item buttons bottom-left, a mini-map of the hole.

---

## 8. Audio (all procedural Web Audio)
- **Music**: a look-ahead sequencer playing a short composed theme per realm (melody, chords, bass, percussion) with realm instruments — Meadowmere flute and pizzicato in major, Sandsea oud-like plucks and a hand drum in Phrygian dominant, Frostpeak celesta and bells in Lydian, Caldera low brass and taiko in minor, Sky Citadel harp and choir pad. Boss variants at a faster tempo in minor; a map march; a cozy Clubhouse waltz; a title fanfare.
- **SFX**: swing whoosh, club contact per club, PERFECT chime, bounces per surface, cup rattle and drop with a jingle, splash, lava hiss, sand thump, ice clink, leaves, coin, gem, mana, crystal, monster poof, boss hit and roar, seal shatter, one cast sound per spell, level-up fanfare, star chimes, UI clicks, typewriter blips with a pitch per speaker.
- Silent in a background tab.

---

## 9. Controls
| Action | Keyboard / mouse | Touch |
|---|---|---|
| Aim | ← → / A D (Shift = fine), or drag | drag anywhere |
| Club | ↑ ↓ / W S, or click the club | tap the club |
| Swing (3 presses) | Space / click SWING | SWING button |
| Spells | 1–5 | spell buttons |
| Items | Q opens the pouch | pouch button |
| Overhead view | V / Tab | MAP |
| Look around | right-drag / middle-drag | — |
| Pause | Esc / P | ❚❚ |
| Mute | M | settings |
| Skip dialogue / flyover | Enter / Space / click | tap |

---

## 10. Architecture

Same split as games 040–061: a **pure simulation** that a Node harness can play, and a renderer that reads it.

```
game-063/
  index.html  style.css  game-plan.md
  js/
    main.js        boot, mode machine, fixed-step loop, event drain
    config.js      tunables
    rng.js         seeded RNG (sim must not call Math.random)
    save.js        guarded localStorage
    audio.js       music sequencer + SFX
    input.js       keyboard, mouse, touch
    sim/           ← pure: no three, no DOM, no Math.random
      holes.js     the 20 hole definitions
      course.js    hole → heightfield, surface field, colliders, triggers
      physics.js   ball integrator, contacts, colliders, cup
      clubs.js     clubs, lies, swing → launch velocity, preview
      world.js     a hole in play: turns, strokes, entities, events
      monsters.js  course monsters
      bosses.js    the six bosses
      rpg.js       stats, XP, items, gear, shop, profile
      story.js     every dialogue scene
      bot.js       shot search for tests and tuning
    view/
      renderer.js  renderer, composer, storybook pass, quality tiers
      toon.js      toon/outline materials, geometry painting, merging
      face.js      painted faces
      chars.js     chibi builder (hero, NPCs), monsters, bosses
      terrain.js   terrain mesh + mask texture + shaders, water/lava, grass
      sky.js       sky dome, clouds, mountains, per-realm palette
      props.js     trees, rocks, windmill, pyramid, ruins, flag, seal …
      fx.js        particles, trail, rings, coins
      camera.js    fly-over, aim, flight follow, overhead
      holeview.js  syncs a World to the scene
      mapview.js   the world-map diorama
      stage.js     story-scene staging
      portrait.js  renders portraits for dialogue
    ui/
      hud.js       in-hole HUD, swing meter, minimap
      menus.js     title, creator, pause, settings, result, clubhouse
      dialogue.js  typewriter dialogue with portraits
  dev/
    simtest.mjs     purity, determinism, physics invariants, content rules, bot plays all 20 holes
    browsertest.mjs real Chromium: desktop flow and touch phones
    play.mjs        drive the game with snippets and screenshots
```

### Event catalogue (sim → main → view / audio / UI)
`shot {club, power, acc, perfect}`, `bounce {surf, speed}`, `land {surf}`, `rest`, `holed {strokes}`, `lipout`, `hazard {kind}`, `oob`, `coin {v}`, `gem`, `mana`, `crystal {item}`, `monsterHit {kind}`, `bossHit {part, dmg}`, `bossAct {action}`, `bossDown`, `sealBroken`, `spell {id}`, `item {id}`, `geyser`, `springs`, `teleport`, `strokeLimit`.

### Tests
- `dev/simtest.mjs`: purity grep; determinism (same inputs → same hash); physics invariants over thousands of random shots (ball never NaN, never below terrain, always comes to rest, never tunnels a wall); content rules for every hole (tee and cup on legal surfaces, green slope gentle enough to stop a ball, pickups reachable); **a search bot plays all 20 holes** — strong bot ≤ par, weak bot (noisy timing) inside the stroke limit — and beats every boss; RPG maths (XP curve, shop, equip).
- `dev/browsertest.mjs`: desktop title → new quest → creator → skip prologue → map → hole 1-1 with real key presses through the swing meter → finish → clubhouse shop → buy and equip → pause/settings → reload → continue; touch-only phones at 390×844 and 844×390 with CDP touches, controls ≥ 44 px and not overlapping, no sideways scroll, canvas not clipped. Fails on any console error, page error or failed request.

### Debug hooks (`?debug=1`)
`window.__ts`: `app`, `world`, `profile`, `view`, `go(holeId)`, `win()`, `give(item, n)`, `gold(n)`, `xp(n)`, `shoot({club, aim, power, acc})`, `fast(n)`.

---

## 11. Phases
1. **Design** (this document).
2. **Simulation**: course fields, physics, clubs, world, monsters, bosses, RPG, story, bot; simtest green.
3. **View**: toon kit, terrain/water/sky shaders, props, chibis, bosses, fx, cameras, map, story stage, post.
4. **UI, input, audio, save, main**.
5. **Tests and polish**: browser test, screenshot passes, tuning from bot numbers.
6. **Ship**: launcher entry, docs.

## Changelog
### v1.0.0 (2026-10-06)
- First release: 20 holes in five realms, five bosses (Lord Bogey has two forms), a nine-beat story with typed dialogue and rendered portraits, the hero creator, levels and stats, the Pro Shop (six club sets, six balls, six charms, five items), five spells, course pickups and crystals, a floating-island world map, procedural music per realm and a full set of effects, touch controls for phones in both orientations.
- Tests: `dev/simtest.mjs` (purity, determinism, content rules, physics invariants, RPG maths, story, bosses, and bots that play every hole) and `dev/browsertest.mjs` (desktop and touch phones, no console errors). The repo smoke test passes, with and without storage.
