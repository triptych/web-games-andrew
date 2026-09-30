/**
 * roomView.js — builds and animates the 3D room for the current stage.
 *
 *   floor     one merged mesh of tile quads with world-space UVs, so the
 *             procedural floor texture runs seamlessly and pits are true holes
 *   pits      sunken liquid / chasm surfaces (one shader: water, lava, acid,
 *             ice water, chasm, void, open sky) with shaded side walls
 *   walls     textured masonry, a door arch with a portcullis that sinks when
 *             the room is cleared and a glowing portal behind it
 *   rocks     a biome-specific obstacle per ROCK tile (boulders, tombs, mesas,
 *             ice, mushrooms, ruins, obsidian, crystals, marble pillars, void shards)
 *   spikes    trap plates whose spikes rise and fall on the sim's clock
 *   props     trees, graves, cacti, pines, corals… scattered outside the walls
 *   ambience  a drifting particle field (fireflies, embers, snow, spores…)
 *   shrine    the angel / devil who offers deals
 */

import * as THREE from 'three';
import { scene, setAtmosphere, setRoomBounds } from './scene.js';
import { getBiome } from './biomes.js';
import { floorTexture, wallTexture, rockTexture, glowTexture, shade } from './textures.js';
import { makeRng } from '../sim/rng.js';
import { ROCK, PIT, SPIKE, cellAt } from '../sim/grid.js';
import { spikesUp } from '../sim/world.js';

let root = null;
let pitMat = null;
let door = null;
let spikeGroups = [];
let ambient = null;
let shrineObj = null;
let lastShrine = null;
let biome = null;
let torches = [];

const X = (c) => c - 5.5;             // left edge of a column in world x
const disposeList = [];

function track(o) { disposeList.push(o); return o; }

export function clearRoom() {
    if (root) scene.remove(root);
    for (const o of disposeList) o.dispose?.();
    disposeList.length = 0;
    root = null; door = null; spikeGroups = []; ambient = null; shrineObj = null; lastShrine = null; torches = [];
}

// ------------------------------------------------------------------ Pit shader

const PIT_STYLE = { water: 0, lava: 1, chasm: 2, acid: 3, void: 4, sky: 5, icewater: 6 };
const PIT_DEPTH = { water: 0.38, lava: 0.32, chasm: 3.2, acid: 0.35, void: 3.2, sky: 3.2, icewater: 0.36 };

function makePitMaterial(b) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uA: { value: new THREE.Color(b.pitA) },
            uB: { value: new THREE.Color(b.pitB) },
            uStyle: { value: PIT_STYLE[b.pit] ?? 0 },
            fogColor: { value: new THREE.Color(b.fog) },
        },
        vertexShader: /* glsl */`
            varying vec3 vW;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime, uStyle;
            uniform vec3 uA, uB;
            varying vec3 vW;
            float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
            }
            float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
            void main() {
                vec2 p = vW.xz;
                float t = uTime;
                vec3 col;
                if (uStyle < 0.5 || (uStyle > 5.5)) {            // water / ice water
                    float c = fbm(p * 1.3 + vec2(t * 0.15, t * 0.1));
                    float cau = pow(1.0 - abs(sin((fbm(p * 2.2 - t * 0.2) + c) * 9.0)), 6.0);
                    col = mix(uA, uB, c * 0.6) + uB * cau * 0.45;
                    if (uStyle > 5.5) col = mix(col, vec3(0.9, 0.97, 1.0), smoothstep(0.62, 0.7, fbm(p * 0.9)) * 0.55);
                } else if (uStyle < 1.5) {                       // lava
                    float f = fbm(p * 1.1 + vec2(t * 0.05, -t * 0.12));
                    float crust = smoothstep(0.45, 0.62, fbm(p * 2.0 - t * 0.04));
                    col = mix(uB * 1.25, uA * 0.95, f);
                    col = mix(col, vec3(0.12, 0.03, 0.02), crust * 0.85);
                } else if (uStyle < 2.5) {                       // chasm
                    float f = fbm(p * 0.8 + t * 0.03);
                    col = mix(uA, uB, f * 0.35);
                } else if (uStyle < 3.5) {                       // acid
                    float f = fbm(p * 1.6 + vec2(t * 0.2, t * 0.07));
                    float bub = step(0.965, h(floor(p * 5.0) + floor(t * 1.5)));
                    col = mix(uA, uB, f) + uB * bub * 0.8;
                } else if (uStyle < 4.5) {                       // void
                    float f = fbm(p * 0.7 + vec2(t * 0.05, 0.0));
                    float star = step(0.992, h(floor(p * 18.0)));
                    col = uA + uB * pow(f, 3.0) * 0.8 + vec3(star) * (0.5 + 0.5 * sin(t * 3.0 + p.x * 10.0));
                } else {                                         // open sky far below
                    float f = fbm(p * 0.5 + vec2(t * 0.06, 0.0));
                    col = mix(uA, uB, smoothstep(0.4, 0.75, f));
                }
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }
        `,
    });
}

// ------------------------------------------------------------------ Build

