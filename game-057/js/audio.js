/**
 * audio.js — every sound is synthesised with Web Audio: a voice per weapon,
 * explosions with a sub thump, chitters and screeches, doors, radio static,
 * and a generative dark-synth score with three intensity layers (explore,
 * combat drums, boss lead) per sector key and tempo.
 */

let ctx = null, master, sfxBus, musicBus, comp, noiseBuf, delay, delayFb, delayWet;
const vol = { master: 0.8, sfx: 0.9, music: 0.55 };
const last = {};

export function audioReady() { return !!ctx; }

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(comp); musicBus.connect(comp);
    comp.connect(master); master.connect(ctx.destination);
    // A shared echo for space.
    delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
    delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    delayWet = ctx.createGain(); delayWet.gain.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delay.connect(lp); lp.connect(delayFb); delayFb.connect(delay); lp.connect(delayWet); delayWet.connect(comp);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
}

export function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
function applyVolumes() {
    if (!ctx) return;
    master.gain.value = vol.master;
    sfxBus.gain.value = vol.sfx;
    musicBus.gain.value = vol.music;
}

const now = () => ctx.currentTime;
function throttle(key, gap) {
    if (!ctx) return true;
    const t = now();
    if (last[key] && t - last[key] < gap) return true;
    last[key] = t;
    return false;
}

function env(g, t, a, peak, dur, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + a + dur);
}

function tone(type, f0, dur, v, o = {}) {
    if (!ctx) return;
    const t = now() + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    env(g, t, o.attack ?? 0.004, v, dur);
    let node = osc;
    if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filter; f.frequency.setValueAtTime(o.ff ?? 1000, t); f.Q.value = o.q ?? 1;
        if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
        node.connect(f); node = f;
    }
    if (o.fm) {
        const m = ctx.createOscillator(), mg = ctx.createGain();
        m.frequency.value = o.fm; mg.gain.value = o.fmDepth ?? f0 * 0.5;
        m.connect(mg); mg.connect(osc.frequency);
        m.start(t); m.stop(t + dur + 0.1);
    }
    node.connect(g);
    g.connect(o.dest ?? sfxBus);
    if (o.echo) g.connect(delay);
    osc.start(t);
    osc.stop(t + (o.attack ?? 0.004) + dur + 0.05);
}

function noise(dur, v, o = {}) {
    if (!ctx) return;
    const t = now() + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.ff ?? 2000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    f.Q.value = o.q ?? 0.7;
    const g = ctx.createGain();
    env(g, t, o.attack ?? 0.003, v, dur);
    src.connect(f); f.connect(g); g.connect(o.dest ?? sfxBus);
    if (o.echo) g.connect(delay);
    src.start(t, Math.random() * 1.5);
    src.stop(t + (o.attack ?? 0.003) + dur + 0.05);
}

// ------------------------------------------------------------------ Flame loop

let flame = null, flameStop = 0;
function flameOn() {
    if (!ctx) return;
    flameStop = now() + 0.14;
    if (flame) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 13; lg.gain.value = 300;
    lfo.connect(lg); lg.connect(f.frequency);
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.32, now() + 0.06);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(); lfo.start();
    flame = { src, g, lfo };
    const tick = () => {
        if (!flame) return;
        if (now() > flameStop) {
            flame.g.gain.linearRampToValueAtTime(0.0001, now() + 0.12);
            const f2 = flame; flame = null;
            setTimeout(() => { f2.src.stop(); f2.lfo.stop(); }, 200);
            return;
        }
        setTimeout(tick, 50);
    };
    tick();
}

// ------------------------------------------------------------------ Sound bank

