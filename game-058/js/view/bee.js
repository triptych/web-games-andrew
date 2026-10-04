/**
 * bee.js — the bumblebee. Follows your finger while you draw a trail, zips
 * along the trail when it's picked, and otherwise potters about the blanket.
 */

import * as THREE from 'three';

const M = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, ...o });

export class Bee {
    constructor(scene) {
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);

        // Striped body: vertex colours in bands along x.
        const g = new THREE.SphereGeometry(0.3, 20, 14);
        g.scale(1.25, 1, 1);
        const p = g.attributes.position;
        const col = new Float32Array(p.count * 3);
        const yellow = new THREE.Color(0xffc81a), black = new THREE.Color(0x2a1e14);
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const band = Math.floor((x + 0.4) / 0.16);
            const c = (x < -0.3 || band % 2 === 1) ? black : yellow;
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const torso = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
        torso.castShadow = true;
        this.body.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M(0x2a1e14));
        head.position.set(0.38, 0.05, 0);
        head.castShadow = true;
        this.body.add(head);
        for (const s of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0xffffff, { roughness: 0.2 }));
            eye.position.set(0.48, 0.1, s * 0.1);
            this.body.add(eye);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0x111111, { roughness: 0.2 }));
            pupil.position.set(0.54, 0.11, s * 0.11);
            this.body.add(pupil);
            const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xff7aa0));
            cheek.position.set(0.5, 0.0, s * 0.15);
            cheek.scale.set(0.6, 0.6, 1);
            this.body.add(cheek);
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4), M(0x2a1e14));
            ant.position.set(0.45, 0.32, s * 0.08);
            ant.rotation.set(s * 0.3, 0, -0.5);
            this.body.add(ant);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0x2a1e14));
            tip.position.set(0.51, 0.43, s * 0.12);
            this.body.add(tip);
        }
        const sting = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), M(0x2a1e14));
        sting.position.set(-0.43, -0.02, 0);
        sting.rotation.z = Math.PI / 2;
        this.body.add(sting);

        const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
        this.wings = [];
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(0.05, 0.25, s * 0.08);
            const w = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), wingMat);
            w.scale.set(1, 0.6, 1);
            w.rotation.x = -Math.PI / 2;
            w.position.set(-0.06, 0, s * 0.2);
            pivot.add(w);
            this.body.add(pivot);
            this.wings.push({ pivot, s });
        }

        this.root.scale.setScalar(0.9);
        scene.add(this.root);

        this.pos = new THREE.Vector3(0, 2.2, 0);
        this.vel = new THREE.Vector3();
        this.target = new THREE.Vector3(0, 2.2, 0);
        this.mode = 'idle';        // idle | follow | zip | rest
        this.path = null;
        this.t = 0;
        this.wanderT = 0;
        this.heading = 0;
        this.happy = 0;
        this.root.position.copy(this.pos);
    }

    follow(p) {
        this.mode = 'follow';
        this.target.set(p.x, 1.25, p.z + 0.15);
    }

    idle() { if (this.mode !== 'zip') this.mode = 'idle'; }

    /** Fly through points (world positions), dur seconds per leg. */
    zip(points, dur) {
        if (!points.length) return;
        this.mode = 'zip';
        this.path = { pts: points.map(p => p.clone().setY(1.1)), dur, t: 0 };
    }

    cheer() { this.happy = 1; }

    update(dt, time) {
        this.t += dt;
        if (this.mode === 'zip' && this.path) {
            const P = this.path;
            P.t += dt;
            const f = P.t / P.dur;
            const i = Math.floor(f);
            if (i >= P.pts.length - 1) {
                this.pos.copy(P.pts[P.pts.length - 1]);
                this.mode = 'idle';
                this.path = null;
                this.wanderT = 0.8;
            } else {
                const k = f - i;
                const e = k * k * (3 - 2 * k);
                this.pos.lerpVectors(P.pts[i], P.pts[i + 1], e);
                this.pos.y += Math.sin(k * Math.PI) * 0.25;
            }
            this.vel.set(0, 0, 0);
        } else {
            if (this.mode === 'idle') {
                this.wanderT -= dt;
                if (this.wanderT <= 0) {
                    this.wanderT = 2 + Math.random() * 2.5;
                    const a = Math.random() * Math.PI * 2;
                    this.target.set(Math.cos(a) * 3.2, 1.9 + Math.random() * 0.6, Math.sin(a) * 3.6);
                }
            }
            const k = this.mode === 'follow' ? 22 : 3.2;
            const damp = this.mode === 'follow' ? 9 : 2.6;
            const ax = (this.target.x - this.pos.x) * k - this.vel.x * damp;
            const ay = (this.target.y - this.pos.y) * k - this.vel.y * damp;
            const az = (this.target.z - this.pos.z) * k - this.vel.z * damp;
            this.vel.x += ax * dt; this.vel.y += ay * dt; this.vel.z += az * dt;
            this.pos.addScaledVector(this.vel, dt);
        }
        this.root.position.copy(this.pos);
        this.root.position.y += Math.sin(time * 6) * 0.06;

        // Face the direction of travel (or the camera when hovering).
        const dx = this.mode === 'zip' && this.path ? (this.path.pts[Math.min(this.path.pts.length - 1, Math.floor(this.path.t / this.path.dur) + 1)].x - this.pos.x) : this.vel.x;
        const dz = this.mode === 'zip' && this.path ? (this.path.pts[Math.min(this.path.pts.length - 1, Math.floor(this.path.t / this.path.dur) + 1)].z - this.pos.z) : this.vel.z;
        let want = this.heading;
        if (Math.hypot(dx, dz) > 0.15) want = Math.atan2(-dz, dx);
        else if (this.mode !== 'zip') want = -Math.PI / 2 + Math.sin(time * 0.8) * 0.5;   // turn to the viewer
        let d = want - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 8);
        this.root.rotation.y = this.heading;
        this.body.rotation.z = Math.max(-0.4, Math.min(0.4, -this.vel.y * 0.08)) + Math.sin(time * 3) * 0.05;

        this.happy = Math.max(0, this.happy - dt);
        const flap = Math.sin(time * 48) * 0.7;
        for (const w of this.wings) w.pivot.rotation.x = w.s * (0.25 + flap);
        const sq = 1 + this.happy * Math.sin(time * 30) * 0.08;
        this.body.scale.set(sq, 2 - sq, sq);
    }
}
