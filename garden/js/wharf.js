// The pirate wharf below the Delvers' Descent: a trail from the pavilion drops
// to a gothic gate, a ramp on pilings, then a wide deck with a ship's berth
// along its left side and a broad head at the seaward end. Gargoyles on the
// gate, spiked rails, skull bollards, a crane and cargo, and lamps that burn
// at night. (The ship that lies here is in ship.js; terrain.js laid it out.)

import * as THREE from 'three';
import { TAU, clamp, angleDiff } from './util.js';
import { samplePath, PAVILION_PLAZA } from './layout.js';
import { WHARF } from './terrain.js';
import { signMesh, signTexture } from './architecture.js';
import { S, V, Parts, shipMats } from './ship-kit.js';
import { gargoyle } from './ship-deck.js';

const RAIL_H = 1.05;

export function buildWharf(world) {
    const w = world.layout.wharf;
    const { dx, dz, ax, az, toW } = w;
    const yaw = Math.atan2(dx, dz);
    const Y = w.y, ramp = w.ramp, rampEnd = w.rampEnd, headStart = w.headStart, len = w.length;
    const deckY = (lz) => Math.max(Y, w.ay - lz * w.slope);
    const pitch = (lz) => (w.ay - lz * w.slope > Y ? Math.atan(w.slope) : 0);
    // the deck's edges across (lx): the head runs wide on the water side only, so the ship can back out past it
    const edges = (lz) => (lz > headStart ? [-WHARF.head, WHARF.half] : lz > rampEnd ? [-WHARF.half, WHARF.half] : [-2.4, 2.4]);
    const mats = shipMats(world);
    const P = new Parts();
    const base = new THREE.Matrix4().compose(V(ax, 0, az), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), V(1, 1, 1));
    // a part placed in wharf coordinates (lx across, y up, lz out to sea)
    const place = (lx, y, lz, ry = 0, rx = 0, rz = 0) => base.clone().multiply(new THREE.Matrix4().compose(V(lx, y, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(1, 1, 1)));
    const box = (key, a, b, c, lx, y, lz, ry, rx, rz) => P.add(key, new THREE.BoxGeometry(a, b, c), place(lx, y, lz, ry, rx, rz));
    const cyl = (key, rt, rb, h, lx, y, lz, seg = 8) => P.add(key, new THREE.CylinderGeometry(rt, rb, h, seg), place(lx, y, lz));
    const cone = (key, r, h, lx, y, lz, seg = 8) => P.add(key, new THREE.ConeGeometry(r, h, seg), place(lx, y, lz));
    const sph = (key, r, lx, y, lz) => P.add(key, new THREE.SphereGeometry(r, 10, 7), place(lx, y, lz));
    const local = (lx, y, lz) => V(lx, y, lz).applyMatrix4(base);
    const rod = (key, a, b, r, r1 = r) => P.rod(key, local(...a), local(...b), r, r1, 5);

    world.spans.push({ ax, az, bx: toW(0, rampEnd).x, bz: toW(0, rampEnd).z, half: 2.4, heightAt: (t) => deckY(t * rampEnd) });
    const p2 = toW(0, rampEnd), p3 = toW(0, headStart);
    world.spans.push({ ax: p2.x, az: p2.z, bx: p3.x, bz: p3.z, half: WHARF.half, heightAt: () => Y });
    const h0 = toW(-(WHARF.head - WHARF.half) / 2, headStart), h1 = toW(-(WHARF.head - WHARF.half) / 2, len);
    world.spans.push({ ax: h0.x, az: h0.z, bx: h1.x, bz: h1.z, half: (WHARF.head + WHARF.half) / 2, heightAt: () => Y });

    // ---- planking: boards across, heavy stringers beneath
    for (let d = 0.2; d < len; d += 0.36) {
        const [x0, x1] = edges(d);
        box(Math.floor(d / 0.36) % 7 === 3 ? 'hull' : 'plank', x1 - x0 + 0.2, 0.09, 0.32, (x0 + x1) / 2, deckY(d) - 0.045, d, 0, pitch(d));
    }
    for (let d = 0.5; d < len; d += 1) {
        const hs = d > headStart ? [WHARF.half - 0.2, 0.6, -2.0, -(WHARF.head - 0.2)] : d > rampEnd ? [WHARF.half - 0.2, 0, -(WHARF.half - 0.2)] : [2.2, -2.2];
        for (const x of hs) box('hull', 0.2, 0.3, 1.02, x, deckY(d) - 0.26, d, 0, pitch(d));
    }
    // gilt studs along the deck's edge
    for (let d = 1; d < len; d += 2) for (const x of edges(d)) cyl('trim', 0.05, 0.05, 0.03, x + (x < 0 ? 0.1 : -0.1), deckY(d) + 0.0, d, 6);

    // ---- pilings with iron bands, and crossed braces under the deck
    const piling = (lx, lz) => {
        const pt = toW(lx, lz);
        const top = deckY(lz) - 0.15, bottom = world.groundAt(pt.x, pt.z) - 0.6;
        if (top - bottom < 0.4) return;
        cyl('hull', 0.27, 0.32, top - bottom, lx, (top + bottom) / 2, lz, 8);
        for (let y = top - 0.5; y > bottom + 0.4; y -= 2.2) P.add('iron', new THREE.TorusGeometry(0.3, 0.035, 4, 10).rotateX(Math.PI / 2), place(lx, y, lz));
        P.add('iron', new THREE.ConeGeometry(0.2, 0.3, 4), place(lx, top + 0.22, lz));
        return { top, bottom };
    };
    const rows = [];
    for (let d = 1.5; d < len - 0.5; d += 3.6) {
        const [x0, x1] = edges(d);
        const a = piling(x0 + 0.2, d), b = piling(x1 - 0.2, d);
        if (a && b) rows.push({ d, x0: x0 + 0.2, x1: x1 - 0.2, a, b });
    }
    for (const r of rows) {
        const y = Math.max(r.a.bottom + 1, r.a.top - 3.2);
        rod('hull', [r.x0, r.a.top - 0.4, r.d], [r.x1, y, r.d], 0.07);
        rod('hull', [r.x1, r.b.top - 0.4, r.d], [r.x0, y, r.d], 0.07);
    }

    // ---- railings: spiked iron with a pinnacle post every few metres
    const posts = [];
    const railRun = (x0, z0, x1, z1, gaps = []) => {
        const seg = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.ceil(seg / 1.5));
        for (let k = 0; k <= n; k++) {
            const lx = x0 + ((x1 - x0) * k) / n, lz = z0 + ((z1 - z0) * k) / n;
            const y = deckY(lz);
            if (gaps.some(([a, b]) => lz > a - 0.01 && lz < b + 0.01 && x0 === x1)) continue;
            const big = k % 2 === 0;
            box(big ? 'stone' : 'iron', big ? 0.26 : 0.1, RAIL_H + (big ? 0.2 : 0.1), big ? 0.26 : 0.1, lx, y + RAIL_H / 2, lz);
            if (big) cone('stone', 0.2, 0.36, lx, y + RAIL_H + 0.36, lz, 4);
            else cone('iron', 0.08, 0.2, lx, y + RAIL_H + 0.18, lz, 4);
            posts.push([lx, lz]);
            if (k === n) continue;
            const mx = (lx + x0 + ((x1 - x0) * (k + 1)) / n) / 2, mz = (lz + z0 + ((z1 - z0) * (k + 1)) / n) / 2;
            if (gaps.some(([a, b]) => mz > a && mz < b && x0 === x1)) continue;
            const l = seg / n, rise = deckY(z0 + ((z1 - z0) * (k + 1)) / n) - y;
            const ry = Math.atan2(x1 - x0, z1 - z0), tilt = Math.atan2(-rise, l);
            const ln = Math.hypot(l, rise) + 0.04;
            for (const [hy, th] of [[RAIL_H, 0.07], [RAIL_H * 0.45, 0.05]]) box('iron', th, th, ln, mx, deckY(mz) + hy, mz, ry, tilt);
            // spear bars between the rails
            for (const f of [0.25, 0.5, 0.75]) {
                const sx = lx + (x1 - x0) / n * f, sz = lz + (z1 - z0) / n * f;
                cyl('iron', 0.015, 0.015, RAIL_H * 0.95, sx, deckY(sz) + RAIL_H * 0.47, sz, 4);
                cone('iron', 0.03, 0.12, sx, deckY(sz) + RAIL_H * 0.95 + 0.06, sz, 4);
            }
        }
        for (let s = 0; s <= seg; s += 0.45) {
            const p = toW(x0 + ((x1 - x0) * s) / seg, z0 + ((z1 - z0) * s) / seg);
            if (!gaps.some(([a, b]) => z0 + ((z1 - z0) * s) / seg > a && z0 + ((z1 - z0) * s) / seg < b)) world.colliders.push({ x: p.x, z: p.z, r: 0.17 });
        }
    };
    const hw = WHARF.half, hh = WHARF.head, rh = 2.4;
    const lzGang = w.shipC + (S.GANG_Z[0] + S.GANG_Z[1]) / 2;
    // the ramp, both sides
    railRun(-rh, 0.8, -rh, rampEnd - 0.01);
    railRun(rh, 0.8, rh, rampEnd - 0.01);
    // the berth deck: the seaward side rails; the ship's side is chained between skull bollards
    railRun(-hw, rampEnd, -hw, headStart);
    // the head: all round except where it meets the deck
    railRun(-hh, headStart, -hh, len);
    railRun(-hh, len, hw, len);
    railRun(hw, len, hw, headStart);
    railRun(-hh, headStart, -hw, headStart);

    // ---- skull bollards and a swag of chain along the ship's side, with a gap for the gangway
    const bollards = [];
    for (let lz = rampEnd + 1.0; lz < headStart - 0.3; lz += 3.0) {
        if (Math.abs(lz - lzGang) < 1.7) continue;
        bollards.push(lz);
    }
    bollards.push(lzGang - 1.7, lzGang + 1.7);
    bollards.sort((a, b) => a - b);
    bollards.forEach((lz, i) => {
        const y = Y;
        cyl('iron', 0.17, 0.2, 0.55, hw - 0.1, y + 0.27, lz, 8);
        cyl('trim', 0.2, 0.2, 0.06, hw - 0.1, y + 0.56, lz, 8);
        P.add('bone', new THREE.SphereGeometry(0.17, 10, 8), place(hw - 0.1, y + 0.72, lz).multiply(new THREE.Matrix4().makeScale(1, 1.1, 1)));
        box('black', 0.16, 0.07, 0.04, hw - 0.1 + 0.03, y + 0.76, lz - 0.12);
        const next = bollards[i + 1];
        if (next !== undefined && !(Math.abs(lz - (lzGang - 1.7)) < 0.01 && Math.abs(next - (lzGang + 1.7)) < 0.01)) {
            for (let k = 0; k < 8; k++) {
                const t = (k + 0.5) / 8, z = lz + (next - lz) * t;
                const sag = Math.sin(t * Math.PI) * 0.18;
                P.add('iron', new THREE.TorusGeometry(0.045, 0.014, 4, 6), place(hw - 0.1, y + 0.62 - sag, z, k % 2 ? 0 : Math.PI / 2));
            }
        }
        const p = toW(hw - 0.1, lz);
        world.colliders.push({ x: p.x, z: p.z, r: 0.22 });
    });

    // ---- the gate at the head of the ramp: pointed arch, pinnacles, gargoyles and a hanging lamp
    {
        const gz = 2.4, y0 = deckY(gz), W2 = 2.75;
        for (const s of [-1, 1]) {
            const x = s * W2;
            box('stone', 0.9, 5.2, 0.9, x, y0 + 2.6, gz);
            box('stone', 1.15, 0.35, 1.15, x, y0 + 0.17, gz);
            box('trim', 1.0, 0.1, 1.0, x, y0 + 5.25, gz);
            cone('stone', 0.6, 1.9, x, y0 + 6.25, gz, 4);
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cone('trim', 0.07, 0.42, x + ox * 0.47, y0 + 5.5, gz + oz * 0.47, 4);
            // buttress
            box('stone', 0.5, 2.2, 1.7, x + s * 0.7, y0 + 1.1, gz, 0);
            world.colliders.push({ x: toW(x, gz).x, z: toW(x, gz).z, r: 0.75 });
        }
        // the ogive: two circular arcs meeting at a point, doubled for tracery
        const SPRING = 3.2;
        const arch = (r, R) => {
            const rise = Math.sqrt(2 * R * r - r * r), thMax = Math.asin(rise / R);
            for (const s of [-1, 1]) {
                const pts = [];
                for (let i = 0; i <= 12; i++) {
                    const th = (i / 12) * thMax;
                    pts.push(V(s * (-(R - r) + R * Math.cos(th)), y0 + SPRING + R * Math.sin(th), gz).applyMatrix4(base));
                }
                P.tube('stone', pts, 0.17, { seg: 6 });
            }
            return rise;
        };
        const rise = arch(W2 - 0.45, W2 - 0.45 + 0.35);
        arch(W2 - 1.0, W2 - 1.0 + 0.3);
        // a trefoil under the point, a boss and a gilt finial
        const apex = y0 + SPRING + rise;
        P.add('trim', new THREE.TorusGeometry(0.34, 0.05, 6, 16), place(0, apex - 0.9, gz));
        for (const a of [0, TAU / 3, (TAU * 2) / 3]) P.add('trim', new THREE.TorusGeometry(0.17, 0.035, 6, 12), place(Math.sin(a) * 0.2, apex - 0.9 + Math.cos(a) * 0.2, gz));
        P.add('bone', new THREE.SphereGeometry(0.22, 10, 8), place(0, apex + 0.05, gz).multiply(new THREE.Matrix4().makeScale(1, 1.1, 1)));
        P.add('stone', new THREE.ConeGeometry(0.3, 1.0, 4), place(0, apex + 0.7, gz));
        P.add('trim', new THREE.SphereGeometry(0.1, 8, 6), place(0, apex + 1.3, gz));
        // gargoyles looking down from the pillar tops, toward whoever comes down the trail
        for (const s of [-1, 1]) {
            const p = toW(s * W2, gz - 0.2);
            gargoyle(P, p.x, y0 + 5.4, p.z, yaw + Math.PI + s * 0.35);
        }
        // a lamp hung in the arch on a chain
        P.rod('iron', local(0, apex - 1.3, gz), local(0, apex - 2.0, gz), 0.015, 0.015, 4);
        const lp = toW(0, gz);
        P.add('lamp', new THREE.SphereGeometry(0.22, 10, 8), place(0, apex - 2.25, gz).multiply(new THREE.Matrix4().makeScale(1, 1.35, 1)));
        P.add('iron', new THREE.ConeGeometry(0.28, 0.32, 6), place(0, apex - 1.85, gz));
        world.lampSpots.push({ x: lp.x, z: lp.z, y: y0, light: V(lp.x, apex - 2.25, lp.z) });
    }

    // ---- lamp posts: wrought iron with pointed cages, down the seaward side and at the head
    const lamp = (lx, lz) => {
        const y = deckY(lz), p = toW(lx, lz);
        cyl('iron', 0.09, 0.13, 3.2, lx, y + 1.6, lz, 8);
        cyl('iron', 0.2, 0.22, 0.35, lx, y + 0.17, lz, 8);
        P.add('iron', new THREE.TorusGeometry(0.28, 0.025, 4, 12, Math.PI).rotateZ(Math.PI), place(lx, y + 3.2, lz));
        for (const s of [-1, 1]) P.add('iron', new THREE.TorusGeometry(0.22, 0.022, 4, 10, Math.PI * 1.2), place(lx + s * 0.18, y + 2.4, lz, 0, 0, s * 0.8));
        cyl('iron', 0.2, 0.15, 0.08, lx, y + 3.1, lz, 4);
        P.add('lamp', new THREE.SphereGeometry(0.18, 10, 8), place(lx, y + 3.38, lz).multiply(new THREE.Matrix4().makeScale(1, 1.45, 1)));
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('iron', 0.025, 0.55, 0.025, lx + ox * 0.14, y + 3.38, lz + oz * 0.14);
        cone('iron', 0.26, 0.5, lx, y + 3.9, lz, 4);
        P.add('trim', new THREE.SphereGeometry(0.07, 8, 6), place(lx, y + 4.22, lz));
        world.colliders.push({ x: p.x, z: p.z, r: 0.32 });
        world.lampSpots.push({ x: p.x, z: p.z, y, light: V(p.x, y + 3.38, p.z) });
    };
    for (const s of [-1, 1]) lamp(s * 2.9, 1.2);
    for (let lz = rampEnd + 4; lz < headStart - 2; lz += 9) lamp(-(hw - 0.5), lz);
    lamp(-(hh - 0.6), len - 0.9);
    lamp(hw - 0.6, len - 0.9);
    lamp(hw - 0.5, lzGang - 3.4);
    lamp(hw - 0.5, lzGang + 3.4);

    // ---- cargo on the head: crates, barrels, nets, a brazier and a crane
    {
        const hy = Y, c0 = len - 2.4;
        const crate = (lx, lz, s = 1, r = 0, y = hy) => {
            box('plank', 0.95 * s, 0.9 * s, 0.95 * s, lx, y + 0.45 * s, lz, r);
            for (const q of [-1, 1]) {
                box('iron', 1.0 * s, 0.07, 0.07, lx, y + 0.45 * s, lz + q * 0.4 * s, r);
                box('iron', 0.07, 0.96 * s, 0.07, lx + q * 0.4 * s * Math.cos(r), y + 0.45 * s, lz - q * 0.4 * s * Math.sin(r), r);
            }
            const p = toW(lx, lz);
            world.colliders.push({ x: p.x, z: p.z, r: 0.65 * s });
        };
        crate(-4.1, c0, 1, 0.2);
        crate(-3.0, c0 - 0.1, 1.1, -0.1);
        crate(-3.55, c0 - 0.05, 0.8, 0.3, hy + 1.0);
        crate(-4.2, c0 - 1.4, 0.9, 0.1);
        const barrelAt = (lx, lz) => {
            const pts = [[0.28, 0], [0.36, 0.18], [0.4, 0.4], [0.36, 0.62], [0.28, 0.8]].map(([r, h]) => new THREE.Vector2(r, h));
            P.add('hull', new THREE.LatheGeometry(pts, 10), place(lx, hy, lz));
            for (const h of [0.14, 0.4, 0.66]) P.add('iron', new THREE.TorusGeometry(h === 0.4 ? 0.405 : 0.35, 0.02, 4, 10).rotateX(Math.PI / 2), place(lx, hy + h, lz));
            const p = toW(lx, lz);
            world.colliders.push({ x: p.x, z: p.z, r: 0.5 });
        };
        barrelAt(2.2, len - 1.2);
        barrelAt(1.5, len - 1.9);
        barrelAt(2.3, len - 2.3);
        // an iron brazier
        {
            const lx = 0, lz = len - 1.5;
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod('iron', [lx + ox * 0.5, hy, lz + oz * 0.5], [lx + ox * 0.3, hy + 0.9, lz + oz * 0.3], 0.04);
            P.add('iron', new THREE.CylinderGeometry(0.55, 0.3, 0.4, 10, 1, true), place(lx, hy + 1.1, lz));
            P.add('lamp', new THREE.SphereGeometry(0.34, 10, 8), place(lx, hy + 1.05, lz).multiply(new THREE.Matrix4().makeScale(1, 0.6, 1)));
            for (let i = 0; i < 6; i++) cone('iron', 0.04, 0.3, lx + Math.sin((i / 6) * TAU) * 0.55, hy + 1.45, lz + Math.cos((i / 6) * TAU) * 0.55, 4);
            const p = toW(lx, lz);
            world.colliders.push({ x: p.x, z: p.z, r: 0.6 });
            world.lampSpots.push({ x: p.x, z: p.z, y: hy, light: V(p.x, hy + 1.3, p.z) });
        }
        // a crane: a mast, a leaning boom, a rope and a hook
        {
            const lx = -(hh - 1.0), lz = headStart + 1.4;
            cyl('hull', 0.2, 0.3, 4.6, lx, hy + 2.3, lz, 8);
            cyl('trim', 0.34, 0.34, 0.1, lx, hy + 0.9, lz, 8);
            rod('hull', [lx, hy + 4.4, lz], [lx - 1.3, hy + 5.6, lz + 3.6], 0.14, 0.07);
            rod('hull', [lx, hy + 4.6, lz], [lx + 0.4, hy + 5.0, lz - 2.0], 0.05);
            rod('rope', [lx + 0.4, hy + 5.0, lz - 2.0], [lx - 1.3, hy + 5.6, lz + 3.6], 0.025);
            rod('rope', [lx - 1.3, hy + 5.5, lz + 3.5], [lx - 1.3, hy + 3.1, lz + 3.5], 0.02);
            P.add('trim', new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI * 1.4), place(lx - 1.3, hy + 2.95, lz + 3.5, 0, 0, Math.PI));
            P.add('hull', new THREE.BoxGeometry(0.9, 0.9, 0.9), place(lx - 1.3, hy + 2.3, lz + 3.5));
            const p = toW(lx, lz);
            world.colliders.push({ x: p.x, z: p.z, r: 0.55 });
        }
    }

    // ---- a sign beside the head of the ramp
    {
        const gz = -1.4, lx = rh + 1.4;
        const p = toW(lx, gz), gy = world.groundAt(p.x, p.z);
        for (const s of [-1, 1]) P.add('hull', new THREE.BoxGeometry(0.12, 2.2, 0.12), place(lx + s * 0.78, gy + 0.9 - 0.0, gz).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)));
        world.colliders.push({ x: p.x, z: p.z, r: 0.85 });
        const sign = signMesh(signTexture('⚓', 'The Delvers’ Wharf', 'The Black Nocturne lies at berth', '#c0405a', 1024, 256), 1.7, 0.43, 0.3);
        sign.position.set(p.x, gy + 1.75, p.z);
        sign.rotation.y = yaw + Math.PI;
        world.root.add(sign);
        world.nightSigns.push(sign.userData.nightGlow);
    }

    world.root.add(P.build(mats));

    // ---- what the ship and the rest of the garden need to know
    const lGang = toW(hw, lzGang);
    const stand = toW(0, rampEnd + 3);
    const wharf = {
        ...w, half: hw, headHalf: hh, deckY,
        gangway: { x: lGang.x, z: lGang.z, y: Y, lz: lzGang },
        stand: { x: stand.x, z: stand.z, yaw: Math.atan2(-dx, -dz) },
        /** Is (x, z) on the wharf's deck (or its ramp)? */
        on(x, z) {
            const ux = w.bx - ax, uz = w.bz - az, l2 = ux * ux + uz * uz;
            const t = ((x - ax) * ux + (z - az) * uz) / l2;
            if (t < 0 || t > 1.02) return false;
            const lat = Math.abs((x - ax) * uz - (z - az) * ux) / Math.sqrt(l2);
            return lat < (t * len > headStart ? hh : t * len > rampEnd ? hw : 2.4) + 0.6;
        },
        /** A walk from wherever the player is to a point on the wharf, round the pavilion and down the trail. */
        route(controls, end) {
            const pos = controls.pos;
            if (this.on(pos.x, pos.z)) return [end];
            const sp = w.spoke, pv = sp.pavilion;
            let pts = [];
            let from = pos;
            if (Math.hypot(pos.x - pv.x, pos.z - pv.z) > PAVILION_PLAZA + 1.5) {
                const e = samplePath(sp.pts, sp.length - PAVILION_PLAZA - 0.5);
                pts = controls.plan(e.x, e.z);
                from = e;
            }
            const R = 5.9;
            const a0 = Math.atan2(from.x - pv.x, from.z - pv.z), a1 = Math.atan2(dx, dz);
            const d = angleDiff(a0, a1);
            const n = Math.max(1, Math.ceil(Math.abs(d) / 0.35));
            for (let i = 0; i <= n; i++) {
                const a = a0 + (d * i) / n;
                pts.push({ x: pv.x + Math.sin(a) * R, z: pv.z + Math.cos(a) * R });
            }
            const tr = w.trail.pts;
            for (let i = 0; i < tr.length; i += 4) pts.push({ x: tr[i].x, z: tr[i].z });
            pts.push({ x: ax, z: az });
            const m = toW(0, rampEnd + 1);
            pts.push({ x: m.x, z: m.z }, end);
            return pts;
        },
    };
    // a label on the map, past the head of the wharf
    const tip = toW(0, len + 4);
    world.landmarks.push({ name: 'The Pirate Wharf', x: tip.x, z: tip.z, stand: wharf.stand });
    void clamp;
    return wharf;
}
