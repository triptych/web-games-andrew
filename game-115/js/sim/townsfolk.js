// Villagers: who they are, what they are good at, where they work, and who turns up at the gate.

import { DAY_LEN } from '../config.js';
import { BUILDINGS, SKILLS, stat } from './data/buildings.js';
import { FIRST_NAMES, SURNAMES, VILLAGER_TRAITS, SPECIALS, skillXpNeed, SKILL_MAX } from './data/people.js';
import { clamp, nextId, hall, hallLv, push, toast, note, recomputeMods, vById, bldById, isNight, count } from './core.js';

const SKILL_IDS = Object.keys(SKILLS);

export function makeLook(rng) {
    return { skin: rng.int(0, 3), hair: rng.int(0, 7), style: rng.int(0, 3), outfit: rng.int(0, 5), hat: rng.int(0, 3) };
}

/** A new villager. `tier` (the Hall level) nudges how good their best skill is. */
export function makeVillager(G, tier = 1) {
    const rng = G.rng;
    const skills = {};
    const main = rng.pick(SKILL_IDS);
    skills[main] = clamp(rng.int(1, 2 + Math.floor(tier / 2)), 1, 5);
    if (rng.chance(0.55)) { const s2 = rng.pick(SKILL_IDS); if (!skills[s2]) skills[s2] = rng.int(1, 2); }
    return {
        id: nextId(G), name: `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`, look: makeLook(rng),
        skills, xp: {}, trait: rng.pick(Object.keys(VILLAGER_TRAITS)), job: null, special: null, since: G.day,
    };
}

export function makeSpecial(G, key) {
    const s = SPECIALS[key];
    return { id: nextId(G), name: s.name, look: { ...s.look }, skills: { ...s.skills }, xp: {}, trait: s.trait, job: null, special: key, since: G.day };
}

export function skillOf(v, skill) { return v.skills[skill] || 0; }
export function bestSkill(v) {
    let b = null, bl = 0;
    for (const k in v.skills) if (v.skills[k] > bl) { bl = v.skills[k]; b = k; }
    return b;
}

/** What a villager is worth at a job: skill level, trait, and the hour. kind is 'gather' | 'craft' | 'serve'. */
export function workerMul(G, v, skill, kind) {
    const lvl = skill ? Math.max(0.6, skillOf(v, skill) || 0.6) : 1;
    let m = 1 + 0.1 * (lvl - 1);
    const t = VILLAGER_TRAITS[v.trait] || {};
    if (kind === 'gather') m += t.gather || 0;
    if (kind === 'craft') m += t.craft || 0;
    if (kind === 'serve') m += t.serve || 0;
    if (skill === 'husbandry') m += t.husb || 0;
    if (skill === 'lumber' || skill === 'mining') m += t.heavy || 0;
    return m;
}
export function nightMul(G, v) {
    if (!isNight(G.t)) return 1;
    return clamp(0.35 + G.mods.nightWork + (VILLAGER_TRAITS[v.trait]?.night || 0), 0.1, 1);
}

export function popCap(G) {
    let c = hall(G) ? stat('hall', hallLv(G), 'house') : 2;
    for (const b of G.buildings) if (b.type === 'house' && b.lv >= 1) c += stat('house', b.lv, 'house');
    return c;
}
export function popCount(G) { return G.villagers.length; }

export function slotsOf(b) {
    const d = BUILDINGS[b.type];
    if (!d.skill || b.lv < 1) return 0;
    return stat(b.type, b.lv, 'workers');
}
export function freeSlots(b) { return Math.max(0, slotsOf(b) - b.workers.length); }

export function assign(G, vid, bid) {
    const v = vById(G, vid);
    if (!v) return false;
    if (v.job) { const ob = bldById(G, v.job); if (ob) ob.workers = ob.workers.filter((x) => x !== vid); v.job = null; }
    if (bid == null) return true;
    const b = bldById(G, bid);
    if (!b || freeSlots(b) <= 0) return false;
    b.workers.push(vid);
    v.job = bid;
    return true;
}

/** A building's importance when someone has to choose where to work. */
function jobPriority(G, b) {
    const d = BUILDINGS[b.type];
    if (d.kind === 'craft') {
        const active = (b.queue && b.queue.length) || Object.values(b.auto || {}).some((t) => t > 0) ? 2.2 : 0.4;
        return active;
    }
    if (d.kind === 'service') return b.type === 'inn' || b.type === 'itemshop' ? 1.6 : 1.1;
    if (b.type === 'woodshed' || b.type === 'quarry' || b.type === 'farm' || b.type === 'mine' || b.type === 'dock') return 1.5;
    return 1.2;
}

