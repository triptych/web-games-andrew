// The lab's sound: a hum of old machinery, interface blips, VESTA's voice, the restoration fanfare,
// and the bus the cartridges play their own effects and music through. All Web Audio, no files.
// ../lib/page-audio.js suspends everything while the tab is hidden.

import { V } from './runtime/index.js';

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.synth = V.makeSynth(null);
        this.humOn = false;
        this.nextBleep = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(comp);
        this.cart = ctx.createGain(); this.cart.gain.value = 1; this.cart.connect(this.sfx);
        this.synth = V.makeSynth(ctx, this.cart);
        this.startHum();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
        this.music.gain.setTargetAtTime(music, this.ctx.currentTime, 0.03);
    }

    /** The lab: two detuned drones under a slowly breathing filter. */
    startHum() {
        const ctx = this.ctx;
        this.hum = ctx.createGain();
        this.hum.gain.value = 0;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 6;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.07; lg.gain.value = 160;
        lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
        for (const [f, type, v] of [[55, 'sawtooth', 0.05], [55.4, 'sawtooth', 0.05], [82.4, 'triangle', 0.07], [110.2, 'sine', 0.04]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type; o.frequency.value = f; g.gain.value = v;
            o.connect(g); g.connect(lp); o.start();
        }
        lp.connect(this.hum);
        this.hum.connect(this.music);
        this.setHum(true);
    }
    setHum(on, level = 1) {
        this.humOn = on;
        if (!this.hum) return;
        this.hum.gain.setTargetAtTime(on ? 0.5 * level : 0, this.ctx.currentTime, 0.6);
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 1320, to: 990, dur: 0.04, type: 'square', vol: 0.05 });
        else if (kind === 'tab') this.tone({ freq: 880, to: 1175, dur: 0.05, type: 'triangle', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 330, to: 660, dur: 0.12, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 660, to: 330, dur: 0.1, type: 'triangle', vol: 0.08 });
        else if (kind === 'pix') this.tone({ freq: 1800 + Math.random() * 400, dur: 0.02, type: 'square', vol: 0.02 });
        else if (kind === 'tick') [784, 1175].forEach((f, i) => this.tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.12, delay: i * 0.07 }));
        else if (kind === 'error') this.tone({ freq: 140, to: 90, dur: 0.25, type: 'sawtooth', vol: 0.12 });
        else if (kind === 'insert') {
            this.tone({ freq: 90, to: 60, dur: 0.18, type: 'square', vol: 0.15 });
            this.tone({ freq: 2400, to: 1800, dur: 0.03, type: 'square', vol: 0.05, delay: 0.17 });
        } else if (kind === 'boot') {
            this.tone({ freq: 60, to: 2200, dur: 0.6, type: 'sine', vol: 0.08 });
            [523, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.06, delay: 0.55 + i * 0.09 }));
        }
    }

    /** VESTA speaks in little square-wave syllables; everyone else in softer clicks. */
    voice(who, ch) {
        if (!this.ctx || !/[A-Za-z0-9]/.test(ch)) return;
        const code = ch.toUpperCase().charCodeAt(0);
        if (who === 'vesta') this.tone({ freq: 300 + (code % 7) * 60, dur: 0.035, type: 'square', vol: 0.035 });
        else if (who === 'audit') this.tone({ freq: 140 + (code % 3) * 10, dur: 0.04, type: 'sine', vol: 0.05 });
        else if (who !== 'sys') this.tone({ freq: 520 + (code % 5) * 40, dur: 0.02, type: 'triangle', vol: 0.03 });
    }

    fanfare() {
        const notes = [523, 659, 784, 1047, 784, 1047, 1319];
        notes.forEach((f, i) => this.tone({ freq: f, dur: i === notes.length - 1 ? 0.7 : 0.14, type: 'square', vol: 0.1, delay: i * 0.11 }));
        [262, 330, 392].forEach((f, i) => this.tone({ freq: f, dur: 1.0, type: 'triangle', vol: 0.12, delay: 0.66 + i * 0.01 }));
    }

    /** Occasional computer bleeps in the lab. */
    tick(time, inLab) {
        if (!this.ctx || !inLab || time < this.nextBleep) return;
        this.nextBleep = time + 5 + Math.random() * 9;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone({ freq: 1200 + Math.random() * 1600, dur: 0.05, type: 'sine', vol: 0.015, delay: i * 0.08, bus: this.music });
    }

    /** Effects and music a running cartridge asked for. */
    onCartEvents(cart, events) {
        for (const e of events) {
            if (e.type === 'sfx') this.synth.sfx(cart.sounds[e.n]);
            else if (e.type === 'music') { if (e.on) this.synth.startMusic(cart.music); else this.synth.stopMusic(); }
            else if (e.type === 'win') { this.synth.stopMusic(); this.synth.sfx(V.SFX_PRESETS.win); }
            else if (e.type === 'lose') { this.synth.stopMusic(); this.synth.sfx(V.SFX_PRESETS.lose); }
            else if (e.type === 'error') this.ui('error');
        }
    }
}
