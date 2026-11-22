// JINGLE POP — sound. Music, effects and voices were generated with ElevenLabs (audio/*.mp3, see dev/audio/README.md).
// A small Web Audio synth stands in for any effect file that can't be loaded and plays the UI blips; a jingle-bell
// sequencer stands in for the music. The context is made on the first gesture; ../lib/page-audio.js suspends it in a
// hidden tab (music plays through <audio> elements routed into a gain node, so that still silences it).

const SFX = ['pop', 'shoot', 'stick', 'drop', 'bell', 'boom', 'ice', 'gift', 'tinsel', 'cocoa', 'lower', 'powerup', 'star', 'candy', 'coal'];
const VOICES = [
    'juni-start', 'juni-win', 'juni-lose', 'juni-combo', 'juni-timber', 'juni-gift', 'juni-watch', 'juni-almost', 'juni-careful',
    'juni-wow', 'juni-stars', 'juni-blizzard', 'juni-ready', 'juni-gently', 'juni-merry',
    'grim-1', 'grim-2', 'grim-3', 'grim-4', 'grim-5', 'grim-6', 'grim-7', 'grim-8', 'holly-intro', 'holly-end',
];
const ONCE = new Set(['win', 'lose']);
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// fallback tune: a jingly I-vi-IV-V in G, one bar per chord
const FALLBACK = { bpm: 120, prog: [55, 52, 48, 50], lead: [7, 7, 7, -1, 7, 7, 7, -1, 7, 9, 4, 5, 7, -1, -1, -1] };
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buffers = {};
        this.tracks = {};
        this.current = null; this.want = null;
        this.lastVoice = 0;
        this.voiceSrc = null;
        this.synthMusic = false;
        this.step = 0; this.nextT = 0;
        this.rand = 12345;
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }
    _r() { this.rand = (this.rand * 1103515245 + 12345) & 0x7fffffff; return this.rand / 0x7fffffff; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.55; this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        this.timer = setInterval(() => this._schedule(), 80);
        for (const n of [...SFX.map((s) => 'sfx-' + s), ...VOICES.map((v) => 'vo-' + v)]) {
            fetch(`audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then((b) => ctx.decodeAudioData(b)).then((buf) => { this.buffers[n] = buf; }).catch(() => { /* synth fallback */ });
        }
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    setVolumes(sfx, music, voice) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * 0.55, t, 0.05);
        this.voice.gain.setTargetAtTime(voice, t, 0.02);
    }

    // ------------------------------------------------------------------ files
    clip(name, { vol = 1, rate = 1 } = {}) {
        if (!this.ok || !this.buffers['sfx-' + name]) return false;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = this.buffers['sfx-' + name];
        s.playbackRate.value = rate;
        g.gain.value = vol;
        s.connect(g); g.connect(this.sfx);
        s.start();
        return true;
    }

    /** A character line. One at a time; `gap` seconds of quiet first unless forced (story lines). */
    say(name, { force = false, gap = 5 } = {}) {
        const buf = this.buffers['vo-' + name];
        if (!this.ok || !buf) return false;
        const now = this.ctx.currentTime;
        if (!force && now < this.lastVoice + gap) return false;
        if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* ended */ } }
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.connect(this.voice);
        s.start();
        this.voiceSrc = s;
        this.lastVoice = now + buf.duration;
        return true;
    }
    hush() { if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* */ } this.voiceSrc = null; } }

    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music-${name}.mp3`);
        el.loop = !ONCE.has(name);
        el.preload = 'auto';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already connected */ }
        g.connect(this.music);
        el._gain = g;
        el.addEventListener('error', () => { if (!this.synthMusic) { this.synthMusic = true; const w = this.current; this.current = null; this.play(w); } });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the music (title, play1, play2, endless) or play a sting (win, lose). Crossfades. */
    play(name) {
        this.want = name;
        if (!this.ctx || this.current === name) return;
        this.current = name;
        const t = this.ctx.currentTime;
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.setTargetAtTime(0, t, 0.3);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 1500);
        }
        if (!name || this.synthMusic) return;
        const el = this._track(name);
        if (ONCE.has(name) || el.ended) el.currentTime = 0;
        el._gain.gain.cancelScheduledValues(t);
        el._gain.gain.setTargetAtTime(ONCE.has(name) ? 1.1 : 1, t, ONCE.has(name) ? 0.01 : 0.4);
        el.play().catch(() => { /* autoplay */ });
    }
    playing() { const el = this.tracks[this.current]; return !!el && !el.paused; }

    // ------------------------------------------------------------------ synth
    tone({ freq = 440, to = freq, dur = 0.12, type = 'triangle', vol = 0.15, delay = 0, bus } = {}) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }
    chime(base = 1320, n = 3, gap = 0.05, vol = 0.08) { for (let i = 0; i < n; i++) this.tone({ freq: base * (1 + i * 0.25), dur: 0.3, type: 'sine', vol, delay: i * gap }); }

    _schedule() {
        if (!this.ok || !this.synthMusic || !this.current || ONCE.has(this.current)) return;
        const spb = 60 / FALLBACK.bpm / 2;
        if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.05;
        while (this.nextT < this.ctx.currentTime + 0.3) {
            const bar = Math.floor(this.step / 16) % FALLBACK.prog.length, i = this.step % 16;
            const root = FALLBACK.prog[bar];
            const st = FALLBACK.lead[i];
            const dt = this.nextT - this.ctx.currentTime;
            if (st >= 0) this.tone({ freq: NOTE(root + 24 + MAJOR[st % 10] - 7), dur: spb * 1.6, type: 'triangle', vol: 0.05, delay: dt, bus: this.music });
            if (i % 4 === 0) this.tone({ freq: NOTE(root - 12 + (i % 8 ? 7 : 0)), dur: spb * 3, type: 'sine', vol: 0.09, delay: dt, bus: this.music });
            if (i % 2 === 1) this.tone({ freq: 6000, to: 5200, dur: 0.05, type: 'square', vol: 0.012, delay: dt, bus: this.music });
            this.step++;
            this.nextT += spb;
        }
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 880, dur: 0.06, type: 'sine', vol: 0.1 });
        else if (kind === 'open') this.tone({ freq: 660, to: 990, dur: 0.1, type: 'sine', vol: 0.1 });
        else if (kind === 'close') this.tone({ freq: 990, to: 660, dur: 0.1, type: 'sine', vol: 0.1 });
    }

    // ------------------------------------------------------------------ simulation events
    onEvents(G, events) {
        let pops = 0;
        for (const e of events) {
            const v = 0.85 + this._r() * 0.3;
            switch (e.type) {
                case 'shoot': this.clip('shoot', { rate: v, vol: 0.7 }) || this.tone({ freq: 300, to: 700, dur: 0.12, vol: 0.1 }); break;
                case 'bounce': this.clip('stick', { rate: 1.4, vol: 0.35 }) || this.tone({ freq: 500, dur: 0.04, vol: 0.06 }); break;
                case 'stick': this.clip('stick', { rate: v, vol: 0.7 }) || this.tone({ freq: 1200, to: 900, dur: 0.06, type: 'sine', vol: 0.08 }); break;
                case 'pop': {
                    const n = e.list.length;
                    pops += n;
                    const rate = Math.min(1.6, 0.9 + (e.mult - 1) * 0.3);
                    if (!this.clip('pop', { rate, vol: Math.min(1, 0.6 + n * 0.05) })) this.chime(1100 * rate, Math.min(5, n), 0.04, 0.07);
                    if (e.list.some((b) => b.k === 'coal')) this.clip('coal', { vol: 0.7 });
                    break;
                }
                case 'drop': this.clip('drop', { rate: v, vol: Math.min(1, 0.5 + e.list.length * 0.04) }) || this.chime(1600, 4, 0.07, 0.05); break;
                case 'thaw': this.clip('ice', { rate: v, vol: 0.6 }) || this.tone({ freq: 2400, to: 1200, dur: 0.15, vol: 0.05 }); break;
                case 'gift': this.clip('gift', { vol: 0.8 }) || this.chime(990, 4); break;
                case 'power': if (e.from === 'spirit') this.clip('powerup') || this.chime(880, 5, 0.06); break;
                case 'ring': case 'chime': this.clip('bell', { rate: v }) || this.chime(1760, 2, 0.1, 0.12); break;
                case 'blast': this.clip('boom') || this.tone({ freq: 120, to: 40, dur: 0.4, type: 'sawtooth', vol: 0.2 }); break;
                case 'tinsel': this.clip('tinsel') || this.tone({ freq: 400, to: 3000, dur: 0.4, vol: 0.08 }); break;
                case 'cocoa': this.clip('cocoa') || this.tone({ freq: 300, to: 150, dur: 0.5, type: 'sine', vol: 0.1 }); break;
                case 'load': this.clip(e.p === 'star' ? 'star' : 'powerup', { vol: 0.6, rate: 1.2 }) || this.chime(1200, 2); break;
                case 'use': this.clip('powerup') || this.chime(1000, 4); break;
                case 'shatter': this.clip('candy', { rate: 1.2, vol: 0.6 }); break;
                case 'lower': case 'push': this.clip('lower') || this.tone({ freq: 90, to: 50, dur: 0.5, type: 'sawtooth', vol: 0.15 }); break;
                case 'swap': case 'unload': this.tone({ freq: 700, to: 1000, dur: 0.07, type: 'sine', vol: 0.08 }); break;
                case 'danger': this.tone({ freq: 220, dur: 0.25, type: 'square', vol: 0.06 }); this.tone({ freq: 220, dur: 0.25, type: 'square', vol: 0.06, delay: 0.32 }); break;
                default: break;
            }
            if (e.type === 'shoot' && e.kind === 'candy') this.clip('candy', { vol: 0.8 });
        }
        return pops;
    }
}
