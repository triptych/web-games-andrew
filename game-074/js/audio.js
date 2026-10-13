// Everything you hear is synthesised here with Web Audio: no audio files.
// A lookahead sequencer plays one track per circle (bass, a formant "choir",
// arpeggios, bells, organ, drums and a melody), a boss theme, Malphas's own
// theme, a title hymn and the ending. Sound effects are short synth patches.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CH = { m: [0, 3, 7, 12], M: [0, 4, 7, 12], s: [0, 5, 7, 12], d: [0, 3, 6, 12], m7: [0, 3, 7, 10] };

// step = 16th note. Lead: [step, midi, lengthInSteps]
const TRACKS = {
    title: {
        bpm: 76, chords: [[50, 'm'], [46, 'M'], [43, 'm'], [45, 'M']], pad: 'choir', padVol: 0.5, bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null], bassVol: 0.5,
        bells: [0, 8], bellOct: 3,
        lead: [[0, 74, 8], [8, 72, 4], [12, 69, 4], [16, 70, 12], [28, 69, 4], [32, 67, 8], [40, 69, 4], [44, 70, 4], [48, 69, 16]], leadInst: 'bell',
    },
    cradle: {
        bpm: 132, chords: [[50, 'm'], [46, 'M'], [48, 'M'], [45, 'm']], pad: 'choir', padVol: 0.28,
        bass: [0, null, 0, 12, 0, null, 0, null, 0, null, 0, 12, 7, null, 10, null], bassVol: 0.75,
        drums: { k: 'x...x...x...x..x', s: '....x.......x...', h: '..x...x...x...xx' },
        arp: [0, 7, 12, 15, 12, 7, 3, 7], arpOct: 2, arpVol: 0.16,
        lead: [[0, 62, 4], [4, 65, 2], [6, 64, 2], [8, 62, 4], [12, 60, 2], [14, 62, 2], [16, 58, 6], [22, 60, 2], [24, 62, 4], [28, 65, 4], [32, 64, 6], [38, 62, 2], [40, 60, 4], [44, 57, 4], [48, 57, 6], [54, 60, 2], [56, 62, 8]], leadInst: 'saw',
    },
    orchard: {
        bpm: 108, chords: [[52, 'm'], [53, 'M'], [52, 'm'], [50, 'm']], pad: 'organ', padVol: 0.26,
        bass: [0, null, null, null, 0, null, null, 1, null, null, 0, null, null, null, -2, null], bassVol: 0.6,
        drums: { k: 'x.......x.....x.', s: '........x.......', h: 'x...x...x...x...' },
        bells: [0, 6, 10], bellOct: 3,
        lead: [[0, 76, 6], [6, 77, 2], [8, 76, 4], [12, 74, 4], [16, 77, 8], [24, 76, 8], [32, 71, 6], [38, 72, 2], [40, 71, 4], [44, 69, 4], [48, 68, 12], [60, 69, 4]], leadInst: 'pluck',
    },
    foundry: {
        bpm: 140, chords: [[48, 'm'], [48, 'm'], [44, 'M'], [46, 'M']], pad: 'saw', padVol: 0.16,
        bass: [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 12, 0, 7, 0, 10, 0], bassVol: 0.6,
        drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: '..x.....x.x.....' },
        arp: [0, 12, 3, 12, 7, 12, 3, 12], arpOct: 1, arpVol: 0.12,
        lead: [[0, 72, 3], [3, 70, 3], [6, 67, 2], [8, 72, 4], [12, 75, 4], [16, 74, 6], [22, 72, 2], [24, 70, 8], [32, 68, 4], [36, 67, 4], [40, 65, 8], [48, 67, 6], [54, 70, 2], [56, 72, 8]], leadInst: 'square',
    },
    styx: {
        bpm: 94, chords: [[54, 'm'], [50, 'M'], [45, 'M'], [52, 'M']], pad: 'choir', padVol: 0.36,
        bass: [0, null, null, null, null, null, 7, null, 0, null, null, null, null, null, null, null], bassVol: 0.6,
        drums: { k: 'x.........x.....', s: '........x.......', h: '....x.......x...' },
        arp: [0, 7, 12, 16, 19, 16, 12, 7], arpOct: 2, arpVol: 0.13, arpInst: 'harp',
        lead: [[0, 73, 8], [8, 76, 4], [12, 74, 4], [16, 73, 8], [24, 69, 8], [32, 71, 8], [40, 73, 4], [44, 71, 4], [48, 69, 16]], leadInst: 'bell',
    },
    flesh: {
        bpm: 118, chords: [[46, 'm'], [46, 'm'], [42, 'M'], [44, 'M']], pad: 'choir', padVol: 0.22,
        bass: [0, null, 0, null, null, null, 0, 0, null, null, 0, null, 3, null, 1, null], bassVol: 0.8, bassWah: true,
        drums: { k: 'x..x......x..x..', s: '....x.......x...', h: '..x...x...x...x.' },
        arp: [0, 3, 7, 10, 7, 3], arpOct: 2, arpVol: 0.1,
        lead: [[0, 70, 4], [4, 73, 4], [8, 72, 2], [10, 70, 2], [12, 68, 4], [16, 66, 8], [24, 65, 8], [32, 70, 4], [36, 73, 4], [40, 77, 4], [44, 75, 4], [48, 73, 12], [60, 72, 4]], leadInst: 'saw',
    },
    cocytus: {
        bpm: 104, chords: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'm']], pad: 'glass', padVol: 0.3,
        bass: [0, null, null, null, 0, null, null, null, 0, null, null, null, 7, null, null, null], bassVol: 0.55,
        drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
        bells: [0, 3, 6, 10, 13], bellOct: 3,
        lead: [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 71, 4], [16, 69, 8], [24, 72, 8], [32, 74, 6], [38, 72, 2], [40, 71, 4], [44, 67, 4], [48, 69, 16]], leadInst: 'bell',
    },
    dawn: {
        bpm: 144, chords: [[50, 'M'], [47, 'm'], [43, 'M'], [45, 'M']], pad: 'choir', padVol: 0.3,
        bass: [0, null, 0, 12, 0, null, 0, 12, 0, null, 0, 12, 7, null, 9, 11], bassVol: 0.7,
        drums: { k: 'x...x...x...x...', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' },
        arp: [0, 4, 7, 12, 16, 12, 7, 4], arpOct: 2, arpVol: 0.15,
        lead: [[0, 74, 4], [4, 78, 4], [8, 81, 6], [14, 79, 2], [16, 78, 4], [20, 74, 4], [24, 76, 8], [32, 79, 4], [36, 78, 4], [40, 76, 4], [44, 74, 4], [48, 73, 6], [54, 74, 2], [56, 76, 8]], leadInst: 'saw',
    },
    boss: {
        bpm: 156, chords: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M']], pad: 'saw', padVol: 0.18,
        bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 10, 0, 7, 0], bassVol: 0.7,
        drums: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: 'x...............' },
        arp: [0, 12, 7, 12, 3, 12, 7, 12], arpOct: 1, arpVol: 0.14,
        lead: [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 74, 2], [8, 72, 4], [12, 71, 4], [16, 76, 6], [22, 79, 2], [24, 83, 8], [32, 72, 4], [36, 74, 4], [40, 76, 8], [48, 74, 4], [52, 72, 4], [56, 71, 8]], leadInst: 'square',
    },
    malphas: {
        bpm: 160, chords: [[48, 'm'], [44, 'M'], [46, 'M'], [43, 'M']], pad: 'organ', padVol: 0.32,
        bass: [0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 10, 0, 7, 0], bassVol: 0.75,
        drums: { k: 'x.x.x.x.x.x.x.xx', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: 'x.......x.......' },
        arp: [0, 7, 12, 15, 19, 15, 12, 7], arpOct: 2, arpVol: 0.12,
        lead: [[0, 72, 4], [4, 75, 4], [8, 79, 4], [12, 78, 4], [16, 79, 8], [24, 75, 8], [32, 77, 4], [36, 75, 4], [40, 74, 4], [44, 70, 4], [48, 71, 16]], leadInst: 'saw',
    },
    ending: {
        bpm: 72, chords: [[48, 'M'], [43, 'M'], [45, 'm'], [41, 'M']], pad: 'choir', padVol: 0.5,
        bass: [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null], bassVol: 0.5,
        bells: [0, 4, 8, 12], bellOct: 3,
        lead: [[0, 76, 8], [8, 79, 8], [16, 74, 8], [24, 72, 8], [32, 72, 8], [40, 76, 8], [48, 77, 6], [54, 76, 2], [56, 72, 8]], leadInst: 'bell',
    },
};
export const STAGE_TRACKS = ['cradle', 'orchard', 'foundry', 'styx', 'flesh', 'cocytus', 'dawn'];

