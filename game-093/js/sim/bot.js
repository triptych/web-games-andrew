// An auto-player. It plays through the same act() / step() calls a person's input becomes, so the tests, the balance table and
// the title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.

import { SKILLS, TYPE_INFO } from './data/classes.js';
import { ITEMS, weaponFor, armorFor, TIERS } from './data/items.js';
import { MOVES, ZONES } from './data/enemies.js';
import { BEATS } from './data/story.js';
import { walkPath, reach } from './world/nav.js';
import { LOCS, ZONE_KEYS } from './world/locations.js';
import { WALKABLE } from './world/tiles.js';
import { anchorPos } from './world/maps.js';
import { act, objective, curMap, serialize, deserialize } from './game.js';
import { legalSkills, living, canAct } from './battle.js';
import { memberStats, avgLevel, count, canEquip } from './party.js';
import { CHARS } from './data/classes.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, path: null, pathKey: '', pathT: 0, stuckT: 0, last: [0, 0], jitter: 0, shopped: {}, task: null, retries: 0, grindPace: 0, log: [], quiet: true, steps: 0 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function restore(G, bot) {
    const g2 = deserialize(bot.ckpt);
    for (const k of Object.keys(g2)) G[k] = g2[k];
    G.rng.setState((G.rng.state() ^ ((bot.restores || 0) * 7919 + 13)) | 0);   // a different roll of the dice this time
    bot.path = null; bot.extraLv = (bot.extraLv || 0) + 1.5; bot.paceKey = '';
}

export function lockMask(G, map) {
    if (!map.lockIdx) return null;
    const m = new Uint8Array(map.w * map.h);
    for (let i = 0; i < m.length; i++) if (map.lockIdx[i] && !G.flags[map.locks[map.lockIdx[i]].flag]) m[i] = 1;
    return m;
}

// ------------------------------------------------------------------ the whole decision, once per step
export function botInput(G, bot) {
    bot.steps++;
    const none = { x: 0, y: 0, a: false };
    if (G.warp || G.pending) return none;
    switch (G.mode) {
        case 'scene': return sceneInput(G, bot, none);
        case 'battle': return battleInput(G, bot, none);
        case 'shop': return none; // handled by the shop task
        case 'board': act(G, { type: 'closeBoard' }); return none;
        case 'gameover':
            if (bot.retries++ < 2) act(G, { type: 'retry' });
            else if (bot.ckpt) { restore(G, bot); bot.retries = 0; bot.restores = (bot.restores || 0) + 1; }
            return none;
        case 'ending': act(G, { type: 'endingDone' }); return none;
        case 'field': return fieldInput(G, bot);
    }
    return none;
}

function sceneInput(G, bot, none) {
    const S = G.scene;
    if (!S) return none;
    if (S.choice) {
        // prefer the generous ending, otherwise accept whatever is offered
        let i = S.choice.findIndex((o) => /Share/.test(o.text));
        if (i < 0) i = 0;
        act(G, { type: 'choose', i });
        return none;
    }
    if (S.line) act(G, { type: 'advance' });
    return none;
}

// ------------------------------------------------------------------ battle
function dmgScore(u, sk, tgt, B) {
    const magic = sk.kind === 'mag';
    const pow = (sk.pow || 1) * (sk.hits || 1);
    let type = sk.type;
    if (type === 'auto') type = tgt.weak.find((w) => !tgt.revealed.has(w)) || tgt.weak[0];
    const known = tgt.revealed.has(type);
    const isWeak = type && tgt.weak.includes(type);
    const isRes = type && tgt.resist.includes(type);
    let s = pow * (magic ? u.mag : u.atk) / (100 + (magic ? tgt.res : tgt.def));
    if (known && isWeak) s *= 2.0; else if (isWeak) s *= 1.15;
    if (known && isRes) s *= 0.35;
    if (tgt.broken) s *= 1.6;
    if (sk.sh && isWeak) s *= 1.3 + 0.1 * sk.sh;
    return s;
}

