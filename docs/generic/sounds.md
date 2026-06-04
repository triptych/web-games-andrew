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

## References

- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [game-001 source code](game-001/index.html)
- [game-002 source code](game-002/index.html)
- Game configurations: [game-001/gemcore.config.json](game-001/gemcore.config.json) | [game-002/gemcore.config.json](game-002/gemcore.config.json)
