# Arcana Pull

**Genre:** Gacha auto-battler with tarot cards
**Engine:** none: plain HTML, CSS and JavaScript modules (DOM screens and card faces, one Canvas 2D effects layer), no build step
**Art:** fal (`fal-ai/nano-banana-2`) · **Music, sound, voices:** ElevenLabs
**Status:** v2.0.0

---

## Concept

The Great Deck has shattered. The shadows of the Major Arcana (the Hollows: the Fool reversed, the Emperor reversed, Death,
the Tower…) hold ten Thresholds between you and The World, which has turned on the deck that made it. You are a Cartomancer.
Draw living tarot cards from the Well of Fortune, set a spread of four, and watch it fight its way through, Threshold by Threshold,
to the last door.

v1 (Kaplay, Feb–Oct 2026) had the same shape: a 78-card gacha, a four-card party, ten waves themed on the Major Arcana, The World
as the final boss, Readings with blessings and curses. v2 keeps that design and its Hollows, and rebuilds it to the recent games'
standards: a pure seeded sim, a bot that balances it, painted cards, recorded sound, and tests.

## The loop

1. **The parlour.** See the Threshold ahead: its Hollows, their element, and the hint of which element beats them. Your spread of
   four, front to back, and the suit resonance it makes. Your stardust, lives and any omen.
2. **The Well.** Draw one (60 stardust) or ten (540). Cards are dealt face down and glow by rarity; turn them by tap or Reveal all.
3. **The Grimoire.** Every card you own: open one to see its numbers and skill, raise its stars with copies, place it in a slot.
   **Auto** builds a spread for you (the toughest card in front, a healer if you have one, the rest by power against this Threshold).
4. **Face the Threshold.** The battle is settled by the sim at once and replayed on the stage at 1×, 2× or 4×, or skipped.
   Win: stardust and score, and onward. Lose: a life, a little stardust, and the same Threshold again with everything you own.
5. **Readings** after the 3rd, 6th and 9th Thresholds (below). **The ending** after The World; then **Ascend**.

## Rules (`js/sim/`)

### Cards (`data/cards.js`)
- All 78 are fighters. Rarity: 2–6 Common, 7–10 Uncommon, Ace / Page / Knight Rare, Queen / King Epic, all 22 Major Arcana Legendary.
- Numbers: a base by rarity (HP, ATK, SPD) scaled by suit (Wands ×1.25 ATK; Cups heal; Swords ×1.3 SPD; Pentacles ×1.42 HP and 22% DEF)
  and a little by pip; Majors have their own multipliers. Stars add 20% HP and ATK each.
- Suit skills: Kindle (Wands: 150% and a burn), Pour (Cups: heal the most hurt ally, every 2 actions), Flurry (Swords: the two front
  Hollows), Bulwark (Pentacles: shield the most hurt and taunt). Aces and Kings take theirs to every target; Queens add a second blessing;
  Knights are 15% swifter; Pages charge in 2.
- 22 Major skills, each unique: Leap of Faith, Fourfold Will, Veil of Mysteries, Bloom, Iron Decree, Benediction, Twin Hearts,
  Triumphal Charge, Tamed Lion, Lantern of Truth, Turn of the Wheel, Scales of Judgement, Surrender, Reaping, Alchemy, Chains of Desire,
  Lightning Strike, Hope Renewed, Lunacy, Radiance, The Last Trumpet, Completion.
- Skills are lists of effects (`dmg`, `heal`, `shield`, `buff`, `debuff`, `burn`, `stun`, `blind`, `cleanse`, `revive`, `execute`,
  `delay`, `dodge`, `taunt`, `wheel`) read by one interpreter in `battle.js`; a card charges by one each action and casts at its cost.

