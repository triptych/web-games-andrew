/**
 * audio.js — Web Audio sound effects and a generative, upbeat score.
 *
 * Music: a look-ahead scheduler plays a chord progression with bass, plucked arpeggios,
 * a generated melody (a two-bar motif, repeated and varied) and drums. Three moods:
 * 'town' (bright and bouncy), 'battle' (driving), 'boss' (big and dramatic).
 * Nothing plays until the first user gesture (browser autoplay policy).
 */

let ctx = null, master = null, sfxBus = null, musicBus = null, verb = null;
let soundOn = true, musicOn = true;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.7 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    // small room reverb
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = buf;
    const vg = ctx.createGain(); vg.gain.value = 0.22;
    verb.connect(vg); vg.connect(master);
    if (pendingMusic) startMusic(pendingMusic);
}

export function setSoundOn(on) { soundOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.7 : 0; }
export function setMusicOn(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.32 : 0; }
export function isSoundOn() { return soundOn; }
export function isMusicOn() { return musicOn; }

// ------------------------------------------------------------------ Voices

function env(g, t, a, d, peak, sus = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
}

function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t = (o.at ?? ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    env(g, t, o.a ?? 0.005, dur, o.vol ?? 0.3);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; osc.connect(f); node = f; }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    if (o.verb) g.connect(verb);
    osc.start(t);
    osc.stop(t + (o.a ?? 0.005) + dur + 0.05);
}