function battleInput(G, bot, none) {
    const B = G.battle;
    if (!B) return none;
    if (B.result) { act(G, { type: 'battleDone' }); return none; }
    if (!canAct(G)) return none;
    const u = B.units.find((x) => x.id === B.actor);
    const foes = living(B, 'enemy'), allies = B.units.filter((x) => x.side === 'party');
    const alive = allies.filter((a) => a.hp > 0);
    const hpFrac = alive.reduce((a, x) => a + x.hp / x.mhp, 0) / Math.max(1, allies.length);
    if (!B.noFlee && hpFrac < 0.38 && !count(G, 'phoenixDown') && act(G, { type: 'b', cmd: { type: 'flee' } })) return none;
    const cmd = chooseCommand(G, B, u, foes, allies, bot);
    if (!act(G, { type: 'b', cmd })) {
        // fall back to something that always works
        act(G, { type: 'b', cmd: { type: 'attack', target: foes[0].id, boost: 0 } });
    }
    return none;
}

function chooseCommand(G, B, u, foes, allies, bot) {
    const rnd = () => G.rng();
    const skills = legalSkills(G, u).filter((s) => s.mp <= u.mp);
    const hurt = allies.filter((a) => a.hp > 0 && a.hp / a.mhp < 0.45).sort((a, b) => a.hp / a.mhp - b.hp / b.mhp);
    const dead = allies.filter((a) => a.hp <= 0);
    const phoenix = count(G, 'phoenixDown'), pot = ['xPotion', 'hiPotion', 'potion'].find((i) => count(G, i) > 0);
    const bp = u.bp;
    // revive and heal first
    const raise = skills.find((s) => s.fx === 'revive');
    if (dead.length && raise) return { type: 'skill', skill: raise.id, target: dead[0].id, boost: 0 };
    if (dead.length && phoenix && rnd() < 0.8) return { type: 'item', item: 'phoenixDown', target: dead[0].id };
    if (hurt.length) {
        const healAll = skills.find((s) => s.kind === 'heal' && s.tgt === 'allies' && s.fx !== 'reviveAll');
        const heal1 = skills.find((s) => s.kind === 'heal' && s.tgt === 'ally' && !s.fx);
        if (hurt.length >= 2 && healAll) return { type: 'skill', skill: healAll.id, target: hurt[0].id, boost: 0 };
        if (heal1 && (u.ref === 'elara' || hurt[0].hp / hurt[0].mhp < 0.3)) return { type: 'skill', skill: heal1.id, target: hurt[0].id, boost: bp >= 2 && hurt[0].hp / hurt[0].mhp < 0.25 ? 1 : 0 };
        if (pot && hurt[0].hp / hurt[0].mhp < 0.3) return { type: 'item', item: pot, target: hurt[0].id };
    }
    if (u.ref === 'elara' && !hurt.length) {
        const buff = skills.find((s) => s.id === 'regen');
        if (B.round <= 1 && buff && B.boss && !allies.some((a) => a.status.regen)) return { type: 'skill', skill: 'regen', target: u.id, boost: 0 };
    }
    // opening buffs and utility on bosses
    if (B.boss && B.round <= 1) {
        const open = skills.find((s) => ['heroicCry', 'quickstepDance', 'bulwark', 'hawkeye'].includes(s.id) && !allies.some((a) => a.status.atkUp && s.id === 'heroicCry'));
        if (open && rnd() < 0.8) return { type: 'skill', skill: open.id, target: u.id, boost: 0 };
        const an = skills.find((s) => s.fx === 'analyze');
        if (an) return { type: 'skill', skill: an.id, target: foes.sort((a, b) => b.mhp - a.mhp)[0].id, boost: 0 };
    }
    const an = skills.find((s) => s.fx === 'analyze');
    if (an && foes.some((f) => f.revealed.size < Math.min(2, f.weak.length)) && u.mp > 20 && rnd() < 0.7) return { type: 'skill', skill: an.id, target: foes.sort((a, b) => (a.revealed.size - b.revealed.size))[0].id, boost: 0 };
    const stealer = skills.find((s) => s.fx === 'steal');
    if (stealer && B.round === 1 && foes.some((f) => !f.stolen && f.mhp > 0) && rnd() < 0.4) return { type: 'skill', skill: stealer.id, target: foes[0].id, boost: 0 };
    // damage: score every attack against every target
    const cand = [];
    const wt = u.weaponType;
    const basic = { id: 'attack', kind: wt === 'staff' || wt === 'tome' ? 'mag' : 'phys', pow: wt === 'staff' || wt === 'tome' ? 0.85 : 1, type: wt === 'staff' || wt === 'tome' ? null : wt, hits: 1, mp: 0, tgt: 'one', sh: 0 };
    const dmgSkills = [basic, ...skills.filter((s) => (s.kind === 'phys' || s.kind === 'mag') && s.fx !== 'gravity')];
    if (skills.find((s) => s.fx === 'gravity') && B.boss && rnd() < 0.2) return { type: 'skill', skill: 'gravity', target: foes[0].id, boost: 0 };
    for (const sk of dmgSkills) {
        const mpCost = sk.mp || 0;
        const mpOk = mpCost <= u.mp * (B.boss ? 0.9 : 0.55) || mpCost === 0;
        if (!mpOk) continue;
        if (sk.tgt === 'all' || sk.tgt === 'rand') {
            let s = 0; for (const f of foes) s += dmgScore(u, sk, f, B) * (sk.tgt === 'rand' ? 0.9 : 1);
            cand.push({ sk, tgt: foes[0], s: s * 0.95 - mpCost * 0.004, all: true });
        } else for (const f of foes) cand.push({ sk, tgt: f, s: dmgScore(u, sk, f, B) - mpCost * 0.004 + (f.mhp - f.hp < 1 ? 0 : 0) - (f.hp / f.mhp) * 0.02 });
    }
    if (bot.skill < 1 && rnd() > bot.skill) { const f = foes[Math.floor(rnd() * foes.length)]; return { type: 'attack', target: f.id, boost: 0 }; }
    cand.sort((a, b) => b.s - a.s);
    const best = cand[0];
    if (!best) return { type: 'defend' };
    // boost when it breaks a shield or the foe is already broken, or when there is Boost to burn
    let boost = 0;
    if (bp >= 1 && (best.tgt.broken || (best.tgt.weak.includes(best.sk.type) && best.tgt.shield <= 1 + bp))) boost = Math.min(bp, 3);
    else if (bp >= 4) boost = Math.min(bp - 2, 2);
    if (best.sk.id === 'attack') return { type: 'attack', target: best.tgt.id, boost };
    return { type: 'skill', skill: best.sk.id, target: best.tgt.id, boost };
}

