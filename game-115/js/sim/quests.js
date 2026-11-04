// Expeditions: the board, sending parties out, and working out how they got on.

import { HERO_SHARE } from '../config.js';
import { ITEMS } from './data/items.js';
import { REGIONS, QUEST_TEMPLATES, BOSS } from './data/quests.js';
import { stat } from './data/buildings.js';
import {
    clamp, nextId, push, toast, note, stock, takeItem, addItem, earn, bestLv, hById, dayOf, hallLv, count,
} from './core.js';
import { guildLv, heroPower, heroStats, heroTrait, giveXp, buffPct, sendAway, returnFromQuest } from './heroes.js';
import { QUALITY } from './heroes.js';
import { addRenown } from './journal.js';

export function boardSize(G) {
    const gl = guildLv(G);
    return gl ? stat('guild', gl, 'board') + G.mods.board : 0;
}

export function questTimeMul(G) {
    const st = bestLv(G, 'stables');
    return (1 - G.mods.questTime) * (1 - (st ? stat('stables', st, 'questTime') : 0));
}

function makeQuest(G, tpl) {
    const rng = G.rng;
    const need = Math.round(rng.range(tpl.need[0], tpl.need[1]));
    const t = (rng() * 0.0 + (need - tpl.need[0]) / Math.max(1, tpl.need[1] - tpl.need[0]));
    return {
        id: nextId(G), tpl: tpl.id, region: tpl.region, kind: tpl.kind, name: tpl.name, text: tpl.text, need,
        dur: Math.round(rng.range(tpl.dur[0], tpl.dur[1]) * questTimeMul(G) * REGIONS[tpl.region].dist * 0.8),
        slots: tpl.slots, gold: Math.round(rng.range(tpl.gold[0], tpl.gold[1]) * 1.25 * (1 + G.mods.questGold)),
        xp: Math.round(14 + need * 0.5), renown: tpl.renown || 0, req: tpl.req || null, drops: tpl.drops,
        exp: G.day + 2, pid: 0, hardness: t,
    };
}

export function refreshBoard(G) {
    const gl = guildLv(G);
    if (!gl) { G.board = []; return; }
    G.board = G.board.filter((q) => q.pid || q.exp >= G.day || q.kind === 'boss');
    const size = boardSize(G);
    const avail = QUEST_TEMPLATES.filter((t) => REGIONS[t.region].guild <= gl);
    let guard = 0;
    while (G.board.filter((q) => !q.pid && q.kind !== 'boss').length < size && guard++ < 40) {
        // favour the newest regions a little, so a growing guild sees new places
        const pool = avail.filter((t) => !G.board.some((q) => q.tpl === t.id));
        const src = pool.length ? pool : avail;
        const maxG = Math.max(...src.map((t) => REGIONS[t.region].guild));
        const weighted = src.flatMap((t) => (REGIONS[t.region].guild >= maxG - 1 ? [t, t] : [t]));
        G.board.push(makeQuest(G, G.rng.pick(weighted)));
    }
    if (hallLv(G) >= 6 && gl >= 5 && !G.flags.won && !G.board.some((q) => q.kind === 'boss')) {
        G.board.push({ ...BOSS, id: nextId(G), tpl: BOSS.id, xp: 600, pid: 0, exp: 1e9, dur: Math.round(BOSS.dur * questTimeMul(G)), hardness: 1 });
    }
}

// ---------------------------------------------------------------- odds
export function partyPower(G, heroes) {
    let p = 0;
    for (const h of heroes) p += heroPower(G, h);
    return p;
}
export function partyChance(G, heroes, quest) {
    const power = partyPower(G, heroes);
    const r = power / Math.max(1, quest.need);
    let c = clamp((r - 0.5) / 0.7, 0.03, 0.97);
    let bonus = 0;
    for (const h of heroes) {
        for (const id of h.pots) bonus += ITEMS[id].power * (1 + G.mods.potionMul);
        bonus += buffPct(h, 'luck') / 100 * 0.25;
        if (h.cls === 'cleric') bonus += 0.04;
    }
    c = clamp(c + Math.min(0.25, bonus), 0.03, 0.98);
    return { power, ratio: r, chance: c };
}

