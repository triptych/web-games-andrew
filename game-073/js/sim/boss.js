// The Gloamwyrm: a serpent of shadow bound around the Wyrmheart.
// Break its four heart-shards (set in the chamber walls) with the Starforged Lance.

import { W, T, ARENA_TOP, ARENA_BOTTOM, RIG } from '../config.js';
import { SHARDS, HEART_POS, tileAt, setTile } from './world.js';
import { storyEvent } from './story.js';

const TOP = -(ARENA_TOP + 0.6), BOT = -(ARENA_BOTTOM + 0.4);
export const WYRM_SEGS = 22;
export const WYRM_SPACING = 3;   // trail samples between segments
const TRAIL_STEP = 0.15;          // world units between trail samples

export function startBoss(G) {
    const saved = G._bossShards;
    const shards = SHARDS.map((s, i) => ({
        c: s.c, r: s.r,
        broken: saved ? !!saved[i] : tileAt(G.world, s.c, s.r) !== T.SHARD,
    }));
    const head = { x: W / 2, y: (TOP + BOT) / 2 - 3, vx: 0, vy: 0, ang: 0 };
    const trail = [];
    for (let i = 0; i < WYRM_SEGS * WYRM_SPACING + 2; i++) trail.push({ x: head.x - i * TRAIL_STEP * Math.cos(i * 0.05), y: head.y - Math.sin(i * 0.12) * 1.5 });
    G.boss = {
        active: true,
        t: 0,
        head,
        trail,
        trailT: 0,
        mode: 'rise',
        modeT: 2.4,
        lungeDir: { x: 0, y: 0 },
        orbs: [],
        shards,
        stun: 0,
        dying: 0,
        freed: false,
        hurtFlash: 0,
        shardBroken(G2, c, r) { onShard(G2, c, r); },
    };
    G.events.push({ type: 'boss-start' });
    storyEvent(G, { type: 'boss-start' });
}

export const brokenCount = (B) => B.shards.filter((s) => s.broken).length;

function onShard(G, c, r) {
    const B = G.boss;
    const s = B.shards.find((sh) => sh.c === c && sh.r === r);
    if (!s || s.broken) return;
    s.broken = true;
    B.stun = 2.2;
    B.hurtFlash = 1;
    const n = brokenCount(B);
    G.events.push({ type: 'shard', n, x: c + 0.5, y: -(r + 0.5) });
    storyEvent(G, { type: 'shard', n });
    if (n >= B.shards.length) {
        B.dying = 0.001;
        B.orbs.length = 0;
        G.events.push({ type: 'wyrm-dying' });
    }
}

export function bossBlast(G, x, y, rad) {
    const B = G.boss;
    if (!B || B.dying) return;
    if (Math.hypot(B.head.x - x, B.head.y - y) < rad) {
        B.stun = Math.max(B.stun, 2.6);
        B.hurtFlash = 1;
        G.events.push({ type: 'wyrm-stun' });
    }
    B.orbs = B.orbs.filter((o) => Math.hypot(o.x - x, o.y - y) > rad);
}

