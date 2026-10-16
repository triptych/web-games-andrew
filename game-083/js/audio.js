// Procedural sound, all Web Audio, no files. Effects answer simulation events; a look-ahead
// sequencer plays the score. The context is made on the first user gesture (browsers block
// audio before one), and ../lib/page-audio.js suspends it while the tab is hidden.
//
// On foot: the dragon's heavy footfalls, a low wind, Battlezone's radar ping, and a slow war
// march of drums and a horn. On the wing: rushing air, wingbeats and a fast heroic theme.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Songs in 16th-note steps. bass/lead: MIDI notes (null rests). drum: k kick, t tom, s snare, h hat.
const SONGS = {
    title: {
        bpm: 76, bassWave: 'triangle', leadWave: 'triangle', leadVol: 0.07,
        bass: [38, null, null, null, null, null, null, null, 38, null, null, null, 45, null, null, null, 41, null, null, null, null, null, null, null, 36, null, null, null, 43, null, null, null],
        lead: [62, null, null, null, 65, null, 64, null, 62, null, null, null, 57, null, null, null, 60, null, null, null, 62, null, 60, null, 57, null, null, null, null, null, null, null],
        drum: 'k...............k.......t.......',
    },
    march: {
        bpm: 92, bassWave: 'sawtooth', leadWave: 'square', leadVol: 0.045,
        bass: [38, null, 38, null, 38, null, 38, null, 38, null, 38, null, 41, null, 40, null, 38, null, 38, null, 38, null, 38, null, 36, null, 36, null, 37, null, 37, null],
        lead: [null, null, null, null, null, null, null, null, 62, null, null, 65, 64, null, 62, null, null, null, null, null, null, null, null, null, 57, null, 60, null, 61, null, null, null],
        drum: 'k..tk...k.t.s...k..tk...k.t.s.tt',
    },
    boss: {
        bpm: 128, bassWave: 'sawtooth', leadWave: 'square', leadVol: 0.05,
        bass: [38, 38, 50, 38, 38, 50, 38, 49, 39, 39, 51, 39, 39, 51, 39, 50, 38, 38, 50, 38, 38, 50, 38, 48, 37, 37, 49, 37, 36, 48, 37, 49],
        lead: [62, null, 65, null, 69, null, 68, 65, 63, null, 66, null, 70, null, 69, 66, 62, null, 65, null, 69, 70, 72, 74, 73, null, 69, null, 65, null, 61, null],
        drum: 'k.s.k.s.k.s.kks.k.s.k.s.k.s.ksss',
    },
    flight: {
        bpm: 144, bassWave: 'sawtooth', leadWave: 'square', leadVol: 0.05,
        bass: [38, 45, 50, 45, 38, 45, 50, 45, 34, 41, 46, 41, 34, 41, 46, 41, 36, 43, 48, 43, 36, 43, 48, 43, 33, 40, 45, 40, 33, 40, 45, 49],
        lead: [62, null, null, 69, null, null, 67, 69, 70, null, 69, null, 67, null, 65, null, 67, null, null, 72, null, null, 70, 69, 67, null, 65, null, 64, null, 61, null],
        drum: 'k.h.s.h.k.hks.h.k.h.s.h.k.hks.hs',
    },
    victory: {
        bpm: 120, bassWave: 'triangle', leadWave: 'square', leadVol: 0.06,
        bass: [38, null, 45, null, 50, null, 45, null, 43, null, 50, null, 55, null, 50, null, 45, null, 52, null, 57, null, 52, null, 50, null, 57, null, 62, null, null, null],
        lead: [62, null, 66, null, 69, null, 74, null, 71, null, 67, null, 71, 74, 76, null, 73, null, 69, null, 64, 67, 69, null, 74, null, null, null, 74, null, null, null],
        drum: 'k...s...k...s...k...s...k.k.s.ss',
    },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.song = null;
        this.wanted = null;
        this.step = 0;
        this.nextT = 0;
        this.gait = 0;
        this.pingT = 0;
        this.flapT = 0;
        this.lastT = {};
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.6; this.music.connect(comp);
        // one second of noise, reused by every noisy sound
        const n = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        // the wind: looping noise through a band-pass whose level follows the act
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf; src.loop = true;
        this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = 0.7;
        this.windG = ctx.createGain(); this.windG.gain.value = 0;
        src.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.sfx);
        src.start();
        if (this.wanted) this.playSong(this.wanted);
    }

    ready() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.6, this.ctx.currentTime, 0.02);
    }

    /** Don't stack the same sound more often than every gap seconds. */
    limit(key, gap) {
        const now = this.ctx.currentTime;
        if (now - (this.lastT[key] ?? -1) < gap) return false;
        this.lastT[key] = now;
        return true;
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, attack = 0.01, out = null } = {}) {
        if (!this.ready()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise({ dur = 0.2, vol = 0.2, f0 = 2000, f1 = f0, type = 'lowpass', q = 0.8, delay = 0, attack = 0.005, out = null } = {}) {
        if (!this.ready()) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out || this.sfx);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.06 });
        else if (kind === 'open') this.tone({ freq: 440, to: 880, dur: 0.08, type: 'square', vol: 0.06 });
        else if (kind === 'close') this.tone({ freq: 880, to: 440, dur: 0.08, type: 'square', vol: 0.06 });
    }

    // ------------------------------------------------------------------ music
    playSong(name) {
        this.wanted = name;
        if (!this.ctx || this.song === name) return;
        this.song = name;
        this.step = 0;
        this.nextT = this.ctx.currentTime + 0.08;
    }

    stopSong() { this.song = null; this.wanted = null; }

    pump() {
        if (!this.ready() || !this.song) return;
        const S = SONGS[this.song];
        const dt = 60 / S.bpm / 4;
        const ahead = this.ctx.currentTime + 0.15;
        if (this.nextT < this.ctx.currentTime - 0.3) this.nextT = this.ctx.currentTime + 0.02;
        while (this.nextT < ahead) {
            const i = this.step % 32, t = this.nextT - this.ctx.currentTime;
            const bn = S.bass[i], ln = S.lead[i], dr = S.drum[i];
            if (bn != null) this.tone({ freq: mtof(bn), dur: dt * 1.8, type: S.bassWave, vol: 0.09, delay: t, out: this.music });
            if (ln != null) {
                this.tone({ freq: mtof(ln), dur: dt * 3.2, type: S.leadWave, vol: S.leadVol, delay: t, attack: 0.02, out: this.music });
                this.tone({ freq: mtof(ln) * 1.005, dur: dt * 3.2, type: 'triangle', vol: S.leadVol * 0.8, delay: t, attack: 0.03, out: this.music });
            }
            if (dr === 'k') this.tone({ freq: 120, to: 40, dur: 0.22, type: 'sine', vol: 0.35, delay: t, out: this.music });
            else if (dr === 't') this.tone({ freq: 180, to: 90, dur: 0.18, type: 'sine', vol: 0.22, delay: t, out: this.music });
            else if (dr === 's') this.noise({ dur: 0.12, vol: 0.12, f0: 3000, f1: 1200, type: 'bandpass', delay: t, out: this.music });
            else if (dr === 'h') this.noise({ dur: 0.04, vol: 0.05, f0: 8000, type: 'highpass', delay: t, out: this.music });
            this.nextT += dt;
            this.step++;
        }
    }

    // ------------------------------------------------------------------ per frame
    /** Continuous sound that follows the game: footfalls, wind, the radar ping, the wingbeats. */
    update(G, dt, playing) {
        this.pump();
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        let wind = 0, wf = 400;
        if (playing && G.mode === 'ground') {
            const p = G.player;
            wind = 0.05;
            if (Math.abs(p.speed) > 0.5) {
                this.gait += dt * Math.abs(p.speed) * 0.7;
                if (this.gait > Math.PI) {
                    this.gait -= Math.PI;
                    this.tone({ freq: 70, to: 38, dur: 0.22, type: 'sine', vol: 0.32 });
                    this.noise({ dur: 0.12, vol: 0.06, f0: 300, f1: 120 });
                }
            }
            // Battlezone's ping, once a sweep, while anything is on the radar
            this.pingT += dt;
            if (this.pingT > (Math.PI * 2) / 2.2) {
                this.pingT = 0;
                if (G.phase === 'play' && G.enemies.length) this.tone({ freq: 1320, to: 1300, dur: 0.12, type: 'sine', vol: 0.05 });
            }
            if (G.phase === 'ascend') { wind = 0.25 * (1 - G.phaseT / 6.5); wf = 700; }
        } else if (playing && G.mode === 'flight') {
            wind = 0.12 + Math.min(0.08, Math.hypot(G.player.vx, G.player.vy) * 0.004);
            wf = 900 + G.player.py * 10;
            this.flapT += dt;
            if (this.flapT > 2 * Math.PI / 2.4) {
                this.flapT = 0;
                this.noise({ dur: 0.35, vol: 0.12, f0: 300, f1: 900, type: 'bandpass', attack: 0.15 });
            }
        }
        this.windG.gain.setTargetAtTime(wind, now, 0.3);
        this.windF.frequency.setTargetAtTime(wf, now, 0.3);
    }

    onEvents(G, events) {
        if (!this.ready()) return;
        const flight = G.mode === 'flight';
        for (const e of events) {
            switch (e.type) {
                case 'fire':
                    if (e.mode === 'ground') {
                        this.noise({ dur: 0.45, vol: 0.3, f0: 1800, f1: 200 });
                        this.tone({ freq: 140, to: 60, dur: 0.35, type: 'sawtooth', vol: 0.12 });
                    } else if (this.limit('fire', 0.1)) {
                        this.noise({ dur: 0.12, vol: 0.13, f0: 3500, f1: 900 });
                        this.tone({ freq: 620, to: 180, dur: 0.1, type: 'square', vol: 0.05 });
                    }
                    break;
                case 'kill':
                    if (e.kind === 'dragonbane' || e.kind === 'wardstone') {
                        this.noise({ dur: 2.2, vol: 0.5, f0: 1200, f1: 50 });
                        this.tone({ freq: 90, to: 25, dur: 1.8, type: 'sawtooth', vol: 0.3 });
                    } else {
                        this.noise({ dur: 0.8, vol: 0.35, f0: flight ? 2400 : 1400, f1: 80 });
                        this.tone({ freq: 160, to: 40, dur: 0.5, type: 'sine', vol: 0.3 });
                        if (e.score) this.tone({ freq: 660, to: 1320, dur: 0.12, type: 'square', vol: 0.04, delay: 0.05 });
                    }
                    if (e.kind === 'wisp') [988, 1319, 1568, 1976].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.08, delay: i * 0.07 }));
                    break;
                case 'hit':
                    this.tone({ freq: 300, to: 120, dur: 0.15, type: 'square', vol: 0.12 });
                    this.noise({ dur: 0.15, vol: 0.12, f0: 2500, f1: 500 });
                    break;
                case 'shotHit':
                    if (this.limit('shotHit', 0.08)) this.noise({ dur: 0.15, vol: 0.1, f0: 1500, f1: 300 });
                    break;
                case 'foeShot':
                    this.noise({ dur: 0.3, vol: 0.18, f0: 2500, f1: 300 });
                    this.tone({ freq: 900, to: 300, dur: 0.15, type: 'triangle', vol: 0.08 });
                    break;
                case 'enemyFire':
                    if (!this.limit('ef' + e.foe, 0.12)) break;
                    if (e.foe === 'bolt') { this.tone({ freq: 220, to: 110, dur: 0.18, type: 'triangle', vol: 0.18 }); this.noise({ dur: 0.08, vol: 0.12, f0: 4000, type: 'highpass' }); }
                    else if (e.foe === 'spear') this.noise({ dur: 0.25, vol: 0.08, f0: 900, f1: 2500, type: 'bandpass' });
                    else if (e.foe === 'orb') { this.tone({ freq: 520, to: 780, dur: 0.4, type: 'sine', vol: 0.1 }); this.tone({ freq: 523 * 1.5, to: 1040, dur: 0.4, type: 'sine', vol: 0.06 }); }
                    else this.noise({ dur: 0.35, vol: 0.12, f0: 900, f1: 250, type: 'bandpass', q: 2 });
                    break;
                case 'hurt':
                    this.noise({ dur: 0.5, vol: 0.4, f0: 3000, f1: 200 });
                    this.tone({ freq: 110, to: 55, dur: 0.4, type: 'sawtooth', vol: 0.25 });
                    break;
                case 'dead':
                    this.noise({ dur: 1.4, vol: 0.45, f0: 6000, f1: 100, type: 'highpass' });
                    this.tone({ freq: 300, to: 30, dur: 2, type: 'sawtooth', vol: 0.25 });
                    this.stopSong();
                    break;
                case 'teleport':
                    this.tone({ freq: 300, to: 1500, dur: 0.3, type: 'sine', vol: 0.08 });
                    break;
                case 'smash':
                    this.tone({ freq: 90, to: 30, dur: 0.4, type: 'sine', vol: 0.45 });
                    break;
                case 'bump':
                    this.tone({ freq: 80, to: 50, dur: 0.15, type: 'sine', vol: 0.2 });
                    break;
                case 'crash':
                    this.noise({ dur: 0.5, vol: 0.35, f0: 2000, f1: 150 });
                    break;
                case 'wisp':
                    [1568, 1319, 1568, 1976].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'sine', vol: 0.05, delay: i * 0.12 }));
                    break;
                case 'stage':
                    this.playSong(e.mode === 'flight' ? 'flight' : e.id === 'boss' ? 'boss' : 'march');
                    this.tone({ freq: 392, dur: 0.15, type: 'square', vol: 0.06 });
                    this.tone({ freq: 523, dur: 0.3, type: 'square', vol: 0.06, delay: 0.15 });
                    break;
                case 'clear':
                case 'bonus':
                    [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'square', vol: 0.06, delay: i * 0.09 }));
                    break;
                case 'ascend':
                    this.stopSong();
                    this.tone({ freq: 110, to: 880, dur: 5.5, type: 'sawtooth', vol: 0.08, attack: 1 });
                    this.tone({ freq: 165, to: 1320, dur: 5.5, type: 'triangle', vol: 0.08, attack: 1 });
                    [50, 57, 62, 66, 69, 74].forEach((m, i) => this.tone({ freq: mtof(m), dur: 1.4, type: 'triangle', vol: 0.07, delay: 1.2 + i * 0.5, attack: 0.1 }));
                    break;
                case 'gate':
                    this.noise({ dur: 2.5, vol: 0.5, f0: 5000, f1: 60 });
                    break;
                case 'missed':
                    this.tone({ freq: 400, to: 100, dur: 0.9, type: 'square', vol: 0.12 });
                    break;
                case 'victory':
                    this.playSong('victory');
                    break;
            }
        }
    }
}