// ------------------------------------------------------------------ field
function partyHealth(G) {
    let hp = 0, mhp = 0, mp = 0, mmp = 0, ko = 0;
    for (const id of G.party.active) { const m = G.party.members[id], s = memberStats(m); hp += m.hp; mhp += s.mhp; mp += m.mp; mmp += s.mmp; if (m.hp <= 0) ko++; }
    return { hp: hp / mhp, mp: mp / Math.max(1, mmp), ko };
}

export function autoEquip(G) {
    for (const id of G.party.active.concat(G.party.reserve)) {
        const m = G.party.members[id];
        for (const slot of ['weapon', 'armor', 'charm']) {
            let best = m.equip[slot], bv = best ? value(ITEMS[best]) : -1;
            for (const [iid] of Object.entries(G.inv)) {
                const it = ITEMS[iid];
                if (it.type !== slot || !canEquip(id, iid)) continue;
                const v = value(it);
                if (v > bv) { best = iid; bv = v; }
            }
            if (best && best !== m.equip[slot]) act(G, { type: 'equip', id, item: best });
        }
    }
}
const value = (it) => Object.values(it.stats || {}).reduce((a, b) => a + b, 0) + (it.tier || 0) * 0.1;

function lowHealth(G) { const h = partyHealth(G); return h.hp < 0.55 || h.ko > 0 || h.mp < 0.18; }

