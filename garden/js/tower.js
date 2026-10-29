// The Observatory, inside: a tower of five floors that is rather larger on the
// inside than out. Each floor is a round hall (a rotunda with a mosaic floor,
// stained glass and floating candles) with rooms opening off it, and a lift of
// light in a shaft that carries you between floors. The rooms live in
// tower-rooms*.js, the endless stacks in tower-library.js and the great
// telescope under the dome in telescope.js.
// Like the Works and the Hut, the tower is built on the first visit, with its
// own scene and a stand-in `world` for the walking controls. Only the floor you
// are on is drawn, and every floor carries the same number of lights, so moving
// between them never recompiles a shader.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch, xf } from './materials.js';
import { signMesh, signTexture, columnGeo } from './architecture.js';
import { cavernRock } from './textures.js';
import { rng, TAU, damp, clamp, smoothstep, lerp, esc } from './util.js';
import { EYE } from './controls.js';
import { TowerAudio } from './tower-audio.js';
import { canvasTex, wallpaper, floorTex, mosaicTex, stainedGlassTex, glow, motes, emissiveMat } from './tower-kit.js';
import { ROOM_DEFS, CENTERPIECES } from './tower-rooms.js';

export const FH = 14;              // floor to floor
const WALL_T = 0.3;
const SIDES = 24;                  // the rotunda is a 24-sided hall
const LIFT = { x: 3.3, z: -3.3, r: 1.2 };
const HOLE = 1.38;                 // the lift shaft's radius
const D2R = Math.PI / 180;

const FLOORS = [
    {
        name: 'The Hall of Hours', sub: 'Ground floor · clocks, curios and a prism', accent: '#ffcf7a', HR: 7.5, ceil: 6.5,
        stone: 0xcdb898, ceilColor: 0x1f2350, mosaic: ['#232048', '#d9b46a', '#7a3456', '#f3e3bf'],
        glass: ['#ffb347', '#ff6f91', '#ffd56b', '#7a5cff', '#3fd0c9', '#e8463c'], light: 0xffc98a, accentLight: 0xff9ad0,
        rooms: [{ slot: 90, kind: 'prism' }, { slot: 180, kind: 'clocks' }, { slot: 270, kind: 'cabinet' }], center: 'astrolabe', door: true,
    },
    {
        name: 'The Gallery of Small Wonders', sub: 'Second floor · brews, birds and mushrooms', accent: '#7ff0c8', HR: 7.5, ceil: 6.5,
        stone: 0xb9c6b4, ceilColor: 0x123a3a, mosaic: ['#123a3a', '#e0b45a', '#ff7a6a', '#d8f5e8'],
        glass: ['#2fd08a', '#8a5cff', '#ffcf4a', '#2fb5ff', '#ff6fa8', '#b8ff6a'], light: 0xfff0c8, accentLight: 0x7affd0,
        rooms: [{ slot: 90, kind: 'alchemy' }, { slot: 180, kind: 'aviary' }, { slot: 270, kind: 'grotto' }], center: 'glasstree',
    },
    {
        name: 'The Archive', sub: 'Third floor · maps, portraits and the endless stacks', accent: '#ff9f7a', HR: 7.5, ceil: 6.5,
        stone: 0xc8a48c, ceilColor: 0x3a1420, mosaic: ['#3a1420', '#d9b46a', '#2a4a7a', '#f6e2c0'],
        glass: ['#c0283c', '#2a5cff', '#ffb02e', '#7a2aa0', '#2fa06a', '#ff7a4a'], light: 0xffc890, accentLight: 0xff8a6a,
        rooms: [{ slot: 90, kind: 'maps' }, { slot: 180, kind: 'library' }, { slot: 270, kind: 'portraits' }], center: 'bookswirl',
    },
    {
        name: 'The Clockwork Loft', sub: 'Fourth floor · an orrery, a harp of light and a tea party', accent: '#ffb45a', HR: 7.5, ceil: 6.5,
        stone: 0x9a9aa6, ceilColor: 0x1a2a2e, mosaic: ['#1a2a2e', '#d98a4a', '#2fa8a0', '#f2dcc0'],
        glass: ['#ff8a2a', '#2fd8ff', '#ffd84a', '#ff4a6a', '#4aff9a', '#a06aff'], light: 0xffd2a0, accentLight: 0x6ae0ff,
        rooms: [{ slot: 90, kind: 'orrery' }, { slot: 180, kind: 'harp' }, { slot: 270, kind: 'teaparty' }], center: 'plasma',
    },
    {
        name: 'The Star Dome', sub: 'Top floor · the Great Telescope', accent: '#9db8ff', HR: 10, ceil: 7.5, dome: true,
        stone: 0x7f86a8, ceilColor: 0x0d1030, mosaic: ['#0d1030', '#c8d4ff', '#4a3aa0', '#f0f4ff'],
        glass: ['#3a5cff', '#9a5cff', '#2fd8ff', '#ff6ad8', '#d8e4ff', '#5a2aa0'], light: 0xc8d4ff, accentLight: 0xb48cff,
        rooms: [{ slot: 90, kind: 'constellations' }, { slot: 180, kind: 'comet' }, { slot: 270, kind: 'aurora' }], center: 'telescope',
    },
];

const invisible = new THREE.MeshBasicMaterial({ visible: false });

