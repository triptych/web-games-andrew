# Emberbrood — game-038

An 8-bit procedurally generated dragon battler. Fight them, bind them, raise
them, breed them, and put the sky back together.

**Vanilla HTML, CSS and JavaScript. No libraries, no build step, and not one
asset file** — every dragon is drawn in code from its own genes, every sound is
synthesised on the spot, and the whole country is a pure function of one seed.

Open `index.html` over `http://` (ES modules need a server, not `file://`):

```bash
python3 -m http.server 8000     # then http://localhost:8000/game-038/
```

## What it is

The Emberlines that hold the sky together are going out, and the dragons that
tended them are forgetting their own names. You inherit a hatchery, a seal and
an unfinished argument with the Concord of Ash, and you have five acts to
decide what happens to the last great wyrm in the world.

- **Turn-based battles, Final Fantasy shaped.** Three dragons, turn order by
  speed with a visible queue, MP, eleven statuses, an eight-element chart with
  double weaknesses, and a shared Ember Surge meter for lineage ultimates.
- **Binding is the second win condition.** Wear a wild dragon down, chill or
  stun it, and throw a binding. The odds are shown before you commit, and a
  failed throw costs you the item and the turn.
- **Ashbound dragons can be brought back.** Grey, nameless and hostile — until
  you cleanse one mid-fight and it remembers what it was called.
- **Everything is generated.** Twelve lineages × body plan, wings, horns, tail,
  crest, pattern and colour genes, all of which decide both the stats and the
  32×32 sprite. A dragon you bred visibly resembles its parents.
- **Breeding compounds.** Each generation is worth 2% on every stat up to 10%,
  inherits the better of three essences, can carry two of its parents' skills,
  and occasionally throws back to an Elder line that had gone out of the family.
- **87 items** across ten kinds, 18 main quests, 12 authored side quests,
  generated notice-board work in every town, a 14-recipe forge, 28 places, and
  three endings gated on what your brood can actually prove.

## Controls

Built for a phone: one column, no hover, every tap target at least 44px, and the
command strip always in thumb reach. On a desktop, `1`–`4` switch tabs and `Esc`
backs out of a panel.

## The code

```
js/
  core/   rand.js bus.js util.js                — seeded RNG, event bus, helpers
  data/   the whole game as tables               — elements, lineages, moves, traits,
          statuses, items, world, bosses, quests, story, events, constants, names
  gen/    dragon.js sprite.js pixels.js          — the genome, and genes → pixels
          encounters.js questgen.js              — what you meet, and who wants what
  game/   battle.js adventure.js breeding.js     — the rules. Headless, no DOM.
          quests.js scenes.js effects.js state.js save.js
  ui/     shell.js map.js battle.js brood.js     — the screens. No rules, ever.
          pack.js journal.js scene.js sprites.js
  audio.js main.js
```

The split is the point: `js/game/` and `js/gen/` never touch the DOM, which is
why a whole playthrough can be simulated headlessly in node.

## Tests

```bash
node test/run.mjs          # 30 assertions: genome, damage, binding, breeding,
                           # quest predicates, save round-trip, data integrity
node test/sim-battle.mjs   # 200 random fights: do they terminate, and how fast
node test/sim-boss.mjs     # each boss, with a matched party and a wrong one
node test/sim-run.mjs      # a complete playthrough, act I to an ending
```

`test/harness.html` runs the same assertions in a browser and then draws a
sprite gallery, so the generator can be looked at as well as asserted.

## Design

The full design document is [GDD.md](GDD.md).
