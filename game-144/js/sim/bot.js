// An auto-player. It plays through the same input the player uses ({ x, y, focus, bomb, warp, burst, done, cont }),
// so the tests, the balance table and the attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// Each decision it tries 18 moves (9 directions × focus on/off), extrapolates the nearby bullets a short way ahead,
// scores each move by danger plus how well it lines up a shot, and takes the best. skill (0..1) sets how often it
// re-decides, how many bullets it actually notices and how far ahead it looks; a skill-1 bot is the "perfect" one.

import { FIELD } from '../config.js';
import { makeRng } from '../rng.js';
import { PILOT_BY_ID } from './data/pilots.js';
import { beamDist } from './patterns.js';

const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [0.71, -0.71], [-0.71, 0.71], [-0.71, -0.71]];

export function makeBot({ skill = 1, seed = 7, bombs = true, cont = false } = {}) {
    return { skill, rng: makeRng(seed * 2654435761), every: skill >= 0.95 ? 2 : skill >= 0.6 ? 4 : 7, k: 0, last: { x: 0, y: 0, focus: false }, bombs, cont, panic: 0 };
}

function targetY(G) {
    const p = G.player;
    if (G.boss && G.boss.vuln && !G.boss.dead) return G.boss.coreW.y;
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
        if (e.dead || e.x < p.x || e.x > FIELD.w) continue;
        const d = Math.abs(e.y - p.y) + (e.x - p.x) * 0.15 - (e.r > 1 ? 3 : 0);
        if (d < bd) { bd = d; best = e; }
    }
    return best ? best.y : FIELD.h / 2;
}

/** Danger of standing at (x, y) at time t ahead, given a list of nearby bullets (linear extrapolation). */
function danger(G, bl, x, y, t, hit) {
    let d = 0;
    for (const b of bl) {
        const bx = b.x + b.vx * t, by = b.y + b.vy * t;
        const dx = bx - x, dy = by - y;
        const r = b.r + hit;
        const dd = dx * dx + dy * dy;
        if (dd < (r + 0.18) * (r + 0.18)) d += 60;
        else if (dd < 2.2) d += 0.6 / (dd + 0.05);
    }
    for (const bm of G.beams) {
        if (bm.t + t < bm.warm - 0.25) continue;
        const db = beamDist({ x: bm.x, y: bm.y, ang: bm.ang + (bm.spin || 0) * t, len: bm.len }, x, y);
        if (db < bm.w * 0.5 + hit + 0.45) d += 60;
    }
    for (const e of G.enemies) {
        if (e.dead || e.part) continue;
        const ex = e.x + e.vx * t, ey = e.y + e.vy * t;
        if (Math.hypot(ex - x, ey - y) < e.r + 0.5) d += 30;
    }
    for (const w of G.walls) {
        const wx = w.x - (G.capital ? G.capital.speed * t : 0);
        if (x > wx - 0.55 && x < wx + w.w + 0.55 && y > w.y - 0.55 && y < w.y + w.h + 0.55) d += 45;
        else if (x < wx && x > wx - 2.5 && y > w.y - 0.4 && y < w.y + w.h + 0.4) d += 3;   // a wall bearing down
    }
    return d;
}

export function botInput(G, bot) {
    if (G.phase === 'talk') return { x: 0, y: 0, done: true };
    if (G.phase === 'over') return { x: 0, y: 0, cont: bot.cont, done: !bot.cont };
    const p = G.player;
    bot.k++;
    if (bot.k % bot.every !== 0 && bot.panic <= 0) return { ...bot.last, bomb: false, warp: false, burst: false };
    if (bot.panic > 0) bot.panic--;

    const pl = PILOT_BY_ID[p.pilot];
    // the bullets it notices: nearby ones, minus a share it misses at lower skill
    const notice = 0.55 + 0.45 * bot.skill;
    const near = [];
    for (const b of G.bullets) {
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy > 49) continue;
        if (bot.skill < 1 && bot.rng() > notice) continue;
        near.push(b);
    }
    const look = [0.06, 0.15, 0.27, 0.42].slice(0, bot.skill >= 0.6 ? 4 : 3);
    const ty = targetY(G);
    const tx = G.boss ? 6.5 : pl.shot.kind === 'needle' ? 9 : 7.5;
    // the nearest capsule worth fetching
    let item = null, idist = 8;
    for (const it of G.items) if (it.kind !== 'gem') { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < idist) { idist = d; item = it; } }

    let best = null, bestScore = Infinity, here = 0;
    for (const focus of [false, true]) {
        const sp = focus ? pl.stats.focusSpeed : pl.stats.speed;
        for (const [dx, dy] of DIRS) {
            let dz = 0;
            for (const t of look) {
                const x = Math.max(0.5, Math.min(FIELD.w - 0.8, p.x + dx * sp * t));
                const y = Math.max(0.45, Math.min(FIELD.h - 0.45, p.y + dy * sp * t));
                dz += danger(G, near, x, y, t, p.hit) * (1.3 - t);
            }
            const nx = p.x + dx * sp * 0.2, ny = p.y + dy * sp * 0.2;
            let goal = Math.abs(ny - ty) * 0.9 + Math.abs(nx - tx) * 0.25;
            if (item) goal = Math.min(goal, Math.hypot(item.x - nx, item.y - ny) * 0.8);
            if (nx < 1.5) goal += 2;
            const score = dz + goal + (focus && !G.boss ? 0.15 : 0);
            if (dx === 0 && dy === 0 && !focus) here = dz;
            if (score < bestScore) { bestScore = score; best = { x: dx, y: dy, focus }; }
        }
    }
    const inp = { ...best, bomb: false, warp: false, burst: false };
    // nowhere safe: bomb, or warp out
    const doomed = bestScore > 55 && here > 55 && p.inv <= 0;
    if (doomed) {
        if (bot.bombs && G.bombs > 0 && bot.rng() < 0.4 + 0.6 * bot.skill) inp.bomb = true;
        else if (p.warp > 0) { inp.warp = true; inp.x = 1; inp.y = p.y < FIELD.h / 2 ? 0.6 : -0.6; }
        bot.panic = 2;
    }
    if (G.burst >= 100 && (G.boss || G.enemies.length > 6)) inp.burst = true;
    bot.last = { x: inp.x, y: inp.y, focus: inp.focus };
    return inp;
}
