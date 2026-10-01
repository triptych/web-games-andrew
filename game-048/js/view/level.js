/**
 * level.js — the 3D floor: instanced floor tiles and walls (cut away near the
 * hero), pillars, animated liquids, props, decor, glowing decor, torches,
 * doors, stairs, objects (chests, braziers, shrines, fountains, people, traps)
 * and items on the floor. Everything level-bound reads the fog-of-war texture.
 */

import * as THREE from 'three';
import { scene, pool, POOL_SIZE, lantern } from './scene.js';
import { surface, glowTexture } from './textures.js';
import { fow, initFow, updateFow, patchFow, FOW_GLSL } from './fow.js';
import { kit, G, buildProp, buildDecor, buildGlow, buildItem, RARITY_COLORS } from './models.js';
import { T, TP, DIRS8 } from '../sim/tiles.js';
import { WORLDS } from '../sim/worlds.js';
import { buildHumanoid } from './actors.js';

export const WALL_H = 1.25;
const view = { root: null, lv: null, look: null, doors: [], objs: new Map(), items: new Map(), flames: [], spots: [], stairs: null, mats: [], liquids: [] };
export const levelView = view;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

function trackMat(m) { view.mats.push(m); return m; }

export function disposeLevel() {
    if (!view.root) return;
    scene.remove(view.root);
    view.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    for (const m of view.mats) m.dispose();
    view.mats = []; view.doors = []; view.objs.clear(); view.items.clear(); view.flames = []; view.spots = []; view.liquids = [];
    view.root = null;
}

const bodyMat = () => trackMat(patchFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 })));
const glowMat = (k = 2.4) => trackMat(patchFow(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(k, k, k) })));

