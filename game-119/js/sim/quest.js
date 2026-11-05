// Quests, the notice boards and visiting heroes. Pure.

import { TOWN, TOWNS, NEIGHBORS, HERO_CLASSES, HERO_NAMES, HERO_TITLES } from './data/towns.js';
import { MATS, FAMS, SLOT_ORDER, basePrice, itemDef, matGrade, itemName } from './data/items.js';
import { QUESTS, STORY_ORDER } from './data/quests.js';
import { STORY_TEXT } from './data/story.js';
import { addItems, room, count, itemById, removeItems } from './inv.js';
import { gearMax } from './market.js';
import { log, emit, gainXp, have, takeAny, repUp } from './core.js';

export const questDef = (G, id) => QUESTS[id] || G.gen[id] || null;
const GENERIC_FETCH = Object.values(MATS).filter((m) => m.cat !== 'quest');

/** 'locked' | 'available' | 'active' | 'ready' | 'done' | 'expired' */
export function questState(G, id) {
    const q = questDef(G, id);
    if (!q) return 'locked';
    if (G.q.done[id]) return 'done';
    const a = G.q.active[id];
    if (a) return questReady(G, q) ? 'ready' : 'active';
    if (q.gen) return G.day > q.deadline ? 'expired' : 'available';
    if (q.after && !G.q.done[q.after]) return 'locked';
    if (G.lv < q.lv) return 'locked';
    return 'available';
}
export function reqProgress(G, q) {
    if (q.kind === 'courier') {
        const has = G.inv.items.some((it) => it.t === 'parcel' && it.qid === q.id);
        return [{ t: 'parcel', n: 1, lv: 0, have: has ? 1 : 0, label: `Parcel for ${TOWN[q.to].name}` }];
    }
    return q.req.map((r) => ({ ...r, lv: r.lv || 0, have: Math.min(r.n, have(G, r.t, r.lv || 0, !!r.lv)) }));
}
export function questReady(G, q) {
    if (G.loc !== q.turn) return false;
    return reqProgress(G, q).every((r) => r.have >= r.n);
}
export const heroTownFor = (G) => {
    for (const id of STORY_ORDER) if (id !== 's0' && !G.q.done[id]) return QUESTS[id].town;
    return 'aurelion';
};
export function nextStoryId(G) { return STORY_ORDER.find((id) => !G.q.done[id]) || null; }

export function questsAt(G, townId) {
    const out = [];
    for (const q of Object.values(QUESTS)) if (q.town === townId) out.push(q);
    for (const id of G.towns[townId].board) { const q = G.gen[id]; if (q) out.push(q); }
    // also active quests that turn in here but were given elsewhere
    for (const id of Object.keys(G.q.active)) { const q = questDef(G, id); if (q && q.turn === townId && q.town !== townId) out.push(q); }
    return out.map((q) => ({ q, state: questState(G, q.id) })).filter((x) => x.state !== 'expired' && !(x.state === 'done' && x.q.gen));
}

function dialog(G, id, lines) { if (lines && lines.length) emit(G, { type: 'dialog', id, lines }); }

export function acceptQuest(G, id) {
    const q = questDef(G, id);
    if (!q) return { ok: false, msg: 'No such quest.' };
    if (questState(G, id) !== 'available') return { ok: false, msg: 'That quest is not available.' };
    if (G.loc !== q.town && !G.q.active[id]) return { ok: false, msg: 'Speak to the giver in person.' };
    if (q.kind === 'courier') {
        if (addItems(G, 'parcel', 0, 1, { qid: q.id }) < 1) return { ok: false, msg: 'No room in the wagon for the parcel.' };
    }
    G.q.active[id] = { day: G.day };
    log(G, `Quest accepted: ${q.title}`);
    emit(G, { type: 'quest-accept', id });
    if (STORY_TEXT[id]) dialog(G, id + ':intro', STORY_TEXT[id].intro);
    if (q.call) return turnInQuest(G, id);
    return { ok: true, msg: `Accepted: ${q.title}` };
}
export function abandonQuest(G, id) {
    const q = questDef(G, id);
    if (!q || !G.q.active[id] || q.story) return { ok: false, msg: 'You cannot abandon that.' };
    delete G.q.active[id];
    if (q.kind === 'courier') for (const it of [...G.inv.items]) if (it.qid === id) G.inv.items.splice(G.inv.items.indexOf(it), 1);
    repUp(G, q.town, -1);
    return { ok: true, msg: 'Quest abandoned.' };
}
export function turnInQuest(G, id) {
    const q = questDef(G, id);
    if (!q || !G.q.active[id]) return { ok: false, msg: 'That quest is not active.' };
    if (G.loc !== q.turn) return { ok: false, msg: `Hand it in at ${TOWN[q.turn].name}.` };
    if (!reqProgress(G, q).every((r) => r.have >= r.n)) return { ok: false, msg: 'You do not have everything yet.' };
    if (q.kind === 'courier') {
        for (const it of [...G.inv.items]) if (it.qid === id) G.inv.items.splice(G.inv.items.indexOf(it), 1);
    } else {
        for (const r of q.req) takeAny(G, r.t, r.lv || 0, r.n, !!r.lv);
    }
    for (const it of q.reward.items || []) addItems(G, it.t, it.lv || 0, it.n || 1);
    G.gold += q.reward.gold;
    G.stats.earned += q.reward.gold;
    G.stats.questGold += q.reward.gold;
    gainXp(G, q.reward.xp);
    repUp(G, q.turn, q.reward.rep ?? 1);
    if (q.turn !== q.town) repUp(G, q.town, q.reward.rep ?? 1);
    delete G.q.active[id];
    G.q.done[id] = G.day;
    G.stats.quests++;
    if (q.call) G.heroCall = G.day;
    log(G, `Quest complete: ${q.title} (+${q.reward.gold}g)`, 'good');
    emit(G, { type: 'quest-done', id, gold: q.reward.gold, xp: q.reward.xp });
    if (STORY_TEXT[id]) dialog(G, id + ':done', STORY_TEXT[id].done);
    return { ok: true, msg: `Complete: ${q.title} +${q.reward.gold}g` };
}

