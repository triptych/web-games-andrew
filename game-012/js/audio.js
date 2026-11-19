// Sound. Effects, voices and music are ElevenLabs recordings (audio/, listed in media.js). Effects and voices are
// decoded into AudioBuffers; music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js
// still silences a hidden tab, and themes crossfade. Anything that fails to load falls back to a small Web Audio
// synth (effects) or silence (music, voices): never an error.
//
// Juice: hits are pitched a little at random so a long battle never sounds the same, and repeats of one effect are
// throttled so ten cards struck at once chime instead of roaring.

import { SFX, MUSIC, VOICES, ROOT } from './media.js';

const SYNTH = {
    pull: [{ freq: 200, to: 900, dur: 0.9, type: 'sine', vol: 0.12 }],
    flip: [{ freq: 1400, to: 600, dur: 0.06, type: 'triangle', vol: 0.1 }],
    reveal: [{ freq: 1200, to: 1800, dur: 0.25, type: 'sine', vol: 0.08 }],
    rare: [880, 1108, 1318].map((f, i) => ({ freq: f, dur: 0.3, type: 'triangle', vol: 0.08, delay: i * 0.08 })),
    legend: [523, 659, 784, 1046, 1318].map((f, i) => ({ freq: f, dur: 0.5, type: 'triangle', vol: 0.1, delay: i * 0.09 })),
    star: [{ freq: 900, to: 1800, dur: 0.3, type: 'sine', vol: 0.1 }],
    click: [{ freq: 900, dur: 0.04, type: 'triangle', vol: 0.08 }],
    deny: [{ freq: 220, to: 160, dur: 0.12, type: 'square', vol: 0.06 }],
    hit: [{ freq: 300, to: 90, dur: 0.12, type: 'square', vol: 0.1 }],
    crit: [{ freq: 500, to: 80, dur: 0.22, type: 'sawtooth', vol: 0.12 }],
    spell: [{ freq: 300, to: 1200, dur: 0.4, type: 'sine', vol: 0.09 }],
    heal: [{ freq: 600, to: 1200, dur: 0.35, type: 'sine', vol: 0.08 }],
    shield: [{ freq: 1500, to: 1300, dur: 0.3, type: 'sine', vol: 0.06 }],
    burn: [{ freq: 200, to: 80, dur: 0.3, type: 'sawtooth', vol: 0.06 }],
    stun: [{ freq: 700, to: 400, dur: 0.2, type: 'triangle', vol: 0.08 }],
    curse: [{ freq: 160, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.07 }],
    die: [{ freq: 900, to: 120, dur: 0.4, type: 'triangle', vol: 0.1 }],
    rise: [{ freq: 300, to: 1200, dur: 0.7, type: 'sine', vol: 0.1 }],
    victory: [523, 659, 784, 1046].map((f, i) => ({ freq: f, dur: 0.4, type: 'triangle', vol: 0.12, delay: i * 0.12 })),
    defeat: [392, 330, 262].map((f, i) => ({ freq: f, dur: 0.5, type: 'triangle', vol: 0.1, delay: i * 0.2 })),
    dust: [{ freq: 1800, dur: 0.05, type: 'square', vol: 0.04 }, { freq: 2400, dur: 0.08, type: 'square', vol: 0.04, delay: 0.05 }],
    omen: [{ freq: 110, to: 100, dur: 1.2, type: 'sine', vol: 0.15 }],
    phase: [{ freq: 90, to: 40, dur: 1.2, type: 'sawtooth', vol: 0.15 }],
    whoosh: [{ freq: 600, to: 200, dur: 0.15, type: 'triangle', vol: 0.05 }],
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5; this.voiceVol = 0.9;
        this.buffers = {};
        this.voices = {};
        this.tracks = {};
        this.theme = null;
        this.last = {};
        this.voice = { src: null, id: null };
        this.played = {};          // effect name → times played, for the tests
        this.onSay = null;         // (id, seconds) for subtitles
    }

    /** Made on the first user gesture (browsers block audio before one). */
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol * 0.8; this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.45; this.mus.connect(comp);
        this.vox = ctx.createGain(); this.vox.gain.value = this.voiceVol; this.vox.connect(comp);
        const load = (name, path, into) => fetch(ROOT + path)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((a) => ctx.decodeAudioData(a))
            .then((b) => { into[name] = b; })
            .catch(() => { /* the synth or silence stands in */ });
        this.loading = Promise.all([
            ...SFX.map((n) => load(n, `audio/sfx-${n}.mp3`, this.buffers)),
            ...VOICES.map((n) => load(n, `audio/vo-${n}.mp3`, this.voices)),
        ]);
        if (this.wantTheme) this.music(this.wantTheme);
    }

    setVolumes(sfx, music, voice) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx * 0.8, t, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.45, t, 0.02);
        this.vox.gain.setTargetAtTime(voice, t, 0.02);
    }

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

    /** One effect. rate shifts the pitch; gap (s) throttles repeats of the same effect. */
    play(name, { rate = 1, vol = 1, gap = 0.04, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        this.played[name] = (this.played[name] || 0) + 1;
        const buf = this.buffers[name];
        if (!buf) { for (const t of SYNTH[name] || []) this.tone({ ...t, freq: t.freq * rate, to: (t.to || t.freq) * rate, delay: (t.delay || 0) + delay }); return; }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(now + delay);
    }

    ui(kind = 'click') { this.play(kind === 'deny' ? 'deny' : 'click', { vol: 0.7, rate: kind === 'close' ? 0.85 : 1 }); }

    /** A voice line; one at a time, and a new line cuts the old one. Returns its length in seconds (0 if silent). */
    say(id) {
        const buf = this.voices[id];
        if (!buf || !this.ctx || this.ctx.state !== 'running' || this.voiceVol <= 0) { this.onSay?.(id, 0); return 0; }
        try { this.voice.src?.stop(); } catch { /* already stopped */ }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.vox);
        src.start();
        this.voice = { src, id };
        this.played['vo:' + id] = (this.played['vo:' + id] || 0) + 1;
        // duck the music under the voice
        const t = this.ctx.currentTime;
        this.mus.gain.cancelScheduledValues(t);
        this.mus.gain.setTargetAtTime(this.musicVol * 0.16, t, 0.08);
        this.mus.gain.setTargetAtTime(this.musicVol * 0.45, t + buf.duration, 0.4);
        this.onSay?.(id, buf.duration);
        return buf.duration;
    }
    hush() { try { this.voice.src?.stop(); } catch { /* */ } this.voice = { src: null, id: null }; }

    /** Crossfade to a theme: parlour, battle, boss, reading, or null for silence. */
    music(theme) {
        this.wantTheme = theme;
        if (!this.ctx || theme === this.theme) return;
        const old = this.tracks[this.theme];
        this.theme = theme;
        if (old) this.fade(old, 0, 1.2, true);
        if (!theme || !MUSIC[theme]) return;
        let tr = this.tracks[theme];
        if (!tr) {
            const el = new window.Audio(ROOT + MUSIC[theme]);
            el.loop = true;
            el.crossOrigin = 'anonymous';
            el.preload = 'auto';
            try {
                const src = this.ctx.createMediaElementSource(el);
                const g = this.ctx.createGain();
                g.gain.value = 0;
                src.connect(g); g.connect(this.mus);
                tr = this.tracks[theme] = { el, g };
            } catch { return; }
            el.addEventListener('error', () => { /* silence stands in */ });
        }
        tr.el.play().then(() => this.fade(tr, 1, 1.4, false)).catch(() => { /* blocked or missing: silence */ });
    }
    fade(tr, to, secs, pauseAfter) {
        const t = this.ctx.currentTime;
        tr.g.gain.cancelScheduledValues(t);
        tr.g.gain.setValueAtTime(tr.g.gain.value, t);
        tr.g.gain.linearRampToValueAtTime(to, t + secs);
        if (pauseAfter) setTimeout(() => { if (this.tracks[this.theme] !== tr) tr.el.pause(); }, secs * 1000 + 50);
    }
    playing() { const tr = this.tracks[this.theme]; return !!tr && !tr.el.paused; }
}
