// Sound for the Lighthouse Arcade: the jukebox's songs, the bowling alley and the
// bleeps of a hundred machines in attract mode. Everything is synthesised on the
// garden's own audio graph (so mute and tab-pause apply). The songs are written by
// the seed of their name: tempo, key, a chord progression from the 80s songbook,
// an octave-jumping disco bass, a drum machine, pads, an arpeggio and a lead line
// built from the chord tones, arranged into sections that come and go.

import { rng } from './util.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// progressions as scale degrees (0 = the tonic)
const PROGS = {
    minor: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 3, 0, 4], [5, 6, 0, 0]],
    major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 5, 5], [0, 3, 4, 3]],
};

export const SONGS = [
    { title: 'Neon Lighthouse', artist: 'The Beacon Keepers', style: 'disco' },
    { title: 'Midnight High Score', artist: 'Joystick Joy', style: 'synthpop' },
    { title: 'Glitterball Groove', artist: 'Mirror Mirror', style: 'disco' },
    { title: 'Turbo Sunset Drive', artist: 'Chrome Horizon', style: 'italo' },
    { title: 'Pixel Heartbeat', artist: 'Bit Romance', style: 'synthpop' },
    { title: 'Cosmic Strike', artist: 'Lane Seven', style: 'italo' },
    { title: 'Roller Rink Rendezvous', artist: 'The Wheel Deals', style: 'disco' },
    { title: 'Insert Coin (Extended Mix)', artist: 'Credit Zero', style: 'italo' },
];

/** Writes a song from its name: everything the sequencer needs, nothing audible yet. */
export function composeSong(spec) {
    const r = rng('song-' + spec.title);
    const minor = r() < 0.65;
    const scale = minor ? MINOR : MAJOR;
    const bpm = spec.style === 'disco' ? r.int(112, 122) : spec.style === 'italo' ? r.int(118, 128) : r.int(104, 116);
    const root = 33 + r.int(0, 11);             // the bass's tonic, A1 to G#2
    const prog = r.pick(PROGS[minor ? 'minor' : 'major']);
    const chords = prog.map((d) => [0, 2, 4, 6].map((k) => {
        const i = d + k;
        return scale[i % 7] + 12 * Math.floor(i / 7);
    }));
    // a lead phrase over each chord: an 8-step rhythm of chord tones and passing notes
    const rhythms = [[1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 0, 1, 0, 1, 1, 0], [0, 0, 1, 0, 1, 0, 1, 1], [1, 0, 0, 0, 1, 0, 1, 0]];
    const leadA = chords.map((ch) => {
        const rh = r.pick(rhythms);
        return rh.map((on) => (on ? (r() < 0.75 ? ch[r.int(0, 2)] : scale[r.int(0, 6)]) + 12 * r.int(0, 1) : null));
    });
    const leadB = leadA.map((bar) => bar.map((n) => (n === null ? (r() < 0.25 ? scale[r.int(0, 6)] + 12 : null) : n + (r() < 0.3 ? 2 : 0))));
    const arpShape = r.pick([[0, 1, 2, 3, 2, 1, 0, 2], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 2, 1, 3, 2, 1, 2], [3, 2, 1, 0, 1, 2, 3, 1]]);
    // the arrangement, eight bars to a section: intro, groove, verse, chorus, break, chorus ... (it loops)
    const sections = ['intro', 'groove', 'verse', 'chorus', 'break', 'chorus', 'verse', 'chorus'];
    return { ...spec, bpm, root, minor, scale, chords, leadA, leadB, arpShape, sections, swing: spec.style === 'synthpop' ? 0 : 0.02, leadWave: r.pick(['square', 'sawtooth']), seed: r() };
}

