// Procedural sound, all Web Audio, no files: a cold drone with wind, a slow minor figure on a
// music-box tone, bells, and a heartbeat that quickens with dread. Effects answer sim events.
// ../lib/page-audio.js suspends the context while the tab is hidden.

const SCALE = [220, 261.63, 293.66, 329.63, 349.23, 415.3, 440, 523.25]; // A harmonic minor

export class Audio {
    constructor() { this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.5; this.dread = 0; this.step = 0; this.next = 0; this.beat = 0; this.timer = null; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // wind: low-passed noise that breathes
        const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = buf.getChannelData(0);
        let a = 12345; for (let i = 0; i < data.length; i++) { a = (a * 1664525 + 1013904223) | 0; data[i] = (a / 2147483648); }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        const g = ctx.createGain(); g.gain.value = 0.05;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
        src.connect(f); f.connect(g); g.connect(this.music); src.start();
        // a drone: two low sines a fifth apart
        for (const fr of [55, 82.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(this.music); o.start(); }
        this.next = ctx.currentTime + 0.5;
        this.timer = setInterval(() => this.schedule(), 200);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }
    setDread(v) { this.dread = v; }

    tone({ freq = 440, to = freq, dur = 0.2, type = 'sine', vol = 0.15, delay = 0, bus = 'sfx' } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this[bus]); o.start(t); o.stop(t + dur + 0.05);
    }

    /** A slow music-box figure, sparser and lower as dread rises; a heartbeat under high dread. */
    schedule() {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        while (this.next < now + 0.6) {
            const pat = [0, 2, 4, 2, 3, 1, 4, 6];
            const n = pat[this.step % pat.length];
            if (this.step % 2 === 0 || this.dread < 40) this.tone({ freq: SCALE[n] / (this.dread > 60 ? 2 : 1), dur: 1.4, type: 'triangle', vol: 0.05, delay: this.next - now, bus: 'music' });
            this.step++;
            this.next += 1.1 - Math.min(0.3, this.dread / 300);
        }
        if (this.dread > 55 && now > this.beat) {
            this.tone({ freq: 60, to: 40, dur: 0.18, vol: 0.22 }); this.tone({ freq: 55, to: 38, dur: 0.18, vol: 0.16, delay: 0.2 });
            this.beat = now + 1.1 - this.dread / 140;
        }
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 520, dur: 0.05, type: 'triangle', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 330, to: 440, dur: 0.1, type: 'triangle', vol: 0.1 });
        else if (kind === 'step') this.tone({ freq: 90, to: 60, dur: 0.06, vol: 0.06 });
    }

    bell(n = 1) { for (let i = 0; i < n; i++) { this.tone({ freq: 196, dur: 3, vol: 0.2, delay: i * 1.4 }); this.tone({ freq: 392 * 1.01, dur: 2.2, vol: 0.08, delay: i * 1.4 }); this.tone({ freq: 590, dur: 1.4, vol: 0.05, delay: i * 1.4 }); } }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'room') this.ui('step');
            else if (e.type === 'score') this.tone({ freq: 660, to: 990, dur: 0.18, vol: 0.1 });
            else if (e.type === 'dead') { this.tone({ freq: 220, to: 55, dur: 1.6, type: 'sawtooth', vol: 0.2 }); this.bell(1); }
            else if (e.type === 'end') this.bell(3);
            else if (e.type === 'sfx') {
                switch (e.name) {
                    case 'spell': this.tone({ freq: 440, to: 880, dur: 0.5, vol: 0.12 }); this.tone({ freq: 660, to: 1320, dur: 0.5, vol: 0.08, delay: 0.08 }); break;
                    case 'veil': this.tone({ freq: 800, to: 200, dur: 0.8, type: 'triangle', vol: 0.1 }); break;
                    case 'level': [392, 494, 587, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.6, vol: 0.1, delay: i * 0.1 })); break;
                    case 'clue': this.tone({ freq: 880, dur: 0.3, vol: 0.08 }); this.tone({ freq: 1175, dur: 0.4, vol: 0.06, delay: 0.1 }); break;
                    case 'brew': this.tone({ freq: 200, to: 320, dur: 0.6, type: 'sawtooth', vol: 0.05 }); break;
                    case 'patrol': this.tone({ freq: 70, to: 55, dur: 0.25, vol: 0.2 }); this.tone({ freq: 66, to: 50, dur: 0.25, vol: 0.2, delay: 0.35 }); break;
                    case 'hit': this.tone({ freq: 300, to: 80, dur: 0.4, type: 'sawtooth', vol: 0.14 }); break;
                    case 'bell': this.bell(2); break;
                    case 'stone': this.tone({ freq: 110, to: 440, dur: 1.5, type: 'sawtooth', vol: 0.14 }); this.bell(2); break;
                    case 'rest': this.tone({ freq: 330, dur: 1.2, vol: 0.06 }); break;
                    case 'death': break;
                    default:
                }
            } else if (e.type === 'dread') this.setDread(e.value);
        }
    }
}
