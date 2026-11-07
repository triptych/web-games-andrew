// The Town Journal: checking each entry's condition and paying out rewards.

import { JOURNAL, JOURNAL_IDS } from './data/journal.js';
import { ITEMS } from './data/items.js';
import { BUILDINGS } from './data/buildings.js';
import { stock, addItem, earn, push, toast, hallLv, count, builtOf, bldsOf } from './core.js';
import { moveInSpecial } from './townsfolk.js';

export function addRenown(G, n) {
    const v = Math.max(1, Math.round(n * (1 + G.mods.renownMul)));
    G.renown += v;
    G.stats.renownEarned += v;
    push(G, { type: 'renown', n: v });
}

function heroesWithTier(G, tier) {
    let n = 0;
    for (const h of G.heroes) {
        const w = ITEMS[h.equip.weapon], a = ITEMS[h.equip.armor];
        if (w && a && w.tier >= tier && a.tier >= tier) n++;
    }
    return n;
}

/** { cur, need } for a journal entry, with both as plain numbers for a progress bar. */
export function progress(G, e) {
    const c = e.cond, s = G.stats;
    switch (c.k) {
        case 'hits': return { cur: s.hits, need: c.n };
        case 'have': return { cur: stock(G, c.item), need: c.n };
        case 'haveAll': { const ks = Object.keys(c.items); return { cur: ks.filter((k) => stock(G, k) >= c.items[k]).length, need: ks.length, detail: ks.map((k) => `${stock(G, k)}/${c.items[k]} ${ITEMS[k].icon}`).join('  ') }; }
        case 'build': return { cur: Math.min(c.n || 1, count(G, c.type, c.lv || 1)), need: c.n || 1 };
        case 'buildAll': return { cur: c.types.filter((t) => count(G, t) > 0).length, need: c.types.length };
        case 'staffed': return { cur: bldsOf(G, c.type).some((b) => b.lv >= 1 && b.workers.length > 0) ? 1 : 0, need: 1 };
        case 'hall': return { cur: Math.min(c.lv, hallLv(G)), need: c.lv };
        case 'pop': return { cur: G.villagers.length, need: c.n };
        case 'heroes': return { cur: G.heroes.length, need: c.n };
        case 'quests': return { cur: s.questsDone, need: c.n };
        case 'region': return { cur: Math.min(1, s.regionDone[c.id] || 0), need: 1 };
        case 'craft': return { cur: s.crafted[c.item] || 0, need: c.n };
        case 'craftCat': return { cur: s.craftedCat[c.cat] || 0, need: c.n };
        case 'cook': return { cur: s.cooked, need: c.n };
        case 'cookItem': return { cur: s.cookedItem[c.item] || 0, need: c.n };
        case 'sold': return { cur: s.sold, need: c.n };
        case 'earn': return { cur: s.goldEarned, need: c.n };
        case 'raids': return { cur: s.raidsHeld, need: c.n };
        case 'heroLv': return { cur: s.maxHeroLv, need: c.n };
        case 'upgrades': return { cur: Object.keys(G.upgrades).length, need: c.n };
        case 'cozy': return { cur: G.cozy, need: c.n };
        case 'gearTier': return { cur: heroesWithTier(G, c.tier), need: c.n };
        case 'gearTierMade': return { cur: s.tierMade, need: c.tier };
        case 'boss': return { cur: s.bossDown ? 1 : 0, need: 1 };
        default: return { cur: 0, need: 1 };
    }
}

export function isOpen(G, e) { return e.after.every((a) => G.journal[a] === 'claimed'); }

/** Mark entries ready as their conditions come true. */
export function tickJournal(G) {
    for (const id of JOURNAL_IDS) {
        if (G.journal[id]) continue;
        const e = JOURNAL[id];
        if (!isOpen(G, e)) continue;
        const p = progress(G, e);
        if (p.cur >= p.need) {
            G.journal[id] = 'ready';
            push(G, { type: 'journalReady', id });
            toast(G, `Journal: ${e.title}: ready to claim!`, 'good');
        }
    }
}

export function claim(G, id) {
    const e = JOURNAL[id];
    if (!e || G.journal[id] !== 'ready') return { ok: false, why: 'Not ready yet.' };
    G.journal[id] = 'claimed';
    const r = e.reward;
    const lines = [];
    for (const k in r) {
        if (k === 'gold') { earn(G, r.gold); lines.push(`${r.gold} gold`); }
        else if (k === 'renown') { addRenown(G, r.renown); lines.push(`${r.renown} renown`); }
        else if (k === 'special') moveInSpecial(G, r.special);
        else if (ITEMS[k]) { addItem(G, k, r[k]); lines.push(`${r[k]} ${ITEMS[k].name}`); }
    }
    push(G, { type: 'claimed', id, text: lines.join(', ') });
    tickJournal(G);
    return { ok: true, text: lines.join(', ') };
}

/** Entries the player can see right now: open or ready, not yet claimed. */
export function activeEntries(G) {
    return JOURNAL_IDS.filter((id) => G.journal[id] !== 'claimed' && isOpen(G, JOURNAL[id])).map((id) => JOURNAL[id]);
}
export function claimable(G) { return JOURNAL_IDS.filter((id) => G.journal[id] === 'ready'); }