export function buildRoom(w) {
    clearRoom();
    const room = w.room, g = room.grid, rows = room.rows;
    biome = getBiome(room.biome);
    const b = biome;
    setAtmosphere(b);
    setRoomBounds(rows);
    root = new THREE.Group();
    scene.add(root);
    const rng = makeRng(room.seed ^ 0x51f00d);

    // --- Outer ground (everything outside the walls) ---
    const ftex = floorTexture(room.biome, b, 1 + (room.seed % 3));
    const outerTex = ftex.map.clone();
    outerTex.needsUpdate = true;
    track(outerTex);
    // Four slabs around the room (not one big plane: that would cover the sunken pits).
    const outerMat = track(new THREE.MeshStandardMaterial({ color: b.outer, map: outerTex, roughness: 1 }));
    outerMat.color.multiplyScalar(0.55);
    const slab = (x0, x1, z0, z1) => {
        const geo = track(new THREE.PlaneGeometry(x1 - x0, z0 - z1));
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const pa = geo.attributes.position, ua = geo.attributes.uv;
        for (let i = 0; i < pa.count; i++) ua.setXY(i, (pa.getX(i) + cx) / 4, (-pa.getY(i) + cz) / 4);   // world-space UVs
        const m = new THREE.Mesh(geo, outerMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((x0 + x1) / 2, -0.04, (z0 + z1) / 2);
        m.receiveShadow = true;
        root.add(m);
    };
    slab(-26, -5.5, 12, -rows - 30);
    slab(5.5, 26, 12, -rows - 30);
    slab(-5.5, 5.5, 12, 0);
    slab(-5.5, 5.5, -rows, -rows - 30);

    // --- Floor: one quad per walkable tile (plus the doorway), world-space UVs ---
    const quads = [];
    const pushQuad = (x0, z0, x1, z1) => quads.push([x0, z0, x1, z1]);
    for (let r = 0; r < rows; r++) for (let c = 0; c < 11; c++) if (g.cells[r * 11 + c] !== PIT) pushQuad(X(c), -r, X(c) + 1, -(r + 1));
    for (let r = rows; r < rows + 2; r++) for (let c = 4; c <= 6; c++) pushQuad(X(c), -r, X(c) + 1, -(r + 1));
    const pos = [], uv = [], nor = [], idx = [];
    quads.forEach(([x0, z0, x1, z1], i) => {
        pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) uv.push((x + 5.5) / 4, -z / 4);
        nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        const k = i * 4;
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const fg = track(new THREE.BufferGeometry());
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    fg.setIndex(idx);
    const floor = new THREE.Mesh(fg, track(new THREE.MeshStandardMaterial({ map: ftex.map, bumpMap: ftex.bump, bumpScale: 1.5, roughness: 0.92 })));
    floor.receiveShadow = true;
    root.add(floor);

    buildPits(g, rows, b);
    buildWalls(room, rows, b, rng);
    buildRocks(g, rows, b, rng);
    buildSpikes(g, rows);
    buildProps(rows, b, rng);
    buildAmbient(rows, b);
}

function buildPits(g, rows, b) {
    let any = false;
    for (const v of g.cells) if (v === PIT) { any = true; break; }
    if (!any) return;
    const depth = PIT_DEPTH[b.pit] ?? 0.4;
    pitMat = track(makePitMaterial(b));
    const surf = [], walls = [], wcol = [];
    const wallTop = new THREE.Color(b.wall.mortar).multiplyScalar(0.9), wallBot = new THREE.Color(b.pit === 'lava' ? 0xff5010 : 0x000000);
    const deep = depth > 1;
    for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < 11; c++) {
            if (g.cells[r * 11 + c] !== PIT) continue;
            const x0 = X(c), x1 = x0 + 1, z0 = -r, z1 = -(r + 1);
            surf.push(x0, -depth, z0, x1, -depth, z0, x1, -depth, z1, x0, -depth, z0, x1, -depth, z1, x0, -depth, z1);
            // Side walls where the neighbour is solid ground.
            const side = (nc, nr, ax, az, bx, bz) => {
                const t = cellAt(g, nc, nr);
                if (t === PIT) return;
                walls.push(ax, 0, az, bx, 0, bz, bx, -depth, bz, ax, 0, az, bx, -depth, bz, ax, -depth, az);
                for (const top of [1, 1, 0, 1, 0, 0]) { const col = top ? wallTop : wallBot; wcol.push(col.r, col.g, col.b); }
            };
            side(c, r - 1, x1, z0, x0, z0);
            side(c, r + 1, x0, z1, x1, z1);
            side(c - 1, r, x0, z0, x0, z1);
            side(c + 1, r, x1, z1, x1, z0);
        }
    }
    const sg = track(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.Float32BufferAttribute(surf, 3));
    // The lit gloss sheet below shares this geometry: without normals the lighting
    // normalises a zero vector, which some GPUs (D3D/ANGLE) turn into Inf specular
    // that bloom smears into a white-out over the whole screen.
    sg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(surf.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    root.add(new THREE.Mesh(sg, pitMat));
    if (walls.length) {
        const wg = track(new THREE.BufferGeometry());
        wg.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
        wg.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
        wg.computeVertexNormals();
        const wm = track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
        root.add(new THREE.Mesh(wg, wm));
    }
    if (!deep && b.pit !== 'lava') {
        // A faint glossy sheet on liquids catches the sun.
        const gloss = new THREE.Mesh(sg, track(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.2, depthWrite: false })));
        gloss.position.y = 0.005;
        root.add(gloss);
    }
}

