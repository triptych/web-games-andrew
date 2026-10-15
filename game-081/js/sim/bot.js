// Auto-players. Pure, like the rest of js/sim.
//
// - The scan bot spends any charged power where it helps most, then plays the trail with the best
//   goal value (plus a little for length and lifeblooms). skill < 1 shrinks the search and adds
//   noise, standing in for a casual player.
// - The campaign bot walks the real maps through step() with the same input a player gives
//   (turning and walking toward objective(G)), talks, scans, learns skills, buys remedies and
//   plays the whole game. The tests, the balance table and the title screen's demo all use it.

import { CELL, PLAYER } from '../config.js';
import * as Scan from './scan.js';
import { bestChain, neighbours } from './search.js';
import { ITEMS, UPGRADES, UPGRADE_IDS, canLearn, itemMax } from './data/skills.js';
import { act, objective, step } from './game.js';
import { facing, routeTo, steerPoint, cellCentre, findCells } from './world.js';
import { makeRng } from '../rng.js';

// ------------------------------------------------------------------ scan bot

function areaValue(S, cells) {
    const path = cells.filter(([r, c]) => S.cells[r][c].m && !S.cells[r][c].m.bound);
    return Scan.goalValue(S, path) + path.length * 0.1;
}

/** Choose a power use: { vial, r, c } or null. */
export function choosePower(S, force = false) {
    for (let i = 0; i < S.vials.length; i++) {
        const v = S.vials[i];
        if (v.charges <= 0) continue;
        if (v.power === 'phoenix') {
            if (!S.wild && Scan.focusLeft(S) > 0) return { vial: i, r: 0, c: 0 };
            continue;
        }
        let best = null, bestV = -1;
        for (let r = 0; r < S.rows; r++) {
            for (let c = 0; c < S.cols; c++) {
                if (S.cells[r][c].hole) continue;
                const m = S.cells[r][c].m;
                let val = -1;
                if (v.power === 'lancet') {
                    val = areaValue(S, [[r, c], ...neighbours(S, r, c)]) + Scan.obstaclesTouched(S, [[r, c]], 'scar') * 3 + Scan.obstaclesTouched(S, [[r, c]], 'bound') * 3;
                } else if (v.power === 'draught' && m && !m.bound) {
                    const same = [];
                    Scan.forEachMote(S, (g, gr, gc) => { if (g.kind === m.kind && !g.bound) same.push([gr, gc]); });
                    val = areaValue(S, same);
                } else if (v.power === 'prism' && m && !m.bound && !m.bloom) {
                    val = neighbours(S, r, c).filter(([nr, nc]) => S.cells[nr][nc].m && !S.cells[nr][nc].m.bound).length;
                    for (const g of S.goals) if (g.t === 'hue' && g.v === m.hue && g.have < g.n) val += 4;
                }
                if (val > bestV) { bestV = val; best = [r, c]; }
            }
        }
        if (best && (bestV >= 3 || force || v.charges >= 2)) return { vial: i, r: best[0], c: best[1] };
    }
    return null;
}

/** Choose a trail: a path or null. */
export function chooseChain(S, { skill = 1, rng = null } = {}) {
    const noise = skill < 1 && rng ? () => (rng() - 0.5) * (1 - skill) * 6 : () => 0;
    const res = bestChain(S, (path) =>
        Scan.goalValue(S, path) * 3 + path.length + (path.length >= S.mods.bloomChain ? 2 : 0) + noise(),
        { maxLen: skill < 1 ? 5 + Math.round(skill * 7) : 14, budget: Math.floor(20000 * skill) + 1500, rng });
    return res ? res.path : null;
}

/** One scan move straight on a scan state. Returns events or null. */
export function scanBotStep(S, opts = {}) {
    if (S.status !== 'playing') return null;
    const out = Scan.focusLeft(S) <= 0;
    const p = choosePower(S, out);
    if (p) { const ev = Scan.usePower(S, p.vial, p.r, p.c); if (ev) return ev; }
    if (out) return null;
    const path = chooseChain(S, opts);
    return path ? Scan.playChain(S, path) : null;
}

/** Play a whole scan (no tonic). */
export function scanBotPlay(S, opts = {}) {
    let guard = 0;
    while (S.status === 'playing' && guard++ < 600) if (!scanBotStep(S, opts)) break;
    S.events.length = 0;
    return S;
}

// ------------------------------------------------------------------ campaign bot

const SKILL_ORDER = ['breath', 'steady', 'steeped', 'bloomlore', 'tonic', 'widelancet', 'unbinding', 'debride', 'radiant', 'brimming', 'triage', 'verdant', 'deepvials', 'master', 'lantern'];

export function makeBot({ skill = 1, days = 1, seed = 7, salts = true } = {}) {
    return { skill, days, rng: makeRng(seed), salts, rests: {}, stuck: 0, lastPos: null, lastT: 0, wiggle: 0, target: null, log: [] };
}

const angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/**
 * One tick of the campaign bot. Either acts (and returns null) or returns the walking input for
 * this step. Call it every fixed step; it is cheap when walking.
 */
