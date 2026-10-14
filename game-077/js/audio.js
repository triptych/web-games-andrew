// CUE VICE — all sound is synthesised with Web Audio: a little 1986 drum
// machine with a gated snare, detuned saw pads, a sawtooth bass, an FM
// "DX bell" and a delayed lead, plus every sound effect. No files.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const M = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const n = (s) => { const m = s.match(/^([A-G][#b]?)(-?\d)$/); return 12 * (+m[2] + 1) + M[m[1]]; };
const chord = (root, kind = 'm') => {
    const r = n(root);
    return kind === 'm' ? [r, r + 3, r + 7] : kind === 'M' ? [r, r + 4, r + 7] : kind === 'm7' ? [r, r + 3, r + 7, r + 10] : kind === 'M7' ? [r, r + 4, r + 7, r + 11] : [r, r + 5, r + 7];
};

// Tracks: bpm, chords (one per bar), drum patterns (16 steps; x = hit, o = soft), bass style, lead melody (per bar, 16-step strings of note|-)
const TRACKS = {
    title: {
        bpm: 100, chords: [['D3', 'm'], ['Bb2', 'M'], ['C3', 'M'], ['A2', 'm'], ['D3', 'm'], ['Bb2', 'M'], ['G2', 'm'], ['A2', 'M']],
        kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo', bass: 'eighth', pad: true, bell: false,
        lead: [
            ['D5', '-', '-', '-', 'F5', '-', 'E5', '-', 'D5', '-', 'C5', '-', 'A4', '-', '-', '-'],
            ['Bb4', '-', '-', '-', 'D5', '-', 'F5', '-', 'A5', '-', '-', '-', 'G5', '-', 'F5', '-'],
            ['E5', '-', '-', '-', 'G5', '-', 'F5', '-', 'E5', '-', 'C5', '-', 'G4', '-', '-', '-'],
            ['A4', '-', 'C5', '-', 'E5', '-', '-', '-', 'D5', '-', 'C5', '-', 'E5', '-', '-', '-'],
            ['D5', '-', '-', '-', 'F5', '-', 'A5', '-', 'D6', '-', '-', '-', 'C6', '-', 'A5', '-'],
            ['Bb5', '-', '-', '-', 'A5', '-', 'F5', '-', 'D5', '-', '-', '-', 'F5', '-', 'G5', '-'],
            ['G5', '-', '-', '-', 'F5', '-', 'D5', '-', 'Bb4', '-', 'D5', '-', 'G5', '-', '-', '-'],
            ['A5', '-', '-', '-', '-', '-', '-', '-', 'C#5', '-', 'E5', '-', 'A5', '-', '-', '-'],
        ],
    },
    stealth: {
        bpm: 92, chords: [['A2', 'm'], ['F2', 'M'], ['G2', 'M'], ['E2', 'm']],
        kick: 'x.......x.......', snare: '............x...', hat: '..o...o...o...o.', rim: '....x.......x...', bass: 'pulse', pad: true, bell: 'arp', padVol: 0.6,
    },
    tense: {
        bpm: 84, chords: [['C3', 'm'], ['Ab2', 'M'], ['C3', 'm'], ['G2', 'M']],
        kick: 'x...........x...', snare: '................', hat: 'o.o.o.o.o.o.o.o.', rim: '........x.......', bass: 'pulse', pad: true, bell: 'sparse', padVol: 0.7,
    },
    club: {
        bpm: 120, chords: [['E2', 'm'], ['C2', 'M'], ['D2', 'M'], ['B1', 'm']],
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', clap: true, bass: 'octave', pad: true, bell: 'arp', stab: true,
    },
    alert: {
        bpm: 138, chords: [['C3', 'm'], ['C3', 'm'], ['Ab2', 'M'], ['Bb2', 'M']],
        kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'sixteenth', pad: false, bell: false, stab: true, tom: true,
    },
    finale: {
        bpm: 112, chords: [['D2', 'm'], ['Bb1', 'M'], ['F2', 'M'], ['C2', 'M']],
        kick: 'x..x....x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'sixteenth', pad: true, bell: 'arp', tom: true,
        lead: [
            ['D5', '-', '-', 'F5', '-', '-', 'A5', '-', '-', '-', 'G5', '-', 'F5', '-', 'E5', '-'],
            ['D5', '-', '-', '-', '-', '-', 'F5', '-', 'Bb5', '-', '-', '-', 'A5', '-', '-', '-'],
            ['A5', '-', '-', 'C6', '-', '-', 'A5', '-', 'F5', '-', '-', '-', 'C5', '-', 'F5', '-'],
            ['G5', '-', '-', '-', 'E5', '-', '-', '-', 'C5', '-', 'D5', '-', 'E5', '-', '-', '-'],
        ],
    },
    story: { bpm: 80, chords: [['F2', 'M7'], ['E2', 'm7'], ['D2', 'm7'], ['C2', 'M7']], kick: '', snare: '', hat: '', bass: 'whole', pad: true, bell: 'sparse', padVol: 0.9 },
};

