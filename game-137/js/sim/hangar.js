// Between sorties, aboard the carrier Skylark: buying, upgrading and fitting mech parts, and the
// Crew Deck, where the people you rescued leave gifts on a real-time clock (the light idle part).
// The clock is an input: main.js passes real seconds with act({ t: 'idle', secs }), so the
// simulation never reads a clock itself. Pure.

import { MECH, XP, IDLE_CAP, GIFT_CAP } from '../config.js';
import { PARTS, SLOTS, SLOT_KIND, LEVEL_MUL, STARTER } from './data/parts.js';
import { CREW, GIFTS, crewById } from './data/crew.js';

export function newHangar() {
    return {
        gold: 0,
        parts: { ...STARTER.parts },
        loadout: { ...STARTER.loadout },
        crew: [],              // { id, t0, stored }
        boosts: {},            // kind -> count waiting for the next sortie
        clock: 0,              // real seconds the game has been open or away (capped per absence)
    };
}

export const partLevel = (G, id) => G.hangar.parts[id] || 0;
/** What the next level of a part costs (buying is level 1), or null at the top. */
export function nextCost(G, id) {
    const L = partLevel(G, id);
    return L >= 3 ? null : PARTS[id].cost[L];
}

export function buy(G, id) {
    const H = G.hangar, P = PARTS[id];
    if (!P) return false;
    const c = nextCost(G, id);
    if (c == null || H.gold < c) { G.events.push({ type: 'nope', why: c == null ? 'max' : 'gold' }); return false; }
    H.gold -= c;
    H.parts[id] = partLevel(G, id) + 1;
    G.events.push({ type: H.parts[id] === 1 ? 'bought' : 'upgraded', part: id, lvl: H.parts[id] });
    // a new part goes straight into an empty slot of its kind
    if (H.parts[id] === 1) for (const s of SLOTS) if (SLOT_KIND[s] === P.kind && !H.loadout[s]) { H.loadout[s] = id; break; }
    return true;
}

export function equip(G, slot, id) {
    const H = G.hangar;
    if (!SLOTS.includes(slot)) return false;
    if (id == null) {
        // legs and core can't be empty; arms and shoulder can
        if (slot === 'legs' || slot === 'core') return false;
        H.loadout[slot] = null;
        G.events.push({ type: 'equip', slot, part: null });
        return true;
    }
    const P = PARTS[id];
    if (!P || P.kind !== SLOT_KIND[slot] || !partLevel(G, id)) return false;
    // one part can't be in two slots: swap the arms
    for (const s of SLOTS) if (s !== slot && H.loadout[s] === id) H.loadout[s] = H.loadout[slot];   // only arms share a kind: swap them
    H.loadout[slot] = id;
    G.events.push({ type: 'equip', slot, part: id });
    return true;
}

// ------------------------------------------------------------------ crew and gifts
export function joinCrew(G, id) {
    const H = G.hangar;
    if (H.crew.some((c) => c.id === id) || !crewById(id)) return false;
    H.crew.push({ id, t0: H.clock, stored: 0 });
    return true;
}

/** Real time passes. Each crew member makes a gift every `every` seconds, up to GIFT_CAP waiting. */
export function idle(G, secs) {
    const H = G.hangar;
    secs = Math.max(0, Math.min(IDLE_CAP, +secs || 0));
    H.clock += secs;
    let made = 0;
    for (const c of H.crew) {
        const def = crewById(c.id);
        while (c.stored < GIFT_CAP && H.clock - c.t0 >= def.every) { c.t0 += def.every; c.stored++; made++; }
        if (c.stored >= GIFT_CAP) c.t0 = H.clock;        // a full tray doesn't bank time
    }
    if (made) G.events.push({ type: 'gift_ready', n: made });
    return made;
}

