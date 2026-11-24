// Glimmerglade — sound. Music, effects, ambience and voices were generated with ElevenLabs (audio/*.mp3, see
// dev/audio/README.md). A small Web Audio synth stands in for any effect that can't be loaded and for the music
// (a celesta arpeggio). The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden
// tab, and music plays through <audio> elements routed into a gain node so that still silences it.

const SFX = ['lift', 'pour', 'drop', 'bloom', 'creature', 'reveal', 'unlock', 'nope', 'undo', 'sprout', 'hint', 'star', 'tap'];
const VOICES = [
    'lumi-start', 'lumi-bloom', 'lumi-hello', 'lumi-pretty', 'lumi-think', 'lumi-oops', 'lumi-hint', 'lumi-almost',
    'lumi-win', 'lumi-stars', 'lumi-sprout', 'lumi-mist', 'lumi-unlock', 'lumi-daily', 'lumi-stuck', 'lumi-promise',
    'lumi-end', 'lumi-wow', 'willow-1', 'willow-2', 'willow-3', 'willow-4', 'willow-5', 'willow-end', 'willow-hello',
];
// What each voice line says, for the captions.
export const LINES = {
    'lumi-start': 'Here we go, little lights!', 'lumi-bloom': 'Bloom!', 'lumi-hello': 'Oh, hello, little one!',
    'lumi-pretty': 'Ooh, so pretty!', 'lumi-think': 'Hmm… let me think.', 'lumi-oops': "Oops! Let's try that another way.",
    'lumi-hint': 'Follow the firefly…', 'lumi-almost': 'Almost there!', 'lumi-win': 'The glade is glowing!',
    'lumi-stars': 'Three stars! Sparkle-tastic!', 'lumi-sprout': 'A fresh sprout, just for us!', 'lumi-mist': 'The mist is lifting!',
    'lumi-unlock': 'The brambles let go!', 'lumi-daily': "Today's dewdrop puzzle!", 'lumi-stuck': 'Uh-oh… no more moves. Shall we undo?',
    'lumi-promise': "Leave it to me, Grandmother Willow. I'll bring every wisp home!", 'lumi-end': 'We did it! Goodnight, glade… see you at dawn!',
    'lumi-wow': 'Look at them all!', 'willow-hello': 'Good morning, little light.',
};
const ONCE = new Set(['win']);
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const ARP = [0, 4, 7, 11, 14, 11, 7, 4];        // a dreamy maj7 arpeggio for the fallback music
const PROG = [65, 62, 58, 60];                   // F, Dm, Bb, C

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
        this.onSay = null;                         // (name) → the UI shows a caption
        this.lastPour = 0;
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

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
        this._ambience();
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
    clip(name, { vol = 1, rate = 1, delay = 0 } = {}) {
        if (!this.ok || !this.buffers['sfx-' + name]) return false;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = this.buffers['sfx-' + name];
        s.playbackRate.value = rate;
        g.gain.value = vol;
        s.connect(g); g.connect(this.sfx);
        s.start(this.ctx.currentTime + delay);
        return true;
    }

    /** A character line. One at a time; `gap` seconds of quiet first unless forced (story lines). */
    say(name, { force = false, gap = 6 } = {}) {
        const buf = this.buffers['vo-' + name];
        if (!this.ok || !buf) { if (force) this.onSay?.(name); return false; }
        const now = this.ctx.currentTime;
        if (!force && now < this.lastVoice + gap) return false;
        this.hush();
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.connect(this.voice);
        s.start();
        this.voiceSrc = s;
        this.lastVoice = now + buf.duration;
        this.onSay?.(name);
        return true;
    }
    hush() { if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* ended */ } this.voiceSrc = null; } }

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

    /** Switch the music (title, meadow, moon, star) or play the win sting. Crossfades. */
    play(name) {
        this.want = name;
        if (!this.ctx || this.current === name) return;
        const prev = this.current;
        this.current = name;
        const t = this.ctx.currentTime;
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.setTargetAtTime(0, t, 0.35);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 1600);
        }
        if (!name || this.synthMusic) return;
        const el = this._track(name);
        if (ONCE.has(name) || el.ended) el.currentTime = 0;
        el._gain.gain.cancelScheduledValues(t);
        el._gain.gain.setTargetAtTime(ONCE.has(name) ? 1.1 : 1, t, ONCE.has(name) ? 0.01 : 0.5);
        el.play().catch(() => { /* autoplay */ });
        if (ONCE.has(name) && prev) setTimeout(() => { if (this.current === name) { this.current = null; this.play(prev); } }, 6500);
    }
    playing() { const el = this.tracks[this.current]; return !!el && !el.paused; }

    _ambience() {
        fetch('audio/sfx-ambience.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b)).then((buf) => {
                const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
                s.buffer = buf; s.loop = true; g.gain.value = 0.35;
                s.connect(g); g.connect(this.music);
                s.start();
            }).catch(() => { /* no ambience */ });
    }

    // ------------------------------------------------------------------ synth
    tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0, bus } = {}) {
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
    chime(base = 1320, n = 3, gap = 0.06, vol = 0.07) { for (let i = 0; i < n; i++) this.tone({ freq: base * [1, 1.25, 1.5, 2, 2.5][i % 5], dur: 0.45, vol, delay: i * gap }); }

    _schedule() {
        if (!this.ok || !this.synthMusic || !this.current || ONCE.has(this.current)) return;
        const spb = 60 / 84 / 2;
        if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.05;
        while (this.nextT < this.ctx.currentTime + 0.3) {
            const bar = Math.floor(this.step / 8) % PROG.length, i = this.step % 8;
            const dt = this.nextT - this.ctx.currentTime;
            this.tone({ freq: NOTE(PROG[bar] + 12 + ARP[i]), dur: spb * 2.4, vol: 0.035, delay: dt, bus: this.music });
            if (i === 0) this.tone({ freq: NOTE(PROG[bar] - 12), dur: spb * 7, type: 'triangle', vol: 0.05, delay: dt, bus: this.music });
            this.step++;
            this.nextT += spb;
        }
    }

    ui(kind) {
        if (kind === 'click') this.clip('tap', { vol: 0.6 }) || this.tone({ freq: 1320, dur: 0.06, vol: 0.08 });
        else if (kind === 'open') this.clip('tap', { vol: 0.6, rate: 1.15 }) || this.tone({ freq: 990, to: 1320, dur: 0.1, vol: 0.08 });
        else if (kind === 'close') this.clip('tap', { vol: 0.5, rate: 0.9 }) || this.tone({ freq: 1320, to: 990, dur: 0.1, vol: 0.08 });
        else if (kind === 'lift') this.clip('lift', { vol: 0.7, rate: 0.95 + Math.random() * 0.1 }) || this.chime(1760, 2, 0.04, 0.05);
        else if (kind === 'star') this.clip('star', { vol: 0.8 }) || this.chime(1980, 2, 0.05, 0.08);
    }

    /** Sounds the view asks for when a flying wisp lands. */
    land(kind, colour) {
        if (kind === 'drop') this.clip('drop', { vol: 0.55, rate: 0.85 + colour * 0.04 }) || this.tone({ freq: 1760 + colour * 80, dur: 0.12, vol: 0.06 });
        else if (kind === 'bloom') {
            this.clip('bloom', { vol: 0.9 }) || this.chime(880, 5, 0.07, 0.08);
            this.clip('creature', { vol: 0.7, rate: 0.9 + colour * 0.04, delay: 0.45 });
        }
    }

    // ------------------------------------------------------------------ simulation events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'pour': this.clip('pour', { vol: 0.6, rate: 0.95 + Math.random() * 0.1 }) || this.tone({ freq: 660, to: 990, dur: 0.18, vol: 0.06 }); break;
                case 'nope': this.clip('nope', { vol: 0.6 }) || this.tone({ freq: 220, to: 180, dur: 0.12, type: 'triangle', vol: 0.08 }); break;
                case 'reveal': this.clip('reveal', { vol: 0.6 }) || this.tone({ freq: 2400, to: 1200, dur: 0.3, vol: 0.04 }); break;
                case 'unlock': this.clip('unlock', { vol: 0.8 }) || this.chime(660, 3); break;
                case 'undo': this.clip('undo', { vol: 0.6 }) || this.tone({ freq: 990, to: 660, dur: 0.15, vol: 0.06 }); break;
                case 'sprout': this.clip('sprout', { vol: 0.8 }) || this.chime(520, 4); break;
                case 'hint': if (e.from >= 0) this.clip('hint', { vol: 0.7 }) || this.chime(1320, 3); break;
                case 'restart': this.clip('undo', { vol: 0.6, rate: 0.8 }); break;
                default: break;
            }
        }
    }
}
