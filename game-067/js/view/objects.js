/**
 * objects.js — draws placed items: one InstancedMesh per item type, rebuilt when the world's
 * objects change. Also the moving bits (windmill sails, the Ferris wheel, the carousel, balloons),
 * boats bobbing on the waves, the "boop" squash when you tap something, lighthouse beams and lamp
 * glows at night, and the translucent ghost that previews a placement.
 */

import * as THREE from 'three';
import { N, LAND_H } from '../config.js';
import { ITEM, footprint } from '../sim/catalog.js';
import { buildItem } from './models.js';
import { toyMat, night } from './materials.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);

export function objCentre(o) {
    const [w, d] = footprint(ITEM[o.type], o.rot);
    return { x: o.x + w / 2 - N / 2, z: o.z + d / 2 - N / 2 };
}

export class ObjectView {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.meshes = new Map();     // type → InstancedMesh
        this.where = new Map();      // object id → { mesh, index, o }
        this.spinners = [];          // { obj, mesh, spin }
        this.bobbers = [];           // { mesh, index, o, amp, phase }
        this.boops = new Map();      // object id → time left
        this.v = -1;

        this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        this.beamGeo = new THREE.ConeGeometry(0.9, 6, 16, 1, true).rotateZ(Math.PI / 2).translate(3, 0, 0);
        this.beams = [];

