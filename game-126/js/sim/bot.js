// EMBERSPIRE — a bot that plays the whole game through act(), the same commands the UI sends.
// Used by the tests (can the game be climbed? where does it stall?), the balance table, and nothing else.
// Pure, like the rest of js/sim.
//
// diligence in [0, 1]: how much of the town it bothers with. 1 upgrades, learns, recruits, bonds and shops every day;
// 0 just climbs with what it has.

import { PARTY_MAX, EVOLVE_LV, ASCEND_LV } from '../config.js';
import { HERO, CLASSES } from './data/heroes.js';
import { GOODS } from './data/items.js';
import { SCENES } from './data/story.js';
import {
    act, joined, checkpoints, recruitable, recruitCost, skillList, upgradeCost, maxPlus, reforgeCost, equippedBy,
    canEquip, slotOf, shardPrice, boardQuests, questProgress, partyHealth, gearPrice, autoResolve, power,
} from './game.js';
import { gearStats } from './stats.js';

export function makeBot({ diligence = 1, retreatAt = 0.4 } = {}) {
    return { diligence, retreatAt, day: 0 };
}

const HEALERS = ['cleric', 'saint', 'oracle', 'alchemist', 'apothecary', 'bombardier', 'bard', 'maestro', 'skald'];

/** A rough value of a gear item for a hero: its stat lines weighted by what the class uses. */
function gearValue(G, id, it) {
    if (!it) return 0;
    const c = CLASSES[G.heroes[id].cls];
    const magic = c.g[3] > c.g[2];
    const s = gearStats(it).flat;
    const v = (s.atk || 0) * (magic ? 0.4 : 1.2) + (s.mag || 0) * (magic ? 1.2 : 0.3) + (s.def || 0) * 0.8 + (s.res || 0) * 0.7 + (s.hp || 0) / 5 + (s.spd || 0) * 2 + (s.crit || 0) * 1.5 + (s.mp || 0) * 0.2;
    return v * (1 + 0.04 * (it.aff || []).length) * (it.u ? 1.3 : 1);
}

function bestParty(G) {
    const js = joined(G).sort((a, b) => power(G, b) - power(G, a));
    const party = js.slice(0, PARTY_MAX);
    // keep a healer if we have one
    if (!party.some((id) => HEALERS.includes(G.heroes[id].cls))) {
        const healer = js.find((id) => HEALERS.includes(G.heroes[id].cls));
        if (healer) party[party.length - 1 < PARTY_MAX - 1 ? party.length : PARTY_MAX - 1] = healer;
    }
    return [...new Set(party)];
}

function townDay(G, bot, day) {
    const d = bot.diligence;
    act(G, { t: 'daily', day });
    act(G, { t: 'collect' });
    for (const q of boardQuests(G)) if (questProgress(G, q).done) act(G, { t: 'claim', id: q.id });
    // recruit: the cheapest available, keep a little gold for upkeep
    if (d > 0.3) {
        for (const h of recruitable(G).sort((a, b) => a.recruit - b.recruit)) {
            if (G.gold >= recruitCost(G, h.id) * 1.2) act(G, { t: 'recruit', id: h.id });
        }
    }
    // temple: evolve, ascend, learn
    for (const id of joined(G)) {
        const h = G.heroes[id];
        if (h.tier === 1 && h.lv >= EVOLVE_LV) act(G, { t: 'evolve', id, cls: CLASSES[h.cls].evo[(id.length + day.length) % 2] });
        if (h.tier === 2 && h.lv >= ASCEND_LV) act(G, { t: 'ascend', id });
        if (d > 0.3) {
            for (let guard = 0; guard < 20; guard++) {
                const list = skillList(G, id).filter((s) => s.can).sort((a, b) => (a.rank - b.rank) || (b.lv - a.lv));
                if (!list.length || !act(G, { t: 'learn', id, skill: list[0].id })) break;
            }
        }
    }
    // party and errands
    if (d > 0.3) act(G, { t: 'party', ids: bestParty(G) });
    for (const id of joined(G)) if (!G.party.includes(id)) act(G, { t: 'errand', id, on: true });
    // equip the best piece in every slot
    for (const id of G.party) {
        for (const it of Object.values(G.gear)) {
            if (it.shop || !canEquip(G, id, it)) continue;
            const slot = slotOf(it);
            const cur = G.gear[G.heroes[id].eq[slot]];
            const owner = equippedBy(G, it.uid);
            if (owner && owner.id !== id && G.party.includes(owner.id)) continue;
            if (gearValue(G, id, it) > gearValue(G, id, cur) * 1.02) act(G, { t: 'equip', id, uid: it.uid });
        }
    }
    // shop: consumables first
    const want = { potion: 6, ether: 3, phoenix: 2, hipotion: G.best >= 10 ? 4 : 0, antidote: 2 };
    for (const [k, n] of Object.entries(want)) {
        const g = GOODS[k];
        if (g.minFloor && G.best < g.minFloor) continue;
        while ((G.inv[k] || 0) < n && G.gold > g.price * 3) if (!act(G, { t: 'buy', id: k })) break;
    }
    if (d > 0.5) {
        // reforge lagging gear, then upgrade, weapons first
        for (const id of G.party) for (const slot of ['weapon', 'armor', 'acc']) {
            const it = G.gear[G.heroes[id].eq[slot]];
            if (!it) continue;
            const rc = reforgeCost(G, it);
            if (rc.to - it.lvl >= 8 && G.gold > rc.gold * 2) act(G, { t: 'reforge', uid: it.uid });
        }
        for (let pass = 0; pass < 12; pass++) {
            let any = false;
            for (const slot of ['weapon', 'armor', 'acc']) for (const id of G.party) {
                const it = G.gear[G.heroes[id].eq[slot]];
                if (!it || it.plus >= maxPlus(it)) continue;
                const c = upgradeCost(G, it);
                if (G.gold > c.gold * 1.5 && act(G, { t: 'upgrade', uid: it.uid })) any = true;
            }
            if (!any) break;
        }
        // shop gear that beats what someone wears
        for (const uid of G.shop.gear.slice()) {
            const it = G.gear[uid];
            for (const id of G.party) {
                if (!canEquip(G, id, it)) continue;
                const cur = G.gear[G.heroes[id].eq[slotOf(it)]];
                if (gearValue(G, id, it) > gearValue(G, id, cur) * 1.25 && G.gold > gearPrice(it) * 2) {
                    if (act(G, { t: 'buyGear', uid })) { act(G, { t: 'equip', id, uid }); break; }
                }
            }
        }
        while (G.gold > shardPrice(G) * 4 && act(G, { t: 'buyShard' }));
        // cores buy epic weapons
        while (G.inv.core >= 3) { const id = G.party[G.rng ? 0 : 0]; if (!act(G, { t: 'coreTrade', type: CLASSES[CLASSES[G.heroes[id].cls].from || G.heroes[id].cls].weapon })) break; }
        // salvage what nobody wears and is worse than what they wear
        for (const it of Object.values(G.gear)) {
            if (it.shop || it.u || equippedBy(G, it.uid)) continue;
            act(G, { t: 'salvage', uid: it.uid });
        }
    }
}

