// The Black Nocturne's masts, yards, rigging and sails. The spars and ropes
// are batched; the sails, flag and pennants are loose meshes whose vertices
// are moved every frame so they belly and ripple in the wind.

import * as THREE from 'three';
import { TAU, lerp, clamp } from './util.js';
import { S, V, sideX } from './ship-kit.js';
import { sailTexture, flagTexture, pennantTexture } from './ship-textures.js';

// [yard height, yard length, sail height, emblem]
const YARDS = {
    fore: [[10.0, 12, 5.2, 'cross'], [14.8, 9, 4.0, 'plain'], [18.6, 6.2, 3.0, 'rose']],
    main: [[11.0, 14, 5.8, 'skull'], [16.5, 10.5, 4.9, 'rose'], [21.0, 7.2, 3.6, 'cross']],
    mizzen: [[10.5, 9, 4.5, 'plain'], [15.0, 6.6, 3.4, 'cross']],
};

const bil = (c, u, v, out) => {
    const ax = lerp(c[0].x, c[1].x, u), ay = lerp(c[0].y, c[1].y, u), az = lerp(c[0].z, c[1].z, u);
    const bx = lerp(c[2].x, c[3].x, u), by = lerp(c[2].y, c[3].y, u), bz = lerp(c[2].z, c[3].z, u);
    return out.set(lerp(ax, bx, v), lerp(ay, by, v), lerp(az, bz, v));
};

/**
 * A sail between four corners [top-left, top-right, bottom-left, bottom-right]
 * that belies along dir. Registers an update(t, wind) on ctx.
 */
