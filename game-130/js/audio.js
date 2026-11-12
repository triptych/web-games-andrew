// Starbase Spooky — sound. Music, effects and every voice line were generated with ElevenLabs (audio/*.mp3, see
// dev/audio/README.md). Music plays through <audio> elements routed into a gain node (so ../lib/page-audio.js still
// silences a hidden tab) with a crossfade between themes; effects and voices are decoded into AudioBuffers, voices
// on demand. Anything that fails to load falls back to a small Web Audio synth, so the game is never silent and
// never breaks. The context is made on the first gesture.

import { clipName } from './sim/data/story.js';

const MUSIC = ['title', 'station', 'spooky', 'fixit', 'ending'];
const SFX = ['door', 'dock', 'spark', 'fixed', 'ghost', 'flicker', 'clue', 'sticker', 'wrong', 'right', 'beep', 'munch', 'signal', 'whale'];
// the memory puzzles' notes: a C-major fuse box and a pentatonic song
const FUSE_NOTES = [523.25, 659.25, 783.99, 1046.5];
const SONG_NOTES = [392, 440, 523.25, 587.33, 659.25];

export class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { sfx: 0.8, music: 0.5, voice: 1 };
        this.buffers = {};
        this.loading = {};
        this.tracks = {};
        this.theme = null;
        this.want = null;
        this.voiceSrc = null;
        this.voiceId = null;
        this.onVoiceEnd = null;
        this.musicDuck = 1;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.connect(comp);
        this.applyVolumes();
        for (const n of SFX) this.fetchClip('sfx-' + n);
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
    applyVolumes() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
        this.voice.gain.setTargetAtTime(this.vol.voice * 1.1, t, 0.03);
        this.music.gain.setTargetAtTime(this.vol.music * 0.55 * this.musicDuck, t, 0.15);
    }

    fetchClip(name) {
        if (this.buffers[name] || this.loading[name] || !this.ctx) return this.loading[name] || Promise.resolve(this.buffers[name]);
        this.loading[name] = fetch(`audio/${name}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b))
            .then((buf) => { this.buffers[name] = buf; return buf; })
            .catch(() => null)
            .finally(() => { delete this.loading[name]; });
        return this.loading[name];
    }

    clip(name, { vol = 1, rate = 1 } = {}) {
        if (!this.ok || !this.buffers[name]) return false;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = this.buffers[name];
        s.playbackRate.value = rate;
        g.gain.value = vol;
        s.connect(g); g.connect(this.sfx);
        s.start();
        return true;
    }

    // ------------------------------------------------------------------ voices
    /** Speak a line; calls back when it ends (or right away if the clip can't play). */
    say(id, onEnd) {
        this.stopVoice();
        this.voiceId = id;
        this.onVoiceEnd = onEnd || null;
        if (!this.ctx || this.vol.voice <= 0) { this.endVoice(id); return; }
        const name = clipName(id);
        this.fetchClip(name).then((buf) => {
            if (this.voiceId !== id) return;                  // a newer line has started
            if (!buf || !this.ok) { this.endVoice(id); return; }
            const s = this.ctx.createBufferSource();
            s.buffer = buf;
            s.connect(this.voice);
            s.onended = () => { if (this.voiceSrc === s) { this.voiceSrc = null; this.endVoice(id); } };
            this.voiceSrc = s;
            this.duck(true);
            s.start();
        });
    }
    endVoice(id) {
        if (this.voiceId !== id) return;
        this.duck(false);
        const f = this.onVoiceEnd; this.onVoiceEnd = null;
        if (f) f(id);
    }
    stopVoice() {
        if (this.voiceSrc) { try { this.voiceSrc.onended = null; this.voiceSrc.stop(); } catch { /* already stopped */ } }
        this.voiceSrc = null;
        this.voiceId = null;
        this.onVoiceEnd = null;
        this.duck(false);
    }
    get speaking() { return !!this.voiceSrc; }
    /** Warm the next lines so they start without a gap. */
    prefetch(ids) { if (this.ctx) for (const id of ids) this.fetchClip(clipName(id)); }
    duck(on) { this.musicDuck = on ? 0.45 : 1; this.applyVolumes(); }

    // ------------------------------------------------------------------ music
    play(theme) {
        if (!this.ctx) { this.want = theme; return; }
        if (this.theme === theme) return;
        const old = this.tracks[this.theme];
        this.theme = theme;
        if (old) this.fade(old, 0, 1.2, () => old.el.pause());
        if (!theme) return;
        let tr = this.tracks[theme];
        if (!tr) {
            const el = new window.Audio(`audio/music-${theme}.mp3`);
            el.loop = true;
            el.preload = 'auto';
            const src = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain();
            g.gain.value = 0;
            src.connect(g); g.connect(this.music);
            tr = this.tracks[theme] = { el, g };
            el.addEventListener('error', () => { tr.failed = true; });
        }
        tr.el.currentTime = 0;
        tr.el.play().catch(() => { tr.failed = true; });
        this.fade(tr, 1, 1.2);
    }
    fade(tr, to, sec, then) {
        const t = this.ctx.currentTime;
        tr.g.gain.cancelScheduledValues(t);
        tr.g.gain.setValueAtTime(tr.g.gain.value, t);
        tr.g.gain.linearRampToValueAtTime(to, t + sec);
        if (then) setTimeout(then, sec * 1000 + 50);
    }
    /** Is the current theme actually playing (for the browser test)? */
    musicPlaying() { const tr = this.tracks[this.theme]; return !!(tr && !tr.el.paused && !tr.failed); }

    // ------------------------------------------------------------------ synth
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.15, delay = 0 } = {}) {
        if (!this.ok) return;
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
    sfxOr(name, fallback, opts) { if (!this.clip(name, opts)) fallback(); }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'step') this.tone({ freq: 140, to: 90, dur: 0.05, type: 'square', vol: 0.03 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'room': case 'door': this.sfxOr('sfx-door', () => this.tone({ freq: 300, to: 900, dur: 0.18, type: 'sawtooth', vol: 0.06 }), { vol: 0.7 }); break;
                case 'dock': this.sfxOr('sfx-dock', () => this.tone({ freq: 120, to: 60, dur: 0.3, vol: 0.12 }), { vol: 0.8 }); break;
                case 'break': this.sfxOr('sfx-spark', () => this.tone({ freq: 1800, to: 200, dur: 0.2, type: 'sawtooth', vol: 0.08 })); break;
                case 'fixed': this.sfxOr('sfx-fixed', () => [523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', delay: i * 0.1 }))); break;
                case 'spook':
                    if (e.kind === 'flicker') this.sfxOr('sfx-flicker', () => this.tone({ freq: 60, dur: 0.6, type: 'sawtooth', vol: 0.05 }));
                    else this.sfxOr('sfx-ghost', () => this.tone({ freq: 300, to: 200, dur: 1.2, type: 'sine', vol: 0.1 }), { vol: 0.8, rate: e.kind === 'moan' ? 0.9 : 1 });
                    break;
                case 'clue': this.sfxOr('sfx-clue', () => [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.15, type: 'triangle', delay: i * 0.06 }))); break;
                case 'sticker': this.sfxOr('sfx-sticker', () => this.tone({ freq: 1200, to: 1800, dur: 0.12, type: 'triangle' }), { vol: 0.6 }); break;
                case 'item': this.sfxOr('sfx-clue', () => this.tone({ freq: 660, to: 1320, dur: 0.2, type: 'triangle' })); break;
                case 'wrong': this.sfxOr('sfx-wrong', () => this.tone({ freq: 300, to: 180, dur: 0.25, type: 'triangle', vol: 0.12 }), { vol: 0.8 }); break;
                case 'right': this.sfxOr('sfx-right', () => [659, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', delay: i * 0.1 }))); break;
                case 'hint': this.sfxOr('sfx-beep', () => this.tone({ freq: 1000, to: 1400, dur: 0.08 }), { vol: 0.5 }); break;
                case 'cookie': this.sfxOr('sfx-munch', () => this.tone({ freq: 200, dur: 0.1, type: 'square', vol: 0.05 })); break;
                case 'signal': this.sfxOr('sfx-signal', () => [440, 660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.2, delay: i * 0.12 }))); break;
                case 'mama': this.sfxOr('sfx-whale', () => this.tone({ freq: 110, to: 220, dur: 2.5, type: 'sine', vol: 0.15 })); break;
                case 'hum': [392, 330, 392, 440].forEach((f, i) => this.tone({ freq: f, dur: 0.45, type: 'sine', vol: 0.08, delay: i * 0.4 })); break;
                case 'pz': this.puzzleSound(G, e); break;
                default: break;
            }
        }
    }

    puzzleSound(G, e) {
        const song = G.puzzle?.kind === 'song';
        const notes = song ? SONG_NOTES : FUSE_NOTES;
        switch (e.what) {
            case 'show': case 'note': this.tone({ freq: notes[e.i], dur: 0.38, type: song ? 'sine' : 'triangle', vol: 0.18 }); break;
            case 'link': case 'place': case 'in': this.tone({ freq: 660, to: 990, dur: 0.1, type: 'triangle', vol: 0.12 }); break;
            case 'out': this.tone({ freq: 500, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }); break;
            case 'select': this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.1 }); break;
            case 'zap': this.sfxOr('sfx-spark', () => this.tone({ freq: 1500, to: 200, dur: 0.15, type: 'sawtooth', vol: 0.08 }), { vol: 0.6 }); break;
            case 'nope': case 'oops': case 'toomuch': this.sfxOr('sfx-wrong', () => this.tone({ freq: 300, to: 180, dur: 0.2, type: 'triangle', vol: 0.1 }), { vol: 0.6 }); break;
            case 'round': [784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', delay: i * 0.08 })); break;
            default: break;
        }
    }
}

export { MUSIC };