export function updateBoss(G, dt, api) {
    const B = G.boss, rig = G.rig, h = B.head;
    B.t += dt;
    B.hurtFlash = Math.max(0, B.hurtFlash - dt * 1.5);

    // Leaving the chamber puts the wyrm to sleep; coming back wakes it.
    const inArena = rig.y < -(ARENA_TOP + 0.2);
    if (!B.freed && !B.dying) {
        if (!inArena) { B.active = false; B.orbs.length = 0; }
        else if (!B.active) { B.active = true; B.mode = 'rise'; B.modeT = 1.6; api.emit('boss-wake', {}); }
    }

    // --- Defeat: the shadow burns off and the guardian rises ---
    if (B.dying) {
        B.dying += dt;
        h.vx *= 0.96; h.vy = h.vy * 0.96 + 0.9 * dt;
        h.x += h.vx * dt; h.y += h.vy * dt;
        pushTrail(B);
        if (B.dying > 4 && !B.freed) {
            B.freed = true;
            G.bossDefeated = true;
            setTile(G.world, HEART_POS.c, HEART_POS.r, T.HEART);
            api.emit('wyrm-freed', {});
            storyEvent(G, { type: 'wyrm-freed' });
        }
        return;
    }
    if (!B.active) { pushTrail(B); return; }

    const n = brokenCount(B);
    const aggro = 1 + n * 0.22;
    const dx = rig.x - h.x, dy = rig.y - h.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (B.stun > 0) {
        B.stun -= dt;
        h.vx *= Math.pow(0.1, dt); h.vy *= Math.pow(0.1, dt);
        h.vy += 0.6 * dt;
    } else {
        B.modeT -= dt;
        switch (B.mode) {
            case 'rise': {
                steer(h, W / 2, (TOP + BOT) / 2, 3.5, dt);
                if (B.modeT <= 0) nextMode(G, B);
                break;
            }
            case 'prowl': {
                const a = B.t * 0.7 * aggro;
                const tx = rig.x + Math.cos(a) * 6.5, ty = rig.y + Math.sin(a) * 4.5;
                steer(h, tx, ty, 4.6 * aggro, dt);
                if (B.modeT <= 0) nextMode(G, B);
                break;
            }
            case 'windup': {
                h.vx *= Math.pow(0.05, dt); h.vy *= Math.pow(0.05, dt);
                B.lungeDir = { x: dx / dist, y: dy / dist };
                if (B.modeT <= 0) { B.mode = 'lunge'; B.modeT = 0.85; api.emit('wyrm-lunge', {}); }
                break;
            }
            case 'lunge': {
                const sp = 10.5 * (0.9 + 0.1 * aggro);
                h.vx = B.lungeDir.x * sp; h.vy = B.lungeDir.y * sp;
                if (B.modeT <= 0) nextMode(G, B);
                break;
            }
            case 'spit': {
                h.vx *= Math.pow(0.1, dt); h.vy *= Math.pow(0.1, dt);
                if (!B.spat && B.modeT < 0.6) {
                    B.spat = true;
                    const base = Math.atan2(dy, dx);
                    const k = 1 + Math.min(2, n);
                    for (let i = -k; i <= k; i++) {
                        const a = base + i * 0.28;
                        B.orbs.push({ x: h.x, y: h.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, life: 5 });
                    }
                    api.emit('wyrm-spit', {});
                }
                if (B.modeT <= 0) nextMode(G, B);
                break;
            }
            default: nextMode(G, B);
        }
    }
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.x < 0.8) { h.x = 0.8; h.vx = Math.abs(h.vx); }
    if (h.x > W - 0.8) { h.x = W - 0.8; h.vx = -Math.abs(h.vx); }
    if (h.y > TOP - 0.3) { h.y = TOP - 0.3; h.vy = -Math.abs(h.vy); }
    if (h.y < BOT + 0.3) { h.y = BOT + 0.3; h.vy = Math.abs(h.vy); }
    h.ang = Math.atan2(h.vy, h.vx);
    pushTrail(B);

    // --- Contact ---
    {
        if (Math.hypot(rig.x - h.x, rig.y - h.y) < 0.95 && B.stun <= 0) {
            if (api.hurt(12, 'wyrm')) { rig.vx += Math.sign(rig.x - h.x || 1) * 5; rig.vy += 3; }
        } else {
            for (let i = 1; i < WYRM_SEGS; i++) {
                const p = B.trail[Math.min(B.trail.length - 1, i * WYRM_SPACING)];
                const rad = 0.62 - i * 0.012;
                if (Math.hypot(rig.x - p.x, rig.y - p.y) < rad + 0.3) { api.hurt(6, 'wyrm'); break; }
            }
        }
    }
    // --- Orbs ---
    for (let i = B.orbs.length - 1; i >= 0; i--) {
        const o = B.orbs[i];
        o.life -= dt;
        // a gentle homing pull
        const ox = rig.x - o.x, oy = rig.y - o.y, od = Math.hypot(ox, oy) || 1;
        o.vx += (ox / od) * 1.6 * dt; o.vy += (oy / od) * 1.6 * dt;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (od < 0.45 + RIG.halfW * 0.5) {
            api.hurt(7, 'orb');
            api.emit('orb-pop', { x: o.x, y: o.y });
            B.orbs.splice(i, 1);
        } else if (o.life <= 0) {
            api.emit('orb-pop', { x: o.x, y: o.y });
            B.orbs.splice(i, 1);
        }
    }
}

function nextMode(G, B) {
    const r = G.rng();
    B.spat = false;
    if (B.mode === 'prowl' || B.mode === 'rise') {
        if (r < 0.55) { B.mode = 'windup'; B.modeT = 0.75; }
        else { B.mode = 'spit'; B.modeT = 1.3; }
    } else {
        B.mode = 'prowl';
        B.modeT = 2.2 + G.rng() * 1.8 - brokenCount(B) * 0.3;
    }
}

function steer(h, tx, ty, speed, dt) {
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
    const vx = (dx / d) * speed, vy = (dy / d) * speed;
    const k = 1 - Math.pow(0.08, dt);
    h.vx += (vx - h.vx) * k; h.vy += (vy - h.vy) * k;
}

/** The body follows the path the head took, sampled by distance so it keeps its length when the head stops. */
function pushTrail(B) {
    const last = B.trail[0];
    const dx = B.head.x - last.x, dy = B.head.y - last.y;
    const d = Math.hypot(dx, dy);
    if (d < TRAIL_STEP) return;
    const n = Math.min(20, Math.floor(d / TRAIL_STEP));
    for (let i = 1; i <= n; i++) B.trail.unshift({ x: last.x + (dx / d) * TRAIL_STEP * i, y: last.y + (dy / d) * TRAIL_STEP * i });
    while (B.trail.length > WYRM_SEGS * WYRM_SPACING + 4) B.trail.pop();
}