export class Tower {
    /** @param {object} env { renderer, ui, mats, audio, quality, camera } */
    constructor(env) {
        this.env = env;
        this.ui = env.ui;
        this.scene = new THREE.Scene();
        this.fogColor = new THREE.Color(0x120c14);
        this.scene.background = this.fogColor.clone();
        this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.012);
        const pmrem = new THREE.PMREMGenerator(env.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.3;
        pmrem.dispose();
        this.scene.add(new THREE.HemisphereLight(0xc8c0ff, 0x3a2418, 0.55));
        this.audio = new TowerAudio(env.audio);
        this.lightCap = env.quality?.tier === 'low' ? 4 : 7;
        this.lowGfx = env.quality?.tier === 'low';
        this.time = 0;
        this.floor = 0;
        this.ride = null;
        this.pending = null;
        this.hovered = null;
        this.liftArmed = false;
        this.doorArmed = false;
        this.area = null;
        this.onExit = null;
        this.onScope = null;
        this.controls = null;

        this._materials(env.mats);
        this.floors = FLOORS.map((def, i) => this._buildFloor(def, i));
        this._lift();
        this._dom();
        this.setFloor(0);

        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: () => self.floorY,
            onDeck: () => false,
            collidersNear: (x, z) => self.cur.grid.get(self._key(x, z)) || [],
            onArrive: () => self._arrive(),
        };
        const HR0 = FLOORS[0].HR;
        this.spawn = { x: 0, z: HR0 - 2.4, yaw: 0 };
        // walking into this spot on the ground floor goes back out of the door
        this.exit = { x: 0, z: HR0 - 0.75 };
        // compile every material now, under the flash, with one floor's worth of lights showing
        env.renderer.compile(this.scene, env.camera);
    }

    get cur() {
        return this.floors[this.floor];
    }

    get floorY() {
        return this.floor * FH;
    }

    get player() {
        return this.controls?.pos ?? { x: 0, z: 0 };
    }

    // ------------------------------------------------------------ materials

    _materials(base) {
        const m = (this.mats = { ...base });
        m.trim = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.7, map: base.wood.map });
        m.gold = new THREE.MeshStandardMaterial({ color: 0xe8c070, roughness: 0.25, metalness: 1 });
        m.silver = new THREE.MeshStandardMaterial({ color: 0xd8dce8, roughness: 0.22, metalness: 1 });
        m.velvet = new THREE.MeshStandardMaterial({ color: 0x6a1a3a, roughness: 1 });
        m.wax = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.7, emissive: 0x5a3a10, emissiveIntensity: 0.25 });
        m.flame = emissiveMat(0xffb04a, 3);
        m.glassClear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.03, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
        m.paper = new THREE.MeshStandardMaterial({ color: 0xf1e7cf, roughness: 0.9 });
        m.cloth = new THREE.MeshStandardMaterial({ color: 0xf6f0e6, roughness: 1 });
        m.black = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.6 });
        m.white = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.5 });
        const rock = cavernRock();
        m.cave = new THREE.MeshStandardMaterial({ map: rock.map, normalMap: rock.normalMap, color: 0x3a6a6a, roughness: 0.95 });
        // the lift shaft: bands of runes that glow from within
        const runes = canvasTex(512, 256, (x, w, h) => {
            x.fillStyle = '#0c0a20';
            x.fillRect(0, 0, w, h);
            const r = rng('shaft-runes');
            for (let band = 0; band < 4; band++) {
                const y = 20 + band * 62;
                x.fillStyle = 'rgba(120,150,255,0.18)';
                x.fillRect(0, y - 4, w, 2);
                x.fillRect(0, y + 40, w, 2);
                x.strokeStyle = band % 2 ? '#9ad8ff' : '#c9a7ff';
                x.lineWidth = 3;
                for (let i = 0; i < 18; i++) {
                    const cx = i * 28 + 10;
                    x.beginPath();
                    const k = Math.floor(r() * 5);
                    if (k === 0) x.arc(cx + 8, y + 18, 8, 0, TAU);
                    if (k <= 1) x.moveTo(cx, y + 4), x.lineTo(cx + 16, y + 34);
                    if (k === 2) x.moveTo(cx + 8, y + 2), x.lineTo(cx + 8, y + 36), x.moveTo(cx, y + 18), x.lineTo(cx + 16, y + 18);
                    if (k === 3) x.moveTo(cx, y + 34), x.lineTo(cx + 8, y + 4), x.lineTo(cx + 16, y + 34);
                    if (k === 4) x.rect(cx + 2, y + 8, 12, 20);
                    x.stroke();
                }
            }
        }, { repeat: [3, 2] });
        m.shaft = new THREE.MeshStandardMaterial({ color: 0x181430, emissive: 0xffffff, emissiveMap: runes, emissiveIntensity: 0.9, map: runes, side: THREE.BackSide, roughness: 0.8 });
        m.cap = new THREE.MeshStandardMaterial({ color: 0x0c0a20, emissive: 0x6a7aff, emissiveIntensity: 0.6, roughness: 0.8 });
    }

    // ------------------------------------------------------------ floors

    _buildFloor(def, i) {
        const group = new THREE.Group();
        group.position.y = i * FH;
        group.visible = false;
        this.scene.add(group);
        const fl = { i, def, HR: def.HR, group, rooms: [], hits: [], updaters: [], colliders: [], lights: [], mats: {}, grid: null };
        fl.mats.stone = this.mats.granite.clone();
        fl.mats.stone.color.set(def.stone);
        fl.mats.mosaic = new THREE.MeshStandardMaterial({ map: mosaicTex(def.mosaic, i), roughness: 0.55, metalness: 0.05 });
        fl.mats.ceil = new THREE.MeshStandardMaterial({ map: wallpaper('stars', def.ceilColor, '#d9b46a', '#f3e3bf', [10, 10]), roughness: 0.9 });
        fl.mats.glass = [0, 1, 2].map((k) => {
            const tex = stainedGlassTex(def.glass, i * 3 + k);
            return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.95, roughness: 0.3, side: THREE.DoubleSide });
        });
        // the light pool: always the same number per floor
        for (let k = 0; k < this.lightCap; k++) {
            const L = new THREE.PointLight(0xffffff, 0, 10, 1.8);
            L.position.set(0, -50, 0);
            group.add(L);
            fl.lights.push(L);
        }
        fl.nextLight = 0;
        const hub = this._hubCtx(fl);
        this._hub(fl, hub);
        for (const r of def.rooms) this._room(fl, r);
        // the centrepiece of the rotunda
        const cp = CENTERPIECES[def.center];
        if (cp) {
            const api = cp(hub);
            if (api?.update) fl.updaters.push(api.update);
            if (api) fl.center = api;
        }
        group.add(hub.batch.build({ ...this.mats, ...fl.mats, ...hub.roomMats }, { castShadow: false, receiveShadow: false }));
        fl.grid = this._grid(fl.colliders);
        return fl;
    }

    _claimLight(fl, color, intensity, distance, x, y, z) {
        const L = fl.lights[fl.nextLight++];
        if (!L) return new THREE.PointLight();   // over the cap: a light that is never added
        L.color.set(color);
        L.intensity = intensity;
        L.distance = distance;
        L.position.set(x, y, z);
        L.userData.base = intensity;
        return L;
    }

    _key(x, z) {
        return Math.floor(x / 3) * 7919 + Math.floor(z / 3);
    }

    _grid(colliders) {
        const grid = new Map();
        for (const c of colliders) {
            for (let i = Math.floor((c.x - c.r) / 3); i <= Math.floor((c.x + c.r) / 3); i++) {
                for (let j = Math.floor((c.z - c.r) / 3); j <= Math.floor((c.z + c.r) / 3); j++) {
                    const k = i * 7919 + j;
                    if (!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(c);
                }
            }
        }
        return grid;
    }

    /** A building context: helpers in a local frame (x, z, turned by ry) on a floor. */
    _ctx(fl, frame, def) {
        const tower = this;
        const group = new THREE.Group();
        group.position.set(frame.x, 0, frame.z);
        group.rotation.y = frame.ry;
        fl.group.add(group);
        const batch = new Batch();
        const c = Math.cos(frame.ry), s = Math.sin(frame.ry);
        const toFloor = (lx, lz) => ({ x: frame.x + lx * c + lz * s, z: frame.z - lx * s + lz * c });
        const toLocal = (x, z) => {
            const dx = x - frame.x, dz = z - frame.z;
            return { x: dx * c - dz * s, z: dx * s + dz * c };
        };
        const tmp = new THREE.Vector3();
        const ctx = {
            tower, floor: fl, group, batch, def, frame, roomMats: {},
            W: def.W, D: def.D, ceil: def.ceil,
            mats: this.mats, audio: this.audio, rng: rng((def.kind || 'hub') + fl.i), low: this.lowGfx,
            toFloor, toLocal,
            box(key, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
                batch.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry, 1, 1, 1, rx, rz));
            },
            geo(key, g, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
                batch.add(key, g, xf(x, y, z, ry, sx, sy, sz, rx, rz));
            },
            mat(key, material) {
                ctx.roomMats[key] = material;
                return material;
            },
            add(...objs) {
                group.add(...objs);
                return objs[0];
            },
            collide(x, z, r) {
                const p = toFloor(x, z);
                fl.colliders.push({ x: p.x, z: p.z, r });
            },
            collideBox(x, z, w, d) {
                const n = Math.max(1, Math.ceil(Math.max(w, d) / 0.5));
                for (let i = 0; i < n; i++) {
                    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
                    if (w >= d) ctx.collide(x + t * (w - d * 0.6), z, d / 2 + 0.05);
                    else ctx.collide(x, z + t * (d - w * 0.6), w / 2 + 0.05);
                }
            },
            /** Make a mesh clickable: { label, onClick(info), range, onHover(on) }. */
            hit(mesh, opts) {
                mesh.userData.hit = { range: 6.5, ...opts, ctx };
                fl.hits.push(mesh);
                return mesh;
            },
            proxy(w, h, d, x, y, z, opts) {
                const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), invisible);
                m.position.set(x, y, z);
                group.add(m);
                return ctx.hit(m, opts);
            },
            light(color, intensity, dist, x, y, z) {
                ctx.lit = true;
                const p = toFloor(x, z);
                return tower._claimLight(fl, color, intensity, dist, p.x, y, p.z);
            },
            say: (text, ms) => tower.say(text, ms),
            update(fn) {
                fl.updaters.push(fn);
            },
            /** The player's feet in this frame's local coordinates. */
            player() {
                const p = tower.player;
                return toLocal(p.x, p.z);
            },
            /** The camera's position in this frame's local coordinates. */
            camLocal(out = new THREE.Vector3()) {
                const cam = tower.env.camera;
                tmp.copy(cam.position);
                tmp.y -= fl.i * FH;
                const l = toLocal(tmp.x, tmp.z);
                return out.set(l.x, tmp.y, l.z);
            },
            get time() {
                return tower.time;
            },
        };
        return ctx;
    }

    _hubCtx(fl) {
        return this._ctx(fl, { x: 0, z: 0, ry: 0 }, { kind: 'hub', W: fl.HR * 2, D: fl.HR * 2, ceil: fl.def.ceil });
    }

    // ------------------------------------------------------------ the rotunda

    _hub(fl, ctx) {
        const { def, HR } = fl;
        const H = def.ceil;
        const b = ctx.batch;
        ctx.mat('stone', fl.mats.stone);
        // floor and ceiling discs, with the lift's hole cut through them where it passes
        const disc = (hole) => {
            const s = new THREE.Shape();
            s.absarc(0, 0, HR + 0.05, 0, TAU, false);
            if (hole) s.holes.push(new THREE.Path().absarc(hole.x, hole.y, HOLE, 0, TAU, true));
            const g = new THREE.ShapeGeometry(s, 64);
            const uv = g.attributes.uv, pos = g.attributes.position;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * HR) + 0.5, pos.getY(i) / (2 * HR) + 0.5);
            return g;
        };
        const top = fl.i === FLOORS.length - 1;
        const floorMesh = new THREE.Mesh(disc(fl.i > 0 ? { x: LIFT.x, y: -LIFT.z } : null).rotateX(-Math.PI / 2), fl.mats.mosaic);
        ctx.add(floorMesh);
        if (!def.dome) {
            const ceil = new THREE.Mesh(disc(top ? null : { x: LIFT.x, y: LIFT.z }).rotateX(Math.PI / 2), fl.mats.ceil);
            ceil.position.y = H;
            ctx.add(ceil);
        }
        // the 24 wall panels: openings where rooms (and the front door) are, lancets and sconces between
        const openings = new Set(def.rooms.map((r) => Math.round(r.slot / 15) % SIDES));
        openings.add(0);
        const side = 2 * HR * Math.tan(Math.PI / SIDES) + 0.04;
        fl.flames = [];
        for (let k = 0; k < SIDES; k++) {
            const a = (k / SIDES) * TAU;
            const sx = Math.sin(a), sz = Math.cos(a);
            const at = (r, y, ry = a + Math.PI) => [sx * r, y, sz * r, ry];
            const open = openings.has(k);
            const nearOpen = openings.has((k + 1) % SIDES) || openings.has((k + SIDES - 1) % SIDES);
            if (open && !(k === 0 && !def.door)) {
                // an archway: lintel above, and brass columns either side
                ctx.box('stone', side, H - 3.3, WALL_T, ...at(HR + WALL_T / 2, 3.3 + (H - 3.3) / 2));
                const arch = new THREE.TorusGeometry(1.0, 0.07, 8, 28, Math.PI);
                ctx.geo('gold', arch, ...at(HR - 0.03, 3.05));
                for (const sd of [-1, 1]) {
                    const px = sx * (HR - 0.25) + Math.cos(a) * sd * 1.18, pz = sz * (HR - 0.25) - Math.sin(a) * sd * 1.18;
                    ctx.geo('stone', columnGeo(3.1, 0.16, 12), px, 0, pz);
                    ctx.geo('gold', new THREE.SphereGeometry(0.16, 12, 8), px, 3.22, pz);
                    ctx.collide(px, pz, 0.28);
                }
                continue;
            }
            ctx.box('stone', side, H, WALL_T, ...at(HR + WALL_T / 2, H / 2));
            ctx.box('trim', side, 0.36, 0.1, ...at(HR - 0.04, 0.18));
            ctx.box('trim', side, 0.22, 0.14, ...at(HR - 0.05, H - 0.11));
            if (open) {
                // floors above the ground have a great rose window where the door would be
                const rose = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), fl.mats.glass[0]);
                rose.position.set(sx * (HR - 0.03), 3.6, sz * (HR - 0.03));
                rose.rotation.y = a + Math.PI;
                ctx.add(rose);
                ctx.geo('gold', new THREE.TorusGeometry(1.52, 0.08, 8, 48), ...at(HR - 0.05, 3.6));
                for (let s = 0; s < 8; s++) ctx.geo('trim', new THREE.BoxGeometry(0.05, 2.95, 0.05), sx * (HR - 0.06), 3.6, sz * (HR - 0.06), a + Math.PI, 1, 1, 1, 0, (s / 8) * Math.PI);
                continue;
            }
            if (k % 2 === 1 && !nearOpen || (k % 2 === 1 && def.dome)) {
                // a tall lancet of stained glass
                const shape = new THREE.Shape();
                const w = 0.52, h = 3.7;
                shape.moveTo(-w, 0);
                shape.lineTo(w, 0);
                shape.lineTo(w, h - w * 1.4);
                shape.quadraticCurveTo(w, h - w * 0.3, 0, h);
                shape.quadraticCurveTo(-w, h - w * 0.3, -w, h - w * 1.4);
                shape.lineTo(-w, 0);
                const g = new THREE.ShapeGeometry(shape, 8);
                const uv = g.attributes.uv, pos = g.attributes.position;
                for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * w) + 0.5, pos.getY(i) / h);
                const win = new THREE.Mesh(g, fl.mats.glass[k % 3]);
                win.position.set(sx * (HR - 0.02), 1.4, sz * (HR - 0.02));
                win.rotation.y = a + Math.PI;
                ctx.add(win);
                ctx.box('stone', 1.4, 0.16, 0.3, ...at(HR - 0.12, 1.32));
            } else {
                // a sconce with a candle
                ctx.box('gold', 0.08, 0.5, 0.08, ...at(HR - 0.06, 2.3));
                ctx.box('gold', 0.06, 0.06, 0.4, ...at(HR - 0.22, 2.45));
                ctx.geo('gold', new THREE.CylinderGeometry(0.12, 0.06, 0.08, 10), sx * (HR - 0.42), 2.48, sz * (HR - 0.42));
                ctx.geo('wax', new THREE.CylinderGeometry(0.045, 0.05, 0.28, 8), sx * (HR - 0.42), 2.66, sz * (HR - 0.42));
                const f = glow(0xffb45a, 0.5, 0.85);
                f.position.set(sx * (HR - 0.42), 2.86, sz * (HR - 0.42));
                ctx.add(f);
                fl.flames.push(f);
            }
        }
        if (def.door) {
            // the front door you came in by, inside its arch
            ctx.box('darkWood', 1.6, 2.9, 0.12, 0, 1.45, HR + 0.05);
            ctx.box('iron', 1.6, 0.09, 0.14, 0, 0.7, HR + 0.03);
            ctx.box('iron', 1.6, 0.09, 0.14, 0, 2.2, HR + 0.03);
            ctx.geo('brass', new THREE.TorusGeometry(0.1, 0.02, 6, 14), 0.5, 1.4, HR - 0.02);
            const mat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, emissive: 0x9db8ff, emissiveIntensity: 0.0, roughness: 0.9 });
            const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.85), mat);
            leaf.position.set(0, 1.45, HR - 0.03);
            leaf.rotation.y = Math.PI;
            ctx.add(leaf);
            ctx.hit(leaf, { label: 'The front door · back to the garden', onClick: () => this.controls?.walkTo([{ x: this.exit.x, z: this.exit.z }]), range: 99 });
            const sign = signMesh(signTexture('\u{1F33F}', 'The Garden', 'This way out', '#9fe0a0', 1024, 256), 1.8, 0.45, 0.3);
            sign.position.set(0, 3.7, HR - 0.08);
            sign.rotation.y = Math.PI;
            ctx.add(sign);
        }
        // floating candles drifting under the ceiling
        const n = this.lowGfx ? 14 : 26, r = rng('candles' + fl.i);
        const candles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 8), this.mats.wax, n);
        const flames = motes(n, 0xffc070, 0.32, 0.95);
        const cs = [];
        for (let i = 0; i < n; i++) {
            const a = r() * TAU, d = 1.6 + Math.sqrt(r()) * (HR - 2.6);
            cs.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, y: H - 1.8 - r() * 1.6, ph: r() * TAU });
        }
        if (def.dome) for (const c of cs) c.y += 1.2;
        ctx.add(candles, flames);
        const o = new THREE.Object3D();
        ctx.update((dt, t) => {
            const fp = flames.geometry.attributes.position;
            cs.forEach((c, i) => {
                const y = c.y + Math.sin(t * 0.6 + c.ph) * 0.15;
                o.position.set(c.x + Math.sin(t * 0.21 + c.ph) * 0.1, y, c.z);
                o.updateMatrix();
                candles.setMatrixAt(i, o.matrix);
                fp.setXYZ(i, o.position.x, y + 0.22, c.z);
            });
            candles.instanceMatrix.needsUpdate = true;
            fp.needsUpdate = true;
            fl.flames.forEach((f, i) => (f.material.opacity = 0.7 + 0.2 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i)));
        });
        // lights: warm overhead and a coloured fill
        ctx.light(def.light, 22, 22, 0, H - 1.2, 0);
        ctx.light(def.accentLight, 8, 14, -LIFT.x, 2.6, -LIFT.z);
        // the lift's shaft, above and below
        const shaft = (y0, y1, cap) => {
            const g = new THREE.CylinderGeometry(HOLE, HOLE, y1 - y0, 32, 1, true);
            const m = new THREE.Mesh(g, this.mats.shaft);
            m.position.set(LIFT.x, (y0 + y1) / 2, LIFT.z);
            ctx.add(m);
            for (let y = y0 + 1.4; y < y1; y += 2.2) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLE - 0.02, 0.035, 6, 40), this.mats.gold);
                ring.rotation.x = Math.PI / 2;
                ring.position.set(LIFT.x, y, LIFT.z);
                ctx.add(ring);
            }
            if (cap !== undefined) {
                const c = new THREE.Mesh(new THREE.CircleGeometry(HOLE, 32).rotateX(cap > 0 ? Math.PI / 2 : -Math.PI / 2), this.mats.cap);
                c.position.set(LIFT.x, cap > 0 ? y1 - 0.02 : y0 + 0.02, LIFT.z);
                ctx.add(c);
            }
        };
        if (!top) shaft(H, FH, 1);
        if (fl.i > 0) shaft(-(FH - FLOORS[fl.i - 1].ceil), 0);
        // the lift's brass collar on the floor, and a sign
        const collar = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.08, 0.09, 8, 40).rotateX(Math.PI / 2), this.mats.gold);
        collar.position.set(LIFT.x, 0.03, LIFT.z);
        ctx.add(collar);
        const ls = signMesh(signTexture('✨', 'The Lift', 'Step on, choose a floor', '#b9a7ff', 1024, 256), 1.5, 0.375, 0.35);
        const la = Math.atan2(LIFT.x, LIFT.z);
        ls.position.set(Math.sin(la) * (HR - 0.06), 5.75, Math.cos(la) * (HR - 0.06));
        ls.rotation.y = la + Math.PI;
        ctx.add(ls);
        if (def.dome) this._dome(fl, ctx);
    }

    /** The top floor's roof: a dome painted with gold stars, its slit open to the real sky. */
    _dome(fl, ctx) {
        const { HR, def } = fl;
        const slitA = -45 * D2R;   // the telescope points this way (see telescope.js)
        const u0 = (((slitA + Math.PI / 2) / TAU) % 1 + 1) % 1;
        const tex = canvasTex(2048, 512, (x, w, h) => {
            const g = x.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#0a0c2a');
            g.addColorStop(1, '#1c2250');
            x.fillStyle = g;
            x.fillRect(0, 0, w, h);
            const r = rng('dome');
            // gold meridians and stars painted on the plaster
            x.strokeStyle = 'rgba(217,180,106,0.35)';
            x.lineWidth = 2;
            for (let i = 0; i < 24; i++) {
                x.beginPath();
                x.moveTo((i / 24) * w, 0);
                x.lineTo((i / 24) * w, h);
                x.stroke();
            }
            for (const v of [0.35, 0.65, 0.9]) {
                x.beginPath();
                x.moveTo(0, v * h);
                x.lineTo(w, v * h);
                x.stroke();
            }
            for (let i = 0; i < 700; i++) {
                const s = r() < 0.08 ? 3 + r() * 3 : 0.8 + r() * 1.4;
                x.fillStyle = r() < 0.7 ? '#e8c878' : '#fff4d8';
                x.beginPath();
                x.arc(r() * w, r() * h, s, 0, TAU);
                x.fill();
            }
            // painted constellations
            x.strokeStyle = 'rgba(255,230,170,0.5)';
            for (let c = 0; c < 14; c++) {
                let px = r() * w, py = 40 + r() * (h - 80);
                x.beginPath();
                x.moveTo(px, py);
                for (let k = 0; k < 4 + r() * 4; k++) {
                    px += (r() - 0.5) * 120;
                    py += (r() - 0.5) * 70;
                    x.lineTo(px, py);
                    x.fillStyle = '#ffe9b0';
                    x.fillRect(px - 2.5, py - 2.5, 5, 5);
                }
                x.stroke();
            }
            // the slit, open to the night
            const sw = 0.045 * w;
            for (const uu of [u0, u0 - 1, u0 + 1]) {
                const cx = uu * w;
                x.fillStyle = '#01010a';
                x.fillRect(cx - sw / 2, 0, sw, h);
                for (let i = 0; i < 140; i++) {
                    x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
                    x.fillRect(cx - sw / 2 + r() * sw, r() * h, 1.6, 1.6);
                }
                const ng = x.createRadialGradient(cx, h * 0.5, 0, cx, h * 0.5, sw);
                ng.addColorStop(0, 'rgba(160,90,255,0.35)');
                ng.addColorStop(1, 'rgba(160,90,255,0)');
                x.fillStyle = ng;
                x.fillRect(cx - sw / 2, 0, sw, h);
                x.fillStyle = '#c8a050';
                x.fillRect(cx - sw / 2 - 6, 0, 6, h);
                x.fillRect(cx + sw / 2, 0, 6, h);
            }
        });
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.8, side: THREE.BackSide });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(HR + 0.3, 64, 24, 0, TAU, 0, Math.PI / 2), mat);
        dome.position.y = def.ceil;
        ctx.add(dome);
        ctx.geo('gold', new THREE.TorusGeometry(HR + 0.05, 0.14, 8, 96).rotateX(Math.PI / 2), 0, def.ceil, 0);
    }

    // ------------------------------------------------------------ rooms

    _room(fl, slot) {
        const def = { ...ROOM_DEFS[slot.kind], kind: slot.kind };
        const a = slot.slot * D2R;
        const dist = fl.HR + WALL_T + def.D / 2;
        const frame = { x: Math.sin(a) * dist, z: Math.cos(a) * dist, ry: a + Math.PI };
        const ctx = this._ctx(fl, frame, def);
        ctx.mat('rw', new THREE.MeshStandardMaterial({ map: wallpaper(def.wall[0], def.wall[1], def.wall[2], def.wall[3], [Math.round(def.W / 2.4), Math.round(def.ceil / 2.4)]), roughness: 0.92 }));
        const ft = def.floor;
        ctx.mat('rf', ft === 'wood' ? this.mats.wood : ft === 'cave' ? this.mats.cave : new THREE.MeshStandardMaterial({ map: floorTex(ft[0], ft[1], ft[2], [def.W / 2, def.D / 2]), roughness: ft[3] ?? 0.6, metalness: 0.05 }));
        ctx.mat('rc', new THREE.MeshStandardMaterial({ color: def.ceilColor ?? 0x2a2030, roughness: 0.95 }));
        this._shell(ctx, def);
        const api = ROOM_DEFS[slot.kind].build(ctx) || {};
        if (api.update) fl.updaters.push(api.update);
        if (fl.nextLight <= fl.lights.length && !api.ownLights && !ctx.lit) ctx.light(def.lightColor ?? 0xffd8a0, 12, 16, 0, def.ceil - 0.6, 0);
        fl.group.add(ctx.batch.build({ ...this.mats, ...fl.mats, ...ctx.roomMats }, { castShadow: false, receiveShadow: false }));
        // the sign over the arch, on the rotunda side
        const sign = signMesh(signTexture(def.emoji, def.title, def.sub, def.accent, 1024, 256), 2.3, 0.575, 0.32);
        sign.position.set(Math.sin(a) * (fl.HR - 0.08), 4.75, Math.cos(a) * (fl.HR - 0.08));
        sign.rotation.y = a + Math.PI;
        fl.group.add(sign);
        const room = { ctx, def, frame, api, walk: api.walk };
        fl.rooms.push(room);
        return room;
    }

    _shell(ctx, def) {
        const { W, D, ceil } = def;
        const T = WALL_T, DW = 1.9, DH = 3.1;
        ctx.box('rf', W, 0.2, D + T, 0, -0.1, T / 2);
        if (!def.noCeil) ctx.box('rc', W + 2 * T, 0.2, D + 2 * T, 0, ceil + 0.1, 0);
        if (!def.backOpen) ctx.box('rw', W + 2 * T, ceil, T, 0, ceil / 2, -D / 2 - T / 2);
        for (const s of [-1, 1]) ctx.box('rw', T, ceil, D + 2 * T, s * (W / 2 + T / 2), ceil / 2, 0);
        const fw = (W - DW) / 2;
        for (const s of [-1, 1]) ctx.box('rw', fw, ceil, T, s * (DW / 2 + fw / 2), ceil / 2, D / 2 + T / 2);
        ctx.box('rw', DW, ceil - DH, T, 0, DH + (ceil - DH) / 2, D / 2 + T / 2);
        // skirting and cornice
        if (!def.noTrim) {
            for (const s of [-1, 1]) {
                ctx.box('trim', 0.06, 0.22, D, s * (W / 2 - 0.03), 0.11, 0);
                ctx.box('trim', 0.12, 0.16, D, s * (W / 2 - 0.06), ceil - 0.08, 0);
                ctx.box('trim', fw, 0.22, 0.06, s * (DW / 2 + fw / 2), 0.11, D / 2 - 0.03);
            }
            if (!def.backOpen) {
                ctx.box('trim', W, 0.22, 0.06, 0, 0.11, -D / 2 + 0.03);
                ctx.box('trim', W, 0.16, 0.12, 0, ceil - 0.08, -D / 2 + 0.06);
            }
        }
        // the inside of the doorway
        ctx.box('trim', 0.14, DH, T + 0.1, -DW / 2 - 0.02, DH / 2, D / 2 + T / 2);
        ctx.box('trim', 0.14, DH, T + 0.1, DW / 2 + 0.02, DH / 2, D / 2 + T / 2);
        ctx.box('trim', DW + 0.3, 0.16, T + 0.1, 0, DH, D / 2 + T / 2);
    }

    // ------------------------------------------------------------ walking

    /** Is (x, z) floor you can stand on, on the current floor? */
    walkable(x, z) {
        return this._areaAt(x, z, 0.35) !== undefined;
    }

    /** -1 for the rotunda, a room's index, or undefined for inside a wall. `m` is the margin kept from walls. */
    _areaAt(x, z, m = 0) {
        const fl = this.cur;
        if (x * x + z * z < (fl.HR - m) ** 2) return -1;
        for (let i = 0; i < fl.rooms.length; i++) {
            const rm = fl.rooms[i], d = rm.def;
            const l = rm.ctx.toLocal(x, z);
            if (Math.abs(l.x) < d.W / 2 - m && Math.abs(l.z) < d.D / 2 - m) return i;
            if (Math.abs(l.x) < 0.95 - Math.max(m, 0.25) && l.z > d.D / 2 - 0.6 && l.z < d.D / 2 + WALL_T + 0.6) return i;
            if (rm.walk?.(l.x, l.z, m)) return i;
        }
        return undefined;
    }

    /** True if a straight line between two points stays out of the walls. */
    _clear(ax, az, bx, bz) {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35);
        for (let i = 1; i < n - 1; i++) {
            const k = i / n;
            if (this._areaAt(lerp(ax, bx, k), lerp(az, bz, k), -0.05) === undefined) return false;
        }
        return true;
    }

    /** A walking route to (x, z), through the doorways. */
    plan(tx, tz) {
        const p = this.player;
        const a = this._areaAt(p.x, p.z, -0.1), b = this._areaAt(tx, tz, -0.1);
        const pts = [];
        const door = (i, out) => {
            const rm = this.cur.rooms[i];
            return rm.ctx.toFloor(0, rm.def.D / 2 + (out ? WALL_T + 0.9 : -0.8));
        };
        if (a !== b) {
            if (a >= 0) pts.push(door(a, false), door(a, true));
            if (b >= 0) pts.push(door(b, true), door(b, false));
        }
        pts.push({ x: tx, z: tz });
        return pts;
    }

    _arrive() {
        const h = this.pending;
        this.pending = null;
        if (!h) return;
        const p = this.player;
        if (Math.hypot(h.point.x - p.x, h.point.z - p.z) < h.mesh.userData.hit.range + 0.8) this._activate(h);
    }

    // ------------------------------------------------------------ picking

    /** What the ray points at: something to click, or the floor. */
    pick(ray) {
        const fl = this.cur;
        const y0 = this.floorY;
        const cam = ray.ray.origin;
        let best = null;
        const shown = (o) => {
            for (; o && o !== fl.group; o = o.parent) if (!o.visible) return false;
            return true;
        };
        const list = fl.hits.filter((m) => shown(m) && m.userData.hit.active?.() !== false);
        for (const hit of ray.intersectObjects(list, false)) {
            if (!this._clear(cam.x, cam.z, hit.point.x, hit.point.z)) continue;
            best = { type: 'act', mesh: hit.object, point: hit.point.clone().setY(hit.point.y - y0), instanceId: hit.instanceId, t: hit.distance };
            break;
        }
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y < -1e-4) {
            const t = (y0 - o.y) / d.y;
            if (!best || t < best.t) {
                const point = o.clone().addScaledVector(d, t);
                if (t < 80 && this.walkable(point.x, point.z) && this._clear(cam.x, cam.z, point.x, point.z)) return { type: 'ground', point, t };
            }
        }
        return best;
    }

    /** Pointer moves: a label for things you can click. Returns true when the pointer should show a hand. */
    hover(ray, mx, my) {
        const h = this.ride ? null : this.pick(ray);
        const mesh = h?.type === 'act' ? h.mesh : null;
        if (mesh !== this.hovered?.mesh || h?.instanceId !== this.hovered?.instanceId) {
            this.hovered?.mesh.userData.hit.onHover?.(false, this.hovered);
            this.hovered = mesh ? h : null;
            mesh?.userData.hit.onHover?.(true, h);
        }
        const tip = this.dom.tip;
        if (mesh) {
            const lab = mesh.userData.hit.label;
            const text = typeof lab === 'function' ? lab(h) : lab;
            if (text) {
                if (tip.textContent !== text) tip.textContent = text;
                tip.hidden = false;
                tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, mx + 18)}px`;
                tip.style.top = `${Math.min(innerHeight - 40, my + 14)}px`;
            } else tip.hidden = true;
        } else tip.hidden = true;
        return !!mesh;
    }

    clearHover() {
        this.hovered?.mesh.userData.hit.onHover?.(false, this.hovered);
        this.hovered = null;
        this.dom.tip.hidden = true;
    }

    /** A tap or click: use the thing, walk to it, or walk to the floor. Returns the kind of hit. */
    tap(ray) {
        if (this.ride || !this.controls?.enabled) return null;
        const h = this.pick(ray);
        if (!h) return null;
        const c = this.controls;
        if (h.type === 'ground') {
            this.pending = null;
            c.walkTo(this.plan(h.point.x, h.point.z));
            return h;
        }
        const info = h.mesh.userData.hit;
        const p = this.player;
        const d = Math.hypot(h.point.x - p.x, h.point.z - p.z);
        if (d <= info.range) {
            this._activate(h);
            return h;
        }
        // too far: walk up to it first
        let sx = h.point.x, sz = h.point.z;
        if (info.stand) ({ x: sx, z: sz } = info.ctx.toFloor(info.stand.x, info.stand.z));
        else {
            const k = Math.max(0, d - info.range * 0.6) / d;
            sx = p.x + (h.point.x - p.x) * k;
            sz = p.z + (h.point.z - p.z) * k;
            for (let i = 0; i < 12 && !this.walkable(sx, sz); i++) {
                sx = lerp(sx, p.x, 0.2);
                sz = lerp(sz, p.z, 0.2);
            }
        }
        this.pending = h;
        c.walkTo(this.plan(sx, sz));
        return h;
    }

    _activate(h) {
        const info = h.mesh.userData.hit;
        info.onClick?.({ ...h, local: info.ctx.toLocal(h.point.x, h.point.z) });
    }

    // ------------------------------------------------------------ the lift

    _lift() {
        const g = new THREE.Group();
        const plate = canvasTex(512, 512, (x, w) => {
            const c = w / 2;
            const grd = x.createRadialGradient(c, c, 0, c, c, c);
            grd.addColorStop(0, '#6a5cff');
            grd.addColorStop(0.6, '#241a60');
            grd.addColorStop(1, '#0c0828');
            x.fillStyle = grd;
            x.fillRect(0, 0, w, w);
            x.strokeStyle = '#d8c8ff';
            x.lineWidth = 5;
            for (const rr of [240, 200, 120]) {
                x.beginPath();
                x.arc(c, c, rr, 0, TAU);
                x.stroke();
            }
            x.fillStyle = '#efe4ff';
            x.font = '600 34px Georgia, serif';
            x.textAlign = 'center';
            x.textBaseline = 'middle';
            const glyphs = '✶☽☉✦♄♃✧☿';
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * TAU;
                x.save();
                x.translate(c + Math.cos(a) * 220, c + Math.sin(a) * 220);
                x.rotate(a + Math.PI / 2);
                x.fillText(glyphs[k % glyphs.length], 0, 0);
                x.restore();
            }
            for (let k = 0; k < 5; k++) {
                const a = (k / 5) * TAU - Math.PI / 2;
                x.beginPath();
                x.moveTo(c, c);
                x.lineTo(c + Math.cos(a) * 110, c + Math.sin(a) * 110);
                x.stroke();
            }
        });
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(HOLE - 0.05, HOLE - 0.05, 0.08, 48), [this.mats.gold, new THREE.MeshStandardMaterial({ map: plate, emissive: 0xffffff, emissiveMap: plate, emissiveIntensity: 0.8, roughness: 0.4 }), this.mats.gold]);
        disc.position.y = 0.04;
        g.add(disc);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE - 0.05, 0.05, 8, 48).rotateX(Math.PI / 2), this.mats.gold);
        rim.position.y = 0.08;
        g.add(rim);
        // a ring of motes that spins faster while it rides
        this.liftMotes = motes(40, 0xb9a7ff, 0.12, 0.9);
        g.add(this.liftMotes);
        this.liftGlow = glow(0x9a8aff, 3.2, 0.25);
        this.liftGlow.position.y = 0.3;
        g.add(this.liftGlow);
        g.position.set(LIFT.x, 0, LIFT.z);
        this.scene.add(g);
        this.liftGroup = g;
        this.liftSpin = 0;
    }

    _liftHit() {
        // every floor gets an invisible target over the disc
        for (const fl of this.floors) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(HOLE, HOLE, 0.3, 16), invisible);
            m.position.set(LIFT.x, 0.15, LIFT.z);
            fl.group.add(m);
            m.userData.hit = { label: 'The Lift · stand on it to choose a floor', range: 99, onClick: () => this.controls?.walkTo(this.plan(LIFT.x, LIFT.z)), ctx: { toLocal: (x, z) => ({ x, z }) } };
            fl.hits.push(m);
        }
    }

    /** Ride the lift to floor `to`. */
    rideTo(to) {
        if (this.ride || to === this.floor || to < 0 || to >= this.floors.length || !this.controls) return;
        const c = this.controls;
        this.ride = { from: this.floor, to, t: 0, dur: 1.9 + Math.abs(to - this.floor) * 1.05, yaw: c.yaw, pitch: c.pitch, spin: (to > this.floor ? 1 : -1) * 0.5 };
        c.enabled = false;
        c.route = null;
        c.keys.clear();
        c.vel.set(0, 0);
        this.pending = null;
        this.clearHover();
        this.dom.lift.hidden = true;
        this.audio.liftRide(true);
        this.audio.liftPitch(to / (this.floors.length - 1));
    }

    _rideUpdate(dt, camera) {
        const r = this.ride;
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const feet = lerp(r.from * FH, r.to * FH, e);
        // only the floor whose hall the camera is in is drawn; floors swap inside the shaft
        const showing = clamp(Math.floor((feet + FH - 10.25) / FH), 0, this.floors.length - 1);
        if (showing !== this.floor) this.setFloor(showing, true);
        this.liftGroup.position.y = feet;
        const yaw = r.yaw + r.spin * Math.sin(e * Math.PI);
        camera.position.set(LIFT.x, feet + EYE, LIFT.z);
        camera.rotation.set(lerp(r.pitch, 0.12, Math.sin(k * Math.PI)), yaw, 0, 'YXZ');
        if (k >= 1) {
            this.ride = null;
            this.setFloor(r.to);
            const c = this.controls;
            c.teleport(LIFT.x, LIFT.z, r.yaw);
            c.pitch = r.pitch;
            c.enabled = true;
            this.liftArmed = false;
            this.audio.liftRide(false);
            this.audio.arp([74, 78, 81], 0.08, 0.03);
            this._zone(true);
        }
    }

    setFloor(i, quiet) {
        this.floor = i;
        this.floors.forEach((f, k) => (f.group.visible = k === i));
        this.liftGroup.position.y = i * FH;
        this.pending = null;
        if (!quiet) this.area = null;
    }

    // ------------------------------------------------------------ DOM

    _dom() {
        const $ = (id) => document.getElementById(id);
        this.dom = { tip: $('tower-tip'), say: $('tower-say'), lift: $('lift-panel') };
        const list = $('lift-floors');
        list.innerHTML = this.floors.map((f, i) => `<button class="lift-btn" data-floor="${i}"><span class="lift-n">${i === 0 ? 'G' : i + 1}</span><span class="lift-name">${esc(f.def.name)}</span></button>`).join('');
        list.onclick = (e) => {
            const b = e.target.closest('[data-floor]');
            if (b) this.rideTo(Number(b.dataset.floor));
        };
        this._liftHit();
        this._keys = (e) => {
            if (!this.controls || this.dom.lift.hidden || e.target.closest?.('input')) return;
            const n = e.key === 'g' || e.key === 'G' ? 1 : Number(e.key);
            if (n >= 1 && n <= this.floors.length) this.rideTo(n - 1);
        };
        addEventListener('keydown', this._keys);
    }

    /** A white flash, and you are somewhere else on this floor. */
    flashTo(p, yaw) {
        const c = this.controls;
        if (!c || this.ride) return;
        c.enabled = false;
        c.route = null;
        this.pending = null;
        this.ui.flash(true);
        setTimeout(() => {
            c.teleport(p.x, p.z, yaw);
            c.enabled = true;
            setTimeout(() => this.ui.flash(false), 120);
        }, 650);
    }

    /** A line of speech or a note at the top of the screen. */
    say(text, ms = 5600) {
        const el = this.dom.say;
        el.textContent = text;
        el.hidden = false;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(this.sayTimer);
        this.sayTimer = setTimeout(() => el.classList.remove('show'), ms);
    }

    // ------------------------------------------------------------ the visit

    /** Called once you are through the door: the ground floor, by the door. */
    enter(controls) {
        this.controls = controls;
        this.setFloor(0);
        this.doorArmed = false;
        this.liftArmed = false;
        this.area = null;
        this.audio.setAir(0.05);
        const s = this.spawn;
        controls.teleport(s.x, s.z, s.yaw);
    }

    leave() {
        this.ride = null;
        this.pending = null;
        this.clearHover();
        this.dom.lift.hidden = true;
        this.dom.say.classList.remove('show');
        this.audio.liftRide(false);
        this.audio.setAir(0);
        this.scene.fog.density = 0.012;
        if (this.controls) this.controls.enabled = true;
        for (const fl of this.floors) for (const rm of fl.rooms) rm.api.leave?.();
    }

    /** Where to stand to look through the telescope, and which way to face. */
    get scopeStand() {
        return this.floors[this.floors.length - 1].center?.stand;
    }

    _zone(force) {
        const p = this.player;
        const a = this._areaAt(p.x, p.z, -0.2) ?? this.area?.a;
        const key = `${this.floor}:${a}`;
        if (!force && key === this.area?.key) return;
        const fl = this.cur;
        const prev = this.area;
        this.area = { key, a };
        if (a === -1 || a === undefined) {
            if (force || prev?.f !== this.floor) this.ui.zone(fl.def.name, fl.def.sub, fl.def.accent);
            else document.getElementById('hud-zone').textContent = fl.def.name;
        } else {
            const d = fl.rooms[a].def;
            this.ui.zone(d.title, d.sub, d.accent);
            fl.rooms[a].api.enter?.();
        }
        this.area.f = this.floor;
    }

    stepSurface() {
        const a = this._areaAt(this.player.x, this.player.z, -0.2);
        if (a === undefined || a === -1) return 'stone';
        const f = this.cur.rooms[a].def.floor;
        return f === 'wood' || f[0] === 'parquet' || f[0] === 'herringbone' ? 'wood' : f === 'cave' ? 'grass' : 'stone';
    }

    update(dt, t, camera) {
        this.time = t;
        const fl = this.cur;
        if (this.ride) this._rideUpdate(dt, camera);
        for (const u of this.cur.updaters) u(dt, t);
        // the lift
        this.liftSpin += dt * (this.ride ? 4 : 0.6);
        const mp = this.liftMotes.geometry.attributes.position;
        for (let i = 0; i < 40; i++) {
            const a = this.liftSpin * (i % 2 ? 1 : -0.7) + (i / 40) * TAU;
            const rr = HOLE - 0.15 - (i % 3) * 0.12;
            mp.setXYZ(i, Math.cos(a) * rr, 0.15 + ((i * 0.37 + t * (this.ride ? 1.2 : 0.25)) % 1) * (this.ride ? 2.6 : 0.9), Math.sin(a) * rr);
        }
        mp.needsUpdate = true;
        this.liftGlow.material.opacity = 0.18 + 0.08 * Math.sin(t * 2) + (this.ride ? 0.25 : 0);
        for (const L of fl.lights) if (L.userData.flicker) L.intensity = L.userData.base * (0.9 + 0.1 * Math.sin(t * 13 + L.id) * Math.sin(t * 7.7));
        if (this.ride || !this.controls?.enabled) return;
        const p = this.player;
        // the lift panel shows while you stand on the disc
        const dl = Math.hypot(p.x - LIFT.x, p.z - LIFT.z);
        if (dl > 1.6) this.liftArmed = true;
        const onLift = dl < 1.0 && this.liftArmed;
        if (onLift !== !this.dom.lift.hidden) {
            this.dom.lift.hidden = !onLift;
            if (onLift) {
                this.dom.lift.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('here', Number(b.dataset.floor) === this.floor));
                this.audio.arp([69, 74], 0.08, 0.025);
            }
        }
        // the front door
        if (this.floor === 0) {
            const de = Math.hypot(p.x - this.exit.x, p.z - this.exit.z);
            if (de > 1.6) this.doorArmed = true;
            if (this.doorArmed && de < 0.55) {
                this.doorArmed = false;
                this.onExit?.();
            }
        }
        this._zone(false);
    }
}
