// The cove at the foot of Cinderpeak: the dais you arrive on and leave by, the
// mine railway's little station with its cart waiting, and the stone gatehouse
// where the line goes into the mountain. It lives in the garden's own scene and
// follows its clock: lamps and runes light at dusk, braziers burn all day.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { lathe, signMesh, signTexture } from './architecture.js';
import { granite, glowSprite, canvas } from './textures.js';
import { rockGeometry, buildTube, rockMaterial } from './minegeo.js';
import { partMaterials, buildTrack, buildCart, timberFrame, hangingLantern, trackMatrix, boxUV } from './mine-parts.js';
import { GALLERY } from './mine.js';
import { lightColumn } from './portal-fx.js';
import { DAIS, PAD_Y, STATION, volcanoHeight } from './volcano-data.js';
import { rng, TAU } from './util.js';

const Y = PAD_Y;

/** Local (x east, z toward the mountain) to world. */
const WX = (x) => DAIS.x + x;
const WZ = (z) => DAIS.z + z;

function coveMaterials(base) {
    const parts = partMaterials(base);
    const g = granite();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    parts.basalt = std({ map: g.map, normalMap: g.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.88, color: 0x4d4642 });
    parts.basaltDark = std({ map: g.map, normalMap: g.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.9, color: 0x3a3532 });
    parts.obsidian = std({ color: 0x0b0a12, roughness: 0.12, metalness: 0.4 });
    parts.ember = std({ color: 0x1c0a04, emissive: 0xff6a1a, emissiveIntensity: 1.2, roughness: 0.5 });
    parts.shingle = std({ color: 0x4f4a44, roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide });
    return parts;
}

