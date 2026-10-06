// Procedural audio: a generative score per area and every sound effect, all Web Audio, no files.
// Must be unlocked by a user gesture (audio.init()). ../lib/page-audio.js silences hidden tabs.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = {
    town:   { root: 55, steps: [0, 2, 4, 5, 7, 9, 11], bpm: 100, beats: 3, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [2, 5, 9], [7, 11, 14]] },
    title:  { root: 55, steps: [0, 2, 4, 7, 9], bpm: 84, beats: 4, prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]] },
    cellar: { root: 50, steps: [0, 2, 3, 5, 7, 8, 10], bpm: 72, beats: 4, prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]] },
    jam:    { root: 52, steps: [0, 1, 3, 5, 7, 8, 10], bpm: 104, beats: 4, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]] },
    core:   { root: 45, steps: [0, 2, 3, 5, 7, 8, 11], bpm: 80, beats: 4, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-1, 2, 7]] },
    boss:   { root: 45, steps: [0, 1, 3, 5, 7, 8, 10], bpm: 138, beats: 4, prog: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, -1, 3]] },
    victory:{ root: 60, steps: [0, 2, 4, 5, 7, 9, 11], bpm: 110, beats: 4, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
};

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.vol = { music: 0.55, sfx: 0.8, muted: false };
        this.theme = null;
        this.step = 0;
        this.nextT = 0;
        this.timer = null;
        this.last = {};
        this.bar = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain();
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -14; this.comp.ratio.value = 4;
        this.master.connect(this.comp); this.comp.connect(c.destination);
        this.musicG = c.createGain(); this.musicG.connect(this.master);
        this.sfxG = c.createGain(); this.sfxG.connect(this.master);
        // Small generated room reverb shared by music and SFX.
        this.verb = c.createConvolver();
        const len = c.sampleRate * 2.2, buf = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        this.verb.buffer = buf;
        this.verbG = c.createGain(); this.verbG.gain.value = 0.28;
        this.verb.connect(this.verbG); this.verbG.connect(this.master);
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.applyVolume();
        this.timer = setInterval(() => this.schedule(), 90);
    }

    setVolumes(v) { Object.assign(this.vol, v); this.applyVolume(); }
    applyVolume() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.vol.muted ? 0 : 0.9, t, 0.05);
        this.musicG.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.3);
        this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    }

    // ------------------------------------------------------------------ building blocks
    env(g, t, a, peak, d, sustain = 0) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
    }
    tone(type, f, t, dur, vol, dest, { a = 0.005, f2 = null, detune = 0, filter = null, q = 1, verb = 0 } = {}) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
        if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        let node = o;
        if (filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = q; o.connect(fl); node = fl; }
        node.connect(g); g.connect(dest);
        if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
        this.env(g, t, a, vol, dur);
        o.start(t); o.stop(t + a + dur + 0.05);
        return o;
    }
    noise(t, dur, vol, dest, { type = 'lowpass', f = 2000, f2 = null, q = 1, a = 0.002, verb = 0 } = {}) {
        const c = this.ctx;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf;
        const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
        const g = c.createGain();
        s.connect(fl); fl.connect(g); g.connect(dest);
        if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
        this.env(g, t, a, vol, dur);
        s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05);
    }
    pluck(f, t, vol, dest, dur = 0.9, bright = 3000) {
        this.tone('triangle', f, t, dur, vol, dest, { filter: bright, verb: 0.35 });
        this.tone('square', f * 2, t, dur * 0.18, vol * 0.18, dest, { filter: bright * 1.4 });
    }

    // ------------------------------------------------------------------ music
    music(theme) {
        if (theme === this.theme) return;
        this.theme = theme;
        this.step = 0; this.bar = 0;
        if (this.ctx) { this.nextT = this.ctx.currentTime + 0.15; this.musicG.gain.setValueAtTime(0.0001, this.ctx.currentTime); this.musicG.gain.setTargetAtTime(this.vol.music * 0.55, this.ctx.currentTime + 0.1, 0.6); }
    }

    schedule() {
        const c = this.ctx;
        if (!c || !this.theme || c.state !== 'running') return;
        const S = SCALES[this.theme];
        if (!S) return;
        const beat = 60 / S.bpm / 2;   // eighth notes
        if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.05;
        while (this.nextT < c.currentTime + 0.35) {
            this.playStep(S, this.step, this.nextT, beat);
            this.step++;
            this.nextT += beat;
        }
    }

    playStep(S, step, t, beat) {
        const D = this.musicG;
        const per = S.beats * 2;
        const pos = step % per;
        const bar = Math.floor(step / per);
        const chord = S.prog[bar % S.prog.length];
        const root = S.root;
        const n = (k) => NOTE(root + k);
        const rnd = Math.random();
        switch (this.theme) {
            case 'town': case 'title': case 'victory': {
                // Lute waltz: bass on 1, arpeggio on the rest, a bell melody now and then.
                if (pos === 0) { this.tone('triangle', n(chord[0] - 12), t, beat * 5, 0.22, D, { filter: 900 }); if (bar % 2 === 0) this.pad(chord.map((x) => n(x)), t, beat * per, 0.05); }
                else this.pluck(n(chord[pos % 3] + (pos > 3 ? 12 : 0)), t, 0.09, D, 0.7);
                if (pos % 2 === 0 && rnd < 0.38) this.tone('sine', n(S.steps[Math.floor(Math.random() * S.steps.length)] + 24), t, 0.8, 0.05, D, { verb: 0.6 });
                if (this.theme === 'victory' && pos % 2 === 0) this.drum('hat', t, 0.05);
                break;
            }
            case 'cellar': {
                if (pos === 0) { this.pad(chord.map((x) => n(x - 12)), t, beat * per * 1.05, 0.07); this.tone('sine', n(chord[0] - 24), t, beat * per, 0.18, D, { a: 0.4 }); }
                if ((pos === 3 || pos === 6) && rnd < 0.7) this.pluck(n(chord[Math.floor(Math.random() * 3)] + 12), t, 0.07, D, 1.2, 1800);
                if (rnd < 0.06) this.tone('sine', n(S.steps[Math.floor(Math.random() * 7)] + 31), t, 0.4, 0.04, D, { verb: 0.9 });   // drips
                break;
            }
            case 'jam': {
                // Sneaky pizzicato bass and a muted pluck melody.
                if (pos % 2 === 0) this.tone('square', n(chord[(pos / 2) % 3] - 12), t, beat * 0.6, 0.07, D, { filter: 700 });
                if (pos === 0) this.pad(chord.map((x) => n(x)), t, beat * per, 0.04);
                if (pos % 2 === 1 && rnd < 0.5) this.pluck(n(chord[Math.floor(Math.random() * 3)] + 12), t, 0.06, D, 0.4, 2400);
                if (pos === 4) this.drum('snare', t, 0.04);
                break;
            }
            case 'core': {
                if (pos === 0) { this.pad(chord.map((x) => n(x - 12)), t, beat * per, 0.08); this.tone('sawtooth', n(chord[0] - 24), t, beat * per, 0.08, D, { filter: 300, a: 0.3 }); }
                if (pos === 0 || pos === 3 || pos === 6) this.drum('tom', t, 0.18);
                if (pos === 5 && rnd < 0.5) this.tone('triangle', n(chord[2] + 12), t, 1.2, 0.05, D, { verb: 0.8 });
                break;
            }
            case 'boss': {
                if (pos % 2 === 0) this.drum('kick', t, 0.3);
                if (pos === 2 || pos === 6) this.drum('snare', t, 0.16);
                this.drum('hat', t, 0.04);
                this.tone('sawtooth', n(chord[pos % 2 ? 0 : 0] - 12 + (pos === 7 ? 3 : 0)), t, beat * 0.8, 0.09, D, { filter: 900 });
                if (pos === 0) this.pad(chord.map((x) => n(x)), t, beat * per, 0.06);
                if (pos % 4 === 3) this.tone('square', n(chord[1] + 12), t, beat * 0.5, 0.04, D, { filter: 2400 });
                break;
            }
        }
    }

    pad(freqs, t, dur, vol) {
        for (const f of freqs) for (const det of [-7, 7]) this.tone('sawtooth', f, t, dur, vol * 0.5, this.musicG, { a: dur * 0.3, detune: det, filter: 1100, verb: 0.4 });
    }
    drum(kind, t, vol) {
        const D = this.musicG;
        if (kind === 'kick') { this.tone('sine', 150, t, 0.25, vol, D, { f2: 40 }); }
        else if (kind === 'snare') { this.noise(t, 0.14, vol, D, { type: 'bandpass', f: 1800, q: 0.8 }); this.tone('triangle', 220, t, 0.08, vol * 0.4, D, { f2: 160 }); }
        else if (kind === 'hat') this.noise(t, 0.04, vol, D, { type: 'highpass', f: 7000 });
        else if (kind === 'tom') this.tone('sine', 110, t, 0.4, vol, D, { f2: 60, verb: 0.3 });
    }

    // ------------------------------------------------------------------ sound effects
    sfx(name, o = {}) {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const now = c.currentTime;
        // Rate limit identical sounds (a Blender tick hitting 12 grapes shouldn't be 12 squishes).
        const gap = { squish: 0.035, hit: 0.03, sugar: 0.05, zap: 0.04, step: 0.05 }[name] || 0.015;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const D = this.sfxG, t = now + 0.005;
        const v = o.vol ?? 1;
        const p = o.pitch ?? 1;
        switch (name) {
            case 'swing': this.noise(t, 0.16, 0.22 * v, D, { type: 'bandpass', f: 900 * p, f2: 3200 * p, q: 1.5 }); break;
            case 'bigswing': this.noise(t, 0.28, 0.3 * v, D, { type: 'bandpass', f: 500, f2: 2600, q: 1.2 }); this.tone('sine', 140, t, 0.2, 0.12, D, { f2: 70 }); break;
            case 'squish': this.noise(t, 0.12, 0.35 * v, D, { type: 'lowpass', f: 1400 * p, f2: 200 }); this.tone('sine', 300 * p, t, 0.12, 0.18 * v, D, { f2: 90 }); break;
            case 'crit': this.tone('square', 900, t, 0.08, 0.08, D, { f2: 1800 }); this.tone('sine', 1800, t + 0.03, 0.2, 0.08, D, { verb: 0.4 }); break;
            case 'splat': this.noise(t, 0.3, 0.45 * v, D, { type: 'lowpass', f: 2200 * p, f2: 150 }); this.tone('sine', 200 * p, t, 0.25, 0.28 * v, D, { f2: 50 }); this.noise(t + 0.06, 0.2, 0.15, D, { type: 'bandpass', f: 3000, q: 2 }); break;
            case 'hurt': this.tone('square', 220, t, 0.12, 0.14 * v, D, { f2: 120, filter: 1200 }); this.noise(t, 0.08, 0.15, D, { f: 800 }); break;
            case 'oof': this.tone('sawtooth', 180, t, 0.18, 0.18, D, { f2: 90, filter: 900 }); break;
            case 'seed': this.tone('square', 700 * p, t, 0.05, 0.08, D, { f2: 300, filter: 2400 }); this.noise(t, 0.04, 0.08, D, { type: 'highpass', f: 2500 }); break;
            case 'pop': this.tone('sine', 500, t, 0.08, 0.2, D, { f2: 120 }); this.noise(t, 0.1, 0.2, D, { f: 1500 }); break;
            case 'zest': this.tone('sine', 1200, t, 0.15, 0.08, D, { f2: 2400, verb: 0.3 }); this.tone('triangle', 2400, t + 0.04, 0.1, 0.04, D); break;
            case 'fire': this.noise(t, 0.4, 0.28, D, { type: 'bandpass', f: 600, f2: 200, q: 0.7 }); this.tone('sawtooth', 120, t, 0.3, 0.06, D, { filter: 600 }); break;
            case 'freeze': for (let i = 0; i < 5; i++) this.tone('sine', 1800 + i * 400 + Math.random() * 200, t + i * 0.025, 0.4, 0.05, D, { verb: 0.6 }); this.noise(t, 0.35, 0.18, D, { type: 'highpass', f: 4000 }); break;
            case 'zap': this.tone('sawtooth', 160, t, 0.18, 0.12, D, { f2: 900, filter: 3000 }); this.noise(t, 0.16, 0.18, D, { type: 'bandpass', f: 3500, q: 3 }); break;
            case 'teleport': this.tone('sine', 400, t, 0.3, 0.12, D, { f2: 1600, verb: 0.5 }); this.tone('sine', 600, t + 0.05, 0.3, 0.08, D, { f2: 2400 }); break;
            case 'whistle': this.tone('sine', 2400, t, o.dur || 0.9, 0.08, D, { f2: 400 }); break;
            case 'boom': this.tone('sine', 120, t, 0.6, 0.5 * v, D, { f2: 30 }); this.noise(t, 0.7, 0.45 * v, D, { type: 'lowpass', f: 1800, f2: 80, verb: 0.4 }); break;
            case 'thud': this.tone('sine', 90, t, 0.3, 0.4, D, { f2: 40 }); this.noise(t, 0.2, 0.2, D, { f: 500 }); break;
            case 'buff': [0, 4, 7, 12].forEach((k, i) => this.tone('square', NOTE(62 + k), t + i * 0.05, 0.18, 0.06, D, { filter: 2400 })); break;
            case 'spin': this.noise(t, 0.6, 0.18, D, { type: 'bandpass', f: 500, f2: 1600, q: 2 }); break;
            case 'trap': this.tone('sine', 300, t, 0.15, 0.12, D, { f2: 900 }); this.tone('sine', 900, t + 0.12, 0.25, 0.1, D, { f2: 200 }); break;
            case 'rain': for (let i = 0; i < 14; i++) this.tone('sine', 900 + Math.random() * 600, t + Math.random() * 1.6, 0.05, 0.035, D); break;
            case 'sugar': this.tone('sine', 1500 + Math.random() * 300, t, 0.12, 0.08, D, { verb: 0.3 }); this.tone('sine', 2200, t + 0.05, 0.1, 0.05, D); break;
            case 'drop': this.tone('triangle', 520, t, 0.1, 0.1, D, { f2: 380 }); break;
            case 'raredrop': [0, 7, 12].forEach((k, i) => this.tone('sine', NOTE(76 + k), t + i * 0.06, 0.4, 0.07, D, { verb: 0.5 })); break;
            case 'legendary': [0, 4, 7, 11, 14].forEach((k, i) => { this.tone('sine', NOTE(72 + k), t + i * 0.07, 1.5, 0.08, D, { verb: 0.8 }); this.tone('triangle', NOTE(60 + k), t + i * 0.07, 1.2, 0.04, D); }); break;
            case 'pickup': this.tone('triangle', 660, t, 0.08, 0.1, D); this.tone('triangle', 990, t + 0.05, 0.1, 0.08, D); break;
            case 'gulp': for (let i = 0; i < 3; i++) this.tone('sine', 220 - i * 30, t + i * 0.11, 0.1, 0.18, D, { f2: 120 }); break;
            case 'levelup': [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => this.tone('square', NOTE(67 + k), t + i * 0.07, 0.3, 0.06, D, { filter: 3000, verb: 0.4 })); break;
            case 'chest': this.tone('sawtooth', 160, t, 0.25, 0.06, D, { f2: 260, filter: 800 }); [0, 4, 7].forEach((k, i) => this.tone('sine', NOTE(84 + k), t + 0.2 + i * 0.05, 0.3, 0.05, D, { verb: 0.5 })); break;
            case 'crate': this.noise(t, 0.18, 0.4, D, { type: 'bandpass', f: 700, q: 0.8 }); this.tone('square', 140, t, 0.08, 0.1, D, { f2: 70, filter: 600 }); break;
            case 'glass': for (let i = 0; i < 4; i++) this.tone('sine', 2500 + Math.random() * 1500, t + i * 0.02, 0.25, 0.05, D); this.noise(t, 0.2, 0.2, D, { type: 'highpass', f: 3000 }); break;
            case 'shrine': [0, 5, 9, 12].forEach((k, i) => this.tone('sine', NOTE(72 + k), t + i * 0.09, 0.7, 0.07, D, { verb: 0.7 })); break;
            case 'portal': this.tone('sine', 300, t, 0.8, 0.1, D, { f2: 900, verb: 0.7 }); this.noise(t, 0.8, 0.12, D, { type: 'bandpass', f: 800, f2: 3000, q: 4 }); break;
            case 'stairs': for (let i = 0; i < 4; i++) this.noise(t + i * 0.13, 0.06, 0.18, D, { f: 600 }); break;
            case 'click': this.tone('sine', 880, t, 0.05, 0.08, D); break;
            case 'nope': this.tone('square', 200, t, 0.1, 0.07, D, { filter: 900 }); this.tone('square', 150, t + 0.1, 0.12, 0.07, D, { filter: 900 }); break;
            case 'coins': for (let i = 0; i < 5; i++) this.tone('sine', 1400 + Math.random() * 900, t + i * 0.04, 0.1, 0.06, D); break;
            case 'roar': this.noise(t, 1.2, 0.5, D, { type: 'lowpass', f: 900, f2: 200, verb: 0.5 }); this.tone('sawtooth', 90, t, 1.0, 0.25, D, { f2: 55, filter: 500 }); break;
            case 'death': this.tone('sawtooth', 300, t, 0.35, 0.12, D, { f2: 250, filter: 1200 }); this.tone('sawtooth', 280, t + 0.38, 0.35, 0.12, D, { f2: 230, filter: 1200 }); this.tone('sawtooth', 260, t + 0.76, 0.9, 0.13, D, { f2: 160, filter: 1000 }); break;
            case 'victory': [0, 4, 7, 12, 7, 12, 16, 19].forEach((k, i) => this.tone('square', NOTE(64 + k), t + i * 0.12, 0.35, 0.07, D, { filter: 3200, verb: 0.4 })); break;
            case 'alert': this.tone('square', 600, t, 0.06, 0.04, D, { filter: 1800 }); break;
            case 'telegraph': this.tone('sine', 300, t, 0.5, 0.06, D, { f2: 600 }); break;
            case 'mimic': this.tone('sawtooth', 120, t, 0.3, 0.2, D, { f2: 60, filter: 700 }); this.noise(t, 0.2, 0.3, D, { f: 1000 }); break;
            case 'step': this.noise(t, 0.04, 0.05, D, { f: 500 + Math.random() * 300 }); break;
        }
    }

    /** Animal-Crossing-style gibberish for townsfolk lines. */
    speak(text, voice = 1) {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const t0 = c.currentTime + 0.02;
        const syl = Math.min(22, Math.ceil(text.length / 4));
        for (let i = 0; i < syl; i++) {
            const f = (220 + ((text.charCodeAt(i * 3 % text.length) * 7) % 180)) * voice;
            this.tone('square', f, t0 + i * 0.065, 0.05, 0.035, this.sfxG, { filter: 1800 });
        }
    }
}

export const audio = new AudioEngine();
