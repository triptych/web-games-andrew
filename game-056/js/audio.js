/**
 * audio.js — every sound and the music, synthesised with Web Audio. No files.
 *
 * Music is generative and medieval-modal: each region picks a key, a mode,
 * a tempo and a four-chord progression, and a look-ahead sequencer plays a
 * drone, a plucked lute arpeggio, a frame drum, a wooden flute melody and,
 * for bosses, a low brass ostinato. Three intensities: calm (between waves),
 * battle, boss. Call initAudio() from the first user gesture.
 */

let ctx = null, master, sfx, music, noise = null, verb = null;
let soundOn = true, musicOn = true;
const last = new Map();

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = soundOn ? 0.55 : 0; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = musicOn ? 0.3 : 0; music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // A small convolution reverb from decaying noise.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35;
    verb.connect(vg); vg.connect(master);
    setInterval(schedule, 25);
}

export function setSound(on) { soundOn = on; if (sfx) sfx.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }
export function setMusic(on) { musicOn = on; if (music) music.gain.setTargetAtTime(on ? 0.3 : 0, ctx.currentTime, 0.2); }
export const audioReady = () => !!ctx;

const now = () => ctx.currentTime;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function limit(key, gap) {
    if (!ctx || !soundOn) return false;
    const t = ctx.currentTime;
    if ((last.get(key) ?? -1) > t - gap) return false;
    last.set(key, t);
    return true;
}

function tone(type, f, dur, vol, o = {}) {
    if (!ctx) return;
    const t = (o.at ?? now()) + (o.delay ?? 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide ?? dur));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.1); }
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
        const fl = ctx.createBiquadFilter();
        fl.type = o.filterType ?? 'lowpass';
        fl.frequency.setValueAtTime(o.filter, t);
        if (o.filterTo) fl.frequency.exponentialRampToValueAtTime(o.filterTo, t + dur);
        fl.Q.value = o.q ?? 1;
        osc.connect(fl); node = fl;
    }
    node.connect(g);
    g.connect(o.bus ?? sfx);
    if (o.wet) g.connect(verb);
    osc.start(t); osc.stop(t + dur + 0.05);
}

function hiss(dur, vol, o = {}) {
    if (!ctx) return;
    const t = (o.at ?? now()) + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = o.rate ?? 1;
    const fl = ctx.createBiquadFilter();
    fl.type = o.type ?? 'lowpass';
    fl.frequency.setValueAtTime(o.f ?? 1200, t);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    fl.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus ?? sfx);
    if (o.wet) g.connect(verb);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ SFX

