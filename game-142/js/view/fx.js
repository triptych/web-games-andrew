// Effects. All pooled: chips (little cubes of whatever broke), puffs (dust and smoke balls),
// fireballs, shockwave rings, one flash light, and floating score text in the DOM.
// Visual only: nothing here touches the simulation.

import * as THREE from 'three';

const CHIPS = 700, PUFFS = 260, FIRES = 120, BALLS = 12, RINGS = 8;

export const MAT_COLORS = {
    stone: [0xe9dfcd, 0xcfc3ae, 0xb5a892], brick: [0xf08a62, 0xd96f4c, 0xffb08f], wood: [0xd78a3c, 0xb86b2a, 0xf2a35a],
    ice: [0xcff4ff, 0xa6e6ff, 0xffffff], roof: [0xff9fc2, 0xf27aa5, 0xffc4d8], tnt: [0xe63a2e, 0x5a3a24, 0xffd23f],
    char: [0xd8dde6, 0xffd3b0, 0x3d7bff], ground: [0x8bc46a, 0x6ea852, 0xa5d68a], rock: [0xb9b0a3, 0x9c9284, 0xd0c8bb],
};

// a tiny deterministic-enough jitter for effects (the view may use its own randomness, but this
// keeps screenshots of the same moment alike)
let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export class FX {
    constructor(scene, camera, popLayer) {
        this.scene = scene;
        this.camera = camera;
        this.popLayer = popLayer;
        this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
        this.shake = 0;

        // chips
        this.chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), CHIPS);
        this.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.chips.castShadow = true;
        this.chips.frustumCulled = false;
        this.chips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHIPS * 3), 3);
        this.chipData = Array.from({ length: CHIPS }, () => ({ life: 0 }));
        this.chipNext = 0;
        scene.add(this.chips);

        // puffs: a soft white material; colour per instance
        this.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff }), PUFFS);
        this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.puffs.frustumCulled = false;
        this.puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFFS * 3), 3);
        this.puffData = Array.from({ length: PUFFS }, () => ({ life: 0 }));
        this.puffNext = 0;
        scene.add(this.puffs);

        // fire: bright unlit puffs that cool from yellow to red as they swell and shrink away
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        // unlit spheres read as flat discs: darken toward the rim so each puff looks round
        fireMat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nvarying float vRim;')
                .replace('#include <project_vertex>', `#include <project_vertex>
                    vec3 kN = normal;
                    #ifdef USE_INSTANCING
                    kN = mat3(instanceMatrix) * kN;
                    #endif
                    kN = normalize(normalMatrix * kN);
                    vRim = clamp(dot(kN, normalize(-mvPosition.xyz)), 0.0, 1.0);`);
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying float vRim;')
                .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.25 + 0.75 * pow(vRim, 0.7);');
        };
        this.fires = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), fireMat, FIRES);
        this.fires.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.fires.frustumCulled = false;
        this.fires.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FIRES * 3), 3);
        this.fireData = Array.from({ length: FIRES }, () => ({ life: 0 }));
        this.fireNext = 0;
        scene.add(this.fires);
        this.hot = [new THREE.Color(0xfff6b0), new THREE.Color(0xffc02e), new THREE.Color(0xff6a1a), new THREE.Color(0xc42a12)];

        // a quick white-hot core
        this.balls = [];
        for (let i = 0; i < BALLS; i++) {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, depthWrite: false, toneMapped: false }));
            m.visible = false;
            scene.add(m);
            this.balls.push({ m, life: 0 });
        }
        // shockwave rings
        this.rings = [];
        for (let i = 0; i < RINGS; i++) {
            const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
            m.rotation.x = -Math.PI / 2;
            m.visible = false;
            scene.add(m);
            this.rings.push({ m, life: 0 });
        }
        // one flash light, always in the scene (adding lights later recompiles every material)
        this.flash = new THREE.PointLight(0xffb46a, 0, 30, 1.6);
        scene.add(this.flash);
        this.flashT = 0;

        this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
        this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    }

    chip(p, color, speed = 6, size = 0.12, up = 4) {
        const d = this.chipData[this.chipNext];
        this.chipNext = (this.chipNext + 1) % CHIPS;
        const a = rnd() * Math.PI * 2, e = rnd();
        Object.assign(d, {
            life: 1.6 + rnd() * 1.2, p: [p[0], p[1], p[2]],
            v: [Math.cos(a) * speed * e, up + rnd() * speed * 0.8, Math.sin(a) * speed * e],
            r: [rnd() * 6, rnd() * 6, rnd() * 6], w: [rnd() * 14 - 7, rnd() * 14 - 7, rnd() * 14 - 7],
            s: size * (0.5 + rnd()), color, glow: 0,
        });
        return d;
    }

    puff(p, color = 0xffffff, size = 0.6, rise = 1, life = 1.2, v = null) {
        const d = this.puffData[this.puffNext];
        this.puffNext = (this.puffNext + 1) % PUFFS;
        Object.assign(d, {
            life, max: life, p: [p[0] + (rnd() - 0.5) * size, p[1] + (rnd() - 0.5) * size * 0.5, p[2] + (rnd() - 0.5) * size],
            v: v || [(rnd() - 0.5) * 1.5, rise * (0.6 + rnd() * 0.8), (rnd() - 0.5) * 1.5], s: size * (0.6 + rnd() * 0.6), color,
        });
    }

    /** Pieces flying off a broken block. */
    burst(p, mat, n = 10, speed = 5) {
        const cols = MAT_COLORS[mat] || MAT_COLORS.stone;
        for (let i = 0; i < n; i++) this.chip(p, cols[i % cols.length], speed, mat === 'ice' ? 0.09 : 0.13);
        for (let i = 0; i < Math.ceil(n / 4); i++) this.puff(p, mat === 'ice' ? 0xeefcff : 0xf3eadb, 0.5, 0.8, 0.9);
    }

    fire(p, size, life, v) {
        const d = this.fireData[this.fireNext];
        this.fireNext = (this.fireNext + 1) % FIRES;
        Object.assign(d, { p: [...p], v, s: size, life, max: life });
    }

    /** A cartoon kaboom: a cluster of fire puffs, sparks, smoke, a shockwave ring, a flash. */
    boom(p, radius, big = true) {
        const n = big ? 26 : 14;
        for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2, e = rnd() * 0.9 - 0.2, r = radius * (0.15 + rnd() * 0.35);
            const dir = [Math.cos(a) * Math.cos(e), Math.abs(Math.sin(e)) + 0.25, Math.sin(a) * Math.cos(e)];
            this.fire([p[0] + dir[0] * r * 0.4, p[1] + dir[1] * r * 0.4, p[2] + dir[2] * r * 0.4],
                radius * (0.13 + rnd() * 0.14) * (big ? 1 : 0.8), 0.35 + rnd() * 0.35, [dir[0] * r * 3, dir[1] * r * 3, dir[2] * r * 3]);
        }
        const fb = this.balls.find((b) => b.life <= 0) || this.balls[0];
        fb.life = fb.max = 0.16;
        fb.size = radius * (big ? 0.3 : 0.22);
        fb.m.position.set(p[0], p[1], p[2]);
        fb.m.visible = true;
        const rg = this.rings.find((r) => r.life <= 0) || this.rings[0];
        rg.life = rg.max = 0.6;
        rg.size = radius * 1.6;
        rg.m.position.set(p[0], 0.06, p[2]);
        rg.m.visible = true;
        for (let i = 0; i < (big ? 26 : 14); i++) { const d = this.chip(p, [0xffd23f, 0xff8a2a, 0xff4a2a][i % 3], radius * 3, 0.08, 3); d.glow = 1; d.life = 0.7 + rnd() * 0.5; }
        for (let i = 0; i < (big ? 18 : 10); i++) this.puff([p[0], p[1] + radius * 0.2, p[2]], [0xb3aaa1, 0xcdc4ba, 0x958b82][i % 3], radius * 0.2, 1.8, 1.4 + rnd());
        this.flash.position.set(p[0], p[1] + 1, p[2]);
        this.flash.intensity = big ? 160 : 90;
        this.flashT = 0.35;
        this.addShake(big ? 0.55 : 0.3);
    }

    addShake(k) { if (!this.reduced) this.shake = Math.min(1, this.shake + k); }

    /** Floating text over a world point ("+500", "BONK!"). */
    pop(p, text, cls = '') {
        if (!this.popLayer) return;
        const el = document.createElement('div');
        el.className = 'pop ' + cls;
        el.textContent = text;
        el.dataset.x = p[0]; el.dataset.y = p[1]; el.dataset.z = p[2];
        el.dataset.t = '0';
        this.popLayer.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    update(dt, w, h) {
        const g = 11;
        // chips
        for (let i = 0; i < CHIPS; i++) {
            const d = this.chipData[i];
            if (d.life > 0) {
                d.life -= dt;
                d.v[1] -= g * dt;
                d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += d.v[2] * dt;
                if (d.p[1] < d.s * 0.5) { d.p[1] = d.s * 0.5; d.v[1] *= -0.3; d.v[0] *= 0.6; d.v[2] *= 0.6; d.w[0] *= 0.6; d.w[2] *= 0.6; }
                d.r[0] += d.w[0] * dt; d.r[1] += d.w[1] * dt; d.r[2] += d.w[2] * dt;
                const s = d.s * Math.min(1, d.life * 2);
                this.e.set(d.r[0], d.r[1], d.r[2]);
                this.q.setFromEuler(this.e);
                this.m.compose(this.v.set(d.p[0], d.p[1], d.p[2]), this.q, this.s.set(s, s, s));
                this.c.setHex(d.color);
                if (d.glow) this.c.multiplyScalar(2.2);
            } else {
                this.m.makeScale(0, 0, 0);
            }
            this.chips.setMatrixAt(i, this.m);
            this.chips.setColorAt(i, this.c);
        }
        this.chips.instanceMatrix.needsUpdate = true;
        this.chips.instanceColor.needsUpdate = true;
        // puffs: grow, rise, shrink away
        for (let i = 0; i < PUFFS; i++) {
            const d = this.puffData[i];
            if (d.life > 0) {
                d.life -= dt;
                const k = 1 - d.life / d.max;
                d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += d.v[2] * dt;
                d.v[0] *= 0.97; d.v[2] *= 0.97;
                const s = d.s * (0.6 + k * 1.2) * Math.min(1, (1 - k) * 3);
                this.m.compose(this.v.set(d.p[0], d.p[1], d.p[2]), this.q.identity(), this.s.set(s, s, s));
                this.c.setHex(d.color);
            } else this.m.makeScale(0, 0, 0);
            this.puffs.setMatrixAt(i, this.m);
            this.puffs.setColorAt(i, this.c);
        }
        this.puffs.instanceMatrix.needsUpdate = true;
        this.puffs.instanceColor.needsUpdate = true;
        // fire puffs
        for (let i = 0; i < FIRES; i++) {
            const d = this.fireData[i];
            if (d.life > 0) {
                d.life -= dt;
                const k = 1 - d.life / d.max;
                d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += d.v[2] * dt;
                d.v[0] *= 0.9; d.v[1] = d.v[1] * 0.9 + dt * 2; d.v[2] *= 0.9;
                const s = d.s * (0.5 + Math.sqrt(k) * 0.9) * Math.min(1, (1 - k) * 2.5);
                this.m.compose(this.v.set(d.p[0], d.p[1], d.p[2]), this.q.identity(), this.s.set(s, s, s));
                const f = Math.min(2.999, k * 3), j = Math.floor(f);
                this.c.copy(this.hot[j]).lerp(this.hot[j + 1], f - j);
            } else this.m.makeScale(0, 0, 0);
            this.fires.setMatrixAt(i, this.m);
            this.fires.setColorAt(i, this.c);
        }
        this.fires.instanceMatrix.needsUpdate = true;
        this.fires.instanceColor.needsUpdate = true;
        // the white-hot core, and rings
        for (const b of this.balls) {
            if (b.life <= 0) { b.m.visible = false; continue; }
            b.life -= dt;
            const k = 1 - b.life / b.max;
            b.m.scale.setScalar(b.size * (0.5 + k));
            b.m.material.opacity = Math.max(0, 1 - k);
            b.m.material.color.setHex(0xfffbe0);
        }
        for (const r of this.rings) {
            if (r.life <= 0) { r.m.visible = false; continue; }
            r.life -= dt;
            const k = 1 - r.life / r.max;
            r.m.scale.setScalar(r.size * (0.2 + k));
            r.m.material.opacity = (1 - k) * 0.8;
        }
        if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity *= 0.82; } else this.flash.intensity = 0;
        this.shake = Math.max(0, this.shake - dt * 1.8);
        // popups follow their world point
        if (this.popLayer) {
            for (const el of this.popLayer.children) {
                const t = (+el.dataset.t || 0) + dt;
                el.dataset.t = t;
                this.v.set(+el.dataset.x, +el.dataset.y + t * 1.2, +el.dataset.z).project(this.camera);
                if (this.v.z > 1) { el.style.opacity = 0; continue; }
                el.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * w}px, ${(-this.v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${Math.min(1, t * 6)})`;
                el.style.opacity = String(Math.max(0, Math.min(1, (1.3 - t) * 2)));
            }
        }
    }
}
