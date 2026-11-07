// An auto-player. It plays through act(), the same door the UI uses, so the tests, the balance
// table and the title-screen demo all exercise the real rules. Pure, like the rest of js/sim.
//
// It is a sensible player, not a perfect one: it follows the journal, builds in a good order,
// staffs, crafts for its heroes, stocks the shop, hires, researches and sends the boss party out.

import { BUILDINGS, costOf, reqHall, SKILLS } from './data/buildings.js';
import { ITEMS, RECIPES, WEAPON_TYPE, recipesFor } from './data/items.js';
import { UPGRADES, UPGRADE_IDS } from './data/upgrades.js';
import { JOURNAL_IDS } from './data/journal.js';
import { REGIONS } from './data/quests.js';
import { hallLv, stock, builtOf, bldsOf, capOf, count, bestLv, hall, has, shelfPrice } from './core.js';
import { findSpot, ownedAt } from './world.js';
import { act, buildInfo, missing, shelfCount, buildCost } from './commands.js';
import { constructions, builderCap } from './production.js';
import { heroCap, recruitFee, heroPower, heroStats, guildLv } from './heroes.js';
import { partyChance, readyHeroes } from './quests.js';
import { freeSlots, popCap } from './townsfolk.js';
import { HALL_POS } from '../config.js';

// What to build, in order. `crit` means: if this can't be afforded yet, save up for it first.
const ORDER = [
    ['woodshed', 1, true], ['quarry', 1, true], ['farm', 1], ['house', 1], ['market', 1], ['tavern', 1, true], ['guild', 1, true],
    ['storehouse', 1], ['house', 2], ['woodshed', 2], ['flowerbed', 2], ['lantern', 1], ['well', 1],
    ['carpenter', 1, true], ['mill', 1], ['inn', 1], ['itemshop', 1, true], ['herbgarden', 1], ['healer', 1], ['orchard', 1], ['dock', 1],
    ['house', 3], ['quarry', 2], ['farm', 2], ['storehouse', 2], ['bench', 1], ['lantern', 3],
    ['mine', 1, true], ['smithy', 1, true], ['loom', 1], ['henhouse', 1], ['apiary', 1], ['watchtower', 1], ['alchemist', 1],
    ['house', 4], ['storehouse', 3], ['mine', 2], ['house', 5], ['bench', 3], ['flowerbed', 5],
    ['library', 1], ['stables', 1], ['fountain', 1], ['woodshed', 3], ['house', 6], ['storehouse', 4], ['flowerbed', 8], ['lantern', 6],
    ['statue', 1],
];

// Upgrades worth buying, best first.
const RESEARCH = ['axes', 'picks', 'training', 'baskets', 'wagon', 'hands', 'rations', 'cozy', 'seeds', 'spices', 'charter', 'routes', 'beds', 'watch', 'boards', 'maps', 'songs', 'cellar', 'chef',
    'clock', 'lamps', 'guides', 'nets', 'hunters', 'foresters', 'builders', 'furnace', 'tools', 'husbandry', 'primer', 'tactics', 'assembly', 'silver', 'charterroyal'];

// Which buildings to level first, when there is money to spare.
const LEVEL_FIRST = ['woodshed', 'quarry', 'storehouse', 'farm', 'house', 'tavern', 'guild', 'carpenter', 'inn', 'itemshop', 'mine', 'smithy', 'loom', 'orchard', 'dock', 'mill', 'alchemist', 'healer',
    'herbgarden', 'market', 'henhouse', 'apiary', 'watchtower', 'library', 'stables'];

export function makeBot({ skill = 1 } = {}) {
    return { skill, t: 0, tapT: 0, log: [] };
}

function tryAct(G, cmd) { return act(G, cmd); }

/** Called every simulation step; does its thinking about once a second. */
export function botStep(G, bot, dt) {
    bot.t -= dt;
    bot.tapT -= dt;
    if (bot.tapT <= 0) { bot.tapT = 0.5 / Math.max(0.3, bot.skill); tap(G, bot); }
    if (bot.t > 0) return;
    bot.t = 1 / Math.max(0.2, bot.skill);
    think(G, bot);
}

