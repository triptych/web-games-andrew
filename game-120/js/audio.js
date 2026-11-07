// Procedural sound, all Web Audio, no files. Effects answer simulation events; the walker has an engine
// hum, the planet has wind, and a small look-ahead sequencer plays a combat score whose tempo and layers
// follow how much trouble you are in. The context is made on the first user gesture (browsers block audio
// before one), and ../lib/page-audio.js suspends it while the tab is hidden.

import { WEAPONS } from './sim/data.js';

export class Audio {
    constructor() {
        this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.55;
        this.lastT = {}; this.intensity = 0; this.step16 = 0; this.nextT = 0; this.boss = false; this.windG = 0.15;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 1.5; this.music.connect(comp);
        // a short noise reverb for explosions and the score
        const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb = ctx.createConvolver(); this.verb.buffer = buf;
        this.verbG = ctx.createGain(); this.verbG.gain.value = 0.35; this.verb.connect(this.verbG); this.verbG.connect(this.sfx);
        // shared noise
        const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        // continuous: a very soft reactor murmur (noise, not an oscillator: a saw hum sounds like a motorboat), a thruster roar, wind
        this.engSrc = ctx.createBufferSource(); this.engSrc.buffer = nb; this.engSrc.loop = true;
        this.engF = ctx.createBiquadFilter(); this.engF.type = 'bandpass'; this.engF.frequency.value = 170; this.engF.Q.value = 1.4;
        this.engG = ctx.createGain(); this.engG.gain.value = 0;
        this.engSrc.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.sfx); this.engSrc.start();
        this.thrSrc = ctx.createBufferSource(); this.thrSrc.buffer = nb; this.thrSrc.loop = true;
        this.thrF = ctx.createBiquadFilter(); this.thrF.type = 'lowpass'; this.thrF.frequency.value = 700;
        this.thrG = ctx.createGain(); this.thrG.gain.value = 0;
        this.thrSrc.connect(this.thrF); this.thrF.connect(this.thrG); this.thrG.connect(this.sfx); this.thrSrc.start();
        this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = nb; this.windSrc.loop = true;
        this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 420; this.windF.Q.value = 0.6;
        this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
        this.windSrc.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.sfx); this.windSrc.start();
        this.beamOsc = ctx.createOscillator(); this.beamOsc.type = 'sawtooth'; this.beamOsc.frequency.value = 90;
        this.beamG = ctx.createGain(); this.beamG.gain.value = 0; this.beamOsc.connect(this.beamG); this.beamG.connect(this.sfx); this.beamOsc.start();
        // a tap on the master for the tests: is anything audible?
        this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; comp.connect(this.analyser); this.abuf = new Float32Array(1024);
        this.musicSteps = 0;
        this.nextT = ctx.currentTime + 0.2;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 1.5, this.ctx.currentTime, 0.02);
    }

    /** One leg planting: a weighty thud, a metal clank and a hiss of hydraulics. Bigger walkers sound lower and heavier. */
    footstep(scale = 1) {
        if (!this.ok('step', 38)) return;
        const k = Math.min(2.6, Math.max(0.6, scale));
        this.tone({ freq: 118 / Math.pow(k, 0.6), to: 42, dur: 0.13, type: 'sine', vol: 0.12 + 0.05 * k });
        this.noise({ dur: 0.09, from: 1000, to: 140, vol: 0.07 + 0.03 * k });
        this.tone({ freq: 1500 + Math.random() * 500, to: 700, dur: 0.035, type: 'square', vol: 0.02 });
        this.tone({ freq: 620 + Math.random() * 120, to: 410, dur: 0.05, type: 'triangle', vol: 0.025 });
        this.noise({ dur: 0.08, from: 4200, to: 2400, vol: 0.022 + 0.01 * k, type: 'highpass' });
    }
    /** A boss's foot, from a distance: a deep boom that fades with range. */
    bossStep(dist) {
        const v = Math.max(0, 1 - dist / 140);
        if (v <= 0.02 || !this.ok('bstep', 160)) return;
        this.tone({ freq: 62, to: 26, dur: 0.4, type: 'sine', vol: 0.34 * v });
        this.noise({ dur: 0.25, from: 500, to: 70, vol: 0.2 * v });
    }
    /** Colonists beaming out: a rising shimmer. */
    teleport() {
        this.tone({ freq: 380, to: 2400, dur: 0.7, type: 'sine', vol: 0.14 });
        this.tone({ freq: 760, to: 3200, dur: 0.7, type: 'triangle', vol: 0.07, delay: 0.05 });
        this.noise({ dur: 0.8, from: 2000, to: 9000, vol: 0.05, type: 'highpass' });
    }
    /** Peak of the master bus since the last call (for the tests). */
    level() { if (!this.analyser) return 0; this.analyser.getFloatTimeDomainData(this.abuf); let m = 0; for (const x of this.abuf) m = Math.max(m, Math.abs(x)); return m; }

    ok(key, gap) { const t = performance.now(); if (t - (this.lastT[key] || 0) < gap) return false; this.lastT[key] = t; return !!this.ctx && this.ctx.state === 'running'; }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus = null } = {}) {
        const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.02);
    }
    noise({ dur = 0.2, from = 4000, to = 200, vol = 0.3, type = 'lowpass', delay = 0, q = 0.7, verb = false } = {}) {
        const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx); if (verb) g.connect(this.verb);
        s.start(t, Math.random()); s.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 700, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 700, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 700, to: 440, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'buy') { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.15, delay: i * 0.06 })); this.noise({ dur: 0.3, from: 6000, to: 2000, vol: 0.12, type: 'highpass' }); }
        else if (kind === 'deny') this.tone({ freq: 160, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.14 });
        else if (kind === 'radio') { this.tone({ freq: 1320, dur: 0.05, type: 'square', vol: 0.06 }); this.tone({ freq: 990, dur: 0.07, type: 'square', vol: 0.06, delay: 0.06 }); }
    }

    gun(tier, enemy = false) {
        if (!this.ok(enemy ? 'eg' : 'pg', enemy ? 40 : 22)) return;
        if (enemy) { this.tone({ freq: 520, to: 150, dur: 0.1, type: 'square', vol: 0.05 }); return; }
        const w = WEAPONS[tier];
        switch (tier) {
            case 0: this.tone({ freq: 1000, to: 280, dur: 0.07, type: 'square', vol: 0.09 }); break;
            case 1: this.noise({ dur: 0.05, from: 5000, to: 800, vol: 0.14 }); this.tone({ freq: 150, to: 60, dur: 0.07, type: 'square', vol: 0.12 }); break;
            case 2: this.tone({ freq: 500, to: 120, dur: 0.14, type: 'sine', vol: 0.16 }); this.noise({ dur: 0.08, from: 3000, to: 400, vol: 0.08 }); break;
            case 3: this.tone({ freq: 1600, to: 300, dur: 0.12, type: 'sawtooth', vol: 0.09 }); this.tone({ freq: 800, to: 150, dur: 0.18, type: 'sine', vol: 0.1 }); break;
            case 4: this.noise({ dur: 0.18, from: 9000, to: 300, vol: 0.28 }); this.tone({ freq: 90, to: 35, dur: 0.25, type: 'sine', vol: 0.3 }); this.tone({ freq: 3000, to: 600, dur: 0.12, type: 'triangle', vol: 0.08 }); break;
            default: this.noise({ dur: 0.1, from: 3500, to: 200, vol: 0.2 }); this.tone({ freq: 80, to: 40, dur: 0.12, type: 'square', vol: 0.18 });
        }
        void w;
    }

    boom(size) {
        if (!this.ok('boom' + (size > 2 ? 'b' : 's'), size > 2 ? 60 : 35)) return;
        const S = Math.min(5, size);
        this.noise({ dur: 0.25 + S * 0.22, from: 2400 + S * 400, to: 70, vol: 0.18 + S * 0.07, verb: S >= 2 });
        this.tone({ freq: 120 + (5 - S) * 20, to: 28, dur: 0.3 + S * 0.2, type: 'sine', vol: 0.18 + S * 0.08 });
        if (S >= 3) this.noise({ dur: 1.1, from: 500, to: 50, vol: 0.2, delay: 0.08, verb: true });
        if (S >= 4) this.tone({ freq: 60, to: 22, dur: 1.4, type: 'triangle', vol: 0.3 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'shot':
                    if (e.team === 'p' && e.kind === 'missile') { if (this.ok('msl', 40)) { this.noise({ dur: 0.5, from: 600, to: 3000, vol: 0.14, type: 'bandpass', q: 1.5 }); this.tone({ freq: 140, to: 320, dur: 0.4, type: 'sawtooth', vol: 0.08 }); } }
                    else if (e.team === 'p') this.gun(e.tier ?? 0);
                    else if (e.heavy) { if (this.ok('eh', 80)) { this.noise({ dur: 0.35, from: 800, to: 120, vol: 0.18 }); this.tone({ freq: 90, to: 45, dur: 0.3, type: 'sawtooth', vol: 0.12 }); } }
                    else this.gun(0, true);
                    break;
                case 'boom': this.boom(e.size || 2); break;
                case 'hit': if (this.ok('hit', 45)) this.tone({ freq: 1800, to: 900, dur: 0.03, type: 'square', vol: 0.05 }); break;
                case 'ping': if (this.ok('ping', 60)) this.tone({ freq: e.shield ? 1400 : 2200, to: 800, dur: 0.08, type: 'triangle', vol: 0.08 }); break;
                case 'impact': if (this.ok('imp', 45)) this.noise({ dur: 0.07, from: 4000, to: 800, vol: 0.05, type: 'bandpass' }); break;
                case 'hurt': if (this.ok('hurt', 90)) { this.tone({ freq: 90, to: 45, dur: 0.18, type: 'sawtooth', vol: 0.2 }); this.noise({ dur: 0.14, from: 1400, to: 200, vol: 0.14 }); } break;
                case 'jump': this.noise({ dur: 0.4, from: 400, to: 2400, vol: 0.2, type: 'bandpass', q: 1 }); this.tone({ freq: 90, to: 200, dur: 0.3, type: 'sawtooth', vol: 0.1 }); break;
                case 'land': this.tone({ freq: 80, to: 30, dur: 0.3, type: 'sine', vol: 0.35 }); this.noise({ dur: 0.3, from: 900, to: 100, vol: 0.2 }); break;
                case 'stomp': this.tone({ freq: 70, to: 24, dur: 0.6, type: 'sine', vol: 0.4 }); this.noise({ dur: 0.5, from: 700, to: 60, vol: 0.25 }); break;
                case 'pickup': {
                    const f = e.kind === 'scrap' ? [880, 1320] : e.kind === 'hp' ? [660, 990, 1320] : e.kind === 'fuel' ? [520, 780] : [740, 1110];
                    f.forEach((x, i) => this.tone({ freq: x, dur: 0.09, type: 'triangle', vol: 0.12, delay: i * 0.05 })); break;
                }
                case 'rescue': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.16, delay: i * 0.07 })); this.noise({ dur: 1.2, from: 1800, to: 900, vol: 0.12, type: 'bandpass', delay: 0.2, q: 0.5 }); break;
                case 'podhit': if (this.ok('pod', 60)) this.tone({ freq: 300, to: 240, dur: 0.08, type: 'square', vol: 0.1 }); break;
                case 'bossStart': [110, 104, 98].forEach((f, i) => this.tone({ freq: f, to: f * 0.8, dur: 1.2, type: 'sawtooth', vol: 0.22, delay: i * 0.3 })); this.boss = true; break;
                case 'bossPhase': this.tone({ freq: 220, to: 55, dur: 1.4, type: 'sawtooth', vol: 0.3 }); this.tone({ freq: 233, to: 58, dur: 1.4, type: 'sawtooth', vol: 0.3 }); this.noise({ dur: 1.4, from: 3000, to: 80, vol: 0.3, verb: true }); break;
                case 'bossDown': this.boss = false; [0, 0.25, 0.5, 0.8].forEach((d) => this.noise({ dur: 1.2, from: 2000, to: 60, vol: 0.3, delay: d, verb: true })); break;
                case 'shieldDown': this.tone({ freq: 900, to: 90, dur: 0.8, type: 'sawtooth', vol: 0.2 }); break;
                case 'tele': if (this.ok('tele', 150)) this.tone({ freq: 300, to: 600, dur: 0.25, type: 'sawtooth', vol: 0.07 }); break;
                case 'drop': this.noise({ dur: 0.5, from: 1200, to: 80, vol: 0.25 }); break;
                case 'dive': case 'erupt': this.noise({ dur: 0.8, from: 800, to: 60, vol: 0.3, verb: true }); this.tone({ freq: 55, to: 25, dur: 0.9, type: 'sine', vol: 0.35 }); break;
                case 'tremor': if (this.ok('trem', 200)) this.tone({ freq: 40, to: 30, dur: 0.4, type: 'sine', vol: 0.2 }); break;
                case 'smash': this.noise({ dur: 0.4, from: 3000, to: 200, vol: 0.3 }); break;
                case 'radio': this.ui('radio'); break;
                case 'upgrade': this.ui('buy'); break;
                case 'levelComplete': case 'victory': [392, 494, 587, 784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.18, delay: i * 0.13 })); break;
                case 'dead': [220, 165, 110, 82].forEach((f, i) => this.tone({ freq: f, dur: 0.7, type: 'sawtooth', vol: 0.18, delay: i * 0.2 })); this.boss = false; break;
                case 'storm': this.windG = e.on ? 0.55 : 0.15; break;
                default: break;
            }
        }
    }

    /** Called every frame: walker hum, wind, beam and the score. */
    update(G, dt, playing, wind = 0.4) {
        const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime;
        const p = G.player, sp = playing ? Math.hypot(p.vx, p.vz) : 0;
        this.engG.gain.setTargetAtTime(playing ? 0.012 + Math.min(0.03, sp * 0.003) : 0, t, 0.15);
        this.engF.frequency.setTargetAtTime(150 + sp * 14, t, 0.15);
        this.thrG.gain.setTargetAtTime(playing && (p.boosting || p.jetting) ? (p.jetting ? 0.1 : 0.07) : 0, t, 0.06);
        this.thrF.frequency.setTargetAtTime(p.jetting ? 900 : 650, t, 0.1);
        this.windGain.gain.setTargetAtTime((0.05 + wind * 0.1) * this.windG * (playing ? 1 : 0.6) * 3, t, 0.4);
        this.windF.frequency.setTargetAtTime(380 + Math.sin(t * 0.3) * 160 + (this.windG > 0.3 ? 500 : 0), t, 0.5);
        const bm = G.enemies.find((e) => e.b && e.b.act && e.b.act.k === 'beam' && e.b.act.on);
        this.beamG.gain.setTargetAtTime(bm ? 0.1 : 0, t, 0.05); if (bm) this.beamOsc.frequency.setTargetAtTime(70 + Math.sin(t * 40) * 12, t, 0.02);
        // intensity: how many awake enemies are near
        let near = 0; for (const e of G.enemies) if (e.awake && e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 60) near++;
        const want = playing ? Math.min(1, near / 9 + (this.boss ? 0.6 : 0)) : 0.25;
        this.intensity += (want - this.intensity) * Math.min(1, dt * 0.8);
        this.sequence(t);
    }

    // ---------------------------------------------------------------- the score
    // D minor, in the range small speakers can play: a pad, a mid bass, a plucked arpeggio, a snare you can hear.
    pad(freqs, dur, delay) {
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(600, t + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075, t + 0.5); g.gain.setValueAtTime(0.075, t + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        f.connect(g); g.connect(this.music); g.connect(this.verb);
        for (const fr of freqs) for (const det of [-7, 7]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.05);
        }
    }
    voice(freq, dur, delay, { type = 'sawtooth', vol = 0.1, cut = 900, attack = 0.005 } = {}) {
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.35), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.03);
    }
    drum(kind, delay, vol = 1) {
        const ctx = this.ctx, t = ctx.currentTime + delay;
        if (kind === 'kick') {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
            g.gain.setValueAtTime(0.55 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25);
            this.mnoise(0.025, 3000, 1200, 0.18 * vol, 'highpass', delay);          // the click that carries the kick on small speakers
        } else if (kind === 'snare') {
            this.mnoise(0.17, 2600, 1200, 0.28 * vol, 'bandpass', delay, 0.8);
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
            g.gain.setValueAtTime(0.22 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.12);
        } else this.mnoise(kind === 'open' ? 0.16 : 0.035, 9000, 6500, (kind === 'open' ? 0.1 : 0.08) * vol, 'highpass', delay);
    }
    mnoise(dur, from, to, vol, type, delay, q = 0.7) {
        const ctx = this.ctx, t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this.noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    }

    sequence(t) {
        if (this.musicVol <= 0.01) { this.nextT = Math.max(this.nextT, t); return; }
        const I = this.intensity, boss = this.boss;
        const bpm = 98 + I * 32 + (boss ? 10 : 0), step = 60 / bpm / 4;
        // Dm, Bb, Gm, A: roots an octave above the bottom so the bass is heard, triads in octave 3
        const chords = [[146.83, 174.61, 220], [116.54, 146.83, 174.61], [98, 116.54, 146.83], [110, 138.59, 164.81]];
        const roots = [73.42, 58.27, 49, 55];
        const arp = [[0, 1, 2, 1], [0, 1, 2, 1], [0, 1, 2, 1], [0, 1, 2, 1]];
        if (this.nextT < t - 0.5) this.nextT = t + 0.05;               // a long pause (a hidden tab) restarts the bar instead of catching up
        while (this.nextT < t + 0.4) {
            const s = this.step16++, tt = this.nextT; this.nextT += step; this.musicSteps++;
            const bar = (s >> 4) & 3, n = s & 15, ch = chords[bar], d = Math.max(0, tt - t);
            if (n === 0) this.pad(ch, step * 16, d);
            // bass: eighths, an octave up on the offbeat, harmonics from the saw so it is heard on small speakers
            if (n % 2 === 0) { const f = roots[bar] * (n % 4 === 2 && I > 0.35 ? 2 : 1) * 2; this.voice(f, step * 1.7, d, { vol: 0.24 + I * 0.06, cut: 1100 }); }
            // plucked arpeggio, denser as the fight heats up
            const dense = I > 0.55 ? 1 : I > 0.25 ? 2 : 4;
            if (n % dense === 0) { const f = ch[arp[bar][(n / dense | 0) % 4]] * 2; this.voice(f, step * 1.6, d, { type: 'square', vol: 0.075 + I * 0.03, cut: 2600, attack: 0.003 }); }
            // a melody over bars 2 and 4 once there is a fight
            if (I > 0.4 && (bar === 1 || bar === 3) && [0, 6, 10, 12].includes(n)) { const m = bar === 1 ? [587.3, 698.5, 880, 784][[0, 6, 10, 12].indexOf(n)] : [523.3, 587.3, 659.3, 880][[0, 6, 10, 12].indexOf(n)]; this.voice(m, step * 3, d, { type: 'triangle', vol: 0.13, cut: 4000, attack: 0.01 }); }
            // drums
            if (n === 0 || n === 8 || (I > 0.45 && n === 10) || (boss && n === 14)) this.drum('kick', d);
            if (n === 4 || n === 12) this.drum('snare', d, 0.7 + I * 0.4);
            if (n % 2 === 0 && I > 0.15) this.drum('hat', d, 0.6 + (n % 4 === 2 ? 0.4 : 0));
            if (I > 0.6 && n === 14) this.drum('open', d);
            // a boss adds a sour stab on the beat
            if (boss && (n === 0 || n === 6)) this.voice(207.65, step * 2.5, d, { vol: 0.09, cut: 1400 });
        }
    }
}
