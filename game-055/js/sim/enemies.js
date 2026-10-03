// Enemy archetypes. Each has stats, an update (movement) and a fire script:
// a generator that yields the number of seconds to wait before resuming,
// which makes firing rhythms read like a score ("burst, pause, ring, pause").
//
// Ground units ride the terrain (their y grows with the scroll) and check the
// terrain under their next step so tanks stay on land and boats on water.

import { shoot, ring, fan, aimed, aimAngle, stack, dens, C } from './bullets.js';
import { LAND, WATER } from './terrain.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function canFire(e, w, minDist = 80) {
    if (e.y < 4 || e.y > w.H * 0.8 || e.x < 4 || e.x > w.W - 4) return false;
    const p = w.player;
    if (!p.alive) return false;
    const dx = p.x - e.x, dy = p.y - e.y;
    return dx * dx + dy * dy > minDist * minDist;
}

/** Fire rate scale: waits are divided by this. */
const fr = (w) => w.diff.fireRate;

function terrainY(w, y) { return w.scroll + w.H - y; }

// ------------------------------------------------------------------ movement

function moveAir(e, w, dt) {
    const m = e.mv;
    switch (m.type) {
        case 'dive': {
            e.y += m.vy * dt;
            e.x = m.x0 + Math.sin(e.t * (m.freq || 0) + (m.ph || 0)) * (m.amp || 0) + (m.vx || 0) * e.t;
            break;
        }
        case 'bez': { // cubic bezier over m.dur seconds, then keep going along the end tangent
            const u = e.t / m.dur;
            if (u <= 1) {
                const [a, b, c, d] = m.p;
                const iu = 1 - u;
                const x = iu * iu * iu * a[0] + 3 * iu * iu * u * b[0] + 3 * iu * u * u * c[0] + u * u * u * d[0];
                const y = iu * iu * iu * a[1] + 3 * iu * iu * u * b[1] + 3 * iu * u * u * c[1] + u * u * u * d[1];
                m.ex = (x - e.x) / dt; m.ey = (y - e.y) / dt;
                e.x = x; e.y = y;
            } else { e.x += m.ex * dt; e.y += m.ey * dt; }
            break;
        }
        case 'hover': { // fly to (tx, ty), hold, then leave
            if (e.t < m.hold) {
                const k = 1 - Math.exp(-dt * (m.ease || 2.2));
                const tx = m.tx + Math.sin(e.t * (m.sfreq || 0.6)) * (m.sway || 0);
                e.x += (tx - e.x) * k;
                e.y += (m.ty - e.y) * k;
            } else {
                m.lv = (m.lv || 0) + dt * 260;
                e.x += (m.ldx || 0) * m.lv * dt;
                e.y += (m.ldy ?? -1) * m.lv * dt;
            }
            break;
        }
        case 'cross': {
            e.x += m.vx * dt;
            e.y = m.y0 + Math.sin(e.t * (m.freq || 1)) * (m.amp || 0) + (m.vy || 0) * e.t;
            break;
        }
        case 'formation': { // go to slot, then descend slowly with a gentle sway
            const k = 1 - Math.exp(-dt * 3);
            m.sy += m.vy * dt;
            e.x += (m.sx + Math.sin(e.t * 1.3) * 18 - e.x) * k;
            e.y += (m.sy - e.y) * k;
            break;
        }
    }
    if (m.face && (e.x !== e.px || e.y !== e.py)) e.rot = Math.atan2(e.y - e.py, e.x - e.px) + Math.PI / 2;
}

