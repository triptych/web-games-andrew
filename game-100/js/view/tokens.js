// The tokens, all built in code: a vinyl record, a mirrorball, a star, a heart, a daisy and a
// gem, plus the overlays that mark a special (beam arrows, bomb rings, the rainbow Glitterball).
//
// Every kind is two meshes: a lit chrome-and-plastic `body` painted with vertex colours, and a
// `glow` mesh of unlit bright parts (rims, labels, centres) that blooms. Geometry and materials
// are shared by every token; a token is a Group of a few meshes and costs one clone.
// Everything faces +z, towards the camera, and is about 0.8 across.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KINDS, SP } from '../config.js';

const tint = (geo, hex, jitter = 0, seed = 1) => {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        let k = 1;
        if (jitter) {
            // one brightness per flat face (every 3 vertices of a non-indexed mesh)
            const f = Math.floor(i / 3);
            k = 1 + (((Math.sin(f * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1 - 0.5) * jitter;
        }
        a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
};
const flat = (geo) => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; };
const faceZ = (geo) => geo.rotateX(Math.PI / 2);          // a cylinder's axis becomes z
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);

function starShape(outer, inner, points = 5) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 ? inner : outer, a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    return s;
}
function heartShape(size) {
    const s = new THREE.Shape(), k = size;
    s.moveTo(0, -k * 0.95);
    s.bezierCurveTo(-k * 0.2, -k * 0.7, -k * 1.15, -k * 0.2, -k * 1.0, k * 0.28);
    s.bezierCurveTo(-k * 0.9, k * 0.78, -k * 0.2, k * 0.85, 0, k * 0.4);
    s.bezierCurveTo(k * 0.2, k * 0.85, k * 0.9, k * 0.78, k * 1.0, k * 0.28);
    s.bezierCurveTo(k * 1.15, -k * 0.2, k * 0.2, -k * 0.7, 0, -k * 0.95);
    return s;
}
const extrude = (shape, depth, bevel = 0.035) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -depth / 2);
    return g;
};

/** Builds the shared geometry for each kind: { body, glow }. */
function buildKinds() {
    const out = [];
    const col = (i) => KINDS[i].hex;

    // 0 record: black vinyl with a coloured label and a glowing rim
    {
        const disc = tint(faceZ(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 44)), 0x16101f);
        const grooves = [0.33, 0.26].map((r) => tint(faceZ(new THREE.CylinderGeometry(r, r, 0.078, 44)), 0x2a2336));
        const hole = tint(faceZ(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10)), 0x000000);
        const sheen = tint(faceZ(new THREE.CylinderGeometry(0.4, 0.4, 0.068, 44, 1, false, 0.4, 0.5)).translate(0, 0, 0.002), 0x453a58);
        const body = merge([disc, ...grooves, hole, sheen]);
        const rim = tint(new THREE.TorusGeometry(0.4, 0.034, 8, 44), col(0));
        const label = tint(faceZ(new THREE.CylinderGeometry(0.15, 0.15, 0.082, 28)), col(0));
        const dot = tint(faceZ(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 12)), 0xfff2fb);
        out.push({ body, glow: merge([rim, label, dot]) });
    }
    // 1 mirrorball: faceted chrome, tinted cyan
    {
        const ball = tint(flat(new THREE.IcosahedronGeometry(0.41, 2)), 0xa8f4ff, 0.7, 3);
        const cap = tint(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10).translate(0, 0.43, 0), 0xd8d8e8);
        const band = tint(new THREE.TorusGeometry(0.415, 0.014, 6, 36).rotateX(Math.PI / 2), col(1));
        out.push({ body: merge([ball, cap]), glow: band });
    }
    // 2 star: gold, bevelled
    {
        const body = tint(extrude(starShape(0.47, 0.21), 0.14), 0xffc92a);
        const shine = tint(new THREE.ShapeGeometry(starShape(0.27, 0.12)).translate(0, 0, 0.115), 0xfff1a8);
        out.push({ body, glow: shine });
    }
    // 3 heart: orange gloss
    {
        const body = tint(extrude(heartShape(0.4), 0.15), 0xff6a14);
        const shine = tint(new THREE.ShapeGeometry(heartShape(0.2)).translate(-0.09, 0.1, 0.125), 0xffd0a0);
        out.push({ body, glow: shine });
    }
    // 4 daisy: eight lime petals round a brown eye
    {
        const petals = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const p = new THREE.SphereGeometry(0.14, 12, 8).scale(1.55, 0.62, 0.5);
            p.translate(0.27, 0, 0).rotateZ(a);
            petals.push(tint(p, i % 2 ? 0x9dff3a : 0xb8ff5c));
        }
        const eye = tint(new THREE.SphereGeometry(0.16, 16, 12).scale(1, 1, 0.7).translate(0, 0, 0.04), 0x6b3410);
        const glow = tint(new THREE.SphereGeometry(0.08, 12, 8).translate(0, 0, 0.12), 0xffd24a);
        out.push({ body: merge([...petals, eye]), glow });
    }
    // 5 gem: a stretched octahedron, violet
    {
        const gem = tint(flat(new THREE.OctahedronGeometry(0.4, 0).scale(0.95, 1.22, 0.7)), 0xc79bff, 0.55, 9);
        const core = tint(flat(new THREE.OctahedronGeometry(0.19, 0).scale(0.95, 1.22, 0.7).translate(0, 0, 0.12)), 0xe6d2ff);
        out.push({ body: gem, glow: core });
    }
    return out;
}