export function buildLevelView(run) {
    disposeLevel();
    const lv = run.lv;
    const W = WORLDS[lv.world];
    const look = W.look;
    view.lv = lv; view.look = look;
    view.root = new THREE.Group();
    scene.add(view.root);
    initFow(lv.w, lv.h);
    const tile = (x, y) => (x < 0 || y < 0 || x >= lv.w || y >= lv.h ? T.WALL : lv.tiles[y * lv.w + x]);

    // ---- Floor
    const fs = surface(look.floor);
    const floorMat = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: fs.map, bumpMap: fs.bump, bumpScale: 1.4, roughness: look.floor === 'ice' ? 0.35 : 0.92, metalness: 0.02, color: look.floor === 'ice' ? 0x9ab4c8 : 0xffffff })));
    const iceMat = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: surface('ice').map, bumpMap: surface('ice').bump, bumpScale: 0.8, roughness: 0.25, metalness: 0.15, color: 0x9ab8cc })));
    const plankMat = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: surface('wood').map, roughness: 0.8 })));
    const floorTiles = [], iceTiles = [], plankTiles = [];
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        const t = tile(x, y);
        if (t === T.WALL || t === T.DEEP || t === T.LAVA || t === T.CHASM) continue;
        (t === T.ICE ? iceTiles : t === T.BRIDGE ? plankTiles : floorTiles).push([x, y, t]);
    }
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mkFloor = (list, mat, tintFn) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(plane, mat, list.length);
        im.receiveShadow = true;
        list.forEach(([x, y, t], i) => {
            const rot = ((x * 7 + y * 13) % 4) * Math.PI / 2;
            _m.compose(_p.set(x, 0, y), _q.setFromAxisAngle(_s.set(0, 1, 0), rot), _s.set(1, 1, 1));
            im.setMatrixAt(i, _m);
            im.setColorAt(i, tintFn(x, y, t));
        });
        view.root.add(im);
    };
    const nearWall = (x, y) => { let n = 0; for (const [dx, dy] of DIRS8) if (tile(x + dx, y + dy) === T.WALL) n++; return n; };
    const moss = new THREE.Color(look.particles === 'spores' ? 0x6aa080 : 0x6a8a4a);
    mkFloor(floorTiles, floorMat, (x, y, t) => {
        const v = 0.86 + ((x * 31 + y * 17) % 9) * 0.03 - nearWall(x, y) * 0.035;
        _c.setRGB(v, v, v);
        if (t === T.MOSS) _c.lerp(moss, 0.45);
        if (t === T.RUBBLE) _c.multiplyScalar(0.8);
        return _c;
    });
    mkFloor(iceTiles, iceMat, () => _c.setRGB(1, 1, 1));
    mkFloor(plankTiles, plankMat, () => _c.setRGB(0.9, 0.8, 0.7));

    // ---- Walls (only those that border something walkable) and pillars
    const ws = surface(look.wall);
    const side = patchFow(new THREE.MeshStandardMaterial({ map: ws.map, bumpMap: ws.bump, bumpScale: 2.2, roughness: 0.9 }), { cut: true });
    const top = patchFow(new THREE.MeshStandardMaterial({ map: ws.map, color: 0x6a6a6a, roughness: 1 }), { cut: true });
    trackMat(side); trackMat(top);
    const wallGeo = new THREE.BoxGeometry(1, WALL_H, 1).translate(0, WALL_H / 2, 0);
    const walls = [];
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        if (tile(x, y) !== T.WALL) continue;
        let edge = false;
        for (const [dx, dy] of DIRS8) if (tile(x + dx, y + dy) !== T.WALL) { edge = true; break; }
        if (edge) walls.push([x, y]);
    }
    const wim = new THREE.InstancedMesh(wallGeo, [side, side, top, top, side, side], walls.length);
    wim.castShadow = true; wim.receiveShadow = true;
    walls.forEach(([x, y], i) => {
        _m.makeTranslation(x, 0, y);
        wim.setMatrixAt(i, _m);
        const v = 0.82 + ((x * 13 + y * 7) % 7) * 0.035;
        wim.setColorAt(i, _c.setRGB(v, v, v));
    });
    view.root.add(wim);
    const pillars = [];
    for (let i = 0; i < lv.tiles.length; i++) if (lv.tiles[i] === T.PILLAR) pillars.push([i % lv.w, (i / lv.w) | 0]);
    if (pillars.length) {
        const pg = new THREE.CylinderGeometry(0.3, 0.36, WALL_H * 1.1, 12).translate(0, WALL_H * 0.55, 0);
        const pm = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: ws.map, bumpMap: ws.bump, bumpScale: 2, roughness: 0.85 }), { cut: true }));
        const pim = new THREE.InstancedMesh(pg, pm, pillars.length);
        pim.castShadow = true;
        pillars.forEach(([x, y], i) => { _m.makeTranslation(x, 0, y); pim.setMatrixAt(i, _m); });
        view.root.add(pim);
        const cap = new THREE.BoxGeometry(0.86, 0.14, 0.86).translate(0, WALL_H * 1.1, 0);
        const cim = new THREE.InstancedMesh(cap, pm, pillars.length);
        pillars.forEach(([x, y], i) => { _m.makeTranslation(x, 0, y); cim.setMatrixAt(i, _m); });
        view.root.add(cim);
    }

    // ---- Liquids
    buildLiquid(lv, T.SHALLOW, 0, 0.035, look.liquid, 0x9ad8ff, 0.72);
    buildLiquid(lv, T.DEEP, 0, -0.08, darker(look.liquid, 0.5), look.liquid, 0.95);
    buildLiquid(lv, T.LAVA, 1, -0.05, 0x8a1a02, 0xffb030, 1);
    buildLiquid(lv, T.CHASM, 2, -0.02, darker(look.bg === 0 ? 0x0a0614 : look.bg, 1.6), look.accent, 1);

    // ---- Props, decor, glows (instanced per kind × variant)
    const accent = look.accent;
    instanceGroups(lv.props, (k, v) => buildProp(k, accent, v * 97 + 3), 2, true);
    instanceGroups(lv.decor, (k, v) => buildDecor(k, accent, v * 31 + 7), 3, false);
    const glows = lv.lights.filter((l) => l.k === 'glow');
    instanceGroups(glows.map((l) => ({ x: l.x, y: l.y, k: l.g, r: (l.x * 37 + l.y * 11) % 360 })), (k, v) => buildGlow(k, accent, v * 53 + 1), 2, false);

    // ---- Torches
    const flameTex = glowTexture();
    for (const l of lv.lights) {
        if (l.k !== 'torch') continue;
        const x = l.wx + (l.x - l.wx) * 0.44, z = l.wy + (l.y - l.wy) * 0.44;
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const k = kit().add(G.box, 0x2a2a2a, { y: 0.95, sx: 0.08, sy: 0.3, sz: 0.08 }).add(G.cone, 0x3a3a3a, { y: 1.12, sx: 0.16, sy: 0.12, sz: 0.16, rx: Math.PI }).bake();
        g.add(new THREE.Mesh(k.body, bodyMatShared()));
        addFlame(g, 1.24, look.torch, 0.42, flameTex);
        view.root.add(g);
        g.userData.tile = l.y * lv.w + l.x;
    }

    // ---- Doors and stairs
    view.doors = [];
    const wood = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: surface('wood').map, roughness: 0.75 })));
    const metal = trackMat(patchFow(new THREE.MeshStandardMaterial({ map: surface('metal').map, roughness: 0.4, metalness: 0.7, color: 0xb0a080 })));
    for (let i = 0; i < lv.tiles.length; i++) {
        const t = lv.tiles[i];
        if (t !== T.DOOR && t !== T.DOOR_OPEN && t !== T.VAULT_DOOR) continue;
        const x = i % lv.w, y = (i / lv.w) | 0;
        const ns = tile(x - 1, y) === T.WALL && tile(x + 1, y) === T.WALL; // walls east-west → door spans x
        const hinge = new THREE.Group();
        hinge.position.set(x - (ns ? 0.5 : 0), 0, y - (ns ? 0 : 0.5));
        hinge.rotation.y = ns ? 0 : -Math.PI / 2;
        const vault = t === T.VAULT_DOOR;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_H * 0.92, 0.14), vault ? metal : wood);
        slab.position.set(0.5, WALL_H * 0.46, 0);
        slab.castShadow = true;
        hinge.add(slab);
        if (vault) {
            const rune = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 20), glowMatShared(0xffd040));
            rune.position.set(0.5, WALL_H * 0.5, 0.08);
            hinge.add(rune);
        } else {
            const band = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.07, 0.16), metal);
            band.position.set(0.5, WALL_H * 0.25, 0); hinge.add(band);
            const band2 = band.clone(); band2.position.y = WALL_H * 0.7; hinge.add(band2);
        }
        view.root.add(hinge);
        view.doors.push({ i, hinge, ang: 0, ns, vault, slab });
    }
    buildStairs(lv, look);

    // Spots for the light pool: lights, lava, stairs.
    view.spots = [];
    for (const l of lv.lights) view.spots.push({ x: l.x, y: l.y, src: l, col: l.k === 'torch' ? look.torch : l.k === 'brazier' ? 0xff9a40 : look.accent, r: l.r, h: l.k === 'torch' ? 1.2 : 0.8 });
    for (let i = 0; i < lv.tiles.length; i++) {
        const x = i % lv.w, y = (i / lv.w) | 0;
        if (lv.tiles[i] === T.LAVA && x % 3 === 0 && y % 3 === 0) view.spots.push({ x, y, col: 0xff5010, r: 3, h: 0.5 });
    }
    view.objs.clear(); view.items.clear();
    updateFow(run._t.vis, lv.seen, 0, true);
}

