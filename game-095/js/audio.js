// Procedural sound: all Web Audio, no files. A look-ahead sequencer plays a creepy-cute waltz
// (a music box over a plucked bass and soft chords, in A minor) while you explore, and a brighter
// one for the party. Effects answer sim events. The context is made on the first gesture, and
// ../lib/page-audio.js suspends it while the tab is hidden.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// the five coloured keys of the music box, a pentatonic scale
export const NOTE_MIDI = [72, 74, 76, 79, 81];

// Each track is 8 bars of 3 beats. chords: [bass root, third, fifth] per bar. mel: a MIDI note per beat (0 = rest).
const TRACKS = {
    explore: {
        bpm: 112, inst: 'box',
        chords: [[45, 60, 64], [50, 62, 65], [52, 62, 68], [45, 60, 64], [41, 60, 65], [50, 62, 65], [52, 64, 68], [45, 60, 64]],
        mel: [76, 0, 72, 74, 0, 77, 76, 0, 68, 69, 0, 0, 77, 0, 74, 74, 0, 72, 71, 0, 68, 69, 0, 0],
    },
    title: {
        bpm: 84, inst: 'box',
        chords: [[45, 60, 64], [41, 60, 65], [43, 59, 62], [45, 60, 64], [45, 60, 64], [41, 60, 65], [52, 62, 68], [45, 60, 64]],
        mel: [81, 0, 0, 79, 0, 0, 77, 0, 0, 76, 0, 0, 81, 0, 76, 77, 0, 74, 71, 0, 68, 69, 0, 0],
    },
    party: {
        bpm: 138, inst: 'bell',
        chords: [[48, 64, 67], [45, 64, 69], [41, 65, 69], [43, 62, 67], [48, 64, 67], [45, 64, 69], [50, 65, 69], [43, 62, 67]],
        mel: [76, 79, 76, 81, 0, 76, 77, 0, 72, 74, 0, 71, 76, 79, 76, 81, 0, 84, 83, 0, 79, 79, 0, 0],
    },
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.track = null;
        this.want = null;
        this.beat = 0;
        this.next = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.25;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        // a small generated reverb, so the music box sounds like it is in a big empty house
        this.verb = ctx.createConvolver();
        const n = Math.floor(ctx.sampleRate * 2.4), buf = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
        this.verb.buffer = buf;
        this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.35;
        this.verbIn.connect(this.verb); this.verb.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.startWind();
        this.timer = setInterval(() => this.schedule(), 40);
        if (this.want) this.play(this.want);
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------------ voices
    tone({ f = 440, to = null, dur = 0.2, type = 'sine', vol = 0.2, at = 0, attack = 0.006, dest = null, verb = 0.2, vib = 0 }) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = Math.max(ctx.currentTime, at || ctx.currentTime);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 9; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verbIn); }
        o.start(t); o.stop(t + dur + 0.05);
    }
    noise({ dur = 0.2, vol = 0.1, from = 800, to = 800, q = 1, type = 'bandpass', at = 0, dest = null }) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = Math.max(ctx.currentTime, at || ctx.currentTime);
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest || this.sfx);
        s.start(t); s.stop(t + dur + 0.05);
    }
    startWind() {
        const ctx = this.ctx;
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2;
        const g = ctx.createGain(); g.gain.value = 0.03;
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.12; lg.gain.value = 220; l.connect(lg); lg.connect(f.frequency); l.start();
        s.connect(f); f.connect(g); g.connect(this.music); s.start();
    }

    // ------------------------------------------------------------------ the sequencer
    play(name) {
        this.want = name;
        if (!this.ctx || this.track === name) return;
        this.track = name;
        this.beat = 0;
        this.next = this.ctx.currentTime + 0.1;
    }
    stop() { this.want = null; this.track = null; }

    schedule() {
        if (!this.ctx || this.ctx.state !== 'running' || !this.track) return;
        const T = TRACKS[this.track], ctx = this.ctx, spb = 60 / T.bpm;
        while (this.next < ctx.currentTime + 0.25) {
            const bar = Math.floor(this.beat / 3) % 8, b = this.beat % 3, at = this.next;
            const [root, third, fifth] = T.chords[bar];
            if (b === 0) this.tone({ f: mtof(root), dur: spb * 1.4, type: 'triangle', vol: 0.2, at, dest: this.music, verb: 0.1 });
            else { for (const n of [third, fifth]) this.tone({ f: mtof(n), dur: spb * 0.5, type: 'sine', vol: 0.05, at, dest: this.music, verb: 0.3 }); }
            const m = T.mel[(this.beat) % T.mel.length];
            if (m) {
                // a music box: a bright sine with an octave shimmer and a long tail
                this.tone({ f: mtof(m), dur: spb * 1.6, type: 'sine', vol: 0.16, at, dest: this.music, verb: 0.5, attack: 0.003 });
                this.tone({ f: mtof(m + 12), dur: spb * 0.5, type: 'triangle', vol: 0.04, at, dest: this.music, verb: 0.5, attack: 0.003 });
            } else if (b === 2 && Math.random() < 0.18) {
                this.tone({ f: mtof(84 + [0, 2, 4, 7][Math.floor(Math.random() * 4)]), dur: 0.5, vol: 0.03, at, dest: this.music, verb: 0.8 });
            }
            this.next += spb;
            this.beat++;
        }
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone({ f: 700, dur: 0.06, type: 'triangle', vol: 0.1, verb: 0.05 });
        else if (kind === 'open') this.tone({ f: 440, to: 700, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ f: 700, to: 440, dur: 0.1, type: 'triangle', vol: 0.12 });
        else if (kind === 'page') this.noise({ dur: 0.12, vol: 0.06, from: 3000, to: 1200, q: 0.6 });
        else if (kind === 'select') this.tone({ f: 520, to: 620, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'text') this.tone({ f: 330 + Math.random() * 40, dur: 0.03, type: 'square', vol: 0.02, verb: 0 });
    }
    note(n, ok = null) {
        if (!this.ok) return;
        this.tone({ f: mtof(NOTE_MIDI[n]), dur: 0.9, type: 'sine', vol: 0.22, verb: 0.5 });
        this.tone({ f: mtof(NOTE_MIDI[n] + 12), dur: 0.4, type: 'triangle', vol: 0.05, verb: 0.5 });
        if (ok === false) this.tone({ f: 160, to: 110, dur: 0.4, type: 'sawtooth', vol: 0.08, at: this.ctx.currentTime + 0.2 });
    }
    giggle() {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        [880, 1046, 988, 1244, 1175].forEach((f, i) => this.tone({ f, to: f * 1.12, dur: 0.09, type: 'sine', vol: 0.09, at: t + i * 0.075, vib: 20, verb: 0.5 }));
    }
    onEvents(G, events) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        for (const e of events) {
            if (e.type === 'give') { this.tone({ f: 660, dur: 0.12, vol: 0.14 }); this.tone({ f: 990, dur: 0.2, vol: 0.14, at: t + 0.09 }); }
            else if (e.type === 'take') this.tone({ f: 400, to: 300, dur: 0.1, type: 'triangle', vol: 0.08 });
            else if (e.type === 'clue') [523, 659, 784].forEach((f, i) => this.tone({ f, dur: 0.5, vol: 0.12, at: t + i * 0.09, verb: 0.5 }));
            else if (e.type === 'room') { this.noise({ dur: 0.7, vol: 0.12, from: 200, to: 420, q: 4 }); this.tone({ f: 130, to: 180, dur: 0.6, type: 'sawtooth', vol: 0.03, verb: 0.3 }); }
            else if (e.type === 'unlock') { this.tone({ f: 200, to: 100, dur: 0.12, type: 'square', vol: 0.1, verb: 0 }); this.tone({ f: 320, dur: 0.2, type: 'triangle', vol: 0.14, at: t + 0.12 }); this.noise({ dur: 0.5, vol: 0.1, from: 300, to: 700, q: 6, at: t + 0.2 }); }
            else if (e.type === 'nope' || e.type === 'wrong') this.tone({ f: 220, to: 140, dur: 0.3, type: 'triangle', vol: 0.14 });
            else if (e.type === 'code') { if (e.ok) [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, dur: 0.3, vol: 0.12, at: t + i * 0.08 })); else this.tone({ f: 180, to: 120, dur: 0.35, type: 'sawtooth', vol: 0.1 }); }
            else if (e.type === 'book') { this.noise({ dur: 0.12, vol: 0.14, from: 300, to: 120, q: 1 }); if (!e.ok) this.tone({ f: 180, to: 90, dur: 0.3, type: 'triangle', vol: 0.1 }); }
            else if (e.type === 'combine') [440, 554, 659].forEach((f, i) => this.tone({ f, dur: 0.2, type: 'triangle', vol: 0.12, at: t + i * 0.07 }));
            else if (e.type === 'place') { this.tone({ f: 330, dur: 0.15, type: 'triangle', vol: 0.14 }); this.tone({ f: 660, dur: 0.3, vol: 0.12, at: t + 0.1 }); }
            else if (e.type === 'ding') { this.tone({ f: 1568, dur: 1.2, vol: 0.2, verb: 0.6 }); this.tone({ f: 2093, dur: 0.8, vol: 0.08, verb: 0.6 }); }
            else if (e.type === 'solved') [392, 494, 587, 784, 988].forEach((f, i) => this.tone({ f, dur: 0.8, vol: 0.14, at: t + i * 0.12, verb: 0.6 }));
            else if (e.type === 'wisp' || (e.type === 'spook' && e.kind === 'giggle')) this.giggle();
            else if (e.type === 'spook') {
                if (e.kind === 'creak') this.tone({ f: 90, to: 160, dur: 0.9, type: 'sawtooth', vol: 0.05, verb: 0.3, vib: 6 });
                else if (e.kind === 'breeze') this.noise({ dur: 1.6, vol: 0.12, from: 300, to: 900, q: 2 });
                else if (e.kind === 'sheet') this.noise({ dur: 1.4, vol: 0.08, from: 1200, to: 400, q: 1 });
                else this.noise({ dur: 0.4, vol: 0.05, from: 2000, to: 800, q: 2 });
            } else if (e.type === 'party') this.play('party');
            else if (e.type === 'ending') [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ f, dur: 1.2, vol: 0.14, at: t + i * 0.15, verb: 0.6 }));
        }
    }
}
