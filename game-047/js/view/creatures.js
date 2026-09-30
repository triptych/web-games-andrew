/**
 * creatures.js — every monster, Warden and hero is modelled from primitives,
 * driven by a genome (sim/monsters.js makeLook, sim/heroes.js heroIdentity).
 *
 * Body plans: blob, beast, knight, flyer, bloom, wraith, serpent, eye, golem,
 * construct, jester — plus parts any plan can grow: horns, spikes, crowns,
 * wings, tendrils, orbiting shards, extra eyes.
 *
 * Materials are MeshStandardMaterial with a shader patch (onBeforeCompile)
 * adding: emissive veins from 3D noise, a coloured rim light, a white hit
 * flash and a noise dissolve with a glowing edge for deaths and summons.
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../sim/rng.js';
import { makeNoise, canvas, colorTex, radialTex } from './textures.js';
import { GLSL_NOISE } from './world.js';

// ------------------------------------------------------------------ material

function creatureMat(color, U, { rough = 0.55, metal = 0.05, vein = 0, glow = false, emissive = 0x000000, ei = 1, side = THREE.FrontSide, transparent = false, opacity = 1, flat = false } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, side, transparent, opacity, flatShading: flat });
    m.userData.vein = vein;
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = U.uTime; sh.uniforms.uHit = U.uHit; sh.uniforms.uDissolve = U.uDissolve;
        sh.uniforms.uGlow = U.uGlow; sh.uniforms.uRim = U.uRim; sh.uniforms.uVein = { value: vein };
        sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
        sh.fragmentShader = `varying vec3 vObjPos;\nuniform float uTime, uHit, uDissolve, uVein;\nuniform vec3 uGlow, uRim;\n${GLSL_NOISE}\n` + sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                float dn = noise3(vObjPos * 3.5 + 7.0);
                if (dn < uDissolve) discard;
                float dEdge = uDissolve > 0.001 ? smoothstep(uDissolve + 0.08, uDissolve, dn) : 0.0;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                ${glow ? '' : `if (uVein > 0.0) {
                    float vn = fbm3(vObjPos * 2.2 + vec3(0.0, uTime * 0.15, 0.0));
                    float v = smoothstep(0.035, 0.0, abs(vn - 0.5));
                    totalEmissiveRadiance += uGlow * v * uVein * (0.65 + 0.35 * sin(uTime * 2.3 + vObjPos.y * 3.0));
                }`}
                vec3 vdir = normalize(vViewPosition);
                float rim = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 3.0);
                totalEmissiveRadiance += uRim * rim * 0.55;
                totalEmissiveRadiance += vec3(uHit) * 1.4;
                totalEmissiveRadiance += uGlow * dEdge * 5.0;`);
    };
    m.customProgramCacheKey = () => `creature${glow ? 1 : 0}${vein > 0 ? 1 : 0}`;
    return m;
}

// ------------------------------------------------------------------ geometry helpers

function blobGeo(r, detail, amp, seed, stretch = [1, 1, 1]) {
    let g = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const N = makeNoise(seed);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = (N.fbm(x * 1.3 + z * 0.7 + 3, y * 1.3 - z * 0.4, 4) - 0.5) * 2;
        const k = 1 + n * amp;
        p.setXYZ(i, x * k * stretch[0], y * k * stretch[1], z * k * stretch[2]);
    }
    g.computeVertexNormals();
    return g;
}

/** A cone bent sideways along its length: horns, claws, tails, tentacle tips. */
function bentCone(r, len, bend, seg = 8) {
    const g = new THREE.ConeGeometry(r, len, seg, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const t = (y + len / 2) / len;
        p.setX(i, p.getX(i) + bend * t * t * len);
    }
    g.translate(0, len / 2, 0);
    g.computeVertexNormals();
    return g;
}

function M(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
}

function wingGeo(span, seed) {
    const rng = makeRng(seed);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(span * 0.4, span * 0.55, span, span * 0.35);
    const n = 4;
    for (let i = 0; i < n; i++) {
        const t0 = 1 - i / n, t1 = 1 - (i + 1) / n;
        const x1 = span * t1, y1 = span * 0.35 * t1 - span * 0.15 * (1 - t1);
        s.quadraticCurveTo(span * (t0 + t1) / 2, span * 0.02 + rng.range(-0.05, 0.05) * span, x1, y1);
    }
    s.lineTo(0, -span * 0.05);
    const g = new THREE.ShapeGeometry(s, 8);
    g.computeVertexNormals();
    return g;
}

