// ============================================================
// The five island bosses. Same contract as enemies.js: pure, and they only
// touch the game through `g`. Every boss is a small state machine over
// { state, t } with an HP bar; `vulnerable(b)` and `stompable(b)` decide
// what hurts it.
// ============================================================

import { TILE } from './config.js';

const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);

export const BOSS = {
    // ---------------------------------------------------- World 1
    chompo: {
        name: 'CHOMPO', w: 30, h: 26, hp: 16,
        stompable: () => true, vulnerable: () => true,
        update(b, g, dt) {
            b.t += dt;
            const p = g.player;
            const angry = b.hp < b.maxHp / 2;
            if (b.state === 'walk') {
                b.dir = sign(p.x - b.x) || b.dir;
                b.vx = b.dir * (angry ? 52 : 36);
                if (b.t > (angry ? 2.2 : 3)) { b.state = 'crouch'; b.t = 0; b.vx = 0; }
            } else if (b.state === 'crouch') {
                b.vx = 0;
                if (b.t > 0.35) {
                    b.state = 'hop'; b.t = 0;
                    b.vy = -400; b.onGround = false;
                    b.vx = clamp((p.x - b.x) * 1.1, -140, 140);
                    g.event('sfx', { name: 'bossjump' });
                }
            } else if (b.state === 'hop') {
                if (b.onGround && b.t > 0.1) {
                    b.state = 'walk'; b.t = 0; b.vx = 0;
                    g.event('shake', { amt: 5 }); g.event('sfx', { name: 'thud' });
                    g.quake(b);
                    if (g.countEnemies('bug') < (angry ? 3 : 2)) g.spawnEnemyPx('bug', b.x + b.w / 2, b.y + b.h - 12, -b.dir);
                }
            }
            const r = g.moveEnemy(b, dt);
            if (r.wall && b.state === 'walk') b.dir = -b.dir;
        },
    },

    // ---------------------------------------------------- World 2
    sandsnake: {
        name: 'SIR SANDSNAKE', w: 20, h: 18, hp: 20, segments: 7,
        stompable: () => false,
        vulnerable: b => b.state === 'leap',
        update(b, g, dt) {
            b.t += dt;
            const a = g.arenaPx;
            const floorY = a.floor;
            if (!b.trail) b.trail = [];
            if (b.state === 'idle' || b.state === 'under') {
                b.hidden = true;
                b.x = -999;
                if (b.t > (b.hp < b.maxHp / 2 ? 1.0 : 1.5)) {
                    // pick a side and warn
                    const fromLeft = g.player.x > (a.x0 + a.x1) / 2;
                    b.sx = fromLeft ? a.x0 + 30 : a.x1 - 50;
                    b.state = 'warn'; b.t = 0;
                    g.event('sfx', { name: 'rumble' });
                }
            } else if (b.state === 'warn') {
                g.dust(b.sx + 10, floorY);
                if (b.t > 0.7) {
                    b.state = 'leap'; b.t = 0; b.hidden = false;
                    b.x = b.sx; b.y = floorY - 4;
                    const toward = sign(g.player.x - b.x) || 1;
                    const span = Math.max(100, Math.min(a.x1 - a.x0 - 80, Math.abs(g.player.x - b.x) + 70));
                    b.vx = toward * span / 1.25;
                    b.vy = -440;
                    b.trail.length = 0;
                    g.event('sfx', { name: 'splash' });
                }
            } else if (b.state === 'leap') {
                b.vy += 700 * dt;
                b.x += b.vx * dt; b.y += b.vy * dt;
                b.dir = sign(b.vx) || 1;
                if (b.x < a.x0 + 4) { b.x = a.x0 + 4; b.vx = Math.abs(b.vx); }
                if (b.x + b.w > a.x1 - 4) { b.x = a.x1 - 4 - b.w; b.vx = -Math.abs(b.vx); }
                if (b.vy > 0 && b.y > floorY) {
                    b.state = 'under'; b.t = 0;
                    g.dust(b.x + 10, floorY);
                    // a spray of sand from the dive hole when angry
                    if (b.hp < b.maxHp * 0.6) for (const vx of [-90, -30, 30, 90]) g.shootAt('sand', b.x + 10, floorY - 6, vx, -260);
                }
            }
            b.trail.unshift({ x: b.x, y: b.y });
            if (b.trail.length > 60) b.trail.length = 60;
        },
        // body segments hurt on touch
        parts(b) {
            if (b.hidden || !b.trail) return [];
            const out = [];
            for (let i = 1; i <= 7; i++) {
                const p = b.trail[Math.min(b.trail.length - 1, i * 5)];
                if (p && p.y < b.arenaFloor) out.push({ x: p.x + 2, y: p.y + 2, w: 14, h: 14, i });
            }
            return out;
        },
    },

    // ---------------------------------------------------- World 3
    glimmerjaw: {
        name: 'GLIMMERJAW', w: 36, h: 34, hp: 24,
        stompable: () => false,
        vulnerable: b => b.eye === 'open',
        update(b, g, dt) {
            b.t += dt;
            const a = g.arenaPx;
            if (!b.home) { b.home = b.y - 70; b.eye = 'closed'; b.eyeT = 0; b.state = 'hover'; }
            b.eyeT += dt;
            const angry = b.hp < b.maxHp / 2;
            if (b.state === 'hover') {
                b.dir = b.dir || -1;
                b.x += b.dir * (angry ? 55 : 40) * dt;
                if (b.x < a.x0 + 24) b.dir = 1;
                if (b.x + b.w > a.x1 - 24) b.dir = -1;
                b.y += (b.home + Math.sin(b.t * 2) * 8 - b.y) * Math.min(1, dt * 3);
                if (b.eye === 'closed' && b.eyeT > (angry ? 1.8 : 2.5)) { b.eye = 'open'; b.eyeT = 0; b.shots = 0; g.event('sfx', { name: 'eye' }); }
                if (b.eye === 'open') {
                    if (b.eyeT > 0.4 + b.shots * 0.7 && b.shots < (angry ? 3 : 2)) {
                        b.shots++;
                        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
                        const ang = Math.atan2(g.player.y - cy, g.player.x - cx);
                        for (let i = -2; i <= 2; i++) {
                            const t = ang + i * 0.28;
                            g.shootAt('crystal', cx, cy, Math.cos(t) * 120, Math.sin(t) * 120);
                        }
                        g.event('sfx', { name: 'crystal' });
                    }
                    if (b.eyeT > 2.2) { b.eye = 'closed'; b.eyeT = 0; if (g.rng.chance(angry ? 0.7 : 0.45)) { b.state = 'slam'; b.t = 0; b.vy = 0; } }
                }
            } else if (b.state === 'slam') {
                if (b.t < 0.4) { b.x += Math.sin(b.t * 60) * 0.8; return; }
                b.vy = Math.min(460, (b.vy || 0) + 1500 * dt);
                b.y += b.vy * dt;
                if (b.y + b.h >= a.floor) {
                    b.y = a.floor - b.h; b.state = 'rise'; b.t = 0; b.vy = 0;
                    g.event('shake', { amt: 6 }); g.event('sfx', { name: 'thud' }); g.quake(b);
                    for (const vx of [-150, -80, 80, 150]) g.shootAt('crystal', b.x + b.w / 2, b.y + b.h - 6, vx, -200, true);
                    b.eye = 'open'; b.eyeT = 0.8; b.shots = 9;
                }
            } else if (b.state === 'rise') {
                if (b.t > 1.3) { b.y -= 90 * dt; if (b.y <= b.home) { b.state = 'hover'; b.eye = 'closed'; b.eyeT = 0; } }
            }
        },
    },

    // ---------------------------------------------------- World 4
    nimbus: {
        name: 'NIMBUS GRUMP', w: 44, h: 28, hp: 30,
        stompable: () => false, vulnerable: () => true,
        update(b, g, dt) {
            b.t += dt;
            const a = g.arenaPx;
            if (!b.home) { b.home = a.top + 22; b.y = b.home; b.state = 'drift'; b.dir = -1; b.boltT = 0; }
            const angry = b.hp < b.maxHp / 2;
            b.x += b.dir * (angry ? 70 : 50) * dt;
            if (b.x < a.x0 + 8) b.dir = 1;
            if (b.x + b.w > a.x1 - 8) b.dir = -1;
            b.y = b.home + Math.sin(b.t * 1.7) * 10;
            if (b.state === 'drift') {
                b.rainT = (b.rainT || 0) + dt;
                if (b.rainT > (angry ? 0.45 : 0.7)) { b.rainT = 0; g.shootAt('rain', b.x + 6 + g.rng.range(0, b.w - 12), b.y + b.h, 0, 60); }
                if (b.t > (angry ? 3 : 4)) {
                    b.state = 'charge'; b.t = 0;
                    const cols = angry ? 3 : 2;
                    b.bolts = [];
                    const px = g.player.x + 5;
                    b.bolts.push(px);
                    for (let i = 1; i < cols; i++) b.bolts.push(clamp(px + (i % 2 ? 1 : -1) * g.rng.range(40, 90), a.x0 + 16, a.x1 - 16));
                    g.event('sfx', { name: 'charge' });
                }
                if (g.countEnemies('drizzle') < 1 && b.t > 2 && g.rng.chance(dt * 0.15)) g.spawnEnemyPx('drizzle', b.x + b.w / 2, b.y + b.h + 20, 1);
            } else if (b.state === 'charge') {
                if (b.t > 0.85) { b.state = 'strike'; b.t = 0; g.event('sfx', { name: 'thunder' }); g.event('shake', { amt: 4 }); g.event('flash', {}); }
            } else if (b.state === 'strike') {
                if (b.t > 0.35) { b.state = 'drift'; b.t = 0; b.bolts = null; }
            }
        },
        hazards(b, g) {
            if (b.state !== 'strike' || !b.bolts) return [];
            return b.bolts.map(x => ({ x: x - 6, y: b.y + b.h, w: 12, h: g.arenaPx.floor - (b.y + b.h) }));
        },
    },

    // ---------------------------------------------------- World 5
    grumblewort: {
        name: 'KING GRUMBLEWORT', w: 28, h: 34, hp: 48,
        stompable: b => b.phase === 1 && b.state !== 'hover',
        vulnerable: () => true,
        update(b, g, dt) {
            b.t += dt;
            const a = g.arenaPx;
            const p = g.player;
            const frac = b.hp / b.maxHp;
            const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
            if (phase !== b.phase) {
                b.phase = phase; b.state = phase === 2 ? 'fly' : 'walk'; b.t = 0;
                g.event('sfx', { name: 'roar' }); g.event('shake', { amt: 6 });
                if (phase === 3) { b.vy = -200; b.onGround = false; }
            }
            if (b.phase === 2) {
                // flying pot: hover above, drift, drop bombs
                const ty = a.top + 30;
                b.y += (ty - b.y) * Math.min(1, dt * 2);
                b.dir = b.dir || 1;
                b.x += b.dir * 62 * dt;
                if (b.x < a.x0 + 10) b.dir = 1;
                if (b.x + b.w > a.x1 - 10) b.dir = -1;
                b.bombT = (b.bombT || 0) + dt;
                if (b.bombT > 1.3) { b.bombT = 0; g.shootAt('bomb', b.x + b.w / 2, b.y + b.h, b.dir * 30, 0); }
                return;
            }
            const speed = b.phase === 3 ? 70 : 45;
            if (b.state === 'walk') {
                b.dir = sign(p.x - b.x) || b.dir;
                b.vx = b.dir * speed;
                if (b.t > (b.phase === 3 ? 1.4 : 2.2)) { b.state = b.phase === 3 && g.rng.chance(0.5) ? 'slam' : 'throw'; b.t = 0; b.vx = 0; }
            } else if (b.state === 'throw') {
                b.vx = 0;
                if (b.t > 0.4 && !b.thrown) {
                    b.thrown = true;
                    const n = b.phase === 3 ? 4 : 3;
                    for (let i = 0; i < n; i++) g.shootAt('fireball', b.x + b.w / 2, b.y + 8, b.dir * (70 + i * 45), -240 - i * 20);
                    g.event('sfx', { name: 'fireball' });
                }
                if (b.t > 0.9) { b.state = 'hop'; b.t = 0; b.thrown = false; b.vy = -330; b.onGround = false; b.vx = clamp((p.x - b.x) * 0.9, -120, 120); }
            } else if (b.state === 'hop') {
                if (b.onGround && b.t > 0.1) { b.state = 'walk'; b.t = 0; b.vx = 0; g.event('sfx', { name: 'thud' }); }
            } else if (b.state === 'slam') {
                if (!b.jumped) { b.jumped = true; b.vy = -420; b.onGround = false; b.vx = 0; }
                if (b.onGround && b.t > 0.2) {
                    b.jumped = false; b.state = 'walk'; b.t = 0;
                    g.event('shake', { amt: 7 }); g.event('sfx', { name: 'thud' });
                    g.shockwave(b.x + b.w / 2, a.floor, -1); g.shockwave(b.x + b.w / 2, a.floor, 1);
                }
            }
            const r = g.moveEnemy(b, dt);
            if (r.wall) b.dir = -b.dir;
        },
    },
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function makeBoss(kind, tx, ty) {
    const def = BOSS[kind];
    return {
        kind, def, boss: true,
        x: tx * TILE + (TILE - def.w) / 2, y: (ty + 1) * TILE - def.h,
        w: def.w, h: def.h, vx: 0, vy: 0, dir: -1,
        hp: def.hp, maxHp: def.hp, t: 0, state: kind === 'sandsnake' ? 'idle' : 'walk',
        onGround: false, hurt: 0, awake: false, dead: false, phase: 1,
    };
}
