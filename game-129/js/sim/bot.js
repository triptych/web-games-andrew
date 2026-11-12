// HOLLOWDEEP — an auto-player that plays the whole game through act(), the same commands the player sends.
// The tests use it to prove the game can be played deep, to balance the numbers, and to find stuck states.
//
//   const bot = makeBot({ seed, skill });   const cmd = botCommand(G, bot);   act(G, cmd);
//
// skill 1 auto-battles with the shared brain (battle.js autoCommand); lower skills sometimes just hit something.
// In the dungeon it knows the map (it is a test harness, not a player), heads for quest spots, chests, the stairs and
// guardians, and turns home when hurt. In town it turns quests in, revives, rests, hires, gears up and shops.

import { makeRng } from '../rng.js';
import { PARTY_MAX, ROSTER_MAX, HIRE_COST, INN_COST, REVIVE_COST } from '../config.js';
import { getFloor, bfs, open, DX, DY } from './dungeon.js';
import { heroStats, knownSkills, canEquip } from './stats.js';
import { itemDef, gearStats, CONSUMABLES } from './data/items.js';
import { STORY } from './data/town.js';
import { isBossFloor, FLOORS_PER_STRATUM } from './data/monsters.js';
import { shopStock, buyPrice, tileAt, floorState } from './game.js';
import { party, autoCommand } from './battle.js';
import { storyFor, isComplete, spotQuest, MAX_ACTIVE } from './quests.js';

/** The level a party should average before taking on `floor`. */
export const recLevel = (floor) => Math.max(1, Math.round(floor * 0.9 + (isBossFloor(floor) ? 2 : 0)));

export function makeBot({ seed = 1, skill = 1, maxDepth = Infinity, dare = 1 } = {}) {
    return { rng: makeRng(seed * 2654435761), skill, maxDepth, dare, inTown: 0, rested: false, target: null, stuck: 0, lastPos: null };
}

const score = (d, cls) => {
    if (!d) return 0;
    const g = d;
    const magic = cls === 'mage' || cls === 'priest';
    return (g.atk || 0) * (magic ? 0.3 : 1) + (g.mag || 0) * (magic ? 1.2 : 0.2) + (g.def || 0) + (g.res || 0) * 0.6 + (g.hp || 0) * 0.15 + (g.mp || 0) * (magic ? 0.3 : 0) + (g.spd || 0) * 0.5 + (g.luk || 0) * 0.2;
};

export function botCommand(G, bot) {
    if (G.mode === 'battle') return battleMove(G, bot);
    if (G.mode === 'town') return townMove(G, bot);
    return dungeonMove(G, bot);
}

// ---------------------------------------------------------------- battle
function battleMove(G, bot) {
    if (bot.skill >= 1 || bot.rng() < bot.skill) return { t: 'auto' };
    const foes = G.battle.foes.filter((f) => f.alive);
    return { t: 'cmd', a: 'attack', target: bot.rng.pick(foes).uid };
}

// ---------------------------------------------------------------- town
const avgLv = (G) => { const p = party(G); return p.reduce((a, c) => a + c.lv, 0) / Math.max(1, p.length); };
const WANT = ['fighter', 'priest', 'mage', 'knight', 'ranger', 'thief'];

