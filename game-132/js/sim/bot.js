// TITAN'S VAULT: the auto-player. It plays through the same input record and commands a person uses, so the tests,
// the balance table and the attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// skill ∈ [0, 1]: at 1 it dodges every telegraph it can see, drinks at 45% and picks skills well; lower skill reacts
// late (it notices a telegraph with probability `skill`), drinks later and wastes some casts.

import { SKILLS, MASTERIES, TIER_RANK, skillVal } from './data/masteries.js';
import { SLOTS } from './data/items.js';
import { CAMPAIGN } from './data/world.js';
import { SECOND_MASTERY_AT } from '../config.js';
import { act, bagFree } from './act.js';
import { recompute, rankOf, canLearn } from './stats.js';
import { skillBlocked } from './skills.js';
import { los, clearPath } from './world.js';
import { slotOf } from './loot.js';
import { NONE } from './game.js';

/** The order each mastery's skills are wanted in, with the rank wanted. Whirlwind is left to people. */
const PLAN = {
    warfare: [['leap', 1], ['ironskin', 1], ['warcry', 1], ['cleave', 3], ['leap', 3], ['bloodlust', 2], ['wrath', 1], ['warcry', 3], ['ironskin', 3], ['cleave', 5], ['wrath', 3], ['bloodlust', 5], ['ironskin', 5], ['leap', 5], ['warcry', 5], ['wrath', 5]],
    storm: [['chain', 1], ['staticcharge', 1], ['spark', 2], ['stormshield', 1], ['chain', 3], ['thunderstrike', 1], ['conduit', 2], ['tempest', 1], ['thunderstrike', 3], ['staticcharge', 3], ['chain', 5], ['spark', 5], ['tempest', 3], ['conduit', 5], ['thunderstrike', 5], ['stormshield', 5], ['tempest', 5]],
    umbra: [['bonespear', 1], ['shade', 1], ['soulrend', 3], ['gravepact', 2], ['frailty', 1], ['bonespear', 3], ['shade', 3], ['harvest', 1], ['gravepact', 4], ['soulrend', 5], ['bonespear', 5], ['harvest', 3], ['shade', 5], ['frailty', 5], ['harvest', 5], ['shadowstep', 1]],
};
const SECOND = { warfare: 'storm', storm: 'umbra', umbra: 'warfare' };
const ATTR = { warfare: ['vitality', 'might', 'might'], storm: ['spirit', 'vitality', 'cunning'], umbra: ['spirit', 'vitality', 'cunning'] };
/** Slot preference: what goes on the bar first. */
const SLOT_PREF = ['wrath', 'tempest', 'harvest', 'warcry', 'stormshield', 'shade', 'frailty', 'thunderstrike', 'leap', 'chain', 'bonespear', 'cleave', 'spark', 'soulrend', 'shadowstep'];

export function makeBot({ skill = 1, second = null, rifts = 3 } = {}) {
    return { skill, second, rifts, think: 0, choice: null, dodge: null, seen: {}, townDone: false, stuck: 0, lastX: 0, lastY: 0, unstick: 0, ignore: {}, time: {}, chase: null, chaseT: 0 };
}

const alive = (m) => m.life > 0 && m.state !== 'dead';
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ------------------------------------------------------------------------------------------------------ planning

