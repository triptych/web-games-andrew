/**
 * view.js — mirrors the simulation into the three.js scene.
 *
 * Each frame: create/remove actors to match the world's units, monsters,
 * projectiles and pickups; place and animate them; draw statuses (frozen,
 * stunned, burning, elite auras, boss wards); keep instanced HP bars and blob
 * shadows; and turn the world's events into effects. Also answers picking
 * questions for input (which slot, unit, orb or lane is under the pointer).
 */

import * as THREE from 'three';
import {
    LANES, LANE_W, laneZ, cellX, wallSlotX, FIELD_END, TOWER_TIERS, UNITS, ARCH, AFFIXES, DMG_TYPES,
    RARITIES, POWERS, localWave, REGIONS, isLongNight,
} from '../config.js';
import { scene, setLook, requestShadows, shake, punch, screenToGround, worldToScreen } from './scene.js';
import { makeUnit, makeMonster, animateRig, obstacleModel, Parts, GLOW_MAT } from './models.js';
import { buildTerrain } from './terrain.js';
import { buildCastle, slotY } from './castle.js';
import * as fx from './fx.js';

const V = {
    world: null, terrain: null, castle: null, castleKey: '', regionIdx: -1,
    units: new Map(), enemies: new Map(), projs: new Map(), orbs: new Map(),
    dying: [], vines: [], t: 0, tod: 0, quality: 2, highlight: null, ghost: null, selRing: null,
    telegraphs: [], beaconT: 0, wallSmokeT: 0, onEvent: null,
};

// ------------------------------------------------------------------ Instanced bars & shadows

const MAXI = 260;
let shadows, barBg, barFg, hlMesh, hoverMesh;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function initInstanced() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.3)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), MAXI);
    shadows.renderOrder = 1;
    shadows.frustumCulled = false;
    scene.add(shadows);
    const bg = new THREE.PlaneGeometry(1, 1);
    barBg = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0x140c0c, transparent: true, opacity: 0.8, depthTest: false, toneMapped: false }), MAXI);
    barFg = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, toneMapped: false }), MAXI);
    barFg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXI * 3), 3);
    barBg.renderOrder = 20; barFg.renderOrder = 21;
    barBg.frustumCulled = barFg.frustumCulled = false;
    scene.add(barBg, barFg);
    hlMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, LANE_W * 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 64);
    hlMesh.count = 0; hlMesh.renderOrder = 2; hlMesh.frustumCulled = false;
    scene.add(hlMesh);
    hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, LANE_W * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    hoverMesh.visible = false; hoverMesh.renderOrder = 3;
    scene.add(hoverMesh);
    V.selRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    V.selRing.visible = false; V.selRing.renderOrder = 3;
    scene.add(V.selRing);
}

// ------------------------------------------------------------------ Init / region

export function initView(world, quality, onEvent) {
    V.quality = quality;
    V.onEvent = onEvent;
    if (!shadows) initInstanced();
    setWorld(world);
}

/** Swap in a (new or restored) world: rebuild everything. */
export function setWorld(world) {
    V.world = world;
    for (const a of V.units.values()) scene.remove(a.rig.root);
    for (const a of V.enemies.values()) scene.remove(a.rig.root);
    for (const t of V.telegraphs) scene.remove(t.mesh);
    for (const v of V.vines) scene.remove(v.mesh);
    V.telegraphs.length = 0; V.vines.length = 0;
    fx.clearNumbers();
    for (const p of V.projs.values()) fx.removeObj(p);
    for (const o of V.orbs.values()) scene.remove(o);
    for (const d of V.dying) scene.remove(d.root);
    V.units.clear(); V.enemies.clear(); V.projs.clear(); V.orbs.clear(); V.dying.length = 0;
    V.regionIdx = -1;
    V.castleKey = '';
    syncRegion(world, true);
}

function syncRegion(w, force) {
    if (!force && w.regionIdx === V.regionIdx) return;
    V.regionIdx = w.regionIdx;
    if (V.terrain) { scene.remove(V.terrain.group); V.terrain.dispose(); }
    V.terrain = buildTerrain(w.regionIdx, w.seed, w.obstacles, obstacleModel);
    scene.add(V.terrain.group);
    V.terrain.setBailey(w.castle.bailey);
    fx.setWeather(REGIONS[w.regionIdx].weather, V.quality);
    V.castleKey = '';
    syncCastle(w);
    applyLook(w);
}

export function applyLook(w) {
    V.tod = (localWave(w.wave) - 1) / 9;
    setLook(w.regionIdx, V.tod, isLongNight(w.wave));
    requestShadows();
}

function castleKey(c) { return JSON.stringify(c); }

function syncCastle(w, burstDust = false) {
    const key = castleKey(w.castle) + ':' + w.regionIdx;
    if (key === V.castleKey) return;
    const old = V.castle;
    V.castle = buildCastle(w.castle, w.regionIdx);
    scene.add(V.castle.group);
    if (old) { scene.remove(old.group); old.dispose(); }
    V.castleKey = key;
    V.terrain?.setBailey(w.castle.bailey);
    requestShadows();
    if (burstDust) {
        for (let lane = 0; lane < LANES; lane++) fx.burst('dust', -0.6, 0.4, laneZ(lane), 6, { scale: 1.5 });
        fx.burst('dust', -4.4, 1.5, 0, 14, { scale: 2 });
    }
}

// ------------------------------------------------------------------ Slots and positions

export function slotPos(w, s, out = new THREE.Vector3()) {
    if (s.kind === 'wall') return out.set(wallSlotX(s.tier), slotY(w.castle, s.tier), laneZ(s.lane));
    return out.set(cellX(s.col), 0.02, laneZ(s.lane));
}
const unitSlot = (u) => (u.kind === 'wall' ? { kind: 'wall', lane: u.lane, tier: u.tier } : { kind: 'field', lane: u.lane, col: u.col });

