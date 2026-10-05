// Asteroids: eight noise-displaced base rocks drawn as instanced meshes (plain + glowing crystal),
// plus a non-colliding dust ring per belt for the look.

import * as THREE from 'three';
import { makeNoise3 } from './renderer.js';
import { ROCK_TYPES } from '../config.js';
import { RNG } from '../rng.js';

const SHAPES = 8;
const CAP = 420;
let baseGeoms = null;

function rockGeometry(seed, detail = 3) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const n = makeNoise3(seed);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const squash = new THREE.Vector3(0.75 + (seed % 7) * 0.06, 0.6 + (seed % 5) * 0.08, 0.8 + (seed % 3) * 0.1);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const big = n(v.x * 1.3 + 5, v.y * 1.3, v.z * 1.3) * 0.5;
        const mid = n(v.x * 3 + 11, v.y * 3, v.z * 3) * 0.25;
        const fine = n(v.x * 8, v.y * 8 + 3, v.z * 8) * 0.08;
        // craters
        const c = n(v.x * 2.2 + 31, v.y * 2.2, v.z * 2.2);
        const crater = c > 0.72 ? -(c - 0.72) * 1.2 : 0;
        const r = 0.7 + big + mid + fine + crater;
        v.multiplyScalar(r).multiply(squash);
        pos.setXYZ(i, v.x, v.y, v.z);
        const shade = 0.55 + (r - 0.8) * 0.9 + fine * 2;
        colors.set([shade, shade, shade], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
}

export function rockShapes() {
    if (!baseGeoms) baseGeoms = Array.from({ length: SHAPES }, (_, i) => rockGeometry(1000 + i * 77, 3));
    return baseGeoms;
}

export class Asteroids {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        const geos = rockShapes();
        this.plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.15, flatShading: true });
        this.glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4, flatShading: true, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.55 });
        this.glowMat.onBeforeCompile = (sh) => {
            // Emissive veins: tint emissive by the instance colour and modulate by a world-space stripe.
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPos = position;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;')
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                    float vein = smoothstep(0.85, 1.0, sin(vRockPos.x * 9.0 + vRockPos.y * 7.0) * sin(vRockPos.z * 8.0 - vRockPos.y * 5.0) * 0.5 + 0.5);
                    totalEmissiveRadiance *= vColor.rgb * (0.15 + vein * 2.5);`);
        };
        this.meshes = { plain: [], glow: [] };
        for (const kind of ['plain', 'glow']) {
            for (let i = 0; i < SHAPES; i++) {
                const m = new THREE.InstancedMesh(geos[i], kind === 'plain' ? this.plainMat : this.glowMat, CAP);
                m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                m.count = 0;
                m.frustumCulled = false;
                m.setColorAt(0, new THREE.Color(1, 1, 1));
                this.group.add(m);
                this.meshes[kind].push(m);
            }
        }
        this.dust = [];
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
        this.colors = {};
        for (const [k, t] of Object.entries(ROCK_TYPES)) this.colors[k] = new THREE.Color(t.glow || t.color);
    }

    buildDust(sys, tier) {
        for (const d of this.dust) { this.group.remove(d); d.geometry.dispose(); }
        this.dust = [];
        const geo = rockShapes()[2];
        const small = new THREE.IcosahedronGeometry(1, 0);
        for (const b of sys.belts) {
            const r = new RNG(b.clusters[0]?.seed || 1);
            const n = Math.round((tier >= 3 ? 900 : tier >= 2 ? 1600 : 2800) * Math.min(1.6, b.radius / 6000));
            const m = new THREE.InstancedMesh(tier >= 2 ? small : geo, new THREE.MeshStandardMaterial({ vertexColors: tier < 2, roughness: 1, flatShading: true, color: 0xffffff }), n);
            const types = Object.keys(b.comp);
            for (let i = 0; i < n; i++) {
                const a = r.range(0, Math.PI * 2);
                const rr = b.radius + r.gauss() * b.width * 0.35;
                this._p.set(Math.cos(a) * rr, r.gauss() * 45, Math.sin(a) * rr);
                this._e.set(r.range(0, 6), r.range(0, 6), r.range(0, 6));
                this._q.setFromEuler(this._e);
                const s = r.chance(0.08) ? r.range(5, 12) : r.range(1, 4.5);
                this._s.setScalar(s);
                this._m.compose(this._p, this._q, this._s);
                m.setMatrixAt(i, this._m);
                const t = r.weighted(types, (k) => b.comp[k]);
                this._c.set(ROCK_TYPES[t].color).multiplyScalar(r.range(0.7, 1.2));
                m.setColorAt(i, this._c);
            }
            m.userData.spin = 0.00002 * (r.chance(0.5) ? 1 : -1);
            this.group.add(m);
            this.dust.push(m);
            // A faint dusty haze ring visible from afar.
            const haze = new THREE.Mesh(new THREE.RingGeometry(b.radius - b.width * 0.7, b.radius + b.width * 0.7, 160, 1), new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
                uniforms: { uCol: { value: new THREE.Color(ROCK_TYPES[types[0]].color).multiplyScalar(0.12) }, uR: { value: b.radius }, uW: { value: b.width * 0.7 } },
                vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vW; varying vec2 vL; void main(){ vL = position.xy; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;\n#include <logdepthbuf_vertex>\n}',
                fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 uCol; uniform float uR, uW; varying vec3 vW; varying vec2 vL; void main(){\n#include <logdepthbuf_fragment>\n float face = abs(normalize(cameraPosition - vW).y); float rr = 1.0 - abs(length(vL) - uR) / uW; gl_FragColor = vec4(uCol * smoothstep(0.0, 1.0, rr) * smoothstep(0.05, 0.4, face), 1.0); }',
            }));
            haze.rotation.x = -Math.PI / 2;
            this.group.add(haze);
            this.dust.push(haze);
        }
    }

    // Sync instanced rocks from the world's active clusters. `pulse` highlights the mined rock.
    sync(world, t, miningId) {
        const counts = { plain: new Array(SHAPES).fill(0), glow: new Array(SHAPES).fill(0) };
        for (const c of world.clusters.values()) {
            for (const r of c.rocks) {
                const kind = ROCK_TYPES[r.type].glow ? 'glow' : 'plain';
                const mesh = this.meshes[kind][r.shape];
                const i = counts[kind][r.shape]++;
                if (i >= CAP) continue;
                const frac = r.ore / r.maxOre;
                let s = r.radius * (0.55 + 0.45 * frac);
                if (r.id === miningId) s *= 1 + Math.sin(t * 40) * 0.015;
                this._p.set(r.pos.x, r.pos.y, r.pos.z);
                this._e.set(r.rot.x + t * r.spin, r.rot.y + t * r.spin * 0.7, r.rot.z);
                this._q.setFromEuler(this._e);
                this._s.setScalar(s);
                this._m.compose(this._p, this._q, this._s);
                mesh.setMatrixAt(i, this._m);
                this._c.copy(this.colors[r.type]);
                if (r.id === miningId) this._c.lerp(new THREE.Color(1, 0.8, 0.5), 0.25);
                mesh.setColorAt(i, this._c);
            }
        }
        for (const kind of ['plain', 'glow']) {
            this.meshes[kind].forEach((m, i) => {
                m.count = Math.min(CAP, counts[kind][i]);
                m.instanceMatrix.needsUpdate = true;
                if (m.instanceColor) m.instanceColor.needsUpdate = true;
            });
        }
        for (const d of this.dust) if (d.userData.spin) d.rotation.y += d.userData.spin * 0.016;
    }
}
