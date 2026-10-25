// Procedural sound, all Web Audio, no files. A small band that plays a different tune for the
// title, the roost, battles and bosses (pads, bass, plucked arpeggios, a generated lead, drums),
// and effects that answer sim events: roars, element breath, hits, songs, eggs cracking.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while hidden.

const MOODS = {
    title:  { bpm: 84,  root: 50, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], lead: 'triangle', drums: 'soft', arp: true },
    roost:  { bpm: 92,  root: 55, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'sine', drums: 'none', arp: true },
    battle: { bpm: 126, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], lead: 'square', drums: 'march', arp: true },
    boss:   { bpm: 140, root: 43, scale: [0, 1, 3, 5, 7, 8, 11], prog: [0, 5, 1, 4], lead: 'sawtooth', drums: 'war', arp: true },
    none:   null,
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.mood = 'none';
        this.want = 'title';
        this.beatN = 0;
        this.nextT = 0;
        this.timer = null;
        this.phrase = [];
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.45; this.music.connect(comp);
        // a warm hall reverb from decaying noise
        const len = Math.floor(ctx.sampleRate * 2.2);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb = ctx.createConvolver(); this.verb.buffer = ir;
        this.wet = ctx.createGain(); this.wet.gain.value = 0.35;
        this.verb.connect(this.wet); this.wet.connect(comp);
        this.sfx.connect(this.verb); this.music.connect(this.verb);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        this.nextT = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this._schedule(), 200);
        this.setMood(this.want);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.02);
    }

    get live() { return !!this.ctx && this.ctx.state === 'running'; }

    setMood(m) {
        this.want = m;
        if (!this.ctx || this.mood === m) return;
        this.mood = m;
        this.beatN = 0;
        this.phrase = [];
    }

    // ------------------------------------------------------------------ voices
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, dest = null, attack = 0.01, at = null } = {}) {
        if (!this.live) return;
        const t = at ?? this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.05);
    }

    noise({ dur = 0.15, vol = 0.2, freq = 1500, q = 1, type = 'bandpass', delay = 0, to = freq, dest = null, at = null } = {}) {
        if (!this.live) return;
        const t = at ?? this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest || this.sfx);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------------ music
    _schedule() {
        if (!this.live) return;
        const M = MOODS[this.mood];
        const now = this.ctx.currentTime;
        if (!M) { this.nextT = now + 0.1; return; }
        if (this.nextT < now) this.nextT = now + 0.05;
        const sixteenth = 60 / M.bpm / 4;
        while (this.nextT < now + 0.6) {
            this._beat(M, this.beatN, this.nextT, sixteenth);
            this.beatN++;
            this.nextT += sixteenth;
        }
    }

    _chord(M, bar) {
        const deg = M.prog[bar % M.prog.length];
        const n = M.scale.length;
        return [0, 2, 4].map((k) => { const i = deg + k; return M.root + M.scale[i % n] + 12 * Math.floor(i / n); });
    }

    _beat(M, s, t, six) {
        const dst = this.music;
        const bar = Math.floor(s / 16), pos = s % 16;
        const chord = this._chord(M, bar);
        if (pos === 0) {
            // a pad under each bar
            for (const n of chord) this.tone({ freq: hz(n + 12), dur: six * 16, type: 'triangle', vol: 0.05, attack: 0.25, dest: dst, at: t });
            if (bar % 2 === 0) this._newPhrase(M, bar);
        }
        // bass
        if (pos % 4 === 0) this.tone({ freq: hz(chord[0] - 12), dur: six * 3, type: M.drums === 'none' ? 'sine' : 'triangle', vol: 0.13, dest: dst, at: t });
        if (M.drums === 'war' && pos % 4 === 2) this.tone({ freq: hz(chord[0] - 12), dur: six * 1.5, type: 'triangle', vol: 0.08, dest: dst, at: t });
        // plucked arpeggio
        if (M.arp && pos % 2 === 0) {
            const n = chord[(pos / 2) % 3] + 12 + (pos >= 8 ? 12 : 0);
            this.tone({ freq: hz(n), dur: six * 1.8, type: 'triangle', vol: M.drums === 'none' ? 0.05 : 0.035, dest: dst, at: t });
        }
        // the lead
        const note = this.phrase[(bar % 2) * 16 + pos];
        if (note != null) this.tone({ freq: hz(note.n), dur: six * note.len * 0.95, type: M.lead, vol: M.lead === 'square' || M.lead === 'sawtooth' ? 0.035 : 0.07, attack: 0.02, dest: dst, at: t });
        // drums
        if (M.drums === 'march' || M.drums === 'war') {
            if (pos % 8 === 0 || (M.drums === 'war' && pos === 10)) this._kick(t);
            if (pos % 8 === 4) this.noise({ dur: 0.12, vol: 0.12, freq: 1800, q: 0.7, dest: dst, at: t });
            if (pos % 2 === 1) this.noise({ dur: 0.03, vol: 0.04, freq: 7000, type: 'highpass', dest: dst, at: t });
            if (M.drums === 'march' && (pos === 14 || pos === 15)) this.noise({ dur: 0.06, vol: 0.06, freq: 1800, q: 0.7, dest: dst, at: t });
        } else if (M.drums === 'soft' && pos % 8 === 0) this._kick(t, 0.08);
    }

    _kick(t, vol = 0.2) { this.tone({ freq: 140, to: 45, dur: 0.18, type: 'sine', vol, dest: this.music, at: t }); }

    _newPhrase(M, bar) {
        // two bars of melody that walk the chord tones with passing notes; it ends on the root
        this.phrase = new Array(32).fill(null);
        const n = M.scale.length;
        let deg = 7 + Math.floor(Math.random() * 3);
        for (let p = 0; p < 32;) {
            const len = [2, 2, 4, 2, 1, 3, 4][Math.floor(Math.random() * 7)];
            if (Math.random() < 0.18) { p += len; continue; }
            const ch = this._chord(M, bar + Math.floor(p / 16));
            deg += Math.floor(Math.random() * 5) - 2;
            deg = Math.max(5, Math.min(13, deg));
            let note = M.root + 12 + M.scale[deg % n] + 12 * Math.floor(deg / n);
            if (p % 8 === 0) { const c = ch[Math.floor(Math.random() * 3)] + 24; note = c; }
            if (p >= 28) note = ch[0] + 24;
            this.phrase[p] = { n: note, len: Math.min(len, 32 - p) };
            p += len;
        }
    }

    jingle(win) {
        const notes = win ? [60, 64, 67, 72, 67, 72, 76] : [64, 62, 60, 59, 55];
        notes.forEach((n, i) => this.tone({ freq: hz(n + 7), dur: win && i === notes.length - 1 ? 0.8 : 0.22, type: 'triangle', vol: 0.18, delay: i * 0.13 }));
        if (win) notes.forEach((n, i) => this.tone({ freq: hz(n - 5), dur: 0.2, type: 'square', vol: 0.05, delay: i * 0.13 }));
    }

    // ------------------------------------------------------------------ effects
    ui(kind) {
        if (kind === 'click') this.tone({ freq: 720, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 480, to: 760, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 760, to: 480, dur: 0.09, type: 'triangle', vol: 0.12 });
        else if (kind === 'deny') this.tone({ freq: 200, to: 150, dur: 0.16, type: 'square', vol: 0.08 });
        else if (kind === 'select') { this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.1 }); this.tone({ freq: 1320, dur: 0.06, type: 'triangle', vol: 0.08, delay: 0.04 }); }
        else if (kind === 'tick') this.tone({ freq: 1200, dur: 0.02, type: 'triangle', vol: 0.05 });
    }
    step(fly) { if (fly) this.noise({ dur: 0.35, vol: 0.08, freq: 500, to: 900, q: 0.6 }); else for (let i = 0; i < 2; i++) this.noise({ dur: 0.05, vol: 0.08, freq: 300, type: 'lowpass', delay: i * 0.12 }); }
    roar(snap) {
        if (!this.live || !snap || snap.kind !== 'dragon') { this.tone({ freq: 220, to: 160, dur: 0.25, type: 'sawtooth', vol: 0.06 }); return; }
        const base = snap.stage === 'hatchling' ? 520 : snap.stage === 'juvenile' ? 320 : 170;
        this.tone({ freq: base, to: base * 0.55, dur: 0.6, type: 'sawtooth', vol: 0.09, attack: 0.05 });
        this.noise({ dur: 0.55, vol: 0.12, freq: base * 3, to: base * 1.4, q: 2 });
    }
    breath(el) {
        if (el === 'ember') this.noise({ dur: 0.55, vol: 0.22, freq: 900, to: 400, q: 0.5, type: 'lowpass' });
        else if (el === 'tide') { this.noise({ dur: 0.5, vol: 0.18, freq: 2200, to: 800, q: 1.2 }); this.tone({ freq: 300, to: 600, dur: 0.3, type: 'sine', vol: 0.06 }); }
        else if (el === 'storm') { this.noise({ dur: 0.3, vol: 0.25, freq: 4000, to: 1000, q: 0.4 }); this.tone({ freq: 90, to: 60, dur: 0.4, type: 'square', vol: 0.06 }); }
        else if (el === 'verdant') { this.noise({ dur: 0.45, vol: 0.12, freq: 3000, to: 5000, q: 2 }); this.tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.06 }); }
        else if (el === 'stone') this.noise({ dur: 0.45, vol: 0.25, freq: 300, to: 120, type: 'lowpass' });
        else this.tone({ freq: el === 'umbra' ? 220 : 880, to: el === 'umbra' ? 110 : 1760, dur: 0.45, type: 'sine', vol: 0.1 });
    }
    hit(crit) {
        this.noise({ dur: crit ? 0.3 : 0.16, vol: crit ? 0.32 : 0.22, freq: crit ? 900 : 1400, to: 200, q: 0.8 });
        this.tone({ freq: crit ? 160 : 220, to: 60, dur: 0.18, type: 'square', vol: crit ? 0.14 : 0.08 });
        if (crit) this.tone({ freq: 1600, to: 2400, dur: 0.15, type: 'triangle', vol: 0.08, delay: 0.05 });
    }
    faint() { this.tone({ freq: 400, to: 90, dur: 0.6, type: 'triangle', vol: 0.12 }); }
    heal() { [784, 988, 1175].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'sine', vol: 0.08, delay: i * 0.07 })); }
    chime() { [1047, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.08, delay: i * 0.08 })); }
    levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.06, delay: i * 0.07 })); }
    phase(team) { const n = team === 'p' ? [392, 523, 659] : [330, 311, 247]; n.forEach((f, i) => this.tone({ freq: f, dur: 0.35, type: 'sawtooth', vol: 0.05, delay: i * 0.11, attack: 0.03 })); }
    power(team) { const n = team === 'p' ? [523, 659, 784, 1047, 1319] : [220, 262, 311, 370]; n.forEach((f, i) => { this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.12, delay: i * 0.09 }); this.tone({ freq: f / 2, dur: 0.5, type: 'sawtooth', vol: 0.04, delay: i * 0.09 }); }); }
    claim(done) { this.tone({ freq: done ? 523 : 392, dur: 0.12, type: 'square', vol: 0.06 }); if (done) this.tone({ freq: 784, dur: 0.3, type: 'square', vol: 0.06, delay: 0.1 }); }
    song(ok) { const n = ok ? [659, 784, 988, 1319] : [659, 622, 587]; n.forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.12, delay: i * 0.16, attack: 0.05 })); if (ok) this.noise({ dur: 0.4, vol: 0.15, freq: 5000, q: 3, delay: 0.6 }); }
    boom() { this.noise({ dur: 0.6, vol: 0.3, freq: 400, to: 60, type: 'lowpass' }); this.tone({ freq: 90, to: 40, dur: 0.5, type: 'sine', vol: 0.2 }); }
    splash() { this.noise({ dur: 0.4, vol: 0.2, freq: 2500, to: 600, q: 0.8 }); }
    twang() { this.tone({ freq: 180, to: 120, dur: 0.25, type: 'sawtooth', vol: 0.08 }); this.noise({ dur: 0.2, vol: 0.1, freq: 3000, to: 1500 }); }
    cast(el) { this.tone({ freq: el === 'umbra' ? 330 : 660, to: el === 'umbra' ? 220 : 1320, dur: 0.35, type: 'sine', vol: 0.1 }); this.noise({ dur: 0.3, vol: 0.06, freq: 4000, q: 4 }); }
    coins() { for (let i = 0; i < 4; i++) this.tone({ freq: 1800 + i * 200, dur: 0.08, type: 'square', vol: 0.04, delay: i * 0.05 }); }
    warm() { this.tone({ freq: 300 + Math.random() * 80, to: 420, dur: 0.12, type: 'sine', vol: 0.08 }); this.noise({ dur: 0.1, vol: 0.04, freq: 1200, type: 'lowpass' }); }
    crack() {
        for (let i = 0; i < 3; i++) this.noise({ dur: 0.05, vol: 0.2, freq: 3000, q: 2, delay: i * 0.18 });
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.1, delay: 0.6 + i * 0.08 }));
        this.tone({ freq: 900, to: 1400, dur: 0.25, type: 'sine', vol: 0.12, delay: 1.0 });
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'win') this.jingle(true);
            else if (e.type === 'lose') this.jingle(false);
            else if (e.type === 'hatch') this.crack();
            else if (e.type === 'ready') this.chime();
            else if (e.type === 'laid') this.heal();
            else if (e.type === 'grow') this.levelup();
            else if (e.type === 'coins' || e.type === 'bought') this.coins();
        }
    }
}
