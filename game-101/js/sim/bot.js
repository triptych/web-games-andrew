// An auto-player. It plays through the same commands the player uses (act), so the tests, the balance
// table and the title screen's demo all exercise the real rules. Pure.

import { DIRS } from '../config.js';
import { calc, canEquip, slotFor, itemScore, CLASSES, isAlive } from './party.js';
import { cellIdx, featAt, getEdge, passable, inb } from './dungeon.js';
import { autoCmds } from './battle.js';
import { act } from './game.js';
import {
    shopStock, buyPrice, investCost, income, BIZ_IDS, roomCost, recruitCost, churchPrice, cursedGear, mealPrice,
} from './town.js';
import { checkpoints } from './world.js';
import { isReady } from './quests.js';
import { avgLvl } from './core.js';

export function makeBot(o = {}) {
    return { explore: o.explore ?? 0.55, push: o.push ?? 1.0, grind: 0, wait: 0, cmds: 0, townVisits: 0, lastTown: -1, stuck: 0, ...o };
}

const hpFrac = (G) => {
    let a = 0, b = 0;
    for (const m of G.party) { a += Math.max(0, m.hp); b += calc(m).maxhp; }
    return a / Math.max(1, b);
};
const countPots = (G, eff) => G.inv.filter((x) => x.t === 'p' && x.eff === eff).reduce((a, x) => a + x.n, 0);
const count = (G, pred) => G.inv.filter(pred).reduce((a, x) => a + (x.n || 1), 0);

/** First step (absolute direction) of a shortest path to the nearest cell satisfying goal. */
export function pathDir(f, sx, sy, goal) {
    const prev = new Int8Array(f.w * f.h).fill(-2);       // the direction taken to reach each cell
    const q = [cellIdx(f, sx, sy)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], x = c % f.w, y = (c / f.w) | 0;
        if ((x !== sx || y !== sy) && goal(x, y)) {
            let k = c, dirTo = -1;
            while (prev[k] !== -1) {
                dirTo = prev[k];
                k = cellIdx(f, (k % f.w) - DIRS[dirTo].dx, ((k / f.w) | 0) - DIRS[dirTo].dy);
            }
            return dirTo;
        }
        for (let d = 0; d < 4; d++) {
            if (!passable(getEdge(f, x, y, d))) continue;
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny)) continue;
            const ni = cellIdx(f, nx, ny);
            if (prev[ni] !== -2) continue;
            prev[ni] = d;
            q.push(ni);
        }
    }
    return -1;
}
const relMove = (facing, dir) => ['f', 'sr', 'b', 'sl'][(dir - facing + 4) % 4];

