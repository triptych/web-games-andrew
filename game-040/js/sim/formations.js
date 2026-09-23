/**
 * formations.js — turns "six skimmers in a vee from the left" into concrete
 * spawn positions and stagger delays. PURE: position maths only.
 *
 * Every formation returns [{ x, y, delay, opts }] where `delay` is seconds after
 * the cue fires. Spawn y values sit above ARENA.top so enemies fly in.
 */

import { ARENA } from '../core/config.js';

const TOP = ARENA.top + 2.2;

export const FORMATION_NAMES = [
    'line', 'column', 'vee', 'arc', 'flankL', 'flankR', 'sine', 'scatter', 'pair', 'anchor', 'wall',
];

export function buildFormation(name, count, opts = {}, rng = null) {
    const fn = FORMATIONS[name];
    if (!fn) throw new Error(`[formations] unknown formation "${name}"`);
    return fn(count, opts, rng);
}

const spanX = (i, n, width, centre = 0) =>
    n <= 1 ? centre : centre - width / 2 + (width * i) / (n - 1);

const FORMATIONS = {
    // shoulder-to-shoulder across the top
    line(n, o) {
        const width = o.width ?? ARENA.w * 0.72;
        return Array.from({ length: n }, (_, i) => ({
            x: spanX(i, n, width, o.cx ?? 0),
            y: TOP,
            delay: i * (o.stagger ?? 0),
            opts: { homeX: spanX(i, n, width, o.cx ?? 0), seedPhase: i * 0.7, ...o.each },
        }));
    },

    // single file down one column
    column(n, o) {
        const x = o.x ?? 0;
        return Array.from({ length: n }, (_, i) => ({
            x, y: TOP,
            delay: i * (o.stagger ?? 0.45),
            opts: { homeX: x, seedPhase: i * 0.9, ...o.each },
        }));
    },

    // a chevron: the classic shmup entrance
    vee(n, o) {
        const width = o.width ?? 9;
        const dy = o.dy ?? 1.1;
        return Array.from({ length: n }, (_, i) => {
            const half = (n - 1) / 2;
            const off = i - half;
            const x = (o.cx ?? 0) + (off * width) / Math.max(1, n - 1) * 2;
            return {
                x, y: TOP + Math.abs(off) * dy,
                delay: 0,
                opts: { homeX: x, seedPhase: i * 0.5, ...o.each },
            };
        });
    },

    // an arc bowing downward into the arena
    arc(n, o) {
        const width = o.width ?? ARENA.w * 0.8;
        const depth = o.depth ?? 3;
        return Array.from({ length: n }, (_, i) => {
            const t = n <= 1 ? 0.5 : i / (n - 1);
            const x = (o.cx ?? 0) - width / 2 + width * t;
            return {
                x, y: TOP + Math.sin(t * Math.PI) * depth,
                delay: i * (o.stagger ?? 0.08),
                opts: { homeX: x, holdY: o.holdY, seedPhase: t * 3, ...o.each },
            };
        });
    },

    flankL(n, o) { return flank(n, o, -1); },
    flankR(n, o) { return flank(n, o, 1); },

    // a stream that enters weaving
    sine(n, o) {
        const x = o.x ?? 0;
        return Array.from({ length: n }, (_, i) => ({
            x, y: TOP,
            delay: i * (o.stagger ?? 0.32),
            opts: { homeX: x, amp: o.amp ?? 6, seedPhase: i * 0.8, ...o.each },
        }));
    },

    // scattered across the top — needs an rng, falls back to a fixed spread
    scatter(n, o, rng) {
        return Array.from({ length: n }, (_, i) => {
            const x = rng ? rng.range(ARENA.left + 1.5, ARENA.right - 1.5)
                          : spanX(i, n, ARENA.w * 0.8);
            return {
                x, y: TOP + (rng ? rng.range(0, 3) : i * 0.6),
                delay: i * (o.stagger ?? 0.22),
                opts: { homeX: x, seedPhase: i * 1.3, ...o.each },
            };
        });
    },

    // two mirrored groups
    pair(n, o) {
        const gap = o.gap ?? 7;
        return Array.from({ length: n }, (_, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const x = side * gap / 2 + side * Math.floor(i / 2) * (o.spacing ?? 1.4);
            return {
                x, y: TOP + Math.floor(i / 2) * 1.2,
                delay: Math.floor(i / 2) * (o.stagger ?? 0.3),
                opts: { homeX: x, seedPhase: i * 0.6, ...o.each },
            };
        });
    },

    // fixed emplacements that ride the scenery down (turrets)
    anchor(n, o) {
        const xs = o.xs ?? Array.from({ length: n }, (_, i) => spanX(i, n, ARENA.w * 0.7));
        return xs.slice(0, n).map((x, i) => ({
            x, y: TOP + (o.dy ?? 0) + i * (o.spacing ?? 0),
            delay: i * (o.stagger ?? 0),
            opts: { homeX: x, seedPhase: i * 1.1, ...o.each },
        }));
    },

    // a dense rank: the pressure formation used late
    wall(n, o) {
        const width = o.width ?? ARENA.w * 0.9;
        return Array.from({ length: n }, (_, i) => {
            const x = spanX(i, n, width, o.cx ?? 0);
            return {
                x, y: TOP + (i % 2) * 1.4,
                delay: 0,
                opts: { homeX: x, seedPhase: i * 0.4, ...o.each },
            };
        });
    },
};

function flank(n, o, side) {
    const x = side < 0 ? ARENA.left - 1.5 : ARENA.right + 1.5;
    return Array.from({ length: n }, (_, i) => ({
        x,
        y: (o.y ?? 6) + i * (o.spacing ?? 1.6),
        delay: i * (o.stagger ?? 0.25),
        opts: { homeX: side < 0 ? ARENA.left + 4 : ARENA.right - 4, seedPhase: i * 0.7, ...o.each },
    }));
}