export function readyHeroes(G) {
    return G.heroes.filter((h) => h.st === 'idle' && h.hp >= heroStats(G, h).hpMax * 0.7 && h.hunger >= 35 && h.energy >= 32 && !h.pid);
}

// ---------------------------------------------------------------- sending out
export function dispatch(G, qid, heroIds) {
    const q = G.board.find((x) => x.id === qid);
    if (!q || q.pid) return { ok: false, why: 'That job is gone.' };
    const heroes = heroIds.map((id) => hById(G, id)).filter(Boolean);
    if (!heroes.length) return { ok: false, why: 'Pick at least one hero.' };
    if (heroes.length > q.slots) return { ok: false, why: `This job takes up to ${q.slots}.` };
    for (const h of heroes) if (h.st !== 'idle' || h.pid) return { ok: false, why: `${h.name} is busy.` };
    if (q.req) for (const k in q.req) if (stock(G, k) < q.req[k]) return { ok: false, why: `Needs ${q.req[k]}× ${ITEMS[k].name} in storage.` };
    if (q.req) for (const k in q.req) takeItem(G, k, q.req[k]);
    const p = { id: nextId(G), qid: q.id, q, heroes: heroes.map((h) => h.id), t: q.dur, dur: q.dur, chance: partyChance(G, heroes, q).chance };
    G.parties.push(p);
    q.pid = p.id;
    for (const h of heroes) { h.pid = p.id; sendAway(G, h); }
    push(G, { type: 'questStart', pid: p.id, name: q.name });
    return { ok: true, pid: p.id };
}

export function recall(G, pid) {
    const p = G.parties.find((x) => x.id === pid);
    if (!p) return { ok: false, why: 'No such party.' };
    if (p.q.kind === 'boss') return { ok: false, why: 'There is no turning back from the Roost.' };
    G.parties = G.parties.filter((x) => x !== p);
    const q = G.board.find((x) => x.id === p.qid);
    if (q) q.pid = 0;
    if (q && q.req) for (const k in q.req) addItem(G, k, q.req[k]);
    for (const id of p.heroes) { const h = hById(G, id); if (h) returnFromQuest(G, h); }
    return { ok: true };
}

// ---------------------------------------------------------------- the auto planner
/** Idle heroes on "auto" take the best job they can do. Runs every few seconds. */
export function autoDispatch(G) {
    const ready = readyHeroes(G).filter((h) => h.auto);
    if (!ready.length) return;
    const open = G.board.filter((q) => !q.pid && q.kind !== 'boss');
    // the richest jobs first, each given to the weakest party that can do it
    const worth = (q) => q.gold + q.renown * 30 + q.drops.reduce((s, d) => s + d.chance * ((d.n[0] + d.n[1]) / 2) * ITEMS[d.item].value, 0);
    open.sort((a, b) => worth(b) - worth(a));
    const pool = ready.slice().sort((a, b) => heroPower(G, b) - heroPower(G, a));
    for (const q of open) {
        if (!pool.length) break;
        if (q.req && Object.keys(q.req).some((k) => stock(G, k) < q.req[k])) continue;
        // build the party from the strongest down until the odds are fair
        let party = null;
        for (let n = 1; n <= Math.min(q.slots, pool.length); n++) {
            // the weakest n heroes that could do it, preferring to keep the strongest free
            const tryParty = pool.slice(pool.length - n);
            const alt = pool.slice(0, n);
            for (const cand of [tryParty, alt]) {
                if (partyChance(G, cand, q).chance >= 0.62) { party = cand; break; }
            }
            if (party) break;
        }
        if (!party) continue;
        const r = dispatch(G, q.id, party.map((h) => h.id));
        if (r.ok) for (const h of party) pool.splice(pool.indexOf(h), 1);
    }
}

// ---------------------------------------------------------------- results
export function tickParties(G, dt) {
    for (const p of G.parties.slice()) {
        p.t -= dt;
        if (p.t <= 0) resolveParty(G, p);
    }
}

