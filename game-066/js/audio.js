// Procedural audio, all Web Audio, no files: a generative steampunk score (music-box waltzes,
// calliope and oom-pah polkas in town, marching routes, clanking dungeons, anvil-driven battles,
// a brass fanfare for every victory) and every sound effect. Must be unlocked by a user gesture
// (audio.init()). ../lib/page-audio.js silences hidden tabs.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const T = {
    title:    { root: 57, bpm: 76, beats: 3, style: 'musicbox', prog: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]] },
    home:     { root: 55, bpm: 96, beats: 3, style: 'waltz', prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [2, 5, 9], [7, 11, 14]] },
    house:    { root: 55, bpm: 84, beats: 3, style: 'musicbox', prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    station:  { root: 60, bpm: 80, beats: 4, style: 'musicbox', prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]] },
    shop:     { root: 62, bpm: 120, beats: 2, style: 'polka', prog: [[0, 4, 7], [7, 11, 14], [0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14], [5, 9, 12], [7, 11, 14]] },
    town:     { root: 58, bpm: 116, beats: 2, style: 'polka', prog: [[0, 4, 7], [0, 4, 7], [7, 11, 14], [7, 11, 14], [5, 9, 12], [0, 4, 7], [7, 11, 14], [0, 4, 7]] },
    route:    { root: 55, bpm: 112, beats: 4, style: 'march', prog: [[0, 4, 7], [-2, 2, 5], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]] },
    dungeon:  { root: 45, bpm: 70, beats: 4, style: 'clank', prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]] },
    leviathan:{ root: 41, bpm: 66, beats: 4, style: 'clank', prog: [[0, 3, 7], [1, 4, 8], [-1, 2, 6], [0, 3, 7]] },
    foundry:  { root: 50, bpm: 96, beats: 4, style: 'anvil', prog: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-4, 0, 3]] },
    arena:    { root: 55, bpm: 100, beats: 4, style: 'march', prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    titan:    { root: 40, bpm: 60, beats: 4, style: 'clank', prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-1, 3, 6]] },
    battle:   { root: 52, bpm: 150, beats: 4, style: 'battle', prog: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-4, 0, 3], [0, 3, 7], [1, 5, 8], [-2, 2, 5], [-1, 2, 7]] },
    trainer:  { root: 54, bpm: 158, beats: 4, style: 'battle', prog: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [3, 7, 10], [0, 3, 7], [5, 8, 12], [7, 11, 14], [7, 11, 14]] },
    leader:   { root: 50, bpm: 164, beats: 4, style: 'boss', prog: [[0, 3, 7], [0, 3, 7], [1, 5, 8], [1, 5, 8], [-2, 2, 5], [-2, 2, 5], [-1, 2, 7], [-1, 2, 7]] },
    elite:    { root: 49, bpm: 168, beats: 4, style: 'boss', prog: [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [-1, 2, 7]] },
    champion: { root: 52, bpm: 172, beats: 4, style: 'boss', prog: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 11, 14], [0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]] },
    victory:  { root: 60, bpm: 120, beats: 4, style: 'fanfare', prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    evolve:   { root: 60, bpm: 132, beats: 4, style: 'arp', prog: [[0, 4, 7], [2, 5, 9], [4, 7, 11], [5, 9, 12]] },
    ending:   { root: 55, bpm: 92, beats: 3, style: 'waltz', prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [-3, 0, 4], [5, 9, 12], [2, 5, 9], [7, 11, 14]] },
};

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.vol = { music: 0.55, sfx: 0.8, muted: false };
        this.theme = null;
        this.step = 0;
        this.nextT = 0;
        this.last = {};
    }
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain();
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
        this.master.connect(this.comp); this.comp.connect(c.destination);
        this.musicG = c.createGain(); this.musicG.connect(this.master);
        this.sfxG = c.createGain(); this.sfxG.connect(this.master);
        this.verb = c.createConvolver();
        const len = c.sampleRate * 2.4, buf = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb.buffer = buf;
        this.verbG = c.createGain(); this.verbG.gain.value = 0.3;
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
        this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.3);
        this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    }

    // ------------------------------------------------------------------ building blocks
    env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    tone(type, f, t, dur, vol, dest, { a = 0.005, f2 = null, detune = 0, filter = null, q = 1, verb = 0, trem = 0 } = {}) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
        if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        let node = o;
        if (filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = q; o.connect(fl); node = fl; }
        if (trem) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = trem; lg.gain.value = vol * 0.35; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + a + dur + 0.05); }
        node.connect(g); g.connect(dest);
        if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
        this.env(g, t, a, vol, dur);
        o.start(t); o.stop(t + a + dur + 0.05);
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
    bell(f, t, vol, dest, dur = 1.2) { this.tone('sine', f, t, dur, vol, dest, { verb: 0.5 }); this.tone('sine', f * 2.76, t, dur * 0.4, vol * 0.25, dest); this.tone('sine', f * 5.4, t, dur * 0.15, vol * 0.1, dest); }
    pluck(f, t, vol, dest, dur = 0.8, bright = 2600) { this.tone('triangle', f, t, dur, vol, dest, { filter: bright, verb: 0.3 }); this.tone('square', f * 2, t, dur * 0.16, vol * 0.16, dest, { filter: bright * 1.4 }); }
    reed(freqs, t, dur, vol) { for (const f of freqs) for (const det of [-9, 9]) this.tone('sawtooth', f, t, dur, vol * 0.4, this.musicG, { a: 0.03, detune: det, filter: 1600, trem: 6.5 }); }
    clang(t, vol, f = 420) { this.tone('square', f, t, 0.25, vol * 0.4, this.musicG, { filter: 3000 }); this.tone('sine', f * 2.31, t, 0.6, vol * 0.3, this.musicG, { verb: 0.5 }); this.noise(t, 0.08, vol * 0.5, this.musicG, { type: 'bandpass', f: 3200, q: 3 }); }
    drum(kind, t, vol) {
        const D = this.musicG;
        if (kind === 'kick') this.tone('sine', 140, t, 0.24, vol, D, { f2: 42 });
        else if (kind === 'snare') { this.noise(t, 0.14, vol, D, { type: 'bandpass', f: 1800, q: 0.8 }); this.tone('triangle', 220, t, 0.07, vol * 0.4, D, { f2: 160 }); }
        else if (kind === 'hat') this.noise(t, 0.04, vol, D, { type: 'highpass', f: 7000 });
        else if (kind === 'tom') this.tone('sine', 110, t, 0.35, vol, D, { f2: 60, verb: 0.3 });
        else if (kind === 'steam') this.noise(t, 0.3, vol, D, { type: 'highpass', f: 3000, f2: 6000 });
    }

    // ------------------------------------------------------------------ music
    music(theme) {
        if (theme === this.theme) return;
        this.theme = theme;
        this.step = 0;
        if (this.ctx) { this.nextT = this.ctx.currentTime + 0.12; this.musicG.gain.setValueAtTime(0.0001, this.ctx.currentTime); this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, this.ctx.currentTime + 0.08, 0.5); }
    }
    schedule() {
        const c = this.ctx;
        if (!c || !this.theme || c.state !== 'running') return;
        const S = T[this.theme];
        if (!S) return;
        const beat = 60 / S.bpm / 2;
        if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.05;
        while (this.nextT < c.currentTime + 0.35) { this.playStep(S, this.step, this.nextT, beat); this.step++; this.nextT += beat; }
    }
    playStep(S, step, t, beat) {
        const D = this.musicG;
        const per = S.beats * 2, pos = step % per, bar = Math.floor(step / per);
        const ch = S.prog[bar % S.prog.length];
        const n = (k) => NOTE(S.root + k);
        const r = Math.random();
        const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
        switch (S.style) {
            case 'musicbox':
                if (pos % 2 === 0) this.bell(n(ch[(pos / 2) % 3] + 12), t, 0.06, D, 1.4);
                if (pos === 0) this.tone('triangle', n(ch[0] - 12), t, beat * per, 0.12, D, { filter: 700 });
                if (r < 0.3) this.bell(n(scale[Math.floor(Math.random() * scale.length)] + 24), t + beat * 0.5, 0.025, D, 0.8);
                break;
            case 'waltz':
                if (pos === 0) this.tone('triangle', n(ch[0] - 12), t, beat * 1.6, 0.2, D, { filter: 900 });
                else if (pos === 2 || pos === 4) this.reed(ch.map((x) => n(x)), t, beat * 1.2, 0.05);
                if (pos % 2 === 1 && r < 0.55) this.pluck(n(ch[Math.floor(Math.random() * 3)] + 12), t, 0.06, D, 0.5);
                if (pos === 0 && bar % 2 === 1) this.bell(n(ch[2] + 24), t, 0.04, D, 1.6);
                break;
            case 'polka':
                if (pos % 2 === 0) this.tone('sine', n(ch[pos % 4 === 0 ? 0 : 2] - 12), t, beat * 0.8, 0.22, D, { filter: 600 });
                else this.reed(ch.map((x) => n(x)), t, beat * 0.5, 0.045);
                if (r < 0.45) this.pluck(n(ch[Math.floor(Math.random() * 3)] + 12 + (r < 0.1 ? 12 : 0)), t, 0.05, D, 0.35, 3200);
                if (pos === 0) this.drum('kick', t, 0.12);
                if (pos === 2) this.drum('snare', t, 0.05);
                break;
            case 'march':
                if (pos % 2 === 0) this.tone('triangle', n(ch[0] - 12 + (pos === 4 ? 7 : 0)), t, beat * 0.9, 0.18, D, { filter: 900 });
                if (pos === 0) this.reed(ch.map((x) => n(x)), t, beat * 3, 0.035);
                if (pos % 2 === 1 || r < 0.3) this.pluck(n(ch[pos % 3] + 12), t, 0.055, D, 0.4);
                this.drum(pos % 4 === 2 ? 'snare' : 'hat', t, pos % 4 === 2 ? 0.06 : 0.025);
                if (pos === 0) this.drum('kick', t, 0.14);
                break;
            case 'clank':
                if (pos === 0) { for (const x of ch) this.tone('sawtooth', n(x - 12), t, beat * per, 0.03, D, { a: 0.6, filter: 500 }); this.tone('sine', n(ch[0] - 24), t, beat * per, 0.16, D, { a: 0.4 }); }
                if (r < 0.14) this.clang(t, 0.12, 200 + Math.random() * 500);
                if (r > 0.92) this.drum('steam', t, 0.05);
                if (pos === 4 && r < 0.5) this.bell(n(ch[2] + 12), t, 0.04, D, 2);
                break;
            case 'anvil':
                if (pos === 0 || pos === 3 || pos === 6) this.clang(t, pos === 0 ? 0.2 : 0.12, 380);
                if (pos % 2 === 0) this.tone('sawtooth', n(ch[0] - 12), t, beat * 0.9, 0.08, D, { filter: 700 });
                if (pos === 0) this.reed(ch.map((x) => n(x)), t, beat * per, 0.03);
                if (pos === 4) this.drum('steam', t, 0.06);
                break;
            case 'battle': case 'boss': {
                const hard = S.style === 'boss';
                if (pos % 2 === 0 || (hard && pos === 7)) this.drum('kick', t, 0.24);
                if (pos === 2 || pos === 6) this.drum('snare', t, 0.12);
                this.drum('hat', t, pos % 2 ? 0.03 : 0.05);
                this.tone('sawtooth', n(ch[0] - 12 + (pos === 7 ? 3 : pos === 5 ? 2 : 0)), t, beat * 0.8, 0.08, D, { filter: hard ? 1200 : 900 });
                if (pos === 0) this.reed(ch.map((x) => n(x)), t, beat * per, hard ? 0.05 : 0.035);
                if (pos % 4 === 3) this.tone('square', n(ch[(bar + pos) % 3] + 12), t, beat * 0.6, 0.035, D, { filter: 2600 });
                if (pos === 0 && hard) this.clang(t, 0.12, 300);
                if ((pos === 1 || pos === 5) && r < 0.5) this.pluck(n(ch[2] + 12), t, 0.05, D, 0.25, 3600);
                break;
            }
            case 'fanfare':
                if (pos % 2 === 0) { this.tone('square', n(ch[(pos / 2) % 3] + 12), t, beat * 1.4, 0.05, D, { filter: 3000, verb: 0.3 }); this.tone('sawtooth', n(ch[0] - 12), t, beat * 1.4, 0.06, D, { filter: 800 }); }
                if (pos === 0) this.drum('kick', t, 0.15);
                this.drum('hat', t, 0.03);
                break;
            case 'arp':
                this.bell(n(ch[pos % 3] + 12 + Math.floor(pos / 3) * 12), t, 0.05, D, 0.5);
                if (pos === 0) this.reed(ch.map((x) => n(x)), t, beat * per, 0.03);
                break;
        }
    }

    // ------------------------------------------------------------------ sound effects
    sfx(name, o = {}) {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const now = c.currentTime;
        const gap = { step: 0.08, blip: 0.03, hit: 0.03, bump: 0.2 }[name] || 0.012;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const D = this.sfxG, t = now + 0.005;
        const v = o.vol ?? 1;
        switch (name) {
            case 'step': this.noise(t, 0.05, 0.05 * v, D, { f: 400 + Math.random() * 300 }); break;
            case 'bump': this.tone('sine', 110, t, 0.12, 0.2, D, { f2: 70 }); break;
            case 'blip': this.tone('square', 1200, t, 0.03, 0.04, D, { filter: 3000 }); break;
            case 'select': this.tone('square', 880, t, 0.05, 0.05, D, { filter: 2400 }); this.tone('square', 1320, t + 0.04, 0.06, 0.04, D, { filter: 2400 }); break;
            case 'back': this.tone('square', 660, t, 0.05, 0.05, D, { filter: 2000 }); this.tone('square', 440, t + 0.04, 0.06, 0.04, D, { filter: 2000 }); break;
            case 'door': this.noise(t, 0.25, 0.15, D, { f: 600, f2: 200 }); this.tone('sine', 220, t + 0.15, 0.2, 0.12, D, { f2: 140 }); break;
            case 'ledge': this.tone('sine', 300, t, 0.15, 0.12, D, { f2: 600 }); this.noise(t + 0.25, 0.1, 0.12, D, { f: 500 }); break;
            case 'encounter': for (let i = 0; i < 3; i++) this.tone('square', 990 - i * 120, t + i * 0.08, 0.07, 0.07, D, { filter: 3000 }); this.noise(t, 0.4, 0.12, D, { type: 'highpass', f: 3000, f2: 6000 }); break;
            case 'spotted': this.tone('square', 1400, t, 0.08, 0.08, D, { filter: 3000 }); this.tone('square', 1900, t + 0.08, 0.14, 0.08, D, { filter: 3000 }); break;
            case 'hit': this.noise(t, 0.12, 0.35 * v, D, { f: 1600, f2: 300 }); this.tone('square', 180, t, 0.1, 0.12 * v, D, { f2: 90, filter: 1200 }); break;
            case 'superhit': this.noise(t, 0.25, 0.45, D, { f: 3000, f2: 200 }); this.tone('sawtooth', 220, t, 0.25, 0.18, D, { f2: 60, filter: 1600 }); this.clang(t, 0.2, 600); break;
            case 'weakhit': this.noise(t, 0.08, 0.2, D, { f: 900, f2: 300 }); break;
            case 'crit': this.tone('square', 1200, t, 0.06, 0.06, D, { f2: 2400 }); break;
            case 'miss': this.noise(t, 0.2, 0.12, D, { type: 'bandpass', f: 1200, f2: 3000, q: 1.5 }); break;
            case 'steam': this.noise(t, 0.5, 0.25, D, { type: 'highpass', f: 2500, f2: 6000 }); break;
            case 'fire': this.noise(t, 0.45, 0.3, D, { type: 'bandpass', f: 600, f2: 200, q: 0.7 }); this.tone('sawtooth', 110, t, 0.3, 0.06, D, { filter: 600 }); break;
            case 'water': for (let i = 0; i < 6; i++) this.tone('sine', 500 + Math.random() * 700, t + i * 0.03, 0.08, 0.05, D, { f2: 900 }); this.noise(t, 0.3, 0.18, D, { f: 1200 }); break;
            case 'ice': for (let i = 0; i < 5; i++) this.tone('sine', 1900 + i * 380, t + i * 0.025, 0.4, 0.04, D, { verb: 0.6 }); break;
            case 'zap': this.tone('sawtooth', 140, t, 0.2, 0.12, D, { f2: 1000, filter: 3200 }); this.noise(t, 0.18, 0.2, D, { type: 'bandpass', f: 3500, q: 3 }); break;
            case 'grind': this.noise(t, 0.35, 0.25, D, { type: 'bandpass', f: 400, f2: 900, q: 2 }); this.tone('sawtooth', 70, t, 0.3, 0.1, D, { filter: 400 }); break;
            case 'wind': this.noise(t, 0.5, 0.2, D, { type: 'bandpass', f: 500, f2: 2200, q: 2 }); break;
            case 'clang': this.clangS(t); break;
            case 'gear': for (let i = 0; i < 6; i++) this.tone('square', 300 + i * 40, t + i * 0.035, 0.03, 0.05, D, { filter: 2000 }); break;
            case 'acid': for (let i = 0; i < 5; i++) this.tone('sine', 200 + Math.random() * 300, t + i * 0.05, 0.1, 0.07, D, { f2: 600 }); break;
            case 'leaf': this.noise(t, 0.3, 0.15, D, { type: 'highpass', f: 2000, f2: 5000 }); break;
            case 'punch': this.tone('sine', 120, t, 0.18, 0.4, D, { f2: 40 }); this.noise(t, 0.08, 0.3, D, { f: 1200 }); break;
            case 'signal': this.tone('sine', 900, t, 0.3, 0.08, D, { f2: 1800 }); this.tone('sine', 1350, t + 0.05, 0.25, 0.05, D, { f2: 2700 }); break;
            case 'rust': this.noise(t, 0.4, 0.18, D, { type: 'bandpass', f: 300, f2: 120, q: 3 }); this.tone('sawtooth', 90, t, 0.4, 0.05, D, { f2: 60, filter: 400 }); break;
            case 'void': this.tone('sine', 80, t, 0.6, 0.25, D, { f2: 40 }); this.tone('sine', 400, t, 0.5, 0.05, D, { f2: 100, verb: 0.8 }); break;
            case 'faint': this.tone('sawtooth', 400, t, 0.8, 0.12, D, { f2: 40, filter: 1200 }); this.noise(t + 0.2, 0.6, 0.2, D, { f: 800, f2: 100 }); for (let i = 0; i < 6; i++) this.tone('square', 600 + Math.random() * 1200, t + 0.3 + i * 0.07, 0.03, 0.04, D); break;
            case 'send': this.tone('sine', 400, t, 0.3, 0.12, D, { f2: 1200, verb: 0.5 }); this.noise(t, 0.3, 0.12, D, { type: 'bandpass', f: 2000, f2: 600, q: 3 }); break;
            case 'throw': this.noise(t, 0.3, 0.18, D, { type: 'bandpass', f: 800, f2: 3000, q: 2 }); break;
            case 'shake': this.tone('square', 260, t, 0.05, 0.08, D, { filter: 1200 }); this.tone('square', 200, t + 0.06, 0.05, 0.06, D, { filter: 1200 }); break;
            case 'caught': [0, 4, 7, 12].forEach((k, i) => this.tone('square', NOTE(72 + k), t + i * 0.08, 0.25, 0.06, D, { filter: 3000, verb: 0.3 })); break;
            case 'breakout': this.noise(t, 0.2, 0.3, D, { f: 3000, f2: 400 }); this.tone('square', 600, t, 0.1, 0.06, D, { f2: 200 }); break;
            case 'stat': this.tone('sine', o.up ? 500 : 900, t, 0.3, 0.08, D, { f2: o.up ? 1200 : 300 }); break;
            case 'status': this.tone('square', 300, t, 0.2, 0.06, D, { f2: 200, filter: 1000 }); break;
            case 'heal': [0, 4, 7, 12, 16].forEach((k, i) => this.tone('sine', NOTE(72 + k), t + i * 0.09, 0.5, 0.06, D, { verb: 0.6 })); break;
            case 'levelup': [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => this.tone('square', NOTE(67 + k), t + i * 0.06, 0.25, 0.05, D, { filter: 3000, verb: 0.4 })); break;
            case 'item': [0, 7, 12, 16].forEach((k, i) => this.tone('triangle', NOTE(74 + k), t + i * 0.07, 0.3, 0.08, D, { verb: 0.4 })); break;
            case 'learn': [0, 5, 9, 12].forEach((k, i) => this.tone('sine', NOTE(76 + k), t + i * 0.06, 0.3, 0.06, D, { verb: 0.4 })); break;
            case 'craft': this.clangS(t); this.clangS(t + 0.18); this.tone('sine', 1200, t + 0.36, 0.3, 0.05, D, { verb: 0.5 }); break;
            case 'build': for (let i = 0; i < 4; i++) this.clangS(t + i * 0.14); [0, 4, 7, 12].forEach((k, i) => this.tone('square', NOTE(67 + k), t + 0.6 + i * 0.07, 0.2, 0.05, D, { filter: 3000 })); break;
            case 'weld': this.noise(t, 0.35, 0.3, D, { type: 'highpass', f: 2500 }); this.tone('sine', 1800, t, 0.3, 0.05, D, { verb: 0.3 }); break;
            case 'coins': for (let i = 0; i < 4; i++) this.tone('sine', 1400 + Math.random() * 900, t + i * 0.04, 0.1, 0.06, D); break;
            case 'nope': this.tone('square', 200, t, 0.1, 0.06, D, { filter: 900 }); this.tone('square', 150, t + 0.1, 0.12, 0.06, D, { filter: 900 }); break;
            case 'evostart': for (let i = 0; i < 12; i++) this.tone('sine', 300 + i * 80, t + i * 0.12, 0.2, 0.04, D, { verb: 0.6 }); break;
            case 'evolved': [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((k, i) => this.tone('square', NOTE(64 + k), t + i * 0.09, 0.3, 0.05, D, { filter: 3200, verb: 0.4 })); break;
            case 'tool': this.noise(t, 0.4, 0.3, D, { type: 'bandpass', f: 2500, q: 2 }); this.clangS(t + 0.3); break;
            case 'skiff': this.noise(t, 0.6, 0.12, D, { type: 'bandpass', f: 300, f2: 900, q: 2 }); break;
            case 'seal': [0, 4, 7, 12, 16].forEach((k, i) => { this.tone('square', NOTE(67 + k), t + i * 0.12, 0.5, 0.06, D, { filter: 3000, verb: 0.4 }); this.tone('sawtooth', NOTE(55 + k), t + i * 0.12, 0.5, 0.04, D, { filter: 1200 }); }); break;
            case 'save': this.tone('sine', 880, t, 0.1, 0.06, D); this.tone('sine', 1320, t + 0.1, 0.2, 0.06, D, { verb: 0.4 }); break;
            case 'dig': for (let i = 0; i < 3; i++) this.noise(t + i * 0.12, 0.1, 0.2, D, { f: 900 }); this.tone('sine', 1500, t + 0.4, 0.2, 0.05, D, { verb: 0.4 }); break;
        }
    }
    clangS(t) { const D = this.sfxG; this.tone('square', 520, t, 0.2, 0.06, D, { filter: 3000 }); this.tone('sine', 1200, t, 0.5, 0.05, D, { verb: 0.5 }); this.noise(t, 0.06, 0.2, D, { type: 'bandpass', f: 3200, q: 3 }); }

    /** Gibberish voices for dialogue. */
    speak(text, voice = 1) {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const t0 = c.currentTime + 0.02;
        const syl = Math.min(20, Math.ceil(text.length / 5));
        for (let i = 0; i < syl; i++) {
            const f = (200 + ((text.charCodeAt((i * 3) % text.length) * 7) % 160)) * voice;
            this.tone('square', f, t0 + i * 0.07, 0.05, 0.025, this.sfxG, { filter: 1600 });
        }
    }
}

export const audio = new AudioEngine();
