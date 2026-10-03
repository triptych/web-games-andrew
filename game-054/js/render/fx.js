/**
 * fx.js — particles, flashes, beams, decals and gibs.
 *
 *  Particles  two GPU point clouds (additive: sparks, fire, plasma; alpha:
 *             smoke, blood, dust), simulated on the CPU, one draw call each.
 *  Flashes    pooled additive billboards that grow and fade (muzzle flashes,
 *             explosions, impacts), plus expanding shockwave rings.
 *  Beams      camera-facing quads between points: tracers, the rail beam,
 *             the Singularity's lightning tethers, the Archon's beam.
 *  Decals     one InstancedMesh ring buffer: bullet holes, scorch marks,
 *             blood splats, sampled from a painted atlas, lit by the lightmap.
 *  Debris     InstancedMesh chunks with gravity and floor bounces: gibs,
 *             shell casings, rubble.
 * All pools have fixed sizes; the quality tier scales how many we spawn.
 */
import * as THREE from 'three';
import { G, glowMaterial, GLOW_GEO } from './materials.js';
import { CELL } from '../config.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ particles

const PVS = /* glsl */`
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main(){
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
}
`;
const PFS = /* glsl */`
varying vec4 vColor;
uniform float uSoft;
void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = smoothstep(1.0, uSoft, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}
`;

class Particles {
    constructor(scene, max, additive) {
        this.max = max;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 4);
        this.size = new Float32Array(max);
        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
        this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
        this.grav = new Float32Array(max); this.drag = new Float32Array(max);
        this.floorY = new Float32Array(max);
        this.count = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uScale: { value: 600 }, uSoft: { value: additive ? 0.0 : 0.3 } },
            vertexShader: PVS, fragmentShader: PFS,
            transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 20 : 10;
        scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav = 0, drag = 0, floorY = -1e9) {
        if (this.count >= this.max) return;
        const i = this.count++;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
        this.life[i] = life; this.maxLife[i] = life;
        this.s0[i] = s0; this.s1[i] = s1;
        this.c0.set(c0, i * 4); this.c1.set(c1, i * 4);
        this.grav[i] = grav; this.drag[i] = drag; this.floorY[i] = floorY;
    }
    update(dt) {
        let n = this.count;
        for (let i = 0; i < n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                n--;
                if (i !== n) this._copy(n, i);
                i--;
                continue;
            }
            const k = 1 - this.life[i] / this.maxLife[i];
            const dr = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
            this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            if (this.pos[i * 3 + 1] < this.floorY[i]) { this.pos[i * 3 + 1] = this.floorY[i]; this.vel[i * 3 + 1] *= -0.25; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; }
            this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
            for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * k;
        }
        this.count = n;
        this.geo.setDrawRange(0, n);
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aColor.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
    }
    _copy(from, to) {
        for (let c = 0; c < 3; c++) { this.pos[to * 3 + c] = this.pos[from * 3 + c]; this.vel[to * 3 + c] = this.vel[from * 3 + c]; }
        for (let c = 0; c < 4; c++) { this.c0[to * 4 + c] = this.c0[from * 4 + c]; this.c1[to * 4 + c] = this.c1[from * 4 + c]; this.col[to * 4 + c] = this.col[from * 4 + c]; }
        this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
        this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from]; this.size[to] = this.size[from];
        this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.floorY[to] = this.floorY[from];
    }
    clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

// ------------------------------------------------------------------ beams

const BVS = /* glsl */`
attribute vec3 aOther;
attribute float aSide;
attribute float aWidth;
attribute vec4 aColor;
varying vec2 vUv;
varying vec4 vColor;
void main(){
    vUv = vec2(uv.x, aSide * 0.5 + 0.5);
    vColor = aColor;
    vec4 a = modelViewMatrix * vec4(position, 1.0);
    vec4 b = modelViewMatrix * vec4(aOther, 1.0);
    vec3 dir = normalize(b.xyz - a.xyz);
    vec3 side = normalize(cross(dir, normalize(-a.xyz)));
    a.xyz += side * aSide * aWidth;
    gl_Position = projectionMatrix * a;
}
`;
const BFS = /* glsl */`
varying vec2 vUv;
varying vec4 vColor;
void main(){
    float d = abs(vUv.y - 0.5) * 2.0;
    float core = smoothstep(0.35, 0.0, d);
    float glow = pow(1.0 - d, 2.0);
    gl_FragColor = vec4(vColor.rgb * glow + vec3(1.0) * core * vColor.a, 1.0) * vColor.a;
}
`;

