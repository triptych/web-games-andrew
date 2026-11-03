// The Starlight Carousel's band organ: an original waltz in D major, played on
// synthesised pipes (a reedy melody with vibrato and a piccolo an octave up),
// an oom-pah-pah of bass pipe and chord stabs, a glockenspiel and a bass drum
// with a cymbal tap. It is scheduled a little ahead on the garden's own audio
// context, one beat at a time, from update() — so it falls silent by itself
// whenever the garden stops calling. It sounds from the carousel: louder as
// you come near, panned to where it stands, muffled with distance.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const BPM = 168;
const BEAT = 60 / BPM;

// chords by name: bass root and the notes of the "pah"s
const CH = {
    D: { root: 38, notes: [62, 66, 69] },
    A7: { root: 33, notes: [61, 64, 67] },
    G: { root: 43, notes: [62, 67, 71] },
    Bm: { root: 35, notes: [62, 66, 71] },
    F7: { root: 42, notes: [61, 66, 70] }, // F#7
    E7: { root: 40, notes: [62, 64, 68] },
    Em: { root: 40, notes: [64, 67, 71] },
};

// sixteen bars a section, each bar a chord and its melody as [note, beats] (null rests)
const A = {
    chords: ['D', 'D', 'A7', 'A7', 'A7', 'A7', 'D', 'D', 'D', 'D', 'G', 'G', 'D', 'A7', 'A7', 'D'],
    tune: [
        [[66, 2], [69, 1]], [[74, 2], [73, 1]], [[71, 1], [69, 1], [67, 1]], [[64, 3]],
        [[64, 2], [67, 1]], [[73, 2], [71, 1]], [[69, 1], [67, 1], [66, 1]], [[62, 3]],
        [[66, 2], [69, 1]], [[74, 2], [78, 1]], [[79, 2], [78, 1]], [[76, 2], [74, 1]],
        [[74, 1], [73, 1], [74, 1]], [[76, 2], [73, 1]], [[69, 1], [71, 1], [73, 1]], [[74, 2], [null, 1]],
    ],
};
const B = {
    chords: ['Bm', 'Bm', 'F7', 'F7', 'F7', 'F7', 'Bm', 'Bm', 'G', 'G', 'D', 'D', 'E7', 'A7', 'D', 'D'],
    tune: [
        [[71, 1], [74, 1], [78, 1]], [[78, 2], [76, 1]], [[73, 1], [70, 1], [73, 1]], [[76, 3]],
        [[78, 1], [76, 1], [73, 1]], [[70, 2], [73, 1]], [[71, 1], [73, 1], [74, 1]], [[71, 3]],
        [[71, 1], [74, 1], [79, 1]], [[79, 2], [78, 1]], [[76, 1], [74, 1], [78, 1]], [[74, 3]],
        [[68, 1], [71, 1], [74, 1]], [[73, 2], [76, 1]], [[74, 1], [78, 1], [81, 1]], [[86, 2], [null, 1]],
    ],
};
// a short trio in G for variety, lighter on the drum
const C = {
    chords: ['G', 'G', 'D', 'D', 'Em', 'A7', 'D', 'D', 'G', 'G', 'D', 'Bm', 'Em', 'A7', 'D', 'D'],
    tune: [
        [[71, 3]], [[74, 2], [71, 1]], [[69, 3]], [[66, 2], [69, 1]],
        [[67, 1], [71, 1], [76, 1]], [[73, 2], [69, 1]], [[74, 3]], [[null, 1], [69, 1], [71, 1]],
        [[74, 2], [79, 1]], [[83, 2], [79, 1]], [[78, 2], [74, 1]], [[71, 2], [74, 1]],
        [[76, 1], [74, 1], [71, 1]], [[73, 2], [76, 1]], [[74, 2], [69, 1]], [[62, 2], [null, 1]],
    ],
};
const SONG = [A, A, B, A, C, B, A];

