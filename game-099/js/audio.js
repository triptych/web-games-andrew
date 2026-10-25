// Procedural sound, all Web Audio, no files. Effects answer simulation events; a small
// look-ahead sequencer plays a different square-wave tune for each part of the console.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the
// tab is hidden.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Each tune: bpm and a list of [note, beats] with null for a rest. Looped.
const TUNES = {
    room: { bpm: 96, bass: [48, null, 55, null, 52, null, 55, null], lead: [[72, 1], [null, 1], [76, 1], [79, 1], [76, 2], [72, 1], [null, 1], [74, 1], [77, 1], [74, 2]] },
    play: { bpm: 132, bass: [45, 45, 52, 45, 43, 43, 50, 43], lead: [[69, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5], [69, 1], [67, 0.5], [71, 0.5], [74, 1], [72, 0.5], [71, 0.5], [67, 1]] },
    make: { bpm: 84, bass: [53, null, 60, null, 57, null, 60, null], lead: [[77, 2], [74, 1], [null, 1], [72, 2], [69, 1], [null, 1], [74, 2], [72, 1], [null, 1], [67, 3], [null, 1]] },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.tune = null;
        this.next = 0;
        this.step = 0;
        this.leadI = 0;
        this.leadAt = 0;
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
        this.timer = setInterval(() => this.pump(), 80);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.02);
    }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = 'sfx' } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this[bus]);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise(dur = 0.2, vol = 0.15, delay = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const n = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = buf; g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(this.ctx.currentTime + delay);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'place') this.tone({ freq: 520, to: 780, dur: 0.07, type: 'square', vol: 0.1 });
        else if (kind === 'erase') this.tone({ freq: 300, to: 120, dur: 0.1, type: 'sawtooth', vol: 0.1 });
    }

    boot() {
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'square', vol: 0.12, delay: i * 0.11 }));
        this.tone({ freq: 196, dur: 0.9, type: 'triangle', vol: 0.15, delay: 0.1 });
    }

    play(name) {
        switch (name) {
            case 'pew': this.tone({ freq: 900, to: 300, dur: 0.1, vol: 0.12 }); break;
            case 'hit': this.tone({ freq: 220, to: 90, dur: 0.1, type: 'square', vol: 0.16 }); this.noise(0.06, 0.08); break;
            case 'coin': this.tone({ freq: 988, dur: 0.06, vol: 0.12 }); this.tone({ freq: 1319, dur: 0.14, vol: 0.12, delay: 0.06 }); break;
            case 'boom': this.noise(0.45, 0.25); this.tone({ freq: 120, to: 40, dur: 0.4, type: 'sawtooth', vol: 0.2 }); break;
            case 'magic': this.tone({ freq: 600, to: 1500, dur: 0.18, type: 'triangle', vol: 0.14 }); this.tone({ freq: 900, to: 2000, dur: 0.14, type: 'sine', vol: 0.08, delay: 0.05 }); break;
            case 'roar': this.tone({ freq: 140, to: 60, dur: 0.4, type: 'sawtooth', vol: 0.2 }); this.noise(0.3, 0.1); break;
            case 'jump': this.tone({ freq: 330, to: 660, dur: 0.1, type: 'square', vol: 0.12 }); break;
            case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'square', vol: 0.14, delay: i * 0.1 })); break;
            case 'lose': [440, 392, 330, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.16, delay: i * 0.16 })); break;
            default: break;
        }
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sfx') this.play(e.name);
            else if (e.type === 'scene') this.tone({ freq: 300, to: 900, dur: 0.25, type: 'triangle', vol: 0.14 });
            else if (e.type === 'spawn') this.tone({ freq: 700, to: 500, dur: 0.05, type: 'square', vol: 0.05 });
        }
    }

    // ------------------------------------------------------------------ music

    setTune(name) {
        if (this.tuneName === name) return;
        this.tuneName = name;
        this.tune = TUNES[name] || null;
        this.step = 0; this.leadI = 0; this.leadAt = 0;
        if (this.ctx) this.next = this.ctx.currentTime + 0.1;
    }

    pump() {
        if (!this.ctx || this.ctx.state !== 'running' || !this.tune) return;
        const t = this.tune, beat = 60 / t.bpm;
        if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
        while (this.next < this.ctx.currentTime + 0.25) {
            // bass on every beat
            const bn = t.bass[this.step % t.bass.length];
            if (bn != null) this.tone({ freq: NOTE(bn), dur: beat * 0.9, type: 'triangle', vol: 0.5, delay: this.next - this.ctx.currentTime, bus: 'music' });
            // lead, as note lengths in beats
            if (this.step >= this.leadAt) {
                const [n, len] = t.lead[this.leadI % t.lead.length];
                if (n != null) this.tone({ freq: NOTE(n), dur: beat * len * 0.9, type: 'square', vol: 0.22, delay: this.next - this.ctx.currentTime, bus: 'music' });
                this.leadAt = this.step + Math.max(1, Math.round(len));
                this.leadI++;
            }
            this.step++;
            this.next += beat;
        }
    }
}
