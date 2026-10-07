/**
 * levels.js — the twelve levels, Open Road, and the seeded wave generator.
 *
 * A level is settings, not a script: its difficulty, which ailments and which dead it has
 * introduced, how many waves, which stations are open. `makeWave()` turns that into a timed list
 * of spawns with an RNG seeded from the level and the wave, so a level plays the same every time
 * and the balance bot in dev/simtest.mjs can play it.
 */

import { RNG, hashStr } from '../rng.js';
import { STATIONS } from './data.js';

const ACT = { 1: 'autumn', 2: 'winter', 3: 'city' };

export const LEVELS = [
    {
        n: 1, name: 'The First Morning', act: 1, waves: 5, diff: 0.75, ailments: ['wound'], dead: ['shambler'],
        supplies: 130, hope: 10,
        brief: 'People are coming down the lane from the woods. Most of them are hurt. Set up a Medic Tent beside the road, and a Lantern to slow the dead behind them.',
        hints: true,
    },
    {
        n: 2, name: 'Orchard Lane', act: 1, waves: 6, diff: 0.9, ailments: ['wound', 'sick'], dead: ['shambler', 'spitter'],
        supplies: 150, hope: 10,
        brief: 'The blight has reached the orchards. It spreads in the blood and turns a fever into something worse. The Remedy Lab can clear it.',
    },
    {
        n: 3, name: 'Market Square', act: 1, waves: 7, diff: 1.0, branch: true, ailments: ['wound', 'sick', 'hunger'], dead: ['shambler', 'spitter'],
        supplies: 170, hope: 12,
        brief: 'Two roads meet at the old market. People here haven\'t eaten in days. A Field Kitchen fills them up and gives them some strength to spare.',
    },
    {
        n: 4, name: 'The Hollow Giant', act: 1, boss: 'giant', waves: 4, diff: 1.0, ailments: ['wound', 'sick', 'hunger'], dead: ['shambler', 'spitter'],
        supplies: 240, hope: 20, slots: 6,
        brief: 'Something huge is walking toward the Haven, and the dead walk with it. This time the people you saved walk out to meet it. Place volunteers beside the road. They carry the cure, and your stations keep them on their feet.',
    },
    {
        n: 5, name: 'Snow on the Bridge', act: 2, waves: 6, diff: 1.05, ailments: ['wound', 'sick', 'hunger', 'cold'], dead: ['shambler', 'spitter', 'runner'],
        supplies: 230, hope: 12,
        brief: 'Winter in Frostford. The cold gets into everyone who walks too long without a fire. And some of the dead here can run.',
    },
    {
        n: 6, name: 'The Frozen Mill', act: 2, waves: 7, diff: 1.12, ailments: ['wound', 'sick', 'hunger', 'cold', 'fracture'], dead: ['shambler', 'spitter', 'runner', 'brute'],
        supplies: 250, hope: 12,
        brief: 'Ice on the mill road, and a lot of broken bones. Splint them, or the dead will catch them. Watch for the brutes.',
    },
    {
        n: 7, name: 'Candles in the Chapel', act: 2, waves: 7, diff: 1.18, branch: true, dusk: true, ailments: ['wound', 'sick', 'hunger', 'cold', 'fracture', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
        supplies: 270, hope: 12,
        brief: 'Dusk at the chapel, and the howlers have come. Fear can freeze a person on the spot. The Song Circle helps them find their feet, and their courage.',
    },
    {
        n: 8, name: 'The Winter Wailer', act: 2, boss: 'wailer', waves: 4, diff: 1.15, ailments: ['wound', 'sick', 'hunger', 'cold', 'fear'], dead: ['shambler', 'runner', 'brute', 'howler'],
        supplies: 300, hope: 20, slots: 8,
        brief: 'Its wail freezes the blood and empties the heart. Keep your volunteers warm and keep them brave.',
    },
    {
        n: 9, name: 'Rain on Ash Street', act: 3, waves: 7, diff: 1.2, ailments: ['wound', 'sick', 'hunger', 'fracture', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
        supplies: 300, hope: 14,
        brief: 'Lantern City, at night, in the rain. The Signal Bell rings out over the rooftops, and the dead wander off toward it.',
    },
    {
        n: 10, name: 'The Long Bridge', act: 3, waves: 8, diff: 1.2, branch: true, ailments: ['wound', 'sick', 'hunger', 'fracture', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
        supplies: 320, hope: 14,
        brief: 'Two crowds, two roads, one bridge to the Haven. Everyone is tired. Everyone is so close.',
    },
    {
        n: 11, name: 'Last Train Yard', act: 3, waves: 9, diff: 1.22, branch: true, ailments: ['wound', 'sick', 'hunger', 'fracture', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
        supplies: 340, hope: 14,
        brief: 'The last trains left weeks ago. The people didn\'t. Bring them home.',
    },
    {
        n: 12, name: 'The Blight Heart', act: 3, boss: 'heart', waves: 5, diff: 1.3, ailments: ['wound', 'sick', 'hunger', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
        supplies: 360, hope: 20, slots: 10,
        brief: 'The heart of the blight is coming for the Haven. Everyone you ever saved is standing at the gate. Cure it, and the blight breaks everywhere.',
    },
];

export const ENDLESS = {
    n: 13, name: 'Open Road', act: 0, endless: true, waves: Infinity, diff: 1.0, branch: true,
    ailments: ['wound', 'sick', 'hunger', 'cold', 'fracture', 'fear'], dead: ['shambler', 'spitter', 'runner', 'brute', 'howler'],
    supplies: 260, hope: 15,
    brief: 'A new road every time, and no end to it. How many can you bring home?',
};

export function levelDef(n) { return n === ENDLESS.n ? ENDLESS : LEVELS[n - 1]; }

export function themeOf(level, seed = 0) {
    if (level.endless) return ['autumn', 'winter', 'city'][seed % 3];
    return ACT[level.act];
}

/** Stations open on a level: everything that unlocked at or before it. */
export function stationsFor(level) {
    const n = level.endless ? 99 : level.n;
    return Object.keys(STATIONS).filter((k) => STATIONS[k].unlock <= n);
}

/** Stations that unlock exactly at this level (for the briefing's "new" cards). */
export function newStations(level) {
    if (level.endless) return [];
    return Object.keys(STATIONS).filter((k) => STATIONS[k].unlock === level.n);
}

export function mapSeed(level, runSeed = 0) {
    return level.endless ? hashStr(`open-road-${runSeed}`) : hashStr(`haven-road-${level.n}`);
}

// Weights for the dead: the newest kind on a level is the rarest.
function deadPicker(rng, level, w) {
    // The first wave meets the old kinds; harder kinds join one wave at a time.
    const kinds = level.boss || level.endless ? level.dead : level.dead.slice(0, Math.min(level.dead.length, w + 1));
    const newest = level.dead[level.dead.length - 1];
    if (!level.boss && w >= 2 && !kinds.includes(newest)) kinds.push(newest);
    const wt = kinds.map((k, i) => (k === 'brute' ? 0.5 : 1) * (i === kinds.length - 1 && kinds.length > 1 ? 0.6 : 1) * (k === 'shambler' ? 2 : 1));
    const tot = wt.reduce((a, b) => a + b, 0);
    return () => { let r = rng.next() * tot; for (let i = 0; i < kinds.length; i++) { r -= wt[i]; if (r <= 0) return kinds[i]; } return kinds[0]; };
}

/**
 * The spawns of wave `w` (1-based) on `level`: [{ t, what: 'civ'|'dead'|'boss', ... }], sorted by t.
 * `branch` says whether the map has a second road.
 */
export function makeWave(level, w, branch, runSeed = 0) {
    const rng = new RNG(hashStr(`wave-${level.n}-${w}-${runSeed}`));
    const out = [];
    const has = (a) => level.ailments.includes(a);
    const d = level.endless ? 0.8 + w * 0.09 : level.diff * (1 + 0.1 * (w - 1));
    const pickDead = deadPicker(rng, level, w);

    if (level.boss) {
        const last = w === level.waves;
        const n = Math.round((5 + w * 3.5) * d);
        let t = 2;
        for (let i = 0; i < n; i++) {
            out.push({ t, what: 'dead', kind: pickDead(), route: branch && rng.chance(0.4) ? 1 : 0, lane: rng.range(-0.2, 0.2) });
            t += rng.range(1.2, 2.4) / Math.sqrt(d);
        }
        if (last) out.push({ t: t + 4, what: 'boss', kind: level.boss, route: 0, lane: 0 });
        return out.sort((a, b) => a.t - b.t);
    }

    // People first. A family walks close together.
    const nCiv = Math.round(4 + w * 1.25 + d * 2);
    let t = 0.5;
    let i = 0;
    while (i < nCiv) {
        const family = rng.chance(0.25) && nCiv - i >= 2;
        const size = family ? rng.int(2, 3) : 1;
        const route = branch && rng.chance(0.35) ? 1 : 0;
        const fam = family ? `f${w}-${i}` : null;
        for (let k = 0; k < size && i < nCiv; k++, i++) {
            let kind = 'adult';
            if (family && k > 0) kind = rng.chance(0.6) ? 'child' : 'elder';
            else if (!family) {
                const r = rng.next();
                kind = r < 0.14 ? 'elder' : r < 0.24 && level.n >= 2 ? 'carrier' : 'adult';
            }
            out.push({ t, what: 'civ', kind, route, lane: rng.range(-0.22, 0.22), family: fam, ail: rollAilments(rng, has, d, level, kind) });
            t += family ? rng.range(0.45, 0.7) : 0;
        }
        t += rng.range(1.4, 2.4) / Math.min(1.5, Math.sqrt(d));
    }
    const civEnd = t;

    // The dead follow, starting a few seconds behind the first people and spreading over the wave.
    const nDead = Math.max(1, Math.round((1 + w * 0.85) * d * (level.endless ? 1.1 : 1)));
    const start = 4 + rng.range(0, 2);
    const span = Math.max(4, civEnd + 3 - start);
    for (let k = 0; k < nDead; k++) {
        const tt = start + (span * (k + rng.range(0, 0.8))) / nDead;
        out.push({ t: tt, what: 'dead', kind: pickDead(), route: branch && rng.chance(0.5) ? 1 : 0, lane: rng.range(-0.2, 0.2) });
    }
    return out.sort((a, b) => a.t - b.t);
}

function rollAilments(rng, has, d, level, kind) {
    const a = {};
    const k = Math.min(1.6, d);
    if (has('wound') && rng.chance(0.62)) a.wound = rng.chance(0.25 * k) ? 2 : 1;
    if (has('sick') && rng.chance(0.38 * k)) a.sick = Math.round(rng.range(15, 45));
    if (has('hunger') && rng.chance(0.32 * k)) a.hunger = true;
    if (has('cold')) a.cold = Math.round(rng.range(15, 50));
    if (has('fracture') && kind !== 'child' && rng.chance(0.2 * k)) a.fracture = true;
    if (has('fear') && rng.chance(0.3 * k)) a.fear = Math.round(rng.range(40, 70));
    // No more than two troubles each (three deep into Open Road), so care can keep up.
    const cap = level.endless && d > 2 ? 3 : 2;
    const keys = Object.keys(a).filter((x) => x !== 'cold');
    while (keys.length > cap) delete a[keys.splice(rng.int(0, keys.length - 1), 1)[0]];
    // Everyone on this road is hurt somehow.
    if (!Object.keys(a).length) {
        const opts = level.ailments.filter((x) => x !== 'cold');
        const pick = rng.pick(opts);
        if (pick === 'wound') a.wound = 1;
        else if (pick === 'sick') a.sick = 25;
        else if (pick === 'hunger') a.hunger = true;
        else if (pick === 'fracture' && kind !== 'child') a.fracture = true;
        else if (pick === 'fear') a.fear = 55;
        else a.wound = 1;
    }
    return a;
}
