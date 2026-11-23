// Sound: ElevenLabs music, effects and voices (audio/*.mp3, see dev/audio/README.md), with a small Web Audio synth
// standing in for any effect that can't be loaded. The context is made on the first gesture; ../lib/page-audio.js
// suspends it in a hidden tab (music plays through <audio> elements routed into a gain node, so that silences it too).

const SFX = ['hit', 'slash', 'crit', 'fire', 'water', 'leaf', 'wind', 'star', 'heal', 'buff', 'stagger', 'chain', 'poof', 'coins',
    'bell', 'sizzle', 'perfect', 'door', 'levelup', 'flee', 'defeat', 'page'];
const VOICES = {
    maple: ['welcome', 'battle', 'skill', 'guard', 'heal', 'chain', 'victory', 'hurt', 'flee', 'cook', 'clean', 'pay', 'shock', 'levelup', 'deed'],
    ember: ['hello', 'battle', 'skill', 'skill2', 'chain', 'victory', 'hurt', 'cook', 'perfect', 'joined', 'flee'],
    kit: ['hello', 'battle', 'skill', 'steal', 'chain', 'victory', 'hurt', 'checkin', 'joined', 'flee'],
    fern: ['hello', 'battle', 'skill', 'heal', 'chain', 'victory', 'hurt', 'harvest', 'joined'],
    bru: ['hello', 'battle', 'skill', 'skill2', 'chain', 'victory', 'hurt', 'clean', 'joined', 'buff'],
    goldmaw: ['intro', 'debt', 'keepup', 'paid', 'late', 'coin', 'deed', 'friend'],
};
const THEMES = { title: 'music-title', inn: 'music-inn', battle: 'music-battle', boss: 'music-boss' };
const SYNTH = { hit: [180, 90, 0.08, 'square'], slash: [900, 300, 0.08, 'sawtooth'], crit: [300, 80, 0.18, 'square'], heal: [520, 1040, 0.25, 'sine'],
    buff: [440, 880, 0.2, 'triangle'], coins: [1320, 1760, 0.12, 'square'], bell: [1568, 1568, 0.4, 'sine'], poof: [600, 200, 0.1, 'triangle'] };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buffers = {};
        this.tracks = {};
        this.want = null; this.current = null;
        this.lastVoice = 0; this.voiceSrc = null;
        this.rand = 1234567;
    }
    _r() { this.rand = (this.rand * 1103515245 + 12345) & 0x7fffffff; return this.rand / 0x7fffffff; }
    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ctx.destination);
        this.sfxG = ctx.createGain(); this.sfxG.gain.value = this.sfxVol; this.sfxG.connect(comp);
        this.musicG = ctx.createGain(); this.musicG.gain.value = this.musicVol * 0.5; this.musicG.connect(comp);
        this.voiceG = ctx.createGain(); this.voiceG.gain.value = this.voiceVol; this.voiceG.connect(comp);
        const names = [...SFX.map((s) => 'sfx-' + s), 'jingle-victory', 'jingle-paid'];
        for (const [who, lines] of Object.entries(VOICES)) for (const l of lines) names.push(`vo-${who}-${l}`);
        for (const n of names) {
            fetch(`audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then((b) => ctx.decodeAudioData(b)).then((buf) => { this.buffers[n] = buf; }).catch(() => { /* synth fallback */ });
        }
        if (this.want) { const w = this.want; this.want = null; this.music(w); }
    }

    setVolumes(sfx, music, voice) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfxG.gain.setTargetAtTime(sfx, t, 0.02);
        this.musicG.gain.setTargetAtTime(music * 0.5, t, 0.05);
        this.voiceG.gain.setTargetAtTime(voice, t, 0.02);
    }

    _buf(name, gain, vol = 1, rate = 1) {
        const b = this.buffers[name];
        if (!b || !this.ok) return null;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
        const g = this.ctx.createGain(); g.gain.value = vol;
        s.connect(g); g.connect(gain); s.start();
        return s;
    }

    tone(f0, f1, dur, type = 'triangle', vol = 0.15) {
        if (!this.ok) return;
        const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
    }

    sfx(name, vol = 1) {
        if (!this.ok) return;
        if (this._buf('sfx-' + name, this.sfxG, vol, 0.95 + this._r() * 0.1)) return;
        const s = SYNTH[name] || SYNTH.hit;
        this.tone(s[0], s[1], s[2], s[3]);
    }

    ui(kind) {
        if (kind === 'click') this.tone(700, 900, 0.05, 'triangle', 0.08);
        else if (kind === 'open') this.sfx('page', 0.6);
        else if (kind === 'close') this.tone(800, 500, 0.06, 'triangle', 0.07);
    }

    jingle(name) { this._buf('jingle-' + name, this.musicG, 1.6); }

    /** A voice line, one at a time, at most every 2.5 s unless forced; chance < 1 skips some. */
    voice(who, line, chance = 1, force = false) {
        if (!this.ok || !who || !line || !VOICES[who]?.includes(line)) return false;
        const now = this.ctx.currentTime;
        if (!force && (now - this.lastVoice < 2.5 || this._r() > chance)) return false;
        if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* done */ } }
        const s = this._buf(`vo-${who}-${line}`, this.voiceG);
        if (s) { this.voiceSrc = s; this.lastVoice = now; return true; }
        return false;
    }

    /** Crossfade to a theme: title, inn, battle, boss (or null for silence). */
    music(theme) {
        if (!this.ctx) { this.want = theme; return; }
        if (this.current === theme) return;
        const prev = this.current && this.tracks[this.current];
        this.current = theme;
        if (prev) { const el = prev; const g = el._g; g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); setTimeout(() => el.pause(), 1600); }
        if (!theme) return;
        let el = this.tracks[theme];
        if (!el) {
            el = new window.Audio(`audio/${THEMES[theme]}.mp3`);
            el.loop = true; el.crossOrigin = 'anonymous';
            try {
                const src = this.ctx.createMediaElementSource(el);
                el._g = this.ctx.createGain(); src.connect(el._g); el._g.connect(this.musicG);
            } catch { el._g = { gain: { setTargetAtTime() {}, value: 1 } }; }
            this.tracks[theme] = el;
        }
        el._g.gain.cancelScheduledValues?.(this.ctx.currentTime);
        el._g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
        el.currentTime = 0;
        el.play().catch(() => { /* blocked until a gesture */ });
    }

    /** Answer simulation events with sound and the odd voice line. */
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'sweep': if (!e.byStaff) { this.sfx('poof'); this.voice('maple', 'clean', 0.12); } break;
                case 'cookStart': this.sfx('sizzle'); if (e.staff === 'ember') this.voice('ember', 'cook', 0.4); else this.voice('maple', 'cook', 0.3); break;
                case 'cooked': this.sfx(e.grade === 'perfect' ? 'perfect' : 'buff'); if (e.grade === 'perfect' && e.chef === 'ember') this.voice('ember', 'perfect', 0.6); break;
                case 'checkin': this.sfx('bell'); if (e.byStaff) this.voice('kit', 'checkin', 0.25); break;
                case 'guestArrive': this.sfx('door'); break;
                case 'checkout': case 'served': case 'dailyDone': case 'sold': this.sfx('coins'); break;
                case 'harvest': this.sfx('leaf', 0.6); if (!e.byStaff) this.voice('fern', 'harvest', 0.2); break;
                case 'paid': this.sfx('coins'); this.voice('maple', 'pay', 0.5); break;
                case 'tierUp': this.jingle('paid'); break;
                                case 'levelUp': this.sfx('levelup'); this.voice(e.hero, e.hero === 'maple' ? 'levelup' : null, 0.5); break;
                case 'battleStart': this.music(e.boss ? 'boss' : 'battle'); { const h = G.party[Math.floor(this._r() * G.party.length)]; this.voice(h, 'battle', 0.7, true); } break;
                case 'victory': this.music(null); this.jingle('victory'); { const h = G.party[Math.floor(this._r() * G.party.length)]; setTimeout(() => this.voice(h, 'victory', 1, true), 900); } break;
                case 'defeat': this.music(null); this.voice('maple', 'hurt', 1, true); break;
                case 'fled': this.voice(G.party[0], 'flee', 1, true); break;
                case 'recruited': this.voice(e.hero, 'joined', 1, true); break;
                case 'stranger': this.sfx('door'); break;
                case 'bondUp': this.sfx('heal', 0.7); break;
                case 'nope': this.tone(300, 200, 0.12, 'square', 0.06); break;
                default: break;
            }
        }
    }
}
