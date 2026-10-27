// Procedural sound, all Web Audio, no files. Effects answer simulation events.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.
//
// The music is a slow synthwave loop: a saw bass and a triangle arpeggio in A minor, scheduled a
// little ahead of the clock so a slow frame never makes it stutter.

const BASS = [55, 55, 43.65, 49];                       // A1 A1 F1 G1, one per bar
const ARP = [[220, 261.63, 329.63, 440], [220, 261.63, 349.23, 440], [196, 246.94, 293.66, 392]];
const SEQ = [0, 0, 1, 2];                               // which chord each bar plays

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.noise = null;
        this.lastHit = 0;
        this.nextNote = 0;
        this.beat = 0;
        this.timer = 0;
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // one second of noise, reused for every crunch and boom
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) | 0; d[i] = (s >>> 8) / 8388608 - 1; }
        this.noise = buf;
        this.nextNote = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 90);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    get live() { return this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = this.sfx, filter = 0 } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let out = g;
        if (filter) {
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass'; f.frequency.value = filter;
            g.connect(f); out = f;
        }
        o.connect(g); out.connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    }

    /** A burst of filtered noise: a crack, a crunch or the body of an explosion. */
    burst({ dur = 0.2, vol = 0.25, from = 3000, to = 300, delay = 0 } = {}) {
        if (!this.live || !this.noise) return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        src.buffer = this.noise;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(from, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, 0, dur + 0.05);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
    }

    schedule() {
        if (!this.live || this.musicVol <= 0) { if (this.ctx) this.nextNote = Math.max(this.nextNote, this.ctx.currentTime); return; }
        const step = 0.25;                                   // an eighth note at 120 bpm
        while (this.nextNote < this.ctx.currentTime + 0.3) {
            const bar = Math.floor(this.beat / 8) % 4, i = this.beat % 8, t = this.nextNote - this.ctx.currentTime;
            if (i % 2 === 0) this.tone({ freq: BASS[bar], dur: 0.22, type: 'sawtooth', vol: 0.22, delay: t, bus: this.music, filter: 420 });
            const chord = ARP[SEQ[bar]];
            this.tone({ freq: chord[[0, 1, 2, 3, 2, 1, 3, 2][i]] * 2, dur: 0.16, type: 'triangle', vol: 0.07, delay: t, bus: this.music });
            this.beat++;
            this.nextNote += step;
        }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'launch':
                    this.tone({ freq: 180, to: 900, dur: 0.22, type: 'sawtooth', vol: 0.16, filter: 2500 });
                    this.burst({ dur: 0.18, vol: 0.12, from: 5000, to: 800 });
                    break;
                case 'hit': {
                    const now = this.ctx?.currentTime ?? 0;
                    if (now - this.lastHit < 0.05) break;
                    this.lastHit = now;
                    const v = Math.min(0.3, 0.06 + e.power * 0.006);
                    if (e.mat === 'glass') this.tone({ freq: 1800, to: 1200, dur: 0.1, type: 'triangle', vol: v });
                    else this.tone({ freq: 160 + e.power * 2, to: 70, dur: 0.12, type: 'square', vol: v, filter: 900 });
                    break;
                }
                case 'break':
                    if (e.mat === 'glass') {
                        this.burst({ dur: 0.25, vol: 0.18, from: 9000, to: 2500 });
                        this.tone({ freq: 2400, to: 900, dur: 0.18, type: 'triangle', vol: 0.1 });
                    } else this.burst({ dur: 0.3, vol: 0.28, from: 2600, to: 200 });
                    break;
                case 'robot':
                    [740, 520, 330].forEach((f, i) => this.tone({ freq: f, to: f * 0.7, dur: 0.1, type: 'square', vol: 0.13, delay: i * 0.08 }));
                    break;
                case 'boom':
                    this.burst({ dur: 0.7, vol: 0.45, from: 2200, to: 70 });
                    this.tone({ freq: 120, to: 35, dur: 0.6, type: 'sawtooth', vol: 0.3, filter: 500 });
                    break;
                case 'split': [500, 650, 800].forEach((f, i) => this.tone({ freq: f, to: f * 1.5, dur: 0.12, type: 'triangle', vol: 0.14, delay: i * 0.03 })); break;
                case 'boost': this.tone({ freq: 300, to: 1400, dur: 0.3, type: 'sawtooth', vol: 0.14, filter: 3000 }); break;
                case 'slam': this.tone({ freq: 900, to: 90, dur: 0.25, type: 'square', vol: 0.15 }); break;
                case 'ready': this.tone({ freq: 523, to: 784, dur: 0.1, type: 'triangle', vol: 0.1 }); break;
                case 'over':
                    if (e.won) [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.18, delay: i * 0.12 }));
                    else [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.14, delay: i * 0.16, filter: 1200 }));
                    break;
                default:
            }
        }
    }
}