function think(G, bot) {
    for (const id of JOURNAL_IDS) if (G.journal[id] === 'ready') tryAct(G, { t: 'claim', id });
    for (const v of G.visitors.slice()) if (v.kind === 'villager' && G.villagers.length < popCap(G)) tryAct(G, { t: 'welcome', id: v.id, accept: true });
    bot.assignT = (bot.assignT || 0) - 1;
    if (bot.assignT <= 0) { bot.assignT = 20; tryAct(G, { t: 'autoAssign', all: true }); } else tryAct(G, { t: 'autoAssign' });
    const reserve = hallReserve(G);
    upgradeHall(G, bot);
    build(G, bot, reserve);
    levelUp(G, bot, reserve);
    craftPlan(G);
    stockShelves(G);
    hireHeroes(G, reserve);
    research(G, reserve);
    sellPlan(G);
    bossPlan(G);
    shop(G);
    gift(G);
    if (G.mods.autoWelcome === 0) G.opts.autoWelcome = false;
}

// ---------------------------------------------------------------- tapping
function tap(G, bot) {
    const day = G.day;
    if (day > 12 && G.stats.hits > 250) return;
    // tap whichever basic good is lowest compared with what it is needed for
    const want = [['tree', 'wood', 90], ['rock', 'stone', 55]];
    if (count(G, 'loom') || G.journal.herbs) want.push(['flax', 'fiber', 12]);
    if (count(G, 'tavern')) want.push(['bush', 'berry', 10]);
    if (count(G, 'alchemist') || count(G, 'tavern')) want.push(['herbp', 'herb', 10]);
    const hl = hall(G);
    const options = [];
    for (const [k, item, tgt] of want) {
        const r = stock(G, item) / tgt;
        if (r >= 1 || stock(G, item) >= capOf(G, item) - 2) continue;
        let node = null, bd = 99;
        for (const n of G.nodes) {
            if (n.k !== k || n.regrow > 0 || !ownedAt(G, n.x, n.y)) continue;
            const d = Math.hypot(n.x - hl.x, n.y - hl.y);
            if (d < bd) { bd = d; node = n; }
        }
        if (node) options.push({ r, node });
    }
    options.sort((a, b) => a.r - b.r);
    if (options.length) tryAct(G, { t: 'harvest', id: options[0].node.id });
}

// ---------------------------------------------------------------- building
function hallReserve(G) {
    const hl = hall(G);
    if (hl.bld) return {};
    const info = buildInfo(G, 'hall', hl.lv + 1);
    if (info.why && !info.why.startsWith('Needs ') ) return {};
    if (info.why && info.why.includes('renown')) return {};      // not close: do not freeze everything
    // only reserve once it is within reach: every material is mostly in store
    for (const k in info.cost) { if (k === 'gold') continue; if (stock(G, k) < info.cost[k] * 0.8) return {}; }
    return info.cost;
}
function afford(G, cost, reserve) {
    for (const k in cost) {
        const have = k === 'gold' ? G.gold : stock(G, k);
        if (have - cost[k] < (reserve[k] || 0)) return false;
    }
    return missing(G, cost).length === 0;
}

function upgradeHall(G, bot) {
    const hl = hall(G);
    if (hl.bld || constructions(G).length >= builderCap(G) + 1) return;
    const info = buildInfo(G, 'hall', hl.lv + 1);
    if (info.why) return;
    tryAct(G, { t: 'upgrade', id: hl.id });
}

function build(G, bot, reserve) {
    const hl = hall(G);
    const hlv = hallLv(G);
    const open = constructions(G).length;
    if (open >= builderCap(G) + 1) return;
    const have = {};
    for (const b of G.buildings) have[b.type] = (have[b.type] || 0) + 1;
    const seen = {};
    for (const [type, n, crit] of ORDER) {
        seen[type] = (seen[type] || 0);
        const target = n;
        if ((have[type] || 0) >= target) continue;
        const d = BUILDINGS[type];
        if (hlv < d.unlock) continue;
        if (type === 'storehouse' && !storageTight(G)) continue;
        const info = buildInfo(G, type, 1);
        const cost = buildCost(G, type, 1);
        const producer = d.kind === 'craft' || d.out;
        if (!afford(G, cost, producer ? {} : reserve)) { if (crit) break; continue; }
        const spot = type === 'dock' ? findSpot(G, type, 27, 16, 1, 30) : decor(type) ? findSpot(G, type, HALL_POS.x + 1.5, HALL_POS.y + 4.5, 0, 9) : findSpot(G, type, HALL_POS.x + 1.5, HALL_POS.y + 1.5 + (bot.skill ? 0 : 0), 1, 22);
        if (!spot) continue;
        const r = tryAct(G, { t: 'build', type, x: spot.x, y: spot.y });
        if (r.ok) { have[type] = (have[type] || 0) + 1; if (constructions(G).length >= builderCap(G) + 1) return; }
    }
}
const decor = (t) => BUILDINGS[t].kind === 'deco';

