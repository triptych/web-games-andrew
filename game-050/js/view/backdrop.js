/**
 * backdrop.js — the battle stage for each wing: a painted shader sky, towering
 * bookshelves, drifting books, light shafts, motes, and a pedestal for the monster.
 */

import * as THREE from 'three';
import { WINGS } from '../sim/regions.js';

const SkyShader = {
    uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uAcc: { value: new THREE.Color() }, uTime: { value: 0 }, uStars: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
        uniform vec3 uTop, uBot, uAcc; uniform float uTime, uStars; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
            vec3 c = mix(uBot, uTop, smoothstep(0.0, 1.0, vUv.y));
            float sw = n(vUv * 4.0 + vec2(uTime * 0.03, uTime * 0.02)) * 0.5 + n(vUv * 9.0 - uTime * 0.04) * 0.25;
            c = mix(c, uAcc, smoothstep(0.55, 0.95, sw) * 0.25);
            // sun-burst rays from the top centre
            vec2 d = vUv - vec2(0.5, 1.15);
            float a = atan(d.y, d.x);
            float rays = smoothstep(0.6, 1.0, sin(a * 18.0 + uTime * 0.15)) * smoothstep(1.4, 0.2, length(d));
            c += uAcc * rays * 0.12;
            // stars
            vec2 g = floor(vUv * vec2(160.0, 90.0));
            float s = step(0.992, h(g)) * (0.6 + 0.4 * sin(uTime * 3.0 + h(g + 3.0) * 30.0));
            c += vec3(s) * uStars;
            gl_FragColor = vec4(c, 1.0);
        }`,
};

function shelfTexture(seed) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#6a3a1a'; g.fillRect(0, 0, 256, 512);
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const pal = ['#ff4a5a', '#ffb52e', '#46e07a', '#3fa8ff', '#b46bff', '#ff7ae0', '#ffe46a', '#3fe0d0', '#ff8a3a'];
    for (let shelf = 0; shelf < 6; shelf++) {
        const y0 = shelf * 85 + 8;
        g.fillStyle = '#3a1a08'; g.fillRect(0, y0 + 70, 256, 12);
        let x = 8;
        while (x < 248) {
            const w = 10 + r() * 16, h = 46 + r() * 22;
            g.fillStyle = pal[Math.floor(r() * pal.length)];
            g.fillRect(x, y0 + 70 - h, w, h);
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(x + 2, y0 + 70 - h + 6, w - 4, 3);
            g.fillRect(x + 2, y0 + 70 - 12, w - 4, 3);
            x += w + 1 + (r() < 0.1 ? 10 : 0);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Backdrop {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), new THREE.ShaderMaterial({ ...SkyShader, uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms), depthWrite: false }));
        this.sky.position.z = -60;
        this.group.add(this.sky);
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x6a4aa0, 0.75);
        scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.7);
        this.sun.position.set(4, 10, 12);
        scene.add(this.sun);
        this.rim = new THREE.DirectionalLight(0xff9adf, 0.7);
        this.rim.position.set(-8, 4, -6);
        scene.add(this.rim);
        this.deco = new THREE.Group();
        this.group.add(this.deco);
        this.books = [];
        this.time = 0;
        // motes
        const n = 160;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = (Math.random() - 0.5) * 40; pos[i * 3 + 2] = -20 + Math.random() * 18; }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.25, color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        this.group.add(this.motes);
    }

    setWing(wi) {
        const w = WINGS[Math.max(0, Math.min(WINGS.length - 1, wi))];
        const u = this.sky.material.uniforms;
        u.uTop.value.set(w.sky[0]);
        u.uBot.value.set(w.sky[1]);
        u.uAcc.value.set(w.accent);
        u.uStars.value = w.mood === 'stars' || w.mood === 'storm' ? 0.9 : w.mood === 'blank' ? 0 : 0.15;
        this.motes.material.color.set(w.mood === 'warm' ? 0xffb06a : w.mood === 'water' ? 0xa0f0ff : w.mood === 'blank' ? 0x8a7ac0 : 0xfff2b0);
        this.hemi.color.set(w.sky[1]);
        this.hemi.groundColor.set(w.ground);
        // rebuild the set dressing
        this.deco.clear();
        this.books.length = 0;
        const blank = w.mood === 'blank';
        const tex = shelfTexture(17 + wi * 31);
        const shelfMat = new THREE.MeshStandardMaterial({ map: blank ? null : tex, color: blank ? 0xf4f0ff : 0xffffff, roughness: 0.8 });
        const woodMat = new THREE.MeshStandardMaterial({ color: blank ? 0xe8e4f8 : 0x8a4a22, roughness: 0.7 });
        for (let i = 0; i < 8; i++) {
            const side = i % 2 ? 1 : -1;
            const k = Math.floor(i / 2);
            const x = side * (22 + k * 9), z = -24 - k * 6;
            const h = 26 + k * 4;
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, h, 2), [woodMat, woodMat, woodMat, woodMat, shelfMat, woodMat]);
            shelf.position.set(x, -14 + h / 2, z);
            shelf.rotation.y = -side * 0.35;
            this.deco.add(shelf);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 2.6), woodMat);
            cap.position.set(x, -14 + h + 0.5, z);
            cap.rotation.y = shelf.rotation.y;
            this.deco.add(cap);
        }
        // arch
        const arch = new THREE.Mesh(new THREE.TorusGeometry(30, 1.6, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: blank ? 0xffffff : w.accent, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(w.accent).multiplyScalar(0.15) }));
        arch.position.set(0, -6, -40);
        this.deco.add(arch);
        // floating books
        const pal = [0xff4a5a, 0xffb52e, 0x46e07a, 0x3fa8ff, 0xb46bff, 0xff7ae0, 0x3fe0d0];
        const pageMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9 });
        for (let i = 0; i < 16; i++) {
            const g = new THREE.Group();
            const color = blank ? 0xffffff : pal[i % pal.length];
            const cm = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(color).multiplyScalar(0.15) });
            const cover = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.35), cm);
            const pages = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.28), pageMat);
            pages.position.x = 0.06;
            g.add(cover, pages);
            const side = i % 2 ? 1 : -1;
            g.position.set(side * (14 + Math.random() * 18), -8 + Math.random() * 22, -14 - Math.random() * 16);
            g.rotation.set(Math.random() * 2, Math.random() * 6, Math.random() * 2);
            g.userData = { ph: Math.random() * 6, sp: 0.3 + Math.random() * 0.5, y: g.position.y };
            this.deco.add(g);
            this.books.push(g);
        }
        // light shafts
        const shaftMat = new THREE.MeshBasicMaterial({ color: blank ? 0xffffff : w.accent, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        for (let i = 0; i < 4; i++) {
            const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), shaftMat);
            s.position.set(-24 + i * 16, 8, -30);
            s.rotation.z = 0.35;
            this.deco.add(s);
        }
        // pedestal (positioned with the monster)
        this.pedestal = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.25, 32), new THREE.MeshStandardMaterial({ color: blank ? 0xffffff : w.accent, metalness: 0.4, roughness: 0.35, emissive: new THREE.Color(w.accent).multiplyScalar(0.2) }));
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.35, 32), woodMat);
        base.position.y = -0.3;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.13;
        this.pedestal.add(top, base, ring);
        this.pedestal.position.y = -0.12;
        this.deco.add(this.pedestal);
    }

    placePedestal(x, y, scale) {
        this.pedestal.position.set(x, y - 0.13 * scale, -1.5);
        this.pedestal.scale.setScalar(scale);
    }

    update(dt) {
        this.time += dt;
        this.sky.material.uniforms.uTime.value = this.time;
        for (const b of this.books) {
            const u = b.userData;
            b.rotation.y += dt * u.sp * 0.5;
            b.rotation.x += dt * u.sp * 0.2;
            b.position.y = u.y + Math.sin(this.time * u.sp + u.ph) * 0.8;
        }
        const p = this.motes.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            let y = p.getY(i) + dt * (0.5 + (i % 5) * 0.2);
            if (y > 20) y = -20;
            p.setY(i, y);
            p.setX(i, p.getX(i) + Math.sin(this.time + i) * dt * 0.3);
        }
        p.needsUpdate = true;
    }
}
