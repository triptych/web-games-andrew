// Sound. Effects, voices and music are ElevenLabs recordings (audio/, listed in media.js). Effects and voices are
// decoded into AudioBuffers; music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js
// still silences a hidden tab, and themes crossfade. Anything that fails to load falls back to a small Web Audio
// synth (effects) or silence (music, voices): never an error.
//
// Juice: every strike is pitched a little at random so a hundred digs never sound the same, breaks in quick
// succession climb in pitch, and coins are throttled so a chest full of gold chimes instead of roaring.

import { SFX, MUSIC, VOICES, ROOT } from './media.js';
import { BLOCKS } from './sim/data/blocks.js';
import { LINES } from './sim/data/story.js';

const SYNTH = {
    'dig-soft': [{ freq: 180, to: 60, dur: 0.08, type: 'triangle', vol: 0.25 }],
    'dig-stone': [{ freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.1 }],
    'dig-crystal': [{ freq: 1800, to: 1600, dur: 0.18, type: 'sine', vol: 0.12 }],
    'break-soft': [{ freq: 220, to: 50, dur: 0.25, type: 'triangle', vol: 0.25 }],
    'break-stone': [{ freq: 160, to: 40, dur: 0.3, type: 'square', vol: 0.15 }],
    'break-crystal': [{ freq: 2200, to: 900, dur: 0.3, type: 'sine', vol: 0.12 }],
    trap: [{ freq: 600, to: 80, dur: 0.35, type: 'sawtooth', vol: 0.15 }],
    monster: [{ freq: 300, to: 120, dur: 0.3, type: 'sawtooth', vol: 0.12 }],
    mhit: [{ freq: 400, to: 120, dur: 0.1, type: 'square', vol: 0.12 }],
    hurt: [{ freq: 140, to: 50, dur: 0.25, type: 'sine', vol: 0.3 }],
    coin: [{ freq: 1800, dur: 0.05, type: 'square', vol: 0.05 }, { freq: 2400, dur: 0.08, type: 'square', vol: 0.05, delay: 0.05 }],
    gem: [{ freq: 1500, to: 2600, dur: 0.2, type: 'sine', vol: 0.1 }],
    artifact: [523, 659, 784, 1046, 1318].map((f, i) => ({ freq: f, dur: 0.3, type: 'triangle', vol: 0.12, delay: i * 0.09 })),
    levelup: [523, 784, 1046].map((f, i) => ({ freq: f, dur: 0.25, type: 'triangle', vol: 0.12, delay: i * 0.08 })),
    rune: [{ freq: 880, dur: 0.4, type: 'sine', vol: 0.1 }],
    solve: [392, 523, 659, 784].map((f, i) => ({ freq: f, dur: 0.3, type: 'triangle', vol: 0.1, delay: i * 0.1 })),
    chest: [{ freq: 300, to: 700, dur: 0.25, type: 'triangle', vol: 0.1 }],
    press: [{ freq: 700, dur: 0.04, type: 'triangle', vol: 0.08 }],
    descend: [{ freq: 600, to: 120, dur: 0.6, type: 'sine', vol: 0.1 }],
    potion: [{ freq: 400, to: 900, dur: 0.3, type: 'sine', vol: 0.1 }],
    disarm: [{ freq: 1200, dur: 0.06, type: 'square', vol: 0.05 }, { freq: 1600, dur: 0.2, type: 'sine', vol: 0.08, delay: 0.08 }],
    mark: [{ freq: 500, to: 700, dur: 0.06, type: 'triangle', vol: 0.08 }],
    deny: [{ freq: 220, to: 160, dur: 0.12, type: 'square', vol: 0.06 }],
    rotate: [{ freq: 200, to: 260, dur: 0.1, type: 'sawtooth', vol: 0.06 }],
    power: [{ freq: 300, to: 1200, dur: 0.6, type: 'sine', vol: 0.1 }],
    blast: [{ freq: 120, to: 30, dur: 0.6, type: 'sawtooth', vol: 0.2 }],
    click: [{ freq: 900, dur: 0.04, type: 'triangle', vol: 0.08 }],
};
const FAMILY_HIT = { soft: 'dig-soft', stone: 'dig-stone', obsidian: 'dig-stone', crystal: 'dig-crystal', puzzle: 'press' };
const FAMILY_BREAK = { soft: 'break-soft', stone: 'break-stone', obsidian: 'break-stone', crystal: 'break-crystal', puzzle: 'break-stone' };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5; this.voiceVol = 0.9;
        this.buffers = {};
        this.voices = {};
        this.tracks = {};
        this.theme = null;
        this.last = {};
        this.combo = 0; this.comboT = 0;
        this.voice = { src: null, until: 0 };
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
    play(name, { rate = 1, vol = 1, gap = 0.03, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
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

    ui(kind) { this.play(kind === 'deny' ? 'deny' : 'click', { vol: 0.7, rate: kind === 'close' ? 0.85 : 1 }); }

    /** A voice line; one at a time, and a new line cuts the old one. */
    say(id) {
        const buf = this.voices[id];
        if (!buf || !this.ctx || this.ctx.state !== 'running' || this.voiceVol <= 0) return 0;
        try { this.voice.src?.stop(); } catch { /* already stopped */ }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.vox);
        src.start();
        this.voice.src = src;
        // duck the music under the voice
        const t = this.ctx.currentTime;
        this.mus.gain.cancelScheduledValues(t);
        this.mus.gain.setTargetAtTime(this.musicVol * 0.18, t, 0.08);
        this.mus.gain.setTargetAtTime(this.musicVol * 0.45, t + buf.duration, 0.4);
        return buf.duration;
    }
    voiceLength(id) { return this.voices[id]?.duration || 0; }

    /** Crossfade to a theme: dig, treasure, camp, ending, or null for silence. */
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

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        const now = this.ctx?.currentTime || 0;
        for (const e of events) {
            switch (e.type) {
                case 'strike': {
                    const fam = BLOCKS[e.b]?.family || 'soft';
                    this.play(FAMILY_HIT[fam], { rate: (e.hyper ? 1.25 : 1) * (0.88 + Math.random() * 0.24) * (fam === 'obsidian' ? 0.8 : 1), gap: 0.02 });
                    if (e.crit) this.play('mhit', { rate: 1.4, vol: 0.6 });
                    break;
                }
                case 'break': {
                    if (now - this.comboT < 0.9) this.combo = Math.min(this.combo + 1, 10); else this.combo = 0;
                    this.comboT = now;
                    const fam = BLOCKS[e.b]?.family || 'soft';
                    this.play(FAMILY_BREAK[fam], { rate: (0.92 + Math.random() * 0.1) * (1 + this.combo * 0.035), gap: 0.04, vol: e.by === 'shock' ? 0.6 : 1 });
                    break;
                }
                case 'shock': this.play('dig-stone', { rate: 0.7, vol: 0.5, gap: 0.05 }); break;
                case 'trap': this.play('trap'); break;
                case 'disarm': this.play('disarm'); break;
                case 'falseAlarm': this.play('deny'); break;
                case 'monster': this.play('monster', { rate: e.id === 'warden' ? 0.7 : 0.95 + Math.random() * 0.15 }); break;
                case 'ambush': case 'mhit': this.play('mhit', { rate: 0.9 + Math.random() * 0.2 }); break;
                case 'mdie': this.play('break-soft', { rate: 1.3 }); break;
                case 'hurt': this.play('hurt', { gap: 0.05 }); break;
                case 'warded': this.play('rune', { rate: 1.5 }); break;
                case 'loot':
                    if (e.kind === 'gem') this.play('gem');
                    else if (e.kind === 'food') this.play('potion', { rate: 1.3, vol: 0.6 });
                    else if (e.kind === 'key' || e.kind === 'potion') this.play('gem', { rate: 0.8 });
                    else this.play('coin', { gap: 0.07, rate: 0.95 + Math.random() * 0.1 });
                    break;
                case 'artifact': this.play('artifact'); break;
                case 'levelup': this.play('levelup', { delay: 0.1 }); break;
                case 'runeLit': this.play('rune', { rate: 0.85 + e.k * 0.12 }); break;
                case 'runeReset': case 'runeFizzle': this.play('deny'); break;
                case 'runeSolved': this.play('solve'); break;
                case 'rot': this.play('rotate', { rate: 0.9 + Math.random() * 0.2 }); break;
                case 'panelOpen': this.play('power'); this.play('solve', { delay: 0.5 }); break;
                case 'press': this.play('press', { rate: 0.9 + e.k * 0.08 }); break;
                case 'chestOpen': this.play('chest'); break;
                case 'clear': this.play('solve', { rate: 1.1 }); break;
                case 'descend': this.play('descend'); break;
                case 'blast': this.play('blast'); break;
                case 'use': if (e.id === 'potion' || e.id === 'tonic') this.play('potion'); else if (e.id !== 'blast') this.play('power', { rate: 1.4, vol: 0.7 }); break;
                case 'dowsed': this.play('rune', { rate: 0.7 }); break;
                case 'mark': this.play('mark', { rate: e.on ? 1 : 0.8 }); break;
                case 'deny': if (e.why !== 'sealed' && e.why !== 'locked') this.play('deny', { gap: 0.15 }); break;
                case 'sealed': case 'locked': this.play('deny'); break;
                case 'unlock': this.play('solve', { rate: 1.3, vol: 0.7 }); break;
                case 'buy': case 'claim': this.play('coin'); break;
                case 'learn': this.play('levelup', { rate: 1.2, vol: 0.6 }); break;
                default: break;
            }
        }
    }
}

export { LINES };
