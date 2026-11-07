// Procedural sound, all Web Audio, no files. Ambience follows where you are and the hour; a
// generative harp plays over the island's own hum (a seeded note); effects answer sim events.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the
// tab is hidden.

const NOTE = (n) => 220 * Math.pow(2, (n - 57) / 12);
const SCALES = {
    day: [0, 2, 4, 7, 9],            // major pentatonic
    night: [0, 3, 5, 7, 10],         // minor pentatonic
    castle: [0, 1, 5, 7, 8],         // something unsettled
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.55;
        this.amb = {};
        this.nextNote = 0;
        this.step = 0;
        this.root = 50;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.master = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.sfxVol * 0.7; this.ambBus.connect(comp);
        // a reverb from a noise impulse, for the harp and the spells
        const len = ctx.sampleRate * 2.6, imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
        this.verb = ctx.createConvolver(); this.verb.buffer = imp;
        this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.45;
        this.verb.connect(this.verbOut); this.verbOut.connect(comp);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.startAmbience();
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.05);
        this.ambBus.gain.setTargetAtTime(sfx * 0.7, t, 0.05);
        this.music.gain.setTargetAtTime(music * 0.5, t, 0.05);
    }

    // ------------------------------------------------------------------ ambience beds
    noiseBed(type, freq, q = 0.7) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.ambBus);
        src.start();
        return { g, f };
    }
    startAmbience() {
        const ctx = this.ctx;
        this.amb.sea = this.noiseBed('lowpass', 500);
        this.amb.wind = this.noiseBed('bandpass', 700, 0.6);
        this.amb.fire = this.noiseBed('highpass', 2200);
        this.amb.steam = this.noiseBed('highpass', 3500);
        // the island's hum: two low detuned sines, heard best at night and at the castle
        const hum = ctx.createGain(); hum.gain.value = 0; hum.connect(this.ambBus);
        this.humOsc = [1, 1.003, 2.001].map((m, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 55 * m; const g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5; o.connect(g); g.connect(hum); o.start(); return o; });
        this.amb.hum = { g: hum };
    }
    setHum(freq) { if (this.humOsc) this.humOsc.forEach((o, i) => o.frequency.setTargetAtTime(freq * [1, 1.003, 2.001][i], this.ctx.currentTime, 0.5)); this.root = Math.round(12 * Math.log2(freq / 55)) + 45; }

    /** Every frame: mix the beds for where you stand and when. */
    frame(G, view, dt) {
        if (!this.ctx || this.ctx.state !== 'running' || !G) return;
        const t = this.ctx.currentTime, p = G.p;
        const r = Math.hypot(p.x, p.z);
        const coast = Math.max(0, Math.min(1, (r - 120) / 70));
        const night = G.tod > 0.6 || G.tod < 0.02;
        const set = (k, v, tc = 0.4) => this.amb[k].g.gain.setTargetAtTime(v, t, tc);
        set('sea', (p.inside ? 0.15 : 0.55) * (0.25 + coast * 0.75) * (0.8 + Math.sin(t * 0.35) * 0.2));
        this.amb.sea.f.frequency.setTargetAtTime(380 + Math.sin(t * 0.3) * 160 + coast * 200, t, 0.5);
        const high = Math.max(0, (p.y - 8) / 12);
        const storm = Math.max(0, 1 - Math.hypot(p.x, p.z + 158) / 45);
        set('wind', p.inside ? 0.02 : Math.min(0.6, 0.06 + high * 0.15 + storm * 0.6 + (p.region === 'moor' ? 0.12 : 0)));
        this.amb.wind.f.frequency.setTargetAtTime(500 + storm * 600 + Math.sin(t * 0.7) * 150, t, 0.3);
        const fire = view?.nearFire ?? 0;
        set('fire', fire * 0.12 * (0.6 + Math.random() * 0.8), 0.03);
        set('steam', p.region === 'fen' ? 0.05 : 0, 1);
        set('hum', (night ? 0.05 : 0.025) + Math.max(0, 1 - r / 90) * 0.12, 1);
        // birds by day, crickets and owls by night
        if (!p.inside && Math.random() < dt * (night ? 2.2 : 0.7)) {
            if (night) this.cricket(); else if (p.region !== 'castle') this.bird();
        }
        this.musicTick(G);
    }

    bird() {
        const ctx = this.ctx, t = ctx.currentTime;
        const base = 2000 + Math.random() * 2400, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            const s = t + i * 0.11;
            o.frequency.setValueAtTime(base, s);
            o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), s + 0.06);
            g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
            o.connect(g); g.connect(this.ambBus); o.start(s); o.stop(s + 0.1);
        }
    }
    cricket() {
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.frequency.value = 4200 + Math.random() * 600; lfo.frequency.value = 45; lg.gain.value = 0.012;
        lfo.connect(lg); lg.connect(g.gain);
        g.gain.value = 0;
        o.connect(g); g.connect(this.ambBus);
        o.start(t); lfo.start(t); o.stop(t + 0.35); lfo.stop(t + 0.35);
    }

    // ------------------------------------------------------------------ music: a harp over the hum
    musicTick(G) {
        const ctx = this.ctx;
        if (this.musicVol <= 0.001) return;
        const now = ctx.currentTime;
        if (this.nextNote < now) this.nextNote = now + 0.1;
        const night = G.tod > 0.6 || G.tod < 0.02;
        const castle = Math.hypot(G.p.x, G.p.z) < 70;
        const scale = castle ? SCALES.castle : night ? SCALES.night : SCALES.day;
        const beat = castle ? 0.62 : night ? 0.55 : 0.42;
        while (this.nextNote < now + 0.3) {
            const s = this.step++;
            const bar = Math.floor(s / 16) % 4;
            const chordRoot = [0, 3, 4, 2][bar];
            // a sparse arpeggio, with rests, so it never becomes wallpaper
            if ((s % 16) === 0) this.pluck(NOTE(this.root - 12 + scale[chordRoot % scale.length]), this.nextNote, 0.06, 3.2);
            const pat = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0];
            if (pat[s % 16] && Math.random() < (night ? 0.55 : 0.75)) {
                const deg = (chordRoot + [0, 2, 4, 2, 5, 4, 3, 1][(s + bar) % 8]) % (scale.length * 2);
                const oct = Math.floor(deg / scale.length) * 12;
                this.pluck(NOTE(this.root + scale[deg % scale.length] + oct), this.nextNote, 0.035, 1.8);
            }
            this.nextNote += beat;
        }
    }
    pluck(freq, t, vol = 0.04, dur = 1.6) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.003;
        f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.music); g.connect(this.verb);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }

    // ------------------------------------------------------------------ effects
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0, verb = false } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx); if (verb) g.connect(this.verb);
        o.start(t); o.stop(t + dur + 0.02);
    }
    noise({ dur = 0.3, freq = 1000, to = freq, type = 'bandpass', vol = 0.2, delay = 0, q = 1, verb = false } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this.sfx); if (verb) g.connect(this.verb);
        s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
    }
    bell(freq, delay = 0, dur = 2.4, vol = 0.12) {
        [1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone({ freq: freq * m, dur: dur / (1 + i * 0.6), vol: vol / (1 + i * 1.5), delay, verb: true }));
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.05, type: 'triangle', vol: 0.06 });
        else if (kind === 'open') { this.noise({ dur: 0.25, freq: 3000, to: 1200, vol: 0.06, type: 'bandpass' }); this.tone({ freq: 520, to: 700, dur: 0.12, type: 'triangle', vol: 0.05 }); }
        else if (kind === 'close') this.noise({ dur: 0.2, freq: 1500, to: 3000, vol: 0.05 });
        else if (kind === 'page') this.noise({ dur: 0.35, freq: 4000, to: 1800, vol: 0.08, type: 'highpass' });
        else if (kind === 'glyph') [0, 4, 7].forEach((n, i) => this.tone({ freq: NOTE(this.root + 24 + n), dur: 1.2, vol: 0.05, delay: i * 0.09, verb: true }));
    }

    footstep(surface) {
        const f = { sand: 900, grass: 1400, wood: 500, stone: 2200, water: 700 }[surface] || 1200;
        this.noise({ dur: 0.09, freq: f * (0.8 + Math.random() * 0.4), to: f * 0.5, vol: surface === 'water' ? 0.09 : 0.05, type: surface === 'water' ? 'lowpass' : 'bandpass', q: 0.8 });
        if (surface === 'wood') this.tone({ freq: 120 + Math.random() * 20, to: 80, dur: 0.07, vol: 0.05 });
    }

    spell(essence, form, power) {
        const v = 0.12 + power * 0.03;
        const r = NOTE(this.root + 24);
        switch (essence) {
            case 'kindle': this.noise({ dur: 0.6, freq: 500, to: 2500, vol: v * 1.4, type: 'lowpass' }); this.noise({ dur: 0.4, freq: 4000, to: 6000, vol: v * 0.4, type: 'highpass', delay: 0.05 }); break;
            case 'rime': [0, 7, 12, 19].forEach((n, i) => this.tone({ freq: r * Math.pow(2, n / 12) * 2, dur: 0.7, vol: v * 0.4, delay: i * 0.05, verb: true })); this.noise({ dur: 0.3, freq: 7000, to: 9000, vol: v * 0.3, type: 'highpass' }); break;
            case 'lumen': [0, 4, 7, 11].forEach((n, i) => this.tone({ freq: r * Math.pow(2, n / 12), dur: 1.4, vol: v * 0.35, delay: i * 0.03, verb: true, type: 'triangle' })); break;
            case 'bloom': this.tone({ freq: r * 0.5, to: r, dur: 0.9, vol: v * 0.6, type: 'triangle', verb: true }); this.noise({ dur: 0.5, freq: 600, to: 1800, vol: v * 0.3 }); break;
            case 'gale': this.noise({ dur: 0.9, freq: 300, to: 2400, vol: v * 1.3, type: 'bandpass', q: 2 }); break;
            case 'still': this.tone({ freq: r * 0.5, to: r * 0.25, dur: 1.2, vol: v * 0.5, verb: true }); this.duck(0.8); break;
            case 'unweave': this.noise({ dur: 1.0, freq: 3000, to: 120, vol: v * 1.4, type: 'bandpass', q: 3 }); this.tone({ freq: 70, to: 35, dur: 1.2, vol: v, type: 'sawtooth' }); break;
        }
        if (form === 'bolt') this.noise({ dur: 0.18, freq: 1800, to: 600, vol: 0.08 });
        if (form === 'seal') this.tone({ freq: 90, to: 60, dur: 0.4, vol: 0.12 });
    }
    duck(sec) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        for (const b of [this.ambBus, this.music]) { b.gain.cancelScheduledValues(t); const v = b.gain.value; b.gain.setValueAtTime(v, t); b.gain.linearRampToValueAtTime(v * 0.15, t + 0.08); b.gain.linearRampToValueAtTime(b === this.music ? this.musicVol * 0.5 : this.sfxVol * 0.7, t + sec); }
    }

    goblin(n = 6) {
        // Nib's chatter: quick pitched blips
        for (let i = 0; i < n; i++) this.tone({ freq: 600 + Math.random() * 700, to: 500 + Math.random() * 900, dur: 0.06, type: 'square', vol: 0.025, delay: i * 0.07 });
    }

    onEvents(G, events) {
        if (!this.ctx) return;
        for (const e of events) {
            switch (e.type) {
                case 'cast': this.spell(e.essence, e.form, e.power); break;
                case 'fizzle': this.noise({ dur: 0.35, freq: 900, to: 200, vol: 0.12, type: 'lowpass' }); this.tone({ freq: 300, to: 120, dur: 0.25, type: 'square', vol: 0.03 }); break;
                case 'firstSpell': [0, 4, 7, 12, 16].forEach((n, i) => this.bell(NOTE(this.root + 12 + n), i * 0.18, 3, 0.08)); break;
                case 'pickup': this.tone({ freq: 1100, to: 1500, dur: 0.08, type: 'triangle', vol: 0.05 }); break;
                case 'glyph': this.ui('glyph'); break;
                case 'page': this.ui('page'); break;
                case 'experiment':
                    if (e.inst === 'alembic') { for (let i = 0; i < 8; i++) this.tone({ freq: 300 + Math.random() * 400, to: 900, dur: 0.06, vol: 0.04, delay: i * 0.15 }); this.noise({ dur: 1.5, freq: 400, to: 900, vol: 0.05, delay: 0.3 }); }
                    if (e.inst === 'bells') {
                        const f = NOTE(this.root + 24);
                        this.bell(f, 0);
                        if (e.rel === 'same') this.bell(f, 0.02);
                        else if (e.rel === 'clash') { this.bell(f * Math.SQRT2, 0.02); this.noise({ dur: 0.4, freq: 2500, to: 800, vol: 0.15, delay: 0.05, q: 6 }); this.duck(1.4); }
                        else this.bell(f * 1.5, 0.35);
                    }
                    if (e.inst === 'orrery') { for (let i = 0; i < 10; i++) this.tone({ freq: 2400, dur: 0.02, type: 'square', vol: 0.02, delay: i * 0.12 }); this.bell(NOTE(this.root + 31), 1.3, 1.5, 0.06); }
                    break;
                case 'stone': [0, 7, 12, 16, 19, 24].forEach((n, i) => this.bell(NOTE(this.root + n), i * 0.22, 4, 0.1)); this.tone({ freq: 55, dur: 3, vol: 0.15, verb: true }); break;
                case 'flag':
                    if (e.name === 'iceWall') this.noise({ dur: 2.5, freq: 200, to: 80, vol: 0.4, type: 'lowpass' });
                    if (e.name === 'gate') { this.noise({ dur: 3, freq: 120, to: 60, vol: 0.25, type: 'lowpass' }); [0, 5, 7, 12].forEach((n, i) => this.bell(NOTE(this.root + n), 0.5 + i * 0.3, 3, 0.08)); }
                    if (e.name === 'thornGap') this.noise({ dur: 1.4, freq: 3000, to: 200, vol: 0.25 });
                    if (e.name === 'door' || e.name === 'bridge' || e.name === 'hearth') [0, 4, 7].forEach((n, i) => this.tone({ freq: NOTE(this.root + 12 + n), dur: 1.5, vol: 0.06, delay: i * 0.12, verb: true, type: 'triangle' }));
                    if (e.name === 'hearth') this.noise({ dur: 0.8, freq: 300, to: 1500, vol: 0.15, type: 'lowpass' });
                    break;
                case 'shadeTouch': this.tone({ freq: 90, to: 60, dur: 0.8, type: 'sawtooth', vol: 0.06 }); this.noise({ dur: 0.6, freq: 400, to: 150, vol: 0.1 }); break;
                case 'shadeDie': this.noise({ dur: 0.7, freq: 2000, to: 6000, vol: 0.08, type: 'highpass' }); this.tone({ freq: 400, to: 1200, dur: 0.4, vol: 0.05, verb: true }); break;
                case 'scald': this.noise({ dur: 0.6, freq: 5000, to: 3000, vol: 0.2, type: 'highpass' }); break;
                case 'plunge': this.noise({ dur: 0.8, freq: 800, to: 200, vol: 0.3, type: 'lowpass' }); break;
                case 'land': this.noise({ dur: 0.15, freq: 300, to: 100, vol: 0.15, type: 'lowpass' }); break;
                case 'jump': this.noise({ dur: 0.1, freq: 900, to: 500, vol: 0.04 }); break;
                case 'eat': for (let i = 0; i < 3; i++) this.noise({ dur: 0.07, freq: 1500, to: 900, vol: 0.06, delay: i * 0.12 }); break;
                case 'cook': this.noise({ dur: 1.2, freq: 4000, to: 3000, vol: 0.08, type: 'highpass' }); break;
                case 'bark': case 'nibJoin': this.goblin(4 + Math.floor(Math.random() * 5)); break;
                case 'collapse': this.tone({ freq: 220, to: 55, dur: 2.5, vol: 0.12, verb: true }); break;
                case 'rest': [7, 4, 0].forEach((n, i) => this.tone({ freq: NOTE(this.root + 12 + n), dur: 1.4, vol: 0.05, delay: i * 0.25, verb: true, type: 'triangle' })); break;
                case 'select': this.tone({ freq: 1300, dur: 0.04, type: 'triangle', vol: 0.04 }); break;
                case 'blank': this.tone({ freq: 200, dur: 0.1, type: 'square', vol: 0.03 }); break;
                case 'region': this.tone({ freq: NOTE(this.root + 19), dur: 2, vol: 0.04, verb: true, type: 'triangle' }); break;
                case 'echoShown': [12, 16, 19, 24].forEach((n, i) => this.tone({ freq: NOTE(this.root + n), dur: 2.4, vol: 0.04, delay: i * 0.2, verb: true })); break;
                case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.bell(NOTE(this.root + n), i * 0.15, 5, 0.1)); this.duck(3); break;
                case 'ending': [0, 7, 12, 16].forEach((n, i) => this.bell(NOTE(this.root + n), i * 0.4, 6, 0.08)); break;
            }
        }
    }
}
