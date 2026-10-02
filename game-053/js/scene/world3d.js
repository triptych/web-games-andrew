// The world layer: a low-poly diorama of Hollowmere and its surroundings,
// a sky that follows the game clock, and camera views for every page.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../rng.js';
import * as T from './textures.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ views
// pos, target, optional foe spot and fog override
export const VIEWS = {
    title: { pos: V3(34, 24, 46), tgt: V3(0, 2, -8) },
    village: { pos: V3(0, 7, 18), tgt: V3(0, 1.6, -2) },
    inn: { pos: V3(-2, 3.4, -0.5), tgt: V3(-8.5, 3, -8.5) },
    weapons: { pos: V3(6.5, 2.8, -1.2), tgt: V3(9.5, 1.4, -7) },
    armor: { pos: V3(12.5, 2.8, -0.5), tgt: V3(15.5, 1.8, -6.5) },
    bank: { pos: V3(-4, 3, 9.5), tgt: V3(-10.5, 2.4, 4.5) },
    training: { pos: V3(8.2, 3.2, 15.8), tgt: V3(12.8, 1, 8.4) },
    trainingfight: { pos: V3(12.5, 1.9, 13.2), tgt: V3(12.5, 1.3, 8.6), foe: V3(12.5, 0, 9) },
    stables: { pos: V3(13.5, 3.8, 17.5), tgt: V3(19.5, 1.5, 10.5) },
    gypsy: { pos: V3(-2.5, 2.4, 17), tgt: V3(-7.5, 1.6, 12) },
    gardens: { pos: V3(-7, 4, 22), tgt: V3(-15, 0.8, 14.5) },
    stone: { pos: V3(-1, 2.2, 7.5), tgt: V3(-5, 2.2, 3) },
    notice: { pos: V3(1.2, 2.1, -1), tgt: V3(3.8, 1.7, -5.6) },
    guilds: { pos: V3(0.5, 3.4, -7), tgt: V3(0, 4.2, -16) },
    lodge: { pos: V3(-11, 3, 1.5), tgt: V3(-16.5, 2, -4) },
    fields: { pos: V3(28, 3.2, 11), tgt: V3(38, 1, 0) },
    fieldsfight: { pos: V3(36.5, 1.8, 6.4), tgt: V3(36.5, 1.2, 1.4), foe: V3(36.5, 0, 1.8) },
    forest: { pos: V3(-1.5, 2.3, 55), tgt: V3(-8, 1.6, 44) },
    clearing: { pos: V3(-8, 1.75, 50.6), tgt: V3(-8, 1.25, 45.4), foe: V3(-8, 0, 45.8) },
    healer: { pos: V3(19, 2.6, 44.5), tgt: V3(14, 1.6, 38) },
    shades: { pos: V3(-37, 3.4, 6), tgt: V3(-52, 1.2, -4) },
    graveyard: { pos: V3(-38, 3, 3), tgt: V3(-46, 1, -5) },
    graveyardfight: { pos: V3(-42.8, 1.9, 0), tgt: V3(-46, 1.4, -4.5), foe: V3(-46, 0, -4.5) },
    mausoleum: { pos: V3(-47, 2.8, 4.5), tgt: V3(-55, 1.6, -6) },
    lair: { pos: V3(0, 8, -38), tgt: V3(0, 6.5, -60) },
    lairfight: { pos: V3(0, 6.5, -44.5), tgt: V3(0, 5.2, -57), foe: V3(0, 1, -57.5) },
    dawn: { pos: V3(24, 9, 30), tgt: V3(0, 4, -20) },
};

// ------------------------------------------------------------------ helpers
class Merger {
    constructor() { this.bins = new Map(); }
    add(geo, mat, m) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(m);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!this.bins.has(mat)) this.bins.set(mat, []);
        this.bins.get(mat).push(g);
    }
    build(parent, shadows) {
        for (const [mat, list] of this.bins) {
            const geo = mergeGeometries(list, false);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = shadows; mesh.receiveShadow = shadows;
            parent.add(mesh);
        }
        this.bins.clear();
    }
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new THREE.Vector3(), P = new THREE.Vector3();
function mtx(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), SC.set(sx, sy, sz));
}
// local transform within a building frame
function within(base, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return base.clone().multiply(mtx(x, y, z, rx, ry, rz, sx, sy, sz)); }

function prismGeo(w, h, d) { // triangular roof prism, ridge along x
    const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
    return g;
}

// ------------------------------------------------------------------ the world
export class World {
    constructor(opts) {
        this.opts = opts;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
        this.rnd = mulberry32(1234);
        this.anim = [];       // {update(t,dt)}
        this.nightMats = [];  // emissive materials that glow at night: {mat, base}
        this.lights = [];     // lamps: {light, base}
        this.t = 0;
        this.night = 0;
        this.shadows = !!opts.shadows;
        this.mats = {};
        this.build();
    }