function fieldInput(G, bot) {
    const map = curMap(G);
    const none = { x: 0, y: 0, a: false };
    autoEquip(G);
    const h = partyHealth(G);
    // consumables
    if (h.hp < 0.5 || h.ko) {
        if (G.party.active.some((id) => G.party.members[id].hp <= 0) && count(G, 'phoenixDown')) { const m = G.party.active.find((id) => G.party.members[id].hp <= 0); act(G, { type: 'useItem', item: 'phoenixDown', target: m }); }
        if (h.hp < 0.45) for (const id of G.party.active) {
            const m = G.party.members[id], s = memberStats(m);
            if (m.hp > 0 && m.hp / s.mhp < 0.45) { const p = ['xPotion', 'hiPotion', 'potion'].find((i) => count(G, i) > 0); if (p) act(G, { type: 'useItem', item: p, target: id }); }
        }
    }
    if ((partyHealth(G).hp < 0.4 || partyHealth(G).mp < 0.15) && count(G, 'tent')) act(G, { type: 'useItem', item: 'tent' });
    const obj = objective(G);
    if (G.stats.playtime - (bot.ckptT ?? -999) > 240 && G.mode === 'field') { bot.ckpt = serialize(G); bot.ckptT = G.stats.playtime; }
    // hurt on the road: walk to the nearest town and sleep
    if (map.kind === 'over' && lowHealth(G) && G.gold >= Math.round(10 + avgLevel(G) * 5) && !count(G, 'tent')) {
        let best = null, bd = 1e9;
        for (const L of Object.values(LOCS)) {
            if (L.kind !== 'town' || !G.visited[L.id]) continue;
            const d = Math.hypot(L.x - G.px, L.y - G.py);
            if (d < bd) { bd = d; best = L; }
        }
        if (best) return goTo(G, bot, map, best.x + 0.5, best.y + 1.5, 0.4);
    }
    // in town: shop, rest, then leave
    if (map.kind === 'town') {
        const tk = townTask(G, bot, map);
        if (tk) return goInteract(G, bot, map, tk.x, tk.y, tk.then);
    }
    // heal at the crystal when a dungeon has bruised us
    if (map.kind === 'dungeon' && lowHealth(G) && !count(G, 'tent')) {
        const s = map.props.find((p) => p.type === 'save');
        if (s) return goInteract(G, bot, map, s.x + 0.5, s.y + 1.2, () => true);
    }
    const lv = avgLevel(G);
    if (G.story.i > (bot.maxBeat ?? -1)) { bot.maxBeat = G.story.i; bot.extraLv = 0; }
    const need = (obj ? obj.rec : 1) + (bot.extraLv || 0);
    // grind: monsters are the XP, so walk to them
    if (obj && lv < need - 0.2 && (map.kind !== 'town')) {
        if (map.kind === 'dungeon' && map.mobs.length) {
            const mb = map.mobs.reduce((a, b) => (Math.hypot(a.x - G.px, a.y - G.py) < Math.hypot(b.x - G.px, b.y - G.py) ? a : b));
            return goTo(G, bot, map, mb.x, mb.y, 0.4);
        }
        if (map.kind === 'over') return pace(G, bot, map);
    }
    if (!obj) return pace(G, bot, map);
    if (obj.kind === 'leave' && map.kind === 'town' && lv < need - 0.2) return goTo(G, bot, map, obj.x, obj.y, 0.5);
    // close enough to speak? press the button
    const b = BEATS[G.story.i];
    const isTalk = b && b.trig.t === 'talk' && obj.here;
    if (isTalk) {
        const npc = map.npcs.find((n) => n.id === b.trig.npc);
        if (npc && Math.hypot(npc.x - G.px, npc.y - G.py) < 1.35) { const dx = npc.x - G.px, dy = npc.y - G.py; return { x: clamp(dx, -0.2, 0.2), y: clamp(dy, -0.2, 0.2), a: true }; }
    }
    return goTo(G, bot, map, obj.x, obj.y, isTalk ? 0.3 : b?.trig.t === 'near' ? 0.7 : 0.45);
}

function pace(G, bot, map) {
    if (map.kind !== 'over') { const e = map.exits[0]; return goTo(G, bot, map, e.x + (e.w || 1) / 2, e.y + 0.5, 0.5); }
    // grind where the monsters are the right size: a few steps short of the place the story is sending us
    const obj = objective(G);
    const key = obj ? obj.target : 'none';
    if (bot.paceKey !== key || !bot.paceC) {
        bot.paceKey = key;
        bot.paceC = grindSpot(G, map, obj);
    }
    const ph = Math.floor(bot.steps / 500) % 2;
    const [cx, cy] = bot.paceC;
    return goTo(G, bot, map, cx + (ph ? 3 : -3), cy, 0.6);
}

