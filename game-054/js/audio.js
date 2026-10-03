/**
 * audio.js — every sound is synthesised with Web Audio. No files.
 *
 *  SFX       weapons, impacts, doors, pickups, the player's body, UI. Spatial
 *            sounds take a world position: stereo pan from the listener's
 *            yaw, distance roll-off, and a low-pass when the source has no
 *            line of sight (the caller decides).
 *  Voices    each monster species has a voice (pitch, formants, roughness,
 *            vibrato) rolled with the species; sight/pain/death/idle/attack
 *            are variations on it.
 *  Music     a generative industrial-metal score: a riff generator (chugs
 *            and power chords in the theme's mode), drums, bass, a lead
 *            that comes in when the fight heats up, an ambient drone bed
 *            for exploration, and a choir for guardians. The game feeds it a
 *            0..1 combat level and it crossfades the layers.
 */

let ctx = null;
let master, sfxBus, musicBus, comp, reverb, reverbSend;
let noiseBuf = null;
let distCurve = null, softCurve = null;
const listener = { x: 0, y: 0, z: 0, yaw: 0 };
let sfxVol = 0.8, musicVol = 0.55;
let muted = false;

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.55; musicBus.connect(master);
    // a short dark room reverb for SFX
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(1.6, 2.8);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.22;
    reverbSend.connect(reverb); reverb.connect(sfxBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    distCurve = makeCurve(60);
    softCurve = makeCurve(6);
    music.init();
}

export function audioReady() { return !!ctx; }
export function setVolumes(s, m) {
    sfxVol = s; musicVol = m;
    if (sfxBus) sfxBus.gain.value = s;
    if (musicBus) musicBus.gain.value = m * 0.55;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); }
export function isMuted() { return muted; }
export function suspendAudio(on) { if (!ctx) return; if (on) ctx.suspend(); else ctx.resume(); }

export function setListener(x, y, z, yaw) { listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; }

function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
}
function makeCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
}

// ------------------------------------------------------------------ building blocks

/** Output node for a sound: positional (pan + distance + occlusion) or flat. */
function out(pos, opts = {}) {
    const g = ctx.createGain();
    let gain = opts.vol ?? 1;
    let node = g;
    if (pos) {
        const dx = pos.x - listener.x, dz = pos.z - listener.z, dy = (pos.y ?? listener.y) - listener.y;
        const dist = Math.hypot(dx, dy, dz);
        const ref = opts.ref ?? 6, roll = opts.roll ?? 1.1;
        gain *= ref / (ref + roll * Math.max(0, dist - ref * 0.3));
        if (gain < 0.01) return null;
        // yaw 0 looks down -Z; right = (cos yaw, sin yaw)
        const rx = Math.cos(listener.yaw), rz = Math.sin(listener.yaw);
        const pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) : 0;
        const p = ctx.createStereoPanner(); p.pan.value = pan * 0.85;
        g.connect(p);
        let last = p;
        if (opts.occluded) {
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
            p.connect(lp); last = lp; gain *= 0.6;
        }
        last.connect(sfxBus);
        if (opts.reverb !== false) {
            const s = ctx.createGain(); s.gain.value = Math.min(1, 0.4 + dist / 30); last.connect(s); s.connect(reverbSend);
        }
    } else {
        g.connect(sfxBus);
        if (opts.reverb) { const s = ctx.createGain(); s.gain.value = opts.reverb; g.connect(s); s.connect(reverbSend); }
    }
    g.gain.value = gain;
    void node;
    return g;
}

function osc(dest, type, f0, f1, t0, dur, vol, opts = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur * (opts.sweep ?? 1));
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    let last = g;
    if (opts.filter) {
        const f = ctx.createBiquadFilter(); f.type = opts.filter; f.frequency.value = opts.freq ?? 1000; f.Q.value = opts.q ?? 1;
        if (opts.freq1) f.frequency.exponentialRampToValueAtTime(opts.freq1, t0 + dur);
        g.connect(f); last = f;
    }
    last.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
}

function noise(dest, t0, dur, vol, type = 'bandpass', freq = 1000, q = 1, freq1 = null, attack = 0.002) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
}

function dist(dest, amount = 'hard') {
    const ws = ctx.createWaveShaper(); ws.curve = amount === 'hard' ? distCurve : softCurve; ws.oversample = '2x';
    ws.connect(dest);
    return ws;
}

const now = () => ctx.currentTime;
const ok = () => ctx && !muted && ctx.state === 'running';

// ------------------------------------------------------------------ weapons

