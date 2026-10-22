// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a
// look-ahead synthwave sequencer (kick, snare, hats, a sawtooth bass and an arpeggio), with a
// key and progression per sector. The context is made on the first user gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

const SONGS = [
    { root: 45, prog: [0, -4, 3, -2], bpm: 104 },     // A minor: i VI III VII
    { root: 42, prog: [0, 3, -4, -2], bpm: 96 },      // F# minor, slower and dreamier
    { root: 40, prog: [0, -2, -4, -5], bpm: 112 },    // E minor, a descending casino march
];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.song = 0;
        this.muted = false;          // the title's attract mode plays silently
        this.playing = false;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a short noise buffer for drums, static and explosions
        const len = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let x = 12345;
        for (let i = 0; i < len; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = (x / 0x3fffffff) - 1; }
        // a slapback delay that gives the synths their 80s space
        this.delay = ctx.createDelay(1);
        this.delay.delayTime.value = 0.28;
        const fb = ctx.createGain(); fb.gain.value = 0.3;
        const wet = ctx.createGain(); wet.gain.value = 0.35;
        this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.music);
        this.step = 0;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 50);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    setSong(i) { this.song = Math.max(0, Math.min(SONGS.length - 1, i)); }
    setPlaying(on) { this.playing = on; }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, at, out } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = at ?? this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise({ dur = 0.2, vol = 0.2, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, at, to, out } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = at ?? this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out || this.sfx);
        s.start(t, (t * 7.31) % 0.5); s.stop(t + dur + 0.02);
    }

    // ------------------------------------------------------------------ music
    schedule() {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const S = SONGS[this.song];
        const sp = 60 / S.bpm / 4;                       // a 16th note
        while (this.nextT < this.ctx.currentTime + 0.15) {
            if (this.playing && this.musicVol > 0.001) this.playStep(this.step, this.nextT, S, sp);
            this.step = (this.step + 1) % 64;
            this.nextT += sp;
        }
    }

    playStep(i, t, S, sp) {
        const out = this.music;
        const bar = Math.floor(i / 16), s = i % 16;
        const root = S.root + S.prog[bar % 4];
        if (s % 4 === 0) this.tone({ freq: 150, to: 40, dur: 0.22, type: 'sine', vol: 0.5, at: t, out });
        if (s === 4 || s === 12) this.noise({ dur: 0.16, vol: 0.18, freq: 1800, q: 0.6, at: t, out });
        if (s % 2 === 1) this.noise({ dur: 0.04, vol: 0.05, freq: 8000, type: 'highpass', at: t, out });
        // bass: eighth-note pulse on the chord root
        if (s % 2 === 0) this.tone({ freq: midi(root - 12), dur: sp * 1.8, type: 'sawtooth', vol: 0.09, at: t, out });
        // arpeggio up and down the minor chord, through the delay
        const arp = [0, 3, 7, 12, 15, 12, 7, 3];
        const n = root + 12 + arp[s % 8];
        this.tone({ freq: midi(n), dur: sp * 0.9, type: 'square', vol: 0.025, at: t, out: this.delay });
        this.tone({ freq: midi(n), dur: sp * 0.9, type: 'triangle', vol: 0.03, at: t, out });
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'select') this.tone({ freq: 1320, dur: 0.04, type: 'sine', vol: 0.08 });
        else if (kind === 'deny') this.tone({ freq: 160, dur: 0.12, type: 'square', vol: 0.08 });
    }

    onEvent(e) {
        if (this.muted || !this.ctx) return;
        switch (e.type) {
            case 'spin':
                this.noise({ dur: 0.12, vol: 0.3, freq: 300, type: 'lowpass' });
                this.tone({ freq: 90, to: 50, dur: 0.15, type: 'square', vol: 0.15 });
                // clicks while the drums turn, then one clunk per reel as it lands
                for (let k = 0; k < 14; k++) this.tone({ freq: 2400, dur: 0.015, type: 'square', vol: 0.03, delay: 0.08 + k * 0.05 });
                e.stops.forEach((_, i) => {
                    this.tone({ freq: 220, to: 120, dur: 0.08, type: 'square', vol: 0.12, delay: 0.5 + i * 0.22 });
                    this.noise({ dur: 0.05, vol: 0.12, freq: 900, delay: 0.5 + i * 0.22 });
                });
                break;
            case 'nudge':
                this.tone({ freq: e.dir > 0 ? 660 : 520, to: e.dir > 0 ? 990 : 380, dur: 0.08, type: 'square', vol: 0.08 });
                break;
            case 'respin':
                for (let k = 0; k < 6; k++) this.tone({ freq: 2000, dur: 0.015, type: 'square', vol: 0.03, delay: k * 0.05 });
                this.tone({ freq: 240, to: 130, dur: 0.08, type: 'square', vol: 0.12, delay: 0.38 });
                break;
            case 'fire':
                this.tone({ freq: 440, to: 1760, dur: 0.18, type: 'sawtooth', vol: 0.1 });
                if (e.top >= 3) [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.1, delay: 0.1 + i * 0.07 }));
                else if (e.top === 2) [659, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'square', vol: 0.08, delay: 0.08 + i * 0.07 }));
                break;
            case 'hit':
                if (e.kind === 'blade') { this.tone({ freq: 1800, to: 300, dur: 0.14, type: 'sawtooth', vol: 0.13 }); this.noise({ dur: 0.1, vol: 0.15, freq: 3000 }); }
                else if (e.kind === 'comet') { this.noise({ dur: 0.4, vol: 0.25, freq: 2000, to: 200, type: 'lowpass' }); this.tone({ freq: 120, to: 40, dur: 0.3, type: 'sine', vol: 0.3 }); }
                else this.noise({ dur: 0.25, vol: 0.1, freq: 5000, type: 'highpass' });
                break;
            case 'edie':
                this.noise({ dur: 0.7, vol: 0.35, freq: 1500, to: 80, type: 'lowpass' });
                this.tone({ freq: 300, to: 30, dur: 0.6, type: 'sawtooth', vol: 0.15 });
                break;
            case 'burn':
                this.tone({ freq: 300, to: 600, dur: 0.2, type: 'triangle', vol: 0.1 });
                break;
            case 'pblock':
                this.tone({ freq: 520, dur: 0.18, type: 'triangle', vol: 0.12 });
                this.tone({ freq: 780, dur: 0.18, type: 'triangle', vol: 0.08, delay: 0.03 });
                break;
            case 'pheal':
                [784, 988, 1175].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'sine', vol: 0.08, delay: i * 0.05 }));
                break;
            case 'charge':
                this.tone({ freq: 200, to: 1200, dur: 0.25, type: 'square', vol: 0.06 });
                break;
            case 'eact':
                if (e.k === 'atk') this.tone({ freq: 900, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.12 });
                else if (e.k === 'block') this.tone({ freq: 300, dur: 0.15, type: 'triangle', vol: 0.1 });
                else if (e.k === 'buff') this.tone({ freq: 200, to: 400, dur: 0.3, type: 'sawtooth', vol: 0.08 });
                break;
            case 'phit':
                if (e.dmg > 0) { this.tone({ freq: 140, to: 50, dur: 0.25, type: 'square', vol: 0.25 }); this.noise({ dur: 0.2, vol: 0.25, freq: 600, type: 'lowpass' }); }
                else this.tone({ freq: 700, dur: 0.08, type: 'triangle', vol: 0.12 });
                break;
            case 'jam':
                this.noise({ dur: 0.35, vol: 0.2, freq: 2500, q: 2 });
                break;
            case 'eheal':
                this.tone({ freq: 400, to: 800, dur: 0.3, type: 'sine', vol: 0.08 });
                break;
            case 'win':
                [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'square', vol: 0.1, delay: i * 0.1 }));
                break;
            case 'light':
                [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'sine', vol: 0.08, delay: i * 0.06 }));
                break;
            case 'pick': case 'purge':
                this.tone({ freq: 660, to: 1320, dur: 0.15, type: 'triangle', vol: 0.12 });
                break;
            case 'rest':
                [523, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.08, delay: i * 0.12 }));
                break;
            case 'over':
                if (e.won) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'square', vol: 0.1, delay: i * 0.14 }));
                else [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.15, delay: i * 0.2 }));
                break;
        }
    }
}
