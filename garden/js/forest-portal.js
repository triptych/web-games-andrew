// The shimmering doorway in the Great Tree's roots, and its twin in the
// Springwood. A living arch of twisted wood hung with blossom frames an oval of
// swirling light; walk through it (or click it) and you come out on the other
// side. The garden's door shimmers with the forest's April greens and pinks,
// the forest's with the garden's dusk blues and gold, so each shows a little of
// where it leads.

import * as THREE from 'three';
import { rng, TAU } from './util.js';

export const PORTAL_W = 2.1;   // the oval of light: width and height, in metres
export const PORTAL_H = 3.1;

const V3 = THREE.Vector3;

const SURFACE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SURFACE_FRAG = /* glsl */ `
uniform float uTime; uniform float uNear; uniform float uNight;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uRim;
varying vec2 vUv;
float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * nn(p); p = p * 2.03 + 1.7; a *= 0.5; }
    return s;
}
void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    float t = uTime * (0.35 + uNear * 0.35);
    // the light turns slowly about the middle, faster near it, like water down a drain
    float ang = atan(q.y, q.x) + t + (1.0 - r) * (2.4 + uNear * 1.5);
    vec2 sp = vec2(cos(ang), sin(ang)) * r;
    float f = fbm(sp * 2.4 + vec2(0.0, uTime * 0.12));
    float g = fbm(q * 3.1 - vec2(uTime * 0.09, 0.0) + f * 1.6);
    vec3 col = mix(uA, uB, smoothstep(0.32, 0.72, f));
    col = mix(col, uC, smoothstep(0.5, 0.85, g) * 0.75);
    // a brighter heart, as if daylight were coming through from the other side
    col += vec3(1.0, 0.96, 0.86) * pow(1.0 - r, 2.6) * (0.55 + uNear * 0.3);
    // ripples running out from the middle
    col *= 0.9 + 0.12 * sin(r * 22.0 - uTime * 3.0);
    float rim = smoothstep(0.74, 0.97, r);
    col = mix(col, uRim * (1.5 + uNight * 0.8), rim);
    // glints
    float gl = step(0.982, nn(q * 38.0 + vec2(uTime * 1.7, -uTime * 2.3))) * (1.0 - r * 0.6);
    col += vec3(gl);
    float a = mix(0.8 + uNear * 0.12, 1.0, rim) * (1.0 - smoothstep(0.96, 1.0, r));
    gl_FragColor = vec4(col * (1.0 + uNight * 0.35), a);
}`;

const MOTE_VERT = /* glsl */ `
uniform float uTime; uniform float uScale; uniform float uW; uniform float uH;
attribute float aSeed; attribute vec3 aCol;
varying float vA; varying vec3 vCol;
void main() {
    float s = aSeed;
    float life = fract(uTime * (0.07 + fract(s * 7.13) * 0.08) + s);
    float ang = s * 6.2832 + uTime * (0.2 + fract(s * 3.7) * 0.4) * (fract(s * 11.0) > 0.5 ? 1.0 : -1.0);
    float rr = 0.86 + fract(s * 5.31) * 0.3 + life * 0.25;
    vec3 p = vec3(cos(ang) * rr * uW * 0.5, uH * 0.5 + sin(ang) * rr * uH * 0.5 + life * 0.6, (fract(s * 2.9) - 0.5) * 0.5 + sin(uTime + s * 20.0) * 0.08);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = sin(life * 3.14159) * (0.5 + fract(s * 13.7) * 0.5);
    vCol = aCol;
    gl_PointSize = (0.05 + fract(s * 17.3) * 0.05) * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAG = /* glsl */ `
