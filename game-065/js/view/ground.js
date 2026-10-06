/**
 * ground.js — the clearing the tree grows in: mossy ground with a pool of
 * light under the tree, wind-blown grass, glowing flowers, ferns, rocks, and a
 * ring of dark forest fading into the fog.
 */

import * as THREE from 'three';
import { U } from './stage.js';

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FOG_FS = /* glsl */`
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogColor, fogF);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>`;

const NOISE = /* glsl */`
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += noise2(p) * a; p *= 2.03; a *= 0.5; } return s; }`;

/**
 * Disc of `rings` rings × `segs` segments out to `radius`, heights from heightFn.
 * Ring radii grow as (i/rings)^1.7, so the clearing is finely tessellated.
 * Wound counter-clockwise seen from above (normals up): (a, b, a+1), (a+1, b, b+1).
 */
export function polarGrid(radius, rings, segs, heightFn) {
    const pos = [], idx = [];
    pos.push(0, heightFn(0, 0), 0);
    for (let i = 1; i <= rings; i++) {
        const r = radius * Math.pow(i / rings, 1.7);
        for (let j = 0; j < segs; j++) {
            const a = (j / segs) * Math.PI * 2;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            pos.push(x, heightFn(x, z), z);
        }
    }
    const v = (i, j) => 1 + (i - 1) * segs + (j % segs);
    for (let j = 0; j < segs; j++) idx.push(0, v(1, j + 1), v(1, j));
    for (let i = 1; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
            const a = v(i, j), a1 = v(i, j + 1), b = v(i + 1, j), b1 = v(i + 1, j + 1);
            idx.push(a, a1, b, a1, b1, b);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** Ground height: flat clearing, gentle hills where the forest begins. */
export function groundY(x, z) {
    const r = Math.hypot(x, z);
    const t = Math.max(0, Math.min(1, (r - 34) / 60));
    return t * t * (3 - 2 * t) * 7 + Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.2 * t;
}

export class Ground {
    constructor(scene, textures, quality) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.uniforms = {
            uTime: U.uTime, uWind: U.uWind, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uGlow: U.uGlow,
            uTreeH: U.uTreeH, uFrost: { value: 0 }, uTint: { value: new THREE.Color(0x2c5a2a) }, uMoonDir: U.uMoonDir,
            uPool: { value: 2 },
        };
        this.buildGround();
        this.buildGrass([26000, 15000, 7000][quality]);
        this.buildFlowers([420, 300, 160][quality], textures);
        this.buildFerns([200, 140, 70][quality], textures);
        this.buildRocks();
        this.buildForest([320, 240, 150][quality]);
    }

    buildGround() {
        // A polar grid, dense near the tree and coarser outward, so the hills
        // where the forest stands are really in the mesh. (A CircleGeometry is a
        // triangle fan with no inner vertices: the hills existed only on its rim
        // and the forest floated above a straight slope.)
        const geo = polarGrid(300, 90, 160, groundY);
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: /* glsl */`
                varying vec3 vW; varying float vFogDepth; varying vec3 vN;
                void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal;
                    vec4 mv = viewMatrix * w; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: /* glsl */`
                uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uGlow; uniform float uTreeH;
                uniform float uFrost; uniform vec3 uTint; uniform vec3 uMoonDir; uniform float uPool;
                varying vec3 vW; varying float vFogDepth; varying vec3 vN;
                ${NOISE}
                void main() {
                    vec2 p = vW.xz;
                    float n = fbm(p * 0.35), n2 = fbm(p * 2.1 + 7.0);
                    vec3 moss = mix(uTint * 0.55, uTint * 1.1, n);
                    vec3 soil = vec3(0.12, 0.09, 0.07);
                    vec3 col = mix(soil, moss, smoothstep(0.32, 0.55, n + n2 * 0.25));
                    col = mix(col, vec3(0.75, 0.82, 0.9), uFrost * smoothstep(0.35, 0.6, n2));
                    float r = length(p);
                    // light pooling under the tree
                    float pool = exp(-r / max(0.6, uPool)) * uGlow;
                    col *= 0.45 + max(dot(normalize(vN), uMoonDir), 0.0) * 0.35;
                    col += vec3(1.0, 0.82, 0.45) * pool * 0.5;
                    // drifting glow specks in the moss
                    float speck = step(0.985, hash2(floor(p * 6.0))) * (0.5 + 0.5 * sin(uTime * 2.0 + hash2(floor(p * 6.0)) * 40.0));
                    col += vec3(0.4, 1.0, 0.7) * speck * 0.25 * smoothstep(40.0, 5.0, r);
                    ${FOG_FS}
                }`,
        });
        const m = new THREE.Mesh(geo, mat);
        m.renderOrder = -1;
        this.group.add(m);
    }

    buildGrass(count) {
        // one blade: 7 verts tapering to a point, height 1, along +y
        const bp = [-0.5, 0, 0.5, 0, -0.42, 0.33, 0.42, 0.33, -0.28, 0.66, 0.28, 0.66, 0, 1];
        const blade = new THREE.BufferGeometry();
        const pos = new Float32Array(7 * 3);
        for (let i = 0; i < 7; i++) { pos[i * 3] = bp[i * 2]; pos[i * 3 + 1] = bp[i * 2 + 1]; }
        blade.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
        const ig = new THREE.InstancedBufferGeometry();
        ig.index = blade.index;
        ig.attributes.position = blade.attributes.position;
        const r = mulberry(31);
        const off = new Float32Array(count * 4), dat = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const rad = 0.7 + Math.pow(r(), 0.8) * 34;
            const a = r() * Math.PI * 2;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
            off.set([x, groundY(x, z), z, r() * Math.PI], i * 4);
            const near = Math.min(1, 0.3 + rad * 0.12);   // short moss-grass near the seed
            dat.set([(0.16 + r() * 0.3 + Math.min(0.25, rad * 0.008)) * near, 0.035 + r() * 0.03, r()], i * 3);
        }
        ig.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 4));
        ig.setAttribute('iDat', new THREE.InstancedBufferAttribute(dat, 3));
        ig.instanceCount = count;
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms, side: THREE.DoubleSide,
            vertexShader: /* glsl */`
                attribute vec4 iOff; attribute vec3 iDat;
                uniform float uTime; uniform float uWind;
                varying float vH; varying float vR; varying vec3 vW; varying float vFogDepth;
                void main() {
                    float h = position.y;
                    float c = cos(iOff.w), s = sin(iOff.w);
                    vec3 p = vec3(position.x * iDat.y * c, h * iDat.x, position.x * iDat.y * s);
                    vec2 wp = iOff.xz;
                    float gust = sin(uTime * 1.3 + wp.x * 0.35 + wp.y * 0.2) * 0.5 + sin(uTime * 2.7 + wp.x * 1.1) * 0.25;
                    float bend = (gust * 0.6 + 0.35) * uWind * h * h;
                    p.x += bend * 0.35 * iDat.x; p.z += bend * 0.2 * iDat.x;
                    p.y -= bend * bend * 0.04;
                    vec4 w = vec4(p + iOff.xyz, 1.0);
                    vH = h; vR = iDat.z; vW = w.xyz;
                    vec4 mv = viewMatrix * w; vFogDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uFogColor; uniform float uFogDensity; uniform float uGlow; uniform float uFrost; uniform vec3 uTint; uniform float uPool;
                varying float vH; varying float vR; varying vec3 vW; varying float vFogDepth;
                void main() {
                    vec3 base = mix(uTint * 0.35, uTint * (1.15 + vR * 0.4), vH);
                    base = mix(base, vec3(0.8, 0.88, 0.95), uFrost * vH * 0.8);
                    float r = length(vW.xz);
                    vec3 col = base * 0.75;
                    col += vec3(1.0, 0.85, 0.5) * exp(-r / max(0.6, uPool * 1.2)) * uGlow * vH * 0.6;
                    col += vec3(0.5, 1.0, 0.8) * step(0.97, vR) * vH * 0.2;
                    ${FOG_FS}
                }`,
        });
        const m = new THREE.Mesh(ig, mat);
        m.frustumCulled = false;
        this.group.add(m);
    }

    buildFlowers(count, textures) {
        const r = mulberry(91);
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(count * 3), d = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            // clumps
            const ca = Math.floor(r() * 24) * 0.9, cr = 3 + (Math.floor(r() * 24) % 9) * 3.2;
            const x = Math.cos(ca) * cr + (r() - 0.5) * 3, z = Math.sin(ca) * cr + (r() - 0.5) * 3;
            p.set([x, groundY(x, z) + 0.12 + r() * 0.2, z], i * 3);
            d.set([Math.floor(r() * 5), r()], i * 2);
        }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('aD', new THREE.BufferAttribute(d, 2));
        this.flowerU = { uTime: U.uTime, uMap: { value: textures.glow }, uOpen: { value: 1 }, uPx: { value: 1 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.flowerU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute vec2 aD; uniform float uTime; uniform float uOpen; uniform float uPx;
                varying vec3 vC; varying float vA;
                void main() {
                    vec3 cols[5];
                    cols[0] = vec3(1.0, 0.45, 0.85); cols[1] = vec3(0.45, 0.8, 1.0); cols[2] = vec3(1.0, 0.9, 0.45);
                    cols[3] = vec3(0.7, 0.5, 1.0); cols[4] = vec3(0.5, 1.0, 0.7);
                    int k = int(aD.x);
                    vC = k == 0 ? cols[0] : k == 1 ? cols[1] : k == 2 ? cols[2] : k == 3 ? cols[3] : cols[4];
                    vA = uOpen * (0.55 + 0.45 * sin(uTime * 1.5 + aD.y * 30.0));
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = min(uPx * 9.0, uPx * (0.22 + aD.y * 0.12) * 420.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap; varying vec3 vC; varying float vA;
                void main() { float t = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vC * t * vA, 1.0); }`,
        });
        const pts = new THREE.Points(g, mat);
        pts.frustumCulled = false;
        this.group.add(pts);
    }

    buildFerns(count, textures) {
        const r = mulberry(17);
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.translate(0, 0.5, 0);
        const mat = new THREE.MeshStandardMaterial({ map: textures.fern, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9fd09a, emissive: 0x1f4a2a, emissiveIntensity: 0.6, roughness: 0.9 });
        const mesh = new THREE.InstancedMesh(geo, mat, count * 3);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        let k = 0;
        for (let i = 0; i < count; i++) {
            const a = r() * Math.PI * 2, rad = 5 + r() * 30;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
            const sc = 0.6 + r() * 0.9;
            for (let j = 0; j < 3; j++) {
                q.setFromEuler(new THREE.Euler(-0.35 - r() * 0.3, j * 2.1 + r(), 0, 'YXZ'));
                p.set(x, groundY(x, z), z);
                s.set(sc, sc * (0.9 + r() * 0.3), sc);
                m.compose(p, q, s);
                mesh.setMatrixAt(k++, m);
            }
        }
        this.group.add(mesh);
    }

    buildRocks() {
        const r = mulberry(5);
        const geo = new THREE.DodecahedronGeometry(1, 1);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pa, i);
            v.multiplyScalar(0.8 + Math.sin(v.x * 3 + v.z * 2) * 0.12 + Math.cos(v.y * 4) * 0.08);
            pa.setXYZ(i, v.x, v.y * 0.7, v.z);
        }
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ color: 0x8a9a90, emissive: 0x18242a, roughness: 0.95, flatShading: true });
        const n = 46;
        const mesh = new THREE.InstancedMesh(geo, mat, n);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i++) {
            const a = r() * Math.PI * 2, rad = 7 + r() * 32;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad, sc = 0.3 + Math.pow(r(), 2) * 1.6;
            m.compose(new THREE.Vector3(x, groundY(x, z) + sc * 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(sc, sc, sc));
            mesh.setMatrixAt(i, m);
        }
        this.group.add(mesh);
    }

    buildForest(count) {
        const r = mulberry(1234);
        // conifer: three stacked cones; broadleaf: blob on a trunk
        const cone = (rad, h, y) => new THREE.ConeGeometry(rad, h, 7, 1).translate(0, y, 0);
        const merge = (geos) => {
            const out = new THREE.BufferGeometry();
            let n = 0; for (const g of geos) n += g.index ? g.index.count : g.attributes.position.count;
            const pos = [], nor = [];
            for (const g0 of geos) {
                const g = g0.index ? g0.toNonIndexed() : g0;
                g.computeVertexNormals();
                pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
            }
            out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
            return out;
        };
        const conifer = merge([new THREE.CylinderGeometry(0.25, 0.35, 2, 5).translate(0, 1, 0), cone(2.2, 3.5, 3.2), cone(1.7, 3, 5.0), cone(1.1, 2.6, 6.6)]);
        const blob = new THREE.IcosahedronGeometry(2.6, 1);
        const bp = blob.attributes.position;
        for (let i = 0; i < bp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(bp, i); v.multiplyScalar(0.85 + Math.sin(v.x * 2.1) * 0.1 + Math.cos(v.z * 1.7 + v.y) * 0.1); bp.setXYZ(i, v.x, v.y, v.z); }
        const broad = merge([new THREE.CylinderGeometry(0.3, 0.45, 3.2, 5).translate(0, 1.6, 0), blob.translate(0, 4.6, 0)]);
        // Trees between the camera and the World Tree dissolve (dithered), so a
        // zoomed-out camera standing in the forest still sees the clearing.
        const matC = this.forestMaterial(0x2a5a46);
        const matB = this.forestMaterial(0x34603e);
        const nC = Math.floor(count * 0.6), nB = count - nC;
        const mc = new THREE.InstancedMesh(conifer, matC, nC), mb = new THREE.InstancedMesh(broad, matB, nB);
        const m = new THREE.Matrix4(), col = new THREE.Color();
        const place = (mesh, i, minR) => {
            const a = r() * Math.PI * 2, rad = minR + Math.pow(r(), 0.7) * 85;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad, sc = 0.8 + r() * 1.1 + rad * 0.01;
            // sink the trunk by the slope under it so the downhill side never floats
            const slope = Math.max(Math.abs(groundY(x + 1, z) - groundY(x - 1, z)), Math.abs(groundY(x, z + 1) - groundY(x, z - 1))) * 0.5;
            m.compose(new THREE.Vector3(x, groundY(x, z) - 0.3 - slope * 0.9 * sc, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.08, r() * 6, (r() - 0.5) * 0.08)), new THREE.Vector3(sc, sc * (0.85 + r() * 0.4), sc));
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, col.setHSL(0.36 + (r() - 0.5) * 0.08, 0.35, 0.45 + r() * 0.35));
        };
        for (let i = 0; i < nC; i++) place(mc, i, 36);
        for (let i = 0; i < nB; i++) place(mb, i, 38);
        this.forestMats = [matC, matB];
        this.group.add(mc, mb);
    }

    forestMaterial(hex) {
        return new THREE.ShaderMaterial({
            uniforms: { ...this.uniforms, uColor: { value: new THREE.Color(hex) }, uCam: { value: new THREE.Vector3() }, uFade: { value: 10 } },
            vertexShader: /* glsl */`
                varying vec3 vN; varying vec3 vW; varying float vFogDepth; varying vec3 vC; varying float vBase;
                void main() {
                    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
                    vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
                    vW = w.xyz;
                    vBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
                    #ifdef USE_INSTANCING_COLOR
                    vC = instanceColor;
                    #else
                    vC = vec3(1.0);
                    #endif
                    vec4 mv = viewMatrix * w; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 uColor; uniform vec3 uMoonDir; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uCam; uniform float uFade;
                uniform float uGlow;
                varying vec3 vN; varying vec3 vW; varying float vFogDepth; varying vec3 vC; varying float vBase;
                void main() {
                    // dissolve trees close to the camera, with a screen-door dither
                    float d = distance(vW.xz, uCam.xz);
                    float keep = smoothstep(uFade * 0.6, uFade, d);
                    float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
                    if (keep < dither) discard;
                    vec3 n = normalize(vN);
                    float lit = max(dot(n, uMoonDir), 0.0) * 0.55 + (n.y * 0.5 + 0.5) * 0.25 + 0.08;
                    vec3 col = uColor * vC * lit * 0.5;
                    col += uColor * 0.15 * smoothstep(3.0, 0.0, vW.y - vBase) * uGlow;
                    float rim = pow(1.0 - abs(dot(n, normalize(uCam - vW))), 3.0);
                    col += vec3(0.15, 0.3, 0.35) * rim * 0.25;
                    ${FOG_FS}
                }`,
        });
    }

    /** Called every frame: forest trees near the camera fade out. */
    setCamera(pos, dist) {
        for (const m of this.forestMats) { m.uniforms.uCam.value.copy(pos); m.uniforms.uFade.value = Math.max(6, dist * 0.35); }
    }

    pxScale(px) { this.flowerU.uPx.value = px; }

    /** Season s in [0,4): tint the moss, open or close the flowers, frost in winter. */
    setSeason(s) {
        const tints = [0x3a7a34, 0x2c6a3a, 0x5a5a26, 0x3e5a5e];
        const frost = [0, 0, 0, 0.75], open = [1, 0.85, 0.5, 0.15];
        const i = Math.floor(s) % 4, j = (i + 1) % 4;
        let f = (s - Math.floor(s) - 0.85) / 0.15; f = Math.max(0, Math.min(1, f)); f = f * f * (3 - 2 * f);
        this.uniforms.uTint.value.setHex(tints[i]).lerp(new THREE.Color(tints[j]), f);
        this.uniforms.uFrost.value = frost[i] + (frost[j] - frost[i]) * f;
        this.flowerU.uOpen.value = open[i] + (open[j] - open[i]) * f;
    }

    setPool(r) { this.uniforms.uPool.value = r; }
}
