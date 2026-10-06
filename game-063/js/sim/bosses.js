// Boss holes. The cup is under the Bogey Seal until the boss is beaten — with the golf ball.
// Each boss is a set of functions over a plain state object (w.s.boss) so the world clones cheaply:
//   init(w, def) → state          cols(w) → collider objects (made once per World)
//   update(w, dt)  moves parts and refreshes colliders from state + time
//   hit(w, part, dmg) → true if it counted     act(w) → seconds the turn action takes
//   target(w) → {x,y,z} the best thing to aim at (bots, auto-aim)
// Damage per hit: 1, +1 PERFECT, +ball bonus, ×2 Fireball.

import { sphereC, capsuleC, boxC } from './course.js';
import { SURF } from './realms.js';

const TAU = Math.PI * 2;
const gy = (w, x, z) => w.course.heightAt(x, z);

function hurtable(b, key = 'hurtT') { return (b[key] ?? 0) <= 0; }

// Push the resting ball away from (x, z) — a kick, a stomp, a blast.
function shove(w, fromX, fromZ, speed, up, tag) {
    const B = w.s.ball;
    let dx = B.x - fromX, dz = B.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    w.kickBall(dx * speed, up, dz * speed, tag);
}

// ================================================================== Grubbins the Gopher King
const gopher = {
    name: 'Grubbins the Gopher King',
    init(w, def) {
        const hills = [];
        const n = def.n ?? 6, R = def.r ?? 8.5;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + 0.3;
            const x = def.x + Math.sin(a) * R, z = def.z + Math.cos(a) * R;
            hills.push({ x, z, y: gy(w, def.x + Math.sin(a) * R, def.z + Math.cos(a) * R) });
        }
        return { kind: 'gopher', hp: def.hp ?? 4, max: def.hp ?? 4, hills, at: 1, up: 1, hurtT: 0, downT: 0, popT: 0 };
    },
    cols(w) { return [sphereC(0, 0, 0, 1.15, 0.5, 'boss', { part: 'body' })]; },
    update(w, dt) {
        const b = w.s.boss, C = w.bossCols[0];
        b.hurtT -= dt; b.popT += dt;
        if (b.downT > 0) { b.downT -= dt; if (b.downT <= 0) b.up = 0; }
        const h = b.hills[b.at];
        const rise = b.up ? Math.min(1, b.popT * 3) : 0;
        C.x = C.bx = h.x; C.z = C.bz = h.z;
        C.y = C.by = h.y + 1.0 * rise - 0.2 + Math.sin(w.s.time * 3) * 0.1 * rise;
        C.off = !b.up || b.hp <= 0;
    },
    hit(w, part, dmg) {
        const b = w.s.boss;
        if (!hurtable(b) || !b.up) return false;
        b.hp = Math.max(0, b.hp - dmg); b.hurtT = 1.2; b.downT = 0.8;
        return true;
    },
    act(w) {
        const b = w.s.boss;
        if (b.hp <= 0) return 0;
        let n = b.at;
        while (n === b.at) n = w.rngInt(b.hills.length);
        b.at = n; b.up = 1; b.popT = 0; b.downT = 0;
        const h = b.hills[n];
        const B = w.s.ball;
        w.emit('bossAct', { action: 'burrow', x: h.x, z: h.z });
        if (Math.hypot(B.x - h.x, B.z - h.z) < 4.2) { shove(w, h.x, h.z, 9, 5, 'kick'); return 1.0; }
        return 1.4;
    },
    target(w) { const b = w.s.boss, h = b.hills[b.at]; return { x: h.x, y: h.y + 1, z: h.z }; },
};