// ------------------------------------------------------------------ Actors

function levelRingColor(lv) { return lv >= 10 ? '#ffd24a' : lv >= 6 ? '#4aa8ff' : lv >= 3 ? '#6aff6a' : '#d8d0c0'; }

const UNIT_SCALE = 1.18, MONSTER_SCALE = 1.12;
function makeUnitActor(u) {
    const rig = makeUnit(u.type);
    rig.inner.scale.setScalar(UNIT_SCALE);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: levelRingColor(u.level), transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
    ring.position.y = 0.03;
    rig.root.add(ring);
    const stars = new THREE.Group();
    rig.root.add(stars);
    scene.add(rig.root);
    return { rig, ring, lv: u.level, stars, t: Math.random() * 10, hitF: 0 };
}

function makeEnemyActor(w, e) {
    const sp = w.speciesById[e.species];
    const rig = makeMonster(sp);
    const scale = (e.boss ? e.size * 0.55 : e.size * (sp.plan === 'biped' ? (sp.params.h ?? 1) : 1)) * MONSTER_SCALE;
    rig.root.scale.setScalar(scale);
    rig.scale = scale;
    let aura = null;
    if (e.elite) {
        aura = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: AFFIXES[e.elite[0]].color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        aura.position.y = 0.04 / scale;
        rig.root.add(aura);
        rig.mat.emissive.set(AFFIXES[e.elite[0]].color).multiplyScalar(0.18);
        rig.baseEmissive = rig.mat.emissive.clone();
    }
    scene.add(rig.root);
    const a = { rig, sp, aura, t: Math.random() * 10, ice: null, ward: null, lastX: e.x, flee: false, shieldShown: true };
    return a;
}

let iceGeo = null;
function iceBlock(scale) {
    if (!iceGeo) { const P = new Parts(9); P.add('ico', '#bff0ff', [0, 0.4, 0], [0.42, 0.5, 0.42], [0, 0, 0], { rough: 0.05 }); iceGeo = P.build().solid; }
    const m = new THREE.Mesh(iceGeo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, flatShading: true, depthWrite: false, emissive: new THREE.Color(0x0a2a4a) }));
    m.scale.set(1, Math.max(0.6, scale), 1);
    return m;
}

// ------------------------------------------------------------------ Orbs

function makeOrb(o) {
    const g = new THREE.Group();
    const color = o.kind === 'mote' ? '#ffd24a' : POWERS[o.power].color;
    const P = new Parts(2);
    if (o.kind === 'mote') {
        P.add('oct', '#ffe680', [0, 0, 0], [0.13, 0.2, 0.13], [0, 0, 0], { glow: true });
        P.sph('#fff6c8', [0, 0, 0], [0.07, 0.07, 0.07], [0, 0, 0], { glow: true });
    } else {
        P.sph(color, [0, 0, 0], [0.15, 0.15, 0.15], [0, 0, 0], { glow: true });
        P.add('ring', RARITIES[o.rarity].color, [0, 0, 0], [0.24, 0.24, 0.24], [Math.PI / 2, 0, 0], { glow: true });
        P.add('ring', RARITIES[o.rarity].color, [0, 0, 0], [0.24, 0.24, 0.24], [0, 0, 0], { glow: true });
    }
    const b = P.build();
    const mat = GLOW_MAT.clone();
    mat.transparent = true;
    g.add(new THREE.Mesh(b.glow, mat));
    g.userData.mat = mat;
    scene.add(g);
    return g;
}

// ------------------------------------------------------------------ Per-frame sync

const DMG_FX = { fire: '#ff7a2a', frost: '#8fd8ff', shock: '#c9a8ff', holy: '#ffe680', phys: '#ffe8c8' };

