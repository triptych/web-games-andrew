// Every sound in the game, generated with Web Audio.
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
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.music ? 0.55 : 0; this.musicBus.connect(this.master);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sound ? 0.7 : 0; this.sfxBus.connect(this.master);
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

    setSound(on) { this.sound = on; if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.7 : 0, this.now, 0.02); }
    setMusic(on) { this.music = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.now, 0.05); }
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
            this.musicBus.gain.setValueAtTime(0.05, t); this.musicBus.gain.setValueAtTime(this.music ? 0.55 : 0, t + s.step * 0.9);
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

    sfx(name, o = {}) {
        if (!this.ctx || !this.sound) return;
        const N = (dur, f, type, vol, t = 0) => this.noise(this.now + t, dur, f, type, vol, this.sfxBus);
        switch (name) {
            case 'pickup': this.seq([72, 76, 79], 0.04, { vol: 0.12 }); break;
            case 'key': this.seq([84, 88, 91, 96], 0.035, { vol: 0.1, type: 'triangle', dur: 0.2 }); break;
            case 'drop': this.seq([67, 60], 0.05, { vol: 0.1 }); break;
            case 'chalice': this.seq([72, 76, 79, 84, 79, 84, 88], 0.07, { vol: 0.12, type: 'square', dur: 0.12 }); this.seq([60, 64, 67], 0.0, { vol: 0.07, type: 'sawtooth', dur: 0.9 }); break;
            case 'slash': if (this.ok('slash', 0.05)) { N(0.12, 2600, 'highpass', 0.3); this.tone(900, 0.1, { f1: 300, vol: 0.06, type: 'sawtooth' }); } break;
            case 'dash': N(0.18, 1200, 'bandpass', 0.25); this.tone(220, 0.15, { f1: 600, vol: 0.06, type: 'sine' }); break;
            case 'hurt': this.tone(320, 0.18, { f1: 90, vol: 0.2 }); N(0.1, 900, 'lowpass', 0.25); break;
            case 'die': this.seq([72, 67, 63, 60, 55, 51, 48], 0.07, { vol: 0.14, type: 'square' }); break;
            case 'swallow': this.tone(400, 0.6, { f1: 60, vol: 0.2, type: 'sawtooth' }); N(0.3, 300, 'lowpass', 0.4, 0.15); this.tone(120, 0.12, { f1: 50, vol: 0.3, type: 'sine', t: 0.55 }); break;
            case 'jaws': if (this.ok('jaws', 0.15)) { this.tone(110, 0.3, { f1: 70, vol: 0.12, type: 'sawtooth' }); N(0.25, 500, 'lowpass', 0.12); } break;
            case 'snap': this.tone(180, 0.06, { f1: 60, vol: 0.2 }); N(0.05, 2000, 'bandpass', 0.3); break;
            case 'roar': if (this.ok('roar', 0.3)) { this.tone(o.big ? 90 : 160, o.big ? 0.9 : 0.45, { f1: o.big ? 40 : 70, vol: 0.2, type: 'sawtooth' }); N(o.big ? 0.8 : 0.4, 700, 'lowpass', 0.25); } break;
            case 'dhit': this.tone(520, 0.08, { f1: 180, vol: 0.18 }); N(0.08, 2400, 'bandpass', 0.3); break;
            case 'dkill': N(0.6, 800, 'lowpass', 0.6); this.seq([84, 79, 76, 72, 67, 64, 60], 0.035, { vol: 0.1, type: 'square' }); this.tone(90, 0.5, { f1: 30, vol: 0.4, type: 'sine' }); break;
            case 'gate': for (let i = 0; i < 9; i++) N(0.03, 1800 + i * 150, 'bandpass', 0.22, i * 0.07); this.seq([60, 67, 72, 76, 79], 0.09, { vol: 0.1, type: 'triangle', dur: 0.4, t: 0 }); break;
            case 'fire': if (this.ok('fire', 0.06)) { N(0.25, 900, 'lowpass', 0.35); this.tone(200, 0.2, { f1: 80, vol: 0.08, type: 'sawtooth' }); } break;
            case 'ice': if (this.ok('ice', 0.06)) { for (let i = 0; i < 4; i++) this.tone(2400 + i * 500, 0.08, { vol: 0.04, type: 'sine', t: i * 0.03 }); N(0.2, 5000, 'highpass', 0.12); } break;
            case 'tell': if (this.ok('tell', 0.2)) this.tone(300, 0.35, { f1: 600, vol: 0.05, type: 'sawtooth' }); break;
            case 'block': this.tone(1800, 0.12, { f1: 1200, vol: 0.1, type: 'triangle' }); break;
            case 'fizz': if (this.ok('fizz', 0.05)) N(0.08, 3000, 'highpass', 0.08); break;
            case 'teleport': this.tone(200, 0.45, { f1: 2400, vol: 0.12, type: 'sine' }); this.tone(300, 0.45, { f1: 3000, vol: 0.06, type: 'square', t: 0.05 }); break;
            case 'arm': this.seq([88, null, 88], 0.08, { vol: 0.1 }); break;
            case 'blast': N(0.9, 600, 'lowpass', 0.8); this.tone(120, 0.8, { f1: 25, vol: 0.5, type: 'sine' }); N(0.3, 3000, 'bandpass', 0.3); break;
            case 'rubble': if (this.ok('rubble', 0.04)) N(0.12, 400 + Math.random() * 400, 'lowpass', 0.15); break;
            case 'bridge': this.seq([55, 59, 62, 67], 0.05, { vol: 0.1, type: 'triangle' }); N(0.15, 600, 'lowpass', 0.2); break;
            case 'batgrab': this.seq([91, 96, 91, 98], 0.035, { vol: 0.08, type: 'square' }); break;
            case 'snatch': this.seq([88, 84, 79, 76, 72], 0.03, { vol: 0.1, type: 'square' }); N(0.2, 4000, 'highpass', 0.1); break;
            case 'bathit': this.tone(1400, 0.3, { f1: 200, vol: 0.12, type: 'square' }); N(0.2, 3000, 'bandpass', 0.2); break;
            case 'flap': if (this.ok('flap', 0.22)) N(0.05, 700, 'bandpass', 0.05); break;
            case 'gem': { const PENTA = [0, 2, 4, 7, 9]; const i = (o.chain || 1) - 1; const m = 76 + PENTA[i % 5] + 12 * Math.min(2, Math.floor(i / 5)); this.tone(midiHz(m), 0.12, { vol: 0.09, type: 'square' }); this.tone(midiHz(m + 12), 0.18, { vol: 0.05, type: 'triangle', t: 0.04 }); if (o.big) this.seq([m + 7, m + 12], 0.05, { vol: 0.06, t: 0.06 }); break; }
            case 'battery': this.seq([60, 64, 67, 72, 76], 0.04, { vol: 0.09, type: 'triangle' }); break;
            case 'oneup': case 'extra': this.seq([76, 79, 88, 84, 86, 91], 0.07, { vol: 0.11, type: 'square' }); break;
            case 'cassette': this.tone(300, 0.4, { f1: 1200, vol: 0.06, type: 'sawtooth' }); this.seq([84, 88, 91, 96], 0.06, { vol: 0.09, type: 'triangle', t: 0.3 }); break;
            case 'shard': this.seq([88, 95, 100, 95, 100, 107], 0.05, { vol: 0.07, type: 'triangle', dur: 0.3 }); break;
            case 'citadel': this.seq([48, 55, 60, 64, 67, 72, 76, 79], 0.08, { vol: 0.1, type: 'sawtooth', dur: 0.8 }); N(1.2, 300, 'lowpass', 0.3); break;
            case 'nullwarn': this.seq([84, null, 84, null, 84], 0.09, { vol: 0.09, type: 'square' }); break;
            case 'null': N(1.2, 2000, 'bandpass', 0.35); this.tone(60, 1.0, { f1: 30, vol: 0.3, type: 'sawtooth' }); break;
            case 'nullstun': N(0.3, 6000, 'highpass', 0.2); this.tone(1600, 0.2, { f1: 200, vol: 0.08 }); break;
            case 'static': if (this.ok('static', 0.12)) N(0.12, 3000 + Math.random() * 3000, 'bandpass', 0.04 * (o.v || 1)); break;
            case 'boss': this.sfx('roar', { big: true }); N(1.5, 200, 'lowpass', 0.5); break;
            case 'phase': this.tone(80, 1.2, { f1: 30, vol: 0.4, type: 'sawtooth' }); N(1, 500, 'lowpass', 0.5); this.seq([96, 91, 84, 79], 0.05, { vol: 0.08 }); break;
            case 'bosshit': this.tone(700, 0.12, { f1: 200, vol: 0.22, type: 'square' }); N(0.12, 3500, 'bandpass', 0.3); break;
            case 'clank': if (this.ok('clank', 0.1)) { this.tone(2400, 0.15, { f1: 2200, vol: 0.12, type: 'triangle' }); this.tone(3200, 0.1, { vol: 0.06, type: 'sine' }); } break;
            case 'bossboom': if (this.ok('bossboom', 0.06)) { N(0.5, 500 + Math.random() * 500, 'lowpass', 0.5); this.tone(90, 0.4, { f1: 30, vol: 0.3, type: 'sine' }); } break;
            case 'fan': if (this.ok('fan', 0.1)) N(0.3, 1200, 'bandpass', 0.25); break;
            case 'laserTell': this.tone(200, 0.9, { f1: 1600, vol: 0.06, type: 'sawtooth' }); break;
            case 'laser': this.tone(140, 0.6, { vol: 0.15, type: 'sawtooth' }); N(0.6, 2500, 'bandpass', 0.25); break;
            case 'slam': N(0.4, 400, 'lowpass', 0.5); this.tone(70, 0.3, { f1: 30, vol: 0.4, type: 'sine' }); break;
            case 'blink': this.tone(1200, 0.2, { f1: 300, vol: 0.06, type: 'sine' }); this.tone(300, 0.2, { f1: 1500, vol: 0.06, type: 'sine', t: 0.15 }); break;
            case 'barrier': N(1.5, 3000, 'bandpass', 0.3); this.seq([72, 79, 84, 91, 96, 103], 0.08, { vol: 0.07, type: 'triangle', dur: 0.4 }); break;
            case 'secret': this.seq([72, 76, 79, 83, 84, 88, 91, 95, 96], 0.07, { vol: 0.08, type: 'triangle', dur: 0.5 }); break;
            case 'coin': N(0.04, 5000, 'highpass', 0.3); this.tone(1900, 0.08, { vol: 0.1, type: 'square', t: 0.03 }); this.tone(2530, 0.25, { vol: 0.1, type: 'square', t: 0.1 }); break;
            case 'start': this.seq([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.06, { vol: 0.11, type: 'square', dur: 0.1 }); break;
            case 'move': this.tone(880, 0.04, { vol: 0.06 }); break;
            case 'select': this.seq([84, 91], 0.04, { vol: 0.08 }); break;
            case 'back': this.seq([79, 72], 0.04, { vol: 0.07 }); break;
            case 'tick': this.tone(1320, 0.05, { vol: 0.07 }); break;
            case 'room': N(0.18, 900, 'bandpass', 0.06); break;
            case 'nouse': this.tone(140, 0.06, { vol: 0.06 }); break;
            case 'clear': this.seq([60, 64, 67, 72, null, 67, 72, null, 76, 79, 84], 0.09, { vol: 0.12, type: 'square', dur: 0.16 }); break;
            case 'gameover': this.seq([67, null, 63, null, 60, null, 55, 54, 55], 0.16, { vol: 0.12, type: 'triangle', dur: 0.4 }); break;
            case 'tally': if (this.ok('tally', 0.03)) this.tone(1600 + Math.random() * 400, 0.03, { vol: 0.05 }); break;
            case 'respawn': this.tone(300, 0.4, { f1: 1200, vol: 0.08, type: 'triangle' }); break;
            case 'rumble': N(0.6, 120, 'lowpass', 0.4); break;
        }
    }

    // ================================================================ the arcade around you
    startAmbience() {
        const c = this.ctx;
        const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6;
        const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1400;
        const g = c.createGain(); g.gain.value = 0.045;
        const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
        const lg = c.createGain(); lg.gain.value = 0.018;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        src.connect(f); f.connect(f2); f2.connect(g); g.connect(this.ambBus);
        src.start();
        this.ambNext = this.now + 2;
    }

    ambienceTick() {
        if (!this.amb || this.now < this.ambNext) return;
        this.ambNext = this.now + 1.4 + Math.random() * 3.6;
        const c = this.ctx;
        const pan = c.createStereoPanner ? c.createStereoPanner() : null;
        const out = c.createGain(); out.gain.value = 0.35;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + Math.random() * 1500;
        out.connect(lp);
        if (pan) { pan.pan.value = Math.random() < 0.5 ? -0.5 - Math.random() * 0.5 : 0.5 + Math.random() * 0.5; lp.connect(pan); pan.connect(this.ambBus); }
        else lp.connect(this.ambBus);
        const r = Math.random();
        if (r < 0.55) {
            // another machine's attract-mode bleeps
            const base = 60 + Math.floor(Math.random() * 24);
            const n = 3 + Math.floor(Math.random() * 6);
            for (let i = 0; i < n; i++) this.tone(midiHz(base + [0, 3, 5, 7, 10, 12][Math.floor(Math.random() * 6)]), 0.08, { vol: 0.07, t: i * 0.08, dest: out, type: Math.random() < 0.5 ? 'square' : 'triangle' });
        } else if (r < 0.75) {
            this.noise(this.now, 0.5, 500, 'lowpass', 0.2, out);
            this.tone(100, 0.4, { f1: 40, vol: 0.12, type: 'sine', dest: out });
        } else if (r < 0.88) {
            this.noise(this.now, 0.03, 5000, 'highpass', 0.12, out);
            this.tone(1900, 0.06, { vol: 0.05, t: 0.02, dest: out });
            this.tone(2500, 0.15, { vol: 0.05, t: 0.08, dest: out });
        } else {
            this.tone(400, 0.6, { f1: 1600, vol: 0.05, type: 'sawtooth', dest: out });
        }
    }
}

export const audio = new AudioEngine();
export { SONGS };