function quadSail(ctx, corners, dir, amp, mat, phase = 0, flapTop = 0) {
    const nu = 10, nv = 8;
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
    const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
    const idx = [];
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
            const k = j * (nu + 1) + i;
            uv[k * 2] = i / nu;
            uv[k * 2 + 1] = 1 - j / nv;
            if (i < nu && j < nv) {
                const a = k, b = k + 1, c = k + nu + 1, d = c + 1;
                idx.push(a, c, b, b, c, d);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    ctx.group.add(mesh);
    const p = new THREE.Vector3();
    let frame = 0;
    const update = (t, wind) => {
        const a = amp * (0.22 + 0.78 * wind);
        for (let j = 0; j <= nv; j++) {
            const v = j / nv;
            for (let i = 0; i <= nu; i++) {
                const u = i / nu;
                bil(corners, u, v, p);
                const belly = Math.sin(Math.PI * u) * Math.sin(Math.PI * v * 0.92);
                const ripple = Math.sin(u * 7 + t * 2.1 + phase + v * 3) * 0.06 + Math.sin(u * 13 - t * 3.3 + phase) * 0.025;
                const b = a * belly + ripple * (0.3 + wind) * (0.2 + v) * amp * 0.6 + flapTop * Math.sin(t * 1.3 + phase) * v;
                const k = (j * (nu + 1) + i) * 3;
                pos[k] = p.x + dir.x * b;
                pos[k + 1] = p.y + dir.y * b;
                pos[k + 2] = p.z + dir.z * b;
            }
        }
        geo.attributes.position.needsUpdate = true;
        if ((frame++ & 1) === 0) geo.computeVertexNormals();
    };
    update(0, 0.2);
    ctx.anim.push(update);
    return mesh;
}

/** A flag or pennant: a strip from a pole streaming along dir, waving. */
function flag(ctx, base, along, up, len, h, mat, phase = 0) {
    const nu = 14, nv = 3;
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
    const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
    const idx = [];
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
            const k = j * (nu + 1) + i;
            uv[k * 2] = i / nu;
            uv[k * 2 + 1] = 1 - j / nv;
            if (i < nu && j < nv) idx.push(k, k + nu + 1, k + 1, k + 1, k + nu + 1, k + nu + 2);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    ctx.group.add(mesh);
    const side = new THREE.Vector3().crossVectors(along, up).normalize();
    const update = (t, wind) => {
        for (let j = 0; j <= nv; j++) {
            for (let i = 0; i <= nu; i++) {
                const u = i / nu, v = j / nv;
                const w = Math.sin(u * 7 - t * (5 + wind * 4) + phase) * (0.04 + 0.5 * u) * (0.35 + wind * 0.65);
                const k = (j * (nu + 1) + i) * 3;
                pos[k] = base.x + along.x * u * len - up.x * v * h + side.x * w;
                pos[k + 1] = base.y + along.y * u * len - up.y * v * h + side.y * w + Math.sin(u * 4 - t * 3) * 0.04 * u;
                pos[k + 2] = base.z + along.z * u * len - up.z * v * h + side.z * w;
            }
        }
        geo.attributes.position.needsUpdate = true;
        if (Math.random() < 0.5) geo.computeVertexNormals();
    };
    update(0, 0.2);
    ctx.anim.push(update);
}

function mast(P, ctx, m) {
    const H = m.top - m.base;
    const jy = m.base + H * 0.6; // where the topmast joins
    P.rod('hull', V(0, m.base - 0.3, m.z), V(0, jy + 0.6, m.z), m.r * 1.1, m.r * 0.75, 9);
    P.rod('hull', V(0, jy - 0.4, m.z), V(0, m.top, m.z), m.r * 0.58, m.r * 0.28, 8);
    // iron hoops and a gilded collar at the join
    for (let y = m.base + 0.4; y < jy; y += 2.6) P.cyl('iron', m.r * lerp(1.14, 0.8, (y - m.base) / (jy - m.base)), m.r * lerp(1.14, 0.8, (y - m.base) / (jy - m.base)), 0.08, 0, y, m.z, { seg: 9 });
    P.cyl('trim', m.r * 0.9, m.r * 0.9, 0.2, 0, jy, m.z, { seg: 9 });
    // the mast's foot: a ring of belaying pins, a fife rail
    P.tor('hull', 0.95, 0.05, 0, m.base + 0.55, m.z, { rx: Math.PI / 2, seg: 14 });
    for (let a = 0; a < 8; a++) P.cyl('trim', 0.02, 0.02, 0.3, Math.sin((a / 8) * TAU) * 0.95, m.base + 0.7, m.z + Math.cos((a / 8) * TAU) * 0.95, { seg: 4 });
    ctx.col.push({ x: 0, z: m.z, r: m.r * 1.2 + 0.1 });

    // the top: a round platform with a fence of spiked posts
    const ty = m.base + H * 0.55;
    P.cyl('hull', 1.55, 1.55, 0.12, 0, ty, m.z, { seg: 14 });
    P.tor('trim', 1.55, 0.05, 0, ty + 0.07, m.z, { rx: Math.PI / 2, seg: 18 });
    for (let a = 0; a < 14; a++) {
        const x = Math.sin((a / 14) * TAU) * 1.5, z = m.z + Math.cos((a / 14) * TAU) * 1.5;
        P.cone('iron', 0.045, 0.7, x, ty + 0.4, z, { seg: 4 });
    }
    P.tor('iron', 1.5, 0.025, 0, ty + 0.55, m.z, { rx: Math.PI / 2, seg: 18 });
    // crossed trestle trees under it
    for (const s of [-1, 1]) P.rod('hull', V(0, ty - 0.1, m.z + s * 1.3), V(0, ty - 0.1, m.z - s * 1.3), 0.07);

    // finial: a spire with a crescent and a ghost-green lantern
    P.cone('trim', 0.09, 0.9, 0, m.top + 0.45, m.z, { seg: 6 });
    P.tor('trim', 0.28, 0.03, 0, m.top + 1.15, m.z, { rz: 0, arc: Math.PI * 1.5, seg: 14, ry: Math.PI / 2 });
    P.sph('ecto', 0.13, 0, m.top + 1.2, m.z);
    ctx.lights.push({ x: 0, y: m.top + 1.2, z: m.z, kind: 'ecto' });
    return { ty, jy };
}

function yardArm(P, y, len, z, tall) {
    P.rod('hull', V(0, y, z), V(-len / 2, y, z), 0.17, 0.07, 6);
    P.rod('hull', V(0, y, z), V(len / 2, y, z), 0.17, 0.07, 6);
    for (const s of [-1, 1]) {
        P.sph('trim', 0.1, s * len / 2, y, z);
        P.cone('trim', 0.05, 0.4, s * (len / 2 + 0.3), y, z, { seg: 4, rz: -s * Math.PI / 2 });
    }
    P.cyl('trim', 0.2, 0.2, 0.14, 0, y, z, { seg: 8 });
    // lifts up to the mast
    void tall;
}

function shrouds(P, m, ty) {
    const zs = [-0.8, 0, 0.8];
    for (const s of [-1, 1]) {
        const anchors = zs.map((dz) => V(s * (sideX(m.z + dz * 1.5, m.base) - 0.15), m.base + 0.8, m.z + dz * 1.5));
        const heads = zs.map((dz) => V(s * 0.7, ty - 0.1, m.z + dz * 0.8));
        anchors.forEach((a, i) => P.rod('iron', a, heads[i], 0.025));
        // deadeyes
        anchors.forEach((a) => P.tor('trim', 0.09, 0.025, a.x, a.y, a.z, { ry: Math.PI / 2, seg: 8 }));
        const n = Math.floor((ty - m.base - 1.5) / 0.85);
        for (let k = 1; k <= n; k++) {
            const t = 0.1 + (0.84 * k) / n;
            for (let i = 0; i < 2; i++) {
                const a = V(0, 0, 0).lerpVectors(anchors[i], heads[i], t), b = V(0, 0, 0).lerpVectors(anchors[i + 1], heads[i + 1], t);
                P.rod('rope', a, b, 0.017, 0.017, 4);
            }
        }
        // topmast backstay down to the rail
        P.rod('rope', V(s * 0.3, m.top - 3, m.z), V(s * (sideX(m.z + 2.5, m.base) - 0.3), m.base + 0.9, m.z + 2.8), 0.02);
    }
}

function cage(P, ctx, x, y, z) {
    // an iron gibbet hanging from the yard: a skeleton inside it
    P.rod('iron', V(x, y, z), V(x, y - 1.3, z), 0.02);
    const top = y - 1.3;
    P.cone('iron', 0.42, 0.28, x, top - 0.1, z, { seg: 10 });
    for (let a = 0; a < 10; a++) {
        const px = x + Math.sin((a / 10) * TAU) * 0.4, pz = z + Math.cos((a / 10) * TAU) * 0.4;
        P.rod('iron', V(px, top - 0.22, pz), V(x + Math.sin((a / 10) * TAU) * 0.26, top - 1.7, z + Math.cos((a / 10) * TAU) * 0.26), 0.016);
    }
    for (const k of [0.3, 0.8, 1.3]) P.tor('iron', lerp(0.4, 0.27, k / 1.5), 0.016, x, top - 0.22 - k, z, { rx: Math.PI / 2, seg: 12 });
    P.sph('bone', 0.12, x, top - 0.55, z, 1, 1.1, 1);
    P.cyl('bone', 0.015, 0.015, 0.5, x, top - 0.95, z, { seg: 4 });
    for (const k of [0.8, 0.95, 1.1]) P.box('bone', 0.3, 0.025, 0.06, x, top - k, z);
    P.sph('ecto', 0.05, x, top - 0.55, z + 0.12);
    void ctx;
}

export function buildRig(P, ctx, mats) {
    const sailMats = {};
    const mat = (kind) => (sailMats[kind] ??= new THREE.MeshStandardMaterial({
        map: sailTexture(kind, ctx.sailTex), roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.45, color: 0xffffff,
        emissive: 0x201020, emissiveIntensity: 0.0,
    }));
    ctx.sailMats = sailMats;
    const bellyDir = V(0, 0, -1);
    const mastData = {};

    for (const m of S.MASTS) {
        const { ty } = mast(P, ctx, m);
        mastData[m.id] = { ...m, ty };
        shrouds(P, m, ty);
        YARDS[m.id].forEach(([y, len, h, kind], i) => {
            yardArm(P, y, len, m.z - 0.45);
            // the sail hangs just forward of the mast and belies forward
            const zS = m.z - 0.55;
            const wT = len - 0.7, wB = len - 1.6;
            const corners = [V(-wT / 2, y - 0.1, zS), V(wT / 2, y - 0.1, zS), V(-wB / 2, y - h, zS), V(wB / 2, y - h, zS)];
            quadSail(ctx, corners, bellyDir, 0.55 + h * 0.1, mat(kind), m.z + i * 1.7);
            // sheets and braces: lines from the sail's foot and the yard's ends
            if (i === 0) {
                for (const s of [-1, 1]) {
                    P.rod('rope', V(s * wB / 2, y - h, zS), V(s * (sideX(m.z, m.base) - 0.25), m.base + 1.0, m.z - 0.6), 0.02);
                    P.rod('rope', V(s * len / 2, y, m.z - 0.45), V(s * (sideX(m.z + 2, m.base) - 0.2), m.base + 1.1, m.z + 2.6), 0.02);
                }
            }
            // lifts to the top
            for (const s of [-1, 1]) P.rod('rope', V(s * len / 2, y, m.z - 0.45), V(s * 0.5, Math.min(y + 4, m.top - 0.8), m.z), 0.015);
        });
    }

    // the main yard bears a lantern at each end and a gibbet on the starboard arm
    const main = S.MASTS[1];
    for (const s of [-1, 1]) {
        const x = s * 6.9, y = YARDS.main[0][0];
        P.rod('iron', V(x, y - 0.05, main.z - 0.45), V(x, y - 0.8, main.z - 0.45), 0.012);
        P.sph('lamp', 0.17, x, y - 1.0, main.z - 0.45, 1, 1.35, 1);
        P.cone('iron', 0.2, 0.25, x, y - 0.72, main.z - 0.45, { seg: 6 });
        ctx.lights.push({ x, y: y - 1.0, z: main.z - 0.45, kind: 'lamp' });
    }
    cage(P, ctx, 4.1, YARDS.main[0][0] - 0.1, main.z - 0.45);

    // a spanker between the mizzen, a boom and a gaff, in the ship's midline
    {
        const m = S.MASTS[2];
        const yb = 7.8, yg = 12.3;
        const zM = m.z + 0.45;
        P.rod('hull', V(0, yb, zM - 0.1), V(0, yb + 0.35, zM + 7.3), 0.13, 0.07, 6);
        P.rod('hull', V(0, yg - 1.6, zM - 0.1), V(0, yg + 1.2, zM + 5.7), 0.11, 0.06, 6);
        P.rod('rope', V(0, yb + 0.35, zM + 7.3), V(0, 4.6, 12.0), 0.02);
        const corners = [V(0, yg - 1.5, zM + 0.1), V(0, yg + 1.2, zM + 5.4), V(0, yb + 0.1, zM + 0.1), V(0, yb + 0.35, zM + 7.0)];
        quadSail(ctx, corners, V(1, 0, 0), 0.7, mat('plain'), 2.4, 0.04);
        // the mast hoops
        for (let y = yb + 0.5; y < yg - 1.6; y += 0.9) P.tor('iron', m.r * 0.7, 0.02, 0, y, m.z, { rx: Math.PI / 2, seg: 8 });
    }

    // jibs and a staysail between the bowsprit and the foremast
    {
        const fore = S.MASTS[0], bs = ctx.bowsprit;
        const tip = bs.b, mid = bs.a.clone().lerp(bs.b, 0.55);
        const topF = V(0, fore.top - 3.2, fore.z - 0.3);
        // the stays
        P.rod('rope', V(0, fore.top - 0.6, fore.z - 0.1), tip, 0.03);
        P.rod('rope', V(0, S.MASTS[1].top - 0.6, S.MASTS[1].z - 0.1), V(0, fore.top - 0.5, fore.z - 0.1), 0.03);
        P.rod('rope', V(0, S.MASTS[2].top - 0.6, S.MASTS[2].z - 0.1), V(0, S.MASTS[1].top - 0.8, S.MASTS[1].z - 0.1), 0.03);
        P.rod('rope', V(0, S.MASTS[1].top - 8, S.MASTS[1].z - 0.1), V(0, fore.top - 8.5, fore.z - 0.1), 0.025);
        const jibs = [
            [topF, tip.clone().add(V(0, 0.1, 0)), V(0, 4.3, -S.HL + 2.5), 'plain'],
            [V(0, fore.top - 7.5, fore.z - 0.3), mid.clone().add(V(0, 0.1, 0)), V(0, 4.2, -S.HL + 2.9), 'cross'],
        ];
        jibs.forEach(([A, B, C, kind], i) => quadSail(ctx, [A, A.clone(), B, C], V(1, 0, 0), 0.55, mat(kind), i * 2));
    }

    // the Jolly Roger at the main masthead and a pennant on each of the others, streaming forward
    {
        const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.9 });
        const pennMat = new THREE.MeshStandardMaterial({ map: pennantTexture(), side: THREE.DoubleSide, alphaTest: 0.4, roughness: 0.9 });
        const fwd = V(0, 0, -1), up = V(0, 1, 0);
        const mn = S.MASTS[1];
        P.rod('trim', V(0, mn.top + 1.6, mn.z), V(0, mn.top + 1.6, mn.z - 3.2), 0.03);
        flag(ctx, V(0, mn.top + 1.55, mn.z - 0.1), fwd, up, 3.1, 1.9, flagMat, 0);
        for (const k of [0, 2]) {
            const m = S.MASTS[k];
            flag(ctx, V(0, m.top + 1.0, m.z), fwd, up, 5.2, 0.55, pennMat, k);
        }
        // two long streamers from the stern turrets
        for (const s of [-1, 1]) flag(ctx, V(s * 2.3, S.QUARTER + 7.45, 11.7), V(0, 0, 1), up, 4.0, 0.5, pennMat, s * 2);
    }
    return mastData;
}
