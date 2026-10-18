// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a small
// look-ahead sequencer playing a travelling tune whose scale changes with the region.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the tab is hidden.

const SCALES = [
    [0, 2, 4, 7, 9],          // Meadowmere: major pentatonic
    [0, 1, 4, 5, 7, 8, 10],   // the Wastes: phrygian dominant
    [0, 2, 3, 7, 9],          // Mirewood: a minor pentatonic with a raised sixth
    [0, 2, 3, 5, 7, 10],      // Frostfang: dorian-ish
    [0, 1, 3, 5, 6, 8, 10],   // Emberreach: locrian
    [0, 2, 4, 6, 7, 11],      // Starhaven: lydian
];
const ROOT = [57, 55, 52, 50, 53, 59];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.region = 0;
        this.night = false;
        this.nextNote = 0;
        this.beat = 0;
        this.timer = null;
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(comp);
        // a soft room for the plucks
        const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb = ctx.createConvolver(); this.verb.buffer = buf;
        const wet = ctx.createGain(); wet.gain.value = 0.25;
        this.verb.connect(wet); wet.connect(this.music);
        this.nextNote = ctx.currentTime + 0.3;
        this.timer = setInterval(() => this.schedule(), 120);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.05);
    }

    setScene(region, night) { this.region = region; this.night = night; }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, out = null } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise(dur = 0.1, vol = 0.15, freq = 1200, delay = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t);
    }

    /** A plucked string: a short triangle with a quick decay, into the room. */
    pluck(midi, t, vol = 0.12, dur = 0.6) {
        const ctx = this.ctx;
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(this.music); g.connect(this.verb);
        o.start(t); o.stop(t + dur + 0.05);
    }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || this.musicVol <= 0) { if (ctx) this.nextNote = Math.max(this.nextNote, ctx.currentTime + 0.1); return; }
        const beat = this.night ? 0.42 : 0.32;
        while (this.nextNote < ctx.currentTime + 0.5) {
            const t = this.nextNote, b = this.beat++;
            const sc = SCALES[this.region], root = ROOT[this.region];
            const bar = Math.floor(b / 8) % 4;
            const chord = [0, 3, 4, 2][bar];
            if (b % 8 === 0) this.pluck(root - 12 + sc[chord % sc.length], t, 0.1, 1.6);
            if (b % 4 === 2) this.pluck(root - 5 + sc[(chord + 2) % sc.length], t, 0.05, 0.8);
            // a wandering tune, seeded by the beat so it repeats every few bars
            const h = Math.sin(b * 12.9898 + this.region * 78.233) * 43758.5453;
            const r = h - Math.floor(h);
            if (r < (this.night ? 0.35 : 0.6)) {
                const deg = (chord + Math.floor(r * 10)) % (sc.length * 2);
                this.pluck(root + 12 * Math.floor(deg / sc.length) + sc[deg % sc.length], t, 0.07, 0.5);
            }
            this.nextNote += beat;
        }
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 700, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'coin') { this.tone({ freq: 1320, dur: 0.06, type: 'square', vol: 0.06 }); this.tone({ freq: 1760, dur: 0.12, type: 'square', vol: 0.06, delay: 0.06 }); }
        else if (kind === 'deny') this.tone({ freq: 200, to: 150, dur: 0.15, type: 'sawtooth', vol: 0.08 });
    }

    onEvents(G, events, showFights = true) {
        for (const e of events) {
            switch (e.type) {
                case 'battle':
                    if (!showFights && !e.warden) break;
                    e.hits.slice(0, 14).forEach((h, i) => {
                        const d = 0.7 + i * Math.max(0.12, (e.dur * 0.95 - 1.6) / Math.max(1, e.hits.length));
                        if (h.heal) this.tone({ freq: 660, to: 990, dur: 0.15, type: 'sine', vol: 0.08, delay: d });
                        else { this.noise(0.07, 0.16, h.a === 'p' ? 1800 : 700, d); this.tone({ freq: h.a === 'p' ? 300 : 160, to: 90, dur: 0.1, type: 'square', vol: 0.06, delay: d }); }
                    });
                    if (e.won) [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.12, delay: e.dur * 0.95 - 0.9 + i * 0.09 }));
                    else if (e.lost) [392, 330, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.08, delay: e.dur * 0.95 - 0.9 + i * 0.16 }));
                    break;
                case 'arrive': [784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.1, delay: i * 0.22 })); break;
                case 'depart': this.noise(0.2, 0.06, 300); break;
                case 'trade': this.ui('coin'); break;
                case 'rally': this.tone({ freq: 220, to: 440, dur: 0.2, type: 'sawtooth', vol: 0.08 }); this.noise(0.12, 0.1, 2500, 0.05); break;
                case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
                case 'rareLoot': [880, 1109, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.1, delay: i * 0.1 })); break;
                case 'quest': [659, 784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.1 })); break;
                case 'warden': if (e.won) [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.14, delay: 1 + i * 0.15 })); break;
                case 'recruit': this.tone({ freq: 523, to: 784, dur: 0.25, type: 'triangle', vol: 0.1 }); break;
                case 'craft': this.tone({ freq: e.cls === 'smith' ? 1200 : 600, to: e.cls === 'smith' ? 800 : 900, dur: 0.08, type: 'square', vol: 0.04 }); break;
                case 'event': if (e.kind === 'cache') this.ui('coin'); else if (e.kind === 'wheel') this.noise(0.25, 0.12, 400); break;
                case 'sparkle': [1568, 2093].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.05, delay: i * 0.07 })); break;
                case 'sparkleGot': [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.09, delay: i * 0.05 })); break;
                case 'upgrade': this.tone({ freq: 440, to: 880, dur: 0.2, type: 'square', vol: 0.06 }); break;
            }
        }
    }
}
