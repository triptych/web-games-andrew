// Procedural sound, all Web Audio, no files: a music-box lullaby over a soft pad, cave drips while walking, and
// little sounds for every tool and every sim event. The context starts on the first gesture; ../lib/page-audio.js
// suspends it while the tab is hidden.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];          // major pentatonic, two octaves
const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];   // I vi IV V, in semitones from the root
const ROOT = 62;                                               // D4

const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.walking = false;
        this.step = 0;
        this.nextT = 0;
        this.dripT = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3;
        comp.connect(ctx.destination);
        // a soft reverb from a decaying noise impulse: everything sounds like it's in a stone room
        const len = ctx.sampleRate * 2.2, imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = imp.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        this.verb = ctx.createConvolver(); this.verb.buffer = imp;
        const wet = ctx.createGain(); wet.gain.value = 0.32;
        this.verb.connect(wet); wet.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp); this.sfx.connect(this.verb);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(comp); this.music.connect(this.verb);
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noise.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.nextT = ctx.currentTime + 0.2;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
        this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.03);
    }

    ok() { return this.ctx && this.ctx.state === 'running'; }

    tone({ f = 440, to = f, dur = 0.15, type = 'sine', vol = 0.15, delay = 0, out = this.sfx, attack = 0.01 } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + dur + 0.05);
    }

    hiss({ dur = 0.2, vol = 0.1, f = 1200, q = 1, type = 'bandpass', delay = 0, to = f } = {}) {
        if (!this.ok()) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = this.noise;
        fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
        if (to !== f) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl); fl.connect(g); g.connect(this.sfx);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }

    /** Builder sounds. */
    ui(kind) {
        if (kind === 'click') this.tone({ f: 520, to: 480, dur: 0.06, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ f: 440, to: 660, dur: 0.12, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ f: 660, to: 440, dur: 0.12, type: 'triangle', vol: 0.1 });
        else if (kind === 'roll') { for (let i = 0; i < 5; i++) this.tone({ f: 300 + Math.random() * 400, dur: 0.05, type: 'square', vol: 0.04, delay: i * 0.05 }); this.chime(0.28); }
        else if (kind === 'grow') { this.hiss({ dur: 0.5, vol: 0.06, f: 300, to: 1800, q: 2 }); [0, 4, 7].forEach((s, i) => this.tone({ f: freq(ROOT + 12 + s), dur: 0.4, type: 'sine', vol: 0.06, delay: 0.1 + i * 0.06 })); }
        else if (kind === 'paint') { this.hiss({ dur: 0.18, vol: 0.12, f: 900, q: 0.8 }); this.tone({ f: 330, dur: 0.12, type: 'triangle', vol: 0.06 }); }
        else if (kind === 'stamp') { this.tone({ f: 180, to: 90, dur: 0.12, type: 'sine', vol: 0.22 }); this.tone({ f: 880, to: 1320, dur: 0.12, type: 'triangle', vol: 0.07, delay: 0.05 }); }
        else if (kind === 'erase') this.hiss({ dur: 0.3, vol: 0.12, f: 2400, to: 600, q: 1.5 });
        else if (kind === 'nope') this.tone({ f: 220, to: 180, dur: 0.18, type: 'triangle', vol: 0.12 });
        else if (kind === 'level') { this.hiss({ dur: 0.45, vol: 0.05, f: 500, to: 200, q: 1 }); this.tone({ f: 392, to: 262, dur: 0.35, type: 'sine', vol: 0.08 }); }
        else if (kind === 'copy') this.chime(0);
    }

    chime(delay = 0) { [0, 4, 7, 12].forEach((s, i) => this.tone({ f: freq(ROOT + 12 + s), dur: 0.5, type: 'sine', vol: 0.08, delay: delay + i * 0.07 })); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'step') {
                if (e.water) this.hiss({ dur: 0.18, vol: 0.12, f: 1600, q: 0.7 });
                else { this.hiss({ dur: 0.07, vol: 0.18, f: 260, q: 1.2, type: 'lowpass' }); this.tone({ f: 90, to: 60, dur: 0.06, vol: 0.06 }); }
            } else if (e.type === 'splash') this.hiss({ dur: 0.4, vol: 0.2, f: 2200, to: 700, q: 0.6 });
            else if (e.type === 'befriend') { [0, 4, 7, 11, 12].forEach((s, i) => this.tone({ f: freq(ROOT + 12 + s), dur: 0.35, type: 'triangle', vol: 0.08, delay: i * 0.08 })); this.tone({ f: 600, to: 900, dur: 0.15, type: 'sine', vol: 0.06, delay: 0.45 }); }
            else if (e.type === 'loot') { for (let i = 0; i < 7; i++) this.tone({ f: 1800 + (i % 3) * 400, to: 2400, dur: 0.08, type: 'square', vol: 0.03, delay: i * 0.05 }); this.chime(0.35); }
            else if (e.type === 'stairs') for (let i = 0; i < 5; i++) this.hiss({ dur: 0.07, vol: 0.14, f: 300 - i * 20, q: 1.2, type: 'lowpass', delay: i * 0.13 });
            else if (e.type === 'exit') this.tone({ f: 330, to: 494, dur: 0.4, type: 'triangle', vol: 0.1 });
        }
    }

    /** Called every frame: schedules the lullaby a little ahead, and drips while walking. */
    update() {
        if (!this.ok()) return;
        const ctx = this.ctx, now = ctx.currentTime;
        if (this.musicVol > 0.001) {
            const beat = 0.42;
            while (this.nextT < now + 0.4) {
                const t = this.nextT, s = this.step++;
                const bar = Math.floor(s / 8) % 4, chord = CHORDS[bar];
                if (s % 8 === 0) for (const n of chord) this.pad(freq(ROOT - 12 + n), t, beat * 8);
                // the music box: a gentle pattern that wanders over the pentatonic scale
                const pat = [0, 2, 1, 2, 3, 2, 1, 4];
                const deg = (pat[s % 8] + bar * 2 + (Math.floor(s / 32) % 2) * 3) % SCALE.length;
                if (s % 8 !== 7 || s % 16 === 15) this.box(freq(ROOT + 12 + SCALE[deg]), t);
                this.nextT += beat;
            }
        } else this.nextT = now + 0.2;
        if (this.walking && now > this.dripT) {
            this.dripT = now + 1.5 + Math.random() * 4;
            const f = 1400 + Math.random() * 1600;
            this.tone({ f, to: f * 1.6, dur: 0.09, type: 'sine', vol: 0.05 });
        }
    }

    box(f, t) {
        const ctx = this.ctx;
        for (const [m, v] of [[1, 0.07], [3.01, 0.015], [5.4, 0.006]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f * m;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / m);
            o.connect(g); g.connect(this.music);
            o.start(t); o.stop(t + 1.7);
        }
    }

    pad(f, t, dur) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + dur + 0.05);
    }
}
