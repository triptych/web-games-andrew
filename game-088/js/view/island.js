// Puffin Isle: about 260 units across. The museum stands on a plateau above Curio Cove on the
// south coast; inland there are dunes, a fishing village, the sea cliffs and their lighthouse,
// the Old Ruins, Whispering Woods, a highland lake whose river falls over a waterfall to the sea,
// a meadow with a windmill, Jungle Hill, a quarry, and Mount Ember, a sleepy volcano that smokes.
//
// Everything here is static scenery built once: the terrain mesh and its colours, the sea (which
// reads a baked height texture for its shallows and foam), the lake, river and waterfall, forests
// as instanced meshes, and the landmarks. islandH(x, z) is the ground height anywhere.
//
// World axes: +x east, -z north, y up. Water is y = 0. The museum rooms are at |x| < 14,
// -15 < z < 12 (js/view/museum3d.js) and stand on FLOOR_Y.

import * as THREE from 'three';
import { Kit, sphere, box, cyl, cone, torus, bumpy, noise3, shade, ribbon, tube, glowTexture } from './kit.js';
import { makeRng } from '../rng.js';
import * as P from './props.js';

const PI = Math.PI;
export const FLOOR_Y = 1.0;
export const EXT = 150;                  // the terrain square is [-EXT, EXT] in x and centred on Z0
export const Z0 = -75;

// ------------------------------------------------------------------ places
export const VOLCANO = { x: 0, z: -150, h: 52, r: 64, crater: 13 };
export const LAKE = { x: -30, z: -80, rx: 15, rz: 10, y: 4.6 };
/** River from the lake to the west coast: [x, z, waterY]. The drop between points 2 and 3 is the waterfall. */
export const RIVER = [[-44, -82, 4.45], [-50, -85, 4.4], [-53, -86, 4.3], [-56, -87, 1.15], [-66, -84, 0.95], [-80, -78, 0.7], [-94, -73, 0.45], [-108, -69, 0.15], [-124, -66, -0.4]];
export const COVE = { x: 0, z: 40, r: 21 };
export const LIGHTHOUSE = [-104, 27];
export const VILLAGE = [[-26, 22], [-33, 27], [-22, 30], [-38, 20], [-30, 34], [-42, 28]];
export const WINDMILL = [34, -32];
export const RUINS = [-64, -40];
export const QUARRY = [34, -110];

/** One dig site per chapter, then the Night Digs. theme indexes js/view/board3d.js THEMES. */
export const DIG_SITES = [
    { name: 'Dune Dig', x: 46, z: 24, theme: 0 },
    { name: 'Old Ruins', x: -58, z: -34, theme: 1 },
    { name: 'Jungle Hill', x: 66, z: -50, theme: 2 },
    { name: 'Sea Cliffs', x: -76, z: 16, theme: 3 },
    { name: 'Sunset Quarry', x: 28, z: -104, theme: 4 },
    { name: 'Ember Rim', x: -26, z: -122, theme: 5 },
];

/** Names for the map, with the height their label floats at. */
export const REGIONS = [
    { name: 'Curio Cove', x: 0, z: 36, y: 6 },
    { name: 'Lighthouse Point', x: -96, z: 30, y: 16 },
    { name: 'Driftwood Dunes', x: 64, z: 22, y: 6 },
    { name: 'Puffin Village', x: -32, z: 26, y: 7 },
    { name: 'Old Ruins', x: -64, z: -42, y: 16 },
    { name: 'Whispering Woods', x: -90, z: -112, y: 14 },
    { name: 'Mirror Lake', x: -30, z: -80, y: 10 },
    { name: 'Windmill Meadow', x: 32, z: -30, y: 12 },
    { name: 'Jungle Hill', x: 72, z: -56, y: 20 },
    { name: 'Sunset Quarry', x: 36, z: -112, y: 18 },
    { name: 'Mount Ember', x: 0, z: -150, y: 58 },
];

/** Dirt paths from the museum's back door to every dig site, as polylines. */
export const PATHS = [
    [[0, -15], [8, -22], [22, -28], [34, -32]],
    [[34, -32], [50, -40], [66, -50]],
    [[34, -32], [36, -60], [32, -85], [28, -104]],
    [[0, -15], [-14, -24], [-30, -30], [-46, -32], [-58, -34]],
    [[-14, 2], [-24, 10], [-30, 20]],
    [[-30, 20], [-50, 18], [-76, 16], [-96, 24]],
    [[14, 6], [26, 12], [38, 18], [46, 24]],
    [[-30, -30], [-30, -60], [-30, -69]],
    [[-30, -91], [-28, -105], [-26, -122]],
];

// ------------------------------------------------------------------ the height of the land
const BLOBS = [
    [0, -72, 106, 122],     // the main body
    [-80, 22, 40, 27],      // the south-west headland (cliffs, lighthouse)
    [62, 20, 36, 24],       // the south-east dunes
    [-96, -104, 30, 40],    // the west woods lobe
    [96, -78, 28, 44],      // the east jungle lobe
];
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const blobF = (b, x, z) => 1 - ((x - b[0]) / b[2]) ** 2 - ((z - b[1]) / b[3]) ** 2;