class Audio {
    constructor() {
        this.ctx = null;
        this.on = { sound: true, music: true };
        this.volume = 0.8;
        this.track = null;
        this.next = 0;
        this.step = 0;
        this.timer = null;
        this.duck = 1;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = this.volume;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(c.destination);
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.on.music ? 0.42 : 0; this.musicBus.connect(this.master);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.on.sound ? 0.8 : 0; this.sfxBus.connect(this.master);
        // shared reverb (noise impulse) and a dotted-eighth delay for the lead
        this.verb = c.createConvolver();
        const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb.buffer = ir;
        this.verbGain = c.createGain(); this.verbGain.gain.value = 0.35;
        this.verb.connect(this.verbGain); this.verbGain.connect(this.musicBus);
        this.delay = c.createDelay(1); this.delay.delayTime.value = 0.45;
        const fb = c.createGain(); fb.gain.value = 0.35;
        this.delay.connect(fb); fb.connect(this.delay);
        this.delayOut = c.createGain(); this.delayOut.gain.value = 0.4;
        this.delay.connect(this.delayOut); this.delayOut.connect(this.musicBus);
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.timer = setInterval(() => this._schedule(), 30);
        if (this.wantTrack) this.play(this.wantTrack);
    }

    setSound(v) { this.on.sound = v; if (this.sfxBus) this.sfxBus.gain.value = v ? 0.8 : 0; }
    setMusic(v) { this.on.music = v; if (this.musicBus) this.musicBus.gain.value = v ? 0.42 : 0; }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
    suspend(v) { if (!this.ctx) return; if (v) this.ctx.suspend(); else this.ctx.resume(); }

    play(name) {
        this.wantTrack = name;
        if (!this.ctx) return;
        if (this.track === TRACKS[name]) return;
        this.track = TRACKS[name] ?? null;
        this.trackName = name;
        this.step = 0;
        this.next = this.ctx.currentTime + 0.08;
    }

    // ------------------------------------------------------------------ sequencer
    _schedule() {
        const c = this.ctx, tr = this.track;
        if (!c || !tr || c.state !== 'running') return;
        const sp = 60 / tr.bpm / 4;
        while (this.next < c.currentTime + 0.14) {
            this._stepAt(tr, this.step, this.next, sp);
            this.step++;
            this.next += sp;
        }
    }

