// Gemheart Saga — sound. Music, effects and voices were generated with ElevenLabs (audio/*.mp3, see dev/audio/README.md);
// a small Web Audio synth stands in for any file that can't be loaded and plays the UI blips.
// The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden tab.

import { HEROES } from './sim/data/heroes.js';
import { NPCS } from './sim/data/village.js';
import { OPENING, ENDINGS, SOVEREIGN_INTRO, TALES } from './sim/data/story.js';
import { NEMESES } from './sim/data/world.js';
import { NODE } from './sim/data/heroes.js';
import { SOVEREIGN_FALL } from './sim/game.js';

const MUSIC_FILES = ['title', 'village', 'battle', 'boss', 'victory', 'story'];
const SFX_FILES = ['swap', 'match', 'special', 'blast', 'sword', 'fire', 'ice', 'nature', 'arcane', 'heal', 'hurt', 'shield', 'curse', 'roar',
    'defeat', 'levelup', 'coins', 'build', 'anvil', 'cascade'];
const VOICE_FILES = [
    ...HEROES.flatMap((h) => ['cry', 'win', 'hurt', 'intro', 'end'].map((l) => `${h.id}-${l}`)),
    ...NPCS.map((n) => n.id), 'murk',
    ...[...NEMESES.map((n) => n.id), 'sovereign'].flatMap((id) => [`${id}-taunt`, `${id}-fall`]),
    'narrator-open1', 'narrator-open2', 'narrator-open3', 'narrator-end-kael', 'narrator-end-sela', 'narrator-end-fenn', 'narrator-end-odo',
];

export const FILES = { music: MUSIC_FILES, sfx: SFX_FILES, voice: VOICE_FILES };

/** Dialogue text -> voice clip, for every spoken line of the story. */
export const VOICE_LINES = (() => {
    const m = new Map();
    OPENING.forEach(([, t], i) => m.set(t, `narrator-open${i + 1}`));
    for (const h of HEROES) {
        m.set(h.lines.intro, `${h.id}-intro`);
        const end = ENDINGS[h.id];
        m.set(end[0][1], `narrator-end-${h.id}`);
        m.set(end[1][1], `${h.id}-end`);
    }
    m.set(SOVEREIGN_INTRO[0][1], 'sovereign-taunt');
    m.set(SOVEREIGN_FALL, 'sovereign-fall');
    for (const n of NEMESES) {
        const t = TALES[n.hero];
        const meet = t[4].before.find(([sp]) => sp === n.id);
        if (meet) m.set(meet[1], `${n.id}-taunt`);
        // the nemesis's last words: the first of their lines after the final fight with them
        for (const c of t) {
            const lines = [...(c.after || []), ...Object.values(c.mid || {}).flat()];
            const last = lines.find(([sp, tx]) => sp === n.id && /Stop him|proud of you|plant me|keep it safe/.test(tx));
            if (last) m.set(last[1], `${n.id}-fall`);
        }
    }
    for (const n of NPCS) m.set(n.greet, n.id);
    return m;
})();

