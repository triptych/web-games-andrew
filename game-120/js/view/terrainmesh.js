// Builds everything static about a level from its World: the heightfield as shaded chunks, instanced rubble,
// wrecks and spires, hazard pools, colonist pods and the gate. Reads the sim's World; never changes it.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash3 } from '../rng.js';
import { BIOMES, BIOME_OF } from './biomes.js';
import { detailTexture, normalTexture, swirlTexture } from './textures.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CS = 48;

function jitterGeo(geo, amp, seed, flatBottom = false) {
    geo = mergeVertices(geo.index ? geo : geo, 1e-3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = (hash3((x * 7.3) | 0, (y * 7.3) | 0, (z * 7.3 + seed) | 0) - 0.5) * 2;
        const k = 1 + n * amp + Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7) * amp * 0.5;
        p.setXYZ(i, x * k, flatBottom ? Math.max(y * k, -0.2) : y * k, z * k);
    }
    geo.computeVertexNormals();
    return geo;
}

function colored(geo, hex) {
    const n = geo.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(hex);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
}
function mergeGeos(list) {
    // list of non-indexed geometries with position/normal/color
    let total = 0; for (const g of list) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g0 of list) {
        const g = g0.index ? g0.toNonIndexed() : g0;
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
        o += g.attributes.position.count;
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return m;
}
function part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    return colored(g.index ? g.toNonIndexed() : g, hex);
}

export class LevelView {
    constructor(world, li, quality, G) {
        this.world = world; this.li = li; this.q = quality;
        this.B = BIOMES[BIOME_OF[li]];
        this.group = new THREE.Group();
        this.anim = [];
        this.chunks = [];
        this.podViews = new Map();
        this.burners = [];            // positions of burning wrecks (smoke emitters)
        this.buildTerrain();
        this.buildProps();
        this.buildHazards();
        this.buildGate();
        this.buildPods(G);
    }

    // ------------------------------------------------------------------ terrain
    colorAt(x, z, out) {
        const w = this.world, B = this.B.ground;
        const h = w.h(x, z), s = w.slope(x, z);
        const n1 = hash3(Math.floor(x * 0.5), Math.floor(z * 0.5), 3), n2 = hash3(Math.floor(x * 2), Math.floor(z * 2), 9);
        const c = out.setHex(B.lo);
        c.lerp(_c1.setHex(B.mid), smooth(-1.5, 2.5, h)).lerp(_c1.setHex(B.hi), smooth(2.5, 8, h) * 0.9);
        c.lerp(_c1.setHex(B.rock), smooth(0.4, 1.1, s) * 0.85);
        for (const cr of w.craters) {
            const d = Math.hypot(x - cr.x, z - cr.z) / cr.r;
            if (d < 1.25) c.lerp(_c1.setHex(B.scorch), (1 - d / 1.25) * 0.65);
        }
        for (const hz of w.hazards) { const d = Math.hypot(x - hz.x, z - hz.z) / hz.r; if (d < 1.5) c.lerp(_c1.setHex(B.scorch), (1 - d / 1.5) * 0.7); }
        for (const f of w.flats) if (f.kind !== 'start') { const d = Math.hypot(x - f.x, z - f.z) / f.r; if (d < 0.9) c.lerp(_c1.setHex(B.scorch), (0.9 - d) * 0.35 * (0.5 + n1)); }
        const k = 0.86 + 0.28 * n1 + (n2 - 0.5) * 0.12;
        c.multiplyScalar(k);
        return c;
    }

