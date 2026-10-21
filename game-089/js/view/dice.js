// Big chunky toon dice. The sim decides the numbers; this only throws a die so that it tumbles,
// bounces twice and settles with that number on top.
//
// Faces: 1 on +y, 6 on −y, 2 on +z, 5 on −z, 3 on +x, 4 on −x (opposite faces add up to 7).

import * as THREE from 'three';
import { toonMat, withOutline, glowMat } from './toon.js';

const FACE_NORMAL = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0] };
const PIPS = {
    1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** A rounded cube: a subdivided box whose corners are pulled toward a sphere. */
function roundedCube(s = 1, r = 0.22, seg = 6) {
    const g = new THREE.BoxGeometry(s, s, s, seg, seg, seg);
    const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    const h = s / 2 - r;
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
        const d = v.clone().sub(c);
        if (d.lengthSq() > 1e-8) v.copy(c).add(d.normalize().multiplyScalar(r));
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

export function buildDie(color = '#fffaf0', pip = '#2a1a3a', oneColor = '#e83a3a') {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(roundedCube(1, 0.2, 5), toonMat({ color }));
    body.castShadow = true;
    withOutline(body, 0.035);
    grp.add(body);
    const pipGeo = new THREE.SphereGeometry(0.085, 10, 8);
    pipGeo.scale(1, 1, 0.35);
    for (const [n, list] of Object.entries(PIPS)) {
        const [nx, ny, nz] = FACE_NORMAL[n];
        const normal = new THREE.Vector3(nx, ny, nz);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        const mat = new THREE.MeshBasicMaterial({ color: n === '1' ? oneColor : pip });
        for (const [a, b] of list) {
            const m = new THREE.Mesh(n === '1' ? new THREE.SphereGeometry(0.15, 12, 10).scale(1, 1, 0.3) : pipGeo, mat);
            const local = new THREE.Vector3(a * 0.25, b * 0.25, 0.5);
            local.applyQuaternion(q);
            m.position.copy(local);
            m.quaternion.copy(q);
            grp.add(m);
        }
    }
    return grp;
}

/** The orientation that puts face n on top, turned by yaw. */
function restFor(n, yaw) {
    const [nx, ny, nz] = FACE_NORMAL[n];
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(nx, ny, nz), new THREE.Vector3(0, 1, 0));
    const y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return y.multiply(q);
}

/**
 * Dice that live in a scene. throw(values, from, to) starts them; update(dt) animates; `done` is
 * true once they have settled. A glow ring flashes under doubles.
 */
export class DiceTray {
    constructor(scene) {
        this.scene = scene;
        this.dice = [];
        this.active = false;
        this.t = 0;
        this.done = true;
        this.onLand = null;
    }

    ensure(n) {
        while (this.dice.length < n) {
            const d = buildDie();
            d.visible = false;
            this.scene.add(d);
            this.dice.push({ obj: d });
        }
    }

    /** values: [a, b(, c)], at: a Vector3 to land round, facing: a yaw toward the camera. */
    throw(values, at, yaw = 0, speed = 1) {
        this.ensure(values.length);
        this.t = 0;
        this.dur = 1.15 / speed;
        this.done = false;
        this.active = true;
        this.landed = 0;
        this.dice.forEach((d, i) => { d.obj.visible = i < values.length; });
        values.forEach((v, i) => {
            const d = this.dice[i];
            const side = (i - (values.length - 1) / 2) * 1.5;
            const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            d.end = at.clone().add(right.clone().multiplyScalar(side)).add(new THREE.Vector3(0, 0.5, 0));
            d.start = d.end.clone().add(back.clone().multiplyScalar(5)).add(right.clone().multiplyScalar(side * 0.6 + (Math.random() - 0.5))).add(new THREE.Vector3(0, 4.5, 0));
            d.rest = restFor(v, yaw + (Math.random() - 0.5) * 0.5);
            d.axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            d.spins = 2 + Math.floor(Math.random() * 2);
            d.value = v;
        });
    }

    hide() { for (const d of this.dice) d.obj.visible = false; this.active = false; this.done = true; }

    update(dt) {
        if (!this.active) return;
        this.t += dt;
        const u = Math.min(1, this.t / this.dur);
        for (const d of this.dice) {
            if (!d.obj.visible || !d.end) continue;
            // flight, then two shrinking bounces
            const p = d.start.clone().lerp(d.end, Math.min(1, u * 1.35));
            let y;
            if (u < 0.55) { const k = u / 0.55; y = d.start.y + (d.end.y - d.start.y) * k * k; }
            else if (u < 0.8) { const k = (u - 0.55) / 0.25; y = d.end.y + Math.sin(k * Math.PI) * 0.9; }
            else { const k = (u - 0.8) / 0.2; y = d.end.y + Math.sin(k * Math.PI) * 0.25; }
            p.y = y;
            d.obj.position.copy(p);
            const spin = (1 - Math.pow(u, 0.6)) * d.spins * Math.PI * 2;
            const q = new THREE.Quaternion().setFromAxisAngle(d.axis, spin);
            d.obj.quaternion.copy(q.multiply(d.rest));
            if (u > 0.55 && !d.bounced) { d.bounced = true; this.onBounce?.(d); }
        }
        if (u >= 1 && !this.done) {
            this.done = true;
            for (const d of this.dice) d.bounced = false;
            this.onLand?.();
        }
    }
}

export { glowMat };
