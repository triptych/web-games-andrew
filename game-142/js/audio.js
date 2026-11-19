// Sound. Effects and voices are ElevenLabs clips decoded into AudioBuffers; music plays through
// <audio> elements routed into the music gain (so ../lib/page-audio.js still silences a hidden tab).
// Anything that fails to load falls back to a small Web Audio synth, so the game is never silent.
// The context is made on the first user gesture (browsers block audio before one).

import { MUSIC, SFX, VOICES } from './media.js';

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6; this.voiceVol = 0.9;
        this.buf = {};                // name → AudioBuffer
        this.last = {};               // name → ctx time last played (rate limit)
        this.music = {};              // theme → { el, gain }
        this.theme = null;
        this.voiceUntil = 0;
        this.loaded = 0;
        this.failed = [];
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.55; this.mus.connect(comp);
        this.loadAll();
        if (this.wantTheme) this.playMusic(this.wantTheme);
    }

    async loadOne(name, url) {
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error(r.status);
            const data = await r.arrayBuffer();
            this.buf[name] = await new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej));
            this.loaded++;
        } catch (err) { this.failed.push(name); }
    }

    loadAll() {
        for (const s of SFX) this.loadOne(s, `audio/sfx-${s}.mp3`);
        for (const [who, lines] of Object.entries(VOICES)) for (const l of lines) this.loadOne(`${who}-${l}`, `audio/vo-${who}-${l}.mp3`);
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.55, t, 0.02);
        this.voice.gain.setTargetAtTime(voice, t, 0.02);
    }

    ok() { return this.ctx && this.ctx.state === 'running'; }

    /** Play an effect: the clip if it loaded, else the synth. gap: the same effect at most this often. */
    play(name, { vol = 1, rate = 1, gap = 0.06, delay = 0 } = {}) {
        if (!this.ok()) return;
        const now = this.ctx.currentTime;
        if (now - (this.last[name] || -9) < gap) return;
        this.last[name] = now;
        const b = this.buf[name];
        if (!b) { this.synth(name, vol, delay); return; }
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.playbackRate.value = rate;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(now + delay);
    }

    /** One voice at a time; a line that would talk over another is dropped. */
    say(who, line, chance = 1) {
        if (!this.ok() || Math.random() > chance) return false;
        const now = this.ctx.currentTime;
        if (now < this.voiceUntil) return false;
        const lines = VOICES[who];
        if (!lines) return false;
        const l = line || lines[Math.floor(Math.random() * lines.length)];
        const b = this.buf[`${who}-${l}`];
        if (!b) return false;
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.voice);
        src.start();
        this.voiceUntil = now + b.duration + 0.3;
        // duck the music under speech
        this.mus.gain.setTargetAtTime(this.musicVol * 0.25, now, 0.05);
        this.mus.gain.setTargetAtTime(this.musicVol * 0.55, now + b.duration, 0.3);
        return true;
    }

    playMusic(theme) {
        this.wantTheme = theme;
        if (!this.ctx || this.theme === theme) return;
        const t = this.ctx.currentTime;
        if (this.theme && this.music[this.theme]) {
            const old = this.music[this.theme];
            old.gain.gain.setTargetAtTime(0, t, 0.25);
            setTimeout(() => { if (this.theme !== old.theme) old.el.pause(); }, 1200);
        }
        this.theme = theme;
        if (!theme) return;
        let m = this.music[theme];
        if (!m) {
            const el = new window.Audio(`audio/music-${theme}.mp3`);
            el.loop = theme === 'title' || theme === 'play';
            el.preload = 'auto';
            const gain = this.ctx.createGain();
            try { this.ctx.createMediaElementSource(el).connect(gain); } catch { /* already routed */ }
            gain.connect(this.mus);
            m = this.music[theme] = { el, gain, theme };
        }
        m.gain.gain.cancelScheduledValues(t);
        m.gain.gain.setValueAtTime(0, t);
        m.gain.gain.setTargetAtTime(1, t, 0.3);
        m.el.currentTime = 0;
        m.el.play().catch(() => { /* not allowed yet or no file: silence */ });
    }

    // ------------------------------------------------------------------ synth fallbacks
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ok()) return;
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
    noise(dur, vol, cutoff = 1200, delay = 0) {
        if (!this.ok()) return;
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * dur);
        const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = ctx.createBufferSource(); s.buffer = b;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
        const g = ctx.createGain(); g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(ctx.currentTime + delay);
    }
    synth(name, vol, delay) {
        const v = vol * 0.6;
        if (name === 'cannon' || name === 'boom') { this.tone({ freq: 120, to: 40, dur: 0.4, type: 'sine', vol: v, delay }); this.noise(0.5, v, 900, delay); }
        else if (name === 'pop') this.noise(0.25, v, 3000, delay);
        else if (name === 'stone' || name === 'roof' || name === 'collapse') this.noise(0.3, v * 0.7, 700, delay);
        else if (name === 'wood') { this.noise(0.15, v * 0.6, 2200, delay); this.tone({ freq: 300, to: 180, dur: 0.1, type: 'triangle', vol: v * 0.4, delay }); }
        else if (name === 'ice') [1800, 2400, 3100].forEach((f, i) => this.tone({ freq: f, dur: 0.15, type: 'triangle', vol: v * 0.3, delay: delay + i * 0.04 }));
        else if (name === 'bonk' || name === 'boing') this.tone({ freq: 500, to: 900, dur: 0.18, type: 'square', vol: v * 0.4, delay });
        else if (name === 'star') this.tone({ freq: 1320, to: 1760, dur: 0.25, type: 'triangle', vol: v * 0.4, delay });
        else if (name === 'poof' || name === 'split' || name === 'whistle') this.tone({ freq: 900, to: 300, dur: 0.25, type: 'sine', vol: v * 0.3, delay });
        else if (name === 'thud') this.tone({ freq: 90, to: 45, dur: 0.2, type: 'sine', vol: v, delay });
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'select') this.tone({ freq: 520, to: 780, dur: 0.07, type: 'triangle', vol: 0.12 });
    }

    // ------------------------------------------------------------------ sim events
    onEvents(G, events) {
        let breaks = 0;
        for (const e of events) {
            switch (e.type) {
                case 'fire':
                    this.play('cannon', { vol: 1, rate: e.ammo === 'bertha' ? 0.8 : 1 });
                    this.play('whistle', { vol: 0.35, delay: 0.45, gap: 0.5 });
                    if (G.shots === 1) this.say('pip', 'kaboom', 0.6); else this.say('knight', Math.random() < 0.5 ? 'incoming' : 'uhoh', 0.3);
                    break;
                case 'impact':
                    if (e.ammo === 'boing') this.play('boing', { vol: 0.9 });
                    else if (e.mat === 'ground') this.play('thud', { vol: 0.9 });
                    break;
                case 'hit':
                    if (e.speed > 5) this.play(e.mat === 'wood' ? 'wood' : e.mat === 'ice' ? 'ice' : 'stone', { vol: Math.min(0.45, e.speed / 30), rate: 1.25 + Math.random() * 0.2, gap: 0.09 });
                    break;
                case 'break':
                    breaks++;
                    if (e.mat === 'tnt') this.play('pop', { vol: 0.8 });
                    else this.play(e.mat === 'wood' ? 'wood' : e.mat === 'ice' ? 'ice' : e.mat === 'roof' ? 'roof' : 'stone', { vol: 0.75, rate: 0.9 + Math.random() * 0.25, gap: 0.08 });
                    break;
                case 'boom':
                    this.play('boom', { vol: e.src === 'tnt' ? 0.8 : 1, rate: e.src === 'tnt' ? 1.15 : 1, gap: 0.12 });
                    break;
                case 'bonk':
                    this.play('bonk', { vol: 0.9, rate: e.role === 'king' ? 0.85 : 1, gap: 0.1 });
                    this.say(e.role, null, e.role === 'knight' ? 0.55 : 0.9);
                    break;
                case 'poof': this.play('poof', { vol: 0.6, gap: 0.1 }); break;
                case 'split': this.play('split', { vol: 0.8 }); break;
                case 'select': if (!e.auto) this.ui('select'); break;
                case 'allbonked': setTimeout(() => this.say('pip', Math.random() < 0.5 ? 'bullseye' : 'smash'), 500); break;
                case 'over':
                    this.playMusic(null);
                    setTimeout(() => {
                        this.playMusic(e.won ? 'win' : 'lose');
                        setTimeout(() => this.say('pip', e.won ? 'cleared' : 'outofballs'), e.won ? 1200 : 600);
                    }, 300);
                    break;
            }
        }
        if (breaks >= 5) this.play('collapse', { vol: 0.8, gap: 2.5 });
    }
}