function faceTexture(seed, kind) {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    if (kind === 'iris') {
        const rng = makeRng(seed);
        const hue = rng.range(0, 360);
        const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
        gr.addColorStop(0, '#000'); gr.addColorStop(0.28, '#000'); gr.addColorStop(0.3, `hsl(${hue},90%,60%)`);
        gr.addColorStop(0.7, `hsl(${hue + 30},80%,35%)`); gr.addColorStop(0.95, `hsl(${hue},60%,15%)`); gr.addColorStop(1, '#000');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = `hsla(${hue + 60},90%,80%,0.35)`;
        for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 40, 128 + Math.sin(a) * 40); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(100, 96, 14, 0, Math.PI * 2); g.fill();
    } else {
        // jester mask
        g.fillStyle = '#f4ece0'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#111';
        g.beginPath(); g.ellipse(88, 110, 20, 12, 0.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(168, 110, 20, 12, -0.3, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2040c0'; g.beginPath(); g.moveTo(88, 124); g.lineTo(82, 170); g.lineTo(94, 170); g.fill();
        g.strokeStyle = '#a01030'; g.lineWidth = 8; g.beginPath(); g.moveTo(80, 190); g.quadraticCurveTo(128, 236, 176, 190); g.stroke();
        g.fillStyle = '#d02040'; g.beginPath(); g.arc(128, 150, 10, 0, Math.PI * 2); g.fill();
    }
    return colorTex(c);
}

let shadowTex = null, ringTex = null;
function ringTexture() {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    g.strokeStyle = '#fff';
    g.lineWidth = 8; g.shadowColor = '#fff'; g.shadowBlur = 18;
    g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.lineTo(128 + Math.cos(a) * 122, 128 + Math.sin(a) * 122); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ parts

function addEyes(body, n, U, look, { y, z, spread = 0.22, size = 0.1, stalk = false } = {}) {
    const white = creatureMat(0xfff4e0, U, { rough: 0.15, glow: true, emissive: look.glow, ei: 0.35 });
    const pupil = creatureMat(0x050505, U, { rough: 0.1, glow: true, emissive: look.glow, ei: 2.2 });
    const eyes = [];
    for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * (n - 1);
        const e = new THREE.Group();
        e.position.set(off, y + (n > 2 ? Math.abs(off) * -0.4 : 0) + (i % 2 && n > 3 ? 0.12 : 0), z);
        const ball = M(new THREE.SphereGeometry(size, 16, 12), white);
        const p = M(new THREE.SphereGeometry(size * 0.5, 12, 8), pupil, 0, 0, size * 0.62);
        e.add(ball, p);
        if (stalk) e.add(M(new THREE.CylinderGeometry(size * 0.25, size * 0.35, 0.4, 6), white, 0, -0.25, 0));
        body.add(e);
        eyes.push(e);
    }
    return eyes;
}

function addHorns(body, n, mat, { y, r = 0.08, len = 0.6, spread = 0.35, z = 0 } = {}) {
    for (let i = 0; i < n; i++) {
        for (const s of [-1, 1]) {
            const h = M(bentCone(r * (1 - i * 0.2), len * (1 - i * 0.2), 0.5 * s), mat, s * (spread + i * 0.12), y - i * 0.1, z - i * 0.1);
            h.rotation.z = -s * (0.3 + i * 0.3);
            h.rotation.x = -0.2;
            body.add(h);
        }
    }
}

function addCrown(body, U, y, r, gem) {
    const gold = creatureMat(0xffc040, U, { rough: 0.25, metal: 1, glow: true });
    const g = new THREE.Group();
    g.position.y = y;
    g.add(M(new THREE.TorusGeometry(r, r * 0.12, 8, 24), gold));
    g.children[0].rotation.x = Math.PI / 2;
    const gemMat = creatureMat(gem, U, { rough: 0.1, glow: true, emissive: gem, ei: 2.5 });
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const sp = M(new THREE.ConeGeometry(r * 0.16, r * 0.8, 6), gold, Math.cos(a) * r, r * 0.4, Math.sin(a) * r);
        g.add(sp);
        g.add(M(new THREE.OctahedronGeometry(r * 0.09), gemMat, Math.cos(a) * r * 1.05, r * 0.05, Math.sin(a) * r * 1.05));
    }
    body.add(g);
    return g;
}

function addSpikes(body, n, mat, rng, { y0, y1, z = -0.3, r = 0.07, len = 0.35 }) {
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const s = M(new THREE.ConeGeometry(r, len * rng.range(0.7, 1.3), 6), mat, rng.range(-0.08, 0.08), y0 + (y1 - y0) * t, z);
        s.rotation.x = -0.9;
        body.add(s);
    }
}

function addTendrils(body, n, mat, rng, { y, spread = 0.5, len = 1.2 }) {
    const out = [];
    for (let i = 0; i < n; i++) {
        let parent = new THREE.Group();
        parent.position.set((i / Math.max(1, n - 1) - 0.5) * spread * 2, y, rng.range(-0.2, 0.2));
        body.add(parent);
        const segs = 6;
        const chain = [];
        for (let k = 0; k < segs; k++) {
            const r = 0.07 * (1 - k / segs) + 0.015;
            const seg = M(new THREE.CylinderGeometry(r * 0.8, r, len / segs, 6), mat, 0, -len / segs / 2, 0);
            const joint = new THREE.Group();
            joint.add(seg);
            parent.add(joint);
            joint.position.y = k === 0 ? 0 : -len / segs;
            chain.push(joint);
            parent = joint;
        }
        out.push({ chain, ph: rng.range(0, 6) });
    }
    return out;
}

function addWings(body, look, U, rng, { y, z = -0.2, span = 1.6 }) {
    const mat = creatureMat(look.accent, U, { rough: 0.7, side: THREE.DoubleSide, vein: 0.6, transparent: true, opacity: 0.92 });
    const geo = wingGeo(span, look.seed);
    const out = [];
    for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.2, y, z);
        const w = new THREE.Mesh(geo, mat);
        w.scale.x = s;
        w.castShadow = true;
        pivot.add(w);
        body.add(pivot);
        out.push({ pivot, s });
    }
    return out;
}

function addShards(root, n, U, look, y, r) {
    const mat = creatureMat(look.glow, U, { rough: 0.1, glow: true, emissive: look.glow, ei: 2 });
    const g = new THREE.Group();
    g.position.y = y;
    for (let i = 0; i < n; i++) {
        const s = M(new THREE.OctahedronGeometry(0.12 + (i % 2) * 0.05), mat);
        s.userData.a = (i / n) * Math.PI * 2;
        s.userData.r = r * (0.9 + (i % 3) * 0.1);
        g.add(s);
    }
    root.add(g);
    return g;
}

// ------------------------------------------------------------------ body plans

