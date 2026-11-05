// Procedural sound, all Web Audio, no files. Effects answer simulation events; the music is a gentle folk
// loop (a plucked lute, a flute and a soft drone) that changes mood for the road, the town and the Hero.
// The context is made on the first user gesture; ../lib/page-audio.js suspends it while the tab is hidden.

const SCALE = [0, 2, 4, 7, 9];                 // major pentatonic
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.5;
        this.mood = 'town'; this.step = 0; this.nextT = 0; this.timer = null; this.playing = false;
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.4; this.music.connect(comp);
        // a little room: a feedback delay
        const d = ctx.createDelay(1); d.delayTime.value = 0.28;
        const fb = ctx.createGain(); fb.gain.value = 0.3;
        const wet = ctx.createGain(); wet.gain.value = 0.35;
        this.music.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(comp);
    }
    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.4, this.ctx.currentTime, 0.05);
    }
    tone({ freq = 440, to = freq, dur = 0.12, type = 'triangle', vol = 0.2, delay = 0, bus = null, attack = 0.01 } = {}) {
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
    noise(dur = 0.08, vol = 0.1, freq = 3000, delay = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const n = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (((i * 9301 + 49297) % 233280) / 233280) * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
        const g = this.ctx.createGain(); const t = this.ctx.currentTime + delay;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t);
    }
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 620, dur: 0.05, vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 420, to: 640, dur: 0.1, vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 640, to: 420, dur: 0.1, vol: 0.12 });
        else if (kind === 'bad') this.tone({ freq: 220, to: 160, dur: 0.18, type: 'square', vol: 0.1 });
    }
    coin(n = 1) { for (let i = 0; i < Math.min(4, n); i++) { this.tone({ freq: 1320 + i * 90, to: 1760, dur: 0.12, vol: 0.12, delay: i * 0.06 }); this.noise(0.04, 0.05, 6000, i * 0.06); } }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sell') this.coin(2 + Math.min(2, e.n));
            else if (e.type === 'buy') { this.tone({ freq: 520, to: 700, dur: 0.1, vol: 0.12 }); this.coin(1); }
            else if (e.type === 'craft') { for (let i = 0; i < 3; i++) { this.tone({ freq: 180 + i * 20, to: 120, dur: 0.1, type: 'square', vol: 0.12, delay: i * 0.12 }); this.noise(0.05, 0.12, 2500, i * 0.12); } this.tone({ freq: 880, dur: 0.3, vol: 0.1, delay: 0.4 }); }
            else if (e.type === 'quest-done' || e.type === 'hero-sale') [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.22, vol: 0.14, delay: i * 0.09 }));
            else if (e.type === 'levelup') [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.16, delay: i * 0.11 }));
            else if (e.type === 'dialog') this.tone({ freq: 480, to: 520, dur: 0.1, vol: 0.08 });
            else if (e.type === 'road') this.tone({ freq: 300, to: 200, dur: 0.25, type: 'sawtooth', vol: 0.08 });
            else if (e.type === 'arrive') [440, 554, 659].forEach((f, i) => this.tone({ freq: f, dur: 0.2, vol: 0.1, delay: i * 0.08 }));
            else if (e.type === 'ending') [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.6, vol: 0.14, delay: i * 0.16 }));
            else if (e.type === 'wagon') this.coin(4);
        }
    }

    // ---------------------------------------------------------------- music: a look-ahead sequencer
    setMood(m) { this.mood = m; }
    start() {
        if (!this.ctx || this.playing) return;
        this.playing = true;
        this.nextT = this.ctx.currentTime + 0.2;
        this.timer = setInterval(() => this.schedule(), 120);
    }
    schedule() {
        if (!this.ctx || this.ctx.state !== 'running') { this.nextT = Math.max(this.nextT, (this.ctx?.currentTime || 0) + 0.1); return; }
        const spb = this.mood === 'road' ? 0.34 : this.mood === 'hero' ? 0.5 : 0.42;     // seconds per eighth note
        while (this.nextT < this.ctx.currentTime + 0.4) {
            this.note(this.step++, this.nextT, spb);
            this.nextT += spb;
        }
    }
    note(i, t, spb) {
        const root = 55 + (this.mood === 'hero' ? 2 : this.mood === 'road' ? 0 : -1);
        const bar = Math.floor(i / 8) % 4, beat = i % 8;
        const chords = [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]];
        const ch = chords[bar];
        const at = (n, dur, type, vol, bus, delay = 0) => this.toneAt(t + delay, midi(n), dur, type, vol, bus || this.music);
        // lute: plucked arpeggio
        if (beat % 2 === 0 || this.mood === 'road') at(root + ch[(beat >> 1) % 3] + (beat > 5 ? 12 : 0), spb * 2.4, 'triangle', 0.22);
        if (beat === 0) at(root + ch[0] - 12, spb * 6, 'sine', 0.2);
        // flute melody on a pentatonic walk, seeded by the step so it repeats every 4 bars with variation
        const h = (i * 2654435761) >>> 0;
        if (beat === 0 || (beat === 3 && (h & 3) > 0) || (beat === 6 && (h & 4))) {
            const deg = SCALE[(h >> 4) % 5] + 12 * ((h >> 8) & 1);
            at(root + 12 + deg, spb * (beat === 0 ? 3 : 1.6), 'sine', 0.16);
        }
        if (this.mood === 'road' && beat % 4 === 2) this.toneAt(t, 180, 0.06, 'square', 0.03, this.music);
    }
    toneAt(t, freq, dur, type, vol, bus) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    }
}