export const S = {
    shot(weapon) {
        if (!ctx) return;
        switch (weapon) {
        case 'pulse':
            if (throttle('pulse', 0.05)) return;
            tone('square', 900 + Math.random() * 60, 0.07, 0.07, { to: 240, filter: 'lowpass', ff: 3500 });
            noise(0.04, 0.12, { filter: 'highpass', ff: 2500 });
            tone('sine', 140, 0.06, 0.14, { to: 60 });
            break;
        case 'scatter':
            noise(0.28, 0.55, { ff: 3200, fto: 300 });
            tone('sine', 95, 0.22, 0.5, { to: 38 });
            noise(0.03, 0.2, { filter: 'highpass', ff: 4000 });
            noise(0.05, 0.12, { filter: 'bandpass', ff: 1800, q: 4, delay: 0.32 }); // pump
            break;
        case 'flame': flameOn(); break;
        case 'smart':
            if (throttle('smart', 0.06)) return;
            tone('triangle', 1500, 0.05, 0.06, { to: 700 });
            noise(0.03, 0.06, { filter: 'highpass', ff: 3000 });
            break;
        case 'arc':
            noise(0.16, 0.3, { filter: 'bandpass', ff: 3200, q: 2.5, rate: 0.5 });
            tone('sawtooth', 70, 0.14, 0.18, { to: 35, fm: 47, fmDepth: 60 });
            tone('square', 2400, 0.08, 0.05, { to: 600 });
            break;
        case 'rail':
            noise(0.45, 0.5, { filter: 'highpass', ff: 600, fto: 6000 });
            tone('sawtooth', 1800, 0.45, 0.3, { to: 80, filter: 'lowpass', ff: 6000, fto: 400, echo: true });
            tone('sine', 70, 0.35, 0.5, { to: 30 });
            break;
        case 'gl':
            tone('sine', 220, 0.16, 0.45, { to: 70 });
            noise(0.12, 0.25, { ff: 700 });
            break;
        case 'minigun':
            if (throttle('mini', 0.04)) return;
            noise(0.035, 0.22, { filter: 'bandpass', ff: 1600, q: 0.8 });
            tone('square', 210, 0.03, 0.07, { to: 120 });
            break;
        case 'plasma':
            tone('sawtooth', 360, 0.4, 0.28, { to: 55, filter: 'lowpass', ff: 3000, fto: 200, fm: 24, fmDepth: 80, echo: true });
            tone('sine', 120, 0.3, 0.3, { to: 40 });
            break;
        case 'drone':
            if (throttle('drone', 0.1)) return;
            tone('square', 1900, 0.03, 0.025, { to: 900 });
            break;
        case 'ellie':
            if (throttle('ellie', 0.1)) return;
            noise(0.05, 0.12, { filter: 'bandpass', ff: 2200 });
            tone('square', 640, 0.05, 0.05, { to: 200 });
            break;
        default: break;
        }
    },
    charge() { tone('sine', 220, 0.5, 0.12, { to: 1400, glide: 0.5, attack: 0.05 }); },
    hit() { if (throttle('hit', 0.035)) return; noise(0.04, 0.09, { filter: 'bandpass', ff: 900 + Math.random() * 600, q: 1.5 }); },
    kill(kind, big) {
        if (throttle('kill', big ? 0.02 : 0.045)) return;
        noise(big ? 0.3 : 0.14, big ? 0.35 : 0.18, { filter: 'bandpass', ff: big ? 500 : 900, fto: 200, q: 1.2 });
        tone('square', 300 + Math.random() * 400, 0.08, 0.05, { to: 120, fm: 70, fmDepth: 200 });
        if (big) tone('sine', 90, 0.25, 0.3, { to: 40 });
    },
    explode(r) {
        if (throttle('boom', 0.04)) return;
        const big = r > 2.5;
        noise(big ? 1.3 : 0.7, big ? 0.85 : 0.55, { ff: big ? 1600 : 2200, fto: 90, echo: big });
        tone('sine', big ? 70 : 100, big ? 0.7 : 0.4, big ? 0.9 : 0.6, { to: 25 });
        noise(0.05, 0.3, { filter: 'highpass', ff: 3000 });
    },
    acid() { if (throttle('acid', 0.05)) return; noise(0.5, 0.3, { filter: 'bandpass', ff: 1400, fto: 300, q: 2 }); tone('sine', 300, 0.3, 0.1, { to: 900, fm: 30, fmDepth: 200 }); },
    hurt() {
        tone('sine', 220, 0.16, 0.4, { to: 70 });
        noise(0.1, 0.25, { ff: 900 });
        tone('square', 880, 0.05, 0.05, { delay: 0.05 });
    },
    roll() { noise(0.22, 0.18, { filter: 'bandpass', ff: 400, fto: 1600, q: 1 }); },
    pickup(kind) {
        if (kind === 'salvage') { if (throttle('coin', 0.03)) return; tone('sine', 1300 + Math.random() * 300, 0.06, 0.07, { to: 2000 }); return; }
        if (kind === 'weapon' || kind === 'mod') { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, 0.1, 0.06, { delay: i * 0.06, filter: 'lowpass', ff: 3000 })); return; }
        if (kind === 'power') { [392, 523, 659, 784, 1046].forEach((f, i) => tone('sawtooth', f, 0.12, 0.05, { delay: i * 0.04, filter: 'lowpass', ff: 2500, echo: true })); return; }
        tone('sine', 660, 0.08, 0.12); tone('sine', 990, 0.12, 0.1, { delay: 0.07 });
    },
    reload() { noise(0.03, 0.15, { filter: 'highpass', ff: 2000 }); noise(0.04, 0.12, { filter: 'bandpass', ff: 900, delay: 0.12 }); },
    reloaded() { noise(0.04, 0.18, { filter: 'bandpass', ff: 1400 }); tone('square', 300, 0.03, 0.05, { delay: 0.03 }); },
    empty() { if (throttle('empty', 0.25)) return; noise(0.02, 0.15, { filter: 'highpass', ff: 3000 }); },
    swap() { noise(0.05, 0.12, { filter: 'bandpass', ff: 1200 }); tone('square', 500, 0.03, 0.04, { delay: 0.05 }); },
    door(open) {
        if (throttle('door', 0.1)) return;
        noise(0.45, 0.2, { filter: 'bandpass', ff: open ? 1600 : 900, fto: open ? 400 : 1600, q: 1.5 });
        tone('sine', 70, 0.25, 0.35, { to: 40, delay: open ? 0 : 0.35 });
    },
    lock() {
        for (let i = 0; i < 3; i++) { tone('square', 880, 0.12, 0.06, { delay: i * 0.3, filter: 'lowpass', ff: 2500 }); tone('square', 660, 0.12, 0.06, { delay: i * 0.3 + 0.15, filter: 'lowpass', ff: 2500 }); }
    },
    clear() { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, 0.25, 0.1, { delay: i * 0.08, echo: true })); },
    spawn() { if (throttle('spawn', 0.09)) return; noise(0.3, 0.06, { filter: 'highpass', ff: 3500, attack: 0.1 }); },
    screech(kind) {
        if (throttle('screech', 0.18)) return;
        const f = kind === 'drone' ? 700 : 900;
        tone('sawtooth', f, 0.3, 0.07, { to: f * 1.6, glide: 0.1, fm: 80 + Math.random() * 40, fmDepth: 300, filter: 'bandpass', ff: 1800, q: 2 });
    },
    roar(big) {
        if (throttle('roar', 0.5)) return;
        tone('sawtooth', big ? 70 : 110, big ? 1.2 : 0.7, big ? 0.35 : 0.2, { to: big ? 45 : 70, fm: 31, fmDepth: 60, filter: 'lowpass', ff: 900, attack: 0.08, echo: true });
        noise(big ? 1 : 0.6, big ? 0.3 : 0.15, { filter: 'lowpass', ff: 600, attack: 0.1 });
    },
    thud() { if (throttle('thud', 0.1)) return; tone('sine', 80, 0.3, 0.55, { to: 30 }); noise(0.2, 0.25, { ff: 500 }); },
    pulse() {
        tone('sine', 120, 0.5, 0.4, { to: 2400, glide: 0.25, echo: true });
        noise(0.5, 0.35, { filter: 'highpass', ff: 300, fto: 5000 });
        tone('sine', 60, 0.6, 0.5, { to: 30 });
    },
    radio() { noise(0.18, 0.12, { filter: 'bandpass', ff: 2200, q: 1 }); tone('sine', 1250, 0.07, 0.07, { delay: 0.16 }); },
    ui() { tone('square', 1200, 0.03, 0.04, { filter: 'lowpass', ff: 3000 }); },
    hover() { if (throttle('hover', 0.05)) return; tone('sine', 1800, 0.02, 0.02); },
    denied() { tone('square', 200, 0.12, 0.08); tone('square', 150, 0.15, 0.08, { delay: 0.1 }); },
    buy() { tone('triangle', 784, 0.1, 0.1); tone('triangle', 1175, 0.15, 0.1, { delay: 0.08 }); noise(0.05, 0.1, { filter: 'highpass', ff: 3000, delay: 0.05 }); },
    chest() { noise(0.3, 0.2, { filter: 'bandpass', ff: 800, fto: 2000 }); [523, 784, 1046].forEach((f, i) => tone('triangle', f, 0.2, 0.08, { delay: 0.2 + i * 0.07, echo: true })); },
    heal() { [440, 554, 659, 880].forEach((f, i) => tone('sine', f, 0.3, 0.08, { delay: i * 0.06, echo: true })); },
    upgrade() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, 0.12, 0.05, { delay: i * 0.05, filter: 'lowpass', ff: 3500, echo: true })); },
    throw() { noise(0.12, 0.1, { filter: 'bandpass', ff: 1200, fto: 600 }); },
    bounce() { if (throttle('bounce', 0.05)) return; tone('square', 900, 0.02, 0.04); },
    spit() { if (throttle('spit', 0.08)) return; noise(0.12, 0.12, { filter: 'bandpass', ff: 1400, q: 3 }); tone('sine', 400, 0.1, 0.06, { to: 200 }); },
    eshot(heavy) { if (throttle('eshot', heavy ? 0.06 : 0.09)) return; noise(0.05, heavy ? 0.16 : 0.1, { filter: 'bandpass', ff: 1300 }); tone('square', 400, 0.04, 0.04, { to: 150 }); },
    buzz() { if (throttle('buzz', 0.2)) return; tone('sawtooth', 220, 0.4, 0.06, { fm: 180, fmDepth: 60, filter: 'bandpass', ff: 900, q: 3 }); },
    slash() { noise(0.1, 0.2, { filter: 'highpass', ff: 2500, fto: 800 }); },
    telegraph() { if (throttle('tele', 0.15)) return; tone('square', 520, 0.18, 0.05, { filter: 'lowpass', ff: 1500 }); },
    elevator() { tone('sawtooth', 60, 2.5, 0.2, { to: 40, filter: 'lowpass', ff: 300, attack: 0.3 }); noise(2.5, 0.12, { ff: 400, attack: 0.3 }); },
    bossDead() { this.explode(4); tone('sawtooth', 60, 2.5, 0.35, { to: 25, fm: 13, fmDepth: 40, filter: 'lowpass', ff: 500, echo: true }); },
    victory() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0.4, 0.1, { delay: i * 0.14, echo: true })); },
    death() { tone('sawtooth', 220, 1.6, 0.2, { to: 40, filter: 'lowpass', ff: 1200, fto: 100, echo: true }); noise(1.2, 0.2, { ff: 800, fto: 100 }); },
    heartbeat() { tone('sine', 55, 0.12, 0.35, { to: 40 }); tone('sine', 50, 0.1, 0.25, { to: 38, delay: 0.18 }); },
    power() { this.pickup('power'); },
    perk() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0.3, 0.07, { delay: i * 0.07, echo: true })); },
    typing() { if (throttle('type', 0.035)) return; tone('square', 1800 + Math.random() * 400, 0.012, 0.012); },
};

