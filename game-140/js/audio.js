// Sound. Music, effects and every voiced line were generated with ElevenLabs (audio/, see dev/audio/README.md).
// A small Web Audio synth stands in for any file that can't be loaded: slow minor pads and harp arpeggios for the
// music, tones for the effects. The context is made on the first gesture; ../lib/page-audio.js suspends it in a
// hidden tab. Adapted from game-127.

import { VOICED } from './voices.js';
import { MUSIC, SFX } from './assets.js';

export { MUSIC, SFX };
const SFX_ALIAS = {};

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// synth fallbacks: tempo, chord roots (midi) and minor flags, an arpeggio pattern over the chord
const THEMES = {
    title: { bpm: 60, prog: [[57, 1], [53, 0], [48, 0], [55, 0]] },
    ravenmoor: { bpm: 56, prog: [[50, 1], [46, 0], [45, 1], [45, 1]] },
    grey: { bpm: 54, prog: [[52, 1], [48, 0], [52, 1], [47, 1]] },
    order: { bpm: 64, prog: [[45, 1], [46, 0], [45, 1], [43, 0]] },
    tension: { bpm: 92, prog: [[52, 1], [53, 0], [52, 1], [50, 1]] },
    ward: { bpm: 70, prog: [[57, 1], [55, 0], [53, 0], [52, 1]] },
    bloom: { bpm: 72, prog: [[60, 0], [65, 0], [57, 1], [67, 0]] },
    camp: { bpm: 66, prog: [[62, 0], [67, 0], [64, 1], [69, 0]] },
    sorrow: { bpm: 58, prog: [[57, 1], [53, 0], [55, 0], [52, 1]] },
    wood: { bpm: 70, prog: [[64, 0], [61, 1], [57, 0], [59, 0]] },
    sea: { bpm: 84, prog: [[62, 1], [60, 0], [58, 0], [57, 0]] },
    finale: { bpm: 120, prog: [[57, 1], [53, 0], [55, 0], [52, 1]] },
    glory: { bpm: 96, prog: [[60, 0], [65, 0], [67, 0], [60, 0]] },
    epilogue: { bpm: 76, prog: [[65, 0], [62, 1], [58, 0], [60, 0]] },
};
const ARP = [0, 2, 4, 7, 4, 2];
const MAJOR = [0, 4, 7, 12, 16, 19, 24, 28];
const MINOR = [0, 3, 7, 12, 15, 19, 24, 27];

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.75, music: 0.5, voice: 0.95 };
        this.want = null;
        this.current = null;
        this.tracks = {};
        this.buffers = {};
        this.synthOnly = false;
        this.theme = null;
        this.voiceEl = null;
        this.voiceKey = null;
        this.voiceFails = 0;
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
        // the voice clip player: one element, routed through Web Audio so its volume works on iOS too
        this.voiceEl = new window.Audio();
        this.voiceEl.preload = 'auto';
        try { ctx.createMediaElementSource(this.voiceEl).connect(this.voiceBus); } catch { /* no routing: element volume */ }
        this.voiceEl.addEventListener('error', () => { this.voiceFails++; this.voiceKey = null; });
        this.voiceEl.addEventListener('ended', () => { this.voiceKey = null; });
        for (const n of SFX) if (n !== 'page' && n !== 'click') this._loadSfx(n);      // those two are synth-only
        this.timer = setInterval(() => this._schedule(), 70);
        if (this.want !== null) { const w = this.want; this.want = null; this.current = null; this.play(w); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

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
        el.loop = true;
        el.preload = 'auto';
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

    /** Switch the music (null for silence). A name that isn't a track keeps the current music. */
    play(name) {
        if (name && !MUSIC.includes(name)) return;
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
        this.theme = THEMES[name] ? name : 'grey';
        this.step = 0;
        this.nextT = t + 0.1;
    }

    _schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || !this.theme) return;
        const th = THEMES[this.theme];
        const spb = 60 / th.bpm / 2;
        while (this.nextT < ctx.currentTime + 0.3) {
            const t = this.nextT;
            const bar = Math.floor(this.step / 12) % th.prog.length;
            const [root, minor] = th.prog[bar];
            const sc = minor ? MINOR : MAJOR;
            this._tone('triangle', NOTE(root + sc[ARP[this.step % ARP.length]]), t, spb * 2.2, 0.035, this.musicBus);
            if (this.step % 12 === 0) for (const i of [0, 1, 2]) this._tone('sine', NOTE(root - 12 + sc[i]), t, spb * 12, 0.03, this.musicBus);
            this.step++;
            this.nextT += spb;
        }
    }

    _tone(type, freq, t, dur, vol, dest, to = null) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------ effects
    _loadSfx(name) {
        fetch(`audio/sfx/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[name] = buf; }).catch(() => { /* synth stands in */ });
    }

    sfx(name, vol = 1) {
        if (!this.ok) return;
        name = SFX_ALIAS[name] || name;
        const buf = this.buffers[name];
        if (buf) {
            const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
            s.buffer = buf; g.gain.value = vol;
            s.connect(g); g.connect(this.sfxBus);
            s.start();
            return;
        }
        const t = this.ctx.currentTime, B = this.sfxBus;
        const chord = (fs, d = 0.08, type = 'triangle', v = 0.08) => fs.forEach((f, i) => this._tone(type, f, t + i * d, 0.3, v, B));
        switch (name) {
            case 'click': this._tone('triangle', 880, t, 0.06, 0.05, B); break;
            case 'page': this._tone('sine', 1400, t, 0.05, 0.03, B, 700); break;
            case 'turn': this._tone('triangle', 260, t, 0.09, 0.07, B, 200); break;
            case 'lock': chord([392, 523], 0.06, 'triangle', 0.08); break;
            case 'magic': case 'geas': chord([1319, 1568, 1976, 2637], 0.05, 'sine', 0.05); break;
            case 'ward': chord([523, 659, 784, 1047, 1319], 0.12, 'sine', 0.08); break;
            case 'bells': chord([523, 784, 1047, 784], 0.25, 'sine', 0.08); break;
            case 'clash': case 'anvil': this._tone('square', 2200, t, 0.15, 0.04, B, 1400); break;
            case 'hope': chord([1047, 1319, 1568], 0.07, 'sine', 0.035); break;
            default: this._tone('sawtooth', 110, t, 0.5, 0.06, B, 55);
        }
    }

    ui(kind) {
        if (kind === 'click') this.sfx('click', 0.5);
        else if (kind === 'no') { if (this.ok) this._tone('triangle', 200, this.ctx.currentTime, 0.15, 0.05, this.sfxBus, 150); }
        else if (kind === 'page') this.sfx('page', 0.45);
    }

    // ------------------------------------------------------------ voices
    hasVoice(key) { return VOICED.has(key); }

    /** Play a recorded line (stopping any other). Returns true if a clip was started. */
    say(key) {
        this.stopVoice();
        if (!this.ctx || !VOICED.has(key) || this.vol.voice <= 0) return false;
        this.voiceKey = key;
        this.voiceEl.src = `audio/vo/${key}.mp3`;
        this.voiceEl.play().catch(() => { this.voiceKey = null; });
        return true;
    }

    stopVoice() {
        if (this.voiceEl && this.voiceKey) { this.voiceEl.pause(); }
        this.voiceKey = null;
    }

    /** True while a voice clip is still playing. */
    get speaking() { return !!this.voiceKey && !!this.voiceEl && !this.voiceEl.paused && !this.voiceEl.ended; }

    onEvents(events) {
        for (const e of events) {
            if (e.type === 'sfx') this.sfx(e.id);
            else if (e.type === 'music') this.play(e.id);
            else if (e.type === 'turn') this.sfx('turn', 0.7);
            else if (e.type === 'hint') this.sfx('magic', 0.45);
            else if (e.type === 'wardStart') this.play('ward');
            else if (e.type === 'wardOpen') { this.sfx('lock', 0.9); this.sfx('ward'); }
            else if (e.type === 'hope') this.sfx('hope', 0.6);
        }
    }
}
