// All sound is generated: a generative ambient score (pads, bells, drone) with combat and
// docked layers, a continuous engine voice, a mining-beam loop and one-shot effects.

const SCALES = {
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], pentatonic: [0, 3, 5, 7, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const PROGS = [[0, 5, 3, 6], [0, 3, 4, 3], [0, 6, 5, 4], [0, 2, 5, 3], [0, 4, 5, 3]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.vol = { music: 0.6, sfx: 0.8, muted: false };
        this.mood = 'title';
        this.limit = new Map();
        this.musicKey = { root: 45, scale: SCALES.dorian, prog: PROGS[0] };
        this.chordI = 0;
        this.nextChord = 0;
        this.nextBell = 0;
        this.nextBeat = 0;
        this.beat = 0;
        this.combat = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain();
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -16; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
        this.master.connect(this.comp).connect(c.destination);
        this.musicBus = c.createGain();
        this.sfxBus = c.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        // Shared reverb-ish delay for music
        this.delay = c.createDelay(1.5);
        this.delay.delayTime.value = 0.42;
        this.fb = c.createGain(); this.fb.gain.value = 0.42;
        this.dlp = c.createBiquadFilter(); this.dlp.type = 'lowpass'; this.dlp.frequency.value = 2400;
        this.delay.connect(this.dlp).connect(this.fb).connect(this.delay);
        this.dlp.connect(this.musicBus);
        this.padFilter = c.createBiquadFilter();
        this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 900; this.padFilter.Q.value = 2;
        this.padFilter.connect(this.musicBus);
        this.padFilter.connect(this.delay);
        this.noiseBuf = this.makeNoise();
        this.applyVolume();
        this.startEngine();
        this.timer = setInterval(() => this.schedule(), 100);
    }

    makeNoise() {
        const c = this.ctx;
        const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    setVolumes(v) { Object.assign(this.vol, v); this.applyVolume(); }
    applyVolume() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.vol.muted ? 0 : 0.9, t, 0.05);
        this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.1);
        this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    }
    toggleMute() { this.vol.muted = !this.vol.muted; this.applyVolume(); return this.vol.muted; }

    // Pick key and mode from a system seed.
    setSystem(seed) {
        const s = seed >>> 0;
        const names = Object.keys(SCALES);
        this.musicKey = { root: 40 + (s % 9), scale: SCALES[names[(s >>> 4) % names.length]], prog: PROGS[(s >>> 8) % PROGS.length] };
        this.chordI = 0;
    }
    setMood(m) { this.mood = m; }
    setCombat(on) { this.combatTarget = on ? 1 : 0; }

    // ---------------------------------------------------------------- music scheduler
    schedule() {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const now = c.currentTime;
        this.combat += ((this.combatTarget || 0) - this.combat) * 0.08;
        const K = this.musicKey;
        const deg = (d, oct = 0) => { const sc = K.scale; const n = sc.length; const o = Math.floor(d / n); return K.root + sc[((d % n) + n) % n] + 12 * (o + oct); };
        if (this.mood === 'warp') return;
        if (now + 0.3 > this.nextChord) {
            const t = Math.max(now + 0.05, this.nextChord);
            const dur = this.mood === 'docked' ? 6 : 9;
            const root = K.prog[this.chordI % K.prog.length];
            this.chordI++;
            const notes = [deg(root, 0), deg(root + 2, 0), deg(root + 4, 0), deg(root + 6, -1)];
            for (const n of notes) this.padVoice(mtof(n), t, dur + 1.5, this.mood === 'docked' ? 0.05 : 0.045);
            this.drone(mtof(deg(root, -1)), t, dur + 1, 0.05);
            this.nextChord = t + dur;
            // slow filter sweep
            this.padFilter.frequency.cancelScheduledValues(t);
            this.padFilter.frequency.setValueAtTime(500, t);
            this.padFilter.frequency.linearRampToValueAtTime(this.mood === 'docked' ? 1400 : 1100 + Math.random() * 900, t + dur * 0.5);
            this.padFilter.frequency.linearRampToValueAtTime(600, t + dur);
        }
        if (now + 0.3 > this.nextBell) {
            const t = Math.max(now + 0.05, this.nextBell);
            const n = deg(Math.floor(Math.random() * 10), 2);
            this.bell(mtof(n), t, this.mood === 'docked' ? 0.045 : 0.035);
            if (Math.random() < 0.4) this.bell(mtof(n + (Math.random() < 0.5 ? 7 : 12)), t + 0.18, 0.02);
            this.nextBell = t + (this.mood === 'docked' ? 0.9 : 1.6) + Math.random() * 2.6;
        }
        // Combat layer: pulse bass + drums at 128 bpm.
        if (this.combat > 0.05) {
            const step = 60 / 128 / 2;
            if (this.nextBeat < now) this.nextBeat = now + 0.05;
            while (this.nextBeat < now + 0.3) {
                const t = this.nextBeat, b = this.beat++;
                const root = K.prog[(this.chordI + K.prog.length - 1) % K.prog.length];
                const bn = deg(root + (b % 8 === 6 ? 4 : 0), -2);
                this.pulse(mtof(bn), t, step * 0.8, 0.07 * this.combat);
                if (b % 4 === 0) this.kick(t, 0.5 * this.combat);
                if (b % 8 === 4) this.snare(t, 0.22 * this.combat);
                if (b % 2 === 1) this.hat(t, 0.06 * this.combat);
                this.nextBeat += step;
            }
        }
    }
    padVoice(f, t, dur, vol) {
        const c = this.ctx;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
        g.gain.setValueAtTime(vol, t + dur * 0.65);
        g.gain.linearRampToValueAtTime(0, t + dur);
        g.connect(this.padFilter);
        for (const det of [-7, 6]) {
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.detune.value = det;
            o.connect(g);
            o.start(t); o.stop(t + dur + 0.1);
        }
    }
    drone(f, t, dur, vol) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 2); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g).connect(this.musicBus);
        o.start(t); o.stop(t + dur + 0.1);
    }
    bell(f, t, vol) {
        const c = this.ctx;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        g.connect(this.musicBus); g.connect(this.delay);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
        const g2 = c.createGain(); g2.gain.value = 0.25;
        o.connect(g); o2.connect(g2).connect(g);
        o.start(t); o.stop(t + 3); o2.start(t); o2.stop(t + 3);
    }
    pulse(f, t, dur, vol) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(200, t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp).connect(g).connect(this.musicBus);
        o.start(t); o.stop(t + dur + 0.05);
    }
    kick(t, vol) {
        const c = this.ctx;
        const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.32);
    }
    snare(t, vol) { this.noiseHit(t, vol, 'bandpass', 1800, 0.18, this.musicBus); }
    hat(t, vol) { this.noiseHit(t, vol, 'highpass', 7000, 0.05, this.musicBus); }
    noiseHit(t, vol, type, freq, dur, bus = this.sfxBus, q = 1) {
        const c = this.ctx;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(bus);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
        return { s, f, g };
    }

    // ---------------------------------------------------------------- continuous voices
    startEngine() {
        const c = this.ctx;
        this.eng = {};
        const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 0.8;
        const ng = c.createGain(); ng.gain.value = 0;
        n.connect(nf).connect(ng).connect(this.sfxBus);
        n.start();
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
        const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 200;
        const og = c.createGain(); og.gain.value = 0;
        o.connect(of).connect(og).connect(this.sfxBus);
        o.start();
        // Mining beam: two detuned saws + crackle
        const m1 = c.createOscillator(); m1.type = 'sawtooth'; m1.frequency.value = 110;
        const m2 = c.createOscillator(); m2.type = 'square'; m2.frequency.value = 111.5;
        const mf = c.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 900; mf.Q.value = 3;
        const mg = c.createGain(); mg.gain.value = 0;
        const lfo = c.createOscillator(); lfo.frequency.value = 18;
        const lg = c.createGain(); lg.gain.value = 300;
        lfo.connect(lg).connect(mf.frequency);
        m1.connect(mf); m2.connect(mf); mf.connect(mg).connect(this.sfxBus);
        m1.start(); m2.start(); lfo.start();
        const mc = c.createBufferSource(); mc.buffer = this.noiseBuf; mc.loop = true; mc.playbackRate.value = 2;
        const mcf = c.createBiquadFilter(); mcf.type = 'highpass'; mcf.frequency.value = 3000;
        const mcg = c.createGain(); mcg.gain.value = 0;
        mc.connect(mcf).connect(mcg).connect(this.sfxBus); mc.start();
        // Scoop / cruise rumble
        const r = c.createBufferSource(); r.buffer = this.noiseBuf; r.loop = true; r.playbackRate.value = 0.5;
        const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 160;
        const rg = c.createGain(); rg.gain.value = 0;
        r.connect(rf).connect(rg).connect(this.sfxBus); r.start();
        this.eng = { nf, ng, o, of, og, m1, m2, mf, mg, mcg, rg, rf };
    }
    updateEngine(s) {
        if (!this.ctx || !this.eng.ng) return;
        const t = this.ctx.currentTime, E = this.eng;
        const k = s.active ? Math.min(1.4, s.thrust) : 0;
        E.ng.gain.setTargetAtTime(s.active ? 0.03 + k * 0.08 + (s.boost ? 0.08 : 0) : 0, t, 0.1);
        E.nf.frequency.setTargetAtTime(200 + k * 500 + (s.boost ? 600 : 0), t, 0.1);
        E.og.gain.setTargetAtTime(s.active ? 0.02 + k * 0.05 : 0, t, 0.1);
        E.o.frequency.setTargetAtTime(42 + k * 30 + (s.boost ? 20 : 0), t, 0.15);
        E.of.frequency.setTargetAtTime(150 + k * 400, t, 0.1);
        E.mg.gain.setTargetAtTime(s.mining ? 0.06 : 0, t, 0.04);
        E.mcg.gain.setTargetAtTime(s.mining ? 0.035 : 0, t, 0.04);
        const heat = s.heat || 0;
        E.m1.frequency.setTargetAtTime(100 + heat * 0.8, t, 0.1);
        E.m2.frequency.setTargetAtTime(101.5 + heat * 0.8, t, 0.1);
        E.rg.gain.setTargetAtTime(s.cruise ? 0.18 : s.scoop ? 0.22 : 0, t, 0.3);
        E.rf.frequency.setTargetAtTime(s.cruise ? 120 + Math.min(300, s.speed / 12) : 260, t, 0.3);
    }

    // ---------------------------------------------------------------- one-shots
    ok(name, gap = 0.05) {
        if (!this.ctx || this.ctx.state !== 'running') return false;
        const now = this.ctx.currentTime;
        if (now - (this.limit.get(name) ?? -1) < gap) return false;
        this.limit.set(name, now);
        return true;
    }
    tone(type, f0, f1, dur, vol, bus = this.sfxBus, t = this.ctx.currentTime) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    }
    laser(plasma) { if (!this.ok('laser', 0.04)) return; plasma ? (this.tone('sawtooth', 600, 120, 0.22, 0.09), this.tone('sine', 1200, 300, 0.15, 0.06)) : (this.tone('square', 1400, 260, 0.11, 0.05), this.tone('sine', 900, 200, 0.12, 0.05)); }
    elaser(f) { if (!this.ok('elaser', 0.06)) return; f === 'swarm' ? this.tone('triangle', 500, 900, 0.14, 0.05) : this.tone('sawtooth', 700, 150, 0.16, 0.04); }
    explosion(size = 1) {
        if (!this.ok('boom', 0.06)) return;
        const t = this.ctx.currentTime;
        this.noiseHit(t, 0.5 * Math.min(1.5, size), 'lowpass', 900, 0.6 + size * 0.4);
        this.noiseHit(t, 0.25, 'bandpass', 2400, 0.25);
        this.tone('sine', 120, 30, 0.7 + size * 0.3, 0.45 * Math.min(1.4, size));
    }
    hit(shield) { if (!this.ok('hit', 0.06)) return; shield ? (this.tone('sine', 1800, 600, 0.16, 0.08), this.noiseHit(this.ctx.currentTime, 0.1, 'highpass', 4000, 0.1)) : (this.tone('square', 160, 60, 0.2, 0.12), this.noiseHit(this.ctx.currentTime, 0.25, 'lowpass', 600, 0.25)); }
    ehit() { if (this.ok('ehit', 0.05)) this.tone('triangle', 900, 500, 0.06, 0.05); }
    ore(i = 0) { if (!this.ok('ore', 0.07)) return; this.tone('sine', 700 + (i % 8) * 70, 900 + (i % 8) * 70, 0.07, 0.05); }
    rockBreak() { if (!this.ok('rock', 0.1)) return; const t = this.ctx.currentTime; this.noiseHit(t, 0.4, 'lowpass', 1200, 0.5); this.tone('triangle', 200, 60, 0.4, 0.15); }
    pickup() { if (!this.ok('pick', 0.08)) return; const t = this.ctx.currentTime; [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f, 0.12, 0.07, this.sfxBus, t + i * 0.05)); }
    dock() { const t = this.ctx?.currentTime; if (!this.ok('dock', 0.3)) return; this.noiseHit(t, 0.4, 'bandpass', 500, 0.3, this.sfxBus, 4); this.tone('square', 90, 60, 0.3, 0.12, this.sfxBus, t + 0.12); this.noiseHit(t + 0.4, 0.3, 'bandpass', 800, 0.2, this.sfxBus, 6); }
    undock() { if (!this.ok('undock', 0.3)) return; this.tone('sawtooth', 80, 200, 0.8, 0.08); this.noiseHit(this.ctx.currentTime, 0.2, 'lowpass', 400, 0.8); }
    cruiseCharge() { if (this.ok('cc', 0.3)) this.tone('sawtooth', 80, 600, 1.5, 0.07); }
    cruiseOn() { if (!this.ok('con', 0.3)) return; this.noiseHit(this.ctx.currentTime, 0.4, 'lowpass', 2000, 0.9); this.tone('sine', 200, 50, 0.9, 0.25); }
    cruiseOff() { if (this.ok('coff', 0.3)) this.tone('sawtooth', 500, 70, 0.5, 0.08); }
    warpCharge() { if (!this.ok('wc', 1)) return; this.tone('sawtooth', 60, 900, 3.2, 0.09); this.tone('sine', 30, 240, 3.2, 0.2); }
    warpJump() { if (!this.ok('wj', 1)) return; const t = this.ctx.currentTime; this.noiseHit(t, 0.6, 'lowpass', 3000, 2.4); this.tone('sine', 300, 30, 2, 0.4); this.tone('sawtooth', 1200, 80, 1.5, 0.08); }
    arrive() { if (!this.ok('arr', 1)) return; const t = this.ctx.currentTime; this.tone('sine', 60, 220, 0.8, 0.25); this.noiseHit(t, 0.3, 'bandpass', 1200, 1.2, this.sfxBus, 2); }
    scanStart() { if (this.ok('scan', 0.6)) this.tone('sine', 1200, 1250, 0.4, 0.06); }
    scanDone() { if (!this.ok('scand', 0.2)) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.06, this.sfxBus, t + i * 0.07)); }
    alarm() { if (!this.ok('alarm', 1.5)) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) { this.tone('square', 880, 660, 0.22, 0.07, this.sfxBus, t + i * 0.3); } }
    quest() { if (!this.ok('quest', 0.5)) return; const t = this.ctx.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => { this.tone('triangle', f, f, 0.4, 0.07, this.sfxBus, t + i * 0.09); this.tone('sine', f * 2, f * 2, 0.3, 0.02, this.sfxBus, t + i * 0.09); }); }
    story() { if (!this.ok('story', 1)) return; const t = this.ctx.currentTime; [0, 4, 7, 11, 14].forEach((s, i) => this.tone('sine', mtof(57 + s), mtof(57 + s), 2.4, 0.06, this.sfxBus, t + i * 0.15)); }
    buy() { if (!this.ok('buy', 0.08)) return; const t = this.ctx.currentTime; this.tone('square', 1568, 1568, 0.06, 0.04, this.sfxBus, t); this.tone('square', 2093, 2093, 0.18, 0.04, this.sfxBus, t + 0.06); }
    click() { if (this.ok('click', 0.03)) this.tone('triangle', 1400, 900, 0.04, 0.04); }
    hover() { if (this.ok('hover', 0.04)) this.tone('sine', 2400, 2400, 0.02, 0.012); }
    error() { if (this.ok('err', 0.15)) { this.tone('square', 200, 140, 0.15, 0.06); } }
    upgrade() { if (!this.ok('upg', 0.3)) return; const t = this.ctx.currentTime; [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('sawtooth', f, f, 0.18, 0.04, this.sfxBus, t + i * 0.06)); this.noiseHit(t, 0.15, 'highpass', 5000, 0.5); }
    shard() { if (!this.ok('shard', 1)) return; const t = this.ctx.currentTime; [0, 7, 12, 16, 19, 24].forEach((s, i) => { this.tone('sine', mtof(60 + s), mtof(60 + s), 3, 0.06, this.sfxBus, t + i * 0.12); this.tone('triangle', mtof(48 + s), mtof(48 + s), 2.5, 0.03, this.sfxBus, t + i * 0.12); }); }
    overheat() { if (this.ok('oh', 1)) { this.noiseHit(this.ctx.currentTime, 0.2, 'highpass', 3000, 0.6); this.tone('sine', 900, 300, 0.4, 0.06); } }
    denied() { if (this.ok('den', 0.4)) { const t = this.ctx.currentTime; this.tone('square', 300, 300, 0.08, 0.05, this.sfxBus, t); this.tone('square', 220, 220, 0.12, 0.05, this.sfxBus, t + 0.1); } }
    shieldDown() { if (this.ok('sd', 1)) this.tone('sawtooth', 800, 100, 0.5, 0.08); }
    comm(pitch = 1) {
        if (!this.ok('comm', 0.6)) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 7; i++) {
            const f = (180 + Math.random() * 260) * pitch;
            this.tone(Math.random() < 0.5 ? 'triangle' : 'square', f, f * (0.8 + Math.random() * 0.5), 0.07, 0.035, this.sfxBus, t + i * 0.075);
        }
    }
}

export const audio = new AudioEngine();
