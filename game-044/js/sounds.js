/**
 * sounds.js — Web Audio sound effects, ambience beds and Elsie's lullaby.
 * No audio files: everything is oscillators and filtered noise.
 * Call initAudio() from the first user gesture (browser autoplay policy).
 */

let ctx = null, master = null, ambGain = null, amb = null, musicGain = null;
let enabled = true;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0;
    ambGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
}

export function setSound(on) {
    enabled = on;
    if (master) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
}
export function soundOn() { return enabled; }

function tone(type, freq, dur, vol = 0.2, delay = 0, dest = master, attack = 0.005) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
}

function sweep(type, f0, f1, dur, vol = 0.2, delay = 0) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.1, freq = 1200, type = 'lowpass', delay = 0) {
    if (!ctx || !enabled) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const t = ctx.currentTime + delay;
    s.buffer = buf;
    f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
}

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** A soft music-box note: sine + a quiet octave partial. */
function bell(m, delay, vol = 0.12, dur = 1.4, dest = musicGain) {
    tone('sine', midi(m), dur, vol, delay, dest, 0.004);
    tone('sine', midi(m + 12), dur * 0.5, vol * 0.3, delay, dest, 0.004);
}

export const sfx = {
    click() { tone('triangle', 880, 0.05, 0.08); },
    verb() { tone('triangle', 660, 0.05, 0.07); },
    pickup() { tone('square', 660, 0.07, 0.06); tone('square', 990, 0.12, 0.06, 0.07); },
    points() { [72, 76, 79, 84].forEach((m, i) => bell(m, i * 0.07, 0.1, 0.6, master)); },
    chronicle() { noise(0.25, 0.05, 3000, 'bandpass'); tone('sine', 1320, 0.3, 0.04, 0.1); },
    door() { sweep('sawtooth', 120, 60, 0.4, 0.08); noise(0.3, 0.06, 400); },
    stone() { noise(1.2, 0.18, 220); sweep('sawtooth', 70, 40, 1.2, 0.1); },
    splash() { noise(0.5, 0.2, 900); sweep('sine', 600, 200, 0.3, 0.08, 0.05); },
    wrong() { tone('square', 220, 0.18, 0.08); tone('square', 185, 0.3, 0.08, 0.15); },
    right() { [67, 71, 74].forEach((m, i) => bell(m, i * 0.1, 0.12, 0.7, master)); },
    magic() { for (let i = 0; i < 8; i++) bell(84 + (i * 5) % 12, i * 0.06, 0.05, 0.8, master); },
    woof() { sweep('sawtooth', 260, 110, 0.18, 0.18); noise(0.15, 0.12, 700); sweep('sawtooth', 240, 100, 0.2, 0.16, 0.25); noise(0.15, 0.1, 700, 'lowpass', 0.25); },
    snore() { sweep('sawtooth', 70, 90, 0.9, 0.06); noise(0.9, 0.04, 300); },
    grumble() { sweep('sawtooth', 90, 60, 0.5, 0.14); sweep('square', 70, 50, 0.6, 0.06, 0.1); },
    caw() { sweep('square', 1200, 700, 0.12, 0.07); sweep('square', 1100, 650, 0.12, 0.07, 0.16); },
    munch() { for (let i = 0; i < 4; i++) noise(0.07, 0.12, 1500, 'bandpass', i * 0.14); },
    thud() { sweep('sine', 140, 40, 0.3, 0.3); noise(0.2, 0.15, 300); },
    pour() { for (let i = 0; i < 10; i++) bell(76 + ((i * 7) % 12), i * 0.09, 0.05, 0.9, master); noise(1.2, 0.04, 2500, 'bandpass'); },
    death() { [64, 63, 62, 61, 57].forEach((m, i) => tone('triangle', midi(m - 12), 0.5, 0.12, i * 0.28)); },
    shatter() { noise(0.8, 0.25, 5000, 'highpass'); for (let i = 0; i < 6; i++) tone('sine', 2000 + Math.random() * 2500, 0.3, 0.04, Math.random() * 0.4); },
    write() { for (let i = 0; i < 6; i++) noise(0.05, 0.05, 4000, 'bandpass', i * 0.09); },
};