/** One climb: start at the highest checkpoint and go until it's wise to turn back (or defeat). */
function climb(G, bot, maxFloors = 60) {
    const cps = checkpoints(G);
    const start = cps[cps.length - 1];
    if (!act(G, { t: 'enter', floor: start })) return { floors: 0, lost: false };
    let floors = 0, lost = false;
    for (let i = 0; i < maxFloors; i++) {
        const res = autoResolve(G);
        G.events.length = 0;
        if (res === 'lost') { lost = true; break; }
        if (res === 'fled') { act(G, { t: 'next' }); continue; }
        floors++;
        const ph = partyHealth(G);
        // turn back when hurt, unless a boss was just beaten (the floor's rest is generous)
        if ((ph.dead > 0 || ph.ratio < bot.retreatAt) && G.battle.rank === 'normal') break;
        if (G.battle.floor % 10 === 9 && ph.ratio < 0.7) break;     // don't walk into a boss half dead
        act(G, { t: 'next' });
    }
    act(G, { t: 'leave' });
    G.events.length = 0;
    return { floors, lost };
}

function evening(G, bot) {
    if (bot.diligence <= 0.3) return;
    const cands = joined(G).filter((id) => !HERO[id].hero).sort((a, b) => (G.heroes[b].bond - G.heroes[b].bondLv * 100) - (G.heroes[a].bond - G.heroes[a].bondLv * 100));
    if (!cands.length) return;
    if (!act(G, { t: 'evening', id: cands[0] })) return;
    if (G.scene?.kind === 'rank') {
        const ch = SCENES[G.scene.id][G.scene.idx].choices;
        const good = ch.findIndex((c) => c[1]);
        act(G, { t: 'choose', i: bot.diligence >= 0.9 ? good : 0 });
    }
    act(G, { t: 'choose', i: 0 });
}

/** Play one in-game day: town, a climb, the evening, rest. day is the calendar date string for the daily bonus. */
export function playDay(G, bot, day, wallMs) {
    if (wallMs != null) act(G, { t: 'idle', now: wallMs });
    townDay(G, bot, day);
    const r = climb(G, bot);
    G.events.length = 0;
    if (wallMs != null) act(G, { t: 'idle', now: wallMs + 4 * 3600e3 });
    evening(G, bot);
    act(G, { t: 'rest' });
    G.events.length = 0;
    bot.day++;
    return r;
}

/** Calendar day string n days after 2026-01-01 (no clock involved). */
export function dayString(n) {
    const d = new Date(Date.UTC(2026, 0, 1) + n * 86400000);
    return d.toISOString().slice(0, 10);
}
