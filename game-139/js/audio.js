// Sound. Effects, voices and music are ElevenLabs recordings (audio/, listed in media.js). Effects and voices are
// decoded into AudioBuffers; music plays through <audio> elements routed into a gain node, so ../lib/page-audio.js
// still silences a hidden tab. Anything that fails to load falls back to a little Web Audio synth (effects) or
// silence (music, voices): never an error.

import { SFX, MUSIC, VOICES, ROOT } from './media.js';

const SYNTH = {
    flip: [{ freq: 1200, to: 700, dur: 0.05, type: 'triangle', vol: 0.08 }],
    deal: [{ freq: 600, to: 900, dur: 0.05, type: 'triangle', vol: 0.06 }],
    settle: [{ freq: 520, dur: 0.08, type: 'triangle' }, { freq: 1040, dur: 0.14, type: 'sine', delay: 0.06 }],
    cut: [{ freq: 2400, to: 500, dur: 0.12, type: 'sawtooth', vol: 0.08 }],
    hit: [{ freq: 140, to: 50, dur: 0.25, type: 'sine', vol: 0.3 }],
    block: [{ freq: 220, to: 160, dur: 0.12, type: 'square', vol: 0.08 }],
    heal: [{ freq: 520, to: 780, dur: 0.25, type: 'sine', vol: 0.1 }],
    coins: [{ freq: 1800, dur: 0.05, type: 'square', vol: 0.05 }, { freq: 2400, dur: 0.08, type: 'square', vol: 0.05, delay: 0.05 }],
    shuffle: [{ freq: 300, to: 900, dur: 0.3, type: 'sawtooth', vol: 0.04 }],
    lock: [{ freq: 300, to: 180, dur: 0.08, type: 'square', vol: 0.08 }],
    grudge: [{ freq: 110, to: 90, dur: 0.8, type: 'sine', vol: 0.15 }],
    cleared: [523, 659, 784, 1046].map((f, i) => ({ freq: f, dur: 0.22, type: 'triangle', delay: i * 0.1 })),
    defeat: [{ freq: 440, to: 110, dur: 1.2, type: 'sawtooth', vol: 0.08 }],
    door: [{ freq: 1500, dur: 0.3, type: 'sine', vol: 0.08 }, { freq: 1900, dur: 0.3, type: 'sine', vol: 0.06, delay: 0.12 }],
    pour: [{ freq: 900, to: 200, dur: 0.4, type: 'sine', vol: 0.08 }],
    build: [{ freq: 200, dur: 0.06, type: 'square', vol: 0.1 }, { freq: 200, dur: 0.06, type: 'square', vol: 0.1, delay: 0.15 }],
    click: [{ freq: 900, dur: 0.04, type: 'triangle', vol: 0.08 }],
    nope: [{ freq: 220, to: 160, dur: 0.12, type: 'square', vol: 0.06 }],
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5; this.voiceVol = 0.9;
        this.narrator = true;
        this.buffers = {};
        this.voices = {};
        this.music = { el: null, which: null, want: null };
        this.last = {};
        this.voice = { src: null, queue: [] };
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
        this.meter = ctx.createAnalyser(); this.meter.fftSize = 256; comp.connect(this.meter);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol * 0.8; this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.5; this.mus.connect(comp);
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
        if (this.music.want) { const w = this.music.want; this.music.which = null; this.playMusic(w); }
    }

    setVolumes(sfx, music, voice, narrator = this.narrator) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice; this.narrator = narrator;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx * 0.8, t, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.5, t, 0.05);
        this.vox.gain.setTargetAtTime(voice, t, 0.02);
    }
    running() { return !!(this.ctx && this.ctx.state === 'running'); }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0 } = {}) {
        if (!this.running()) return;
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

    /** An effect: the recording if it loaded, else the synth. gap: the same clip again within it is dropped. */
    play(name, { rate = 1, vol = 1, delay = 0, gap = 0.05 } = {}) {
        if (!this.running()) return;
        const now = this.ctx.currentTime;
        if (!delay && this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const b = this.buffers[name];
        if (!b) { for (const t of SYNTH[name] || []) this.tone({ ...t, delay: (t.delay || 0) + delay, freq: t.freq * rate, to: (t.to || t.freq) * rate }); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = b; src.playbackRate.value = rate;
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(now + delay);
    }
    ui(kind) { this.play(kind === 'click' ? 'click' : kind, { vol: 0.6 }); }

    /** A voice line. One at a time; at most one waits its turn (no chatter). force cuts the current line. */
    say(name, { force = false } = {}) {
        if (!this.running() || !this.voices[name]) return false;
        if (name.startsWith('narrator-') && !this.narrator) return false;
        if (this.voice.src) {
            if (force) this.shutUp();
            else { if (this.voice.queue.length < 1) this.voice.queue.push(name); return true; }
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.voices[name];
        src.connect(this.vox);
        src.onended = () => { if (this.voice.src === src) { this.voice.src = null; const n = this.voice.queue.shift(); if (n) this.say(n); else this.duck(false); } };
        src.start();
        this.voice.src = src;
        this.duck(true);
        return true;
    }
    duck(on) { if (this.ctx) this.mus.gain.setTargetAtTime(this.musicVol * (on ? 0.18 : 0.5), this.ctx.currentTime, on ? 0.1 : 0.4); }
    shutUp() { if (this.voice.src) { try { this.voice.src.stop(); } catch { /* */ } } this.voice.src = null; this.voice.queue.length = 0; this.duck(false); }
    talking() { return !!this.voice.src; }

    /** 'day', 'night', 'boss', 'ending' or null. */
    playMusic(which) {
        this.music.want = which;
        if (!this.ctx || this.music.which === which) return;
        this.music.which = which;
        const old = this.music.el;
        if (old) this.fadeOut(old);
        this.music.el = null;
        if (!which) return;
        const el = new window.Audio();
        el.src = ROOT + MUSIC[which];
        el.loop = true;
        el.crossOrigin = 'anonymous';
        try {
            const node = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain();
            g.gain.value = 0.0001;
            g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.6);
            node.connect(g); g.connect(this.mus);
            el._g = g;
        } catch { /* already routed */ }
        el.addEventListener('error', () => { if (this.music.el === el) this.music.el = null; });
        el.play().catch(() => { /* a later gesture resumes it */ });
        this.music.el = el;
    }
    fadeOut(el) {
        if (el._g && this.ctx) el._g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5);
        setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); }, 1800);
    }
    /** Is a tune actually playing? (for the tests) */
    playing() { return !!(this.music.el && !this.music.el.paused); }
    /** Peak level on the master bus, 0..1 (for the tests). */
    level() {
        if (!this.meter) return 0;
        const a = new Uint8Array(this.meter.fftSize);
        this.meter.getByteTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v - 128));
        return m / 128;
    }

    onEvents(G, events) {
        let k = 0;
        for (const e of events) {
            switch (e.type) {
                case 'settle': this.play(e.how === 'cut' ? 'cut' : 'settle', { rate: 0.94 + Math.min(e.streak, 8) * 0.03, delay: Math.min(k++, 4) * 0.04 }); break;
                case 'flip': this.play('flip', { vol: 0.6, gap: 0.08 }); break;
                case 'draw': this.play('deal', { vol: 0.5, gap: 0.07 }); break;
                case 'reshuffle': this.play('shuffle', { vol: 0.8 }); break;
                case 'hurt': this.play(e.why === 'hit' ? 'hit' : 'grudge', { vol: e.why === 'hit' ? 1 : 0.5 }); break;
                case 'block': this.play('block'); break;
                case 'heal': this.play('heal', { vol: 0.6, gap: 0.3 }); break;
                case 'tips': if (e.n >= 3) this.play('coins', { vol: 0.5, gap: 0.2 }); break;
                case 'lock': this.play('lock', { gap: 0.1 }); break;
                case 'grudge': this.play('grudge'); break;
                case 'cleared': this.play('cleared'); break;
                case 'over': this.play('defeat'); this.shutUp(); this.playMusic(null); this.say('narrator-over'); break;
                case 'pour': this.play('pour'); break;
                case 'built': case 'polish': this.play('build'); break;
                case 'bought': this.play('coins'); break;
                case 'nope': this.play('nope', { vol: 0.5, gap: 0.2 }); break;
                case 'blade': if (e.first) this.say('narrator-blade'); break;
                case 'partner': this.say(`${e.rival}-accept`, { force: true }); break;
                case 'farewell': if (e.refused) this.say('narrator-refuse', { force: true }); break;
                case 'act': this.say(`narrator-act${e.act}`, { force: true }); break;
                case 'ending': this.shutUp(); this.playMusic('ending'); this.say(`narrator-${e.ending}`); break;
            }
        }
    }
}
