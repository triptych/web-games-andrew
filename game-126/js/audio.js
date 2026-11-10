// EMBERSPIRE — sound. Music, effects and character voices were generated with ElevenLabs (audio/*.mp3); a small
// Web Audio synth (square and triangle voices, a noise channel and a look-ahead chiptune sequencer) stands in for
// any file that can't be loaded, and still plays the UI blips.
// The context is made on the first gesture; ../lib/page-audio.js suspends it in a hidden tab.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Each theme: tempo, a chord progression (root midi, minor?), and patterns for lead and bass (scale steps).
const THEMES = {
    title: { bpm: 84, prog: [[57, 1], [53, 0], [48, 0], [55, 0]], lead: [0, 2, 4, 7, 6, 4, 2, 4], bass: [0, 0, 4, 0], wave: 'triangle', leadVol: 0.07 },
    town: { bpm: 108, prog: [[60, 0], [65, 0], [57, 1], [67, 0]], lead: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 7, 7, -1], bass: [0, 4, 7, 4], wave: 'square', leadVol: 0.045 },
    battle: { bpm: 152, prog: [[57, 1], [57, 1], [53, 0], [55, 0]], lead: [0, 2, 3, 4, 3, 2, 0, -1, 4, 6, 7, 6, 4, 3, 2, 3], bass: [0, 0, 7, 0, 0, 7, 0, 5], wave: 'square', leadVol: 0.05 },
    boss: { bpm: 168, prog: [[52, 1], [53, 0], [52, 1], [50, 1]], lead: [7, 6, 7, 4, 7, 6, 7, 2, 3, 4, 3, 2, 0, 2, 3, 6], bass: [0, 0, 0, 0, 7, 7, 5, 5], wave: 'sawtooth', leadVol: 0.035 },
    evening: { bpm: 72, prog: [[62, 0], [57, 1], [59, 1], [55, 0]], lead: [4, -1, 2, 4, 7, -1, 6, 4, 2, -1, 4, 2, 0, -1, -1, -1], bass: [0, 7, 4, 7], wave: 'triangle', leadVol: 0.06 },
    victory: { bpm: 140, prog: [[60, 0]], lead: [0, 0, 0, 0, -1, -2, 1, 0, 4, 7], bass: [0], wave: 'square', leadVol: 0.06, once: true },
};
// Files made with ElevenLabs (see dev/audio/README.md). Anything that fails to load falls back to the synth.
const SFX_FILES = ['hit', 'fire', 'ice', 'bolt', 'holy', 'dark', 'nature', 'heal', 'down', 'coins', 'anvil', 'roar', 'levelup', 'revive'];
const VOICE_FILES = [
    ...['arin', 'mira', 'brakka', 'sylas', 'lyra', 'thorne', 'pip', 'grimble', 'nyx'].flatMap((h) => [`${h}-cry`, `${h}-win`, `${h}-join`]),
    'bram', 'hilde', 'corwin', 'zephyrine', 'amaya', 'watcher-intro', 'watcher-gate',
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.5;
        this.theme = null;
        this.want = null;
        this.step = 0;
        this.nextT = 0;
        this.voiceVol = 0.9;
        this.buffers = {};          // decoded sfx and voice clips (ElevenLabs)
        this.tracks = {};           // <audio> elements for the music (ElevenLabs)
        this.lastVoice = 0;
        this.synthOnly = false;     // set when the music files can't be loaded: fall back to the chiptune sequencer
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.out = comp;
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.6; this.music.connect(comp);
        const len = ctx.sampleRate * 0.5;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.voice_ = ctx.createGain(); this.voice_.gain.value = this.voiceVol; this.voice_.connect(comp);
        this.timer = setInterval(() => this._schedule(), 60);
        this._loadClips();
        if (this.want) { const w = this.want; this.want = null; this.play(w); }
    }

    // ------------------------------------------------------------ generated audio files (ElevenLabs)
    _loadClips() {
        const names = [...SFX_FILES.map((n) => 'sfx-' + n), ...VOICE_FILES.map((n) => 'vo-' + n)];
        for (const n of names) {
            fetch(`audio/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.buffers[n] = buf; }).catch(() => { /* fall back to synth */ });
        }
    }

    /** Play a decoded clip; returns false if it isn't loaded (callers then use the synth sound). */
    clip(name, { vol = 1, rate = 1, bus = 'sfx' } = {}) {
        if (!this.ok || !this.buffers[name]) return false;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = this.buffers[name];
        s.playbackRate.value = rate;
        g.gain.value = vol;
        s.connect(g); g.connect(bus === 'voice' ? this.voice_ : this.sfx);
        s.start();
        return true;
    }

    /** A character line. min seconds between lines so voices never pile up; chance to keep battles from getting chatty. */
    say(name, { chance = 1, gap = 4, force = false } = {}) {
        if (!this.ok || !this.buffers['vo-' + name]) return false;
        const now = this.ctx.currentTime;
        if (!force && (now - this.lastVoice < gap || Math.random() > chance)) return false;
        if (force && now < this.lastVoice) return false;     // a tap while someone is still talking: never stack voices
        this.lastVoice = now + this.buffers['vo-' + name].duration;
        return this.clip('vo-' + name, { bus: 'voice' });
    }

    /** Seconds until the voice line now playing ends (0 when no one is talking). */
    voiceLeft() { return this.ctx ? Math.max(0, this.lastVoice - this.ctx.currentTime) : 0; }

    _track(name) {
        let el = this.tracks[name];
        if (el) return el;
        el = new window.Audio(`audio/music-${name}.mp3`);
        el.loop = name !== 'victory';
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        const g = this.ctx.createGain();
        g.gain.value = 0;
        try { this.ctx.createMediaElementSource(el).connect(g); } catch { /* already connected */ }
        g.connect(this.music);
        el._gain = g;
        el.addEventListener('error', () => { if (!this.synthOnly) { this.synthOnly = true; const w = this.current; this.current = null; this.play(w); } });
        this.tracks[name] = el;
        return el;
    }

    setVolumes(sfx, music, voice = this.voiceVol) {
        this.sfxVol = sfx; this.musicVol = music; this.voiceVol = voice;
        if (!this.ctx) return;
        this.voice_.gain.setTargetAtTime(voice, this.ctx.currentTime, 0.02);
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.6, this.ctx.currentTime, 0.05);
    }

    /** Switch the music theme (no-op if already playing it). */
    play(name) {
        this.want = name;
        if (!this.ctx || this.current === name) return;
        this.current = name;
        const t = this.ctx.currentTime;
        // fade out whatever file is playing
        for (const [n, el] of Object.entries(this.tracks)) {
            if (n === name) continue;
            el._gain.gain.setTargetAtTime(0, t, 0.35);
            setTimeout(() => { if (this.current !== n) el.pause(); }, 1600);
        }
        if (!name) { this.theme = null; return; }
        if (!this.synthOnly) {
            this.theme = null;          // the synth stays quiet while a file plays
            const el = this._track(name);
            if (name === 'victory' || el.ended) el.currentTime = 0;
            el._gain.gain.cancelScheduledValues(t);
            el._gain.gain.setTargetAtTime(1, t, name === 'victory' ? 0.02 : 0.4);
            el.play().catch(() => { /* autoplay or missing file: the error handler falls back */ });
            return;
        }
        this.theme = THEMES[name] ? name : null;
        this.step = 0;
        this.nextT = t + 0.08;
    }

    _schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running' || !this.theme) return;
        const th = THEMES[this.theme];
        const spb = 60 / th.bpm / 2;          // eighth notes
        while (this.nextT < ctx.currentTime + 0.25) {
            const t = this.nextT;
            const bar = Math.floor(this.step / 8) % th.prog.length;
            const [root, minor] = th.prog[bar];
            const scale = minor ? MINOR : MAJOR;
            const li = th.lead[this.step % th.lead.length];
            if (li >= 0) this.voice(th.wave, NOTE(root + 12 + scale[li]), t, spb * 0.9, th.leadVol, this.music);
            if (this.step % 2 === 0) {
                const bi = th.bass[(this.step / 2) % th.bass.length];
                this.voice('triangle', NOTE(root - 12 + scale[bi % scale.length]), t, spb * 1.8, 0.09, this.music);
            }
            if (this.theme === 'battle' || this.theme === 'boss') {
                if (this.step % 4 === 0) this.noise(t, 0.06, 0.05, 900, this.music);
                if (this.step % 4 === 2) this.noise(t, 0.04, 0.03, 4000, this.music);
            }
            this.step++;
            this.nextT += spb;
            if (th.once && this.step >= th.lead.length) { this.theme = null; return; }
        }
    }

    voice(type, freq, t, dur, vol, dest, to = null) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + dur + 0.02);
    }

    noise(t, dur, vol, freq, dest) {
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        s.buffer = this.noiseBuf;
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(dest);
        s.start(t); s.stop(t + dur + 0.02);
    }

    get ok() { return this.ctx && this.ctx.state === 'running'; }
    tone(freq, dur = 0.1, type = 'square', vol = 0.12, to = null, delay = 0) {
        if (!this.ok) return;
        this.voice(type, freq, this.ctx.currentTime + delay, dur, vol, this.sfx, to);
    }

    ui(kind) {
        if (!this.ok) return;
        if (kind === 'move') this.tone(880, 0.03, 'square', 0.04);
        else if (kind === 'click') { this.tone(988, 0.04, 'square', 0.07); this.tone(1319, 0.06, 'square', 0.05, null, 0.035); }
        else if (kind === 'back') this.tone(660, 0.06, 'square', 0.06, 440);
        else if (kind === 'buy') { if (!this.clip('sfx-coins', { vol: 0.7 })) [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.08, 'square', 0.06, null, i * 0.05)); }
        else if (kind === 'no') this.tone(180, 0.15, 'square', 0.08, 140);
        else if (kind === 'forge' && this.clip('sfx-anvil')) { /* generated clang */ }
        else if (kind === 'forge') { this.noise(this.ctx.currentTime, 0.12, 0.25, 3000, this.sfx); this.tone(1760, 0.3, 'triangle', 0.08, 1700); }
        else if (kind === 'level' && this.clip('sfx-levelup', { vol: 0.8 })) { /* generated fanfare */ }
        else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, null, i * 0.07)); }
        else if (kind === 'heart') { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, null, i * 0.09)); }
        else if (kind === 'coins' && this.clip('sfx-coins')) { /* generated coins */ }
        else if (kind === 'coins') { for (let i = 0; i < 5; i++) this.tone(1500 + i * 120, 0.05, 'square', 0.05, null, i * 0.04); }
    }

    hit(e) {
        if (!this.ok) return;
        const t = this.ctx.currentTime;
        const el = e.el || 'phys';
        const clipName = el === 'phys' ? 'sfx-hit' : 'sfx-' + el;
        if (this.clip(clipName, { vol: e.crit ? 1 : 0.75, rate: 0.94 + Math.random() * 0.12 })) {
            if (e.crit) this.tone(1800, 0.08, 'square', 0.05, 2600, 0.03);
            return;
        }
        if (el === 'fire') { this.noise(t, 0.25, 0.3, 700, this.sfx); this.tone(200, 0.2, 'sawtooth', 0.06, 80); }
        else if (el === 'ice') { this.tone(2400, 0.15, 'triangle', 0.08, 1600); this.noise(t, 0.1, 0.12, 6000, this.sfx); }
        else if (el === 'bolt') { this.noise(t, 0.18, 0.3, 2500, this.sfx); this.tone(1200, 0.12, 'square', 0.06, 300); }
        else if (el === 'holy') { this.tone(1568, 0.25, 'triangle', 0.08, 2093); this.tone(1175, 0.25, 'triangle', 0.06); }
        else if (el === 'dark') { this.tone(220, 0.3, 'sawtooth', 0.08, 70); }
        else if (el === 'nature') { this.noise(t, 0.12, 0.15, 1500, this.sfx); this.tone(330, 0.1, 'triangle', 0.06, 200); }
        else { this.noise(t, 0.08, 0.28, 1800, this.sfx); this.tone(180, 0.09, 'square', 0.08, 60); }
        if (e.crit) this.tone(1800, 0.08, 'square', 0.06, 2600, 0.03);
        if (e.weak) this.tone(1320, 0.06, 'square', 0.05, null, 0.05);
    }

    onEvents(G, events) {
        if (!this.ok) return;
        for (const e of events) {
            if (e.type === 'battle') this.play(e.rank === 'boss' ? 'boss' : 'battle');
            else if (e.type === 'heal' && !e.regen) { if (!this.clip('sfx-heal', { vol: 0.6 })) this.tone(1047, 0.15, 'triangle', 0.06, 1568); }
            else if (e.type === 'down') { if (!(e.uid?.[0] === 'e' && this.clip('sfx-down', { vol: 0.7 }))) this.tone(300, 0.3, 'square', 0.07, 60); }
            else if (e.type === 'revive') { if (!this.clip('sfx-revive')) [523, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.07, null, i * 0.06)); }
            else if (e.type === 'act' && e.uid?.[0] === 'p' && e.kind !== 'defend' && e.kind !== 'flee' && e.kind !== 'item' && e.id !== 'attack') {
                const u = G.battle?.units.find((x) => x.uid === e.uid);
                if (u) this.say(`${u.ref}-cry`, { chance: 0.35, gap: 7 });
            }
            else if (e.type === 'won') {
                this.play('victory');
                const alive = G.battle?.units.filter((x) => x.side === 'p' && x.alive) || [];
                if (alive.length) setTimeout(() => this.say(`${alive[Math.floor(Math.random() * alive.length)].ref}-win`, { gap: 0 }), 900);
            }
            else if (e.type === 'recruit') this.say(`${e.id}-join`, { gap: 0 });
            else if (e.type === 'lost') { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, null, i * 0.22)); this.play(null); }
            else if (e.type === 'levelup') this.ui('level');
            else if (e.type === 'enrage' && this.clip('sfx-roar')) { /* generated roar */ }
            else if (e.type === 'enrage') { this.noise(this.ctx.currentTime, 0.6, 0.3, 300, this.sfx); this.tone(110, 0.6, 'sawtooth', 0.1, 55); }
            else if (e.type === 'status' && e.on) this.tone(660, 0.06, 'square', 0.03, 880);
            else if (e.type === 'bond' || e.type === 'keepsake') this.ui('heart');
            else if (e.type === 'upgrade' || e.type === 'reforge') this.ui('forge');
            else if (e.type === 'daily' || e.type === 'collect' || e.type === 'claim') this.ui('coins');
            else if (e.type === 'evolve' || e.type === 'ascend') { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.2, 'square', 0.06, null, i * 0.08)); }
        }
    }
}