// ---------------------------------------------------------------- notice boards
function randTown(G, from, maxDays) {
    // a destination reachable within maxDays by road, not the same town
    const seen = { [from]: 0 };
    const q = [from];
    while (q.length) {
        const c = q.shift();
        for (const n of NEIGHBORS[c]) {
            const d = seen[c] + n.days;
            if (d <= maxDays && (seen[n.to] === undefined || d < seen[n.to])) { seen[n.to] = d; q.push(n.to); }
        }
    }
    delete seen[from];
    const ids = Object.keys(seen).filter((id) => TOWN[id].region <= TOWN[from].region + 1);
    if (!ids.length) return null;
    const to = ids[Math.floor(G.rng() * ids.length)];
    return { to, days: seen[to] };
}
function genQuest(G, townId) {
    const town = TOWN[townId], R = town.region;
    const id = 'g' + G.nextQ++;
    const [giver] = town.npcs[Math.floor(G.rng() * town.npcs.length)];
    const roll = G.rng();
    const base = { id, gen: true, town: townId, turn: townId, giver, lv: 0, reward: { gold: 0, xp: 0, rep: 1, items: [] }, story: false };
    if (roll < 0.5) {
        const pool = GENERIC_FETCH.filter((m) => matGrade(m.id) <= R && m.price * 4 <= 700 * R);
        const m = pool[Math.floor(G.rng() * pool.length)];
        const V = (70 + 90 * R) * (0.8 + G.rng() * 0.7);
        const n = Math.max(2, Math.min(24, Math.round(V / m.price)));
        const gold = Math.round((n * m.price * (1.5 + G.rng() * 0.35)) / 5) * 5 + 10 * R;
        return { ...base, kind: 'fetch', title: `Wanted: ${n} ${m.name}`, text: `${giver} is short on ${m.name} and will pay well for ${n} of them.`, req: [{ t: m.id, n }], reward: { gold, xp: Math.round(gold * 0.5), rep: 1, items: [] }, deadline: G.day + 12 + Math.floor(G.rng() * 12) };
    }
    if (roll < 0.8) {
        const gm = gearMax(townId);
        const fam = SLOT_ORDER[Math.floor(G.rng() * SLOT_ORDER.length)];
        const lv = Math.max(1, Math.min(10, gm + Math.floor(G.rng() * 3) - 1));
        const gold = Math.round((basePrice(fam, lv) * (1.55 + G.rng() * 0.3)) / 5) * 5;
        return { ...base, kind: 'craft', title: `Commission: ${itemName(fam, lv)}`, text: `${giver} wants a ${FAMS[fam].name.toLowerCase()} of at least level ${lv}, the sort a good smith or tailor could make.`, req: [{ t: fam, n: 1, lv }], reward: { gold, xp: Math.round(gold * 0.6), rep: 1, items: [] }, deadline: G.day + 18 + Math.floor(G.rng() * 12) };
    }
    const d = randTown(G, townId, 6);
    if (!d) return genQuest(G, townId);
    const gold = Math.round(((30 + 14 * R) * d.days * (1.2 + G.rng() * 0.4)) / 5) * 5;
    return { ...base, kind: 'courier', turn: d.to, to: d.to, title: `Courier to ${TOWN[d.to].name}`, text: `${giver} needs a sealed parcel carried to ${TOWN[d.to].name}. It takes one cell of your wagon until you deliver it.`, req: [], reward: { gold, xp: Math.round(gold * 0.5), rep: 1, items: [] }, deadline: G.day + d.days * 2 + 8 };
}
export function refreshBoard(G, townId) {
    const T = G.towns[townId];
    T.board = T.board.filter((id) => G.gen[id] && G.day <= G.gen[id].deadline && !G.q.active[id]);
    while (T.board.length < 3) { const q = genQuest(G, townId); G.gen[q.id] = q; T.board.push(q.id); }
}
export function expireQuests(G) {
    for (const id of Object.keys(G.q.active)) {
        const q = G.gen[id];
        if (q && G.day > q.deadline) {
            delete G.q.active[id];
            if (q.kind === 'courier') for (const it of [...G.inv.items]) if (it.qid === id) G.inv.items.splice(G.inv.items.indexOf(it), 1);
            repUp(G, q.town, -1);
            log(G, `Quest expired: ${q.title}`, 'bad');
            emit(G, { type: 'quest-expired', id });
        }
    }
    for (const id of Object.keys(G.gen)) if (G.day > G.gen[id].deadline + 30 && !G.q.active[id]) delete G.gen[id];
}