// ================================================================== Duneborn the sandworm
const SEGS = 7;
const worm = {
    name: 'Duneborn',
    init(w, def) { return { kind: 'worm', hp: def.hp ?? 4, max: def.hp ?? 4, cx: def.x, cz: def.z, R: def.r ?? 11, ang: 0, dir: 1, speed: 0.9, hurtT: 0 }; },
    cols(w) {
        const out = [sphereC(0, 0, 0, 1.6, 0.5, 'boss', { part: 'head' })];
        for (let i = 0; i < SEGS; i++) out.push(sphereC(0, 0, 0, 0.95 - i * 0.05, 0.9, 'bossBody', { part: 'body' }));
        return out;
    },
    pose(w, b, k, t) {
        const a = b.ang - b.dir * k * 0.2;
        const x = b.cx + Math.sin(a) * b.R, z = b.cz + Math.cos(a) * b.R;
        const wave = Math.sin(t * 1.25 - k * 0.55);
        const y = gy(w, x, z) + (k === 0 ? 1.0 + wave * 0.45 : 0.4 + wave * 1.0);
        return { x, y, z, a };
    },
    update(w, dt) {
        const b = w.s.boss, t = w.s.time;
        b.hurtT -= dt;
        // it only slithers on its own turn, so every shot aims at a still target
        if (b.hp > 0 && w.s.phase === 'act') b.ang += b.dir * b.speed * dt;
        for (let k = 0; k <= SEGS; k++) {
            const C = w.bossCols[k];
            const p = worm.pose(w, b, k, t);
            const g = gy(w, p.x, p.z);
            const mv = w.s.phase === 'act' ? b.dir * b.speed * b.R : 0;
            C.vx = Math.cos(p.a) * mv; C.vz = -Math.sin(p.a) * mv;
            C.x = C.bx = p.x; C.y = C.by = p.y; C.z = C.bz = p.z;
            C.off = b.hp <= 0 || p.y < g - 0.2;
        }
    },
    hit(w, part, dmg) {
        const b = w.s.boss;
        if (part !== 'head' || !hurtable(b)) return false;
        b.hp = Math.max(0, b.hp - dmg); b.hurtT = 1.0;
        
        return true;
    },
    act(w) {
        const b = w.s.boss;
        if (b.hp <= 0) return 0;
        if (w.rngNext() < 0.5) b.dir *= -1;
        b.speed = 0.6 + w.rngNext() * 0.7;
        w.emit('bossAct', { action: 'coil' });
        return 1.5;
    },
    target(w) { const C = w.bossCols[0]; return { x: C.x, y: C.y, z: C.z }; },
};

// ================================================================== Big Frosty the yeti
const yeti = {
    name: 'Big Frosty',
    init(w, def) {
        return { kind: 'yeti', hp: def.hp ?? 4, max: def.hp ?? 4, x: def.x, z: def.z, walls: def.walls.map(() => 2), wallDefs: def.walls, hurtT: 0, throwT: 0 };
    },
    cols(w) {
        const b = w.s.boss;
        const out = [sphereC(b.x, gy(w, b.x, b.z) + 1.9, b.z, 1.75, 0.5, 'boss', { part: 'body' })];
        b.wallDefs.forEach(([x1, z1, x2, z2], i) => {
            const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1);
            const y = Math.min(gy(w, x1, z1), gy(w, x2, z2));
            out.push(boxC(mx, y + 1.3, mz, 0.6, 1.7, len / 2, Math.atan2(x2 - x1, z2 - z1), 0.45, 'boss', { part: 'wall' + i, wall: i }));
        });
        return out;
    },
    update(w, dt) {
        const b = w.s.boss;
        b.hurtT -= dt; b.throwT -= dt;
        w.bossCols[0].off = b.hp <= 0;
        for (let i = 0; i < b.walls.length; i++) w.bossCols[i + 1].off = b.walls[i] <= 0;
    },
    hit(w, part, dmg) {
        const b = w.s.boss;
        if (part.startsWith('wall')) {
            const i = +part.slice(4);
            if (b.walls[i] <= 0) return false;
            b.walls[i] = w.s.fx.fire ? 0 : b.walls[i] - 1;
            w.emit('wallHit', { i, hp: b.walls[i] });
            return 'wall';
        }
        if (!hurtable(b)) return false;
        b.hp = Math.max(0, b.hp - dmg); b.hurtT = 1.2;
        return true;
    },
    act(w) {
        const b = w.s.boss;
        if (b.hp <= 0) return 0;
        const broken = b.walls.map((h, i) => (h <= 0 ? i : -1)).filter((i) => i >= 0);
        const B = w.s.ball;
        if (broken.length && w.rngNext() < 0.4) {
            const i = broken[w.rngInt(broken.length)];
            b.walls[i] = 1;
            w.emit('bossAct', { action: 'rebuild', i });
            return 1.4;
        }
        if (Math.hypot(B.x - b.x, B.z - b.z) < 60 && w.s.ball.surf !== SURF.green) {
            w.addPatch(B.x, B.z, 2.6, SURF.snow, 'snowdrift');
            b.throwT = 1.2;
            w.emit('bossAct', { action: 'snowball', x: B.x, z: B.z });
            return 1.6;
        }
        w.emit('bossAct', { action: 'roar' });
        return 1.0;
    },
    target(w) {
        const b = w.s.boss;
        return { x: b.x, y: gy(w, b.x, b.z) + 1.9, z: b.z };
    },
};

