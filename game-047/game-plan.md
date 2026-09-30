# Ashes & Aces

**Genre:** Deck-building roguelite (Slay the Spire) × Poker Solitaire, dark high fantasy
**Engine:** three.js r165 (ES modules via import map) + a pure, seeded JS simulation
**Target:** any screen — landscape monitors and portrait phones, mouse, touch or keyboard
**Status:** v1.0 — design below, implementation in `js/`

---

## 1. Pitch

The gods once sat down to a game of cards for the fate of the world. The Dealer dealt ten
Crowns to ten realms and the last hand was never finished: the Hollow King palmed the Ace of
Hearts — the heart of the world — and the world has been burning to ash ever since.

You are a **Cardbound**, one of the last people who can still hear the cards. You carry the
Dealer's final deck. Cross ten realms, win ten Crowns back from their Wardens, and sit down at
the Hollow Throne to finish the Last Hand.

Every fight is a game of **poker solitaire** played on a 5 × 5 table. You place cards from your
hand onto the grid; whenever a row, column or diagonal fills, it is scored as a poker hand and
**fires**: the hand type decides how hard, and the suits decide what it does. Between fights you
walk a branching Slay-the-Spire map, build your deck, collect relics, and read a story that is
partly written by hand and partly written by the run.

**10 worlds × 10 levels = 100 levels**, each world with its own procedurally built landscape,
bestiary, music, story chapter and Crowned Warden.

---

## 2. The Last Hand — storyline

### Frame
Told by **the Ferryman**, a bone-white figure who rows you between realms on a river of ash and
who plainly knows more than he says. Each world opens with a chapter title card and a narrated
prologue, holds a mid-world story encounter, and closes on the Warden's defeat and a line from
the Ferryman. Your hero is always addressed as *you*.

| # | World | Warden | Chapter |
|---|-------|--------|---------|
| 1 | **Emberfall Marches** — burning wheatfields under an ash sky | **The Scarecrow Baron**, Jack of Ash | *I. The Ash Harvest* — the first realm to burn; its lord still guards a field of cinders because no one told him to stop. |
| 2 | **The Drowned Cathedral** — flooded gothic nave, glowing kelp | **The Tidebound Abbess** | *II. Vespers Under Water* — a choir that kept singing as the sea came in. She holds the Crown of Tides and will not give up the hymn. |
| 3 | **Thornwild** — a fey forest grown over a sleeping city | **The Briar Queen** | *III. The Hedge of Years* — she sealed her court in thorns to keep the ash out, and her people in. |
| 4 | **Glasswind Dunes** — a desert of glass under twin suns | **The Mirage Sultan** | *IV. A Thousand Reflections* — he has told so many lies he no longer knows which of him is real. |
| 5 | **Frostmourn Peaks** — aurora over black ice | **The Rime Colossus** | *V. The Long Winter* — a mountain that stood up to stop the fire and froze in place. |
| 6 | **The Gilded Deep** — dwarf-holds, rivers of molten gold | **Mammon, the Coin-Eater** | *VI. All That Glitters* — he bought the world's last warmth and ate it. |
| 7 | **Skyreach Aerie** — floating isles, storm light | **The Storm Roc** | *VII. Above the Ash* — the only creature that flew high enough to see the Throne, and went mad from it. |
| 8 | **The Umbral Carnival** — a nightmare circus that never closes | **The Harlequin** | *VIII. The House Always Wins* — the Dealer's own jester, who remembers how the first game was played. |
| 9 | **The Starless Sea** — a shore at the edge of creation | **The Leviathan of Nothing** | *IX. Where the Cards Go* — every discarded card falls here. So does every discarded world. |
| 10 | **The Hollow Throne** — the ashen citadel at the end of everything | **The Hollow King** | *X. The Last Hand* — three phases. |

