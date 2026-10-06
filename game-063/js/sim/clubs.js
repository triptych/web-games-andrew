// Clubs, lies and the swing → launch velocity. The swing meter itself lives in the UI; the simulation
// only ever sees { club, power 0..1, acc -1..1 (0 = perfect line), perfect }.

import { SURF, SURF_PHYS } from './realms.js';
import { BALL_R } from './course.js';

export const CLUBS = {
    driver: { id: 'driver', name: 'Driver', speed: 84, loft: 14, check: 0.42, meter: 1.0, icon: 'D' },
    iron: { id: 'iron', name: 'Iron', speed: 52, loft: 25, check: 0.3, meter: 0.92, icon: 'I' },
    wedge: { id: 'wedge', name: 'Wedge', speed: 33.5, loft: 47, check: 0.16, meter: 0.85, icon: 'W' },
    putter: { id: 'putter', name: 'Putter', speed: 17, loft: 0, check: 1, meter: 0.7, icon: 'P' },
};
export const CLUB_ORDER = ['driver', 'iron', 'wedge', 'putter'];

export function lieMult(sid, club) {
    const p = SURF_PHYS[sid] || SURF_PHYS[0];
    let m = p.lie ?? 1;
    if (club === 'wedge' && (sid === SURF.sand || sid === SURF.dune || sid === SURF.snow)) m = Math.max(m, 0.86);
    if (club === 'putter' && sid !== SURF.green && sid !== SURF.tee) m = Math.min(1, m * 1.05);
    if (club === 'driver' && sid !== SURF.tee && sid !== SURF.fairway && sid !== SURF.green && sid !== SURF.ice && sid !== SURF.stone && sid !== SURF.cloud) m *= 0.8;
    return m;
}

// The launch velocity for a shot. d: derived stats (rpg.derive), fx: shot effects.
export function launch(club, power, acc, perfect, yaw, sid, d, fx) {
    const C = CLUBS[club];
    let speed = C.speed * Math.max(0.03, Math.min(1.05, power)) * d.powMult * lieMult(sid, club);
    if (perfect) speed *= 1.025;
    if (fx.rocket) speed *= 1.35;
    const curve = fx.ward ? 0 : acc * d.curveMult;
    const yawOff = club === 'putter' ? curve * 0.035 : curve * 0.05;
    const ya = yaw + yawOff;
    const loft = (C.loft * Math.PI) / 180;
    const ch = Math.cos(loft), sh = Math.sin(loft);
    return {
        vx: Math.sin(ya) * ch * speed, vy: sh * speed, vz: Math.cos(ya) * ch * speed,
        spin: club === 'putter' ? 0 : curve * (club === 'driver' ? 1.0 : club === 'iron' ? 0.8 : 0.5),
        check: C.check,
        speed,
    };
}

// Auto club: putter on the green; otherwise the shortest club whose full carry clears ~95% of the way.
export function autoClub(dist, sid, d) {
    if (sid === SURF.green) return dist > 32 ? 'wedge' : 'putter';
    const carry = (c) => fullCarry(c) * d.powMult * lieMult(sid, c);
    if (dist < 7) return 'putter';
    if (dist < carry('wedge') * 1.05) return 'wedge';
    if (dist < carry('iron') * 1.05 || sid === SURF.sand || sid === SURF.dune || sid === SURF.snow) return dist < carry('wedge') * 1.6 ? 'wedge' : 'iron';
    return sid === SURF.tee || sid === SURF.fairway ? 'driver' : 'iron';
}

const CARRY = {};
// Carry in still air on flat ground at full power, no stat bonus (memoised).
export function fullCarry(club) {
    if (CARRY[club] !== undefined) return CARRY[club];
    const C = CLUBS[club];
    if (club === 'putter') return (CARRY[club] = (C.speed * C.speed) / (2 * 0.4 * 18));
    const loft = (C.loft * Math.PI) / 180;
    let x = 0, y = 0, vx = Math.cos(loft) * C.speed, vy = Math.sin(loft) * C.speed;
    const dt = 1 / 240;
    for (let i = 0; i < 4000; i++) {
        const sp = Math.hypot(vx, vy);
        vx -= vx * 0.0016 * sp * dt; vy += (-18 - vy * 0.0016 * sp) * dt;
        x += vx * dt; y += vy * dt;
        if (y < 0 && vy < 0) break;
    }
    return (CARRY[club] = x);
}

// The preview: the flight at full power, no wind, perfect strike, until it meets the ground.
// Returns { pts: [[x,y,z]...], land: [x,y,z] | null, marks: [index at 25/50/75% power] }.
export function predictArc(course, from, club, yaw, d, fx, maxT = 7) {
    const sid = course.surfAt(from.x, from.z);
    const L = launch(club, 1, 0, false, yaw, sid, d, fx);
    const pts = [];
    let x = from.x, y = from.y, z = from.z, vx = L.vx, vy = L.vy, vz = L.vz;
    const dt = 1 / 120;
    const g = course.gravity;
    let land = null;
    if (club === 'putter') {
        // a putt: walk the roll along the ground with the green's friction (slope ignored)
        const sp0 = L.speed;
        const mu = 0.4 * 18;
        const dist = (sp0 * sp0) / (2 * mu);
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * dist;
            const px = from.x + Math.sin(yaw) * t, pz = from.z + Math.cos(yaw) * t;
            pts.push([px, course.heightAt(px, pz) + BALL_R, pz]);
        }
        land = pts[pts.length - 1];
        return { pts, land, putt: true };
    }
    for (let t = 0; t < maxT; t += dt) {
        const sp = Math.hypot(vx, vy, vz);
        vx -= vx * 0.0016 * sp * dt; vy += (-g - vy * 0.0016 * sp) * dt; vz -= vz * 0.0016 * sp * dt;
        x += vx * dt; y += vy * dt; z += vz * dt;
        if (((t / dt) | 0) % 3 === 0) pts.push([x, y, z]);
        const gh = course.heightAt(x, z);
        if (y - BALL_R < gh && vy < 0) { land = [x, gh + BALL_R, z]; pts.push(land); break; }
        if (y < -30) break;
    }
    return { pts, land };
}