### The Well (`game.js`)
- Rates: Common 52, Uncommon 28, Rare 13, Epic 5, Legendary 2 (per hundred). A ten-draw always holds a Rare or better.
- Pity: from the 30th draw without a Legendary each draw adds 6 points; the 40th is certain. Each Threshold features one Major (one whose
  element beats the Threshold's when there is one): half of all Legendary draws are it.
- A new card joins at ★1; a duplicate is a copy. ★n → ★n+1 costs n copies. A copy of a ★5 card turns to 25 stardust.

### Battle (`battle.js`)
- Four cards front to back against up to five Hollows. Each unit acts every `BEAT / SPD` seconds (BEAT 20), earliest first.
  Plain attacks strike the front Hollow (or the taunting one); Hollows strike your front card unless they aim elsewhere (back, lowest, random).
- Elements: Fire beats Air beats Earth beats Water beats Fire, ×1.35 one way and ×0.75 the other. The Majors have elements too;
  The World is Spirit and changes element as it weakens.
- Suit resonance: two or more of one suit lend the whole spread Wands +10/20% ATK, Cups +25/50% healing (and regeneration at three),
  Swords +10/20% SPD (and crits at three), Pentacles +6/12 DEF (and a starting shield at three), Majors one or two charges in hand.
- Shields stack but never pass half their bearer's HP. A battle that runs past 150 seconds is lost (the candle burns out).
- Hollow passives: dodge, undying (rises once), thorns, deathblast, regeneration, a shield when first under half HP, harvest (heal when
  an ally falls), charge (a double first strike), openers (a curse as the battle starts), and The World's three phases (Fire, Water, Air).

### Thresholds (`data/enemies.js`)
| # | Threshold | Reversed arcanum | Element | Hollows |
|---|---|---|---|---|
| 1 | The Wandering Path | The Fool | Air | Stray Page ×2, Wandering Jester |
| 2 | The Hidden Veil | The High Priestess | Water | Veil Shade, Oracle Hound, Moonlit Specter |
| 3 | The Iron Decree | The Emperor | Fire | Iron Sentinel, **Emperor's Avatar**, Imperial Guard |
| 4 | The Relentless Advance | The Chariot | Earth | Chariot Runner ×2, War Sphinx, Triumph Steed |
| 5 | The Inverted World | The Hanged Man | Water | Inverted Echo, **Hanged Warden**, Suspension Wraith |
| 6 | The Pale Crossing | Death | Earth | Bone Strider ×2, Pale Rider, Reaper Shade |
| 7 | The Falling Spire | The Tower | Fire | Collapse Golem, **Tower Sentinel**, Lightning Herald |
| 8 | The Dream Labyrinth | The Moon | Water | Nightmare Crab, Howling Wolf ×2, Lunar Phantom |
| 9 | The Final Calling | Judgement | Fire | Risen Knight, **Celestial Judge**, Angel of Doom |
| 10 | The World Entire | The World | Spirit | World Shard ×2, **The World** |

### Readings, charms, lives (`data/omens.js`)
- After Thresholds 3, 6 and 9: three cards face up, each showing what it would give upright and reversed. Choose one; it lands reversed
  three times in ten. The suit decides: Wands Blaze (+20% ATK) / Weakened (−15%); Cups Mending (+20% HP) / Poisoned (3% HP each action);
  Swords Clarity (+15% SPD) / Slowed; Pentacles Ward (a 20% shield) / Hexed (half stardust); Major Fortune (a charm and 200 stardust at once) /
  Cursed (pulls stop counting toward the guarantee). An omen lasts three battles.
- Charms (three at most): Star Vial (a 35% shield next battle), Sun Sigil (double stardust from the next win), Moon Shard (Hollows strike 20%
  softer next battle), Wheel Token (ten free draws at once). From Fortune readings and each Ascension.
- Three lives. A loss costs one; the third ends the run.

### Ascension
Defeat The World, then Ascend: the ten Thresholds again, Hollows 35% stronger per Ascension, with every card and star you own,
300 stardust and full lives.

## Balance (the bot)

`sim/bot.js` plays only through `act()`. Three styles: **careful** (ten-draws, stars up everything, Auto, charms on elite and boss
Thresholds, reads wisely), **casual** (single draws and Auto, nothing else), **random** (the first four cards it drew, in that order).
Tuning knobs: `START_DUST` 900, `winDust` 200 + 40 × Threshold, `TRIAL_HP` and `TRIAL_ATK` per Threshold, `ENEMY_SCALE`.

120 seeds (`SEEDS=120 ONLY=bot node game-012/dev/simtest.mjs`):

| Style | Runs won | Thresholds cleared | Lives lost | Draws | Legendaries |
|---|---|---|---|---|---|
| careful | 82% | 9.6 | 0.76 | 86 | 2.8 |
| casual | 66% | 8.8 | 1.19 | 72 | 2.3 |
| random | 0% | 3.1 | 2.73 | 31 | 0.8 |

- Battles first lasted 3 seconds (SPD 10 meant an action a second); BEAT 20 halves the pace, and Threshold 1's Hollows have 2.2× HP,
  so the first fight lasts about 13 seconds and The World about a minute.
- The World's Shards shielded every ally on every cast, without limit: 2,600 points of shield a fight, and half of all careful runs lost.
  The shield cap (half max HP) and a single-target shard shield fixed it.
- The random bot walls at Threshold 3–4: an Emperor's elite with a 25% shield at half HP, and chargers that strike twice. A thoughtful
  player should do better than the careful bot, who never looks at elements beyond Auto's power sort.

## Look and sound

- **Card faces** (`js/view/cards.js`): the fal painting under a gradient, the numeral, the element badge, the name and stars drawn in DOM;
  a gradient in the suit's colour stands in if a picture fails. Legendary frames glow gold.
- **The stage** (`js/view/stage.js`): the realm painting behind two lines of cards; lunges, casts, hurt shakes, floating numbers by kind
  (crit, strong, weak, heal, shield, burn), HP and shield bars, charge pips, status tags; a Canvas 2D layer of sparks, rings and bolts in
  each element's colour, with screen shake on crits and phases. Reduced motion (or the setting) keeps the numbers and drops the motion.
- **The Well**: cards dealt face down with a 3D flip; Rare, Epic and Legendary backs glow before they turn.
- **Art** (`art/`, `dev/art/`): 123 WebP files from 44 fal jobs, 6.5 MB.
- **Audio** (`audio/`, `dev/audio/`): four themes (parlour, battle, boss, reading), 24 effects, 23 voiced lines (the Oracle and The World),
  3.9 MB. Every line shows as a subtitle.

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| The Well · Grimoire · Charms | Buttons | W · G · C |
| Auto spread · Face the Threshold | Buttons | A · F |
| Battle speed · Skip | 1× 2× 4× · Skip | 1 2 4 · S |
| Close a sheet / pause | ✕ · ❚❚ | Esc |
| Everything else | Tap | Tab and Enter / Space |

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, buttons and keys → commands, events → UI, stage and sound, battles, saving, debug hooks (`window.__ap`) |
| `js/sim/game.js` | The run: `newGame(seed)`, `act(G, cmd)`, the Well, the spread, battles' bookkeeping, Readings, Ascension, `serialize`/`deserialize` |
| `js/sim/battle.js` | The battle engine: `resolve(allies, foes, rng)` → `{ won, log, … }`; card numbers; resonance; elements |
| `js/sim/bot.js` | The three bot styles and `playRun` |
| `js/sim/data/*.js` | Cards, Hollows and Thresholds, omens and charms, spoken lines |
| `js/view/cards.js`, `js/view/stage.js` | Card faces; the battle replay |
| `js/ui.js` | DOM screens, the reveal, the Grimoire, the Reading, results, subtitles, toasts |
| `js/audio.js`, `js/media.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, the media list, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (358 checks) and `browsertest.mjs` (67 checks).

## Open questions / next steps

- A human pass on a real phone: the bot is not a person and SwiftShader is not a GPU. Nobody has played a whole run by hand.
- The music was generated with "no vocals" in each prompt; nobody has listened to all four themes in order.
- Auto sorts by raw power and the hint names the right element, but a "best by element" Auto option might help new players.
- A collection reward (every suit complete) or a Grimoire milestone would give the 78 cards a goal beyond the run.

## Changelog

### v2.0.0 (2026-11-18)
- Rebuilt with no framework to the recent games' standards: pure seeded sim, a bot, fal art, ElevenLabs audio, simtest and browsertest.
  The v1 Kaplay code and its Rider–Waite scans are gone. See the repo [CHANGELOG](../CHANGELOG.md).

### v1.0.0–v1.5.2 (2026-02-27 – 2026-11-18)
- Kaplay: the gacha, collection and party builder, the tick-based auto-battler, 10 waves with elites and The World's phases, Readings.
