// An auto-player. It plays through the same actions and the same inputs as a person, so the tests,
// the balance table and the debug autoplay exercise the real rules. Pure.
//   skill 1: knows every affinity and personality, keeps the party healed, recodes what it lacks.
//   skill 0.5: guesses at weaknesses, rarely recodes, spends less carefully.

import { SKILLS } from './data/skills.js';
import { ITEMS, GEAR } from './data/items.js';
import { ZONES, STORY_ZONES, bossAt } from './data/zones.js';
import { DAEMONS } from './data/daemons.js';
import { RAPPORT, PERSONALITIES } from './data/daemons.js';
import { act, step, choicesOf, sceneNode, shopStock, priceOf, unlockedZones } from './game.js';
import { splicePreview } from './splice.js';
import { calc, partyUnits } from './units.js';
import { recodeInfo, alive, usable } from './battle.js';
import { findPath, cellAt, FLOOR } from './gen.js';
import { floorOf, los } from './explore.js';
import { baseline, AFFINITY_MULT } from '../config.js';
import { BONDERS, BOND_GATE } from './data/story.js';
import { makeRng } from '../rng.js';

export function makeBot({ skill = 1, seed = 1, goal = 'graft' } = {}) {
    return { skill, goal, rng: makeRng(seed), route: null, target: null, stuck: 0, lastPos: null, recodes: 0, hubDone: false, fights: 0, log: [] };
}

const PHYS = new Set(['strike', 'gun']);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ================================================================ one decision at a time
/**
 * Make the next decision. Returns 'step' if it advanced the real-time world, 'act' if it took an
 * action, or '' if there was nothing to do (the game is over or waiting on something unknown).
 */
export function botTick(G, bot, dt = 1 / 30) {
    switch (G.phase) {
        case 'scene': return sceneTick(G, bot);
        case 'hub': return hubTick(G, bot);
        case 'explore': return exploreTick(G, bot, dt);
        case 'battle': return battleTick(G, bot);
        case 'reward': return rewardTick(G, bot);
        case 'defeat': act(G, { type: 'ack' }); return 'act';
        case 'credits': act(G, { type: 'credits_done' }); return 'act';
        default: return '';
    }
}

// ================================================================ scenes
function sceneTick(G, bot) {
    const ch = choicesOf(G);
    if (ch) {
        const open = ch.filter((c) => !c.locked);
        // steer toward the ending the bot wants: graft if it can, else its goal
        let pick = open[open.length - 1];
        if (open.length === 3 && bot.goal === 'reboot') pick = open[0];
        else if (open.length === 3 && bot.goal === 'purge') pick = open[1];
        else if (open.length < 3 || !open.some((c) => c.need)) pick = open[bot.rng.int(0, open.length - 1)];
        act(G, { type: 'choose', i: pick.i });
    } else act(G, { type: 'next' });
    return 'act';
}

// ================================================================ the hub
function hubTick(G, bot) {
    // 1. things to spend on
    manageParty(G, bot);
    shop(G, bot);
    const sp = trySplice(G, bot);
    if (sp) return 'act';
    manageParty(G, bot);
    // 2. a bond if one is open and the story allows
    if (bot.skill >= 0.5 && !bot.hubDone) {
        bot.hubDone = true;
        for (const who of BONDERS) {
            const rank = G.bonds[who] + 1;
            if (rank <= 4 && G.chapter >= BOND_GATE[rank] && (who !== 'quill' || G.scrap > 200)) { act(G, { type: 'hangout', who }); return 'act'; }
        }
    }
    bot.hubDone = false;
    // 3. where to
    const open = unlockedZones(G);
    let zone = null;
    for (const id of STORY_ZONES) {
        if (!open.includes(id)) continue;
        const Z = ZONES[id];
        const lastBoss = Z.boss;
        if (!G.flags['boss_' + lastBoss]) { zone = id; break; }
    }
    const lv = G.agent.lv;
    if (zone) {
        const want = ZONES[zone].lv[0] + 2;
        if (lv < want && open.includes('rift') && bot.skill >= 0.5) zone = 'rift';
    } else zone = 'rift';
    if (!open.includes(zone)) zone = open[open.length - 1];
    const err = act(G, { type: 'deploy', zone });
    bot.route = null; bot.target = null;
    return err ? '' : 'act';
}