export const S = {
    click() { if (limit('click', 0.04)) { tone('triangle', 900, 0.06, 0.12, { to: 1300 }); } },
    error() { if (limit('err', 0.15)) { tone('square', 160, 0.14, 0.08, { filter: 900 }); tone('square', 120, 0.16, 0.06, { delay: 0.07, filter: 900 }); } },
    bow() { if (limit('bow', 0.05)) { tone('triangle', 520 + Math.random() * 80, 0.12, 0.08, { to: 180, slide: 0.1 }); hiss(0.05, 0.05, { type: 'highpass', f: 3000 }); } },
    thunk() { if (limit('thunk', 0.04)) hiss(0.07, 0.09, { f: 800, to: 200 }); },
    fireball() { if (limit('fb', 0.08)) hiss(0.35, 0.12, { type: 'bandpass', f: 400, to: 1800, q: 1.2 }); },
    boom(big = 1) {
        if (!limit('boom', 0.06)) return;
        hiss(0.5 * big, 0.3 * Math.min(1.5, big), { f: 900, to: 80, wet: true });
        tone('sine', 110, 0.4 * big, 0.35 * Math.min(1.5, big), { to: 38 });
    },
    ice() { if (limit('ice', 0.06)) { tone('sine', 1800 + Math.random() * 400, 0.25, 0.05, { wet: true }); tone('triangle', 2600, 0.12, 0.03, { delay: 0.03 }); } },
    zap() { if (limit('zap', 0.08)) { for (let i = 0; i < 4; i++) tone('sawtooth', 300 + Math.random() * 900, 0.05, 0.05, { delay: i * 0.03, filter: 3000 }); hiss(0.2, 0.08, { type: 'highpass', f: 2000 }); } },
    holy() { if (limit('holy', 0.1)) { for (const n of [76, 80, 83]) tone('sine', midi(n), 0.5, 0.035, { wet: true, attack: 0.02 }); } },
    ballista() { if (limit('bal', 0.1)) { tone('square', 90, 0.12, 0.12, { to: 50, filter: 600 }); hiss(0.18, 0.12, { f: 1600, to: 300 }); } },
    clang() { if (limit('clang', 0.06)) { tone('square', 700 + Math.random() * 200, 0.08, 0.05, { filter: 3000, filterType: 'bandpass', q: 6 }); hiss(0.06, 0.06, { type: 'highpass', f: 2500 }); } },
    coin() { if (limit('coin', 0.05)) { tone('square', 1320, 0.06, 0.04, { filter: 4000 }); tone('square', 1760, 0.12, 0.04, { delay: 0.05, filter: 4000 }); } },
    brew() { if (limit('brew', 0.1)) { for (let i = 0; i < 3; i++) tone('sine', 400 + Math.random() * 300, 0.08, 0.04, { delay: i * 0.04, to: 900 }); } },
    collect() { if (limit('col', 0.05)) { [72, 76, 79, 84].forEach((n, i) => tone('triangle', midi(n), 0.15, 0.06, { delay: i * 0.04, wet: true })); } },
    place() { if (limit('place', 0.05)) { tone('sine', 140, 0.15, 0.2, { to: 70 }); hiss(0.1, 0.1, { f: 500, to: 150 }); } },
    upgrade(perk) { if (limit('upg', 0.08)) { (perk ? [67, 71, 74, 79, 83] : [72, 76, 79]).forEach((n, i) => tone('triangle', midi(n), 0.25, 0.07, { delay: i * 0.06, wet: true })); } },
    sell() { if (limit('sell', 0.1)) for (let i = 0; i < 5; i++) tone('square', 1500 - i * 120, 0.05, 0.03, { delay: i * 0.04, filter: 4000 }); },
    wallHit() { if (limit('wall', 0.09)) { hiss(0.18, 0.12, { f: 600, to: 120 }); tone('sine', 80, 0.15, 0.12, { to: 50 }); } },
    unitDie() { if (limit('udie', 0.1)) { hiss(0.3, 0.15, { f: 1000, to: 100 }); tone('sawtooth', 220, 0.3, 0.06, { to: 80, filter: 1200 }); } },
    voice(kind, pitch = 1, dying = true) {
        if (!limit('voice', 0.07)) return;
        const p = pitch;
        const dur = dying ? 0.35 : 0.2;
        switch (kind) {
            case 'squeak': tone('square', 900 * p, dur, 0.04, { to: 400 * p, filter: 2500 }); break;
            case 'growl': tone('sawtooth', 140 * p, dur, 0.08, { to: 70 * p, filter: 700, filterTo: 300 }); hiss(dur, 0.04, { f: 400 }); break;
            case 'roar': tone('sawtooth', 110 * p, dur * 1.6, 0.12, { to: 45 * p, filter: 900, filterTo: 200 }); hiss(dur * 1.5, 0.08, { f: 700, to: 200 }); break;
            case 'hiss': hiss(dur, 0.08, { type: 'highpass', f: 3000 * p }); break;
            case 'moan': case 'wail': tone('sine', (kind === 'wail' ? 700 : 300) * p, dur * 1.8, 0.07, { to: 150 * p, vib: 7, wet: true }); break;
            case 'squelch': hiss(dur, 0.1, { type: 'bandpass', f: 500, to: 200, q: 3 }); tone('sine', 220 * p, 0.15, 0.08, { to: 90 }); break;
            case 'rattle': for (let i = 0; i < 4; i++) tone('square', 1200 + Math.random() * 600, 0.03, 0.03, { delay: i * 0.035, filter: 3000, filterType: 'bandpass', q: 5 }); break;
            case 'chime': tone('sine', 1400 * p, 0.4, 0.05, { to: 700, wet: true }); break;
            case 'cackle': for (let i = 0; i < 3; i++) tone('square', (600 + i * 80) * p, 0.06, 0.04, { delay: i * 0.07, filter: 2000 }); break;
            case 'chant': tone('sawtooth', 200 * p, dur * 1.5, 0.05, { filter: 800, vib: 5, wet: true }); break;
            case 'creak': hiss(0.3, 0.1, { type: 'bandpass', f: 300, to: 900, q: 8 }); break;
            default: tone('sawtooth', 200 * p, dur, 0.06, { to: 90, filter: 900 });
        }
    },
    roar() { tone('sawtooth', 70, 1.4, 0.2, { to: 35, filter: 700, filterTo: 150, wet: true }); hiss(1.3, 0.14, { f: 500, to: 120, wet: true }); },
    horn(n = 2) { if (!ctx || !soundOn) return; const notes = n === 3 ? [55, 55, 62] : [55, 62]; notes.forEach((m, i) => { tone('sawtooth', midi(m), 0.6, 0.09, { delay: i * 0.45, filter: 900, attack: 0.06, wet: true }); tone('sawtooth', midi(m) * 1.003, 0.6, 0.06, { delay: i * 0.45, filter: 700, attack: 0.08 }); }); },
    fanfare() { if (!ctx || !soundOn) return; [[67, 0], [71, 0.12], [74, 0.24], [79, 0.4], [74, 0.6], [79, 0.72]].forEach(([n, d]) => { tone('square', midi(n), 0.35, 0.05, { delay: d, filter: 2400, wet: true }); tone('triangle', midi(n - 12), 0.4, 0.05, { delay: d }); }); },
    defeat() { if (!ctx || !soundOn) return; [[62, 0], [60, 0.3], [57, 0.6], [53, 1.0]].forEach(([n, d]) => tone('sawtooth', midi(n), 0.7, 0.06, { delay: d, filter: 900, wet: true })); tone('sine', 55, 2, 0.15, { delay: 0.2, to: 35 }); },
    keepfire() { hiss(1.3, 0.3, { type: 'bandpass', f: 200, to: 2400, q: 0.7, wet: true }); tone('sawtooth', 60, 1.2, 0.15, { to: 120, filter: 600 }); },
    meteor() { tone('sine', 1800, 0.7, 0.06, { to: 200 }); setTimeout(() => S.boom(2), 700); },
    nova() { for (let i = 0; i < 6; i++) tone('sine', 1200 + i * 300, 0.6, 0.03, { delay: i * 0.03, wet: true }); hiss(0.6, 0.1, { type: 'highpass', f: 4000 }); },
    thunder() { hiss(1.6, 0.25, { f: 400, to: 60, wet: true }); },
    quake() { tone('sine', 40, 1.6, 0.35, { to: 28 }); hiss(1.5, 0.2, { f: 200, to: 60 }); },
    mend() { [60, 64, 67, 72].forEach((n, i) => tone('sine', midi(n), 1.2, 0.05, { delay: i * 0.08, wet: true, attack: 0.1 })); },
    midas() { for (let i = 0; i < 8; i++) tone('square', 1400 + Math.random() * 800, 0.05, 0.03, { delay: i * 0.05, filter: 5000 }); },
    arrows() { for (let i = 0; i < 10; i++) hiss(0.15, 0.04, { type: 'highpass', f: 2500 + Math.random() * 2000, delay: i * 0.1 }); },
    alarm() { if (limit('alarm', 2.5)) { tone('triangle', midi(84), 0.4, 0.06, { wet: true }); tone('triangle', midi(84), 0.4, 0.06, { delay: 0.45, wet: true }); } },
    relic() { [64, 68, 71, 76, 80].forEach((n, i) => tone('sine', midi(n), 0.5, 0.05, { delay: i * 0.07, wet: true })); },
    newFoe() { tone('sawtooth', midi(43), 0.6, 0.08, { filter: 600, wet: true }); tone('sawtooth', midi(46), 0.6, 0.07, { delay: 0.3, filter: 600, wet: true }); },
};

