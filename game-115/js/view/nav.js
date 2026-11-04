// Path finding for the people who walk around town. View-only: the sim never needs it, it just
// works out travel times from straight-line distances.

import { MAP } from '../config.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { T_GRASS, T_BRIDGE, idx, inMap } from '../sim/world.js';

export class Nav {
    constructor() { this.blocked = new Uint8Array(MAP.w * MAP.h); this.version = 0; this.cache = new Map(); }

    /** Rebuild from the game: water, buildings and trees block; bridges and open ground do not. */
    rebuild(G) {
        const b = this.blocked;
        for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) {
            const i = idx(x, y);
            const t = G.terr[i];
            b[i] = t === T_GRASS || t === T_BRIDGE ? 0 : 1;
            if (G.occ[i]) b[i] = 1;
        }
        // wild trees and boulders block too, but only the standing ones
        for (const n of G.nodes) if ((n.k === 'tree' || n.k === 'rock') && n.regrow <= 0) b[idx(n.x, n.y)] = 1;
        this.version++;
        this.cache.clear();
    }

    free(x, y) { return inMap(x, y) && !this.blocked[idx(x, y)]; }

    /** The nearest open tile to a point (breadth first, small radius). */
    nearest(x, y) {
        x = Math.max(0, Math.min(MAP.w - 1, Math.floor(x))); y = Math.max(0, Math.min(MAP.h - 1, Math.floor(y)));
        if (this.free(x, y)) return [x, y];
        for (let r = 1; r < 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
            if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
            if (this.free(x + i, y + j)) return [x + i, y + j];
        }
        return [x, y];
    }

    /** Waypoints (tile centres) from a to b, or a straight line when there is no way. */
    path(ax, ay, bx, by) {
        const [sx, sy] = this.nearest(ax, ay), [ex, ey] = this.nearest(bx, by);
        const key = `${sx},${sy}>${ex},${ey}`;
        let p = this.cache.get(key);
        if (p) return p;
        p = this.astar(sx, sy, ex, ey) || [[ex + 0.5, ey + 0.5]];
        if (this.cache.size > 400) this.cache.clear();
        this.cache.set(key, p);
        return p;
    }

    astar(sx, sy, ex, ey) {
        const W = MAP.w, N = W * MAP.h;
        const g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
        const open = [];
        const h = (x, y) => Math.hypot(x - ex, y - ey);
        const s = idx(sx, sy);
        g[s] = 0; open.push([h(sx, sy), s]);
        const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]];
        let guard = 0;
        while (open.length && guard++ < 4000) {
            let bi = 0;
            for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
            const [, cur] = open.splice(bi, 1)[0];
            if (closed[cur]) continue;
            closed[cur] = 1;
            const cx = cur % W, cy = (cur / W) | 0;
            if (cx === ex && cy === ey) {
                const out = [];
                for (let c = cur; c !== -1; c = from[c]) out.push([(c % W) + 0.5, ((c / W) | 0) + 0.5]);
                return out.reverse();
            }
            for (const [dx, dy, cost] of D) {
                const nx = cx + dx, ny = cy + dy;
                if (!this.free(nx, ny)) continue;
                if (dx && dy && (!this.free(cx + dx, cy) || !this.free(cx, cy + dy))) continue;     // no cutting corners
                const ni = idx(nx, ny);
                const ng = g[cur] + cost;
                if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; open.push([ng + h(nx, ny), ni]); }
            }
        }
        return null;
    }
}

/** Road tiles: a path from every building's door to the hall's, drawn as dirt by the terrain painter. */
export function roadTiles(G, nav) {
    const tiles = new Set();
    const hall = G.buildings.find((b) => b.type === 'hall');
    if (!hall) return tiles;
    const door = (b) => { const d = BUILDINGS[b.type]; return [b.x + d.w / 2, b.y + d.h + 0.4]; };
    const hd = door(hall);
    const gate = [G.bounds.x0 + 0.5, 15.5];
    const addPath = (p) => { for (const [x, y] of p) tiles.add(`${Math.floor(x)},${Math.floor(y)}`); };
    addPath(nav.path(hd[0], hd[1] + 1, gate[0], gate[1]));
    for (const b of G.buildings) {
        if (b === hall || b.lv < 1 && !b.bld) continue;
        const d = BUILDINGS[b.type];
        if (d.kind === 'deco' && d.w * d.h <= 1) continue;
        const bd = door(b);
        addPath(nav.path(bd[0], bd[1], hd[0], hd[1] + 1));
    }
    return tiles;
}
