// The Foundry's hall: the building and everything in it that is not a robot.
// A concrete hall 146 m across, 236 m long and 50 m high, its roof held up on
// steel columns and trusses; three assembly lines run down it on fenced strips
// of deck plate, each under a rail of hooks, with its arms on pedestals and the
// scanner, test rig, paint booth and release plate at the end. At the far end
// the floor stops at a ledge over a pit of lava: the lines go on as gangways
// to an EXIT in the far wall, each with a stretch that rusted through and fell
// away long ago. Furnaces line one wall and flywheels turn on the
// other; two gantry cranes trundle up and down overhead, crates ride a
// monorail and unpainted chests a conveyor; there are racks of spare heads, a
// casting furnace, a stamping press, a tower of gears and a control desk on
// the walkway; and a lift comes down a lattice shaft from the Works above.
//
// Static pieces go into one Batch (merged per material, in cells the camera can
// cull); the things that move are kept in lists for update().

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, xf, under } from './materials.js';
import { lathe, gearShape } from './architecture.js';
import { canvas, toTexture } from './textures.js';
import { robotGeometries, rifleGeometries, SCALE } from './foundry-robot.js';
import { LINES, LINE_HALF, slotZ, RAIL_Y, LAST, PED_H, WAKE_Z, LEDGE_Z, HOLE_Z0, HOLE_Z1, GANGWAY_END, LAVA_Y, SHOPS, STATIONS, STRIP_END, MERGE, SARGE } from './foundry-line.js';
import { lavaMaterial, lavafallMaterial, underglow, beamMaterial } from './foundry-fx.js';
import { rng, TAU, clamp, lerp, smoothstep } from './util.js';

export const X0 = -86, X1 = 60, Z_BACK = 36, Z_FAR = -252, CEIL = 50;
export const WALK = { x0: LINE_HALF + 0.7, x1: 38 - LINE_HALF - 0.7, z0: LEDGE_Z + 0.7, z1: Z_BACK - 4 };
// the catwalk out over the pit: a strip beside the main gangway, and a platform across the end of it
// the catwalk out over the pit beside the walkway, and the deck at its end where the quartermaster stands
export const CATWALK = { x0: 4.6, x1: 8.4, z0: -231, z1: LEDGE_Z };
export const DECK = { x0: 1.75, x1: 8.4, z0: HOLE_Z0 + 2, z1: -231 };
// the open floor past the ends of the lines, where their units cross to the walkway
export const APRON = { x0: X0 + 4, x1: X1 - 4, z0: LEDGE_Z + 0.7, z1: STRIP_END - 1.5 };
export const LIFT = { x: 12, z: 19, w: 3.2 };   // the car's middle; its gate faces -z
const COLS_X = [-48, -17, 19, 49];
const COLS_Z = [0, -36, -72, -108, -144, -180];

/** Box-map a geometry's uvs from its own positions, so textures keep their size in metres. */
export function tiled(g, size = 1) {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (ay >= ax && ay >= az) uv.setXY(i, x / size, z / size);
        else if (ax >= az) uv.setXY(i, z / size, y / size);
        else uv.setXY(i, x / size, y / size);
    }
    return g;
}

// ---------------------------------------------------------------- textures

function noiseCanvas(n, base, spread, seed) {
    const c = canvas(n), ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    const r = rng(seed);
    for (let i = 0; i < n * n; i++) {
        const v = base + (r() - 0.5) * spread;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v * 0.98;
        img.data[i * 4 + 2] = v * 0.95;
        img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
}

function concreteTex() {
    const n = 256, c = noiseCanvas(n, 120, 26, 'concrete'), ctx = c.getContext('2d');
    const r = rng('stains');
    for (let i = 0; i < 18; i++) {
        const cx = r() * n, cy = r() * n;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 + r() * 50);
        g.addColorStop(0, `rgba(30,24,18,${0.12 + r() * 0.15})`);
        g.addColorStop(1, 'rgba(30,24,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, n, n);
    }
    ctx.strokeStyle = 'rgba(20,18,16,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, n - 2, n - 2);
    return toTexture(c);
}

function plateTex() {
    const n = 128, c = noiseCanvas(n, 70, 14, 'plate'), ctx = c.getContext('2d');
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const x = i * 16 + (j % 2) * 8, y = j * 16;
        ctx.save();
        ctx.translate(x + 4, y + 8);
        ctx.rotate(j % 2 ? 0.8 : -0.8);
        ctx.fillStyle = 'rgba(200,205,210,0.35)';
        ctx.fillRect(-5, -1.5, 10, 3);
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(0.5, 0.5, n - 1, n - 1);
    return toTexture(c);
}

function grateTex() {
    const n = 128, c = canvas(n), ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3c40';
    ctx.fillRect(0, 0, n, n);
    ctx.fillStyle = '#0c0b0b';
    for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) ctx.fillRect(i * 32 + 3, j * 16 + 3, 26, 10);
    return toTexture(c);
}

function beltTexture() {
    const c = canvas(64, 64), ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#34353a';
    ctx.fillRect(0, 0, 64, 10);
    ctx.fillStyle = '#0c0c0d';
    ctx.fillRect(0, 10, 64, 3);
    return toTexture(c);
}

function stripeTex() {
    const c = canvas(128, 32), ctx = c.getContext('2d');
    ctx.fillStyle = '#e0b020';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#141414';
    for (let x = -32; x < 160; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.lineTo(x + 16, 0);
        ctx.lineTo(x + 32, 0);
        ctx.lineTo(x + 16, 32);
        ctx.fill();
    }
    return toTexture(c);
}

function wallTex() {
    const n = 256, c = noiseCanvas(n, 96, 20, 'wall'), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 3, n);
    ctx.fillRect(0, 0, n, 3);
    ctx.fillRect(0, n / 2, n, 2);
    const g = ctx.createLinearGradient(0, 0, 0, n);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
    const r = rng('drips');
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(40,25,15,${0.08 + r() * 0.1})`;
        ctx.fillRect(r() * n, r() * n * 0.5, 2 + r() * 3, 30 + r() * 120);
    }
    return toTexture(c);
}

export function signTexture(text, sub, { bg = '#15110c', fg = '#ffd98a', rule = '#d9b46a', w = 1024, h = 256 } = {}) {
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = rule;
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(h * 0.36)}px "Cinzel", Georgia, serif`;
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h / 2, w - 60);
    if (sub) {
        ctx.font = `italic ${Math.round(h * 0.15)}px Georgia, serif`;
        ctx.fillStyle = rule;
        ctx.fillText(sub, w / 2, h * 0.76, w - 60);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
}

// ---------------------------------------------------------------- the hall