/** Land field: > 0 on land, about 0 at the shore. */
function landF(x, z) {
    let f = -9;
    for (const b of BLOBS) f = Math.max(f, blobF(b, x, z));
    f += (noise3(x * 0.03, 0, z * 0.03, 11) - 0.5) * 0.22 + (noise3(x * 0.09, 0, z * 0.09, 12) - 0.5) * 0.07;
    const d = Math.hypot(x - COVE.x, (z - COVE.z) / 0.92);
    f = Math.min(f, ((d / COVE.r) ** 2 - 1) * 0.5);
    return f;
}

function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
    return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t];
}
/** Distance to the river and the water height there. */
function riverAt(x, z) {
    let best = 1e9, y = 0;
    for (let i = 0; i + 1 < RIVER.length; i++) {
        const [d, t] = segDist(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]);
        if (d < best) { best = d; y = RIVER[i][2] + (RIVER[i + 1][2] - RIVER[i][2]) * t; }
    }
    return [best, y];
}
export function pathDist(x, z) {
    let best = 1e9;
    for (const p of PATHS) for (let i = 0; i + 1 < p.length; i++) best = Math.min(best, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1])[0]);
    return best;
}

const hcache = new Map();
/** Ground height at (x, z). The museum plateau is flat at FLOOR_Y - 0.05; dig sites are levelled. */
export function islandH(x, z) {
    const key = Math.round(x * 4) * 100003 + Math.round(z * 4);
    let h = hcache.get(key);
    if (h !== undefined) return h;
    h = baseH(x, z);
    for (const s of DIG_SITES) {
        const ds = Math.hypot(x - s.x, z - s.z);
        if (ds < 9) h += (siteGround(s) - h) * smooth(9, 5, ds);
    }
    hcache.set(key, h);
    return h;
}

/** The ground a dig site is levelled to: the average round it, never below the beach. */
const siteCache = new Map();
function siteGround(s) {
    if (!siteCache.has(s.name)) {
        let sum = 0;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; sum += baseH(s.x + Math.cos(a) * 3, s.z + Math.sin(a) * 3); }
        siteCache.set(s.name, Math.max(0.9, sum / 8));
    }
    return siteCache.get(s.name);
}

function baseH(x, z) {
    const f = landF(x, z);
    // beach rising from the sea, then a sea floor falling away
    const shore = smooth(-0.05, 0.12, f) * 2.0 - 0.8;
    let h = f < 0 ? Math.max(-12, shore + f * 26) : shore;
    const inland = smooth(0.08, 0.35, f);
    h += (noise3(x * 0.022, 0, z * 0.022, 3) - 0.35) * 5 * inland + (noise3(x * 0.07, 0, z * 0.07, 4) - 0.5) * 1.2 * inland;
    // land never sinks below the sea inland (the sea would show through as ponds)
    if (f > 0) h = Math.max(h, shore + inland * 0.9);
    // Mount Ember
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (dv < VOLCANO.r) {
        let cone = VOLCANO.h * Math.pow(1 - dv / VOLCANO.r, 1.55);
        cone += (noise3(Math.atan2(z - VOLCANO.z, x - VOLCANO.x) * 3, dv * 0.08, 0, 7) - 0.5) * 20 * (dv / VOLCANO.r) * (1 - dv / VOLCANO.r);
        if (dv < VOLCANO.crater) cone -= Math.pow(1 - dv / VOLCANO.crater, 0.7) * 22;
        h = Math.max(h, h * 0.4 + cone);
    }
    // the hills of the Old Ruins and Jungle Hill
    h += 9 * Math.exp(-((x - RUINS[0]) ** 2 + (z - RUINS[1]) ** 2) / 520) * inland;
    h += 13 * Math.exp(-((x - 72) ** 2 + (z + 56) ** 2) / 760) * inland;
    // the headland's cliffs: a plateau with steep edges
    // the south-west headland rises gently from the village to sea cliffs at its tip
    const head = smooth(-50, -78, x + (noise3(x * 0.05, 0, z * 0.05, 13) - 0.5) * 10) * smooth(-30, -5, z);
    h += 7 * head * smooth(0.0, 0.07, f);
    // the dunes roll
    const fd = blobF(BLOBS[2], x, z);
    if (fd > 0) h += (Math.sin(x * 0.28 + noise3(x * 0.05, 0, z * 0.05, 14) * 6) * 0.5 + 0.5) * 1.6 * smooth(0.05, 0.4, fd);
    // the highland round Mirror Lake and its bowl
    h += 4.5 * Math.exp(-(((x - LAKE.x) ** 2) / 1300 + ((z - LAKE.z) ** 2) / 900));
    const dl = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
    if (dl < 1.7) { const w = smooth(1.7, 1.25, dl); h = h * (1 - w) + Math.max(h, LAKE.y + 0.45) * w; }
    if (dl < 1) h = Math.min(h, LAKE.y - 0.3 - (1 - dl) * 2.5);
    // the river: banks a little above its water, a bed cut below it
    const [dr, ry] = riverAt(x, z);
    if (dr < 9 && ry > 0.3) h = Math.max(h, (ry + 0.5) * smooth(9, 5, dr) + h * (1 - smooth(9, 5, dr)));
    if (dr < 7) h += (Math.min(h, ry - 0.8) - h) * smooth(6.5, 2.2, dr);
    // the quarry's terraces
    const dq = Math.hypot(x - QUARRY[0], z - QUARRY[1]);
    if (dq < 18) { const t = Math.max(1.2, Math.floor(h / 3.2) * 3.2 + 0.4); h += (t - h) * smooth(18, 12, dq); }
    // flat ground for the museum and the village
    const inMuseum = smooth(17, 14.5, Math.max(Math.abs(x) * 1.05, Math.abs(z + 2) * 1.1));
    h = h * (1 - inMuseum) + (FLOOR_Y - 0.05) * inMuseum;
    const dvl = Math.hypot(x + 31, z - 26);
    if (dvl < 17) h += (Math.max(1.1, Math.min(h, 2.2)) - h) * smooth(17, 11, dvl);
    return h;
}
/** Ground slope (rise over run) at (x, z). */
function slope(x, z) {
    const e = 1;
    return Math.hypot(islandH(x + e, z) - islandH(x - e, z), islandH(x, z + e) - islandH(x, z - e)) / (2 * e);
}
/** How much (0..1) a point belongs to a region, for colours and planting. */
function woods(x, z) { return Math.max(smooth(48, 22, Math.hypot(x + 90, z + 105)), smooth(34, 14, Math.hypot(x + 50, z + 105)) * 0.8, smooth(30, 12, Math.hypot(x - 2, z + 62)) * 0.55); }
function jungle(x, z) { return Math.max(smooth(42, 18, Math.hypot(x - 80, z + 62)), smooth(26, 10, Math.hypot(x - 96, z + 90)) * 0.8); }

