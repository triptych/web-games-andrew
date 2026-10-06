// The sky over Midden and the look of every biome. The dome is one shader: a hazy gradient, the
// sun and its halo, drifting fbm cloud banks, the great ring of orbital junk arcing across the
// sky (with glints where dead ships catch the sun), a gas-giant moon and, now and then, burning
// debris streaking down. A jagged horizon of junk mountains closes the world. The same sky is
// rendered into a PMREM environment map so brass and chrome reflect it.

import * as THREE from 'three';
import { NOISE_GLSL } from './materials.js';

export const BIOMES = {
    scrapyard: { top: '#3a5a7a', mid: '#d89a6a', hor: '#f0c890', sun: '#ffd8a0', sunI: 2.6, hemi: ['#ffe8c8', '#5a3a22', 0.75], fog: '#d8a878', fogD: 0.016, ground: '#8a6a48', ground2: '#6a4e34', road: '#9a8a70', drift: ['#c8783a', '#7a8278', '#a8986a'], dust: '#f0d0a0', ambient: 'dust', cloud: 0.55, junk: '#4a3a2e', sunDir: [0.5, 0.57, 0.42] },
    dunes:     { top: '#4a7ab0', mid: '#e8b880', hor: '#ffe0b0', sun: '#fff0c0', sunI: 3.0, hemi: ['#fff0d8', '#8a6a3a', 0.85], fog: '#ecc898', fogD: 0.014, ground: '#d0a46a', ground2: '#b88a52', road: '#a89070', drift: ['#c88a4a', '#9a9a8a', '#e0b070'], dust: '#ffe0b0', ambient: 'dust', cloud: 0.3, junk: '#6a5038', sunDir: [0.3, 0.75, 0.35] },
    marsh:     { top: '#2a4a5a', mid: '#6a8a7a', hor: '#a8c0a0', sun: '#d8ffd0', sunI: 1.8, hemi: ['#c8e8d8', '#2a3a2a', 0.8], fog: '#8aa898', fogD: 0.03, ground: '#4a5a3a', ground2: '#3a4a2e', road: '#7a7a62', drift: ['#4a8a4a', '#c8a83a', '#6a7a5a'], dust: '#c8ff8a', ambient: 'mote', cloud: 0.8, junk: '#2a3226', sludge: '#3a6a5a', sunDir: [-0.4, 0.60, 0.42] },
    canyon:    { top: '#4a6a9a', mid: '#e09060', hor: '#ffc080', sun: '#ffd090', sunI: 2.8, hemi: ['#ffe0c0', '#6a3a22', 0.8], fog: '#e0a070', fogD: 0.015, ground: '#a8603a', ground2: '#884a2a', road: '#b08a6a', drift: ['#c8703a', '#8a6a5a', '#d89a5a'], dust: '#ffc890', ambient: 'dust', cloud: 0.35, junk: '#5a3020', sunDir: [0.6, 0.65, 0.28] },
    sludge:    { top: '#3a4a3a', mid: '#8a9a6a', hor: '#c8c890', sun: '#e8f0b0', sunI: 2.0, hemi: ['#e0e8c0', '#2a3020', 0.8], fog: '#a0a878', fogD: 0.026, ground: '#5a5a3a', ground2: '#4a4a30', road: '#8a8468', drift: ['#7a8a3a', '#5a6a4a', '#a89a5a'], dust: '#d8e8a0', ambient: 'mote', cloud: 0.7, junk: '#2e3022', sludge: '#4a6a2a', sunDir: [0.4, 0.55, 0.42] },
    harbor:    { top: '#2a4a6a', mid: '#8aa0b0', hor: '#d8d0c0', sun: '#fff0d8', sunI: 2.2, hemi: ['#e8f0f8', '#3a3a3a', 0.85], fog: '#b0b8c0', fogD: 0.022, ground: '#6a6258', ground2: '#5a524a', road: '#8a8278', drift: ['#7a8a8a', '#5a6a7a', '#9a8a6a'], dust: '#ffffff', ambient: 'none', cloud: 0.75, junk: '#2a2e32', sludge: '#2a4a5a', sunDir: [-0.5, 0.60, 0.35] },
    toxic:     { top: '#2a3a2a', mid: '#7a9a4a', hor: '#c8e08a', sun: '#e8ffb0', sunI: 1.7, hemi: ['#d8f0b0', '#2a3a1a', 0.8], fog: '#98b070', fogD: 0.034, ground: '#4a5032', ground2: '#3a4228', road: '#7a7a5a', drift: ['#8ab83a', '#5a6a3a', '#a8a84a'], dust: '#c8ff6a', ambient: 'mote', cloud: 0.85, junk: '#262a1a', sludge: '#6aa82a', sunDir: [0.4, 0.53, 0.42] },
    frost:     { top: '#4a6a9a', mid: '#a8c0d8', hor: '#e8f0f8', sun: '#ffffff', sunI: 2.4, hemi: ['#f0f8ff', '#5a6a8a', 0.95], fog: '#d0e0f0', fogD: 0.022, ground: '#c8d8e8', ground2: '#a8b8d0', road: '#8a9aaa', drift: ['#c8e8ff', '#8aa0b8', '#ffffff'], dust: '#ffffff', ambient: 'snow', cloud: 0.6, junk: '#5a6a7a', sludge: '#8ac8e8', sunDir: [0.4, 0.45, 0.42] },
    sky:       { top: '#2a4a8a', mid: '#88a8d8', hor: '#e0e8f8', sun: '#fff8e0', sunI: 2.8, hemi: ['#f0f8ff', '#4a5a6a', 0.9], fog: '#c8d8f0', fogD: 0.012, ground: '#8a8a8a', ground2: '#6a6a6e', road: '#a89a80', drift: ['#c8c8d8', '#8a9aa8', '#c8a86a'], dust: '#ffffff', ambient: 'none', cloud: 0.5, junk: '#4a4e56', sunDir: [0.5, 0.70, 0.28] },
    boiler:    { top: '#3a3036', mid: '#b07850', hor: '#e8a870', sun: '#ffb880', sunI: 2.2, hemi: ['#ffd8b8', '#4a2a1a', 0.8], fog: '#b08060', fogD: 0.026, ground: '#5a4a3e', ground2: '#4a3c32', road: '#7a6a5a', drift: ['#a8683a', '#6a6a6a', '#8a7a5a'], dust: '#3a3a3a', ambient: 'ash', cloud: 0.9, junk: '#2e2622', sunDir: [0.5, 0.55, 0.42] },
    volt:      { top: '#1a2a5a', mid: '#5a6ab0', hor: '#c8b8e8', sun: '#e8f0ff', sunI: 2.0, hemi: ['#d8e0ff', '#2a2a4a', 0.85], fog: '#8a90c0', fogD: 0.02, ground: '#5a5a62', ground2: '#4a4a52', road: '#7a7a82', drift: ['#c8a83a', '#7a8aa8', '#a8a8b8'], dust: '#fff07a', ambient: 'mote', cloud: 0.7, junk: '#22243a', sunDir: [-0.4, 0.65, 0.42] },
    causeway:  { top: '#3a2a5a', mid: '#c87a6a', hor: '#ffc890', sun: '#ffd8a0', sunI: 2.6, hemi: ['#ffe0c8', '#3a2a3a', 0.85], fog: '#d0907a', fogD: 0.013, ground: '#7a6a5a', ground2: '#6a5a4a', road: '#c8a870', drift: ['#c8903a', '#8a7a8a', '#d8b86a'], dust: '#ffd8a0', ambient: 'dust', cloud: 0.4, junk: '#3a2a2e', sunDir: [0.6, 0.45, 0.35] },
    // Indoors and underground (no visible sky).
    interior:  { interior: true, hemi: ['#ffe8c8', '#3a2a20', 0.55], fog: '#1a120c', fogD: 0.0, ground: '#5a4030', ground2: '#4a3428', road: '#6a5040', drift: ['#7a6a5a', '#5a5048', '#8a7a62'], ambient: 'none', light: '#ffc890' },
    wreck:     { interior: true, hemi: ['#c8d8e8', '#1a1a22', 0.6], fog: '#0a0c10', fogD: 0.05, ground: '#3a3e44', ground2: '#2e3238', road: '#4a4e54', drift: ['#7a7a7a', '#5a5a62', '#8a6a4a'], ambient: 'mote', dust: '#8ad8ff', light: '#8ac8ff' },
    refinery:  { interior: true, hemi: ['#d8f0b0', '#1a2210', 0.6], fog: '#0c1008', fogD: 0.05, ground: '#3a3e30', ground2: '#2e3228', road: '#4a4e40', drift: ['#7a9a3a', '#5a6a4a', '#8a8a5a'], ambient: 'mote', dust: '#aaff6a', light: '#aaff6a' },
    station:   { interior: true, hemi: ['#d8d8ff', '#1a1a2a', 0.55], fog: '#06060c', fogD: 0.06, ground: '#3a3a44', ground2: '#2e2e38', road: '#4a4a54', drift: ['#8a8aa8', '#5a5a6a', '#a87aff'], ambient: 'mote', dust: '#c08aff', light: '#a88aff' },
    leviathan: { interior: true, hemi: ['#ffc8a8', '#2a1010', 0.6], fog: '#100606', fogD: 0.05, ground: '#3a2a26', ground2: '#2e2220', road: '#4a3430', drift: ['#a8582a', '#5a3a32', '#8a4a3a'], ambient: 'ember', dust: '#ff7a2a', light: '#ff7a4a' },
    cave:      { interior: true, hemi: ['#ffc890', '#2a1a10', 0.6], fog: '#100806', fogD: 0.06, ground: '#4a3020', ground2: '#3a2618', road: '#5a3a28', drift: ['#a86a3a', '#6a4a3a', '#c8783a'], ambient: 'ember', dust: '#ff9a4a', light: '#ff8a3a' },
    frostcave: { interior: true, hemi: ['#d0f0ff', '#1a2a3a', 0.65], fog: '#081018', fogD: 0.06, ground: '#7a8a9a', ground2: '#6a7a8a', road: '#8a9aaa', drift: ['#c8e8ff', '#8aa0b8', '#ffffff'], ambient: 'snow', dust: '#ffffff', light: '#8ad8ff' },
};
export function biomeOf(map) {
    if (map.biome && BIOMES[map.biome]) return BIOMES[map.biome];
    return BIOMES.interior;
}

