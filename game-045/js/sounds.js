/**
 * sounds.js — procedural Web Audio: sound effects and a synthwave soundtrack.
 * No audio files. Call initAudio() on the first user gesture (browser policy).
 *
 * Music is a look-ahead step sequencer (the "two clocks" pattern): a 25 ms
 * timer schedules 16th notes ~120 ms ahead on the AudioContext clock, so the
 * groove stays tight even when the frame rate stutters. getBeatPulse() reads
 * the same clock so the visuals pulse exactly on the kick.
 *
 * Intensity layers: 0 = pad + bass (title), 1 = + drums (play),
 * 2 = + arpeggio (combo ×3 or multiball), 3 = + lead stabs (fever).
 */

let ctx = null;
let master, sfxBus, musicBus, pump, comp;
let noiseBuf = null;
let _enabled = true;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = _enabled ? 0.7 : 0;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.34;
    pump = ctx.createGain();            // side-chain style ducking on every kick
    pump.connect(musicBus);
    musicBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function isSoundEnabled() { return _enabled; }
export function toggleSound() {
    _enabled = !_enabled;
    if (master) master.gain.setTargetAtTime(_enabled ? 0.7 : 0, ctx.currentTime, 0.05);
    return _enabled;
}
export function setSoundEnabled(v) { if (v !== _enabled) toggleSound(); }

// ============================================================
// Primitives
// ============================================================

const now = () => ctx.currentTime;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Rate limiter so a 30-brick chain doesn't stack 30 identical voices.
const lastPlay = new Map();
function limit(key, gap) {
    if (!ctx) return false;
    const t = ctx.currentTime;
    if ((lastPlay.get(key) ?? -1) > t - gap) return false;
    lastPlay.set(key, t);
    return true;
}

function tone(type, freq, dur, vol, { delay = 0, to = null, bus = sfxBus, attack = 0.004, filter = null } = {}) {
    if (!ctx || !_enabled) return;
    const t = now() + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = filter.type ?? 'lowpass';
        f.frequency.value = filter.freq;
        f.Q.value = filter.q ?? 1;
        o.connect(f);
        node = f;
    }
    node.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function noise(dur, vol, { delay = 0, type = 'lowpass', freq = 2000, to = null, q = 0.8, bus = sfxBus } = {}) {
    if (!ctx || !_enabled) return;
    const t = now() + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 1.5, dur + 0.05);
}

// ============================================================
// Sound effects
// ============================================================

const PENTA = [0, 2, 4, 7, 9];

export function playUiClick() { tone('square', 880, 0.06, 0.12, { to: 1320 }); }

export function playFlip() {
    if (!limit('flip', 0.03)) return;
    noise(0.05, 0.25, { freq: 900 });
    tone('square', 140, 0.06, 0.12, { to: 70 });
}

export function playFlipperHit(power) {
    if (!limit('fhit', 0.05)) return;
    tone('triangle', 260 + power * 8, 0.09, 0.2, { to: 120 });
}

export function playBumper(i) {
    if (!limit('bumper' + i, 0.04)) return;
    const f = [523, 659, 784][i % 3];
    tone('square', f, 0.12, 0.16, { to: f * 1.5, filter: { freq: 3000 } });
    tone('sine', f / 2, 0.16, 0.22);
    noise(0.04, 0.2, { type: 'highpass', freq: 3000 });
}

export function playSling() {
    if (!limit('sling', 0.05)) return;
    tone('sawtooth', 700, 0.09, 0.14, { to: 180, filter: { freq: 2500 } });
    noise(0.05, 0.22, { freq: 1500 });
}

export function playBrickHit() {
    if (!limit('bhit', 0.03)) return;
    tone('triangle', 1400, 0.05, 0.12, { to: 900 });
}

/** Pitched by the combo so a chain plays a rising pentatonic run. */
export function playBrickBreak(combo) {
    if (!limit('bbreak', 0.025)) return;
    const idx = Math.min(combo, 24);
    const n = 64 + PENTA[idx % 5] + 12 * Math.floor(idx / 5);
    const f = midi(Math.min(n, 100));
    tone('square', f, 0.14, 0.11, { filter: { freq: 5000 } });
    tone('triangle', f * 2, 0.1, 0.08, { delay: 0.02 });
    noise(0.09, 0.2, { type: 'bandpass', freq: 2400, to: 800, q: 1.2 });
}

