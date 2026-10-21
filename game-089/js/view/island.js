// Emberwyld Isle in 3D: terrain, sea, sky, the board's forty tiles, every landmark and the
// scattered scenery of the four regions, and Mount Ember with Pyrrhax asleep in its crater.
//
// The board is a square ring: space 0 (Hearthstone) is the front-right corner, Meadowvale runs
// along the front (+z, nearest the default camera), Whisperwood up the left (−x), Glimmer Coast
// along the back (−z, beside the open sea) and Frostfang Peaks down the right (+x).

import * as THREE from 'three';
import { SPACES } from '../sim/board.js';
import { DEEDS } from '../sim/board.js';
import { REGIONS } from '../sim/data.js';
import { hash3 } from '../rng.js';
import {
    part, merge, toonMesh, toonMat, toonInstanced, mat4, glowMat, shade, sph, cyl, cone, box, tor, gradientMap,
} from './toon.js';
import * as P from './props.js';
import { buildDragon, poseDragon } from './monsters.js';

const PI = Math.PI;
export const TILE = 4.2;
export const HALF = TILE * 5;              // corner centres sit at (±HALF, ±HALF)
export const GROUND = 0.9;                  // land height round the ring
export const TILE_TOP = GROUND + 0.5;      // where tokens stand

// ================================================================== layout

/** Centre of space i on the ground plane. */
export function tileXZ(i) {
    const s = Math.floor(i / 10), k = i % 10;
    switch (s) {
        case 0: return [HALF - k * TILE, HALF];
        case 1: return [-HALF, HALF - k * TILE];
        case 2: return [-HALF + k * TILE, -HALF];
        default: return [HALF, -HALF + k * TILE];
    }
}

/** Unit vector pointing off the board (away from the volcano) at space i. */
export function outward(i) {
    if (i % 10 === 0) { const [x, z] = tileXZ(i); const l = Math.hypot(x, z); return [x / l, z / l]; }
    return [[0, 1], [-1, 0], [0, -1], [1, 0]][Math.floor(i / 10)];
}

/** Direction of travel at space i (toward i + 1). */
export function along(i) {
    const [x0, z0] = tileXZ(i), [x1, z1] = tileXZ((i + 1) % 40);
    const l = Math.hypot(x1 - x0, z1 - z0) || 1;
    return [(x1 - x0) / l, (z1 - z0) / l];
}

export function tileTop(i) {
    const [x, z] = tileXZ(i);
    return new THREE.Vector3(x, TILE_TOP, z);
}

// ================================================================== terrain

function vnoise(x, z, seed = 1) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash3(xi, zi, seed), b = hash3(xi + 1, zi, seed), c = hash3(xi, zi + 1, seed), d = hash3(xi + 1, zi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, seed = 1) => vnoise(x, z, seed) * 0.6 + vnoise(x * 2.1, z * 2.1, seed + 7) * 0.3 + vnoise(x * 4.3, z * 4.3, seed + 13) * 0.1;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Signed distance to the island's rounded-square coastline (negative inside). */
function coastDist(x, z) {
    // the island is wider on the Frostfang side, to make room for its mountains
    const b = 33, r = 10, bx = x > 0 ? 40 : b;
    const qx = Math.abs(x) - bx + r, qz = Math.abs(z) - b + r;
    const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
    // a wobbly shore
    return out + (vnoise(x * 0.12, z * 0.12, 5) - 0.5) * 4;
}

/** How much each region owns a point: { meadow, woods, coast, frost }, summing to 1. */
export function regionWeights(x, z) {
    const a = Math.atan2(z, x);
    const centres = { frost: 0, meadow: PI / 2, woods: PI, coast: -PI / 2 };
    const w = {};
    let sum = 0;
    for (const [k, c] of Object.entries(centres)) {
        let d = Math.abs(a - c); if (d > PI) d = 2 * PI - d;
        const v = Math.pow(Math.max(0, Math.cos(Math.min(d, PI / 2))), 6) + 1e-4;
        w[k] = v; sum += v;
    }
    for (const k in w) w[k] /= sum;
    return w;
}

const PEAKS = [[33, -16, 10, 6], [34.5, -3, 13, 7], [33, 11, 10.5, 6], [38.5, 5, 9, 5], [38.5, -10, 9.5, 5.5], [36.5, 20, 6.5, 5], [36, -24, 7, 5]];

