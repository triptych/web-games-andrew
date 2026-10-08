/**
 * world.js — builds the 3D world around a Track: terrain that rises and falls to meet the road, the
 * road itself, surface patches, barriers, bridges where the road leaves the ground, the start gantry
 * with its countdown lights, grandstands and crowds, coins, water, a far ring of mountains and every
 * prop at the trackside. dispose() frees it all for the next race.
 *
 * Ground height: away from the road it is the environment's natural land; within the barrier it is
 * the road's own surface extended sideways (so a jump is an earth mound and a banked turn is banked
 * ground), and in between the two blend smoothly. Where two parts of the road overlap (the bridge
 * of a figure eight) the lower one wins, so the upper one stands on a bridge.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENV_LOOK } from './envs.js';
import { roadTexture, detailTexture, patchTexture, checkerTexture, bannerTexture, tireTexture, softDot } from './textures.js';
import { PROPS } from './props.js';
import { Rng, fbm, hashStr } from '../rng.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);

// ------------------------------------------------------------------ track proximity
/** A spatial hash of the track's samples for "how far am I from the road" queries. */
export class TrackField {
    constructor(track) {
        this.t = track;
        this.cell = 16;
        this.map = new Map();
        for (let i = 0; i < track.N; i++) {
            const k = this.key(Math.floor(track.px[i] / this.cell), Math.floor(track.pz[i] / this.cell));
            let a = this.map.get(k);
            if (!a) this.map.set(k, (a = []));
            a.push(i);
        }
    }
    key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
    /** Calls fn(i, dist, lateral) for samples within r of (x, z). */
    each(x, z, r, fn) {
        const t = this.t, c = this.cell;
        const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
        const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
        for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
            const a = this.map.get(this.key(cx, cz));
            if (!a) continue;
            for (const i of a) {
                const dx = x - t.px[i], dz = z - t.pz[i];
                const d2 = dx * dx + dz * dz;
                if (d2 > r * r) continue;
                fn(i, Math.sqrt(d2), dx * -t.tz[i] + dz * t.tx[i]);
            }
        }
    }
    nearest(x, z, r = 60) {
        let best = Infinity, bi = -1, bd = 0;
        this.each(x, z, r, (i, d, lat) => { if (d < best) { best = d; bi = i; bd = lat; } });
        return { dist: best, i: bi, lat: bd };
    }
}

// ------------------------------------------------------------------ ground height
export function makeGround(track, look) {
    const field = new TrackField(track);
    const b = track.bounds;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const core = track.wall + 2;
    const blend = look.stadium ? 10 : 28;
    const land = look.land;
    const natural = (x, z) => land(x, z, Math.hypot(x - cx, z - cz));
    /** Height of the road surface extended sideways, at (x, z), measured from sample i's stretch. */
    function roadY(x, z, i) {
        const N = track.N;
        // Project onto the segment before or after i, whichever the point lies along.
        let best = null;
        for (const a of [(i - 1 + N) % N, i]) {
            const b = (a + 1) % N;
            const ex = track.px[b] - track.px[a], ez = track.pz[b] - track.pz[a];
            let f = ((x - track.px[a]) * ex + (z - track.pz[a]) * ez) / (ex * ex + ez * ez);
            if (f < -0.05 || f > 1.05) continue;
            f = Math.max(0, Math.min(1, f));
            const cxp = track.px[a] + ex * f, czp = track.pz[a] + ez * f;
            const l = Math.hypot(ex, ez) || 1;
            const lat = (x - cxp) * (-ez / l) + (z - czp) * (ex / l);
            const d2 = (x - cxp) ** 2 + (z - czp) ** 2;
            if (!best || d2 < best.d2) best = { d2, a, f, lat };
        }
        if (!best) { const lat = (x - track.px[i]) * -track.tz[i] + (z - track.pz[i]) * track.tx[i]; best = { a: i, f: 0, lat }; }
        return track.heightAt(best.a, best.f, Math.max(-core, Math.min(core, best.lat))) - 0.06;
    }
    // Two samples belong to different stretches of road (a crossing) when they are far apart along it.
    const apart = Math.ceil((core * 2 + 20) / track.ds);
    // height() leaves the distance to the nearest road sample here, for the terrain colours.
    const out = { dist: Infinity };
    function height(x, z) {
        let best = Infinity, bi = -1, blat = 0;
        out.dist = Infinity;
        const near = [];
        field.each(x, z, core + blend, (i, d, lat) => {
            if (d < best) { best = d; bi = i; blat = lat; }
            if (d < core) near.push(i);
        });
        out.dist = best;
        if (bi < 0) return natural(x, z);
        if (best < core) {
            let h = roadY(x, z, bi);
            // Under a bridge the lower road wins.
            for (const j of near) {
                if (Math.abs(track.delta(bi, j)) < apart) continue;
                const hj = roadY(x, z, j);
                if (hj < h) h = hj;
            }
            return h;
        }
        const nat = natural(x, z);
        const edge = track.heightAt(bi, 0, Math.sign(blat) * core) - 0.06;
        return edge + (nat - edge) * ss(core, core + blend, best);
    }
    return { field, height, natural, cx, cz, core, out };
}

// ------------------------------------------------------------------ the world
export class World {
    constructor(scene, track, envId, quality = 0) {
        this.scene = scene;
        this.track = track;
        this.env = envId;
        this.look = ENV_LOOK[envId];
        this.q = quality;
        this.group = new THREE.Group();
        this.group.name = 'world';
        scene.add(this.group);
        this.disposables = [];
        this.anim = [];             // per-frame callbacks (windmills, coins, crowd, water)
        this.uTime = { value: 0 };
        this.uCheer = { value: 0.3 };
        this.rng = new Rng(hashStr(track.id + envId));

        this.ground = makeGround(track, this.look);
        this.buildTerrain();
        this.buildRoad();
        this.buildPatches();
        this.buildBridges();
        this.buildBarriers();
        this.buildStart();
        this.buildCoins();
        if (this.look.water) this.buildWater();
        if (this.look.stadium) this.buildStadium();
        else this.buildMountains();
        this.buildProps();
        this.buildStands();
    }

