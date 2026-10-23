// The six rooms, built from props. Each builder returns { group, hot, update, lights, hemi }:
//   hot     — one entry per hotspot id: an invisible proxy to pick, and the model that pulses on hover
//   update  — reads G every frame and poses what the rules say (doors open, books pulled, oven lit)
//   lights  — two warm lamps per room; the stage keeps the light count fixed so shaders never rebuild
// Sim (x, y) never reaches here: positions are the view's own.

import * as THREE from 'three';
import {
    M, box, cyl, sph, plane, mesh, group, add, hsl, glowSprite, blob, wallpaperTex, planksTex, tilesTex, rugTex, glowMat,
} from './kit.js';
import * as P from './props.js';
import * as Q from './props2.js';
import { makeGhost, animateGhost } from './characters.js';
import { hotspotShown } from '../sim/world.js';

const HIT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const lerp = THREE.MathUtils.lerp;

function builder(id) {
    const g = group(), hot = {}, ups = [];
    const b = {
        id, group: g, hot, lights: [], ups,
        put(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; g.add(obj); return obj; },
        /** An invisible box to tap. `obj` is the model that pulses on hover; `toggle` ties its visibility to the rules. */
        spot(hid, { pos, size, obj = null, toggle = false, label = null }) {
            const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size), HIT);
            proxy.position.set(...pos);
            proxy.userData.hid = hid;
            g.add(proxy);
            hot[hid] = { id: hid, proxy, obj, toggle, anchor: new THREE.Vector3(pos[0], pos[1] + size[1] / 2, pos[2]), base: obj ? obj.scale.clone() : null };
            if (label) hot[hid].anchor.set(...label);
        },
    };
    return b;
}

/** Winnie peeks from one of three seeded spots in every room. */
function peek(b, room, L, spots) {
    const s = spots[L.peeks[room]];
    const gh = makeGhost({ scale: 0.55, opacity: 0.85 });
    gh.position.set(s[0], s[1], s[2]);
    gh.rotation.y = s[3] || 0;
    b.group.add(gh);
    b.spot('peek_' + room, { pos: [s[0], s[1] + 0.5, s[2]], size: [1.5, 1.5, 1.5], obj: gh, toggle: true });
    b.ups.push((G, dt, t) => { if (gh.visible) { animateGhost(gh, t + s[0]); gh.position.y = s[1] + Math.sin(t * 2 + s[0]) * 0.1; } });
}

const hueOf = (L, base) => base + ((L.hue % 50) - 25);

