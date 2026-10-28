// Light and heat for the mine: a baked glow field (so rock near lava, gems and
// lanterns is tinted without real lights), a small pool of real point lights
// handed to the nearest emitters as the cart passes, lava made of shader, an
// ember field that follows the camera, and crystal sparkles.

import * as THREE from 'three';
import { GLSL_NOISE } from './sky.js';
import { glowSprite, softGlow } from './textures.js';
import { clamp, damp, rng, TAU } from './util.js';

// ---------------------------------------------------------------- baked glow

/** Coloured light from point emitters, baked into vertex glow. */
export class GlowField {
    constructor(cell = 14) {
        this.cell = cell;
        this.map = new Map();
        this.count = 0;
    }

    key(i, j, k) {
        return i * 73856093 ^ j * 19349663 ^ k * 83492791;
    }

    /** @param {number} radius metres to zero; color is linear rgb already scaled by strength */
    add(x, y, z, r, g, b, radius) {
        const c = this.cell;
        const i0 = Math.floor((x - radius) / c), i1 = Math.floor((x + radius) / c);
        const j0 = Math.floor((y - radius) / c), j1 = Math.floor((y + radius) / c);
        const k0 = Math.floor((z - radius) / c), k1 = Math.floor((z + radius) / c);
        const e = { x, y, z, r, g, b, radius };
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
            const key = this.key(i, j, k);
            let l = this.map.get(key);
            if (!l) this.map.set(key, (l = []));
            l.push(e);
        }
        this.count++;
    }

    /** Adds the glow reaching (x, y, z) on a surface facing (nx, ny, nz) into v.gr/gg/gb. */
    sample(v) {
        const c = this.cell;
        const l = this.map.get(this.key(Math.floor(v.x / c), Math.floor(v.y / c), Math.floor(v.z / c)));
        if (!l) return;
        for (const e of l) {
            const dx = e.x - v.x, dy = e.y - v.y, dz = e.z - v.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > e.radius * e.radius) continue;
            const d = Math.sqrt(d2) || 1e-3;
            const f = 1 - d / e.radius;
            // surfaces turned toward the emitter take more; the far side keeps a little
            const facing = 0.3 + 0.7 * Math.max(0, (dx * v.nx + dy * v.ny + dz * v.nz) / d);
            const k = f * f * facing;
            v.gr += e.r * k; v.gg += e.g * k; v.gb += e.b * k;
        }
    }
}

// ---------------------------------------------------------------- the light pool

/** A few real point lights, lent to whichever emitters are nearest the camera. */
export class LightPool {
    constructor(scene, n) {
        this.lights = Array.from({ length: n }, () => {
            const l = new THREE.PointLight(0xffffff, 0, 20, 1.6);
            scene.add(l);
            return { l, em: null, cur: 0 };
        });
        this.emitters = [];
        this.timer = 0;
    }

    /** @param {{x,y,z,color,intensity,dist,flicker}} e */
    add(e) {
        e.color = new THREE.Color(e.color);
        e.flicker ??= 0;
        e.phase = Math.random() * 100;
        this.emitters.push(e);
        return e;
    }

