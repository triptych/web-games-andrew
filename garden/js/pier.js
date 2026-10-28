// The fishing pier: a plank deck on pilings, out from the shore on the far
// side of the island from the dock, with a railed platform at its end where a
// rod waits in a holder on the rail (the fishing itself is in fishing.js).
// terrain.js lays out the trail down to it and where it stands.

import * as THREE from 'three';
import { xf, under } from './materials.js';
import { signMesh, signTexture } from './architecture.js';

const HALF = 1.2;                    // half the width of the walkway
const PLAT = 5, PLAT_HALF = 2.5;     // the platform at the end: length and half width
const RAIL_H = 1.0;

export function buildPier(world, batch) {
    const p = world.layout.pier;
    const { ax, az, ay, dx, dz, length: len } = p;
    const yaw = Math.atan2(dx, dz);
    // pier coordinates: lz runs out to sea from the shore end, lx across (+x is on your left looking out)
    const toW = (lx, lz) => ({ x: ax + dx * lz + dz * lx, z: az + dz * lz - dx * lx });
    const deckY = (d) => Math.max(p.y, ay - d * p.slope);
    const pitch = (d) => (ay - d * p.slope > p.y ? Math.atan(p.slope) : 0);
    const base = xf(ax, 0, az, yaw);
    const at = (lx, y, lz, ry = 0, rx = 0, rz = 0) => under(base, xf(lx, y, lz, ry, 1, 1, 1, rx, rz));
    const platZ = len - PLAT;
    const halfAt = (d) => (d > platZ ? PLAT_HALF : HALF);

    world.spans.push({ ax, az, bx: p.bx, bz: p.bz, half: HALF, heightAt: (t) => deckY(t * len) });
    const pa = toW(0, platZ);
    world.spans.push({ ax: pa.x, az: pa.z, bx: p.bx, bz: p.bz, half: PLAT_HALF, heightAt: () => p.y });

    // planks across, two stringers under them
    for (let d = 0.17; d < len; d += 0.34) {
        const h = halfAt(d);
        batch.add(Math.floor(d / 0.34) % 5 === 2 ? 'darkWood' : 'wood', new THREE.BoxGeometry(h * 2 + 0.1, 0.07, 0.3), at(0, deckY(d) - 0.035, d, 0, pitch(d)));
    }
    for (let d = 0.5; d < len; d += 1) {
        for (const sd of [-1, 1]) {
            for (const off of d > platZ ? [HALF - 0.15, PLAT_HALF - 0.15] : [HALF - 0.15]) {
                batch.add('darkWood', new THREE.BoxGeometry(0.14, 0.22, 1.02), at(sd * off, deckY(d) - 0.18, d, 0, pitch(d)));
            }
        }
    }
    // pilings down to the sea bed (or into the bank near the shore)
    const piling = (lx, lz) => {
        const w = toW(lx, lz);
        const top = deckY(lz) - 0.1, bottom = world.groundAt(w.x, w.z) - 0.6;
        if (top - bottom < 0.4) return;
        batch.add('darkWood', new THREE.CylinderGeometry(0.14, 0.17, top - bottom, 8), at(lx, (top + bottom) / 2, lz));
    };
    for (let d = 2; d < platZ; d += 2.5) for (const sd of [-1, 1]) piling(sd * (HALF + 0.05), d);
    for (const lz of [platZ + 0.15, platZ + PLAT / 2, len - 0.15]) for (const sd of [-1, 1]) piling(sd * (PLAT_HALF + 0.05), lz);

    // a rail all the way round, open only at the shore end
    const rail = [[-HALF, 0.8], [-HALF, platZ], [-PLAT_HALF, platZ], [-PLAT_HALF, len], [PLAT_HALF, len], [PLAT_HALF, platZ], [HALF, platZ], [HALF, 0.8]];
    for (let i = 0; i < rail.length - 1; i++) {
        const [x0, z0] = rail[i], [x1, z1] = rail[i + 1];
        const seg = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.ceil(seg / 1.6));
        const ry = Math.atan2(x1 - x0, z1 - z0);
        for (let k = 0; k <= n; k++) {
            const lx = x0 + ((x1 - x0) * k) / n, lz = z0 + ((z1 - z0) * k) / n;
            const y = deckY(lz);
            batch.add('darkWood', new THREE.BoxGeometry(0.12, RAIL_H + 0.1, 0.12), at(lx, y + RAIL_H / 2 - 0.05, lz));
            if (k === n) continue;
            const mx = x0 + ((x1 - x0) * (k + 0.5)) / n, mz = z0 + ((z1 - z0) * (k + 0.5)) / n;
            const l = seg / n, rise = deckY(z0 + ((z1 - z0) * (k + 1)) / n) - y;
            const tilt = Math.atan2(-rise, l);
            for (const ry0 of [RAIL_H, RAIL_H * 0.5]) {
                batch.add(ry0 === RAIL_H ? 'wood' : 'darkWood', new THREE.BoxGeometry(ry0 === RAIL_H ? 0.16 : 0.06, ry0 === RAIL_H ? 0.07 : 0.06, Math.hypot(l, rise) + 0.04), at(mx, deckY(mz) + ry0, mz, ry, tilt));
            }
        }
        for (let s = 0; s <= seg; s += 0.45) {
            const w = toW(x0 + ((x1 - x0) * s) / seg, z0 + ((z1 - z0) * s) / seg);
            world.colliders.push({ x: w.x, z: w.z, r: 0.16 });
        }
    }

    // the rod holder: an iron tube clamped to the end rail right of centre, the rod leaning out to sea
    const rest = { lx: -0.95, y: p.y + 0.45, lz: len - 0.2, tilt: 0.7, roll: 0.2 };
    batch.add('iron', new THREE.CylinderGeometry(0.045, 0.04, 0.42, 8).translate(0, 0.21, 0), at(rest.lx, rest.y - 0.1, rest.lz, 0, rest.tilt, rest.roll));
    batch.add('iron', new THREE.BoxGeometry(0.16, 0.06, 0.16), at(rest.lx, rest.y - 0.1, rest.lz));
    // a tackle crate and a bait bucket on the platform, over on the left
    batch.add('darkWood', new THREE.BoxGeometry(0.7, 0.42, 0.45), at(PLAT_HALF - 0.55, p.y + 0.21, len - 1.0, -0.2));
    batch.add('wood', new THREE.BoxGeometry(0.74, 0.05, 0.49), at(PLAT_HALF - 0.55, p.y + 0.43, len - 1.0, -0.2));
    batch.add('iron', new THREE.CylinderGeometry(0.2, 0.16, 0.36, 12, 1, true), at(PLAT_HALF - 0.5, p.y + 0.18, platZ + 0.7));
    batch.add('iron', new THREE.TorusGeometry(0.19, 0.012, 4, 14, Math.PI), at(PLAT_HALF - 0.5, p.y + 0.36, platZ + 0.7, 0.6));
    for (const [lx, lz] of [[PLAT_HALF - 0.55, len - 1.0], [PLAT_HALF - 0.5, platZ + 0.7]]) {
        const w = toW(lx, lz);
        world.colliders.push({ x: w.x, z: w.z, r: 0.4 });
    }

    // lanterns at the two far corners and one where the deck leaves the shore
    for (const sd of [-1, 1]) {
        const w = toW(sd * (PLAT_HALF - 0.32), len - 0.32);
        world.lampSpots.push({ x: w.x, z: w.z, y: p.y });
    }
    const lw = toW(-(HALF + 0.8), -0.6);
    world.lampSpots.push({ x: lw.x, z: lw.z });

    // a sign at the shore end, facing the walker coming down the trail
    const sw = toW(HALF + 1.1, -0.9);
    const gy = world.groundAt(sw.x, sw.z);
    for (const sd of [-1, 1]) batch.add('darkWood', new THREE.BoxGeometry(0.1, 2.0, 0.1), at(HALF + 1.1 + sd * 0.62, gy + 0.85, -0.9));
    world.colliders.push({ x: sw.x, z: sw.z, r: 0.75 });
    const sign = signMesh(signTexture('🎣', 'The Fishing Pier', 'Cast a line from the end', '#7fd6e8', 1024, 256), 1.4, 0.35, 0.3);
    sign.position.set(sw.x, gy + 1.55, sw.z);
    sign.rotation.y = yaw + Math.PI;
    world.root.add(sign);
    world.nightSigns.push(sign.userData.nightGlow);

    const stand = toW(0, len - 1.3);
    const pier = {
        ...p, toW, deckY, platZ, half: HALF, platHalf: PLAT_HALF, rest,
        // the camera looks along -z at yaw 0, so this yaw faces out to sea
        stand: { x: stand.x, z: stand.z, yaw: Math.atan2(-dx, -dz) },
        // across the pier (its local +x)
        rx: dz, rz: -dx,
    };
    // (its map label goes past the end, clear of the path's own label)
    const tip = toW(0, len + 3);
    world.landmarks.push({ name: 'The Fishing Pier', x: tip.x, z: tip.z, stand: pier.stand });
    return pier;
}