function manageParty(G, bot) {
    // the three strongest daemons, by level and a nudge for useful skills
    const score = (u) => u.lv * 10 + u.skills.reduce((s, id) => s + (SKILLS[id].kind === 'heal' ? 14 : SKILLS[id].kind === 'atk' ? SKILLS[id].pow / 8 : 0), 0);
    const want = [...G.stock].sort((a, b) => score(b) - score(a)).slice(0, 3).map((u) => u.uid);
    if (want.join() !== G.party.join()) act(G, { type: 'party', uids: want });
}

function shop(G, bot) {
    const st = shopStock(G);
    const have = (id) => G.items[id] || 0;
    const buyTo = (id, n) => { while (have(id) < n && G.scrap >= priceOf(G, id) + 40 && st.items.includes(id)) act(G, { type: 'buy', id, n: 1 }); };
    // upgrade gear first when it is affordable
    for (const slot of ['blade', 'coat', 'sidearm', 'charm']) {
        const cur = GEAR[G.gear[slot]];
        const best = st.gear.map((id) => GEAR[id]).filter((g) => g.slot === slot && g.price > (cur.price || 0)).sort((a, b) => b.price - a.price).find((g) => priceOf(G, g.id) + 120 <= G.scrap && !G.ownedGear.includes(g.id));
        if (best) { act(G, { type: 'buy', id: best.id }); }
        const owned = G.ownedGear.map((id) => GEAR[id]).filter((g) => g.slot === slot).sort((a, b) => b.price - a.price)[0];
        if (owned && G.gear[slot] !== owned.id) act(G, { type: 'equip', slot, id: owned.id });
    }
    buyTo('patch', bot.skill >= 0.8 ? 8 : 4);
    if (G.chapter >= 1) buyTo('kit', bot.skill >= 0.8 ? 4 : 1);
    buyTo('sap', 3);
    if (G.chapter >= 1) buyTo('seed', 2);
    if (G.chapter >= 3) buyTo('fullkit', 2);
    buyTo('smoke', 2);
    buyTo('beacon', 1);
    if (bot.skill >= 0.8) for (const g of ['honey', 'lullaby', 'sparkcell', 'glowfruit']) buyTo(g, 1);
    // chips: one good attack chip per visit, fills the Agent's slots
    const chips = st.items.map((id) => ITEMS[id]).filter((i) => i.kind === 'chip' && !G.agent.skills.includes(i.skill)).sort((a, b) => b.price - a.price);
    for (const c of chips) {
        const sk = SKILLS[c.skill];
        const worth = sk.kind === 'atk' || ['mendplus', 'mendall'].includes(sk.id);
        if (!worth || c.price * 2.2 > G.scrap) continue;
        if (sk.kind === 'atk' && G.agent.skills.filter((s) => SKILLS[s].kind === 'atk' && SKILLS[s].el === sk.el).length) continue;
        act(G, { type: 'buy', id: c.id });
        learnChip(G, c.id);
        break;
    }
}

function learnChip(G, id) {
    const it = ITEMS[id];
    const a = G.agent;
    let replace;
    if (a.skills.length >= 10) {
        // forget the weakest attack or the oldest utility
        let worst = 0, ws = 1e9;
        a.skills.forEach((s, i) => { const k = SKILLS[s]; const v = k.kind === 'atk' ? k.pow : k.kind === 'heal' ? 70 : 20; if (v < ws) { ws = v; worst = i; } });
        replace = worst;
    }
    act(G, { type: 'chip', item: id, replace });
}

function trySplice(G, bot) {
    if (bot.skill < 0.5 || G.stock.length < 2) return false;
    let best = null;
    for (let i = 0; i < G.stock.length; i++) for (let j = i + 1; j < G.stock.length; j++) {
        const a = G.stock[i], b = G.stock[j];
        const pv = splicePreview(G, a.uid, b.uid);
        if (!pv.ok || !pv.afford || G.scrap < pv.cost + 200) continue;
        const gain = pv.lv - Math.max(a.lv, b.lv);
        if (gain < 3) continue;
        // never melt a story daemon that has a better use
        if (DAEMONS[a.sp].boss || DAEMONS[b.sp].boss) continue;
        if (!best || gain > best.gain) best = { a, b, gain, pv };
    }
    if (!best) return false;
    const keep = best.pv.inherit.filter((s) => SKILLS[s].kind === 'atk' || SKILLS[s].kind === 'heal').sort((x, y) => (SKILLS[y].pow || 0) - (SKILLS[x].pow || 0)).slice(0, best.pv.slots);
    return act(G, { type: 'splice', a: best.a.uid, b: best.b.uid, keep }) === '';
}