### The turn
In world 8 the Harlequin tells you the Hollow King was a **Cardbound** too — the last one who
made it this far. In world 9 the Leviathan shows you the discard pile of worlds: this has
happened before. At the Throne the King is not a tyrant but a player who could not bring
himself to finish the hand, because whoever finishes it must take the Dealer's seat and deal the
next world.

### Endings (chosen after the final victory)
- **Take the Seat** — you become the Dealer; a new world is dealt; the Ferryman bows.
- **Return the Ace** — you put the Ace of Hearts back into the world and walk away from the table;
  the ash stops falling; the Ferryman finally rests.
- **Fold** *(only if you carry the Harlequin's Joker relic)* — you shuffle the gods' deck back into
  the river. No more deals. No more Dealer. The last line of the game is yours.

### Procedural story layer
- **The Chronicle** — a journal written as you play ("*In the Cinder Hollow you met a Gloomtooth
  Stalker and broke it with a Flush of Blades.*"), viewable any time and printed on the death and
  victory screens.
- Every map node gets a generated place name (*The Weeping Mile*, *Cinder Hollow*), every monster a
  generated species name, elites a title, event NPCs a name, trait and want.
- Events are built from templates × world flavour × seeded variation, so the same template reads
  differently in a flooded cathedral and a glass desert.

---

## 3. Combat — poker solitaire on a 5 × 5 table

### Turn structure
1. **Start of turn**: your Ward expires, statuses tick, you draw up to **hand size (5)**.
2. **Your turn**: you have **3 Deals** (actions). Placing a card on an empty cell costs 1 Deal.
   Arcana (spell) cards cost what they say (0–2). One free **Redraw** per turn: discard a hand
   card and draw a new one. Cards you do not place **stay in your hand**.
3. **End turn**: every enemy performs the intent it showed; enemy statuses tick; new intents roll.

### Lines
The 5 rows and 5 columns (and the 2 diagonals, worth ×1.25) are lines. When a placement fills a
line, the line is scored as a poker hand and **fires immediately**, then its cards leave the table
for the discard pile. A single card that completes **two or more lines at once** is a **Cross**:
every line it completes gets ×1.5. Planning crosses is the core skill.

### Scoring
Each card has **chips** = its rank value (2–10, J/Q/K = 10, A = 11). Each card's chips flow into its
**suit's channel**, and every channel is multiplied by the **hand multiplier**:

| Suit | Name | Channel | Scale |
|------|------|---------|-------|
| ♠ | **Blades** | damage to the targeted enemy | ×1.0 |
| ♣ | **Staves** | damage to **every** enemy | ×0.6 |
| ♦ | **Coins** | **Ward** (block until your next turn) | ×0.8 |
| ♥ | **Hearts** | **heal** | ×0.35 |

| Hand | Mult | Hand | Mult |
|------|------|------|------|
| High Card | ×1 | Flush | ×3 |
| Pair | ×1.5 | Full House | ×4.5 |
| Two Pair | ×2 | Four of a Kind | ×6 |
| Three of a Kind | ×2.5 | Straight Flush | ×8 |
| Straight | ×3.5 | Royal Flush | ×12 |
| | | Five of a Kind | ×10 |

Example: 7♠ 7♠ 7♣ 2♦ 9♠ is Three of a Kind (×2.5): Blades 23 → **57 damage**, Staves 7 → **10 to
all**, Coins 2 → **4 Ward**. A Flush of Blades is pure damage; a Flush of Hearts heals you and
kills nothing. Aces play high or low in straights. **Jokers** are wild (best rank, majority suit).
**Ash** cards (added by monsters) have no suit and 0 chips — they break flushes.

### Statuses
| Status | On you | On enemies |
|--------|--------|------------|
| **Ward** | absorbs damage, clears at your turn start | same, clears at *their* turn start |
| **Might** | +N chips per line | +N damage per hit |
| **Weak** | your output −25% | their damage −25% |
| **Exposed** | take +50% | take +50% |
| **Burn** | lose N HP a turn, N−1 | same |
| **Regen** | heal N a turn, N−1 | same |
| **Thorns** | — | deal N back when struck by Blades |

### Monster intents (shown above every enemy, like Slay the Spire)
Attack · Multi-attack · Ward · Buff · Debuff (Weak / Exposed / Burn) · Heal ally · Summon, and the
**table curses** that make this poker solitaire rather than a reskin:
- **Seal** — a cell is sealed with thorns/ice/chains for N turns (can't place there).
- **Ashen** — shuffles Ash cards into your deck.
- **Steal** — takes the highest card off the table.
- **Scramble** — shuffles the cards in one row.
- **Frost** — a cell's card scores 0 chips.
- **Flood / Void** (bosses) — wipes a row/column without scoring it.

---

## 4. Deck-building

### Cards
- **Playing cards** — rank 2–A in four suits. Starting deck: 20 low cards weighted by hero.
- **Enchantments** (one per card, shown as a coloured seal and foil):
  Keen (+6 chips) · Gilded (+3 gold when fired) · Vampiric (heal 2) · Blazing (Burn 3 on target) ·
  Stone (+4 Ward) · Glass (×1.5 line mult, 1-in-4 shatters) · Echo (chips count twice) ·
  Wild (any suit) · Lucky (1-in-3: +8 chips) · Royal (counts as any face card in straights & kinds).
- **Arcana** — spell cards: Fireball, Barrier, Transmute, Swap, Ascend (+1 rank), Sweep (clear a cell),
  Foresight (draw 2), Joker (conjure a wild), Mirror, Second Wind (+1 Deal), Gamble, Hex, Salvo,
  Thunderclap, Purify, Crown's Favour… ~20 in all, each with an upgraded form.

### Relics
~40 passive trinkets with procedurally generated names ("the *Widow's Brass Compass*") on fixed
effects: +1 Deal, +1 hand size, +1 Redraw, flushes +50%, pairs heal 3, first line each combat ×2,
start combat with Ward, diagonals ×2, crosses ×2, Hearts also deal damage, gold interest, etc.
Every Warden drops a unique **Crown** relic.

### Elixirs (3 slots)
Healing Draught, Ironbark Tonic (Ward), Dragonfire (damage all), Quickening (+2 Deals),
Fortune's Tea (redraw hand), Liquid Luck (next line ×2), Antidote (clear debuffs), Strength Tincture.

### Heroes (3, appearance and name generated per run)
| Hero | HP | Starter relic | Deck bias |
|------|----|----|----|
| **The Blade-Oath** (knight) | 75 | *Oath-Brand*: first Blades line each turn +30% | Blades/Coins |
| **The Hearth-Witch** | 65 | *Ember Kettle*: Hearts also deal 50% as damage | Hearts/Staves, starts with Hex |
| **The Coin-Rogue** | 60 | *Loaded Die*: +1 Redraw, +15% gold | Coins/Blades, starts with a Joker |

---

## 5. The map — 100 levels

Each world is a branching Slay-the-Spire map of **10 levels** (floors). Floors hold 2–4 nodes;
paths cross between neighbours; you choose one node per floor.

| Level | Rule |
|-------|------|
| 1 | always a battle (world prologue plays first) |
| 2–4 | battles, events, a shop |
| 5 | treasure (a relic) |
| 6–8 | battles, elites, events, rest, shop; the world's **story encounter** is on one path |
| 9 | always a campfire (rest / temper / meditate) |
| 10 | **the Warden** |

Node types: ⚔ Battle · ☠ Elite · ❓ Event · 🪙 Shop · 🔥 Campfire · 🎁 Treasure · 👑 Warden.

**Progress & saving**: the run autosaves after every node. Entering a new world writes an
**Ember Checkpoint** (deck, relics, gold, full HP). Dying offers *Rekindle* (restart this world from
its checkpoint) or *New Run*. The deepest world reached and every ending seen are kept.

---

## 6. Procedural generation

| Thing | How |
|-------|-----|
| **Cards** | Faces painted on canvas at 512 × 720: parchment grain, gold filigree borders generated from spirographs, suit glyphs drawn as vectors (sword, heart, coin, stave), pip layouts, and for J/Q/K/A a *generated portrait* (face shape, crown, hair, beard, mantle, colours from the rank and suit). Heightmaps become normal maps so the gold foil catches the light. Arcana get generated sigils. Card back: a seeded mandala. |
| **Monsters** | A genome per species: archetype (blob, golem, wisp, beast, serpent, knight, flyer, bloom, eye, construct, jester, wraith) × world palette × parts (horns, crowns, eyes, spikes, wings, tendrils, orbiting shards) × noise-displaced high-poly bodies with rim-lit, emissive-veined materials; idle breathing, lunge, hit flash and a dissolve death shader. Names from syllable tables per world. Stats and a move-set rolled from the archetype and scaled by world and level. |
| **Bosses** | Hand-designed mechanics and phase scripts with procedurally built bodies (bigger, crowned, extra parts, aura). |
| **Backgrounds** | Per world: sky shader (gradient, FBM clouds, stars, aurora, nebula, twin suns), 3–4 parallax ridge layers, a textured ground, instanced props (trees, crystals, ruins, pillars, ice spikes, floating isles, tents, coral), volumetric-looking god rays, fog and a particle weather system (embers, bubbles, spores, sand, snow, gold motes, feathers, confetti, stardust, ash). |
| **Hero** | Class silhouette + seeded cloak/trim colours, hood/helm/hat, weapon, and a generated name and epithet. |
| **Levels** | Seeded branching maps with rule-checked node placement and generated place names. |
| **Music** | Every world gets a key, mode, tempo, chord progression and motif, composed on the fly: map theme (pad, harp, bells), battle theme (+ taiko, strings ostinato), Warden theme (+ choir, brass, double-time drums). |
| **Story** | Authored spine + generated Chronicle + templated events + generated names. |

Everything uses a seeded RNG, so a run is reproducible from its seed.

---

## 7. Presentation

### Graphics
- ACES tone mapping, physically based materials, soft shadows, a generated PMREM environment so
  gold foil and armour reflect the world's sky.
- Post chain: `RenderPass(world) → RenderPass(cards) → UnrealBloom → Grade (vignette, grain,
  chromatic aberration kicks, flash, per-world tint) → OutputPass`.
- Cards are real 3D objects: rounded, two-sided, foil-shaded, tilting toward the cursor, flying
  from deck to hand to table, flaring along a fired line, then bursting into suit-coloured motes
  that fly to their target.
- Two cameras: the world camera frames the monsters and hero; the card camera (narrow FOV) frames
  the table and hand in pixel-perfect screen layout so the grid is always legible.
- Quality tiers (pixel ratio, bloom, shadows, particle counts), dropped automatically when the
  frame rate sags.

### Audio
All synthesised at runtime — no files. A look-ahead sequencer on the AudioContext clock;
pre-rendered Karplus–Strong harp, FM bells and taiko into buffers at boot; detuned string and pad
voices, formant choir, brass; a generated convolution reverb. SFX for draw, place, fire (a chime
run whose length is the hand rank), blades, staves, coins, hearts, hits, deaths, gold, relics.

### Layout
- **Landscape**: hero at far left, the table centre-left, enemies to the right, the hand fanned
  along the bottom, HUD across the top.
- **Portrait**: enemies across the top, the table in the middle, the hand along the bottom.

### Controls
- **Mouse / touch**: drag a card onto a cell, or tap a card then tap a cell. Tap an enemy to target.
  Double-tap / right-click a hand card to Redraw it.
- **Keyboard**: `1–7` pick a hand card, arrows move the cell cursor, `Enter`/`Space` place,
  `Tab` cycle target, `R` redraw, `E` end turn, `D` deck, `H` hand ranks, `Esc` pause, `M` mute.

---

## 8. Architecture

```
game-047/
  index.html          import map, DOM overlay skeleton
  style.css
  js/
    main.js           boot, frame loop, the run flow (advance), save/load, input, debug hooks
    battle.js         combat director (plays sim events back) + table input
    sim/              PURE: no three, no DOM, no Math.random
      rng.js          mulberry32, hashes, serialisable RNG
      rules.js        suits, hands, mults, tunables
      cards.js        enchantments, Arcana, card factory, reward rolls
      poker.js        5-card evaluator with wilds/Ash
      combat.js       table, lines, turns, statuses, intents, scoring, event queue
      monsters.js     species genomes, roles, encounters, the ten Wardens
      relics.js       relics (procedural names) and elixirs
      worlds.js       the ten realms: palettes, props, bestiary archetypes, music, scaling
      map.js          branching 10-floor maps, place names
      events.js       templated mystery events
      story.js        The Last Hand: opening, chapters, interludes, Wardens, endings
      heroes.js       three classes, starting decks, generated names/looks
      run.js          run state, rewards, shop, rest, effects, checkpoints, Chronicle
      bot.js          heuristic player for tests
    view/
      scene.js        renderer, two scenes/cameras, composer, grade pass, quality
      textures.js     canvas helpers, noise, normal-from-height
      cardArt.js      card face/back painting (colour + normal + foil maps)
      cards3d.js      card meshes, carved table, hand, piles, cell overlays, hit-testing
      world.js        realm backdrops, weather, god rays, lights, PMREM env
      creatures.js    procedural monsters, Warden signatures, heroes
      stage.js        actors in the world, combat camera framing
      fx.js           particles, homing motes, beams, rings
    audio/audio.js    synth engine, baked instruments, generative score, SFX
    ui/
      dom.js          element builder, SVG icons, card thumbnails, tooltips, numbers
      hud.js          top bar, combat panel, enemy plates
      screens.js      title, heroes, story book, map, reward, event, shop, rest,
                      treasure, picker, deck, ranks, how-to, settings, chronicle, death, ending
  dev/
    simtest.mjs       bot plays whole 100-level runs headlessly + invariants + balance table
    browsertest.mjs   Playwright walk of the real game, desktop + phones
    cards.html, creatures.html, wardens.html   visual review sheets
```

Rules proven by earlier games in this repo: the simulation is pure and seeded (game-040), the sim
talks to the view through a bounded event queue (game-040/045), one juice director maps events to
sound/particles/shake (game-045), difficulty is tuned with bots rather than vibes (game-039/040),
real touch input is tested through CDP (game-040), auto-quality is pinned in browser tests
(game-041), shared geometry is never disposed (game-040), and normals are always present on lit
geometry (game-046).

---

## 9. Phases

1. **Design** (this document).
2. **Simulation**: cards, evaluator, board, combat, monsters, relics, map, events, story, run, save.
3. **Headless bot + simtest**: invariants and a balance table across all 100 levels.
4. **Rendering**: scene, card art, 3D cards, table, backgrounds, monsters, hero, fx, post.
5. **Audio**: SFX + generative music.
6. **UI**: all screens, HUD, tooltips, tutorial hints.
7. **Browser test** on desktop and phones; screenshot review; polish.
8. Launcher entry, README, docs, changelog.

---

## 10. Changelog

- **v1.0** — first release: 10 worlds, 100 levels, 3 heroes, 10 Wardens, 3 endings.
  Balance (bot, 24 runs): every run finishes the campaign with rekindles; normal battles cost
  ~6–18% HP, elites ~9–23%, Wardens ~15–46%, and the last two Wardens are the hardest fights.
  Flood and Void were made predictable (bottom row upward, left column rightward, shown on the
  table) after random wipes made the Abbess fight drag.
