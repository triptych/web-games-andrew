/**
 * rig.js — building skinned characters out of shaped primitives.
 *
 * A PartBuilder collects parts (each bound to one bone, or blended between two) in bind-pose
 * model space, with a colour and a material id per vertex. finish() merges them into one
 * geometry and a SkinnedMesh with a Skeleton, so a whole character (body, clothes, armour) is
 * a single draw call. One material handles every surface: the `mat` attribute picks roughness,
 * metalness, emissive and a procedural detail pattern.
 */
import * as THREE from 'three';
import { patch, GLSL_NOISE, G } from './shaders.js';

// material ids
export const M = { skin: 0, cloth: 1, leather: 2, metal: 3, fur: 4, hair: 5, eye: 6, dark: 7, glow: 8, bone: 9, wood: 10, chain: 11, gold: 12, scale: 13, crystal: 14, ice: 15 };
const ROUGH = [0.55, 0.92, 0.7, 0.32, 0.95, 0.6, 0.15, 0.6, 0.5, 0.65, 0.75, 0.45, 0.28, 0.5, 0.12, 0.2];
const METAL = [0, 0, 0, 0.92, 0, 0, 0, 0, 0, 0, 0, 0.85, 1, 0.1, 0.2, 0.1];

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class PartBuilder {
    constructor() {
        this.pos = []; this.nrm = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.rest = [];
        this.bones = [];   // { name, parent, pos (absolute bind position) }
        this.byName = {};
    }

    bone(name, parent, x, y, z) {
        const i = this.bones.length;
        this.bones.push({ name, parent: parent == null ? -1 : (typeof parent === 'string' ? this.byName[parent] : parent), pos: [x, y, z] });
        this.byName[name] = i;
        return i;
    }

    /** Add a THREE geometry transformed by (pos, rot euler, scale), bound to bone b (or blended b→b2 by y). */
    add(geo, bone, color, mat, opts = {}) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        const p = g.attributes.position, n = g.attributes.normal;
        _e.set(...(opts.rot || [0, 0, 0]), opts.order || 'XYZ');
        _q.setFromEuler(_e);
        const s = opts.scale || [1, 1, 1];
        _m.compose(new THREE.Vector3(...(opts.pos || [0, 0, 0])), _q, new THREE.Vector3(...s));
        const nm = new THREE.Matrix3().getNormalMatrix(_m);
        const b = typeof bone === 'string' ? this.byName[bone] : bone;
        const b2 = opts.blend != null ? (typeof opts.blend === 'string' ? this.byName[opts.blend] : opts.blend) : -1;
        const base = this.pos.length / 3;
        const c = new THREE.Color(color);
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i).applyMatrix4(_m);
            _n.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
            if (opts.flipN) _n.multiplyScalar(-1);
            this.pos.push(_v.x, _v.y, _v.z);
            this.rest.push(_v.x, _v.y, _v.z);
            this.nrm.push(_n.x, _n.y, _n.z);
            const jitter = opts.vary ? (Math.sin(_v.x * 37 + _v.y * 13 + _v.z * 23) * 0.5 + 0.5) * opts.vary : 0;
            this.col.push(c.r * (1 - jitter), c.g * (1 - jitter), c.b * (1 - jitter));
            this.mat.push(mat);
            if (b2 >= 0) {
                // blend along the axis between the two bones' bind positions
                const A = this.bones[b].pos, B = this.bones[b2].pos;
                const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2];
                const l2 = ax * ax + ay * ay + az * az || 1;
                let t = ((_v.x - A[0]) * ax + (_v.y - A[1]) * ay + (_v.z - A[2]) * az) / l2;
                t = Math.max(0, Math.min(1, (t - (opts.blendFrom ?? 0.6)) / (1 - (opts.blendFrom ?? 0.6))));
                this.si.push(b, b2, 0, 0); this.sw.push(1 - t, t, 0, 0);
            } else { this.si.push(b, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
        }
        for (let i = 0; i < p.count; i++) this.idx.push(base + i);
        return this;
    }

    /** An ellipsoid centred at pos with radii r. */
    ellipsoid(bone, pos, r, color, mat, opts = {}) {
        const g = new THREE.SphereGeometry(1, opts.w || 12, opts.h || 9, 0, Math.PI * 2, opts.t0 || 0, opts.t1 || Math.PI);
        return this.add(g, bone, color, mat, { ...opts, pos, scale: r });
    }

    /** A tapered tube from a to b (radius r0 at a, r1 at b), elliptical by `flat`. */
    limb(bone, a, b, r0, r1, color, mat, opts = {}) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const g = new THREE.CylinderGeometry(r1, r0, len, opts.seg || 10, opts.hs || 2, !!opts.open);
        if (!opts.open) { /* capsule-ish ends */ }
        g.translate(0, len / 2, 0);
        const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const e = new THREE.Euler().setFromQuaternion(q);
        if (opts.flat) g.scale(1, 1, opts.flat);
        if (opts.bulge) {
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; const k = 1 + opts.bulge * Math.sin(t * Math.PI); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
            g.computeVertexNormals();
        }
        this.add(g, bone, color, mat, { ...opts, pos: a, rot: [e.x, e.y, e.z] });
        if (opts.caps !== false) {
            this.ellipsoid(bone, a, [r0, r0, r0 * (opts.flat || 1)], color, mat, { w: opts.seg || 10, h: 6, blend: opts.blend, blendFrom: opts.blendFrom });
            this.ellipsoid(bone, b, [r1, r1, r1 * (opts.flat || 1)], color, mat, { w: opts.seg || 10, h: 6, blend: opts.blend, blendFrom: opts.blendFrom });
        }
        return this;
    }

    box(bone, pos, size, color, mat, opts = {}) {
        return this.add(new THREE.BoxGeometry(...size), bone, color, mat, { ...opts, pos });
    }

    /** A lathe (profile [r, y] pairs) around Y. */
    lathe(bone, pts, color, mat, opts = {}) {
        const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), opts.seg || 14);
        return this.add(g, bone, color, mat, opts);
    }

    finish(material) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('mat', new THREE.Float32BufferAttribute(this.mat, 1));
        g.setAttribute('rest', new THREE.Float32BufferAttribute(this.rest, 3));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
        // merge duplicate vertices would break flat-coloured parts; keep non-indexed for simplicity
        const bones = this.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
        this.bones.forEach((b, i) => {
            if (b.parent >= 0) {
                const P = this.bones[b.parent].pos;
                bones[i].position.set(b.pos[0] - P[0], b.pos[1] - P[1], b.pos[2] - P[2]);
                bones[b.parent].add(bones[i]);
            } else bones[i].position.set(...b.pos);
        });
        const mesh = new THREE.SkinnedMesh(g, material);
        const roots = bones.filter((_, i) => this.bones[i].parent < 0);
        for (const r of roots) mesh.add(r);
        mesh.bind(new THREE.Skeleton(bones));
        mesh.userData.bones = Object.fromEntries(bones.map((b) => [b.name, b]));
        mesh.userData.rest = bones.map((b) => b.position.clone());
        return mesh;
    }
}