/** Spend points, pick the second mastery, slot skills, equip upgrades, manage bags. Commands only. */
export function botManage(G, bot) {
    const P = G.player;
    if (P.level >= SECOND_MASTERY_AT && !P.masteries[1]) act(G, { t: 'pickMastery', m: bot.second || SECOND[P.masteries[0]] });
    // skill points: walk the plans, alternating masteries once there are two
    for (let guard = 0; guard < 20 && P.unspent.skill > 0; guard++) {
        let spent = false;
        const order = P.masteries[1] ? (guard % 2 ? [P.masteries[1], P.masteries[0]] : [P.masteries[0], P.masteries[1]]) : [P.masteries[0]];
        for (const m of order) {
            const want = PLAN[m].find(([id, r]) => (P.ranks[id] || 0) < r);
            if (!want) {
                if ((P.bar[m] || 0) < 10 && !act(G, { t: 'learnBar', m })) { spent = true; break; }
                continue;
            }
            const need = TIER_RANK[SKILLS[want[0]].tier];
            if ((P.bar[m] || 0) < need || ((P.bar[m] || 0) < 10 && (P.ranks[want[0]] || 0) >= 1 && (P.bar[m] || 0) < Math.min(10, P.level / 3))) {
                if (!act(G, { t: 'learnBar', m })) { spent = true; break; }
            }
            if (!canLearn(G, want[0]) && !act(G, { t: 'learnSkill', id: want[0] })) { spent = true; break; }
        }
        if (!spent) break;
    }
    const at = ATTR[P.masteries[0]];
    for (let k = 0; P.unspent.attr > 0 && k < 30; k++) act(G, { t: 'attr', k: at[k % at.length] });
    // slots: the five best learned actives
    const learned = SLOT_PREF.filter((id) => (P.ranks[id] || 0) > 0);
    const primary = { warfare: 'cleave', storm: 'spark', umbra: 'soulrend' }[P.masteries[0]];
    const want = [primary, ...learned.filter((id) => id !== primary)].slice(0, 5);
    for (let i = 0; i < 5; i++) if (P.slots[i] !== (want[i] || null) && want[i]) act(G, { t: 'slot', i, id: want[i] });
    // gear
    equipBest(G);
    // bags: when ours is nearly full, Ember carries the rest; when Ember is full too, Ember goes to town
    if (bagFree(G) < 0 || P.bag.filter(Boolean).length > 34) {
        for (const id of P.bag.slice()) if (id && !G.items[id].gem && G.pet.bag.includes(null) && G.pet.state !== 'away') act(G, { t: 'toPet', id });
    }
    if (!G.pet.bag.includes(null) && G.pet.state !== 'away' && G.pet.state !== 'down') act(G, { t: 'petTown' });
}

/** A number for how good the player is with the current gear (DPS, softened by toughness). */
function score(G) {
    const s = G.player.stats;
    return s.dps * Math.sqrt(s.toughness);
}

export function equipBest(G) {
    const P = G.player;
    let changed = true;
    for (let pass = 0; pass < 3 && changed; pass++) {
        changed = false;
        const base = score(G);
        for (const id of [...P.bag, ...G.pet.bag]) {
            const it = id && G.items[id];
            if (!it || it.gem) continue;
            const slot0 = slotOf(it.base);
            const slots = slot0 === 'ring' ? ['ring1', 'ring2'] : [slot0];
            for (const slot of slots) {
                const old = P.equip[slot];
                P.equip[slot] = id;
                recompute(G);
                const sc = score(G);
                if (old) P.equip[slot] = old; else delete P.equip[slot];     // no undefined keys: they change save key order
                recompute(G);
                if (sc > base * 1.01) { act(G, { t: 'equip', id, slot }); changed = true; break; }
            }
            if (changed) break;
        }
    }
    // gems into empty sockets
    for (const slot of SLOTS) {
        const it = P.equip[slot] && G.items[P.equip[slot]];
        if (!it || !it.sockets.includes(null)) continue;
        const gem = P.bag.find((id) => id && G.items[id].gem);
        if (gem) act(G, { t: 'socket', item: it.id, gem });
    }
}

function townChores(G, bot) {
    const P = G.player;
    act(G, { t: 'sellJunk' });
    for (const id of P.bag.slice()) if (id && !G.items[id].gem) act(G, { t: 'sell', id });
    for (const g of ['ruby', 'topaz', 'amethyst', 'emerald']) for (let gr = 0; gr < 3; gr++) act(G, { t: 'combine', gem: g, grade: gr });
    // a little gambling for an empty slot
    for (const slot of SLOTS) if (!P.equip[slot] && P.gold > 150 * P.level * 3) act(G, { t: 'gamble', base: slot.startsWith('ring') ? 'ring' : slot });
    equipBest(G);
    bot.townDone = true;
}

// ------------------------------------------------------------------------------------------------------ fighting

function nearestFoe(G, bot, from, range, needLos = true) {
    let best = null, bd = range;
    for (const m of G.mons) {
        if (!alive(m) || bot.ignore[m.id]) continue;
        const d = d2(m, from);
        // a clear lane as wide as a projectile, so a bolt doesn't clip a corner and the cast is wasted
        if (d < bd && (!needLos || clearPath(G.area, from.x, from.y, m.x, m.y, 0.4))) { bd = d; best = m; }
    }
    return best;
}

