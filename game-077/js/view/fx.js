// Particles, shockwave rings, floating score popups, debris and the screen
// shake. One additive Points cloud for glowy things, one normal-blended cloud
// for smoke, a small pool of rings and sprites.

import * as THREE from 'three';
import { neonText, icon } from './textures.js';

const MAX = 2600;

function pointsMat(additive) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uMap: { value: icon('dot') }, uScale: { value: 300 } },
        vertexShader: `attribute float aSize; attribute vec4 aColor; varying vec4 vColor;
            uniform float uScale;
            void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D uMap; varying vec4 vColor;
            void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); }`,
    });
}

class Cloud {
    constructor(group, additive, max = MAX) {
        this.max = max; this.n = 0;
        this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
        this.c = new Float32Array(max * 4); this.s = new Float32Array(max);
        this.life = new Float32Array(max); this.l0 = new Float32Array(max); this.g = new Float32Array(max); this.sz0 = new Float32Array(max); this.grow = new Float32Array(max);
        this.base = new Float32Array(max * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.c, 4));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.s, 1));
        this.mat = pointsMat(additive);
        this.pts = new THREE.Points(geo, this.mat);
        this.pts.frustumCulled = false;
        this.pts.renderOrder = 10;
        group.add(this.pts);
    }
    add(x, y, z, vx, vy, vz, color, size, life, grav = 0, grow = 0) {
        if (this.n >= this.max) return;
        const i = this.n++;
        this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
        this.base.set([color.r, color.g, color.b], i * 3);
        this.c.set([color.r, color.g, color.b, 1], i * 4);
        this.s[i] = size; this.sz0[i] = size; this.life[i] = life; this.l0[i] = life; this.g[i] = grav; this.grow[i] = grow;
    }
    update(dt) {
        let j = 0;
        for (let i = 0; i < this.n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) continue;
            const k = this.life[i] / this.l0[i];
            if (j !== i) {
                this.p.copyWithin(j * 3, i * 3, i * 3 + 3); this.v.copyWithin(j * 3, i * 3, i * 3 + 3);
                this.base.copyWithin(j * 3, i * 3, i * 3 + 3);
                this.life[j] = this.life[i]; this.l0[j] = this.l0[i]; this.g[j] = this.g[i]; this.sz0[j] = this.sz0[i]; this.grow[j] = this.grow[i];
            }
            this.v[j * 3 + 1] -= this.g[j] * dt;
            const damp = Math.pow(0.35, dt);
            this.v[j * 3] *= damp; this.v[j * 3 + 2] *= damp;
            this.p[j * 3] += this.v[j * 3] * dt; this.p[j * 3 + 1] += this.v[j * 3 + 1] * dt; this.p[j * 3 + 2] += this.v[j * 3 + 2] * dt;
            if (this.p[j * 3 + 1] < 0.02) { this.p[j * 3 + 1] = 0.02; this.v[j * 3 + 1] *= -0.3; }
            this.c[j * 4] = this.base[j * 3]; this.c[j * 4 + 1] = this.base[j * 3 + 1]; this.c[j * 4 + 2] = this.base[j * 3 + 2];
            this.c[j * 4 + 3] = Math.min(1, k * 1.6);
            this.s[j] = this.sz0[j] * (1 + this.grow[j] * (1 - k));
            j++;
        }
        this.n = j;
        const g = this.pts.geometry;
        g.setDrawRange(0, this.n);
        g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    }
    clear() { this.n = 0; }
}

const C = (h) => new THREE.Color(h);

export class FX {
    constructor(group, camera) {
        this.group = new THREE.Group();
        group.add(this.group);
        this.camera = camera;
        this.glow = new Cloud(this.group, true);
        this.smoke = new Cloud(this.group, false, 600);
        this.rings = [];
        this.pops = [];
        this.debris = [];
        this.shake = 0;
        this.quality = 1;
        this.light = new THREE.PointLight(0xff8a3a, 0, 14, 1.6);
        this.light.position.y = 1.5;
        this.group.add(this.light);
        this.lightT = 0;
        this.flash = 0;          // read by the view for the post pass
        this.flashColor = new THREE.Color(1, 1, 1);
    }

    setScale(h) { this.glow.mat.uniforms.uScale.value = h * 0.9; this.smoke.mat.uniforms.uScale.value = h * 0.9; }