// ------------------------------------------------------------------ foyer
export function buildFoyer(L) {
    const b = builder('foyer');
    const hue = hueOf(L, 285);
    b.group.add(P.shell({ wall: wallpaperTex(1, hue, 'stripes', 0.32, 0.32), floor: tilesTex(1, '#e9e1d3', '#3a3350'), trim: 0x3d2a3a, wain: 0x4a3150 }));
    const rug = plane(6.2, 4.2, new THREE.MeshStandardMaterial({ map: rugTex(1, '#6b1f3a', '#d9a84a', '#2a1a40'), roughness: 1 }), 0, 0.025, 0.2);
    rug.rotation.x = -Math.PI / 2; b.group.add(rug);

    const libDoor = P.door({ color: 0x4a6a4a, plate: true }); b.put(libDoor, -4.2, 0, -3.88);
    b.spot('d_f_library', { pos: [-4.2, 1.7, -3.7], size: [2.0, 3.5, 0.6], obj: libDoor });
    const coats = P.coatRack(); b.put(coats, -2.2, 0, -3.3);
    b.spot('f_coats', { pos: [-2.2, 1.9, -3.1], size: [1.3, 3.8, 1.0], obj: coats });
    const ball = P.doubleDoor({}); b.put(ball, 0.4, 0, -3.84);
    b.spot('d_f_ballroom', { pos: [0.4, 2.1, -3.6], size: [3.8, 4.4, 0.7], obj: ball });
    const por = P.portrait({ age: L.age, seed: L.hue }); b.put(por, 3.3, 2.35, -3.85);
    b.spot('f_portrait', { pos: [3.3, 3.5, -3.6], size: [2.7, 3.6, 0.5], obj: por });
    const clk = P.clock(); b.put(clk, 5.0, 0, -3.3);
    b.spot('f_clock', { pos: [5.0, 2.5, -3.2], size: [1.7, 5.0, 1.2], obj: clk });
    const hatch = P.hatch(); b.put(hatch, -4.2, 5.2, -3.86);
    b.spot('f_hatch', { pos: [-4.2, 4.0, -3.5], size: [1.7, 3.0, 0.8], obj: hatch });
    const ch = P.chandelier({ r: 1.2, candles: 6, drop: 0 }); b.put(ch, 0.4, 4.7, 0.2);
    b.spot('f_chandelier', { pos: [0.4, 4.6, 0.2], size: [3.0, 1.5, 3.0], obj: ch });
    const sb = P.sidebar({ w: 2.6 }); b.put(sb, -1.8, 0, -3.5);
    const lamp = P.lamp(); b.put(lamp, -1.1, 1.38, -3.5);
    b.spot('f_lamp', { pos: [-1.1, 2.0, -3.4], size: [1.1, 1.7, 1.0], obj: lamp });
    const pc = door2(P.door({ color: 0x7a3d52 }), -5.88, 0, -0.6, Math.PI / 2); b.group.add(pc);
    b.spot('d_f_parlor', { pos: [-5.7, 1.7, -0.6], size: [0.6, 3.5, 2.0], obj: pc });
    const kc = door2(P.door({ color: 0x3d6a6a }), 5.88, 0, -1.4, -Math.PI / 2); b.group.add(kc);
    b.spot('d_f_kitchen', { pos: [5.7, 1.7, -1.4], size: [0.6, 3.5, 2.0], obj: kc });
    const front = door2(P.door({ w: 2.0, h: 3.5, color: 0x24374e }), 5.88, 0, 2.2, -Math.PI / 2);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 20), M(0xe0762a, { rough: 0.9 })); wreath.position.set(0, 2.7, 0.24); front.add(wreath);
    b.group.add(front);
    b.spot('f_front', { pos: [5.7, 1.8, 2.2], size: [0.6, 3.7, 2.4], obj: front });
    b.put(P.plant({ s: 1.2 }), -5.0, 0, 1.3);
    b.lights.push({ p: [0.4, 4.2, 0.4], c: 0xffb066, i: 2.4, d: 16 }, { p: [-1.1, 2.4, -3.1], c: 0xffd9a0, i: 1.0, d: 9 });
    b.hemi = [0x7a6ac8, 0x2a1a30, 0.55];
    peek(b, 'foyer', L, [[-3.2, 4.6, -3.3], [4.0, 0.95, 0.4], [-3.7, 1.0, 1.5]]);
    b.ups.push((G, dt, t) => {
        hatch.userData.closed.visible = !G.f.attic_open;
        hatch.userData.open.visible = !!G.f.attic_open;
        libDoor.userData.lock.visible = !G.f.lib_open;
        ball.userData.seal.visible = !G.f.ball_open;
        ball.userData.seal.children[0].material.opacity = 0.6 + Math.sin(t * 2) * 0.2;
        ch.userData.flames.forEach((f, i) => { const s = 0.85 + Math.sin(t * 9 + i * 2) * 0.12; f.scale.set(s, s, 1); });
        clk.userData.pendulum.rotation.z = Math.sin(t * 2.4) * 0.22;
        ch.rotation.y = t * 0.1;
    });
    return b;
}
function door2(d, x, y, z, ry) { d.position.set(x, y, z); d.rotation.y = ry; return d; }

