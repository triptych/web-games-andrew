/**
 * fx.js — effects: GPU particles (simulated entirely in the vertex shader
 * from spawn data in a ring buffer), instanced tracers and bullet orbs,
 * noise-displaced fireballs, shockwave rings, beams (rail, arc lightning,
 * laser sight), floor telegraphs, the flashlight shaft and a pool of
 * dynamic lights.
 */

import * as THREE from 'three';
import { Q } from './scene.js';

const C = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------ GPU particles

class ParticleSystem {
    constructor(scene, max, additive) {
        this.max = max;
        this.i = 0;
        const g = new THREE.BufferGeometry();
        this.a0 = new Float32Array(max * 4);
        this.av = new Float32Array(max * 4);
        this.ac = new Float32Array(max * 4);
        this.ax = new Float32Array(max * 4);
        for (let i = 0; i < max; i++) this.a0[i * 4 + 3] = -999;
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
        this.attrs = [
            g.setAttribute('aP0', new THREE.BufferAttribute(this.a0, 4)).attributes.aP0,
            g.setAttribute('aV', new THREE.BufferAttribute(this.av, 4)).attributes.aV,
            g.setAttribute('aC', new THREE.BufferAttribute(this.ac, 4)).attributes.aC,
            g.setAttribute('aX', new THREE.BufferAttribute(this.ax, 4)).attributes.aX,
        ];
        for (const a of this.attrs) a.setUsage(THREE.DynamicDrawUsage);
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uScale: { value: 800 } },
            vertexShader: /* glsl */`
                attribute vec4 aP0; attribute vec4 aV; attribute vec4 aC; attribute vec4 aX;
                uniform float uTime; uniform float uScale;
                varying vec4 vC; varying float vT; varying float vKind; varying float vSeed;
                void main() {
                    float age = uTime - aP0.w;
                    float life = aV.w;
                    float t = age / life;
                    if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
                    float drag = aX.y;
                    float k = drag > 0.0 ? (1.0 - exp(-drag * age)) / drag : age;
                    vec3 p = aP0.xyz + aV.xyz * k;
                    p.y -= 0.5 * aX.x * age * age;
                    p.y = max(p.y, 0.03);
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mv;
                    float size = mix(aC.w, aC.w * aX.z, t);
                    gl_PointSize = size * uScale / -mv.z;
                    vC = aC; vT = t; vKind = aX.w; vSeed = fract(aP0.w * 7.13 + aP0.x);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec4 vC; varying float vT; varying float vKind; varying float vSeed;
                float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
                void main() {
                    vec2 q = gl_PointCoord - 0.5;
                    float d = length(q) * 2.0;
                    float a;
                    vec3 col = vC.rgb;
                    if (vKind < 0.5) {            // soft glow
                        a = pow(max(0.0, 1.0 - d), 1.6) * (1.0 - vT);
                    } else if (vKind < 1.5) {     // spark: hot core
                        a = smoothstep(1.0, 0.2, d) * (1.0 - vT * vT);
                        col *= 1.0 + (1.0 - d) * 1.5;
                    } else if (vKind < 2.5) {     // smoke: lumpy, fades in then out
                        float n = h(floor(q * 6.0 + vSeed * 10.0)) * 0.3;
                        a = smoothstep(1.0, 0.3, d + n) * smoothstep(0.0, 0.15, vT) * (1.0 - vT) * 0.55;
                    } else if (vKind < 3.5) {     // chunk: hard little gib
                        a = step(d, 0.8) * (1.0 - smoothstep(0.75, 1.0, vT));
                        col *= 0.7 + 0.3 * (1.0 - d);
                    } else {                      // fire: shifts from white-yellow to deep red
                        a = pow(max(0.0, 1.0 - d), 1.3) * (1.0 - vT);
                        col = mix(vec3(1.6, 1.3, 0.8), vC.rgb, smoothstep(0.0, 0.5, vT));
                        col = mix(col, vec3(0.25, 0.05, 0.02), smoothstep(0.55, 1.0, vT));
                    }
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(col, a);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 3 : 2;
        scene.add(this.points);
        this.lo = Infinity; this.hi = -1; this.wrapped = false;
    }
    emit(x, y, z, vx, vy, vz, life, r, g, b, size, gravity, drag, sizeEnd, kind, t) {
        const i = this.i;
        this.i = (this.i + 1) % this.max;
        if (this.i === 0) this.wrapped = true;
        const o = i * 4;
        this.a0[o] = x; this.a0[o + 1] = y; this.a0[o + 2] = z; this.a0[o + 3] = t;
        this.av[o] = vx; this.av[o + 1] = vy; this.av[o + 2] = vz; this.av[o + 3] = life;
        this.ac[o] = r; this.ac[o + 1] = g; this.ac[o + 2] = b; this.ac[o + 3] = size;
        this.ax[o] = gravity; this.ax[o + 1] = drag; this.ax[o + 2] = sizeEnd; this.ax[o + 3] = kind;
        if (i < this.lo) this.lo = i;
        if (i > this.hi) this.hi = i;
    }
    flush(time, scale) {
        this.mat.uniforms.uTime.value = time;
        this.mat.uniforms.uScale.value = scale;
        if (this.hi < 0) return;
        for (const a of this.attrs) {
            a.clearUpdateRanges();
            if (this.wrapped) a.addUpdateRange(0, this.max * 4);
            else a.addUpdateRange(this.lo * 4, (this.hi - this.lo + 1) * 4);
            a.needsUpdate = true;
        }
        this.lo = Infinity; this.hi = -1; this.wrapped = false;
    }
}

// ------------------------------------------------------------------ Instanced quads (tracers & orbs)

function quadGeo(cap, extra) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    const attrs = {};
    for (const [name, size] of extra) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
        a.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(name, a);
        attrs[name] = a;
    }
    g.instanceCount = 0;
    return { g, attrs };
}

const TRACER_VERT = /* glsl */`
    attribute vec4 iPos;   // x y z, kind
    attribute vec4 iDir;   // dx dz, length, width
    attribute vec4 iCol;   // rgb, alpha
    varying vec2 vUv; varying vec4 vCol; varying float vKind;
    void main() {
        vec2 dir = iDir.xy;
        vec2 perp = vec2(-dir.y, dir.x);
        vec2 off = dir * position.x * iDir.z + perp * position.y * iDir.w;
        vec3 wp = vec3(iPos.x + off.x, iPos.y, iPos.z + off.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        vUv = uv; vCol = iCol; vKind = iPos.w;
    }
`;

const TRACER_FRAG = /* glsl */`
    varying vec2 vUv; varying vec4 vCol; varying float vKind;
    uniform float uTime;
    void main() {
        vec2 q = vUv - 0.5;
        float a; vec3 col = vCol.rgb;
        if (vKind < 0.5) {
            // Tracer: bright head, tapering tail.
            float along = vUv.x;
            float w = abs(q.y) * 2.0;
            a = smoothstep(1.0, 0.0, w) * smoothstep(0.0, 0.7, along);
            col = mix(col, vec3(1.0), smoothstep(0.35, 0.0, w) * along);
            col *= 2.2;
        } else if (vKind < 1.5) {
            // Flame puff.
            float d = length(q) * 2.0;
            a = pow(max(0.0, 1.0 - d), 1.4) * vCol.a;
            col *= 1.6;
        } else {
            // Plasma / micro-grenade orb.
            float d = length(q) * 2.0;
            a = pow(max(0.0, 1.0 - d), 1.2);
            col = mix(vec3(1.5), col * 2.0, smoothstep(0.0, 0.6, d));
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a, a);
    }
`;

const ORB_FRAG = /* glsl */`
    varying vec2 vUv; varying vec4 vCol; varying float vKind;
    uniform float uTime;
    void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        // Readable enemy bullets: a dark rim, a saturated body and a hot core, plus a soft halo.
        float halo = pow(max(0.0, 1.0 - d), 2.0) * 0.6;
        float body = smoothstep(0.62, 0.55, d);
        float rim = smoothstep(0.7, 0.62, d) - body;
        float core = smoothstep(0.32, 0.1, d);
        vec3 col = vCol.rgb * 1.8 * body + vec3(1.4) * core * 0.9;
        col = mix(col, vec3(0.02), rim);
        float a = max(halo, body + rim);
        if (vKind > 2.5) { // web: lumpy and pale
            float n = fract(sin(dot(floor(q * 8.0), vec2(12.9, 78.2))) * 4375.5);
            a *= 0.6 + 0.4 * n;
        }
        if (a < 0.02) discard;
        gl_FragColor = vec4(col + vCol.rgb * halo * 1.5 * (1.0 - body), a);
    }
`;

class QuadBatch {
    constructor(scene, cap, frag, blending, order) {
        this.cap = cap;
        const { g, attrs } = quadGeo(cap, [['iPos', 4], ['iDir', 4], ['iCol', 4]]);
        this.g = g; this.attrs = attrs; this.n = 0;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } }, vertexShader: TRACER_VERT, fragmentShader: frag,
            // The quad is laid flat by the shader, which flips its winding: draw both sides.
            transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
        });
        if (blending === THREE.CustomBlending) {
            this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneMinusSrcAlphaFactor;
        }
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = order;
        scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    add(x, y, z, kind, dx, dz, len, width, r, g, b, a) {
        if (this.n >= this.cap) return;
        const i = this.n++ * 4;
        const P = this.attrs.iPos.array, D = this.attrs.iDir.array, Cc = this.attrs.iCol.array;
        P[i] = x; P[i + 1] = y; P[i + 2] = z; P[i + 3] = kind;
        D[i] = dx; D[i + 1] = dz; D[i + 2] = len; D[i + 3] = width;
        Cc[i] = r; Cc[i + 1] = g; Cc[i + 2] = b; Cc[i + 3] = a;
    }
    end() {
        this.g.instanceCount = this.n;
        for (const k in this.attrs) { const a = this.attrs[k]; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 4); a.needsUpdate = true; }
    }
}

// ------------------------------------------------------------------ Fireballs & shockwaves

const NOISE3 = /* glsl */`
    vec3 h33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0; }
    float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(dot(h33(i), f), dot(h33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                       mix(dot(h33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(h33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
                   mix(mix(dot(h33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(h33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                       mix(dot(h33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(h33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
    }
`;

class Fireballs {
    constructor(scene, cap) {
        this.cap = cap; this.i = 0;
        const base = new THREE.IcosahedronGeometry(1, 3);
        const g = new THREE.InstancedBufferGeometry();
        g.index = base.index;
        g.setAttribute('position', base.attributes.position);
        g.setAttribute('normal', base.attributes.normal);
        this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(-999), 4);
        this.par = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
        this.col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        g.setAttribute('iPos', this.pos); g.setAttribute('iPar', this.par); g.setAttribute('iCol', this.col);
        g.instanceCount = cap;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: NOISE3 + /* glsl */`
                attribute vec4 iPos; attribute vec4 iPar; attribute vec3 iCol;
                uniform float uTime;
                varying float vT; varying float vAge; varying vec3 vObj; varying vec3 vNrm; varying vec3 vCol; varying vec3 vView; varying float vSeed;
                void main() {
                    float age = uTime - iPos.w;
                    float t = age / iPar.y;
                    if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
                    float r = iPar.x * (0.3 + 0.7 * (1.0 - pow(1.0 - t, 3.0)));
                    float n = n3(position * 2.0 + iPar.w * 10.0 + vec3(0.0, -age * 2.5, 0.0));
                    vec3 p = position * r * (1.0 + n * 0.45);
                    p.y *= 0.75;
                    vec3 wp = iPos.xyz + p + vec3(0.0, t * iPar.x * 0.6, 0.0);
                    vec4 mv = viewMatrix * vec4(wp, 1.0);
                    gl_Position = projectionMatrix * mv;
                    vT = t; vAge = age; vObj = position; vNrm = normalize(normalMatrix * position); vCol = iCol; vView = normalize(-mv.xyz); vSeed = iPar.w;
                }
            `,
            fragmentShader: NOISE3 + /* glsl */`
                varying float vT; varying float vAge; varying vec3 vObj; varying vec3 vNrm; varying vec3 vCol; varying vec3 vView; varying float vSeed;
                void main() {
                    float rim = 1.0 - abs(dot(vNrm, vView));
                    float n = n3(vObj * 3.2 + vSeed * 17.0 + vec3(0.0, -vAge * 3.0, 0.0)) * 0.5 + 0.5;
                    n += (n3(vObj * 7.0 - vSeed * 5.0) * 0.5 + 0.5) * 0.35;
                    float erosion = vT * 1.25 - 0.1;
                    float m = smoothstep(erosion, erosion + 0.22, n * 0.85 + (1.0 - rim) * 0.35);
                    float heat = clamp((1.0 - vT * 1.2) * (0.5 + 0.7 * n) * (1.0 - rim * 0.6), 0.0, 1.0);
                    vec3 col = mix(vec3(0.35, 0.04, 0.02), vCol * 1.3, smoothstep(0.05, 0.45, heat));
                    col = mix(col, vec3(2.4, 2.0, 1.4), smoothstep(0.55, 0.95, heat));
                    float a = m * (1.0 - smoothstep(0.75, 1.0, vT));
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(col * a, 1.0);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 4;
        scene.add(this.mesh);
    }
    add(x, y, z, radius, life, color, t) {
        const i = this.i;
        this.i = (this.i + 1) % this.cap;
        this.pos.array.set([x, y, z, t], i * 4);
        this.par.array.set([radius, life, 0, Math.random()], i * 4);
        const c = C(color);
        this.col.array.set([c.r, c.g, c.b], i * 3);
        for (const a of [this.pos, this.par, this.col]) a.needsUpdate = true;
    }
}

class Rings {
    constructor(scene, cap) {
        this.cap = cap; this.i = 0;
        const base = new THREE.PlaneGeometry(2, 2);
        base.rotateX(-Math.PI / 2);
        const g = new THREE.InstancedBufferGeometry();
        g.index = base.index;
        g.setAttribute('position', base.attributes.position);
        g.setAttribute('uv', base.attributes.uv);
        this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(-999), 4);
        this.par = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
        g.setAttribute('iPos', this.pos); g.setAttribute('iPar', this.par);
        g.instanceCount = cap;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: /* glsl */`
                attribute vec4 iPos; attribute vec4 iPar;
                uniform float uTime;
                varying vec2 vUv; varying float vT; varying vec4 vPar;
                void main() {
                    float t = (uTime - iPos.w) / iPar.y;
                    if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
                    float grow = iPar.z > 0.5 ? 1.0 : (1.0 - pow(1.0 - t, 2.5));
                    vec3 wp = iPos.xyz + position * iPar.x * grow;
                    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
                    vUv = uv; vT = t; vPar = iPar;
                }
            `,
            fragmentShader: /* glsl */`
                varying vec2 vUv; varying float vT; varying vec4 vPar;
                vec3 pal(float k) {
                    if (k < 0.5) return vec3(1.0, 0.6, 0.25);
                    if (k < 1.5) return vec3(0.4, 1.0, 0.3);
                    if (k < 2.5) return vec3(0.4, 0.8, 1.0);
                    if (k < 3.5) return vec3(1.0, 0.35, 0.9);
                    return vec3(1.0, 0.25, 0.15);
                }
                void main() {
                    float d = length(vUv - 0.5) * 2.0;
                    float k = vPar.w;
                    float a;
                    if (vPar.z > 0.5) {
                        // Vent glow: a pulsing disc while a bug climbs out.
                        a = (1.0 - smoothstep(0.2, 1.0, d)) * (0.6 + 0.4 * sin(vT * 30.0)) * (1.0 - vT * 0.6);
                    } else {
                        float w = 0.16 * (1.0 - vT) + 0.03;
                        a = smoothstep(w, 0.0, abs(d - 0.9)) * (1.0 - vT);
                        a += (1.0 - smoothstep(0.0, 0.9, d)) * 0.25 * (1.0 - vT) * (1.0 - vT);
                    }
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(pal(k) * a * 1.8, a);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3;
        scene.add(this.mesh);
    }
    add(x, y, z, radius, life, kind, t, disc = false) {
        const i = this.i;
        this.i = (this.i + 1) % this.cap;
        this.pos.array.set([x, y, z, t], i * 4);
        this.par.array.set([radius, life, disc ? 1 : 0, kind], i * 4);
        this.pos.needsUpdate = true; this.par.needsUpdate = true;
    }
}

// ------------------------------------------------------------------ Strips: beams & telegraphs

class Strips {
    constructor(scene, cap, frag, blending, order) {
        this.cap = cap;
        const g = new THREE.BufferGeometry();
        this.p = new Float32Array(cap * 6 * 3);
        this.uv = new Float32Array(cap * 6 * 2);
        this.c = new Float32Array(cap * 6 * 4);
        g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aCol', new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
        this.g = g;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: /* glsl */`
                attribute vec4 aCol; varying vec2 vUv; varying vec4 vCol;
                void main() { vUv = uv; vCol = aCol; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: frag,
            transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = order;
        scene.add(this.mesh);
        this.n = 0;
    }
    begin() { this.n = 0; }
    /** Flat quad on a horizontal plane at height y from (ax,az) to (bx,bz). u runs along. */
    seg(ax, az, bx, bz, y, w0, w1, r, g, b, a, u0 = 0, u1 = 1, v = 0) {
        if (this.n >= this.cap) return;
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
        const px = -dz / l, pz = dx / l;
        const P = [
            [ax + px * w0, az + pz * w0, u0, 1], [ax - px * w0, az - pz * w0, u0, 0], [bx - px * w1, bz - pz * w1, u1, 0],
            [ax + px * w0, az + pz * w0, u0, 1], [bx - px * w1, bz - pz * w1, u1, 0], [bx + px * w1, bz + pz * w1, u1, 1],
        ];
        const o = this.n * 6;
        for (let k = 0; k < 6; k++) {
            const i = o + k;
            this.p[i * 3] = P[k][0]; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = P[k][1];
            this.uv[i * 2] = P[k][2]; this.uv[i * 2 + 1] = v ? v : P[k][3];
            this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = a;
        }
        this.n++;
    }
    /** A flat square (for circles drawn in the shader). */
    disc(x, z, y, rad, r, g, b, a, kindV) {
        if (this.n >= this.cap) return;
        const P = [[x - rad, z - rad, 0, 0], [x + rad, z - rad, 1, 0], [x + rad, z + rad, 1, 1], [x - rad, z - rad, 0, 0], [x + rad, z + rad, 1, 1], [x - rad, z + rad, 0, 1]];
        const o = this.n * 6;
        for (let k = 0; k < 6; k++) {
            const i = o + k;
            this.p[i * 3] = P[k][0]; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = P[k][1];
            this.uv[i * 2] = P[k][2] + kindV; this.uv[i * 2 + 1] = P[k][3];
            this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = a;
        }
        this.n++;
    }
    end() {
        this.g.setDrawRange(0, this.n * 6);
        for (const k of ['position', 'uv', 'aCol']) { const a = this.g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 6 * a.itemSize); a.needsUpdate = true; }
    }
}

const BEAM_FRAG = /* glsl */`
    varying vec2 vUv; varying vec4 vCol;
    void main() {
        float w = abs(vUv.y - 0.5) * 2.0;
        float core = smoothstep(0.35, 0.0, w);
        float a = smoothstep(1.0, 0.0, w) * vCol.a;
        vec3 col = mix(vCol.rgb * 2.0, vec3(2.4), core);
        gl_FragColor = vec4(col * a, a);
    }
`;

const TELE_FRAG = /* glsl */`
    varying vec2 vUv; varying vec4 vCol;
    uniform float uTime;
    void main() {
        float a;
        if (vUv.x > 1.5) {
            // Circle telegraph: ring + filling disc (progress in vCol.a's fraction).
            vec2 q = vec2(vUv.x - 2.0, vUv.y) - 0.5;
            float d = length(q) * 2.0;
            float prog = vCol.a;
            float ring = smoothstep(0.08, 0.0, abs(d - 0.95));
            float fill = step(d, prog) * 0.35;
            float pulse = 0.6 + 0.4 * sin(uTime * 18.0);
            a = (ring * pulse + fill) * step(d, 1.0);
            gl_FragColor = vec4(vCol.rgb * a * 1.6, a);
            return;
        }
        // Line telegraph: bordered lane that fills from the origin.
        float w = abs(vUv.y - 0.5) * 2.0;
        float edge = smoothstep(0.75, 0.95, w) * step(w, 1.0);
        float fill = step(vUv.x, vCol.a) * 0.3;
        float chev = step(0.5, fract(vUv.x * 10.0 - uTime * 3.0 + w * 0.4)) * 0.15;
        a = edge * (0.6 + 0.4 * sin(uTime * 18.0)) + fill + chev;
        gl_FragColor = vec4(vCol.rgb * a * 1.6, a);
    }
`;

// ------------------------------------------------------------------ Lights

class LightPool {
    constructor(scene, n) {
        this.lights = [];
        for (let i = 0; i < n; i++) {
            const l = new THREE.PointLight(0xffffff, 0, 8, 1.8);
            l.position.set(0, -50, 0);
            scene.add(l);
            this.lights.push({ l, t: 0, life: 1, peak: 0 });
        }
    }
    flash(x, y, z, color, intensity, dist, life) {
        // Reuse the weakest light.
        let best = this.lights[0], bv = Infinity;
        for (const L of this.lights) {
            const v = L.l.intensity;
            if (v < bv) { bv = v; best = L; }
        }
        if (bv > intensity) return;
        best.l.position.set(x, y, z);
        best.l.color.setHex(color);
        best.l.distance = dist;
        best.peak = intensity; best.t = 0; best.life = life;
        best.l.intensity = intensity;
    }
    update(dt) {
        for (const L of this.lights) {
            if (L.l.intensity <= 0) continue;
            L.t += dt;
            const f = Math.max(0, 1 - L.t / L.life);
            L.l.intensity = L.peak * f * f;
            if (f <= 0) { L.l.intensity = 0; L.l.position.y = -50; }
        }
    }
}

// ------------------------------------------------------------------ The FX facade

export class FX {
    constructor(scene) {
        const pm = Q.particles;
        this.add = new ParticleSystem(scene, Math.round(9000 * pm), true);
        this.alpha = new ParticleSystem(scene, Math.round(5000 * pm), false);
        this.tracers = new QuadBatch(scene, 1200, TRACER_FRAG, THREE.AdditiveBlending, 5);
        this.orbs = new QuadBatch(scene, 1500, ORB_FRAG, THREE.CustomBlending, 6);
        this.fire = new Fireballs(scene, 48);
        this.rings = new Rings(scene, 64);
        this.beams = new Strips(scene, 160, BEAM_FRAG, THREE.AdditiveBlending, 5);
        this.tele = new Strips(scene, 80, TELE_FRAG, THREE.AdditiveBlending, 1);
        this.lights = new LightPool(scene, Q.lights);
        this.time = 0;
        this.beamList = [];
        this.teleList = [];
        this.mul = pm;
    }

    /** Random helper (view-only randomness is fine). */
    r(a, b) { return a + Math.random() * (b - a); }

    burst(x, y, z, n, opts) {
        const sys = opts.additive === false ? this.alpha : this.add;
        const c = C(opts.color ?? 0xffffff);
        const count = Math.max(1, Math.round(n * this.mul));
        for (let i = 0; i < count; i++) {
            const a = (opts.ang ?? Math.random() * Math.PI * 2) + (opts.ang !== undefined ? this.r(-(opts.spread ?? 0.6), opts.spread ?? 0.6) : 0);
            const sp = this.r(opts.speed?.[0] ?? 1, opts.speed?.[1] ?? 4);
            const up = this.r(opts.up?.[0] ?? 0, opts.up?.[1] ?? 2);
            const v = opts.vary ?? 0.15;
            sys.emit(x + this.r(-0.05, 0.05), y, z + this.r(-0.05, 0.05), Math.cos(a) * sp, up, Math.sin(a) * sp,
                this.r(opts.life?.[0] ?? 0.3, opts.life?.[1] ?? 0.7),
                c.r * this.r(1 - v, 1 + v), c.g * this.r(1 - v, 1 + v), c.b * this.r(1 - v, 1 + v),
                this.r(opts.size?.[0] ?? 0.1, opts.size?.[1] ?? 0.25), opts.gravity ?? 0, opts.drag ?? 2, opts.sizeEnd ?? 0.3, opts.kind ?? 0, this.time);
        }
    }

    explosion(x, y, r, kind) {
        const t = this.time;
        const big = r > 2.5;
        const pal = { fire: [0xff8a2a, 0], acid: [0x7aff3a, 1], plasma: [0xff5ce1, 3], bio: [0x9aff4a, 1], nova: [0x9ad8ff, 2], magma: [0xff5a1a, 4], missile: [0xff6a2a, 0], small: [0xffa84a, 0], egg: [0xaaff5a, 1] }[kind] ?? [0xff8a2a, 0];
        const [color, ringK] = pal;
        if (kind !== 'acid' && kind !== 'bio' && kind !== 'egg') this.fire.add(x, 0.6, y, r * 0.75, big ? 0.85 : 0.6, color, t);
        this.rings.add(x, 0.08, y, r * 1.15, big ? 0.55 : 0.4, ringK, t);
        this.burst(x, 0.6, y, big ? 40 : 18, { color, speed: [3, 11], up: [1, 6], life: [0.25, 0.7], size: [0.08, 0.18], gravity: 12, drag: 2.5, kind: 1 });
        this.burst(x, 0.5, y, big ? 30 : 14, { color, speed: [1, r * 2], up: [0.5, 3], life: [0.3, 0.8], size: [0.5, 1.1], drag: 3, sizeEnd: 1.6, kind: 4 });
        this.burst(x, 0.6, y, big ? 22 : 10, { color: 0x1a1612, additive: false, speed: [0.5, r * 1.2], up: [0.5, 2.2], life: [0.9, 2.0], size: [0.9, 1.8], drag: 1.6, sizeEnd: 2.4, kind: 2 });
        if (kind === 'acid' || kind === 'bio' || kind === 'egg') {
            this.burst(x, 0.4, y, 30, { color: 0x6aff2a, additive: false, speed: [2, 7], up: [2, 6], life: [0.4, 0.9], size: [0.08, 0.2], gravity: 16, drag: 1, kind: 3 });
        }
        this.lights.flash(x, 1.6, y, color, big ? 26 : 14, r * 4, big ? 0.45 : 0.28);
    }

    muzzle(x, y, ang, color, size = 1) {
        const dx = Math.cos(ang), dz = Math.sin(ang);
        this.add.emit(x + dx * 0.15, 1.2, y + dz * 0.15, dx * 2, 0, dz * 2, 0.06, 1.4, 1.2, 0.9, 0.55 * size, 0, 0, 1.5, 0, this.time);
        const c = C(color);
        this.add.emit(x + dx * 0.3, 1.2, y + dz * 0.3, dx * 4, 0, dz * 4, 0.08, c.r, c.g, c.b, 0.45 * size, 0, 0, 0.5, 0, this.time);
        if (Math.random() < 0.5 * this.mul) this.burst(x, 1.2, y, 2, { color, ang, spread: 0.4, speed: [6, 12], up: [0, 1], life: [0.08, 0.18], size: [0.04, 0.07], kind: 1 });
    }

    beam(kind, pts, life, color, width) { this.beamList.push({ kind, pts, life, max: life, color: C(color), width, seed: Math.random() * 100 }); }
    telegraphLine(x, y, ang, len, width, life, color = 0xff2a1a) { this.teleList.push({ kind: 'line', x, y, ang, len, width, life, max: life, color: C(color) }); }
    telegraphCircle(x, y, r, life, color = 0xff2a1a) { this.teleList.push({ kind: 'circle', x, y, r, life, max: life, color: C(color) }); }

    update(dt, camScale) {
        this.time += dt;
        this.add.flush(this.time, camScale);
        this.alpha.flush(this.time, camScale);
        this.fire.mat.uniforms.uTime.value = this.time;
        this.rings.mat.uniforms.uTime.value = this.time;
        this.tele.mat.uniforms.uTime.value = this.time;
        this.lights.update(dt);
        // Beams.
        this.beams.begin();
        this.beamList = this.beamList.filter((b) => (b.life -= dt) > 0);
        for (const b of this.beamList) {
            const f = b.life / b.max;
            if (b.kind === 'rail') {
                const [a, c] = b.pts;
                this.beams.seg(a.x, a.y, c.x, c.y, 1.15, b.width * (0.3 + f), b.width * (0.3 + f), b.color.r, b.color.g, b.color.b, f);
            } else if (b.kind === 'laser') {
                const [a, c] = b.pts;
                this.beams.seg(a.x, a.y, c.x, c.y, 1.2, b.width, b.width * 0.5, b.color.r, b.color.g, b.color.b, b.alpha ?? 0.5);
            } else {
                // Arc lightning: re-jitter every frame.
                for (let i = 0; i < b.pts.length - 1; i++) {
                    const a = b.pts[i], c = b.pts[i + 1];
                    const n = Math.max(2, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 0.6));
                    let px = a.x, py = a.y;
                    for (let k = 1; k <= n; k++) {
                        const t = k / n;
                        const j = k === n ? 0 : 0.35;
                        const nx = a.x + (c.x - a.x) * t + (Math.random() - 0.5) * j, ny = a.y + (c.y - a.y) * t + (Math.random() - 0.5) * j;
                        this.beams.seg(px, py, nx, ny, 1.1, b.width, b.width, b.color.r, b.color.g, b.color.b, Math.min(1, f * 1.5));
                        px = nx; py = ny;
                    }
                }
            }
        }
        this.beamList = this.beamList.filter((b) => b.kind !== 'laser');
        this.beams.end();
        // Telegraphs.
        this.tele.begin();
        this.teleList = this.teleList.filter((t) => (t.life -= dt) > 0);
        for (const t of this.teleList) {
            const prog = 1 - t.life / t.max;
            if (t.kind === 'line') {
                const bx = t.x + Math.cos(t.ang) * t.len, by = t.y + Math.sin(t.ang) * t.len;
                this.tele.seg(t.x, t.y, bx, by, 0.05, t.width / 2, t.width / 2, t.color.r, t.color.g, t.color.b, prog);
            } else {
                this.tele.disc(t.x, t.y, 0.06, t.r, t.color.r, t.color.g, t.color.b, prog, 2);
            }
        }
        this.tele.end();
    }
}

// ------------------------------------------------------------------ Flashlight shaft

export function makeFlashlightCone() {
    const len = 11, rad = 4.2;
    const g = new THREE.ConeGeometry(rad, len, 24, 1, true);
    g.translate(0, -len / 2, 0);
    g.rotateZ(Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: C(0xfff0d0) }, uOn: { value: 1 } },
        vertexShader: /* glsl */`
            varying vec3 vL; varying vec3 vW;
            void main() { vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uColor; uniform float uOn;
            varying vec3 vL; varying vec3 vW;
            float h(vec3 p) { return fract(sin(dot(p, vec3(12.9, 78.2, 37.7))) * 43758.5); }
            void main() {
                float along = clamp(vL.x / 11.0, 0.0, 1.0);
                float a = (1.0 - along) * (1.0 - along) * 0.07 * uOn;
                float dust = step(0.985, h(floor(vW * 9.0 + vec3(0.0, uTime * 0.6, uTime * 0.2))));
                a += dust * 0.25 * (1.0 - along) * uOn;
                a *= smoothstep(0.04, 0.3, along);
                gl_FragColor = vec4(uColor * a, a);
            }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 7;
    m.frustumCulled = false;
    return m;
}
