/**
 * enemies.js — the Determinant's units. Archetype × affixes × difficulty.
 *
 * Difficulty is one continuous number `x` (chapter + depth + 5 × threat) so the
 * campaign, the Sim Ladder and Threat levels share one curve.
 */

export const hpScale = (x) => Math.pow(1.88, x) * (1 + 0.04 * x);
export const dmgScale = (x) => Math.pow(1.45, x);
export const rewardScale = (x) => Math.pow(1.85, x);

/** ai: the intent cycle. Elites and bosses walk it the same way. */
export const ARCH = {
    drone:     { name: 'Null Drone', body: 'orb', hp: 17, dmg: 4, armor: 0, ai: ['atk', 'atk', 'multi'] },
    mite:      { name: 'Mite', body: 'mite', hp: 8, dmg: 2, armor: 0, ai: ['atk'] },
    lancer:    { name: 'Lancer', body: 'walker', hp: 30, dmg: 6, armor: 0, ai: ['atk', 'atk', 'heavy'] },
    jammer:    { name: 'Jammer', body: 'wasp', hp: 22, dmg: 3, armor: 0, ai: ['jam', 'atk', 'atk'] },
    corruptor: { name: 'Corruptor', body: 'crawler', hp: 26, dmg: 3, armor: 0, ai: ['glitch', 'atk', 'atk'] },
    bulwark:   { name: 'Bulwark', body: 'tank', hp: 40, dmg: 4, armor: 2, ai: ['shield', 'atk', 'atk'] },
    sapper:    { name: 'Sapper', body: 'spider', hp: 21, dmg: 3, armor: 0, ai: ['drain', 'atk', 'atk'] },
    mortar:    { name: 'Mortar', body: 'turret', hp: 28, dmg: 4, armor: 1, ai: ['atk', 'charge', 'blast'] },
    mender:    { name: 'Mender', body: 'halo', hp: 24, dmg: 2, armor: 0, ai: ['heal', 'atk', 'heal', 'atk'] },
    marksman:  { name: 'Marksman', body: 'sniper', hp: 16, dmg: 8, armor: 0, ai: ['aim', 'snipe', 'atk'] },
};

export const AFFIXES = {
    armored:     { name: 'Armored', desc: 'Flat damage reduction (Cannons pierce).' },
    shielded:    { name: 'Shielded', desc: 'Starts behind a heavy shield.' },
    regen:       { name: 'Regenerating', desc: 'Repairs 8% each turn.' },
    volatile:    { name: 'Volatile', desc: 'Explodes when destroyed.' },
    overclocked: { name: 'Overclocked', desc: '+40% damage.' },
    jamming:     { name: 'Jamming', desc: 'Jams a reel every other turn.' },
};
const AFFIX_IDS = Object.keys(AFFIXES);

export const BOSSES = {
    sim:         { name: 'ARBITER-0 (Simulated)', body: 'titan', hp: 75, dmg: 4, armor: 0, ai: ['atk', 'jam', 'heavy', 'atk'], minions: ['mite'], color: 0 },
    verdict:     { name: 'Lancer Prime "Verdict"', body: 'titan', hp: 150, dmg: 6, armor: 1, ai: ['heavy', 'jam2', 'multi', 'atk'], minions: ['drone'], color: 1 },
    matriarch:   { name: 'Grinder Matriarch', body: 'matriarch', hp: 170, dmg: 5, armor: 2, ai: ['summon', 'glitch3', 'heavy', 'multi'], minions: ['mite', 'mite'], color: 2 },
    leviathan:   { name: 'Tidelock Leviathan', body: 'serpent', hp: 200, dmg: 6, armor: 1, ai: ['tide', 'atk', 'tide', 'crush'], minions: [], color: 3 },
    varga:       { name: 'VARGA//NULL', body: 'valkyrie', hp: 190, dmg: 5.4, armor: 1, ai: ['counter', 'multi', 'jam2', 'heavy'], ai2: ['counter', 'shieldSelf', 'multi', 'jam2', 'blast'], minions: ['drone'], color: 4 },
    arbiter:     { name: 'The Arbiter', body: 'arbiter', hp: 230, dmg: 6, armor: 2, ai: ['certainty', 'multi', 'heavy', 'drain'], minions: ['mender'], color: 5 },
    determinant: {
        name: 'THE DETERMINANT', body: 'determinant', hp: 300, dmg: 6, armor: 2, color: 6,
        ai: ['heavy', 'jam2', 'multi', 'atk'],
        phases: [
            { at: 0.66, ai: ['summon', 'glitch3', 'heavy', 'multi'], line: 'VARIANCE DETECTED. DEPLOYING CORRECTION.' },
            { at: 0.33, ai: ['zero', 'blast', 'certainty', 'multi'], line: 'ZERO VARIANCE PROTOCOL. THERE WILL BE NO MORE CHANCE.' },
        ],
        minions: ['drone', 'jammer'],
    },
};

