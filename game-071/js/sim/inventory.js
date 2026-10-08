/**
 * inventory.js — adding, removing, equipping and weighing what an actor carries.
 *
 * actor.inv is an array of entries; actor.equip maps a slot to an entry *object* in actor.inv.
 * Slots: right, left, ammo, head, body, hands, feet, ring, amulet. A shield lives in `left`.
 */
import { ITEMS, itemDef, stackable, sameStack, itemWeight } from './items.js';

export function addItem(actor, entry, n = entry.n || 1) {
    const d = itemDef(entry);
    if (!d) return null;
    if (d.type === 'gold') { actor.gold = (actor.gold || 0) + n; return null; }
    const e = { ...entry, n };
    if (stackable(e)) {
        const ex = actor.inv.find((x) => sameStack(x, e));
        if (ex) { ex.n += n; return ex; }
        actor.inv.push(e);
        return e;
    }
    // non-stacking: one entry per item
    let first = null;
    for (let i = 0; i < n; i++) { const one = { ...entry, n: 1 }; actor.inv.push(one); first = first || one; }
    return first;
}

/** Remove n of an entry (or of a base id). Returns how many were removed. */
export function removeItem(actor, which, n = 1) {
    if (which === 'gold' || which?.id === 'gold') { const k = Math.min(n, actor.gold || 0); actor.gold -= k; return k; }
    let removed = 0;
    while (removed < n) {
        const e = typeof which === 'string' ? actor.inv.find((x) => x.id === which) : actor.inv.includes(which) ? which : null;
        if (!e) break;
        const k = Math.min(n - removed, e.n);
        e.n -= k; removed += k;
        if (e.n <= 0) {
            unequipEntry(actor, e);
            actor.inv.splice(actor.inv.indexOf(e), 1);
        }
        if (typeof which !== 'string') break;
    }
    return removed;
}

export function countItem(actor, id) {
    if (id === 'gold') return actor.gold || 0;
    let n = 0;
    for (const e of actor.inv) if (e.id === id) n += e.n;
    return n;
}

export function unequipEntry(actor, e) {
    if (!actor.equip) return;
    for (const k of Object.keys(actor.equip)) if (actor.equip[k] === e) actor.equip[k] = null;
}

export function isEquipped(actor, e) {
    if (!actor.equip) return null;
    for (const k of Object.keys(actor.equip)) if (actor.equip[k] === e) return k;
    return null;
}

/**
 * Equip an entry. hand: 'right' | 'left' for one-handed weapons and spells (default right).
 * Returns the slot used, or null.
 */
export function equip(actor, e, hand = 'right') {
    const d = itemDef(e);
    if (!d) return null;
    const eq = actor.equip;
    const prev = isEquipped(actor, e);
    if (prev) { eq[prev] = null; if (prev === hand || d.two) return null; }   // toggling off
    if (d.type === 'weapon') {
        if (d.two) { eq.right = e; eq.left = null; return 'right'; }
        if (hand === 'left') {
            if (eq.right && itemDef(eq.right)?.two) eq.right = null;
            eq.left = e; return 'left';
        }
        eq.right = e; return 'right';
    }
    if (d.type === 'armor' || d.type === 'jewelry') {
        const slot = d.slot === 'shield' ? 'left' : d.slot;
        if (slot === 'left' && eq.right && itemDef(eq.right)?.two) eq.right = null;
        eq[slot] = e;
        return slot;
    }
    if (d.type === 'ammo') { eq.ammo = e; return 'ammo'; }
    if (d.type === 'torch') { if (eq.right && itemDef(eq.right)?.two) eq.right = null; eq.left = e; return 'left'; }
    return null;
}

export function carryWeight(actor) {
    let w = 0;
    for (const e of actor.inv) {
        const d = ITEMS[e.id];
        if (!d) continue;
        // perks: armour weighs nothing when worn with Conditioning / Unhindered
        if (actor.sheet && isEquipped(actor, e) && d.type === 'armor') {
            if (d.armorType === 'heavy' && actor.sheet.perks.ha_condition) continue;
            if (d.armorType === 'light' && actor.sheet.perks.la_unhindered) continue;
        }
        w += itemWeight(e) * e.n;
    }
    return Math.round(w * 10) / 10;
}

export function weaponIn(actor, hand = 'right') {
    const e = actor.equip[hand];
    const d = e && itemDef(e);
    return d && d.type === 'weapon' ? { e, d } : null;
}

/** Equip the best of everything (used for NPCs when they are created). */
export function autoEquip(actor) {
    const best = {};
    const score = (d) => (d.type === 'weapon' ? d.damage * (d.two ? 0.8 : 1) : d.rating || 0.1);
    for (const e of actor.inv) {
        const d = ITEMS[e.id];
        if (!d) continue;
        let slot = null;
        if (d.type === 'weapon') slot = d.bow ? 'bow' : d.two ? 'two' : 'one';
        else if (d.type === 'armor' || d.type === 'jewelry') slot = d.slot;
        else if (d.type === 'ammo') slot = 'ammo';
        if (!slot) continue;
        if (!best[slot] || score(d) > score(ITEMS[best[slot].id])) best[slot] = e;
    }
    if (best.bow && (actor.ai?.kind === 'archer' || !best.one)) equip(actor, best.bow);
    else if (best.two && !best.shield) equip(actor, best.two);
    else if (best.one) equip(actor, best.one);
    for (const s of ['head', 'body', 'hands', 'feet', 'ring', 'amulet', 'ammo']) if (best[s]) equip(actor, best[s]);
    if (best.shield && !(actor.equip.right && itemDef(actor.equip.right).two)) equip(actor, best.shield);
}
