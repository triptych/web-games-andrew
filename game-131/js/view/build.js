// Builds the still parts of each place: the island's ground, sea, trees and sky, and the walls, floors and
// ceilings of the grid zones. Reads the same data the simulation walks on. Never touches G.

import * as THREE from 'three';
import { ISLE } from '../config.js';
import { hash3, noise2 } from '../rng.js';
import { heightAt, trees, MARKS, PATHS } from '../sim/terrain.js';
import { zone } from '../sim/world.js';
import { tile, glow } from './tex.js';
import { makeProp, loadModel, useModels } from './props.js';

/** How each grid zone is lit and dressed. fog: [colour, near, far]; amb: [sky, ground, strength]; lamp: the glow you carry. */
export const LOOKS = {
    isle: { fog: [0xbfd9e6, 70, 330], amb: [0xeaf3ff, 0xa9b08a, 2.1], sun: [0xfff0d0, 2.2], skyTop: 0x79b2e4, skyBot: 0xe2f0f3, motes: 0xfff2b0, clouds: true },
    caves: { wall: ['caves-wall', 0x2c2a55], floor: ['caves-floor', 0x35304e], ceil: ['caves-wall', 0x2c2a55], wallH: 5, fog: [0x0c0b22, 8, 60], amb: [0x9aa6f0, 0x3a3060, 1.7], lamp: [0xffe0b0, 60, 30], motes: 0x9ae6ff, bg: 0x0c0b22 },
    under: { wall: ['under-wall', 0x6c6258], floor: ['under-floor', 0x5a5248], ceil: ['under-wall', 0x4a443c], wallH: 4.5, fog: [0x14100b, 8, 56], amb: [0xe0bc90, 0x40301e, 1.6], lamp: [0xffe6b0, 60, 30], motes: 0xffd98a, bg: 0x14100b },
    sky: { wall: ['sky-wall', 0xe6ecf2], floor: ['sky-floor', 0xd9e2ea], wallH: 4, fog: [0xd4e8fb, 40, 260], amb: [0xffffff, 0xa8c8ee, 1.5], sun: [0xfff6e0, 2.2], skyTop: 0x6aa8ea, skyBot: 0xeaf5ff, motes: 0xffffff, clouds: true, skirt: 3 },
    sea: { wall: ['sea-wall', 0x7fb0b4], floor: ['sea-floor', 0x3f86a8], wallH: 5.5, fog: [0x1d7090, 3, 60], amb: [0xa0f0ff, 0x0d4258, 1.5], sun: [0xbff4ff, 1.1], skyTop: 0x39b2d0, skyBot: 0x0f5672, motes: 0xdffaff, rise: true },
    warren: { wall: ['warren-wall', 0x6a4a34], floor: ['warren-floor', 0x7a5c3e], ceil: ['warren-wall', 0x4a3424], wallH: 3.6, fog: [0x1c110a, 8, 56], amb: [0xffc490, 0x4a2c14, 1.7], lamp: [0xffc890, 55, 28], motes: 0xffb060, bg: 0x1c110a },
};

const distSeg = (px, pz, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
    return Math.hypot(a[0] + t * dx - px, a[1] + t * dz - pz);
};

/** A dome of sky: a vertical gradient that ignores fog. */
function skyDome(top, bottom) {
    const m = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bottom) } },
        vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float t = clamp(h * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, sqrt(t)), 1.0); }',
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), m);
    s.renderOrder = -10;
    s.userData.sky = true;
    return s;
}

function clouds(y0, y1, n, spread) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, fog: false, depthWrite: false });
    const geo = new THREE.IcosahedronGeometry(1, 3);
    for (let i = 0; i < n; i++) {
        const c = new THREE.Group();
        for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(geo, m); b.position.set((hash3(i, k, 1) - 0.5) * 26, (hash3(i, k, 2) - 0.5) * 3, (hash3(i, k, 3) - 0.5) * 12); b.scale.set(10 + hash3(i, k, 4) * 9, 3.2 + hash3(i, k, 5) * 2, 7 + hash3(i, k, 6) * 6); c.add(b); }
        const a = hash3(i, 7, 7) * Math.PI * 2, r = spread * (0.35 + hash3(i, 8, 8) * 0.65);
        c.position.set(Math.cos(a) * r, y0 + hash3(i, 9, 9) * (y1 - y0), Math.sin(a) * r);
        g.add(c);
    }
    g.userData.clouds = true;
    return g;
}

