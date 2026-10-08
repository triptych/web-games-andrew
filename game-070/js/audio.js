// Audio: every sound is synthesised with Web Audio. During a normal wave the only
// "music" is a two-note heartbeat that speeds up as the wave wears on and the
// Reapers thin out. Bosses, the title and the ending have short looping tunes
// played by a lookahead sequencer. The thrust rumble is one looping noise source
// whose level follows the ship. A compressor and per-sound rate limits keep a
// smart bomb from clipping.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Songs: bpm, 16th-note steps. bass/lead are MIDI notes (null = rest).
const SONGS = {
    title: {
        bpm: 118, wave: 'square',
        bass: [45, null, 45, 57, 45, null, 45, 55, 41, null, 41, 53, 41, null, 43, 55, 43, null, 43, 55, 43, null, 43, 55, 40, null, 40, 52, 40, null, 44, 56],
        lead: [69, null, null, 72, null, 76, null, 74, 72, null, 69, null, 67, null, null, null, 67, null, null, 71, null, 74, null, 72, 71, null, 68, null, 64, null, null, null],
    },
    boss: {
        bpm: 150, wave: 'sawtooth',
        bass: [40, 40, 52, 40, 40, 52, 40, 50, 41, 41, 53, 41, 41, 53, 41, 51, 40, 40, 52, 40, 40, 52, 40, 50, 39, 39, 51, 39, 38, 50, 39, 51],
        lead: [64, null, 67, null, 71, null, 70, 67, 65, null, 68, null, 72, null, 71, 68, 64, null, 67, null, 71, 72, 74, 76, 75, null, 71, null, 67, null, 63, null],
    },
    ending: {
        bpm: 124, wave: 'triangle',
        bass: [48, null, 55, null, 52, null, 55, null, 53, null, 57, null, 60, null, 57, null, 55, null, 59, null, 62, null, 59, null, 48, null, 55, null, 60, null, null, null],
        lead: [72, null, 76, null, 79, null, 84, null, 81, null, 77, null, 81, 84, 86, null, 83, null, 79, null, 74, 77, 79, null, 84, null, null, null, 84, null, null, null],
    },
};

