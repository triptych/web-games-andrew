// The Baron's crew. Pure: every choice takes G.rng, every move takes dt.
//
//   blip     a wind-up robot: walks, turns or drops at edges, hops up to the platform above you
//   spark    a coil spring: hops in arcs, now and then a big one
//   glooper  a space jelly: floats diagonally and bounces off every block
//   grunt    an alien trooper: walks, and fires a plasma rock along your row
//   moth     a comet moth: drifts after you through everything
//   saucer   a little UFO: cruises from wall to wall, changes height, beams down at you
//
// An enemy is 'enter' (dropping in), 'live', 'trap' (in a bubble), or 'dead' (spinning off to
// become loot). Angry (escaped a bubble, or HURRY UP!) means faster and quicker to act.

import { ENEMY, PLAYER, TIMING, LEFT, RIGHT, H } from '../config.js';
import { moveBody, surface, footCols, solid, clamp } from './physics.js';

const ease = (k) => 1 - (1 - k) * (1 - k);

export function makeEnemy(G, type, x, y) {
    const d = ENEMY[type];
    return {
        id: G.nextId++, type, x, y: y - 22, sx: x, sy: y, w: d.w, h: d.h, vx: 0, vy: 0,
        face: x < 16 ? 1 : -1, st: 'enter', ground: false, mad: false, t: 0, anim: 0,
        think: G.rng.range(0.3, 1.2), cd: G.rng.range(1.2, 2.6), edgeT: 0, alt: y, aim: null,
        bubble: null, value: 0, item: 0,
    };
}

export const isAngry = (G, e) => e.mad || G.hurry;
export const speedOf = (G, e) => (isAngry(G, e) ? ENEMY[e.type].angry : ENEMY[e.type].speed);

/** Is there a surface to hop up to, 1–4 rows above, under this body? */
function canJumpUp(L, e) {
    const [c0, c1] = footCols(e.x, e.w);
    const r0 = Math.round(e.y);
    for (let r = r0 - 1; r >= r0 - 4 && r >= 1; r--) for (let c = c0; c <= c1; c++) if (surface(L, c, r)) return true;
    return false;
}

/** Does a box [x ± w/2] × [y − h, y] overlap any block or wall? */
export function boxSolid(L, x, y, w, h) {
    const c0 = Math.floor(x - w / 2 + 0.05), c1 = Math.floor(x + w / 2 - 0.05);
    const r0 = Math.floor(y - h + 0.05), r1 = Math.floor(y - 0.05);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(L, c, r)) return true;
    return false;
}

