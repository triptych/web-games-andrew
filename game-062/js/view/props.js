// Everything that stands on a hole: trees for each realm (instanced, with outlines), rocks, walls,
// spring mushrooms, cloud bumpers, the windmill, geysers, runes, the tee box, the flag and cup, the
// Bogey Seal, decor (sheep, cottages, tents, snowmen, forges, arches…) and background scatter.

import * as THREE from 'three';
import { part, merge, toonMat, outlineMat, toonMesh, withOutline, sph, cyl, cone, box, caps, tor, ico, dodec, paint, paintGrad, jitter, gradientMap } from './toon.js';
import { SURF } from '../sim/realms.js';
import { TREE_SHAPES } from '../sim/course.js';

const PI = Math.PI;

// ---------------------------------------------------------------- tree models (unit scale)
export function treeGeo(style, P, v = 0) {
    const L0 = P.leaves[0], L1 = P.leaves[1];
    const g = [];
    switch (style) {
        case 'oak':
            g.push(part(cyl(0.28, 0.4, 3.4, 8), P.trunk, [0, 1.7, 0]));
            for (const [x, y, z, r] of [[0, 4.1, 0, 2.0], [1.1, 3.6, 0.3, 1.4], [-1.0, 3.7, -0.4, 1.4], [0.2, 5.0, -0.2, 1.3], [-0.3, 3.5, 1.0, 1.2]]) g.push(part(jitter(paintGrad(ico(r, 1), L0, L1, 1), 0.06, x * 10 + v), null, [x, y, z]));
            break;
        case 'palm': {
            for (let i = 0; i < 6; i++) g.push(part(cyl(0.24, 0.3, 1.0, 7), i % 2 ? P.trunk : '#b08a5a', [i * 0.1, 0.5 + i * 0.95, 0], [0, 0, -0.06]));
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * PI * 2;
                const leaf = new THREE.ConeGeometry(0.45, 3.2, 4);
                leaf.scale(1, 1, 0.25);
                g.push(part(paintGrad(leaf, L1, L0, 1), null, [0.6 + Math.sin(a) * 1.3, 5.6, Math.cos(a) * 1.3], [Math.cos(a) * 1.25, a, -Math.sin(a) * 0.0 + 0], [1, 1, 1]));
            }
            g.push(part(sph(0.35, 8, 6), '#7a5a2a', [0.55, 5.6, 0]));
            break;
        }
        case 'pine':
            g.push(part(cyl(0.22, 0.3, 1.4, 7), P.trunk, [0, 0.7, 0]));
            for (const [y, r, h] of [[2.0, 1.9, 2.4], [3.4, 1.45, 2.1], [4.6, 1.0, 1.8]]) {
                g.push(part(paintGrad(cone(r, h, 8), L0, L1, 1), null, [0, y, 0]));
                if (P.key === 'frost') g.push(part(cone(r * 0.62, h * 0.42, 8), '#ffffff', [0, y + h * 0.3, 0]));
            }
            break;
        case 'cactus':
            g.push(part(caps(0.42, 2.4, 10), '#4a9a4a', [0, 1.5, 0]));
            g.push(part(caps(0.26, 0.9, 8), '#4a9a4a', [0.6, 1.8, 0], [0, 0, -0.2]));
            g.push(part(caps(0.26, 0.6, 8), '#4a9a4a', [-0.58, 1.4, 0], [0, 0, 0.3]));
            g.push(part(sph(0.18, 6, 5), '#ff6a8a', [0, 2.95, 0]));
            break;
        case 'spire':
            g.push(part(cone(0.8, 5.2, 6), '#2a1e2a', [0, 2.6, 0]));
            g.push(part(cone(0.35, 2.0, 5), '#ff7a3a', [0.5, 1.0, 0.2], [0, 0, -0.3]));
            g.push(part(cone(0.3, 1.6, 5), '#ffb04a', [-0.4, 0.8, -0.3], [0.2, 0, 0.3]));
            break;
        case 'column':
            g.push(part(cyl(0.9, 1.0, 0.5, 12), '#e8e0f0', [0, 0.25, 0]));
            g.push(part(cyl(0.7, 0.7, 5.2, 12), '#f4eefc', [0, 3.0, 0]));
            g.push(part(cyl(1.0, 0.8, 0.5, 12), '#e8e0f0', [0, 5.8, 0]));
            g.push(part(tor(0.72, 0.06, 6, 16), '#ffd84a', [0, 5.4, 0], [PI / 2, 0, 0]));
            break;
    }
    return merge(g);
}