// ---------------------------------------------------------------- visiting heroes
export function spawnHero(G, townId) {
    const R = TOWN[townId].region;
    const classes = Object.keys(HERO_CLASSES);
    const cls = classes[Math.floor(G.rng() * classes.length)];
    const C = HERO_CLASSES[cls];
    const n = 1 + Math.floor(G.rng() * 2.4);
    const wants = [];
    for (let i = 0; i < n; i++) {
        const fam = C.fams[Math.floor(G.rng() * C.fams.length)];
        const minLv = Math.max(1, Math.min(10, Math.round(R * 1.8 - 1 + (G.rng() * 3 - 1))));
        wants.push({ fam, minLv, done: false });
    }
    const name = HERO_NAMES[Math.floor(G.rng() * HERO_NAMES.length)] + ' ' + HERO_TITLES[Math.floor(G.rng() * HERO_TITLES.length)];
    const h = { id: G.nextHid++, name, cls, look: Math.floor(G.rng() * 8), wants, until: G.day + 4 + Math.floor(G.rng() * 5), mult: 1.4 + G.rng() * 0.5 };
    G.towns[townId].heroes.push(h);
    emit(G, { type: 'hero-arrive', town: townId, id: h.id });
    return h;
}
export function heroOffer(h, w, lv) {
    const L = Math.min(lv, w.minLv + 3);
    return Math.round(basePrice(w.fam, L) * h.mult);
}
export function updateHeroes(G) {
    for (const town of Object.keys(G.towns)) {
        const T = G.towns[town];
        T.heroes = T.heroes.filter((h) => h.until >= G.day && h.wants.some((w) => !w.done));
        if (T.heroes.length < 1 && G.rng() < 0.12) spawnHero(G, town);
    }
}
/** Sell a piece of gear to a visiting hero. itemId picks a specific instance (else the lowest that qualifies). */
export function serveHero(G, hid, wi, itemId = 0) {
    const T = G.towns[G.loc];
    const h = T.heroes.find((x) => x.id === hid);
    if (!h) return { ok: false, msg: 'That hero has moved on.' };
    const w = h.wants[wi];
    if (!w || w.done) return { ok: false, msg: 'Nothing to deliver.' };
    let it = itemId ? itemById(G, itemId) : null;
    if (!it) {
        const cand = G.inv.items.filter((x) => x.t === w.fam && x.lv >= w.minLv && !x.fav).sort((a, b) => a.lv - b.lv);
        it = cand[0] || null;
    }
    if (!it || it.t !== w.fam || it.lv < w.minLv) return { ok: false, msg: `You need a ${FAMS[w.fam].name.toLowerCase()} of level ${w.minLv} or better in the wagon.` };
    const pay = heroOffer(h, w, it.lv);
    const lv = it.lv;
    removeItems(G, w.fam, lv, 1);
    w.done = true;
    G.gold += pay;
    G.stats.earned += pay;
    G.stats.heroGold += pay;
    G.stats.heroes++;
    gainXp(G, pay * 0.12 + 6);
    repUp(G, G.loc, 1);
    log(G, `Sold ${itemName(w.fam, lv)} to ${h.name} for ${pay}g`, 'good');
    emit(G, { type: 'hero-sale', hid, gold: pay, town: G.loc });
    if (h.wants.every((x) => x.done)) {
        const gift = G.rng() < 0.5 ? { t: ['greenleaf', 'quartz', 'amber', 'moonstone', 'honey'][Math.floor(G.rng() * 5)], n: 2 } : null;
        if (gift) { addItems(G, gift.t, 0, gift.n); log(G, `${h.name} leaves you ${gift.n} ${MATS[gift.t].name} as thanks.`, 'good'); }
        h.until = G.day;
    }
    return { ok: true, msg: `${h.name} paid ${pay}g`, gold: pay };
}