    add(obj) { this.group.add(obj); return obj; }
    mat(m) { this.disposables.push(m); return m; }
    geo(g) { this.disposables.push(g); return g; }

    // -------------------------------------------------------------- terrain
    buildTerrain() {
        const tr = this.track, L = this.look, G = this.ground;
        const b = tr.bounds;
        const margin = L.stadium ? 90 : 300;
        const x0 = b.x0 - margin, x1 = b.x1 + margin, z0 = b.z0 - margin, z1 = b.z1 + margin;
        const cell = this.q >= 2 ? 6 : this.q === 1 ? 5 : 4;
        const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
        const pos = new Float32Array((nx + 1) * (nz + 1) * 3), col = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
        const hs = new Float32Array((nx + 1) * (nz + 1));
        const dists = new Float32Array((nx + 1) * (nz + 1));
        const cols = L.ground.map(C), sh = C(L.shoulder), rock = C(L.rock), tmp = new THREE.Color();
        const wl = L.water ? L.water.level : -Infinity;
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
            const k = j * (nx + 1) + i;
            const x = x0 + i * cell, z = z0 + j * cell;
            const h = G.height(x, z);
            hs[k] = h;
            dists[k] = G.out.dist;
            pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
            uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
        }
        // Colours: a noise blend of the palette, rock on steep ground, shoulder near the road.
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
            const k = j * (nx + 1) + i;
            const x = pos[k * 3], z = pos[k * 3 + 2], h = hs[k];
            const n1 = fbm(x / 60, z / 60, 7) * 0.5 + 0.5, n2 = fbm(x / 23, z / 23, 9) * 0.5 + 0.5;
            const a = cols[0], bb = cols[1], c3 = cols[2], d4 = cols[3];
            tmp.copy(a).lerp(bb, ss(0.35, 0.65, n1)).lerp(c3, ss(0.55, 0.8, n2) * 0.7).lerp(d4, ss(0.7, 0.9, n1 * n2 * 1.6) * 0.6);
            const hx = hs[k + (i < nx ? 1 : -1)] - h, hz = hs[k + (j < nz ? nx + 1 : -(nx + 1))] - h;
            const slope = Math.hypot(hx, hz) / cell;
            tmp.lerp(rock, ss(0.55, 1.1, slope));
            if (this.env === 'canyon' || this.env === 'mesa') {
                // Strata: bands of colour by height on the mesas.
                const band = Math.sin(h * 0.9) * 0.5 + 0.5;
                tmp.lerp(rock, ss(4, 12, h) * band * 0.45);
            }
            if (this.env === 'frost' && slope > 0.9) tmp.lerp(rock, 0.4);
            const nd = dists[k];
            if (nd < G.core + 8) tmp.lerp(sh, (1 - ss(G.core - 2, G.core + 8, nd)) * 0.85);
            if (h < wl + 0.3) tmp.multiplyScalar(0.55);
            col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
        }
        const idx = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const a = j * (nx + 1) + i, b2 = a + 1, c = a + nx + 1, d = c + 1;
            idx.push(a, c, b2, b2, c, d);
        }
        const g = this.geo(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = this.mat(new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 0.97, metalness: 0 }));
        const mesh = this.add(new THREE.Mesh(g, m));
        mesh.receiveShadow = true;
        mesh.name = 'terrain';
        this.terrain = { x0, z0, cell, nx, nz, hs };
    }

    /** Ground height from the built terrain grid (bilinear), for props and the camera. */
    groundY(x, z) {
        const T = this.terrain;
        const fx = (x - T.x0) / T.cell, fz = (z - T.z0) / T.cell;
        const i = Math.max(0, Math.min(T.nx - 1, Math.floor(fx))), j = Math.max(0, Math.min(T.nz - 1, Math.floor(fz)));
        const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j));
        const w = T.nx + 1, h = T.hs;
        const a = h[j * w + i], b = h[j * w + i + 1], c = h[(j + 1) * w + i], d = h[(j + 1) * w + i + 1];
        // Match the triangulation (a, c, b) / (b, c, d).
        if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
        return d + (c - d) * (1 - u) + (b - d) * (1 - v);
    }

    // -------------------------------------------------------------- road
    ribbon(i0, n, dA, dB, cols, lift, vScale, closed) {
        const tr = this.track, N = tr.N;
        const rows = closed ? N + 1 : n + 1;
        const pos = new Float32Array(rows * (cols + 1) * 3), uv = new Float32Array(rows * (cols + 1) * 2);
        let s = 0;
        for (let r = 0; r < rows; r++) {
            const i = (i0 + r) % N;
            for (let c = 0; c <= cols; c++) {
                const d = dA + (dB - dA) * (c / cols);
                const p = tr.pointAt(i, 0, d);
                const k = r * (cols + 1) + c;
                pos[k * 3] = p.x; pos[k * 3 + 1] = p.y + lift; pos[k * 3 + 2] = p.z;
                uv[k * 2] = c / cols; uv[k * 2 + 1] = closed ? s / vScale : r / (rows - 1);
            }
            s += tr.ds;
        }
        const idx = [];
        for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
            const a = r * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1;
            idx.push(a, b, cc, b, d, cc);
        }
        const g = this.geo(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    buildRoad() {
        const tr = this.track;
        const w = tr.hw + 0.8;
        // The texture is 1:2, so one repeat covers twice the road's width.
        const g = this.ribbon(0, tr.N, -w, w, 10, 0.05, w * 4, true);
        // Fix the seam: the closing row's v must continue the count, which ribbon() already does.
        const m = this.mat(new THREE.MeshStandardMaterial({ map: roadTexture(this.look), roughness: 0.93, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
        const mesh = this.add(new THREE.Mesh(g, m));
        mesh.receiveShadow = true;
        mesh.name = 'road';
    }

    buildPatches() {
        const tr = this.track;
        for (const p of tr.patches) {
            const dA = Math.max(-tr.hw - 0.4, (p.lat || 0) - p.w), dB = Math.min(tr.hw + 0.4, (p.lat || 0) + p.w);
            const g = this.ribbon(p.i0, p.n, dA, dB, 6, 0.09, 1, false);
            const tint = { mud: 0xffffff, water: 0xffffff, ice: 0xffffff }[p.type] || 0xffffff;
            const m = this.mat(new THREE.MeshStandardMaterial({
                map: patchTexture(p.type), color: tint, transparent: true, depthWrite: false,
                roughness: { mud: 0.3, water: 0.06, ice: 0.08, gravel: 0.95, sand: 0.95, plank: 0.8, snow: 0.9, oil: 0.04 }[p.type] ?? 0.9,
                metalness: { water: 0.25, ice: 0.15, oil: 0.6 }[p.type] ?? 0,
                polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
            }));
            const mesh = this.add(new THREE.Mesh(g, m));
            mesh.receiveShadow = true;
            mesh.renderOrder = 1;
            if (p.type === 'water') this.anim.push((t) => { m.map.offset.y = (t * 0.05) % 1; });
        }
    }

    // -------------------------------------------------------------- bridges
    buildBridges() {
        const tr = this.track, N = tr.N;
        this.bridge = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            const gy = this.groundY(tr.px[i], tr.pz[i]);
            if (tr.py[i] - gy > 1.4) this.bridge[i] = 1;
        }
        // Grow each run a little so the deck reaches solid ground.
        const grown = this.bridge.slice();
        for (let i = 0; i < N; i++) if (this.bridge[i]) for (let k = -3; k <= 3; k++) grown[(i + k + N) % N] = 1;
        this.bridge = grown;
        const runs = [];
        for (let i = 0; i < N; i++) {
            if (this.bridge[i] && !this.bridge[(i - 1 + N) % N]) {
                let n = 0;
                while (this.bridge[(i + n) % N] && n < N) n++;
                runs.push([i, n]);
            }
        }
        if (!runs.length) return;
        const steel = this.env === 'dome' || this.env === 'mesa';
        const deckCol = steel ? 0x3a3e46 : 0x7a5434, railCol = steel ? (this.env === 'mesa' ? 0xd4a63a : 0xd8dde4) : 0x5a3a20;
        const deckM = this.mat(new THREE.MeshStandardMaterial({ color: deckCol, roughness: 0.8, metalness: steel ? 0.5 : 0 }));
        const railM = this.mat(new THREE.MeshStandardMaterial({ color: railCol, roughness: 0.5, metalness: steel ? 0.7 : 0 }));
        const W = tr.wall + 0.5;
        const parts = [], rails = [];
        for (const [i0, n] of runs) {
            // Deck slab: top face, two sides and the underside, as one ribbon each.
            for (const [dA, dB, lift] of [[-W, W, 0.0], [-W, W, -0.9]]) {
                const g = this.ribbon(i0, n, dA, dB, 4, lift, 1, false);
                if (lift < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
                parts.push(g);
            }
            for (const side of [-1, 1]) {
                // Vertical skirt along each edge.
                const pos = [], idx = [];
                for (let r = 0; r <= n; r++) {
                    const p = tr.pointAt((i0 + r) % N, 0, side * W);
                    pos.push(p.x, p.y, p.z, p.x, p.y - 0.9, p.z);
                    if (r < n) { const a = r * 2; side > 0 ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                g.setIndex(idx);
                g.computeVertexNormals();
                g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
                parts.push(g);
                // Railing: posts and a top rail.
                for (let r = 0; r <= n; r += 2) {
                    const i = (i0 + r) % N;
                    const p = tr.pointAt(i, 0, side * (tr.wall + 0.2));
                    const post = new THREE.BoxGeometry(0.2, 1.1, 0.2);
                    post.translate(p.x, p.y + 0.55, p.z);
                    rails.push(post);
                }
                for (let r = 0; r < n; r++) {
                    const i = (i0 + r) % N, j = (i + 1) % N;
                    const a = tr.pointAt(i, 0, side * (tr.wall + 0.2)), b = tr.pointAt(j, 0, side * (tr.wall + 0.2));
                    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
                    const rail = new THREE.BoxGeometry(0.16, 0.16, len + 0.05);
                    const m4 = new THREE.Matrix4().lookAt(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z), new THREE.Vector3(0, 1, 0));
                    m4.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.05, (a.z + b.z) / 2);
                    rail.applyMatrix4(m4);
                    rails.push(rail);
                }
            }
            // Pillars down to the ground.
            for (let r = 2; r < n - 1; r += 5) {
                const i = (i0 + r) % N;
                for (const side of [-0.7, 0.7]) {
                    const p = tr.pointAt(i, 0, side * W);
                    const gy = this.groundY(p.x, p.z);
                    const h = p.y - 0.9 - gy;
                    if (h < 0.5) continue;
                    const pil = new THREE.BoxGeometry(steel ? 0.8 : 0.6, h + 0.6, steel ? 0.8 : 0.6);
                    pil.translate(p.x, gy + h / 2 - 0.3, p.z);
                    rails.push(pil);
                }
            }
        }
        const strip = (g) => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k); return o; };
        const deck = this.add(new THREE.Mesh(this.geo(mergeGeometries(parts.map(strip))), deckM));
        deck.castShadow = deck.receiveShadow = true;
        const rail = this.add(new THREE.Mesh(this.geo(mergeGeometries(rails.map(strip))), railM));
        rail.castShadow = true;
    }

    // -------------------------------------------------------------- barriers
    buildBarriers() {
        const tr = this.track, N = tr.N, L = this.look;
        const kinds = L.barrier;
        const groups = new Map();
        const put = (kind, m4, color) => {
            let gp = groups.get(kind);
            if (!gp) groups.set(kind, (gp = []));
            gp.push([m4, color]);
        };
        const startZone = (i) => Math.abs(tr.delta(i, tr.startI)) < 3;
        const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
        for (const side of [-1, 1]) {
            const kind = kinds[side < 0 ? 0 : 1];
            const spacing = { tires: 1.3, hay: 2.6, logs: 4, fence: 3, rocks: 2.2, posts: 3, snowbank: 3, netting: 3, tuff: 2.1, raven: 3 }[kind] || 3;
            const step = Math.max(1, Math.round(spacing / tr.ds));
            for (let i = 0; i < N; i += step) {
                if (this.bridge[i] || startZone(i)) continue;
                const d = side * (tr.wall + 0.5);
                const p = tr.pointAt(i, 0, d);
                const y = Math.min(p.y, this.groundY(p.x, p.z) + 0.05);
                q.setFromAxisAngle(up, tr.head[i]);
                const r = this.rng.next();
                const sc = kind === 'rocks' ? 0.8 + r * 0.9 : 1;
                tmpM.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(sc, sc * (kind === 'rocks' ? 0.7 + r * 0.4 : 1), sc));
                const alt = ((i / step) | 0) % 2;
                put(kind, tmpM.clone(), alt);
            }
        }
        for (const [kind, list] of groups) {
            const def = BARRIERS[kind];
            if (!def) continue;
            const { geo, mat } = def(this);
            this.geo(geo); this.mat(mat);
            const im = new THREE.InstancedMesh(geo, mat, list.length);
            const colA = new THREE.Color(1, 1, 1), colB = new THREE.Color(...(BARRIER_ALT[kind] || [1, 1, 1]));
            list.forEach(([m4, alt], k) => { im.setMatrixAt(k, m4); im.setColorAt(k, alt ? colB : colA); });
            im.castShadow = true;
            im.receiveShadow = true;
            this.add(im);
        }
    }

    // -------------------------------------------------------------- start / finish
    buildStart() {
        const tr = this.track, i = tr.startI, L = this.look;
        const p = tr.pointAt(i, 0, 0);
        const h = tr.head[i];
        const grp = new THREE.Group();
        grp.position.set(p.x, p.y, p.z);
        grp.rotation.y = h;
        this.add(grp);
        const W = tr.wall + 0.9;
        const pillarCol = { dome: 0x2a2a34, mesa: 0x15161a, frost: 0xd8322a }[this.env] ?? 0x3a2a1c;
        const pm = this.mat(new THREE.MeshStandardMaterial({ color: pillarCol, roughness: 0.6, metalness: 0.3 }));
        for (const s of [-1, 1]) {
            const pil = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1, 8, 1)), pm);
            pil.position.set(-s * W, 4, 0);
            pil.castShadow = true;
            grp.add(pil);
        }
        const beam = new THREE.Mesh(this.geo(new THREE.BoxGeometry(W * 2 + 1, 1.6, 0.8)), pm);
        beam.position.set(0, 8, 0);
        beam.castShadow = true;
        grp.add(beam);
        const sponsor = { flats: ['DUSTWATER', 'ROOKIE CUP'], woods: ['PINECREST', 'TIMBERLINE TROPHY'], canyon: ['REDROCK', 'SUNSET SIZZLER'], bayou: ['GATORBACK', 'MUDBUG JUBILEE'], frost: ['FROSTBITE', 'ICE CROWN'], dome: ['THUNDERDOME', 'NIGHT OF THUNDER'], mesa: ['RAVENWOOD', 'THE DIRT CROWN'] }[this.env];
        const bannerCol = this.env === 'mesa' ? [0x111216, 0xe0b23c] : this.env === 'dome' ? [0x14082a, 0x39f0ff] : [0xf4ecd8, 0xb8321e];
        const bt = bannerTexture(sponsor[0], bannerCol[0], bannerCol[1], 1024, 160, sponsor[1]);
        for (const side of [1, -1]) {
            const bm = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(W * 2 - 1, 1.5)), this.mat(new THREE.MeshBasicMaterial({ map: bt, toneMapped: false })));
            bm.position.set(0, 8, side * 0.41);
            if (side < 0) bm.rotation.y = Math.PI;
            grp.add(bm);
        }
        // Countdown lights: five lamps that go red, red, red ... green.
        this.lights = [];
        for (let k = 0; k < 5; k++) {
            const m = this.mat(new THREE.MeshBasicMaterial({ color: 0x220806, toneMapped: false }));
            const lamp = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.42, 20)), m);
            lamp.position.set((k - 2) * 1.2, 6.6, -0.45);
            lamp.rotation.y = Math.PI;
            grp.add(lamp);
            this.lights.push(m);
        }
        const housing = new THREE.Mesh(this.geo(new THREE.BoxGeometry(6.6, 1.3, 0.4)), pm);
        housing.position.set(0, 6.6, -0.2);
        grp.add(housing);
        // Checkered line across the road.
        const cg = this.ribbon(i, 1, -tr.hw, tr.hw, 1, 0.1, 1, false);
        const cm = this.mat(new THREE.MeshStandardMaterial({ map: checkerTexture(12), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        this.add(new THREE.Mesh(cg, cm)).receiveShadow = true;
        // Flags on poles along the start straight.
        const flagCols = { mesa: [0x111216, 0xe0b23c], dome: [0xff3fa4, 0x39f0ff] }[this.env] || [0xd8322a, 0xf2f2f2, 0x2f6be0, 0xf5c518];
        const poleG = this.geo(new THREE.CylinderGeometry(0.06, 0.06, 6, 6));
        const poleM = this.mat(new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.4 }));
        const flagG = this.geo(new THREE.PlaneGeometry(1.6, 1, 6, 1));
        flagG.translate(0.8, 0, 0);
        for (let k = -7; k <= 7; k++) {
            if (!k) continue;
            const ii = tr.wrap(i + k * 4);
            for (const s of [-1, 1]) {
                const pp = tr.pointAt(ii, 0, s * (tr.wall + 2.2));
                const y = this.groundY(pp.x, pp.z);
                const pole = new THREE.Mesh(poleG, poleM);
                pole.position.set(pp.x, y + 3, pp.z);
                this.add(pole);
                const fm = this.mat(new THREE.MeshStandardMaterial({ color: flagCols[(k + 7 + (s > 0 ? 1 : 0)) % flagCols.length], side: THREE.DoubleSide, roughness: 0.8 }));
                const flag = new THREE.Mesh(flagG, fm);
                flag.position.set(pp.x, y + 5.4, pp.z);
                flag.rotation.y = tr.head[ii] + Math.PI / 2;
                this.add(flag);
                const ph = k * 0.7 + s;
                this.anim.push((t) => { flag.rotation.y = tr.head[ii] + Math.PI / 2 + Math.sin(t * 2.3 + ph) * 0.35; flag.scale.y = 1 + Math.sin(t * 5 + ph) * 0.06; });
            }
        }
    }

    /** n lamps lit: 0..5 red, or 'go' for all green, or 'off'. */
    setLights(state) {
        if (!this.lights) return;
        this.lights.forEach((m, k) => {
            if (state === 'go') m.color.setHex(0x30ff60);
            else if (state === 'off') m.color.setHex(0x220806);
            else m.color.setHex(k < state ? 0xff2a1a : 0x220806);
        });
    }

    // -------------------------------------------------------------- coins
    buildCoins() {
        const tr = this.track;
        const n = tr.coins.length;
        if (!n) return;
        const g = this.geo(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20));
        g.rotateX(Math.PI / 2);
        const m = this.mat(new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.85, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.6 }));
        const im = new THREE.InstancedMesh(g, m, n);
        im.castShadow = true;
        this.coinMesh = this.add(im);
        this.coinTaken = new Uint8Array(n);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), s0 = new THREE.Vector3(0, 0, 0), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        this.anim.push((t) => {
            for (let k = 0; k < n; k++) {
                const c = tr.coins[k];
                q.setFromAxisAngle(up, t * 3 + k * 0.4);
                v.set(c.x, c.y + Math.sin(t * 3 + k) * 0.15, c.z);
                m4.compose(v, q, this.coinTaken[k] ? s0 : s1);
                im.setMatrixAt(k, m4);
            }
            im.instanceMatrix.needsUpdate = true;
        });
    }
    takeCoin(k) { if (this.coinTaken) this.coinTaken[k] = 1; }
    resetCoins() { if (this.coinTaken) this.coinTaken.fill(0); }

    // -------------------------------------------------------------- water
    buildWater() {
        const L = this.look, b = this.track.bounds;
        const W = (b.x1 - b.x0) + 700, H = (b.z1 - b.z0) + 700;
        const g = this.geo(new THREE.PlaneGeometry(W, H, 1, 1));
        g.rotateX(-Math.PI / 2);
        const m = this.mat(new THREE.ShaderMaterial({
            transparent: true, fog: true,
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCol: { value: C(L.water.col) }, uDeep: { value: C(L.water.deep) }, uSky: { value: C(L.skyHor) } }]),
            vertexShader: `varying vec3 vW; varying vec3 vV;
                #include <fog_pars_vertex>
                void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vV = cameraPosition - w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
                }`,
            fragmentShader: `uniform float uTime; uniform vec3 uCol, uDeep, uSky; varying vec3 vW; varying vec3 vV;
                #include <fog_pars_fragment>
                float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
                float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
                void main(){
                    vec2 p = vW.xz * 0.35;
                    float r = n(p + uTime*0.3) + n(p*2.3 - uTime*0.4)*0.5;
                    vec3 v = normalize(vV);
                    float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
                    vec3 c = mix(uDeep, uCol, 0.35 + r*0.25);
                    c = mix(c, uSky, fr * 0.65);
                    c += vec3(1.0, 0.85, 0.6) * pow(max(0.0, r - 1.15), 2.0) * 0.6;
                    gl_FragColor = vec4(c, 0.9);
                    #include <fog_fragment>
                }`,
        }));
        const mesh = this.add(new THREE.Mesh(g, m));
        mesh.position.set((b.x0 + b.x1) / 2, L.water.level, (b.z0 + b.z1) / 2);
        mesh.renderOrder = 2;
        this.anim.push((t) => { m.uniforms.uTime.value = t; });
    }

    // -------------------------------------------------------------- horizon
    buildMountains() {
        const L = this.look, b = this.track.bounds;
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const R = Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 720;
        const segs = 160, pos = [], col = [], idx = [];
        const base = C(L.mountains), top = base.clone().lerp(C(this.env === 'frost' ? 0xffffff : L.skyHor), this.env === 'frost' ? 0.8 : 0.25);
        for (let k = 0; k <= segs; k++) {
            const a = (k / segs) * Math.PI * 2;
            const n = fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, hashStr(this.env) & 255, 4) * 0.5 + 0.5;
            const h = 60 + n * n * 260 * (this.env === 'frost' ? 1.4 : this.env === 'flats' ? 0.5 : 1);
            const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
            pos.push(x, -40, z, x, h, z);
            col.push(base.r, base.g, base.b, top.r, top.g, top.b);
            if (k < segs) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
        }
        const g = this.geo(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = this.mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }));
        this.add(new THREE.Mesh(g, m)).name = 'mountains';
    }

    // -------------------------------------------------------------- props
    buildProps() {
        const tr = this.track, L = this.look, G = this.ground;
        const wl = L.water ? L.water.level : -Infinity;
        const N = tr.N, rng = this.rng;
        const dens = this.q >= 2 ? 0.55 : this.q === 1 ? 0.8 : 1;
        for (const [type, count0, near, far, mode] of L.props) {
            const def = PROPS[type];
            if (!def || !count0) continue;
            const built = def(rng);
            const count = Math.max(1, Math.round(count0 * dens));
            const mats = [];
            const place = (x, z, rot, sc) => {
                const y = this.groundY(x, z);
                if (mode === 'water' ? y > wl - 0.25 : y < wl + 0.15) return false;
                const nr = G.field.nearest(x, z, tr.wall + 4 + built.r);
                if (nr.dist < tr.wall + 1 + built.r * sc) return false;
                const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, mode === 'water' && built.float ? wl + 0.02 : y - (built.sink || 0) * sc, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(sc, sc, sc));
                mats.push(m4);
                return true;
            };
            let tries = 0;
            while (mats.length < count && tries++ < count * 25) {
                const i = rng.int(N), side = rng.next() < 0.5 ? -1 : 1;
                const dist = tr.wall + Math.max(near, built.r + 1.2) + (far - near) * Math.pow(rng.next(), 1.6);
                const p = tr.pointAt(i, rng.next(), side * dist);
                const sc = (built.scale || [0.8, 1.25])[0] + rng.next() * ((built.scale || [0.8, 1.25])[1] - (built.scale || [0.8, 1.25])[0]);
                const rot = built.face ? tr.head[i] + (side > 0 ? -Math.PI / 2 : Math.PI / 2) : rng.next() * Math.PI * 2;
                if (mode === 'cluster') {
                    const k = 4 + rng.int(8);
                    for (let c = 0; c < k && mats.length < count; c++) place(p.x + (rng.next() - 0.5) * 14, p.z + (rng.next() - 0.5) * 14, rng.next() * 6.28, sc * (0.8 + rng.next() * 0.4));
                } else place(p.x, p.z, rot, sc);
            }
            if (!mats.length) continue;
            for (const [geo, mat, opts] of built.parts) {
                this.geo(geo);
                const im = new THREE.InstancedMesh(geo, mat, mats.length);
                mats.forEach((m4, k) => im.setMatrixAt(k, m4));
                im.castShadow = built.shadow !== false && this.q < 2;
                im.receiveShadow = true;
                this.add(im);
                if (opts && opts.spin) {
                    const s = opts.spin, T = new THREE.Matrix4().makeTranslation(s.x, s.y, s.z), R = new THREE.Matrix4(), M = new THREE.Matrix4();
                    const phase = mats.map(() => rng.next() * 6.28);
                    this.anim.push((t) => {
                        mats.forEach((m4, k) => {
                            R.makeRotationZ(t * s.speed + phase[k]);
                            M.multiplyMatrices(m4, T).multiply(R);
                            im.setMatrixAt(k, M);
                        });
                        im.instanceMatrix.needsUpdate = true;
                    });
                }
            }
            if (built.glow) {
                const gm = new THREE.SpriteMaterial({ map: softDot(), color: built.glow.col, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
                this.mat(gm);
                const v = new THREE.Vector3();
                mats.forEach((m4) => {
                    const sp = new THREE.Sprite(gm);
                    v.set(built.glow.x, built.glow.y, built.glow.z).applyMatrix4(m4);
                    sp.position.copy(v);
                    sp.scale.set(built.glow.size, built.glow.size, 1);
                    this.add(sp);
                });
            }
        }
    }

    // -------------------------------------------------------------- grandstands and crowds
    buildStands() {
        const tr = this.track, L = this.look;
        if (L.stadium || !L.crowd) return;
        const people = [];
        const standM = this.mat(new THREE.MeshStandardMaterial({ color: this.env === 'mesa' ? 0x22232a : 0x8a6a48, roughness: 0.8 }));
        const roofM = this.mat(new THREE.MeshStandardMaterial({ color: this.env === 'mesa' ? 0xd4a63a : 0xb8321e, roughness: 0.7 }));
        const placeStand = (i, side, len) => {
            const d = side * (tr.wall + 7);
            const p = tr.pointAt(i, 0, d);
            const y = this.groundY(p.x, p.z);
            const grp = new THREE.Group();
            grp.position.set(p.x, y, p.z);
            grp.rotation.y = tr.head[i] + (side > 0 ? Math.PI : 0);
            for (let r = 0; r < 5; r++) {
                const step = new THREE.Mesh(this.geo(new THREE.BoxGeometry(len, 0.8, 1.6)), standM);
                step.position.set(0, 0.4 + r * 0.8, -r * 1.6 + 0.8);
                step.scale.y = 1 + r;
                step.position.y = (r + 1) * 0.4;
                step.castShadow = step.receiveShadow = true;
                grp.add(step);
                for (let s = -len / 2 + 0.6; s < len / 2 - 0.4; s += 0.75) {
                    if (this.rng.next() < 0.18) continue;
                    people.push({ grp, x: s + (this.rng.next() - 0.5) * 0.2, y: (r + 1) * 0.8 + 0.1, z: -r * 1.6 + 0.8 });
                }
            }
            const roof = new THREE.Mesh(this.geo(new THREE.BoxGeometry(len + 1, 0.25, 9)), roofM);
            roof.position.set(0, 7.5, -3.2);
            roof.rotation.x = -0.12;
            roof.castShadow = true;
            grp.add(roof);
            for (const s of [-1, 1]) {
                const post = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.3, 7.5, 0.3)), standM);
                post.position.set(s * len / 2, 3.75, -7);
                grp.add(post);
            }
            this.add(grp);
            grp.updateMatrixWorld(true);
        };
        const n = Math.round(L.crowd * 2) + 1;
        for (let k = 0; k < n; k++) {
            const i = tr.wrap(tr.startI + (k - (n >> 1)) * 14);
            if (this.bridge[i]) continue;
            placeStand(i, k % 2 ? -1 : 1, 22);
        }
        this.buildCrowd(people.map((p) => {
            const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(p.grp.matrixWorld);
            return [v.x, v.y, v.z, p.grp.rotation.y];
        }));
    }

    /** Instanced spectators that bounce when they cheer. */
    buildCrowd(spots) {
        if (!spots.length) return;
        const body = new THREE.CapsuleGeometry(0.22, 0.5, 2, 6);
        body.translate(0, 0.47, 0);
        const head = new THREE.SphereGeometry(0.18, 8, 6);
        head.translate(0, 1.05, 0);
        const g = this.geo(mergeGeometries([body.toNonIndexed(), head.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })));
        const m = this.mat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
        const uT = this.uTime, uC = this.uCheer;
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = uT; sh.uniforms.uCheer = uC;
            sh.vertexShader = 'uniform float uTime; uniform float uCheer;\n' + sh.vertexShader.replace('#include <begin_vertex>',
                '#include <begin_vertex>\n float ph = float(gl_InstanceID) * 1.731; transformed.y += abs(sin(uTime * (5.0 + mod(ph, 3.0)) + ph)) * 0.32 * uCheer;');
        };
        const im = new THREE.InstancedMesh(g, m, spots.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
        const shirts = [0xd8322a, 0x2f6be0, 0xf5c518, 0x3bbd5b, 0xf2f2f2, 0xff73b3, 0xff8a1f, 0x7a3fc4, 0x15161a, 0x40c8e0];
        spots.forEach(([x, y, z, ry], k) => {
            q.setFromAxisAngle(up, ry);
            m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 0.9 + this.rng.next() * 0.25, 1));
            im.setMatrixAt(k, m4);
            im.setColorAt(k, col.setHex(shirts[this.rng.int(shirts.length)]));
        });
        this.add(im);
    }

    // -------------------------------------------------------------- the Thunderdome
    buildStadium() {
        const tr = this.track, b = tr.bounds;
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const rx = (b.x1 - b.x0) / 2 + tr.wall + 22, rz = (b.z1 - b.z0) / 2 + tr.wall + 22;
        const rows = 14, segs = 96;
        const standM = this.mat(new THREE.MeshStandardMaterial({ color: 0x2a2c3a, roughness: 0.9 }));
        const pos = [], idx = [];
        for (let r = 0; r <= rows; r++) for (let k = 0; k <= segs; k++) {
            const a = (k / segs) * Math.PI * 2;
            const grow = 1 + r * 0.045;
            pos.push(cx + Math.cos(a) * rx * grow, 1.5 + r * 1.3, cz + Math.sin(a) * rz * grow);
        }
        for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) {
            const a = r * (segs + 1) + k, bq = a + 1, c = a + segs + 1, d = c + 1;
            idx.push(a, bq, c, bq, d, c);
        }
        const g = this.geo(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const bowl = this.add(new THREE.Mesh(g, standM));
        bowl.material.side = THREE.DoubleSide;
        bowl.receiveShadow = true;
        // Front wall with sponsor boards.
        const wallG = this.geo(new THREE.CylinderGeometry(1, 1, 2, segs, 1, true));
        const wall = this.add(new THREE.Mesh(wallG, this.mat(new THREE.MeshStandardMaterial({ map: bannerTexture('THUNDERDOME  ★  NIGHT OF THUNDER  ★', 0x0c0820, 0x39f0ff, 1024, 64), side: THREE.DoubleSide, emissive: 0x112244, emissiveIntensity: 0.4 }))));
        wall.scale.set(rx * 0.995, 1, rz * 0.995);
        wall.position.set(cx, 1, cz);
        wall.material.map.wrapS = THREE.RepeatWrapping;
        wall.material.map.repeat.set(8, 1);
        // Crowd on the rows.
        const spots = [];
        const step = this.q >= 2 ? 3 : this.q === 1 ? 2 : 1;
        for (let r = 0; r < rows; r += 1) for (let k = 0; k < segs * 4; k += step) {
            if (this.rng.next() < 0.15) continue;
            const a = (k / (segs * 4)) * Math.PI * 2;
            const grow = 1 + (r + 0.5) * 0.045;
            spots.push([cx + Math.cos(a) * rx * grow, 1.5 + (r + 0.5) * 1.3 - 0.6, cz + Math.sin(a) * rz * grow, Math.atan2(-Math.cos(a) * rz, -Math.sin(a) * rx) + Math.PI]);
        }
        this.buildCrowd(spots.map(([x, y, z]) => [x, y, z, Math.atan2(cx - x, cz - z)]));
        // Light towers with glowing lamp heads.
        const glowM = this.mat(new THREE.SpriteMaterial({ map: softDot(), color: 0xdfe8ff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        const towerM = this.mat(new THREE.MeshStandardMaterial({ color: 0x5a5e6a, metalness: 0.7, roughness: 0.4 }));
        const headM = this.mat(new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false }));
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + 0.2;
            const x = cx + Math.cos(a) * rx * 1.75, z = cz + Math.sin(a) * rz * 1.75;
            const tower = this.add(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.6, 1.0, 46, 8)), towerM));
            tower.position.set(x, 23, z);
            const head = this.add(new THREE.Mesh(this.geo(new THREE.BoxGeometry(7, 3.5, 1)), headM));
            head.position.set(x, 47, z);
            head.lookAt(cx, 0, cz);
            const sp = new THREE.Sprite(glowM);
            sp.position.set(x, 47, z);
            sp.scale.set(30, 30, 1);
            this.add(sp);
        }
        // Jumbotron.
        const jt = this.add(new THREE.Mesh(this.geo(new THREE.BoxGeometry(30, 14, 1.5)), this.mat(new THREE.MeshBasicMaterial({ map: bannerTexture('MAX VOLT', 0x14082a, 0xff3fa4, 512, 256, 'NIGHT OF THUNDER'), toneMapped: false }))));
        jt.position.set(cx, 34, cz - rz * 1.45);
        jt.lookAt(cx, 20, cz);
        // Neon ring around the arena rim.
        const ring = this.add(new THREE.Mesh(this.geo(new THREE.TorusGeometry(1, 0.008, 6, 128)), this.mat(new THREE.MeshBasicMaterial({ color: 0xff3fa4, toneMapped: false }))));
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(rx * 1.64, rz * 1.64, 30);
        ring.position.set(cx, 1.5 + rows * 1.3 + 1, cz);
        // A dark floor under the whole arena so nothing shows through past the stands.
        const fl = this.add(new THREE.Mesh(this.geo(new THREE.PlaneGeometry(rx * 6, rz * 6)), this.mat(new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 1 }))));
        fl.rotation.x = -Math.PI / 2;
        // Well below the lowest ground: banked bends dig the infield below zero.
        fl.position.set(cx, tr.bounds.y0 - 10, cz);
        this.uCheer.value = 0.6;
    }

    update(t, dt) {
        this.uTime.value = t;
        for (const f of this.anim) f(t, dt);
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
        for (const d of this.disposables) {
            if (d.map && d.map.isCanvasTexture) { /* shared cached textures stay */ }
            d.dispose?.();
        }
        this.disposables.length = 0;
    }
}