class Audio {
    constructor() {
        this.ctx = null;
        this.sound = true; this.music = true;
        this.limits = new Map();
        this.song = null; this.step = 0; this.nextT = 0;
        this.beatT = 0; this.beatI = 0;
        this.thrustLevel = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -16; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.22;
        this.master = ctx.createGain(); this.master.gain.value = 0.6;
        this.sfx = ctx.createGain(); this.mus = ctx.createGain();
        this.sfx.gain.value = this.sound ? 0.9 : 0; this.mus.gain.value = this.music ? 0.45 : 0;
        this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.19;
        this.fb = ctx.createGain(); this.fb.gain.value = 0.3;
        this.dl = ctx.createBiquadFilter(); this.dl.type = 'lowpass'; this.dl.frequency.value = 2600;
        this.delay.connect(this.dl); this.dl.connect(this.fb); this.fb.connect(this.delay); this.dl.connect(this.sfx);
        this.sfx.connect(this.comp); this.mus.connect(this.comp); this.comp.connect(this.master); this.master.connect(ctx.destination);
        const len = ctx.sampleRate * 2;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // thrust: looping filtered noise, level driven every frame
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        this.thrustF = ctx.createBiquadFilter(); this.thrustF.type = 'lowpass'; this.thrustF.frequency.value = 420; this.thrustF.Q.value = 2;
        this.thrustG = ctx.createGain(); this.thrustG.gain.value = 0;
        src.connect(this.thrustF); this.thrustF.connect(this.thrustG); this.thrustG.connect(this.sfx);
        src.start();
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
        });
    }

    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    ready() { return !!this.ctx && this.ctx.state === 'running'; }

    setSound(on) { this.sound = on; if (this.sfx) this.sfx.gain.value = on ? 0.9 : 0; }
    setMusic(on) { this.music = on; if (this.mus) this.mus.gain.value = on ? 0.45 : 0; }

    limit(key, gap) {
        const t = this.now, last = this.limits.get(key) ?? -1;
        if (t - last < gap) return false;
        this.limits.set(key, t);
        return true;
    }

    // ================================================================== voices
    tone(at, f, o = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        const dur = o.dur ?? 0.1, vol = o.vol ?? 0.2;
        const osc = ctx.createOscillator();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(f, t);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide ?? dur));
        const g = ctx.createGain();
        const a = o.attack ?? 0.004;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + a);
        if (o.hold) g.gain.setValueAtTime(vol, t + a + o.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = osc;
        if (o.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = o.q ?? 1; osc.connect(lp); node = lp; }
        if (o.vib) {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = o.vib; lg.gain.value = f * (o.vibAmt ?? 0.03);
            lfo.connect(lg); lg.connect(osc.frequency);
            lfo.start(t); lfo.stop(t + dur + 0.05);
        }
        node.connect(g);
        g.connect(o.dest || this.sfx);
        if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(this.delay); }
        osc.start(t); osc.stop(t + dur + 0.05);
    }

    noise(at, o = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        const dur = o.dur ?? 0.1;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.playbackRate.value = o.rate ?? 1;
        const f = ctx.createBiquadFilter();
        f.type = o.filter || 'lowpass';
        f.frequency.setValueAtTime(o.f ?? 2000, t);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
        f.Q.value = o.q ?? 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(o.vol ?? 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(o.dest || this.sfx);
        src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    }

    // ================================================================== continuous
    setThrust(level) {
        if (!this.ctx) return;
        const v = Math.max(0, Math.min(1, level));
        this.thrustLevel += (v - this.thrustLevel) * 0.25;
        const t = this.ctx.currentTime;
        this.thrustG.gain.setTargetAtTime(this.thrustLevel * 0.22, t, 0.03);
        this.thrustF.frequency.setTargetAtTime(260 + this.thrustLevel * 520, t, 0.05);
    }

    /** The heartbeat: call every frame during a wave. tension 0..1 sets the tempo. */
    heartbeat(dt, tension) {
        if (!this.ready()) return;
        const interval = 1.05 - Math.max(0, Math.min(1, tension)) * 0.78;
        this.beatT += dt;
        if (this.beatT < interval) return;
        this.beatT = 0;
        this.beatI++;
        const f = this.beatI % 2 ? 58 : 52;
        const t = this.now + 0.02;
        this.tone(t, f * 1.6, { type: 'sine', f2: f, glide: 0.08, dur: 0.22, vol: 0.38, dest: this.mus });
        this.tone(t, f * 2, { type: 'square', f2: f, glide: 0.05, dur: 0.07, vol: 0.06, lp: 400, dest: this.mus });
    }

    resetBeat() { this.beatT = 0; }

    /** Looping tunes: call every frame with the song name (or null to stop). */
    playSong(name) {
        if (!this.ready()) return;
        if (name !== this.song) { this.song = name; this.step = 0; this.nextT = this.now + 0.08; }
        if (!name) return;
        const S = SONGS[name];
        const st = 60 / S.bpm / 4;
        while (this.nextT < this.now + 0.12) {
            const i = this.step % S.bass.length;
            const b = S.bass[i], l = S.lead[i];
            if (b != null) this.tone(this.nextT, mtof(b), { type: name === 'boss' ? 'sawtooth' : 'triangle', dur: st * 1.6, vol: 0.2, lp: name === 'boss' ? 700 : 1400, dest: this.mus });
            if (l != null) this.tone(this.nextT, mtof(l), { type: S.wave, dur: st * 2.2, vol: 0.075, lp: 2600, dest: this.mus, vib: 6, vibAmt: 0.006 });
            if (name === 'boss' && i % 4 === 0) this.noise(this.nextT, { dur: 0.08, f: 180, vol: 0.35, dest: this.mus });
            if (name === 'boss' && i % 8 === 4) this.noise(this.nextT, { dur: 0.1, f: 3000, filter: 'highpass', vol: 0.12, dest: this.mus });
            if (name !== 'boss' && i % 8 === 0) this.tone(this.nextT, 60, { type: 'sine', f2: 40, dur: 0.15, vol: 0.25, dest: this.mus });
            this.nextT += st;
            this.step++;
        }
    }

    stopLoops() { this.setThrust(0); if (this.thrustG && this.ctx) { this.thrustLevel = 0; this.thrustG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); } }

    // ================================================================== effects
    onEvent(e) {
        if (!this.ctx || !this.sound) return;
        const t = this.now + 0.01;
        switch (e.type) {
            case 'fire':
                if (!this.limit('fire', 0.035)) return;
                this.tone(t, 2200, { type: 'sawtooth', f2: 260, dur: 0.14, vol: 0.09, lp: 5000 });
                this.tone(t, 3200, { type: 'square', f2: 900, dur: 0.05, vol: 0.04 });
                break;
            case 'shot':
                if (!this.limit('shot', 0.07)) return;
                this.tone(t, 1100, { type: 'square', f2: 700, dur: 0.06, vol: 0.035 });
                break;
            case 'explode': {
                if (e.quiet || !this.limit('boom', 0.03)) return;
                const s = e.size ?? 1;
                if (e.kind === 'mine') { this.noise(t, { dur: 0.12, f: 2400, vol: 0.12 }); return; }
                this.noise(t, { dur: 0.25 + s * 0.25, f: 3200, f2: 160, vol: 0.22 + s * 0.08 });
                this.tone(t, 180, { type: 'sine', f2: 40, dur: 0.25 + s * 0.15, vol: 0.2 });
                if (e.kind === 'hive') this.tone(t, 900, { type: 'square', f2: 200, dur: 0.3, vol: 0.06 });
                break;
            }
            case 'playerDie':
                this.noise(t, { dur: 1.8, f: 4000, f2: 90, vol: 0.45 });
                this.tone(t, 700, { type: 'sawtooth', f2: 35, dur: 1.5, vol: 0.18, vib: 14, vibAmt: 0.08 });
                this.tone(t + 0.05, 120, { type: 'sine', f2: 30, dur: 0.9, vol: 0.4 });
                break;
            case 'bomb':
                this.noise(t, { dur: 0.5, f: 6000, filter: 'highpass', vol: 0.28 });
                this.noise(t, { dur: 1.4, f: 900, f2: 60, vol: 0.5 });
                this.tone(t, 90, { type: 'sine', f2: 25, dur: 1.2, vol: 0.55 });
                break;
            case 'hyper':
                this.tone(t, 160, { type: 'sine', f2: 2600, dur: 0.35, vol: 0.18, send: 0.4 });
                this.tone(t + 0.12, 2600, { type: 'triangle', f2: 300, dur: 0.3, vol: 0.1 });
                break;
            case 'warpIn':
                if (!this.limit('warp', 0.6)) return;
                [0, 4, 7, 12, 16].forEach((n, i) => this.tone(t + i * 0.035, mtof(76 + n), { type: 'triangle', dur: 0.12, vol: 0.05, send: 0.4 }));
                break;
            case 'abduct':
                if (!this.limit('abduct', 0.8)) return;
                for (let i = 0; i < 6; i++) this.tone(t + i * 0.09, i % 2 ? 660 : 990, { type: 'square', dur: 0.08, vol: 0.07 });
                break;
            case 'fall':
                this.tone(t, 1500, { type: 'sine', f2: 480, dur: 1.0, glide: 0.95, vol: 0.09, vib: 11, vibAmt: 0.05 });
                break;
            case 'catch':
                this.tone(t, mtof(79), { type: 'square', dur: 0.09, vol: 0.09 });
                this.tone(t + 0.08, mtof(86), { type: 'square', dur: 0.14, vol: 0.09, send: 0.3 });
                break;
            case 'setDown':
                [72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.06, mtof(n), { type: 'triangle', dur: 0.14, vol: 0.12, send: 0.3 }));
                break;
            case 'softLand':
                this.tone(t, mtof(72), { type: 'triangle', dur: 0.1, vol: 0.1 });
                this.tone(t + 0.08, mtof(79), { type: 'triangle', dur: 0.14, vol: 0.1 });
                break;
            case 'colonistDie':
                this.tone(t, 360, { type: 'square', f2: 70, dur: 0.45, vol: 0.09, lp: 1400 });
                break;
            case 'mutate':
                this.tone(t, 200, { type: 'sawtooth', f2: 1100, dur: 0.45, vol: 0.1, vib: 22, vibAmt: 0.1 });
                break;
            case 'planetDie':
                this.noise(t, { dur: 3.2, f: 3000, f2: 50, vol: 0.6 });
                this.tone(t, 70, { type: 'sine', f2: 20, dur: 2.5, vol: 0.6 });
                [64, 60, 57, 52].forEach((n, i) => this.tone(t + 0.3 + i * 0.35, mtof(n), { type: 'sawtooth', dur: 0.7, vol: 0.08, lp: 1200, send: 0.4 }));
                break;
            case 'impact':
                if (!this.limit('impact', 0.1)) return;
                this.noise(t, { dur: 0.4, f: 700, f2: 80, vol: 0.3 });
                this.tone(t, 100, { type: 'sine', f2: 35, dur: 0.35, vol: 0.3 });
                break;
            case 'extra':
                [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.055, mtof(n + 12), { type: 'square', dur: 0.1, vol: 0.07, send: 0.3 }));
                break;
            case 'mine':
                if (!this.limit('mine', 0.2)) return;
                this.tone(t, 1400, { type: 'sine', f2: 1000, dur: 0.05, vol: 0.035 });
                break;
            case 'hiveBurst':
                for (let i = 0; i < 5; i++) this.tone(t + i * 0.03, 1500 + i * 300, { type: 'square', f2: 3000, dur: 0.05, vol: 0.04 });
                break;
            case 'squadron':
                this.noise(t, { dur: 1.0, f: 300, f2: 3000, filter: 'bandpass', q: 4, vol: 0.18 });
                break;
            case 'dive':
                if (!this.limit('dive', 0.35)) return;
                this.tone(t, 1300, { type: 'sine', f2: 380, dur: 0.6, vol: 0.06, vib: 9, vibAmt: 0.02 });
                break;
            case 'squadronBonus':
                [67, 71, 74, 79].forEach((n, i) => this.tone(t + i * 0.07, mtof(n + 12), { type: 'triangle', dur: 0.12, vol: 0.1, send: 0.3 }));
                break;
            case 'bossHit':
                if (!this.limit('bhit', 0.05)) return;
                this.tone(t, 240, { type: 'square', f2: 140, dur: 0.06, vol: 0.06 });
                break;
            case 'ting':
                if (!this.limit('ting', 0.05)) return;
                this.tone(t, 2800, { type: 'triangle', dur: 0.08, vol: 0.06 });
                this.tone(t, 4200, { type: 'sine', dur: 0.05, vol: 0.03 });
                break;
            case 'bossShot':
                if (!this.limit('bshot', 0.12)) return;
                this.tone(t, 420, { type: 'sawtooth', f2: 160, dur: 0.18, vol: 0.07, lp: 2000 });
                break;
            case 'bossPhase': case 'roar':
                this.tone(t, 70, { type: 'sawtooth', f2: 45, dur: 0.9, vol: 0.2, vib: 18, vibAmt: 0.15, lp: 800 });
                this.noise(t, { dur: 0.8, f: 600, vol: 0.15 });
                break;
            case 'bossDie':
                for (let i = 0; i < 7; i++) {
                    this.noise(t + i * 0.22, { dur: 0.6, f: 3000 - i * 300, f2: 80, vol: 0.4 });
                    this.tone(t + i * 0.22, 150 - i * 10, { type: 'sine', f2: 30, dur: 0.5, vol: 0.35 });
                }
                break;
            case 'bossEnter':
                for (let i = 0; i < 3; i++) this.tone(t + i * 0.55, 380, { type: 'sawtooth', f2: 820, glide: 0.5, dur: 0.52, vol: 0.09, lp: 2400 });
                break;
            case 'tractor':
                this.tone(t, 300, { type: 'sine', dur: 1.6, vol: 0.1, vib: 11, vibAmt: 0.2 });
                break;
            case 'beamWarn':
                this.tone(t, 200, { type: 'square', f2: 1600, dur: 0.7, vol: 0.06, lp: 3000 });
                break;
            case 'beamFire':
                this.noise(t, { dur: 1.6, f: 1200, filter: 'bandpass', q: 2, vol: 0.25 });
                this.tone(t, 110, { type: 'sawtooth', dur: 1.6, vol: 0.12, vib: 30, vibAmt: 0.05, lp: 1500 });
                break;
            case 'launch':
                this.tone(t, 500, { type: 'square', f2: 1500, dur: 0.12, vol: 0.05 });
                break;
            case 'waveStart':
                [60, 67, 72].forEach((n, i) => this.tone(t + i * 0.09, mtof(n), { type: 'square', dur: 0.12, vol: 0.08, send: 0.3 }));
                this.resetBeat();
                break;
            case 'waveClear':
                [72, 71, 72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.1, mtof(n), { type: 'square', dur: 0.14, vol: 0.08, send: 0.3 }));
                break;
            case 'respawn':
                this.tone(t, 300, { type: 'triangle', f2: 1200, dur: 0.4, vol: 0.12, send: 0.3 });
                break;
            case 'hunter':
                for (let i = 0; i < 3; i++) this.tone(t + i * 0.14, 1800, { type: 'square', dur: 0.06, vol: 0.05 });
                break;
            case 'gameOver':
                [67, 63, 60, 55].forEach((n, i) => this.tone(t + i * 0.3, mtof(n), { type: 'triangle', dur: 0.4, vol: 0.12, send: 0.3 }));
                break;
        }
    }

    ui(kind) {
        if (!this.ctx || !this.sound) return;
        const t = this.now + 0.01;
        switch (kind) {
            case 'coin':
                this.tone(t, 1300, { type: 'square', dur: 0.06, vol: 0.08 });
                this.tone(t + 0.06, 1950, { type: 'square', dur: 0.22, vol: 0.08, send: 0.3 });
                break;
            case 'move': this.tone(t, 880, { type: 'square', dur: 0.04, vol: 0.05 }); break;
            case 'select': this.tone(t, 660, { type: 'square', dur: 0.06, vol: 0.07 }); this.tone(t + 0.06, 1320, { type: 'square', dur: 0.1, vol: 0.07 }); break;
            case 'back': this.tone(t, 500, { type: 'square', f2: 250, dur: 0.1, vol: 0.06 }); break;
            case 'pause': this.tone(t, 700, { type: 'triangle', dur: 0.08, vol: 0.08 }); this.tone(t + 0.08, 500, { type: 'triangle', dur: 0.1, vol: 0.08 }); break;
            case 'type': this.tone(t, 1200, { type: 'square', dur: 0.03, vol: 0.05 }); break;
            case 'continue': this.tone(t, 440, { type: 'square', dur: 0.12, vol: 0.07 }); break;
            case 'hiscore': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(t + i * 0.09, mtof(n), { type: 'square', dur: 0.12, vol: 0.08, send: 0.3 })); break;
        }
    }
}

export const audio = new Audio();