// ================================================================== Double Bogey, the two-headed magma ogre
const ogre = {
    name: 'Double Bogey',
    init(w, def) { return { kind: 'ogre', x: def.x, z: def.z, heads: [def.hp ?? 2, def.hp ?? 2], max: (def.hp ?? 2) * 2, hp: (def.hp ?? 2) * 2, hurt: [0, 0], stompT: 0 }; },
    cols(w) {
        const b = w.s.boss;
        const g = gy(w, b.x, b.z);
        return [
            sphereC(0, 0, 0, 1.5, 0.5, 'boss', { part: 'head0' }),
            sphereC(0, 0, 0, 1.5, 0.5, 'boss', { part: 'head1' }),
            capsuleC(b.x, g - 0.5, b.z, b.x, g + 4.6, b.z, 2.0, 0.6, 'bossBody', { part: 'body' }),
        ];
    },
    headPos(w, b, i, t) {
        const g = gy(w, b.x, b.z);
        const s = i ? 1 : -1;
        return { x: b.x + s * 1.9 + Math.sin(t * 1.1 + i * 2) * 0.35, y: g + 5.0 + Math.sin(t * 1.7 + i) * 0.3, z: b.z - 0.6 + Math.cos(t * 0.9 + i) * 0.3 };
    },
    update(w, dt) {
        const b = w.s.boss, t = w.s.time;
        b.stompT -= dt;
        for (let i = 0; i < 2; i++) {
            b.hurt[i] -= dt;
            const p = ogre.headPos(w, b, i, t);
            const C = w.bossCols[i];
            C.x = C.bx = p.x; C.y = C.by = p.y; C.z = C.bz = p.z;
            C.off = b.heads[i] <= 0;
        }
        w.bossCols[2].off = b.hp <= 0;
    },
    hit(w, part, dmg) {
        const b = w.s.boss;
        const i = part === 'head1' ? 1 : 0;
        if (b.heads[i] <= 0 || b.hurt[i] > 0) return false;
        const d = Math.min(b.heads[i], dmg);
        b.heads[i] -= d; b.hp -= d; b.hurt[i] = 1.0;
        return true;
    },
    act(w) {
        const b = w.s.boss;
        if (b.hp <= 0) return 0;
        const B = w.s.ball;
        b.stompT = 1.0;
        w.emit('bossAct', { action: 'stomp', x: b.x, z: b.z });
        if (Math.hypot(B.x - b.x, B.z - b.z) < 16) { shove(w, b.x, b.z, 6, 3.5, 'stomp'); return 1.0; }
        return 1.3;
    },
    target(w) {
        const b = w.s.boss;
        const i = b.heads[0] > 0 ? 0 : 1;
        return ogre.headPos(w, b, i, w.s.time);
    },
};

