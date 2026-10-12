// Things that move through the rock: the Gloamwyrm, its orbs, gloam-wisps and falling boulders.

import * as THREE from 'three';
import { WYRM_SEGS, WYRM_SPACING } from '../sim/boss.js';
import { glowCanvas } from './textures.js';

export class Actors {
    constructor(scene) {
        this.scene = scene;
        const glowTex = new THREE.CanvasTexture(glowCanvas(64));
        this.glowTex = glowTex;

        // --- Wyrm body: instanced scaled icosahedra ---
        this.segMat = new THREE.MeshStandardMaterial({ color: 0x3a1a5a, roughness: 0.4, metalness: 0.3, emissive: 0x4a1080, emissiveIntensity: 0.8 });
        this.segs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.segMat, WYRM_SEGS);
        this.segs.frustumCulled = false;
        this.segs.visible = false;
        scene.add(this.segs);
        // fins along the back
        this.finMat = new THREE.MeshStandardMaterial({ color: 0x8a40ff, emissive: 0x6020c0, emissiveIntensity: 1, side: THREE.DoubleSide });
        this.fins = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.5, 4), this.finMat, WYRM_SEGS);
        this.fins.frustumCulled = false;
        this.fins.visible = false;
        scene.add(this.fins);

        // head
        const head = new THREE.Group();
        this.headMat = new THREE.MeshStandardMaterial({ color: 0x2a1040, roughness: 0.35, metalness: 0.3, emissive: 0x5010a0, emissiveIntensity: 0.9 });
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), this.headMat);
        skull.scale.set(1.25, 0.85, 0.9);
        head.add(skull);
        const snout = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 10), this.headMat);
        snout.rotation.z = -Math.PI / 2; snout.position.x = 1.0; snout.scale.set(1, 1, 0.7);
        head.add(snout);
        this.jaw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 8), this.headMat);
        this.jaw.rotation.z = -Math.PI / 2; this.jaw.position.set(0.8, -0.35, 0);
        head.add(this.jaw);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 });
        this.hornMat = hornMat;
        for (const z of [-0.35, 0.35]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 7), hornMat);
            horn.position.set(-0.4, 0.75, z); horn.rotation.z = 0.9;
            head.add(horn);
        }
        this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff40a0 });
        for (const z of [-0.42, 0.42]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.eyeMat);
            eye.position.set(0.55, 0.2, z);
            head.add(eye);
        }
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xa040ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
        halo.scale.setScalar(3.5);
        head.add(halo);
        this.headHalo = halo;
        head.visible = false;
        scene.add(head);
        this.head = head;
        this.wyrmLight = new THREE.PointLight(0xa040ff, 4, 9, 1.5);
        scene.add(this.wyrmLight);
        this.wyrmLight.visible = false;

        // orbs and wisps: sprite pools
        this.orbs = this._pool(24, 0xd060ff, 0.9);
        this.wisps = this._pool(12, 0x80c0ff, 1.3);
        this.wispCores = this._pool(12, 0xffffff, 0.35);

        // falling boulders
        this.boulderMat = new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 0.95 });
        this.boulders = [];
        for (let i = 0; i < 6; i++) {
            const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), this.boulderMat);
            b.visible = false;
            scene.add(b);
            this.boulders.push(b);
        }
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
        this.gold = 0;
    }

    _pool(n, col, size) {
        const arr = [];
        for (let i = 0; i < n; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            s.scale.setScalar(size);
            s.visible = false;
            s.renderOrder = 6;
            this.scene.add(s);
            arr.push(s);
        }
        return arr;
    }

    update(G, dt, time) {
        const B = G.boss;
        const show = !!B && (B.active || B.dying || B.freed) && !(B.freed && B.dying > 9);
        this.segs.visible = this.fins.visible = this.head.visible = this.wyrmLight.visible = show;
        if (show) {
            // shadow burns to gold as it dies
            const target = B.dying ? Math.min(1, B.dying / 3) : 0;
            this.gold += (target - this.gold) * Math.min(1, dt * 2);
            const g = this.gold;
            const flash = B.hurtFlash || 0;
            this.segMat.color.setRGB(0.23 + g * 0.7, 0.1 + g * 0.6, 0.35 - g * 0.15);
            this.segMat.emissive.setRGB(0.3 + g * 0.5 + flash, 0.06 + g * 0.35 + flash * 0.5, 0.5 - g * 0.4 + flash);
            this.headMat.color.copy(this.segMat.color);
            this.headMat.emissive.copy(this.segMat.emissive);
            this.finMat.emissive.setRGB(0.38 + g * 0.6, 0.12 + g * 0.5, 0.75 - g * 0.6);
            this.eyeMat.color.setRGB(1, 0.25 + g * 0.7, 0.63 - g * 0.3);
            this.headHalo.material.color.setRGB(0.63 + g * 0.37, 0.25 + g * 0.6, 1 - g * 0.6);
            this.wyrmLight.color.setRGB(0.63 + g * 0.37, 0.25 + g * 0.6, 1 - g * 0.6);
            const tr = B.trail;
            const m = this._m, q = this._q, v = this._v, s = this._s;
            for (let i = 0; i < WYRM_SEGS; i++) {
                const p = tr[Math.min(tr.length - 1, (i + 1) * WYRM_SPACING)];
                const pn = tr[Math.min(tr.length - 1, (i + 1) * WYRM_SPACING + 1)];
                const r = Math.max(0.18, 0.62 - i * 0.02) * (1 + Math.sin(time * 4 - i * 0.6) * 0.04);
                const z = Math.sin(i * 0.5 + time) * 0.2;
                m.compose(v.set(p.x, p.y, z), q.identity(), s.set(r, r, r * 0.85));
                this.segs.setMatrixAt(i, m);
                const ang = Math.atan2(p.y - pn.y, p.x - pn.x);
                q.setFromEuler(this._e.set(0, 0, ang - Math.PI / 2 + Math.PI / 2));
                m.compose(v.set(p.x - Math.sin(ang) * r * 0.9, p.y + Math.cos(ang) * r * 0.9, z), q, s.set(r * 1.2, r * 1.6, r * 1.2));
                this.fins.setMatrixAt(i, m);
            }
            this.segs.instanceMatrix.needsUpdate = this.fins.instanceMatrix.needsUpdate = true;
            const h = B.head;
            this.head.position.set(h.x, h.y, 0.3);
            const vx = h.vx, vy = h.vy;
            const ang = Math.hypot(vx, vy) > 0.3 ? Math.atan2(vy, vx) : this.head.userData.ang ?? 0;
            this.head.userData.ang = ang;
            // keep the head upright: mirror instead of rolling over
            const left = Math.cos(ang) < 0;
            this.head.scale.set(1, left ? -1 : 1, 1);
            this.head.rotation.z = ang;
            const open = B.mode === 'windup' || B.mode === 'spit' ? 0.5 : B.mode === 'lunge' ? 0.7 : 0.12 + Math.sin(time * 3) * 0.05;
            this.jaw.rotation.z = -Math.PI / 2 - open;
            this.headHalo.scale.setScalar(3 + Math.sin(time * 5) * 0.3 + (B.mode === 'windup' ? 1.5 : 0));
            this.wyrmLight.position.set(h.x, h.y, 1.5);
            this.wyrmLight.intensity = 5 + (B.mode === 'windup' ? 6 : 0) + g * 10;
        }
        // orbs
        const orbs = B ? B.orbs : [];
        for (let i = 0; i < this.orbs.length; i++) {
            const s = this.orbs[i], o = orbs[i];
            s.visible = !!o;
            if (o) { s.position.set(o.x, o.y, 0.6); s.scale.setScalar(0.8 + Math.sin(time * 12 + i) * 0.15); }
        }
        // wisps
        for (let i = 0; i < this.wisps.length; i++) {
            const w = G.wisps[i];
            const s = this.wisps[i], c = this.wispCores[i];
            s.visible = c.visible = !!w;
            if (w) {
                s.position.set(w.x, w.y, 0.7); c.position.set(w.x, w.y, 0.72);
                s.scale.setScalar(1.3 + Math.sin(time * 6 + w.phase) * 0.25);
                s.material.opacity = Math.min(1, w.life / 2) * 0.85;
            }
        }
        // falling boulders
        for (let i = 0; i < this.boulders.length; i++) {
            const b = G.boulders[i], m = this.boulders[i];
            m.visible = !!b;
            if (b) {
                m.position.set(b.c + 0.5 + (b.warn > 0 ? (Math.random() - 0.5) * 0.08 : 0), -(b.y + 0.5), 0);
                m.rotation.x += dt * 3; m.rotation.z += dt * 2;
            }
        }
    }
}
