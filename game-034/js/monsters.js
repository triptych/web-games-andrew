import { MONSTER_TIERS, BOSS_TIER, MONSTER_BASE, FLOOR_SCALING } from './config.js';

let _nextId = 1;

function statsForFloor(floor) {
    const hp  = MONSTER_BASE.hp  * Math.pow(1 + FLOOR_SCALING.hpGrowthPerFloor, floor - 1);
    const atk = MONSTER_BASE.atk * Math.pow(1 + FLOOR_SCALING.atkGrowthPerFloor, floor - 1);
    return { hp, atk, def: MONSTER_BASE.def, spd: MONSTER_BASE.spd };
}

/** Pick a monster tier appropriate for the floor (deeper floors unlock later tiers). */
function pickTier(floor) {
    const maxIndex = Math.min(MONSTER_TIERS.length - 1, Math.floor((floor - 1) / 3) + 1);
    const idx = Math.floor(Math.random() * (maxIndex + 1));
    return MONSTER_TIERS[idx];
}

export function spawnMonsterGroup(floor, isBossRoom) {
    if (isBossRoom) {
        return [makeMonster(BOSS_TIER, floor)];
    }
    const count = 1 + Math.min(3, Math.floor(Math.random() * (1 + Math.floor(floor / 4))) + (Math.random() < 0.5 ? 1 : 0));
    const group = [];
    for (let i = 0; i < count; i++) {
        group.push(makeMonster(pickTier(floor), floor));
    }
    return group;
}

function makeMonster(tier, floor) {
    const base = statsForFloor(floor);
    const maxHp = Math.round(base.hp * tier.hpMul);
    return {
        id: `mon-${_nextId++}`,
        side: 'monster',
        name: tier.name,
        color: tier.color,
        shape: tier.shape,
        maxHp,
        hp: maxHp,
        atk: Math.round(base.atk * tier.atkMul),
        def: base.def,
        spd: base.spd,
        critChance: 0.06,
        alive: true,
        anim: { hitFlash: 0, attackPulse: 0, bob: Math.random() * Math.PI * 2 },
    };
}