        const poolTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 64;
            const g = c.getContext('2d');
            const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,220,140,1)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        })();
        this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        this.poolGeo = new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2);
        this.pools = null;

        this.ghost = null;
        this.ghostType = '';
        this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x7af08a, transparent: true, opacity: 0.5, depthWrite: false });
        this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
        this.cursor.renderOrder = 2;
        this.cursor.visible = false;
        scene.add(this.cursor);
    }

    matrixFor(o, extraY = 0, squash = 1) {
        const c = objCentre(o);
        _q.setFromAxisAngle(_Y, (o.rot * Math.PI) / 2);
        _p.set(c.x, LAND_H + extraY, c.z);
        _s.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
        return _m.compose(_p, _q, _s);
    }

    sync(world) {
        if (world.objV === this.v) return;
        this.v = world.objV;
        for (const m of this.meshes.values()) { this.group.remove(m); m.dispose(); }
        this.meshes.clear(); this.where.clear(); this.bobbers = [];
        for (const s of this.spinners) this.group.remove(s.mesh);
        this.spinners = [];
        for (const b of this.beams) this.group.remove(b.mesh);
        this.beams = [];
        const byType = new Map();
        for (const o of world.objs.values()) {
            if (!byType.has(o.type)) byType.set(o.type, []);
            byType.get(o.type).push(o);
        }
        const lampSpots = [];
        for (const [type, list] of byType) {
            const model = buildItem(type);
            const mesh = new THREE.InstancedMesh(model.geo, toyMat, list.length);
            mesh.castShadow = true; mesh.receiveShadow = true;
            list.forEach((o, i) => {
                mesh.setMatrixAt(i, this.matrixFor(o));
                this.where.set(o.id, { mesh, index: i, o });
                if (model.bob) this.bobbers.push({ mesh, index: i, o, amp: model.bob, phase: (o.x * 1.7 + o.z * 2.3) % 6.28 });
                if (model.spin) {
                    const sm = new THREE.Mesh(model.spin.geo, toyMat);
                    sm.castShadow = true;
                    const holder = new THREE.Group();
                    holder.applyMatrix4(this.matrixFor(o));
                    const piv = new THREE.Group();
                    piv.position.set(...model.spin.pivot);
                    piv.add(sm);
                    holder.add(piv);
                    this.group.add(holder);
                    this.spinners.push({ obj: o, mesh: holder, piv, spin: model.spin, phase: o.id * 0.7 });
                }
                if (type === 'lighthouse') {
                    const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
                    const c = objCentre(o);
                    beam.position.set(c.x, LAND_H + 1.5, c.z);
                    this.group.add(beam);
                    this.beams.push({ mesh: beam, phase: o.id });
                }
                if (type === 'lamp' || type === 'signal') { const c = objCentre(o); lampSpots.push([c.x, c.z]); }
            });
            mesh.instanceMatrix.needsUpdate = true;
            this.group.add(mesh);
            this.meshes.set(type, mesh);
        }
        for (let i = 0; i < N * N; i++) if (world.station[i]) lampSpots.push([(i % N) - N / 2 + 0.05, ((i / N) | 0) - N / 2 + 0.85]);
        if (this.pools) { this.group.remove(this.pools); this.pools.dispose(); this.pools = null; }
        if (lampSpots.length) {
            this.pools = new THREE.InstancedMesh(this.poolGeo, this.poolMat, lampSpots.length);
            lampSpots.forEach(([x, z], i) => this.pools.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, LAND_H + 0.012, z)));
            this.pools.renderOrder = 3;
            this.group.add(this.pools);
        }
        this._lastWorldStationV = world.trackV;
    }

    boop(id) { this.boops.set(id, 0.55); }

    update(dt, t) {
        for (const s of this.spinners) {
            if (s.spin.axis === 'bob') { s.piv.position.y = s.spin.pivot[1] + Math.sin(t * 0.8 + s.phase) * 0.12; s.piv.rotation.y += dt * 0.15; }
            else s.piv.rotation[s.spin.axis] += dt * s.spin.speed * (s.fast ? 4 : 1);
        }
        for (const b of this.bobbers) {
            const y = Math.sin(t * 1.6 + b.phase) * b.amp;
            const c = objCentre(b.o);
            _q.setFromEuler(new THREE.Euler(Math.sin(t * 1.3 + b.phase) * 0.06, (b.o.rot * Math.PI) / 2 + Math.sin(t * 0.3 + b.phase) * 0.15, Math.cos(t * 1.1 + b.phase) * 0.05, 'YXZ'));
            _p.set(c.x, LAND_H + y, c.z);
            _s.set(1, 1, 1);
            b.mesh.setMatrixAt(b.index, _m.compose(_p, _q, _s));
            b.mesh.instanceMatrix.needsUpdate = true;
        }
        for (const [id, left] of this.boops) {
            const w = this.where.get(id);
            const l = left - dt;
            if (!w || l <= 0) { this.boops.delete(id); if (w) { w.mesh.setMatrixAt(w.index, this.matrixFor(w.o)); w.mesh.instanceMatrix.needsUpdate = true; } continue; }
            this.boops.set(id, l);
            const k = 1 - l / 0.55;
            const squash = 1 - Math.sin(k * Math.PI * 3) * 0.18 * (1 - k);
            w.mesh.setMatrixAt(w.index, this.matrixFor(w.o, Math.max(0, Math.sin(k * Math.PI)) * 0.12, squash));
            w.mesh.instanceMatrix.needsUpdate = true;
        }
        const n = night.value;
        this.beamMat.opacity = n * 0.22;
        for (const b of this.beams) { b.mesh.rotation.y = t * 0.9 + b.phase; b.mesh.visible = n > 0.05; }
        this.poolMat.opacity = n * 0.8;
        if (this.pools) this.pools.visible = n > 0.05;
    }

    /** Make the windmill (or wheel) at object id spin fast for a while. */
    whirl(id) {
        const s = this.spinners.find((q) => q.obj.id === id);
        if (!s) return;
        s.fast = true;
        clearTimeout(s.tm);
        s.tm = setTimeout(() => { s.fast = false; }, 2500);
    }

    // ------------------------------------------------------------------ previews
    showGhost(type, x, z, rot, ok) {
        if (!type) { this.hideGhost(); return; }
        if (this.ghostType !== type) {
            if (this.ghost) this.scene.remove(this.ghost);
            this.ghost = new THREE.Mesh(buildItem(type).geo, this.ghostMat);
            this.ghost.renderOrder = 5;
            this.scene.add(this.ghost);
            this.ghostType = type;
        }
        const o = { type, x, z, rot };
        this.ghost.matrixAutoUpdate = false;
        this.ghost.matrix.copy(this.matrixFor(o, 0.02));
        this.ghost.visible = true;
        this.ghostMat.color.setHex(ok ? 0x7af08a : 0xff6a5a);
        const [w, d] = footprint(ITEM[type], rot);
        this.showCursor(x, z, w, d, ok ? 0x7af08a : 0xff6a5a);
    }

    hideGhost() { if (this.ghost) this.ghost.visible = false; this.cursor.visible = false; }

    showCursor(x, z, w = 1, d = 1, color = 0xffffff) {
        this.cursor.visible = true;
        this.cursor.position.set(x + w / 2 - N / 2, LAND_H + 0.015, z + d / 2 - N / 2);
        this.cursor.scale.set(w * 0.98, 1, d * 0.98);
        this.cursor.material.color.setHex(color);
    }
    hideCursor() { this.cursor.visible = false; }
}