    burst(x, y, z, n, color, { speed = 4, up = 2, size = 0.25, life = 0.6, grav = 6, grow = 0, spread = 1 } = {}) {
        n = Math.max(1, Math.round(n * this.quality));
        const col = C(color);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7) * spread;
            this.glow.add(x, y, z, Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s, col, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, grow);
        }
    }

    ring(x, z, color, { r0 = 0.2, r1 = 2.5, life = 0.5, y = 0.06, width = 0.12, opacity = 0.9 } = {}) {
        const m = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 48), new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(1.6), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.renderOrder = 9;
        this.group.add(m);
        this.rings.push({ m, t: 0, life, r0, r1, o: opacity });
    }

    popup(x, z, text, color = '#ffe45c', size = 0.5) {
        const nt = neonText(text, color, { font: '900 64px "Russo One", "Arial Black", sans-serif', pad: 24 });
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: nt.tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
        s.scale.set(size * nt.aspect, size, 1);
        s.position.set(x, 1.4, z);
        s.renderOrder = 30;
        this.group.add(s);
        this.pops.push({ s, t: 0, life: 1.4 });
    }

    trail(x, z, color, size = 0.18) {
        if (Math.random() > this.quality) return;
        this.glow.add(x + (Math.random() - 0.5) * 0.1, 0.12, z + (Math.random() - 0.5) * 0.1, 0, 0.1, 0, C(color), size, 0.45, 0, -0.6);
    }

    explosion(x, z, r) {
        this.burst(x, 0.3, z, 70, 0xffb040, { speed: 9, up: 3, size: 0.6, life: 0.7, grav: 2, grow: 1.5 });
        this.burst(x, 0.3, z, 40, 0xff3a20, { speed: 6, up: 5, size: 0.45, life: 0.9, grav: 4 });
        this.burst(x, 0.3, z, 30, 0xffffff, { speed: 12, up: 2, size: 0.18, life: 0.4, grav: 8 });
        for (let i = 0; i < 26 * this.quality; i++) {
            const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2;
            this.smoke.add(x + Math.cos(a) * 0.4, 0.4, z + Math.sin(a) * 0.4, Math.cos(a) * s, 0.8 + Math.random(), Math.sin(a) * s, C(0x2a2028), 0.9, 1.6 + Math.random(), -0.3, 2.2);
        }
        this.ring(x, z, 0xffb040, { r1: r * 1.2, life: 0.45, width: 0.18 });
        this.ring(x, z, 0xff3fa4, { r1: r * 1.6, life: 0.7, width: 0.06 });
        this.light.position.set(x, 1.5, z); this.light.intensity = 40; this.lightT = 0.5;
        this.shake = Math.max(this.shake, 0.5);
        this.flash = 0.25; this.flashColor.set(1, 0.8, 0.6);
        for (let i = 0; i < 10; i++) this._debris(x, z, 0x5a4a3a);
    }

    splash(x, z) {
        this.ring(x, z, 0x9af4ff, { r1: 1.4, life: 0.6, y: -0.1, width: 0.1 });
        this.ring(x, z, 0xffffff, { r1: 0.8, life: 0.4, y: -0.1, width: 0.2 });
        this.burst(x, 0, z, 34, 0xb8f4ff, { speed: 2, up: 6, size: 0.2, life: 0.8, grav: 14 });
    }

    shatter(x, z, color = 0x9af4ff) {
        this.burst(x, 0.5, z, 40, color, { speed: 6, up: 3, size: 0.16, life: 0.8, grav: 10 });
        for (let i = 0; i < 6; i++) this._debris(x, z, color, true);
    }

    sparks(x, z, color = 0xffd060, n = 10) { this.burst(x, 0.35, z, n, color, { speed: 4, up: 2, size: 0.12, life: 0.35, grav: 10 }); }

    _debris(x, z, color, glass = false) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.12 + Math.random() * 0.12, 0.08, 0.1 + Math.random() * 0.1), new THREE.MeshStandardMaterial({ color, transparent: glass, opacity: glass ? 0.6 : 1, roughness: 0.7 }));
        m.position.set(x, 0.4, z);
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        this.group.add(m);
        this.debris.push({ m, vx: Math.cos(a) * s, vy: 3 + Math.random() * 4, vz: Math.sin(a) * s, t: 0, spin: (Math.random() - 0.5) * 20 });
    }

    update(dt) {
        this.glow.update(dt);
        this.smoke.update(dt);
        for (const r of this.rings) {
            r.t += dt;
            const k = Math.min(1, r.t / r.life);
            const e = 1 - Math.pow(1 - k, 3);
            const s = r.r0 + (r.r1 - r.r0) * e;
            r.m.scale.set(s, s, s);
            r.m.material.opacity = r.o * (1 - k);
        }
        this.rings = this.rings.filter((r) => { if (r.t < r.life) return true; this.group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; });
        for (const p of this.pops) {
            p.t += dt;
            const k = p.t / p.life;
            p.s.position.y = 1.4 + k * 1.2;
            p.s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.4 : 1;
            p.s.scale.y = p.s.userData.h ?? (p.s.userData.h = p.s.scale.y);
            p.s.scale.set((p.s.userData.w ?? (p.s.userData.w = p.s.scale.x)) * pop, p.s.userData.h * pop, 1);
        }
        this.pops = this.pops.filter((p) => { if (p.t < p.life) return true; this.group.remove(p.s); p.s.material.dispose(); return false; });
        for (const d of this.debris) {
            d.t += dt;
            d.vy -= 14 * dt;
            d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
            if (d.m.position.y < 0.05) { d.m.position.y = 0.05; d.vy *= -0.35; d.vx *= 0.6; d.vz *= 0.6; d.spin *= 0.5; }
            d.m.rotation.x += d.spin * dt; d.m.rotation.y += d.spin * 0.7 * dt;
        }
        this.debris = this.debris.filter((d) => { if (d.t < 2.5) return true; this.group.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); return false; });
        if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = Math.max(0, this.lightT / 0.5) * 40; } else this.light.intensity = 0;
        this.shake = Math.max(0, this.shake - dt * 1.8);
        this.flash = Math.max(0, this.flash - dt * 1.4);
    }

    clear() {
        this.glow.clear(); this.smoke.clear();
        for (const r of this.rings) this.group.remove(r.m);
        for (const p of this.pops) this.group.remove(p.s);
        for (const d of this.debris) this.group.remove(d.m);
        this.rings = []; this.pops = []; this.debris = [];
    }
}
