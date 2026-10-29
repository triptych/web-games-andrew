// Procedural sound, all Web Audio, no files. Effects answer simulation events; the rolling rumble and
// helicopter chop are continuous beds driven from the game state each frame. The context is made
// on the first user gesture (browsers block audio before one), and ../lib/page-audio.js suspends it
// while the tab is hidden.

import { Music } from './music.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// a pentatonic ladder for the "bloop" of swallowing things: it never sounds wrong
const PENTA = [0, 2, 4, 7, 9];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.last = {};            // throttle: name → last time it played
        this.eatN = 0;
        this.music = new Music(this);
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.5; this.musicBus.connect(comp);
        // one second of white noise, reused by every noisy sound
        const n = ctx.sampleRate;
        const buf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        this.makeBeds();
        this.music.attach(ctx, this.musicBus);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    get ready() { return !!this.ctx && this.ctx.state === 'running'; }

    // ---------------------------------------------------------------- building blocks

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, attack = 0.008, lp = 0 } = {}) {
        if (!this.ready) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let out = o;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
        out.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.03);
    }

    /** A burst of filtered noise: crunch, boom, whoosh. */
    noise({ dur = 0.2, vol = 0.2, from = 2000, to = from, type = 'lowpass', q = 0.7, delay = 0, attack = 0.005 } = {}) {
        if (!this.ready) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(from, t);
        if (to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.03);
    }

    /** True at most once per `gap` seconds for this name. */
    gate(name, gap) {
        if (!this.ctx) return false;
        const now = this.ctx.currentTime;
        if (now - (this.last[name] ?? -9) < gap) return false;
        this.last[name] = now;
        return true;
    }

    note(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    /** The click and hiss of a radio opening and closing around the commander's voice. */
    radio(kind) {
        if (!this.ready) return;
        if (kind === 'open') {
            this.noise({ dur: 0.1, vol: 0.12, from: 2600, to: 1800, type: 'bandpass', q: 1.2 });
            this.tone({ freq: 1500, dur: 0.05, type: 'square', vol: 0.05, lp: 3000 });
        } else this.noise({ dur: 0.07, vol: 0.1, from: 2200, to: 1200, type: 'bandpass' });
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, to: 880, dur: 0.07, type: 'triangle', vol: 0.14 });
        else if (kind === 'open') { this.tone({ freq: 440, to: 660, dur: 0.1, type: 'triangle', vol: 0.14 }); this.tone({ freq: 660, to: 990, dur: 0.1, type: 'triangle', vol: 0.1, delay: 0.06 }); }
        else if (kind === 'close') this.tone({ freq: 660, to: 380, dur: 0.1, type: 'triangle', vol: 0.14 });
        else if (kind === 'perk') [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.16, delay: i * 0.06 }));
    }

    // ---------------------------------------------------------------- continuous beds

    makeBeds() {
        const ctx = this.ctx;
        // the rolling rumble
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf; src.loop = true;
        this.rollF = ctx.createBiquadFilter(); this.rollF.type = 'lowpass'; this.rollF.frequency.value = 200; this.rollF.Q.value = 2;
        this.rollG = ctx.createGain(); this.rollG.gain.value = 0;
        src.connect(this.rollF); this.rollF.connect(this.rollG); this.rollG.connect(this.sfx);
        src.start();
        // helicopter chop: noise whose volume is chopped by a 11 Hz oscillator
        const src2 = ctx.createBufferSource();
        src2.buffer = this.noiseBuf; src2.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.2;
        const chop = ctx.createGain(); chop.gain.value = 0.5;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 11; lfo.type = 'square';
        const lg = ctx.createGain(); lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(chop.gain);
        this.chopG = ctx.createGain(); this.chopG.gain.value = 0;
        src2.connect(bp); bp.connect(chop); chop.connect(this.chopG); this.chopG.connect(this.sfx);
        src2.start(); lfo.start();
    }

    /** Per frame: rumble follows speed, chop follows the nearest helicopter. */
    onFrame(G, playing) {
        if (!this.ready) return;
        const t = this.ctx.currentTime;
        let rumble = 0, chop = 0;
        if (playing && G.phase === 'play') {
            const b = G.ball, sp = Math.hypot(b.vx, b.vy);
            rumble = b.z > 0.2 ? 0 : clamp(sp / 14, 0, 1) * (0.1 + Math.min(0.12, b.r * 0.03));
            this.rollF.frequency.setTargetAtTime(120 + sp * 28 + b.r * 20, t, 0.05);
            let nearest = 99;
            for (const f of G.foes) if (f.k === 'heli') nearest = Math.min(nearest, Math.hypot(f.x - b.x, f.y - b.y));
            chop = nearest < 60 ? clamp(1 - nearest / 60, 0, 1) * 0.16 : 0;
        }
        this.rollG.gain.setTargetAtTime(rumble, t, 0.06);
        this.chopG.gain.setTargetAtTime(chop, t, 0.1);
    }

    // ---------------------------------------------------------------- events

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'eat': {
                    if (e.k === 'rubble') { if (this.gate('rub', 0.05)) this.tone({ freq: 900 + Math.random() * 300, to: 500, dur: 0.04, type: 'square', vol: 0.03 }); break; }
                    if (!this.gate('eat', 0.03)) break;
                    const oct = e.size < 0.3 ? 1 : e.size < 0.7 ? 0 : -1;
                    const m = 72 + 12 * oct + PENTA[this.eatN++ % PENTA.length];
                    this.tone({ freq: this.note(m), to: this.note(m) * 1.5, dur: 0.1, type: 'sine', vol: 0.16 });
                    this.tone({ freq: this.note(m + 12), dur: 0.08, type: 'triangle', vol: 0.05, delay: 0.02 });
                    break;
                }
                case 'bounce': {
                    if (!this.gate('bounce', 0.07)) break;
                    const v = clamp(e.speed / 12, 0.1, 1);
                    this.tone({ freq: 190, to: 60, dur: 0.14, type: 'sine', vol: 0.3 * v });
                    this.noise({ dur: 0.08, vol: 0.14 * v, from: 1800, to: 400 });
                    break;
                }
                case 'floors':
                    if (this.gate('floors', 0.06)) {
                        this.noise({ dur: 0.3, vol: 0.28, from: 2400, to: 250, type: 'bandpass', q: 0.8 });
                        this.tone({ freq: 110, to: 40, dur: 0.25, type: 'sine', vol: 0.3 });
                    }
                    break;
                case 'collapse':
                    this.noise({ dur: 1.6, vol: 0.5, from: 700, to: 50, q: 0.6 });
                    this.noise({ dur: 0.5, vol: 0.3, from: 3000, to: 400, type: 'bandpass', delay: 0.05 });
                    this.tone({ freq: 80, to: 28, dur: 1.2, type: 'sine', vol: 0.5 });
                    break;
                case 'pounce':
                    this.tone({ freq: 200, to: 620, dur: 0.22, type: 'sine', vol: 0.22 });
                    this.noise({ dur: 0.25, vol: 0.1, from: 500, to: 2500, type: 'bandpass' });
                    break;
                case 'slam':
                    this.tone({ freq: 140, to: 32, dur: 0.5, type: 'sine', vol: 0.65 });
                    this.noise({ dur: 0.45, vol: 0.4, from: 1400, to: 90 });
                    this.tone({ freq: 70, to: 40, dur: 0.6, type: 'triangle', vol: 0.3, delay: 0.02 });
                    break;
                case 'boom':
                    if (!this.gate('boom', 0.05)) break;
                    this.noise({ dur: 0.55, vol: 0.4, from: 1600, to: 70 });
                    this.tone({ freq: 100, to: 30, dur: 0.45, type: 'sine', vol: 0.4 });
                    break;
                case 'shot':
                    if (e.k === 'missile') this.noise({ dur: 0.5, vol: 0.14, from: 800, to: 3000, type: 'bandpass', q: 1.5 });
                    else { this.noise({ dur: 0.18, vol: 0.28, from: 1400, to: 200 }); this.tone({ freq: 220, to: 60, dur: 0.18, type: 'square', vol: 0.18 }); }
                    break;
                case 'smash':
                    if (e.k === 'tank' || e.k === 'heli') {
                        this.tone({ freq: 320, to: 90, dur: 0.25, type: 'square', vol: 0.2 });
                        this.noise({ dur: 0.35, vol: 0.3, from: 2600, to: 300, type: 'bandpass' });
                    } else if (this.gate('smash', 0.04)) this.noise({ dur: 0.12, vol: 0.15, from: 2200, to: 500, type: 'bandpass' });
                    break;
                case 'hurt':
                    this.tone({ freq: 330, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.28, lp: 1500 });
                    this.noise({ dur: 0.2, vol: 0.25, from: 1200, to: 200 });
                    break;
                case 'shield': this.tone({ freq: 900, to: 1500, dur: 0.12, type: 'sine', vol: 0.18 }); break;
                case 'deflect': this.tone({ freq: 1500, to: 900, dur: 0.1, type: 'triangle', vol: 0.12 }); break;
                case 'die':
                    this.tone({ freq: 500, to: 50, dur: 1.1, type: 'sawtooth', vol: 0.3, lp: 1800 });
                    this.noise({ dur: 0.9, vol: 0.4, from: 2000, to: 60 });
                    break;
                case 'respawn': [392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.18, delay: i * 0.07 })); break;
                case 'power': [523, 659, 784, 988, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.18, delay: i * 0.05 })); break;
                case 'heal': this.tone({ freq: 660, dur: 0.1, type: 'sine', vol: 0.18 }); this.tone({ freq: 880, dur: 0.16, type: 'sine', vol: 0.18, delay: 0.09 }); break;
                case 'grow': [440, 554, 659].forEach((f, i) => this.tone({ freq: f, to: f * 1.02, dur: 0.14, type: 'triangle', vol: 0.15, delay: i * 0.06 })); break;
                case 'combo': {
                    const base = 60 + Math.min(12, e.mult * 2);
                    [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: this.note(base + s), dur: 0.12, type: 'square', vol: 0.1, delay: i * 0.04, lp: 3000 }));
                    break;
                }
                case 'wave':
                    if (e.k === 'tank') { this.tone({ freq: 196, dur: 0.22, type: 'sawtooth', vol: 0.2, lp: 1200 }); this.tone({ freq: 196, dur: 0.22, type: 'sawtooth', vol: 0.2, lp: 1200, delay: 0.3 }); }
                    break;
                case 'warn':
                    for (let i = 0; i < 4; i++) this.tone({ freq: i % 2 ? 620 : 880, dur: 0.2, type: 'square', vol: 0.12, delay: i * 0.22, lp: 2200 });
                    break;
                case 'drop': this.tone({ freq: 900, to: 300, dur: 0.5, type: 'sine', vol: 0.1 }); break;
                case 'clear': this.fanfare([60, 64, 67, 72, 76, 79, 84], 0.11); break;
                case 'win': this.fanfare([60, 64, 67, 72, 67, 72, 76, 79, 84, 88], 0.14); break;
                case 'over':
                    [392, 370, 349, 330].forEach((f, i) => this.tone({ freq: f, dur: 0.42, type: 'sawtooth', vol: 0.18, delay: i * 0.4, lp: 1000 }));
                    break;
                case 'level': this.tone({ freq: 220, to: 440, dur: 0.4, type: 'triangle', vol: 0.2 }); break;
                default: break;
            }
        }
    }

    fanfare(notes, step) {
        notes.forEach((m, i) => {
            this.tone({ freq: this.note(m), dur: 0.3, type: 'sawtooth', vol: 0.14, delay: i * step, lp: 2600 });
            this.tone({ freq: this.note(m - 12), dur: 0.3, type: 'triangle', vol: 0.12, delay: i * step });
        });
    }
}
