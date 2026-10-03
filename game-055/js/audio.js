// All sound is synthesised with Web Audio: effects from oscillators and a
// noise buffer, and a generative soundtrack (drums, bass, arpeggio, pads and
// a lead for bosses) seeded per operation so each one has its own tune.

const SCALES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const PROGS = [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 3, 4], [0, 2, 5, 4], [0, 6, 3, 4]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { music: 0.6, sfx: 0.8 };
        this.last = {};
        this.music = null;
        this.musicWant = null;
        this.rotorOn = false;
    }

    /** Must be called from a user gesture. */
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
        this.master.connect(comp); comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.connect(this.master);
        this.mus = ctx.createGain(); this.mus.connect(this.master);
        // reverb
        this.verb = ctx.createConvolver();
        const len = ctx.sampleRate * 2.4;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb.buffer = ir;
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.35;
        this.verbIn.connect(this.verb); this.verb.connect(this.master);
        // music delay
        this.delay = ctx.createDelay(1); this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.32;
        this.delayOut = ctx.createGain(); this.delayOut.gain.value = 0.35;
        this.delay.connect(this.delayFb); this.delayFb.connect(this.delay); this.delay.connect(this.delayOut); this.delayOut.connect(this.mus);
        // noise
        const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.shaper = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3); }
        this.shaper.curve = curve;
        this.shaper.connect(this.sfx);
        this.setVolumes(this.vol.music, this.vol.sfx);
        if (this.musicWant) this.playMusic(this.musicWant);
        this.sched = setInterval(() => this.tick(), 25);
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
        });
    }

    setVolumes(music, sfx) {
        this.vol = { music, sfx };
        if (!this.ctx) return;
        this.mus.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
        this.sfx.gain.setTargetAtTime(sfx * 0.9, this.ctx.currentTime, 0.05);
    }

    get t() { return this.ctx.currentTime; }

    throttle(key, gap) {
        const now = this.ctx.currentTime;
        if (this.last[key] && now - this.last[key] < gap) return false;
        this.last[key] = now;
        return true;
    }

    pan(x) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, (x / 540) * 2 - 1)) * 0.6;
        return p;
    }

    noise(dur, at = this.t) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        s.start(at, Math.random() * 1.5, dur + 0.05);
        return s;
    }

    env(g, at, a, peak, d, end = 0.0001) {
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + a);
        g.gain.exponentialRampToValueAtTime(end, at + a + d);
    }

    osc(type, f, at, dur, out, peak = 0.3, a = 0.005, f1 = null) {
        const c = this.ctx;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, at);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
        this.env(g, at, a, peak, dur);
        o.connect(g); g.connect(out);
        o.start(at); o.stop(at + a + dur + 0.05);
        return o;
    }

    // ------------------------------------------------------------ effects

    gun(x) {
        if (!this.ctx || !this.throttle('gun', 0.055)) return;
        const c = this.ctx, at = this.t;
        const p = this.pan(x); p.connect(this.sfx);
        const n = this.noise(0.05, at);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 600; f.Q.value = 0.9;
        const g = c.createGain(); this.env(g, at, 0.002, 0.13, 0.045);
        n.connect(f); f.connect(g); g.connect(p);
        this.osc('square', 180, at, 0.03, p, 0.05, 0.001, 70);
    }

    eshot(x, k) {
        if (!this.ctx || !this.throttle('eshot' + k, k === 'l' ? 0.12 : 0.07)) return;
        const at = this.t;
        const p = this.pan(x); p.connect(this.sfx);
        if (k === 'l') this.osc('sawtooth', 320, at, 0.25, p, 0.06, 0.005, 90);
        else this.osc('triangle', k === 'm' ? 900 : 1300, at, 0.09, p, 0.05, 0.002, k === 'm' ? 400 : 700);
    }

    explosion(x, size = 'm') {
        if (!this.ctx) return;
        const key = 'boom' + size;
        if (!this.throttle(key, size === 's' ? 0.04 : 0.07)) return;
        const c = this.ctx, at = this.t;
        const S = { s: 0.5, m: 1, l: 1.6, xl: 2.4 }[size] || 1;
        const p = this.pan(x); p.connect(S >= 1.6 ? this.shaper : this.sfx);
        const dur = 0.35 + S * 0.45;
        const n = this.noise(dur, at);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
        f.frequency.setValueAtTime(2500 + S * 1500, at); f.frequency.exponentialRampToValueAtTime(120, at + dur);
        const g = c.createGain(); this.env(g, at, 0.004, 0.35 * Math.min(1.4, S), dur);
        n.connect(f); f.connect(g); g.connect(p);
        if (S >= 1) { const v = c.createGain(); v.gain.value = 0.25 * S; g.connect(v); v.connect(this.verbIn); }
        this.osc('sine', 110 * (S > 1 ? 0.8 : 1.2), at, dur * 0.8, p, 0.4 * Math.min(1.3, S), 0.004, 28);
    }

    hit() {
        if (!this.ctx) return;
        const at = this.t;
        this.explosion(270, 'l');
        this.osc('square', 880, at, 0.12, this.sfx, 0.12, 0.002, 220);
        this.osc('square', 660, at + 0.12, 0.12, this.sfx, 0.1, 0.002, 160);
    }

    graze() {
        if (!this.ctx || !this.throttle('graze', 0.05)) return;
        this.osc('sine', 2400 + Math.random() * 400, this.t, 0.04, this.sfx, 0.035, 0.001);
    }

    pickup(kind, chain = 0) {
        if (!this.ctx) return;
        if (kind === 'salvage') {
            if (!this.throttle('pick', 0.035)) return;
            const f = 900 * Math.pow(2, (chain % 12) / 12);
            this.osc('triangle', f, this.t, 0.07, this.sfx, 0.06, 0.002, f * 1.5);
            return;
        }
        const at = this.t;
        [0, 4, 7, 12].forEach((s, i) => this.osc('square', mtof(76 + s), at + i * 0.05, 0.12, this.sfx, 0.06));
    }

    bomb() {
        if (!this.ctx) return;
        const c = this.ctx, at = this.t;
        const n = this.noise(2.2, at);
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(8000, at); f.frequency.exponentialRampToValueAtTime(80, at + 2);
        const g = c.createGain(); this.env(g, at, 0.01, 0.5, 2);
        n.connect(f); f.connect(g); g.connect(this.shaper);
        const v = c.createGain(); v.gain.value = 0.5; g.connect(v); v.connect(this.verbIn);
        this.osc('sine', 90, at, 1.4, this.sfx, 0.6, 0.005, 25);
        this.osc('sawtooth', 1600, at, 0.6, this.sfx, 0.08, 0.002, 60);
    }

    overdrive() {
        if (!this.ctx) return;
        const at = this.t;
        this.osc('sawtooth', 120, at, 0.8, this.sfx, 0.12, 0.05, 480);
        [0, 7, 12, 19].forEach((s, i) => this.osc('square', mtof(64 + s), at + i * 0.06, 0.18, this.sfx, 0.05));
    }

    ready() { if (this.ctx) [0, 12].forEach((s, i) => this.osc('sine', mtof(84 + s), this.t + i * 0.08, 0.15, this.sfx, 0.06)); }

    laser(fire) {
        if (!this.ctx || !this.throttle('laser' + fire, 0.12)) return;
        const at = this.t;
        if (!fire) this.osc('sine', 300, at, 0.6, this.sfx, 0.05, 0.3, 1200);
        else { this.osc('sawtooth', 70, at, 0.9, this.sfx, 0.12, 0.01, 60); this.osc('square', 1400, at, 0.5, this.sfx, 0.03, 0.01, 900); }
    }

    missile(x) {
        if (!this.ctx || !this.throttle('msl', 0.2)) return;
        const c = this.ctx, at = this.t;
        const p = this.pan(x); p.connect(this.sfx);
        const n = this.noise(0.5, at);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(600, at); f.frequency.exponentialRampToValueAtTime(3000, at + 0.4);
        const g = c.createGain(); this.env(g, at, 0.03, 0.08, 0.45);
        n.connect(f); f.connect(g); g.connect(p);
    }

    rescue() {
        if (!this.ctx) return;
        const at = this.t;
        [0, 4, 7, 11, 14].forEach((s, i) => this.osc('triangle', mtof(72 + s), at + i * 0.07, 0.3, this.sfx, 0.07));
    }

    warning() {
        if (!this.ctx) return;
        const at = this.t;
        for (let i = 0; i < 4; i++) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(440, at + i * 0.8);
            o.frequency.linearRampToValueAtTime(660, at + i * 0.8 + 0.4);
            o.frequency.linearRampToValueAtTime(440, at + i * 0.8 + 0.8);
            g.gain.setValueAtTime(0.0001, at + i * 0.8);
            g.gain.exponentialRampToValueAtTime(0.07, at + i * 0.8 + 0.05);
            g.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.8 + 0.78);
            o.connect(g); g.connect(this.sfx);
            o.start(at + i * 0.8); o.stop(at + i * 0.8 + 0.8);
        }
    }

    bossBoom(final) {
        if (!this.ctx) return;
        this.explosion(270, 'xl');
        const at = this.t;
        this.osc('sine', 60, at, final ? 4 : 2.5, this.sfx, 0.7, 0.01, 20);
        const n = this.noise(3, at);
        const g = this.ctx.createGain(); this.env(g, at, 0.02, 0.4, 3);
        n.connect(g); g.connect(this.verbIn);
    }

    ui(kind = 'click') {
        if (!this.ctx) return;
        const at = this.t;
        if (kind === 'click') this.osc('square', 1200, at, 0.03, this.sfx, 0.04, 0.001, 900);
        else if (kind === 'buy') [0, 7, 12].forEach((s, i) => this.osc('triangle', mtof(79 + s), at + i * 0.05, 0.15, this.sfx, 0.08));
        else if (kind === 'deny') this.osc('square', 160, at, 0.15, this.sfx, 0.06, 0.002, 120);
        else if (kind === 'hover') this.osc('sine', 2000, at, 0.02, this.sfx, 0.015, 0.001);
        else if (kind === 'comms') { this.osc('square', 1800, at, 0.03, this.sfx, 0.03); this.osc('square', 2400, at + 0.05, 0.03, this.sfx, 0.03); }
    }

    // ------------------------------------------------------------ rotor loop

    rotor(on, level = 0.5) {
        if (!this.ctx) return;
        const c = this.ctx;
        if (on && !this.rotorNodes) {
            const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
            const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 140; f.Q.value = 1.1;
            const am = c.createGain(); am.gain.value = 0.5;
            const lfo = c.createOscillator(); lfo.frequency.value = 11.5;
            const lg = c.createGain(); lg.gain.value = 0.45;
            lfo.connect(lg); lg.connect(am.gain);
            const out = c.createGain(); out.gain.value = 0;
            const hum = c.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 46;
            const hg = c.createGain(); hg.gain.value = 0.25;
            hum.connect(hg); hg.connect(am);
            n.connect(f); f.connect(am); am.connect(out); out.connect(this.sfx);
            n.start(); lfo.start(); hum.start();
            this.rotorNodes = { n, f, am, lfo, out, hum };
        }
        if (this.rotorNodes) {
            const now = c.currentTime;
            if (on === this.rotorState && now - (this.rotorAt || 0) < 0.12) return;
            this.rotorState = on; this.rotorAt = now;
            const r = this.rotorNodes;
            r.out.gain.setTargetAtTime(on ? 0.12 * level + 0.05 : 0, c.currentTime, 0.3);
            r.lfo.frequency.setTargetAtTime(10.5 + level * 3, c.currentTime, 0.3);
            r.f.frequency.setTargetAtTime(120 + level * 60, c.currentTime, 0.3);
        }
    }

    // ------------------------------------------------------------ music

    /** cfg: { root, bpm, scale, seed } or a name ('menu', 'hangar', 'victory'). */
    playMusic(cfg, intensity = 1) {
        this.musicWant = cfg;
        if (!this.ctx) return;
        if (cfg === null) { this.music = null; return; }
        if (typeof cfg === 'string') {
            cfg = cfg === 'menu' ? { root: 45, bpm: 96, scale: 'dorian', seed: 5, calm: true }
                : cfg === 'hangar' ? { root: 48, bpm: 88, scale: 'dorian', seed: 9, calm: true }
                    : cfg === 'ending' ? { root: 50, bpm: 76, scale: 'aeolian', seed: 99, calm: true, major: true }
                        : { root: 50, bpm: 120, scale: 'aeolian', seed: 1 };
        }
        const r = rng(cfg.seed * 7919 + 13);
        const scale = SCALES[cfg.scale] || SCALES.aeolian;
        const prog = cfg.major ? [0, 3, 4, 3].map((d) => d) : PROGS[Math.floor(r() * PROGS.length)];
        const kick = [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]][Math.floor(r() * 3)];
        const bass = [[1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1], [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0]][Math.floor(r() * 3)];
        const arpOrder = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 1, 2], [0, 1, 2, 1, 3, 2, 1, 0]][Math.floor(r() * 3)];
        const motif = Array.from({ length: 16 }, () => (r() < 0.55 ? Math.floor(r() * 7) : -1));
        const startAt = this.ctx.currentTime + 0.1;
        this.music = { cfg, scale, prog, kick, bass, arpOrder, motif, step: 0, next: startAt, intensity, target: intensity, id: Math.random() };
        this.mus.gain.cancelScheduledValues(this.ctx.currentTime);
        this.mus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.mus.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.vol.music * 0.55), this.ctx.currentTime + 1.5);
    }

    setIntensity(i) { if (this.music) this.music.target = i; }

    tick() {
        const m = this.music;
        if (!m || !this.ctx || this.ctx.state !== 'running') return;
        const spb = 60 / m.cfg.bpm / 4; // 16th
        while (m.next < this.ctx.currentTime + 0.12) {
            this.step(m, m.next, spb);
            m.next += spb;
            m.step++;
        }
    }

    chordNotes(m, bar) {
        const deg = m.prog[Math.floor(bar / 2) % m.prog.length];
        const s = m.scale;
        const n = (d) => m.cfg.root + s[d % 7] + 12 * Math.floor(d / 7);
        return [n(deg), n(deg + 2), n(deg + 4), n(deg + 7)];
    }

    step(m, at, spb) {
        const st = m.step % 16;
        const bar = Math.floor(m.step / 16);
        if (st === 0) m.intensity = m.target;
        const I = m.intensity;
        const calm = m.cfg.calm;
        const chord = this.chordNotes(m, bar);
        const out = this.mus;
        // pad
        if (st === 0 && bar % 2 === 0) {
            for (const nt of chord.slice(0, 3)) {
                for (const det of [-6, 6]) {
                    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
                    o.type = 'sawtooth'; o.frequency.value = mtof(nt + 12); o.detune.value = det;
                    f.type = 'lowpass'; f.frequency.value = calm ? 900 : 1300;
                    const dur = spb * 32;
                    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(calm ? 0.035 : 0.025, at + spb * 6);
                    g.gain.setValueAtTime(calm ? 0.035 : 0.025, at + dur - spb * 6); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                    o.connect(f); f.connect(g); g.connect(out); g.connect(this.verbIn);
                    o.start(at); o.stop(at + dur + 0.05);
                }
            }
        }
        // arpeggio
        if (!calm || st % 2 === 0) {
            const k = m.arpOrder[m.step % m.arpOrder.length];
            const nt = chord[k] + 24;
            const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
            o.type = calm ? 'triangle' : 'square'; o.frequency.value = mtof(nt);
            f.type = 'lowpass'; f.frequency.value = calm ? 1800 : 2200 + Math.sin(m.step * 0.05) * 900;
            this.env(g, at, 0.003, calm ? 0.05 : 0.035, spb * 1.6);
            o.connect(f); f.connect(g); g.connect(out); g.connect(this.delay);
            o.start(at); o.stop(at + spb * 2);
        }
        if (calm) return;
        // drums
        if (m.kick[st] || (I >= 2 && st % 4 === 0)) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.25);
            this.env(g, at, 0.002, 0.5, 0.3);
            o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.35);
        }
        if (st === 4 || st === 12 || (I >= 2 && st === 14 && bar % 2)) {
            const n = this.noise(0.2, at), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
            f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
            this.env(g, at, 0.002, 0.22, 0.18);
            n.connect(f); f.connect(g); g.connect(out);
            const gv = this.ctx.createGain(); gv.gain.value = 0.4; g.connect(gv); gv.connect(this.verbIn);
            this.osc('triangle', 190, at, 0.08, out, 0.12, 0.002, 120);
        }
        if (st % 2 === 0 || I >= 2) {
            const n = this.noise(0.05, at), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
            f.type = 'highpass'; f.frequency.value = 7500;
            this.env(g, at, 0.001, st % 4 === 2 ? 0.07 : 0.035, st === 14 ? 0.18 : 0.04);
            n.connect(f); f.connect(g); g.connect(out);
        }
        // bass
        if (m.bass[st]) {
            const root = chord[0] - 12 + (st === 14 ? 7 : st === 10 && bar % 2 ? 12 : 0);
            const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = mtof(root);
            f.type = 'lowpass'; f.Q.value = 6;
            f.frequency.setValueAtTime(I >= 2 ? 1400 : 900, at); f.frequency.exponentialRampToValueAtTime(160, at + spb * 1.5);
            this.env(g, at, 0.003, 0.16, spb * 1.6);
            o.connect(f); f.connect(g); g.connect(out);
            o.start(at); o.stop(at + spb * 2);
        }
        // lead for bosses
        if (I >= 2 && m.motif[st] >= 0 && bar % 4 < 3) {
            const deg = m.motif[st] + Math.floor(bar / 4) % 2 * 2;
            const nt = m.cfg.root + 24 + m.scale[deg % 7] + 12 * Math.floor(deg / 7);
            const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
            const vib = this.ctx.createOscillator(), vg = this.ctx.createGain();
            vib.frequency.value = 6; vg.gain.value = 6; vib.connect(vg); vg.connect(o.detune);
            o.type = 'sawtooth'; o.frequency.value = mtof(nt);
            f.type = 'lowpass'; f.frequency.value = 2600;
            this.env(g, at, 0.01, 0.05, spb * 2.6);
            o.connect(f); f.connect(g); g.connect(out); g.connect(this.delay);
            o.start(at); vib.start(at); o.stop(at + spb * 3); vib.stop(at + spb * 3);
        }
    }
}