export const sfx = {
    pistol(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.75 }); if (!o) return; const t = now();
        noise(o, t, 0.12, 0.9, 'bandpass', 2400, 0.7, 600);
        osc(o, 'square', 320, 70, t, 0.1, 0.5, { filter: 'lowpass', freq: 1800 });
        noise(o, t + 0.02, 0.35, 0.12, 'lowpass', 900, 0.5, 200);
    },
    shotgun(pos) {
        if (!ok()) return; const o = out(pos, { vol: 1 }); if (!o) return; const t = now();
        const d = dist(o, 'soft');
        noise(d, t, 0.32, 1.0, 'lowpass', 3500, 0.5, 300);
        osc(d, 'sine', 110, 38, t, 0.3, 1.0);
        noise(o, t + 0.01, 0.6, 0.25, 'lowpass', 1100, 0.4, 150);
        // pump
        noise(o, t + 0.42, 0.06, 0.35, 'bandpass', 1800, 4);
        noise(o, t + 0.56, 0.07, 0.4, 'bandpass', 1300, 4);
    },
    ssg(pos) {
        if (!ok()) return; const o = out(pos, { vol: 1.15 }); if (!o) return; const t = now();
        const d = dist(o, 'soft');
        noise(d, t, 0.45, 1.0, 'lowpass', 4000, 0.5, 200);
        osc(d, 'sine', 95, 30, t, 0.45, 1.0);
        osc(d, 'square', 60, 30, t, 0.2, 0.4);
        noise(o, t + 0.01, 0.9, 0.3, 'lowpass', 900, 0.4, 120);
        // break, load, close
        noise(o, t + 0.45, 0.05, 0.4, 'bandpass', 2500, 5);
        noise(o, t + 0.75, 0.05, 0.25, 'bandpass', 900, 3);
        noise(o, t + 0.85, 0.05, 0.25, 'bandpass', 950, 3);
        noise(o, t + 1.05, 0.06, 0.5, 'bandpass', 1600, 5);
    },
    chaingun(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.65, reverb: false }); if (!o) return; const t = now();
        noise(o, t, 0.08, 0.9, 'bandpass', 2000, 0.8, 700);
        osc(o, 'square', 180, 60, t, 0.07, 0.5, { filter: 'lowpass', freq: 1400 });
    },
    spin(pos, up) {
        if (!ok()) return; const o = out(pos, { vol: 0.25, reverb: false }); if (!o) return; const t = now();
        osc(o, 'sawtooth', up ? 80 : 300, up ? 300 : 60, t, 0.35, 0.3, { filter: 'bandpass', freq: 900, q: 3 });
    },
    rocket(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.9 }); if (!o) return; const t = now();
        noise(o, t, 0.7, 0.7, 'bandpass', 600, 0.8, 2400, 0.03);
        osc(o, 'sawtooth', 90, 45, t, 0.25, 0.4, { filter: 'lowpass', freq: 600 });
    },
    explosion(pos, size = 1) {
        if (!ok()) return; const o = out(pos, { vol: 1.1 * Math.min(1.6, size), ref: 10 }); if (!o) return; const t = now();
        const d = dist(o, 'soft');
        noise(d, t, 1.1 * size, 1.0, 'lowpass', 2200, 0.6, 80);
        osc(d, 'sine', 70, 22, t, 0.9 * size, 1.0);
        noise(o, t + 0.05, 1.6 * size, 0.35, 'lowpass', 500, 0.3, 60, 0.05);
        // debris
        for (let k = 0; k < 5; k++) noise(o, t + 0.15 + Math.random() * 0.5, 0.04, 0.12, 'bandpass', 2000 + Math.random() * 3000, 6);
    },
    plasma(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.5 }); if (!o) return; const t = now();
        osc(o, 'sawtooth', 1400, 300, t, 0.12, 0.35, { filter: 'bandpass', freq: 1600, q: 2 });
        osc(o, 'sine', 900, 1800, t, 0.06, 0.3);
    },
    plasmaHit(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.4 }); if (!o) return; const t = now();
        noise(o, t, 0.15, 0.6, 'bandpass', 3000, 2, 800);
        osc(o, 'sine', 600, 200, t, 0.12, 0.3);
    },
    railCharge(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.35 }); if (!o) return; const t = now();
        osc(o, 'sine', 300, 2400, t, 0.4, 0.3, { attack: 0.05 });
    },
    rail(pos) {
        if (!ok()) return; const o = out(pos, { vol: 1.0 }); if (!o) return; const t = now();
        const d = dist(o, 'hard');
        noise(d, t, 0.25, 0.8, 'highpass', 2500, 0.6);
        osc(d, 'sawtooth', 2200, 80, t, 0.5, 0.6, { sweep: 0.6 });
        osc(o, 'sine', 120, 40, t, 0.6, 0.9);
        noise(o, t, 1.2, 0.18, 'bandpass', 5000, 1.5, 1500);
        // recharge whine
        osc(o, 'sine', 400, 1600, t + 0.4, 0.5, 0.08, { attack: 0.2 });
    },
    bfgCharge(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.7 }); if (!o) return; const t = now();
        osc(o, 'sawtooth', 60, 520, t, 0.85, 0.5, { filter: 'lowpass', freq: 400, freq1: 4000, attack: 0.2 });
        osc(o, 'sine', 30, 120, t, 0.85, 0.6, { attack: 0.3 });
    },
    bfg(pos) {
        if (!ok()) return; const o = out(pos, { vol: 1.1 }); if (!o) return; const t = now();
        const d = dist(o, 'hard');
        osc(d, 'sawtooth', 400, 40, t, 0.9, 0.7);
        noise(d, t, 0.8, 0.6, 'lowpass', 3000, 0.5, 100);
        osc(o, 'sine', 50, 25, t, 1.4, 1.0);
    },
    bfgBoom(pos) {
        if (!ok()) return; const o = out(pos, { vol: 1.4, ref: 18 }); if (!o) return; const t = now();
        const d = dist(o, 'hard');
        noise(d, t, 2.4, 1.0, 'lowpass', 1800, 0.6, 50);
        osc(d, 'sine', 90, 18, t, 2.0, 1.0);
        osc(o, 'sawtooth', 1200, 60, t, 1.4, 0.4, { filter: 'bandpass', freq: 800, q: 1 });
        // the implosion "suck"
        noise(o, t - 0.0, 0.5, 0.5, 'bandpass', 200, 1, 4000, 0.45);
    },
    zap(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.25, reverb: false }); if (!o) return; const t = now();
        noise(o, t, 0.09, 0.6, 'highpass', 3000 + Math.random() * 2000, 1);
        osc(o, 'square', 2000 + Math.random() * 1000, 300, t, 0.08, 0.2);
    },
    blade(hit) {
        if (!ok()) return; const o = out(null, { vol: 0.7 }); const t = now();
        noise(o, t, 0.18, 0.5, 'bandpass', 1200, 1.5, 4000);
        osc(o, 'sawtooth', 700, 1400, t, 0.18, 0.12, { filter: 'bandpass', freq: 2000, q: 4 });
        if (hit) { noise(o, t + 0.05, 0.25, 0.8, 'lowpass', 900, 0.8, 200); osc(o, 'sine', 140, 50, t + 0.05, 0.2, 0.7); }
    },
    dry() { if (!ok()) return; const o = out(null, { vol: 0.5 }); noise(o, now(), 0.04, 0.6, 'bandpass', 3000, 6); },
    weaponUp() { if (!ok()) return; const o = out(null, { vol: 0.35 }); const t = now(); noise(o, t, 0.05, 0.5, 'bandpass', 1800, 5); noise(o, t + 0.12, 0.06, 0.6, 'bandpass', 1100, 5); },

    // ------------------------------------------------------------ impacts
    ricochet(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.22, reverb: false, ref: 4 }); if (!o) return; const t = now();
        noise(o, t, 0.05, 0.5, 'bandpass', 3000 + Math.random() * 3000, 3);
        if (Math.random() < 0.25) osc(o, 'sine', 3000 + Math.random() * 2000, 1200, t, 0.18, 0.08);
    },
    flesh(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.4, reverb: false, ref: 5 }); if (!o) return; const t = now();
        noise(o, t, 0.12, 0.6, 'lowpass', 900, 1, 200);
        osc(o, 'sine', 160 + Math.random() * 60, 60, t, 0.1, 0.4);
    },
    gib(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.8 }); if (!o) return; const t = now();
        noise(o, t, 0.4, 0.9, 'lowpass', 1400, 1, 150);
        for (let k = 0; k < 4; k++) noise(o, t + 0.1 + k * 0.07 + Math.random() * 0.05, 0.08, 0.3, 'lowpass', 700, 2);
    },
    barrel(pos) { sfx.explosion(pos, 1.1); },

    // ------------------------------------------------------------ player
    hurt(amount = 10) {
        if (!ok()) return; const o = out(null, { vol: 0.7 }); const t = now();
        const p = 150 + Math.random() * 30;
        voiceBurst(o, t, { pitch: p, f1: 650, f2: 1100, rough: 0.3, vib: 0 }, 0.18 + Math.min(0.2, amount / 100), 0.6, -0.3);
    },
    death() {
        if (!ok()) return; const o = out(null, { vol: 0.9 }); const t = now();
        voiceBurst(o, t, { pitch: 160, f1: 600, f2: 1000, rough: 0.5, vib: 6 }, 1.1, 0.7, -0.6);
        noise(o, t + 0.6, 0.4, 0.4, 'lowpass', 400, 1);
    },
    jump() { if (!ok()) return; const o = out(null, { vol: 0.25 }); voiceBurst(o, now(), { pitch: 170, f1: 500, f2: 1400, rough: 0.2, vib: 0 }, 0.09, 0.4, 0.1); },
    land(hard) { if (!ok()) return; const o = out(null, { vol: hard ? 0.6 : 0.3 }); const t = now(); noise(o, t, 0.12, 0.7, 'lowpass', 500, 1); osc(o, 'sine', 90, 40, t, 0.1, 0.5); },
    step(metal) {
        if (!ok()) return; const o = out(null, { vol: 0.16, reverb: 0.1 }); const t = now();
        if (metal) { noise(o, t, 0.06, 0.6, 'bandpass', 1400 + Math.random() * 600, 3); osc(o, 'triangle', 300 + Math.random() * 80, 200, t, 0.05, 0.25); }
        else noise(o, t, 0.07, 0.7, 'lowpass', 700 + Math.random() * 300, 1);
    },
    pickup() { if (!ok()) return; const o = out(null, { vol: 0.35 }); const t = now(); osc(o, 'square', 880, 880, t, 0.06, 0.25, { filter: 'lowpass', freq: 3000 }); osc(o, 'square', 1320, 1320, t + 0.05, 0.08, 0.2, { filter: 'lowpass', freq: 3000 }); },
    health() { if (!ok()) return; const o = out(null, { vol: 0.4 }); const t = now(); [523, 659, 784].forEach((f, i) => osc(o, 'sine', f, f, t + i * 0.05, 0.18, 0.3)); },
    armor() { if (!ok()) return; const o = out(null, { vol: 0.4 }); const t = now(); noise(o, t, 0.1, 0.5, 'bandpass', 2400, 3); osc(o, 'triangle', 440, 880, t, 0.2, 0.35); },
    ammo() { if (!ok()) return; const o = out(null, { vol: 0.4 }); const t = now(); noise(o, t, 0.05, 0.6, 'bandpass', 1500, 4); noise(o, t + 0.07, 0.05, 0.5, 'bandpass', 2200, 4); },
    weapon() {
        if (!ok()) return; const o = out(null, { vol: 0.6, reverb: 0.3 }); const t = now();
        noise(o, t, 0.08, 0.6, 'bandpass', 1200, 4); noise(o, t + 0.15, 0.1, 0.7, 'bandpass', 800, 4);
        const d = dist(o, 'hard');
        [82, 123, 165].forEach((f) => osc(d, 'sawtooth', f, f, t + 0.25, 0.9, 0.15, { filter: 'lowpass', freq: 2500 }));
    },
    power() {
        if (!ok()) return; const o = out(null, { vol: 0.55, reverb: 0.5 }); const t = now();
        [262, 330, 392, 523, 659].forEach((f, i) => osc(o, 'sawtooth', f, f, t + i * 0.06, 0.8, 0.12, { filter: 'lowpass', freq: 3000 }));
        osc(o, 'sine', 65, 65, t, 1.2, 0.4);
    },
    key() { if (!ok()) return; const o = out(null, { vol: 0.5, reverb: 0.4 }); const t = now(); [659, 880, 1319].forEach((f, i) => osc(o, 'triangle', f, f, t + i * 0.08, 0.4, 0.3)); },
    locked() { if (!ok()) return; const o = out(null, { vol: 0.5 }); const t = now(); osc(o, 'square', 140, 140, t, 0.18, 0.3, { filter: 'lowpass', freq: 900 }); osc(o, 'square', 120, 120, t + 0.2, 0.25, 0.3, { filter: 'lowpass', freq: 900 }); },
    use() { if (!ok()) return; const o = out(null, { vol: 0.45 }); const t = now(); noise(o, t, 0.04, 0.8, 'bandpass', 2500, 5); osc(o, 'square', 700, 700, t + 0.03, 0.05, 0.2); },
    secret() { if (!ok()) return; const o = out(null, { vol: 0.5, reverb: 0.7 }); const t = now(); [523, 622, 784, 1047, 1245].forEach((f, i) => osc(o, 'sine', f, f, t + i * 0.09, 0.9, 0.18)); },
    terminal() { if (!ok()) return; const o = out(null, { vol: 0.35 }); const t = now(); [1200, 1600, 1400].forEach((f, i) => osc(o, 'square', f, f, t + i * 0.06, 0.05, 0.15, { filter: 'lowpass', freq: 4000 })); },
    door(pos, open) {
        if (!ok()) return; const o = out(pos, { vol: 0.7, ref: 5 }); if (!o) return; const t = now();
        noise(o, t, 0.5, 0.5, 'bandpass', open ? 500 : 400, 1.2, open ? 1400 : 250, 0.05);
        osc(o, 'sawtooth', open ? 55 : 70, open ? 80 : 45, t, 0.45, 0.25, { filter: 'lowpass', freq: 300 });
        noise(o, t + 0.45, 0.12, 0.6, 'lowpass', 300, 1);
    },
    exit() {
        if (!ok()) return; const o = out(null, { vol: 0.8, reverb: 0.5 }); const t = now();
        noise(o, t, 0.05, 0.8, 'bandpass', 2500, 5);
        osc(o, 'sawtooth', 40, 120, t + 0.1, 2.0, 0.4, { filter: 'lowpass', freq: 400, attack: 0.4 });
        noise(o, t + 0.1, 2.0, 0.3, 'bandpass', 300, 1, 1200, 0.5);
    },
    teleport(pos) {
        if (!ok()) return; const o = out(pos, { vol: 0.7, ref: 8 }); if (!o) return; const t = now();
        noise(o, t, 0.8, 0.6, 'bandpass', 300, 2, 4000, 0.3);
        osc(o, 'sine', 200, 1200, t, 0.7, 0.3, { attack: 0.2 });
        osc(o, 'sine', 1200, 100, t + 0.6, 0.4, 0.3);
    },
    alarm() { if (!ok()) return; const o = out(null, { vol: 0.35 }); const t = now(); for (let k = 0; k < 3; k++) osc(o, 'square', 880, 660, t + k * 0.35, 0.3, 0.25, { filter: 'lowpass', freq: 2000 }); },
    ui() { if (!ok()) return; const o = out(null, { vol: 0.3 }); osc(o, 'square', 660, 660, now(), 0.04, 0.2, { filter: 'lowpass', freq: 2500 }); },
    uiConfirm() { if (!ok()) return; const o = out(null, { vol: 0.45, reverb: 0.3 }); const t = now(); const d = dist(o, 'hard'); [82, 123].forEach((f) => osc(d, 'sawtooth', f, f, t, 0.5, 0.12, { filter: 'lowpass', freq: 1800 })); noise(o, t, 0.3, 0.4, 'lowpass', 2000, 0.5, 100); },
    heartbeat() { if (!ok()) return; const o = out(null, { vol: 0.5 }); const t = now(); osc(o, 'sine', 60, 40, t, 0.12, 0.8); osc(o, 'sine', 55, 38, t + 0.18, 0.14, 0.6); },

    // ------------------------------------------------------------ monster attacks
    mAttack(kind, pos, occluded) {
        if (!ok()) return; const o = out(pos, { vol: 0.8, occluded }); if (!o) return; const t = now();
        switch (kind) {
            case 'hitscan': noise(o, t, 0.1, 0.8, 'bandpass', 1500, 0.8, 500); osc(o, 'square', 200, 60, t, 0.08, 0.4); break;
            case 'fireball': noise(o, t, 0.5, 0.6, 'bandpass', 400, 1, 1600, 0.05); osc(o, 'sawtooth', 120, 60, t, 0.3, 0.2, { filter: 'lowpass', freq: 600 }); break;
            case 'orb': osc(o, 'sine', 300, 150, t, 0.5, 0.4); osc(o, 'sine', 310, 140, t, 0.5, 0.3); noise(o, t, 0.4, 0.3, 'bandpass', 600, 2); break;
            case 'spit': noise(o, t, 0.12, 0.6, 'bandpass', 1200, 2, 300); break;
            case 'bolt': osc(o, 'sawtooth', 900, 200, t, 0.3, 0.3, { filter: 'bandpass', freq: 1200, q: 2 }); noise(o, t, 0.3, 0.3, 'highpass', 2000, 1); break;
            case 'missile': noise(o, t, 0.6, 0.5, 'bandpass', 800, 1, 2500, 0.05); osc(o, 'square', 600, 300, t, 0.2, 0.15); break;
            case 'rocket': sfx.rocket(pos); break;
            case 'slam': noise(o, t, 0.6, 1.0, 'lowpass', 600, 0.6, 60); osc(o, 'sine', 70, 25, t, 0.6, 1.0); break;
            case 'flame': noise(o, t, 1.4, 0.8, 'bandpass', 300, 0.6, 1600, 0.4); osc(o, 'sawtooth', 50, 80, t, 1.3, 0.25, { filter: 'lowpass', freq: 400, attack: 0.3 }); break;
            case 'wave': noise(o, t, 1.0, 0.9, 'lowpass', 800, 0.6, 60, 0.05); osc(o, 'sawtooth', 60, 30, t, 0.9, 0.4, { filter: 'lowpass', freq: 400 }); break;
            case 'beam': osc(o, 'sawtooth', 70, 70, t, 2.8, 0.35, { filter: 'lowpass', freq: 900, attack: 0.3 }); osc(o, 'sawtooth', 105, 108, t, 2.8, 0.25, { filter: 'lowpass', freq: 1500, attack: 0.3 }); noise(o, t, 2.8, 0.3, 'bandpass', 2500, 1, 800, 0.3); break;
            case 'birth': noise(o, t, 1.0, 0.6, 'lowpass', 400, 3, 1500, 0.3); break;
            case 'charge': noise(o, t, 0.5, 0.5, 'bandpass', 700, 2, 2000, 0.1); break;
            default: noise(o, t, 0.2, 0.5, 'bandpass', 800, 1);
        }
    },
};

