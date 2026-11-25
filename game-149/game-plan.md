# Echoheart Academy

**Genre:** anime visual novel + life sim + turn-based RPG (with six magical mini-games)
**Engine:** three.js r165 (campus overmap and battles), DOM visual-novel layer, Canvas 2D mini-games
**Media:** art painted with fal (Nano Banana 2); characters and creatures modelled, rigged and animated with Meshy;
music, sound effects and voices made with ElevenLabs. Every one has a code-made fallback (toon capsules, synth tones).
**Status:** v1.0.0

---

## Concept

An upbeat anime visual novel. Kai Amano (the player can rename him) is a boy whose only magic is that he can *hear*
other people's spells as songs and *sing them back*. He enrols at Lumina Academy, a castle school on a floating
island, makes four friends, plays their magical mini-games, collects Echo Charms, falls a little in love, and
uncovers that the kindly, candy-giving Principal Veymont leads the Hollow Choir, a three-hundred-year-old cult that
steals students' magic to keep its master young. On the night of the Starfall Festival the Hollow Moon rises, the
friend Kai is closest to is taken, and he has one night, against a ticking moon, to free every caged student and
face Veymont in the Undercroft.

Tone: bright, warm, funny. The danger is real but never grim: nobody is hurt, a lost battle is a retry, and the
climax is urgent rather than frightening. Riffs on Persona's calendar and social links, Fire Emblem's support
conversations, and the classic magic-school VN.

## Core loop

One school day:

1. **Morning**: a story scene and the day's class, which is one of the mini-games (graded C–S).
2. **Afternoon** and **evening**: free time on the 3D campus. Walk anywhere; picking up charms, petals and
   marshmallows, shopping, giving gifts and turning in quests cost no time. One *activity* per slot: hang out with a
   friend (their next conversation, or a heart event when one is ready), play their mini-game together, practise
   Resonance, train at the Dueling Grounds, or explore the Whispering Wood (a battle).
3. **Night**: a story scene (sometimes a battle), then sleep.

Eleven days in five chapters. Day 11's night is the Festival, the reveal and the rescue.

## Mechanics

### Story engine (`js/sim/vn.js`, `js/sim/story.js`)
Scenes are written in a small line language and compiled at load (any typo is a compile error the simtest catches):
`bg`, `music`, `sfx`, `cg`, `show who expr pos`, `hide`, `> narration`, `who expr: line [v:voiceKey]`,
`choice` with `- text | effects -> label`, `label`, `goto`, `if cond -> label`, `do effects`, `battle enc`,
`mini game level partner`, `call scene`, `chapter n`, `end`, `climax`, `ending`. Effects: `hana+3`, `give:item`,
`take:item`, `lumens:+n`, `flag:x`, `join:who`, `quest:id:stage`, `romance:who`, `friend:who`, `partner:who`,
`capture`, `heal`. Conditions: `flag:x`, `hearts:who>=n`, `best:who`, `item:x`, `romance:who`, `captive:who`,
`partner:who`, `late`, `allfree`. Text substitutes `{name}`, `{best}`, `{captive}`, `{partner}`.

