/**
 * trainview.js — draws the trains: one mesh per vehicle, placed from the simulation's poses every
 * frame, with a little sway, chimney smoke for steam and diesel engines, and a glowing ring under
 * the train you have selected.
 */

import * as THREE from 'three';
import { LAND_H } from '../config.js';
import { ENGINES } from '../sim/trainsets.js';
import { engineGeo, carGeo, STACK } from './trainmodels.js';
import { toyMat } from './materials.js';

export const RAIL_Y = LAND_H + 0.098;

export class TrainView {
    constructor(scene, fx) {
        this.scene = scene;
        this.fx = fx;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.trains = new Map();   // id → { meshes, smokeT }
        this.poses = [];
        this.selected = 0;
        const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32).rotateX(-Math.PI / 2);
        this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.85, depthWrite: false }));
        this.ring.renderOrder = 4;
        this.ring.visible = false;
        scene.add(this.ring);
    }

    sync(world) {
        const live = new Set();
        for (const t of world.trains.list) {
            live.add(t.id);
            if (this.trains.has(t.id)) continue;
            const d = t.design;
            const meshes = [];
            const eng = new THREE.Mesh(engineGeo(d.engine, d.body, d.trim, d.face), toyMat);
            eng.userData = { kind: 'engine' };
            meshes.push(eng);
            for (const c of d.cars) meshes.push(new THREE.Mesh(carGeo(c.type, c.color), toyMat));
            for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
            this.trains.set(t.id, { meshes, smokeT: 0, phase: t.id * 1.3 });
        }
        for (const [id, v] of this.trains) {
            if (live.has(id)) continue;
            for (const m of v.meshes) this.group.remove(m);
            this.trains.delete(id);
        }
    }

    update(world, dt, t) {
        this.sync(world);
        for (const tr of world.trains.list) {
            const v = this.trains.get(tr.id);
            if (!v) continue;
            const poses = world.trains.poses(tr, this.poses);
            for (const p of poses) {
                const m = p.kind === 'engine' ? v.meshes[0] : v.meshes[p.index + 1];
                if (!m) continue;
                const sway = tr.v > 0.05 ? Math.sin(t * 9 + v.phase + p.index * 1.7) * 0.006 * Math.min(1, tr.v) : 0;
                m.position.set(p.x, RAIL_Y + Math.abs(sway) * 0.6, p.z);
                m.rotation.set(sway, p.yaw, 0, 'YXZ');
                if (p.kind === 'engine') v.enginePose = p;
            }
            // chimney smoke
            const e = ENGINES[tr.design.engine];
            const st = STACK[tr.design.engine];
            if (e.smoke && st && v.enginePose) {
                const rate = tr.state === 'dwell' ? 1.5 : 2 + tr.v * 6;
                v.smokeT -= dt * rate;
                if (v.smokeT <= 0) {
                    v.smokeT += 1;
                    const p = v.enginePose;
                    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
                    this.fx.smoke(p.x + st[0] * c, RAIL_Y + st[1], p.z - st[0] * s, e.smoke, tr.v);
                }
            }
        }
        // selection ring follows the selected train's engine
        const sel = world.trains.get(this.selected);
        const v = sel && this.trains.get(sel.id);
        if (v && v.enginePose) {
            this.ring.visible = true;
            this.ring.position.set(v.enginePose.x, LAND_H + 0.12, v.enginePose.z);
            this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
        } else this.ring.visible = false;
    }

    /** Engine pose of a train (world x, z, yaw) or null. */
    engine(id) {
        const v = this.trains.get(id);
        return v && v.enginePose ? v.enginePose : null;
    }

    whistle(id) {
        const v = this.trains.get(id);
        if (!v || !v.enginePose) return;
        const p = v.enginePose;
        const st = STACK.steam;
        const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
        this.fx.whistle(p.x + st[0] * 0.6 * c, RAIL_Y + 0.55, p.z - st[0] * 0.6 * s);
    }

    /** Train id nearest a screen point (within maxPx), using projected vehicle centres. */
    pick(world, sx, sy, toScreen, maxPx = 36) {
        let best = 0, bd = maxPx * maxPx;
        for (const tr of world.trains.list) {
            const v = this.trains.get(tr.id);
            if (!v) continue;
            for (const m of v.meshes) {
                const p = toScreen(m.position.x, m.position.y + 0.2, m.position.z);
                if (!p) continue;
                const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
                if (d < bd) { bd = d; best = tr.id; }
            }
        }
        return best;
    }
}