class Audio {
    constructor() {
        this.ctx = null;
        this.sound = true; this.music = true; this.volume = 0.8;
        this.track = null; this.want = null;
        this.last = {};
        this.charge = null;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain();
        this.master.gain.value = this.volume * 0.7;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        this.master.connect(comp); comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sound ? 0.9 : 0; this.sfx.connect(this.master);
        this.mus = ctx.createGain(); this.mus.gain.value = this.music ? 0.42 : 0; this.mus.connect(this.master);
        // reverb
        this.rev = ctx.createConvolver();
        const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.rev.buffer = ir;
        this.revOut = ctx.createGain(); this.revOut.gain.value = 0.32;
        this.rev.connect(this.revOut); this.revOut.connect(this.master);
        this.revSend = ctx.createGain(); this.revSend.gain.value = 1; this.revSend.connect(this.rev);
        // noise buffer
        const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.timer = setInterval(() => this.schedule(), 25);
        if (this.want) this.play(this.want, true);
    }

    setSound(on) { this.sound = on; if (this.sfx) this.sfx.gain.value = on ? 0.9 : 0; }
    setMusic(on) { this.music = on; if (this.mus) this.mus.gain.value = on ? 0.42 : 0; }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v * 0.7; }
    suspend(on) { if (!this.ctx) return; if (on) this.ctx.suspend(); else this.ctx.resume(); }

    // ---------------------------------------------------------------- building blocks
    env(g, t, a, peak, d, sus = 0, rel = 0.05, len = 0) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        if (len > 0) {
            g.gain.setTargetAtTime(Math.max(0.0001, sus), t + a, d / 3);
            g.gain.setValueAtTime(Math.max(0.0001, sus || peak * 0.5), t + a + len);
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + len + rel);
        } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    osc(type, f, t, dur, vol, dest, o = {}) {
        const ctx = this.ctx;
        const s = ctx.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t);
        if (o.to) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide ?? dur));
        if (o.detune) s.detune.value = o.detune;
        const g = ctx.createGain();
        this.env(g, t, o.a ?? 0.005, vol, dur);
        let node = s;
        if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f2.Q.value = o.q ?? 1; node.connect(f2); node = f2; }
        node.connect(g); g.connect(dest);
        if (o.rev) { const r = ctx.createGain(); r.gain.value = o.rev; g.connect(r); r.connect(this.revSend); }
        s.start(t); s.stop(t + (o.a ?? 0.005) + dur + 0.05);
        return s;
    }

    noise(t, dur, vol, dest, o = {}) {
        const ctx = this.ctx;
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
        s.playbackRate.value = o.rate ?? 1;
        const f = ctx.createBiquadFilter(); f.type = o.type ?? 'lowpass';
        f.frequency.setValueAtTime(o.f ?? 3000, t);
        if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
        f.Q.value = o.q ?? 0.7;
        const g = ctx.createGain();
        this.env(g, t, o.a ?? 0.002, vol, dur);
        s.connect(f); f.connect(g); g.connect(dest);
        if (o.rev) { const r = ctx.createGain(); r.gain.value = o.rev; g.connect(r); r.connect(this.revSend); }
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
    }

    throttle(key, gap) {
        if (!this.ctx) return false;
        const now = this.ctx.currentTime;
        if ((this.last[key] ?? -1) + gap > now) return false;
        this.last[key] = now;
        return true;
    }

    // ---------------------------------------------------------------- instruments (music)
    inst(name, t, m, dur, vol) {
        const f = mtof(m), D = this.mus;
        switch (name) {
            case 'saw':
                this.osc('sawtooth', f, t, dur, vol * 0.5, D, { lp: 2400, lpTo: 900, a: 0.01, rev: 0.25 });
                this.osc('sawtooth', f, t, dur, vol * 0.35, D, { lp: 2000, detune: 9, a: 0.01 });
                break;
            case 'square': this.osc('square', f, t, dur, vol * 0.35, D, { lp: 3200, lpTo: 1200, a: 0.005, rev: 0.2 }); break;
            case 'pluck': this.osc('triangle', f, t, Math.min(dur, 0.6), vol, D, { a: 0.002, rev: 0.35 }); this.osc('sine', f * 2, t, 0.25, vol * 0.3, D, { a: 0.002 }); break;
            case 'harp': this.osc('triangle', f, t, 0.9, vol, D, { a: 0.002, rev: 0.5 }); break;
            case 'bell':
                for (const [k, v, d] of [[1, 1, 1.6], [2.76, 0.45, 0.8], [5.4, 0.25, 0.4], [8.9, 0.12, 0.25]]) this.osc('sine', f * k, t, d * Math.max(0.6, dur), vol * v * 0.6, D, { a: 0.003, rev: 0.55 });
                break;
            default: this.osc('triangle', f, t, dur, vol, D, { rev: 0.2 });
        }
    }

    pad(kind, t, notes, dur, vol) {
        const ctx = this.ctx, D = this.mus;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.linearRampToValueAtTime(vol, t + Math.min(0.5, dur * 0.3));
        out.gain.setValueAtTime(vol, t + dur * 0.85);
        out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
        let dest = out;
        if (kind === 'choir') {
            // a crude formant filter: "aah"
            const mix = ctx.createGain(); mix.gain.value = 1;
            for (const [fq, q, g] of [[750, 6, 1], [1150, 7, 0.6], [2600, 8, 0.25]]) {
                const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
                const gg = ctx.createGain(); gg.gain.value = g * 2.2;
                mix.connect(bp); bp.connect(gg); gg.connect(out);
            }
            dest = mix;
        }
        out.connect(D);
        const r = ctx.createGain(); r.gain.value = 0.7; out.connect(r); r.connect(this.revSend);
        for (const m of notes) {
            const f = mtof(m);
            if (kind === 'organ') {
                for (const [k, v] of [[1, 0.5], [2, 0.3], [3, 0.18], [4, 0.12], [6, 0.06]]) {
                    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f * k;
                    const g = ctx.createGain(); g.gain.value = v * 0.35;
                    s.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.3);
                }
            } else if (kind === 'glass') {
                for (const k of [1, 2.005]) { const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f * k; const g = ctx.createGain(); g.gain.value = 0.25; s.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.3); }
            } else {
                for (const dt of [-8, 7]) {
                    const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = dt;
                    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'choir' ? 3000 : 1400;
                    const g = ctx.createGain(); g.gain.value = 0.18;
                    s.connect(lp); lp.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.3);
                }
            }
        }
    }

    drum(k, t) {
        const D = this.mus;
        if (k === 'k') { this.osc('sine', 150, t, 0.28, 0.9, D, { to: 42, glide: 0.12, a: 0.001 }); this.noise(t, 0.02, 0.2, D, { f: 1200 }); }
        if (k === 's') { this.noise(t, 0.16, 0.35, D, { type: 'bandpass', f: 1800, q: 0.8, rev: 0.2 }); this.osc('triangle', 220, t, 0.08, 0.25, D, { to: 160 }); }
        if (k === 'h') this.noise(t, 0.035, 0.12, D, { type: 'highpass', f: 7000 });
        if (k === 'c') this.noise(t, 0.12, 0.25, D, { type: 'bandpass', f: 3200, q: 10, rev: 0.3 });
    }

    // ---------------------------------------------------------------- the sequencer
    play(name, force = false) {
        this.want = name;
        if (!this.ctx) return;
        if (this.track && this.track.name === name && !force) return;
        const T = TRACKS[name];
        if (!T) { this.track = null; return; }
        this.track = { name, T, step: 0, next: this.ctx.currentTime + 0.08 };
    }

    stop() { this.track = null; this.want = null; }

    schedule() {
        if (!this.ctx || !this.track) return;
        const tr = this.track, T = tr.T;
        const sd = 60 / T.bpm / 4;
        const loop = T.chords.length * 16;
        while (tr.next < this.ctx.currentTime + 0.14) {
            const t = tr.next, st = tr.step % loop, bar = Math.floor(st / 16), s = st % 16;
            const [root, q] = T.chords[bar];
            const chord = CH[q];
            if (s === 0) this.pad(T.pad, t, chord.slice(0, 3).map((x) => root + 12 + x).concat([root + 24]), sd * 16, T.padVol ?? 0.3);
            const b = T.bass?.[s];
            if (b !== null && b !== undefined) {
                const f = mtof(root - 12 + b);
                this.osc('sawtooth', f, t, sd * 1.6, (T.bassVol ?? 0.6) * 0.55, this.mus, { lp: T.bassWah ? 300 + 1500 * (0.5 + 0.5 * Math.sin(st * 0.4)) : 900, lpTo: 180, q: T.bassWah ? 6 : 2, a: 0.004 });
                this.osc('sine', f / 2, t, sd * 1.4, (T.bassVol ?? 0.6) * 0.45, this.mus, { a: 0.004 });
            }
            if (T.drums) for (const k of ['k', 's', 'h', 'c']) if (T.drums[k] && T.drums[k][s] === 'x') this.drum(k, t);
            if (T.arp && s % 2 === 0) {
                const a = T.arp[(st / 2) % T.arp.length];
                const m = root + 12 * (T.arpOct ?? 2) + a + (chord[1] === 4 && a % 12 === 3 ? 1 : 0);
                this.inst(T.arpInst ?? 'pluck', t, m, sd * 2, T.arpVol ?? 0.14);
            }
            if (T.bells && T.bells.includes(s)) this.inst('bell', t, root + 12 * (T.bellOct ?? 3) + chord[(s / 2 | 0) % 3], 1, 0.12);
            for (const [ls, m, len] of T.lead || []) if (ls === st) this.inst(T.leadInst ?? 'saw', t, m, len * sd, 0.2);
            tr.step++;
            tr.next += sd;
        }
    }

    // ---------------------------------------------------------------- sound effects
    sfxOn() { return this.ctx && this.sound; }

    pshot() {
        if (!this.sfxOn() || !this.throttle('pshot', 0.07)) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.04, 0.07, this.sfx, { type: 'highpass', f: 3000 });
        this.osc('triangle', 1700, t, 0.05, 0.05, this.sfx, { to: 900 });
    }
    hit(boss) {
        if (!this.sfxOn() || !this.throttle('hit', 0.05)) return;
        this.osc('square', boss ? 420 : 640, this.ctx.currentTime, 0.04, 0.05, this.sfx, { to: 300, lp: 3000 });
    }
    armor() {
        if (!this.sfxOn() || !this.throttle('armor', 0.08)) return;
        const t = this.ctx.currentTime;
        this.osc('sine', 2200, t, 0.08, 0.05, this.sfx); this.osc('sine', 3300, t, 0.06, 0.03, this.sfx);
    }
    explode(size = 1) {
        if (!this.sfxOn() || !this.throttle('ex' + (size > 1.5 ? 'b' : 's'), size > 1.5 ? 0.1 : 0.04)) return;
        const t = this.ctx.currentTime, d = 0.25 + size * 0.25;
        this.noise(t, d, Math.min(0.6, 0.2 + size * 0.14), this.sfx, { f: 2200, fTo: 120, rev: 0.25 });
        this.osc('sine', 130, t, d, Math.min(0.7, 0.25 + size * 0.15), this.sfx, { to: 35, glide: d });
    }
    bigBoom() {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        this.noise(t, 2.4, 0.8, this.sfx, { f: 3000, fTo: 60, rev: 0.6 });
        this.osc('sine', 90, t, 2.2, 0.9, this.sfx, { to: 25, glide: 2 });
    }
    chargeStart() {
        if (!this.sfxOn()) return;
        this.chargeStop();
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(620, t + 1.15);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(280, t); o2.frequency.exponentialRampToValueAtTime(1240, t + 1.15);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 1.15); f.Q.value = 6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.2);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx);
        o.start(t); o2.start(t);
        this.charge = { o, o2, g };
    }
    chargeStop() {
        if (!this.charge || !this.ctx) return;
        const t = this.ctx.currentTime, c = this.charge;
        c.g.gain.cancelScheduledValues(t); c.g.gain.setTargetAtTime(0.0001, t, 0.03);
        c.o.stop(t + 0.2); c.o2.stop(t + 0.2);
        this.charge = null;
    }
    beam(k) {
        this.chargeStop();
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.5 + k * 0.4, 0.35 + k * 0.3, this.sfx, { type: 'bandpass', f: 600, fTo: 3000, q: 1.2, rev: 0.4 });
        this.osc('sawtooth', 220, t, 0.4 + k * 0.4, 0.2 + k * 0.15, this.sfx, { to: 70, lp: 2400, lpTo: 300, rev: 0.3 });
        for (const m of [74, 78, 81]) this.osc('sine', mtof(m), t, 0.6, 0.06 * k, this.sfx, { rev: 0.6 });
    }
    chime(notes, vol = 0.12, gap = 0.06) {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        notes.forEach((m, i) => { for (const [k, v] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) this.osc('sine', mtof(m) * k, t + i * gap, 0.6, vol * v, this.sfx, { rev: 0.5 }); });
    }
    pickup(kind) {
        if (kind === 'shard') { if (this.throttle('shard', 0.05)) this.chime([96], 0.06, 0); return; }
        if (['red', 'blue', 'gold'].includes(kind)) this.chime([74, 78, 81, 86, 90], 0.12, 0.05);
        else if (kind === 'life') this.chime([72, 76, 79, 84, 88, 91], 0.14, 0.07);
        else this.chime([79, 84, 88], 0.11, 0.05);
    }
    halo(kind) {
        if (kind === 'cast') this.chime([86, 81], 0.09, 0.04);
        else if (kind === 'call') this.chime([81, 86], 0.08, 0.04);
        else this.chime([93], 0.07, 0);
    }
    hurt() {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        this.osc('square', 420, t, 0.25, 0.15, this.sfx, { to: 90, lp: 2000 });
        this.noise(t, 0.2, 0.2, this.sfx, { f: 1500 });
    }
    death() {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        this.explode(2);
        for (const [i, m] of [74, 70, 67, 62].entries()) this.osc('triangle', mtof(m), t + i * 0.14, 0.5, 0.12, this.sfx, { rev: 0.6 });
    }
    extend() { this.chime([76, 79, 84, 88, 91, 96], 0.14, 0.08); }
    alarm() {
        if (!this.sfxOn() || !this.throttle('alarm', 0.4)) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 2; i++) this.osc('sawtooth', i ? 440 : 520, t + i * 0.16, 0.14, 0.08, this.sfx, { lp: 1800 });
    }
    bossWarning() {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 3; i++) {
            this.osc('sawtooth', 110, t + i * 0.9, 0.7, 0.22, this.sfx, { lp: 700, a: 0.15, rev: 0.5 });
            this.osc('sawtooth', 116.5, t + i * 0.9, 0.7, 0.16, this.sfx, { lp: 700, a: 0.15 });
        }
    }
    laserWarn() {
        if (!this.sfxOn() || !this.throttle('lw', 0.2)) return;
        this.osc('sine', 600, this.ctx.currentTime, 0.5, 0.05, this.sfx, { to: 1600 });
    }
    rumble(v = 0.3) {
        if (!this.sfxOn() || !this.throttle('rum', 0.2)) return;
        this.noise(this.ctx.currentTime, 0.6, v, this.sfx, { f: 300, fTo: 80 });
    }
    clang() {
        if (!this.sfxOn() || !this.throttle('clang', 0.15)) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.3, 0.3, this.sfx, { type: 'bandpass', f: 900, q: 12, rev: 0.4 });
        this.osc('sine', 60, t, 0.3, 0.4, this.sfx, { to: 35 });
    }
    heartbeat() {
        if (!this.sfxOn()) return;
        const t = this.ctx.currentTime;
        this.osc('sine', 70, t, 0.18, 0.5, this.sfx, { to: 40 });
        this.osc('sine', 60, t + 0.16, 0.16, 0.35, this.sfx, { to: 38 });
    }
    efire() {
        if (!this.sfxOn() || !this.throttle('ef', 0.09)) return;
        this.osc('square', 330, this.ctx.currentTime, 0.05, 0.03, this.sfx, { to: 200, lp: 1800 });
    }
    absorb() { if (this.sfxOn() && this.throttle('abs', 0.06)) this.osc('sine', 1200, this.ctx.currentTime, 0.08, 0.04, this.sfx, { to: 2400 }); }
    blip() { if (this.sfxOn() && this.throttle('blip', 0.05)) this.osc('triangle', 880, this.ctx.currentTime, 0.06, 0.06, this.sfx); }
    ui(kind) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        if (kind === 'move') this.osc('triangle', 660, t, 0.05, 0.06, this.sfx);
        else if (kind === 'select') this.chime([79, 86], 0.1, 0.05);
        else if (kind === 'back') this.osc('triangle', 440, t, 0.07, 0.06, this.sfx, { to: 330 });
        else if (kind === 'start') this.chime([74, 81, 86, 90, 93], 0.12, 0.07);
    }
    fanfare() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [[74, 0], [78, 0.15], [81, 0.3], [86, 0.45]].forEach(([m, d]) => { this.osc('sawtooth', mtof(m), t + d, 0.5, 0.09, this.sfx, { lp: 3000, rev: 0.4 }); this.osc('sine', mtof(m + 12), t + d, 0.6, 0.06, this.sfx, { rev: 0.5 }); });
        this.pad('choir', t + 0.45, [62, 66, 69, 74], 2.2, 0.35);
    }
    dawn() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.pad('choir', t, [60, 64, 67, 72, 76], 4, 0.5);
        this.chime([84, 88, 91, 96], 0.15, 0.12);
    }
    gameOver() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [[62, 0], [61, 0.4], [60, 0.8], [55, 1.2]].forEach(([m, d]) => this.osc('triangle', mtof(m), t + d, 0.7, 0.12, this.sfx, { rev: 0.6 }));
    }
}

export const audio = new Audio();