export function heightAt(x, z) {
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    const r = Math.hypot(x, z);
    const w = regionWeights(x, z);
    const sd = coastDist(x, z);
    let h = GROUND + (fbm(x * 0.09, z * 0.09, 3) - 0.45) * (1.6 + w.woods * 1.6 - w.coast * 0.9);
    // frost peaks outside the ring
    if (w.frost > 0.05) for (const [px, pz, ph, pr] of PEAKS) {
        const d = Math.hypot(x - px, z - pz);
        if (d < pr) h += ph * Math.pow(1 - d / pr, 1.25) * (0.75 + fbm(x * 0.4, z * 0.4, 9) * 0.5) * Math.min(1, w.frost * 2.5);
    }
    // the volcano
    // ridged slopes: deep gullies run down from the rim
    const ang = Math.atan2(z, x);
    const ridge = 1 + 0.12 * Math.sin(ang * 9 + Math.sin(ang * 3) * 1.5) * Math.min(1, r / 6);
    const vol = 17 * Math.pow(Math.max(0, 1 - r / 15.5), 1.25) * ridge;
    const crater = r < 4 ? (4 - r) * 2.4 : 0;
    h = Math.max(h, GROUND + vol - crater + (vol > 0.5 ? (fbm(x * 0.5, z * 0.5, 4) - 0.5) * 0.6 : 0));
    // the board road is flat
    const band = Math.abs(cheb - HALF);
    const flat = 1 - smooth(2.6, 4.2, band);
    h = h + (GROUND - 0.05 - h) * flat;
    // beach and sea floor
    if (sd > -6) {
        const beach = smooth(-6, -0.5, sd);
        h = h + (0.35 - h) * beach;
        if (sd > -0.5) h = 0.35 - smooth(-0.5, 9, sd) * 5.5;
    }
    return h;
}

const COL = {
    meadow: new THREE.Color('#86d65a'), meadow2: new THREE.Color('#a8e46a'),
    woods: new THREE.Color('#3f9a52'), woods2: new THREE.Color('#5ab45a'),
    coast: new THREE.Color('#9ed86a'), coast2: new THREE.Color('#c0e47a'),
    frost: new THREE.Color('#eef6ff'), frost2: new THREE.Color('#d4e6f8'),
    sand: new THREE.Color('#f4dca0'), wetsand: new THREE.Color('#d8bc80'), road: new THREE.Color('#d8c08a'),
    rock: new THREE.Color('#9a6a58'), rock2: new THREE.Color('#6a4440'), ash: new THREE.Color('#a8907a'), snow: new THREE.Color('#ffffff'),
};

function groundColor(x, z, h, out) {
    const w = regionWeights(x, z);
    const n = fbm(x * 0.25, z * 0.25, 11);
    out.setRGB(0, 0, 0);
    const tmp = new THREE.Color();
    for (const k of ['meadow', 'woods', 'coast', 'frost']) {
        tmp.copy(COL[k]).lerp(COL[k + '2'], n);
        out.r += tmp.r * w[k]; out.g += tmp.g * w[k]; out.b += tmp.b * w[k];
    }
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    const band = Math.abs(cheb - HALF);
    if (band < 2.7) out.lerp(w.frost > 0.5 ? COL.frost2 : COL.road, 0.85 * (1 - smooth(2.2, 2.7, band)));
    const r = Math.hypot(x, z);
    if (r < 15.5) { out.lerp(COL.rock, smooth(15.5, 11, r)); out.lerp(COL.rock2, smooth(7, 12, h) * 0.8); }
    else if (r < 18) out.lerp(COL.ash, smooth(18, 15, r) * 0.6);
    if (h > 4.5 && r > 15) out.lerp(COL.snow, smooth(4.5, 6, h));
    const sd = coastDist(x, z);
    if (sd > -5.5) out.lerp(COL.sand, smooth(-5.5, -3, sd));
    if (h < 0.1) out.lerp(COL.wetsand, smooth(0.1, -1, h));
    return out;
}

// ================================================================== the class

export class Island {
    constructor(scene) {
        this.scene = scene;
        this.t = 0;
        this.spin = [];
        this.bob = [];
        this.flames = [];
        this.flags = [];
        this.smokeSources = [];
        this.steamSources = [];
        this.deedSlots = {};
        this.tiles = [];
        this.exclude = [];
        const root = this.root = new THREE.Group();
        scene.add(root);
        this.buildSky();
        this.buildLights();
        this.buildTerrain();
        this.buildSea();
        this.buildTiles();
        this.buildLandmarks();
        this.buildScenery();
        this.buildVolcano();
    }