function moveGround(e, w, dt) {
    e.y += w.scrollSpeed * dt;
    const m = e.mv;
    if (!m || !m.spd) return;
    const want = m.on ?? LAND;
    const nx = e.x + Math.cos(e.dir) * m.spd * dt;
    const ny = e.y + Math.sin(e.dir) * m.spd * dt;
    const ahead = 20;
    const ax = e.x + Math.cos(e.dir) * ahead, ay = e.y + Math.sin(e.dir) * ahead;
    if (w.terrain.kind(ax, terrainY(w, ay)) === want && ax > 10 && ax < w.W - 10) {
        e.x = nx; e.y = ny;
        m.stuck = 0;
    } else {
        m.stuck = (m.stuck || 0) + dt;
        e.dir += (m.turn || 1) * dt * 2.4;
    }
    if (m.road) { // desert convoys hug the highway
        const rx = w.terrain.roadX(terrainY(w, e.y)) + m.lane;
        e.x += (rx - e.x) * Math.min(1, dt * 4);
        e.dir = m.roadDir;
    }
}

// ------------------------------------------------------------------ archetypes

export const ENEMIES = {
    hornet: {
        hp: 26, r: 13, score: 100, salvage: 4, size: 's',
        update: moveAir,
        *fire(e, w) {
            yield w.rng.range(0.3, 1.1);
            for (;;) {
                if (canFire(e, w)) {
                    if (e.elite) aimed(w, e.x, e.y + 8, 3, 0.36, 175, 'pellet', C.pink);
                    else shoot(w, e.x, e.y + 8, aimAngle(w, e.x, e.y), 170, 'pellet', C.red);
                    w.ev('eshot', { x: e.x, y: e.y, k: 's' });
                }
                yield w.rng.range(1.6, 2.4) / fr(w);
            }
        },
    },
    jet: {
        hp: 46, r: 15, score: 160, salvage: 6, size: 's',
        update(e, w, dt) {
            moveAir(e, w, dt);
            if (!e.data.fired && e.mv.type === 'dive' && e.y > e.data.dropY) {
                e.data.fired = true;
                if (canFire(e, w, 60)) {
                    const n = dens(w, e.elite ? 14 : 10, 6);
                    ring(w, e.x, e.y, n, 150, w.rng.float() * TAU, 'orb', e.elite ? C.purple : C.orange);
                    w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                }
            }
        },
        *fire(e, w) {
            if (e.mv.type !== 'cross') return;
            yield 0.3;
            for (;;) {
                if (canFire(e, w, 50)) shoot(w, e.x, e.y + 10, Math.PI / 2, 190, 'rice', C.orange);
                yield 0.32 / fr(w);
            }
        },
    },
    gunship: {
        hp: 420, r: 25, score: 600, salvage: 25, size: 'm',
        update: moveAir,
        *fire(e, w) {
            yield 1.1;
            let k = 0;
            for (;;) {
                if (canFire(e, w)) {
                    const pick = k++ % 3;
                    if (pick === 0) {
                        for (let i = 0; i < 3; i++) {
                            aimed(w, e.x, e.y + 14, dens(w, 5, 3), 0.7, 210, 'rice', C.red);
                            w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                            yield 0.18;
                        }
                    } else if (pick === 1) {
                        ring(w, e.x, e.y, dens(w, e.elite ? 24 : 16, 8), 140, w.rng.float() * TAU, 'orb', C.cyan);
                        w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                    } else {
                        const a0 = w.rng.float() * TAU;
                        for (let i = 0; i < 10; i++) {
                            fan(w, e.x, e.y, 3, TAU * 2 / 3, a0 + i * 0.22, 165, 'pellet', C.yellow);
                            yield 0.08;
                        }
                    }
                }
                yield 1.4 / fr(w);
            }
        },
    },
    bomber: {
        hp: 1300, r: 46, score: 1500, salvage: 60, size: 'l',
        update: moveAir,
        *fire(e, w) {
            yield 1.4;
            for (let k = 0; ; k++) {
                if (canFire(e, w, 60)) {
                    if (k % 2 === 0) {
                        for (let i = 0; i < 8; i++) {
                            for (const s of [-1, 1]) {
                                const wx = e.x + s * 44;
                                shoot(w, wx, e.y + 6, Math.PI / 2 + s * (0.5 - i * 0.12), 150, 'rice', C.orange);
                            }
                            yield 0.1;
                        }
                    } else {
                        ring(w, e.x, e.y + 12, dens(w, 20, 10), 120, k * 0.3, 'big', C.red, { acc: 30, maxSpd: 200 });
                        w.ev('eshot', { x: e.x, y: e.y, k: 'l' });
                    }
                }
                yield 1.1 / fr(w);
            }
        },
    },
    carrier: {
        hp: 1800, r: 54, score: 2000, salvage: 80, size: 'l',
        update: moveAir,
        *fire(e, w) {
            yield 1.6;
            for (let k = 0; ; k++) {
                if (e.y > 40 && e.mv.lv === undefined) {
                    const side = k % 2 ? 1 : -1;
                    w.spawn('hornet', e.x + side * 50, e.y + 20, {
                        mv: { type: 'bez', dur: 2.6, p: [[e.x + side * 50, e.y + 20], [e.x + side * 200, e.y + 120], [w.player.x, w.H * 0.5], [w.player.x - side * 160, w.H + 60]], face: true },
                    });
                    if (k % 3 === 2 && canFire(e, w)) {
                        aimed(w, e.x, e.y + 30, 3, 0.5, 130, 'big', C.purple);
                        w.ev('eshot', { x: e.x, y: e.y, k: 'l' });
                    }
                }
                yield 1.5 / fr(w);
            }
        },
    },
    mine: {
        hp: 30, r: 11, score: 60, salvage: 2, size: 's',
        update(e, w, dt) {
            moveAir(e, w, dt);
            e.rot += dt * 2;
            if (e.y > w.H * 0.62) w.killEnemy(e, true);
        },
        onDeath(e, w) {
            if (e.y > -10 && e.y < w.H * 0.9) ring(w, e.x, e.y, dens(w, 8, 5), 105, e.rot, 'pellet', C.yellow);
        },
    },
    missile: {
        hp: 10, r: 7, score: 30, salvage: 0, size: 's', hurts: true,
        update(e, w, dt) {
            const p = w.player;
            if (e.t < 2.2 && p.alive) {
                const want = Math.atan2(p.y - e.y, p.x - e.x);
                let d = want - e.data.ang;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                e.data.ang += clamp(d, -1.9 * dt, 1.9 * dt);
            }
            e.data.spd = Math.min(e.data.spd + 160 * dt, 300 * w.bspd);
            e.x += Math.cos(e.data.ang) * e.data.spd * dt;
            e.y += Math.sin(e.data.ang) * e.data.spd * dt;
            e.rot = e.data.ang + Math.PI / 2;
            if (e.t > 6) w.killEnemy(e, true);
        },
    },
    tank: {
        hp: 160, r: 16, score: 250, salvage: 10, size: 'm', ground: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            e.rot = e.dir + Math.PI / 2;
            const want = aimAngle(w, e.x, e.y);
            let d = want - e.trot;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            e.trot += clamp(d, -2 * dt, 2 * dt);
        },
        *fire(e, w) {
            yield w.rng.range(0.6, 1.6);
            for (;;) {
                if (canFire(e, w)) {
                    const n = e.elite ? 3 : 1;
                    for (let i = 0; i < n; i++) {
                        shoot(w, e.x + Math.cos(e.trot) * 16, e.y + Math.sin(e.trot) * 16, e.trot, 165, 'orb', C.orange);
                        w.ev('eshot', { x: e.x, y: e.y, k: 'm', muzzle: e.trot });
                        yield 0.16;
                    }
                }
                yield 2.0 / fr(w);
            }
        },
    },
    aa: {
        hp: 220, r: 15, score: 300, salvage: 12, size: 'm', ground: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            const want = aimAngle(w, e.x, e.y);
            let d = want - e.trot;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            e.trot += clamp(d, -3 * dt, 3 * dt);
        },
        *fire(e, w) {
            yield w.rng.range(0.4, 1.2);
            for (;;) {
                if (canFire(e, w)) {
                    for (let i = 0; i < (e.elite ? 6 : 4); i++) {
                        shoot(w, e.x, e.y, e.trot + (i % 2 ? 0.05 : -0.05), 260, 'arrow', C.yellow);
                        w.ev('eshot', { x: e.x, y: e.y, k: 's', muzzle: e.trot });
                        yield 0.09;
                    }
                }
                yield 2.1 / fr(w);
            }
        },
    },
    sam: {
        hp: 240, r: 17, score: 350, salvage: 14, size: 'm', ground: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            e.trot = aimAngle(w, e.x, e.y);
        },
        *fire(e, w) {
            yield w.rng.range(0.8, 1.6);
            for (;;) {
                if (canFire(e, w, 140)) {
                    const n = e.elite ? 2 : 1;
                    for (let i = 0; i < n; i++) {
                        const m = w.spawn('missile', e.x, e.y, {});
                        m.data.ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.6; m.data.spd = 60;
                        w.ev('missile', { x: e.x, y: e.y });
                    }
                }
                yield 3.4 / fr(w);
            }
        },
    },
    bunker: {
        hp: 520, r: 22, score: 500, salvage: 20, size: 'm', ground: true,
        update: moveGround,
        *fire(e, w) {
            yield w.rng.range(0.6, 1.4);
            for (let k = 0; ; k++) {
                if (canFire(e, w)) {
                    ring(w, e.x, e.y, dens(w, e.elite ? 18 : 12, 8), 120, k * 0.26, 'orb', C.green);
                    w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                    yield 0.5;
                    if (canFire(e, w)) stack(w, e.x, e.y, aimAngle(w, e.x, e.y), 3, 140, 220, 'arrow', C.green);
                }
                yield 2.4 / fr(w);
            }
        },
    },
    boat: {
        hp: 280, r: 18, score: 350, salvage: 14, size: 'm', ground: true, water: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            e.rot = e.dir + Math.PI / 2;
            e.trot = aimAngle(w, e.x, e.y);
        },
        *fire(e, w) {
            yield w.rng.range(0.6, 1.5);
            for (;;) {
                if (canFire(e, w)) {
                    aimed(w, e.x, e.y, dens(w, e.elite ? 5 : 3, 3), 0.42, 180, 'rice', C.cyan);
                    w.ev('eshot', { x: e.x, y: e.y, k: 'm', muzzle: e.trot });
                }
                yield 1.9 / fr(w);
            }
        },
    },
    icebreaker: {
        hp: 900, r: 30, score: 900, salvage: 35, size: 'l', ground: true, water: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            e.rot = e.dir + Math.PI / 2;
            e.trot = aimAngle(w, e.x, e.y);
        },
        *fire(e, w) {
            yield 1.0;
            for (let k = 0; ; k++) {
                if (canFire(e, w)) {
                    if (k % 2) {
                        ring(w, e.x, e.y, dens(w, 10, 6), 95, k * 0.4, 'big', C.blue);
                    } else {
                        for (let i = 0; i < 4; i++) { aimed(w, e.x, e.y, dens(w, 4, 2), 0.3, 200, 'rice', C.cyan); yield 0.12; }
                    }
                    w.ev('eshot', { x: e.x, y: e.y, k: 'l' });
                }
                yield 1.8 / fr(w);
            }
        },
    },
    truck: {
        hp: 70, r: 11, score: 120, salvage: 8, size: 's', ground: true, explodes: 70,
        update(e, w, dt) { moveGround(e, w, dt); e.rot = e.dir + Math.PI / 2; },
    },
    fueltank: {
        hp: 120, r: 18, score: 200, salvage: 12, size: 'm', ground: true, explodes: 90, structure: true,
        update: moveGround,
    },
    radar: {
        hp: 200, r: 16, score: 300, salvage: 15, size: 'm', ground: true, structure: true,
        update(e, w, dt) { moveGround(e, w, dt); e.trot += dt * 1.6; },
    },
    depot: {
        hp: 300, r: 24, score: 400, salvage: 45, size: 'm', ground: true, structure: true,
        update: moveGround,
    },
    turret: {
        hp: 180, r: 14, score: 280, salvage: 12, size: 'm', ground: true,
        update(e, w, dt) { moveGround(e, w, dt); e.trot += dt * (e.data.spin || 2.2); },
        *fire(e, w) {
            e.data.spin = w.rng.sign() * 2.2;
            yield w.rng.range(0.5, 1.5);
            for (;;) {
                if (canFire(e, w)) {
                    for (let i = 0; i < 12; i++) {
                        fan(w, e.x, e.y, 2, Math.PI, e.trot, 150, 'pellet', C.pink);
                        if (i % 3 === 0) w.ev('eshot', { x: e.x, y: e.y, k: 's' });
                        yield 0.1;
                    }
                }
                yield 2.2 / fr(w);
            }
        },
    },
    walker: {
        hp: 300, r: 18, score: 380, salvage: 16, size: 'm', ground: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            e.rot = e.dir + Math.PI / 2;
            e.trot = aimAngle(w, e.x, e.y);
        },
        *fire(e, w) {
            yield w.rng.range(0.8, 1.5);
            for (;;) {
                if (canFire(e, w)) {
                    aimed(w, e.x, e.y, dens(w, e.elite ? 7 : 5, 3), 0.9, 170, 'arrow', C.red);
                    w.ev('eshot', { x: e.x, y: e.y, k: 'm', muzzle: e.trot });
                }
                yield 1.7 / fr(w);
            }
        },
    },
    warhawk: { // mid-boss gunship
        hp: 3200, r: 36, score: 5000, salvage: 150, size: 'l', midboss: true,
        update(e, w, dt) {
            moveAir(e, w, dt);
            e.rot = Math.sin(e.t * 0.8) * 0.15;
        },
        *fire(e, w) {
            w.ev('banner', { text: 'HEAVY GUNSHIP', sub: 'WARHAWK INBOUND' });
            yield 2.2;
            for (let k = 0; ; k++) {
                if (e.mv.lv !== undefined) return;
                const pick = k % 3;
                if (pick === 0) {
                    for (let i = 0; i < 36; i++) {
                        const a = i * 0.21;
                        fan(w, e.x, e.y, 4, TAU * 3 / 4, a, 150, 'rice', C.orange);
                        if (i % 6 === 0) w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                        yield 0.07;
                    }
                } else if (pick === 1) {
                    for (let i = 0; i < 4; i++) {
                        for (const s of [-1, 1]) aimed(w, e.x + s * 34, e.y + 10, dens(w, 5, 3), 0.5, 220, 'arrow', C.red);
                        w.ev('eshot', { x: e.x, y: e.y, k: 'm' });
                        yield 0.3;
                    }
                } else {
                    ring(w, e.x, e.y, dens(w, 24, 12), 90, k * 0.2, 'big', C.purple, { split: { at: 1.1, n: dens(w, 6, 4), spd: 120, style: 'pellet', color: C.pink } });
                    w.ev('eshot', { x: e.x, y: e.y, k: 'l' });
                }
                yield 1.0 / fr(w);
            }
        },
    },
    beacon: { // stranded civilians: hover over them to winch them up
        hp: 1, r: 18, score: 0, salvage: 0, size: 's', ground: true, noHit: true, structure: true,
        update(e, w, dt) {
            moveGround(e, w, dt);
            if (e.data.done) return;
            const p = w.player;
            const dx = p.x - e.x, dy = p.y - e.y;
            const near = p.alive && dx * dx + dy * dy < 50 * 50;
            e.data.near = near;
            if (near) e.data.prog = Math.min(1, (e.data.prog || 0) + dt / 1.2);
            else e.data.prog = Math.max(0, (e.data.prog || 0) - dt * 0.25);
            if (e.data.prog >= 1) {
                e.data.done = true;
                w.rescue(e);
            }
        },
    },
};

export const ENEMY_KINDS = Object.keys(ENEMIES);
