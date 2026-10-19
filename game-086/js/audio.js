/**
 * audio.js — soft synthesized sounds (Web Audio, no files). Starts on the first gesture.
 * Correct pixels pluck a pentatonic note that climbs with the run; plucks are rate-limited
 * so a long drag stays a gentle ripple, not a buzz.
 */
const PENTA = [0, 2, 4, 7, 9];

export class Sound {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.lastPluck = 0;
        this.step = 0;
    }

    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.5;
            this.master.connect(this.ctx.destination);
        } catch { this.ctx = null; }
    }

    tone(freq, { at = 0, dur = 0.35, type = 'sine', vol = 0.18, attack = 0.005, bend = 0 } = {}) {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime + at;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    note(step, octave = 0) {
        const n = PENTA[((step % 5) + 5) % 5] + 12 * (Math.floor(step / 5) + octave);
        return 392 * 2 ** (n / 12);
    }

    pluck(streak = 0) {
        const now = performance.now();
        if (now - this.lastPluck < 55) return;
        this.lastPluck = now;
        this.step = (this.step + 1) % 10;
        const f = this.note(this.step + Math.min(10, Math.floor(streak / 25)));
        this.tone(f, { dur: 0.28, type: 'triangle', vol: 0.11 });
        this.tone(f * 2, { dur: 0.12, vol: 0.03 });
    }

    oops() { this.tone(180, { dur: 0.16, type: 'sine', vol: 0.09, bend: 0.8 }); }

    click() { this.tone(660, { dur: 0.06, type: 'sine', vol: 0.05 }); }

    pour() { [0, 2, 4].forEach((s, k) => this.tone(this.note(s, 1), { at: k * 0.05, dur: 0.3, type: 'triangle', vol: 0.09 })); }

    colorDone() { [0, 2, 4, 7].forEach((s, k) => this.tone(this.note(s, 1), { at: k * 0.07, dur: 0.45, type: 'triangle', vol: 0.09 })); }

    burst() {
        this.tone(220, { dur: 0.5, type: 'sine', vol: 0.12, bend: 3 });
        [0, 4, 7].forEach((s, k) => this.tone(this.note(s, 1), { at: 0.08 + k * 0.04, dur: 0.5, type: 'triangle', vol: 0.07 }));
    }

    complete() {
        [0, 2, 4, 5, 7, 9, 10].forEach((s, k) => this.tone(this.note(s, 0), { at: k * 0.09, dur: 0.9, type: 'triangle', vol: 0.1 }));
        [0, 4, 7].forEach((s) => this.tone(this.note(s, -1), { at: 0.7, dur: 1.8, type: 'sine', vol: 0.08, attack: 0.08 }));
    }

    buy() { [0, 4, 7, 9].forEach((s, k) => this.tone(this.note(s, 1), { at: k * 0.06, dur: 0.6, type: 'sine', vol: 0.1 })); }

    page() { this.tone(520, { dur: 0.09, type: 'triangle', vol: 0.04 }); }
}