function buildWalls(room, rows, b, rng) {
    const wt = wallTexture(room.biome, b);
    const sideMat = track(new THREE.MeshStandardMaterial({ map: wt.map, bumpMap: wt.bump, bumpScale: 2, roughness: 0.9 }));
    const topMat = track(new THREE.MeshStandardMaterial({ color: b.wall.top, map: wt.map, bumpMap: wt.bump, bumpScale: 1, roughness: 0.85 }));
    const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const H = 1.3, T = 1.0;
    const wall = (x, z, w, d) => {
        const geo = track(new THREE.BoxGeometry(w, H, d));
        // Scale UVs so bricks keep their size on long walls.
        const uvA = geo.attributes.uv;
        for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * Math.max(w, d) / 2, uvA.getY(i) * H / 2);
        const m = new THREE.Mesh(geo, mats);
        m.position.set(x, H / 2, z);
        m.castShadow = true; m.receiveShadow = true;
        root.add(m);
    };
    wall(-5.5 - T / 2, -rows / 2, T, rows + 2 * T);
    wall(5.5 + T / 2, -rows / 2, T, rows + 2 * T);
    wall(0, T / 2, 11, T);
    // Top wall with the door gap x ∈ [−1.5, 1.5].
    wall(-3.5, -rows - T / 2, 4, T);
    wall(3.5, -rows - T / 2, 4, T);
    // Doorway corridor walls.
    wall(-2, -rows - 1.5, 1, 1);
    wall(2, -rows - 1.5, 1, 1);

    // Door arch + portcullis + portal.
    door = new THREE.Group();
    door.position.set(0, 0, -rows);
    const archMat = track(new THREE.MeshStandardMaterial({ color: shade(b.wall.base, -0.1), roughness: 0.7 }));
    for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 2.3, 0.6)), archMat);
        p.position.set(sx * 1.75, 1.15, -0.3);
        p.castShadow = true;
        door.add(p);
    }
    const lintel = new THREE.Mesh(track(new THREE.BoxGeometry(4.1, 0.5, 0.7)), archMat);
    lintel.position.set(0, 2.3, -0.3);
    lintel.castShadow = true;
    door.add(lintel);
    const gem = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.22)), track(new THREE.MeshStandardMaterial({ color: 0x66ffcc, emissive: 0x33ffaa, emissiveIntensity: 0.3 })));
    gem.position.set(0, 2.3, 0.08);
    door.add(gem);
    door.userData.gem = gem;
    const bars = new THREE.Group();
    const barMat = track(new THREE.MeshStandardMaterial({ color: 0x3a3a44, metalness: 0.7, roughness: 0.4 }));
    const barGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6));
    for (let i = 0; i < 7; i++) {
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(-1.35 + i * 0.45, 1.05, -0.3);
        bar.castShadow = true;
        bars.add(bar);
    }
    const cross = new THREE.Mesh(track(new THREE.BoxGeometry(3, 0.1, 0.1)), barMat);
    cross.position.set(0, 1.5, -0.3);
    bars.add(cross);
    door.add(bars);
    door.userData.bars = bars;
    const portal = new THREE.Mesh(track(new THREE.PlaneGeometry(3, 2.2)), track(new THREE.MeshBasicMaterial({
        map: glowTexture(), color: 0x7affd8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    portal.position.set(0, 1.1, -1.4);
    door.add(portal);
    door.userData.portal = portal;
    root.add(door);

    // Torches on the side walls (glow sprites, no real lights: cheap on phones).
    const flameMat = track(new THREE.SpriteMaterial({ map: glowTexture(), color: b.pit === 'sky' ? 0xfff0c0 : 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (let z = 3; z < rows; z += 5) {
        for (const sx of [-1, 1]) {
            const t = new THREE.Group();
            const stick = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 5)), barMat);
            stick.rotation.z = sx * 0.5;
            stick.position.set(0, 0, 0);
            t.add(stick);
            const s = new THREE.Sprite(flameMat);
            s.scale.setScalar(0.8);
            s.position.y = 0.3;
            t.add(s);
            t.position.set(sx * 5.6, H + 0.2, -z);
            root.add(t);
            torches.push(s);
        }
    }
}

// ------------------------------------------------------------------ Rocks

function jitterGeo(geo, rng, amt) {
    const p = geo.attributes.position;
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        let d = seen.get(k);
        if (!d) { d = [rng.range(-amt, amt), rng.range(-amt, amt), rng.range(-amt, amt)]; seen.set(k, d); }
        p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
    geo.computeVertexNormals();
    return geo;
}

function rockMesh(style, b, rng) {
    const g = new THREE.Group();
    const std = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o }));
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(track(geo), mat);
        m.position.set(x, y, z);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        return m;
    };
    const tex = rockTexture(b.rockColor, 3 + rng.int(0, 2));
    switch (style) {
        case 'boulder': {
            const m = add(jitterGeo(new THREE.IcosahedronGeometry(0.52, 1), rng, 0.08), std(0xffffff, { map: tex }), 0, 0.42, 0);
            m.scale.set(1, rng.range(0.75, 1.05), 1);
            add(jitterGeo(new THREE.IcosahedronGeometry(0.3, 1), rng, 0.05), std(b.moss), rng.range(-0.1, 0.1), 0.78, rng.range(-0.1, 0.1)).scale.set(1.3, 0.45, 1.2);
            break;
        }
        case 'tomb': {
            if (rng.chance(0.5)) {
                add(new THREE.BoxGeometry(0.8, 0.9, 0.35), std(0xffffff, { map: tex }), 0, 0.45, 0);
                add(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12, 1, false, 0, Math.PI), std(0xffffff, { map: tex }), 0, 0.9, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2);
                add(new THREE.BoxGeometry(0.9, 0.12, 0.6), std(b.rockAlt), 0, 0.06, 0.1);
            } else {
                add(new THREE.BoxGeometry(0.9, 0.55, 0.9), std(0xffffff, { map: tex }), 0, 0.28, 0);
                add(new THREE.BoxGeometry(0.95, 0.12, 0.95), std(b.rockAlt), 0, 0.6, 0);
                add(new THREE.BoxGeometry(0.1, 0.05, 0.5), std(0xd8d0b0), 0, 0.68, 0);
                add(new THREE.BoxGeometry(0.35, 0.05, 0.1), std(0xd8d0b0), 0, 0.68, -0.1);
            }
            break;
        }
        case 'mesa': {
            let y = 0;
            for (let i = 0; i < 3; i++) {
                const h = rng.range(0.25, 0.4), r = 0.5 - i * 0.07;
                add(jitterGeo(new THREE.CylinderGeometry(r * 0.9, r, h, 7), rng, 0.03), std(i % 2 ? b.rockAlt : b.rockColor), 0, y + h / 2, 0);
                y += h;
            }
            break;
        }
        case 'ice': {
            const mat = std(b.rockColor, { transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1, emissive: b.rockAlt, emissiveIntensity: 0.15 });
            for (let i = 0; i < 3; i++) {
                const m = add(new THREE.OctahedronGeometry(0.35 - i * 0.05), mat, rng.range(-0.18, 0.18), 0.4, rng.range(-0.18, 0.18));
                m.scale.set(0.8, rng.range(1.6, 2.4), 0.8);
                m.rotation.set(rng.range(-0.25, 0.25), rng.range(0, 3), rng.range(-0.25, 0.25));
            }
            add(new THREE.BoxGeometry(0.9, 0.15, 0.9), std(0xf0f8ff), 0, 0.07, 0);
            break;
        }
        case 'mushroom': {
            add(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 8), std(b.rockAlt), 0, 0.35, 0);
            const cap = add(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(b.rockColor, { flatShading: false, roughness: 0.6 }), 0, 0.62, 0);
            cap.scale.set(1, 0.7, 1);
            const spot = std(0xfff4e8);
            for (let i = 0; i < 5; i++) {
                const a = rng.range(0, Math.PI * 2), r = rng.range(0.15, 0.35);
                add(new THREE.SphereGeometry(0.06, 6, 4), spot, Math.cos(a) * r, 0.62 + (0.35 - r) * 0.7 + 0.03, Math.sin(a) * r);
            }
            break;
        }
        case 'ruin': {
            const h = rng.range(0.6, 1.3);
            add(new THREE.BoxGeometry(0.9, 0.18, 0.9), std(b.rockAlt), 0, 0.09, 0);
            add(jitterGeo(new THREE.CylinderGeometry(0.3, 0.33, h, 10), rng, 0.02), std(0xffffff, { map: tex }), 0, 0.18 + h / 2, 0);
            if (rng.chance(0.5)) add(new THREE.BoxGeometry(0.8, 0.16, 0.8), std(b.rockColor), 0, 0.26 + h, 0);
            add(new THREE.SphereGeometry(0.2, 6, 4), std(b.moss), 0.2, 0.2, 0.25).scale.set(1.3, 0.5, 1);
            break;
        }
        case 'obsidian': {
            const mat = std(b.rockColor, { roughness: 0.25, metalness: 0.3 });
            const glowMat = std(b.moss, { emissive: b.moss, emissiveIntensity: 1.6 });
            for (let i = 0; i < 3; i++) {
                const m = add(new THREE.OctahedronGeometry(0.32), mat, rng.range(-0.2, 0.2), 0.35, rng.range(-0.2, 0.2));
                m.scale.set(0.9, rng.range(1.3, 2), 0.9);
                m.rotation.set(rng.range(-0.3, 0.3), rng.range(0, 3), rng.range(-0.3, 0.3));
            }
            add(new THREE.BoxGeometry(0.9, 0.08, 0.9), glowMat, 0, 0.02, 0);
            break;
        }
        case 'crystal': {
            add(jitterGeo(new THREE.IcosahedronGeometry(0.4, 0), rng, 0.05), std(shade(b.rockColor, -0.6)), 0, 0.2, 0).scale.set(1.1, 0.5, 1.1);
            for (let i = 0; i < 4; i++) {
                const col = i % 2 ? b.rockAlt : b.rockColor;
                const m = add(new THREE.OctahedronGeometry(0.22), std(col, { emissive: col, emissiveIntensity: 0.55, roughness: 0.2, transparent: true, opacity: 0.9 }),
                    rng.range(-0.22, 0.22), 0.5, rng.range(-0.22, 0.22));
                m.scale.set(0.7, rng.range(2, 3.2), 0.7);
                m.rotation.set(rng.range(-0.4, 0.4), rng.range(0, 3), rng.range(-0.4, 0.4));
            }
            break;
        }
        case 'pillar': {
            add(new THREE.BoxGeometry(0.9, 0.2, 0.9), std(b.rockColor), 0, 0.1, 0);
            add(new THREE.CylinderGeometry(0.3, 0.32, 1.5, 12), std(b.rockColor, { flatShading: false, roughness: 0.5 }), 0, 0.95, 0);
            add(new THREE.TorusGeometry(0.32, 0.05, 6, 16), std(b.rockAlt, { metalness: 0.8, roughness: 0.3 }), 0, 0.3, 0).rotation.x = Math.PI / 2;
            add(new THREE.BoxGeometry(0.8, 0.16, 0.8), std(b.rockColor), 0, 1.75, 0);
            break;
        }
        case 'voidshard': {
            const mat = std(b.rockColor, { roughness: 0.3, metalness: 0.4 });
            const glowMat = std(b.rockAlt, { emissive: b.rockAlt, emissiveIntensity: 1.3 });
            const m = add(new THREE.OctahedronGeometry(0.4), mat, 0, 0.6, 0);
            m.scale.set(0.8, 1.9, 0.8);
            m.rotation.y = rng.range(0, 3);
            const core = add(new THREE.OctahedronGeometry(0.16), glowMat, 0, 0.6, 0);
            core.scale.set(1, 2.4, 1);
            g.userData.spin = core;
            add(new THREE.BoxGeometry(0.9, 0.1, 0.9), std(0x100818), 0, 0.05, 0);
            break;
        }
        default:
            add(new THREE.BoxGeometry(0.9, 0.9, 0.9), std(b.rockColor), 0, 0.45, 0);
    }
    return g;
}

