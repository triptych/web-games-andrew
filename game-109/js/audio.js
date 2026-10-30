// Procedural sound, all Web Audio, no files, in the voices of an 80s console: pulse waves with 12.5%,
// 25% and 50% duty, a triangle bass and noise drums. Effects answer simulation events; the music is a
// look-ahead sequencer with a different key for each sector, more layers as a sector goes on, and its
// own faster, harder tunes for bosses and bonus stages.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19];           // minor pentatonic, two octaves
const MAJ_PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];

// sector → key, and a chord loop (semitones from the key, and the triad type)
const SECTORS = [
    { root: 45, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] },       // A minor: i VI III VII
    { root: 50, prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']] },      // D minor
    { root: 52, prog: [[0, 'm'], [-5, 'M'], [-4, 'M'], [-7, 'M']] },      // E minor
    { root: 48, prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [3, 'M']] },       // C minor
];
const TRIAD = { m: [0, 3, 7], M: [0, 4, 7] };
const BOSS_ROOTS = [40, 43, 38];

/** A small seeded generator so the tunes are the same every time without touching the sim's RNG. */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function makeMelody(seed, scale) {
    const r = lcg(seed), out = [];
    let at = 3;
    const masks = [
        [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
        [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0],
        [1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1],
    ];
    for (let bar = 0; bar < 4; bar++) {
        const mask = masks[(r() * masks.length) | 0];
        for (let i = 0; i < 16; i++) {
            if (!mask[i] && i !== 0) { out.push(null); continue; }
            at = Math.max(0, Math.min(scale.length - 1, at + [-2, -1, -1, 0, 1, 1, 2][(r() * 7) | 0]));
            if (i === 0 || i === 15 && bar === 3) at = [0, 2, 3, 4][(r() * 4) | 0] + (bar & 1 ? 0 : 1);
            out.push(scale[Math.min(at, scale.length - 1)]);
        }
    }
    return out;
}

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.mode = 'off';            // off | play | boss | bonus
        this.hushed = false;          // paused, or on a menu
        this.sector = 0;
        this.intensity = 1;
        this.last = {};
        this.melodies = SECTORS.map((_, i) => makeMelody(1000 + i * 77, PENTA));
        this.bonusTune = makeMelody(4242, MAJ_PENTA);
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 5;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        const len = ctx.sampleRate * 0.6;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // NES-style pulse waves: duty 12.5%, 25% and 50%
        this.pulse = {};
        for (const duty of [0.125, 0.25, 0.5]) {
            const n = 32, re = new Float32Array(n), im = new Float32Array(n);
            for (let k = 1; k < n; k++) {
                const a = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
                re[k] = a * Math.cos(k * Math.PI * duty);
                im[k] = a * Math.sin(k * Math.PI * duty);
            }
            this.pulse[duty] = ctx.createPeriodicWave(re, im);
        }
        this.step = 0;
        this.nextT = 0;
        this.timer = setInterval(() => this.schedule(), 25);
        if (this.mode !== 'off') this.restart();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(this.hushed ? 0 : music * 0.45, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------------ music control
    /** mode: 'off' | 'play' | 'boss' | 'bonus'. */
    setMusic(mode, sector = this.sector, intensity = this.intensity) {
        const changed = mode !== this.mode || sector !== this.sector;
        this.mode = mode; this.sector = sector % SECTORS.length; this.intensity = intensity;
        if (changed && this.ctx) this.restart();
    }

    restart() { if (this.ctx) { this.step = 0; this.nextT = this.ctx.currentTime + 0.06; } }

    /** Duck the music (pause, menus) without forgetting what was playing. */
    hush(on) {
        this.hushed = on;
        if (this.ctx) this.music.gain.setTargetAtTime(on ? 0 : this.musicVol * 0.45, this.ctx.currentTime, 0.06);
        if (!on) this.restart();
    }

    // ------------------------------------------------------------------ the sequencer
    get stepLen() { return 60 / (this.mode === 'boss' ? 172 : this.mode === 'bonus' ? 162 : 148) / 4; }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || this.mode === 'off' || this.hushed) return;
        if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.03;
        while (this.nextT < ctx.currentTime + 0.12) {
            this.playStep(this.step, this.nextT);
            this.nextT += this.stepLen;
            this.step = (this.step + 1) % 64;
        }
    }

    playStep(s, t) {
        if (this.mode === 'boss') return this.bossStep(s, t);
        if (this.mode === 'bonus') return this.bonusStep(s, t);
        const sec = SECTORS[this.sector], bar = s >> 4, i = s & 15, lvl = this.intensity, L = this.stepLen;
        const [off, kind] = sec.prog[bar], root = sec.root + off, chord = TRIAD[kind];
        // triangle bass: eighths, with an octave jump on the off-beats
        if ((i & 1) === 0) this.note({ t, f: midi(root - 12 + (i === 6 || i === 14 ? 12 : 0)), dur: L * 1.7, type: 'triangle', vol: 0.5 });
        // arpeggio on a 12.5% pulse
        this.note({ t, f: midi(root + 12 + chord[i % 3] + (i & 4 ? 12 : 0)), dur: L * 0.85, pulse: 0.125, vol: 0.09 });
        if (lvl >= 2) {
            if (i % 4 === 0) this.kick(t, 0.5);
            if (i === 4 || i === 12) this.hit(t, 0.1, 2400, 0.2, 'bandpass');
            if (i % 2 === 1) this.hit(t, 0.03, 9000, 0.06, 'highpass');
        }
        if (lvl >= 3) {
            const n = this.melodies[this.sector][s];
            if (n != null) this.note({ t, f: midi(sec.root + 24 + n), dur: L * 1.6, pulse: 0.25, vol: 0.12, vib: true });
        }
        if (lvl >= 4 && i % 8 === 0) for (const c of chord) this.note({ t, f: midi(root + 12 + c), dur: L * 5, pulse: 0.5, vol: 0.04 });
        if (lvl >= 4 && i % 2 === 0) this.hit(t, 0.025, 7000, 0.04, 'highpass');
    }

    bossStep(s, t) {
        const L = this.stepLen, i = s & 15, bar = s >> 4;
        const root = BOSS_ROOTS[this.sector % 3] + [0, 0, -2, 1][bar];
        const riff = [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 12, 0, 7, 0, 5, 0];
        if (i % 2 === 0) this.note({ t, f: midi(root - 12 + riff[i]), dur: L * 1.6, type: 'sawtooth', vol: 0.3, cut: 700 });
        this.note({ t, f: midi(root + 12 + [0, 3, 7, 10][(i + bar) % 4] + (i >= 8 ? 12 : 0)), dur: L * 0.8, pulse: 0.125, vol: 0.1 });
        if (i % 4 === 0) this.kick(t, 0.6);
        if (i === 4 || i === 12) { this.hit(t, 0.12, 2200, 0.25, 'bandpass'); this.note({ t, f: 180, dur: L * 0.6, type: 'triangle', vol: 0.2 }); }
        this.hit(t, 0.025, 8000, 0.05, 'highpass');
        if (i % 8 === 6) this.note({ t, f: midi(root + 24 + [0, 1, 0, 3][bar]), dur: L * 3, pulse: 0.25, vol: 0.12, vib: true });
    }

    bonusStep(s, t) {
        const L = this.stepLen, i = s & 15, bar = s >> 4, root = 60 + [0, 5, 7, 5][bar];
        if (i % 2 === 0) this.note({ t, f: midi(root - 24 + (i % 4 ? 12 : 0)), dur: L * 1.5, type: 'triangle', vol: 0.5 });
        this.note({ t, f: midi(root + [0, 4, 7, 12][i % 4] + (i >= 8 ? 12 : 0)), dur: L * 0.8, pulse: 0.25, vol: 0.09 });
        if (i % 4 === 0) this.kick(t, 0.4);
        if (i === 4 || i === 12) this.hit(t, 0.08, 3000, 0.15, 'bandpass');
        if (i % 2 === 1) this.hit(t, 0.025, 9000, 0.05, 'highpass');
        const n = this.bonusTune[s];
        if (n != null) this.note({ t, f: midi(root + 12 + n), dur: L * 1.4, pulse: 0.5, vol: 0.1, vib: true });
    }

    // ------------------------------------------------------------------ voices
    note({ t, f, dur, type = 'square', pulse = 0, vol = 0.1, cut = 0, vib = false, out }) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        if (pulse) o.setPeriodicWave(this.pulse[pulse]); else o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (vib) { o.frequency.setValueAtTime(f, t + dur * 0.4); o.frequency.linearRampToValueAtTime(f * 1.012, t + dur * 0.8); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.006);
        g.gain.setValueAtTime(vol * 0.8, t + dur * 0.6);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 3; o.connect(lp); node = lp; }
        node.connect(g); g.connect(out || this.music);
        o.start(t); o.stop(t + dur + 0.02);
    }

    kick(t, vol = 0.5) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + 0.18);
    }

    hit(t, dur, freq, vol, kind, out) {
        const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise;
        f.type = kind; f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(out || this.music);
        src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
    }

    // ------------------------------------------------------------------ effects
    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', pulse = 0, vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        if (pulse) o.setPeriodicWave(this.pulse[pulse]); else o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    noiseFx(dur, freq, vol, kind = 'lowpass', delay = 0, sweepTo = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const ctx = this.ctx, t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise;
        f.type = kind; f.frequency.setValueAtTime(freq, t);
        if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
    }
    arp(notes, { dur = 0.07, gap = 0.055, type = 'square', pulse = 0, vol = 0.12 } = {}) {
        notes.forEach((f, i) => this.tone({ freq: f, dur, type, pulse, vol, delay: i * gap }));
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, pulse: 0.25, vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.08, pulse: 0.25, vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.08, pulse: 0.25, vol: 0.08 });
        else if (kind === 'start') this.arp([523, 659, 784, 1047, 1319], { dur: 0.09, gap: 0.07, pulse: 0.5, vol: 0.12 });
    }

    /** Rate-limit a sound by name. */
    ready(name, gap) {
        const now = this.ctx.currentTime;
        if (now - (this.last[name] || -9) < gap) return false;
        this.last[name] = now;
        return true;
    }

    boom(size) {
        if (size === 0) {
            if (!this.ready('b0', 0.035)) return;
            this.noiseFx(0.16, 2200, 0.18);
            this.tone({ freq: 320, to: 70, dur: 0.13, pulse: 0.5, vol: 0.09 });
        } else if (size === 1) {
            if (!this.ready('b1', 0.05)) return;
            this.noiseFx(0.3, 1500, 0.3);
            this.tone({ freq: 240, to: 45, dur: 0.24, type: 'sawtooth', vol: 0.1 });
        } else if (size === 2) {
            if (!this.ready('b2', 0.07)) return;
            this.noiseFx(0.55, 1000, 0.45);
            this.tone({ freq: 160, to: 30, dur: 0.45, type: 'sawtooth', vol: 0.14 });
            this.tone({ freq: 70, to: 28, dur: 0.5, type: 'sine', vol: 0.3 });
        } else {
            this.noiseFx(1.6, 900, 0.7, 'lowpass', 0, 90);
            this.noiseFx(0.9, 3500, 0.3, 'bandpass', 0.05, 400);
            this.tone({ freq: 220, to: 25, dur: 1.2, type: 'sawtooth', vol: 0.18 });
            this.tone({ freq: 60, to: 24, dur: 1.4, type: 'sine', vol: 0.45 });
            this.arp([880, 660, 523, 392, 330, 262], { dur: 0.14, gap: 0.1, pulse: 0.25, vol: 0.1 });
        }
    }

    onEvents(G, events) {
        if (!this.ctx) return;
        for (const e of events) {
            switch (e.type) {
                case 'shoot':
                    if (!this.ready('shoot', 0.055)) break;
                    this.tone({ freq: 1500 - e.w * 120, to: 520 - e.w * 40, dur: 0.055, pulse: 0.25, vol: 0.05 });
                    if (e.w >= 5) this.noiseFx(0.03, 5000, 0.03, 'highpass');
                    break;
                case 'ehit':
                    if (this.ready('ehit', 0.04)) this.tone({ freq: e.boss ? 150 : 260, to: 110, dur: 0.03, type: 'square', vol: 0.04 });
                    break;
                case 'boom': this.boom(e.size); break;
                case 'eshot':
                    if (this.ready('eshot', 0.09)) this.tone({ freq: e.k === 'boss' ? 300 : 640, to: 260, dur: 0.05, pulse: 0.125, vol: 0.035 });
                    break;
                case 'cancel':
                    if (this.ready('cancel', 0.04)) this.tone({ freq: 1800 + Math.random() * 600, to: 3000, dur: 0.04, type: 'triangle', vol: 0.03 });
                    break;
                case 'pickup': this.pickup(e); break;
                case 'bomb':
                    this.noiseFx(0.9, 300, 0.55, 'bandpass', 0, 4000);
                    this.tone({ freq: 70, to: 900, dur: 0.8, type: 'sawtooth', vol: 0.14 });
                    this.arp([523, 659, 784, 1047, 1319, 1568, 2093], { dur: 0.1, gap: 0.07, pulse: 0.5, vol: 0.07 });
                    break;
                case 'pdie':
                    this.noiseFx(0.9, 1800, 0.6, 'lowpass', 0, 120);
                    this.tone({ freq: 700, to: 38, dur: 0.9, type: 'sawtooth', vol: 0.18 });
                    this.tone({ freq: 90, to: 28, dur: 0.7, type: 'sine', vol: 0.4 });
                    break;
                case 'respawn': this.tone({ freq: 220, to: 880, dur: 0.25, pulse: 0.25, vol: 0.1 }); break;
                case 'shieldbreak': this.noiseFx(0.3, 6000, 0.3, 'highpass'); this.tone({ freq: 1500, to: 300, dur: 0.25, type: 'triangle', vol: 0.15 }); break;
                case 'wave': this.waveStart(e); break;
                case 'waveclear':
                    if (e.perfect) this.arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], { dur: 0.12, gap: 0.085, pulse: 0.5, vol: 0.13 });
                    else this.arp([392, 523, 659, 784], { dur: 0.1, gap: 0.07, pulse: 0.25, vol: 0.1 });
                    break;
                case 'bossappear': this.noiseFx(2.0, 200, 0.4, 'lowpass'); this.tone({ freq: 50, to: 38, dur: 2, type: 'sine', vol: 0.4 }); break;
                case 'bossdying': this.setMusic('off'); this.noiseFx(2.4, 1400, 0.4, 'lowpass', 0, 200); break;
                case 'bossdown': this.arp([1047, 1319, 1568, 2093, 1568, 2093, 2637], { dur: 0.14, gap: 0.1, pulse: 0.5, vol: 0.12 }); break;
                case 'beamwarn': for (let k = 0; k < 4; k++) this.tone({ freq: 1760, dur: 0.07, pulse: 0.5, vol: 0.06, delay: k * 0.22 }); break;
                case 'beam': this.noiseFx(1.0, 800, 0.4, 'bandpass', 0, 200); this.tone({ freq: 110, to: 90, dur: 1.0, type: 'sawtooth', vol: 0.14 }); break;
                case 'launch': this.tone({ freq: 300, to: 900, dur: 0.15, pulse: 0.25, vol: 0.05 }); break;
                case '1up': this.arp([659, 784, 1319, 1047, 1175, 1568], { dur: 0.1, gap: 0.085, pulse: 0.5, vol: 0.13 }); break;
                case 'over': [392, 349, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.4, pulse: 0.25, vol: 0.12, delay: i * 0.24 })); this.setMusic('off'); break;
            }
        }
    }

    pickup(e) {
        switch (e.kind) {
            case 'P': this.arp([523, 659, 784, 1047], { dur: 0.08, gap: 0.05, pulse: 0.5, vol: 0.12 }); break;
            case 'S': this.tone({ freq: 400, to: 1600, dur: 0.22, pulse: 0.25, vol: 0.12 }); break;
            case 'B': this.arp([196, 262, 392, 523], { dur: 0.09, gap: 0.06, type: 'triangle', vol: 0.2 }); break;
            case 'H': this.arp([1568, 2093, 1568, 2349], { dur: 0.07, gap: 0.05, type: 'triangle', vol: 0.12 }); break;
            case '1': this.arp([659, 784, 1319, 1047, 1175, 1568], { dur: 0.1, gap: 0.07, pulse: 0.5, vol: 0.13 }); break;
            default: this.arp([988, 1319], { dur: 0.1, gap: 0.06, pulse: 0.5, vol: 0.1 });   // a medal
        }
    }

    waveStart(e) {
        const sector = Math.floor((e.n - 1) / 5);
        const lvl = 1 + ((e.n - 1) % 5);
        if (e.kind === 'boss') {
            for (let k = 0; k < 5; k++) this.tone({ freq: k % 2 ? 440 : 660, to: k % 2 ? 660 : 440, dur: 0.3, type: 'sawtooth', vol: 0.1, delay: k * 0.3 });
            this.setMusic('boss', e.boss);
        } else if (e.kind === 'bonus') {
            this.arp([784, 988, 1175, 1568, 1175, 1568, 1976], { dur: 0.08, gap: 0.06, pulse: 0.25, vol: 0.1 });
            this.setMusic('bonus', sector);
        } else {
            this.arp([392, 494, 587, 784], { dur: 0.1, gap: 0.075, pulse: 0.5, vol: 0.1 });
            this.setMusic('play', sector, Math.min(4, lvl));
        }
    }
}