// ================================================================ rewards
function rewardTick(G, bot) {
    if (G.pendingLearn.length) {
        const p = G.pendingLearn[0];
        const u = [G.agent, ...G.stock].find((x) => x.uid === p.uid);
        let worst = 0, ws = 1e9;
        u.skills.forEach((s, i) => { const k = SKILLS[s]; const v = k.kind === 'atk' ? k.pow : k.kind === 'heal' ? 70 : k.kind === 'pass' ? 60 : 20; if (v < ws) { ws = v; worst = i; } });
        const nk = SKILLS[p.skill];
        const nv = nk.kind === 'atk' ? nk.pow : nk.kind === 'heal' ? 70 : nk.kind === 'pass' ? 60 : 20;
        act(G, nv > ws ? { type: 'learn', replace: worst } : { type: 'learn', skip: true });
        return 'act';
    }
    act(G, { type: 'claim' });
    return 'act';
}

// ================================================================ exploration
function exploreTick(G, bot, dt) {
    const X = G.explore;
    if (X.menu) {
        // at an anchor: heal if we can; then carry on or leave
        if (X.menu === 'anchor') {
            act(G, { type: 'anchor' });
            const frac = partyHpFrac(G);
            if (frac < 0.5 && bot.skill >= 0.5) { act(G, { type: 'leaveZone' }); return 'act'; }
        }
        if (X.menu === 'gate') {
            const rec = floorOf(X);
            const done = rec.fl.exit && (rec.bossDone || !rec.fl.boss);
            if (done || shouldRetreat(G, bot)) { act(G, { type: 'leaveZone' }); return 'act'; }
            // walked into the gate by accident: step away
            act(G, { type: 'closeMenu' });
            bot.route = null; bot.target = { x: floorOf(X).fl.up.x + 3, y: floorOf(X).fl.up.y, why: 'away' };
            return 'act';
        }
        act(G, { type: 'closeMenu' });
        return 'act';
    }
    const rec = floorOf(X), fl = rec.fl, p = X.p;
    const frac = partyHpFrac(G);
    // heal with items out of battle when hurt
    if (frac < 0.6 && healOutside(G)) return 'act';
    // low and a beacon in the bag: go home
    if (frac < 0.3 && (G.items.beacon || 0) > 0 && !(fl.anchor && !rec.anchorUsed)) { act(G, { type: 'use', item: 'beacon' }); return 'act'; }
    // choose a target
    const here = (c) => Math.hypot(p.x - c.x - 0.5, p.y - c.y - 0.5) <= 1.0;
    let tgt = null;
    if (frac < 0.5 && fl.anchor && !rec.anchorUsed) tgt = { ...fl.anchor, why: 'anchor' };
    if (!tgt && bot.skill >= 0.5) { const c = rec.chests.filter((c) => !c.open).sort((a, b) => dist2(p, a) - dist2(p, b))[0]; if (c && pathLen(fl, p, c) < 40) tgt = { x: c.x, y: c.y, why: 'chest' }; }
    if (!tgt) {
        if (fl.boss && !rec.bossDone) tgt = { x: fl.boss.x, y: fl.boss.y, why: 'boss' };
        else if (fl.down) tgt = { x: fl.down.x, y: fl.down.y, why: 'down' };
        else if (fl.exit) tgt = { x: fl.exit.x, y: fl.exit.y, why: 'exit' };
    }
    if (!tgt) return '';
    const inp = { x: 0, y: 0, run: false, a: false };
    // arrived: interact
    if (here(tgt) && tgt.why !== 'boss') {
        inp.a = true;
        step(G, inp, dt);
        return 'step';
    }
    // Hexes close by: strike first for an ambush
    if (bot.skill >= 0.5) {
        const near = rec.foes.filter((f) => !f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 2.4 && f.st !== 'stun' && los(fl, p.x, p.y, f.x, f.y)).sort((a, b) => dist2(p, a) - dist2(p, b))[0];
        if (near) {
            const dx = near.x - p.x, dy = near.y - p.y, d = Math.hypot(dx, dy);
            inp.x = dx / d * 0.2; inp.y = dy / d * 0.2;
            let da = Math.atan2(dy, dx) - p.face; da = Math.atan2(Math.sin(da), Math.cos(da));
            inp.a = d < 1.3 && Math.abs(da) < 0.9;
            step(G, inp, dt);
            return 'step';
        }
    }
    // route
    const key = `${X.cur}:${tgt.x}:${tgt.y}`;
    if (!bot.route || bot.routeKey !== key || bot.stuck > 1.5) {
        const path = findPath(fl, Math.floor(p.x), Math.floor(p.y), tgt.x, tgt.y);
        bot.route = path || [];
        bot.routeKey = key;
        bot.stuck = 0;
    }
    while (bot.route.length && Math.hypot(bot.route[0][0] + 0.5 - p.x, bot.route[0][1] + 0.5 - p.y) < 0.28) bot.route.shift();
    const wp = bot.route[0];
    if (wp) {
        const dx = wp[0] + 0.5 - p.x, dy = wp[1] + 0.5 - p.y, d = Math.hypot(dx, dy) || 1;
        inp.x = dx / d; inp.y = dy / d; inp.run = true;
    } else {
        const dx = tgt.x + 0.5 - p.x, dy = tgt.y + 0.5 - p.y, d = Math.hypot(dx, dy) || 1;
        inp.x = dx / d; inp.y = dy / d;
    }
    const before = { x: p.x, y: p.y };
    step(G, inp, dt);
    if (G.phase === 'explore') {
        const q = G.explore.p;
        bot.stuck = Math.hypot(q.x - before.x, q.y - before.y) < 0.002 ? bot.stuck + dt : 0;
    }
    return 'step';
}