// ------------------------------------------------------------------ voices

/** A formant-filtered growl. v = {pitch, f1, f2, rough, vib}; bend: pitch change over the sound. */
function voiceBurst(dest, t, v, dur, vol, bend = 0) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, dur * 0.2));
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pre = ctx.createGain(); pre.gain.value = 0.5;
    const ws = ctx.createWaveShaper(); ws.curve = v.rough > 0.4 ? distCurve : softCurve;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = v.f1; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = v.f2; f2.Q.value = 5;
    pre.connect(ws); ws.connect(f1); ws.connect(f2); f1.connect(g); f2.connect(g);
    g.connect(dest);
    const mk = (type, mul, det) => {
        const o = ctx.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(v.pitch * mul, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, v.pitch * mul * (1 + bend)), t + dur);
        o.detune.value = det;
        if (v.vib) {
            const l = ctx.createOscillator(); l.frequency.value = v.vib;
            const lg = ctx.createGain(); lg.gain.value = v.pitch * mul * 0.04;
            l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
        }
        o.connect(pre); o.start(t); o.stop(t + dur + 0.05);
    };
    mk('sawtooth', 1, 0);
    mk('square', 0.5, 7);
    if (v.rough > 0.2) {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const ng = ctx.createGain(); ng.gain.value = v.rough * 0.8;
        src.connect(ng); ng.connect(pre); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    }
}