// ---------------------------------------------------------------- the island
export function buildIsle(low) {
    const g = new THREE.Group();
    const L = LOOKS.isle, S = ISLE.size;

    // the ground's colours, painted once from the same heights the sim walks on
    const N = low ? 256 : 512, c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const SAND = [226, 211, 164], MOSS = [104, 146, 82], HIGH = [150, 172, 98], ROCK = [128, 126, 118], DIRT = [176, 152, 108], BED = [150, 170, 150];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i / (N - 1) - 0.5) * S, z = (j / (N - 1) - 0.5) * S, h = heightAt(x, z);
        const slope = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
        let col = h < 0.2 ? BED : mix(SAND, h > 9 ? HIGH : MOSS, Math.max(0, Math.min(1, (h - 1.1) / 1.2)));
        if (h > 1.4) {
            let pd = 99;
            for (const [a, b] of PATHS) pd = Math.min(pd, distSeg(x, z, MARKS[a], MARKS[b]));
            col = mix(col, DIRT, Math.max(0, Math.min(0.75, (2.2 - pd) / 1.4)));
        }
        col = mix(col, ROCK, Math.max(0, Math.min(1, (slope - 0.55) / 0.4)));
        const n = (noise2(x * 0.09, z * 0.09, 4) - 0.5) * 26 + (hash3(i, j, 3) - 0.5) * 8;
        const o = (j * N + i) * 4;
        img.data[o] = col[0] + n; img.data[o + 1] = col[1] + n; img.data[o + 2] = col[2] + n * 0.7; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const colour = new THREE.CanvasTexture(c);
    colour.colorSpace = THREE.SRGBColorSpace;

    const seg = low ? 96 : 160, geo = new THREE.PlaneGeometry(S, S, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(-6, heightAt(pos.getX(i), pos.getZ(i))));
    geo.computeVertexNormals();
    const ground = new THREE.MeshStandardMaterial({ map: colour, roughness: 0.95 });
    const detail = tile('grass', 0x7a9a5a);
    ground.onBeforeCompile = (sh) => {
        sh.uniforms.detail = { value: detail };
        sh.fragmentShader = sh.fragmentShader
            .replace('uniform float opacity;', 'uniform float opacity;\nuniform sampler2D detail;')
            .replace('#include <map_fragment>', '#include <map_fragment>\n\tfloat dl = dot(texture2D(detail, vMapUv * 70.0).rgb, vec3(0.3, 0.6, 0.1));\n\tdiffuseColor.rgb *= clamp(0.55 + dl * 1.5, 0.0, 1.6);');
    };
    g.add(new THREE.Mesh(geo, ground));

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x3f9db4, transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.15 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0.12; sea.userData.sea = true;
    g.add(sea);

    // trees: one Meshy model per kind, drawn as instances. Until it loads (or with ?models=0) a plain trunk and
    // two leaf clumps stand in.
    const all = trees().filter((_, i) => !low || i % 3 === 0);      // low quality draws a third of the trees (they still block the way)
    const o = new THREE.Object3D(), col = new THREE.Color(), m4 = new THREE.Matrix4();
    for (const [kind, file, tall] of [[0, 'tree', 8.5], [1, 'tree2', 5.5]]) {
        const list = all.filter((t) => t.kind === kind);
        const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.42, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x6b4f36, roughness: 1 }), list.length);
        const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), list.length * 2);
        list.forEach((t, i) => {
            const y = heightAt(t.x, t.z), s = t.s * (kind ? 0.75 : 1.15);
            o.position.set(t.x, y + 1.6 * s, t.z); o.scale.set(s, s, s); o.rotation.set(0, hash3(i, 1, 1) * 6, 0); o.updateMatrix();
            trunk.setMatrixAt(i, o.matrix);
            for (let k = 0; k < 2; k++) {
                o.position.set(t.x + (hash3(i, k, 2) - 0.5) * 1.6 * s, y + (3.6 + k * 1.5) * s, t.z + (hash3(i, k, 3) - 0.5) * 1.6 * s);
                o.scale.set((2.1 - k * 0.6) * s, (1.7 - k * 0.4) * s, (2.1 - k * 0.6) * s); o.updateMatrix();
                crown.setMatrixAt(i * 2 + k, o.matrix);
                col.setHSL(kind ? 0.2 + hash3(i, k, 4) * 0.05 : 0.28 + hash3(i, k, 4) * 0.07, 0.42, 0.3 + hash3(i, k, 5) * 0.12);
                crown.setColorAt(i * 2 + k, col);
            }
        });
        g.add(trunk, crown);
        if (!useModels) continue;
        loadModel(file).then((gl) => {
            if (!gl) return;
            gl.scene.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(gl.scene), k0 = tall / (box.max.y - box.min.y || 1);
            const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
            gl.scene.traverse((m) => {
                if (!m.isMesh) return;
                const mat = m.material.clone();
                mat.color.setScalar(1.45);           // the canopy's painted greens are dark; lift them to sit with the meadow
                mat.metalness = 0; mat.roughness = 1;
                mat.side = THREE.FrontSide;          // back-to-back leaf faces fight when both sides are drawn
                const im = new THREE.InstancedMesh(m.geometry, mat, list.length);
                list.forEach((t, i) => {
                    const s = k0 * t.s * (0.8 + hash3(i, 6, kind) * 0.35);
                    o.position.set(t.x, heightAt(t.x, t.z) - 0.12, t.z); o.rotation.set(0, hash3(i, 1, 1) * 6.283, 0); o.scale.setScalar(s); o.updateMatrix();
                    // stand the model on its own base, centred on the trunk, then place the instance
                    m4.makeTranslation(-cx, -box.min.y, -cz).multiply(m.matrixWorld);
                    im.setMatrixAt(i, m4.premultiply(o.matrix));
                });
                im.instanceMatrix.needsUpdate = true;
                g.add(im);
            });
            g.remove(trunk, crown);
        });
    }

    g.add(skyDome(L.skyTop, L.skyBot), clouds(95, 150, low ? 8 : 18, 520));
    // the Aerie, far overhead: you see it long before you can reach it
    const aerie = new THREE.Group();
    for (const [x, z, s] of [[0, 0, 1.6], [16, 5, 1.1], [-14, 8, 1.2], [5, -14, 0.9]]) { const t = makeProp('tower'); t.position.set(x, 0, z); t.scale.setScalar(s); aerie.add(t); }
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    puff.scale.set(46, 9, 34); puff.position.y = -5;
    aerie.add(puff);
    aerie.position.set(70, 170, -150);
    aerie.traverse((m) => { if (m.material) m.frustumCulled = false; });
    g.add(aerie);
    return g;
}

