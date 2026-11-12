// Sound: ElevenLabs music and effects (audio/*.mp3, listed in js/audio-files.js), with a Web Audio synth for anything
// missing. Music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js still silences a
// hidden tab; effects are decoded into buffers on first use. The context is made on the first user gesture.

import { AUDIO_FILES } from './audio-files.js';

const TRACK = { town: 'music-town', act1: 'music-act1', act2: 'music-act2', act3: 'music-act3', boss: 'music-boss', rift: 'music-act3' };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5;
        this.buffers = {}; this.loading = {};
        this.music = {}; this.theme = null; this.wantTheme = null;
        this.last = {};               // effect name → last time played (rate limit)
        this.peak = 0;
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
        if (this.wantTheme) this.setTheme(this.wantTheme);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.6, this.ctx.currentTime, 0.02);
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

    /** Crossfade to a theme ('town', 'act1', 'act2', 'act3', 'boss', 'rift'). */
    setTheme(theme) {
        this.wantTheme = theme;
        if (!this.ctx || this.theme === theme) return;
        this.theme = theme;
        const name = TRACK[theme];
        for (const [k, m] of Object.entries(this.music)) if (k !== name) { m.target = 0; m.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8); }
        if (!name || !AUDIO_FILES.has(name)) return;
        let m = this.music[name];
        if (!m) {
            const el = new window.Audio(`audio/${name}.mp3`);
            el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto';
            const src = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain(); g.gain.value = 0;
            src.connect(g); g.connect(this.mus);
            m = this.music[name] = { el, g, target: 1 };
        }
        m.target = 1;
        m.g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8);
        m.el.play().catch(() => { /* autoplay blocked until a gesture: init() retries */ });
    }

    async load(name) {
        if (this.buffers[name] || this.loading[name] || !AUDIO_FILES.has(name) || !this.ctx) return;
        this.loading[name] = true;
        try {
            const r = await fetch(`audio/${name}.mp3`);
            this.buffers[name] = await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch { /* falls back to the synth */ }
    }

    /** Play an effect clip, or its synth stand-in. gap: minimum seconds between two of the same. */
    play(name, { vol = 1, rate = 1, gap = 0.05 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (now - (this.last[name] || -9) < gap) return;
        this.last[name] = now;
        const buf = this.buffers[name];
        if (!buf) { this.load(name); this.synth(name, vol); return; }
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = buf; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
        g.gain.value = vol;
        s.connect(g); g.connect(this.sfx); s.start();
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.15, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
    }

    synth(name, vol = 1) {
        const v = 0.12 * vol;
        const S = {
            'sfx-swing': () => this.tone({ freq: 600, to: 200, dur: 0.12, type: 'triangle', vol: v }),
            'sfx-hit': () => this.tone({ freq: 160, to: 60, dur: 0.1, type: 'square', vol: v }),
            'sfx-zap': () => this.tone({ freq: 1800, to: 400, dur: 0.1, type: 'sawtooth', vol: v }),
            'sfx-thunder': () => this.tone({ freq: 120, to: 40, dur: 0.6, type: 'sawtooth', vol: v * 1.5 }),
            'sfx-shadow': () => this.tone({ freq: 300, to: 90, dur: 0.3, type: 'sine', vol: v }),
            'sfx-slam': () => this.tone({ freq: 90, to: 30, dur: 0.5, type: 'square', vol: v * 1.5 }),
            'sfx-gold': () => [1320, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.08, type: 'triangle', vol: v, delay: i * 0.05 })),
            'sfx-legendary': () => [523, 784, 1047, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: v, delay: i * 0.1 })),
            'sfx-levelup': () => [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: v, delay: i * 0.08 })),
            'sfx-portal': () => this.tone({ freq: 200, to: 800, dur: 0.6, type: 'sine', vol: v }),
            'sfx-potion': () => this.tone({ freq: 400, to: 900, dur: 0.3, type: 'sine', vol: v }),
        };
        (S[name] || (() => this.tone({ freq: 300, to: 150, dur: 0.08, type: 'triangle', vol: v * 0.6 })))();
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 700, dur: 0.04, type: 'triangle', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.07, type: 'triangle', vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.07, type: 'triangle', vol: 0.08 });
        else if (kind === 'deny') this.tone({ freq: 180, to: 120, dur: 0.12, type: 'square', vol: 0.06 });
    }

    /** Answer the sim's events. */
    onEvents(G, events) {
        if (!this.ctx) return;
        const P = G.player;
        for (const e of events) {
            switch (e.type) {
                case 'cast': {
                    const s = { cleave: 'sfx-swing', leap: null, warcry: 'sfx-warcry', spark: 'sfx-zap', chain: 'sfx-zap', thunderstrike: null, stormshield: 'sfx-zap', tempest: 'sfx-thunder', soulrend: 'sfx-shadow', bonespear: 'sfx-shadow', shadowstep: 'sfx-shadow', shade: 'sfx-shadow', frailty: 'sfx-shadow', harvest: 'sfx-shadow', wrath: 'sfx-slam', whirlwind: 'sfx-swing' }[e.skill];
                    if (s) this.play(s, { vol: 0.7, gap: 0.08 });
                    break;
                }
                case 'hit': if (e.src === 'player') this.play(e.el === 'lightning' ? 'sfx-zap' : 'sfx-hit', { vol: e.crit ? 0.8 : 0.45, gap: 0.06 }); break;
                case 'leap': case 'nova': this.play('sfx-slam', { vol: 0.8, gap: 0.15 }); break;
                case 'zone': if (e.kind === 'thunderstrike') this.play('sfx-thunder', { vol: 0.9, gap: 0.1 }); else if (e.from === 'mon') this.play('sfx-slam', { vol: 0.6, gap: 0.2 }); break;
                case 'bolt': this.play('sfx-thunder', { vol: 0.5, gap: 0.2 }); break;
                case 'kill': this.play(e.boss ? 'sfx-roar' : 'sfx-death-mon', { vol: e.boss ? 1 : 0.35, gap: 0.12 }); break;
                case 'drop': if (e.rarity === 'legendary' || e.rarity === 'mythic' || e.rarity === 'set') this.play('sfx-legendary', { vol: 1, gap: 0.3 }); break;
                case 'gold': this.play('sfx-gold', { vol: 0.5, gap: 0.08 }); break;
                case 'potion': this.play('sfx-potion', { vol: 0.8 }); break;
                case 'levelup': case 'ascend': this.play('sfx-levelup', { vol: 1 }); break;
                case 'portal': case 'area': this.play('sfx-portal', { vol: 0.6, gap: 0.5 }); break;
                case 'waystone': this.play('sfx-portal', { vol: 0.5 }); break;
                case 'bossPhase': case 'aggro': if (e.boss) this.play('sfx-roar', { vol: 1, gap: 2 }); break;
                case 'petSpell': if (e.spell === 'howl') this.play('sfx-roar', { vol: 0.3, rate: 1.6, gap: 1 }); break;
                case 'hurt': if (e.amt > P.stats.maxLife * 0.08) this.play('sfx-hit', { vol: 0.6, rate: 0.7, gap: 0.2 }); break;
                case 'death': this.play('sfx-roar', { vol: 0.6, rate: 0.6 }); break;
                case 'denied': this.ui('deny'); break;
                case 'pickup': case 'equip': this.ui('click'); break;
            }
        }
    }
}
