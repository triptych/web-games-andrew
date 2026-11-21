// VACANCY's sound: all Web Audio, no files. A wind bed outside and a room tone inside, the buzz of the fluorescent
// panels, footsteps that know carpet from tile from puddle, a sparse dark pad, and a sound for every sim event.
// The context is made on the first gesture; ../lib/page-audio.js suspends it while the tab is hidden.

export class Audio {
    constructor() { this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.5; this.nextPad = 6; this.scene = { inside: 0, buzz: 0, ring: 0 }; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.6; this.music.connect(this.master);
        this.amb = ctx.createGain(); this.amb.gain.value = this.sfxVol; this.amb.connect(this.master);
        // a long dark reverb from shaped noise
        this.verb = ctx.createConvolver();
        const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb.buffer = ir;
        this.wet = ctx.createGain(); this.wet.gain.value = 0.35;
        this.verb.connect(this.wet); this.wet.connect(this.master);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.beds();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.05); this.amb.gain.setTargetAtTime(sfx, t, 0.05);
        this.music.gain.setTargetAtTime(music * 0.6, t, 0.05);
    }

    ok() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ beds

    loop(filterType, freq, q, gain, dest = this.amb) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 0.5 + Math.random() * 0.3;
        const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gain;
        src.connect(f); f.connect(g); g.connect(dest);
        src.start();
        return { src, f, g };
    }

    beds() {
        const ctx = this.ctx;
        this.wind = this.loop('bandpass', 420, 0.6, 0.0);
        this.windHi = this.loop('highpass', 2600, 0.4, 0.0);
        this.room = this.loop('lowpass', 160, 0.5, 0.0);
        // the hum under the town: two detuned low sines
        this.hum = ctx.createGain(); this.hum.gain.value = 0.0; this.hum.connect(this.amb);
        for (const f of [54.5, 55.2, 110.4]) { const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine'; const g = ctx.createGain(); g.gain.value = f > 100 ? 0.25 : 0.5; o.connect(g); g.connect(this.hum); o.start(); }
        // fluorescent buzz: 120 Hz saw through a resonant band
        const bz = ctx.createOscillator(); bz.type = 'sawtooth'; bz.frequency.value = 120;
        const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1450; bf.Q.value = 6;
        this.buzz = ctx.createGain(); this.buzz.gain.value = 0;
        bz.connect(bf); bf.connect(this.buzz); this.buzz.connect(this.amb); bz.start();
        this.buzzOsc = bz;
    }

    /** Called every frame with where the walker is. */
    setScene(s, dt) {
        this.scene = s;
        if (!this.ok()) return;
        const t = this.ctx.currentTime, out = 1 - s.inside;
        const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1);
        this.wind.g.gain.setTargetAtTime(out * (0.05 + gust * 0.09), t, 0.4);
        this.wind.f.frequency.setTargetAtTime(300 + gust * 400, t, 0.6);
        this.windHi.g.gain.setTargetAtTime(out * gust * 0.012, t, 0.4);
        this.room.g.gain.setTargetAtTime(s.inside * 0.06, t, 0.5);
        this.hum.gain.setTargetAtTime(0.02 + s.inside * 0.025 + s.ring * 0.12, t, 0.5);
        this.buzz.gain.setTargetAtTime(s.buzz * 0.022, t, 0.15);
        this.wet.gain.setTargetAtTime(0.18 + s.inside * 0.4, t, 0.5);
        // a sparse pad every so often
        this.nextPad -= dt;
        if (this.nextPad <= 0) { this.nextPad = 14 + Math.random() * 16; this.pad(); }
    }

    pad() {
        const roots = [41.2, 43.65, 36.71, 49.0, 38.89];
        const r = roots[Math.floor(Math.random() * roots.length)] * 2;
        const chord = Math.random() < 0.5 ? [1, 1.189, 1.498, 2.378] : [1, 1.335, 1.498, 2.0];
        const t = this.ctx.currentTime;
        for (const k of chord) for (const det of [-3, 3]) {
            const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = r * k; o.detune.value = det;
            const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 4); g.gain.exponentialRampToValueAtTime(0.0001, t + 11);
            const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
            o.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb);
            o.start(t); o.stop(t + 11.5);
        }
        if (Math.random() < 0.6) setTimeout(() => this.bell(r * 8 * (Math.random() < 0.5 ? 1.498 : 1.189), 0.05), 2500 + Math.random() * 3000);
    }

    // ------------------------------------------------------------------ voices

    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, verb = 0.3, dest = this.sfx } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verb); }
        o.start(t); o.stop(t + dur + 0.05);
    }

    hiss({ dur = 0.1, type = 'bandpass', freq = 1000, to = freq, q = 1, vol = 0.2, delay = 0, verb = 0.2 } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verb); }
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }

    bell(f, vol = 0.08) { this.tone({ freq: f, dur: 2.5, type: 'sine', vol, verb: 0.8, dest: this.music }); this.tone({ freq: f * 2.76, dur: 1.2, type: 'sine', vol: vol * 0.3, verb: 0.8, dest: this.music }); }

    step(surf, run) {
        const v = run ? 1.25 : 1;
        switch (surf) {
            case 'carpet': this.hiss({ dur: 0.09, type: 'lowpass', freq: 380, vol: 0.09 * v, verb: 0.05 }); break;
            case 'wood': this.hiss({ dur: 0.07, type: 'bandpass', freq: 260, q: 2, vol: 0.18 * v }); if (Math.random() < 0.12) this.tone({ freq: 140 + Math.random() * 60, to: 90, dur: 0.5, type: 'sawtooth', vol: 0.015, verb: 0.5 }); break;
            case 'tile': this.hiss({ dur: 0.04, type: 'highpass', freq: 2200, vol: 0.12 * v, verb: 0.5 }); this.hiss({ dur: 0.06, type: 'bandpass', freq: 500, q: 2, vol: 0.08 * v }); break;
            case 'water': this.hiss({ dur: 0.25, type: 'bandpass', freq: 2500, to: 900, q: 1.5, vol: 0.14 * v }); break;
            case 'grass': this.hiss({ dur: 0.12, type: 'highpass', freq: 3000, vol: 0.06 * v, verb: 0 }); break;
            case 'road': case 'walk': this.hiss({ dur: 0.07, type: 'bandpass', freq: 1300, q: 1.2, vol: 0.1 * v, verb: 0.15 }); break;
            default: this.hiss({ dur: 0.07, type: 'bandpass', freq: 750, q: 1.5, vol: 0.14 * v, verb: 0.4 });
        }
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 520, dur: 0.05, type: 'triangle', vol: 0.06, verb: 0 });
        else if (kind === 'open') { this.hiss({ dur: 0.25, type: 'bandpass', freq: 1800, to: 3500, vol: 0.06, verb: 0 }); }
        else if (kind === 'close') this.hiss({ dur: 0.2, type: 'bandpass', freq: 3000, to: 1500, vol: 0.05, verb: 0 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'step': this.step(e.surf, e.run); break;
                case 'diary': this.hiss({ dur: 0.5, type: 'bandpass', freq: 1500, to: 4000, vol: 0.12 }); [0, 0.25, 0.5].forEach((d, i) => this.tone({ freq: [220, 261.6, 329.6][i], dur: 2.2, type: 'triangle', vol: 0.05, delay: d, verb: 0.7, dest: this.music })); break;
                case 'item': this.tone({ freq: 880, to: 860, dur: 0.6, type: 'triangle', vol: 0.08, verb: 0.5 }); this.hiss({ dur: 0.12, type: 'highpass', freq: 3500, vol: 0.1 }); break;
                case 'unlock':
                    if (e.kind === 'boards') { this.hiss({ dur: 0.8, type: 'bandpass', freq: 300, to: 120, q: 3, vol: 0.25 }); this.hiss({ dur: 0.15, type: 'bandpass', freq: 900, vol: 0.3, delay: 0.7 }); }
                    else if (e.kind === 'chain') { this.hiss({ dur: 0.08, type: 'highpass', freq: 4000, vol: 0.3 }); for (let i = 0; i < 6; i++) this.tone({ freq: 2000 + Math.random() * 1500, dur: 0.06, type: 'square', vol: 0.03, delay: 0.1 + i * 0.07 }); }
                    else { this.tone({ freq: 1320, dur: 0.08, type: 'square', vol: 0.05, verb: 0 }); this.tone({ freq: 1760, dur: 0.12, type: 'square', vol: 0.05, delay: 0.12, verb: 0 }); this.hiss({ dur: 0.2, type: 'bandpass', freq: 400, vol: 0.2, delay: 0.3 }); }
                    break;
                case 'locked': this.hiss({ dur: 0.18, type: 'bandpass', freq: 220, q: 3, vol: 0.25 }); this.hiss({ dur: 0.1, type: 'bandpass', freq: 600, vol: 0.12, delay: 0.12 }); break;
                case 'vend': this.tone({ freq: 60, dur: 0.6, type: 'sawtooth', vol: 0.04 }); this.hiss({ dur: 0.15, type: 'bandpass', freq: 300, vol: 0.3, delay: 0.5 }); this.tone({ freq: 1800, to: 1700, dur: 0.3, type: 'triangle', vol: 0.04, delay: 0.62 }); break;
                case 'fragment': this.hiss({ dur: 0.35, type: 'bandpass', freq: 2500, to: 1200, vol: 0.1 }); break;
                case 'radio': this.radio(); break;
                case 'fall': this.hiss({ dur: 0.9, type: 'lowpass', freq: 900, to: 120, vol: 0.4 }); this.hiss({ dur: 0.3, type: 'bandpass', freq: 300, vol: 0.3 }); break;
                case 'land': this.tone({ freq: 90, to: 40, dur: 0.35, type: 'sine', vol: 0.3 }); this.hiss({ dur: 0.4, type: 'lowpass', freq: 600, vol: 0.3 }); break;
                case 'power': for (let i = 0; i < 6; i++) { this.hiss({ dur: 0.2, type: 'lowpass', freq: 400, vol: 0.4, delay: i * 0.35 }); this.tone({ freq: 50 + i * 20, to: 40, dur: 0.3, type: 'square', vol: 0.06, delay: i * 0.35 }); } this.tone({ freq: 55, to: 110, dur: 4, type: 'sawtooth', vol: 0.05, delay: 2 }); break;
                case 'dial': this.tone({ freq: 2400, dur: 0.03, type: 'square', vol: 0.04, verb: 0.1 }); break;
                case 'lever': this.hiss({ dur: 0.15, type: 'bandpass', freq: 500, vol: 0.25 }); this.tone({ freq: 110 * (1 + e.n * 0.25), dur: 1.2, type: 'sawtooth', vol: 0.05, verb: 0.6 }); break;
                case 'leverReset': for (let i = 0; i < 10; i++) this.hiss({ dur: 0.05, type: 'highpass', freq: 5000, vol: 0.2, delay: Math.random() * 0.5 }); this.hiss({ dur: 0.4, type: 'bandpass', freq: 300, vol: 0.3, delay: 0.4 }); break;
                case 'fail': this.tone({ freq: 220, to: 55, dur: 2.5, type: 'sawtooth', vol: 0.08, verb: 0.8 }); break;
                case 'portal':
                    for (const [f, d] of [[55, 0], [82.4, 0.6], [110, 1.2], [164.8, 2], [220, 2.8], [329.6, 3.6]]) this.tone({ freq: f, to: f * 1.01, dur: 9, type: 'sawtooth', vol: 0.05, delay: d, verb: 0.9, dest: this.music });
                    this.hiss({ dur: 8, type: 'lowpass', freq: 200, to: 3000, vol: 0.25, verb: 0.6 });
                    break;
                case 'won': [261.6, 329.6, 392, 523.3].forEach((f, i) => this.bell(f, 0.06 - i * 0.008)); break;
                case 'wake': this.tone({ freq: 55, to: 58, dur: 6, type: 'sine', vol: 0.12, verb: 0.6, dest: this.music }); break;
                case 'msg': this.tone({ freq: 700, dur: 0.05, type: 'triangle', vol: 0.03, verb: 0.2 }); break;
                case 'level': this.hiss({ dur: 0.3, type: 'bandpass', freq: 200, vol: 0.05 }); break;
            }
        }
    }

    radio() {
        // static, then something like a voice under it
        this.hiss({ dur: 2.2, type: 'bandpass', freq: 1800, q: 0.6, vol: 0.12, verb: 0.2 });
        for (let i = 0; i < 8; i++) {
            const f = 180 + Math.random() * 120;
            this.tone({ freq: f, to: f * (0.9 + Math.random() * 0.2), dur: 0.18 + Math.random() * 0.2, type: 'sawtooth', vol: 0.015, delay: 0.4 + i * 0.22, verb: 0.6 });
        }
    }
}
