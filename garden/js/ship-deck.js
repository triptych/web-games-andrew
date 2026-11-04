// What stands and hangs about the Black Nocturne's decks: cannons (on the
// main deck behind the tracery, and a tier of gun ports below), the wheel and
// its binnacle, capstan, bell, barrels, anchor, gargoyles and the winged
// figurehead under the bowsprit.

import * as THREE from 'three';
import { TAU } from './util.js';
import { S, V, Parts, sideX, topAt } from './ship-kit.js';
import { runeRing } from './ship-textures.js';

/** Outward unit normal (x, z) of the hull's side at (z, y), for side s. */
function outward(z, y, s) {
    const m = (sideX(z + 0.4, y) - sideX(z - 0.4, y)) / 0.8;
    const l = Math.hypot(1, m);
    return { x: s / l, z: -m / l, l };
}

function cannon(P, ctx, x, y, z, s, { len = 2.1, carriage = true } = {}) {
    const muzzle = V(s * (sideX(z, y) + 0.4), y + 0.12, z);
    const breech = V(muzzle.x - s * len, y - 0.02, z);
    P.rod('iron', breech, muzzle, 0.25, 0.17, 10);
    P.rod('trim', muzzle.clone().lerp(breech, 0.08), muzzle.clone().lerp(breech, 0.2), 0.2, 0.2, 10);
    P.rod('trim', muzzle.clone().lerp(breech, 0.55), muzzle.clone().lerp(breech, 0.6), 0.23, 0.23, 10);
    P.sph('iron', 0.13, breech.x - s * 0.1, breech.y, z);
    // a spiked collar at the mouth
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        P.cone('iron', 0.03, 0.17, muzzle.x - s * 0.1, muzzle.y + Math.sin(a) * 0.19, z + Math.cos(a) * 0.19, { seg: 4, rz: -s * Math.PI / 2 });
    }
    if (!carriage) return;
    const cx = (muzzle.x + breech.x) / 2 - s * 0.1;
    P.box('hull', 1.55, 0.2, 0.62, cx, y - 0.37, z);
    P.box('hull', 0.5, 0.3, 0.62, cx - s * 0.6, y - 0.18, z);
    for (const dz of [-0.36, 0.36]) {
        P.box('hull', 1.5, 0.35, 0.1, cx, y - 0.2, z + dz);
        for (const dx of [-0.5, 0.5]) {
            P.cyl('hull', 0.22, 0.22, 0.12, cx + dx, y - 0.52, z + dz * 1.15, { rx: Math.PI / 2, seg: 10 });
            P.cyl('iron', 0.07, 0.07, 0.14, cx + dx, y - 0.52, z + dz * 1.15, { rx: Math.PI / 2, seg: 6 });
        }
    }
    P.tor('rope', 0.28, 0.025, cx - s * 0.65, y - 0.1, z, { ry: Math.PI / 2, seg: 10 });
    ctx.col.push({ x: cx, z, r: 0.5 });
}