function resolveParty(G, p) {
    const q = p.q;
    const heroes = p.heroes.map((id) => hById(G, id)).filter(Boolean);
    G.parties = G.parties.filter((x) => x !== p);
    G.board = G.board.filter((x) => x.id !== q.id);
    if (!heroes.length) return;
    const { chance } = partyChance(G, heroes, q);
    const u = G.rng();
    const outcome = u < chance ? 'win' : u < chance + (1 - chance) * 0.35 ? 'part' : 'fail';
    const lootMul = outcome === 'win' ? 1 : outcome === 'part' ? 0.5 : 0;
    const luck = heroes.reduce((s, h) => s + heroStats(G, h).luck, 0) / heroes.length;
    const luckyPot = heroes.reduce((s, h) => s + h.pots.reduce((a, id) => a + (ITEMS[id].loot || 0), 0), 0);
    const lootChance = 1 + luck / 160 + luckyPot + heroes.reduce((s, h) => s + buffPct(h, 'luck'), 0) / 100 / heroes.length;

    // loot
    const loot = {};
    let gold = Math.round(q.gold * lootMul);
    if (outcome !== 'fail') {
        for (const d of q.drops) {
            if (G.rng() < Math.min(1, d.chance * lootChance * (outcome === 'win' ? 1 : 0.6))) {
                const n = G.rng.int(d.n[0], d.n[1]);
                loot[d.item] = (loot[d.item] || 0) + n;
            }
        }
    }
    const kept = {};
    for (const k in loot) {
        const got = addItem(G, k, loot[k]);
        kept[k] = got;
        if (got < loot[k]) gold += Math.round((loot[k] - got) * ITEMS[k].value * 0.5);
    }
    // gold: heroes keep their share, the rest is the town's
    const keepFrac = clamp(HERO_SHARE + heroes.reduce((s, h) => s + (heroTrait(h).goldKeep || 0), 0) / heroes.length, 0.3, 0.9);
    const heroGold = Math.round(gold * keepFrac);
    for (const h of heroes) { const g = Math.round(heroGold / heroes.length); h.gold += g; h.earned += g; }
    earn(G, gold - heroGold);
    G.stats.questGold += gold - heroGold;

    // wear and tear
    const healer = heroes.some((h) => h.cls === 'cleric') ? 0.7 : 1;
    const baseLoss = outcome === 'win' ? 0.06 + 0.3 * (1 - chance) * G.rng() : outcome === 'part' ? 0.3 + 0.2 * G.rng() : 0.55 + 0.2 * G.rng();
    const xp = q.xp * (outcome === 'win' ? 1 : outcome === 'part' ? 0.55 : 0.25);
    for (const h of heroes) {
        const mx = heroStats(G, h).hpMax;
        h.hp = Math.max(1, Math.round(h.hp - mx * baseLoss * healer));
        h.pots = [];
        h.buffs = h.buffs.map((b) => ({ ...b, q: b.q - 1 })).filter((b) => b.q > 0);
        h.quests++;
        h.mood = clamp(h.mood + (outcome === 'win' ? 6 : outcome === 'part' ? 0 : -10), 0, 100);
        giveXp(G, h, xp);
        returnFromQuest(G, h);
    }
    const s = G.stats;
    if (outcome === 'win') {
        s.questsDone++;
        s.regionDone[q.region] = (s.regionDone[q.region] || 0) + 1;
        if (q.renown) addRenown(G, q.renown);
        if (q.kind === 'boss') { s.bossDown = true; G.flags.won = true; push(G, { type: 'won' }); }
    } else if (outcome === 'part') { s.questsPart++; if (q.renown) addRenown(G, Math.ceil(q.renown / 2)); }
    else s.questsFailed++;
    push(G, { type: 'questDone', pid: p.id, outcome, name: q.name, gold, loot: kept, heroes: p.heroes, region: q.region });
    const names = heroes.map((h) => h.name).join(', ');
    const verdict = outcome === 'win' ? 'succeeded' : outcome === 'part' ? 'scraped through' : 'was beaten back';
    toast(G, `${names} ${verdict}: ${q.name}.`, outcome === 'fail' ? 'bad' : 'good');
    note(G, `${names} ${verdict} at ${q.name}.`);
}
