// Procedural sound and music, all Web Audio, no files.
// Effects answer simulation events; loops follow Thimble (drill, vanes, heat);
// the music is generated per stratum by a small look-ahead sequencer.

import { ORES } from './config.js';

const SCALES = {
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11],
    phrydom: [0, 1, 4, 5, 7, 8, 10], whole: [0, 2, 4, 6, 8, 10, 12], penta: [0, 3, 5, 7, 10, 12, 15],
};

// Each zone: tempo, root (MIDI), scale, chord roots (scale degrees), and which voices play.
const ZONES = {
    title:    { tempo: 76,  root: 55, scale: 'lydian',   chords: [0, 3, 4, 0],  pad: 0.5, arp: 'up',    arpVol: 0.06, bass: 0.07, melody: 0.35, bell: 0.1, timbre: 'harp' },
    town:     { tempo: 96,  root: 50, scale: 'dorian',   chords: [0, 3, 0, 6],  pad: 0.25, arp: 'lute', arpVol: 0.075, bass: 0.09, melody: 0.45, bell: 0, timbre: 'lute', flute: true },
    loam:     { tempo: 72,  root: 57, scale: 'penta',    chords: [0, 2, 3, 1],  pad: 0.35, arp: 'sparse', arpVol: 0.06, bass: 0.06, melody: 0.15, bell: 0.08, timbre: 'harp' },
    grey:     { tempo: 64,  root: 52, scale: 'phrygian', chords: [0, 1, 0, 6],  pad: 0.45, arp: null, arpVol: 0, bass: 0.08, melody: 0.08, bell: 0.16, timbre: 'bell' },
    glimmer:  { tempo: 78,  root: 53, scale: 'lydian',   chords: [0, 1, 4, 3],  pad: 0.4, arp: 'up',     arpVol: 0.05, bass: 0.05, melody: 0.1, bell: 0.3, timbre: 'glass' },
    kharadun: { tempo: 62,  root: 50, scale: 'harmonic', chords: [0, 5, 3, 4],  pad: 0.5, arp: null, arpVol: 0, bass: 0.1, melody: 0.18, bell: 0.12, timbre: 'horn' },
    ember:    { tempo: 70,  root: 48, scale: 'phrydom',  chords: [0, 1, 0, 6],  pad: 0.45, arp: 'pulse', arpVol: 0.05, bass: 0.12, melody: 0.06, bell: 0.05, timbre: 'horn' },
    gloam:    { tempo: 48,  root: 45, scale: 'whole',    chords: [0, 1, 0, 2],  pad: 0.55, arp: null, arpVol: 0, bass: 0.08, melody: 0.03, bell: 0.1, timbre: 'glass' },
    wyrm:     { tempo: 132, root: 50, scale: 'aeolian',  chords: [0, 5, 3, 4],  pad: 0.25, arp: 'ostinato', arpVol: 0.07, bass: 0.13, melody: 0.12, bell: 0, timbre: 'horn', drums: true },
    ending:   { tempo: 80,  root: 55, scale: 'major',    chords: [0, 4, 5, 3],  pad: 0.55, arp: 'up', arpVol: 0.05, bass: 0.08, melody: 0.45, bell: 0.2, timbre: 'harp', flute: true },
};
const ZONE_OF_STRATUM = ['loam', 'grey', 'glimmer', 'kharadun', 'ember', 'gloam', 'gloam'];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.zone = null;
        this.step = 0;
        this.nextT = 0;
        this.seed = 1;
        this.lastMelody = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain(); this.master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.55; this.music.connect(this.master);
        this.zoneGain = ctx.createGain(); this.zoneGain.gain.value = 1; this.zoneGain.connect(this.music);
        // reverb
        this.verb = ctx.createConvolver();
        this.verb.buffer = this._impulse(2.8, 2.2);
        this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.5;
        this.verbSend.connect(this.verb); this.verb.connect(this.master);
        // noise
        const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this._loops();
        this.nextT = ctx.currentTime + 0.1;
    }

    _impulse(sec, decay) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        }
        return b;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
        this.music.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------------
    // Building blocks
    // ------------------------------------------------------------------
    tone(freq, dur, o = {}) {
        const ctx = this.ctx; if (!ctx) return;
        const t = o.when ?? ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t + (o.glideT ?? dur));
        if (o.detune) osc.detune.value = o.detune;
        const g = ctx.createGain();
        const vol = o.vol ?? 0.2, a = o.attack ?? 0.005;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = g;
        if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q ?? 0.7; g.connect(f); node = f; }
        osc.connect(g);
        node.connect(o.bus || this.sfx);
        if (o.verb) node.connect(this.verbSend);
        if (o.vib) {
            const l = ctx.createOscillator(), lg = ctx.createGain();
            l.frequency.value = o.vib; lg.gain.value = freq * 0.012;
            l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
        }
        osc.start(t); osc.stop(t + dur + 0.05);
    }

    noise(dur, o = {}) {
        const ctx = this.ctx; if (!ctx) return;
        const t = o.when ?? ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = o.filter || 'lowpass';
        f.frequency.setValueAtTime(o.freq ?? 1200, t);
        if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
        f.Q.value = o.q ?? 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + (o.attack ?? 0.005));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(o.bus || this.sfx);
        if (o.verb) g.connect(this.verbSend);
        src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    }

    _loops() {
        const ctx = this.ctx;
        const mk = (filterType, freq, q) => {
            const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
            const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
            const g = ctx.createGain(); g.gain.value = 0;
            src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
            return { f, g };
        };
        // the auger: gritty band noise + a grinding sawtooth with a wobble
        this.drillN = mk('bandpass', 420, 1.6);
        const so = ctx.createOscillator(); so.type = 'sawtooth'; so.frequency.value = 58;
        const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 400;
        const sg = ctx.createGain(); sg.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 17; const lg = ctx.createGain(); lg.gain.value = 9;
        lfo.connect(lg); lg.connect(so.frequency); lfo.start();
        so.connect(sf); sf.connect(sg); sg.connect(this.sfx); so.start();
        this.drillSaw = { o: so, g: sg };
        // the vanes: breathy whoosh + a low hum
        this.thrustN = mk('lowpass', 700, 0.6);
        const ho = ctx.createOscillator(); ho.type = 'triangle'; ho.frequency.value = 96;
        const hg = ctx.createGain(); hg.gain.value = 0;
        ho.connect(hg); hg.connect(this.sfx); ho.start();
        this.hum = { o: ho, g: hg };
        // heat sizzle and the surface wind
        this.heatN = mk('highpass', 3500, 0.5);
        this.windN = mk('lowpass', 380, 0.4);
        this.caveN = mk('lowpass', 160, 0.8);
    }

    // ------------------------------------------------------------------
    // Per-frame: loops and music
    // ------------------------------------------------------------------
    update(G, dt, mode) {
        const ctx = this.ctx; if (!ctx) return;
        const t = ctx.currentTime;
        const rig = G ? G.rig : null;
        const playing = mode === 'play' && rig && !G.down;
        const drilling = playing && !!rig.drill;
        const hard = drilling ? Math.min(7, 1 + rig.drill.strat) : 1;
        this.drillN.g.gain.setTargetAtTime(drilling ? 0.16 : 0, t, 0.03);
        this.drillN.f.frequency.setTargetAtTime(300 + hard * 90 + (drilling ? Math.random() * 120 : 0), t, 0.05);
        this.drillSaw.g.gain.setTargetAtTime(drilling ? 0.07 : 0, t, 0.03);
        this.drillSaw.o.frequency.setTargetAtTime(48 + hard * 6, t, 0.1);
        const thrust = playing && rig.thrust;
        this.thrustN.g.gain.setTargetAtTime(thrust ? 0.09 : 0, t, 0.06);
        this.thrustN.f.frequency.setTargetAtTime(thrust ? 900 + Math.max(0, rig.vy) * 120 : 500, t, 0.1);
        this.hum.g.gain.setTargetAtTime(playing ? (thrust ? 0.035 : 0.008) : 0, t, 0.1);
        this.hum.o.frequency.setTargetAtTime(thrust ? 120 : 92, t, 0.2);
        this.heatN.g.gain.setTargetAtTime(playing && rig.heat > 0.1 ? Math.min(0.05, rig.heat * 0.02) : 0, t, 0.2);
        const surface = rig ? rig.y > -2 : true;
        this.windN.g.gain.setTargetAtTime(surface && mode !== 'title' ? 0.03 : mode === 'title' ? 0.025 : 0, t, 0.5);
        this.caveN.g.gain.setTargetAtTime(rig && rig.y < -3 && mode === 'play' ? 0.05 : 0, t, 0.5);

        // music zone
        let z = 'title';
        if (mode === 'ending') z = 'ending';
        else if (G && mode !== 'title') {
            if (G.boss && G.boss.active && !G.boss.freed) z = 'wyrm';
            else if (G.story.flags.ending && rig.y > 0) z = 'ending';
            else if (rig.y > -3) z = 'town';
            else z = ZONE_OF_STRATUM[Math.min(6, rig.lastStratum)];
        }
        if (z !== this.zone) this._switchZone(z);
        this._schedule();
    }

    _switchZone(z) {
        const ctx = this.ctx, t = ctx.currentTime;
        this.zone = z;
        this.zoneGain.gain.cancelScheduledValues(t);
        this.zoneGain.gain.setTargetAtTime(0.0001, t, 0.25);
        this.zoneGain.gain.setTargetAtTime(1, t + 1.0, 0.6);
        this.step = 0;
        this.nextT = Math.max(this.nextT, t + 1.0);
    }

    _rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

    _schedule() {
        const ctx = this.ctx;
        const Z = ZONES[this.zone]; if (!Z) return;
        const stepDur = 60 / Z.tempo / 4;
        while (this.nextT < ctx.currentTime + 0.25) {
            this._playStep(Z, this.step, this.nextT, stepDur);
            this.nextT += stepDur;
            this.step = (this.step + 1) % 256;
        }
    }

    _note(Z, degree, octave = 0) {
        const sc = SCALES[Z.scale];
        const n = sc.length;
        const d = ((degree % n) + n) % n;
        const o = Math.floor(degree / n);
        return Z.root + sc[d] + 12 * (o + octave);
    }

    _playStep(Z, s, t, sd) {
        const bus = this.zoneGain;
        const bar = Math.floor(s / 16) % Z.chords.length;
        const beat = s % 16;
        const chord = Z.chords[bar];
        // pad on the bar
        if (beat === 0 && Z.pad) {
            for (const deg of [0, 2, 4]) {
                const f = mtof(this._note(Z, chord + deg, deg === 0 ? -1 : 0));
                for (const det of [-7, 7]) this.tone(f, sd * 16 * 1.05, { type: 'sawtooth', vol: Z.pad * 0.025, attack: sd * 5, lp: 900, bus, detune: det, verb: true });
            }
        }
        // bass
        if (Z.bass && (beat === 0 || (beat === 8 && Z.tempo > 70) || (Z.drums && beat % 4 === 0))) {
            const f = mtof(this._note(Z, chord, -2));
            this.tone(f, sd * (Z.drums ? 3 : 7), { type: Z.drums ? 'sawtooth' : 'triangle', vol: Z.bass, attack: 0.01, lp: Z.drums ? 500 : 700, bus, when: t });
        }
        // arpeggio
        if (Z.arp) {
            let deg = null;
            if (Z.arp === 'up' && beat % 2 === 0) deg = [0, 2, 4, 7, 9, 7, 4, 2][(beat / 2) % 8];
            else if (Z.arp === 'lute' && [0, 3, 6, 8, 10, 12, 14].includes(beat)) deg = [0, 4, 7, 2, 4, 9, 7][[0, 3, 6, 8, 10, 12, 14].indexOf(beat)];
            else if (Z.arp === 'sparse' && beat % 4 === 0 && this._rand() < 0.7) deg = [0, 2, 4, 5][Math.floor(this._rand() * 4)];
            else if (Z.arp === 'pulse' && beat % 4 === 2) deg = 0;
            else if (Z.arp === 'ostinato' && beat % 2 === 0) deg = [0, 0, 7, 0, 5, 0, 4, 2][(beat / 2) % 8];
            if (deg !== null) this._pluck(mtof(this._note(Z, chord + deg, Z.arp === 'ostinato' ? -1 : 0)), sd * 3, Z.arpVol, Z.timbre, t, bus);
        }
        // melody
        if (Z.melody && beat % 4 === 0 && this._rand() < Z.melody) {
            this.lastMelody += Math.floor(this._rand() * 5) - 2;
            this.lastMelody = Math.max(-2, Math.min(9, this.lastMelody));
            const f = mtof(this._note(Z, chord + this.lastMelody, 1));
            const len = sd * (this._rand() < 0.5 ? 4 : 8);
            if (Z.flute) this.tone(f, len * 1.1, { type: 'sine', vol: 0.05, attack: 0.06, vib: 5.5, bus, when: t, verb: true });
            else this._pluck(f, len, 0.06, Z.timbre, t, bus);
        }
        // bells / drips
        if (Z.bell && beat % 2 === 1 && this._rand() < Z.bell * 0.25) {
            const f = mtof(this._note(Z, Math.floor(this._rand() * 7) + 7, 1));
            this.tone(f, 1.6, { type: 'sine', vol: 0.035, bus, when: t, verb: true });
            this.tone(f * 2.76, 0.8, { type: 'sine', vol: 0.012, bus, when: t, verb: true });
        }
        // drums for the wyrm
        if (Z.drums) {
            if (beat % 4 === 0 || beat === 10) this.tone(130, 0.22, { type: 'sine', glide: 40, glideT: 0.18, vol: 0.32, bus, when: t });
            if (beat === 4 || beat === 12) this.noise(0.16, { filter: 'bandpass', freq: 1800, q: 0.7, vol: 0.14, bus, when: t });
            if (beat % 2 === 1) this.noise(0.04, { filter: 'highpass', freq: 7000, vol: 0.04, bus, when: t });
            if (beat === 0 && bar === 0) this.noise(1.2, { filter: 'lowpass', freq: 300, vol: 0.12, bus, when: t });
        }
    }

    _pluck(f, dur, vol, timbre, t, bus) {
        switch (timbre) {
            case 'lute':
                this.tone(f, dur * 1.4, { type: 'triangle', vol, attack: 0.003, lp: 2400, bus, when: t });
                this.tone(f * 2, dur * 0.6, { type: 'sine', vol: vol * 0.35, bus, when: t });
                break;
            case 'harp':
                this.tone(f, dur * 2, { type: 'triangle', vol, attack: 0.004, lp: 3000, bus, when: t, verb: true });
                break;
            case 'bell': case 'glass':
                this.tone(f * 2, dur * 3, { type: 'sine', vol: vol * 0.8, bus, when: t, verb: true });
                this.tone(f * 2 * (timbre === 'glass' ? 3.01 : 2.4), dur * 1.5, { type: 'sine', vol: vol * 0.3, bus, when: t, verb: true });
                break;
            case 'horn':
                this.tone(f, dur * 1.5, { type: 'sawtooth', vol: vol * 0.7, attack: 0.04, lp: 900, bus, when: t, verb: true });
                break;
            default:
                this.tone(f, dur, { type: 'triangle', vol, bus, when: t });
        }
    }

    // ------------------------------------------------------------------
    // One-shots
    // ------------------------------------------------------------------
    ui(kind) {
        if (!this.ctx) return;
        switch (kind) {
            case 'click': this.tone(880, 0.06, { type: 'triangle', vol: 0.08 }); break;
            case 'open': this.tone(520, 0.08, { type: 'triangle', vol: 0.07 }); this.tone(780, 0.12, { type: 'triangle', vol: 0.06, when: this.ctx.currentTime + 0.06 }); break;
            case 'close': this.tone(700, 0.08, { type: 'triangle', vol: 0.06 }); this.tone(470, 0.1, { type: 'triangle', vol: 0.05, when: this.ctx.currentTime + 0.05 }); break;
            case 'deny': this.tone(180, 0.18, { type: 'square', vol: 0.06, lp: 900 }); break;
            case 'coin': this.coins(4); break;
            case 'page': this.noise(0.12, { filter: 'bandpass', freq: 2500, q: 1, vol: 0.05 }); break;
            case 'chapter': [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(62 + s), 0.6, { type: 'triangle', vol: 0.08, when: this.ctx.currentTime + i * 0.09, verb: true })); break;
            default: break;
        }
    }

    blip(who) {
        if (!this.ctx) return;
        const p = { thimble: 300, maren: 520, orla: 180, pell: 640, sedge: 380, mirabel: 460, ansel: 220, corvin: 330, wyrm: 70, ysmereth: 150, narrator: 0 }[who] ?? 300;
        if (!p) return;
        this.tone(p * (0.95 + Math.random() * 0.1), 0.04, { type: who === 'thimble' ? 'square' : 'triangle', vol: 0.025, lp: 2000 });
    }

    coins(n = 5) {
        const t = this.ctx.currentTime;
        for (let i = 0; i < n; i++) {
            const f = 1800 + Math.random() * 900;
            this.tone(f, 0.18, { type: 'triangle', vol: 0.06, when: t + i * 0.055 });
            this.tone(f * 1.5, 0.1, { type: 'sine', vol: 0.03, when: t + i * 0.055 + 0.01 });
        }
    }

    onEvents(G, events) {
        const ctx = this.ctx; if (!ctx) return;
        const t = ctx.currentTime;
        for (const e of events) {
            switch (e.type) {
                case 'dug':
                    if (e.byDrill) { this.noise(0.18, { filter: 'lowpass', freq: 900, vol: 0.14 }); this.tone(90, 0.15, { type: 'sine', glide: 50, vol: 0.12 }); }
                    break;
                case 'ore':
                    if (e.lost) this.tone(140, 0.2, { type: 'square', vol: 0.05, lp: 500 });
                    else {
                        const f = mtof(72 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][e.id]);
                        this.tone(f, 0.5, { type: 'sine', vol: 0.12, verb: true });
                        this.tone(f * 2.01, 0.3, { type: 'sine', vol: 0.04 });
                        if (ORES[e.id].glow > 0.4) this.tone(f * 1.5, 0.7, { type: 'sine', vol: 0.04, when: t + 0.08, verb: true });
                    }
                    break;
                case 'artifact': [0, 4, 7, 11, 14].forEach((s, i) => this.tone(mtof(76 + s), 0.5, { type: 'sine', vol: 0.07, when: t + i * 0.07, verb: true })); break;
                case 'cache': this.coins(9); break;
                case 'relic': {
                    for (const [s, d] of [[0, 0], [7, 0.02], [12, 0.04], [16, 0.06], [19, 0.08]]) {
                        this.tone(mtof(55 + s), 3.2, { type: 'sawtooth', vol: 0.05, attack: 0.6, lp: 1600, when: t + d, verb: true, detune: (Math.random() - 0.5) * 14 });
                        this.tone(mtof(55 + s), 3.2, { type: 'sine', vol: 0.05, attack: 0.5, when: t + d, verb: true });
                    }
                    [12, 16, 19, 24, 28].forEach((s, i) => this.tone(mtof(67 + s), 1.2, { type: 'sine', vol: 0.06, when: t + 0.4 + i * 0.12, verb: true }));
                    break;
                }
                case 'explode': case 'blast':
                    this.tone(110, 0.9, { type: 'sine', glide: 28, glideT: 0.7, vol: 0.5 });
                    this.noise(1.0, { filter: 'lowpass', freq: 2500, sweep: 120, vol: 0.4 });
                    if (e.type === 'blast') this.tone(1200, 0.4, { type: 'square', glide: 200, vol: 0.04, lp: 3000 });
                    break;
                case 'hurt':
                    if (e.kind === 'heat') break;
                    this.tone(e.kind === 'wisp' ? 900 : 230, 0.25, { type: 'square', glide: e.kind === 'wisp' ? 300 : 120, vol: 0.07, lp: 1800 });
                    this.noise(0.12, { filter: 'highpass', freq: 2000, vol: 0.08 });
                    break;
                case 'land': this.tone(80, 0.18, { type: 'sine', glide: 45, vol: Math.min(0.3, 0.05 + e.v * 0.02) }); this.noise(0.12, { freq: 500, vol: 0.06 }); break;
                case 'bonk': this.tone(420, 0.1, { type: 'triangle', vol: 0.06 }); break;
                case 'too-hard': this.tone(1100, 0.16, { type: 'sawtooth', glide: 700, vol: 0.04, lp: 2600 }); break;
                case 'boulder-loose': this.noise(0.6, { filter: 'lowpass', freq: 220, vol: 0.18 }); break;
                case 'boulder-land': this.tone(60, 0.35, { type: 'sine', glide: 35, vol: 0.3 }); this.noise(0.3, { freq: 400, vol: 0.12 }); break;
                case 'boulder-hit': this.tone(70, 0.4, { type: 'sine', glide: 30, vol: 0.35 }); this.tone(240, 0.3, { type: 'square', glide: 100, vol: 0.06, lp: 900 }); break;
                case 'sell': this.coins(8); break;
                case 'buy': this.tone(1320, 0.1, { type: 'triangle', vol: 0.06 }); this.tone(1760, 0.15, { type: 'triangle', vol: 0.05, when: t + 0.07 }); break;
                case 'upgrade': [0, 0.14, 0.28].forEach((d, i) => { this.tone(880 + i * 40, 0.35, { type: 'square', vol: 0.05, lp: 3500, when: t + d }); this.tone(2400, 0.2, { type: 'sine', vol: 0.03, when: t + d }); }); this.tone(mtof(79), 0.8, { type: 'sine', vol: 0.06, when: t + 0.45, verb: true }); break;
                case 'gate-open':
                    this.noise(3, { filter: 'lowpass', freq: 200, vol: 0.3 });
                    for (const s of [0, 7, 12, 16]) this.tone(mtof(43 + s), 4, { type: 'sawtooth', vol: 0.05, attack: 1, lp: 1200, verb: true });
                    break;
                case 'boss-start': case 'boss-wake': this._roar(1); break;
                case 'wyrm-lunge': this.noise(0.6, { filter: 'bandpass', freq: 400, sweep: 2000, q: 1.5, vol: 0.15 }); this._roar(0.4); break;
                case 'wyrm-spit': for (let i = 0; i < 3; i++) this.tone(300, 0.2, { type: 'sine', glide: 80, vol: 0.1, when: t + i * 0.06 }); break;
                case 'shard':
                    for (let i = 0; i < 12; i++) this.tone(2000 + Math.random() * 3000, 0.4 + Math.random() * 0.5, { type: 'sine', vol: 0.03, when: t + Math.random() * 0.2, verb: true });
                    this.noise(0.5, { filter: 'highpass', freq: 3000, vol: 0.2 });
                    this._roar(0.7);
                    break;
                case 'wyrm-stun': this.tone(1500, 0.6, { type: 'sine', glide: 400, vol: 0.06, verb: true }); break;
                case 'wyrm-dying': this._roar(1.4); break;
                case 'wyrm-freed': for (const s of [0, 4, 7, 12, 16, 19]) this.tone(mtof(50 + s), 5, { type: 'sine', vol: 0.06, attack: 1.2, verb: true }); break;
                case 'heart': for (const s of [0, 4, 7, 11, 14, 19, 24]) this.tone(mtof(55 + s), 6, { type: 'triangle', vol: 0.05, attack: 1.5, verb: true }); break;
                case 'orb-pop': this.tone(500, 0.15, { type: 'sine', glide: 120, vol: 0.06 }); break;
                case 'wisp-pop': this.tone(1400, 0.4, { type: 'sine', glide: 500, vol: 0.05, verb: true }); break;
                case 'recall': case 'travel': case 'waystone':
                    for (let i = 0; i < 10; i++) this.tone(mtof(60 + i * 3), 0.3, { type: 'sine', vol: 0.04, when: t + i * 0.04, verb: true });
                    break;
                case 'mend': case 'flask': [0, 5, 9].forEach((s, i) => this.tone(mtof(69 + s), 0.4, { type: 'sine', vol: 0.06, when: t + i * 0.06 })); break;
                case 'down': [0, -3, -7, -12].forEach((s, i) => this.tone(mtof(60 + s), 0.4, { type: 'triangle', vol: 0.07, when: t + i * 0.18 })); break;
                case 'rescued': this.noise(1.2, { filter: 'bandpass', freq: 600, sweep: 1500, vol: 0.08 }); break;
                case 'msg': this.tone(e.key === 'lowfuel' || e.key === 'lowhull' ? 990 : 660, 0.09, { type: 'square', vol: 0.035, lp: 2500 }); if (e.key === 'lowfuel' || e.key === 'lowhull') this.tone(990, 0.09, { type: 'square', vol: 0.035, lp: 2500, when: t + 0.14 }); break;
                case 'bark': this.blip(e.who || 'thimble'); break;
                case 'contract': case 'reward': this.coins(10); break;
                case 'chapter': this.ui('chapter'); break;
                case 'codex': this.ui('page'); break;
                default: break;
            }
        }
    }

    _roar(k) {
        const t = this.ctx.currentTime;
        for (const f of [55, 58.3, 82]) this.tone(f, 1.2 * k, { type: 'sawtooth', glide: f * 0.6, vol: 0.09 * k, attack: 0.08, lp: 700, verb: true });
        this.noise(1.1 * k, { filter: 'bandpass', freq: 300, sweep: 120, q: 2, vol: 0.18 * k, when: t });
    }
}