const PLANS = {
    blob(c, L, rng, U) {
        const body = M(blobGeo(0.95, 5, 0.1 + L.lumpy * 0.6, L.seed, [1.1, 0.85 * L.squash, 1]), c.mats.body, 0, 0.85, 0);
        c.body.add(body);
        for (let i = 0; i < 4; i++) c.body.add(M(new THREE.SphereGeometry(0.12 + rng.range(0, 0.1), 10, 8), c.mats.body, rng.range(-0.8, 0.8), 0.12, rng.range(-0.5, 0.6)));
        c.eyes = addEyes(c.body, L.eyes, U, L, { y: 1.15, z: 0.78, size: 0.13, spread: 0.3 });
        addHorns(c.body, L.horns, c.mats.accent, { y: 1.55, spread: 0.3 });
        c.height = 1.9;
        c.anim = (t) => { const s = Math.sin(t * 2.2); body.scale.set(1 + s * 0.04, 1 - s * 0.05, 1 + s * 0.04); };
    },
    beast(c, L, rng, U) {
        const g = new THREE.Group();
        g.rotation.y = rng.chance(0.5) ? 0.55 : -0.55;
        c.body.add(g);
        const torso = M(blobGeo(0.6, 4, L.lumpy * 0.5, L.seed, [0.9, 0.85, 1.5]), c.mats.body, 0, 1.15, -0.1);
        g.add(torso);
        const head = new THREE.Group();
        head.position.set(0, 1.45, 0.85);
        head.add(M(blobGeo(0.42, 4, 0.12, L.seed + 1, [0.9, 0.85, 1.1]), c.mats.body));
        head.add(M(new THREE.ConeGeometry(0.22, 0.5, 8), c.mats.belly, 0, -0.08, 0.4)).children;
        head.children[1].rotation.x = Math.PI / 2;
        const jaw = M(new THREE.BoxGeometry(0.3, 0.08, 0.4), c.mats.accent, 0, -0.25, 0.25);
        head.add(jaw);
        g.add(head);
        c.eyes = addEyes(head, Math.min(L.eyes, 3), U, L, { y: 0.12, z: 0.33, size: 0.07, spread: 0.2 });
        addHorns(head, L.horns, c.mats.accent, { y: 0.28, spread: 0.2, len: 0.5 });
        const legs = [];
        for (const [x, z] of [[-0.35, 0.55], [0.35, 0.55], [-0.35, -0.7], [0.35, -0.7]]) {
            const leg = new THREE.Group();
            leg.position.set(x, 0.95, z);
            leg.add(M(new THREE.CylinderGeometry(0.1, 0.13, 0.95, 8), c.mats.body, 0, -0.47, 0));
            leg.add(M(bentCone(0.05, 0.18, 0.4), c.mats.accent, -0.03, -0.95, 0.08));
            leg.children[1].rotation.x = Math.PI / 2;
            g.add(leg);
            legs.push(leg);
        }
        const tail = M(bentCone(0.1, 1.1, 0.6), c.mats.body, 0, 1.2, -0.9);
        tail.rotation.x = -2.2;
        g.add(tail);
        addSpikes(g, 3 + L.spikes, c.mats.accent, rng, { y0: 1.55, y1: 1.4, z: -0.2 });
        c.spikesOn = g;
        c.height = 2.1;
        c.anim = (t) => {
            torso.scale.y = 1 + Math.sin(t * 2) * 0.03;
            head.rotation.x = Math.sin(t * 1.3) * 0.08;
            jaw.position.y = -0.25 - Math.max(0, Math.sin(t * 1.3)) * 0.05;
            tail.rotation.z = Math.sin(t * 2.5) * 0.3;
            legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 2 + i) * 0.04; });
        };
    },
    knight(c, L, rng, U) {
        const armor = creatureMat(L.accent, U, { rough: 0.35, metal: 0.85, vein: 0.3 });
        const torso = M(new THREE.CylinderGeometry(0.5, 0.36, 1.1, 10), armor, 0, 1.65, 0);
        c.body.add(torso);
        c.body.add(M(new THREE.CylinderGeometry(0.36, 0.42, 0.5, 10), c.mats.body, 0, 0.95, 0));
        for (const s of [-1, 1]) {
            c.body.add(M(new THREE.CylinderGeometry(0.12, 0.1, 0.9, 8), armor, s * 0.2, 0.45, 0));
            c.body.add(M(new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), armor, s * 0.6, 2.05, 0));
            c.body.add(M(new THREE.CylinderGeometry(0.1, 0.09, 0.9, 8), c.mats.body, s * 0.62, 1.55, 0));
        }
        const helm = new THREE.Group();
        helm.position.y = 2.45;
        helm.add(M(new THREE.CylinderGeometry(0.28, 0.3, 0.5, 12), armor));
        helm.add(M(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), armor, 0, 0.25, 0));
        helm.add(M(new THREE.BoxGeometry(0.4, 0.05, 0.05), c.mats.glow, 0, 0.02, 0.28));
        c.body.add(helm);
        addHorns(helm, L.horns, c.mats.accent, { y: 0.3, spread: 0.22, len: 0.5 });
        const sword = new THREE.Group();
        sword.position.set(0.72, 1.2, 0.2);
        sword.add(M(new THREE.BoxGeometry(0.09, 1.5, 0.02), creatureMat(0xd8e0f0, U, { rough: 0.15, metal: 1, glow: true }), 0, 0.3, 0));
        sword.add(M(new THREE.BoxGeometry(0.4, 0.06, 0.08), armor, 0, -0.45, 0));
        sword.rotation.z = -0.3;
        c.body.add(sword);
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6, 6, 8), creatureMat(L.body, U, { side: THREE.DoubleSide, rough: 0.9 }));
        cape.position.set(0, 1.4, -0.38);
        c.body.add(cape);
        const base = cape.geometry.attributes.position.array.slice();
        c.height = 2.9;
        c.anim = (t) => {
            torso.scale.y = 1 + Math.sin(t * 1.6) * 0.02;
            sword.rotation.z = -0.3 + Math.sin(t * 1.2) * 0.05;
            const p = cape.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) { const y = base[i * 3 + 1]; p.setZ(i, Math.sin(t * 2 + y * 3 + base[i * 3]) * 0.08 * (0.8 - y)); }
            p.needsUpdate = true;
        };
    },
    flyer(c, L, rng, U) {
        c.float = 1.2;
        const body = M(blobGeo(0.45, 4, 0.1, L.seed, [0.9, 1.1, 1]), c.mats.body, 0, 1.6, 0);
        c.body.add(body);
        const head = new THREE.Group();
        head.position.set(0, 2.15, 0.15);
        head.add(M(new THREE.SphereGeometry(0.3, 14, 10), c.mats.body));
        const beak = M(new THREE.ConeGeometry(0.1, 0.35, 8), c.mats.accent, 0, -0.05, 0.35);
        beak.rotation.x = Math.PI / 2;
        head.add(beak);
        c.body.add(head);
        c.eyes = addEyes(head, Math.min(L.eyes, 3), U, L, { y: 0.08, z: 0.25, size: 0.07, spread: 0.18 });
        addHorns(head, L.horns, c.mats.accent, { y: 0.22, spread: 0.15, len: 0.35 });
        c.wings = addWings(c.body, L, U, rng, { y: 1.8, span: 1.7 });
        for (const s of [-1, 1]) {
            const talon = M(bentCone(0.04, 0.4, 0.3), c.mats.accent, s * 0.15, 1.25, 0.1);
            talon.rotation.x = Math.PI;
            c.body.add(talon);
        }
        const tail = M(new THREE.ConeGeometry(0.2, 0.7, 4), c.mats.accent, 0, 1.2, -0.3);
        tail.rotation.x = -2.5;
        c.body.add(tail);
        c.height = 2.5;
        c.anim = (t) => {
            const f = Math.sin(t * 7);
            for (const w of c.wings) { w.pivot.rotation.y = w.s * (0.35 + f * 0.55); w.pivot.rotation.z = w.s * 0.25; }
            head.rotation.y = Math.sin(t * 0.9) * 0.3;
        };
    },
    bloom(c, L, rng, U) {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, 0.7, 0), new THREE.Vector3(-0.1, 1.4, 0.05), new THREE.Vector3(0, 1.9, 0.1)]);
        const stem = M(new THREE.TubeGeometry(curve, 24, 0.12, 8), c.mats.body);
        c.body.add(stem);
        const headG = new THREE.Group();
        headG.position.set(0, 2.0, 0.12);
        c.body.add(headG);
        const petalMat = creatureMat(L.accent, U, { rough: 0.5, side: THREE.DoubleSide, vein: 0.7 });
        const np = rng.int(6, 10);
        for (let i = 0; i < np; i++) {
            const a = (i / np) * Math.PI * 2;
            const p = M(new THREE.SphereGeometry(0.42, 12, 8), petalMat, Math.cos(a) * 0.45, Math.sin(a) * 0.45, -0.05);
            p.scale.set(0.55, 1.1, 0.15);
            p.rotation.z = a - Math.PI / 2;
            headG.add(p);
        }
        headG.add(M(new THREE.SphereGeometry(0.3, 16, 12), c.mats.glow));
        c.eyes = addEyes(headG, Math.min(L.eyes, 3), U, L, { y: 0.02, z: 0.26, size: 0.08, spread: 0.15 });
        for (let i = 0; i < 4; i++) {
            const leaf = M(new THREE.SphereGeometry(0.35, 10, 6), c.mats.body, (i % 2 ? 1 : -1) * 0.35, 0.4 + i * 0.3, 0);
            leaf.scale.set(1.2, 0.2, 0.5);
            leaf.rotation.z = (i % 2 ? -1 : 1) * 0.5;
            c.body.add(leaf);
        }
        c.tendrils = addTendrils(c.body, 3 + L.tendrils, c.mats.body, rng, { y: 0.3, spread: 0.6, len: 0.8 });
        c.tendrils.forEach((t2) => { t2.chain[0].parent.rotation.z = Math.PI; });
        c.height = 2.6;
        c.anim = (t) => {
            headG.rotation.z = Math.sin(t * 0.9) * 0.15;
            headG.rotation.x = Math.sin(t * 1.2) * 0.1;
            stem.rotation.z = Math.sin(t * 0.9) * 0.04;
        };
    },
    wraith(c, L, rng, U) {
        c.float = 0.6;
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const r = t < 0.22 ? 0.06 + Math.sin((t / 0.22) * Math.PI * 0.5) * 0.36 : 0.42 + Math.pow(t - 0.22, 1.35) * 0.95;
            pts.push(new THREE.Vector2(r, 2.35 - t * 2.25));
        }
        const geo = new THREE.LatheGeometry(pts, 24);
        const p = geo.attributes.position;
        const N = makeNoise(L.seed);
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            if (y < 0.7) { const x = p.getX(i), z = p.getZ(i); p.setY(i, y - N.n2(Math.atan2(z, x) * 3 + 10, 0.5) * 0.5 * (0.7 - y)); }
        }
        geo.computeVertexNormals();
        const robe = M(geo, creatureMat(L.body, U, { side: THREE.DoubleSide, rough: 0.85, vein: 0.5, transparent: true, opacity: 0.93 }));
        c.body.add(robe);
        const hood = M(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), c.mats.body, 0, 2.42, -0.02);
        c.body.add(hood);
        c.body.add(M(new THREE.CircleGeometry(0.24, 16), creatureMat(0x000000, U, { glow: true }), 0, 2.4, 0.3));
        c.eyes = addEyes(c.body, Math.min(L.eyes, 3), U, L, { y: 2.42, z: 0.33, size: 0.05, spread: 0.14 });
        const arms = [];
        for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(s * 0.45, 2.0, 0.1);
            arm.add(M(bentCone(0.08, 0.9, s * 0.2), c.mats.body));
            arm.rotation.z = s * 2.6;
            c.body.add(arm);
            arms.push(arm);
        }
        c.height = 2.9;
        c.anim = (t) => {
            robe.rotation.y = Math.sin(t * 0.7) * 0.1;
            arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.4 + i * 2) * 0.25; });
        };
    },
    serpent(c, L, rng, U) {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const a = t * Math.PI * 2.2;
            const r = 0.8 * (1 - t) + 0.05;
            pts.push(new THREE.Vector3(Math.cos(a) * r * (t < 0.5 ? 1 : 0.4), 0.3 + Math.pow(t, 1.6) * 2.6, Math.sin(a) * r * (t < 0.5 ? 1 : 0.4) - 0.2));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = M(new THREE.TubeGeometry(curve, 80, 0.26, 12), c.mats.body);
        c.body.add(tube);
        const end = pts[pts.length - 1];
        const head = new THREE.Group();
        head.position.copy(end);
        head.add(M(blobGeo(0.38, 4, 0.1, L.seed, [0.9, 0.7, 1.3]), c.mats.body));
        const jaw = M(new THREE.ConeGeometry(0.22, 0.55, 8), c.mats.belly, 0, -0.16, 0.42);
        jaw.rotation.x = Math.PI / 2;
        head.add(jaw);
        c.body.add(head);
        c.eyes = addEyes(head, Math.min(L.eyes, 4), U, L, { y: 0.12, z: 0.36, size: 0.07, spread: 0.18 });
        addHorns(head, Math.max(1, L.horns), c.mats.accent, { y: 0.2, spread: 0.2, len: 0.45 });
        for (let i = 3; i < 9; i++) {
            const pp = curve.getPoint(i / 10);
            const fin = M(new THREE.ConeGeometry(0.1, 0.4, 4), c.mats.accent, pp.x, pp.y + 0.25, pp.z - 0.1);
            c.body.add(fin);
        }
        c.height = 3.3;
        c.anim = (t) => {
            head.rotation.y = Math.sin(t * 1.1) * 0.35;
            head.rotation.x = Math.sin(t * 1.7) * 0.1;
            jaw.rotation.x = Math.PI / 2 + Math.max(0, Math.sin(t * 1.7)) * 0.3;
            c.body.rotation.y = Math.sin(t * 0.6) * 0.15;
        };
    },
    eye(c, L, rng, U) {
        c.float = 1.1;
        const eyeG = new THREE.Group();
        eyeG.position.y = 1.9;
        c.body.add(eyeG);
        eyeG.add(M(new THREE.SphereGeometry(0.85, 32, 24), creatureMat(0xf0e8e0, U, { rough: 0.15, vein: 0.35 })));
        const iris = M(new THREE.CircleGeometry(0.5, 32), new THREE.MeshStandardMaterial({ map: faceTexture(L.seed, 'iris'), roughness: 0.05, emissive: L.glow, emissiveIntensity: 0.35 }), 0, 0, 0.84);
        eyeG.add(iris);
        const lids = [];
        for (const s of [1, -1]) {
            const lid = M(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), c.mats.body);
            lid.rotation.x = s > 0 ? -0.95 : Math.PI + 0.95;
            eyeG.add(lid);
            lids.push({ lid, s });
        }
        c.tendrils = addTendrils(c.body, 4 + L.tendrils, c.mats.body, rng, { y: 1.2, spread: 0.45, len: 1.2 });
        addSpikes(eyeG, 3 + L.spikes, c.mats.accent, rng, { y0: 0.7, y1: 0.4, z: -0.6 });
        c.height = 2.9;
        c.eyeLook = eyeG;
        c.anim = (t) => {
            const blink = Math.max(0, Math.sin(t * 0.7 + L.seed) - 0.97) * 30;
            for (const { lid, s } of lids) lid.rotation.x = s > 0 ? -0.95 + blink * 0.9 : Math.PI + 0.95 - blink * 0.9;
            eyeG.rotation.y = Math.sin(t * 0.5) * 0.25;
            eyeG.rotation.x = Math.sin(t * 0.37) * 0.12;
        };
    },
    golem(c, L, rng, U) {
        const rock = creatureMat(L.body, U, { rough: 0.95, vein: 1.2, flat: true });
        const torso = M(blobGeo(0.75, 1, 0.25, L.seed, [1.2, 1, 0.9]), rock, 0, 1.6, 0);
        c.body.add(torso);
        const head = M(blobGeo(0.35, 1, 0.2, L.seed + 3), rock, 0, 2.5, 0.1);
        c.body.add(head);
        c.eyes = addEyes(c.body, Math.min(L.eyes, 2), U, L, { y: 2.52, z: 0.4, size: 0.07, spread: 0.2 });
        const arms = [];
        for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(s * 0.95, 2.0, 0);
            arm.add(M(blobGeo(0.3, 1, 0.2, L.seed + s * 5), rock, 0, -0.35, 0));
            arm.add(M(blobGeo(0.38, 1, 0.2, L.seed + s * 7), rock, 0, -0.95, 0.1));
            c.body.add(arm);
            arms.push(arm);
        }
        for (const s of [-1, 1]) c.body.add(M(blobGeo(0.32, 1, 0.2, L.seed + s * 11), rock, s * 0.4, 0.45, 0));
        addHorns(c.body, L.horns, c.mats.accent, { y: 2.7, spread: 0.25, len: 0.5 });
        c.height = 2.9;
        c.anim = (t) => {
            torso.rotation.y = Math.sin(t * 0.8) * 0.06;
            arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.1 + i * 3) * 0.12; });
            head.rotation.y = Math.sin(t * 0.6) * 0.2;
        };
    },
    construct(c, L, rng, U) {
        c.float = 0.9;
        const metal = creatureMat(L.accent, U, { rough: 0.3, metal: 0.9, vein: 0.4 });
        const core = M(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 8), metal, 0, 1.8, 0);
        c.body.add(core);
        c.body.add(M(new THREE.ConeGeometry(0.6, 0.6, 8), metal, 0, 2.6, 0));
        const lens = M(new THREE.SphereGeometry(0.22, 16, 12), c.mats.glow, 0, 1.85, 0.5);
        c.body.add(lens);
        const rings = [];
        for (let i = 0; i < 2; i++) {
            const r = M(new THREE.TorusGeometry(0.95 + i * 0.25, 0.05, 6, 40), creatureMat(0xffc040, U, { rough: 0.3, metal: 1, glow: true }), 0, 1.8, 0);
            r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4);
            c.body.add(r);
            rings.push(r);
        }
        const gears = [];
        for (const s of [-1, 1]) {
            const g = M(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), metal, s * 0.62, 1.8, 0);
            g.rotation.z = Math.PI / 2;
            c.body.add(g);
            gears.push(g);
            const arm = M(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), metal, s * 0.75, 1.3, 0.1);
            arm.rotation.z = s * 0.3;
            c.body.add(arm);
        }
        c.height = 2.9;
        c.anim = (t) => {
            rings[0].rotation.z = t * 0.8; rings[1].rotation.z = -t * 0.6;
            gears.forEach((g, i) => { g.rotation.x = t * (i ? 2 : -2); });
            lens.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
        };
    },
    jester(c, L, rng, U) {
        const cv = canvas(128, 128);
        const g2 = cv.getContext('2d');
        const cols = ['#' + L.accent.toString(16).padStart(6, '0'), '#' + L.body.toString(16).padStart(6, '0')];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g2.fillStyle = cols[(x + y) % 2]; g2.beginPath(); g2.moveTo(x * 16 + 8, y * 16); g2.lineTo(x * 16 + 16, y * 16 + 8); g2.lineTo(x * 16 + 8, y * 16 + 16); g2.lineTo(x * 16, y * 16 + 8); g2.fill(); }
        const motley = creatureMat(0xffffff, U, { rough: 0.6 });
        motley.map = colorTex(cv);
        const torso = M(new THREE.CylinderGeometry(0.35, 0.25, 1.0, 12), motley, 0, 1.55, 0);
        c.body.add(torso);
        for (const s of [-1, 1]) {
            c.body.add(M(new THREE.CylinderGeometry(0.08, 0.06, 1.0, 8), motley, s * 0.15, 0.55, 0));
            const arm = M(new THREE.CylinderGeometry(0.06, 0.05, 0.9, 8), motley, s * 0.45, 1.5, 0);
            arm.rotation.z = s * 0.5;
            c.body.add(arm);
        }
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; c.body.add(M(new THREE.SphereGeometry(0.1, 8, 6), creatureMat(0xffffff, U, {}), Math.cos(a) * 0.3, 2.07, Math.sin(a) * 0.3)); }
        const head = new THREE.Group();
        head.position.y = 2.4;
        const maskMat = new THREE.MeshStandardMaterial({ map: faceTexture(L.seed, 'mask'), roughness: 0.3 });
        const face = M(new THREE.SphereGeometry(0.3, 20, 16), maskMat);
        face.rotation.y = -Math.PI / 2;
        head.add(face);
        const hatCols = [L.accent, L.glow, L.body];
        const bellMat = creatureMat(0xffd040, U, { metal: 1, rough: 0.25, glow: true });
        for (let i = 0; i < 3; i++) {
            const h = M(bentCone(0.13, 0.75, (i - 1) * 0.9), creatureMat(hatCols[i], U, {}), (i - 1) * 0.12, 0.15, 0);
            h.rotation.z = (i - 1) * -0.7;
            head.add(h);
            const tip = new THREE.Vector3((i - 1) * 0.12 + (i - 1) * 0.9 * 0.75 * Math.cos((i - 1) * 0.7), 0.15 + 0.75, 0);
            head.add(M(new THREE.SphereGeometry(0.07, 8, 6), bellMat, tip.x * 0.9, tip.y * 0.95, 0));
        }
        c.body.add(head);
        c.height = 3.0;
        c.anim = (t) => {
            head.rotation.z = Math.sin(t * 1.7) * 0.2;
            torso.rotation.y = Math.sin(t * 1.1) * 0.2;
            c.body.position.y = Math.abs(Math.sin(t * 2.2)) * 0.12;
        };
    },
};

