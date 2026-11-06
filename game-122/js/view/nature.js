// Trees, rocks and undergrowth: instanced, swaying in the wind, all from the world's own lists.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tuft } from './tex.js';

export function colored(geo, hex, jitter = 0, seed = 1) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(hex), n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    let s = seed;
    for (let i = 0; i < n; i += 3) {
        s = (s * 16807) % 2147483647;
        const v = 1 + ((s / 2147483647) - 0.5) * jitter;
        for (let k = 0; k < 3 && i + k < n; k++) { arr[(i + k) * 3] = c.r * v; arr[(i + k) * 3 + 1] = c.g * v; arr[(i + k) * 3 + 2] = c.b * v; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
}
const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.scale(s, s, s); g.translate(x, y, z); return g; };
function jitterGeo(g, amt, seed) {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position;
    const key = (i) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    const off = new Map();
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
    for (let i = 0; i < p.count; i++) {
        const k = key(i);
        if (!off.has(k)) off.set(k, [r() * amt, r() * amt, r() * amt]);
        const o = off.get(k);
        p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
    }
    g.computeVertexNormals();
    return g;
}

function treeGeo(type) {
    const parts = [];
    if (type === 'pine') {
        parts.push(colored(tr(new THREE.CylinderGeometry(0.12, 0.22, 2.4, 6), 0, 1.2, 0), 0x5a3f2a, 0.2));
        [[1.7, 2.6, 2.1], [1.3, 2.3, 3.5], [0.9, 2.0, 4.8], [0.5, 1.4, 5.9]].forEach(([r, h, y], i) =>
            parts.push(colored(jitterGeo(tr(new THREE.ConeGeometry(r, h, 8, 1), 0, y, 0, 0, i * 0.4), 0.18, 3 + i), [0x2c5634, 0x2f5d36, 0x335f38, 0x386a3c][i], 0.22, 7 + i)));
    } else if (type === 'oak' || type === 'birch') {
        const birch = type === 'birch';
        parts.push(colored(tr(new THREE.CylinderGeometry(birch ? 0.1 : 0.2, birch ? 0.15 : 0.32, birch ? 3.4 : 2.8, 6), 0, birch ? 1.7 : 1.4, 0), birch ? 0xdcd8cc : 0x5b4330, 0.15));
        parts.push(colored(tr(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5), 0.5, 2.6, 0, 0, 0, -0.7), birch ? 0xdcd8cc : 0x5b4330, 0.1));
        const blobs = birch ? [[0, 4.0, 0, 1.2], [0.6, 3.4, 0.3, 0.9], [-0.5, 3.5, -0.3, 0.85]] : [[0, 3.9, 0, 1.9], [1.2, 3.4, 0.4, 1.3], [-1.0, 3.5, -0.5, 1.4], [0.2, 4.7, -0.3, 1.2]];
        blobs.forEach(([x, y, z, r], i) => parts.push(colored(jitterGeo(tr(new THREE.IcosahedronGeometry(r, 1), x, y, z), r * 0.25, 11 + i), birch ? 0x8fb056 : [0x4a7a34, 0x56853a, 0x46723a, 0x5e8a3e][i], 0.25, 3 + i)));
    } else if (type === 'dead') {
        parts.push(colored(tr(new THREE.CylinderGeometry(0.1, 0.28, 4.2, 6), 0, 2.1, 0), 0x4a4440, 0.2));
        for (let i = 0; i < 4; i++) parts.push(colored(tr(new THREE.CylinderGeometry(0.03, 0.09, 1.8, 4), Math.cos(i * 1.7) * 0.5, 2.6 + i * 0.4, Math.sin(i * 1.7) * 0.5, 0, i * 1.7, 0.9), 0x4a4440, 0.2));
    } else {
        parts.push(colored(tr(new THREE.CylinderGeometry(0.08, 0.2, 1.8, 5), 0.25, 0.9, 0, 0, 0, -0.25), 0x4a3a2c, 0.2));
        parts.push(colored(jitterGeo(tr(new THREE.IcosahedronGeometry(0.9, 0), 0.6, 2.0, 0, 0, 0, 0, 1), 0.25, 5), 0x3e5a32, 0.25));
    }
    return mergeGeometries(parts);
}

