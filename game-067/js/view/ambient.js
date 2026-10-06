/**
 * ambient.js — life around the island that isn't part of the world: puffy clouds drifting over (and
 * casting soft moving shadows), seagulls circling, sailboats on a wide loop out at sea, and
 * fireflies over the island at night.
 */

import * as THREE from 'three';
import { N, LAND_H } from '../config.js';
import { Builder } from './builder.js';
import { toyMat, night } from './materials.js';
import { buildItem } from './models.js';

export class Ambient {
    constructor(scene) {
        this.scene = scene;
        // clouds
        this.clouds = [];
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0x6a7a90, emissiveIntensity: 0.25 });
        let s = 7;
        const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 9; i++) {
            const b = new Builder();
            const n = 4 + Math.floor(r() * 4);
            for (let k = 0; k < n; k++) b.ico(0.9 + r() * 1.1, 0xffffff, (k - n / 2) * 1.1 + r() * 0.6, r() * 0.6, (r() - 0.5) * 1.6, { detail: 1, sy: 0.75 });
            const m = new THREE.Mesh(b.geometry(), cloudMat.clone());
            m.material.transparent = true;
            m.position.set((r() - 0.5) * 110, 13 + r() * 5, (r() - 0.5) * 90);
            m.userData.speed = 0.6 + r() * 0.6;
            scene.add(m);
            this.clouds.push(m);
        }
        // gulls
        this.gulls = [];
        const wing = new Builder();
        wing.box(0.36, 0.015, 0.1, 0xffffff, 0.18, 0, 0);
        wing.box(0.08, 0.016, 0.06, 0x3a3a40, 0.34, 0, 0.01);
        const wingGeo = wing.geometry();
        const body = new Builder();
        body.sphere(0.06, 0xffffff, 0, 0, 0, { sx: 2.2, seg: 8 });
        body.cone(0.02, 0.06, 0xf6c21c, 0.15, -0.01, 0, { rz: -Math.PI / 2 });
        const bodyGeo = body.geometry();
        for (let i = 0; i < 5; i++) {
            const g = new THREE.Group();
            g.add(new THREE.Mesh(bodyGeo, toyMat));
            const L = new THREE.Mesh(wingGeo, toyMat); L.rotation.y = Math.PI / 2;
            const R = new THREE.Mesh(wingGeo, toyMat); R.rotation.y = -Math.PI / 2;
            g.add(L, R);
            g.userData = { L, R, r: 8 + i * 4, h: 5 + i * 0.8, sp: 0.18 + i * 0.03, ph: i * 1.9, cx: (i % 2 ? -6 : 7), cz: (i % 3) * 4 - 4 };
            scene.add(g);
            this.gulls.push(g);
        }
        // boats far out
        this.boats = [];
        const boatGeo = buildItem('sailboat').geo;
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(boatGeo, toyMat);
            m.scale.setScalar(1.6);
            m.userData = { r: N / 2 + 7 + i * 5, sp: 0.02 + i * 0.008, ph: i * 2.2 };
            scene.add(m);
            this.boats.push(m);
        }
        // fireflies
        const fg = new THREE.BufferGeometry();
        const fp = new Float32Array(60 * 3);
        this.ff = [];
        for (let i = 0; i < 60; i++) this.ff.push({ x: (r() - 0.5) * N * 0.7, z: (r() - 0.5) * N * 0.7, ph: r() * 6.28, sp: 0.3 + r() * 0.4 });
        fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
        this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xfff27a, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.fireflies.frustumCulled = false;
        scene.add(this.fireflies);
    }

    /** Snow in winter, blossom petals in spring, leaves in autumn; nothing in summer. */
    setSeason(season) {
        if (this.season === season) return;
        this.season = season;
        if (this.weather) { this.scene.remove(this.weather); this.weather.geometry.dispose(); this.weather = null; }
        const col = { winter: 0xffffff, spring: 0xffb6d5, autumn: 0xf08a2a }[season];
        if (!col) return;
        const n = season === 'winter' ? 700 : 220;
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3);
        this.flakes = [];
        for (let i = 0; i < n; i++) this.flakes.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 14, z: (Math.random() - 0.5) * 60, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.5 });
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        this.weather = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: season === 'winter' ? 0.09 : 0.1, transparent: true, opacity: 0.9, depthWrite: false }));
        this.weather.frustumCulled = false;
        this.scene.add(this.weather);
    }

    update(dt, t, camera) {
        if (camera) for (const c of this.clouds) {
            // fade a cloud out as the camera gets close, rather than flying through cotton wool
            const d = c.position.distanceTo(camera.position);
            c.material.opacity = Math.max(0, Math.min(1, (d - 5) / 10));
            c.visible = c.material.opacity > 0.02;
        }
        if (this.weather) {
            const p = this.weather.geometry.attributes.position;
            const fall = this.season === 'winter' ? 0.8 : 0.45;
            this.flakes.forEach((f, i) => {
                f.y -= f.sp * fall * dt;
                if (f.y < LAND_H) { f.y = 12 + Math.random() * 3; f.x = (Math.random() - 0.5) * 60; f.z = (Math.random() - 0.5) * 60; }
                p.setXYZ(i, f.x + Math.sin(t * f.sp + f.ph) * 0.6, f.y, f.z + Math.cos(t * f.sp * 0.7 + f.ph) * 0.6);
            });
            p.needsUpdate = true;
        }
        for (const c of this.clouds) {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > 70) c.position.x = -70;
        }
        for (const g of this.gulls) {
            const u = g.userData;
            const a = t * u.sp + u.ph;
            g.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 0.4, u.cz + Math.sin(a) * u.r);
            g.rotation.y = -a - Math.PI / 2;
            const f = Math.sin(t * 7 + u.ph) * 0.5;
            u.L.rotation.x = f; u.R.rotation.x = -f;
            g.visible = night.value < 0.6;
        }
        for (const b of this.boats) {
            const u = b.userData;
            const a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, LAND_H + Math.sin(t * 1.5 + u.ph) * 0.03, Math.sin(a) * u.r);
            b.rotation.set(Math.sin(t * 1.2 + u.ph) * 0.05, -a - Math.PI / 2, Math.cos(t + u.ph) * 0.04);
        }
        const n = night.value;
        this.fireflies.material.opacity = n * 0.9;
        this.fireflies.visible = n > 0.05;
        if (this.fireflies.visible) {
            const p = this.fireflies.geometry.attributes.position;
            this.ff.forEach((f, i) => {
                p.setXYZ(i, f.x + Math.sin(t * f.sp + f.ph) * 1.2, LAND_H + 0.4 + Math.sin(t * f.sp * 2.1 + f.ph) * 0.25, f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 1.2);
            });
            p.needsUpdate = true;
        }
    }
}
