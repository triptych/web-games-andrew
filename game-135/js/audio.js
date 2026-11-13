// Sound: ElevenLabs music, effects and voices (audio/*.mp3, listed in js/audio-files.js), with a Web Audio synth
// for anything missing. Music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js still
// silences a hidden tab; effects and voices are decoded into buffers. The context is made on the first user gesture.
// One voice at a time on its own bus; the music ducks under it.

import { AUDIO_FILES } from './audio-files.js';
import { VEH } from './config.js';

const THEMES = { title: ['music-title'], work: ['music-work1', 'music-work2'] };
const DUCK = 0.35;             // music level under a voice
// sim event → clip, with the least time between two plays of it
const EVENT_SFX = {
    honk: ['horn', 0.3], loaded: ['load', 0.2], dumped: ['dump', 0.3], rolled: ['roll', 0.35], cleared: ['crush', 0.15],
    scoop: ['scoop', 0.1], drop: ['scoop', 0.1], digTick: ['dig', 0.75], pourTick: ['pour', 0.6], dug: ['place', 0.2], poured: ['place', 0.2],
    placed: ['place', 0.2], miss: ['miss', 0.3], smash: ['smash', 0.2], collapse: ['collapse', 0.5], bump: ['bump', 0.3], switch: ['poof', 0.15],
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5; this.voiceVol = 0.9;
        this.vo = null; this.voWant = null; this.voPending = null;
        this.buffers = {}; this.loading = {};
        this.music = {}; this.theme = null; this.wantTheme = null; this.track = 0;
        this.last = {};
        this.peak = 0;
        this.engine = null;
        this.played = {};             // clip → how many times (for the tests)
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 512;
        comp.connect(this.meter); this.meter.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.6; this.mus.connect(comp);
        this.voBus = ctx.createGain(); this.voBus.gain.value = this.voiceVol; this.voBus.connect(comp);
        for (const [n] of Object.values(EVENT_SFX)) this.load('sfx-' + n);
        for (const n of ['fanfare', 'cheer', 'click', 'engine']) this.load('sfx-' + n);
        if (this.wantTheme) this.setTheme(this.wantTheme);
        if (this.voPending) { const n = this.voPending; this.voPending = null; this.voice(n); }
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.voBus.gain.setTargetAtTime(voice, this.ctx.currentTime, 0.02);
        this.duck();
    }

    /** Music level: lower while someone is speaking. */
    duck() {
        if (!this.ctx) return;
        const v = this.musicVol * 0.6 * (this.vo && this.voiceVol > 0 ? DUCK : 1);
        this.mus.gain.setTargetAtTime(v, this.ctx.currentTime, this.vo ? 0.15 : 0.6);
    }

    get voicePlaying() { return this.vo?.name || null; }

    /** Speak a line (vo-<name>.mp3); a new line replaces the one speaking. */
    async voice(name) {
        name = 'vo-' + name;
        if (!AUDIO_FILES.has(name)) return;
        if (!this.ctx) { this.voPending = name.slice(3); return; }      // asked for before the first gesture
        this.voWant = name;
        if (!this.buffers[name]) await this.load(name);
        if (this.voWant !== name || !this.buffers[name]) return;       // stopped, or another line asked for, meanwhile
        this.voWant = null;
        this.stopVoice(false);
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[name];
        src.connect(this.voBus);
        const vo = this.vo = { name, src };
        src.onended = () => { if (this.vo === vo) { this.vo = null; this.duck(); } };
        src.start();
        this.played[name] = (this.played[name] || 0) + 1;
        this.duck();
    }

    stopVoice(all = true) {
        if (all) { this.voWant = null; this.voPending = null; }
        if (!this.vo) return;
        const vo = this.vo; this.vo = null;
        try { vo.src.stop(); } catch { /* already over */ }
        this.duck();
    }

    /** The loudest sample the master bus has carried recently (for the browser test). */
    level() {
        if (!this.meter) return 0;
        const a = new Float32Array(this.meter.fftSize);
        this.meter.getFloatTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v));
        this.peak = Math.max(this.peak * 0.9, m);
        return this.peak;
    }

    get musicPlaying() { return Object.values(this.music).some((m) => !m.el.paused && m.target > 0); }

    /** Crossfade to a theme: 'title' or 'work' (whose tracks take turns). */
    setTheme(theme) {
        this.wantTheme = theme;
        if (!this.ctx || this.theme === theme) return;
        this.theme = theme; this.track = 0;
        this.playTrack();
    }

    playTrack() {
        const list = (THEMES[this.theme] || []).filter((n) => AUDIO_FILES.has(n));
        const name = list.length ? list[this.track % list.length] : null;
        for (const [k, m] of Object.entries(this.music)) if (k !== name) { m.target = 0; m.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8); }
        if (!name) return;
        let m = this.music[name];
        if (!m) {
            const el = new window.Audio(`audio/${name}.mp3`);
            el.crossOrigin = 'anonymous'; el.preload = 'auto';
            const src = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain(); g.gain.value = 0;
            src.connect(g); g.connect(this.mus);
            m = this.music[name] = { el, g, target: 1 };
            // at the end of a track, the theme's next one (or the same again)
            el.addEventListener('ended', () => { if (m.target > 0 && this.theme && THEMES[this.theme].includes(name)) { this.track++; el.currentTime = 0; this.playTrack(); } });
        }
        m.target = 1;
        m.g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8);
        m.el.play().catch(() => { /* autoplay blocked until a gesture: init() retries */ });
    }

    /** Decode a clip once; resolves when it is ready (or failed: then the synth stands in). */
    load(name) {
        if (this.buffers[name] || !AUDIO_FILES.has(name) || !this.ctx) return Promise.resolve();
        this.loading[name] ||= (async () => {
            try {
                const r = await fetch(`audio/${name}.mp3`);
                this.buffers[name] = await this.ctx.decodeAudioData(await r.arrayBuffer());
            } catch { /* falls back to the synth */ }
        })();
        return this.loading[name];
    }

    /** Play an effect clip, or a synth blip if it isn't there. gap: least seconds between two plays. */
    play(name, { vol = 1, rate = 1, gap = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (gap && now - (this.last[name] ?? -9) < gap) return;
        this.last[name] = now;
        this.played[name] = (this.played[name] || 0) + 1;
        const buf = this.buffers['sfx-' + name];
        if (!buf) { this.tone({ freq: 300 + (name.length * 53) % 400, to: 160, dur: 0.12, type: 'triangle', vol: 0.15 * vol }); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = buf; src.playbackRate.value = rate; g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start();
    }

    /** One enveloped oscillator: the stand-in for a missing clip. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.play('click', { vol: 0.7, gap: 0.05 });
        else if (kind === 'open') this.play('click', { vol: 0.6, rate: 1.2, gap: 0.05 });
        else if (kind === 'close') this.play('click', { vol: 0.6, rate: 0.85, gap: 0.05 });
    }

    /** The engine: a loop whose pitch and level follow the speed. on = the truck is being driven. */
    setEngine(on, speed = 0, veh = 'dump') {
        if (!this.ctx || this.ctx.state !== 'running') return;
        if (!this.engine && this.buffers['sfx-engine']) {
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = this.buffers['sfx-engine']; src.loop = true; g.gain.value = 0;
            src.connect(g); g.connect(this.sfx); src.start();
            this.engine = { src, g };
        }
        if (!this.engine) return;
        const k = Math.min(1, Math.abs(speed) / VEH[veh].vmax), t = this.ctx.currentTime;
        this.engine.g.gain.setTargetAtTime(on ? 0.16 + 0.22 * k : 0, t, 0.1);
        this.engine.src.playbackRate.setTargetAtTime((VEH[veh].pivot ? 0.8 : 1) + 0.6 * k, t, 0.1);
    }

    onEvents(G, events) {
        for (const e of events) {
            const s = EVENT_SFX[e.type];
            if (s) this.play(s[0], { gap: s[1], vol: e.type === 'rolled' ? 0.5 : 1 });
            if (e.type === 'stepDone') this.play('place', { rate: 1.3, vol: 0.6, gap: 0.2 });
            if (e.type === 'jobDone') { this.play('fanfare'); this.play('cheer', { vol: 0.7 }); }
            if (e.type === 'allDone') this.play('cheer');
        }
    }
}
