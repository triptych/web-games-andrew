/**
 * audio.js — everything you hear, synthesised with Web Audio: no sound files.
 *
 *   Engine   two detuned saws and a square sub through a waveshaper and a low-pass, pitched by an
 *            RPM that climbs through five gears (with a dip at each shift). The pack gets a second,
 *            quieter engine voice that follows the nearest opponent.
 *   Beds     tyre scrub (band-passed noise by slip), surface rumble (low-passed noise by speed and
 *            roughness), wind, and a nitro hiss.
 *   One-shots  countdown, go, bumps, landings, scrapes, splashes, coins, laps, the crowd, fireworks,
 *            UI clicks and purchases, and a voice blip per character for the dialogue.
 *   Music    a small step sequencer with a style per place: a country shuffle in the garage,
 *            driving rock on the flats, a spaghetti-western canyon, swamp blues, cold synths on the
 *            pass, synthwave in the Thunderdome and an epic minor for the Crown.
 */

let ctx = null, master, musicBus, sfxBus, comp;
let noiseBuf = null;
const vol = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });
}

export function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(vol.muted ? 0 : vol.master, t, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.5, t, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.05);
}
export const isReady = () => !!ctx;

// ------------------------------------------------------------------ helpers
function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function tone(type, f, dur, v = 0.2, delay = 0, f2 = null, bus = sfxBus) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.005, v, dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, v = 0.2, type = 'lowpass', f = 1000, q = 1, delay = 0, f2 = null, bus = sfxBus) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    env(g, t, 0.005, v, dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function loopNoise(type, f, q) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(sfxBus);
    s.start();
    return { s, fl, g };
}

// ------------------------------------------------------------------ engines and beds
function makeEngine(level = 1) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
    ws.curve = curve;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0;
    const m1 = ctx.createGain(), m2 = ctx.createGain(), m3 = ctx.createGain();
    m1.gain.value = 0.32; m2.gain.value = 0.22; m3.gain.value = 0.3;
    o1.connect(m1); o2.connect(m2); o3.connect(m3);
    m1.connect(ws); m2.connect(ws); m3.connect(ws);
    ws.connect(lp); lp.connect(g); g.connect(sfxBus);
    o1.start(); o2.start(); o3.start();
    return { o1, o2, o3, lp, g, level, rpm: 0.2, gear: 0, shiftT: 0 };
}

let eng = null, pack = null, skid = null, rumble = null, wind = null, hiss = null;

export function startRaceAudio() {
    if (!ctx) return;
    stopRaceAudio();
    eng = makeEngine(1);
    pack = makeEngine(0.5);
    skid = loopNoise('bandpass', 1100, 1.4);
    rumble = loopNoise('lowpass', 180, 0.8);
    wind = loopNoise('highpass', 1800, 0.5);
    hiss = loopNoise('bandpass', 3200, 0.8);
}
export function stopRaceAudio() {
    for (const e of [eng, pack]) if (e) { const t = ctx.currentTime; e.g.gain.setTargetAtTime(0, t, 0.05); [e.o1, e.o2, e.o3].forEach((o) => o.stop(t + 0.3)); }
    for (const b of [skid, rumble, wind, hiss]) if (b) { b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); b.s.stop(ctx.currentTime + 0.3); }
    eng = pack = skid = rumble = wind = hiss = null;
}

function driveEngine(e, speedFrac, throttle, boost, dt, loud) {
    // Web Audio throws on a non-finite value; never let one through.
    const fin = (v, d) => (Number.isFinite(v) ? v : d);
    speedFrac = Math.max(0, Math.min(1, fin(speedFrac, 0)));
    throttle = fin(throttle, 0); loud = fin(loud, 0); dt = fin(dt, 0.016);
    if (!Number.isFinite(e.rpm)) e.rpm = 0.2;
    // Five gears: rpm climbs within each band of speed, and drops at the shift.
    const g = Math.min(4, Math.floor(speedFrac * 5.2));
    if (g !== e.gear) { e.shiftT = 0.12; e.gear = g; }
    const lo = g / 5.2, hi = (g + 1) / 5.2;
    let target = 0.25 + 0.75 * Math.max(0, Math.min(1, (speedFrac - lo) / (hi - lo)));
    if (speedFrac < 0.03) target = 0.18 + throttle * 0.5;
    if (e.shiftT > 0) { e.shiftT -= dt; target *= 0.75; }
    e.rpm += (target - e.rpm) * Math.min(1, dt * 10);
    const f = 38 + e.rpm * 120 + g * 6 + (boost ? 12 : 0);
    const t = ctx.currentTime;
    e.o1.frequency.setTargetAtTime(f, t, 0.03);
    e.o2.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    e.o3.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.lp.frequency.setTargetAtTime(380 + e.rpm * 1700 + throttle * 900 + (boost ? 900 : 0), t, 0.04);
    e.g.gain.setTargetAtTime((0.05 + throttle * 0.07 + e.rpm * 0.04) * loud * e.level, t, 0.05);
}