export function updateView(w, dt, t) {
    V.t = t;
    syncRegion(w, false);
    syncCastle(w);
    V.terrain.update(t);
    let si = 0, bi = 0;
    const camQ = scene.userData.camQ;
    // ---- units
    const seenU = new Set();
    for (const u of w.units) {
        seenU.add(u.id);
        let a = V.units.get(u.id);
        if (!a) { a = makeUnitActor(u); V.units.set(u.id, a); }
        if (a.lv !== u.level) { a.lv = u.level; a.ring.material.color.set(levelRingColor(u.level)); }
        slotPos(w, unitSlot(u), a.rig.root.position);
        a.t += dt;
        animateRig(a.rig, { t: a.t, move: 0, atk: u.atkT > 0 ? u.atkT / 0.3 : 0 });
        // hit flash & stun
        const hf = u.hitT > 0.06 ? 0.45 : 0;
        a.rig.mat.emissive.setRGB(hf, hf * 0.15, hf * 0.1);
        a.rig.inner.rotation.y = u.stunT > 0 ? Math.sin(t * 20) * 0.08 : 0;
        if (u.stunT > 0 && Math.random() < dt * 6) fx.burst('magic', a.rig.root.position.x, a.rig.root.position.y + 1.0, a.rig.root.position.z, 1, { color: '#bff0ff' });
        if (u.shield > 0 && Math.random() < dt * 4) fx.burst('heal', a.rig.root.position.x, a.rig.root.position.y + 0.3, a.rig.root.position.z, 1, { color: '#ffe680' });
        if (u.kind === 'field') {
            setShadow(si++, a.rig.root.position.x, a.rig.root.position.z, 0.55);
            if (u.hp < u.maxHp - 0.5) setBar(bi++, a.rig.root.position.x, 1.05, a.rig.root.position.z, u.hp / u.maxHp, '#6aff6a', 0.5);
        }
    }
    for (const [id, a] of V.units) if (!seenU.has(id)) { scene.remove(a.rig.root); V.units.delete(id); }

    // ---- enemies
    const seenE = new Set();
    for (const e of w.enemies) {
        if (e.dead) continue;
        seenE.add(e.id);
        let a = V.enemies.get(e.id);
        if (!a) { a = makeEnemyActor(w, e); V.enemies.set(e.id, a); a.rig.root.position.set(e.x, e.y, e.z); }
        const r = a.rig.root;
        a.t += dt;
        const moving = e.state === 'walk' && !(e.frozenT > 0 || e.stunT > 0 || e.rootT > 0);
        // Visual stagger so a crowd doesn't stack into one model.
        const jz = ((e.seed % 100) / 100 - 0.5) * 0.28 * (e.boss ? 0 : 1);
        r.position.set(e.x, e.burrowed ? -0.9 : e.y + (e.fly ? Math.sin(a.t * 3) * 0.06 : 0), e.z + jz);
        if (e.sub > 0) r.position.y = -0.8;
        if (e.boss === 'lich') r.position.y += 0.15 + Math.sin(a.t * 2) * 0.05;
        const facing = e.dir > 0 ? 0 : Math.PI;
        r.rotation.y += (facing - r.rotation.y) * Math.min(1, dt * 8);
        if (!(e.frozenT > 0)) animateRig(a.rig, { t: a.t, move: moving ? 1 : 0, atk: e.atkAnim > 0 ? Math.min(1, e.atkAnim / 0.35) : 0, fly: e.fly });
        // flashes
        // A short, soft flash at the start of each hit (sustained fire must not wash the model out).
        const hf = e.hitT > 0.07 ? 0.32 : 0;
        if (hf) a.rig.mat.emissive.setRGB(hf, hf * 0.85, hf * 0.7);
        else if (a.rig.baseEmissive) a.rig.mat.emissive.copy(a.rig.baseEmissive);
        else if (e.burnT > 0) a.rig.mat.emissive.setRGB(0.35, 0.1, 0);
        else if (e.slowT > 0) a.rig.mat.emissive.setRGB(0.05, 0.15, 0.3);
        else a.rig.mat.emissive.setRGB(0, 0, 0);
        if (e.invuln > 0 || e.burrowed) a.rig.mat.opacity = 0.5; else a.rig.mat.opacity = a.rig.mat.transparent ? 0.88 : 1;
        // frozen block
        if (e.frozenT > 0 && !a.ice) { a.ice = iceBlock(a.rig.height); r.add(a.ice); }
        if (!(e.frozenT > 0) && a.ice) { r.remove(a.ice); a.ice = null; fx.burst('frost', e.x, 0.5, e.z, 8); }
        // boss ward bubble
        if (e.ward > 0 && !a.ward) {
            a.ward = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 12), new THREE.MeshBasicMaterial({ color: 0x8aff8a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
            a.ward.position.y = 1;
            r.add(a.ward);
        }
        if (!(e.ward > 0) && a.ward) { r.remove(a.ward); a.ward = null; }
        if (e.burnT > 0 && Math.random() < dt * 10) fx.burst('fire', e.x, e.y + 0.4 * a.rig.scale, e.z, 1, { scale: 0.6 });
        if (e.rootT > 0 && Math.random() < dt * 5) fx.burst('leaf', e.x, 0.2, e.z, 1);
        if (e.stunT > 0 && Math.random() < dt * 6) fx.burst('spark', e.x, e.y + a.rig.height * a.rig.scale + 0.1, e.z, 1, { color: '#fff6a0' });
        if (e.burrowed && Math.random() < dt * 14) fx.burst('dust', e.x, 0.05, e.z, 1, { color: '#8a7a5a', scale: 0.7 });
        if (a.aura) a.aura.rotation.y = a.t * 2;
        if (!e.burrowed) setShadow(si++, e.x, e.z, 0.5 * a.rig.scale * (e.fly ? 0.7 : 1));
        if (!e.boss && e.hp < e.maxHp - 0.5 && !e.burrowed) {
            const hh = (a.rig.height * a.rig.scale) + e.y + 0.2;
            setBar(bi++, e.x, hh, e.z, e.hp / e.maxHp, e.elite ? '#ffb02a' : '#ff4a3a', 0.45 * Math.min(1.6, a.rig.scale + 0.2));
            if (e.shield > 0) setBar(bi++, e.x, hh + 0.09, e.z, e.shield / Math.max(1, e.shieldMax), '#a8c8ff', 0.45);
        }
        // boss specials
        if (e.boss === 'lich' && e.drain) {
            const ua = V.units.get(e.drain.uid);
            if (ua) fx.beam([{ x: e.x, y: 1.4, z: e.z }, { x: ua.rig.root.position.x, y: ua.rig.root.position.y + 0.5, z: ua.rig.root.position.z }], '#8aff8a', 0.06, 0.06);
        }
        if (e.boss === 'dragon' && e.breath && e.breath.t > 0) {
            if (Math.random() < 0.5) fx.burst('fire', e.x - 0.8, 1.2 + e.y * 0.3, e.z, 1, { scale: 0.8 });
        }
    }
    for (const [id, a] of V.enemies) if (!seenE.has(id)) {
        // Killed (handled by 'kill' event → dying) or escaped.
        if (!a.dyingStarted) { scene.remove(a.rig.root); }
        V.enemies.delete(id);
    }
    // ---- dying
    for (let i = V.dying.length - 1; i >= 0; i--) {
        const d = V.dying[i];
        d.t += dt;
        const k = d.t / 0.7;
        d.root.rotation.z = Math.min(1.4, k * 2.2) * d.dir;
        d.root.position.y = d.y0 - k * 0.5;
        d.mat.transparent = true;
        d.mat.opacity = Math.max(0, 1 - k);
        if (k >= 1) { scene.remove(d.root); V.dying.splice(i, 1); }
    }

    // ---- projectiles
    const seenP = new Set();
    for (const p of w.projectiles) {
        seenP.add(p.id);
        let m = V.projs.get(p.id);
        if (!m) { m = fx.makeProjectile(p.kind, p.from); V.projs.set(p.id, m); m.userData.px = p.x; m.userData.py = p.y; }
        const vx = p.x - m.userData.px, vy = p.y - m.userData.py;
        m.position.set(p.x, p.y, p.z);
        const k = m.userData.kind;
        if (k === 'barrel' || k === 'boulder' || k === 'axe') { m.rotation.z += dt * (k === 'axe' ? -14 : -6); m.rotation.x += dt * 3; }
        else if (Math.abs(vx) + Math.abs(vy) > 1e-5) m.rotation.z = Math.atan2(vy, vx);
        if (k === 'earrow' || k === 'hex' || k === 'acid') m.rotation.y = 0;
        m.userData.px = p.x; m.userData.py = p.y;
        if (k === 'fireball' && Math.random() < 0.5) fx.burst('fire', p.x, p.y, p.z, 1, { scale: 0.7 });
        if (k === 'ice' && Math.random() < 0.3) fx.burst('frost', p.x, p.y, p.z, 1);
        if (k === 'holy' && Math.random() < 0.6) fx.burst('magic', p.x, p.y, p.z, 1, { color: '#ffe680' });
        if (k === 'barrel' && Math.random() < 0.5) fx.burst('spark', p.x, p.y + 0.15, p.z, 1);
        if (k === 'acid' && Math.random() < 0.5) fx.burst('goo', p.x, p.y, p.z, 1, { color: '#8aff3a' });
        if (k === 'hex' && Math.random() < 0.6) fx.burst('magic', p.x, p.y, p.z, 1, { color: '#ff6a2a' });
    }
    for (const [id, m] of V.projs) if (!seenP.has(id)) { fx.removeObj(m); V.projs.delete(id); }

    // ---- orbs
    const seenO = new Set();
    for (const o of w.orbs) {
        seenO.add(o.id);
        let m = V.orbs.get(o.id);
        if (!m) { m = makeOrb(o); V.orbs.set(o.id, m); }
        const bob = Math.sin(t * 3 + o.id) * 0.06;
        m.position.set(o.x, o.y + 0.15 + bob, o.z);
        m.rotation.y = t * 2;
        const s = 1 + Math.sin(t * 6) * 0.08;
        m.scale.setScalar(s);
        const fade = o.life - o.t < 2.5 ? (Math.sin(t * 18) > 0 ? 1 : 0.3) : 1;
        m.userData.mat.opacity = fade;
        if (Math.random() < dt * 4) fx.burst(o.kind === 'mote' ? 'gold' : 'magic', o.x, o.y + 0.15, o.z, 1, { color: o.kind === 'mote' ? '#ffd24a' : POWERS[o.power].color });
    }
    for (const [id, m] of V.orbs) if (!seenO.has(id)) { scene.remove(m); V.orbs.delete(id); }

    // ---- zones
    for (const z of w.zones) {
        if (z.kind === 'burn' && Math.random() < dt * 12) fx.burst('fire', z.x + (Math.random() - 0.5) * 0.8, 0.05, z.z + (Math.random() - 0.5) * 0.6, 1, { scale: 0.8 });
        if (z.kind === 'meteor') {
            const k = z.t / z.dur;
            const y = 7 * (1 - k), x = z.x + 3 * (1 - k);
            fx.burst('fire', x, y, z.z, 3, { scale: 1.6 });
            fx.burst('smoke', x, y, z.z, 1);
        }
        if (z.kind === 'arrows') for (let i = 0; i < 3; i++) fx.burst('spark', 0.5 + Math.random() * 9.5, 0.1, z.z + (Math.random() - 0.5) * 0.8, 1, { color: '#e8dcc0' });
        if (z.kind === 'keepfire') {
            const sx = (z.t / z.dur) * (FIELD_END + 0.5);
            fx.burst('fire', sx, 0.2, z.z + (Math.random() - 0.5) * 0.7, 6, { scale: 2.2 });
            fx.burst('smoke', sx - 0.5, 0.8, z.z, 1, { scale: 1.5 });
            if (Math.random() < 0.3) fx.flash(sx, 0.8, z.z, '#ff8a2a', 8, 0.25, 5);
        }
    }

    // ---- castle atmosphere: beacon flame, forge smoke, wall damage
    if (V.castle) {
        const kfReady = w.castle.keepfire > 0;
        V.beaconT += dt;
        if (kfReady && V.beaconT > 0.05) {
            V.beaconT = 0;
            const b = V.castle.beacon;
            fx.burst('fire', b.x, b.y, b.z, w.kf >= 100 ? 3 : 1, { scale: w.kf >= 100 ? 1.4 : 0.8 });
            if (w.kf >= 100 && Math.random() < 0.3) fx.burst('ember', b.x, b.y + 0.2, b.z, 1);
        }
        if (V.castle.forge && Math.random() < dt * 3) fx.burst('smoke', V.castle.forge.x, V.castle.forge.y, V.castle.forge.z, 1, { scale: 0.7 });
        if (w.phase === 'wave') {
            const f = w.wallHp / w.wallMax;
            V.wallSmokeT += dt;
            if (f < 0.5 && V.wallSmokeT > (f < 0.25 ? 0.08 : 0.2)) {
                V.wallSmokeT = 0;
                const z = (Math.random() - 0.5) * LANES * LANE_W;
                fx.burst('smoke', -0.2, V.castle.wallH, z, 1, { scale: 1.2 });
                if (f < 0.25) fx.burst('fire', -0.2, V.castle.wallH * 0.8, z, 2);
            }
        }
    }

    // ---- telegraphs (dragon breath lane)
    for (let i = V.telegraphs.length - 1; i >= 0; i--) {
        const tg = V.telegraphs[i];
        tg.t += dt;
        tg.mesh.material.opacity = 0.25 + 0.25 * Math.sin(tg.t * 18);
        if (tg.t > tg.life) { scene.remove(tg.mesh); V.telegraphs.splice(i, 1); }
    }
    for (let i = V.vines.length - 1; i >= 0; i--) {
        const vn = V.vines[i];
        vn.t += dt;
        const k = vn.t < 0.2 ? vn.t / 0.2 : vn.t > vn.life - 0.3 ? Math.max(0, (vn.life - vn.t) / 0.3) : 1;
        vn.mesh.scale.set(1, k, 1);
        if (vn.t > vn.life) { scene.remove(vn.mesh); V.vines.splice(i, 1); }
    }

    // ---- instanced counts
    shadows.count = si;
    shadows.instanceMatrix.needsUpdate = true;
    barBg.count = barFg.count = bi;
    barBg.instanceMatrix.needsUpdate = true;
    barFg.instanceMatrix.needsUpdate = true;
    barFg.instanceColor.needsUpdate = true;
    hlMesh.material.opacity = 0.22 + 0.14 * Math.sin(t * 5);
    if (V.selRing.visible) V.selRing.rotation.y = t;
    fx.updateFx(dt, t);
}

function setShadow(i, x, z, r) {
    if (i >= MAXI) return;
    _m4.compose(_p.set(x, 0.025, z), _q.identity(), _s.set(r * 2, 1, r * 2));
    shadows.setMatrixAt(i, _m4);
}

let _camQ = new THREE.Quaternion();
export function setCameraQuat(q) { _camQ.copy(q); }
function setBar(i, x, y, z, frac, color, w) {
    if (i >= MAXI - 1) return;
    _m4.compose(_p.set(x, y, z), _camQ, _s.set(w, 0.06, 1));
    barBg.setMatrixAt(i, _m4);
    const f = Math.max(0, Math.min(1, frac));
    // Shift the fill left so it shrinks toward its left edge (in camera space).
    const off = new THREE.Vector3(-(1 - f) * w * 0.5, 0, 0.001).applyQuaternion(_camQ);
    _m4.compose(_p.set(x + off.x, y + off.y, z + off.z), _camQ, _s.set(Math.max(0.001, w * f), 0.045, 1));
    barFg.setMatrixAt(i, _m4);
    barFg.setColorAt(i, _c.set(color));
}

// ------------------------------------------------------------------ Events → effects

export function onEvents(w, events) {
    // Per-frame budgets keep big fights readable (and stop additive particles from blowing out).
    let hitFx = 0, nums = 0, goldNums = 0;
    const crits = events.filter((e) => e.type === 'hit' && e.crit).length;
    for (const e of events) {
        switch (e.type) {
            case 'region': V.regionIdx = -1; syncRegion(w, true); break;
            case 'prep': applyLook(w); break;
            case 'castle': syncCastle(w, true); break;
            case 'hit': {
                if (e.amt <= 0) break;
                if (hitFx++ < 18) fx.burst(e.dtype === 'fire' ? 'fire' : e.dtype === 'frost' ? 'frost' : 'spark', e.x, e.y + 0.45, e.z, e.crit ? 4 : 2, { color: DMG_FX[e.dtype] });
                // Crits always get a number (up to 6); plain hits only while there's room.
                if (e.crit ? nums < 6 : nums < 6 - Math.min(4, crits)) { nums++; fx.floatText(e.x, e.y + 0.9, e.z, fmt(e.amt), (e.crit ? 'crit ' : '') + 'dmg-' + e.dtype); }
                break;
            }
            case 'kill': {
                const a = V.enemies.get(e.id);
                const sp = w.speciesById[e.species];
                if (a) {
                    a.dyingStarted = true;
                    if (a.ice) a.rig.root.remove(a.ice);
                    V.dying.push({ root: a.rig.root, mat: a.rig.mat, t: 0, y0: a.rig.root.position.y, dir: Math.random() < 0.5 ? 1 : -1 });
                    V.enemies.delete(e.id);
                }
                const goo = sp?.params?.skin ?? '#6a9a3a';
                if (hitFx++ < 30) {
                    fx.burst(sp?.undead || sp?.params?.skeleton ? 'debris' : 'goo', e.x, e.y + 0.4, e.z, e.boss ? 40 : 8, { color: sp?.params?.skeleton ? '#e8e0c8' : goo });
                    fx.burst('gold', e.x, e.y + 0.5, e.z, Math.min(6, 2 + Math.round(e.gold / 15)));
                }
                if (goldNums++ < 4) fx.floatText(e.x, e.y + 1.1, e.z, `+${fmt(e.gold)}`, 'gold');
                if (e.boss) { shake(0.9); fx.ring(e.x, 0, e.z, 5, '#ffd24a', 1); fx.flash(e.x, 1.5, e.z, '#ffd24a', 14, 1.2, 9); fx.burst('fire', e.x, 1, e.z, 40, { scale: 2 }); }
                break;
            }
            case 'shieldHit': { const a = V.enemies.get(e.id); if (a) fx.burst('spark', a.rig.root.position.x - 0.2, 0.5, a.rig.root.position.z, 2, { color: '#c8d8ff' }); break; }
            case 'shieldBreak': { const a = V.enemies.get(e.id); if (a) { fx.burst('debris', a.rig.root.position.x, 0.5, a.rig.root.position.z, 10, { color: '#8a8a94' }); fx.floatText(a.rig.root.position.x, 1.2, a.rig.root.position.z, 'BROKEN', 'info'); } break; }
            case 'explode': {
                const big = e.r > 1.55;
                const kind = e.kind;
                if (kind === 'frost') fx.burst('frost', e.x, e.y, e.z, 14);
                else if (kind === 'acid') fx.burst('goo', e.x, e.y, e.z, 14, { color: '#8aff3a' });
                else if (kind === 'boulder') { fx.burst('debris', e.x, e.y, e.z, 14, { color: '#7a7470' }); fx.burst('dust', e.x, e.y, e.z, 8); }
                else if (kind === 'axe') fx.burst('spark', e.x, e.y, e.z, 8);
                else {
                    fx.burst('fire', e.x, e.y, e.z, big ? 22 : 7, { scale: big ? 1.6 : 0.9 });
                    if (big || (kind === 'barrel' && Math.random() < 0.5)) fx.burst('smoke', e.x, e.y + 0.2, e.z, big ? 5 : 1, { scale: big ? 1.4 : 1 });
                    fx.burst('spark', e.x, e.y, e.z, big ? 12 : 4);
                    if (big || kind === 'barrel' || kind === 'meteor') fx.flash(e.x, 0.7, e.z, '#ff9a4a', big ? 9 : 5, 0.35, big ? 5 : 3.5);
                }
                fx.ring(e.x, 0, e.z, e.r, kind === 'frost' ? '#8fd8ff' : '#ffb06a', 0.4);
                if (kind === 'meteor') shake(0.5); else if (kind === 'sapper') shake(0.18); else if (kind === 'barrel') shake(0.06); else if (big) shake(0.12);
                break;
            }
            case 'wallHit': fx.burst('dust', -0.05, 0.3 + Math.random() * 0.5, laneZ(e.lane) + (Math.random() - 0.5) * 0.6, 2, { color: '#8a8070' }); if (e.dmg > w.wallMax * 0.04) shake(0.12); break;
            case 'place': {
                const p = V.units.get(e.id)?.rig.root.position ?? new THREE.Vector3(e.x, 0, laneZ(e.lane));
                fx.burst('dust', p.x, p.y, p.z, 10, { scale: 1.2 });
                fx.ring(p.x, p.y, p.z, 0.7, '#ffe8a8', 0.5);
                break;
            }
            case 'upgrade': {
                const p = V.units.get(e.id)?.rig.root.position;
                if (p) { fx.burst('magic', p.x, p.y + 0.2, p.z, e.perk ? 30 : 14, { color: '#ffd24a' }); fx.ring(p.x, p.y, p.z, e.perk ? 1.4 : 0.8, '#ffd24a', 0.6); fx.floatText(p.x, p.y + 1.1, p.z, e.perk ? `PERK! Lv ${e.level}` : `Lv ${e.level}`, 'level'); }
                break;
            }
            case 'sell': fx.burst('gold', e.x, 0.6, laneZ(e.lane), 12); break;
            case 'unitDie': fx.burst('debris', e.x, 0.4, laneZ(e.lane), 12, { color: UNITS[e.unit].color }); fx.burst('dust', e.x, 0.1, laneZ(e.lane), 8); break;
            case 'brew': fx.burst('gold', e.x, 0.5, e.z, 6); fx.floatText(e.x, 1.0, e.z, `+${e.gold}`, 'gold'); break;
            case 'heal': { const p = V.units.get(e.id)?.rig.root.position; if (p) fx.burst('heal', p.x, p.y + 0.2, p.z, 6, { color: '#ffe680' }); break; }
            case 'repair': fx.burst('heal', -0.2, 0.8, laneZ(e.lane), 3, { color: '#ffe680' }); break;
            case 'root': for (const tg of e.targets) addVine(tg.x, tg.z); break;
            case 'chain': fx.beam(e.pts, '#d8c0ff', 0.25, 0.12); fx.beam(e.pts, '#ffffff', 0.12, 0.06); for (const p of e.pts.slice(1)) fx.burst('spark', p.x, p.y, p.z, 3, { color: '#c9a8ff' }); break;
            case 'strike': fx.beam([{ x: e.x + 0.5, y: 8, z: e.z }, { x: e.x, y: e.y + 0.3, z: e.z }], '#e0d0ff', 0.3, 0.3); fx.flash(e.x, 1.5, e.z, '#c9a8ff', 9, 0.25, 5); fx.burst('spark', e.x, e.y + 0.3, e.z, 8, { color: '#c9a8ff' }); break;
            case 'freeze': { const a = V.enemies.get(e.id); if (a) fx.burst('frost', a.rig.root.position.x, 0.5, a.rig.root.position.z, 10); break; }
            case 'leap': case 'land': { const a = V.enemies.get(e.id); if (a) fx.burst('dust', a.rig.root.position.x, 0.05, a.rig.root.position.z, 6); break; }
            case 'emerge': fx.burst('dust', e.x, 0.05, e.z, 16, { color: '#7a6a4a', scale: 1.4 }); fx.burst('debris', e.x, 0.1, e.z, 8, { color: '#5a4a3a' }); break;
            case 'sapper': fx.flash(e.x, 0.6, e.z, '#ffaa4a', 10, 0.4, 5); break;
            case 'collect': fx.burst(e.kind === 'mote' ? 'gold' : 'magic', e.x, e.y + 0.15, e.z, 14, { color: e.kind === 'mote' ? '#ffd24a' : POWERS[e.power].color }); fx.ring(e.x, 0.02, e.z, 0.6, '#ffe8a8', 0.35); break;
            case 'orbFade': break;
            case 'power': powerFx(w, e); break;
            case 'keepfire': { const b = V.castle?.beacon; if (b) { fx.burst('fire', b.x, b.y, b.z, 30, { scale: 2 }); fx.flash(b.x, b.y, b.z, '#ffaa4a', 12, 0.8, 8); } shake(0.35); punch(0.2); break; }
            case 'bossArrive': shake(0.4); break;
            case 'bossAct': bossFx(w, e); break;
            case 'phoenix': fx.burst('fire', -0.3, 1, 0, 60, { scale: 2 }); fx.ring(-0.2, 0, 0, 4, '#ffaa2a', 1); shake(0.5); break;
            case 'lost': shake(1); fx.burst('debris', -0.2, 0.8, 0, 50, { color: '#8a8070' }); fx.burst('smoke', -0.2, 0.8, 0, 30, { scale: 2 }); break;
            case 'waveClear': fx.burst('magic', -4.4, 3, 0, 40, { color: '#ffd24a' }); break;
            case 'shoot':
                if (e.unit === 'pyro') { const p = V.units.get(e.id)?.rig.root.position; if (p) fx.burst('fire', p.x + 0.2, p.y + 0.8, p.z, 3); }
                if (e.unit === 'ballista') { const p = V.units.get(e.id)?.rig.root.position; if (p) fx.burst('dust', p.x, p.y + 0.3, p.z, 3); }
                break;
            case 'ehealed': fx.burst('heal', e.x, 0.8, e.z, 10, { color: '#8aff6a' }); fx.ring(e.x, 0, e.z, 2.3, '#8aff6a', 0.6); break;
            case 'flee': { const a = V.enemies.get(e.id); if (a) fx.floatText(a.rig.root.position.x, 1.2, a.rig.root.position.z, 'Fleeing!', 'info'); break; }
            case 'escape': break;
            case 'immune': break;
        }
        V.onEvent?.(e);
    }
}

function powerFx(w, e) {
    switch (e.power) {
        case 'nova': for (const en of w.enemies) fx.burst('frost', en.x, 0.6, en.z, 6); fx.ring(4, 0, 0, 9, '#8fd8ff', 0.8); shake(0.25); break;
        case 'quake': shake(0.8); for (let i = 0; i < 30; i++) fx.burst('dust', Math.random() * 10, 0.05, (Math.random() - 0.5) * 6, 1, { scale: 1.6 }); break;
        case 'rally': for (const a of V.units.values()) { const p = a.rig.root.position; fx.ring(p.x, p.y, p.z, 0.8, '#ffd24a', 0.6); fx.burst('magic', p.x, p.y + 0.5, p.z, 6, { color: '#ffd24a' }); } break;
        case 'mend': for (let l = 0; l < LANES; l++) fx.burst('heal', -0.2, 0.6, laneZ(l), 10); for (const a of V.units.values()) fx.burst('heal', a.rig.root.position.x, a.rig.root.position.y + 0.2, a.rig.root.position.z, 5); break;
        case 'midas': for (const en of w.enemies) fx.burst('gold', en.x, 0.6, en.z, 4); break;
        case 'arrows': if (e.target) addTelegraph(e.target.lane, 4, '#e8dcc0'); break;
        case 'storm': fx.flash(4, 6, 0, '#c9a8ff', 4, 1.5, 20); break;
        case 'meteor': break;
    }
}

function bossFx(w, e) {
    const a = V.enemies.get(e.id);
    const p = a?.rig.root.position;
    switch (e.act) {
        case 'howl': case 'warcry': shake(0.3); if (p) fx.ring(p.x, 0, p.z, 3, '#ff6a4a', 0.7); break;
        case 'stomp': shake(0.7); fx.ring(e.x, 0, e.z, 2.6, '#ffb06a', 0.6); fx.burst('dust', e.x, 0.05, e.z, 30, { scale: 1.6 }); break;
        case 'lunge': if (p) fx.burst('dust', p.x, 0.05, p.z, 14); break;
        case 'submerge': case 'emerge': if (p) { fx.burst('goo', p.x, 0.2, p.z, 24, { color: '#4a6a3a' }); fx.ring(p.x, 0, p.z, 1.6, '#8aff6a', 0.5); } break;
        case 'spawn': case 'raise': case 'summon': if (p) fx.burst('magic', p.x, 0.6, p.z, 20, { color: e.act === 'raise' ? '#8aff8a' : '#ffaa4a' }); break;
        case 'freeze':
            for (const id of e.ids ?? []) { const u = V.units.get(id); if (u) { fx.burst('frost', u.rig.root.position.x, u.rig.root.position.y + 0.4, u.rig.root.position.z, 14); } }
            break;
        case 'icewall': if (p) fx.burst('frost', p.x - 1.5, 0.5, p.z, 20); break;
        case 'teleport': if (p) { fx.burst('magic', p.x, 1, p.z, 24, { color: '#8aff8a' }); fx.ring(p.x, 0, p.z, 1.5, '#8aff8a', 0.4); } break;
        case 'ward': break;
        case 'telegraph': addTelegraph(e.lane, 1.1, '#ff3a1a'); break;
        case 'breath': {
            const z = laneZ(e.lane);
            for (let i = 0; i < 40; i++) fx.burst('fire', Math.random() * 9, 0.3 + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.8, 1, { scale: 2 });
            fx.flash(3, 1, z, '#ff6a2a', 12, 0.6, 9);
            shake(0.45);
            break;
        }
        case 'land': shake(0.6); if (p) fx.burst('dust', p.x, 0.05, p.z, 30, { scale: 2 }); break;
        case 'enrage': if (p) { fx.burst('fire', p.x, 1, p.z, 24, { scale: 1.5 }); fx.floatText(p.x, 2.4, p.z, 'ENRAGED', 'crit'); } break;
    }
}

function addTelegraph(lane, life, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_END + 0.5, LANE_W * 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set((FIELD_END + 0.5) / 2, 0.05, laneZ(lane));
    m.renderOrder = 2;
    scene.add(m);
    V.telegraphs.push({ mesh: m, t: 0, life });
}

let vineGeo = null;
function addVine(x, z) {
    if (!vineGeo) {
        const P = new Parts(4);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; P.limb(i % 2 ? '#4a7a2a' : '#5a8a2a', [Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25], [Math.cos(a) * 0.05, 0.55, Math.sin(a) * 0.05], 0.03, 'cone'); }
        for (let i = 0; i < 6; i++) P.cone('#c8a87a', [Math.cos(i) * 0.15, 0.25 + (i % 3) * 0.08, Math.sin(i) * 0.15], [0.012, 0.05, 0.012], [0, 0, 1.5]);
        vineGeo = P.build().solid;
    }
    const m = new THREE.Mesh(vineGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    m.position.set(x, 0, z);
    scene.add(m);
    V.vines.push({ mesh: m, t: 0, life: 2.2 });
    fx.burst('leaf', x, 0.3, z, 6);
}

const fmt = (n) => (n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));

