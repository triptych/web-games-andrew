/* TALEWRIGHT runtime — audio: synthesised sound effects and generated music.
 * A theme is a tempo, a mode, a chord progression, instruments and a seed; a
 * look-ahead sequencer turns it into bass, chords, arpeggio, a lead melody and
 * drums. The same theme always plays the same song. */
(window.TW_MODULES = window.TW_MODULES || []).push(['audio', function (TW) {
    'use strict';
    const U = TW.util;

    let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
    const settings = { sound: true, music: true, volume: 0.7 };

    function ensure() {
        if (ctx) return ctx;
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain(); master.gain.value = settings.volume; master.connect(ctx.destination);
        musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.55 : 0; musicBus.connect(master);
        sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sound ? 0.8 : 0; sfxBus.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return ctx;
    }

    let wanted = null;       // music asked for before the first user gesture
    function unlock() {
        const c = ensure();
        if (c && c.state === 'suspended') c.resume().catch(() => {});
        if (c && wanted && !playing) { const w = wanted; wanted = null; playMusic(w); }
    }

    function configure(s) {
        Object.assign(settings, s || {});
        if (!ctx) return;
        master.gain.value = settings.volume;
        musicBus.gain.value = settings.music ? 0.55 : 0;
        sfxBus.gain.value = settings.sound ? 0.8 : 0;
    }

    // ── voices ───────────────────────────────────────────────────────────────
    function osc(type, freq, t, dur, vol, bus, opts) {
        opts = opts || {};
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
        if (opts.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = freq * 0.012; l.connect(lg).connect(o.frequency); l.start(t + 0.08); l.stop(t + dur + 0.05); }
        const a = opts.a || 0.005, r = opts.r || Math.min(0.12, dur * 0.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + a);
        g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(t, dur, vol, bus, opts) {
        opts = opts || {};
        const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        s.buffer = noiseBuf;
        f.type = opts.type || 'highpass'; f.frequency.value = opts.freq || 6000;
        if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(bus);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    // ── sound effects ────────────────────────────────────────────────────────
    const SFX = {
        cursor:   (t) => osc('square', 880, t, 0.04, 0.12, sfxBus),
        confirm:  (t) => { osc('square', 660, t, 0.05, 0.13, sfxBus); osc('square', 990, t + 0.05, 0.07, 0.13, sfxBus); },
        cancel:   (t) => { osc('square', 520, t, 0.05, 0.12, sfxBus); osc('square', 390, t + 0.05, 0.07, 0.12, sfxBus); },
        buzzer:   (t) => osc('sawtooth', 140, t, 0.18, 0.14, sfxBus, { to: 110 }),
        open:     (t) => { noise(t, 0.08, 0.2, sfxBus, { freq: 1500 }); [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + 0.06 + i * 0.06, 0.12, 0.18, sfxBus)); },
        door:     (t) => { noise(t, 0.18, 0.28, sfxBus, { type: 'lowpass', freq: 900, to: 200 }); osc('sine', 120, t, 0.15, 0.25, sfxBus, { to: 70 }); },
        coin:     (t) => { osc('square', 988, t, 0.06, 0.12, sfxBus); osc('square', 1319, t + 0.06, 0.18, 0.12, sfxBus); },
        item:     (t) => [659, 784, 988, 1319].forEach((f, i) => osc('triangle', f, t + i * 0.07, 0.14, 0.18, sfxBus)),
        heal:     (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => osc('sine', f, t + i * 0.06, 0.25, 0.14, sfxBus)),
        save:     (t) => [784, 1047, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.1, 0.3, 0.16, sfxBus, { vib: 1 })),
        hit:      (t) => { noise(t, 0.12, 0.35, sfxBus, { type: 'lowpass', freq: 2500, to: 300 }); osc('square', 180, t, 0.08, 0.18, sfxBus, { to: 60 }); },
        critical: (t) => { noise(t, 0.2, 0.45, sfxBus, { type: 'lowpass', freq: 4000, to: 200 }); osc('sawtooth', 300, t, 0.15, 0.2, sfxBus, { to: 50 }); osc('square', 1200, t, 0.05, 0.1, sfxBus); },
        miss:     (t) => noise(t, 0.15, 0.15, sfxBus, { type: 'bandpass', freq: 3000, to: 800 }),
        slash:    (t) => noise(t, 0.16, 0.3, sfxBus, { type: 'bandpass', freq: 5000, to: 900 }),
        fire:     (t) => { noise(t, 0.45, 0.35, sfxBus, { type: 'lowpass', freq: 1800, to: 300 }); osc('sawtooth', 90, t, 0.4, 0.12, sfxBus, { to: 50 }); },
        ice:      (t) => { [2093, 2637, 3136, 2349].forEach((f, i) => osc('sine', f, t + i * 0.04, 0.2, 0.08, sfxBus)); noise(t, 0.3, 0.12, sfxBus, { freq: 7000 }); },
        bolt:     (t) => { noise(t, 0.3, 0.4, sfxBus, { freq: 2000 }); osc('sawtooth', 1600, t, 0.25, 0.12, sfxBus, { to: 80 }); },
        holy:     (t) => [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.05, 0.5, 0.1, sfxBus, { vib: 1 })),
        dark:     (t) => { osc('sawtooth', 110, t, 0.5, 0.18, sfxBus, { to: 55 }); osc('sawtooth', 116, t, 0.5, 0.12, sfxBus, { to: 58 }); },
        wind:     (t) => noise(t, 0.5, 0.25, sfxBus, { type: 'bandpass', freq: 600, to: 2400 }),
        levelup:  (t) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => osc('square', f, t + i * 0.08, 0.14, 0.1, sfxBus)),
        escape:   (t) => [880, 660, 440, 330].forEach((f, i) => osc('square', f, t + i * 0.05, 0.06, 0.1, sfxBus)),
        encounter: (t) => { for (let i = 0; i < 6; i++) osc('square', i % 2 ? 330 : 440, t + i * 0.05, 0.05, 0.12, sfxBus); noise(t + 0.3, 0.25, 0.3, sfxBus, { type: 'lowpass', freq: 3000, to: 200 }); },
        step:     (t) => noise(t, 0.04, 0.06, sfxBus, { type: 'lowpass', freq: 800 }),
    };

    function sfx(name) {
        if (!settings.sound) return;
        const c = ctx;
        if (!c || c.state !== 'running') return;
        const f = SFX[name];
        if (f) f(c.currentTime + 0.01);
    }

    // ── music themes ─────────────────────────────────────────────────────────
    const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10], LYD = [0, 2, 4, 6, 7, 9, 11], MIX = [0, 2, 4, 5, 7, 9, 10];
    const THEMES = {
        village:   { name: 'Village', bpm: 104, root: 60, mode: MAJ, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'triangle', bass: 'triangle', arp: 'square', drums: 'soft', density: 0.55, seed: 11 },
        field:     { name: 'Field', bpm: 128, root: 62, mode: MIX, prog: [0, 6, 3, 0, 0, 6, 4, 4], lead: 'square', bass: 'triangle', arp: 'square', drums: 'march', density: 0.65, seed: 23 },
        dungeon:   { name: 'Dungeon', bpm: 92, root: 57, mode: PHR, prog: [0, 1, 0, 6, 0, 1, 5, 4], lead: 'triangle', bass: 'sawtooth', arp: null, drums: 'slow', density: 0.35, seed: 37 },
        castle:    { name: 'Castle', bpm: 96, root: 58, mode: MAJ, prog: [0, 4, 5, 3, 0, 3, 4, 0], lead: 'square', bass: 'triangle', arp: 'triangle', drums: 'march', density: 0.5, seed: 41 },
        battle:    { name: 'Battle', bpm: 156, root: 57, mode: MIN, prog: [0, 5, 6, 4, 0, 5, 3, 4], lead: 'square', bass: 'sawtooth', arp: 'square', drums: 'driving', density: 0.75, seed: 53 },
        boss:      { name: 'Boss', bpm: 168, root: 55, mode: PHR, prog: [0, 1, 0, 6, 5, 1, 4, 4], lead: 'sawtooth', bass: 'sawtooth', arp: 'square', drums: 'driving', density: 0.8, seed: 67 },
        victory:   { name: 'Victory', bpm: 150, root: 60, mode: MAJ, prog: [0, 3, 4, 0], lead: 'square', bass: 'triangle', arp: 'square', drums: 'march', density: 0.9, seed: 71, once: true },
        title:     { name: 'Title', bpm: 84, root: 60, mode: LYD, prog: [0, 1, 4, 3, 0, 1, 5, 4], lead: 'triangle', bass: 'triangle', arp: 'sine', drums: null, density: 0.45, seed: 83 },
        mystery:   { name: 'Mystery', bpm: 76, root: 59, mode: DOR, prog: [0, 3, 0, 6, 0, 3, 4, 4], lead: 'sine', bass: 'triangle', arp: 'triangle', drums: null, density: 0.35, seed: 97 },
        sorrow:    { name: 'Sorrow', bpm: 66, root: 57, mode: MIN, prog: [0, 5, 2, 6, 0, 3, 4, 4], lead: 'triangle', bass: 'sine', arp: 'sine', drums: null, density: 0.4, seed: 101 },
        haunted:   { name: 'Haunted', bpm: 80, root: 56, mode: PHR, prog: [0, 1, 0, 5, 0, 1, 6, 4], lead: 'sine', bass: 'sawtooth', arp: 'triangle', drums: 'slow', density: 0.4, seed: 113, pack: 'music.haunted' },
        frost:     { name: 'Frost', bpm: 90, root: 64, mode: LYD, prog: [0, 1, 5, 4, 0, 1, 3, 4], lead: 'sine', bass: 'triangle', arp: 'sine', drums: 'soft', density: 0.45, seed: 127, pack: 'music.frost' },
        dunes:     { name: 'Dunes', bpm: 112, root: 62, mode: PHR, prog: [0, 1, 0, 1, 6, 5, 1, 0], lead: 'sawtooth', bass: 'triangle', arp: 'triangle', drums: 'march', density: 0.55, seed: 131, pack: 'music.dunes' },
        starlight: { name: 'Starlight', bpm: 118, root: 61, mode: DOR, prog: [0, 6, 5, 6, 0, 3, 4, 6], lead: 'square', bass: 'sawtooth', arp: 'square', drums: 'driving', density: 0.6, seed: 149, pack: 'music.starlight' },
        festival:  { name: 'Festival', bpm: 140, root: 65, mode: MAJ, prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'square', bass: 'triangle', arp: 'square', drums: 'driving', density: 0.75, seed: 151, pack: 'music.festival' },
        heroic:    { name: 'Heroic', bpm: 132, root: 58, mode: MAJ, prog: [0, 6, 3, 4, 0, 6, 4, 4], lead: 'square', bass: 'sawtooth', arp: 'triangle', drums: 'march', density: 0.7, seed: 163, pack: 'music.heroic' },
    };

    // A song is generated once per theme: 8 bars of 8 eighth notes.
    const songs = new Map();
    function compose(id) {
        if (songs.has(id)) return songs.get(id);
        const th = THEMES[id];
        const rnd = U.rng(th.seed * 7919 + 13);
        const deg = (d, oct) => {
            const n = th.mode.length;
            const o = Math.floor(d / n), i = ((d % n) + n) % n;
            return th.root + th.mode[i] + 12 * (o + (oct || 0));
        };
        const bars = th.prog.length;
        const lead = [];
        let cur = 7; // degree index, around an octave above root
        for (let b = 0; b < bars; b++) {
            const chord = th.prog[b];
            const tones = [chord, chord + 2, chord + 4];
            // phrases repeat with a variation: bars 4..7 echo 0..3 except the cadence
            if (b >= 4 && b < bars - 1 && bars === 8 && rnd() < 0.6) { for (let s = 0; s < 8; s++) lead.push(lead[(b - 4) * 8 + s]); continue; }
            for (let s = 0; s < 8; s++) {
                const strong = s % 2 === 0;
                if (!strong && rnd() > th.density) { lead.push(null); continue; }
                if (rnd() < 0.18 && s > 0) { lead.push(-1); continue; } // hold
                if (strong) {
                    // land near a chord tone
                    let best = tones[0] + 7, bd = 99;
                    for (const t of tones) for (const o of [0, 7, 14]) { const c = t + o; const dd = Math.abs(c - cur); if (dd < bd) { bd = dd; best = c; } }
                    cur = best;
                } else cur += rnd() < 0.5 ? 1 : -1;
                cur = U.clamp(cur, 4, 14);
                lead.push(deg(cur));
            }
        }
        if (bars >= 4) { const end = (bars - 1) * 8; lead[end] = deg(7); lead[end + 1] = -1; lead[end + 2] = -1; lead[end + 3] = -1; }
        const song = { th, lead, deg, bars };
        songs.set(id, song);
        return song;
    }

    let playing = null, timer = null;

    function schedule() {
        if (!playing || !ctx) return;
        const p = playing, th = p.song.th;
        const step = 60 / th.bpm / 2; // eighth note
        while (p.next < ctx.currentTime + 0.12) {
            const i = p.i, bar = Math.floor(i / 8) % p.song.bars, s = i % 8, t = p.next;
            if (th.once && i >= p.song.bars * 8) { stopMusic(); return; }
            const chord = th.prog[bar];
            // bass on beats, octave hop
            if (s % 2 === 0) osc(th.bass, hz(p.song.deg(chord, -1) - 12 + (s === 4 ? 12 : 0)), t, step * 1.8, 0.16, musicBus, { r: 0.05 });
            // chord pad on the bar
            if (s === 0 && th.arp !== 'sine') [0, 2, 4].forEach((o) => osc('triangle', hz(p.song.deg(chord + o)), t, step * 7.5, 0.035, musicBus, { a: 0.05, r: 0.3 }));
            // arpeggio
            if (th.arp) { const o = [0, 2, 4, 7, 4, 2, 0, 2][s]; osc(th.arp, hz(p.song.deg(chord + o, 1)), t, step * 0.8, th.arp === 'sine' ? 0.05 : 0.03, musicBus); }
            // lead
            const n = p.song.lead[(i % (p.song.bars * 8))];
            if (n && n > 0) {
                let len = 1;
                while (p.song.lead[(i + len) % (p.song.bars * 8)] === -1 && len < 4) len++;
                osc(th.lead, hz(n), t, step * len * 0.95, th.lead === 'sawtooth' ? 0.06 : th.lead === 'square' ? 0.07 : 0.12, musicBus, { vib: len > 1 });
            }
            // drums
            const dr = th.drums;
            if (dr) {
                const kick = dr === 'driving' ? s % 2 === 0 : dr === 'march' ? s === 0 || s === 4 || s === 6 : dr === 'slow' ? s === 0 : s === 0 || s === 4;
                const snare = dr === 'slow' ? s === 4 : s === 2 || s === 6;
                if (kick) osc('sine', 120, t, 0.14, 0.32, musicBus, { to: 40 });
                if (snare) noise(t, 0.12, dr === 'soft' ? 0.06 : 0.12, musicBus, { freq: 1800 });
                if (dr !== 'slow') noise(t, 0.03, 0.035, musicBus, { freq: 8000 });
            }
            p.i++;
            p.next += step;
        }
    }

    function playMusic(id) {
        if (!id || id === 'none' || !THEMES[id]) { stopMusic(); return; }
        if (playing && playing.id === id) return;
        stopMusic();
        const c = ctx;
        if (!c) { wanted = id; return; }
        playing = { id, song: compose(id), i: 0, next: c.currentTime + 0.08 };
        timer = setInterval(schedule, 25);
        schedule();
    }

    function stopMusic() {
        wanted = null;
        if (timer) clearInterval(timer);
        timer = null;
        playing = null;
    }

    function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

    TW.audio = {
        THEMES, SFX_NAMES: Object.keys(SFX),
        unlock, configure, sfx, playMusic, stopMusic, suspend, resume,
        current: () => (playing ? playing.id : null),
        get ctx() { return ctx; },
    };
}]);
