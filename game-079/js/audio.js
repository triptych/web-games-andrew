// Procedural sound, all Web Audio, no files.
//
// Music: a look-ahead synthwave sequencer (two clocks: a 25 ms timer schedules 16ths on the audio
// clock). Pad + octave bass when it's quiet; drums and arps when the fight is on; a generated lead
// for bosses. Side-chain pump on every kick. Overdrive closes a low-pass over the whole mix.
// Effects answer sim events, panned by where they happen relative to where you're looking.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// chord degrees in the natural minor; songs are progressions of degrees
const SONGS = {
    title: { root: 57, bpm: 104, prog: [0, 5, 2, 6], lead: 3 },
    strip: { root: 52, bpm: 118, prog: [0, 5, 2, 6], lead: 7 },
    mall: { root: 55, bpm: 124, prog: [0, 3, 5, 4], lead: 11 },
    sewer: { root: 50, bpm: 112, prog: [0, 0, 5, 4], lead: 13 },
    ship: { root: 53, bpm: 132, prog: [0, 6, 5, 6], lead: 17 },
    throne: { root: 49, bpm: 140, prog: [0, 5, 3, 4], lead: 19 },
    boss: { root: 52, bpm: 150, prog: [0, 1, 0, 6], lead: 23 },
    ending: { root: 57, bpm: 96, prog: [5, 2, 6, 0], lead: 29 },
};