// ------------------------------------------------------------------ creature

export class Creature {
    constructor(look, { boss = false, hero = false } = {}) {
        this.look = look;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);
        const U = {
            uTime: { value: 0 }, uHit: { value: 0 }, uDissolve: { value: 0 },
            uGlow: { value: new THREE.Color(look.glow) }, uRim: { value: new THREE.Color(look.glow).multiplyScalar(boss ? 0.9 : 0.55) },
        };
        this.U = U;
        this.mats = {
            body: creatureMat(look.body, U, { rough: 0.55, vein: look.arch === 'golem' ? 0.9 : 0.16 }),
            belly: creatureMat(look.belly, U, { rough: 0.6 }),
            accent: creatureMat(look.accent, U, { rough: 0.35, metal: 0.4 }),
            glow: creatureMat(look.glow, U, { rough: 0.2, glow: true, emissive: look.glow, ei: 2.5 }),
        };
        const rng = makeRng(look.seed);
        this.float = 0;
        this.height = 2;
        this.anim = () => {};
        (PLANS[look.arch] ?? PLANS.blob)(this, look, rng, U);
        if (look.crown) this.crown = addCrown(this.body, U, this.height + 0.1, 0.32 * (boss ? 1.1 : 0.9), look.glow);
        if (look.wings && !this.wings) this.wings = addWings(this.body, look, U, rng, { y: this.height * 0.7, span: 1.4 });
        if (look.shards) this.shards = addShards(this.root, look.shards, U, look, this.height * 0.6, 1.1);
        if (!this.tendrils && look.tendrils > 1 && ['blob', 'golem', 'construct'].includes(look.arch)) this.tendrils = addTendrils(this.body, look.tendrils, this.mats.body, rng, { y: this.float ? 1.3 : 0.6, spread: 0.4, len: 0.8 });