export function voice(v, kind, pos, occluded) {
    if (!ok() || !v) return;
    const o = out(pos, { vol: kind === 'death' ? 1.0 : 0.8, occluded, ref: v.big ? 10 : 6 });
    if (!o) return;
    const t = now();
    const r = 0.9 + Math.random() * 0.2;
    const vv = { ...v, pitch: v.pitch * r };
    switch (kind) {
        case 'sight': voiceBurst(o, t, vv, 0.7 * v.len, 0.7, v.bendUp ? 0.4 : -0.35); break;
        case 'pain': voiceBurst(o, t, { ...vv, pitch: vv.pitch * 1.3 }, 0.22, 0.6, -0.4); break;
        case 'death': voiceBurst(o, t, vv, 1.1 * v.len, 0.8, -0.65); if (v.big) noise(o, t + 0.3, 1.0, 0.5, 'lowpass', 300, 1); break;
        case 'idle': voiceBurst(o, t, { ...vv, pitch: vv.pitch * 0.8 }, 0.5, 0.25, 0.1); break;
        case 'attack': voiceBurst(o, t, { ...vv, pitch: vv.pitch * 1.1 }, 0.3, 0.45, 0.25); break;
    }
}

// ------------------------------------------------------------------ music

const MODES = {
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const music = {
    playing: false,
    combat: 0, combatTarget: 0,
    boss: false,
    theme: { root: 40, mode: 'phrygian', tempo: 140 },
    step: 0,
    nextTime: 0,
    riff: null,
    bars: 0,
    section: 0,
    timer: null,

    init() {
        this.guitarBus = ctx.createGain(); this.guitarBus.gain.value = 0;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
        const ws = ctx.createWaveShaper(); ws.curve = makeCurve(140); ws.oversample = '4x';
        const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3600; cab.Q.value = 0.9;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 800; mid.gain.value = -5; mid.Q.value = 1;
        const post = ctx.createGain(); post.gain.value = 0.16;
        this.guitarIn = hp;
        hp.connect(ws); ws.connect(cab); cab.connect(mid); mid.connect(post); post.connect(this.guitarBus);
        this.guitarBus.connect(musicBus);
        this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0; this.drumBus.connect(musicBus);
        this.bassBus = ctx.createGain(); this.bassBus.gain.value = 0; this.bassBus.connect(musicBus);
        this.leadBus = ctx.createGain(); this.leadBus.gain.value = 0;
        const leadDelay = ctx.createDelay(1); leadDelay.delayTime.value = 0.32;
        const fb = ctx.createGain(); fb.gain.value = 0.3;
        this.leadBus.connect(musicBus); this.leadBus.connect(leadDelay); leadDelay.connect(fb); fb.connect(leadDelay); fb.connect(musicBus);
        this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.5; this.ambBus.connect(musicBus);
        this.choirBus = ctx.createGain(); this.choirBus.gain.value = 0; this.choirBus.connect(musicBus);
        const rv = ctx.createConvolver(); rv.buffer = impulse(3.5, 2.2);
        this.verb = ctx.createGain(); this.verb.gain.value = 0.5; this.verb.connect(rv); rv.connect(musicBus);
        this.ambBus.connect(this.verb); this.choirBus.connect(this.verb);
    },

    start(theme, seed = 1) {
        if (!ctx) return;
        this.theme = theme;
        this.seed = seed;
        this.rand = mulberry(seed);
        this.newRiff();
        this.step = 0; this.bars = 0;
        this.nextTime = ctx.currentTime + 0.1;
        this.playing = true;
        if (!this.timer) this.timer = setInterval(() => this.tick(), 40);
        this.startDrone();
    },

    stop() {
        this.playing = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.stopDrone();
        if (ctx) for (const b of [this.guitarBus, this.drumBus, this.bassBus, this.leadBus, this.choirBus]) b?.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    },

    setCombat(v) { this.combatTarget = v; },
    setBoss(on) { this.boss = on; },

    newRiff() {
        const R = this.rand;
        const sc = MODES[this.theme.mode] ?? MODES.phrygian;
        // root-heavy chord choices: the flat second and sixth carry the menace
        const DEG = [{ d: 0, w: 5 }, { d: 1, w: 2.2 }, { d: 5, w: 2 }, { d: 3, w: 1.4 }, { d: 4, w: 1.4 }, { d: 2, w: 0.8 }];
        const pickDeg = () => { let r = R() * DEG.reduce((a, x) => a + x.w, 0); for (const x of DEG) { r -= x.w; if (r <= 0) return x.d; } return 0; };
        // one bar (16 sixteenths): chugs on the root, accented power chords
        const bar = () => {
            const steps = new Array(16).fill(null);
            let k = 0;
            while (k < 16) {
                const r = R();
                if (r < 0.5) { steps[k] = { type: 'chug', deg: 0 }; k += 1; }
                else if (r < 0.64) { k += 1; }
                else {
                    const len = R() < 0.55 ? 2 : (R() < 0.6 ? 3 : 4);
                    steps[k] = { type: 'chord', deg: pickDeg(), len: Math.min(len, 16 - k) };
                    k += len;
                }
            }
            steps[0] = { type: 'chord', deg: 0, len: 2 }; steps[1] = null;
            return steps;
        };
        const a = bar();
        // the second bar repeats the first with a new turnaround in its last beat
        const b2 = a.map((x) => (x ? { ...x } : null));
        const turn = bar();
        for (let k = 12; k < 16; k++) b2[k] = turn[k];
        for (let k = 0; k < 12; k++) if (b2[k] && b2[k].len && k + b2[k].len > 12) b2[k].len = 12 - k;
        this.riff = [...a, ...b2];
        this.scale = sc;
        // a lead motif built from the scale, mostly stepwise
        let m = 4;
        this.motif = Array.from({ length: 16 }, () => { if (R() < 0.35) return -1; m = Math.max(0, Math.min(9, m + Math.floor(R() * 5) - 2)); return m; });
        this.kickPat = Array.from({ length: 32 }, (_, i) => (i % 8 === 0 || (this.riff[i] && this.riff[i].type === 'chug' && R() < 0.6) ? 1 : 0));
    },

    tick() {
        if (!this.playing || !ctx || ctx.state !== 'running') return;
        // ease the layers towards the combat level
        this.combat += (this.combatTarget - this.combat) * 0.05;
        const c = this.combat, boss = this.boss ? 1 : 0;
        const tc = ctx.currentTime;
        const fight = Math.max(c, boss);
        this.guitarBus.gain.setTargetAtTime(fight > 0.15 ? 0.55 + 0.45 * fight : 0, tc, 0.3);
        this.drumBus.gain.setTargetAtTime(0.25 + 0.75 * fight, tc, 0.3);
        this.bassBus.gain.setTargetAtTime(0.25 + 0.6 * fight, tc, 0.3);
        this.leadBus.gain.setTargetAtTime(fight > 0.6 ? 0.22 : 0, tc, 0.5);
        this.ambBus.gain.setTargetAtTime(0.55 - 0.35 * fight, tc, 0.5);
        this.choirBus.gain.setTargetAtTime(boss * 0.35, tc, 0.5);
        const tempo = this.theme.tempo * (boss ? 1.12 : 1);
        const st = 60 / tempo / 4;
        while (this.nextTime < tc + 0.15) {
            this.playStep(this.step, this.nextTime, st, fight);
            this.nextTime += st;
            this.step = (this.step + 1) % 32;
            if (this.step === 0) {
                this.bars++;
                if (this.bars % 8 === 0) this.newRiff();
            }
        }
    },

    playStep(i, t, st, fight) {
        const root = this.theme.root;
        const sc = this.scale;
        const s = this.riff[i];
        const deg = (d) => root + sc[d % sc.length] + 12 * Math.floor(d / sc.length);
        const calm = fight < 0.15;
        // guitar
        if (!calm && s) {
            if (s.type === 'chug') this.guitar(deg(0), t, st * 0.7, true);
            else this.guitar(deg(s.deg), t, st * s.len * 0.95, false);
        }
        // bass
        if (s) bassNote(this.bassBus, mtof((s.type === 'chug' ? deg(0) : deg(s.deg)) - 12), t, s.type === 'chug' ? st * 0.8 : st * (s.len ?? 1) * 0.9);
        // drums
        const fill = this.bars % 8 === 7 && i >= 24;
        if (calm) {
            if (i % 16 === 0) kick(this.drumBus, t, 0.6);
            if (i === 24 && this.rand() < 0.5) tom(this.drumBus, t, 90);
            if (i % 8 === 4) hat(this.drumBus, t, 0.08, true);
        } else if (fill) {
            if (i % 2 === 0) tom(this.drumBus, t, 160 - (i - 24) * 12);
            if (i === 31) crash(this.drumBus, t + st);
        } else {
            if (this.kickPat[i] || (fight > 0.7 && i % 2 === 0 && this.rand() < 0.5)) kick(this.drumBus, t, 0.9);
            if (i % 8 === 4) snare(this.drumBus, t);
            if (i % 2 === 0) hat(this.drumBus, t, 0.12, i % 4 === 0);
            if (i === 0 && this.bars % 4 === 0) crash(this.drumBus, t);
        }
        // lead: on in the thick of it
        if (fight > 0.6 && i % 2 === 0) {
            const m = this.motif[(i / 2 + this.bars * 3) % 16];
            if (m >= 0) leadNote(this.leadBus, mtof(deg(m) + 24), t, st * 1.8);
        }
        // choir for guardians
        if (this.boss && i % 16 === 0) choirChord(this.choirBus, [deg(0) + 24, deg(2) + 24, deg(4) + 24], t, st * 16);
    },

    guitar(note, t, dur, mute) {
        const f = mtof(note);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(mute ? 0.7 : 0.6, t + 0.005);
        g.gain.exponentialRampToValueAtTime(mute ? 0.02 : 0.25, t + (mute ? dur : dur * 0.8));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mute ? 900 : 5000;
        g.connect(lp); lp.connect(this.guitarIn);
        const freqs = mute ? [f, f * 1.498] : [f, f * 1.498, f * 2];
        for (const fr of freqs) for (const det of [-9, 8]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
            o.connect(g); o.start(t); o.stop(t + dur + 0.1);
        }
    },

    startDrone() {
        if (this.drone) return;
        const root = mtof(this.theme.root - 12);
        const g = ctx.createGain(); g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.18, ctx.currentTime, 2);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 3;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        const lg = ctx.createGain(); lg.gain.value = 300;
        lfo.connect(lg); lg.connect(lp.frequency);
        g.connect(lp); lp.connect(this.ambBus);
        const os = [];
        for (const [mul, type, det] of [[1, 'sawtooth', -6], [1, 'sawtooth', 7], [1.5, 'triangle', 0], [0.5, 'sine', 0], [2.0 * Math.pow(2, 1 / 12), 'triangle', 0]]) {
            const o = ctx.createOscillator(); o.type = type; o.frequency.value = root * mul; o.detune.value = det;
            const og = ctx.createGain(); og.gain.value = type === 'sine' ? 0.6 : 0.25;
            o.connect(og); og.connect(g); o.start(); os.push(o);
        }
        lfo.start(); os.push(lfo);
        // breathing noise wind
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.7;
        const ng = ctx.createGain(); ng.gain.value = 0.06;
        src.connect(nf); nf.connect(ng); ng.connect(this.ambBus); src.start(); os.push(src);
        this.drone = { g, os };
    },
    stopDrone() {
        if (!this.drone) return;
        const { g, os } = this.drone;
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
        setTimeout(() => os.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 2000);
        this.drone = null;
    },
};

