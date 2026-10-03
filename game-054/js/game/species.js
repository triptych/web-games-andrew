/**
 * species.js — rolls a species for an archetype: a name, a palette, body
 * proportions, horns, eyes, spikes, tails, a voice and small stat changes.
 * Pure data (no three.js). The model builder (models.js) reads the genome.
 *
 * Species are rolled once per run per archetype (seeded), so a Cinderling in
 * this run looks, sounds and is named the same on every level, but the next
 * run's Cinderlings are a different breed.
 */
import { makeRng, subSeed } from '../rng.js';
import { ARCHETYPES } from './bestiary.js';

const SYL = {
    a: ['Gor', 'Vex', 'Mal', 'Skrae', 'Ul', 'Thra', 'Bael', 'Orr', 'Kzar', 'Nyx', 'Zul', 'Hag', 'Drek', 'Mor', 'Qeth', 'Sab', 'Ix', 'Rha', 'Vol', 'Grim', 'Cael', 'Ash', 'Yth', 'Bor'],
    b: ['a', 'o', 'u', 'ae', 'i', 'ul', 'ek', 'ar', 'ith', 'o', ''],
    c: ['gath', 'ling', 'rak', 'mire', 'thul', 'vex', 'goth', 'nax', 'zor', 'eth', 'spawn', 'maw', 'gul', 'rith', 'dax', 'shade', 'gor', 'mon', 'kith', 'brul'],
};

const PAL = {
    husk:      { skin: [[0.55, 0.6, 0.5], [0.5, 0.48, 0.45], [0.6, 0.55, 0.62]], cloth: [[0.25, 0.3, 0.2], [0.18, 0.22, 0.3], [0.3, 0.3, 0.32], [0.35, 0.22, 0.15]], eye: [0xff2a10, 0xffa020, 0x55ff44] },
    imp:       { skin: [[0.45, 0.25, 0.14], [0.55, 0.18, 0.1], [0.35, 0.3, 0.25], [0.5, 0.35, 0.15], [0.25, 0.22, 0.35]], cloth: [[0.85, 0.78, 0.6]], eye: [0xffa020, 0xffee30, 0xff3010] },
    hound:     { skin: [[0.75, 0.35, 0.4], [0.55, 0.2, 0.3], [0.6, 0.35, 0.25], [0.45, 0.3, 0.5]], cloth: [[0.9, 0.85, 0.7]], eye: [0xffee30, 0xff3010, 0x30ff60] },
    wisp:      { skin: [[0.85, 0.8, 0.68], [0.7, 0.68, 0.62]], cloth: [[0.3, 0.3, 0.3]], eye: [0xff8a20, 0x40a0ff, 0x60ff40, 0xff40a0] },
    gazer:     { skin: [[0.65, 0.12, 0.12], [0.3, 0.12, 0.45], [0.2, 0.45, 0.25], [0.15, 0.3, 0.55], [0.6, 0.45, 0.15]], cloth: [[0.9, 0.88, 0.75]], eye: [0x30ff60, 0xffee30, 0x40c0ff, 0xff40ff] },
    skitter:   { skin: [[0.25, 0.2, 0.15], [0.12, 0.18, 0.2], [0.3, 0.12, 0.1], [0.2, 0.25, 0.12]], cloth: [[0.45, 0.48, 0.52]], eye: [0x60ff30, 0x30d0ff, 0xff5020] },
    brute:     { skin: [[0.65, 0.52, 0.38], [0.35, 0.45, 0.28], [0.55, 0.25, 0.2], [0.4, 0.3, 0.45]], cloth: [[0.85, 0.8, 0.65]], eye: [0x40ff40, 0xffaa20, 0xff3030] },
    revenant:  { skin: [[0.88, 0.85, 0.75], [0.75, 0.72, 0.65]], cloth: [[0.2, 0.18, 0.18], [0.3, 0.15, 0.12], [0.15, 0.2, 0.25]], eye: [0xff3010, 0x30ffcc, 0xffee50] },
    hierophant:{ skin: [[0.85, 0.75, 0.55], [0.75, 0.7, 0.75]], cloth: [[0.45, 0.06, 0.08], [0.15, 0.08, 0.25], [0.12, 0.12, 0.12]], eye: [0xffd040, 0xff6020, 0xc070ff] },
    juggernaut:{ skin: [[0.5, 0.18, 0.15], [0.35, 0.3, 0.28]], cloth: [[0.35, 0.36, 0.4]], eye: [0xff2a10, 0xffaa20] },
    overseer:  { skin: [[0.4, 0.42, 0.45]], cloth: [[0.85, 0.65, 0.1]], eye: [0xff3010] },
    mother:    { skin: [[0.45, 0.2, 0.1]], cloth: [[0.95, 0.5, 0.1]], eye: [0xffaa20] },
    archon:    { skin: [[0.92, 0.9, 0.86]], cloth: [[0.95, 0.75, 0.3]], eye: [0xa070ff] },
    pylon:     { skin: [[0.2, 0.15, 0.3]], cloth: [[0.9, 0.85, 1.0]], eye: [0xb080ff] },
};