    _stepAt(tr, step, t, sp) {
        const s = step % 16, bar = Math.floor(step / 16);
        const [root, kind] = tr.chords[bar % tr.chords.length];
        const ch = chord(root, kind);
        const hit = (pat) => pat && pat[s] !== '.' && pat[s] !== undefined ? (pat[s] === 'o' ? 0.5 : 1) : 0;
        let v;
        if ((v = hit(tr.kick))) this._kick(t, v);
        if ((v = hit(tr.snare))) this._snare(t, v);
        if ((v = hit(tr.hat))) this._hat(t, v * 0.6, tr.clap && s % 4 === 2);
        if ((v = hit(tr.rim))) this._rim(t, v);
        if (tr.clap && (s === 4 || s === 12)) this._clap(t);
        if (tr.tom && bar % 4 === 3 && s >= 12) this._tom(t, 200 - (s - 12) * 25);
        // bass
        const b = ch[0] - 12 + (tr.bass === 'octave' && s % 2 ? 12 : 0);
        if (tr.bass === 'eighth' && s % 2 === 0) this._bass(t, b, sp * 1.8);
        else if (tr.bass === 'pulse' && s % 4 === 0) this._bass(t, b, sp * 3, 0.8);
        else if (tr.bass === 'octave' && s % 2 === 0) this._bass(t, b, sp * 1.6);
        else if (tr.bass === 'sixteenth') this._bass(t, b + (s % 8 === 7 ? 7 : 0), sp * 0.9, 0.85);
        else if (tr.bass === 'whole' && s === 0) this._bass(t, b, sp * 15, 0.7);
        // pad on the bar
        if (tr.pad && s === 0) this._pad(t, ch.map((x) => x + 12), sp * 16, tr.padVol ?? 1);
        if (tr.stab && (s === 3 || s === 6 || s === 11)) this._stab(t, ch.map((x) => x + 12));
        // bell
        if (tr.bell === 'arp') { const arp = [0, 1, 2, 1]; if (s % 2 === 0) this._bell(t, ch[arp[(s / 2) % 4]] + 24, 0.18); }
        if (tr.bell === 'sparse' && (s === 0 || s === 10)) this._bell(t, ch[(bar + s) % ch.length] + 24, 0.25);
        // lead
        if (tr.lead) {
            const line = tr.lead[bar % tr.lead.length];
            const note = line[s];
            if (note && note !== '-') {
                let len = 1; while (len + s < 16 && line[s + len] === '-') len++;
                this._lead(t, n(note), sp * len * 0.95);
            }
        }
    }