export function playBlast() {
    if (!limit('blast', 0.05)) return;
    noise(0.6, 0.55, { freq: 1800, to: 80 });
    tone('sine', 110, 0.5, 0.5, { to: 32 });
    tone('sawtooth', 220, 0.25, 0.12, { to: 60, filter: { freq: 900 } });
}

export function playLaunch(power) {
    noise(0.35, 0.25, { type: 'bandpass', freq: 300, to: 3000 + power * 3000, q: 2 });
    tone('sawtooth', 90, 0.35, 0.16, { to: 500 + power * 700, filter: { freq: 2000 } });
}

export function playPlungerPull() { tone('triangle', 180, 0.8, 0.05, { to: 90 }); }

export function playDrain(last) {
    if (last) {
        [0, -3, -7, -12].forEach((s, i) => tone('sawtooth', midi(57 + s), 0.35, 0.14, { delay: i * 0.14, filter: { freq: 1400 } }));
        noise(0.9, 0.2, { freq: 700, to: 60, delay: 0.3 });
    } else {
        tone('sawtooth', 400, 0.5, 0.14, { to: 70, filter: { freq: 1500 } });
    }
}

export function playBallSaved() {
    [0, 4, 7, 12].forEach((s, i) => tone('square', midi(72 + s), 0.1, 0.1, { delay: i * 0.05, filter: { freq: 4000 } }));
}

export function playPickup() {
    [0, 4, 7, 11, 12, 16].forEach((s, i) => tone('triangle', midi(76 + s), 0.12, 0.13, { delay: i * 0.035 }));
    noise(0.3, 0.08, { type: 'highpass', freq: 6000, delay: 0.05 });
}

export function playLaser() {
    if (!limit('laser', 0.05)) return;
    tone('square', 1800, 0.12, 0.08, { to: 260, filter: { freq: 4000 } });
}

export function playShield() {
    if (!limit('shield', 0.06)) return;
    tone('sine', 220, 0.2, 0.25, { to: 880 });
    tone('square', 440, 0.12, 0.06, { to: 1760 });
}

export function playWaveClear() {
    const chord = [60, 64, 67, 72, 76, 79, 84];
    chord.forEach((n, i) => tone('square', midi(n), 0.4, 0.09, { delay: i * 0.06, filter: { freq: 5000 } }));
    chord.forEach((n, i) => tone('sawtooth', midi(n - 12), 0.9, 0.05, { delay: 0.45 + i * 0.01, filter: { freq: 2500 } }));
    noise(1.4, 0.18, { type: 'bandpass', freq: 400, to: 6000, q: 0.7 });
}

export function playWaveStart() {
    [0, 7, 12].forEach((s, i) => tone('triangle', midi(64 + s), 0.18, 0.14, { delay: i * 0.1 }));
}

export function playExtraBall() {
    for (let r = 0; r < 3; r++) [0, 7, 12].forEach((s, i) => tone('sine', midi(84 + s), 0.25, 0.14, { delay: r * 0.22 + i * 0.05 }));
}

export function playNudge() { tone('sine', 70, 0.2, 0.5, { to: 40 }); noise(0.1, 0.2, { freq: 400 }); }

export function playTilt() {
    tone('sawtooth', 110, 1.0, 0.2, { filter: { freq: 900 } });
    tone('sawtooth', 116, 1.0, 0.2, { filter: { freq: 900 } });
}

export function playComboUp(mult) {
    const base = 60 + Math.min(mult, 8) * 2;
    tone('sawtooth', midi(base), 0.25, 0.1, { to: midi(base + 12), filter: { freq: 3000 } });
    [0, 4, 7].forEach((s) => tone('square', midi(base + 12 + s), 0.2, 0.06, { delay: 0.12, filter: { freq: 4000 } }));
}

export function playWall(speed) {
    if (!limit('wall', 0.06)) return;
    tone('triangle', 180 + speed * 6, 0.04, Math.min(0.12, speed * 0.006));
}

export function playClack() {
    if (!limit('clack', 0.04)) return;
    tone('square', 2400, 0.03, 0.08);
}

export function playGameOver() {
    tone('sawtooth', 440, 1.6, 0.18, { to: 40, filter: { freq: 1800 } });
    noise(1.2, 0.2, { freq: 900, to: 50, delay: 0.3 });
}

export function playUnstick() { tone('sine', 300, 0.1, 0.1, { to: 600 }); }

// ============================================================
// Music
// ============================================================

