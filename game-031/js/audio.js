/**
 * Procedural sound. No audio files: every effect is a couple of
 * oscillators and a noise burst, shaped the way a PC speaker or an
 * AdLib card would have managed it.
 *
 * Browsers refuse to start audio before a user gesture, so the context is
 * created lazily on the first key press and everything before that is a
 * no-op rather than an error.
 */

export class Sound {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.drone = null;
        this.noiseBuffer = null;
    }

    /** Safe to call on every key press; only the first one does anything. */
    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try {
            this.ctx = new Ctx();
        } catch {
            return;
        }
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);

        // one second of white noise, reused by every noise-based effect
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    }

    get ready() { return this.ctx && this.master; }

    _tone({ type = 'square', from, to = from, dur = 0.15, gain = 0.2, delay = 0 }) {
        if (!this.ready) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t);
        if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    _noise({ dur = 0.12, gain = 0.2, from = 1200, to = 300, type = 'lowpass', delay = 0 }) {
        if (!this.ready) return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(from, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(g).connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.02);
    }

    _arpeggio(notes, { type = 'square', step = 0.08, dur = 0.12, gain = 0.16 } = {}) {
        notes.forEach((f, i) => this._tone({ type, from: f, dur, gain, delay: i * step }));
    }

    /** A low bed that makes the dungeon feel like it has air in it. */
    startDrone(depth = 1) {
        if (!this.ready || this.drone) return;
        const base = 55 * Math.pow(0.94, depth - 1);
        const gain = this.ctx.createGain();
        gain.gain.value = 0.05;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 220;
        const oscs = [0, 0.6].map((detune) => {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = base + detune;
            o.connect(filter);
            o.start();
            return o;
        });
        filter.connect(gain).connect(this.master);
        this.drone = { oscs, gain, filter };
    }

    setDroneDepth(depth) {
        if (!this.drone) return;
        const base = 55 * Math.pow(0.94, depth - 1);
        this.drone.oscs.forEach((o, i) => {
            o.frequency.setTargetAtTime(base + i * 0.6, this.ctx.currentTime, 0.4);
        });
    }

    play(name) {
        if (!this.ready || this.muted) return;
        switch (name) {
            case 'step': this._noise({ dur: 0.07, gain: 0.10, from: 800, to: 260 }); break;
            case 'bump':
                this._tone({ type: 'sine', from: 130, to: 55, dur: 0.14, gain: 0.22 });
                this._noise({ dur: 0.09, gain: 0.12, from: 500, to: 150 });
                break;
            case 'door':
                this._noise({ dur: 0.45, gain: 0.14, from: 320, to: 1500 });
                this._tone({ type: 'sawtooth', from: 92, to: 66, dur: 0.4, gain: 0.09 });
                break;
            case 'gate':
                this._tone({ type: 'square', from: 320, to: 180, dur: 0.3, gain: 0.14 });
                this._noise({ dur: 0.35, gain: 0.16, from: 2600, to: 700, type: 'bandpass' });
                break;
            case 'locked':
                this._tone({ type: 'square', from: 160, to: 130, dur: 0.09, gain: 0.16 });
                this._tone({ type: 'square', from: 150, to: 120, dur: 0.09, gain: 0.16, delay: 0.1 });
                break;
            case 'cast':
                this._tone({ type: 'sawtooth', from: 180, to: 900, dur: 0.2, gain: 0.16 });
                this._noise({ dur: 0.22, gain: 0.10, from: 400, to: 3000, type: 'bandpass' });
                break;
            case 'impact':
                this._noise({ dur: 0.28, gain: 0.26, from: 3000, to: 200 });
                this._tone({ type: 'square', from: 220, to: 60, dur: 0.2, gain: 0.14 });
                break;
            case 'swing': this._noise({ dur: 0.11, gain: 0.13, from: 2200, to: 500, type: 'bandpass' }); break;
            case 'enemyHit':
                this._tone({ type: 'square', from: 260, to: 110, dur: 0.11, gain: 0.18 });
                this._noise({ dur: 0.1, gain: 0.14, from: 1400, to: 300 });
                break;
            case 'enemyDie':
                this._tone({ type: 'sawtooth', from: 300, to: 55, dur: 0.4, gain: 0.18 });
                this._noise({ dur: 0.3, gain: 0.14, from: 900, to: 120 });
                break;
            case 'hurt':
                this._tone({ type: 'square', from: 320, to: 90, dur: 0.26, gain: 0.24 });
                this._noise({ dur: 0.16, gain: 0.18, from: 900, to: 200 });
                break;
            case 'pickup': this._arpeggio([660, 990], { step: 0.06, dur: 0.09, gain: 0.14 }); break;
            case 'gold': this._arpeggio([880, 1170, 1320], { type: 'triangle', step: 0.05, dur: 0.09, gain: 0.13 }); break;
            case 'levelUp': this._arpeggio([440, 554, 659, 880], { step: 0.09, dur: 0.16, gain: 0.16 }); break;
            case 'secret': this._arpeggio([523, 698, 880], { type: 'triangle', step: 0.11, dur: 0.24, gain: 0.13 }); break;
            case 'descend':
                this._tone({ type: 'sine', from: 330, to: 70, dur: 0.7, gain: 0.16 });
                this._noise({ dur: 0.6, gain: 0.10, from: 700, to: 120 });
                break;
            case 'death':
                this._tone({ type: 'sawtooth', from: 220, to: 40, dur: 1.4, gain: 0.24 });
                this._tone({ type: 'square', from: 110, to: 30, dur: 1.6, gain: 0.14, delay: 0.15 });
                break;
            case 'victory':
                this._arpeggio([523, 659, 784, 1046, 1318], { step: 0.14, dur: 0.3, gain: 0.18 });
                break;
        }
    }
}