### Bonds and romance (`js/sim/rules.js`, `config.BOND`)
Bond points per friend, 15 to a heart, 10 hearts. Hanging out +3 (plus the conversation's choices, usually +2..+5),
a mini-game together +2..+5 by grade, a gift +6 loved / +3 liked / +1 other (one per friend per day). Heart events at
2, 5 and 8 hearts, always in order; the third has a CG and asks *romance or best friends*. The Festival dance can go
to anyone with 3+ hearts (else Mochi). The Hollow Moon takes whoever Kai is closest to; the epilogue is theirs.

| Friend | Element / skill | Home | Mini-game | Loves |
|---|---|---|---|---|
| Hana Kirishima | fire · Blaze Burst (one foe, 2.0×) | Dueling Grounds | Fireball Gallery | Spicy Chestnuts, Fire Opal |
| Lys Moonwell | star · Starfall (all foes) | Grand Library | Star Catcher | Star Chart, Ribbon Bookmark |
| Pip Brightwater | water · Tidal Tonic (heal all) | Alchemy Lab | Potion Brewing | Brass Gears, Bubble Soap |
| Ren Takeda | wind · Cyclone (all foes, hastes the party) | Sky Tower Field | Sky Rings | Wind Chime, Honey Bun |

### Battles (`js/sim/battle.js`)
Charge-time turns: everyone fills by speed; at 100 they act. Heroes get Strike, Skills, Items, Defend (halves damage
until their next turn), and Auto. Kai's **Echo** copies the last spell anyone cast, a foe's included, at 125% (×1.5
more against Veymont): echo Lys's Starfall and it rains on the enemy; echo the Choir's Hollow Requiem and it hits the
Choir. Kai also has Harmony (heal all). Elements: weak ×1.5, resist ×0.5. Graves joins as a guest twice (Warding
Glyph halves damage for two turns). A lost story battle offers Try again, and each retry thins the foes' HP by 10%
(to 60%), so nobody is ever stuck; optional fights can be left.

| Foe | Weak | Resists | Moves |
|---|---|---|---|
| Hollow Wisp | star, water | hollow | Flicker, Magic Drain |
| Masked Acolyte | fire | – | Drain, Flicker, Strike |
| Enchanted Armor | water, wind | fire | Gauntlet Smash |
| Gargoyle | wind | star | Stone Dive |
| Hollow Veymont (boss) | – | hollow | Hollow Requiem (all), Siphon, Moon Lance, Choir Call (summons) |

### Mini-games (`js/sim/minis.js`)
Pure, seeded, each with its own bot. Graded against a goal: S ≥ 90%, A ≥ 70%, B ≥ 45%.
- **Resonance**: the Prism's four crystals sing a growing song; repeat it with the arrows. Three lives.
- **Rune Strokes**: enter each rune's strokes (arrows) before it fades; a mistake restarts the rune. 40 s.
- **Potion Brewing**: press as the needle crosses the glow (the centre is perfect); 8 ingredients, faster each time.
- **Star Catcher**: move the basket; stars +1, gold +3, comets −2 and a stun. 35 s.
- **Sky Rings**: steer a broom through 16 (or 22) rings coming at you.
- **Fireball Gallery**: three lanes; masks +2, Mochi plushies −3. 35 s.

Every mini-game pays lumens and XP to everyone who has joined; with a friend it raises their bond; at the Festival
prizes double and an A or S wins an item.

### The campus (`js/sim/game.js`, `js/view/campus.js`)
A floating island 92 units across: the Great Hall, Grand Library, Alchemy Lab, Dueling Grounds, Sky Tower Field,
Dormitory, Infirmary, the Principal's Tower and the Whispering Wood, around a fountain courtyard (the Academy
Store). Buildings are solid circles behind their doors; the island's edge holds. Twelve **Echo Charms** are hidden
around it (all twelve make Echo free), six **moonpetals** (Pip's Phoenix Feather quest, from day 3) and three
**Cloud Marshmallows** (Mochi's quest, from day 2).

### The Hollow Moon (climax)
A 360-second moon clock that runs while Kai moves (each rescue battle burns 40 s more). Four cages: Theo at the
Library, Yuki in the Wood, the first-years at the Sky Tower, the captured friend in the Great Hall. Then the
Undercroft under the Principal's Tower. If the moon peaks first, the bell tolls, the remaining cages seal and the
Undercroft opens anyway, but Veymont is stronger: +15% for every student left caged, +25% for being late. Everyone
is saved in the end either way; the epilogue notes a close call.

## Story

| Ch. | Days | Beats |
|---|---|---|
| 1 · The Boy Who Echoes | 1–2 | The sky bridge, Ren, Mochi falls from the clouds; Principal Veymont's candy; the Prism shows every colour; meeting Lys, Pip and Hana; Theo's magic sounds faint. |
| 2 · Moonfade | 3–5 | Theo won't wake: "Moonfade". Kai hears Theo's song in Veymont's cane. Wisps in the wood (Ren joins); Theo's library book; Lys's plan for the Restricted Archive. |
| 3 · Whispers in the Stacks | 6–8 | The Hollow Choir's mark; the Enchanted Armor (Lys joins); Graves sneaking at midnight; Yuki vanishes (Hana joins); tea in Veymont's study and a cabinet of humming crystals. |
| 4 · Starfall Festival | 9–11 | Gargoyles, and Graves reveals she's been hunting Veymont (Pip joins); the Festival, the dance, thirteen bells, the reveal on the clocktower, the closest friend taken. |
| 5 · The Hollow Moon | 11 (night) | The rescue against the clock; the Undercroft; Kai echoes every stolen song at once; the epilogue with the best friend (sweetheart or best friends). |

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Read on / choose | Space, Enter, Z · ↑↓ + Enter | A · d-pad | tap the box · tap a choice |
| Walk | Arrows / WASD | stick / d-pad | drag on the left half |
| Enter a place | Space / Enter / Z | A | A button, or tap the prompt |
| Mini-games | Arrows; Space for Potion Brewing | d-pad, A | the on-screen pad; tap a lane in the Gallery |
| Journal · Bag | J · B | – | 📖 · 🎒 |
| Pause / back | P / Esc | Start / B | ❚❚ |

## Look and sound

- **VN**: 17 painted backgrounds, 32 waist-up expression sprites (cut out by `dev/art/export.py`), 7 CGs (the title,
  four heart events, the reveal, the ending), 32 item icons. Fonts: M PLUS Rounded 1c and Kaisei Decol.
- **3D**: 15 Meshy models (five heroes, Veymont and his Hollow form, Graves, Theo, Yuki, the acolyte and armor rigged
  with Meshy library clips; Mochi, the wisp and the gargoyle move procedurally) in three-step toon shading with ink
  outlines (`js/view/assets.js`, from game-147). The campus is built in code; time of day changes the light and sky;
  the Hollow Moon night is violet with light-beam cages.
- **Sound**: six ElevenLabs music themes (title, academy, mystery, battle, climax, tender) crossfaded by the story,
  16 sound effects, and 50 voice lines across eight characters (scene lines with `[v:key]`, battle barks, gift thanks).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, events → view/audio/UI, autosave, debug hooks (`__ea`) |
| `js/sim/game.js` | The hub: calendar, free time, places and their actions, the map mover, the climax clock, saves |
| `js/sim/vn.js`, `story.js` | The scene language compiler and interpreter; every scene |
| `js/sim/battle.js`, `minis.js` | Battles (with the foe and auto AI) and the six mini-games (with their bots) |
| `js/sim/rules.js`, `data.js`, `bot.js` | Bonds, items, party, text; all tables; the auto-player |
| `js/view/view.js`, `campus.js`, `arena.js`, `assets.js`, `miniview.js` | three.js stage, campus, battle arena, Meshy loader, mini-game canvas |
| `js/ui/vn.js`, `ui.js`, `battleui.js` | The VN layer, screens/HUD/sheets, the battle HUD |
| `js/audio.js`, `input.js`, `save.js`, `rng.js`, `config.js` | ElevenLabs audio + synth fallback, input merge, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (~460 checks): purity, every scene compiling and every asset it
names existing, the VN language, bonds, battles, mini-games (a perfect bot gets S, a clumsy one doesn't), a
flood-fill proof that every place and pickup is reachable by the real mover, the calendar, the climax, determinism
and save round trips mid-battle and mid-mini-game, and whole games by the bot at three skills and four favourites.
`browsertest.mjs` plays the real page on desktop by keyboard and mouse, on two touch-only phones by taps and real
touches, and with storage blocked.

## Balance notes (from the bot)

- First pass: bonds rose 3× too fast (a rotating bot hit 100 with all four). Rescaled to 15 per heart and smaller
  gains; now a devoted player reaches the last heart event around day 8–9, a rotating one 2–6 hearts each.
- The party reached the boss at level 4 (XP came only from story battles) and lost forever. Mini-games now give
  XP; friends who join late catch up to one level behind Kai; retries thin the foes. Now level 9–10 at the finale;
  a weak bot needs 1–7 retries on the boss, a strong one 0–1.
- Mini-game goals were set too low (a clumsy bot earned S in four of six). Raised them; the clumsy bot now earns C–B.
- A charm sat outside the island and another inside the lab's walls; the reachability proof now guards that.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More hangout conversations per friend (five each now; the fifth repeats).
- Romance is light by design; a "date" event at 10 hearts could follow.

## Changelog

### v1.0.0 (2026-11-25)
- First release: 11 days in 5 chapters, 74 scenes, four friends with five hangouts and three heart events each,
  romance or friendship, six mini-games, turn-based battles with Echo, 12 Echo Charms and four side quests, the Hollow
  Moon rescue against the clock, a finale and five epilogues. fal art, Meshy models and animation, ElevenLabs music,
  effects and voices.
