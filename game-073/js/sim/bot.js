// An autoplayer. It plans with Dijkstra over the tile grid, drives Thimble with the same
// inputs a player uses, shops on the surface and follows the story to the end.
// Used by dev/simtest.mjs (to prove the game can be finished) and by ?debug=1 autoplay.

import { W, H, T, RIG, ORES, UPGRADES, UPGRADE_ORDER, ITEMS, STRATA, GATE_ROW, START_X } from '../config.js';
import { tileAt, stratAt, hardnessAt, auxAt, SHARDS, HEART_POS } from './world.js';
import {
    derived, cargoCount, surfaceSpot, sellAll, buyFuel, repair, buyUpgrade, buyItem, useItem, travel, depthOf, finishEnding,
} from './game.js';
import { CHAPTERS, talk, chooseInScene, availableContracts, canDeliver, deliverContract } from './story.js';

export function makeBot(opts = {}) {
    return {
        plan: null, planAt: -1, goal: null, mode: 'town', stuck: 0, lastCell: '', lastProgress: 0,
        log: opts.log || null, god: !!opts.god, trips: 0, hold: 0,
    };
}

const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];

/** Cost of entering cell (c, r) from (pc, pr). Infinity if impossible. */
export function enterCost(G, S, pc, pr, c, r) {
    if (c < 0 || c >= W || r >= H) return Infinity;
    if (r < 0) return pr < r ? Infinity : 1;   // the sky: only by flying up
    const t = tileAt(G.world, c, r);
    const up = r < pr;
    if (t === T.EMPTY) return up ? 1.3 : 1;
    if (up) return Infinity;                      // can't drill upward
    if (r > pr || c !== pc) {
        // sideways drilling needs footing under the current cell
        if (c !== pc && pr >= -1 && tileAt(G.world, pc, pr + 1) === T.EMPTY) return Infinity;
    }
    if (t === T.GATE) return G.relics[6] ? 4 : Infinity;
    if (t === T.SHARD) return G.relics[6] ? 6 : Infinity;
    if (t === T.HEART) return 1;
    const h = hardnessAt(G.world, c, r);
    if (!Number.isFinite(h) || h > S.drillPower + 1) return Infinity;
    let cost = 1 + ((RIG.drillBase + RIG.drillPerHard * h) / S.drillSpeed) * 2.2;
    if (t === T.GAS) cost += 60;
    if (t === T.LAVA) cost += G.relics[4] ? 8 : 30;
    if (t === T.ORE) cost -= Math.min(0.9, ORES[auxAt(G.world, c, r)].value / 400);
    if (tileAt(G.world, c, r - 1) === T.BOULDER) cost += 40;
    return Math.max(0.3, cost);
}

class Heap {
    constructor() { this.a = []; }
    push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
    get size() { return this.a.length; }
}

/** Dijkstra from the rig's cell over rows [rMin, rMax]. Rows < 0 are folded into a single "sky" row -1. */
export function dijkstra(G, S, c0, r0, rMin, rMax) {
    rMin = Math.max(-1, rMin); rMax = Math.min(H - 1, rMax);
    const rows = rMax - rMin + 1;
    const n = rows * W;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const key = (c, r) => (r - rMin) * W + c;
    const start = key(c0, Math.max(rMin, r0));
    dist[start] = 0;
    const h = new Heap();
    h.push(0, start);
    while (h.size) {
        const [d, k] = h.pop();
        if (d > dist[k]) continue;
        const c = k % W, r = Math.floor(k / W) + rMin;
        for (const [dc, dr] of DIRS) {
            const nc = c + dc, nr = r + dr;
            if (nr < rMin || nr > rMax || nc < 0 || nc >= W) continue;
            const cost = enterCost(G, S, c, r, nc, nr);
            if (!Number.isFinite(cost)) continue;
            const nk = key(nc, nr);
            if (d + cost < dist[nk]) { dist[nk] = d + cost; prev[nk] = k; h.push(d + cost, nk); }
        }
    }
    return { dist, prev, key, rMin, rMax };
}

function pathTo(D, c, r) {
    const out = [];
    let k = D.key(c, r);
    if (!Number.isFinite(D.dist[k])) return null;
    while (k !== -1) { out.push({ c: k % W, r: Math.floor(k / W) + D.rMin }); k = D.prev[k]; }
    return out.reverse();
}

