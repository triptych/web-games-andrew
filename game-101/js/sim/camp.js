// The camp menu: equipment, items, field skills, formation. Works in town and in the dungeon. Pure.

import { say, ev } from './core.js';
import { calc, canEquip, slotFor, SKILLS, healMember } from './party.js';
import { findItem, give, take } from './inv.js';
import { recItem, misc } from './journal.js';
import { potionEffect, tomeEffect } from './use.js';
import { SCROLLS, itemLabel } from './items.js';
import { revealAll, distMap, reveal } from './dungeon.js';
import { returnToTown } from './world.js';

export function equip(G, who, itemId) {
    const m = G.party[who], it = findItem(G, itemId);
    if (!m || !it) return false;
    const c = canEquip(m, it);
    if (!c.ok) { say(G, c.why + '.', 12); return false; }
    const slot = slotFor(m, it);
    if (m.eq[slot]?.cursed) { say(G, `${m.eq[slot].name} is cursed and will not come off!`, 5); return false; }
    take(G, itemId, 1);
    const old = m.eq[slot];
    m.eq[slot] = it;
    if (old) give(G, old, 'reward');
    // a two-handed weapon pushes the shield off
    if (slot === 'weapon' && it.hands === 2 && m.eq.shield) {
        if (m.eq.shield.cursed) { m.eq.weapon = old || undefined; take(G, it.id, 1); give(G, it, 'reward'); say(G, 'The cursed shield will not come off.', 5); return false; }
        give(G, m.eq.shield, 'reward'); delete m.eq.shield;
    }
    clampVitals(m);
    recItem(G, it, 'equipped');
    ev(G, 'equip');
    if (it.cursed && !it.known) { it.known = true; say(G, `Oh no! ${it.name} is cursed! It will not come off.`, 5); ev(G, 'cursed'); misc(G, 'cursedFound'); }
    else say(G, `${m.name} equips ${it.name}.`, 7);
    return true;
}
export function unequip(G, who, slot) {
    const m = G.party[who], it = m?.eq[slot];
    if (!it) return false;
    if (it.cursed) { say(G, `${it.name} is cursed and will not come off!`, 5); return false; }
    delete m.eq[slot];
    give(G, it, 'reward');
    clampVitals(m);
    ev(G, 'equip');
    return true;
}
function clampVitals(m) {
    const s = calc(m);
    m.hp = Math.min(m.hp, s.maxhp); m.mp = Math.min(m.mp, s.maxmp);
    if (m.hp <= 0) m.hp = 0;
}

/** Use an item from the camp menu. `who` is the target member. */
export function useItem(G, itemId, who) {
    const it = findItem(G, itemId), m = G.party[who];
    if (!it || !m) return false;
    if (it.t === 'p') {
        const r = potionEffect(it, m, false);
        say(G, r.text, r.ok ? 10 : 7);
        if (r.ok) { take(G, itemId, 1); recItem(G, it, 'used'); misc(G, 'potionsUsed'); ev(G, 'heal'); }
        return r.ok;
    }
    if (it.t === 't') {
        const r = tomeEffect(it, m);
        take(G, itemId, 1); recItem(G, it, 'used'); say(G, r.text, 13); ev(G, 'levelup', { name: m.name });
        return true;
    }
    if (it.t === 's') {
        const S = SCROLLS[it.eff];
        if (S.k === 'escape') {
            if (!G.floor) { say(G, 'Nothing happens in town.', 7); return false; }
            take(G, itemId, 1); recItem(G, it, 'used');
            returnToTown(G, 'escape');
            return true;
        }
        if (S.k === 'map') {
            if (!G.floor) { say(G, 'There is nothing to map here.', 7); return false; }
            take(G, itemId, 1); recItem(G, it, 'used'); revealAll(G.floor); say(G, 'The floor is mapped.', 11); ev(G, 'found');
            return true;
        }
        if (S.k === 'tele') {
            if (!G.floor) return false;
            const f = G.floor, dm = distMap(f, f.start.x, f.start.y), c = [];
            for (let i = 0; i < dm.length; i++) if (dm[i] >= 0) c.push(i);
            const i = c[Math.floor(G.rng() * c.length)];
            take(G, itemId, 1); recItem(G, it, 'used');
            G.pos.x = i % f.w; G.pos.y = (i / f.w) | 0;
            reveal(f, G.pos.x, G.pos.y, G.pos.d);
            ev(G, 'teleport'); say(G, 'The party is whisked away.', 11);
            return true;
        }
        say(G, 'Use that in battle.', 7);
        return false;
    }
    if (it.t === 'm') {
        if (it.skill === 'heal') {
            if (it.charges <= 0) { say(G, 'The wand is spent.', 7); return false; }
            const amt = Math.round((calc(m).mag + it.pot * 3) * 1.0 + 20);
            if (m.hp <= 0 || m.hp >= calc(m).maxhp) return false;
            healMember(m, amt); it.charges--; recItem(G, it, 'used'); say(G, `${m.name} is mended.`, 10); ev(G, 'heal');
            return true;
        }
        say(G, 'Use that in battle.', 7);
        return false;
    }
    say(G, 'You cannot use that.', 7);
    return false;
}

/** A field skill: heal, cure, revive, tonic. */
export function fieldSkill(G, who, skillId, target) {
    const m = G.party[who], sk = SKILLS[skillId];
    if (!m || !sk || !sk.field || sk.cls !== m.cls || sk.lvl > m.lvl || m.hp <= 0) return false;
    if (m.mp < sk.mp) { say(G, 'Not enough MP.', 7); return false; }
    const s = calc(m);
    const amt = Math.round((s.mag * sk.pow + m.lvl * 2 + 12));
    if (sk.k === 'h') {
        const ts = sk.tg === 'aa' ? G.party.filter((x) => x.hp > 0) : [G.party[target]];
        if (!ts.length || ts.every((t) => !t || t.hp <= 0 || t.hp >= calc(t).maxhp)) return false;
        m.mp -= sk.mp;
        for (const t of ts) if (t && t.hp > 0) healMember(t, amt);
        say(G, `${m.name} casts ${sk.name}.`, 10);
        ev(G, 'heal');
        return true;
    }
    if (sk.fx === 'cure') {
        const t = G.party[target];
        if (!t || !(t.st.poison || t.st.sleep || t.st.stun)) return false;
        m.mp -= sk.mp;
        for (const k of ['poison', 'sleep', 'stun']) delete t.st[k];
        say(G, `${t.name} is cured.`, 10);
        ev(G, 'heal');
        return true;
    }
    if (sk.fx === 'revive') {
        const t = G.party[target];
        if (!t || t.hp > 0) return false;
        m.mp -= sk.mp;
        t.hp = Math.max(1, Math.round(calc(t).maxhp * 0.4)); t.st = {};
        say(G, `${t.name} rises!`, 10);
        ev(G, 'heal');
        return true;
    }
    return false;
}

export function setRow(G, who, row) { const m = G.party[who]; if (m) m.row = row; }
export function moveMember(G, who, dir) {
    const j = who + dir;
    if (j < 0 || j >= G.party.length) return false;
    [G.party[who], G.party[j]] = [G.party[j], G.party[who]];
    return true;
}
export function drop(G, itemId) {
    const it = findItem(G, itemId);
    if (!it) return false;
    take(G, itemId, it.n || 1);
    say(G, `Dropped ${itemLabel(it)}.`, 7);
    return true;
}
