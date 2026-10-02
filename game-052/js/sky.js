// Sky dome, the distant skyline band, and the gas flares that bloom now and
// then on far-off towers. All of it follows the camera.

import * as THREE from 'three';
import { mulberry32 } from './rng.js';

export class Sky {
    constructor(scene, M, tex, seed) {
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), M.sky);
        this.dome.renderOrder = -10;
        this.dome.frustumCulled = false;
        scene.add(this.dome);

        this.band = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 440, 64, 1, true), M.skyline);
        this.band.renderOrder = -9;
        this.band.frustumCulled = false;
        scene.add(this.band);

        this.rand = mulberry32(seed ^ 0xf1a4e);
        this.flares = [];
        for (let i = 0; i < 4; i++) {
            const m = new THREE.SpriteMaterial({
                map: tex.glow, color: 0xff7a2a, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, fog: false, opacity: 0,
            });
            const sp = new THREE.Sprite(m);
            sp.renderOrder = -8;
            scene.add(sp);
            this.flares.push({ sp, t: 99, ang: 0, h: 0, dist: 1300 });
        }
        this.nextFlare = 4;
    }

    update(dt, cam) {
        this.dome.position.copy(cam);
        this.band.position.set(cam.x, 200, cam.z);
        this.nextFlare -= dt;
        if (this.nextFlare <= 0) {
            const f = this.flares.find((q) => q.t > 3);
            if (f) {
                f.t = 0;
                f.ang = this.rand() * Math.PI * 2;
                f.h = 70 + this.rand() * 120;
                f.size = 50 + this.rand() * 70;
            }
            this.nextFlare = 5 + this.rand() * 14;
        }
        for (const f of this.flares) {
            f.t += dt;
            const a = f.t < 0.25 ? f.t / 0.25 : Math.max(0, 1 - (f.t - 0.25) / 2.2);
            f.sp.material.opacity = a * 0.9;
            const s = f.size * (0.6 + Math.min(1, f.t * 2) * 0.6);
            f.sp.scale.set(s * 0.8, s, 1);
            f.sp.position.set(cam.x + Math.cos(f.ang) * f.dist, f.h + f.t * 6, cam.z + Math.sin(f.ang) * f.dist);
            f.sp.visible = a > 0.01;
        }
    }
}
