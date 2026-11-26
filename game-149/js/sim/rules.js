// Small shared rules: bonds, items, the party, text substitution. Pure.

import { BOND, BATTLE } from '../config.js';
import { CAST, FRIENDS, HEROES, GROW, ITEMS } from './data.js';

// ------------------------------------------------------------------ bonds
export const hearts = (G, who) => Math.min(BOND.maxHearts, Math.floor((G.bonds[who] || 0) / BOND.perHeart));

export function addBond(G, who, n) {
    if (!FRIENDS.includes(who) || !n) return;
    const before = hearts(G, who);
    G.bonds[who] = Math.max(0, Math.min(BOND.perHeart * BOND.maxHearts, (G.bonds[who] || 0) + n));
    const after = hearts(G, who);
    G.events.push({ type: 'bond', who, n, hearts: after });
    if (after > before) G.events.push({ type: 'heartUp', who, hearts: after });
}

/** The friend Kai is closest to (ties go to the cast order). Used for the captive and the epilogue. */
export function best(G) {
    let b = FRIENDS[0], bv = -1;
    for (const f of FRIENDS) if ((G.bonds[f] || 0) > bv) { bv = G.bonds[f] || 0; b = f; }
    return b;
}

/** The next heart event a friend has ready, or 0. */
export function heartEventReady(G, who) {
    const seen = G.heartSeen[who] || 0;
    if (seen >= BOND.events.length) return 0;
    return hearts(G, who) >= BOND.events[seen] ? seen + 1 : 0;
}

export function giftValue(who, item) {
    const c = CAST[who];
    if (c.loves?.includes(item)) return 'love';
    if (c.likes?.includes(item)) return 'like';
    return 'meh';
}

// ------------------------------------------------------------------ items
export function give(G, item, n = 1) {
    if (!ITEMS[item]) return;
    G.inv[item] = (G.inv[item] || 0) + n;
    if (G.inv[item] <= 0) delete G.inv[item];
    if (n > 0) G.events.push({ type: 'item', item, n });
}
export const has = (G, item, n = 1) => (G.inv[item] || 0) >= n;
export const giftable = (item) => ITEMS[item]?.kind === 'gift' || item === 'tart' || item === 'candy';

// ------------------------------------------------------------------ heroes
export function heroStats(id, lv) {
    const b = HEROES[id], k = 1 + GROW * (lv - 1);
    return { mhp: Math.round(b.hp * k), mmp: Math.round(b.mp * k), atk: Math.round(b.atk * k), mag: Math.round(b.mag * k), def: Math.round(b.def * k), spd: Math.round(b.spd * (1 + GROW * 0.4 * (lv - 1))) };
}

export function addXp(G, id, xp) {
    const h = G.heroes[id];
    if (!h) return;
    h.xp += xp;
    while (h.lv < BATTLE.lvCap && h.xp >= BATTLE.xpFor(h.lv)) {
        h.xp -= BATTLE.xpFor(h.lv);
        h.lv++;
        const s = heroStats(id, h.lv);
        h.hp = s.mhp; h.mp = s.mmp;           // a level up refills
        G.events.push({ type: 'levelUp', who: id, lv: h.lv });
    }
}

/** A friend who joins late starts one level behind Kai, never further. */
export function catchUp(G, id) {
    const h = G.heroes[id], k = G.heroes.kai;
    if (!h || h.lv >= k.lv - 1) return;
    h.lv = k.lv - 1; h.xp = 0;
    const s = heroStats(id, h.lv);
    h.hp = s.mhp; h.mp = s.mmp;
}

export function healParty(G) {
    for (const id of Object.keys(G.heroes)) {
        const s = heroStats(id, G.heroes[id].lv);
        G.heroes[id].hp = s.mhp; G.heroes[id].mp = s.mmp;
    }
}

/** Who fights: Kai, then up to two joined friends (the chosen ones, else the closest), and nobody who's captured. */
export function party(G) {
    const free = FRIENDS.filter((f) => G.joined[f] && G.captive !== f);
    let pick = (G.partyPick || []).filter((f) => free.includes(f));
    if (pick.length < 2) {
        const rest = free.filter((f) => !pick.includes(f)).sort((a, b) => (G.bonds[b] || 0) - (G.bonds[a] || 0) || FRIENDS.indexOf(a) - FRIENDS.indexOf(b));
        pick = pick.concat(rest).slice(0, 2);
    }
    return ['kai', ...pick.slice(0, 2)];
}

// ------------------------------------------------------------------ text
export function nameOf(G, who) {
    if (who === 'kai') return G.name;
    return CAST[who]?.name || who;
}

/** {name} the player, {best} the closest friend, {captive} who was taken, {partner} the dance partner. */
export function subst(G, text) {
    return text
        .replace(/\{name\}/g, G.name)
        .replace(/\{best\}/g, CAST[best(G)].name)
        .replace(/\{captive\}/g, G.captive ? CAST[G.captive].name : CAST[best(G)].name)
        .replace(/\{partner\}/g, G.partner ? CAST[G.partner].name : 'Mochi');
}

/** A condition from a script: flag:x, !flag:x, hearts:hana>=5, best:hana, item:x, romance:hana, partner:x, captive:x, charms>=12, late, joined:x. */
export function test(G, cond) {
    if (cond.startsWith('!')) return !test(G, cond.slice(1));
    let m;
    if ((m = cond.match(/^flag:(\w+)$/))) return !!G.flags[m[1]];
    if ((m = cond.match(/^hearts:(\w+)>=(\d+)$/))) return hearts(G, m[1]) >= +m[2];
    if ((m = cond.match(/^best:(\w+)$/))) return best(G) === m[1];
    if ((m = cond.match(/^item:(\w+)$/))) return has(G, m[1]);
    if ((m = cond.match(/^romance:(\w+)$/))) return G.romance[m[1]] === 'romance';
    if ((m = cond.match(/^friend:(\w+)$/))) return G.romance[m[1]] === 'friend';
    if ((m = cond.match(/^partner:(\w+)$/))) return (G.partner || 'mochi') === m[1];
    if ((m = cond.match(/^captive:(\w+)$/))) return G.captive === m[1];
    if ((m = cond.match(/^joined:(\w+)$/))) return !!G.joined[m[1]];
    if ((m = cond.match(/^charms>=(\d+)$/))) return G.charms.length >= +m[1];
    if (cond === 'late') return !!G.climax?.late;
    if (cond === 'allfree') return !!G.climax && G.climax.freed.length >= 4;
    throw new Error('unknown condition ' + cond);
}
