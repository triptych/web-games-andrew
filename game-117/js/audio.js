// Procedural sound, all Web Audio, no files. Effects answer simulation events.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.
//
// Music: an original slow waltz in D for the title and the ending (strings, a harp and a
// pizzicato bass on a look-ahead sequencer); a drifting tone cluster of gliding voices for the
// asteroids, darker on the last one; a rising cluster for the star gate. And the sound of your
// own breathing inside the helmet, quicker when you are hurt.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// the waltz: one chord per bar, a melody of [note, beats] in 3/4 (0 = rest)
const CHORDS = [[50, 54, 57], [55, 59, 62], [57, 61, 64, 67], [50, 54, 57], [47, 50, 54], [55, 59, 62], [52, 56, 59, 62], [57, 61, 64, 67]];
const TUNE = [
    [[74, 3]], [[71, 2], [74, 1]], [[73, 3]], [[76, 2], [74, 1]], [[71, 3]], [[71, 1], [74, 1], [79, 1]], [[76, 3]], [[73, 2], [0, 1]],
    [[74, 2], [78, 1]], [[79, 3]], [[76, 2], [73, 1]], [[74, 3]], [[71, 2], [74, 1]], [[79, 2], [78, 1]], [[76, 1], [74, 1], [71, 1]], [[69, 3]],
];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.mode = 'silent';
        this.muted = false;        // the title's attract mode is silent
        this.breathT = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.out = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // a long hall from a decaying noise impulse
        const len = ctx.sampleRate * 3.2;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.5;
        this.verbIn.connect(this.verb); this.verb.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.timer = setInterval(() => this.tick(), 40);
        const want = this.mode; this.mode = 'silent'; this.setMusic(want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    ok() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ building blocks
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, attack = 0.005, dest = null, verb = 0 } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.02);
    }
    noise({ dur = 0.3, vol = 0.2, f = 1200, to = f, q = 0.8, type = 'bandpass', delay = 0, attack = 0.005, verb = 0, dest = null } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
        fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
        if (verb) { const v = this.ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verbIn); }
        s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    boom(vol = 0.5, delay = 0) {
        this.tone({ freq: 120, to: 32, dur: 0.9, type: 'sine', vol, delay, verb: 0.4 });
        this.noise({ dur: 1.1, vol: vol * 0.7, f: 900, to: 80, type: 'lowpass', q: 0.4, delay, verb: 0.5 });
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.06, type: 'sine', vol: 0.1, verb: 0.2 });
        else if (kind === 'open') this.tone({ freq: 587, to: 880, dur: 0.12, type: 'sine', vol: 0.1, verb: 0.3 });
        else if (kind === 'close') this.tone({ freq: 880, to: 587, dur: 0.12, type: 'sine', vol: 0.1, verb: 0.3 });
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        if (this.muted || !this.ok()) return;
        let shots = 0;
        for (const e of events) {
            switch (e.type) {
                case 'shot': if (shots++ < 1) { this.tone({ freq: 1500, to: 380, dur: 0.07, type: 'square', vol: 0.045 }); this.noise({ dur: 0.05, vol: 0.03, f: 4000, q: 1 }); } break;
                case 'tfire': case 'efire': this.tone({ freq: 420, to: 140, dur: 0.18, type: 'sawtooth', vol: 0.06, verb: 0.15 }); break;
                case 'bfire': this.tone({ freq: 110, to: 55, dur: 0.6, type: 'sawtooth', vol: 0.12, verb: 0.4 }); break;
                case 'spark': break;
                case 'ehit': case 'thit': this.tone({ freq: 2400, to: 1800, dur: 0.03, type: 'square', vol: 0.03 }); break;
                case 'deflect': this.tone({ freq: 3200, to: 2600, dur: 0.08, type: 'sine', vol: 0.05, verb: 0.3 }); break;
                case 'bhit': this.tone({ freq: 160, to: 120, dur: 0.06, type: 'square', vol: 0.05 }); break;
                case 'kill': this.noise({ dur: 0.45, vol: 0.22, f: 2200, to: 200, q: 0.6, verb: 0.3 }); this.tone({ freq: 300, to: 60, dur: 0.3, type: 'triangle', vol: 0.15 }); break;
                case 'turretDown': this.boom(0.55); this.tone({ freq: 1320, to: 1250, dur: 1.6, type: 'sine', vol: 0.05, delay: 0.05, verb: 0.8 }); break;
                case 'bossDown': this.boom(0.8); this.boom(0.6, 0.4); this.boom(0.7, 0.9); break;
                case 'hurt': this.tone({ freq: 180, to: 70, dur: 0.22, type: 'square', vol: 0.16 }); this.noise({ dur: 0.2, vol: 0.14, f: 600, q: 0.7 }); if (e.hp < 30) this.alarm(); break;
                case 'die': this.boom(0.6); this.noise({ dur: 2.0, vol: 0.12, f: 3000, to: 100, q: 0.4, verb: 0.6 }); break;
                case 'dash': this.noise({ dur: 0.28, vol: 0.12, f: 500, to: 2600, q: 1.4 }); break;
                case 'pickup': [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: midi((e.kind === 'repair' ? 74 : e.kind === 'power' ? 79 : 81) + s), dur: 0.3, type: 'sine', vol: 0.07, delay: i * 0.06, verb: 0.5 })); break;
                case 'alarm': this.tone({ freq: 988, dur: 0.12, type: 'square', vol: 0.05 }); this.tone({ freq: 740, dur: 0.12, type: 'square', vol: 0.05, delay: 0.15 }); break;
                case 'spawn': this.tone({ freq: 200, to: 420, dur: 0.25, type: 'triangle', vol: 0.03 }); break;
                case 'exitOpen': this.choir([62, 69, 74, 78, 81], 3.5, 0.06); break;
                case 'shieldDown': for (let i = 0; i < 6; i++) this.tone({ freq: 2600 - i * 300, dur: 0.4, type: 'sine', vol: 0.05, delay: i * 0.07, verb: 0.7 }); break;
                case 'go': this.tone({ freq: midi(74), dur: 0.5, type: 'sine', vol: 0.06, verb: 0.6 }); this.tone({ freq: midi(81), dur: 0.7, type: 'sine', vol: 0.05, delay: 0.12, verb: 0.6 }); break;
                case 'warp': this.setMusic('warp'); break;
                case 'level': this.setMusic(G.level === 7 ? 'boss' : 'play'); break;
                case 'win': this.setMusic('title'); break;
                case 'over': this.setMusic('silent'); this.choir([50, 53, 57, 60], 5, 0.05); break;
            }
        }
    }
    alarm() { this.tone({ freq: 1200, dur: 0.1, type: 'square', vol: 0.04, delay: 0.1 }); this.tone({ freq: 1200, dur: 0.1, type: 'square', vol: 0.04, delay: 0.28 }); }

    /** A held chord of soft voices, swelling in and dying away. */
    choir(notes, dur, vol) {
        if (!this.ok()) return;
        for (const n of notes) {
            for (const det of [-6, 5]) {
                const t = this.ctx.currentTime;
                const o = this.ctx.createOscillator(); o.type = 'sawtooth';
                o.frequency.value = midi(n); o.detune.value = det;
                const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 2;
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(vol / notes.length, t + dur * 0.35);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                o.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verbIn);
                o.start(t); o.stop(t + dur + 0.05);
            }
        }
    }

    // ------------------------------------------------------------------ music
    setMusic(mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        if (this.bed) { const b = this.bed; b.out.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => b.stop(), 3000); this.bed = null; }
        this.bar = 0; this.next = t + 0.3;
        if (mode === 'play' || mode === 'boss' || mode === 'warp') this.bed = this.cluster(mode);
    }

    /** Drifting voices in a narrow band: each glides to a new pitch now and then, never resolving. */
    cluster(mode) {
        const ctx = this.ctx, t = ctx.currentTime;
        const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(1, t, mode === 'warp' ? 0.3 : 2.5);
        out.connect(this.music);
        const vs = ctx.createGain(); vs.gain.value = 0.6; out.connect(vs); vs.connect(this.verbIn);
        const centre = mode === 'boss' ? 45 : mode === 'warp' ? 62 : 52;
        const voices = [];
        const n = mode === 'warp' ? 10 : 7;
        for (let i = 0; i < n; i++) {
            const o = ctx.createOscillator(); o.type = i % 3 === 0 ? 'triangle' : 'sine';
            o.frequency.value = midi(centre + (i - n / 2) * (mode === 'warp' ? 1.3 : 0.9) + 12 * (i % 2));
            const g = ctx.createGain(); g.gain.value = 0.05;
            const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.031;
            const lg = ctx.createGain(); lg.gain.value = 0.035;
            lfo.connect(lg); lg.connect(g.gain);
            o.connect(g); g.connect(out);
            o.start(); lfo.start();
            voices.push({ o, lfo, base: centre + (i - n / 2) * 0.9 + 12 * (i % 2) });
        }
        // a sub drone underneath
        const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = midi(centre - 24);
        const sg = ctx.createGain(); sg.gain.value = mode === 'boss' ? 0.12 : 0.07;
        sub.connect(sg); sg.connect(out); sub.start();
        if (mode === 'warp') for (const v of voices) v.o.frequency.exponentialRampToValueAtTime(v.o.frequency.value * 2.5, t + 4.2);
        return {
            out, voices, mode,
            drift: () => {
                if (mode === 'warp') return;
                const v = voices[Math.floor(Math.random() * voices.length)];
                const to = midi(v.base + (Math.random() * 2 - 1) * 1.6);
                v.o.frequency.setTargetAtTime(to, ctx.currentTime, 2.5);
            },
            stop: () => { for (const v of voices) { try { v.o.stop(); v.lfo.stop(); } catch { /* */ } } try { sub.stop(); } catch { /* */ } out.disconnect(); },
        };
    }

    /** The look-ahead sequencer for the waltz, the drift of the cluster, and the breathing. */
    tick() {
        if (!this.ok()) return;
        const now = this.ctx.currentTime;
        if (this.bed && Math.random() < 0.05) this.bed.drift();
        if (this.mode === 'title') {
            const beat = 60 / 84;
            while (this.next < now + 0.25) this.waltzBar(this.next, beat), this.next += beat * 3;
        }
        if (this.breathing && !this.muted) {
            this.breathT -= 0.04;
            if (this.breathT <= 0) {
                const fast = this.hurtLevel || 0;
                const cyc = 4.6 - fast * 2;
                this.noise({ dur: cyc * 0.38, vol: 0.022 + fast * 0.01, f: 700, to: 1100, q: 1.2, attack: cyc * 0.18 });
                this.noise({ dur: cyc * 0.45, vol: 0.018 + fast * 0.01, f: 900, to: 450, q: 1.0, attack: 0.15, delay: cyc * 0.42 });
                this.breathT = cyc;
            }
        }
    }

    waltzBar(t, beat) {
        const bar = this.bar++;
        const ch = CHORDS[bar % CHORDS.length];
        const d = this.ctx.currentTime;
        const at = t - d;
        // pizzicato bass on one, soft string chords on two and three
        this.tone({ freq: midi(ch[0] - 12), dur: beat * 0.9, type: 'triangle', vol: 0.12, delay: at, dest: this.music, verb: 0.3 });
        for (const b of [1, 2]) for (const n of ch.slice(1)) this.tone({ freq: midi(n), dur: beat * 0.55, type: 'sine', vol: 0.035, delay: at + b * beat, attack: 0.03, dest: this.music, verb: 0.4 });
        // a harp running up the chord every other bar
        if (bar % 2 === 1) ch.forEach((n, i) => this.tone({ freq: midi(n + 12), dur: 0.9, type: 'triangle', vol: 0.03, delay: at + i * beat * 0.18, dest: this.music, verb: 0.6 }));
        // the tune, after the first eight bars of accompaniment
        if (bar >= 8) {
            let b = 0;
            for (const [n, len] of TUNE[(bar - 8) % TUNE.length]) {
                if (n) {
                    this.tone({ freq: midi(n), dur: len * beat * 0.95, type: 'sine', vol: 0.075, delay: at + b * beat, attack: 0.08, dest: this.music, verb: 0.55 });
                    this.tone({ freq: midi(n) * 2.002, dur: len * beat * 0.8, type: 'sine', vol: 0.012, delay: at + b * beat, attack: 0.1, dest: this.music });
                }
                b += len;
            }
        }
    }

    /** Called every frame by main: breathing on while playing, faster when hurt. */
    setBreath(on, hurt) { this.breathing = on; this.hurtLevel = hurt; }
}
