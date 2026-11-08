// Procedural sound, all Web Audio, no files. A look-ahead sequencer plays one of three themes (the station's
// slow pads, the planet's walking arpeggio, the Rootmother's drums) through a reverb made from noise; effects
// answer sim events; TILLY talks in soft blips. ../lib/page-audio.js suspends it all in a hidden tab.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const THEMES = {
    station: { bpm: 64, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 66], [52, 55, 59, 62]], arp: false, drum: false },
    planet: { bpm: 96, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], arp: true, drum: false },
    hollow: { bpm: 72, chords: [[49, 56, 61, 64], [45, 52, 57, 61], [47, 54, 59, 62], [44, 51, 56, 59]], arp: true, drum: false },
    boss: { bpm: 132, chords: [[45, 52, 55, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 56]], arp: true, drum: true },
    end: { bpm: 70, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 65], [55, 59, 62, 67]], arp: true, drum: false },
};

export class Audio {
    constructor() { this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.55; this.theme = 'station'; this.want = 'station'; this.blipT = 0; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
        this.out = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.4; this.music.connect(comp);
        // a reverb from decaying noise
        const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.5; this.verb.connect(wet); wet.connect(this.music);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        // a station hum under everything
        this.hum = ctx.createGain(); this.hum.gain.value = 0.0; this.hum.connect(this.music);
        for (const f of [55, 82.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(this.hum); o.start(); }
        this.nextT = ctx.currentTime + 0.1; this.beat = 0;
        this.timer = setInterval(() => this.schedule(), 60);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.4, this.ctx.currentTime, 0.05);
    }
    setTheme(name) { this.want = name; }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        this.hum.gain.setTargetAtTime(this.want === 'station' ? 0.05 : 0, ctx.currentTime, 0.5);
        while (this.nextT < ctx.currentTime + 0.25) {
            // themes change on a bar line
            if (this.beat % 8 === 0) this.theme = this.want;
            const T = THEMES[this.theme], spb = 60 / T.bpm / 2;
            const bar = Math.floor(this.beat / 8), chord = T.chords[bar % T.chords.length], t = this.nextT, b = this.beat % 8;
            if (b === 0) for (const m of chord) this.pad(NOTE(m), t, spb * 8, this.theme === 'boss' ? 0.035 : 0.05);
            if (b === 0 || b === 4) this.voice(NOTE(chord[0] - 12), t, spb * 3, 'triangle', 0.08, false);
            if (T.arp) { const m = chord[(b * 3 + bar) % 4] + 12 + (b % 4 === 3 ? 12 : 0); this.voice(NOTE(m), t, spb * 0.9, 'square', 0.022, true); }
            else if (b === 2 || b === 6) { if (hash(bar, b) > 0.4) this.voice(NOTE(chord[(bar + b) % 4] + 24), t, spb * 4, 'sine', 0.03, true); }
            if (T.drum) { if (b % 2 === 0) this.kick(t); if (b === 2 || b === 6) this.snare(t); }
            this.nextT += spb; this.beat++;
        }
    }
    pad(f, t, dur, vol) {
        const ctx = this.ctx, g = ctx.createGain(), f1 = ctx.createBiquadFilter();
        f1.type = 'lowpass'; f1.frequency.value = 1100;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const d of [-5, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(f1); o.start(t); o.stop(t + dur + 0.05); }
        f1.connect(g); g.connect(this.music); g.connect(this.verb);
    }
    voice(f, t, dur, type, vol, wet) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.music); if (wet) g.connect(this.verb);
        o.start(t); o.stop(t + dur + 0.05);
    }
    kick(t) { const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25); }
    snare(t) { this.noise(t, 0.12, 0.08, 2200, this.music); }
    noise(t, dur, vol, freq, dest = this.sfx, type = 'bandpass') {
        const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
    }
    hiss(dur, vol, freq, type) { if (this.ctx?.state === 'running') this.noise(this.ctx.currentTime, dur, vol, freq, this.sfx, type); }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 520, to: 780, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 780, to: 520, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'no') this.tone({ freq: 200, to: 150, dur: 0.16, type: 'square', vol: 0.08 });
        else if (kind === 'ok') { this.tone({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.12 }); this.tone({ freq: 990, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.07 }); }
    }
    /** One blip per few characters while TILLY types; others speak lower and plainer. */
    talk(who) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const base = who === 'tilly' ? 760 : who === 'vesper' ? 330 : who === 'sys' ? 220 : 440;
        this.tone({ freq: base * (0.9 + Math.random() * 0.25), dur: 0.035, type: who === 'vesper' ? 'sine' : who === 'sys' ? 'square' : 'triangle', vol: 0.05 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'swing': this.hiss(0.12, 0.12, 1800, 'highpass'); if (e.hit) this.tone({ freq: 220, to: 90, dur: 0.1, type: 'square', vol: 0.15 }); break;
                case 'shoot': this.tone({ freq: 1400, to: 300, dur: 0.12, type: 'sawtooth', vol: 0.08 }); break;
                case 'hit': this.tone({ freq: 300, to: 160, dur: 0.07, type: 'square', vol: 0.08 }); break;
                case 'kill': this.tone({ freq: 400, to: 1200, dur: 0.18, type: 'triangle', vol: 0.12 }); this.hiss(0.2, 0.1, 900); break;
                case 'gather': this.tone({ freq: e.kind === 'mineral' ? 1500 : e.kind === 'flora' ? 700 : 520, dur: 0.06, type: 'triangle', vol: 0.1 }); break;
                case 'sample': [880, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'sine', vol: 0.1, delay: i * 0.06 })); break;
                case 'sequenced': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
                case 'hurt': this.tone({ freq: 160, to: 60, dur: 0.2, type: 'sawtooth', vol: 0.18 }); this.hiss(0.15, 0.15, 400, 'lowpass'); break;
                case 'windup': this.tone({ freq: 120, to: 240, dur: 0.3, type: 'sawtooth', vol: 0.05 }); break;
                case 'spit': this.hiss(0.15, 0.08, 1200); break;
                case 'full': this.tone({ freq: 300, dur: 0.15, type: 'square', vol: 0.08 }); this.tone({ freq: 250, dur: 0.15, type: 'square', vol: 0.08, delay: 0.15 }); break;
                case 'limp': [400, 300, 200].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'square', vol: 0.1, delay: i * 0.2 })); break;
                case 'echo': [392, 494, 587, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.6, type: 'sine', vol: 0.1, delay: i * 0.15 })); break;
                case 'deploy': this.hiss(1.4, 0.25, 300, 'lowpass'); this.tone({ freq: 80, to: 400, dur: 1.2, type: 'sawtooth', vol: 0.1 }); break;
                case 'missionEnd': if (e.how === 'dead') this.tone({ freq: 600, to: 40, dur: 0.9, type: 'sawtooth', vol: 0.15 }); else this.tone({ freq: 200, to: 900, dur: 0.8, type: 'triangle', vol: 0.12 }); break;
                case 'ring': this.tone({ freq: 90, to: 60, dur: 0.4, type: 'sawtooth', vol: 0.12 }); break;
                case 'slamWarn': this.tone({ freq: 70, to: 140, dur: 1.1, type: 'square', vol: 0.06 }); break;
                case 'slam': this.hiss(0.5, 0.3, 200, 'lowpass'); this.tone({ freq: 70, to: 30, dur: 0.4, type: 'sine', vol: 0.3 }); break;
                case 'bossDown': this.hiss(2, 0.3, 300, 'lowpass'); break;
                case 'researched': case 'strainReady': case 'fabricated': [659, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.1, delay: i * 0.09 })); break;
                case 'release': this.hiss(0.8, 0.15, 600, 'lowpass'); [523, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.09, delay: 0.3 + i * 0.1 })); break;
                case 'blend': this.hiss(0.6, 0.08, 900); break;
                case 'use': this.ui('open'); break;
                default: break;
            }
        }
    }
}
function hash(a, b) { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