/** A gun port on the hull side below the deck: an iron-bound frame, a raised lid and a muzzle. */
function lowerPort(P, z, y, s) {
    const n = outward(z, y, s);
    const X = s * sideX(z, y);
    const ry = Math.atan2(n.x, n.z); // the frame's local z faces outward
    P.add('black', new THREE.BoxGeometry(0.85, 0.62, 0.1), new THREE.Matrix4().compose(V(X + n.x * 0.03, y, z + n.z * 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1)));
    for (const [w, h, dx, dy] of [[0.95, 0.07, 0, 0.34], [0.95, 0.07, 0, -0.34], [0.07, 0.7, -0.45, 0], [0.07, 0.7, 0.45, 0]]) {
        const o = V(dx, dy, 0).applyEuler(new THREE.Euler(0, ry, 0));
        P.add('trim', new THREE.BoxGeometry(w, h, 0.08), new THREE.Matrix4().compose(V(X + n.x * 0.06 + o.x, y + o.y, z + n.z * 0.06 + o.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1)));
    }
    // the lid, swung up on its hinge
    const hinge = V(X + n.x * 0.1, y + 0.36, z + n.z * 0.1);
    const lid = new THREE.Matrix4().compose(
        hinge.clone().add(V(n.x * 0.2, 0.28, n.z * 0.2)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, ry, 0, 'YXZ')),
        V(1, 1, 1),
    );
    P.add('hullRed', new THREE.BoxGeometry(0.8, 0.58, 0.06), lid);
    P.rod('iron', V(hinge.x, hinge.y, hinge.z - 0.38), V(hinge.x, hinge.y, hinge.z + 0.38), 0.025);
    // the muzzle
    const a = V(X - n.x * 0.1, y, z - n.z * 0.1), b = V(X + n.x * 0.42, y, z + n.z * 0.42);
    P.rod('iron', a, b, 0.17, 0.12, 8);
    P.rod('trim', b.clone().lerp(a, 0.06), b.clone().lerp(a, 0.2), 0.15, 0.15, 8);
}

function barrel(P, x, y, z, hoop = 'iron') {
    const pts = [[0.28, 0], [0.36, 0.18], [0.4, 0.4], [0.36, 0.62], [0.28, 0.8]].map(([r, h]) => new THREE.Vector2(r, h));
    P.add('hull', new THREE.LatheGeometry(pts, 10), new THREE.Matrix4().makeTranslation(x, y, z));
    for (const h of [0.14, 0.4, 0.66]) P.tor(hoop, h === 0.4 ? 0.405 : 0.35, 0.02, x, y + h, z, { rx: Math.PI / 2, seg: 10 });
}

export function gargoyle(P, x, y, z, ry) {
    const at = (dx, dy, dz) => {
        const v = V(dx, dy, dz).applyEuler(new THREE.Euler(0, ry, 0));
        return [x + v.x, y + v.y, z + v.z];
    };
    P.sph('stone', 0.22, ...at(0, 0.2, 0), 1, 1, 1.4);
    P.sph('stone', 0.17, ...at(0, 0.48, 0.28));
    P.rod('stone', V(...at(0, 0.5, 0.35)), V(...at(0, 0.34, 0.5)), 0.07, 0.04);
    for (const s of [-1, 1]) {
        P.cone('stone', 0.04, 0.22, ...at(s * 0.1, 0.72, 0.26), { seg: 4, rz: -s * 0.4 });
        P.sph('ecto', 0.035, ...at(s * 0.07, 0.52, 0.42));
        // folded wings and clawed feet
        P.add('stone', new THREE.BoxGeometry(0.03, 0.36, 0.3), new THREE.Matrix4().compose(V(...at(s * 0.2, 0.34, -0.12)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, ry, s * 0.5, 'YXZ')), V(1, 1, 1)));
        P.rod('stone', V(...at(s * 0.12, 0.05, 0.18)), V(...at(s * 0.12, -0.12, 0.34)), 0.05);
    }
    P.box('stone', 0.55, 0.12, 0.7, ...at(0, -0.1, 0.05), ry);
}

