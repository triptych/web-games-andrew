// ============================================================
// Monster species per region, generated from the seed.
// ============================================================

import { rngFor } from '../core/rng.js';
import { ARCHETYPES, BIOMES, baseStats, BOSS_TITLES, ELEM_HUE } from '../data/monsters.js';

const ELEM_WORD = {
    leaf: ['Moss', 'Bramble', 'Fern', 'Thorn', 'Sprig', 'Bark'],
    storm: ['Gale', 'Thunder', 'Static', 'Zephyr', 'Squall', 'Spark'],
    frost: ['Frost', 'Rime', 'Brook', 'Mist', 'Chill', 'Dew'],
    ember: ['Cinder', 'Ember', 'Ash', 'Magma', 'Scorch', 'Soot'],
    shadow: ['Gloom', 'Dusk', 'Hollow', 'Umbra', 'Night', 'Grim'],
};
const BOSS_NAMES = ['Rootmaw', 'Gorse', 'Thundermane', 'Mirewing', 'Cindergut', 'Vesper', 'Old Knuckle', 'Grimbark', 'Hailfang', 'Moldra', 'Pyrrhos', 'Nocturne'];

export function generateSpecies(seed) {
    const out = {};
    const byRegion = {};
    BIOMES.forEach((b, k) => {
        const R = k + 1;
        const rng = rngFor(seed, 'species', R);
        const arch = rng.shuffle(b.arche.slice()).slice(0, 4);
        byRegion[R] = [];
        const usedWords = new Set();
        arch.forEach((a, j) => {
            const A = ARCHETYPES[a];
            let word;
            do { word = rng.pick(ELEM_WORD[b.elem]); } while (usedWords.has(word) && usedWords.size < ELEM_WORD[b.elem].length);
            usedWords.add(word);
            const sp = {
                id: `r${R}s${j}`, name: `${word} ${rng.pick(A.noun)}`, arche: a, elem: b.elem, tier: R,
                hue: (ELEM_HUE[b.elem] + rng.range(-40, 40) + 360) % 360 | 0, hue2: (rng.range(0, 360)) | 0, sprite: rng.int(1, 1e9),
                drop: A.drop, ai: A.ai, boss: false,
                // a little per-species variety on top of the archetype
                mul: { hp: A.hp * rng.range(0.9, 1.1), atk: A.atk * rng.range(0.9, 1.1), def: A.def * rng.range(0.9, 1.1), spd: A.spd * rng.range(0.9, 1.1) },
                night: j === 3,     // the fourth species only comes out at night (overworld)
            };
            out[sp.id] = sp; byRegion[R].push(sp.id);
        });
        const bArch = rng.pick(['golem', 'beast', 'plant', 'serpent', 'spirit', 'slime']);
        const A = ARCHETYPES[bArch];
        const boss = {
            id: `r${R}boss`, name: `${BOSS_NAMES[(rng.int(0, BOSS_NAMES.length - 1) + R * 2) % BOSS_NAMES.length]} ${rng.pick(BOSS_TITLES)}`,
            arche: bArch, elem: b.elem, tier: R, hue: (ELEM_HUE[b.elem] + rng.int(-25, 25) + 360) % 360, hue2: rng.int(0, 359), sprite: rng.int(1, 1e9),
            drop: A.drop, ai: 'boss', boss: true,
            mul: { hp: 3.0, atk: 1.25, def: 1.2, spd: 1.0 },
        };
        out[boss.id] = boss;
    });
    return { species: out, byRegion };
}

/** A fighting instance of a species. `depth` adds floors of difficulty. */
export function makeMonster(sp, depth = 0, uid = 0) {
    const b = baseStats(sp.tier, depth);
    const m = sp.mul;
    const hp = Math.round(b.hp * m.hp);
    return {
        uid, species: sp.id, name: sp.name, elem: sp.elem, ai: sp.ai, boss: sp.boss, arche: sp.arche,
        hp, maxHp: hp, atk: Math.round(b.atk * m.atk), def: Math.round(b.def * m.def), spd: Math.round(b.spd * m.spd),
        xp: Math.round(b.xp * (sp.boss ? 6 : 1)), gold: Math.round(b.gold * (sp.boss ? 8 : 1)), drop: sp.drop,
        status: {}, intent: null, turn: 0,
    };
}