        // blob shadow and target ring
        shadowTex = shadowTex ?? radialTex(128, 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0)', 0.2);
        ringTex = ringTex ?? ringTexture();
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        this.root.add(shadow);
        this.shadow = shadow;
        this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb040, opacity: 0 }));
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.04;
        this.root.add(this.ring);

        this.s = look.scale;
        this.root.scale.setScalar(this.s);
        this.t = Math.random() * 10;
        this.hitT = 0; this.lungeT = 0; this.dieT = -1; this.spawnT = -1; this.castT = 0;
        this.targeted = false;
        this.dead = false;
        this.base = new THREE.Vector3();
        this.lungeDir = 1;
    }

    setTargeted(on) { this.targeted = on; }
    hit(power = 1) { this.hitT = 0.28; this.hitPow = Math.min(2, power); }
    lunge(dir = 1) { this.lungeT = 0.5; this.lungeDir = dir; }
    cast() { this.castT = 0.8; }
    spawn() { this.spawnT = 0; this.U.uDissolve.value = 1; }
    die() { if (this.dieT < 0) this.dieT = 0; }
    get top() { return this.height * this.s + (this.float || 0) * this.s * 0.4; }

    update(dt) {
        this.t += dt;
        const t = this.t;
        this.U.uTime.value = t;
        this.anim(t);
        const bob = this.float ? Math.sin(t * 1.8) * 0.12 + this.float * 0.2 : 0;
        let lx = 0, lz = 0, ly = 0;
        if (this.lungeT > 0) {
            this.lungeT -= dt;
            const k = 1 - this.lungeT / 0.5;
            const e = k < 0.3 ? -Math.sin((k / 0.3) * Math.PI) * 0.15 : Math.sin(((k - 0.3) / 0.7) * Math.PI);
            lz = e * 1.4; lx = -e * 0.5 * this.lungeDir; ly = Math.max(0, e) * 0.2;
        }
        let shake = 0;
        if (this.hitT > 0) {
            this.hitT -= dt;
            shake = Math.sin(this.hitT * 90) * 0.08 * this.hitPow * (this.hitT / 0.28);
            this.U.uHit.value = Math.max(0, this.hitT / 0.28) * 0.9;
        } else this.U.uHit.value = 0;
        if (this.castT > 0) this.castT -= dt;
        this.body.position.set(lx + shake, bob + ly, lz - (this.hitT > 0 ? 0.15 * (this.hitT / 0.28) : 0));
        if (this.wings && !this.wingsAnimated) {
            const f = Math.sin(t * 5);
            for (const w of this.wings) { w.pivot.rotation.y = w.s * (0.3 + f * 0.4); }
        }
        if (this.tendrils) for (const td of this.tendrils) td.chain.forEach((j, k) => { j.rotation.z = Math.sin(t * 1.6 + td.ph + k * 0.6) * 0.18; j.rotation.x = Math.cos(t * 1.2 + td.ph + k * 0.5) * 0.12; });
        if (this.shards) this.shards.children.forEach((s) => { const a = s.userData.a + t * 0.8; s.position.set(Math.cos(a) * s.userData.r, Math.sin(a * 2) * 0.2, Math.sin(a) * s.userData.r); s.rotation.y = t * 2; });
        if (this.crown) this.crown.rotation.y = Math.sin(t * 0.4) * 0.1;
        const rm = this.ring.material;
        rm.opacity += ((this.targeted && !this.dead ? 0.8 + 0.2 * Math.sin(t * 5) : 0) - rm.opacity) * Math.min(1, dt * 10);
        this.ring.rotation.z = t * 0.5;
        if (this.spawnT >= 0) {
            this.spawnT += dt;
            this.U.uDissolve.value = Math.max(0, 1 - this.spawnT / 0.8);
            if (this.spawnT > 0.8) { this.spawnT = -1; this.U.uDissolve.value = 0; }
        }
        if (this.dieT >= 0) {
            this.dieT += dt;
            this.U.uDissolve.value = Math.min(1.05, this.dieT / 1.1);
            this.shadow.material.opacity = Math.max(0, 1 - this.dieT);
            if (this.dieT > 1.2) this.dead = true;
        }
    }

    dispose() {
        this.root.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) { if (o.material.map && o.material.map !== shadowTex && o.material.map !== ringTex) o.material.map.dispose(); o.material.dispose(); }
        });
    }
}

