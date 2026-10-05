// Audio: every sound is synthesised with Web Audio. Music is driven by the sim's
// beat clock — one beat = one formation step = one eighth note — so the march
// IS the bassline and the whole song speeds up as the Armada thins out. Events
// carry sim time; `at` maps them onto the AudioContext clock with a fixed latency
// so notes land evenly however the frames fall.

const PENTA = [0, 3, 5, 7, 10];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Songs: root (MIDI), chord roots per bar (semitones), lead (32 eighth notes, semitones
// from root, null = rest), bass march pattern (4 steps), drums on/off, lead wave.
const SONGS = {
    sector0: { root: 57, chords: [0, -4, -2, -5], lead: [12, null, 15, null, 19, null, 17, 15, 12, null, 10, 12, 15, null, null, null, 8, null, 12, null, 15, 17, 15, 12, 14, null, 11, null, 7, null, null, null], wave: 'square' },
    sector1: { root: 62, chords: [0, -2, -5, -7], lead: [7, 10, 12, null, 14, 12, 10, null, 7, null, 5, 7, 10, null, null, null, 5, 7, 9, null, 12, 10, 9, null, 7, null, 5, null, 2, null, null, null], wave: 'triangle' },
    sector2: { root: 52, chords: [0, 0, -4, -2], lead: [12, 12, 15, 12, 17, 12, 19, 17, 15, null, 12, null, 10, 12, null, null, 12, 12, 15, 12, 19, 17, 22, 19, 24, null, 22, 19, 17, null, 15, null], wave: 'square' },
    sector3: { root: 54, chords: [0, -4, 3, -2], lead: [19, null, 17, 15, 17, null, 12, null, 15, null, 14, 12, 10, null, 12, null, 19, null, 22, 19, 24, null, 22, null, 19, 17, 15, null, 17, null, null, null], wave: 'sawtooth' },
    sector4: { root: 48, chords: [0, 1, -4, -5], lead: [12, null, 13, null, 12, 10, 8, null, 7, null, 8, 10, 7, null, null, null, 12, 15, 13, 12, 10, null, 8, 7, 6, null, 7, null, null, null, null, null], wave: 'square' },
    boss: { root: 47, chords: [0, 0, 1, -1], lead: [12, 12, null, 12, 15, null, 13, 12, 11, null, 12, null, 7, null, 6, 7, 12, 12, null, 12, 17, null, 15, 13, 12, 13, 15, 17, 18, null, 19, null], wave: 'sawtooth', hard: true },
    final: { root: 49, chords: [0, -2, -4, -5], lead: [12, 15, 19, 24, 22, 19, 15, 19, 17, 20, 24, 27, 24, 20, 17, 20, 15, 19, 22, 27, 24, 22, 19, 15, 14, 17, 20, 23, 26, null, 24, null], wave: 'sawtooth', hard: true },
    challenge: { root: 60, chords: [0, 5, 7, 5], lead: [12, 16, 19, 24, 19, 16, 12, null, 14, 17, 21, 26, 21, 17, 14, null, 16, 19, 23, 28, 23, 19, 16, null, 14, 17, 21, 24, 23, 21, 19, null], wave: 'square', bright: true },
    title: { root: 57, chords: [0, -4, -7, -2], lead: [12, null, null, 15, 14, 12, 10, 12, null, null, 7, null, 10, null, null, null, 12, null, null, 15, 17, 19, 17, 15, 14, null, 12, null, 10, null, null, null], wave: 'square' },
    ending: { root: 60, chords: [0, 5, 9, 7], lead: [12, null, 16, null, 19, null, 24, null, 21, null, 17, null, 21, 24, 26, null, 28, null, 26, 24, 23, null, 19, null, 24, null, null, null, 24, null, null, null], wave: 'triangle', bright: true },
};

class Audio {
    constructor() {
        this.ctx = null;
        this.sound = true; this.music = true;
        this.limits = new Map();
        this.loops = new Map();
        this.lastSong = '';
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
        this.master = ctx.createGain(); this.master.gain.value = 0.55;
        this.sfx = ctx.createGain(); this.mus = ctx.createGain();
        this.sfx.gain.value = this.sound ? 0.9 : 0; this.mus.gain.value = this.music ? 0.42 : 0;
        this.pump = ctx.createGain();
        this.pump.connect(this.mus);
        this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.21;
        this.fb = ctx.createGain(); this.fb.gain.value = 0.32;
        this.dl = ctx.createBiquadFilter(); this.dl.type = 'lowpass'; this.dl.frequency.value = 2400;
        this.delay.connect(this.dl); this.dl.connect(this.fb); this.fb.connect(this.delay); this.dl.connect(this.mus);
        this.sfx.connect(this.comp); this.mus.connect(this.comp); this.comp.connect(this.master); this.master.connect(ctx.destination);
        const len = ctx.sampleRate * 1.5;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
        });
    }

    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    ready() { return !!this.ctx && this.ctx.state === 'running'; }

    setSound(on) { this.sound = on; if (this.sfx) this.sfx.gain.value = on ? 0.9 : 0; if (!on) this.stopLoops(); }
    setMusic(on) { this.music = on; if (this.mus) this.mus.gain.value = on ? 0.42 : 0; }

    limit(key, gap) {
        const t = this.now, last = this.limits.get(key) ?? -1;
        if (t - last < gap) return false;
        this.limits.set(key, t);
        return true;
    }

    // ================================================================== voices
    tone(at, f, o = {}) {
        if (!this.ctx) return null;
        const ctx = this.ctx;
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        const dur = o.dur ?? 0.1, vol = o.vol ?? 0.2;
        const osc = ctx.createOscillator();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(f, t);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide ?? dur));
        if (o.detune) osc.detune.value = o.detune;
        const g = ctx.createGain();
        const a = o.attack ?? 0.004;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + a);
        if (o.hold) g.gain.setValueAtTime(vol, t + a + o.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = osc;
        if (o.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = o.q ?? 1; osc.connect(lp); node = lp; }
        if (o.vib) {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = o.vib; lg.gain.value = f * 0.012;
            lfo.connect(lg); lg.connect(osc.frequency);
            lfo.start(t + 0.06); lfo.stop(t + dur + 0.05);
        }
        node.connect(g);
        g.connect(o.dest || this.sfx);
        if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(this.delay); }
        osc.start(t); osc.stop(t + dur + 0.05);
        return osc;
    }

    noise(at, o = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        const dur = o.dur ?? 0.1;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.playbackRate.value = o.rate ?? 1;
        const f = ctx.createBiquadFilter();
        f.type = o.filter || 'lowpass';
        f.frequency.setValueAtTime(o.f ?? 2000, t);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
        f.Q.value = o.q ?? 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(o.vol ?? 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(o.dest || this.sfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }

    seq(at, notes, o = {}) {
        // notes: [[midi|null, beats], ...]
        let t = at ?? this.now;
        const step = o.step ?? 0.09;
        for (const [m, len] of notes) {
            if (m !== null) this.tone(t, mtof(m), { type: o.type || 'square', dur: step * len * 0.95, vol: o.vol ?? 0.14, hold: step * len * 0.5, send: o.send ?? 0.15, dest: o.dest });
            t += step * len;
        }
        return t;
    }

    startLoop(key, make) {
        if (!this.ctx || this.loops.has(key) || !this.sound) return;
        this.loops.set(key, make());
    }

    stopLoop(key) {
        const l = this.loops.get(key);
        if (!l) return;
        this.loops.delete(key);
        const t = this.now;
        try { l.g.gain.setTargetAtTime(0.0001, t, 0.05); for (const o of l.osc) o.stop(t + 0.3); } catch { /* ignore */ }
    }

    stopLoops() { for (const k of [...this.loops.keys()]) this.stopLoop(k); }

    siren(freq, lfoHz, depth, vol, type = 'square') {
        const ctx = this.ctx;
        const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        lfo.frequency.value = lfoHz; lg.gain.value = depth;
        lfo.connect(lg); lg.connect(osc.frequency);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        osc.connect(lp); lp.connect(g); g.connect(this.sfx);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.08);
        osc.start(); lfo.start();
        return { g, osc: [osc, lfo] };
    }

    // ================================================================== music
    beat(i, interval, songId, march, at) {
        if (!this.ctx || !this.music) return;
        const song = SONGS[songId] || SONGS.sector0;
        if (songId !== this.lastSong) this.lastSong = songId;
        const step = i % 32, bar = Math.floor(step / 8), inBar = step % 8;
        const chord = song.root + song.chords[bar];
        const M = this.pump;
        const t = at;
        // side-chain pump on the kick
        if (inBar % 4 === 0) {
            M.gain.cancelScheduledValues(t);
            M.gain.setValueAtTime(0.35, t);
            M.gain.linearRampToValueAtTime(1, t + interval * 1.6);
            this.tone(t, 120, { type: 'sine', f2: 42, glide: 0.12, dur: 0.18, vol: 0.55, dest: this.mus });
        }
        if (inBar === 2 || inBar === 6) this.noise(t, { dur: 0.12, f: 3200, filter: 'bandpass', q: 0.7, vol: song.hard ? 0.26 : 0.18, dest: this.mus });
        this.noise(t + (inBar % 2 ? 0 : interval / 2), { dur: 0.03, f: 7000, filter: 'highpass', vol: 0.06, dest: this.mus });
        // the march: four descending notes, one per beat
        const MARCH = [0, -2, -3, -5];
        const bassNote = chord - 24 + MARCH[i % 4];
        this.tone(t, mtof(bassNote), { type: 'square', lp: march ? 700 : 500, dur: Math.min(0.22, interval * 0.9), vol: march ? 0.34 : 0.24, dest: M });
        this.tone(t, mtof(bassNote - 12), { type: 'triangle', dur: Math.min(0.22, interval * 0.9), vol: 0.3, dest: M });
        // pad at the top of each bar
        if (inBar === 0) {
            for (const iv of [0, 3, 7]) this.tone(t, mtof(chord + iv), { type: 'sawtooth', lp: 900, dur: interval * 8, attack: interval * 2, vol: 0.035, detune: (iv - 3) * 4, dest: M });
        }
        // arpeggio in sixteenths
        const tones = song.bright ? [0, 4, 7, 12] : [0, 3, 7, 12];
        if (interval > 0.1) {
            for (let k = 0; k < 2; k++) this.tone(t + k * interval / 2, mtof(chord + 12 + tones[(i * 2 + k) % 4]), { type: 'square', dur: interval * 0.4, vol: 0.035, lp: 2600, dest: this.mus });
        }
        // lead
        const n = song.lead[step];
        if (n !== null && n !== undefined && (interval > 0.11 || step % 2 === 0)) {
            const len = song.lead[step + 1] === null ? interval * 1.8 : interval * 0.9;
            this.tone(t, mtof(song.root + n), { type: song.wave, dur: len, hold: len * 0.5, vol: song.wave === 'sawtooth' ? 0.07 : 0.085, vib: 5.5, lp: song.wave === 'sawtooth' ? 2600 : 0, send: 0.35, dest: this.mus });
        }
    }

    // ================================================================== sound effects
    onEvent(e, at) {
        if (!this.ctx || !this.sound) return;
        const T = at;
        switch (e.type) {
            case 'paddle': this.tone(T, 520 + e.off * 90, { type: 'square', dur: 0.07, vol: 0.16, f2: 640 + e.off * 90, glide: 0.03 }); break;
            case 'wall': if (this.limit('wall', 0.05)) this.tone(T, 240, { type: 'triangle', dur: 0.04, vol: 0.12 }); break;
            case 'launch': this.tone(T, 300, { f2: 1000, dur: 0.12, vol: 0.15 }); break;
            case 'laser':
                if (e.rapid) { if (this.limit('laser', 0.06)) this.tone(T, 2000, { f2: 500, dur: 0.07, vol: 0.06 }); }
                else this.tone(T, 1500, { f2: 260, dur: 0.12, vol: 0.12 });
                break;
            case 'ebullet':
                if (!this.limit('eb', 0.07)) break;
                if (e.kind === 'bomb') this.tone(T, 200, { type: 'sawtooth', f2: 110, dur: 0.18, vol: 0.08 });
                else if (e.kind === 'plunger') this.tone(T, 340, { f2: 160, dur: 0.07, vol: 0.05 });
                else this.tone(T, 520, { type: 'triangle', f2: 220, dur: 0.06, vol: 0.06 });
                break;
            case 'hit': this.noise(T, { dur: 0.06, f: 1800, filter: 'bandpass', vol: 0.18 }); this.tone(T, 260, { f2: 120, dur: 0.07, vol: 0.12 }); break;
            case 'kill': {
                if (!this.limit('kill', 0.03)) break;
                this.noise(T, { dur: e.big ? 0.35 : 0.2, f: 3500, f2: 300, filter: 'bandpass', q: 1.2, vol: e.big ? 0.32 : 0.24 });
                this.tone(T, e.big ? 500 : 760, { f2: 90, dur: 0.22, vol: 0.12 });
                break;
            }
            case 'brick': {
                if (e.src === 'clear') { if (this.limit('clr', 0.04)) this.tone(T, 600 + Math.random() * 800, { type: 'triangle', dur: 0.08, vol: 0.08 }); break; }
                if (!this.limit('brick', 0.02)) break;
                const i = Math.min(e.chain || 0, 24);
                const m = 64 + PENTA[i % 5] + 12 * Math.floor(i / 5);
                this.tone(T, mtof(m), { type: 'square', dur: 0.1, vol: 0.12, lp: 3500 });
                this.tone(T, mtof(m + 12), { type: 'triangle', dur: 0.12, vol: 0.07 });
                break;
            }
            case 'crack': this.tone(T, 1800, { type: 'triangle', dur: 0.05, vol: 0.1 }); this.tone(T, 2450, { type: 'triangle', dur: 0.07, vol: 0.07 }); break;
            case 'clank': if (this.limit('clank', 0.05)) { this.tone(T, 620, { dur: 0.09, vol: 0.08 }); this.tone(T, 663, { dur: 0.1, vol: 0.08 }); } break;
            case 'cell': if (e.src !== 'crater' && e.src !== 'death' && this.limit('cell', 0.03)) this.noise(T, { dur: 0.03, f: e.kind === 'boss' ? 1400 : 4000, filter: 'bandpass', vol: 0.1 }); break;
            case 'cellHit': if (e.core) { this.tone(T, 1100, { type: 'triangle', dur: 0.15, vol: 0.14 }); this.tone(T, 1650, { type: 'triangle', dur: 0.12, vol: 0.08 }); } break;
            case 'tnt': case 'bossFinal':
                this.noise(T, { dur: e.type === 'bossFinal' ? 1.6 : 0.6, f: 2000, f2: 80, vol: 0.5 });
                this.tone(T, 110, { type: 'sine', f2: 28, dur: e.type === 'bossFinal' ? 1.4 : 0.55, vol: 0.5 });
                break;
            case 'boom': case 'gunDown': case 'blast':
                if (!this.limit('boom', 0.06)) break;
                this.noise(T, { dur: 0.4, f: 1500, f2: 90, vol: 0.35 }); this.tone(T, 90, { type: 'sine', f2: 35, dur: 0.35, vol: 0.35 });
                break;
            case 'swat': if (this.limit('swat', 0.04)) this.tone(T, 2100, { type: 'triangle', dur: 0.03, vol: 0.07 }); break;
            case 'reflect': this.tone(T, 2400, { type: 'triangle', f2: 1200, dur: 0.12, vol: 0.1 }); break;
            case 'splash': break;
            case 'ufo': this.startLoop('ufo', () => this.siren(330, 9, 120, 0.06)); break;
            case 'ufoGone': this.stopLoop('ufo'); break;
            case 'ufoKill':
                this.stopLoop('ufo');
                this.seq(T, [[88, 1], [84, 1], [79, 1], [76, 1], [72, 1], [67, 2]], { step: 0.05, vol: 0.12, send: 0.3 });
                this.noise(T, { dur: 0.6, f: 2500, f2: 120, vol: 0.4 });
                break;
            case 'capsule': this.tone(T, 1400, { type: 'triangle', dur: 0.05, vol: 0.06 }); break;
            case 'power':
                if (e.kind === 'P') this.seq(T, [[72, 1], [76, 1], [79, 1], [84, 1], [79, 1], [84, 3]], { step: 0.07, vol: 0.14 });
                else this.seq(T, [[72, 1], [76, 1], [79, 1], [84, 2]], { step: 0.045, vol: 0.13 });
                break;
            case 'playerDie':
                this.stopLoops();
                this.noise(T, { dur: 1.3, f: 3500, f2: 60, vol: 0.5 });
                this.tone(T, 520, { type: 'sawtooth', f2: 38, dur: 1.1, vol: 0.2 });
                this.tone(T + 0.05, 260, { type: 'square', f2: 30, dur: 1.0, vol: 0.12 });
                break;
            case 'nova':
                this.noise(T, { dur: 0.45, f: 200, f2: 7000, filter: 'bandpass', q: 2, vol: 0.4 });
                this.noise(T + 0.35, { dur: 1.2, f: 2400, f2: 60, vol: 0.55 });
                this.tone(T + 0.35, 80, { type: 'sine', f2: 25, dur: 1.0, vol: 0.55 });
                break;
            case 'barrier': this.tone(T, 300, { type: 'sine', f2: 1200, dur: 0.18, vol: 0.2 }); break;
            case 'ballLost': this.tone(T, 420, { type: 'sawtooth', f2: 70, dur: 0.5, vol: 0.12 }); break;
            case 'extraLife': this.seq(T, [[76, 1], [79, 1], [84, 1], [88, 1], [84, 1], [88, 1], [91, 4]], { step: 0.08, vol: 0.13, send: 0.3 }); break;
            case 'chain': this.tone(T, mtof(72 + e.mult * 3), { dur: 0.08, vol: 0.12 }); this.tone(T + 0.06, mtof(79 + e.mult * 3), { dur: 0.1, vol: 0.12 }); break;
            case 'dive': if (this.limit('dive', 0.3)) this.tone(T, 1200, { type: 'sine', f2: 260, dur: 0.6, vol: 0.09 }); break;
            case 'captorDive': this.tone(T, 600, { type: 'sine', f2: 200, dur: 0.9, vol: 0.1 }); break;
            case 'beamStart': this.startLoop('tractor', () => this.siren(e.boss ? 160 : 240, 7, 90, 0.08, 'sine')); break;
            case 'beamEnd': this.stopLoop('tractor'); break;
            case 'captured': this.tone(T, 300, { type: 'sine', f2: 900, dur: 0.3, vol: 0.15, vib: 14 }); break;
            case 'ballCaptured': this.seq(T, [[67, 1], [63, 1], [60, 2]], { step: 0.1, vol: 0.12 }); break;
            case 'rescue': this.seq(T, [[72, 1], [79, 1], [84, 1], [91, 2]], { step: 0.06, vol: 0.13 }); break;
            case 'spit': this.noise(T, { dur: 0.25, f: 600, f2: 4000, filter: 'bandpass', vol: 0.2 }); break;
            case 'beamWarn': for (let k = 0; k < 4; k++) this.tone(T + k * 0.25, 900 + k * 150, { dur: 0.1, vol: 0.09 }); break;
            case 'beamFire': this.tone(T, 70, { type: 'sawtooth', dur: 0.75, vol: 0.22, lp: 900 }); this.noise(T, { dur: 0.75, f: 900, vol: 0.2 }); break;
            case 'bossIntro': for (let k = 0; k < 6; k++) this.tone(T + 0.3 + k * 0.32, k % 2 ? 640 : 820, { dur: 0.3, vol: 0.12, hold: 0.2 }); break;
            case 'bossHit': this.tone(T, 900, { type: 'triangle', f2: 400, dur: 0.2, vol: 0.16 }); this.noise(T, { dur: 0.15, f: 2600, filter: 'bandpass', vol: 0.22 }); break;
            case 'bossPhase': this.tone(T, 90, { type: 'sawtooth', f2: 40, dur: 1.0, vol: 0.3, detune: 15 }); this.tone(T, 95, { type: 'sawtooth', f2: 42, dur: 1.0, vol: 0.25 }); this.noise(T, { dur: 0.9, f: 800, f2: 100, vol: 0.3 }); break;
            case 'bossDie': this.stopLoops(); break;
            case 'coreExposed': this.seq(T, [[60, 1], [66, 1], [72, 1], [78, 2]], { step: 0.07, vol: 0.12, type: 'sawtooth' }); break;
            case 'jawOpen': this.tone(T, 140, { type: 'sawtooth', f2: 70, dur: 0.4, vol: 0.12, lp: 600 }); break;
            case 'jawShut': this.noise(T, { dur: 0.2, f: 700, vol: 0.3 }); this.tone(T, 80, { type: 'square', dur: 0.12, vol: 0.18 }); break;
            case 'rumble': this.noise(T, { dur: 0.9, f: 300, vol: 0.3 }); break;
            case 'summon': this.tone(T, 400, { type: 'square', f2: 1200, dur: 0.15, vol: 0.08 }); break;
            case 'build': if (this.limit('build', 0.2)) this.tone(T, 1500, { type: 'triangle', f2: 2100, dur: 0.08, vol: 0.07 }); break;
            case 'regen': if (this.limit('regen', 0.3)) this.tone(T, 2600, { type: 'sine', dur: 0.05, vol: 0.03 }); break;
            case 'waveClear': this.stopLoops(); this.seq(T, [[72, 1], [76, 1], [79, 1], [84, 1], [null, 1], [79, 1], [84, 4]], { step: 0.09, vol: 0.14, send: 0.3 }); break;
            case 'go': this.seq(T, [[67, 1], [67, 1], [67, 1], [72, 3]], { step: 0.1, vol: 0.12 }); break;
            case 'tally': this.tallyTicks(T, e.perfect); break;
            case 'gameOver': this.stopLoops(); this.seq(T + 0.4, [[64, 2], [63, 2], [62, 2], [61, 6]], { step: 0.22, vol: 0.14, type: 'triangle' }); break;
            case 'stageStart':
                this.noise(T + 0.1, { dur: 1.6, f: 200, f2: 5000, filter: 'bandpass', q: 3, vol: 0.12 });
                for (let k = 0; k < 12; k++) this.tone(T + 0.15 + k * 0.13, mtof(48 + PENTA[k % 5] + 12 * Math.floor(k / 5)), { type: 'square', dur: 0.1, vol: 0.05, send: 0.25 });
                break;
        }
    }

    tallyTicks(T, perfect) {
        for (let k = 0; k < 4; k++) for (let j = 0; j < 6; j++) this.tone(T + 0.35 + k * 0.45 + j * 0.05, 1800 + k * 200, { type: 'square', dur: 0.025, vol: 0.05 });
        this.seq(T + 2.3, [[84, 1], [88, 1], [91, 3]], { step: 0.08, vol: 0.12 });
        if (perfect) this.seq(T + 2.8, [[72, 1], [76, 1], [79, 1], [84, 1], [88, 1], [91, 1], [96, 4]], { step: 0.07, vol: 0.14, send: 0.4 });
    }

    ui(kind) {
        if (!this.ctx || !this.sound) return;
        const T = this.now + 0.01;
        if (kind === 'move') this.tone(T, 880, { dur: 0.04, vol: 0.08 });
        if (kind === 'select') { this.tone(T, 990, { dur: 0.05, vol: 0.1 }); this.tone(T + 0.06, 1320, { dur: 0.08, vol: 0.1 }); }
        if (kind === 'coin') { this.tone(T, 988, { dur: 0.08, vol: 0.14 }); this.tone(T + 0.08, 1319, { dur: 0.4, vol: 0.14, hold: 0.1, send: 0.3 }); }
        if (kind === 'back') this.tone(T, 440, { f2: 220, dur: 0.1, vol: 0.08 });
        if (kind === 'type') this.tone(T, 1200, { type: 'triangle', dur: 0.03, vol: 0.08 });
        if (kind === 'hiscore') this.seq(T, [[72, 1], [76, 1], [79, 1], [84, 1], [79, 1], [84, 1], [88, 1], [91, 4]], { step: 0.1, vol: 0.14, send: 0.4 });
        if (kind === 'pause') this.tone(T, 660, { dur: 0.08, vol: 0.1 });
        if (kind === 'continue') this.tone(T, 1500, { type: 'triangle', dur: 0.05, vol: 0.08 });
    }
}

export const audio = new Audio();
