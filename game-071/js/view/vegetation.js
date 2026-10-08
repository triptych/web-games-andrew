/**
 * vegetation.js — trees, bushes and rocks as instanced meshes in three levels of detail.
 *
 * Near: full models (branch cards with painted fronds, bark trunks). Mid: lighter models.
 * Far: crossed-quad impostors rendered from the near models at boot. Bands overlap and the
 * shaders cross-fade them with a screen-space dither, so nothing pops.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREE_TYPES } from '../sim/flora.js';
import { WORLD } from '../sim/geography.js';
import { MASK_RES } from '../sim/terrain.js';
import { patch, G, GLSL_WIND, GLSL_NOISE } from './shaders.js';
import { mulberry32 } from '../sim/rng.js';

// ---------------------------------------------------------------- the foliage atlas
const AW = 1024, AH = 512;
// atlas regions in uv: [u0, v0, u1, v1] (v up)
const R = {
    bark: [0, 0, 0.25, 1], birch: [0.25, 0, 0.5, 1],
    fir: [0.5, 0.5, 0.75, 1], pine: [0.75, 0.5, 1, 1],
    leaf: [0.5, 0, 0.75, 0.5], fern: [0.75, 0.25, 1, 0.5], core: [0.75, 0, 1, 0.25],
};

function drawAtlas() {
    const c = document.createElement('canvas');
    c.width = AW; c.height = AH;
    const g = c.getContext('2d');
    const rnd = mulberry32(777);
    // pine bark: brown-grey with vertical fissures and plates
    g.fillStyle = '#4a3b2e'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 900; i++) {
        const x = rnd() * 256, y = rnd() * 512, w = 6 + rnd() * 20, h = 10 + rnd() * 40;
        const v = 50 + rnd() * 50;
        g.fillStyle = `rgb(${v + 18},${v + 6},${v - 6})`;
        g.fillRect(x, y, w, h); g.fillRect(x - 256, y, w, h);
    }
    for (let i = 0; i < 70; i++) {
        const x = rnd() * 256; g.strokeStyle = `rgba(20,14,10,${0.5 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 3;
        g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 512; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y); g.stroke();
    }
    // birch bark: white with dark lenticels and scars
    g.fillStyle = '#e9e6dc'; g.fillRect(256, 0, 256, 512);
    for (let i = 0; i < 300; i++) {
        const x = 256 + rnd() * 256, y = rnd() * 512, w = 6 + rnd() * 30, h = 1 + rnd() * 3;
        g.fillStyle = `rgba(30,28,26,${0.5 + rnd() * 0.5})`; g.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 40; i++) {
        const x = 256 + rnd() * 256, y = rnd() * 512;
        g.fillStyle = 'rgba(25,22,20,0.85)'; g.beginPath(); g.ellipse(x, y, 6 + rnd() * 14, 4 + rnd() * 8, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(200,190,170,0.25)'; for (let i = 0; i < 200; i++) g.fillRect(256 + rnd() * 256, rnd() * 512, 2, 8);
    // conifer fronds: a stem from the left edge with needles; fir dense, pine long and sparse
    const frond = (ox, oy, needleLen, density, cols) => {
        g.save(); g.translate(ox, oy);
        const stemY = 128;
        const twigs = [[0, 0, 250, 3.5], [-0.42, 30, 150, 2], [0.42, 30, 150, 2], [-0.5, 110, 110, 1.6], [0.5, 110, 110, 1.6]];
        for (const [ang, start, len, lw] of twigs) {
            const x0 = start, y0 = stemY + (ang ? Math.sign(ang) * 4 : 0);
            for (let t = 0; t < len; t += 2.2) {
                const px = x0 + t * Math.cos(ang), py = y0 + t * Math.sin(ang);
                const taper = 1 - t / (len * 1.1);
                for (let s = 0; s < density; s++) {
                    const side = s % 2 ? 1 : -1;
                    const a = ang + side * (0.75 + rnd() * 0.55) + (rnd() - 0.5) * 0.2;
                    const L = needleLen * taper * (0.55 + rnd() * 0.5);
                    g.strokeStyle = cols[Math.floor(rnd() * cols.length)];
                    g.lineWidth = 1.5;
                    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); g.stroke();
                }
            }
            g.strokeStyle = '#4a3420'; g.lineWidth = lw;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + len * Math.cos(ang), y0 + len * Math.sin(ang)); g.stroke();
        }
        g.restore();
    };
    frond(512, 0, 26, 4, ['#28502a', '#2f5e30', '#3a6d36', '#21431f', '#447a3c', '#1d3b1c']);
    frond(768, 0, 38, 3, ['#36602e', '#40703a', '#4c7c40', '#2c5226', '#577f45']);
    // the inner crown: a dense dark green that fills the gaps between cards
    g.fillStyle = '#1f3a1d'; g.fillRect(768, 384, 256, 128);
    for (let i = 0; i < 2600; i++) { g.fillStyle = ['#2a4a26', '#183018', '#2f5a2c', '#203d1e'][Math.floor(rnd() * 4)]; g.fillRect(768 + rnd() * 256, 384 + rnd() * 128, 2, 5); }
    // leaf clusters (light grey-green, tinted per tree by instance colour)
    const leaves = (ox, oy, n, size, tint) => {
        for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 112;
            const x = ox + 128 + Math.cos(a) * r, y = oy + 128 + Math.sin(a) * r;
            const v = 170 + rnd() * 70;
            g.fillStyle = tint(v);
            g.save(); g.translate(x, y); g.rotate(rnd() * Math.PI * 2);
            g.beginPath(); g.ellipse(0, 0, size * (0.7 + rnd() * 0.5), size * 0.55, 0, 0, Math.PI * 2); g.fill();
            g.restore();
        }
        g.strokeStyle = 'rgba(60,45,30,0.9)'; g.lineWidth = 2;
        for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(ox + 128, oy + 128); const a = rnd() * Math.PI * 2; g.lineTo(ox + 128 + Math.cos(a) * 90, oy + 128 + Math.sin(a) * 90); g.stroke(); }
    };
    leaves(512, 256, 420, 9, (v) => `rgb(${v * 0.9},${v},${v * 0.75})`);
    // fern / bush fronds
    g.save(); g.translate(768, 256); g.scale(1, 0.5);
    for (let f = 0; f < 5; f++) {
        const a0 = -Math.PI / 2 + (f - 2) * 0.45;
        g.strokeStyle = '#3c5a2a'; g.lineWidth = 2;
        for (let t = 0; t < 120; t += 5) {
            const x = 128 + Math.cos(a0) * t * 1.0, y = 250 + Math.sin(a0) * t * 1.8;
            const L = 24 * (1 - t / 140);
            g.strokeStyle = ['#355a26', '#406a2e', '#2d4c20'][f % 3]; g.lineWidth = 4;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y - L * 0.3); g.moveTo(x, y); g.lineTo(x - L, y - L * 0.3); g.stroke();
        }
    }
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

// ---------------------------------------------------------------- geometry helpers
function remapUV(geo, rect, uScale = 1, vScale = 1) {
    const uv = geo.attributes.uv;
    const wrap = (t, k) => (k === 1 ? t : t * k - Math.floor(t * k - 1e-6));
    for (let i = 0; i < uv.count; i++) {
        const u = wrap(uv.getX(i), uScale), v = wrap(uv.getY(i), vScale);
        uv.setXY(i, rect[0] + (rect[2] - rect[0]) * Math.min(0.995, Math.max(0.005, u)), rect[1] + (rect[3] - rect[1]) * Math.min(0.995, Math.max(0.005, v)));
    }
    return geo;
}

function attr(geo, name, v) {
    geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(v), 1));
    return geo;
}

function trunk(h, r0, r1, segs, rect, bend = 0) {
    const g = new THREE.CylinderGeometry(r1, r0, h, segs, Math.max(1, Math.round(h / 3)), true);
    g.translate(0, h / 2, 0);
    if (bend) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y / h * 2.5) * bend * (y / h)); }
    }
    remapUV(g, rect, 1, 1);
    // stretch v along the trunk so the bark tiles once per ~3 m
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, rect[1] + (rect[3] - rect[1]) * (((pos.getY(i) / 3.2) % 1 + 1) % 1 * 0.98 + 0.01));
    attr(g, 'leaf', 0);
    g.deleteAttribute('normal'); g.computeVertexNormals();
    return g;
}

/** A card hanging out from (0, y, 0) at angle `ang`, `len` long, drooping. */
function card(y, ang, len, wid, droop, rect, center = [0, 0, 0]) {
    const g = new THREE.PlaneGeometry(len, wid, 2, 1);
    g.translate(len / 2, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        p.setZ(i, p.getY(i)); p.setY(i, -droop * (x / len) ** 2 * len);
    }
    g.rotateY(ang);
    g.translate(0, y, 0);
    remapUV(g, rect);
    // soft volumetric normals: away from the crown's centre and upward
    const n = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3(p.getX(i) - center[0], (p.getY(i) - center[1]) * 0.6 + 0.6, p.getZ(i) - center[2]).normalize();
        n.set([v.x, v.y, v.z], i * 3);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    attr(g, 'leaf', 1);
    return g;
}