// ------------------------------------------------------------------ Music

const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
};
const PROG = [0, 5, 3, 4, 0, 5, 6, 4]; // scale degrees per 2 bars
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const M = { on: false, theme: null, step: 0, next: 0, timer: null, intensity: 0, target: 0, layers: null, seed: 1 };

function mrand() { M.seed = (M.seed * 16807) % 2147483647; return (M.seed % 10000) / 10000; }

export function startMusic(theme) {
    if (!ctx) return;
    stopMusic();
    M.theme = theme;
    M.on = true;
    M.step = 0;
    M.next = now() + 0.1;
    M.seed = 1 + Math.floor(Math.random() * 1000);
    const mk = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(musicBus); return g; };
    M.layers = { pad: mk(0.0001), bass: mk(0.0001), drums: mk(0.0001), lead: mk(0.0001), plink: mk(0.0001) };
    M.layers.pad.gain.linearRampToValueAtTime(0.5, now() + 3);
    M.layers.plink.gain.linearRampToValueAtTime(0.35, now() + 3);
    M.layers.plink.connect(delay);
    M.timer = setInterval(schedule, 25);
}

export function stopMusic() {
    if (M.timer) clearInterval(M.timer);
    M.timer = null;
    M.on = false;
    if (M.layers && ctx) for (const k in M.layers) { const g = M.layers[k]; g.gain.cancelScheduledValues(now()); g.gain.setValueAtTime(g.gain.value, now()); g.gain.linearRampToValueAtTime(0.0001, now() + 1.2); setTimeout(() => g.disconnect(), 1500); }
    M.layers = null;
}