// ------------------------------------------------------------------ parlor
export function buildParlor(L) {
    const b = builder('parlor');
    const hue = hueOf(L, 345);
    b.group.add(P.shell({ wall: wallpaperTex(2, hue, 'diamonds', 0.4, 0.3), floor: planksTex(2, 28, 0.28), trim: 0x45242f, wain: 0x5a2c3a }));
    const rug = plane(5.6, 3.6, new THREE.MeshStandardMaterial({ map: rugTex(2, '#2b3f6a', '#d98a8a', '#e9d9a4'), roughness: 1 }), 0, 0.025, 0.3);
    rug.rotation.x = -Math.PI / 2; b.group.add(rug);

    const fp = P.fireplace(); b.put(fp, 0.2, 0, -3.5);
    b.spot('p_fireplace', { pos: [0.2, 0.9, -3.0], size: [2.4, 1.7, 1.2], obj: null });
    const w = P.windowMoon({ seed: 2 }); b.put(w, -3.9, 1.7, -3.88);
    b.spot('p_window', { pos: [-3.9, 3.2, -3.6], size: [3.2, 3.8, 0.6], obj: w });
    const w2 = P.windowMoon({ seed: 5, curtains: true }); b.put(w2, 4.1, 1.7, -3.88);
    const sofa = P.sofa({ w: 3.8 }); b.put(sofa, 3.9, 0, -2.2, -0.25);
    b.spot('p_sofa', { pos: [3.9, 1.0, -2.1], size: [4.0, 2.0, 1.8], obj: sofa });
    const tt = P.teaTable(); b.put(tt, -2.7, 0, -0.6);
    b.spot('p_teapot', { pos: [-2.6, 1.75, -0.55], size: [1.0, 0.9, 1.0], obj: tt.userData.pot });
    const st = P.sideTable({ w: 1.6, h: 1.3 }); b.put(st, 3.2, 0, 0.6);
    const mb = P.musicBox(); b.put(mb, 3.2, 1.36, 0.6);
    b.spot('p_musicbox', { pos: [3.2, 1.95, 0.6], size: [1.6, 1.2, 1.1], obj: mb, toggle: true });
    const st2 = P.sideTable({ w: 1.4, h: 1.2 }); b.put(st2, -5.0, 0, -2.0);
    const gl = P.guestNote({ guests: L.guests }); b.put(gl, -5.0, 1.3, -2.1);
    b.spot('p_guestlist', { pos: [-5.0, 1.9, -1.9], size: [1.3, 1.3, 1.2], obj: gl });
    const cat = P.stuffedCat(); b.put(cat, -0.9, 0, 0.8, 0.3);
    b.spot('p_cat', { pos: [-0.9, 0.7, 0.8], size: [1.2, 1.5, 1.2], obj: cat });
    const dp = door2(P.door({ color: 0x6b3f2a }), 5.88, 0, 0.9, -Math.PI / 2); b.group.add(dp);
    b.spot('d_p_foyer', { pos: [5.7, 1.7, 0.9], size: [0.6, 3.5, 2.0], obj: dp });
    b.put(P.lamp(), 4.0, 0, -3.5);
    b.lights.push({ p: [0.2, 1.1, -2.7], c: 0xff8a3a, i: 2.2, d: 11 }, { p: [4.0, 2.4, -3.0], c: 0xffd9a0, i: 0.9, d: 9 });
    b.hemi = [0xa07ab8, 0x301a28, 0.55];
    peek(b, 'parlor', L, [[-1.5, 4.4, -3.4], [2.2, 3.0, -3.2], [-4.6, 0.9, 2.4]]);
    b.ups.push((G, dt, t) => {
        fp.userData.glow.material.opacity = 0.5 + Math.sin(t * 8) * 0.08 + Math.sin(t * 13) * 0.05;
        mb.userData.glow.material.opacity = G.f.box_wound ? 0.5 + Math.sin(t * 3) * 0.2 : 0;
        tt.userData.pot.rotation.z = Math.sin(t * 1.2) * 0.02;
    });
    return b;
}