function noise(dur, o = {}) {
    if (!ctx) return;
    const t = (o.at ?? ctx.currentTime) + (o.delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    env(g, t, o.a ?? 0.003, dur, o.vol ?? 0.25);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    if (o.verb) g.connect(verb);
    src.start(t);
    src.stop(t + dur + 0.05);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI → Hz

// ------------------------------------------------------------------ Sound effects

const COLOR_NOTE = { fire: 72, water: 76, leaf: 79, spark: 84 };

export const sfx = {
    click() { tone(N(84), 0.05, { type: 'triangle', vol: 0.15 }); },
    open() { tone(N(76), 0.08, { type: 'triangle', vol: 0.15 }); tone(N(83), 0.1, { type: 'triangle', vol: 0.12, delay: 0.05 }); },
    close() { tone(N(79), 0.07, { type: 'triangle', vol: 0.12 }); tone(N(72), 0.09, { type: 'triangle', vol: 0.1, delay: 0.04 }); },
    select() { tone(N(88), 0.05, { type: 'sine', vol: 0.15 }); },
    swap() { noise(0.09, { freq: 1800, to: 600, vol: 0.12 }); tone(N(67), 0.08, { type: 'triangle', vol: 0.1, to: N(74) }); },
    invalid() { tone(N(55), 0.12, { type: 'square', vol: 0.08, lp: 900 }); tone(N(52), 0.15, { type: 'square', vol: 0.08, lp: 900, delay: 0.1 }); },
    match(step, size = 3) {
        const base = 72 + Math.min(step - 1, 10) * 2;
        [0, 4, 7].forEach((iv, i) => tone(N(base + iv + (size >= 4 ? 5 : 0)), 0.16, { type: 'triangle', vol: 0.13, delay: i * 0.03, verb: true }));
        noise(0.06, { freq: 5000, vol: 0.06 });
    },
    make() { [79, 83, 86, 91].forEach((n, i) => tone(N(n), 0.18, { type: 'sine', vol: 0.12, delay: i * 0.04, verb: true })); },
    bomb() { tone(80, 0.5, { type: 'sine', vol: 0.5, to: 30 }); noise(0.45, { freq: 900, to: 120, vol: 0.4, filter: 'lowpass' }); },
    line() { noise(0.35, { freq: 3000, to: 400, vol: 0.25 }); tone(N(96), 0.3, { type: 'sawtooth', vol: 0.06, to: N(72), lp: 4000 }); },
    prism() { for (let i = 0; i < 8; i++) tone(N(84 + [0, 4, 7, 11, 12, 16, 19, 24][i]), 0.25, { type: 'sine', vol: 0.11, delay: i * 0.035, verb: true }); },
    skull(n) { tone(110, 0.18, { type: 'sine', vol: 0.45, to: 50 }); noise(0.12, { freq: 400, vol: 0.25, filter: 'lowpass' }); if (n > 15) noise(0.2, { freq: 2000, to: 500, vol: 0.15, delay: 0.03 }); },
    crit() { tone(N(96), 0.12, { type: 'square', vol: 0.08, lp: 5000 }); tone(N(100), 0.18, { type: 'square', vol: 0.08, lp: 5000, delay: 0.06 }); },
    hurt() { tone(220, 0.25, { type: 'sawtooth', vol: 0.18, to: 90, lp: 1200 }); noise(0.15, { freq: 600, vol: 0.2 }); },
    mana(color) { const n = COLOR_NOTE[color] || 76; tone(N(n + 12), 0.1, { type: 'sine', vol: 0.08 }); tone(N(n + 19), 0.12, { type: 'sine', vol: 0.06, delay: 0.04 }); },
    coin() { tone(N(88), 0.06, { type: 'square', vol: 0.07, lp: 6000 }); tone(N(95), 0.18, { type: 'square', vol: 0.07, lp: 6000, delay: 0.06 }); },
    star() { tone(N(91), 0.12, { type: 'triangle', vol: 0.1, verb: true }); tone(N(98), 0.16, { type: 'triangle', vol: 0.08, delay: 0.05, verb: true }); },
    cast(el) {
        if (el === 'fire') { noise(0.5, { freq: 300, to: 2500, vol: 0.35 }); tone(140, 0.45, { type: 'sawtooth', vol: 0.12, to: 400, lp: 1200 }); }
        else if (el === 'water') { for (let i = 0; i < 6; i++) tone(N(70 + Math.random() * 20), 0.08, { type: 'sine', vol: 0.12, delay: i * 0.05, to: N(90) }); }
        else if (el === 'leaf') { [76, 79, 83, 88].forEach((n, i) => tone(N(n), 0.3, { type: 'sine', vol: 0.12, delay: i * 0.06, verb: true })); }
        else if (el === 'spark') { for (let i = 0; i < 5; i++) noise(0.05, { freq: 4000 + Math.random() * 3000, vol: 0.18, delay: i * 0.05, q: 4 }); tone(N(96), 0.2, { type: 'square', vol: 0.06, lp: 6000 }); }
        else { [67, 71, 74, 79].forEach((n, i) => tone(N(n), 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.05, verb: true })); }
    },
    shield() { tone(N(72), 0.4, { type: 'sine', vol: 0.15, verb: true }); tone(N(79), 0.5, { type: 'sine', vol: 0.12, delay: 0.05, verb: true }); noise(0.3, { freq: 3000, vol: 0.05 }); },
    heal() { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.25, { type: 'sine', vol: 0.12, delay: i * 0.07, verb: true })); },
    stun() { tone(N(84), 0.5, { type: 'sine', vol: 0.1, to: N(60) }); tone(N(88), 0.5, { type: 'sine', vol: 0.08, to: N(64), delay: 0.05 }); },
    extra() { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.1, { type: 'square', vol: 0.07, lp: 4000, delay: i * 0.05 })); },
    turn() { tone(N(79), 0.08, { type: 'triangle', vol: 0.08 }); },
    enemyTurn() { tone(N(67), 0.1, { type: 'triangle', vol: 0.08 }); tone(N(63), 0.12, { type: 'triangle', vol: 0.08, delay: 0.07 }); },
    potion() { for (let i = 0; i < 5; i++) tone(N(76 + i * 3), 0.07, { type: 'sine', vol: 0.12, delay: i * 0.04 }); noise(0.2, { freq: 1500, vol: 0.06 }); },
    victory() { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.52], [84, 0.64]].forEach(([n, d]) => tone(N(n), d >= 0.6 ? 0.6 : 0.16, { type: 'square', vol: 0.09, lp: 3500, delay: d, verb: true })); tone(N(48), 1, { type: 'triangle', vol: 0.2, delay: 0.64 }); },
    defeat() { [[67, 0], [66, 0.25], [65, 0.5], [64, 0.75]].forEach(([n, d]) => tone(N(n), 0.3, { type: 'sawtooth', vol: 0.08, lp: 1500, delay: d, to: d === 0.75 ? N(58) : undefined })); },
    levelUp() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.06, verb: true })); noise(0.6, { freq: 6000, vol: 0.05, delay: 0.3 }); },
    book() { [60, 67, 72, 76, 79, 84, 88, 91].forEach((n, i) => { tone(N(n), 0.5, { type: 'sine', vol: 0.13, delay: i * 0.08, verb: true }); tone(N(n + 12), 0.4, { type: 'triangle', vol: 0.05, delay: i * 0.08 + 0.02 }); }); },
    collect(i = 0) { tone(N(79 + (i % 5) * 2), 0.07, { type: 'triangle', vol: 0.13 }); tone(N(86 + (i % 5) * 2), 0.1, { type: 'sine', vol: 0.1, delay: 0.05 }); },
    build() { for (let i = 0; i < 3; i++) noise(0.06, { freq: 800, vol: 0.3, delay: i * 0.12, filter: 'lowpass' }); [72, 79, 84].forEach((n, i) => tone(N(n), 0.25, { type: 'triangle', vol: 0.12, delay: 0.38 + i * 0.07, verb: true })); },
    quest() { [79, 84, 88].forEach((n, i) => tone(N(n), 0.2, { type: 'square', vol: 0.07, lp: 4000, delay: i * 0.08 })); },
    type() { tone(N(84 + Math.floor(Math.random() * 5)), 0.02, { type: 'square', vol: 0.025, lp: 3000 }); },
    deny() { tone(N(48), 0.15, { type: 'square', vol: 0.08, lp: 800 }); },
};