// ------------------------------------------------------------------ town
function townRoutine(G, bot) {
    const A = (c) => act(G, c);
    A({ t: 'collect' });
    // quests
    for (const q of [...G.quests.active]) if (isReady(G, q)) A({ t: 'turnin', id: q.id });
    for (const q of [...G.quests.board]) if (G.quests.active.length < 2 && ['slay', 'reach', 'boss'].includes(q.type)) A({ t: 'accept', id: q.id });
    A({ t: 'sellJunk' });
    // fallen and cursed
    G.party.forEach((m, i) => {
        if (m.hp <= 0 && G.gold >= churchPrice(G, 'revive', m)) A({ t: 'church', svc: 'revive', who: i });
        if ((m.st.curse || cursedGear(m).length) && G.gold >= churchPrice(G, 'curse', m)) A({ t: 'church', svc: 'curse', who: i });
        if (m.st.poison && G.gold >= churchPrice(G, 'cure', m)) A({ t: 'church', svc: 'cure', who: i });
    });
    // recruits
    G.town.recruits.slice().forEach((r, idx) => {
        if (G.party.length < 6 && G.gold > recruitCost(G, r) * 2.2) A({ t: 'recruit', idx: G.town.recruits.indexOf(r) });
    });
    // gear: equip from the bag, then buy upgrades
    G.party.forEach((m, i) => A({ t: 'autoequip', who: i }));
    const reserve = 120 + avgLvl(G) * 25;
    for (let pass = 0; pass < 2; pass++) {
        let best = null;
        for (const shop of ['smith', 'magic']) {
            for (const it of shopStock(G, shop)) {
                if (!['w', 'a', 'c'].includes(it.t)) continue;
                const price = buyPrice(G, shop, it);
                if (price > (G.gold - reserve) * 0.6) continue;
                G.party.forEach((m, i) => {
                    if (!canEquip(m, it).ok) return;
                    const slot = it.t === 'c' ? 'acc1' : slotFor(m, it);
                    const cur = m.eq[slot];
                    const gain = itemScore(it) - itemScore(cur);
                    if (gain > 0 && (!best || gain / price > best.v)) best = { shop, it, v: gain / price, gain };
                });
            }
        }
        if (!best || best.gain < 2) break;
        A({ t: 'buy', shop: best.shop, sid: best.it.sid, qty: 1 });
        G.party.forEach((m, i) => A({ t: 'autoequip', who: i }));
    }
    // sell the leftover gear
    for (const it of [...G.inv]) if (['w', 'a', 'c'].includes(it.t)) A({ t: 'sell', id: it.id, qty: 1 });
    // supplies
    const buyStack = (eff, want, shop = 'items') => {
        const have = countPots(G, eff);
        const stock = shopStock(G, shop).filter((x) => x.t === 'p' && x.eff === eff).sort((a, b) => b.pot - a.pot);
        const it = stock.find((x) => buyPrice(G, shop, x) * 1 < G.gold * 0.3) || stock[stock.length - 1];
        if (it && have < want) A({ t: 'buy', shop, sid: it.sid, qty: Math.min(want - have, Math.floor(G.gold * 0.35 / Math.max(1, buyPrice(G, shop, it)))) || 0 });
    };
    buyStack('heal', 4 + G.party.length);
    buyStack('antidote', 2);
    if (G.maxDepth >= 3) buyStack('revive', 1);
    if (count(G, (x) => x.t === 's' && x.eff === 'escape') < 2) {
        const sc = shopStock(G, 'items').find((x) => x.t === 's' && x.eff === 'escape');
        if (sc) A({ t: 'buy', shop: 'items', sid: sc.sid, qty: 2 });
    }
    // wands: recharge
    for (const it of G.inv) if (it.t === 'm' && it.charges < it.max) A({ t: 'recharge', id: it.id });
    // rest
    const hurt = G.party.some((m) => m.hp < calc(m).maxhp * 0.95 || m.mp < calc(m).maxmp * 0.8);
    if (hurt && G.gold >= roomCost(G)) A({ t: 'rest' });
    else if (hurt && G.gold >= mealPrice(G, 'stew')) A({ t: 'eat', meal: 'stew' });
    // invest the surplus
    for (let n = 0; n < 6; n++) {
        const spare = G.gold - reserve - 60;
        let pick = null;
        for (const id of BIZ_IDS) {
            const c = investCost(G, id);
            if (c > spare) continue;
            const v = (income(G, id, G.biz[id].lvl + 1) - income(G, id)) / c + (id === 'guild' ? 0.002 : 0) + (id === 'inn' || id === 'items' ? 0.001 : 0);
            if (!pick || v > pick.v) pick = { id, v };
        }
        if (!pick) break;
        A({ t: 'invest', biz: pick.id });
    }
    A({ t: 'collect' });
    bot.townVisits++;
}
function pickDepth(G, bot) {
    const cps = checkpoints(G);
    const lv = avgLvl(G) * bot.push;
    let best = 1;
    for (const d of cps) if (d <= lv + 1) best = d;
    return best;
}

// ------------------------------------------------------------------ dungeon
function dialogChoice(G, bot) {
    const D = G.dialog;
    const has = (id) => D.opts.some((o) => o.id === id && !o.off);
    switch (D.kind) {
        case 'chest': return has('disarm') && G.rng() < 0.5 ? 'disarm' : 'open';
        case 'stairs': {
            if (D.dir === 'up') return 'stay';
            const f = G.floor;
            const explored = exploredFrac(f);
            const ok = explored >= bot.explore && avgLvl(G) >= Math.min(G.depth * 0.9 + 0.5, G.depth + 1) * bot.push;
            return ok || bot.grind <= 0 && explored >= 0.95 ? 'go' : 'stay';
        }
        case 'gather': return 'gather';
        case 'spring': return hpFrac(G) < 0.8 ? 'drink' : 'leave';
        case 'altar': return has('give') && G.gold > 400 + (D.cost || 0) * 3 ? 'give' : has('bleed') && hpFrac(G) > 0.9 ? 'bleed' : 'leave';
        case 'merchant': return 'leave';
        case 'npc': {
            if (has('rescue')) return 'rescue';
            if (has('guide')) return 'guide';
            if (has('accept')) return 'accept';
            if (has('heal')) return hpFrac(G) < 0.7 ? 'heal' : 'leave';
            if (D.opts.some((o) => o.id === 'ans0')) return 'ans' + G.rng.int(0, 2);
            return 'leave';
        }
        default: return 'ok';
    }
}
export function exploredFrac(f) {
    let v = 0;
    for (let i = 0; i < f.seen.length; i++) if (f.seen[i] === 2) v++;
    return v / f.seen.length;
}

function useHeals(G) {
    // field healing: cleric spells first, then potions when badly hurt
    for (let i = 0; i < G.party.length; i++) {
        const m = G.party[i];
        if (!isAlive(m)) continue;
        const s = calc(m);
        for (const sk of ['healall', 'heal', 'tonic', 'elixirdose']) {
            if (CLASSES[m.cls] && m.lvl >= 1) {
                const hurt = G.party.map((p, j) => ({ j, f: p.hp / calc(p).maxhp, d: p.hp <= 0 })).filter((x) => !x.d && x.f < 0.7).sort((a, b) => a.f - b.f)[0];
                if (!hurt) return false;
                const before = G.party.map((p) => p.hp).join();
                act(G, { t: 'skill', who: i, skill: sk, target: hurt.j });
                if (before !== G.party.map((p) => p.hp).join()) return true;
            }
        }
        void s;
    }
    const worst = G.party.map((p, j) => ({ j, f: p.hp / calc(p).maxhp, d: p.hp <= 0 })).filter((x) => !x.d).sort((a, b) => a.f - b.f)[0];
    if (worst && worst.f < 0.4) {
        const pot = G.inv.find((x) => x.t === 'p' && x.eff === 'heal');
        if (pot) { act(G, { t: 'use', item: pot.id, who: worst.j }); return true; }
    }
    return false;
}