// ------------------------------------------------------------------ hero

export class Hero {
    constructor(look) {
        this.look = look;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);
        const U = { uTime: { value: 0 }, uHit: { value: 0 }, uDissolve: { value: 0 }, uGlow: { value: new THREE.Color(look.glow) }, uRim: { value: new THREE.Color(look.glow).multiplyScalar(0.45) } };
        this.U = U;
        const cls = look.cls;
        const cloak = creatureMat(look.cloak, U, { rough: 0.85 });
        const cloak2 = creatureMat(look.cloak, U, { rough: 0.85, side: THREE.DoubleSide });
        const trim = creatureMat(look.trim, U, { rough: 0.4, metal: 0.6 });
        const skin = creatureMat(look.skin, U, { rough: 0.6 });
        const metal = creatureMat(look.metal, U, { rough: 0.25, metal: 0.95 });
        const leather = creatureMat(0x3a2418, U, { rough: 0.7 });
        const glowM = creatureMat(look.glow, U, { glow: true, emissive: look.glow, ei: 3 });
        const B = this.body;
        const add = (m) => { B.add(m); return m; };
        // legs and boots
        for (const sx of [-1, 1]) {
            add(M(new THREE.CylinderGeometry(0.085, 0.07, 0.8, 10), cls === 'knight' ? metal : leather, sx * 0.13, 0.7, 0));
            add(M(new THREE.CylinderGeometry(0.1, 0.11, 0.34, 10), leather, sx * 0.13, 0.17, 0.02));
            add(M(new THREE.BoxGeometry(0.16, 0.08, 0.26), leather, sx * 0.13, 0.04, 0.06));
        }
        // skirt / robe
        const hem = cls === 'witch' ? 0.03 : cls === 'knight' ? 0.55 : 0.62;
        const flare = cls === 'witch' ? 0.62 : 0.4;
        const pts = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.27 + Math.pow(t, 1.3) * (flare - 0.27), 1.12 - t * (1.12 - hem))); }
        add(M(new THREE.LatheGeometry(pts, 24), cloak2));
        // torso, belt, buckle
        add(M(new THREE.CylinderGeometry(0.31, 0.25, 0.78, 14), cls === 'knight' ? metal : cls === 'rogue' ? leather : cloak, 0, 1.5, 0));
        const belt = add(M(new THREE.TorusGeometry(0.265, 0.04, 8, 24), leather, 0, 1.12, 0));
        belt.rotation.x = Math.PI / 2;
        add(M(new THREE.BoxGeometry(0.1, 0.08, 0.04), trim, 0, 1.12, 0.27));
        if (cls !== 'knight') {
            const sash = add(M(new THREE.TorusGeometry(0.3, 0.035, 6, 24, Math.PI), trim, 0, 1.52, 0));
            sash.rotation.set(0, 0, 0.9);
        }
        // shoulders
        for (const sx of [-1, 1]) {
            if (cls === 'knight') add(M(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal, sx * 0.36, 1.84, 0));
            else { const m2 = add(M(new THREE.SphereGeometry(0.17, 12, 8), cloak, sx * 0.3, 1.82, 0)); m2.scale.set(1.2, 0.7, 1); }
        }
        if (cls !== 'knight') { const collar = add(M(new THREE.CylinderGeometry(0.2, 0.36, 0.2, 16, 1, true), cloak2, 0, 1.9, 0)); void collar; }
        // arms: shoulder → elbow → hand
        const mkArm = (sx) => {
            const sh = new THREE.Group();
            sh.position.set(sx * 0.38, 1.8, 0);
            sh.add(M(new THREE.CylinderGeometry(0.07, 0.065, 0.42, 8), cls === 'knight' ? metal : cloak, 0, -0.21, 0));
            const el = new THREE.Group();
            el.position.y = -0.42;
            el.add(M(new THREE.CylinderGeometry(0.062, 0.055, 0.38, 8), cls === 'knight' ? metal : leather, 0, -0.19, 0));
            el.add(M(new THREE.SphereGeometry(0.06, 10, 8), skin, 0, -0.4, 0.01));
            sh.add(el);
            B.add(sh);
            return { sh, el };
        };
        this.armL = mkArm(-1);
        const R2 = mkArm(1);
        this.arm = R2.sh;
        this.elbow = R2.el;
        this.armL.sh.rotation.z = -0.12;
        // neck & head
        add(M(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), skin, 0, 1.94, 0));
        const head = new THREE.Group();
        head.position.y = 2.14;
        head.add(M(new THREE.SphereGeometry(0.19, 18, 14), skin));
        for (const sx of [-1, 1]) head.add(M(new THREE.SphereGeometry(0.028, 8, 6), glowM, sx * 0.07, 0.02, 0.17));
        if (look.hood === 'helm') {
            head.add(M(new THREE.SphereGeometry(0.23, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), metal, 0, 0.02, 0));
            const guard = M(new THREE.CylinderGeometry(0.23, 0.22, 0.18, 18, 1, true, Math.PI * 0.62, Math.PI * 1.76), metal, 0, -0.06, 0);
            head.add(guard);
            const plume = M(bentCone(0.05, 0.5, -0.8), trim, 0, 0.2, -0.02);
            plume.rotation.x = -0.3;
            head.add(plume);
        } else if (look.hood === 'hat') {
            head.add(M(new THREE.CylinderGeometry(0.46, 0.46, 0.025, 28), cloak, 0, 0.12, 0));
            head.add(M(bentCone(0.2, 0.75, -0.35, 14), cloak, 0, 0.12, 0));
            const band = M(new THREE.TorusGeometry(0.2, 0.025, 6, 20), trim, 0, 0.16, 0);
            band.rotation.x = Math.PI / 2;
            head.add(band);
            const hair = M(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5), creatureMat(0x2a1a14, U, { rough: 0.9, side: THREE.DoubleSide }), 0, -0.02, -0.04);
            head.add(hair);
        } else {
            const hood = M(new THREE.SphereGeometry(0.25, 18, 12, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.72), cloak2, 0, 0.02, -0.02);
            hood.rotation.x = -0.15;
            head.add(hood);
            const mask = M(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 14, 1, true, Math.PI * 1.35, Math.PI * 1.3), leather, 0, -0.08, 0.02);
            head.add(mask);
        }
        B.add(head);
        this.head = head;
        // weapon in the right hand
        const weapon = new THREE.Group();
        weapon.position.set(0, -0.4, 0.04);
        this.elbow.add(weapon);
        if (cls === 'witch') {
            weapon.add(M(new THREE.CylinderGeometry(0.025, 0.035, 1.9, 8), creatureMat(0x4a2a14, U, { rough: 0.8 }), 0, 0.35, 0));
            const cage = M(new THREE.TorusGeometry(0.13, 0.015, 6, 16), trim, 0, 1.33, 0);
            weapon.add(cage);
            this.orb = M(new THREE.SphereGeometry(0.1, 16, 12), glowM, 0, 1.35, 0);
            weapon.add(this.orb);
        } else if (cls === 'knight') {
            weapon.add(M(new THREE.BoxGeometry(0.075, 1.15, 0.018), creatureMat(0xe0e8f8, U, { rough: 0.15, metal: 1 }), 0, 0.62, 0));
            weapon.add(M(new THREE.BoxGeometry(0.32, 0.05, 0.07), trim, 0, 0.05, 0));
            weapon.add(M(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), leather, 0, -0.07, 0));
            const shield = M(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 6), trim, -0.02, -0.3, 0.12);
            shield.rotation.x = Math.PI / 2;
            this.armL.el.add(shield);
            shield.add(M(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 6), metal, 0, 0.01, 0));
        } else {
            for (const w of [weapon, (() => { const g = new THREE.Group(); g.position.set(0, -0.4, 0.04); this.armL.el.add(g); return g; })()]) {
                const d = M(new THREE.ConeGeometry(0.035, 0.45, 4), metal, 0, 0.26, 0);
                w.add(d);
                w.add(M(new THREE.BoxGeometry(0.14, 0.03, 0.04), trim, 0, 0.03, 0));
            }
        }
        if (look.cape) {
            const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.55, 5, 8), creatureMat(look.trim, U, { side: THREE.DoubleSide, rough: 0.9 }));
            cape.position.set(0, 1.12, -0.3);
            B.add(cape);
            this.cape = cape;
            this.capeBase = cape.geometry.attributes.position.array.slice();
        }
        shadowTex = shadowTex ?? radialTex(128, 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0)', 0.2);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        this.root.add(shadow);
        this.root.traverse((o) => { if (o.isMesh && o !== shadow) o.castShadow = true; });
        this.t = 0; this.castT = 0; this.hitT = 0;
        this.height = 2.5;
    }
    cast() { this.castT = 0.7; }
    hit() { this.hitT = 0.3; }
    update(dt) {
        this.t += dt;
        const t = this.t;
        this.U.uTime.value = t;
        this.body.position.y = Math.sin(t * 1.8) * 0.015;
        this.head.rotation.y = Math.sin(t * 0.7) * 0.15;
        let shoulder = -0.35 + Math.sin(t * 1.5) * 0.05, elbow = -0.5;
        if (this.castT > 0) {
            this.castT -= dt;
            const k = Math.sin((1 - this.castT / 0.7) * Math.PI);
            shoulder = -0.35 - k * 1.8;
            elbow = -0.5 + k * 0.4;
        }
        this.arm.rotation.x = shoulder;
        this.elbow.rotation.x = elbow;
        this.armL.sh.rotation.x = -0.2 + Math.sin(t * 1.5 + 1) * 0.04;
        this.armL.el.rotation.x = -0.6;
        if (this.orb) this.orb.scale.setScalar(1 + Math.sin(t * 4) * 0.12 + (this.castT > 0 ? 0.7 : 0));
        if (this.hitT > 0) { this.hitT -= dt; this.U.uHit.value = this.hitT / 0.3; this.body.position.x = Math.sin(this.hitT * 80) * 0.05; } else this.U.uHit.value = 0;
        if (this.cape) {
            const p = this.cape.geometry.attributes.position, b = this.capeBase;
            for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1]; p.setZ(i, Math.sin(t * 2.2 + y * 3 + b[i * 3] * 2) * 0.07 * (0.78 - y) - (0.78 - y) * 0.12); }
            p.needsUpdate = true;
        }
    }
    dispose() { this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
