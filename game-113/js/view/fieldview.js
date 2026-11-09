// The field: a map turned into a lit HD-2D diorama. Instanced textured blocks for the ground, walls, cliffs and houses;
// billboard trees and people; real 3D crystals, lamps, pillars, windmills and chests; animated water; motes in the air.
// The camera looks down at ~40° with a narrow lens and follows Lyra; the stage's tilt-shift blurs the near and far rows.

import * as THREE from 'three';
import { MAPS, TILES, tileAt, chestsOf } from '../sim/data/maps.js';
import { npcsOf } from '../sim/field.js';
import { CHARS } from '../sim/data/chars.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { THEMES, tileTexture, propPx, mkTex } from './tiles.js';
import { assetPx } from './assets.js';
import { shadowTexture, isMech } from './sprites.js';
import { Particles } from './fx.js';
import { drawMonster } from './monsters.js';
import { Px } from './pixel.js';
import { hash3 } from '../rng.js';

const PX = 1 / 16;            // world units per sprite pixel
const FLOOR_KINDS = new Set(['ground', 'ground2', 'path', 'dock', 'flowers', 'wheat']);

export class FieldView {
    constructor(lib) {
        this.lib = lib;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
        this.root = null;
        this.mapId = null;
        this.actors = new Map();
        this.trail = [];
        this.camT = new THREE.Vector3(12, 0, 8);
        this.shadowTex = shadowTexture();
        this.particles = new Particles(this.scene);
        this.shake = 0;
        this.time = 0;
        this.texCache = new Map();
        this.matCache = new Map();
        this.flashes = [];
    }

