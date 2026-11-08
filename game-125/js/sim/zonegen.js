// A planet zone for one drop, generated from a seed and the zone's current state. Hostility sets how many
// creatures wait for you, toxicity how many hazards, barrenness how few plants: terraforming shows up on the ground.
// Every node is proved reachable from the beacon with a flood fill, or the blocking scenery is removed.

import { ZONES, ENEMIES, SPECIES } from './data.js';
import { MAP, BEACON, BOT, ECHO_R } from '../config.js';
import { makeRng } from '../rng.js';

const SOLID_R = { rock: 1.1, wreck: 1.4, rusttree: 0.7, deadtree: 0.6, glass: 0.9, spire: 1.0, crystal: 0.9, shroomtree: 0.8, root: 1.3 };
export const solidRadius = (kind, s) => (SOLID_R[kind] ? SOLID_R[kind] * s : 0);

export function generateZone(zone, Z, seed, opts = {}) {
    const def = ZONES[zone];
    const rng = makeRng(seed);
    const H = MAP.half - 1.5;
    const placed = [];                       // { x, y, r } for spacing
    const free = (x, y, r) => {
        if (Math.abs(x) > H || Math.abs(y) > H) return false;
        if (Math.hypot(x - BEACON.x, y - BEACON.y) < 6 + r) return false;
        if (def.boss && Math.hypot(x, y + 12) < 9 + r) return false;
        for (const p of placed) if ((p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + r) ** 2) return false;
        return true;
    };
    const spot = (r, yMax = H, tries = 80) => {
        for (let i = 0; i < tries; i++) {
            const x = rng.range(-H, H), y = rng.range(-H, yMax);
            if (free(x, y, r)) { placed.push({ x, y, r }); return { x, y }; }
        }
        return null;
    };

    // scenery first, in a few clumps so a zone has open fields and thickets
    const props = [];
    const clumps = Array.from({ length: 5 }, () => ({ x: rng.range(-H, H), y: rng.range(-H, H - 8) }));
    for (let i = 0; i < def.counts.props; i++) {
        const kind = def.props[i % def.props.length];
        const s = rng.range(0.8, 1.4);
        const r = solidRadius(kind, s);
        const c = clumps[i % clumps.length];
        let p = null;
        for (let k = 0; k < 30 && !p; k++) {
            const x = c.x + rng.range(-9, 9), y = c.y + rng.range(-9, 9);
            if (free(x, y, r + 0.6)) { p = { x, y }; placed.push({ x, y, r: r + 0.6 }); }
        }
        if (p) props.push({ kind, x: p.x, y: p.y, s, r, rot: rng.range(0, 6.28) });
    }

    // resource nodes
    const nodes = [];
    let nid = 1;
    const per = 1 + Math.floor((def.tier + 1) / 2);
    const addNode = (kind, extra = {}) => {
        const p = spot(1.2);
        if (p) nodes.push({ id: nid++, kind, x: p.x, y: p.y, amount: kind === 'metal' ? rng.int(3, 5) : rng.int(2, 4), per, prog: 0, sampled: false, ...extra });
    };
    for (let i = 0; i < def.counts.metal; i++) addNode('metal');
    for (let i = 0; i < def.counts.mineral; i++) addNode('mineral');
    const flora = SPECIES.filter((s) => s.zone === zone && s.kind === 'flora');
    const nFlora = Math.max(2, Math.round(def.counts.flora * (0.6 + 0.8 * (1 - Z.barren / 100))));
    for (let i = 0; i < nFlora; i++) addNode('flora', { species: flora[i % flora.length].id });

    // the echo: VESPER's black box, deep in the zone
    let echo = null;
    if (def.echo >= 0 && !opts.echoFound) {
        for (let i = 0; i < 60 && !echo; i++) {
            const x = rng.range(-H, H), y = rng.range(-H, -6);
            if (free(x, y, 1.5)) { echo = { x, y, r: ECHO_R }; placed.push({ x, y, r: 1.5 }); }
        }
    }

    // hazards scale with toxicity
    const hazards = [];
    if (def.hazard !== 'none' && def.hazard !== 'dark') {
        const n = Math.round(def.counts.hazards * Z.toxic / 100);
        for (let i = 0; i < n; i++) {
            const r = def.hazard === 'vent' ? rng.range(1.6, 2.4) : rng.range(2.2, 3.6);
            const x = rng.range(-H, H), y = rng.range(-H, H - 6);
            if (Math.hypot(x - BEACON.x, y - BEACON.y) < r + 5) continue;
            hazards.push({ kind: def.hazard, x, y, r, period: rng.range(3.5, 5.5), phase: rng.range(0, 5) });
        }
    }

    // creatures scale with hostility; a calmed zone's creatures don't start fights
    const enemies = [];
    let eid = 1;
    const k = 0.25 + 0.75 * Z.hostile / 100;
    const passive = Z.hostile < 28;
    for (const type in def.counts.enemies) {
        const n = Math.max(1, Math.round(def.counts.enemies[type] * k));
        for (let i = 0; i < n; i++) {
            const p = spot(1.0, H - 10);
            if (!p) continue;
            enemies.push(makeEnemy(eid++, type, p.x, p.y, passive, Z.hostile));
        }
    }
    let boss = null;
    if (def.boss && !Z.boss) {
        boss = makeEnemy(eid++, 'rootmother', 0, -14, false, 100);
        enemies.push(boss);
        // Heartbloom grows where the Rootmother rests
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            nodes.push({ id: nid++, kind: 'flora', species: 'heartbloom', x: Math.cos(a) * 7, y: -14 + Math.sin(a) * 7, amount: 3, per, prog: 0, sampled: false });
        }
    } else if (def.boss) {
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            nodes.push({ id: nid++, kind: 'flora', species: 'heartbloom', x: Math.cos(a) * 7, y: -14 + Math.sin(a) * 7, amount: 3, per, prog: 0, sampled: false });
        }
    }

    const M = { zone, seed, props, nodes, enemies, hazards, echo, bossId: boss ? boss.id : 0 };
    ensureReachable(M);
    return M;
}

