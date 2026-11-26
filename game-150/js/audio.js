// Folio & Fable — sound. Music, effects, ambience and voices were generated with ElevenLabs (audio/*.mp3, see
// dev/audio/README.md). A small Web Audio synth stands in for any effect that can't be loaded and for the music
// (a music-box waltz). The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden
// tab, and music plays through <audio> elements routed into a gain node so that still silences it.

const SFX = ['bell', 'coins', 'page', 'shelve', 'furniture', 'craft', 'magic', 'return', 'trader', 'inspire', 'cat', 'tap', 'talk', 'nope', 'close'];
export const LINES = {
    'vellum-prologue': 'There you are, child. Cold, and alone, and reading the shop signs in the rain. Well. You have a book now. My name is Old Vellum, and I have a shop to show you.',
    'vellum-customer': 'Ah! A customer!',
    'vellum-sale': 'Splendid sale!',
    'vellum-sendoff': 'Off they go, brave hearts.',
    'vellum-welcome': 'Welcome home, adventurers!',
    'vellum-trader': 'Ottoline\'s caravan! I can smell the old paper from here.',
    'vellum-wow': 'Oh, my. Now that is a book.',
    'vellum-goodnight': 'Goodnight, little shop.',
    'vellum-wish': 'Hmm. A wish at the counter, child.',
    'tam-welcome': 'Welcome to Folio and Fable!',
    'tam-justthebook': 'I think I have just the book!',
    'tam-thanks': 'Thank you! Come again!',
    'tam-newbook': 'Ooh, a new book!',
    'tam-wedidit': 'We did it!',
    'tam-open': 'Let\'s open up!',
    'tam-talking': 'A talking book? Hello there…',
    'tam-promise': 'I\'ll bind it, Vellum. For Elowen.',
    'tam-forme': 'A shop? For me?',
};
const STORY = ['vellum-prologue', ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => [`vellum-ch${n}-intro`, `vellum-ch${n}-done`])];
const VOICES = [...Object.keys(LINES).filter((k) => k !== 'vellum-prologue'), ...STORY];
const ONCE = new Set(['chapter']);
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const WALTZ = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];   // C, Am, F, G

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.5; this.voiceVol = 0.9;
        this.buffers = {};
        this.tracks = {};
        this.current = null; this.want = null;
        this.lastVoice = 0;
        this.voiceSrc = null;
        this.synthMusic = false;
        this.step = 0; this.nextT = 0;
        this.onSay = null;          // (name, text) → the UI shows a caption
        this.lastCoins = 0;
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        this.timer = setInterval(() => this._schedule(), 90);
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
        this.music.gain.setTargetAtTime(music * 0.5, t, 0.05);
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

    /** A voice line. One at a time; a gap of quiet first unless forced (the story). The caption shows either way. */
    say(name, text = LINES[name], { force = false, gap = 7 } = {}) {
        const buf = this.buffers['vo-' + name];
        if (!this.ok || !buf) { if (force && text) this.onSay?.(name, text, 4); return false; }
        const now = this.ctx.currentTime;
        if (!force && now < this.lastVoice + gap) return false;
        this.hush();
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.connect(this.voice);
        s.start();
        this.voiceSrc = s;
        this.lastVoice = now + buf.duration;
        if (text) this.onSay?.(name, text, buf.duration + 0.6);
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

    /** Switch the music (title, shop, evening) or play the chapter sting over a dip. Crossfades. */
    play(name) {
        this.want = name;
        if (!this.ctx || this.current === name) return;
        const prev = this.current;
        this.current = name;
        const t = this.ctx.currentTime;
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.setTargetAtTime(0, t, 0.4);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 1800);
        }
        if (!name || this.synthMusic) return;
        const el = this._track(name);
        if (ONCE.has(name) || el.ended) el.currentTime = 0;
        el._gain.gain.cancelScheduledValues(t);
        el._gain.gain.setTargetAtTime(ONCE.has(name) ? 1.1 : 1, t, ONCE.has(name) ? 0.01 : 0.6);
        el.play().catch(() => { /* autoplay */ });
        if (ONCE.has(name) && prev) setTimeout(() => { if (this.current === name) { this.current = null; this.play(prev); } }, 7000);
    }
    playing() { const el = this.tracks[this.current]; return !!el && !el.paused; }

    _ambience() {
        fetch('audio/sfx-ambience.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((b) => this.ctx.decodeAudioData(b)).then((buf) => {
                const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
                s.buffer = buf; s.loop = true; g.gain.value = 0.3;
                s.connect(g); g.connect(this.music);
                s.start();
                this.amb = g;
            }).catch(() => { /* no ambience */ });
    }
    rain(on) { if (this.amb) this.amb.gain.setTargetAtTime(on ? 0.45 : 0.18, this.ctx.currentTime, 1); }

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
        const beat = 60 / (this.current === 'evening' ? 66 : 92);
        if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.05;
        while (this.nextT < this.ctx.currentTime + 0.3) {
            const bar = Math.floor(this.step / 3) % WALTZ.length, i = this.step % 3;
            const dt = this.nextT - this.ctx.currentTime;
            const ch = WALTZ[bar];
            if (i === 0) this.tone({ freq: NOTE(ch[0] - 12), dur: beat * 2.5, type: 'triangle', vol: 0.05, delay: dt, bus: this.music });
            else this.tone({ freq: NOTE(ch[i] + 12), dur: beat * 0.9, vol: 0.03, delay: dt, bus: this.music });
            if (i === 1 && this.step % 6 === 1) this.tone({ freq: NOTE(ch[2] + 24), dur: beat * 1.6, vol: 0.025, delay: dt, bus: this.music });
            this.step++;
            this.nextT += beat;
        }
    }

    ui(kind) {
        if (kind === 'click') this.clip('tap', { vol: 0.55 }) || this.tone({ freq: 1320, dur: 0.06, vol: 0.07 });
        else if (kind === 'open') this.clip('page', { vol: 0.5, rate: 1.1 }) || this.tone({ freq: 990, to: 1320, dur: 0.1, vol: 0.07 });
        else if (kind === 'close') this.clip('page', { vol: 0.4, rate: 0.9 }) || this.tone({ freq: 1320, to: 990, dur: 0.1, vol: 0.07 });
        else if (kind === 'nope') this.clip('nope', { vol: 0.6 }) || this.tone({ freq: 220, to: 180, dur: 0.12, type: 'triangle', vol: 0.08 });
        else if (kind === 'page') this.clip('page', { vol: 0.6, rate: 0.9 + Math.random() * 0.2 }) || this.tone({ freq: 2400, to: 1800, dur: 0.08, vol: 0.03 });
        else if (kind === 'magic') this.clip('magic', { vol: 0.6 }) || this.chime(1320, 4);
    }

    // ------------------------------------------------------------------ simulation events
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'enter': this.clip('bell', { vol: 0.5, rate: 0.95 + Math.random() * 0.1 }) || this.chime(1760, 2, 0.05, 0.04); if (Math.random() < 0.25) this.say('tam-welcome'); break;
                case 'sold': case 'served': case 'fulfilled': {
                    const now = this.ctx?.currentTime || 0;
                    if (now - this.lastCoins > 0.25) this.clip('coins', { vol: 0.7, rate: 0.95 + Math.random() * 0.1 }) || this.chime(1980, 2);
                    this.lastCoins = now;
                    if (e.type === 'served') this.say(Math.random() < 0.5 ? 'tam-thanks' : 'vellum-sale');
                    else if (Math.random() < 0.12) this.say('vellum-sale');
                    break;
                }
                case 'ask': if (Math.random() < 0.35) this.say('vellum-wish'); break;
                case 'shelved': this.clip('shelve', { vol: 0.5, rate: 0.9 + Math.random() * 0.2 }) || this.tone({ freq: 160, dur: 0.08, type: 'triangle', vol: 0.08 }); break;
                case 'placed': case 'pickedUp': case 'moved': this.clip('furniture', { vol: 0.6 }) || this.tone({ freq: 120, dur: 0.12, type: 'triangle', vol: 0.1 }); if (e.what === 'cat') this.clip('cat', { vol: 0.6, delay: 0.3 }); break;
                case 'bought': case 'traded': case 'hired': this.clip('coins', { vol: 0.5, rate: 0.85 }) || this.chime(1320, 2); break;
                case 'crafted': this.clip('craft', { vol: 0.85 }) || this.chime(660, 5, 0.08); if (e.rarity >= 3) this.say('vellum-wow', undefined, { gap: 2 }); break;
                case 'rebound': this.clip('craft', { vol: 0.6, rate: 1.15 }) || this.chime(880, 3); break;
                case 'sent': this.say('vellum-sendoff'); this.clip('page', { vol: 0.4 }); break;
                case 'returned': this.clip('return', { vol: 0.8 }) || this.chime(523, 4, 0.1, 0.09); this.say('vellum-welcome', undefined, { gap: 2 }); break;
                case 'trader': this.clip('trader', { vol: 0.7, delay: 0.4 }); this.say('vellum-trader', undefined, { gap: 3 }); break;
                case 'inspired': this.clip('inspire', { vol: 0.8 }) || this.chime(784, 5, 0.09, 0.09); break;
                case 'chapter': this.play('chapter'); break;
                case 'talk': this.clip('talk', { vol: 0.7 }) || this.chime(1760, 3, 0.03, 0.05); break;
                case 'read': this.clip('page', { vol: 0.6 }); if (e.learned) this.clip('magic', { vol: 0.6, delay: 0.3 }); break;
                case 'opened': this.clip('bell', { vol: 0.6 }); this.say('tam-open', undefined, { gap: 3 }); break;
                case 'closed': this.clip('close', { vol: 0.7 }) || this.tone({ freq: 660, to: 440, dur: 0.3, vol: 0.06 }); break;
                case 'donation': if (e.books?.length) this.clip('shelve', { vol: 0.4, delay: 0.6 }); break;
                default: break;
            }
        }
    }
}
