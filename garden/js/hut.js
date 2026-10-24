// The Hut: a small cabin by the dock path. Step through its door and you are
// in a one-room study with a desk, and on the desk a glass sphere with a
// galaxy turning inside it. Click the sphere to fall into it (see galaxy.js).
// Like the Works, the room is built on the first visit, with its own scene and
// a stand-in `world` for the walking controls.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch, xf } from './materials.js';
import { signMesh, signTexture } from './architecture.js';
import { glowSprite } from './textures.js';
import { PLAZA_R, PATH_HALF } from './layout.js';
import { rng, TAU } from './util.js';

// ------------------------------------------------------------- the outside

const W = 4.4, D = 4.0, WALL_H = 2.7;   // footprint (x by z, local) and wall height

/** Local hut coordinates to world, for a hut at (cx, cz) turned by `f`. */
const toWorld = (h, lx, lz) => ({ x: h.x + lx * Math.cos(h.face) + lz * Math.sin(h.face), z: h.z - lx * Math.sin(h.face) + lz * Math.cos(h.face) });

/** Somewhere flat, dry and open beside the dock path, with the door turned to face the path. */
function findSite(world) {
    const { layout, island } = world;
    const flat = (x, z) => {
        let lo = Infinity, hi = -Infinity;
        for (const [dx, dz] of [[0, 0], [3, 3], [-3, 3], [3, -3], [-3, -3], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
            const h = island.heightAt(x + dx, z + dz);
            lo = Math.min(lo, h);
            hi = Math.max(hi, h);
        }
        return lo > 1.4 && hi - lo < 0.9;
    };
    const free = (x, z) => {
        if (Math.hypot(x, z) < PLAZA_R + 6) return false;
        if (island.pathDistAt(x, z) < PATH_HALF + 3.2 || island.shoreAt(x, z) > -5) return false;
        for (const sp of layout.spokes) if (Math.hypot(x - sp.pavilion.x, z - sp.pavilion.z) < 16) return false;
        for (const f of layout.features) if (f.type !== 'grove' && Math.hypot(x - f.x, z - f.z) < 14) return false;
        if (layout.islet?.x !== undefined && Math.hypot(x - layout.islet.x, z - layout.islet.z) < 14) return false;
        return !world.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 4);
    };
    const dock = layout.dock;
    let best = null;
    for (let z = dock.start - 6; z > PLAZA_R + 7; z -= 1.5) {
        for (const side of [1, -1]) {
            for (let off = 7; off < 22; off += 1.5) {
                const x = side * off;
                if (!flat(x, z) || !free(x, z)) continue;
                const score = Math.abs(z - (dock.start - 14)) + off * 0.8;
                if (!best || score < best.score) best = { x, z, score };
            }
        }
    }
    if (!best) {
        // anywhere at all on the dock side of the hub
        for (let r = PLAZA_R + 8; r < layout.hubR + 20 && !best; r += 2) {
            for (let a = 0; a < TAU; a += 0.15) {
                const x = Math.sin(a) * r, z = Math.cos(a) * r;
                if (flat(x, z) && free(x, z)) {
                    best = { x, z };
                    break;
                }
            }
        }
    }
    if (!best) return null;
    // face the nearest bit of the dock path
    const px = 0, pz = THREE.MathUtils.clamp(best.z, PLAZA_R, dock.start);
    const face = Math.round(Math.atan2(px - best.x, pz - best.z) / (Math.PI / 8)) * (Math.PI / 8);
    return { x: best.x, z: best.z, face };
}