function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.song = null;
        this.intensity = 0;
        this.lim = new Map();
        this.listener = { x: 0, z: 0, yaw: 0 };
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
        this.master = ctx.createBiquadFilter();       // Overdrive low-pass over everything
        this.master.type = 'lowpass'; this.master.frequency.value = 20000; this.master.Q.value = 0.8;
        this.master.connect(comp);
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(this.master);
        this.pump = ctx.createGain(); this.pump.connect(this.music);
        // a gated reverb for snares, a hall for everything else
        this.gate = ctx.createConvolver(); this.gate.buffer = this.impulse(0.28, true); this.gate.connect(this.music);
        this.hall = ctx.createConvolver(); this.hall.buffer = this.impulse(1.8, false);
        const hg = ctx.createGain(); hg.gain.value = 0.3; this.hall.connect(hg); hg.connect(this.master);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.step = 0; this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
        if (this.wantSong) this.playSong(this.wantSong);
    }

    impulse(sec, gated) {
        const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
        const b = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = b.getChannelData(ch);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (gated ? (i < n * 0.9 ? 0.6 : 0.6 * (1 - (i - n * 0.9) / (n * 0.1))) : Math.pow(1 - i / n, 3));
        }
        return b;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.05);
    }

    setOverdrive(on) {
        if (!this.ctx) return;
        this.master.frequency.setTargetAtTime(on ? 900 : 20000, this.ctx.currentTime, on ? 0.08 : 0.4);
    }

    // ================================================================ music
    playSong(id) {
        this.wantSong = id;
        if (!this.ctx || this.song?.id === id) return;
        const s = SONGS[id] || SONGS.strip;
        const rng = mulberry(s.lead * 7919);
        // a generated 2-bar lead motif per chord: 16 steps of scale degrees (or rests)
        const motif = [];
        for (let b = 0; b < 2; b++) {
            let deg = Math.floor(rng() * 5);
            for (let k = 0; k < 16; k++) {
                const strong = k % 4 === 0;
                if (rng() < (strong ? 0.85 : 0.35)) { deg = Math.max(-2, Math.min(9, deg + Math.floor(rng() * 5) - 2)); motif.push(deg); } else motif.push(null);
            }
        }
        this.song = { id, ...s, spb: 60 / s.bpm, motif };
        this.step = 0;
        this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.05);
    }
    stopSong() { this.song = null; this.wantSong = null; }
    setIntensity(i) { this.intensity = i; }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || !this.song) return;
        const st = this.song.spb / 4;
        if (this.nextT < ctx.currentTime - 0.2) {
            const skip = Math.ceil((ctx.currentTime - this.nextT) / st);
            this.step += skip; this.nextT += skip * st;
        }
        while (this.nextT < ctx.currentTime + 0.12) {
            this.playStep(this.step, this.nextT);
            this.nextT += st; this.step++;
        }
    }

    chordNotes(deg) {
        const s = this.song;
        const sc = (d) => s.root + MINOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
        return [sc(deg), sc(deg + 2), sc(deg + 4)];
    }

    playStep(i, t) {
        const s = this.song, ctx = this.ctx;
        const bar = Math.floor(i / 16), k = i % 16;
        const deg = s.prog[bar % s.prog.length];
        const ch = this.chordNotes(deg);
        const I = this.intensity;
        // kick and pump
        if (I >= 1 && k % 4 === 0) {
            this.drum('kick', t);
            this.pump.gain.cancelScheduledValues(t);
            this.pump.gain.setValueAtTime(0.35, t);
            this.pump.gain.linearRampToValueAtTime(1, t + s.spb * 0.8);
        } else if (I === 0 && k === 0) { this.pump.gain.setValueAtTime(1, t); }
        if (I >= 1 && (k === 4 || k === 12)) this.drum('snare', t);
        if (I >= 1 && k % 2 === 1) this.drum('hat', t, k % 4 === 3 ? 0.5 : 0.3);
        if (I >= 2 && k === 14 && bar % 2) this.drum('snare', t, 0.5);
        // bass: octave pulses on 8ths (16ths when it's a boss)
        if ((I >= 2 ? true : k % 2 === 0)) this.synth('bass', NOTE(ch[0] - 24 + (k % 4 === 2 ? 12 : 0)), t, st(s) * (I >= 2 ? 0.9 : 1.8), 0.32);
        // pad on the bar
        if (k === 0) for (const n of ch) this.synth('pad', NOTE(n - 12), t, s.spb * 4, 0.07);
        // arpeggio
        if (I >= 1) {
            const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1], ch[0] + 12, ch[2] + 12];
            this.synth('arp', NOTE(arp[k % 8]), t, st(s) * 0.9, 0.07);
        }
        // the lead
        if (I >= 2) {
            const m = s.motif[(bar % 2) * 16 + k];
            if (m !== null && m !== undefined) {
                const n = s.root + 12 + MINOR[((m % 7) + 7) % 7] + 12 * Math.floor(m / 7);
                this.synth('lead', NOTE(n), t, st(s) * 1.8, 0.09);
            }
        }
        void ctx;
        function st(so) { return so.spb / 4; }
    }

    synth(kind, f, t, dur, vol) {
        const ctx = this.ctx;
        const g = ctx.createGain();
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        const oscs = [];
        if (kind === 'bass') {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; oscs.push(o);
            flt.frequency.setValueAtTime(900, t); flt.frequency.exponentialRampToValueAtTime(180, t + dur); flt.Q.value = 6;
            g.connect(this.pump);
        } else if (kind === 'pad') {
            for (const det of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; oscs.push(o); }
            flt.frequency.value = 1300; flt.Q.value = 0.5;
            g.connect(this.pump);
            const hs = ctx.createGain(); hs.gain.value = 0.25; g.connect(hs); hs.connect(this.hall);
        } else if (kind === 'arp') {
            const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; oscs.push(o);
            flt.frequency.setValueAtTime(3200, t); flt.frequency.exponentialRampToValueAtTime(600, t + dur); flt.Q.value = 3;
            g.connect(this.music);
            const hs = ctx.createGain(); hs.gain.value = 0.3; g.connect(hs); hs.connect(this.hall);
        } else {
            for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; oscs.push(o); }
            const vib = ctx.createOscillator(), vg = ctx.createGain();
            vib.frequency.value = 5.5; vg.gain.value = 6;
            vib.connect(vg); for (const o of oscs) vg.connect(o.detune);
            vib.start(t); vib.stop(t + dur + 0.1);
            flt.frequency.value = 2600; flt.Q.value = 1;
            g.connect(this.music);
            const hs = ctx.createGain(); hs.gain.value = 0.45; g.connect(hs); hs.connect(this.hall);
        }
        const att = kind === 'pad' ? 0.5 : 0.005;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + att);
        g.gain.setTargetAtTime(0.0001, t + Math.max(att, dur * 0.6), dur * 0.25);
        for (const o of oscs) { o.connect(flt); o.start(t); o.stop(t + dur + 0.3); }
        flt.connect(g);
    }

    drum(kind, t, vol = 1) {
        const ctx = this.ctx;
        if (kind === 'kick') {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
            g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.32);
        } else if (kind === 'snare') {
            const n = this.noise(t, 0.18, 0.45 * vol, 'bandpass', 1800, 0.8, this.music);
            void n;
            const nn = this.ctx.createBufferSource(); nn.buffer = this.noiseBuf;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.35 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            nn.connect(g); g.connect(this.gate); nn.start(t, Math.random()); nn.stop(t + 0.15);
            const o = ctx.createOscillator(), og = ctx.createGain();
            o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
            og.gain.setValueAtTime(0.3 * vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            o.connect(og); og.connect(this.music); o.start(t); o.stop(t + 0.12);
        } else {
            this.noise(t, 0.04, 0.12 * vol, 'highpass', 7000, 0.7, this.music);
        }
    }

    // ================================================================ effect building blocks
    noise(t, dur, vol, type = 'lowpass', freq = 1000, q = 1, out = null, freqTo = null) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        src.connect(f); f.connect(g); g.connect(out || this.out);
        src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
        return g;
    }
    tone(t, { freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, out = null, q = 0, lp = 0 } = {}) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let last = o;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q || 1; o.connect(f); last = f; }
        last.connect(g); g.connect(out || this.out);
        o.start(t); o.stop(t + dur + 0.02);
    }
    /** A voice for a position in the world: panned and attenuated. */
    at(x, z, vol = 1) {
        const ctx = this.ctx;
        const L = this.listener;
        const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
        const right = Math.cos(L.yaw) * dx + Math.sin(L.yaw) * dz;
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, d > 0.5 ? right / d * 0.85 : 0));
        const g = ctx.createGain();
        g.gain.value = vol / (1 + d * d * 0.004);
        g.connect(pan); pan.connect(this.sfx);
        return g;
    }
    get out() { return this.sfx; }
    limit(key, gap) {
        const now = this.ctx.currentTime;
        if ((this.lim.get(key) || 0) > now - gap) return false;
        this.lim.set(key, now);
        return true;
    }
    ok() { return this.ctx && this.ctx.state === 'running'; }

    ui(kind) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        if (kind === 'click') this.tone(t, { freq: 880, to: 1200, dur: 0.05, type: 'square', vol: 0.06 });
        else if (kind === 'open') this.tone(t, { freq: 440, to: 880, dur: 0.1, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone(t, { freq: 880, to: 440, dur: 0.1, type: 'triangle', vol: 0.1 });
        else if (kind === 'start') { this.noise(t, 1.2, 0.3, 'lowpass', 300, 1, null, 4000); this.tone(t, { freq: 55, to: 110, dur: 1.2, type: 'sawtooth', vol: 0.3, lp: 800 }); }
    }

    // ================================================================ effects from sim events
    onEvents(G, events) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        const p = G.player;
        Object.assign(this.listener, { x: p.x, z: p.z, yaw: p.yaw });
        for (const e of events) {
            switch (e.type) {
                case 'fire': this.gun(t, e); break;
                case 'tracer': if (e.hit === 'wall' && this.limit('ric', 0.05) && Math.random() < 0.3) this.tone(t, { freq: 2400 + Math.random() * 1500, to: 900, dur: 0.12, type: 'sine', vol: 0.05, out: this.at(e.x1, e.z1) }); break;
                case 'hit': if (this.limit('hit', 0.04)) { const o = this.at(e.x, e.z, 1); this.noise(t, 0.09, 0.35, 'bandpass', 500 + Math.random() * 300, 2, o); this.tone(t, { freq: 140, to: 70, dur: 0.08, type: 'sine', vol: 0.25, out: o }); } break;
                case 'kill': {
                    const o = this.at(e.x, e.z, 1.2);
                    if (e.shatter) { for (let k = 0; k < 5; k++) this.tone(t + k * 0.02, { freq: 2500 + Math.random() * 3000, to: 1500, dur: 0.25, type: 'sine', vol: 0.08, out: o }); this.noise(t, 0.3, 0.3, 'highpass', 3000, 1, o); }
                    else if (e.gib) { this.noise(t, 0.35, 0.6, 'lowpass', 900, 3, o, 200); this.noise(t + 0.05, 0.25, 0.4, 'bandpass', 400, 4, o); this.tone(t, { freq: 90, to: 40, dur: 0.3, type: 'sine', vol: 0.4, out: o }); }
                    else this.voice(t, e.etype, 'death', o);
                    break;
                }
                case 'explode': {
                    const o = this.at(e.x, e.z, e.big ? 1.6 : 1.1);
                    this.noise(t, e.big ? 1.4 : 0.8, 0.9, 'lowpass', e.big ? 1800 : 2600, 1, o, 60);
                    this.tone(t, { freq: 90, to: 28, dur: e.big ? 0.9 : 0.5, type: 'sine', vol: 0.8, out: o });
                    const h = this.ctx.createGain(); h.gain.value = 0.4; o.connect(h); h.connect(this.hall);
                    break;
                }
                case 'impact': if (this.limit('imp' + e.kind, 0.05)) { const o = this.at(e.x, e.z, 0.8); if (e.kind === 'disc') this.tone(t, { freq: 1800, to: 2600, dur: 0.15, type: 'triangle', vol: 0.12, out: o }); else this.noise(t, 0.12, 0.25, 'bandpass', 1500, 2, o); } break;
                case 'hurt': if (this.limit('hurt', 0.25)) { this.tone(t, { freq: 320, to: 200, dur: 0.16, type: 'sawtooth', vol: 0.12, lp: 900, q: 4 }); this.noise(t, 0.1, 0.25, 'lowpass', 600); } break;
                case 'kick': this.noise(t, 0.12, 0.35, 'lowpass', 1200, 1, null, 300); if (e.hits) this.tone(t, { freq: 110, to: 50, dur: 0.15, type: 'sine', vol: 0.6 }); break;
                case 'reload': this.noise(t + 0.05, 0.04, 0.3, 'bandpass', 2500, 3); this.noise(t + 0.25, 0.05, 0.35, 'bandpass', 1800, 3); break;
                case 'reloaded': this.noise(t, 0.05, 0.4, 'bandpass', 1400, 4); break;
                case 'empty': if (this.limit('empty', 0.3)) this.tone(t, { freq: 1600, to: 1500, dur: 0.03, type: 'square', vol: 0.08 }); break;
                case 'switch': this.noise(t, 0.06, 0.2, 'bandpass', 2000, 2); break;
                case 'jump': this.noise(t, 0.12, 0.12, 'bandpass', 700, 1, null, 1400); break;
                case 'land': this.tone(t, { freq: 90, to: 40, dur: 0.15, type: 'sine', vol: 0.4 }); this.noise(t, 0.1, 0.2, 'lowpass', 500); break;
                case 'jet_on': this.jet(true); break;
                case 'jet_off': this.jet(false); break;
                case 'throw': this.noise(t, 0.15, 0.15, 'bandpass', 900, 1, null, 400); this.tone(t + 0.05, { freq: 1200, to: 1200, dur: 0.05, type: 'square', vol: 0.05 }); break;
                case 'pickup': this.pickup(t, e); break;
                case 'drop': break;
                case 'door': { const L = G.L, c = L.doors[e.id].cells[0]; const o = this.at((c % L.W + 0.5) * 3, ((c / L.W | 0) + 0.5) * 3, 1); this.noise(t, 0.9, 0.3, 'bandpass', 500, 1, o, 1500); this.tone(t + 0.85, { freq: 70, to: 45, dur: 0.2, type: 'sine', vol: 0.4, out: o }); break; }
                case 'alert': if (this.limit('alert' + e.etype, 0.4)) { const en = G.enemies.find((q) => q.id === e.id); if (en) this.voice(t, e.etype, 'alert', this.at(en.x, en.z, 1)); } break;
                case 'windup': { const en = G.enemies.find((q) => q.id === e.id); if (en && this.limit('wu' + e.id, 0.3)) this.tone(t, { freq: en.boss ? 120 : 300, to: en.boss ? 400 : 900, dur: 0.35, type: 'sawtooth', vol: 0.06, lp: 2000, out: this.at(en.x, en.z, 1) }); break; }
                case 'eshot': if (this.limit('es' + e.kind, 0.03)) this.enemyShot(t, e); break;
                case 'attack': { const en = G.enemies.find((q) => q.id === e.id); if (en && (e.melee || e.leap || e.hop || e.barrage || en.boss)) this.voice(t, en.type, 'attack', this.at(en.x, en.z, 1.2)); break; }
                case 'teleport': this.tone(t, { freq: 200, to: 2400, dur: 0.3, type: 'sine', vol: 0.12, out: this.at(e.x1, e.z1) }); break;
                case 'spawn': if (this.limit('spawn', 0.08)) this.tone(t, { freq: 2400, to: 300, dur: 0.4, type: 'sine', vol: 0.1, out: this.at(e.x, e.z) }); break;
                case 'freeze': this.tone(t, { freq: 3000, to: 1800, dur: 0.4, type: 'sine', vol: 0.08 }); break;
                case 'arc': if (this.limit('arc', 0.06)) this.noise(t, 0.1, 0.2, 'highpass', 3000, 1); break;
                case 'beam': if (this.limit('beam', 0.05)) this.noise(t, 0.06, 0.18, 'bandpass', 3500 + Math.random() * 2000, 6); break;
                case 'combo': [0, 4, 7, 12].forEach((s, k) => this.tone(t + k * 0.015, { freq: NOTE(57 + s + e.n), to: NOTE(57 + s + e.n) * 0.98, dur: 0.6, type: 'sawtooth', vol: 0.07, lp: 3000 })); break;
                case 'quip': case 'bossTalk': this.tone(t, { freq: 2200, to: 2200, dur: 0.04, type: 'square', vol: 0.04 }); this.noise(t + 0.04, 0.08, 0.06, 'bandpass', 2500, 2); break;
                case 'overdrive': this.setOverdrive(e.on); if (e.on) { this.noise(t, 1, 0.4, 'bandpass', 200, 2, null, 5000); this.tone(t, { freq: 40, to: 30, dur: 1.2, type: 'sine', vol: 0.7 }); } break;
                case 'ambush': for (let k = 0; k < 4; k++) this.tone(t + k * 0.3, { freq: k % 2 ? 660 : 880, dur: 0.25, type: 'square', vol: 0.08, lp: 3000 }); break;
                case 'boss': this.voice(t, e.kind, 'alert', this.sfx, 2); break;
                case 'bossDead': this.noise(t, 2.5, 0.9, 'lowpass', 1500, 1, null, 50); this.tone(t, { freq: 60, to: 20, dur: 2.5, type: 'sine', vol: 0.9 }); break;
                case 'shockwave': this.tone(t, { freq: 60, to: 25, dur: 0.7, type: 'sine', vol: 0.8 }); this.noise(t, 0.6, 0.5, 'lowpass', 400, 1, null, 80); break;
                case 'beam_on': this.tone(t, { freq: 80, to: 160, dur: 6.5, type: 'sawtooth', vol: 0.08, lp: 600 }); break;
                case 'supply': this.tone(t, { freq: 600, to: 1200, dur: 0.3, type: 'triangle', vol: 0.1 }); break;
                case 'slam': this.tone(t, { freq: 80, to: 30, dur: 0.4, type: 'sine', vol: 0.6, out: this.at(e.x, e.z) }); break;
                case 'objective': break;
                case 'nodrop': this.tone(t, { freq: 200, to: 160, dur: 0.15, type: 'square', vol: 0.08 }); break;
                case 'clear': [0, 3, 7, 12, 15, 19].forEach((s, k) => this.tone(t + k * 0.09, { freq: NOTE(64 + s), dur: 0.4, type: 'square', vol: 0.08, lp: 3000 })); break;
                case 'death': this.tone(t, { freq: 400, to: 40, dur: 1.4, type: 'sawtooth', vol: 0.25, lp: 1200 }); this.noise(t, 1, 0.3, 'lowpass', 800, 1, null, 80); break;
                case 'won': [0, 4, 7, 12, 16, 19, 24].forEach((s, k) => this.tone(t + k * 0.12, { freq: NOTE(57 + s), dur: 0.8, type: 'sawtooth', vol: 0.07, lp: 4000 })); break;
            }
        }
    }

    gun(t, e) {
        const el = e.element;
        switch (e.arch) {
            case 'pistol': this.noise(t, 0.12, 0.6, 'lowpass', 4000, 1, null, 600); this.tone(t, { freq: 180, to: 60, dur: 0.1, type: 'sine', vol: 0.5 }); break;
            case 'shotgun': this.noise(t, 0.4, 0.9, 'lowpass', 2500, 1, null, 200); this.tone(t, { freq: 110, to: 35, dur: 0.3, type: 'sine', vol: 0.8 }); this.noise(t + 0.38, 0.06, 0.3, 'bandpass', 1200, 3); this.noise(t + 0.5, 0.06, 0.3, 'bandpass', 900, 3); break;
            case 'ripper': if (this.limit('rip', 0.05)) { this.noise(t, 0.07, 0.45, 'lowpass', 3500, 1, null, 900); this.tone(t, { freq: 140, to: 70, dur: 0.06, type: 'sine', vol: 0.35 }); } break;
            case 'rocket': this.noise(t, 0.6, 0.6, 'bandpass', 400, 1, null, 2000); this.tone(t, { freq: 80, to: 40, dur: 0.25, type: 'sine', vol: 0.6 }); break;
            case 'photon': if (this.limit('pho', 0.05)) this.tone(t, { freq: 1500, to: 260, dur: 0.14, type: 'square', vol: 0.12, lp: 3000 }); break;
            case 'disc': this.tone(t, { freq: 300, to: 900, dur: 0.25, type: 'sawtooth', vol: 0.12, lp: 2500 }); this.tone(t, { freq: 2600, to: 2400, dur: 0.2, type: 'sine', vol: 0.06 }); break;
            case 'tesla': if (this.limit('tes', 0.05)) { this.noise(t, 0.07, 0.25, 'bandpass', 4000 + Math.random() * 3000, 5); this.tone(t, { freq: 60, to: 55, dur: 0.07, type: 'sawtooth', vol: 0.08 }); } break;
        }
        if (!el || !this.limit('el', 0.08)) return;
        if (el === 'fire') this.noise(t, 0.3, 0.25, 'lowpass', 900, 1, null, 300);
        else if (el === 'cryo') this.tone(t, { freq: 3200, to: 2400, dur: 0.2, type: 'sine', vol: 0.06 });
        else if (el === 'shock') this.noise(t, 0.12, 0.2, 'highpass', 4000, 2);
        else if (el === 'acid') this.tone(t, { freq: 300, to: 600, dur: 0.15, type: 'triangle', vol: 0.08 });
    }

    enemyShot(t, e) {
        const o = this.at(e.x, e.z, 1);
        switch (e.kind) {
            case 'bolt': this.tone(t, { freq: 900, to: 300, dur: 0.12, type: 'square', vol: 0.1, out: o, lp: 2500 }); break;
            case 'laser': this.tone(t, { freq: 2200, to: 500, dur: 0.18, type: 'sine', vol: 0.12, out: o }); break;
            case 'psi': this.tone(t, { freq: 300, to: 600, dur: 0.4, type: 'triangle', vol: 0.12, out: o }); break;
            case 'erocket': case 'emissile': this.noise(t, 0.4, 0.3, 'bandpass', 500, 1, o, 1500); break;
            default: this.noise(t, 0.1, 0.2, 'bandpass', 800, 2, o);
        }
    }

    /** A formant growl, roar or screech per creature. */
    voice(t, type, what, out, k = 1) {
        const ctx = this.ctx;
        const base = { trooper: 120, chomper: 340, drone: 900, brute: 70, psy: 200, tank: 55, chompra: 90, vrask: 75, rourke: 60, pylon: 400 }[type] || 150;
        const dur = (what === 'death' ? 0.6 : what === 'attack' ? 0.35 : 0.5) * (k > 1 ? 2 : 1);
        if (type === 'drone' || type === 'pylon') { this.tone(t, { freq: base * 2, to: base * (what === 'death' ? 0.3 : 1.5), dur, type: 'square', vol: 0.08, out, lp: 3000 }); return; }
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * (what === 'alert' ? 1.4 : 1), t);
        o.frequency.exponentialRampToValueAtTime(base * (what === 'death' ? 0.5 : 0.8), t + dur);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 18 + Math.random() * 12; lg.gain.value = base * 0.15;
        lfo.connect(lg); lg.connect(o.frequency);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = base * 5; f1.Q.value = 3;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = base * 11; f2.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out || this.sfx);
        o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
        this.noise(t, dur * 0.7, 0.08 * k, 'bandpass', base * 8, 2, out || this.sfx);
    }

    pickup(t, e) {
        const up = (notes, type = 'square', vol = 0.07) => notes.forEach((n, k) => this.tone(t + k * 0.05, { freq: NOTE(n), dur: 0.12, type, vol }));
        if (e.kind === 'gun') { const r = e.rarity || 0; up([60, 64, 67, 72 + r * 2].map((n) => n + r), 'sawtooth', 0.06); if (r >= 4) up([84, 88, 91, 96], 'triangle', 0.06); }
        else if (e.kind === 'key') up([76, 83, 88], 'triangle', 0.1);
        else if (e.kind === 'tape') { this.noise(t, 0.6, 0.12, 'bandpass', 300, 2); up([72, 72, 79], 'square', 0.05); }
        else if (e.kind === 'cola') { this.noise(t, 0.25, 0.2, 'highpass', 5000, 1); up([72, 76], 'triangle', 0.08); }
        else if (e.kind === 'burger' || e.kind === 'vest') up([64, 69, 72], 'triangle', 0.09);
        else up([67, 71], 'square', 0.05);
    }

    jet(on) {
        const ctx = this.ctx;
        if (on && !this.jetSrc) {
            const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
            const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
            const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.25, ctx.currentTime, 0.05);
            s.connect(f); f.connect(g); g.connect(this.sfx); s.start();
            this.jetSrc = { s, g };
        } else if (!on && this.jetSrc) {
            const j = this.jetSrc; this.jetSrc = null;
            j.g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
            j.s.stop(ctx.currentTime + 0.4);
        }
    }
}