function wheel(ctx, mats) {
    const g = new THREE.Group();
    const P = new Parts();
    const R = 0.5;
    P.tor('hull', R, 0.05, 0, 0, 0, { seg: 28 });
    P.tor('trim', R - 0.2, 0.025, 0, 0, 0, { seg: 20 });
    P.cyl('trim', 0.12, 0.12, 0.14, 0, 0, 0, { rx: Math.PI / 2, seg: 12 });
    P.cone('trim', 0.1, 0.22, 0, 0, 0.18, { rx: Math.PI / 2, seg: 8 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU, c = Math.cos(a), s = Math.sin(a);
        P.rod('hull', V(c * 0.1, s * 0.1, 0), V(c * R, s * R, 0), 0.035, 0.03, 6);
        // the turned handle beyond the rim, tipped with a bud
        P.rod('hull', V(c * R, s * R, 0), V(c * (R + 0.3), s * (R + 0.3), 0), 0.04, 0.03, 6);
        P.sph('trim', 0.05, c * (R + 0.33), s * (R + 0.33), 0);
    }
    g.add(P.build(mats));
    g.position.set(0, S.QUARTER + 1.02, S.WHEEL_Z);
    return g;
}

export function buildDeck(P, ctx, mats) {
    const { col } = ctx;
    // ---- cannons on the main deck, muzzles through the arches in the bulwark
    for (const z of ctx.bays) for (const s of [-1, 1]) cannon(P, ctx, 0, S.DECK + 0.62, z, s);
    // a swivel gun on each side of the quarterdeck (the forecastle is too narrow for guns)
    for (const s of [-1, 1]) {
        for (const z of ctx.qbays) cannon(P, ctx, 0, S.QUARTER + 0.55, z, s, { len: 1.6 });
    }
    // the gun deck below: a tier of ports in the hull
    for (const s of [-1, 1]) for (let z = -7.2; z <= 9.2; z += 2.3) lowerPort(P, z, 1.05, s);
    // a bow cannon under the figurehead
    // ---- the helm
    {
        const wz = S.WHEEL_Z, y = S.QUARTER;
        P.box('hull', 0.6, 0.8, 0.7, 0, y + 0.4, wz);
        P.box('trim', 0.7, 0.07, 0.8, 0, y + 0.82, wz);
        P.box('trim', 0.8, 0.07, 0.9, 0, y + 0.04, wz);
        for (const s of [-1, 1]) {
            P.cone('trim', 0.07, 0.38, s * 0.32, y + 1.12, wz - 0.3, { seg: 4 });
            P.rod('hull', V(s * 0.28, y + 0.9, wz), V(s * 0.28, y + 1.3, wz), 0.06);
        }
        col.push({ x: 0, z: wz, r: 0.55 });
        // the binnacle ahead of the wheel: a compass under a glowing dome
        const bz = wz - 1.05;
        P.box('hull', 0.5, 0.95, 0.5, 0, y + 0.48, bz);
        P.cyl('trim', 0.27, 0.27, 0.07, 0, y + 0.97, bz, { seg: 8 });
        P.sph('lamp', 0.19, 0, y + 1.1, bz, 1, 0.85, 1);
        col.push({ x: 0, z: bz, r: 0.42 });
        ctx.lights.push({ x: 0, y: y + 1.1, z: bz, kind: 'lamp' });
        ctx.wheel = wheel(ctx, mats);
        ctx.group.add(ctx.wheel);
        // the rune the helmsman stands on
        const ring = new THREE.Mesh(
            new THREE.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: runeRing(), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        ring.position.set(0, S.QUARTER + 0.03, S.HELM_Z);
        ring.renderOrder = 2;
        ctx.group.add(ring);
        ctx.runeRing = ring;
    }
    // ---- the main deck's furniture
    // capstan and hatch
    P.cyl('hull', 0.5, 0.58, 0.3, 0, S.DECK + 0.15, -5.0, { seg: 10 });
    P.cyl('trim', 0.34, 0.34, 0.95, 0, S.DECK + 0.78, -5.0, { seg: 10 });
    P.cyl('hull', 0.5, 0.5, 0.14, 0, S.DECK + 1.3, -5.0, { seg: 10 });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        P.rod('hull', V(Math.sin(a) * 0.2, S.DECK + 1.25, -5.0 + Math.cos(a) * 0.2), V(Math.sin(a) * 1.15, S.DECK + 1.25, -5.0 + Math.cos(a) * 1.15), 0.04);
        P.sph('trim', 0.05, Math.sin(a) * 1.17, S.DECK + 1.25, -5.0 + Math.cos(a) * 1.17);
    }
    col.push({ x: 0, z: -5.0, r: 0.7 });
    P.box('hull', 1.7, 0.2, 1.3, 0, S.DECK + 0.1, -3.0);
    for (let i = -3; i <= 3; i++) P.box('iron', 0.05, 0.05, 1.2, i * 0.22, S.DECK + 0.22, -3.0);
    for (let i = -2; i <= 2; i++) P.box('iron', 1.6, 0.05, 0.05, 0, S.DECK + 0.22, -3.0 + i * 0.26);
    // powder barrels, balls and ropes (clear of the stairs, the guns and the aisle down the middle)
    const barrels = [[3.05, S.DECK, 1.2], [3.05, S.DECK, 2.3], [2.4, S.QUARTER, 4.7], [2.0, S.QUARTER, 5.4], [-2.0, S.QUARTER, 8.4]];
    for (const [x, y, z] of barrels) {
        barrel(P, x, y, z);
        col.push({ x, z, r: 0.5 });
    }
    barrel(P, 2.25, S.QUARTER + 0.8, 5.0, 'trim');
    // cannonball pyramids
    for (const [x, y, z] of [[-0.85, S.FORE, -8.95], [1.9, S.QUARTER, 7.2]]) {
        for (let i = 0; i < 3; i++) for (let j = 0; j <= 2 - i; j++) P.sph('iron', 0.1, x + (j - (2 - i) / 2) * 0.21, y + 0.1 + i * 0.17, z + (i % 2) * 0.05, 1, 1, 1, 8);
        P.box('hull', 0.8, 0.07, 0.4, x, y + 0.02, z);
        col.push({ x, z, r: 0.35 });
    }
    // coils of rope
    for (const [x, y, z] of [[0.85, S.FORE, -8.95], [-1.2, S.QUARTER, 5.0], [1.2, S.QUARTER, 5.6]]) {
        for (let k = 0; k < 3; k++) P.tor('rope', 0.34 - k * 0.04, 0.06, x, y + 0.08 + k * 0.09, z, { rx: Math.PI / 2, seg: 12 });
    }
    // ---- the forecastle: bell on a pointed gantry, the anchor on its cathead
    {
        const y = S.FORE, z = -10.3;
        for (const s of [-1, 1]) P.rod('hull', V(s * 0.6, y, z), V(s * 0.6, y + 1.7, z), 0.07);
        P.rod('hull', V(-0.6, y + 1.7, z), V(0, y + 2.4, z), 0.06);
        P.rod('hull', V(0.6, y + 1.7, z), V(0, y + 2.4, z), 0.06);
        P.sph('trim', 0.07, 0, y + 2.45, z);
        P.cone('trim', 0.05, 0.3, 0, y + 2.65, z, { seg: 4 });
        P.add('trim', new THREE.LatheGeometry([[0.05, 0.38], [0.14, 0.34], [0.2, 0.2], [0.3, 0.02], [0.33, 0]].map(([r, h]) => new THREE.Vector2(r, h)), 10), new THREE.Matrix4().makeTranslation(0, y + 1.1, z));
        P.rod('iron', V(0, y + 1.48, z), V(0, y + 1.7, z), 0.015);
        col.push({ x: 0, z, r: 0.6 });
        // anchor on the starboard bow
        const ax = sideX(-9.4, S.FORE) + 0.12, az = -9.4, ay = S.FORE - 0.5;
        P.rod('iron', V(ax, ay + 1.0, az), V(ax, ay - 0.9, az), 0.06);
        P.rod('iron', V(ax - 0.5, ay + 0.85, az), V(ax + 0.5, ay + 0.85, az), 0.045);
        P.tor('iron', 0.55, 0.05, ax, ay - 0.55, az, { rz: 0, ry: Math.PI / 2, arc: Math.PI, seg: 14, rx: 0 });
        for (const dz of [-1, 1]) P.cone('iron', 0.1, 0.3, ax, ay - 0.62, az + dz * 0.55, { seg: 4, rx: dz * Math.PI / 2 });
        P.tor('iron', 0.12, 0.025, ax, ay + 1.1, az, { ry: Math.PI / 2, seg: 8 });
        for (let k = 0; k < 6; k++) P.tor('iron', 0.07, 0.02, ax - 0.02, ay + 1.2 + k * 0.1, az + (k % 2) * 0.04 - 0.3 * (k / 6), { ry: (k % 2) * Math.PI / 2, seg: 6 });
        P.rod('hull', V(ax - 0.1, S.FORE - 0.1, az - 0.3), V(ax + 0.4, S.FORE + 0.1, az + 0.1), 0.1);
    }
    // ---- the gate on the port side: a lamp at each post
    if (ctx.gate) {
        for (const z of S.GANG_Z) {
            const x = ctx.gate.x;
            P.sph('lamp', 0.13, x, S.DECK + 2.0, z, 1, 1.3, 1);
            P.cone('iron', 0.16, 0.2, x, S.DECK + 2.25, z, { seg: 6 });
            ctx.lights.push({ x, y: S.DECK + 2.0, z, kind: 'lamp' });
        }
    }
    // ---- gargoyles at the corners of both castles
    for (const s of [-1, 1]) {
        gargoyle(P, s * (sideX(3.8, S.QUARTER) - 0.15), S.QUARTER + 1.4, S.QUARTER_Z + 0.25, s > 0 ? 0.6 : -0.6);
        gargoyle(P, s * (sideX(-8.6, S.FORE) - 0.15), S.FORE + 1.35, S.FORE_Z - 0.25, s > 0 ? Math.PI - 0.6 : Math.PI + 0.6);
    }
    // ---- fenders of rope along the port side
    for (const z of [-5.5, -2.2, 3.0, 6.0]) P.tor('rope', 0.3, 0.12, -(sideX(z, 1.75) + 0.05), 1.75, z, { ry: Math.PI / 2, seg: 10 });

    // ---- the figurehead: a bone-white winged maiden with a ghost lantern, leaning out under the bowsprit
    {
        const z0 = -S.HL - 0.35;
        const root = V(0, 2.75, z0 + 0.5), head = V(0, 3.45, z0 - 1.15);
        P.rod('bone', root, head, 0.42, 0.2, 8);
        P.rod('trim', root.clone().lerp(head, 0.15), root.clone().lerp(head, 0.18), 0.47, 0.47, 8);
        P.sph('bone', 0.23, head.x, head.y + 0.28, head.z - 0.15, 1, 1.1, 1);
        P.box('bone', 0.22, 0.14, 0.2, head.x, head.y + 0.08, head.z - 0.27);
        for (const s of [-1, 1]) {
            P.sph('ecto', 0.05, s * 0.09, head.y + 0.3, head.z - 0.36);
            // swept wings: gilt feathers fanning back along the bow
            for (let i = 0; i < 6; i++) {
                const a = 0.55 + i * 0.2, L = 1.5 - i * 0.12;
                const sh = V(s * 0.2, head.y - 0.05, head.z + 0.1);
                P.rod('trim', sh, V(sh.x + s * Math.cos(a) * L, sh.y + 0.65 - i * 0.2, sh.z + Math.sin(a) * L * 0.9), 0.05, 0.015, 4);
            }
            // arms reaching out to the lantern
            P.rod('bone', V(s * 0.2, head.y - 0.1, head.z + 0.05), V(s * 0.08, head.y - 0.12, head.z - 0.7), 0.05, 0.035, 5);
        }
        P.sph('ecto', 0.15, 0, head.y - 0.12, head.z - 0.82, 1, 1.2, 1);
        ctx.lights.push({ x: 0, y: head.y - 0.12, z: head.z - 0.82, kind: 'ecto' });
        // long hair streaming back
        for (const dx of [-0.12, 0, 0.12]) P.tube('black', [V(dx, head.y + 0.45, head.z - 0.1), V(dx * 2, head.y + 0.5, head.z + 0.45), V(dx * 3, head.y + 0.15, head.z + 1.0)], 0.035, { seg: 4 });
    }
    void topAt;
}