function conifer(H, lod, sparseBottom, rect, rnd) {
    const parts = [trunk(H, H * 0.028, H * 0.006, lod === 0 ? 7 : 4, R.bark)];
    const whorls = lod === 0 ? 15 : 7;
    const per = lod === 0 ? 7 : 4;
    const start = sparseBottom ? 0.38 : 0.12;
    for (let w = 0; w < whorls; w++) {
        const t = start + (1 - start) * (w / whorls) ** 0.92;
        const y = H * t;
        const len = (H * 0.34 * (1 - t) ** 0.95 + H * 0.05) * (lod === 0 ? 1 : 1.15);
        for (let k = 0; k < per; k++) {
            const a = (k / per) * Math.PI * 2 + w * 1.3 + rnd() * 0.4;
            parts.push(card(y + (rnd() - 0.5) * H * 0.02, a, len, len * (lod === 0 ? 0.46 : 0.8), 0.25 + rnd() * 0.15, rect, [0, H * 0.55, 0]));
        }
    }
    // a top tuft
    for (let k = 0; k < 3; k++) parts.push(card(H * 0.96, k * 2.1, H * 0.07, H * 0.06, -0.6, rect, [0, H * 0.6, 0]));
    // an inner crown cone fills the see-through gaps
    const y0 = H * (start + 0.04), cr = (H * 0.34 * (1 - start) ** 0.95 + H * 0.05) * 0.55;
    const core = new THREE.ConeGeometry(cr, H * 0.98 - y0, lod === 0 ? 8 : 5, 1, true);
    core.translate(0, y0 + (H * 0.98 - y0) / 2, 0);
    remapUV(core, R.core);
    attr(core, 'leaf', 1);
    parts.push(core);
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function birch(H, lod, rnd) {
    const parts = [trunk(H * 0.9, H * 0.022, H * 0.008, lod === 0 ? 6 : 4, R.birch, H * 0.04)];
    const crownY = H * 0.68, crownR = H * 0.24;
    const n = lod === 0 ? 46 : 18;
    for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, el = (rnd() - 0.35) * 1.4;
        const r = crownR * (0.4 + rnd() * 0.6);
        const cx = Math.cos(a) * Math.cos(el) * r, cy = crownY + Math.sin(el) * r * 1.3, cz = Math.sin(a) * Math.cos(el) * r;
        const s = H * (lod === 0 ? 0.14 : 0.22) * (0.8 + rnd() * 0.4);
        const g = new THREE.PlaneGeometry(s, s);
        g.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 1.2); g.rotateY(rnd() * Math.PI * 2);
        g.translate(cx, cy, cz);
        remapUV(g, R.leaf);
        const p = g.attributes.position, nn = new Float32Array(p.count * 3);
        for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3(p.getX(k), (p.getY(k) - crownY) * 0.8 + crownR * 0.4, p.getZ(k)).normalize(); nn.set([v.x, v.y, v.z], k * 3); }
        g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
        attr(g, 'leaf', 1);
        parts.push(g);
    }
    if (lod === 0) for (let b = 0; b < 4; b++) {   // a few visible limbs
        const br = trunk(H * 0.25, H * 0.008, H * 0.003, 3, R.birch);
        br.rotateZ(0.9); br.rotateY(b * 1.6 + rnd()); br.translate(0, H * (0.45 + b * 0.08), 0);
        parts.push(br);
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function deadTree(H, lod, rnd) {
    const parts = [trunk(H, H * 0.035, H * 0.006, lod === 0 ? 6 : 4, R.bark, H * 0.03)];
    const nb = lod === 0 ? 9 : 4;
    for (let b = 0; b < nb; b++) {
        const L = H * (0.18 + rnd() * 0.22);
        const br = trunk(L, H * 0.012, H * 0.002, 3, R.bark);
        br.rotateZ(0.6 + rnd() * 0.6); br.rotateY(rnd() * Math.PI * 2);
        br.translate(0, H * (0.3 + rnd() * 0.6), 0);
        parts.push(br);
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function shrub(H, lod, rnd, rect = R.leaf) {
    const parts = [];
    const n = lod === 0 ? 9 : 5;
    for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = H * 0.3 * rnd();
        const s = H * (0.55 + rnd() * 0.35);
        const g = new THREE.PlaneGeometry(s, s);
        g.rotateX(-0.4 - rnd() * 0.6); g.rotateY(a);
        g.translate(Math.cos(a) * r, s * 0.35 + rnd() * H * 0.2, Math.sin(a) * r);
        remapUV(g, rect);
        const p = g.attributes.position, nn = new Float32Array(p.count * 3);
        for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3(p.getX(k), p.getY(k) + H * 0.3, p.getZ(k)).normalize(); nn.set([v.x, v.y, v.z], k * 3); }
        g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
        attr(g, 'leaf', 1);
        parts.push(g);
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/** The Eldertree: a broad, gnarled blossom tree with a dense crown. */
function greatTree(rnd) {
    const H = 16;
    const parts = [trunk(H * 0.55, 1.1, 0.55, 10, R.bark, 0.6)];
    const limbs = [];
    for (let b = 0; b < 7; b++) {
        const a = b / 7 * Math.PI * 2 + rnd() * 0.5, L = 6 + rnd() * 3;
        const br = trunk(L, 0.45, 0.12, 6, R.bark, 0.4);
        br.rotateZ(0.75 + rnd() * 0.3); br.rotateY(a); br.translate(0, H * 0.45 + rnd() * 1.5, 0);
        parts.push(br);
        limbs.push([Math.cos(a) * L * 0.7, H * 0.45 + L * 0.55, -Math.sin(a) * L * 0.7]);
    }
    for (const [lx, ly, lz] of [...limbs, [0, H * 0.85, 0]]) {
        for (let i = 0; i < 26; i++) {
            const a = rnd() * Math.PI * 2, el = (rnd() - 0.3) * 1.4, r = 1.5 + rnd() * 3;
            const s = 2.4 + rnd() * 1.6;
            const g = new THREE.PlaneGeometry(s, s);
            g.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 1.4); g.rotateY(rnd() * Math.PI * 2);
            const cx = lx + Math.cos(a) * Math.cos(el) * r, cy = ly + Math.sin(el) * r, cz = lz + Math.sin(a) * Math.cos(el) * r;
            g.translate(cx, cy, cz);
            remapUV(g, R.leaf);
            const p = g.attributes.position, nn = new Float32Array(p.count * 3);
            for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3(p.getX(k), p.getY(k) - H * 0.6, p.getZ(k)).normalize(); nn.set([v.x, v.y, v.z], k * 3); }
            g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
            attr(g, 'leaf', 1);
            parts.push(g);
        }
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function rockGeo(detail, seed) {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position, rnd = mulberry32(seed);
    const o = [rnd() * 10, rnd() * 10, rnd() * 10];
    for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const n = Math.sin(v.x * 2.3 + o[0]) * 0.18 + Math.sin(v.y * 3.1 + o[1]) * 0.14 + Math.sin(v.z * 2.7 + o[2]) * 0.16 + Math.sin((v.x + v.z) * 5.3) * 0.06;
        v.multiplyScalar(1 + n);
        v.y *= 0.72;
        if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;   // flat-ish bottoms bed into the ground
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

function crossedQuads(rect) {
    const parts = [];
    for (let k = 0; k < 2; k++) {
        const g = new THREE.PlaneGeometry(1, 1);
        g.translate(0, 0.5, 0);
        g.rotateY(k * Math.PI / 2);
        remapUV(g, rect);
        const p = g.attributes.position, nn = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i) * 1.5, 0.8, p.getZ(i) * 1.5).normalize(); nn.set([v.x, v.y, v.z], i * 3); }
        g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
        attr(g, 'leaf', 1);
        parts.push(g);
    }
    return mergeGeometries(parts);
}

// ---------------------------------------------------------------- materials
// fade: 0 none, 1 fade out beyond uFar (near/mid meshes), 2 fade in beyond uNear (impostors)
function foliageMaterial(map, opts) {
    const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
    const U = { uFadeA: { value: opts.fadeA }, uFadeB: { value: opts.fadeB }, uFadeIn: { value: opts.fadeIn ? 1 : 0 } };
    mat.userData.U = U;
    patch(mat, (sh) => {
        Object.assign(sh.uniforms, U);
        sh.uniforms.uSunDir = G.uSunDir; sh.uniforms.uSunCol = G.uSunCol;
        sh.vertexShader = `attribute float leaf;\nvarying float vLeaf;\nvarying float vDist;\nuniform float uTime;\n${GLSL_WIND}\n` + sh.vertexShader
            .replace('#include <color_vertex>', `#include <color_vertex>
                vLeaf = leaf;
                #ifdef USE_INSTANCING_COLOR
                    vColor.xyz = mix(vec3(1.0), instanceColor.xyz, leaf);
                #endif`)
            .replace('#include <project_vertex>', `
                vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
                vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                float hgt = max(wp.y - base.y, 0.0);
                vec3 sway = windSway(base, hgt * 0.12, ${opts.stiff.toFixed(2)});
                sway += leaf * vec3(sin(uTime * 4.0 + wp.x * 0.7), 0.0, cos(uTime * 3.3 + wp.z * 0.7)) * 0.03 * length(uWind) * hgt * 0.1;
                wp.xyz += sway;
                vDist = distance(base, cameraPosition);
                vec4 mvPosition = viewMatrix * wp;
                gl_Position = projectionMatrix * mvPosition;`);
        sh.fragmentShader = `varying float vLeaf;\nvarying float vDist;\nuniform float uFadeA; uniform float uFadeB; uniform float uFadeIn;\nuniform vec3 uSunCol;\n` + sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                {
                    float f = smoothstep(uFadeA, uFadeB, vDist);
                    float d = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
                    if (uFadeIn > 0.5 ? d > f : d < f) discard;
                }`)
            .replace('normal *= faceDirection;', '')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                {
                    float back = pow(max(dot(normalize(-vViewPosition), (viewMatrix * vec4(-uSunDir, 0.0)).xyz), 0.0), 4.0);
                    totalEmissiveRadiance += diffuseColor.rgb * uSunCol * back * vLeaf * 0.12;
                }`);
    }, `foliage${opts.fadeIn ? 1 : 0}${opts.stiff}`);
    return mat;
}