// ================================================================== Lord Bogey → Triple Bogey
const bogey = {
    name: 'Lord Bogey',
    init(w, def) {
        return {
            kind: 'bogey', phase: 1, hp: def.hp ?? 3, max: def.hp ?? 3, points: def.points, at: 0, hurtT: 0, tpT: 0,
            dragon: def.dragon, heads: [2, 2, 2], hurt: [0, 0, 0], breathT: 0, transformT: 0,
        };
    },
    cols(w) {
        const out = [sphereC(0, 0, 0, 1.6, 0.5, 'boss', { part: 'lord' })];
        for (let i = 0; i < 3; i++) out.push(sphereC(0, 0, 0, 0.55, 1.1, 'shield', { part: 'shield' }));
        for (let i = 0; i < 3; i++) out.push(sphereC(0, 0, 0, 1.25, 0.5, 'boss', { part: 'head' + i }));
        const [dx, dz] = w.s.boss.dragon;
        const g = gy(w, dx, dz);
        out.push(capsuleC(dx - 2, g + 1.8, dz, dx + 2, g + 1.8, dz, 2.6, 0.6, 'bossBody', { part: 'dragon' }));
        return out;
    },
    lordPos(w, b, t) {
        const p = b.points[b.at];
        return { x: p[0] + Math.sin(t * 0.8) * 0.5, y: gy(w, p[0], p[1]) + 1.9 + Math.sin(t * 1.6) * 0.25, z: p[1] + Math.cos(t * 0.7) * 0.5 };
    },
    headPos(w, b, i, t) {
        const [dx, dz] = b.dragon;
        const g = gy(w, dx, dz);
        const off = (i - 1) * 3.4;
        return { x: dx + off + Math.sin(t * 1.2 + i * 2.1) * 0.6, y: g + 6.4 + (i === 1 ? 0.9 : 0) + Math.sin(t * 1.5 + i) * 0.45, z: dz - 1.2 + Math.cos(t * 1.0 + i) * 0.4 };
    },
    update(w, dt) {
        const b = w.s.boss, t = w.s.time, C = w.bossCols;
        b.hurtT -= dt; b.breathT -= dt;
        if (b.transformT > 0) b.transformT -= dt;
        const lp = bogey.lordPos(w, b, t);
        C[0].x = C[0].bx = lp.x; C[0].y = C[0].by = lp.y; C[0].z = C[0].bz = lp.z;
        C[0].off = b.phase !== 1;
        for (let i = 0; i < 3; i++) {
            const a = t * 0.7 + i * Math.PI;
            const S = C[1 + i];
            S.x = S.bx = lp.x + Math.sin(a) * 2.6; S.y = S.by = lp.y + Math.sin(a * 2) * 0.3; S.z = S.bz = lp.z + Math.cos(a) * 2.6;
            S.vx = Math.cos(a) * 0.9 * 2.6; S.vz = -Math.sin(a) * 0.9 * 2.6;
            S.off = b.phase !== 1 || i === 2;   // two shields; the third slot stays empty
        }
        for (let i = 0; i < 3; i++) {
            b.hurt[i] -= dt;
            const p = bogey.headPos(w, b, i, t);
            const H = C[4 + i];
            H.x = H.bx = p.x; H.y = H.by = p.y; H.z = H.bz = p.z;
            H.off = b.phase !== 2 || b.heads[i] <= 0 || b.transformT > 0;
        }
        C[7].off = b.phase !== 2 || b.transformT > 0 || b.heads.every((h) => h <= 0);
    },
    hit(w, part, dmg) {
        const b = w.s.boss;
        if (part === 'lord') {
            if (b.phase !== 1 || !hurtable(b)) return false;
            b.hp = Math.max(0, b.hp - dmg); b.hurtT = 1.0;
            if (b.hp <= 0) {
                b.phase = 2; b.transformT = 3.5;
                b.hp = 6; b.max = 6;
                w.emit('bossPhase', { phase: 2 });
                return 'phase';
            }
            return true;
        }
        const i = +part.slice(4);
        if (b.phase !== 2 || b.heads[i] <= 0 || b.hurt[i] > 0) return false;
        const d = Math.min(b.heads[i], dmg);
        b.heads[i] -= d; b.hp -= d; b.hurt[i] = 1.0;
        return true;
    },
    act(w) {
        const b = w.s.boss;
        if (b.phase === 1) {
            let n = b.at;
            while (n === b.at) n = w.rngInt(b.points.length);
            b.at = n;
            w.emit('bossAct', { action: 'teleport' });
            return 1.2;
        }
        if (b.hp <= 0) return 0;
        const B = w.s.ball;
        const [dx, dz] = b.dragon;
        b.breathT = 1.4;
        let dur = 1.2;
        if (b.heads[2] > 0) {
            const a = w.rngNext() * TAU, sp = 2 + w.rngNext() * 4;
            w.setWind(a, sp);
            w.emit('bossAct', { action: 'storm', head: 2 });
        }
        if (b.heads[1] > 0 && B.surf !== SURF.green) {
            w.addPatch(B.x, B.z, 2.4, SURF.snow, 'frost');
            w.emit('bossAct', { action: 'frost', head: 1, x: B.x, z: B.z });
            dur = 1.6;
        }
        if (b.heads[0] > 0 && Math.hypot(B.x - dx, B.z - dz) < 22) {
            w.emit('bossAct', { action: 'fire', head: 0 });
            shove(w, dx, dz, 9, 4, 'blast');
            return 1.0;
        }
        return dur;
    },
    target(w) {
        const b = w.s.boss;
        if (b.phase === 1) return bogey.lordPos(w, b, w.s.time);
        const i = b.heads.findIndex((h) => h > 0);
        return bogey.headPos(w, b, Math.max(0, i), w.s.time);
    },
};

export const BOSSES = { gopher, worm, yeti, ogre, bogey };
