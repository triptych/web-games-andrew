// Procedural sound, all Web Audio, no files. Effects answer simulation events.
// Music: a look-ahead sequencer (a 25 ms timer schedules eighth notes on the audio clock) playing
// original tunes: a bouncy main theme that speeds up at HURRY UP! as in the arcade, a minor-key
// boss theme, a slower title version and short jingles. The context is made on the first user
// gesture, and ../lib/page-audio.js suspends it while the tab is hidden.

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// eighth notes; chords are [root midi] per bar
const SONGS = {
    main: {
        bpm: 150, chords: [48, 45, 41, 43, 48, 45, 41, 48],
        lead: [
            76, 79, 84, 79, 76, _, 79, _, 81, _, 79, 76, 72, _, 76, _,
            77, 81, 84, 81, 77, _, 81, _, 79, _, 83, _, 86, _, 83, 79,
            84, _, 79, _, 76, 79, 84, _, 81, 79, 76, 72, 74, 76, 72, _,
            77, _, 81, _, 79, _, 83, _, 84, _, 79, 76, 72, _, _, _,
        ],
        minor: false,
    },
    boss: {
        bpm: 168, chords: [45, 41, 43, 40, 45, 41, 43, 40],
        lead: [
            69, _, 72, 76, 81, _, 79, 76, 77, _, 76, 72, 69, _, 72, _,
            67, 71, 74, 79, 77, _, 74, 71, 76, _, 80, _, 83, _, 80, 76,
            69, _, 72, 76, 81, _, 79, 76, 77, _, 76, 72, 69, _, 72, _,
            67, 71, 74, 79, 77, _, 74, 71, 76, 74, 72, 71, 68, _, _, _,
        ],
        minor: true,
    },
    title: {
        bpm: 104, chords: [48, 45, 41, 43, 48, 45, 41, 48],
        lead: [
            76, _, 79, _, 84, _, _, _, 81, _, 79, _, 76, _, _, _,
            77, _, 81, _, 84, _, _, _, 83, _, _, _, 79, _, _, _,
            84, _, 79, _, 76, _, 79, _, 81, _, 79, _, 76, _, 72, _,
            77, _, 81, _, 79, _, 83, _, 84, _, _, _, _, _, _, _,
        ],
        minor: false, soft: true,
    },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.song = null;
        this.want = null;
        this.tempo = 1;
        this.lim = new Map();
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.4; this.music.connect(comp);
        // a short echo for bubbles and the lead
        this.echo = ctx.createDelay(0.5); this.echo.delayTime.value = 0.18;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        const eo = ctx.createGain(); eo.gain.value = 0.3;
        this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(eo); eo.connect(comp);
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.step = 0;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
        if (this.want) this.play(this.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.4, this.ctx.currentTime, 0.05);
    }

    // ================================================================ music
    play(id, tempo = 1) {
        this.want = id;
        this.tempo = tempo;
        if (!this.ctx) return;
        if (this.song?.id === id) return;
        this.song = id ? { id, ...SONGS[id] } : null;
        this.step = 0;
        this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.06);
    }
    stop() { this.song = null; this.want = null; }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || !this.song) return;
        const st = 60 / (this.song.bpm * this.tempo) / 2;
        if (this.nextT < ctx.currentTime - 0.2) { const skip = Math.ceil((ctx.currentTime - this.nextT) / st); this.step += skip; this.nextT += skip * st; }
        while (this.nextT < ctx.currentTime + 0.12) {
            this.playStep(this.step, this.nextT, st);
            this.nextT += st;
            this.step++;
        }
    }

    playStep(i, t, st) {
        const s = this.song;
        const k = i % 64, bar = Math.floor(k / 8), beat = k % 8;
        const root = s.chords[bar];
        const third = s.minor || bar === 1 || bar === 5 ? 3 : 4;
        // lead: square with a little vibrato through the echo
        const n = s.lead[k];
        if (n != null) this.note(N(n), t, st * (s.soft ? 1.8 : 0.9), s.soft ? 'triangle' : 'square', s.soft ? 0.09 : 0.055, this.music, true);
        // bass: root and fifth bounce
        const bn = beat % 2 === 0 ? root - 12 : root - 5;
        if (!s.soft || beat % 4 === 0) this.note(N(bn), t, st * 0.8, 'triangle', 0.16, this.music);
        // arpeggio sparkle on off-beats
        if (!s.soft && beat % 2 === 1) this.note(N(root + 12 + [0, third, 7, 12][(i >> 1) % 4]), t, st * 0.4, 'square', 0.02, this.music);
        if (s.soft && beat % 2 === 0) this.note(N(root + 24 + [0, third, 7, 12][(i >> 1) % 4]), t, st * 1.5, 'sine', 0.035, this.music, true);
        if (s.soft) return;
        // drums
        if (beat % 4 === 0) this.kick(t);
        if (beat % 4 === 2) this.hiss(t, 0.09, 0.12, 1800);
        this.hiss(t, 0.025, beat % 2 ? 0.035 : 0.02, 8000);
    }

    note(f, t, dur, type, vol, dest, echo = false) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        if (echo) g.connect(this.echo);
        o.start(t); o.stop(t + dur + 0.02);
    }
    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.18);
    }
    hiss(t, dur, vol, freq, dest = this.music) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(dest);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }

    /** A short jingle of notes (midi, beats). */
    jingle(notes, bpm = 220, type = 'square', vol = 0.12) {
        if (!this.ok()) return;
        let t = this.ctx.currentTime + 0.02;
        for (const [m, b] of notes) {
            const dur = (60 / bpm) * b;
            if (m != null) this.note(N(m), t, dur * 0.95, type, vol, this.sfx, true);
            t += dur;
        }
    }

    // ================================================================ effects
    ok() { return this.ctx && this.ctx.state === 'running'; }

    /** One enveloped oscillator sweep. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.15, delay = 0, echo = false, vib = 0 } = {}) {
        if (!this.ok()) return;
        const ctx = this.ctx;
        const t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (vib) {
            const l = ctx.createOscillator(), lg = ctx.createGain();
            l.frequency.value = vib; lg.gain.value = freq * 0.08;
            l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
        }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        if (echo) g.connect(this.echo);
        o.start(t); o.stop(t + dur + 0.03);
    }
    noiseHit(dur, vol, freq, type = 'bandpass', delay = 0) {
        if (!this.ok()) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }
    /** At most one of a kind per interval, so a burst of events doesn't clip. */
    limit(key, ms) {
        const now = performance.now();
        if (now - (this.lim.get(key) || 0) < ms) return false;
        this.lim.set(key, now);
        return true;
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, to: 1100, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.09, type: 'triangle', vol: 0.1 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'blow': this.tone({ freq: 320, to: 760, dur: 0.12, type: 'sine', vol: 0.18, vib: 30 }); this.noiseHit(0.08, 0.05, 1200); break;
                case 'jump': if (this.limit('jump', 60)) this.tone({ freq: 260, to: 620, dur: 0.12, type: 'square', vol: 0.07 }); break;
                case 'land': if (this.limit('land', 120)) this.noiseHit(0.05, 0.05, 300, 'lowpass'); break;
                case 'bounce': this.tone({ freq: 180, to: 720, dur: 0.22, type: 'sine', vol: 0.18, vib: 18 }); break;
                case 'trap': this.tone({ freq: 620, to: 260, dur: 0.14, type: 'sine', vol: 0.16 }); this.tone({ freq: 260, to: 520, dur: 0.12, type: 'sine', vol: 0.12, delay: 0.12 }); break;
                case 'pop':
                    if (!this.limit('pop', 30)) break;
                    if (e.kind === 'boss') { this.noiseHit(0.8, 0.4, 400, 'lowpass'); this.tone({ freq: 120, to: 40, dur: 0.8, type: 'sawtooth', vol: 0.2 }); break; }
                    this.noiseHit(0.05, 0.12, 3000);
                    this.tone({ freq: e.trapped ? 700 : 1100, to: e.trapped ? 1400 : 1800, dur: 0.07, type: 'sine', vol: e.trapped ? 0.2 : 0.1, echo: true });
                    break;
                case 'fizz': if (this.limit('fizz', 80)) this.noiseHit(0.12, 0.04, 2400); break;
                case 'chain': this.jingle(Array.from({ length: Math.min(7, e.n) }, (_, i) => [72 + i * 4, 0.5]), 360, 'triangle', 0.12); break;
                case 'kill': if (this.limit('kill', 50)) this.tone({ freq: 900, to: 300, dur: 0.25, type: 'square', vol: 0.06 }); break;
                case 'item': this.tone({ freq: 1046, dur: 0.08, type: 'triangle', vol: 0.14 }); this.tone({ freq: 1568, dur: 0.14, type: 'triangle', vol: 0.12, delay: 0.07 }); if (e.value >= 4000) this.jingle([[84, 0.5], [88, 0.5], [91, 0.5], [96, 1]], 480, 'triangle', 0.1); break;
                case 'letter': this.jingle([[84, 0.5], [91, 0.5], [96, 1]], 400, 'sine', 0.16); break;
                case 'extend': this.jingle([[72, 1], [76, 1], [79, 1], [84, 2], [79, 1], [84, 3]], 300, 'square', 0.12); break;
                case 'life': this.jingle([[76, 0.5], [79, 0.5], [88, 0.5], [84, 0.5], [86, 0.5], [91, 1]], 420, 'square', 0.1); break;
                case 'zap': this.noiseHit(0.35, 0.25, 2200); this.tone({ freq: 1800, to: 120, dur: 0.35, type: 'sawtooth', vol: 0.12 }); break;
                case 'nova': this.noiseHit(0.6, 0.2, 600, 'lowpass'); this.tone({ freq: 400, to: 90, dur: 0.5, type: 'sawtooth', vol: 0.1 }); break;
                case 'burn': this.tone({ freq: 160, to: 120, dur: 0.2, type: 'sawtooth', vol: 0.12 }); break;
                case 'escape': this.tone({ freq: 500, to: 1400, dur: 0.15, type: 'square', vol: 0.09 }); this.tone({ freq: 500, to: 1400, dur: 0.15, type: 'square', vol: 0.09, delay: 0.16 }); break;
                case 'eshot': if (this.limit('eshot', 80)) this.tone(e.kind === 'laser' ? { freq: 1600, to: 300, dur: 0.18, type: 'sawtooth', vol: 0.07 } : { freq: 200, to: 90, dur: 0.15, type: 'square', vol: 0.09 }); break;
                case 'hop': if (this.limit('hop', 150)) this.tone({ freq: 300, to: 900, dur: 0.1, type: 'sine', vol: 0.04, vib: 40 }); break;
                case 'hurry':
                    this.play(this.want, 1.35);
                    for (let i = 0; i < 4; i++) this.tone({ freq: i % 2 ? 660 : 880, dur: 0.14, type: 'square', vol: 0.12, delay: i * 0.16 });
                    break;
                case 'wraith': this.tone({ freq: 110, to: 70, dur: 1.4, type: 'sine', vol: 0.3, vib: 6 }); this.tone({ freq: 166, to: 104, dur: 1.4, type: 'sine', vol: 0.2, vib: 5 }); break;
                case 'die': this.tempo = 1; this.tone({ freq: 880, to: 110, dur: 1.0, type: 'square', vol: 0.14, vib: 9 }); break;
                case 'respawn': this.tempo = 1; break;
                case 'power': this.jingle([[72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5], [88, 0.5], [91, 1]], 600, 'triangle', 0.13); break;
                case 'powerAppear': this.tone({ freq: 1200, to: 2400, dur: 0.25, type: 'sine', vol: 0.08, echo: true }); break;
                case 'bomb': this.noiseHit(1.2, 0.4, 300, 'lowpass'); this.tone({ freq: 90, to: 30, dur: 1.2, type: 'sawtooth', vol: 0.2 }); break;
                case 'quick': this.jingle([[79, 0.5], [84, 0.5], [88, 1]], 360, 'triangle', 0.1); break;
                case 'clear': this.jingle([[72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5], [79, 0.5], [84, 1.5]], 380, 'square', 0.1); break;
                case 'warp': this.tone({ freq: 200, to: 1600, dur: 1.4, type: 'sine', vol: 0.08, vib: 7 }); break;
                case 'level': if (e.idx !== undefined) { this.tempo = 1; this.play(e.boss ? 'boss' : 'main'); } break;
                case 'go': this.jingle([[84, 0.5], [null, 0.25], [91, 1]], 300, 'square', 0.08); break;
                case 'bossThrow': this.noiseHit(0.3, 0.12, 500); break;
                case 'bossHit': this.tone({ freq: 300, to: 150, dur: 0.18, type: 'square', vol: 0.18 }); this.noiseHit(0.12, 0.15, 4000, 'highpass'); break;
                case 'bossTrap': this.tone({ freq: 500, to: 120, dur: 0.6, type: 'sine', vol: 0.25, vib: 8 }); this.stop(); break;
                case 'heart': this.jingle([[84, 1], [88, 1], [91, 1], [96, 3]], 240, 'sine', 0.15); break;
                case 'ending': this.play('title'); break;
                case 'over': this.stop(); this.jingle([[72, 1], [71, 1], [69, 1], [67, 1], [65, 2], [60, 3]], 200, 'triangle', 0.14); break;
                default: break;
            }
        }
    }
}