varying float vA; varying vec3 vCol;
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.05, 0.5, d)) * vA;
    gl_FragColor = vec4(vCol * a * 1.6, 1.0);
}`;

/** A tapered tube through `pts`, as a geometry (no end caps: they sit in the ground or in leaves). */
export function limbGeometry(pts, r0, r1, radial = 7, segs = 24) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const pos = [], nor = [], idx = [];
    const n = new V3(), b = new V3(), tan = new V3(), p = new V3(), d = new V3();
    const ref = new V3(0, 1, 0);
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        curve.getPointAt(t, p);
        curve.getTangentAt(t, tan);
        if (Math.abs(tan.dot(ref)) > 0.95) ref.set(1, 0, 0);
        n.crossVectors(tan, ref).normalize();
        b.crossVectors(tan, n).normalize();
        const r = r0 + (r1 - r0) * t;
        for (let k = 0; k < radial; k++) {
            const a = (k / radial) * TAU;
            d.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
            pos.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r);
            nor.push(d.x, d.y, d.z);
            if (i < segs) {
                const a0 = i * radial + k, a1 = i * radial + ((k + 1) % radial);
                idx.push(a0, a1, a0 + radial, a1, a1 + radial, a0 + radial);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
}

/**
 * A portal standing on y = 0 in its own group, facing +z.
 * @param {object} o  { seed, colors: [a, b, c, rim] (hex), bark (Material), bloom (hex), glowMats (array to register blossom glow in) }
 */
export function makePortal(o) {
    const r = rng(o.seed || 'portal');
    const group = new THREE.Group();
    const W = PORTAL_W, H = PORTAL_H;

    // the light itself
    const uni = {
        uTime: { value: 0 }, uNear: { value: 0 }, uNight: { value: 0 },
        uA: { value: new THREE.Color(o.colors[0]) }, uB: { value: new THREE.Color(o.colors[1]) },
        uC: { value: new THREE.Color(o.colors[2]) }, uRim: { value: new THREE.Color(o.colors[3]) },
    };
    const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H).translate(0, H / 2 + 0.02, 0),
        new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    surface.renderOrder = 2;
    surface.name = 'portal-surface';
    group.add(surface);

    // the arch: a ring of twisted wood round the oval, rooted at both feet, and a vine wound about it
    const ring = [];
    const N = 22;
    for (let k = 0; k <= N; k++) {
        // from the left foot, over the top, to the right foot
        const a = Math.PI * 1.08 - (k / N) * Math.PI * 1.16;
        const wob = 1 + Math.sin(k * 1.7 + r() * 0.5) * 0.03;
        ring.push(new V3(Math.cos(a) * (W / 2 + 0.16) * wob, H / 2 + 0.02 + Math.sin(a) * (H / 2 + 0.14) * wob, (r() - 0.5) * 0.08));
    }
    // flare the feet out into roots
    ring[0].set(-W / 2 - 0.55, -0.15, 0.05);
    ring[N].set(W / 2 + 0.55, -0.15, -0.05);
    const ringCurve = new THREE.CatmullRomCurve3(ring);
    const frameGeo = limbGeometry(ring, 0.2, 0.2, 8, 48);
    // thicker at the feet, thinner over the top
    {
        const p = frameGeo.attributes.position, radial = 8;
        for (let i = 0; i < p.count; i++) {
            const seg = Math.floor(i / radial) / 48;
            const k = 1.25 - Math.sin(seg * Math.PI) * 0.55;
            const c = ringCurve.getPointAt(seg);
            p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
        }
        frameGeo.computeVertexNormals();
    }
    const frame = new THREE.Mesh(frameGeo, o.bark);
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const vinePts = [];
    for (let k = 0; k <= 60; k++) {
        const s = k / 60;
        const base = ringCurve.getPointAt(0.02 + s * 0.96);
        const a = s * TAU * 5;
        vinePts.push(base.add(new V3(Math.cos(a) * 0.04, Math.sin(a) * 0.17, Math.cos(a + 1) * 0.22)));
    }
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3c, roughness: 0.8 });
    const vine = new THREE.Mesh(limbGeometry(vinePts, 0.045, 0.03, 5, 120), vineMat);
    group.add(vine);

    // leaves along the vine and blossom heaped over the top of the arch
    const leafGeo = new THREE.IcosahedronGeometry(1, 0);
    const leaves = [], blooms = [];
    for (let k = 0; k < 46; k++) {
        const p = vinePts[Math.floor(r() * vinePts.length)];
        leaves.push({ p: p.clone().add(new V3(r.range(-0.15, 0.15), r.range(-0.1, 0.1), r.range(-0.15, 0.15))), s: r.range(0.07, 0.13) });
    }
    for (let k = 0; k < 64; k++) {
        const s = r.range(0.12, 0.88);
        const p = ringCurve.getPointAt(s);
        const top = Math.sin(s * Math.PI);
        if (r() > top * top + 0.15) continue;
        blooms.push({ p: p.add(new V3(r.range(-0.3, 0.3), r.range(-0.05, 0.3), r.range(-0.3, 0.3))), s: r.range(0.12, 0.26) });
    }
    const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x86c050, roughness: 0.8, flatShading: true }), leaves.length);
    const bloomMat = new THREE.MeshStandardMaterial({ color: o.bloom ?? 0xffc4e2, emissive: o.bloom ?? 0xff7ac4, emissiveIntensity: 0.25, roughness: 0.7, flatShading: true });
    o.glowMats?.push({ mat: bloomMat, day: 0.2, night: 1.0 });
    const bloomMesh = new THREE.InstancedMesh(leafGeo, bloomMat, Math.max(1, blooms.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
    leaves.forEach((l, i) => leafMesh.setMatrixAt(i, m.compose(l.p, q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), sc.set(l.s, l.s * 0.5, l.s * 1.3))));
    const tint = new THREE.Color();
    blooms.forEach((b, i) => {
        bloomMesh.setMatrixAt(i, m.compose(b.p, q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), sc.setScalar(b.s)));
        bloomMesh.setColorAt(i, tint.setHSL(0.88 + r() * 0.08, 0.75, 0.78 + r() * 0.12));
    });
    leafMesh.castShadow = bloomMesh.castShadow = true;
    group.add(leafMesh, bloomMesh);

    // motes of light circling the rim and drifting up
    const NM = 110;
    const seeds = new Float32Array(NM), cols = new Float32Array(NM * 3);
    const palette = o.colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < NM; i++) {
        seeds[i] = r();
        const c = palette[i % palette.length].clone().lerp(new THREE.Color(1, 1, 1), 0.35);
        cols.set([c.r, c.g, c.b], i * 3);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
    mg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    mg.setAttribute('aCol', new THREE.BufferAttribute(cols, 3));
    const moteU = { uTime: uni.uTime, uScale: { value: 500 }, uW: { value: W }, uH: { value: H } };
    const motes = new THREE.Points(mg, new THREE.ShaderMaterial({ uniforms: moteU, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    motes.frustumCulled = false;
    group.add(motes);

    return {
        group, surface, uni,
        /** near: 0..1, how close the walker is; scale: the canvas height in pixels / 2 */
        update(t, night, near = 0, scale = 500) {
            uni.uTime.value = t;
            uni.uNight.value = night;
            uni.uNear.value += (near - uni.uNear.value) * 0.08;
            moteU.uScale.value = scale;
        },
    };
}

/**
 * Where (x, z) sits relative to a placed portal: u across it, v out of its face.
 * `p` is { x, z, nx, nz } (centre on the ground and the facing).
 */
export function portalLocal(p, x, z) {
    const dx = x - p.x, dz = z - p.z;
    return { u: dx * -p.nz + dz * p.nx, v: dx * p.nx + dz * p.nz };
}

/** True while (x, z) is in the slab of the doorway itself. */
export function inDoorway(p, x, z) {
    const { u, v } = portalLocal(p, x, z);
    return Math.abs(u) < PORTAL_W / 2 - 0.15 && Math.abs(v) < 0.32;
}

/** A ray against the oval: the distance along it, or Infinity. */
export function rayPortal(p, ray) {
    const hit = ray.intersectObject(p.surface, false)[0];
    if (!hit) return Infinity;
    const u = hit.uv.x * 2 - 1, v = hit.uv.y * 2 - 1;
    return u * u + v * v <= 1.05 ? hit.distance : Infinity;
}

/**
 * The door in the Great Tree: on the side of the trunk facing the hub, so it is
 * seen from the paths. Registers itself on `world` as `treePortal`.
 */
export function buildTreePortal(world, f) {
    const toHub = Math.atan2(-f.x, -f.z);
    const nx = Math.sin(toHub), nz = Math.cos(toHub);
    const D = 4.3;
    const x = f.x + nx * D, z = f.z + nz * D;
    const y = world.walkHeight(x, z);
    const portal = makePortal({
        seed: 'tree-portal',
        colors: ['#8fdc6a', '#ffb3d6', '#fff2a8', '#ffd6ec'],
        bark: world.mats.bark,
        glowMats: world.glowMats,
    });
    portal.group.position.set(x, y, z);
    portal.group.rotation.y = toHub;
    world.root.add(portal.group);
    portal.group.updateMatrixWorld(true);
    // the arch's feet are solid; the middle is open
    for (const s of [-1, 1]) {
        world.colliders.push({ x: x - nz * s * (PORTAL_W / 2 + 0.35), z: z + nx * s * (PORTAL_W / 2 + 0.35), r: 0.32 });
    }
    const tp = {
        x, y, z, nx, nz, yaw: toHub,
        surface: portal.surface,
        portal,
        // stand here to walk in, and where you come out again (just in front, facing away from the tree)
        front: { x: x + nx * 2.4, z: z + nz * 2.4 },
        back: { x: x - nx * 1.0, z: z - nz * 1.0 },
        out: { x: x + nx * 2.2, z: z + nz * 2.2, yaw: Math.atan2(-nx, -nz) },
        near: 0,
    };
    world.updaters.push((t, sky) => {
        portal.update(t, sky?.state?.night ?? 0, tp.near, world.canvasH ? world.canvasH * 0.5 : 500);
    });
    world.treePortal = tp;
    return tp;
}
