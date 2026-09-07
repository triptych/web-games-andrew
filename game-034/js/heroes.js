import { HERO_CLASSES } from './config.js';
import { state } from './state.js';

let _nextId = 1;

/** Build the live party (array of combatant objects) from state.recruitedClasses + upgrade multipliers. */
export function buildParty() {
    const classes = state.recruitedClasses;
    return classes.map((classId) => {
        const def = HERO_CLASSES[classId];
        const maxHp = Math.round(def.baseHp * state.hpMul);
        return {
            id: `hero-${_nextId++}`,
            side: 'hero',
            classId,
            name: def.name,
            color: def.color,
            shape: def.shape,
            role: def.role,
            maxHp,
            hp: maxHp,
            atk: Math.round(def.baseAtk * state.atkMul),
            def: Math.round(def.baseDef * state.defMul),
            spd: def.baseSpd,
            critChance: def.critChance,
            healPerTurn: def.healPerTurn || 0,
            alive: true,
            // render/animation scratch state
            anim: { hitFlash: 0, attackPulse: 0, bob: Math.random() * Math.PI * 2 },
        };
    });
}