// ------------------------------------------------------------------
// Goals
// ------------------------------------------------------------------
export function storyGoal(G, S) {
    const st = G.story;
    const w = G.world;
    const reachable = (r) => STRATA[stratAt(w, 1, Math.min(r, GATE_ROW - 1))].hard <= S.drillPower + 1;
    if (G.bossDefeated) return { c: HEART_POS.c, r: HEART_POS.r, kind: 'heart' };
    if (G.gateOpen && G.relics[6]) {
        const s = SHARDS.find((sh) => tileAt(w, sh.c, sh.r) === T.SHARD);
        if (s) return { c: s.c, r: s.r, kind: 'shard' };
    }
    if (G.relics[6] && !G.gateOpen) return { c: Math.floor(W / 2), r: GATE_ROW, kind: 'gate' };
    for (let i = 0; i < 7; i++) {
        if (G.relics[i]) continue;
        // story order: don't run ahead of the chapter that sends you there
        const chNeed = [2, 3, 4, 5, 6, 7, 8][i];
        if (st.ch < chNeed) break;
        if (i === 4 && st.flags.ch6start && !st.flags.corvin && reachable(w.wreckPos.r)) return { c: w.wreckPos.c, r: w.wreckPos.r, kind: 'wreck' };
        const p = w.relicPos.find((q) => q.id === i);
        if (i === 3 && G.relics[3] === false && reachable(p.r)) return { c: p.c, r: p.r, kind: 'relic' };
        if (reachable(p.r)) return { c: p.c, r: p.r, kind: 'relic' };
        return null;
    }
    if (st.ch === 5 && st.flags.ch5start && !G.waystones[0]) {
        const p = w.waystonePos[0];
        if (reachable(p.r)) return { c: p.c, r: p.r - 1, kind: 'waystone' };
    }
    if (st.ch === 6 && st.flags.ch6start && !st.flags.corvin && reachable(w.wreckPos.r)) return { c: w.wreckPos.c, r: w.wreckPos.r, kind: 'wreck' };
    return null;
}

/** Deepest row whose rock this auger can cut. */
export function reachDepth(S) {
    let r = 0;
    for (const s of STRATA) if (s.hard <= S.drillPower + 1 && s.id < 6) r = (STRATA[s.id + 1]?.top ?? GATE_ROW) - 1;
    return Math.min(r, GATE_ROW - 1);
}

// ------------------------------------------------------------------
// Town: sell, story, shop
// ------------------------------------------------------------------
function townRound(G, bot) {
    sellAll(G);
    // story business
    for (let guard = 0; guard < 4; guard++) {
        const st = G.story, ch = CHAPTERS[st.ch];
        if (!ch) break;
        if (st.ready && ch.to) { talk(G, ch.to); continue; }
        if (ch.start && !st.flags[ch.start]) { talk(G, ch.startAt); continue; }
        break;
    }
    for (const c of availableContracts(G)) if (canDeliver(G, c.id)) deliverContract(G, c.id);
    repair(G);
    buyFuel(G);
    const S = derived(G);
    const target = storyGoal(G, S);
    const deep = target ? target.r : reachDepth(S);
    // Priorities: what the next goal needs first.
    const want = [];
    const drillNeed = target ? 0 : 1;
    want.push('drill');
    if (deep > 200) want.push('ward');
    want.push('tank', 'hull', 'lantern', 'cargo', 'vanes');
    if (deep < 200) want.push('ward');
    let bought = true;
    for (let i = 0; i < 12 && bought; i++) {
        bought = false;
        for (const k of want) {
            const tiers = UPGRADES[k].tiers;
            if (G.up[k] >= tiers.length - 1) continue;
            // keep the tank/hull/drill roughly level so no one stat lags
            const next = tiers[G.up[k] + 1];
            const reserve = 60 + deep * 0.6;
            if (G.money - next.price >= reserve) { buyUpgrade(G, k); bought = true; break; }
        }
    }
    void drillNeed;
    // consumables for deep trips
    if (deep > 120 && G.items.recall < 1 && G.money > 2500) buyItem(G, 'recall');
    if (deep > 150 && G.items.mend < 1 && G.money > 2500) buyItem(G, 'mend');
    if (deep > 60 && G.items.blast < 1 && G.money > 800) buyItem(G, 'blast');
    if (G.gateOpen && G.items.mend < 4) { buyItem(G, 'mend'); buyItem(G, 'mend'); buyItem(G, 'mend'); }
    if (G.gateOpen && G.items.great < 2) buyItem(G, 'great');
    repair(G);
    buyFuel(G);
}