export class ArcadeAudio {
    constructor(engine) {
        this.e = engine;
        this.ctx = engine.ctx;
        this.song = null;
        this.songs = SONGS.map(composeSong);
        this.index = -1;
        this.nearJuke = 1;
        this.nextBleep = 0;
        this.kickTimes = [];
        if (!this.ctx) return;
        const ctx = this.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.out.connect(engine.master);
        // the jukebox: its own bus, louder the nearer you stand, with a slapback echo
        this.juke = ctx.createGain();
        this.juke.gain.value = 0.5;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        this.jukeTone = ctx.createBiquadFilter();
        this.jukeTone.type = 'lowpass';
        this.jukeTone.frequency.value = 12000;
        this.juke.connect(comp).connect(this.jukeTone).connect(this.out);
        this.echo = ctx.createDelay(1);
        const fb = ctx.createGain();
        fb.gain.value = 0.32;
        const wet = ctx.createGain();
        wet.gain.value = 0.25;
        this.echo.connect(fb).connect(this.echo);
        this.echo.connect(wet).connect(this.juke);
        if (engine.reverb) {
            const rv = ctx.createGain();
            rv.gain.value = 0.18;
            this.juke.connect(rv).connect(engine.reverb);
        }
        // everything else (bowling, bleeps) goes through here
        this.fx = ctx.createGain();
        this.fx.gain.value = 0.9;
        this.fx.connect(this.out);
        this.noise = engine._noiseBuffer(2);
        // the rumble of a ball on the boards
        this.rollGain = ctx.createGain();
        this.rollGain.gain.value = 0;
        const rs = ctx.createBufferSource();
        rs.buffer = engine._noiseBuffer(3, true);
        rs.loop = true;
        this.rollFilter = ctx.createBiquadFilter();
        this.rollFilter.type = 'lowpass';
        this.rollFilter.frequency.value = 260;
        rs.connect(this.rollFilter).connect(this.rollGain).connect(this.fx);
        rs.start();
        // the hum of the hall
        const hum = ctx.createOscillator();
        hum.frequency.value = 60;
        const hg = ctx.createGain();
        hg.gain.value = 0.012;
        hum.connect(hg).connect(this.out);
        hum.start();
        this._srcs = [rs, hum];
    }

    get ok() {
        return !!this.ctx && !this.e.muted;
    }