// ------------------------------------------------------------------ barrier pieces
const BARRIER_ALT = { tires: [1, 0.25, 0.2], tuff: [0.25, 0.45, 1], netting: [1, 1, 1], hay: [0.92, 0.85, 0.7], raven: [1, 1, 1] };

const BARRIERS = {
    tires: () => {
        const parts = [];
        for (let k = 0; k < 3; k++) {
            const t = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14, 1, false);
            t.translate(0, 0.16 + k * 0.32, 0);
            parts.push(t.toNonIndexed());
        }
        const geo = mergeGeometries(parts);
        return { geo, mat: new THREE.MeshStandardMaterial({ map: tireTexture(0xffffff), roughness: 0.9 }) };
    },
    hay: () => {
        const g = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14);
        g.rotateZ(Math.PI / 2);
        g.rotateY(Math.PI / 2);
        g.translate(0, 0.72, 0);
        return { geo: g, mat: new THREE.MeshStandardMaterial({ color: 0xd8b452, roughness: 1 }) };
    },
    logs: () => {
        const log = new THREE.CylinderGeometry(0.32, 0.36, 4.1, 8);
        log.rotateX(Math.PI / 2);
        log.translate(0, 0.45, 0);
        const post = new THREE.BoxGeometry(0.22, 0.9, 0.22);
        post.translate(0, 0.45, 2);
        return { geo: mergeGeometries([log.toNonIndexed(), post.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; })), mat: new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.95 }) };
    },
    fence: () => {
        const post = new THREE.BoxGeometry(0.18, 1.3, 0.18);
        post.translate(0, 0.65, 0);
        const r1 = new THREE.BoxGeometry(0.08, 0.16, 3.05); r1.translate(0, 1.0, 1.5);
        const r2 = new THREE.BoxGeometry(0.08, 0.16, 3.05); r2.translate(0, 0.55, 1.5);
        return { geo: mergeGeometries([post, r1, r2].map((g) => g.toNonIndexed())), mat: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 }) };
    },
    rocks: () => {
        const g = new THREE.DodecahedronGeometry(0.9, 0);
        g.translate(0, 0.45, 0);
        return { geo: g, mat: new THREE.MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.95, flatShading: true }) };
    },
    posts: () => {
        const post = new THREE.CylinderGeometry(0.12, 0.14, 1.2, 6);
        post.translate(0, 0.6, 0);
        const rope = new THREE.BoxGeometry(0.06, 0.06, 3.05); rope.translate(0, 0.95, 1.5);
        return { geo: mergeGeometries([post.toNonIndexed(), rope.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; })), mat: new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 }) };
    },
    snowbank: () => {
        const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1.4, 0.9, 2.0);
        return { geo: g, mat: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.85 }) };
    },
    netting: () => {
        const post = new THREE.BoxGeometry(0.1, 1.3, 0.1); post.translate(0, 0.65, 0);
        const net = new THREE.BoxGeometry(0.03, 0.9, 3.0); net.translate(0, 0.75, 1.5);
        return { geo: mergeGeometries([post, net].map((g) => g.toNonIndexed())), mat: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 }) };
    },
    tuff: () => {
        const g = new THREE.BoxGeometry(1.0, 0.9, 2.0);
        g.translate(0, 0.45, 0);
        return { geo: g, mat: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }) };
    },
    raven: () => {
        const base = new THREE.BoxGeometry(0.7, 1.0, 2.9); base.translate(0, 0.5, 0);
        const g = base;
        const m = new THREE.MeshStandardMaterial({ color: 0x16171c, roughness: 0.4, metalness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.25 });
        return { geo: g, mat: m };
    },
};

