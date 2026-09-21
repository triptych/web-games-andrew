/**
 * Synthesised audio. The TIA had two channels of square and noise at coarse
 * frequency resolution, which is why 2600 sound is gritty and slightly out of
 * tune. We lean into that: square and sawtooth oscillators, quantised pitches,
 * and a noise buffer for impacts. Nothing is loaded from a file.
 */

let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;

export function initAudio() {
    if (ctx) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(ctx.destination);
        noiseBuffer = makeNoiseBuffer();
    } catch (err) {
        ctx = null;
    }
}

/** Browsers suspend audio until a gesture; call this from the first input. */
export function resumeAudio() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(v) {
    muted = v;
    if (master) master.gain.value = v ? 0 : 0.32;
}

export function isMuted() {
    return muted;
}

function makeNoiseBuffer() {
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Sample-and-hold noise: coarser than white noise, closer to the TIA.
    let hold = 0;
    for (let i = 0; i < len; i++) {
        if (i % 3 === 0) hold = Math.random() * 2 - 1;
        data[i] = hold;
    }
    return buf;
}

/**
 * The TIA could only produce a fixed set of divided frequencies, so pitches
 * snap to a coarse grid. This is the single biggest contributor to the sound.
 */
function quantise(freq) {
    const step = 24;
    return Math.max(40, Math.round(freq / step) * step);
}

function tone(freq, dur, type = 'square', gain = 0.3, slide = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(quantise(freq), t);
    if (slide) {
        osc.frequency.linearRampToValueAtTime(quantise(freq + slide), t + dur);
    }
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

function noise(dur, gain = 0.25, filterFreq = 1200) {
    if (!ctx || muted || !noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
}

// --- game sounds -----------------------------------------------------------

/** Polarity inversion: the signature sound, pitched by which way you flipped. */
export function sfxFlip(pol) {
    tone(pol > 0 ? 420 : 300, 0.09, 'square', 0.22, pol > 0 ? 180 : -140);
}

/** Shedding an echo: a very quiet tick, played sparsely so it does not fatigue. */
export function sfxShed() {
    tone(900, 0.02, 'square', 0.035);
}

/** Absorbing a mote; pitch rises with the chain so mastery is audible. */
export function sfxAbsorb(chain) {
    const base = 340 + Math.min(chain, 16) * 46;
    tone(base, 0.07, 'square', 0.26, 120);
    tone(base * 1.5, 0.05, 'triangle', 0.12);
}

export function sfxReclaim() {
    tone(620, 0.04, 'triangle', 0.1, -120);
}

export function sfxSplit() {
    noise(0.12, 0.2, 2400);
    tone(240, 0.1, 'sawtooth', 0.14, -80);
}

/** A mote reaching the core: the bad sound, low and ugly. */
export function sfxCoreHit() {
    noise(0.34, 0.4, 500);
    tone(110, 0.3, 'sawtooth', 0.3, -50);
}

export function sfxEchoEaten() {
    tone(180, 0.07, 'sawtooth', 0.14, -60);
}

export function sfxChainBreak() {
    tone(260, 0.1, 'triangle', 0.1, -110);
}

export function sfxWaveStart(wave) {
    const notes = [330, 440, 550];
    notes.forEach((n, i) => {
        setTimeout(() => tone(n, 0.1, 'square', 0.18), i * 90);
    });
}

export function sfxSurge() {
    if (!ctx || muted) return;
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            tone(160 + i * 30, 0.14, 'sawtooth', 0.22, 60);
            noise(0.1, 0.16, 900);
        }, i * 110);
    }
}

export function sfxFluxEmpty() {
    tone(150, 0.06, 'square', 0.12);
}

export function sfxGameOver() {
    const notes = [440, 370, 290, 200, 130];
    notes.forEach((n, i) => {
        setTimeout(() => tone(n, 0.26, 'sawtooth', 0.24, -30), i * 170);
    });
}

export function sfxMenu() {
    tone(560, 0.04, 'square', 0.14);
}

export function sfxConfirm() {
    tone(480, 0.06, 'square', 0.18, 200);
}
