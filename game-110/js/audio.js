// Procedural sound, all Web Audio, no files.
//
// Music: a little music-box waltz in 3/4 with pizzicato bass and a soft pad. It is in C major while the castle is
// cosy and turns to A minor once the Overlord is Feared, at the next bar. Effects answer sim events: crafting pops
// climb a pentatonic scale as flow builds, the cackle is four formant-filtered "ha"s over a rumble.

const MAJOR = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [7, 11, 14]];   // C F G C Am F G G
const MINOR = [[9, 12, 16], [2, 5, 9], [4, 8, 11], [9, 12, 16], [5, 9, 12], [2, 5, 9], [4, 8, 11], [4, 8, 11]];    // Am Dm E Am F Dm E E
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
        this.bar = 0; this.beat = 0; this.next = 0;
        this.minor = false;
        this.wantMinor = false;
        this.lastCraft = 0;
        this.room = 'cook';
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a small room: a convolver fed from a noise impulse
        const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.28;
        this.verb.connect(wet); wet.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.next = ctx.currentTime + 0.2;
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }
    get live() { return this.ctx && this.ctx.state === 'running'; }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, out = this.sfx, verb = 0, attack = 0.008 } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out);
        if (verb) { const s = this.ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
        o.start(t); o.stop(t + dur + 0.03);
    }
    noise({ dur = 0.3, vol = 0.2, freq = 800, q = 0.8, type = 'lowpass', delay = 0, to } = {}) {
        if (!this.live) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx);
        s.start(t); s.stop(t + dur + 0.05);
    }
    /** One "ha": a buzzy voice through two vowel formants, with a wobble. */
    ha(pitch, delay, vol = 0.22) {
        if (!this.live) return;
        const ctx = this.ctx, t = ctx.currentTime + delay, d = 0.15;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(pitch * 1.15, t); o.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + d);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = pitch * 0.05; lfo.connect(lg); lg.connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        for (const [f, q, v] of [[780, 7, 1], [1250, 9, 0.6]]) {
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
            const bg = ctx.createGain(); bg.gain.value = v * 3;
            o.connect(bp); bp.connect(bg); bg.connect(g);
        }
        g.connect(this.sfx);
        const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.verb);
        o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 523, to: 784, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 784, to: 523, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'no') this.tone({ freq: 220, to: 180, dur: 0.12, type: 'square', vol: 0.08 });
        else if (kind === 'buy') [0, 4, 7].forEach((s, i) => this.tone({ freq: mtof(79 + s), dur: 0.1, type: 'triangle', vol: 0.12, delay: i * 0.04 }));
    }

    // ------------------------------------------------------------------ effects for sim events
    onEvents(G, events) {
        let crafts = 0;
        for (const e of events) {
            switch (e.type) {
                case 'craft': {
                    if (crafts++ > 2) break;                 // a flurry of taps in one frame is still one sound
                    const deg = Math.min(PENTA.length - 1, Math.floor(e.flow / 10));
                    const f = mtof(72 + PENTA[deg] + (this.minor ? -3 : 0));
                    if (e.room === 'cook') { this.tone({ freq: f * 0.7, to: f * 1.3, dur: 0.09, type: 'sine', vol: 0.22 }); }
                    else if (e.room === 'sew') { this.tone({ freq: f * 2, dur: 0.05, type: 'square', vol: 0.06 }); this.tone({ freq: f, dur: 0.08, type: 'triangle', vol: 0.14 }); }
                    else if (e.room === 'deco') { this.tone({ freq: f * 2, dur: 0.35, type: 'sine', vol: 0.12, verb: 0.5 }); this.tone({ freq: f * 3, dur: 0.2, type: 'sine', vol: 0.04 }); }
                    else { this.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.18, verb: 0.3 }); }
                    break;
                }
                case 'cackle': {
                    const base = 240 + Math.random() * 20;
                    [1.12, 1, 0.9, 0.78].forEach((k, i) => this.ha(base * k, i * 0.17));
                    this.noise({ dur: 1.1, vol: 0.18, freq: 160, to: 60, q: 0.6 });
                    break;
                }
                case 'buy': [0, 4, 7, 12].slice(0, e.n > 1 ? 4 : 3).forEach((s, i) => this.tone({ freq: mtof(76 + s), dur: 0.1, type: 'square', vol: 0.07, delay: i * 0.045 })); break;
                case 'upgrade': [0, 4, 7, 11, 14].forEach((s, i) => this.tone({ freq: mtof(84 + s), dur: 0.18, type: 'sine', vol: 0.1, delay: i * 0.05, verb: 0.4 })); break;
                case 'decor': this.noise({ dur: 0.5, vol: 0.12, freq: 3000, to: 600, type: 'bandpass', q: 1 }); [0, 7, 12, 16].forEach((s, i) => this.tone({ freq: mtof(79 + s), dur: 0.3, type: 'sine', vol: 0.12, delay: 0.05 + i * 0.07, verb: 0.5 })); break;
                case 'hench': this.tone({ freq: 200, to: 320, dur: 0.15, type: 'square', vol: 0.1 }); this.tone({ freq: 320, to: 200, dur: 0.12, type: 'square', vol: 0.08, delay: 0.15 }); break;
                case 'visitor':
                    if (e.kind === 'hero') [0, 5, 9, 12].forEach((s, i) => this.tone({ freq: mtof(67 + s), dur: 0.16, type: 'sawtooth', vol: 0.07, delay: i * 0.11 }));
                    else { this.tone({ freq: mtof(88), dur: 0.5, type: 'sine', vol: 0.16, verb: 0.6 }); this.tone({ freq: mtof(84), dur: 0.7, type: 'sine', vol: 0.16, delay: 0.32, verb: 0.6 }); }
                    break;
                case 'greet':
                    if (e.kind === 'kitten') { this.tone({ freq: 700, to: 1100, dur: 0.18, type: 'sine', vol: 0.14 }); this.tone({ freq: 1100, to: 600, dur: 0.3, type: 'sine', vol: 0.12, delay: 0.18 }); }
                    else if (e.kind === 'critic') [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ freq: mtof(76 + s), dur: 0.25, type: 'triangle', vol: 0.12, delay: i * 0.06, verb: 0.4 }));
                    else if (e.kind === 'bard') [0, 4, 7, 12, 7, 4].forEach((s, i) => this.tone({ freq: mtof(64 + s), dur: 0.3, type: 'triangle', vol: 0.12, delay: i * 0.035 }));
                    else { this.tone({ freq: 900, to: 1500, dur: 0.15, type: 'square', vol: 0.08 }); this.coin(0.2); }
                    break;
                case 'heroGossip': [0, -1, -2, -6].forEach((s, i) => this.tone({ freq: mtof(58 + s), dur: i === 3 ? 0.6 : 0.22, type: 'sawtooth', vol: 0.08, delay: i * 0.24 })); break;
                case 'ability':
                    if (e.id === 'taste') { this.noise({ dur: 0.35, vol: 0.12, freq: 600, to: 2400, type: 'bandpass', q: 3 }); this.tone({ freq: 500, to: 900, dur: 0.2, type: 'sine', vol: 0.12, delay: 0.3 }); }
                    else if (e.id === 'storm') { this.noise({ dur: 2.4, vol: 0.4, freq: 300, to: 40, q: 0.5 }); this.noise({ dur: 0.2, vol: 0.3, freq: 4000, type: 'highpass' }); }
                    else if (e.id === 'soiree') { this.tone({ freq: 300, to: 700, dur: 0.4, type: 'sawtooth', vol: 0.08 }); [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: mtof(72 + s), dur: 0.6, type: 'triangle', vol: 0.1, delay: 0.3 + i * 0.03, verb: 0.5 })); }
                    break;
                case 'schemeDone': this.tone({ freq: mtof(e.kind === 'evil' ? 69 : 81), dur: 0.5, type: 'sine', vol: 0.14, verb: 0.5 }); if (e.gold) this.coin(0.1); break;
                case 'heirloom': [0, 3, 7, 10, 14, 17].forEach((s, i) => this.tone({ freq: mtof(79 + s), dur: 0.4, type: 'sine', vol: 0.1, delay: i * 0.07, verb: 0.7 })); break;
                case 'ach': [0, 4, 7, 12].forEach((s, i) => this.tone({ freq: mtof(72 + s), dur: i === 3 ? 0.4 : 0.12, type: 'square', vol: 0.06, delay: i * 0.09 })); break;
                case 'relocate': this.noise({ dur: 1.4, vol: 0.2, freq: 200, to: 4000, type: 'bandpass', q: 0.7 }); [0, 4, 7, 11, 14].forEach((s, i) => this.tone({ freq: mtof(60 + s), dur: 2, type: 'triangle', vol: 0.08, delay: 0.8, verb: 0.8 })); break;
                case 'tier':
                    if (e.to === 'suspected') { this.tone({ freq: mtof(64), dur: 0.25, type: 'triangle', vol: 0.12 }); this.tone({ freq: mtof(61), dur: 0.5, type: 'triangle', vol: 0.12, delay: 0.25 }); }
                    else if (e.to === 'dreaded') [0, 3, 7].forEach((s) => this.tone({ freq: mtof(45 + s), dur: 1.2, type: 'sawtooth', vol: 0.05, verb: 0.8 }));
                    break;
                case 'perk': [0, 7, 12].forEach((s, i) => this.tone({ freq: mtof(67 + s), dur: 0.3, type: 'sine', vol: 0.12, delay: i * 0.08, verb: 0.6 })); break;
                case 'room': this.noise({ dur: 0.35, vol: 0.12, freq: 400, to: 2400, type: 'bandpass', q: 2 }); break;
                default: break;
            }
        }
    }
    coin(delay = 0) { this.tone({ freq: 988, dur: 0.06, type: 'square', vol: 0.07, delay }); this.tone({ freq: 1319, dur: 0.18, type: 'square', vol: 0.07, delay: delay + 0.06 }); }

    // ------------------------------------------------------------------ the waltz
    /** Schedule music a little ahead. Called every frame. */
    tick(G) {
        if (!this.live || this.musicVol <= 0.001) return;
        this.wantMinor = G ? G.dread >= 50 : false;
        this.room = G?.room || 'cook';
        const beatLen = 60 / 132;
        const ctx = this.ctx;
        if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;
        while (this.next < ctx.currentTime + 0.25) {
            const t = this.next - ctx.currentTime;
            if (this.beat === 0 && this.bar % 8 === 0) this.minor = this.wantMinor;
            const prog = this.minor ? MINOR : MAJOR;
            const ch = prog[this.bar % 8];
            const root = 48 + (this.minor ? -12 : 0) + ch[0] + (this.minor ? 12 : 0);
            const m = this.music;
            if (this.beat === 0) {
                this.tone({ freq: mtof(root - 12), dur: 0.5, type: 'triangle', vol: 0.22, delay: t, out: m });
                if (this.bar % 2 === 0) for (const n of ch) this.tone({ freq: mtof(60 + n), dur: beatLen * 3, type: 'sine', vol: 0.025, delay: t, out: m, attack: 0.3 });
            } else {
                for (const n of ch) this.tone({ freq: mtof(60 + n), dur: 0.12, type: 'triangle', vol: 0.035, delay: t, out: m });
            }
            // the music box: a chord tone most beats, a passing note sometimes
            const r = Math.random();
            if (r < 0.78) {
                const pool = ch.map((n) => n + 72);
                let note = pool[(Math.random() * pool.length) | 0] + (Math.random() < 0.2 ? 12 : 0);
                if (Math.random() < 0.18) note += this.minor ? 2 : 2;
                const box = { cook: 'sine', sew: 'triangle', deco: 'sine', party: 'triangle' }[this.room];
                this.tone({ freq: mtof(note), dur: 0.5, type: box, vol: 0.06, delay: t, out: m, verb: 0.6 });
                this.tone({ freq: mtof(note + 12), dur: 0.2, type: 'sine', vol: 0.015, delay: t, out: m });
                if (Math.random() < 0.25) this.tone({ freq: mtof(note + (Math.random() < 0.5 ? 2 : -1)), dur: 0.3, type: box, vol: 0.04, delay: t + beatLen / 2, out: m, verb: 0.5 });
            }
            this.beat = (this.beat + 1) % 3;
            if (this.beat === 0) this.bar++;
            this.next += beatLen;
        }
    }
}