/** Feed the race sounds every frame. */
export function raceAudio(dt, p) {
    if (!ctx || !eng) return;
    const t = ctx.currentTime;
    driveEngine(eng, p.speedFrac, p.throttle, p.boost, dt, p.paused ? 0 : 1);
    if (pack) driveEngine(pack, p.packSpeed, 0.8, false, dt, p.paused || !Number.isFinite(p.packDist) ? 0 : Math.max(0, 1 - p.packDist / 40) * 0.6);
    skid.g.gain.setTargetAtTime(p.paused ? 0 : Math.min(0.22, Math.max(0, p.slip - 0.1) * 0.5 * Math.min(1, p.speed / 10)) * (p.air ? 0 : 1), t, 0.05);
    skid.fl.frequency.setTargetAtTime(p.wet ? 500 : p.ice ? 2200 : 1100, t, 0.1);
    rumble.g.gain.setTargetAtTime(p.paused ? 0 : (p.air ? 0 : Math.min(0.25, p.speed * 0.006 * (1 + p.rough * 2))), t, 0.05);
    wind.g.gain.setTargetAtTime(p.paused ? 0 : Math.min(0.08, p.speed * 0.0016), t, 0.1);
    hiss.g.gain.setTargetAtTime(p.paused ? 0 : (p.boost ? 0.12 : 0), t, 0.04);
}

// ------------------------------------------------------------------ one-shots
export const sfx = {
    click: () => tone('triangle', 720, 0.06, 0.12),
    hover: () => tone('sine', 1100, 0.03, 0.04),
    back: () => tone('triangle', 420, 0.08, 0.1),
    deny: () => { tone('square', 140, 0.18, 0.08); tone('square', 110, 0.2, 0.06, 0.08); },
    buy: () => { tone('sine', 1320, 0.25, 0.12); tone('sine', 1760, 0.3, 0.1, 0.08); noise(0.15, 0.06, 'highpass', 5000); tone('triangle', 2640, 0.4, 0.05, 0.16); },
    paint: () => { noise(0.4, 0.1, 'bandpass', 3000, 2, 0, 1500); },
    beep: () => tone('square', 440, 0.2, 0.12),
    go: () => { tone('square', 880, 0.5, 0.14); tone('square', 1320, 0.5, 0.06); },
    launch: (good) => good ? (tone('sawtooth', 220, 0.4, 0.1, 0, 660), noise(0.5, 0.15, 'bandpass', 2400, 1, 0, 600)) : tone('square', 160, 0.3, 0.1, 0, 90),
    bump: (v) => { noise(0.18, Math.min(0.35, 0.08 + v * 0.03), 'lowpass', 500); tone('sine', 90, 0.15, Math.min(0.3, v * 0.04), 0, 50); },
    wall: (v) => { noise(0.25, Math.min(0.3, 0.06 + v * 0.025), 'bandpass', 2600, 2, 0, 900); tone('sine', 70, 0.2, Math.min(0.25, v * 0.03)); },
    land: (impact) => { noise(0.25, Math.min(0.4, 0.08 + impact * 0.025), 'lowpass', 300); tone('sine', 60, 0.2, Math.min(0.35, impact * 0.03)); },
    splash: () => { noise(0.6, 0.22, 'lowpass', 2400, 0.7, 0, 400); noise(0.3, 0.1, 'highpass', 4000); },
    coin: () => { tone('square', 1046, 0.07, 0.06); tone('square', 1568, 0.16, 0.06, 0.06); },
    lap: () => { tone('triangle', 880, 0.12, 0.12); tone('triangle', 1175, 0.2, 0.12, 0.1); },
    finalLap: () => { [659, 784, 988, 1319].forEach((f, i) => tone('triangle', f, 0.14, 0.12, i * 0.09)); },
    elim: () => { tone('sawtooth', 600, 0.5, 0.08, 0, 150); },
    nitro: () => { noise(0.6, 0.2, 'bandpass', 800, 1, 0, 4000); tone('sawtooth', 120, 0.5, 0.06, 0, 400); },
    reset: () => { tone('sine', 300, 0.3, 0.1, 0, 900); },
    wrong: () => { tone('square', 300, 0.15, 0.06); tone('square', 300, 0.15, 0.06, 0.2); },
    win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0.2, 0.08, i * 0.12)); cheer(1.5); },
    podium: () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0.22, 0.1, i * 0.12)); cheer(0.8); },
    lose: () => { [392, 370, 349, 330].forEach((f, i) => tone('triangle', f, 0.35, 0.1, i * 0.25)); },
    medal: () => { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, 0.3, 0.1, i * 0.08)); },
    firework: () => { noise(0.08, 0.2, 'highpass', 800); for (let k = 0; k < 8; k++) noise(0.04, 0.05, 'highpass', 5000, 1, 0.2 + Math.random() * 0.5); },
    tick: () => tone('sine', 1800, 0.03, 0.05),
    cheer: (a = 1) => cheer(a),
    voice: (who) => {
        const f = { gus: 150, june: 330, colt: 220, victor: 130, rex: 260, earl: 120, fern: 300, sal: 200, gator: 140, ivanka: 280, max: 240, you: 250 }[who] || 220;
        tone('square', f * (0.9 + Math.random() * 0.25), 0.045, 0.035);
    },
};

