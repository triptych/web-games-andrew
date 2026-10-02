// Vines that grow up the columns, gates and colonnade as you come near.
// All vines share three draw calls (stems, leaves, blossoms); each structure
// has its own growth value in a uniform array, indexed by a vertex attribute.

import * as THREE from 'three';
import { rng, TAU, clamp } from './util.js';
import { windUniforms } from './vegetation.js';

const MAX_KEYS = 64;

function leafGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.05, 0.02, 0.07, 0.07, 0, 0.12);
    s.bezierCurveTo(-0.07, 0.07, -0.05, 0.02, 0, 0);
    return new THREE.ShapeGeometry(s, 4);
}

function blossomGeo() {
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push(new THREE.CircleGeometry(0.03, 5).scale(1, 0.6, 1).translate(0.03, 0, 0).rotateZ((k / 5) * TAU));
    const pos = [], idx = [];
    let off = 0;
    for (const g of parts) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
        for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
        off += p.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

const GROW_GLSL = (kind) => `
  float gr = uGrow[int(aKey + 0.5)];
  ${kind === 'stem'
        ? `float k = smoothstep(gr * 1.04, gr * 1.04 - 0.05, aT);
     transformed -= normal * uRadius * (1.0 - k);
     vGrowK = k;`
        : `float k = smoothstep(aT + 0.02, aT + 0.1, gr * 1.05);
     transformed *= k;
     vGrowK = k;`}
`;

function growMaterial(base, kind, uniforms) {
    base.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms, windUniforms);
        sh.vertexShader = sh.vertexShader
            .replace(
                '#include <common>',
                `#include <common>
                uniform float uGrow[${MAX_KEYS}];
                uniform float uRadius, uWindTime;
                attribute float aT;
                attribute float aKey;
                varying float vGrowK;`
            )
            .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROW_GLSL(kind)}\n${kind !== 'stem' ? 'transformed.x += sin(uWindTime * 2.0 + aT * 30.0) * 0.012 * k;' : ''}`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vGrowK;')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vGrowK < 0.02) discard;');
    };
    base.customProgramCacheKey = () => 'vine-' + kind;
    return base;
}

export class Vines {
    constructor(world) {
        this.world = world;
        const specs = world.vines;
        this.keys = [];
        const keyIndex = new Map();
        for (const v of specs) {
            if (!keyIndex.has(v.key)) {
                if (keyIndex.size >= MAX_KEYS) continue;
                keyIndex.set(v.key, keyIndex.size);
                this.keys.push({ key: v.key, x: 0, y: 0, z: 0, n: 0, r: 0, grow: 0.0, target: 0, curves: [] });
            }
            const k = this.keys[keyIndex.get(v.key)];
            k.curves.push(v.pts);
            for (const p of v.pts) {
                k.x += p.x;
                k.y += p.y;
                k.z += p.z;
                k.n++;
            }
        }
        // a bounding sphere per structure, for "is the player looking at it"
        for (const k of this.keys) {
            k.x /= k.n;
            k.y /= k.n;
            k.z /= k.n;
            k.center = new THREE.Vector3(k.x, k.y, k.z);
            for (const pts of k.curves) for (const p of pts) k.r = Math.max(k.r, p.distanceTo(k.center));
        }
        this._frustum = new THREE.Frustum();
        this._viewProj = new THREE.Matrix4();
        this._sphere = new THREE.Sphere();
        this.uniforms = { uGrow: { value: new Array(MAX_KEYS).fill(0) }, uRadius: { value: 0.03 } };

        // stems
        const pos = [], nrm = [], uv = [], at = [], ak = [], idx = [];
        const leaves = [], blossoms = [];
        for (const v of specs) {
            const key = keyIndex.get(v.key);
            if (key === undefined) continue;
            const curve = new THREE.CatmullRomCurve3(v.pts);
            const len = curve.getLength();
            const segs = Math.max(8, Math.round(len * 10));
            const tube = new THREE.TubeGeometry(curve, segs, v.radius, 4, false);
            const p = tube.attributes.position, n = tube.attributes.normal;
            const off = pos.length / 3;
            for (let i = 0; i < p.count; i++) {
                pos.push(p.getX(i), p.getY(i), p.getZ(i));
                nrm.push(n.getX(i), n.getY(i), n.getZ(i));
                uv.push(0, 0);
                at.push(Math.floor(i / 5) / segs);
                ak.push(key);
            }
            for (let i = 0; i < tube.index.count; i++) idx.push(tube.index.getX(i) + off);
            // leaves along the stem
            const r = rng(v.seed * 31 + 7);
            const count = Math.round(len / 0.07);
            for (let i = 0; i < count; i++) {
                const t = (i + r()) / count;
                const pt = curve.getPointAt(Math.min(t, 1));
                const tan = curve.getTangentAt(Math.min(t, 1));
                const side = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(tan).normalize();
                const item = { p: pt.addScaledVector(side, v.radius), t, side, tan, s: r.range(0.7, 1.4), roll: r() * TAU, key };
                if (r() < 0.12) blossoms.push(item);
                else leaves.push(item);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
        g.setAttribute('aKey', new THREE.Float32BufferAttribute(ak, 1));
        g.setIndex(idx);
        const stemMat = growMaterial(new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.9 }), 'stem', this.uniforms);
        const stems = new THREE.Mesh(g, stemMat);
        stems.castShadow = false;
        stems.receiveShadow = true;
        stems.frustumCulled = false;
        world.root.add(stems);

        const leafKeys = leaves.map((l) => l.key), blossomKeys = blossoms.map((b) => b.key);
        this.leaves = this._instances(leaves, leafKeys, leafGeo(), growMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }), 'leaf', this.uniforms), ['#3d7a2a', '#5a9a35', '#2f6b2a', '#7aa83c']);
        this.blossoms = this._instances(blossoms, blossomKeys, blossomGeo(), growMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x331122 }), 'blossom', this.uniforms), ['#ffffff', '#ffc4e1', '#e8b5ff', '#fff3a8']);
    }

    _instances(items, keys, geo, mat, palette) {
        const n = items.length;
        if (!n) return null;
        const im = new THREE.InstancedMesh(geo, mat, n);
        const aT = new Float32Array(n), aK = new Float32Array(n);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0), roll = new THREE.Quaternion();
        const c = new THREE.Color();
        const r = rng(n);
        items.forEach((it, i) => {
            // leaf points out from the stem, tipped up a little
            const dir = it.side.clone().addScaledVector(it.tan, 0.4).normalize();
            q.setFromUnitVectors(up, dir);
            roll.setFromAxisAngle(dir, it.roll);
            q.premultiply(roll);
            s.setScalar(it.s);
            m.compose(it.p, q, s);
            im.setMatrixAt(i, m);
            aT[i] = it.t;
            aK[i] = keys[i] ?? 0;
            im.setColorAt(i, c.set(palette[Math.floor(r() * palette.length)]));
        });
        im.geometry.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 1));
        im.geometry.setAttribute('aKey', new THREE.InstancedBufferAttribute(aK, 1));
        im.frustumCulled = false;
        im.castShadow = false;
        this.world.root.add(im);
        return im;
    }

    /**
     * Grow vines near the player; distant ones creep along slowly. A structure
     * only wakes (fast growth, sparkle, chime) once it is both near and on
     * screen — waking one behind the player played a chime with nothing to see.
     */
    update(dt, player, camera) {
        const g = this.uniforms.uGrow.value;
        if (camera) {
            this._viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            this._frustum.setFromProjectionMatrix(this._viewProj);
        }
        this.keys.forEach((k, i) => {
            const d = Math.hypot(k.x - player.x, k.z - player.z);
            if (d < 24 && !k.sparked && (!camera || this._frustum.intersectsSphere(this._sphere.set(k.center, k.r * 0.5)))) {
                k.sparked = true;
                this.world.onVineGrow?.(k);
            }
            const rate = d < 24 && k.sparked ? 0.16 : 0.004;
            k.grow = clamp(k.grow + rate * dt, 0, 1);
            g[i] = k.grow * k.grow * (3 - 2 * k.grow);
        });
    }
}

const SPARKLE_COLORS = ['#b8ff8a', '#7fe07a', '#ffc4e1', '#fff3a8', '#ffffff'];

/**
 * The visible half of a structure waking up: sparkles scattered along its
 * vines, released from the root end first so they travel with the growth.
 */
export function sparkleVine(k, bursts, count = 48) {
    for (let n = 0; n < count; n++) {
        const pts = k.curves[Math.floor(Math.random() * k.curves.length)];
        const j = Math.floor(Math.random() * pts.length);
        const p = pts[j];
        const a = Math.random() * TAU;
        const out = 0.2 + Math.random() * 0.5;
        bursts.emit(p.x, p.y, p.z, {
            vx: Math.cos(a) * out,
            vy: 0.4 + Math.random() * 0.9,
            vz: Math.sin(a) * out,
            color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
            size: 0.18 + Math.random() * 0.2,
            delay: (j / Math.max(1, pts.length - 1)) * 1.5,
            life: 1.2 + Math.random() * 0.8,
        });
    }
}