// ---------------------------------------------------------------- the grid zones
function quad(a, p, uvScaleU, uvScaleV) {
    // p: four corners, counter-clockwise seen from the side that should be lit
    const [A, B, C, D] = p;
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A)).normalize();
    const base = a.pos.length / 3;
    for (const v of p) { a.pos.push(v.x, v.y, v.z); a.nor.push(n.x, n.y, n.z); }
    a.uv.push(0, 0, uvScaleU, 0, uvScaleU, uvScaleV, 0, uvScaleV);
    a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function toMesh(a, tex, extra = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
    geo.setIndex(a.idx);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tile(tex[0], tex[1]), roughness: 0.92, ...extra }));
}

export function buildGrid(zoneId, low) {
    const Z = zone(zoneId), L = LOOKS[Z.def.look], s = Z.cell, H = L.wallH;
    const g = new THREE.Group();
    const A = () => ({ pos: [], nor: [], uv: [], idx: [] });
    const walls = A(), floor = A(), ceil = A();
    const ch = (c, r) => (c < 0 || r < 0 || c >= Z.w || r >= Z.h ? '#' : Z.rows[r][c]);
    const open = (c, r) => { const k = ch(c, r); return k !== '#' && k !== ' '; };
    for (let r = 0; r < Z.h; r++) for (let c = 0; c < Z.w; c++) {
        const x0 = c * s, x1 = x0 + s, z0 = r * s, z1 = z0 + s;
        if (open(c, r)) {
            quad(floor, [V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(x0, 0, z0)], 1, 1);
            if (L.ceil) quad(ceil, [V(x0, H, z0), V(x1, H, z0), V(x1, H, z1), V(x0, H, z1)], 1, 1);
            // a wall, or (in the sky) the edge of the slab, on each closed side
            for (const [dc, dr, p] of [
                [0, -1, (y0, y1) => [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)]],
                [0, 1, (y0, y1) => [V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1)]],
                [-1, 0, (y0, y1) => [V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1)]],
                [1, 0, (y0, y1) => [V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0)]],
            ]) {
                const k = ch(c + dc, r + dr);
                if (k === '#') quad(walls, p(0, H), 1, H / s);
                else if (k === ' ' && L.skirt) { const q = p(-L.skirt, 0); quad(floor, [q[1], q[0], q[3], q[2]], 1, L.skirt / s); }
            }
        }
    }
    g.add(toMesh(walls, L.wall), toMesh(floor, L.floor));
    if (L.ceil) g.add(toMesh(ceil, L.ceil));
    if (L.skyTop) g.add(skyDome(L.skyTop, L.skyBot));
    const cx = (Z.w * s) / 2, cz = (Z.h * s) / 2;
    if (zoneId === 'sky') {
        // a sea of cloud below, the island far under it, and other towers of the Aerie around
        const below = clouds(-40, -16, low ? 14 : 30, 260); below.position.set(cx, 0, cz); g.add(below);
        const up = clouds(40, 90, low ? 5 : 10, 420); up.position.set(cx, 0, cz); g.add(up);
        for (const [x, z, sc] of [[-22, -6, 1.3], [cx * 2 + 20, 6, 1.5], [cx, -30, 1.8], [cx - 30, cz * 2 + 26, 1.2], [cx + 34, cz * 2 + 22, 1.0]]) {
            const t = makeProp('tower'); t.position.set(x, -9, z); t.scale.setScalar(sc); g.add(t);
            const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); puff.scale.set(13 * sc, 3.5, 13 * sc); puff.position.set(x, -9.5, z); g.add(puff);
        }
    }
    if (zoneId === 'sea') {
        // the surface, far overhead, and shafts of light coming down through it
        const top = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: 0x9fe6f2, transparent: true, opacity: 0.5, fog: false, side: THREE.DoubleSide }));
        top.rotation.x = Math.PI / 2; top.position.set(cx, 26, cz); g.add(top);
        const shaft = new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, map: glow() });
        for (let i = 0; i < (low ? 6 : 14); i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(5 + hash3(i, 1, 1) * 5, 40), shaft);
            m.position.set(hash3(i, 2, 2) * Z.w * s, 12, hash3(i, 3, 3) * Z.h * s); m.rotation.set(0, hash3(i, 4, 4) * 3, 0.25);
            m.userData.shaft = i; g.add(m);
        }
        // sea-fans and coral on the walls' feet, and a whale a long way off
        const fan = new THREE.MeshStandardMaterial({ color: 0xff8f7a, roughness: 1 });
        for (let i = 0; i < (low ? 14 : 40); i++) {
            const c = Math.floor(hash3(i, 5, 5) * Z.w), r = Math.floor(hash3(i, 6, 6) * Z.h);
            if (ch(c, r) !== '#' ) continue;
            const m = new THREE.Mesh(new THREE.ConeGeometry(0.5 + hash3(i, 7, 7) * 0.5, 1.4 + hash3(i, 8, 8) * 1.5, 14), fan);
            m.position.set((c + 0.5) * s, H + 0.5, (r + 0.5) * s); g.add(m);
        }
        const whale = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x0d4a66, fog: true }));
        whale.scale.set(26, 7, 8); whale.userData.whale = true; g.add(whale);
    }
    return g;
}

/** Which way a thing in a grid zone should face: toward the most open floor next to it. */
export function faceOpen(Z, t) {
    if (Z.kind !== 'grid') return 0;
    let best = [0, 1], score = -1;
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let n = 0;
        for (let k = 1; k <= 3; k++) { const ch = Z.rows[t.r + dr * k]?.[t.c + dc * k]; if (!ch || ch === '#' || ch === ' ') break; n++; }
        if (n > score) { score = n; best = [dc, dr]; }
    }
    return Math.atan2(best[0], best[1]);
}

/** Which way a landmark on the open island should face: back along the path that leads to it, so you meet its front. */
export function facePath(t) {
    let best = null, bd = 8;
    for (const name in MARKS) { const d = Math.hypot(MARKS[name][0] - t.x, MARKS[name][1] - t.z); if (d < bd) { bd = d; best = name; } }
    if (!best) return 0;
    for (const [a, b] of PATHS) {
        // paths are listed in the order the story walks them: face the end you come from
        if (b === best) return Math.atan2(MARKS[a][0] - t.x, MARKS[a][1] - t.z);
    }
    for (const [a, b] of PATHS) if (a === best) return Math.atan2(MARKS[b][0] - t.x, MARKS[b][1] - t.z);
    return 0;
}