let spinners = [];
function buildRocks(g, rows, b, rng) {
    spinners = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 11; c++) {
            if (g.cells[r * 11 + c] !== ROCK) continue;
            const m = rockMesh(b.rock, b, rng);
            m.position.set(X(c) + 0.5, 0, -(r + 0.5));
            m.rotation.y = b.rock === 'tomb' || b.rock === 'pillar' ? 0 : rng.int(0, 3) * Math.PI / 2;
            if (m.userData.spin) spinners.push(m.userData.spin);
            root.add(m);
        }
    }
}

function buildSpikes(g, rows) {
    const plateMat = track(new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: 0.6, roughness: 0.5 }));
    const spikeMat = track(new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.9, roughness: 0.25 }));
    const cone = track(new THREE.ConeGeometry(0.08, 0.42, 6));
    const plate = track(new THREE.BoxGeometry(0.92, 0.04, 0.92));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 11; c++) {
            if (g.cells[r * 11 + c] !== SPIKE) continue;
            const grp = new THREE.Group();
            grp.position.set(X(c) + 0.5, 0, -(r + 0.5));
            const p = new THREE.Mesh(plate, plateMat);
            p.position.y = 0.02; p.receiveShadow = true;
            grp.add(p);
            const spikes = new THREE.Group();
            for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
                const s = new THREE.Mesh(cone, spikeMat);
                s.position.set(-0.28 + i * 0.28, 0.21, -0.28 + k * 0.28);
                s.castShadow = true;
                spikes.add(s);
            }
            grp.add(spikes);
            grp.userData.spikes = spikes;
            root.add(grp);
            spikeGroups.push(grp);
        }
    }
}