// ------------------------------------------------------------------
// The per-tick driver
// ------------------------------------------------------------------
export function botInput(G, bot, dt) {
    const rig = G.rig;
    const S = derived(G);
    const inp = { x: 0, up: false, down: false };
    if (G.down) return inp;

    // scenes: answer choices the same way a kind player would
    for (const e of G.events) {
        if (e.type === 'scene' && (e.id === 'relic5' || e.id === 'ending')) chooseInScene(G, e.id, e.id === 'relic5' ? 'warm' : 'stay');
    }
    if (G.ended) { finishEnding(G); return inp; }
    if (bot.god) { rig.hull = S.hull; rig.fuel = S.tank; }

    const c = Math.floor(rig.x), r = Math.floor(-rig.y);
    const onSurface = rig.y > 0 && rig.grounded && !rig.drill;
    const depth = depthOf(G);

    // ---- In town ----
    if (onSurface && bot.mode !== 'delve') {
        townRound(G, bot);
        bot.trips++;
        bot.mode = 'delve';
        bot.plan = null;
        // ride a waystone down when it saves the climb
        const goal = storyGoal(G, derived(G));
        const want = goal ? goal.r : reachDepth(derived(G));
        const ws = G.world.waystonePos.filter((w) => G.waystones[w.id] && w.r <= want + 5).sort((a, b) => b.r - a.r)[0];
        if (ws && ws.r > 60) travel(G, ws.id);
        return inp;
    }
    if (rig.drill) return inp;

    // ---- Should we head home? ----
    const S2 = derived(G);
    const returnFuel = 1.6 + depth * 0.075;
    const hullLow = rig.hull < S2.hull * 0.32;
    if (bot.mode === 'delve') {
        if (rig.hull < S2.hull * 0.45 && G.items.mend > 0) useItem(G, 'mend');
        if (rig.fuel < returnFuel && G.items.flask > 0) useItem(G, 'flask');
        const full = cargoCount(G) >= S2.cargo;
        const inFight = G.boss && G.boss.active && !G.bossDefeated;
        if ((rig.fuel < returnFuel || hullLow || (full && !inFight && !G.bossDefeated)) && depth > 0) {
            const emergency = rig.fuel < returnFuel * 0.8 || hullLow;
            if (G.items.recall > 0 && depth > 25 && (emergency || depth > 140)) { useItem(G, 'recall'); bot.mode = 'town'; bot.plan = null; return inp; }
            bot.mode = 'return';
            bot.plan = null;
        }
    }
    if (bot.mode === 'return' && onSurface) { bot.mode = 'town'; return inp; }
    if (bot.mode === 'return' && rig.y > 0) {
        // above ground: drift to solid ground near the Spire and settle
        const tx = surfaceSpot(G);
        const dx = tx - rig.x;
        return { x: Math.abs(dx) > 0.1 ? Math.sign(dx) * Math.min(1, Math.abs(dx)) : 0, up: rig.y < 0.9 && rig.vy < 0 && Math.abs(dx) > 0.4, down: false };
    }

    // ---- Boss tactics ----
    if (G.boss && G.boss.active && !G.boss.dying) {
        const h = G.boss.head;
        if (Math.hypot(h.x - rig.x, h.y - rig.y) < 2.6 && (G.items.great > 0 || G.items.blast > 0) && G.boss.stun <= 0) {
            useItem(G, G.items.great > 0 ? 'great' : 'blast');
        }
    }
    if (G.wisps.length && G.items.blast > 0 && G.wisps.some((w) => Math.hypot(w.x - rig.x, w.y - rig.y) < 1.6)) useItem(G, 'blast');

    // ---- Plan ----
    const cellKey = c + ',' + r;
    if (cellKey !== bot.lastCell) { bot.lastCell = cellKey; bot.lastProgress = G.time; }
    if (G.time - bot.lastProgress > 6) { bot.plan = null; bot.lastProgress = G.time; bot.stuck++; bot.hold = 0.8; }
    if (bot.hold > 0) {
        // shake loose: hop and jiggle
        bot.hold -= dt;
        return { x: Math.sin(G.time * 5) > 0 ? 1 : -1, up: true, down: false };
    }
    if (!bot.plan || bot.planAt !== cellKey || bot.plan.length < 2) {
        bot.plan = makePlan(G, bot, S2, c, r);
        bot.planAt = cellKey;
    }
    const plan = bot.plan;
    if (!plan || plan.length < 2) {
        // nothing to do here: go home
        if (bot.mode === 'delve') { bot.mode = 'return'; bot.plan = null; }
        return { x: 0, up: rig.y < 0, down: false };
    }
    let i = plan.findIndex((p) => p.c === c && p.r === r);
    if (i < 0) { bot.plan = null; return inp; }
    const next = plan[Math.min(plan.length - 1, i + 1)];
    return drive(G, rig, c, r, next);
}

