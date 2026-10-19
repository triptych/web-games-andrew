// Soft procedural sound, all Web Audio, no files: a plucked lute for the guild, quill scratches for typing,
// thuds for duels. The context starts on the first gesture; ../lib/page-audio.js silences a hidden tab.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export class Sound {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.typing = true;
        this.lastScratch = 0;
    }

    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -16; comp.ratio.value = 3;
            comp.connect(this.ctx.destination);
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.55;
            this.master.connect(comp);
            // a short noise buffer, reused for scratches and page turns
            const len = Math.floor(this.ctx.sampleRate * 0.5);
            this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = this.noise.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch { this.ctx = null; }
    }

    get live() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

    /** A plucked string: a triangle and a sine an octave up, fast attack, long soft decay. */
    pluck(freq, { at = 0, dur = 0.9, vol = 0.16 } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + at;
        for (const [mult, type, v] of [[1, 'triangle', vol], [2, 'sine', vol * 0.35], [3, 'sine', vol * 0.12]]) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq * mult, t);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult);
            o.connect(g).connect(this.master);
            o.start(t); o.stop(t + dur + 0.05);
        }
    }

    noiseHit({ at = 0, dur = 0.06, vol = 0.05, freq = 2400, q = 1.2, type = 'bandpass', sweep = 0 } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + at;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.master);
        src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
    }

    note(i, base = 293.66) { return base * 2 ** (PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length] / 12) * 2 ** Math.floor(i / PENTA.length); }

    click() { this.pluck(this.note(4), { dur: 0.35, vol: 0.08 }); }
    blip() { this.pluck(this.note(2, 587), { dur: 0.18, vol: 0.035 }); }
    page() { this.noiseHit({ dur: 0.22, vol: 0.06, freq: 1800, sweep: 0.4, q: 0.6 }); }
    scratch() {
        if (!this.typing || !this.live) return;
        const now = this.ctx.currentTime;
        if (now - this.lastScratch < 0.05) return;
        this.lastScratch = now;
        this.noiseHit({ dur: 0.035 + Math.random() * 0.03, vol: 0.022, freq: 3200 + Math.random() * 2400, q: 2.5 });
    }
    xp() { this.pluck(this.note(5), { vol: 0.08, dur: 0.5 }); this.pluck(this.note(7), { at: 0.07, vol: 0.07, dur: 0.6 }); }
    unlockDoor() { [0, 2, 4, 7].forEach((k, i) => this.pluck(this.note(k, 196), { at: i * 0.09, vol: 0.11 })); }
    level() { [0, 2, 4, 5, 7].forEach((k, i) => this.pluck(this.note(k), { at: i * 0.08, vol: 0.12, dur: 1.2 })); this.pluck(this.note(9), { at: 0.45, vol: 0.12, dur: 1.6 }); }
    fanfare() {
        [[0, 0], [4, 0.12], [7, 0.24], [9, 0.36], [7, 0.6], [9, 0.72], [11, 0.86]].forEach(([k, t]) => this.pluck(this.note(k, 220), { at: t, vol: 0.13, dur: 1.4 }));
    }
    hit() { this.noiseHit({ dur: 0.08, vol: 0.06, freq: 500, q: 0.8, type: 'lowpass' }); }
    heal() { this.pluck(110, { vol: 0.06, dur: 0.6 }); }
    win() { this.fanfare(); }
    lose() { [7, 5, 4, 0].forEach((k, i) => this.pluck(this.note(k, 196), { at: i * 0.16, vol: 0.1, dur: 1 })); }
}