const darker = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };

let sharedBody = null, sharedGlow = new Map();
function bodyMatShared() { if (!sharedBody) sharedBody = patchFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); return sharedBody; }
function glowMatShared(col) {
    if (!sharedGlow.has(col)) { const c = new THREE.Color(col).multiplyScalar(2.6); sharedGlow.set(col, patchFow(new THREE.MeshBasicMaterial({ color: c }))); }
    return sharedGlow.get(col);
}
let vcGlow = null;
function vertexGlowMat() { if (!vcGlow) vcGlow = patchFow(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) })); return vcGlow; }

/** Group entries by kind, build `variants` models per kind and instance them. */
function instanceGroups(list, build, variants, shadows) {
    const byKey = new Map();
    for (const d of list) {
        const v = ((d.x * 7 + d.y * 3) % variants);
        const key = d.k + '|' + v;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(d);
    }
    for (const [key, items] of byKey) {
        const [k, v] = key.split('|');
        const { body, glow } = build(k, +v);
        for (const [geo, mat] of [[body, bodyMatShared()], [glow, vertexGlowMat()]]) {
            if (!geo) continue;
            const im = new THREE.InstancedMesh(geo, mat, items.length);
            if (shadows && mat !== vcGlow) { im.castShadow = true; }
            items.forEach((d, i) => {
                _m.compose(_p.set(d.x, 0, d.y), _q.setFromAxisAngle(_s.set(0, 1, 0), ((d.r || (d.x * 53 + d.y * 29)) % 360) * Math.PI / 180), _s.set(1, 1, 1));
                im.setMatrixAt(i, _m);
            });
            view.root.add(im);
        }
    }
}

