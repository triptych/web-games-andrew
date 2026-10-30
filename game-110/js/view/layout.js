// Where minions stand in each room. Pure (no three.js), so the tests can run it in Node.
//
// castle.js measures every piece of furniture, décor and window in a room as a box (room-local: x across, y up,
// z towards the camera) and passes them in; a slot is only kept if the minion's sprite — with room for its bob,
// hop or flutter — touches none of them. Without this a gingerbread golem's back-row slot landed inside the
// kitchen counter (v1.0.1).

import { MINIONS, HOBBIES } from '../sim/data.js';
import { drawMinion, SPRITE_SCALE } from './art.js';
import { hash3 } from '../rng.js';

/** floor, back row, on the back wall, hanging from a thread, or floating */
export const PLACE = { imp: 'floor', cauldron: 'floor', golem: 'back', spider: 'hang', loom: 'back', bat: 'air', gargoyle: 'floor', wraith: 'air', portrait: 'wall', skeleton: 'floor', mimic: 'floor', lich: 'back' };
export const SLOTS_PER_KIND = 7;
/** how far each kind moves about its slot in the view (see view.js): x sway and vertical bob */
const MOTION = { imp: [0, 0.2], bat: [0.85, 0.15], spider: [0, 0.3], wraith: [0, 0.35], lich: [0, 0.3], skeleton: [0.1, 0.08] };

const sizes = {};
/** A minion sprite's size in world units. */
export function spriteSize(id) {
    if (!sizes[id]) { const p = drawMinion(id); sizes[id] = { w: p.w * SPRITE_SCALE, h: p.h * SPRITE_SCALE }; }
    return sizes[id];
}

export const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 <= b.z1 && a.z1 >= b.z0;

/** The space a minion at (x, y, z) can reach. A wall portrait claims the wall in front of it too, so nothing hides it. */
export function spriteBox(id, x, y, z) {
    const S = spriteSize(id), [sway, bob] = MOTION[id] || [0, 0];
    const half = S.w / 2 + sway + 0.12;
    if (PLACE[id] === 'wall') return { x0: x - half, x1: x + half, y0: y - 0.05, y1: y + S.h + 0.05, z0: z - 0.08, z1: z + 1.0 };
    return { x0: x - half, x1: x + half, y0: y - bob, y1: y + S.h + bob, z0: z - 0.3, z1: z + 0.3 };
}

/** Up to SLOTS_PER_KIND slots for each minion of one room, clear of the obstacles and of each other. */
export function makeSlots(hobbyIndex, obstacles, { RW, RD, RH, T }) {
    const kinds = MINIONS.filter((m) => m.hobby === HOBBIES[hobbyIndex].id);
    const wallZ = -RD / 2 + T / 2;
    const slots = {}, used = [], claimed = [];
    // the centrepiece and the Overlord's spot stay clear
    const keepOut = (x, z) => (Math.abs(x - 0.4) < 2.4 && z < 1.4) || (x < -0.6 && x > -3.2 && z > -1.6 && z < 1.4);
    kinds.forEach((m, j) => {
        const mode = PLACE[m.id], S = spriteSize(m.id);
        const list = [];
        for (let k = 0; list.length < SLOTS_PER_KIND && k < 2000; k++) {
            const r1 = hash3(hobbyIndex * 7 + j, k, 3), r2 = hash3(k, hobbyIndex * 13 + j, 5), r3 = hash3(k, j, 9 + hobbyIndex);
            let x, y, z;
            if (mode === 'wall') {
                x = -RW / 2 + 0.3 + S.w / 2 + r1 * (RW - 0.6 - S.w);
                y = 1.0 + r2 * (RH - 1.5 - S.h);
                z = wallZ + 0.06;
            } else {
                const sway = (MOTION[m.id] || [0])[0];
                x = -RW / 2 + 0.3 + S.w / 2 + sway + r1 * (RW - 0.6 - S.w - sway * 2);
                z = mode === 'back' ? -2.9 + r2 * 2.2 : mode === 'hang' ? -2.6 + r2 * 2.6 : -2.4 + r2 * 5.2;
                y = mode === 'air' ? 2.6 + r3 * 1.8 : mode === 'hang' ? 3.6 + r3 * 1.4 : 0;
            }
            const box = spriteBox(m.id, x, y, z);
            if (obstacles.some((o) => hit(box, o))) continue;
            if (mode === 'wall') {
                if (claimed.some((c) => hit(box, c))) continue;
            } else if (mode === 'air' || mode === 'hang') {
                if (used.some((u) => u.mode === mode && Math.hypot(u.x - x, u.z - z) < 0.9)) continue;
            } else {
                if (keepOut(x, z)) continue;
                const r = k > 900 ? 0.7 : 1.15;
                if (used.some((u) => (u.mode === 'floor' || u.mode === 'back') && Math.hypot(u.x - x, u.z - z) < r)) continue;
            }
            used.push({ x, z, mode });
            claimed.push(box);
            list.push({ x, y, z, mode });
        }
        slots[m.id] = list;
    });
    return slots;
}