function rockMaterial(terrainTex, masksTex, fade) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, color: 0xffffff });
    const U = { uAlb: { value: terrainTex.albedo }, uNrm: { value: terrainTex.normal }, uMasks: { value: masksTex }, uFadeA: { value: fade[0] }, uFadeB: { value: fade[1] }, uWorld: { value: WORLD.SIZE }, uHalf: { value: WORLD.HALF } };
    mat.userData.U = U;
    patch(mat, (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = 'varying vec3 vRW; varying vec3 vRN; varying vec3 vBase; varying float vDist;\n' + sh.vertexShader.replace('#include <project_vertex>', `
            #include <project_vertex>
            vRW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            vRN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
            vBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vDist = distance(vBase, cameraPosition);`);
        sh.fragmentShader = `precision highp sampler2DArray;
            uniform sampler2DArray uAlb; uniform sampler2DArray uNrm; uniform sampler2D uMasks; uniform float uFadeA, uFadeB, uWorld, uHalf;
            varying vec3 vRW; varying vec3 vRN; varying vec3 vBase; varying float vDist;
            vec3 rNW; float rRough;
            ${GLSL_NOISE}\n` + sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                { float f = smoothstep(uFadeA, uFadeB, vDist); float d = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (d < f) discard; }`)
            .replace('#include <map_fragment>', `{
                vec3 n = normalize(vRN);
                vec3 bw = pow(abs(n), vec3(4.0)); bw /= bw.x + bw.y + bw.z;
                vec2 ux = vRW.zy / 3.0, uy = vRW.xz / 3.0, uz = vRW.xy / 3.0;
                vec4 a = texture(uAlb, vec3(ux, 2.0)) * bw.x + texture(uAlb, vec3(uy, 2.0)) * bw.y + texture(uAlb, vec3(uz, 2.0)) * bw.z;
                vec3 nx = texture(uNrm, vec3(ux, 2.0)).xyz * 2.0 - 1.0, ny = texture(uNrm, vec3(uy, 2.0)).xyz * 2.0 - 1.0, nz = texture(uNrm, vec3(uz, 2.0)).xyz * 2.0 - 1.0;
                vec3 pert = vec3(0.0, nx.y, nx.x) * bw.x + vec3(ny.x, 0.0, ny.y) * bw.y + vec3(nz.x, nz.y, 0.0) * bw.z;
                vec3 col = a.rgb * vec3(0.95, 0.93, 0.9);
                vec4 M = texture2D(uMasks, (vBase.xz + uHalf) / uWorld);
                float up = smoothstep(0.35, 0.8, n.y + (vnoise(vRW.xz * 1.3) - 0.5) * 0.35);
                // moss in the forests, snow where the ground is snowy
                col = mix(col, vec3(0.16, 0.24, 0.08) * (0.7 + 0.6 * a.a), up * M.a * 0.85);
                col = mix(col, vec3(0.92, 0.95, 1.0), up * smoothstep(0.25, 0.6, M.g));
                diffuseColor.rgb = col;
                rRough = mix(0.85, 0.6, up * M.g);
                rNW = normalize(n + pert * 0.9);
            }`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rRough;')
            .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(rNW, 0.0)).xyz);');
    }, 'rock');
    return mat;
}

// ---------------------------------------------------------------- the manager
const CELL = 64;

export class VegetationView {
    constructor(scene, renderer, flora, terrainView) {
        this.scene = scene;
        this.renderer = renderer;
        this.flora = flora;
        this.group = new THREE.Group();
        this.group.name = 'vegetation';
        scene.add(this.group);
        this.atlas = drawAtlas();
        const rnd = mulberry32(4242);
        // models per type: [near, mid] + impostor
        const H = 13;
        this.models = {
            pine: [conifer(H * 1.15, 0, true, R.pine, rnd), conifer(H * 1.15, 1, true, R.pine, rnd)],
            fir: [conifer(H, 0, false, R.fir, rnd), conifer(H, 1, false, R.fir, rnd)],
            birch: [birch(H * 0.9, 0, rnd), birch(H * 0.9, 1, rnd)],
            autumn: [birch(H * 0.85, 0, rnd), birch(H * 0.85, 1, rnd)],
            dead: [deadTree(H * 0.8, 0, rnd), deadTree(H * 0.8, 1, rnd)],
            shrub: [shrub(2.2, 0, rnd), shrub(2.2, 1, rnd)],
            great: [greatTree(rnd)],
        };
        this.heights = { pine: H * 1.15, fir: H, birch: H * 0.9, autumn: H * 0.85, dead: H * 0.8, shrub: 2.2 };
        this.widths = { pine: H * 0.55, fir: H * 0.6, birch: H * 0.55, autumn: H * 0.52, dead: H * 0.45, shrub: 2.4 };
        this.bushModels = [shrub(1.4, 0, rnd), shrub(1.1, 0, rnd, R.fern)];
        this.rockModels = [[rockGeo(2, 1), rockGeo(1, 1), rockGeo(0, 1)], [rockGeo(2, 2), rockGeo(1, 2), rockGeo(0, 2)], [rockGeo(3, 3), rockGeo(2, 3), rockGeo(1, 3)]];
        this.terrainView = terrainView;
        this.buckets();
        this.built = false;
        this.lastNear = new THREE.Vector3(1e9, 0, 0);
        this.lastFar = new THREE.Vector3(1e9, 0, 0);
        this.specials = [];
    }

    /** A one-off tree (the Eldertree in Brightwater's plaza). */
    addSpecial(type, x, y, z, scale, color) { this.specials.push({ type, x, y, z, scale, color }); }

    buckets() {
        const make = (arr) => {
            const m = new Map();
            for (let i = 0; i < arr.length; i += 6) {
                const k = Math.floor(arr[i] / CELL) * 1000 + Math.floor(arr[i + 2] / CELL);
                let b = m.get(k); if (!b) { b = []; m.set(k, b); } b.push(i);
            }
            return m;
        };
        this.treeCells = make(this.flora.trees);
        this.rockCells = make(this.flora.rocks);
        this.bushCells = make(this.flora.bushes);
    }

    /** Bake an impostor atlas by rendering each near tree model from the side. */
    bakeImpostors() {
        const types = TREE_TYPES;
        const cw = 128, ch = 256;
        const rt = new THREE.WebGLRenderTarget(cw * types.length, ch, { samples: 4 });
        rt.texture.colorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(0.3, 0.6, 1); scene.add(dl);
        const gl = this.renderer.gl;
        const prevT = gl.getRenderTarget(), prevC = gl.getClearColor(new THREE.Color()), prevA = gl.getClearAlpha(), prevTM = gl.toneMapping;
        gl.setRenderTarget(rt);
        gl.setClearColor(0x000000, 0);
        gl.clear();
        gl.toneMapping = THREE.NoToneMapping;
        const mat = new THREE.MeshStandardMaterial({ map: this.atlas, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 });
        mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('normal *= faceDirection;', ''); };
        types.forEach((type, k) => {
            const geo = this.models[type][0];
            const mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            const h = this.heights[type], w = this.widths[type];
            const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h * 1.02, 0, -50, 50);
            cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
            gl.setViewport(k * cw, 0, cw, ch);
            gl.setScissor(k * cw, 0, cw, ch); gl.setScissorTest(true);
            gl.render(scene, cam);
            scene.remove(mesh);
        });
        gl.setScissorTest(false);
        gl.setRenderTarget(prevT);
        gl.setClearColor(prevC, prevA);
        gl.toneMapping = prevTM;
        this.impostorTex = rt.texture;
        this.impostorRects = types.map((_, k) => [k / types.length + 0.002, 0.0, (k + 1) / types.length - 0.002, 0.995]);
    }

    build(q, masksTex, terrainTex) {
        this.q = q;
        this.bakeImpostors();
        const [nearD, midD, farD] = q.trees;
        this.dist = { near: nearD, mid: midD, far: farD, bush: Math.min(75, nearD * 0.8) };
        const band = 24;
        this.inst = {};
        const cap = { near: 5000, mid: 22000, far: 26000 };
        for (const type of TREE_TYPES) {
            const stiff = type === 'shrub' ? 0.6 : type === 'birch' || type === 'autumn' ? 1.2 : 2.2;
            const nearM = foliageMaterial(this.atlas, { fadeA: nearD - band, fadeB: nearD, stiff });
            const midM = foliageMaterial(this.atlas, { fadeA: midD - band * 2, fadeB: midD, stiff: stiff * 1.5 });
            // mid starts where near ends: fade it *in* over the same band
            const midIn = foliageMaterial(this.atlas, { fadeA: nearD - band, fadeB: nearD, stiff: stiff * 1.5, fadeIn: true });
            const impM = foliageMaterial(this.impostorTex, { fadeA: midD - band * 2, fadeB: midD, stiff: 9, fadeIn: true });
            const mk = (geo, mat, n) => {
                const m = new THREE.InstancedMesh(geo, mat, n);
                m.count = 0; m.frustumCulled = false;
                m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                m.setColorAt(0, new THREE.Color(1, 1, 1));
                this.group.add(m);
                return m;
            };
            const near = mk(this.models[type][0], nearM, cap.near);
            near.castShadow = q.shadow > 0; near.receiveShadow = true;
            near.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.atlas, alphaTest: 0.42 });
            const mid = mk(this.models[type][1], midM, cap.mid);
            mid.receiveShadow = true;
            // the mid mesh needs both fades: draw a second copy for the near/mid band
            const midBand = mk(this.models[type][1], midIn, cap.near);
            const imp = mk(crossedQuads(this.impostorRects[TREE_TYPES.indexOf(type)]), impM, cap.far);
            this.inst[type] = { near, mid, midBand, imp };
        }
        // bushes (near only) and rocks
        const bushM = foliageMaterial(this.atlas, { fadeA: this.dist.bush - 15, fadeB: this.dist.bush, stiff: 0.5 });
        this.bushes = this.bushModels.map((g) => {
            const m = new THREE.InstancedMesh(g, bushM, 5000); m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color(1, 1, 1)); m.receiveShadow = true; this.group.add(m); return m;
        });
        this.rockMats = [rockMaterial(terrainTex, masksTex, [1e5, 1e5 + 1])];
        this.rocks = this.rockModels.map((lods) => lods.map((g) => {
            const m = new THREE.InstancedMesh(g, this.rockMats[0], 4000); m.count = 0; m.frustumCulled = false; m.castShadow = q.shadow > 0; m.receiveShadow = true; this.group.add(m); return m;
        }));
        for (const sp of this.specials) {
            const m = new THREE.InstancedMesh(this.models[sp.type][0], foliageMaterial(this.atlas, { fadeA: 1e5, fadeB: 1e5 + 1, stiff: 4 }), 1);
            m.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(sp.x, sp.y - 0.2, sp.z), new THREE.Quaternion(), new THREE.Vector3(sp.scale, sp.scale, sp.scale)));
            m.setColorAt(0, new THREE.Color(...sp.color));
            m.castShadow = q.shadow > 0; m.receiveShadow = true;
            m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.atlas, alphaTest: 0.42 });
            this.group.add(m);
        }
        this.built = true;
        this.lastNear.set(1e9, 0, 0); this.lastFar.set(1e9, 0, 0);
    }

    dispose() {
        for (const c of [...this.group.children]) { this.group.remove(c); c.material?.dispose?.(); }
    }

    update(cam) {
        if (!this.built) return;
        const moveN = cam.distanceTo(this.lastNear), moveF = cam.distanceTo(this.lastFar);
        if (moveN > 6) { this.lastNear.copy(cam); this.updateNear(cam); }
        if (moveF > 40) { this.lastFar.copy(cam); this.updateFar(cam); }
    }

    _write(mesh, idx, arr, i, sy = 1, color) {
        const s = arr[i + 3];
        const c = Math.cos(arr[i + 4]) * s, sn = Math.sin(arr[i + 4]) * s;
        const m = mesh.instanceMatrix.array, o = idx * 16;
        m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
        m[o + 4] = 0; m[o + 5] = s * sy; m[o + 6] = 0; m[o + 7] = 0;
        m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
        m[o + 12] = arr[i]; m[o + 13] = arr[i + 1] - 0.15; m[o + 14] = arr[i + 2]; m[o + 15] = 1;
        if (color && mesh.instanceColor) mesh.instanceColor.array.set(color, idx * 3);
    }

    treeColor(type, i) {
        const h = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const r = Math.abs(h);
        if (type === 'autumn') return [[0.95, 0.62, 0.18], [0.92, 0.38, 0.12], [0.98, 0.8, 0.25], [0.75, 0.22, 0.1]][Math.floor(r * 4)];
        if (type === 'birch') return [0.55 + r * 0.15, 0.78 + r * 0.1, 0.32];
        if (type === 'shrub') return [0.45 + r * 0.2, 0.55, 0.25];
        return [0.82 + r * 0.25, 0.9 + r * 0.15, 0.82 + r * 0.2];
    }

    updateNear(cam) {
        const { near: nearD, mid: midD } = this.dist;
        const T = this.flora.trees;
        const counts = {};
        for (const type of TREE_TYPES) counts[type] = { near: 0, mid: 0, midBand: 0 };
        const cx = Math.floor(cam.x / CELL), cz = Math.floor(cam.z / CELL), rc = Math.ceil(midD / CELL) + 1;
        for (let gz = cz - rc; gz <= cz + rc; gz++) for (let gx = cx - rc; gx <= cx + rc; gx++) {
            const b = this.treeCells.get(gx * 1000 + gz); if (!b) continue;
            for (const i of b) {
                const d = Math.hypot(T[i] - cam.x, T[i + 1] - cam.y, T[i + 2] - cam.z);
                if (d > midD + 8) continue;
                const type = TREE_TYPES[T[i + 5]];
                const set = this.inst[type], c = counts[type];
                const col = this.treeColor(type, i);
                if (d < nearD + 8 && c.near < set.near.instanceMatrix.count) this._write(set.near, c.near++, T, i, 1, col);
                if (d > nearD - 32 && d < nearD + 8 && c.midBand < set.midBand.instanceMatrix.count) this._write(set.midBand, c.midBand++, T, i, 1, col);
                if (d > nearD + 4 && c.mid < set.mid.instanceMatrix.count) this._write(set.mid, c.mid++, T, i, 1, col);
            }
        }
        for (const type of TREE_TYPES) {
            const set = this.inst[type], c = counts[type];
            for (const k of ['near', 'mid', 'midBand']) {
                set[k].count = c[k];
                set[k].instanceMatrix.needsUpdate = true;
                if (set[k].instanceColor) set[k].instanceColor.needsUpdate = true;
            }
        }
        // bushes within ~90 m
        const BR = this.dist.bush, B = this.flora.bushes, bc = [0, 0], br = Math.ceil(BR / CELL) + 1;
        for (let gz = cz - br; gz <= cz + br; gz++) for (let gx = cx - br; gx <= cx + br; gx++) {
            const b = this.bushCells.get(gx * 1000 + gz); if (!b) continue;
            for (const i of b) {
                if (Math.hypot(B[i] - cam.x, B[i + 2] - cam.z) > BR) continue;
                const t = B[i + 5], m = this.bushes[t];
                if (bc[t] >= 5000) continue;
                this._write(m, bc[t]++, B, i, 1, t === 0 ? [0.5 + (i % 7) * 0.04, 0.62, 0.3] : [0.75, 0.85, 0.6]);
            }
        }
        this.bushes.forEach((m, t) => { m.count = bc[t]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    }

    updateFar(cam) {
        const { mid: midD, far: farD } = this.dist;
        const T = this.flora.trees;
        const counts = {};
        for (const type of TREE_TYPES) counts[type] = 0;
        for (let i = 0; i < T.length; i += 6) {
            const d = Math.hypot(T[i] - cam.x, T[i + 2] - cam.z);
            if (d < midD - 90 || d > farD) continue;
            const type = TREE_TYPES[T[i + 5]];
            const set = this.inst[type];
            if (counts[type] >= set.imp.instanceMatrix.count) continue;
            const h = this.heights[type], w = this.widths[type];
            const s = T[i + 3];
            // impostor quads are unit-sized: scale to the model's size
            const m = set.imp.instanceMatrix.array, o = counts[type] * 16;
            const c = Math.cos(T[i + 4]) * s * w, sn = Math.sin(T[i + 4]) * s * w;
            m.set([c, 0, -sn, 0, 0, s * h * 1.02, 0, 0, sn, 0, c, 0, T[i], T[i + 1] - 0.2, T[i + 2], 1], o);
            if (set.imp.instanceColor) set.imp.instanceColor.array.set(type === 'autumn' || type === 'birch' ? this.treeColor(type, i) : [1, 1, 1], counts[type] * 3);
            counts[type]++;
        }
        for (const type of TREE_TYPES) {
            const imp = this.inst[type].imp;
            imp.count = counts[type];
            imp.instanceMatrix.needsUpdate = true;
            if (imp.instanceColor) imp.instanceColor.needsUpdate = true;
        }
        // rocks: lod by distance relative to size (big crags stay detailed further out)
        const Rk = this.flora.rocks, rc = this.rocks.map(() => [0, 0, 0]);
        for (let i = 0; i < Rk.length; i += 6) {
            const s = Rk[i + 3];
            const d = Math.hypot(Rk[i] - cam.x, Rk[i + 2] - cam.z) / Math.max(1, s * 0.5);
            const lod = d < 45 ? 0 : d < 160 ? 1 : d < Math.min(farD, 900) / Math.max(1, 3 - s * 0.2) ? 2 : -1;
            if (lod < 0) continue;
            const t = Rk[i + 5], m = this.rocks[t][lod];
            if (rc[t][lod] >= 4000) continue;
            this._write(m, rc[t][lod]++, Rk, i);
        }
        this.rocks.forEach((lods, t) => lods.forEach((m, l) => { m.count = rc[t][l]; m.instanceMatrix.needsUpdate = true; }));
    }
}
