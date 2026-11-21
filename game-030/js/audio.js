// Sound. Music, effects and the voiced lines were generated with ElevenLabs (audio/, see dev/audio/README.md):
// the effects in ElevenLabs itself, the music and voices with ElevenLabs models on fal. A small Web Audio synth
// stands in for any music or effect that can't load. Music plays through <audio> elements routed into a gain node
// (so ../lib/page-audio.js still silences a hidden tab) and crossfades on a change; effects are decoded buffers;
// one voice plays at a time. The context is made on the first gesture.

import { MUSIC, SFX, VOICES } from './audio-files.js';
import { voiceKey } from './voicekey.js';

const THEMES = {   // synth fallback: tempo and chord roots (midi), minor flags
    title: { bpm: 84, prog: [[53, 0], [58, 0], [60, 0], [53, 0]] }, lane: { bpm: 100, prog: [[55, 0], [60, 0], [62, 0], [55, 0]] },
    wilds: { bpm: 92, prog: [[52, 0], [57, 0], [59, 0], [52, 1]] }, gully: { bpm: 80, prog: [[50, 1], [46, 0], [48, 0], [45, 1]] },
    battle: { bpm: 150, prog: [[57, 1], [53, 0], [55, 0], [52, 1]] }, boss: { bpm: 138, prog: [[50, 1], [46, 0], [49, 0], [50, 1]] },
    ending: { bpm: 84, prog: [[53, 0], [58, 0], [60, 0], [53, 0]] },
};
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.5, voice: 0.95 };
        this.want = null; this.current = null;
        this.tracks = {}; this.buffers = {};
        this.voiceEl = null; this.speaking = false;
        this.lastBark = 0;
        this.failed = 0;
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
        try { ctx.createMediaElementSource(this.voiceEl).connect(this.voiceBus); } catch { /* element volume */ }
        this.voiceEl.addEventListener('ended', () => { this.speaking = false; });
        this.voiceEl.addEventListener('error', () => { this.speaking = false; this.failed++; });
        for (const n of SFX) this.loadSfx(n);
        this.timer = setInterval(() => this.schedule(), 80);
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes({ sfx = this.vol.sfx, music = this.vol.music, voice = this.vol.voice } = {}) {
        this.vol = { sfx, music, voice };
        if (this.voiceEl) this.voiceEl.volume = 1;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfxBus.gain.setTargetAtTime(sfx, t, 0.02);
        this.musicBus.gain.setTargetAtTime(music * 0.8, t, 0.05);
        this.voiceBus.gain.setTargetAtTime(voice, t, 0.02);
    }

    // ------------------------------------------------------------ music
    track(name) {
        if (this.tracks[name]) return this.tracks[name];
        const el = new window.Audio(`audio/music/${name}.mp3`);
        el.loop = true; el.preload = 'auto';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already routed */ }
        g.connect(this.musicBus);
        el._gain = g;
        el.addEventListener('error', () => { el._bad = true; if (this.current === name) this.theme = name; });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the music (null for silence). */
    play(name) {
        this.want = name;
        if (!this.ctx || this.current === name) return;
        this.current = name;
        const t = this.ctx.currentTime;
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.cancelScheduledValues(t);
            el._gain.gain.setTargetAtTime(0, t, 0.4);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 2000);
        }
        this.theme = null;
        if (!name) return;
        if (MUSIC.includes(name)) {
            const el = this.track(name);
            if (el._bad) { this.theme = name; return; }
            if (name === 'battle' || name === 'boss') el.currentTime = 0;
            el._gain.gain.cancelScheduledValues(t);
            el._gain.gain.setTargetAtTime(1, t, 0.5);
            el.play().catch(() => { this.theme = name; });
        } else this.theme = name;
        this.next = t + 0.1; this.beat = 0;
    }

    /** The synth's fallback theme, scheduled a little ahead. */
    schedule() {
        if (!this.theme || !this.ok) return;
        const th = THEMES[this.theme];
        if (!th) return;
        const ctx = this.ctx, spb = 60 / th.bpm / 2;
        while (this.next < ctx.currentTime + 0.3) {
            const [root, minor] = th.prog[Math.floor(this.beat / 8) % th.prog.length];
            const step = [0, minor ? 3 : 4, 7, 12, 7, minor ? 3 : 4, 0, 7][this.beat % 8];
            this.tone(NOTE(root + 12 + step), this.next, spb * 0.9, 0.05, 'triangle', this.musicBus);
            if (this.beat % 8 === 0) this.tone(NOTE(root), this.next, spb * 8, 0.06, 'sine', this.musicBus);
            this.next += spb; this.beat++;
        }
    }

    tone(f, at, dur, v, type = 'sine', bus = this.sfxBus) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g).connect(bus); o.start(at); o.stop(at + dur + 0.05);
    }

    // ------------------------------------------------------------ effects
    async loadSfx(n) {
        try {
            const r = await fetch(`audio/sfx/${n}.mp3`);
            if (!r.ok) throw new Error(r.status);
            this.buffers[n] = await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch { this.buffers[n] = null; }
    }

    sfx(n, vol = 1) {
        if (!this.ok) return;
        const b = this.buffers[n];
        if (b) {
            const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
            s.buffer = b; g.gain.value = vol;
            s.connect(g).connect(this.sfxBus); s.start();
            return;
        }
        const t = this.ctx.currentTime;   // synth stand-ins
        const blip = { click: [660, 0.05], step: [120, 0.05], hit: [110, 0.12], slash: [520, 0.08], coin: [1320, 0.12], quest: [880, 0.3], levelup: [990, 0.5], victory: [784, 0.6], defeat: [196, 0.8],
            clang: [330, 0.14], spark: [1500, 0.12], gears: [700, 0.18], steam: [260, 0.3], quake: [70, 0.35], heal: [880, 0.25], shield: [440, 0.2], chest: [660, 0.3], door: [180, 0.2], encounter: [300, 0.3], ko: [150, 0.3] }[n] || [440, 0.1];
        this.tone(blip[0], t, blip[1], 0.12 * vol, n === 'hit' ? 'square' : 'triangle');
    }

    ui(n) {   // tiny synth clicks for menus
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        if (n === 'page') this.tone(740, t, 0.06, 0.05, 'sine');
        else if (n === 'deny') this.tone(160, t, 0.12, 0.08, 'square');
        else this.tone(880, t, 0.05, 0.05, 'triangle');
    }

    // ------------------------------------------------------------ voices
    hasVoice(who, text) { return VOICES.has(voiceKey(who, text)); }

    say(who, text) {
        this.stopVoice();
        if (!this.voiceEl || !this.hasVoice(who, text)) return false;
        this.voiceEl.src = `audio/vo/${voiceKey(who, text)}.mp3`;
        this.speaking = true;
        this.voiceEl.play().catch(() => { this.speaking = false; });
        return true;
    }

    stopVoice() {
        if (this.voiceEl && !this.voiceEl.paused) this.voiceEl.pause();
        this.speaking = false;
    }

    /** A battle shout, rationed: at most one every few seconds, and not every time. */
    bark(who, text, force = false) {
        const now = performance.now();
        if (!force && (now - this.lastBark < 4000 || Math.random() > 0.55)) return;
        if (this.speaking) return;
        if (this.say(who, text)) this.lastBark = now;
    }
}
