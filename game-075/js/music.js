// The soundtrack as data. Each song is a key, a tempo, a chord progression and
// a seed; everything else (the bass line, the arpeggio, the drum pattern and
// the lead melody) is generated from those when the song is first played.
//
// The melody generator writes one-bar rhythms, then fits pitches bar by bar
// to the chord underneath: chord tones on strong steps, scale steps between
// them, a contour that leans back toward the middle of the range. Phrases are
// arranged A A' B A over eight bars, and the last note of the cycle lands on
// the root, so every loop sounds finished.

import { makeRng } from './rng.js';

export const SONGS = {
    title:  { name: 'CHROME HORIZON', bpm: 92,  root: 57, scale: 'minor', prog: ['i', 'VI', 'III', 'VII'], drums: 'half',   bass: 'octave', arp: 'up',     seed: 11 },
    r1:     { name: 'SUNSET GATE',    bpm: 108, root: 60, scale: 'major', prog: ['I', 'vi', 'IV', 'V'],     drums: 'four',   bass: 'octave', arp: 'updown', seed: 21 },
    r2:     { name: 'GRIDLOCK',       bpm: 116, root: 52, scale: 'minor', prog: ['i', 'VI', 'III', 'VII'],  drums: 'drive',  bass: 'pulse',  arp: 'up16',   seed: 33 },
    r3:     { name: 'STATIC',         bpm: 96,  root: 50, scale: 'minor', prog: ['i', 'VI', 'iv', 'V'],     drums: 'sparse', bass: 'slow',   arp: 'down',   seed: 47 },
    r4:     { name: 'CHROME RIVERS',  bpm: 120, root: 54, scale: 'minor', prog: ['i', 'iv', 'VI', 'V'],     drums: 'drive',  bass: 'octave', arp: 'updown', seed: 52 },
    r5:     { name: 'VAPOR VAULT',    bpm: 100, root: 58, scale: 'major', prog: ['Imaj7', 'vi7', 'IVmaj7', 'V7'], drums: 'half', bass: 'walk', arp: 'stab', seed: 64 },
    r6:     { name: 'CITADEL',        bpm: 126, root: 48, scale: 'minor', prog: ['i', 'VI', 'III', 'VII'],  drums: 'drive',  bass: 'pulse',  arp: 'up16',   seed: 71 },
    boss:   { name: 'CHROMAGON',      bpm: 140, root: 53, scale: 'minor', prog: ['i', 'VI', 'VII', 'V'],    drums: 'boss',   bass: 'pulse',  arp: 'up16',   seed: 83 },
    entry:  { name: 'HALL OF FAME',   bpm: 112, root: 55, scale: 'major', prog: ['I', 'vi', 'IV', 'V'],     drums: 'four',   bass: 'octave', arp: 'updown', seed: 91 },
    ending: { name: 'DAWN DRIVE',     bpm: 104, root: 57, scale: 'major', prog: ['I', 'V', 'vi', 'IV'],     drums: 'four',   bass: 'octave', arp: 'up',     seed: 99 },
};

/** Sound Test order, and which cassette unlocks which track. */
export const JUKEBOX = ['title', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'boss', 'entry', 'ending'];

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const ROMAN = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

/** A chord symbol in the song's key → semitone offsets from the key root. */
export function chord(sym, scaleName) {
    const scale = SCALES[scaleName];
    const m = /^([ivIV]+)(maj7|7)?$/.exec(sym);
    const deg = ROMAN[m[1].toLowerCase()];
    const major = m[1] === m[1].toUpperCase();
    const r = scale[deg];
    const notes = [r, r + (major ? 4 : 3), r + 7];
    if (m[2] === 'maj7') notes.push(r + 11);
    else if (m[2] === '7') notes.push(r + (major && deg === 4 ? 10 : major ? 11 : 10));
    return notes;
}

const DRUMS = {
    //          kick                snare               hat
    four:   ['x...x...x...x...', '....x.......x...', '..x...x...x...x.'],
    half:   ['x.........x.....', '........x.......', 'x.x.x.x.x.x.x.x.'],
    drive:  ['x...x...x...x...', '....x.......x...', 'xxxxxxxxxxxxxxxx'],
    sparse: ['x.......x.......', '........x.......', '....x.......x...'],
    boss:   ['x..x..x.x..x..x.', '....x.......x..x', 'xxxxxxxxxxxxxxxx'],
};

/** Build everything a song needs to play: per-bar chords and a lead line. */
export function compose(id) {
    const s = SONGS[id];
    if (s.built) return s;
    const rng = makeRng(s.seed * 7919);
    const scale = SCALES[s.scale];
    s.spb = 60 / s.bpm;
    s.step = s.spb / 4;
    s.chords = s.prog.map((c) => chord(c, s.scale));
    s.drum = DRUMS[s.drums].map((p) => [...p].map((c) => c === 'x'));
    // the lead: two rhythms, fitted to each bar's chord
    const rhythm = () => {
        const on = [];
        const w = [0.95, 0.15, 0.55, 0.25, 0.8, 0.15, 0.5, 0.3, 0.85, 0.15, 0.55, 0.25, 0.7, 0.2, 0.45, 0.2];
        for (let i = 0; i < 16; i++) if (rng() < w[i] * 0.78) on.push(i);
        if (!on.includes(0)) on.unshift(0);
        return on;
    };
    const rA = rhythm(), rB = rhythm();
    const scaleNotes = [];
    for (let o = 0; o < 3; o++) for (const n of scale) scaleNotes.push(s.root + 12 + o * 12 + n);
    const lo = s.root + 12, hi = s.root + 31;
    let prev = s.root + 19;
    const line = [];   // 8 bars × 16 steps: midi or null; plus a duration in steps
    const contourA = rA.map(() => (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)));
    const contourB = rB.map(() => (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3)));
    for (let bar = 0; bar < 8; bar++) {
        const section = bar < 2 ? 'A' : bar < 4 ? 'A2' : bar < 6 ? 'B' : 'A';
        const rh = section === 'B' ? rB : rA;
        const ct = section === 'B' ? contourB : contourA;
        const ch = s.chords[bar % s.chords.length].map((n) => n + s.root);
        const notes = new Array(16).fill(null);
        rh.forEach((st, i) => {
            const strong = st % 4 === 0;
            let target = prev + ct[i] * 2;
            if (target > hi - 3) target -= 7; if (target < lo + 3) target += 7;
            let best = null, bd = 99;
            const pool = strong ? scaleNotes.filter((n) => ch.some((c) => (n - c) % 12 === 0)) : scaleNotes;
            for (const n of pool) { const d = Math.abs(n - target) + (n === prev && !strong ? 1.5 : 0); if (d < bd) { bd = d; best = n; } }
            if (section === 'A2' && bar === 3 && i >= rh.length - 2) best = pool.reduce((a, n) => (Math.abs(n - (prev + 2)) < Math.abs(a - (prev + 2)) ? n : a), best);
            if (bar === 7 && i === rh.length - 1) best = scaleNotes.reduce((a, n) => ((n - s.root) % 12 === 0 && Math.abs(n - prev) < Math.abs(a - prev) ? n : a), scaleNotes[0]);
            const next = rh[i + 1] ?? 16;
            notes[st] = { midi: best, len: Math.max(1, Math.min(4, next - st)) };
            prev = best;
        });
        line.push(notes);
    }
    s.lead = line;
    s.built = true;
    return s;
}

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
