// The composer. Pure and seeded: one battle's seed always writes the same song, so a fight replays exactly, the audio can
// play it ahead of time and the bot can be tested against it.
//
// A song is a key, a mode, a tempo and a four-chord loop. It is played in phrases of PHRASE_BARS bars. In a PLAY phrase each
// princess's lane is one layer of the arrangement: Lyra's drums, Seraphine's melody, Marigold's sung words and Ingrid's long
// harmony notes. In a GUARD phrase the enemy plays a riff across the same lanes and the band blocks it. Each phrase is written
// from its own hash of (song seed, phrase index), never from the game's RNG, so the notes don't shift with anything else.

import { makeRng, hash3 } from '../rng.js';
import { BEATS_PER_BAR, PHRASE_BARS } from '../config.js';

export const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixo: [0, 2, 4, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harm: [0, 2, 3, 5, 7, 8, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
};
const BRIGHT = new Set(['major', 'mixo', 'lydian']);
/** Four-chord loops as scale degrees (0 = the tonic). */
const PROGS = {
    bright: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [5, 3, 0, 4], [0, 3, 5, 4], [3, 4, 0, 0]],
    dark: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 3, 4], [0, 1, 0, 6], [5, 6, 0, 0]],
};

/** Sung lines. A trailing '-' joins a syllable to the next one in the same word. */
export const LYRICS = {
    hope: [
        'Rise up we sing as one', 'Hear the drum hear the heart', 'Break the dark call the dawn', 'Ev- ery heart is a drum',
        'No more si- lence here', 'Hold the light hold the line', 'We will sing you a- wake', 'Sing a- gain sing a- gain',
        'Fol- low the beat home', 'Light the lamps one by one', 'All the stars sing a- long', 'Let the sun- rise ring',
    ],
    sea: ['Tide come in tide go out', 'Sing to me o- ver the waves', 'Shells re- mem- ber the song', 'Deep and blue and true'],
    sun: ['Turn the mills turn the tide', 'Sun- reach sings in the wind', 'Gold- en fields gold- en hearts', 'Wake the corn wake the crows'],
    frost: ['Cold is the night bright is the star', 'Hold the low note hold it long', 'Ice will break ice will break', 'Frost- hold stands, Frost- hold sings'],
    hush: ['Songs end so we sing them a- gain', 'You can not si- lence a heart', 'Ev- ery voice comes home', 'Shat- ter the hush'],
};
export const syllables = (line) => line.split(/\s+/).filter(Boolean);

export const midiOf = (song, deg, oct = 0) => {
    const s = SCALES[song.scale];
    const o = Math.floor(deg / 7);
    return song.root + 12 * (oct + o) + s[((deg % 7) + 7) % 7];
};

/** A song from a seed and a spec { bpm, scale, root?, lyrics? }. */
export function composeSong(seed, spec = {}) {
    const r = makeRng(seed ^ 0x51a7e);
    const scale = spec.scale || 'dorian';
    const progs = PROGS[BRIGHT.has(scale) ? 'bright' : 'dark'];
    const bpm = spec.bpm || 110;
    return {
        seed: seed >>> 0,
        bpm,
        spb: 60 / bpm,
        root: spec.root ?? 48 + r.int(0, 7),
        scale,
        prog: (spec.prog || r.pick(progs)).slice(),
        lyrics: spec.lyrics || 'hope',
        drums: r.int(0, 3),            // which groove family
        contour: r.int(0, 3),
    };
}

export const phraseBeats = () => PHRASE_BARS * BEATS_PER_BAR;
export const chordDeg = (song, bar) => song.prog[((bar % song.prog.length) + song.prog.length) % song.prog.length];
/** The chord's three scale degrees. */
export const chordDegs = (song, bar) => { const d = chordDeg(song, bar); return [d, d + 2, d + 4]; };

// ---------------------------------------------------------------- party layers
const DRUM = [
    // per groove family, the extra 8th-note hits by density (slots 0..7 of a bar): [slot, 'K'|'S'|'T']
    [[[3, 'K']], [[3, 'K'], [7, 'S']]],
    [[[5, 'K']], [[1, 'S'], [5, 'K']]],
    [[[7, 'K']], [[3, 'K'], [7, 'K']]],
    [[[3, 'S']], [[3, 'K'], [5, 'S']]],
];
const MEL = [
    [[0, 4], [0, 2, 4], [0, 4, 6]],
    [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 6], [0, 2, 4, 5]],
    [[0, 1, 2, 4, 6], [0, 2, 3, 4, 6], [0, 2, 4, 5, 6], [0, 2, 3, 4, 6, 7]],
];

/**
 * Notes for one phrase. opts: { side: 'play'|'guard'|'solo', k (phrase index, for the bar's chord), lanes: [bool × 4] that can
 * get notes, density 0..2, enemy (the def, for a guard), colossus }. Beats are relative to the phrase start.
 * Returns [{ beat, lane, kind: 'tap'|'hold'|'colossus', len (beats), pitch, syl, drum, side }].
 */
