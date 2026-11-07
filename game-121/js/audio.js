// Procedural sound, all Web Audio, no files: a mystic score from a look-ahead sequencer (a pad, a bass, a plucked
// arpeggio, glass bells, a soft drum), and effects that answer simulation events (knocks, doors, the ball's
// bells, an omen for every theme, cards, stars, clues). The context is made on the first user gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

const A4 = 440;
const hz = (semi) => A4 * Math.pow(2, semi / 12);            // semitones from A4
const PENT = [0, 3, 5, 7, 10, 12, 15, 17];                   // A minor pentatonic

// four bars each: [root semitone, chord tones]
const PROGS = {
    calm:     [[-12, [0, 3, 7]], [-16, [0, 4, 7]], [-21, [0, 4, 7]], [-17, [0, 4, 7]]],        // Am F C E
    night:    [[-12, [0, 3, 7]], [-14, [0, 3, 7]], [-16, [0, 4, 7]], [-17, [0, 4, 10]]],       // Am Gm F E7
    tense:    [[-12, [0, 3, 7]], [-17, [0, 4, 10]], [-12, [0, 3, 7]], [-18, [0, 3, 6]]],
    festival: [[-21, [0, 4, 7]], [-14, [0, 4, 7]], [-12, [0, 4, 7]], [-16, [0, 4, 7]]],        // C G Am F? bright
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6;
        this.mood = 'calm'; this.nextT = 0; this.step = 0; this.timer = 0;
        this.lastNow = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
        this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512; comp.connect(this.analyser);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.55; this.music.connect(this.master);
        // reverb from a decaying noise impulse
        const len = Math.floor(ctx.sampleRate * 2.4), imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb = ctx.createConvolver(); this.verb.buffer = imp;
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.35; this.verbIn.connect(this.verb); this.verb.connect(this.master);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.startMusic();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
    }
    setMood(m) { if (PROGS[m]) this.mood = m; else this.mood = 'calm'; this.moodName = m; }
    get on() { return this.ctx && this.ctx.state === 'running'; }
    /** Peak level of what is going to the speakers right now (0..1): for the tests. */
    level() {
        if (!this.analyser) return 0;
        const a = new Uint8Array(this.analyser.fftSize); this.analyser.getByteTimeDomainData(a);
        let m = 0; for (const v of a) m = Math.max(m, Math.abs(v - 128)); return m / 128;
    }

    // ------------------------------------------------------------------ building blocks
    tone({ f = 440, to = f, dur = 0.2, type = 'sine', vol = 0.2, delay = 0, atk = 0.008, bus = null, verb = 0, lp = 0, det = 0 } = {}) {
        if (!this.on) return;
        const c = this.ctx, t = c.currentTime + delay;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (det) o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let out = g;
        o.connect(g);
        if (lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; g.connect(l); out = l; }
        out.connect(bus || this.sfx);
        if (verb) { const s = c.createGain(); s.gain.value = verb; out.connect(s); s.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.05);
    }

    noise({ dur = 0.2, vol = 0.1, delay = 0, hp = 0, lp = 0, bp = 0, q = 1, sweep = 0, atk = 0.005, bus = null, verb = 0 } = {}) {
        if (!this.on) return;
        const c = this.ctx, t = c.currentTime + delay;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let n = s;
        const add = (type, f, qq = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = qq; n.connect(b); n = b; return b; };
        if (hp) add('highpass', hp); if (lp) add('lowpass', lp);
        if (bp) { const b = add('bandpass', bp, q); if (sweep) b.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur); }
        n.connect(g); g.connect(bus || this.sfx);
        if (verb) { const v = c.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verbIn); }
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------------ the score
    startMusic() {
        this.nextT = this.ctx.currentTime + 0.2; this.step = 0;
        this.timer = setInterval(() => this.schedule(), 120);
    }

    schedule() {
        const c = this.ctx;
        if (!c || c.state !== 'running') return;
        const now = c.currentTime;
        if (now - this.lastNow > 1.5) { this.nextT = now + 0.1; this.step = Math.ceil(this.step / 16) * 16; }   // a long pause: restart the bar
        this.lastNow = now;
        while (this.nextT < now + 0.45) { this.playStep(this.step, this.nextT); this.step++; this.nextT += this.stepLen(); }
    }
    stepLen() { return (60 / (this.mood === 'tense' ? 78 : this.mood === 'festival' ? 96 : this.mood === 'night' ? 56 : 64)) / 2; }

    playStep(s, t) {
        const bar = Math.floor(s / 8) % 4, k = s % 8;
        const prog = PROGS[this.mood], [root, tones] = prog[bar];
        const dt = t - this.ctx.currentTime;
        const m = this.moodName || this.mood;
        const rnd = ((s * 2654435761) >>> 0) / 4294967296;
        if (k === 0) {
            // a pad: three detuned triangles per chord tone, slow attack, through a lowpass
            for (const tone of tones) for (const d of [-7, 7]) this.tone({ f: hz(root + tone + 12), dur: this.stepLen() * 8.4, type: 'triangle', vol: 0.03, atk: 0.9, delay: dt, bus: this.music, lp: 1500, det: d, verb: 0.3 });
            // a bass note a bit above the floor, so small speakers carry it
            this.tone({ f: hz(root + 12), dur: this.stepLen() * 3.6, type: 'sawtooth', vol: 0.045, atk: 0.02, delay: dt, bus: this.music, lp: 700 });
        }
        if (k === 4) this.tone({ f: hz(root + 12 + tones[2]), dur: this.stepLen() * 3, type: 'triangle', vol: 0.03, delay: dt, bus: this.music, lp: 900 });
        // the plucked arpeggio, a different shape in each mood
        const density = m === 'festival' ? 0.85 : m === 'tense' ? 0.7 : m === 'ball' ? 0.55 : m === 'night' ? 0.4 : 0.6;
        if (rnd < density || k % 4 === 0) {
            const chordTone = tones[(s * 3 + (s >> 3)) % 3] + 24 + (((s >> 1) % 3 === 2) ? 12 : 0);
            const f = hz(root + chordTone);
            this.tone({ f, dur: 0.9, type: 'triangle', vol: 0.05, delay: dt, bus: this.music, verb: 0.5, lp: 3200 });
            this.tone({ f: f * 2.005, dur: 0.25, type: 'sine', vol: 0.02, delay: dt, bus: this.music, verb: 0.4 });
        }
        // glass bells when the ball is awake, and a high shimmer
        if ((m === 'ball' || m === 'title') && k % 2 === 1 && rnd > 0.35) this.tone({ f: hz(PENT[(s * 5) % PENT.length] + 36 - 12), dur: 1.6, type: 'sine', vol: 0.035, delay: dt, bus: this.music, verb: 0.9 });
        // a soft drum
        if ((m === 'tense' || m === 'festival') && (k === 0 || k === 4)) { this.tone({ f: 130, to: 55, dur: 0.3, type: 'sine', vol: 0.12, delay: dt, bus: this.music }); this.noise({ dur: 0.05, vol: 0.05, delay: dt, bp: 2800, q: 1, bus: this.music }); }
        if (m === 'festival' && k % 2 === 1) this.noise({ dur: 0.04, vol: 0.025, delay: dt, hp: 6000, bus: this.music });
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ f: 660, dur: 0.06, type: 'triangle', vol: 0.1, verb: 0.2 });
        else if (kind === 'open') this.tone({ f: 440, to: 880, dur: 0.12, type: 'triangle', vol: 0.1, verb: 0.3 });
        else if (kind === 'close') this.tone({ f: 660, to: 330, dur: 0.1, type: 'triangle', vol: 0.09 });
    }

    knock() { for (let i = 0; i < 3; i++) { this.tone({ f: 170, to: 80, dur: 0.12, type: 'sine', vol: 0.25, delay: i * 0.2 }); this.noise({ dur: 0.05, vol: 0.12, delay: i * 0.2, lp: 1200 }); } }
    door() { this.tone({ f: 220, to: 340, dur: 0.9, type: 'sawtooth', vol: 0.05, lp: 700 }); this.noise({ dur: 0.9, vol: 0.04, bp: 500, q: 4, sweep: 900 }); }
    steps(n = 6) { for (let i = 0; i < n; i++) this.noise({ dur: 0.07, vol: 0.09, delay: 0.3 + i * 0.36, lp: 420 }); }
    sit() { this.tone({ f: 100, to: 60, dur: 0.25, vol: 0.2 }); this.noise({ dur: 0.2, vol: 0.06, lp: 500 }); }
    gaze() { for (const [f, d] of [[A4, 0], [A4 * 1.5, 0.08], [A4 * 2, 0.16], [A4 * 3, 0.26]]) this.tone({ f, dur: 1.8, vol: 0.05, delay: d, atk: 0.2, verb: 0.8 });}
    vision(i, col) {
        const boon = ['gold', 'emerald', 'azure', 'pearl'].includes(col);
        const f = hz(PENT[[3, 4, 5][i]] + 12);
        this.tone({ f, dur: 1.5, type: 'sine', vol: 0.14, verb: 0.9 });
        this.tone({ f: f * 2.01, dur: 0.8, type: 'sine', vol: 0.06, delay: 0.02, verb: 0.9 });
        this.tone({ f: boon ? f * 1.25 : f * 1.06, dur: 1.2, type: boon ? 'sine' : 'triangle', vol: 0.05, delay: 0.05, verb: 0.6 });
        this.noise({ dur: 0.5, vol: 0.03, hp: 5000, verb: 0.5 });
    }
    focus() { for (let i = 0; i < 4; i++) this.tone({ f: hz(PENT[i + 2] + 24), dur: 0.5, vol: 0.08, delay: i * 0.06, verb: 0.8 }); }
    deal() { for (let i = 0; i < 6; i++) this.noise({ dur: 0.06, vol: 0.07, delay: i * 0.07, hp: 2500, bp: 5000, q: 0.5 }); }
    place() { this.noise({ dur: 0.08, vol: 0.12, lp: 1800 }); this.tone({ f: 200, to: 120, dur: 0.1, vol: 0.1 }); }
    unplace() { this.noise({ dur: 0.07, vol: 0.07, hp: 1500 }); }
    lay() { for (let i = 0; i < 3; i++) { this.noise({ dur: 0.5, vol: 0.08, delay: i * 0.55, bp: 1500, q: 0.8, sweep: 5000 }); this.tone({ f: hz(PENT[i + 3] + 12), dur: 1.2, vol: 0.08, delay: 0.5 + i * 0.55, verb: 0.8 }); } }
    stars(n) {
        if (n === 0) { this.tone({ f: hz(-12), to: hz(-17), dur: 1.4, type: 'triangle', vol: 0.12, verb: 0.6 }); return; }
        for (let i = 0; i < n; i++) this.tone({ f: hz([0, 4, 7][i] + 12), dur: 1.4, type: 'triangle', vol: 0.12, delay: i * 0.16, verb: 0.9 });
        if (n === 3) for (let i = 0; i < 7; i++) this.tone({ f: hz(PENT[i % 5] + 24), dur: 0.8, vol: 0.05, delay: 0.5 + i * 0.07, verb: 0.9 });
    }
    rankup() { for (let i = 0; i < 9; i++) this.tone({ f: hz(PENT[i % 5] + 12 + Math.floor(i / 5) * 12), dur: 1.2, type: 'triangle', vol: 0.09, delay: i * 0.09, verb: 0.9 }); }
    clue() { for (const [s, d] of [[-5, 0], [0, 0.05], [3, 0.1], [7, 0.15], [14, 0.2]]) this.tone({ f: hz(s + 12), dur: 2.2, type: 'sine', vol: 0.07, delay: d, atk: 0.4, verb: 1 }); }
    heart() { this.tone({ f: hz(12), dur: 0.9, vol: 0.09, verb: 0.8 }); this.tone({ f: hz(19), dur: 1.1, vol: 0.07, delay: 0.12, verb: 0.8 }); }
    firework() { this.tone({ f: 180, to: 40, dur: 0.5, vol: 0.14 }); this.noise({ dur: 0.8, vol: 0.1, delay: 0.05, hp: 800, verb: 0.9 }); for (let i = 0; i < 5; i++) this.noise({ dur: 0.04, vol: 0.05, delay: 0.3 + Math.random() * 0.8, hp: 5000 }); }

    omen(theme) {
        const t = this.tone.bind(this), n = this.noise.bind(this);
        switch (theme) {
            case 'love': for (let i = 0; i < 6; i++) t({ f: hz(PENT[i % 5] + 24), dur: 1, vol: 0.05, delay: i * 0.12, verb: 1 }); break;
            case 'loss': n({ dur: 3.5, vol: 0.06, hp: 3000, atk: 0.8 }); t({ f: hz(-5), to: hz(-7), dur: 2, type: 'sine', vol: 0.09, verb: 1 }); break;
            case 'wealth': for (let i = 0; i < 7; i++) t({ f: hz(PENT[(i * 3) % 8] + 24), dur: 1.4, type: 'sine', vol: 0.06, delay: i * 0.09, verb: 1 }); break;
            case 'betrayal': t({ f: 520, to: 260, dur: 0.35, type: 'sawtooth', vol: 0.08, lp: 1800 }); t({ f: 540, to: 270, dur: 0.35, type: 'sawtooth', vol: 0.07, delay: 0.45, lp: 1800 }); break;
            case 'journey': t({ f: 90, to: 120, dur: 1.4, type: 'sawtooth', vol: 0.04, lp: 400 }); n({ dur: 1.4, vol: 0.05, bp: 300, q: 3 }); break;
            case 'health': n({ dur: 2.6, vol: 0.06, hp: 2500, atk: 0.4 }); break;
            case 'family': for (let i = 0; i < 4; i++) { t({ f: 900, to: 700, dur: 0.1, type: 'triangle', vol: 0.09, delay: i * 0.6 }); t({ f: 110, dur: 0.3, vol: 0.06, delay: i * 0.6 }); } break;
            case 'ambition': n({ dur: 1.6, vol: 0.07, bp: 400, q: 1, sweep: 3000 }); t({ f: 220, to: 660, dur: 1.4, type: 'sawtooth', vol: 0.04, lp: 900 }); break;
            case 'secret': n({ dur: 2.4, vol: 0.05, bp: 3000, q: 8, atk: 0.5 }); break;
            case 'danger': n({ dur: 2.8, vol: 0.18, lp: 220, atk: 0.2 }); t({ f: 60, to: 40, dur: 2.2, vol: 0.2 }); break;
            case 'change': for (let i = 0; i < 5; i++) n({ dur: 0.18, vol: 0.07, delay: i * 0.15, hp: 2000, bp: 4000, q: 0.6 }); break;
            case 'hope': for (let i = 0; i < 5; i++) t({ f: hz(PENT[i + 2] + 24), dur: 2, vol: 0.06, delay: i * 0.22, atk: 0.1, verb: 1 }); break;
            default: break;
        }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'knock': this.knock(); setTimeout(() => this.door(), 900); setTimeout(() => this.steps(6), 1400); break;
                case 'sit': this.sit(); break;
                case 'gaze': this.gaze(); break;
                case 'vision': this.vision(e.i, e.col); break;
                case 'omen': this.omen(e.theme); break;
                case 'focus': this.focus(); break;
                case 'deal': this.deal(); break;
                case 'place': this.place(); break;
                case 'unplace': this.unplace(); break;
                case 'lay': this.lay(); break;
                case 'result': this.stars(e.stars); break;
                case 'rankup': this.rankup(); break;
                case 'clue': this.clue(); break;
                case 'aff': if (e.delta > 0) this.heart(); break;
                case 'leave': this.steps(4); setTimeout(() => this.door(), 800); break;
                case 'finale': this.setMood('festival'); break;
                default: break;
            }
        }
    }
}
