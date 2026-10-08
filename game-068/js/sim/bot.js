/**
 * bot.js — a player for the balance tests (dev/simtest.mjs). It plays through the same actions
 * the UI uses: build, upgrade, deploy, start the wave. It's a sensible but unremarkable player:
 * it keeps a mix of stations in proportion to the ailments the level has, puts each where its
 * range covers the most road, and upgrades once the mix is in place.
 */

import { W, H } from '../config.js';
import { STATIONS, TRADES } from './data.js';
import { buildable, idx } from './mapgen.js';

// How many of each station the bot wants per "round" of building.
const MIX = { medic: 3, lantern: 1.2, remedy: 2, kitchen: 1.2, fire: 1.6, stretcher: 0.8, splint: 1.2, song: 1.1, bell: 0.7 };
// Which station to build first when the mix is even: what the level's people need most.
const PRIORITY = ['medic', 'fire', 'remedy', 'splint', 'kitchen', 'song', 'stretcher', 'lantern', 'bell'];
// Where the first of each kind goes, as a fraction of the road.
const BAND = { medic: [0.2, 0.65], remedy: [0.15, 0.6], splint: [0.05, 0.45], song: [0.1, 0.6], kitchen: [0.05, 0.5], fire: [0.2, 0.7], lantern: [0.1, 0.6], stretcher: [0.3, 0.9], bell: [0.2, 0.7] };
const BOSS_MIX = { medic: 2, kitchen: 1.2, remedy: 1.2, fire: 1.2, song: 1.1, lantern: 1.5, stretcher: 0.6, bell: 0.8, splint: 0 };

/**
 * Road coverage of a tile for a given range: how many route samples it reaches. Samples already in
 * reach of a station of the same kind (`same`) count for much less, so the bot spreads them out.
 */
function coverage(world, x, z, range, from = 0, to = 1, same = []) {
    const cx = x + 0.5, cz = z + 0.5, r2 = range * range;
    let n = 0;
    for (const R of world.routes) {
        for (let d = R.length * from; d < R.length * to; d += 0.5) {
            const o = R.at(d, {});
            if ((o.x - cx) ** 2 + (o.z - cz) ** 2 > r2) continue;
            const dup = same.some((s) => (o.x - s.x) ** 2 + (o.z - s.z) ** 2 <= s.r2);
            n += dup ? 0.3 : 1;
        }
    }
    return n;
}

export class Bot {
    constructor(world, opts = {}) {
        this.w = world;
        this.skill = opts.skill ?? 1;          // 0..1: how much of its supplies it spends
        this.t = 0;
    }