function cheer(a = 1) {
    if (!ctx) return;
    noise(1.8 * a, 0.12 * a, 'bandpass', 1400, 0.6, 0, 900);
    for (let k = 0; k < 5 * a; k++) tone('sine', 1500 + Math.random() * 1200, 0.25, 0.025, Math.random() * 1.2, 2200 + Math.random() * 800);
}

// ------------------------------------------------------------------ music
const STYLES = {
    garage: { bpm: 96, root: 55, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], swing: 0.18, drums: 'shuffle', lead: 'pluck', pad: 0.03, bassPat: [0, -1, 2, -1, 0, -1, 2, -1, 0, -1, 2, -1, 0, -1, 2, 1] },
    flats:  { bpm: 138, root: 55, scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 6, 3, 0], swing: 0, drums: 'rock', lead: 'twang', pad: 0.04, bassPat: [0, -1, 0, 0, 2, -1, 0, -1, 0, -1, 0, 0, 4, -1, 2, -1] },
    woods:  { bpm: 128, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], swing: 0.08, drums: 'rock', lead: 'pluck', pad: 0.05, bassPat: [0, -1, 0, -1, 0, -1, 4, -1, 0, -1, 0, -1, 3, -1, 2, -1] },
    canyon: { bpm: 120, root: 52, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 1, 0, 6], swing: 0.12, drums: 'gallop', lead: 'whistle', pad: 0.04, bassPat: [0, -1, -1, 0, 0, -1, -1, 0, 0, -1, -1, 0, 4, -1, 1, -1] },
    bayou:  { bpm: 112, root: 45, scale: [0, 3, 5, 6, 7, 10], prog: [0, 0, 2, 0], swing: 0.22, drums: 'shuffle', lead: 'twang', pad: 0.05, bassPat: [0, -1, 1, -1, 2, -1, 3, -1, 4, -1, 3, -1, 2, -1, 1, -1] },
    frost:  { bpm: 132, root: 49, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], swing: 0, drums: 'four', lead: 'bell', pad: 0.07, bassPat: [0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 4, -1, 3, -1] },
    dome:   { bpm: 150, root: 48, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], swing: 0, drums: 'four', lead: 'saw', pad: 0.06, bassPat: [0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 7, 7] },
    mesa:   { bpm: 136, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], swing: 0, drums: 'rock', lead: 'brass', pad: 0.07, bassPat: [0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 4, -1, 6, -1] },
    title:  { bpm: 124, root: 52, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], swing: 0.1, drums: 'rock', lead: 'twang', pad: 0.05, bassPat: [0, -1, 0, -1, 0, -1, 4, -1, 0, -1, 0, -1, 3, -1, 4, -1] },
    victory:{ bpm: 110, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], swing: 0.1, drums: 'shuffle', lead: 'brass', pad: 0.06, bassPat: [0, -1, 4, -1, 0, -1, 4, -1, 0, -1, 4, -1, 0, -1, 4, -1] },
};

