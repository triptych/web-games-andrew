// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a
// look-ahead synthwave sequencer (bass, arp, gated pad, drums) that gets busier each sector.
// The robot voice is the browser's own speech synthesis, pitched to the floor — the cabinet
// shouted "Intruder alert!" in 1980, so the game does too.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const BPM = 112;
const STEP16 = 60 / BPM / 4;
// A minor: Am F C G, one chord a bar
const ROOTS = [45, 41, 48, 43];                          // MIDI notes of the bass roots
const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.voiceOn = true;
        this.playing = false;
        this.intensity = 1;
        this.lastShot = 0;
        this.lastChip = 0;
        this.lastHit = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // a short noise buffer for drums and zaps
        const len = ctx.sampleRate * 0.5;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // a slap-back echo on the music: very 1984
        this.echo = ctx.createDelay(1);
        this.echo.delayTime.value = STEP16 * 3;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        const wet = ctx.createGain(); wet.gain.value = 0.35;
        this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.music);
        this.nextT = 0;
        this.step16 = 0;
        this.timer = setInterval(() => this.schedule(), 25);
    }

    setVolumes(sfx, music, voice = this.voiceOn ? 'on' : 'off') {
        this.sfxVol = sfx; this.musicVol = music; this.voiceOn = voice !== 'off';
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(this.playing ? music * 0.5 : 0, this.ctx.currentTime, 0.05);
    }

    /** Music on (play) or ducked out (title, pause, game over). */
    setPlaying(on, intensity = this.intensity) {
        this.intensity = intensity;
        if (on && !this.playing && this.ctx) { this.nextT = this.ctx.currentTime + 0.05; this.step16 = 0; }
        this.playing = on;
        if (this.ctx) this.music.gain.setTargetAtTime(on ? this.musicVol * 0.5 : 0, this.ctx.currentTime, 0.08);
    }

    // ------------------------------------------------------------------ the sequencer
    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || !this.playing) return;
        if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.02;
        while (this.nextT < ctx.currentTime + 0.12) {
            this.playStep(this.step16, this.nextT);
            this.nextT += STEP16;
            this.step16 = (this.step16 + 1) % 64;
        }
    }

    playStep(s, t) {
        const bar = s >> 4, i = s & 15, root = ROOTS[bar], chord = CHORDS[bar], lvl = this.intensity;
        // driving eighth-note bass, octave bounce on the off-beats
        if ((i & 1) === 0) this.voice({ t, f: midi(root + (i & 2 ? 12 : 0)), dur: STEP16 * 1.6, type: 'sawtooth', vol: 0.22, cut: 700 + lvl * 120, out: this.music });
        // kick on the beat, snare on 2 and 4, hats on the off-sixteenths
        if (i % 4 === 0) this.kick(t);
        if (i === 4 || i === 12) this.hit(t, 0.18, 1800, 0.16, 'bandpass');
        if (lvl >= 2 && (i & 1)) this.hit(t, 0.04, 8000, 0.05, 'highpass');
        // a square arpeggio from sector 2
        if (lvl >= 2) this.voice({ t, f: midi(chord[i % 3] + 12), dur: STEP16 * 0.8, type: 'square', vol: 0.05, cut: 3000, out: this.echo, also: this.music });
        // a gated pad from sector 3
        if (lvl >= 3 && i % 2 === 0) for (const n of chord) this.voice({ t, f: midi(n), dur: STEP16 * 0.9, type: 'triangle', vol: 0.035, cut: 2400, out: this.music });
        // a lead hook from sector 4
        if (lvl >= 4 && [0, 3, 6, 10, 12].includes(i)) this.voice({ t, f: midi(chord[[0, 3, 6, 10, 12].indexOf(i) % 3] + 24), dur: STEP16 * 1.5, type: 'sawtooth', vol: 0.04, cut: 2600, out: this.echo, also: this.music });
    }

    voice({ t, f, dur, type, vol, cut, out, also }) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = type; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 4;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(out);
        if (also) g.connect(also);
        o.start(t); o.stop(t + dur + 0.02);
    }

    kick(t) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + 0.22);
    }

    hit(t, dur, freq, vol, kind, out = this.music) {
        const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise;
        f.type = kind; f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(out);
        src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
    }

    // ------------------------------------------------------------------ effects
    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    noiseFx(dur, freq, vol, kind = 'lowpass') {
        if (!this.ctx || this.ctx.state !== 'running') return;
        this.hit(this.ctx.currentTime, dur, freq, vol, kind, this.sfx);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.08 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.08, type: 'square', vol: 0.08 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.08, type: 'square', vol: 0.08 });
    }

    /** The robot voice. Speech synthesis is optional everywhere; any failure is just silence. */
    say(text) {
        if (!this.voiceOn || this.sfxVol <= 0) return;
        try {
            const sy = window.speechSynthesis;
            if (!sy || typeof SpeechSynthesisUtterance === 'undefined') return;
            sy.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.pitch = 0.1; u.rate = 0.85; u.volume = Math.min(1, this.sfxVol);
            sy.speak(u);
        } catch { /* no voice here */ }
    }
    hush() { try { window.speechSynthesis?.cancel(); } catch { /* */ } }

    onEvents(G, events) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (const e of events) {
            switch (e.type) {
                case 'shoot':
                    if (now - this.lastShot < 0.05) break;
                    this.lastShot = now;
                    this.tone({ freq: 1600, to: 400, dur: 0.07, type: 'square', vol: 0.06 });
                    break;
                case 'hit':
                    if (now - this.lastHit < 0.04) break;
                    this.lastHit = now;
                    this.tone({ freq: 300, to: 180, dur: 0.04, type: 'square', vol: 0.05 });
                    break;
                case 'kill':
                    if (e.by === 'purge') break;
                    this.noiseFx(e.kind === 'brute' ? 0.45 : 0.18, e.kind === 'brute' ? 600 : 1400, e.kind === 'brute' ? 0.4 : 0.18);
                    this.tone({ freq: e.kind === 'brute' ? 120 : 260, to: 50, dur: 0.18, type: 'sawtooth', vol: 0.08 });
                    break;
                case 'chip':
                    if (now - this.lastChip < 0.035) break;
                    this.lastChip = now;
                    this.tone({ freq: 1320 + (G.xp % 8) * 80, to: 1980, dur: 0.06, type: 'triangle', vol: 0.08 });
                    break;
                case 'hurt':
                    this.noiseFx(0.25, 400, 0.35);
                    this.tone({ freq: e.cause === 'zap' ? 2400 : 180, to: e.cause === 'zap' ? 120 : 60, dur: 0.25, type: 'sawtooth', vol: 0.16 });
                    break;
                case 'dash': this.tone({ freq: 220, to: 880, dur: 0.14, type: 'sawtooth', vol: 0.08 }); break;
                case 'bolt': this.tone({ freq: 500, to: 300, dur: 0.1, type: 'triangle', vol: 0.05 }); break;
                case 'ping': this.tone({ freq: 2000, dur: 0.04, type: 'triangle', vol: 0.05 }); break;
                case 'pulse': this.tone({ freq: 90, to: 40, dur: 0.35, type: 'sine', vol: 0.4 }); this.noiseFx(0.3, 900, 0.15); break;
                case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'square', vol: 0.1, delay: i * 0.06 })); break;
                case 'choose': this.tone({ freq: 784, to: 1568, dur: 0.15, type: 'square', vol: 0.1 }); break;
                case 'sector':
                    this.noiseFx(0.8, 300, 0.5);
                    this.tone({ freq: 60, to: 30, dur: 0.8, type: 'sine', vol: 0.5 });
                    this.intensity = Math.min(4, e.sector);
                    this.say(`Sector ${e.sector}`);
                    break;
                case 'grinner': this.say('Chicken! Fight like a robot!'); [880, 660, 880, 660].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'square', vol: 0.08, delay: i * 0.1 })); break;
                case 'cackle': [700, 900, 700, 900, 700].forEach((f, i) => this.tone({ freq: f, dur: 0.05, type: 'square', vol: 0.07, delay: i * 0.05 })); break;
                case 'over':
                    if (e.win) [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'square', delay: i * 0.12, vol: 0.12 }));
                    else [392, 330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sawtooth', delay: i * 0.18, vol: 0.12 }));
                    this.say(e.win ? 'The humanoid has escaped' : 'Intruder destroyed');
                    break;
            }
        }
    }
}