function pickSkill(G, bot, tgt, near) {
    const P = G.player;
    const has = (id) => P.slots.includes(id) && !skillBlocked(G, id);
    const d = tgt ? d2(tgt, P) : 99;
    const big = tgt && (tgt.boss || tgt.elite);
    const res = (id) => P.res[MASTERIES[SKILLS[id].mastery].res];
    const opts = [];
    if (has('wrath') && (near >= 3 || big) && d < 5 && res('wrath') >= 60) opts.push('wrath');
    if (has('harvest') && (near >= 4 || (big && d < 6))) opts.push('harvest');
    if (has('tempest') && (near >= 3 || big) && d < 9) opts.push('tempest');
    if (has('warcry') && near >= 2 && !P.buffs.some((b) => b.k === 'warcry')) opts.push('warcry');
    if (has('stormshield') && (near >= 2 || big) && !P.buffs.some((b) => b.k === 'shield')) opts.push('stormshield');
    if (has('shade') && G.minions.filter((s) => s.kind === 'shade').length < Math.floor(skillVal('shade', 'max', rankOf(G, 'shade')))) opts.push('shade');
    if (has('frailty') && tgt && (near >= 3 || big) && !tgt.curse && d < 12) opts.push('frailty');
    if (has('thunderstrike') && tgt && (near >= 3 || big) && d < 13) opts.push('thunderstrike');
    if (has('leap') && tgt && d > 3.5 && d < 8.5) opts.push('leap');
    if (has('chain') && tgt && d < 9.5 && (near >= 2 || res('chain') > 50)) opts.push('chain');
    if (has('bonespear') && tgt && d < 14 && (near >= 2 || big || res('bonespear') > 60)) opts.push('bonespear');
    if (has('cleave') && tgt && d < 3.2 + tgt.radius) opts.push('cleave');
    if (has('spark') && tgt && d < 13) opts.push('spark');
    if (has('soulrend') && tgt && d < 7 + tgt.radius) opts.push('soulrend');
    // a weaker bot sometimes picks the third-best option
    if (opts.length > 2 && G.rng() > bot.skill) return opts[2];
    return opts[0] || null;
}

/** The input for this step. Call botManage now and then (main.js does it every half second of game time). */
export function botInput(G, bot) {
    const P = G.player, A = G.area;
    const inp = { ...NONE, held: [false, false, false, false, false], press: [false, false, false, false, false] };
    if (G.mode !== 'play') return inp;
    if (A.kind === 'town') return townInput(G, bot, inp);
    bot.townDone = false;

    // dodge: step out of any monster telegraph we're standing in (seen with probability = skill)
    for (const z of G.zones) {
        if (z.from !== 'mon' || d2(z, P) > z.r + 0.6) continue;
        if (bot.seen[z.id] === undefined) bot.seen[z.id] = G.rng() < bot.skill;
        if (!bot.seen[z.id]) continue;
        const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1;
        inp.mx = dx / d; inp.my = dy / d;
        return inp;
    }
    if (P.life < P.stats.maxLife * (0.25 + 0.2 * bot.skill)) inp.potion = true;
    // too hurt and no potions: portal out and come back healed
    if (P.life < P.stats.maxLife * 0.2 && P.potion.charges === 0 && !G.mons.some((m) => m.boss && alive(m) && d2(m, P) < 12)) { inp.portal = true; return inp; }

    const ranged = P.masteries[0] !== 'warfare';
    const boss = bossTarget(G);
    const clear = boss && clearPath(A, P.x, P.y, boss.x, boss.y, 0.4) ? boss : nearestFoe(G, bot, P, 13);
    const near = G.mons.filter((m) => alive(m) && d2(m, P) < 5).length;
    const id = clear ? pickSkill(G, bot, clear, near) : null;
    if (id) {
        const i = P.slots.indexOf(id);
        inp.press[i] = true; inp.held[i] = true;
        inp.ax = clear.x; inp.ay = clear.y;
        inp.tx = clear.x; inp.ty = clear.y;
        bot.chase = null;
        return inp;
    }
    // a monster we can't hit from here: walk to it (for at most 8 s, then forget it)
    const tgt = clear || boss || nearestFoe(G, bot, P, 9, false);
    if (tgt && pursue(bot, tgt, 1 / 120)) {
        const d = d2(tgt, P);
        if (ranged && tgt === clear && d < 3 && near >= 2) { inp.mx = (P.x - tgt.x) / d; inp.my = (P.y - tgt.y) / d; return inp; }
        inp.tx = tgt.x; inp.ty = tgt.y;
        if (ranged && tgt === clear && d < 7) { inp.tx = P.x; inp.ty = P.y; }
        unstick(G, bot, inp);
        return inp;
    }
    // nothing near: loot in sight, then the next monster, then the way on
    const loot = G.drops.find((dr) => !bot.ignore[dr.id] && (dr.gold || (dr.item && !dr.dropped && G.items[dr.item] && (G.items[dr.item].rarity !== 'common' || G.items[dr.item].gem))) && d2(dr, P) < 12);
    if (loot && bagFree(G) >= 0 && pursue(bot, loot, 1 / 120)) { inp.tx = loot.x; inp.ty = loot.y; return inp; }
    const goal = exploreGoal(G, bot);
    if (goal && pursue(bot, goal, 1 / 120)) { inp.tx = goal.x; inp.ty = goal.y; }
    else { const ex = G.features.find((f) => f.kind === 'exit' && !f.locked) || G.area.exit; if (ex) { inp.tx = ex.x; inp.ty = ex.y; } }
    unstick(G, bot, inp);
    return inp;
}