// ------------------------------------------------------------------ Highlights & selection

/** slots: list of slot objects to glow (null clears). */
export function setHighlights(w, slots) {
    if (!slots) { hlMesh.count = 0; return; }
    let i = 0;
    const p = new THREE.Vector3();
    for (const s of slots) {
        if (i >= 64) break;
        slotPos(w, s, p);
        _m4.compose(_p.set(p.x, p.y + 0.03, p.z), _q.identity(), _s.set(s.kind === 'wall' ? 0.8 : 1, 1, s.kind === 'wall' ? 0.8 : 1));
        hlMesh.setMatrixAt(i++, _m4);
    }
    hlMesh.count = i;
    hlMesh.instanceMatrix.needsUpdate = true;
}

export function setHover(w, slot, ok) {
    if (!slot) { hoverMesh.visible = false; return; }
    slotPos(w, slot, hoverMesh.position);
    hoverMesh.position.y += 0.04;
    hoverMesh.material.color.set(ok ? '#ffffff' : '#ff4a3a');
    hoverMesh.visible = true;
}

export function setSelected(w, unit) {
    if (!unit) { V.selRing.visible = false; return; }
    slotPos(w, unitSlot(unit), V.selRing.position);
    V.selRing.position.y += 0.05;
    V.selRing.visible = true;
}