const dist2 = (p, c) => (p.x - c.x - 0.5) ** 2 + (p.y - c.y - 0.5) ** 2;
const pathLen = (fl, p, c) => { const r = findPath(fl, Math.floor(p.x), Math.floor(p.y), c.x, c.y); return r ? r.length : 1e9; };

function partyHpFrac(G) {
    const us = partyUnits(G);
    let hp = 0, mx = 0;
    for (const u of us) { const c = calc(G, u); hp += u.hp; mx += c.maxhp; }
    return hp / mx;
}

function shouldRetreat(G, bot) { return partyHpFrac(G) < 0.35 && (G.items.patch || 0) + (G.items.kit || 0) < 2; }

function healOutside(G) {
    const us = partyUnits(G);
    const hurt = us.map((u) => ({ u, c: calc(G, u) })).filter(({ u, c }) => u.hp > 0 && u.hp / c.maxhp < 0.55).sort((a, b) => a.u.hp / a.c.maxhp - b.u.hp / b.c.maxhp)[0];
    const dead = us.find((u) => u.hp <= 0);
    if (dead) for (const id of ['bloom', 'seed']) if ((G.items[id] || 0) > 0) { act(G, { type: 'use', item: id, uid: dead.uid }); return true; }
    if (!hurt) return false;
    for (const id of ['kit', 'patch', 'fullkit']) if ((G.items[id] || 0) > 0) { act(G, { type: 'use', item: id, uid: hurt.u.uid }); return true; }
    // the Agent's own heal spells
    return false;
}

// ================================================================ battle
function battleTick(G, bot) {
    const B = G.battle;
    if (B.neg) return negTick(G, bot);
    const cmd = battleDecision(G, bot);
    const err = act(G, cmd);
    if (err) {
        // never loop on a refusal
        const e2 = act(G, { kind: 'guard' }); if (e2) act(G, { kind: 'attack', target: alive(B, 'e')[0]?.id });
    }
    return 'act';
}

const knownAff = (G, bot, t, el) => {
    if (el === 'root') return undefined;
    if (bot.skill >= 0.8 || G.dex[t.sp]?.aff[el]) return t.aff[el];
    return undefined;
};