export class Hall {
    constructor(scene, lines) {
        this.scene = scene;
        this.lines = lines;
        this.spinners = [];
        this.blocks = [];        // rectangles the player can't walk into
        this.cranes = [];
        this.screens = [];
        const std = (o) => new THREE.MeshStandardMaterial(o);
        const tex = { concrete: concreteTex(), plate: plateTex(), grate: grateTex(), stripe: stripeTex(), wall: wallTex() };
        const rep = (t, x, y) => {
            const c = t.clone();
            c.repeat.set(x, y);
            c.needsUpdate = true;
            return c;
        };
        this.mats = {
            floor: std({ map: rep(tex.concrete, 40, 64), roughness: 0.9, color: 0xb8b2aa }),
            plate: std({ map: rep(tex.plate, 2.5, 60), roughness: 0.5, metalness: 0.7, color: 0x9aa0a6 }),
            grate: std({ map: tex.grate, roughness: 0.6, metalness: 0.7, color: 0x9a9ea4 }),
            stripe: std({ map: tex.stripe, roughness: 0.7 }),
            wall: underglow(std({ map: rep(tex.wall, 18, 4), roughness: 0.95, color: 0x8a8580 }), LAVA_Y, 24, 1.4),
            pitWall: underglow(std({ map: rep(tex.wall, 30, 2), roughness: 0.95, color: 0x5a4a42 }), LAVA_Y, 16, 2.2),
            ceiling: std({ color: 0x15161a, roughness: 1 }),
            steel: std({ color: 0x3d4652, roughness: 0.55, metalness: 0.55 }),
            beam: std({ color: 0x51596a, roughness: 0.5, metalness: 0.6 }),
            iron: std({ color: 0x2b2c30, roughness: 0.5, metalness: 0.75 }),
            yellow: std({ color: 0xd9a816, roughness: 0.5, metalness: 0.3 }),
            orange: std({ color: 0xd8701c, roughness: 0.5, metalness: 0.25 }),
            red: std({ color: 0x9a2a20, roughness: 0.5, metalness: 0.35 }),
            green: std({ color: 0x2f5a46, roughness: 0.5, metalness: 0.35 }),
            copper: std({ color: 0xc07a48, roughness: 0.35, metalness: 0.9 }),
            brass: std({ color: 0xd8b060, roughness: 0.3, metalness: 1.0 }),
            brick: std({ color: 0x6a3a2a, roughness: 0.95, map: rep(tex.wall, 2, 2) }),
            rail: std({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.9 }),
            primer: std({ color: 0x8f9499, roughness: 0.45, metalness: 0.35 }),
            robotDark: std({ color: 0x2c2e33, roughness: 0.55, metalness: 0.6 }),
            eyeOff: std({ color: 0x0b0e12, roughness: 0.15, metalness: 0.2 }),
            lamp: std({ color: 0x302010, emissive: 0xffe2b0, emissiveIntensity: 3.0 }),
            fire: std({ color: 0x220800, emissive: 0xff6a1a, emissiveIntensity: 3.2, roughness: 0.8 }),
            window: std({ color: 0x201810, emissive: 0xffc77a, emissiveIntensity: 1.6 }),
            coil: std({ color: 0x8a5a30, roughness: 0.3, metalness: 0.9, emissive: 0x3060ff, emissiveIntensity: 0.15 }),
            glass: new THREE.MeshStandardMaterial({ color: 0x9fc0d0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
            screen: std({ color: 0x050a0c, emissive: 0x2fd0a0, emissiveIntensity: 0.5 }),
            darkWood: std({ color: 0x6a5240, roughness: 0.85 }),
            rust: std({ color: 0x6e3b1c, roughness: 0.92, metalness: 0.35 }),
            daylight: std({ color: 0x202020, emissive: 0xfff0d0, emissiveIntensity: 1.05 }),
            rifleGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 3.0) }),
        };
        const b = new Batch({ cell: 48 });
        this.batch = b;
        this._shell(b);
        this._pit(b);
        this._columns(b);
        this._roof(b);
        for (const line of LINES) this._line(b, line);
        this._shopSigns();
        this._gangways(b);
        this._catwalk(b);
        this._lift(b);
        this._walkwayMachines(b);
        this._wallMachines(b);
        this._cranes(b);
        this._conveyors(b);
        this._pipes(b);
        this._lamps(b);
        this._speakers(b);
        scene.add(b.build(this.mats, { castShadow: false, receiveShadow: false }));
    }

    block(x0, x1, z0, z1) {
        this.blocks.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
    }

    // ------------------------------------------------------------ shell

    _shell(b) {
        const s = this.scene, m = this.mats;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z_BACK - LEDGE_Z).rotateX(-Math.PI / 2), m.floor);
        floor.position.set((X0 + X1) / 2, 0, (Z_BACK + LEDGE_Z) / 2);
        s.add(floor);
        // walls and ceiling: one box seen from inside
        const H = CEIL - (LAVA_Y - 3);
        const box = new THREE.BoxGeometry(X1 - X0, H, Z_BACK - Z_FAR);
        const uv = box.attributes.uv;
        // keep the wall texture in metres: scale each face's uvs
        const faceDims = [[Z_BACK - Z_FAR, H], [Z_BACK - Z_FAR, H], [X1 - X0, Z_BACK - Z_FAR], [X1 - X0, Z_BACK - Z_FAR], [X1 - X0, H], [X1 - X0, H]];
        for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
            const k = f * 4 + i;
            uv.setXY(k, uv.getX(k) * faceDims[f][0] / 14, uv.getY(k) * faceDims[f][1] / 14);
        }
        const wallMat = m.wall.clone();
        wallMat.side = THREE.BackSide;
        wallMat.map = m.wall.map.clone();
        wallMat.map.repeat.set(1, 1);
        wallMat.map.needsUpdate = true;
        wallMat.onBeforeCompile = m.wall.onBeforeCompile;
        wallMat.customProgramCacheKey = m.wall.customProgramCacheKey;
        const ceil = m.ceiling.clone();
        ceil.side = THREE.BackSide;
        const shell = new THREE.Mesh(box, [wallMat, wallMat, ceil, wallMat, wallMat, wallMat]);
        shell.position.set((X0 + X1) / 2, (LAVA_Y - 3) + H / 2, (Z_BACK + Z_FAR) / 2);
        s.add(shell);
        // pilasters up the long walls, and a dado of steel along the floor
        for (let z = Z_BACK - 6; z > Z_FAR + 4; z -= 12) {
            for (const x of [X0 + 0.6, X1 - 0.6]) {
                const y0 = z < LEDGE_Z ? LAVA_Y - 2 : 0;
                b.add('steel', new THREE.BoxGeometry(1.2, CEIL - y0, 1.6), xf(x, (CEIL + y0) / 2, z));
            }
        }
        for (let x = X0 + 6; x < X1 - 2; x += 12) b.add('steel', new THREE.BoxGeometry(1.6, CEIL, 1.2), xf(x, CEIL / 2, Z_BACK - 0.6));
        // walkway lines painted on the floor
        for (const x of [WALK.x0 + 0.2, WALK.x1 - 0.2]) b.add('yellow', new THREE.PlaneGeometry(0.16, WALK.z1 - WALK.z0).rotateX(-Math.PI / 2), xf(x, 0.012, (WALK.z1 + WALK.z0) / 2));
        for (let z = 4; z > LEDGE_Z + 10; z -= 18) {
            // chevrons pointing down the hall
            const chev = new THREE.Shape();
            chev.moveTo(-1.2, 0.6);
            chev.lineTo(0, -0.6);
            chev.lineTo(1.2, 0.6);
            chev.lineTo(1.2, 1.1);
            chev.lineTo(0, -0.1);
            chev.lineTo(-1.2, 1.1);
            b.add('yellow', new THREE.ShapeGeometry(chev).rotateX(-Math.PI / 2), xf(12.5, 0.013, z));
        }
    }

    // ------------------------------------------------------------ the pit

    _pit(b) {
        const s = this.scene, m = this.mats;
        // the ledge's face, down to the lava
        b.add('pitWall', new THREE.PlaneGeometry(X1 - X0, -LAVA_Y + 3).rotateY(Math.PI), xf((X0 + X1) / 2, (LAVA_Y - 3) / 2, LEDGE_Z - 0.01));
        b.add('stripe', tiled(new THREE.BoxGeometry(X1 - X0, 0.12, 0.5), 0.7), xf((X0 + X1) / 2, 0.06, LEDGE_Z + 0.25));
        // ribs down the ledge face
        for (let x = X0 + 4; x < X1; x += 8) b.add('iron', new THREE.BoxGeometry(0.6, -LAVA_Y, 0.8), xf(x, LAVA_Y / 2, LEDGE_Z - 0.4));
        // the lava
        this.lava = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 4, LEDGE_Z - Z_FAR + 4, 1, 1).rotateX(-Math.PI / 2), lavaMaterial());
        this.lava.position.set((X0 + X1) / 2, LAVA_Y, (LEDGE_Z + Z_FAR) / 2);
        s.add(this.lava);
        // falls of lava out of the far wall
        this.falls = lavafallMaterial();
        for (const [x, w, top] of [[-48, 7, 8], [-16, 5, 16], [20, 8, 4], [52, 4, 22]]) {
            const h = top - LAVA_Y;
            const g = new THREE.PlaneGeometry(w, h, 1, 1);
            const fall = new THREE.Mesh(g, this.falls);
            fall.position.set(x, LAVA_Y + h / 2, Z_FAR + 1.2);
            s.add(fall);
            // the mouth it pours from
            b.add('iron', lathe([[w * 0.5 + 0.6, 0], [w * 0.5 + 0.6, 1.2], [w * 0.5, 1.2], [w * 0.5, 0]], 16, Math.PI, Math.PI).rotateX(Math.PI / 2), xf(x, top, Z_FAR + 0.4));
            b.add('fire', new THREE.CircleGeometry(w * 0.5, 16, 0, Math.PI), xf(x, top, Z_FAR + 0.3));
        }
        // the far wall's girders and galleries, half lost in the heat
        for (const y of [6, 20, 34]) {
            if (y > 6) b.add('steel', new THREE.BoxGeometry(X1 - X0, 0.8, 1.6), xf((X0 + X1) / 2, y, Z_FAR + 0.8));
            else for (const [a, c] of [[X0, -10], [10, X1]]) b.add('steel', new THREE.BoxGeometry(c - a, 0.8, 1.6), xf((a + c) / 2, y, Z_FAR + 0.8));
        }
    }

    // ------------------------------------------------------------ structure

    _columns(b) {
        for (const x of COLS_X) for (const z of COLS_Z) {
            // an H-section column on a plinth, braced at the top
            b.add('steel', new THREE.BoxGeometry(2.0, CEIL - 2, 0.3), xf(x, (CEIL - 2) / 2, z - 0.85));
            b.add('steel', new THREE.BoxGeometry(2.0, CEIL - 2, 0.3), xf(x, (CEIL - 2) / 2, z + 0.85));
            b.add('steel', new THREE.BoxGeometry(0.3, CEIL - 2, 1.5), xf(x, (CEIL - 2) / 2, z));
            b.add('steel', new THREE.BoxGeometry(2.8, 0.6, 2.8), xf(x, 0.3, z));
            b.add('stripe', tiled(new THREE.BoxGeometry(2.86, 0.5, 2.86), 0.7), xf(x, 0.95, z));
            for (let y = 2; y < CEIL - 4; y += 0.9) {
                for (const dz of [-1.02, 1.02]) b.add('brass', new THREE.SphereGeometry(0.05, 4, 3), xf(x - 0.6, y, z + dz));
            }
            // the crane rail brackets
            b.add('steel', new THREE.BoxGeometry(2.4, 1.2, 2.2), xf(x, 29.4, z));
            if (x === 19) this.block(x - 1.6, x + 1.6, z - 1.6, z + 1.6);
        }
        // crane rails along the columns
        for (const x of [X0 + 2.5, ...COLS_X, X1 - 2.5]) b.add('rail', new THREE.BoxGeometry(0.4, 0.5, Z_BACK - LEDGE_Z), xf(x, 30.25, (Z_BACK + LEDGE_Z) / 2));
        for (const x of [X0 + 2.5, X1 - 2.5]) for (let z = Z_BACK - 6; z > LEDGE_Z; z -= 12) b.add('steel', new THREE.BoxGeometry(3.8, 1.0, 1.0), xf(x + (x < 0 ? -0.8 : 0.8), 29.6, z));
    }

    _roof(b) {
        const span = X1 - X0, cx = (X0 + X1) / 2;
        for (let z = Z_BACK - 6; z > Z_FAR + 6; z -= 12) {
            const yb = CEIL - 7, yt = CEIL - 1;
            b.add('beam', new THREE.BoxGeometry(span, 0.5, 0.5), xf(cx, yt, z));
            b.add('beam', new THREE.BoxGeometry(span, 0.4, 0.4), xf(cx, yb, z));
            for (let x = X0 + 3; x < X1 - 3; x += 6) {
                b.add('beam', new THREE.BoxGeometry(0.25, yt - yb, 0.25), xf(x, (yt + yb) / 2, z));
                const len = Math.hypot(6, yt - yb);
                b.add('beam', new THREE.BoxGeometry(0.2, len, 0.2), xf(x + 3, (yt + yb) / 2, z, 0, 1, 1, 1, 0, Math.atan2(6, yt - yb) * (Math.floor((x - X0) / 6) % 2 ? 1 : -1)));
            }
        }
        // purlins along the length
        for (let x = X0 + 6; x < X1; x += 12) b.add('beam', new THREE.BoxGeometry(0.3, 0.4, Z_BACK - Z_FAR), xf(x, CEIL - 0.6, (Z_BACK + Z_FAR) / 2));
    }

    // ------------------------------------------------------------ the lines

    _line(b, line) {
        const x = line.x, H = LINE_HALF;
        const z0 = 16, z1 = STRIP_END, len = z0 - z1, zc = (z0 + z1) / 2;
        b.add('plate', new THREE.PlaneGeometry(H * 2, len).rotateX(-Math.PI / 2), xf(x, 0.015, zc));
        for (const sd of [-1, 1]) {
            b.add('stripe', tiled(new THREE.BoxGeometry(0.3, 0.22, len), 0.7), xf(x + sd * (H + 0.15), 0.11, zc));
            // the fence
            for (let z = z0; z >= z1; z -= 2.5) b.add('yellow', new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), xf(x + sd * (H + 0.3), 0.75, z));
            for (const y of [0.75, 1.28]) b.add('yellow', new THREE.BoxGeometry(0.07, 0.07, len), xf(x + sd * (H + 0.3), y, zc));
        }
        b.add('yellow', new THREE.BoxGeometry(H * 2 + 0.6, 0.07, 0.07), xf(x, 1.28, z0));
        // the rail of hooks: an I-beam on portal frames, a housing at each end
        const r0 = slotZ(-1) + 0.5, r1 = slotZ(LAST) - 1.5;
        const rl = r0 - r1, rc = (r0 + r1) / 2;
        b.add('rail', new THREE.BoxGeometry(0.5, 0.08, rl), xf(x, RAIL_Y + 0.52, rc));
        b.add('steel', new THREE.BoxGeometry(0.1, 0.6, rl), xf(x, RAIL_Y + 0.86, rc));
        b.add('steel', new THREE.BoxGeometry(0.5, 0.1, rl), xf(x, RAIL_Y + 1.2, rc));
        for (let z = r0 - 2; z > r1; z -= 14) {
            for (const sd of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.4, RAIL_Y + 2.2, 0.4), xf(x + sd * (H - 0.4), (RAIL_Y + 2.2) / 2, z));
            b.add('steel', new THREE.BoxGeometry(H * 2, 0.5, 0.45), xf(x, RAIL_Y + 2.0, z));
            b.add('steel', new THREE.BoxGeometry(0.2, 0.6, 0.2), xf(x, RAIL_Y + 1.5, z));
        }
        for (const z of [slotZ(-1), slotZ(LAST)]) {
            b.add('iron', new THREE.BoxGeometry(2.0, 3.4, 3.0), xf(x, RAIL_Y + 2.9, z));
            b.add('stripe', tiled(new THREE.BoxGeometry(2.04, 0.3, 3.04), 0.7), xf(x, RAIL_Y + 1.3, z));
        }
        // a pedestal under every arm, and a feeder beside each that hands it parts
        const arms = this.lines.lines[line.id].arms;
        for (const a of arms) {
            b.add('iron', new THREE.CylinderGeometry(0.5, 0.62, PED_H, 16), xf(a.base.x, PED_H / 2, a.base.z));
            b.add('stripe', new THREE.CylinderGeometry(0.64, 0.64, 0.12, 16), xf(a.base.x, 0.06, a.base.z));
            if (a.kind === 'place') {
                b.add('steel', new THREE.BoxGeometry(0.8, a.feeder.y, 0.8), xf(a.feeder.x, a.feeder.y / 2, a.feeder.z));
                b.add('iron', new THREE.BoxGeometry(0.86, 0.06, 0.86), xf(a.feeder.x, a.feeder.y + 0.03, a.feeder.z));
                b.add('stripe', tiled(new THREE.BoxGeometry(0.82, 0.12, 0.82), 0.7), xf(a.feeder.x, a.feeder.y - 0.2, a.feeder.z));
            }
        }
        // the scanner's gantry
        const zs = slotZ(5);
        for (const sd of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.3, 5.0, 0.3), xf(x + sd * 1.3, 2.5, zs));
        b.add('steel', new THREE.BoxGeometry(2.9, 0.3, 0.3), xf(x, 5.0, zs));
        // the test rig's two coils
        for (const c of this.lines.coils(line)) {
            b.add('iron', new THREE.CylinderGeometry(0.6, 0.8, 0.8, 16), xf(c.x, 0.4, c.z));
            b.add('coil', new THREE.CylinderGeometry(0.32, 0.32, c.y - 1.4, 16), xf(c.x, 0.8 + (c.y - 1.4) / 2, c.z));
            for (let y = 1.2; y < c.y - 0.8; y += 0.22) b.add('copper', new THREE.TorusGeometry(0.34, 0.03, 4, 16).rotateX(Math.PI / 2), xf(c.x, y, c.z));
            b.add('rail', new THREE.TorusGeometry(0.62, 0.24, 10, 24).rotateX(Math.PI / 2), xf(c.x, c.y, c.z));
        }
        // the paint booth
        const zp = slotZ(25), bw = 4.6, bh = 5.6;
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.25, bh, 0.25), xf(x + dx * bw / 2, bh / 2, zp + dz * bw / 2));
        for (const dz of [-1, 1]) b.add('steel', new THREE.BoxGeometry(bw, 0.3, 0.3), xf(x, bh, zp + dz * bw / 2));
        for (const dx of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.3, 0.3, bw), xf(x + dx * bw / 2, bh, zp));
        for (const dx of [-1, 1]) b.add('glass', new THREE.PlaneGeometry(bw, bh - 0.3).rotateY(Math.PI / 2), xf(x + dx * bw / 2, (bh - 0.3) / 2, zp));
        for (const dz of [-1, 1]) b.add('glass', new THREE.PlaneGeometry(bw, 1.6), xf(x, bh - 1.1, zp + dz * bw / 2));
        for (let k = 0; k < 6; k++) for (const dx of [-1, 1]) b.add('brass', new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6).rotateZ(Math.PI / 2), xf(x + dx * (bw / 2 - 0.2), 0.8 + k * 0.8, zp));
        // the release plate: a short belt that carries each unit off it while it wakes
        const zr = slotZ(LAST) + 1.2, zw = WAKE_Z - 1.2, bl = zr - zw;
        b.add('stripe', tiled(new THREE.BoxGeometry(2.9, 0.05, bl + 0.4), 0.7), xf(x, 0.025, (zr + zw) / 2));
        for (const sd of [-1, 1]) b.add('iron', new THREE.BoxGeometry(0.2, 0.18, bl), xf(x + sd * 1.3, 0.09, (zr + zw) / 2));
        const tex = this.beltTex ??= beltTexture();
        const bm = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.85, color: 0x9a9a9a });
        bm.map.repeat.set(1, bl / 0.5);
        bm.map.needsUpdate = true;
        const belt = new THREE.Mesh(new THREE.PlaneGeometry(2.4, bl).rotateX(-Math.PI / 2), bm);
        belt.position.set(x, 0.06, (zr + zw) / 2);
        this.scene.add(belt);
        (this.belts ??= []).push({ line: line.id, map: bm.map });
    }

    /** A board hung over the main line where each shop begins. */
    _shopSigns() {
        for (const shop of SHOPS) {
            const z = slotZ(shop.from) + 3.4;
            const tex = signTexture(shop.name.replace(/^The /, '').toUpperCase(), shop.sub, { fg: shop.accent, rule: '#c8a868' });
            const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15), side: THREE.DoubleSide }));
            m.position.set(0, 11.2, z);
            this.scene.add(m);
            for (const sd of [-1, 1]) this.batch.add('iron', new THREE.CylinderGeometry(0.03, 0.03, 3, 4), xf(sd * 3.6, 13.7, z));
            this.batch.add('steel', new THREE.BoxGeometry(8.3, 0.2, 0.2), xf(0, 12.25, z));
        }
    }

    _gangways(b) {
        const W = 3.2, z0 = LEDGE_Z, z1 = GANGWAY_END, x = MERGE.x, r = rng('gap');
        // across the apron, a lane painted for each line's units, all running in to the walkway
        for (const line of LINES) {
            for (const g of line.seg) {
                if (g.az <= MERGE.z + 0.01) break;
                const yaw = Math.atan2(g.dx, g.dz), mx = g.ax + (g.dx * g.len) / 2, mz = g.az + (g.dz * g.len) / 2;
                b.add('plate', tiled(new THREE.BoxGeometry(2.2, 0.02, g.len + 2.2), 1.6), xf(mx, 0.01, mz, yaw));
                for (const sd of [-1, 1]) b.add('yellow', new THREE.BoxGeometry(0.12, 0.025, g.len + 2.2), xf(mx + Math.cos(yaw) * sd * 1.1, 0.013, mz - Math.sin(yaw) * sd * 1.1, yaw));
            }
        }
        b.add('plate', tiled(new THREE.BoxGeometry(3.2, 0.02, MERGE.z - z0 + 2), 1.6), xf(x, 0.01, (MERGE.z + z0) / 2));
        // the walkway itself, either side of the stretch that broke away
        const deckSide = (z) => z < CATWALK.z0 + 0.1 && z > DECK.z0 - 0.1;
        for (const [a, c] of [[z0, HOLE_Z0], [HOLE_Z1, z1]]) {
            b.add('grate', tiled(new THREE.BoxGeometry(W, 0.3, a - c), 1.2), xf(x, -0.15, (a + c) / 2));
            for (const sd of [-1, 1]) {
                b.add('steel', new THREE.BoxGeometry(0.3, 0.7, a - c), xf(x + sd * (W / 2 + 0.15), -0.35, (a + c) / 2));
                // railings, but none on the quartermaster's side where it hands the rifles over
                const runs = sd > 0 && a === z0 ? [[a, CATWALK.z0], [DECK.z0, c]] : [[a, c]];
                for (const [p, q] of runs) {
                    if (p - q < 0.2) continue;
                    for (const y of [0.55, 1.08]) b.add('yellow', new THREE.BoxGeometry(0.07, 0.07, p - q), xf(x + sd * (W / 2 + 0.1), y, (p + q) / 2));
                    for (let z = p; z >= q - 0.01; z -= 2) if (!(sd > 0 && deckSide(z) && z < p - 0.1)) b.add('yellow', new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), xf(x + sd * (W / 2 + 0.1), 0.55, z));
                }
            }
            for (let i = 0; i < 9; i++) {
                const z = lerp(a, c, r());
                if (z < -225 || r() < 0.3) b.add('rust', new THREE.BoxGeometry(0.4 + r() * 1.2, 0.02, 0.6 + r() * 1.5), xf(x + (r() - 0.5) * W * 0.7, 0.012, z, r() * 0.5));
            }
        }
        b.add('yellow', new THREE.BoxGeometry(W + 0.2, 0.07, 0.07), xf(x, 1.08, z1 + 0.05));
        // the broken ends: torn grating hanging down into the gap, girders snapped and sagging, railings bent over
        for (const [edge, dir] of [[HOLE_Z0, -1], [HOLE_Z1, 1]]) {
            for (let i = 0; i < 3; i++) {
                const w = 0.5 + r() * 0.7, l = 0.6 + r() * 1.1, tilt = 0.5 + r() * 0.9;
                b.add(r() < 0.5 ? 'rust' : 'grate', tiled(new THREE.BoxGeometry(w, 0.05, l).translate(0, 0, (dir * l) / 2), 1.2), xf(x + (i - 1) * 1.0 + (r() - 0.5) * 0.4, -0.05, edge, (r() - 0.5) * 0.3, 1, 1, 1, dir * tilt, (r() - 0.5) * 0.3));
            }
            for (const sd of [-1, 1]) {
                const l = 0.8 + r() * 1.4;
                b.add('rust', new THREE.BoxGeometry(0.3, 0.6, l).translate(0, -0.3, (dir * l) / 2), xf(x + sd * (W / 2 + 0.15), -0.05, edge, 0, 1, 1, 1, dir * (0.25 + r() * 0.5)));
            }
            const sd = r() < 0.5 ? -1 : 1, l = 1.4 + r();
            b.add('yellow', new THREE.BoxGeometry(0.07, 0.07, l).translate(0, 0, (dir * l) / 2), xf(x + sd * (W / 2 + 0.1), 1.08, edge, sd * 0.2, 1, 1, 1, dir * (0.9 + r() * 0.4)));
            b.add('yellow', new THREE.BoxGeometry(0.07, 0.07, l * 0.6).translate(0, 0, dir * l * 0.3), xf(x - sd * (W / 2 + 0.1), 0.55, edge, 0, 1, 1, 1, dir * (1.2 + r() * 0.3)));
        }
        // pylons down into the lava
        for (const z of [-210, -226, -240]) {
            b.add('steel', new THREE.BoxGeometry(1.4, -LAVA_Y + 1, 1.4), xf(x, (LAVA_Y - 1) / 2 - 0.3, z));
            b.add('iron', new THREE.BoxGeometry(W + 1.2, 0.8, 1.2), xf(x, -0.9, z));
        }
        // the way out: a tall door full of daylight in the far wall, under a very large EXIT sign
        const zd = Z_FAR + 0.35;
        for (const sd of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.6, 6.2, 0.8), xf(x + sd * 3.3, 3.1, zd));
        b.add('steel', new THREE.BoxGeometry(7.2, 0.7, 0.8), xf(x, 6.45, zd));
        b.add('daylight', new THREE.PlaneGeometry(6, 6.1), xf(x, 3.05, zd + 0.05));
        const exit = new THREE.Mesh(new THREE.PlaneGeometry(18, 6.2), new THREE.MeshBasicMaterial({ map: signTexture('EXIT', '→   this way out   →', { bg: '#0b6a2e', fg: '#f6fff8', rule: '#c8ffd8', w: 1024, h: 352 }), color: new THREE.Color(1.7, 1.7, 1.7) }));
        exit.position.set(x, 11.6, zd + 0.15);
        this.scene.add(exit);
        b.add('steel', new THREE.BoxGeometry(18.8, 7, 0.4), xf(x, 11.6, zd - 0.05));
        for (const sd of [-1, 1]) b.add('iron', new THREE.CylinderGeometry(0.05, 0.05, 8, 4), xf(x + sd * 8, 19, zd));
        this.exitLight = new THREE.PointLight(0x6aff9a, 60, 40, 1.5);
        this.exitLight.position.set(x, 11, zd + 6);
        this.scene.add(this.exitLight);
        const glow = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 16, 1, true).translate(0, -9, 0).rotateX(-Math.PI / 2), beamMaterial(new THREE.Color(1, 0.95, 0.8), 0.06));
        glow.position.set(x, 3.05, zd);
        this.scene.add(glow);
        // the quartermaster's crate of rifles
        const rg = rifleGeometries();
        const cx = SARGE.x + 1.5, cz = SARGE.z - 0.3;
        b.add('green', new THREE.BoxGeometry(1.0, 0.8, 1.9), xf(cx, 0.4, cz));
        b.add('darkWood', new THREE.BoxGeometry(1.06, 0.08, 1.96), xf(cx, 0.82, cz));
        for (let i = 0; i < 6; i++) {
            const at = xf(cx - 0.3 + (i % 3) * 0.3, 0.9, cz + (i < 3 ? -0.2 : 0.25), (i < 3 ? 0 : Math.PI) + (r() - 0.5) * 0.1, 1, 1, 1, Math.PI / 2 * 0, 0);
            b.add('robotDark', rg.body, at);
            b.add('rifleGlow', rg.glow, at);
        }
        b.add('green', new THREE.BoxGeometry(0.9, 0.6, 1.2), xf(cx + 0.1, 0.3, cz + 1.8, 0.2));
        this.block(SARGE.x - 0.8, cx + 0.55, SARGE.z - 1.4, SARGE.z + 1.2);
        this.block(cx - 0.45, cx + 0.6, cz + 1.0, cz + 2.5);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: signTexture('QUARTERMASTER', 'One each. Sign here.', { fg: '#c8d890', rule: '#8a9a5a', bg: '#1c2014' }), color: new THREE.Color(1.1, 1.1, 1.1), side: THREE.DoubleSide }));
        sign.position.set(cx + 0.64, 2.9, cz + 0.4);
        sign.rotation.y = Math.PI / 2;
        this.scene.add(sign);
        b.add('steel', new THREE.BoxGeometry(0.12, 2.6, 0.12), xf(cx + 0.62, 1.3, cz + 0.4));
        // the counter over the main gangway, at the ledge
        this.counter = { canvas: canvas(1024, 256), last: -1 };
        this.counter.tex = toTexture(this.counter.canvas);
        this.counter.tex.wrapS = this.counter.tex.wrapT = THREE.ClampToEdgeWrapping;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: this.counter.tex, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide }));
        board.position.set(0, 10.4, LEDGE_Z + 1);
        this.scene.add(board);
        b.add('iron', new THREE.BoxGeometry(9.4, 2.6, 0.2), xf(0, 10.4, LEDGE_Z + 0.88));
        for (const sd of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.4, 11.6, 0.4), xf(sd * 4.9, 5.8, LEDGE_Z + 0.7));
        // the railing along the ledge, broken for the gangways and the catwalk
        const gaps = [[MERGE.x - 1.8, MERGE.x + 1.8], [CATWALK.x0 - 0.2, CATWALK.x1 + 0.2]];
        let lx = X0 + 1;
        for (const [g0, g1] of [...gaps, [X1 - 1, X1]]) {
            if (g0 > lx) {
                const w = g0 - lx;
                for (const y of [0.55, 1.1]) b.add('yellow', new THREE.BoxGeometry(w, 0.07, 0.07), xf(lx + w / 2, y, LEDGE_Z + 0.35));
                for (let px = lx; px <= g0; px += 2) b.add('yellow', new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), xf(px, 0.55, LEDGE_Z + 0.35));
            }
            lx = g1;
        }
    }

    /** The counter board: units finished. */
    drawCounter(n) {
        const c = this.counter;
        if (c.last === n) return;
        c.last = n;
        const ctx = c.canvas.getContext('2d');
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(0, 0, 1024, 256);
        ctx.strokeStyle = '#e0b020';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 1004, 236);
        ctx.fillStyle = '#e0b020';
        ctx.font = '700 40px "Cinzel", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('UNITS COMPLETED', 512, 62);
        ctx.font = '700 120px "SFMono-Regular", Menlo, Consolas, monospace';
        ctx.fillStyle = '#ff9a3a';
        ctx.fillText(n.toLocaleString('en-GB').replace(/,/g, ' '), 512, 160);
        ctx.font = 'italic 24px Georgia, serif';
        ctx.fillStyle = '#c8a868';
        ctx.fillText('units that have reached the exit: 0', 512, 224);
        c.tex.needsUpdate = true;
    }

    _catwalk(b) {
        /** A railing from (xa, za) to (xb, zb), with a beam under the deck's edge. */
        const rail = (xa, za, xb, zb) => {
            const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
            const xm = (xa + xb) / 2, zm = (za + zb) / 2;
            b.add('steel', new THREE.BoxGeometry(0.2, 0.3, len), xf(xm, -0.25, zm, yaw));
            for (const y of [0.55, 1.1]) b.add('yellow', new THREE.BoxGeometry(0.07, 0.07, len), xf(xm, y, zm, yaw));
            const n = Math.max(1, Math.round(len / 2));
            for (let i = 0; i <= n; i++) b.add('yellow', new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), xf(xa + ((xb - xa) * i) / n, 0.55, za + ((zb - za) * i) / n));
        };
        const C = CATWALK, D = DECK;
        b.add('grate', tiled(new THREE.BoxGeometry(C.x1 - C.x0, 0.25, C.z1 - C.z0), 1.2), xf((C.x0 + C.x1) / 2, -0.125, (C.z0 + C.z1) / 2));
        b.add('grate', tiled(new THREE.BoxGeometry(D.x1 - D.x0, 0.25, D.z1 - D.z0), 1.2), xf((D.x0 + D.x1) / 2, -0.125, (D.z0 + D.z1) / 2));
        rail(C.x0 - 0.1, C.z1, C.x0 - 0.1, C.z0);
        rail(D.x0, C.z0, C.x0 - 0.1, C.z0);
        rail(C.x1 + 0.1, C.z1, C.x1 + 0.1, D.z0 - 0.1);
        rail(D.x0, D.z0 - 0.1, D.x1 + 0.1, D.z0 - 0.1);
        for (const [px, z] of [[C.x1 - 0.8, -212], [C.x1 - 0.8, D.z0 + 1], [D.x0 + 1, D.z0 + 1]]) b.add('steel', new THREE.BoxGeometry(1.1, -LAVA_Y, 1.1), xf(px, LAVA_Y / 2 - 0.3, z));
        for (const px of [C.x0, C.x1]) b.add('steel', new THREE.BoxGeometry(0.25, 0.25, 9).rotateX(-0.7), xf(px, -3.3, C.z1 - 3.4));
    }

    // ------------------------------------------------------------ the lift

    _lift(b) {
        const { x, z, w } = LIFT;
        const h = w / 2 + 0.25;
        const top = CEIL + 1;
        // a lattice shaft from the floor up through the roof
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.32, top, 0.32), xf(x + dx * h, top / 2, z + dz * h));
        for (let y = 4.5; y < top; y += 4) {
            for (const dz of [-1, 1]) b.add('steel', new THREE.BoxGeometry(h * 2, 0.2, 0.2), xf(x, y, z + dz * h));
            for (const dx of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.2, 0.2, h * 2), xf(x + dx * h, y, z));
            const d = Math.hypot(h * 2, 4);
            for (const dx of [-1, 1]) b.add('steel', new THREE.BoxGeometry(0.12, d, 0.12), xf(x + dx * h, y + 2, z, 0, 1, 1, 1, Math.atan2(h * 2, 4) * (Math.round(y) % 8 < 4 ? 1 : -1)));
            b.add('steel', new THREE.BoxGeometry(0.12, d, 0.12), xf(x, y + 2, z + h, 0, 1, 1, 1, 0, Math.atan2(h * 2, 4) * (Math.round(y) % 8 < 4 ? 1 : -1)));
        }
        // the pit and the sign at its foot
        b.add('stripe', tiled(new THREE.BoxGeometry(h * 2 + 0.4, 0.06, 0.4), 0.7), xf(x, 0.03, z - h - 0.25));
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: signTexture('▲ THE WORKS', 'Lift to the machine hall', { fg: '#ffd98a' }), color: new THREE.Color(1.2, 1.2, 1.2) }));
        sign.position.set(x, 4.0, z - h - 0.2);
        sign.rotation.y = Math.PI;
        this.scene.add(sign);
        // the car, which moves, with its own lamp
        const car = new THREE.Group();
        const m = this.mats;
        const cw = w;
        car.add(mesh(new THREE.BoxGeometry(cw, 0.2, cw), m.grate, 0, -0.1, 0));
        car.add(mesh(new THREE.BoxGeometry(cw, 0.15, cw), m.iron, 0, 3.1, 0));
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) car.add(mesh(new THREE.BoxGeometry(0.12, 3.1, 0.12), m.brass, dx * (cw / 2 - 0.06), 1.55, dz * (cw / 2 - 0.06)));
        // brass bars on three sides
        const bars = new THREE.Group();
        for (let i = 1; i < 12; i++) {
            const t = -cw / 2 + (i / 12) * cw;
            bars.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.0, 5), m.brass, -cw / 2 + 0.06, 1.55, t));
            bars.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.0, 5), m.brass, cw / 2 - 0.06, 1.55, t));
            bars.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.0, 5), m.brass, t, 1.55, cw / 2 - 0.06));
        }
        for (const y of [1.0, 2.2]) {
            bars.add(mesh(new THREE.BoxGeometry(0.05, 0.05, cw), m.brass, -cw / 2 + 0.06, y, 0));
            bars.add(mesh(new THREE.BoxGeometry(0.05, 0.05, cw), m.brass, cw / 2 - 0.06, y, 0));
            bars.add(mesh(new THREE.BoxGeometry(cw, 0.05, 0.05), m.brass, 0, y, cw / 2 - 0.06));
        }
        car.add(mergeChildren(bars));
        // a lamp under the roof and a panel of buttons
        car.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), m.lamp, 0, 2.9, 0));
        car.add(mesh(new THREE.BoxGeometry(0.06, 0.6, 0.3), m.iron, cw / 2 - 0.12, 1.4, 0.8));
        for (let i = 0; i < 2; i++) car.add(mesh(new THREE.CircleGeometry(0.05, 10).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: i ? new THREE.Color(2.6, 0.5, 0.2) : new THREE.Color(0.4, 2.2, 0.6) }), cw / 2 - 0.16, 1.55 - i * 0.2, 0.8));
        // the folding gate on the open side
        const gate = new THREE.Group();
        // waist-high, so you can see out over it on the way down
        for (let i = 0; i < 14; i++) {
            const leaf = mesh(new THREE.BoxGeometry(0.03, 1.15, 0.03), m.brass, 0, 0.62, 0);
            leaf.userData.i = i;
            gate.add(leaf);
        }
        for (const y of [0.1, 0.62, 1.15]) {
            const bar = mesh(new THREE.BoxGeometry(1, 0.04, 0.04), m.brass, 0, y, 0);
            bar.userData.rail = true;
            gate.add(bar);
        }
        gate.position.set(0, 0, -cw / 2 + 0.05);
        car.add(gate);
        mergeChildren(car);
        car.position.set(x, 0, z);
        this.scene.add(car);
        this.liftLight = new THREE.PointLight(0xffd8a0, 5, 8, 1.6);
        this.liftLight.position.set(0, 2.6, 0);
        car.add(this.liftLight);
        this.car = car;
        this.gate = gate;
        this.setGate(1);
        // the winding wheel at the top of the shaft
        const wheel = new THREE.Group();
        wheel.add(mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 28), m.iron));
        for (let i = 0; i < 6; i++) wheel.add(mesh(new THREE.BoxGeometry(2.8, 0.1, 0.1).rotateZ((i / 6) * Math.PI), m.iron));
        mergeChildren(wheel);
        wheel.position.set(x, CEIL - 2.5, z);
        wheel.rotation.y = Math.PI / 2;
        this.scene.add(wheel);
        this.liftWheel = wheel;
        b.add('steel', new THREE.BoxGeometry(h * 2 + 1, 0.6, 0.8), xf(x, CEIL - 4.4, z));
        // the cables, one from the wheel to the car and one to the counterweight
        this.cable = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, 0.5, 0), m.iron, x - 1.4, 0, z);
        this.scene.add(this.cable);
        this.counterweight = mesh(new THREE.BoxGeometry(1.2, 2.2, 0.5), m.iron, x + 1.4, 0, z + h - 0.4);
        this.cwCable = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, 0.5, 0), m.iron, x + 1.4, 0, z + h - 0.4);
        this.scene.add(this.counterweight, this.cwCable);
        this.setCar(0);
        // walls of the car for the player (the gate side is open)
        this.block(x - h - 0.2, x - h + 0.35, z - h, z + h + 0.2);
        this.block(x + h - 0.35, x + h + 0.2, z - h, z + h + 0.2);
        this.block(x - h, x + h, z + h - 0.35, z + h + 0.3);
    }

    /** 1 open, 0 shut: the gate's leaves fold to one side. */
    setGate(open) {
        const cw = LIFT.w, span = cw - 0.2;
        const shut = span, packed = 0.5;
        const width = lerp(shut, packed, open);
        for (const c of this.gate.children) {
            if (c.userData.rail) {
                c.scale.x = width;
                c.position.x = cw / 2 - 0.1 - width / 2;
            } else c.position.x = cw / 2 - 0.1 - (c.userData.i / 13) * width;
        }
        this.gateOpen = open;
    }

    /** The car's floor height. */
    setCar(y) {
        const top = CEIL - 2.5;
        this.car.position.y = y;
        this.cable.position.y = y + 3.2;
        this.cable.scale.y = Math.max(0.1, top - (y + 3.2));
        const cwY = clamp(top - 4 - y * 0.85, 1.2, top - 3);
        this.counterweight.position.y = cwY;
        this.cwCable.position.y = cwY + 1.1;
        this.cwCable.scale.y = Math.max(0.1, top - cwY - 1.1);
        this.carY = y;
    }

    // ------------------------------------------------------------ on the walkway

    _walkwayMachines(b) {
        const m = this.mats;
        const geos = robotGeometries();
        // racks of spare heads
        for (let r = 0; r < 3; r++) {
            const z0 = -3 - r * 8.4, x = 30.6, len = 7.4;
            for (const dz of [0, len]) for (const dx of [-0.7, 0.7]) b.add('steel', new THREE.BoxGeometry(0.14, 3.3, 0.14), xf(x + dx, 1.65, z0 - dz));
            for (const y of [0.35, 1.45, 2.55]) {
                b.add('orange', new THREE.BoxGeometry(1.5, 0.08, len), xf(x, y, z0 - len / 2));
                for (let i = 0; i < 7; i++) {
                    const hz = z0 - 0.55 - i * 1.05;
                    const at = xf(x, y + 0.04, hz, -Math.PI / 2, SCALE);
                    b.add('primer', geos.cranium, at);
                    if ((i + r + Math.round(y)) % 3) b.add('robotDark', geos.face, at);
                    if ((i + r) % 2) b.add('eyeOff', geos.eyes, at);
                }
            }
            this.block(x - 0.9, x + 0.9, z0 + 0.3, z0 - len - 0.3);
        }
        const rackSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: signTexture('SPARE HEADS', 'Take one only if you need one', { fg: '#ffc46a' }), color: new THREE.Color(1.1, 1.1, 1.1) }));
        rackSign.position.set(29.8, 3.9, -2.6);
        rackSign.rotation.y = -Math.PI / 2 + 0.6;
        this.scene.add(rackSign);

        // the casting furnace: a crucible tips molten metal into chest moulds
        {
            const x = 28.8, z = -54;
            b.add('brick', new THREE.BoxGeometry(5, 6.5, 5), xf(x + 1, 3.25, z));
            b.add('iron', new THREE.BoxGeometry(5.2, 0.4, 5.2), xf(x + 1, 6.6, z));
            b.add('fire', new THREE.PlaneGeometry(1.8, 1.4).rotateY(-Math.PI / 2), xf(x - 1.51, 1.4, z));
            b.add('iron', new THREE.CylinderGeometry(0.5, 0.6, 9, 12), xf(x + 1.5, 11, z + 1));
            // the gantry the crucible swings on
            for (const dz of [-2.2, 2.2]) b.add('steel', new THREE.BoxGeometry(0.3, 5.4, 0.3), xf(x - 3.2, 2.7, z + dz));
            b.add('steel', new THREE.BoxGeometry(0.3, 0.3, 4.7), xf(x - 3.2, 5.4, z));
            const cru = new THREE.Group();
            cru.position.set(x - 3.2, 4.2, z);
            const pot = new THREE.Mesh(lathe([[0, -0.9], [0.9, -0.85], [1.1, 0.4], [1.2, 0.9], [1.05, 0.9], [0.95, 0.4], [0, 0.3]], 20), m.iron);
            cru.add(pot);
            const melt = new THREE.Mesh(new THREE.CircleGeometry(0.96, 20).rotateX(-Math.PI / 2), m.fire);
            melt.position.y = 0.55;
            cru.add(melt);
            for (const dz of [-1.25, 1.25]) cru.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8).rotateX(Math.PI / 2), m.iron, 0, 0.5, dz));
            this.scene.add(cru);
            const pour = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 8).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.25) }));
            pour.position.set(x - 4.3, 4.6, z);
            this.scene.add(pour);
            // moulds on a short belt
            b.add('iron', new THREE.BoxGeometry(1.8, 0.8, 7), xf(x - 4.4, 0.4, z));
            const moulds = [];
            for (let i = 0; i < 4; i++) {
                const mm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.7, metalness: 0.4, emissive: 0xff5a10, emissiveIntensity: 0 }));
                this.scene.add(mm);
                moulds.push(mm);
            }
            this.casting = { cru, pour, moulds, x: x - 4.4, z };
            this.block(x - 5.4, x + 3.6, z - 3.6, z + 3.6);
        }

        // the stamping press
        {
            const x = 29, z = -96;
            for (const dz of [-1.5, 1.5]) b.add('steel', new THREE.BoxGeometry(1.0, 7.5, 0.9), xf(x, 3.75, z + dz));
            b.add('steel', new THREE.BoxGeometry(1.6, 1.4, 4.2), xf(x, 7.6, z));
            b.add('iron', new THREE.BoxGeometry(2.4, 1.0, 3.2), xf(x, 0.5, z));
            b.add('stripe', tiled(new THREE.BoxGeometry(2.44, 0.2, 3.24), 0.7), xf(x, 1.1, z));
            b.add('iron', new THREE.CylinderGeometry(0.45, 0.45, 2.2, 14), xf(x, 9.4, z));
            const ram = new THREE.Group();
            ram.add(mesh(new THREE.BoxGeometry(1.4, 1.4, 2.4), m.yellow, 0, 0, 0));
            ram.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 12), m.rail, 0, 2.2, 0));
            ram.position.set(x, 5, z);
            this.scene.add(ram);
            const plate = mesh(new THREE.BoxGeometry(1.1, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8, roughness: 0.35, emissive: 0xff7020, emissiveIntensity: 0 }), x, 1.27, z);
            this.scene.add(plate);
            // a stack of finished pec plates beside it
            for (let i = 0; i < 9; i++) b.add('primer', new THREE.BoxGeometry(1.0, 0.1, 1.4), xf(x - 1.6, 0.06 + i * 0.12, z + 2.8, i * 0.05));
            this.press = { ram, plate, x, z, last: -1 };
            this.block(x - 2.3, x + 1.3, z - 2.4, z + 3.6);
        }

        // a tower of meshing gears
        {
            const x = 31.2, z = -138;
            b.add('steel', new THREE.BoxGeometry(0.6, 11, 9), xf(x + 0.6, 5.5, z));
            const train = [[0, 2.2, 1.5], [-2.6, 4.4, 1.0], [2.9, 5.2, 1.4], [0.2, 7.8, 1.1], [-3.0, 8.6, 0.8]];
            let speed = 0.5, prevTeeth = 0, prev = null;
            for (const [dz, y, R] of train) {
                const teeth = Math.max(8, Math.round(R * 9));
                const g = new THREE.ExtrudeGeometry(gearShape(R, teeth, 0.18, R * 0.2), { depth: 0.3, bevelEnabled: false, curveSegments: 3 });
                g.translate(0, 0, -0.15);
                const gm = new THREE.Mesh(g, prev === null ? m.brass : m.copper);
                const holder = new THREE.Group();
                holder.position.set(x - 0.1, y, z + dz);
                holder.rotation.y = Math.PI / 2;
                holder.add(gm);
                this.scene.add(holder);
                if (prev !== null) speed = -speed * (prevTeeth / teeth);
                this.spinners.push({ obj: gm, axis: 'z', speed });
                prevTeeth = teeth;
                prev = gm;
                b.add('iron', new THREE.CylinderGeometry(R * 0.2, R * 0.2, 0.8, 10).rotateZ(Math.PI / 2), xf(x + 0.2, y, z + dz));
            }
            this.block(x - 0.6, x + 1.3, z - 4.8, z + 4.8);
        }

        // the control desk
        {
            const x = 27.5, z = -166;
            b.add('steel', new THREE.BoxGeometry(1.6, 1.0, 5), xf(x, 0.5, z));
            b.add('iron', new THREE.BoxGeometry(1.8, 0.1, 5.2), xf(x - 0.1, 1.05, z, 0, 1, 1, 1, 0, -0.2));
            for (let i = 0; i < 18; i++) b.add(i % 4 ? 'red' : 'green', new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), xf(x - 0.4 + (i % 3) * 0.15, 1.08, z - 2 + Math.floor(i / 3) * 0.7));
            for (let i = 0; i < 3; i++) {
                const scr = this._screen(512, 300);
                const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), scr.material);
                sm.position.set(x + 0.55, 1.75, z - 1.6 + i * 1.6);
                sm.rotation.y = -Math.PI / 2;
                this.scene.add(sm);
                b.add('iron', new THREE.BoxGeometry(0.1, 1.0, 1.62), xf(x + 0.62, 1.75, z - 1.6 + i * 1.6));
                scr.kind = ['units', 'schematic', 'lines'][i];
            }
            const big = this._screen(1024, 400);
            const bm = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.35), big.material);
            bm.position.set(x + 2.6, 4.6, z);
            bm.rotation.y = -Math.PI / 2;
            this.scene.add(bm);
            big.kind = 'big';
            b.add('iron', new THREE.BoxGeometry(0.2, 2.6, 6.3), xf(x + 2.75, 4.6, z));
            b.add('steel', new THREE.BoxGeometry(0.3, 3.4, 0.3), xf(x + 2.8, 1.7, z - 2.5));
            b.add('steel', new THREE.BoxGeometry(0.3, 3.4, 0.3), xf(x + 2.8, 1.7, z + 2.5));
            this.block(x - 0.9, x + 0.9, z - 2.7, z + 2.7);
            this.block(x + 2.5, x + 3.1, z - 2.8, z + 2.8);
        }

        // crates and drums along the far side of the walkway
        const r = rng('crates');
        for (const z of [8, -36, -44, -76, -112, -118, -150]) {
            const x = 30.8 + r() * 0.8;
            const n = 1 + Math.floor(r() * 3);
            for (let i = 0; i < n; i++) {
                const s = 1.1 + r() * 0.4;
                b.add(r() < 0.5 ? 'darkWood' : 'green', new THREE.BoxGeometry(s, s, s), xf(x + (r() - 0.5) * 0.4, s / 2 + (i ? 1.2 : 0), z + (i ? 0 : (r() - 0.5)), r() * 0.3));
            }
            for (let i = 0; i < 3; i++) b.add('red', new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), xf(x - 1.2, 0.55, z + 1.6 + i * 0.85));
            this.block(x - 1.7, x + 1.4, z - 1.2, z + 3.9);
        }
    }

    _screen(w, h) {
        const c = canvas(w, h);
        const tex = toTexture(c);
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        const material = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2) });
        const s = { canvas: c, ctx: c.getContext('2d'), tex, material, w, h, next: 0 };
        this.screens.push(s);
        return s;
    }

    // ------------------------------------------------------------ the walls

    _wallMachines(b) {
        const m = this.mats;
        // furnaces along the left wall, glowing
        for (const z of [-14, -64, -114, -164]) {
            const x = X0 + 6;
            b.add('brick', new THREE.BoxGeometry(10, 14, 16), xf(x, 7, z));
            b.add('iron', new THREE.BoxGeometry(10.4, 0.8, 16.4), xf(x, 14.2, z));
            const mouth = new THREE.Shape();
            mouth.moveTo(-3, 0);
            mouth.lineTo(3, 0);
            mouth.lineTo(3, 3);
            mouth.absarc(0, 3, 3, 0, Math.PI, false);
            mouth.lineTo(-3, 0);
            b.add('fire', new THREE.ShapeGeometry(mouth, 12).rotateY(Math.PI / 2), xf(x + 5.02, 1, z));
            b.add('iron', new THREE.BoxGeometry(0.5, 7.6, 7.4), xf(x + 5.1, 4, z - 0.01, 0, 1, 1, 1));
            for (const dz of [-5, 5]) b.add('iron', new THREE.CylinderGeometry(1, 1.2, CEIL - 14, 14), xf(x - 1, 14 + (CEIL - 14) / 2, z + dz));
            this.flames ??= [];
            this.flames.push({ x: x + 5.6, z });
        }
        // flywheels on the right wall
        for (const z of [-30, -90, -150]) {
            const x = X1 - 3;
            b.add('steel', new THREE.BoxGeometry(2.5, 18, 3), xf(x + 0.6, 9, z));
            b.add('iron', new THREE.CylinderGeometry(1.2, 1.2, 3, 16).rotateZ(Math.PI / 2), xf(x - 1, 11, z));
            const wheel = new THREE.Group();
            wheel.add(mesh(new THREE.TorusGeometry(7, 0.55, 10, 56), m.iron));
            for (let i = 0; i < 8; i++) wheel.add(mesh(new THREE.BoxGeometry(14, 0.5, 0.35).rotateZ((i / 8) * Math.PI), m.steel));
            wheel.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 18).rotateX(Math.PI / 2), m.brass));
            mergeChildren(wheel);
            const holder = new THREE.Group();
            holder.position.set(x - 2.6, 11, z);
            holder.rotation.y = Math.PI / 2;
            holder.add(wheel);
            this.scene.add(holder);
            this.spinners.push({ obj: wheel, axis: 'z', speed: 0.35 });
            // and its engine: a piston on the floor
            b.add('iron', new THREE.BoxGeometry(4, 3, 6), xf(x - 2.6, 1.5, z + 10));
            b.add('copper', new THREE.CylinderGeometry(1.3, 1.3, 5, 16).rotateX(Math.PI / 2), xf(x - 2.6, 4.2, z + 10));
        }
        // the control room up on the back wall, its windows lit
        b.add('steel', new THREE.BoxGeometry(40, 9, 6), xf(-20, 20, Z_BACK - 3));
        b.add('window', new THREE.PlaneGeometry(36, 3.6).rotateY(Math.PI), xf(-20, 20.5, Z_BACK - 6.02));
        for (let i = 0; i < 12; i++) b.add('steel', new THREE.BoxGeometry(0.25, 3.8, 0.3), xf(-38 + i * 3.25, 20.5, Z_BACK - 6.1));
        b.add('steel', new THREE.BoxGeometry(40, 0.3, 2), xf(-20, 15.4, Z_BACK - 7));
        for (let i = 0; i < 20; i++) b.add('yellow', new THREE.CylinderGeometry(0.04, 0.04, 1, 4), xf(-39.5 + i * 2, 16, Z_BACK - 7.9));
        b.add('yellow', new THREE.BoxGeometry(40, 0.06, 0.06), xf(-20, 16.5, Z_BACK - 7.9));
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.2), new THREE.MeshBasicMaterial({ map: signTexture('THE ROBOT FOUNDRY', 'Line 1 · Line 2 · Line 3', { fg: '#ffd98a', w: 1536, h: 224 }), color: new THREE.Color(1.15, 1.15, 1.15) }));
        sign.position.set(-20, 27.5, Z_BACK - 6.1);
        sign.rotation.y = Math.PI;
        this.scene.add(sign);
    }

    // ------------------------------------------------------------ overhead

    _cranes(b) {
        const m = this.mats;
        for (const [z0, z1, speed, phase] of [[-8, -190, 0.04, 1.6], [-30, -192, 0.03, 4.4]]) {
            const g = new THREE.Group();
            const span = X1 - X0 - 5;
            for (const dz of [-1.2, 1.2]) g.add(mesh(new THREE.BoxGeometry(span, 2.2, 0.8), m.yellow, 0, 1.6, dz));
            for (const x of [-span / 2, span / 2]) g.add(mesh(new THREE.BoxGeometry(2.2, 1.6, 5), m.yellow, x, 1.0, 0));
            g.add(mesh(new THREE.BoxGeometry(span, 0.2, 0.3), m.stripe, 0, 0.45, -1.62));
            const trolley = new THREE.Group();
            trolley.add(mesh(new THREE.BoxGeometry(4, 1.4, 3.6), m.orange, 0, 3.2, 0));
            trolley.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 16).rotateX(Math.PI / 2), m.iron, 0, 3.4, 0));
            const cables = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5).translate(0, -0.5, 0), m.iron, 0, 2.5, 0);
            trolley.add(cables);
            const block = new THREE.Group();
            block.add(mesh(new THREE.BoxGeometry(1.2, 1.2, 0.6), m.yellow, 0, 0, 0));
            block.add(mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 14, Math.PI * 1.5), m.rail, 0, -0.9, 0));
            // its load: a pallet of unpainted chests
            const load = new THREE.Group();
            const geos = robotGeometries();
            load.add(mesh(new THREE.BoxGeometry(3.6, 0.2, 2.4), m.darkWood, 0, -3.2, 0));
            for (let i = 0; i < 4; i++) {
                const c = new THREE.Mesh(geos.chest, m.primer);
                c.scale.setScalar(SCALE);
                c.position.set(-1.2 + (i % 2) * 2.4 - 0.0, -3.1, -0.6 + Math.floor(i / 2) * 1.2);
                c.rotation.y = Math.PI / 2;
                load.add(c);
            }
            for (const [dx, dz] of [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.1], [1.7, 1.1]]) {
                const sl = mesh(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(dx, dz, 2.4), 4), m.iron, dx / 2, -1.9, dz / 2);
                sl.rotation.set(-Math.atan2(dz, 2.4), 0, Math.atan2(dx, 2.4), 'XYZ');
                load.add(sl);
            }
            mergeChildren(load);
            block.add(load);
            trolley.add(block);
            mergeChildren(trolley, [cables]);
            g.add(trolley);
            mergeChildren(g);
            g.position.set((X0 + X1) / 2, 30.5, z0);
            this.scene.add(g);
            this.cranes.push({ g, trolley, block, cables, z0, z1, speed, phase, span });
        }
    }

    _conveyors(b) {
        const m = this.mats;
        // a monorail of crates over the walkway, bringing parts to the start of the line
        const path = [];
        const x = 25, y = 14;
        b.add('rail', new THREE.BoxGeometry(0.3, 0.3, Z_BACK - 8 - (LEDGE_Z + 10)), xf(x, y + 1.2, (Z_BACK - 8 + LEDGE_Z + 10) / 2));
        for (let z = Z_BACK - 10; z > LEDGE_Z + 10; z -= 12) b.add('iron', new THREE.CylinderGeometry(0.04, 0.04, CEIL - 8 - y, 4), xf(x, y + (CEIL - 8 - y) / 2 + 1.3, z));
        this.crates = { x, y, z0: LEDGE_Z + 12, z1: Z_BACK - 10, n: 34, list: [] };
        const crateGeo = new THREE.BoxGeometry(1.3, 1.1, 1.3);
        const hangGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4);
        const cm = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.8 }), this.crates.n);
        const hm = new THREE.InstancedMesh(hangGeo, m.iron, this.crates.n);
        cm.frustumCulled = hm.frustumCulled = false;
        this.scene.add(cm, hm);
        this.crates.mesh = cm;
        this.crates.hang = hm;
        // a conveyor of chests across the hall, high up
        const zc = -112, yc = 19;
        b.add('rail', new THREE.BoxGeometry(X1 - X0 - 8, 0.3, 0.3), xf((X0 + X1) / 2, yc + 1.4, zc));
        for (let xx = X0 + 8; xx < X1 - 4; xx += 14) b.add('iron', new THREE.CylinderGeometry(0.04, 0.04, CEIL - 8 - yc, 4), xf(xx, yc + 1.4 + (CEIL - 8 - yc) / 2, zc));
        const geos = robotGeometries();
        this.chests = { z: zc, y: yc, x0: X0 + 6, x1: X1 - 6, n: 30 };
        this.chests.mesh = new THREE.InstancedMesh(geos.chest, m.primer, this.chests.n);
        this.chests.hook = new THREE.InstancedMesh(hangGeo, m.iron, this.chests.n);
        this.chests.mesh.frustumCulled = this.chests.hook.frustumCulled = false;
        this.scene.add(this.chests.mesh, this.chests.hook);
    }

    _pipes(b) {
        const r = rng('pipes');
        const keys = ['copper', 'red', 'green', 'iron', 'steel'];
        // runs along both long walls at several heights
        for (const x of [X0 + 1.8, X1 - 1.8]) {
            for (const [y, rad] of [[4.5, 0.4], [6.2, 0.25], [17, 0.6], [24, 0.35], [36, 0.8]]) {
                const k = keys[Math.floor(r() * keys.length)];
                b.add(k, new THREE.CylinderGeometry(rad, rad, Z_BACK - Z_FAR - 4, 12).rotateX(Math.PI / 2), xf(x + (x < 0 ? 1 : -1) * rad, y, (Z_BACK + Z_FAR) / 2));
                for (let z = Z_BACK - 4; z > Z_FAR; z -= 6) b.add('iron', new THREE.CylinderGeometry(rad * 1.3, rad * 1.3, 0.2, 12).rotateX(Math.PI / 2), xf(x + (x < 0 ? 1 : -1) * rad, y, z));
            }
        }
        // ducts across the roof
        for (let z = 2; z > -200; z -= 36) {
            b.add('steel', new THREE.BoxGeometry(X1 - X0, 1.8, 1.8), xf((X0 + X1) / 2, CEIL - 9.5, z));
            for (let x = X0 + 10; x < X1; x += 20) b.add('iron', new THREE.BoxGeometry(2.2, 0.4, 2.2), xf(x, CEIL - 10.5, z));
        }
        // and pipes along each line, over the rail
        for (const line of LINES) {
            b.add('copper', new THREE.CylinderGeometry(0.18, 0.18, 196, 8).rotateX(Math.PI / 2), xf(line.x + 1.4, RAIL_Y + 2.6, -82));
            b.add('green', new THREE.CylinderGeometry(0.24, 0.24, 196, 8).rotateX(Math.PI / 2), xf(line.x - 1.3, RAIL_Y + 2.7, -82));
        }
    }

    /** Loudspeaker horns on the columns and over the walkway, for the public address (foundry-pa.js). */
    _speakers(b) {
        const horn = (x, y, z, yaw, tilt = 0.25) => {
            b.add('green', new THREE.ConeGeometry(0.55, 1.2, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.6), xf(x, y, z, yaw, 1, 1, 1, tilt));
            b.add('iron', new THREE.CylinderGeometry(0.22, 0.26, 0.5, 10).rotateX(Math.PI / 2).translate(0, 0, -0.1), xf(x, y, z, yaw, 1, 1, 1, tilt));
        };
        for (const x of COLS_X) for (const z of COLS_Z) {
            horn(x + 1.3, 13, z, Math.PI / 2);
            horn(x - 1.3, 13, z, -Math.PI / 2);
            b.add('iron', new THREE.BoxGeometry(2.4, 0.2, 0.2), xf(x, 13.4, z));
        }
        // a cluster on a pole by the quartermaster, and one over the apron
        for (const [x, z, h] of [[DECK.x1 - 0.6, DECK.z0 + 1.2, 7], [24, STRIP_END - 2, 9]]) {
            b.add('steel', new THREE.CylinderGeometry(0.1, 0.12, h, 8), xf(x, h / 2, z));
            this.block(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
            for (let i = 0; i < 3; i++) horn(x + Math.sin((i / 3) * Math.PI * 2) * 0.4, h - 0.2, z + Math.cos((i / 3) * Math.PI * 2) * 0.4, (i / 3) * Math.PI * 2, 0.35);
        }
    }

    _lamps(b) {
        // high-bay lamps over the lines and the walkway, each with a cone of lit haze under it
        const beam = beamMaterial(new THREE.Color(1, 0.86, 0.62), 0.05);
        const coneH = 24;
        const cone = new THREE.ConeGeometry(5.5, coneH, 20, 1, true).translate(0, -coneH / 2, 0);
        const xs = [...LINES.map((l) => l.x), 19];
        const list = [];
        for (const x of xs) for (let z = 10; z > LEDGE_Z; z -= 21) list.push([x, z]);
        for (const [x, z] of list) {
            const y = 27;
            b.add('iron', new THREE.CylinderGeometry(0.03, 0.03, CEIL - 7 - y, 4), xf(x, y + (CEIL - 7 - y) / 2, z));
            b.add('iron', new THREE.ConeGeometry(0.9, 0.7, 14, 1, true), xf(x, y, z));
            b.add('lamp', new THREE.CircleGeometry(0.75, 14).rotateX(Math.PI / 2), xf(x, y - 0.3, z));
        }
        const inst = new THREE.InstancedMesh(cone, beam, list.length);
        list.forEach(([x, z], i) => inst.setMatrixAt(i, xf(x, 26.7, z)));
        inst.frustumCulled = false;
        inst.renderOrder = 4;
        this.scene.add(inst);
    }

    // ------------------------------------------------------------ the frame

    update(dt, t) {
        for (const s of this.spinners) s.obj.rotation[s.axis] += s.speed * dt;
        // the belts off the release plates run as each unit is let go (the texture slides toward -z)
        for (const b of this.belts) b.map.offset.y = -((this.lines.lines[b.line].belt ?? 0) % 0.5) / 0.5;
        this.lava.material.uniforms.uTime.value = t;
        this.falls.uniforms.uTime.value = t;
        // the gantry cranes trundle up and down the hall, their trolleys back and forth
        for (const c of this.cranes) {
            const q = 0.5 - 0.5 * Math.cos(t * c.speed + c.phase);
            c.g.position.z = lerp(c.z0, c.z1, q);
            const tx = Math.sin(t * c.speed * 2.3 + c.phase * 2) * c.span * 0.4;
            c.trolley.position.x = tx;
            const drop = 8 + 6 * Math.sin(t * 0.11 + c.phase);
            c.block.position.y = 2.5 - drop;
            c.cables.scale.y = drop - 0.5;
            c.block.rotation.y = Math.sin(t * 0.07 + c.phase) * 0.4;
        }
        // the monorail crates
        const cr = this.crates, len = cr.z1 - cr.z0;
        const _m = this._m ??= new THREE.Matrix4(), _s = this._s ??= new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE);
        for (let i = 0; i < cr.n; i++) {
            const z = cr.z0 + ((i / cr.n) * len + t * 1.6) % len;
            _m.makeTranslation(cr.x, cr.y - 0.6, z);
            cr.mesh.setMatrixAt(i, _m);
            _m.makeTranslation(cr.x, cr.y + 0.6, z);
            cr.hang.setMatrixAt(i, _m);
        }
        cr.mesh.instanceMatrix.needsUpdate = cr.hang.instanceMatrix.needsUpdate = true;
        const ch = this.chests, w = ch.x1 - ch.x0;
        for (let i = 0; i < ch.n; i++) {
            const x = ch.x1 - ((i / ch.n) * w + t * 1.2) % w;
            _m.makeRotationY(Math.PI / 2 + Math.sin(i) * 0.1).setPosition(x, ch.y - 1.9, ch.z);
            _m.multiply(_s);
            ch.mesh.setMatrixAt(i, _m);
            _m.makeTranslation(x, ch.y + 0.9, ch.z);
            ch.hook.setMatrixAt(i, _m);
        }
        ch.mesh.instanceMatrix.needsUpdate = ch.hook.instanceMatrix.needsUpdate = true;
        // the casting: tip, pour, set back; the moulds slide on and cool
        const cs = this.casting, P = 14, q = (t % P) / P;
        const tip = smoothstep(0.1, 0.25, q) * (1 - smoothstep(0.55, 0.7, q));
        cs.cru.rotation.x = 0;
        cs.cru.rotation.z = tip * 1.05;
        const pouring = q > 0.22 && q < 0.58;
        cs.pour.visible = pouring;
        cs.pour.scale.y = 3.6;
        cs.pour.scale.x = cs.pour.scale.z = 0.7 + 0.3 * Math.sin(t * 20);
        const slide = smoothstep(0.75, 0.95, q);
        const cyc = Math.floor(t / P);
        cs.moulds.forEach((mm, i) => {
            const pos = i - slide;
            mm.position.set(cs.x, 1.0, cs.z + (pos - 1) * 1.6);
            mm.visible = pos > -0.6 && pos < 3.4;
            // the one under the spout fills and glows; the ones that have moved on cool
            mm.material.emissiveIntensity = pos >= 0.9 ? (pos <= 1.1 && q > 0.22 ? 1.8 : 0) : Math.max(0, 1.8 - (1 - pos) * 0.9);
        });
        this.castingCycle = cyc;
        // the press stamps every three seconds
        const pr = this.press, Pp = 3, pq = (t % Pp) / Pp;
        const down = pq < 0.15 ? smoothstep(0, 0.15, pq) ** 3 : pq < 0.3 ? 1 : 1 - smoothstep(0.3, 0.8, pq);
        pr.ram.position.y = lerp(5.2, 2.05, down);
        pr.plate.material.emissiveIntensity = Math.max(0, 1 - pq * 3) * 1.2;
        const stamp = Math.floor(t / Pp + 0.85);
        this.pressHit = pr.last !== stamp && pq >= 0.15;
        if (this.pressHit) pr.last = stamp;
    }

    /** Redraw the control desk's screens, a couple at a time. */
    drawScreens(t, info) {
        for (const s of this.screens) {
            if (t < s.next) continue;
            s.next = t + (s.kind === 'big' ? 0.5 : 0.25);
            const { ctx, w, h } = s;
            ctx.fillStyle = '#04100c';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#0d2a1e';
            ctx.fillRect(0, 0, w, 28);
            ctx.font = '600 18px Menlo, Consolas, monospace';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#7dff9b';
            const mono = (txt, x, y, col = '#7dff9b') => {
                ctx.fillStyle = col;
                ctx.fillText(txt, x, y);
            };
            if (s.kind === 'units') {
                mono('UNITS · LINE 1', 10, 14);
                ctx.font = '15px Menlo, Consolas, monospace';
                info.units.slice(0, 12).forEach((u, i) => mono(`RX-${u.serial}  ${u.where.padEnd(16, ' ')} ${u.state}`, 10, 46 + i * 21, u.post ? '#ffe08a' : '#7dff9b'));
            } else if (s.kind === 'schematic') {
                mono('UNIT SCHEMATIC', 10, 14);
                ctx.strokeStyle = '#7dff9b';
                ctx.lineWidth = 2;
                const cx = w / 2, sc = 62;
                const R = (x, y, ww, hh) => ctx.strokeRect(cx + (x - ww / 2) * sc, h - 20 - (y + hh / 2) * sc, ww * sc, hh * sc);
                R(0, 3.45, 0.5, 0.5);
                R(0, 2.85, 0.9, 0.75);
                R(0, 2.35, 0.6, 0.25);
                for (const sd of [-1, 1]) {
                    R(sd * 0.6, 2.7, 0.2, 0.55);
                    R(sd * 0.62, 2.15, 0.16, 0.5);
                    R(sd * 0.22, 1.65, 0.24, 0.6);
                    R(sd * 0.22, 1.0, 0.2, 0.6);
                    R(sd * 0.22, 0.6, 0.3, 0.14);
                }
                const scan = (t * 0.6) % 1;
                ctx.fillStyle = 'rgba(125,255,155,0.25)';
                ctx.fillRect(0, 30 + scan * (h - 40), w, 3);
                mono(`PARTS 41/41 · MASS 812 kg`, 10, h - 14, '#9fe8ff');
            } else if (s.kind === 'lines') {
                mono('LINE STATUS', 10, 14);
                info.lines.forEach((l, i) => {
                    const y = 56 + i * 58;
                    mono(`LINE ${i + 1}`, 10, y);
                    ctx.fillStyle = 'rgba(125,255,155,0.15)';
                    ctx.fillRect(110, y - 12, w - 130, 24);
                    ctx.fillStyle = l.moving ? '#ffe08a' : '#7dff9b';
                    ctx.fillRect(110, y - 12, (w - 130) * (l.moving ? l.s : l.u), 24);
                    mono(l.moving ? 'INDEX' : 'WORK', w - 80, y + 22, '#4a8a5a');
                });
            } else {
                ctx.font = '700 30px "Cinzel", Georgia, serif';
                mono('THE ROBOT FOUNDRY · PRODUCTION', 20, 16, '#ffd98a');
                ctx.font = '600 120px Menlo, Consolas, monospace';
                mono(info.despatched.toLocaleString('en-GB'), 30, 150, '#ff9a3a');
                ctx.font = '22px Menlo, Consolas, monospace';
                mono('units completed to date', 36, 230, '#c8a868');
                mono(`cycle ${info.cycle.toFixed(1)} s · 3 lines · 27 stations each`, 36, 270, '#7dff9b');
                mono('reached the exit: 0   walkway repair request: OPEN', 36, 310, '#ff8060');
                mono(`lava ${(1180 + Math.sin(t * 0.3) * 14).toFixed(0)} °C`, 36, 350, '#ff8060');
            }
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
            s.tex.needsUpdate = true;
        }
    }
}

/** Merge a group's plain mesh children into one mesh per material (fewer draw calls). */
function mergeChildren(group, keep = []) {
    const by = new Map();
    for (const c of [...group.children]) {
        if (!c.isMesh || keep.includes(c) || c.children.length) continue;
        c.updateMatrix();
        let g = c.geometry.clone().applyMatrix4(c.matrix);
        g = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!by.has(c.material)) by.set(c.material, []);
        by.get(c.material).push(g);
        group.remove(c);
    }
    for (const [mat, list] of by) {
        const merged = mergeGeometries(list, false);
        if (merged) group.add(new THREE.Mesh(merged, mat));
    }
    return group;
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
}

export { under };
