// The maps as the sim sees them: what stands where, what blocks, where an exit leads, and paths between
// any two tiles (also across maps, through the exits whose conditions hold). Pure.

import { MAPS, isSolidGround } from './data/maps.js';
import { cond } from './rules.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const mapOf = (G) => MAPS[G.map];
export const groundAt = (m, x, y) => m.grid[y]?.[x];

export const visibleProps = (G, m = mapOf(G)) => m.props.filter((p) => cond(G, p.cond));
export const visiblePeople = (G, m = mapOf(G)) => m.people.filter((p) => cond(G, p.cond));

/** Events that stand on their tile and block it until used: chests, anchors, unfought fights. */
export function isBumpEvent(G, ev) {
    if (ev.type === 'chest') return true;
    if (ev.type === 'anchor') return !G.flags[ev.flag];
    if (ev.type === 'fight') return !G.done[ev.id] && cond(G, ev.cond);
    return false;
}

export const personAt = (G, x, y, m = mapOf(G)) => visiblePeople(G, m).find((p) => p.x === x && p.y === y);
export const eventsAt = (G, x, y, m = mapOf(G)) => m.events.filter((e) => e.x === x && e.y === y);
export const bumpAt = (G, x, y, m = mapOf(G)) => eventsAt(G, x, y, m).find((e) => isBumpEvent(G, e));
export const exitAt = (m, x, y) => m.exits.find((e) => e.x === x && e.y === y);

export function propAt(G, x, y, m = mapOf(G)) {
    for (const p of visibleProps(G, m)) {
        if (x < p.x || x >= p.x + p.w || y < p.y || y >= p.y + p.h) continue;
        if (p.door !== undefined && y === p.y + p.h - 1 && x === p.x + p.door) continue;
        return p;
    }
    return null;
}

/** Can the player stand here (ignoring people and bump events)? */
export function walkable(G, x, y, m = mapOf(G)) {
    const c = groundAt(m, x, y);
    if (c === undefined || isSolidGround(c)) return false;
    const p = propAt(G, x, y, m);
    return !(p && p.solid !== false);
}

/** Can a path go through here? Exits other than the goal are avoided (stepping on one leaves the map). */
export function passable(G, x, y, m, goal) {
    if (!walkable(G, x, y, m)) return false;
    if (personAt(G, x, y, m) || bumpAt(G, x, y, m)) return false;
    if (exitAt(m, x, y) && !(goal && goal[0] === x && goal[1] === y)) return false;
    return true;
}

/** Breadth-first path on one map from (sx,sy) to (tx,ty). `adjacent` stops next to the goal (to talk or bump). */
export function findPath(G, mapId, sx, sy, tx, ty, adjacent = false) {
    const m = MAPS[mapId];
    const W = m.grid[0].length, H = m.grid.length;
    const key = (x, y) => y * W + x;
    const prev = new Map([[key(sx, sy), null]]);
    const q = [[sx, sy]];
    const isGoal = (x, y) => adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty;
    if (isGoal(sx, sy)) return [];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
            if (!passable(G, nx, ny, m, adjacent ? null : [tx, ty])) continue;
            prev.set(key(nx, ny), [x, y, d]);
            if (isGoal(nx, ny)) {
                const dirs = [];
                let k = key(nx, ny);
                while (prev.get(k)) { const [px, py, pd] = prev.get(k); dirs.unshift(pd); k = key(px, py); }
                return dirs;
            }
            q.push([nx, ny]);
        }
    }
    return null;
}

/** Exits to take from mapId to reach goalMap (by open exits only): a list of exits, or null. */
export function mapRoute(G, fromMap, goalMap) {
    if (fromMap === goalMap) return [];
    const prev = new Map([[fromMap, null]]);
    const q = [fromMap];
    while (q.length) {
        const id = q.shift();
        for (const ex of MAPS[id].exits) {
            if (!cond(G, ex.cond) || prev.has(ex.to)) continue;
            prev.set(ex.to, { from: id, ex });
            if (ex.to === goalMap) {
                const route = [];
                let k = goalMap;
                while (prev.get(k)) { route.unshift(prev.get(k).ex); k = prev.get(k).from; }
                return route;
            }
            q.push(ex.to);
        }
    }
    return null;
}

/** The next direction to walk toward a tile on any map (or null if there is no way / already there). */
export function stepToward(G, goalMap, tx, ty, adjacent) {
    const route = mapRoute(G, G.map, goalMap);
    if (!route) return null;
    if (route.length) {
        const ex = route[0];
        const p = findPath(G, G.map, G.x, G.y, ex.x, ex.y, false);
        return p && p.length ? p[0] : null;
    }
    const p = findPath(G, G.map, G.x, G.y, tx, ty, adjacent);
    return p && p.length ? p[0] : null;
}

export function faceTile(G) {
    const [dx, dy] = DIRS[G.face];
    return [G.x + dx, G.y + dy];
}
