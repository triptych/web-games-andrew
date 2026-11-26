# lib/core — a common library for the games

Plain ES modules, no dependencies, no build step. They are the canonical versions of the helpers
that the games have each copied and drifted from (see [docs/common-core.md](../../docs/common-core.md)
for the audit). **Nothing here is required:** a game takes the modules it wants and keeps writing its
own code for everything else. No game has been switched over; existing games keep their own copies.

## Every game stays standalone

A game imports a module by relative path, exactly as 46 games already import `lib/round-bloom.js`:

```js
import { makeRng } from '../../lib/core/rng.js';      // from js/sim/game.js
import { Input } from '../lib/core/input.js';         // from js/main.js
```

When the game is exported for itch.io, [`dev/itch/export.mjs`](../../dev/itch/export.mjs) copies each
`/lib` file the game uses into the build's own `lib/` and rewrites the paths. It also follows a module's
own imports (`noise.js` brings `rng.js`), so the zip never reaches back into the repo. If you'd rather
freeze a game completely, copy the file into the game's `js/` instead; every module is a single file
whose only imports are siblings in this folder.

## The modules

| Module | Pure? | What it holds | Replaces (copies in the repo) |
|---|---|---|---|
| [rng.js](rng.js) | yes | `makeRng(seed, { hashSeed })` (mulberry32 with `int`, `pick`, `range`, `chance`, `state`, `setState`), `hash3`, `childSeed`, `hashSeed`, `hashStr` (FNV-1a), `cyrb32`, `shuffle`, `weighted`, `weightedItem` | `js/rng.js` in 79 games, `js/sim/rng.js` in 13 |
| [math.js](math.js) | yes | `clamp`, `clamp01`, `lerp`, `invLerp`, `remap`, `smoothstep`, `damp`, `approach`, `wrapAngle`, `angleDiff`, `turnToward`, `mod`, `dist`, `dist2`, `circleRect`, `segDist2` | `clamp` alone is redefined in 63 games, `lerp` in 34 |
| [noise.js](noise.js) | yes | `vnoise`, `fbm`, `ridged` (seeded, stateless) | value noise / fBm in 23 games |
| [grid.js](grid.js) | yes | `distanceField` (BFS, a flow field and a reachability proof), `reachable`, `floodFill`, `downhill`, `astar` (4- or 8-way, costs, no corner cutting, `nearest`), `MinHeap`, `lineCells`, `lineOfSight` | BFS proofs in ~20 games, A* in 16 |
| [loop.js](loop.js) | yes* | `makeStepper` (fixed step, accumulator, frame cap, `fast`), `debugFlags` (`?debug=1&fast=N`), `runFrames` (rAF with dt), `makeEventPump` (drain `G.events` to listeners, counting types) | the loop in every sim/view `main.js` (45 use `STEP = 1/120`) |
| [cloud.js](cloud.js) | browser | `makeCloud({ game, slot })`: cloud saves in the shared Supabase project, with **one sign-in for every game** (the session lives in `web-games.cloud`, refreshed once across tabs): `consumeRedirect`, `signIn(email)`, `signOut`, `upload(save, { version, summary, keepalive })`, `download`, `remove`, `listAll` (every game's saves), `onChange`. See [docs/generic/cloud-saves.md](../../docs/generic/cloud-saves.md) | game-147's own `js/cloud.js` (v1.2.0) |
| [cloud-ui.js](cloud-ui.js) | browser | `makeCloudUI(cloud, { getSave, applySave, summary, hasGame, version, … })`: the Cloud Save screen as a modal dialog (`open()`) or inside a game's own sheet (`mount(el)`), `boot()` for the return from the emailed link, `autosave({ keepalive })`. Styles injected once under `.wg-cloud` | game-147's cloud screen (v1.2.0) |
| [stats.js](stats.js) | browser | `playerCounts()` → `{ 'game-031': { players, plays } }` from the public `game_stats` table (cached an hour in `web-games.stats.cache`, only asked on the published site), `cachedCounts()`, `playersLabel(n)` → `'1.2k players'`. The counting side is [lib/plays.js](../plays.js). See [docs/generic/cloud-saves.md § Player counts](../../docs/generic/cloud-saves.md#player-counts) | the Pocket Garden's cartridges (console v1.7.0) |
| [store.js](store.js) | browser | `readJSON`, `writeJSON`, `removeKey`, `storageAvailable`, `makeSettings(key, defaults)`, `makeSaveSlot(key, { serialize, deserialize })`; nothing ever throws | `js/save.js` in 87 games |
| [input.js](input.js) | browser | `Input`: keys, gamepad, floating touch stick, finger-down buttons, action edges kept until a step consumes them, a FIFO of menu presses, named actions | `js/input.js` in 81 games |
| [audio.js](audio.js) | browser | `AudioCore` (context on first gesture, compressor, master/sfx/music buses, reverb send, noise buffer, `tone`, `noiseHit`, `thump`, `arp`, `free` throttle, iOS silent-switch unlock, `interrupted` resume, mute), `Sequencer` (look-ahead step clock), `mtof` | `js/audio.js` in 98 games |
| [viewport.js](viewport.js) | browser | `viewportSize`, `onViewportResize` (visualViewport, coalesced), `fitCanvas`, `toCanvas`, `coarsePointer` | visualViewport sizing in 77 games |
| [dom.js](dom.js) | browser | `$`, `$$`, `el`, `esc`, `toast` (text only, sent to `lib/a11y.js`'s live region), `fmtTime`, `fmtClock`, `fmtNum`, `hexToRgb`, `rgbToHex`, `mixHex`, `shade` | `toast` in 91 games, `esc` in 45 |

\* `loop.js` has no DOM in `makeStepper`, `debugFlags` (with an argument) or `makeEventPump`, so the
sim tests can use them; `runFrames` needs `requestAnimationFrame`. The pure modules may be imported
from `js/sim/` without breaking the sim/view rule; [dev/core/simtest.mjs](../../dev/core/simtest.mjs)
greps them for DOM, clock and `Math.random`.

## Drop-in compatibility

`makeRng`, `hash3`, `childSeed`, `vnoise` and `fbm` give the same numbers as the copies in the games, so a
game that switches its import keeps every seed's outcome and its old saves (`rngState` still applies):

- `makeRng(seed)` matches 62 of the 77 copies; `makeRng(seed, { hashSeed: true })` matches the 7 that
  scramble the seed first (games 126–135). Prefer `hashSeed: true` in a new game: seeds 1, 2, 3 then
  don't start alike. The other 8 (games 045–057) use an older object-state generator and are not
  drop-in.
- `hash3` matches 60 of the 61 copies; game-129 adds a second mixing round (its `hashInt`), so its numbers differ.
- `vnoise` and `fbm` match game-124/125's; games 063, 069 and 073 use a different noise (argument order
  `(x, z, seed)` and a [-1, 1] range) and are not drop-in.

`node dev/core/simtest.mjs` recomputes these numbers against the games on disk.

## Extending a module instead of forking it

```js
// js/audio.js in a game
import { AudioCore, Sequencer, mtof } from '../lib/core/audio.js';

export class Audio extends AudioCore {
    onInit() { this.seq = new Sequencer(this, { bpm: 96, onStep: (n, t) => this.beat(n, t) }); }
    beat(n, t) { if (n % 4 === 0) this.thump({ at: t, bus: this.music }); }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'pickup' && this.free('pickup', 0.04)) this.tone({ freq: 880, to: 1320, vol: 0.15 });
        }
    }
}
```

```js
// js/save.js in a game
import { makeSettings, makeSaveSlot } from '../lib/core/store.js';
import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

export const settings = makeSettings(SAVE_KEY + '.settings', { sfx: 0.8, music: 0.6, touch: 'auto' });
export const slot = makeSaveSlot(SAVE_KEY, { serialize, deserialize });
```

```js
// js/main.js: two actions, the fixed step and the event drain
import { Input } from '../lib/core/input.js';
import { makeStepper, debugFlags, makeEventPump } from '../lib/core/loop.js';

const { DEBUG, FAST } = debugFlags();
const input = new Input({ actions: { a: ['Space', 'KeyZ', 'KeyJ'], b: ['KeyX', 'KeyK'] } });
const stepper = makeStepper({ step: STEP, maxFrame: MAX_FRAME, fast: FAST });
const pump = makeEventPump((G, ev) => view.onEvents(G, ev), (G, ev) => audio.onEvents(G, ev));
// in the frame: stepper.advance(dt, (s) => { step(G, input.state(), s); input.consumeEdges(); }); pump.drain(G);
```

## Rules for this folder

1. **No dependencies.** No npm packages, no CDN imports, no three.js. A module may import only a sibling
   here, by `./name.js`.
2. **One file per module, ES module syntax, plain JS.** The exporter copies files as they are.
3. **Don't change what a function returns.** Games and saves rely on `makeRng` and the hashes giving the
   same numbers. Add a new function or an option instead, and keep `dev/core/simtest.mjs` green.
4. **Fix a bug here and in the doc.** If a game finds a bug in a module, fix it here, add a test, and note
   it in [docs/common-core.md](../../docs/common-core.md) so the games still carrying their own copy can
   be checked.
5. **Test both harnesses:** `node dev/core/simtest.mjs`, and `node dev/core/browsertest.mjs` with a server
   on the repo root.