function dungeonStep(G, bot) {
    const f = G.floor, p = G.pos;
    const needTown = () => {
        if (G.inv.length > 72) return true;
        const heals = countPots(G, 'heal');
        if (hpFrac(G) < 0.4 && heals === 0) return true;
        if (G.party.filter(isAlive).length <= Math.ceil(G.party.length / 2) && countPots(G, 'revive') === 0) return true;
        return false;
    };
    if (hpFrac(G) < 0.65 && useHeals(G)) return;
    if (needTown()) {
        const esc = G.inv.find((x) => x.t === 's' && x.eff === 'escape');
        if (esc) { act(G, { t: 'use', item: esc.id, who: 0 }); return; }
    }
    // goals
    const here = (x, y) => featAt(f, x, y);
    const hurt = hpFrac(G) < 0.75;
    const relicQ = G.quests.active.some((q) => q.type === 'relic');
    const wantFeat = (x, y) => {
        const ft = here(x, y);
        if (!ft) return false;
        if (ft.type === 'chest') return !ft.opened;
        if (ft.type === 'gather') return ft.left > 0 && G.inv.length < 60;
        if (ft.type === 'spring') return ft.left > 0 && hurt;
        if (ft.type === 'relic') return !ft.taken && relicQ;
        if (ft.type === 'npc') return !ft.done && (['hermit', 'adventurer', 'questgiver'].includes(ft.kind) || (ft.kind === 'healer' && hpFrac(G) < 0.5 && G.gold > 300));
        if (ft.type === 'altar') return !ft.used && ft.kind === 'shrine' && G.gold > 600;
        return false;
    };
    let dir = pathDir(f, p.x, p.y, wantFeat);
    const frac = exploredFrac(f);
    const guard = f.feat[`${f.down.x},${f.down.y}`]?.guard;
    const ready = !guard || avgLvl(G) >= G.depth + 1.5;
    if (dir < 0 && frac < bot.explore) dir = pathDir(f, p.x, p.y, (x, y) => f.seen[cellIdx(f, x, y)] !== 2);
    if (dir < 0) {
        // done exploring: stairs if strong enough, else wander to grind
        const strong = avgLvl(G) >= Math.min(G.depth * 0.9 + 0.5, G.depth + 1) * bot.push && ready;
        if (strong) dir = pathDir(f, p.x, p.y, (x, y) => x === f.down.x && y === f.down.y);
        else {
            if (bot.grind <= 0) bot.grind = 140;
            bot.grind--;
            if (bot.grind > 0) dir = G.rng.int(0, 3);
            else {
                // grinded enough; if still weak go home, otherwise push on
                const esc = G.inv.find((x) => x.t === 's' && x.eff === 'escape');
                if (esc && avgLvl(G) < G.depth * 0.8) { act(G, { t: 'use', item: esc.id, who: 0 }); return; }
                dir = pathDir(f, p.x, p.y, (x, y) => x === f.down.x && y === f.down.y);
            }
        }
    }
    if (dir < 0) {
        // sealed in (secret door): search; fall back to wandering
        bot.stuck++;
        if (bot.stuck % 3 === 0) { act(G, { t: 'search' }); return; }
        dir = G.rng.int(0, 3);
    }
    if (dir >= 0 && !passable(getEdge(f, p.x, p.y, dir))) { act(G, { t: 'search' }); return; }
    const standing = here(p.x, p.y);
    if (standing && ['chest', 'gather'].includes(standing.type) && wantFeat(p.x, p.y)) { act(G, { t: 'interact' }); return; }
    act(G, { t: 'move', m: relMove(p.d, dir) });
    bot.stuck = 0;
}

/** One decision. Returns false when there is nothing sensible left to do. */
export function botStep(G, bot) {
    bot.cmds++;
    if (G.battle) {
        const B = G.battle;
        if (B.over) { act(G, { t: 'endBattle' }); return true; }
        const lowAll = hpFrac(G) < 0.22 && !B.boss && !G.inv.some((x) => x.t === 'p' && x.eff === 'heal');
        if (lowAll) { act(G, { t: 'flee' }); return true; }
        act(G, { t: 'round', cmds: autoCmds(G) });
        return true;
    }
    if (G.dialog) { act(G, { t: 'dlg', id: dialogChoice(G, bot) }); return true; }
    if (!G.floor) {
        townRoutine(G, bot);
        const d = pickDepth(G, bot);
        act(G, { t: 'enter', depth: d });
        if (!G.floor) { bot.wait++; return bot.wait < 5; }
        bot.grind = 0;
        return true;
    }
    dungeonStep(G, bot);
    return true;
}
