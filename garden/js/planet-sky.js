// The sky over a planet the Silver Comet's transporter throws you at: a dome
// that follows the camera, with a gradient from horizon to zenith, one or two
// suns with their glow, stars (all day long where the air is thin), a band of
// nebula, now and then an aurora, and other worlds hanging in it: ringed and
// banded giants, rocky neighbours and small moons, each lit from the side the
// sun is on, so they show phases, and fading into the sky on their dark side
// wherever there is air in front of them.

import * as THREE from 'three';
import { NOISE, RING_VERT, RING_FRAG } from './scope.js';
import { TAU } from './util.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const DOME_FRAG = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSeed; uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunSize;
uniform vec3 uSun2Dir; uniform vec3 uSun2Col; uniform float uSun2Size; uniform float uSun2;
uniform float uStars; uniform float uNeb; uniform vec3 uNebA; uniform vec3 uNebB; uniform vec3 uNebAxis;
uniform float uAurora; uniform vec3 uAurA; uniform vec3 uAurB; uniform float uHaze;
varying vec3 vDir;
${NOISE}
vec3 sunGlow(vec3 d, vec3 dir, vec3 col, float size) {
    float c = dot(d, dir);
    float disk = smoothstep(cos(size * 1.08), cos(size * 0.92), c);
    float glow = pow(max(c, 0.0), 12.0) * 0.45 + pow(max(c, 0.0), 220.0) * 0.9 + pow(max(c, 0.0), 3.0) * 0.12 * uHaze;
    return col * (disk * 3.0 + glow);
}
void main() {
    vec3 d = normalize(vDir);
    float up = d.y;
    float h = pow(clamp(up, 0.0, 1.0), 0.45);
    vec3 col = mix(uHorizon, uZenith, h);
    // a warm band where the sun is near the horizon
    float low = 1.0 - smoothstep(0.0, 0.35, uSunDir.y);
    float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
    col += uSunCol * low * toward * (1.0 - smoothstep(0.0, 0.35, abs(up))) * 0.5 * uHaze;
    col = mix(col, uGround, smoothstep(0.0, -0.12, up));
    // stars: cells on the sphere, a few lit, twinkling
    if (uStars > 0.001) {
        vec3 q = d * 260.0;
        vec3 cell = floor(q);
        float s = hash(cell + uSeed);
        float star = step(0.985, s) * smoothstep(0.62, 0.0, length(fract(q) - 0.5));
        float tw = 0.65 + 0.35 * sin(uTime * (1.0 + s * 4.0) + s * 40.0);
        vec3 sc = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash(cell * 1.7));
        col += sc * star * tw * uStars * smoothstep(-0.05, 0.15, up) * 1.4;
    }
    // a band of nebula across the sky
    if (uNeb > 0.001) {
        float band = exp(-pow(dot(d, uNebAxis) / 0.32, 2.0));
        float n = fbm(d * 2.6 + uSeed);
        float n2 = fbm(d * 6.0 + uSeed * 1.3 + n);
        vec3 nc = mix(uNebA, uNebB, smoothstep(0.35, 0.7, n2));
        col += nc * band * smoothstep(0.42, 0.78, n) * uNeb * smoothstep(-0.05, 0.2, up);
    }
    // an aurora: curtains hanging over one side of the horizon
    if (uAurora > 0.001) {
        float ang = atan(d.z, d.x);
        float curtain = fbm(vec3(ang * 3.0, uTime * 0.05, uSeed.x)) ;
        float ripple = 0.5 + 0.5 * sin(ang * 22.0 + curtain * 9.0 + uTime * 0.3);
        float hgt = smoothstep(0.05, 0.22, up) * (1.0 - smoothstep(0.25 + curtain * 0.35, 0.65, up));
        float side = smoothstep(-0.2, 0.6, d.x * 0.7 + d.z * 0.7);
        col += mix(uAurA, uAurB, smoothstep(0.1, 0.5, up)) * hgt * ripple * side * uAurora * smoothstep(0.35, 0.7, curtain + 0.25);
    }
    col += sunGlow(d, uSunDir, uSunCol, uSunSize) * smoothstep(-0.06, 0.02, up);
    if (uSun2 > 0.5) col += sunGlow(d, uSun2Dir, uSun2Col, uSun2Size) * smoothstep(-0.06, 0.02, up);
    gl_FragColor = vec4(col, 1.0);
}`;

const BODY_VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN;
void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BODY_FRAG = /* glsl */ `
uniform vec3 uSeed; uniform float uGas; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform float uSea; uniform float uIce; uniform vec3 uLight; uniform float uBands; uniform float uHaze; uniform float uCraters;
varying vec3 vP; varying vec3 vN;
${NOISE}
void main() {
    vec3 p = normalize(vP);
    vec3 col;
    if (uGas > 0.5) {
        float w = fbm(p * 2.2 + uSeed);
        float lat = p.y + (w - 0.5) * 0.35;
        float b = 0.5 + 0.5 * sin(lat * uBands);
        float b2 = 0.5 + 0.5 * sin(lat * uBands * 2.37 + 1.3);
        col = mix(uC0, uC1, b);
        col = mix(col, uC2, b2 * 0.5);
        col = mix(col, uC3, smoothstep(0.6, 0.85, fbm(p * vec3(3.0, 14.0, 3.0) + uSeed)) * 0.45);
    } else {
        float h = fbm(p * 1.8 + uSeed) * 0.75 + fbm(p * 6.0 + uSeed * 1.7) * 0.25;
        col = h < uSea ? mix(uC0, uC1, smoothstep(uSea - 0.15, uSea, h)) : mix(uC2, uC3, smoothstep(uSea, uSea + 0.3, h));
        if (uCraters > 0.0) {
            float cr = ridge(p * 5.0 + uSeed);
            col *= 1.0 - smoothstep(0.55, 0.8, cr) * 0.35 * uCraters;
        }
        float pole = abs(p.y) + (fbm(p * 4.0 + uSeed) - 0.5) * 0.25;
        col = mix(col, vec3(0.93, 0.96, 1.0), smoothstep(1.0 - uIce, 1.05 - uIce, pole));
    }
    float lit = smoothstep(-0.12, 0.4, dot(normalize(vN), normalize(uLight)));
    vec3 outc = col * (0.02 + lit * 1.1);
    gl_FragColor = vec4(outc, mix(1.0, 0.04 + lit * 0.96, uHaze));
}`;

/**
 * Build the sky. `o`: { r (rng), zenith, horizon, ground, sun: { dir, col, size }, sun2?, stars, neb?, aurora?, haze, bodies: [...] }
 * Returns { group, update(dt, t, camera), dispose() }.
 */
export function buildSky(o) {
    const { r } = o;
    const group = new THREE.Group();
    const U = {
        uZenith: { value: C(o.zenith) }, uHorizon: { value: C(o.horizon) }, uGround: { value: C(o.ground) },
        uSeed: { value: new V3(r() * 40, r() * 40, r() * 40) }, uTime: { value: 0 },
        uSunDir: { value: o.sun.dir.clone() }, uSunCol: { value: C(o.sun.col) }, uSunSize: { value: o.sun.size },
        uSun2Dir: { value: (o.sun2?.dir ?? o.sun.dir).clone() }, uSun2Col: { value: C(o.sun2?.col ?? '#000000') }, uSun2Size: { value: o.sun2?.size ?? 0.01 }, uSun2: { value: o.sun2 ? 1 : 0 },
        uStars: { value: o.stars }, uNeb: { value: o.neb?.amt ?? 0 }, uNebA: { value: C(o.neb?.a ?? '#000000') }, uNebB: { value: C(o.neb?.b ?? '#000000') },
        uNebAxis: { value: new V3(r() - 0.5, r() * 0.6, r() - 0.5).normalize() },
        uAurora: { value: o.aurora?.amt ?? 0 }, uAurA: { value: C(o.aurora?.a ?? '#3affa0') }, uAurB: { value: C(o.aurora?.b ?? '#a04aff') },
        uHaze: { value: o.haze },
    };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), new THREE.ShaderMaterial({ uniforms: U, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    group.add(dome);

    const spinners = [];
    const light = o.sun.dir;
    for (const b of o.bodies) {
        const dist = 1000;
        const rad = Math.tan(b.size / 2) * dist;
        const holder = new THREE.Group();
        holder.position.copy(b.dir).multiplyScalar(dist);
        group.add(holder);
        const tilt = new THREE.Group();
        tilt.rotation.set(b.tilt ?? 0, r() * TAU, (r() - 0.5) * 0.6);
        holder.add(tilt);
        const cols = b.cols.map(C);
        const BU = {
            uSeed: { value: new V3(r() * 60, r() * 60, r() * 60) }, uGas: { value: b.gas ? 1 : 0 },
            uC0: { value: cols[0] }, uC1: { value: cols[1] }, uC2: { value: cols[2] }, uC3: { value: cols[3] },
            uSea: { value: b.sea ?? -1 }, uIce: { value: b.ice ?? 0 }, uLight: { value: light }, uBands: { value: b.bands ?? 14 },
            uHaze: { value: o.haze * (b.hazeK ?? 1) }, uCraters: { value: b.craters ?? 0 },
        };
        const body = new THREE.Mesh(new THREE.SphereGeometry(rad, 64, 40), new THREE.ShaderMaterial({ uniforms: BU, vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, transparent: true, depthWrite: true, fog: false }));
        // the body writes depth (the ring is drawn after it) so the far half of the ring passes behind the planet
        body.renderOrder = -9;
        tilt.add(body);
        spinners.push({ m: body, w: 0.004 + r() * 0.01 });
        if (b.rings) {
            const RU = {
                uIn: { value: rad * 1.3 }, uOut: { value: rad * b.rings }, uC0: { value: cols[0].clone().lerp(C('#ffffff'), 0.35) },
                uC1: { value: cols[3].clone().lerp(C('#e8d8c0'), 0.5) }, uSeed: { value: r() * 100 }, uLight: { value: light },
                uCenter: { value: new V3() }, uPR: { value: rad },
            };
            const ring = new THREE.Mesh(new THREE.RingGeometry(rad * 1.3, rad * b.rings, 128, 1), new THREE.ShaderMaterial({ uniforms: RU, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            ring.rotation.x = -Math.PI / 2;
            ring.renderOrder = -8;
            tilt.add(ring);
            spinners.push({ ring, RU });
        }
    }
    // the sky's clouds and planets turn very slowly
    const update = (dt, t, camera) => {
        group.position.copy(camera.position);
        U.uTime.value = t;
        for (const s of spinners) {
            if (s.m) s.m.rotation.y += dt * s.w;
            if (s.ring) s.ring.getWorldPosition(s.RU.uCenter.value);
        }
    };
    const dispose = () => {
        group.traverse((m) => {
            m.geometry?.dispose();
            m.material?.dispose();
        });
    };
    return { group, update, dispose, uniforms: U };
}
