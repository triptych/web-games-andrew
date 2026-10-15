// Procedural sound, all Web Audio, no files. A look-ahead sequencer plays a theme per place, and
// effects answer simulation events. The context is made on the first user gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

const PENTA = [0, 2, 4, 7, 9];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Themes: bpm, a chord loop (root midi, intervals), and which voices play.
const THEMES = {
    title: { bpm: 72, chords: [[48, [0, 4, 7, 11]], [45, [0, 3, 7, 10]], [41, [0, 4, 7, 9]], [43, [0, 4, 7, 10]]], voices: ['pad', 'box', 'lute', 'bass'], mel: [76, 74, 72, 74, 76, 79, 76, 74] },
    clinic: { bpm: 84, chords: [[48, [0, 4, 7]], [43, [0, 4, 7]], [45, [0, 3, 7]], [41, [0, 4, 7]]], voices: ['lute', 'box', 'bass', 'pad'], mel: [72, 74, 76, 79, 76, 74, 72, 69] },
    forest: { bpm: 76, chords: [[50, [0, 3, 7, 10]], [48, [0, 4, 7]], [46, [0, 4, 7, 9]], [48, [0, 4, 7]]], voices: ['harp', 'flute', 'pad', 'bass'], mel: [74, 77, 79, 81, 79, 77, 74, 72] },
    crypt: { bpm: 60, chords: [[45, [0, 3, 7]], [41, [0, 4, 7]], [43, [0, 4, 7]], [40, [0, 4, 7]]], voices: ['choir', 'bell', 'bass'], mel: [69, 72, 71, 69, 67, 69, 64, 65] },
    forge: { bpm: 92, chords: [[40, [0, 1, 5, 7]], [40, [0, 3, 7]], [41, [0, 4, 7]], [40, [0, 1, 7]]], voices: ['drum', 'bass', 'brass', 'anvil'], mel: [64, 65, 64, 67, 65, 64, 62, 64] },
    citadel: { bpm: 70, chords: [[47, [0, 3, 7]], [43, [0, 4, 7]], [42, [0, 4, 7, 10]], [47, [0, 3, 7]]], voices: ['organ', 'timp', 'choir', 'bass'], mel: [71, 74, 73, 71, 70, 71, 66, 67] },
    scan: { bpm: 96, chords: [[45, [0, 3, 7, 10]], [41, [0, 4, 7, 11]], [43, [0, 4, 7, 9]], [40, [0, 3, 7, 10]]], voices: ['arp', 'pad', 'bass', 'glass'], mel: null },
    boss: { bpm: 108, chords: [[45, [0, 3, 7]], [46, [0, 4, 7]], [43, [0, 3, 7]], [44, [0, 4, 7]]], voices: ['arp', 'drum', 'bass', 'choir', 'timp'], mel: null },
    ending: { bpm: 76, chords: [[48, [0, 4, 7, 11]], [45, [0, 3, 7, 10]], [41, [0, 4, 7, 11]], [43, [0, 4, 7, 10]]], voices: ['harp', 'pad', 'box', 'bass', 'flute'], mel: [76, 79, 81, 79, 76, 74, 72, 74] },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.theme = null;
        this.wantTheme = 'title';
        this.step16 = 0;
        this.nextT = 0;
        this.lastBlip = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = comp;
        // a reverb from a decaying noise impulse
        const len = ctx.sampleRate * 2.4;
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.32;
        this.verb.connect(this.verbGain); this.verbGain.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp); this.sfx.connect(this.verb);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.42; this.music.connect(comp); this.music.connect(this.verb);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 40);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.42, this.ctx.currentTime, 0.05);
    }

    setTheme(name) { this.wantTheme = name; }

    // ------------------------------------------------------------------ voices
    ok() { return this.ctx && this.ctx.state === 'running'; }

    osc({ freq, type = 'sine', t, dur, vol, attack = 0.01, out = this.sfx, to = null, detune = 0, filter = null, q = 1 }) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q; o.connect(f); node = f; }
        node.connect(g); g.connect(out);
        o.start(t); o.stop(t + dur + 0.05);
    }

    noise({ t, dur, vol, out = this.sfx, type = 'bandpass', freq = 1200, to = null, q = 1 }) {
        const c = this.ctx;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }

    pluck(m, t, vol = 0.12, out = this.music, bright = 2400) {
        this.osc({ freq: mtof(m), type: 'triangle', t, dur: 0.6, vol, attack: 0.003, out, filter: bright });
        this.osc({ freq: mtof(m) * 2, type: 'sine', t, dur: 0.25, vol: vol * 0.3, attack: 0.002, out });
    }

    // ------------------------------------------------------------------ sequencer
    schedule() {
        if (!this.ok()) return;
        const c = this.ctx;
        if (this.wantTheme !== this.theme) {
            this.theme = this.wantTheme;
            this.step16 = 0;
            this.nextT = Math.max(this.nextT, c.currentTime + 0.05);
        }
        const T = THEMES[this.theme];
        if (!T) return;
        const sp = 60 / T.bpm / 4;
        while (this.nextT < c.currentTime + 0.25) {
            this.playStep(T, this.step16, this.nextT, sp);
            this.step16++;
            this.nextT += sp;
        }
    }

    playStep(T, s, t, sp) {
        const bar = Math.floor(s / 16) % T.chords.length;
        const [root, iv] = T.chords[bar];
        const pos = s % 16;
        const out = this.music;
        const chord = iv.map((x) => root + 12 + x);
        for (const v of T.voices) {
            switch (v) {
                case 'pad':
                    if (pos === 0) for (const m of chord) { this.osc({ freq: mtof(m), type: 'sawtooth', t, dur: sp * 16, vol: 0.018, attack: 0.6, out, filter: 900, detune: -6 }); this.osc({ freq: mtof(m), type: 'sawtooth', t, dur: sp * 16, vol: 0.018, attack: 0.6, out, filter: 900, detune: 7 }); }
                    break;
                case 'choir':
                    if (pos === 0) for (const m of chord) for (const d of [-9, 0, 9]) this.osc({ freq: mtof(m), type: 'sawtooth', t, dur: sp * 16, vol: 0.012, attack: 1.0, out, filter: 700, q: 3, detune: d });
                    break;
                case 'organ':
                    if (pos === 0 || pos === 8) for (const m of chord) { this.osc({ freq: mtof(m), type: 'square', t, dur: sp * 8, vol: 0.012, attack: 0.05, out, filter: 1400 }); this.osc({ freq: mtof(m + 12), type: 'sine', t, dur: sp * 8, vol: 0.012, attack: 0.05, out }); }
                    break;
                case 'bass':
                    if (pos === 0 || pos === 8 || (pos === 12 && bar % 2)) this.osc({ freq: mtof(root - 12 + (pos === 12 ? 7 : 0)), type: 'triangle', t, dur: sp * 6, vol: 0.12, attack: 0.01, out, filter: 500 });
                    break;
                case 'lute':
                    if (pos % 2 === 0) this.pluck(chord[(pos / 2) % chord.length] + (pos >= 8 ? 12 : 0), t, 0.07, out, 2000);
                    break;
                case 'harp':
                    this.pluck(chord[pos % chord.length] + 12 * Math.floor((pos % 8) / chord.length), t, 0.05, out, 3200);
                    break;
                case 'arp': {
                    const notes = [...chord, chord[0] + 12, chord[1] + 12];
                    const m = notes[(pos * 3) % notes.length] + 12;
                    this.osc({ freq: mtof(m), type: 'sine', t, dur: sp * 3, vol: 0.05, attack: 0.005, out });
                    this.osc({ freq: mtof(m + 12), type: 'sine', t, dur: sp * 1.5, vol: 0.012, attack: 0.005, out });
                    break;
                }
                case 'glass':
                    if (pos === 6 || pos === 14) this.osc({ freq: mtof(chord[2] + 24), type: 'sine', t, dur: 1.2, vol: 0.025, attack: 0.002, out });
                    break;
                case 'box':
                    if (T.mel && pos % 4 === 0) { const m = T.mel[((Math.floor(s / 4)) % T.mel.length)]; if ((s >> 2) % 8 !== 7) { this.osc({ freq: mtof(m + 12), type: 'sine', t, dur: 0.9, vol: 0.035, attack: 0.002, out }); this.osc({ freq: mtof(m + 24), type: 'sine', t, dur: 0.3, vol: 0.01, attack: 0.002, out }); } }
                    break;
                case 'flute':
                    if (T.mel && pos % 4 === 0 && (s >> 4) % 2 === 1) { const m = T.mel[((Math.floor(s / 4)) % T.mel.length)]; this.osc({ freq: mtof(m), type: 'sine', t, dur: sp * 3.6, vol: 0.04, attack: 0.08, out }); }
                    break;
                case 'bell':
                    if (pos === 0 && bar % 2 === 0) { const m = T.mel ? T.mel[(s >> 4) % T.mel.length] : chord[0] + 12; for (const [mul, v] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]]) this.osc({ freq: mtof(m) * mul, type: 'sine', t, dur: 2.5, vol: v, attack: 0.002, out }); }
                    break;
                case 'brass':
                    if (pos === 0 || pos === 6 || pos === 10) for (const m of chord.slice(0, 2)) this.osc({ freq: mtof(m), type: 'sawtooth', t, dur: sp * 3, vol: 0.022, attack: 0.03, out, filter: 1100 });
                    break;
                case 'drum':
                    if (pos === 0 || pos === 8 || pos === 11) this.osc({ freq: 110, to: 40, type: 'sine', t, dur: 0.35, vol: 0.22, attack: 0.002, out });
                    if (pos === 4 || pos === 12) this.noise({ t, dur: 0.18, vol: 0.06, out, freq: 1800, q: 0.8 });
                    if (pos % 2 === 1) this.noise({ t, dur: 0.04, vol: 0.015, out, type: 'highpass', freq: 7000 });
                    break;
                case 'timp':
                    if (pos === 0 && bar % 2 === 1) this.osc({ freq: mtof(root - 12), to: mtof(root - 13), type: 'sine', t, dur: 1.2, vol: 0.18, attack: 0.005, out });
                    break;
                case 'anvil':
                    if (pos === 14 && bar % 2 === 0) for (const [f, v] of [[1240, 0.04], [2960, 0.02], [4870, 0.01]]) this.osc({ freq: f, type: 'sine', t, dur: 0.9, vol: v, attack: 0.001, out });
                    break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        if (kind === 'click') this.osc({ freq: 880, type: 'triangle', t, dur: 0.06, vol: 0.08 });
        else if (kind === 'open') { this.osc({ freq: 520, to: 780, type: 'triangle', t, dur: 0.1, vol: 0.08 }); }
        else if (kind === 'close') { this.osc({ freq: 780, to: 520, type: 'triangle', t, dur: 0.1, vol: 0.08 }); }
    }

    blip(voice = 1) {
        if (!this.ok() || !voice) return;
        const t = this.ctx.currentTime;
        if (t - this.lastBlip < 0.055) return;
        this.lastBlip = t;
        const f = 220 * voice * (1 + (Math.random() - 0.5) * 0.25);
        this.osc({ freq: f, type: 'square', t, dur: 0.05, vol: 0.025, filter: 1400 + voice * 600 });
    }

    stepSound(map) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        const f = { clinic: 420, forest: 900, crypt: 1600, forge: 700, citadel: 1300 }[map] ?? 800;
        this.noise({ t, dur: 0.09, vol: 0.05, freq: f * (0.85 + Math.random() * 0.3), q: map === 'crypt' ? 4 : 1.2 });
        if (map === 'clinic') this.osc({ freq: 120 + Math.random() * 20, to: 70, type: 'sine', t, dur: 0.08, vol: 0.05 });
    }

    hop(i, undo = false) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        const m = 62 + PENTA[i % 5] + 12 * Math.floor(i / 5);
        if (undo) { this.osc({ freq: mtof(m - 5), type: 'sine', t, dur: 0.12, vol: 0.06 }); return; }
        this.osc({ freq: mtof(m), type: 'sine', t, dur: 0.35, vol: 0.12, attack: 0.002 });
        this.osc({ freq: mtof(m) * 4, type: 'sine', t, dur: 0.08, vol: 0.03, attack: 0.001 });
    }

    nope() {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        this.osc({ freq: 160, to: 120, type: 'square', t, dur: 0.12, vol: 0.05, filter: 600 });
    }

    treat(school, n) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        if (school === 'venom') this.noise({ t, dur: 0.5, vol: 0.12, freq: 400, to: 3000, q: 2 });
        else if (school === 'wound') [0, 4, 7, 12].forEach((s, i) => this.osc({ freq: mtof(72 + s), type: 'sine', t: t + i * 0.04, dur: 0.6, vol: 0.06 }));
        else if (school === 'hex') for (let i = 0; i < 6; i++) this.osc({ freq: mtof(84 + i * 3), type: 'sine', t: t + i * 0.03, dur: 0.5, vol: 0.03, detune: (Math.random() - 0.5) * 30 });
        else this.noise({ t, dur: 0.6, vol: 0.08, type: 'highpass', freq: 3000, to: 900 });
        this.osc({ freq: 300, to: 900 + n * 60, type: 'sine', t, dur: 0.25, vol: 0.05 });
    }

    learn() { if (!this.ok()) return; const t = this.ctx.currentTime; [60, 64, 67, 72, 76].forEach((m, i) => this.osc({ freq: mtof(m + 12), type: 'triangle', t: t + i * 0.06, dur: 0.8, vol: 0.06 })); }
    coin() { if (!this.ok()) return; const t = this.ctx.currentTime; this.osc({ freq: 1320, type: 'square', t, dur: 0.08, vol: 0.04, filter: 4000 }); this.osc({ freq: 1760, type: 'square', t: t + 0.07, dur: 0.2, vol: 0.04, filter: 4000 }); }

    onEvents(G, events) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime;
        for (const e of events) {
            switch (e.type) {
                case 'step': this.stepSound(e.map); break;
                case 'talk': this.ui('open'); break;
                case 'scanStart': this.noise({ t, dur: 0.8, vol: 0.06, freq: 300, to: 4000, q: 3 }); [57, 64, 69, 76].forEach((m, i) => this.osc({ freq: mtof(m), type: 'sine', t: t + i * 0.08, dur: 1, vol: 0.05 })); break;
                case 'scanEvents':
                    for (const se of e.list) {
                        if (se.type === 'treat') this.treat(se.items[0]?.m?.school, se.items.length);
                        else if (se.type === 'vial' && se.full) [72, 76, 79, 84, 88].forEach((m, i) => this.osc({ freq: mtof(m), type: 'triangle', t: t + i * 0.05, dur: 0.5, vol: 0.05 }));
                        else if (se.type === 'bloom') [60, 64, 67, 72].forEach((m) => { this.osc({ freq: mtof(m + 12), type: 'sine', t, dur: 2, vol: 0.05 }); this.osc({ freq: mtof(m + 12) * 2.76, type: 'sine', t, dur: 1.2, vol: 0.015 }); });
                        else if (se.type === 'phoenix') for (let i = 0; i < 10; i++) this.osc({ freq: mtof(60 + PENTA[i % 5] + 12 * Math.floor(i / 5)), type: 'sine', t: t + i * 0.035, dur: 0.4, vol: 0.04 });
                        else if (se.type === 'prism') this.noise({ t, dur: 0.3, vol: 0.06, freq: 2500, q: 6 });
                        else if (se.type === 'shuffle') this.noise({ t, dur: 0.4, vol: 0.05, freq: 600, to: 1600 });
                        else if (se.type === 'unbind') this.osc({ freq: 1800, to: 900, type: 'square', t, dur: 0.12, vol: 0.03, filter: 3000 });
                        else if (se.type === 'scar') this.noise({ t, dur: 0.15, vol: 0.05, freq: 500, q: 2 });
                        else if (se.type === 'phase') { this.osc({ freq: 80, to: 40, type: 'sawtooth', t, dur: 1.2, vol: 0.12, filter: 400 }); this.noise({ t, dur: 1.2, vol: 0.08, freq: 200, to: 2000 }); }
                        else if (se.type === 'end' && se.status === 'won') [72, 76, 79, 84].forEach((m, i) => { this.osc({ freq: mtof(m), type: 'triangle', t: t + i * 0.12, dur: 0.9, vol: 0.07 }); this.osc({ freq: mtof(m + 12), type: 'sine', t: t + i * 0.12, dur: 0.5, vol: 0.02 }); });
                        else if (se.type === 'end') [64, 62, 59].forEach((m, i) => this.osc({ freq: mtof(m), type: 'triangle', t: t + i * 0.2, dur: 0.6, vol: 0.06 }));
                    }
                    break;
                case 'levelUp': [67, 72, 76, 79, 84].forEach((m, i) => this.osc({ freq: mtof(m), type: 'square', t: t + i * 0.08, dur: 0.4, vol: 0.03, filter: 3000 })); break;
                case 'points': case 'sense': this.learn(); break;
                case 'learn': this.learn(); break;
                case 'buy': case 'upgrade': this.coin(); break;
                case 'trap': this.noise({ t, dur: 0.3, vol: 0.08, freq: 3000, q: 4 }); this.coin(); break;
                case 'chest': case 'relic': [60, 67, 72, 76].forEach((m, i) => this.osc({ freq: mtof(m), type: 'triangle', t: t + i * 0.07, dur: 0.6, vol: 0.06 })); break;
                case 'evidence': [57, 60, 64, 69].forEach((m, i) => this.osc({ freq: mtof(m), type: 'sine', t: t + i * 0.15, dur: 1.4, vol: 0.06 })); break;
                case 'gate': this.osc({ freq: 55, to: 45, type: 'sawtooth', t, dur: 2, vol: 0.1, filter: 300 }); this.noise({ t, dur: 2, vol: 0.05, freq: 150, q: 0.7 }); break;
                case 'travel': this.noise({ t, dur: 1.2, vol: 0.05, freq: 300, to: 900 }); break;
                case 'toTable': this.osc({ freq: 600, to: 900, type: 'sine', t, dur: 0.3, vol: 0.05 }); break;
                case 'rest': [72, 67, 64, 60].forEach((m, i) => this.osc({ freq: mtof(m), type: 'sine', t: t + i * 0.25, dur: 1.2, vol: 0.05 })); break;
                case 'call': [76, 76, 79].forEach((m, i) => this.osc({ freq: mtof(m), type: 'triangle', t: t + i * 0.15, dur: 0.3, vol: 0.06 })); break;
                default: break;
            }
        }
    }
}