// ------------------------------------------------------------------ Music

const MOODS = {
    town:   { bpm: 104, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], drums: 'soft', lead: 'triangle', arp: 'sine' },
    battle: { bpm: 138, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], drums: 'drive', lead: 'square', arp: 'triangle' },
    boss:   { bpm: 150, root: 50, scale: [0, 2, 3, 5, 7, 8, 11], prog: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]], drums: 'big', lead: 'sawtooth', arp: 'square' },
    title:  { bpm: 96, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], drums: 'soft', lead: 'triangle', arp: 'sine' },
};

let pendingMusic = null, curMood = null, timer = null, nextT = 0, step = 0, motif = null, seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function startMusic(mood) {
    pendingMusic = mood;
    if (!ctx) return;
    if (curMood === mood && timer) return;
    curMood = mood;
    step = 0;
    motif = null;
    seed = 1 + Math.floor(Math.random() * 1e6);
    nextT = ctx.currentTime + 0.1;
    if (!timer) timer = setInterval(schedule, 30);
}
export function stopMusic() { curMood = null; pendingMusic = null; if (timer) { clearInterval(timer); timer = null; } }

function makeMotif(M) {
    const m = [];
    for (let i = 0; i < 16; i++) {
        if (i % 2 === 1 && rnd() < 0.45) { m.push(null); continue; }
        const deg = Math.floor(rnd() * 5) + (rnd() < 0.3 ? 2 : 0);
        m.push({ deg, len: rnd() < 0.25 ? 2 : 1 });
    }
    return m;
}

function schedule() {
    if (!ctx || !curMood) return;
    const M = MOODS[curMood];
    const s16 = 60 / M.bpm / 4;
    while (nextT < ctx.currentTime + 0.18) {
        const bar = Math.floor(step / 16) % 4, i = step % 16;
        const chord = M.prog[bar];
        const t = nextT;
        const opt = { at: t, bus: musicBus };
        // bass
        if (i % 4 === 0 || (M.drums !== 'soft' && i % 4 === 2 && rnd() < 0.5)) tone(N(M.root - 24 + chord[0] + (i === 8 && rnd() < 0.4 ? 7 : 0)), s16 * 1.8, { ...opt, type: 'triangle', vol: 0.32, lp: 900 });
        // arpeggio
        if (i % 2 === 0) {
            const n = chord[(i / 2) % 3] + (i >= 8 ? 12 : 0);
            tone(N(M.root + n), s16 * 1.5, { ...opt, type: M.arp, vol: 0.07, lp: 3000, verb: true });
        }
        // melody: motif with variation every other phrase
        if (!motif || (step % 64 === 0 && rnd() < 0.5)) motif = makeMotif(M);
        const nt = motif[i];
        if (nt && (bar !== 3 || i < 12)) {
            const deg = (nt.deg + (bar === 1 ? 1 : bar === 2 ? -1 : 0) + 14) % 7;
            const oct = 12 + (deg < 2 && rnd() < 0.3 ? 12 : 0);
            tone(N(M.root + M.scale[deg] + oct), s16 * (nt.len * 1.6), { ...opt, type: M.lead, vol: M.lead === 'triangle' ? 0.09 : 0.045, lp: 2600, verb: true });
        }
        // drums
        if (M.drums === 'soft') {
            if (i === 0 || i === 8) tone(90, 0.15, { ...opt, type: 'sine', vol: 0.32, to: 45 });
            if (i % 4 === 2) noise(0.04, { ...opt, freq: 8000, vol: 0.05, filter: 'highpass' });
            if (i === 4 || i === 12) noise(0.08, { ...opt, freq: 2500, vol: 0.06 });
        } else {
            if (i % 4 === 0 || (M.drums === 'big' && i === 14)) tone(100, 0.16, { ...opt, type: 'sine', vol: 0.42, to: 42 });
            if (i % 2 === 1 || M.drums === 'big') noise(0.03, { ...opt, freq: 9000, vol: 0.05, filter: 'highpass' });
            if (i === 4 || i === 12) noise(0.12, { ...opt, freq: 1800, vol: 0.16 });
        }
        nextT += s16;
        step++;
    }
}