/** Builds the cabin in the garden. Returns null if the island has nowhere to put it. */
export function buildHutExterior(world) {
    const site = findSite(world);
    if (!site) return null;
    const { mats, island } = world;
    const h = { ...site };
    let y0 = -Infinity, y1 = Infinity;
    for (const [lx, lz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, D / 2 + 1.2]]) {
        const p = toWorld(h, lx, lz), g = island.heightAt(p.x, p.z);
        y0 = Math.max(y0, g);
        y1 = Math.min(y1, g);
    }
    const base = y0 + 0.18;   // top of the plinth
    const batch = new Batch();
    const at = (lx, ly, lz, ry = 0, ...rest) => xf(toWorld(h, lx, lz).x, base + ly, toWorld(h, lx, lz).z, h.face + ry, ...rest);

    // plinth sunk into the slope, and a step at the door
    batch.add('granite', new THREE.BoxGeometry(W + 0.5, y0 - y1 + 0.9, D + 0.5), at(0, -(y0 - y1 + 0.9) / 2 + 0.18, 0));
    batch.add('granite', new THREE.BoxGeometry(1.8, 0.3, 0.9), at(0, -0.12, D / 2 + 0.7));
    // walls of timber, with dark corner posts
    batch.add('wood', new THREE.BoxGeometry(W, WALL_H, D), at(0, WALL_H / 2, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add('darkWood', new THREE.BoxGeometry(0.28, WALL_H + 0.1, 0.28), at(sx * (W / 2), WALL_H / 2, sz * (D / 2)));
    for (const ly of [0.06, WALL_H - 0.08]) batch.add('darkWood', new THREE.BoxGeometry(W + 0.16, 0.16, D + 0.16), at(0, ly, 0));
    // a hipped copper roof with wide eaves
    const roof = new THREE.ConeGeometry(1, 1.7, 4, 1, true).rotateY(Math.PI / 4);
    batch.add('copper', roof, at(0, WALL_H + 0.85, 0, 0, (W + 1.5) / 1.4142, 1, (D + 1.5) / 1.4142));
    batch.add('darkWood', new THREE.BoxGeometry(0.16, 0.5, 0.16), at(0, WALL_H + 1.85, 0));
    // chimney
    batch.add('granite', new THREE.BoxGeometry(0.7, 2.6, 0.7), at(-W / 2 + 0.75, WALL_H + 0.7, -D / 2 + 0.7));
    batch.add('iron', new THREE.BoxGeometry(0.9, 0.12, 0.9), at(-W / 2 + 0.75, WALL_H + 2.05, -D / 2 + 0.7));
    // door frame, porch lantern
    const fz = D / 2;
    batch.add('darkWood', new THREE.BoxGeometry(1.25, 2.15, 0.14), at(0, 1.05, fz + 0.02));
    batch.add('darkWood', new THREE.BoxGeometry(1.5, 0.16, 0.32), at(0, 2.2, fz + 0.1));
    batch.add('iron', new THREE.BoxGeometry(0.05, 0.4, 0.05), at(1.05, 1.95, fz + 0.12));
    batch.add('brass', new THREE.BoxGeometry(0.16, 0.22, 0.16), at(1.05, 1.62, fz + 0.2));
    batch.add('glass', new THREE.BoxGeometry(0.12, 0.17, 0.12), at(1.05, 1.62, fz + 0.2));
    // windows on the two sides and the back, lit from within at night
    const win = (lx, lz, ry) => {
        batch.add('darkWood', new THREE.BoxGeometry(0.98, 0.98, 0.1), at(lx, 1.55, lz, ry));
        batch.add('glass', new THREE.BoxGeometry(0.8, 0.8, 0.14), at(lx, 1.55, lz, ry));
        batch.add('darkWood', new THREE.BoxGeometry(0.06, 0.82, 0.16), at(lx, 1.55, lz, ry));
        batch.add('darkWood', new THREE.BoxGeometry(0.82, 0.06, 0.16), at(lx, 1.55, lz, ry));
        batch.add('darkWood', new THREE.BoxGeometry(1.12, 0.1, 0.22), at(lx, 1.0, lz, ry));
    };
    win(W / 2, 0, Math.PI / 2);
    win(-W / 2, 0.2, Math.PI / 2);
    win(0, -D / 2, 0);
    win(-1.35, fz, 0);
    // a stack of firewood against the wall
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3 - i; k++) batch.add('bark', new THREE.CylinderGeometry(0.1, 0.1, 0.9, 7), at(W / 2 + 0.2 + i * 0.01, 0.1 + i * 0.19, -0.9 + k * 0.21 + i * 0.1, 0, 1, 1, 1, Math.PI / 2, 0));
    world.root.add(batch.build(mats));

    // the door leaf is the thing you click
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.95, 0.1), mats.darkWood);
    const lp = toWorld(h, 0, fz + 0.1);
    leaf.position.set(lp.x, base + 0.98, lp.z);
    leaf.rotation.y = h.face;
    leaf.userData.kind = 'hutDoor';
    leaf.castShadow = true;
    world.root.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.brass);
    const kp = toWorld(h, 0.36, fz + 0.18);
    knob.position.set(kp.x, base + 0.95, kp.z);
    world.root.add(knob);
    // a little sign above the door
    const sign = signMesh(signTexture('🔮', 'The Hut', 'A sphere on the desk', '#c9a7ff', 1024, 256), 1.5, 0.375, 0.3);
    const sp = toWorld(h, 0, fz + 0.28);
    sign.position.set(sp.x, base + 2.55, sp.z);
    sign.rotation.y = h.face;
    world.root.add(sign);
    world.nightSigns.push(sign.userData.nightGlow);

    // solid walls: a ring of small colliders, leaving the doorway open
    const ring = [];
    for (let lx = -W / 2 - 0.2; lx <= W / 2 + 0.2; lx += 0.9) {
        ring.push([lx, -D / 2 - 0.2]);
        if (Math.abs(lx) > 1.1) ring.push([lx, D / 2 + 0.2]);
    }
    for (let lz = -D / 2 + 0.7; lz < D / 2 - 0.1; lz += 0.9) ring.push([-W / 2 - 0.2, lz], [W / 2 + 0.2, lz]);
    ring.push([-1.2, D / 2 + 0.2], [1.2, D / 2 + 0.2]);
    for (const [lx, lz] of ring) {
        const p = toWorld(h, lx, lz);
        world.colliders.push({ x: p.x, z: p.z, r: 0.55 });
    }
    const spot = toWorld(h, 0, D / 2 + 0.95);   // walking into this spot goes through the door
    const out = toWorld(h, 0, D / 2 + 2.4);
    const hut = {
        mesh: leaf, x: spot.x, z: spot.z, cx: h.x, cz: h.z,
        out: { x: out.x, z: out.z, yaw: h.face + Math.PI },
    };
    // the camera looks along -z at yaw 0, so facing out of the door (local +z) is yaw = face + PI
    world.landmarks.push({ name: 'The Hut', x: h.x, z: h.z, stand: { x: out.x, z: out.z, yaw: h.face } });
    return hut;
}

