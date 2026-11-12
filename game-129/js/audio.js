// HOLLOWDEEP — sound. Music, sound effects and every voice were generated with ElevenLabs (audio/, see
// dev/audio/README.md). Music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js still
// silences a hidden tab, and crossfades between themes. Effects and voices are decoded into AudioBuffers on demand.
// Anything that fails to load falls back to a few synthesised blips and a soft drone, so the game is never silent.

import { VOICES } from './voices.js';

const MUSIC = ['title', 'town', 'dungeon-1', 'dungeon-2', 'dungeon-3', 'battle', 'boss', 'victory', 'defeat'];
const STINGS = new Set(['victory', 'defeat']);
const SFX = ['step', 'bump', 'stairs', 'chest', 'coins', 'hit', 'crit', 'hurt', 'miss', 'fire', 'ice', 'bolt', 'holy', 'dark', 'heal',
    'levelup', 'down', 'encounter', 'roar', 'bell', 'warp', 'trap', 'fountain'];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buffers = {};
        this.loading = {};
        this.tracks = {};
        this.current = null;      // the theme that should be playing
        this.sting = null;
        this.voiceSrc = null;
        this.voiceBusyUntil = 0;
        this.onSubtitle = null;   // (who, text) => void, set by the UI
        this.failed = new Set();
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3.5;
        comp.connect(ctx.destination);
        this.master = comp;
        this.sfx = ctx.createGain(); this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.connect(comp);
        // a meter on the master bus: the browser test reads it to prove sound came out
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 512; comp.connect(this.meter);
        this.setVolumes(this.sfxVol, this.musicVol, this.voiceVol);
        for (const n of ['step', 'bump', 'hit', 'hurt', 'miss', 'encounter', 'heal', 'coins']) this._load('sfx-' + n);
        this._loadAmbience();
        if (this.current) { const c = this.current; this.current = null; this.play(c); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.03);
        this.music.gain.setTargetAtTime(music * 0.7, t, 0.05);
        this.voice.gain.setTargetAtTime(voice, t, 0.03);
    }

    /** Peak level on the master bus right now (0..1). */
    level() {
        if (!this.meter) return 0;
        const a = new Float32Array(this.meter.fftSize);
        this.meter.getFloatTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v));
        return m;
    }

    // ------------------------------------------------------------ clips
    _load(name) {
        if (this.buffers[name] || this.loading[name] || !this.ctx) return this.loading[name];
        const path = name.startsWith('vo/') ? `audio/${name}.mp3` : `audio/${name}.mp3`;
        this.loading[name] = fetch(path).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[name] = buf; return buf; })
            .catch(() => { this.failed.add(name); return null; });
        return this.loading[name];
    }

    _play(buf, bus, { vol = 1, rate = 1 } = {}) {
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
        s.connect(g); g.connect(bus);
        s.start();
        return s;
    }

    /** A sound effect by name; synth fallback when the file is missing or still loading. */
    fx(name, opts = {}) {
        if (!this.ok) return;
        const key = 'sfx-' + name;
        const buf = this.buffers[key];
        if (buf) { this._play(buf, this.sfx, { vol: opts.vol ?? 0.9, rate: opts.rate ?? (0.94 + Math.random() * 0.12) }); return; }
        this._load(key);
        this._blip(name);
    }

    _blip(name) {
        const f = { hit: [200, 90], crit: [260, 80], hurt: [140, 70], miss: [600, 900], step: [90, 60], bump: [80, 50], coins: [1200, 1600],
            heal: [520, 880], levelup: [440, 1320], chest: [300, 600], encounter: [120, 600], down: [300, 60] }[name] || [440, 330];
        this.tone(f[0], f[1], 0.12, 'triangle', 0.12);
    }

    tone(from, to, dur = 0.12, type = 'square', vol = 0.15, delay = 0) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'move') this.tone(520, 520, 0.035, 'triangle', 0.06);
        else if (kind === 'ok') this.tone(660, 990, 0.07, 'triangle', 0.09);
        else if (kind === 'back') this.tone(500, 330, 0.07, 'triangle', 0.08);
        else if (kind === 'no') this.tone(160, 120, 0.12, 'square', 0.06);
    }

    // ------------------------------------------------------------ voices
    /**
     * Say a line: voices.js `id`, line index n. One voice at a time; `force` cuts the current line off.
     * The subtitle callback shows the text either way, so a missing file still tells the story.
     */
    say(id, n, { force = false, chance = 1 } = {}) {
        const v = VOICES[id];
        if (!v || !v.lines[n]) return false;
        const now = performance.now();
        if (!force && now < this.voiceBusyUntil) return false;
        if (Math.random() > chance) return false;
        this.onSubtitle?.(id, v.lines[n]);
        if (!this.ok) { this.voiceBusyUntil = now + 2500; return true; }
        const key = `vo/${id}-${n + 1}`;
        const go = (buf) => {
            if (!buf) return;
            try { this.voiceSrc?.stop(); } catch { /* already ended */ }
            this.voiceSrc = this._play(buf, this.voice, { vol: 1 });
            this.voiceBusyUntil = performance.now() + buf.duration * 1000 + 250;
            this._duck(buf.duration);
        };
        this.voiceBusyUntil = now + 3000;
        if (this.buffers[key]) go(this.buffers[key]); else this._load(key)?.then(go);
        return true;
    }

    _duck(sec) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime, g = this.music.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(this.musicVol * 0.32, t, 0.08);
        g.setTargetAtTime(this.musicVol * 0.7, t + sec, 0.4);
    }

    // ------------------------------------------------------------ music
    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music-${name}.mp3`);
        el.loop = !STINGS.has(name);
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* connected once */ }
        g.connect(this.music);
        el._g = g;
        el.addEventListener('error', () => { this.failed.add('music-' + name); if (this.current === name) this._drone(true); });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the theme with a crossfade. A sting (victory, defeat) plays once over a dip, then the theme resumes. */
    play(name) {
        if (!this.ctx) { this.current = name; return; }
        if (STINGS.has(name)) {
            const el = this._track(name);
            el.currentTime = 0;
            el._g.gain.setValueAtTime(1, this.ctx.currentTime);
            el.play().catch(() => {});
            const cur = this.current && this.tracks[this.current];
            if (cur) { cur._g.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.1); setTimeout(() => cur._g?.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8), 6000); }
            return;
        }
        if (this.current === name) return;
        const t = this.ctx.currentTime;
        const old = this.current && this.tracks[this.current];
        if (old) { old._g.gain.setTargetAtTime(0, t, 0.35); setTimeout(() => { if (old !== this.tracks[this.current]) old.pause(); }, 1600); }
        this.current = name;
        this._drone(false);
        if (!name) return;
        const el = this._track(name);
        if (name.startsWith('dungeon') || name === 'battle' || name === 'boss') el.currentTime = 0;
        el._g.gain.cancelScheduledValues(t);
        el._g.gain.setValueAtTime(0, t);
        el._g.gain.setTargetAtTime(1, t + 0.05, 0.4);
        el.play().catch(() => {});
    }

    /** The dungeon's wind, under the music. */
    _loadAmbience() {
        this._load('sfx-ambience')?.then((buf) => {
            if (!buf) return;
            this.amb = this.ctx.createGain(); this.amb.gain.value = 0; this.amb.connect(this.sfx);
            const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(this.amb); s.start();
            if (this.ambOn) this.ambience(true);
        });
    }
    ambience(on) {
        this.ambOn = on;
        if (this.amb) this.amb.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.6);
    }

    /** A low two-oscillator drone, used only when a music file can't be loaded. */
    _drone(on) {
        if (!this.ctx) return;
        if (!on) { if (this.droneG) this.droneG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); return; }
        if (!this.droneG) {
            this.droneG = this.ctx.createGain(); this.droneG.gain.value = 0; this.droneG.connect(this.music);
            for (const f of [55, 82.4]) { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(this.droneG); o.start(); }
        }
        this.droneG.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.5);
    }

    preloadMusic(names) { if (this.ctx) for (const n of names) if (MUSIC.includes(n)) this._track(n); }
    preload(names) { for (const n of names) this._load(n); }
}

export { SFX, MUSIC };