function estimate(G, bot, a, sk, t) {
    const off = sk.el === 'gun' ? a.st * 0.4 + a.ag * 0.6 + a.gunBonus : sk.el === 'strike' ? a.st : a.ma;
    const def = PHYS.has(sk.el) ? t.vi : t.vi * 0.5 + t.ma * 0.5;
    let d = baseline(a.lv) * (sk.pow / 40) * Math.pow(clamp((off + 6) / (def + 6), 0.35, 2.6), 0.85);
    const aff = knownAff(G, bot, t, sk.el);
    if (aff === 'w') d *= 1.5 * 1.6;
    else if (aff === 'r') d *= 0.5;
    else if (aff === 'n' || aff === 'p' || aff === 'd') d *= 0.02;
    return d;
}

export function battleDecision(G, bot) {
    const B = G.battle;
    const a = B.units[B.actor];
    const foes = alive(B, 'e'), mates = alive(B, 'p');
    const smart = bot.skill >= 0.5;
    // 1. keep people up
    const hurt = mates.filter((m) => m.hp / m.maxhp < (smart ? 0.42 : 0.3)).sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp);
    if (hurt.length) {
        const heals = a.skills.map((id) => SKILLS[id]).filter((s) => s.kind === 'heal' && !usable(B, a, s));
        if (heals.length) {
            const multi = hurt.length >= 2 ? heals.find((s) => s.tgt === 'allies') : null;
            const one = heals.filter((s) => s.tgt === 'ally').sort((x, y) => y.pow - x.pow)[0];
            const pickH = multi || one;
            if (pickH) return { kind: 'skill', skill: pickH.id, target: pickH.tgt === 'ally' ? hurt[0].id : -1 };
        }
        if (a.agent || smart) {
            for (const id of ['kit', 'patch', 'fullkit']) if ((G.items[id] || 0) > 0) return { kind: 'item', item: id, target: hurt[0].id };
        }
    }
    const dead = B.units.filter((u) => u.side === 'p' && !u.alive);
    if (dead.length && smart) {
        const rv = a.skills.map((id) => SKILLS[id]).find((s) => s.kind === 'revive' && !usable(B, a, s));
        if (rv) return { kind: 'skill', skill: rv.id, target: dead[0].id };
        for (const id of ['seed', 'bloom']) if ((G.items[id] || 0) > 0 && a.agent) return { kind: 'item', item: id, target: dead[0].id };
    }
    if (B.allOut) return { kind: 'allout' };
    // team buffs open a hard fight
    if (smart && B.kind !== 'normal' && B.round <= 2 && !a.boss) {
        const buff = a.skills.map((id) => SKILLS[id]).find((s) => s.kind === 'buff' && s.tgt === 'allies' && !usable(B, a, s) && mates.some((m) => m.buff[s.stat] < 1));
        if (buff && bot.rng() < 0.7) return { kind: 'skill', skill: buff.id, target: -1 };
    }
    // 2. recode what the Greenhouse lacks
    if (smart && B.kind === 'normal' && foes.length && a.agent) {
        const cand = foes.filter((f) => recodeInfo(G, B, f).ok && !G.stock.some((u) => u.sp === f.sp) && f.lv >= a.lv - 6);
        if (cand.length && !(bot.recodesBattleRef === B && bot.recodesThisBattleCount >= 2)) {
            if (bot.recodesBattleRef !== B) { bot.recodesBattleRef = B; bot.recodesThisBattleCount = 0; }
            bot.recodesThisBattleCount++;
            return { kind: 'recode', target: cand.sort((x, y) => y.lv - x.lv)[0].id };
        }
    }
    // 3. hit hard where it hurts
    let best = null;
    const options = ['attack', ...a.skills.filter((id) => SKILLS[id].kind === 'atk')];
    for (const id of options) {
        const sk = SKILLS[id];
        if (usable(B, a, sk) && id !== 'attack') continue;
        if (id === 'attack' && a.agent && false) continue;
        const mpPenalty = sk.mp ? 1 - Math.min(0.5, sk.mp / Math.max(1, a.mp) * 0.4) : 1;
        const hpPenalty = sk.hp ? 1 - sk.hp / 100 * 1.5 : 1;
        if (sk.tgt === 'one') {
            for (const t of foes) {
                let s = estimate(G, bot, a, sk, t) * mpPenalty * hpPenalty;
                s *= 1 + (1 - t.hp / t.maxhp) * 0.3;
                if (smart && t.hp <= estimate(G, bot, a, sk, t) * 0.9) s *= 1.4;
                if (!best || s > best.s) best = { s, cmd: id === 'attack' ? { kind: 'attack', target: t.id } : { kind: 'skill', skill: id, target: t.id } };
            }
        } else {
            let s = 0;
            const hits = sk.tgt === 'rand' ? (sk.hits[0] + sk.hits[1]) / 2 : foes.length;
            for (const t of foes) s += estimate(G, bot, a, sk, t) * (sk.tgt === 'rand' ? hits / foes.length : 1);
            s *= mpPenalty * hpPenalty * 0.92;
            if (!best || s > best.s) best = { s, cmd: { kind: 'skill', skill: id, target: -1 } };
        }
    }
    if (!smart && bot.rng() < 0.3) { const t = foes[bot.rng.int(0, foes.length - 1)]; return { kind: 'attack', target: t.id }; }
    return best ? best.cmd : { kind: 'guard' };
}