function townMove(G, bot) {
    bot.inTown++;
    if (bot.inTown > 200) { bot.inTown = 0; return enterCmd(G, bot); }   // never loop in town forever
    // quests in
    for (const q of G.quests.active) if (isComplete(G, q)) return { t: 'turnin', qid: q.id };
    // the fallen
    for (const c of G.roster) {
        if (c.hp > 0 || !G.party.includes(c.id)) continue;
        const free = !G.roster.some((x) => x.hp > 0);
        if (free || G.gold >= REVIVE_COST(c.lv) + 40) return { t: 'revive', cid: c.id };
    }
    // dead weight leaves the party: someone alive from the roster takes their place
    const deadInParty = party(G).filter((c) => c.hp <= 0);
    if (deadInParty.length) {
        const spare = G.roster.find((c) => c.hp > 0 && !G.party.includes(c.id));
        if (spare) return { t: 'party', ids: G.party.map((id) => (id === deadInParty[0].id ? spare.id : id)) };
    }
    // fill the party
    if (G.party.length < PARTY_MAX && G.roster.length < ROSTER_MAX) {
        const have = new Set(party(G).map((c) => c.cls));
        let best = -1;
        for (const [i, r] of G.recruits.entries()) {
            if (G.gold < HIRE_COST(r.lv) + 30) continue;
            if (best < 0 || (!have.has(r.cls) && have.has(G.recruits[best].cls)) || WANT.indexOf(r.cls) < WANT.indexOf(G.recruits[best].cls)) best = i;
        }
        if (best >= 0) return { t: 'hire', i: best };
    }
    // formation: front-liners in front
    const order = party(G).slice().sort((a, b) => rowRank(a) - rowRank(b)).map((c) => c.id);
    if (order.join() !== G.party.join()) return { t: 'party', ids: order };
    // rest
    const hurt = party(G).some((c) => { const s = heroStats(c); return c.hp > 0 && (c.hp < s.hp || c.mp < s.mp); });
    const cost = INN_COST(G.roster.filter((c) => c.hp > 0).reduce((a, c) => a + c.lv, 0));
    if (!bot.rested && (hurt || G.day % 3 === 0) && G.gold >= cost) { bot.rested = true; return { t: 'rest' }; }
    // equip what we carry, best first
    for (const c of party(G)) {
        for (const [i, e] of G.inv.entries()) {
            const d = itemDef(e.id);
            if (!d || d.type !== 'gear' || !canEquip(c, d)) continue;
            if (score(gearStats(e), c.cls) > score(c.eq[d.slot] && gearStats(c.eq[d.slot]), c.cls) + 0.5) return { t: 'equip', cid: c.id, inv: i };
        }
    }
    // sell what nobody wears
    for (const [i, e] of G.inv.entries()) {
        const d = itemDef(e.id);
        if (d.type === 'gear') return { t: 'sell', inv: i };
    }
    // buy upgrades (keep money for the inn and potions)
    const reserve = 80 + cost * 2;
    const stock = shopStock(G);
    let bestBuy = null, bestGain = 0;
    for (const c of party(G)) {
        for (const id of stock) {
            const d = itemDef(id);
            if (d.type !== 'gear' || !canEquip(c, d)) continue;
            if (buyPrice(id) > G.gold - reserve) continue;
            const gain = score(d, c.cls) - score(c.eq[d.slot] && gearStats(c.eq[d.slot]), c.cls);
            if (gain > bestGain + 0.5 && gain / buyPrice(id) > bestGain / 1e9) { bestGain = gain; bestBuy = id; }
        }
    }
    if (bestBuy) return { t: 'buy', id: bestBuy };
    // supplies
    const n = (id) => G.inv.find((e) => e.id === id)?.n || 0;
    const tier2 = stock.includes('hipotion');
    if (n(tier2 ? 'hipotion' : 'potion') < 6 && G.gold > buyPrice(tier2 ? 'hipotion' : 'potion') + 60) return { t: 'buy', id: tier2 ? 'hipotion' : 'potion' };
    if (n('thread') < 2 && G.gold > 120) return { t: 'buy', id: 'thread' };
    if (n('antidote') < 3 && G.gold > 60) return { t: 'buy', id: 'antidote' };
    if (stock.includes('ether') && n('ether') < 3 && G.gold > 300) return { t: 'buy', id: 'ether' };
    if (stock.includes('phoenix') && n('phoenix') < 2 && G.gold > 900) return { t: 'buy', id: 'phoenix' };
    // quests
    if (G.quests.active.length < MAX_ACTIVE) {
        for (const s of STORY) { const q = storyFor(G, s.npc); if (q && q.id === s.id) return { t: 'take', qid: q.id }; }
        const b = G.quests.board.find((x) => x.kind !== 'delve' || x.floor <= bot.maxDepth);
        if (b) return { t: 'take', qid: b.id };
    }
    return enterCmd(G, bot);
}

const rowRank = (c) => ({ knight: 0, fighter: 1, thief: 2, ranger: 3, priest: 4, mage: 5 })[c.cls];

function enterCmd(G, bot) {
    bot.inTown = 0;
    bot.rested = false;
    bot.target = null;
    const lv = avgLv(G);
    const ok = G.warps.filter((w) => w <= bot.maxDepth && recLevel(w) * bot.dare <= lv + 1);
    return { t: 'enter', floor: ok.length ? Math.max(...ok) : 1 };
}

// ---------------------------------------------------------------- dungeon
function hpFrac(G) {
    const p = party(G);
    let h = 0, m = 0;
    for (const c of p) { const s = heroStats(c); h += c.hp / s.hp; }
    for (const c of p) { const s = heroStats(c); m += s.mp ? c.mp / s.mp : 1; }
    return { hp: h / Math.max(1, p.length), mp: m / Math.max(1, p.length), dead: p.filter((c) => c.hp <= 0).length };
}

