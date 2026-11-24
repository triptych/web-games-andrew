// The inn as a dollhouse cutaway, seen almost straight on so every room reads: the lobby and kitchen on the ground
// floor with the courtyard garden beside them, four guest rooms above, the Sunroom Suite under the gable roof. Walls
// are thick and timbered, floors and wallpapers are painted ElevenLabs textures (art/tex), the furniture, characters,
// meals and dust bunnies are Meshy models. Click a room to zoom to it; the camera eases there and back.
// Reads G every frame (sync) and answers events; never writes G.

import * as THREE from 'three';
import { Actor, prop, RAMP, texMat } from './assets.js';
import { FX } from './fx.js';
import { HEROES, GUESTS, ROOMS, TIERS } from '../sim/data.js';
import { DAY_LEN } from '../config.js';
import { bunnies } from '../sim/hotel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLOOR_H = 2.9;               // floor to floor
const SLAB = 0.3;                  // floor slab thickness
const WALL = 0.26;                 // wall thickness
const WALL_H = FLOOR_H - SLAB;
const ROOM_NAME = Object.fromEntries(ROOMS.map((r) => [r.id, r.name]));
// rooms: x0..x1 along the front, depth z Z0..Z1, floor level
export const LAYOUT = {
    lobby: { x0: -7, x1: -1, lv: 0, name: 'Lobby', panel: 'desk' },
    kitchen: { x0: -1, x1: 4, lv: 0, name: 'Kitchen', panel: 'kitchen' },
    garden: { x0: 4, x1: 9.8, lv: 0, name: 'Courtyard Garden', panel: 'garden', outdoor: true },
    r1: { x0: -7, x1: -3.5, lv: 1 }, r2: { x0: -3.5, x1: 0, lv: 1 }, r3: { x0: 0, x1: 3.5, lv: 1 }, r4: { x0: 3.5, x1: 7, lv: 1 },
    r5: { x0: -3.5, x1: 3.5, lv: 2 },
};
for (const id of ['r1', 'r2', 'r3', 'r4', 'r5']) Object.assign(LAYOUT[id], { name: ROOM_NAME[id], panel: 'rooms' });
const Z0 = -2.4, Z1 = 2.4, ZB = Z0 - WALL;
const LANE = 1.1;                  // every inside doorway is centred on this depth, so walkers use one aisle
const DOOR_W = 1.0;
const STAIR_X = -7.9;
const STEPS = 16;
const stairZ = (lv) => 1.8 - lv * 1.98;          // where the outside stair meets each floor
const ENTER = V(-2.6, 0, 5.6);                   // the garden path, where guests arrive and leave
const LAWN_Y = -0.45;
const PAPER = { lobby: 'plaster', kitchen: 'plaster', r1: 'paper-leaves', r2: 'paper-stars', r3: 'paper-mint', r4: 'paper-rose', r5: 'paper-flowers' };
const CURTAIN = { lobby: 0xc9675a, kitchen: 0x7fae6e, r1: 0xf2c14e, r2: 0x7b9fe0, r3: 0x6fbf8f, r4: 0xd98aa0, r5: 0xf0a868 };

const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
let M = null;
function materials() {
    if (M) return M;
    M = {
        beam: texMat('wood-walnut', 0x8a6448), trim: toon(0xfff3e0), timber: texMat('wood-walnut', 0xb08868),
        honey: texMat('wood-honey'), walnut: texMat('wood-walnut', 0xe8d0b8), tiles: texMat('tiles'),
        plaster: texMat('plaster', 0xfff2de), plasterOut: texMat('plaster', 0xf7e2c4), stone: texMat('fieldstone'),
        shingles: texMat('shingles'), grass: texMat('grass'), moss: texMat('moss'), rug: texMat('rug'),
        soil: toon(0x9b6f4c), iron: toon(0x4b4250),
        paper: Object.fromEntries(Object.entries(PAPER).map(([k, n]) => [k, texMat(n, k === 'lobby' ? 0xffe9cc : 0xffffff)])),
        glass: new THREE.MeshBasicMaterial({ map: skyTex(), color: 0xffffff, toneMapped: false }),
        shade: new THREE.MeshBasicMaterial({ map: fadeTex(), transparent: true, depthWrite: false, color: 0x3a2030 }),
        bulb: new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false }),
    };
    return M;
}

// a window's sky: a soft vertical gradient with a cloud
function skyTex() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 64;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#8fc8ff'); g.addColorStop(1, '#e8f6ff');
    x.fillStyle = g; x.fillRect(0, 0, 32, 64);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.ellipse(12, 40, 10, 4, 0, 0, Math.PI * 2); x.ellipse(20, 38, 7, 4, 0, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// soft dark fade (opaque at v = 1, clear at v = 0), for contact shading in the corners of rooms
function fadeTex() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(c);
}
// a soft warm light pool: an additive radial gradient (lamps at dusk, the lamp post)
let GLOW_TEX = null;
function glow(w, h) {
    if (!GLOW_TEX) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,214,140,0.75)'); g.addColorStop(0.45, 'rgba(255,190,110,0.28)'); g.addColorStop(1, 'rgba(255,180,100,0)');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        GLOW_TEX = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: GLOW_TEX, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.renderOrder = 5;
    return m;
}
/** A painted wooden board with text (the inn's sign, the plaques on closed rooms). */
function boardTex(lines, { w = 512, h = 128, bg = '#f6e2bf', edge = '#8d5d35', ink = '#4a3340', size = 46 } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const r = h * 0.22;
    x.fillStyle = edge; x.beginPath(); x.roundRect(0, 0, w, h, r); x.fill();
    x.fillStyle = bg; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, r * 0.7); x.fill();
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => {
        const s = i ? size * 0.72 : size;
        x.font = `700 ${s}px Fredoka, Nunito, sans-serif`;
        x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 0.95, w - 40);
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

/** A box with its texture coordinates in world units (one texture tile per T units), so patterns keep their size. */
function boxGeo(w, h, d, T) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const sz = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * sz[f][0] / T, uv.getY(k) * sz[f][1] / T); }
    return g;
}