    _env(g, t, a, peak, d, sus = 0) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
    }

    _kick(t, v) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        this._env(g, t, 0.002, 0.9 * v, 0.32);
        o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.4);
    }
    _noise(t, dur, bus, filterType, freq, q, vol) {
        const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain();
        src.connect(f); f.connect(g); g.connect(bus);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
        return g;
    }
    _snare(t, v) {
        // the gated 80s snare: a bright noise burst held flat, then cut
        const g = this._noise(t, 0.26, this.musicBus, 'bandpass', 1900, 0.7, 1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.004);
        g.gain.setValueAtTime(0.42 * v, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        const s = this.ctx.createGain(); g.connect(s); s.gain.value = 0.6; s.connect(this.verb);
        const c = this.ctx, o = c.createOscillator(), og = c.createGain();
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        this._env(og, t, 0.002, 0.35 * v, 0.1);
        o.connect(og); og.connect(this.musicBus); o.start(t); o.stop(t + 0.15);
    }
    _clap(t) { for (let k = 0; k < 3; k++) { const g = this._noise(t + k * 0.012, 0.12, this.musicBus, 'bandpass', 1200, 1.2, 1); this._env(g, t + k * 0.012, 0.002, 0.3, 0.09); } }
    _hat(t, v, open) { const g = this._noise(t, open ? 0.2 : 0.05, this.musicBus, 'highpass', 7500, 0.5, 1); this._env(g, t, 0.001, 0.22 * v, open ? 0.18 : 0.04); }
    _rim(t, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 820; this._env(g, t, 0.001, 0.12 * v, 0.03); o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.05); }
    _tom(t, f) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.2); this._env(g, t, 0.002, 0.45, 0.22); o.connect(g); g.connect(this.musicBus); g.connect(this.verb); o.start(t); o.stop(t + 0.3); }
    _bass(t, note, dur, vol = 1) {
        const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = NOTE(note); o2.frequency.value = NOTE(note) * 0.5;
        f.type = 'lowpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(180, t + Math.min(0.25, dur));
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.005); g.gain.setValueAtTime(0.26 * vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicBus);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    _pad(t, notes, dur, vol = 1) {
        const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
        f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 0.8;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * vol, t + dur * 0.25); g.gain.setValueAtTime(0.06 * vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
        f.connect(g); g.connect(this.musicBus); g.connect(this.verb);
        for (const nt of notes) for (const det of [-9, 9]) {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(nt); o.detune.value = det;
            o.connect(f); o.start(t); o.stop(t + dur * 1.1);
        }
    }
    _stab(t, notes) {
        const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        this._env(g, t, 0.003, 0.08, 0.16);
        f.connect(g); g.connect(this.musicBus); g.connect(this.verb);
        for (const nt of notes) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = NOTE(nt); o.connect(f); o.start(t); o.stop(t + 0.2); }
    }
    _bell(t, note, vol) {
        // two-operator FM: the "E.PIANO 1" / marimba sound of every 80s cop show
        const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = NOTE(note); mod.frequency.value = NOTE(note) * 3.5;
        mg.gain.setValueAtTime(NOTE(note) * 2.5, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.4);
        mod.connect(mg); mg.connect(car.frequency);
        this._env(g, t, 0.002, 0.09 * vol * 3, 0.9);
        car.connect(g); g.connect(this.musicBus); g.connect(this.delay);
        car.start(t); mod.start(t); car.stop(t + 1); mod.stop(t + 1);
    }
    _lead(t, note, dur) {
        const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = NOTE(note); o2.frequency.value = NOTE(note); o2.detune.value = 7;
        lfo.frequency.value = 5.5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
        f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 2;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.08, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicBus); g.connect(this.delay); g.connect(this.verb);
        for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.12); }
    }

    // ------------------------------------------------------------------ sfx
    _ok() { return this.ctx && this.on.sound && this.ctx.state === 'running'; }
    _tone(type, f0, f1, dur, vol, delay = 0, bus = this.sfxBus) {
        const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        this._env(g, t, 0.003, vol, dur);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    }
    _burst(dur, freq, type, vol, delay = 0, q = 0.7) {
        const t = this.ctx.currentTime + delay;
        const g = this._noise(t, dur, this.sfxBus, type, freq, q, vol);
        this._env(g, t, 0.003, vol, dur);
        return g;
    }

    sfx(name, v = 1) {
        if (!this._ok()) return;
        switch (name) {
            case 'clack': this._tone('triangle', 2400 + v * 60, 1800, 0.05, Math.min(0.5, 0.08 + v * 0.03)); this._tone('sine', 900, 700, 0.07, Math.min(0.3, v * 0.025)); break;
            case 'thud': this._burst(0.09, 380 + v * 30, 'lowpass', Math.min(0.5, 0.05 + v * 0.03)); break;
            case 'shoot': this._tone('triangle', 2800, 2000, 0.06, 0.35); this._burst(0.08, 3000, 'highpass', 0.12); break;
            case 'bumper': this._tone('square', 520, 1040, 0.12, 0.18); this._tone('sine', 1040, 1560, 0.1, 0.12, 0.05); break;
            case 'splash': this._burst(0.5, 900, 'lowpass', 0.4); this._burst(0.25, 3000, 'bandpass', 0.15, 0.05); break;
            case 'boom': this._burst(1.2, 220, 'lowpass', 0.9); this._tone('sine', 110, 30, 0.8, 0.8); this._burst(0.4, 2000, 'bandpass', 0.3); break;
            case 'dart': this._burst(0.08, 2500, 'bandpass', 0.25, 0, 3); this._tone('sine', 1400, 700, 0.06, 0.1); break;
            case 'gunshot': this._burst(0.18, 1400, 'bandpass', 0.55, 0, 0.6); this._tone('square', 160, 50, 0.12, 0.25); break;
            case 'ricochet': this._tone('sine', 3200, 1200, 0.25, 0.12); break;
            case 'alarm':
                // the "!" sting
                this._tone('sawtooth', 880, 880, 0.12, 0.25); this._tone('sawtooth', 1320, 1320, 0.25, 0.25, 0.11);
                this._tone('square', 440, 440, 0.4, 0.15, 0.11);
                break;
            case 'suspicious': this._tone('sine', 660, 990, 0.15, 0.15); break;
            case 'ko': this._tone('sine', 300, 80, 0.25, 0.4); this._burst(0.12, 600, 'lowpass', 0.3); for (let k = 0; k < 3; k++) this._tone('sine', 1800 + k * 300, 1800 + k * 300, 0.08, 0.06, 0.15 + k * 0.07); break;
            case 'pickup': [0, 4, 7, 12].forEach((s, k) => this._tone('square', NOTE(76 + s), NOTE(76 + s), 0.09, 0.12, k * 0.06)); break;
            case 'tape': [0, 7, 12, 16, 19].forEach((s, k) => this._tone('triangle', NOTE(72 + s), NOTE(72 + s), 0.12, 0.16, k * 0.05)); break;
            case 'door': this._burst(0.5, 500, 'lowpass', 0.25); this._tone('square', 110, 220, 0.35, 0.06); break;
            case 'glass': for (let k = 0; k < 6; k++) this._tone('sine', 2000 + Math.random() * 3000, 1500, 0.2, 0.06, k * 0.02); this._burst(0.3, 5000, 'highpass', 0.35); break;
            case 'crash': this._burst(0.4, 700, 'lowpass', 0.6); this._burst(0.25, 2500, 'bandpass', 0.2); break;
            case 'heal': [0, 4, 7, 11, 14].forEach((s, k) => this._tone('sine', NOTE(79 + s), NOTE(79 + s), 0.2, 0.1, k * 0.05)); break;
            case 'ghost': this._tone('sine', 1200, 300, 0.5, 0.15); this._tone('sine', 1800, 450, 0.5, 0.08, 0.02); break;
            case 'anchor': this._tone('sine', 90, 40, 0.5, 0.7); this._burst(0.4, 300, 'lowpass', 0.5); break;
            case 'boombox': [0, 3, 7, 10, 12, 10, 7, 3].forEach((s, k) => this._tone('square', NOTE(64 + s), NOTE(64 + s), 0.08, 0.1, k * 0.07)); break;
            case 'rebank': this._tone('triangle', 900, 1800, 0.15, 0.2); break;
            case 'rewind': this._tone('sawtooth', 2000, 200, 0.9, 0.12); this._burst(0.9, 4000, 'bandpass', 0.15); break;
            case 'click': this._tone('square', 1200, 1200, 0.03, 0.08); break;
            case 'select': this._tone('triangle', 660, 990, 0.08, 0.15); break;
            case 'back': this._tone('triangle', 660, 440, 0.08, 0.12); break;
            case 'type': this._tone('square', 1500 + Math.random() * 400, 1500, 0.015, 0.03); break;
            case 'radio': this._burst(0.12, 2500, 'bandpass', 0.12, 0, 2); this._tone('sine', 1800, 1800, 0.05, 0.08, 0.1); break;
            case 'laser': this._tone('sawtooth', 1800, 300, 0.25, 0.2); break;
            case 'hurt': this._tone('square', 300, 120, 0.25, 0.25); break;
            case 'downed': this._tone('sawtooth', 400, 60, 0.7, 0.3); break;
            case 'extract': this._tone('square', 300, 300, 0.05, 0.1); this._burst(0.6, 180, 'lowpass', 0.4, 0.1); this._tone('sawtooth', 70, 160, 0.6, 0.18, 0.15); break;
            case 'honk': this._tone('square', 392, 392, 0.18, 0.15); this._tone('square', 330, 330, 0.18, 0.15); break;
            case 'nope': this._tone('square', 180, 140, 0.15, 0.15); break;
            case 'join': [0, 4, 7, 12, 16].forEach((s, k) => this._tone('sawtooth', NOTE(64 + s), NOTE(64 + s), 0.12, 0.08, k * 0.06)); break;
            case 'hack': for (let k = 0; k < 8; k++) this._tone('square', 800 + Math.random() * 1600, 800, 0.03, 0.06, k * 0.03); break;
            case 'objective': [0, 7, 12].forEach((s, k) => this._tone('triangle', NOTE(72 + s), NOTE(72 + s), 0.15, 0.15, k * 0.08)); break;
            case 'bossHit': this._tone('sawtooth', 200, 60, 0.4, 0.4); this._burst(0.3, 800, 'lowpass', 0.4); break;
            case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((s, k) => this._tone('sawtooth', NOTE(62 + s), NOTE(62 + s), 0.25, 0.12, k * 0.09)); break;
            case 'lose': [12, 8, 5, 0].forEach((s, k) => this._tone('sawtooth', NOTE(57 + s), NOTE(55 + s), 0.4, 0.15, k * 0.22)); break;
            case 'car': this._tone('sawtooth', 60, 50, 0.4, Math.min(0.15, v * 0.02)); break;
            case 'thunder': this._burst(2.2, 160, 'lowpass', 0.7); break;
        }
    }
}

export const audio = new Audio();
