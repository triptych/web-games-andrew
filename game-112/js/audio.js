// Procedural sound, all Web Audio, no files. Effects answer the view's animations; the music is a
// look-ahead sequencer playing a plucked, lute-like line over a drone, in a mode per scene:
// dorian on the map, phrygian in battle, a slower minor for bosses, a bright mixolydian fanfare.
// The context is made on the first gesture, and ../lib/page-audio.js suspends it in a hidden tab.

const MODES = {
    map:    { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], tempo: 84, drone: 0.05, perc: 0 },
    battle: { root: 45, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 112, drone: 0.06, perc: 1 },
    boss:   { root: 41, scale: [0, 1, 3, 5, 6, 8, 10], tempo: 96, drone: 0.08, perc: 2 },
    title:  { root: 50, scale: [0, 2, 4, 5, 7, 9, 10], tempo: 76, drone: 0.05, perc: 0 },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.mood = 'title';
        this.step = 0;
        this.nextT = 0;
        this.phrase = [];
        this.seed = 7;
    }

    rand() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a small hall: a noise impulse reverb on the music
        const len = ctx.sampleRate * 1.8;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.32;
        this.verb.connect(wet); wet.connect(this.music);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.startDrone();
        this.nextT = ctx.currentTime + 0.2;
        this.timer = setInterval(() => this.schedule(), 90);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.03);
    }

    setMood(m) {
        if (!MODES[m] || m === this.mood) return;
        this.mood = m;
        this.phrase = [];
        if (this.ctx) this.retuneDrone();
    }

    // ------------------------------------------------------------------ music
    startDrone() {
        const ctx = this.ctx;
        this.droneG = ctx.createGain(); this.droneG.gain.value = 0;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
        this.droneG.connect(lp); lp.connect(this.music); lp.connect(this.verb);
        this.drones = [0, 7, 12].map((iv) => {
            const o = ctx.createOscillator(); o.type = 'sawtooth';
            const g = ctx.createGain(); g.gain.value = iv === 12 ? 0.3 : 0.5;
            o.connect(g); g.connect(this.droneG); o.start();
            return { o, iv };
        });
        this.retuneDrone();
    }
    retuneDrone() {
        const M = MODES[this.mood], t = this.ctx.currentTime;
        for (const d of this.drones) d.o.frequency.setTargetAtTime(mtof(M.root - 12 + d.iv), t, 0.6);
        this.droneG.gain.setTargetAtTime(M.drone, t, 0.8);
    }

    pluck(midi, t, dur, vol = 0.16) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'triangle'; o2.type = 'square';
        o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * 1.003;
        const g2 = ctx.createGain(); g2.gain.value = 0.18;
        f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }

    drum(t, low = true, vol = 0.25) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(low ? 110 : 190, t); o.frequency.exponentialRampToValueAtTime(low ? 45 : 90, t + 0.18);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + 0.3);
    }

    /** A new four-bar phrase: a walk over the mode with a cadence back to the root. */
    makePhrase() {
        const M = MODES[this.mood];
        const n = 16, out = [];
        let deg = 0;
        for (let i = 0; i < n; i++) {
            const strong = i % 4 === 0;
            if (i === n - 1) deg = 0;
            else if (strong) deg = [0, 2, 4, 3][(i / 4) | 0] + (this.rand() < 0.3 ? 7 : 0);
            else deg += [-1, 1, 1, 2, -2, 0][Math.floor(this.rand() * 6)];
            deg = Math.max(-2, Math.min(11, deg));
            const rest = !strong && this.rand() < 0.28;
            const oct = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
            out.push(rest ? null : M.root + 12 + oct * 12 + M.scale[d]);
        }
        return out;
    }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        const M = MODES[this.mood];
        const beat = 60 / M.tempo / 2;            // eighth notes
        while (this.nextT < ctx.currentTime + 0.3) {
            if (!this.phrase.length) this.phrase = this.makePhrase();
            const i = this.step % 16;
            const note = this.phrase[i];
            if (note != null && this.musicVol > 0) this.pluck(note, this.nextT, beat * (i % 4 === 0 ? 3 : 1.6), i % 4 === 0 ? 0.17 : 0.11);
            if (i % 4 === 0 && this.musicVol > 0) this.pluck(M.root + (i === 8 ? 7 : 0), this.nextT, beat * 4, 0.1);
            if (M.perc && this.musicVol > 0) {
                if (i % 8 === 0) this.drum(this.nextT, true, 0.22);
                if (M.perc > 1 && i % 8 === 6) this.drum(this.nextT, true, 0.16);
                if (i % 4 === 2) this.drum(this.nextT, false, 0.06);
            }
            this.step++;
            if (this.step % 16 === 0 && this.rand() < 0.5) this.phrase = [];
            this.nextT += beat;
        }
    }

    // ------------------------------------------------------------------ effects
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfxBus);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise({ dur = 0.2, vol = 0.2, f = 1200, q = 1, type = 'bandpass', delay = 0, to = null } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(this.sfxBus);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.noise({ dur: 0.05, vol: 0.12, f: 2600, q: 2 });
        else if (kind === 'open') { this.noise({ dur: 0.18, vol: 0.1, f: 900, q: 0.7, to: 2400 }); }
        else if (kind === 'close') this.noise({ dur: 0.14, vol: 0.08, f: 2400, q: 0.7, to: 800 });
        else if (kind === 'card') this.noise({ dur: 0.09, vol: 0.13, f: 3200, q: 1.2, to: 1400 });
        else if (kind === 'deny') this.tone({ freq: 160, to: 120, dur: 0.15, type: 'square', vol: 0.08 });
        else if (kind === 'select') this.tone({ freq: 660, to: 880, dur: 0.07, type: 'triangle', vol: 0.1 });
        else if (kind === 'coin') [0, 0.06, 0.12].forEach((d, i) => this.tone({ freq: 1800 + i * 300, dur: 0.1, type: 'triangle', vol: 0.09, delay: d }));
        else if (kind === 'quill') this.noise({ dur: 0.35, vol: 0.08, f: 5000, q: 3, to: 3000 });
    }

    sfx(kind) {
        switch (kind) {
            case 'step': this.noise({ dur: 0.06, vol: 0.12, f: 400, q: 1, type: 'lowpass' }); break;
            case 'march': for (let i = 0; i < 3; i++) this.noise({ dur: 0.06, vol: 0.1, f: 300, type: 'lowpass', delay: i * 0.12 }); break;
            case 'wings': for (let i = 0; i < 3; i++) this.noise({ dur: 0.16, vol: 0.12, f: 500, q: 0.6, to: 1200, delay: i * 0.15 }); break;
            case 'hit': this.noise({ dur: 0.12, vol: 0.28, f: 900, q: 0.8 }); this.tone({ freq: 2200, to: 1600, dur: 0.18, type: 'triangle', vol: 0.06 }); break;
            case 'parry': this.tone({ freq: 2600, to: 2300, dur: 0.22, type: 'triangle', vol: 0.08 }); this.noise({ dur: 0.06, vol: 0.15, f: 3000, q: 2 }); break;
            case 'crit': this.noise({ dur: 0.25, vol: 0.35, f: 600, q: 0.6 }); this.tone({ freq: 120, to: 50, dur: 0.3, type: 'sine', vol: 0.3 }); break;
            case 'bow': this.tone({ freq: 220, to: 90, dur: 0.12, type: 'triangle', vol: 0.12 }); this.noise({ dur: 0.3, vol: 0.06, f: 4000, q: 1, to: 1500, delay: 0.05 }); break;
            case 'zap': this.tone({ freq: 1400, to: 300, dur: 0.25, type: 'sawtooth', vol: 0.07 }); this.noise({ dur: 0.2, vol: 0.08, f: 5000, q: 4 }); break;
            case 'fire': this.noise({ dur: 0.45, vol: 0.2, f: 500, q: 0.5, to: 1600 }); break;
            case 'frost': this.tone({ freq: 2400, to: 3200, dur: 0.3, type: 'sine', vol: 0.06 }); this.noise({ dur: 0.3, vol: 0.08, f: 6000, q: 6 }); break;
            case 'whoosh': this.noise({ dur: 0.55, vol: 0.14, f: 300, q: 0.7, to: 2000 }); break;
            case 'boom': this.noise({ dur: 0.7, vol: 0.4, f: 180, type: 'lowpass' }); this.tone({ freq: 80, to: 30, dur: 0.6, type: 'sine', vol: 0.4 }); break;
            case 'breath': this.noise({ dur: 0.9, vol: 0.3, f: 400, q: 0.4, to: 1200 }); this.tone({ freq: 70, to: 40, dur: 0.8, type: 'sawtooth', vol: 0.12 }); break;
            case 'death': this.tone({ freq: 180, to: 60, dur: 0.4, type: 'triangle', vol: 0.14 }); this.noise({ dur: 0.25, vol: 0.1, f: 300, type: 'lowpass', delay: 0.15 }); break;
            case 'ward': this.tone({ freq: 520, to: 780, dur: 0.22, type: 'triangle', vol: 0.09 }); this.tone({ freq: 780, dur: 0.25, type: 'sine', vol: 0.06, delay: 0.08 }); break;
            case 'heal': [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.25, type: 'sine', vol: 0.07, delay: i * 0.06 })); break;
            case 'curse': this.tone({ freq: 300, to: 180, dur: 0.5, type: 'sawtooth', vol: 0.06 }); this.tone({ freq: 317, to: 190, dur: 0.5, type: 'sawtooth', vol: 0.06 }); break;
            case 'rock': this.noise({ dur: 0.35, vol: 0.25, f: 200, type: 'lowpass' }); break;
            case 'summon': this.tone({ freq: 110, to: 220, dur: 0.5, type: 'sawtooth', vol: 0.08 }); this.noise({ dur: 0.4, vol: 0.1, f: 400, type: 'lowpass' }); break;
            case 'cry': this.tone({ freq: 196, to: 247, dur: 0.4, type: 'sawtooth', vol: 0.08 }); break;
            case 'roar': this.noise({ dur: 0.9, vol: 0.3, f: 220, q: 0.6, to: 120 }); this.tone({ freq: 90, to: 60, dur: 0.9, type: 'sawtooth', vol: 0.14 }); break;
            case 'horn': [0, 0.18, 0.36].forEach((d, i) => this.tone({ freq: [262, 330, 392][i], dur: 0.5 - i * 0.05, type: 'sawtooth', vol: 0.07, delay: d })); break;
            case 'drum': this.ctx && this.ctx.state === 'running' && this.drum(this.ctx.currentTime, true, 0.3); break;
            case 'drum2': if (this.ctx && this.ctx.state === 'running') { this.drum(this.ctx.currentTime, true, 0.3); this.drum(this.ctx.currentTime + 0.18, true, 0.25); } break;
            case 'victory': [0, 4, 7, 12, 7, 12].forEach((s, i) => this.tone({ freq: 392 * Math.pow(2, s / 12), dur: i === 5 ? 0.7 : 0.2, type: 'triangle', vol: 0.1, delay: i * 0.13 })); break;
            case 'defeat': [0, -2, -5, -9].forEach((s, i) => this.tone({ freq: 220 * Math.pow(2, s / 12), dur: 0.5, type: 'triangle', vol: 0.1, delay: i * 0.3 })); break;
            default: break;
        }
    }
}