function storageTight(G) {
    for (const k of ['wood', 'stone']) if (stock(G, k) >= capOf(G, k) * 0.85) return true;
    return false;
}

const SAVE_FOR = ['guild', 'house', 'tavern', 'carpenter', 'smithy', 'itemshop', 'inn', 'loom'];
const PRODUCER = { steel: 'smithy', ingot: 'smithy', cloth: 'loom', plank: 'carpenter', lore: 'library', gem: 'mine', flour: 'mill' };
function bottleneckTypes(G) {
    const hl = hall(G);
    const info = buildInfo(G, 'hall', hl.lv + 1);
    const out = [];
    for (const k of missing(G, info.cost).map((s) => Object.keys(ITEMS).find((id) => s.endsWith(ITEMS[id].name)))) if (k && PRODUCER[k]) out.push(PRODUCER[k]);
    return out;
}
function levelUp(G, bot, reserve) {
    if (constructions(G).length >= builderCap(G) + 1) return;
    const cands = [];
    const urgent = bottleneckTypes(G);
    for (const b of G.buildings) {
        const d = BUILDINGS[b.type];
        if (b.type === 'hall' || b.lv < 1 || b.bld || b.lv >= d.maxLv || d.kind === 'deco') continue;
        const info = buildInfo(G, b.type, b.lv + 1);
        if (info.why) continue;
        const pri = LEVEL_FIRST.indexOf(b.type);
        cands.push({ b, cost: buildCost(G, b.type, b.lv + 1), score: (pri < 0 ? 30 : pri) * 10 + b.lv * 14 - (urgent.includes(b.type) ? 400 : 0) });
    }
    cands.sort((a, b) => a.score - b.score);
    let saved = 0;
    for (const c of cands) {
        const producer = BUILDINGS[c.b.type].kind === 'craft' || BUILDINGS[c.b.type].out;
        if (afford(G, c.cost, producer ? {} : reserve)) { if (tryAct(G, { t: 'upgrade', id: c.b.id }).ok) return; }
        else if (SAVE_FOR.includes(c.b.type) && ++saved >= 2) break;
    }
}