function dungeonMove(G, bot) {
    const f = getFloor(G.seed, G.floor);
    const here = tileAt(G, G.pos.x, G.pos.y);
    const v = hpFrac(G);
    const healers = party(G).filter((c) => c.hp > 0 && knownSkills(c).some((s) => s.id === 'heal'));
    const healerMp = healers.reduce((a, c) => a + c.mp, 0);
    // patch up between fights with potions when no healer has mana
    for (const c of party(G)) {
        if (c.hp <= 0) continue;
        const s = heroStats(c);
        if (c.hp / s.hp < 0.45) {
            if (healers.length && healerMp >= 3) break;
            const i = G.inv.findIndex((e) => e.id === 'hipotion' || e.id === 'potion');
            if (i >= 0) return { t: 'use', inv: i, target: c.id };
        }
        if (c.st.poison) { const i = G.inv.findIndex((e) => e.id === 'antidote'); if (i >= 0) return { t: 'use', inv: i, target: c.id }; }
    }
    // out of combat, a priest heals
    for (const h of healers) {
        const sk = knownSkills(h).find((s) => s.id === 'heal');
        if (h.mp < sk.mp) continue;
        const hurt = party(G).filter((c) => c.hp > 0 && c.hp / heroStats(c).hp < 0.6).sort((a, b) => a.hp / heroStats(a).hp - b.hp / heroStats(b).hp)[0];
        if (hurt) return { t: 'field', cid: h.id, skill: 'heal', target: hurt.id };
    }
    const retreat = v.dead > 0 || v.hp < 0.45 || (v.hp < 0.7 && healers.length && healerMp < 4) || (v.mp < 0.15 && v.hp < 0.8);
    if (retreat) {
        const i = G.inv.findIndex((e) => e.id === 'thread');
        if (i >= 0) return { t: 'use', inv: i };
        if (here === 'up') return { t: 'stairs' };
        return stepToward(G, bot, f, f.start);
    }
    const lv = avgLv(G);
    // a quest waiting on this floor
    const q = spotQuest(G, G.floor);
    if (q && f.spot && !(G.pos.x === f.spot.x && G.pos.y === f.spot.y)) return stepToward(G, bot, f, f.spot);
    // unopened chests
    const st = floorState(G, G.floor);
    let chest = null, cd = Infinity;
    const dist = bfs(f, G.pos.x, G.pos.y, (x, y) => f.boss && !G.bossDown[G.floor] && x === f.boss.x && y === f.boss.y);
    for (const [i, c] of f.chests.entries()) {
        if (st.opened.includes(i)) continue;
        const d = dist[c.y * f.w + c.x];
        if (d >= 0 && d < cd) { cd = d; chest = c; }
    }
    if (chest && cd < 40) return stepToward(G, bot, f, chest);
    // deeper, or the guardian, or home to grow stronger
    const next = G.floor + 1;
    const wantDeeper = next <= bot.maxDepth && lv + 0.5 >= recLevel(next) * bot.dare && v.hp > 0.6;
    if (f.boss && !G.bossDown[G.floor]) {
        if (wantDeeper && v.hp > 0.85 && v.mp > 0.5) return stepToward(G, bot, f, f.boss, true);
        // grind here: wander
        return wander(G, bot, f);
    }
    if (wantDeeper) {
        if (here === 'down') return { t: 'stairs' };
        return stepToward(G, bot, f, f.down);
    }
    return wander(G, bot, f);
}

function wander(G, bot, f) {
    // walk to random far cells; fights come to us
    if (!bot.target || (bot.target.x === G.pos.x && bot.target.y === G.pos.y) || bot.stuck > 30) {
        bot.stuck = 0;
        const cells = [];
        for (let i = 0; i < f.cells.length; i++) if (f.cells[i]) cells.push(i);
        let i = bot.rng.pick(cells);
        if (f.boss && i === f.boss.y * f.w + f.boss.x) i = f.start.y * f.w + f.start.x;
        bot.target = { x: i % f.w, y: (i / f.w) | 0 };
    }
    bot.stuck++;
    return stepToward(G, bot, f, bot.target);
}

/** One command toward `to`: turn to face the next cell on the shortest path, or step into it. */
function stepToward(G, bot, f, to, intoBoss = false) {
    const blocked = (x, y) => !intoBoss && f.boss && !G.bossDown[G.floor] && x === f.boss.x && y === f.boss.y && !(x === to.x && y === to.y);
    const dist = bfs(f, to.x, to.y, blocked);
    const here = dist[G.pos.y * f.w + G.pos.x];
    if (here <= 0) return here === 0 ? { t: 'turn', d: 1 } : { t: 'turn', d: 1 };
    for (let k = 0; k < 4; k++) {
        const nx = G.pos.x + DX[k], ny = G.pos.y + DY[k];
        if (!open(f, nx, ny) || dist[ny * f.w + nx] !== here - 1) continue;
        const rel = (k - G.pos.d + 4) % 4;
        if (rel === 0) return { t: 'move', dir: 'f' };
        if (rel === 2) return { t: 'turn', d: 2 };
        return { t: 'turn', d: rel === 1 ? 1 : -1 };
    }
    return { t: 'turn', d: 1 };
}

export { CONSUMABLES, FLOORS_PER_STRATUM };