    mat(key, params) {
        if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true, ...params });
        return this.mats[key];
    }

    build() {
        const s = this.scene;
        this.buildSky();
        this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3a20, 1.2); s.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xfff0d0, 2.5);
        this.sun.position.set(30, 50, 20);
        if (this.shadows) {
            this.sun.castShadow = true;
            this.sun.shadow.mapSize.set(1024, 1024);
            const c = this.sun.shadow.camera; c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 160;
            this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
        }
        s.add(this.sun); s.add(this.sun.target);
        s.fog = new THREE.Fog(0x9ab0c8, 40, 170);

        this.textures = {
            plaster: T.plasterTexture(3), plaster2: T.plasterTexture(8), stone: T.stoneTexture(5), thatch: T.thatchTexture(9),
            glow: T.glowTexture('rgba(255,200,120,1)', 'rgba(255,140,40,0)'), glowG: T.glowTexture('rgba(120,255,190,1)', 'rgba(60,255,150,0)'),
            glowB: T.glowTexture('rgba(170,210,255,1)', 'rgba(120,170,255,0)'), smoke: T.smokeTexture(),
        };
        this.textures.thatch.repeat.set(2, 1);
        this.M = {
            plaster: this.mat('plaster', { map: this.textures.plaster, flatShading: false }),
            plaster2: this.mat('plaster2', { map: this.textures.plaster2, flatShading: false }),
            stone: this.mat('stone', { map: this.textures.stone, flatShading: false }),
            thatch: this.mat('thatch', { map: this.textures.thatch }),
            slate: this.mat('slate', { color: 0x4a4a58 }),
            roofRed: this.mat('roofRed', { color: 0x7a3a28 }),
            wood: this.mat('wood', { color: 0x5a3a20 }),
            darkwood: this.mat('darkwood', { color: 0x2e1d10 }),
            rock: this.mat('rock', { color: 0x6a6660 }),
            iron: this.mat('iron', { color: 0x333038, metalness: 0.8, roughness: 0.4 }),
            hedge: this.mat('hedge', { color: 0x2e5a26 }),
            straw: this.mat('straw', { color: 0xc8a050 }),
            cloth: this.mat('cloth', { color: 0x8a2a2a }),
            window: new THREE.MeshStandardMaterial({ color: 0x2a1a0e, emissive: 0xffa040, emissiveIntensity: 0.1, roughness: 0.5 }),
            forge: new THREE.MeshStandardMaterial({ color: 0x401000, emissive: 0xff5010, emissiveIntensity: 2.2 }),
            rune: new THREE.MeshStandardMaterial({ color: 0x103020, emissive: 0x39d98f, emissiveIntensity: 1.2 }),
            moonflower: new THREE.MeshStandardMaterial({ color: 0xd8e0ff, emissive: 0x8090ff, emissiveIntensity: 0.1, flatShading: true }),
            water: new THREE.MeshStandardMaterial({ color: 0x1a3a4a, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.88 }),
            shoreWater: new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.15, metalness: 0.5 }),
        };
        this.nightMats.push({ mat: this.M.window, day: 0.08, night: 1.9 }, { mat: this.M.moonflower, day: 0.05, night: 1.2 });

        this.buildGround();
        const mg = new Merger();
        this.mg = mg;
        this.buildVillage(mg);
        this.buildPalisade(mg);
        this.buildFields(mg);
        this.buildHealer(mg);
        this.buildShore(mg);
        this.buildMountain(mg);
        mg.build(s, this.shadows);
        this.buildForest();
        this.buildLife();
    }

    // ---------------------------------------------------------------- sky
    buildSky() {
        const geo = new THREE.SphereGeometry(400, 32, 16);
        this.skyU = { top: { value: new THREE.Color(0x3a6ab0) }, hor: { value: new THREE.Color(0xb0c8e0) }, sunDir: { value: V3(0.3, 0.5, -0.8).normalize() }, sunCol: { value: new THREE.Color(0xfff0c0) }, stars: { value: 0 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; varying vec3 vDir;
                float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
                void main(){ float y = max(vDir.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55));
                    float sd = max(dot(vDir, sunDir), 0.0); c += sunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.35);
                    if (stars > 0.01) { vec3 q = floor(vDir * 220.0); float s = step(0.9975, h(q)); c += vec3(s) * stars * smoothstep(0.0, 0.25, y); }
                    if (vDir.y < 0.0) c = mix(hor, hor * 0.6, min(-vDir.y * 4.0, 1.0));
                    gl_FragColor = vec4(c, 1.0); }`,
        });
        this.sky = new THREE.Mesh(geo, mat);
        this.sky.renderOrder = -1;
        this.scene.add(this.sky);
        // moon
        this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTexture('rgba(235,240,255,1)', 'rgba(180,200,255,0)'), fog: false, transparent: true, depthWrite: false }));
        this.moon.scale.set(40, 40, 1); this.scene.add(this.moon);
        // clouds
        this.clouds = [];
        const cm = new THREE.SpriteMaterial({ map: this.textures?.smoke || T.smokeTexture(), transparent: true, opacity: 0.5, depthWrite: false, fog: false, color: 0xffffff });
        for (let i = 0; i < 14; i++) {
            const c = new THREE.Sprite(cm.clone());
            const a = this.rnd() * Math.PI * 2, r = 180 + this.rnd() * 120;
            c.position.set(Math.cos(a) * r, 60 + this.rnd() * 50, Math.sin(a) * r);
            c.scale.set(90 + this.rnd() * 80, 30 + this.rnd() * 20, 1);
            c.userData.a = a; c.userData.r = r;
            this.clouds.push(c); this.scene.add(c);
        }
    }

    // ---------------------------------------------------------------- ground
    buildGround() {
        const SIZE = 260;
        const paths = [
            { pts: [[0, 0], [10, 0], [20, 0], [27, 0], [36, 0], [46, 1]], w: 3.4 },
            { pts: [[27, 0], [26, 14], [18, 28], [8, 38], [-4, 44], [-8, 46]], w: 2.2, color: '#5a4a32' },
            { pts: [[20, 26], [15, 37]], w: 1.4, color: '#5a4a32' },
            { pts: [[0, 0], [-8, -8]], w: 2.2 }, { pts: [[0, 0], [9, -7], [15, -6]], w: 2.2 },
            { pts: [[0, 0], [-10, 4]], w: 2 }, { pts: [[0, 0], [12, 9], [19, 10]], w: 2 },
            { pts: [[0, 0], [-7, 12], [-14, 14]], w: 1.8 }, { pts: [[0, 0], [0, -16]], w: 2.2 }, { pts: [[-10, 4], [-16, -4]], w: 1.6 },
            { pts: [[-10, 4], [-26, 3], [-38, 0], [-46, -4]], w: 1.8, color: '#6a6a66' },
            { pts: [[0, -16], [0, -30], [2, -46], [0, -62]], w: 1.8, color: '#4a3a2a' },
        ];
        const patches = [
            { x: 0, z: 0, r: 7, color: '#6e655a', cobble: true },
            { x: 38, z: -9, rect: [16, 8], color: '#8a7038', rows: true },
            { x: 41, z: 9, rect: [12, 7], color: '#6a7a30', rows: true },
            { x: -46, z: -4, r: 13, color: '#4a5048' },
            { x: -8, z: 46, r: 8, color: '#3a3a20' },
            { x: 14, z: 38, r: 5, color: '#3a4020' },
            { x: 12.5, z: 9, r: 5, color: '#7a6448' },
        ];
        const tex = T.groundTexture(SIZE, { paths, patches, forestR: 32 });
        const g = new THREE.CircleGeometry(SIZE / 2, 64);
        g.rotateX(-Math.PI / 2);
        // uv from xz
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / SIZE + 0.5, 1 - (pos.getZ(i) / SIZE + 0.5));
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.flipY = true;
        const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
        ground.receiveShadow = this.shadows;
        this.scene.add(ground);
    }

    // ---------------------------------------------------------------- buildings
    house(mg, x, z, ry, o = {}) {
        const w = o.w ?? 5, d = o.d ?? 4, h = o.h ?? 3.2, rh = o.rh ?? 2.2;
        const base = mtx(x, 0, z, 0, ry);
        const wallMat = o.stone ? this.M.stone : (o.alt ? this.M.plaster2 : this.M.plaster);
        mg.add(new THREE.BoxGeometry(w, h, d), wallMat, within(base, 0, h / 2, 0));
        const roofMat = o.roof || (o.stone ? this.M.slate : this.M.thatch);
        mg.add(prismGeo(w + 0.6, rh, d + 0.8), roofMat, within(base, 0, h, 0));
        // door + windows on the front (+z)
        mg.add(new THREE.BoxGeometry(0.9, 1.7, 0.12), this.M.darkwood, within(base, o.doorX ?? 0, 0.85, d / 2 + 0.03));
        const wins = o.wins ?? [[-w / 3, 1.7], [w / 3, 1.7]];
        for (const [wx, wy] of wins) {
            mg.add(new THREE.BoxGeometry(0.7, 0.7, 0.1), this.M.window, within(base, wx, wy, d / 2 + 0.04));
            mg.add(new THREE.BoxGeometry(0.9, 0.1, 0.18), this.M.darkwood, within(base, wx, wy - 0.42, d / 2 + 0.06));
        }
        if (h > 4) for (const wx of [-w / 3, 0, w / 3]) mg.add(new THREE.BoxGeometry(0.6, 0.6, 0.1), this.M.window, within(base, wx, h - 1.1, d / 2 + 0.04));
        // side window
        mg.add(new THREE.BoxGeometry(0.1, 0.6, 0.6), this.M.window, within(base, w / 2 + 0.04, 1.7, 0));
        if (o.chimney !== false) {
            mg.add(new THREE.BoxGeometry(0.7, rh + 1.2, 0.7), this.M.stone, within(base, w / 3, h + (rh + 1.2) / 2 - 0.3, -d / 5));
            const cp = new THREE.Vector3(w / 3, h + rh + 0.9, -d / 5).applyMatrix4(base);
            if (o.smoke !== false) this.smokeAt(cp);
        }
        return base;
    }

    sign(text, base, x, y, z, w = 2.2, h = 0.8, opts = {}) {
        const tex = T.signTexture(text, opts);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [this.M.darkwood, this.M.darkwood, this.M.darkwood, this.M.darkwood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), this.M.darkwood]);
        m.applyMatrix4(within(base, x, y, z));
        this.scene.add(m);
        return m;
    }

    lamp(x, z, h = 3.2) {
        const mg = this.mg;
        mg.add(new THREE.CylinderGeometry(0.07, 0.1, h, 6), this.M.iron, mtx(x, h / 2, z));
        mg.add(new THREE.BoxGeometry(0.34, 0.42, 0.34), this.M.window, mtx(x, h + 0.1, z));
        mg.add(new THREE.ConeGeometry(0.32, 0.25, 4), this.M.iron, mtx(x, h + 0.42, z, 0, Math.PI / 4));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        sp.position.set(x, h + 0.1, z); sp.scale.set(2.4, 2.4, 1);
        this.scene.add(sp);
        this.lampSprites = this.lampSprites || []; this.lampSprites.push(sp);
    }

    smokeAt(p, color = 0xcfcfcf, rate = 1) {
        const mat = new THREE.SpriteMaterial({ map: this.textures.smoke, transparent: true, depthWrite: false, color, opacity: 0.5 });
        const puffs = [];
        for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(mat.clone()); sp.userData.o = i / 6; this.scene.add(sp); puffs.push(sp); }
        this.anim.push({ update: (t) => {
            for (const sp of puffs) {
                const k = (t * 0.12 * rate + sp.userData.o) % 1;
                sp.position.set(p.x + Math.sin(k * 4 + sp.userData.o * 9) * 0.4 + k * 1.2, p.y + k * 5, p.z + k * 0.6);
                const sc = 0.6 + k * 2.6; sp.scale.set(sc, sc, 1);
                sp.material.opacity = (1 - k) * 0.45 * (k < 0.1 ? k * 10 : 1);
            }
        } });
    }

    glowAt(p, tex, size, opacity = 0.8, nightOnly = false) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
        sp.position.copy(p); sp.scale.set(size, size, 1);
        this.scene.add(sp);
        if (nightOnly) (this.nightSprites ||= []).push({ sp, base: opacity });
        return sp;
    }

    buildVillage(mg) {
        const M = this.M;
        // well
        mg.add(new THREE.CylinderGeometry(1, 1.1, 0.9, 10, 1, true), M.stone, mtx(0, 0.45, 0));
        mg.add(new THREE.TorusGeometry(1, 0.15, 6, 12), M.rock, mtx(0, 0.9, 0, Math.PI / 2));
        mg.add(new THREE.CircleGeometry(0.95, 10), M.water, mtx(0, 0.5, 0, -Math.PI / 2));
        for (const sx of [-1, 1]) mg.add(new THREE.BoxGeometry(0.15, 2.2, 0.15), M.wood, mtx(sx * 0.9, 1.1, 0));
        mg.add(prismGeo(2.4, 0.7, 1.6), M.thatch, mtx(0, 2.1, 0));
        mg.add(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), M.wood, mtx(0, 1.7, 0, 0, 0, Math.PI / 2));
        for (const [x, z] of [[5, 5], [-5, -5], [5.5, -4.5], [-5.6, 5.4], [8, 2.5], [22, -2.8], [22, 2.8]]) this.lamp(x, z);

        // the Crooked Antler (inn)
        const inn = this.house(mg, -8.5, -8.5, Math.PI / 4, { w: 8, d: 5.5, h: 5.2, rh: 2.8, wins: [[-2.6, 1.6], [2.6, 1.6]], alt: true });
        this.sign('The Crooked\nAntler', inn, 2.2, 3, 3.1, 2.6, 1.2, { w: 256, h: 120, font: 'bold 28px Cinzel, Georgia, serif' });
        mg.add(new THREE.BoxGeometry(0.12, 0.12, 1.4), M.iron, within(inn, 2.2, 3.7, 3.4));
        // antlers over the door
        for (const sx of [-1, 1]) {
            mg.add(new THREE.CylinderGeometry(0.05, 0.07, 1, 5), M.straw, within(inn, sx * 0.35, 2.4, 2.85, 0, 0, sx * -0.7));
            mg.add(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 5), M.straw, within(inn, sx * 0.62, 2.85, 2.85, 0, 0, sx * 0.2));
        }
        // smithy (weapons): open shed with forge
        const sm = mtx(9.5, 0, -7.5, 0, -Math.PI / 5);
        mg.add(new THREE.BoxGeometry(6, 3, 0.3), M.stone, within(sm, 0, 1.5, -2));
        mg.add(new THREE.BoxGeometry(0.3, 3, 4), M.stone, within(sm, -3, 1.5, 0));
        for (const px of [3, 0.2]) mg.add(new THREE.BoxGeometry(0.25, 3, 0.25), M.wood, within(sm, px, 1.5, 1.9));
        mg.add(prismGeo(6.8, 1.6, 5), M.slate, within(sm, 0, 3, 0));
        mg.add(new THREE.BoxGeometry(1.8, 1.1, 1.4), M.stone, within(sm, -1.8, 0.55, -1.1));
        mg.add(new THREE.BoxGeometry(1.2, 0.3, 0.9), M.forge, within(sm, -1.8, 1.15, -1.1));
        mg.add(new THREE.BoxGeometry(0.8, 2.6, 0.8), M.stone, within(sm, -1.8, 2.4, -1.5));
        // anvil
        mg.add(new THREE.BoxGeometry(0.4, 0.6, 0.4), M.wood, within(sm, 0.8, 0.3, 0));
        mg.add(new THREE.BoxGeometry(0.9, 0.3, 0.35), M.iron, within(sm, 0.8, 0.75, 0));
        mg.add(new THREE.ConeGeometry(0.17, 0.4, 4), M.iron, within(sm, 1.4, 0.75, 0, 0, 0, -Math.PI / 2));
        // weapon rack
        mg.add(new THREE.BoxGeometry(2.2, 0.1, 0.1), M.wood, within(sm, 1, 1.6, -1.8));
        for (let i = 0; i < 5; i++) mg.add(new THREE.BoxGeometry(0.06, 1.4, 0.12), M.iron, within(sm, 0.2 + i * 0.4, 1.2, -1.7, 0, 0, (i - 2) * 0.05));
        const fp = new THREE.Vector3(-1.8, 1.4, -1.1).applyMatrix4(sm);
        this.forgeLight = new THREE.PointLight(0xff6020, 8, 9, 1.5); this.forgeLight.position.copy(fp).add(V3(0, 0.6, 0.6)); this.scene.add(this.forgeLight);
        this.glowAt(fp, this.textures.glow, 2.4, 0.7);
        this.sign("Grimbold's\nArms", sm, 1.6, 3.4, 2.5, 2.2, 1, { w: 256, h: 120, font: 'bold 28px Cinzel, Georgia, serif' });
        this.smokeAt(new THREE.Vector3(-1.8, 3.9, -1.5).applyMatrix4(sm), 0x888888, 1.4);
        this.embers(fp.clone().add(V3(0, 0.4, 0)), 0xff7020);

        // armour shop
        const ar = this.house(mg, 15.5, -6.5, -Math.PI / 8, { w: 5, d: 4.2, h: 3.4 });
        this.sign('Gilded\nGauntlet', ar, 0, 3.0, 2.25, 2, 0.9, { w: 256, h: 112, fg: '#f0d890', font: 'bold 30px Cinzel, Georgia, serif' });
        // armour stand
        const st = within(ar, -1.6, 0, 3);
        mg.add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), M.wood, within(st, 0, 0.6, 0));
        mg.add(new THREE.CylinderGeometry(0.35, 0.28, 0.75, 8), M.iron, within(st, 0, 1.45, 0));
        mg.add(new THREE.SphereGeometry(0.22, 8, 6), M.iron, within(st, 0, 2.05, 0));
        mg.add(new THREE.BoxGeometry(0.9, 0.15, 0.3), M.iron, within(st, 0, 1.8, 0));

        // bank: stone with columns
        const bk = mtx(-10.5, 0, 4.5, 0, Math.PI / 2.2);
        mg.add(new THREE.BoxGeometry(6, 4, 4.5), M.stone, within(bk, 0, 2, -0.6));
        mg.add(new THREE.BoxGeometry(6.8, 0.4, 6), M.rock, within(bk, 0, 0.2, 0));
        mg.add(new THREE.BoxGeometry(6.6, 0.4, 5.7), M.rock, within(bk, 0, 4.2, 0));
        mg.add(prismGeo(6.6, 1.2, 5.7), M.slate, within(bk, 0, 4.4, 0));
        for (let i = 0; i < 4; i++) mg.add(new THREE.CylinderGeometry(0.25, 0.28, 3.8, 10), M.rock, within(bk, -2.4 + i * 1.6, 2.1, 2.4));
        mg.add(new THREE.BoxGeometry(1.2, 2.2, 0.15), M.iron, within(bk, 0, 1.5, 1.68));
        for (const wx of [-2, 2]) mg.add(new THREE.BoxGeometry(0.8, 1, 0.1), M.window, within(bk, wx, 2.2, 1.68));
        this.sign('QUILL & LEDGER', bk, 0, 3.7, 2.45, 3, 0.45, { w: 384, h: 64, font: 'bold 32px Cinzel, Georgia, serif', fg: '#e8d080' });

        // gypsy tent
        this.tent(-7.5, 12, 1.8, 3.2);
        this.glowAt(V3(-6.2, 1.3, 13.3), this.textures.glow, 1.5, 0.6);
        this.glowAt(V3(-7.5, 1.6, 12.5), T.glowTexture('rgba(220,140,255,1)', 'rgba(180,80,255,0)'), 1.8, 0.5);

        // training yard
        const ty = mtx(12.5, 0, 9, 0, 0);
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; if (Math.abs(Math.sin(a) + 0.9) < 0.15) continue; mg.add(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 5), M.wood, within(ty, Math.cos(a) * 5, 0.6, Math.sin(a) * 5)); }
        for (const [dx, dz] of [[-2.5, -2], [0, -3], [2.5, -2]]) {
            mg.add(new THREE.CylinderGeometry(0.08, 0.08, 2, 5), M.wood, within(ty, dx, 1, dz));
            mg.add(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5), M.wood, within(ty, dx, 1.5, dz, 0, 0, Math.PI / 2));
            mg.add(new THREE.SphereGeometry(0.4, 8, 6), M.straw, within(ty, dx, 1.4, dz, 0, 0, 0, 1, 1.4, 1));
            mg.add(new THREE.SphereGeometry(0.22, 8, 6), M.straw, within(ty, dx, 2.1, dz));
        }
        mg.add(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), M.wood, within(ty, 4, 2.5, -4));
        this.banner(V3(4.05, 4.2, -4).applyMatrix4(ty), 0xb02a2a, 1.4, 2);

        // stables
        const sb = mtx(19.5, 0, 10.5, 0, -Math.PI / 2.5);
        mg.add(new THREE.BoxGeometry(7, 3, 5), this.mat('barn', { color: 0x6a2e1e }), within(sb, 0, 1.5, 0));
        mg.add(prismGeo(7.6, 2.4, 5.8), M.roofRed, within(sb, 0, 3, 0));
        mg.add(new THREE.BoxGeometry(2.2, 2.4, 0.1), M.darkwood, within(sb, 0, 1.2, 2.53));
        for (let i = 0; i < 8; i++) mg.add(new THREE.BoxGeometry(0.12, 1, 0.12), M.wood, within(sb, -3.5 + i, 0.5, 5.5));
        mg.add(new THREE.BoxGeometry(7.2, 0.1, 0.1), M.wood, within(sb, 0, 0.9, 5.5));
        mg.add(new THREE.BoxGeometry(7.2, 0.1, 0.1), M.wood, within(sb, 0, 0.5, 5.5));
        this.horse(mg, within(sb, -1.5, 0, 3.8, 0, 0.4), 0x5a3a22);
        this.horse(mg, within(sb, 1.8, 0, 4.2, 0, -2.4), 0xd8d0c0);

        // notice board
        const nb = mtx(3.8, 0, -5.6, 0, -0.5);
        for (const sx of [-1, 1]) mg.add(new THREE.BoxGeometry(0.15, 2.6, 0.15), M.wood, within(nb, sx * 1.1, 1.3, 0));
        mg.add(prismGeo(2.8, 0.5, 0.8), M.thatch, within(nb, 0, 2.6, 0));
        const board = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 0.08), [M.darkwood, M.darkwood, M.darkwood, M.darkwood, new THREE.MeshStandardMaterial({ map: T.noticeTexture(), roughness: 0.9 }), M.darkwood]);
        board.applyMatrix4(within(nb, 0, 1.75, 0.05)); this.scene.add(board);

        // standing stone
        const ss = mtx(-5, 0, 3, 0, 0.3);
        mg.add(new THREE.CylinderGeometry(0.45, 0.7, 3.6, 5), M.rock, within(ss, 0, 1.8, 0, 0.04, 0, 0.05));
        for (let i = 0; i < 5; i++) mg.add(new THREE.BoxGeometry(0.18, 0.18, 0.04), M.rune, within(ss, 0, 0.9 + i * 0.5, 0.58 - i * 0.025));
        this.glowAt(V3(-5, 1.9, 3.6), this.textures.glowG, 1.6, 0.35);

        // guildhall row
        const gcol = [0xc84020, 0xe0c040, 0x303040, 0x3a6a30, 0xd0a030];
        for (let i = 0; i < 3; i++) {
            const gx = -5 + i * 5;
            const gb = this.house(mg, gx, -17, 0, { w: 4.4, d: 4, h: 6 + (i % 2), rh: 2.4, wins: [[-1.2, 1.7], [1.2, 1.7]], stone: i === 1, alt: i === 2 });
            this.banner(V3(gx + 1.2, 5, -14.9), gcol[i], 0.8, 2.2, true);
            this.banner(V3(gx - 1.2, 5, -14.9), gcol[i + 2], 0.8, 2.2, true);
        }
        // lodge
        const lg = this.house(mg, -16.5, -4, Math.PI / 2.4, { w: 7.5, d: 4, h: 2.8, rh: 1.6, wins: [[-2.5, 1.5], [2.5, 1.5]] });
        for (const sx of [-1, 1]) mg.add(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), M.straw, within(lg, sx * 0.5, 3.2, 2.05, 0, 0, sx * -0.6));
        this.sign("DEEDKEEPER'S\nLODGE", lg, 0, 2.3, 2.1, 1.8, 0.7, { w: 256, h: 100, font: 'bold 24px Cinzel, Georgia, serif' });

        // gardens
        const gx = -15, gz = 14.5;
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; if (Math.abs(a - 0.7) < 0.35) continue; mg.add(new THREE.BoxGeometry(2.4, 1.1, 0.9), M.hedge, mtx(gx + Math.cos(a) * 6.5, 0.55, gz + Math.sin(a) * 6.5, 0, -a + Math.PI / 2)); }
        mg.add(new THREE.CircleGeometry(2.4, 20), M.water, mtx(gx - 1, 0.04, gz - 0.5, -Math.PI / 2));
        // willow
        mg.add(new THREE.CylinderGeometry(0.25, 0.4, 3, 6), M.wood, mtx(gx + 2.5, 1.5, gz - 2));
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; mg.add(new THREE.SphereGeometry(1.1, 7, 5), this.mat('willow', { color: 0x5a8a3a }), mtx(gx + 2.5 + Math.cos(a) * 1.2, 3.4 - (i % 3) * 0.4, gz - 2 + Math.sin(a) * 1.2, 0, 0, 0, 1, 1.6, 1)); }
        // flowers
        for (let i = 0; i < 60; i++) {
            const a = this.rnd() * Math.PI * 2, r = 3 + this.rnd() * 2.6;
            const mf = i % 3 === 0 ? M.moonflower : this.mat('fl' + (i % 4), { color: [0xe04a6a, 0xf0d040, 0xb070e0, 0xffffff][i % 4] });
            mg.add(new THREE.IcosahedronGeometry(0.16, 0), mf, mtx(gx + Math.cos(a) * r, 0.25, gz + Math.sin(a) * r));
        }
        mg.add(new THREE.BoxGeometry(1.6, 0.1, 0.5), M.wood, mtx(gx - 3, 0.5, gz + 2.5, 0, 0.6));
        for (const sx of [-0.6, 0.6]) mg.add(new THREE.BoxGeometry(0.1, 0.5, 0.4), M.wood, mtx(gx - 3 + sx * Math.cos(0.6), 0.25, gz + 2.5 - sx * Math.sin(0.6), 0, 0.6));

        // cottages around the edges
        const spots = [[7, 18, 2.8], [-1, 20, 3.2], [-20, 6, 1.6], [-21, -12, 0.9], [-9, -19, 0.2], [10, -17, -0.3], [20, -14, -0.8], [23, -5, -1.4], [3, -22, 0], [-14, 22, 2.5], [17, 19, -2.4], [-23, 15, 1.9]];
        spots.forEach(([x, z, r], i) => this.house(mg, x, z, r, { w: 4 + this.rnd() * 1.5, d: 3.6 + this.rnd(), h: 2.8 + this.rnd() * 0.6, alt: i % 2 === 1, stone: i % 5 === 2, roof: i % 4 === 3 ? this.M.slate : undefined, smoke: i % 3 === 0 }));
        // barrels and crates near the inn and smithy
        for (const [x, z] of [[-4.6, -9.4], [-4.2, -8.6], [6.4, -9.2], [12.6, -3.8]]) mg.add(new THREE.CylinderGeometry(0.38, 0.34, 0.9, 8), M.wood, mtx(x, 0.45, z));
        for (const [x, z] of [[-3.8, -10], [13.4, -4.2]]) mg.add(new THREE.BoxGeometry(0.7, 0.7, 0.7), this.mat('crate', { color: 0x8a6a3a }), mtx(x, 0.35, z, 0, 0.4));
    }

    tent(x, z, r, h) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#e8d8b0' : '#7a2a5a'; g.fillRect(i * 16, 0, 16, 64); }
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
        m.position.set(x, h / 2, z); this.scene.add(m);
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), this.mat('gold', { color: 0xd8b040, metalness: 0.6, roughness: 0.4 }));
        flag.position.set(x, h + 0.3, z); this.scene.add(flag);
    }

    banner(p, color, w, h, still = false) {
        const geo = new THREE.PlaneGeometry(w, h, 4, 6);
        geo.translate(w / 2, -h / 2, 0);
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
        m.position.copy(p);
        if (still) { m.rotation.y = 0; m.position.x -= w / 2; }
        this.scene.add(m);
        const base = geo.attributes.position.array.slice();
        this.anim.push({ update: (t) => {
            const a = geo.attributes.position;
            for (let i = 0; i < a.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; a.setZ(i, Math.sin(t * 2.2 + x * 2.5 + y) * 0.08 * (still ? (-y / h) : x / w)); }
            a.needsUpdate = true; geo.computeVertexNormals();
        } });
    }

    horse(mg, base, color) {
        const m = this.mat('horse' + color, { color });
        mg.add(new THREE.BoxGeometry(1.6, 0.7, 0.55), m, within(base, 0, 1.15, 0));
        for (const [x, z] of [[-0.6, -0.2], [-0.6, 0.2], [0.6, -0.2], [0.6, 0.2]]) mg.add(new THREE.BoxGeometry(0.16, 0.9, 0.16), m, within(base, x, 0.45, z));
        mg.add(new THREE.BoxGeometry(0.35, 0.8, 0.3), m, within(base, 0.85, 1.6, 0, 0, 0, -0.5));
        mg.add(new THREE.BoxGeometry(0.55, 0.28, 0.26), m, within(base, 1.15, 1.95, 0, 0, 0, 0.3));
        mg.add(new THREE.BoxGeometry(0.1, 0.6, 0.1), this.M.darkwood, within(base, -0.85, 1.1, 0, 0, 0, 0.5));
    }

    embers(p, color) {
        const N = 24;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.12, map: this.textures.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pts.frustumCulled = false; this.scene.add(pts);
        const d = Array.from({ length: N }, () => [Math.random(), (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0.5 + Math.random()]);
        this.anim.push({ update: (t, dt) => {
            const a = g.attributes.position;
            d.forEach((e, i) => { e[0] += dt * 0.5 * e[3]; if (e[0] > 1) e[0] = 0; a.setXYZ(i, p.x + e[1] * e[0] + Math.sin(t * 3 + i) * 0.1, p.y + e[0] * 2.5, p.z + e[2] * e[0]); });
            a.needsUpdate = true;
        } });
    }

    buildPalisade(mg) {
        const R = 27, M = this.M;
        const log = new THREE.CylinderGeometry(0.28, 0.3, 4, 6);
        const tip = new THREE.ConeGeometry(0.3, 0.7, 6);
        for (let a = 0; a < Math.PI * 2; a += 0.55 / R) {
            const ang = ((a + Math.PI) % (Math.PI * 2)) - Math.PI;
            if (Math.abs(ang) < 0.12) continue; // gate gap (east)
            const x = Math.cos(a) * R, z = Math.sin(a) * R, hh = 3.6 + (Math.sin(a * 37) * 0.3);
            mg.add(log, M.wood, mtx(x, hh / 2 - 0.2, z, 0, 0, 0, 1, hh / 4, 1));
            mg.add(tip, M.wood, mtx(x, hh - 0.05, z));
        }
        // gate towers
        for (const sz of [-1, 1]) {
            const x = R, z = sz * 3.6;
            mg.add(new THREE.BoxGeometry(2.4, 6, 2.4), M.wood, mtx(x, 3, z));
            mg.add(new THREE.ConeGeometry(2, 1.8, 4), M.slate, mtx(x, 6.9, z, 0, Math.PI / 4));
        }
        mg.add(new THREE.BoxGeometry(1, 0.8, 9.6), M.darkwood, mtx(R, 5.2, 0));
        this.banner(V3(R + 0.6, 5, -1.2), 0x1e8a58, 1, 2.2, true);
        this.banner(V3(R + 0.6, 5, 1.8), 0x1e8a58, 1, 2.2, true);
    }

    buildFields(mg) {
        const M = this.M;
        for (const [x, z, r] of [[33, -9, 0.3], [36, -11, 1.2], [40, -8, 0.6], [44, -10, 2], [42, 9, 0.2], [45, 7, 1.4]]) mg.add(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 12), M.straw, mtx(x, 0.75, z, Math.PI / 2, r, 0));
        for (const [x, z] of [[34, 6], [40, 4.5]]) { mg.add(new THREE.ConeGeometry(1.4, 2.2, 5), this.mat('tent2', { color: 0x8a7a5a }), mtx(x, 1.1, z, 0, 0.5)); }
        // campfire
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; mg.add(new THREE.DodecahedronGeometry(0.22, 0), M.rock, mtx(37 + Math.cos(a) * 0.6, 0.12, 4 + Math.sin(a) * 0.6)); }
        for (let i = 0; i < 3; i++) mg.add(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), M.darkwood, mtx(37, 0.2, 4, Math.PI / 2.3, i * 2.1, 0));
        this.fireLight = new THREE.PointLight(0xff8030, 6, 10, 1.6); this.fireLight.position.set(37, 0.9, 4); this.scene.add(this.fireLight);
        this.fireGlow = this.glowAt(V3(37, 0.6, 4), this.textures.glow, 1.6, 0.9);
        this.embers(V3(37, 0.3, 4), 0xff8a30);
        this.smokeAt(V3(37, 0.9, 4), 0x777777, 0.8);
        // scarecrow & fence
        mg.add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), M.wood, mtx(39, 1.2, -6));
        mg.add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), M.wood, mtx(39, 1.8, -6, 0, 0, Math.PI / 2));
        mg.add(new THREE.SphereGeometry(0.25, 6, 5), M.straw, mtx(39, 2.5, -6));
        mg.add(new THREE.ConeGeometry(0.35, 0.4, 6), this.mat('hat', { color: 0x3a2a1a }), mtx(39, 2.8, -6));
        for (let i = 0; i < 14; i++) mg.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), M.wood, mtx(30 + i * 1.4, 0.45, -14));
    }

    buildHealer(mg) {
        const M = this.M;
        mg.add(new THREE.CylinderGeometry(2, 2.1, 2.4, 10), this.mat('mud', { color: 0x7a6040 }), mtx(14, 1.2, 38));
        mg.add(new THREE.ConeGeometry(2.7, 2.4, 10), M.thatch, mtx(14, 3.6, 38));
        mg.add(new THREE.BoxGeometry(0.8, 1.6, 0.1), M.darkwood, mtx(14 + 1.4, 0.8, 38 + 1.45, 0, Math.PI / 4));
        mg.add(new THREE.BoxGeometry(0.5, 0.5, 0.1), M.window, mtx(14 - 0.6, 1.4, 38 + 2.0, 0, -0.2));
        // cauldron
        mg.add(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, Math.PI / 2.6, Math.PI / 1.6), M.iron, mtx(16.5, 0.65, 40.5));
        this.glowAt(V3(16.5, 0.85, 40.5), this.textures.glowG, 1.4, 0.6);
        this.smokeAt(V3(16.5, 1, 40.5), 0x6aff9a, 0.7);
        this.smokeAt(V3(14, 4.6, 38), 0x9adfa0, 0.9);
    }

    buildShore(mg) {
        const M = this.M;
        // tombstones
        const r = this.rnd;
        for (let i = 0; i < 26; i++) {
            const x = -46 + (r() - 0.5) * 20, z = -4 + (r() - 0.5) * 18;
            if (Math.hypot(x + 46, z + 4.5) < 2.5) continue;
            if (r() < 0.5) mg.add(new THREE.BoxGeometry(0.7, 1, 0.18), M.rock, mtx(x, 0.45, z, (r() - 0.5) * 0.2, r() * 0.5, (r() - 0.5) * 0.25));
            else { mg.add(new THREE.BoxGeometry(0.14, 1.2, 0.14), M.rock, mtx(x, 0.6, z, 0, r(), (r() - 0.5) * 0.2)); mg.add(new THREE.BoxGeometry(0.6, 0.14, 0.14), M.rock, mtx(x, 0.85, z, 0, r(), 0)); }
        }
        // dead trees
        for (const [x, z] of [[-40, -10], [-53, 4], [-38, 3]]) {
            mg.add(new THREE.CylinderGeometry(0.12, 0.3, 4, 5), M.darkwood, mtx(x, 2, z, 0, 0, 0.1));
            for (let k = 0; k < 4; k++) mg.add(new THREE.CylinderGeometry(0.04, 0.1, 1.8, 4), M.darkwood, mtx(x + Math.cos(k * 1.7) * 0.5, 3 + k * 0.3, z + Math.sin(k * 1.7) * 0.5, Math.sin(k * 1.7) * 0.8, 0, Math.cos(k * 1.7) * 0.8));
        }
        // the grey sea
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 140), M.shoreWater);
        sea.rotation.x = -Math.PI / 2; sea.position.set(-100, 0.05, 0); this.scene.add(sea);
        // barrow mound + door
        mg.add(new THREE.SphereGeometry(5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('barrow', { color: 0x3a4a34 }), mtx(-57, 0, -8, 0, 0, 0, 1, 0.6, 1));
        mg.add(new THREE.BoxGeometry(1.6, 2.2, 1), M.rock, mtx(-54, 1.1, -4.6, 0, -0.7));
        mg.add(new THREE.BoxGeometry(1.1, 1.8, 0.2), this.mat('void', { color: 0x050508 }), mtx(-53.7, 0.9, -4.3, 0, -0.7));
        // ferry
        mg.add(new THREE.BoxGeometry(4, 0.5, 1.2), this.mat('boat', { color: 0x141418 }), mtx(-62, 0.3, 2, 0, 0.3));
        mg.add(new THREE.CylinderGeometry(0.04, 0.04, 2, 4), M.darkwood, mtx(-60.5, 1.3, 2.4));
        this.glowAt(V3(-60.5, 2.3, 2.4), this.textures.glowB, 1.3, 0.9);
        this.glowAt(V3(-54, 1.6, -4.3), this.textures.glowB, 1.5, 0.5);
        // wisps & mist
        const wisps = [];
        for (let i = 0; i < 7; i++) wisps.push(this.glowAt(V3(-46, 1, -4), this.textures.glowB, 0.6, 0.85));
        const mist = [];
        const mm = new THREE.SpriteMaterial({ map: this.textures.smoke, transparent: true, depthWrite: false, opacity: 0.35, color: 0xb8c8d8 });
        for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(mm); sp.position.set(-46 + (r() - 0.5) * 22, 0.6 + r() * 0.6, -4 + (r() - 0.5) * 18); sp.scale.set(8, 3, 1); this.scene.add(sp); mist.push(sp); }
        this.anim.push({ update: (t) => {
            wisps.forEach((w, i) => w.position.set(-46 + Math.sin(t * 0.3 + i * 2) * 8, 1.2 + Math.sin(t * 1.3 + i) * 0.5, -4 + Math.cos(t * 0.23 + i * 1.3) * 7));
            mist.forEach((m, i) => { m.position.x += Math.sin(t * 0.1 + i) * 0.004; });
        } });
    }

    buildMountain(mg) {
        const geo = new THREE.ConeGeometry(42, 50, 18, 6);
        const pos = geo.attributes.position;
        const rr = mulberry32(77);
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y > 24.9) continue;
            const k = 1 + (rr() - 0.5) * 0.18;
            pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); pos.setY(i, y + (rr() - 0.5) * 3);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, this.mat('mtn', { color: 0x3a3632 }));
        m.position.set(0, 23, -100); this.scene.add(m);
        // scorched glassy slope
        mg.add(new THREE.CylinderGeometry(18, 19, 0.4, 14), this.mat('glass', { color: 0x1a3a2a, roughness: 0.3, metalness: 0.4 }), mtx(0, 0.2, -60));
        // cave mouth
        const cave = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x020403 }));
        cave.position.set(0, 1, -62); this.scene.add(cave);
        mg.add(new THREE.TorusGeometry(6.6, 1.3, 6, 14, Math.PI), this.M.rock, mtx(0, 1, -61.8));
        for (const sx of [-1, 1]) mg.add(new THREE.DodecahedronGeometry(2.2, 0), this.M.rock, mtx(sx * 7.5, 1.2, -61, 0.3, sx, 0.2));
        mg.add(new THREE.BoxGeometry(15, 1, 6), this.M.rock, mtx(0, 0.5, -59));
        this.lairLight = new THREE.PointLight(0x30ff90, 20, 30, 1.5); this.lairLight.position.set(0, 6, -58); this.scene.add(this.lairLight);
        // eyes in the dark
        this.eyes = [-1.4, 1.4].map((x) => this.glowAt(V3(x, 4.6, -61.7), this.textures.glowG, 1.7, 1));
        this.anim.push({ update: (t) => {
            const blink = (Math.sin(t * 0.9) > 0.985) ? 0.05 : 1;
            const show = this.eyesVisible !== false;
            for (const e of this.eyes) { e.material.opacity = show ? blink * (0.75 + Math.sin(t * 1.7) * 0.25) : 0; }
            this.lairLight.intensity = 12 + Math.sin(t * 1.1) * 6;
        } });
        // bones
        for (let i = 0; i < 18; i++) mg.add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 4), this.mat('bone', { color: 0xd8d0b8 }), mtx((this.rnd() - 0.5) * 12, 1.05, -57 - this.rnd() * 4, Math.PI / 2, this.rnd() * 3, 0));
        this.smokeAt(V3(0, 7.5, -61.5), 0x2a5a3a, 0.5);
    }

    // ---------------------------------------------------------------- forest
    buildForest() {
        const count = this.opts.lowTrees ? 900 : 1700;
        // pine geometry: trunk + 3 cones, vertex coloured
        const parts = [];
        const add = (geo, color, y) => { geo.translate(0, y, 0); const c = new THREE.Color(color); const n = geo.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(geo.toNonIndexed ? geo.toNonIndexed() : geo); };
        add(new THREE.CylinderGeometry(0.18, 0.28, 2, 5), 0x4a3020, 1);
        add(new THREE.ConeGeometry(1.9, 3, 7), 0x1f4a2a, 2.8);
        add(new THREE.ConeGeometry(1.5, 2.6, 7), 0x245a30, 4.2);
        add(new THREE.ConeGeometry(1.0, 2.2, 7), 0x2a6a36, 5.5);
        for (const p of parts) { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(k)) p.deleteAttribute(k); }
        const pine = mergeGeometries(parts);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
        const inst = new THREE.InstancedMesh(pine, mat, count);
        const r = mulberry32(99);
        const clear = [[-8, 46, 7.5], [14, 38, 6], [-46, -4, 15], [0, -56, 16], [37, 0, 14]];
        const ok = (x, z) => {
            const d = Math.hypot(x, z);
            if (d < 31) return false;
            const ang = Math.atan2(z, x);
            if (Math.abs(ang) < 0.5 && d < 58) return false; // fields
            if (Math.abs(x) < 4.5 && z > 25 && z < 40) return false;
            for (const [cx, cz, cr] of clear) if (Math.hypot(x - cx, z - cz) < cr) return false;
            for (const v of Object.values(VIEWS)) if (Math.hypot(x - v.pos.x, z - v.pos.z) < 5.5 || Math.hypot(x - (v.pos.x + v.tgt.x) / 2, z - (v.pos.z + v.tgt.z) / 2) < 3.6) return false;
            // path to the clearing and healer
            if (Math.hypot(x - 18, z - 28) < 4 || Math.hypot(x - 8, z - 38) < 3.5 || Math.hypot(x - 22, z - 18) < 4) return false;
            if (Math.abs(x) < 3 && z < -30 && z > -64) return false;
            if (z < -30 && z > -64 && Math.abs(x) < 3.5) return false;
            if (z < 6 && z > -12 && x < -26 && x > -60) return false; // road to shore
            return d < 125;
        };
        let n = 0, tries = 0;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
        // ensure a ring of trees close around each clearing first
        const ringAt = (cx, cz, cr, k) => { for (let i = 0; i < k; i++) { const a = r() * Math.PI * 2, d = cr + 1 + r() * 4; place(cx + Math.cos(a) * d, cz + Math.sin(a) * d); } };
        const place = (x, z) => {
            if (n >= count || !ok(x, z)) return;
            const s = 0.8 + r() * 0.9;
            m.compose(p.set(x, 0, z), q.setFromAxisAngle(V3(0, 1, 0), r() * 6.28), sc.set(s, s * (0.85 + r() * 0.4), s));
            inst.setMatrixAt(n++, m);
        };
        ringAt(-8, 46, 7.5, 70); ringAt(14, 38, 6, 40); ringAt(-46, -4, 15, 50);
        while (n < count && tries++ < count * 8) { const a = r() * Math.PI * 2, d = 31 + Math.pow(r(), 0.7) * 95; place(Math.cos(a) * d, Math.sin(a) * d); }
        inst.count = n;
        inst.castShadow = this.shadows; inst.receiveShadow = false;
        this.scene.add(inst);
        // rocks
        const rockI = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), this.mat('rock2', { color: 0x5a5852 }), 120);
        let rn = 0;
        for (let i = 0; i < 400 && rn < 120; i++) { const a = r() * Math.PI * 2, d = 20 + r() * 80; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x, z) < 28) continue; const s = 0.5 + r() * 1.4; m.compose(p.set(x, s * 0.2, z), q.setFromEuler(new THREE.Euler(r(), r(), r())), sc.set(s, s * 0.7, s)); rockI.setMatrixAt(rn++, m); }
        rockI.count = rn; this.scene.add(rockI);
        // glowing mushrooms in the clearing
        for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = 4 + r() * 3; const mm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.M.moonflower); mm.position.set(-8 + Math.cos(a) * d, 0.12, 46 + Math.sin(a) * d); this.scene.add(mm); }
        // fireflies
        const N = 70;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        this.fireflies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.25, map: this.textures.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        this.fireflies.frustumCulled = false; this.scene.add(this.fireflies);
        const fd = Array.from({ length: N }, (_, i) => { const spots = [[-8, 46, 7], [14, 38, 5], [-15, 14.5, 6], [37, 2, 10]]; const s = spots[i % spots.length]; return [s[0], s[1], s[2], r() * 10, r() * 10]; });
        this.anim.push({ update: (t) => {
            if (this.night < 0.2) return;
            const a = g.attributes.position;
            fd.forEach((f, i) => a.setXYZ(i, f[0] + Math.sin(t * 0.3 + f[3]) * f[2], 0.6 + Math.sin(t * 0.9 + f[4]) * 0.5 + 0.6, f[1] + Math.cos(t * 0.26 + f[4]) * f[2]));
            a.needsUpdate = true;
        } });
    }

    // ---------------------------------------------------------------- villagers
    buildLife() {
        const routes = [
            [[2, 2], [9, 0], [20, 0], [9, 0]], [[-3, -3], [-6, -6], [-2, -1], [3, -4]], [[-6, 9], [-2, 4], [2, 6], [-5, 11]],
            [[10, 6], [6, 3], [3, -2], [8, -4]], [[-9, 2], [-4, 0], [-8, -3]], [[0, -10], [0, -4], [4, -8]], [[-12, 12], [-9, 9], [-14, 9]],
        ];
        const cols = [0x6a3a2a, 0x2a4a6a, 0x5a6a2a, 0x7a2a5a, 0x8a7a5a, 0x3a3a3a, 0x9a5a2a];
        this.walkers = routes.map((route, i) => {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.1, 6), this.mat('v' + i, { color: cols[i] }));
            body.position.y = 0.75;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), this.mat('skin' + (i % 3), { color: [0xe0b090, 0xa07050, 0xf0c8a8][i % 3] }));
            head.position.y = 1.45;
            g.add(body, head);
            body.castShadow = this.shadows;
            this.scene.add(g);
            return { g, route, seg: 0, k: this.rnd(), speed: 0.9 + this.rnd() * 0.5, pause: 0 };
        });
        this.anim.push({ update: (t, dt) => {
            for (const w of this.walkers) {
                if (w.pause > 0) { w.pause -= dt; continue; }
                const a = w.route[w.seg], b = w.route[(w.seg + 1) % w.route.length];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                w.k += (dt * w.speed) / len;
                if (w.k >= 1) { w.k = 0; w.seg = (w.seg + 1) % w.route.length; if (Math.random() < 0.4) w.pause = 1 + Math.random() * 3; continue; }
                const x = a[0] + (b[0] - a[0]) * w.k, z = a[1] + (b[1] - a[1]) * w.k;
                w.g.position.set(x, Math.abs(Math.sin(t * 8 * w.speed)) * 0.05, z);
                w.g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
            }
        } });
    }

    // ---------------------------------------------------------------- time of day
    setTime(minutes, alive = true) {
        const m = ((minutes % 1440) + 1440) % 1440;
        const keys = [
            [0, 0x0c1430, 0x26304e, 0.0, 0x8fa4d8, 0.4],
            [300, 0x111a36, 0x2e3654, 0.0, 0x8fa4d8, 0.42],
            [360, 0x5a6aa0, 0xe8b498, 0.6, 0xffc090, 0.65],
            [450, 0x5a88c8, 0xd8d8d0, 0.9, 0xffe0b0, 0.9],
            [720, 0x3a72c0, 0xb8d0e8, 1.0, 0xfff4e0, 1.0],
            [1000, 0x4a7ab8, 0xe8d0a0, 0.95, 0xffd8a0, 0.95],
            [1110, 0x4a4a88, 0xf08850, 0.55, 0xff9050, 0.7],
            [1190, 0x1c2048, 0x6a4060, 0.15, 0xc06070, 0.4],
            [1260, 0x0e1530, 0x2a3458, 0.0, 0x8fa4d8, 0.4],
            [1440, 0x0c1430, 0x26304e, 0.0, 0x8fa4d8, 0.4],
        ];
        let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= m) i++;
        const a = keys[i], b = keys[i + 1];
        const k = (m - a[0]) / (b[0] - a[0] || 1);
        const lerpC = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
        let top = lerpC(a[1], b[1]), hor = lerpC(a[2], b[2]);
        const sunK = a[3] + (b[3] - a[3]) * k;
        let sunCol = lerpC(a[4], b[4]);
        let amb = a[5] + (b[5] - a[5]) * k;
        let night = 1 - Math.min(1, sunK * 1.6);
        if (!alive) {
            top = new THREE.Color(0x1a2230); hor = new THREE.Color(0x6a7888); sunCol = new THREE.Color(0xa0b0c8);
            amb = 0.55; night = 0.6;
        }
        this.night = night;
        this.skyU.top.value.copy(top); this.skyU.hor.value.copy(hor); this.skyU.sunCol.value.copy(sunCol).multiplyScalar(alive ? Math.max(0.15, sunK) : 0.2);
        this.skyU.stars.value = alive ? night : 0.2;
        // sun direction: rises east (+x), sets west, arcs over the south
        const dayT = Math.min(1, Math.max(0, (m - 330) / (1230 - 330)));
        const ang = dayT * Math.PI;
        const dir = V3(Math.cos(ang), Math.max(0.05, Math.sin(ang) * 0.85), -0.35).normalize();
        this.skyU.sunDir.value.copy(dir);
        this.sunDir = night > 0.5 ? V3(-Math.cos(ang) * 0.5, 0.85, 0.35).normalize() : dir;
        if (!this.shadows) { this.sun.position.copy(this.sunDir).multiplyScalar(60); this.sun.target.position.set(0, 0, 0); }
        this.sun.color.copy(sunCol);
        this.sun.intensity = alive ? 0.7 + sunK * 2.2 : 0.7;
        this.hemi.intensity = 0.45 + amb * 1.05;
        this.hemi.color.copy(hor).lerp(new THREE.Color(0xffffff), 0.4);
        this.scene.fog.color.copy(hor).multiplyScalar(alive ? 0.85 : 0.9);
        this.moon.position.copy(V3(-Math.cos(ang), 0.5, -0.6).normalize().multiplyScalar(300));
        this.moon.material.opacity = alive ? night : 0.3;
        for (const nm of this.nightMats) nm.mat.emissiveIntensity = nm.day + (nm.night - nm.day) * night * (alive ? 1 : 0.2);
        for (const sp of this.lampSprites || []) sp.material.opacity = night * 0.85 * (alive ? 1 : 0.2);
        this.fireflies.material.opacity = night * 0.9 * (alive ? 1 : 0);
        for (const c of this.clouds) { c.material.color.copy(hor).lerp(new THREE.Color(0xffffff), 0.5 * (1 - night)); c.material.opacity = 0.35 + (1 - night) * 0.2; }
        this.fireGlow.material.opacity = 0.5 + night * 0.5;
        this.fireLight.intensity = 3 + night * 8;
        this.forgeLight.intensity = 4 + night * 8;
        this.dead = !alive;
    }

    update(t, dt) {
        this.t = t;
        for (const a of this.anim) a.update(t, dt);
        for (const c of this.clouds) { c.userData.a += dt * 0.003; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; }
        if (this.fireLight) this.fireLight.intensity *= 0.9 + Math.random() * 0.2;
        // shadows follow the camera target
        if (this.shadows && this.focus && this.sunDir) {
            this.sun.target.position.copy(this.focus);
            this.sun.position.copy(this.focus).addScaledVector(this.sunDir, 70);
        }
    }
}