const mus = { style: null, step: 0, next: 0, timer: 0, seed: 1, lead: [] };
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function playMusic(style) {
    if (!ctx || mus.style === style) return;
    mus.style = style;
    mus.step = 0;
    mus.next = ctx.currentTime + 0.12;
    mus.seed = style.length * 7919;
    // A lead phrase per style: 32 steps of scale degrees, rests and holds.
    let s = mus.seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    mus.lead = [];
    for (let i = 0; i < 64; i++) mus.lead.push(i % 4 === 0 || rnd() < 0.45 ? Math.floor(rnd() * 7) : -1);
    if (!mus.timer) mus.timer = setInterval(tickMusic, 30);
}
export function stopMusic() { mus.style = null; }
export function duckMusic(on) { if (ctx) musicBus.gain.setTargetAtTime(on ? vol.music * 0.2 : vol.music * 0.5, ctx.currentTime, 0.3); }

function tickMusic() {
    if (!ctx || !mus.style || ctx.state !== 'running') return;
    const S = STYLES[mus.style];
    const spb = 60 / S.bpm / 4;
    while (mus.next < ctx.currentTime + 0.15) {
        const st = mus.step;
        const swing = st % 2 ? spb * S.swing : 0;
        playStep(S, st, mus.next + swing, spb);
        mus.next += spb;
        mus.step = (mus.step + 1) % 64;
    }
}

function deg(S, d, oct = 0) { const sc = S.scale; const n = sc.length; const o = Math.floor(d / n); return S.root + sc[((d % n) + n) % n] + 12 * (o + oct); }

function playStep(S, st, t, spb) {
    const bar = Math.floor(st / 16) % 4, b = st % 16;
    const chord = S.prog[bar];
    // Drums.
    const kick = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.002, 0.5, 0.18); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25); };
    const snare = (v = 0.25) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400; const g = ctx.createGain(); env(g, t, 0.002, v, 0.16); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.2); };
    const hat = (v = 0.06) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); env(g, t, 0.001, v, 0.04); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06); };
    if (S.drums === 'rock') { if (b === 0 || b === 8 || b === 10) kick(); if (b === 4 || b === 12) snare(); if (b % 2 === 0) hat(); }
    else if (S.drums === 'four') { if (b % 4 === 0) kick(); if (b === 4 || b === 12) snare(0.2); if (b % 4 === 2) hat(0.09); else if (b % 2 === 1) hat(0.03); }
    else if (S.drums === 'shuffle') { if (b === 0 || b === 8) kick(); if (b === 4 || b === 12) snare(0.15); if (b % 4 !== 1) hat(0.04); }
    else if (S.drums === 'gallop') { if (b % 4 === 0) kick(); if (b % 4 === 2 || b % 4 === 3) hat(0.07); if (b === 12) snare(0.18); }
    // Bass.
    const bp = S.bassPat[b];
    if (bp >= 0) {
        const n = deg(S, chord + bp, -1);
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = midi(n);
        f.type = 'lowpass'; f.frequency.value = 500;
        env(g, t, 0.005, 0.16, spb * 1.6);
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + spb * 2);
    }
    // Pad chord at the bar.
    if (b === 0 && S.pad) {
        for (const k of [0, 2, 4]) {
            const n = deg(S, chord + k, 0);
            const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = (k - 2) * 6;
            f.type = 'lowpass'; f.frequency.value = 900;
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(S.pad, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
            o.connect(f); f.connect(g); g.connect(musicBus);
            o.start(t); o.stop(t + spb * 16 + 0.05);
        }
    }
    // Lead.
    const ld = mus.lead[st];
    if (ld >= 0 && (bar % 2 === 1 || S.lead === 'pluck' || S.lead === 'bell')) {
        const n = deg(S, chord + ld, 1);
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        const type = { twang: 'square', pluck: 'triangle', whistle: 'sine', bell: 'sine', saw: 'sawtooth', brass: 'sawtooth' }[S.lead];
        o.type = type; o.frequency.value = midi(n);
        if (S.lead === 'twang') { o.frequency.setValueAtTime(midi(n) * 0.97, t); o.frequency.exponentialRampToValueAtTime(midi(n), t + 0.05); }
        if (S.lead === 'whistle') { o.frequency.setValueAtTime(midi(n + 12) * 0.98, t); o.frequency.linearRampToValueAtTime(midi(n + 12), t + 0.08); }
        f.type = 'lowpass'; f.frequency.setValueAtTime(S.lead === 'brass' ? 2400 : 3200, t); f.frequency.exponentialRampToValueAtTime(700, t + spb * 2);
        const v = S.lead === 'bell' ? 0.06 : S.lead === 'whistle' ? 0.05 : 0.05;
        env(g, t, S.lead === 'brass' ? 0.03 : 0.004, v, spb * (S.lead === 'bell' ? 4 : 2));
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + spb * 4 + 0.05);
    }
}