export function phraseNotes(song, k, opts) {
    const r = makeRng(Math.floor(hash3(song.seed, k, opts.side === 'guard' ? 7 : opts.side === 'solo' ? 13 : 3) * 4294967296));
    const out = [];
    const bar0 = k * PHRASE_BARS;
    const lanes = opts.lanes;
    const n = lanes.filter(Boolean).length;
    if (!n) return out;
    const dens = Math.max(0, Math.min(2, opts.density ?? 1));
    const half = 0.5;                                     // an 8th note in beats

    if (opts.side === 'guard') return guardNotes(song, k, opts, r);

    // with a full band each layer thins out a little, so four lanes stay playable
    const ld = (lane) => Math.max(0, dens - (n >= 3 && lane !== 0 ? 1 : 0) - (n >= 4 && lane === 0 ? 1 : 0));

    for (let b = 0; b < PHRASE_BARS; b++) {
        const bar = bar0 + b, base = b * BEATS_PER_BAR;
        const cd = chordDegs(song, bar);
        // ---- lane 0: Lyra's drums
        if (lanes[0]) {
            const d = opts.side === 'solo' ? Math.min(2, dens + 1) : (n === 1 ? Math.min(2, dens + 1) : ld(0));
            const hits = new Map([[0, 'K'], [2, 'S'], [4, 'K'], [6, 'S']]);
            const fam = DRUM[song.drums % DRUM.length];
            if (d >= 1) for (const [s, kd] of fam[d >= 2 ? 1 : 0]) if (r() < (d >= 2 ? 0.9 : 0.75)) hits.set(s, kd);
            // a tom fill closes the phrase
            if (b === PHRASE_BARS - 1 && d >= 1 && r() < 0.6) { hits.set(6, 'T'); hits.set(7, 'T'); }
            for (const [s, kd] of [...hits].sort((x, y) => x[0] - y[0])) out.push({ beat: base + s * half, lane: 0, kind: 'tap', len: 0, pitch: kd === 'T' ? 45 + (s - 6) * 5 : 0, drum: kd });
        }
    }
    // ---- lane 1: Seraphine's melody, fitted to the chords, a contour walk on the scale
    if (lanes[1]) {
        let deg = 7 + cdTone(chordDegs(song, bar0), r);
        for (let b = 0; b < PHRASE_BARS; b++) {
            const bar = bar0 + b, base = b * BEATS_PER_BAR, cd = chordDegs(song, bar);
            const rhythm = r.pick(MEL[ld(1)]);
            for (let i = 0; i < rhythm.length; i++) {
                const s = rhythm[i];
                const strong = s % 2 === 0;
                deg += r.pick([-2, -1, -1, 0, 1, 1, 2]) + (song.contour === 0 && b === 1 ? 1 : 0);
                if (deg < 5) deg += 2; if (deg > 15) deg -= 2;
                if (strong) deg = nearestChordDeg(deg, cd);
                const last = b === PHRASE_BARS - 1 && i === rhythm.length - 1;
                const hold = last && s <= 4 && r() < 0.5;
                out.push({ beat: base + s * half, lane: 1, kind: hold ? 'hold' : 'tap', len: hold ? (8 - s) * half : 0, pitch: midiOf(song, deg, 1) });
            }
        }
    }
    // ---- lane 2: Marigold's words, on the off-beats between the melody, the last syllable held
    if (lanes[2]) {
        const bank = LYRICS[song.lyrics] || LYRICS.hope;
        const pool = bank.concat(LYRICS.hope);
        const max = [5, 6, 8][ld(2)];
        const fits = pool.filter((l) => syllables(l).length <= max);
        const pick = (fits.length ? fits : pool);
        const syl = syllables(pick[Math.floor(hash3(song.seed, k, 99) * pick.length)]).slice(0, max);
        // off-beat slots first, then on-beats, across the phrase's 16 eighths, minus the last 3 for the held note's room
        const off = [1, 3, 5, 7, 9, 11, 13], on = [2, 4, 6, 8, 10, 12];
        const slots = off.slice(0, Math.min(off.length, syl.length));
        for (let i = 0; slots.length < syl.length && i < on.length; i++) slots.push(on[i]);
        slots.sort((a, b) => a - b);
        let deg = 9;
        syl.forEach((s, i) => {
            const slot = slots[i];
            const bar = bar0 + Math.floor(slot / 8);
            deg += r.pick([-1, 0, 1, 1, -2, 2]);
            if (deg < 5) deg = 6; if (deg > 13) deg = 12;
            if (slot % 2 === 1 && i === syl.length - 1) deg = nearestChordDeg(deg, chordDegs(song, bar));
            const last = i === syl.length - 1;
            const room = 16 - slot;
            const hold = last && room >= 2;
            out.push({ beat: slot * half, lane: 2, kind: hold ? 'hold' : 'tap', len: hold ? Math.min(3, room - 1) * half : 0, pitch: midiOf(song, deg, 1), syl: s });
        });
    }
    // ---- lane 3: Ingrid's harmony, long notes on the chord roots
    if (lanes[3]) {
        const d = ld(3);
        for (let b = 0; b < PHRASE_BARS; b++) {
            const bar = bar0 + b, base = b * BEATS_PER_BAR;
            const p = midiOf(song, chordDeg(song, bar), -1);
            if (d >= 2) {
                out.push({ beat: base, lane: 3, kind: 'hold', len: 1.5, pitch: p });
                out.push({ beat: base + 2, lane: 3, kind: 'hold', len: 1.5, pitch: midiOf(song, chordDeg(song, bar) + 2, -1) });
            } else {
                out.push({ beat: base, lane: 3, kind: 'hold', len: d >= 1 ? 3 : 3.5, pitch: p });
            }
        }
    }
    if (opts.colossus) {
        for (let b = 0; b < PHRASE_BARS; b++) out.push({ beat: b * BEATS_PER_BAR + 2, lane: -1, kind: 'colossus', len: 0, pitch: midiOf(song, chordDeg(song, bar0 + b), -1) });
    }
    out.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
    return out;
}

