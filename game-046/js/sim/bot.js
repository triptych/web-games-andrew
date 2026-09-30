/**
 * bot.js — an autopilot archer, used by the headless tests (dev/simtest.mjs)
 * and by the title screen's attract-mode demo.
 *
 * Each frame it scores its own spot for danger (bullets projected ahead,
 * telegraphed circles, beams, charge lines, rings, bodies, spikes). In
 * danger it steps to the safest of 16 nearby spots; otherwise it stands
 * still to shoot, or walks (on a flow field) to find a line of sight, the
 * shrine or the door.
 */

import { ABILITIES } from '../config.js';
import { flowField, flowStep, cellAt, colOf, rowOf, walkable, lineClear, SPIKE } from './grid.js';
import { choose } from './world.js';
import { targetable } from './combat.js';

const PRIORITY = [
    'multishot', 'front', 'ricochet', 'atk', 'aspd', 'diagonal', 'extralife', 'crit', 'bolt', 'pierce',
    'fire', 'poison', 'hpboost', 'giant', 'orbFire', 'spirit', 'frost', 'star', 'aegis', 'headshot',
    'side', 'rage', 'bloodthirst', 'dodge', 'bouncy', 'orbIce', 'speed', 'rear', 'heal',
];
const MELEE = new Set(['slime', 'slimelet', 'bat', 'boar', 'golem', 'spider', 'ghost', 'boss']);

export function makeBot(skill = 1) {
    return { skill, holdT: 0, mx: 0, my: 0, flowKey: '', flow: null, stuckT: 0, lastX: 0, lastY: 0 };
}

/** Pick a card for whatever choice is open. */
export function botChoose(w) {
    const ch = w.choice;
    if (!ch) return;
    const p = w.player;
    if (ch.kind === 'angel') return choose(w, p.hp < p.stat.maxHp * 0.7 ? 'heal' : ch.options[1]);
    if (ch.kind === 'devil') return choose(w, p.hp > p.stat.maxHp * 0.55 ? ch.options[0] : 'refuse');
    const opts = [...ch.options];
    if (opts.includes('heal') && p.hp < p.stat.maxHp * 0.45) return choose(w, 'heal');
    opts.sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
    choose(w, opts[0] in ABILITIES ? opts[0] : ch.options[0]);
}

function segDist(px, py, x, y, ang, len) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const t = Math.max(0, Math.min(len, (px - x) * cx + (py - y) * cy));
    return Math.hypot(px - (x + cx * t), py - (y + cy * t));
}

/** How dangerous is standing at (x, y) over the next ~0.6 s? */
export function dangerAt(w, x, y) {
    const p = w.player;
    const pr = p.r + 0.18;
    let danger = 0;
    for (const b of w.bullets) {
        for (let t = 0; t <= 0.6; t += 0.1) {
            const bx = b.x + b.vx * t, by = b.y + b.vy * t;
            const rr = b.r + pr;
            if ((bx - x) ** 2 + (by - y) ** 2 < rr * rr) { danger += 1.2 - t; break; }
        }
    }
    for (const h of w.hazards) {
        if (h.kind === 'circle') {
            const d = Math.hypot(x - h.x, y - h.y), R = h.r + pr;
            if (d < R && h.delay - h.t < 1.5) danger += 2 * (0.5 + 0.5 * (1 - d / R));   // graded, so there is a way out
        } else if (h.kind === 'ring') {
            const d = Math.hypot(x - h.x, y - h.y);
            if (h.r > 0 && d < h.maxR + pr && d > h.r - h.width && (d - h.r) / h.speed < 0.45) danger += 2;
        } else if (h.kind === 'beam') {
            const d = segDist(x, y, h.x, h.y, h.ang, h.len), R = h.width + pr + 0.25;
            if (d < R && h.t < h.delay + h.dur) danger += 2.2 * (0.5 + 0.5 * (1 - d / R));
        } else if (h.kind === 'line') {
            const d = segDist(x, y, h.x, h.y, h.ang, h.len), R = (h.width || 0.5) + pr + 0.3;
            if (d < R) danger += 1.6 * (0.5 + 0.5 * (1 - d / R));
        }
    }
    for (const e of w.enemies) {
        if (!e.alive || e.burrowed || e.spawnT > 0.3) continue;
        const melee = MELEE.has(e.type);
        const reach = e.r + pr + (melee ? 0.9 : 0.25) + (e.state === 'charge' || e.state === 'dive' ? 1.2 : 0);
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < reach) danger += (melee ? 1.5 : 0.6) * (0.4 + 0.6 * (1 - d / reach));
        if ((e.state === 'charge' || e.state === 'charging') && e.data.ang !== undefined) {
            // Stay out of a charging body's lane.
            const L = segDist(x, y, e.x, e.y, e.data.ang, 7), R = e.r + pr + 0.35;
            if (L < R) danger += 1.8 * (0.5 + 0.5 * (1 - L / R));
        }
    }
    if (cellAt(w.grid, colOf(x), rowOf(y)) === SPIKE) danger += 1.2;
    return danger;
}