/** Collect one crew member's gifts, or everyone's with 'all'. */
export function collect(G, id) {
    const H = G.hangar;
    let got = 0;
    for (const c of H.crew) {
        if (id !== 'all' && c.id !== id) continue;
        const def = crewById(c.id);
        while (c.stored > 0) {
            c.stored--;
            got++;
            if (def.gift === 'gold') H.gold += def.amount;
            else H.boosts[def.gift] = (H.boosts[def.gift] || 0) + 1;
            G.events.push({ type: 'gift', crew: c.id, gift: def.gift, amount: def.amount || 0 });
        }
    }
    return got;
}
export const giftsWaiting = (G) => G.hangar.crew.reduce((a, c) => a + c.stored, 0);
/** Seconds until crew member c's next gift (Infinity when the tray is full). */
export function nextGiftIn(G, c) {
    const def = crewById(c.id);
    return c.stored >= GIFT_CAP ? Infinity : Math.max(0, def.every - (G.hangar.clock - c.t0));
}

// ------------------------------------------------------------------ the mech, as fitted
/**
 * Everything the mech is for one sortie: from the loadout, part levels, level-up mods and boosts.
 * Weapons keep their cooldowns when rebuilt after a level-up (prev).
 */
export function buildMech(G, mods = {}, boosts = {}, prev = null) {
    const H = G.hangar, L = H.loadout;
    const lv = (id) => H.parts[id] || 1;
    const mul = (id) => LEVEL_MUL[lv(id) - 1];
    const core = PARTS[L.core], legs = PARTS[L.legs];
    let hp = MECH.baseHp + (legs.stats.hp || 0);
    let shield = 0, regenShield = 0, rate = 1, odMul = 1;
    if (L.core === 'plating') hp += core.stats.hp * mul('plating');
    if (L.core === 'barrier') { shield += core.stats.shield * mul('barrier'); regenShield = core.stats.regen; }
    if (L.core === 'reactor') { rate += core.stats.rate * mul('reactor'); odMul += core.stats.od; }
    hp += 20 * (mods.hp || 0) + (boosts.bento ? 25 : 0);
    shield += 20 * (mods.shield || 0) + (boosts.ward ? 30 : 0);
    if (shield > 0 && !regenShield) regenShield = 5;
    const speed = legs.stats.speed * (1 + 0.07 * (lv(L.legs) - 1)) * (1 + 0.09 * (mods.speed || 0)) * (boosts.turbo ? 1.12 : 1);

    const weapons = [];
    for (const slot of ['armL', 'armR', 'shoulder', 'legs']) {
        const id = L[slot];
        if (!id || !PARTS[id].weapon) continue;
        const P = PARTS[id], w = { ...P.weapon, part: id, slot, lvl: lv(id), cd: 0.3 + weapons.length * 0.17 };
        if (P.up === 'dmg') w.dmg *= mul(id);
        if (P.up === 'count') w.count += lv(id) - 1;
        if (w.type === 'bullet') w.count += mods.multi || 0;
        if (w.type === 'rocket') w.count += mods.salvo || 0;
        if (w.radius && w.type !== 'orbit') w.radius *= 1 + 0.25 * (mods.blast || 0);
        if (w.type === 'beam') { w.width *= 1 + 0.4 * (mods.beam || 0); w.range += 3 * (mods.beam || 0); }
        if (w.type === 'orbit') w.count += mods.saws || 0;
        const old = prev && prev.find((p) => p.slot === slot);
        if (old) w.cd = old.cd;
        weapons.push(w);
    }
    return {
        maxHp: hp, maxShield: shield, shieldRegen: regenShield, speed,
        rateMul: rate * (1 + 0.12 * (mods.rate || 0)),
        dmgMul: (1 + 0.15 * (mods.dmg || 0)) * (boosts.ammo ? 1.15 : 1),
        odMul: odMul * (1 + 0.3 * (mods.od || 0)),
        magnet: MECH.magnet + 1.2 * (mods.magnet || 0) + (boosts.charm ? 1.5 : 0),
        pickup: MECH.pickup + 0.3 * (mods.magnet || 0),
        regen: 0.8 * (mods.regen || 0) + (boosts.tea ? 1.2 : 0),
        weapons,
    };
}

export const xpFor = (lvl) => XP.first + XP.grow * (lvl - 1);
export { GIFTS, CREW };
