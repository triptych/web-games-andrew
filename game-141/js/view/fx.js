// Particle effects for the board: debris chunks that tumble and bounce, dust puffs, sparkles, shock rings and
// light beams. Everything is pooled at boot (no allocation per effect, no lights added or removed, so no shader
// recompiles mid-game). The view calls these from sim events; none of it touches the sim.

import * as THREE from 'three';

function softTexture(size = 64, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, inner); r.addColorStop(1, outer);
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function starTexture(size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const m = size / 2;
    const r = g.createRadialGradient(m, m, 0, m, m, m);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.beginPath();
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, rad = k % 2 ? m * 0.22 : m;
        g.lineTo(m + Math.cos(a) * rad, m + Math.sin(a) * rad);
    }
    g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function ringTexture(size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const m = size / 2;
    const r = g.createRadialGradient(m, m, m * 0.6, m, m, m);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

export class FX {
    constructor(scene) {
        this.scene = scene;
        // ---- debris: one instanced mesh of little rough cubes
        this.N = 420;
        const geo = new THREE.DodecahedronGeometry(0.07, 0);
        this.debris = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), this.N);
        this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.debris.castShadow = true;
        this.debris.frustumCulled = false;
        for (let i = 0; i < this.N; i++) {
            tmp.scale.setScalar(0); tmp.updateMatrix();
            this.debris.setMatrixAt(i, tmp.matrix);
            this.debris.setColorAt(i, col.set(0xffffff));
        }
        scene.add(this.debris);
        this.d = Array.from({ length: this.N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 }));
        this.di = 0;

        // ---- sprites: dust (normal blending) and sparks (additive)
        const dustTex = softTexture(64, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
        const sparkTex = starTexture(64);
        this.dust = this.pool(70, () => new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 }));
        this.sparks = this.pool(140, () => new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));

        // ---- shock rings lying on the floor
        const ringTex = ringTexture();
        this.rings = [];
        for (let k = 0; k < 8; k++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
            m.rotation.x = -Math.PI / 2;
            m.visible = false;
            m.renderOrder = 3;
            scene.add(m);
            this.rings.push({ m, life: 0, max: 1, size: 1 });
        }
        // ---- light beams (artifact found, panel opened)
        this.beams = [];
        for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 6, 24, 1, true),
                new THREE.MeshBasicMaterial({ map: softTexture(64), color: 0xffe9a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide }));
            m.visible = false;
            scene.add(m);
            this.beams.push({ m, life: 0 });
        }
        // ---- one pooled flash light
        this.light = new THREE.PointLight(0xffd59a, 0, 4, 2);
        scene.add(this.light);
        this.lightLife = 0;
    }

    pool(n, mat) {
        const out = [];
        for (let k = 0; k < n; k++) {
            const s = new THREE.Sprite(mat());
            s.visible = false;
            s.renderOrder = 4;
            this.scene.add(s);
            out.push({ s, life: 0, max: 1, v: new THREE.Vector3(), grow: 0, size: 0.3, fade: 1 });
        }
        out.next = 0;
        return out;
    }

    take(pool) {
        const p = pool[pool.next];
        pool.next = (pool.next + 1) % pool.length;
        return p;
    }

    /** Chunks of a block flying apart. */
    burst(pos, color, n = 14, power = 1, up = 1) {
        for (let k = 0; k < n; k++) {
            const d = this.d[this.di];
            const i = this.di;
            this.di = (this.di + 1) % this.N;
            d.life = 1.1 + Math.random() * 0.6;
            d.p.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + Math.random() * 0.3, pos.z + (Math.random() - 0.5) * 0.6);
            const a = Math.random() * Math.PI * 2, sp = (1.2 + Math.random() * 2.6) * power;
            d.v.set(Math.cos(a) * sp, (2.4 + Math.random() * 3.2) * up, Math.sin(a) * sp);
            d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            d.w.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
            d.s = 0.6 + Math.random() * 1.5;
            col.set(color).offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.18);
            this.debris.setColorAt(i, col);
        }
        this.debris.instanceColor.needsUpdate = true;
    }

    puff(pos, color = 0xe8d0a0, n = 6, size = 0.55, rise = 0.6) {
        for (let k = 0; k < n; k++) {
            const p = this.take(this.dust);
            p.s.visible = true;
            p.s.material.color.set(color);
            p.s.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + Math.random() * 0.2, pos.z + (Math.random() - 0.5) * 0.5);
            p.v.set((Math.random() - 0.5) * 1.2, rise * (0.5 + Math.random()), (Math.random() - 0.5) * 1.2);
            p.life = p.max = 0.6 + Math.random() * 0.5;
            p.size = size * (0.6 + Math.random() * 0.6);
            p.grow = 1.4;
            p.fade = 0.75;
        }
    }

    sparkle(pos, color = 0xffe08a, n = 10, speed = 2.2, size = 0.28, life = 0.8, spread = 0.4) {
        for (let k = 0; k < n; k++) {
            const p = this.take(this.sparks);
            p.s.visible = true;
            p.s.material.color.set(color);
            p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * spread * 0.5, pos.z + (Math.random() - 0.5) * spread);
            const a = Math.random() * Math.PI * 2;
            p.v.set(Math.cos(a) * speed * Math.random(), speed * (0.4 + Math.random()), Math.sin(a) * speed * Math.random());
            p.life = p.max = life * (0.6 + Math.random() * 0.6);
            p.size = size * (0.6 + Math.random() * 0.8);
            p.grow = -0.4;
            p.fade = 1;
        }
    }

    ring(pos, color = 0xffd36b, size = 3, life = 0.6) {
        const r = this.rings.find((q) => q.life <= 0) || this.rings[0];
        r.m.visible = true;
        r.m.material.color.set(color);
        r.m.position.set(pos.x, 0.05, pos.z);
        r.life = r.max = life;
        r.size = size;
    }

    beam(pos, color = 0xffe9a8, life = 1.6) {
        const b = this.beams.find((q) => q.life <= 0) || this.beams[0];
        b.m.visible = true;
        b.m.material.color.set(color);
        b.m.position.set(pos.x, 3, pos.z);
        b.life = b.max = life;
    }

    flash(pos, color = 0xffd59a, power = 6) {
        this.light.position.set(pos.x, 1.2, pos.z);
        this.light.color.set(color);
        this.light.intensity = power;
        this.lightLife = 1;
    }

    update(dt) {
        // debris
        let any = false;
        for (let i = 0; i < this.N; i++) {
            const d = this.d[i];
            if (d.life <= 0) continue;
            any = true;
            d.life -= dt;
            d.v.y -= 15 * dt;
            d.p.addScaledVector(d.v, dt);
            if (d.p.y < 0.04) {
                d.p.y = 0.04;
                d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6;
                d.w.multiplyScalar(0.6);
            }
            d.r.addScaledVector(d.w, dt);
            tmp.position.copy(d.p);
            tmp.rotation.set(d.r.x, d.r.y, d.r.z);
            tmp.scale.setScalar(d.life <= 0 ? 0 : d.s * Math.min(1, d.life * 2.5));
            tmp.updateMatrix();
            this.debris.setMatrixAt(i, tmp.matrix);
        }
        if (any || this.wasAny) this.debris.instanceMatrix.needsUpdate = true;
        this.wasAny = any;
        // sprites
        for (const pool of [this.dust, this.sparks]) {
            for (const p of pool) {
                if (p.life <= 0) continue;
                p.life -= dt;
                if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; continue; }
                p.s.position.addScaledVector(p.v, dt);
                p.v.multiplyScalar(1 - dt * 1.8);
                if (pool === this.sparks) p.v.y -= 2.5 * dt;
                const t = 1 - p.life / p.max;
                p.s.scale.setScalar(Math.max(0.01, p.size * (1 + p.grow * t)));
                p.s.material.opacity = p.fade * (1 - t) * Math.min(1, t * 8);
            }
        }
        for (const r of this.rings) {
            if (r.life <= 0) continue;
            r.life -= dt;
            const t = 1 - Math.max(0, r.life) / r.max;
            r.m.scale.setScalar(0.3 + r.size * t);
            r.m.material.opacity = (1 - t) * 0.9;
            if (r.life <= 0) r.m.visible = false;
        }
        for (const b of this.beams) {
            if (b.life <= 0) continue;
            b.life -= dt;
            const t = 1 - Math.max(0, b.life) / b.max;
            b.m.material.opacity = Math.sin(Math.PI * t) * 0.55;
            b.m.scale.set(1 - t * 0.6, 1, 1 - t * 0.6);
            b.m.rotation.y += dt;
            if (b.life <= 0) b.m.visible = false;
        }
        if (this.lightLife > 0) {
            this.lightLife -= dt * 3;
            this.light.intensity = Math.max(0, this.lightLife) * this.light.intensity;
        }
    }
}
