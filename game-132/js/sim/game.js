// TITAN'S VAULT: the simulation's front door. Pure: no DOM, no rendering library, no Math.random, no clock.
//   newGame(seed, cls)   a fresh warden in Lantern's Rest
//   step(G, inp, dt)     one fixed step of real time
//   act(G, cmd)          a command (inventory, skills, travel…; see act.js)
//   serialize / deserialize
// The view reads G and drains G.events; the tests and the bot drive step() and act() directly.

import { PLAYER, POTION, PORTAL, INVENTORY, SECOND_MASTERY_AT } from '../config.js';
import { makeRng } from '../rng.js';
import { CLASSES, MASTERIES, SKILLS } from './data/masteries.js';
import { LORE } from './data/world.js';
import { rollItem } from './loot.js';
import { recompute } from './stats.js';
import { stepMonsters } from './monsters.js';
import { useSkill, stepPlayerSkills, stepShots, stepZones, stepMinions, skillBlocked, pickTarget } from './skills.js';
import { newPet, stepPet, placePet } from './pet.js';
import { enterArea, bossKilled, stepRift, card } from './areas.js';
import { act as runAct, pickUp } from './act.js';
import { moveBody, clearPath, flow, downhill, isFloor, lastFit } from './world.js';
import { heal } from './combat.js';

export { act } from './act.js';

export const NONE = Object.freeze({ mx: 0, my: 0, tx: null, ty: null, ax: null, ay: null, held: [false, false, false, false, false], press: [false, false, false, false, false], potion: false, portal: false, interact: false, stand: false });

export function newGame(seed = 1, cls = 'ironsworn') {
    const C = CLASSES[cls];
    const G = {
        v: 1, seed, rng: makeRng(seed), t: 0, mode: 'play', won: false, nextId: 1, visits: 0,
        player: {
            cls, masteries: [C.mastery, null], synergy: null, level: 1, xp: 0, gold: 0, ascension: 0,
            attrs: { might: 0, cunning: 0, spirit: 0, vitality: 0 }, unspent: { attr: 0, skill: 1 },
            bar: {}, ranks: {}, slots: [null, null, null, null, null],
            x: 0, y: 0, face: 0, life: 1, res: { rage: 0, mana: 999, essence: 999 }, cds: {}, buffs: [], busy: 0, channel: null, channelTick: 0,
            potion: { charges: POTION.charges, cd: 0, kills: 0, hot: 0 }, equip: {}, bag: new Array(INVENTORY.size).fill(null), stash: new Array(60).fill(null),
            waystones: ['town'], reached: 0, bossesKilled: [], riftBest: 0, pity: 0, filter: 'all', combatT: 99, portalCast: 0, moveGoal: null,
            loreRead: [],
        },
        pet: newPet(), area: null, features: [], decor: [], mons: [], shots: [], zones: [], minions: [], drops: [], items: {},
        rift: null, portalBack: null, seenCards: [],
        stats: { kills: 0, elites: 0, deaths: 0, dealt: 0, taken: 0, casts: {} },
        events: [],
    };
    const P = G.player;
    // the starting kit: the class's weapon and a plain cuirass; the first skill point goes to the mastery bar,
    // and the primary skill is learned for free so the first fight has something to press
    const w = rollItem(G, 1, { rarity: 'common', base: C.weapon });
    const c = rollItem(G, 1, { rarity: 'common', base: 'chest' });
    G.items[w.id] = w; G.items[c.id] = c;
    P.equip.weapon = w.id; P.equip.chest = c.id;
    P.bar[C.mastery] = 1;
    const primary = { warfare: 'cleave', storm: 'spark', umbra: 'soulrend' }[C.mastery];
    P.ranks[primary] = 1; P.slots[0] = primary;
    recompute(G);
    P.life = P.stats.maxLife;
    for (const k of ['rage', 'mana', 'essence']) P.res[k] = k === 'rage' ? 0 : P.stats.resMax[k];
    enterArea(G, 'town', 'start');
    card(G, 'intro');
    return G;
}

// ------------------------------------------------------------------------------------------------------ the step