const FIXED_NAMES = { overseer: 'Overseer Kell', mother: 'The Furnace Mother', archon: 'The Archon', pylon: 'Engine Pylon' };

function jitter(rng, c, amt = 0.08) {
    return c.map((v) => Math.max(0, Math.min(1, v + (rng() * 2 - 1) * amt)));
}

export function makeName(rng) {
    const n = rng.pick(SYL.a) + rng.pick(SYL.b) + rng.pick(SYL.c);
    return n.charAt(0) + n.slice(1).toLowerCase();
}

export function generateSpecies(arch, seed) {
    const A = ARCHETYPES[arch];
    const rng = makeRng(subSeed(seed, 'species', arch));
    const P = PAL[arch] ?? PAL.imp;
    const skin = jitter(rng, rng.pick(P.skin));
    const cloth = jitter(rng, rng.pick(P.cloth), 0.06);
    const belly = skin.map((v) => Math.min(1, v * 1.25 + 0.08));
    const bone = jitter(rng, [0.85, 0.8, 0.66], 0.06);
    const metal = jitter(rng, [0.38, 0.4, 0.44], 0.04);
    const eye = rng.pick(P.eye);
    const big = A.height > 2.3 || A.boss;
    const g = {
        arch, plan: A.plan, cls: A.cls,
        name: FIXED_NAMES[arch] ?? makeName(rng),
        seed: rng() * 100,
        colors: { skin, belly, cloth, bone, metal, eye },
        scale: A.boss ? 1 : 0.92 + rng() * 0.16,
        hunch: rng.range(0.1, 0.45),
        torsoW: rng.range(0.85, 1.2),
        headSize: rng.range(0.85, 1.25),
        armLen: rng.range(0.85, 1.25),
        legLen: rng.range(0.85, 1.15),
        horns: rng.int(0, 4),
        hornLen: rng.range(0.6, 1.4),
        hornCurl: rng.range(-0.6, 0.9),
        eyes: arch === 'gazer' ? rng.pick([1, 1, 1, 3, 5]) : rng.pick([2, 2, 2, 3, 4]),
        spikes: rng.int(0, 6),
        tail: rng.chance(0.6),
        tusks: rng.chance(0.4),
        plates: rng.chance(0.5),
        tentacles: rng.int(3, 7),
        legs: arch === 'skitter' ? rng.pick([6, 8]) : 4,
        lump: rng.range(0.04, 0.14),
        voice: {
            pitch: (big ? 55 : 95) * rng.range(0.75, 1.35) * (arch === 'wisp' ? 3 : arch === 'imp' ? 1.4 : 1),
            f1: rng.range(350, 900), f2: rng.range(900, 2200),
            rough: rng.range(0.2, 0.8), vib: rng.chance(0.4) ? rng.range(4, 9) : 0,
            len: rng.range(0.7, 1.3), bendUp: rng.chance(0.4), big,
        },
        hpMul: A.boss ? 1 : rng.range(0.9, 1.12),
        speedMul: A.boss ? 1 : rng.range(0.9, 1.15),
    };
    return g;
}

/** All species for one run. */
export function rollRoster(seed) {
    const out = {};
    for (const arch of Object.keys(ARCHETYPES)) out[arch] = generateSpecies(arch, seed);
    return out;
}
