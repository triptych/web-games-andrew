// Particles: sparks, smoke, steam, glints, drips, dust motes. Two points systems (additive and
// alpha) with CPU-integrated particles, plus the falling rain.

import * as THREE from 'three';
import * as TX from './textures.js';

const VERT = `
attribute float size; attribute vec4 pcolor;
varying vec4 vColor; uniform float scale;
void main() {
    vColor = pcolor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, size * scale / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map; varying vec4 vColor;
void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.003) discard;
}`;

class Points {
    constructor(cap, additive, tex) {
        this.cap = cap;
        this.p = Array.from({ length: cap }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 1, c: new THREE.Color(), a: 1, g: 0, drag: 0 }));
        this.next = 0;
        this.geo = new THREE.BufferGeometry();
        this.pos = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.col = new Float32Array(cap * 4);
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4));
        this.mat = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: tex }, scale: { value: 600 } },
        });
        this.points = new THREE.Points(this.geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 12 : 11;
    }
    emit(o) {
        const q = this.p[this.next]; this.next = (this.next + 1) % this.cap;
        q.on = true; q.age = 0;
        q.x = o.x; q.y = o.y; q.z = o.z; q.vx = o.vx || 0; q.vy = o.vy || 0; q.vz = o.vz || 0;
        q.life = o.life || 0.6; q.s0 = o.s0 ?? 0.2; q.s1 = o.s1 ?? q.s0; q.a = o.a ?? 1; q.g = o.g ?? 0; q.drag = o.drag ?? 0;
        q.c.set(o.color ?? 0xffffff);
    }
    update(dt, scale) {
        this.mat.uniforms.scale.value = scale;
        for (let i = 0; i < this.cap; i++) {
            const q = this.p[i];
            if (!q.on) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
            q.age += dt;
            if (q.age >= q.life) { q.on = false; this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
            const k = q.age / q.life;
            q.vy -= q.g * dt;
            const d = Math.exp(-q.drag * dt);
            q.vx *= d; q.vy *= d; q.vz *= d;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (q.y < 0.02 && q.g > 0) { q.y = 0.02; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
            this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
            this.size[i] = q.s0 + (q.s1 - q.s0) * k;
            this.col[i * 4] = q.c.r; this.col[i * 4 + 1] = q.c.g; this.col[i * 4 + 2] = q.c.b;
            this.col[i * 4 + 3] = q.a * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
        }
        this.geo.attributes.position.needsUpdate = true; this.geo.attributes.size.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true;
    }
}

export class FX {
    constructor(scene) {
        this.add = new Points(900, true, TX.spriteTex('spark'));
        this.alpha = new Points(500, false, TX.spriteTex('smoke'));
        this.glow = new Points(300, true, TX.spriteTex('glow'));
        scene.add(this.add.points, this.alpha.points, this.glow.points);
        this.rand = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    }
    r(a = 1) { return (this.rand() - 0.5) * 2 * a; }

    sparks(x, y, z, n = 12, color = 0xffb040, speed = 3.4) {
        for (let i = 0; i < n; i++) this.add.emit({ x, y, z, vx: this.r(speed), vy: 1 + this.rand() * speed, vz: this.r(speed), life: 0.35 + this.rand() * 0.5, s0: 0.2, s1: 0.04, g: 9, drag: 0.8, color });
    }
    smoke(x, y, z, n = 4, color = 0x888890, s = 0.9) {
        for (let i = 0; i < n; i++) this.alpha.emit({ x: x + this.r(0.2), y, z: z + this.r(0.2), vx: this.r(0.25), vy: 0.7 + this.rand() * 0.7, vz: this.r(0.25), life: 1.6 + this.rand(), s0: 0.45, s1: s * 2, a: 0.55, drag: 0.5, color });
    }
    steam(x, y, z) { this.alpha.emit({ x: x + this.r(0.6), y, z: z + this.r(0.6), vx: this.r(0.1), vy: 0.5 + this.rand() * 0.5, vz: this.r(0.1), life: 2.4, s0: 0.5, s1: 2.2, a: 0.16, drag: 0.3, color: 0xcfd8e8 }); }
    glints(x, y, z, n = 10, color = 0x8cffd0) {
        for (let i = 0; i < n; i++) this.glow.emit({ x: x + this.r(0.5), y: y + this.rand() * 0.4, z: z + this.r(0.5), vx: this.r(0.5), vy: 0.6 + this.rand() * 1.2, vz: this.r(0.5), life: 0.7 + this.rand() * 0.6, s0: 0.42, s1: 0.05, g: -0.3, color });
    }
    chips(x, y, z) { for (let i = 0; i < 4; i++) this.add.emit({ x, y, z, vx: this.r(1.2), vy: 0.8 + this.rand() * 1.4, vz: this.r(1.2), life: 0.5, s0: 0.12, s1: 0.04, g: 10, drag: 0.5, color: 0xd8dce4 }); }
    drip(x, y, z) { this.alpha.emit({ x, y, z, vy: -1, life: 0.5, s0: 0.1, s1: 0.1, g: 8, a: 0.9, color: 0x2a1c0c }); }
    foam(x, y, z) { this.alpha.emit({ x: x + this.r(0.3), y: y + 0.1, z: z + this.r(0.3), vx: this.r(0.5), vy: 0.4, vz: this.r(0.5), life: 0.6, s0: 0.2, s1: 0.5, a: 0.5, color: 0xe8f4ee }); }
    solder(x, y, z) { this.alpha.emit({ x, y: y + 0.2, z, vx: this.r(0.1), vy: 0.8, vz: this.r(0.1), life: 1.0, s0: 0.2, s1: 0.7, a: 0.25, color: 0xd0d0d0 }); this.add.emit({ x, y: y + 0.1, z, vx: this.r(1), vy: 0.8 + this.rand(), vz: this.r(1), life: 0.3, s0: 0.14, s1: 0.03, g: 7, color: 0xffd080 }); }
    confetti(x, y, z, n = 40) {
        const cols = [0xff3d8b, 0x35e0ff, 0xffb13d, 0x8c5cff, 0x4dff9a];
        for (let i = 0; i < n; i++) this.glow.emit({ x: x + this.r(1.5), y: y + 1, z: z + this.r(1.5), vx: this.r(3), vy: 3 + this.rand() * 4, vz: this.r(3), life: 1.4 + this.rand(), s0: 0.35, s1: 0.1, g: 6, drag: 0.4, color: cols[i % cols.length] });
    }
    update(dt, h) {
        const scale = h * 0.55;
        this.add.update(dt, scale); this.alpha.update(dt, scale); this.glow.update(dt, scale);
    }
}

/** Falling rain streaks beyond the window (and a few that wander into the room's light). */
export class Rain {
    constructor(count = 700, box = { x0: -20, x1: 20, y0: -8, y1: 22, z0: -34, z1: -12 }) {
        this.box = box; this.n = count;
        this.pos = new Float32Array(count * 6);
        this.v = new Float32Array(count);
        this.seed = 1;
        for (let i = 0; i < count; i++) this.reset(i, true);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.mat = new THREE.LineBasicMaterial({ color: 0x9ac4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
        this.lines = new THREE.LineSegments(this.geo, this.mat);
        this.lines.frustumCulled = false;
    }
    rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    reset(i, anywhere) {
        const b = this.box;
        const x = b.x0 + this.rnd() * (b.x1 - b.x0), z = b.z0 + this.rnd() * (b.z1 - b.z0);
        const y = anywhere ? b.y0 + this.rnd() * (b.y1 - b.y0) : b.y1;
        const len = 0.8 + this.rnd() * 1.4;
        this.v[i] = 14 + this.rnd() * 10;
        this.pos.set([x, y, z, x - 0.05, y + len, z], i * 6);
    }
    update(dt) {
        for (let i = 0; i < this.n; i++) {
            const o = i * 6, d = this.v[i] * dt;
            this.pos[o + 1] -= d; this.pos[o + 4] -= d; this.pos[o] -= d * 0.06; this.pos[o + 3] -= d * 0.06;
            if (this.pos[o + 4] < this.box.y0) this.reset(i, false);
        }
        this.geo.attributes.position.needsUpdate = true;
    }
}