/** 0 explore, 1 combat, 2 boss. */
export function setIntensity(i) {
    if (!M.on || !M.layers || i === M.target) return;
    M.target = i;
    const t = now();
    const ramp = (g, v) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + 1.5); };
    ramp(M.layers.bass, i >= 1 ? 0.55 : 0.22);
    ramp(M.layers.drums, i >= 1 ? 0.6 : 0.0001);
    ramp(M.layers.lead, i >= 2 ? 0.28 : 0.0001);
    ramp(M.layers.pad, i >= 2 ? 0.35 : 0.5);
}

function schedule() {
    if (!M.on || !ctx) return;
    const th = M.theme.music;
    const spb = 60 / th.tempo / 4; // seconds per 16th
    while (M.next < now() + 0.15) {
        playStep(M.step, M.next, spb, th);
        M.step++;
        M.next += spb;
    }
}

function note(dest, type, midi, t, dur, v, o = {}) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = mtof(midi);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack ?? 0.005) + dur);
    let n = osc;
    if (o.ff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.ff, t); if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur); f.Q.value = o.q ?? 2; n.connect(f); n = f; }
    n.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.1);
}

function drum(kind, t) {
    const g = ctx.createGain();
    g.connect(M.layers.drums);
    if (kind === 'kick') {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); o.start(t); o.stop(t + 0.35);
    } else {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = kind === 'hat' ? 'highpass' : 'bandpass';
        f.frequency.value = kind === 'hat' ? 7000 : 1800;
        const dur = kind === 'hat' ? 0.04 : 0.16;
        g.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
}

