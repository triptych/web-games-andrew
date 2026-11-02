// A toy submarine, brass and buttercup yellow, about as long as your arm,
// pottering round and round the pool of the Moon Fountain. Click it and you
// climb in through its hatch (main.js does the climbing; undersea.js is the
// sea inside). It stops for you, sinks while you are below, and bobs back up
// when you come out.

import * as THREE from 'three';
import { damp, TAU } from './util.js';

const R_ORBIT = 2.3;   // its circle round the fountain's column
const SPIN = 0.22;     // radians a second round that circle

/** The model: about 0.9 m long, nose along +x, the waterline at y = 0. */
export function makeSubmarine() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xf2b822, roughness: 0.38, metalness: 0.2 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.3, metalness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x6fd8ff, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.1 });
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        g.add(m);
        return m;
    };
    add(new THREE.CapsuleGeometry(0.17, 0.5, 8, 20).rotateZ(Math.PI / 2), hull);
    // the big round window in the nose, and its brass rim
    add(new THREE.SphereGeometry(0.13, 18, 10, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2), glass, 0.36);
    add(new THREE.TorusGeometry(0.132, 0.014, 8, 28).rotateY(Math.PI / 2), brass, 0.36);
    for (const x of [0.2, -0.16]) add(new THREE.TorusGeometry(0.172, 0.01, 6, 28).rotateY(Math.PI / 2), brass, x);
    // the conning tower, its hatch and the periscope
    const tower = add(new THREE.CylinderGeometry(0.075, 0.09, 0.16, 18), hull, 0.02, 0.2);
    tower.scale.z = 0.75;
    add(new THREE.CylinderGeometry(0.06, 0.066, 0.025, 18), brass, 0.02, 0.29);
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 8), brass, 0.06, 0.36);
    add(new THREE.BoxGeometry(0.06, 0.026, 0.026), brass, 0.08, 0.445);
    // little side portholes
    for (const x of [0.1, -0.06]) for (const z of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 14).rotateX(Math.PI / 2), glass, x, 0.03, z * 0.162);
        add(new THREE.TorusGeometry(0.038, 0.008, 6, 16), brass, x, 0.03, z * 0.168);
    }
    // fins and dive planes
    add(new THREE.BoxGeometry(0.12, 0.15, 0.012), hull, -0.4, 0.08);
    add(new THREE.BoxGeometry(0.12, 0.012, 0.3), hull, -0.4);
    add(new THREE.BoxGeometry(0.06, 0.01, 0.38), brass, 0.22, -0.03);
    // the propeller
    const prop = new THREE.Group();
    prop.position.x = -0.48;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), brass);
    prop.add(hub);
    for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.09, 0.035), brass);
        b.position.y = 0.05;
        b.rotation.y = 0.5;
        const arm = new THREE.Group();
        arm.rotation.x = (k / 3) * TAU;
        arm.add(b);
        prop.add(arm);
    }
    g.add(prop);
    g.userData = { prop, glass };
    return g;
}

export class FountainSub {
    constructor(world) {
        const f = world.fountains[0];
        this.ok = !!f;
        if (!f) return;
        this.f = f;
        this.a = Math.random() * TAU;
        this.spd = 1;
        this.sink = 0;
        this.state = 'circle';   // circle | board (waiting for you) | under (you are below) | rise
        this.group = new THREE.Group();
        this.model = makeSubmarine();
        this.group.add(this.model);
        world.root.add(this.group);

        // where you stand to climb in: on the rim, between two benches, on the side nearest the hub
        const toHub = Math.atan2(-f.x, -f.z);
        let best = 0, bd = Infinity;
        for (let b = 0; b < 4; b++) {
            const a = 0.4 + Math.PI / 4 + (b * Math.PI) / 2;
            const d = Math.abs(Math.atan2(Math.sin(a - toHub), Math.cos(a - toHub)));
            if (d < bd) {
                bd = d;
                best = a;
            }
        }
        const sx = f.x + Math.sin(best) * 4.35, sz = f.z + Math.cos(best) * 4.35;
        this.stand = { x: sx, z: sz, yaw: Math.atan2(-(f.x - sx), -(f.z - sz)) };
        this.update(0, 0, 0);
    }

    /** Stop and wait for you to climb in. */
    board() {
        if (this.ok) this.state = 'board';
    }

    /** You are aboard: it slips under. */
    submerge() {
        if (!this.ok) return;
        this.state = 'under';
        this.sink = 1;
    }

    /** You are back: it bobs up and carries on. */
    surface() {
        if (!this.ok) return;
        this.state = 'rise';
        this.sink = 1;
    }

    /** The hatch on top of the conning tower, in world space. */
    hatch(out = new THREE.Vector3()) {
        this.model.updateWorldMatrix(true, false);
        return this.model.localToWorld(out.set(0.02, 0.3, 0));
    }

    update(dt, t, night) {
        if (!this.ok) return;
        const going = this.state === 'circle' || this.state === 'rise';
        this.spd = damp(this.spd, going ? 1 : 0, 1.6, dt);
        this.a += SPIN * this.spd * dt;
        if (this.state === 'rise') {
            this.sink = Math.max(0, this.sink - dt * 0.5);
            if (this.sink === 0) this.state = 'circle';
        }
        const f = this.f, s = this.sink;
        const e = s * s * (3 - 2 * s);
        this.group.position.set(f.x + Math.sin(this.a) * R_ORBIT, f.poolY - 0.06 - e * 0.5 + Math.sin(t * 1.6) * 0.015 * (1 - e), f.z + Math.cos(this.a) * R_ORBIT);
        this.group.rotation.set(Math.sin(t * 1.3) * 0.04, this.a, Math.sin(t * 0.9) * 0.02 + (this.state === 'rise' ? e * 0.3 : 0), 'YXZ');
        this.group.visible = this.state !== 'under';
        const u = this.model.userData;
        u.prop.rotation.x += dt * (3 + this.spd * 14);
        u.glass.emissiveIntensity = 0.4 + night * 2.6;
    }
}