// ------------------------------------------------------------------ terrain
export function terrainMesh(quality = 'high') {
    const seg = quality === 'low' ? 160 : quality === 'medium' ? 230 : 300;
    const geo = new THREE.PlaneGeometry(EXT * 2, EXT * 2, seg, seg);
    geo.rotateX(-PI / 2);
    geo.translate(0, 0, Z0);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color(), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const h = islandH(x, z);
        p.setY(i, h);
        const n = noise3(x * 0.3, 0, z * 0.3, 5), n2 = noise3(x * 0.05, 0, z * 0.05, 6);
        const s = slope(x, z);
        const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
        const dune = smooth(0.0, 0.18, blobF(BLOBS[2], x, z) + (n2 - 0.5) * 0.12);
        if (h < 0.15) c.set('#d6bd88').lerp(t.set('#a8925f'), Math.min(1, -h * 0.4));
        else if (h < 0.7) c.set('#ecd7a4').lerp(t.set('#e0c68c'), n);
        else {
            c.set('#86b24c').lerp(t.set('#6a9e3c'), n2).lerp(t.set('#9cc25a'), n * 0.35);
            const w = woods(x, z), j = jungle(x, z);
            if (w > 0) c.lerp(t.set('#4c7a34'), w * 0.8);
            if (j > 0) c.lerp(t.set('#4f9a36'), j * 0.7);
            if (dv < VOLCANO.r) {
                const k = smooth(VOLCANO.r * 0.9, VOLCANO.r * 0.45, dv);
                c.lerp(t.set('#6f6258'), k).lerp(t.set('#4a4040'), smooth(VOLCANO.r * 0.45, VOLCANO.crater * 1.2, dv) * 0.85);
                if (dv < VOLCANO.crater * 1.1) c.lerp(t.set('#8a3a24'), smooth(VOLCANO.crater * 1.1, VOLCANO.crater * 0.5, dv) * 0.7);
            }
            const dq = Math.hypot(x - QUARRY[0], z - QUARRY[1]);
            if (dq < 18) c.lerp(t.set('#d08a4e').lerp(c.clone(), n * 0.3), smooth(18, 10, dq));
            if (s > 0.9) c.lerp(t.set('#8f8a80').lerp(t.clone().set('#a39d92'), n), smooth(0.9, 1.6, s));
            if (dune > 0) c.lerp(t.set('#ead3a0').lerp(t.clone().set('#dcc28a'), n), dune * 0.92);
        }
        if (h > 0.2 && pathDist(x, z) < 1.5 && Math.hypot(x, z + 2) > 15) c.lerp(t.set('#c9a876'), 0.85 * smooth(1.5, 0.8, pathDist(x, z)));
        const [dr] = riverAt(x, z);
        if (dr < 4.5 && h > -0.5) c.lerp(t.set('#9a8a6a'), smooth(4.5, 2.5, dr) * 0.7);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true;
    return m;
}