// ------------------------------------------------------------------ Props outside the walls

function prop(kind, b, rng) {
    const g = new THREE.Group();
    const std = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o }));
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(track(geo), mat);
        m.position.set(x, y, z); m.castShadow = true;
        g.add(m);
        return m;
    };
    const leaf = shade(b.floor.base, rng.range(-0.15, 0.1));
    switch (kind) {
        case 'tree':
            add(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6), std(0x6a4a2a), 0, 0.7, 0);
            add(jitterGeo(new THREE.IcosahedronGeometry(1.0, 1), rng, 0.12), std(leaf), 0, 1.9, 0);
            add(jitterGeo(new THREE.IcosahedronGeometry(0.7, 1), rng, 0.1), std(shade(leaf, 0.1)), 0.4, 2.5, 0.2);
            break;
        case 'bush': add(jitterGeo(new THREE.IcosahedronGeometry(0.6, 1), rng, 0.1), std(leaf), 0, 0.4, 0).scale.y = 0.7; break;
        case 'flower':
            for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.1, 6, 4), std(rng.pick([0xffe066, 0xff7aa8, 0xffffff, 0xa87aff])), rng.range(-0.5, 0.5), 0.1, rng.range(-0.5, 0.5));
            break;
        case 'pine':
            add(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), std(0x5a3a22), 0, 0.4, 0);
            for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.9 - i * 0.22, 1.0, 7), std(i === 2 ? 0xffffff : 0x2f6a4a), 0, 1.0 + i * 0.6, 0);
            break;
        case 'grave':
            add(new THREE.BoxGeometry(0.6, 0.8, 0.2), std(b.rockColor), 0, 0.4, 0).rotation.z = rng.range(-0.2, 0.2);
            break;
        case 'candle': {
            add(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), std(0xf0e8d0), 0, 0.25, 0);
            const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb050, blending: THREE.AdditiveBlending, depthWrite: false })));
            s.position.y = 0.6; s.scale.setScalar(0.6); g.add(s);
            break;
        }
        case 'deadtree':
            add(new THREE.CylinderGeometry(0.1, 0.2, 1.8, 5), std(0x3a3030), 0, 0.9, 0);
            add(new THREE.CylinderGeometry(0.04, 0.08, 0.9, 4), std(0x3a3030), 0.3, 1.5, 0).rotation.z = -0.9;
            add(new THREE.CylinderGeometry(0.04, 0.08, 0.7, 4), std(0x3a3030), -0.25, 1.3, 0).rotation.z = 0.9;
            break;
        case 'cactus':
            add(new THREE.CylinderGeometry(0.22, 0.25, 1.6, 8), std(0x4a8a3a), 0, 0.8, 0);
            add(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 7), std(0x4a8a3a), 0.35, 1.0, 0).rotation.z = -0.4;
            break;
        case 'bones':
            for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), std(0xe8dcc0), rng.range(-0.3, 0.3), 0.05, rng.range(-0.3, 0.3)).rotation.set(Math.PI / 2, 0, rng.range(0, 3));
            add(new THREE.SphereGeometry(0.18, 8, 6), std(0xe8dcc0), 0, 0.15, 0);
            break;
        case 'mesa': case 'snowrock': case 'geode':
            add(jitterGeo(new THREE.IcosahedronGeometry(0.9, 1), rng, 0.15), std(kind === 'snowrock' ? 0xe8f2ff : b.rockAlt), 0, 0.5, 0).scale.y = 0.8;
            if (kind === 'geode') add(new THREE.OctahedronGeometry(0.3), std(b.rockAlt, { emissive: b.rockAlt, emissiveIntensity: 0.8 }), 0, 1.0, 0);
            break;
        case 'iceshard': case 'crystal': {
            const col = kind === 'iceshard' ? 0x9fd6ff : b.rockColor;
            for (let i = 0; i < 3; i++) {
                const m = add(new THREE.OctahedronGeometry(0.35), std(col, { emissive: col, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 }), rng.range(-0.3, 0.3), 0.7, rng.range(-0.3, 0.3));
                m.scale.set(0.7, rng.range(2.2, 3.5), 0.7);
                m.rotation.set(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3));
            }
            break;
        }
        case 'bigshroom': case 'glowshroom': {
            const glow = kind === 'glowshroom';
            add(new THREE.CylinderGeometry(0.2, 0.28, 1.4, 8), std(0xe8d8c8), 0, 0.7, 0);
            const col = glow ? 0x7affc8 : b.rockColor;
            add(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(col, glow ? { emissive: col, emissiveIntensity: 0.9 } : {}), 0, 1.3, 0).scale.y = 0.6;
            break;
        }
        case 'root':
            add(new THREE.TorusGeometry(0.6, 0.12, 6, 10, Math.PI), std(0x5a3a2a), 0, 0, 0).rotation.y = rng.range(0, 3);
            break;
        case 'coral':
            for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.06, 0.1, rng.range(0.6, 1.2), 5), std(rng.pick([0xff7a9a, 0xffa07a, 0xc07aff])), rng.range(-0.3, 0.3), 0.4, rng.range(-0.3, 0.3)).rotation.set(rng.range(-0.5, 0.5), 0, rng.range(-0.5, 0.5));
            break;
        case 'kelp':
            for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.05, 0.08, rng.range(1.2, 2.2), 5), std(0x2f7a4a), rng.range(-0.3, 0.3), 0.8, rng.range(-0.3, 0.3)).rotation.z = rng.range(-0.3, 0.3);
            break;
        case 'column': case 'statue':
            add(new THREE.CylinderGeometry(0.35, 0.4, kind === 'statue' ? 1.0 : 2.4, 10), std(b.rockColor), 0, kind === 'statue' ? 0.5 : 1.2, 0);
            if (kind === 'statue') add(new THREE.SphereGeometry(0.3, 10, 8), std(b.rockAlt, { metalness: 0.6, roughness: 0.3 }), 0, 1.3, 0);
            break;
        case 'anvil':
            add(new THREE.BoxGeometry(0.6, 0.4, 0.4), std(0x2a2a30, { metalness: 0.8, roughness: 0.4 }), 0, 0.2, 0);
            add(new THREE.BoxGeometry(1.0, 0.2, 0.45), std(0x3a3a44, { metalness: 0.8, roughness: 0.4 }), 0, 0.5, 0);
            break;
        case 'chimney': {
            add(new THREE.BoxGeometry(0.9, 2.2, 0.9), std(0x3a3236), 0, 1.1, 0);
            add(new THREE.BoxGeometry(0.7, 0.1, 0.7), std(0xff7a2a, { emissive: 0xff6a1a, emissiveIntensity: 2 }), 0, 2.25, 0);
            break;
        }
        case 'chain':
            for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.12, 0.03, 5, 8), std(0x4a4a50, { metalness: 0.8 }), 0, 0.2 + i * 0.2, 0).rotation.y = (i % 2) * Math.PI / 2;
            break;
        case 'cloud':
            for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(rng.range(0.5, 0.9), 10, 8), std(0xffffff, { flatShading: false, roughness: 1 }), rng.range(-0.8, 0.8), rng.range(-0.2, 0.3), rng.range(-0.5, 0.5));
            g.position.y = -0.6;
            break;
        case 'voidspire': {
            const m = add(new THREE.OctahedronGeometry(0.5), std(0x1a1028, { metalness: 0.4, roughness: 0.3 }), 0, 1.4, 0);
            m.scale.set(0.6, 3, 0.6);
            add(new THREE.OctahedronGeometry(0.15), std(0xb05aff, { emissive: 0xb05aff, emissiveIntensity: 1.5 }), 0, 2.5, 0);
            break;
        }
        case 'eyestalk':
            add(new THREE.CylinderGeometry(0.08, 0.14, 1.4, 6), std(0x3a1a4a), 0, 0.7, 0);
            add(new THREE.SphereGeometry(0.25, 10, 8), std(0xffffff), 0, 1.5, 0);
            add(new THREE.SphereGeometry(0.1, 8, 6), std(0xb05aff, { emissive: 0xb05aff, emissiveIntensity: 1 }), 0, 1.52, 0.2);
            break;
        default:
            add(new THREE.BoxGeometry(0.6, 0.6, 0.6), std(b.rockColor), 0, 0.3, 0);
    }
    return g;
}

