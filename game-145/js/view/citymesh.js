// The outside of Ashmere in chunks of one block: streets with their markings, sidewalks and curbs, lawns and lots,
// the outer shell of every building (facades with real window openings, floor bands, roofs, gables, signs), the
// props on the streets, fences and street lights. Built near the walker, dropped far away.

import * as THREE from 'three';
import { TILE, WALL_T, CITY } from '../config.js';
import { G_ROAD, G_WALK, G_GRASS, G_LOT, G_DIRT, G_PLAZA, G_BUILDING } from '../sim/city.js';
import { interiorOf, getEdge, E } from '../sim/interior.js';
import { Kit } from './kit.js';
import { surface, plain, decal, signTexture } from './tex.js';
import { buildProp } from './props.js';
import { modelFor, addVehicles, VEHICLE_KINDS } from './vehicles.js';
import { windowSpan, DOOR_H } from './interiormesh.js';

export const CHUNK = CITY.pitch;           // tiles per chunk side
const T2 = WALL_T / 2;
const hash = (a, b, c = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); };

const FACADE_TEX = { brick: 'brick', facade: 'facade', stucco: 'stucco', siding: 'siding', rust: 'rust', lab: 'lab' };
const FACADE_REP = { brick: 2.6, facade: 4, stucco: 3, siding: 2.4, rust: 3, lab: 2.4 };

// ------------------------------------------------------------------ the window panes and dark doorways
//
// One material for every pane in the city. Each pane carries its building's id (and whether it is broken or a
// doorway). While a building's interior is not built the pane is dark, dirty glass you can't see through; once the
// walker is near and the interior exists, it turns clear (or vanishes, if broken) and you see the rooms behind it.

export const builtTex = new THREE.DataTexture(new Uint8Array(1024 * 16 * 4), 1024, 16, THREE.RGBAFormat);
builtTex.needsUpdate = true;
/** Tell the panes that level L of building bid now exists (they turn clear) or not (dark glass again). */
export function markBuilt(bid, L, on) { builtTex.image.data[(L * 1024 + bid) * 4] = on ? 255 : 0; builtTex.needsUpdate = true; }
export function clearBuilt() { builtTex.image.data.fill(0); builtTex.needsUpdate = true; }