function addFlame(group, h, color, size, tex) {
    const sm = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(1.15), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const sp = new THREE.Sprite(sm);
    sp.position.y = h;
    sp.scale.set(size, size * 1.3, 1);
    group.add(sp);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0xfff0d0).multiplyScalar(1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    core.position.y = h - 0.02; core.scale.set(size * 0.35, size * 0.5, 1);
    group.add(core);
    view.mats.push(sm, core.material);
    view.flames.push({ sp, core, base: size, phase: Math.random() * 10, group });
    return sp;
}

function buildLiquid(lv, type, kind, y, colA, colB, alpha) {
    const pos = [];
    for (let i = 0; i < lv.tiles.length; i++) {
        if (lv.tiles[i] !== type) continue;
        const x = i % lv.w, z = (i / lv.w) | 0;
        pos.push(x - 0.5, y, z - 0.5, x - 0.5, y, z + 0.5, x + 0.5, y, z + 0.5, x - 0.5, y, z - 0.5, x + 0.5, y, z + 0.5, x + 0.5, y, z - 0.5);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = trackMat(new THREE.ShaderMaterial({
        transparent: alpha < 1, depthWrite: alpha >= 1,
        uniforms: { ...fowUniformRefs(), uKind: { value: kind }, uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) }, uAlpha: { value: alpha } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `
            varying vec3 vW; uniform float uTime, uKind, uAlpha; uniform vec3 uColA, uColB;
            ${FOW_GLSL}
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
            void main() {
                float fv = fowAt(vW.xz);
                float seen = smoothstep(0.02, 0.3, fv), vis = smoothstep(0.42, 0.95, fv);
                vec2 p = vW.xz;
                vec3 col;
                if (uKind < 0.5) {
                    float w = n(p * 2.1 + vec2(uTime * 0.31, uTime * 0.17)) * 0.6 + n(p * 4.7 - uTime * 0.23) * 0.4;
                    col = mix(uColA, uColB * 0.6, w * w);
                    col += pow(max(0.0, w - 0.25), 5.0) * 1.6 * uColB;
                } else if (uKind < 1.5) {
                    float w = n(p * 1.4 + uTime * 0.12) * 0.55 + n(p * 3.9 - vec2(uTime * 0.09, -uTime * 0.21)) * 0.45;
                    float hot = smoothstep(0.35, 0.85, w);
                    col = mix(uColA, uColB, hot) * (1.2 + 2.2 * hot * hot);
                } else {
                    float w = n(p * 5.0 + uTime * 0.04);
                    col = uColA * (0.25 + 0.6 * w * w);
                    col += step(0.992, h(floor(p * 9.0) + floor(uTime * 0.7))) * uColB * 1.5;
                }
                vec3 mem = vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(0.3, 0.34, 0.48) * 0.5;
                gl_FragColor = vec4(mix(mem, col, vis) * seen, uAlpha);
            }`,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = alpha < 1 ? 2 : 0;
    view.root.add(mesh);
    view.liquids.push(mat);
}

function fowUniformRefs() { return { uFow: fow.uniforms.uFow, uFowSize: fow.uniforms.uFowSize, uTime: fow.uniforms.uTime }; }

function buildStairs(lv, look) {
    const g = new THREE.Group();
    const stone = bodyMatShared();
    // Up
    const up = kit();
    // A short flight rising against the tile's north edge (the hero arrives standing in front of it).
    for (let k = 0; k < 3; k++) up.add(G.box, 0x5a5650, { x: 0, y: 0.05 + k * 0.05, z: -0.12 - k * 0.13, sx: 0.8, sy: 0.1 + k * 0.1, sz: 0.14 });
    up.add(G.box, 0x3a3630, { x: -0.44, y: 0.2, z: -0.25, sx: 0.08, sy: 0.4, sz: 0.5 }).add(G.box, 0x3a3630, { x: 0.44, y: 0.2, z: -0.25, sx: 0.08, sy: 0.4, sz: 0.5 });
    const ub = up.bake();
    const upMesh = new THREE.Mesh(ub.body, stone);
    upMesh.position.set(lv.start.x, 0, lv.start.y);
    g.add(upMesh);
    // Down: a dark well with steps and a glowing rim.
    const dn = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    hole.position.y = 0.012;
    dn.add(hole);
    const steps = kit();
    for (let k = 0; k < 3; k++) steps.add(G.box, 0x4a4640, { y: 0.015 - k * 0.0, z: -0.3 + k * 0.22, sx: 0.8 - k * 0.12, sy: 0.02, sz: 0.18 });
    dn.add(new THREE.Mesh(steps.bake().body, stone));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.accent).multiplyScalar(2.5) }));
    rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = 0.03;
    dn.add(rim);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.accent).multiplyScalar(0.5), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.25;
    dn.add(beam);
    dn.position.set(lv.down.x, 0, lv.down.y);
    g.add(dn);
    view.root.add(g);
    view.stairs = { dn, rim, beam };
}