// --- Elsie's lullaby — the music box, the title, and the good ending --------

const LULLABY = [
    [76, 1], [79, 1], [81, 2], [79, 1], [76, 1], [74, 2], [72, 1], [74, 1], [76, 2], [72, 2],
    [76, 1], [79, 1], [81, 2], [84, 1], [83, 1], [81, 2], [79, 1], [76, 1], [74, 2], [72, 3],
];

let lullabyTimer = null;

/** Plays the lullaby once. Returns its duration in seconds. */
export function playLullaby(tempo = 0.36, loop = false) {
    if (!ctx || !enabled) return 0;
    stopLullaby();
    let t = 0;
    for (const [m, beats] of LULLABY) {
        bell(m, t, 0.1, beats * tempo * 2.5);
        if (beats >= 2) bell(m - 12, t, 0.05, beats * tempo * 2);
        t += beats * tempo;
    }
    if (loop) lullabyTimer = setTimeout(() => playLullaby(tempo, true), (t + 1.5) * 1000);
    return t;
}

export function stopLullaby() {
    if (lullabyTimer) { clearTimeout(lullabyTimer); lullabyTimer = null; }
}

// --- ambience beds ----------------------------------------------------------

/**
 * kinds: 'hearth' (crackle), 'village' (evening air), 'river', 'wind',
 * 'forest', 'cave', 'magic', 'none'.
 */
export function ambience(kind) {
    if (!ctx) return;
    if (amb && amb.kind === kind) return;
    if (amb) {
        const old = amb;
        old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        setTimeout(() => old.stop(), 2000);
        amb = null;
    }
    if (kind === 'none') return;

    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    const nodes = [];
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    const settings = {
        hearth: ['lowpass', 500, 0.05], village: ['lowpass', 350, 0.04], river: ['bandpass', 900, 0.1],
        wind: ['lowpass', 420, 0.08], forest: ['lowpass', 300, 0.05], cave: ['lowpass', 160, 0.1],
        magic: ['bandpass', 1800, 0.025],
    }[kind] || ['lowpass', 300, 0.04];
    f.type = settings[0]; f.frequency.value = settings[1];
    src.connect(f); f.connect(g);
    src.start();
    nodes.push(src);

    // Slow swell on the wind so it breathes rather than hisses.
    if (kind === 'wind' || kind === 'forest') {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.13; lg.gain.value = 180;
        lfo.connect(lg); lg.connect(f.frequency); lfo.start();
        nodes.push(lfo);
    }
    // A low drone under the caves and the sanctum.
    if (kind === 'cave' || kind === 'magic') {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.value = kind === 'cave' ? 55 : 110;
        og.gain.value = kind === 'cave' ? 0.05 : 0.025;
        o.connect(og); og.connect(g); o.start();
        nodes.push(o);
        if (kind === 'magic') {
            const o2 = ctx.createOscillator();
            o2.type = 'sine'; o2.frequency.value = 164.8;
            o2.connect(og); o2.start();
            nodes.push(o2);
        }
    }
    g.gain.setTargetAtTime(settings[2] * 4, ctx.currentTime, 0.8);

    let crackle = null;
    if (kind === 'hearth') {
        crackle = setInterval(() => { if (Math.random() < 0.5) noise(0.03, 0.05 + Math.random() * 0.06, 2500, 'highpass'); }, 180);
    }
    amb = {
        kind, gain: g,
        stop() {
            nodes.forEach(n => { try { n.stop(); } catch { /* already stopped */ } });
            if (crackle) clearInterval(crackle);
            g.disconnect();
        },
    };
}
