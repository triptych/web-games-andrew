/**
 * audio.js — every sound is synthesised with Web Audio; there are no audio files.
 *
 *  - Music: a slow modal score that follows the mood (wilds by day / by night, town, dungeon,
 *    combat, dragon). Each mood is a drone, a pad playing a chord progression, a sparse melody
 *    on a plucked or bowed voice, and in combat a taiko-like ostinato. Scheduled ahead on a
 *    timer so it never stutters.
 *  - Ambience: wind that rises with altitude and weather, rain, cave drone indoors, birds by
 *    day, crickets at night, crackle near fires.
 *  - Effects: footsteps by surface, weapon swings and impacts, bows, spells by element,
 *    explosions, dragon roars and breath, storm-sigil thunder, UI clicks, fanfares.
 *
 * The AudioContext is created on the first user gesture (browser policy) via unlock().
 */
const MOODS = {
    explore: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], bpm: 54, voice: 'bow', density: 0.35, drone: 0.5, pad: 0.55 },
    night:   { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-7, -4, 0]], bpm: 46, voice: 'pluck', density: 0.22, drone: 0.45, pad: 0.45 },
    town:    { root: 55, scale: [0, 2, 4, 5, 7, 9, 10], prog: [[0, 4, 7], [5, 9, 12], [-2, 2, 5], [0, 4, 7]], bpm: 72, voice: 'pluck', density: 0.5, drone: 0.25, pad: 0.4 },
    dungeon: { root: 38, scale: [0, 1, 3, 5, 6, 8, 10], prog: [[0, 3, 6], [1, 5, 8], [-2, 1, 5], [0, 3, 6]], bpm: 40, voice: 'bow', density: 0.16, drone: 0.7, pad: 0.4 },
    combat:  { root: 45, scale: [0, 2, 3, 5, 7, 8, 11], prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-1, 2, 5]], bpm: 104, voice: 'bow', density: 0.55, drone: 0.6, pad: 0.5, drums: true },
    dragon:  { root: 40, scale: [0, 1, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [1, 5, 8], [-4, 0, 3], [-5, -1, 2]], bpm: 112, voice: 'horn', density: 0.6, drone: 0.8, pad: 0.55, drums: true, heavy: true },
    eye:     { root: 41, scale: [0, 1, 4, 5, 7, 8, 10], prog: [[0, 4, 7], [1, 4, 8], [-2, 1, 5], [-4, 0, 4]], bpm: 118, voice: 'horn', density: 0.7, drone: 0.9, pad: 0.6, drums: true, heavy: true },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7 };
        this.mood = 'explore'; this.want = 'explore';
        this.nextBeat = 0; this.beat = 0; this.bar = 0;
        this.lastStep = 0;
        this.amb = {};
    }

    /** Create the context on the first gesture; safe to call repeatedly. */
    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.out = c.createDynamicsCompressor();
        this.out.threshold.value = -14; this.out.ratio.value = 4; this.out.attack.value = 0.005; this.out.release.value = 0.2;
        this.master = c.createGain(); this.master.connect(this.out); this.out.connect(c.destination);
        this.bus = {};
        for (const k of ['music', 'sfx', 'ambience']) { const g = c.createGain(); g.connect(this.master); this.bus[k] = g; }
        // a shared hall reverb (generated impulse) for music and big sounds
        this.verb = c.createConvolver();
        this.verb.buffer = this.impulse(3.2, 2.4);
        this.verbIn = c.createGain(); this.verbIn.gain.value = 0.5;
        this.verbIn.connect(this.verb); this.verb.connect(this.master);
        this.noiseBuf = this.makeNoise(2);
        this.brownBuf = this.makeNoise(4, true);
        this.apply();
        this.startAmbience();
        this.nextBeat = c.currentTime + 0.2;
        this.timer = setInterval(() => this.schedule(), 90);
    }
    setVolumes(s) { Object.assign(this.vol, { master: s.muted ? 0 : s.master, music: s.music, sfx: s.sfx, ambience: s.ambience }); this.apply(); }
    apply() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
        this.bus.music.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
        this.bus.sfx.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
        this.bus.ambience.gain.setTargetAtTime(this.vol.ambience * 0.6, t, 0.05);
    }
    suspend(on) { if (!this.ctx) return; if (on) this.ctx.suspend(); else this.ctx.resume(); }

    // ---------------------------------------------------------------- building blocks
    makeNoise(sec, brown = false) {
        const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
        let last = 0;
        for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
        return b;
    }
    impulse(sec, decay) {
        const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
        return b;
    }
    env(g, t, a, peak, d, sustain = 0, r = 0.1, hold = 0) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.setTargetAtTime(Math.max(0.0001, sustain * peak), t + a, d / 3);
        if (hold || r) g.gain.setTargetAtTime(0.0001, t + a + hold, r / 3);
    }
    osc(type, f, t, dur, vol, dest, { a = 0.005, d = dur, glide = null, detune = 0 } = {}) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
        if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
        this.env(g, t, a, vol, d);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.6);
        return { o, g };
    }
    noise(t, dur, vol, dest, { type = 'bandpass', f = 1000, q = 1, f2 = null, a = 0.005, brown = false } = {}) {
        const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
        s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true;
        s.playbackRate.value = 0.8 + Math.random() * 0.4;
        fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
        this.env(g, t, a, vol, dur);
        s.connect(fl); fl.connect(g); g.connect(dest);
        s.start(t, Math.random()); s.stop(t + dur + 0.5);
        return g;
    }
    /** Pan a sound by its position relative to the listener (simple stereo + distance). */
    spatial(pos, maxD = 60) {
        if (!pos || !this.listener) return { dest: this.bus.sfx, gain: 1 };
        const L = this.listener;
        const dx = pos.x - L.x, dz = pos.z - L.z, d = Math.hypot(dx, dz, (pos.y ?? L.y) - L.y);
        if (d > maxD) return null;
        const c = this.ctx, p = c.createStereoPanner ? c.createStereoPanner() : null;
        const right = Math.cos(L.yaw) * dx - Math.sin(L.yaw) * dz;
        const g = c.createGain(); g.gain.value = Math.pow(1 - d / maxD, 1.6);
        if (p) { p.pan.value = Math.max(-0.9, Math.min(0.9, right / Math.max(4, d))); g.connect(p); p.connect(this.bus.sfx); } else g.connect(this.bus.sfx);
        return { dest: g, gain: g.gain.value };
    }

    // ---------------------------------------------------------------- UI and short cues
    ui(kind) {
        if (!this.ctx) return;
        kind = { equipSpell: 'equip', pinSet: 'pin', pinSlip: 'pin', pickBreak: 'pinBreak', take: 'equip' }[kind] || kind;
        const t = this.ctx.currentTime, b = this.bus.sfx;
        switch (kind) {
            case 'open': this.osc('triangle', 520, t, 0.12, 0.08, b, { glide: 700 }); break;
            case 'close': this.osc('triangle', 600, t, 0.12, 0.07, b, { glide: 420 }); break;
            case 'select': this.osc('sine', 880, t, 0.05, 0.05, b); break;
            case 'move': this.osc('sine', 660, t, 0.03, 0.03, b); break;
            case 'deny': this.osc('square', 140, t, 0.12, 0.05, b); break;
            case 'coin': [1320, 1760].forEach((f, i) => this.osc('triangle', f, t + i * 0.06, 0.18, 0.06, b)); break;
            case 'equip': this.noise(t, 0.08, 0.15, b, { f: 2600, q: 3 }); this.osc('triangle', 300, t, 0.08, 0.06, b); break;
            case 'craft': for (let i = 0; i < 3; i++) { this.osc('square', 900 + Math.random() * 200, t + i * 0.16, 0.12, 0.05, b, { glide: 300 }); this.noise(t + i * 0.16, 0.1, 0.18, b, { f: 3500, q: 6 }); } break;
            case 'brew': for (let i = 0; i < 6; i++) this.osc('sine', 300 + Math.random() * 400, t + i * 0.07, 0.07, 0.04, b, { glide: 900 }); break;
            case 'pin': this.osc('square', 1800, t, 0.03, 0.03, b); this.noise(t, 0.04, 0.08, b, { f: 5000, q: 8 }); break;
            case 'pinBreak': this.noise(t, 0.12, 0.25, b, { f: 4000, q: 2 }); this.osc('square', 2200, t, 0.06, 0.05, b, { glide: 800 }); break;
            case 'unlock': this.osc('square', 500, t, 0.05, 0.08, b); this.osc('square', 750, t + 0.07, 0.08, 0.08, b); this.noise(t, 0.12, 0.15, b, { f: 2000, q: 4 }); break;
            case 'page': this.noise(t, 0.25, 0.12, b, { type: 'highpass', f: 2500, q: 0.5 }); break;
        }
    }
    chime(notes, t0 = 0, vol = 0.07, step = 0.12, type = 'triangle') {
        const t = this.ctx.currentTime + t0;
        notes.forEach((m, i) => { const f = mtof(m); this.osc(type, f, t + i * step, 1.4, vol, this.bus.sfx, { a: 0.01 }); this.osc('sine', f * 2, t + i * step, 0.8, vol * 0.3, this.verbIn); });
    }

    // ---------------------------------------------------------------- world events
    onEvent(e, w) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime, p = w.player;
        const sp = (pos, d) => this.spatial(pos, d);
        switch (e.type) {
            case 'step': {
                if (t - this.lastStep < 0.12) break;
                this.lastStep = t;
                const s = e.surface, v = (e.sneak ? 0.35 : 1) * (0.8 + Math.random() * 0.3);
                const f = { snow: 900, grass: 1300, dirt: 700, stone: 2200, wood: 500, water: 1500, sand: 1100, rock: 1800 }[s] || 1000;
                this.noise(t, s === 'snow' ? 0.16 : 0.07, 0.22 * v, this.bus.sfx, { f, q: s === 'stone' ? 3 : 1, f2: f * 0.6, brown: s === 'snow' });
                if (s === 'wood') this.osc('sine', 110, t, 0.08, 0.15 * v, this.bus.sfx, { glide: 70 });
                if (s === 'water') this.noise(t + 0.03, 0.18, 0.15 * v, this.bus.sfx, { type: 'lowpass', f: 1800 });
                if (e.heavy > 1) this.noise(t + 0.02, 0.05, 0.08 * v, this.bus.sfx, { f: 3800, q: 6 });
                break;
            }
            case 'jump': this.noise(t, 0.12, 0.08, this.bus.sfx, { type: 'lowpass', f: 600 }); break;
            case 'fall': this.osc('sine', 90, t, 0.25, 0.3, this.bus.sfx, { glide: 40 }); this.noise(t, 0.2, 0.3, this.bus.sfx, { type: 'lowpass', f: 500 }); break;
            case 'ready': this.noise(t, e.drawn ? 0.35 : 0.25, 0.14, this.bus.sfx, { type: 'bandpass', f: e.drawn ? 3000 : 2000, f2: e.drawn ? 6000 : 1200, q: 4 }); break;
            case 'swing': {
                const s = sp(e.actor?.pos, 40); if (!s) break;
                if (e.dragon) { this.noise(t, 0.5, 0.5, s.dest, { type: 'lowpass', f: 300, f2: 120 }); break; }
                this.noise(t, e.power ? 0.32 : 0.2, (e.power ? 0.2 : 0.13), s.dest, { f: 900, f2: 2800, q: 1.5, a: 0.04 });
                break;
            }
            case 'hit': {
                const s = sp(e.pos, 50); if (!s) break;
                if (e.blocked) { this.osc('square', 420 + Math.random() * 120, t, 0.25, 0.12, s.dest, { glide: 300 }); this.osc('sine', 1800, t, 0.4, 0.06, s.dest); this.noise(t, 0.12, 0.3, s.dest, { f: 3500, q: 3 }); break; }
                const ty = e.dmgType;
                if (ty === 'fire') this.noise(t, 0.35, 0.25, s.dest, { type: 'lowpass', f: 1600, f2: 400 });
                else if (ty === 'frost') { this.noise(t, 0.3, 0.2, s.dest, { type: 'highpass', f: 4000 }); this.osc('sine', 2400, t, 0.3, 0.05, s.dest, { glide: 1800 }); }
                else if (ty === 'shock') { this.noise(t, 0.18, 0.3, s.dest, { f: 2500, q: 0.6 }); this.osc('sawtooth', 120, t, 0.15, 0.08, s.dest, { glide: 60 }); }
                else { this.noise(t, 0.09, 0.4 * (e.power ? 1.3 : 1), s.dest, { type: 'lowpass', f: 900 }); this.osc('sine', 120, t, 0.12, 0.25, s.dest, { glide: 60 }); if (e.crit || e.sneak) this.noise(t, 0.2, 0.25, s.dest, { f: 2000, q: 2 }); }
                if (e.target === p) this.osc('sine', 70, t, 0.18, 0.25, this.bus.sfx, { glide: 45 });
                break;
            }
            case 'draw': if (e.actor === p) this.noise(t, 0.6, 0.06, this.bus.sfx, { f: 600, f2: 1400, q: 8, a: 0.3 }); break;
            case 'loose': { const s = sp(e.actor?.pos, 40); if (!s) break; this.osc('triangle', 180, t, 0.18, 0.18, s.dest, { glide: 90 }); this.noise(t, 0.25, 0.12, s.dest, { f: 2200, f2: 800, q: 2 }); break; }
            case 'projectileHit': { const s = sp(e.pos, 45); if (!s) break; if (e.kind === 'arrow') { this.noise(t, 0.06, 0.25, s.dest, { f: 1400, q: 2 }); this.osc('sine', 300, t, 0.05, 0.1, s.dest, { glide: 150 }); } break; }
            case 'castStart': case 'cast': {
                const s = sp(e.actor?.pos, 40); if (!s) break;
                const sp_ = e.spell || '';
                const elem = /fire|flame|ember/.test(sp_) ? 'fire' : /frost|ice|rime/.test(sp_) ? 'frost' : /shock|light|spark|storm/.test(sp_) ? 'shock' : /heal|mend|ward/.test(sp_) ? 'light' : 'arcane';
                if (e.type === 'castStart') { this.osc('sine', elem === 'frost' ? 900 : elem === 'fire' ? 220 : 440, t, 0.6, 0.05, s.dest, { a: 0.3, glide: elem === 'fire' ? 330 : 660 }); break; }
                if (elem === 'fire') this.noise(t, 0.6, 0.3, s.dest, { type: 'lowpass', f: 2200, f2: 500, a: 0.02 });
                else if (elem === 'frost') { this.noise(t, 0.5, 0.2, s.dest, { type: 'highpass', f: 3000, f2: 6000 }); this.osc('triangle', 1300, t, 0.5, 0.05, s.dest, { glide: 2600 }); }
                else if (elem === 'shock') { for (let i = 0; i < 4; i++) this.noise(t + i * 0.04, 0.07, 0.25, s.dest, { f: 1800 + Math.random() * 2000, q: 1 }); }
                else if (elem === 'light') [72, 76, 79].forEach((m, i) => this.osc('sine', mtof(m), t + i * 0.05, 0.9, 0.05, this.verbIn));
                else this.osc('sine', 520, t, 0.5, 0.07, s.dest, { glide: 1040 });
                break;
            }
            case 'explode': {
                const s = sp(e.pos, 120); if (!s) break;
                this.noise(t, 1.4, 0.8, s.dest, { type: 'lowpass', f: 1200, f2: 80, brown: false });
                this.osc('sine', 70, t, 1, 0.6, s.dest, { glide: 30 });
                this.noise(t, 1.6, 0.25, this.verbIn, { type: 'lowpass', f: 600, f2: 100 });
                break;
            }
            case 'roar': case 'dragonArrive': {
                if (e.type === 'dragonArrive') { this.want = 'dragon'; this.dragonT = 40; }
                const s = sp(e.actor?.pos, 500) || { dest: this.bus.sfx }; const d = 2.2;
                this.osc('sawtooth', 95, t, d, 0.35, s.dest, { a: 0.15, glide: 55 });
                this.osc('sawtooth', 142, t, d, 0.2, s.dest, { a: 0.2, glide: 70, detune: 30 });
                this.noise(t, d, 0.5, s.dest, { f: 500, f2: 200, q: 1.2, a: 0.2 });
                this.noise(t, d + 0.5, 0.3, this.verbIn, { type: 'lowpass', f: 400, f2: 120, a: 0.3 });
                break;
            }
            case 'breath': { const s = sp(e.actor?.pos, 120); if (!s) break; this.noise(t, 2.2, 0.55, s.dest, { type: e.elem === 'frost' ? 'highpass' : 'lowpass', f: e.elem === 'frost' ? 1500 : 1400, f2: e.elem === 'frost' ? 4000 : 400, a: 0.15 }); break; }
            case 'dragonCrash': case 'dragonLand': { const s = sp(e.actor?.pos, 200); if (!s) break; this.osc('sine', 50, t, 1.2, 0.7, s.dest, { glide: 28 }); this.noise(t, 1.2, 0.5, s.dest, { type: 'lowpass', f: 400, f2: 60 }); break; }
            case 'ember': this.noise(t, 4, 0.4, this.verbIn, { f: 300, f2: 2400, q: 2, a: 1.5 }); this.chime([62, 69, 74, 77, 81], 1.2, 0.06, 0.25, 'sine'); break;
            case 'sigilStart': if (e.actor === p) this.osc('sine', 110, t, 0.9, 0.08, this.bus.sfx, { a: 0.4, glide: 220 }); break;
            case 'sigil': case 'stormStrike': {
                // the storm answers: a crack, then rolling thunder
                const rings = e.rings || 3;
                const s = sp(e.actor?.pos || e.pos, 300) || { dest: this.bus.sfx };
                this.noise(t, 0.15, 0.9, s.dest, { type: 'highpass', f: 1200 });
                this.noise(t + 0.05, 2 + rings * 0.6, 0.7, s.dest, { type: 'lowpass', f: 700, f2: 60, a: 0.05, brown: true });
                this.osc('sine', 48, t, 1.5 + rings * 0.4, 0.5, s.dest, { glide: 30 });
                this.noise(t + 0.1, 3, 0.4, this.verbIn, { type: 'lowpass', f: 500, f2: 80, brown: true });
                break;
            }
            case 'nocharge': case 'nomana': if (e.actor === p || !e.actor) this.osc('sine', 200, t, 0.2, 0.06, this.bus.sfx, { glide: 120 }); break;
            case 'thunder': { const at = t + (e.delay || 0.5); this.noise(at, 4, 0.5, this.bus.ambience, { type: 'lowpass', f: 500, f2: 50, a: 0.1, brown: true }); break; }
            case 'pickup': this.noise(t, 0.08, 0.1, this.bus.sfx, { f: e.entry?.id === 'gold' ? 4000 : 1500, q: 2 }); if (e.entry?.id === 'gold') this.ui('coin'); break;
            case 'drink': for (let i = 0; i < 3; i++) this.osc('sine', 350 + i * 60, t + i * 0.13, 0.1, 0.06, this.bus.sfx, { glide: 200 }); break;
            case 'eat': for (let i = 0; i < 3; i++) this.noise(t + i * 0.15, 0.08, 0.12, this.bus.sfx, { f: 900, q: 2 }); break;
            case 'learnSpell': case 'ringLearned': case 'runeLearned': this.chime([60, 64, 67, 72, 76], 0, 0.06, 0.1, 'sine'); break;
            case 'skillUp': this.chime([72, 79], 0, 0.05, 0.09); break;
            case 'levelUp': this.chime([60, 67, 72, 76, 79, 84], 0, 0.07, 0.14); break;
            case 'questStart': this.chime([57, 62, 64, 69], 0, 0.06, 0.18); break;
            case 'questDone': this.chime([62, 66, 69, 74, 78, 81], 0, 0.07, 0.15); break;
            case 'discovered': this.chime([55, 62, 67, 71], 0, 0.06, 0.22, 'sine'); break;
            case 'gameComplete': this.chime([50, 57, 62, 66, 69, 74, 78, 81, 86], 0.5, 0.08, 0.3, 'sine'); break;
            case 'death': { if (e.actor?.rig === 'humanoid') { const s = sp(e.actor.pos, 40); if (s) this.noise(t + 0.2, 0.3, 0.2, s.dest, { type: 'lowpass', f: 400 }); } break; }
            case 'playerDeath': this.osc('sawtooth', 220, t, 3, 0.15, this.bus.sfx, { glide: 55, a: 0.1 }); this.noise(t, 3, 0.2, this.verbIn, { type: 'lowpass', f: 600, f2: 80 }); break;
            case 'trap': { const s = sp(e, 30); if (!s) break; this.noise(t, 0.3, 0.4, s.dest, { f: 2600, q: 3 }); this.osc('square', 160, t, 0.2, 0.1, s.dest, { glide: 90 }); break; }
            case 'lever': this.noise(t, 0.3, 0.25, this.bus.sfx, { type: 'lowpass', f: 800 }); this.osc('square', 80, t + 0.1, 1.2, 0.08, this.bus.sfx, { glide: 60 }); break;
            case 'dial': this.noise(t, 0.4, 0.2, this.bus.sfx, { f: 500, q: 3 }); this.osc('sine', 140, t + 0.3, 0.15, 0.15, this.bus.sfx); break;
            case 'harvest': this.noise(t, 0.12, 0.12, this.bus.sfx, { type: 'highpass', f: 3000 }); break;
            case 'mine': for (let i = 0; i < 3; i++) { this.osc('square', 1400, t + i * 0.25, 0.05, 0.06, this.bus.sfx, { glide: 600 }); this.noise(t + i * 0.25, 0.1, 0.3, this.bus.sfx, { f: 2500, q: 4 }); } break;
            case 'crafted': case 'honed': case 'inscribed': this.ui('craft'); break;
            case 'brewed': this.ui('brew'); break;
            case 'cellChanged': this.noise(t, 0.6, 0.18, this.bus.sfx, { type: 'lowpass', f: 500, f2: 200 }); this.osc('sine', 90, t + 0.1, 0.3, 0.12, this.bus.sfx, { glide: 70 }); break;
            case 'summon': { const s = sp(e.actor?.pos, 40); if (s) this.noise(t, 1, 0.3, s.dest, { f: 200, f2: 2000, q: 4, a: 0.3 }); break; }
            case 'crimeSeen': case 'arrest': this.osc('square', 330, t, 0.15, 0.06, this.bus.sfx); this.osc('square', 247, t + 0.16, 0.2, 0.06, this.bus.sfx); break;
            case 'cairnLit': this.noise(t, 2, 0.4, this.bus.sfx, { type: 'lowpass', f: 1500, f2: 600, a: 0.2 }); this.chime([62, 69], 0.4, 0.05); break;
            case 'aggro': if (e.actor && w.player) this.combatT = 12; break;
        }
    }

    // ---------------------------------------------------------------- ambience
    startAmbience() {
        const c = this.ctx, b = this.bus.ambience;
        const loop = (buf, type, f, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(b); s.start(); return { s, fl, g }; };
        this.amb.wind = loop(this.brownBuf, 'bandpass', 400, 0.6);
        this.amb.gust = loop(this.noiseBuf, 'bandpass', 900, 3);
        this.amb.rain = loop(this.noiseBuf, 'highpass', 1800, 0.4);
        this.amb.cave = loop(this.brownBuf, 'lowpass', 160, 0.8);
        this.amb.fire = loop(this.noiseBuf, 'bandpass', 2500, 2);
        this.amb.water = loop(this.noiseBuf, 'lowpass', 900, 0.7);
        this.birdT = 2; this.crickT = 0;
    }
    /** Called each frame with the world: listener, mood, ambience levels. */
    update(dt, w, cam, paused) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime, p = w.player;
        this.listener = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: p.camYaw ?? p.yaw };
        const inside = w.cellId !== 'ext';
        const ws = w.weather.state();
        const h = w.time.hour, day = h > 6 && h < 20;
        const alt = inside ? 0 : Math.max(0, Math.min(1, (p.pos.y - 80) / 500));
        const set = (n, v, f) => { const a = this.amb[n]; a.g.gain.setTargetAtTime(v, t, 0.6); if (f) a.fl.frequency.setTargetAtTime(f, t, 0.8); };
        const windAmt = inside ? (w.space.open ? 0.9 : 0.02) : Math.min(1, 0.1 + ws.wind * 0.25 + alt * 0.7 + ws.cover * 0.2 + (ws.snow || 0) * 0.3);
        set('wind', windAmt * 0.5, 250 + windAmt * 500 + Math.sin(t * 0.3) * 120);
        set('gust', windAmt * windAmt * 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23)), 700 + Math.sin(t * 0.5) * 400);
        set('rain', inside ? 0 : (ws.rain || 0) * 0.35);
        set('cave', inside && !w.space.open ? (w.space.kind === 'dungeon' ? 0.55 : 0.12) : 0);
        // nearest fire
        let fireD = 99;
        if (inside) { for (const L of w.space.lights || []) if (L.fire !== false) fireD = Math.min(fireD, Math.hypot(L.x - p.pos.x, L.z - p.pos.z)); }
        else for (const L of w.settlements.lights) { if (Math.abs(L.x - p.pos.x) > 15 || Math.abs(L.z - p.pos.z) > 15) continue; fireD = Math.min(fireD, Math.hypot(L.x - p.pos.x, L.z - p.pos.z)); }
        set('fire', Math.max(0, 1 - fireD / 9) * 0.25 * (0.6 + Math.random() * 0.4));
        const water = !inside && w.terrain.waterAt(p.pos.x, p.pos.z) > w.terrain.heightAt(p.pos.x, p.pos.z) - 2 ? 0.25 : 0;
        set('water', water);
        // birds by day, crickets at night (outdoors, fair weather)
        if (!inside && !paused && (ws.rain || 0) < 0.3 && alt < 0.5) {
            this.birdT -= dt;
            if (day && this.birdT <= 0) { this.birdT = 2 + Math.random() * 6; this.bird(); }
            this.crickT -= dt;
            if (!day && this.crickT <= 0 && (ws.snow || 0) < 0.2) { this.crickT = 0.6 + Math.random() * 1.5; this.cricket(); }
        }
        // mood
        if (this.dragonT > 0) this.dragonT -= dt;
        if (this.combatT > 0) this.combatT -= dt;
        const dragon = w.actors.some((a) => a.rig === 'dragon' && !a.dead && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 300);
        let mood;
        if (w.cellId === 'eye') mood = 'eye';
        else if (dragon) mood = 'dragon';
        else if (p.inCombat) mood = 'combat';
        else if (inside && w.space.kind === 'dungeon') mood = 'dungeon';
        else if (!inside && w.townAt?.()) mood = 'town';
        else if (inside) mood = 'town';
        else mood = day ? 'explore' : 'night';
        this.want = mood;
    }
    bird() {
        const t = this.ctx.currentTime, b = this.bus.ambience, f = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
        const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const g = this.ctx.createGain(); g.gain.value = 0.5;
        if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(b); } else g.connect(b);
        for (let i = 0; i < n; i++) this.osc('sine', f * (1 + Math.random() * 0.2), t + i * 0.13, 0.08, 0.05, g, { glide: f * (0.7 + Math.random() * 0.8) });
    }
    cricket() {
        const t = this.ctx.currentTime, b = this.bus.ambience;
        for (let i = 0; i < 3; i++) this.osc('square', 4200 + Math.random() * 300, t + i * 0.05, 0.03, 0.012, b);
    }

    // ---------------------------------------------------------------- music
    schedule() {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const ahead = c.currentTime + 0.35;
        while (this.nextBeat < ahead) {
            if (this.beat % 16 === 0 && this.want !== this.mood) { this.mood = this.want; this.bar = 0; }
            this.playBeat(this.nextBeat, this.beat);
            const M = MOODS[this.mood];
            this.nextBeat += 60 / M.bpm / 2;   // eighth notes
            this.beat++;
        }
    }
    playBeat(t, beat) {
        const M = MOODS[this.mood], mus = this.bus.music;
        const eighth = 60 / M.bpm / 2;
        const barLen = eighth * 16;
        const chord = M.prog[Math.floor(beat / 16) % M.prog.length];
        // drone + pad at the start of each bar
        if (beat % 16 === 0) {
            const rootF = mtof(M.root - 12);
            this.osc('sawtooth', rootF, t, barLen * 1.05, 0.05 * M.drone, this.lp(mus, 300), { a: 1.2 });
            this.osc('sine', rootF / 2, t, barLen * 1.05, 0.12 * M.drone, mus, { a: 1.5 });
            for (const iv of chord) {
                const f = mtof(M.root + iv);
                for (const det of [-7, 7]) this.osc('sawtooth', f, t, barLen * 1.02, 0.018 * M.pad, this.lp(this.verbIn, 900 + (M.heavy ? 0 : 500)), { a: barLen * 0.35, detune: det });
            }
        }
        // melody: sparse, from the scale, leaning on chord tones
        const rnd = this.hashR(beat * 7.13 + this.bar);
        if (beat % 2 === 0 && rnd < M.density * (beat % 8 === 0 ? 1.4 : 0.8)) {
            const pool = Math.random() < 0.6 ? chord.map((x) => (x % 12 + 12) % 12) : M.scale;
            const deg = pool[Math.floor(this.hashR(beat * 3.7) * pool.length)];
            const oct = 12 + (this.hashR(beat * 1.3) < 0.3 ? 12 : 0);
            this.voice(M.voice, mtof(M.root + deg + oct), t, eighth * (beat % 8 === 0 ? 5 : 3));
        }
        // drums
        if (M.drums) {
            const pat = M.heavy ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0] : [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0];
            if (pat[beat % 16]) this.drum(t, beat % 4 === 0 ? 1 : 0.6);
            if (beat % 4 === 2) this.noise(t, 0.05, 0.05, mus, { type: 'highpass', f: 6000 });
        }
        if (beat % 16 === 15) this.bar++;
    }
    hashR(x) { const s = Math.sin(x * 12.9898 + this.bar * 4.1) * 43758.5453; return s - Math.floor(s); }
    lp(dest, f) { const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.connect(dest); return fl; }
    voice(kind, f, t, dur) {
        const mus = this.bus.music;
        if (kind === 'pluck') {
            this.osc('triangle', f, t, dur, 0.09, mus, { a: 0.004, d: 0.6 });
            this.osc('sine', f * 2, t, dur * 0.5, 0.03, this.verbIn, { a: 0.004, d: 0.4 });
        } else if (kind === 'horn') {
            const fl = this.lp(mus, 1100);
            this.osc('sawtooth', f / 2, t, dur, 0.06, fl, { a: 0.12 });
            this.osc('sawtooth', f / 2, t, dur, 0.04, this.verbIn, { a: 0.15, detune: 8 });
        } else {   // bowed: slow attack, vibrato
            const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), fl = this.lp(mus, 1800);
            o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * 0.006;
            lfo.connect(lg); lg.connect(o.frequency);
            this.env(g, t, dur * 0.35, 0.05, dur, 0.8, dur * 0.5, dur * 0.6);
            o.connect(g); g.connect(fl); g.connect(this.verbIn);
            o.start(t); lfo.start(t); o.stop(t + dur * 2); lfo.stop(t + dur * 2);
        }
    }
    drum(t, v) {
        const mus = this.bus.music;
        this.osc('sine', 110, t, 0.5, 0.35 * v, mus, { glide: 45 });
        this.noise(t, 0.12, 0.12 * v, mus, { type: 'lowpass', f: 800 });
        this.osc('sine', 70, t, 0.6, 0.15 * v, this.verbIn, { glide: 40 });
    }
}