const SKILL_SFX = { r: 'fire', s: 'ice', e: 'nature', a: 'arcane' };

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8; this.musicVol = 0.55; this.voiceVol = 0.9;
        this.buffers = {};
        this.tracks = {};
        this.current = null; this.want = null;
        this.lastVoice = 0;
        this.voiceSrc = null;
        this.synthOnly = false;
        this.last = {};          // rate limits per sound
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
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.6; this.music.connect(comp);
        this.voice = ctx.createGain(); this.voice.gain.value = this.voiceVol; this.voice.connect(comp);
        const len = ctx.sampleRate * 0.4;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this._loadClips();
        if (this.want) { const w = this.want; this.want = null; this.current = null; this.play(w); }
    }

    get ok() { return !!this.ctx && this.ctx.state === 'running'; }

    _loadClips() {
        const names = [...SFX_FILES.map((n) => 'sfx-' + n), ...VOICE_FILES.map((n) => 'vo-' + n)];
        for (const n of names) {
            fetch(`audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[n] = buf; }).catch(() => { /* synth fallback */ });
        }
    }

    loaded() { return Object.keys(this.buffers).length; }

    clip(name, { vol = 1, rate = 1, bus = 'sfx', gap = 0 } = {}) {
        if (!this.ok || !this.buffers[name]) return false;
        const now = this.ctx.currentTime;
        if (gap && now - (this.last[name] || -9) < gap) return true;
        this.last[name] = now;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = this.buffers[name];
        s.playbackRate.value = rate;
        g.gain.value = vol;
        s.connect(g); g.connect(bus === 'voice' ? this.voice : this.sfx);
        s.start();
        return s;
    }

    /** A spoken line. force: a story line (stops whoever is talking); otherwise a battle bark, rate-limited. */
    say(name, { chance = 1, gap = 5, force = false } = {}) {
        if (!this.ok || !this.buffers['vo-' + name]) return false;
        const now = this.ctx.currentTime;
        if (!force && (now < this.lastVoice + gap || Math.random() > chance)) return false;
        if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* ended */ } }
        this.lastVoice = now + this.buffers['vo-' + name].duration;
        this.voiceSrc = this.clip('vo-' + name, { bus: 'voice' });
        return true;
    }
    hush() { if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch { /* ended */ } this.voiceSrc = null; } }
    sayLine(text) { const c = VOICE_LINES.get(text); return c ? this.say(c, { force: true }) : false; }

    setVolumes(sfx, music, voice) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.sfx.gain.setTargetAtTime(sfx, t, 0.02);
        this.music.gain.setTargetAtTime(music * 0.6, t, 0.05);
        this.voice.gain.setTargetAtTime(voice, t, 0.02);
    }

    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music-${name}.mp3`);
        el.loop = name !== 'victory';
        el.preload = 'auto';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already connected */ }
        g.connect(this.music);
        el._gain = g;
        el.addEventListener('error', () => { this.synthOnly = true; });
        this.tracks[name] = el;
        return el;
    }

    /** Switch the music (crossfade). No-op if already playing it. */
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
        if (!name || this.synthOnly) return;
        const el = this._track(name);
        if (name === 'victory' || el.ended) el.currentTime = 0;
        el._gain.gain.cancelScheduledValues(t);
        el._gain.gain.setTargetAtTime(1, t, name === 'victory' ? 0.02 : 0.35);
        el.play().catch(() => { /* autoplay or missing file */ });
    }
    playing() { const el = this.tracks[this.current]; return !!el && !el.paused; }

    // ------------------------------------------------------------ synth fallback
    tone(freq, dur = 0.1, type = 'square', vol = 0.1, to = null, delay = 0) {
        if (!this.ok) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (!this.ok) return;
        if (kind === 'click') this.tone(880, 0.05, 'triangle', 0.08, 1100);
        else if (kind === 'open') this.tone(520, 0.08, 'triangle', 0.08, 780);
        else if (kind === 'close') this.tone(700, 0.08, 'triangle', 0.08, 460);
        else if (kind === 'no') this.tone(200, 0.15, 'square', 0.07, 150);
        else if (kind === 'coins') { if (!this.clip('sfx-coins', { vol: 0.8 })) [1200, 1500, 1800].forEach((f, i) => this.tone(f, 0.06, 'square', 0.05, null, i * 0.05)); }
        else if (kind === 'build') { if (!this.clip('sfx-build', { vol: 0.8 })) this.tone(300, 0.2, 'square', 0.08, 200); }
        else if (kind === 'anvil') { if (!this.clip('sfx-anvil', { vol: 0.8 })) this.tone(1600, 0.3, 'triangle', 0.08, 1500); }
        else if (kind === 'level') { if (!this.clip('sfx-levelup', { vol: 0.9 })) [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, null, i * 0.07)); }
        else if (kind === 'select') this.tone(1320, 0.04, 'triangle', 0.06);
    }

    onEvents(G, events) {
        if (!this.ok) return;
        let hitPlayed = false, matches = 0, topChain = 0;
        for (const e of events) {
            switch (e.type) {
            case 'swap': this.clip('sfx-swap', { vol: 0.55, gap: 0.05 }) || this.tone(700, 0.05, 'triangle', 0.05, 900); break;
            case 'badswap': this.tone(220, 0.12, 'square', 0.05, 180); break;
            case 'match': matches++; topChain = Math.max(topChain, e.chain); break;
            case 'special': this.clip('sfx-special', { vol: 0.75, gap: 0.1 }); break;
            case 'blast': case 'prism': this.clip('sfx-blast', { vol: 0.8, gap: 0.12, rate: 0.9 + Math.random() * 0.2 }); break;
            case 'hit':
                if (hitPlayed) break;
                hitPlayed = true;
                if (e.src === 'sword' || e.src === 'wolf' || e.src === 'bomb') this.clip('sfx-sword', { vol: e.crit ? 1 : 0.7, gap: 0.08, rate: 0.95 + Math.random() * 0.1 });
                else if (SKILL_SFX[e.src]) this.clip('sfx-' + SKILL_SFX[e.src], { vol: e.weak ? 0.7 : 0.45, gap: 0.12, rate: 0.95 + Math.random() * 0.1 });
                if (e.crit) this.tone(1800, 0.08, 'square', 0.05, 2600, 0.03);
                break;
            case 'skill': {
                const n = NODE[e.id];
                const pool = Object.keys(n.cost)[0];
                this.clip('sfx-' + (n.eff.kind === 'shield' ? 'shield' : n.eff.kind === 'heal' ? 'heal' : SKILL_SFX[pool]), { vol: 0.9 });
                this.say(`${e.hero}-cry`, { chance: 0.45, gap: 6 });
                break;
            }
            case 'hurt': this.clip('sfx-hurt', { vol: 0.8, gap: 0.1 }) || this.tone(140, 0.2, 'sawtooth', 0.1, 70); if (Math.random() < 0.2) this.say(`${G.hero.id}-hurt`, { gap: 10 }); break;
            case 'heal': this.clip('sfx-heal', { vol: 0.45, gap: 0.6 }); break;
            case 'heroShield': case 'foeShield': this.clip('sfx-shield', { vol: 0.8, rate: e.type === 'foeShield' ? 0.8 : 1 }); break;
            case 'curse': this.clip('sfx-curse', { vol: 0.8 }); break;
            case 'doomBurst': this.clip('sfx-blast', { vol: 1, rate: 0.6 }); break;
            case 'enrage': this.clip('sfx-roar', { vol: 0.9 }); break;
            case 'battle':
                this.play(e.rank === 'boss' ? 'boss' : 'battle');
                if (e.rank === 'boss') this.clip('sfx-roar', { vol: 0.7, rate: 1.1 });
                if (e.foe === 'murk') setTimeout(() => this.say('murk', { force: true }), 700);
                break;
            case 'won':
                this.clip('sfx-defeat', { vol: 0.9 });
                this.play('victory');
                setTimeout(() => this.say(`${G.hero.id}-win`, { gap: 0 }), 900);
                break;
            case 'lost': case 'fled': this.play(null); [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, null, i * 0.22)); break;
            case 'levelup': this.ui('level'); break;
            case 'collect': case 'daily': case 'claim': case 'buy': case 'sell': this.ui('coins'); break;
            case 'build': this.ui('build'); break;
            case 'upgrade': this.ui('anvil'); break;
            case 'learn': this.tone(988, 0.08, 'triangle', 0.08, 1480); break;
            case 'revive': this.clip('sfx-heal', { vol: 1, rate: 0.8 }); break;
            case 'item': this.tone(1046, 0.08, 'triangle', 0.08, 1568); break;
            case 'shuffle': this.clip('sfx-swap', { vol: 0.8, rate: 0.7 }); break;
            default: break;
            }
        }
        if (matches) {
            this.clip('sfx-match', { vol: 0.55, gap: 0.05, rate: Math.min(1.6, 0.92 + 0.08 * topChain) }) || this.tone(880 + topChain * 120, 0.08, 'triangle', 0.06);
            if (topChain >= 3) this.clip('sfx-cascade', { vol: 0.6, gap: 0.4, rate: Math.min(1.5, 0.85 + 0.1 * topChain) });
        }
    }
}
