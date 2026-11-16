// Sound: ElevenLabs recordings (dev/audio/README.md) with the original Web Audio synth behind every one of them.
// Music: a looping theme per region (and one for the title), cross-faded when the region changes and muffled
// at night; ambience per region (crickets at night on the lowland roads); a war-drum loop under fights; and an
// effect per event. Any clip that is missing or fails to decode plays the synthesised sound it replaced, so the
// game sounds the same as v1.3.0 until (and unless) the files arrive.
// The context is made on the first user gesture, and ../lib/page-audio.js suspends it while the tab is hidden.

import { AUDIO_FILES } from './audio-files.js';

const AUDIO_BASE = new URL('../audio/', import.meta.url).href;
const REGION_MUSIC = ['meadow', 'desert', 'mire', 'frost', 'ember', 'star'];
const NIGHT_AMB = new Set(['meadow', 'desert', 'mire']);     // crickets where crickets would be
const FADE = 2.5;                                               // seconds for a music or ambience cross-fade

const SCALES = [
    [0, 2, 4, 7, 9],          // Meadowmere: major pentatonic
    [0, 1, 4, 5, 7, 8, 10],   // the Wastes: phrygian dominant
    [0, 2, 3, 7, 9],          // Mirewood: a minor pentatonic with a raised sixth
    [0, 2, 3, 5, 7, 10],      // Frostfang: dorian-ish
    [0, 1, 3, 5, 6, 8, 10],   // Emberreach: locrian
    [0, 2, 4, 6, 7, 11],      // Starhaven: lydian
];
const ROOT = [57, 55, 52, 50, 53, 59];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.region = 0;
        this.night = false;
        this.nextNote = 0;
        this.beat = 0;
        this.timer = null;
        this.title = false;
        this.buf = {};              // 'sfx/coin' → AudioBuffer
        this.loading = {};          // key → promise
        this.failed = new Set();    // keys that would not load or decode: their synth plays instead
        this.slots = {};            // music, amb, night, drums → { key, src, gain }
        this.lastPlay = {};         // clip → time, so a burst of the same event doesn't pile up
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(comp);
        // a soft room for the plucks
        const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        this.verb = ctx.createConvolver(); this.verb.buffer = buf;
        const wet = ctx.createGain(); wet.gain.value = 0.25;
        this.verb.connect(wet); wet.connect(this.music);
        // recorded music runs through a low-pass that closes at night, ambience under the effects
        this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.connect(this.music);
        this.musicIn = ctx.createGain(); this.musicIn.gain.value = 2; this.musicIn.connect(this.lp);
        this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.5; this.ambBus.connect(this.sfx);
        this.nextNote = ctx.currentTime + 0.3;
        this.timer = setInterval(() => this.schedule(), 120);
        // the effects are small: fetch them all now; music and ambience load when they're wanted
        for (const n of AUDIO_FILES.sfx) this.fetch('sfx/' + n);
        this.fetch('amb/drums');
        this.updateLoops();
    }

    /** Fetch and decode a clip once. Resolves to the buffer, or null (and marks it failed). */
    fetch(key) {
        if (this.buf[key]) return Promise.resolve(this.buf[key]);
        if (this.loading[key]) return this.loading[key];
        const [dir, name] = key.split('/');
        if (!(AUDIO_FILES[dir] || []).includes(name)) { this.failed.add(key); return Promise.resolve(null); }
        this.loading[key] = fetch(AUDIO_BASE + key + '.mp3')
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then((a) => new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej)))
            .then((b) => { this.buf[key] = b; delete this.loading[key]; this.updateLoops(); return b; })
            .catch(() => { this.failed.add(key); delete this.loading[key]; return null; });
        return this.loading[key];
    }

    /** True while a recording is expected for this key (loaded, or on its way). */
    expects(key) {
        const [dir, name] = key.split('/');
        return (AUDIO_FILES[dir] || []).includes(name) && !this.failed.has(key);
    }

    /** Play a recorded effect. False if it isn't here (the caller plays its synth instead). */
    play(name, { vol = 1, rate = 1, delay = 0, gap = 0.06 } = {}) {
        const b = this.buf['sfx/' + name];
        if (!b || !this.ctx || this.ctx.state !== 'running') return !!b;
        const t = this.ctx.currentTime + delay;
        if (t - (this.lastPlay[name] ?? -1) < gap) return true;
        this.lastPlay[name] = t;
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = b; src.playbackRate.value = rate; g.gain.value = vol;
        src.connect(g); g.connect(this.sfx);
        src.start(t);
        return true;
    }

    /** Keep a looping slot on `key` (null = silent), cross-fading from whatever it was playing. */
    want(slot, key, bus, vol) {
        const cur = this.slots[slot];
        if ((cur?.key ?? null) === key) return;
        if (key && !this.buf[key]) {
            if (this.expects(key)) { this.fetch(key); return; }      // keep the old one until the new one is in
            key = null;
        }
        const t = this.ctx.currentTime;
        if (cur?.src) { cur.gain.gain.cancelScheduledValues(t); cur.gain.gain.setTargetAtTime(0, t, FADE / 4); cur.src.stop(t + FADE * 2); }
        if (!key) { this.slots[slot] = { key: null }; return; }
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
        src.buffer = this.buf[key]; src.loop = true;
        g.gain.value = 0.0001; g.gain.setTargetAtTime(vol, t, FADE / 4);
        src.connect(g); g.connect(bus);
        src.start(t);
        this.slots[slot] = { key, src, gain: g };
        // only the playing theme stays decoded (a minute of stereo is ~20 MB)
        for (const k of Object.keys(this.buf)) if (k.startsWith('music/') && k !== key && k !== cur?.key) delete this.buf[k];
    }

    /** Which music and ambience should be playing now. */
    updateLoops() {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const biome = REGION_MUSIC[this.region] || 'meadow';
        this.want('music', 'music/' + (this.title ? 'title' : biome), this.musicIn, 1);
        this.want('amb', this.title ? null : 'amb/' + biome, this.ambBus, 0.9);
        this.want('night', !this.title && this.night && NIGHT_AMB.has(biome) ? 'amb/night' : null, this.ambBus, 0.7);
        const t = this.ctx.currentTime;
        this.lp.frequency.setTargetAtTime(this.night && !this.title ? 1600 : 20000, t, 1.5);
        this.musicIn.gain.setTargetAtTime(this.night && !this.title ? 1.5 : 2, t, 1.5);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.05);
    }

    setScene(region, night, title = false, camp = false) {
        if (region === this.region && night === this.night && title === this.title) return;
        this.region = region; this.night = night; this.title = title; this.camp = camp;
        this.updateLoops();
    }

    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0, out = null } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise(dur = 0.1, vol = 0.15, freq = 1200, delay = 0) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.sfx);
        src.start(t);
    }

    /** A plucked string: a short triangle with a quick decay, into the room. */
    pluck(midi, t, vol = 0.12, dur = 0.6) {
        const ctx = this.ctx;
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(this.music); g.connect(this.verb);
        o.start(t); o.stop(t + dur + 0.05);
    }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || this.musicVol <= 0) { if (ctx) this.nextNote = Math.max(this.nextNote, ctx.currentTime + 0.1); return; }
        const beat = this.night ? 0.42 : 0.32;
        const recorded = this.expects('music/' + (this.title ? 'title' : REGION_MUSIC[this.region]));
        if (recorded && ctx.state === 'running' && !this.slots.music?.src) this.updateLoops();
        while (this.nextNote < ctx.currentTime + 0.5) {
            const t = this.nextNote, b = this.beat++;
            const sc = SCALES[this.region], root = ROOT[this.region];
            const bar = Math.floor(b / 8) % 4;
            const chord = [0, 3, 4, 2][bar];
            if (recorded) { if (t < (this.drumUntil || 0) && b % 2 === 0) this.drum(t, b % 8 === 0 ? 0.5 : 0.28); this.nextNote += beat; continue; }
            if (b % 8 === 0) this.pluck(root - 12 + sc[chord % sc.length], t, 0.1, 1.6);
            if (b % 4 === 2) this.pluck(root - 5 + sc[(chord + 2) % sc.length], t, 0.05, 0.8);
            // a wandering tune, seeded by the beat so it repeats every few bars
            const h = Math.sin(b * 12.9898 + this.region * 78.233) * 43758.5453;
            const r = h - Math.floor(h);
            if (r < (this.night ? 0.35 : 0.6)) {
                const deg = (chord + Math.floor(r * 10)) % (sc.length * 2);
                this.pluck(root + 12 * Math.floor(deg / sc.length) + sc[deg % sc.length], t, 0.07, 0.5);
            }
            // the war drum while a fight is on: a heavy beat on the bar, lighter ones between
            if (t < (this.drumUntil || 0) && b % 2 === 0) this.drum(t, b % 8 === 0 ? 0.5 : 0.28);
            this.nextNote += beat;
        }
    }

    ui(kind) {
        const UI = { click: 0.6, open: 0.7, close: 0.7, coin: 0.7, tick: 0.35, tallied: 0.8, deny: 0.7 };
        if (UI[kind] && this.play('ui-' + kind, { vol: UI[kind], rate: kind === 'tick' ? 0.95 + Math.random() * 0.15 : 1, gap: kind === 'tick' ? 0.04 : 0.03 })) return;
        if (kind === 'click') this.tone({ freq: 700, dur: 0.05, type: 'triangle', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.1 });
        else if (kind === 'coin') { this.tone({ freq: 1320, dur: 0.06, type: 'square', vol: 0.06 }); this.tone({ freq: 1760, dur: 0.12, type: 'square', vol: 0.06, delay: 0.06 }); }
        else if (kind === 'tick') this.tone({ freq: 1500 + Math.random() * 300, dur: 0.025, type: 'triangle', vol: 0.035 });
        else if (kind === 'tallied') [784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.08, delay: i * 0.07 }));
        else if (kind === 'deny') this.tone({ freq: 200, to: 150, dur: 0.15, type: 'sawtooth', vol: 0.08 });
    }

    // ------------------------------------------------------------------ fights, as the view plays them
    /** A war drum under the tune for as long as the fight runs, up to the fanfare. */
    fightStart(dur) {
        if (!this.ctx) return;
        const d = this.buf['amb/drums'];
        if (d && this.ctx.state === 'running') {
            // the recorded war drums, faded in and out over the fight
            this.stopDrums();
            const t = this.ctx.currentTime, end = t + Math.max(0.5, dur - 0.9);
            const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
            src.buffer = d; src.loop = true;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.3);
            g.gain.setValueAtTime(0.9, end - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, end);
            src.connect(g); g.connect(this.music);
            src.start(t); src.stop(end + 0.05);
            this.slots.drums = { src, gain: g };
            return;
        }
        this.drumUntil = this.ctx.currentTime + Math.max(0.5, dur - 0.9);
    }
    fightHit(h) {
        const rate = 0.93 + Math.random() * 0.14;
        if (this.play(h.heal ? 'heal' : h.crit ? 'crit' : h.a === 'p' ? 'hit-party' : 'hit-foe', { vol: h.heal ? 0.6 : 0.75, rate, gap: 0.05 })) return;
        if (h.heal) this.tone({ freq: 660, to: 990, dur: 0.15, type: 'sine', vol: 0.08 });
        else {
            this.noise(0.07, h.crit ? 0.22 : 0.16, h.a === 'p' ? 1800 : 700);
            this.tone({ freq: h.a === 'p' ? 300 : 160, to: 90, dur: 0.1, type: 'square', vol: 0.06 });
        }
    }
    stopDrums() {
        const d = this.slots.drums;
        if (!d?.src || !this.ctx) return;
        const t = this.ctx.currentTime;
        d.gain.gain.cancelScheduledValues(t); d.gain.gain.setTargetAtTime(0.0001, t, 0.08);
        try { d.src.stop(t + 0.4); } catch { /* already stopped */ }
        this.slots.drums = null;
    }

    fightOver(e) {
        if (this.ctx) this.drumUntil = 0;
        this.stopDrums();
        if (e.won && this.play('win', { vol: 0.8 })) return;
        if (e.lost && this.play('lose', { vol: 0.8 })) return;
        if (e.won) [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.12, delay: i * 0.09 }));
        else if (e.lost) [392, 330, 262].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.08, delay: i * 0.16 }));
    }
    /** A low tom: a sine dropping in pitch, on the music bus so the music slider covers it. */
    drum(t, vol) {
        const ctx = this.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + 0.35);
    }

    /** The recorded effect for a simulation event, or null for one that only the synth has. */
    clipFor(e) {
        switch (e.type) {
            case 'camp': return ['camp', 0.7];
            case 'arrive': return ['arrive', 0.7];
            case 'depart': return ['depart', 0.6];
            case 'trade': return ['ui-coin', 0.6];
            case 'rally': return ['rally', 0.8];
            case 'levelup': return ['levelup', 0.8];
            case 'rareLoot': return ['rareloot', 0.8];
            case 'quest': return ['quest', 0.8];
            case 'warden': return e.won ? ['warden', 0.9, 1] : null;
            case 'recruit': return ['recruit', 0.7];
            case 'craft': return [e.cls === 'smith' ? 'smith' : e.cls === 'cook' ? 'cook' : 'brew', 0.45];
            case 'event': return e.kind === 'cache' ? ['ui-coin', 0.7] : e.kind === 'wheel' ? ['wheel', 0.8] : null;
            case 'sparkle': return ['sparkle', 0.55];
            case 'sparkleGot': return ['sparklegot', 0.8];
            case 'upgrade': return ['upgrade', 0.7];
        }
        return null;
    }

    onEvents(G, events) {
        for (const e of events) {
            const c = this.clipFor(e);
            if (c && this.play(c[0], { vol: c[1], delay: c[2] || 0, gap: 0.15 })) continue;
            switch (e.type) {
                // fights sound from the view as they play (fightStart, fightHit, fightOver), so they last as long
                case 'camp': this.noise(0.5, 0.05, 900); break;
                case 'arrive': [784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.1, delay: i * 0.22 })); break;
                case 'depart': this.noise(0.2, 0.06, 300); break;
                case 'trade': this.ui('coin'); break;
                case 'rally': this.tone({ freq: 220, to: 440, dur: 0.2, type: 'sawtooth', vol: 0.08 }); this.noise(0.12, 0.1, 2500, 0.05); break;
                case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
                case 'rareLoot': [880, 1109, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.1, delay: i * 0.1 })); break;
                case 'quest': [659, 784, 988].forEach((f, i) => this.tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.1 })); break;
                case 'warden': if (e.won) [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.14, delay: 1 + i * 0.15 })); break;
                case 'recruit': this.tone({ freq: 523, to: 784, dur: 0.25, type: 'triangle', vol: 0.1 }); break;
                case 'craft': this.tone({ freq: e.cls === 'smith' ? 1200 : 600, to: e.cls === 'smith' ? 800 : 900, dur: 0.08, type: 'square', vol: 0.04 }); break;
                case 'event': if (e.kind === 'cache') this.ui('coin'); else if (e.kind === 'wheel') this.noise(0.25, 0.12, 400); break;
                case 'sparkle': [1568, 2093].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.05, delay: i * 0.07 })); break;
                case 'sparkleGot': [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.09, delay: i * 0.05 })); break;
                case 'upgrade': this.tone({ freq: 440, to: 880, dur: 0.2, type: 'square', vol: 0.06 }); break;
            }
        }
    }
}