// ------------------------------------------------------------------ kitchen
export function buildKitchen(L) {
    const b = builder('kitchen');
    const hue = hueOf(L, 175);
    b.group.add(P.shell({ wall: wallpaperTex(3, hue, 'dots', 0.3, 0.38), floor: tilesTex(3, '#efe6d2', '#4a8a86'), trim: 0x2f4a48, wain: 0x3d6a66 }));
    const ice = Q.icebox(); b.put(ice, -4.6, 0, -3.2);
    b.spot('k_fridge', { pos: [-4.6, 1.7, -3.0], size: [2.0, 3.5, 1.4], obj: ice });
    const pan = Q.pantry(); b.put(pan, -2.1, 0, -3.35);
    b.spot('k_pantry', { pos: [-2.1, 2.0, -3.0], size: [2.6, 4.2, 1.3], obj: pan });
    const ov = Q.oven(); b.put(ov, 1.2, 0, -3.2);
    b.spot('k_oven', { pos: [1.2, 1.3, -2.9], size: [3.0, 2.8, 1.5], obj: ov });
    b.put(Q.hangingPots(), 1.2, 4.5, -3.7);
    const cn = Q.counter({ w: 3.0 }); b.put(cn, 4.2, 0, -3.3);
    const jar = Q.cookieJar(); b.put(jar, 3.6, 1.5, -3.3);
    b.spot('k_jar', { pos: [3.6, 1.95, -3.2], size: [0.9, 1.3, 0.9], obj: jar });
    const cal = Q.calendar({ day: L.day }); b.put(cal, 5.0, 2.3, -3.88);
    b.spot('k_calendar', { pos: [5.0, 3.1, -3.6], size: [1.6, 2.0, 0.5], obj: cal });
    const tbl = Q.kitchenTable(); b.put(tbl, 1.8, 0, 0.6);
    const pr = Q.flourPrints(); pr.position.set(-2.4, 0.02, 1.2); b.group.add(pr);
    b.spot('k_floor', { pos: [-2.4, 0.25, 1.2], size: [4.6, 0.5, 2.4], obj: pr });
    const wd = P.windowMoon({ seed: 3, w: 1.9, h: 2.6 }); b.put(wd, -5.86, 1.8, -0.6, Math.PI / 2);
    const cl = Q.closet(); b.put(cl, -5.7, 0, 1.9, Math.PI / 2);
    b.spot('k_closet', { pos: [-5.5, 1.7, 1.9], size: [0.8, 3.5, 1.8], obj: cl });
    const kd = door2(P.door({ color: 0x6b3f2a }), 5.88, 0, 0.6, -Math.PI / 2); b.group.add(kd);
    b.spot('d_k_foyer', { pos: [5.7, 1.7, 0.6], size: [0.6, 3.5, 2.0], obj: kd });
    b.lights.push({ p: [1.2, 2.6, -2.0], c: 0xffc27a, i: 1.8, d: 12 }, { p: [-3.0, 3.8, 0.5], c: 0xcfe8ff, i: 1.0, d: 10 });
    b.hemi = [0x7ab0b0, 0x1a2a2a, 0.6];
    peek(b, 'kitchen', L, [[-0.7, 4.6, -3.4], [4.4, 3.4, -3.3], [-3.9, 0.9, 3.0]]);
    b.ups.push((G, dt, t) => {
        const heat = G.f.baking ? 1.1 + Math.sin(t * 9) * 0.25 : G.f.baked && !G.f.cake_taken ? 0.7 : 0;
        ov.userData.win.emissiveIntensity = heat;
        ov.userData.glow.material.opacity = heat * 0.5;
        pan.userData.doors.children.forEach((p) => { const target = G.f.pantry_open ? p.userData.s * 1.9 : 0; p.rotation.y = lerp(p.rotation.y, target, Math.min(1, dt * 5)); });
        pan.userData.lock.visible = !G.f.pantry_open;
    });
    return b;
}

