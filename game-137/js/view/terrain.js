// The terrain as fine voxels. The sim's map is one-unit cells; here every cell is cut into 4x4
// columns of quarter-unit voxels whose heights follow a smooth surface through the neighbouring
// cells (so outcrops round off into slopes and mesas instead of standing as one-unit blocks),
// roughened by noise, with crystal shards, sandstone strata, lit windows on the city's towers,
// and small clutter (grass, pebbles, rubble) on open ground. The painted ground under it has no
// grid. Built in 16x16-cell chunks, each one mesh with only its visible faces, rebuilt when the
// sim breaks a cell in or next to it. Reads the world; never changes it.

import * as THREE from 'three';
import { MAP } from '../config.js';
import { MAT_LIST } from '../sim/world.js';
import { makeNoise } from '../sim/noise.js';
import { hash3 } from '../rng.js';
import { toon } from './models.js';

const SUB = 4;                 // fine voxels per cell, each way
const Q = 16;                  // geometry units per world unit (a fine voxel is 4 of them)
const VQ = Q / SUB;
const CH = 16;                 // cells per chunk, each way
const NX = Math.ceil(MAP.w / CH), NY = Math.ceil(MAP.h / CH);
const SW = MAP.w * SUB, SH = MAP.h * SUB;
const EDGE_H = 4.5;            // the map's rim stands taller than anything inside it

const lin = (hex) => new THREE.Color(hex);
/** Colours per sector: rock materials, the rim, the ground. */
const LOOK = {
    prairie: {
        crystal: { side: 0x46bfe6, top: 0x86e4ff }, stone: { side: 0x8a8f9e, top: 0x6f9a62 },
        edge: { side: 0x4b5a55, top: 0x4f7a55 }, hive: { side: 0xd23bff, top: 0xe070ff },
        ground: [0x3f6e4a, 0x528f5c, 0x7a7048], decor: [0x5fae58, 0x77c463, 0x4a9447, 0xf2e06a, 0xf08ab8, 0x9a9aa8],
    },
    canyon: {
        rust: { side: 0xb85c36, top: 0xd98a58 }, stone: { side: 0xb89c7e, top: 0xd2b894 },
        edge: { side: 0x6e3c2c, top: 0x9a5a3c }, hive: { side: 0xd23bff, top: 0xe070ff },
        ground: [0x8a5a3c, 0xa06d4a, 0x6e4a34], decor: [0x7a4a30, 0x9a6a48, 0x5c3a28, 0x7f8a4a, 0x6a7a3c, 0xb09070],
    },
    city: {
        neon: { side: 0x2c2852, top: 0x4a4290 }, stone: { side: 0x5e5d74, top: 0x75748c },
        edge: { side: 0x24203a, top: 0x34305a }, hive: { side: 0xd23bff, top: 0xe070ff },
        ground: [0x25273f, 0x30334f, 0x3a2c4a], decor: [0x55546a, 0x6c6b82, 0x44435a, 0x7a6cff, 0xff4fd8, 0x2ff0d0],
        windows: [0x7a6cff, 0xff4fd8, 0x2ff0d0, 0xffd23b],
    },
};