export function step(G, inp, dt) {
    const P = G.player;
    if (G.mode === 'dead') {
        G.deadT -= dt;
        if (G.deadT <= 0) respawn(G);
        return;
    }
    G.t += dt;
    if (G.t - (G._capT || 0) > 1) { G._capT = G.t; if (G.events.length > 600) G.events.splice(0, G.events.length - 300); }

    // potion and portal
    P.potion.cd = Math.max(0, P.potion.cd - dt);
    if (P.potion.hot > 0) { const h = Math.min(dt, P.potion.hot); heal(G, (P.stats.maxLife * POTION.heal * h) / POTION.overTime); P.potion.hot -= h; }
    if (inp.potion) {
        if (P.potion.charges > 0 && P.potion.cd <= 0 && P.life < P.stats.maxLife) {
            P.potion.charges--; P.potion.cd = POTION.cd; P.potion.hot = POTION.overTime;
            G.events.push({ type: 'potion', left: P.potion.charges });
        } else if (P.potion.charges <= 0) G.events.push({ type: 'denied', reason: 'No potions left' });
    }
    if (inp.portal && !P.portalCast && G.area.kind !== 'town') { P.portalCast = PORTAL.cast; G.events.push({ type: 'portalCast' }); }
    if (P.portalCast > 0) {
        P.portalCast -= dt;
        if (P.portalCast <= 0) { P.portalCast = 0; runAct(G, { t: 'portal' }); return; }
    }

    // skills: the first slot pressed or held that can go this step
    const channelSlot = P.channel ? P.slots.indexOf(P.channel) : -1;
    const aim = inp.ax != null ? { x: inp.ax, y: inp.ay } : null;
    let approach = null;
    if (!P.portalCast) {
        for (let i = 0; i < 5; i++) {
            if (!(inp.press[i] || inp.held[i])) continue;
            const id = P.slots[i];
            if (!id || P.channel === id) continue;
            const why = useSkill(G, id, aim);
            if (!why) break;
            if (why === 'no target' && (inp.held[i] || inp.press[i])) {
                // walk toward an enemy near the aim point until it's in reach (attack-move)
                const S = SKILLS[id];
                const t = pickTarget(G, aim, 14);
                if (t && (S.fx.type === 'arc' || S.fx.type === 'beam' || S.fx.type === 'chain')) approach = t;
            } else if (why !== 'cooldown' && why !== 'busy' && inp.press[i]) G.events.push({ type: 'denied', reason: why, skill: id });
        }
    }
    stepPlayerSkills(G, dt, channelSlot >= 0 && inp.held[channelSlot]);

    // movement (not while a skill holds the player still, nor while casting the portal)
    if (P.busy <= 0 && !P.portalCast && !inp.stand) movePlayer(G, inp, dt, approach);

    stepShots(G, dt);
    stepZones(G, dt);
    stepMinions(G, dt);
    stepMonsters(G, dt);
    stepPet(G, dt);
    stepRift(G, dt);
    if (G.onBossKilled) { const b = G.onBossKilled; G.onBossKilled = null; bossKilled(G, b); }
    if (P.life > 0 && G.mode === 'play') touchThings(G, inp);
}

function movePlayer(G, inp, dt, approach) {
    const P = G.player, A = G.area;
    let speed = P.stats.moveSpeed;
    if (P.channel) speed *= SKILLS[P.channel].fx.slow;
    let mx = inp.mx, my = inp.my;
    const len = Math.hypot(mx, my);
    if (len > 0.15) {
        P.moveGoal = null;
        if (len > 1) { mx /= len; my /= len; }
    } else {
        mx = my = 0;
        if (inp.tx != null) P.moveGoal = { x: inp.tx, y: inp.ty };
        const goal = approach || P.moveGoal;
        if (goal) {
            const dx = goal.x - P.x, dy = goal.y - P.y, d = Math.hypot(dx, dy);
            const stop = approach ? approach.radius + 1.6 : 0.15;
            if (d <= stop) { if (!approach) P.moveGoal = null; }
            else if (clearPath(A, P.x, P.y, goal.x, goal.y, PLAYER.radius + 0.05)) { mx = dx / d; my = dy / d; }
            else {
                const gx = Math.floor(goal.x), gy = Math.floor(goal.y);
                if (!G._goal || G._goal.cx !== gx || G._goal.cy !== gy || G._goal.area !== A.uid) G._goal = { cx: gx, cy: gy, area: A.uid, d: flow(A, gx, gy) };
                const n = downhill(A, G._goal.d, P.x, P.y);
                if (n) { const ex = n.cx - P.x, ey = n.cy - P.y, el = Math.hypot(ex, ey) || 1; mx = ex / el; my = ey / el; }
                else if (!approach) P.moveGoal = null;
            }
        }
    }
    if (mx || my) {
        moveBody(A, P, mx * speed * dt, my * speed * dt, PLAYER.radius);
        if (!P.busy) P.face = Math.atan2(my, mx);
        P.moving = true;
    } else P.moving = false;
}