// One InstancedMesh (plus an instanced outline) per tree style.
export function instancedTrees(list, P) {
    const byStyle = new Map();
    for (const t of list) { const s = t.style; if (!byStyle.has(s)) byStyle.set(s, []); byStyle.get(s).push(t); }
    const group = new THREE.Group();
    const mat = toonMat({ vertexColors: true });
    for (const [style, items] of byStyle) {
        const geo = treeGeo(style, P);
        const im = new THREE.InstancedMesh(geo, mat, items.length);
        const ol = new THREE.InstancedMesh(geo, outlineMat(0.06), items.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        items.forEach((t, i) => {
            e.set(0, t.rot ?? 0, 0); q.setFromEuler(e);
            m4.compose(new THREE.Vector3(t.x, t.y - 0.1, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
            im.setMatrixAt(i, m4); ol.setMatrixAt(i, m4);
        });
        im.castShadow = true;
        im.userData.items = items;
        im.userData.style = style;
        group.add(im, ol);
    }
    return group;
}

// ---------------------------------------------------------------- decor
export function decorMesh(kind, P) {
    const g = [];
    switch (kind) {
        case 'sheep':
            g.push(part(sph(0.7, 12, 10), '#ffffff', [0, 0.9, 0], [0, 0, 0], [1.2, 0.9, 0.9]));
            for (let i = 0; i < 6; i++) g.push(part(sph(0.32, 8, 6), '#f4f4f4', [Math.sin(i) * 0.6, 1.2 + (i % 2) * 0.15, Math.cos(i * 1.7) * 0.4]));
            g.push(part(sph(0.32, 10, 8), '#3a3038', [0.85, 1.05, 0], [0, 0, 0], [1.2, 1, 0.9]));
            for (const [x, z] of [[0.5, 0.3], [0.5, -0.3], [-0.5, 0.3], [-0.5, -0.3]]) g.push(part(cyl(0.08, 0.08, 0.5, 6), '#3a3038', [x, 0.3, z]));
            break;
        case 'cottage':
            g.push(part(box(4, 3, 3.4), '#fff2d8', [0, 1.5, 0]));
            g.push(part(new THREE.ConeGeometry(3.3, 2.4, 4), '#d84a3a', [0, 4.2, 0], [0, PI / 4, 0], [1.2, 1, 1]));
            g.push(part(box(0.8, 1.4, 0.1), '#7a4a2a', [0, 0.7, 1.72]));
            for (const s of [-1, 1]) g.push(part(box(0.7, 0.7, 0.1), '#8ad0ff', [s * 1.3, 1.8, 1.72]));
            g.push(part(box(0.5, 1.4, 0.5), '#a8a0a0', [1.2, 4.6, -0.6]));
            break;
        case 'fence':
            for (let i = 0; i < 6; i++) g.push(part(box(0.15, 1.1, 0.15), '#f4ecd8', [i * 1.2 - 3, 0.55, 0]));
            for (const y of [0.4, 0.85]) g.push(part(box(7, 0.12, 0.08), '#f4ecd8', [0, y, 0]));
            break;
        case 'flowers':
            for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.4 + (i % 3) * 0.4; g.push(part(sph(0.2, 6, 5), P.flowers[i % Math.max(1, P.flowers.length)] ?? '#ff6a8a', [Math.sin(a) * r, 0.35, Math.cos(a) * r])); }
            break;
        case 'mushroom':
            g.push(part(cyl(0.3, 0.38, 1.2, 8), '#fff4e0', [0, 0.6, 0]));
            g.push(part(new THREE.SphereGeometry(1.0, 14, 8, 0, PI * 2, 0, PI / 2), '#e83a4a', [0, 1.1, 0], [0, 0, 0], [1, 0.7, 1]));
            for (let i = 0; i < 5; i++) { const a = i * 1.3; g.push(part(sph(0.14, 6, 4), '#ffffff', [Math.sin(a) * 0.6, 1.6 - (i % 2) * 0.12, Math.cos(a) * 0.6])); }
            break;
        case 'tent':
            g.push(part(new THREE.ConeGeometry(2.6, 3.2, 6), '#e8d0a0', [0, 1.6, 0]));
            g.push(part(new THREE.ConeGeometry(2.62, 0.8, 6, 1, true), '#c83a3a', [0, 2.1, 0]));
            g.push(part(cyl(0.06, 0.06, 1.2, 4), '#5a3a2a', [0, 3.6, 0]));
            g.push(part(box(0.5, 0.3, 0.02), '#3a9aa8', [0.25, 4.0, 0]));
            break;
        case 'camel':
            g.push(part(sph(0.9, 10, 8), '#d8a860', [0, 1.8, 0], [0, 0, 0], [1.4, 0.8, 0.8]));
            g.push(part(sph(0.5, 8, 6), '#c89850', [0, 2.5, 0]));
            g.push(part(caps(0.18, 1.0, 6), '#d8a860', [1.2, 2.3, 0], [0, 0, -0.6]));
            g.push(part(sph(0.3, 8, 6), '#d8a860', [1.6, 2.9, 0], [0, 0, 0], [1.4, 0.9, 0.9]));
            for (const [x, z] of [[0.6, 0.3], [0.6, -0.3], [-0.6, 0.3], [-0.6, -0.3]]) g.push(part(cyl(0.1, 0.08, 1.4, 6), '#c89850', [x, 0.7, z]));
            break;
        case 'urn':
            g.push(part(new THREE.LatheGeometry([[0.01, 0], [0.4, 0.05], [0.6, 0.5], [0.45, 1.0], [0.3, 1.2], [0.4, 1.35], [0.01, 1.36]].map(([x, y]) => new THREE.Vector2(x, y)), 12), '#c8743a'));
            g.push(part(tor(0.55, 0.04, 6, 14), '#3a9aa8', [0, 0.55, 0], [PI / 2, 0, 0]));
            break;
        case 'obelisk':
            g.push(part(box(1.0, 6, 1.0), '#e8cf94', [0, 3, 0], [0, 0, 0], [1, 1, 1]));
            g.push(part(new THREE.ConeGeometry(0.72, 0.9, 4), '#ffd040', [0, 6.45, 0], [0, PI / 4, 0]));
            g.push(part(box(1.6, 0.4, 1.6), '#d8bf84', [0, 0.2, 0]));
            break;
        case 'skull':
            g.push(part(sph(0.5, 10, 8), '#f4ecd8', [0, 0.45, 0]));
            for (const s of [-1, 1]) g.push(part(sph(0.13, 6, 5), '#2a2020', [s * 0.18, 0.5, 0.38]));
            for (let i = 0; i < 2; i++) g.push(part(caps(0.08, 1.0, 4), '#f4ecd8', [0, 0.12, 0.7 + i * 0.2], [0, i * 1.2 + 0.5, PI / 2]));
            break;
        case 'snowman':
            g.push(part(sph(0.8, 12, 10), '#ffffff', [0, 0.75, 0]));
            g.push(part(sph(0.55, 12, 10), '#ffffff', [0, 1.85, 0]));
            g.push(part(sph(0.4, 12, 10), '#ffffff', [0, 2.65, 0]));
            g.push(part(cone(0.08, 0.5, 6), '#ff8a2a', [0, 2.65, 0.6], [PI / 2, 0, 0]));
            g.push(part(cyl(0.32, 0.32, 0.5, 10), '#2a2a3a', [0, 3.15, 0]));
            g.push(part(cyl(0.48, 0.48, 0.06, 12), '#2a2a3a', [0, 2.92, 0]));
            g.push(part(tor(0.42, 0.1, 6, 14), '#e83a4a', [0, 2.3, 0], [PI / 2, 0, 0]));
            break;
        case 'igloo':
            g.push(part(new THREE.SphereGeometry(2.4, 16, 10, 0, PI * 2, 0, PI / 2), '#f0f8ff'));
            g.push(part(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10, 1, false, 0, PI), '#e0eefa', [0, 0.6, 2.1], [0, -PI / 2, 0]));
            break;
        case 'forge':
            g.push(part(box(3, 2, 2.4), '#5a4a4a', [0, 1, 0]));
            g.push(part(cyl(0.6, 0.8, 3, 8), '#4a3a3a', [0.9, 3.0, -0.5]));
            g.push(part(box(1.2, 0.8, 0.1), '#ff8a2a', [0, 0.9, 1.22]));
            g.push(part(box(1.0, 0.5, 0.6), '#3a3a44', [-2.0, 0.6, 0.6]));
            break;
        case 'brazier':
            g.push(part(cyl(0.5, 0.25, 0.6, 8), '#3a2a2a', [0, 1.4, 0]));
            g.push(part(cyl(0.08, 0.08, 1.2, 5), '#3a2a2a', [0, 0.6, 0]));
            g.push(part(cone(0.4, 0.9, 6), '#ffb030', [0, 2.0, 0]));
            break;
        case 'arch':
            for (const s of [-1, 1]) g.push(part(cyl(0.5, 0.55, 5, 10), '#f0e8f8', [s * 4, 2.5, 0]));
            g.push(part(tor(4, 0.45, 8, 20, PI), '#f0e8f8', [0, 5, 0]));
            g.push(part(ico(0.5, 0), '#ffd84a', [0, 9.3, 0]));
            break;
        case 'statue':
            g.push(part(box(2, 1, 2), '#e8e0f0', [0, 0.5, 0]));
            g.push(part(cyl(0.5, 0.7, 2.4, 10), '#f4eefc', [0, 2.2, 0]));
            g.push(part(sph(0.6, 12, 10), '#f4eefc', [0, 3.8, 0]));
            g.push(part(cyl(0.05, 0.05, 2.4, 6), '#ffd84a', [0.7, 3.0, 0], [0, 0, -0.5]));
            break;
        case 'flag':
            break;
        default:
            g.push(part(box(1, 1, 1), '#ff00ff', [0, 0.5, 0]));
    }
    if (!g.length) return null;
    return toonMesh(g, { outline: 0.04 });
}

// ---------------------------------------------------------------- set pieces
export function windmillMesh() {
    const grp = new THREE.Group();
    const tower = toonMesh([
        part(cyl(1.4, 2.3, 7.5, 10), '#fff2dc', [0, 3.75, 0]),
        part(new THREE.ConeGeometry(2.0, 2.4, 10), '#c83a3a', [0, 8.6, 0]),
        part(box(1.0, 1.8, 0.2), '#7a4a2a', [0, 0.9, 2.2]),
        part(box(0.8, 0.8, 0.2), '#8ad0ff', [0, 4.6, 1.8]),
    ], { outline: 0.05 });
    grp.add(tower);
    const hub = new THREE.Group();
    hub.position.set(0, 6.2, 2.3);
    const blades = [part(cyl(0.35, 0.35, 0.5, 10), '#7a4a2a', [0, 0, 0], [PI / 2, 0, 0])];
    for (let i = 0; i < 4; i++) {
        const a = (i * PI) / 2;
        const b = [part(box(0.25, 5.2, 0.15), '#7a4a2a', [0, 3.0, 0]), part(box(1.3, 4.2, 0.08), '#f4ecd8', [0.7, 3.3, 0.05])];
        for (const g of b) { g.rotateZ(a); blades.push(g); }
    }
    const bm = toonMesh(blades, { outline: 0.04 });
    hub.add(bm);
    grp.add(hub);
    grp.userData.hub = hub;
    return grp;
}

export function springMesh(s = 1) {
    return toonMesh([
        part(cyl(0.3 * s, 0.4 * s, 1.0 * s, 8), '#fff4e0', [0, 0.5 * s, 0]),
        part(new THREE.SphereGeometry(1.15 * s, 16, 8, 0, PI * 2, 0, PI / 2), '#8a4ae8', [0, 0.9 * s, 0], [0, 0, 0], [1, 0.6, 1]),
        ...[0, 1, 2, 3, 4, 5].map((i) => part(sph(0.16 * s, 6, 4), '#ffe8ff', [Math.sin(i * 1.05) * 0.75 * s, 1.35 * s - (i % 2) * 0.1 * s, Math.cos(i * 1.05) * 0.75 * s])),
    ], { outline: 0.04, emissive: '#2a0a4a' });
}

export function bumperMesh(r = 1.4) {
    const g = [];
    for (let i = 0; i < 6; i++) g.push(part(sph(r * (0.55 + (i % 3) * 0.12), 10, 8), '#ffffff', [Math.sin(i) * r * 0.5, Math.cos(i * 2.1) * r * 0.25, Math.cos(i) * r * 0.5]));
    return toonMesh(g, { outline: 0.04, emissive: '#d0c8ff', emissiveIntensity: 0.3 });
}

export function rockMesh(r, color = '#9a9088', seed = 1) {
    const g = new THREE.DodecahedronGeometry(r, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.85 + Math.abs(Math.sin(i * 7.31 + seed)) * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
    g.computeVertexNormals();
    return toonMesh([part(g, color)], { outline: 0.04 });
}

export function teeBoxMesh(P) {
    return toonMesh([
        part(box(5, 0.3, 5), P.tee, [0, -0.05, 0]),
        ...[-1, 1].map((s) => part(sph(0.28, 10, 8), '#ffd040', [s * 1.6, 0.25, 0.8])),
        part(cyl(0.05, 0.03, 0.3, 6), '#ffffff', [0, 0.12, 0]),
    ], { outline: 0.03, receive: true });
}

// Flag pole with a waving cloth (vertex shader) and the cup.
export function flagMesh(color = '#ff3a4a') {
    const grp = new THREE.Group();
    grp.add(toonMesh([part(cyl(0.05, 0.05, 4.2, 6), '#f4f4f4', [0, 2.1, 0]), part(sph(0.1, 8, 6), '#ffd040', [0, 4.25, 0])], { outline: 0.02 }));
    const cg = new THREE.PlaneGeometry(1.5, 0.95, 8, 4);
    cg.translate(0.75, 3.65, 0);
    const mat = new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide, gradientMap: gradientMap(3) });
    const uTime = { value: 0 };
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
float k = position.x / 1.5;
transformed.z += sin(uTime * 6.0 - position.x * 3.0) * 0.18 * k;
transformed.y += sin(uTime * 4.0 - position.x * 2.0) * 0.05 * k;`);
    };
    mat.customProgramCacheKey = () => 'flag';
    const cloth = new THREE.Mesh(cg, mat);
    cloth.castShadow = true;
    grp.add(cloth);
    // cup: dark disc + rim
    const cup = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#141018' }));
    cup.position.y = 0.03;
    grp.add(cup);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 20).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#f4f4f4' }));
    rim.position.y = 0.025;
    grp.add(rim);
    grp.userData.uTime = uTime;
    grp.userData.cloth = cloth;
    return grp;
}

// The Bogey Seal: a hexagon-patterned fresnel dome over the cup.
export function sealMesh() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime, uFade; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    vec2 h = vP.xz * 3.0 + vec2(vP.y * 2.0, 0.0);
    vec2 g = abs(fract(h + vec2(0.5 * floor(h.y), 0.0)) - 0.5);
    float hex = smoothstep(0.42, 0.48, max(g.x, g.y));
    float scan = 0.5 + 0.5 * sin(vP.y * 10.0 - uTime * 4.0);
    vec3 col = mix(vec3(0.55, 0.2, 1.0), vec3(1.0, 0.5, 1.0), scan);
    gl_FragColor = vec4(col * (f * 1.4 + hex * 0.5 + 0.12), (f + hex * 0.4 + 0.1) * uFade);
}`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, PI * 2, 0, PI / 2), mat);
    return m;
}

