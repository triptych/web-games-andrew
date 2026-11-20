// Conditions, party stats, inventory and quests: the small rules everything else leans on. Pure.

import { PARTY } from './data/party.js';
import { ITEMS } from './data/items.js';
import { QUESTS } from './data/quests.js';
import { GROWTH, MAX_LEVEL, xpToNext } from '../config.js';

// ------------------------------------------------------------------ conditions

/** 'ch>=2&!party:orin|f:x' : | separates alternatives, & joins terms, ! negates a term. Empty is true. */
export function cond(G, str) {
    if (!str) return true;
    return str.split('|').some((alt) => alt.split('&').every((term) => {
        const neg = term.startsWith('!');
        const t = neg ? term.slice(1) : term;
        const v = test(G, t);
        return neg ? !v : v;
    }));
}

function test(G, t) {
    if (t.startsWith('ch>=')) return G.chapter >= +t.slice(4);
    const [k, a, b] = t.split(':');
    switch (k) {
        case 'q': return G.quests[a]?.s === 'active';
        case 'qd': return G.quests[a]?.s === 'done';
        case 'qok': return G.quests[a]?.s === 'active' && questProgress(G, a).every((o) => o.ok);
        case 'f': return !!G.flags[a];
        case 'has': return (G.inv[a] || 0) >= (+b || 1);
        case 'party': return G.party.includes(a);
        case 'done': return !!G.done[a];
        default: throw new Error('unknown condition ' + t);
    }
}

// ------------------------------------------------------------------ party

export function stats(G, id) {
    const d = PARTY[id];
    const lv = G.level - 1;
    const s = {
        mhp: Math.round(d.hp * (1 + GROWTH.hp * lv)),
        mmp: Math.round(d.mp * (1 + GROWTH.mp * lv)),
        atk: Math.round(d.atk * (1 + GROWTH.atk * lv)),
        def: Math.round(d.def * (1 + GROWTH.def * lv)),
        spd: Math.round(d.spd * (1 + GROWTH.spd * lv)),
    };
    for (const slot of ['weapon', 'armor']) {
        const it = ITEMS[G.equip[id]?.[slot]];
        if (!it) continue;
        for (const [k, v] of Object.entries(it.stats)) {
            if (k === 'mp') s.mmp += v; else if (k === 'hp') s.mhp += v; else s[k] += v;
        }
    }
    s.spd = Math.max(1, s.spd);
    return s;
}

export const abilitiesOf = (G, id) => PARTY[id].abilities.filter((a) => (a.lv || 1) <= G.level);

export function clampVitals(G) {
    for (const id of G.party) {
        const s = stats(G, id);
        G.hp[id] = Math.max(0, Math.min(s.mhp, G.hp[id] ?? s.mhp));
        G.mp[id] = Math.max(0, Math.min(s.mmp, G.mp[id] ?? s.mmp));
    }
}

export function healAll(G) {
    for (const id of G.party) { const s = stats(G, id); G.hp[id] = s.mhp; G.mp[id] = s.mmp; }
}

export function addXp(G, n) {
    G.xp += n;
    let ups = 0;
    while (G.level < MAX_LEVEL && G.xp >= xpToNext(G.level)) {
        const before = Object.fromEntries(G.party.map((id) => [id, stats(G, id)]));
        G.xp -= xpToNext(G.level);
        G.level++;
        ups++;
        for (const id of G.party) {
            const a = before[id], b = stats(G, id);
            if (G.hp[id] > 0) G.hp[id] += b.mhp - a.mhp;
            G.mp[id] += b.mmp - a.mmp;
        }
        const learned = [];
        for (const id of G.party) for (const ab of PARTY[id].abilities) if (ab.lv === G.level) learned.push({ who: id, name: ab.name });
        G.events.push({ type: 'levelup', level: G.level, learned });
    }
    if (G.level >= MAX_LEVEL) G.xp = 0;
    clampVitals(G);
    return ups;
}

// ------------------------------------------------------------------ inventory

export function give(G, items) {
    for (const [id, n] of Object.entries(items || {})) {
        if (!ITEMS[id]) throw new Error('unknown item ' + id);
        G.inv[id] = (G.inv[id] || 0) + n;
        G.events.push({ type: 'item', id, n });
    }
    checkQuests(G);
}

export function take(G, items) {
    for (const [id, n] of Object.entries(items || {})) {
        G.inv[id] = (G.inv[id] || 0) - n;
        if (G.inv[id] <= 0) delete G.inv[id];
    }
}

// ------------------------------------------------------------------ quests

export function giveQuest(G, id) {
    if (!QUESTS[id]) throw new Error('unknown quest ' + id);
    if (G.quests[id]) return;
    G.quests[id] = { s: 'active', kills: { ...G.kills } };
    G.events.push({ type: 'quest', id });
    checkQuests(G);
}

/** The objectives of a quest with live progress: [{ label, have, need, ok }]. */
export function questProgress(G, id) {
    const q = QUESTS[id], st = G.quests[id];
    return q.objectives.map((o) => {
        let have = 0, need = 1;
        if (o.t === 'kill') { need = o.n; have = (G.kills[o.id] || 0) - (st?.kills?.[o.id] || 0); }
        else if (o.t === 'have') { need = o.n; have = G.inv[o.id] || 0; }
        else if (o.t === 'flag') have = G.flags[o.id] ? 1 : 0;
        else if (o.t === 'flags') { need = o.ids.length; have = o.ids.filter((f) => G.flags[f]).length; }
        else if (o.t === 'visit') have = G.visited[o.id] ? 1 : 0;
        if (st?.s === 'done') have = need;
        have = Math.max(0, Math.min(have, need));
        return { label: o.label, have, need, ok: have >= need, count: need > 1 };
    });
}

export function completeQuest(G, id) {
    const st = G.quests[id];
    if (!st || st.s === 'done') return;
    st.s = 'done';
    const r = QUESTS[id].reward;
    G.gold += r.gold || 0;
    G.events.push({ type: 'questDone', id, reward: r });
    if (r.xp) addXp(G, r.xp);
    if (r.items) give(G, r.items);
}

/** Auto quests complete the moment every objective holds. */
export function checkQuests(G) {
    for (const [id, st] of Object.entries(G.quests)) {
        if (st.s !== 'active' || !QUESTS[id].auto) continue;
        if (questProgress(G, id).every((o) => o.ok)) completeQuest(G, id);
    }
}