const SKY_VERT = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = /* glsl */`
    uniform vec3 uTop, uMid, uHor, uSun, uSunDir; uniform float uTime, uCloud;
    varying vec3 vDir;
    ${NOISE_GLSL}
    void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.18, h));
        col = mix(col, uTop, smoothstep(0.15, 0.85, h));
        if (h < 0.0) col = mix(uHor, uHor * 0.6, smoothstep(0.0, -0.3, h));
        // Sun.
        vec3 sd = normalize(uSunDir);
        float sdot = max(0.0, dot(d, sd));
        col += uSun * (pow(sdot, 900.0) * 6.0 + pow(sdot, 40.0) * 0.45 + pow(sdot, 6.0) * 0.18);
        // The ring of orbital junk: a band on a tilted plane, broken into chunks.
        vec3 rn = normalize(vec3(0.25, 1.0, 0.55));
        float rd = dot(d, rn);
        float band = smoothstep(0.035, 0.0, abs(rd - 0.12)) + 0.6 * smoothstep(0.02, 0.0, abs(rd - 0.075));
        vec3 rp = d * 40.0;
        float chunks = smoothstep(0.35, 0.75, swNoise(rp * 1.7 + vec3(uTime * 0.02, 0.0, 0.0)));
        float glint = step(0.985, swHash(floor(rp * 6.0 + vec3(floor(uTime * 2.0)))));
        float ringA = band * (0.35 + 0.65 * chunks) * smoothstep(-0.05, 0.25, h);
        col = mix(col, vec3(0.32, 0.28, 0.26) + uSun * 0.25, ringA * 0.75);
        col += uSun * glint * band * smoothstep(0.0, 0.3, h) * 1.5;
        // The gas giant.
        vec3 pd = normalize(vec3(-0.65, 0.42, -0.6));
        float pr = acos(clamp(dot(d, pd), -1.0, 1.0));
        if (pr < 0.16) {
            float k = pr / 0.16;
            vec3 pc = mix(vec3(0.85, 0.62, 0.42), vec3(0.55, 0.35, 0.3), swNoise(vec3(d.y * 60.0, uTime * 0.01, 1.0)));
            float lit = clamp(dot(normalize(d - pd + sd * 0.1), sd) * 2.0 + 0.4, 0.15, 1.0);
            col = mix(col, pc * lit, smoothstep(1.0, 0.94, k) * 0.9);
        }
        // Cloud banks.
        vec2 cuv = d.xz / max(0.08, h + 0.12);
        float cl = swFbm(vec3(cuv * 1.2 + vec2(uTime * 0.012, uTime * 0.006), uTime * 0.01));
        float cm = smoothstep(0.42, 0.78, cl) * uCloud * smoothstep(-0.02, 0.3, h);
        vec3 cc = mix(uHor * 0.85, vec3(1.0, 0.97, 0.92), 0.4 + 0.6 * pow(sdot, 4.0));
        col = mix(col, cc, cm * 0.8);
        // Falling debris streaks.
        float t = fract(uTime * 0.07);
        vec3 fd = normalize(vec3(0.3 - t * 0.6, 0.55 - t * 0.35, -0.75));
        float streak = smoothstep(0.996, 1.0, dot(d, fd)) * (1.0 - t);
        col += vec3(1.0, 0.6, 0.3) * streak * 3.0;
        gl_FragColor = vec4(col, 1.0);
    }`;