/** Wind: bend each vertex by its height, with a per-instance phase. */
export function swayMaterial(opts, strength = 0.06) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, ...opts });
    mat.userData.time = { value: 0 };
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = mat.userData.time;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
#else
float ph = 0.0;
#endif
float bend = max(0.0, position.y) * ${strength.toFixed(3)};
transformed.x += sin(uWind * 1.3 + ph) * bend;
transformed.z += cos(uWind * 1.1 + ph * 1.3) * bend * 0.6;`);
    };
    return mat;
}

export function buildNature(W, quality) {
    const group = new THREE.Group();
    const mats = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const byType = {};
    for (const t of W.trees) (byType[t.type] ||= []).push(t);
    for (const type in byType) {
        const list = byType[type];
        const mat = swayMaterial({}, type === 'dead' ? 0.01 : 0.035);
        mats.push(mat);
        const im = new THREE.InstancedMesh(treeGeo(type), mat, list.length);
        list.forEach((t, i) => {
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
            const sc = t.s * (type === 'pine' ? 1.15 : 1);
            m4.compose(p.set(t.x, W.height(t.x, t.z) - 0.1, t.z), q, s.set(sc, sc * (0.9 + (t.rot % 0.3)), sc));
            im.setMatrixAt(i, m4);
        });
        im.castShadow = quality !== 'low';
        im.receiveShadow = true;
        group.add(im);
    }
    // rocks
    const rockGeo = colored(jitterGeo(new THREE.IcosahedronGeometry(1, 1), 0.35, 4), 0x87827a, 0.25);
    rockGeo.scale(1, 0.62, 1);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), W.rocks.length);
    W.rocks.forEach((r, i) => {
        q.setFromEuler(new THREE.Euler(r.rot * 0.2, r.rot, r.rot * 0.13));
        m4.compose(p.set(r.x, W.height(r.x, r.z) - r.s * 0.2, r.z), q, s.set(r.s * 1.1, r.s, r.s * 0.9));
        rocks.setMatrixAt(i, m4);
    });
    rocks.castShadow = quality !== 'low'; rocks.receiveShadow = true;
    group.add(rocks);

    // undergrowth: crossed cards, never solid
    const kinds = { grass: [], fern: [], heather: [], flowers: [] };
    let sd = W.seed * 31 + 7;
    const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const count = quality === 'low' ? 2200 : 6000;
    for (let i = 0; i < count * 3 && kinds.grass.length + kinds.fern.length + kinds.heather.length + kinds.flowers.length < count; i++) {
        const x = (r() - 0.5) * 420, z = (r() - 0.5) * 420;
        const g = W.height(x, z);
        if (g < 1.8 || W.water(x, z, g) || W.slopeAt(x, z) > 0.6 || W.nearRoad(x, z, 1.6)) continue;
        const reg = W.regionAt(x, z);
        if (reg === 'castle' && Math.hypot(x, z) < 62) continue;
        if (reg === 'hut' || (reg === 'shore' && g < 3.6)) continue;
        const k = reg === 'wood' ? (r() < 0.6 ? 'fern' : 'grass') : reg === 'moor' ? (r() < 0.7 ? 'heather' : 'grass') : reg === 'fen' ? 'grass' : (r() < 0.14 ? 'flowers' : 'grass');
        if (reg === 'heath' && r() < 0.45) continue;
        kinds[k].push({ x, z, y: g, s: 0.6 + r() * 0.7, rot: r() * 3.14 });
    }
    const card = new THREE.PlaneGeometry(1.4, 1.1); card.translate(0, 0.5, 0);
    const card2 = card.clone(); card2.rotateY(Math.PI / 2);
    const cross = mergeGeometries([card, card2]);
    for (const k in kinds) {
        const list = kinds[k];
        if (!list.length) continue;
        const mat = new THREE.MeshStandardMaterial({ map: tuft(k), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
        mat.userData.time = { value: 0 };
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uWind = mat.userData.time;
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
                .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
transformed.x += sin(uWind * 2.0 + ph) * max(0.0, position.y) * 0.18;`);
        };
        mats.push(mat);
        const im = new THREE.InstancedMesh(cross, mat, list.length);
        list.forEach((t, i) => {
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
            m4.compose(p.set(t.x, t.y - 0.05, t.z), q, s.set(t.s, t.s * (k === 'fern' ? 1.2 : 0.8), t.s));
            im.setMatrixAt(i, m4);
        });
        im.receiveShadow = true;
        group.add(im);
    }
    return { group, update: (time) => { for (const m of mats) m.userData.time.value = time; } };
}

export { treeGeo, jitterGeo, tr };
