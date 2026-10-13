// Grid search on the realm's tile grid: a flow field (distance from a goal to
// every tile) for the dragons that chase, and breadth-first paths for the bot
// and for dragons walking to a spot. `pass(x, y)` decides what is walkable for
// whoever is asking; a "fat" pass for 16 px dragons checks a 2 × 2 block.

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/**
 * Distance field from the goal tiles. 8-connected, with diagonals only where
 * both orthogonal neighbours are open (no corner cutting). Returns an
 * Int32Array, -1 for unreachable. `limit` caps the search radius in steps.
 */
export function flowField(gw, gh, goals, pass, limit = 1e9, out = null) {
    const n = gw * gh;
    const dist = out && out.length === n ? out : new Int32Array(n);
    dist.fill(-1);
    const q = new Int32Array(n);
    let head = 0, tail = 0;
    for (const [x, y] of goals) {
        if (x < 0 || y < 0 || x >= gw || y >= gh || !pass(x, y)) continue;
        const k = y * gw + x;
        if (dist[k] < 0) { dist[k] = 0; q[tail++] = k; }
    }
    while (head < tail) {
        const k = q[head++];
        const d = dist[k];
        if (d >= limit) continue;
        const x = k % gw, y = (k / gw) | 0;
        for (let i = 0; i < 8; i++) {
            const dx = DIRS8[i][0], dy = DIRS8[i][1];
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            const nk = ny * gw + nx;
            if (dist[nk] >= 0 || !pass(nx, ny)) continue;
            if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;
            dist[nk] = d + 1;
            q[tail++] = nk;
        }
    }
    return dist;
}

/** The neighbour of (x, y) that is closest to the goal in `dist`, or null. */
export function downhill(dist, gw, gh, x, y, pass) {
    const here = dist[y * gw + x];
    let best = null, bd = here < 0 ? 1e9 : here;
    for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const d = dist[ny * gw + nx];
        if (d < 0 || d >= bd) continue;
        if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;
        bd = d; best = [nx, ny];
    }
    return best;
}

/**
 * Breadth-first path from start to goal (tiles), with optional extra edges
 * (teleport pads): `links(x, y)` returns [[x, y], …] reachable in one hop.
 * Returns the list of tiles after the start, or null.
 */
export function bfsPath(gw, gh, start, goal, pass, links = null, maxNodes = 1e6) {
    const n = gw * gh;
    const prev = new Int32Array(n).fill(-2);
    const q = new Int32Array(n);
    let head = 0, tail = 0;
    const s = start[1] * gw + start[0], g = goal[1] * gw + goal[0];
    prev[s] = -1; q[tail++] = s;
    while (head < tail && tail < maxNodes) {
        const k = q[head++];
        if (k === g) break;
        const x = k % gw, y = (k / gw) | 0;
        const push = (nx, ny) => {
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) return;
            const nk = ny * gw + nx;
            if (prev[nk] !== -2 || !pass(nx, ny)) return;
            prev[nk] = k; q[tail++] = nk;
        };
        for (let i = 0; i < 8; i++) {
            const dx = DIRS8[i][0], dy = DIRS8[i][1];
            if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;
            push(x + dx, y + dy);
        }
        if (links) for (const [lx, ly] of links(x, y)) push(lx, ly);
    }
    if (prev[g] === -2) return null;
    const path = [];
    for (let k = g; k !== s; k = prev[k]) path.push([k % gw, (k / gw) | 0]);
    return path.reverse();
}