let paneMat = null;
export function panes() {
    if (paneMat) return paneMat;
    paneMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { built: { value: builtTex }, sky: { value: new THREE.Color(0x5a6d72) }, glow: { value: 0 } }]),
        vertexShader: `
            attribute float bid;
            varying float vBid; varying vec3 vN; varying vec3 vW; varying vec3 vCol;
            #include <fog_pars_vertex>
            void main() {
                vBid = bid; vCol = color;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
                vec4 mvPosition = viewMatrix * wp;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: `
            uniform sampler2D built; uniform vec3 sky; uniform float glow;
            varying float vBid; varying vec3 vN; varying vec3 vW; varying vec3 vCol;
            #include <fog_pars_fragment>
            void main() {
                float id = floor(vBid / 2.0 + 0.01);
                float broken = mod(floor(vBid + 0.01), 2.0);
                float bld = floor(id / 16.0 + 0.001), lvl = id - bld * 16.0;
                float isBuilt = texture2D(built, vec2((bld + 0.5) / 1024.0, (lvl + 0.5) / 16.0)).r;
                vec3 V = normalize(cameraPosition - vW);
                float fr = pow(clamp(1.0 - abs(dot(V, normalize(vN))), 0.0, 1.0), 3.0);
                vec3 col = mix(vec3(0.015, 0.02, 0.022), sky * 0.55, fr) + vCol * glow;
                float a = mix(0.94, 0.16 + fr * 0.35, isBuilt);
                if (broken > 0.5) a = mix(0.97, 0.0, isBuilt);
                if (a < 0.01) discard;
                gl_FragColor = vec4(col, a);
                #include <fog_fragment>
            }`,
        vertexColors: true,
    });
    return paneMat;
}

// ------------------------------------------------------------------ chunks

export function chunkKey(ci, cj) { return ci + ',' + cj; }

/** Build the chunk of tiles [ci*CHUNK, +CHUNK) x [cj*CHUNK, +CHUNK). Returns { group, signs, lights }. */
export function buildChunk(G, ci, cj) {
    const C = G.city, N = C.n;
    const K = new Kit();
    const tx0 = ci * CHUNK, tz0 = cj * CHUNK, tx1 = Math.min(N, tx0 + CHUNK), tz1 = Math.min(N, tz0 + CHUNK);
    const signs = new THREE.Group();
    const lights = [];

    // ---- ground
    const asphalt = surface('asphalt', { bump: 0.8 }), walk = surface('sidewalk', { bump: 0.6 }), grass = surface('grass', { bump: 0.8 }), lot = surface('fconcrete', { bump: 0.5 });
    const paint = plain('paint');
    const g = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? -1 : C.ground[z * N + x]);
    for (let z = tz0; z < tz1; z++) for (let x = tx0; x < tx1; x++) {
        const t = C.ground[z * N + x];
        const X0 = x * TILE, Z0 = z * TILE, X1 = X0 + TILE, Z1 = Z0 + TILE;
        const sq = (m, y, rep, col = [1, 1, 1]) => K.quad(m, [X0, y, Z1], [X1, y, Z1], [X1, y, Z0], [X0, y, Z0], [[X0 / rep, Z1 / rep], [X1 / rep, Z1 / rep], [X1 / rep, Z0 / rep], [X0 / rep, Z0 / rep]], col);
        const n = hash(x, z);
        if (t === G_ROAD) {
            sq(asphalt, 0, 6, [0.85 + n * 0.1, 0.85 + n * 0.1, 0.85 + n * 0.1]);
            roadMarks(K, paint, x, z, X0, Z0);
        } else if (t === G_WALK || t === G_PLAZA) {
            sq(walk, 0.12, 3, [0.9, 0.9, 0.88]);
            // curb faces down to the road
            for (const [dx, dz, a, b2] of [[1, 0, [X1, Z1], [X1, Z0]], [-1, 0, [X0, Z0], [X0, Z1]], [0, 1, [X0, Z1], [X1, Z1]], [0, -1, [X1, Z0], [X0, Z0]]]) {
                const nt = g(x + dx, z + dz);
                if (nt === G_ROAD || nt === -1) K.quad(walk, [a[0], 0, a[1]], [b2[0], 0, b2[1]], [b2[0], 0.12, b2[1]], [a[0], 0.12, a[1]], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.7, 0.7, 0.68]);
            }
        } else if (t === G_GRASS || t === G_DIRT) {
            sq(grass, 0.1, 5, t === G_DIRT ? [0.62, 0.5, 0.36] : [0.8 + n * 0.25, 0.8 + n * 0.2, 0.75]);
            if (t === G_GRASS) tufts(K, X0, Z0, n);
            edgeLip(K, walk, x, z, X0, Z0, 0.1, g);
        } else if (t === G_LOT) {
            sq(lot, 0.08, 5, [0.75 + n * 0.1, 0.74 + n * 0.1, 0.72 + n * 0.1]);
            edgeLip(K, walk, x, z, X0, Z0, 0.08, g);
        } else if (t === G_BUILDING) {
            sq(lot, 0.0, 5, [0.3, 0.3, 0.3]);
        }
        // leaves and litter in the gutters
        if ((t === G_ROAD || t === G_WALK) && n < 0.06) K.flat(decal('d-leaves', 'alpha'), X0 + 1, t === G_ROAD ? 0.015 : 0.135, Z0 + 1, 2.2, 2.2, n * 60, [1, 1, 1]);
    }

    // ---- the edge of the world: barriers, a fence, and road running on into the fog
    if (tx0 === 0 || tz0 === 0 || tx1 === N || tz1 === N) worldEdge(K, C, tx0, tz0, tx1, tz1);

    // ---- buildings whose corner is in this chunk
    for (const b of C.buildings) {
        if (b.x0 < tx0 || b.x0 >= tx1 || b.z0 < tz0 || b.z0 >= tz1) continue;
        shell(K, G, b, signs, lights);
    }

    // ---- props, fences and lights
    const inChunk = (x, z) => x >= tx0 * TILE && x < tx1 * TILE && z >= tz0 * TILE && z < tz1 * TILE;
    const cars = [];
    for (const p of C.props) {
        if (!inChunk(p.x, p.z)) continue;
        if (p.k === 'lotlines') lotLines(K, paint, p);
        else if (VEHICLE_KINDS.has(p.k) && modelFor(p)) cars.push({ ...p, y: groundY(C, p.x, p.z) });   // a Meshy model
        else buildProp(K, { ...p, y: groundY(C, p.x, p.z) });
    }
    for (const L of C.lights) {
        if (!inChunk(L.x, L.z)) continue;
        if (L.kind === 'flood') buildProp(K, { k: 'flood', x: L.x, z: L.z, r: 0 });
        else buildProp(K, { k: 'streetlight', x: L.x, z: L.z, r: L.r ? 0 : Math.PI / 2, on: L.on, y: 0.12 });
        if (L.on) lights.push({ x: L.x + (L.kind === 'flood' ? 0 : L.r ? 0 : 1.7), y: L.kind === 'flood' ? 8 : 6.4, z: L.z + (L.kind === 'flood' ? 0.4 : L.r ? 1.7 : 0), street: true, flick: hash(L.x, L.z) < 0.3 });
    }
    for (const [key, f] of C.fence) {
        const m = key.match(/([hv])(\d+),(\d+)/);
        const ex = +m[2], ez = +m[3];
        if (ex < tx0 || ex >= tx1 || ez < tz0 || ez >= tz1) continue;
        if (f.kind === 'gate') continue;               // the gate is dynamic (it opens)
        fence(K, f.kind, m[1] === 'h' ? [ex * TILE, ez * TILE] : [ex * TILE, ez * TILE], m[1] === 'h' ? [(ex + 1) * TILE, ez * TILE] : [ex * TILE, (ez + 1) * TILE], hash(ex, ez));
    }
    const group = K.build({ name: `chunk${ci},${cj}` }) ?? new THREE.Group();
    group.add(signs);
    addVehicles(group, cars);
    return { group, lights };
}

function groundY(C, x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    if (tx < 0 || tz < 0 || tx >= C.n || tz >= C.n) return 0;
    const g = C.ground[tz * C.n + tx];
    return g === G_WALK || g === G_PLAZA ? 0.12 : g === G_GRASS || g === G_DIRT ? 0.1 : g === G_LOT ? 0.08 : 0;
}

function edgeLip(K, m, x, z, X0, Z0, h, g) {
    for (const [dx, dz, a, b2] of [[1, 0, [X0 + 2, Z0 + 2], [X0 + 2, Z0]], [-1, 0, [X0, Z0], [X0, Z0 + 2]], [0, 1, [X0, Z0 + 2], [X0 + 2, Z0 + 2]], [0, -1, [X0 + 2, Z0], [X0, Z0]]]) {
        if (g(x + dx, z + dz) === G_ROAD) K.quad(m, [a[0], 0, a[1]], [b2[0], 0, b2[1]], [b2[0], h, b2[1]], [a[0], h, a[1]], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.7, 0.7, 0.68]);
    }
}

function tufts(K, X0, Z0, n) {
    // thin blades of dead grass in clumps
    const m = plain('leaves');
    for (let i = 0; i < 4; i++) {
        const cx = X0 + hash(X0, Z0, i) * 2, cz = Z0 + hash(Z0, X0, i) * 2;
        for (let j = 0; j < 5; j++) {
            const a = hash(cx, cz, j) * 6.28, h = 0.18 + hash(cz, cx, j) * 0.35, lean = (hash(j, cx, cz) - 0.5) * 0.25;
            const dx = Math.cos(a) * 0.035, dz = Math.sin(a) * 0.035;
            const col = hash(i, j, cx) < 0.6 ? [0.34, 0.3, 0.16] : [0.2, 0.24, 0.11];
            const tx = cx + Math.cos(a + 1.57) * lean, tz = cz + Math.sin(a + 1.57) * lean;
            K.quad(m, [cx - dx, 0.1, cz - dz], [cx + dx, 0.1, cz + dz], [tx + dx * 0.1, 0.1 + h, tz + dz * 0.1], [tx - dx * 0.1, 0.1 + h, tz - dz * 0.1], [[0, 0], [1, 0], [1, 1], [0, 1]], col);
        }
    }
}

function roadMarks(K, m, x, z, X0, Z0) {
    const P = CITY.pitch;
    const rx = x % P, rz = z % P;
    const inRoadX = rx >= 1 && rx <= 3, inRoadZ = rz >= 1 && rz <= 3;
    const col = [0.72, 0.62, 0.32], white = [0.75, 0.74, 0.7];
    if (inRoadX && !inRoadZ && rz !== 0 && rz !== 4) {
        // a road running north-south: a dashed yellow centre line
        if (rx === 2 && z % 3 !== 0) { K.flat(m, X0 + 0.93, 0.01, Z0 + 1, 0.1, 1.5, 0, col); K.flat(m, X0 + 1.07, 0.01, Z0 + 1, 0.1, 1.5, 0, col); }
        if (rz === 5 || rz === P - 1) for (let k = 0; k < 4; k++) K.flat(m, X0 + 0.25 + k * 0.5, 0.01, Z0 + 1, 0.3, 1.8, 0, white);
    } else if (inRoadZ && !inRoadX && rx !== 0 && rx !== 4) {
        if (rz === 2 && x % 3 !== 0) { K.flat(m, X0 + 1, 0.01, Z0 + 0.93, 1.5, 0.1, 0, col); K.flat(m, X0 + 1, 0.01, Z0 + 1.07, 1.5, 0.1, 0, col); }
        if (rx === 5 || rx === P - 1) for (let k = 0; k < 4; k++) K.flat(m, X0 + 1, 0.01, Z0 + 0.25 + k * 0.5, 1.8, 0.3, 0, white);
    }
}

function lotLines(K, m, p) {
    for (let x = p.x - p.w / 2 + 2; x < p.x + p.w / 2 - 1; x += 4) {
        K.flat(m, x, 0.09, p.z - p.d / 2 + 2.4, 0.1, 3.2, 0, [0.7, 0.68, 0.62]);
        if (p.d > 10) K.flat(m, x, 0.09, p.z + p.d / 2 - 2.4, 0.1, 3.2, 0, [0.7, 0.68, 0.62]);
    }
}

let chainMat = null;
function chainLink() {
    if (chainMat) return chainMat;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(160,165,160,1)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    chainMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6, vertexColors: true });
    return chainMat;
}

export function fence(K, kind, a, b, r, open = false) {
    if (kind === 'picket') {
        const m = plain('wood');
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 0.1; t < len; t += 0.25) {
            if (hash(a[0] + t, a[1]) < 0.18) continue;           // missing pickets
            const x = a[0] + (b[0] - a[0]) * t / len, z = a[1] + (b[1] - a[1]) * t / len;
            const lean = (hash(x, z) - 0.5) * 0.25;
            K.at(x, 0.1, z, lean, () => K.box(m, 0, 0, 0, 0.08, 0.95 - hash(z, x) * 0.2, 0.08, [0.6, 0.58, 0.52]));
        }
        K.tube(m, [a[0], 0.75, a[1]], [b[0], 0.75, b[1]], 0.03, 4, [0.5, 0.48, 0.42]);
        return;
    }
    // chain-link with barbed wire on top
    const m = plain('metal');
    for (const p of [a, b]) K.tube(m, [p[0], 0, p[1]], [p[0], 3.2, p[1]], 0.05, 6, [0.45, 0.46, 0.44]);
    K.tube(m, [a[0], 3.0, a[1]], [b[0], 3.0, b[1]], 0.03, 5, [0.45, 0.46, 0.44]);
    if (!open) K.quad(chainLink(), [a[0], 0.05, a[1]], [b[0], 0.05, b[1]], [b[0], 3.0, b[1]], [a[0], 3.0, a[1]], [[0, 0], [2.5, 0], [2.5, 3.7], [0, 3.7]], [1, 1, 1]);
    K.tube(m, [a[0], 3.3, a[1]], [b[0], 3.35, b[1]], 0.012, 4, [0.4, 0.38, 0.35]);
    K.tube(m, [a[0], 3.5, a[1]], [b[0], 3.45, b[1]], 0.012, 4, [0.4, 0.38, 0.35]);
}

function worldEdge(K, C, tx0, tz0, tx1, tz1) {
    const N = C.n, L = N * TILE;
    const m = plain('concrete');
    const runs = [];
    if (tz0 === 0) runs.push([[tx0 * TILE, 0], [tx1 * TILE, 0], [0, -1]]);
    if (tz1 === N) runs.push([[tx0 * TILE, L], [tx1 * TILE, L], [0, 1]]);
    if (tx0 === 0) runs.push([[0, tz0 * TILE], [0, tz1 * TILE], [-1, 0]]);
    if (tx1 === N) runs.push([[L, tz0 * TILE], [L, tz1 * TILE], [1, 0]]);
    for (const [a, b, n] of runs) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 1; t < len; t += 3.2) {
            const x = a[0] + (b[0] - a[0]) * t / len + n[0] * 0.4, z = a[1] + (b[1] - a[1]) * t / len + n[1] * 0.4;
            K.at(x, 0, z, n[0] ? Math.PI / 2 : 0, () => { K.box(m, 0, 0, 0, 3.0, 0.3, 0.6, [0.62, 0.6, 0.56]); K.box(m, 0, 0.3, 0, 3.0, 0.55, 0.25, [0.62, 0.6, 0.56]); });
        }
        fence(K, 'chain', [a[0] + n[0] * 1.2, a[1] + n[1] * 1.2], [b[0] + n[0] * 1.2, b[1] + n[1] * 1.2], 0);
        // the road keeps going out into the fog
        const far = 260;
        const q = (p, d) => [p[0] + n[0] * d, p[1] + n[1] * d];
        const A0 = q(a, 0), B0 = q(b, 0), A1 = q(a, far), B1 = q(b, far);
        K.quad(surface('asphalt'), [A0[0], -0.02, A0[1]], [A1[0], -0.02, A1[1]], [B1[0], -0.02, B1[1]], [B0[0], -0.02, B0[1]], [[0, 0], [far / 6, 0], [far / 6, len / 6], [0, len / 6]], [0.45, 0.45, 0.45]);
        const B0r = q(b, 0), A0r = q(a, 0);
        void B0r; void A0r;
    }
}

// ------------------------------------------------------------------ building shells

function shell(K, G, b, signs, lights) {
    const signed = new Set();
    const C = G.city, I = interiorOf(C, b);
    const fm = surface(FACADE_TEX[b.facade] ?? 'facade', { bump: 0.7 });
    const rep = FACADE_REP[b.facade] ?? 3;
    const H = b.h, ox = b.x0 * TILE, oz = b.z0 * TILE, W = b.w * TILE, D = b.d * TILE;
    const pm = panes();
    const grime = 0.62 + (1 - b.decay) * 0.3;
    const [s0, s1] = windowSpan(H, b.type);
    // the four faces: [edge dir, tiles along, start point, along unit, outward normal]
    const faces = [
        [0, b.w, [ox, oz], [1, 0], [0, -1]],
        [2, b.w, [ox + W, oz + D], [-1, 0], [0, 1]],
        [3, b.d, [ox, oz + D], [0, -1], [-1, 0]],
        [1, b.d, [ox + W, oz], [0, 1], [1, 0]],
    ];
    for (let L = 0; L < b.floors; L++) {
        const lv = I.levels[L], y0 = L * H;
        for (const [dir, n, start, u, nrm] of faces) {
            for (let k = 0; k < n; k++) {
                // the tile behind this stretch of facade
                let tx, tz;
                if (dir === 0) { tx = k; tz = 0; } else if (dir === 2) { tx = b.w - 1 - k; tz = b.d - 1; } else if (dir === 3) { tx = 0; tz = b.d - 1 - k; } else { tx = b.w - 1; tz = k; }
                const e = getEdge(I, lv, tx, tz, dir);
                const a = [start[0] + u[0] * k * TILE + nrm[0] * T2, start[1] + u[1] * k * TILE + nrm[1] * T2];
                const c = [a[0] + u[0] * TILE, a[1] + u[1] * TILE];
                const face = (u0, u1, h0, h1, col = grime) => facadeQuad(K, fm, rep, a, c, u0, u1, y0 + h0, y0 + h1, col, nrm);
                const id = (b.id * 16 + L) * 2;
                if (e === E.WINDOW) {
                    face(0, 1, 0, s0); face(0, 1, s1, H); face(0, 0.12, s0, s1); face(0.88, 1, s0, s1);
                    const broken = hash(b.id, L * 97 + dir, k) < 0.25 + b.decay * 0.3 ? 1 : 0;
                    paneQuad(K, pm, a, c, 0.12, 0.88, y0 + s0, y0 + s1, nrm, id + broken, -0.05);
                    // sill and frame
                    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
                    K.at(mx + nrm[0] * 0.08, y0 + s0 - 0.08, mz + nrm[1] * 0.08, Math.atan2(nrm[0], nrm[1]), () => K.box(plain('concrete'), 0, 0, 0, 1.7, 0.08, 0.2, [0.55, 0.53, 0.5]));
                    if (hash(b.id, L, k + dir * 50) < 0.12) facadeDecal(K, decal('d-stain'), a, c, nrm, 0.5, y0 + s0 - 0.9, 1.4);
                    if (b.type === 'house' && hash(b.id, k, dir) < 0.35 && L === 0) {
                        // boarded up
                        for (let i = 0; i < 3; i++) K.at(mx + nrm[0] * 0.1, y0 + s0 + 0.25 + i * 0.45, mz + nrm[1] * 0.1, Math.atan2(nrm[0], nrm[1]) + (i - 1) * 0.08, () => K.box(plain('wood'), 0, 0, 0, 1.75, 0.2, 0.03, [0.5, 0.42, 0.32]));
                    }
                } else if (e === E.DOOR || e === E.BROKEN) {
                    const g = 0.29;
                    face(0, 0.5 - g, 0, H); face(0.5 + g, 1, 0, H); face(0.5 - g, 0.5 + g, DOOR_H, H);
                    paneQuad(K, pm, a, c, 0.5 - g, 0.5 + g, y0, y0 + DOOR_H, nrm, id + 1, -0.1);
                    // a canopy over the main door, and a sign for named buildings
                    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
                    if (L === 0 && b.type !== 'house') K.at(mx + nrm[0] * 0.6, DOOR_H + 0.35, mz + nrm[1] * 0.6, Math.atan2(nrm[0], nrm[1]), () => K.box(plain('metal'), 0, 0, 0, 2.6, 0.12, 1.2, [0.3, 0.3, 0.28]));
                    if (L === 0 && b.type === 'house') K.at(mx + nrm[0] * 0.8, 0, mz + nrm[1] * 0.8, Math.atan2(nrm[0], nrm[1]), () => { K.box(plain('wood'), 0, 0, 0, 2.2, 0.25, 1.4, [0.45, 0.38, 0.3]); for (const sx of [-1, 1]) K.box(plain('wood'), sx * 1.0, 0.25, 0.6, 0.1, 2.4, 0.1, [0.5, 0.45, 0.38]); K.box(plain('wood'), 0, 2.6, 0.1, 2.4, 0.1, 1.6, [0.4, 0.34, 0.28]); });
                    if (L === 0 && b.name && !signed.has(b.id)) { signed.add(b.id); addSign(signs, b, mx + nrm[0] * 0.2, Math.min(H - 0.4, DOOR_H + 0.75), mz + nrm[1] * 0.2, nrm); }
                } else if (e === E.GLASS) {
                    face(0, 1, 0, 0.35); face(0, 1, 2.7, H);
                    paneQuad(K, pm, a, c, 0, 1, y0 + 0.35, y0 + 2.7, nrm, id + (hash(b.id, k, 3) < 0.2 ? 1 : 0), -0.05);
                } else face(0, 1, 0, H);
            }
        }
        // a band at each floor line
        if (L > 0 && b.type !== 'house') band(K, plain('concrete'), ox, oz, W, D, y0 - 0.12, 0.24, 0.12, [0.5, 0.48, 0.45]);
        if (L === 0 && b.type === 'garage') band(K, plain('concrete'), ox, oz, W, D, 0.9, 0.15, 0.05, [0.5, 0.5, 0.48]);
    }
    // corners
    const top = b.floors * H;
    for (const [cx, cz] of [[ox, oz], [ox + W, oz], [ox, oz + D], [ox + W, oz + D]]) K.box(fm, cx, 0, cz, WALL_T + 0.04, top, WALL_T + 0.04, [grime, grime, grime], rep);
    // the roof
    if (b.type === 'house') gable(K, b, ox, oz, W, D, top, fm, rep, grime);
    else {
        const rm = surface('fconcrete', { bump: 2 });
        K.quad(rm, [ox, top, oz + D], [ox + W, top, oz + D], [ox + W, top, oz], [ox, top, oz], [[0, 1], [W / 5, 1], [W / 5, 0], [0, 0]], [0.35, 0.35, 0.36]);
        band(K, fm, ox, oz, W, D, top, 0.9, 0.25, [grime * 0.9, grime * 0.9, grime * 0.9]);
        // rooftop clutter: water tanks, vents, AC units
        const n = Math.floor((W * D) / 120);
        for (let i = 0; i < Math.min(6, n); i++) {
            const x = ox + 2 + hash(b.id, i) * (W - 4), z = oz + 2 + hash(i, b.id) * (D - 4);
            const kind = hash(b.id, i, 7);
            if (kind < 0.25 && b.floors >= 3) { K.cyl(plain('wood'), x, top, z, 1.4, 3.2, 10, [0.38, 0.3, 0.24]); K.cyl(plain('metal'), x, top + 3.2, z, 1.5, 0.8, 10, [0.3, 0.3, 0.3], 0.1); }
            else if (kind < 0.6) K.box(plain('metal'), x, top, z, 1.6, 1.1, 1.0, [0.5, 0.5, 0.48]);
            else K.cyl(plain('rust'), x, top, z, 0.35, 1.2, 8, [0.5, 0.4, 0.3]);
        }
        if (b.type === 'hotel') vacancy(signs, b, ox, oz, W, D, top, lights);
        if ((b.type === 'mall' || b.type === 'hall' || b.type === 'hospital' || b.type === 'factory') && b.name) roofSign(signs, b, ox + W / 2, top + 0.9, oz, b.name);
        if (b.type === 'factory') { K.cyl(plain('rust'), ox + W - 3, top, oz + D - 3, 1.2, 14, 12, [0.5, 0.38, 0.3], 0.9); }
    }
}

function facadeQuad(K, m, rep, a, c, u0, u1, h0, h1, g, nrm) {
    if (h1 - h0 < 0.005) return;
    const A = [a[0] + (c[0] - a[0]) * u0, a[1] + (c[1] - a[1]) * u0], B = [a[0] + (c[0] - a[0]) * u1, a[1] + (c[1] - a[1]) * u1];
    // faces must point along nrm
    const D = [B[0] - A[0], B[1] - A[1]];
    let P = A, Q = B;
    if (-D[1] * nrm[0] + D[0] * nrm[1] < 0) [P, Q] = [B, A];
    const along = (p) => (Math.abs(nrm[0]) > 0.5 ? p[1] : p[0]);
    const s = (h) => g * (0.55 + Math.min(1, h / 4) * 0.45);
    K.quad(m, [P[0], h0, P[1]], [Q[0], h0, Q[1]], [Q[0], h1, Q[1]], [P[0], h1, P[1]],
        [[along(P) / rep, h0 / rep], [along(Q) / rep, h0 / rep], [along(Q) / rep, h1 / rep], [along(P) / rep, h1 / rep]],
        [[s(h0), s(h0), s(h0)], [s(h0), s(h0), s(h0)], [s(h1), s(h1), s(h1)], [s(h1), s(h1), s(h1)]]);
}

function paneQuad(K, m, a, c, u0, u1, h0, h1, nrm, bid, inset) {
    const A = [a[0] + (c[0] - a[0]) * u0 + nrm[0] * inset, a[1] + (c[1] - a[1]) * u0 + nrm[1] * inset];
    const B = [a[0] + (c[0] - a[0]) * u1 + nrm[0] * inset, a[1] + (c[1] - a[1]) * u1 + nrm[1] * inset];
    K.quad(m, [A[0], h0, A[1]], [B[0], h0, B[1]], [B[0], h1, B[1]], [A[0], h1, A[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.9, 0.75, 0.45], bid);
}

function facadeDecal(K, m, a, c, n, u, yc, s) {
    const mx = a[0] + (c[0] - a[0]) * u + n[0] * 0.015, mz = a[1] + (c[1] - a[1]) * u + n[1] * 0.015;
    const tx = n[1], tz = -n[0], hs = s / 2;
    K.quad(m, [mx - tx * hs, yc - hs, mz - tz * hs], [mx + tx * hs, yc - hs, mz + tz * hs], [mx + tx * hs, yc + hs, mz + tz * hs], [mx - tx * hs, yc + hs, mz - tz * hs], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]);
}

function band(K, m, ox, oz, W, D, y, h, out, col) {
    K.box(m, ox + W / 2, y, oz - out / 2, W + out * 2, h, out, col, 2, 0b111101);
    K.box(m, ox + W / 2, y, oz + D + out / 2, W + out * 2, h, out, col, 2, 0b111101);
    K.box(m, ox - out / 2, y, oz + D / 2, out, h, D, col, 2, 0b111101);
    K.box(m, ox + W + out / 2, y, oz + D / 2, out, h, D, col, 2, 0b111101);
}

function gable(K, b, ox, oz, W, D, top, fm, rep, g) {
    const rm = surface('fconcrete', { bump: 3 });
    const alongX = W >= D;
    const rise = (alongX ? D : W) * 0.42;
    const col = [0.28, 0.24, 0.22], o = 0.4;
    if (alongX) {
        const zm = oz + D / 2;
        K.quad(rm, [ox - o, top, oz - o], [ox - o, top + rise, zm], [ox + W + o, top + rise, zm], [ox + W + o, top, oz - o], [[0, 0], [0, 2], [W / 2, 2], [W / 2, 0]], col);
        K.quad(rm, [ox + W + o, top, oz + D + o], [ox + W + o, top + rise, zm], [ox - o, top + rise, zm], [ox - o, top, oz + D + o], [[0, 0], [0, 2], [W / 2, 2], [W / 2, 0]], col);
        for (const [x, s] of [[ox, -1], [ox + W, 1]]) {
            const p = s < 0 ? [[x, top, oz], [x, top, oz + D], [x, top + rise, zm], [x, top + rise, zm]] : [[x, top, oz + D], [x, top, oz], [x, top + rise, zm], [x, top + rise, zm]];
            K.quad(fm, ...p, [[0, 0], [D / rep, 0], [D / 2 / rep, rise / rep], [D / 2 / rep, rise / rep]], [g, g, g]);
        }
    } else {
        const xm = ox + W / 2;
        K.quad(rm, [ox - o, top, oz + D + o], [xm, top + rise, oz + D + o], [xm, top + rise, oz - o], [ox - o, top, oz - o], [[0, 0], [0, 2], [D / 2, 2], [D / 2, 0]], col);
        K.quad(rm, [ox + W + o, top, oz - o], [xm, top + rise, oz - o], [xm, top + rise, oz + D + o], [ox + W + o, top, oz + D + o], [[0, 0], [0, 2], [D / 2, 2], [D / 2, 0]], col);
        for (const [z, s] of [[oz, -1], [oz + D, 1]]) {
            const p = s < 0 ? [[ox + W, top, z], [ox, top, z], [xm, top + rise, z], [xm, top + rise, z]] : [[ox, top, z], [ox + W, top, z], [xm, top + rise, z], [xm, top + rise, z]];
            K.quad(fm, ...p, [[0, 0], [W / rep, 0], [W / 2 / rep, rise / rep], [W / 2 / rep, rise / rep]], [g, g, g]);
        }
    }
    // a chimney
    K.box(surface('brick'), ox + W * 0.7, top, oz + D * 0.3, 0.7, rise + 0.9, 0.7, [0.6, 0.55, 0.5], 2.6);
}

function addSign(group, b, x, y, z, n) {
    const t = signTexture(b.name, { bg: b.type === 'shop' ? '#2a231c' : '#1d1f20', fg: b.type === 'shop' ? '#d8c58c' : '#cfd3cc' });
    const w = Math.min(7, Math.max(3, b.name.length * 0.32));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.06 }));
    m.position.set(x + n[0] * 0.05, y, z + n[1] * 0.05);
    m.rotation.y = Math.atan2(n[0], n[1]);
    group.add(m);
}

function roofSign(group, b, x, y, z, text) {
    const t = signTexture(text, { w: 1024, h: 160, bg: null, fg: '#d6cdb2', font: 'bold 110px Georgia, serif' });
    const w = Math.min(b.w * 2 - 2, 24);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 1024), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.7, side: THREE.DoubleSide }));
    m.position.set(x, y + w * 80 / 1024, z + 1);
    group.add(m);
}

/** The Starlite Hotel's neon: a vertical blade over the door, VACANCY lit in red; the NO is dead. */
function vacancy(group, b, ox, oz, W, D, top, lights) {
    const t = signTexture('VACANCY', { w: 512, h: 128, bg: null, fg: '#ff3b4f', font: 'bold 96px Georgia, serif', neon: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), side: THREE.DoubleSide, depthWrite: false }));
    const e = b.entrances[0];
    const n = [[0, -1], [1, 0], [0, 1], [-1, 0]][e.dir];
    const ex = ox + (e.x + 0.5) * TILE + n[0] * 1.9, ez = oz + (e.z + 0.5) * TILE + n[1] * 1.9;
    m.scale.setScalar(1.3);
    m.position.set(ex, 3.6, ez);
    m.rotation.y = Math.atan2(n[0], n[1]);
    m.userData.neon = true;
    group.add(m);
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 7), new THREE.MeshStandardMaterial({ map: signTexture('STARLITE', { w: 128, h: 512, bg: '#191a1c', fg: '#bfc6c0', font: 'bold 60px Georgia, serif' }), side: THREE.DoubleSide }));
    blade.position.set(ex, 9, ez); blade.rotation.y = Math.atan2(n[0], n[1]) + Math.PI / 2;
    group.add(blade);
    lights.push({ x: ex, y: 4.2, z: ez, neon: true, color: 0xff3048 });
}