/** The Glitterball: a bigger, rainbow-faceted ball with a halo. */
function buildGlitter() {
    const g = flat(new THREE.IcosahedronGeometry(0.47, 2));
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
        const f = Math.floor(i / 3);
        c.setHSL((f * 0.0618) % 1, 0.85, 0.62);
        a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    const cap = tint(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 10).translate(0, 0.5, 0), 0xe8e8f4);
    return merge([g, cap]);
}

let glowTex = null;
export function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}

export class TokenKit {
    /** @param env the environment map the chrome reflects; @param clip the plane that cuts tokens off above the board */
    constructor(env, clip) {
        this.clip = clip;
        const clips = clip ? [clip] : [];
        this.kinds = buildKinds();
        this.glitterGeo = buildGlitter();
        this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.28, envMap: env, envMapIntensity: 1.25, clippingPlanes: clips });
        this.chromeMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 0.12, envMap: env, envMapIntensity: 1.6, flatShading: true, clippingPlanes: clips });
        this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, clippingPlanes: clips });
        this.whiteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, clippingPlanes: clips });
        this.haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: clips, toneMapped: false });
        this.arrowGeo = new THREE.ConeGeometry(0.13, 0.26, 3);
        this.ringGeo = new THREE.TorusGeometry(0.56, 0.022, 6, 40);
        this.spikeGeo = new THREE.ConeGeometry(0.05, 0.2, 4);
        // only the mirrorball is mirror-polished; chrome on the violet gem reflected the dark room and went black
        this.chrome = new Set([1]);
        this.gemMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.14, envMap: env, envMapIntensity: 1.8, flatShading: true, emissive: new THREE.Color(0x2a1060), clippingPlanes: clips });
    }

    /** A new token object: { root, spin, parts } ready to add to the board. */
    make(col, sp) {
        const root = new THREE.Group();
        const holder = new THREE.Group();           // the part that turns
        root.add(holder);
        let spin = null;
        if (sp === SP.MIRROR) {
            const m = new THREE.Mesh(this.glitterGeo, this.chromeMat);
            holder.add(m);
            const halo = new THREE.Sprite(this.haloMat.clone());
            halo.scale.setScalar(1.7); halo.material.color.setRGB(1, 0.8, 1);
            root.add(halo);
            root.userData.halo = halo;
            spin = 'ball';
        } else {
            const k = this.kinds[col];
            holder.add(new THREE.Mesh(k.body, this.chrome.has(col) ? this.chromeMat : col === 5 ? this.gemMat : this.bodyMat));
            if (k.glow) holder.add(new THREE.Mesh(k.glow, this.glowMat));
            spin = ['disc', 'ball', 'sway', 'sway', 'disc', 'ball'][col];
        }
        if (sp === SP.BEAM_H || sp === SP.BEAM_V) {
            const g = new THREE.Group();
            const vertical = sp === SP.BEAM_V;
            for (const sgn of [-1, 1]) {
                const a = new THREE.Mesh(this.arrowGeo, this.whiteMat);
                a.position.set(vertical ? 0 : sgn * 0.52, vertical ? sgn * 0.52 : 0, 0.06);
                a.rotation.z = vertical ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
                g.add(a);
            }
            const halo = new THREE.Sprite(this.haloMat.clone());
            halo.scale.setScalar(1.5); halo.material.color.set(KINDS[col].hex);
            g.add(halo);
            root.add(g);
            root.userData.special = g;
            root.userData.halo = halo;
        } else if (sp === SP.BOMB) {
            const g = new THREE.Group();
            for (let i = 0; i < 2; i++) {
                const r = new THREE.Mesh(this.ringGeo, this.whiteMat);
                r.rotation.set(i ? Math.PI / 2.5 : -Math.PI / 3, i ? 0.6 : -0.4, 0);
                r.position.z = 0.04;
                g.add(r);
            }
            for (let i = 0; i < 8; i++) {
                const s = new THREE.Mesh(this.spikeGeo, this.whiteMat);
                const a = (i / 8) * Math.PI * 2;
                s.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.05);
                s.rotation.z = a - Math.PI / 2;
                g.add(s);
            }
            const halo = new THREE.Sprite(this.haloMat.clone());
            halo.scale.setScalar(1.6); halo.material.color.set(0xffa040);
            g.add(halo);
            root.add(g);
            root.userData.special = g;
            root.userData.halo = halo;
        }
        root.userData.holder = holder;
        root.userData.spin = spin;
        root.userData.col = col;
        root.userData.sp = sp;
        return root;
    }
}