function cdTone(cd, r) { return cd[r.int(0, 2)]; }
function nearestChordDeg(deg, cd) {
    let best = deg, bd = 99;
    for (let o = -14; o <= 14; o += 7) for (const c of cd) { const d = Math.abs(c + o - deg); if (d < bd) { bd = d; best = c + o; } }
    return best;
}

// ---------------------------------------------------------------- the enemy's call
function guardNotes(song, k, opts, r) {
    const e = opts.enemy || { notes: 3 };
    const lanes = [];
    opts.lanes.forEach((on, i) => { if (on) lanes.push(i); });
    const out = [];
    const dm = [0.7, 1, 1.25][Math.max(0, Math.min(2, opts.density ?? 1))];
    const target = Math.max(2, Math.round(e.notes * PHRASE_BARS * dm * (0.85 + r() * 0.3)));
    // slot weights over 16 eighths: downbeats likely, off-beats less, the last eighth rarely
    const w = []; for (let s = 0; s < 16; s++) w.push(s % 4 === 0 ? 1 : s % 2 === 0 ? 0.75 : s === 15 ? 0.15 : 0.42);
    const chosen = new Set();
    let guard = 0;
    while (chosen.size < Math.min(target, 14) && guard++ < 400) {
        let tot = 0; for (let s = 0; s < 16; s++) if (!chosen.has(s)) tot += w[s];
        let x = r() * tot;
        for (let s = 0; s < 16; s++) { if (chosen.has(s)) continue; x -= w[s]; if (x <= 0) { chosen.add(s); break; } }
    }
    const slots = [...chosen].sort((a, b) => a - b);
    let li = r.int(0, lanes.length - 1);
    let deg = 4 + r.int(0, 4);
    const busyUntil = [-1, -1, -1, -1];
    for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        // a riff walks across the lanes: its pitch and its lane move together
        const step = r.pick([-1, 0, 1, 1, -1, 2, -2]);
        li = Math.max(0, Math.min(lanes.length - 1, li + Math.sign(step) * (Math.abs(step) > 1 && lanes.length > 2 ? 2 : 1) * (r() < 0.8 ? 1 : 0)));
        deg += step;
        let lane = lanes[li];
        if (busyUntil[lane] >= s) { const alt = lanes.find((l) => busyUntil[l] < s); if (alt === undefined) continue; lane = alt; }
        const next = slots[i + 1] ?? 16;
        const canHold = next - s >= 3 && s <= 12;
        const hold = canHold && e.holds && r() < e.holds;
        const len = hold ? Math.min(4, next - s - 1) * 0.5 : 0;
        out.push({ beat: s * 0.5, lane, kind: hold ? 'hold' : 'tap', len, pitch: midiOf(song, deg, 0), side: 'enemy' });
        busyUntil[lane] = s + (hold ? len * 2 : 0);
        if (e.doubles && lanes.length > 1 && !hold && r() < e.doubles) {
            const others = lanes.filter((l) => l !== lane && busyUntil[l] < s);
            if (others.length) { const l2 = r.pick(others); out.push({ beat: s * 0.5, lane: l2, kind: 'tap', len: 0, pitch: midiOf(song, deg + 2, 0), side: 'enemy' }); busyUntil[l2] = s; }
        }
    }
    return out;
}

/** Everything a phrase of field music plays: the party layers that are unlocked, never judged. */
export function fieldPhrase(song, k, lanes) {
    return phraseNotes(song, k, { side: 'play', lanes, density: 1 });
}