export function botTick(G, bot, dt) {
    if (G.ending) { act(G, { type: 'endingDone' }); return null; }
    if (G.talk) { act(G, { type: 'talkEnd' }); return null; }
    if (G.scan) { botScan(G, bot); return null; }
    // spend points and coins between things
    for (const id of SKILL_ORDER) if (canLearn(G, id)) { act(G, { type: 'learn', id }); return null; }
    if (G.map === 'clinic') {
        for (const u of UPGRADE_IDS) if (!G.upgrades[u] && G.gold >= UPGRADES[u].price + 30) { act(G, { type: 'buy', item: u }); return null; }
        for (const it of ['salts', 'star', 'calm']) {
            if (G.items[it] < (it === 'salts' ? 2 : 1) && G.items[it] < itemMax(G) && G.gold >= ITEMS[it].price + 40) { act(G, { type: 'buy', item: it }); return null; }
        }
    }
    let o = objective(G, { bot: true });
    // rest a day or two per act for walk-ins before heading out
    if (G.map === 'clinic' && o.travel && (bot.rests[G.act] || 0) < bot.days) o = { ...o, ...cotTarget() };
    if (o.x == null) return { mx: 0, my: 0, dyaw: 0.02, dpitch: 0 };
    const f = facing(G);
    if (f && f.key === o.key) {
        if (o.rest) bot.rests[G.act] = (bot.rests[G.act] || 0) + 1;
        act(G, { type: 'interact' });
        if (o.travel && !G.talk) act(G, { type: 'travel', to: o.travel });
        return null;
    }
    return walkToward(G, bot, o, dt);
}

function cotTarget() {
    const [x, y] = findCells('clinic', 'z')[0];
    return { x, y, key: `${x},${y}`, rest: true, travel: null, text: 'Rest' };
}

function walkToward(G, bot, o, dt) {
    const P = G.player;
    const [tx, tz] = cellCentre(o.x, o.y);
    const dist = Math.hypot(tx - P.x, tz - P.z);
    let aim = [tx, tz];
    let my = 1;
    const near = dist < CELL * 1.15;
    if (!near) {
        const path = routeTo(G, o.x, o.y);
        const sp = path && path.length > 1 ? steerPoint(G, path) : null;
        if (sp) aim = sp;
    } else my = 0;   // close enough: just turn to face it
    const want = Math.atan2(aim[0] - P.x, -(aim[1] - P.z));
    const d = angleDiff(P.yaw, want);
    const maxTurn = PLAYER.turn * 2.2 * dt;
    const dyaw = Math.max(-maxTurn, Math.min(maxTurn, d));
    if (Math.abs(d) > 0.9) my = 0;
    // stuck: nothing moved for a while → sidestep
    if (my > 0) {
        if (bot.lastPos && Math.hypot(P.x - bot.lastPos[0], P.z - bot.lastPos[1]) < 0.002) bot.stuck += dt; else bot.stuck = 0;
        bot.lastPos = [P.x, P.z];
        if (bot.stuck > 0.6) { bot.wiggle = 0.5; bot.stuck = 0; }
    }
    let mx = 0;
    if (bot.wiggle > 0) { bot.wiggle -= dt; mx = bot.rng() < 0.5 ? 1 : -1; my = -0.5; }
    // stand still and face a target you can already reach
    if (near) {
        const pitchWant = -0.15;
        return { mx: 0, my: 0, dyaw, dpitch: (pitchWant - P.pitch) * 0.2 };
    }
    return { mx, my, dyaw, dpitch: -P.pitch * 0.1 };
}

function botScan(G, bot) {
    const S = G.scan.S;
    if (S.status === 'won') { act(G, { type: 'scanFinish' }); return; }
    if (S.status === 'lost') {
        if (bot.salts && G.items.salts > 0) { act(G, { type: 'scanItem', item: 'salts' }); return; }
        if (!S.continued) { act(G, { type: 'scanTonic' }); return; }
        act(G, { type: 'scanQuit' });
        bot.quits = (bot.quits || 0) + 1;
        return;
    }
    if (G.items.star > 0 && S.vials.some((v) => v.charges === 0 && v.fill / v.need > 0.5)) { act(G, { type: 'scanItem', item: 'star' }); return; }
    const out = Scan.focusLeft(S) <= 0;
    const p = choosePower(S, out);
    if (p && act(G, { type: 'scanPower', vial: p.vial, r: p.r, c: p.c })) return;
    if (out) { act(G, { type: 'scanQuit' }); return; }
    const path = chooseChain(S, { skill: bot.skill, rng: bot.rng });
    if (!path || !act(G, { type: 'scanChain', path })) {
        if (G.items.calm > 0) act(G, { type: 'scanItem', item: 'calm' });
        else act(G, { type: 'scanQuit' });
    }
}

/** Run the campaign bot through the fixed step for up to `seconds` of game time. */
export function botRun(G, bot, seconds, dtStep, until = () => false) {
    let t = 0;
    while (t < seconds && !until(G)) {
        const inp = botTick(G, bot, dtStep);
        if (inp) { step(G, inp, dtStep); t += dtStep; } else t += 0.0001;
        G.events.length = 0;
    }
    return t;
}