/** The shared character material (cloned per actor so hit flash and burn-away are per actor). */
export function makeCharacterMaterial() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
    const U = { uHit: { value: 0 }, uBurn: { value: 0 }, uGhost: { value: 0 }, uGlowCol: { value: new THREE.Color(0.3, 0.6, 1.0) }, uWet: { value: 0 } };
    mat.userData.U = U;
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        for (const k of ['uSkyTex', 'uSunDir', 'uSunFog', 'uFogDensity', 'uFogFalloff', 'uFogBase']) sh.uniforms[k] = G[k];
        sh.uniforms.uTime = G.uTime;
        sh.vertexShader = 'attribute float mat;\nattribute vec3 rest;\nvarying float vMat;\nvarying vec3 vRest;\nvarying vec3 vObjN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = mat;\nvRest = rest;\nvObjN = normal;');
        sh.fragmentShader = `uniform float uHit, uBurn, uGhost, uTime; uniform vec3 uGlowCol;
            varying float vMat; varying vec3 vRest; varying vec3 vObjN;
            float cR; float cM; vec3 cE;
            ${GLSL_NOISE}
            const float RO[16] = float[16](${ROUGH.map((v) => v.toFixed(2)).join(',')});
            const float ME[16] = float[16](${METAL.map((v) => v.toFixed(2)).join(',')});
        ` + sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                if (uBurn > 0.0 && int(vMat + 0.5) != 9) { float n = fbm3(vRest * 2.3); if (n < uBurn * 1.1 - 0.05) discard; }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
            {
                int m = int(vMat + 0.5);
                cR = RO[m]; cM = ME[m]; cE = vec3(0.0);
                vec3 p = vRest;
                if (m == 0) { float pores = vnoise3(p * 140.0); diffuseColor.rgb *= 0.94 + 0.08 * pores; cR += (pores - 0.5) * 0.1; }
                else if (m == 1) { float w = 0.5 + 0.25 * sin(p.x * 900.0) * sin(p.y * 900.0 + p.z * 600.0); diffuseColor.rgb *= 0.86 + 0.18 * w + 0.1 * (vnoise3(p * 18.0) - 0.5); }
                else if (m == 2) { float g = vnoise3(p * 60.0); diffuseColor.rgb *= 0.82 + 0.25 * g; cR -= g * 0.15; }
                else if (m == 3 || m == 12) { float sc = vnoise3(p * vec3(300.0, 20.0, 300.0)); diffuseColor.rgb *= 0.85 + 0.25 * sc; cR = mix(cR, cR + 0.25, smoothstep(0.55, 0.8, vnoise3(p * 25.0))); }
                else if (m == 11) { vec3 q = fract(p * 70.0) - 0.5; float ring = smoothstep(0.32, 0.22, abs(length(q.xy) - 0.3)); diffuseColor.rgb *= 0.55 + 0.6 * ring; cR = 0.5 - ring * 0.2; }
                else if (m == 4) { float f = vnoise3(p * vec3(160.0, 40.0, 160.0)); diffuseColor.rgb *= 0.7 + 0.45 * f; }
                else if (m == 5) { float s = 0.5 + 0.5 * sin(p.x * 400.0 + vnoise3(p * 30.0) * 6.0); diffuseColor.rgb *= 0.78 + 0.3 * s; }
                else if (m == 8) { cE = diffuseColor.rgb * (2.2 + sin(uTime * 6.0 + p.y * 9.0) * 0.4); }
                else if (m == 13) { vec2 c = fract(vec2(p.x * 24.0 + p.y * 12.0, p.z * 24.0 - p.y * 12.0)) - 0.5; float sc = smoothstep(0.5, 0.3, length(c)); diffuseColor.rgb *= 0.7 + 0.4 * sc; cR = 0.45 - sc * 0.15; }
                else if (m == 14 || m == 15) { cE = diffuseColor.rgb * 0.25; }
                else if (m == 10) { float g2 = 0.5 + 0.5 * sin(p.y * 120.0 + vnoise3(p * 20.0) * 5.0); diffuseColor.rgb *= 0.8 + 0.3 * g2; }
                if (uGhost > 0.0) { cE += uGlowCol * 0.6; }
            }`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(cR, 0.04, 1.0);')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = cM;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                totalEmissiveRadiance += cE + vec3(uHit) * vec3(1.0, 0.85, 0.8) * 0.6;
                if (uBurn > 0.0 && int(vMat + 0.5) != 9) { float n = fbm3(vRest * 2.3); totalEmissiveRadiance += vec3(3.0, 1.2, 0.3) * smoothstep(uBurn * 1.1 + 0.08, uBurn * 1.1 - 0.05, n); }
                if (uGhost > 0.0) { float rim = pow(clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0); totalEmissiveRadiance += uGlowCol * rim * 1.5; }`)
            .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (uGhost > 0.0) diffuseColor.a *= 0.55;');
    };
    mat.customProgramCacheKey = () => 'character';
    return mat;
}
