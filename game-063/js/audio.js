// All sound is generated with Web Audio. Music is a look-ahead sequencer: each theme has a key, a
// mode, a chord progression and a seeded four-bar motif that repeats with variations (A A' B A), played
// on realm instruments (flute and pizzicato, oud and hand drum, celesta, brass and taiko, harp and
// choir). Boss themes are faster and minor. Effects are one-shot synth voices.

import { Rng, hashStr } from './rng.js';

const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], hijaz: [0, 1, 4, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const THEMES = {
    title: { bpm: 92, root: 60, mode: 'ionian', prog: [0, 4, 5, 3], lead: 'brass', alt: 'harp', bass: 'soft', drums: 'none', pad: 1 },
    map: { bpm: 112, root: 62, mode: 'ionian', prog: [0, 3, 4, 0], lead: 'flute', alt: 'pluck', bass: 'soft', drums: 'march', pad: 0.5 },
    club: { bpm: 104, root: 65, mode: 'ionian', prog: [0, 5, 1, 4], lead: 'flute', alt: 'harp', bass: 'soft', drums: 'none', pad: 0.6, waltz: true },
    meadow: { bpm: 106, root: 67, mode: 'ionian', prog: [0, 3, 0, 4], lead: 'flute', alt: 'pluck', bass: 'soft', drums: 'shaker', pad: 0.5 },
    sand: { bpm: 96, root: 62, mode: 'hijaz', prog: [0, 1, 0, 6], lead: 'oud', alt: 'oud', bass: 'soft', drums: 'hand', pad: 0.4 },
    frost: { bpm: 84, root: 64, mode: 'lydian', prog: [0, 1, 0, 6], lead: 'bell', alt: 'bell', bass: 'soft', drums: 'none', pad: 1 },
    cinder: { bpm: 92, root: 57, mode: 'aeolian', prog: [0, 5, 6, 0], lead: 'brass', alt: 'pluck', bass: 'hard', drums: 'taiko', pad: 0.7 },
    sky: { bpm: 80, root: 65, mode: 'lydian', prog: [0, 4, 5, 3], lead: 'harp', alt: 'bell', bass: 'soft', drums: 'none', pad: 1.2, choir: true },
    boss: { bpm: 132, root: 57, mode: 'harmonic', prog: [0, 5, 3, 4], lead: 'brass', alt: 'pluck', bass: 'hard', drums: 'battle', pad: 0.5 },
    final: { bpm: 140, root: 55, mode: 'harmonic', prog: [0, 5, 1, 4], lead: 'brass', alt: 'bell', bass: 'hard', drums: 'battle', pad: 0.8, choir: true },
    ending: { bpm: 88, root: 62, mode: 'ionian', prog: [0, 5, 3, 4], lead: 'flute', alt: 'harp', bass: 'soft', drums: 'none', pad: 1.1, choir: true },
};
export const REALM_THEME = ['meadow', 'sand', 'frost', 'cinder', 'sky'];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
    constructor() {
        this.ctx = null;
        this.vol = { music: 0.7, sfx: 0.85 };
        this.theme = null;
        this.wanted = null;
        this.limit = new Map();
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = 0.9;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        this.master.connect(comp).connect(c.destination);
        this.music = c.createGain(); this.sfx = c.createGain();
        this.music.connect(this.master); this.sfx.connect(this.master);
        // a soft room: feedback delay through a lowpass, for music and some effects
        this.verb = c.createDelay(1.0); this.verb.delayTime.value = 0.23;
        const fb = c.createGain(); fb.gain.value = 0.38;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        this.verbIn = c.createGain(); this.verbIn.gain.value = 0.32;
        this.verbIn.connect(this.verb); this.verb.connect(lp).connect(fb).connect(this.verb);
        lp.connect(this.music);
        this.noise = (() => { const b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
        this.apply();
        this.timer = setInterval(() => this.schedule(), 60);
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) this.ctx.suspend().catch(() => {});
            else this.ctx.resume().catch(() => {});
        });
        if (this.wanted) this.play(this.wanted, true);
    }

    setVolumes(music, sfx) { this.vol.music = music; this.vol.sfx = sfx; this.apply(); }
    apply() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.music.gain.setTargetAtTime(this.vol.music * 0.42, t, 0.1);
        this.sfx.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
    }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }

    // ---------------------------------------------------------------- music
    play(name, force = false) {
        this.wanted = name;
        if (!this.ctx) return;
        if (this.theme && this.theme.name === name && !force) return;
        const T = THEMES[name];
        if (!T) { this.theme = null; return; }
        const rng = new Rng(hashStr(name + ':motif'));
        const sc = MODES[T.mode];
        // a four-bar motif in eighths: chord tones on beats, steps between, a few rests and holds
        const beats = T.waltz ? 6 : 8;
        const motif = [];
        let deg = 4;
        for (let bar = 0; bar < 4; bar++) {
            const root = T.prog[bar];
            for (let i = 0; i < beats; i++) {
                const strong = T.waltz ? i % 2 === 0 : i % 2 === 0;
                if (rng.next() < (strong ? 0.08 : 0.28)) { motif.push(null); continue; }
                if (strong) { const ct = [0, 2, 4][rng.int(3)]; deg = root + ct + (rng.next() < 0.5 ? 7 : 0); }
                else deg += rng.next() < 0.5 ? 1 : -1;
                deg = Math.max(0, Math.min(13, deg));
                motif.push({ deg, len: rng.next() < 0.15 ? 2 : 1 });
            }
        }
        const fade = this.theme ? 0.4 : 0;
        this.theme = { name, T, sc, motif, beats, step: 0, next: this.ctx.currentTime + 0.1 + fade, bar: 0, sec: 0 };
    }
    stop() { this.theme = null; this.wanted = null; }

    deg(T, sc, d, oct = 0) { const n = sc.length; const o = Math.floor(d / n); return T.root + sc[((d % n) + n) % n] + 12 * (o + oct); }

    schedule() {
        const c = this.ctx, th = this.theme;
        if (!c || !th || c.state !== 'running') return;
        const T = th.T;
        const eighth = 60 / T.bpm / 2;
        while (th.next < c.currentTime + 0.2) {
            const t = th.next;
            const beats = th.beats;
            const stepInBar = th.step % beats;
            const bar = Math.floor(th.step / beats) % 16;
            const section = Math.floor(bar / 4); // A A' B A
            const chord = T.prog[bar % 4] + (section === 2 ? 3 : 0);
            // ---- melody
            const mi = (bar % 4) * beats + stepInBar;
            let note = th.motif[mi];
            if (section === 1 && note && stepInBar >= beats - 2) note = { deg: note.deg + 2, len: note.len };
            if (section === 2) note = th.motif[((bar % 4) * beats + ((stepInBar + 3) % beats)) % th.motif.length];
            if (note) {
                const d = section === 2 ? note.deg - 2 : note.deg;
                const f = mtof(this.deg(T, th.sc, d, 0));
                this.voice(section === 2 ? T.alt : T.lead, f, t, eighth * note.len * 0.95, 0.12);
            }
            // ---- harmony: arpeggio on the alt instrument
            if (T.alt && (stepInBar % 2 === 1 || T.waltz)) {
                const ar = [0, 2, 4, 2][(stepInBar >> 1) % 4];
                this.voice(T.alt === 'oud' ? 'oud' : T.alt === 'bell' ? 'bell' : T.alt === 'harp' ? 'harp' : 'pluck', mtof(this.deg(T, th.sc, chord + ar, -1)), t, eighth * 0.9, 0.05);
            }
            // ---- bass on the bar's downbeats
            if (stepInBar === 0 || (T.bass === 'hard' && stepInBar % 2 === 0) || (T.waltz && stepInBar === 0)) {
                this.bass(mtof(this.deg(T, th.sc, chord, -2)), t, eighth * (T.bass === 'hard' ? 1.8 : 3.5), T.bass === 'hard' ? 0.18 : 0.14);
            }
            // ---- pad each bar
            if (stepInBar === 0 && T.pad > 0) {
                for (const k of [0, 2, 4]) this.pad(mtof(this.deg(T, th.sc, chord + k, -1)), t, eighth * beats * 1.02, 0.025 * T.pad, T.choir);
            }
            // ---- drums
            this.drums(T.drums, stepInBar, t, beats, bar);
            th.next += eighth;
            th.step++;
        }
    }

    drums(style, s, t, beats, bar) {
        switch (style) {
            case 'march': if (s === 0 || s === 4) this.kick(t, 0.25); if (s === 2 || s === 6) this.snare(t, 0.1); if (s === 7) this.snare(t + 0.06, 0.06); break;
            case 'shaker': if (s % 2 === 1) this.hat(t, 0.035); if (s === 0) this.kick(t, 0.14); break;
            case 'hand': if (s === 0 || s === 3 || s === 6) this.handDrum(t, s === 0 ? 220 : 330, 0.22); if (s % 2) this.hat(t, 0.03); break;
            case 'taiko': if (s === 0 || s === 5) this.taiko(t, 0.4); if (s === 2 || s === 6) this.handDrum(t, 160, 0.15); break;
            case 'battle': if (s % 4 === 0) this.kick(t, 0.32); if (s % 4 === 2) this.snare(t, 0.16); this.hat(t, s % 2 ? 0.03 : 0.05); if (bar % 4 === 3 && s >= 6) this.snare(t + 0.04, 0.1); break;
        }
    }

    // ---------------------------------------------------------------- instruments
    env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    voice(kind, f, t, dur, vol) {
        const c = this.ctx;
        const g = c.createGain();
        g.connect(this.music); g.connect(this.verbIn);
        const o = c.createOscillator();
        let stopAt = t + dur + 0.6;
        switch (kind) {
            case 'flute': {
                o.type = 'sine'; o.frequency.value = f * 2;
                const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5.5; vg.gain.value = f * 0.012; v.connect(vg).connect(o.frequency); v.start(t); v.stop(stopAt);
                g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
                const n = c.createBufferSource(); n.buffer = this.noise; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 3; const ng = c.createGain(); ng.gain.value = vol * 0.12;
                n.connect(nf).connect(ng).connect(g); n.start(t, Math.random()); n.stop(t + 0.08);
                break;
            }
            case 'pluck': { o.type = 'triangle'; o.frequency.value = f * 2; this.env(g, t, 0.004, vol * 1.2, 0.35); stopAt = t + 0.5; break; }
            case 'oud': {
                o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 2 * 1.01, t); o.frequency.exponentialRampToValueAtTime(f * 2, t + 0.05);
                const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
                o.connect(lp).connect(g); this.env(g, t, 0.003, vol * 0.9, 0.42); o.start(t); o.stop(t + 0.6); return;
            }
            case 'bell': {
                o.type = 'sine'; o.frequency.value = f * 4;
                const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4 * 2.76; const g2 = c.createGain(); g2.gain.value = 0.3;
                o2.connect(g2).connect(g); o2.start(t); o2.stop(t + 1.4);
                this.env(g, t, 0.003, vol * 0.8, 1.2); stopAt = t + 1.4; break;
            }
            case 'harp': { o.type = 'triangle'; o.frequency.value = f * 2; this.env(g, t, 0.003, vol, 0.9); stopAt = t + 1.0; break; }
            case 'brass': {
                o.type = 'sawtooth'; o.frequency.value = f * 2;
                const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.06); lp.frequency.setTargetAtTime(900, t + 0.1, 0.2);
                o.connect(lp).connect(g);
                g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.7, t + 0.04); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
                o.start(t); o.stop(t + dur + 0.4); return;
            }
        }
        o.connect(g); o.start(t); o.stop(stopAt);
    }
    bass(f, t, dur, vol) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.08);
        o.connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.5);
    }
    pad(f, t, dur, vol, choir) {
        const c = this.ctx;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = choir ? 1400 : 900; lp.Q.value = choir ? 4 : 1;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
        lp.connect(g); g.connect(this.music); g.connect(this.verbIn);
        for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = choir ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur * 1.15); }
    }
    kick(t, vol) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); this.env(g, t, 0.002, vol, 0.2); o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.3); }
    snare(t, vol) { this.noiseHit(t, vol, 'bandpass', 1800, 0.14, this.music); }
    hat(t, vol) { this.noiseHit(t, vol, 'highpass', 7000, 0.04, this.music); }
    handDrum(t, f, vol) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); this.env(g, t, 0.002, vol, 0.18); o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.25); }
    taiko(t, vol) { this.kick(t, vol); this.noiseHit(t, vol * 0.5, 'lowpass', 300, 0.25, this.music); }
    noiseHit(t, vol, type, freq, dur, dest) {
        const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.noise; f.type = type; f.frequency.value = freq;
        this.env(g, t, 0.002, vol, dur);
        n.connect(f).connect(g).connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
    }

    // ---------------------------------------------------------------- effects
    ok(name, gap = 0.04) { if (!this.ctx) return false; const t = this.ctx.currentTime, l = this.limit.get(name) ?? -1; if (t - l < gap) return false; this.limit.set(name, t); return true; }
    tone(type, f0, f1, dur, vol, at = 0, dest = this.sfx) {
        const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        this.env(g, t, 0.004, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
    }
    nz(type, f, dur, vol, at = 0, q = 1) {
        const c = this.ctx, t = c.currentTime + at, n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        this.env(g, t, 0.004, vol, dur); n.connect(fl).connect(g).connect(this.sfx); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
    }
    notes(list, type = 'triangle', step = 0.09, vol = 0.18, len = 0.25) { list.forEach((m, i) => this.tone(type, mtof(m), mtof(m), len, vol, i * step)); }

    sfxPlay(name, a = {}) {
        if (!this.ctx || !this.ok(name, a.gap ?? 0.03)) return;
        switch (name) {
            case 'click': this.tone('sine', 880, 660, 0.06, 0.15); break;
            case 'hover': this.tone('sine', 1200, 1200, 0.03, 0.05); break;
            case 'open': this.tone('triangle', 520, 780, 0.12, 0.14); break;
            case 'close': this.tone('triangle', 780, 520, 0.12, 0.12); break;
            case 'error': this.tone('square', 220, 160, 0.15, 0.1); break;
            case 'buy': this.notes([76, 79, 84, 88], 'triangle', 0.06, 0.16, 0.18); this.nz('highpass', 6000, 0.2, 0.1, 0.1); break;
            case 'equip': this.notes([72, 79], 'square', 0.07, 0.08, 0.12); break;
            case 'blip': this.tone('square', 300 * (a.pitch ?? 1) * (0.92 + Math.random() * 0.16), 300 * (a.pitch ?? 1), 0.04, 0.045); break;
            case 'tick': this.tone('sine', 1500, 1500, 0.02, 0.05); break;
            case 'meter': this.tone('triangle', 400, 800, 0.08, 0.08); break;
            case 'swing': this.nz('bandpass', 900 + (a.power ?? 0.5) * 1800, 0.22, 0.25 * (0.4 + (a.power ?? 0.5)), 0, 0.8); break;
            case 'hit': {
                const club = a.club ?? 'iron';
                if (club === 'putter') { this.tone('sine', 900, 700, 0.05, 0.22); this.nz('bandpass', 2500, 0.03, 0.15, 0, 3); }
                else { this.tone('triangle', club === 'driver' ? 340 : 480, 120, 0.09, 0.35); this.nz('bandpass', club === 'driver' ? 2200 : 3200, 0.06, 0.4, 0, 2); }
                if (a.perfect) { this.notes([84, 88, 91, 96], 'sine', 0.05, 0.12, 0.3); }
                break;
            }
            case 'bounce': {
                const v = Math.min(1, (a.speed ?? 5) / 18);
                const s = a.surf;
                if (s === 'sand') this.nz('lowpass', 1200, 0.18, 0.3 * v + 0.1);
                else if (s === 'snow') this.nz('lowpass', 900, 0.2, 0.3 * v + 0.1);
                else if (s === 'ice') { this.tone('sine', 1800, 1500, 0.08, 0.15 * v + 0.05); this.nz('highpass', 5000, 0.05, 0.1 * v); }
                else if (s === 'stone') this.tone('triangle', 300, 200, 0.08, 0.3 * v + 0.05);
                else if (s === 'cloud') this.tone('sine', 300, 700, 0.18, 0.25);
                else this.nz('lowpass', 500, 0.08, 0.35 * v + 0.05);
                break;
            }
            case 'thunk': if (a.tag === 'spring' || a.tag === 'bumper') this.tone('sine', 250, 900, 0.22, 0.3); else if (a.tag === 'mill' || a.tag === 'blade') this.tone('triangle', 200, 120, 0.1, 0.3); else this.tone('triangle', 260, 140, 0.08, 0.28); break;
            case 'leaves': this.nz('highpass', 3000, 0.3, 0.12); break;
            case 'holed': this.nz('lowpass', 800, 0.06, 0.3); this.tone('triangle', 520, 400, 0.08, 0.3, 0.05); this.tone('triangle', 400, 300, 0.08, 0.25, 0.13); this.notes([72, 76, 79, 84, 88], 'triangle', 0.08, 0.16, 0.35); break;
            case 'lipout': this.tone('triangle', 600, 900, 0.06, 0.2); this.tone('triangle', 700, 500, 0.06, 0.15, 0.07); break;
            case 'splash': this.nz('lowpass', 1800, 0.5, 0.4); this.nz('bandpass', 600, 0.3, 0.3, 0.05, 1); break;
            case 'lava': this.nz('highpass', 2500, 0.7, 0.25); this.tone('sawtooth', 120, 60, 0.4, 0.15); break;
            case 'void': this.tone('sine', 800, 80, 0.9, 0.2); break;
            case 'oob': this.tone('square', 300, 200, 0.2, 0.1); break;
            case 'coin': this.tone('square', 1320, 1320, 0.05, 0.08); this.tone('square', 1760, 1760, 0.12, 0.08, 0.05); break;
            case 'gem': this.notes([88, 91, 96, 100], 'sine', 0.04, 0.12, 0.2); break;
            case 'mana': this.tone('sine', 500, 1400, 0.3, 0.15); break;
            case 'crystal': this.notes([79, 86, 91], 'triangle', 0.06, 0.15, 0.3); break;
            case 'poof': this.nz('bandpass', 1400, 0.2, 0.3, 0, 1); this.tone('sine', 500, 1200, 0.12, 0.15); break;
            case 'bossHit': this.tone('square', 220, 80, 0.2, 0.25); this.nz('lowpass', 1500, 0.25, 0.4); break;
            case 'roar': this.tone('sawtooth', a.low ? 90 : 160, a.low ? 50 : 90, 0.7, 0.25); this.nz('bandpass', 400, 0.6, 0.25, 0, 2); break;
            case 'stomp': this.tone('sine', 90, 30, 0.5, 0.5); this.nz('lowpass', 400, 0.5, 0.4); break;
            case 'seal': this.notes([96, 91, 88, 84, 79], 'sine', 0.04, 0.12, 0.4); this.nz('highpass', 4000, 0.6, 0.15); break;
            case 'spell': {
                const id = a.id;
                if (id === 'fire') { this.nz('bandpass', 700, 0.5, 0.3, 0, 0.7); this.tone('sawtooth', 200, 600, 0.4, 0.12); }
                else if (id === 'frost') { this.notes([96, 100, 103, 108], 'sine', 0.04, 0.1, 0.4); this.nz('highpass', 6000, 0.4, 0.1); }
                else if (id === 'seek') this.tone('sine', 400, 1600, 0.5, 0.15);
                else if (id === 'ward') { this.nz('bandpass', 1200, 0.6, 0.2, 0, 0.5); this.tone('sine', 600, 900, 0.5, 0.1); }
                else this.notes([84, 79, 76, 72], 'triangle', 0.05, 0.14, 0.25);
                break;
            }
            case 'item': this.tone('triangle', 600, 1200, 0.15, 0.15); break;
            case 'geyser': this.nz('bandpass', 900, 0.9, 0.35, 0, 0.6); break;
            case 'rune': this.notes([84, 91, 96], 'sine', 0.05, 0.14, 0.5); break;
            case 'levelup': this.notes([72, 76, 79, 84, 79, 84, 88, 91], 'square', 0.08, 0.09, 0.2); this.notes([60, 64, 67, 72], 'triangle', 0.16, 0.12, 0.4); break;
            case 'star': this.tone('sine', mtof(84 + (a.i ?? 0) * 4), mtof(84 + (a.i ?? 0) * 4), 0.35, 0.18); break;
            case 'fanfare': this.notes([67, 72, 76, 79, 76, 79, 84], 'square', 0.1, 0.09, 0.22); this.notes([48, 55, 60], 'triangle', 0.2, 0.14, 0.6); break;
            case 'fail': this.notes([72, 71, 70, 69], 'triangle', 0.18, 0.14, 0.3); break;
            case 'whiff': this.nz('bandpass', 600, 0.25, 0.15, 0, 0.6); break;
            case 'step': this.nz('lowpass', 700, 0.05, 0.06); break;
        }
    }
}

export const audio = new Audio();
