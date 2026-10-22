// Everything you hear is synthesised here with Web Audio: no audio files. A look-ahead sequencer plays generated tracks (pad, bass,
// drums, arpeggio and a melody composed from a seed and fitted to the chords), and every sound effect is a short synth patch
// answering a sim or view event. ../lib/page-audio.js suspends the context in a hidden tab.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], pent: [0, 2, 4, 7, 9], lydian: [0, 2, 4, 6, 7, 9, 11] };
const CH = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] };

// prog: one chord per bar as [semitones above the key, quality]
const TRACKS = {
    title: { bpm: 78, key: 50, scale: 'major', prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [5, 'M'], [2, 'm'], [7, 'M']], pad: 'choir', padVol: 0.5, bass: 'x.......x.......', bassVol: 0.5, arp: [0, 2, 1, 2], arpInst: 'bell', arpVol: 0.1, melody: { inst: 'bell', vol: 0.3, seed: 11, dense: 0.34, oct: 1 } },
    over: { bpm: 108, key: 55, scale: 'major', prog: [[0, 'M'], [7, 'M'], [5, 'M'], [0, 'M'], [9, 'm'], [5, 'M'], [7, 'M'], [0, 'M']], pad: 'strings', padVol: 0.2, bass: 'x..x..x.x..x..x.', bassVol: 0.5, drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' }, arp: [0, 1, 2, 1, 2, 1], arpInst: 'pluck', arpVol: 0.12, melody: { inst: 'lead', vol: 0.2, seed: 23, dense: 0.5, oct: 1 } },
    town: { bpm: 98, key: 48, scale: 'major', prog: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M'], [9, 'm'], [5, 'M'], [2, 'm'], [7, 'M']], pad: 'none', padVol: 0, bass: 'x...x...x.x.x...', bassVol: 0.45, drums: { h: 'x...x...x...x..x' }, arp: [0, 2, 1, 2, 0, 2], arpInst: 'pluck', arpVol: 0.16, melody: { inst: 'pluck', vol: 0.3, seed: 5, dense: 0.55, oct: 1 } },
    dungeon: { bpm: 72, key: 57, scale: 'dorian', prog: [[0, 'm'], [0, 'm'], [10, 'M'], [8, 'M'], [0, 'm'], [3, 'M'], [10, 'M'], [7, 'sus']], pad: 'strings', padVol: 0.3, bass: 'x.......x.......', bassVol: 0.6, arp: [0, 2, 1], arpInst: 'bell', arpVol: 0.07, drip: true, melody: { inst: 'bell', vol: 0.12, seed: 7, dense: 0.12, oct: 1 } },
    battle: { bpm: 156, key: 52, scale: 'minor', prog: [[0, 'm'], [8, 'M'], [5, 'M'], [7, 'M'], [0, 'm'], [8, 'M'], [3, 'M'], [7, 'M']], pad: 'saw', padVol: 0.12, bass: 'xxxxxxxxxxxxxxxx', bassVol: 0.45, bassPulse: true, drums: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' }, arp: [0, 1, 2, 3, 2, 1], arpInst: 'pluck', arpVol: 0.1, melody: { inst: 'saw', vol: 0.17, seed: 31, dense: 0.62, oct: 1 } },
    boss: { bpm: 168, key: 49, scale: 'minor', prog: [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'M'], [0, 'm'], [3, 'M'], [8, 'M'], [6, 'dim']], pad: 'choir', padVol: 0.3, bass: 'xxx.xxx.xxx.xxxx', bassVol: 0.6, bassPulse: true, drums: { k: 'x.x.x.x.x.x.x.xx', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', c: 'x...............' }, arp: [0, 2, 1, 3], arpInst: 'saw', arpVol: 0.09, melody: { inst: 'saw', vol: 0.2, seed: 47, dense: 0.66, oct: 1 } },
    sad: { bpm: 58, key: 50, scale: 'minor', prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [0, 'm']], pad: 'strings', padVol: 0.45, bass: 'x...............', bassVol: 0.4, arp: [0, 1, 2, 1], arpInst: 'bell', arpVol: 0.08, melody: { inst: 'bell', vol: 0.28, seed: 3, dense: 0.2, oct: 1 } },
    ending: { bpm: 70, key: 53, scale: 'major', prog: [[0, 'M'], [7, 'M'], [9, 'm'], [4, 'm'], [5, 'M'], [0, 'M'], [5, 'M'], [7, 'M']], pad: 'choir', padVol: 0.5, bass: 'x.......x.......', bassVol: 0.45, arp: [0, 1, 2, 1, 2, 1], arpInst: 'bell', arpVol: 0.12, melody: { inst: 'bell', vol: 0.34, seed: 19, dense: 0.4, oct: 1 } },
};

class Audio {
    constructor() { this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.6; this.cur = null; this.curName = null; this.timer = null; this.last = {}; this.want = null; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(comp); comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
        this.rev = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.rev.buffer = ir; this.revOut = ctx.createGain(); this.revOut.gain.value = 0.3; this.rev.connect(this.revOut); this.revOut.connect(this.master);
        this.revSend = ctx.createGain(); this.revSend.gain.value = 1; this.revSend.connect(this.rev);
        const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        if (this.want) this.playMusic(this.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, bus, att = 0.008, rev = 0, filt }) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay, ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let n = o;
        if (filt) { const f = ctx.createBiquadFilter(); f.type = filt.type || 'lowpass'; f.frequency.value = filt.f; f.Q.value = filt.q || 1; o.connect(f); n = f; }
        n.connect(g); g.connect(bus || this.sfx);
        if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.revSend); }
        o.start(t); o.stop(t + dur + 0.03);
    }
    noise({ dur = 0.2, vol = 0.15, delay = 0, type = 'bandpass', f = 1200, to, q = 1, bus, att = 0.005, rev = 0 }) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t); if (to) flt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur); flt.Q.value = q;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(flt); flt.connect(g); g.connect(bus || this.sfx);
        if (rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.revSend); }
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
    }
    pad(freqs, t, dur, vol, kind, bus) {
        const ctx = this.ctx;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.5, dur * 0.35)); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'strings' ? 1500 : kind === 'choir' ? 1100 : 1800; f.Q.value = 0.6;
        f.connect(g); g.connect(bus);
        const s = ctx.createGain(); s.gain.value = 0.45; g.connect(s); s.connect(this.revSend);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5 + Math.random(); lg.gain.value = kind === 'choir' ? 6 : 3;
        lfo.connect(lg);
        for (const fr of freqs) for (const dt of [-7, 7]) {
            const o = ctx.createOscillator(); o.type = kind === 'choir' ? 'sawtooth' : kind === 'strings' ? 'sawtooth' : 'sawtooth';
            o.frequency.value = fr; o.detune.value = dt; lg.connect(o.detune);
            const og = ctx.createGain(); og.gain.value = 0.2 / freqs.length; o.connect(og);
            if (kind === 'choir') { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 700 + (fr % 3) * 200; b.Q.value = 2.5; og.connect(b); b.connect(f); } else og.connect(f);
            o.start(t); o.stop(t + dur + 0.05);
        }
        lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    note(inst, midi, t, dur, vol, bus) {
        const ctx = this.ctx, f = mtof(midi);
        const env = (g, a, d, v) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
        const mk = (type, freq, v, filt) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; env(g, 0.006, dur + 0.05, v); let n = o; if (filt) { const q = ctx.createBiquadFilter(); q.type = 'lowpass'; q.frequency.setValueAtTime(filt, t); q.frequency.exponentialRampToValueAtTime(Math.max(200, filt * 0.25), t + dur); o.connect(q); n = q; } n.connect(g); g.connect(bus); const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(this.revSend); o.start(t); o.stop(t + dur + 0.1); return o; };
        if (inst === 'pluck') { mk('triangle', f, vol, 3000); mk('square', f, vol * 0.25, 2200); }
        else if (inst === 'bell') { mk('sine', f, vol); mk('sine', f * 2.76, vol * 0.25); mk('sine', f * 5.4, vol * 0.08); }
        else if (inst === 'lead') { const o = mk('square', f, vol * 0.5, 2600); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); mk('triangle', f, vol * 0.5); }
        else if (inst === 'saw') { mk('sawtooth', f, vol * 0.45, 2400); mk('sawtooth', f * 1.006, vol * 0.3, 2400); }
        else if (inst === 'bass') { mk('triangle', f, vol); mk('sawtooth', f, vol * 0.3, 700); }
        else mk('triangle', f, vol);
    }
    drum(kind, t, vol = 1) {
        const ctx = this.ctx, bus = this.cur.bus;
        if (kind === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.7 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.22); }
        else if (kind === 's') { this.noiseAt(t, 0.16, 0.32 * vol, 'bandpass', 1800, 0.8, bus); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); g.gain.setValueAtTime(0.25 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.12); }
        else if (kind === 'h') this.noiseAt(t, 0.045, 0.1 * vol, 'highpass', 7000, 0.7, bus);
        else if (kind === 'c') this.noiseAt(t, 0.7, 0.18 * vol, 'highpass', 5000, 0.7, bus);
    }
    noiseAt(t, dur, vol, type, f, q, bus) {
        const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
        const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(flt); flt.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    }

    // ------------------------------------------------------------------ the sequencer
    compose(T) {
        // an 8-bar melody: two rhythms, pitches fitted to each bar's chord, A A' B A, ending on the key's root
        let s = T.melody.seed * 9301 + 49297;
        const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        const sc = SCALES[T.scale], bars = T.prog.length;
        const rhythm = () => { const r = []; for (let p = 0; p < 16; p++) { const w = p % 4 === 0 ? 1.1 : p % 2 === 0 ? 0.55 : 0.18; if (rnd() < T.melody.dense * w * (p === 0 ? 2 : 1)) r.push(p); } if (!r.length) r.push(0); return r; };
        const R1 = rhythm(), R2 = rhythm();
        const out = [];
        let prev = T.key + 12 + sc[2];
        for (let b = 0; b < bars; b++) {
            const chord = T.prog[b], tones = CH[chord[1]].map((x) => (T.key + chord[0] + x));
            const rh = b % 4 === 3 ? R2 : R1, ev = [];
            rh.forEach((p, i) => {
                const strong = p % 4 === 0;
                const pool = [];
                for (let o = 0; o < 3; o++) for (const x of (strong ? CH[chord[1]].map((c) => (c + chord[0]) % 12) : sc)) pool.push(T.key + 12 + 12 * (T.melody.oct - 1) + o * 12 - 12 + x + (strong ? 0 : 0));
                const target = prev + (rnd() - 0.5) * 7 + (b < 4 ? 0 : -1);
                let best = pool[0], bd = 1e9;
                for (const m of pool) { if (m < T.key + 5 || m > T.key + 34) continue; const d = Math.abs(m - target) + (m === prev ? 2.5 : 0); if (d < bd) { bd = d; best = m; } }
                if (b === bars - 1 && i === rh.length - 1) best = T.key + 12 + 12 * (T.melody.oct - 1);
                prev = best;
                const next = rh[i + 1] ?? 16;
                ev.push({ p, m: best, len: Math.max(1, Math.min(8, next - p)) });
            });
            out.push(ev);
        }
        return out;
    }

    playMusic(name) {
        this.want = name;
        if (!this.ctx || name === this.curName) return;
        const ctx = this.ctx;
        if (this.cur) { const old = this.cur; old.bus.gain.cancelScheduledValues(ctx.currentTime); old.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { try { old.bus.disconnect(); } catch { /* gone */ } }, 1600); old.dead = true; }
        this.cur = null; this.curName = name;
        if (name === 'silence' || !TRACKS[name]) { clearInterval(this.timer); this.timer = null; return; }
        const T = TRACKS[name];
        const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.gain.setTargetAtTime(1, ctx.currentTime, 0.5); bus.connect(this.music);
        this.cur = { T, bus, mel: this.compose(T), step: 0, next: ctx.currentTime + 0.1, name };
        if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    }
    stopMusic() { this.playMusic('silence'); }

    tick() {
        const c = this.cur, ctx = this.ctx;
        if (!c || !ctx || ctx.state !== 'running') { if (c && ctx) c.next = Math.max(c.next, ctx.currentTime); return; }
        const T = c.T, sd = 60 / T.bpm / 4;
        while (c.next < ctx.currentTime + 0.18) {
            const t = c.next, step = c.step, bars = T.prog.length;
            const bar = Math.floor(step / 16) % bars, pos = step % 16, chord = T.prog[bar];
            const root = T.key + chord[0], tones = CH[chord[1]];
            if (pos === 0 && T.pad !== 'none') this.pad(tones.map((x) => mtof(root + 12 + x)), t, sd * 16 * 1.02, T.padVol, T.pad, c.bus);
            if (T.bass && T.bass[pos] === 'x') this.note('bass', root - 12 + (T.bassPulse && pos % 8 === 6 ? 7 : 0), t, sd * (T.bassPulse ? 1.6 : 3), T.bassVol, c.bus);
            if (T.drums) for (const k of ['k', 's', 'h', 'c']) if (T.drums[k] && T.drums[k][pos] === 'x') this.drum(k, t, pos % 4 === 0 ? 1 : 0.8);
            if (T.arp && pos % 2 === 0) { const a = T.arp[(pos / 2) % T.arp.length]; const m = root + 12 + 12 + tones[a % tones.length] + (a >= tones.length ? 12 : 0); this.note(T.arpInst || 'pluck', m, t, sd * 2.4, T.arpVol, c.bus); }
            for (const e of c.mel[bar]) if (e.p === pos) this.note(T.melody.inst, e.m + (T.scale === 'minor' ? 0 : 0), t, sd * e.len * 0.95, T.melody.vol, c.bus);
            if (T.drip && Math.random() < 0.025) this.note('bell', root + 24 + [0, 2, 7, 9][Math.floor(Math.random() * 4)], t, 0.8, 0.07, c.bus);
            c.next += sd; c.step++;
        }
    }

    // ------------------------------------------------------------------ jingles
    jingle(name) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const seq = {
            victory: [[0, 72, 0.18], [0.16, 72, 0.18], [0.32, 72, 0.18], [0.5, 72, 0.3], [0.8, 68, 0.3], [1.1, 70, 0.3], [1.4, 72, 0.22], [1.62, 70, 0.16], [1.8, 72, 0.9]],
            levelup: [[0, 72, 0.12], [0.1, 76, 0.12], [0.2, 79, 0.12], [0.3, 84, 0.5]],
            recruit: [[0, 67, 0.2], [0.18, 72, 0.2], [0.36, 76, 0.2], [0.54, 79, 0.3], [0.9, 76, 0.2], [1.08, 84, 0.8]],
            defeat: [[0, 62, 0.4], [0.4, 59, 0.4], [0.8, 55, 0.4], [1.2, 50, 1.2]],
            get: [[0, 84, 0.1], [0.08, 88, 0.1], [0.16, 91, 0.3]],
            key: [[0, 72, 0.15], [0.14, 76, 0.15], [0.28, 79, 0.15], [0.42, 84, 0.15], [0.56, 88, 0.6]],
        }[name];
        if (!seq) return;
        for (const [d, m, l] of seq) { this.tone({ freq: mtof(m), dur: l + 0.1, type: 'square', vol: name === 'victory' ? 0.16 : 0.13, delay: d, rev: 0.25, filt: { f: 3200 } }); this.tone({ freq: mtof(m - 12), dur: l + 0.1, type: 'triangle', vol: 0.12, delay: d, rev: 0.2 }); }
        if (name === 'victory') for (const m of [60, 64, 67]) this.tone({ freq: mtof(m), dur: 1.2, type: 'sawtooth', vol: 0.05, delay: 1.8, att: 0.05, rev: 0.4, filt: { f: 1500 } });
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'move') this.tone({ freq: 520, dur: 0.03, type: 'triangle', vol: 0.06 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'error') this.tone({ freq: 160, dur: 0.12, type: 'square', vol: 0.1 });
        else if (kind === 'buy') { this.tone({ freq: 1200, dur: 0.06, type: 'square', vol: 0.1 }); this.tone({ freq: 1600, dur: 0.1, type: 'square', vol: 0.1, delay: 0.06 }); }
    }
    step() { if (this.last.step && performance.now() - this.last.step < 240) return; this.last.step = performance.now(); this.noise({ dur: 0.05, vol: 0.025, type: 'lowpass', f: 700 }); }
    voice(kind) { this.tone({ freq: 300 + Math.random() * 120, dur: 0.04, type: 'square', vol: 0.03, filt: { f: 1400 } }); }

    play(name, ev) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const T = (o) => this.tone(o), N = (o) => this.noise(o);
        switch (name) {
            case 'select': T({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.1 }); break;
            case 'slash': N({ dur: 0.16, vol: 0.2, type: 'bandpass', f: 5000, to: 1200, q: 0.8 }); T({ freq: 1400, to: 500, dur: 0.1, type: 'sawtooth', vol: 0.06 }); break;
            case 'claw': for (let i = 0; i < 3; i++) N({ dur: 0.1, vol: 0.15, type: 'bandpass', f: 4000, to: 1500, delay: i * 0.07 }); break;
            case 'thrust': N({ dur: 0.12, vol: 0.18, type: 'highpass', f: 3000, to: 1000 }); T({ freq: 900, to: 300, dur: 0.1, type: 'sawtooth', vol: 0.06 }); break;
            case 'spin': for (let i = 0; i < 3; i++) N({ dur: 0.12, vol: 0.14, type: 'bandpass', f: 4000, to: 1500, delay: i * 0.1 }); break;
            case 'impact': case 'quake': N({ dur: 0.35, vol: 0.4, type: 'lowpass', f: 600, to: 80 }); T({ freq: 120, to: 40, dur: 0.3, type: 'sine', vol: 0.35 }); break;
            case 'arrow': N({ dur: 0.18, vol: 0.12, type: 'bandpass', f: 2400, to: 4800 }); T({ freq: 700, to: 1800, dur: 0.14, type: 'triangle', vol: 0.06 }); break;
            case 'zap': T({ freq: 1200, to: 400, dur: 0.15, type: 'square', vol: 0.08 }); break;
            case 'fire': N({ dur: 0.7, vol: 0.28, type: 'bandpass', f: 800, to: 3000, q: 0.5, rev: 0.2 }); T({ freq: 200, to: 90, dur: 0.5, type: 'sawtooth', vol: 0.12, delay: 0.25 }); break;
            case 'meteor': N({ dur: 1.2, vol: 0.35, type: 'lowpass', f: 3000, to: 100 }); T({ freq: 80, to: 30, dur: 1, type: 'sine', vol: 0.4, delay: 0.3 }); break;
            case 'ice': for (let i = 0; i < 5; i++) T({ freq: 1800 + i * 330 + Math.random() * 200, dur: 0.35, type: 'sine', vol: 0.09, delay: i * 0.045, rev: 0.3 }); N({ dur: 0.3, vol: 0.12, type: 'highpass', f: 5000, delay: 0.15 }); break;
            case 'thunder': N({ dur: 0.25, vol: 0.4, type: 'highpass', f: 2000, to: 800 }); N({ dur: 0.9, vol: 0.3, type: 'lowpass', f: 400, to: 60, delay: 0.1 }); T({ freq: 2200, to: 200, dur: 0.18, type: 'sawtooth', vol: 0.1 }); break;
            case 'wind': N({ dur: 0.8, vol: 0.2, type: 'bandpass', f: 500, to: 2600, q: 1.4 }); break;
            case 'holy': case 'sun': case 'grace': for (const [i, m] of [60, 64, 67, 72, 76].entries()) T({ freq: mtof(m), dur: 1.0, type: 'sine', vol: 0.08, delay: i * 0.06, rev: 0.5, att: 0.05 }); break;
            case 'dark': case 'rift': case 'gravity': T({ freq: 90, to: 50, dur: 0.9, type: 'sawtooth', vol: 0.14, filt: { f: 400 } }); T({ freq: 93, to: 52, dur: 0.9, type: 'sawtooth', vol: 0.1, filt: { f: 400 } }); N({ dur: 0.6, vol: 0.12, type: 'lowpass', f: 900, to: 150 }); break;
            case 'star': for (let i = 0; i < 6; i++) T({ freq: 1200 + i * 220, to: 300, dur: 0.2, type: 'triangle', vol: 0.08, delay: i * 0.1 }); break;
            case 'prism': for (const [i, m] of [72, 76, 79, 84, 88, 91].entries()) T({ freq: mtof(m), dur: 0.35, type: 'sine', vol: 0.08, delay: i * 0.04, rev: 0.4 }); break;
            case 'heal': for (const [i, m] of [72, 76, 79, 84].entries()) T({ freq: mtof(m), dur: 0.5, type: 'sine', vol: 0.09, delay: i * 0.07, rev: 0.4 }); break;
            case 'buff': for (const [i, m] of [67, 72, 76].entries()) T({ freq: mtof(m), dur: 0.3, type: 'triangle', vol: 0.09, delay: i * 0.06, rev: 0.3 }); break;
            case 'debuff': case 'sleep': case 'poison': T({ freq: 400, to: 180, dur: 0.4, type: 'triangle', vol: 0.1, rev: 0.3 }); break;
            case 'scan': case 'analyze': T({ freq: 1500, to: 2400, dur: 0.15, type: 'sine', vol: 0.08 }); T({ freq: 2400, to: 1500, dur: 0.15, type: 'sine', vol: 0.08, delay: 0.15 }); break;
            case 'guard': T({ freq: 300, to: 500, dur: 0.15, type: 'square', vol: 0.07 }); break;
            case 'hit': N({ dur: 0.12, vol: 0.28, type: 'lowpass', f: 1400, to: 200 }); T({ freq: 160, to: 70, dur: 0.12, type: 'sine', vol: 0.3 }); break;
            case 'hurt': N({ dur: 0.14, vol: 0.26, type: 'lowpass', f: 1000, to: 150 }); T({ freq: 130, to: 60, dur: 0.14, type: 'sine', vol: 0.3 }); break;
            case 'weak': N({ dur: 0.12, vol: 0.28, type: 'lowpass', f: 1800, to: 200 }); T({ freq: 1800, dur: 0.25, type: 'sine', vol: 0.12, rev: 0.3 }); T({ freq: 2400, dur: 0.2, type: 'sine', vol: 0.08, delay: 0.03 }); T({ freq: 170, to: 70, dur: 0.14, type: 'sine', vol: 0.3 }); break;
            case 'crit': N({ dur: 0.2, vol: 0.4, type: 'lowpass', f: 2200, to: 150 }); T({ freq: 1500, to: 800, dur: 0.3, type: 'square', vol: 0.1, rev: 0.3 }); T({ freq: 140, to: 50, dur: 0.2, type: 'sine', vol: 0.4 }); break;
            case 'break': N({ dur: 0.7, vol: 0.4, type: 'highpass', f: 3000, to: 8000 }); N({ dur: 0.9, vol: 0.45, type: 'lowpass', f: 500, to: 50 }); for (let i = 0; i < 6; i++) T({ freq: 1400 + Math.random() * 2400, dur: 0.18, type: 'triangle', vol: 0.08, delay: 0.05 + i * 0.03 }); break;
            case 'ko': case 'die': N({ dur: 0.5, vol: 0.2, type: 'lowpass', f: 1800, to: 120 }); T({ freq: 400, to: 60, dur: 0.5, type: 'sawtooth', vol: 0.12, filt: { f: 900 } }); break;
            case 'bossdie': N({ dur: 1.4, vol: 0.4, type: 'lowpass', f: 3000, to: 60 }); T({ freq: 300, to: 30, dur: 1.4, type: 'sawtooth', vol: 0.22, filt: { f: 800 } }); T({ freq: 60, dur: 1.2, type: 'sine', vol: 0.4 }); break;
            case 'dash': N({ dur: 0.18, vol: 0.12, type: 'bandpass', f: 800, to: 3000 }); break;
            case 'boost': for (const [i, m] of [60, 67, 72, 79].entries()) T({ freq: mtof(m), dur: 0.2, type: 'sawtooth', vol: 0.08, delay: i * 0.05, filt: { f: 2400 } }); break;
            case 'charge': T({ freq: 120, to: 480, dur: 0.9, type: 'sawtooth', vol: 0.12, filt: { f: 900 } }); break;
            case 'roar': N({ dur: 1.1, vol: 0.4, type: 'lowpass', f: 900, to: 120 }); T({ freq: 110, to: 55, dur: 1.1, type: 'sawtooth', vol: 0.2, filt: { f: 600 } }); break;
            case 'recover': T({ freq: 500, to: 900, dur: 0.2, type: 'triangle', vol: 0.08 }); break;
            case 'revive': this.play('heal'); this.play('holy'); break;
            case 'steal': T({ freq: 900, dur: 0.06, type: 'square', vol: 0.08 }); T({ freq: 1400, dur: 0.1, type: 'square', vol: 0.08, delay: 0.07 }); break;
            case 'flee': N({ dur: 0.5, vol: 0.2, type: 'bandpass', f: 600, to: 2500 }); break;
            case 'victory': this.jingle('victory'); break;
            case 'defeat': this.jingle('defeat'); break;
            case 'levelup': this.jingle('levelup'); break;
            case 'recruit': this.jingle('recruit'); break;
            case 'get': this.jingle('get'); break;
            case 'key': this.jingle('key'); break;
            case 'chest': for (const [i, m] of [60, 64, 67, 72].entries()) T({ freq: mtof(m), dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.07, rev: 0.3 }); break;
            case 'door': N({ dur: 0.3, vol: 0.12, type: 'lowpass', f: 800, to: 200 }); break;
            case 'encounter': N({ dur: 0.9, vol: 0.28, type: 'bandpass', f: 4000, to: 200, q: 0.7 }); for (let i = 0; i < 7; i++) T({ freq: 1800 - i * 200, dur: 0.12, type: 'square', vol: 0.07, delay: i * 0.1 }); break;
            case 'alert': T({ freq: 880, dur: 0.08, type: 'square', vol: 0.1 }); T({ freq: 1320, dur: 0.12, type: 'square', vol: 0.1, delay: 0.08 }); break;
            case 'rest': for (const [i, m] of [60, 64, 67, 72, 76].entries()) T({ freq: mtof(m), dur: 0.8, type: 'sine', vol: 0.07, delay: i * 0.12, rev: 0.5, att: 0.05 }); break;
            case 'save': for (const [i, m] of [72, 79, 84].entries()) T({ freq: mtof(m), dur: 0.6, type: 'sine', vol: 0.08, delay: i * 0.1, rev: 0.5 }); break;
            case 'shake': N({ dur: 0.5, vol: 0.3, type: 'lowpass', f: 300, to: 60 }); break;
            case 'flash': T({ freq: 90, dur: 0.6, type: 'sine', vol: 0.25 }); break;
            case 'crack': N({ dur: 0.5, vol: 0.4, type: 'lowpass', f: 900, to: 90 }); break;
            case 'quest': for (const [i, m] of [67, 72].entries()) T({ freq: mtof(m), dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.1 }); break;
            case 'questdone': for (const [i, m] of [67, 72, 76, 79].entries()) T({ freq: mtof(m), dur: 0.25, type: 'triangle', vol: 0.1, delay: i * 0.09, rev: 0.3 }); break;
            default: if (name?.startsWith('charge_')) T({ freq: 200, to: 700, dur: 0.5, type: 'sine', vol: 0.06, rev: 0.4 });
        }
    }
}
export { Audio };
