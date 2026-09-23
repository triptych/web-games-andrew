/**
 * bots.mjs — scripted pilots, shared by balance.mjs and playthrough.mjs.
 *
 * The point of these is that the difficulty curve is tuned against numbers
 * rather than vibes: three bots with different priorities play the same level
 * and the gap between them is the skill gradient the design claims to have.
 */

import { ARENA, PLAYER } from '../js/core/config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function threat(world, lookahead = 0.45) {
    // Repulsion from where bullets are ABOUT to be, not where they are.
    const p = world.player;
    let tx = 0, ty = 0, count = 0, nearest = Infinity;
    for (const b of world.eBullets) {
        if (!b.alive) continue;
        const bx = b.x + Math.cos(b.ang) * b.speed * lookahead;
        const by = b.y + Math.sin(b.ang) * b.speed * lookahead;
        const dx = p.x - bx, dy = p.y - by;
        const d = Math.hypot(dx, dy);
        if (d > 5) continue;
        const w = 1 / Math.max(0.35, d * d);
        tx += dx * w; ty += dy * w;
        count++;
        nearest = Math.min(nearest, Math.hypot(p.x - b.x, p.y - b.y));
    }
    for (const h of world.hazards) {
        if (!h.alive) continue;
        const dx = p.x - h.x, dy = p.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d < 5) { tx += dx / Math.max(0.5, d) * 3; ty += dy / Math.max(0.5, d) * 3; count++; }
    }
    for (const bm of world.beams) {
        if (!bm.alive) continue;
        const dx = Math.cos(bm.ang), dy = Math.sin(bm.ang);
        const rx = p.x - bm.x, ry = p.y - bm.y;
        const perp = -rx * dy + ry * dx;
        if (Math.abs(perp) < 3) { tx += Math.sign(perp || 1) * -dy * 2.5; ty += Math.sign(perp || 1) * dx * 2.5; count++; }
    }
    return { tx, ty, count, nearest };
}

function nearestPod(world) {
    const p = world.player;
    let best = null, bestScore = Infinity;
    for (const pod of world.pods) {
        if (!pod.alive) continue;
        const d = Math.hypot(pod.x - p.x, pod.y - p.y);
        // pods about to fall off the bottom are worth more
        const urgency = (pod.y - ARENA.bottom) / ARENA.h + (pod.burn > 0 ? pod.burn / 24 : 0.4);
        const s = d * (0.4 + urgency);
        if (s < bestScore) { bestScore = s; best = pod; }
    }
    return best;
}

/**
 * @param {string} style 'scared' | 'greedy' | 'pilot'
 */
export function makeBot(style = 'pilot') {
    return function botInput(world) {
        const p = world.player;
        const th = threat(world);
        const pod = nearestPod(world);
        let ax = 0, ay = 0;

        const dodgeWeight = style === 'scared' ? 1.0 : style === 'greedy' ? 0.35 : 0.8;
        const podWeight = style === 'scared' ? 0.15 : style === 'greedy' ? 1.0 : 0.6;

        if (th.count) {
            const len = Math.hypot(th.tx, th.ty) || 1;
            ax += (th.tx / len) * dodgeWeight;
            ay += (th.ty / len) * dodgeWeight;
        }
        if (pod) {
            const dx = pod.x - p.x, dy = pod.y - p.y;
            const len = Math.hypot(dx, dy) || 1;
            ax += (dx / len) * podWeight;
            ay += (dy / len) * podWeight;
        } else if (style !== 'greedy') {
            ay += (-7 - p.y) * 0.08;          // drift back toward the safe lane
        }

        // stay off the walls
        if (p.x < ARENA.left + 2.5) ax += 0.8;
        if (p.x > ARENA.right - 2.5) ax -= 0.8;
        if (p.y < ARENA.bottom + 2) ay += 0.8;
        if (p.y > ARENA.top - 4) ay -= 0.8;

        const len = Math.hypot(ax, ay) || 1;
        const focus = style !== 'greedy' && th.nearest < 2.2;
        const panic = th.nearest < 0.55 && p.flares > 0 && style !== 'greedy';

        return {
            ax: clamp(ax / len, -1, 1),
            ay: clamp(ay / len, -1, 1),
            focus,
            fire: true,
            flare: panic,
            od: p.od >= 100,
            pointer: { active: false, x: 0, y: 0 },
        };
    };
}
