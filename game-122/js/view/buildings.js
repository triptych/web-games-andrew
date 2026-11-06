// Things people made: Elowen's hut and her instruments, the stilled castle, the standing stones,
// the wreck, the camps. Each returns the handles the view animates.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITES, HILLTOP, FEN_FLOOR } from '../sim/world.js';
import { ventPos, circleObjects } from '../sim/magic.js';
import { planks, stone, thatch, bark, paper, glyphTex, glow } from './tex.js';
import { colored, jitterGeo, tr } from './nature.js';

const M = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...opts });
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function repeatUV(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

// ------------------------------------------------------------------ the hut
export function buildHut(W, L) {
    const H = SITES.hut, f = W.hutFloor;
    const g = new THREE.Group();
    g.position.set(H.x, f, H.z);
    const wood = M({ map: planks('#6f4e30') }), dark = M({ map: planks('#4e3520') }), floorM = M({ map: planks('#8a6440') });
    const stoneM = M({ map: stone('#8a8478', '#4f4b44', 'h') });
    const hw = H.w / 2, hd = H.d / 2, wh = 2.7;
    // floor and stone footing
    g.add(mesh(repeatUV(box(H.w, 0.12, H.d), 3, 2), floorM, 0, -0.04, 0, false));
    g.add(mesh(repeatUV(box(H.w + 0.5, 0.5, H.d + 0.5), 4, 1), stoneM, 0, -0.32, 0));
    // walls (the north wall has the door)
    const wall = (w, x, z, ry) => { const m = mesh(repeatUV(box(w, wh, 0.22), w / 2, 1.3), wood, x, wh / 2, z); m.rotation.y = ry; g.add(m); };
    wall(hw - 1.1, -(hw + 1.1) / 2, -hd, 0); wall(hw - 1.1, (hw + 1.1) / 2, -hd, 0);
    g.add(mesh(box(2.2, wh - 2.2, 0.22), wood, 0, 2.2 + (wh - 2.2) / 2, -hd));
    wall(H.w, 0, hd, 0);
    wall(H.d, -hw, 0, Math.PI / 2); wall(H.d, hw, 0, Math.PI / 2);
    // corner posts and beams
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) g.add(mesh(box(0.32, wh + 0.2, 0.32), dark, x, wh / 2, z));
    g.add(mesh(box(H.w + 0.3, 0.26, 0.3), dark, 0, wh, -hd)); g.add(mesh(box(H.w + 0.3, 0.26, 0.3), dark, 0, wh, hd));
    // the door, open, swung against the wall
    const door = mesh(box(1.0, 2.1, 0.08), dark, -1.05, 1.05, -hd - 0.45); door.rotation.y = -1.2; g.add(door);
    // windows that glow at night
    const winMat = M({ color: 0x302418, emissive: 0xffb15a, emissiveIntensity: 0 });
    for (const [x, z, ry] of [[-hw - 0.12, -1.2, Math.PI / 2], [hw + 0.12, 0.8, Math.PI / 2], [2.4, hd + 0.12, 0]]) {
        const w = mesh(box(1.0, 0.8, 0.05), winMat, x, 1.6, z, false); w.rotation.y = ry; g.add(w);
        const fr = mesh(box(1.15, 0.95, 0.04), dark, x - (ry ? Math.sign(x) * 0.01 : 0), 1.6, z + (ry ? 0 : 0.01), false); fr.rotation.y = ry; fr.scale.set(1, 1, 0.5);
    }
    // thatched roof: two slopes and gables
    const roofM = M({ map: thatch(), roughness: 1 });
    const rl = H.w + 1.2, rw = hd + 0.8, rise = 2.0;
    const slope = Math.hypot(rw, rise), ang = Math.atan2(rise, rw);
    for (const sgn of [-1, 1]) {
        const r = mesh(repeatUV(box(rl, 0.35, slope), 3, 2), roofM, 0, wh + rise / 2 + 0.1, sgn * rw / 2);
        r.rotation.x = sgn * ang; g.add(r);
    }
    const gable = new THREE.Shape(); gable.moveTo(-hd, 0); gable.lineTo(hd, 0); gable.lineTo(0, rise); gable.lineTo(-hd, 0);
    for (const x of [-hw, hw]) { const gm = mesh(new THREE.ShapeGeometry(gable), M({ map: planks('#5e4128'), side: THREE.DoubleSide }), x, wh, 0); gm.rotation.y = Math.PI / 2; g.add(gm); }
    // chimney over the hearth
    g.add(mesh(box(0.9, 4.2, 0.9), stoneM, -hw + 0.2, 2.9, 0.2));
    const chimneyTop = new THREE.Vector3(H.x - hw + 0.2, f + 5.1, H.z + 0.2);

    // --- inside
    const loc = (k) => W.HUT_LOCAL[k];
    // hearth
    const [hx, hz] = loc('hearth');
    g.add(mesh(box(0.9, 0.5, 1.6), stoneM, hx - 0.15, 0.25, hz));
    g.add(mesh(box(0.5, 1.8, 1.8), stoneM, hx - 0.45, 1.2, hz));
    g.add(mesh(box(0.9, 0.12, 1.9), dark, hx - 0.15, 1.5, hz));            // mantel
    const logs = new THREE.Group();
    for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), M({ map: bark() }), hx + 0.05, 0.6 + (i === 2 ? 0.1 : 0), hz - 0.18 + i * 0.18); l.rotation.z = Math.PI / 2; l.rotation.y = i * 0.5; logs.add(l); }
    g.add(logs);
    const fireLight = new THREE.PointLight(0xff9a4a, 0, 9, 1.6);
    fireLight.position.set(hx + 0.4, 1.0, hz);
    g.add(fireLight);
    // bed
    const [bx, bz] = loc('bed');
    g.add(mesh(box(2.0, 0.4, 1.1), dark, bx, 0.25, bz));
    g.add(mesh(box(1.9, 0.18, 1.0), M({ color: 0xd9cdb4 }), bx, 0.52, bz));
    g.add(mesh(box(1.2, 0.14, 1.04), M({ color: 0x7a3b4a }), bx + 0.35, 0.62, bz));
    g.add(mesh(box(0.42, 0.14, 0.7), M({ color: 0xf0e8d8 }), bx - 0.7, 0.66, bz));
    // desk, chair, book and candle
    const [dx, dz] = loc('desk');
    g.add(mesh(box(0.8, 0.08, 1.5), wood, dx, 0.82, dz));
    for (const [ox, oz] of [[-0.32, -0.65], [0.32, -0.65], [-0.32, 0.65], [0.32, 0.65]]) g.add(mesh(box(0.07, 0.8, 0.07), dark, dx + ox, 0.4, dz + oz));
    const book = mesh(box(0.42, 0.06, 0.56), M({ color: 0x6b2a2a }), dx - 0.05, 0.89, dz + 0.1); g.add(book);
    const pages = mesh(box(0.4, 0.02, 0.54), M({ map: paper() }), dx - 0.05, 0.93, dz + 0.1); g.add(pages);
    const focus = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 6), M({ map: bark('#7a5a3a') }), dx - 0.1, 0.9, dz - 0.45); focus.rotation.z = Math.PI / 2; focus.rotation.y = 0.4; g.add(focus);
    const candle = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.2, 8), M({ color: 0xf2ead8 }), dx + 0.2, 0.96, dz - 0.5); g.add(candle);
    // shelves of jars along the north wall
    const shelfX = loc('shelf')[0];
    const jarMats = [];
    for (let row = 0; row < 3; row++) {
        g.add(mesh(box(2.0, 0.06, 0.32), wood, shelfX, 1.0 + row * 0.55, -hd + 0.3));
        for (let j = 0; j < 5; j++) {
            const jm = M({ color: 0x7aa49a, transparent: true, opacity: 0.6, roughness: 0.2, emissive: 0x000000 });
            jarMats.push(jm);
            g.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.22 + (j % 2) * 0.08, 8), jm, shelfX - 0.8 + j * 0.4, 1.15 + row * 0.55 + (j % 2) * 0.04, -hd + 0.3, false));
        }
    }

    // the alembic: a burner, a round flask, a long neck and a receiver
    const [ax, az] = loc('alembic');
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfeee8, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
    const brass = M({ color: 0xb08a3a, metalness: 0.75, roughness: 0.35 });
    const copper = M({ color: 0xb06a3c, metalness: 0.7, roughness: 0.4 });
    const alembic = new THREE.Group(); alembic.position.set(ax, 0, az);
    alembic.add(mesh(box(0.8, 0.75, 0.6), wood, 0, 0.375, 0));
    alembic.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10), copper, 0, 0.84, 0));
    const flask = mesh(new THREE.SphereGeometry(0.2, 16, 12), glass, 0, 1.12, 0, false); alembic.add(flask);
    const vapor = mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), 0, 1.12, 0, false); alembic.add(vapor);
    const neck = mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.7, 8), glass, 0.22, 1.42, 0, false); neck.rotation.z = -1.0; alembic.add(neck);
    alembic.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), glass, 0.5, 1.12, 0, false));
    g.add(alembic);
    // the bells: a frame with two bronze bells and two pans
    const [blx, blz] = loc('bells');
    const bells = new THREE.Group(); bells.position.set(blx, 0, blz);
    bells.add(mesh(box(0.08, 1.8, 0.08), dark, -0.55, 0.9, 0)); bells.add(mesh(box(0.08, 1.8, 0.08), dark, 0.55, 0.9, 0));
    bells.add(mesh(box(1.25, 0.1, 0.12), dark, 0, 1.8, 0));
    const bellGeo = new THREE.LatheGeometry([[0, 0.3], [0.09, 0.29], [0.13, 0.2], [0.16, 0.05], [0.2, 0], [0.19, -0.01]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const bronze = M({ color: 0x9a7a3a, metalness: 0.8, roughness: 0.3 });
    const bellL = mesh(bellGeo, bronze, -0.28, 1.4, 0), bellR = mesh(bellGeo, bronze, 0.28, 1.4, 0);
    bells.add(bellL, bellR);
    for (const x of [-0.28, 0.28]) bells.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.04, 12), brass, x, 0.95, 0));
    g.add(bells);
    // the orrery: a brass sun arm and rings on a stand
    const [ox, oz] = loc('orrery');
    const orrery = new THREE.Group(); orrery.position.set(ox, 0, oz);
    orrery.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.85, 12), wood, 0, 0.42, 0));
    const rings = new THREE.Group(); rings.position.y = 1.35;
    const r1 = mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 40), brass, 0, 0, 0); r1.rotation.x = Math.PI / 2;
    const r2 = mesh(new THREE.TorusGeometry(0.34, 0.012, 6, 40), brass, 0, 0, 0); r2.rotation.x = 1.2;
    const r3 = mesh(new THREE.TorusGeometry(0.26, 0.012, 6, 40), brass, 0, 0, 0); r3.rotation.y = 1.1;
    rings.add(r1, r2, r3);
    const sunBall = mesh(new THREE.SphereGeometry(0.07, 12, 8), M({ color: 0xffc94a, emissive: 0xffa020, emissiveIntensity: 0.6 }), 0.42, 0, 0);
    const arm = new THREE.Group(); arm.add(sunBall); arm.add(mesh(box(0.42, 0.012, 0.012), brass, 0.21, 0, 0));
    rings.add(arm);
    rings.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M({ color: 0x8aa6c8 }), 0, 0, 0));
    orrery.add(rings);
    orrery.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), brass, 0, 1.1, 0));
    g.add(orrery);

    // the circle: chalked on the floor, the lintel above it on the south wall
    const [cx, cz] = loc('circle');
    const circTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
        x.strokeStyle = 'rgba(240,235,220,0.85)'; x.lineWidth = 4; x.translate(128, 128);
        x.beginPath(); x.arc(0, 0, 118, 0, 6.3); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 100, 0, 6.3); x.stroke();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(Math.cos(a) * 100, Math.sin(a) * 100); x.lineTo(Math.cos(a + 2.09) * 100, Math.sin(a + 2.09) * 100); x.stroke(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const circle = mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ map: circTex, transparent: true, depthWrite: false, emissive: 0xffffff, emissiveMap: circTex, emissiveIntensity: 0.05 }), cx, 0.025, cz, false);
    circle.rotation.x = -Math.PI / 2; circle.receiveShadow = true;
    g.add(circle);
    const lintel = mesh(box(4.4, 0.55, 0.12), dark, 0, 2.2, hd - 0.18, false); g.add(lintel);
    L.lintel.forEach((gid, i) => {
        const gl = L.glyphs.find((x) => x.id === gid);
        const t = glyphTex(gl, { color: '#e8d6b0', size: 128 });
        const p = mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: 0xffe0a0, emissiveMap: t, emissiveIntensity: 0.15 }), -1.75 + i * 0.7, 2.2, hd - 0.25, false);
        p.rotation.y = Math.PI;
        g.add(p);
    });
    // test objects on little stands around the circle
    const objs = {};
    for (const o of circleObjects(W)) {
        const lx = o.x - H.x, lz = o.z - H.z;
        const stand = mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), dark, lx, 0.3, lz); g.add(stand);
        const grp = new THREE.Group(); grp.position.set(lx, 0.6, lz); g.add(grp);
        if (o.id === 'candle') { grp.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), M({ color: 0xf2ead8 }), 0, 0.11, 0)); }
        if (o.id === 'bowl') { grp.add(mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, 6.3, Math.PI / 2, Math.PI / 2), M({ color: 0x9a6a44, side: THREE.DoubleSide }), 0, 0.12, 0)); const wtr = mesh(new THREE.CircleGeometry(0.105, 16), M({ color: 0x3a6a8a, roughness: 0.1 }), 0, 0.1, 0, false); wtr.rotation.x = -Math.PI / 2; grp.add(wtr); grp.userData.water = wtr; }
        if (o.id === 'lantern') { grp.add(mesh(box(0.14, 0.2, 0.14), glass, 0, 0.12, 0, false)); grp.add(mesh(box(0.16, 0.03, 0.16), brass, 0, 0.23, 0)); }
        if (o.id === 'pot') { grp.add(mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.15, 10), M({ color: 0xa0522d }), 0, 0.075, 0)); const sprout = mesh(new THREE.ConeGeometry(0.06, 0.3, 6), M({ color: 0x5aa04a }), 0, 0.25, 0); sprout.scale.setScalar(0.01); grp.add(sprout); grp.userData.sprout = sprout; }
        if (o.id === 'pinwheel') { grp.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 5), dark, 0, 0.2, 0)); const w = new THREE.Group(); w.position.y = 0.4; for (let i = 0; i < 4; i++) { const b = mesh(new THREE.PlaneGeometry(0.12, 0.06), M({ color: [0xd94a4a, 0xf0c040, 0x4a8ad9, 0x5ab45a][i], side: THREE.DoubleSide }), 0.06, 0, 0, false); const h = new THREE.Group(); h.rotation.z = i * Math.PI / 2; h.add(b); w.add(h); } grp.add(w); grp.userData.wheel = w; }
        if (o.id === 'pendulum') { grp.add(mesh(box(0.16, 0.36, 0.08), wood, 0, 0.18, 0)); const pv = new THREE.Group(); pv.position.set(0, 0.3, 0.05); pv.add(mesh(box(0.01, 0.18, 0.01), brass, 0, -0.09, 0)); pv.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), brass, 0, -0.18, 0)); grp.add(pv); grp.userData.pend = pv; }
        objs[o.id] = grp;
    }
    // a rug, a stool, a basket of driftwood
    const rug = mesh(new THREE.CircleGeometry(1.0, 24), M({ color: 0x6a3b4a, roughness: 1 }), 2.0, 0.02, -1.6, false); rug.rotation.x = -Math.PI / 2; g.add(rug);
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.45, 8), wood, 2.9, 0.22, -0.4));
    return { group: g, fireLight, logs, winMat, alembic: { vapor, flask }, bells: { L: bellL, R: bellR }, orrery: { arm, rings }, objs, circle, jarMats, chimneyTop, candleTop: new THREE.Vector3(H.x + dx + 0.2, f + 1.08, H.z + dz - 0.5) };
}