// ------------------------------------------------------------------ Picking

const _sp = { x: 0, y: 0, behind: false };

/** The slot under a screen point (wall platforms first if close in screen space). */
export function pickSlot(w, px, py) {
    let best = null, bd = Infinity;
    const p = new THREE.Vector3();
    for (let lane = 0; lane < LANES; lane++) for (let t = 0; t < TOWER_TIERS; t++) {
        if (t >= w.castle.towers[lane]) continue;
        slotPos(w, { kind: 'wall', lane, tier: t }, p);
        p.y += 0.3;
        worldToScreen(p, _sp);
        const d = Math.hypot(_sp.x - px, _sp.y - py);
        if (d < bd) { bd = d; best = { kind: 'wall', lane, tier: t }; }
    }
    // Wall slots win when the tap is within ~0.45 of a cell's on-screen size.
    if (best) {
        slotPos(w, best, p);
        const a = worldToScreen(p.clone(), {});
        const b = worldToScreen(p.clone().add(new THREE.Vector3(0, 0, LANE_W)), {});
        const cell = Math.hypot(a.x - b.x, a.y - b.y);
        if (bd < cell * 0.5) return best;
    }
    const g = screenToGround(px, py, 0);
    if (!g) return null;
    const lane = Math.round(g.z / LANE_W + (LANES - 1) / 2);
    const col = Math.floor(g.x);
    if (lane < 0 || lane >= LANES) return null;
    if (g.x < 0 || col > 9) return g.x < 0 && g.x > -3.2 ? (best && bd < 90 ? best : null) : null;
    return { kind: 'field', lane, col };
}

