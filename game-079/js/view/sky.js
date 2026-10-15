// The outdoor sky: a synthwave sunset dome with a striped sun and stars, a far skyline ring of
// lit towers, and the Xerxid mothership hanging over the city.

import * as THREE from 'three';
import { SU, NOISE } from './shaderlib.js';

const SKY_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vDir;
${NOISE}
void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 zen = vec3(0.012, 0.004, 0.04);
    vec3 mid = vec3(0.12, 0.015, 0.16);
    vec3 hor = vec3(0.9, 0.12, 0.25);
    vec3 col = mix(mid, zen, smoothstep(0.05, 0.6, h));
    col = mix(hor, col, smoothstep(-0.02, 0.22, h));
    // the sun, low in the west, with the classic stripes cut through its lower half
    vec3 sunDir = normalize(vec3(-0.85, 0.09, -0.52));
    float sd = acos(clamp(dot(d, sunDir), -1.0, 1.0));
    float sunR = 0.16;
    float inSun = 1.0 - smoothstep(sunR - 0.004, sunR, sd);
    float sy = (d.y - sunDir.y) / sunR;
    // gaps widen toward the bottom of the disc and drift down
    float stripes = sy > 0.0 ? 1.0 : step(mix(0.08, 0.7, -sy), fract(sy * 6.0 + uTime * 0.12));
    vec3 sunCol = mix(vec3(3.2, 0.25, 0.8), vec3(3.6, 2.4, 0.3), smoothstep(-0.8, 0.9, sy));
    col = mix(col, sunCol, inSun * stripes);
    col += vec3(1.0, 0.15, 0.4) * exp(-sd * 5.0) * 0.35;
    // stars, twinkling
    // stars hashed on the 3D direction so they stay round
    vec3 sp = floor(d * 260.0);
    float sh = hash13(sp);
    float st = step(0.9975, sh) * smoothstep(0.08, 0.4, h);
    col += st * (0.6 + 0.4 * sin(uTime * 3.0 + sh * 600.0)) * vec3(0.9, 0.85, 1.0);
    // a haze of drifting cloud bands
    float cl = fbm(vec2(atan(d.z, d.x) * 3.0 + uTime * 0.01, h * 9.0)) * smoothstep(0.0, 0.15, h) * smoothstep(0.5, 0.15, h);
    col = mix(col, vec3(0.25, 0.05, 0.2), cl * 0.5);
    gl_FragColor = vec4(col, 1.0);
}`;

const SKYLINE_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vW;
varying vec3 vN;
${NOISE}
void main() {
    vec3 n = normalize(vN);
    vec2 uv = abs(n.y) > 0.5 ? vW.xz : vec2(dot(vW.xz, vec2(-n.z, n.x)), vW.y);
    vec2 id = floor(uv / vec2(4.0, 5.0));
    vec2 f = fract(uv / vec2(4.0, 5.0));
    float win = step(0.25, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.8) * step(0.5, abs(n.y) < 0.5 ? 1.0 : 0.0);
    float lit = step(0.62, hash12(id));
    vec3 wc = mix(vec3(1.0, 0.7, 0.35), vec3(0.4, 0.7, 1.0), step(0.5, hash12(id + 3.0)));
    vec3 col = vec3(0.012, 0.008, 0.02) + win * lit * wc * 0.9;
    // haze toward the horizon glow
    float haze = smoothstep(120.0, 10.0, vW.y);
    col = mix(col, vec3(0.25, 0.03, 0.12), haze * 0.35);
    gl_FragColor = vec4(col, 1.0);
}`;

function mothership() {
    const g = new THREE.Group();
    const prof = [];
    // a lathe profile: dome on top, wide flat rim, a stepped belly
    const pts = [[0, 14], [10, 13], [18, 10], [24, 6], [70, 1.5], [78, 0], [70, -2], [40, -5], [30, -9], [20, -10], [0, -11]];
    for (const [r, y] of pts) prof.push(new THREE.Vector2(r, y));
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshStandardMaterial({ color: 0x1b1028, metalness: 0.8, roughness: 0.35, emissive: 0x08020f }));
    g.add(hull);
    // a ring of lights under the rim
    const n = 48;
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 2.2), toneMapped: false }), n);
    const m = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        m.makeTranslation(Math.cos(a) * 66, -2.6, Math.sin(a) * 66);
        lights.setMatrixAt(k, m);
    }
    g.add(lights);
    // the belly eye and its tractor beam
    const eye = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.6, 3.0), toneMapped: false }));
    eye.rotation.x = Math.PI / 2;
    eye.position.y = -11.1;
    g.add(eye);
    const beamMat = new THREE.ShaderMaterial({
        uniforms: { uTime: SU.uTime },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float a = vUv.y * 0.22 * (0.7 + 0.3 * sin(vUv.y * 40.0 + uTime * 8.0)) * (0.6 + 0.4 * sin(vUv.x * 60.0 + uTime)); gl_FragColor = vec4(vec3(0.9, 0.3, 1.0) * a, a); }',
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(16, 38, 160, 48, 1, true), beamMat);
    beam.position.y = -91;
    g.add(beam);
    g.userData = { lights, beam };
    return g;
}

export function buildSky(L) {
    const group = new THREE.Group();
    if (!L.outdoor) return { group, update() {} };
    const cx = L.W * 1.5, cz = L.H * 1.5;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
        uniforms: { uTime: SU.uTime }, side: THREE.BackSide, depthWrite: false,
        vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }',
        fragmentShader: SKY_FRAG,
    }));
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    group.add(dome);
    // the far skyline: a ring of towers beyond the playable city
    const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
        uniforms: { uTime: SU.uTime },
        vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: SKYLINE_FRAG,
    }), 220);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let seed = 1234;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const R0 = Math.max(L.W, L.H) * 1.5 * 1.45 + 30;
    for (let k = 0; k < 220; k++) {
        const a = (k / 220) * Math.PI * 2 + rnd() * 0.02;
        const r = R0 + rnd() * 160;
        p.set(cx + Math.cos(a) * r, -1, cz + Math.sin(a) * r);
        s.set(14 + rnd() * 26, 30 + rnd() * rnd() * 160, 14 + rnd() * 26);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 3);
        m.compose(p, q, s);
        towers.setMatrixAt(k, m);
    }
    towers.frustumCulled = false;
    group.add(towers);
    const ship = mothership();
    ship.position.set(cx + 40, 170, cz - 60);
    ship.rotation.z = 0.05;
    group.add(ship);
    return {
        group,
        update(t) { ship.rotation.y = t * 0.02; ship.position.y = 170 + Math.sin(t * 0.3) * 3; },
    };
}