export function makeEnemy(id, type, x, y, passive, hostile) {
    const E = ENEMIES[type];
    const mult = E.boss ? 1 : 0.75 + 0.25 * hostile / 100;
    return {
        id, type, x, y, hx: x, hy: y, hp: Math.round(E.hp * mult), hpMax: Math.round(E.hp * mult),
        st: 'idle', t: 0, cd: 0, wind: 0, wx: x, wy: y, face: 0, hurt: 0, alive: true, passive, provoked: false,
        dmg: E.dmg * (E.boss ? 1 : 0.7 + 0.3 * hostile / 100), sight: E.sight * (0.65 + 0.35 * hostile / 100),
        phase: 0, timers: E.boss ? { ring: 3, slam: 6, spawn: 9 } : null,
    };
}

// ---------------------------------------------------------------- reachability
const CELL = 1;
export function blockedGrid(M, rad = BOT.radius) {
    const n = Math.ceil((MAP.half * 2) / CELL);
    const g = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = -MAP.half + (i + 0.5) * CELL, y = -MAP.half + (j + 0.5) * CELL;
        if (Math.abs(x) > MAP.half - 1 - rad || Math.abs(y) > MAP.half - 1 - rad) { g[j * n + i] = 1; continue; }
        for (const p of M.props) if (p.r && (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + rad) ** 2) { g[j * n + i] = 1; break; }
    }
    return { g, n };
}
export function reachMap(M) {
    const { g, n } = blockedGrid(M);
    const seen = new Uint8Array(n * n);
    const idx = (x, y) => Math.floor((y + MAP.half) / CELL) * n + Math.floor((x + MAP.half) / CELL);
    const start = idx(BEACON.x, BEACON.y);
    const q = [start]; seen[start] = 1;
    while (q.length) {
        const c = q.pop(), i = c % n, j = (c / n) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= n || b >= n) continue;
            const k = b * n + a;
            if (seen[k] || g[k]) continue;
            seen[k] = 1; q.push(k);
        }
    }
    return { seen, n };
}
/** Can a bot get within `reach` of (x, y)? */
export function canReach(R, x, y, reach) {
    const { seen, n } = R;
    const r = Math.ceil(reach);
    const ci = Math.floor((x + MAP.half) / CELL), cj = Math.floor((y + MAP.half) / CELL);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= n || j >= n || !seen[j * n + i]) continue;
        const cx = -MAP.half + (i + 0.5) * CELL, cy = -MAP.half + (j + 0.5) * CELL;
        if (Math.hypot(cx - x, cy - y) <= reach) return true;
    }
    return false;
}
function ensureReachable(M) {
    for (let pass = 0; pass < 40; pass++) {
        const R = reachMap(M);
        const targets = [...M.nodes.map((n) => [n.x, n.y, BOT.gatherReach - 0.2]), ...(M.echo ? [[M.echo.x, M.echo.y, M.echo.r - 0.3]] : [])];
        const bad = targets.find(([x, y, r]) => !canReach(R, x, y, r));
        if (!bad) return;
        // remove the solid prop nearest the stranded target and try again
        let best = -1, bd = Infinity;
        M.props.forEach((p, i) => { if (!p.r) return; const d = Math.hypot(p.x - bad[0], p.y - bad[1]) - p.r; if (d < bd) { bd = d; best = i; } });
        if (best < 0) return;
        M.props.splice(best, 1);
    }
}