export function pickUnit(w, px, py) {
    const s = pickSlot(w, px, py);
    if (!s) return null;
    return w.units.find((u) => u.lane === s.lane && u.kind === s.kind && (s.kind === 'wall' ? u.tier === s.tier : u.col === s.col)) ?? null;
}

/** Nearest pickup within a generous radius (touch-friendly). */
export function pickOrb(w, px, py, radius = 52) {
    let best = null, bd = radius;
    for (const o of w.orbs) {
        const m = V.orbs.get(o.id);
        if (!m) continue;
        worldToScreen(m.position, _sp);
        const d = Math.hypot(_sp.x - px, _sp.y - py);
        if (d < bd) { bd = d; best = o; }
    }
    return best;
}

export function pickLane(px, py) {
    const g = screenToGround(px, py, 0);
    if (!g) return null;
    const lane = Math.round(g.z / LANE_W + (LANES - 1) / 2);
    if (lane < 0 || lane >= LANES) return null;
    return { lane, x: Math.max(0.5, Math.min(FIELD_END - 0.3, g.x)) };
}

export function pickCastle(px, py) {
    const g = screenToGround(px, py, 0);
    return !!g && g.x < -0.2 && g.x > -6.5 && Math.abs(g.z) < 3.6;
}

/** Screen position of a world entity (for DOM effects). */
export function screenOf(x, y, z) { return worldToScreen(new THREE.Vector3(x, y, z), {}); }
export function orbScreen(id) { const m = V.orbs.get(id); return m ? worldToScreen(m.position, {}) : null; }
export function unitScreen(u) { const a = V.units.get(u.id); return a ? worldToScreen(a.rig.root.position.clone().add(new THREE.Vector3(0, 1.0, 0)), {}) : null; }
export function bossActor() { for (const [id, a] of V.enemies) if (a.sp.plan === 'boss') return { id, a }; return null; }
