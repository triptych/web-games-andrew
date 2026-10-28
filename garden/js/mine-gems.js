// The gems of the Glittering Deep: thousands of faceted crystals set into the
// walls, floor and roof in clusters and veins, from palm-sized points to
// pillars as tall as a house, each glowing in its own colour, with sparkles
// that come and go and a few real lights among them.

import * as THREE from 'three';
import { tubePoint, noise3, fbm3 } from './minegeo.js';
import { Glints } from './mine-fx.js';
import { pointAt } from './minepath.js';
import { smoothstep, clamp, lerp, TAU } from './util.js';

const _p = {};

export const GEMS = {
    amethyst: ['#7a1fff', '#b055ff'],
    sapphire: ['#1442ff', '#2f86ff'],
    emerald: ['#00d85a', '#3dff9a'],
    ruby: ['#ff0a3a', '#ff4a78'],
    topaz: ['#ff9a00', '#ffc83a'],
    aqua: ['#00dcff', '#52f4ff'],
    rose: ['#ff4cb0', '#ff9ad8'],
    quartz: ['#cfe6ff', '#f4faff'],
};

/** Which gems a stretch of the cavern favours, by distance along the line. */
export function gemZone(s) {
    if (s < 760) return ['amethyst', 'sapphire', 'amethyst'];
    if (s < 840) return ['sapphire', 'aqua', 'amethyst'];
    if (s < 920) return ['emerald', 'aqua', 'emerald', 'quartz'];
    if (s < 1000) return ['ruby', 'rose', 'amethyst', 'ruby'];
    if (s < 1060) return ['topaz', 'ruby', 'topaz'];
    return ['aqua', 'sapphire', 'rose'];
}

