// Shared materials, geometry helpers and a tiny merging builder. Parts are drawn from a handful
// of primitives merged per material, so a whole device is a few dozen draw calls.

import * as THREE from 'three';
import * as TX from './textures.js';

const store = new Map();
const memo = (k, f) => { if (!store.has(k)) store.set(k, f()); return store.get(k); };

const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: 1 }, o));

/** Named, shared materials. */
export function mat(name) {
    return memo('m:' + name, () => {
        const bump = TX.noiseTex(3, 256, 'brushed');
        switch (name) {
            case 'steel': return std({ color: 0xaab2bd, metalness: 0.92, roughness: 0.36, bumpMap: bump, bumpScale: 0.25 });
            case 'darkSteel': return std({ color: 0x424852, metalness: 0.85, roughness: 0.45, bumpMap: bump, bumpScale: 0.3 });
            case 'gunmetal': return std({ color: 0x2c313a, metalness: 0.8, roughness: 0.5, bumpMap: TX.noiseTex(7, 256, 'grain'), bumpScale: 0.4 });
            case 'brass': return std({ color: 0xc79a43, metalness: 0.95, roughness: 0.32 });
            case 'copper': return std({ color: 0xc2703d, metalness: 0.95, roughness: 0.3 });
            case 'chrome': return std({ color: 0xe6ecf4, metalness: 1, roughness: 0.14 });
            case 'gold': return std({ color: 0xe0b84a, metalness: 1, roughness: 0.22 });
            case 'solder': return std({ color: 0xd6dae2, metalness: 0.95, roughness: 0.2 });
            case 'plasticBlack': return std({ color: 0x14161b, metalness: 0.05, roughness: 0.5 });
            case 'plasticGrey': return std({ color: 0x5b616c, metalness: 0.05, roughness: 0.55 });
            case 'plasticWhite': return std({ color: 0xdadde4, metalness: 0.02, roughness: 0.5 });
            case 'rubber': return std({ color: 0x0f1013, metalness: 0, roughness: 0.92 });
            case 'glass': return std({ color: 0xbfe6ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false });
            case 'burnt': return std({ color: 0x0b0908, metalness: 0.1, roughness: 0.9, bumpMap: TX.noiseTex(9, 256, 'grain'), bumpScale: 0.8 });
            case 'rust': return std({ color: 0x8a4220, metalness: 0.4, roughness: 0.9, bumpMap: TX.noiseTex(5, 256, 'grain'), bumpScale: 0.9 });
            case 'ceramic': return std({ color: 0xcfc4ae, metalness: 0, roughness: 0.6 });
            case 'wire': return std({ color: 0xffffff, metalness: 0.05, roughness: 0.55 });
            case 'copperWire': return std({ color: 0xd98a4a, metalness: 1, roughness: 0.25 });
            case 'mat': return std({ color: 0xffffff, map: TX.matTex(), roughness: 0.92, metalness: 0 });
            case 'edge': return std({ color: 0x2b2f38, metalness: 0.7, roughness: 0.5 });
            default: throw new Error('no material ' + name);
        }
    });
}

export const accentMat = (hex) => memo('a:' + hex, () => std({ color: hex, metalness: 0.3, roughness: 0.45, emissive: hex, emissiveIntensity: 0.15 }));
export const colorMat = (hex, o = {}) => memo('c:' + hex + JSON.stringify(o), () => std(Object.assign({ color: hex, metalness: 0.1, roughness: 0.5 }, o)));
export const glassMat = (hex, op = 0.5) => memo('g:' + hex + op, () => std({ color: hex, metalness: 0, roughness: 0.04, transparent: true, opacity: op, depthWrite: false, emissive: hex, emissiveIntensity: 0.25 }));
export const pcbMat = (base, seed) => memo(`p:${base}${seed}`, () => std({ color: 0xffffff, map: TX.pcbTex(base, seed), metalness: 0.2, roughness: 0.55, bumpMap: TX.pcbTex(base, seed), bumpScale: 0.5 }));
export const panelMat = (body, accent, seed, text) => memo(`pn:${body}${accent}${seed}${text}`, () => std({ color: 0xffffff, map: TX.panelTex(body, accent, seed, text), metalness: 0.4, roughness: 0.68, bumpMap: TX.noiseTex(11, 256, 'grain'), bumpScale: 0.35 }));
export const labelMat = (text, o) => memo('l:' + text + JSON.stringify(o || {}), () => std({ color: 0xffffff, map: TX.labelTex(text, o), metalness: 0, roughness: 0.6 }));
export const ledMat = (hex) => memo('led:' + hex, () => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));