// ------------------------------------------------------------------ navigation
function goTo(G, bot, map, tx, ty, r = 0.4) {
    const none = { x: 0, y: 0, a: false };
    const dx = tx - G.px, dy = ty - G.py;
    if (Math.hypot(dx, dy) < r) return none;
    const key = `${map.id}:${Math.floor(tx)}:${Math.floor(ty)}`;
    bot.pathT -= 1;
    if (!bot.path || bot.pathKey !== key || bot.pathT <= 0) {
        let locks = lockMask(G, map);
        if (bot.steps < (bot.avoid || 0)) {
            // someone is standing in the way: route around the villagers for a while
            locks = locks ? locks.slice() : new Uint8Array(map.w * map.h);
            for (const n of map.npcs) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const ix = Math.floor(n.x) + dx, iy = Math.floor(n.y) + dy; if (ix >= 0 && iy >= 0 && ix < map.w && iy < map.h && !(ix === Math.floor(tx) && iy === Math.floor(ty))) locks[iy * map.w + ix] = 1; }
        }
        let p = walkPath(map, G.px, G.py, Math.floor(tx), Math.floor(ty), locks);
        if (!p) for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0], [0, -2]]) { p = walkPath(map, G.px, G.py, Math.floor(tx) + ox, Math.floor(ty) + oy, locks); if (p) break; }
        bot.path = p; bot.pathKey = key; bot.pathT = p ? 90 : 45; bot.idx = 1;
    }
    const p = bot.path;
    if (!p || p.length < 2) return { x: clamp(dx, -1, 1), y: clamp(dy, -1, 1), a: false };
    while (bot.idx < p.length - 1 && Math.hypot(p[bot.idx][0] + 0.5 - G.px, p[bot.idx][1] + 0.5 - G.py) < 0.4) bot.idx++;
    let [nx, ny] = [p[Math.min(bot.idx, p.length - 1)][0] + 0.5, p[Math.min(bot.idx, p.length - 1)][1] + 0.5];
    // the last node: aim at the real target
    if (bot.idx >= p.length - 1) { nx = tx; ny = ty; }
    let vx = nx - G.px, vy = ny - G.py;
    const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    // stuck? nudge
    bot.stuckT += 1;
    if (bot.stuckT % 60 === 0) {
        const moved = Math.hypot(G.px - bot.last[0], G.py - bot.last[1]);
        bot.last = [G.px, G.py];
        if (moved < 0.1) { bot.jitter = 20; bot.pathT = 0; bot.avoid = bot.steps + 900; }
    }
    if (bot.jitter > 0) { bot.jitter--; const a = (bot.steps * 0.37) % (Math.PI * 2); return { x: Math.cos(a), y: Math.sin(a), a: false }; }
    return { x: vx, y: vy, a: false };
}

function goInteract(G, bot, map, tx, ty, then) {
    const d = Math.hypot(tx - G.px, ty - G.py);
    if (d < 0.7) {
        const r = then?.(G);
        // face the thing and press
        return { x: 0, y: 0, a: r !== false, face: true };
    }
    return goTo(G, bot, map, tx, ty, 0.5);
}

// ------------------------------------------------------------------ town chores: buy, rest
function townTask(G, bot, map) {
    const key = map.id + ':' + G.story.i;
    const cost = Math.round(10 + avgLevel(G) * 5);
    if (G.mode !== 'field') return null;
    const gear = map.anchors.gear, shop = map.anchors.shop, inn = map.anchors.inn;
    if (!bot.shopped[key + ':gear'] && gear && G.gold > 150) {
        return { x: gear[0] + 0.5, y: gear[1] + 0.5, then: () => { bot.shopped[key + ':gear'] = 1; enterShopAndBuy(G, bot, 'gear'); return false; } };
    }
    if (!bot.shopped[key + ':item'] && shop && G.gold > 60) {
        return { x: shop[0] + 0.5, y: shop[1] + 0.5, then: () => { bot.shopped[key + ':item'] = 1; enterShopAndBuy(G, bot, 'item'); return false; } };
    }
    const h = partyHealth(G);
    if ((h.hp < 0.9 || h.mp < 0.7 || h.ko) && inn && G.gold >= cost) {
        return { x: inn[0] + 0.5, y: inn[1] + 0.5, then: () => { G.gold -= cost; act(G, { type: 'rest' }); return false; } };
    }
    return null;
}

