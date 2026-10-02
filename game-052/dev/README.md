# Nightline — dev harnesses

Plain Node scripts, no build step, no test framework. They need `playwright` and a
static server run from the **repo root**:

```bash
python3 -m http.server 8050
```

| Command (from the repo root) | What it does |
|---|---|
| `node game-052/dev/browsertest.mjs` | Real Chromium + WebGL + three.js r165. Desktop: title → start → ↑/S change the cruise speed → ← changes lane once clear, and waits with the blinker when a car is alongside → R / Shift+R tune the radio → C cycles all four cameras → H hides the dash → **Z drift mode, fast-forwarded for 900 s of sim** (~12 km), checked every step: finite positions, nobody overlapping anybody in a lane (you vs traffic and traffic vs traffic), chunks bounded, scene object count bounded, stops visited, several districts, a patrol spinner → a hand-driven pull-over (prompt, E, blinker, into the bay, the parked card, a line of description, the stop's action, the night log, E to drive back out) → menu (resolution, retro filter, night log tab) → P downloads a photo → every district renders a non-black frame. Phones at 390×844 and 844×390, touch only: a tap starts, every control is on screen and ≥ 40 px, ◀ and + work, tapping the prompt pulls over, the parked card fits, Drive on works. Fails on any console error or warning, page error or failed request. Screenshots go to `dev/shots/`. `ONLY=desktop` / `ONLY=phones`, `DRIVE=3000` for a ~40 km drive. |
| `node game-052/dev/shots.mjs out.png [w] [h]` | One screenshot. `EVAL='…'` runs code first (`__nl` hooks below), `WAIT=ms`, `START=0` stays on the title, `Q=lofi\|mid\|hi\|crisp`, `SEED=…`, `INFO='…'` prints an expression afterwards. |
| `node game-052/dev/contact.mjs out.png cols width a.png b.png …` | Tiles screenshots into one contact sheet. |

If `import 'playwright'` fails because it is installed globally, link it:
`mkdir -p game-052/dev/node_modules && ln -s "$(npm root -g)/playwright" game-052/dev/node_modules/playwright`.

No network to unpkg.com? Fetch three.js once and the browser scripts serve the CDN
requests from disk — still the genuine r165:

```bash
cd game-052/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) renders at a few frames per second, so the tests drive
the simulation with `__nl.sim(seconds)` instead of waiting on wall-clock time.

## Debug hooks

Load the game with `?debug=1` (and optionally `&seed=anything` for a repeatable city) to get `window.__nl`:

| Hook | Effect |
|---|---|
| `__nl.start()` | Leave the title screen |
| `__nl.sim(seconds, dt = 1/30, onStep)` | Run the simulation without rendering |
| `__nl.teleport(s)` | Put the car at arc length `s`, driving, in the curb lane |
| `__nl.nextStop()` | Jump to 120 m before the next stop |
| `__nl.parkAt(type)` | Park at the next stop of a type (`noodle`, `diner`, `charge`, `overlook`, `konbini`, `records`, `arcade`, `motel`, `laundry`, `pier`) |
| `__nl.districts()` | `[type, start, end]` for every district generated so far |
| `__nl.renderNow()` / `__nl.luminance()` | Render a frame now / render and return its mean brightness |
| `__nl.car`, `road`, `city`, `traffic`, `rig`, `weather`, `audio`, `pipeline`, `ui`, `state`, `settings`, `U`, `M` | The live objects |

## Numbers (SwiftShader, seed `browsertest`)

- One chunk builds in ~3 ms. A frame is ~150 draw calls and ~32 k triangles across the reflection and main passes, plus ~2 k glow points and the rain.
- 3,000 s of drift mode: 38 km, 14 stops, all five districts, minimum same-lane spacing to you 11.5 m, never more than 11 chunks, scene object count flat (≈170–195).

## Bugs the harness caught

- **Stops vanished for kilometres.** Stops are placed up to 1.2 km ahead but districts were only generated 400 m ahead, so a stop's district lookup returned the wrong (earlier) district, failed its "fits inside the district" test twelve times and gave up. Districts are now generated 3 km ahead.
- **Oncoming cars drove through each other.** Only our side of the road ran the following rule; it now runs for both directions.
- **A fast car from behind could hit you mid lane change.** The gap check was a fixed 13 m. It now grows with the closing speed (and merging out of a stop uses the same rule from a standstill).