/** Follow a goal for at most 8 s of game time without hitting it; after that it's ignored (it may be out of reach). */
function pursue(bot, goal, dt) {
    if (goal.id === undefined) return true;
    // time is kept per goal, so a bot that dithers between two goals still gives up on both
    const t = (bot.time[goal.id] = (bot.time[goal.id] || 0) + dt);
    if (t > (goal.boss ? 40 : 8)) {
        bot.ignore[goal.id] = true;
        if (Object.keys(bot.ignore).length > 400) { bot.ignore = {}; bot.time = {}; }
        return false;
    }
    return true;
}

function bossTarget(G) {
    const P = G.player;
    return G.mons.find((m) => m.boss && alive(m) && m.aggro && d2(m, P) < 18) || null;
}

/** Where to go when nothing is near: the nearest remaining monster, or the exit once the level is mostly clear. */
function exploreGoal(G, bot) {
    const P = G.player;
    const ex = G.features.find((f) => f.kind === 'exit' && !f.locked);
    const living = G.mons.filter((m) => alive(m) && !bot.ignore[m.id]);
    // clear about three quarters of an area before taking the way on, the way a person does
    if (bot.areaUid !== G.area.uid) { bot.areaUid = G.area.uid; bot.areaStart = G.mons.length; }
    const cleared = living.length < bot.areaStart * 0.25;
    // the boss's room is the exit's room
    const boss = living.find((m) => m.boss);
    if (boss) return boss;
    if (G.rift && !G.rift.done && living.length) return nearest(living, P);
    if (G.rift?.done && ex) return ex;
    if (ex && (cleared || living.length < 8)) return ex;
    if (living.length) return nearest(living, P);
    return ex || G.area.exit;
}
const nearest = (list, p) => list.reduce((a, b) => (d2(a, p) < d2(b, p) ? a : b));

function unstick(G, bot, inp) {
    const P = G.player;
    if (Math.hypot(P.x - bot.lastX, P.y - bot.lastY) < 0.01) bot.stuck++; else bot.stuck = 0;
    bot.lastX = P.x; bot.lastY = P.y;
    if (bot.stuck > 240) { bot.unstick = 60; bot.stuck = 0; bot.ua = G.rng() * 6.28; }
    if (bot.unstick > 0) { bot.unstick--; inp.tx = null; inp.mx = Math.cos(bot.ua); inp.my = Math.sin(bot.ua); }
}

function townInput(G, bot, inp) {
    const P = G.player;
    if (!bot.townDone) townChores(G, bot);
    // back through the portal if there is one
    const portal = G.features.find((f) => f.kind === 'portal');
    if (portal) { inp.tx = portal.x; inp.ty = portal.y; return inp; }
    // after the campaign: rifts
    if (G.won && P.riftBest < bot.rifts) { act(G, { t: 'riftOpen', tier: P.riftBest + 1 }); return inp; }
    if (G.won) return inp;
    // the furthest waystone we've found, else the gate
    const furthest = CAMPAIGN.slice().reverse().find((a) => P.waystones.includes(a));
    const ws = G.features.find((f) => f.kind === 'waystone');
    if (furthest) {
        if (d2(ws, P) < 2.5) act(G, { t: 'travel', area: furthest });
        else { inp.tx = ws.x; inp.ty = ws.y + 1; }
        return inp;
    }
    const gate = G.features.find((f) => f.id === 'gate');
    inp.tx = gate.x; inp.ty = gate.y;
    return inp;
}

