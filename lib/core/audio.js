// lib/core/audio.js — the Web Audio plumbing every procedural-sound game rebuilds: a context made
// on the first gesture, a compressor, sfx and music buses, a reverb send, a cached noise buffer,
// an enveloped tone, a filtered noise hit, a per-sound throttle and a look-ahead step sequencer.
// Games keep their own sounds by extending it:
//
//   import { AudioCore, mtof } from '../lib/core/audio.js';
//   export class Audio extends AudioCore {
//       onEvents(G, events) { for (const e of events) if (e.type === 'pickup') this.tone({ freq: 880, to: 1320 }); }
//   }
//   const audio = new Audio();
//   for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.init(), { capture: true });
//
// Fixes collected here that live in only one or two of the 98 audio.js copies (game-100):
// a silent sample to start the clock on Safari, a looping silent <audio> so iOS plays Web Audio with
// the ringer switch on silent, and resuming an 'interrupted' context after a phone call.
// ../page-audio.js still suspends everything while the tab is hidden; load it in <head> as usual.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

export class AudioCore {
    /**
     * @param {object} [o]
     * @param {number} [o.sfx]      starting effects volume 0..1
     * @param {number} [o.music]    starting music volume 0..1
     * @param {number} [o.reverb]   reverb send level (0 = no reverb bus)
     * @param {boolean} [o.iosUnlock] loop a silent <audio> so iOS's silent switch doesn't mute the game
     */
    constructor({ sfx = 0.8, music = 0.6, reverb = 0.25, iosUnlock = true } = {}) {
        this.ctx = null;
        this.sfxVol = sfx;
        this.musicVol = music;
        this.reverbLevel = reverb;
        this.iosUnlock = iosUnlock;
        this.muted = false;
        this._last = {};
        this.media = null;
    }

    get running() { return !!this.ctx && this.ctx.state === 'running'; }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }

    /** Call from a user gesture. Safe to call on every gesture: later calls only resume. */
    init() {
        if (this.ctx) {
            if (this.ctx.state !== 'running') this.ctx.resume?.();
            if (this.iosUnlock && !this.media) this.unlockMedia();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        let ctx;
        try { ctx = this.ctx = new AC(); } catch { return; }
        const comp = this.comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
        if (this.reverbLevel > 0) {
            this.verbIn = ctx.createGain(); this.verbIn.gain.value = this.reverbLevel;
            this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(1.8, 2.8);
            this.verbIn.connect(this.verb); this.verb.connect(this.master);
        }
        this.noiseBuf = this.makeNoise(1.5);
        ctx.addEventListener?.('statechange', () => { if (ctx.state === 'interrupted') ctx.resume?.(); });
        this.wake();
        if (this.iosUnlock) this.unlockMedia();
        this.onInit?.(ctx);
    }

    /** One silent sample: some browsers only start the clock once something plays in a gesture. */
    wake() {
        try {
            const b = this.ctx.createBuffer(1, 1, 22050), src = this.ctx.createBufferSource();
            src.buffer = b; src.connect(this.ctx.destination); src.start(0);
        } catch { /* nothing to unlock yet */ }
    }

    /** iOS mutes Web Audio on the silent switch unless a media element is playing: loop a silent one. */
    unlockMedia() {
        if (this.media || typeof document === 'undefined') return;
        try {
            if (navigator.audioSession) navigator.audioSession.type = 'playback';
            const a = document.createElement('audio');
            a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01; a.src = SILENT_WAV;
            const p = a.play();
            if (p && p.catch) p.catch(() => { this.media = null; });
            this.media = a;
        } catch { this.media = null; }
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    setMuted(m) {
        this.muted = !!m;
        if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }

    /** A decaying stereo noise impulse for a ConvolverNode. */
    impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        }
        return b;
    }

    makeNoise(sec) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    /** True at most once per `gap` seconds for `key`: stops 40 pickups in a frame from clipping. */
    free(key, gap = 0.05) {
        const t = this.now;
        if (t - (this._last[key] ?? -9) < gap) return false;
        this._last[key] = t;
        return true;
    }

    /** One enveloped oscillator: a blip, a sweep or a thud. `at` is an absolute context time (for sequencers). */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, att = 0.01, send = 0, bus = null, at = null } = {}) {
        if (!this.running) return;
        const ctx = this.ctx, t = at ?? ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + att);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx);
        if (send && this.verbIn) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.02);
    }

    /** Filtered noise: hats, snares, whooshes, hits, rain. */
    noiseHit({ dur = 0.1, vol = 0.2, hp, lp, bp, q = 1, delay = 0, send = 0, rate = 1, bus = null, at = null } = {}) {
        if (!this.running) return;
        const ctx = this.ctx, t = at ?? ctx.currentTime + delay;
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = this.noiseBuf; src.playbackRate.value = rate;
        let node = src;
        const f = (type, freq) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = freq; x.Q.value = q; node.connect(x); node = x; };
        if (hp) f('highpass', hp);
        if (lp) f('lowpass', lp);
        if (bp) f('bandpass', bp);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        node.connect(g); g.connect(bus || this.sfx);
        if (send && this.verbIn) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbIn); }
        src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.02);
    }

    /** A pitch-dropping sine thump (a kick drum, a landing). */
    thump({ freq = 150, to = 45, dur = 0.25, vol = 0.5, delay = 0, bus = null, at = null } = {}) {
        this.tone({ freq, to, dur, type: 'sine', vol, delay, att: 0.003, bus, at });
    }

    /** A rising or falling arpeggio of MIDI notes. */
    arp(notes, { step = 0.08, dur = 0.18, type = 'triangle', vol = 0.15, delay = 0 } = {}) {
        notes.forEach((n, i) => this.tone({ freq: mtof(n), dur, type, vol, delay: delay + i * step }));
    }
}

/**
 * A look-ahead step sequencer on the audio clock (the pattern 51 games hand-write as
 * setInterval(schedule, 25)). Each step is scheduled ~0.1 s early at its exact time, so timing holds
 * even when the main thread stalls. `onStep(n, t)` plays step n at context time t.
 *
 *   const seq = new Sequencer(audio, { bpm: 112, stepsPerBeat: 4, onStep: (n, t) => n % 4 || audio.thump({ at: t, bus: audio.music }) });
 *   seq.start();
 */
export class Sequencer {
    constructor(core, { bpm = 120, stepsPerBeat = 4, ahead = 0.12, interval = 25, onStep } = {}) {
        this.core = core;
        this.bpm = bpm;
        this.stepsPerBeat = stepsPerBeat;
        this.ahead = ahead;
        this.interval = interval;
        this.onStep = onStep;
        this.timer = null;
        this.step = 0;
        this.nextTime = 0;
    }
    get stepDur() { return 60 / this.bpm / this.stepsPerBeat; }
    get playing() { return this.timer !== null; }
    start() {
        if (this.timer !== null || !this.core.ctx) return;
        this.nextTime = this.core.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.tick(), this.interval);
    }
    stop() { clearInterval(this.timer); this.timer = null; }
    tick() {
        const ctx = this.core.ctx;
        if (!ctx || ctx.state !== 'running') { if (ctx) this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.05); return; }
        // after a long stall don't fire a burst of stale steps: skip to now
        if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.05;
        while (this.nextTime < ctx.currentTime + this.ahead) {
            this.onStep?.(this.step, this.nextTime);
            this.step++;
            this.nextTime += this.stepDur;
        }
    }
}