// ------------------------------------------------------------- the inside

const R_X = 3.2, R_Z = 3.0, CEIL = 3.0;   // room half-extents and ceiling height
const DESK = { x: 0, z: -2.1, w: 2.0, d: 0.8, h: 0.78 };

/** A swirl of colour on a sphere: the little galaxy waiting in the glass. */
const ORB_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vView;
void main() {
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}`;
const ORB_FRAG = /* glsl */ `
uniform float uTime;
uniform float uHover;
varying vec3 vN; varying vec3 vP; varying vec3 vView;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
void main() {
    vec3 p = normalize(vP);
    // a spiral drawn on the sphere's near face, turning slowly
    float ang = atan(p.x, p.z) + uTime * 0.25;
    float rad = length(p.xy) * 2.2;
    float arm = sin(ang * 2.0 - log(rad + 0.05) * 6.0 + uTime * 0.4);
    float cloud = fbm(p.xy * 3.0 + vec2(uTime * 0.05, 0.0) + arm * 0.4);
    vec3 col = mix(vec3(0.95, 0.25, 0.6), vec3(0.25, 0.4, 1.0), cloud);
    col = mix(col, vec3(0.2, 0.95, 0.9), smoothstep(0.55, 0.9, fbm(p.yz * 4.0 - uTime * 0.04)) * 0.7);
    float glow = pow(max(0.0, 1.0 - rad * 0.9), 2.0);
    col = mix(col * (0.45 + 0.8 * smoothstep(-0.6, 0.6, arm)), vec3(1.0, 0.85, 0.6), glow * 0.55);
    float stars = step(0.992, hash(floor(p.xy * 90.0 + 3.0))) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(floor(p.xy * 90.0)) * 20.0));
    col += stars;
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.5);
    col += vec3(0.45, 0.35, 1.0) * fres * 0.7;
    col *= 0.62 + 0.45 * uHover;
    gl_FragColor = vec4(col, 1.0);
}`;

export class Hut {
    /** @param {object} env { renderer, ui, mats } */
    constructor(env) {
        this.env = env;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x14100c);
        this.scene.fog = new THREE.FogExp2(0x1a130d, 0.03);
        const pmrem = new THREE.PMREMGenerator(env.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.35;
        pmrem.dispose();
        this.time = 0;
        this.hover = 0;
        this.colliders = [];
        this.mats = { ...env.mats };
        this.mats.plaster = new THREE.MeshStandardMaterial({ color: 0xd9c9ae, roughness: 0.95 });
        this.mats.rug = new THREE.MeshStandardMaterial({ color: 0x5a2f4a, roughness: 1 });
        this.mats.rugEdge = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 1 });
        this.mats.paper = new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.9 });
        this.mats.window = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x8fb4ff, emissiveIntensity: 0.9, roughness: 0.3 });
        this.mats.lamp = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc070, emissiveIntensity: 2.2, roughness: 0.4 });
        this.mats.glassBall = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0, transparent: true, opacity: 0.18, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false });

        const batch = new Batch();
        this._shell(batch);
        this._furniture(batch);
        this.scene.add(batch.build(this.mats, { castShadow: false, receiveShadow: false }));
        this._lights();
        this._orb();
        this._grid();

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: () => 0,
            onDeck: () => false,
            collidersNear: (x, z) => self.grid.get(self._key(x, z)) || [],
            onArrive: null,
        };
        this.spawn = { x: 0, z: 0.7, yaw: 0 };
        // walking into this spot goes back out of the door
        this.exit = { x: 0, z: R_Z - 0.5 };
        // where you stand when you come back out of the sphere
        this.deskStand = { x: 0, z: -0.9, yaw: 0, pitch: -0.2 };
    }

    walkable(x, z) {
        return Math.abs(x) < R_X - 0.35 && Math.abs(z) < R_Z - 0.35;
    }

    _key(x, z) {
        return Math.floor(x / 4) * 7919 + Math.floor(z / 4);
    }

    _grid() {
        this.grid = new Map();
        for (const c of this.colliders) {
            for (let i = Math.floor((c.x - c.r) / 4); i <= Math.floor((c.x + c.r) / 4); i++) {
                for (let j = Math.floor((c.z - c.r) / 4); j <= Math.floor((c.z + c.r) / 4); j++) {
                    const k = i * 7919 + j;
                    if (!this.grid.has(k)) this.grid.set(k, []);
                    this.grid.get(k).push(c);
                }
            }
        }
    }

    _box(batch, key, w, h, d, x, y, z, ry = 0) {
        batch.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry));
    }

    _collide(x, z, w, d) {
        const n = Math.max(1, Math.ceil(Math.max(w, d) / 0.5));
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : i / (n - 1) - 0.5;
            this.colliders.push(w >= d ? { x: x + t * (w - 0.4), z, r: d / 2 + 0.05 } : { x, z: z + t * (d - 0.4), r: w / 2 + 0.05 });
        }
    }

    _shell(batch) {
        const b = batch;
        // floor boards, plaster walls, a beamed ceiling
        this._box(b, 'wood', R_X * 2, 0.1, R_Z * 2, 0, -0.05, 0);
        this._box(b, 'plaster', R_X * 2, CEIL, 0.12, 0, CEIL / 2, -R_Z);
        this._box(b, 'plaster', 0.12, CEIL, R_Z * 2, -R_X, CEIL / 2, 0);
        this._box(b, 'plaster', 0.12, CEIL, R_Z * 2, R_X, CEIL / 2, 0);
        // the front wall has the door in it
        this._box(b, 'plaster', R_X - 0.6, CEIL, 0.12, -(R_X + 0.6) / 2, CEIL / 2, R_Z);
        this._box(b, 'plaster', R_X - 0.6, CEIL, 0.12, (R_X + 0.6) / 2, CEIL / 2, R_Z);
        this._box(b, 'plaster', 1.2, CEIL - 2.1, 0.12, 0, 2.1 + (CEIL - 2.1) / 2, R_Z);
        this._box(b, 'darkWood', 1.0, 2.05, 0.1, 0, 1.025, R_Z + 0.02);
        this._box(b, 'darkWood', 0.1, 2.2, 0.2, -0.65, 1.1, R_Z);
        this._box(b, 'darkWood', 0.1, 2.2, 0.2, 0.65, 1.1, R_Z);
        this._box(b, 'darkWood', 1.4, 0.12, 0.2, 0, 2.18, R_Z);
        this._box(b, 'brass', 0.06, 0.06, 0.1, 0.38, 1.0, R_Z - 0.08);
        this._box(b, 'wood', R_X * 2, 0.1, R_Z * 2, 0, CEIL + 0.05, 0);
        for (let x = -R_X + 0.6; x < R_X; x += 1.3) this._box(b, 'darkWood', 0.18, 0.22, R_Z * 2, x, CEIL - 0.11, 0);
        // skirting boards
        this._box(b, 'darkWood', R_X * 2, 0.16, 0.06, 0, 0.08, -R_Z + 0.08);
        this._box(b, 'darkWood', 0.06, 0.16, R_Z * 2, -R_X + 0.08, 0.08, 0);
        this._box(b, 'darkWood', 0.06, 0.16, R_Z * 2, R_X - 0.08, 0.08, 0);
        // two windows with their frames; the glass material is a pale moonlit blue
        for (const sx of [-1, 1]) {
            this._box(b, 'window', 0.04, 0.95, 0.95, sx * (R_X - 0.07), 1.65, 0.3);
            this._box(b, 'darkWood', 0.1, 1.1, 0.08, sx * (R_X - 0.1), 1.65, 0.3 - 0.52);
            this._box(b, 'darkWood', 0.1, 1.1, 0.08, sx * (R_X - 0.1), 1.65, 0.3 + 0.52);
            this._box(b, 'darkWood', 0.1, 0.08, 1.12, sx * (R_X - 0.1), 1.17, 0.3);
            this._box(b, 'darkWood', 0.1, 0.08, 1.12, sx * (R_X - 0.1), 2.13, 0.3);
            this._box(b, 'darkWood', 0.1, 0.05, 0.95, sx * (R_X - 0.1), 1.65, 0.3);
            this._box(b, 'darkWood', 0.1, 0.95, 0.05, sx * (R_X - 0.1), 1.65, 0.3);
        }
        // stone hearth in the back corner, with a little fire
        this._box(b, 'granite', 1.3, 1.5, 0.7, -R_X + 0.9, 0.75, -R_Z + 0.45);
        this._box(b, 'dark', 0.7, 0.8, 0.1, -R_X + 0.9, 0.5, -R_Z + 0.82);
        this._box(b, 'granite', 1.5, 0.12, 0.9, -R_X + 0.9, 1.56, -R_Z + 0.5);
        this._collide(-R_X + 0.9, -R_Z + 0.5, 1.3, 0.7);
    }

    _furniture(batch) {
        const b = batch, dk = DESK;
        // the desk: a thick top on four legs, with a drawer front
        this._box(b, 'darkWood', dk.w, 0.07, dk.d, dk.x, dk.h, dk.z);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._box(b, 'darkWood', 0.07, dk.h, 0.07, dk.x + sx * (dk.w / 2 - 0.08), dk.h / 2, dk.z + sz * (dk.d / 2 - 0.08));
        this._box(b, 'darkWood', dk.w - 0.2, 0.16, 0.04, dk.x, dk.h - 0.14, dk.z + dk.d / 2 - 0.08);
        this._box(b, 'brass', 0.14, 0.03, 0.03, dk.x, dk.h - 0.14, dk.z + dk.d / 2 - 0.04);
        this._collide(dk.x, dk.z, dk.w, dk.d);
        // brass stand for the sphere, a few papers, a candle
        b.add('brass', new THREE.CylinderGeometry(0.1, 0.12, 0.05, 20), xf(dk.x, dk.h + 0.06, dk.z));
        b.add('brass', new THREE.TorusGeometry(0.115, 0.014, 8, 24), xf(dk.x, dk.h + 0.095, dk.z, 0, 1, 1, 1, Math.PI / 2, 0));
        this._box(b, 'paper', 0.3, 0.012, 0.22, dk.x - 0.62, dk.h + 0.045, dk.z + 0.05, 0.3);
        this._box(b, 'paper', 0.28, 0.012, 0.2, dk.x - 0.55, dk.h + 0.058, dk.z + 0.08, -0.15);
        b.add('brass', new THREE.CylinderGeometry(0.05, 0.06, 0.03, 12), xf(dk.x + 0.65, dk.h + 0.055, dk.z - 0.05));
        b.add('paper', new THREE.CylinderGeometry(0.025, 0.025, 0.14, 10), xf(dk.x + 0.65, dk.h + 0.14, dk.z - 0.05));
        // a stool at the desk
        b.add('wood', new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), xf(0.25, 0.5, -1.35));
        for (let k = 0; k < 3; k++) {
            const a = (k / 3) * TAU;
            b.add('darkWood', new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), xf(0.25 + Math.cos(a) * 0.14, 0.25, -1.35 + Math.sin(a) * 0.14));
        }
        // a rug
        b.add('rugEdge', new THREE.CylinderGeometry(1.3, 1.3, 0.015, 40), xf(0, 0.008, -0.2, 0, 1, 1, 0.75));
        b.add('rug', new THREE.CylinderGeometry(1.15, 1.15, 0.02, 40), xf(0, 0.012, -0.2, 0, 1, 1, 0.75));
        // bookshelf on the right-hand wall
        const sx = R_X - 0.3, sz = -0.4;
        this._box(b, 'darkWood', 0.4, 2.1, 0.06, sx, 1.05, sz - 0.9);
        this._box(b, 'darkWood', 0.4, 2.1, 0.06, sx, 1.05, sz + 0.9);
        for (let k = 0; k < 5; k++) this._box(b, 'darkWood', 0.4, 0.04, 1.8, sx, 0.15 + k * 0.48, sz);
        this._box(b, 'darkWood', 0.04, 2.1, 1.8, sx + 0.18, 1.05, sz);
        const r = rng('hut-books');
        const palette = [0x7a2a2a, 0x2a4a6a, 0x2f5a46, 0x8a6a2a, 0x4a2a5a, 0x6a4a3a];
        for (let k = 0; k < 4; k++) {
            let z = sz - 0.82;
            while (z < sz + 0.8) {
                const w = 0.05 + r() * 0.06, hh = 0.28 + r() * 0.14;
                const book = new THREE.Mesh(new THREE.BoxGeometry(0.26, hh, w), new THREE.MeshStandardMaterial({ color: palette[Math.floor(r() * palette.length)], roughness: 0.8 }));
                book.position.set(sx - 0.02, 0.17 + k * 0.48 + hh / 2, z + w / 2);
                this.scene.add(book);
                z += w + 0.008;
                if (r() < 0.07) z += 0.2;
            }
        }
        this._collide(sx, sz, 0.4, 1.9);
        // a potted plant and a trunk by the door
        b.add('bronze', new THREE.CylinderGeometry(0.16, 0.12, 0.28, 12), xf(-R_X + 0.4, 0.14, R_Z - 0.45));
        this._box(b, 'darkWood', 0.9, 0.45, 0.5, -1.9, 0.225, R_Z - 0.4);
        this._box(b, 'iron', 0.92, 0.05, 0.52, -1.9, 0.3, R_Z - 0.4);
        this._collide(-1.9, R_Z - 0.4, 0.9, 0.5);
        const leafGeo = new THREE.SphereGeometry(0.12, 8, 6).scale(0.5, 1.3, 0.3);
        for (let k = 0; k < 9; k++) {
            const a = (k / 9) * TAU;
            b.add('hedge', leafGeo, xf(-R_X + 0.4 + Math.cos(a) * 0.1, 0.55, R_Z - 0.45 + Math.sin(a) * 0.1, -a, 1, 1.2, 1, 0.5, 0));
        }
    }

    _lights() {
        // a warm lantern hanging from the beams, a fire in the hearth and moonlight at the windows
        const hang = new THREE.Group();
        hang.position.set(0, CEIL - 0.5, -0.4);
        hang.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).translate(0, 0.25, 0), this.mats.iron));
        hang.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), this.mats.lamp));
        this.scene.add(hang);
        const lamp = new THREE.PointLight(0xffc27a, 9, 11, 1.6);
        lamp.position.set(0, CEIL - 0.6, -0.4);
        this.scene.add(lamp);
        this.lamp = lamp;
        const fire = new THREE.PointLight(0xff7a2a, 5, 6, 2);
        fire.position.set(-R_X + 0.9, 0.6, -R_Z + 0.9);
        this.scene.add(fire);
        this.fire = fire;
        for (const sx of [-1, 1]) {
            const m = new THREE.PointLight(0x9bb8ff, 2.5, 5, 2);
            m.position.set(sx * (R_X - 0.7), 1.6, 0.3);
            this.scene.add(m);
        }
        this.scene.add(new THREE.AmbientLight(0x5a4a40, 0.5));
        // embers in the hearth
        const emb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a10, emissiveIntensity: 2.4 }));
        emb.position.set(-R_X + 0.9, 0.2, -R_Z + 0.55);
        this.scene.add(emb);
        this.embers = emb.material;
    }

    _orb() {
        const dk = DESK;
        this.orbPos = new THREE.Vector3(dk.x, dk.h + 0.24, dk.z);
        const uniforms = { uTime: { value: 0 }, uHover: { value: 0 } };
        this.orbUniforms = uniforms;
        const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.115, 40, 28),
            new THREE.ShaderMaterial({ uniforms, vertexShader: ORB_VERT, fragmentShader: ORB_FRAG }),
        );
        core.position.copy(this.orbPos);
        this.orbCore = core;
        // glass shell, and a generous invisible target so it is easy to click
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.132, 40, 28), this.mats.glassBall);
        shell.position.copy(this.orbPos);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.copy(this.orbPos);
        hit.userData.kind = 'orb';
        this.orbHit = hit;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xb48cff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
        halo.scale.set(1.0, 1.0, 1);
        halo.position.copy(this.orbPos);
        this.halo = halo;
        const light = new THREE.PointLight(0xb48cff, 3.5, 5, 2);
        light.position.copy(this.orbPos).add(new THREE.Vector3(0, 0.15, 0.15));
        this.orbLight = light;
        this.scene.add(core, shell, hit, halo, light);
    }

    /** The stage-set for the exit door: a mesh the pointer can target. */
    get doorMesh() {
        if (!this._door) {
            this._door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
            this._door.position.set(0, 1.025, R_Z - 0.05);
            this._door.userData.kind = 'hutExit';
            this.scene.add(this._door);
        }
        return this._door;
    }

    setHover(on) {
        this.hoverTarget = on ? 1 : 0;
    }

    update(dt, t) {
        this.time = t;
        this.hover += ((this.hoverTarget || 0) - this.hover) * Math.min(1, dt * 8);
        this.orbUniforms.uTime.value = t;
        this.orbUniforms.uHover.value = this.hover;
        const bob = Math.sin(t * 1.2) * 0.004;
        this.orbCore.position.y = this.orbPos.y + bob;
        this.halo.material.opacity = 0.26 + 0.08 * Math.sin(t * 1.7) + this.hover * 0.2;
        const s = 0.9 + this.hover * 0.25 + Math.sin(t * 1.7) * 0.04;
        this.halo.scale.set(s, s, 1);
        this.orbLight.intensity = 3 + Math.sin(t * 1.7) * 0.8 + this.hover * 2;
        this.fire.intensity = 5 + Math.sin(t * 12) * 0.7 + Math.sin(t * 7.3) * 0.9;
        this.embers.emissiveIntensity = 2.2 + Math.sin(t * 5) * 0.4;
        this.lamp.intensity = 9 + Math.sin(t * 2.1) * 0.25;
    }
}