// ------------------------------------------------------------------ Objects & items

function buildObj(o, look) {
    const g = new THREE.Group();
    const body = bodyMatShared();
    const add = (k) => { const b = k.bake(); if (b.body) g.add(Object.assign(new THREE.Mesh(b.body, body), { castShadow: true })); if (b.glow) g.add(new THREE.Mesh(b.glow, vertexGlowMat())); };
    switch (o.k) {
        case 'chest': {
            const gold = o.tier ? 0xd0a040 : 0x6a4424;
            add(kit().add(G.box, gold, { y: 0.2, sx: 0.7, sy: 0.4, sz: 0.48 }).add(G.box, 0x3a3a40, { y: 0.2, sx: 0.72, sy: 0.06, sz: 0.5 }).add(G.box, 0xffd060, { y: 0.32, z: 0.25, sx: 0.1, sy: 0.12, sz: 0.04, glow: true }));
            const lid = new THREE.Group();
            lid.position.set(0, 0.4, -0.24);
            const lb = kit().add(G.box, gold, { y: 0.06, z: 0.24, sx: 0.72, sy: 0.14, sz: 0.5 }).add(G.box, 0x3a3a40, { y: 0.06, z: 0.24, sx: 0.08, sy: 0.15, sz: 0.52 }).bake();
            lid.add(new THREE.Mesh(lb.body, body));
            g.add(lid);
            g.userData.lid = lid;
            if (o.tier) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })); s.position.y = 0.6; s.scale.set(1.2, 1.2, 1); g.add(s); }
            break;
        }
        case 'brazier': {
            add(kit().add(G.cyl, 0x2a2a2e, { y: 0.3, sx: 0.12, sy: 0.6, sz: 0.12 }).add(G.cone, 0x3a3a40, { y: 0.66, sx: 0.7, sy: 0.25, sz: 0.7, rx: Math.PI }).add(G.cyl, 0x2a2a2e, { y: 0.02, sx: 0.5, sy: 0.04, sz: 0.5 }));
            const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 10), glowMatShared(0xff5010));
            coals.position.y = 0.76; g.add(coals);
            const f = addFlame(g, 1.05, 0xff8a30, 0.9, glowTexture());
            g.userData.flame = f; g.userData.coals = coals;
            break;
        }
        case 'shrine': {
            add(kit().add(G.box, 0x8a8680, { y: 0.15, sx: 0.8, sy: 0.3, sz: 0.8 }).add(G.cyl, 0x9a968e, { y: 0.6, sx: 0.4, sy: 0.7, sz: 0.4 }).add(G.box, 0x9a968e, { y: 0.98, sx: 0.55, sy: 0.08, sz: 0.55 }));
            const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), glowMatShared(0xffe8a0));
            orb.position.y = 1.3; g.add(orb); g.userData.orb = orb;
            break;
        }
        case 'fountain': {
            add(kit().add(G.cyl, 0x7a7670, { y: 0.15, sx: 0.95, sy: 0.3, sz: 0.95 }).add(G.cyl, 0x8a8680, { y: 0.45, sx: 0.16, sy: 0.6, sz: 0.16 }).add(G.cyl, 0x8a8680, { y: 0.75, sx: 0.4, sy: 0.08, sz: 0.4 }));
            const water = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20), glowMatShared(0x4aa8ff));
            water.position.y = 0.29; g.add(water); g.userData.water = water;
            break;
        }
        case 'trap': {
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 6).rotateX(-Math.PI / 2), glowMatShared(0xff3030));
            ring.position.y = 0.02; g.add(ring);
            const inner = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6).rotateX(-Math.PI / 2), glowMatShared(0xff6020));
            inner.position.y = 0.021; g.add(inner);
            break;
        }
        case 'merchant': case 'npc': case 'captive': {
            const fig = buildHumanoid({ robe: o.k === 'merchant' ? 0x6a4a2a : o.k === 'captive' ? 0x5a6a8a : [0x4a5a3a, 0x5a3a4a, 0x3a4a6a, 0x6a5a3a][(o.look || 0) % 4], skin: 0xe0b890, hood: o.k !== 'captive', pack: o.k === 'merchant', seed: o.id });
            g.add(fig);
            g.userData.fig = fig;
            if (o.k === 'captive') { const c = buildProp('cage', 0x888888, 1); g.add(new THREE.Mesh(c.body, body)); }
            if (o.k === 'merchant') { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMatShared(0xffc060)); l.position.set(0.32, 0.75, 0.1); g.add(l); }
            const mark = makeMarker();
            mark.position.y = 1.55; g.add(mark); g.userData.mark = mark;
            break;
        }
    }
    g.position.set(o.x, 0, o.y);
    g.rotation.y = o.k === 'npc' || o.k === 'merchant' ? 0 : ((o.x * 31 + o.y * 17) % 4) * 0.25 - 0.4;
    return g;
}

