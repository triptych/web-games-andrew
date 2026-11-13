// Sound. The music, the effects and the voices were generated with ElevenLabs (audio/, see dev/audio/README.md).
// Music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js still silences a hidden
// tab; effects are decoded into buffers. A small Web Audio synth stands in for anything that fails to load.

import { MUSIC, SFX } from './sim/data/media.js';
import { VOICED } from './voices.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// synth stand-ins: tempo and chord roots (midi, minor flag)
const THEMES = {
    title: { bpm: 72, prog: [[60, 0], [57, 1], [53, 0], [55, 0]] }, hall: { bpm: 96, prog: [[62, 0], [67, 0], [64, 1], [69, 0]] },
    tavern: { bpm: 120, prog: [[62, 0], [67, 0], [69, 0], [62, 0]] }, tender: { bpm: 62, prog: [[65, 0], [62, 1], [58, 0], [60, 0]] },
    tense: { bpm: 88, prog: [[52, 1], [53, 0], [52, 1], [50, 1]] }, gloam: { bpm: 56, prog: [[45, 1], [46, 0], [45, 1], [43, 0]] },
    sad: { bpm: 60, prog: [[57, 1], [53, 0], [55, 0], [52, 1]] }, triumph: { bpm: 100, prog: [[60, 0], [65, 0], [67, 0], [60, 0]] },
};
const ARP = [0, 2, 4, 7, 4, 2], MAJOR = [0, 4, 7, 12, 16, 19, 24, 28], MINOR = [0, 3, 7, 12, 15, 19, 24, 27];
const TONES = { stamp: [140, 70, 0.12, 'square'], coin: [1300, 1900, 0.12, 'triangle'], bell: [1500, 1480, 0.6, 'sine'], page: [700, 500, 0.05, 'triangle'],
    rankup: [520, 1040, 0.4, 'triangle'], fail: [330, 150, 0.4, 'sawtooth'], win: [660, 990, 0.25, 'triangle'], fizz: [300, 80, 0.3, 'sawtooth'] };

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.75, music: 0.5, voice: 0.95 };
        this.want = null; this.current = null;
        this.tracks = {}; this.buffers = {};
        this.synthOnly = false; this.theme = null;
        this.voiceEl = null; this.voiceKey = null;
        this.played = {};                  // a count of every effect asked for, for the tests
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        this.sfxBus = ctx.createGain(); this.sfxBus.connect(comp);
        this.musicBus = ctx.createGain(); this.musicBus.connect(comp);
        this.voiceBus = ctx.createGain(); this.voiceBus.connect(comp);
        this.setVolumes(this.vol);
        this.voiceEl = new window.Audio();
        this.voiceEl.preload = 'auto';
        try { ctx.createMediaElementSource(this.voiceEl).connect(this.voiceBus); } catch { /* element volume instead */ }
        this.voiceEl.addEventListener('error', () => { this.voiceKey = null; });
        this.voiceEl.addEventListener('ended', () => { this.voiceKey = null; });
        for (const n in SFX) this._loadSfx(n);
        this.timer = setInterval(() => this._schedule(), 70);
        if (this.want !== null) { const w = this.want; this.want = null; this.current = null; this.play(w); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }
    get speaking() { return !!this.voiceKey && this.voiceEl && !this.voiceEl.paused; }
    get playing() { const el = this.tracks[this.current]; return !!el && !el.paused; }

    setVolumes({ sfx = this.vol.sfx, music = this.vol.music, voice = this.vol.voice } = {}) {
        this.vol = { sfx, music, voice };
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfxBus.gain.setTargetAtTime(sfx, t, 0.02);
        this.musicBus.gain.setTargetAtTime(music * 0.7, t, 0.05);
        this.voiceBus.gain.setTargetAtTime(voice, t, 0.02);
    }

    // ------------------------------------------------------------ music
    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music/${name}.mp3`);
        el.loop = true; el.preload = 'auto';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already routed */ }
        g.connect(this.musicBus);
        el._gain = g;
        el.addEventListener('error', () => {
            if (this.synthOnly) return;
            this.synthOnly = true;
            const w = this.current; this.current = null; this.play(w);
        });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the music (null for silence), crossfading. */
    play(name) {
        if (name && !MUSIC[name]) return;
        this.want = name;
        if (!this.ctx || this.current === name) return;
        this.current = name;
        const t = this.ctx.currentTime;
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.cancelScheduledValues(t);
            el._gain.gain.setTargetAtTime(0, t, 0.45);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 2200);
        }
        this.theme = null;
        if (!name) return;
        if (!this.synthOnly) {
            const el = this._track(name);
            el._gain.gain.cancelScheduledValues(t);
            el._gain.gain.setTargetAtTime(1, t, 0.6);
            el.play().catch(() => { /* blocked until a gesture, or missing: the error handler falls back */ });
            return;
        }
        this.theme = name; this.step = 0; this.nextT = t + 0.1;
    }

    _schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || !this.theme) return;
        const th = THEMES[this.theme] || THEMES.hall;
        const spb = 60 / th.bpm / 2;
        while (this.nextT < ctx.currentTime + 0.3) {
            const t = this.nextT, [root, minor] = th.prog[Math.floor(this.step / 12) % th.prog.length], sc = minor ? MINOR : MAJOR;
            this._tone('triangle', NOTE(root + sc[ARP[this.step % ARP.length]]), t, spb * 2.2, 0.035, this.musicBus);
            if (this.step % 12 === 0) for (const i of [0, 1, 2]) this._tone('sine', NOTE(root - 12 + sc[i]), t, spb * 12, 0.03, this.musicBus);
            this.step++; this.nextT += spb;
        }
    }

    _tone(type, freq, t, dur, vol, dest, to = null) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.03);
    }

    // ------------------------------------------------------------ effects
    async _loadSfx(name) {
        try {
            const res = await fetch(`audio/sfx/${name}.mp3`);
            if (!res.ok) return;
            this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
        } catch { /* the synth tone stands in */ }
    }

    sfx(name, vol = 1) {
        this.played[name] = (this.played[name] || 0) + 1;
        if (!this.ok) return;
        const buf = this.buffers[name];
        if (buf) {
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = buf; g.gain.value = vol;
            src.connect(g); g.connect(this.sfxBus);
            src.start();
            return;
        }
        const [f, to, dur, type] = TONES[name] || [500, 400, 0.1, 'triangle'];
        this._tone(type, f, this.ctx.currentTime, dur, 0.18 * vol, this.sfxBus, to);
    }

    ui(kind) {
        if (kind === 'page') { this.sfx('page', 0.5); return; }
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        if (kind === 'click') this._tone('triangle', 620, t, 0.05, 0.1, this.sfxBus);
        else if (kind === 'open') this._tone('triangle', 440, t, 0.09, 0.1, this.sfxBus, 660);
        else if (kind === 'close') this._tone('triangle', 660, t, 0.09, 0.1, this.sfxBus, 440);
    }

    // ------------------------------------------------------------ voices
    say(key) {
        this.stopVoice();
        if (!this.ok || !VOICED.has(key) || this.vol.voice <= 0) return false;
        this.voiceKey = key;
        this.voiceEl.src = `audio/vo/${key}.mp3`;
        this.voiceEl.play().catch(() => { this.voiceKey = null; });
        return true;
    }
    stopVoice() {
        if (this.voiceEl && this.voiceKey) { this.voiceEl.pause(); this.voiceKey = null; }
    }
}
