// Shared materials and a geometry batcher that merges many parts into one
// mesh per material, so the whole garden draws in a few hundred calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

export function makeMaterials() {
    const marble = T.marble(), granite = T.granite(), wood = T.woodPlanks(), barkT = T.bark(), copper = T.copperPatina(), leaf = T.leaves();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const m = {
        marble: std({ map: marble.map, normalMap: marble.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.38, metalness: 0, color: 0xe2ddd3 }),
        granite: std({ map: granite.map, normalMap: granite.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.86, color: 0xd8d0c8 }),
        sandstone: std({ map: granite.map, normalMap: granite.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9, color: 0xf0d9b5 }),
        wood: std({ map: wood.map, normalMap: wood.normalMap, roughness: 0.8, color: 0xc9a07a }),
        darkWood: std({ map: wood.map, normalMap: wood.normalMap, roughness: 0.85, color: 0x6a5240 }),
        bark: std({ map: barkT.map, normalMap: barkT.normalMap, roughness: 0.95, color: 0xa08a78 }),
        copper: std({ map: copper.map, normalMap: copper.normalMap, roughness: 0.55, metalness: 0.45, color: 0xffffff, side: THREE.DoubleSide }),
        bronze: std({ color: 0xd8a870, roughness: 0.5, metalness: 0.3, map: copper.map }),
        brass: std({ color: 0xd8b060, roughness: 0.28, metalness: 1.0 }),
        iron: std({ color: 0x2b2c30, roughness: 0.5, metalness: 0.75 }),
        hedge: std({ map: leaf.map, normalMap: leaf.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.9, color: 0x9fc08a }),
        glass: std({ color: 0x302010, emissive: 0xffb45a, emissiveIntensity: 0.2, roughness: 0.2 }),
        rune: std({ color: 0x223, emissive: 0x7fffd4, emissiveIntensity: 1.2, roughness: 0.4 }),
        dark: std({ color: 0x0c0c10, roughness: 1 }),
        clockFace: null,
    };
    m.granite.map.repeat.set(1, 1);
    return m;
}

const KEEP = ['position', 'normal', 'uv'];

/** Collects transformed geometry per material key and merges it. */
export class Batch {
    constructor() {
        this.parts = new Map();
    }

    /**
     * @param {string} key  material key
     * @param {THREE.BufferGeometry} geo
     * @param {THREE.Matrix4|THREE.Object3D} xf  transform
     * @param {object} [extra] per-vertex constant attributes, e.g. { aId: 3 }
     */
    add(key, geo, xf, extra) {
        let g = geo.clone();
        for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.index) {
            const n = g.attributes.position.count;
            const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
            for (let i = 0; i < n; i++) idx[i] = i;
            g.setIndex(new THREE.BufferAttribute(idx, 1));
        }
        if (xf) {
            if (xf.isObject3D) {
                xf.updateMatrix();
                g.applyMatrix4(xf.matrix);
            } else g.applyMatrix4(xf);
        }
        if (extra) {
            const n = g.attributes.position.count;
            for (const [name, v] of Object.entries(extra)) {
                const size = Array.isArray(v) ? v.length : 1;
                const arr = new Float32Array(n * size);
                for (let i = 0; i < n; i++) {
                    if (size === 1) arr[i] = v;
                    else for (let c = 0; c < size; c++) arr[i * size + c] = v[c];
                }
                g.setAttribute(name, new THREE.BufferAttribute(arr, size));
            }
        }
        if (!this.parts.has(key)) this.parts.set(key, []);
        this.parts.get(key).push(g);
        return this;
    }

    /** Returns a group with one mesh per key. */
    build(materials, { castShadow = true, receiveShadow = true } = {}) {
        const group = new THREE.Group();
        for (const [key, list] of this.parts) {
            // make index widths agree before merging
            const big = list.some((g) => g.index.array instanceof Uint32Array) || list.reduce((s, g) => s + g.attributes.position.count, 0) > 65535;
            if (big) for (const g of list) if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
            const merged = mergeGeometries(list, false);
            if (!merged) {
                console.warn('Batch: could not merge', key);
                continue;
            }
            merged.computeBoundingSphere();
            const mat = materials[key];
            if (!mat) console.warn('Batch: missing material', key);
            const mesh = new THREE.Mesh(merged, mat);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            mesh.name = key;
            group.add(mesh);
            for (const g of list) g.dispose();
        }
        this.parts.clear();
        return group;
    }
}

/** Object3D used as a reusable transform helper. */
export const xf = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz, 'YXZ');
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    return o.matrix.clone();
};

/** Compose a local transform under a parent matrix. */
export const under = (parent, local) => parent.clone().multiply(local);