class Beams {
    constructor(scene, max = 96) {
        this.max = max;
        this.items = [];
        const n = max * 4;
        this.pos = new Float32Array(n * 3);
        this.other = new Float32Array(n * 3);
        this.side = new Float32Array(n);
        this.width = new Float32Array(n);
        this.color = new Float32Array(n * 4);
        this.uv = new Float32Array(n * 2);
        const idx = [];
        for (let i = 0; i < max; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aOther', new THREE.BufferAttribute(this.other, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSide', new THREE.BufferAttribute(this.side, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aWidth', new THREE.BufferAttribute(this.width, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
        g.setIndex(idx);
        this.geo = g;
        this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: BVS, fragmentShader: BFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 30;
        scene.add(this.mesh);
    }
    /** a, b: [x,y,z]; life seconds; jag: lightning segments */
    add(a, b, color, width, life, jag = 0) {
        if (jag > 0) {
            const segs = jag;
            let prev = a;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            for (let s = 1; s <= segs; s++) {
                const t = s / segs;
                const off = s === segs ? 0 : len * 0.08;
                const p = [a[0] + (b[0] - a[0]) * t + rnd(-off, off), a[1] + (b[1] - a[1]) * t + rnd(-off, off), a[2] + (b[2] - a[2]) * t + rnd(-off, off)];
                this._push(prev, p, color, width, life);
                prev = p;
            }
            return;
        }
        this._push(a, b, color, width, life);
    }
    _push(a, b, color, width, life) {
        if (this.items.length >= this.max) this.items.shift();
        const c = typeof color === 'number' ? [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255] : color;
        this.items.push({ a, b, c, width, life, max: life });
    }
    update(dt) {
        const its = this.items;
        for (let i = its.length - 1; i >= 0; i--) { its[i].life -= dt; if (its[i].life <= 0) its.splice(i, 1); }
        for (let i = 0; i < its.length; i++) {
            const it = its[i];
            const k = it.life / it.max;
            for (let v = 0; v < 4; v++) {
                const j = i * 4 + v;
                const atB = v >= 2;
                const p = atB ? it.b : it.a, o = atB ? it.a : it.b;
                this.pos.set(p, j * 3);
                // flip "other" direction at the far end so the side vector agrees
                this.other.set(atB ? [2 * p[0] - o[0], 2 * p[1] - o[1], 2 * p[2] - o[2]] : o, j * 3);
                this.side[j] = v % 2 ? 1 : -1;
                this.width[j] = it.width * (0.5 + 0.5 * k);
                this.color[j * 4] = it.c[0]; this.color[j * 4 + 1] = it.c[1]; this.color[j * 4 + 2] = it.c[2]; this.color[j * 4 + 3] = k;
                this.uv[j * 2] = atB ? 1 : 0;
            }
        }
        this.geo.setDrawRange(0, its.length * 6);
        for (const a of ['position', 'aOther', 'aSide', 'aWidth', 'aColor']) this.geo.attributes[a].needsUpdate = true;
    }
    clear() { this.items.length = 0; this.geo.setDrawRange(0, 0); }
}

// ------------------------------------------------------------------ decals

function decalAtlas() {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const cell = S / 2;
    // 0: bullet hole
    let cx = cell / 2, cy = cell / 2;
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.45);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.18, 'rgba(10,8,6,0.95)'); gr.addColorStop(0.3, 'rgba(40,35,30,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, cell, cell);
    // 1: scorch
    cx = cell * 1.5;
    gr = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.48);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.5, 'rgba(10,6,4,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(cell, 0, cell, cell);
    for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, l = cell * (0.3 + Math.random() * 0.2);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2 + Math.random() * 4;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke();
    }
    // 2: blood splat (white, tinted per decal)
    cx = cell / 2; cy = cell * 1.5;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 22; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * cell * 0.32, s = cell * (0.04 + Math.random() * 0.12) * (1 - r / (cell * 0.4));
        g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(2, s), 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(cx, cy, cell * 0.16, 0, Math.PI * 2); g.fill();
    // 3: plasma burn ring
    cx = cell * 1.5;
    gr = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.4);
    gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.6, 'rgba(20,20,40,0.6)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(cell, cell, cell, cell);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const DVS = /* glsl */`
