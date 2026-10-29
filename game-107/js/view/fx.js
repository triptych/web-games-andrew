// Effects: billboard puffs (dust, smoke, fire), flying chips, shockwave rings and floating score text.
// All view-side and random; none of it touches the simulation.

import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const VS = `
attribute vec3 aColor;
attribute float aAlpha;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
    vUv = uv; vCol = aColor; vA = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FS = `
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.25, d) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol, a);
}`;

export class Puffs {
    constructor(scene, cap = 520) {
        this.cap = cap;
        this.list = [];
        const g = new THREE.PlaneGeometry(1, 1);
        this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
        g.setAttribute('aColor', this.aColor);
        g.setAttribute('aAlpha', this.aAlpha);
        const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false });
        this.mesh = new THREE.InstancedMesh(g, m, cap);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        this.mesh.count = 0;
        scene.add(this.mesh);
        this._o = new THREE.Object3D();
    }

    emit(x, y, z, n, o = {}) {
        const col = hexRGB(o.color ?? 0xdddddd);
        for (let i = 0; i < n; i++) {
            if (this.list.length >= this.cap) this.list.shift();
            const sp = o.speed ?? 2, a = Math.random() * Math.PI * 2;
            this.list.push({
                x: x + rand(-1, 1) * (o.spread ?? 0), y: y + rand(0, 1) * (o.spreadY ?? 0), z: z + rand(-1, 1) * (o.spread ?? 0),
                vx: Math.cos(a) * rand(0.2, 1) * sp, vy: (o.up ?? 1.5) * rand(0.4, 1), vz: Math.sin(a) * rand(0.2, 1) * sp,
                age: 0, life: (o.life ?? 0.9) * rand(0.7, 1.2), s0: (o.size ?? 1) * rand(0.6, 1), grow: o.grow ?? 1.8,
                alpha: o.alpha ?? 0.8, drag: o.drag ?? 1.2, g: o.gravity ?? 0, col: o.jitter ? col.map((c) => Math.min(1, Math.max(0, c + rand(-0.08, 0.08)))) : col,
            });
        }
    }

    update(dt, camQuat) {
        const o = this._o, arr = this.list;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const p = arr[i];
            p.age += dt;
            if (p.age >= p.life) continue;
            const k = Math.exp(-p.drag * dt);
            p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            const t = p.age / p.life;
            const s = p.s0 * (1 + t * p.grow);
            o.position.set(p.x, p.y, p.z);
            o.quaternion.copy(camQuat);
            o.scale.setScalar(s);
            o.updateMatrix();
            this.mesh.setMatrixAt(w, o.matrix);
            this.aColor.setXYZ(w, p.col[0], p.col[1], p.col[2]);
            this.aAlpha.setX(w, p.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85));
            arr[w] = p;
            w++;
        }
        arr.length = w;
        this.mesh.count = w;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.aColor.needsUpdate = true;
        this.aAlpha.needsUpdate = true;
    }
}

export class Chips {
    constructor(scene, cap = 320) {
        this.cap = cap;
        this.list = [];
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), cap);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        scene.add(this.mesh);
        this._o = new THREE.Object3D();
        this._c = new THREE.Color();
    }

    emit(x, y, z, n, color, speed = 5, size = 0.3) {
        for (let i = 0; i < n; i++) {
            if (this.list.length >= this.cap) this.list.shift();
            const a = Math.random() * Math.PI * 2, s = speed * rand(0.3, 1);
            this.list.push({
                x, y, z, vx: Math.cos(a) * s, vy: rand(2, 7), vz: Math.sin(a) * s, rx: rand(0, 6), ry: rand(0, 6),
                spin: rand(-8, 8), size: size * rand(0.6, 1.3), age: 0, life: rand(1.1, 1.8), color,
            });
        }
    }

    update(dt) {
        const o = this._o, arr = this.list;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const p = arr[i];
            p.age += dt;
            if (p.age >= p.life) continue;
            p.vy -= 22 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < p.size * 0.5) { p.y = p.size * 0.5; p.vy = -p.vy * 0.35; p.vx *= 0.7; p.vz *= 0.7; }
            p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
            const sc = p.size * (p.age > p.life - 0.3 ? (p.life - p.age) / 0.3 : 1);
            o.position.set(p.x, p.y, p.z);
            o.rotation.set(p.rx, p.ry, 0);
            o.scale.set(sc, sc * 0.8, sc);
            o.updateMatrix();
            this.mesh.setMatrixAt(w, o.matrix);
            this.mesh.setColorAt(w, this._c.set(p.color));
            arr[w] = p;
            w++;
        }
        arr.length = w;
        this.mesh.count = w;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}

export class Rings {
    constructor(scene, n = 16) {
        this.items = [];
        const g = new THREE.RingGeometry(0.82, 1, 40);
        g.rotateX(-Math.PI / 2);
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            m.visible = false; m.renderOrder = 4;
            scene.add(m);
            this.items.push({ m, age: 0, life: 1, R: 1, on: false });
        }
    }
    emit(x, z, R, color = 0xffffff, life = 0.6, y = 0.36) {
        const it = this.items.find((i) => !i.on) || this.items[0];
        it.on = true; it.age = 0; it.life = life; it.R = R;
        it.m.material.color.set(color);
        it.m.position.set(x, y, z);
        it.m.visible = true;
    }
    update(dt) {
        for (const it of this.items) {
            if (!it.on) continue;
            it.age += dt;
            const t = it.age / it.life;
            if (t >= 1) { it.on = false; it.m.visible = false; continue; }
            const e = 1 - (1 - t) * (1 - t);
            it.m.scale.setScalar(0.2 + it.R * e);
            it.m.material.opacity = 0.9 * (1 - t);
        }
    }
}

/** Floating text in the DOM, pinned to a world point when it spawns. */
export class Popups {
    constructor(host) { this.host = host; this.n = 0; }
    add(text, sx, sy, cls = '') {
        if (!this.host || this.n > 14) return;
        const el = document.createElement('div');
        el.className = 'pop ' + cls;
        el.textContent = text;
        el.style.left = sx + 'px';
        el.style.top = sy + 'px';
        this.host.appendChild(el);
        this.n++;
        el.addEventListener('animationend', () => { el.remove(); this.n--; });
    }
}