/** The runes on the dais: a ring of angular glyphs round a sun, drawn on dark stone. */
function daisTexture() {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d');
    g.fillStyle = '#17120f';
    g.fillRect(0, 0, n, n);
    const r = rng('dais-runes');
    g.translate(n / 2, n / 2);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const ring = (rad, w, col) => { g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
    ring(246, 10, '#ff9a3a'); ring(226, 3, '#ff7a22'); ring(150, 3, '#ff7a22'); ring(132, 8, '#ffb050'); ring(74, 4, '#ff7a22');
    // twelve glyphs between the rings
    for (let i = 0; i < 12; i++) {
        g.save();
        g.rotate((i / 12) * TAU);
        g.translate(0, -188);
        g.strokeStyle = '#ffc070';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(-12, 26); g.lineTo(-12 + r.range(-6, 6), -4); g.lineTo(12, -26);
        g.moveTo(12, 26 * r()); g.lineTo(-12 + r.range(0, 10), r.range(-10, 14)); g.lineTo(14, 22);
        g.stroke();
        g.restore();
    }
    // a sun with rays at the heart
    g.fillStyle = '#ffb858';
    g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.fill();
    g.strokeStyle = '#ff8a2a';
    g.lineWidth = 7;
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.beginPath(); g.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); g.lineTo(Math.cos(a) * (i % 2 ? 80 : 100), Math.sin(a) * (i % 2 ? 80 : 100)); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function flameTexture() {
    const w = 64, h = 128;
    const c = canvas(w, h);
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.62, h * 0.5);
    grad.addColorStop(0, 'rgba(255,244,200,1)');
    grad.addColorStop(0.3, 'rgba(255,170,50,0.95)');
    grad.addColorStop(0.7, 'rgba(255,80,10,0.5)');
    grad.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w / 2, 2);
    g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.95, h * 0.95, w / 2, h - 2);
    g.bezierCurveTo(w * 0.05, h * 0.95, w * 0.05, h * 0.45, w / 2, 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Courses of dressed blocks filling a box; `skip(x, y)` leaves holes (for the arch). */
function blocks(batch, key, x0, x1, y0, y1, z0, z1, r, skip = null, course = 0.55) {
    for (let y = y0, row = 0; y < y1 - 0.01; y += course, row++) {
        const h = Math.min(course, y1 - y);
        let x = x0 + (row % 2 ? r() * 0.5 : 0);
        while (x < x1 - 0.05) {
            const w = Math.min(0.7 + r() * 0.7, x1 - x);
            if (!skip || !skip(x + w / 2, y + h / 2, w, h)) {
                batch.add(key, boxUV(w - 0.04, h - 0.04, z1 - z0, 0.9), xf(WX(x + w / 2), y + h / 2, WZ((z0 + z1) / 2), 0, 1, 1, 1, (r() - 0.5) * 0.015, (r() - 0.5) * 0.015));
            }
            x += w;
        }
    }
}

export function buildCove({ world, mats, mountain, quality }) {
    const parts = coveMaterials(mats);
    const batch = new Batch();
    const r = rng('cinderpeak-cove');
    const colliders = [], boxFloors = [], lamps = [], flames = [], steams = [];
    const out = { colliders, boxFloors };
    const addLamp = (x, y, z) => {
        lamps.push({ x, z, y, light: new THREE.Vector3(x, y, z) });
        world.lampSpots.push(lamps[lamps.length - 1]);
    };
    const ground = (x, z) => volcanoHeight(WX(x), WZ(z));
    // everything goes into the batch in WORLD coordinates through W()
    const W = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => xf(WX(x), y, WZ(z), ry, sx, sy, sz, rx, rz);

    // ------------------------------------------------------------ the dais
    batch.add('basalt', lathe([[0, 0], [4.95, 0], [4.95, 0.2], [4.45, 0.26], [4.45, 0.44], [3.95, 0.5], [3.95, 0.66], [0, 0.66]], 56), W(0, Y - 0.12, 0));
    batch.add('basaltDark', new THREE.TorusGeometry(4.45, 0.09, 6, 56).rotateX(Math.PI / 2), W(0, Y + 0.36, 0));
    const daisTop = Y - 0.12 + 0.66;
    boxFloors.push({ circle: true, x: WX(0), z: WZ(0), r: 3.95, y: daisTop });
    boxFloors.push({ circle: true, x: WX(0), z: WZ(0), r: 4.45, y: Y + 0.32 });
    const glyphMat = new THREE.MeshStandardMaterial({ map: daisTexture(), emissiveMap: null, color: 0xffffff, roughness: 0.55 });
    glyphMat.emissive = new THREE.Color(0xffffff);
    glyphMat.emissiveMap = glyphMat.map;
    glyphMat.emissiveIntensity = 0.5;
    world.glowMats.push({ mat: glyphMat, day: 0.5, night: 2.4 });
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(3.92, 64).rotateX(-Math.PI / 2), glyphMat);
    glyph.position.set(WX(0), daisTop + 0.01, WZ(0));
    glyph.receiveShadow = true;
    world.root.add(glyph);
    // six obsidian obelisks, each with a rune on its inner face
    const obelisk = new THREE.CylinderGeometry(0.17, 0.36, 3.2, 4, 1).rotateY(Math.PI / 4);
    const tip = new THREE.ConeGeometry(0.17, 0.55, 4).rotateY(Math.PI / 4);
    const strip = new THREE.BoxGeometry(0.07, 1.5, 0.02);
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        const x = Math.sin(a) * 4.2, z = Math.cos(a) * 4.2;
        batch.add('obsidian', obelisk, W(x, Y + 1.75, z, a));
        batch.add('obsidian', tip, W(x, Y + 3.62, z, a));
        batch.add('ember', strip, W(x - Math.sin(a) * 0.3, Y + 1.9, z - Math.cos(a) * 0.3, a));
        colliders.push({ x: WX(x), z: WZ(z), r: 0.45 });
    }
    world.glowMats.push({ mat: parts.ember, day: 0.8, night: 3.0 });
    // the motes, and the column of light
    world.sparkSources.push({ x: WX(0), y: daisTop + 0.1, z: WZ(0), color: '#ffb060', n: 90, r: 1.3, h: 4.8 });
    world.sparkSources.push({ x: WX(0), y: daisTop + 0.1, z: WZ(0), color: '#7fffd4', n: 36, r: 0.9, h: 4.0 });
    lightColumn(world, { x: WX(0), y: daisTop, z: WZ(0), color: 0xffa040, radius: 1.45, height: 9 });
    out.dais = { x: WX(0), z: WZ(0), y: daisTop, trigger: 1.35 };
    out.spawn = { x: WX(0), z: WZ(2.7), yaw: Math.PI };

    // ------------------------------------------------------------ the path to the station
    {
        const bez = (t) => {
            const p0 = [4.4, 5.2], p1 = [8, 12], p2 = [10.2, 24];
            return [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
        };
        for (let t = 0; t < 1; t += 0.026) {
            const [x, z] = bez(t), [x2, z2] = bez(t + 0.02);
            const yaw = Math.atan2(x2 - x, z2 - z);
            for (const off of [-0.75, 0.05, 0.85]) {
                const px = x + Math.cos(yaw) * off + (r() - 0.5) * 0.15, pz = z - Math.sin(yaw) * off + (r() - 0.5) * 0.15;
                batch.add('basaltDark', boxUV(0.62 + r() * 0.35, 0.12, 0.62 + r() * 0.4, 1.2), W(px, ground(px, pz) - 0.03, pz, yaw + (r() - 0.5) * 0.3));
            }
        }
    }
    const lampPost = (x, z) => {
        const y = ground(x, z);
        batch.add('blackIron', new THREE.CylinderGeometry(0.16, 0.22, 0.3, 8), W(x, y + 0.15, z));
        batch.add('blackIron', new THREE.CylinderGeometry(0.05, 0.07, 2.7, 8), W(x, y + 1.6, z));
        batch.add('brass', new THREE.ConeGeometry(0.26, 0.22, 4), W(x, y + 3.32, z, Math.PI / 4));
        batch.add('lanternGlass', new THREE.BoxGeometry(0.2, 0.34, 0.2), W(x, y + 3.02, z));
        batch.add('blackIron', new THREE.CylinderGeometry(0.17, 0.12, 0.06, 4), W(x, y + 2.84, z, Math.PI / 4));
        colliders.push({ x: WX(x), z: WZ(z), r: 0.28 });
        addLamp(WX(x), y + 3.05, WZ(z));
    };
    lampPost(2.6, 8.5); lampPost(9.8, 17); lampPost(6.2, 28); lampPost(-6.5, 3);
    world.glowMats.push({ mat: parts.lanternGlass, day: 0.5, night: 3.8 });

    // ------------------------------------------------------------ the station
    const trackX = STATION.cart.x - DAIS.x;       // local x of the track
    const platX0 = trackX - 5.1, platX1 = trackX - 1.6;
    const platZ0 = 27.5, platZ1 = 53;
    const platTop = Y + 0.42;
    // platform: planks over a stone footing
    batch.add('basaltDark', boxUV(platX1 - platX0, 0.5, platZ1 - platZ0, 0.8), W((platX0 + platX1) / 2, Y - 0.05, (platZ0 + platZ1) / 2));
    batch.add('oldWood', boxUV(platX1 - platX0 + 0.1, 0.1, platZ1 - platZ0 + 0.1, 1.1), W((platX0 + platX1) / 2, platTop - 0.05, (platZ0 + platZ1) / 2));
    for (let z = platZ0 + 0.6; z < platZ1; z += 1.1) batch.add('darkWood', boxUV(platX1 - platX0, 0.015, 0.05, 1), W((platX0 + platX1) / 2, platTop + 0.005, z));
    batch.add('wood', boxUV(0.2, 0.18, platZ1 - platZ0 + 0.2, 1.2), W(platX1 + 0.04, platTop - 0.12, (platZ0 + platZ1) / 2));
    boxFloors.push({ x0: WX(platX0), x1: WX(platX1), z0: WZ(platZ0), z1: WZ(platZ1), y: platTop });
    // the canopy: posts, a ridge beam and a roof of dark sheet, with lanterns under it
    const canX0 = platX0 - 0.2, canX1 = trackX + 3.0, ridgeX = (canX0 + canX1) / 2;
    const roofZ0 = 30, roofZ1 = 50;
    for (const z of [31, 36.5, 42, 47.5]) {
        for (const x of [platX0 + 0.1, canX1 - 0.2]) {
            batch.add('oldWood', boxUV(0.28, 3.6, 0.28), W(x, Y + 1.8, z));
            colliders.push({ x: WX(x), z: WZ(z), r: 0.22 });
        }
        batch.add('oldWood', boxUV(canX1 - canX0, 0.22, 0.24), W(ridgeX, Y + 3.62, z));
        batch.add('oldWood', boxUV(0.2, 1.0, 0.2), W(ridgeX, Y + 4.1, z));
    }
    batch.add('oldWood', boxUV(0.24, 0.24, roofZ1 - roofZ0 + 1.2), W(ridgeX, Y + 4.7, (roofZ0 + roofZ1) / 2));
    const half = (canX1 - canX0) / 2, rise = 1.0;
    for (const sd of [-1, 1]) {
        const len = Math.hypot(half + 0.5, rise);
        batch.add('shingle', new THREE.BoxGeometry(len, 0.06, roofZ1 - roofZ0 + 1.4), W(ridgeX + sd * (half + 0.5) / 2, Y + 4.7 - rise / 2 + 0.05, (roofZ0 + roofZ1) / 2, 0, 1, 1, 1, 0, -sd * Math.atan2(rise, half + 0.5)));
    }
    for (const [z, x] of [[34, platX0 + 1.2], [39.5, platX0 + 1.2], [45, platX0 + 1.2], [37, canX1 - 1.2], [44, canX1 - 1.2]]) {
        batch.add('blackIron', new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4), W(x, Y + 3.3, z));
        batch.add('brass', new THREE.ConeGeometry(0.13, 0.12, 8), W(x, Y + 3.0, z));
        batch.add('lanternGlass', new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8), W(x, Y + 2.84, z));
        batch.add('brass', new THREE.CylinderGeometry(0.1, 0.12, 0.04, 8), W(x, Y + 2.7, z));
        addLamp(WX(x), Y + 2.84, WZ(z));
    }
    // the track, its stop, and a siding with two parked carts
    const track = buildTrack(0, 46, parts);
    // a buffer stop behind the waiting cart
    batch.add('blackIron', new THREE.BoxGeometry(1.5, 0.5, 0.22), W(trackX, Y + 0.18, 34.1));
    batch.add('oldWood', boxUV(1.7, 0.2, 0.45), W(trackX, Y + 0.12, 33.6));
    const sideX = trackX + 4.6;
    for (let z = 28; z < 52; z += 0.85) batch.add('oldWood', boxUV(1.55, 0.1, 0.17), W(sideX, ground(sideX, z) + 0.04, z));
    for (const sd of [-1, 1]) batch.add('rust', new THREE.BoxGeometry(0.06, 0.1, 24), W(sideX + sd * 0.46, ground(sideX, 40) + 0.13, 40));
    colliders.push({ x: WX(sideX), z: WZ(30), r: 0.6 });
    // ore heaps, props, a ticket booth
    const heap = (x, z, n = 14, s = 1) => {
        for (let i = 0; i < n; i++) batch.add('coal', new THREE.DodecahedronGeometry((0.12 + r() * 0.2) * s, 0), W(x + (r() - 0.5) * 1.4 * s, ground(x, z) + 0.08 + r() * 0.14, z + (r() - 0.5) * 1.1 * s, r() * 3));
    };
    heap(sideX + 2.4, 33, 18, 1.2);
    heap(trackX - 8, 55, 10, 0.9);

    // the ticket booth: a timber hut with a lit window
    {
        const bx = 5.2, bz = 38.5, w = 3.4, d = 4.2, hgt = 2.5, y = ground(bx, bz);
        batch.add('basaltDark', boxUV(w + 0.2, 0.3, d + 0.2, 0.8), W(bx, y + 0.05, bz));
        batch.add('wood', boxUV(w, hgt, d, 1.1), W(bx, y + 0.2 + hgt / 2, bz));
        for (let i = 0; i < 6; i++) batch.add('oldWood', boxUV(0.08, hgt, 0.08), W(bx - w / 2 + (i / 5) * w, y + 0.2 + hgt / 2, bz - d / 2 - 0.04));
        for (const sd of [-1, 1]) batch.add('shingle', new THREE.BoxGeometry(w * 0.62 + 0.5, 0.07, d + 0.9), W(bx + sd * w * 0.27, y + 0.2 + hgt + 0.32, bz, 0, 1, 1, 1, 0, -sd * 0.45));
        // door and counter window on the side facing the platform
        batch.add('darkWood', boxUV(0.06, 1.8, 0.9, 1), W(bx + w / 2 + 0.03, y + 0.2 + 0.9, bz - 1.2));
        batch.add('lanternGlass', new THREE.BoxGeometry(0.05, 0.7, 1.3), W(bx + w / 2 + 0.03, y + 0.2 + 1.45, bz + 0.9));
        batch.add('oldWood', boxUV(0.4, 0.07, 1.6, 1), W(bx + w / 2 + 0.22, y + 0.2 + 1.0, bz + 0.9));
        colliders.push({ x: WX(bx - 1), z: WZ(bz - 1.6), r: 1.3 }, { x: WX(bx - 1), z: WZ(bz + 1.6), r: 1.3 }, { x: WX(bx + 1), z: WZ(bz), r: 1.4 });
        addLamp(WX(bx + w / 2 + 0.7), y + 2.2, WZ(bz + 0.9));
        const sign = signMesh(signTexture('🎫', 'Tickets', 'Rides on the hour · lava permitting', '#ffb050', 768, 200), 2.2, 0.57, 0.2);
        sign.position.set(WX(bx + w / 2 + 0.2), y + 3.55, WZ(bz - 0.4));
        sign.rotation.y = Math.PI / 2;
        world.root.add(sign);
        world.nightSigns.push(sign.userData.nightGlow);
    }
    // crates and barrels by the booth and the platform's end
    const box = (x, z, s, yaw = 0, lift = 0) => batch.add('wood', boxUV(s, s, s, 1.2), W(x, ground(x, z) + s / 2 + lift, z, yaw));
    box(0.5, 42, 0.7, 0.4); box(1.4, 42.4, 0.55, -0.2); box(0.8, 42.2, 0.5, 0.1, 0.7);
    for (const [x, z] of [[2.2, 33.2], [2.9, 33.6], [2.5, 34.3]]) {
        batch.add('oldWood', new THREE.CylinderGeometry(0.32, 0.32, 0.88, 12), W(x, ground(x, z) + 0.44, z));
        batch.add('rust', new THREE.CylinderGeometry(0.335, 0.335, 0.05, 12), W(x, ground(x, z) + 0.44, z));
        colliders.push({ x: WX(x), z: WZ(z), r: 0.4 });
    }
    colliders.push({ x: WX(0.9), z: WZ(42.2), r: 0.9 });
    // a pick-and-shovel rack
    batch.add('oldWood', boxUV(0.12, 1.5, 0.12), W(platX0 - 1.2, Y + 0.75, 49));
    batch.add('oldWood', boxUV(0.12, 1.5, 0.12), W(platX0 - 1.2, Y + 0.75, 51.4));
    batch.add('oldWood', boxUV(0.1, 0.1, 2.5), W(platX0 - 1.2, Y + 1.3, 50.2));
    for (let i = 0; i < 4; i++) {
        batch.add('oldWood', new THREE.CylinderGeometry(0.022, 0.022, 1.15, 6), W(platX0 - 1.2, Y + 0.8, 49.3 + i * 0.6, 0, 1, 1, 1, 0, 0.12));
        batch.add('blackIron', new THREE.BoxGeometry(0.5, 0.04, 0.04), W(platX0 - 1.2, Y + 1.36, 49.3 + i * 0.6, Math.PI / 2, 1, 1, 1, 0, 0));
    }
    colliders.push({ x: WX(platX0 - 1.2), z: WZ(50.2), r: 1.2 });

    // ------------------------------------------------------------ the gatehouse
    const mouthZ = STATION.mouth.z - DAIS.z;          // local z of the mouth (62)
    const gz0 = mouthZ - 4.6, gz1 = mouthZ + 4;        // front and back planes
    {
        const cx = trackX;
        const ySpring = Y + 2.15, rIn = 1.9, rOut = 2.75;
        const skip = (x, y) => Math.hypot(x - cx, y - ySpring) < rOut + 0.12 && y > ySpring - 0.1;
        // piers and the walling round the arch
        blocks(batch, 'basalt', cx - 4.6, cx - rIn, Y - 0.2, Y + 7, gz0, gz1, r, skip);
        blocks(batch, 'basalt', cx + rIn, cx + 4.6, Y - 0.2, Y + 7, gz0, gz1, r, skip);
        blocks(batch, 'basalt', cx - rIn, cx + rIn, Y + 4.95, Y + 7, gz0, gz1, r);
        // the arch itself: voussoirs round a semicircle
        const n = 13;
        for (let i = 0; i < n; i++) {
            const a = (i / (n - 1)) * Math.PI;
            const mid = (rIn + rOut) / 2;
            const x = cx + Math.cos(a) * mid, y = ySpring + Math.sin(a) * mid;
            const keystone = i === (n - 1) / 2;
            batch.add(keystone ? 'basaltDark' : 'basalt', boxUV((rOut - rIn) * (keystone ? 1.1 : 0.96), (Math.PI * mid) / n * (keystone ? 1.15 : 0.98), gz1 - gz0, 0.9), W(x, y, (gz0 + gz1) / 2, 0, 1, 1, 1, 0, a - Math.PI / 2));
        }
        // cornice and a stepped cap
        batch.add('basaltDark', boxUV(10.2, 0.4, gz1 - gz0 + 0.8, 0.8), W(cx, Y + 7.1, (gz0 + gz1) / 2));
        batch.add('basalt', boxUV(9.4, 0.5, gz1 - gz0 + 0.3, 0.8), W(cx, Y + 6.8, (gz0 + gz1) / 2));
        // timber door frame set back inside the arch
        for (const sd of [-1, 1]) batch.add('oldWood', boxUV(0.32, 2.5, 0.32), W(cx + sd * 1.7, Y + 1.25, gz0 + 1.2));
        batch.add('oldWood', boxUV(3.7, 0.3, 0.34), W(cx, Y + 2.65, gz0 + 1.2));
        for (const sd of [-1, 1]) colliders.push({ x: WX(cx + sd * 3.2), z: WZ(mouthZ), r: 1.6 }, { x: WX(cx + sd * 4.2), z: WZ(mouthZ + 1), r: 1.0 });
        // the board above the door
        const sign = signMesh(signTexture('⛏️', 'Cinderpeak Mine', 'Railway to the Heartfire · mind the heat', '#ff9a3a', 1024, 256), 4.6, 1.15, 0.28);
        sign.position.set(WX(cx), Y + 5.75, WZ(gz0 - 0.06));
        sign.rotation.y = Math.PI;
        world.root.add(sign);
        world.nightSigns.push(sign.userData.nightGlow);
        // braziers on plinths either side, burning all day and all night
        for (const sd of [-1, 1]) {
            const bx = cx + sd * 4.3, bz = gz0 - 1.4;
            const y = ground(bx, bz);
            batch.add('basalt', boxUV(0.9, 1.0, 0.9, 1), W(bx, y + 0.45, bz));
            batch.add('blackIron', new THREE.CylinderGeometry(0.5, 0.28, 0.4, 10, 1, true), W(bx, y + 1.2, bz));
            batch.add('blackIron', new THREE.CylinderGeometry(0.5, 0.5, 0.04, 10), W(bx, y + 1.38, bz));
            batch.add('ember', new THREE.CylinderGeometry(0.42, 0.3, 0.1, 10), W(bx, y + 1.34, bz));
            colliders.push({ x: WX(bx), z: WZ(bz), r: 0.6 });
            flames.push({ x: WX(bx), y: y + 1.45, z: WZ(bz) });
            addLamp(WX(bx), y + 2.0, WZ(bz));
        }
        // boulders and a spill of rubble at the foot
        for (let i = 0; i < 9; i++) {
            const sd = r() < 0.5 ? -1 : 1;
            const x = cx + sd * (4.8 + r() * 3.2), z = gz0 - 0.5 + r() * 1.6, s = 0.5 + r() * 1.1;
            batch.add('basaltDark', rockGeometry(40 + i, { detail: 1, rough: 0.4 }), W(x, ground(x, z) + s * 0.35, z, r() * 3, s, s * 0.7, s));
        }
    }
    // the stub: the same cross-section as the gallery, dimmed with depth into the mountain
    const stubMat = rockMaterial({ outside: true });
    stubMat.userData.uniforms.uMouth.value.set(0, 0, WZ(gz0 + 0.5), 0.2);
    const stub = buildTube({ s0: 21, s1: 50, ds: 1.2, segs: 40, section: GALLERY });
    stub.paint((v) => { v.r = 0.34 * (0.8 + 0.4 * Math.sin(v.x * 0.7 + v.y)); v.g = 0.28; v.b = 0.23; });
    const stubMesh = new THREE.Mesh(stub.geo, stubMat);
    stubMesh.castShadow = false;
    world.root.add(stubMesh);
    // the far end of the stub is solid dark, so no sky shows through the open tube
    const cap = new THREE.Mesh(new THREE.CircleGeometry(7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    cap.position.set(STATION.cart.x, Y + 1.8, STATION.cart.z + 50.2);
    world.root.add(cap);
    for (const s of [24, 29, 34, 39, 44]) timberFrame(batch, s, 1.72, 2.55);
    {
        const p = hangingLantern(batch, 27, 1.2, 2.7);
        addLamp(p.x, p.y, p.z);
    }
    mountain.setCut(new THREE.Vector3(WX(trackX) - 2.3, Y - 0.7, WZ(gz0 - 0.2)), new THREE.Vector3(WX(trackX) + 2.3, Y + 4.8, WZ(gz0 + 40)));

    // ------------------------------------------------------------ the cart, waiting
    const cart = buildCart(parts);
    cart.group.matrixAutoUpdate = true;
    {
        const m = trackMatrix(0);
        m.decompose(cart.group.position, cart.group.quaternion, cart.group.scale);
    }
    world.root.add(cart.group);
    colliders.push({ x: STATION.cart.x, z: STATION.cart.z, r: 0.95 });
    out.cart = cart;
    out.cartPos = new THREE.Vector3(STATION.cart.x, Y + 0.12, STATION.cart.z);
    // where you stand to climb in, and where you step out
    out.platformStand = { x: WX(trackX - 2.6), z: WZ(35.2), yaw: -Math.PI / 2 };

    // a parked cart or two on the siding, one tipped over and spilling ore
    {
        const sp = buildCart(parts);
        sp.group.position.set(WX(sideX), ground(sideX, 40) + 0.12, WZ(40.5));
        sp.group.rotation.set(0, 0.04, 0);
        world.root.add(sp.group);
        const sp2 = buildCart(parts);
        sp2.group.position.set(WX(sideX + 0.3), ground(sideX, 46) + 0.5, WZ(46.2));
        sp2.group.rotation.set(0.1, 0.35, 1.2);
        world.root.add(sp2.group);
        colliders.push({ x: WX(sideX), z: WZ(40.5), r: 0.9 }, { x: WX(sideX + 0.4), z: WZ(46.2), r: 0.9 });
        // gems spilled from the tipped one
        const gem = new THREE.OctahedronGeometry(0.1, 0);
        const gemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, emissive: 0x442266, emissiveIntensity: 1 });
        const inst = new THREE.InstancedMesh(gem, gemMat, 22);
        const m = new THREE.Matrix4(), c = new THREE.Color();
        const pal = ['#ff2a52', '#2f86ff', '#19e07a', '#b055ff', '#ffb62a', '#28f0ff'];
        for (let i = 0; i < 22; i++) {
            const x = sideX + 0.4 + (r() - 0.2) * 2.4, z = 46.5 + (r() - 0.5) * 1.6;
            m.compose(new THREE.Vector3(WX(x), ground(x, z) + 0.06, WZ(z)), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(1 + r() * 1.2, 1 + r() * 1.5, 1 + r() * 1.2));
            inst.setMatrixAt(i, m);
            inst.setColorAt(i, c.set(pal[i % pal.length]));
        }
        world.root.add(inst);
        world.glowMats.push({ mat: gemMat, day: 0.3, night: 1.3 });
    }

    // ------------------------------------------------------------ the shore, the boulders, the scrub, the steam
    {
        // boulders on the shelf's edges and along the cliffs
        const geo = rockGeometry(5, { detail: 1, rough: 0.35 });
        const N = 90;
        const rocks = new THREE.InstancedMesh(geo, parts.basalt, N);
        const m = new THREE.Matrix4();
        let k = 0;
        for (let tries = 0; tries < N * 20 && k < N; tries++) {
            const x = (r() - 0.5) * 120, z = -18 + r() * 84;
            const gx = ground(x, z);
            if (gx < 0.4) continue;
            if (Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) > 1.0) continue;
            // keep the middle of the shelf clear
            const clearX = x > -4 && x < 29;
            if (z > 4 && z < 58 && clearX && Math.abs(x - trackX) < 26 && x > -8 && x < 30) continue;
            if (Math.hypot(x, z) < 7.5) continue;
            const s = 0.4 + Math.pow(r(), 2.2) * 2.6;
            m.compose(new THREE.Vector3(WX(x), gx + s * 0.25, WZ(z)), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.5, r() * 6, r() * 0.5)), new THREE.Vector3(s, s * (0.55 + r() * 0.35), s));
            rocks.setMatrixAt(k++, m);
            if (s > 1.0) colliders.push({ x: WX(x), z: WZ(z), r: s * 0.8 });
        }
        rocks.count = k;
        rocks.castShadow = true;
        rocks.receiveShadow = true;
        world.root.add(rocks);
        // driftwood on the black sand
        for (let i = 0; i < 6; i++) {
            const x = -20 + r() * 40, z = -15 + r() * 6;
            if (ground(x, z) < 0.5) continue;
            batch.add('oldWood', new THREE.CylinderGeometry(0.08 + r() * 0.07, 0.1 + r() * 0.07, 1.4 + r() * 1.6, 6), W(x, ground(x, z) + 0.1, z, r() * 3, 1, 1, 1, 0, Math.PI / 2));
        }
    }
    {
        // scrub: dark clumps of leaves on the gentler ground beyond the shelf
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const N = quality.tier === 'low' ? 40 : 110;
        const shrubs = new THREE.InstancedMesh(geo, mats.hedge, N);
        const m = new THREE.Matrix4(), c = new THREE.Color();
        let k = 0;
        for (let tries = 0; tries < N * 40 && k < N; tries++) {
            const x = (r() - 0.5) * 130, z = -22 + r() * 100;
            const gx = ground(x, z);
            if (gx < 1.2 || gx > 55) continue;
            const gy = (ground(x + 1, z) - ground(x - 1, z)) / 2, gz2 = (ground(x, z + 1) - ground(x, z - 1)) / 2;
            if (Math.hypot(gy, gz2) > 0.55) continue;
            if (x > -8 && x < 30 && z > 4 && z < 58) continue;
            if (Math.hypot(x, z) < 8) continue;
            const s = 0.45 + r() * 0.9;
            m.compose(new THREE.Vector3(WX(x), gx + s * 0.35, WZ(z)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s * 1.3, s * 0.8, s * 1.3));
            shrubs.setMatrixAt(k, m);
            shrubs.setColorAt(k, c.setHSL(0.3 + r() * 0.06, 0.35, 0.1 + r() * 0.08));
            k++;
        }
        shrubs.count = k;
        shrubs.castShadow = true;
        world.root.add(shrubs);
    }
    {
        // crags: big blocks stuck into the cliff faces, so the walls read as broken rock and not a smooth slope
        const geo = rockGeometry(9, { detail: 1, rough: 0.45 });
        const N = quality.tier === 'low' ? 90 : 170;
        const crags = new THREE.InstancedMesh(geo, parts.basalt, N);
        const m = new THREE.Matrix4();
        let k = 0;
        for (let tries = 0; tries < N * 60 && k < N; tries++) {
            const x = (r() - 0.5) * 140, z = -14 + r() * 96;
            const gx = ground(x, z);
            if (gx < 1.5) continue;
            const gdx = (ground(x + 1, z) - ground(x - 1, z)) / 2, gdz = (ground(x, z + 1) - ground(x, z - 1)) / 2;
            if (Math.hypot(gdx, gdz) < 0.8) continue;
            // not in front of the gatehouse
            if (Math.abs(x - trackX) < 8 && z > 50 && z < 72) continue;
            const s = 1.0 + Math.pow(r(), 1.7) * 3.4;
            // sunk into the face along its normal, so only the outer part shows
            const nx = -gdx, nz = -gdz, nl = Math.hypot(nx, 1, nz);
            const sink = s * 0.45;
            m.compose(new THREE.Vector3(WX(x) - (nx / nl) * sink, gx - (1 / nl) * sink * 0.6, WZ(z) - (nz / nl) * sink), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(s * (0.8 + r() * 0.9), s * (0.6 + r() * 0.7), s * (0.8 + r() * 0.9)));
            crags.setMatrixAt(k++, m);
        }
        crags.count = k;
        crags.castShadow = true;
        crags.receiveShadow = true;
        world.root.add(crags);
    }
    // steam from the rock: a few vents at the foot of the cliffs
    {
        const map = glowSprite();
        for (const [x, z] of [[-17, 47], [24, 21], [-6, 58]]) {
            const gx = ground(x, z);
            batch.add('basaltDark', rockGeometry(61 + x, { detail: 1, rough: 0.3 }), W(x, gx + 0.1, z, 0, 0.6, 0.3, 0.6));
            const sprites = [];
            for (let i = 0; i < 7; i++) {
                const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xdfe6ea, transparent: true, depthWrite: false, opacity: 0 }));
                sp.userData = { x: WX(x), y: gx + 0.2, z: WZ(z), phase: i / 7 };
                world.root.add(sp);
                sprites.push(sp);
            }
            steams.push(sprites);
        }
    }
    // lava and gems glittering in a pile by the siding, and a few tufts of grass would go here, but the ash will not have it

    // ------------------------------------------------------------ the flames
    {
        const tex = flameTexture();
        const sprites = [];
        for (const f of flames) {
            for (let i = 0; i < 3; i++) {
                const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa050 }));
                sp.userData = { f, phase: i * 2.1, size: 0.55 - i * 0.1 };
                world.root.add(sp);
                sprites.push(sp);
            }
        }
        world.updaters.push((t) => {
            for (const sp of sprites) {
                const { f, phase, size } = sp.userData;
                const fl = 0.8 + 0.3 * Math.sin(t * 9 + phase) * Math.sin(t * 5.3 + phase * 2);
                sp.position.set(f.x + Math.sin(t * 3 + phase) * 0.05, f.y + 0.3 * fl, f.z + Math.cos(t * 2.6 + phase) * 0.05);
                sp.scale.set(size * 0.85 * fl, size * 1.5 * fl, 1);
                sp.material.opacity = 0.75 + 0.2 * fl;
            }
        });
    }
    world.updaters.push((t, sky) => {
        for (const sprites of steams) {
            for (const sp of sprites) {
                const u = (t * 0.22 + sp.userData.phase) % 1;
                sp.position.set(sp.userData.x + Math.sin(t + sp.userData.phase * 9) * 0.3 * u + u * 0.8, sp.userData.y + u * 4.2, sp.userData.z + Math.cos(t * 0.8 + sp.userData.phase * 7) * 0.3 * u);
                sp.scale.setScalar(0.7 + u * 3.2);
                sp.material.opacity = Math.sin(Math.PI * u) * 0.3 * (0.35 + 0.65 * sky.state.day + 0.15);
            }
        }
    });

    // ------------------------------------------------------------ done: add the batch and track
    const built = batch.build(parts);
    world.root.add(built, track);
    return out;
}