    bestTile(type, range, from, to) {
        const w = this.w;
        const same = w.stations.filter((s) => s.type === type).map((s) => ({ x: s.x, z: s.z, r2: STATIONS[type].lv[s.lv].range ** 2 }));
        let best = null, bs = 0;
        for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
            if (!buildable(w.map, x, z) || w.occ[idx(x, z)]) continue;
            const c = coverage(w, x, z, range, from, to, same);
            if (c > bs) { bs = c; best = [x, z]; }
        }
        return best;
    }

    /** Spend what we have. Called in build phases and every couple of seconds during waves. */
    spend() {
        const w = this.w;
        const mix = w.boss ? BOSS_MIX : MIX;
        const open = w.open.filter((k) => (mix[k] || 0) > 0 && this.useful(k));
        for (let guard = 0; guard < 20; guard++) {
            const counts = {};
            for (const s of w.stations) counts[s.type] = (counts[s.type] || 0) + 1;
            open.sort((a, b) => ((counts[a] || 0) / mix[a] - (counts[b] || 0) / mix[b]) || (PRIORITY.indexOf(a) - PRIORITY.indexOf(b)));
            const want = open[0];
            const enough = w.stations.length >= open.reduce((s, k) => s + Math.ceil(mix[k]), 0) * 1.5;
            const cost = STATIONS[want].cost[0];
            if (!enough && w.supplies >= cost / this.skill) {
                const L = STATIONS[want].lv[0];
                const band = w.boss ? [0.45, 1] : !counts[want] ? (BAND[want] || [0.05, 0.95]) : counts[want] === 1 ? [0, 0.4] : [0.05, 0.95];
                const t = this.bestTile(want, L.range, band[0], band[1]);
                if (t && w.build(want, t[0], t[1]).ok) continue;
            }
            // upgrade: the cheapest upgrade of the station type we rely on most
            const ups = w.stations.filter((s) => s.lv < 2).sort((a, b) => (mix[b.type] || 0) - (mix[a.type] || 0) || a.lv - b.lv);
            const u = ups.find((s) => w.supplies >= w.upgradeCost(s) / this.skill);
            const ups0 = w.stations.reduce((n, s) => n + s.lv, 0);
            const haveAll = open.every((k) => counts[k]);
            if (u && (enough || w.supplies > cost * 2 || (haveAll && ups0 < w.stations.length * 0.6))) { w.upgrade(u.id); continue; }
            break;
        }
    }

    useful(k) {
        const a = this.w.ail;
        if (k === 'remedy') return a.has('sick');
        if (k === 'kitchen') return true;
        if (k === 'fire') return a.has('cold');
        if (k === 'splint') return a.has('fracture');
        if (k === 'song') return true;
        return true;
    }

    deploy(dt = 0) {
        const w = this.w;
        if (!w.boss) return;
        // While a boss walks, leapfrog: call back volunteers it has left behind and send them on ahead.
        let from = 0.4, to = 1;
        const boss = w.bossEnt;
        if (boss) {
            const pr = w.progress(boss);
            from = Math.min(0.97, pr + 0.03); to = Math.min(1, pr + 0.35);
            const R = w.routes[boss.route];
            for (const v of w.people.filter((p) => p.role === 'vol' && p.state === 'stand')) {
                const reach = TRADES[v.trade].range + 0.6;
                const behind = R.nearest(v.x, v.z) < boss.d - 0.8;
                if (behind && (v.x - boss.x) ** 2 + (v.z - boss.z) ** 2 > reach * reach) w.recall(v.id);
            }
        }
        const trades = Object.keys(TRADES).sort((a, b) => w.tradePower(b) * (w.available(b) > 0) - w.tradePower(a) * (w.available(a) > 0));
        for (let guard = 0; guard < 12 && w.activeVols() < w.slots; guard++) {
            const avail = trades.filter((t) => w.available(t) > 0);
            if (!avail.length) break;
            // a mix of trades: the one we have fewest of on the field
            const onField = (t) => w.people.filter((p) => p.role === 'vol' && p.trade === t).length;
            avail.sort((a, b) => onField(a) - onField(b) || w.tradePower(b) - w.tradePower(a));
            const tr = avail[0];
            const tile = this.bestVolTile(TRADES[tr].range, from, to);
            if (!tile || !w.deploy(tr, tile[0], tile[1]).ok) break;
        }
    }

    bestVolTile(range, from = 0.4, to = 1) {
        // beside the road, where the most road in the band is in reach
        const w = this.w;
        let best = null, bs = 0;
        for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
            if (!buildable(w.map, x, z) || w.occ[idx(x, z)]) continue;
            let beside = false;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz;
                if (nx >= 0 && nz >= 0 && nx < W && nz < H && w.map.grid[idx(nx, nz)] === 1) beside = true;
            }
            const c = coverage(w, x, z, range, from, to) * (beside ? 1.3 : 1);
            if (c > bs) { bs = c; best = [x, z]; }
        }
        return best;
    }

    /** One simulation step with the bot's decisions. Returns the world's state. */
    step(dt) {
        const w = this.w;
        this.t -= dt;
        if (this.t <= 0) {
            this.t = w.bossEnt ? 0.5 : 2;
            this.spend();
            this.deploy();
            if (w.state === 'build') w.startWave();
        }
        w.tick(dt);
        return w.state;
    }
}

/** Play a whole level with the bot (or idle when `idle`). */
export function playLevel(world, { idle = false, skill = 1, maxTime = 3600, dt = 1 / 30 } = {}) {
    const bot = new Bot(world, { skill });
    while (world.state !== 'won' && world.state !== 'lost' && world.time < maxTime) {
        if (idle) { if (world.state === 'build') world.startWave(); world.tick(dt); }
        else bot.step(dt);
    }
    return world.summary();
}
