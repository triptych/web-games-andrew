// VESTA-8 runtime: the sound chip. Eight effects per cart and one 32-step song with a lead, a bass
// and a drum channel. Pitches are MIDI note numbers (60 is middle C). The parameters are plain
// data; makeSynth() plays them through a Web Audio context the host hands over (none in Node).

export function sound(V) {
    V.WAVES = ['square', 'triangle', 'saw', 'sine', 'noise'];
    V.SFX_PRESETS = {
        blip: { wave: 'square', p0: 72, p1: 76, len: 60, vol: 0.5, vib: 0, arp: 0 },
        coin: { wave: 'square', p0: 83, p1: 95, len: 140, vol: 0.45, vib: 0, arp: 2 },
        jump: { wave: 'square', p0: 60, p1: 79, len: 150, vol: 0.4, vib: 0, arp: 0 },
        laser: { wave: 'saw', p0: 96, p1: 60, len: 160, vol: 0.35, vib: 0, arp: 0 },
        boom: { wave: 'noise', p0: 60, p1: 30, len: 420, vol: 0.6, vib: 0, arp: 0 },
        hurt: { wave: 'saw', p0: 55, p1: 40, len: 220, vol: 0.5, vib: 0.5, arp: 0 },
        power: { wave: 'triangle', p0: 60, p1: 84, len: 420, vol: 0.5, vib: 0, arp: 6 },
        lose: { wave: 'triangle', p0: 67, p1: 43, len: 700, vol: 0.5, vib: 0.3, arp: 4 },
        step: { wave: 'noise', p0: 90, p1: 80, len: 40, vol: 0.25, vib: 0, arp: 0 },
        select: { wave: 'sine', p0: 84, p1: 84, len: 90, vol: 0.4, vib: 0, arp: 0 },
        zap: { wave: 'square', p0: 100, p1: 48, len: 120, vol: 0.35, vib: 0.2, arp: 0 },
        win: { wave: 'square', p0: 72, p1: 96, len: 600, vol: 0.4, vib: 0, arp: 5 },
    };
    V.SFX_DEFAULTS = ['blip', 'coin', 'lose', 'jump', 'laser', 'boom', 'power', 'hurt'].map((k) => ({ ...V.SFX_PRESETS[k] }));

    const cl = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    V.normalizeSfx = (s) => ({
        wave: V.WAVES.includes(s && s.wave) ? s.wave : 'square',
        p0: cl(s && s.p0, 24, 108, 72) | 0,
        p1: cl(s && s.p1, 24, 108, 72) | 0,
        len: cl(s && s.len, 20, 1500, 120) | 0,
        vol: cl(s && s.vol, 0, 1, 0.5),
        vib: cl(s && s.vib, 0, 1, 0),
        arp: cl(s && s.arp, 0, 12, 0) | 0,
    });
    V.STEPS = 32;
    V.normalizeMusic = (m) => {
        const arr = (a, lo, hi, d) => {
            const out = [];
            for (let i = 0; i < V.STEPS; i++) {
                const v = a && a[i];
                out.push(typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v | 0)) : d);
            }
            return out;
        };
        return {
            on: !!(m && m.on),
            tempo: cl(m && m.tempo, 60, 240, 120) | 0,
            lead: arr(m && m.lead, -1, 96, -1),
            bass: arr(m && m.bass, -1, 72, -1),
            drums: arr(m && m.drums, 0, 3, 0),
            leadWave: ['square', 'triangle', 'saw', 'sine'].includes(m && m.leadWave) ? m.leadWave : 'square',
        };
    };
    V.midiHz = (p) => 440 * Math.pow(2, (p - 69) / 12);
    V.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    V.noteName = (p) => V.NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);

    /** A synth on an AudioContext. Returns no-op functions if there is none (tests, Node). */
    V.makeSynth = (ctx, dest) => {
        if (!ctx) return { sfx() {}, startMusic() {}, stopMusic() {}, tick() {}, playing: false, note() {} };
        const out = dest || ctx.destination;
        const master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(out);
        // noise from a little LCG: the runtime never calls Math.random
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        let seed = 22222;
        for (let i = 0; i < nd.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; nd[i] = (seed / 0x7fffffff) * 2 - 1; }

        function voice(wave, t, dur, f0, f1, vol, vib, arp, dst) {
            const g = ctx.createGain();
            g.connect(dst || master);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol, t + 0.005);
            g.gain.setValueAtTime(vol, t + Math.max(0.006, dur * 0.6));
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            let src;
            if (wave === 'noise') {
                src = ctx.createBufferSource();
                src.buffer = nb;
                src.loop = true;
                const bp = ctx.createBiquadFilter();
                bp.type = 'lowpass';
                bp.frequency.setValueAtTime(Math.min(16000, f0 * 8), t);
                bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1 * 8), t + dur);
                src.connect(bp);
                bp.connect(g);
            } else {
                src = ctx.createOscillator();
                src.type = wave === 'saw' ? 'sawtooth' : wave;
                if (arp > 0) {
                    for (let i = 0; i <= arp; i++) src.frequency.setValueAtTime(f0 * Math.pow(f1 / f0, i / arp), t + (dur * i) / (arp + 1));
                } else {
                    src.frequency.setValueAtTime(f0, t);
                    src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
                }
                if (vib > 0) {
                    const lfo = ctx.createOscillator(), lg = ctx.createGain();
                    lfo.frequency.value = 9;
                    lg.gain.value = f0 * 0.06 * vib;
                    lfo.connect(lg);
                    lg.connect(src.frequency);
                    lfo.start(t);
                    lfo.stop(t + dur + 0.05);
                }
                src.connect(g);
            }
            src.start(t);
            src.stop(t + dur + 0.05);
        }

        const S = {
            playing: false, music: null, step: 0, next: 0,
            sfx(def, when) {
                if (!def || ctx.state !== 'running') return;
                const s = V.normalizeSfx(def);
                voice(s.wave, when || ctx.currentTime, s.len / 1000, V.midiHz(s.p0), V.midiHz(s.p1), s.vol * 0.6, s.vib, s.arp);
            },
            note(p, wave, dur) {
                if (ctx.state !== 'running') return;
                voice(wave || 'square', ctx.currentTime, dur || 0.15, V.midiHz(p), V.midiHz(p), 0.25, 0, 0);
            },
            startMusic(m) {
                S.music = V.normalizeMusic(m);
                S.playing = true;
                S.step = 0;
                S.next = ctx.currentTime + 0.05;
            },
            stopMusic() { S.playing = false; },
            tick() {
                if (!S.playing || !S.music || ctx.state !== 'running') return;
                const m = S.music, dt = 60 / m.tempo / 4;
                if (S.next < ctx.currentTime - 0.5) S.next = ctx.currentTime + 0.02;   // after a pause, don't burst
                while (S.next < ctx.currentTime + 0.12) {
                    const i = S.step % V.STEPS, t = S.next;
                    const ld = m.lead[i];
                    if (ld >= 0) voice(m.leadWave, t, dt * 0.95, V.midiHz(ld), V.midiHz(ld), 0.16, 0.15, 0);
                    const bs = m.bass[i];
                    if (bs >= 0) voice('triangle', t, dt * 1.8, V.midiHz(bs), V.midiHz(bs), 0.3, 0, 0);
                    const d = m.drums[i];
                    if (d === 1) voice('sine', t, 0.14, 150, 45, 0.55, 0, 0);
                    else if (d === 2) voice('noise', t, 0.12, 400, 220, 0.3, 0, 0);
                    else if (d === 3) voice('noise', t, 0.04, 1600, 1500, 0.12, 0, 0);
                    S.step++;
                    S.next += dt;
                }
            },
        };
        return S;
    };
}