/** Every bar of the song, flattened: { chord, notes: [{ n, at (beats into the bar), len }], section, light } */
const BARS = (() => {
    const out = [];
    SONG.forEach((sec, si) => {
        sec.tune.forEach((bar, bi) => {
            let at = 0;
            const notes = [];
            for (const [n, len] of bar) {
                if (n !== null) notes.push({ n, at, len });
                at += len;
            }
            out.push({ chord: CH[sec.chords[bi]], notes, section: si, trio: sec === C, end: bi === 15 });
        });
    });
    return out;
})();

export class CarouselMusic {
    constructor(audio) {
        this.audio = audio;
        this.out = null;
        this.playing = false;
        this.bar = 0;
        this.beat = 0;       // beat within the bar, 0..2
        this.nextAt = 0;     // context time of the next beat to schedule
        this.startAt = 0;    // context time the song started
        this.level = 0;
    }

    _ensure() {
        const a = this.audio;
        if (!a.ctx) return false;
        if (this.out) return true;
        const ctx = a.ctx;
        this.out = ctx.createGain();
        this.out.gain.value = 0;
        this.tone = ctx.createBiquadFilter();
        this.tone.type = 'lowpass';
        this.tone.frequency.value = 9000;
        this.pan = ctx.createStereoPanner();
        this.out.connect(this.tone).connect(this.pan).connect(a.master);
        const rev = ctx.createGain();
        rev.gain.value = 0.28;
        this.pan.connect(rev).connect(a.reverb);
        // a slow wobble for the pipes' vibrato, shared by every note
        this.vib = ctx.createOscillator();
        this.vib.frequency.value = 5.6;
        this.vibAmt = ctx.createGain();
        this.vibAmt.gain.value = 7;
        this.vib.connect(this.vibAmt);
        this.vib.start();
        this.noise = a._noiseBuffer(0.5);
        return true;
    }

    /** Where in the song the band is, in beats since it struck up (for the lights). */
    get beatPos() {
        const ctx = this.audio.ctx;
        if (!this.playing || !ctx) return -1;
        return (ctx.currentTime - this.startAt) / BEAT;
    }

