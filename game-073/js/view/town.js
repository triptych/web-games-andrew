// Emberwick: the sky, the hills, and the six buildings along the street above the dig.
// Everything stands behind the play plane (z < -0.5) so it never hides the rock or Thimble.

import * as THREE from 'three';
import { W, BUILDINGS } from '../config.js';
import { wallCanvas, signCanvas, glowCanvas } from './textures.js';
import { makeRng } from '../rng.js';

function canvasTex(cv, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
}

/** A gabled roof: a triangular prism, ridge along x. */
function prism(w, h, d) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    return g;
}

const SKY_VERT = /* glsl */`
varying vec3 vP;
void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */`
uniform float uTime;
uniform float uGlow;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;
varying vec3 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    float h = clamp((vP.y + 20.0) / 120.0, 0.0, 1.0);
    vec3 col = mix(uLow, uMid, smoothstep(0.0, 0.35, h));
    col = mix(col, uTop, smoothstep(0.3, 1.0, h));
    // the sun, low over the hills
    vec2 sp = vec2(-60.0, 18.0);
    float sd = length(vP.xy - sp);
    col += vec3(1.0, 0.75, 0.4) * (exp(-sd * 0.08) * 0.6 + smoothstep(7.0, 5.5, sd) * 0.8);
    // stars high up
    vec2 g = floor(vP.xy * 0.6);
    float st = step(0.996, hash(g)) * smoothstep(0.55, 1.0, h);
    col += vec3(st) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(g) * 30.0));
    // the Spire's beam lights the sky above it
    float beam = exp(-abs(vP.x - 18.0) * 0.25) * smoothstep(-5.0, 60.0, vP.y) * uGlow;
    col += vec3(1.0, 0.9, 0.6) * beam * 0.35;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}`;

function mountainCanvas(seed, col, top) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    const ctx = cv.getContext('2d');
    const rng = makeRng(seed);
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 256);
    let y = 256 - top * (0.5 + rng() * 0.5);
    for (let x = 0; x <= 1024; x += 16) {
        y += (rng() - 0.5) * 40;
        y = Math.max(256 - top, Math.min(220, y));
        ctx.lineTo(x, y);
    }
    ctx.lineTo(1024, 256); ctx.closePath(); ctx.fill();
    // snowcaps on the far range
    if (seed === 1) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, 0, 1024, 256 - top * 0.72);
        ctx.globalCompositeOperation = 'source-over';
    }
    // tree line on the near range
    if (seed === 3) {
        for (let x = 0; x < 1024; x += 9) {
            const h = 14 + rng() * 18;
            ctx.fillStyle = 'rgba(20,40,25,0.9)';
            ctx.beginPath(); ctx.moveTo(x, 256 - 70 + rng() * 30); ctx.lineTo(x + 6, 256 - 70 - h + rng() * 30); ctx.lineTo(x + 12, 256 - 70 + rng() * 30); ctx.fill();
        }
    }
    return cv;
}

function cloudCanvas() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');
    const rng = makeRng(5);
    for (let i = 0; i < 14; i++) {
        const x = 40 + rng() * 176, y = 50 + rng() * 40, r = 18 + rng() * 26;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,240,225,0.9)'); g.addColorStop(1, 'rgba(255,220,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    return cv;
}

export class Town {
    constructor(scene) {
        const group = new THREE.Group();
        this.group = group;
        scene.add(group);
        const rng = makeRng(2026);
        this.smoke = [];
        this.markers = {};
        this.npcs = [];

        // --- Sky ---
        this.skyU = {
            uTime: { value: 0 }, uGlow: { value: 0.2 },
            uTop: { value: new THREE.Color(0x1c2a5a) }, uMid: { value: new THREE.Color(0x6a7ab0) }, uLow: { value: new THREE.Color(0xf0b880) },
        };
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(600, 240), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyU, depthWrite: false }));
        sky.position.set(W / 2, 80, -90);
        sky.renderOrder = -10;
        group.add(sky);
        this.sky = sky;

        // --- Hills, far to near ---
        const layers = [
            { z: -80, y: -2, w: 420, h: 60, col: '#8a8ab8', top: 220, seed: 1 },
            { z: -55, y: -3, w: 300, h: 34, col: '#5a6a78', top: 170, seed: 2 },
            { z: -30, y: -2, w: 200, h: 16, col: '#3a5838', top: 150, seed: 3 },
        ];
        for (const L of layers) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ map: canvasTex(mountainCanvas(L.seed, L.col, L.top)), transparent: true, depthWrite: false, fog: false }));
            m.position.set(W / 2, L.y + L.h / 2, L.z);
            m.renderOrder = -9;
            group.add(m);
        }
        // clouds
        const cloudTex = canvasTex(cloudCanvas());
        this.clouds = [];
        for (let i = 0; i < 9; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false }));
            s.scale.set(26 + rng() * 20, 12 + rng() * 6, 1);
            s.position.set(-60 + rng() * 160, 18 + rng() * 26, -70 + rng() * 10);
            s.renderOrder = -8;
            group.add(s);
            this.clouds.push(s);
        }

        // --- Ground behind the play plane ---
        const grassTex = canvasTex(wallCanvas('grass'), 30, 4);
        const ground = new THREE.Mesh(new THREE.BoxGeometry(160, 1, 24), [
            new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
            new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
            new THREE.MeshStandardMaterial({ color: 0x4a3420 }), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
        ]);
        ground.position.set(W / 2, -0.5, -0.5 - 12);
        group.add(ground);
        // a cobbled street right behind the dig
        const cob = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('cobble'), 18, 1.2), roughness: 1 }));
        cob.rotation.x = -Math.PI / 2;
        cob.position.set(W / 2, 0.01, -1.7);
        group.add(cob);

        // --- Materials ---
        const M = {
            plaster: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('plaster'), 1, 1), roughness: 0.95 }),
            stone: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('stone'), 1, 1), roughness: 0.95 }),
            shingle: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('shingle'), 0.5, 0.5), roughness: 0.9 }),
            slate: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('slate'), 0.5, 0.5), roughness: 0.9 }),
            thatch: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('thatch'), 0.5, 0.5), roughness: 1 }),
            wood: new THREE.MeshStandardMaterial({ map: canvasTex(wallCanvas('wood'), 1, 1), roughness: 0.9 }),
            iron: new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.5 }),
            window: new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffb050, emissiveIntensity: 1.2 }),
            door: new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.8 }),
            aether: new THREE.MeshStandardMaterial({ color: 0x80f0ff, emissive: 0x40d0ff, emissiveIntensity: 1.8 }),
            fire: new THREE.MeshStandardMaterial({ color: 0x802000, emissive: 0xff5010, emissiveIntensity: 1.1 }),
            purple: new THREE.MeshStandardMaterial({ color: 0xd0a0ff, emissive: 0xa050ff, emissiveIntensity: 1.4 }),
            banner: new THREE.MeshStandardMaterial({ color: 0xa02828, roughness: 0.9, side: THREE.DoubleSide }),
            leaf: new THREE.MeshStandardMaterial({ color: 0x2f6a30, roughness: 1 }),
            bark: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1 }),
        };
        this.M = M;
        const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
        const windowAt = (x, y, z, w = 0.5, h = 0.6) => {
            add(new THREE.BoxGeometry(w, h, 0.06), M.window, x, y, z);
            add(new THREE.BoxGeometry(w + 0.12, 0.08, 0.1), M.door, x, y - h / 2 - 0.04, z + 0.02);
        };
        const sign = (b, icon, z) => {
            const mat = new THREE.MeshStandardMaterial({ map: canvasTex(signCanvas(b.name, icon)), roughness: 0.8, emissive: 0x302010, emissiveIntensity: 0.6 });
            const s = add(new THREE.PlaneGeometry(3.2, 0.8), mat, (b.x0 + b.x1) / 2, 0, z);
            return s;
        };
        const B = Object.fromEntries(BUILDINGS.map((b) => [b.key, b]));
        const cx = (k) => (B[k].x0 + B[k].x1) / 2;

        // 1. The Aether Well
        {
            const x = cx('well'), z = -2.6;
            add(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 18), M.stone, x, 0.45, z);
            const pool = add(new THREE.CircleGeometry(0.95, 20), M.aether, x, 0.91, z);
            pool.rotation.x = -Math.PI / 2;
            this.pool = pool;
            for (const dx of [-1.0, 1.0]) add(new THREE.BoxGeometry(0.16, 2.6, 0.16), M.wood, x + dx, 1.3, z);
            add(new THREE.BoxGeometry(2.4, 0.18, 0.2), M.wood, x, 2.6, z);
            const roof = add(prism(2.8, 0.9, 1.8), M.shingle, x, 2.7, z);
            roof.castShadow = false;
            add(new THREE.CylinderGeometry(0.04, 0.04, 1.6), M.iron, x, 1.8, z);
            add(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 12), M.iron, x + 1.8, 0.6, z + 0.6).rotation.z = 0;
            const gauge = add(new THREE.CircleGeometry(0.16, 12), M.aether, x + 1.8, 0.8, z + 0.92);
            gauge.rotation.y = 0;
            const sgn = sign(B.well, '⚗', z + 1.25); sgn.position.y = 3.65; sgn.scale.setScalar(0.8);
            this.wellLight = new THREE.PointLight(0x60e0ff, 2.5, 6, 1.5);
            this.wellLight.position.set(x, 1.6, z + 0.6);
            group.add(this.wellLight);
        }
        // 2. Sedge's Assay House
        {
            const x = cx('assay'), z = -3.2;
            add(new THREE.BoxGeometry(3.8, 2.6, 2.6), M.plaster, x, 1.3, z);
            add(prism(4.2, 1.6, 3.0), M.shingle, x, 2.6, z);
            add(new THREE.BoxGeometry(0.9, 1.5, 0.1), M.door, x - 0.6, 0.75, z + 1.31);
            windowAt(x + 0.9, 1.4, z + 1.31);
            windowAt(x + 0.4, 3.2, z + 0.75, 0.4, 0.4);
            // the scales
            const sx = x + 1.2, sy = 3.6;
            add(new THREE.CylinderGeometry(0.03, 0.03, 0.8), M.iron, sx, sy, z + 1.4);
            add(new THREE.BoxGeometry(0.9, 0.04, 0.04), M.iron, sx, sy + 0.38, z + 1.4);
            for (const d of [-0.42, 0.42]) add(new THREE.CylinderGeometry(0.14, 0.1, 0.06, 10), M.window, sx + d, sy + 0.12, z + 1.4);
            const sg = sign(B.assay, '⚖', z + 1.4); sg.position.y = 2.25; sg.scale.setScalar(0.85);
        }
        // 3. Fennick's Forge
        {
            const x = cx('forge'), z = -3.2;
            add(new THREE.BoxGeometry(4.0, 2.4, 2.6), M.stone, x, 1.2, z);
            add(prism(4.4, 1.3, 3.0), M.slate, x, 2.4, z);
            const glow = add(new THREE.BoxGeometry(1.6, 1.2, 0.1), M.fire, x - 0.6, 0.7, z + 1.29);
            this.forgeGlow = glow;
            add(new THREE.BoxGeometry(1.9, 0.12, 0.2), M.iron, x - 0.6, 1.36, z + 1.33);
            // anvil
            add(new THREE.BoxGeometry(0.5, 0.25, 0.25), M.iron, x + 1.2, 0.55, z + 1.7);
            add(new THREE.BoxGeometry(0.25, 0.4, 0.2), M.iron, x + 1.2, 0.22, z + 1.7);
            // chimney
            add(new THREE.BoxGeometry(0.6, 2.0, 0.6), M.stone, x + 1.3, 3.2, z - 0.3);
            this.smoke.push({ pos: new THREE.Vector3(x + 1.3, 4.3, z - 0.3), rate: 3, col: [0.35, 0.33, 0.32] });
            this.forgeLight = new THREE.PointLight(0xff7020, 3, 6, 1.5);
            this.forgeLight.position.set(x - 0.6, 1.0, z + 2.0);
            group.add(this.forgeLight);
            const sg = sign(B.forge, '⚒', z + 1.4); sg.position.y = 2.0; sg.position.x += 0.8; sg.scale.setScalar(0.8);
        }
        // 4. The Lumen Spire
        {
            const x = cx('spire'), z = -4.0;
            add(new THREE.CylinderGeometry(1.0, 1.5, 9, 10), M.stone, x, 4.5, z);
            add(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 10), M.stone, x, 9.1, z);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                add(new THREE.BoxGeometry(0.16, 1.4, 0.16), M.stone, x + Math.cos(a) * 1.05, 9.9, z + Math.sin(a) * 1.05);
            }
            add(new THREE.ConeGeometry(1.4, 1.6, 10), M.slate, x, 11.4, z);
            this.crystalMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd070, emissiveIntensity: 1.5, roughness: 0.1 });
            this.crystal = add(new THREE.OctahedronGeometry(0.55, 0), this.crystalMat, x, 9.95, z);
            this.crystal.scale.y = 1.5;
            const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas(128)), color: 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            halo.position.set(x, 9.95, z + 0.5);
            halo.scale.setScalar(5);
            group.add(halo);
            this.halo = halo;
            this.spireLight = new THREE.PointLight(0xffd890, 4, 18, 1.3);
            this.spireLight.position.set(x, 9.5, z + 2);
            group.add(this.spireLight);
            add(new THREE.BoxGeometry(1.0, 1.6, 0.1), M.door, x, 0.8, z + 1.38);
            windowAt(x, 4.2, z + 1.25, 0.4, 0.8);
            windowAt(x, 6.6, z + 1.12, 0.35, 0.7);
            // the waystone at the Spire's foot
            const ws = add(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 6), M.stone, x + 1.6, 0.6, z + 2.1);
            const rune = add(new THREE.BoxGeometry(0.1, 0.5, 0.02), M.aether, x + 1.6, 0.75, z + 2.48);
            void ws; void rune;
        }
        // 5. The Delvers' Guild + the shaft headframe
        {
            const x = cx('guild'), z = -3.6;
            add(new THREE.BoxGeometry(5.2, 1.6, 3.0), M.stone, x, 0.8, z);
            add(new THREE.BoxGeometry(5.2, 1.6, 3.0), M.plaster, x, 2.4, z);
            add(prism(5.6, 1.8, 3.4), M.slate, x, 3.2, z);
            add(new THREE.BoxGeometry(1.2, 1.9, 0.1), M.door, x, 0.95, z + 1.51);
            for (const dx of [-1.6, 1.6]) { windowAt(x + dx, 1.0, z + 1.51); windowAt(x + dx, 2.5, z + 1.51); }
            windowAt(x, 2.6, z + 1.51, 0.7, 0.7);
            for (const dx of [-0.9, 0.9]) {
                const ban = add(new THREE.PlaneGeometry(0.5, 1.3), M.banner, x + dx, 2.2, z + 1.56);
                this.npcs.push({ banner: ban, phase: dx });
                // a pick crossed with a lamp: the guild's mark
                const mk = add(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd060 }), x + dx, 2.3, z + 1.57);
                mk.rotation.z = Math.PI / 4;
            }
            const sg = sign(B.guild, '⛏', z + 1.6); sg.position.y = 3.35; sg.scale.setScalar(0.9);
            // headframe over the Guild shaft
            const hx = x + 3.1, hz = z + 0.6;
            for (const dx of [-0.5, 0.5]) { const leg = add(new THREE.BoxGeometry(0.14, 4.4, 0.14), M.wood, hx + dx, 2.2, hz); leg.rotation.z = -dx * 0.12; }
            add(new THREE.BoxGeometry(1.4, 0.14, 0.14), M.wood, hx, 4.2, hz);
            add(new THREE.BoxGeometry(1.2, 0.12, 0.14), M.wood, hx, 2.2, hz);
            this.wheel = new THREE.Group();
            this.wheel.position.set(hx, 4.45, hz);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), M.iron);
            this.wheel.add(rim);
            for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), M.iron); sp.rotation.z = (i / 4) * Math.PI; this.wheel.add(sp); }
            group.add(this.wheel);
        }
        // 6. Runes & Remedies
        {
            const x = cx('runes'), z = -3.0;
            const hut = add(new THREE.BoxGeometry(3.2, 2.3, 2.4), M.wood, x, 1.15, z);
            hut.rotation.z = 0.03;
            const roof = add(new THREE.ConeGeometry(2.6, 2.4, 6), M.thatch, x + 0.2, 3.3, z);
            roof.rotation.z = -0.12;
            add(new THREE.BoxGeometry(0.8, 1.4, 0.1), M.door, x + 0.7, 0.7, z + 1.21);
            const w1 = add(new THREE.BoxGeometry(0.6, 0.6, 0.06), M.purple, x - 0.7, 1.3, z + 1.22);
            w1.rotation.z = 0.1;
            // cauldron
            add(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, x - 1.5, 0.42, z + 1.7);
            const brew = add(new THREE.CircleGeometry(0.36, 14), new THREE.MeshStandardMaterial({ color: 0x80ff80, emissive: 0x40c040, emissiveIntensity: 1.5 }), x - 1.5, 0.42, z + 1.7);
            brew.rotation.x = -Math.PI / 2;
            this.smoke.push({ pos: new THREE.Vector3(x - 1.5, 0.55, z + 1.7), rate: 2, col: [0.45, 0.9, 0.45] });
            // herbs hanging from the eaves
            for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.08, 0.35, 5), M.leaf, x - 1.2 + i * 0.35, 2.05, z + 1.3).rotation.x = Math.PI;
            const sg = sign(B.runes, '✸', z + 1.3); sg.position.y = 2.7; sg.scale.setScalar(0.75);
            this.hutLight = new THREE.PointLight(0xb070ff, 1.8, 5, 1.5);
            this.hutLight.position.set(x - 0.7, 1.3, z + 2);
            group.add(this.hutLight);
        }
        // Maren's shed, just past the town, door ajar
        {
            const x = 33.8, z = -2.6;
            add(new THREE.BoxGeometry(2.0, 1.6, 1.8), M.wood, x, 0.8, z);
            add(prism(2.3, 0.8, 2.1), M.shingle, x, 1.6, z);
            const door = add(new THREE.BoxGeometry(0.7, 1.2, 0.06), M.door, x - 0.2, 0.6, z + 0.95);
            door.rotation.y = -0.6; door.position.x -= 0.15; door.position.z += 0.15;
            add(new THREE.BoxGeometry(0.6, 1.1, 0.04), new THREE.MeshBasicMaterial({ color: 0x0a0806 }), x - 0.2, 0.58, z + 0.91);
        }
        // trees and lamps
        const tree = (x, z, s) => {
            add(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.4 * s, 6), M.bark, x, 0.7 * s, z);
            for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry((1.1 - i * 0.25) * s, 1.3 * s, 7), M.leaf, x, (1.4 + i * 0.7) * s, z);
        };
        for (const [x, z, s] of [[-2.5, -3, 1.3], [-5, -5, 1.6], [-1, -6, 1.1], [37.5, -3.5, 1.4], [40, -5.5, 1.7], [36.6, -6, 1.1], [-8, -4, 1.4], [43, -4, 1.3], [10.5, -6.5, 1.2], [26.7, -6.8, 1.3]]) tree(x, z, s);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc060, emissiveIntensity: 2 });
        for (const x of [5.5, 10.5, 15.5, 20.7, 26.5, 31.5]) {
            add(new THREE.CylinderGeometry(0.05, 0.06, 2.2), M.iron, x, 1.1, -1.0);
            add(new THREE.BoxGeometry(0.22, 0.28, 0.22), lampMat, x, 2.3, -1.0);
        }

        // --- Townsfolk outside their doors ---
        const folk = [
            ['well', 0.0, 0x4a7aa0, 0xe0b090, 1.0],
            ['assay', -1.4, 0x3a3a6a, 0xe8d2b8, 1.15],
            ['forge', 1.7, 0x3a6a4a, 0xf0c09a, 0.7],
            ['spire', -1.3, 0x8a6a30, 0xd8b090, 1.0],
            ['guild', -2.1, 0x7a3020, 0xe0a882, 0.8],
            ['runes', 1.6, 0x4a2a5a, 0xc89070, 0.95],
        ];
        for (const [key, dx, cloth, skin, h] of folk) {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * (h < 0.85 ? 1.25 : 1), 0.24, 0.8 * h, 8), new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 }));
            body.position.y = 0.4 * h;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
            head.position.y = 0.8 * h + 0.14;
            g.add(body, head);
            if (key === 'runes') { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x2a1a3a })); hat.position.y = head.position.y + 0.25; g.add(hat); }
            if (key === 'guild') { for (const sx of [-1, 1]) { const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0xb8482a })); braid.position.set(sx * 0.14, head.position.y - 0.16, 0.03); g.add(braid); } }
            if (key === 'forge') { const gog = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), new THREE.MeshStandardMaterial({ color: 0xc89a40 })); gog.position.set(0, head.position.y + 0.05, 0.13); g.add(gog); }
            g.position.set(cx(key) + dx, 0, -1.25);
            group.add(g);
            this.npcs.push({ g, phase: rng() * 6, key });
        }

        // --- "Someone wants a word" markers ---
        const markTex = canvasTex(markerCanvas());
        for (const b of BUILDINGS) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthWrite: false, depthTest: false }));
            s.scale.set(0.9, 0.9, 1);
            s.position.set((b.x0 + b.x1) / 2, 4.5, -0.6);
            s.renderOrder = 5;
            s.visible = false;
            group.add(s);
            this.markers[b.key] = s;
        }
        this.sun = new THREE.DirectionalLight(0xffe0c0, 2.2);
        this.sun.position.set(-20, 30, 25);
        scene.add(this.sun);
        this.hemi = new THREE.HemisphereLight(0xa0b8e0, 0x4a3a28, 1.0);
        scene.add(this.hemi);
    }

    /** k: 0 underground (lights off) … 1 at the surface. spire: 0..1 how bright the Spire burns. */
    update(dt, time, k, spire, business) {
        this.group.visible = k > 0.001;
        this.sun.intensity = 2.2 * k;
        this.hemi.intensity = 0.15 + 0.85 * k;
        this.skyU.uTime.value = time;
        this.skyU.uGlow.value = spire;
        if (!this.group.visible) return;
        for (const c of this.clouds) { c.position.x += dt * 0.6; if (c.position.x > 110) c.position.x = -70; }
        if (this.wheel) this.wheel.rotation.z += dt * 0.6;
        const flicker = 0.85 + Math.sin(time * 17) * 0.08 + Math.sin(time * 5.3) * 0.07;
        this.forgeLight.intensity = 3 * flicker;
        this.M.fire.emissiveIntensity = 1.1 * flicker;
        this.M.aether.emissiveIntensity = 1.5 + Math.sin(time * 2) * 0.4;
        this.crystalMat.emissiveIntensity = 0.6 + spire * 2.6 + Math.sin(time * 1.3) * 0.15 * (1 - spire);
        this.halo.scale.setScalar(3 + spire * 6 + Math.sin(time * 1.7) * 0.4);
        this.halo.material.opacity = 0.35 + spire * 0.65;
        this.spireLight.intensity = 2 + spire * 8;
        this.crystal.rotation.y += dt * 0.5;
        for (const n of this.npcs) {
            if (n.g) { n.g.position.y = Math.abs(Math.sin(time * 1.2 + n.phase)) * 0.03; n.g.rotation.y = Math.sin(time * 0.4 + n.phase) * 0.4; }
            if (n.banner) n.banner.rotation.y = Math.sin(time * 1.5 + n.phase) * 0.2;
        }
        for (const key in this.markers) {
            const m = this.markers[key];
            m.visible = !!business[key];
            if (m.visible) m.position.y = 4.5 + Math.sin(time * 3) * 0.15;
        }
    }
}

function markerCanvas() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffd040'; ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(32, 32, 26, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2000'; ctx.font = 'bold 40px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', 32, 34);
    return cv;
}
