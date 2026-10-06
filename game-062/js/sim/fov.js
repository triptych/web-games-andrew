// Field of view: rays from the hero's tile to every tile on the square of radius R. A ray stops
// at the first opaque tile (which is itself marked visible, so walls light up).

import { opaque } from './tiles.js';

export function computeFov(map, cx, cy, R, vis) {
    vis.fill(0);
    const { w, h } = map;
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) vis[y * w + x] = 1; };
    mark(cx, cy);
    const ray = (tx, ty) => {
        const dx = tx - cx, dy = ty - cy;
        const n = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
        for (let s = 1; s <= n; s++) {
            const x = Math.round(cx + (dx * s) / n), y = Math.round(cy + (dy * s) / n);
            if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > R * R) return;
            mark(x, y);
            if (opaque(map.at(x, y))) return;
        }
    };
    for (let i = -R; i <= R; i++) { ray(cx + i, cy - R); ray(cx + i, cy + R); ray(cx - R, cy + i); ray(cx + R, cy + i); }
    // Second pass: reveal opaque tiles adjacent to a visible floor so wall faces don't flicker.
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        if (vis[y * w + x] || !opaque(map.at(x, y))) continue;
        if ((vis[y * w + x - 1] && !opaque(map.at(x - 1, y))) || (vis[y * w + x + 1] && !opaque(map.at(x + 1, y)))
            || (vis[(y - 1) * w + x] && !opaque(map.at(x, y - 1))) || (vis[(y + 1) * w + x] && !opaque(map.at(x, y + 1)))) {
            if ((x - cx) ** 2 + (y - cy) ** 2 <= (R + 1) ** 2) vis[y * w + x] = 2;
        }
    }
    for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1;
}