function buildProps(rows, b, rng) {
    const n = Math.round(rows * 2.2);
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * rng.range(7, 13);
        const z = -rng.range(-4, rows + 6);
        const p = prop(rng.pick(b.props), b, rng);
        p.position.x = x; p.position.z = z;
        p.rotation.y = rng.range(0, Math.PI * 2);
        p.scale.setScalar(rng.range(0.8, 1.5));
        root.add(p);
    }
    // A few beyond the door so the exit leads somewhere.
    for (let i = 0; i < 6; i++) {
        const p = prop(rng.pick(b.props), b, rng);
        p.position.set(rng.range(-6, 6), 0, -rows - rng.range(3.5, 9));
        p.scale.setScalar(rng.range(0.8, 1.4));
        root.add(p);
    }
}

// ------------------------------------------------------------------ Ambient particles

const AMBIENT = {
    fireflies: { n: 50, size: 0.16, rise: 0.05, drift: 0.6, blink: true },
    dust:      { n: 70, size: 0.08, rise: 0.02, drift: 0.2 },
    embers:    { n: 90, size: 0.1,  rise: 0.9,  drift: 0.3, blink: true },
    snow:      { n: 160, size: 0.1, rise: -0.8, drift: 0.4 },
    spores:    { n: 80, size: 0.12, rise: 0.25, drift: 0.35, blink: true },
    bubbles:   { n: 70, size: 0.1,  rise: 0.6,  drift: 0.2 },
    sparks:    { n: 90, size: 0.08, rise: 1.6,  drift: 0.5, blink: true },
    glints:    { n: 80, size: 0.12, rise: 0.05, drift: 0.1, blink: true },
    clouds:    { n: 40, size: 0.9,  rise: 0.0,  drift: 0.5 },
    motes:     { n: 90, size: 0.1,  rise: 0.2,  drift: 0.6, blink: true },
};