// ------------------------------------------------------------------ library
export function buildLibrary(L) {
    const b = builder('library');
    const hue = hueOf(L, 150);
    b.group.add(P.shell({ wall: wallpaperTex(4, hue, 'diamonds', 0.3, 0.2), floor: planksTex(4, 22, 0.2), trim: 0x2a1c14, wain: 0x3a2a1c }));
    const rug = plane(5.4, 3.4, new THREE.MeshStandardMaterial({ map: rugTex(4, '#1f4a3a', '#d9b45a', '#6a2a3a'), roughness: 1 }), 0, 0.025, 0.4);
    rug.rotation.x = -Math.PI / 2; b.group.add(rug);
    const sh = Q.bookshelf({ titles: L.bookTitles }); b.put(sh, -1.7, 0, -3.5);
    const books = sh.userData.books;
    books.forEach((bk, i) => {
        const p = new THREE.Vector3(); bk.getWorldPosition(p);
        b.spot('l_book_' + i, { pos: [-1.7 + (-1.4 + i * 0.7), 0.2 + 2 * sh.userData.rowH + 0.85, -3.2], size: [0.62, 0.9, 1.0], obj: null });
    });
    const keyM = group(box(0.34, 0.06, 0.05, M(0xd8dde8, { metal: 0.8, rough: 0.3 }), 0, 0, 0), sph(0.09, M(0xd8dde8, { metal: 0.8, rough: 0.3 }), -0.2, 0, 0, 10, 8), glowSprite('#cfe6ff', 0.8, 0.7));
    keyM.position.set(-0.2, 0.55, -3.25);
    b.group.add(keyM);
    b.spot('l_compartment', { pos: [-0.2, 0.7, -3.1], size: [1.7, 1.0, 0.8], obj: keyM, toggle: true });
    const dk = Q.desk(); b.put(dk, 3.1, 0, -3.1);
    const qu = Q.quill(); b.put(qu, 2.2, 1.63, -2.9);
    b.spot('l_quill', { pos: [2.2, 1.9, -2.9], size: [1.0, 0.7, 0.7], obj: qu, toggle: true });
    const ink = Q.inkwell(); b.put(ink, 3.3, 1.58, -3.2);
    b.spot('l_inkwell', { pos: [3.3, 1.9, -3.2], size: [0.7, 0.8, 0.7], obj: ink, toggle: true });
    const di = Q.diary(); b.put(di, 4.0, 1.58, -2.7, -0.2);
    b.spot('l_diary1', { pos: [4.0, 1.85, -2.7], size: [1.3, 0.6, 1.0], obj: di });
    const rh = Q.framedRhyme(); b.put(rh, 3.1, 2.4, -3.88);
    b.spot('l_rhyme', { pos: [3.1, 3.3, -3.6], size: [1.9, 2.2, 0.5], obj: rh });
    const gb = Q.globe(); b.put(gb, 5.0, 0, -1.5);
    b.spot('l_globe', { pos: [5.0, 1.0, -1.5], size: [1.4, 2.0, 1.4], obj: gb });
    const rc = Q.rockingChair(); b.put(rc, -3.3, 0, 0.9, 0.5);
    b.spot('l_chair', { pos: [-3.3, 1.3, 0.9], size: [1.6, 2.6, 1.6], obj: rc });
    const wd = P.windowMoon({ seed: 4, w: 2.0, h: 3.4 }); b.put(wd, -5.86, 1.6, -0.9, Math.PI / 2);
    const ld = door2(P.door({ color: 0x4a2f24 }), 5.88, 0, 0.8, -Math.PI / 2); b.group.add(ld);
    b.spot('d_l_foyer', { pos: [5.7, 1.7, 0.8], size: [0.6, 3.5, 2.0], obj: ld });
    b.lights.push({ p: [3.2, 2.6, -2.4], c: 0xffcf80, i: 1.6, d: 10 }, { p: [-4.0, 3.4, 0.0], c: 0x9ac8ff, i: 0.8, d: 10 });
    b.hemi = [0x6a8a7a, 0x1a1a14, 0.5];
    peek(b, 'library', L, [[0.9, 4.9, -3.2], [-5.0, 0.9, -2.2], [4.5, 3.8, -3.3]]);
    let pull = [0, 0, 0, 0, 0];
    b.ups.push((G, dt, t) => {
        books.forEach((bk, i) => { pull[i] = lerp(pull[i], G.books.includes(i) ? 0.3 : 0, Math.min(1, dt * 10)); bk.position.z = bk.userData.baseZ + pull[i]; });
        const open = !!G.f.shelf_open;
        sh.userData.panel.position.y = lerp(sh.userData.panel.position.y, open ? 0.2 + sh.userData.rowH * 0.4 + sh.userData.rowH * 0.75 : 0.2 + sh.userData.rowH * 0.4, Math.min(1, dt * 4));
        sh.userData.panel.visible = sh.userData.panel.position.y < 1.6;
        sh.userData.cavity.visible = open;
        rc.userData.rock.rotation.z = Math.sin(t * 1.5) * 0.06;
        gb.userData.ball.rotation.y += dt * 0.25;
    });
    return b;
}

