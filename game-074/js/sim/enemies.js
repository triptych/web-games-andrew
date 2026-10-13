// The damned: every regular enemy kind, as plain data + a step function.
// Enemies live in screen space (x 0–32). Kinds marked `ground` are pinned to
// a world x and ride the scroll, re-reading the terrain height every step.
//
// An enemy may carry `parts` (worm vertebrae, tentacle joints, hand bones):
// extra hit circles with their own hp. `rect` is an axis-aligned hazard box
// (geysers, crushers) that hurts on contact and may block shots.
//
// Nothing here imports world.js: enemies call back through the world object
// (w.fire, w.spawn, w.laser, w.fx …), so there's no import cycle.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Catmull-Rom through screen points pts over `dur` seconds; returns false when done. */
function followPts(e, pts, dur) {
    const u = clamp(e.t / dur, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(u));
    const f = u - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    const nx = cr(p0[0], p1[0], p2[0], p3[0]), ny = cr(p0[1], p1[1], p2[1], p3[1]);
    e.vx = (nx - e.x) / Math.max(1e-4, e.dt);
    e.vy = (ny - e.y) / Math.max(1e-4, e.dt);
    e.x = nx; e.y = ny;
    return e.t < dur;
}

/** Ground placement: y on the floor or the ceiling at the enemy's world x. */
function pin(e, w, off = 0.45) {
    e.x = e.wx - w.scroll;
    const t = w.terrain.at(e.wx);
    e.y = e.side === 'ceil' ? t.ceil - off : t.floor + off;
}

function aimedShot(e, w, type, speed, gap) {
    e.fireT -= e.dt * w.D.rate;
    if (e.fireT <= 0 && e.x > 3 && e.x < 31.5) {
        e.fireT += gap;
        w.fire(e.x, e.y, w.aim(e.x, e.y), speed, type);
        return true;
    }
    return false;
}

