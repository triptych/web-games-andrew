/**
 * table.js — the static playfield: walls, the top arc, the plunger lane,
 * funnels, slingshots, pop bumpers and flipper pivots.
 *
 * Every wall is a capsule segment { ax, ay, bx, by, r }. The view builds its
 * neon tubes from the exact same list, so what you see is what the ball hits.
 */

import { TABLE, FLIPPER } from '../config.js';

export function buildTable() {
    const walls = [];
    const add = (ax, ay, bx, by, o = {}) => {
        walls.push({
            id: walls.length,
            ax, ay, bx, by,
            r:        o.r ?? 0.12,
            e:        o.e,                   // undefined → PHYS.wallE
            kind:     o.kind ?? 'wall',      // 'wall' | 'sling' | 'gate' | 'floor'
            group:    o.group ?? 'inner',    // which neon tube set draws it
            side:     o.side ?? 0,
            visible:  o.visible ?? true,
            inside:   o.inside ?? null,      // a point on the open side → wall is one-sided
        });
    };

    const { left: L, right: R, laneOuter: LO, arcCx, arcCy, arcR, funnelY, laneTop } = TABLE;

    // --- Outer boundary: left wall → top arc → lane outer wall ---
    const outline = [];
    outline.push([L, funnelY]);
    outline.push([L, arcCy]);
    const ARC_SEGS = 44;
    // The arc's left end is at x = arcCx - arcR = L; its right end at LO.
    for (let i = 1; i <= ARC_SEGS; i++) {
        const a = Math.PI - (i / ARC_SEGS) * Math.PI;
        outline.push([arcCx + Math.cos(a) * arcR, arcCy + Math.sin(a) * arcR]);
    }
    outline.push([LO, 0]);
    for (let i = 0; i < outline.length - 1; i++) {
        const [ax, ay] = outline[i];
        const [bx, by] = outline[i + 1];
        add(ax, ay, bx, by, { group: 'outer', inside: [0.65, 14] });
    }

    // --- Plunger lane ---
    add(R, 0, R, laneTop, { group: 'inner' });                     // inner lane wall == right field wall
    add(R, laneTop, LO, laneTop + 0.7, { kind: 'gate', group: 'gate' }); // one-way gate
    add(R, 0.15, LO, 0.15, { kind: 'floor', visible: false });     // lane floor

    // --- Funnels down to the flipper pivots ---
    const px = FLIPPER.pivotX, py = FLIPPER.pivotY;
    add(L, funnelY, -px - 0.12, py + 0.14, { group: 'inner', inside: [0, 12] });
    add(R, funnelY,  px + 0.12, py + 0.14, { group: 'inner', inside: [0, 12] });

    // --- Drain guides under each flipper: once a ball drops between the
    // flipper tips it can only fall, never wander back up behind a flipper.
    add(-px, py, -1.3, -0.6, { group: 'drain' });
    add( px, py,  1.3, -0.6, { group: 'drain' });

    // --- Slingshots: solid triangles whose inner face kicks ---
    const slings = [];
    for (const s of [-1, 1]) {
        const A = [s * 4.75, 8.6], B = [s * 4.75, 6.4], C = [s * 3.45, 5.3];
        // Solid triangle: each face is one-sided, pushing away from the centroid.
        const G = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
        const away = (P, Q) => [2 * (P[0] + Q[0]) / 2 - G[0], 2 * (P[1] + Q[1]) / 2 - G[1]];
        add(A[0], A[1], C[0], C[1], { kind: 'sling', group: 'sling', side: s, r: 0.14, inside: away(A, C) });
        add(A[0], A[1], B[0], B[1], { group: 'slingBack', r: 0.1, inside: away(A, B) });
        add(B[0], B[1], C[0], C[1], { group: 'slingBack', r: 0.1, inside: away(B, C) });
        slings.push({ side: s, A, B, C });
    }

    // --- Pop bumpers ---
    const bumpers = [
        { id: 0, x: -2.35, y: 14.3, r: 0.8 },
        { id: 1, x:  2.35, y: 14.3, r: 0.8 },
        { id: 2, x:  0.0,  y: 11.7, r: 0.8 },
    ];

    // --- Shield bar across the drain (only solid while SHIELD is active) ---
    const shield = { ax: -1.75, ay: 1.0, bx: 1.75, by: 1.0, r: 0.14 };

    // One-sided walls get a unit normal pointing at their open side.
    for (const w of walls) {
        if (!w.inside) continue;
        let nx = -(w.by - w.ay), ny = w.bx - w.ax;
        const l = Math.hypot(nx, ny);
        nx /= l; ny /= l;
        const mx = (w.ax + w.bx) / 2, my = (w.ay + w.by) / 2;
        if ((w.inside[0] - mx) * nx + (w.inside[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
        w.nx = nx; w.ny = ny;
    }

    return { walls, slings, bumpers, shield, outline };
}

/** True if (x, y) lies inside the region a brick is allowed to occupy. */
export function insideBrickZone(x, y, sideMargin, arcMargin) {
    const { left: L, right: R, arcCx, arcCy, arcR } = TABLE;
    if (x < L + sideMargin || x > R - sideMargin) return false;
    if (y > arcCy) {
        const dx = x - arcCx, dy = y - arcCy;
        if (Math.hypot(dx, dy) > arcR - arcMargin) return false;
    }
    return true;
}