// ------------------------------------------------------------------ attic
export function buildAttic(L) {
    const b = builder('attic');
    b.group.add(P.shell({ wall: wallpaperTex(5, hueOf(L, 28), 'boards', 0.28, 0.24), floor: planksTex(5, 26, 0.2, 52), trim: 0x2a1c14, wain: 0x3a281a, wainH: 0.8 }));
    b.group.add(Q.rafters());
    const rug = plane(4.4, 2.8, new THREE.MeshStandardMaterial({ map: rugTex(5, '#5a3a4a', '#caa05a', '#2f4a5a'), roughness: 1 }), 0.2, 0.025, 0.4);
    rug.rotation.x = -Math.PI / 2; b.group.add(rug);
    const mr = Q.mirror(); b.put(mr, -4.4, 0, -3.5);
    b.spot('a_mirror', { pos: [-4.4, 2.1, -3.4], size: [2.0, 3.6, 0.8], obj: mr });
    const tr = Q.trunk(); b.put(tr, -0.8, 0, -3.0);
    b.spot('a_trunk', { pos: [-0.8, 0.8, -3.0], size: [2.6, 1.8, 1.6], obj: tr });
    const ms = Q.musicStand({ melody: L.melody }); b.put(ms, 2.2, 0, -2.6, -0.3);
    b.spot('a_sheet', { pos: [2.2, 2.2, -2.5], size: [1.4, 1.2, 0.8], obj: ms });
    const rh = Q.rockingHorse(); b.put(rh, -3.2, 0, -0.6, 0.3);
    b.spot('a_horse', { pos: [-3.2, 1.3, -0.6], size: [2.6, 2.6, 1.2], obj: rh });
    const dd = Q.dustDolls(); b.put(dd, 4.1, 0, -1.2, -0.3);
    b.spot('a_dolls', { pos: [4.1, 0.9, -1.2], size: [2.0, 1.8, 1.2], obj: dd });
    b.put(Q.crates(), 5.0, 0, -3.2, 0.2);
    const wd = P.windowMoon({ seed: 6, w: 1.8, h: 2.2, curtains: false }); b.put(wd, 4.2, 2.3, -3.88);
    // the ladder down: a dark hole in the floor and two rails
    const hole = plane(1.5, 1.6, glowMat(0x07050a), 4.5, 0.03, 1.9); hole.rotation.x = -Math.PI / 2; b.group.add(hole);
    const lad = group(); for (const s of [-1, 1]) lad.add(box(0.09, 1.7, 0.09, P.WOOD_L, s * 0.35, 0.8, 0)); for (let i = 0; i < 3; i++) lad.add(box(0.7, 0.07, 0.09, P.WOOD_L, 0, 0.35 + i * 0.5, 0));
    lad.position.set(4.5, 0, 1.45); b.group.add(lad);
    b.spot('d_a_foyer', { pos: [4.5, 0.7, 1.8], size: [1.9, 1.6, 1.8], obj: lad });
    b.lights.push({ p: [2.2, 3.6, -1.4], c: 0xffb866, i: 1.5, d: 10 }, { p: [4.2, 2.6, -2.5], c: 0x9ab4ff, i: 1.0, d: 9 });
    b.hemi = [0x6a5a7a, 0x20160e, 0.5];
    peek(b, 'attic', L, [[1.0, 5.2, -3.3], [-5.0, 3.6, -2.0], [2.4, 0.9, 0.8]]);
    b.ups.push((G, dt, t) => {
        const open = !!G.f.trunk_open;
        tr.userData.lid.rotation.x = lerp(tr.userData.lid.rotation.x, open ? -1.25 : 0, Math.min(1, dt * 5));
        tr.userData.lockM.visible = !open;
        tr.userData.stuff.visible = open && !(G.inv.includes('streamers')) ? true : false;
        rh.userData.rock.rotation.z = Math.sin(t * 1.6) * 0.07;
    });
    return b;
}