    /**
     * Called every frame in the garden. `on`: the organ should be playing;
     * `vol` 0..1 how loud at the listener; `pan` -1..1; `muffle` 0..1.
     */
    update(on, vol, pan, muffle) {
        if (!this._ensure()) return;
        const ctx = this.audio.ctx, now = ctx.currentTime;
        if (on && !this.playing) {
            this.playing = true;
            this.bar = 0;
            this.beat = 0;
            this.nextAt = now + 0.08;
            this.startAt = this.nextAt;
        } else if (!on && this.playing) {
            this.playing = false;
        }
        const level = this.playing ? vol * Math.min(1.4, this.audio.musicVol * 1.6) : 0;
        this.level = level;
        this.out.gain.setTargetAtTime(level, now, this.playing ? 0.15 : 0.6);
        this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)) * 0.8, now, 0.1);
        this.tone.frequency.setTargetAtTime(9000 - muffle * 7600, now, 0.2);
        if (!this.playing) return;
        // after a gap (the tab was hidden, or you were indoors) pick up from now rather than catch up
        if (this.nextAt < now - 0.1) {
            const skipped = Math.ceil((now - this.nextAt) / BEAT);
            this.nextAt += skipped * BEAT;
            for (let i = 0; i < skipped; i++) this._advance();
        }
        while (this.nextAt < now + 0.25) {
            if (level > 0.003) this._beat(this.nextAt);
            this.nextAt += BEAT;
            this._advance();
        }
    }

    _advance() {
        if (++this.beat > 2) {
            this.beat = 0;
            this.bar = (this.bar + 1) % BARS.length;
        }
    }

    /** One beat of the organ: the oom or a pah, the melody notes that start on it, and percussion. */
    _beat(t) {
        const bar = BARS[this.bar], b = this.beat;
        if (b === 0) {
            this._bass(midi(bar.chord.root), t);
            if (!bar.trio || this.bar % 2 === 0) this._kick(t);
        } else {
            for (const n of bar.chord.notes) this._stab(midi(n), t);
            if (b === 2 && !bar.trio) this._tick(t, 0.035);
        }
        if (bar.end && b === 2) this._roll(t);
        for (const note of bar.notes) {
            if (note.at !== b) continue;
            const len = note.len * BEAT;
            this._pipe(midi(note.n), t, len);
            // the glockenspiel joins on long notes, and doubles the tune in the B section and the trio
            if (note.len >= 2 || bar.section === 2 || bar.trio) this._glock(midi(note.n + 12), t, note.len >= 2 ? 0.07 : 0.045);
        }
    }

    _pipe(f, t, len) {
        const ctx = this.audio.ctx;
        const g = ctx.createGain();
        const end = t + Math.max(0.12, len * 0.92);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.025);
        g.gain.setValueAtTime(0.085, end - 0.05);
        g.gain.linearRampToValueAtTime(0, end + 0.06);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3400;
        lp.Q.value = 1.2;
        g.connect(lp).connect(this.out);
        const voices = [['square', 1, 0.55, -4], ['sawtooth', 1, 0.35, 5], ['sine', 2, 0.5, 0], ['triangle', 0.5, 0.35, 0]];
        for (const [type, mul, vol, det] of voices) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f * mul;
            o.detune.value = det;
            this.vibAmt.connect(o.detune);
            const vg = ctx.createGain();
            vg.gain.value = vol;
            o.connect(vg).connect(g);
            o.start(t);
            o.stop(end + 0.1);
            o.onended = () => this.vibAmt.disconnect(o.detune);
        }
        // a breath of air at the start of each note
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const bf = ctx.createBiquadFilter();
        bf.type = 'bandpass';
        bf.frequency.value = f * 2;
        bf.Q.value = 3;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.05, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        s.connect(bf).connect(ng).connect(this.out);
        s.start(t);
        s.stop(t + 0.15);
    }

    _bass(f, t) {
        const ctx = this.audio.ctx;
        for (const [type, mul, vol] of [['triangle', 1, 0.22], ['square', 1, 0.05], ['sine', 0.5, 0.12]]) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f * mul;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 0.9);
            o.connect(g).connect(this.out);
            o.start(t);
            o.stop(t + BEAT);
        }
    }

    _stab(f, t) {
        const ctx = this.audio.ctx;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 0.55);
        o.connect(lp).connect(g).connect(this.out);
        o.start(t);
        o.stop(t + BEAT * 0.6);
    }

    _glock(f, t, vol) {
        const ctx = this.audio.ctx;
        for (const [mul, v, d] of [[1, 1, 1.4], [2.76, 0.35, 0.4], [5.4, 0.15, 0.2]]) {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f * mul;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol * v, t + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g).connect(this.out);
            o.start(t);
            o.stop(t + d + 0.05);
        }
    }

    _kick(t) {
        const ctx = this.audio.ctx;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.32);
    }

    _tick(t, vol) {
        const ctx = this.audio.ctx;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
        s.connect(hp).connect(g).connect(this.out);
        s.start(t, Math.random() * 0.2);
        s.stop(t + 0.24);
    }

    /** A snare roll into the next section. */
    _roll(t) {
        for (let i = 0; i < 6; i++) this._tick(t + (i * BEAT) / 6, 0.03 + i * 0.012);
    }

    /** The operator's bell: ding-ding, and away we go (or: please wait for the ride to stop). */
    bell(times = 2) {
        if (!this._ensure()) return;
        const ctx = this.audio.ctx;
        const t0 = ctx.currentTime + 0.02;
        for (let k = 0; k < times; k++) {
            const t = t0 + k * 0.32;
            for (const [mul, v, d] of [[1, 0.16, 1.6], [2.4, 0.06, 0.9], [3.9, 0.04, 0.5], [5.8, 0.02, 0.3]]) {
                const o = ctx.createOscillator();
                o.frequency.value = 1240 * mul;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(v, t + 0.002);
                g.gain.exponentialRampToValueAtTime(0.0001, t + d);
                o.connect(g).connect(this.audio.sfx);
                o.start(t);
                o.stop(t + d + 0.05);
            }
        }
    }
}

export const CAROUSEL_BEAT = BEAT;