    // ------------------------------------------------------------------ sky and light
    buildSky() {
        const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color('#2f8cf0') }, uMid: { value: new THREE.Color('#8ed0ff') }, uLow: { value: new THREE.Color('#d8f2ff') }, uSun: { value: new THREE.Vector3(0.5, 0.55, 0.65).normalize() }, uSunCol: { value: new THREE.Color('#fff4c8') } },
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `uniform vec3 uTop, uMid, uLow, uSunCol; uniform vec3 uSun; varying vec3 vDir;
                void main(){
                    float y = clamp(vDir.y, -1.0, 1.0);
                    vec3 c = y > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.75, y)) : mix(uLow, uMid, smoothstep(-0.05, 0.12, y));
                    float s = max(dot(normalize(vDir), uSun), 0.0);
                    c += uSunCol * (smoothstep(0.9975, 0.999, s) * 1.6 + pow(clamp(s, 0.0, 1.0), 48.0) * 0.35);
                    gl_FragColor = vec4(c, 1.0);
                }`,
        }));
        sky.renderOrder = -10;
        this.sky = sky;
        this.root.add(sky);
        // clouds drift round the island
        this.clouds = new THREE.Group();
        const cm = toonMat({ vertexColors: true, emissive: '#5a6a8a', emissiveIntensity: 0.25 });
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * PI * 2 + hash3(i, 3) * 0.3;
            const r = 75 + hash3(i, 4) * 60;
            const m = new THREE.Mesh(P.cloudGeo(i + 1), cm);
            m.position.set(Math.cos(a) * r, 26 + hash3(i, 5) * 22, Math.sin(a) * r);
            m.rotation.y = -a;
            m.scale.setScalar(1.6 + hash3(i, 6) * 1.6);
            this.clouds.add(m);
        }
        this.root.add(this.clouds);
        this.scene.fog = new THREE.Fog('#cdeeff', 110, 330);
    }

    buildLights() {
        this.hemi = new THREE.HemisphereLight('#d8eeff', '#6a8a5a', 1.25);
        this.scene.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight('#fff2d8', 2.1);
        sun.position.set(38, 60, 45);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera;
        sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 10; sc.far = 180;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.05;
        this.scene.add(sun, sun.target);
    }

    // ------------------------------------------------------------------ ground
    buildTerrain() {
        const N = 190, S = 110;
        const g = new THREE.PlaneGeometry(S, S, N, N);
        g.rotateX(-PI / 2);
        const pos = g.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const h = heightAt(x, z);
            pos.setY(i, h);
            groundColor(x, z, h, c);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(4) }));
        m.receiveShadow = true;
        this.root.add(m);
        this.terrain = m;
        // a height texture for the sea's shallows and foam
        const R = 160, data = new Uint8Array(R * R * 4);
        for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
            const x = (i / (R - 1)) * 140 - 70, z = (j / (R - 1)) * 140 - 70;
            const h = Math.max(-5.2, Math.min(4, heightAt(x, z)));
            const v = Math.round(((h + 8) / 12) * 255);
            const k = (j * R + i) * 4;
            data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
        }
        this.heightTex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat);
        this.heightTex.magFilter = this.heightTex.minFilter = THREE.LinearFilter;
        this.heightTex.needsUpdate = true;
    }

    buildSea() {
        const g = new THREE.PlaneGeometry(700, 700, 140, 140);
        g.rotateX(-PI / 2);
        const U = this.seaU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
            uTime: { value: 0 }, uHeight: { value: this.heightTex },
            uShallow: { value: new THREE.Color('#5ae8d8') }, uDeep: { value: new THREE.Color('#1a78d0') }, uFar: { value: new THREE.Color('#2a8ae0') },
        }]);
        const mat = new THREE.ShaderMaterial({
            uniforms: U, transparent: true, fog: true,
            vertexShader: /* glsl */`
                uniform float uTime;
                varying vec3 vW;
                #include <fog_pars_vertex>
                void main() {
                    vec3 p = position;
                    float d = length(p.xz);
                    float amp = smoothstep(30.0, 70.0, d) * 0.22 + 0.05;
                    p.y += (sin(p.x * 0.18 + uTime * 0.9) + cos(p.z * 0.21 + uTime * 0.7)) * amp;
                    vec4 wp = modelMatrix * vec4(p, 1.0);
                    vW = wp.xyz;
                    vec4 mvPosition = viewMatrix * wp;
                    gl_Position = projectionMatrix * mvPosition;
                    #include <fog_vertex>
                }`,
            fragmentShader: /* glsl */`
                uniform float uTime;
                uniform sampler2D uHeight;
                uniform vec3 uShallow, uDeep, uFar;
                varying vec3 vW;
                #include <fog_pars_fragment>
                float hsh(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
                void main() {
                    vec2 uv = (vW.xz + 70.0) / 140.0;
                    float h = -5.2;
                    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) h = texture2D(uHeight, uv).r * 12.0 - 8.0;
                    float depth = max(0.0, -h);
                    float k = smoothstep(0.0, 4.5, depth);
                    k = floor(k * 4.0 + 0.5) / 4.0;
                    vec3 col = mix(uShallow, uDeep, k);
                    col = mix(col, uFar, smoothstep(60.0, 160.0, length(vW.xz)));
                    // shore foam that breathes, and foam lines rolling in
                    float edge = 0.32 + 0.14 * sin(uTime * 1.6 + vW.x * 0.35 + vW.z * 0.27);
                    float foam = 1.0 - smoothstep(edge, edge + 0.08, depth);
                    float lines = step(0.88, fract(depth * 0.9 - uTime * 0.22)) * (1.0 - smoothstep(0.6, 2.6, depth));
                    col = mix(col, vec3(1.0), clamp(foam + lines * 0.7, 0.0, 1.0));
                    // toon wave lines in open water
                    float wl = sin(vW.x * 0.32 + sin(vW.z * 0.21 + uTime * 0.8) * 1.6 + uTime * 0.5) * sin(vW.z * 0.27 + uTime * 0.3);
                    col = mix(col, vec3(0.8, 0.95, 1.0), step(0.965, wl) * 0.3 * smoothstep(2.0, 5.0, depth));
                    float alpha = mix(0.6, 1.0, k) + foam * 0.35;
                    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
                    #include <fog_fragment>
                }`,
        });
        const sea = new THREE.Mesh(g, mat);
        sea.renderOrder = 1;
        this.root.add(sea);
        this.sea = sea;
    }

    // ------------------------------------------------------------------ the board
    buildTiles() {
        const TOP = { battle: '#ff7a64', deed: '#f4ecd8', town: '#ffd25a', dungeon: '#9a6ae0', treasure: '#ffb03a', fate: '#5ab0ff', start: '#ffe8a0', shrine: '#ffc0c8', fountain: '#b0f0ff', portal: '#d8b0ff' };
        const BASE = { meadow: '#b8875a', woods: '#8a6a4a', coast: '#e0c896', frost: '#9ab0d0', null: '#c8b8a0' };
        for (const s of SPACES) {
            const [x, z] = tileXZ(s.i);
            const corner = s.i % 10 === 0;
            const w = corner ? 4.5 : 3.75;
            const grp = new THREE.Group();
            grp.position.set(x, GROUND - 0.05, z);
            const [ox, oz] = outward(s.i);
            grp.rotation.y = Math.atan2(ox, oz);
            const base = BASE[s.region] ?? BASE.null;
            const top = s.type === 'deed' ? shade(REGIONS.find((r) => r.id === s.region).color, 0.45) : TOP[s.type];
            const geos = [
                part(box(w, 0.36, w), base, [0, 0.18, 0]),
                part(box(w - 0.3, 0.12, w - 0.3), top, [0, 0.42, 0]),
                part(box(w - 0.08, 0.06, w - 0.08), shade(base, 0.18), [0, 0.38, 0]),
            ];
            if (corner) for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; geos.push(part(cyl(0.22, 0.26, 0.5, 8), shade(base, -0.1), [Math.cos(a) * w * 0.48, 0.45, Math.sin(a) * w * 0.48])); geos.push(part(sph(0.18, 8, 6), '#ffd25a', [Math.cos(a) * w * 0.48, 0.78, Math.sin(a) * w * 0.48])); }
            geos.push(...emblem(s.type).map((g) => { g.translate(0, 0.48, corner ? -w * 0.18 : 0); return g; }));
            const m = toonMesh(geos, { outline: 0.03, receive: true });
            grp.add(m);
            // a glow ring the view lights up under the active space or a highlighted target
            const ring = new THREE.Mesh(new THREE.RingGeometry(w * 0.42, w * 0.5, 32), glowMat('#fff2a0', 1.3, { transparent: true, opacity: 0, depthWrite: false }));
            ring.rotation.x = -PI / 2;
            ring.position.y = 0.52;
            grp.add(ring);
            this.root.add(grp);
            this.tiles.push({ grp, ring, space: s, mesh: m });
        }
    }

    /** Light a tile's ring: k from 0 (off) to 1, colour optional. */
    highlight(i, k, color) {
        const t = this.tiles[i];
        if (!t) return;
        t.ring.material = glowMat(color ?? '#fff2a0', 1.3, { transparent: true, opacity: k, depthWrite: false });
    }

    place(obj, i, dist, sideways = 0, scale = 1, faceIn = true) {
        const [x, z] = tileXZ(i);
        const [ox, oz] = outward(i);
        const [ax, az] = along(i);
        const px = x + ox * dist + ax * sideways, pz = z + oz * dist + az * sideways;
        obj.position.set(px, heightAt(px, pz) - 0.05, pz);
        obj.rotation.y = faceIn ? Math.atan2(-ox, -oz) : obj.rotation.y;
        obj.scale.setScalar(scale);
        this.root.add(obj);
        this.exclude.push([px, pz, 3.6 * scale]);
        this.collect(obj);
        return obj;
    }

    collect(obj) {
        const u = obj.userData;
        if (u.spin) this.spin.push(...u.spin);
        if (u.bob) this.bob.push(...u.bob.map((o) => ({ o, y: o.position.y })));
        if (u.flames) this.flames.push(...u.flames);
        if (u.steam) for (const p of u.steam) this.steamSources.push(obj.localToWorld(p.clone()));
        if (u.fountain) this.fountainSrc = u.fountain;
    }

    buildLandmarks() {
        const DEED_MODEL = { orchard: P.orchard, windmill: P.windmill, grove: P.mushroomHouse, treehouse: P.treehouse, docks: P.docks, lighthouse: P.lighthouse, mine: P.mine, springs: P.lodge };
        for (const s of SPACES) {
            if (s.type === 'town') this.place(P.town(s.town), s.i, 5.6, 0, 1.25);
            if (s.type === 'dungeon') this.place(P.dungeon(s.dungeon), s.i, 5.4, 0, 1.15);
            if (s.type === 'deed') {
                const b = this.place(DEED_MODEL[s.deed](), s.i, 5.0, 0, s.deed === 'lighthouse' ? 0.9 : 1.0);
                const slot = { building: b, banner: null, stars: null, owner: null, level: -1, i: s.i };
                this.deedSlots[s.deed] = slot;
            }
        }
        // the corners
        const corner = (obj, i, d = 4.8, sc = 1.2) => this.place(obj, i, d, 0, sc);
        this.hearth = corner(P.hearthstone(), 0, 5.2, 1.25);
        corner(P.shrine(), 10, 4.8, 1.15);
        const f = corner(P.fountain(), 20, 4.6, 1.2);
        this.fountainWorld = f.localToWorld(new THREE.Vector3(0, 2.3, 0));
        this.portalObj = corner(P.portal(), 30, 4.8, 1.25);
        for (const fl of this.flames) fl.userData.base = fl.scale.clone();
    }

    /** Show who owns a deed: a banner in their colour and stars for its level. */
    setDeed(deed, ownerColor, level) {
        const slot = this.deedSlots[deed];
        if (!slot) return;
        if (slot.owner !== ownerColor) {
            if (slot.banner) { this.root.remove(slot.banner); this.flags = this.flags.filter((f) => f.grp !== slot.banner); slot.banner = null; }
            if (ownerColor) {
                const b = P.banner(ownerColor);
                const [x, z] = tileXZ(slot.i), [ox, oz] = outward(slot.i), [ax, az] = along(slot.i);
                const px = x + ox * 2.6 + ax * 1.5, pz = z + oz * 2.6 + az * 1.5;
                b.position.set(px, heightAt(px, pz), pz);
                b.rotation.y = Math.atan2(ax, az) + PI;
                this.root.add(b);
                slot.banner = b;
                this.flags.push({ grp: b, flag: b.userData.flag, base: b.userData.flagBase });
            }
            slot.owner = ownerColor;
        }
        if (slot.level !== level) {
            if (slot.stars) { slot.stars.parent?.remove(slot.stars); slot.stars = null; }
            if (ownerColor && level > 0 && slot.banner) {
                slot.stars = P.levelStars(level);
                slot.stars.position.set(0, 2.0, 0);
                slot.banner.add(slot.stars);
            }
            slot.level = level;
        }
    }

    // ------------------------------------------------------------------ scenery
    buildScenery() {
        const kinds = {
            tree: { geo: [1, 2, 3].map((k) => P.treeGeo('#5cc04a', '#8a5a34', k)), list: [] },
            darktree: { geo: [1, 2].map((k) => P.treeGeo('#2f8a4a', '#6a4a30', k + 5)), list: [] },
            apple: { geo: [P.appleTreeGeo(4)], list: [] },
            pine: { geo: [P.pineGeo('#2f7a5a', false, 1), P.pineGeo('#2a6a4a', false, 2)], list: [] },
            snowpine: { geo: [P.pineGeo('#2f6a5a', true, 3), P.pineGeo('#3a7a6a', true, 4)], list: [] },
            palm: { geo: [P.palmGeo(1), P.palmGeo(2)], list: [] },
            mushroom: { geo: [P.mushroomGeo('#ff5a6a', 1), P.mushroomGeo('#b07aff', 2), P.mushroomGeo('#ffa03a', 3)], list: [], emissive: '#3a1028' },
            bush: { geo: [P.bushGeo('#4aa840', '#ff6a9a', 1), P.bushGeo('#5ab84a', '#ffffff', 2), P.bushGeo('#3a9a3a', null, 3)], list: [] },
            flowers: { geo: [P.flowersGeo(undefined, 1), P.flowersGeo(['#ffd84a', '#ff9a3a', '#ffffff'], 2), P.flowersGeo(['#a07aff', '#ff6ad0', '#5ab0ff'], 3)], list: [], outline: 0.012 },
            grass: { geo: [P.grassGeo('#6ac84a', 1), P.grassGeo('#4aa848', 2)], list: [], outline: false },
            rock: { geo: [P.rockGeo('#a0a0ac', false, 1), P.rockGeo('#8a8a96', false, 2)], list: [] },
            darkrock: { geo: [P.rockGeo('#5a4a48', false, 3), P.rockGeo('#4a3a3a', false, 4)], list: [] },
            snowrock: { geo: [P.rockGeo('#9aa8b8', true, 5), P.rockGeo('#8a98a8', true, 6)], list: [] },
            crystal: { geo: [P.crystalGeo('#8ae0ff', 1), P.crystalGeo('#c8a0ff', 2)], list: [], emissive: '#1a4a6a' },
            hay: { geo: [P.hayGeo()], list: [] },
            sheep: { geo: [P.sheepGeo()], list: [] },
            shell: { geo: [P.shellGeo('#ffb0c8'), P.shellGeo('#fff0d0')], list: [], outline: 0.01 },
        };
        const pickFor = (reg, r, sd, u) => {
            if (r < 15.5) return u < 0.08 ? 'darkrock' : null;
            switch (reg) {
                case 'meadow': return u < 0.16 ? 'tree' : u < 0.2 ? 'apple' : u < 0.32 ? 'bush' : u < 0.58 ? 'flowers' : u < 0.8 ? 'grass' : u < 0.84 ? 'hay' : u < 0.88 ? 'sheep' : u < 0.92 ? 'rock' : null;
                case 'woods': return u < 0.26 ? 'darktree' : u < 0.4 ? 'pine' : u < 0.54 ? 'mushroom' : u < 0.66 ? 'bush' : u < 0.84 ? 'grass' : u < 0.9 ? 'flowers' : null;
                case 'coast': return sd > -6.5 ? (u < 0.28 ? 'palm' : u < 0.42 ? 'shell' : u < 0.52 ? 'rock' : null) : (u < 0.22 ? 'palm' : u < 0.35 ? 'bush' : u < 0.6 ? 'grass' : u < 0.75 ? 'flowers' : u < 0.82 ? 'rock' : null);
                case 'frost': return u < 0.42 ? 'snowpine' : u < 0.62 ? 'snowrock' : u < 0.74 ? 'crystal' : null;
            }
            return null;
        };
        let n = 0;
        for (let gz = -40; gz <= 40; gz += 1.5) for (let gx = -40; gx <= 47; gx += 1.5) {
            n++;
            const x = gx + (hash3(gx * 10, gz * 10, 1) - 0.5) * 1.4, z = gz + (hash3(gx * 10, gz * 10, 2) - 0.5) * 1.4;
            const h = heightAt(x, z);
            const sd = coastDist(x, z);
            if (sd > -1.5 || h < 0.3) continue;
            const cheb = Math.max(Math.abs(x), Math.abs(z));
            if (Math.abs(cheb - HALF) < 3.4) continue;
            if (this.exclude.some(([ex, ez, er]) => (x - ex) ** 2 + (z - ez) ** 2 < er * er)) continue;
            const r = Math.hypot(x, z);
            const inner = cheb < HALF;
            if (inner && hash3(gx, gz, 4) < 0.25) continue;      // keep the inside of the ring open
            if (h > 7 && r > 16) continue;                          // bare peaks
            const w = regionWeights(x, z);
            let reg = 'meadow', best = 0, acc = 0;
            const u0 = hash3(gx, gz, 5);
            for (const [k, v] of Object.entries(w)) { acc += v; if (u0 < acc && !best) { reg = k; best = 1; } }
            let kind = pickFor(reg, r, sd, hash3(gx, gz, 6));
            if (!kind) continue;
            // inside the ring the camera looks over this ground: only low things grow here
            if (inner && !['flowers', 'grass', 'shell', 'rock', 'darkrock', 'snowrock', 'crystal', 'hay', 'sheep'].includes(kind)) {
                if (reg === 'frost') continue;
                kind = hash3(gx, gz, 11) < 0.5 ? 'flowers' : 'grass';
            }
            const K = kinds[kind];
            const variant = Math.floor(hash3(gx, gz, 7) * K.geo.length);
            const sc = (kind === 'grass' || kind === 'flowers' ? 1.2 : 0.8) + hash3(gx, gz, 8) * 0.5;
            (K.list[variant] ||= []).push(mat4([x, h - 0.05, z], hash3(gx, gz, 9) * PI * 2, sc));
        }
        void n;
        for (const K of Object.values(kinds)) {
            K.geo.forEach((g, v) => {
                const list = K.list[v];
                if (!list?.length) return;
                const grp = toonInstanced(g, list, { outline: K.outline ?? 0.035, emissive: K.emissive, emissiveIntensity: 0.5 });
                this.root.add(grp);
            });
        }
    }

    // ------------------------------------------------------------------ Mount Ember
    buildVolcano() {
        const top = heightAt(2.4, 0) - 0.6;   // the lava lake's surface
        const lava = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28), glowMat('#ff6a1a', 1.7));
        lava.rotation.x = -PI / 2;
        lava.position.y = top;
        this.root.add(lava);
        this.lava = lava;
        const crust = toonMesh([...[0, 1, 2, 3, 4, 5].map((i) => part(P.rockGeo('#3a2a2a', false, i + 20), null, [Math.cos(i * 1.1) * 2.6, top - 0.1, Math.sin(i * 1.1) * 2.6], [0, i, 0], 0.6))], { outline: 0.03 });
        this.root.add(crust);
        // lava rivers down the slope
        this.rivers = [];
        for (const a of [0.6, 2.4, 4.0, 5.3]) {
            const pts = [];
            for (let k = 0; k <= 14; k++) {
                const r = 3.0 + k * 0.85;
                const aa = a + Math.sin(k * 0.6 + a) * 0.15;
                const x = Math.cos(aa) * r, z = Math.sin(aa) * r;
                pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.08, z));
            }
            const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.32, 6, false);
            const m = new THREE.Mesh(tube, glowMat('#ff7a2a', 1.5));
            m.scale.y = 1;
            this.root.add(m);
            this.rivers.push(m);
        }
        // Pyrrhax, asleep in the crater
        const d = this.dragon = buildDragon({ scale: 0.95 });
        d.root.position.set(0, top - 0.6, 0.2);
        d.root.rotation.y = 0.4;
        this.root.add(d.root);
        this.dragonMode = 'sleep';
        this.smokeSources.push(new THREE.Vector3(0, top + 1.5, 0));
        this.volcanoTop = top;
    }

    // ------------------------------------------------------------------ per frame
    update(dt, t) {
        this.t = t;
        this.seaU.uTime.value = t;
        this.clouds.rotation.y = t * 0.004;
        for (const s of this.spin) s.obj.rotation[s.axis] += dt * s.speed;
        for (const b of this.bob) b.o.position.y = b.y + Math.sin(t * 2 + b.y) * 0.12;
        for (const f of this.flames) { const k = 1 + Math.sin(t * 13 + f.position.x * 3) * 0.12; f.scale.set(f.userData.base.x * (2 - k), f.userData.base.y * k, f.userData.base.z * (2 - k)); }
        for (const fl of this.flags) {
            const p = fl.flag.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = fl.base[i * 3];
                p.setZ(i, Math.sin(t * 5 + x * 6) * 0.08 * x);
            }
            p.needsUpdate = true;
        }
        const lk = 1 + Math.sin(t * 2.3) * 0.08;
        this.lava.scale.set(lk, lk, 1);
        poseDragon(this.dragon, t, this.dragonMode, this.dragonMode === 'roar' ? 0.8 : 0);
    }

    /** As the laps go by the dragon stirs: 0 asleep … 1 awake. */
    setUnrest(k) {
        // k < 0: Pyrrhax is beaten, gone, and his lava has cooled to stone
        this.dragon.root.visible = k >= 0;
        if (k < 0) { this.lava.material = new THREE.MeshToonMaterial({ color: '#5a4a48', gradientMap: gradientMap(3) }); for (const r of this.rivers) r.material = this.lava.material; this.smokeSources.length = 0; return; }
        this.dragonMode = k >= 1 ? 'roar' : k > 0.6 ? 'idle' : 'sleep';
        this.lava.material = glowMat(k > 0.6 ? '#ff4a1a' : '#ff6a1a', 1.7 + k * 0.6);
    }
}