// ------------------------------------------------------------------ builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

/** Collects primitives per material and merges them into one mesh per material. */
export class Builder {
    constructor() { this.by = new Map(); }

    add(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        _e.set(rx, ry, rz, 'XYZ');
        _q.setFromEuler(_e);
        _p.set(x, y, z); _s.set(sx, sy, sz);
        _m.compose(_p, _q, _s);
        let g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(_m);
        if (!this.by.has(material)) this.by.set(material, []);
        this.by.get(material).push(g);
        return this;
    }
    box(material, w, h, d, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), material, x, y, z, rx, ry, rz); }
    /** Cylinder with its base at y. */
    cyl(material, rt, rb, h, seg, x, y, z, rx, ry, rz) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y + h / 2, z, rx, ry, rz); }
    cylc(material, rt, rb, h, seg, x, y, z, rx, ry, rz) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z, rx, ry, rz); }
    sph(material, r, x, y, z, sx = 1, sy = 1, sz = 1, wseg = 14, hseg = 10) { return this.add(new THREE.SphereGeometry(r, wseg, hseg), material, x, y, z, 0, 0, 0, sx, sy, sz); }
    tor(material, R, r, x, y, z, rx = Math.PI / 2, ry = 0, rz = 0, rs = 8, ts = 20) { return this.add(new THREE.TorusGeometry(R, r, rs, ts), material, x, y, z, rx, ry, rz); }

    /** One Mesh per material, merged. Returns a Group. */
    build({ cast = true, receive = true } = {}) {
        const grp = new THREE.Group();
        for (const [material, list] of this.by) {
            let n = 0;
            for (const g of list) n += g.attributes.position.count;
            const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
            let o = 0;
            for (const g of list) {
                const c = g.attributes.position.count;
                pos.set(g.attributes.position.array, o * 3);
                if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
                if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
                o += c;
                g.dispose();
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            geo.computeBoundingSphere(); geo.computeBoundingBox();
            const mesh = new THREE.Mesh(geo, material);
            mesh.castShadow = cast && !material.transparent; mesh.receiveShadow = receive;
            grp.add(mesh);
        }
        return grp;
    }
}

// ------------------------------------------------------------------ geometry helpers
export function roundedRectShape(w, d, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -d / 2;
    r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
}

/** A slab with rounded corners and a bevelled edge, lying flat: base at y = 0, thickness h. */
export function slabGeo(w, d, h, r = 0.2, bevel = 0.04) {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), { depth: Math.max(0.01, h - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    // the extrude runs along +z before rotation; after -90° about x it runs down, so lift it back up
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** A gear: toothed disc in the xz plane, base at y = 0. */
export function gearGeo(r, teeth, depth, holeR = 0) {
    const s = new THREE.Shape();
    const n = teeth * 2;
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.82;
        const a2 = a + (i % 2 === 0 ? 0.02 : -0.02);
        const x = Math.cos(a2) * rr, y = Math.sin(a2) * rr;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    if (holeR) { const h = new THREE.Path(); h.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** A ring in the xz plane (outer r, inner ri) of height h. */
export function ringGeo(r, ri, h, seg = 28) {
    const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** Distinct colour for the hash-based tinting of walk-in devices. */
export function tint(hex, k) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, k);
    return c.getHex();
}

export function disposeTree(o) {
    o.traverse((c) => { if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose(); });
}