    buildTerrain() {
        const w = this.world, g = new THREE.Group();
        const detail = detailTexture(this.li * 7 + 1), nrm = normalTexture(this.li * 5 + 2, 2.5);
        detail.repeat.set(1 / 7, 1 / 7); nrm.repeat.set(1 / 5, 1 / 5);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, normalMap: nrm, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0 });
        this.terrainMat = mat;
        const X0 = w.x0, W = w.gw - 1, Hh = w.gh - 1;
        const cols = Math.ceil(W / CS), rows = Math.ceil(Hh / CS);
        const col = new THREE.Color();
        for (let cj = 0; cj < rows; cj++) for (let ci = 0; ci < cols; ci++) {
            const nx = Math.min(CS, W - ci * CS), nz = Math.min(CS, Hh - cj * CS);
            const vx = nx + 1, vz = nz + 1;
            const pos = new Float32Array(vx * vz * 3), nor = new Float32Array(vx * vz * 3), cl = new Float32Array(vx * vz * 3), uv = new Float32Array(vx * vz * 2);
            for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
                const x = X0 + ci * CS + i, z = w.zTop - (cj * CS + j), k = j * vx + i;
                const y = w.h(x, z);
                pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
                const dx = (w.h(x + 1, z) - w.h(x - 1, z)) / 2, dz = (w.h(x, z + 1) - w.h(x, z - 1)) / 2;
                const l = Math.hypot(dx, 1, dz);
                nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
                this.colorAt(x, z, col);
                cl[k * 3] = col.r; cl[k * 3 + 1] = col.g; cl[k * 3 + 2] = col.b;
                uv[k * 2] = x; uv[k * 2 + 1] = z;
            }
            const idx = new Uint32Array(nx * nz * 6);
            let o = 0;
            for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
                const p00 = j * vx + i, p10 = p00 + 1, p01 = p00 + vx, p11 = p01 + 1;
                idx[o++] = p01; idx[o++] = p00; idx[o++] = p11;
                idx[o++] = p11; idx[o++] = p00; idx[o++] = p10;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            geo.setIndex(new THREE.BufferAttribute(idx, 1));
            geo.computeBoundingSphere(); geo.computeBoundingBox();
            const m = new THREE.Mesh(geo, mat);
            m.receiveShadow = true;
            m.userData.c = geo.boundingSphere.center.clone();
            g.add(m);
            this.chunks.push(m);
        }
        this.group.add(g);
    }

    // ------------------------------------------------------------------ props
    buildProps() {
        const w = this.world, B = this.B, q = this.q;
        const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: false, roughness: 0.9, metalness: 0.05, flatShading: false });
        const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.35 });
        const rocks = w.blockers.filter((b) => b.kind === 'rock'), wrecks = w.blockers.filter((b) => b.kind === 'wreck'), spires = w.blockers.filter((b) => b.kind === 'spire');
        const tmp = new THREE.Object3D(), col = new THREE.Color();
        const addInst = (mesh, list, fn) => {
            list.forEach((b, i) => { fn(tmp, b, i); tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix); });
            mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = q !== 'low'; mesh.receiveShadow = true; this.group.add(mesh);
        };
        // rocks: three jittered shapes
        for (let v = 0; v < 3; v++) {
            const list = rocks.filter((b) => b.seed % 3 === v);
            if (!list.length) continue;
            const geo = jitterGeo(new THREE.IcosahedronGeometry(1, 3), 0.28, v * 17 + this.li, true);
            const mesh = new THREE.InstancedMesh(geo, rockMat, list.length);
            addInst(mesh, list, (o, b, i) => {
                o.position.set(b.x, b.y + b.h * 0.38, b.z); o.rotation.set(0, b.rot, 0); o.scale.set(b.r * 1.05, b.h * 0.62, b.r * 1.05);
                const k = 0.75 + hash3(b.seed, 3, 4) * 0.5;
                mesh.setColorAt(i, col.setHex(B.rock).multiplyScalar(k));
            });
        }
        // wrecks: composite templates
        const tank = mergeGeos([
            part(new THREE.BoxGeometry(3.4, 1.2, 5.4), 0x4a4e52, 0, 0.9, 0), part(new THREE.BoxGeometry(1.0, 0.9, 5.2), 0x24262a, -1.9, 0.5, 0), part(new THREE.BoxGeometry(1.0, 0.9, 5.2), 0x24262a, 1.9, 0.5, 0),
            part(new THREE.CylinderGeometry(1.1, 1.3, 0.9, 12), 0x555a60, 0.1, 1.8, -0.4, 0, 0, 0.15), part(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 8), 0x2c2e32, 0.5, 2.3, -2.6, Math.PI / 2 + 0.3, 0, 0.2),
            part(new THREE.BoxGeometry(2.8, 0.3, 2.2), 0x1a1614, 0.2, 1.5, 1.3, 0.2, 0.3, 0.2),
        ]);
        const ship = mergeGeos([
            part(new THREE.CylinderGeometry(1.2, 2.0, 7.0, 10), 0x5a5e66, 0, 1.6, 0, Math.PI / 2, 0, 0.08), part(new THREE.BoxGeometry(6.0, 0.3, 2.4), 0x42464e, 0, 1.4, 0.8, 0.12, 0, 0.35),
            part(new THREE.BoxGeometry(5.0, 0.25, 2.0), 0x2c2f35, -0.6, 2.4, -1.4, -0.3, 0.4, -0.5), part(new THREE.BoxGeometry(0.4, 3.0, 2.0), 0x4a4e56, 0, 3.0, 2.8, 0.1, 0, 0.1),
            part(new THREE.SphereGeometry(1.1, 10, 8), 0x1c2024, 0, 1.4, -3.4, 0, 0, 0, 1, 0.8, 1.2),
        ]);
        const mechw = mergeGeos([
            part(new THREE.BoxGeometry(2.4, 1.8, 2.8), 0x5a5148, 0, 1.2, 0, 0.2, 0.3, 0.1), part(new THREE.CylinderGeometry(0.35, 0.28, 4.6, 8), 0x3c3a38, 1.2, 1.8, 0.8, 0.3, 0, -0.9),
            part(new THREE.CylinderGeometry(0.3, 0.24, 4.0, 8), 0x33312f, -1.4, 0.8, -0.6, 1.1, 0.5, 0.6), part(new THREE.SphereGeometry(0.7, 8, 6), 0x2a2927, 2.3, 3.2, 1.6),
            part(new THREE.BoxGeometry(1.8, 0.4, 1.4), 0x7a3a22, 0, 2.2, 0.2, 0, 0.5, 0),
        ]);
        const templates = [tank, ship, mechw];
        for (let v = 0; v < 3; v++) {
            const list = wrecks.filter((b) => b.seed % 3 === v);
            if (!list.length) continue;
            const mesh = new THREE.InstancedMesh(templates[v], propMat, list.length);
            const base = [2.7, 3.6, 2.4][v];
            addInst(mesh, list, (o, b, i) => {
                const s = b.r / base;
                o.position.set(b.x, b.y - 0.15, b.z); o.rotation.set(0, b.rot, 0); o.scale.set(s, s * Math.min(1.2, b.h / 2.4), s);
                mesh.setColorAt(i, col.setHex(0xffffff).multiplyScalar(0.7 + hash3(b.seed, 5, 6) * 0.5));
                if (hash3(b.seed, 1, 1) < 0.5 && (this.li === 0 || this.li === 4 || this.li === 2)) this.burners.push({ x: b.x, y: b.y + b.h, z: b.z, r: b.r });
            });
        }
        // spires: one template per biome
        const sp = this.spireGeo();
        if (spires.length) {
            const mesh = new THREE.InstancedMesh(sp.geo, sp.mat, spires.length);
            addInst(mesh, spires, (o, b, i) => {
                o.position.set(b.x, b.y - 0.2, b.z); o.rotation.set((hash3(b.seed, 2, 2) - 0.5) * 0.12, b.rot, (hash3(b.seed, 4, 2) - 0.5) * 0.12); o.scale.set(b.r, b.h / sp.h, b.r);
                mesh.setColorAt(i, col.setHex(0xffffff).multiplyScalar(0.8 + hash3(b.seed, 7, 7) * 0.4));
            });
        }
        this.buildDecor();
    }

    spireGeo() {
        const B = this.B, li = this.li;
        const mk = (g, hex, ...a) => part(g, hex, ...a);
        let parts, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 }), h = 1;
        if (li === 0) { h = 1; parts = [mk(new THREE.CylinderGeometry(0.35, 1, 1, 7), 0x1e1a17, 0, 0.5, 0), mk(new THREE.CylinderGeometry(0.1, 0.3, 0.55, 5), 0x2a2420, 0.25, 0.9, 0, 0, 0, -0.6), mk(new THREE.CylinderGeometry(0.06, 0.18, 0.45, 5), 0x2a2420, -0.2, 0.7, 0.1, 0.4, 0, 0.8)]; }
        else if (li === 1) { parts = [mk(new THREE.CylinderGeometry(0.28, 0.42, 1, 8), 0x7a8a60, 0, 0.5, 0), mk(new THREE.SphereGeometry(1.15, 12, 8), 0x2fd6a0, 0, 1.0, 0, 0, 0, 0, 1, 0.38, 1), mk(new THREE.SphereGeometry(0.5, 8, 6), 0xff80d0, 0, 1.1, 0, 0, 0, 0, 1, 0.5, 1)]; mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: 0x1a6a50, emissiveIntensity: 0.6 }); }
        else if (li === 2) { parts = [mk(new THREE.CylinderGeometry(0.7, 1, 0.45, 9), 0xa0522d, 0, 0.22, 0), mk(new THREE.CylinderGeometry(0.5, 0.7, 0.35, 9), 0xb8643a, 0, 0.62, 0.05), mk(new THREE.CylinderGeometry(0.6, 0.5, 0.2, 9), 0x8a3e22, 0.05, 0.9, 0), mk(new THREE.CylinderGeometry(0.45, 0.6, 0.25, 9), 0xc87040, 0, 1.0, -0.03)]; }
        else if (li === 3) { parts = [mk(new THREE.OctahedronGeometry(1, 0), 0xb8e4ff, 0, 0.5, 0, 0, 0.4, 0, 0.55, 0.9, 0.55), mk(new THREE.OctahedronGeometry(1, 0), 0x8fd0ff, 0.5, 0.2, 0.2, 0, 1, 0.4, 0.35, 0.55, 0.35), mk(new THREE.OctahedronGeometry(1, 0), 0xd8f0ff, -0.45, 0.25, -0.15, 0.2, 0.2, -0.3, 0.3, 0.5, 0.3)]; mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.2, emissive: 0x2a6aa8, emissiveIntensity: 0.45, transparent: true, opacity: 0.9 }); }
        else if (li === 4) { parts = [mk(new THREE.ConeGeometry(0.9, 1, 6), 0x151110, 0, 0.5, 0), mk(new THREE.ConeGeometry(0.6, 0.7, 5), 0x1e1815, 0.5, 0.3, 0.2, 0, 0, -0.3), mk(new THREE.ConeGeometry(0.15, 0.5, 5), 0xff6a1a, 0, 0.9, 0)]; mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, emissive: 0x401400, emissiveIntensity: 0.9 }); }
        else { parts = [mk(new THREE.ConeGeometry(0.7, 1, 7), 0x6a3070, 0, 0.5, 0, 0, 0, 0.05), mk(new THREE.ConeGeometry(0.4, 0.8, 6), 0x8a4090, 0.5, 0.35, 0.1, 0, 0, -0.4), mk(new THREE.SphereGeometry(0.5, 10, 8), 0xe060ff, -0.55, 0.25, 0.1, 0, 0, 0, 1, 1.2, 1)]; mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2, emissive: 0x602070, emissiveIntensity: 0.6 }); }
        void B;
        return { geo: mergeGeos(parts), mat, h };
    }

    buildDecor() {
        const w = this.world, B = this.B, q = this.q;
        const kind = B.decor;
        const N = q === 'low' ? 350 : q === 'med' ? 900 : 1700;
        const tuft = new THREE.BufferGeometry();
        const v = new Float32Array([0, 0, 0, -0.12, 0, 0, 0, 0.7, 0.05, 0, 0, 0, 0.12, 0, 0, 0, 0.7, 0.05, 0, 0, 0, 0, 0, 0.12, 0.05, 0.6, 0, 0, 0, 0, 0, 0, -0.12, 0.05, 0.6, 0]);
        tuft.setAttribute('position', new THREE.BufferAttribute(v, 3)); tuft.computeVertexNormals();
        const tuftMat = new THREE.MeshStandardMaterial({ color: kind === 'snow' ? 0xffffff : kind === 'ash' ? 0x3a3330 : kind === 'moss' ? 0x6a9a3a : kind === 'spore' ? 0xd070e0 : 0x8a7a48, side: THREE.DoubleSide, roughness: 1, emissive: kind === 'spore' ? 0x401050 : 0x000000 });
        const pebGeo = jitterGeo(new THREE.IcosahedronGeometry(1, 1), 0.3, 5, true);
        const pebMat = new THREE.MeshStandardMaterial({ color: B.rock, roughness: 0.95 });
        const tufts = new THREE.InstancedMesh(tuft, tuftMat, N), pebs = new THREE.InstancedMesh(pebGeo, pebMat, N);
        const o = new THREE.Object3D(), c = new THREE.Color();
        for (let i = 0; i < N; i++) {
            const t = hash3(i, 1, this.li) * (w.L + 30) - 10, z = -t;
            const x = w.cx(z) + (hash3(i, 2, this.li) - 0.5) * 2 * w.hw(z) * 1.05;
            const y = w.h(x, z);
            o.position.set(x, y - 0.02, z); o.rotation.set(0, hash3(i, 3, 1) * 6.28, 0);
            const s = 0.5 + hash3(i, 4, 1) * 1.1; o.scale.set(s, s * (0.7 + hash3(i, 5, 1) * 0.8), s); o.updateMatrix(); tufts.setMatrixAt(i, o.matrix);
            const x2 = w.cx(z - 1.3) + (hash3(i, 6, this.li) - 0.5) * 2 * w.hw(z) * 1.0, z2 = -(hash3(i, 7, this.li) * (w.L + 30) - 10);
            o.position.set(x2, w.h(x2, z2) + 0.02, z2); const ps = 0.12 + hash3(i, 8, 1) * 0.5; o.scale.set(ps * 1.3, ps, ps); o.rotation.set(0, hash3(i, 9, 1) * 6.28, 0); o.updateMatrix(); pebs.setMatrixAt(i, o.matrix);
            pebs.setColorAt(i, c.setHex(B.rock).multiplyScalar(0.6 + hash3(i, 10, 1) * 0.7));
            tufts.setColorAt(i, c.setHex(0xffffff).multiplyScalar(0.6 + hash3(i, 11, 1) * 0.6));
        }
        tufts.receiveShadow = true; pebs.receiveShadow = true; pebs.castShadow = false;
        this.group.add(tufts, pebs);
    }

    // ------------------------------------------------------------------ hazards
    buildHazards() {
        const w = this.world, B = this.B;
        this.hazMats = [];
        for (const hz of w.hazards) {
            const type = hz.type, tex = swirlTexture(hz.x * 3 + hz.z);
            tex.repeat.set(2, 2);
            const hot = type === 'lava' || type === 'fire' || type === 'acid' || type === 'goo';
            const mat = new THREE.MeshStandardMaterial({
                color: type === 'ice' ? 0x16243e : type === 'sand' ? 0xc8a060 : B.hazard, roughness: type === 'ice' ? 0.05 : 0.35, metalness: type === 'ice' ? 0.7 : 0.1,
                emissive: hot ? B.hazardGlow : 0x000000, emissiveMap: hot ? tex : null, emissiveIntensity: type === 'fire' ? 0.9 : 1.0, map: tex,
            });
            const geo = this.discGeo(hz.x, hz.z, hz.r, 8, 28, 0.12);
            const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = 1;
            this.group.add(m); this.hazMats.push({ tex, mat, hot });
        }
    }
    discGeo(cx, cz, r, rings, segs, lift, wob = 0.18) {
        const w = this.world, pos = [], idx = [], uv = [], nor = [];
        pos.push(cx, w.h(cx, cz) + lift, cz); uv.push(0.5, 0.5); nor.push(0, 1, 0);
        for (let ri = 1; ri <= rings; ri++) for (let s = 0; s < segs; s++) {
            const a = (s / segs) * 6.2832, rr = r * (ri / rings) * (ri === rings ? 1 + Math.sin(a * 5 + cx) * wob : 1);
            const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
            pos.push(x, w.h(x, z) + lift, z); uv.push(0.5 + Math.cos(a) * 0.5 * ri / rings, 0.5 + Math.sin(a) * 0.5 * ri / rings); nor.push(0, 1, 0);
        }
        for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
        for (let ri = 1; ri < rings; ri++) for (let s = 0; s < segs; s++) {
            const a = 1 + (ri - 1) * segs + s, b = 1 + (ri - 1) * segs + (s + 1) % segs, c = 1 + ri * segs + s, d = 1 + ri * segs + (s + 1) % segs;
            idx.push(a, b, c, b, d, c);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setIndex(idx);
        return g;
    }

    // ------------------------------------------------------------------ gate (the way out; sealed while a boss lives)
    buildGate() {
        const w = this.world, gt = w.gate, g = new THREE.Group();
        const hw = w.hw(gt.z) * 0.9;
        const rock = new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.5, metalness: 0.8 });
        const glowCol = this.world.arena ? 0xff3a2a : 0x40ffa0;
        const glow = new THREE.MeshBasicMaterial({ color: glowCol, toneMapped: false });
        for (const sgn of [-1, 1]) {
            const px = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 22, 10), rock); px.position.set(sgn * hw, 11, 0); px.castShadow = true; g.add(px);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.28, 8, 24), glow); ring.position.set(sgn * hw, 16, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
        }
        const bar = document.createElement('canvas'); bar.width = 64; bar.height = 256;
        const bg = bar.getContext('2d'); for (let i = 0; i < 16; i++) { bg.fillStyle = i % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)'; bg.fillRect(0, i * 16, 64, 8); }
        const btex = new THREE.CanvasTexture(bar); btex.wrapS = btex.wrapT = THREE.RepeatWrapping; btex.repeat.set(hw / 4, 1);
        this.gateTex = btex;
        this.barrier = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 18), new THREE.MeshBasicMaterial({ color: glowCol, map: btex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        this.barrier.position.set(0, 9, 0);
        g.add(this.barrier);
        this.barrier.visible = !!this.world.arena;
        g.position.set(gt.x, w.h(gt.x, gt.z) - 0.5, gt.z);
        // keep the poles on the ground wherever the corridor wanders
        this.group.add(g); this.gate = g;
    }

    // ------------------------------------------------------------------ colonist pods
    buildPods(G) {
        const metal = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.4, metalness: 0.85 });
        const bars = new THREE.MeshStandardMaterial({ color: 0xff9a30, emissive: 0xff6a10, emissiveIntensity: 1.4, roughness: 0.4 });
        const lock = new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff2a1a, emissiveIntensity: 2.2 });
        const skin = [0xffcaa0, 0xd8a070, 0x9a6a48, 0xffdcb8];
        for (const pod of G.pods) {
            const g = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.6, 16), metal); base.position.y = 0.3; base.castShadow = true; g.add(base);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.2, 0.4, 16), metal); top.position.y = 4.6; g.add(top);
            const barsG = new THREE.Group();
            for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6), bars); b.position.set(Math.cos(a) * 3.0, 2.5, Math.sin(a) * 3.0); barsG.add(b); }
            g.add(barsG);
            const lk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.8), lock); lk.position.set(0, 2.4, 3.15); g.add(lk);
            const folks = new THREE.Group();
            for (let i = 0; i < pod.n; i++) {
                const a = (i / pod.n) * 6.2832 + 0.4, p = new THREE.Group();
                const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), new THREE.MeshStandardMaterial({ color: [0x4a7ac0, 0xc0603a, 0x60a050, 0xc0a040][i % 4], roughness: 0.8 })); body.position.y = 0.75; p.add(body);
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: skin[i % 4], roughness: 0.7 })); head.position.y = 1.5; p.add(head);
                p.position.set(Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1); p.userData.ph = i; folks.add(p);
            }
            g.add(folks);
            // the way out: a column of light that takes the colonists away once they have finished celebrating
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.3, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
            beam.position.y = 15; beam.visible = false; g.add(beam);
            g.position.set(pod.x, this.world.h(pod.x, pod.z), pod.z);
            this.group.add(g);
            this.podViews.set(pod.id, { g, barsG, lk, folks, bars, lock, beam, open: 0, tf: pod.freed ? 99 : 0, gone: !!pod.freed });
        }
    }

    update(dt, time, G, px, pz) {
        // chunk visibility by distance
        for (const m of this.chunks) { const c = m.userData.c; m.visible = Math.hypot(c.x - px, c.z - pz) < 330; }
        for (const hm of this.hazMats) { hm.tex.offset.x += dt * 0.012; hm.tex.offset.y += dt * 0.008; if (hm.hot) hm.mat.emissiveIntensity = 0.9 + Math.sin(time * 2 + hm.tex.offset.x * 40) * 0.25; }
        this.gateTex.offset.y -= dt * 0.4;
        if (this.barrier.visible) {
            const open = G.bossDone;
            this.barrier.material.opacity += ((open ? 0 : 0.55 + Math.sin(time * 3) * 0.1) - this.barrier.material.opacity) * Math.min(1, dt * 3);
            if (open && this.barrier.material.opacity < 0.02) this.barrier.visible = false;
        }
        for (const pod of G.pods) {
            const v = this.podViews.get(pod.id); if (!v) continue;
            const t = v.open = pod.freed ? Math.min(1, v.open + dt * 1.2) : 0;
            v.barsG.children.forEach((b, i) => { b.position.y = 2.5 + t * 6 + 0; b.scale.y = 1 - t * 0.9; b.material = v.bars; });
            v.barsG.visible = t < 0.95;
            v.lk.visible = !pod.freed;
            v.lock.emissiveIntensity = 1.6 + Math.sin(time * 5 + pod.id) * 0.8 + (1 - pod.hp / pod.maxhp) * 2;
            // freed colonists dance for a while, then teleport out so the battle is not full of cheering civilians
            if (pod.freed) v.tf += dt;
            const DANCE = 2.6, BEAM = 0.9;
            if (v.gone) { v.folks.visible = false; v.beam.visible = false; continue; }
            if (pod.freed && v.tf > DANCE && !v.zapped) {
                v.zapped = true;
                if (this.fx) { const y = this.world.h(pod.x, pod.z); this.fx.ring(pod.x, pod.z, 8, 0.9, 0x9fe8ff); this.fx.light(pod.x, y + 5, pod.z, 0x9fe8ff, 90, 0.8);
                    for (let i = 0; i < 40; i++) this.fx.glow.emit(pod.x + this.fx.r(-2, 2), y + 0.5, pod.z + this.fx.r(-2, 2), this.fx.r(-0.6, 0.6), this.fx.r(8, 22), this.fx.r(-0.6, 0.6), this.fx.r(0.6, 1.2), 0.5, 0.1, 0xbfefff, 0x4a9aff, 1.2, 0, 0.4, 0); }
                if (this.onTeleport) this.onTeleport();
            }
            const k = pod.freed ? Math.min(1, Math.max(0, (v.tf - DANCE) / BEAM)) : 0;
            v.folks.children.forEach((p) => {
                const dance = pod.freed && k === 0;
                p.position.y = 0.5 + Math.abs(Math.sin(time * (pod.freed ? 9 : 2.5) + p.userData.ph)) * (pod.freed ? 0.5 : 0.08) + k * k * 14;
                p.rotation.y += dt * (dance ? 6 : 0);
                p.scale.set(1 - k * 0.85, 1 + k * 2.2, 1 - k * 0.85);
            });
            v.beam.visible = k > 0 && k < 1.2 || (pod.freed && v.tf > DANCE && v.tf < DANCE + BEAM + 0.5);
            v.beam.material.opacity = pod.freed && v.tf > DANCE ? Math.max(0, Math.sin(Math.min(1, (v.tf - DANCE) / (BEAM + 0.5)) * Math.PI)) * 0.7 : 0;
            if (pod.freed && v.tf > DANCE + BEAM + 0.5) { v.gone = true; v.folks.visible = false; v.beam.visible = false; }
        }
    }

    dispose() {
        this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => x.dispose()); } });
    }
}
const _c1 = new THREE.Color();
export { biomeFor };
function biomeFor(li) { return BIOMES[BIOME_OF[li]]; }