// ---------------------------------------------------------------- crafting
function craftPlan(G) {
    const hlv = hallLv(G);
    // processors: keep what building needs
    const planks = builtOf(G, 'carpenter')[0];
    if (planks) { const t = Math.min(Math.floor(capOf(G, 'plank') * 0.7), 30 + hlv * 40); tryAct(G, { t: 'target', bid: planks.id, rid: 'plank', n: t }); }
    const loom = builtOf(G, 'loom')[0];
    if (loom) tryAct(G, { t: 'target', bid: loom.id, rid: 'cloth', n: Math.min(Math.floor(capOf(G, 'cloth') * 0.7), 10 + hlv * 10) });
    const sm = builtOf(G, 'smithy')[0];
    if (sm) {
        tryAct(G, { t: 'target', bid: sm.id, rid: 'ingot', n: Math.min(Math.floor(capOf(G, 'ingot') * 0.7), 8 + hlv * 12) });
        if (sm.lv >= 2) tryAct(G, { t: 'target', bid: sm.id, rid: 'steel', n: Math.min(Math.floor(capOf(G, 'steel') * 0.7), hlv >= 6 ? 40 : 25) });
    }
    const mill = builtOf(G, 'mill')[0];
    if (mill) tryAct(G, { t: 'target', bid: mill.id, rid: 'flour', n: 16 });
    // dishes
    const tv = builtOf(G, 'tavern')[0];
    if (tv) {
        const heroes = Math.max(1, G.heroes.length);
        for (const r of recipesFor('tavern')) {
            if (r.lv > tv.lv) continue;
            const ok = Object.entries(r.in).every(([k, n]) => stock(G, k) >= n * 2);
            const cheap = ITEMS[r.out].value < 60;
            const want = ok ? (r.out === 'harvest_feast' ? (G.journal.dragon ? 0 : (hlv >= 6 ? 3 : 0)) : Math.min(8, 2 + heroes)) : 0;
            tryAct(G, { t: 'target', bid: tv.id, rid: r.out, n: want && (cheap || hlv >= 4) ? want : (r.out === 'harvest_feast' ? want : 0) });
        }
    }
    // gear for every hero, best tier they can wear
    const stations = {};
    for (const b of G.buildings) if (b.lv >= 1 && (b.type === 'carpenter' || b.type === 'smithy' || b.type === 'loom' || b.type === 'alchemist')) stations[b.type] = b;
    const need = {};
    for (const h of G.heroes) {
        for (const slot of ['weapon', 'armor', 'charm']) {
            const cur = ITEMS[h.equip[slot]]?.tier || 0;
            let best = null;
            for (let t = 5; t > cur; t--) {
                const id = slot === 'weapon' ? `w_${WEAPON_TYPE[h.cls]}_${t}` : slot === 'armor' ? `a_${t}` : `c_${t}`;
                const rec = RECIPES[id];
                if (ITEMS[id].reqLv > h.lv) continue;
                const st = stations[rec.station];
                if (!st || st.lv < rec.lv) continue;
                // do not chase a tier whose materials are far out of reach
                if (!Object.entries(rec.in).every(([k, n]) => stock(G, k) >= n || ['plank', 'cloth', 'ingot', 'steel'].includes(k))) continue;
                best = id; break;
            }
            if (best) need[best] = (need[best] || 0) + 1;
        }
    }
    // zero old gear targets, then set the new ones
    for (const st of Object.values(stations)) {
        for (const rid in st.auto) if (ITEMS[rid].cat === 'gear' && !need[rid]) st.auto[rid] = 0;
    }
    for (const id in need) {
        const rec = RECIPES[id];
        const have = stock(G, id) + G.shelves.filter((s) => s === id).length * 0;
        tryAct(G, { t: 'target', bid: stations[rec.station].id, rid: id, n: Math.min(3, need[id]) });
    }
    const al = stations.alchemist;
    if (al) {
        tryAct(G, { t: 'target', bid: al.id, rid: 'heal_potion', n: 4 });
        tryAct(G, { t: 'target', bid: al.id, rid: 'bandage', n: 3 });
        if (al.lv >= 2) tryAct(G, { t: 'target', bid: al.id, rid: 'luck_elixir', n: 2 });
        if (al.lv >= 3) tryAct(G, { t: 'target', bid: al.id, rid: 'greater_potion', n: 2 });
    }
}

function stockShelves(G) {
    const n = shelfCount(G);
    if (!n) return;
    const want = [];
    for (const h of G.heroes) {
        for (const slot of ['weapon', 'armor', 'charm']) {
            const cur = ITEMS[h.equip[slot]]?.tier || 0;
            for (let t = 5; t > cur; t--) {
                const id = slot === 'weapon' ? `w_${WEAPON_TYPE[h.cls]}_${t}` : slot === 'armor' ? `a_${t}` : `c_${t}`;
                if (ITEMS[id].reqLv > h.lv) continue;
                if (stock(G, id) > 0 && !want.includes(id)) want.push(id);
                if (stock(G, id) > 0) break;
            }
        }
    }
    for (const p of ['greater_potion', 'luck_elixir', 'heal_potion', 'bandage']) if (stock(G, p) > 0) want.push(p);
    // keep shelves that still hold stock, fill the rest
    const keep = G.shelves.slice(0, n).map((s) => (s && want.includes(s) ? s : null));
    for (const w of want) if (!keep.includes(w)) { const i = keep.indexOf(null); if (i >= 0) keep[i] = w; }
    for (let i = 0; i < n; i++) if (keep[i] !== (G.shelves[i] || null)) tryAct(G, { t: 'shelf', slot: i, item: keep[i] });
}