/**
 * Everyone without a job goes to the best open slot for them. With `all`, everyone is reshuffled:
 * the busiest crafters and shops get their first worker before any gatherer gets a second.
 */
export function autoAssign(G, all = false) {
    if (all) {
        for (const v of G.villagers) v.job = null;
        for (const b of G.buildings) b.workers = [];
    }
    // every open slot, most important first
    const slots = [];
    for (const b of G.buildings) {
        const d = BUILDINGS[b.type];
        if (!d.skill || b.lv < 1) continue;
        const free = freeSlots(b);
        for (let i = 0; i < free; i++) {
            const first = b.workers.length === 0 && i === 0;
            slots.push({ b, pri: jobPriority(G, b) * (first ? 2 : 1) - i * 0.05 });
        }
    }
    slots.sort((x, y) => y.pri - x.pri);
    let moved = 0;
    const idle = () => G.villagers.filter((v) => !v.job);
    for (const s of slots) {
        const pool = idle();
        if (!pool.length) break;
        const d = BUILDINGS[s.b.type];
        let best = null, bs = -1;
        for (const v of pool) {
            const sc = skillOf(v, d.skill) + (v.special ? 3 : 0);
            if (sc > bs) { bs = sc; best = v; }
        }
        if (best && assign(G, best.id, s.b.id)) moved++;
    }
    return moved;
}

/** Training: a worker's skill grows with time on the job. */
export function trainWorkers(G, b, dt) {
    const d = BUILDINGS[b.type];
    if (!d.skill) return;
    for (const vid of b.workers) {
        const v = vById(G, vid);
        if (!v) continue;
        const lv = v.skills[d.skill] || 0;
        if (lv >= SKILL_MAX) continue;
        const xp = (v.xp[d.skill] || 0) + dt * (1 + (VILLAGER_TRAITS[v.trait]?.xp || 0));
        const need = skillXpNeed(Math.max(1, lv));
        if (xp >= need) {
            v.skills[d.skill] = lv + 1;
            v.xp[d.skill] = 0;
            push(G, { type: 'skillup', vid: v.id, skill: d.skill, lv: lv + 1 });
            note(G, `${v.name} became better at ${SKILLS[d.skill].name}.`);
        } else v.xp[d.skill] = xp;
    }
}

// ---------------------------------------------------------------- newcomers
export function arrivalInterval(G) {
    return (DAY_LEN * 0.45) / (1 + G.cozy / 140) / (1 + G.mods.welcomeRate);
}

export function tickNewcomers(G, dt) {
    // visitors who waited too long walk on
    G.visitors = G.visitors.filter((v) => v.kind !== 'villager' || v.exp > G.t);
    G.arriveT -= dt;
    if (G.arriveT > 0) return;
    G.arriveT = arrivalInterval(G) * G.rng.range(0.8, 1.25);
    const waiting = G.visitors.filter((v) => v.kind === 'villager').length;
    if (popCount(G) + waiting >= popCap(G)) return;
    const person = makeVillager(G, hallLv(G));
    G.visitors.push({ id: nextId(G), kind: 'villager', person, exp: G.t + DAY_LEN });
    push(G, { type: 'newcomer', name: person.name });
    toast(G, `${person.name} is at the gate.`, 'good');
    if (G.mods.autoWelcome || G.opts.autoWelcome || G.quiet) welcome(G, G.visitors[G.visitors.length - 1].id, true);
}

export function welcome(G, visitorId, accept) {
    const i = G.visitors.findIndex((v) => v.id === visitorId && v.kind === 'villager');
    if (i < 0) return { ok: false, why: 'They are gone.' };
    const vis = G.visitors[i];
    if (!accept) { G.visitors.splice(i, 1); return { ok: true }; }
    if (popCount(G) >= popCap(G)) return { ok: false, why: 'No room: build a House or upgrade the Hall.' };
    G.visitors.splice(i, 1);
    G.villagers.push(vis.person);
    push(G, { type: 'welcomed', vid: vis.person.id, name: vis.person.name });
    note(G, `${vis.person.name} moved in.`);
    autoAssign(G);
    return { ok: true, vid: vis.person.id };
}

export function moveInSpecial(G, key) {
    if (G.villagers.some((v) => v.special === key)) return null;
    const v = makeSpecial(G, key);
    G.villagers.push(v);
    recomputeMods(G);
    push(G, { type: 'special', key, vid: v.id, name: v.name });
    toast(G, `${v.name} has moved in!`, 'good');
    autoAssign(G);
    return v;
}
