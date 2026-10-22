// Every sound in NEONFALL, generated with Web Audio. The engine (buses, pump, reverbs, delay, the
// look-ahead sequencer and the instruments) is game-075's; the songs are in music.js and the
// effects and the jungle ambience below are this game's.
//
//   master ← compressor ← { music bus, sfx bus, ambience bus, reverb return, delay return }
//   music bus ← pump (ducks on every kick) ← bass, pad
//             ← arp, lead, drums;   snare → gated reverb
//
// The sequencer is the "two clocks" pattern (game-045): a 25 ms timer
// schedules every 16th note that falls in the next 120 ms on the AudioContext
// clock, so timing holds however busy the frame is.

import { SONGS, compose, midiHz } from './music.js';

const LOOK = 0.12;

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.sound = true; this.music = true; this.amb = true; this.vol = 0.8;
        this.sfxLv = 1; this.musLv = 1; this.tunnel = false;
        this.song = null; this.want = null;
        this.layer = 3; this.calm = false;
        this.glitch = 0;
        this.kicks = [];
        this.limits = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = this.vol;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        this.master.connect(comp); comp.connect(c.destination);
        this.muff = c.createBiquadFilter(); this.muff.type = 'lowpass'; this.muff.frequency.value = 18000; this.muff.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.music ? 0.55 * this.musLv : 0; this.musicBus.connect(this.muff);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sound ? 0.7 * this.sfxLv : 0; this.sfxBus.connect(this.master);
        this.ambBus = c.createGain(); this.ambBus.gain.value = this.amb ? 0.5 : 0; this.ambBus.connect(this.master);
        this.pump = c.createGain(); this.pump.connect(this.musicBus);
        // noise
        const len = c.sampleRate * 2;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // reverb: a generated stereo hall
        this.verb = c.createConvolver();
        this.verb.buffer = this.impulse(2.4, 2.6, false);
        this.verbIn = c.createGain(); this.verbIn.gain.value = 0.9;
        this.verbIn.connect(this.verb); this.verb.connect(this.musicBus);
        // gated reverb for the snare: flat, then cut dead
        this.gated = c.createConvolver();
        this.gated.buffer = this.impulse(0.26, 0, true);
        this.gatedIn = c.createGain(); this.gatedIn.gain.value = 0.55;
        this.gatedIn.connect(this.gated); this.gated.connect(this.musicBus);
        // dotted-eighth delay with a darkening feedback loop
        this.delay = c.createDelay(2); this.delay.delayTime.value = 0.4;
        this.fb = c.createGain(); this.fb.gain.value = 0.38;
        const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2600;
        this.delayIn = c.createGain(); this.delayIn.gain.value = 0.5;
        this.delayIn.connect(this.delay); this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay); dl.connect(this.musicBus);
        // a 25% pulse for the arpeggio
        const real = new Float32Array(32), imag = new Float32Array(32);
        for (let n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
        this.pulseWave = c.createPeriodicWave(real, imag);
        this.timer = setInterval(() => this.tick(), 25);
        this.startAmbience();
        if (this.want) this.play(this.want, true);
    }

    impulse(dur, decay, gated) {
        const c = this.ctx, n = Math.floor(c.sampleRate * dur);
        const b = c.createBuffer(2, n, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (gated ? 0.6 * (i < n * 0.92 ? 1 : 1 - (i - n * 0.92) / (n * 0.08)) : Math.pow(1 - i / n, decay));
        }
        return b;
    }

    get now() { return this.ctx ? this.ctx.currentTime : 0; }

    setSound(on) { this.sound = on; if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.7 * this.sfxLv : 0, this.now, 0.02); }
    setMusic(on) { this.music = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.55 * this.musLv : 0, this.now, 0.05); }
    /** Two sliders, 0..1. */
    setLevels(sfx, music) { this.sfxLv = sfx; this.musLv = music; this.setSound(sfx > 0); this.setMusic(music > 0); }
    setAmbience(on) { this.amb = on; if (this.ambBus) this.ambBus.gain.setTargetAtTime(on ? 0.5 : 0, this.now, 0.1); }
    setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.now, 0.03); }

    // ================================================================ the sequencer
    play(id, force = false) {
        this.want = id;
        if (!this.ctx) return;
        if (this.song && this.song.id === id && !force) return;
        if (!id) { this.song = null; return; }
        const s = compose(id);
        this.song = { id, s, step: 0, next: this.now + 0.08, start: this.now + 0.08 };
        this.delay.delayTime.setValueAtTime(s.spb * 0.75, this.now);
    }

    stop() { this.song = null; this.want = null; }

    tick() {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const sg = this.song;
        if (sg) {
            if (sg.next < this.now - 0.2) { const skip = Math.ceil((this.now - sg.next) / sg.s.step); sg.step += skip; sg.next += skip * sg.s.step; }
            while (sg.next < this.now + LOOK) { this.playStep(sg, sg.step, sg.next); sg.next += sg.s.step; sg.step++; }
        }
        this.ambienceTick();
    }

    playStep(sg, step, t) {
        const s = sg.s;
        const st = step % 16, bar = Math.floor(step / 16);
        const intro = bar < 2;
        const ch = s.chords[bar % s.chords.length];
        const root = s.root;
        const L = this.calm ? Math.min(this.layer, 1) : this.layer;
        // glitch: stutter the music when the null is close
        if (this.glitch > 0 && Math.random() < this.glitch * 0.25) {
            this.musicBus.gain.setValueAtTime(0.05, t); this.musicBus.gain.setValueAtTime(this.music ? 0.55 * this.musLv : 0, t + s.step * 0.9);
        }
        const detune = this.glitch > 0 ? (Math.random() - 0.5) * 120 * this.glitch : 0;
        // pad
        if (st === 0) this.pad(t, ch.map((n) => root + n), s.spb * 4);
        // bass
        const bn = root - 12 + ch[0];
        if (s.bass === 'octave' && st % 2 === 0) this.bass(t, bn + (st % 4 === 2 ? 12 : 0), s.step * 1.6);
        else if (s.bass === 'pulse') this.bass(t, bn + (st === 14 ? 7 : 0), s.step * 0.9);
        else if (s.bass === 'slow' && (st === 0 || st === 8 || st === 11)) this.bass(t, bn + (st === 11 ? 7 : 0), s.step * (st === 0 ? 7 : 3));
        else if (s.bass === 'walk' && st % 4 === 0) this.bass(t, bn + [0, 7, 12, 10][st / 4], s.step * 3.5);
        // drums
        if (L >= 1 && !intro) {
            const [k, sn, h] = s.drum;
            if (k[st]) this.kick(t);
            if (sn[st]) this.snare(t);
            if (h[st]) this.hat(t, st % 4 === 2 && s.drums !== 'drive');
            if (bar % 8 === 7 && st >= 12) this.tom(t, 160 - (st - 12) * 25);
            if (this.layer >= 4 && st % 4 === 2) this.hat(t + s.step * 0.5, false, 0.5);
        } else if (st === 0 || st === 8) this.kicks.push(t);
        // arpeggio
        if (L >= 2) {
            const tones = [...ch, ch[0] + 12, ch[1] + 12];
            let n = null;
            if (s.arp === 'up' && st % 2 === 0) n = tones[(st / 2) % tones.length];
            else if (s.arp === 'up16') n = tones[st % tones.length];
            else if (s.arp === 'down' && st % 2 === 0) n = tones[tones.length - 1 - ((st / 2) % tones.length)];
            else if (s.arp === 'updown' && st % 2 === 0) { const seq = [0, 1, 2, 3, 4, 3, 2, 1]; n = tones[seq[(st / 2) % 8] % tones.length]; }
            else if (s.arp === 'stab' && (st === 3 || st === 6 || st === 11)) { for (const c of ch) this.arp(t, root + 12 + c, s.step * 0.8, detune, 0.05); }
            if (n !== null) this.arp(t, root + 12 + n, s.step * 0.9, detune);
        }
        // lead
        if (L >= 3 && bar >= 4) {
            const note = s.lead[(bar - 4) % 8][st];
            if (note) this.lead(t, note.midi, s.step * note.len * 0.95, detune);
        }
    }

    // ================================================================ instruments
    env(g, t, a, peak, hold, rel, sustain = 0.0001) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.setTargetAtTime(sustain, t + a + hold, rel);
    }

    bass(t, m, dur) {
        const c = this.ctx;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
        f.frequency.setValueAtTime(1900, t); f.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.08, dur));
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.006); g.gain.setTargetAtTime(0.0001, t + dur * 0.85, 0.03);
        for (const dt of [-7, 7]) {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = dt;
            o.connect(f); o.start(t); o.stop(t + dur + 0.2);
        }
        f.connect(g); g.connect(this.pump);
    }

    pad(t, notes, dur) {
        const c = this.ctx;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 0.7;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.35); g.gain.setTargetAtTime(0.0001, t + dur - 0.1, 0.25);
        for (const m of notes) for (const dt of [-11, 9]) {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = dt;
            o.connect(f); o.start(t); o.stop(t + dur + 1);
        }
        f.connect(g); g.connect(this.pump);
        const send = c.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(this.verbIn);
    }

    arp(t, m, dur, detune = 0, vol = 0.07) {
        const c = this.ctx;
        const o = c.createOscillator(); o.setPeriodicWave(this.pulseWave); o.frequency.value = midiHz(m); o.detune.value = detune;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3400;
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.05, dur));
        o.connect(f); f.connect(g); g.connect(this.musicBus); g.connect(this.delayIn);
        o.start(t); o.stop(t + dur + 0.05);
    }

    lead(t, m, dur, detune = 0) {
        const c = this.ctx;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3800; f.Q.value = 2;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.085, t + 0.02); g.gain.setTargetAtTime(0.06, t + 0.05, 0.1); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
        const lfo = c.createOscillator(); lfo.frequency.value = 5.6;
        const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(dur, 0.35));
        lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.3);
        for (const [type, dt] of [['sawtooth', -5 + detune], ['square', 6 + detune]]) {
            const o = c.createOscillator(); o.type = type; o.frequency.value = midiHz(m); o.detune.value = dt;
            lg.connect(o.detune);
            o.connect(f); o.start(t); o.stop(t + dur + 0.3);
        }
        f.connect(g); g.connect(this.musicBus);
        const s1 = c.createGain(); s1.gain.value = 0.45; g.connect(s1); s1.connect(this.delayIn);
        const s2 = c.createGain(); s2.gain.value = 0.35; g.connect(s2); s2.connect(this.verbIn);
    }

    kick(t) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
        const g = c.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.35);
        this.noise(t, 0.012, 3000, 'highpass', 0.2, this.musicBus);
        // the pump
        const spb = this.song ? this.song.s.spb : 0.5;
        this.pump.gain.cancelScheduledValues(t);
        this.pump.gain.setValueAtTime(0.32, t);
        this.pump.gain.linearRampToValueAtTime(1, t + spb * 0.8);
        this.kicks.push(t);
        if (this.kicks.length > 16) this.kicks.shift();
    }

    snare(t) {
        const c = this.ctx;
        const n = this.noise(t, 0.16, 1900, 'bandpass', 0.38, this.musicBus);
        n.connect(this.gatedIn);
        const o = c.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g); g.connect(this.musicBus); g.connect(this.gatedIn); o.start(t); o.stop(t + 0.15);
    }

    hat(t, open, vol = 1) { this.noise(t, open ? 0.18 : 0.035, 8000, 'highpass', 0.11 * vol, this.musicBus); }

    tom(t, f0) {
        const c = this.ctx;
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.2);
        const g = c.createGain(); g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g); g.connect(this.musicBus); g.connect(this.gatedIn); o.start(t); o.stop(t + 0.3);
    }

    noise(t, dur, freq, type, vol, dest) {
        const c = this.ctx;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf;
        s.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
        return g;
    }

    /** 0..1: how hard the last kick is still hitting (for visuals). */
    beat() {
        if (!this.ctx) return 0;
        const now = this.now;
        let last = -1;
        for (const k of this.kicks) if (k <= now && k > last) last = k;
        return last < 0 ? 0 : Math.exp(-(now - last) * 7);
    }

    // ================================================================ sound effects
    ok(key, gap) {
        const n = this.now;
        if (this.limits[key] && n - this.limits[key] < gap) return false;
        this.limits[key] = n; return true;
    }

    tone(f0, dur, { type = 'square', vol = 0.18, f1 = null, t = 0, dest = null, attack = 0.003 } = {}) {
        const c = this.ctx;
        const at = this.now + t;
        const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at);
        if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
        o.connect(g); g.connect(dest || this.sfxBus); o.start(at); o.stop(at + dur + 0.02);
    }

    seq(notes, step, opts = {}) { notes.forEach((m, i) => { if (m !== null) this.tone(midiHz(m), opts.dur || step * 1.2, { ...opts, t: i * step }); }); }

    /** Underground: the whole mix goes behind a wall. */
    setTunnel(on) { this.tunnel = on; if (this.muff) this.muff.frequency.setTargetAtTime(on ? 650 : 18000, this.now, 0.08); }

    sfx(name, o = {}) {
        if (!this.ctx || !this.sound) return;
        const N = (dur, f, type, vol, t = 0) => this.noise(this.now + t, dur, f, type, vol, this.sfxBus);
        switch (name) {
            case 'jump': this.tone(300, 0.16, { f1: 720, vol: 0.12, type: 'square' }); this.tone(600, 0.1, { f1: 1200, vol: 0.04, type: 'triangle', t: 0.02 }); break;
            case 'land': N(0.07, 500 + Math.min(300, (o.impact || 100)), 'lowpass', 0.22); this.tone(110, 0.08, { f1: 60, vol: 0.14, type: 'sine' }); break;
            case 'step': if (this.ok('step', 0.07)) N(0.025, 1800, 'bandpass', 0.05); break;
            case 'grab': this.tone(520, 0.3, { f1: 880, vol: 0.1, type: 'triangle' }); this.tone(1040, 0.2, { f1: 700, vol: 0.05, type: 'sine', t: 0.04 }); N(0.08, 3000, 'highpass', 0.1); break;
            case 'release': N(0.25, 1400, 'bandpass', 0.14); this.tone(260, 0.2, { f1: 520, vol: 0.06, type: 'sine' }); break;
            case 'swing': if (this.ok('swing', 0.5)) N(0.4, 900, 'bandpass', 0.05); break;
            case 'hit': this.tone(240, 0.2, { f1: 70, vol: 0.22, type: 'sawtooth' }); N(0.12, 900, 'lowpass', 0.3); N(0.06, 3000, 'highpass', 0.15); break;
            case 'sink': for (let i = 0; i < 6; i++) this.tone(180 + i * 40, 0.12, { f1: 60 + i * 20, vol: 0.09, type: 'sine', t: i * 0.11 }); N(0.9, 300, 'lowpass', 0.25); break;
            case 'splash': N(0.5, 1800, 'bandpass', 0.35); N(0.8, 500, 'lowpass', 0.25, 0.05); this.tone(900, 0.3, { f1: 150, vol: 0.06, type: 'sine' }); break;
            case 'chomp': this.tone(160, 0.1, { f1: 50, vol: 0.3, type: 'square' }); N(0.12, 2500, 'bandpass', 0.4); this.tone(90, 0.3, { f1: 40, vol: 0.3, type: 'sawtooth', t: 0.08 }); break;
            case 'zap': N(0.35, 4000, 'bandpass', 0.35); this.tone(1400, 0.4, { f1: 90, vol: 0.14, type: 'sawtooth' }); this.tone(200, 0.4, { f1: 40, vol: 0.2, type: 'square', t: 0.05 }); break;
            case 'death': this.seq([72, 67, 63, 60, 55, 51, 48], 0.08, { vol: 0.13, type: 'square', t: 0.1 }); break;
            case 'respawn': this.tone(300, 0.4, { f1: 1200, vol: 0.08, type: 'triangle' }); this.seq([72, 79, 84], 0.06, { vol: 0.07, type: 'square', t: 0.2 }); break;
            case 'croc': if (this.ok('croc', 0.4)) { this.tone(70, 0.3, { f1: 50, vol: 0.1, type: 'sawtooth' }); N(0.25, 400, 'lowpass', 0.12); } break;
            case 'crocwarn': if (this.ok('crocwarn', 0.3)) this.tone(520, 0.08, { f1: 260, vol: 0.05, type: 'triangle' }); break;
            case 'rung': if (this.ok('rung', 0.06)) this.tone(900 + (o.alt ? 120 : 0), 0.04, { vol: 0.06, type: 'square' }); break;
            case 'ladder': N(0.08, 1200, 'bandpass', 0.14); this.tone(440, 0.08, { f1: 660, vol: 0.06, type: 'triangle' }); break;
            case 'drop': this.tone(500, 0.35, { f1: 90, vol: 0.1, type: 'sine' }); break;
            case 'screen': N(0.14, 1100, 'bandpass', 0.08); break;
            case 'treasure': {
                const base = 72 + Math.min(7, (o.streak || 1) - 1);
                this.seq([base, base + 4, base + 7, base + 12, base + 16, base + 19, base + 24], 0.055, { vol: 0.11, type: 'square', dur: 0.14 });
                this.seq([base - 12, base - 8, base - 5], 0.0, { vol: 0.08, type: 'sawtooth', dur: 0.7 });
                N(0.35, 6000, 'highpass', 0.12, 0.1);
                break;
            }
            case 'life': this.seq([76, 79, 88, 84, 86, 91], 0.07, { vol: 0.11, type: 'square' }); break;
            case 'tick': this.tone(o.sec <= 3 ? 1760 : 1320, 0.07, { vol: o.sec <= 3 ? 0.1 : 0.06 }); break;
            case 'hurry': this.seq([84, null, 84, null, 84, 91], 0.09, { vol: 0.09, type: 'square' }); break;
            case 'win': this.seq([60, 64, 67, 72, null, 67, 72, null, 76, 79, 84, 88, 91, 96], 0.09, { vol: 0.12, type: 'square', dur: 0.16 }); break;
            case 'over': this.seq([67, null, 63, null, 60, null, 55, 54, 55], 0.16, { vol: 0.12, type: 'triangle', dur: 0.4 }); break;
            case 'timeup': this.seq([72, 67, 64, 60, 55, 48], 0.13, { vol: 0.12, type: 'sawtooth', dur: 0.3 }); break;
            case 'start': this.seq([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.06, { vol: 0.11, type: 'square', dur: 0.1 }); break;
            case 'move': this.tone(880, 0.04, { vol: 0.06 }); break;
            case 'select': this.seq([84, 91], 0.04, { vol: 0.08 }); break;
            case 'back': this.seq([79, 72], 0.04, { vol: 0.07 }); break;
            case 'open': this.tone(440, 0.08, { f1: 660, vol: 0.08, type: 'triangle' }); break;
            case 'close': this.tone(660, 0.08, { f1: 440, vol: 0.08, type: 'triangle' }); break;
            default: break;
        }
    }

    // ================================================================ the jungle around you
    startAmbience() {
        const c = this.ctx;
        const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5;
        const g = c.createGain(); g.gain.value = 0.02;
        const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
        const lg = c.createGain(); lg.gain.value = 0.012;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        src.connect(f); f.connect(g); g.connect(this.ambBus);
        src.start();
        this.ambNext = this.now + 2;
    }

    ambienceTick() {
        if (!this.amb || this.now < this.ambNext) return;
        this.ambNext = this.now + 1.2 + Math.random() * 3;
        const c = this.ctx;
        const out = c.createGain(); out.gain.value = 0.3;
        const pan = c.createStereoPanner ? c.createStereoPanner() : null;
        if (pan) { pan.pan.value = Math.random() * 2 - 1; out.connect(pan); pan.connect(this.ambBus); } else out.connect(this.ambBus);
        if (this.tunnel) {
            // a drip in a cave
            this.tone(1400 + Math.random() * 600, 0.12, { f1: 500, vol: 0.12, type: 'sine', dest: out });
            this.tone(700, 0.3, { f1: 300, vol: 0.04, type: 'sine', t: 0.05, dest: out });
        } else if (Math.random() < 0.6) {
            // crickets
            const n = 4 + Math.floor(Math.random() * 4), base = 3800 + Math.random() * 600;
            for (let i = 0; i < n; i++) this.tone(base, 0.03, { vol: 0.05, t: i * 0.05, dest: out, type: 'square' });
        } else {
            // a night bird
            const b = 1800 + Math.random() * 800;
            this.tone(b, 0.12, { f1: b * 1.5, vol: 0.06, type: 'sine', dest: out });
            this.tone(b * 1.4, 0.15, { f1: b * 0.9, vol: 0.05, type: 'sine', t: 0.14, dest: out });
        }
    }
}

export const audio = new AudioEngine();
export { SONGS };