export function makeSky() {
    const mat = new THREE.ShaderMaterial({
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
        uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0.5, 0.4, -0.6) }, uTime: { value: 0 }, uCloud: { value: 0.5 } },
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
    m.frustumCulled = false;
    m.renderOrder = -10;
    return m;
}
export function setSky(sky, B) {
    const u = sky.material.uniforms;
    u.uTop.value.set(B.top || '#000'); u.uMid.value.set(B.mid || '#000'); u.uHor.value.set(B.hor || '#000');
    u.uSun.value.set(B.sun || '#fff'); u.uCloud.value = B.cloud ?? 0.5;
    u.uSunDir.value.set(...(B.sunDir || [0.5, 0.4, -0.6])).normalize();
}

/** A ring of jagged junk mountains on the horizon. */
export function makeHorizon(color) {
    const g = new THREE.Group();
    const seg = 160, R = 170;
    const pos = [], idx = [];
    let s = 777;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const hgt = 10 + rnd() * 14 + Math.sin(a * 5) * 5 + (rnd() < 0.08 ? 12 : 0);
        pos.push(Math.cos(a) * R, -2, Math.sin(a) * R, Math.cos(a) * R, hgt, Math.sin(a) * R);
        if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }));
    g.add(m);
    // A second, nearer and darker band.
    const m2 = m.clone(); m2.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), side: THREE.DoubleSide, fog: true });
    m2.scale.set(0.62, 0.55, 0.62); m2.rotation.y = 1.3;
    g.add(m2);
    return g;
}
