// Cables: a tube along a sagging curve, a coloured plug at each end, and a cut with bare copper
// when the cable is severed. The tube is rebuilt in place (no allocation) when an end moves.

import * as THREE from 'three';
import { mat, colorMat } from './kit.js';
import * as TX from './textures.js';

const N = 40, R = 6;
const UP = new THREE.Vector3(0, 1, 0);
const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), bi: new THREE.Vector3(), u: new THREE.Vector3() };

export class WireView {
    constructor(wire) {
        this.id = wire.id;
        this.hex = wire.hex;
        this.group = new THREE.Group();
        this.len = wire.len;
        const radius = wire.kind === 'pwr' || wire.kind === 'gnd' ? 0.085 : 0.065;
        this.radius = radius;
        this.mat = new THREE.MeshStandardMaterial({ color: wire.hex, roughness: 0.5, metalness: 0.05, emissive: wire.hex, emissiveIntensity: 0, side: THREE.DoubleSide });
        const pos = new Float32Array(N * R * 3), nor = new Float32Array(N * R * 3);
        const idx = [];
        for (let i = 0; i < N - 1; i++) for (let j = 0; j < R; j++) {
            const a = i * R + j, b = i * R + ((j + 1) % R), c = (i + 1) * R + j, d = (i + 1) * R + ((j + 1) % R);
            idx.push(a, c, b, b, c, d);
        }
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        this.geo.setIndex(idx);
        this.tube = new THREE.Mesh(this.geo, this.mat);
        this.tube.frustumCulled = false; this.tube.castShadow = true; this.tube.userData.ref = `wire:${wire.id}`;
        this.group.add(this.tube);
        this.plugs = [0, 1].map((e) => this.makePlug(wire, e));
        this.plugs.forEach((p) => this.group.add(p.g));
        // the cut: two bare copper stubs, and a solder blob when it is joined
        this.cutG = new THREE.Group();
        this.stubs = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), mat('copperWire')); m.userData.ref = `cut:${wire.id}`; this.cutG.add(m); return m; });
        this.blob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mat('solder'));
        this.blob.scale.set(1.5, 0.9, 1); this.blob.visible = false; this.cutG.add(this.blob);
        this.cutGlow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.cutGlow.userData.noPick = true; this.cutG.add(this.cutGlow);
        this.hit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
        this.hit.userData.ref = `cut:${wire.id}`; this.cutG.add(this.hit);
        this.group.add(this.cutG);
        this.key = '';
        this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
        this.samples = Array.from({ length: N }, () => new THREE.Vector3());
        this.lit = 0;
    }

    makePlug(wire, e) {
        const g = new THREE.Group();
        const bodyM = colorMat(wire.hex, { metalness: 0.1, roughness: 0.4, emissive: wire.hex, emissiveIntensity: 0.12 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), bodyM);
        body.position.y = 0.3;
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.4), mat('plasticBlack'));
        collar.position.y = 0.13;
        const pins = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), mat('brass'));
        pins.position.y = 0.04;
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.tagTex(wire.tag, wire.hex), transparent: true, depthTest: true, depthWrite: false }));
        tag.scale.set(0.3, 0.3, 1); tag.position.y = 0.72; tag.renderOrder = 15; tag.userData.noPick = true;
        const ref = `plug:${wire.id}.${e}`;
        for (const m of [body, collar, pins]) { m.userData.ref = ref; m.castShadow = true; }
        g.add(body, collar, pins, tag);
        g.userData.ref = ref;
        return { g, body, tag };
    }

    /** a, b: end positions (plug base). loose: whether each end lies on the bench. */
    update(wire, a, b, looseA, looseB, t, st) {
        const key = `${a[0].toFixed(2)},${a[1].toFixed(2)},${a[2].toFixed(2)}|${b[0].toFixed(2)},${b[1].toFixed(2)},${b[2].toFixed(2)}|${wire.cut ? wire.cut.done : 'x'}`;
        // plugs
        const ends = [[a, looseA], [b, looseB]];
        ends.forEach(([p, loose], e) => {
            const pl = this.plugs[e];
            const other = e === 0 ? b : a;
            if (!loose) {
                pl.g.position.set(p[0], p[1], p[2]); pl.g.rotation.set(0, 0, 0);
                pl.tag.visible = true;
            } else {
                const ang = Math.atan2(other[0] - p[0], other[2] - p[2]);
                const carried = p[1] > 0.5;
                pl.g.position.set(p[0], carried ? p[1] : 0.2, p[2]);
                pl.g.rotation.set(carried ? -0.5 : -Math.PI / 2, ang, 0, 'YXZ');
                pl.tag.visible = true;
            }
        });
        if (key !== this.key) {
            this.key = key;
            this.rebuild(wire, a, b, looseA, looseB);
        }
        this.mat.emissiveIntensity = this.lit * (0.8 + Math.sin(t * 14) * 0.2);
        this.plugs.forEach((p) => { p.body.material.emissiveIntensity = 0.12 + this.lit * 0.9; });
        // the cut
        const cut = wire.cut;
        this.cutG.visible = !!cut;
        if (cut) {
            const i0 = Math.round(cut.t * (N - 1));
            const s0 = this.samples[Math.max(0, i0 - 2)], s1 = this.samples[Math.min(N - 1, i0 + 3)], mid = this.samples[i0];
            this.stubs[0].visible = this.stubs[1].visible = !cut.done;
            this.stubs[0].position.copy(s0); this.stubs[1].position.copy(s1);
            this.stubs[0].lookAt(mid); this.stubs[1].lookAt(mid);
            this.stubs[0].rotateX(Math.PI / 2); this.stubs[1].rotateX(Math.PI / 2);
            this.blob.position.copy(mid);
            this.blob.visible = cut.done || cut.prog > 0.02;
            const k = cut.done ? 1 : 0.35 + cut.prog * 0.65;
            this.blob.scale.set(1.5 * k, 0.9 * k, 1 * k);
            this.blob.material = cut.done ? mat('solder') : colorMat(0x8b8e96, { metalness: 0.8, roughness: 0.4 });
            this.cutGlow.position.copy(mid);
            this.cutGlow.material.opacity = Math.min(1, cut.heat || 0) * 0.9;
            this.cutGlow.material.color.setHSL(0.07 - Math.min(1, cut.heat || 0) * 0.05, 1, 0.5);
            this.hit.position.copy(mid);
            this.hit.userData.ref = cut.done ? `wire:${wire.id}` : `cut:${wire.id}`;
            this.hit.visible = !cut.done;
        }
    }

    rebuild(wire, a, b, looseA, looseB) {
        const pa = tmp.a.set(a[0], a[1] + (looseA ? 0.22 : 0.62), a[2]);
        const pb = tmp.b.set(b[0], b[1] + (looseB ? 0.22 : 0.62), b[2]);
        const dist = pa.distanceTo(pb);
        const slack = Math.max(0, wire.len - dist);
        const arch = Math.min(2.2, 0.45 + slack * 0.2);
        const pts = this.curve.points;
        pts[0].copy(pa);
        pts[1].set(pa.x + (pb.x - pa.x) * 0.12, pa.y + (looseA ? 0.2 : 0.55), pa.z + (pb.z - pa.z) * 0.12);
        pts[2].set((pa.x + pb.x) / 2, Math.max(pa.y, pb.y) * 0.6 + (pa.y + pb.y) * 0.2 + arch, (pa.z + pb.z) / 2);
        pts[3].set(pb.x + (pa.x - pb.x) * 0.12, pb.y + (looseB ? 0.2 : 0.55), pb.z + (pa.z - pb.z) * 0.12);
        pts[4].copy(pb);
        // a loose cable settles on the bench instead of arching
        if (looseA || looseB) {
            const lowest = looseA && looseB ? 0.2 : 0.3;
            pts[2].y = Math.max(lowest, pts[2].y * (looseA && looseB ? 0.2 : 0.7));
        }
        this.curve.updateArcLengths();
        for (let i = 0; i < N; i++) { this.curve.getPoint(i / (N - 1), this.samples[i]); if (this.samples[i].y < 0.1) this.samples[i].y = 0.1; }
        const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array;
        const cut = wire.cut;
        const i0 = cut ? Math.round(cut.t * (N - 1)) : -9;
        for (let i = 0; i < N; i++) {
            const p = this.samples[i];
            const p0 = this.samples[Math.max(0, i - 1)], p1 = this.samples[Math.min(N - 1, i + 1)];
            tmp.t.subVectors(p1, p0).normalize();
            tmp.u.copy(Math.abs(tmp.t.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP);
            tmp.n.copy(tmp.u).addScaledVector(tmp.t, -tmp.u.dot(tmp.t)).normalize();
            tmp.bi.crossVectors(tmp.t, tmp.n);
            const r = cut && !cut.done && (i === i0 || i === i0 + 1) ? 0.0001 : this.radius;
            for (let j = 0; j < R; j++) {
                const th = (j / R) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
                const nx = tmp.n.x * c + tmp.bi.x * s, ny = tmp.n.y * c + tmp.bi.y * s, nz = tmp.n.z * c + tmp.bi.z * s;
                const o = (i * R + j) * 3;
                pos[o] = p.x + nx * r; pos[o + 1] = p.y + ny * r; pos[o + 2] = p.z + nz * r;
                nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
            }
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.normal.needsUpdate = true;
        this.geo.computeBoundingSphere();
    }
}
