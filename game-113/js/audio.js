// Procedural sound, all Web Audio, no files.
//
// The band's instruments sound only when a note is hit: Lyra's drum kit, Seraphine's plucked harp, Marigold's sung vowels
// (a sawtooth through three formant filters) and Ingrid's horn chords. A hit made early waits for its beat on the
// AudioContext clock; a late one plays at once. The enemy's riff, a soft backing (pad, shaker, Otto's tick) and the
// count-in are scheduled ahead from the song. Song time maps to audio time through `anchor`, which main.js keeps.
// The field has its own looping song with only the layers of the princesses who have joined: the world gets fuller as
// the band grows.

import { chordDeg, midiOf, composeSong, fieldPhrase, phraseBeats } from './sim/song.js';
import { MAPS } from './sim/data/maps.js';
import { ENEMIES } from './sim/data/enemies.js';
import { CHARS } from './sim/data/chars.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const VOWELS = { a: [800, 1150, 2900], e: [400, 1600, 2700], i: [300, 2300, 3000], o: [450, 800, 2830], u: [325, 700, 2530] };
const vowelOf = (syl) => { const m = (syl || 'a').toLowerCase().match(/[aeiouy]/); return m ? (m[0] === 'y' ? 'i' : m[0]) : 'a'; };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.6;
        this.anchor = 0;               // audio time of song time 0
        this.sched = -1e9;             // battle: song time scheduled up to
        this.field = null;             // the field song
        this.lastBlip = 0;
        this.limit = {};
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
        // a hall reverb from a noise impulse
        this.verb = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb.buffer = ir;
        this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.32;
        this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
        this.band = ctx.createGain(); this.band.gain.value = 1; this.band.connect(this.music);
        this.backing = ctx.createGain(); this.backing.gain.value = 0.55; this.backing.connect(this.music);
        this.fieldBus = ctx.createGain(); this.fieldBus.gain.value = 0.0; this.fieldBus.connect(this.music);
        const n = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, n, n);
        const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.distCurve = new Float32Array(256).map((_, i) => { const x = i / 128 - 1; return Math.tanh(x * 3); });
    }
    get on() { return this.ctx && this.ctx.state === 'running'; }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.now, 0.02);
        this.music.gain.setTargetAtTime(music, this.now, 0.02);
    }

    // ------------------------------------------------------------------ building blocks
    env(g, t, a, peak, d, sus = 0.0001) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d);
    }
    osc(type, f, t, dur, vol, out, o = {}) {
        const c = this.ctx, s = c.createOscillator(), g = c.createGain();
        s.type = type; s.frequency.setValueAtTime(f, t);
        if (o.to) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide ?? dur));
        if (o.detune) s.detune.value = o.detune;
        this.env(g, t, o.a ?? 0.005, vol, dur);
        s.connect(g); g.connect(out);
        if (o.verb) { const v = c.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(this.verb); }
        s.start(t); s.stop(t + (o.a ?? 0.005) + dur + 0.05);
        return s;
    }
    burst(t, dur, vol, out, type = 'bandpass', freq = 2000, q = 1, o = {}) {
        const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.noise; s.loop = true;
        f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
        this.env(g, t, o.a ?? 0.002, vol, dur);
        s.connect(f); f.connect(g); g.connect(out);
        if (o.verb) { const v = c.createGain(); v.gain.value = o.verb; g.connect(v); v.connect(this.verb); }
        s.start(t, Math.random() * 0.5); s.stop(t + (o.a ?? 0.002) + dur + 0.05);
    }
    ready(key, gap) { const t = performance.now(); if (t - (this.limit[key] || 0) < gap * 1000) return false; this.limit[key] = t; return true; }

    // ------------------------------------------------------------------ instruments
    kick(t, v = 1, out = this.band) { this.osc('sine', 150, t, 0.32, 0.9 * v, out, { to: 42, glide: 0.18 }); this.burst(t, 0.02, 0.25 * v, out, 'lowpass', 3000); }
    snare(t, v = 1, out = this.band) { this.burst(t, 0.18, 0.5 * v, out, 'bandpass', 2400, 0.8, { verb: 0.25 }); this.osc('triangle', 210, t, 0.1, 0.35 * v, out, { to: 160 }); }
    tom(t, midi, v = 1, out = this.band) { this.osc('sine', mtof(midi || 45), t, 0.28, 0.75 * v, out, { to: mtof((midi || 45) - 7), glide: 0.25, verb: 0.15 }); }
    hat(t, v = 1, out = this.backing) { this.burst(t, 0.035, 0.16 * v, out, 'highpass', 8000); }
    harp(t, midi, v = 1, out = this.band) {
        const f = mtof(midi);
        this.osc('triangle', f, t, 0.9, 0.34 * v, out, { verb: 0.4 });
        this.osc('sine', f * 2, t, 0.45, 0.12 * v, out, { verb: 0.3 });
        this.osc('sine', f * 3.01, t, 0.15, 0.05 * v, out);
    }
    voice(t, midi, dur, syl, v = 1, out = this.band) {
        const c = this.ctx, f = mtof(midi);
        const src = c.createOscillator(); src.type = 'sawtooth'; src.frequency.setValueAtTime(f * 0.985, t); src.frequency.linearRampToValueAtTime(f, t + 0.06);
        const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.3, dur));
        vib.connect(vg); vg.connect(src.frequency);
        const g = c.createGain();
        const d = Math.max(0.16, dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.04);
        g.gain.setValueAtTime(0.5 * v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        const fm = VOWELS[vowelOf(syl)];
        const amps = [1, 0.6, 0.25];
        fm.forEach((ff, i) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 9; const a = c.createGain(); a.gain.value = amps[i] * 1.6; src.connect(bp); bp.connect(a); a.connect(g); });
        g.connect(out);
        const vs = c.createGain(); vs.gain.value = 0.35; g.connect(vs); vs.connect(this.verb);
        src.start(t); vib.start(t); src.stop(t + d + 0.2); vib.stop(t + d + 0.2);
    }
    horn(t, midi, dur, v = 1, out = this.band) {
        const c = this.ctx, d = Math.max(0.25, dur);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
        lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.12); lp.frequency.exponentialRampToValueAtTime(900, t + d);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.06); g.gain.setValueAtTime(0.28 * v, t + d * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
        lp.connect(g); g.connect(out);
        const vs = c.createGain(); vs.gain.value = 0.3; g.connect(vs); vs.connect(this.verb);
        for (const [iv, det] of [[0, -6], [0, 6], [7, 0], [12, 3]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi + iv); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + 0.3); }
        const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(midi - 12); const sg = c.createGain(); this.env(sg, t, 0.04, 0.35 * v, d + 0.2); sub.connect(sg); sg.connect(out); sub.start(t); sub.stop(t + d + 0.3);
    }
    pad(t, notes, dur, v = 1, out = this.backing) {
        const c = this.ctx;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        lp.connect(g); g.connect(out);
        const vs = c.createGain(); vs.gain.value = 0.5; g.connect(vs); vs.connect(this.verb);
        for (const n of notes) for (const det of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
    }
    bass(t, midi, dur, v = 1, out = this.backing) { this.osc('triangle', mtof(midi), t, dur, 0.4 * v, out, { a: 0.01 }); }
    /** The enemy's voice. */
    enemyNote(t, timbre, midi, dur, out = this.backing) {
        const f = mtof(midi);
        const c = this.ctx;
        if (timbre === 'pluck') { this.osc('square', f, t, 0.18, 0.16, out, { verb: 0.2 }); this.osc('square', f * 1.005, t, 0.16, 0.08, out); }
        else if (timbre === 'bell') { this.osc('sine', f * 2, t, 0.8, 0.22, out, { verb: 0.5 }); this.osc('sine', f * 5.4, t, 0.25, 0.08, out); }
        else if (timbre === 'hush') { this.burst(t, Math.max(0.2, dur) + 0.2, 0.22, out, 'bandpass', f * 2, 6, { a: 0.03, verb: 0.6 }); this.osc('sine', f / 2, t, Math.max(0.2, dur) + 0.15, 0.25, out, { a: 0.02 }); }
        else if (timbre === 'buzz') {
            const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
            o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = 8;
            lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.06); lp.frequency.exponentialRampToValueAtTime(400, t + 0.2 + dur);
            this.env(g, t, 0.005, 0.2, 0.22 + dur);
            o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.35);
        } else {
            // growl: a distorted low saw
            const o = c.createOscillator(), ws = c.createWaveShaper(), lp = c.createBiquadFilter(), g = c.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(f / 2, t); o.frequency.exponentialRampToValueAtTime(f / 2 * 0.94, t + 0.2 + dur);
            ws.curve = this.distCurve; lp.type = 'lowpass'; lp.frequency.value = 1300;
            this.env(g, t, 0.01, 0.2, 0.25 + dur);
            o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.4);
        }
    }

    // ------------------------------------------------------------------ the band, on hits
    /** Play a judged party note: at its beat if the press was early, at once if late. */
    playNote(e, at) {
        if (!this.on) return;
        const t = Math.max(this.now + 0.005, at);
        const v = e.j === 'perfect' ? 1 : e.j === 'great' ? 0.85 : 0.65;
        const role = CHARS[e.who]?.role;
        if (role === 'beat') { if (e.drum === 'K') this.kick(t, v); else if (e.drum === 'S') this.snare(t, v); else this.tom(t, e.pitch, v); }
        else if (role === 'melody') this.harp(t, e.pitch, v);
        else if (role === 'lyrics') this.voice(t, e.pitch, e.len > 0 ? e.len : 0.24, e.syl, v);
        else if (role === 'harmony') this.horn(t, e.pitch, e.len > 0 ? e.len : 0.5, v);
    }

    // ------------------------------------------------------------------ battle scheduling
    startBattle(B, songTNow) {
        this.sched = songTNow;
        this.battleSeed = B.song.seed;
        this.fieldBus.gain.setTargetAtTime(0, this.now, 0.15);
    }
    /** Schedule everything the song plays by itself between `sched` and a little ahead of the playhead. */
    battleTick(G) {
        const B = G.battle;
        if (!this.on || !B) return;
        if (B.song.seed !== this.battleSeed) this.startBattle(B, B.t);
        if (B.state === 'talk') { this.droneTick(); this.sched = B.t; return; }
        const ahead = B.t + 0.25;
        if (this.sched < B.t - 0.3) this.sched = B.t - 0.05;
        const from = this.sched, to = ahead;
        if (to <= from) return;
        const spb = B.spb, song = B.song;
        const at = (st) => this.anchor + st;
        const hushing = B.final && B.stage === 'hush';
        const won = B.state !== 'run';
        // per 8th: shaker, and Otto's tick on the beat; per bar: pad and bass
        const e0 = Math.ceil(from / (spb / 2) - 1e-9), e1 = Math.floor(to / (spb / 2) - 1e-9);
        for (let i = e0; i <= e1; i++) {
            const st = i * spb / 2;
            if (st < from || st >= to) continue;
            const t = at(st);
            if (t < this.now - 0.02) continue;
            if (st < 0) { if (i % 2 === 0) this.osc('square', i % 8 === 0 ? 1760 : 1320, t, 0.05, 0.12, this.backing); continue; }   // the count-in
            if (won) continue;
            if (hushing) { if (i % 2 === 0) this.osc('sine', 60, t, 0.25, 0.4, this.backing, { to: 40 }); continue; }   // only a heartbeat
            this.hat(t, i % 2 ? 0.6 : 1);
            if (i % 8 === 0) {
                const bar = Math.floor(st / (spb * 4));
                const d = chordDeg(song, bar);
                this.pad(t, [midiOf(song, d, 0), midiOf(song, d + 2, 0), midiOf(song, d + 4, 0)], spb * 4, B.colossus ? 1.8 : 1);
                if (!B.lanes[3] || G.party.st[B.lanes[3]].hp <= 0) this.bass(t, midiOf(song, d, -1), spb * 1.8, 0.8);
                if (B.colossus) this.horn(t, midiOf(song, d, -1), spb * 3.5, 0.5, this.backing);
            }
        }
        // the enemy plays its own notes; the band's notes wait for a hit
        const e = ENEMIES[B.enemy];
        for (const n of B.notes) {
            if (n.t < from) continue;
            if (n.t >= to) break;
            if (n.side === 'enemy' && n.j !== 'gone') this.enemyNote(at(n.t), e.timbre, n.pitch, n.len, this.backing);
        }
        this.sched = to;
    }
    droneTick() {
        if (!this.on || !this.ready('drone', 1.6)) return;
        this.pad(this.now + 0.02, [38, 45, 50], 2.0, 1.4);
    }

    // ------------------------------------------------------------------ field music
    /** The song of the map we are on, with only the band's unlocked layers. */
    fieldTick(G, quiet = false) {
        if (!this.on) return;
        const key = G.map + '|' + G.party.members.join(',');
        const spec = MAPS[G.map]?.music;
        if (!spec) return;
        if (!this.field || this.field.key !== key) {
            const song = composeSong(spec.seed, { bpm: spec.bpm, scale: spec.scale, lyrics: spec.lyrics });
            const keep = this.field && this.field.map === G.map ? this.field : null;
            this.field = { key, map: G.map, song, k: keep ? keep.k : 0, next: keep ? keep.next : this.now + 0.2, lanes: [0, 1, 2, 3].map((l) => G.party.members.some((m) => CHARS[m].lane === l)) };
        }
        this.fieldBus.gain.setTargetAtTime(quiet ? 0.25 : 0.7, this.now, 0.4);
        const F = this.field, song = F.song, spb = song.spb, beats = phraseBeats();
        if (F.next < this.now - 0.5) F.next = this.now + 0.1;
        while (F.next < this.now + 0.4) {
            const t0 = F.next;
            // a phrase: pad and bass under the band's layers, played quietly and gently
            for (let b = 0; b < beats / 4; b++) {
                const bar = F.k * 2 + b, d = chordDeg(song, bar), t = t0 + b * 4 * spb;
                this.pad(t, [midiOf(song, d, 0), midiOf(song, d + 2, 0), midiOf(song, d + 4, 0)], spb * 4, 1.2, this.fieldBus);
                this.bass(t, midiOf(song, d, -1), spb * 3, 0.6, this.fieldBus);
            }
            const notes = fieldPhrase(song, F.k, F.lanes.map(Boolean));
            for (const n of notes) {
                const t = t0 + n.beat * spb;
                const v = 0.4;
                if (n.lane === 0) { if (G.flags.metOtto) { if (n.drum === 'K') this.kick(t, v * 0.8, this.fieldBus); else if (n.drum === 'S') this.snare(t, v * 0.6, this.fieldBus); } }
                else if (n.lane === 1) this.harp(t, n.pitch, v * 1.2, this.fieldBus);
                else if (n.lane === 2) this.voice(t, n.pitch, Math.max(0.2, n.len * spb), n.syl, v * 0.8, this.fieldBus);
                else if (n.lane === 3) this.horn(t, n.pitch, n.len * spb, v * 0.7, this.fieldBus);
            }
            F.next += beats * spb;
            F.k++;
        }
    }
    stopField() { if (this.ctx) this.fieldBus.gain.setTargetAtTime(0, this.now, 0.3); }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.on) return;
        const t = this.now;
        if (kind === 'click') this.osc('triangle', 880, t, 0.05, 0.12, this.sfx);
        else if (kind === 'open') { this.osc('triangle', 660, t, 0.07, 0.12, this.sfx); this.osc('triangle', 990, t + 0.05, 0.08, 0.1, this.sfx); }
        else if (kind === 'close') { this.osc('triangle', 990, t, 0.07, 0.1, this.sfx); this.osc('triangle', 660, t + 0.05, 0.08, 0.1, this.sfx); }
        else if (kind === 'move') this.osc('sine', 1320, t, 0.03, 0.06, this.sfx);
    }
    blip(who) {
        if (!this.on || !this.ready('blip', 0.05)) return;
        const base = who === 'otto' || who === 'colossus' || who === 'archivist' ? 300 : who === 'vorthrax' || who === 'warden' ? 110 : who === 'narr' ? 520 : 680;
        this.osc(who === 'otto' || who === 'colossus' ? 'square' : 'triangle', base * (0.95 + Math.random() * 0.1), this.now, 0.035, 0.05, this.sfx);
    }
    tap(lane) { if (this.on && this.ready('tap' + lane, 0.03)) this.burst(this.now, 0.02, 0.06, this.sfx, 'highpass', 5000); }

    onEvents(G, events) {
        if (!this.on) return;
        const t = this.now;
        for (const e of events) {
            switch (e.type) {
                case 'judge':
                    if (e.side === 'party') this.playNote(e, this.anchor + e.noteT);
                    else {
                        // a block: a bright clang in the princess's lane, a parry rings higher
                        const f = e.j === 'perfect' ? 1760 : 1180;
                        this.osc('square', f, t, 0.06, 0.08, this.sfx); this.osc('sine', f * 1.5, t, 0.2, 0.08, this.sfx, { verb: 0.3 });
                    }
                    break;
                case 'tap': if (!e.hit) this.tap(e.lane); break;
                case 'hurt': if (e.dmg > 0 && this.ready('hurt', 0.06)) { this.osc('sawtooth', 160, t, 0.14, 0.25, this.sfx, { to: 70 }); this.burst(t, 0.1, 0.25, this.sfx, 'lowpass', 900); } break;
                case 'miss': break;
                case 'heal': if (this.ready('heal', 0.2)) this.osc('sine', 1568, t, 0.15, 0.05, this.sfx, { verb: 0.5 }); break;
                case 'ko': this.osc('triangle', 440, t, 0.6, 0.25, this.sfx, { to: 110, glide: 0.6, verb: 0.5 }); break;
                case 'revive': [523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, t + i * 0.06, 0.25, 0.12, this.sfx, { verb: 0.4 })); break;
                case 'crescendo':
                    this.burst(t, 1.0, 0.35, this.sfx, 'bandpass', 400, 1, { to: 6000, a: 0.3, verb: 0.6 });
                    [0, 4, 7, 12, 16].forEach((iv, i) => this.osc('sawtooth', mtof(60 + iv), t + 0.25 + i * 0.03, 1.2, 0.08, this.sfx, { verb: 0.6, a: 0.02 }));
                    break;
                case 'colossusHit':
                    this.osc('sawtooth', 110, t, 0.5, 0.35, this.sfx, { to: 55 }); this.burst(t, 0.6, 0.5, this.sfx, 'lowpass', 3000, 1, { to: 200, verb: 0.5 });
                    this.horn(t, 45, 0.6, 0.8, this.sfx);
                    break;
                case 'enemyDown': this.burst(t, 1.2, 0.5, this.sfx, 'lowpass', 2500, 1, { to: 120, verb: 0.6 }); this.osc('sine', 90, t, 0.8, 0.5, this.sfx, { to: 30 }); break;
                case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.osc('square', f, t + 0.25 + i * 0.12, i === 5 ? 0.8 : 0.12, 0.09, this.sfx, { verb: 0.3 })); break;
                case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.osc('triangle', f, t + i * 0.25, 0.4, 0.15, this.sfx, { verb: 0.5 })); break;
                case 'levelUp': if (this.ready('lv', 0.3)) [784, 988, 1175, 1568].forEach((f, i) => this.osc('triangle', f, t + 0.5 + i * 0.07, 0.2, 0.1, this.sfx)); break;
                case 'join': [0, 4, 7, 12, 16, 19].forEach((iv, i) => this.harp(t + i * 0.09, 67 + iv, 0.8, this.sfx)); break;
                case 'chest': [1047, 1319, 1568, 2093].forEach((f, i) => this.osc('square', f, t + i * 0.06, 0.1, 0.06, this.sfx)); break;
                case 'crystal': [0, 7, 12, 19].forEach((iv, i) => this.harp(t + i * 0.1, 72 + iv, 0.9, this.sfx)); break;
                case 'encounter': this.osc('sawtooth', 220, t, 0.25, 0.15, this.sfx, { to: 880 }); this.burst(t, 0.4, 0.2, this.sfx, 'bandpass', 800, 2, { to: 5000 }); break;
                case 'battleStart': this.stopField(); this.sched = -1e9; break;
                case 'travel': this.burst(t, 2.2, 0.08, this.sfx, 'bandpass', 300, 2, { a: 0.4 }); break;
                case 'fx':
                    if (e.name === 'rumble' || e.name === 'quake') this.osc('sine', 45, t, 1.2, 0.5, this.sfx, { to: 30, a: 0.1 });
                    else if (e.name === 'shatter' || e.name === 'crack') { for (let i = 0; i < 6; i++) this.osc('sine', 2000 + Math.random() * 3000, t + i * 0.03, 0.3, 0.06, this.sfx, { verb: 0.5 }); }
                    else if (e.name === 'hushwave') { this.burst(t, 1.6, 0.35, this.sfx, 'lowpass', 4000, 1, { to: 80, verb: 0.8 }); }
                    else if (e.name === 'clash') { this.burst(t, 0.15, 0.4, this.sfx, 'bandpass', 3500, 3); this.osc('square', 1400, t, 0.2, 0.08, this.sfx, { to: 900 }); }
                    else if (e.name === 'dragon' || e.name === 'emerge') { this.osc('sawtooth', 70, t, 1.4, 0.3, this.sfx, { to: 45, a: 0.2 }); this.burst(t, 1.2, 0.2, this.sfx, 'lowpass', 600, 1, { a: 0.3 }); }
                    else if (e.name === 'ottoBoot') [523, 784, 1047].forEach((f, i) => this.osc('square', f, t + i * 0.1, 0.1, 0.07, this.sfx));
                    else if (e.name === 'colossus') { this.horn(t, 33, 3, 1.2, this.sfx); this.horn(t + 0.4, 40, 2.6, 1, this.sfx); }
                    else if (e.name === 'seal' || e.name === 'revive') [0, 4, 7, 11, 14].forEach((iv, i) => this.harp(t + i * 0.08, 64 + iv, 0.9, this.sfx));
                    else if (e.name === 'fall') this.burst(t, 1.5, 0.3, this.sfx, 'lowpass', 1200, 1, { to: 200, a: 0.2, verb: 0.6 });
                    else if (e.name === 'vanish') this.burst(t, 1.0, 0.2, this.sfx, 'bandpass', 3000, 2, { to: 300, verb: 0.6 });
                    break;
                default: break;
            }
        }
    }
}