/** The island's heights as a texture for the sea shader: shallows and foam follow the real coast. */
export function heightTexture(size = 256) {
    const data = new Float32Array(size * size);
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            const x = -EXT + ((i + 0.5) / size) * EXT * 2, z = Z0 - EXT + ((j + 0.5) / size) * EXT * 2;
            data[j * size + i] = islandH(x, z);
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

// ------------------------------------------------------------------ water
const NOISE_GLSL = /* glsl */`
    float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float nn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }`;

export function seaMesh(U, hTex) {
    const geo = new THREE.PlaneGeometry(900, 900, 220, 220);
    geo.rotateX(-PI / 2);
    geo.translate(0, 0, Z0);
    const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, uSun: { value: new THREE.Vector3(-30, 45, 25).normalize() }, uH: { value: hTex }, uExt: { value: new THREE.Vector3(EXT, Z0, 0) }, fogColor: { value: new THREE.Color(0xbfe0ec) }, fogNear: { value: 200 }, fogFar: { value: 520 } },
        transparent: true,
        fog: true,
        vertexShader: /* glsl */`
            uniform float uTime; uniform sampler2D uH; uniform vec3 uExt;
            varying vec3 vW; varying vec3 vN; varying float vFogDepth; varying float vLand;
            float wave(vec2 p, vec2 d, float f, float s) { return sin(dot(p, d) * f + uTime * s); }
            float landAt(vec2 p) { vec2 uv = vec2((p.x + uExt.x) / (2.0 * uExt.x), (p.y - uExt.y + uExt.x) / (2.0 * uExt.x)); return texture2D(uH, clamp(uv, 0.0, 1.0)).r; }
            void main() {
                vec3 p = position;
                float land = landAt(p.xz);
                vLand = land;
                float amp = clamp(-land * 0.06, 0.04, 0.22);
                float h = (wave(p.xz, vec2(0.8, 0.6), 0.16, 1.1) + wave(p.xz, vec2(-0.3, 0.95), 0.29, 1.7) * 0.5 + wave(p.xz, vec2(0.6, -0.8), 0.47, 2.3) * 0.25) * amp;
                p.y += h;
                float e = 0.5;
                float hx = (wave(p.xz + vec2(e, 0.0), vec2(0.8, 0.6), 0.16, 1.1) + wave(p.xz + vec2(e, 0.0), vec2(-0.3, 0.95), 0.29, 1.7) * 0.5) * amp;
                float hz = (wave(p.xz + vec2(0.0, e), vec2(0.8, 0.6), 0.16, 1.1) + wave(p.xz + vec2(0.0, e), vec2(-0.3, 0.95), 0.29, 1.7) * 0.5) * amp;
                vN = normalize(vec3(h - hx, e, h - hz));
                vec4 wp = modelMatrix * vec4(p, 1.0);
                vW = wp.xyz;
                vec4 mv = viewMatrix * wp;
                vFogDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uSun; uniform sampler2D uH; uniform vec3 uExt;
            uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
            varying vec3 vW; varying vec3 vN; varying float vFogDepth; varying float vLand;
            ${NOISE_GLSL}
            float landAt(vec2 p) { vec2 uv = vec2((p.x + uExt.x) / (2.0 * uExt.x), (p.y - uExt.y + uExt.x) / (2.0 * uExt.x)); return texture2D(uH, clamp(uv, 0.0, 1.0)).r; }
            void main() {
                float land = landAt(vW.xz);
                if (land > 0.35) discard;
                float depth = max(0.0, -land);
                vec3 deep = vec3(0.04, 0.24, 0.42), mid = vec3(0.05, 0.45, 0.62), lagoon = vec3(0.24, 0.8, 0.76);
                vec3 col = mix(lagoon, mid, smoothstep(0.5, 5.0, depth));
                col = mix(col, deep, smoothstep(6.0, 12.0, depth) * 0.8);
                vec3 V = normalize(cameraPosition - vW);
                float far = smoothstep(80.0, 400.0, vFogDepth);
                vec3 N = normalize(mix(vN, vec3(0.0, 1.0, 0.0), far * 0.7) + vec3(nn(vW.xz * 0.6 + uTime * 0.3) - 0.5, 0.0, nn(vW.zx * 0.6 - uTime * 0.25) - 0.5) * 0.12 * (1.0 - far));
                float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 4.0);
                col = mix(col, vec3(0.55, 0.78, 0.9), fres * 0.45);
                vec3 H = normalize(uSun + V);
                col += vec3(1.0, 0.95, 0.85) * pow(clamp(dot(N, H), 0.0, 1.0), 260.0) * 1.2;
                // foam where the sea meets the land, breathing with the waves
                float wv = sin(uTime * 1.3 + vW.x * 0.15 + vW.z * 0.1) * 0.12;
                float foam = smoothstep(-0.9, -0.05, land + wv + (nn(vW.xz * 0.7) - 0.5) * 0.35) * (0.55 + 0.45 * nn(vW.xz * 2.5 + uTime * 0.6));
                col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.8);
                col = mix(col, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
                gl_FragColor = vec4(col, mix(0.88, 0.95, smoothstep(0.0, 3.0, depth)));
            }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    return m;
}

/** Fresh water: the lake, the river ribbon and the waterfall, with flowing ripples. */
export function freshWater(U) {
    const g = new THREE.Group();
    const mat = (flow) => new THREE.ShaderMaterial({
        uniforms: { ...U, uFlow: { value: flow } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: /* glsl */`
            uniform float uTime; uniform float uFlow;
            varying vec2 vUv; varying vec3 vW;
            ${NOISE_GLSL}
            void main() {
                vec2 q = uFlow > 1.5 ? vec2(vUv.x * 6.0, vUv.y * 3.0 + uTime * 2.6) : uFlow > 0.5 ? vec2(vUv.x * 30.0 - uTime * 1.6, vUv.y * 3.0) : vW.xz * 0.35 + uTime * 0.08;
                float r = nn(q) * 0.6 + nn(q * 2.3 + 3.0) * 0.4;
                vec3 col = mix(vec3(0.16, 0.55, 0.68), vec3(0.42, 0.82, 0.86), r);
                if (uFlow > 1.5) col = mix(vec3(0.75, 0.92, 0.97), vec3(1.0), r);
                else col = mix(col, vec3(0.95, 1.0, 1.0), smoothstep(0.72, 0.9, r) * 0.6);
                float edge = uFlow > 0.5 && uFlow < 1.5 ? smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y) : 1.0;
                gl_FragColor = vec4(col, (uFlow > 1.5 ? 0.85 : 0.82) * edge);
            }`,
    });
    // the lake: an ellipse a little above its bowl
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat(0));
    lake.rotation.x = -PI / 2;
    lake.scale.set(LAKE.rx * 1.08, LAKE.rz * 1.08, 1);
    lake.position.set(LAKE.x, LAKE.y, LAKE.z);
    g.add(lake);
    // the river: two ribbons, one each side of the falls
    const strip = (pts) => {
        const pos = [], uv = [], idx = [];
        let along = 0;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            let dx = b[0] - a[0], dz = b[1] - a[1];
            const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
            const w = 2.2 + i * 0.25;
            if (i) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            pos.push(pts[i][0] - dz * w, pts[i][2] + 0.05, pts[i][1] + dx * w, pts[i][0] + dz * w, pts[i][2] + 0.05, pts[i][1] - dx * w);
            uv.push(along / 40, 0, along / 40, 1);
        }
        for (let i = 0; i + 1 < pts.length; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        return new THREE.Mesh(geo, mat(1));
    };
    g.add(strip(RIVER.slice(0, 3)), strip(RIVER.slice(3)));
    // the falls: a curtain from the upper river to the pool below
    const [a, b] = [RIVER[2], RIVER[3]];
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.4, a[2] - b[2] + 0.4, 1, 6), mat(2));
    fall.position.set((a[0] + b[0]) / 2, (a[2] + b[2]) / 2, (a[1] + b[1]) / 2);
    fall.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + PI / 2;
    fall.rotation.x = 0.12;
    g.add(fall);
    g.userData.fallAt = [b[0], b[2], b[1]];
    return g;
}

export function skyDome(U) {
    const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, uSun: { value: new THREE.Vector3(-30, 45, 25).normalize() } },
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uSun; varying vec3 vD;
            ${NOISE_GLSL}
            float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += nn(p) * a; p *= 2.03; a *= 0.5; } return s; }
            void main() {
                vec3 d = normalize(vD);
                float y = max(d.y, 0.0);
                vec3 zen = vec3(0.24, 0.52, 0.86), hor = vec3(0.75, 0.88, 0.95), warm = vec3(1.0, 0.85, 0.65);
                vec3 col = mix(hor, zen, pow(y, 0.55));
                float s = max(dot(d, normalize(uSun)), 0.0);
                col = mix(col, warm, pow(s, 6.0) * 0.5);
                col += vec3(1.0, 0.9, 0.7) * pow(s, 800.0) * 3.0;
                vec2 uv = d.xz / max(0.12, d.y) * 0.9 + vec2(uTime * 0.008, 0.0);
                float c = smoothstep(0.52, 0.8, fbm(uv * 0.8));
                col = mix(col, vec3(1.0, 0.99, 0.97), c * smoothstep(0.02, 0.25, d.y) * 0.85);
                if (d.y < 0.0) col = hor;
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
    m.renderOrder = -2;
    m.frustumCulled = false;
    return m;
}

// ------------------------------------------------------------------ plants, as instanced meshes
function pineGeos() {
    const k = new Kit();
    k.add(cyl(0.18, 0.28, 2.2, 6), '#6b4a2e', 'flat', { p: [0, 1.1, 0] });
    for (let i = 0; i < 4; i++) k.add(cone(1.9 - i * 0.38, 2.2 - i * 0.2, 8), (x, y) => shade('#2f6a3a', y * 0.05 + i * 0.05), 'flat', { p: [0, 2.2 + i * 1.25, 0] });
    return k.geometries();
}
function oakGeos() {
    const k = new Kit();
    k.add(cyl(0.22, 0.32, 2.6, 6), '#6b4a2e', 'flat', { p: [0, 1.3, 0] });
    for (let i = 0; i < 5; i++) k.add(bumpy(new THREE.IcosahedronGeometry(1.3 - (i % 2) * 0.25, 1), 0.15, 1.5, i + 3), (x, y) => shade('#4f8a36', y * 0.05 + (i % 3) * 0.05), 'flat', { p: [Math.cos(i * 1.3) * (i ? 1.0 : 0), 3.4 + (i % 2) * 0.6, Math.sin(i * 1.3) * (i ? 1.0 : 0)] });
    return k.geometries();
}
function palmGeos() {
    const k = new Kit();
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 0.8) * 1.2, t * 5, 0]); }
    k.add(tube(pts, [0.2, 0.16, 0.13], 6), (x, y) => (Math.sin(y * 9) > 0.2 ? '#8a6a46' : '#a07c52'), 'flat');
    const top = pts[pts.length - 1];
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        const leaf = [];
        for (let j = 0; j <= 5; j++) { const t = j / 5; leaf.push([top[0] + Math.cos(a) * t * 2.3, top[1] + Math.sin(t * PI * 0.8) * 0.6 - t * t * 1.2, top[2] + Math.sin(a) * t * 2.3]); }
        k.add(ribbon(leaf, [0.05, 0.5, 0.55, 0.42, 0.25, 0.02]), (x, y) => shade('#3f9a3a', (y - top[1]) * 0.25 + (i % 2) * 0.06), 'flat');
    }
    return k.geometries();
}
function bushGeos() {
    const k = new Kit();
    for (let i = 0; i < 3; i++) k.add(bumpy(new THREE.IcosahedronGeometry(0.55 - i * 0.08, 1), 0.08, 2, i + 20), shade('#4a8a36', i * 0.06), 'flat', { p: [Math.cos(i * 2.1) * 0.35, 0.4, Math.sin(i * 2.1) * 0.35] });
    return k.geometries();
}
function fernGeos() {
    const k = new Kit();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2, leaf = [];
        for (let j = 0; j <= 4; j++) { const t = j / 4; leaf.push([Math.cos(a) * t * 1.2, 0.1 + Math.sin(t * PI * 0.7) * 0.7 - t * t * 0.3, Math.sin(a) * t * 1.2]); }
        k.add(ribbon(leaf, [0.05, 0.4, 0.36, 0.2, 0.02]), '#3f8f34', 'flat');
    }
    return k.geometries();
}
function rockGeos() {
    const k = new Kit();
    k.add(bumpy(new THREE.IcosahedronGeometry(0.8, 1), 0.18, 1.6, 31), (x, y) => (y > 0.3 ? '#9a958b' : '#7d786e'), 'flat', { s: [1.2, 0.8, 1] });
    return k.geometries();
}
function grassGeos() {
    const k = new Kit();
    for (let b = 0; b < 5; b++) k.add(cone(0.05, 0.6 + (b % 2) * 0.25, 3), shade('#7aa84a', b * 0.05), 'flat', { p: [(b - 2) * 0.09, 0.28, ((b * 7) % 3 - 1) * 0.07], r: [((b % 3) - 1) * 0.3, 0, ((b % 2) - 0.5) * 0.5] });
    return k.geometries();
}

/** Instanced copies of a multi-material model at the given transforms. */
function forest(geos, list, shadow = true) {
    const g = new THREE.Group();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (const { geo, mat } of geos) {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => {
            e.set(t.tilt || 0, t.ry, 0);
            q.setFromEuler(e);
            p.set(t.x, t.y, t.z);
            s.setScalar(t.s);
            m.compose(p, q, s);
            im.setMatrixAt(i, m);
        });
        im.castShadow = shadow;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        g.add(im);
    }
    return g;
}

/** Keep plants off the museum, paths, water, village, dig sites and landmarks. */
function clear(x, z) {
    if (Math.abs(x) < 18 && z > -19 && z < 16) return false;
    if (pathDist(x, z) < 2.6) return false;
    if (riverAt(x, z)[0] < 4.5) return false;
    if (Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.25) return false;
    if (Math.hypot(x + 31, z - 26) < 15) return false;
    for (const s of DIG_SITES) if (Math.hypot(x - s.x, z - s.z) < 9) return false;
    if (Math.hypot(x - WINDMILL[0], z - WINDMILL[1]) < 6) return false;
    if (Math.hypot(x - RUINS[0], z - RUINS[1]) < 10) return false;
    if (Math.hypot(x - LIGHTHOUSE[0], z - LIGHTHOUSE[1]) < 6) return false;
    if (Math.hypot(x - QUARRY[0], z - QUARRY[1]) < 16) return false;
    return true;
}

export function plants(quality = 'high') {
    const rng = makeRng(8088);
    const k = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
    const lists = { pine: [], oak: [], palm: [], bush: [], fern: [], rock: [], grass: [] };
    for (let i = 0; i < 26000 * k; i++) {
        const x = (rng() * 2 - 1) * EXT * 0.95, z = Z0 + (rng() * 2 - 1) * EXT * 0.95;
        const h = islandH(x, z);
        if (h < 0.5 || !clear(x, z)) continue;
        const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
        const s = slope(x, z);
        const w = woods(x, z), j = jungle(x, z);
        const r = rng();
        const t = { x, z, y: h - 0.1, ry: rng() * PI * 2, s: 0.8 + rng() * 0.6 };
        if (dv < VOLCANO.r * 0.55) { if (r < 0.012 && s > 0.4) lists.rock.push({ ...t, s: 0.8 + rng() * 2 }); continue; }
        if (s > 1.1) { if (r < 0.03) lists.rock.push({ ...t, s: 0.6 + rng() * 1.6 }); continue; }
        if (w > 0.3 && r < 0.11 * w) { (rng() < 0.75 ? lists.pine : lists.oak).push(t); continue; }
        if (j > 0.3 && r < 0.05 * j) { lists.palm.push({ ...t, tilt: (rng() - 0.5) * 0.25 }); continue; }
        if (j > 0.3 && r < 0.12 * j) { lists.fern.push(t); continue; }
        if (dv < VOLCANO.r * 0.95 && r < 0.012) { lists.pine.push(t); continue; }
        if (blobF(BLOBS[2], x, z) > 0.04) { if (r < 0.06) lists.grass.push({ ...t, s: 0.9 + rng() * 0.8 }); else if (r < 0.064) lists.palm.push({ ...t, tilt: (rng() - 0.5) * 0.3 }); continue; }
        if (h < 2.2 && r < 0.006) { lists.palm.push({ ...t, tilt: (rng() - 0.5) * 0.3 }); continue; }
        if (r < 0.005) { lists.oak.push(t); continue; }
        if (r < 0.012) { lists.bush.push(t); continue; }
        if (r < 0.02) { lists.grass.push(t); continue; }
        if (r < 0.022) lists.rock.push({ ...t, s: 0.4 + rng() * 0.8 });
    }
    const g = new THREE.Group();
    g.add(forest(pineGeos(), lists.pine), forest(oakGeos(), lists.oak), forest(palmGeos(), lists.palm), forest(bushGeos(), lists.bush), forest(fernGeos(), lists.fern, false), forest(rockGeos(), lists.rock), forest(grassGeos(), lists.grass, false));
    g.userData.counts = Object.fromEntries(Object.entries(lists).map(([k2, v]) => [k2, v.length]));
    return g;
}

// ------------------------------------------------------------------ landmarks
const placeOn = (g, o, x, z, ry = 0, s = 1, dy = 0) => { o.position.set(x, islandH(x, z) + dy, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };

function cottage(seed) {
    const k = new Kit();
    const walls = ['#f2e6cf', '#e8d0b0', '#dfe8e6', '#f2dcd0', '#e6e0f0'][seed % 5];
    const roof = ['#c2503a', '#3a6ea8', '#4f8a5a', '#8a5a3a', '#c28a3a'][seed % 5];
    k.add(box(3.2, 2.4, 2.6), walls, 'flat', { p: [0, 1.2, 0] });
    k.add(new THREE.ConeGeometry(2.6, 1.8, 4), roof, 'flat', { p: [0, 3.3, 0], r: [0, PI / 4, 0], s: [1.25, 1, 1.05] });
    k.add(box(0.8, 1.4, 0.1), '#7a4a2a', 'flat', { p: [0, 0.7, 1.31] });
    for (const x of [-1, 1]) k.add(box(0.6, 0.6, 0.08), '#bfe6ff', 'glass', { p: [x, 1.5, 1.31] });
    k.add(box(0.5, 1.2, 0.5), '#b8ad98', 'flat', { p: [0.9, 3.6, -0.4] });
    return k.build();
}
function boat(c = '#e2503a') {
    const k = new Kit();
    k.add(new THREE.SphereGeometry(0.9, 12, 8, 0, PI * 2, PI / 2, PI / 2), c, 'flat', { s: [0.8, 0.5, 2] });
    k.add(cyl(0.04, 0.04, 2.6, 5), '#7a5a3a', 'flat', { p: [0, 1.2, 0] });
    k.add(new THREE.ConeGeometry(0.9, 1.9, 3, 1, false), '#f6f2ea', 'fur', { p: [0, 1.6, 0.3], s: [0.05, 1, 1] });
    return k.build();
}
function ruins() {
    const k = new Kit();
    const stone = (x, y, z) => shade('#d8ccb0', noise3(x * 2, y * 2, z * 2, 3) * 0.2 - 0.1);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2, x = Math.cos(a) * 7, z = Math.sin(a) * 7;
        const h = [4.2, 2.1, 4.2, 1.2, 3.4, 4.2, 0.8, 2.8][i];
        k.add(cyl(0.45, 0.5, h, 10), stone, 'flat', { p: [x, h / 2, z] });
        if (h > 4) k.add(box(1.2, 0.35, 1.2), stone, 'flat', { p: [x, h + 0.18, z] });
    }
    k.add(box(4.6, 0.5, 1.2), stone, 'flat', { p: [5.2, 4.6, 3.2], r: [0, PI / 4 + 0.2, 0] });
    for (let i = 0; i < 6; i++) k.add(box(1.4, 0.7, 1.0), stone, 'flat', { p: [Math.cos(i * 2.2) * 4, 0.35, Math.sin(i * 2.2) * 4], r: [0, i, 0.2 * (i % 2)] });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; k.add(box(1.6, 0.25, 1.2), shade('#c8bfa8', (i % 3) * 0.05 - 0.05), 'flat', { p: [Math.cos(a) * 5.4, 0.1, Math.sin(a) * 5.4], r: [0, -a, 0] }); }
    for (let s = 0; s < 3; s++) k.add(box(4, 0.3, 1), stone, 'flat', { p: [0, 0.15 - s * 0.3, 8.2 + s], r: [0, 0, 0] });
    return k.build();
}
function windmill() {
    const g = new THREE.Group();
    const k = new Kit();
    k.add(new THREE.CylinderGeometry(1.6, 2.4, 7, 10), '#f2ead8', 'flat', { p: [0, 3.5, 0] });
    k.add(new THREE.ConeGeometry(2.2, 2.2, 10), '#a0402a', 'flat', { p: [0, 8.1, 0] });
    k.add(box(1, 1.6, 0.1), '#6a4a2a', 'flat', { p: [0, 0.8, 2.3] });
    g.add(k.build());
    const blades = new Kit();
    for (let i = 0; i < 4; i++) {
        blades.add(box(0.25, 5.2, 0.1), '#8a6a4a', 'flat', { p: [0, 2.6, 0], r: [0, 0, 0] });
        blades.add(box(1.0, 4.2, 0.04), '#f6f2ea', 'fur', { p: [0.6, 3.0, 0.04] });
        const holder = blades.build();
        blades.parts.clear();
        holder.rotation.z = (i * PI) / 2;
        g.userData.blades = g.userData.blades || new THREE.Group();
        g.userData.blades.add(holder);
    }
    g.userData.blades.position.set(0, 7, 2.1);
    g.add(g.userData.blades);
    return g;
}
function quarry() {
    const k = new Kit();
    for (let i = 0; i < 10; i++) k.add(box(1.4 + (i % 3) * 0.4, 1.0, 1.2), shade('#d08a4e', (i % 4) * 0.05 - 0.05), 'flat', { p: [Math.cos(i * 1.9) * 8, 0.5 + (i % 2) * 1.0, Math.sin(i * 1.9) * 8], r: [0, i * 0.7, 0] });
    for (let i = 0; i < 12; i++) k.add(box(0.12, 0.08, 1.6), '#6a4a2a', 'flat', { p: [-6 + i * 1.0, 0.05, 2], r: [0, PI / 2, 0] });
    for (const z of [1.6, 2.4]) k.add(box(12, 0.06, 0.08), '#9aa4aa', 'metal', { p: [0, 0.12, z] });
    k.add(box(1.4, 0.9, 1.0), '#7a5a3a', 'flat', { p: [-2, 0.7, 2] });
    k.add(cyl(0.12, 0.12, 6, 6), '#7a5a3a', 'flat', { p: [5, 3, -4] });
    k.add(box(4, 0.15, 0.15), '#7a5a3a', 'flat', { p: [6.8, 5.8, -4] });
    return k.build();
}
function pier() {
    const k = new Kit();
    for (let i = 0; i < 8; i++) k.add(box(1.8, 0.12, 0.8), shade('#b08a5a', (i % 2) * 0.05), 'flat', { p: [0, 0.65, i * 0.85] });
    for (let i = 0; i < 8; i += 3) for (const x of [-0.85, 0.85]) k.add(cyl(0.1, 0.12, 2, 6), '#7a5a3a', 'flat', { p: [x, -0.1, i * 0.85] });
    return k.build();
}

/** Wildflowers in the meadow round the windmill: little clumps, no beds. */
function wildflowers() {
    const k = new Kit();
    const rng = makeRng(77);
    const cols = ['#ff6b8a', '#ffd93b', '#c77dff', '#ffffff', '#ff8a3a', '#7ab8ff'];
    for (let i = 0; i < 160; i++) {
        const a = rng() * PI * 2, d = 6 + rng() * 22;
        const x = WINDMILL[0] + Math.cos(a) * d, z = WINDMILL[1] + Math.sin(a) * d * 0.8;
        if (pathDist(x, z) < 2) continue;
        const y = islandH(x, z);
        k.add(cyl(0.02, 0.02, 0.35, 3), '#3f8a3a', 'flat', { p: [x, y + 0.17, z] });
        k.add(sphere(0.12, 5, 4), cols[i % cols.length], 'fur', { p: [x, y + 0.38, z] });
    }
    return k.build({ shadow: false });
}

/** The landmarks: village, boats, ruins, windmill, quarry, crater, stepping stones. */
export function landmarks() {
    const g = new THREE.Group();
    VILLAGE.forEach(([x, z], i) => placeOn(g, cottage(i), x, z, Math.atan2(-x - 0, 36 - z) + PI, 0.9));
    const p1 = placeOn(g, pier(), -16, 30, -0.9);
    p1.position.y = 0;
    for (let i = 0; i < 3; i++) { const b = boat(['#e2503a', '#3a8ac4', '#f2c230'][i]); b.position.set(-9 + i * 3.6, 0.15, 44 + (i % 2) * 3); b.rotation.y = 0.5 * i; b.userData.bob = i; g.add(b); }
    placeOn(g, ruins(), RUINS[0], RUINS[1], 0.4);
    const wm = placeOn(g, windmill(), WINDMILL[0], WINDMILL[1], -0.6);
    g.userData.windmill = wm;
    placeOn(g, quarry(), QUARRY[0], QUARRY[1], 0.3);
    for (let i = 0; i < 6; i++) { const r = P.rock(1.2 + (i % 3) * 0.6, i + 40); placeOn(g, r, -112 + i * 3, 10 + (i % 2) * 6, i, 1, -0.4); }
    g.add(wildflowers());
    return g;
}

/** The crater's lava: a glowing, slowly churning disc that blooms. */
export function lava(U) {
    const mat = new THREE.ShaderMaterial({
        uniforms: { ...U },
        toneMapped: false,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
            uniform float uTime; varying vec2 vP;
            ${NOISE_GLSL}
            void main() {
                float n = nn(vP * 0.8 + uTime * 0.05) * 0.6 + nn(vP * 2.1 - uTime * 0.08) * 0.4;
                vec3 col = mix(vec3(0.5, 0.06, 0.02), vec3(1.6, 0.55, 0.12), smoothstep(0.35, 0.75, n));
                col += vec3(1.2, 0.8, 0.3) * smoothstep(0.78, 0.92, n);
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(VOLCANO.crater * 0.62, 32), mat);
    m.rotation.x = -PI / 2;
    let floor = 1e9;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; floor = Math.min(floor, islandH(VOLCANO.x + Math.cos(a) * 3, VOLCANO.z + Math.sin(a) * 3)); }
    m.position.set(VOLCANO.x, Math.max(floor, islandH(VOLCANO.x, VOLCANO.z)) + 0.6, VOLCANO.z);
    return m;
}

/** Smoke from the crater: soft puffs that rise, drift and fade, recycled. */
export class Smoke {
    constructor(scene, top) {
        this.puffs = [];
        this.top = top;
        const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe8e2da, transparent: true, opacity: 0.0, depthWrite: false });
        for (let i = 0; i < 14; i++) {
            const s = new THREE.Sprite(mat.clone());
            s.userData.age = (i / 14) * 9;
            scene.add(s);
            this.puffs.push(s);
        }
    }
    update(dt) {
        for (const s of this.puffs) {
            s.userData.age += dt;
            if (s.userData.age > 9) s.userData.age -= 9;
            const t = s.userData.age / 9;
            s.position.set(VOLCANO.x + t * 14 + Math.sin(t * 6 + s.id) * 1.5, this.top + t * 30, VOLCANO.z + t * 4);
            s.scale.setScalar(5 + t * 16);
            s.material.opacity = Math.sin(t * PI) * 0.42;
        }
    }
}

export { cottage, ruins, windmill };