    /** In through the door: the garden's score fades out and the hall fades in. */
    enter() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.out.gain.setTargetAtTime(1, t, 0.4);
        this.e.music?.gain.setTargetAtTime(0, t, 0.5);
        this.inside = true;
    }

    leave() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.stop();
        this.rollGain.gain.setTargetAtTime(0, t, 0.05);
        this.out.gain.setTargetAtTime(0, t, 0.3);
        this.e.music?.gain.setTargetAtTime(this.e.musicVol * (this.e.underground ? 0.45 : 1), t, 0.8);
        this.inside = false;
    }

    // ------------------------------------------------------------ the jukebox

    play(i) {
        if (!this.ctx) return;
        this.index = ((i % this.songs.length) + this.songs.length) % this.songs.length;
        this.song = this.songs[this.index];
        this.step = 0;
        this.stepDur = 60 / this.song.bpm / 4;
        this.start = this.ctx.currentTime + 0.12;
        this.nextAt = this.start;
        this.echo.delayTime.value = this.stepDur * 3;
        this.kickTimes = [];
        this.juke.gain.cancelScheduledValues(this.ctx.currentTime);
        this.juke.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.02);
        this._needle(this.ctx.currentTime);
    }

    stop() {
        if (!this.song || !this.ctx) {
            this.song = null;
            return;
        }
        this.song = null;
        this.juke.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
        this.kickTimes = [];
    }

    /** Where the song is: beats since it began, the bar, and how hard the last kick still rings (0..1). */
    beat() {
        if (!this.song || !this.ctx) return { playing: false, beat: 0, bar: 0, pulse: 0, section: 'none', bpm: 120 };
        const now = this.ctx.currentTime - (this.ctx.outputLatency || 0);
        const beat = Math.max(0, ((now - this.start) * this.song.bpm) / 60);
        let pulse = 0;
        for (const k of this.kickTimes) if (k <= now) pulse = Math.max(pulse, Math.exp(-(now - k) * 7));
        const bar = Math.floor(beat / 4);
        return { playing: true, beat, bar, pulse, section: this.song.sections[Math.floor(bar / 8) % this.song.sections.length], bpm: this.song.bpm };
    }

    /** Called every frame: schedules the next notes ahead of the clock. */
    update(dt, jukeDist = 0) {
        if (!this.ctx || !this.inside) return;
        const t = this.ctx.currentTime;
        // the jukebox is loudest beside it and muffled at the far end of the hall
        const near = Math.max(0.3, Math.min(1, 1.15 - jukeDist / 40));
        this.jukeTone.frequency.setTargetAtTime(2500 + near * near * 11000, t, 0.2);
        this.juke.gain.setTargetAtTime(this.song ? 0.55 * near : 0, t, 0.15);
        if (this.song) {
            // back from a hidden tab: skip what was missed rather than play it all at once
            if (this.nextAt < t - 0.05) {
                this.step += Math.ceil((t - this.nextAt) / this.stepDur);
                this.nextAt = this.start + this.step * this.stepDur;
            }
            while (this.nextAt < t + 0.14) {
                this._step(this.step, this.nextAt);
                this.step++;
                this.nextAt = this.start + this.step * this.stepDur;
            }
            this.kickTimes = this.kickTimes.filter((k) => k > t - 1);
        }
        // the machines in attract mode, bleeping to themselves
        if (t > this.nextBleep) {
            this.nextBleep = t + 0.25 + Math.random() * (this.song ? 2.4 : 1.1);
            if (!this.e.muted) this._bleep(t + 0.01);
        }
    }

    _step(step, t) {
        const s = this.song;
        const bar = Math.floor(step / 16), pos = step % 16;
        const sec = s.sections[Math.floor(bar / 8) % s.sections.length];
        const barInSec = bar % 8;
        const ch = s.chords[bar % 4];
        const swingT = t + (pos % 2 ? s.swing : 0);
        const full = sec !== 'intro' && sec !== 'break';
        const fill = barInSec === 7 && pos >= 12;
        // drums
        if (pos % 4 === 0 && sec !== 'break') this._kick(t);
        if (sec === 'break' && pos === 0 && barInSec % 2 === 0) this._kick(t);
        if ((pos === 4 || pos === 12) && full) s.style === 'synthpop' ? this._snare(t, 0.32) : this._clap(t);
        if (s.style === 'disco' || s.style === 'italo') {
            if (pos % 4 === 2 && sec !== 'intro') this._hat(swingT, 0.2, true);
            else if (pos % 2 === 1 && full) this._hat(swingT, 0.045);
        } else if (pos % 2 === 0 && sec !== 'intro') this._hat(t, 0.05);
        if (fill && full) this._tom(t, 110 - (pos - 12) * 12);
        // bass
        if (sec !== 'break' || barInSec >= 6) {
            const root = s.root + ch[0];
            if (s.style === 'disco') {
                if (pos % 2 === 0) this._bass(root + (pos % 4 === 2 ? 12 : 0), t, this.stepDur * 1.6);
            } else if (s.style === 'italo') {
                this._bass(root + (pos % 4 === 3 ? 12 : 0), t, this.stepDur * 0.8, 0.13);
            } else if ([0, 3, 6, 8, 10, 11, 14].includes(pos)) this._bass(root + (pos === 14 ? 7 : 0), t, this.stepDur * 1.4);
        }
        // pads at the top of each bar
        if (pos === 0 && sec !== 'intro') this._pad(ch.map((n) => s.root + 24 + n), t, this.stepDur * 16, sec === 'break' ? 0.05 : 0.03);
        // the arpeggio
        if ((sec === 'chorus' || sec === 'groove' || sec === 'break' || s.style === 'italo') && sec !== 'intro') {
            const n = s.root + 36 + ch[s.arpShape[pos % 8]] + (pos >= 8 ? 12 : 0);
            this._pluck(n, t, sec === 'break' ? 0.05 : 0.035);
        }
        // the lead line, on eighths
        if ((sec === 'verse' || sec === 'chorus') && pos % 2 === 0) {
            const phrase = sec === 'chorus' ? s.leadB : s.leadA;
            const n = phrase[bar % 4][pos / 2];
            if (n !== null) this._lead(s.root + 48 + n, t, this.stepDur * 1.8, sec === 'chorus' ? 0.06 : 0.045);
        }
    }

    _env(g, t, a, peak, d) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    _kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const g = ctx.createGain();
        this._env(g, t, 0.003, 0.9, 0.32);
        o.connect(g).connect(this.juke);
        o.start(t);
        o.stop(t + 0.4);
        this.kickTimes.push(t);
    }

    _noise(t, dur, type, freq, q, vol, out = this.juke) {
        const ctx = this.ctx;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        this._env(g, t, 0.002, vol, dur);
        s.connect(f).connect(g).connect(out);
        s.start(t, Math.random() * 1.5);
        s.stop(t + dur + 0.05);
    }

    _snare(t, vol) {
        this._noise(t, 0.18, 'bandpass', 1900, 0.8, vol);
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        const g = this.ctx.createGain();
        this._env(g, t, 0.002, 0.18, 0.1);
        o.connect(g).connect(this.juke);
        o.start(t);
        o.stop(t + 0.15);
    }

    _clap(t) {
        for (let k = 0; k < 3; k++) this._noise(t + k * 0.011, k === 2 ? 0.16 : 0.02, 'bandpass', 1300, 1.2, 0.3);
    }

    _hat(t, vol, open = false) {
        this._noise(t, open ? 0.16 : 0.035, 'highpass', 7600, 0.7, vol);
    }

    _tom(t, f) {
        const o = this.ctx.createOscillator();
        o.frequency.setValueAtTime(f * 1.6, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
        const g = this.ctx.createGain();
        this._env(g, t, 0.003, 0.35, 0.25);
        o.connect(g).connect(this.juke);
        o.start(t);
        o.stop(t + 0.3);
    }

    _bass(n, t, dur, vol = 0.2) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 6;
        f.frequency.setValueAtTime(1600, t);
        f.frequency.exponentialRampToValueAtTime(260, t + dur);
        const g = ctx.createGain();
        this._env(g, t, 0.004, vol, dur);
        o.connect(f).connect(g).connect(this.juke);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    _pad(notes, t, dur, vol) {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
        g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.85);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
        f.connect(g).connect(this.juke);
        for (const n of notes) {
            for (const d of [-7, 7]) {
                const o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = midi(n);
                o.detune.value = d;
                o.connect(f);
                o.start(t);
                o.stop(t + dur * 1.05);
            }
        }
    }

    _pluck(n, t, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = midi(n);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(4200, t);
        f.frequency.exponentialRampToValueAtTime(700, t + 0.12);
        const g = ctx.createGain();
        this._env(g, t, 0.002, vol, 0.13);
        o.connect(f).connect(g);
        g.connect(this.juke);
        g.connect(this.echo);
        o.start(t);
        o.stop(t + 0.2);
    }

    _lead(n, t, dur, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = this.song.leadWave;
        o.frequency.value = midi(n);
        const vib = ctx.createOscillator();
        vib.frequency.value = 5.5;
        const vg = ctx.createGain();
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(6, t + dur);
        vib.connect(vg).connect(o.detune);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.015);
        g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3);
        o.connect(f).connect(g);
        g.connect(this.juke);
        g.connect(this.echo);
        o.start(t);
        vib.start(t);
        o.stop(t + dur * 1.4);
        vib.stop(t + dur * 1.4);
    }

    /** The click and crackle of the needle finding the record. */
    _needle(t) {
        this._noise(t, 0.04, 'highpass', 3000, 0.5, 0.2);
        this._noise(t + 0.05, 0.06, 'bandpass', 900, 1, 0.12);
    }

    // ------------------------------------------------------------ the machines

    _bleep(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = Math.random() < 0.6 ? 'square' : 'triangle';
        const kind = Math.random();
        const f0 = 300 + Math.random() * 900;
        o.frequency.setValueAtTime(f0, t);
        if (kind < 0.35) o.frequency.exponentialRampToValueAtTime(f0 * 2.5, t + 0.12);
        else if (kind < 0.7) o.frequency.exponentialRampToValueAtTime(f0 * 0.3, t + 0.2);
        else for (let k = 1; k < 4; k++) o.frequency.setValueAtTime(f0 * [1, 1.25, 1.5, 2][k], t + k * 0.05);
        const g = ctx.createGain();
        this._env(g, t, 0.003, 0.012 + Math.random() * 0.01, 0.2);
        const p = ctx.createStereoPanner?.();
        if (p) {
            p.pan.value = Math.random() * 2 - 1;
            o.connect(g).connect(p).connect(this.fx);
        } else o.connect(g).connect(this.fx);
        o.start(t);
        o.stop(t + 0.25);
    }

    coin() {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        for (const [k, n] of [[0, 83], [1, 88]]) {
            const o = this.ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = midi(n);
            const g = this.ctx.createGain();
            this._env(g, t + k * 0.07, 0.002, 0.05, k ? 0.3 : 0.07);
            o.connect(g).connect(this.fx);
            o.start(t + k * 0.07);
            o.stop(t + k * 0.07 + 0.4);
        }
    }

    // ------------------------------------------------------------ the bowling alley

    /** 0..1 rolling speed, while a ball is on the boards (0 in the gutter or when stopped). */
    roll(speed, gutter = false) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.rollGain.gain.setTargetAtTime(speed * (gutter ? 0.35 : 0.55), t, 0.05);
        this.rollFilter.frequency.setTargetAtTime(gutter ? 520 : 180 + speed * 160, t, 0.05);
    }

    /** A pin knocked by the ball or by another pin. */
    pin(strength) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + Math.random() * 0.01;
        const v = Math.min(1, strength);
        this._noise(t, 0.05 + v * 0.05, 'bandpass', 2600 + Math.random() * 1600, 2.5, 0.12 + v * 0.3, this.fx);
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(900 + Math.random() * 700, t);
        o.frequency.exponentialRampToValueAtTime(500, t + 0.06);
        const g = this.ctx.createGain();
        this._env(g, t, 0.001, 0.05 + v * 0.12, 0.07);
        o.connect(g).connect(this.fx);
        o.start(t);
        o.stop(t + 0.1);
    }

    /** A pin falling over onto the deck. */
    thud() {
        if (!this.ok) return;
        this._noise(this.ctx.currentTime + Math.random() * 0.05, 0.12, 'lowpass', 700, 1, 0.12, this.fx);
    }

    gutter() {
        if (!this.ok) return;
        this._noise(this.ctx.currentTime, 0.2, 'lowpass', 300, 1, 0.3, this.fx);
    }

    /** The pinsetter: a motor whirring and a bar sweeping the deck. */
    sweep() {
        if (!this.ok) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(70, t);
        o.frequency.linearRampToValueAtTime(110, t + 0.6);
        o.frequency.linearRampToValueAtTime(65, t + 1.6);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.2);
        g.gain.linearRampToValueAtTime(0.0001, t + 1.7);
        o.connect(f).connect(g).connect(this.fx);
        o.start(t);
        o.stop(t + 1.8);
        this._noise(t + 0.5, 0.4, 'bandpass', 1500, 0.7, 0.08, this.fx);
    }

    /** A strike, a spare, or just a frame scored: a little fanfare from the score monitor. */
    fanfare(kind) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + 0.05;
        const seq = kind === 'strike' ? [72, 76, 79, 84, 79, 84, 88] : kind === 'spare' ? [72, 76, 79, 84] : kind === 'turkey' ? [72, 76, 79, 84, 88, 91, 96, 91, 96] : kind === 'done' ? [84, 79, 76, 79, 84] : [64, 60];
        seq.forEach((n, i) => {
            const o = this.ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = midi(n);
            const g = this.ctx.createGain();
            this._env(g, t + i * 0.085, 0.003, 0.05, i === seq.length - 1 ? 0.4 : 0.08);
            o.connect(g).connect(this.fx);
            o.start(t + i * 0.085);
            o.stop(t + i * 0.085 + 0.5);
        });
    }

    // ------------------------------------------------------------ the fortune teller and the claw

    /** A short tone into the effects bus. */
    _tone(type, f0, f1, t, a, peak, d, out = this.fx) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
        const g = this.ctx.createGain();
        this._env(g, t, a, peak, d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + a + d + 0.05);
    }

    /** The oracle wakes: a shimmer of glass and a slow, rising arpeggio from the organ in her booth. */
    oracle() {
        if (!this.ok) return;
        const t = this.ctx.currentTime + 0.05;
        [62, 65, 69, 72, 74, 77, 81].forEach((n, i) => {
            this._tone('sine', midi(n), 0, t + i * 0.16, 0.02, 0.07, 1.2);
            this._tone('triangle', midi(n + 12), 0, t + i * 0.16 + 0.02, 0.01, 0.025, 0.6);
        });
        this._tone('sawtooth', midi(38), midi(38), t, 0.6, 0.03, 2.4);
        for (let k = 0; k < 8; k++) this._noise(t + 0.3 + k * 0.17, 0.25, 'bandpass', 5000 + Math.random() * 3000, 8, 0.04, this.fx);
    }

    /** Her voice: a murmur of formant-ish buzzes while the jaw goes. */
    murmur(dur = 1.6) {
        if (!this.ok) return;
        const t0 = this.ctx.currentTime;
        for (let s = 0; s < dur; s += 0.13 + Math.random() * 0.08) {
            const f = 140 + Math.random() * 70;
            const t = t0 + s;
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, t);
            o.frequency.linearRampToValueAtTime(f * (0.85 + Math.random() * 0.3), t + 0.12);
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 500 + Math.random() * 900;
            bp.Q.value = 4;
            const g = this.ctx.createGain();
            this._env(g, t, 0.02, 0.05, 0.1);
            o.connect(bp).connect(g).connect(this.fx);
            o.start(t);
            o.stop(t + 0.2);
        }
    }

    /** The ticket printer: a little motor and the card being pushed out. */
    printer(dur = 1.2) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(38, t);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.05);
        g.gain.setValueAtTime(0.05, t + dur - 0.05);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp).connect(g).connect(this.fx);
        o.start(t);
        o.stop(t + dur + 0.05);
        for (let s = 0; s < dur; s += 0.06) this._noise(t + s, 0.03, 'highpass', 2500, 1, 0.025, this.fx);
        this._tone('triangle', 1800, 0, t + dur, 0.002, 0.06, 0.3);
    }

    /** The claw's gantry motor, 0..1 while it is moving. */
    gantry(on) {
        if (!this.ctx) return;
        if (!this.motor) {
            const ctx = this.ctx;
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = 95;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 420;
            this.motor = ctx.createGain();
            this.motor.gain.value = 0;
            o.connect(lp).connect(this.motor).connect(this.fx);
            o.start();
            this._srcs.push(o);
            this.motorOsc = o;
        }
        const t = this.ctx.currentTime;
        this.motor.gain.setTargetAtTime(this.e.muted ? 0 : on * 0.035, t, 0.04);
        this.motorOsc.frequency.setTargetAtTime(80 + on * 30, t, 0.1);
    }

    /** The claw: 'drop' going down, 'grab' closing, 'clunk' letting go, 'win' a prize down the chute. */
    claw(kind) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        if (kind === 'drop') this._tone('square', 420, 160, t, 0.01, 0.04, 0.9);
        else if (kind === 'grab') {
            this._noise(t, 0.1, 'bandpass', 1400, 3, 0.15, this.fx);
            this._tone('square', 200, 120, t, 0.005, 0.04, 0.15);
        } else if (kind === 'up') this._tone('square', 160, 420, t, 0.01, 0.035, 0.9);
        else if (kind === 'clunk') this._noise(t, 0.12, 'lowpass', 600, 1, 0.25, this.fx);
        else if (kind === 'miss') [67, 63, 60].forEach((n, i) => this._tone('square', midi(n), 0, t + i * 0.12, 0.003, 0.05, 0.12));
        else if (kind === 'thump') this._noise(t, 0.08, 'lowpass', 400, 1, 0.2, this.fx);
        else if (kind === 'win') {
            [72, 76, 79, 84, 88, 84, 88, 91].forEach((n, i) => this._tone('square', midi(n), 0, t + 0.1 + i * 0.09, 0.003, 0.05, i === 7 ? 0.5 : 0.1));
            for (let k = 0; k < 10; k++) this._tone('sine', 2000 + Math.random() * 2500, 0, t + 0.1 + k * 0.07, 0.002, 0.02, 0.15);
        }
    }

    dispose() {
        if (!this.ctx) return;
        this.stop();
        for (const s of this._srcs) {
            try {
                s.stop();
            } catch {
                /* already stopped */
            }
        }
        this.out.disconnect();
    }
}
