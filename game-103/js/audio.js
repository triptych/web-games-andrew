// Procedural sound, all Web Audio, no files: a music-box and ukulele-ish score that changes with the
// scene, and effects that answer sim events as the view plays them.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// root = semitones above middle C (60) for each bar's chord; third = 3 for minor, 4 for major
const SCORES = {
    camp: { bpm: 74, scale: [0, 2, 4, 7, 9], bars: [[0, 4], [9, 3], [5, 4], [7, 4]], melody: 0.7, drums: false, lead: 'triangle' },
    battle: { bpm: 108, scale: [0, 2, 4, 7, 9], bars: [[9, 3], [5, 4], [0, 4], [7, 4]], melody: 0.55, drums: true, lead: 'square' },
    boss: { bpm: 96, scale: [0, 2, 5, 7, 9], bars: [[2, 3], [10, 4], [5, 4], [0, 4]], melody: 0.5, drums: true, lead: 'sawtooth' },
    ending: { bpm: 70, scale: [0, 2, 4, 7, 9], bars: [[0, 4], [7, 4], [9, 3], [5, 4]], melody: 0.8, drums: false, lead: 'triangle' },
};

function lcg(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.mood = null;
        this.step = 0;
        this.next = 0;
        this.timer = null;
        this.blipN = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.45; this.musicBus.connect(comp);
        const len = ctx.sampleRate * 0.5;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let a = 1;
        for (let i = 0; i < len; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }   // seeded noise: no Math.random in the audio either
        if (this.mood) this.music(this.mood, true);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.musicBus.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.05);
    }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, bus = null, attack = 0.008 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx);
        o.start(t); o.stop(t + dur + 0.03);
    }

    noise({ dur = 0.1, vol = 0.15, freq = 1200, delay = 0, bus = null } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(bus || this.sfx);
        s.start(t); s.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'tick') this.tone({ freq: 900, dur: 0.03, type: 'sine', vol: 0.06 });
        else if (kind === 'no') this.tone({ freq: 200, to: 150, dur: 0.12, type: 'square', vol: 0.07 });
    }

    /** One dialogue letter: a tiny blip whose pitch belongs to the speaker. */
    blip(who) {
        const base = { pip: 700, bram: 330, mina: 820, juniper: 520, fenn: 600, pudge: 220, basil: 260, hazel: 440, narrator: 500 }[who] || 500;
        this.tone({ freq: base * (0.95 + (this.blipN++ % 5) * 0.03), dur: 0.04, type: 'triangle', vol: 0.045 });
    }

    // ------------------------------------------------------------------ effects for sim events, as the view plays them
    play(ev, G) {
        switch (ev.type) {
            case 'turn': this.tone({ freq: 784, dur: 0.06, type: 'triangle', vol: 0.07 }); break;
            case 'move': for (let i = 0; i < Math.min(5, ev.path.length - 1); i++) this.tone({ freq: 300 + i * 25, to: 380 + i * 25, dur: 0.05, type: 'sine', vol: 0.08, delay: i * 0.1 }); break;
            case 'skill': this.cast(ev.skill); break;
            case 'hit':
                this.tone({ freq: 190, to: 70, dur: 0.14, type: 'square', vol: 0.16 });
                this.noise({ dur: 0.08, vol: 0.12, freq: 1800 });
                break;
            case 'heal': [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.11, delay: i * 0.07 })); break;
            case 'status': if (ev.on) [988, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.07, delay: i * 0.05 })); break;
            case 'faint': this.tone({ freq: 520, to: 120, dur: 0.5, type: 'triangle', vol: 0.14 }); break;
            case 'oops':
                this.tone({ freq: 900, to: 160, dur: 0.45, type: 'sine', vol: 0.15 });
                this.tone({ freq: 140, to: 80, dur: 0.15, type: 'square', vol: 0.1, delay: 0.42 });
                break;
            case 'lucky': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.12, delay: i * 0.05 })); break;
            case 'item': [784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: ev.give ? 0.08 : 0.11, delay: i * 0.06 })); break;
            case 'drop': [1319, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'sine', vol: 0.08, delay: i * 0.05 })); break;
            case 'pickup': [784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.1, delay: i * 0.05 })); break;
            case 'mp': [1047, 1319, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.09, delay: i * 0.05 })); break;
            case 'sleepy': this.tone({ freq: 330, to: 220, dur: 0.3, type: 'sine', vol: 0.1 }); break;
            case 'resist': this.ui('no'); break;
            case 'rescue': [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.13, delay: i * 0.09 })); break;
            case 'end':
                if (ev.result === 'win') [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.15, delay: i * 0.14 }));
                else [392, 349, 311, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.12, delay: i * 0.22 }));
                break;
            default: break;
        }
    }

    cast(id) {
        const kind = { sparkle: 'chime', crown: 'chime', stars: 'chime', heal: 'chime', bloom: 'chime', zzz: 'soft', shield: 'soft', arrow: 'twang', slash: 'swish', stomp: 'thud', smite: 'thud' };
        const fx = id;
        const k = kind[fx] || 'swish';
        if (k === 'chime') [880, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'sine', vol: 0.08, delay: i * 0.05 }));
        else if (k === 'twang') { this.tone({ freq: 420, to: 180, dur: 0.12, type: 'sawtooth', vol: 0.07 }); this.noise({ dur: 0.1, vol: 0.05, freq: 3000 }); }
        else if (k === 'thud') this.tone({ freq: 120, to: 50, dur: 0.3, type: 'sine', vol: 0.2 });
        else if (k === 'soft') this.tone({ freq: 392, to: 523, dur: 0.25, type: 'triangle', vol: 0.09 });
        else this.noise({ dur: 0.12, vol: 0.1, freq: 2400 });
    }

    // ------------------------------------------------------------------ music
    music(mood) {
        this.mood = mood;
        if (!this.ctx) return;
        if (this._playing === mood) return;
        this._playing = mood;
        this.step = 0;
        this.next = this.ctx.currentTime + 0.1;
        if (!this.timer) this.timer = setInterval(() => this._schedule(), 60);
    }

    stopMusic() { this.mood = null; this._playing = null; }

    _schedule() {
        if (!this.ctx || this.ctx.state !== 'running' || !this._playing) return;
        const sc = SCORES[this._playing];
        const eighth = 60 / sc.bpm / 2;
        while (this.next < this.ctx.currentTime + 0.25) {
            this._note(sc, this.step, this.next, eighth);
            this.next += eighth;
            this.step++;
        }
    }

    _note(sc, step, t, eighth) {
        const bar = Math.floor(step / 8) % sc.bars.length;
        const pos = step % 8;
        const [root, third] = sc.bars[bar];
        const tones = [root, root + third, root + 7, root + 12];
        const v = this.ctx;
        const m = this.musicBus;
        const at = (delay) => t - v.currentTime + delay;
        // bass on beats 1 and 3
        if (pos === 0 || pos === 4) this.tone({ freq: midi(48 + root + (pos === 4 ? 7 : 0)), dur: eighth * 3, type: 'triangle', vol: 0.34, delay: at(0), bus: m });
        // arpeggio: a plucked ukulele
        const arp = [0, 1, 2, 1, 3, 2, 1, 2][pos];
        this.tone({ freq: midi(60 + tones[arp]), dur: eighth * 1.6, type: 'triangle', vol: 0.16, delay: at(0), bus: m, attack: 0.004 });
        // a lead drawn from the scale, repeatable per bar so the tune loops
        const rnd = lcg(bar * 7919 + pos * 104729 + sc.bpm);
        if (pos % 2 === 0 && rnd() < sc.melody) {
            const n = sc.scale[Math.floor(rnd() * sc.scale.length)] + (rnd() < 0.35 ? 12 : 0);
            this.tone({ freq: midi(72 + n), dur: eighth * 2.4, type: sc.lead === 'square' ? 'triangle' : sc.lead, vol: 0.12, delay: at(0), bus: m, attack: 0.01 });
        }
        if (sc.drums) {
            if (pos % 4 === 0) this.tone({ freq: 90, to: 45, dur: 0.12, type: 'sine', vol: 0.3, delay: at(0), bus: m });
            if (pos % 2 === 1) this.noise({ dur: 0.04, vol: 0.05, freq: 6000, delay: at(0), bus: m });
        }
    }
}
