// The explorer bot. It walks the real walker (the same input a player gives) to every friend and every hoard on a
// level, then takes the stairs down, until the deepest level is done. Used by the tests (proof that everything the
// generator placed can really be reached, at walking speed, with the real collision) and by the "Tour" button.
// Pure, like the rest of js/sim.

import { ELEMENTS } from './data/elements.js';
import { isWalk } from './tiles.js';
import { MICRO } from '../config.js';
import { microOf, centre } from './walker.js';

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export function makeBot() {
    return { path: null, goal: null, lv: -1, stuck: 0, lastD: Infinity, done: false, skip: {} };
}

/** BFS over walkable, unblocked micro cells from (sx, sy) to the first cell where test(x, y) holds. */
function bfs(L, sx, sy, test) {
    const blocked = new Uint8Array(L.mw * L.mh);
    for (const f of L.features) if (f.block) blocked[f.my * L.mw + f.mx] = 1;
    const prev = new Int32Array(L.mw * L.mh).fill(-1);
    const s = sy * L.mw + sx;
    prev[s] = s;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], x = c % L.mw, y = (c / L.mw) | 0;
        if (test(x, y)) {
            const path = [];
            for (let k = c; k !== s; k = prev[k]) path.push({ x: k % L.mw, y: (k / L.mw) | 0 });
            return path.reverse();
        }
        for (let d = 0; d < 4; d++) {
            const nx = x + DX[d], ny = y + DY[d];
            if (nx < 0 || ny < 0 || nx >= L.mw || ny >= L.mh) continue;
            const nc = ny * L.mw + nx;
            if (prev[nc] >= 0 || blocked[nc] || !isWalk(L.grid[ny][nx])) continue;
            // the stairs are only a goal, never a way through
            const ch = L.grid[ny][nx];
            if ((ch === 'v' || ch === '^') && !test(nx, ny)) continue;
            prev[nc] = c;
            q.push(nc);
        }
    }
    return null;
}

const wanted = (G, f) => {
    const e = ELEMENTS[f.kind];
    return f.block && e && (e.cat === 'monsters' || e.cat === 'hoards') && !G.found[f.id];
};

/** The next input. Steers along a BFS path; when nothing is left on a level, heads for the stairs down. */
export function botInput(G, bot) {
    const L = G.d.levels[G.lv];
    const mx = microOf(G.x), my = microOf(G.z);
    if (bot.lv !== G.lv) { bot.lv = G.lv; bot.path = null; }
    const left = L.features.filter((f) => wanted(G, f) && !bot.skip[f.id]);
    if (!bot.path || !bot.path.length || bot.goal?.found?.()) {
        bot.path = null;
        if (left.length) {
            // the nearest one by path: BFS to any cell beside a wanted feature
            const near = new Map();
            for (const f of left) for (let d = 0; d < 4; d++) near.set((f.my + DY[d]) * L.mw + f.mx + DX[d], f);
            const path = bfs(L, mx, my, (x, y) => near.has(y * L.mw + x));
            if (path) {
                const end = path.length ? path[path.length - 1] : { x: mx, y: my };
                const f = near.get(end.y * L.mw + end.x);
                path.push({ x: f.mx, y: f.my, feature: true });
                bot.path = path;
                bot.goal = { found: () => !!G.found[f.id], id: f.id };
            } else for (const f of left) bot.skip[f.id] = 1;     // unreachable (the tests count these)
        } else if (L.down) {
            bot.path = bfs(L, mx, my, (x, y) => x === L.down.mx && y === L.down.my) || [];
            bot.goal = { found: () => G.lv !== L.k, id: 'stairs' };
        } else {
            bot.done = true;
            return { fx: 0, sx: 0, yaw: 0, pitch: 0 };
        }
    }
    if (!bot.path || !bot.path.length) return { fx: 0, sx: 0, yaw: 0, pitch: 0 };
    // drop waypoints we are already in
    while (bot.path.length > 1 && bot.path[0].x === mx && bot.path[0].y === my) bot.path.shift();
    const wp = bot.path[0];
    const tx = centre(wp.x), tz = centre(wp.y);
    const dx = tx - G.x, dz = tz - G.z;
    if (!wp.feature && Math.hypot(dx, dz) < MICRO * 0.2 && bot.path.length > 1) bot.path.shift();
    const want = Math.atan2(dx, -dz);
    let dyaw = want - G.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const turn = Math.max(-0.08, Math.min(0.08, dyaw));
    return { fx: Math.abs(dyaw) < 0.9 ? 1 : 0.15, sx: 0, yaw: turn, pitch: -G.pitch * 0.1 };
}