export function geyserMesh() {
    return toonMesh([
        part(cyl(1.3, 1.8, 0.7, 10), '#4a3a3a', [0, 0.2, 0]),
        part(cyl(0.8, 0.9, 0.2, 10), '#ff8a3a', [0, 0.56, 0]),
    ], { outline: 0.04, emissive: '#401000', emissiveIntensity: 0.5 });
}

export function runeMesh() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vU;
void main(){ float r = length(vU); float a = atan(vU.y, vU.x);
 float ring = smoothstep(0.08, 0.0, abs(r - 0.85)) + smoothstep(0.06, 0.0, abs(r - 0.55)) * (0.5 + 0.5 * step(0.0, sin(a * 6.0 + uTime * 2.0)));
 float glyph = smoothstep(0.05, 0.0, abs(r - 0.3 - 0.06 * sin(a * 5.0 - uTime * 3.0)));
 float v = (ring + glyph) * smoothstep(1.0, 0.9, r);
 gl_FragColor = vec4(vec3(0.6, 0.85, 1.0) * v * 1.6, v); }`,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-PI / 2), mat);
}

export function iceWallMesh(len) {
    const g = new THREE.BoxGeometry(1.2, 3.4, len, 1, 2, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 1) p.setY(i, p.getY(i) + Math.sin(i * 3.7) * 0.4);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, toonMat({ color: '#bfeaff', emissive: '#4a8ac8', emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }));
    withOutline(m, 0.04, '#2a4a8a');
    return m;
}

export function moleHillMesh() {
    return toonMesh([part(new THREE.SphereGeometry(1.4, 12, 6, 0, PI * 2, 0, PI / 2), '#7a5034', [0, -0.2, 0], [0, 0, 0], [1, 0.55, 1]), part(new THREE.CircleGeometry(0.8, 12).rotateX(-PI / 2), '#2a1a12', [0, 0.58, 0])], { outline: 0.04 });
}

// ---------------------------------------------------------------- background scatter
// Trees, rocks and flavour props beyond the playable area, deterministic per hole.
export function scatterBackground(c, P, seed = 1, density = 1) {
    const list = [];
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const styles = { meadow: ['oak', 'oak', 'pine'], sand: ['palm', 'cactus', 'cactus'], frost: ['pine'], cinder: ['spire'], sky: ['column'] }[P.key];
    const n = Math.round((c.sky ? 0 : 230) * density);
    const roughW = c.hole.roughW ?? 16;
    const W = (c.nx - 1) * c.cell, H = (c.nz - 1) * c.cell, pad = 150;
    for (let i = 0; i < n * 4 && list.length < n; i++) {
        // inside the course grid, or out in the wider world beyond it
        const far = i % 3 === 2;
        const x = far ? c.x0 - pad + rnd() * (W + pad * 2) : c.x0 + rnd() * W, z = far ? c.z0 - pad + rnd() * (H + pad * 2) : c.z0 + rnd() * H;
        const inGrid = x >= c.x0 && x <= c.x0 + W && z >= c.z0 && z <= c.z0 + H;
        if (far && inGrid) continue;
        if (inGrid) {
            if (c.dAt(x, z) < roughW + 2) continue;
            const sid = c.surfAt(x, z);
            if (sid === SURF.water || sid === SURF.lava || sid === SURF.void) continue;
        }
        const y = inGrid ? c.heightAt(x, z) : c.base(x, z) + (c.hole.mound ?? 2.2);
        list.push({ x, y, z, s: 0.9 + rnd() * 0.7, style: styles[Math.floor(rnd() * styles.length)], rot: rnd() * PI * 2 });
    }
    return list;
}

export { TREE_SHAPES };
