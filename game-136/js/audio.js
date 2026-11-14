// Sound. Effects and music are ElevenLabs recordings (audio/, listed in media.js); each effect is
// decoded into an AudioBuffer, the music plays through <audio> elements routed into a gain node so
// ../lib/page-audio.js still silences a hidden tab. Anything that fails to load falls back to a
// little Web Audio synth, so the game is never silent and never throws.

import { SFX, MUSIC, ROOT } from './media.js';

const SYNTH = {
    craft: [{ freq: 300, to: 520, dur: 0.12, type: 'sine' }, { freq: 520, to: 700, dur: 0.1, type: 'sine', delay: 0.12 }],
    squish: [{ freq: 220, to: 90, dur: 0.22, type: 'triangle' }],
    plop: [{ freq: 180, to: 90, dur: 0.12, type: 'sine', vol: 0.3 }],
    lift: [{ freq: 300, to: 520, dur: 0.08, type: 'sine' }],
    rotate: [{ freq: 500, to: 380, dur: 0.08, type: 'triangle' }],
    stow: [{ freq: 260, to: 140, dur: 0.12, type: 'triangle' }],
    undo: [{ freq: 700, to: 300, dur: 0.15, type: 'sine' }],
    nope: [{ freq: 160, to: 120, dur: 0.18, type: 'square', vol: 0.08 }],
    click: [{ freq: 820, dur: 0.04, type: 'triangle', vol: 0.12 }],
    open: [{ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.1 }],
    shutter: [{ freq: 1800, to: 900, dur: 0.05, type: 'square', vol: 0.08 }, { freq: 400, to: 200, dur: 0.15, type: 'sawtooth', vol: 0.05, delay: 0.06 }],
    star: [{ freq: 1320, dur: 0.35, type: 'sine' }],
    goal: [{ freq: 784, dur: 0.1, type: 'triangle' }, { freq: 1046, dur: 0.18, type: 'triangle', delay: 0.1 }],
    fanfare: [523, 659, 784, 1046].map((f, i) => ({ freq: f, dur: 0.3, type: 'triangle', delay: i * 0.12 })),
    cheer: [{ freq: 880, dur: 0.2, type: 'triangle', delay: 0 }],
    unlock: [{ freq: 1175, dur: 0.15, type: 'sine' }, { freq: 1568, dur: 0.25, type: 'sine', delay: 0.12 }],
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.buffers = {};
        this.music = { el: null, which: null, want: null, i: 0 };
        this.fire = null;
        this.last = {};
    }

    /** Made on the first user gesture (browsers block audio before one). */
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        this.master = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol * 0.55; this.mus.connect(comp);
        this.loading = Promise.all(SFX.map((n) => fetch(`${ROOT}audio/sfx-${n}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((a) => ctx.decodeAudioData(a))
            .then((b) => { this.buffers[n] = b; })
            .catch(() => { /* the synth stands in */ })));
        if (this.music.want) this.playMusic(this.music.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.mus.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.18, delay = 0 } = {}) {
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

    /** Play an effect: the recording if it loaded, else the synth. rate pitches it (stars climb). */
    play(name, { rate = 1, vol = 1, delay = 0, gap = 0.05 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (!delay && this.last[name] && now - this.last[name] < gap) return;   // the same clip twice in a frame is one
        this.last[name] = now;
        const b = this.buffers[name];
        if (!b) { for (const t of SYNTH[name] || []) this.tone({ ...t, delay: (t.delay || 0) + delay, freq: t.freq * rate, to: (t.to || t.freq) * rate }); return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = b; src.playbackRate.value = rate;
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(now + delay);
    }

    ui(kind) { this.play(kind === 'click' ? 'click' : 'open', { vol: 0.7 }); }

    /** A crackle under the room while a fire is lit. */
    setFire(on) {
        if (!this.ctx) return;
        if (on && !this.fire && this.buffers.fire) {
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = this.buffers.fire; src.loop = true;
            g.gain.value = 0.0001; g.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.4);
            src.connect(g); g.connect(this.sfx); src.start();
            this.fire = { src, g };
        } else if (!on && this.fire) {
            const f = this.fire; this.fire = null;
            f.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
            setTimeout(() => { try { f.src.stop(); } catch { /* */ } }, 800);
        }
    }

    /** 'title', 'build' or null. The two building tunes take turns. */
    playMusic(which) {
        this.music.want = which;
        if (!this.ctx || this.music.which === which) return;
        this.music.which = which;
        const old = this.music.el;
        if (old) this.fadeOut(old);
        this.music.el = null;
        if (!which) return;
        const src = which === 'title' ? MUSIC.title : MUSIC.build[this.music.i++ % MUSIC.build.length];
        const el = new window.Audio();
        el.src = ROOT + src;
        el.loop = which === 'title';
        el.crossOrigin = 'anonymous';
        try {
            const node = this.ctx.createMediaElementSource(el);
            const g = this.ctx.createGain();
            g.gain.value = 0.0001;
            g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.6);
            node.connect(g); g.connect(this.mus);
            el._g = g;
        } catch { /* already routed */ }
        if (which === 'build') el.addEventListener('ended', () => { if (this.music.el === el) { this.music.which = null; this.playMusic('build'); } });
        el.addEventListener('error', () => { if (this.music.el === el) this.music.el = null; });
        el.play().catch(() => { /* a later gesture resumes it */ });
        this.music.el = el;
    }
    fadeOut(el) {
        if (el._g && this.ctx) el._g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
        setTimeout(() => { el.pause(); el.src = ''; }, 1500);
    }
    /** Is a tune actually playing? (for the tests) */
    playing() { return !!(this.music.el && !this.music.el.paused); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'craft') this.play('craft');
            else if (e.type === 'place') this.play('plop', { rate: e.layer === 'wall' ? 1.2 : e.layer === 'rug' ? 0.85 : 1 });
            else if (e.type === 'rotate') this.play('rotate');
            else if (e.type === 'stow' && !e.rider) this.play('stow');
            else if (e.type === 'squish') this.play('squish');
            else if (e.type === 'undo') this.play('undo');
            else if (e.type === 'clear') this.play('squish', { rate: 0.8 });
            else if (e.type === 'nope') this.play('nope');
        }
    }
}