    update(dt, pos, t) {
        this.timer -= dt;
        const n = this.lights.length;
        if (this.timer <= 0) {
            this.timer = 0.12;
            // near and bright win: distance squared over intensity
            const scored = this.emitters.map((e) => ({ e, d: ((e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 + (e.z - pos.z) ** 2) / (e.intensity + 1), far: (e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 + (e.z - pos.z) ** 2 > e.dist * e.dist * 1.6 })).filter((x) => !x.far).sort((a, b) => a.d - b.d).slice(0, n);
            const want = new Set(scored.map((s) => s.e));
            for (const L of this.lights) if (L.em && !want.has(L.em)) L.want = 0;
            for (const { e } of scored) {
                if (this.lights.some((L) => L.em === e && L.want !== 0)) continue;
                const revive = this.lights.find((L) => L.em === e);
                if (revive) { revive.want = 1; continue; }
                const free = this.lights.find((L) => !L.em || (L.want === 0 && L.cur < 0.03));
                if (!free) continue;
                free.em = e;
                free.want = 1;
                free.cur = 0;
                free.l.position.set(e.x, e.y, e.z);
                free.l.color.copy(e.color);
                free.l.distance = e.dist;
            }
        }
        for (const L of this.lights) {
            if (!L.em) { L.l.intensity = 0; continue; }
            L.cur = damp(L.cur, L.want ?? 0, 5, dt);
            const e = L.em;
            const fl = e.flicker ? 1 - e.flicker * (0.5 + 0.5 * Math.sin(t * 9 + e.phase) * Math.sin(t * 5.3 + e.phase * 2)) : 1;
            L.l.intensity = e.intensity * L.cur * fl;
            if (L.want === 0 && L.cur < 0.01) { L.em = null; L.l.intensity = 0; }
        }
    }
}

// ---------------------------------------------------------------- lava

const LAVA_FRAG = /* glsl */ `
uniform float uTime, uBright, uSpeed;
uniform vec2 uFlow;       // flow direction in uv
uniform vec2 uScale;      // texture repeats over the surface
uniform float uEdge;      // fade to dark crust at the sides (0..1)
varying vec2 vUv;
varying vec3 vWPos;
${GLSL_NOISE}
vec3 ramp(float h){
  vec3 c = mix(vec3(0.03, 0.0, 0.0), vec3(0.55, 0.04, 0.0), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3(1.0, 0.28, 0.02), smoothstep(0.3, 0.62, h));
  c = mix(c, vec3(1.0, 0.72, 0.18), smoothstep(0.6, 0.88, h));
  return mix(c, vec3(1.0, 0.95, 0.7), smoothstep(0.88, 1.0, h));
}
void main(){
  vec2 uv = vUv * uScale;
  vec2 f = uFlow * uTime * uSpeed;
  // domain-warped flow: crust plates drifting over hot cracks
  vec2 w = vec2(fbm(uv * 0.9 + f * 0.6), fbm(uv * 0.9 + 5.2 - f * 0.4));
  float n = fbm(uv * 1.3 + w * 1.8 + f);
  float n2 = fbm(uv * 3.1 - f * 1.4 + w);
  float crust = smoothstep(0.42, 0.68, n + n2 * 0.25);          // dark plates
  float cracks = pow(1.0 - abs(n2 * 2.0 - 1.0), 3.0);
  float h = mix(0.95 - n * 0.35, 0.12 + cracks * 0.55, crust);
  h += 0.15 * sin(uTime * 0.8 + n * 9.0);
  vec3 col = ramp(clamp(h, 0.0, 1.0));
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  col *= mix(1.0, edge * 0.7 + 0.3, uEdge);
  gl_FragColor = vec4(col * uBright, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function lavaMaterial({ flow = [0, 1], scale = [4, 4], speed = 0.05, bright = 2.0, edge = 0 } = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }, uBright: { value: bright }, uSpeed: { value: speed },
            uFlow: { value: new THREE.Vector2(...flow) }, uScale: { value: new THREE.Vector2(...scale) }, uEdge: { value: edge },
        },
        vertexShader: 'varying vec2 vUv; varying vec3 vWPos; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: LAVA_FRAG,
        side: THREE.DoubleSide,
        fog: false,
    });
}

// ---------------------------------------------------------------- embers

/** Sparks that drift up around the camera wherever it is hot; one Points object, all in the shader. */
export class Embers {
    constructor(count = 700) {
        const r = rng('embers');
        const seed = new Float32Array(count * 4), pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) seed.set([r(), r(), r(), r()], i * 4);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
        this.U = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uScale: { value: 600 }, uColor: { value: new THREE.Color(1, 0.4, 0.08) }, uBox: { value: 46 }, uMap: { value: glowSprite() } };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
            vertexShader: /* glsl */ `
                attribute vec4 aSeed;
                uniform float uTime, uAmount, uScale, uBox;
                uniform vec3 uCenter;
                varying float vA; varying float vH;
                void main(){
                    vec3 base = (aSeed.xyz - 0.5) * uBox;
                    float sp = 0.6 + aSeed.w * 1.4;
                    vec3 p = base + vec3(sin(uTime * 0.7 + aSeed.x * 40.0) * 0.9, uTime * sp, cos(uTime * 0.6 + aSeed.z * 30.0) * 0.9);
                    vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
                    vec3 wp = uCenter + rel;
                    float on = step(aSeed.w, uAmount);
                    float edge = smoothstep(0.5, 0.25, length(rel) / uBox);
                    vA = on * edge * (0.5 + 0.5 * sin(uTime * 6.0 + aSeed.x * 90.0));
                    vH = aSeed.y;
                    vec4 mv = viewMatrix * vec4(wp, 1.0);
                    gl_PointSize = (0.05 + aSeed.z * 0.1) * uScale / -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap; uniform vec3 uColor;
                varying float vA; varying float vH;
                void main(){
                    float a = texture2D(uMap, gl_PointCoord).a * vA;
                    if (a < 0.02) discard;
                    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.8, 0.4), vH * 0.6) * a * 2.2, 1.0);
                }`,
        }));
        this.points.frustumCulled = false;
        this.points.renderOrder = 8;
    }

    update(t, center, amount, scale) {
        this.U.uTime.value = t;
        this.U.uCenter.value.copy(center);
        this.U.uAmount.value = amount;
        this.U.uScale.value = scale;
        this.points.visible = amount > 0.01;
    }
}

// ---------------------------------------------------------------- ballistic spray (lava fountain, drips)

/**
 * Looping streaks flung from a point on ballistic arcs. All motion is in the vertex shader:
 * each instance cycles through its own launch, flight and fall.
 */
export class Spray {
    /**
     * @param {object} o { count, origin: Vector3, up: [min,max] m/s, out: max sideways m/s, gravity, life: [min,max], size: [min,max], spread }
     */
    constructor(o) {
        const r = rng(o.seed ?? 'spray');
        const n = o.count;
        const a = new Float32Array(n * 4), b = new Float32Array(n * 4), c = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
            const ang = r() * TAU, rad = Math.sqrt(r()) * (o.spread ?? 1);
            const up = o.up[0] + r() * (o.up[1] - o.up[0]);
            const out = r() * o.out;
            const dir = ang + r.range(-0.4, 0.4);
            a.set([Math.sin(ang) * rad, 0, Math.cos(ang) * rad, r()], i * 4);              // launch offset, phase
            b.set([Math.sin(dir) * out, up, Math.cos(dir) * out, o.size[0] + r() * (o.size[1] - o.size[0])], i * 4);
            c.set([o.life[0] + r() * (o.life[1] - o.life[0]), r(), 0, 0], i * 4);
        }
        const geo = new THREE.InstancedBufferGeometry();
        const base = new THREE.PlaneGeometry(1, 1);
        geo.setIndex(base.index);
        geo.setAttribute('position', base.attributes.position);
        geo.setAttribute('uv', base.attributes.uv);
        geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
        geo.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
        geo.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 4));
        geo.instanceCount = n;
        this.U = { uTime: { value: 0 }, uOrigin: { value: o.origin.clone() }, uG: { value: o.gravity ?? 9.8 }, uAmt: { value: 1 }, uHot: { value: new THREE.Color(1, 0.12, 0.02) }, uWhite: { value: new THREE.Color(1, 0.8, 0.35) }, uStreak: { value: o.streak ?? 0.05 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
            vertexShader: /* glsl */ `
                attribute vec4 aA, aB, aC;
                uniform float uTime, uG, uAmt, uStreak; uniform vec3 uOrigin;
                varying vec2 vUv; varying float vHeat, vA;
                void main(){
                    float life = aC.x;
                    float age = mod(uTime + aA.w * life, life);
                    float k = age / life;
                    vec3 p = uOrigin + vec3(aA.x, 0.0, aA.z) + aB.xyz * age + vec3(0.0, -0.5 * uG * age * age, 0.0);
                    vec3 vel = aB.xyz + vec3(0.0, -uG * age, 0.0);
                    vHeat = 1.0 - k;
                    vA = smoothstep(0.0, 0.04, k) * (1.0 - smoothstep(0.6, 1.0, k)) * step(aC.y, uAmt);
                    vec4 mv = viewMatrix * vec4(p, 1.0);
                    vec3 vv = mat3(viewMatrix) * vel;
                    vec2 d = vv.xy; float dl = length(d);
                    d = dl > 0.01 ? d / dl : vec2(0.0, 1.0);
                    vec2 pd = vec2(d.y, -d.x);
                    float streak = clamp(length(vel) * uStreak, 1.0, 6.0);
                    float size = aB.w * (0.55 + 0.6 * vHeat);
                    mv.xy += pd * position.x * size + d * position.y * size * streak;
                    vUv = uv;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform vec3 uHot, uWhite;
                varying vec2 vUv; varying float vHeat, vA;
                void main(){
                    if (vA < 0.01) discard;
                    vec2 q = vUv * 2.0 - 1.0;
                    float g = exp(-(q.x * q.x * 4.5 + pow(abs(q.y), 1.7) * 2.4));
                    vec3 c = mix(uHot, uWhite, smoothstep(0.35, 1.0, vHeat));
                    gl_FragColor = vec4(c * g * vA * (1.4 + vHeat * 2.6), 1.0);
                }`,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 7;
    }

    update(t) {
        this.U.uTime.value = t;
    }
}

// ---------------------------------------------------------------- sparkle

/** Hundreds of tiny stars that twinkle on crystal tips. */
export class Glints {
    constructor(points, colors, size = 0.5) {
        const n = points.length;
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n * 2);
        const r = rng('glints');
        points.forEach((p, i) => {
            pos.set([p.x, p.y, p.z], i * 3);
            const c = colors[i];
            col.set([c.r, c.g, c.b], i * 3);
            seed.set([r(), r()], i * 2);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
        this.U = { uTime: { value: 0 }, uScale: { value: 600 }, uSize: { value: size } };
        this.points = new THREE.Points(g, new THREE.ShaderMaterial({
            uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
            vertexShader: /* glsl */ `
                attribute vec3 aColor; attribute vec2 aSeed;
                uniform float uTime, uScale, uSize;
                varying vec3 vC; varying float vA;
                void main(){
                    float tw = pow(max(0.0, sin(uTime * (1.2 + aSeed.x * 2.4) + aSeed.y * 60.0)), 6.0);
                    vA = tw;
                    vC = aColor;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    float d = -mv.z;
                    gl_PointSize = clamp(uSize * (0.4 + tw * 1.4) * uScale / d, 0.0, 64.0) * smoothstep(240.0, 10.0, d);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vC; varying float vA;
                void main(){
                    vec2 q = gl_PointCoord - 0.5;
                    // a four-point star
                    float a = exp(-abs(q.x) * 38.0) * exp(-abs(q.y) * 5.0) + exp(-abs(q.y) * 38.0) * exp(-abs(q.x) * 5.0) + exp(-dot(q, q) * 90.0);
                    a *= vA;
                    if (a < 0.02) discard;
                    gl_FragColor = vec4(mix(vC, vec3(1.0), 0.55) * a * 1.6, 1.0);
                }`,
        }));
        this.points.frustumCulled = false;
        this.points.renderOrder = 8;
    }

    update(t, scale) {
        this.U.uTime.value = t;
        this.U.uScale.value = scale;
    }
}

export { softGlow, clamp };

// ---------------------------------------------------------------- ribbons

/**
 * A strip following a list of points: for rivers (flat, side = across the flow) and falls (hanging down a wall).
 * @param {THREE.Vector3[]} pts  centre line
 * @param {THREE.Vector3[]|THREE.Vector3} sides  unit vector across the strip at each point (or one for all)
 * @param {number[]|number} widths
 * uv.x runs across (0..1), uv.y along the length in units of `vScale` metres.
 */
export function ribbonGeometry(pts, sides, widths, vScale = 4) {
    const n = pts.length;
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4);
    let len = 0;
    for (let i = 0; i < n; i++) {
        if (i) len += pts[i].distanceTo(pts[i - 1]);
        const sd = Array.isArray(sides) ? sides[i] : sides;
        const w = (Array.isArray(widths) ? widths[i] : widths) / 2;
        pos.set([pts[i].x - sd.x * w, pts[i].y - sd.y * w, pts[i].z - sd.z * w, pts[i].x + sd.x * w, pts[i].y + sd.y * w, pts[i].z + sd.z * w], i * 6);
        uv.set([0, len / vScale, 1, len / vScale], i * 4);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}