// ------------------------------------------------------------------ the castle
export function buildCastle(W) {
    const g = new THREE.Group();
    const S = SITES;
    const wallM = M({ map: stone('#6e6872', '#36323a', 'c'), roughness: 0.92 });
    const darkM = M({ map: stone('#4e4a56', '#26232a', 'k'), roughness: 0.95 });
    const roofM = M({ color: 0x2c2638, roughness: 0.7 });
    const glowM = M({ color: 0x1a0a22, emissive: 0x9a3cff, emissiveIntensity: 1.6 });
    const y0 = HILLTOP;
    const R = S.walls.r, wallH = 9;
    // curtain wall in segments, with the gate gap to the south (+z)
    const N = 28;
    for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        let d = am - Math.PI / 2; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) < 0.16) continue;
        const len = 2 * R * Math.sin(Math.PI / N) + 0.15;
        const seg = mesh(repeatUV(box(len, wallH, S.walls.w), len / 3, 3), wallM, Math.cos(am) * R, y0 + wallH / 2 - 0.5, Math.sin(am) * R);
        seg.rotation.y = -am + Math.PI / 2;
        g.add(seg);
        for (let k = 0; k < 2; k++) {
            const m = mesh(box(0.7, 0.8, S.walls.w + 0.1), wallM, Math.cos(am + (k - 0.5) * 0.05) * R, y0 + wallH, Math.sin(am + (k - 0.5) * 0.05) * R);
            m.rotation.y = -am + Math.PI / 2; g.add(m);
        }
    }
    // towers
    const towers = [];
    for (const a of [Math.PI / 2 - 0.3, Math.PI / 2 + 0.3, Math.PI / 2 + 1.5, Math.PI / 2 - 1.5, -Math.PI / 2 + 0.7, -Math.PI / 2 - 0.7]) {
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        const h = Math.abs(a - Math.PI / 2) < 0.4 ? 12 : 13 + (a % 1) * 2;
        g.add(mesh(repeatUV(new THREE.CylinderGeometry(2.4, 2.7, h, 14), 4, 3), wallM, x, y0 + h / 2 - 0.5, z));
        g.add(mesh(new THREE.ConeGeometry(2.9, 4.2, 14), roofM, x, y0 + h + 1.6, z));
        const slit = mesh(box(0.25, 1.1, 0.2), glowM, x * 1.14, y0 + h * 0.7, z * 1.14, false); slit.lookAt(0, slit.position.y, 0); g.add(slit);
        towers.push({ x, z, h });
    }
    // the gate: an arch over the gap and two doors
    g.add(mesh(box(5.6, 2.4, 1.8), wallM, 0, y0 + 7.8, R));
    const doorM = M({ map: planks('#3a2a20') });
    const doorL = new THREE.Group(), doorR = new THREE.Group();
    doorL.position.set(-2.1, y0, R); doorR.position.set(2.1, y0, R);
    doorL.add(mesh(box(2.1, 6.4, 0.25), doorM, 1.05, 3.2, 0)); doorR.add(mesh(box(2.1, 6.4, 0.25), doorM, -1.05, 3.2, 0));
    for (const d of [doorL, doorR]) for (let k = 0; k < 3; k++) d.add(mesh(box(2.0, 0.12, 0.3), M({ color: 0x222226, metalness: 0.6 }), d === doorL ? 1.05 : -1.05, 1 + k * 2, 0.02));
    g.add(doorL, doorR);
    // three locks on the gate, one per stone
    const locks = [-1, 0, 1].map((k) => { const m = mesh(new THREE.SphereGeometry(0.28, 12, 8), M({ color: 0x222, emissive: 0x000000 }), k * 0.9, y0 + 4.2, R + 0.25, false); g.add(m); return m; });

    // the keep, hollow, with its door in the south wall
    const K = S.keep, kh = 15;
    const kw = K.x1 - K.x0, kd = K.z1 - K.z0, kcx = (K.x0 + K.x1) / 2, kcz = (K.z0 + K.z1) / 2;
    const kwall = (w, x, z, ry, h = kh) => { const m = mesh(repeatUV(box(w, h, 1.0), w / 3, h / 3), darkM, x, y0 + h / 2, z); m.rotation.y = ry; g.add(m); return m; };
    kwall(kw + 1, kcx, K.z0, 0); kwall(kd, K.x0, kcz, Math.PI / 2); kwall(kd, K.x1, kcz, Math.PI / 2);
    kwall((kw - 4) / 2 + 0.5, K.x0 + ((kw - 4) / 2) / 2 - 0.25, K.z1, 0); kwall((kw - 4) / 2 + 0.5, K.x1 - ((kw - 4) / 2) / 2 + 0.25, K.z1, 0);
    g.add(mesh(box(4.2, kh - 4.5, 1.0), darkM, 0, y0 + 4.5 + (kh - 4.5) / 2, K.z1));
    const hiddenDoor = mesh(box(4.0, 4.5, 0.9), M({ map: stone('#4e4a56', '#26232a', 'k'), transparent: true }), 0, y0 + 2.25, K.z1);
    g.add(hiddenDoor);
    g.add(mesh(box(kw + 1.2, 0.6, kd + 1.2), roofM, kcx, y0 + kh, kcz));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.add(mesh(box(0.8, 1, 0.8), darkM, kcx + Math.cos(a) * (kw / 2 + 0.2), y0 + kh + 0.8, kcz + Math.sin(a) * (kd / 2 + 0.2))); }
    // a tall tower on the keep
    g.add(mesh(repeatUV(new THREE.CylinderGeometry(2.2, 2.5, 12, 14), 4, 4), darkM, kcx + 3.5, y0 + kh + 6, kcz - 2.5));
    g.add(mesh(new THREE.ConeGeometry(2.8, 6, 14), roofM, kcx + 3.5, y0 + kh + 15, kcz - 2.5));
    const beacon = mesh(new THREE.SphereGeometry(0.6, 12, 8), glowM, kcx + 3.5, y0 + kh + 11, kcz - 2.5, false); g.add(beacon);
    // the gallery floor and its broken stair
    const G_ = S.gallery;
    g.add(mesh(repeatUV(box(G_.x1 - G_.x0, 0.5, G_.z1 - G_.z0), 4, 2), M({ map: planks('#4a3428') }), (G_.x0 + G_.x1) / 2, y0 + G_.up - 0.25, (G_.z0 + G_.z1) / 2));
    for (let i = 0; i < 4; i++) g.add(mesh(box(1.4, 0.4, 0.8), darkM, -5 + i * 0.2, y0 + 0.2 + i * 0.45, -1.8 - i * 0.15));
    for (let i = 0; i < 7; i++) { const rb = mesh(jitterGeo(new THREE.IcosahedronGeometry(0.4 + (i % 3) * 0.2, 0), 0.2, i + 3), darkM, -3.5 + i * 0.9, y0 + 0.25, -1.4 + (i % 2) * 0.6); g.add(rb); }
    // the floor of the keep
    const kfloor = mesh(repeatUV(box(kw, 0.1, kd), 4, 3), M({ map: stone('#5a5560', '#2e2b32', 'f') }), kcx, y0 + 0.02, kcz, false);
    g.add(kfloor);
    const keepLight = new THREE.PointLight(0xb070ff, 4, 22, 1.5); keepLight.position.set(0, y0 + G_.up + 2.5, S.heart.z);
    g.add(keepLight);

    // the curse's veil over the walls
    const veil = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.2, R + 1.2, 34, 48, 1, true), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime, uA; varying vec2 vUv; varying vec3 vP;
            void main(){ float a = sin(vUv.x * 60.0 + uTime * 0.8 + sin(vUv.y * 9.0 + uTime) * 2.0) * 0.5 + 0.5;
            float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
            gl_FragColor = vec4(vec3(0.45, 0.15, 0.7) * pow(clamp(a, 0.0, 1.0), 6.0) * fade * 0.55 * uA, 1.0); }`,
    }));
    veil.position.y = y0 + 9 + 17 - 6;
    g.add(veil);
    return { group: g, doorL, doorR, locks, hiddenDoor, veil, keepLight, beacon };
}

/** The thornwall: a band of black tendrils, thinned to a gap when it is unwoven. */
export function buildThorns(W) {
    const geo = new THREE.ConeGeometry(0.22, 1, 5, 3);
    geo.translate(0, 0.5, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.4) * 0.25 * y); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1420, roughness: 0.6, emissive: 0x2a0a3a, emissiveIntensity: 0.6 });
    const n = 1600;
    const im = new THREE.InstancedMesh(geo, mat, n);
    const data = [];
    let s = 97;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, rr = SITES.thorn.r + (r() - 0.5) * SITES.thorn.w * 1.3;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const h = 3 + r() * 7;
        data.push({ a, x, z, y: W.height(x, z) - 0.3, h, rx: (r() - 0.5) * 0.7, ry: r() * 6.3, rz: (r() - 0.5) * 0.7, w: 0.8 + r() * 1.6 });
    }
    const set = (open) => {
        data.forEach((d, i) => {
            let dd = d.a - Math.PI / 2; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
            const k = Math.abs(dd) < 0.085 ? 1 - open : Math.abs(dd) < 0.13 ? 1 - open * 0.6 : 1;
            q.setFromEuler(e.set(d.rx * (1 + (1 - k) * 2), d.ry, d.rz));
            m4.compose(v.set(d.x, d.y, d.z), q, sc.set(d.w * Math.max(0.05, k), d.h * Math.max(0.02, k), d.w * Math.max(0.05, k)));
            im.setMatrixAt(i, m4);
        });
        im.instanceMatrix.needsUpdate = true;
    };
    set(0);
    im.castShadow = true;
    return { mesh: im, set };
}

// ------------------------------------------------------------------ stones and landmarks
function standingStone(h = 3.2, w = 1.1) {
    let geo = new THREE.BoxGeometry(w, h, w * 0.7, 2, 4, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h + 0.5; p.setX(i, p.getX(i) * (1 - y * 0.25)); p.setZ(i, p.getZ(i) * (1 - y * 0.2)); }
    geo = jitterGeo(geo, 0.08, Math.round(h * 100));
    geo.translate(0, h / 2, 0);
    return geo;
}

export function buildLandmarks(W, L) {
    const g = new THREE.Group();
    const S = SITES;
    const stoneM = M({ map: stone('#8d8a80', '#5a574f', 's'), roughness: 0.95 });
    const at = (x, z) => W.height(x, z);
    const handles = { stones: {}, beams: {} };
    const carving = (gid, color = '#1d160f') => glyphTex(L.glyphs.find((x) => x.id === gid), { color });

    // the three seal stones, each with its word carved on the face you approach from
    const places = { wood: [S.mere.x, S.mere.z, Math.PI / 2], fen: [S.pool.x, S.pool.z, -Math.PI / 2], moor: [S.storm.x, S.storm.z, 0] };
    for (const reg in places) {
        const [x, z, face] = places[reg];
        const grp = new THREE.Group(); grp.position.set(x, at(x, z) - 0.2, z); grp.rotation.y = face;
        grp.add(mesh(standingStone(3.4, 1.2), stoneM));
        const t = carving(L.regionGlyph[reg], '#1a120c');
        const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: new THREE.Color(L.color[L.stoneEssence[reg]]), emissiveMap: t, emissiveIntensity: 0.0, depthWrite: false });
        const decal = mesh(new THREE.PlaneGeometry(0.9, 0.9), mat, 0, 2.0, 0.43, false);
        grp.add(decal);
        const back = decal.clone(); back.rotation.y = Math.PI; back.position.z = -0.43; grp.add(back);
        g.add(grp);
        handles.stones[reg] = { grp, mat };
        // a beam of light from the stone to the castle, shown when it wakes
        const from = new THREE.Vector3(x, at(x, z) + 3.4, z), to = new THREE.Vector3(0, HILLTOP + 26, 0);
        const len = from.distanceTo(to);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.color[L.stoneEssence[reg]]).multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        beam.position.copy(from).add(to).multiplyScalar(0.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        g.add(beam);
        handles.beams[reg] = beam;
    }
    // the storm ring
    for (const s of W.ringStones) {
        const m = mesh(standingStone(s.h, 1.0), stoneM, s.x, at(s.x, s.z) - 0.3, s.z);
        m.rotation.y = -s.a; g.add(m);
    }
    // carved marks: herald stone, bellows rock, seedbed post
    const herald = mesh(standingStone(2.6, 0.9), stoneM, S.herald.x, at(S.herald.x, S.herald.z) - 0.2, S.herald.z); g.add(herald);
    const hd = mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ map: carving(L.regionGlyph.moor), transparent: true }), S.herald.x, at(S.herald.x, S.herald.z) + 1.4, S.herald.z + 0.33, false); g.add(hd);
    const bel = mesh(jitterGeo(new THREE.IcosahedronGeometry(1.8, 1), 0.4, 77), stoneM, S.bellows.x, at(S.bellows.x, S.bellows.z) + 0.6, S.bellows.z); bel.scale.set(1, 0.8, 1); g.add(bel);
    const bd = mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshStandardMaterial({ map: carving(L.regionGlyph.fen), transparent: true }), S.bellows.x - 1.75, at(S.bellows.x, S.bellows.z) + 1.0, S.bellows.z, false); bd.rotation.y = -Math.PI / 2; g.add(bd);
    // the seedbed and its post
    const sx = S.seedbed.x, sz = S.seedbed.z, sy = at(sx, sz);
    const plank = M({ map: planks('#6a4a30') });
    for (const [w, d, x, z] of [[3.2, 0.2, 0, -1.1], [3.2, 0.2, 0, 1.1], [0.2, 2.2, -1.5, 0], [0.2, 2.2, 1.5, 0]]) g.add(mesh(box(w, 0.25, d), plank, sx + x, sy + 0.12, sz + z));
    const weeds = mesh(box(2.8, 0.1, 2.0), M({ color: 0x4a5a2a }), sx, sy + 0.05, sz, false); g.add(weeds);
    const post = mesh(box(0.22, 1.5, 0.22), plank, sx + 1.6, sy + 0.75, sz - 1.3); g.add(post);
    const pd = mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshStandardMaterial({ map: carving(L.regionGlyph.wood, '#e6d2a8'), transparent: true }), sx + 1.6, sy + 1.2, sz - 1.18, false); g.add(pd);
    handles.seedbed = weeds;
    // the vine bridge, hidden until it grows
    const bridge = new THREE.Group();
    const vineM = M({ color: 0x3f6a2a, roughness: 0.9 }), leafM = M({ color: 0x5a9a3a, side: THREE.DoubleSide, roughness: 0.9 });
    const bx0 = S.mere.x + S.mere.islet - 1, bx1 = S.seedbed.x + 1.2, by = S.mere.level + 0.45;
    for (let k = 0; k < 6; k++) {
        const pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(bx0 + (bx1 - bx0) * t, by - Math.sin(t * Math.PI) * 0.15 + Math.sin(t * 20 + k) * 0.05, S.mere.z + (k - 2.5) * 0.36 + Math.sin(t * 9 + k * 2) * 0.08)); }
        bridge.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.13, 5), vineM, 0, 0, 0));
    }
    for (let i = 0; i < 40; i++) { const l = mesh(new THREE.PlaneGeometry(0.4, 0.25), leafM, bx0 + (bx1 - bx0) * (i / 40), by + 0.12, S.mere.z + Math.sin(i * 2.3) * 1.0, false); l.rotation.set(-Math.PI / 2 + Math.sin(i) * 0.4, i, 0); bridge.add(l); }
    for (const sgn of [-1, 1]) { const rail = []; for (let i = 0; i <= 10; i++) { const t = i / 10; rail.push(new THREE.Vector3(bx0 + (bx1 - bx0) * t, by + 0.9 - Math.sin(t * Math.PI) * 0.2, S.mere.z + sgn * 1.05)); } bridge.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 20, 0.06, 5), vineM, 0, 0, 0)); }
    bridge.scale.set(1, 1, 0.001); bridge.visible = false;
    g.add(bridge);
    handles.bridge = bridge;
    // the frozen falls
    const gx = S.fen.x - S.fen.r - 3.5;
    const iceM = new THREE.MeshPhysicalMaterial({ color: 0xa8dcff, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.82, emissive: 0x204060, emissiveIntensity: 0.3 });
    const ice = mesh(jitterGeo(new THREE.BoxGeometry(2.4, 16, 15, 3, 8, 6), 0.7, 21), iceM, gx, FEN_FLOOR + 6, S.fen.z);
    g.add(ice);
    handles.ice = ice;
    // vents on the causeway
    handles.vents = [0, 1, 2].map((i) => { const v = ventPos(i); const cone = mesh(new THREE.ConeGeometry(0.55, 0.5, 8, 1, true), M({ color: 0x3a3230 }), v.x, FEN_FLOOR + 0.95, v.z); g.add(cone); const plug = mesh(new THREE.SphereGeometry(0.4, 8, 6), M({ color: 0xbfe4ff, roughness: 0.2 }), v.x, FEN_FLOOR + 1.1, v.z); plug.visible = false; g.add(plug); return { ...v, plug }; });
    // the wreck: ribs of a hull and a broken mast
    const hullM = M({ map: planks('#5a4634') });
    const wr = new THREE.Group(); wr.position.set(S.wreck.x, at(S.wreck.x, S.wreck.z) - 0.4, S.wreck.z); wr.rotation.set(0.05, 0.6, 0.25);
    for (let i = 0; i < 9; i++) {
        const rib = mesh(new THREE.TorusGeometry(2.2, 0.14, 5, 12, Math.PI * (0.8 - (i % 3) * 0.12)), hullM, -4 + i, 0.6, 0);
        rib.rotation.set(0, Math.PI / 2, Math.PI * 1.1); wr.add(rib);
    }
    wr.add(mesh(box(9.5, 0.25, 0.5), hullM, 0, 0.0, 0));
    const mast = mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 8), hullM, 1.5, 2.2, 1.0); mast.rotation.z = 1.0; wr.add(mast);
    g.add(wr);
    // Elowen's rowing boat
    const boatGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); boatGeo.scale(1.0, 0.45, 2.1);
    const boat = mesh(boatGeo, M({ map: planks('#7a5a3a'), side: THREE.DoubleSide }), S.boat.x, at(S.boat.x, S.boat.z) + 0.38, S.boat.z); boat.rotation.set(0.1, 0.4, 0.12); g.add(boat);
    // the signpost at the crossroads
    const sign = new THREE.Group(); sign.position.set(S.cross.x + 2, at(S.cross.x + 2, S.cross.z), S.cross.z);
    sign.add(mesh(box(0.14, 2.6, 0.14), plank, 0, 1.3, 0));
    [[0, 2.2, -Math.PI / 2], [0.3, 1.85, Math.PI / 2], [0.1, 1.5, 0], [0.2, 1.15, Math.PI]].forEach(([o, y, r]) => { const a = mesh(box(1.1, 0.2, 0.05), plank, 0, y, 0); a.rotation.y = r; a.translateX(0.5); sign.add(a); });
    g.add(sign);
    // camps: a tent and a cold fire ring at the fen and on the moor
    for (const c of [S.fencamp, S.moorcamp]) {
        const tent = mesh(new THREE.ConeGeometry(1.6, 1.9, 4, 1), M({ color: 0x9a8a6a, flatShading: true }), c.x + 3, at(c.x + 3, c.z - 1) + 0.95, c.z - 1); tent.rotation.y = 0.8; g.add(tent);
        for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; g.add(mesh(new THREE.DodecahedronGeometry(0.16), stoneM, c.x + Math.cos(a) * 0.5, at(c.x, c.z) + 0.08, c.z + Math.sin(a) * 0.5)); }
    }
    // the post by the gorge where page 6 is pinned
    g.add(mesh(box(0.15, 1.6, 0.15), plank, 70, at(70, 14) + 0.8, 14.3));
    // Nib's cage, a ball of thorns
    const cage = mesh(jitterGeo(new THREE.IcosahedronGeometry(1.0, 1), 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x1b1420, wireframe: true, emissive: 0x2a0a3a }), S.cage.x, at(S.cage.x, S.cage.z) + 0.8, S.cage.z);
    g.add(cage);
    handles.cage = cage;
    return { group: g, ...handles };
}