export function stepEnemy(G, L, e, dt) {
    e.anim += dt;
    if (e.st === 'enter') {
        e.t += dt;
        const k = Math.min(1, e.t / TIMING.intro);
        e.x = e.sx;
        e.y = e.sy - (1 - ease(k)) * 22;
        return;
    }
    if (e.st === 'dead') { stepDead(G, L, e, dt); return; }
    if (e.st !== 'live') return;
    if (G.freezeT > 0) return;
    e.t += dt;
    const sp = speedOf(G, e);
    const angry = isAngry(G, e);
    const p = G.player;
    const rng = G.rng;
    switch (e.type) {
        case 'blip':
        case 'grunt': {
            if (e.ground) {
                e.think -= dt * (angry ? 1.6 : 1);
                if (e.think <= 0) {
                    e.think = rng.range(0.6, 1.4);
                    const dy = p.y - e.y;
                    if (e.type === 'blip' && dy < -2.5 && Math.abs(p.x - e.x) < 8 && rng() < (angry ? 0.7 : 0.45) && canJumpUp(L, e)) {
                        e.vy = -PLAYER.jumpV; e.ground = false;
                    } else if (Math.abs(dy) < 1.6 && rng() < 0.75) e.face = Math.sign(p.x - e.x) || e.face;
                    else if (rng() < 0.2) e.face = -e.face;
                }
                e.edgeT -= dt;
                const ahead = e.x + e.face * (e.w / 2 + 0.05);
                if (!surface(L, Math.floor(ahead), Math.round(e.y)) && e.edgeT <= 0) {
                    e.edgeT = 0.7;
                    if (rng() < 0.55) e.face = -e.face;
                }
                e.vx = e.face * sp;
            } else e.vy = Math.min(PLAYER.maxFall, e.vy + PLAYER.gravity * dt);
            moveBody(L, e, dt);
            if (e.hitWall) { e.face = -e.hitWall; e.vx = e.face * sp; }
            if (e.type === 'grunt' && p.state === 'alive') {
                e.cd -= dt;
                const pcy = p.y - p.h / 2, ecy = e.y - e.h / 2;
                if (e.cd <= 0 && Math.abs(pcy - ecy) < 1.0 && Math.sign(p.x - e.x) === e.face && Math.abs(p.x - e.x) < 16) {
                    e.cd = angry ? 1.4 : 2.4;
                    G.shots.push({ id: G.nextId++, kind: 'rock', x: e.x + e.face * 0.9, y: ecy, vx: e.face * 8, vy: 0, t: 0 });
                    G.events.push({ type: 'eshot', kind: 'rock', x: e.x, y: ecy });
                }
            }
            break;
        }
        case 'spark': {
            if (e.ground) {
                if (rng() < 0.35) e.face = Math.sign(p.x - e.x) || e.face;
                const big = rng() < (angry ? 0.4 : 0.28);
                e.vy = -(big ? 22 : 14.5);
                e.vx = e.face * sp;
                e.ground = false;
                G.events.push({ type: 'hop', x: e.x, y: e.y });
            } else e.vy = Math.min(PLAYER.maxFall, e.vy + PLAYER.gravity * dt);
            moveBody(L, e, dt);
            if (e.hitWall) { e.face = -e.hitWall; e.vx = e.face * sp; }
            break;
        }
        case 'glooper': {
            if (!e.vx && !e.vy) { e.vx = e.face; e.vy = rng() < 0.5 ? -1 : 1; }
            const sx = Math.sign(e.vx) || 1, sy = Math.sign(e.vy) || 1;
            e.vx = sx * sp; e.vy = sy * sp * 0.75;
            const inside = boxSolid(L, e.x, e.y, e.w, e.h);
            const nx = e.x + e.vx * dt;
            if (nx < LEFT + e.w / 2 || nx > RIGHT - e.w / 2 || (!inside && boxSolid(L, nx, e.y, e.w, e.h))) e.vx = -e.vx;
            else e.x = nx;
            const ny = e.y + e.vy * dt;
            if (ny - e.h < 1 || ny > H - 1 || (!inside && boxSolid(L, e.x, ny, e.w, e.h))) e.vy = -e.vy;
            else e.y = ny;
            e.face = Math.sign(e.vx) || e.face;
            break;
        }
        case 'moth': {
            e.think -= dt;
            if (!e.aim || e.think <= 0) {
                e.think = rng.range(1.0, 1.8) * (angry ? 0.6 : 1);
                e.aim = { x: p.x + rng.range(-3, 3), y: p.y - p.h / 2 + rng.range(-2.5, 1.5) };
            }
            const dx = e.aim.x - e.x, dy = e.aim.y - (e.y - e.h / 2);
            const d = Math.hypot(dx, dy) || 1;
            const wob = Math.sin(e.t * 3.1 + e.id) * 0.9;
            const tvx = (dx / d) * sp - (dy / d) * wob, tvy = (dy / d) * sp + (dx / d) * wob;
            const k = Math.min(1, 1.6 * dt);
            e.vx += (tvx - e.vx) * k; e.vy += (tvy - e.vy) * k;
            e.x = clamp(e.x + e.vx * dt, LEFT + e.w / 2, RIGHT - e.w / 2);
            e.y = clamp(e.y + e.vy * dt, 1 + e.h, H - 1);
            if (Math.abs(e.vx) > 0.2) e.face = Math.sign(e.vx);
            break;
        }
        case 'saucer': {
            if (!e.vx) e.vx = e.face * sp;
            e.vx = Math.sign(e.vx) * sp;
            e.x += e.vx * dt;
            if (e.x < LEFT + e.w / 2) { e.x = LEFT + e.w / 2; e.vx = Math.abs(e.vx); }
            if (e.x > RIGHT - e.w / 2) { e.x = RIGHT - e.w / 2; e.vx = -Math.abs(e.vx); }
            e.face = Math.sign(e.vx);
            e.think -= dt;
            if (e.think <= 0) { e.think = rng.range(3, 6); e.alt = rng.range(3, 19); }
            e.y += clamp(e.alt - e.y, -1.6 * dt, 1.6 * dt);
            e.cd -= dt;
            if (e.cd <= 0 && p.state === 'alive' && Math.abs(p.x - e.x) < 1 && p.y > e.y + 1) {
                e.cd = angry ? 1.3 : 2.2;
                G.shots.push({ id: G.nextId++, kind: 'laser', x: e.x, y: e.y + 0.2, vx: 0, vy: 11, t: 0 });
                G.events.push({ type: 'eshot', kind: 'laser', x: e.x, y: e.y });
            }
            break;
        }
        default: break;
    }
}

/** Popped: spin off in an arc, bounce off the walls, and turn into loot where it lands. */
function stepDead(G, L, e, dt) {
    e.t += dt;
    e.vy = Math.min(18, e.vy + 45 * dt);
    moveBody(L, e, dt);
    if (e.hitWall) e.vx = -e.vx * 0.8;
    if ((e.landed && e.t > 0.3) || e.t > 3.5) e.done = true;
}

/** Pop an enemy: it flies off and becomes an item worth `value` (ITEMS[item]). */
export function killEnemy(G, e, value, item, cause) {
    const rng = G.rng;
    if (e.bubble != null) {
        const i = G.bubbles.findIndex((b) => b.id === e.bubble);
        if (i >= 0) G.bubbles.splice(i, 1);
        e.bubble = null;
    }
    e.st = 'dead';
    e.t = 0;
    e.value = value;
    e.item = item;
    e.vx = (rng() < 0.5 ? -1 : 1) * rng.range(3, 7);
    e.vy = -rng.range(11, 15);
    e.ground = false;
    G.events.push({ type: 'kill', x: e.x, y: e.y - e.h / 2, etype: e.type, cause, value });
}
