// Gene blending and what a strain does to a zone. Pure arithmetic shared by the sim, the splicer preview and the bot.

import { SPECIES_BY_ID, ZONES } from './data.js';
import { GAIN_K, REPEAT_DECAY, METRIC_FLOOR } from '../config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

/** Samples needed to sequence a species (the Sequencing Primer takes one off). */
export function sampleNeed(G, id) { return Math.max(1, SPECIES_BY_ID[id].need - (G.research.done.b1 ? 1 : 0)); }
export function isSequenced(G, id) { return (G.samples[id] || 0) >= sampleNeed(G, id); }
export function sequenced(G) { return Object.keys(SPECIES_BY_ID).filter((id) => isSequenced(G, id)); }

/** The traits of blending a (weight r, 0..1) with b. Cross-kingdom pairs get on; research adds flat bonuses. */
export function blendTraits(G, a, b, r) {
    const A = SPECIES_BY_ID[a], B = SPECIES_BY_ID[b];
    const t = A.t.map((v, i) => v * r + B.t[i] * (1 - r));
    const d = G.research.done;
    if (A.kind !== B.kind) { const s = d.b3 ? 1.5 : 1; t[1] += s; t[2] += s; } else t[0] += 1;
    if (d.b8) t[0] += 1;
    if (d.b6) t[1] += 1;
    if (d.b5) t[2] += 1;
    if (d.b4) t[3] += 1;
    return t.map((v) => r1(clamp(v, 0, 12)));
}
export const pairKey = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** How well a trait profile fits a zone's niche, 0.15..1. */
export function fitOf(traits, zone) {
    const n = ZONES[zone].niche;
    let d = 0;
    for (let i = 0; i < 4; i++) d += Math.abs(traits[i] - n[i]);
    return clamp(1 - d / 20, 0.15, 1);
}

/** What releasing a strain on a zone would do right now: metric deltas (negative is better) and the factors. */
export function releaseEffect(G, strain, zone) {
    const Z = G.zones[zone];
    const fit = fitOf(strain.traits, zone);
    const uses = Z.uses[strain.key] || 0;
    const rel = Math.pow(fit, 1.5) * (0.6 + 0.05 * strain.traits[0]) * Math.pow(REPEAT_DECAY, uses);
    const [, F, D, C] = strain.traits;
    const room = (v) => Math.max(0, v - METRIC_FLOOR);
    return {
        fit, uses, rel,
        toxic: -Math.min(room(Z.toxic), GAIN_K * C * rel),
        hostile: -Math.min(room(Z.hostile), GAIN_K * D * rel),
        barren: -Math.min(room(Z.barren), GAIN_K * F * rel),
    };
}

/** A zone's terraform progress, 0..100. */
export const terraOf = (Z) => 100 - (Z.toxic + Z.hostile + Z.barren) / 3;
/** The Eden Index: a weighted mean over every zone. */
export function edenIndex(G) {
    let s = 0, w = 0;
    ZONES.forEach((z, i) => { s += terraOf(G.zones[i]) * z.weight; w += z.weight; });
    return s / w;
}

/** A strain's name from its parents and mix, so the same recipe always reads the same. */
export function strainName(a, b, r) {
    const A = SPECIES_BY_ID[a].name, B = SPECIES_BY_ID[b].name;
    const head = r >= 0.5 ? A : B, tail = r >= 0.5 ? B : A;
    return `${head.slice(0, Math.ceil(head.length / 2 + 1))}${tail.slice(Math.floor(tail.length / 2)).toLowerCase()}`;
}
