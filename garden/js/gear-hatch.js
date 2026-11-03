// The trap door behind the Great Gear: an iron hatch in a stone collar on the
// far side of the gear from the hub, where you only find it if you go round.
// A gear is cast in its lid. It lifts on its hinge as you come near, showing
// the top of a ladder going down and a cold glow at the bottom; step onto it
// (or click it) and you climb down into the long hall under Gearfall
// (gearfall.js). Registers itself on `world` as `gearHatch`.

import * as THREE from 'three';
import { gearShape } from './architecture.js';
import { damp } from './util.js';

const S = 1.3;   // the opening, a side

export function buildGearHatch(world, f) {
    const L = Math.hypot(f.x, f.z) || 1;
    const ux = f.x / L, uz = f.z / L;               // away from the hub
    const D = 3.6;
    const x = f.x + ux * D, z = f.z + uz * D;
    const y = world.groundAt(x, z);
    const yaw = Math.atan2(ux, uz);                  // the group's +z points away from the hub
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const m = world.mats;
    const stone = m.granite ?? m.stone ?? new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.9 });
    const iron = m.iron ?? new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.6, metalness: 0.7 });
    const bronze = m.bronze ?? iron;
    // the collar, deep enough to sit into a slope
    for (const [w, d, px, pz] of [[S + 0.7, 0.35, 0, -(S / 2 + 0.175)], [S + 0.7, 0.35, 0, S / 2 + 0.175], [0.35, S, -(S / 2 + 0.175), 0], [0.35, S, S / 2 + 0.175, 0]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), stone);
        b.position.set(px, -0.3, pz);
        b.castShadow = b.receiveShadow = true;
        g.add(b);
    }
    // the opening: the terrain runs under the collar, so the shaft is drawn as a dark well
    // on top of it, black at the edges with a cold glow far down, and the ladder's top poking out
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const cx = c.getContext('2d');
    cx.fillStyle = '#020302';
    cx.fillRect(0, 0, 128, 128);
    const gr = cx.createRadialGradient(64, 70, 4, 64, 70, 46);
    gr.addColorStop(0, 'rgba(90, 255, 200, 0.85)');
    gr.addColorStop(0.35, 'rgba(40, 140, 110, 0.45)');
    gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 128, 128);
    cx.strokeStyle = 'rgba(40, 40, 40, 0.9)';
    cx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
        const y = 20 + k * 16, w = 22 - k * 2.4;
        cx.beginPath();
        cx.moveTo(64 - w, y);
        cx.lineTo(64 + w, y);
        cx.stroke();
    }
    const holeTex = new THREE.CanvasTexture(c);
    holeTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: holeTex, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -4 }));
    glow.position.y = 0.13;
    g.add(glow);
    for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), iron);
        rail.position.set(s * 0.25, 0.4, -S / 2 + 0.12);
        g.add(rail);
    }
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), iron);
    rung.position.set(0, 0.45, -S / 2 + 0.12);
    g.add(rung);
    // the lid, hinged on the far edge, a gear cast in it
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.16, S / 2);
    g.add(hinge);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(S + 0.1, 0.08, S + 0.1), iron);
    lid.position.set(0, 0, -(S + 0.1) / 2);
    lid.castShadow = true;
    hinge.add(lid);
    const emb = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.42, 12, 0.08, 0.1), { depth: 0.04, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2), bronze);
    emb.position.set(0, 0.04, -(S + 0.1) / 2);
    hinge.add(emb);
    for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, S), iron);
        bar.position.set(s * 0.5, 0.05, -(S + 0.1) / 2);
        hinge.add(bar);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 14).rotateX(Math.PI / 2), bronze);
    ring.position.set(0, 0.06, -S - 0.02);
    hinge.add(ring);
    // a target for the pointer
    const hit = new THREE.Mesh(new THREE.BoxGeometry(S + 0.8, 0.9, S + 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.3;
    hit.userData.kind = 'gearHatch';
    g.add(hit);
    world.root.add(g);
    g.updateMatrixWorld(true);

    const hatch = {
        x, y, z, yaw, hit, group: g, near: 0, open: 0.12,
        // walk up from the gear's side, and come back out beside it facing the gear
        front: { x: x - ux * 2.2, z: z - uz * 2.2 },
        out: { x: x - ux * 1.7 + uz * 0.9, z: z - uz * 1.7 - ux * 0.9, yaw: Math.atan2(ux, uz) },
    };
    let last = null;
    world.updaters.push((t) => {
        const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
        last = t;
        const want = hatch.near > 0.05 ? 1.75 : 0.12 + Math.sin(t * 0.7) * 0.02;
        hatch.open = damp(hatch.open, want, 2.5, dt);
        hinge.rotation.x = hatch.open;
        const k = 0.85 + 0.15 * Math.sin(t * 1.3);
        glow.material.color.setRGB(k, k, k);
    });
    world.gearHatch = hatch;
    return hatch;
}

/** True while (x, z) is over the opening. */
export function onHatch(h, x, z) {
    return Math.hypot(x - h.x, z - h.z) < 0.55;
}
