# Wakeform — changelog

## Initial build

Vanilla HTML/CSS/JS, no libraries, no asset files. 160x192 internal buffer
scaled with nearest-neighbour, 2:1 pixel aspect, generated 8-colour palette
sampled from the real Atari 2600 NTSC ramp.

### The mechanic
- Probe with one verb: invert polarity.
- Movement continuously sheds **echoes** — frozen copies holding the polarity
  the probe had at that instant — which exert the same force the probe does.
- Like polarity repels, opposite attracts and absorbs.
- Flux economy: echoes and flips cost, reclaiming your own echoes refunds.
- Five mote classes (drifter, splitter, inverter, leech, anchor), each aimed at
  a different weakness in a lattice.
- Chains reward harvesting a trap in one pass.

### Bugs found and fixed during development

These were caught by the Node harnesses in `dev/`, before the game ever ran in
a browser.

1. **The probe ate its own wake.** `ECHO_RECLAIM_R` (4.5px) is wider than
   `ECHO_MIN_GAP` (3.4px), so every echo was reclaimed on the frame after it
   was laid and no lattice could ever form — the core mechanic did not work at
   all. Fixed with `RECLAIM_MIN_AGE`, a 0.45s window before an echo becomes
   reclaimable.

2. **Negative modulo crashed the core sprite.** `app.time` drifted a hair below
   zero through floating-point accumulation, and JavaScript `%` keeps the sign
   of the dividend, so `Math.floor(time * 6) % 4` returned `-1` and
   `drawImage` received `undefined`. Fixed by flooring `dt` at zero and routing
   cyclic frame lookups through `frameIndex()`.

3. **Pause was a trap.** Two `keydown` listeners were registered — game input
   and menu input — and the menu one ran first. Escape closed the pause screen,
   then the input listener saw the same event with no screen open and queued
   another pause, reopening it immediately. Fixed by tagging the event
   (`__menuHandled`) so the second listener knows a menu already consumed it.

4. **A good player could stall the game forever.** Waves ended only when the
   board cleared, so trapping motes indefinitely froze the run at wave 1 with
   no way to lose or progress — the balance probe survived 300s at wave 1.
   Fixed with `DRAIN_GRACE`: once a wave has spawned, a 12s window to clear it,
   after which the next wave arrives anyway and the clear bonus is withheld.

5. **Echoes could stack on one spot.** The min-gap check scanned the full echo
   list and only early-returned on a same-polarity neighbour, letting opposite
   ones pile up. Rewritten to use the spatial hash and to overwrite rather than
   stack.

### Balance

Tuned against scripted bots rather than guesswork (`dev/balance.mjs`):

| strategy | wave | score | best chain | deaths |
|---|---|---|---|---|
| idle | 1.6 | 96 | – | 5/5 |
| chaser | 12.8 | 95568 | – | 3/5 |
| shepherd | 12.0 | 85486 | 40 | **2/5** |

The shepherd — which uses the wake as an active tool, approaching motes from
the core side at matching polarity to shove them outward while laying a wall —
reaches the maximum chain and has the best survival rate. Raw chasing scores
marginally higher but dies more often, which is the intended trade.

Early waves were softened (`difficultyFor` ramps only from wave 3, wider spawn
spacing) after the probe showed an idle player lost containment in 16s, leaving
no room to learn. Now ~30s.

A wall of echoes spans roughly 26px of a ring about 540px around, so the board
can never be fully fenced. That coverage limit is deliberate: it forces the
player to read where motes are coming from and commit their flux there.