function buildAmbient(rows, b) {
    const cfg = AMBIENT[b.particles] ?? AMBIENT.dust;
    const n = cfg.n;
    const geo = track(new THREE.BufferGeometry());
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 1] = Math.random() * 4;
        pos[i * 3 + 2] = -Math.random() * (rows + 6) + 3;
        seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = track(new THREE.PointsMaterial({
        size: cfg.size, map: glowTexture(), color: b.pColor, transparent: true, opacity: b.particles === 'clouds' ? 0.25 : 0.85,
        blending: b.particles === 'clouds' || b.particles === 'snow' ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    mat.size = cfg.size * 3;
    ambient = new THREE.Points(geo, mat);
    ambient.userData = { cfg, rows };
    ambient.frustumCulled = false;
    root.add(ambient);
}

// ------------------------------------------------------------------ Shrine NPCs

function buildShrine(kind) {
    const g = new THREE.Group();
    const angel = kind === 'angel';
    const robe = angel ? 0xfff6e0 : 0x5a0a14;
    const skin = angel ? 0xffe0c8 : 0xc8303a;
    const std = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
    const body = new THREE.Group();
    const r = new THREE.Mesh(track(new THREE.ConeGeometry(0.45, 1.2, 12)), std(robe));
    r.position.y = 0.6; r.castShadow = true; body.add(r);
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.24, 14, 10)), std(skin));
    head.position.y = 1.35; head.castShadow = true; body.add(head);
    const wingMat = std(angel ? 0xffffff : 0x2a0a10, { side: THREE.DoubleSide, emissive: angel ? 0xfff0c0 : 0x600010, emissiveIntensity: angel ? 0.4 : 0.3 });
    for (const s of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(s * 0.6, 0.7, s * 1.1, 0.9);
        shape.quadraticCurveTo(s * 0.8, 0.3, s * 1.0, -0.1);
        shape.quadraticCurveTo(s * 0.5, 0.1, 0, 0);
        const wing = new THREE.Mesh(track(new THREE.ShapeGeometry(shape)), wingMat);
        wing.position.set(s * 0.1, 0.95, -0.15);
        wing.rotation.y = s * 0.4;
        body.add(wing);
        body.userData['wing' + s] = wing;
    }
    if (angel) {
        const halo = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.035, 8, 24)), std(0xffe066, { emissive: 0xffd040, emissiveIntensity: 2 }));
        halo.rotation.x = Math.PI / 2; halo.position.y = 1.7; body.add(halo);
    } else {
        for (const s of [-1, 1]) {
            const horn = new THREE.Mesh(track(new THREE.ConeGeometry(0.06, 0.3, 6)), std(0x1a0a0a));
            horn.position.set(s * 0.14, 1.58, 0); horn.rotation.z = -s * 0.4; body.add(horn);
        }
    }
    g.add(body);
    g.userData.body = body;
    const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), color: angel ? 0xfff0b0 : 0xff2040, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })));
    glow.scale.setScalar(3.2); glow.position.y = 1;
    g.add(glow);
    const pad = new THREE.Mesh(track(new THREE.RingGeometry(0.7, 0.85, 32)), track(new THREE.MeshBasicMaterial({ color: angel ? 0xfff0b0 : 0xff3050, transparent: true, opacity: 0.7, side: THREE.DoubleSide })));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02;
    g.add(pad);
    g.userData.pad = pad;
    return g;
}

