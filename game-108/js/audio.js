// Procedural sound and music, all Web Audio, no files. Effects answer simulation events.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Moods: a root, a mode and a tempo. Regions colour the battle music.
const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11] };
const MOODS = {
    title: { root: 50, mode: 'dorian', bpm: 76, prog: [0, 5, 3, 4], drums: false },
    camp: { root: 55, mode: 'ionian', bpm: 84, prog: [0, 3, 5, 4], drums: false },
    battle0: { root: 57, mode: 'aeolian', bpm: 104, prog: [0, 5, 3, 6], drums: true },
    battle1: { root: 52, mode: 'dorian', bpm: 100, prog: [0, 3, 6, 4], drums: true },
    battle2: { root: 53, mode: 'aeolian', bpm: 98, prog: [0, 6, 5, 4], drums: true },
    battle3: { root: 55, mode: 'lydian', bpm: 108, prog: [0, 4, 1, 5], drums: true },
    battle4: { root: 50, mode: 'phrygian', bpm: 96, prog: [0, 1, 6, 0], drums: true },
    boss: { root: 48, mode: 'phrygian', bpm: 118, prog: [0, 1, 5, 6], drums: true },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.mood = null;
        this.want = 'title';
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.4; this.music.connect(comp);
        // a hall reverb from a noise impulse, shared by both buses
        const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.32;
        this.verb.connect(wet); wet.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.step = 0;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 90);
        this.setMood(this.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.4, this.ctx.currentTime, 0.02);
    }

    get live() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, attack = 0.005, bus, verb = 0.3, detune = 0 } = {}) {
        if (!this.live) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.detune.value = detune;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx);
        if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
        o.start(t); o.stop(t + dur + 0.05);
    }
    noise({ dur = 0.2, vol = 0.2, delay = 0, f = 2000, q = 1, type = 'bandpass', to, bus, verb = 0.2 } = {}) {
        if (!this.live) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(bus || this.sfx);
        if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }
    bell(freq, { vol = 0.12, delay = 0, dur = 1.2 } = {}) {
        for (const [m, v] of [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.9, 0.08]]) this.tone({ freq: freq * m, dur: dur / Math.sqrt(m), vol: vol * v, delay, verb: 0.5 });
    }
    chord(notes, { dur = 1.2, vol = 0.05, delay = 0, type = 'sawtooth' } = {}) {
        if (!this.live) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(600, t); fl.frequency.linearRampToValueAtTime(2400, t + dur * 0.4); fl.frequency.linearRampToValueAtTime(800, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        fl.connect(g); g.connect(this.sfx);
        const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.verb);
        for (const n of notes) for (const d of [-8, 8]) {
            const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(n); o.detune.value = d;
            o.connect(fl); o.start(t); o.stop(t + dur + 0.05);
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.08, verb: 0.1 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'select') this.tone({ freq: 1320, dur: 0.05, type: 'sine', vol: 0.07, verb: 0.2 });
        else if (kind === 'nope') { this.tone({ freq: 180, dur: 0.1, type: 'square', vol: 0.05, verb: 0 }); this.tone({ freq: 150, dur: 0.12, type: 'square', vol: 0.05, delay: 0.1, verb: 0 }); }
        else if (kind === 'swap') this.noise({ dur: 0.12, vol: 0.08, f: 1800, to: 600, q: 0.8 });
    }

    clear(combo, n, hero) {
        const base = 72 + Math.min(10, combo - 1) * 2;
        const pick = PENTA[Math.min(PENTA.length - 1, combo + 1)];
        this.bell(mtof(base + pick), { vol: 0.07 + Math.min(0.06, n * 0.008) });
        this.tone({ freq: mtof(base + pick + 12), dur: 0.25, vol: 0.04, delay: 0.03, type: 'triangle' });
        this.noise({ dur: 0.18, vol: 0.06 + n * 0.006, f: 6000, type: 'highpass', verb: 0.15 });
        if (hero) this.recruit();
    }
    hit(big) {
        this.tone({ freq: 140, to: 60, dur: 0.18, type: 'sine', vol: big ? 0.3 : 0.18, verb: 0.1 });
        this.noise({ dur: 0.1, vol: 0.1, f: 900, q: 1.2 });
    }
    hurt() {
        this.tone({ freq: 110, to: 40, dur: 0.45, type: 'sine', vol: 0.4, verb: 0.2 });
        this.noise({ dur: 0.35, vol: 0.25, f: 500, to: 120, q: 0.7, verb: 0.3 });
        this.tone({ freq: 220, to: 90, dur: 0.25, type: 'sawtooth', vol: 0.06 });
    }
    curse() {
        this.chord([45, 51, 56], { dur: 1.1, vol: 0.05, type: 'sawtooth' });
        this.noise({ dur: 0.9, vol: 0.08, f: 300, to: 1600, q: 3, verb: 0.5 });
    }
    arrive() {
        [0, 4, 7, 11, 14, 19].forEach((n, k) => this.tone({ freq: mtof(67 + n), dur: 0.5, type: 'triangle', vol: 0.06, delay: k * 0.045, verb: 0.5 }));
        this.bell(mtof(91), { vol: 0.08, delay: 0.3 });
    }
    recruit() {
        this.chord([60, 64, 67, 72], { dur: 1.8, vol: 0.05, type: 'sawtooth' });
        [72, 76, 79, 84].forEach((n, k) => this.bell(mtof(n), { vol: 0.07, delay: 0.1 + k * 0.09 }));
    }
    skill() {
        this.tone({ freq: 300, to: 1200, dur: 0.35, type: 'sawtooth', vol: 0.05 });
        this.chord([62, 66, 69], { dur: 0.9, vol: 0.04 });
        this.noise({ dur: 0.4, vol: 0.08, f: 800, to: 5000, q: 2, verb: 0.4 });
    }
    heal() { [0, 4, 7, 12].forEach((n, k) => this.tone({ freq: mtof(76 + n), dur: 0.6, type: 'sine', vol: 0.06, delay: k * 0.07, verb: 0.6 })); }
    ward() { this.bell(mtof(64), { vol: 0.12, dur: 1.6 }); this.tone({ freq: mtof(52), dur: 0.8, vol: 0.08, verb: 0.4 }); }
    defeat() {
        this.noise({ dur: 1.0, vol: 0.3, f: 1200, to: 80, q: 0.6, verb: 0.5 });
        this.tone({ freq: 90, to: 30, dur: 0.9, vol: 0.35 });
        this.chord([57, 64, 69, 73], { dur: 1.6, vol: 0.04, delay: 0.3 });
    }
    win() {
        [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42]].forEach(([n, d]) => this.tone({ freq: mtof(67 + n), dur: 0.5, type: 'square', vol: 0.05, delay: d, verb: 0.4 }));
        this.chord([67, 71, 74, 79], { dur: 2.2, vol: 0.05, delay: 0.56 });
        this.bell(mtof(91), { vol: 0.1, delay: 0.56 });
    }
    loss() { [[0, 0], [-2, 0.3], [-5, 0.6], [-7, 0.9]].forEach(([n, d]) => this.tone({ freq: mtof(62 + n), dur: 0.7, type: 'triangle', vol: 0.07, delay: d, verb: 0.6 })); }
    summon(r) {
        this.noise({ dur: 1.2, vol: 0.1, f: 400, to: 8000, q: 4, verb: 0.6 });
        const notes = r >= 5 ? [72, 76, 79, 84, 88, 91] : r >= 4 ? [69, 72, 76, 81] : [67, 71, 74];
        notes.forEach((n, k) => this.bell(mtof(n), { vol: 0.08, delay: 0.8 + k * 0.08 }));
        if (r >= 5) this.chord([60, 64, 67, 72], { dur: 2.4, vol: 0.05, delay: 0.8 });
    }

    // ------------------------------------------------------------------ music
    setMood(name) {
        this.want = name;
        if (!this.ctx || this.mood === name) return;
        this.mood = name;
        this.cur = MOODS[name] || MOODS.title;
        this.bar = 0;
    }

    schedule() {
        if (!this.live || !this.cur) return;
        const ctx = this.ctx;
        while (this.nextT < ctx.currentTime + 0.25) {
            this.playStep(this.nextT);
            this.nextT += 60 / this.cur.bpm / 2;      // eighth notes
            this.step++;
        }
    }

    playStep(t) {
        const m = this.cur, s = this.step % 16, scale = MODES[m.mode];
        if (s === 0) this.bar++;
        const deg = m.prog[this.bar % m.prog.length];
        const note = (d, oct = 0) => m.root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
        const dly = t - this.ctx.currentTime;
        const bus = this.music;
        // pad: the chord, a bar long
        if (s === 0) {
            const ctx = this.ctx;
            const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
            const g = ctx.createGain();
            const len = (60 / m.bpm) * 4;
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len * 1.05);
            fl.connect(g); g.connect(bus);
            const sv = ctx.createGain(); sv.gain.value = 0.5; g.connect(sv); sv.connect(this.verb);
            for (const d of [deg, deg + 2, deg + 4]) for (const det of [-7, 7]) {
                const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(note(d, 0)); o.detune.value = det;
                o.connect(fl); o.start(t); o.stop(t + len * 1.1);
            }
        }
        // bass
        if (s % 4 === 0) this.tone({ freq: mtof(note(deg, -1)), dur: 0.5, type: 'triangle', vol: 0.11, delay: dly, bus, verb: 0 });
        // harp arpeggio, generated from the bar and step so it repeats each cycle of the progression
        const arp = [0, 2, 4, 7, 4, 2, 4, 9];
        if (!m.drums || s % 2 === 0 || (this.bar % 2 && s % 3 === 0)) {
            const d = deg + arp[s % 8] + (s >= 8 && this.bar % 2 ? 2 : 0);
            this.tone({ freq: mtof(note(d, 1)), dur: 0.55, type: 'triangle', vol: 0.045, delay: dly, bus, verb: 0.5 });
        }
        // a simple lead every other bar
        if (this.bar % 4 >= 2 && s % 4 === 2) this.tone({ freq: mtof(note(deg + [4, 5, 7, 6][(s / 4) | 0], 1)), dur: 0.7, type: 'sine', vol: 0.035, delay: dly, bus, verb: 0.6, attack: 0.04 });
        if (m.drums) {
            if (s % 8 === 0) this.tone({ freq: 120, to: 45, dur: 0.22, vol: 0.18, delay: dly, bus, verb: 0 });
            if (s % 8 === 4) this.noise({ dur: 0.14, vol: 0.06, f: 1800, q: 0.7, delay: dly, bus, verb: 0.2 });
            if (s % 2 === 1) this.noise({ dur: 0.04, vol: 0.025, f: 8000, type: 'highpass', delay: dly, bus, verb: 0 });
        }
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'arrive') this.arrive();
            else if (e.type === 'win') this.win();
            else if (e.type === 'loss') this.loss();
        }
    }
}
