// Procedural sound, all Web Audio, no files. Effects answer simulation events.
// Music: a look-ahead sequencer (a 25 ms timer schedules sixteenth notes on the audio clock)
// playing original dark synthwave: a driving minor theme on the ship, a slower, stranger one on
// the homeworld, a boss theme, a title theme and an ending. The context is made on the first user
// gesture, and ../lib/page-audio.js suspends it while the tab is hidden.

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// 16 steps per bar; chords are root midi notes, one per bar; lead is per step (null = rest)
const SONGS = {
    ship: {
        bpm: 128, chords: [45, 45, 41, 43, 45, 45, 48, 43], minor: true, bass: 'drive',
        lead: [
            69, _, _, 72, _, _, 76, _, 74, _, 72, _, 71, _, 72, _,
            69, _, _, _, _, _, _, _, 64, _, 67, _, 69, _, 71, _,
            72, _, _, 71, _, _, 69, _, 65, _, _, _, 64, _, 65, _,
            67, _, _, _, 71, _, 74, _, 72, _, 71, _, 67, _, _, _,
        ],
    },
    alien: {
        bpm: 112, chords: [40, 40, 41, 41, 38, 38, 39, 43], minor: true, bass: 'pulse', eerie: true,
        lead: [
            76, _, _, _, 75, _, _, _, 71, _, _, _, 72, _, _, _,
            _, _, 76, _, _, _, 79, _, 78, _, _, _, _, _, _, _,
            77, _, _, _, 76, _, _, _, 72, _, _, _, 71, _, _, _,
            _, _, 74, _, 75, _, _, _, 71, _, _, _, _, _, _, _,
        ],
    },
    boss: {
        bpm: 150, chords: [40, 40, 41, 39, 40, 40, 43, 42], minor: true, bass: 'drive', hard: true,
        lead: [
            76, _, 76, _, 79, _, 76, _, 81, _, 79, _, 76, _, 74, _,
            75, _, 75, _, 78, _, 75, _, 81, _, 80, _, 78, _, 75, _,
            76, _, 76, _, 79, _, 76, _, 83, _, 81, _, 79, _, 76, _,
            77, _, 76, _, 74, _, 72, _, 71, _, _, _, 75, _, _, _,
        ],
    },
    title: {
        bpm: 92, chords: [45, 41, 48, 43, 45, 41, 40, 40], minor: true, bass: 'soft', soft: true,
        lead: [
            76, _, _, _, _, _, 74, _, 72, _, _, _, 69, _, _, _,
            72, _, _, _, _, _, 71, _, 67, _, _, _, _, _, _, _,
            76, _, _, _, _, _, 79, _, 81, _, _, _, 79, _, 76, _,
            74, _, _, _, 71, _, _, _, 68, _, _, _, _, _, _, _,
        ],
    },
    ending: {
        bpm: 84, chords: [48, 43, 45, 41, 48, 43, 41, 43], minor: false, bass: 'soft', soft: true,
        lead: [
            79, _, _, _, 76, _, _, _, 74, _, 76, _, 79, _, _, _,
            81, _, _, _, 79, _, _, _, 76, _, _, _, _, _, _, _,
            77, _, _, _, 76, _, _, _, 74, _, 72, _, 74, _, _, _,
            76, _, _, _, 74, _, _, _, 72, _, _, _, _, _, _, _,
        ],
    },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.song = null;
        this.want = null;
        this.lim = new Map();
        this.muted = false;          // the attract mode behind the title is silent
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 5;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.38; this.music.connect(comp);
        this.echo = ctx.createDelay(0.6); this.echo.delayTime.value = 0.32;
        const fb = ctx.createGain(); fb.gain.value = 0.35;
        const eo = ctx.createGain(); eo.gain.value = 0.32;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(eo); eo.connect(comp);
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.step = 0;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.38, this.ctx.currentTime, 0.05);
    }

    // ================================================================ music
    play(id) {
        if (this.want === id && (this.song?.id === id || !this.ctx)) return;
        this.want = id;
        if (!this.ctx) return;
        this.song = id ? { id, ...SONGS[id] } : null;
        this.step = 0;
        this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.08);
    }
    stop() { this.song = null; this.want = null; }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || !this.song) return;
        const st = 60 / this.song.bpm / 4;
        if (this.nextT < ctx.currentTime - 0.2) { const skip = Math.ceil((ctx.currentTime - this.nextT) / st); this.step += skip; this.nextT += skip * st; }
        while (this.nextT < ctx.currentTime + 0.12) {
            this.playStep(this.step, this.nextT, st);
            this.nextT += st;
            this.step++;
        }
    }

    playStep(i, t, st) {
        const s = this.song;
        const k = i % 128, bar = Math.floor(k / 16), beat = k % 16;
        const root = s.chords[bar];
        const third = s.minor ? 3 : 4;
        const n = s.lead[k % 64];
        if (n != null && !(s.eerie && bar % 2 === 1 && beat > 8)) {
            const leadOct = bar >= 4 && !s.soft ? 12 : 0;
            this.note(N(n + leadOct), t, st * (s.soft ? 5 : 3), s.soft ? 'triangle' : 'sawtooth', s.soft ? 0.06 : 0.035, this.music, true, s.soft ? 0 : 1800);
        }
        // bass
        if (s.bass === 'drive') { if (beat % 2 === 0) this.note(N(root - 12 + (beat % 8 === 6 ? 12 : 0)), t, st * 1.6, 'sawtooth', 0.11, this.music, false, 700); }
        else if (s.bass === 'pulse') { if (beat % 4 === 0 || beat === 10) this.note(N(root - 12), t, st * 3, 'sawtooth', 0.12, this.music, false, 500); }
        else if (beat === 0 || beat === 8) this.note(N(root - 12), t, st * 7, 'triangle', 0.14, this.music);
        // arpeggio shimmer
        const arp = [0, third, 7, 12, 7, third];
        if (!s.soft && beat % 2 === 1) this.note(N(root + 24 + arp[(i >> 1) % arp.length]), t, st * 0.9, 'square', 0.014, this.music, true);
        if (s.soft && beat % 4 === 0) this.note(N(root + 12 + arp[(i >> 2) % arp.length]), t, st * 6, 'sine', 0.04, this.music, true);
        if (s.eerie && beat === 0 && bar % 2 === 0) this.note(N(root + 18), t, st * 14, 'sine', 0.03, this.music, true);
        if (s.soft) return;
        // drums
        if (beat % 4 === 0 || (s.hard && beat === 14)) this.kick(t);
        if (beat === 4 || beat === 12) this.hiss(t, 0.14, 0.13, 1500);
        if (beat % 2 === 0 || s.hard) this.hiss(t, 0.03, beat % 4 === 2 ? 0.04 : 0.018, 7000);
    }

    note(f, t, dur, type, vol, dest, echo = false, cutoff = 0) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let src = o;
        if (cutoff) {
            const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
            fl.frequency.setValueAtTime(cutoff * 2, t); fl.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + dur);
            o.connect(fl); src = fl;
        }
        src.connect(g); g.connect(dest);
        if (echo) g.connect(this.echo);
        o.start(t); o.stop(t + dur + 0.02);
    }
    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.22);
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

    jingle(notes, bpm = 220, type = 'square', vol = 0.1) {
        if (!this.ok()) return;
        let t = this.ctx.currentTime + 0.02;
        for (const [m, b] of notes) {
            const dur = (60 / bpm) * b;
            if (m != null) this.note(N(m), t, dur * 0.95, type, vol, this.sfx, true);
            t += dur;
        }
    }

    // ================================================================ effects
    ok() { return this.ctx && this.ctx.state === 'running' && !this.muted; }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.15, delay = 0, echo = false } = {}) {
        if (!this.ok()) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        if (echo) g.connect(this.echo);
        o.start(t); o.stop(t + dur + 0.03);
    }
    noiseHit(dur, vol, freq, type = 'bandpass', delay = 0, q = 0.8) {
        if (!this.ok()) return;
        const ctx = this.ctx, t = ctx.currentTime + delay;
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }
    boom(size = 1) {
        this.noiseHit(0.5 * size, 0.35 * Math.min(1.4, size), 380, 'lowpass');
        this.tone({ freq: 110, to: 34, dur: 0.45 * size, type: 'sine', vol: 0.32 });
        this.noiseHit(0.12, 0.12, 2500, 'bandpass', 0.01);
    }
    limit(key, ms) {
        const now = performance.now();
        if (now - (this.lim.get(key) || 0) < ms) return false;
        this.lim.set(key, now);
        return true;
    }

    ui(kind) {
        if (this.muted) return;
        if (kind === 'click') this.tone({ freq: 880, to: 1320, dur: 0.05, type: 'square', vol: 0.06 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.09, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.09, type: 'triangle', vol: 0.1 });
    }

    onEvents(G, events) {
        if (this.muted) return;
        for (const e of events) {
            switch (e.type) {
                case 'shot':
                    if (!this.limit('shot', 45)) break;
                    if (e.k === 'blaster') { this.tone({ freq: 1500, to: 380, dur: 0.07, type: 'square', vol: 0.05 }); this.noiseHit(0.03, 0.04, 3000); }
                    else if (e.k === 'spread') { this.tone({ freq: 900, to: 200, dur: 0.1, type: 'sawtooth', vol: 0.06 }); this.noiseHit(0.06, 0.08, 1800); }
                    else if (e.k === 'laser') { this.tone({ freq: 2400, to: 600, dur: 0.18, type: 'sawtooth', vol: 0.06, echo: true }); this.tone({ freq: 1200, to: 300, dur: 0.18, type: 'square', vol: 0.04 }); }
                    else { this.noiseHit(0.3, 0.14, 700, 'lowpass'); this.tone({ freq: 220, to: 90, dur: 0.25, type: 'sawtooth', vol: 0.08 }); }
                    break;
                case 'spark': if (this.limit('spark', 70)) this.noiseHit(0.03, 0.04, 4200); break;
                case 'ehit': if (this.limit('ehit', 40)) { this.tone({ freq: 260, to: 140, dur: 0.06, type: 'square', vol: 0.06 }); this.noiseHit(0.04, 0.05, 1500); } break;
                case 'kill':
                    if (!this.limit('kill', 40)) break;
                    if (e.k === 'missile') { this.boom(0.6); break; }
                    this.noiseHit(0.18, 0.16, e.k === 'brute' || e.k === 'nest' ? 400 : 900, 'bandpass', 0, 1.2);
                    this.tone({ freq: e.k === 'brute' ? 140 : 340, to: 60, dur: 0.22, type: 'sawtooth', vol: 0.08 });
                    break;
                case 'boom': if (this.limit('boom', 60)) this.boom(Math.min(1.6, e.r / 1.6)); break;
                case 'hurt': this.tone({ freq: 300, to: 80, dur: 0.25, type: 'square', vol: 0.14 }); this.noiseHit(0.12, 0.14, 900); break;
                case 'die': this.boom(1.4); this.tone({ freq: 660, to: 70, dur: 1.0, type: 'sawtooth', vol: 0.12 }); break;
                case 'respawn': this.tone({ freq: 200, to: 1200, dur: 0.6, type: 'sine', vol: 0.12, echo: true }); break;
                case 'rescue': this.jingle([[72, 0.5], [76, 0.5], [79, 0.5], [84, 1.5]], 420, 'triangle', 0.13); this.tone({ freq: 300, to: 2400, dur: 1.0, type: 'sine', vol: 0.06, echo: true }); break;
                case 'podHit': if (this.limit('pod', 60)) this.noiseHit(0.06, 0.08, 1200, 'bandpass', 0, 2); break;
                case 'pickup':
                    if (e.k === 'med') this.jingle([[76, 0.5], [83, 0.5], [88, 1]], 480, 'triangle', 0.12);
                    else if (e.k === 'flare') this.jingle([[67, 0.5], [74, 1]], 400, 'square', 0.08);
                    else this.jingle([[64, 0.4], [71, 0.4], [76, 0.4], [83, 1.2]], 520, 'sawtooth', 0.07);
                    break;
                case 'jump': if (this.limit('jump', 80)) this.tone({ freq: 180, to: 420, dur: 0.1, type: 'square', vol: 0.04 }); break;
                case 'land': if (e.v > 10 && this.limit('land', 100)) this.noiseHit(0.06, 0.06, 260, 'lowpass'); break;
                case 'splash': this.noiseHit(0.3, 0.12, 2000, 'bandpass', 0, 3); this.tone({ freq: 900, to: 300, dur: 0.2, type: 'sine', vol: 0.06 }); break;
                case 'esplash': if (this.limit('esplash', 90)) this.noiseHit(0.08, 0.04, e.k === 'acid' ? 2600 : 3800); break;
                case 'vent': this.noiseHit(1.3, 0.06, 5000, 'highpass'); break;
                case 'flareThrow': this.tone({ freq: 500, to: 900, dur: 0.12, type: 'triangle', vol: 0.06 }); this.noiseHit(1.2, 0.03, 6000, 'highpass', 0.05); break;
                case 'flareBounce': if (this.limit('fb', 80)) this.tone({ freq: 1200, to: 900, dur: 0.04, type: 'square', vol: 0.03 }); break;
                case 'cleared': this.tone({ freq: 1800, to: 3000, dur: 0.3, type: 'sine', vol: 0.06, echo: true }); break;
                case 'checkpoint': this.jingle([[79, 0.5], [86, 1]], 360, 'triangle', 0.1); break;
                case 'eshot': if (this.limit('eshot', 70)) this.tone({ freq: 700, to: 200, dur: 0.12, type: 'sawtooth', vol: 0.05 }); break;
                case 'spit': if (this.limit('spit', 90)) { this.noiseHit(0.15, 0.08, 900, 'bandpass', 0, 4); this.tone({ freq: 160, to: 320, dur: 0.12, type: 'sine', vol: 0.08 }); } break;
                case 'hatch': if (this.limit('hatch', 120)) this.noiseHit(0.2, 0.08, 700, 'bandpass', 0, 3); break;
                case 'leap': if (this.limit('leap', 200)) this.tone({ freq: 900, to: 1500, dur: 0.08, type: 'sawtooth', vol: 0.03 }); break;
                case 'dive': if (this.limit('dive', 200)) this.tone({ freq: 1400, to: 500, dur: 0.3, type: 'sine', vol: 0.04 }); break;
                case 'roar':
                    this.tone({ freq: e.k === 'queen' ? 90 : 130, to: e.k === 'queen' ? 50 : 70, dur: 1.1, type: 'sawtooth', vol: 0.16 });
                    this.noiseHit(1.0, 0.12, 300, 'bandpass', 0, 1.5);
                    break;
                case 'charge': this.noiseHit(0.5, 0.1, 200, 'lowpass'); break;
                case 'launch': this.noiseHit(0.5, 0.1, 1200, 'bandpass'); this.tone({ freq: 300, to: 900, dur: 0.4, type: 'sawtooth', vol: 0.05 }); break;
                case 'slam': this.boom(1.2); break;
                case 'rumble': if (this.limit('rumble', 200)) this.noiseHit(0.3, 0.12, 90, 'lowpass'); break;
                case 'erupt': this.boom(1.3); this.tone({ freq: 80, to: 200, dur: 0.6, type: 'sawtooth', vol: 0.12 }); break;
                case 'ring': this.tone({ freq: 600, to: 1200, dur: 0.2, type: 'sawtooth', vol: 0.07 }); break;
                case 'warn': this.tone({ freq: 1200, dur: 0.1, type: 'square', vol: 0.06 }); this.tone({ freq: 1200, dur: 0.1, type: 'square', vol: 0.06, delay: 0.18 }); this.tone({ freq: 1200, dur: 0.1, type: 'square', vol: 0.06, delay: 0.36 }); break;
                case 'beam': this.tone({ freq: 220, to: 180, dur: 0.6, type: 'sawtooth', vol: 0.14 }); this.noiseHit(0.6, 0.12, 2500, 'bandpass', 0, 0.6); break;
                case 'bhit': if (this.limit('bhit', 60)) this.tone({ freq: 200, to: 120, dur: 0.05, type: 'square', vol: 0.05 }); break;
                case 'phase': this.boom(1); this.tone({ freq: 400, to: 100, dur: 0.8, type: 'sawtooth', vol: 0.12 }); break;
                case 'supply': this.tone({ freq: 1600, to: 400, dur: 0.6, type: 'sine', vol: 0.08, echo: true }); break;
                case 'bossIntro': this.play('boss'); break;
                case 'bossDown': this.stop(); this.boom(2); this.jingle([[60, 1], [67, 1], [72, 1], [76, 1], [79, 3]], 260, 'sawtooth', 0.08); break;
                case 'clear': this.stop(); this.jingle([[72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5], [83, 0.5], [84, 2]], 300, 'square', 0.08); break;
                case 'won': this.play('ending'); break;
                case 'extraLife': this.jingle([[72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5], [88, 1.5]], 520, 'square', 0.1); break;
                case 'over': this.stop(); this.jingle([[69, 1], [68, 1], [67, 1], [66, 1], [65, 3]], 180, 'sawtooth', 0.09); break;
                case 'fall': this.tone({ freq: 600, to: 100, dur: 0.4, type: 'sine', vol: 0.08 }); break;
                default: break;
            }
        }
    }
}