function enterShopAndBuy(G, bot, kind) {
    const map = curMap(G);
    const L = LOCS[map.id];
    // open the shop through the real door interaction
    const stockMod = import_shopStock(kind, L.tier);
    G.shop = { kind: kind === 'gear' ? 'gear' : 'shop', town: map.id, stock: stockMod };
    G.mode = 'shop';
    let budget = G.gold;
    if (kind === 'item') {
        const want = [['potion', 6], ['hiPotion', 6], ['xPotion', 4], ['phoenixDown', 4], ['ether', 3], ['hiEther', 3], ['tent', 2]];
        for (const [id, n] of want) {
            if (!stockMod.includes(id)) continue;
            while (count(G, id) < n && G.gold > ITEMS[id].price + (id === 'potion' ? 0 : 300)) if (!act(G, { type: 'buy', item: id })) break;
        }
    } else {
        // buy the best tier available for every character, weapon first
        for (const cid of G.party.active.concat(G.party.reserve)) {
            const c = CHARS[cid], m = G.party.members[cid];
            const wanted = [];
            for (const t of [TIERS - 1, TIERS - 2, TIERS - 3, TIERS - 4, TIERS - 5, TIERS - 6]) {
                const w = weaponFor(c.weapon, t), a = armorFor(c.armor[0], t);
                wanted.push(w, a);
            }
            const curW = ITEMS[m.equip.weapon]?.tier ?? -1, curA = ITEMS[m.equip.armor]?.tier ?? -1;
            for (const id of wanted) {
                if (!stockMod.includes(id) || count(G, id) > 0) continue;
                const it = ITEMS[id];
                if (it.type === 'weapon' && it.tier <= curW) continue;
                if (it.type === 'armor' && it.tier <= curA) continue;
                if (G.gold >= it.price) act(G, { type: 'buy', item: id });
            }
        }
        autoEquip(G);
    }
    act(G, { type: 'closeShop' });
}
import { shopStock } from './data/items.js';
function import_shopStock(kind, tier) { return shopStock(kind === 'gear' ? 'gear' : 'item', tier, null, CHARS); }

/** A patch of open ground well away from any town, where the monsters are not too much for us. */
function grindSpot(G, map, obj) {
    const lv = avgLevel(G);
    const L = obj && LOCS[obj.target];
    const locks = lockMask(G, map);
    const near = (x, y, d) => Object.values(LOCS).some((q) => Math.hypot(q.x - x, q.y - y) < d);
    let best = null, bs = 1e9;
    const cx = G.px, cy = G.py;
    for (let r = 7; r <= 22; r += 3) for (let a = 0; a < 16; a++) {
        const x = Math.round(cx + Math.cos(a * 0.3927) * r), y = Math.round(cy + Math.sin(a * 0.3927) * r);
        if (x < 4 || y < 4 || x >= map.w - 4 || y >= map.h - 4) continue;
        const i = y * map.w + x;
        if (map.blk[i] || near(x, y, 7) || !WALKABLE[map.tile[i]] || locks?.[i]) continue;
        if (![-3, 3].every((o) => WALKABLE[map.tile[y * map.w + x + o]] && !map.blk[y * map.w + x + o])) continue;
        const zk = ZONE_KEYS[map.zone[i]];
        if (ZONES[zk].lvl[0] > lv + 1.2) continue;
        // prefer spots toward the goal, and closer to us
        const score = r * 0.6 + (L ? Math.hypot(L.x - x, L.y - y) * 0.5 : 0) - ZONES[zk].lvl[0] * 1.2;
        if (score >= bs) continue;
        const p = walkPath(map, cx, cy, x, y, locks);
        if (!p) continue;
        best = [x + 0.5, y + 0.5]; bs = score;
    }
    return best || [cx, cy];
}

/** One command for the hero whose turn it is, chosen by the bot's battle logic: the player's Auto battle. True if a command was given. */
export function autoBattleStep(G, bot) {
    if (!G.battle || G.battle.result || !canAct(G)) return false;
    battleInput(G, bot, { x: 0, y: 0, a: false });
    return true;
}