// ------------------------------------------------------------------ Per-frame

export function updateRoom(w, dt, time) {
    if (!root) return;
    if (pitMat) pitMat.uniforms.uTime.value = time;

    // Door: portcullis sinks, gem and portal light up.
    if (door) {
        const open = w.grid.doorOpen;
        const bars = door.userData.bars;
        bars.position.y += ((open ? -2.2 : 0) - bars.position.y) * Math.min(1, dt * 4);
        const gem = door.userData.gem;
        gem.material.emissiveIntensity += ((open ? 2.5 : 0.25) - gem.material.emissiveIntensity) * Math.min(1, dt * 3);
        gem.rotation.y += dt * (open ? 3 : 0.5);
        const portal = door.userData.portal;
        const final = !w.endless && w.stage === 11;
        portal.material.color.set(final ? 0xffd860 : 0x7affd8);
        portal.material.opacity += ((open ? 0.9 + Math.sin(time * 4) * 0.1 : 0) - portal.material.opacity) * Math.min(1, dt * 3);
    }

    // Spikes.
    const up = spikesUp(w);
    for (const s of spikeGroups) {
        const sp = s.userData.spikes;
        sp.position.y += ((up ? 0 : -0.4) - sp.position.y) * Math.min(1, dt * (up ? 20 : 6));
    }

    for (const s of spinners) s.rotation.y += dt * 1.5;
    for (let i = 0; i < torches.length; i++) {
        const t = torches[i];
        t.scale.setScalar(0.75 + Math.sin(time * 13 + i * 3) * 0.06 + Math.sin(time * 7.1 + i) * 0.05);
    }

    // Ambient drift.
    if (ambient) {
        const { cfg, rows } = ambient.userData;
        const p = ambient.geometry.attributes.position, sd = ambient.geometry.attributes.seed;
        for (let i = 0; i < p.count; i++) {
            const s = sd.getX(i);
            let x = p.getX(i) + Math.sin(time * 0.7 + s) * cfg.drift * dt;
            let y = p.getY(i) + cfg.rise * dt;
            let z = p.getZ(i) + Math.cos(time * 0.5 + s * 1.3) * cfg.drift * dt;
            if (y > 4.5) y = 0; else if (y < 0) y = 4.5;
            p.setXYZ(i, x, y, z);
        }
        p.needsUpdate = true;
        if (cfg.blink) ambient.material.opacity = 0.7 + Math.sin(time * 2) * 0.15;
    }

    // Shrine.
    const s = w.shrine;
    if (s !== lastShrine) {
        if (shrineObj) { root.remove(shrineObj); shrineObj = null; }
        lastShrine = s;
        if (s) {
            shrineObj = buildShrine(s.kind);
            shrineObj.position.set(s.x, 0, -s.y);
            shrineObj.scale.setScalar(0.01);
            root.add(shrineObj);
        }
    }
    if (shrineObj && s) {
        const target = s.used ? 0.001 : 1;
        const k = shrineObj.scale.x + (target - shrineObj.scale.x) * Math.min(1, dt * 4);
        shrineObj.scale.setScalar(k);
        const body = shrineObj.userData.body;
        body.position.y = 0.25 + Math.sin(time * 2) * 0.12;
        for (const side of [-1, 1]) body.userData['wing' + side].rotation.y = side * (0.4 + Math.sin(time * 5) * 0.25);
        shrineObj.userData.pad.material.opacity = 0.4 + Math.sin(time * 3) * 0.3;
    }
}