function kick(bus, t, v) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
    noise(bus, t, 0.02, v * 0.4, 'highpass', 3000, 1);
}
function snare(bus, t) {
    noise(bus, t, 0.2, 0.7, 'highpass', 1200, 0.6);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.15);
}
function hat(bus, t, v, open) { noise(bus, t, open ? 0.12 : 0.04, v, 'highpass', 7000, 0.8); }
function crash(bus, t) { noise(bus, t, 1.4, 0.35, 'highpass', 4500, 0.5); }
function tom(bus, t, f) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
}
function bassNote(bus, f, t, dur) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    g.connect(lp); lp.connect(bus);
    for (const [type, mul, v] of [['sine', 1, 1], ['square', 1, 0.25]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
        const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g);
        o.start(t); o.stop(t + dur + 0.05);
    }
}
function leadNote(bus, f, t, dur) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.setValueAtTime(0.2, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    ws.connect(lp); lp.connect(g); g.connect(bus);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = f * 0.012;
    l.connect(lg); lg.connect(o.frequency);
    const pre = ctx.createGain(); pre.gain.value = 0.4; o.connect(pre); pre.connect(ws);
    o.start(t); o.stop(t + dur + 0.05); l.start(t); l.stop(t + dur + 0.05);
}
function choirChord(bus, notes, t, dur) {
    for (const n of notes) {
        const f = mtof(n);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 5;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
        f1.connect(g); f2.connect(g); g.connect(bus);
        for (const det of [-12, 0, 11]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
            const l = ctx.createOscillator(); l.frequency.value = 4.5 + Math.random(); const lg = ctx.createGain(); lg.gain.value = f * 0.008;
            l.connect(lg); lg.connect(o.frequency);
            o.connect(f1); o.connect(f2); o.start(t); o.stop(t + dur + 0.05); l.start(t); l.stop(t + dur + 0.05);
        }
    }
}

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