function makeMarker() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 52px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000';
    ctx.strokeText('!', 32, 34);
    ctx.fillStyle = '#ffd040'; ctx.fillText('!', 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6), depthTest: false, transparent: true }));
    s.scale.set(0.45, 0.45, 1);
    s.renderOrder = 10;
    return s;
}

function buildItemMesh(fi) {
    const g = new THREE.Group();
    const b = buildItem(fi.it);
    if (b.body) g.add(new THREE.Mesh(b.body, bodyMatShared()));
    if (b.glow) g.add(new THREE.Mesh(b.glow, vertexGlowMat()));
    const r = fi.it.r || 0;
    if (r >= 1 || fi.it.k === 'page' || fi.it.k === 'key' || fi.it.k === 'heirloom') {
        const col = fi.it.k === 'page' || fi.it.k === 'heirloom' ? 0xffe0a0 : fi.it.k === 'key' ? 0xffd040 : RARITY_COLORS[r];
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 1.6, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.position.y = 0.8;
        g.add(beam);
        g.userData.beam = beam;
    }
    g.userData.bob = Math.random() * 6;
    g.position.set(fi.x + ((fi.id * 7) % 5 - 2) * 0.06, 0, fi.y + ((fi.id * 3) % 5 - 2) * 0.06);
    g.rotation.y = (fi.id * 1.7) % 6.28;
    return g;
}

// ------------------------------------------------------------------ Per frame

