// Procedural sound and music, all Web Audio, no files. Effects answer simulation events; each
// area has a little tune of its own, written by a seeded melody-maker over a chord progression
// and scheduled ahead on the audio clock. The library's tune grows a layer as grimoires return.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the
// tab is hidden.

import { GRIMOIRE } from './sim/data/books.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11];

// root (midi), scale, bpm, beats per bar, chords (scale degrees), voices
const TRACKS = {
    title:   { root: 65, scale: MAJOR, bpm: 76, beats: 3, chords: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'box', pad: true, bass: 'soft', seed: 3 },
    library: { root: 65, scale: MAJOR, bpm: 72, beats: 3, chords: [0, 5, 3, 4, 0, 3, 1, 4], lead: 'box', pad: true, bass: 'soft', seed: 3, grows: true },
    village: { root: 67, scale: MAJOR, bpm: 96, beats: 3, chords: [0, 3, 4, 0, 0, 3, 4, 4], lead: 'pluck', pad: false, bass: 'oom', seed: 11 },
    fields:  { root: 62, scale: MAJOR, bpm: 88, beats: 4, chords: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'flute', pad: true, bass: 'soft', seed: 21 },
    wood:    { root: 57, scale: DORIAN, bpm: 80, beats: 4, chords: [0, 3, 0, 4, 5, 3, 6, 4], lead: 'flute', pad: true, bass: 'soft', seed: 31 },
    moor:    { root: 52, scale: MINOR, bpm: 66, beats: 4, chords: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'flute', pad: true, bass: 'drone', seed: 41 },
    cave:    { root: 50, scale: MINOR, bpm: 60, beats: 4, chords: [0, 0, 5, 4, 0, 3, 5, 4], lead: 'bell', pad: true, bass: 'drone', seed: 51, sparse: true },
    peak:    { root: 60, scale: LYDIAN, bpm: 70, beats: 4, chords: [0, 1, 0, 4, 5, 1, 3, 4], lead: 'bell', pad: true, bass: 'soft', seed: 61 },
    coast:   { root: 65, scale: MAJOR, bpm: 84, beats: 3, chords: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'pluck', pad: true, bass: 'oom', seed: 71 },
    lake:    { root: 58, scale: MAJOR, bpm: 68, beats: 4, chords: [0, 3, 5, 4, 0, 3, 1, 4], lead: 'bell', pad: true, bass: 'soft', seed: 81 },
    castle:  { root: 60, scale: MAJOR, bpm: 92, beats: 4, chords: [0, 3, 4, 0, 5, 1, 4, 4], lead: 'pluck', pad: true, bass: 'march', seed: 91 },
    mouse:   { root: 72, scale: MAJOR, bpm: 120, beats: 4, chords: [0, 4, 0, 4, 3, 0, 4, 0], lead: 'pizz', pad: false, bass: 'oom', seed: 101 },
    sky:     { root: 64, scale: MAJOR, bpm: 78, beats: 4, chords: [0, 3, 5, 4, 0, 1, 3, 4], lead: 'bell', pad: true, bass: 'soft', seed: 111, arp: true },
    abbey:   { root: 55, scale: MINOR, bpm: 58, beats: 4, chords: [0, 5, 3, 4, 0, 6, 3, 4], lead: 'flute', pad: true, bass: 'drone', seed: 121, sparse: true },
    shop:    { root: 69, scale: MAJOR, bpm: 100, beats: 4, chords: [0, 5, 1, 4, 0, 5, 3, 4], lead: 'pluck', pad: false, bass: 'oom', seed: 131 },
    house:   { root: 64, scale: MAJOR, bpm: 74, beats: 3, chords: [0, 3, 0, 4, 0, 3, 4, 0], lead: 'box', pad: true, bass: 'soft', seed: 141 },
    dungeon: { root: 57, scale: MINOR, bpm: 74, beats: 4, chords: [0, 5, 6, 4, 0, 3, 6, 4], lead: 'pluck', pad: true, bass: 'drone', seed: 151 },
    battle:  { root: 62, scale: DORIAN, bpm: 132, beats: 4, chords: [0, 0, 6, 6, 3, 3, 4, 4], lead: 'pizz', pad: false, bass: 'walk', seed: 161, drums: true },
    boss:    { root: 57, scale: MINOR, bpm: 138, beats: 4, chords: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'pluck', pad: true, bass: 'walk', seed: 171, drums: true },
    final:   { root: 53, scale: MINOR, bpm: 100, beats: 4, chords: [0, 5, 6, 4, 0, 3, 4, 4], lead: 'bell', pad: true, bass: 'drone', seed: 181, drums: true },
    ending:  { root: 65, scale: MAJOR, bpm: 70, beats: 3, chords: [0, 3, 4, 0, 5, 3, 4, 0], lead: 'box', pad: true, bass: 'soft', seed: 191, arp: true },
};