function walkTo(bot, w, tx, ty) {
    const g = w.grid, p = w.player;
    const tc = Math.max(0, Math.min(g.cols - 1, colOf(tx))), tr = Math.max(0, Math.min(g.rows - 1, rowOf(ty)));
    const key = `${w.stageNum}:${tc}:${tr}`;
    if (bot.flowKey !== key) { bot.flowKey = key; bot.flow = flowField(g, tc, tr, bot.flow); }
    let dx, dy;
    if (Math.hypot(tx - p.x, ty - p.y) < 1.4 || lineClear(g, p.x, p.y, tx, ty, (t) => !walkable(t))) { dx = tx - p.x; dy = ty - p.y; }
    else {
        const wp = flowStep(g, bot.flow, p.x, p.y);
        if (!wp) { dx = tx - p.x; dy = ty - p.y; } else { dx = wp.x - p.x; dy = wp.y - p.y; }
    }
    const d = Math.hypot(dx, dy) || 1;
    return { mx: dx / d, my: dy / d };
}

/**
 * The nearest tile with a clear shot at the target from a sensible range and
 * little danger, skipping tiles already tried without success (`bad`).
 */
function firingSpot(w, tgt, bad) {
    const g = w.grid, p = w.player;
    let best = null, bs = Infinity;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        if (!walkable(cellAt(g, c, r))) continue;
        const x = c - 5, y = r + 0.5;
        const dT = Math.hypot(x - tgt.x, y - tgt.y);
        if (dT < 2.8 || dT > 8) continue;
        if (bad && bad.has(c + r * 11)) continue;
        if (!lineClear(g, x, y, tgt.x, tgt.y)) continue;
        const sc = Math.hypot(x - p.x, y - p.y) + dangerAt(w, x, y) * 4 + (cellAt(g, c, r) === SPIKE ? 3 : 0);
        if (sc < bs) { bs = sc; best = { x, y }; }
    }
    return best;
}

const okSpot = (w, x, y) => Math.abs(x) < 5.2 && y > 0.4 && y < w.grid.rows - 0.4 && walkable(cellAt(w.grid, colOf(x), rowOf(y)));

export function botInput(bot, w, dt) {
    const p = w.player;
    const none = { mx: 0, my: 0 };
    if (w.phase === 'choice') { botChoose(w); return none; }
    if (w.phase !== 'fight' && w.phase !== 'clear') return none;

    // Keep a committed dodge for a moment to avoid jitter.
    if (bot.holdT > 0) {
        bot.holdT -= dt;
        return { mx: bot.mx, my: bot.my };
    }

    const here = dangerAt(w, p.x, p.y);
    if (here > 0.15 && w.phase === 'fight') {
        let best = null, bestScore = here * 10;
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            let sum = 0, wsum = 0, ok = true;
            for (const [step, wt] of [[0.5, 1], [1.1, 0.6], [1.8, 0.35]]) {
                const x = p.x + Math.cos(a) * step, y = p.y + Math.sin(a) * step;
                if (!okSpot(w, x, y)) { if (step < 1) ok = false; break; }
                sum += dangerAt(w, x, y) * wt; wsum += wt;
            }
            let score = ok ? (sum / wsum) * 10 : 0;
            if (!ok) continue;
            // Prefer staying near the middle of the room and away from walls.
            score += Math.abs(p.x + Math.cos(a)) * 0.12;
            if (score < bestScore) { bestScore = score; best = a; }
        }
        if (best !== null) {
            bot.mx = Math.cos(best); bot.my = Math.sin(best);
            bot.holdT = 0.12 / bot.skill;
            return { mx: bot.mx, my: bot.my };
        }
    }

    if (w.phase === 'fight') {
        // Find something to shoot at.
        let tgt = null, bd = Infinity;
        for (const e of w.enemies) {
            if (!targetable(e)) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < bd) { bd = d; tgt = e; }
        }
        if (!tgt) return none;
        // Not landing hits (no line of sight, or arrows clipping a corner)? Go find a firing position.
        if (w.stats.hits !== bot.lastHits) { bot.lastHits = w.stats.hits; bot.dryT = 0; }   // arrow hits, not DoT ticks
        else bot.dryT = (bot.dryT || 0) + dt;
        const los = w.enemies.some((e) => targetable(e) && lineClear(w.grid, p.x, p.y, e.x, e.y));
        bot.noLos = los ? 0 : (bot.noLos || 0) + dt;
        if (bot.dryT < 2 && (los || bot.noLos < 0.6)) { bot.spot = null; return none; }
        if (bot.dryT >= 2) {
            // This tile doesn't work: never pick it again in this room.
            if (bot.badRoom !== w.stageNum) { bot.badRoom = w.stageNum; bot.bad = new Set(); }
            bot.bad.add(colOf(p.x) + rowOf(p.y) * 11);
            bot.dryT = 0;
            bot.spot = null;
        }
        bot.spotT = (bot.spotT || 0) - dt;
        if (!bot.spot || bot.spotT <= 0) {
            bot.spot = firingSpot(w, tgt, bot.badRoom === w.stageNum ? bot.bad : null);
            bot.spotT = 0.6;
        }
        if (!bot.spot) return walkTo(bot, w, tgt.x, tgt.y);
        if (Math.hypot(bot.spot.x - p.x, bot.spot.y - p.y) < 0.1) return none;     // in position: shoot
        return walkTo(bot, w, bot.spot.x, bot.spot.y);
    }

    // Clear: loot is vacuumed; visit the shrine, then the door.
    const s = w.shrine;
    if (s && !s.used && (s.kind === 'angel' || p.hp > p.stat.maxHp * 0.55)) return walkTo(bot, w, s.x, s.y);
    if (w.pendingLevels > 0) return none;
    if (p.y > w.grid.rows - 1.2 && Math.abs(p.x) < 1.1) return { mx: -p.x * 0.5, my: 1 };
    return walkTo(bot, w, 0, w.grid.rows - 0.5);
}