// standing spots in each guest room, in the open front half (the bed, nightstand and wardrobe are at the back)
function roomSpots(id) {
    const R = LAYOUT[id], y = R.lv * FLOOR_H;
    if (id === 'r5') return [[-1.6, 0.6], [0.2, 0.5], [1.7, 0.9], [-0.7, 1.55], [0.9, 1.65], [-2.6, 1.45]].map(([x, z]) => V(x, y, z));
    return [[0.8, 0.55], [2.4, 0.45], [1.6, 1.35], [3.0, 1.4], [0.7, 1.75]].map(([dx, z]) => V(R.x0 + dx, y, z));
}
// where heroes in the party rest in the lobby: the left side, clear of the queue at the desk and the armchair
const LOBBY_HOME = [V(-6.35, 0, 1.75), V(-5.55, 0, 1.8), V(-4.75, 0, 1.75), V(-5.15, 0, 1.0)];

export const roomCenter = (id) => {
    const R = LAYOUT[id];
    return V((R.x0 + R.x1) / 2, R.lv * FLOOR_H, 0.6);
};

export class Hotel3D {
    constructor(stage) {
        this.stage = stage;
        // a low sun from the front left: characters and furniture throw their shadows onto the back walls
        this.scene = stage.makeScene('hotel', { sunPos: [-7, 13, 15], shadow: 13.5, at: [1, 4, 0], sky: 0xd8ecff, ground: 0xc9a27e });
        // the home view shows the whole inn, a little right of centre (the quest tracker sits on the left)
        this.cam = stage.makeIso('hotel', { at: [-2.0, 5.4, 0], dir: [0.13, 0.24, 1], span: 24, tall: 0.36, narrow: 12, bounds: [-12, 13.5, -4, 12.6] });
        this.fx = new FX(this.scene);
        this.actors = {};          // key → { actor, path: [Vector3], speed, home }
        this.bunnies = {};         // roomId → [Actor]
        this.hits = [];            // invisible click boxes: { mesh, kind, id }
        this.meals = [];
        this.decor = {};
        this.locks = {};           // roomId → { veil, plaque, fade }
        this.lamps = [];
        this.windows = [];
        this.focused = null;       // the room the camera is zoomed to
        this.camMoving = false;
        this.time = 0;
        this.batches = {};
        this.spots = {};           // roomId → [{ p: Vector3, key }]: who stands where in each guest room
        materials();
        this.build();
    }

    /**
     * An axis-aligned block from extents. mats: one material, or per face { px, nx, py, ny, pz, nz, all }.
     * Static blocks are not meshes of their own: their faces go into one batch per material (and shadow flag), merged
     * into a single mesh each by flushBlocks(), so the whole inn's architecture is a few dozen draw calls, not hundreds.
     * `solo` returns a mesh of its own, for a block that is moved or rotated afterwards.
     */
    block(x0, x1, y0, y1, z0, z1, mats, T = 1.4, { cast = false, receive = true, solo = false } = {}) {
        const m = mats.isMaterial ? mats : ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((k) => mats[k] || mats.all);
        const geo = boxGeo(x1 - x0, y1 - y0, z1 - z0, T);
        if (solo) {
            const o = new THREE.Mesh(geo, m);
            o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            o.castShadow = cast; o.receiveShadow = receive;
            this.scene.add(o);
            return o;
        }
        geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        const flat = geo.toNonIndexed();
        const P = flat.attributes.position.array, N = flat.attributes.normal.array, U = flat.attributes.uv.array;
        for (let f = 0; f < 6; f++) {
            const mat = Array.isArray(m) ? m[f] : m;
            const key = mat.uuid + (cast ? '+c' : '');
            const b = (this.batches[key] ||= { mat, cast, p: [], n: [], u: [] });
            for (let v = f * 6; v < f * 6 + 6; v++) {
                b.p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
                b.n.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
                b.u.push(U[v * 2], U[v * 2 + 1]);
            }
        }
        return null;
    }