/** Walk-over things: loot, globes, gold, waystones, exits, lore, chests; and the nearest thing to interact with. */
function touchThings(G, inp) {
    const P = G.player;
    for (let i = G.drops.length - 1; i >= 0; i--) {
        const d = G.drops[i];
        const r = d.gold || d.globe ? PLAYER.pickup + 0.6 : 0.95;
        if (Math.hypot(d.x - P.x, d.y - P.y) < r) {
            if (d.globe && P.life >= P.stats.maxLife) continue;
            pickUp(G, d);
        }
    }
    G.near = null;
    let nd = 2.2;
    for (const f of G.features) {
        const d = Math.hypot(f.x - P.x, f.y - P.y);
        if (f.kind === 'waystone' && d < 1.8 && !P.waystones.includes(G.area.id) && G.area.id !== 'rift') {
            P.waystones.push(G.area.id);
            G.events.push({ type: 'waystone', area: G.area.id });
        }
        if (f.kind === 'lore' && d < 1.6 && !P.loreRead.includes(G.area.id + f.lore)) {
            P.loreRead.push(G.area.id + f.lore);
            const L = LORE[G.area.id][f.lore];
            G.events.push({ type: 'lore', title: L.title, text: L.text });
        }
        if (f.kind === 'chest' && !f.open && d < 1.4) {
            f.open = true;
            for (let k = 0; k < 2; k++) {
                const it = rollItem(G, levelHere(G), { mf: P.stats.magicFind + 50 });
                G.items[it.id] = it;
                const a = G.rng() * 6.28, p = lastFit(G.area, f.x, f.y, f.x + Math.cos(a), f.y + Math.sin(a), 0.2);
                G.drops.push({ id: G.nextId++, item: it.id, x: p.x, y: p.y });
                G.events.push({ type: 'drop', id: it.id, rarity: it.rarity, x: f.x, y: f.y });
            }
            G.drops.push({ id: G.nextId++, gold: 20 + levelHere(G) * 8, x: f.x, y: f.y });
            G.events.push({ type: 'chest', x: f.x, y: f.y });
        }
        if (f.kind === 'exit' && d < 1.2) {
            if (f.locked) { if (!G._lockWarn) { G.events.push({ type: 'denied', reason: 'The way on is sealed. Something guards it.' }); G._lockWarn = true; } }
            else { runAct(G, { t: 'enter', id: f.id }); return; }
        } else if (f.kind === 'exit') G._lockWarn = false;
        if (f.kind === 'portal' && d < 1.2) { enterArea(G, null, 'portal'); return; }
        if ((f.kind === 'npc' || f.kind === 'stash' || f.kind === 'obelisk' || f.kind === 'shrine' || f.kind === 'waystone') && d < nd) { nd = d; G.near = f.id; }
    }
    if (inp.interact && G.near) G.events.push({ type: 'interact', id: G.near });
    if (P.level >= SECOND_MASTERY_AT && !P.masteries[1] && !G._mReady) { G._mReady = true; G.events.push({ type: 'masteryReady' }); }
}

export function levelHere(G) {
    const M = G.mons.find((m) => m.life > 0);
    return M ? M.lvl : Math.max(1, G.player.level);
}

function respawn(G) {
    const P = G.player;
    G.mode = 'play';
    recompute(G);
    P.life = P.stats.maxLife;
    P.potion.charges = Math.max(P.potion.charges, 1);
    P.channel = null; P.busy = 0; P.portalCast = 0;
    for (const m of G.mons) if (m.elite && m.life > 0) m.life = Math.min(m.max, m.life + m.max * 0.5);
    for (const m of G.mons) { if (m.life > 0) { m.state = 'idle'; m.aggro = false; m.x = m.hx; m.y = m.hy; } }
    G.shots = []; G.zones = [];
    if (G.rift || P.waystones.includes(G.area.id)) {
        const at = G.rift ? G.area.start : G.area.waystone;
        P.x = at.x; P.y = at.y + (G.rift ? 0 : 1.2);
        placePet(G);
        G.events.push({ type: 'respawn', where: G.area.id });
    } else {
        enterArea(G, 'town', 'start');
        G.events.push({ type: 'respawn', where: 'town' });
    }
}

// ------------------------------------------------------------------------------------------------------ saving

export function serialize(G) {
    const out = {};
    for (const k of Object.keys(G)) {
        if (k === 'rng' || k === 'events' || k.startsWith('_')) continue;
        out[k] = G[k];
    }
    out.rngState = G.rng.state();
    return JSON.parse(JSON.stringify(out));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    recompute(G);
    return G;
}

export { MASTERIES, isFloor, skillBlocked };
