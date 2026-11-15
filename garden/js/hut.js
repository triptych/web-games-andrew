// The Hut: a small cabin by the dock path. Step through its door and you are
// in a one-room study with a desk, and on the desk a glass sphere with a
// galaxy turning inside it. Click the sphere to fall into it (see galaxy.js), or
// the train ticket beside it to board the Violet Line (see subway.js), or the
// papers on the other side to read an old maintenance log, or the little
// Pocket Garden handheld propped up at the front to go to the console (see
// hut-console.js). Beside the desk an old television shows the island's
// secret places, live (see hut-tv.js). A stair along the right-hand wall
// climbs to the loft under the roof: a stained-glass window, a bed, an old
// computer and a flute, under strings of twinkle lights (see hut-loft.js).
// Like the Works, the room is built on the first visit, with its own scene and
// a stand-in `world` for the walking controls.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch, xf } from './materials.js';
import { buildFireplace } from './fireplace.js';
import { signMesh, signTexture } from './architecture.js';
import { glowSprite } from './textures.js';
import { HutTV } from './hut-tv.js';
import { HutConsole } from './hut-console.js';
import { Loft, STAIR, HOLE, onStair, stairHeight } from './hut-loft.js';
import { stainedGlass } from './stained-glass.js';
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
        // the statues, lamps and benches are built after the hut, so they aren't in the
        // colliders yet: keep the cabin (4 m from its centre to a corner of the copper
        // eaves) clear of their spots in the layout, with room to walk round a pedestal
        for (const sp of layout.spokes) {
            if (sp.statues.some((st) => Math.hypot(x - st.x, z - st.z) < 6.5)) return false;
            if (sp.lamps.some((l) => Math.hypot(x - l.x, z - l.z) < 5)) return false;
            if (sp.benches.some((b) => Math.hypot(x - b.x, z - b.z) < 5.5)) return false;
        }
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
    // a dormer in the front of the roof, with the loft's round stained-glass window in it
    const dz = D / 2 - 0.25;
    batch.add('wood', new THREE.BoxGeometry(1.3, 1.05, 1.5), at(0, WALL_H + 0.5, dz - 0.75));
    for (const sx of [-1, 1]) batch.add('darkWood', new THREE.BoxGeometry(0.12, 1.1, 0.12), at(sx * 0.65, WALL_H + 0.5, dz));
    const gable = new THREE.Shape();
    gable.moveTo(-0.86, 0);
    gable.lineTo(0.86, 0);
    gable.lineTo(0, 0.52);
    gable.closePath();
    batch.add('copper', new THREE.ExtrudeGeometry(gable, { depth: 1.75, bevelEnabled: false }), at(0, WALL_H + 1.0, dz + 0.12 - 1.75));
    batch.add('darkWood', new THREE.TorusGeometry(0.38, 0.05, 8, 32), at(0, WALL_H + 0.5, dz + 0.02));
    // a stack of firewood against the wall
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3 - i; k++) batch.add('bark', new THREE.CylinderGeometry(0.1, 0.1, 0.9, 7), at(W / 2 + 0.2 + i * 0.01, 0.1 + i * 0.19, -0.9 + k * 0.21 + i * 0.1, 0, 1, 1, 1, Math.PI / 2, 0));
    world.root.add(batch.build(mats));
    // the glass: the same picture as the window inside, lit from within at night
    const sg = stainedGlass();
    const glassMat = new THREE.MeshStandardMaterial({ map: sg.texture, emissiveMap: sg.texture, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.3, transparent: true, alphaTest: 0.1 });
    const rose = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40), glassMat);
    const rp = toWorld(h, 0, dz + 0.03);
    rose.position.set(rp.x, base + WALL_H + 0.5, rp.z);
    rose.rotation.y = h.face;
    world.root.add(rose);
    world.glowMats.push({ mat: glassMat, day: 0.35, night: 1.5 });

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
const F2 = CEIL + 0.1;                     // the loft floor
/** On the stair's flight (where you can stand on it), and how high its steps are there. */
const inStair = (x, z) => onStair(x, z, R_Z - 0.35);
const stairY = (x, z) => stairHeight(x, z, F2);
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
    float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0), 2.5);
    col += vec3(0.45, 0.35, 1.0) * fres * 0.7;
    col *= 0.62 + 0.45 * uHover;
    gl_FragColor = vec4(col, 1.0);
}`;

export class Hut {
    /** @param {object} env { renderer, ui, mats, camera, quality, tv (channels), onChannel, titles (the game list, for the handheld) } */
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
        this.colliders1 = [];   // upstairs, in the loft
        this.level = 0;         // 0 the room, 1 the loft
        this.up = 0;            // 0 .. 1 as you climb
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
        this.loft = new Loft({ hut: this, batch, dims: { R_X, R_Z, CEIL, F: F2 }, collide1: (x, z, w, d) => this._collide(x, z, w, d, this.colliders1) });
        this.scene.add(batch.build(this.mats, { castShadow: false, receiveShadow: false }));
        this._lights();
        this._orb();
        this._ticket();
        this._papers();
        this._portrait();
        // the Pocket Garden handheld, propped up at the front of the desk between the sphere and the papers
        this.handheld = new HutConsole({ scene: this.scene, mats: this.mats, renderer: env.renderer, titles: env.titles, x: DESK.x - 0.3, y: DESK.h + 0.035, z: DESK.z + 0.24, yaw: 0.22 });
        if (env.tv?.length) {
            // the television on its cabinet, between the desk and the bookshelf, facing the room
            this.tv = new HutTV({ renderer: env.renderer, scene: this.scene, camera: env.camera, mats: this.mats, quality: env.quality, channels: env.tv, onChannel: env.onChannel, x: 1.85, z: -R_Z + 0.38, ry: -0.12 });
            this._collide(1.85, -R_Z + 0.38, 0.95, 0.5);
        }
        this._grid();

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: (x, z) => self.heightAt(x, z),
            onDeck: () => false,
            collidersNear: (x, z) => (self.level ? self.grid1 : self.grid).get(self._key(x, z)) || [],
            onArrive: null,
            // no grid to plan round things with, but a walk may only cut a corner along level floor,
            // so a walk up the stair keeps to the stair instead of cutting under it
            nav: {
                clear: (ax, az, bx, bz) => {
                    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15);
                    let y = self.heightAt(ax, az);
                    for (let i = 1; i <= n; i++) {
                        const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n, h = self.heightAt(x, z);
                        if (!self.walkable(x, z) || Math.abs(h - y) > 0.3) return false;
                        y = h;
                    }
                    return true;
                },
                repair: (x, z, points) => points,
                find: () => null,
            },
        };
        this.spawn = { x: 0, z: 0.7, yaw: 0 };
        // walking into this spot goes back out of the door
        this.exit = { x: 0, z: R_Z - 0.5 };
        // where you stand when you come back out of the sphere
        this.deskStand = { x: 0, z: -0.9, yaw: 0, pitch: -0.2 };
        // up the stair: the window shows its picture of the day; back down: it finds a new one for next time
        this.onLevel = (L) => {
            if (L === 1) {
                this.loft.arrive();
                env.ui?.zone('The Loft', `Under the rafters · ${stainedGlass().name} in the window`, '#ffc27a');
                if (!this.loftHinted) {
                    this.loftHinted = true;
                    setTimeout(() => env.ui?.hint('The loft · click the bed to sleep the night away, the old computer to sit down at it, or the flute to play · the twinkle lights come on as it gets dark', 9000), 1400);
                }
            } else stainedGlass().next();
        };
    }

    /** Can you stand at (x, z) on the floor you are on? The stair belongs to both. */
    walkable(x, z, level = this.level) {
        // the stair is floor near your own level only, so you can't step off the loft onto its middle
        if (inStair(x, z)) return level ? stairY(x, z) > F2 / 2 - 0.6 : stairY(x, z) < F2 / 2 + 0.6;
        if (Math.abs(x) >= R_X - 0.35 || Math.abs(z) >= R_Z - 0.35) return false;
        // upstairs, the hole the stair comes up through
        return !(level === 1 && x > HOLE.x0 && z > HOLE.z0 && z < HOLE.z1 + 0.4);
    }

    /** The height of the floor (or the step) at (x, z). */
    heightAt(x, z) {
        if (inStair(x, z)) return stairY(x, z);
        return this.level ? F2 : 0;
    }

    /** True while the flute, the computer or the bed has you. */
    get busy() {
        return this.loft.busy;
    }

    /** The stair's two ends, for walking up or down it when it is clicked. */
    stairRoute() {
        const cx = (STAIR.x0 + STAIR.x1) / 2 - 0.1, lz = (STAIR.zL + R_Z - 0.35) / 2;
        // in front of the bottom steps, up them onto the landing, turn, and up the flight (or the other way)
        const foot = { x: STAIR.xB - 0.35, z: lz }, landing = { x: cx, z: lz }, mid = { x: cx, z: 0.5 }, top = { x: cx, z: STAIR.zTop - 0.3 };
        return this.level ? [{ x: 1.6, z: -0.9 }, top, mid, landing, foot, { x: 0.9, z: 1.8 }] : [foot, landing, mid, top, { x: 1.4, z: -0.9 }];
    }

    /** What the ray points at: something to click, a door, or the floor. */
    pick(ray) {
        const L = this.level;
        const list = L ? [...this.loft.pickables, ...this.loft.stairHits] : [this.orbHit, this.ticketHit, this.papersHit, ...this.handheld.pickables, this.doorMesh, ...(this.tv?.pickables ?? []), ...this.loft.stairHits];
        const hit = ray.intersectObjects(list, false)[0];
        if (hit && hit.distance < 40) return { type: { orb: 'orb', ticket: 'ticket', tv: 'tv', papers: 'papers', console: 'console', stairs: 'stairs', bed: 'bed', computer: 'computer', flute: 'flute', cat: 'cat', window: 'window' }[hit.object.userData.kind] ?? 'door', t: hit.distance };
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y >= -1e-4) return null;
        const y = L ? F2 : 0;
        const t = (y - o.y) / d.y;
        if (t < 0) return null;
        const point = o.clone().addScaledVector(d, t);
        return this.walkable(point.x, point.z) && !inStair(point.x, point.z) ? { type: 'ground', point, t } : null;
    }

    _key(x, z) {
        return Math.floor(x / 4) * 7919 + Math.floor(z / 4);
    }

    _grid() {
        this.grid = this._gridOf(this.colliders);
        this.grid1 = this._gridOf(this.colliders1);
    }

    _gridOf(list) {
        const grid = new Map();
        for (const c of list) {
            for (let i = Math.floor((c.x - c.r) / 4); i <= Math.floor((c.x + c.r) / 4); i++) {
                for (let j = Math.floor((c.z - c.r) / 4); j <= Math.floor((c.z + c.r) / 4); j++) {
                    const k = i * 7919 + j;
                    if (!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(c);
                }
            }
        }
        return grid;
    }

    _box(batch, key, w, h, d, x, y, z, ry = 0) {
        batch.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry));
    }

    _collide(x, z, w, d, list = this.colliders) {
        const n = Math.max(1, Math.ceil(Math.max(w, d) / 0.5));
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : i / (n - 1) - 0.5;
            list.push(w >= d ? { x: x + t * (w - 0.4), z, r: d / 2 + 0.05 } : { x, z: z + t * (d - 0.4), r: w / 2 + 0.05 });
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
        // the ceiling, which is the loft's floor, with a hole for the stair
        const hw = R_X - HOLE.x0;
        this._box(b, 'wood', R_X + HOLE.x0, 0.1, R_Z * 2, (HOLE.x0 - R_X) / 2, CEIL + 0.05, 0);
        this._box(b, 'wood', hw, 0.1, HOLE.z0 + R_Z, (HOLE.x0 + R_X) / 2, CEIL + 0.05, (HOLE.z0 - R_Z) / 2);
        this._box(b, 'wood', hw, 0.1, R_Z - HOLE.z1, (HOLE.x0 + R_X) / 2, CEIL + 0.05, (HOLE.z1 + R_Z) / 2);
        for (let x = -R_X + 0.6; x < R_X; x += 1.3) {
            if (x > HOLE.x0 - 0.1) this._box(b, 'darkWood', 0.18, 0.22, HOLE.z0 + R_Z, x, CEIL - 0.11, (HOLE.z0 - R_Z) / 2);
            else this._box(b, 'darkWood', 0.18, 0.22, R_Z * 2, x, CEIL - 0.11, 0);
        }
        // skirting boards
        this._box(b, 'darkWood', R_X * 2, 0.16, 0.06, 0, 0.08, -R_Z + 0.08);
        this._box(b, 'darkWood', 0.06, 0.16, R_Z * 2, -R_X + 0.08, 0.08, 0);
        this._box(b, 'darkWood', 0.06, 0.16, R_Z * 2, R_X - 0.08, 0.08, 0);
        // two windows with their frames, on the left wall and in the front wall by the door
        // (the stair runs up the right wall); the glass material is a pale moonlit blue
        for (const [x, z, along, inward, ry] of [[-(R_X - 0.07), 0.3, [0, 1], [1, 0], 0], [-1.9, R_Z - 0.07, [1, 0], [0, -1], Math.PI / 2]]) {
            // du runs along the wall; the frame stands 3 cm proud of the glass, into the room
            const put = (key, w, h, d, du, y) => {
                const k = key === 'window' ? 0 : 0.03;
                b.add(key, new THREE.BoxGeometry(w, h, d), xf(x + along[0] * du + inward[0] * k, y, z + along[1] * du + inward[1] * k, ry));
            };
            put('window', 0.04, 0.95, 0.95, 0, 1.65);
            put('darkWood', 0.1, 1.1, 0.08, -0.52, 1.65);
            put('darkWood', 0.1, 1.1, 0.08, 0.52, 1.65);
            put('darkWood', 0.1, 0.08, 1.12, 0, 1.17);
            put('darkWood', 0.1, 0.08, 1.12, 0, 2.13);
            put('darkWood', 0.1, 0.05, 0.95, 0, 1.65);
            put('darkWood', 0.1, 0.95, 0.05, 0, 1.65);
        }
        // a stone fireplace in the back corner, with a fire burning in it (see fireplace.js)
        this.fireplace = buildFireplace({ batch: b, scene: this.scene, mats: this.mats, x: -R_X + 0.9, back: -R_Z + 0.06, left: -R_X + 0.06, ceil: CEIL });
        const fc = this.fireplace.collider;
        this._collide(fc.x, fc.z, fc.w, fc.d);
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
        // (the papers are their own mesh: see _papers)
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
        // bookshelf on the right-hand wall, back toward the corner and clear of the window
        const sx = R_X - 0.3, sz = -1.8;
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
        // a warm lantern hanging from the beams and moonlight at the windows (the fire brings its own light)
        const hang = new THREE.Group();
        hang.position.set(0, CEIL - 0.5, -0.4);
        hang.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).translate(0, 0.25, 0), this.mats.iron));
        hang.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), this.mats.lamp));
        this.scene.add(hang);
        const lamp = new THREE.PointLight(0xffc27a, 9, 11, 1.6);
        lamp.position.set(0, CEIL - 0.6, -0.4);
        this.scene.add(lamp);
        this.lamp = lamp;
        this.moons = [[-(R_X - 0.7), 0.3], [-1.9, R_Z - 0.7]].map(([x, z]) => {
            const m = new THREE.PointLight(0x9bb8ff, 2.5, 5, 2);
            m.position.set(x, 1.6, z);
            this.scene.add(m);
            return m;
        });
        this.ambient = new THREE.AmbientLight(0x5a4a40, 0.5);
        this.scene.add(this.ambient);
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

    /** A train ticket on the desk beside the sphere: click it and the Violet Line is waiting. */
    _ticket() {
        const dk = DESK;
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 256;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 512, 256);
        g.addColorStop(0, '#f3e6c4');
        g.addColorStop(1, '#e0cf9f');
        x.fillStyle = g;
        x.fillRect(0, 0, 512, 256);
        x.strokeStyle = '#6a3fbf';
        x.lineWidth = 6;
        x.strokeRect(10, 10, 492, 236);
        x.fillStyle = '#6a3fbf';
        x.fillRect(10, 10, 492, 54);
        x.fillStyle = '#fff6df';
        x.font = '700 34px Georgia, serif';
        x.textAlign = 'center';
        x.fillText('VIOLET LINE', 256, 49);
        x.fillStyle = '#2a1d52';
        x.font = '700 38px Georgia, serif';
        x.fillText('HEARTHSIDE → PRISM HALT', 256, 118);
        x.font = '600 24px system-ui, sans-serif';
        x.fillText('ADMIT ONE · RETURN INCLUDED', 256, 160);
        x.fillStyle = '#6a3fbf';
        for (let i = 0; i < 38; i++) x.fillRect(40 + i * 11, 190, i % 3 === 0 ? 3 : 6, 36);
        x.fillStyle = '#c0392b';
        x.font = '700 22px "Courier New", monospace';
        x.textAlign = 'right';
        x.fillText('No. 0444', 490, 232);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const edge = new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.9 });
        const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 });
        const ticket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.1), [edge, edge, face, edge, edge, edge]);
        this.ticketPos = new THREE.Vector3(dk.x + 0.46, dk.h + 0.045, dk.z + 0.14);
        ticket.position.copy(this.ticketPos);
        ticket.rotation.y = -0.35;
        this.ticket = ticket;
        // a soft violet glint that tells you it is not just paper
        const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xb79bff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
        glint.scale.set(0.34, 0.34, 1);
        glint.position.copy(this.ticketPos).add(new THREE.Vector3(0, 0.03, 0));
        this.ticketGlint = glint;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.copy(this.ticketPos);
        hit.userData.kind = 'ticket';
        this.ticketHit = hit;
        this.ticketHover = 0;
        this.scene.add(ticket, glint, hit);
    }

    /**
     * A framed portrait of a rogue-geared wizard, hung on the back wall above the desk.
     * The picture loads after the room is built (the page is the root, so the path is
     * relative to index.html); until then the canvas is a dark, parchment-coloured blank.
     */
    _portrait() {
        const pw = 0.72, ph = 0.96, fw = 0.07;           // picture size and frame width
        const cx = DESK.x, cy = 1.85, wallZ = -R_Z + 0.06;  // centre, and the wall's inner face
        const g = new THREE.Group();
        g.position.set(cx, cy, wallZ + 0.03);
        const wood = this.mats.darkWood, brass = this.mats.brass;
        const bar = (w, h, d, x, y, z, m) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(x, y, z);
            g.add(mesh);
        };
        // a dark timber frame with a thin brass lip and a brass plate beneath it
        bar(pw + fw * 2, fw, 0.06, 0, ph / 2 + fw / 2, 0, wood);
        bar(pw + fw * 2, fw, 0.06, 0, -ph / 2 - fw / 2, 0, wood);
        bar(fw, ph, 0.06, -pw / 2 - fw / 2, 0, 0, wood);
        bar(fw, ph, 0.06, pw / 2 + fw / 2, 0, 0, wood);
        bar(pw + 0.02, 0.012, 0.065, 0, ph / 2, 0.002, brass);
        bar(pw + 0.02, 0.012, 0.065, 0, -ph / 2, 0.002, brass);
        bar(0.012, ph, 0.065, -pw / 2, 0, 0.002, brass);
        bar(0.012, ph, 0.065, pw / 2, 0, 0.002, brass);
        bar(0.22, 0.05, 0.02, 0, -ph / 2 - fw - 0.04, 0.02, brass);
        // the picture, with enough glow of its own to read by lantern-light
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.75, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: null });
        const canvas = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
        canvas.position.z = 0.032;
        g.add(canvas);
        new THREE.TextureLoader().load('garden/img/hut-wizard.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = this.env.renderer.capabilities.getMaxAnisotropy();
            mat.map = tex;
            mat.emissiveMap = tex;
            mat.emissiveIntensity = 0.22;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;
        });
        this.scene.add(g);
        this.portrait = g;
    }

    /** Papers on the desk: an old maintenance log. Click them to read it (see gearfall-ui.js). */
    _papers() {
        const dk = DESK;
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 352;
        const x = c.getContext('2d');
        x.fillStyle = '#ece0c0';
        x.fillRect(0, 0, 256, 352);
        x.fillStyle = 'rgba(120, 90, 50, 0.18)';
        for (let i = 0; i < 6; i++) {
            x.beginPath();
            x.arc(40 + i * 37, 60 + ((i * 97) % 240), 16 + (i % 3) * 9, 0, Math.PI * 2);
            x.fill();
        }
        x.strokeStyle = '#3a3048';
        x.lineWidth = 2;
        for (let l = 0; l < 13; l++) {
            const y = 40 + l * 22;
            x.beginPath();
            x.moveTo(24, y);
            for (let k = 24; k < 232 - (l % 4) * 18; k += 6) x.lineTo(k, y + Math.sin(k * 0.6 + l) * 2.2);
            x.stroke();
        }
        // a gear drawn in the margin, with an arrow round behind it
        x.strokeStyle = '#7a2a1a';
        x.lineWidth = 3;
        x.beginPath();
        for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2, rr = i % 4 < 2 ? 30 : 24;
            const px = 190 + Math.cos(a) * rr, py = 300 + Math.sin(a) * rr;
            if (i) x.lineTo(px, py);
            else x.moveTo(px, py);
        }
        x.stroke();
        x.strokeRect(222, 268, 16, 16);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const edge = this.mats.paper;
        const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
        this.papers = new THREE.Group();
        this.papersPos = new THREE.Vector3(dk.x - 0.6, dk.h + 0.04, dk.z + 0.06);
        this.papers.position.copy(this.papersPos);
        const under = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.22), edge);
        under.rotation.y = 0.3;
        under.position.set(-0.02, 0.006, -0.01);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.006, 0.29), [edge, edge, face, edge, edge, edge]);
        top.rotation.y = -0.15 + Math.PI / 2;
        top.position.y = 0.016;
        this.papers.add(under, top);
        this.papersTop = top;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.copy(this.papersPos);
        hit.userData.kind = 'papers';
        this.papersHit = hit;
        this.papersHover = 0;
        this.scene.add(this.papers, hit);
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

    /** `type` is what the pointer is over (see pick), or null. */
    setHover(type = null) {
        this.hoverTarget = type === 'orb' ? 1 : 0;
        this.handheld.setHover(type === 'console');
        this.ticketTarget = type === 'ticket' ? 1 : 0;
        this.papersTarget = type === 'papers' ? 1 : 0;
        this.tv?.setHover(type === 'tv');
        this.loft.setHover(type);
    }

    /** Which floor you are on: changes only on the stair, past its halfway step. */
    _level() {
        const p = this.env.controls?.pos;
        if (!p) return;
        if (inStair(p.x, p.z)) {
            const was = this.level;
            this.level = stairY(p.x, p.z) > F2 / 2 ? 1 : 0;
            if (was !== this.level) this.onLevel?.(this.level);
        }
        this.up = inStair(p.x, p.z) ? stairY(p.x, p.z) / F2 : this.level;
    }

    /** `away` is true while the room isn't on screen (falling through the sphere). */
    update(dt, t, away = false) {
        this._level();
        const sky = this.env.sky?.state;
        this.loft.update(dt, t, { night: sky?.night ?? 0.5, day: sky?.day ?? 0.5, up: this.up });
        // the room's own lights step back while you are upstairs, so they don't light the loft from below
        const down = 1 - this.up * 0.75;
        for (const m of this.moons) m.intensity = 2.5 * down;
        this.tv?.update(dt, t, this.env.camera, away);
        this.handheld.update(dt, t, away);
        this.time = t;
        this.hover += ((this.hoverTarget || 0) - this.hover) * Math.min(1, dt * 8);
        this.orbUniforms.uTime.value = t;
        this.orbUniforms.uHover.value = this.hover;
        this.ticketHover += ((this.ticketTarget || 0) - this.ticketHover) * Math.min(1, dt * 8);
        this.ticket.position.y = this.ticketPos.y + this.ticketHover * 0.02 + Math.sin(t * 1.6) * 0.0015;
        this.ticketGlint.material.opacity = 0.25 + 0.12 * Math.sin(t * 2.3) + this.ticketHover * 0.4;
        this.ticketGlint.scale.setScalar(0.3 + this.ticketHover * 0.14);
        this.papersHover += ((this.papersTarget || 0) - this.papersHover) * Math.min(1, dt * 8);
        this.papersTop.position.y = 0.016 + this.papersHover * 0.025;
        this.papersTop.rotation.z = this.papersHover * 0.05;
        const bob = Math.sin(t * 1.2) * 0.004;
        this.orbCore.position.y = this.orbPos.y + bob;
        this.halo.material.opacity = 0.26 + 0.08 * Math.sin(t * 1.7) + this.hover * 0.2;
        const s = 0.9 + this.hover * 0.25 + Math.sin(t * 1.7) * 0.04;
        this.halo.scale.set(s, s, 1);
        this.orbLight.intensity = 3 + Math.sin(t * 1.7) * 0.8 + this.hover * 2;
        this.fireplace.update(dt, t);
        this.lamp.intensity = (9 + Math.sin(t * 2.1) * 0.25) * down;
    }
}