function rngOf(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A melody: for each step of each bar, a scale degree (relative to the octave) or null. */
function compose(tr) {
    const r = rngOf(tr.seed);
    const steps = tr.beats * 2;
    const bars = tr.chords.length;
    const out = [];
    let deg = 2;
    for (let b = 0; b < bars; b++) {
        const ch = tr.chords[b];
        const tones = [ch, ch + 2, ch + 4];
        const bar = [];
        for (let s = 0; s < steps; s++) {
            const strong = s % 2 === 0;
            const rest = tr.sparse ? r() < 0.55 : r() < (strong ? 0.12 : 0.45);
            if (rest && !(s === 0)) { bar.push(null); continue; }
            if (strong) {
                // land on a chord tone near where we are
                let best = tones[0], bd = 99;
                for (const t of tones) for (const o of [-7, 0, 7]) { const d = Math.abs(t + o - deg); if (d < bd) { bd = d; best = t + o; } }
                deg = best;
            } else deg += r() < 0.5 ? 1 : -1;
            deg = Math.max(-2, Math.min(10, deg));
            bar.push(deg);
        }
        // the last bar comes home
        if (b === bars - 1) bar[steps - 2] = 0;
        out.push(bar);
    }
    return out;
}

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.track = null;
        this.want = null;
        this.layers = 1;
        this.melodies = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3.5;
        comp.connect(ctx.destination);
        this.out = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a soft room: noise impulse reverb shared by music and sfx
        const len = ctx.sampleRate * 2.2;
        const imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = imp.getChannelData(c);
            let s = 12345 + c;
            for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = imp;
        this.wet = ctx.createGain(); this.wet.gain.value = 0.32;
        this.verb.connect(this.wet); this.wet.connect(comp);
        // a noise buffer for brushes, shushes and whooshes
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        let s = 777;
        for (let i = 0; i < nd.length; i++) { s = (s * 16807) % 2147483647; nd[i] = (s / 2147483647) * 2 - 1; }
        this.noiseBuf = nb;
        this.trackGain = null;
        if (this.want) { const w = this.want; this.want = null; this.play(w.name, w.layers); }
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    get ok() { return this.ctx && this.ctx.state === 'running'; }

    // ---------------------------------------------------------------- voices
    env(g, t, a, peak, d) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    osc(type, f, t, dur, vol, dest, { a = 0.005, to = null, detune = 0, send = 0.2 } = {}) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (detune) o.detune.value = detune;
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        this.env(g, t, a, vol, dur);
        o.connect(g); g.connect(dest);
        if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verb); }
        o.start(t); o.stop(t + a + dur + 0.05);
        return o;
    }
    noise(t, dur, vol, dest, { lp = 4000, hp = 0, to = null, send = 0.15 } = {}) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
        src.playbackRate.value = 1;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t);
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        let last = f;
        if (hp) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; f.connect(h); last = h; }
        const g = ctx.createGain(); this.env(g, t, 0.01, vol, dur);
        src.connect(f); last.connect(g); g.connect(dest);
        if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verb); }
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }

    voice(kind, f, t, dur, vol, dest) {
        switch (kind) {
            case 'box': this.osc('sine', f, t, dur * 1.6, vol, dest, { send: 0.35 }); this.osc('triangle', f * 2, t, dur * 0.5, vol * 0.25, dest, { send: 0.3 }); break;
            case 'pluck': this.osc('triangle', f, t, dur * 1.2, vol, dest, { send: 0.22 }); this.osc('square', f, t, 0.06, vol * 0.12, dest, { send: 0 }); break;
            case 'flute': this.osc('sine', f, t, dur * 1.1, vol * 0.9, dest, { a: 0.06, send: 0.35 }); this.osc('triangle', f, t, dur, vol * 0.2, dest, { a: 0.08, detune: 6, send: 0.2 }); break;
            case 'bell': this.osc('sine', f, t, dur * 2.2, vol, dest, { send: 0.45 }); this.osc('sine', f * 2.76, t, dur * 0.8, vol * 0.25, dest, { send: 0.45 }); break;
            case 'pizz': this.osc('square', f, t, 0.12, vol * 0.45, dest, { send: 0.12 }); this.osc('triangle', f, t, 0.2, vol * 0.6, dest, { send: 0.1 }); break;
            default: this.osc('triangle', f, t, dur, vol, dest);
        }
    }

    // ---------------------------------------------------------------- music
    /** Switch to a track. layers: for the library, how many parts are playing. */
    play(name, layers = 1) {
        if (!this.ctx) { this.want = { name, layers }; return; }
        if (this.track?.name === name && this.layers === layers) return;
        const same = this.track?.name === name;
        this.layers = layers;
        if (same) return;
        const ctx = this.ctx;
        if (this.trackGain) {
            const old = this.trackGain;
            old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
            setTimeout(() => old.disconnect(), 2000);
        }
        const tr = TRACKS[name] || TRACKS.fields;
        this.melodies[name] ||= compose(tr);
        this.trackGain = ctx.createGain();
        this.trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        this.trackGain.gain.setTargetAtTime(1, ctx.currentTime + 0.15, 0.4);
        this.trackGain.connect(this.music);
        this.track = { name, tr, mel: this.melodies[name], next: ctx.currentTime + 0.2, step: 0 };
    }
    stopMusic() { if (this.trackGain && this.ctx) this.trackGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3); this.track = null; }

    tick() {
        if (!this.ok || !this.track) return;
        const ctx = this.ctx;
        const T = this.track, tr = T.tr;
        const spb = 60 / tr.bpm / 2;            // seconds per step (eighth notes)
        const steps = tr.beats * 2;
        const dest = this.trackGain;
        const layers = tr.grows ? this.layers : 4;
        while (T.next < ctx.currentTime + 0.25) {
            const t = T.next;
            const total = steps * tr.chords.length;
            const bar = Math.floor(T.step / steps) % tr.chords.length, s = T.step % steps;
            const ch = tr.chords[bar];
            const deg = (d) => { const o = Math.floor(d / 7); const k = ((d % 7) + 7) % 7; return tr.root + tr.scale[k] + 12 * o; };
            // bass
            if (tr.bass && (layers >= 1)) {
                const b = deg(ch) - 24;
                if (tr.bass === 'drone' && s === 0) this.osc('sine', NOTE(b), t, spb * steps * 0.95, 0.16, dest, { a: 0.3, send: 0.1 });
                if (tr.bass === 'soft' && s % tr.beats === 0) this.osc('sine', NOTE(b), t, spb * 2.5, 0.18, dest, { a: 0.02, send: 0.05 });
                if (tr.bass === 'oom' && s % 2 === 0) this.osc('triangle', NOTE(s === 0 ? b : b + 7), t, spb * 0.9, 0.14, dest, { send: 0.02 });
                if (tr.bass === 'march' && s % 2 === 0) this.osc('triangle', NOTE(s % 4 === 0 ? b : b + 7), t, spb * 0.8, 0.15, dest, { send: 0.02 });
                if (tr.bass === 'walk') this.osc('triangle', NOTE(deg(ch + [0, 2, 4, 2, 0, 4, 5, 4][s % 8]) - 24), t, spb * 0.8, 0.16, dest, { send: 0.02 });
            }
            // pad
            if (tr.pad && s === 0 && layers >= 2) {
                for (const k of [0, 2, 4]) this.osc('sawtooth', NOTE(deg(ch + k) - 12), t, spb * steps * 0.9, 0.025, dest, { a: 0.4, detune: k * 3 - 4, send: 0.5 });
            }
            // arpeggio
            if ((tr.arp || (tr.grows && layers >= 3)) && s % 1 === 0) {
                const a = [0, 2, 4, 7, 4, 2][s % 6];
                this.osc('sine', NOTE(deg(ch + a) + 12), t, spb * 0.9, 0.035, dest, { send: 0.45 });
            }
            // melody
            const m = T.mel[bar][s];
            if (m != null && layers >= 1 && !(tr.grows && layers < 2 && s % 2)) {
                const v = tr.lead === 'pizz' ? 0.12 : 0.1;
                this.voice(tr.lead, NOTE(deg(m) + (tr.lead === 'bell' ? 12 : 0)), t, spb * 1.6, v, dest);
            }
            // a counter-line in the library once it's half full
            if (tr.grows && layers >= 4 && s % 2 === 1 && m == null) this.voice('flute', NOTE(deg(ch + 4)), t, spb * 1.4, 0.05, dest);
            // drums
            if (tr.drums) {
                if (s % tr.beats === 0) this.osc('sine', 90, t, 0.12, 0.25, dest, { to: 45, send: 0 });
                if (s % 2 === 1) this.noise(t, 0.05, 0.05, dest, { lp: 9000, hp: 5000, send: 0 });
                if (s === tr.beats) this.noise(t, 0.12, 0.09, dest, { lp: 3000, hp: 800, send: 0.1 });
            }
            T.step = (T.step + 1) % total;
            T.next += spb;
        }
    }

    // ---------------------------------------------------------------- effects
    tone(f, dur = 0.12, type = 'triangle', vol = 0.18, delay = 0, to = null) {
        if (!this.ok) return;
        this.osc(type, f, this.ctx.currentTime + delay, dur, vol, this.sfx, { to, send: 0.15 });
    }
    arp(notes, gap = 0.07, type = 'triangle', vol = 0.15, dur = 0.25) { notes.forEach((n, i) => this.tone(NOTE(n), dur, type, vol, i * gap)); }

    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone(880, 0.05, 'sine', 0.08);
        else if (kind === 'move') this.tone(660, 0.03, 'sine', 0.05);
        else if (kind === 'open') this.tone(520, 0.1, 'triangle', 0.1, 0, 780);
        else if (kind === 'close') this.tone(780, 0.1, 'triangle', 0.1, 0, 520);
        else if (kind === 'deny') this.tone(220, 0.12, 'square', 0.06);
    }

    blip(who) {
        if (!this.ok) return;
        const base = who === 'wick' ? 760 : who === 'note' ? 0 : who === 'you' ? 520 : 300 + ((who || '').length * 37) % 300;
        if (!base) return;
        this.osc('sine', base * (0.95 + Math.random() * 0.1), this.ctx.currentTime, 0.035, 0.035, this.sfx, { send: 0 });
    }

    power(book) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        switch (book) {
            case 'gust': this.noise(t, 0.9, 0.22, this.sfx, { lp: 600, to: 3000, send: 0.3 }); break;
            case 'ember': this.noise(t, 0.7, 0.18, this.sfx, { lp: 2500, hp: 600, send: 0.2 }); this.arp([60, 64, 67], 0.06, 'triangle', 0.08); break;
            case 'stone': this.osc('sine', 70, t, 0.8, 0.35, this.sfx, { to: 40, send: 0.3 }); this.noise(t, 0.6, 0.12, this.sfx, { lp: 400 }); break;
            case 'frost': this.arp([84, 88, 91, 96, 91], 0.05, 'sine', 0.08, 0.4); this.noise(t, 0.4, 0.06, this.sfx, { lp: 9000, hp: 5000 }); break;
            case 'verdant': this.arp([67, 71, 74, 79], 0.09, 'sine', 0.1, 0.5); this.noise(t, 0.5, 0.05, this.sfx, { lp: 3000, hp: 1500 }); break;
            case 'echo': [0, 0.18, 0.36, 0.54].forEach((d, i) => this.tone(NOTE(76), 0.3, 'sine', 0.12 / (i + 1), d)); break;
            case 'key': this.tone(1200, 0.04, 'square', 0.06); this.tone(900, 0.06, 'square', 0.06, 0.08); this.arp([72, 76, 79], 0.07, 'triangle', 0.1); break;
            case 'stars': this.arp([84, 79, 88, 91, 96, 100], 0.08, 'sine', 0.09, 0.6); break;
            default: this.arp([72, 76, 79, 84], 0.06, 'sine', 0.1);
        }
    }

    onEvents(G, events) {
        if (!this.ok) return;
        for (const e of events) {
            switch (e.type) {
                case 'chest': this.arp([72, 76, 79, 84], 0.06, 'triangle', 0.12); break;
                case 'gain': this.arp([76, 79, 84], 0.07, 'triangle', 0.12); break;
                case 'gainBook': this.arp([69, 73, 76, 81], 0.07, 'sine', 0.12); break;
                case 'coins': this.tone(1320, 0.08, 'square', 0.05); this.tone(1760, 0.12, 'square', 0.05, 0.07); break;
                case 'buy': case 'sell': this.tone(1320, 0.07, 'square', 0.05); this.tone(1760, 0.1, 'square', 0.05, 0.06); break;
                case 'equip': this.arp([67, 74], 0.05, 'triangle', 0.1); break;
                case 'power': this.power(e.book); break;
                case 'unlock': this.power('key'); break;
                case 'warpStart': if (!e.quiet) this.noise(this.ctx.currentTime, 0.3, 0.05, this.sfx, { lp: 1200, send: 0.2 }); break;
                case 'zone': if (e.first) this.arp([67, 71, 74], 0.1, 'sine', 0.07, 0.5); break;
                case 'notice': this.tone(900, 0.05, 'square', 0.04); this.tone(1200, 0.06, 'square', 0.04, 0.05); break;
                case 'bark': this.blip('wick'); this.blip('wick'); break;
                case 'levelUp': this.arp([72, 76, 79, 84, 88], 0.08, 'triangle', 0.14, 0.35); break;
                case 'restore': this.arp([65, 69, 72, 77, 81, 84], 0.12, 'sine', 0.13, 1.2); this.osc('sawtooth', NOTE(53), this.ctx.currentTime, 2.4, 0.04, this.sfx, { a: 0.6, send: 0.6 }); break;
                case 'rest': this.arp([77, 74, 72, 65], 0.28, 'sine', 0.1, 0.8); break;
                case 'shelve': this.arp([74, 77, 81], 0.05, 'triangle', 0.08); break;
                case 'quest': this.arp(e.state === 'done' ? [72, 79, 84] : [72, 76], 0.08, 'triangle', 0.1); break;
                case 'heal': case 'inkup': this.arp([72, 79], 0.06, 'sine', 0.1); break;
                case 'overwhelmed': this.arp([72, 67, 64, 60], 0.18, 'sine', 0.1, 0.6); break;
                case 'ending': this.arp([65, 69, 72, 77, 81, 84, 89], 0.16, 'sine', 0.12, 1.6); break;
                case 'b_start': this.noise(this.ctx.currentTime, 0.4, 0.12, this.sfx, { lp: 800, to: 4000, send: 0.2 }); this.arp([62, 69, 74], 0.05, 'triangle', 0.1); break;
                default: break;
            }
        }
    }

    // battle beats are played by the director as it shows them
    battleBeat(e) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        switch (e.type) {
            case 'shush': this.noise(t, 0.45, 0.16, this.sfx, { lp: 7000, hp: 2500, send: 0.25 }); break;
            case 'spell': this.power(e.book); break;
            case 'hit': this.osc('sine', e.crit ? 220 : 160, t, 0.12, 0.22, this.sfx, { to: 70, send: 0.05 }); if (e.weak) this.tone(1320, 0.08, 'sine', 0.06); break;
            case 'calm': this.arp([79, 83, 86, 91], 0.05, 'sine', 0.1, 0.4); break;
            case 'ouch': this.osc('triangle', 300, t, 0.18, 0.18, this.sfx, { to: 150, send: 0.05 }); break;
            case 'heal': this.arp([72, 76, 79], 0.06, 'sine', 0.1); break;
            case 'wick': this.noise(t, 0.25, 0.1, this.sfx, { lp: 3000, hp: 800 }); this.tone(660, 0.1, 'sine', 0.06); break;
            case 'charge': this.osc('sawtooth', 80, t, 0.6, 0.06, this.sfx, { to: 160, send: 0.2 }); break;
            case 'won': this.arp([72, 76, 79, 84, 79, 84], 0.09, 'triangle', 0.14, 0.4); break;
            case 'grimoire': this.arp([65, 69, 72, 77, 81, 84, 89], 0.11, 'sine', 0.14, 1.2); break;
            case 'flee': this.noise(t, 0.3, 0.1, this.sfx, { lp: 1500, to: 400 }); break;
            case 'join': this.tone(500, 0.08, 'square', 0.05); break;
            default: break;
        }
    }
}

export const bookChime = (id) => GRIMOIRE[id]?.colour;