/** A point-ended hexagonal crystal of unit length along +y, base radius 0.5, as flat-shaded facets. */
function crystalGeometry(kind) {
    const pos = [];
    const R = 0.5;
    const ring = (y, r, k) => Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * TAU + k) * r, y, Math.sin((i / 6) * TAU + k) * r]);
    const tri = (a, b, c) => pos.push(...a, ...b, ...c);
    if (kind === 0) {
        // a prism with a pointed head
        const b = ring(0, R, 0), m = ring(0.74, R * 0.94, 0.04), t = [0, 1, 0];
        for (let i = 0; i < 6; i++) {
            const j = (i + 1) % 6;
            tri(b[i], m[i], b[j]);
            tri(b[j], m[i], m[j]);
            tri(m[i], t, m[j]);
        }
    } else {
        // a squat double-pointed gem
        const b = [0, 0, 0], m = ring(0.4, R, 0), t = [0, 1, 0];
        for (let i = 0; i < 6; i++) {
            const j = (i + 1) % 6;
            tri(m[i], b, m[j]);
            tri(m[i], m[j], t);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

/** Collects crystals and builds the instanced meshes and sparkle layer at the end. */
export class CrystalField {
    constructor(mine) {
        this.mine = mine;
        this.items = [[], []];       // by kind: { m, color, phase, s }
        this.s = 0;                  // where along the line the crystals being added stand
        this.glintPts = [];
        this.glintCols = [];
        this.clusters = 0;
        this._m = new THREE.Matrix4();
        this._q = new THREE.Quaternion();
        this._up = new THREE.Vector3(0, 1, 0);
        this._c = new THREE.Color();
    }

    color(zone, r) {
        const name = zone[Math.floor(r() * zone.length)];
        const pair = GEMS[name];
        return this._c.set(pair[r() < 0.6 ? 0 : 1]).clone();
    }

    /** One crystal growing from (x, y, z) along `dir`, base buried a little. */
    crystal(x, y, z, dir, len, rad, color, kind = 0, r = Math.random) {
        const q = this._q.setFromUnitVectors(this._up, dir);
        // spin about its own axis so the facets don't all line up
        q.multiply(new THREE.Quaternion().setFromAxisAngle(this._up, r() * TAU));
        const m = new THREE.Matrix4().compose(
            new THREE.Vector3(x - dir.x * len * 0.12, y - dir.y * len * 0.12, z - dir.z * len * 0.12), q.clone(),
            new THREE.Vector3(rad * 2, len, rad * 2),
        );
        this.items[kind].push({ m, color, phase: r() * TAU, s: this.s });
        return m;
    }

    /** A cluster of crystals on a surface point with normal n. */
    cluster(pt, color, size, r, { n = 6, sparkle = true, hero = false } = {}) {
        const nrm = new THREE.Vector3(pt.nx, pt.ny, pt.nz).normalize();
        const tangent = new THREE.Vector3(1, 0, 0).cross(nrm);
        if (tangent.lengthSq() < 0.01) tangent.set(0, 0, 1).cross(nrm);
        tangent.normalize();
        const bit = nrm.clone().cross(tangent);
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, rr = Math.sqrt(r()) * size * 0.7;
            const dir = nrm.clone().multiplyScalar(1).addScaledVector(tangent, Math.cos(a) * r.range(0.1, 0.9)).addScaledVector(bit, Math.sin(a) * r.range(0.1, 0.9)).normalize();
            const len = size * r.range(0.5, 1.9) * (i === 0 ? 1.5 : 1);
            const rad = len * r.range(0.11, 0.2);
            const c = r() < 0.07 ? this.color(['quartz'], r) : color;
            const px = pt.x + tangent.x * Math.cos(a) * rr + bit.x * Math.sin(a) * rr, py = pt.y + tangent.y * Math.cos(a) * rr + bit.y * Math.sin(a) * rr, pz = pt.z + tangent.z * Math.cos(a) * rr + bit.z * Math.sin(a) * rr;
            this.crystal(px, py, pz, dir, len, rad, c, r() < 0.15 ? 1 : 0, r);
            if (sparkle && r() < 0.5) {
                this.glintPts.push(new THREE.Vector3(px + dir.x * len * 0.95, py + dir.y * len * 0.95, pz + dir.z * len * 0.95));
                this.glintCols.push(c);
            }
        }
        this.clusters++;
        // glow on the rock around it, and for the best ones a real light
        const m = this.mine;
        const gx = pt.x + nrm.x * (0.6 + size * 0.4), gy = pt.y + nrm.y * (0.6 + size * 0.4), gz = pt.z + nrm.z * (0.6 + size * 0.4);
        const k = clamp(0.09 + size * 0.06, 0.12, 0.42);
        m.glow.add(gx, gy, gz, color.r * k, color.g * k, color.b * k, 5 + size * 2.4);
        if (hero) m.pool.add({ x: gx, y: gy, z: gz, color: color.clone(), intensity: 14 + size * 9, dist: 14 + size * 3, flicker: 0 });
    }

    /** A pillar: several large crystals leaning together. */
    giant(pt, color, len, rad, r) {
        const nrm = new THREE.Vector3(pt.nx, pt.ny, pt.nz).normalize();
        const n = r.int(3, 6);
        for (let i = 0; i < n; i++) {
            const dir = nrm.clone().add(new THREE.Vector3(r.range(-0.45, 0.45), r.range(-0.25, 0.25), r.range(-0.45, 0.45))).normalize();
            const L = len * r.range(0.45, 1), R = rad * r.range(0.5, 1);
            const c = i % 5 === 4 ? this.color(['quartz'], r) : color;
            this.crystal(pt.x + r.range(-1, 1) * rad, pt.y + r.range(-0.5, 0.5), pt.z + r.range(-1, 1) * rad, dir, L, R, c, 0, r);
            this.glintPts.push(new THREE.Vector3(pt.x + dir.x * L, pt.y + dir.y * L, pt.z + dir.z * L));
            this.glintCols.push(c);
        }
        this.clusters++;
        const m = this.mine;
        const gx = pt.x + nrm.x * len * 0.5, gy = pt.y + nrm.y * len * 0.5, gz = pt.z + nrm.z * len * 0.5;
        m.glow.add(gx, gy, gz, color.r * 0.5, color.g * 0.5, color.b * 0.5, 14 + len);
        m.pool.add({ x: gx, y: gy, z: gz, color: color.clone(), intensity: 60 + len * 8, dist: 26 + len, flicker: 0 });
    }

    /** Scatter clusters over a tube section. */
    scatter(tube, r, { from, to, count, size = [0.4, 1.5], minDist = 3.2, rich = 0.5, hero = 0.06, zone = gemZone, giants = 0, giantSize = [6, 14] }) {
        let placed = 0, tries = 0;
        const pt = {};
        const here = {};
        while (placed < count && tries < count * 30) {
            tries++;
            tubePoint(tube, r, pt);
            if (pt.s < from || pt.s > to) continue;
            pointAt(pt.s, here);
            if (Math.hypot(pt.x - here.x, pt.y - here.y, pt.z - here.z) < minDist) continue;
            this.s = pt.s;
            // veins and geodes: crystals gather where the noise is high
            const d = smoothstep(-0.25, 0.45, noise3(pt.x * 0.045, pt.y * 0.045, pt.z * 0.045));
            if (r() > 0.18 + d * rich * 1.6) continue;
            const sz = lerp(size[0], size[1], r() * (0.35 + 0.65 * d));
            this.cluster(pt, this.color(zone(pt.s), r), sz, r, { n: 3 + Math.floor(r() * 5 + d * 4), hero: r() < hero });
            placed++;
        }
        // the great crystals: on the floor and hanging from the roof, well clear of the line
        let g = 0;
        tries = 0;
        while (g < giants && tries < giants * 60) {
            tries++;
            tubePoint(tube, r, pt);
            if (pt.s < from + 8 || pt.s > to - 8) continue;
            if (Math.abs(pt.ny) < 0.6) continue;
            pointAt(pt.s, here);
            if (Math.hypot(pt.x - here.x, pt.y - here.y, pt.z - here.z) < 5.5) continue;
            this.s = pt.s;
            this.giant(pt, this.color(zone(pt.s), r), r.range(giantSize[0], giantSize[1]), r.range(0.8, 2.0), r);
            g++;
        }
        return placed;
    }

    build() {
        const mine = this.mine;
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness: 0.1, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.7, specularIntensity: 1, envMapIntensity: 2.6,
        });
        const uniforms = { uTime: { value: 0 }, uGlow: { value: 0.62 } };
        if (mine.envRT) { mat.envMap = mine.envRT.texture; mat.envMapIntensity = 3.2; }
        mat.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, uniforms);
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nvarying float vPhase;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 1.3 + instanceMatrix[3].y * 0.4;\n#else\nvPhase = 0.0;\n#endif');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying float vPhase; uniform float uTime, uGlow;')
                .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimG = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow * (0.62 + 0.38 * sin(uTime * 1.3 + vPhase * 6.0)) * (0.55 + 1.5 * rimG);');
        };
        this.uniforms = uniforms;
        this.meshes = [];
        // one instanced mesh per stretch of the line, so only the crystals in view are drawn
        const CHUNK = 48;
        this.items.forEach((list, kind) => {
            const chunks = new Map();
            for (const it of list) {
                const c = Math.floor(it.s / CHUNK);
                if (!chunks.has(c)) chunks.set(c, []);
                chunks.get(c).push(it);
            }
            for (const [c, items] of chunks) {
                const mesh = new THREE.InstancedMesh(crystalGeometry(kind), mat, items.length);
                items.forEach((it, i) => {
                    mesh.setMatrixAt(i, it.m);
                    mesh.setColorAt(i, it.color);
                });
                mesh.instanceMatrix.needsUpdate = true;
                mesh.instanceColor.needsUpdate = true;
                mesh.computeBoundingSphere();
                mesh.boundingSphere.radius += 18;
                mesh.userData.s = (c + 0.5) * CHUNK;
                mine.root.add(mesh);
                this.meshes.push(mesh);
            }
        });
        if (this.glintPts.length) {
            this.glints = new Glints(this.glintPts, this.glintCols, 0.55);
            mine.scene.add(this.glints.points);
        }
        mine.updaters.push((dt, t) => {
            uniforms.uTime.value = t;
            this.glints?.update(t, mine.env.renderer.domElement.height * 0.9);
            // far stretches of the line are skipped
            for (const m of this.meshes) m.visible = Math.abs(m.userData.s - mine.s) < 230;
        });
    }
}

export { fbm3 };