export function makePlan(G, bot, S, c, r) {
    const span = 46;
    if (bot.mode === 'return') {
        const D = dijkstra(G, S, c, r, -1, r + 2);
        let best = null;
        for (let cc = 0; cc < W; cc++) {
            const d = D.dist[D.key(cc, -1)];
            if (Number.isFinite(d) && (!best || d + Math.abs(cc + 0.5 - START_X) * 0.2 < best.d)) best = { cc, d: d + Math.abs(cc + 0.5 - START_X) * 0.2 };
        }
        return best ? pathTo(D, best.cc, -1) : null;
    }
    const goal = storyGoal(G, S);
    if (goal) {
        const D = dijkstra(G, S, c, r, Math.min(r, goal.r) - 6, Math.max(r, goal.r) + 3);
        // standing next to the goal and drilling in counts; so does the cell itself
        const p = pathTo(D, goal.c, goal.r);
        if (p) {
            const fuelNeed = (D.dist[D.key(goal.c, goal.r)] * 0.07 + (goal.r) * 0.075 + 2.5);
            if (G.rig.fuel > fuelNeed * 0.55 || goal.kind === 'shard' || goal.kind === 'heart' || r > goal.r - 30) return p;
        }
    }
    // Mining: keep the chosen ore until it's dug, so the bot doesn't dither between two.
    const reach = reachDepth(S);
    const lo = Math.max(-1, r - span), hi = Math.min(reach, r + span);
    const t0 = bot.mine;
    if (t0) {
        const t = tileAt(G.world, t0.c, t0.r);
        if ((t === T.ORE || t === T.CACHE || t === T.ARTIFACT) && t0.r >= lo && t0.r <= hi) {
            const D = dijkstra(G, S, c, r, Math.min(lo, t0.r - 2), Math.max(hi, t0.r + 2));
            const p = pathTo(D, t0.c, t0.r);
            if (p) return p;
        }
        bot.mine = null;
    }
    const D = dijkstra(G, S, c, r, lo, hi);
    let best = null;
    for (let rr = Math.max(0, lo); rr <= hi; rr++) {
        for (let cc = 0; cc < W; cc++) {
            const t = tileAt(G.world, cc, rr);
            if (t !== T.ORE && t !== T.CACHE && t !== T.ARTIFACT) continue;
            const d = D.dist[D.key(cc, rr)];
            if (!Number.isFinite(d)) continue;
            const v = t === T.ORE ? ORES[auxAt(G.world, cc, rr)].value : 300;
            const score = v / (d + 4) + rr * 0.01;
            if (!best || score > best.score) best = { cc, rr, score };
        }
    }
    if (best) { bot.mine = { c: best.cc, r: best.rr }; return pathTo(D, best.cc, best.rr); }
    // nothing in reach: dig straight down to find more
    return pathTo(D, c, Math.min(reach, r + 6));
}

function drive(G, rig, c, r, next) {
    const inp = { x: 0, up: false, down: false };
    const S = derived(G);
    const brake = !S.featherfall && rig.vy < -(RIG.fallSafe - 2);
    const tx = next.c + 0.5;
    const dx = tx - rig.x;
    const steer = () => {
        const want = Math.max(-1, Math.min(1, dx * 3));
        if (Math.abs(dx) > 0.06) inp.x = Math.abs(want) < 0.35 ? Math.sign(want) * 0.35 : want;
        if (Math.abs(rig.vx) > 2.5 && Math.abs(dx) < 0.7 && Math.sign(rig.vx) === Math.sign(dx)) inp.x = -Math.sign(rig.vx);
    };
    if (next.r > r) {
        // down: line up over the column, then drill or drop
        steer();
        if (Math.abs(dx) < 0.18) {
            inp.x = 0;
            if (tileAt(G.world, next.c, next.r) !== T.EMPTY) inp.down = true;
        }
        if (brake) inp.up = true;
    } else if (next.r < r) {
        steer();
        if (Math.abs(dx) < 0.3) inp.up = true;
        if (Math.abs(dx) > 0.3 && rig.vy < 0) inp.up = true;   // hover while lining up
    } else {
        // sideways
        inp.x = Math.sign(dx);
        if (Math.abs(dx) < 0.08) inp.x = 0;
        // stay level: a tap of the vanes if we sag below the row
        const yTarget = -r - 1 + RIG.halfH;
        if (tileAt(G.world, c, r + 1) === T.EMPTY && rig.y < yTarget + 0.25) inp.up = rig.vy < 0.5;
    }
    return inp;
}
