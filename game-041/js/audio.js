// ============================================================
// Procedural chiptune: every sound is synthesised, no files.
// ============================================================
// The walking tune plays ONLY while the miner is moving, a nod to how the
// music in classic digging games follows the player's feet. A Pac-Man-style
// siren runs while enemies are frightened.
// All functions are safe to call before initAudio() or under Node: they no-op.

let ctx = null, master = null, musicBus = null, sfxBus = null;
let enabled = true;
let noiseBuf = null;

export function initAudio() {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
        ctx = new AC();
    } catch { return; }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function resumeAudio() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function suspendAudio() {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

export function isSoundOn() { return enabled; }
export function setSound(on) {
    enabled = on;
    if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.02);
}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function tone(type, f0, f1, dur, vol, when = 0, bus = sfxBus) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, when = 0, filter = 'lowpass', freq = 1800) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

// ------------------------------------------------------------ effects
let waka = 0;
export const sfx = {
    dig()     { noise(0.05, 0.18, 0, 'bandpass', 900 + Math.random() * 400); },
    pellet()  { waka ^= 1; tone('square', waka ? 330 : 520, waka ? 520 : 330, 0.07, 0.12); },
    ore()     { tone('square', 1320, 1760, 0.05, 0.09); tone('square', 1760, 2090, 0.05, 0.07, 0.04); },
    gem()     { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.09, 0.14, i * 0.045)); },
    harpoon() { tone('square', 900, 1500, 0.08, 0.1); },
    pump()    { tone('square', 220, 440, 0.1, 0.16); noise(0.06, 0.08, 0, 'highpass', 3000); },
    pop()     { noise(0.18, 0.35, 0, 'lowpass', 2500); tone('square', 880, 110, 0.2, 0.18); },
    shoot()   { tone('square', 1600, 700, 0.05, 0.05); },
    zap()     { tone('sawtooth', 1800, 300, 0.12, 0.08); noise(0.1, 0.1, 0, 'highpass', 4000); },
    lob()     { tone('triangle', 300, 520, 0.14, 0.14); },
    boom()    { noise(0.35, 0.4, 0, 'lowpass', 700); tone('sine', 140, 40, 0.35, 0.3); },
    kill()    { tone('square', 660, 1320, 0.07, 0.1); },
    eat()     { tone('square', 200, 1600, 0.22, 0.14); tone('square', 400, 3200, 0.22, 0.06); },
    coreHit() { tone('sawtooth', 220, 110, 0.3, 0.22); tone('square', 880, 440, 0.3, 0.1, 0.05); },
    build()   { tone('square', 523, 523, 0.06, 0.12); tone('square', 784, 784, 0.08, 0.12, 0.06); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.07, 0.12, i * 0.05)); },
    sell()    { tone('square', 784, 392, 0.14, 0.12); },
    deny()    { tone('square', 140, 120, 0.16, 0.16); },
    rockWobble() { noise(0.25, 0.12, 0, 'lowpass', 400); },
    rockLand()   { noise(0.3, 0.35, 0, 'lowpass', 500); tone('sine', 90, 40, 0.3, 0.3); },
    fire()    { noise(0.5, 0.2, 0, 'bandpass', 1200); },
    veg()     { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.1, 0.18, i * 0.06)); },
    extraLife() { [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => tone('square', f, f, 0.08, 0.12, i * 0.07)); },
    waveStart() { [392, 392, 523, 659].forEach((f, i) => tone('square', f, f, 0.1, 0.13, i * 0.1)); },
    waveClear() { [659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.13, i * 0.08)); },
    die() {
        [784, 740, 698, 659, 622, 587, 554, 523, 494, 466, 440].forEach((f, i) => tone('square', f, f * 0.94, 0.09, 0.14, i * 0.08));
        noise(0.4, 0.2, 0.9, 'lowpass', 900);
    },
    start() {
        const mel = [72, 76, 79, 84, 79, 76, 77, 81, 84, 89, 84, 81, 79, 83, 86, 91];
        mel.forEach((m, i) => tone('square', mtof(m), mtof(m), 0.1, 0.1, i * 0.1));
        [48, 55, 53, 55].forEach((m, i) => tone('triangle', mtof(m), mtof(m), 0.38, 0.22, i * 0.4));
    },
    roundClear() {
        const mel = [72, 74, 76, 79, 76, 79, 84];
        mel.forEach((m, i) => tone('square', mtof(m), mtof(m), 0.13, 0.12, i * 0.12));
    },
    gameOver() {
        [67, 66, 65, 64, 60, 55, 48].forEach((m, i) => tone('triangle', mtof(m), mtof(m), 0.28, 0.2, i * 0.22));
    },
    click()   { tone('square', 1200, 1200, 0.03, 0.08); },
};

// ------------------------------------------------------------ walking tune
// 32 steps, an original bouncy minor-key line. 0 = rest.
const LEAD = [
    69, 0, 72, 76, 74, 0, 72, 69, 71, 0, 74, 77, 76, 74, 72, 71,
    69, 0, 72, 76, 79, 0, 77, 76, 74, 72, 71, 74, 72, 0, 69, 0,
];
const BASS = [
    45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50, 40, 47, 40, 47,
    45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50, 45, 52, 45, 45,
];
const STEP = 0.13;
let step = 0, acc = 0;
let siren = null;

export function musicTick(dt, moving, frightened) {
    if (!ctx || !enabled) return;
    if (moving) {
        acc += dt;
        while (acc >= STEP) {
            acc -= STEP;
            const m = LEAD[step % LEAD.length], b = BASS[step % BASS.length];
            if (m) tone('square', mtof(m), mtof(m), STEP * 0.9, 0.16, 0, musicBus);
            if (b && step % 2 === 0) tone('triangle', mtof(b), mtof(b), STEP * 1.8, 0.3, 0, musicBus);
            step++;
        }
    }
    setSiren(frightened);
}

function setSiren(on) {
    if (on && !siren) {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator();
        const lg = ctx.createGain(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 700;
        lfo.type = 'triangle'; lfo.frequency.value = 7;
        lg.gain.value = 180;
        lfo.connect(lg); lg.connect(o.frequency);
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.05);
        o.connect(g); g.connect(musicBus);
        o.start(); lfo.start();
        siren = { o, lfo, g };
    } else if (!on && siren) {
        const s = siren; siren = null;
        s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
        s.o.stop(ctx.currentTime + 0.3); s.lfo.stop(ctx.currentTime + 0.3);
    }
}

export function stopMusic() {
    if (ctx && siren) setSiren(false);
    acc = 0;
}