// ================================================================== tile emblems

function emblem(type) {
    const g = [];
    const flatBox = (w, d, color, x = 0, z = 0, ry = 0, h = 0.07) => part(box(w, h, d), color, [x, h / 2, z], [0, ry, 0]);
    switch (type) {
        case 'battle':
            for (const s of [-1, 1]) {
                g.push(flatBox(0.2, 1.7, '#f0f4ff', 0, 0, s * 0.7));
                g.push(flatBox(0.7, 0.14, '#ffd25a', Math.sin(s * 0.7) * 0.55 * -1, Math.cos(s * 0.7) * 0.55, s * 0.7 + PI / 2));
                g.push(part(sph(0.12, 8, 6), '#8a3a2a', [-Math.sin(s * 0.7) * 0.85, 0.07, Math.cos(s * 0.7) * 0.85], [0, 0, 0], [1, 0.5, 1]));
            }
            break;
        case 'treasure':
            g.push(part(box(1.2, 0.6, 0.8), '#b8743a', [0, 0.3, 0]), part(box(1.24, 0.12, 0.84), '#ffd25a', [0, 0.62, 0]), part(cyl(0.4, 0.4, 1.2, 10, 1, false, 0, PI), '#c8843a', [0, 0.62, 0], [0, 0, PI / 2]), part(box(0.18, 0.24, 0.06), '#ffd25a', [0, 0.55, 0.42]));
            break;
        case 'fate':
            g.push(flatBox(1.1, 1.5, '#ffffff', 0.15, 0.1, 0.25, 0.08), flatBox(1.1, 1.5, '#e8f0ff', -0.1, -0.05, -0.1, 0.06));
            g.push(part(new THREE.OctahedronGeometry(0.32, 0), '#5ab0ff', [0.12, 0.14, 0.1], [0, 0.25, 0], [1, 0.25, 1.3]));
            break;
        case 'deed':
            g.push(flatBox(1.3, 0.9, '#fff8e8', 0, 0.1), part(new THREE.CylinderGeometry(0.62, 0.62, 1.0, 3), '#e86a4a', [0, 0.12, -0.55], [PI / 2, 0, PI / 2], [1, 1, 0.12]));
            g.push(part(box(0.3, 0.1, 0.4), '#8a5a3a', [0, 0.06, 0.4]));
            break;
        case 'town':
            g.push(part(cyl(0.05, 0.05, 1.6, 6), '#7a5a3a', [0, 0.8, 0]), part(box(0.8, 0.5, 0.04), '#e83a3a', [0.42, 1.3, 0]), part(sph(0.08, 6, 5), '#ffd25a', [0, 1.62, 0]), part(cyl(0.4, 0.45, 0.12, 12), '#c8b8a0', [0, 0.06, 0]));
            break;
        case 'dungeon':
            g.push(part(box(1.4, 0.9, 0.3), '#7a7090', [0, 0.45, -0.2]), part(box(0.7, 0.7, 0.32), '#1a1222', [0, 0.35, -0.19]), part(tor(0.35, 0.1, 6, 12, PI), '#8a80a0', [0, 0.7, -0.03]));
            for (let i = 0; i < 4; i++) g.push(part(box(0.28, 0.3, 0.3), '#8a80a0', [-0.55 + i * 0.37, 1.05, -0.2]));
            break;
        case 'start': {
            g.push(flatBox(2.6, 0.6, '#ff5a3a', 0, -0.4, 0, 0.09));
            const ar = new THREE.ConeGeometry(0.6, 0.9, 3); ar.rotateX(PI / 2); ar.scale(1, 0.12, 1);
            g.push(part(ar, '#ff5a3a', [-1.6, 0.05, -0.4], [0, -PI / 2, 0]));
            break;
        }
        default: break;
    }
    return g;
}