// ------------------------------------------------------------------ Music

const MODES = {
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const REGION_MUSIC = [
    { root: 50, mode: 'mixolydian', bpm: 96, prog: [0, 3, 4, 0] },
    { root: 47, mode: 'dorian', bpm: 84, prog: [0, 3, 6, 4] },
    { root: 45, mode: 'phrygian', bpm: 112, prog: [0, 1, 0, 6] },
    { root: 52, mode: 'aeolian', bpm: 88, prog: [0, 5, 3, 4] },
    { root: 46, mode: 'harmonic', bpm: 80, prog: [0, 5, 4, 0] },
    { root: 44, mode: 'phrygian', bpm: 118, prog: [0, 1, 5, 4] },
];

const M = { on: false, region: 0, intensity: 0, step: 0, next: 0, melody: [], seed: 1 };

export function setMusicState(region, intensity) {
    if (M.region !== region) { M.region = region; M.melody = []; }
    M.intensity = intensity;
    if (!M.on && ctx) { M.on = true; M.next = ctx.currentTime + 0.1; }
}

function scaleNote(sc, root, deg) {
    const o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
    return root + sc[i] + 12 * o;
}

function schedule() {
    if (!ctx || !M.on) return;
    const R = REGION_MUSIC[M.region % REGION_MUSIC.length];
    const sc = MODES[R.mode];
    const bpm = R.bpm * (M.intensity >= 2 ? 1.12 : 1);
    const sixteenth = 60 / bpm / 4;
    while (M.next < ctx.currentTime + 0.15) {
        const t = M.next;
        const s = M.step;
        const bar = Math.floor(s / 16), beat = s % 16;
        const chord = R.prog[bar % 4];
        const bus = music;
        // drone: root + fifth, refreshed every bar
        if (beat === 0) {
            tone('sawtooth', midi(scaleNote(sc, R.root - 12, chord)), sixteenth * 16.5, 0.05, { at: t, filter: 500, attack: 0.3, bus });
            tone('sawtooth', midi(scaleNote(sc, R.root - 12, chord + 4)), sixteenth * 16.5, 0.035, { at: t, filter: 450, attack: 0.3, bus, detune: 6 });
        }
        // lute arpeggio
        const arpEvery = M.intensity >= 1 ? 2 : 4;
        if (beat % arpEvery === 0) {
            const pat = [0, 2, 4, 7, 4, 2, 0, 4];
            const n = scaleNote(sc, R.root, chord + pat[(beat / arpEvery) % pat.length]);
            tone('triangle', midi(n), sixteenth * 3, 0.06, { at: t, filter: 2400, filterTo: 600, bus });
            tone('square', midi(n), sixteenth * 1.5, 0.012, { at: t, filter: 1800, bus });
        }
        // frame drum
        if (M.intensity >= 1) {
            if (beat === 0 || beat === 10 || (M.intensity >= 2 && beat === 6)) tone('sine', 90, 0.25, 0.25, { at: t, to: 45, bus });
            if (beat === 4 || beat === 12) { const src = ctx.createBufferSource(); src.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + 0.15); }
            if (M.intensity >= 2 && beat % 2 === 1) tone('sine', 140, 0.08, 0.05, { at: t, to: 80, bus });
        }
        // flute melody: a motif per region, regenerated every 8 bars
        if (beat % 4 === 0 && (M.intensity >= 1 || bar % 2 === 1)) {
            if (!M.melody.length || (bar % 8 === 0 && beat === 0)) {
                M.melody = [];
                let d = 7;
                for (let i = 0; i < 16; i++) { d += Math.floor(Math.random() * 5) - 2; d = Math.max(4, Math.min(12, d)); M.melody.push(Math.random() < 0.25 ? null : d); }
            }
            const d = M.melody[(bar % 4) * 4 + beat / 4];
            if (d !== null && d !== undefined) tone('sine', midi(scaleNote(sc, R.root + 12, d)), sixteenth * 3.6, 0.045, { at: t, attack: 0.05, vib: 5.5, bus, wet: true });
        }
        // boss brass ostinato
        if (M.intensity >= 2 && (beat === 0 || beat === 3 || beat === 6 || beat === 8)) {
            tone('sawtooth', midi(scaleNote(sc, R.root - 12, chord + (beat === 6 ? 1 : 0))), sixteenth * 2.2, 0.07, { at: t, filter: 800, attack: 0.02, bus });
        }
        M.step++;
        M.next += sixteenth;
    }
}
