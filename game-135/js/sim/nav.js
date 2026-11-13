// A coarse grid over the town and A* on it. The bot plans with it and the tests prove every job site can be
// reached with it (and that the east bank cannot be, before the bridge). Pure.

import { WORLD, RADIUS } from '../config.js';
import { obstacles } from './world.js';

export const CELL = 2;
export const NW = WORLD.w / CELL, NH = WORLD.h / CELL;
export const cellOf = (x, y) => Math.min(NH - 1, Math.max(0, Math.floor(y / CELL))) * NW + Math.min(NW - 1, Math.max(0, Math.floor(x / CELL)));
export const centre = (i) => ({ x: ((i % NW) + 0.5) * CELL, y: (Math.floor(i / NW) + 0.5) * CELL });

/** 1 where a vehicle's centre cannot be: inside a wall grown by the vehicle's radius plus `pad`, or off the map. */
export function staticGrid(G, pad = 0.35) {
    const g = new Uint8Array(NW * NH), grow = RADIUS + pad, obs = obstacles(G);
    for (let i = 0; i < g.length; i++) {
        const { x, y } = centre(i);
        if (x < grow || y < grow || x > WORLD.w - grow || y > WORLD.h - grow) { g[i] = 1; continue; }
        for (const r of obs) if (x > r.x - grow && x < r.x + r.w + grow && y > r.y - grow && y < r.y + r.h + grow) { g[i] = 1; break; }
    }
    return g;
}

/** A copy of the grid with the debris marked too (all but `skip`, the piece being fetched). */
export function withDebris(G, grid, skip = -1, pad = 0.3) {
    const g = grid.slice();
    for (const d of G.debris) {
        if (d.id === skip) continue;
        const rr = d.r + RADIUS + pad;
        for (let cy = Math.floor((d.y - rr) / CELL); cy <= Math.floor((d.y + rr) / CELL); cy++) for (let cx = Math.floor((d.x - rr) / CELL); cx <= Math.floor((d.x + rr) / CELL); cx++) {
            if (cx < 0 || cy < 0 || cx >= NW || cy >= NH) continue;
            if (Math.hypot((cx + 0.5) * CELL - d.x, (cy + 0.5) * CELL - d.y) < rr) g[cy * NW + cx] = 1;
        }
    }
    return g;
}

/** The free cell nearest to a point (the point's own cell when it is free), or -1. */
export function nearestFree(grid, x, y, maxRing = 10) {
    const cx = Math.min(NW - 1, Math.max(0, Math.floor(x / CELL))), cy = Math.min(NH - 1, Math.max(0, Math.floor(y / CELL)));
    let best = -1, bd = Infinity;
    for (let ring = 0; ring <= maxRing; ring++) {
        for (let j = cy - ring; j <= cy + ring; j++) for (let i = cx - ring; i <= cx + ring; i++) {
            if (i < 0 || j < 0 || i >= NW || j >= NH || Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== ring) continue;
            const k = j * NW + i;
            if (grid[k]) continue;
            const d = Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - y);
            if (d < bd) { bd = d; best = k; }
        }
        if (best >= 0 && ring * CELL > bd) break;
    }
    return best;
}

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

/** A* from cell a to cell b; returns the cells of the path (a first) or null. Diagonals never cut a corner. */
export function findPath(grid, a, b) {
    if (a < 0 || b < 0) return null;
    const N = grid.length, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const bx = b % NW, by = Math.floor(b / NW);
    const h = (i) => { const dx = Math.abs((i % NW) - bx), dy = Math.abs(Math.floor(i / NW) - by); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const heap = [[h(a), a]];
    gs[a] = 0;
    while (heap.length) {
        // pop the smallest f
        let mi = 0;
        for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[mi][0]) mi = i;
        const [, cur] = heap[mi];
        heap[mi] = heap[heap.length - 1]; heap.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === b) {
            const path = [];
            for (let c = b; c >= 0; c = from[c]) path.push(c);
            return path.reverse();
        }
        const cx = cur % NW, cy = Math.floor(cur / NW);
        for (const [dx, dy, cost] of NB) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
            const n = ny * NW + nx;
            if (grid[n] || closed[n]) continue;
            if (dx && dy && (grid[cy * NW + nx] || grid[ny * NW + cx])) continue;
            const ng = gs[cur] + cost;
            if (ng < gs[n]) { gs[n] = ng; from[n] = cur; heap.push([ng + h(n), n]); }
        }
    }
    return null;
}

/** Every cell that can be driven to from a point (flood fill, same neighbour rules as the path finder). */
export function reachable(grid, x, y) {
    const start = nearestFree(grid, x, y), seen = new Uint8Array(grid.length);
    if (start < 0) return seen;
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const cur = q.pop(), cx = cur % NW, cy = Math.floor(cur / NW);
        for (const [dx, dy] of NB) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue;
            const n = ny * NW + nx;
            if (grid[n] || seen[n]) continue;
            if (dx && dy && (grid[cy * NW + nx] || grid[ny * NW + cx])) continue;
            seen[n] = 1; q.push(n);
        }
    }
    return seen;
}

/** Is the straight line between two points free on the grid? (The start point itself is not checked.) */
export function lineFree(grid, ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.8));
    for (let i = 1; i <= n; i++) if (grid[cellOf(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)]) return false;
    return true;
}