    /** Turn the batched faces into one mesh per material. */
    flushBlocks() {
        for (const b of Object.values(this.batches)) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
            const o = new THREE.Mesh(g, b.mat);
            o.castShadow = b.cast; o.receiveShadow = true;
            this.scene.add(o);
        }
        this.batches = {};
    }

    put(name, h, x, y, z, ry = 0) {
        const p = prop(name, h);
        p.position.set(x, y, z); p.rotation.y = ry;
        this.scene.add(p);
        return p;
    }

    build() {
        const s = this.scene, B = this.block.bind(this);
        const T = FLOOR_H;

        // ---------------------------------------------------------------- the hill, the plinth and the paths
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(70, 30).rotateX(-Math.PI / 2), M.grass);
        lawn.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? 10 : 23); });
        lawn.position.set(0.8, LAWN_Y, 1); lawn.receiveShadow = true; s.add(lawn);
        B(-8.6, 9.9, LAWN_Y - 0.3, -0.04, ZB - 0.25, Z1 + 0.3, { all: M.stone }, 1.6);        // fieldstone plinth
        B(-3.4, -1.8, LAWN_Y - 0.3, -0.04, Z1 + 0.3, 6.4, { all: M.stone, py: M.stone }, 1.2); // the front walk
        // the courtyard: grass, two beds of herbs, a fence
        B(4.13, 9.9, -0.06, -0.01, ZB - 0.25, Z1 + 0.3, M.grass, 2.4);
        B(4.6, 6.4, -0.02, 0.16, -2.1, -0.5, { py: M.moss, all: M.timber }, 1.2);
        B(7.0, 8.8, -0.02, 0.16, -2.1, -0.5, { py: M.moss, all: M.timber }, 1.2);
        for (let i = 0; i <= 8; i++) B(9.72, 9.84, 0, 0.75, ZB + i * 0.64 - 0.05, ZB + i * 0.64 + 0.05, M.timber, 1);
        B(9.74, 9.82, 0.5, 0.58, ZB, Z1, M.timber, 1);

        // ---------------------------------------------------------------- floors
        const floorMat = { lobby: M.honey, kitchen: M.tiles, r1: M.honey, r2: M.honey, r3: M.honey, r4: M.honey, r5: M.walnut };
        for (const [id, R] of Object.entries(LAYOUT)) {
            if (R.outdoor) continue;
            const y = R.lv * FLOOR_H;
            B(R.x0, R.x1, y - 0.04, y, Z0, Z1, { py: floorMat[id], all: M.beam }, id === 'kitchen' ? 1.25 : 2.2);
        }
        // slabs between the floors: a walnut beam on the cut front
        for (const [lv, x0, x1] of [[1, -7.13, 7.13], [2, -7.13, 7.13], [3, -3.63, 3.63]]) {
            const y = lv * FLOOR_H;
            B(x0, x1, y - SLAB, y - 0.04, ZB, Z1, { pz: M.beam, py: M.walnut, ny: M.plaster, all: M.beam }, 1.6, { cast: lv === 3 });
            B(x0 - 0.04, x1 + 0.04, y - SLAB - 0.02, y + 0.02, Z1 - 0.02, Z1 + 0.08, M.beam, 1.6);
        }
        // the roof terrace over room 1 (walnut decking), under the outside stair's top landing
        B(-7.13, -3.5, 2 * T - 0.04, 2 * T, Z0, Z1, { py: M.walnut, all: M.beam }, 2.2);

        // ---------------------------------------------------------------- walls
        // back walls with wallpaper; a wainscot (or the kitchen's tiles), rails, a crown moulding; a window
        for (const [id, R] of Object.entries(LAYOUT)) {
            if (R.outdoor) continue;
            const y = R.lv * FLOOR_H, y1 = y + WALL_H, xa = R.x0 + WALL / 2, xb = R.x1 - WALL / 2;
            B(R.x0, R.x1, y, y1, ZB, Z0, { pz: M.paper[id], all: M.plasterOut }, id === 'lobby' || id === 'kitchen' ? 2.2 : 1.3, { cast: true });
            if (id === 'kitchen') B(xa, xb, y, y + 1.25, Z0, Z0 + 0.04, { pz: M.tiles, all: M.trim }, 0.9);
            else B(xa, xb, y, y + (id === 'lobby' ? 1.1 : 0.95), Z0, Z0 + 0.05, { pz: M.walnut, all: M.beam }, 1.5);
            B(xa, xb, y + (id === 'kitchen' ? 1.25 : id === 'lobby' ? 1.1 : 0.95), y + (id === 'kitchen' ? 1.33 : id === 'lobby' ? 1.18 : 1.03), Z0, Z0 + 0.1, M.trim);
            B(xa, xb, y1 - 0.14, y1, Z0, Z0 + 0.12, M.trim);
            if (id === 'lobby') for (const xx of [-5.2, -2.8]) B(xx - 0.09, xx + 0.09, y + 1.18, y1, Z0, Z0 + 0.06, M.beam, 1.2);   // half-timbering
            // contact shading: a soft dark fade down from the ceiling and along the floor at the back
            const fade = (w, h, px, py, pz, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.shade); p.position.set(px, py, pz); p.rotation.x = rx; p.renderOrder = 2; s.add(p); };
            fade(xb - xa, 0.7, (xa + xb) / 2, y1 - 0.35, Z0 + 0.125);
            const fl = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, 0.9), M.shade); fl.rotation.x = -Math.PI / 2; fl.position.set((xa + xb) / 2, y + 0.006, Z0 + 0.45 + 0.05); fl.renderOrder = 2;
            fl.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = 1 - v; });   // dark at the wall
            s.add(fl);
            // windows: two tall ones in the Sunroom, one elsewhere
            const wins = id === 'r5' ? [-1.2, 1.6] : id === 'lobby' ? [-3.8] : [(R.x0 + R.x1) / 2 + (R.x1 - R.x0) * 0.18];
            for (const wx of wins) this.window(wx, y, id === 'r5' ? 1.5 : 1.1, id === 'r5' ? 1.45 : 1.05, CURTAIN[id]);
            // a hanging lamp
            this.lamp((R.x0 + R.x1) / 2 - (R.x1 - R.x0) * 0.22, y1, id);
        }
        // partitions with a doorway on the aisle; the cut front of each is a walnut post
        const P = (id) => M.paper[id] || M.plasterOut;
        this.partition(-7, 0, M.plasterOut, P('lobby'), stairZ(0));
        this.partition(-1, 0, P('lobby'), P('kitchen'), LANE);
        this.partition(4, 0, P('kitchen'), M.plasterOut, LANE);
        this.partition(-7, 1, M.plasterOut, P('r1'), stairZ(1));
        this.partition(-3.5, 1, P('r1'), P('r2'), LANE);
        this.partition(0, 1, P('r2'), P('r3'), LANE);
        this.partition(3.5, 1, P('r3'), P('r4'), LANE);
        this.partition(7, 1, P('r4'), M.plasterOut, null);
        this.partition(-3.5, 2, M.plasterOut, P('r5'), LANE);
        this.partition(3.5, 2, P('r5'), M.plasterOut, null);
        // posts under the East Wing's overhang, over the courtyard
        for (const z of [Z0 + 0.1, Z1 - 0.15]) B(6.85, 7.13, 0, T - SLAB, z - 0.14, z + 0.14, M.beam, 1.2, { cast: true });

        // ---------------------------------------------------------------- roofs
        this.roof();
        // terrace railing over room 1, with a gap where the stair arrives
        const ry = 2 * T;
        for (let i = 0; i <= 8; i++) { const x = -7.05 + i * 0.44; B(x - 0.04, x + 0.04, ry, ry + 0.7, Z1 - 0.12, Z1 - 0.04, M.trim, 1); }
        B(-7.13, -3.5, ry + 0.64, ry + 0.72, Z1 - 0.14, Z1 - 0.02, M.beam, 1.2);
        B(-7.13, -7.05, ry + 0.64, ry + 0.72, stairZ(2) + 0.55, Z1, M.beam, 1.2);
        for (let z = stairZ(2) + 0.6; z < Z1; z += 0.44) B(-7.13, -7.05, ry, ry + 0.7, z - 0.04, z + 0.04, M.trim, 1);

        // ---------------------------------------------------------------- the outside stair
        const run = (stairZ(0) - stairZ(2)) / STEPS, rise = 2 * T / STEPS;
        for (let i = 1; i <= STEPS; i++) {
            const z = stairZ(0) - i * run, y = i * rise;
            if (i === STEPS / 2 || i === STEPS) { B(STAIR_X - 0.55, -7.13, y - 0.12, y, z - 0.55, z + 0.55, { py: M.walnut, all: M.beam }, 1.4, { cast: true }); continue; }
            B(STAIR_X - 0.5, STAIR_X + 0.5, y - 0.1, y, z - run / 2 - 0.04, z + run / 2 + 0.04, { py: M.honey, all: M.beam }, 1.2, { cast: true });
        }
        // stringers and a handrail on the open side
        const len = Math.hypot(stairZ(0) - stairZ(2), 2 * T);
        const ang = Math.atan2(2 * T, stairZ(0) - stairZ(2));
        for (const [dx, dy, h] of [[-0.52, -0.2, 0.26], [-0.52, 0.85, 0.07]]) {
            const st = this.block(-0.04, 0.04, -h / 2, h / 2, -len / 2, len / 2, M.beam, 1.2, { cast: true, solo: true });
            st.position.set(STAIR_X + dx, T + dy, (stairZ(0) + stairZ(2)) / 2); st.rotation.x = ang;
        }
        for (let i = 2; i <= STEPS; i += 3) { const z = stairZ(0) - i * run, y = i * rise; B(STAIR_X - 0.56, STAIR_X - 0.48, y, y + 0.85, z - 0.04, z + 0.04, M.beam, 1); }

        // ---------------------------------------------------------------- signs
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshToonMaterial({ map: boardTex(['The Drowsy Dragonfly', '~ an inn since long ago ~'], { w: 640, h: 160, size: 52 }), gradientMap: RAMP, transparent: true }));
        sign.position.set(0, 3 * T + 0.75, Z1 - 0.3); s.add(sign);
        this.signMesh = sign;
        document.fonts?.ready.then(() => { sign.material.map = boardTex(['The Drowsy Dragonfly', '~ an inn since long ago ~'], { w: 640, h: 160, size: 52 }); sign.material.needsUpdate = true; });
        for (const dx of [-1.6, 1.6]) B(dx - 0.05, dx + 0.05, 3 * T, 3 * T + 0.3, Z1 - 0.36, Z1 - 0.32, M.iron, 1);

        // ---------------------------------------------------------------- furniture (Meshy)
        const put = this.put.bind(this);
        const y1 = T, y2 = 2 * T;
        // the lobby: the desk on a rug, a fireplace, an armchair, a grandfather clock, the coat rack
        this.rug(-4.0, 0, 0.1, 2.8, 1.7);
        put('item-desk', 1.05, -4.0, 0, -1.25);
        put('item-deskBell', 0.16, -3.6, 1.04, -1.0);
        put('item-fireplace', 1.95, -6.15, 0, -1.85, 0.25);
        put('item-armchair', 0.95, -6.0, 0, 0.55, 0.9);
        put('item-clock', 2.05, -2.6, 0, -2.0);
        put('item-coatRack', 1.6, -5.15, 0, -2.0);
        this.fire = new THREE.PointLight(0xff9a4a, 0, 4.5, 1.8); this.fire.position.set(-6.0, 0.6, -1.2); s.add(this.fire);
        // the kitchen
        put('item-stove', 1.5, 0.3, 0, -1.8);
        put('item-kitchenShelf', 1.6, 1.85, 0, -2.05);
        put('item-table', 0.95, 2.4, 0, 0.45);
        put('item-chair', 0.95, 1.45, 0, 0.45, Math.PI / 2);
        put('item-chair', 0.95, 3.35, 0, 0.45, -Math.PI / 2);
        put('item-barrel', 0.9, 3.45, 0, -1.9);
        put('item-chest', 0.6, -0.45, 0, -1.95);
        // the courtyard
        put('item-planter', 0.8, 5.5, 0.16, -1.3);
        put('item-planter', 0.8, 7.9, 0.16, -1.3);
        put('item-pumpkins', 0.6, 9.1, 0, -1.7);
        put('item-hedge', 0.75, 9.1, 0, 0.4, 1.4);
        put('item-bathtub', 0.8, 7.7, 0, 1.25, -0.4);
        put('item-bench', 0.8, 5.4, 0, 1.6, 0.25);
        // guest rooms
        for (const id of ['r1', 'r2', 'r3', 'r4']) {
            const R = LAYOUT[id], cx = (R.x0 + R.x1) / 2;
            this.rug(cx + 0.2, y1, 0.65, 1.9, 1.2);
            put('item-bed', 0.95, R.x0 + 1.15, y1, -1.25);
            put('item-nightstand', 0.85, R.x0 + 2.25, y1, -1.95);
            put('item-wardrobe', 1.65, R.x1 - 0.6, y1, -1.75);
        }
        // the Sunroom Suite
        this.rug(0, y2, 0.4, 3.4, 1.8);
        put('item-bed', 1.05, -2.2, y2, -1.25);
        put('item-nightstand', 0.85, -0.95, y2, -1.95);
        put('item-sofa', 1.0, 1.2, y2, -1.75);
        put('item-floorLamp', 1.75, 2.6, y2, -2.0);
        put('item-armchair', 0.95, 2.6, y2, 0.5, -0.6);
        put('item-bookshelf', 1.6, -0.05, y2, -2.05);
        // the terrace
        put('item-bench', 0.8, -5.4, y2, -1.7);
        put('item-pottedFern', 0.8, -4.0, y2, -1.8);
        put('item-sunflowerVase', 0.6, -6.6, y2, 1.4);
        // outside
        put('item-lampPost', 2.4, -9.0, LAWN_Y, 3.4);
        put('item-hedge', 1.1, -10.0, LAWN_Y, 1.6);
        put('item-hedge', 1.0, 11.2, LAWN_Y, 1.2, 0.4);
        put('item-pottedFern', 0.8, -10.0, LAWN_Y, 3.6);
        put('item-tree', 4.6, -10.6, LAWN_Y, -2.8);
        put('item-tree', 4.2, 11.6, LAWN_Y, -3.2, 1.2);
        put('item-bench', 0.8, 11.6, LAWN_Y, 2.6, -0.5);
        put('item-pumpkins', 0.55, -4.4, LAWN_Y, 4.4, 0.8);
        put('item-barrel', 0.85, 12.6, LAWN_Y, 0.6);
        this.postLight = glow(1.6, 1.6); this.postLight.position.set(-9.0, LAWN_Y + 2.15, 3.75); s.add(this.postLight);

        // ---------------------------------------------------------------- closed rooms: a dim veil and a plaque
        for (const id of ['r3', 'r4', 'r5']) {
            const R = LAYOUT[id], y = R.lv * FLOOR_H, w = R.x1 - R.x0 - WALL;
            const veil = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), new THREE.MeshBasicMaterial({ color: 0x241b38, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }));
            veil.position.set((R.x0 + R.x1) / 2, y + WALL_H / 2, Z1 + 0.03); veil.renderOrder = 3; s.add(veil);
            const tier = ROOMS.find((r) => r.id === id).tier;
            const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.72), new THREE.MeshBasicMaterial({ map: boardTex(['🔒 Closed', `opens at “${TIERS[tier - 1].name}”`], { w: 512, h: 160, size: 50 }), transparent: true }));
            plaque.position.set((R.x0 + R.x1) / 2, y + 1.45, Z1 + 0.06); plaque.renderOrder = 4; s.add(plaque);
            this.locks[id] = { veil, plaque, open: false, t: 0 };
        }

        // ---------------------------------------------------------------- click boxes
        for (const [id, R] of Object.entries(LAYOUT)) {
            const w = R.x1 - R.x0, y = R.lv * FLOOR_H;
            const hb = new THREE.Mesh(new THREE.BoxGeometry(w, FLOOR_H, Z1 - Z0), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.set((R.x0 + R.x1) / 2, y + FLOOR_H / 2, 0);
            s.add(hb);
            this.hits.push({ mesh: hb, kind: 'room', id });
        }
        this.flushBlocks();
        this.decorSpots = [V(-1.75, 0, -1.8), V(-1.6, 0, -0.55), V(-6.5, 0, 1.75)];
        // the inn's people: Maple by the desk
        this.ensureActor('maple', 'maple', V(-4.0, 0, -0.1), 1.45);
    }

    /** A wall across x (between rooms) on floor lv, with a doorway centred at doorZ (or none). */
    partition(x, lv, left, right, doorZ) {
        const y = lv * FLOOR_H, y1 = y + WALL_H, xa = x - WALL / 2, xb = x + WALL / 2;
        const mats = { nx: left, px: right, all: M.beam };
        const segs = doorZ == null ? [[ZB, Z1]] : [[ZB, doorZ - DOOR_W / 2], [doorZ + DOOR_W / 2, Z1]];
        for (const [a, b] of segs) if (b - a > 0.02) this.block(xa, xb, y, y1, a, b, mats, 1.3, { cast: true });
        if (doorZ != null) {
            this.block(xa, xb, y + 2.05, y1, doorZ - DOOR_W / 2, doorZ + DOOR_W / 2, mats, 1.3);
            // a door frame
            for (const dz of [-DOOR_W / 2, DOOR_W / 2]) this.block(xa - 0.04, xb + 0.04, y, y + 2.1, doorZ + dz - 0.05, doorZ + dz + 0.05, M.trim, 1);
            this.block(xa - 0.04, xb + 0.04, y + 2.02, y + 2.12, doorZ - DOOR_W / 2 - 0.05, doorZ + DOOR_W / 2 + 0.05, M.trim, 1);
        }
        // the cut front: a walnut post a little proud of the wall
        this.block(xa - 0.05, xb + 0.05, y - 0.02, y1 + 0.02, Z1 - 0.1, Z1 + 0.08, M.beam, 1.6);
    }

    /** A window on the back wall at x: frame, mullions, sill and curtains. */
    window(x, y, w, h, curtain) {
        const B = this.block.bind(this), y0 = y + 1.05, y1 = y0 + h, z = Z0;
        const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
        g.position.set(x, (y0 + y1) / 2, z + 0.03); this.scene.add(g);
        this.windows.push(g);
        const f = 0.08;
        B(x - w / 2 - f, x + w / 2 + f, y0 - f, y0, z, z + 0.09, M.trim);
        B(x - w / 2 - f, x + w / 2 + f, y1, y1 + f, z, z + 0.09, M.trim);
        B(x - w / 2 - f, x - w / 2, y0, y1, z, z + 0.09, M.trim);
        B(x + w / 2, x + w / 2 + f, y0, y1, z, z + 0.09, M.trim);
        B(x - 0.025, x + 0.025, y0, y1, z, z + 0.07, M.trim);
        B(x - w / 2, x + w / 2, (y0 + y1) / 2 - 0.025, (y0 + y1) / 2 + 0.025, z, z + 0.07, M.trim);
        B(x - w / 2 - 0.16, x + w / 2 + 0.16, y0 - f - 0.06, y0 - f, z, z + 0.2, M.beam, 1);
        const cm = toon(curtain);
        for (const s of [-1, 1]) B(x + s * (w / 2 + 0.02) - 0.13, x + s * (w / 2 + 0.02) + 0.13, y0 - 0.25, y1 + 0.12, z + 0.1, z + 0.17, cm, 1, { cast: true });
        B(x - w / 2 - 0.3, x + w / 2 + 0.3, y1 + 0.13, y1 + 0.18, z + 0.08, z + 0.2, M.iron, 1);
    }

    /** A pendant lamp hanging from the ceiling, with a warm light for the evening. */
    lamp(x, yTop, id) {
        const z = -0.6, drop = id === 'r5' ? 0.7 : 0.45;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, drop), M.iron);
        cord.position.set(x, yTop - drop / 2, z); this.scene.add(cord);
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 18, 1, true), new THREE.MeshToonMaterial({ color: 0xfff0cf, gradientMap: RAMP, side: THREE.DoubleSide }));
        shade.position.set(x, yTop - drop - 0.08, z); this.scene.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.bulb.clone());
        bulb.position.set(x, yTop - drop - 0.18, z); this.scene.add(bulb);
        // no point light (nine of them cost every lit pixel a loop): a warm pool of light on the wall and the floor
        const wall = glow(2.6, 2.0); wall.position.set(x, yTop - drop - 0.6, Z0 + 0.14); this.scene.add(wall);
        const floor = glow(2.8, 2.2); floor.rotation.x = -Math.PI / 2; floor.position.set(x, yTop - WALL_H + 0.012, 0.0); this.scene.add(floor);
        this.lamps.push({ bulb, glows: [wall, floor], room: id });
    }

    rug(x, y, z, w, d) {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M.rug);
        r.position.set(x, y + 0.008, z); r.receiveShadow = true;
        this.scene.add(r);
    }

    /** The gable roof over the Sunroom (shingles, a ridge, a chimney), and a lean-to over the East Wing. */
    roof() {
        const s = this.scene, T = FLOOR_H, B = this.block.bind(this);
        const eave = 3 * T - 0.05, rise = 2.1, zf = Z1 + 0.6, zb = ZB - 0.5, zm = (zf + zb) / 2;
        const half = (zf - zb) / 2, L = Math.hypot(half, rise) + 0.12, a = Math.atan2(rise, half);
        for (const sgn of [1, -1]) {
            const r = this.block(-4.15, 4.15, -0.11, 0.11, -L / 2, L / 2, { py: M.shingles, all: M.beam }, 1.5, { cast: true, solo: true });
            r.position.set(0, eave + rise / 2 + 0.06, zm + sgn * half / 2); r.rotation.x = sgn * a;
        }
        const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 8.4, 10).rotateZ(Math.PI / 2), M.beam);
        ridge.position.set(0, eave + rise + 0.12, zm); ridge.castShadow = true; s.add(ridge);
        // gable ends
        const sh = new THREE.Shape([new THREE.Vector2(ZB, 0), new THREE.Vector2(Z1, 0), new THREE.Vector2(zm, rise - 0.05)]);
        for (const x of [-3.5, 3.5]) {
            const g = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: WALL, bevelEnabled: false }), M.plasterOut);
            g.rotation.y = -Math.PI / 2; g.position.set(x + WALL / 2, eave, 0); g.castShadow = true; s.add(g);
            g.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v / 1.6; });
        }
        // the chimney, through the back slope
        B(1.7, 2.45, eave + 0.3, eave + rise + 1.3, -1.8, -1.05, { all: M.stone }, 1.1, { cast: true });
        B(1.6, 2.55, eave + rise + 1.3, eave + rise + 1.45, -1.9, -0.95, M.beam, 1, { cast: true });
        this.chimney = V(2.07, eave + rise + 1.55, -1.42);
        // the lean-to over the East Wing, sloping to the front
        const lt = { x0: 3.63, x1: 7.45, yb: 2 * T + 1.55, yf: 2 * T - 0.08, zb: ZB - 0.35, zf: Z1 + 0.55 };
        const lL = Math.hypot(lt.zf - lt.zb, lt.yb - lt.yf) + 0.05, la = Math.atan2(lt.yb - lt.yf, lt.zf - lt.zb);
        const r = this.block(lt.x0, lt.x1, -0.1, 0.1, -lL / 2, lL / 2, { py: M.shingles, all: M.beam }, 1.5, { cast: true, solo: true });
        r.position.set((lt.x0 + lt.x1) / 2, (lt.yb + lt.yf) / 2 + 0.08, (lt.zb + lt.zf) / 2); r.rotation.x = la;
        const sh2 = new THREE.Shape([new THREE.Vector2(ZB, 0), new THREE.Vector2(Z1 + 0.3, 0), new THREE.Vector2(ZB, lt.yb - 2 * T - 0.1)]);
        const g2 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh2, { depth: WALL, bevelEnabled: false }), M.plasterOut);
        g2.rotation.y = -Math.PI / 2; g2.position.set(7.13, 2 * T, 0); s.add(g2);
        g2.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v / 1.6; });
    }

    ensureActor(key, model, pos, height = 1.1) {
        if (this.actors[key]) return this.actors[key];
        const a = new Actor(model, { height });
        a.root.position.copy(pos);
        a.setBase('idle');
        this.scene.add(a.root);
        const rec = { actor: a, path: [], speed: 1.9, key };
        this.actors[key] = rec;
        return rec;
    }

    removeActor(key) {
        const r = this.actors[key];
        this.releaseSpot(key);
        if (!r) return;
        this.scene.remove(r.actor.root);
        delete this.actors[key];
    }

    /** Walk an actor to a spot: along the aisle through the doorways, and by the outside stair if it changes floor. */
    walkTo(key, dest) {
        const r = this.actors[key];
        if (!r) return;
        const p = r.actor.root.position;
        const from = Math.max(0, Math.round(p.y / FLOOR_H)), to = Math.max(0, Math.round(dest.y / FLOOR_H));
        const lane = (x, lv) => V(x, lv * FLOOR_H, LANE);
        const path = [];
        const inside = (v) => v.z < Z1 + 0.2;
        if (from !== to) {
            if (inside(p)) path.push(lane(p.x, from));
            else path.push(lane(ENTER.x, 0));
            path.push(lane(-6.3, from), V(-6.3, from * FLOOR_H, stairZ(from)), V(STAIR_X, from * FLOOR_H, stairZ(from)));
            path.push(V(STAIR_X, to * FLOOR_H, stairZ(to)), V(-6.3, to * FLOOR_H, stairZ(to)), lane(-6.3, to));
            if (inside(dest)) path.push(lane(dest.x, to));
            else path.push(lane(ENTER.x, 0));
        } else if (Math.abs(p.x - dest.x) > 0.7 || !inside(p) || !inside(dest)) {
            path.push(lane(inside(p) ? p.x : ENTER.x, from));
            path.push(lane(inside(dest) ? dest.x : ENTER.x, to));
        }
        path.push(dest.clone());
        r.path = path;
        r.actor.setBase('walk');
    }

    /**
     * A standing spot in a guest room for `key`, kept until released: each room has a few fixed spots clear of the bed,
     * nightstand and wardrobe and at least 0.8 apart, and nobody takes a spot someone else holds. (v1.1.0 picked spots
     * by a formula that wrapped round in the narrow rooms, so a stranger and Maple stood inside each other.)
     */
    spotFor(roomId, key) {
        this.claimed?.add(key);
        const list = this.spots[roomId] ||= roomSpots(roomId).map((p) => ({ p, key: null }));
        let s = list.find((x) => x.key === key);
        if (s) return s.p.clone();
        this.releaseSpot(key);
        // the first free one, preferring the middle of the room; if every spot is taken, a little apart from the last
        s = list.find((x) => !x.key);
        if (!s) return list[list.length - 1].p.clone().add(V(0.4, 0, 0.35));
        s.key = key;
        return s.p.clone();
    }

    releaseSpot(key) {
        for (const list of Object.values(this.spots)) for (const x of list) if (x.key === key) x.key = null;
    }

    // ------------------------------------------------------------------ the camera
    /** Zoom to a room (or the garden). */
    focusRoom(id) {
        const R = LAYOUT[id];
        if (!R) return;
        this.focused = id;
        const w = R.x1 - R.x0;
        // frame the room with room to spare for the HUD above and the room card below, and nudge it into the free part
        // of the screen: up a little (the card), and right on a wide screen (the quest tracker is on the left)
        this.stage.focus('hotel', V((R.x0 + R.x1) / 2, R.lv * FLOOR_H + 1.3, 0), w + 1.6, FLOOR_H * 2.05);
        const st = this.stage, u = this.cam.userData, { hw, hh } = st.half(u, u.goalZoom);
        if (st.w / st.h > 1.1) u.goal.x -= 0.1 * 2 * hw;
        u.goal.y -= 0.09 * 2 * hh / u.cosE;
        st.clampGoal(u);
    }

    /** Back to the whole inn. */
    showAll() {
        this.focused = null;
        this.stage.home('hotel');
    }

    get zoomed() { return this.stage.zoomed('hotel'); }

    // ------------------------------------------------------------------ reading the game
    sync(G, dt) {
        this.time += dt;
        this.camMoving = this.stage.ease('hotel', dt);
        // rooms open, or closed behind a veil
        for (const room of G.rooms) {
            const L = this.locks[room.id];
            if (!L) continue;
            if (room.open && !L.open) { L.open = true; L.t = 1; }
            if (!room.open && L.open) { L.open = false; L.t = 0; }
            L.t = room.open ? Math.max(0, L.t - dt * 1.5) : 1;
            L.veil.material.opacity = 0.62 * L.t;
            L.veil.visible = L.t > 0.01;
            L.plaque.visible = !room.open;
        }
        // dust bunnies: one per 20 dust in each open room
        for (const room of G.rooms) {
            const want = room.open ? bunnies(room) : 0;
            const list = this.bunnies[room.id] ||= [];
            while (list.length < want) {
                const b = new Actor('dustbunny', { height: 0.46, face: Math.random() * 6 });
                const R = LAYOUT[room.id], i = list.length;
                b.root.position.set(R.x0 + 0.6 + ((i * 1.37) % (R.x1 - R.x0 - 1.2)), R.lv * FLOOR_H, 0.2 + ((i * 0.83) % 1.8));
                b.room = room.id;
                b.phase = Math.random() * 6;
                this.scene.add(b.root);
                list.push(b);
            }
            while (list.length > want) {
                const b = list.pop();
                this.fx.burst(b.root.position.clone().setY(b.root.position.y + 0.2), 'dust', 1.2);
                this.scene.remove(b.root);
            }
            for (const b of list) {
                b.phase += dt;
                const bob = Math.abs(Math.sin(b.phase * 4)) * 0.12;
                b.root.position.y = LAYOUT[room.id].lv * FLOOR_H + bob;
                b.shadow.position.y = 0.015 - bob;
                b.shadow.scale.setScalar(0.28 * (1 - bob * 1.5));
                b.root.rotation.y += Math.sin(b.phase * 0.7) * dt;
                b.update(dt);
            }
        }
        // staff at their stations, party at home in the lobby, recruits in their rooms
        const away = new Set(G.exp ? G.party : []);
        this.claimed = new Set(['maple']);         // who stands in a room this frame (Maple keeps hers until she moves)
        let home = 0;
        const stations = { cook: V(0.5, 0, -0.6), concierge: V(-2.9, 0, -0.5), gardener: V(6.6, 0, -0.1), housekeeper: null };
        for (const id of Object.keys(HEROES)) {
            const h = G.heroes[id], key = 'hero-' + id;
            if (id === 'maple') continue;
            let want = null;
            if (h.joined && !away.has(id)) {
                const role = HEROES[id].staff;
                if (h.role !== 'party' && stations[role]) want = stations[role];
                else if (role === 'housekeeper' && h.role !== 'party') {
                    const dirty = G.rooms.filter((r) => r.open).sort((a, b) => b.dust - a.dust)[0];
                    want = this.spotFor(dirty?.id || 'r1', key);
                } else want = LOBBY_HOME[home++ % LOBBY_HOME.length].clone();
            } else if (!h.joined && G.recruits[id]?.stage !== 'none') {
                const g = Object.values(G.guests).find((x) => x.recruit === id);
                if (g?.room) want = this.spotFor(g.room, key);
                else if (g) want = V(-2.2 - G.queue.indexOf(g.id) * 0.8, 0, 1.6);
            }
            this._place(key, id, want, 1.45);
        }
        // Maple: home in the lobby unless she's off on an expedition
        const maple = this.actors.maple;
        maple.actor.root.visible = !G.exp;
        // walk-in guests: in their rooms, or queueing by the desk
        const seen = new Set();
        for (const g of Object.values(G.guests)) {
            if (g.recruit) continue;
            const key = 'guest-' + g.id;
            seen.add(key);
            const want = g.room ? this.spotFor(g.room, key) : V(-2.0 - G.queue.indexOf(g.id) * 0.8, 0, 1.6);
            this._place(key, GUESTS[g.arch].model, want, 1.5, ENTER);
        }
        // spots held by anyone no longer standing in a room go back to the room
        for (const list of Object.values(this.spots)) for (const x of list) if (x.key && !this.claimed.has(x.key)) x.key = null;
        for (const key of Object.keys(this.actors)) if (key.startsWith('guest-') && !seen.has(key)) {
            const r = this.actors[key];
            if (!r.leaving) { r.leaving = true; this.walkTo(key, ENTER.clone()); }
        }
        // meals on the kitchen table
        const want = G.pantry.slice(0, 6).map((m) => m.r);
        if (want.join() !== this.meals.map((m) => m.r).join()) {
            for (const m of this.meals) this.scene.remove(m.obj);
            this.meals = want.map((r, i) => {
                const obj = prop('item-' + r, 0.3); obj.position.set(1.95 + (i % 3) * 0.42, 0.95, 0.22 + Math.floor(i / 3) * 0.45); this.scene.add(obj);
                return { r, obj };
            });
        }
        // decor on display
        const dk = G.decor.join();
        if (dk !== this.decorKey) {
            this.decorKey = dk;
            for (const o of Object.values(this.decor)) this.scene.remove(o);
            this.decor = {};
            G.decor.forEach((d, i) => { const o = prop('item-' + d, d === 'armorStand' || d === 'luggageCart' ? 1.3 : 0.9); o.position.copy(this.decorSpots[i]); this.scene.add(o); this.decor[d] = o; });
        }
        // a pot on the stove while cooking
        if (!!G.cook !== !!this.pot) {
            if (G.cook) { this.pot = prop('item-copperPot', 0.35); this.pot.position.set(0.3, 1.5, -1.7); this.scene.add(this.pot); }
            else { this.scene.remove(this.pot); this.pot = null; }
        }
        if (this.pot && Math.random() < dt * 6) this.fx.burst(V(0.3, 1.9, -1.6), 'dust', 0.4);
        // chimney smoke, now and then
        if (Math.random() < dt * 1.2) this.fx.burst(this.chimney.clone(), 'dust', 0.6);
        // time of day: a warm morning, a bright noon, a golden evening, a blue night with the lamps lit
        const f = G.clock / DAY_LEN;
        const sun = this.scene.userData.sun;
        const night = Math.max(0, (f - 0.78) / 0.22);
        const eve = Math.max(0, 1 - Math.abs(f - 0.68) / 0.15);
        sun.color.setRGB(1, 0.95 - eve * 0.2 - night * 0.4, 0.85 - eve * 0.35 - night * 0.2);
        sun.intensity = 2.3 - night * 1.6 - eve * 0.3;
        // the sky light dims and turns blue at night, so the lamps' warm pools read
        const hemi = this.scene.userData.hemi;
        hemi.intensity = 1.5 - night * 0.75 - eve * 0.15;
        hemi.color.setRGB(0.85 - night * 0.3, 0.92 - night * 0.25, 1);
        const lampOn = Math.min(0.9, night * 0.85 + eve * 0.35);
        for (const l of this.lamps) {
            const on = this.locks[l.room] && !this.locks[l.room].open ? 0 : lampOn;
            for (const g of l.glows) g.material.opacity = on;
            l.bulb.material.color.setRGB(1, 0.85 + night * 0.1, 0.55 + night * 0.2);
        }
        M.glass.color.setRGB(1 - night * 0.55 - eve * 0.05, 1 - night * 0.5 - eve * 0.2, 1 - night * 0.25 - eve * 0.35);
        this.fire.intensity = (1.2 + night * 1.5) * (0.85 + Math.sin(this.time * 9) * 0.08 + Math.sin(this.time * 23) * 0.06);
        this.postLight.material.opacity = Math.min(1, night * 1.1 + eve * 0.4);
        this.stage.bgEl.style.filter = `brightness(${(1 - night * 0.45).toFixed(2)}) saturate(${(1 + eve * 0.25).toFixed(2)}) hue-rotate(${(-eve * 12 + night * 20).toFixed(0)}deg)`;

        // move everyone along their paths
        for (const r of Object.values(this.actors)) {
            const a = r.actor, p = a.root.position;
            if (r.path.length) {
                const t = r.path[0];
                const d = t.clone().sub(p);
                const step = r.speed * dt;
                if (d.length() <= step) {
                    p.copy(t); r.path.shift();
                    if (!r.path.length) {
                        a.setBase('idle');
                        a.root.rotation.y = 0;
                        if (r.leaving) { this.removeActor(r.key); continue; }
                    }
                } else {
                    p.addScaledVector(d.normalize(), step);
                    if (Math.abs(d.x) + Math.abs(d.z) > 0.01) a.root.rotation.y = Math.atan2(d.x, d.z);
                }
            }
            a.update(dt);
        }
        this.fx.update(dt);
    }

    /** Put an actor where the game wants it: appear at the door the first time, then walk when the spot changes. */
    _place(key, model, want, height, enter = null) {
        if (!want) { if (this.actors[key] && !this.actors[key].leaving) { this.actors[key].leaving = true; this.walkTo(key, ENTER.clone()); } return; }
        let r = this.actors[key];
        if (!r) { r = this.ensureActor(key, model, enter || want, height); r.want = null; }
        if (r.leaving) { r.leaving = false; }
        if (!r.want || r.want.distanceTo(want) > 0.3) { r.want = want.clone(); this.walkTo(key, want); }
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'sweep') {
                const list = this.bunnies[e.room] || [];
                const b = list[list.length - 1];
                if (b) this.fx.burst(b.root.position.clone().setY(b.root.position.y + 0.25), 'dust', 1.3);
                if (!e.byStaff) this.mapleTo(e.room);
            } else if (e.type === 'cooked') {
                this.fx.burst(V(0.4, 1.8, -1.4), e.grade === 'perfect' ? 'star' : 'fire', 1.1);
            } else if (e.type === 'harvest') {
                this.fx.burst(V(7, 0.9, -1.2), 'leaf', 1.2);
            } else if (e.type === 'checkout' || e.type === 'paid' || e.type === 'served') {
                this.fx.burst(V(-4.0, 1.4, -0.9), 'coin', 0.9);
            } else if (e.type === 'guestArrive') {
                this.fx.ring(V(-2.6, 0.02, 2.6), 0xfff0a0, 1.5);
            } else if (e.type === 'recruited') {
                const r = this.actors['hero-' + e.hero];
                if (r) { r.actor.play('wave'); this.fx.burst(r.actor.root.position.clone().setY(r.actor.root.position.y + 1.2), 'heal', 1.4); }
            } else if (e.type === 'tierUp') {
                for (const id of Object.keys(this.locks)) this.fx.burst(roomCenter(id).setY(LAYOUT[id].lv * FLOOR_H + 1.2).setZ(Z1), 'star', 2);
                this.actors.maple?.actor.play('victory');
            }
        }
    }

    mapleTo(roomId) {
        if (!LAYOUT[roomId]) return;
        this.walkTo('maple', this.spotFor(roomId, 'maple'));
    }

    // ------------------------------------------------------------------ input
    /** What's under the pointer: a dust bunny (beats everything), a room, or nothing. */
    pick(clientX, clientY) {
        const rc = this.stage.ray(clientX, clientY, 'hotel');
        const objs = [];
        for (const list of Object.values(this.bunnies)) for (const b of list) objs.push(b.root);
        const hitB = rc.intersectObjects(objs, true)[0];
        if (hitB) {
            let o = hitB.object;
            while (o && !objs.includes(o)) o = o.parent;
            const b = Object.values(this.bunnies).flat().find((x) => x.root === o);
            if (b) return { kind: 'bunny', room: b.room };
        }
        // a generous pick for bunnies: anything within a little of the ray (more generous when zoomed out)
        const u = this.cam.userData;
        let best = null, bd = 0.32 + 0.18 / u.zoom;
        for (const list of Object.values(this.bunnies)) for (const b of list) {
            const d = rc.ray.distanceToPoint(b.root.position.clone().setY(b.root.position.y + 0.2));
            if (d < bd) { bd = d; best = b; }
        }
        if (best) return { kind: 'bunny', room: best.room };
        const h = rc.intersectObjects(this.hits.map((x) => x.mesh), false)[0];
        if (h) { const x = this.hits.find((y) => y.mesh === h.object); return { kind: 'room', id: x.id }; }
        return null;
    }

    /** Screen position of a room's label anchor (just under the ceiling, at the front). */
    roomScreen(id) {
        const R = LAYOUT[id];
        return this.stage.toScreen(V((R.x0 + R.x1) / 2, R.lv * FLOOR_H + WALL_H - 0.25, Z1), 'hotel');
    }

    render() { this.stage.render('hotel', 'hotel'); }
}