export const KINDS = {
    // ------------------------------------------------------------ imps: the swarm
    imp: {
        hp: 2, r: 0.6, score: 100,
        init(e, w) {
            const o = e.o;
            e.x = o.x ?? 33.5; e.y = e.y0 = o.y ?? 9;
            e.speed = o.speed ?? 6.5;
            e.shootAt = w.rng.chance(o.shoot ?? 0.2) ? w.rng.range(0.7, 2.0) : -1;
            if (o.path === 'pts') { e.x = o.pts[0][0]; e.y = o.pts[0][1]; }
            if (o.path === 'loop') e.loopX = o.loopX ?? 17;
        },
        step(e, w, dt) {
            const o = e.o;
            switch (o.path) {
                case 'straight': e.vx = -e.speed; e.vy = 0; e.x += e.vx * dt; break;
                case 'dive': {
                    e.vx = -e.speed * (e.t < 0.7 ? 1 : 1.35);
                    if (e.t > 0.5 && e.t < 1.8) e.vy += clamp(w.player.y - e.y, -1, 1) * 22 * dt;
                    e.vy *= 1 - 1.5 * dt;
                    e.x += e.vx * dt; e.y += e.vy * dt;
                    break;
                }
                case 'loop': {
                    // Gradius loop-the-loop: approach, one full circle, leave
                    const R = o.loopR ?? 3.2;
                    if (!e.st) {
                        e.x -= e.speed * dt;
                        if (e.x <= e.loopX) { e.st = 1; e.dir = o.loopDir ?? (e.y0 > 9 ? -1 : 1); e.cx = e.x; e.cy = e.y + e.dir * R; e.th = 0; }
                    } else if (e.st === 1) {
                        const dir = e.dir;
                        e.th += (e.speed / R) * dt;
                        e.x = e.cx - R * Math.sin(e.th);
                        e.y = e.cy - dir * R * Math.cos(e.th);
                        if (e.th >= TAU) { e.st = 2; e.x = e.cx; e.y = e.cy - dir * R; }
                    } else e.x -= e.speed * 1.2 * dt;
                    break;
                }
                case 'pts': if (!followPts(e, o.pts, o.dur ?? 4)) e.gone = true; break;
                case 'back': // from behind the player, flying right
                    e.x += e.speed * dt; e.y = e.y0 + (o.amp ?? 1.5) * Math.sin((o.freq ?? 2) * e.t + (o.phase ?? 0));
                    break;
                default: { // sine
                    e.x -= e.speed * dt;
                    e.y = e.y0 + (o.amp ?? 2.2) * Math.sin((o.freq ?? 2.4) * e.t + (o.phase ?? 0));
                }
            }
            if (e.shootAt > 0 && e.t >= e.shootAt) {
                e.shootAt = -1;
                if (e.x > 5 && e.x < 31) w.fire(e.x, e.y, w.aim(e.x, e.y), 7, 'orb');
            }
        },
    },

    // ------------------------------------------------------------ cinder flies: streams
    fly: {
        hp: 1, r: 0.4, score: 50,
        init(e) {
            const o = e.o;
            e.x = o.x ?? 33.5; e.y = e.y0 = o.y ?? 9; e.speed = o.speed ?? 9;
            if (o.home) { e.vx = o.vx ?? -6; e.vy = o.vy ?? 0; }
        },
        step(e, w, dt) {
            const o = e.o;
            if (o.home) {
                if (e.t < 1.6) {
                    const a = Math.atan2(w.player.y - e.y, w.player.x - e.x);
                    e.vx += Math.cos(a) * 14 * dt; e.vy += Math.sin(a) * 14 * dt;
                    const s = Math.hypot(e.vx, e.vy), m = o.speed ?? 7;
                    if (s > m) { e.vx *= m / s; e.vy *= m / s; }
                }
                e.x += e.vx * dt; e.y += e.vy * dt;
                if (e.t > 6) e.gone = true;
            } else {
                e.x -= e.speed * dt;
                e.y = e.y0 + (o.amp ?? 1.6) * Math.sin((o.freq ?? 4) * e.t + (o.phase ?? 0));
            }
        },
    },

    // ------------------------------------------------------------ burning skulls
    skull: {
        hp: 7, r: 0.8, score: 300,
        init(e) { e.x = e.o.x ?? 33.5; e.y = e.y0 = e.o.y ?? 9; e.stopX = e.o.stopX ?? 24; e.fireT = 0.6; e.volleys = e.o.shots ?? 3; },
        step(e, w, dt) {
            if (!e.st) {
                e.x += (e.stopX - e.x) * Math.min(1, 2.2 * dt) - 1.2 * dt;
                if (e.x - e.stopX < 0.3) e.st = 1;
            } else if (e.st === 1) {
                e.y = e.y0 + Math.sin(e.t * 1.7) * 0.6;
                e.fireT -= dt * w.D.rate;
                if (e.fireT <= 0) {
                    e.fireT = 1.5;
                    w.fan(e.x, e.y, w.aim(e.x, e.y), 3, 0.5, 7, 'orb');
                    if (--e.volleys <= 0) { e.st = 2; e.lt = 0; }
                }
            } else {
                e.vx = -7; e.vy = e.y0 > 9 ? 2 : -2;
                e.x += e.vx * dt; e.y += e.vy * dt;
            }
        },
    },

    // ------------------------------------------------------------ watchers: big eyes
    eye: {
        hp: 46, r: 1.15, score: 2000, big: true, shards: 4,
        init(e) { e.x = e.o.x ?? 34; e.y = e.y0 = e.o.y ?? 9; e.stopX = e.o.stopX ?? 24; e.fireT = 1.2; e.n = 0; },
        step(e, w, dt) {
            if (e.t < 14) e.x += (e.stopX - e.x) * Math.min(1, 0.9 * dt);
            else e.x -= 3 * dt;
            e.y = e.y0 + Math.sin(e.t * 0.9) * 1.2;
            e.look = w.aim(e.x, e.y);
            e.fireT -= dt * w.D.rate;
            if (e.fireT <= 0 && e.x < 31) {
                e.n++;
                if (e.n % 2) { e.fireT = 1.3; w.ring(e.x, e.y, 14, 4.6, 'orb', (e.n % 4) * 0.11); }
                else { e.fireT = 1.1; w.fan(e.x, e.y, e.look, 3, 0.3, 6.2, 'big'); }
            }
        },
    },

    // ------------------------------------------------------------ turrets on the rock
    turret: {
        hp: 8, r: 0.75, score: 400, ground: true,
        init(e, w) { e.side = e.o.side ?? 'floor'; e.wx = w.scroll + (e.o.x ?? 34); e.fireT = e.o.delay ?? 0.8; e.burst = 0; pin(e, w); },
        step(e, w, dt) {
            pin(e, w);
            e.look = w.aim(e.x, e.y);
            e.fireT -= dt * w.D.rate;
            if (e.fireT <= 0 && e.x > 2 && e.x < 31) {
                if (e.burst <= 0) e.burst = e.o.burst ?? 1;
                w.fire(e.x, e.y, e.look, e.o.speed ?? 7, 'orb');
                e.burst--;
                e.fireT = e.burst > 0 ? 0.14 : (e.o.rate ?? 1.9);
            }
        },
    },

    // ------------------------------------------------------------ hellhounds: floor runners
    hound: {
        hp: 6, r: 0.75, score: 400, ground: true,
        init(e, w) { e.side = 'floor'; e.wx = w.scroll + (e.o.x ?? 34); e.h = 0; e.vh = 0; e.cool = 0.6; pin(e, w, 0.55); },
        step(e, w, dt) {
            e.wx -= (e.o.run ?? 3.2) * dt;
            e.cool -= dt;
            if (e.h <= 0 && e.cool <= 0 && Math.abs(e.x - w.player.x) < 7 && e.x > w.player.x - 1) {
                e.vh = e.o.jump ?? 10; e.cool = 1.6;
            }
            if (e.h > 0 || e.vh > 0) {
                e.vh -= 24 * dt; e.h += e.vh * dt;
                if (e.h <= 0) { e.h = 0; e.vh = 0; if (e.x > 3) w.fan(e.x, e.y + 0.3, Math.PI / 2 + 0.5, 3, 0.7, 6, 'fire'); }
            }
            pin(e, w, 0.55);
            e.y += e.h;
        },
    },

    // ------------------------------------------------------------ bone worms
    worm: {
        hp: 14, r: 0.75, score: 800, shards: 2,
        init(e, w) {
            const o = e.o;
            e.side = o.side ?? 'floor';
            e.x = o.x ?? 30;
            const t = w.terrain.at(w.scroll + e.x);
            e.y = e.side === 'ceil' ? Math.min(19.5, t.ceil + 1.5) : Math.max(-1.5, t.floor - 1.5);
            e.dir = e.side === 'ceil' ? -1 : 1;
            e.hist = [];
            const n = o.len ?? 8;
            e.parts = [];
            for (let i = 0; i < n; i++) e.parts.push({ x: e.x, y: e.y, r: 0.45, hp: 3, alive: true, score: 100 });
            e.ang = Math.PI / 2 * e.dir;
        },
        step(e, w, dt) {
            const o = e.o;
            if (e.t < 0.7) {
                e.vx = -w.speed; e.vy = 7 * e.dir;
                e.ang = Math.atan2(e.vy, e.vx);
            } else {
                // a serpentine that heads left, leaning toward the player's height
                const target = Math.atan2(clamp(w.player.y - e.y, -6, 6), -7);
                let d = target - e.ang;
                while (d > Math.PI) d -= TAU;
                while (d < -Math.PI) d += TAU;
                e.ang += (clamp(d, -1, 1) * 2.0 + Math.sin(e.t * (o.freq ?? 3.2)) * 2.2) * dt;
                const sp = o.speed ?? 5.4;
                e.vx = Math.cos(e.ang) * sp; e.vy = Math.sin(e.ang) * sp;
            }
            e.x += e.vx * dt; e.y += e.vy * dt;
            e.hist.push(e.x, e.y);
            if (e.hist.length > 1200) e.hist.splice(0, e.hist.length - 1200);
            const gap = 20; // samples per segment (~0.17 s)
            for (let i = 0; i < e.parts.length; i++) {
                const k = e.hist.length - 2 - (i + 1) * gap * 2;
                const p = e.parts[i];
                if (k >= 0) { p.x = e.hist[k]; p.y = e.hist[k + 1]; }
            }
            if (e.t > 11) e.gone = true;
            e.fireT = (e.fireT ?? 1.4) - dt * w.D.rate;
            if (e.fireT <= 0 && e.x < 30 && e.x > 4) { e.fireT = 2.2; w.fan(e.x, e.y, w.aim(e.x, e.y), 3, 0.35, 6.5, 'needle'); }
        },
    },

    // ------------------------------------------------------------ wraiths: come from behind
    wraith: {
        hp: 5, r: 0.7, score: 350,
        init(e) { e.x = -1.5; e.y = e.y0 = e.o.y ?? 9; e.vx = e.o.speed ?? 7; e.fireT = 1.2; },
        step(e, w, dt) {
            e.vx = Math.max(1.2, e.vx - 2.2 * dt);
            e.x += e.vx * dt;
            e.y += (w.player.y - e.y) * 0.4 * dt + Math.sin(e.t * 2) * 1.2 * dt;
            e.phase = 0.5 + 0.5 * Math.sin(e.t * 2.6);
            e.ghost = e.phase < 0.3;          // shots pass through while it's faded
            aimedShot(e, w, 'soul', 3.6, 2.2);
            if (e.t > 9) { e.vy = 5; e.y += e.vy * dt; }
            if (e.t > 13) e.gone = true;
        },
    },

    // ------------------------------------------------------------ reliquary bearers (power-up carriers)
    carrier: {
        hp: 10, r: 0.95, score: 500,
        init(e) { e.x = e.o.x ?? 33.5; e.y = e.y0 = e.o.y ?? 9; e.item = e.o.item ?? 'red'; },
        step(e, w, dt) {
            e.x -= (e.o.speed ?? 3) * dt;
            e.y = e.y0 + Math.sin(e.t * 1.8) * 0.7;
        },
    },

    // ------------------------------------------------------------ mines: burst when broken
    mine: {
        hp: 4, r: 0.6, score: 150,
        init(e, w) {
            const o = e.o;
            e.x = o.x ?? 33.5; e.y = e.y0 = o.y ?? 9;
            if (o.hang) { e.ground = true; e.side = 'ceil'; e.wx = w.scroll + e.x; e.len = o.len ?? 5; }
        },
        step(e, w, dt) {
            const o = e.o;
            if (o.hang) {
                const top = w.terrain.at(e.wx).ceil;
                const sw = Math.sin(e.t * 1.6 + e.wx) * 0.5;
                e.anchorX = e.wx - w.scroll; e.anchorY = Math.min(top, 19);
                e.x = e.anchorX + Math.sin(sw) * e.len;
                e.y = e.anchorY - Math.cos(sw) * e.len;
            } else {
                e.x -= (o.speed ?? 2.6) * dt;
                e.y = e.y0 + Math.sin(e.t * 1.3 + e.x) * (o.amp ?? 0.8);
            }
        },
        death(e, w) { if (e.x < 33) w.ring(e.x, e.y, 8, 5, 'orb', 0.2); },
    },

    // ------------------------------------------------------------ bulls: warned charges
    bull: {
        hp: 26, r: 1.0, score: 1200, big: true, shards: 3,
        init(e, w) {
            e.from = e.o.from ?? 'right';
            e.x = e.from === 'left' ? -2.5 : 34.5;
            e.y = e.o.y ?? clamp(w.player.y, 2, 16);
            e.warn = 1.1;
            w.fx('warn', { x: e.from === 'left' ? 0.8 : 31.2, y: e.y });
        },
        step(e, w, dt) {
            if (e.t < e.warn) { e.y += (clamp(w.player.y, 1.5, 16.5) - e.y) * (e.o.track ? 1.5 : 0) * dt; return; }
            const dir = e.from === 'left' ? 1 : -1;
            e.vx = dir * Math.min(16, (e.t - e.warn) * 30);
            e.x += e.vx * dt;
        },
    },

    // ------------------------------------------------------------ lancers: telegraphed beams
    lancer: {
        hp: 10, r: 0.8, score: 600,
        init(e) { e.x = e.o.x ?? 33.5; e.y = e.y0 = e.o.y ?? 9; e.stopX = e.o.stopX ?? 27; e.cycle = 0; e.fireT = 0.5; },
        step(e, w, dt) {
            if (e.cycle < (e.o.shots ?? 2)) {
                e.x += (e.stopX - e.x) * Math.min(1, 2 * dt);
                e.fireT -= dt * w.D.rate;
                if (e.fireT <= 0 && e.x < 31) {
                    e.fireT = 3.4; e.cycle++;
                    w.laser({ x: e.x - 0.6, y: e.y, a: Math.PI, len: 40, w: 0.32, warn: 0.95, dur: 1.0, owner: e });
                }
            } else if (e.fireT < 1.2) {
                e.x += 6 * dt;
            } else e.fireT -= dt;
            if (e.x > 35) e.gone = true;
        },
    },

    // ------------------------------------------------------------ brood pods: spawn flies
    pod: {
        hp: 14, r: 0.85, score: 600, ground: true,
        init(e, w) { e.side = e.o.side ?? 'floor'; e.wx = w.scroll + (e.o.x ?? 34); e.fireT = 1.0; pin(e, w, 0.6); },
        step(e, w, dt) {
            pin(e, w, 0.6);
            e.fireT -= dt * w.D.rate;
            if (e.fireT <= 0 && e.x > 4 && e.x < 31) {
                e.fireT = e.o.rate ?? 2.6;
                const up = e.side === 'ceil' ? -1 : 1;
                for (let i = 0; i < 2; i++) w.spawn('fly', { x: e.x, y: e.y + up * 0.6, home: true, vx: -3 + i * 2, vy: up * 5, speed: 6.5 });
                w.fx('pod', { x: e.x, y: e.y });
            }
        },
    },

    // ------------------------------------------------------------ soul lanterns
    lantern: {
        hp: 8, r: 0.7, score: 450,
        init(e) { e.x = e.o.x ?? 33.5; e.y = e.y0 = e.o.y ?? 9; e.fireT = 1.0; },
        step(e, w, dt) {
            e.x -= (e.o.speed ?? 2.2) * dt;
            e.y = e.y0 + Math.sin(e.t * 1.2) * 0.8;
            e.fireT -= dt * w.D.rate;
            if (e.fireT <= 0 && e.x < 31 && e.x > 5) {
                e.fireT = 3;
                w.fan(e.x, e.y, w.aim(e.x, e.y), 3, 0.9, 3.4, 'soul');
            }
        },
    },

    // ------------------------------------------------------------ ice crystals: shatter into shards
    crystal: {
        hp: 6, r: 0.75, score: 400,
        init(e) { e.x = e.o.x ?? 33.5; e.y = e.o.y ?? 9; e.vx = -(e.o.speed ?? 3.4); e.vy = 0; },
        step(e, w, dt) {
            e.vy += clamp(w.player.y - e.y, -1, 1) * 2.2 * dt;
            e.vy = clamp(e.vy, -2.2, 2.2);
            e.x += e.vx * dt; e.y += e.vy * dt;
            e.spin = e.t * 2.4;
        },
        death(e, w) { if (e.x < 33) w.ring(e.x, e.y, 6, 5.5, 'shard', e.t * 0.7); },
    },

    // ------------------------------------------------------------ tentacles from the walls
    tentacle: {
        hp: 12, r: 0.5, score: 700, ground: true,
        init(e, w) {
            e.side = e.o.side ?? 'floor';
            e.wx = w.scroll + (e.o.x ?? 34);
            e.fireT = 1.2;
            e.parts = [];
            for (let i = 0; i < 6; i++) e.parts.push({ x: 0, y: 0, r: 0.42 - i * 0.02, hp: Infinity, alive: true, armor: true });
            this.step(e, w, 0);
        },
        step(e, w, dt) {
            const t = w.terrain.at(e.wx);
            const bx = e.wx - w.scroll, by = e.side === 'ceil' ? t.ceil : t.floor;
            const up = e.side === 'ceil' ? -1 : 1;
            const n = e.parts.length, seg = (e.o.len ?? 5.5) / n;
            let x = bx, y = by, a = Math.PI / 2 * up;
            for (let i = 0; i < n; i++) {
                a += Math.sin(e.t * 1.7 + i * 0.6) * 0.16 + (i > 2 ? clamp((w.player.y - y) * up * 0.02, -0.08, 0.08) : 0);
                x += Math.cos(a) * seg; y += Math.sin(a) * seg;
                e.parts[n - 1 - i].x = x; e.parts[n - 1 - i].y = y;
            }
            e.x = x + Math.cos(a) * 0.3; e.y = y + Math.sin(a) * 0.3;
            e.baseX = bx; e.baseY = by;
            aimedShot(e, w, 'orb', 6.5, e.o.rate ?? 2.0);
        },
    },

    // ------------------------------------------------------------ gargoyles: stone until you pass
    gargoyle: {
        hp: 12, r: 0.9, score: 700,
        init(e, w) { e.side = e.o.side ?? 'floor'; e.wx = w.scroll + (e.o.x ?? 34); e.stone = true; e.ground = true; pin(e, w, 0.8); },
        step(e, w, dt) {
            if (e.stone) {
                pin(e, w, 0.8);
                if (e.x < (e.o.wake ?? 22)) { e.stone = false; e.ground = false; e.wt = 0; e.vx = -1; e.vy = e.side === 'ceil' ? -6 : 6; w.fx('wake', { x: e.x, y: e.y }); }
                return;
            }
            e.wt += dt;
            if (e.wt < 0.8) { e.vy *= 1 - 3 * dt; e.vx = -w.speed * 0.5; }
            else if (e.wt < 0.85) {
                w.fan(e.x, e.y, w.aim(e.x, e.y), 5, 0.9, 6.5, 'orb');
                const a = w.aim(e.x, e.y); e.vx = Math.cos(a) * 9; e.vy = Math.sin(a) * 9;
            }
            e.x += e.vx * dt; e.y += e.vy * dt;
        },
    },

    // ------------------------------------------------------------ fallen seraphlings
    seraphling: {
        hp: 9, r: 0.75, score: 600,
        init(e) { e.x = e.o.pts[0][0]; e.y = e.o.pts[0][1]; e.shots = [...(e.o.shots ?? [0.45])]; },
        step(e, w, dt) {
            const dur = e.o.dur ?? 4;
            if (!followPts(e, e.o.pts, dur)) e.gone = true;
            const f = e.t / dur;
            if (e.shots.length && f >= e.shots[0]) {
                e.shots.shift();
                if (e.x > 4 && e.x < 31) w.fan(e.x, e.y, w.aim(e.x, e.y), 5, 0.6, 7.5, 'needle');
            }
        },
    },

    // ------------------------------------------------------------ drowned hands
    hand: {
        hp: 7, r: 0.7, score: 350, ground: true,
        init(e, w) {
            e.side = 'floor';
            e.wx = w.scroll + (e.o.x ?? (w.player.x + (e.o.lead ?? 1.5)));
            e.ghost = true; e.noContact = true; e.rise = 0;
            e.parts = [{ x: 0, y: 0, r: 0.4, hp: Infinity, alive: true, armor: true }, { x: 0, y: 0, r: 0.38, hp: Infinity, alive: true, armor: true }];
            w.fx('ripple', { wx: e.wx });
            this.step(e, w, 0);
        },
        step(e, w, dt) {
            const tel = e.o.tel ?? 0.85;
            if (e.t < tel) e.rise = 0;
            else if (e.t < tel + 0.35) e.rise = (e.t - tel) / 0.35;
            else if (e.t < tel + 1.3) e.rise = 1;
            else if (e.t < tel + 1.8) e.rise = 1 - (e.t - tel - 1.3) / 0.5;
            else e.gone = true;
            e.ghost = e.rise < 0.3; e.noContact = e.rise < 0.3;
            const fl = w.terrain.at(e.wx).floor;
            e.x = e.wx - w.scroll;
            const top = fl - 1 + e.rise * (e.o.h ?? 4.6);
            e.y = top;
            e.parts[0].x = e.x + 0.05; e.parts[0].y = top - 1.0;
            e.parts[1].x = e.x + 0.1; e.parts[1].y = top - 2.0;
            for (const p of e.parts) p.alive = e.rise > 0.3;
        },
    },

    // ------------------------------------------------------------ spiked wheels
    wheel: {
        hp: 14, r: 0.8, score: 500, ground: true,
        init(e, w) { e.side = e.o.side ?? 'floor'; e.wx = w.scroll + (e.o.x ?? 34); e.fireT = 1.4; pin(e, w, 0.8); },
        step(e, w, dt) {
            e.wx -= (e.o.roll ?? 4) * dt;
            pin(e, w, 0.8);
            e.spin = (e.spin ?? 0) + dt * ((e.o.roll ?? 4) + w.speed) / 0.8;
            e.fireT -= dt * w.D.rate;
            if (e.fireT <= 0 && e.x < 31 && e.x > 3) {
                e.fireT = 2.4;
                const up = e.side === 'ceil' ? -1 : 1;
                for (const a of [0.35, 0.9, 1.6, 2.25, 2.8]) w.fire(e.x, e.y, up * a, 5.5, 'orb');
            }
        },
    },

    // ------------------------------------------------------------ lava geysers (hazard)
    geyser: {
        hp: Infinity, r: 0.5, score: 0, ground: true, hazard: true,
        init(e, w) {
            e.wx = e.o.wx ?? (w.scroll + (e.o.x ?? 20));
            e.ghost = true; e.noContact = true; e.side = 'floor';
            w.fx('geyserWarn', { wx: e.wx });
            this.step(e, w, 0);
        },
        step(e, w, dt) {
            const tel = e.o.tel ?? 1.0, dur = e.o.dur ?? 1.3;
            e.x = e.wx - w.scroll;
            const fl = Math.max(0.3, w.terrain.at(e.wx).floor);
            e.y = fl;
            e.h = e.o.h ?? 10;
            if (e.t < tel) { e.rect = null; e.act = 0; }
            else if (e.t < tel + dur) {
                const k = Math.min(1, (e.t - tel) / 0.18);
                e.act = k;
                e.rect = { x0: e.x - 0.55, x1: e.x + 0.55, y0: fl - 1, y1: fl + e.h * k };
                if (!e.blew) { e.blew = true; w.fx('geyser', { x: e.x, y: fl }); }
            } else e.gone = true;
        },
    },

    // ------------------------------------------------------------ foundry crushers (hazard)
    crusher: {
        hp: Infinity, r: 0.5, score: 0, ground: true, hazard: true, blocksShots: true,
        init(e, w) { e.wx = w.scroll + (e.o.x ?? 34); e.ghost = true; e.noContact = true; e.side = 'ceil'; e.ph = e.o.phase ?? 0; this.step(e, w, 0); },
        step(e, w, dt) {
            const t = w.terrain.at(e.wx);
            e.x = e.wx - w.scroll;
            const cyc = 3.0, k = ((e.t + e.ph) % cyc);
            const reach = t.ceil - t.floor - 0.05;
            let ext;
            if (k < 1.3) ext = 0.9;                                   // resting, up
            else if (k < 1.55) ext = 0.9 + (reach - 0.9) * ((k - 1.3) / 0.25) ** 2;   // slam
            else if (k < 2.1) ext = reach;                            // down
            else ext = reach - (reach - 0.9) * ((k - 2.1) / 0.9);     // rise
            if (k >= 1.55 && !e.hitFloor) { e.hitFloor = true; if (e.x > -2 && e.x < 34) w.fx('slam', { x: e.x, y: t.floor }); }
            if (k < 1.3) e.hitFloor = false;
            e.ext = ext;
            e.y = t.ceil - ext;
            e.rect = { x0: e.x - 1.0, x1: e.x + 1.0, y0: t.ceil - ext, y1: t.ceil + 1 };
        },
    },
};

export const KIND_NAMES = Object.keys(KINDS);