let poolTimer = 0;
export function updateLevelView(run, dt, time, heroPos) {
    const lv = run.lv;
    if (!view.root || view.lv !== lv) return;
    fow.uniforms.uTime.value = time;
    fow.uniforms.uHero.value.set(heroPos.x, heroPos.z);
    for (const m of view.liquids) m.uniforms.uTime.value = time;
    updateFow(run._t.vis, lv.seen, dt);
    const vis = run._t.vis, seen = lv.seen;

    // Doors swing to match their tiles.
    for (const d of view.doors) {
        const t = lv.tiles[d.i];
        const want = t === T.DOOR_OPEN ? (d.vault ? 1 : 1.45) : 0;
        d.ang += (want - d.ang) * Math.min(1, dt * 10);
        if (d.vault) d.slab.position.y = WALL_H * 0.46 - d.ang * WALL_H;
        else d.hinge.rotation.y = (d.ns ? 0 : -Math.PI / 2) + d.ang;
    }
    // Stairs: hidden until the Warden falls on arena floors.
    if (view.stairs) {
        const open = lv.tiles[lv.down.y * lv.w + lv.down.x] === T.STAIRS_DOWN;
        view.stairs.dn.visible = open;
        view.stairs.rim.rotation.z = Math.PI / 4 + time * 0.3;
        view.stairs.beam.material.opacity = 0.12 + Math.sin(time * 2) * 0.05;
    }
    // Flames flicker (torch flames only show once their wall has been seen).
    for (const f of view.flames) {
        if (f.group.userData.tile !== undefined) f.group.visible = !!seen[f.group.userData.tile];
        const k = 1 + Math.sin(time * 13 + f.phase) * 0.08 + Math.sin(time * 7.3 + f.phase * 2) * 0.07;
        f.sp.scale.set(f.base * k, f.base * 1.3 * (2 - k), 1);
    }

    // Objects.
    const W = lv.w;
    for (const o of run.objs) {
        let g = view.objs.get(o.id);
        if (o.gone) { if (g) { view.root.remove(g); view.objs.delete(o.id); } continue; }
        const i = o.y * W + o.x;
        if (o.k === 'trap' && o.hidden) { if (g) g.visible = false; continue; }
        if (!g) { g = buildObj(o, view.look); view.root.add(g); view.objs.set(o.id, g); }
        const person = o.k === 'npc' || o.k === 'merchant' || o.k === 'captive';
        g.visible = person ? !!vis[i] : !!seen[i];
        if (!g.visible) continue;
        const u = g.userData;
        if (u.lid) u.lid.rotation.x += ((o.open ? -1.9 : 0) - u.lid.rotation.x) * Math.min(1, dt * 8);
        if (u.flame) { u.flame.visible = !!o.lit; u.flame.parent.children.forEach((c) => { if (c.isSprite) c.visible = !!o.lit; }); u.coals.visible = !!o.lit; }
        if (u.orb) { u.orb.position.y = 1.3 + Math.sin(time * 2) * 0.08; u.orb.rotation.y = time; u.orb.visible = !o.used; }
        if (u.water) u.water.visible = !o.used;
        if (u.fig) { u.fig.position.y = Math.sin(time * 1.6 + o.id) * 0.015; u.fig.lookAt(heroPos.x, 0, heroPos.z); }
        if (u.mark) {
            const q = run.quests.find((q) => q.id === o.quest);
            const show = o.k === 'merchant' || o.k === 'captive' || (q && (q.state === 'offered' || (q.state === 'active' && q.kind === 'heirloom')));
            u.mark.visible = !!show;
            u.mark.position.y = 1.55 + Math.sin(time * 3) * 0.06;
        }
    }

    // Items.
    const live = new Set();
    for (const fi of run.items) {
        live.add(fi.id);
        let g = view.items.get(fi.id);
        if (!g) { g = buildItemMesh(fi); view.root.add(g); view.items.set(fi.id, g); }
        const i = fi.y * W + fi.x;
        g.visible = !!seen[i];
        if (!g.visible) continue;
        g.position.y = 0.04 + Math.sin(time * 2.2 + g.userData.bob) * 0.03;
        if (g.userData.beam) g.userData.beam.visible = !!vis[i];
    }
    for (const [id, g] of view.items) if (!live.has(id)) { view.root.remove(g); view.items.delete(id); }

    // Light pool: nearest seen sources get a real light; fade in/out to avoid pops.
    poolTimer -= dt;
    if (poolTimer <= 0) {
        poolTimer = 0.15;
        const cands = view.spots.filter((s) => (!s.src || s.src.on) && seen[s.y * W + s.x])
            .map((s) => ({ s, d: (s.x - heroPos.x) ** 2 + (s.y - heroPos.z) ** 2 }))
            .sort((a, b) => a.d - b.d).slice(0, POOL_SIZE);
        for (let k = 0; k < POOL_SIZE; k++) {
            const l = pool[k];
            const c = cands[k];
            if (!c) { l.userData.want = 0; continue; }
            if (l.userData.spot !== c.s) { l.userData.spot = c.s; l.intensity = 0; l.position.set(c.s.x, c.s.h, c.s.y); l.color.set(c.s.col); l.distance = c.s.r * 1.7 + 1; }
            l.userData.want = c.s.src && c.s.src.k === 'glow' ? 5 : 9;
        }
    }
    for (const l of pool) {
        const flick = l.userData.spot && l.userData.spot.src && l.userData.spot.src.k !== 'glow' ? 1 + Math.sin(time * 11 + l.position.x) * 0.08 + Math.sin(time * 17.3 + l.position.z) * 0.05 : 1;
        l.intensity += (l.userData.want * flick - l.intensity) * Math.min(1, dt * 6);
    }
}

export { lantern };
