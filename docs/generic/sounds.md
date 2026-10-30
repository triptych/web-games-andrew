# Sound Design Documentation



## Overview



Every game uses **procedurally generated** sounds created with the Web Audio API. No audio files are used; instead, all sound effects are synthesized in real-time using oscillators, envelopes, noise generators, and audio processing nodes. This approach keeps the games lightweight and eliminates the need for external audio assets. See the game-024 section below for the current reusable module shape.



---



# game-001: Space Shooter



## Sound Effects



### 1. Laser Shoot Sound

**Triggered when:** Player fires a bullet



**Technical Implementation:**

- **Oscillator Type:** Sawtooth wave

- **Frequency:** 800 Hz → 200 Hz (exponential drop)

- **Duration:** 0.1 seconds

- **Volume:** 0.15 → 0.01 (exponential fade)

- **Purpose:** Creates a classic "pew pew" laser sound effect



**Code Reference:** [index.html:21-38](game-001/index.html#L21-L38)



### 2. Explosion Sound

**Triggered when:** A bullet hits an enemy



**Technical Implementation:**

- **Primary Component:** White noise buffer (0.3 seconds)

- **Filter:** Lowpass filter, 1000 Hz → 100 Hz

- **Volume:** 0.3 → 0.01 (exponential fade)

- **Secondary Component:** Bass sine wave

  - Frequency: 100 Hz → 30 Hz

  - Volume: 0.4 → 0.01

- **Purpose:** Creates a realistic explosion with both noise and bass impact



**Code Reference:** [index.html:40-77](game-001/index.html#L40-L77)



### 3. Player Death Sound

**Triggered when:** Player collides with an enemy (game over)



**Technical Implementation:**

- **Oscillator Type:** Sawtooth wave

- **Notes:** Five descending tones [500, 400, 300, 200, 100 Hz]

- **Each note:** Drops to 50% of starting frequency

- **Timing:** 0.1 seconds between notes

- **Volume:** 0 → 0.2 → 0.01 (attack-decay per note)

- **Additional:** White noise explosion overlay (0.5 seconds)

- **Filter:** Lowpass 800 Hz → 50 Hz

- **Purpose:** Creates a dramatic, descending death sequence with explosion



**Code Reference:** [index.html:79-130](game-001/index.html#L79-L130)



### 4. Power-Up Sound

**Triggered when:** Score reaches a milestone (every 100 points)



**Technical Implementation:**

- **Oscillator Type:** Square wave

- **Notes:** Ascending arpeggio [400, 500, 600, 800 Hz]

- **Timing:** 0.05 seconds between notes

- **Duration:** 0.15 seconds per note

- **Volume:** 0 → 0.1 → 0.01 (attack-decay)

- **Purpose:** Positive reinforcement for reaching score milestones



**Code Reference:** [index.html:132-152](game-001/index.html#L132-L152)



### 5. Enemy Spawn Sound

**Triggered when:** A new enemy appears



**Technical Implementation:**

- **Oscillator Type:** Triangle wave

- **Frequency:** 150 Hz → 100 Hz (descending)

- **Duration:** 0.1 seconds

- **Volume:** 0.05 → 0.01 (very subtle)

- **Purpose:** Subtle audio cue for enemy appearance without overwhelming



**Code Reference:** [index.html:154-169](game-001/index.html#L154-L169)



### 6. Game Start Sound

**Triggered when:** Game begins or restarts



**Technical Implementation:**

- **Oscillator Type:** Square wave

- **Notes:** Energetic ascending sequence [300, 400, 500, 700 Hz]

- **Timing:** 0.08 seconds between notes

- **Duration:** 0.12 seconds per note

- **Volume:** 0 → 0.15 → 0.01 (attack-decay)

- **Purpose:** Upbeat, energetic sound to start the action



**Code Reference:** [index.html:171-190](game-001/index.html#L171-L190)



---



# game-002: Match-3 Puzzle



## Sound Architecture



### Audio Context Initialization



The game uses a custom `SoundFX` module that creates an `AudioContext` on initialization:



```javascript

audioContext: new (window.AudioContext || window.webkitAudioContext)();

```



The audio context is automatically resumed when needed to handle browser autoplay policies.



## Sound Effects



### 1. Select Sound

**Triggered when:** A gem is selected by the player



**Technical Implementation:**

- **Oscillator Type:** Sine wave

- **Frequency:** 800 Hz → 600 Hz (exponential ramp)

- **Duration:** 0.05 seconds

- **Volume:** 0.15 → 0.01 (exponential fade)

- **Purpose:** Creates a soft, pleasant click sound



**Code Reference:** [index.html:43-60](game-002/index.html#L43-L60)



### 2. Swap Sound

**Triggered when:** Two gems are swapped



**Technical Implementation:**

- **Oscillator Type:** Triangle wave

- **Frequency:** 400 Hz → 600 Hz (linear ramp)

- **Duration:** 0.1 seconds

- **Volume:** 0.2 → 0.01 (exponential fade)

- **Purpose:** Creates a swooshing sound for gem movement



**Code Reference:** [index.html:62-80](game-002/index.html#L62-L80)



### 3. Match Sound

**Triggered when:** Gems are matched (3 or more)



**Technical Implementation:**

- **Oscillator Types:** Dual oscillators (sine + triangle)

- **Base Frequency:** 400 Hz + (matchSize - 3) × 100 Hz

- **Frequency Ramp:** Base → Base × 1.5 (exponential)

- **Duration:** 0.15 seconds

- **Volume:** 0.15 → 0.01 per oscillator

- **Special Feature:** Sound pitch increases with larger match sizes

- **Layering:** Two oscillators offset by 0.02 seconds create a richer sound

- **Purpose:** Provides audio feedback that scales with match size



**Code Reference:** [index.html:82-105](game-002/index.html#L82-L105)



### 4. Invalid Swap Sound

**Triggered when:** An invalid swap is attempted (no match created)



**Technical Implementation:**

- **Oscillator Type:** Sawtooth wave

- **Frequency:** 200 Hz → 150 Hz (descending)

- **Duration:** 0.15 seconds

- **Volume:** 0.1 → 0.01

- **Purpose:** Creates a low "error" buzzing sound to indicate failure



**Code Reference:** [index.html:107-125](game-002/index.html#L107-L125)



### 5. Fall Sound

**Triggered when:** Gems fall due to gravity



**Technical Implementation:**

- **Oscillator Type:** Sine wave

- **Frequency:** 800 Hz → 200 Hz (steep exponential drop)

- **Duration:** 0.2 seconds

- **Volume:** 0.08 → 0.01

- **Purpose:** Creates a descending "falling" sound effect



**Code Reference:** [index.html:127-145](game-002/index.html#L127-L145)



### 6. Game Over Sound

**Triggered when:** The player runs out of moves



**Technical Implementation:**

- **Oscillator Type:** Sine wave

- **Notes:** Four descending tones [400, 350, 300, 250 Hz]

- **Timing:** Each note plays 0.15 seconds apart

- **Volume:** 0 → 0.15 → 0.01 (attack-decay envelope per note)

- **Duration:** Total ~0.6 seconds

- **Purpose:** Creates a sad, descending melody indicating game end



**Code Reference:** [index.html:147-170](game-002/index.html#L147-L170)



### 7. New Game Sound

**Triggered when:** A new game starts



**Technical Implementation:**

- **Oscillator Type:** Sine wave

- **Notes:** Four ascending tones [300, 400, 500, 600 Hz]

- **Timing:** Each note plays 0.1 seconds apart

- **Volume:** 0 → 0.12 → 0.01 (attack-decay envelope per note)

- **Duration:** Total ~0.4 seconds

- **Purpose:** Creates an uplifting, ascending melody for game start



**Code Reference:** [index.html:172-195](game-002/index.html#L172-L195)



## Design Philosophy



### Why Procedural Audio?



1. **Zero Asset Loading:** No audio files means faster initial load times

2. **Tiny Footprint:** The entire sound system adds minimal code overhead

3. **Dynamic Scaling:** Match sound adjusts based on match size automatically

4. **Browser Compatibility:** Web Audio API is widely supported across modern browsers



### Sound Design Principles



1. **Feedback Clarity:** Each action has a distinct sound

   - High frequencies for selection (800 Hz)

   - Mid frequencies for swaps (400-600 Hz)

   - Low frequencies for errors (150-200 Hz)



2. **Volume Control:** All sounds use moderate volumes (0.08-0.2 peak) to avoid overwhelming the player



3. **Envelope Shaping:** Exponential decay creates natural-sounding audio tails



4. **Musical Sequences:** Game state changes (new game, game over) use melodic sequences rather than single tones



## Technical Notes



### Browser Autoplay Policy



The audio context may start in a "suspended" state due to browser autoplay restrictions. The `resume()` method is called before each sound effect to ensure the audio context is active:



```javascript

if (this.audioContext.state === 'suspended') {

    this.audioContext.resume();

}

```



### Performance Considerations



- Each sound effect creates temporary oscillator and gain nodes

- Nodes are automatically garbage collected after they stop

- No persistent audio resources are held in memory

- Multiple sounds can overlap without conflicts



## Future Enhancements



Possible improvements to the sound system:



1. **Volume Controls:** Add user-configurable volume settings

2. **Mute Toggle:** Allow players to disable sounds

3. **Additional Effects:** Add filters or reverb for richer sounds

4. **Combo Sounds:** Special audio for chain reactions

5. **Background Music:** Add an optional looping background track



---



# game-024: Neon Vanguard (reusable helper-trio pattern)



By game-024 the procedural-sound module had settled into a clean, copyable shape worth reusing for new games: **three small primitives** plus a thin set of named effect functions built from them. A `startDelay` argument on every primitive makes arpeggios and layered hits trivial (just call it N times with staggered delays).



```js

let audioCtx = null, masterGain = null, _enabled = true;



export function initAudio() {                 // call on the FIRST user gesture

    if (audioCtx) return;                      // idempotent

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();

    masterGain.gain.value = 0.25;              // one master volume knob

    masterGain.connect(audioCtx.destination);

}



// Constant-pitch tone with exponential gain decay.

function _osc(type, freq, dur, vol = 0.3, delay = 0) { /* osc + gain → masterGain */ }

// Pitch glide from freqStart → freqEnd (lasers, hits, game-over).

function _sweep(type, f0, f1, dur, vol = 0.3, delay = 0) { /* frequency.exponentialRampToValueAtTime */ }

// White-noise burst (explosions, impacts) — fill an AudioBuffer with Math.random()*2-1.

function _noise(dur, vol = 0.15, delay = 0) { /* bufferSource + gain → masterGain */ }

```



Effects are then one-liners, and layering = calling two primitives together:



```js

export const playShoot     = () => _sweep('square', 880, 440, 0.08, 0.12);

export const playExplosion = () => { _sweep('sawtooth', 300, 60, 0.25, 0.3); _noise(0.25, 0.18); };  // tone + noise

export const playWaveStart = () => [523, 659, 784, 1047].forEach((f, i) => _osc('triangle', f, 0.15, 0.18, i * 0.07));  // arpeggio via delay

```



**Reusable takeaways:**

- The `_osc` / `_sweep` / `_noise` trio covers essentially every retro SFX. Copy this file as the starting point for new games.

- `startDelay` on each primitive is what makes arpeggios (`playWaveStart`) and multi-burst death sounds (`playBossWarn`) trivial — no scheduling code.

- Keep one `masterGain` so a single value mutes/balances everything; expose `setSoundEnabled` / `toggleSound`.

- `initAudio()` must run on the first user gesture (browser autoplay policy) and be idempotent.

- Make player vs. enemy variants of the same action *read differently* — `playShoot` is a bright square sweep, `playEnemyShoot` a lower, harsher sawtooth sweep.



---



## Cross-Game Sound Design Principles



### Frequency Psychology

- **High frequencies (600-800+ Hz):** Quick actions, selection, positive feedback

- **Mid frequencies (300-600 Hz):** Movement, swapping, neutral actions

- **Low frequencies (100-300 Hz):** Threats, errors, negative feedback

- **Bass (<100 Hz):** Impact, explosions, dramatic events



### Wave Type Characteristics

- **Sine waves:** Pure, soft, musical tones (melodies, gentle feedback)

- **Triangle waves:** Mellow, subtle tones (background cues, ambient)

- **Square waves:** Bright, retro, electronic (8-bit style, power-ups)

- **Sawtooth waves:** Harsh, buzzy, aggressive (lasers, errors, alarms)

- **White noise:** Chaotic, realistic (explosions, impacts, destruction)



### Volume Guidelines

- **Background/ambient:** 0.05-0.08 (enemy spawns, falling gems)

- **Regular actions:** 0.10-0.20 (shooting, selecting, swapping)

- **Important events:** 0.20-0.40 (explosions, matches, player death)

- **Always use exponential ramps** for natural-sounding decay



### Game-Specific Approaches



**Space Shooter (game-001):**

- Uses noise generators for realistic explosions

- Employs sawtooth waves for aggressive laser sounds

- Combines oscillators with filters for rich effects

- Lower volume for frequent events (enemy spawns: 0.05)

- Higher impact for destruction (explosions: 0.3-0.4)



**Match-3 Puzzle (game-002):**

- Pure tones (sine/triangle) for pleasant, non-aggressive feedback

- Musical sequences for game state changes

- Dynamic pitch based on match size

- Layered oscillators for richer sounds

- Consistent moderate volumes (0.08-0.20)



**Island Walker (game-036) — continuous ambience for an exploration game:**



A walking sim has no combat to carry the audio, so the soundscape has to be a

continuous bed rather than a set of event stingers. Two techniques:



*Looping wind from filtered noise* — one buffer, one filter, started once and

left running. Cheap, and never loops audibly because noise has no features:

```js

const src = ctx.createBufferSource();

src.buffer = noiseBuffer(4);       // 4s of white noise

src.loop = true;

const filter = ctx.createBiquadFilter();

filter.type = 'lowpass';

filter.frequency.value = 380;      // low cutoff => wind, not hiss

const gain = ctx.createGain();

gain.gain.value = 0.05;            // must sit under everything else

src.connect(filter); filter.connect(gain); gain.connect(masterGain);

src.start();

```



*Randomly-scheduled birdsong* — a self-rescheduling `setTimeout` with a wide

random interval reads as a living environment; a fixed interval reads as a

machine:

```js

function chirpLoop() {

    const base = 1400 + Math.random() * 800;

    _osc('sine', base, 0.09, 0.04);

    _osc('sine', base * 1.3, 0.07, 0.03, 0.08);   // slight delay = two notes

    setTimeout(chirpLoop, 3000 + Math.random() * 6000);

}

```



*Footsteps driven by distance, not time* — tie the trigger to accumulated

movement so cadence automatically matches walking vs sprinting:

```js

this._footstepDist += distanceMovedThisFrame;

if (this._footstepDist > 2.2) { this._footstepDist = 0; playFootstep(); }

```



*Progress cue* — a rising three-note chord (392 / 523 / 659 Hz, staggered 50 ms)

for "this counted" moments like shelving a book. Distinct from the pickup blip,

so the two stages of a collect-and-return loop sound different.



## Emulating the Atari 2600 TIA (game-039)



The TIA's character comes from **coarse frequency resolution**, not from the

waveform. It could only emit a fixed set of divided frequencies, so notes land

slightly out of tune and chords beat against each other. Reproduce that by

quantising every pitch before playing it:



```js

function quantise(freq) {

    const step = 24;                                  // coarse divider grid

    return Math.max(40, Math.round(freq / step) * step);

}

```



That one line does more for the period feel than any choice of oscillator.



**Noise** should be sample-and-hold rather than white: hold each random value

for a few samples, which is grittier and much closer to the TIA's polynomial

counter.



```js

let hold = 0;

for (let i = 0; i < len; i++) {

    if (i % 3 === 0) hold = Math.random() * 2 - 1;

    data[i] = hold;

}

```



**Make the score audible.** Pitch the collect sound by the current combo

(`340 + chain * 46`) so the player hears a rising run while doing the skilled

thing. It teaches the scoring system without any UI.



**Rate-limit continuous effects.** A sound tied to something emitted every few

frames (a trail, a thruster) becomes a drone and then becomes fatigue. Play

every Nth event instead — game-039 ticks once per five echoes at gain 0.035.



---



## References



- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

- [game-001 source code](game-001/index.html)

- [game-002 source code](game-002/index.html)

- Game configurations: [game-001/gemcore.config.json](game-001/gemcore.config.json) | [game-002/gemcore.config.json](game-002/gemcore.config.json)




---

## Driving music from the simulation clock (game-040 Starcadet)

If enemies are supposed to attack "on the beat", do not time the music against the gameplay — make
both read the same clock. Starcadet's world owns a beat counter (`beatInterval = 60 / level.bpm`)
and emits a `beat` event; the audio layer plays a bar step on that event, and any attack flagged
`onBeat` fires on the same index. The Choirmaster's patterns land on the downbeat *by construction*,
and the backdrop shader pulses off the same value.

```js
// sim: one place decides what a beat is
w.beatT += dt;
while (w.beatT >= w.beatInterval) { w.beatT -= w.beatInterval; w.beatIndex++; w.fx('beat', { index: w.beatIndex }); }

// audio: the "music" is just a reaction to it
export function onBeat(index) {
    const beatInBar = index % 8;
    if (beatInBar === 0 || beatInBar === 4) tone({ freq: root, type: 'sawtooth', dur: 0.28, glide: 0.98 });
    if (beatInBar % 2 === 0) noise({ dur: 0.11, freq: 260 });          // kick
    else noise({ dur: 0.05, freq: 7000, type: 'highpass' });           // hat
    tone({ freq: root * 2 * 2 ** (scale[(index * 3 + bar) % scale.length] / 12), type: 'square', dur: 0.16 });
}
```

Per-level mood costs one lookup table each: a root note and a five-note scale (Starcadet's get
darker as the game climbs the tether). A single detuned drone bed underneath, started once and left
running, ties the whole thing together and costs nothing per frame.

Two practical notes: keep one shared noise `AudioBuffer` for every impact sound rather than
allocating per shot, and route SFX and music through separate gain nodes so the options screen can
mute one without the other.


---

## Look-ahead sequenced synthwave with side-chain pump (game-045 PINBREAK '86)

`setTimeout`-driven notes drift whenever the frame rate stutters. game-045 uses the "two clocks"
pattern: a 25 ms `setInterval` schedules every 16th note that falls within the next 120 ms **on the
AudioContext clock**, so timing is sample-accurate however busy the main thread is.

```js
function scheduler() {
    if (nextTime < ctx.currentTime - 0.2) {            // tab was backgrounded: skip, don't cram
        const skip = Math.ceil((ctx.currentTime - nextTime) / STEP);
        step += skip; nextTime += skip * STEP;
    }
    while (nextTime < ctx.currentTime + 0.12) { playStep(step, nextTime); nextTime += STEP; step++; }
}
```

- **The synthwave "pump"**: route bass and pad through one gain node and, on every kick, drop it
  to 0.35 and ramp it back to 1 over most of a beat
  (`pump.gain.setValueAtTime(0.35, t); pump.gain.linearRampToValueAtTime(1, t + SPB * 0.8)`). This
  one automation is most of the genre's feel.
- **Layers follow the game**: intensity 0 = pad + octave bass (title), 1 = + kick/snare/hats, 2 =
  + arpeggio (combo ×3 or multiball), 3 = + lead stabs. Switching layers at a step boundary never
  clicks.
- **Visuals on the same clock**: `getBeatPulse()` returns `exp(-phase * 5)` where
  `phase = ((ctx.currentTime - musicStart) / SPB) % 1`. The sun, grid, sky and table pulse exactly on
  the kick.
- **Make the combo audible**: brick-break notes walk a pentatonic scale indexed by the chain count
  (`64 + PENTA[i % 5] + 12 * floor(i / 5)`), so a long chain is a rising run. A per-sound rate
  limiter (`limit(key, 0.025)`) stops a 30-brick explosive chain stacking 30 voices.
- A `DynamicsCompressor` on the master bus keeps blasts, the pump and big chords from clipping.


---

## Sim-stamped events on the audio clock (game-060 BRICKVADERS)

Driving music from sim `beat` events (game-040) jitters by up to a frame, because a frame's sim
steps all run at once. game-060 stamps every event with its sim time and maps it onto the
AudioContext clock with a fixed latency, so the notes come out evenly spaced again:

```js
for (const e of world.events) {
    const at = audio.now + 0.06 + (e.t - world.time);   // e.t <= world.time, the offset is ≤ one frame
    if (e.type === 'beat') audio.beat(e.i, e.interval, e.song, e.march, at); else audio.onEvent(e, at);
}
```

There the formation steps on every beat and the beat interval shrinks as invaders die, so **the
march is the bassline**: four descending notes (`[0, -2, -3, -5]` under the bar's chord) on every
step, plus kick/snare/hats, a pad per bar and a pulse lead from a 32-step table. The whole song
speeds up with the Space Invaders heartbeat, and the lead plays on every other step once a beat is
shorter than 110 ms. Menus run the same `beat()` from a fixed-interval clock in `main.js`.

---

## Generated melodies and an arcade around you (game-075 CHROME CHALICE)

[game-075/js/music.js](../../game-075/js/music.js) stores each song as data — key, tempo, a progression of chord symbols (`'i', 'VI', 'Imaj7', 'V7'`) and a seed — and composes the rest on first play:

- **Chords** from Roman numerals: degree from the numeral, major/minor from its case, `7`/`maj7` add the seventh, all relative to the song's scale.
- **The lead**: two one-bar rhythms drawn from per-step onset weights (downbeats likely, off-16ths rare). Each bar's pitches are fitted to that bar's chord: strong steps snap to the nearest chord tone around a target that follows a seeded contour, weak steps to the nearest scale tone, with a pull back inside the range. Bars are arranged A A′ B A, and the last note of the cycle lands on the root, so the 8-bar loop resolves.
- **Layers by context**: pad + bass in vaults (`calm`), no lead in dark rooms, an extra hat when a dragon is chasing. When THE NULL is close, steps randomly drop the music bus for a step (stutter) and the arp and lead detune — the glitch is in the score, not a separate sound.
- **Gated reverb** for the snare is just an impulse that stays flat and then cuts dead:
  ```js
  d[i] = (Math.random() * 2 - 1) * 0.6 * (i < n * 0.92 ? 1 : 1 - (i - n * 0.92) / (n * 0.08));   // 0.26 s
  ```
- **The arcade around the cabinet** is its own bus: looped noise through a 520 Hz band-pass with a slow LFO (crowd murmur), and every 1.4–5 s a quiet, low-passed, hard-panned event from "another machine" — an attract-mode bleep run, a distant explosion, a coin drop. It sells the room far more than its cost, and has its own on/off option.

## A 1987 PC: keyboard clacks, a PC speaker and a floppy drive (game-094 THE LONG HELIX)

[game-094/js/audio.js](../../game-094/js/audio.js) makes an old computer out of one second of noise and a few oscillators. Everything runs through one `burst()` (looped noise through a biquad with a decay envelope) and one `tone()` (an enveloped oscillator).

- **A key**: a 16 ms bandpassed noise burst at a random 2.6 to 5.4 kHz (the click) plus a 30 ms sine falling from about 170 Hz to 60 Hz (the thud). A space or return is lower and heavier. Rate-limit it to one per 22 ms or the typewriter's 260 characters a second turns into a buzz.
- **The PC speaker**: a square wave through a 3.5 kHz low-pass at low volume, 30 to 70 ms. Menus, pick-ups and dice are all just the same beep at different pitches; dice are five random beeps 45 ms apart, then up (success) or down (failure).
- **A floppy drive** has three parts. The spindle: looped noise through a 220 Hz bandpass, gain ramping up over 80 ms and down at the end. The head stepping: a train of a 95 to 120 Hz square buzz (22 ms, low-passed at 900 Hz) with a 3.5 kHz noise tick on top, one every 44 ms and jittered by 12 ms, which is the "brrrt" a seek makes. The settle: a falling sine and a low noise thump at the end. A scene load is 5 to 8 steps, a save 11 slower ones, the boot 26.
- **A monitor's hum** is a 60 Hz and a 120 Hz sine at gain 0.05, under everything.
- **A gesture is needed before any of it plays**, so the game opens on a black "press any key to switch on the monitor" screen. The power-on press is the gesture, and the boot show can then be heard.

---

# game-109: STARBLAZER '86 (a chiptune engine)

A console-shooter sound set in about 400 lines, no files. See [audio.js](../../game-109/js/audio.js).

- **Pulse waves with real duty cycles.** `createPeriodicWave(real, imag)` with, for harmonic k, `a = 2/(kπ) · sin(kπd)`, `real = a·cos(kπd)`, `imag = a·sin(kπd)` gives the NES's 12.5%, 25% and 50% pulses (a hollow, thin or full square). Use 12.5% for arpeggios (it cuts through), 25% for leads and effects, 50% for pads and bonus-stage melodies, a triangle for the bass, and a low-passed sawtooth for a boss riff.
- **One 16th-note look-ahead sequencer, several tunes.** `playStep(step, time)` per mode (`play`, `boss`, `bonus`), a 25 ms timer scheduling 120 ms ahead; changing mode or sector restarts the step counter. Intensity is the layer count: bass and arpeggio at 1, drums at 2, a lead at 3, chord pads and hats at 4, and the level follows the wave within a sector (1 to 4), so each sector builds and then breaks into the boss tune.
- **A key per sector, a boss tune per boss.** Sectors are four minor keys with a four-chord loop (i VI III VII and cousins); the lead is a seeded walk on the minor pentatonic (stepwise, with a chord tone on the strong beats and bar ends), which sounds right over any chord of the key and is the same every run. Boss tunes are faster (172 BPM against 148), a chromatic sawtooth riff on the root and a 16th-note arpeggio; the bonus stage is a 162 BPM major pentatonic bounce.
- **Rate-limit by name.** A boss death fires dozens of booms in two seconds: `ready(name, gap)` drops any sound of that name inside its gap (35 ms for small booms, 50 ms for medium, 70 ms for large; shots 55 ms, enemy shots 90 ms), and the biggest boom is never limited.
- **Explosion size is the dial.** Small: a 2.2 kHz noise tick and a 320-to-70 Hz square drop. Medium: 0.3 s of 1.5 kHz noise and a sawtooth sweep. Large: 0.55 s of noise, a sawtooth sweep and a 70 Hz sine thud. Boss: 1.6 s of noise with a sweeping low-pass, a second band-passed layer, a sawtooth sweep from 220 Hz to 25 Hz, a sub sine and a descending arpeggio on top.
- **Warnings are tones.** A boss warning is five alternating 440/660 Hz sawtooth sweeps; a beam telegraph is four 1.76 kHz beeps; a bomb is a band-passed noise sweep from 300 Hz to 4 kHz, a rising sawtooth and a seven-note arpeggio; medals rise in pitch with the chain you have built.