    // ------------------------------------------------------------------ building a map
    build(G) {
        if (this.root) { this.scene.remove(this.root); disposeTree(this.root); }
        for (const a of this.actors.values()) this.scene.remove(a.group);
        this.actors.clear();
        this.particles.clear();
        this.trail = [];
        const id = G.map, m = MAPS[id], T = THEMES[m.theme];
        this.mapId = id; this.theme = T; this.themeId = m.theme;
        const root = this.root = new THREE.Group();
        this.scene.add(root);
        this.scene.background = new THREE.Color(T.sky);
        this.scene.fog = new THREE.Fog(T.fog, 20, 60);
        this.W = m.rows[0].length; this.H = m.rows.length;

        // ---- light
        root.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
        const sun = this.sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]);
        sun.position.set(this.W / 2 - 7, 14, this.H / 2 + 9);
        sun.target.position.set(this.W / 2, 0, this.H / 2);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
        sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
        root.add(sun, sun.target);

        // ---- tiles
        const groups = new Map();                       // key → [matrix]
        const push = (key, x, y, z, sx = 1, sy = 1, sz = 1) => {
            if (!groups.has(key)) groups.set(key, []);
            const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
            groups.get(key).push(mtx);
        };
        this.lightSpots = [];
        this.props = [];
        this.windmills = [];
        this.chests = new Map();
        this.crystals = [];
        for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
            const ch = m.rows[y][x], t = TILES[ch], cx = x + 0.5, cz = y + 0.5;
            const v = Math.floor(hash3(x, y, 7) * 3);
            if (t.kind === 'void') continue;
            if (t.kind === 'cliff') {
                // only cliffs that border something visible
                let edge = false;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c2 = tileAt(m, x + dx, y + dy); if (c2 !== 'H' && c2 !== ' ') edge = true; }
                if (!edge) continue;
                // the row nearest the camera stays low, or it walls off the view
                const h = y >= this.H - 1 ? 0.35 : 2.6 + hash3(x, y, 3) * 0.8;
                push('cliff', cx, h / 2 - 0.5, cz, 1, h + 1, 1);
                continue;
            }
            if (t.kind === 'wall') { const h = 1.4 + hash3(x, y, 4) * 0.5; push('wall', cx, h / 2 - 0.5, cz, 1, h + 1, 1); continue; }
            if (t.kind === 'house') { push('house', cx, 0.9, cz, 1, 2.8, 1); push('roof', cx, 2.75, cz); continue; }
            if (t.kind === 'water') { push('bed', cx, -0.95, cz); push('water', cx, -0.22, cz); continue; }
            // everything else stands on a floor tile
            const fk = FLOOR_KINDS.has(t.kind) ? (t.kind === 'flowers' || t.kind === 'wheat' ? 'ground2' : t.kind) : 'ground';
            const vk = fk === 'ground' || fk === 'path' ? `${fk}${v % (fk === 'path' ? 2 : 3)}` : fk;
            push('floor:' + vk, cx, -0.25, cz, 1, 0.5, 1);
            this.addProp(t.kind, x, y, root, T, m);
        }
        const boxG = new THREE.BoxGeometry(1, 1, 1);
        for (const [key, list] of groups) {
            let geo = boxG, mat;
            if (key === 'roof') {
                geo = new THREE.ConeGeometry(0.76, 0.9, 4, 1); geo.rotateY(Math.PI / 4);
                mat = new THREE.MeshStandardMaterial({ map: this.tex(m.theme, 'roof'), roughness: 0.85, flatShading: true });
            } else if (key === 'water') {
                geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
                mat = this.waterMat = new THREE.MeshStandardMaterial({ map: this.waterTex(T), color: 0xffffff, transparent: true, opacity: 0.86, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(T.water).multiplyScalar(T.day ? 0.15 : 0.6), emissiveMap: this.waterTexCache });
            } else if (key === 'bed') {
                mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(T.water).multiplyScalar(0.35), roughness: 1 });
            } else if (key === 'wall' || key === 'cliff' || key === 'house') {
                const side = this.tex(m.theme, key), top = this.tex(m.theme, key === 'house' ? 'roof' : 'top');
                const sm = new THREE.MeshStandardMaterial({ map: side, roughness: 0.95 }), tm = new THREE.MeshStandardMaterial({ map: top, roughness: 0.95 });
                mat = [sm, sm, tm, sm, sm, sm];
            } else {
                const k = key.slice(6);
                const base = k.replace(/\d$/, ''), vv = +(k.match(/\d$/)?.[0] || 0);
                mat = new THREE.MeshStandardMaterial({ map: this.tex(m.theme, base, vv), roughness: 0.95 });
                if (T.glowSand && base === 'ground2') { mat.emissive = new THREE.Color(0x46d8c8); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.9; }
            }
            const im = new THREE.InstancedMesh(geo, mat, list.length);
            list.forEach((mtx, i) => im.setMatrixAt(i, mtx));
            im.castShadow = key !== 'water' && key !== 'bed' && !key.startsWith('floor');
            im.receiveShadow = key !== 'roof';
            root.add(im);
        }

        // ---- the lights that matter most get real point lights (a budget keeps the shader cheap)
        this.lightSpots.sort((a, b) => b.pri - a.pri);
        this.pointLights = [];
        for (const s of this.lightSpots.slice(0, 8)) {
            const L = new THREE.PointLight(s.color, s.i, s.d, 1.6);
            L.position.set(s.x, s.y, s.z);
            root.add(L);
            this.pointLights.push({ L, base: s.i, ph: Math.random() * 6 });
        }

        // ---- motes in the air
        this.moteT = 0;
        this.build3 = true;
    }

    tex(theme, kind, v = 0) {
        const key = theme + '|' + kind + '|' + v;
        if (!this.texCache.has(key)) this.texCache.set(key, tileTexture(theme, kind, v));
        return this.texCache.get(key);
    }
    waterTex(T) {
        const P = new Px(32, 32);
        const base = new THREE.Color(T.water);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const w = Math.sin((x + y * 0.5) * 0.4) + Math.sin((x * 0.7 - y) * 0.3);
            const k = w > 1.4 ? 1.6 : w > 0.6 ? 1.2 : w < -1.2 ? 0.75 : 1;
            const c = base.clone().multiplyScalar(k);
            P.set(x, y, [Math.min(255, c.r * 255), Math.min(255, c.g * 255), Math.min(255, c.b * 255)]);
        }
        for (let i = 0; i < 10; i++) P.set(Math.floor(hash3(i, 1) * 32), Math.floor(hash3(1, i) * 32), '#ffffff');
        const t = mkTex(P.toCanvas(), true);
        this.waterTexCache = t;
        return t;
    }

    addProp(kind, x, y, root, T, m) {
        const cx = x + 0.5, cz = y + 0.5;
        const lc = new THREE.Color(T.lightCol);
        const add = (o) => { root.add(o); return o; };
        const shadow = (s = 1) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false })); q.rotation.x = -Math.PI / 2; q.position.set(cx, 0.01, cz); add(q); };
        switch (kind) {
            case 'tree': case 'coral': {
                const pk = kind === 'coral' ? 'coral' : T.tree;
                const P = this.propCache(pk, this.themeId);
                const s = 0.95 + hash3(x, y, 9) * 0.25;
                const mesh = billboard(P.tex, P.w * PX * 1.1 * s, P.h * PX * 1.1 * s, { emissive: pk === 'shroom' ? 0.7 : 0.12 });
                mesh.position.set(cx + (hash3(x, y, 2) - 0.5) * 0.2, 0, cz);
                add(mesh); shadow(1.4);
                if (pk === 'shroom') this.lightSpots.push({ x: cx, y: 1.4, z: cz + 0.3, color: T.lightCol, i: 1.4, d: 4.5, pri: 1 });
                break;
            }
            case 'rock': {
                const g = new THREE.IcosahedronGeometry(0.42, 0);
                const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(T.wall).multiplyScalar(1.15), flatShading: true, roughness: 1 }));
                mesh.scale.set(1.1, 0.75, 1); mesh.position.set(cx, 0.25, cz); mesh.rotation.y = hash3(x, y) * 6;
                mesh.castShadow = mesh.receiveShadow = true; add(mesh);
                break;
            }
            case 'crystal': {
                const grp = new THREE.Group();
                const mat = new THREE.MeshStandardMaterial({ color: lc, emissive: lc, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
                for (let i = 0; i < 3; i++) {
                    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
                    c.scale.set(0.7, 2.4 - i * 0.6, 0.7);
                    c.position.set((i - 1) * 0.24, 0.55 - i * 0.12, (i % 2) * 0.15);
                    c.rotation.z = (i - 1) * 0.35;
                    grp.add(c);
                }
                grp.position.set(cx, 0, cz); add(grp);
                this.crystals.push(grp);
                this.lightSpots.push({ x: cx, y: 1.2, z: cz + 0.4, color: T.lightCol, i: 2.2, d: 5.5, pri: 2 });
                break;
            }
            case 'lamp': {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x3a2e2a, metalness: 0.6, roughness: 0.4 }));
                post.position.set(cx, 0.85, cz); post.castShadow = true; add(post);
                const glow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd38a).multiplyScalar(2.2), toneMapped: false }));
                glow.position.set(cx, 1.78, cz); add(glow);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x3a2e2a, metalness: 0.6 }));
                cap.position.set(cx, 2.0, cz); add(cap);
                this.lightSpots.push({ x: cx, y: 1.8, z: cz, color: 0xffc070, i: 3.0, d: 7, pri: 3 });
                break;
            }
            case 'pillar': {
                if (m === MAPS.aurelune && y === 8 && (x === 11 || x === 12)) {
                    if (x === 12) this.addStatue(root, 12, 8.5);
                    break;
                }
                const col = new THREE.Color(T.wall).lerp(new THREE.Color(0xffffff), 0.25);
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 2.3, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
                p.position.set(cx, 1.15, cz); p.castShadow = p.receiveShadow = true; add(p);
                const c = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
                c.position.set(cx, 2.38, cz); c.castShadow = true; add(c);
                break;
            }
            case 'barrel': {
                const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 }));
                b.position.set(cx, 0.4, cz); b.castShadow = true; add(b);
                for (const h of [0.15, 0.65]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 4, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5 })); r.rotation.x = Math.PI / 2; r.position.set(cx, h, cz); add(r); }
                break;
            }
            case 'snowbank': {
                const s = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 1 }));
                s.scale.set(1, 0.5, 1); s.position.set(cx, 0.05, cz); s.receiveShadow = s.castShadow = true; add(s);
                break;
            }
            case 'windmill': {
                const grp = new THREE.Group();
                const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 }));
                tower.position.y = 1.7; tower.castShadow = true; grp.add(tower);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xa84a3a, roughness: 0.8 }));
                cap.position.y = 3.85; cap.castShadow = true; grp.add(cap);
                const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a3a2a }));
                door.position.set(0, 0.35, 0.7); grp.add(door);
                const sails = new THREE.Group();
                for (let i = 0; i < 4; i++) {
                    const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
                    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
                    spar.position.y = 1.05; arm.add(spar);
                    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.03), new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 1 }));
                    cloth.position.set(0.3, 1.2, 0); cloth.castShadow = true; arm.add(cloth);
                    sails.add(arm);
                }
                sails.position.set(0, 3.2, 0.85); grp.add(sails);
                grp.position.set(cx, 0, cz); add(grp);
                this.windmills.push(sails);
                break;
            }
            case 'lift': {
                // the ring spans both lift tiles: build it once, from the left one
                if (tileAt(m, x - 1, y) === 'L') break;
                const grp = new THREE.Group();
                const gold = new THREE.MeshStandardMaterial({ color: 0xd8a83a, metalness: 0.8, roughness: 0.3 });
                const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 28), gold);
                ring.position.set(0, 1.4, 0); grp.add(ring);
                const inner = new THREE.Mesh(new THREE.CircleGeometry(0.92, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd38a).multiplyScalar(1.4), transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
                inner.position.set(0, 1.4, 0.01); grp.add(inner);
                const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 20), gold);
                plat.position.set(0, 0.12, 0.2); plat.receiveShadow = true; grp.add(plat);
                grp.position.set(x + 1, 0, cz); add(grp);
                this.liftGlow = inner;
                this.lightSpots.push({ x: x + 1, y: 1.6, z: cz + 0.8, color: 0xffd38a, i: 3.5, d: 7, pri: 4 });
                break;
            }
            case 'songcrystal': {
                const grp = new THREE.Group();
                const mat = new THREE.MeshStandardMaterial({ color: 0xffb3e0, emissive: new THREE.Color(0xff7ad0), emissiveIntensity: 2.0, roughness: 0.1, flatShading: true });
                const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), mat);
                g.scale.set(1, 1.6, 1); g.position.y = 1.2; grp.add(g);
                const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x8a8aa8, roughness: 0.7 }));
                base.position.y = 0.15; base.castShadow = true; grp.add(base);
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd3f0).multiplyScalar(1.6), toneMapped: false }));
                ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; grp.add(ring);
                grp.position.set(cx, 0, cz); add(grp);
                this.songCrystal = { grp, gem: g, ring };
                this.lightSpots.push({ x: cx, y: 1.3, z: cz + 0.5, color: 0xff9ae0, i: 3.2, d: 6.5, pri: 5 });
                break;
            }
            case 'chest': {
                const grp = new THREE.Group();
                const wood = new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.8, roughness: 0.3 });
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.5), wood); body.position.y = 0.21; body.castShadow = true; grp.add(body);
                const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.52), gold); band.position.y = 0.36; grp.add(band);
                const lid = new THREE.Group(); lid.position.set(0, 0.42, -0.25);
                const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.52), wood); lidM.position.set(0, 0.09, 0.25); lidM.castShadow = true; lid.add(lidM);
                const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.04), gold); lock.position.set(0, 0.02, 0.52); lid.add(lock);
                grp.add(lid);
                grp.position.set(cx, 0, cz); add(grp);
                this.chests.set(`${this.mapId}:${x},${y}`, { lid, open: 0, x: cx, z: cz });
                break;
            }
            case 'flowers': case 'wheat': {
                const P = this.propCache(kind, this.themeId);
                for (let i = 0; i < (kind === 'wheat' ? 3 : 2); i++) {
                    const s = kind === 'wheat' ? 1.25 : 1;
                    const b = billboard(P.tex, P.w * PX * s, P.h * PX * s, { emissive: 0.1 });
                    b.position.set(x + 0.2 + hash3(x, y, i) * 0.6, 0, y + 0.2 + i * 0.35);
                    add(b);
                    if (kind === 'wheat') this.props.push(b);
                }
                break;
            }
            default: break;
        }
        // tufts of grass on plain ground in the green places
        if (kind === 'ground' && (this.themeId === 'sunreach') && hash3(x, y, 21) < 0.35) {
            const P = this.propCache('grass', this.themeId);
            const b = billboard(P.tex, P.w * PX, P.h * PX, { emissive: 0.1 });
            b.position.set(x + 0.2 + hash3(x, y, 22) * 0.6, 0, y + 0.3 + hash3(x, y, 23) * 0.5);
            add(b);
        }
    }
    propCache(kind, theme) {
        const key = 'prop|' + kind + '|' + theme;
        return this.lib.raw(key, () => propPx(kind, theme));
    }
    addStatue(root, x, z) {
        const e = this.lib.raw('statue', () => assetPx('monster/colossus') || drawMonster('colossus'));
        const ped = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 }));
        ped.position.set(x, 0.3, z); ped.castShadow = ped.receiveShadow = true; root.add(ped);
        const b = billboard(e.tex, e.w * PX * 0.42 * 1.4, e.h * PX * 0.42 * 1.4, { emissive: 0.35, color: 0xd8c8a0 });
        b.position.set(x, 0.6, z); root.add(b);
    }

    // ------------------------------------------------------------------ actors
    actor(key) {
        let a = this.actors.get(key);
        if (!a) {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.18 });
            const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -0.22;
            group.add(mesh);
            const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
            sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; group.add(sh);
            this.scene.add(group);
            a = { group, mesh, mat, sh, tex: null, seen: 0, crystal: null, bob: 0, flash: 0, alpha: 1 };
            this.actors.set(key, a);
        }
        a.seen = this.frameNo;
        return a;
    }
    setSprite(a, e, scale = 1) {
        if (a.tex !== e.tex) { a.mat.map = e.tex; a.mat.emissiveMap = e.tex; a.mat.needsUpdate = a.tex === null; a.tex = e.tex; }
        a.mesh.scale.set(e.w * PX * scale * 0.8, e.h * PX * scale * 0.8, 1);
        a.sh.scale.set(e.w * PX * scale * 0.6, e.w * PX * scale * 0.3, 1);
    }
    crystalOn(a, on, color) {
        if (on && !a.crystal) {
            const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.2, flatShading: true, depthWrite: false, side: THREE.DoubleSide });
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 1.75, 6), mat);
            c.position.y = 0.88;
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.5, 6), mat); tip.position.y = 2.0;
            a.group.add(c, tip);
            a.crystal = [c, tip];
        } else if (!on && a.crystal) { for (const c of a.crystal) a.group.remove(c); a.crystal = null; }
    }

    viewOf(dir) { return dir === 'up' ? ['up', false] : dir === 'left' ? ['side', true] : dir === 'right' ? ['side', false] : ['down', false]; }

    // ------------------------------------------------------------------ per frame
    update(G, dt, time) {
        this.time = time;
        if (G.map !== this.mapId) this.build(G);
        this.frameNo = (this.frameNo || 0) + 1;
        const lib = this.lib, p = G.p;
        const frameOf = (walking) => (walking ? [1, 0, 3, 0][Math.floor(time * 7.5) % 4] : 0);

        // ---- the player, and the band walking behind her
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.06) {
            if (last && Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail = [];
            this.trail.push({ x: p.x, y: p.y, dir: p.dir });
            if (this.trail.length > 200) this.trail.shift();
        }
        if (!p.hidden) {
            const a = this.actor('player');
            const [view, flip] = this.viewOf(p.dir);
            this.setSprite(a, lib.person('lyra', p.pose === 'down' ? 'side' : view, frameOf(p.walking), p.pose, flip));
            a.group.position.set(p.x, 0, p.y);
            const following = G.party.members.filter((m) => m !== 'lyra');
            following.forEach((m, i) => {
                // walk the trail behind her; before there is one, stand beside her
                const f = this.trailPoint((i + 1) * 0.95) || { x: p.x + (i % 2 ? 0.8 : -0.8) * (1 + Math.floor(i / 2)), y: p.y + 0.6, dir: p.dir };
                const b = this.actor('f:' + m);
                const moving = p.walking;
                const [v2, fl2] = this.viewOf(f.dir);
                this.setSprite(b, lib.person(m, v2, frameOf(moving), null, fl2));
                b.group.position.lerp(new THREE.Vector3(f.x, 0, f.y), Math.min(1, dt * 12));
            });
        }

        // ---- the people on the map
        for (const n of npcsOf(G)) {
            if (G.actors[n.id]) continue;
            const a = this.actor('n:' + n.id);
            const [view, flip] = this.viewOf(n.dir || 'down');
            const lit = n.id !== 'otto' || G.flags.metOtto || G.otto_lit;
            this.setSprite(a, lib.person(n.id, n.mech && n.id === 'otto' ? (view === 'up' ? 'down' : view) : view, n.mech ? Math.floor(time * 1.5) % 2 : 0, null, flip, { lit: n.id !== 'otto' || this.ottoLit || G.flags.metOtto }));
            a.group.position.set(n.x, 0, n.y);
            // townsfolk turn to face the player when she is near
            if (!n.mech && Math.hypot(p.x - n.x, p.y - n.y) < 1.6) {
                const dx = p.x - n.x, dy = p.y - n.y;
                const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
                const [v2, f2] = this.viewOf(d);
                this.setSprite(a, lib.person(n.id, v2, 0, null, f2));
            }
            a.group.position.y = n.mech ? Math.abs(Math.sin(time * 2)) * 0.03 : 0;
        }

        // ---- actors placed by scenes
        for (const [id, s] of Object.entries(G.actors)) {
            if (s.hidden) continue;
            const a = this.actor('s:' + id);
            if (s.enemy) {
                const e = lib.monster(s.enemy, false);
                const big = s.big ? (ENEMIES[s.enemy]?.size || 5) * 0.55 : 1;
                this.setSprite(a, e, big * 0.85);
            } else {
                const who = s.char || s.npc || s.look || id;
                const [view, flip] = this.viewOf(s.dir || 'down');
                this.setSprite(a, lib.person(who, s.pose === 'hurt' ? 'side' : view, frameOf(s.walking), s.pose, s.pose === 'hurt' ? false : flip, { lit: this.ottoLit }));
            }
            a.group.position.set(s.x, 0, s.y);
            this.crystalOn(a, !!s.crystal, new THREE.Color(s.char === 'lyra' ? 0xffa8d8 : this.theme.lightCol));
            if (s.enemy && s.big) a.group.position.y = Math.sin(time * 1.4) * 0.06;
        }

        // ---- roaming monsters
        for (const e of G.field.enemies) {
            const key = 'e:' + e.id;
            if (!e.alive) { if (this.actors.has(key)) { const a = this.actors.get(key); this.scene.remove(a.group); this.actors.delete(key); } continue; }
            const a = this.actor(key);
            this.setSprite(a, lib.monster(e.kind, e.dir === 'right'), 0.62);
            const hop = e.walking ? Math.abs(Math.sin(time * 9 + e.id)) * 0.12 : Math.sin(time * 2 + e.id) * 0.03;
            a.group.position.set(e.x, Math.max(0, hop), e.y);
            a.mat.emissiveIntensity = e.chasing ? 0.45 + Math.sin(time * 20) * 0.15 : 0.2;
        }

        // ---- forget actors that weren't drawn this frame
        for (const [k, a] of this.actors) if (a.seen !== this.frameNo) { this.scene.remove(a.group); this.actors.delete(k); }

        // ---- props
        for (const [id, c] of this.chests) {
            const target = G.opened[id] ? 1 : 0;
            c.open += (target - c.open) * Math.min(1, dt * 6);
            c.lid.rotation.x = -c.open * 1.9;
        }
        const turning = G.flags.hollowhayBeaten || this.windmillsOn;
        for (const s of this.windmills) s.rotation.z += dt * (turning ? 1.4 : 0.02);
        for (const c of this.crystals) c.rotation.y = Math.sin(time * 0.5 + c.position.x) * 0.15;
        if (this.songCrystal) { this.songCrystal.gem.rotation.y = time * 1.4; this.songCrystal.gem.position.y = 1.2 + Math.sin(time * 2) * 0.08; this.songCrystal.ring.rotation.z = time; }
        if (this.liftGlow) this.liftGlow.material.opacity = 0.25 + Math.sin(time * 2) * 0.1;
        for (const b of this.props) b.rotation.z = Math.sin(time * 1.6 + b.position.x * 0.7) * 0.06;
        for (const pl of this.pointLights) pl.L.intensity = pl.base * (0.9 + Math.sin(time * 2.3 + pl.ph) * 0.06 + Math.sin(time * 7.1 + pl.ph) * 0.03);
        if (this.waterTexCache) { this.waterTexCache.offset.x = time * 0.03; this.waterTexCache.offset.y = Math.sin(time * 0.4) * 0.05; }

        // ---- motes
        this.moteT -= dt;
        if (this.moteT <= 0) {
            this.moteT = this.theme.snow ? 0.03 : 0.12;
            const c = this.camT;
            if (this.theme.snow) this.particles.emit(c.x + (Math.random() - 0.5) * 18, 7, c.z + (Math.random() - 0.5) * 14, { n: 1, color: 0xffffff, vel: [0.3, -0.9, 0], spread: 0.4, life: 7, size: 0.09, gravity: 0, drag: 0 });
            else this.particles.emit(c.x + (Math.random() - 0.5) * 16, 0.3 + Math.random() * 2.5, c.z + (Math.random() - 0.5) * 10, { n: 1, color: this.theme.motes, vel: [0.1, 0.2, 0], spread: 0.3, life: 4, size: this.theme.day ? 0.05 : 0.09, gravity: -0.02, drag: 0.2 });
        }
        this.particles.update(dt);

        // ---- camera
        const cam = G.cam;
        const tx = cam ? cam.x : p.x, tz = cam ? cam.y : p.y;
        const zoom = cam?.zoom || 1;
        const k = Math.min(1, dt * (cam ? 2.5 : 5));
        this.camT.x += (tx - this.camT.x) * k;
        this.camT.z += (tz - this.camT.z) * k;
        this.zoom = (this.zoom || 1) + (zoom - (this.zoom || 1)) * Math.min(1, dt * 2.5);
        const asp = this.camera.aspect;
        const far = Math.max(1.12, Math.min(2.3, 1.45 / asp)) / this.zoom;
        // keep the diorama's edges in frame without showing the void beyond
        const hw = Math.min(this.W / 2, 6.5 * far * Math.max(1, asp / 1.6));
        const cx = Math.max(hw - 0.5, Math.min(this.W - hw + 0.5, this.camT.x));
        const cz = Math.max(3.2, Math.min(this.H - 2.6, this.camT.z));
        const sh = this.shake > 0 ? this.shake : 0;
        this.shake = Math.max(0, this.shake - dt * 2.4);
        this.camera.position.set(cx + (Math.random() - 0.5) * sh * 0.3, 8.6 * far, cz + 10.2 * far + (Math.random() - 0.5) * sh * 0.3);
        this.camera.lookAt(cx, 0.4, cz + 0.4);
        const dist = this.camera.position.distanceTo(new THREE.Vector3(cx, 0, cz));
        this.scene.fog.near = dist + (this.theme.day ? 6 : 1.5);
        this.scene.fog.far = dist + (this.theme.day ? 34 : 20);
        this.sun.position.set(cx - 7, 14, cz + 9); this.sun.target.position.set(cx, 0, cz);
    }

    trailPoint(dist) {
        let d = 0;
        const t = this.trail;
        for (let i = t.length - 1; i > 0; i--) {
            d += Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y);
            if (d >= dist) return t[i - 1];
        }
        return null;
    }

    /** World position of an actor (for effects): 'player', a scene actor id, an npc id. */
    posOf(G, id) {
        if (id === 'player') return new THREE.Vector3(G.p.x, 1, G.p.y);
        const s = G.actors[id];
        if (s) return new THREE.Vector3(s.x, s.big ? 2 : 1, s.y);
        const n = npcsOf(G).find((x) => x.id === id);
        if (n) return new THREE.Vector3(n.x, 1, n.y);
        return new THREE.Vector3(this.camT.x, 1, this.camT.z);
    }

    onEvents(G, events, stage) {
        for (const e of events) {
            if (e.type === 'map') this.build(G);
            else if (e.type === 'chest') this.particles.emit(e.x + 0.5, 0.7, e.y + 0.5, { n: 40, color: 0xffd35c, speed: 3, life: 1, size: 0.14, gravity: 3, lift: 2 });
            else if (e.type === 'crystal') { this.particles.emit(e.x, 1.2, e.y, { n: 60, color: 0xff9ae0, speed: 3.5, life: 1.2, size: 0.15, gravity: -0.5 }); stage.flash(1, 0.8, 0.95, 0.35); }
            else if (e.type === 'fx') this.fx(G, e.name, e.args || {}, stage);
            else if (e.type === 'join') { const v = this.posOf(G, 'player'); this.particles.emit(v.x, 1, v.z, { n: 60, color: CHARS[e.who].color, speed: 3, life: 1.2, size: 0.15, gravity: -0.4 }); }
        }
    }

    fx(G, name, a, stage) {
        const P = this.particles;
        const at = (id) => this.posOf(G, id);
        switch (name) {
            case 'rumble': this.shake = 0.9; break;
            case 'quake': this.shake = 1.4; break;
            case 'clash': {
                const pa = at(a.a), pb = at(a.b), m = pa.clone().lerp(pb, 0.5);
                P.emit(m.x, 1.2, m.z, { n: a.big ? 70 : 35, color: 0xfff0b0, speed: 5, life: 0.5, size: 0.13, gravity: 4 });
                stage.flash(1, 1, 0.9, a.big ? 0.5 : 0.25); this.shake = a.big ? 0.8 : 0.4;
                break;
            }
            case 'emerge': case 'dragon': {
                const v = name === 'dragon' ? new THREE.Vector3(11.5, 2, 2) : at(a.id);
                P.emit(v.x, 1, v.z + 0.3, { n: 90, color: 0x9a5aff, speed: 2.5, life: 1.4, size: 0.3, gravity: -0.8, box: 1.2 });
                this.shake = name === 'dragon' ? 1.3 : 0.5;
                if (name === 'dragon') stage.flash(0.3, 0.1, 0.5, 0.6);
                break;
            }
            case 'hushwave': {
                const v = new THREE.Vector3(this.camT.x, 0.5, this.camT.z);
                for (let i = 0; i < 80; i++) { const ang = (i / 80) * Math.PI * 2; P.emit(v.x, 0.4, v.z, { n: 1, color: 0x7a3aff, vel: [Math.cos(ang) * 7, 0.3, Math.sin(ang) * 7], spread: 0.2, life: 1.0, size: 0.3, gravity: 0, drag: 0.8 }); }
                stage.flash(0.15, 0.05, 0.25, 0.7); this.shake = 0.9;
                break;
            }
            case 'crack': { const v = at(a.id); P.emit(v.x, 1.5, v.z + 0.6, { n: 25, color: 0xffd0f0, speed: 2, life: 0.6, size: 0.1 }); this.shake = 0.3; break; }
            case 'shatter': { const v = at(a.id); P.emit(v.x, 1.4, v.z + 0.4, { n: 120, color: 0xffb8e0, speed: 5, life: 1.3, size: 0.16, gravity: 6, box: 0.8 }); stage.flash(1, 0.85, 0.95, 0.6); this.shake = 0.6; break; }
            case 'fall': { const v = at(a.id); P.emit(v.x, 1, v.z, { n: 50, color: 0x7ff6ff, speed: 1, life: 1.2, size: 0.18, gravity: 5 }); break; }
            case 'vanish': { const v = at(a.id); P.emit(v.x, 1.6, v.z + 0.3, { n: 110, color: 0xd8b8ff, speed: 3, life: 1.4, size: 0.22, gravity: -1, box: 1.5 }); stage.flash(1, 1, 1, 0.4); break; }
            case 'seal': { const v = at('player'); for (let i = 0; i < 60; i++) { const ang = (i / 60) * Math.PI * 2; P.emit(v.x, 1.2, v.z, { n: 1, color: 0xffd35c, vel: [Math.cos(ang) * 4, 1.5, Math.sin(ang) * 4], spread: 0.3, life: 1.2, size: 0.18, gravity: 0, drag: 1 }); } stage.flash(1, 0.9, 0.5, 0.45); break; }
            case 'windmills': this.windmillsOn = true; break;
            case 'ottoBoot': this.ottoLit = true; { const v = at('otto'); P.emit(v.x, 1.1, v.z + 0.4, { n: 40, color: 0x7ff6ff, speed: 2, life: 0.9, size: 0.14 }); } stage.flash(0.6, 1, 1, 0.25); break;
            case 'give': { const v = at('player'); P.emit(v.x, 1.4, v.z, { n: 40, color: 0xff6fa6, speed: 2, life: 1, size: 0.14, gravity: -0.5 }); break; }
            case 'ottoLeave': break;
            case 'dragonFall': stage.flash(1, 1, 1, 1); this.shake = 1.5; break;
            default: break;
        }
    }

    resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.particles.setScale(h); }
}

/** An upright billboard on its own bottom edge. */
export function billboard(tex, w, h, o = {}) {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, emissive: o.color ?? 0xffffff, emissiveMap: tex, emissiveIntensity: o.emissive ?? 0.15, color: o.color ?? 0xffffff });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -0.22;
    return m;
}

function disposeTree(o) {
    o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) for (const m of [].concat(c.material)) m.dispose();
    });
}