const BPM = 112;
const SPB = 60 / BPM;
const STEP = SPB / 4;
// i – VI – III – VII in A minor: Am, F, C, G.
const PROG = [
    { root: 45, q: [0, 3, 7] },
    { root: 41, q: [0, 4, 7] },
    { root: 48, q: [0, 4, 7] },
    { root: 43, q: [0, 4, 7] },
];
const LEAD = [12, 15, 19, 17, 15, 12, 10, 12];     // a hook, over the chord roots

let musicOn = false;
let step = 0;
let nextTime = 0;
let musicStart = 0;
let timer = null;
let intensity = 0;

export function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    musicStart = nextTime;
    timer = setInterval(scheduler, 25);
}

export function stopMusic() {
    musicOn = false;
    clearInterval(timer);
}

export function setMusicIntensity(level) { intensity = level; }

function scheduler() {
    if (!ctx) return;
    // After a long stall (backgrounded tab), skip ahead rather than cram notes.
    if (nextTime < ctx.currentTime - 0.2) {
        const skip = Math.ceil((ctx.currentTime - nextTime) / STEP);
        step += skip;
        nextTime += skip * STEP;
    }
    while (nextTime < ctx.currentTime + 0.12) {
        playStep(step, nextTime);
        nextTime += STEP;
        step++;
    }
}


function mTone(t, type, f, dur, vol, cut = 2000, to = null, bus = pump) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(cut, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function mNoise(t, dur, vol, type, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t, Math.random(), dur + 0.05);
}

function playStep(s, t) {
    if (!_enabled) return;
    const bar = Math.floor(s / 16) % 4;
    const st = s % 16;
    const ch = PROG[bar];

    // Driving octave bass on 8ths.
    if (st % 2 === 0) {
        const up = st % 4 === 2 ? 12 : 0;
        mTone(t, 'sawtooth', midi(ch.root - 12 + up), STEP * 1.8, 0.32, 900 + intensity * 250);
    }

    // Pad: detuned saws, one chord per bar.
    if (st === 0) {
        for (const q of ch.q) {
            for (const det of [-7, 7]) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                const f = ctx.createBiquadFilter();
                o.type = 'sawtooth';
                o.frequency.value = midi(ch.root + 12 + q);
                o.detune.value = det;
                f.type = 'lowpass';
                f.frequency.value = 1100;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(0.035, t + 0.4);
                g.gain.linearRampToValueAtTime(0.0001, t + SPB * 4);
                o.connect(f); f.connect(g); g.connect(pump);
                o.start(t);
                o.stop(t + SPB * 4 + 0.05);
            }
        }
    }

    // Drums.
    if (intensity >= 1 || st === 0) {
        if (st % 4 === 0) {
            mTone(t, 'sine', 150, 0.28, intensity >= 1 ? 0.9 : 0.4, 4000, 42, musicBus);
            // Duck the bass/pad under the kick: the synthwave pump.
            pump.gain.cancelScheduledValues(t);
            pump.gain.setValueAtTime(0.35, t);
            pump.gain.linearRampToValueAtTime(1, t + SPB * 0.8);
        }
    }
    if (intensity >= 1) {
        if (st === 4 || st === 12) {
            mNoise(t, 0.22, 0.4, 'bandpass', 1800);
            mTone(t, 'triangle', 190, 0.12, 0.2, 3000, 120, musicBus);
        }
        if (st % 2 === 1) mNoise(t, st % 4 === 3 ? 0.06 : 0.03, 0.12, 'highpass', 7500);
    }

    // Arpeggio.
    if (intensity >= 2) {
        const arp = [0, ch.q[1], ch.q[2], 12][st % 4] + (st >= 8 ? 12 : 0);
        mTone(t, 'square', midi(ch.root + 24 + arp), STEP * 0.9, 0.06, 3500);
    }
    // Lead stabs.
    if (intensity >= 3 && st % 4 === 0) {
        const n = LEAD[(Math.floor(s / 4)) % LEAD.length];
        mTone(t, 'sawtooth', midi(PROG[0].root + 24 + n), SPB * 0.9, 0.07, 2800);
    }
}

/** 1 on each beat, decaying toward the next — for pulsing the visuals. */
export function getBeatPulse(fallbackTime) {
    let phase;
    if (ctx && musicOn) phase = ((ctx.currentTime - musicStart) / SPB) % 1;
    else phase = (fallbackTime / SPB) % 1;
    if (phase < 0) phase += 1;
    return Math.exp(-phase * 5);
}