export class Terrain {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.material = toon({ vertexColors: true });
        this.chunks = new Array(NX * NY).fill(null);
        this.h = new Uint8Array(MAP.w * MAP.h);
        this.m = new Uint8Array(MAP.w * MAP.h);
        this.open0 = new Uint8Array(MAP.w * MAP.h);     // open at the start: only these get clutter
        this.dirty = new Set();
        this.c = new THREE.Color();
    }

    /** A new sortie: copy the map, pick the colours, build every chunk now. */
    reset(W, sector, seed) {
        this.look = LOOK[sector] || LOOK.prairie;
        this.sector = sector;
        this.noise = makeNoise(seed);
        this.cols = {};
        for (const [k, v] of Object.entries(this.look)) if (v && v.side) this.cols[k] = { side: lin(v.side), top: lin(v.top) };
        this.decor = this.look.decor.map(lin);
        this.windows = (this.look.windows || []).map(lin);
        for (let i = 0; i < this.h.length; i++) { this.h[i] = W.h[i]; this.m[i] = W.mat[i]; this.open0[i] = W.h[i] ? 0 : 1; }
        this.dirty.clear();
        for (let k = 0; k < this.chunks.length; k++) this.build(k);
    }

    /** Pick up cells the sim has broken since the last frame; rebuild a few chunks a frame. */
    sync(W, budget = 4) {
        for (let i = 0; i < this.h.length; i++) {
            if (W.h[i] === this.h[i] && W.mat[i] === this.m[i]) continue;
            this.h[i] = W.h[i]; this.m[i] = W.mat[i];
            // a cell shapes the slopes of its neighbours too
            const x = i % MAP.w, y = (i / MAP.w) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= MAP.w || ny >= MAP.h) continue;
                this.dirty.add(Math.floor(ny / CH) * NX + Math.floor(nx / CH));
            }
        }
        for (const k of this.dirty) {
            if (budget-- <= 0) break;
            this.dirty.delete(k);
            this.build(k);
        }
    }

    /** Visual height of a cell in world units (the rim is raised). */
    vh(x, y) {
        if (x < 0 || y < 0 || x >= MAP.w || y >= MAP.h) return EDGE_H;
        const i = y * MAP.w + x, h = this.h[i];
        if (!h) return 0;
        return MAT_LIST[this.m[i]] === 'edge' ? EDGE_H : h;
    }

    /** Height of fine column (sx, sy), in fine voxels. */
    subHeight(sx, sy) {
        if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return 99;
        const cx = (sx / SUB) | 0, cy = (sy / SUB) | 0, i = cy * MAP.w + cx, h = this.h[i];
        if (!h) return 0;
        const mat = MAT_LIST[this.m[i]];
        if (mat === 'hive') return h * SUB;
        if (mat === 'neon') {
            // towers keep straight walls; a ragged roofline and the odd vent
            const r = hash3(sx, sy, 41);
            return h * SUB + (r > 0.93 ? 2 : r > 0.8 ? 1 : 0) - (hash3(cx, cy, 43) > 0.7 && r < 0.3 ? 1 : 0);
        }
        const own = this.vh(cx, cy);
        // corner heights: the mean of the four cells meeting there
        const corner = (x, y) => (this.vh(x - 1, y - 1) + this.vh(x, y - 1) + this.vh(x - 1, y) + this.vh(x, y)) / 4;
        const fx = ((sx % SUB) + 0.5) / SUB, fy = ((sy % SUB) + 0.5) / SUB;
        const c00 = corner(cx, cy), c10 = corner(cx + 1, cy), c01 = corner(cx, cy + 1), c11 = corner(cx + 1, cy + 1);
        const b = c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy;
        let t = 0.62 * b + 0.38 * own;
        t += (this.noise.n2(sx * 0.17, sy * 0.17) - 0.5) * 0.9 + (hash3(sx, sy, 7) - 0.5) * 0.35;
        let top = Math.round((own + 0.5) * SUB);
        if (mat === 'crystal' && hash3(sx, sy, 11) > 0.93) { t += 0.6 + hash3(sx, sy, 12) * 0.9; top += 4; }
        return Math.max(2, Math.min(top, Math.round(t * SUB)));
    }

    /** Colour of the fine voxel at layer k of column (sx, sy) whose column is n tall, into this.c. */
    voxColor(mat, sx, sy, k, n, top, along) {
        const C = this.c, P = this.cols[mat] || this.cols.stone || this.cols.edge;
        const depth = n - 1 - k;
        if (top) C.copy(depth <= 0 ? P.top : P.side);
        else C.copy(P.side).lerp(P.top, depth === 0 ? 0.5 : 0);
        let f = 0.9 + 0.2 * hash3(sx, sy, k + 101);
        if (mat === 'rust' || (mat === 'stone' && this.sector === 'canyon') || mat === 'edge') {
            // strata: bands by height that wander a little across the map
            const band = (k + Math.floor(this.noise.n2(sx * 0.05, sy * 0.05) * 4)) % 5;
            f *= [1.0, 0.86, 1.1, 0.94, 0.8][band];
        }
        if (mat === 'crystal') f *= 0.85 + 0.3 * this.noise.n2(sx * 0.3 + k, sy * 0.3);
        if (!top && k < 2) f *= k === 0 ? 0.72 : 0.86;          // dark at the foot, as if in shadow
        if (mat === 'neon' && !top && this.windows.length && k < n - 2 && k % 4 !== 0 && k % 4 !== 3 && along % 3 !== 0 && hash3(sx + along, sy, k * 3) > 0.5) {
            C.copy(this.windows[Math.floor(hash3(sx >> 2, sy >> 2, k >> 2) * this.windows.length)]);
            f = 1;
        }
        C.multiplyScalar(f);
    }

    build(k) {
        const old = this.chunks[k];
        if (old) { this.group.remove(old); old.geometry.dispose(); this.chunks[k] = null; }
        const cx0 = (k % NX) * CH, cy0 = Math.floor(k / NX) * CH;
        const cw = Math.min(CH, MAP.w - cx0), cd = Math.min(CH, MAP.h - cy0);
        const sx0 = cx0 * SUB, sy0 = cy0 * SUB, sw = cw * SUB, sd = cd * SUB;
        // heights for the chunk plus a one-column margin
        const HW = sw + 2, hgt = new Int16Array(HW * (sd + 2));
        for (let y = -1; y <= sd; y++) for (let x = -1; x <= sw; x++) hgt[(y + 1) * HW + x + 1] = this.subHeight(sx0 + x, sy0 + y);
        const H = (x, y) => hgt[(y + 1) * HW + x + 1];

        const pos = [], nor = [], col = [], ind = [];
        const C = this.c;
        const quad = (verts, nx, ny, nz) => {
            const b = pos.length / 3;
            for (const v of verts) { pos.push(v[0], v[1], v[2]); nor.push(nx, ny, nz); col.push(Math.min(255, C.r * 255) | 0, Math.min(255, C.g * 255) | 0, Math.min(255, C.b * 255) | 0); }
            ind.push(b, b + 1, b + 2, b, b + 2, b + 3);
        };
        // the faces of box [x0,x1]x[y0,y1]x[z0,z1] (geometry units), wound to face outwards
        const face = (dir, x0, y0, z0, x1, y1, z1) => {
            switch (dir) {
                case 0: return quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], 0, 127, 0);
                case 1: return quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 127, 0, 0);
                case 2: return quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], -127, 0, 0);
                case 3: return quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0, 0, 127);
                case 4: return quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], 0, 0, -127);
            }
        };
        const SIDES = [[1, 0, 1], [-1, 0, 2], [0, 1, 3], [0, -1, 4]];
        for (let y = 0; y < sd; y++) for (let x = 0; x < sw; x++) {
            const n = H(x, y);
            const gx = sx0 + x, gy = sy0 + y;
            const X0 = x * VQ, Z0 = y * VQ, X1 = X0 + VQ, Z1 = Z0 + VQ;
            if (!n) { this.clutter(gx, gy, X0, Z0, face); continue; }
            const ci = ((gy / SUB) | 0) * MAP.w + ((gx / SUB) | 0);
            const mat = MAT_LIST[this.m[ci]] || 'stone';
            this.voxColor(mat, gx, gy, n - 1, n, true, 0);
            face(0, X0, 0, Z0, X1, n * VQ, Z1);
            for (const [dx, dy, dir] of SIDES) {
                const m = Math.min(n, H(x + dx, y + dy));
                const along = dx ? gy : gx;
                for (let l = m; l < n; l++) {
                    this.voxColor(mat, gx, gy, l, n, false, along);
                    face(dir, X0, l * VQ, Z0, X1, (l + 1) * VQ, Z1);
                }
            }
        }
        if (!ind.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Int16Array(pos), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nor), 3, true));
        g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(col), 3, true));
        g.setIndex(new THREE.BufferAttribute(new Uint32Array(ind), 1));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, this.material);
        mesh.position.set(cx0, 0, cy0);
        mesh.scale.setScalar(1 / Q);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.group.add(mesh);
        this.chunks[k] = mesh;
    }

    /** Grass, pebbles and rubble on ground that was open when the sortie began. */
    clutter(gx, gy, X0, Z0, face) {
        const ci = ((gy / SUB) | 0) * MAP.w + ((gx / SUB) | 0);
        if (!this.open0[ci]) return;
        const r = hash3(gx, gy, 211), D = this.decor, C = this.c;
        const ox = X0 + Math.floor(hash3(gx, gy, 212) * 3), oz = Z0 + Math.floor(hash3(gx, gy, 213) * 3);
        const patch = this.noise.n2(gx * 0.06, gy * 0.06);     // clumps, not an even sprinkle
        const box = (w, h, d, c) => {
            C.copy(c).multiplyScalar(0.9 + 0.2 * hash3(gx, gy, 214));
            for (let dir = 0; dir < 5; dir++) face(dir, ox, 0, oz, ox + w, h, oz + d);
        };
        if (this.sector === 'prairie') {
            if (r < 0.34 * patch) box(1, 3 + Math.floor(hash3(gx, gy, 215) * 4), 1, D[Math.floor(hash3(gx, gy, 216) * 3)]);
            else if (r > 0.985) box(1, 2, 1, D[3 + (hash3(gx, gy, 217) < 0.5 ? 0 : 1)]);
            else if (r > 0.97) box(2, 1, 2, D[5]);
        } else if (this.sector === 'canyon') {
            if (r < 0.09 * patch) box(2 + (hash3(gx, gy, 218) < 0.4 ? 1 : 0), 1 + (hash3(gx, gy, 219) < 0.3 ? 1 : 0), 2, D[Math.floor(hash3(gx, gy, 216) * 3)]);
            else if (r > 0.988) box(3, 2, 3, D[3 + (hash3(gx, gy, 217) < 0.5 ? 0 : 1)]);
            else if (r > 0.975) box(1, 1, 1, D[5]);
        } else {
            if (r < 0.07 * patch) box(2, 1, 2 + (hash3(gx, gy, 218) < 0.5 ? 1 : 0), D[Math.floor(hash3(gx, gy, 216) * 3)]);
            else if (r > 0.985) box(1, 1, 1, D[3 + Math.floor(hash3(gx, gy, 217) * 3)]);
        }
    }

    /** The ground under it all: layered noise in the sector's colours, darker at the foot of rock. */
    paintGround(W, sector) {
        const L = LOOK[sector] || LOOK.prairie, PX = 4;
        const c = document.createElement('canvas');
        c.width = MAP.w * PX; c.height = MAP.h * PX;
        const g = c.getContext('2d'), img = g.createImageData(c.width, c.height), d = img.data;
        const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
        const [a, b, dirt] = L.ground.map(rgb);
        // how much rock is round each cell, blurred, for the shading at the foot of slopes
        const near = new Float32Array(MAP.w * MAP.h);
        for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) {
            let s = 0, n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                n++;
                if (nx < 0 || ny < 0 || nx >= MAP.w || ny >= MAP.h || W.h[ny * MAP.w + nx] > 0) s++;
            }
            near[y * MAP.w + x] = s / n;
        }
        const nearAt = (x, y) => {
            const ix = Math.max(0, Math.min(MAP.w - 2, Math.floor(x - 0.5))), iy = Math.max(0, Math.min(MAP.h - 2, Math.floor(y - 0.5)));
            const fx = Math.max(0, Math.min(1, x - 0.5 - ix)), fy = Math.max(0, Math.min(1, y - 0.5 - iy));
            const i = iy * MAP.w + ix;
            return near[i] * (1 - fx) * (1 - fy) + near[i + 1] * fx * (1 - fy) + near[i + MAP.w] * (1 - fx) * fy + near[i + MAP.w + 1] * fx * fy;
        };
        const Nz = this.noise;
        for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
            const x = (px + 0.5) / PX, y = (py + 0.5) / PX;
            const n1 = Nz.fbm(x / 7, y / 7, 3);
            let t = Math.max(0, Math.min(1, (n1 - 0.35) / 0.3));
            let r = a[0] + (b[0] - a[0]) * t, gg = a[1] + (b[1] - a[1]) * t, bb = a[2] + (b[2] - a[2]) * t;
            const p = Nz.fbm(x / 16 + 40, y / 16 - 12, 2);
            if (p < 0.4) { const k = Math.min(1, (0.4 - p) * 5) * 0.6; r += (dirt[0] - r) * k; gg += (dirt[1] - gg) * k; bb += (dirt[2] - bb) * k; }
            const f = (1 - 0.32 * nearAt(x, y)) * (0.93 + 0.14 * hash3(px, py, 5));
            const o = (py * c.width + px) * 4;
            d[o] = r * f; d[o + 1] = gg * f; d[o + 2] = bb * f; d[o + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return c;
    }
}