function negTick(G, bot) {
    const B = G.battle, neg = B.neg;
    if (neg.demand) {
        const d = neg.demand;
        const can = d.kind === 'item' ? (G.items[d.id] || 0) > 0 : d.kind === 'scrap' ? G.scrap >= d.n + 60 : d.kind === 'hp' ? B.units.find((u) => u.agent).hp > B.units.find((u) => u.agent).maxhp * 0.5 : B.units.find((u) => u.agent).mp >= d.n + 4;
        act(G, { kind: 'neg', op: can ? 'accept' : 'refuse' });
        return 'act';
    }
    const likes = PERSONALITIES[neg.pers].likes;
    if (bot.skill >= 0.8 && (G.items[likes] || 0) > 0 && neg.rapport < neg.need - 1) { act(G, { kind: 'neg', op: 'gift', item: likes }); return 'act'; }
    let i;
    if (bot.skill >= 0.8) i = RAPPORT[neg.pers].indexOf(Math.max(...RAPPORT[neg.pers]));
    else i = bot.rng.int(0, 3);
    act(G, { kind: 'neg', op: 'script', i });
    return 'act';
}

/**
 * Play a whole game with the bot, collecting what the balance table needs.
 * Returns { ok, ticks, days, lv, ending, defeats, battles, bosses: [{id, lv, turns, hpLeft}], recodes, splices, stuck }.
 */
export function playThrough(G, bot, { maxTicks = 400000, onTick = null } = {}) {
    const st = { ok: false, ticks: 0, defeats: 0, battles: 0, flees: 0, bosses: [], recodes: 0, splices: 0, kills: 0, stuck: null, lvAtBoss: {} };
    let bossRec = null;
    while (G.phase !== 'credits' && st.ticks < maxTicks) {
        const r = botTick(G, bot);
        for (const e of G.events) {
            if (e.type === 'b_start') { st.battles++; if (e.kind !== 'normal') { bossRec = { id: G.battle.tag, lv: G.agent.lv, round: 0, hp: partyHpFrac(G), party: partyUnits(G).map((u) => u.lv) }; } }
            else if (e.type === 'b_end') {
                if (e.result === 'lose') st.defeats++;
                if (e.result === 'flee') st.flees++;
                if (bossRec) { bossRec.round = G.battle ? G.battle.round : 0; bossRec.result = e.result; st.bosses.push(bossRec); bossRec = null; }
            }
            else if (e.type === 'b_recoded') st.recodes++;
            else if (e.type === 'splice') st.splices++;
        }
        G.events.length = 0;
        if (onTick) onTick(G, st);
        if (!r) { st.stuck = G.phase + ':' + (G.scene ? G.scene.id : ''); break; }
        st.ticks++;
    }
    st.ok = G.phase === 'credits';
    st.days = G.day; st.lv = G.agent.lv; st.ending = G.ending;
    return st;
}