attribute vec4 aDecal;   // atlas tile (x,y), alpha, unused
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAlpha;
varying vec3 vTint;
varying vec3 vView;
void main(){
    vUv = (uv + aDecal.xy) * 0.5;
    vAlpha = aDecal.z;
    vTint = aTint;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}
`;
const DFS = /* glsl */`
uniform sampler2D uAtlas;
uniform sampler2D uLM;
uniform vec2 uLMSize;
uniform vec3 uFog;
uniform float uFogD;
uniform vec3 uAmb;
varying vec2 vUv;
varying vec3 vWorld;
varying float vAlpha;
varying vec3 vTint;
varying vec3 vView;
void main(){
    vec4 t = texture2D(uAtlas, vUv);
    vec3 light = uAmb + texture2D(uLM, vWorld.xz / uLMSize).rgb;
    vec3 col = t.rgb * vTint * light;
    float f = 1.0 - exp(-pow(length(vView) * uFogD, 1.5));
    col = mix(col, uFog, clamp(f, 0.0, 1.0));
    gl_FragColor = vec4(col, t.a * vAlpha);
}
`;

class Decals {
    constructor(scene, max = 192) {
        this.max = max;
        this.next = 0;
        const geo = new THREE.PlaneGeometry(1, 1);
        this.aDecal = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
        this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        geo.setAttribute('aDecal', this.aDecal);
        geo.setAttribute('aTint', this.aTint);
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uAtlas: { value: decalAtlas() }, uLM: G.uLM, uLMSize: G.uLMSize, uFog: G.uFog, uFogD: G.uFogD, uAmb: G.uAmb },
            vertexShader: DVS, fragmentShader: DFS,
            transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        });
        this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        scene.add(this.mesh);
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._n = new THREE.Vector3(); this._z = new THREE.Vector3(0, 0, 1);
    }
    add(x, y, z, nx, ny, nz, type, size, tint = [1, 1, 1]) {
        const i = this.next;
        this.next = (this.next + 1) % this.max;
        this._n.set(nx, ny, nz).normalize();
        this._q.setFromUnitVectors(this._z, this._n);
        const spin = new THREE.Quaternion().setFromAxisAngle(this._z, Math.random() * Math.PI * 2);
        this._q.multiply(spin);
        this._m.compose(new THREE.Vector3(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01), this._q, new THREE.Vector3(size, size, size));
        this.mesh.setMatrixAt(i, this._m);
        const tile = [[0, 1], [1, 1], [0, 0], [1, 0]][type];
        this.aDecal.setXYZW(i, tile[0], tile[1], 1, 0);
        this.aTint.setXYZ(i, tint[0], tint[1], tint[2]);
        this.mesh.count = Math.min(this.max, Math.max(this.mesh.count, i + 1));
        this.mesh.instanceMatrix.needsUpdate = true;
        this.aDecal.needsUpdate = true;
        this.aTint.needsUpdate = true;
    }
    clear() { this.mesh.count = 0; this.next = 0; }
}

// ------------------------------------------------------------------ debris (gibs, shells, rubble)

class Debris {
    constructor(scene, world, max = 160) {
        this.max = max;
        this.items = [];
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.ShaderMaterial({
            uniforms: { ...G },
            vertexShader: /* glsl */`
                varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor; varying vec3 vView;
                void main(){
                    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
                    vWorld = wp.xyz; vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
                    vColor = instanceColor; vec4 mv = viewMatrix * wp; vView = -mv.xyz; gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uLM; uniform vec2 uLMSize; uniform vec3 uAmb; uniform vec3 uFog; uniform float uFogD;
                varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor; varying vec3 vView;
                void main(){
                    vec3 l = uAmb * 1.5 + texture2D(uLM, vWorld.xz / uLMSize).rgb;
                    vec3 col = vColor * l * (0.6 + 0.4 * max(vNormal.y, 0.0));
                    float f = 1.0 - exp(-pow(length(vView) * uFogD, 1.5));
                    gl_FragColor = vec4(mix(col, uFog, clamp(f, 0.0, 1.0)), 1.0);
                }`,
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.world = world;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
        this._c = new THREE.Color();
    }
    add(x, y, z, vx, vy, vz, size, color, life = 6, bounce = 0.35) {
        if (this.items.length >= this.max) this.items.shift();
        this.items.push({ x, y, z, vx, vy, vz, size, color, life, bounce, rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6), sx: rnd(-12, 12), sy: rnd(-12, 12), rest: false });
    }
    update(dt) {
        const w = this.world;
        let n = 0;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const p = this.items[i];
            p.life -= dt;
            if (p.life <= 0) { this.items.splice(i, 1); continue; }
        }
        for (const p of this.items) {
            if (!p.rest) {
                p.vy -= 20 * dt;
                const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
                const ci = w ? w.cellAt(nx, nz) : -1;
                if (ci < 0 || !w.L.open[ci] || w.L.floor[ci] > p.y + 0.3) { p.vx *= -0.4; p.vz *= -0.4; }
                else { p.x = nx; p.z = nz; }
                p.y += p.vy * dt;
                const c2 = w ? w.cellAt(p.x, p.z) : -1;
                const fl = c2 >= 0 ? w.L.floor[c2] + p.size * 0.5 : 0;
                if (p.y < fl) {
                    p.y = fl;
                    p.vy = -p.vy * p.bounce; p.vx *= 0.6; p.vz *= 0.6; p.sx *= 0.5; p.sy *= 0.5;
                    if (Math.abs(p.vy) < 0.6) { p.rest = true; p.rx = Math.round(p.rx / (Math.PI / 2)) * (Math.PI / 2); }
                }
                p.rx += p.sx * dt; p.ry += p.sy * dt;
            }
            const sc = p.life < 1 ? p.size * p.life : p.size;
            this._e.set(p.rx, p.ry, p.rz);
            this._q.setFromEuler(this._e);
            this._m.compose(new THREE.Vector3(p.x, p.y, p.z), this._q, new THREE.Vector3(sc, sc * 0.8, sc * 1.1));
            this.mesh.setMatrixAt(n, this._m);
            this.mesh.setColorAt(n, this._c.setRGB(p.color[0], p.color[1], p.color[2]));
            n++;
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    clear() { this.items.length = 0; this.mesh.count = 0; }
}

// ------------------------------------------------------------------ flashes + rings

class Flashes {
    constructor(scene, max = 48) {
        this.pool = [];
        this.live = [];
        for (let i = 0; i < max; i++) {
            const m = new THREE.Mesh(GLOW_GEO, glowMaterial(0xffffff, 0xffffff, 1, 2.0));
            m.material.uniforms.uNearFade.value = 0;   // muzzle flashes live right at the eye
            m.visible = false; m.renderOrder = 25; m.frustumCulled = false;
            scene.add(m);
            this.pool.push(m);
        }
        this.ringPool = [];
        const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
        for (let i = 0; i < 8; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
            const m = new THREE.Mesh(ringGeo, mat);
            m.visible = false; m.rotation.x = -Math.PI / 2; m.renderOrder = 26;
            scene.add(m);
            this.ringPool.push(m);
        }
        this.rings = [];
    }
    add(x, y, z, color, size0, size1, life, core = 0xffffff, intensity = 1.6) {
        const m = this.pool.find((p) => !p.visible);
        if (!m) return;
        m.visible = true;
        m.position.set(x, y, z);
        m.material.uniforms.uColor.value.set(color);
        m.material.uniforms.uCore.value.set(core);
        this.live.push({ m, s0: size0, s1: size1, life, max: life, intensity });
    }
    ring(x, y, z, color, r1, life) {
        const m = this.ringPool.find((p) => !p.visible);
        if (!m) return;
        m.visible = true; m.position.set(x, y + 0.08, z); m.material.color.set(color);
        this.rings.push({ m, r1, life, max: life });
    }
    update(dt) {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const f = this.live[i];
            f.life -= dt;
            if (f.life <= 0) { f.m.visible = false; this.live.splice(i, 1); continue; }
            const k = 1 - f.life / f.max;
            const s = f.s0 + (f.s1 - f.s0) * (1 - Math.pow(1 - k, 2));
            f.m.scale.setScalar(s);
            f.m.material.uniforms.uIntensity.value = f.intensity * Math.pow(1 - k, 1.5);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= dt;
            if (r.life <= 0) { r.m.visible = false; this.rings.splice(i, 1); continue; }
            const k = 1 - r.life / r.max;
            r.m.scale.setScalar(0.2 + r.r1 * (1 - Math.pow(1 - k, 3)));
            r.m.material.opacity = (1 - k) * 0.9;
        }
    }
    clear() { for (const f of this.live) f.m.visible = false; this.live.length = 0; for (const r of this.rings) r.m.visible = false; this.rings.length = 0; }
}

// ------------------------------------------------------------------ the facade

export class FX {
    constructor(scene, renderer) {
        this.scene = scene;
        this.R = renderer;
        this.add = new Particles(scene, 2400, true);
        this.alpha = new Particles(scene, 1400, false);
        this.beams = new Beams(scene);
        this.decals = new Decals(scene);
        this.flashes = new Flashes(scene);
        this.debris = new Debris(scene, null);
        this.lights = [];   // short-lived dynamic lights {x,y,z,color,radius,intensity,life,max}
        this.budget = 1;
        this.shake = 0;
    }
    setWorld(world) { this.debris.world = world; this.world = world; }
    setBudget(b) { this.budget = b; }

    light(x, y, z, color, radius, intensity, life) { this.lights.push({ x, y, z, color, radius, intensity, life, max: life }); }

    update(dt, pixelScale) {
        this.add.mat.uniforms.uScale.value = pixelScale;
        this.alpha.mat.uniforms.uScale.value = pixelScale;
        this.add.update(dt); this.alpha.update(dt);
        this.beams.update(dt); this.flashes.update(dt); this.debris.update(dt);
        for (let i = this.lights.length - 1; i >= 0; i--) {
            const l = this.lights[i];
            l.life -= dt;
            if (l.life <= 0) { this.lights.splice(i, 1); continue; }
            const k = l.life / l.max;
            this.R.light(l.x, l.y, l.z, l.color, l.radius, l.intensity * k, 2);
        }
        this.shake = Math.max(0, this.shake - dt * 2.2);
    }

    clear() { this.add.clear(); this.alpha.clear(); this.beams.clear(); this.decals.clear(); this.flashes.clear(); this.debris.clear(); this.lights.length = 0; }

    _n(k) { return Math.max(1, Math.round(k * this.budget)); }

    // -------------------------------------------------------- recipes
    muzzle(x, y, z, color = 0xffc070, size = 0.6) {
        this.flashes.add(x, y, z, color, size * 0.6, size, 0.06, 0xffffff, 2.2);
        this.light(x, y, z, color, 9, 1.6, 0.07);
    }
    sparks(x, y, z, nx, ny, nz, n = 6, color = [1, 0.75, 0.35]) {
        for (let i = 0; i < this._n(n); i++) {
            const s = rnd(2, 7);
            this.add.spawn(x, y, z, nx * s + rnd(-3, 3), ny * s + rnd(-1, 4), nz * s + rnd(-3, 3), rnd(0.15, 0.4), 0.09, 0.02, [...color, 1], [color[0], color[1] * 0.4, 0, 0], 14, 1);
        }
        this.alpha.spawn(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx * 0.5, 0.4, nz * 0.5, 0.6, 0.15, 0.6, [0.4, 0.38, 0.35, 0.5], [0.3, 0.3, 0.3, 0], -0.3, 1);
    }
    impact(hit, kind = 'bullet') {
        if (hit.what === 'sky' || hit.what === 'none') return;
        this.sparks(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, kind === 'bullet' ? 5 : 3);
        if (hit.what !== 'door') this.decals.add(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, kind === 'plasma' ? 3 : 0, kind === 'bullet' ? rnd(0.1, 0.16) : 0.3);
        this.flashes.add(hit.x + hit.nx * 0.05, hit.y + hit.ny * 0.05, hit.z + hit.nz * 0.05, 0xffaa55, 0.1, 0.3, 0.06, 0xffffff, 1.2);
    }
    blood(x, y, z, color, n = 8, dir = null) {
        const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
        const fy = this.world ? this.world.L.floor[this.world.cellAt(x, z)] ?? 0 : 0;
        for (let i = 0; i < this._n(n); i++) {
            const dx = (dir ? dir[0] * 3 : 0) + rnd(-2.5, 2.5), dz = (dir ? dir[2] * 3 : 0) + rnd(-2.5, 2.5);
            this.alpha.spawn(x, y, z, dx, rnd(0.5, 4), dz, rnd(0.4, 0.9), rnd(0.08, 0.16), 0.04, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 1], [c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, 0.8], 14, 0.5, fy + 0.02);
        }
        this.alpha.spawn(x, y, z, 0, 0.3, 0, 0.5, 0.2, 0.7, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 0.6], [c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 0], 0, 2);
    }
    bloodSplat(x, z, floorY, color, size = 1) {
        const c = [((color >> 16) & 255) / 255 * 0.6, ((color >> 8) & 255) / 255 * 0.6, (color & 255) / 255 * 0.6];
        this.decals.add(x + rnd(-0.3, 0.3), floorY + 0.005, z + rnd(-0.3, 0.3), 0, 1, 0, 2, size * rnd(0.7, 1.3), c);
    }
    gibs(x, y, z, color, n = 10, force = 6) {
        const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
        for (let i = 0; i < this._n(n); i++) {
            const a = rnd(0, Math.PI * 2), s = rnd(2, force);
            this.debris.add(x + rnd(-0.3, 0.3), y + rnd(0, 0.8), z + rnd(-0.3, 0.3), Math.cos(a) * s, rnd(3, 8), Math.sin(a) * s, rnd(0.1, 0.3), i % 3 ? [c[0] * 0.7, c[1] * 0.6, c[2] * 0.6] : [0.85, 0.78, 0.65], rnd(5, 9));
        }
        this.blood(x, y + 0.5, z, color, n * 2);
    }
    shell(x, y, z, vx, vz, shotgun) {
        const col = shotgun ? [0.8, 0.12, 0.08] : [0.85, 0.65, 0.25];
        this.debris.add(x, y, z, vx + rnd(-0.5, 0.5), rnd(2, 3.5), vz + rnd(-0.5, 0.5), shotgun ? 0.07 : 0.04, col, 4, 0.5);
    }
    explosion(x, y, z, size = 1, color = 0xff8a3a) {
        const n = this._n(40 * size);
        for (let i = 0; i < n; i++) {
            const a = rnd(0, Math.PI * 2), b = rnd(-1, 1), s = rnd(2, 9) * size;
            const r = Math.sqrt(1 - b * b);
            this.add.spawn(x, y, z, Math.cos(a) * r * s, b * s + 2, Math.sin(a) * r * s, rnd(0.25, 0.7), rnd(0.5, 1.0) * size, 0.1, [1, 0.8, 0.4, 1], [0.8, 0.15, 0.02, 0], 6, 3);
        }
        for (let i = 0; i < this._n(14 * size); i++) {
            this.alpha.spawn(x + rnd(-0.5, 0.5) * size, y + rnd(-0.2, 0.6), z + rnd(-0.5, 0.5) * size, rnd(-1.5, 1.5), rnd(0.5, 2.5), rnd(-1.5, 1.5), rnd(1.2, 2.4), 0.6 * size, 2.4 * size, [0.25, 0.22, 0.2, 0.7], [0.08, 0.08, 0.08, 0], -0.5, 1.5);
        }
        for (let i = 0; i < this._n(10 * size); i++) {
            const a = rnd(0, Math.PI * 2), s = rnd(4, 12);
            this.add.spawn(x, y, z, Math.cos(a) * s, rnd(2, 9), Math.sin(a) * s, rnd(0.6, 1.3), 0.12, 0.05, [1, 0.9, 0.5, 1], [1, 0.3, 0, 0], 14, 0.5);
        }
        this.flashes.add(x, y, z, color, 1.2 * size, 5.5 * size, 0.35, 0xfff0d0, 2.4);
        this.flashes.add(x, y, z, 0xffffff, 0.5 * size, 2.5 * size, 0.12, 0xffffff, 3);
        const fl = this.world ? this.world.L.floor[this.world.cellAt(x, z)] : y - 1;
        if (fl !== undefined && y - fl < 2.5) this.flashes.ring(x, fl, z, color, 4.5 * size, 0.45);
        this.light(x, y, z, color, 14 * size, 3.2, 0.45);
        this.shake = Math.max(this.shake, 0.5 * size);
    }
    plasmaBurst(x, y, z, color = 0x3ac8ff) {
        const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
        for (let i = 0; i < this._n(10); i++) {
            this.add.spawn(x, y, z, rnd(-4, 4), rnd(-2, 5), rnd(-4, 4), rnd(0.2, 0.45), 0.18, 0.02, [c[0], c[1], c[2], 1], [c[0], c[1], c[2], 0], 6, 2);
        }
        this.flashes.add(x, y, z, color, 0.3, 1.4, 0.18, 0xffffff, 2);
        this.light(x, y, z, color, 6, 1.6, 0.2);
    }
    teleport(x, y, z, color = 0x66ffcc) {
        const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
        for (let i = 0; i < this._n(40); i++) {
            const a = rnd(0, Math.PI * 2), r = rnd(0.3, 1.2);
            this.add.spawn(x + Math.cos(a) * r, y + rnd(0, 2.2), z + Math.sin(a) * r, -Math.cos(a) * 0.8, rnd(1.5, 4), -Math.sin(a) * 0.8, rnd(0.5, 1.1), 0.2, 0.0, [c[0], c[1], c[2], 1], [1, 1, 1, 0], -1, 0.5);
        }
        this.flashes.add(x, y + 1, z, color, 0.6, 3.2, 0.5, 0xffffff, 2);
        const fl = this.world ? this.world.L.floor[this.world.cellAt(x, z)] : y;
        this.flashes.ring(x, fl, z, color, 2.6, 0.6);
        this.light(x, y + 1, z, color, 8, 2.2, 0.6);
    }
    trail(x, y, z, kind) {
        if (kind === 'smoke') this.alpha.spawn(x, y, z, rnd(-0.3, 0.3), rnd(0.2, 0.7), rnd(-0.3, 0.3), rnd(0.6, 1.1), 0.18, 0.75, [0.55, 0.5, 0.45, 0.5], [0.2, 0.2, 0.2, 0], -0.4, 1);
        else if (kind === 'fire') this.add.spawn(x, y, z, rnd(-0.5, 0.5), rnd(0.2, 1.2), rnd(-0.5, 0.5), rnd(0.2, 0.4), 0.35, 0.05, [1, 0.6, 0.2, 0.9], [0.8, 0.1, 0, 0], -2, 2);
        else if (kind === 'spark') this.add.spawn(x, y, z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), rnd(0.15, 0.3), 0.18, 0.02, [1, 0.6, 0.8, 1], [0.6, 0.1, 0.4, 0], 0, 2);
        else if (kind === 'void') this.add.spawn(x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), z + rnd(-0.6, 0.6), 0, 0, 0, rnd(0.3, 0.6), 0.35, 0.0, [0.6, 0.35, 1, 1], [0.2, 0.1, 1, 0], 0, 0);
    }
    fire(x, y, z, scale = 1) {
        this.add.spawn(x + rnd(-0.15, 0.15) * scale, y, z + rnd(-0.15, 0.15) * scale, rnd(-0.2, 0.2), rnd(0.8, 2.0) * scale, rnd(-0.2, 0.2), rnd(0.3, 0.6), 0.45 * scale, 0.1, [1, 0.65, 0.25, 0.9], [0.9, 0.12, 0.02, 0], -1.5, 1);
    }
    rail(a, b) {
        this.beams.add(a, b, 0x55aaff, 0.07, 0.6);
        this.beams.add(a, b, 0x9a5aff, 0.18, 0.9);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const n = Math.min(120, Math.floor(len * 4 * this.budget));
        const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
        // perpendicular basis for the spiral
        let px = -d[2], pz = d[0];
        const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
        const qx = d[1] * pz, qy = d[2] * px - d[0] * pz, qz = -d[1] * px;
        for (let i = 0; i < n; i++) {
            const t = i / n * len, ang = t * 2.2;
            const r = 0.12;
            const ox = (px * Math.cos(ang) + qx * Math.sin(ang)) * r, oy = qy * Math.sin(ang) * r, oz = (pz * Math.cos(ang) + qz * Math.sin(ang)) * r;
            this.add.spawn(a[0] + d[0] * t + ox, a[1] + d[1] * t + oy, a[2] + d[2] * t + oz, ox * 2, oy * 2 + 0.2, oz * 2, rnd(0.5, 0.9), 0.12, 0.02, [0.5, 0.7, 1, 1], [0.6, 0.2, 1, 0], 0, 1);
        }
    }
    tracer(a, b, color = 0xffd090) { this.beams.add(a, b, color, 0.018, 0.06); }
}
export { CELL };
