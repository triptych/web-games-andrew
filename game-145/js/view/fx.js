// Things that move but don't matter to the rules: dust hanging in the flashlight beam, paper and leaves blowing down
// the empty streets, the ring's rift when it opens. View only (Math.random is fine here).

import * as THREE from 'three';
import { image } from './tex.js';

function softDot() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
}

export class Fx {
    constructor(scene) {
        this.scene = scene;
        // dust motes in a box round the camera
        const n = 420;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 16;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xd8d2c0, sizeAttenuation: true }));
        this.dust.frustumCulled = false;
        scene.add(this.dust);
        this.dustVel = new Float32Array(n * 3).map(() => (Math.random() - 0.5) * 0.06);

        // paper and leaves tumbling in the wind
        const pg = new THREE.PlaneGeometry(0.28, 0.36);
        const pm = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, side: THREE.DoubleSide, roughness: 1 });
        this.papers = new THREE.InstancedMesh(pg, pm, 36);
        this.papers.frustumCulled = false;
        this.papers.castShadow = false;
        scene.add(this.papers);
        const lg = new THREE.PlaneGeometry(0.14, 0.12);
        const lm = new THREE.MeshStandardMaterial({ color: 0x6d4a26, side: THREE.DoubleSide, roughness: 1 });
        this.leaves = new THREE.InstancedMesh(lg, lm, 90);
        this.leaves.frustumCulled = false;
        scene.add(this.leaves);
        this.bits = [];
        for (let i = 0; i < 126; i++) this.bits.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, r: Math.random() * 6, s: Math.random() * 6, spin: 0, life: 0, leaf: i >= 36 });
        this.tmp = new THREE.Object3D();
        this.wind = { a: Math.random() * 6, s: 1.2, gust: 0 };

        // the rift: a spinning disc of fal light inside the ring
        this.rift = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ map: image('portal'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0 }));
        this.rift.visible = false;
        scene.add(this.rift);
        this.riftLight = new THREE.PointLight(0xffe2a0, 0, 60, 1.4);
        scene.add(this.riftLight);
    }

    /** Place the rift in the ring (world centre, facing +z). */
    setRing(x, y, z) { this.rift.position.set(x, y, z); this.riftLight.position.set(x, y, z + 3); }

    update(dt, time, cam, outdoors, portal, power) {
        // dust: drift and wrap round the camera
        const p = this.dust.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
            p[i] += this.dustVel[i] * dt + Math.sin(time * 0.3 + i) * 0.002;
            p[i + 1] += this.dustVel[i + 1] * dt * 0.5;
            p[i + 2] += this.dustVel[i + 2] * dt;
            for (let k = 0; k < 3; k++) {
                const c = [cam.x, cam.y, cam.z][k];
                if (p[i + k] - c > 8) p[i + k] -= 16; else if (p[i + k] - c < -8) p[i + k] += 16;
            }
            // never right in front of the lens, where a mote becomes a big white blur
            const dx = p[i] - cam.x, dy = p[i + 1] - cam.y, dz = p[i + 2] - cam.z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < 0.8) { const k = 1 / Math.sqrt(d2 + 1e-6); p[i] = cam.x + dx * k * 1.2; p[i + 1] = cam.y + dy * k * 1.2; p[i + 2] = cam.z + dz * k * 1.2; }
        }
        this.dust.geometry.attributes.position.needsUpdate = true;
        this.dust.material.opacity = outdoors ? 0.25 : 0.6;

        // wind
        this.wind.a += (Math.random() - 0.5) * dt * 0.2;
        this.wind.gust = Math.max(0, this.wind.gust - dt * 0.3);
        if (Math.random() < dt * 0.08) this.wind.gust = 1 + Math.random();
        const ws = this.wind.s * (1 + this.wind.gust * 2.5);
        const wx = Math.cos(this.wind.a) * ws, wz = Math.sin(this.wind.a) * ws;
        let pi = 0, li = 0;
        for (const b of this.bits) {
            b.life -= dt;
            if (b.life <= 0 || Math.hypot(b.x - cam.x, b.z - cam.z) > 34) {
                if (!outdoors && Math.random() < 0.9) { b.y = -50; b.life = 0.5; }
                else {
                    const a = Math.random() * 6.28, d = 8 + Math.random() * 22;
                    b.x = cam.x + Math.cos(a) * d - wx * 4; b.z = cam.z + Math.sin(a) * d - wz * 4; b.y = 0.15 + Math.random() * 0.3;
                    b.vx = 0; b.vy = 0; b.vz = 0; b.life = 6 + Math.random() * 10;
                }
            }
            const lift = (Math.sin(time * 2.3 + b.s) * 0.5 + 0.5) * this.wind.gust * (b.leaf ? 1.4 : 2.2);
            b.vx += (wx - b.vx) * dt * (b.leaf ? 1.6 : 0.9);
            b.vz += (wz - b.vz) * dt * (b.leaf ? 1.6 : 0.9);
            b.vy += (lift - 3.2 + (b.y < 0.12 ? 3.2 : 0)) * dt;
            b.vy *= 0.96;
            b.x += b.vx * dt * (b.y > 0.13 ? 1 : 0.2); b.z += b.vz * dt * (b.y > 0.13 ? 1 : 0.2); b.y = Math.max(0.12, b.y + b.vy * dt);
            b.r += (Math.hypot(b.vx, b.vz) * 0.9 + 0.2) * dt * (b.y > 0.14 ? 3 : 0.3);
            this.tmp.position.set(b.x, b.y + 0.01, b.z);
            this.tmp.rotation.set(b.y > 0.14 ? b.r : -Math.PI / 2, b.r * 0.7 + b.s, b.y > 0.14 ? b.r * 0.4 : 0);
            this.tmp.updateMatrix();
            if (b.leaf) this.leaves.setMatrixAt(li++, this.tmp.matrix); else this.papers.setMatrixAt(pi++, this.tmp.matrix);
        }
        this.papers.instanceMatrix.needsUpdate = true;
        this.leaves.instanceMatrix.needsUpdate = true;

        // the rift
        if (portal > 0 || power) {
            this.rift.visible = true;
            const k = portal > 0 ? Math.min(1, portal / 3) : 0.08 + Math.sin(time * 1.3) * 0.03;
            this.rift.material.opacity = k;
            this.rift.rotation.z = time * (0.25 + k * 1.5);
            this.rift.scale.setScalar(0.6 + k * 0.4 + Math.sin(time * 7) * 0.01 * k);
            this.riftLight.intensity = k * 140;
        } else { this.rift.visible = false; this.riftLight.intensity = 0; }
        return { wx, wz, gust: this.wind.gust };
    }
}