function playStep(step, t, spb, th) {
    const L = M.layers;
    if (!L) return;
    const sc = SCALES[th.scale] ?? SCALES.minor;
    const bar = Math.floor(step / 16), s16 = step % 16;
    const deg = PROG[Math.floor(bar / 2) % PROG.length];
    const rootM = th.root + sc[deg % 7] + (deg >= 7 ? 12 : 0);
    const chord = [0, 2, 4].map((k) => th.root + 12 + sc[(deg + k) % 7] + (deg + k >= 7 ? 12 : 0));
    // Pad: a slow chord every two bars.
    if (step % 32 === 0) for (const m of chord) for (const d of [-7, 7]) note(L.pad, 'sawtooth', m, t, spb * 32, 0.035, { attack: 1.2, detune: d, ff: 900, fto: 500 });
    // Bass: a driving 8th pulse with octave jumps.
    if (s16 % 2 === 0) {
        const oct = (s16 === 6 || s16 === 14) ? 12 : 0;
        note(L.bass, 'square', rootM - 12 + oct, t, spb * 1.6, 0.13, { ff: 700, fto: 160, q: 4 });
    }
    // Plinks: sparse, high, echoing.
    if (mrand() < 0.09) note(L.plink, 'triangle', th.root + 24 + sc[Math.floor(mrand() * 7)], t, 0.4, 0.06);
    // Drums (layer gain decides whether they're heard).
    if (s16 === 0 || s16 === 8 || (s16 === 10 && mrand() < 0.5)) drum('kick', t);
    if (s16 === 4 || s16 === 12) drum('snare', t);
    if (s16 % 2 === 0 || (M.target >= 2 && mrand() < 0.6)) drum('hat', t);
    // Boss lead: a menacing, mostly stepwise line.
    if (s16 % 4 === 0 && mrand() < 0.8) {
        M.leadDeg = (M.leadDeg ?? 0) + Math.floor(mrand() * 3) - 1;
        M.leadDeg = Math.max(0, Math.min(9, M.leadDeg));
        const m = th.root + 24 + sc[M.leadDeg % 7] + (M.leadDeg >= 7 ? 12 : 0);
        note(L.lead, 'sawtooth', m, t, spb * 3.5, 0.08, { ff: 2400, fto: 600, q: 6, detune: 8 });
        note(L.lead, 'square', m - 12, t, spb * 3.5, 0.04, { ff: 1200, q: 3 });
    }
}

export function musicOn() { return M.on; }
