// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a gentle
// generated tune (a music-box melody over a slow chord loop) that follows the time of day, with
// birds by day, crickets at night and rain when it rains. The context is made on the first user
// gesture; ../lib/page-audio.js suspends it while the tab is hidden.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PENT = [0, 2, 4, 7, 9];                 // major pentatonic: nothing can sound wrong
const CHORDS = [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]];   // C, Am, F, G (root-based semitones from the key)

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.muted = false;
        this.bar = 0; this.step = 0; this.nextT = 0; this.key = 60;
        this.hour = 10; this.weather = 'clear';
        this.chirpT = 0; this.tickT = 0;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        // a small warm room for everything
        this.verb = ctx.createConvolver();
        const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        this.verb.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.28;
        this.verb.connect(wet); wet.connect(comp);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp); this.sfx.connect(this.verb);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp); this.music.connect(this.verb);
        this.amb = ctx.createGain(); this.amb.gain.value = 0.5; this.amb.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.nextT = ctx.currentTime + 0.3;
        this.rain = this.makeRain();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
    }
    get on() { return this.ctx && this.ctx.state === 'running' && !this.muted; }

    // ---------------------------------------------------------------- building blocks
    tone({ freq = 440, to = freq, dur = 0.15, type = 'sine', vol = 0.2, delay = 0, bus = null, attack = 0.008 } = {}) {
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
    noise({ dur = 0.1, vol = 0.15, freq = 1200, q = 0.7, type = 'lowpass', delay = 0, bus = null } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(bus || this.sfx);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
    }
    arp(notes, { step = 0.08, type = 'triangle', vol = 0.16, dur = 0.3 } = {}) {
        notes.forEach((n, i) => this.tone({ freq: NOTE(n), dur, type, vol, delay: i * step }));
    }

    // ---------------------------------------------------------------- effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, to: 760, dur: 0.06, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 700, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 700, to: 440, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'no') this.tone({ freq: 180, to: 130, dur: 0.18, type: 'square', vol: 0.08 });
        else if (kind === 'place') { this.tone({ freq: 120, to: 60, dur: 0.18, type: 'sine', vol: 0.3 }); this.noise({ dur: 0.1, freq: 600, vol: 0.12 }); }
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'hit': case 'felled':
                    if (e.k === 'tree') { this.noise({ dur: 0.08, freq: 900, vol: 0.22, q: 1.5 }); this.tone({ freq: 190, to: 110, dur: 0.1, type: 'triangle', vol: 0.2 }); }
                    else if (e.k === 'rock') { this.noise({ dur: 0.06, freq: 3200, vol: 0.2, type: 'highpass' }); this.tone({ freq: 520, to: 400, dur: 0.07, type: 'square', vol: 0.06 }); }
                    else this.tone({ freq: 700, to: 1000, dur: 0.1, type: 'sine', vol: 0.12 });
                    if (e.type === 'felled') this.arp([72, 76], { step: 0.06, vol: 0.1, dur: 0.2 });
                    break;
                case 'placed': this.ui('place'); break;
                case 'built': case 'upgraded': this.arp([67, 71, 74, 79], { step: 0.09, vol: 0.14 }); break;
                case 'claimed': this.arp([72, 76, 79, 84], { step: 0.08, vol: 0.16 }); break;
                case 'journalReady': this.arp([76, 83], { step: 0.1, vol: 0.12 }); break;
                case 'sale': case 'sell': this.tone({ freq: 1568, dur: 0.12, type: 'sine', vol: 0.12 }); this.tone({ freq: 2093, dur: 0.18, type: 'sine', vol: 0.1, delay: 0.07 }); break;
                case 'craft': this.tone({ freq: 880, to: 1100, dur: 0.1, type: 'triangle', vol: 0.08 }); break;
                case 'hired': case 'welcomed': case 'special': this.arp([67, 72, 76, 79, 84], { step: 0.07, vol: 0.13 }); break;
                case 'newcomer': this.tone({ freq: 988, dur: 0.4, type: 'sine', vol: 0.12 }); this.tone({ freq: 1319, dur: 0.5, type: 'sine', vol: 0.1, delay: 0.14 }); break;
                case 'levelup': this.arp([72, 76, 79, 84, 88], { step: 0.06, vol: 0.12, dur: 0.25 }); break;
                case 'questStart': this.tone({ freq: 392, dur: 0.18, type: 'sawtooth', vol: 0.06 }); this.tone({ freq: 523, dur: 0.3, type: 'sawtooth', vol: 0.06, delay: 0.16 }); break;
                case 'questDone':
                    if (e.outcome === 'win') this.arp([72, 79, 76, 84], { step: 0.1, vol: 0.14 });
                    else if (e.outcome === 'part') this.arp([72, 76], { step: 0.12, vol: 0.1 });
                    else this.arp([64, 60], { step: 0.18, type: 'sine', vol: 0.12, dur: 0.4 });
                    break;
                case 'raidWarn': this.tone({ freq: 196, dur: 0.5, type: 'sawtooth', vol: 0.09 }); this.tone({ freq: 147, dur: 0.7, type: 'sawtooth', vol: 0.09, delay: 0.4 }); break;
                case 'raid': e.win ? this.arp([67, 72, 76, 79], { step: 0.1, vol: 0.14 }) : this.arp([55, 52, 48], { step: 0.2, type: 'sawtooth', vol: 0.09, dur: 0.5 }); break;
                case 'research': this.arp([69, 76, 81], { step: 0.08, vol: 0.14 }); break;
                case 'festival': case 'won': this.arp([72, 76, 79, 84, 79, 84, 88], { step: 0.12, vol: 0.14, dur: 0.4 }); break;
                case 'merchant': this.tone({ freq: 1175, dur: 0.1, type: 'triangle', vol: 0.1 }); this.tone({ freq: 1175, dur: 0.1, type: 'triangle', vol: 0.1, delay: 0.12 }); break;
                case 'toast': if (e.kind === 'bad') this.ui('no'); break;
                default: break;
            }
        }
    }

    // ---------------------------------------------------------------- music
    /** Called every frame: schedule a little ahead so the tune never stutters. */
    tick(hour, weather, dt) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        this.hour = hour; this.weather = weather;
        const ctx = this.ctx;
        const night = hour >= 21 || hour < 5;
        const bpm = night ? 58 : hour < 9 || hour >= 18 ? 70 : 80;
        const spb = 60 / bpm;
        if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.1;
        let guard = 0;
        while (this.nextT < ctx.currentTime + 0.4 && guard++ < 8) {
            this.scheduleStep(this.nextT, night, spb);
            this.nextT += spb / 2;
            if (++this.step >= 8) { this.step = 0; this.bar = (this.bar + 1) % 8; }
        }
        // ambience
        this.chirpT -= dt; this.tickT -= dt;
        if (!this.muted) {
            if (!night && weather !== 'rain' && this.chirpT <= 0) { this.chirpT = 2 + Math.random() * 5; const f = 2200 + Math.random() * 1600; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone({ freq: f, to: f * (1.1 + Math.random() * 0.3), dur: 0.07, type: 'sine', vol: 0.025, delay: i * 0.11, bus: this.amb }); }
            if (night && this.tickT <= 0) { this.tickT = 0.5 + Math.random() * 1.2; for (let i = 0; i < 3; i++) this.tone({ freq: 4300, dur: 0.03, type: 'square', vol: 0.006, delay: i * 0.06, bus: this.amb }); }
        }
        if (this.rain) this.rain.gain.gain.setTargetAtTime(weather === 'rain' && !this.muted ? 0.09 : 0, ctx.currentTime, 0.4);
    }

    makeRain() {
        const ctx = this.ctx;
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 0.4;
        const g = ctx.createGain(); g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(this.amb); s.start();
        return { gain: g };
    }

    scheduleStep(t, night, spb) {
        if (this.muted || this.musicVol <= 0.01) return;
        const ctx = this.ctx;
        const chord = CHORDS[Math.floor(this.bar / 2) % 4];
        const lift = night ? -12 : 0;
        const at = t - ctx.currentTime;
        // a slow pad on the first beat of each bar
        if (this.step === 0 && this.bar % 2 === 0) {
            for (const c of chord) this.tone({ freq: NOTE(this.key - 12 + c + lift), dur: spb * 3.6, type: 'triangle', vol: 0.05, delay: at, bus: this.music, attack: 0.3 });
            this.tone({ freq: NOTE(this.key - 24 + chord[0]), dur: spb * 2.4, type: 'sine', vol: 0.09, delay: at, bus: this.music, attack: 0.05 });
        }
        // the music-box melody: wanders on the pentatonic scale, mostly stepwise, with rests
        const rest = night ? 0.62 : 0.4;
        if (Math.random() > rest) {
            this.deg = (this.deg ?? 2) + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.25 ? 2 : 1);
            this.deg = Math.max(0, Math.min(9, this.deg));
            const n = this.key + 12 + lift + PENT[this.deg % 5] + 12 * Math.floor(this.deg / 5);
            this.tone({ freq: NOTE(n), dur: spb * 1.4, type: 'sine', vol: 0.09, delay: at, bus: this.music });
            this.tone({ freq: NOTE(n + 12), dur: spb * 0.6, type: 'sine', vol: 0.025, delay: at, bus: this.music });
        }
    }
}