// ---------------------------------------------------------------- heroes
function hireHeroes(G, reserve) {
    if (!guildLv(G) || G.heroes.length >= heroCap(G)) return;
    // do not hire into a town that cannot feed and house them yet
    if (G.heroes.length >= 2 && !builtOf(G, 'tavern').length) return;
    const counts = {};
    for (const h of G.heroes) counts[h.cls] = (counts[h.cls] || 0) + 1;
    let best = null, bs = -1;
    for (const r of G.recruits) {
        const fee = recruitFee(r);
        if (G.gold - fee < 40 + (reserve.gold || 0) * 0.3) continue;
        const sc = (r.lv + r.q * 3) / (fee + 60) * 100 - (counts[r.cls] || 0) * 0.4;
        if (sc > bs) { bs = sc; best = r; }
    }
    if (best) tryAct(G, { t: 'hire', rid: best.id });
}

function research(G, reserve) {
    for (const id of RESEARCH) {
        const u = UPGRADES[id];
        if (G.upgrades[id] || hallLv(G) < u.hall || u.req.some((r) => !G.upgrades[r])) continue;
        const cost = u.cost;
        if (!afford(G, cost, reserve)) continue;
        if ((cost.gold || 0) > G.gold * 0.6 && G.gold < 400) continue;
        tryAct(G, { t: 'research', id });
        return;
    }
}

function sellPlan(G) {
    if (!builtOf(G, 'market').length) return;
    const hl = hallLv(G);
    for (const k of ['wheat', 'berry', 'apple', 'fish', 'egg', 'herb', 'mushroom', 'fiber', 'honey', 'meat', 'hide', 'ore', 'coal']) {
        const keep = Math.ceil(capOf(G, k) * 0.45) + 12;
        tryAct(G, { t: 'autosell', item: k, keep });
    }
    for (const k of ['wood', 'stone']) tryAct(G, { t: 'autosell', item: k, keep: Math.ceil(capOf(G, k) * 0.8) });
}

/** A hero who cannot afford their kit gets it from the stores: a good boss makes sure her people are armed. */
function gift(G) {
    for (const h of G.heroes) {
        if (h.st !== 'idle' && h.st !== 'rest' && h.st !== 'sleep') continue;
        for (const slot of ['weapon', 'armor', 'charm']) {
            const cur = ITEMS[h.equip[slot]]?.tier || 0;
            for (let t = 5; t > cur; t--) {
                const id = slot === 'weapon' ? `w_${WEAPON_TYPE[h.cls]}_${t}` : slot === 'armor' ? `a_${t}` : `c_${t}`;
                if (ITEMS[id].reqLv > h.lv || stock(G, id) <= 0) continue;
                if (h.gold >= shelfPrice(G, id) + 14 && G.shelves.includes(id)) break;       // they will buy it
                if (tryAct(G, { t: 'equip', hid: h.id, item: id }).ok) break;
            }
        }
    }
}

function shop(G) {
    const m = G.merchant;
    if (!m) return;
    m.offers.forEach((o, i) => {
        if (o.n <= 0 || !['gem', 'steel', 'lore', 'relic', 'ingot', 'cloth', 'plank', 'pelt'].includes(o.item)) return;
        if (stock(G, o.item) > 60) return;
        const n = Math.min(o.n, Math.floor((G.gold * 0.5) / o.price));
        if (n > 0) tryAct(G, { t: 'merchant', i, n });
    });
}

function bossPlan(G) {
    const q = G.board.find((x) => x.kind === 'boss' && !x.pid);
    if (!q) return;
    if (Object.keys(q.req || {}).some((k) => stock(G, k) < q.req[k])) return;
    const ready = readyHeroes(G).slice().sort((a, b) => heroPower(G, b) - heroPower(G, a)).slice(0, q.slots);
    if (ready.length < q.slots) return;
    // top up with potions from the stores
    for (const h of ready) for (const p of ['greater_potion', 'heal_potion', 'luck_elixir', 'bandage']) { while (h.pots.length < 2 && stock(G, p) > 0) tryAct(G, { t: 'equip', hid: h.id, item: p }); }
    const c = partyChance(G, ready, q).chance;
    if (c >= 0.7) tryAct(G, { t: 'dispatch', qid: q.id, heroes: ready.map((h) => h.id) });
}