export const CHAPTER_POOLS = [
    ['drone', 'mite', 'lancer'],
    ['drone', 'mite', 'lancer', 'jammer'],
    ['drone', 'mite', 'lancer', 'corruptor', 'bulwark', 'sapper'],
    ['lancer', 'jammer', 'mortar', 'mender', 'corruptor', 'bulwark'],
    ['marksman', 'lancer', 'bulwark', 'jammer', 'mortar', 'sapper', 'mender'],
    ['marksman', 'mortar', 'corruptor', 'jammer', 'sapper', 'mender', 'bulwark', 'drone'],
    ['marksman', 'mortar', 'corruptor', 'jammer', 'sapper', 'mender', 'bulwark', 'lancer'],
];
export const CHAPTER_BOSS = ['sim', 'verdict', 'matriarch', 'leviathan', 'varga', 'arbiter', 'determinant'];

const DESIGNATIONS = ['K', 'V', 'Z', 'Q', 'X', 'R', 'T', 'N'];

export function makeEnemy(rng, archId, x, { elite = false, affixes = [], holo = false } = {}) {
    const a = ARCH[archId];
    const hp = Math.round(a.hp * 1.5 * hpScale(x) * (elite ? 2.2 : 1));
    const dmg = a.dmg * dmgScale(x) * (elite ? 1.15 : 1);
    const e = {
        arch: archId, body: a.body, seed: rng.int(1, 1e9),
        name: `${holo ? 'Holo-' : ''}${a.name} ${rng.pick(DESIGNATIONS)}-${rng.int(2, 99)}`,
        hp, maxHp: hp, dmg, armor: a.armor * dmgScale(x) * 0.8, shield: 0,
        ai: a.ai.slice(), aiI: rng.int(0, a.ai.length - 1),
        affixes, elite, boss: false,
        xp: Math.round((elite ? 3 : 1) * (6 + a.hp / 5) * Math.pow(1.6, x)),
        bounty: Math.round((elite ? 3 : 1) * (2 + a.hp / 8) * rewardScale(x)),
        intent: null, charged: false,
    };
    for (const f of affixes) applyAffix(e, f);
    return e;
}

function applyAffix(e, f) {
    if (f === 'armored') e.armor = Math.max(e.armor, e.dmg * 0.6);
    if (f === 'shielded') e.shield = Math.round(e.maxHp * 0.5);
    if (f === 'overclocked') e.dmg *= 1.4;
    if (f === 'jamming' && !e.ai.includes('jam')) e.ai.push('jam');
    e.name = `${AFFIXES[f].name} ${e.name}`;
}

export function makeBoss(rng, id, x) {
    const b = BOSSES[id];
    const hp = Math.round(b.hp * hpScale(x));
    return {
        arch: id, body: b.body, seed: rng.int(1, 1e9), name: b.name,
        hp, maxHp: hp, dmg: b.dmg * 0.72 * dmgScale(x), armor: b.armor * dmgScale(x) * 0.8, shield: 0,
        ai: b.ai.slice(), aiI: 0, affixes: [], elite: false, boss: true, bossId: id,
        phases: b.phases ? b.phases.map((p) => ({ ...p, ai: p.ai.slice(), done: false })) : (b.ai2 ? [{ at: 0.5, ai: b.ai2.slice(), line: null, done: false }] : null),
        phase: 0,
        xp: Math.round(60 * Math.pow(1.6, x)),
        bounty: Math.round(60 * rewardScale(x)),
        intent: null, charged: false,
    };
}

/**
 * Build an encounter. kind: battle | elite | boss | ladder.
 */
export function makeEncounter(rng, { chapter, x, kind }) {
    const pool = CHAPTER_POOLS[Math.min(chapter, CHAPTER_POOLS.length - 1)];
    const holo = chapter === 0;
    const enemies = [];
    const affixPool = AFFIX_IDS.filter((f) => chapter >= 2 || (f !== 'volatile' && f !== 'jamming'));
    if (kind === 'boss') {
        const id = CHAPTER_BOSS[Math.min(chapter, CHAPTER_BOSS.length - 1)];
        enemies.push(makeBoss(rng, id, x));
        for (const m of BOSSES[id].minions) enemies.push(makeEnemy(rng, m, x, { holo }));
    } else if (kind === 'elite') {
        const arch = rng.pick(pool.filter((a) => a !== 'mite'));
        const nAff = chapter >= 5 ? 2 : 1;
        const aff = rng.shuffle(affixPool.slice()).slice(0, nAff);
        enemies.push(makeEnemy(rng, arch, x, { elite: true, affixes: aff, holo }));
        const minions = chapter >= 3 ? 2 : 1;
        for (let i = 0; i < minions; i++) enemies.push(makeEnemy(rng, rng.pick(pool), x, { holo }));
    } else {
        const n = chapter === 0 ? rng.int(1, 2) : rng.int(2, chapter >= 3 ? 4 : 3);
        for (let i = 0; i < n; i++) {
            const arch = rng.pick(pool);
            const aff = chapter >= 3 && rng.chance(0.08 + 0.03 * chapter) ? [rng.pick(affixPool)] : [];
            enemies.push(makeEnemy(rng, arch, x, { affixes: aff, holo }));
            if (arch === 'mite' && n < 4 && rng.chance(0.6)) enemies.push(makeEnemy(rng, 'mite', x, { holo }));
        }
    }
    return { enemies: enemies.slice(0, 5), x, chapter, kind };
}