// ------------------------------------------------------------------ ballroom
export function buildBallroom(L) {
    const b = builder('ballroom');
    b.group.add(P.shell({ wall: wallpaperTex(6, hueOf(L, 255), 'diamonds', 0.3, 0.28), floor: tilesTex(6, '#e5dfef', '#4b4575'), trim: 0x2f2a4a, wain: 0x3f3a66, wainH: 1.5, cut: 0xd2c9e4 }));
    for (const [x, s] of [[-3.2, 1], [0.8, 1.1], [4.6, 1]]) { const w = P.windowMoon({ seed: 7 + x, w: 1.9 * s, h: 3.8, curtains: false }); b.put(w, x, 1.0, -3.88); }
    for (const x of [-5.3, 5.3]) b.put(Q.column({ h: 6 }), x, 0, -3.3);
    const ch = P.chandelier({ r: 1.7, candles: 8, drop: 0 }); b.put(ch, 0.4, 4.6, -0.5);
    const tbl = Q.longTable(); b.put(tbl, -2.3, 0, -1.4);
    b.spot('b_table', { pos: [-2.3, 0.9, -1.4], size: [4.8, 1.9, 2.0], obj: null });
    const ck = Q.cake(); b.put(ck, -2.3, 1.43, -1.4); ck.visible = false;
    const ped = Q.pedestal(); b.put(ped, 3.2, 0, -2.4);
    const mb = P.musicBox(); b.put(mb, 3.2, 1.78, -2.4); mb.scale.setScalar(0.85); mb.visible = false;
    b.spot('b_stand', { pos: [3.2, 1.0, -2.4], size: [1.4, 2.2, 1.4], obj: ped });
    const ea = Q.easel(); b.put(ea, 4.7, 0, 1.2, -0.5);
    b.spot('b_easel', { pos: [4.7, 1.8, 1.2], size: [1.9, 3.4, 1.0], obj: ea });
    const bn = Q.banner(); b.put(bn, 0, 0, -3.8);
    b.spot('b_banner', { pos: [0, 4.4, -3.6], size: [8.4, 2.4, 0.5], obj: null, label: [0, 5.0, -3.6] });
    b.spot('b_window', { pos: [-3.2, 2.9, -3.7], size: [2.2, 4.0, 0.5], obj: null });
    const bd = door2(P.door({ color: 0x4a3a6a }), -5.88, 0, 1.4, Math.PI / 2); b.group.add(bd);
    b.spot('d_b_foyer', { pos: [-5.7, 1.7, 1.4], size: [0.6, 3.5, 2.0], obj: bd });
    b.lights.push({ p: [0.4, 4.3, -0.5], c: 0xffc680, i: 2.6, d: 15 }, { p: [3.2, 2.6, -2.0], c: 0xffe3b0, i: 0.8, d: 8 });
    b.hemi = [0x8a7ad8, 0x20183a, 0.65];
    peek(b, 'ballroom', L, [[-0.4, 5.2, -3.3], [5.0, 4.4, -3.0], [-5.0, 1.0, -2.4]]);
    // Winnie herself, for the party
    const win = makeGhost({ scale: 1.15, opacity: 0.0 });
    win.position.set(0.6, 0.5, 0.5); win.visible = false;
    b.group.add(win);
    b.winnie = win;
    let appear = 0;
    b.ups.push((G, dt, t) => {
        ck.visible = !!G.f.p_cake;
        ck.userData.flames.forEach((f, i) => { const s = 0.8 + Math.sin(t * 10 + i * 2) * 0.13; f.scale.set(s, s, 1); });
        mb.visible = !!G.f.p_music;
        mb.userData.glow.material.opacity = G.f.p_music ? 0.4 + Math.sin(t * 3) * 0.15 : 0;
        bn.visible = !!G.f.p_banner;
        bn.children.forEach((c) => { if (c.userData.phase !== undefined) c.position.y += Math.sin(t * 1.2 + c.userData.phase) * 0.002; });
        ea.userData.sign.visible = !!G.f.p_invite;
        ch.userData.flames.forEach((f, i) => { const s = 0.85 + Math.sin(t * 8 + i * 2) * 0.12; f.scale.set(s, s, 1); });
        const want = G.f.party_ready ? 1 : 0;
        appear = lerp(appear, want, Math.min(1, dt * 0.9));
        win.visible = appear > 0.02;
        win.userData.mat.opacity = 0.92 * Math.min(1, appear * 1.2);
        win.userData.glow.material.opacity = 0.6 * appear;
        win.position.y = 0.45 + Math.sin(t * 1.6) * 0.12 + (1 - appear) * 0.6;
        animateGhost(win, t, 1);
    });
    return b;
}

export const BUILDERS = { foyer: buildFoyer, parlor: buildParlor, kitchen: buildKitchen, library: buildLibrary, attic: buildAttic, ballroom: buildBallroom };
export const ROOM_BG = {
    foyer: 0x120a20, parlor: 0x1a0a16, kitchen: 0x081a1c, library: 0x0a1612, attic: 0x120c08, ballroom: 0x0c0a20,
};
