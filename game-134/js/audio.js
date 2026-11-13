// Sound. Music, effects and voices are ElevenLabs recordings in ../audio/ (see dev/audio/README.md); anything that
// fails to load falls back to the procedural Web Audio synth below, so the game is never silent.
// Effects answer simulation events. Music plays through <audio> elements routed into a gain node (so
// ../lib/page-audio.js still silences a hidden tab) and crossfades between themes.
// The context is made on the first user gesture (browsers block audio before one).

import { VOICE } from './voicelines.js';

const BASE = new URL('../audio/', import.meta.url).href;
const SFX = ['moo', 'cluck', 'oink', 'baa', 'yelp', 'beam', 'catch', 'bank', 'bonk', 'boom', 'shotgun', 'net', 'flash', 'laser',
    'charge', 'jet', 'crash', 'hit', 'honk', 'sputter', 'hiccup', 'pickup', 'overheat', 'stamp', 'drop', 'fanfare', 'sad'];
const TRACKS = ['theme', 'play', 'boss', 'report'];
const CRITTER = { cow: 'moo', golden: 'moo', chicken: 'cluck', pig: 'oink', sheep: 'baa', farmer: 'yelp', townie: 'yelp', gunner: 'yelp', agent: 'yelp', tinfoil: 'yelp' };
const ZIB = { catch: ['zib-catch-0', 'zib-catch-1'], hit: ['zib-hit-0'], crash: ['zib-crash-0'], drop: ['zib-drop-0'], glitch: ['zib-glitch-0'], quota: ['zib-quota-0'], respawn: ['zib-respawn-0'] };
const GENERAL = { taunt: ['general-taunt-0', 'general-taunt-1', 'general-taunt-2'], hit: ['general-hit-0'], down: ['general-down-0'] };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Songs: 16th-note steps. bass/lead are MIDI notes (0 = rest). drums: k kick, s snare, h hat.
const SONGS = {
    theme: {
        bpm: 138,
        bass: [48, 0, 48, 55, 0, 48, 0, 55, 53, 0, 53, 60, 0, 53, 0, 52, 50, 0, 50, 57, 0, 50, 0, 57, 55, 0, 55, 59, 0, 55, 54, 55],
        lead: [72, 0, 76, 79, 0, 76, 72, 0, 77, 0, 76, 74, 0, 72, 0, 0, 74, 0, 77, 81, 0, 79, 77, 0, 79, 79, 0, 81, 79, 77, 76, 74],
        drums: 'k.h.s.h.k.k.s.h.k.h.s.h.k.k.s.hs',
    },
    play: {
        bpm: 150,
        bass: [45, 45, 57, 45, 0, 45, 57, 45, 43, 43, 55, 43, 0, 43, 55, 43, 41, 41, 53, 41, 0, 41, 53, 41, 43, 43, 55, 43, 47, 0, 50, 52],
        lead: [69, 0, 72, 0, 74, 76, 0, 74, 72, 0, 67, 0, 0, 0, 71, 72, 69, 0, 72, 0, 74, 77, 0, 76, 74, 72, 71, 0, 72, 0, 0, 0],
        drums: 'k.hsk.hsk.hsk.ss',
    },
    boss: {
        bpm: 164,
        bass: [40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 46, 40, 40, 52, 40, 41, 41, 53, 41, 38, 38, 50, 38, 39, 39, 51, 42],
        lead: [64, 0, 67, 0, 70, 0, 69, 67, 0, 64, 0, 62, 64, 0, 0, 0, 64, 0, 67, 0, 70, 72, 70, 69, 67, 0, 66, 0, 67, 0, 0, 0],
        drums: 'k.skk.skk.skk.ss',
    },
    report: {
        bpm: 110,
        bass: [48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0],
        lead: [76, 0, 79, 0, 84, 0, 0, 0, 81, 0, 79, 0, 76, 0, 0, 0],
        drums: 'h.h.h.h.h.h.h.h.',
    },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.voiceVol = 0.7;
        this.song = null;
        this.wantSong = null;
        this.step = 0;
        this.nextT = 0;
        this.hum = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = this.comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.meter = ctx.createAnalyser();
        this.meter.fftSize = 256;
        comp.connect(this.meter);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        const len = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.timer = setInterval(() => this.schedule(), 50);
        this.loadFiles();
        if (this.wantSong) this.playSong(this.wantSong);
    }

    // ------------------------------------------------------------------ recorded audio
    loadFiles() {
        const ctx = this.ctx;
        this.buf = {};
        this.voiceBuf = {};
        this.failed = [];
        this.lastT = {};
        this.speaking = null;
        const get = (url, into, key) => fetch(url)
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no)))
            .then((b) => { into[key] = b; })
            .catch(() => this.failed.push(key));
        for (const n of SFX) get(`${BASE}sfx/${n}.mp3`, this.buf, n);
        const voices = new Set([...Object.values(VOICE), ...Object.values(ZIB).flat(), ...Object.values(GENERAL).flat()]);
        for (const v of voices) get(`${BASE}vo/${v}.mp3`, this.voiceBuf, v);
        // music: one <audio> per theme, each through its own fade gain into the music bus
        this.musicFile = ctx.createGain(); this.musicFile.gain.value = this.musicVol * 0.8; this.musicFile.connect(this.comp);
        this.tracks = {};
        for (const n of TRACKS) {
            const el = new window.Audio();
            el.src = `${BASE}music/${n}.mp3`;
            el.loop = true;
            el.preload = n === 'theme' ? 'auto' : 'metadata';
            const t = { el, ok: true, fade: ctx.createGain() };
            t.fade.gain.value = 0;
            try { ctx.createMediaElementSource(el).connect(t.fade); } catch { t.ok = false; }
            t.fade.connect(this.musicFile);
            el.addEventListener('error', () => { t.ok = false; this.failed.push('music-' + n); if (this.track === n) { this.track = null; this.synthSong(n); } });
            this.tracks[n] = t;
        }
    }

    /** Play a recorded effect. Returns false if it isn't loaded, so the caller can synthesise one. */
    play(name, { vol = 1, rate = 1, gap = 0.06 } = {}) {
        if (!this.ok() || !this.buf?.[name]) return false;
        const now = this.ctx.currentTime;
        if (now - (this.lastT[name] || 0) < gap) return true;      // a burst of the same event is one sound
        this.lastT[name] = now;
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = this.buf[name];
        src.playbackRate.value = rate;
        g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start();
        return true;
    }

    /** Speak a recorded line. Mother interrupts the others; the others wait their turn or stay quiet. */
    say(id, { mother = false } = {}) {
        if (!this.ok() || !this.voiceBuf?.[id]) return false;
        if (this.speaking && !mother) return true;
        if (this.speaking) { try { this.speaking.stop(); } catch { /* already done */ } }
        const src = this.ctx.createBufferSource();
        src.buffer = this.voiceBuf[id];
        src.connect(this.voice);
        src.onended = () => { if (this.speaking === src) this.speaking = null; };
        src.start();
        this.speaking = src;
        return true;
    }
    zib(kind, chance = 1) { if (Math.random() < chance) this.say(pickOne(ZIB[kind])); }
    general(kind, chance = 1) {
        const now = this.ctx?.currentTime || 0;
        if (kind === 'taunt' && now - (this.lastTaunt || -99) < 7) return;
        if (Math.random() < chance) { this.say(pickOne(GENERAL[kind])); if (kind === 'taunt') this.lastTaunt = now; }
    }
    stopVoice() { if (this.speaking) { try { this.speaking.stop(); } catch { /* done */ } this.speaking = null; } }

    /** The output level right now (0..1), for the tests. */
    level() {
        if (!this.meter) return 0;
        const a = new Uint8Array(this.meter.fftSize);
        this.meter.getByteTimeDomainData(a);
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v - 128));
        return m / 128;
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * 0.35, t, 0.02);
        this.voice.gain.setTargetAtTime(voice, t, 0.02);
        this.musicFile?.gain.setTargetAtTime(music * 0.8, t, 0.02);
    }

    // ------------------------------------------------------------------ music
    playSong(name) {
        this.wantSong = name;
        if (!this.ctx) return;
        const t = this.tracks?.[name];
        if (t && t.ok) {
            if (this.track === name) return;
            this.song = null;                          // the synth steps aside
            const now = this.ctx.currentTime;
            for (const [n, o] of Object.entries(this.tracks)) {
                if (n === name) continue;
                o.fade.gain.setTargetAtTime(0, now, 0.25);
                setTimeout(() => { if (this.track !== n) o.el.pause(); }, 1200);
            }
            this.track = name;
            t.el.currentTime = name === 'report' ? 0 : t.el.currentTime;
            t.fade.gain.setTargetAtTime(1, now, 0.3);
            t.el.play().catch(() => { t.ok = false; this.track = null; this.synthSong(name); });
            return;
        }
        this.synthSong(name);
    }
    synthSong(name) {
        if (!this.ctx || this.song === name) return;
        this.song = name;
        this.step = 0;
        this.nextT = this.ctx.currentTime + 0.08;
    }
    /** Which theme is audibly playing: a recorded track, a synth song, or null. For the tests. */
    nowPlaying() {
        const t = this.track && this.tracks?.[this.track];
        if (t && !t.el.paused) return 'file:' + this.track;
        return this.song ? 'synth:' + this.song : null;
    }
    stopSong() {
        this.song = null; this.wantSong = null;
        if (this.tracks) for (const t of Object.values(this.tracks)) { t.fade.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
        const was = this.track;
        this.track = null;
        setTimeout(() => { if (!this.track && was) this.tracks[was].el.pause(); }, 900);
    }

    schedule() {
        if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
        const S = SONGS[this.song];
        const dur = 60 / S.bpm / 4;
        if (this.nextT < this.ctx.currentTime - 0.2) this.nextT = this.ctx.currentTime + 0.05;
        while (this.nextT < this.ctx.currentTime + 0.2) {
            const i = this.step;
            const b = S.bass[i % S.bass.length], l = S.lead[i % S.lead.length], dr = S.drums[i % S.drums.length];
            if (b) this.note(NOTE(b), this.nextT, dur * 0.9, 'square', 0.16, this.music, 900);
            if (l) this.note(NOTE(l), this.nextT, dur * 1.6, 'triangle', 0.22, this.music, 4000, true);
            if (dr === 'k') this.kick(this.nextT);
            else if (dr === 's') this.noise(this.nextT, 0.12, 0.25, 1800, this.music, 'bandpass');
            else if (dr === 'h') this.noise(this.nextT, 0.03, 0.08, 7000, this.music, 'highpass');
            this.nextT += dur;
            this.step++;
        }
    }

    note(freq, t, dur, type, vol, dest, cut = 3000, vib = false) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = type; o.frequency.value = freq;
        if (vib) {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 6; lg.gain.value = freq * 0.012;
            lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
        }
        f.type = 'lowpass'; f.frequency.value = cut;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    }
    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.2);
    }
    noise(t, dur, vol, freq, dest, type = 'lowpass', q = 1) {
        const ctx = this.ctx;
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this.noiseBuf;
        f.type = type; f.frequency.value = freq; f.Q.value = q;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    // ------------------------------------------------------------------ effects
    ok() { return this.ctx && this.ctx.state === 'running'; }
    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, dest } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    burst(dur, vol, freq, type = 'lowpass', delay = 0) { if (this.ok()) this.noise(this.ctx.currentTime + delay, dur, vol, freq, this.sfx, type); }

    /** A cartoon animal voice: a saw through a formant filter with a pitch contour. */
    critter(kind) {
        if (!this.ok()) return;
        const V = {
            cow: [190, 120, 0.55, 700], golden: [230, 150, 0.6, 800], pig: [320, 220, 0.18, 1200], sheep: [380, 360, 0.45, 1500],
            chicken: [900, 700, 0.09, 2400], farmer: [500, 900, 0.3, 1800], townie: [600, 1100, 0.3, 2000],
            gunner: [260, 380, 0.25, 1300], agent: [180, 150, 0.3, 900], tinfoil: [450, 950, 0.4, 2200],
        }[kind] || [400, 300, 0.2, 1500];
        const [f0, f1, dur, form] = V;
        const reps = kind === 'chicken' ? 3 : 1;
        for (let r = 0; r < reps; r++) {
            const t = this.ctx.currentTime + r * 0.11;
            const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
            if (kind === 'sheep') { const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 18; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
            f.type = 'bandpass'; f.frequency.value = form; f.Q.value = 3;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(f); f.connect(g); g.connect(this.sfx);
            o.start(t); o.stop(t + dur + 0.02);
        }
    }

    /** Mother talks: cartoon gibberish, one syllable per few letters of what she says. */
    mother(text, mood = 0) {
        if (!this.ok()) return;
        if (VOICE[text] && this.say(VOICE[text], { mother: true })) return;    // her recorded line
        const n = Math.min(14, Math.max(3, Math.round(text.length / 6)));
        let t = this.ctx.currentTime + 0.02;
        for (let i = 0; i < n; i++) {
            const dur = 0.07 + Math.random() * 0.07;
            const base = (mood < 0 ? 210 : 260) + Math.sin(i * 1.7) * 50 + Math.random() * 40;
            const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (i === n - 1 ? (mood < 0 ? 0.8 : 1.3) : 1.05), t + dur);
            f.type = 'bandpass'; f.Q.value = 4;
            f.frequency.setValueAtTime(600 + Math.random() * 900, t); f.frequency.linearRampToValueAtTime(900 + Math.random() * 1200, t + dur);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(f); f.connect(g); g.connect(this.voice);
            o.start(t); o.stop(t + dur + 0.02);
            t += dur + 0.025;
        }
    }

    /** The beam's hum, on while the beam is. */
    setHum(on, mega = false) {
        if (!this.ok()) return;
        const ctx = this.ctx;
        if (this.buf?.beam) {                         // the recorded loop, pitched up for the Mega Beam
            if (on && !this.hum) {
                const src = ctx.createBufferSource(), g = ctx.createGain();
                src.buffer = this.buf.beam; src.loop = true;
                g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.08);
                src.connect(g); g.connect(this.sfx); src.start();
                this.hum = { src, g };
            } else if (!on && this.hum) {
                const h = this.hum, t = ctx.currentTime;
                h.g.gain.setTargetAtTime(0.0001, t, 0.04);
                (h.src || h.o).stop(t + 0.2);
                for (const n of [h.o2, h.lfo]) n?.stop(t + 0.2);
                this.hum = null;
            }
            if (this.hum?.src) this.hum.src.playbackRate.setTargetAtTime(mega ? 1.35 : 1, ctx.currentTime, 0.05);
            return;
        }
        if (on && !this.hum) {
            const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.value = 110; o2.type = 'sine'; o2.frequency.value = 660;
            lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
            f.type = 'lowpass'; f.frequency.value = 900;
            g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.08);
            o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx);
            o.start(); o2.start(); lfo.start();
            this.hum = { o, o2, lfo, g };
        } else if (!on && this.hum) {
            const h = this.hum, t = ctx.currentTime;
            h.g.gain.setTargetAtTime(0.0001, t, 0.03);
            for (const n of [h.o, h.o2, h.lfo]) n.stop(t + 0.15);
            this.hum = null;
        }
        if (this.hum) this.hum.o2.frequency.setTargetAtTime(mega ? 990 : 660, ctx.currentTime, 0.05);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, to: 990, dur: 0.06, type: 'triangle', vol: 0.15 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.1, type: 'triangle', vol: 0.15 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.1, type: 'triangle', vol: 0.15 });
        else if (['stamp', 'fanfare', 'sad'].includes(kind) && this.play(kind, { vol: kind === 'stamp' ? 1 : 0.8 })) { /* recorded */ }
        else if (kind === 'stamp') { this.burst(0.15, 0.6, 400); this.tone({ freq: 120, to: 60, dur: 0.2, type: 'sine', vol: 0.5 }); }
        else if (kind === 'fanfare') [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.12, delay: i * 0.1 }));
        else if (kind === 'sad') [392, 370, 349, 330].forEach((f, i) => this.tone({ freq: f, to: f * 0.97, dur: 0.35, type: 'triangle', vol: 0.2, delay: i * 0.3 }));
    }

    /** The recorded effect (and voice) for an event, if there is one. Returns true when it handled it. */
    fileEvent(G, e) {
        if (!this.buf) return false;
        const r = () => 0.92 + Math.random() * 0.16;          // a little pitch variety
        switch (e.type) {
            case 'grab': return Math.random() < 0.7 ? this.play(CRITTER[e.kind] || 'moo', { rate: r(), vol: 0.75, gap: 0.3 }) : true;
            case 'catch': this.zib('catch', 0.12); return this.play('catch', { vol: 0.8 });
            case 'bank': return this.play('bank');
            case 'quota': return this.play('fanfare', { vol: 0.7 });
            case 'drop': this.zib('drop', 0.4); return this.play('drop', { vol: 0.7 });
            case 'bonk': return this.play('bonk');
            case 'boom': return this.play('boom');
            case 'bosshit': this.general('hit', 0.6); return this.play('boom', { rate: 0.85 });
            case 'bossdown': this.general('down'); return this.play('boom', { rate: 0.7 });
            case 'hit': this.zib('hit', e.cause === 'backfire' ? 0 : 0.35); return this.play('hit') && (e.cause !== 'backfire' || this.play('flash', { rate: 0.7, vol: 0.6 }));
            case 'crash': this.zib('crash'); return this.play('crash');
            case 'respawn': this.zib('respawn', 0.6); return false;
            case 'glitch': this.zib('glitch', 0.2); return this.play({ honk: 'honk', hiccup: 'hiccup', sputter: 'sputter' }[e.kind]);
            case 'overheat': return this.play('overheat');
            case 'windup':
                if (e.kind === 'boss') this.general('taunt', 0.5);
                if (e.kind === 'laser' || (e.kind === 'boss' && e.aimX)) return this.play('charge', { vol: 0.7 });
                return false;
            case 'shot': return e.kind === 'pellet' ? this.play('shotgun', { rate: r(), vol: 0.8 }) : e.kind === 'net' ? this.play('net') : false;
            case 'flash': return this.play('flash');
            case 'laser': return this.play('laser');
            case 'jet': return this.play('jet');
            case 'pickup': return this.play('pickup');
            case 'wake': return this.play('yelp', { rate: 0.8, vol: 0.6 });
            case 'won': return this.play('fanfare');
            case 'over': return this.play('sad');
            case 'report': this.setHum(false); this.stopVoice(); return this.play(e.success ? 'fanfare' : 'sad', { vol: 0.7 });
        }
        return false;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type !== 'beamon' && e.type !== 'beamoff' && this.fileEvent(G, e)) continue;
            switch (e.type) {
                case 'beamon': this.setHum(true, G.ufo.fx.mega > 0); break;
                case 'beamoff': this.setHum(false); break;
                case 'grab': if (Math.random() < 0.6) this.critter(e.kind); break;
                case 'catch': this.tone({ freq: 300, to: 1400, dur: 0.18, type: 'sine', vol: 0.25 }); this.tone({ freq: 1400, dur: 0.06, type: 'square', vol: 0.08, delay: 0.17 }); break;
                case 'bank': [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'square', vol: 0.12, delay: i * 0.06 })); break;
                case 'quota': this.ui('fanfare'); break;
                case 'drop': this.tone({ freq: 900, to: 200, dur: 0.5, type: 'sine', vol: 0.2 }); break;
                case 'empty': this.tone({ freq: 200, dur: 0.08, type: 'square', vol: 0.08 }); break;
                case 'bonk': this.tone({ freq: 700, to: 680, dur: 0.06, type: 'square', vol: 0.3 }); this.tone({ freq: 180, to: 420, dur: 0.35, type: 'sine', vol: 0.3, delay: 0.05 }); break;
                case 'boom': case 'bossdown': this.burst(0.8, 0.7, 500); this.tone({ freq: 90, to: 30, dur: 0.6, type: 'sine', vol: 0.6 }); break;
                case 'bosshit': this.tone({ freq: 220, to: 200, dur: 0.15, type: 'square', vol: 0.3 }); this.burst(0.3, 0.5, 900); break;
                case 'hit': this.burst(0.25, 0.5, 1200); this.tone({ freq: 160, to: 60, dur: 0.25, type: 'square', vol: 0.3 }); break;
                case 'crash': this.tone({ freq: 900, to: 60, dur: 1.2, type: 'sawtooth', vol: 0.25 }); this.burst(0.9, 0.6, 600, 'lowpass', 1.0); break;
                case 'respawn': this.tone({ freq: 200, to: 900, dur: 0.4, type: 'triangle', vol: 0.2 }); break;
                case 'glitch':
                    if (e.kind === 'honk') { this.tone({ freq: 330, dur: 0.18, type: 'square', vol: 0.25 }); this.tone({ freq: 262, dur: 0.25, type: 'square', vol: 0.25, delay: 0.2 }); }
                    else if (e.kind === 'hiccup') this.tone({ freq: 300, to: 900, dur: 0.15, type: 'sine', vol: 0.3 });
                    else for (let i = 0; i < 5; i++) this.burst(0.06, 0.4, 300, 'lowpass', i * 0.12);
                    break;
                case 'overheat': this.tone({ freq: 600, to: 80, dur: 0.6, type: 'sawtooth', vol: 0.2 }); this.burst(0.5, 0.2, 3000, 'highpass'); break;
                case 'windup':
                    if (e.kind === 'gunner') { this.tone({ freq: 500, dur: 0.04, type: 'square', vol: 0.15 }); this.tone({ freq: 400, dur: 0.04, type: 'square', vol: 0.15, delay: 0.1 }); }
                    else if (e.kind === 'laser' || (e.kind === 'boss' && e.aimX)) this.tone({ freq: 200, to: 1200, dur: 1.0, type: 'sine', vol: 0.12 });
                    else if (e.kind === 'tinfoil') this.tone({ freq: 2000, to: 3000, dur: 0.5, type: 'sine', vol: 0.06 });
                    break;
                case 'shot':
                    if (e.kind === 'pellet') this.burst(0.25, 0.6, 1500);
                    else if (e.kind === 'net') this.burst(0.3, 0.25, 2500, 'bandpass');
                    else { this.tone({ freq: 140, to: 50, dur: 0.3, type: 'square', vol: 0.3 }); this.burst(0.2, 0.4, 800); }
                    break;
                case 'flash': this.tone({ freq: 2400, to: 4000, dur: 0.05, type: 'square', vol: 0.12 }); this.burst(0.15, 0.2, 5000, 'highpass'); break;
                case 'laser': this.tone({ freq: 1600, to: 300, dur: 0.45, type: 'sawtooth', vol: 0.18 }); break;
                case 'jetwarn': for (let i = 0; i < 3; i++) this.tone({ freq: 1200, dur: 0.12, type: 'square', vol: 0.12, delay: i * 0.25 }); break;
                case 'jet': if (this.ok()) { const t = this.ctx.currentTime; const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6); f.frequency.exponentialRampToValueAtTime(300, t + 1.4); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + 1.5); } break;
                case 'netted': this.tone({ freq: 400, to: 200, dur: 0.3, type: 'triangle', vol: 0.2 }); break;
                case 'backfire': this.burst(0.3, 0.4, 4000, 'bandpass'); this.tone({ freq: 80, to: 2000, dur: 0.2, type: 'sawtooth', vol: 0.15 }); break;
                case 'deflect': this.tone({ freq: 1200, to: 2400, dur: 0.08, type: 'sine', vol: 0.12 }); break;
                case 'pickup': [880, 1320, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.08, type: 'triangle', vol: 0.18, delay: i * 0.05 })); break;
                case 'wake': this.critter(e.kind); break;
                case 'hurry': this.tone({ freq: 880, dur: 0.1, vol: 0.12 }); this.tone({ freq: 880, dur: 0.1, vol: 0.12, delay: 0.2 }); break;
                case 'report': this.setHum(false); if (e.success) this.ui('fanfare'); else this.ui('sad'); break;
                case 'upgrade': this.ui('open'); break;
                case 'won': this.ui('fanfare'); break;
                case 'over': this.ui('sad'); break;
            }
        }
    }
}
