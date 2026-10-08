/**
 * props.js — trackside scenery, built from primitives into one vertex-coloured geometry per prop so
 * each kind draws as a single InstancedMesh. Low-poly and flat-shaded on purpose.
 *
 * PROPS[type](rng) → { parts: [[geometry, material, opts?], ...], r, scale, face, sink, float }
 *   r      footprint radius (m), so props keep clear of the barrier
 *   scale  [min, max] random scale
 *   face   turn to face the track (billboards, stands)
 *   opts.spin = { x, y, z, axis, speed }   a part that turns (windmill rotors) about a local point
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bannerTexture, softDot } from './textures.js';

const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
const smoothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const shinyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0.5 });

/** A coloured, transformed piece ready to merge. */
export function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}
const merge = (list) => mergeGeometries(list);

// Shared primitives.
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const dodec = (r) => new THREE.DodecahedronGeometry(r, 0);

const jit = (c, rng, a = 0.08) => {
    const col = new THREE.Color(c);
    const k = 1 + (rng.next() - 0.5) * a * 2;
    return col.multiplyScalar(k).getHex();
};

export const PROPS = {
    // ------------------------------------------------------------ farm
    oak: (rng) => ({
        parts: [[merge([
            part(cyl(0.35, 0.5, 4), 0x5a3e26, { y: 2 }),
            part(ball(2.6, 1), jit(0x5e8a2e, rng), { y: 5.2, sy: 0.85 }),
            part(ball(1.9, 1), jit(0x6e9a34, rng), { x: 1.4, y: 5.8, sy: 0.8 }),
            part(ball(1.8, 1), jit(0x4e7a28, rng), { x: -1.3, y: 5.4, z: 0.6, sy: 0.85 }),
        ]), flatMat]], r: 2.6, scale: [0.8, 1.4],
    }),
    wheat: () => ({
        parts: [[merge([
            part(cone(0.5, 1.4, 5), 0xe0c060, { y: 0.7 }), part(cone(0.4, 1.2, 5), 0xd4b050, { x: 0.6, y: 0.6, z: 0.3 }),
            part(cone(0.45, 1.3, 5), 0xe8c868, { x: -0.5, y: 0.65, z: -0.4 }),
        ]), flatMat]], r: 1, scale: [0.9, 1.3], shadow: false,
    }),
    hay: () => ({
        parts: [[merge([part(cyl(0.9, 0.9, 1.4, 14), 0xd8b452, { y: 0.9, rz: Math.PI / 2 }), part(cyl(0.6, 0.6, 1.42, 14), 0xc8a442, { y: 0.9, rz: Math.PI / 2 })]), smoothMat]], r: 1.2,
    }),
    fence: () => ({
        parts: [[merge([
            part(box(0.2, 1.4, 0.2), 0x7a5a3a, { y: 0.7, x: -2 }), part(box(0.2, 1.4, 0.2), 0x7a5a3a, { y: 0.7, x: 2 }),
            part(box(4.2, 0.18, 0.08), 0x8a6a48, { y: 1.1 }), part(box(4.2, 0.18, 0.08), 0x8a6a48, { y: 0.6 }),
        ]), flatMat]], r: 2.2, scale: [1, 1],
    }),
    barn: () => ({
        parts: [[merge([
            part(box(10, 6, 14), 0xb3322a, { y: 3 }),
            part(cyl(0.01, 7.4, 3.6, 4), 0x4a4a52, { y: 7.8, ry: Math.PI / 4, sx: 1, sz: 1.36 }),
            part(box(4, 4.4, 0.2), 0xf2ece0, { y: 2.2, z: 7.05 }), part(box(3.4, 3.8, 0.22), 0x8a2a22, { y: 2.2, z: 7.1 }),
            part(box(0.2, 5.2, 0.24), 0xf2ece0, { y: 2.2, z: 7.12, rz: 0.7 }), part(box(0.2, 5.2, 0.24), 0xf2ece0, { y: 2.2, z: 7.12, rz: -0.7 }),
        ]), flatMat]], r: 8, scale: [0.9, 1.1], face: true,
    }),
    silo: () => ({
        parts: [[merge([part(cyl(2.4, 2.4, 12, 14), 0xc8ccd2, { y: 6 }), part(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x9aa4b0, { y: 12 }), part(cyl(2.45, 2.45, 0.4, 14), 0x8a2a22, { y: 4 }), part(cyl(2.45, 2.45, 0.4, 14), 0x8a2a22, { y: 8 })]), shinyMat]], r: 3,
    }),
    windmill: () => {
        const blades = [];
        for (let k = 0; k < 12; k++) blades.push(part(box(0.5, 3.2, 0.06), 0xe8e4dc, { rz: (k / 12) * Math.PI * 2, x: Math.sin((k / 12) * Math.PI * 2) * -1.8, y: Math.cos((k / 12) * Math.PI * 2) * 1.8 }));
        blades.push(part(cyl(0.3, 0.3, 0.4, 8), 0x8a2a22, { rx: Math.PI / 2 }));
        blades.push(part(box(0.1, 0.8, 3), 0xb3322a, { z: -1.6, y: 0.2 }));
        return {
            parts: [
                [merge([
                    part(cyl(0.12, 0.12, 13, 4), 0x9aa0a8, { x: 1.4, y: 6.5, z: 1.4, rz: -0.1, rx: 0.1 }), part(cyl(0.12, 0.12, 13, 4), 0x9aa0a8, { x: -1.4, y: 6.5, z: 1.4, rz: 0.1, rx: 0.1 }),
                    part(cyl(0.12, 0.12, 13, 4), 0x9aa0a8, { x: 1.4, y: 6.5, z: -1.4, rz: -0.1, rx: -0.1 }), part(cyl(0.12, 0.12, 13, 4), 0x9aa0a8, { x: -1.4, y: 6.5, z: -1.4, rz: 0.1, rx: -0.1 }),
                    part(box(1.2, 0.8, 1.2), 0x8a8e96, { y: 13 }),
                ]), flatMat],
                [merge(blades), flatMat, { spin: { x: 0, y: 13.3, z: 0.8, axis: 'z', speed: 1.4 } }],
            ], r: 3,
        };
    },
    cow: (rng) => {
        const spot = rng.next() < 0.5 ? 0x1a1a1a : 0x7a4a2a;
        return {
            parts: [[merge([
                part(box(0.9, 0.8, 1.8), 0xf2f0ea, { y: 1.1 }), part(box(0.5, 0.4, 0.8), spot, { y: 1.35, x: 0.25, z: 0.2 }),
                part(box(0.5, 0.5, 0.6), 0xf2f0ea, { y: 1.4, z: 1.1 }), part(box(0.4, 0.25, 0.2), 0xe8a0a0, { y: 1.25, z: 1.45 }),
                part(box(0.18, 0.7, 0.18), 0xe8e4dc, { x: 0.3, y: 0.35, z: 0.7 }), part(box(0.18, 0.7, 0.18), 0xe8e4dc, { x: -0.3, y: 0.35, z: 0.7 }),
                part(box(0.18, 0.7, 0.18), 0xe8e4dc, { x: 0.3, y: 0.35, z: -0.7 }), part(box(0.18, 0.7, 0.18), 0xe8e4dc, { x: -0.3, y: 0.35, z: -0.7 }),
                part(box(0.08, 0.15, 0.08), 0xd8d0b0, { x: 0.2, y: 1.72, z: 1.1 }), part(box(0.08, 0.15, 0.08), 0xd8d0b0, { x: -0.2, y: 1.72, z: 1.1 }),
            ]), flatMat]], r: 1.2, scale: [0.9, 1.1],
        };
    },
    watertower: () => ({
        parts: [[merge([
            part(cyl(0.2, 0.2, 14, 4), 0x8a8e96, { x: 2, y: 7, z: 2 }), part(cyl(0.2, 0.2, 14, 4), 0x8a8e96, { x: -2, y: 7, z: 2 }),
            part(cyl(0.2, 0.2, 14, 4), 0x8a8e96, { x: 2, y: 7, z: -2 }), part(cyl(0.2, 0.2, 14, 4), 0x8a8e96, { x: -2, y: 7, z: -2 }),
            part(cyl(3.4, 3.4, 4.5, 16), 0xc8ccd2, { y: 16 }), part(cone(3.6, 1.8, 16), 0x9aa4b0, { y: 19.1 }),
            part(cyl(3.42, 3.42, 1.2, 16), 0x2f6be0, { y: 16 }),
        ]), shinyMat]], r: 4,
    }),
    bush: (rng) => ({ parts: [[merge([part(ball(1, 0), jit(0x6a8a34, rng), { y: 0.5, sy: 0.7 }), part(ball(0.7, 0), jit(0x7a9a3a, rng), { x: 0.6, y: 0.4, sy: 0.7 })]), flatMat]], r: 1.2, scale: [0.7, 1.4] }),
    pickup: (rng) => {
        const c = [0xb3322a, 0x2f6be0, 0xe8e4dc, 0x3a5a3a, 0xd9b23a][rng.int(5)];
        return {
            parts: [[merge([
                part(box(2, 0.9, 5), c, { y: 0.95 }), part(box(1.9, 0.8, 1.8), c, { y: 1.8, z: 0.6 }), part(box(1.7, 0.6, 0.1), 0x223040, { y: 1.85, z: 1.52 }),
                part(cyl(0.45, 0.45, 0.3, 10), 0x1a1a1a, { x: 1, y: 0.45, z: 1.6, rz: Math.PI / 2 }), part(cyl(0.45, 0.45, 0.3, 10), 0x1a1a1a, { x: -1, y: 0.45, z: 1.6, rz: Math.PI / 2 }),
                part(cyl(0.45, 0.45, 0.3, 10), 0x1a1a1a, { x: 1, y: 0.45, z: -1.6, rz: Math.PI / 2 }), part(cyl(0.45, 0.45, 0.3, 10), 0x1a1a1a, { x: -1, y: 0.45, z: -1.6, rz: Math.PI / 2 }),
            ]), flatMat]], r: 2.8, scale: [1, 1],
        };
    },
    // ------------------------------------------------------------ forest
    pine: (rng) => {
        const g = jit(0x2f5a2e, rng, 0.12);
        return {
            parts: [[merge([
                part(cyl(0.25, 0.4, 3, 6), 0x5a3e26, { y: 1.5 }),
                part(cone(2.6, 4, 7), g, { y: 4 }), part(cone(2.1, 3.6, 7), jit(g, rng), { y: 6.2 }), part(cone(1.5, 3, 7), jit(g, rng), { y: 8.3 }), part(cone(0.9, 2.4, 7), g, { y: 10 }),
            ]), flatMat]], r: 2.4, scale: [0.8, 1.6],
        };
    },
    birch: (rng) => ({
        parts: [[merge([
            part(cyl(0.18, 0.24, 7, 6), 0xece8e0, { y: 3.5 }), part(box(0.3, 0.15, 0.3), 0x2a2a2a, { y: 2, rz: 0.3 }), part(box(0.3, 0.12, 0.3), 0x2a2a2a, { y: 4.2 }),
            part(ball(1.6, 1), jit(0x9ab83a, rng), { y: 7.4, sy: 1.2 }), part(ball(1.1, 0), jit(0xb4c84a, rng), { x: 0.7, y: 6.4 }),
        ]), flatMat]], r: 1.6, scale: [0.8, 1.3],
    }),
    fern: (rng) => {
        const p = [];
        for (let k = 0; k < 6; k++) p.push(part(box(0.25, 0.04, 1.4), jit(0x4a7a2a, rng), { ry: (k / 6) * Math.PI * 2, rx: -0.5, y: 0.35, x: Math.sin((k / 6) * Math.PI * 2) * 0.5, z: Math.cos((k / 6) * Math.PI * 2) * 0.5 }));
        return { parts: [[merge(p), flatMat]], r: 0.8, scale: [0.8, 1.6], shadow: false };
    },
    boulder: (rng) => ({ parts: [[merge([part(dodec(1.3), jit(0x7c8078, rng), { y: 0.6, sy: 0.7 }), part(dodec(0.8), 0x4a6a2a, { y: 1.15, x: 0.2, sy: 0.25 })]), flatMat]], r: 1.4, scale: [0.6, 1.8], sink: 0.1 }),
    cabin: () => ({
        parts: [
            [merge([
                part(box(7, 3.4, 5.5), 0x7a5232, { y: 1.7 }), part(cyl(0.01, 5.2, 2.6, 4), 0x4a3a2a, { y: 4.7, ry: Math.PI / 4, sx: 1.04, sz: 0.8 }),
                part(box(0.9, 4, 0.9), 0x6a6a6a, { x: 2.4, y: 4.8 }), part(box(1.2, 2.2, 0.1), 0x4a3020, { y: 1.1, z: 2.8 }),
            ]), flatMat],
            [merge([part(box(1, 0.9, 0.1), 0xffd27a, { x: -2, y: 1.9, z: 2.78 }), part(box(1, 0.9, 0.1), 0xffd27a, { x: 2, y: 1.9, z: 2.78 })]), glowMat],
        ], r: 4.5, scale: [0.9, 1.1], face: true,
    }),
    logpile: () => {
        const p = [];
        for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) p.push(part(cyl(0.35, 0.35, 4, 8), 0x7a5232, { rx: Math.PI / 2, x: (k - (3 - r) / 2) * 0.72, y: 0.35 + r * 0.62 }));
        return { parts: [[merge(p), flatMat]], r: 2.2, face: true };
    },
    mushroom: (rng) => ({ parts: [[merge([part(cyl(0.12, 0.15, 0.5, 6), 0xf2ece0, { y: 0.25 }), part(new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), rng.next() < 0.6 ? 0xd8322a : 0xc89a5a, { y: 0.48 })]), flatMat]], r: 0.4, scale: [0.8, 2], shadow: false }),
    stump: () => ({ parts: [[merge([part(cyl(0.5, 0.65, 0.8, 8), 0x6a4a2c, { y: 0.4 }), part(cyl(0.5, 0.5, 0.02, 8), 0xc8a070, { y: 0.81 })]), flatMat]], r: 0.8 }),
    // ------------------------------------------------------------ desert
    cactus: (rng) => {
        const c = jit(0x4f8a3a, rng);
        return {
            parts: [[merge([
                part(cyl(0.45, 0.5, 6, 8), c, { y: 3 }), part(new THREE.SphereGeometry(0.45, 8, 4), c, { y: 6 }),
                part(cyl(0.3, 0.3, 1.4, 8), c, { x: 0.9, y: 2.6, rz: Math.PI / 2 }), part(cyl(0.3, 0.3, 2, 8), c, { x: 1.5, y: 3.5 }),
                part(cyl(0.28, 0.28, 1.2, 8), c, { x: -0.8, y: 3.4, rz: Math.PI / 2 }), part(cyl(0.28, 0.28, 1.6, 8), c, { x: -1.3, y: 4.1 }),
            ]), flatMat]], r: 1.6, scale: [0.6, 1.3],
        };
    },
    rock: (rng) => ({ parts: [[merge([part(dodec(1.6), jit(0xa65a3a, rng, 0.15), { y: 0.8, sx: 1.3, sy: 0.8 }), part(dodec(1), jit(0x9a4a2a, rng), { x: 1.2, y: 0.5 })]), flatMat]], r: 2, scale: [0.6, 2], sink: 0.2 }),
    hoodoo: (rng) => ({
        parts: [[merge([
            part(cyl(2.6, 3.4, 8, 7), jit(0xb4552e, rng), { y: 4 }), part(cyl(2.2, 2.6, 7, 7), jit(0xc8693a, rng), { y: 11.5 }),
            part(cyl(1.8, 2.2, 6, 7), jit(0xa04a2a, rng), { y: 18 }), part(cyl(3, 1.8, 2, 7), 0x8a3a22, { y: 22 }),
        ]), flatMat]], r: 4, scale: [0.7, 1.6],
    }),
    deadtree: () => ({
        parts: [[merge([
            part(cyl(0.2, 0.35, 5, 5), 0x6a5a4a, { y: 2.5 }), part(cyl(0.08, 0.14, 2.6, 4), 0x6a5a4a, { x: 0.7, y: 4.5, rz: -0.7 }),
            part(cyl(0.08, 0.14, 2.2, 4), 0x6a5a4a, { x: -0.6, y: 4, rz: 0.8 }), part(cyl(0.06, 0.1, 1.6, 4), 0x6a5a4a, { x: 0.2, y: 5.6, rz: 0.3 }),
        ]), flatMat]], r: 1.2, scale: [0.8, 1.5],
    }),
    tumbleweed: () => ({ parts: [[merge([part(new THREE.IcosahedronGeometry(0.8, 1), 0xa88a5a, { y: 0.75 })]), new THREE.MeshStandardMaterial({ color: 0xa88a5a, wireframe: true })]], r: 0.9, shadow: false }),
    arch: () => ({
        parts: [[merge([
            part(new THREE.TorusGeometry(22, 5, 6, 18, Math.PI), 0xb4552e, { y: 0, sz: 0.6 }),
            part(cyl(6, 8, 6, 7), 0x9a4a2a, { x: 22, y: 1 }), part(cyl(6, 8, 6, 7), 0x9a4a2a, { x: -22, y: 1 }),
        ]), flatMat]], r: 26, scale: [1, 1.2], face: true,
    }),
    skull: () => ({ parts: [[merge([part(ball(0.35, 0), 0xf2ece0, { y: 0.25 }), part(cyl(0.05, 0.08, 0.9, 4), 0xe8e0d0, { x: 0.45, y: 0.4, rz: -1 }), part(cyl(0.05, 0.08, 0.9, 4), 0xe8e0d0, { x: -0.45, y: 0.4, rz: 1 })]), flatMat]], r: 0.6, shadow: false }),
    // ------------------------------------------------------------ bayou
    cypress: (rng) => {
        const g = jit(0x3a5a2a, rng, 0.12);
        return {
            parts: [[merge([
                part(cyl(0.35, 1.3, 2.5, 7), 0x5a4a3a, { y: 1.2 }), part(cyl(0.3, 0.35, 8, 6), 0x5a4a3a, { y: 6 }),
                part(ball(2.2, 0), g, { y: 9.5, sy: 0.6 }), part(ball(1.8, 0), jit(g, rng), { x: 1.4, y: 8.4, sy: 0.55 }), part(ball(1.6, 0), g, { x: -1.3, y: 10.6, sy: 0.5 }),
                part(box(0.12, 3, 0.4), 0x8a9a6a, { x: 1.2, y: 7.2 }), part(box(0.12, 2.4, 0.4), 0x8a9a6a, { x: -1.0, y: 8.2, z: 0.4 }), part(box(0.12, 2.8, 0.3), 0x7a8a5a, { x: 0.3, y: 7.4, z: -1.2 }),
            ]), flatMat]], r: 2.2, scale: [0.8, 1.4],
        };
    },
    reeds: (rng) => {
        const p = [];
        for (let k = 0; k < 7; k++) p.push(part(cyl(0.03, 0.05, 1.8, 3), jit(0x7a8a3a, rng), { x: (rng.next() - 0.5) * 0.8, z: (rng.next() - 0.5) * 0.8, y: 0.9, rz: (rng.next() - 0.5) * 0.3 }));
        p.push(part(cyl(0.07, 0.07, 0.35, 5), 0x5a3a20, { y: 1.6, x: 0.1 }));
        return { parts: [[merge(p), flatMat]], r: 0.6, scale: [0.8, 1.4], shadow: false };
    },
    shack: () => {
        const legs = [];
        for (const x of [-2.6, 2.6]) for (const z of [-2, 2]) legs.push(part(cyl(0.15, 0.15, 3, 5), 0x4a3a2a, { x, z, y: 1.5 }));
        return {
            parts: [
                [merge([
                    ...legs, part(box(6, 0.3, 5), 0x6a5034, { y: 3 }), part(box(5, 3, 4), 0x7a6a50, { y: 4.6 }),
                    part(cyl(0.01, 4.4, 2, 4), 0x5a4a3a, { y: 7.1, ry: Math.PI / 4, sz: 0.85 }), part(box(0.8, 1.6, 0.1), 0x3a2a1a, { y: 4, z: 2.05 }),
                ]), flatMat],
                [merge([part(box(0.9, 0.7, 0.1), 0xffb04a, { x: 1.5, y: 4.9, z: 2.05 }), part(box(0.1, 0.7, 0.9), 0xffb04a, { x: 2.55, y: 4.9 })]), glowMat],
            ], r: 3.6, face: true,
        };
    },
    lantern: () => ({
        parts: [
            [merge([part(cyl(0.08, 0.1, 2.6, 5), 0x3a2a1a, { y: 1.3 }), part(box(0.7, 0.08, 0.08), 0x3a2a1a, { x: 0.3, y: 2.55 })]), flatMat],
            [merge([part(box(0.3, 0.42, 0.3), 0xffc060, { x: 0.6, y: 2.25 })]), glowMat],
        ], r: 0.5, scale: [1, 1], glow: { x: 0.6, y: 2.25, z: 0, col: 0xffa040, size: 3.5 },
    }),
    lily: () => ({ parts: [[merge([part(cyl(0.6, 0.6, 0.04, 10), 0x4a8a3a, { y: 0.02 }), part(cyl(0.4, 0.4, 0.04, 10), 0x5a9a42, { x: 0.9, y: 0.02, z: 0.3 }), part(ball(0.14, 0), 0xf4c0d8, { x: 0.1, y: 0.12 })]), flatMat]], r: 1, float: true, shadow: false }),
    gator: () => ({
        parts: [
            [merge([part(box(0.8, 0.25, 2.8), 0x3a4a2a, { y: 0.05 }), part(box(0.6, 0.2, 1.1), 0x3a4a2a, { y: 0.05, z: 1.8 }), part(box(0.3, 0.2, 1.4), 0x3a4a2a, { y: 0.0, z: -2 })]), flatMat],
            [merge([part(ball(0.09, 0), 0xffe040, { x: 0.2, y: 0.25, z: 1.5 }), part(ball(0.09, 0), 0xffe040, { x: -0.2, y: 0.25, z: 1.5 })]), glowMat],
        ], r: 2, float: true, shadow: false,
    }),
    boat: () => ({ parts: [[merge([part(box(1.6, 0.5, 4), 0x6a5034, { y: 0.15 }), part(box(1.2, 0.1, 3.6), 0x4a3a24, { y: 0.4 }), part(box(0.4, 0.5, 0.6), 0x2a2a2a, { y: 0.6, z: -1.8 })]), flatMat]], r: 2.2, float: true }),
    // ------------------------------------------------------------ snow
    snowpine: (rng) => {
        const g = jit(0x2a4a3a, rng, 0.1);
        return {
            parts: [[merge([
                part(cyl(0.25, 0.4, 3, 6), 0x4a3426, { y: 1.5 }),
                part(cone(2.6, 4, 7), g, { y: 4 }), part(cone(2.7, 0.9, 7), 0xf4f8ff, { y: 3.4 }),
                part(cone(2.1, 3.6, 7), g, { y: 6.2 }), part(cone(2.2, 0.8, 7), 0xf4f8ff, { y: 5.6 }),
                part(cone(1.5, 3, 7), g, { y: 8.3 }), part(cone(1.6, 0.7, 7), 0xf4f8ff, { y: 7.8 }),
                part(cone(0.9, 2.4, 7), 0xeaf0f8, { y: 10 }),
            ]), flatMat]], r: 2.4, scale: [0.8, 1.7],
        };
    },
    snowman: () => ({
        parts: [[merge([
            part(ball(0.9, 1), 0xf4f8ff, { y: 0.8 }), part(ball(0.65, 1), 0xf4f8ff, { y: 2 }), part(ball(0.45, 1), 0xf4f8ff, { y: 2.9 }),
            part(cone(0.1, 0.6, 5), 0xff7a1a, { y: 2.9, z: 0.6, rx: Math.PI / 2 }), part(cyl(0.38, 0.38, 0.6, 10), 0x1a1a1a, { y: 3.5 }), part(cyl(0.6, 0.6, 0.06, 10), 0x1a1a1a, { y: 3.22 }),
            part(box(1.3, 0.2, 0.2), 0xd8322a, { y: 2.45 }),
        ]), smoothMat]], r: 1, face: true,
    }),
    skiflag: (rng) => ({ parts: [[merge([part(cyl(0.04, 0.04, 2.2, 4), 0x2a2a2a, { y: 1.1 }), part(box(0.04, 0.6, 0.8), rng.next() < 0.5 ? 0xd8322a : 0x2f6be0, { y: 1.8, z: 0.4 })]), flatMat]], r: 0.4, shadow: false, face: true }),
    crystal: (rng) => ({ parts: [[merge([part(new THREE.OctahedronGeometry(1.2, 0), 0xa8e0ff, { y: 1.4, sy: 2 }), part(new THREE.OctahedronGeometry(0.7, 0), 0xc8f0ff, { x: 1, y: 0.8, sy: 1.8, rz: 0.4 })]), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.1, metalness: 0.2, emissive: 0x2a6080, emissiveIntensity: 0.5 })]], r: 1.6, scale: [0.6, 1.6 + rng.next() * 0.01] }),
    // ------------------------------------------------------------ Ravenwood
    billboard: (rng) => {
        const texts = [['RAVENWOOD MOTORS', 'WIN AT ANY PRICE'], ['RAVENWING V12', 'BUILT TO RULE'], ['RAVENWOOD OIL', 'THE BLACK GOLD'], ['VICTOR RAVENWOOD', 'FOR MAYOR']];
        const [a, b] = texts[rng.int(texts.length)];
        const mat = new THREE.MeshStandardMaterial({ map: bannerTexture(a, 0x111216, 0xe0b23c, 512, 192, b), roughness: 0.6 });
        const g = new THREE.PlaneGeometry(12, 4.5);
        g.translate(0, 6.5, 0.16);
        return {
            parts: [
                [merge([part(box(0.4, 9, 0.4), 0x2a2a2e, { x: -4.5, y: 4.5 }), part(box(0.4, 9, 0.4), 0x2a2a2e, { x: 4.5, y: 4.5 }), part(box(12.4, 4.9, 0.3), 0x15161a, { y: 6.5 })]), flatMat],
                [g, mat],
            ], r: 6.5, scale: [1, 1], face: true,
        };
    },
    flagpole: (rng) => ({ parts: [[merge([part(cyl(0.06, 0.06, 7, 5), 0xd8d8d8, { y: 3.5 }), part(box(0.04, 1.2, 2), rng.next() < 0.5 ? 0x111216 : 0xe0b23c, { y: 6.2, z: 1 })]), flatMat]], r: 0.4, face: true }),
    tent: (rng) => ({ parts: [[merge([part(cone(3.4, 3, 4), rng.next() < 0.5 ? 0x15161a : 0xe0b23c, { y: 3.4, ry: Math.PI / 4 }), part(box(4.6, 2, 4.6), 0xf2ece0, { y: 1 })]), flatMat]], r: 3.5 }),
    ravtower: () => ({
        parts: [
            [merge([
                part(box(14, 40, 14), 0x15161a, { y: 20 }), part(box(10, 14, 10), 0x1d1e24, { y: 47 }), part(cone(4, 14, 4), 0x15161a, { y: 61, ry: Math.PI / 4 }),
                part(box(14.4, 1, 14.4), 0xe0b23c, { y: 40 }), part(box(10.4, 1, 10.4), 0xe0b23c, { y: 54 }),
            ]), shinyMat],
            [merge([part(box(0.3, 30, 1), 0xffd060, { x: 7.1, y: 22 }), part(box(0.3, 30, 1), 0xffd060, { x: -7.1, y: 22 }), part(box(1, 30, 0.3), 0xffd060, { z: 7.1, y: 22 }), part(box(1, 30, 0.3), 0xffd060, { z: -7.1, y: 22 })]), glowMat],
        ], r: 9, scale: [1, 1], face: true,
    }),
};

export { softDot };
