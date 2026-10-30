// The castle: four rooms side by side like a dollhouse cut open at the front — Kitchen, Sewing Loft, Great Hall and
// Ballroom — with pixel-textured walls and floors, windows onto a sky that turns from storm to sunshine with the
// Overlord's reputation, furniture, candles, one warm light per room, the décor you buy, and the slots where minions
// stand. Built once per lair; the view moves things around inside it.

import * as THREE from 'three';
import { HOBBIES, DECOR } from '../sim/data.js';
import { PALETTES, buildRoomTextures, mkTex } from './tex.js';
import { drawEmblem } from './art.js';
import { makeSlots, SLOTS_PER_KIND } from './layout.js';

export { SLOTS_PER_KIND };

export const RW = 12, RD = 8, RH = 7, GAP = 13.5, T = 0.5;
// Visitors walk along a lane near the front of the room, through a doorway in each side wall. The doorways of
// neighbouring rooms line up, so the castle is one long passage; each has a portcullis that rises to let them by.
export const LANE = 3.0;
export const DOOR = { z0: LANE - 0.75, z1: LANE + 0.75, h: 2.7 };
/** Where a visitor appears (outside the room, behind the next wall) and where it vanishes, in room-local x. */
export const VISIT = { stand: 3.6, start: RW / 2 + T + 1.5, gone: RW / 2 + T + 1.8 };
export const roomX = (i) => i * GAP;

const WINDOW_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WINDOW_FS = `varying vec2 vUv; uniform float uDread, uFlash, uTime; uniform vec3 uTop, uBot, uDayTop, uDayBot, uMount;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 g = vec2(18.0, 28.0);
  vec2 p = (floor(vUv * g) + 0.5) / g;
  if (p.y > 0.72) { vec2 a = vec2((p.x - 0.5) * 2.0, (p.y - 0.72) / 0.28); if (dot(a, a) > 1.0) discard; }
  float night = smoothstep(0.18, 0.62, uDread);
  vec3 c = mix(mix(uDayBot, uDayTop, p.y), mix(uBot, uTop, p.y), night);
  // stars and drifting clouds
  float s = h(floor(vUv * g) + floor(uTime * 0.3) * 0.0);
  c += vec3(0.9, 0.85, 1.0) * step(0.965, s) * night * (0.6 + 0.4 * sin(uTime * 3.0 + s * 40.0));
  float cl = smoothstep(0.55, 0.75, sin(p.x * 7.0 + uTime * 0.25 + p.y * 3.0) * 0.5 + 0.5) * smoothstep(0.45, 0.8, p.y);
  c = mix(c, mix(vec3(0.95, 0.92, 1.0), vec3(0.32, 0.28, 0.42), night), cl * 0.35);
  // a rainbow when it's far too cosy
  float r = length(vec2(p.x - 0.5, p.y + 0.15));
  float band = smoothstep(0.62, 0.66, r) * (1.0 - smoothstep(0.74, 0.78, r));
  vec3 rb = 0.5 + 0.5 * cos(6.2831 * (r * 5.0 + vec3(0.0, 0.33, 0.67)));
  c = mix(c, rb, band * clamp(1.0 - uDread * 4.0, 0.0, 1.0) * 0.55);
  // hills
  float hill = 0.22 + 0.07 * sin(p.x * 8.0 + 1.3) + 0.03 * sin(p.x * 21.0);
  if (p.y < hill) c = mix(uMount, mix(vec3(0.35, 0.6, 0.35), uMount, night), 0.5) * (0.7 + p.y);
  c += vec3(0.85, 0.75, 1.1) * uFlash;
  gl_FragColor = vec4(c * (0.82 + night * 0.12), 1.0);
}`;

const lam = (opts) => new THREE.MeshLambertMaterial(opts);
const glow = (hex, k = 2.4) => { const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }); m.color.multiplyScalar(k); return m; };
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent?.add(m); return m; }
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent?.add(m); return m; }
function sphere(r, mat, x, y, z, parent, seg = 10) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat); m.position.set(x, y, z); parent?.add(m); return m; }
function plane(w, h, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); parent?.add(m); return m; }

/** A candle: wax, a flame that blooms. Flames are collected so the view can flicker them. */
function candle(parent, x, y, z, flames, h = 0.35) {
    cyl(0.06, 0.07, h, lam({ color: 0xfff1d8 }), x, y + h / 2, z, parent, 6);
    const f = sphere(0.07, glow(0xffb84a, 3.2), x, y + h + 0.08, z, parent, 6);
    f.scale.y = 1.6;
    flames.push(f);
    return f;
}

/** Everything static in one lair. */
export function buildCastle(lairId) {
    const pal = PALETTES[lairId] || PALETTES.gloom;
    const px = buildRoomTextures(pal, drawEmblem());
    const tex = (p, r) => mkTex(p.toCanvas(), r);
    const root = new THREE.Group();
    const flames = [];
    const windowUniforms = {
        uDread: { value: 0.5 }, uFlash: { value: 0 }, uTime: { value: 0 },
        uTop: { value: new THREE.Color(pal.sky[0]) }, uBot: { value: new THREE.Color(pal.sky[1]) },
        uDayTop: { value: new THREE.Color(pal.cozy[0]) }, uDayBot: { value: new THREE.Color(pal.cozy[1]) },
        uMount: { value: new THREE.Color(pal.mountain) },
    };
    const windowMat = new THREE.ShaderMaterial({ uniforms: windowUniforms, vertexShader: WINDOW_VS, fragmentShader: WINDOW_FS, toneMapped: false });
    const trimMat = lam({ color: pal.trim });
    const woodMat = lam({ map: tex(px.plank, [1, 1]) });
    const darkWood = lam({ color: 0x3a2418 });

    // the outside: ground, foundations, distant towers and the sky
    const backdrop = plane(260, 98, lam({ map: tex(px.backdrop, 1), emissive: 0xffffff, emissiveMap: tex(px.backdrop, 1), emissiveIntensity: 0.9 }), roomX(1.5), 24, -42, root);
    backdrop.material.map.wrapS = backdrop.material.map.wrapT = THREE.ClampToEdgeWrapping;
    const ground = plane(320, 120, lam({ color: pal.ground }), roomX(1.5), -2.6, -10, root);
    ground.rotation.x = -Math.PI / 2;
    box(GAP * 4 + 5, 2.3, RD + 1, lam({ map: tex(px.stone, [10, 1]) }), roomX(1.5), -1.47, 0, root);   // its top sits under the floors, never level with them
    const towerMat = lam({ map: tex(px.brick, [2, 6]), color: 0xb8b0c8 });
    const roofMat = lam({ color: pal.wall2 });
    for (const [x, w, h] of [[-9, 4, 15], [roomX(1.5), 5, 19], [roomX(3) + 9, 4, 14], [roomX(0.5), 3, 11], [roomX(2.5), 3, 12]]) {
        box(w, h, w, towerMat, x, h / 2 - 2.6, -RD / 2 - 3.5, root);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, w * 1.3, 4), roofMat);
        roof.position.set(x, h - 2.6 + w * 0.65, -RD / 2 - 3.5);
        roof.rotation.y = Math.PI / 4;
        root.add(roof);
        plane(0.7, 1.1, windowMat, x, h - 4.5, -RD / 2 - 3.5 + w / 2 + 0.02, root);
    }

    const rooms = HOBBIES.map((h, i) => {
        const g = new THREE.Group();
        g.position.x = roomX(i);
        root.add(g);
        // floor, walls and trims, different in each room
        const floorTex = { cook: px.check, sew: px.plank, deco: px.flag, party: px.marble }[h.id];
        const wallTex = { cook: px.brick, sew: px.paper, deco: px.stone, party: px.wallWood }[h.id];
        box(RW, 0.3, RD, lam({ map: tex(floorTex, [RW / 2, RD / 2]) }), 0, -0.15, 0, g);
        const wallMat = lam({ map: tex(wallTex, h.id === 'sew' ? [RW / 1.2, RH / 1.2] : [RW / 3, RH / 3]) });
        // the back wall, built around two arched windows
        const wy = 3.6, ww = 1.7, wh = 2.6;
        const windows = [];
        for (const s of [-1, 1]) {
            windows.push(plane(ww, wh, windowMat, s * 3.2, wy, -RD / 2 + T / 2 + 0.01, g));
            box(ww + 0.3, 0.18, 0.35, trimMat, s * 3.2, wy - wh / 2 - 0.05, -RD / 2 + T / 2 + 0.1, g);
            box(0.12, wh * 0.7, 0.06, darkWood, s * 3.2, wy - 0.2, -RD / 2 + T / 2 + 0.04, g);
        }
        box(RW, RH, T, wallMat, 0, RH / 2, -RD / 2, g);
        // the side walls, each with a doorway near the front and a portcullis in it
        const walls = [], doors = [], frames = new THREE.Group();
        const sideMat = (len, ht) => lam({ map: tex(wallTex, h.id === 'sew' ? [len / 1.2, ht / 1.2] : [len / 3, ht / 3]) });
        const iron = lam({ color: 0x2a2632 });
        for (const s of [-1, 1]) {
            const wx = s * (RW / 2 + T / 2);
            const back = DOOR.z0 + RD / 2, front = RD / 2 - DOOR.z1, wide = DOOR.z1 - DOOR.z0;
            walls.push(box(T, RH, back, sideMat(back, RH), wx, RH / 2, -RD / 2 + back / 2, g));
            walls.push(box(T, RH, front, sideMat(front, RH), wx, RH / 2, DOOR.z1 + front / 2, g));
            walls.push(box(T, RH - DOOR.h, wide, sideMat(wide, RH - DOOR.h), wx, DOOR.h + (RH - DOOR.h) / 2, LANE, g));
            // a threshold out to the middle of the gap between this room and the next (the next room lays the other half)
            box(T + 0.25, 0.3, wide, lam({ map: tex(floorTex, [1, 1]) }), s * (RW / 2 + (T + 0.25) / 2), -0.15, LANE, g);
            // a stone frame on the room side
            const fx = s * (RW / 2 - 0.08);
            for (const z of [DOOR.z0 - 0.09, DOOR.z1 + 0.09]) box(0.16, DOOR.h + 0.1, 0.18, trimMat, fx, (DOOR.h + 0.1) / 2, z, frames);
            box(0.16, 0.22, wide + 0.36, trimMat, fx, DOOR.h + 0.1, LANE, frames);
            // the portcullis: iron bars that rise into the wall above the doorway
            const grate = new THREE.Group();
            for (let z = DOOR.z0 + 0.12; z < DOOR.z1; z += 0.26) box(0.05, DOOR.h, 0.05, iron, 0, DOOR.h / 2, z, grate);
            for (const y of [0.7, 1.5, 2.3]) box(0.05, 0.06, wide, iron, 0, y, LANE, grate);
            grate.position.x = wx;
            g.add(grate);
            doors.push({ side: s, grate, open: 0, x: wx });
        }
        g.add(frames);
        box(RW, 0.35, 0.12, trimMat, 0, 0.17, -RD / 2 + T / 2 + 0.06, g);
        box(RW + T * 2, 0.3, 0.7, trimMat, 0, RH + 0.15, -RD / 2, g);   // a gilt cornice along the top of the back wall
        // battlements on top of the walls
        for (let x = -RW / 2; x <= RW / 2; x += 1.5) box(0.8, 0.7, 0.5, lam({ map: tex(px.brick, 0.5) }), x, RH + 0.75, -RD / 2, g);

        const light = new THREE.PointLight(pal.lamp, 26, 22, 1.6);
        light.position.set(0, 4.8, 1.6);
        g.add(light);
        const props = new THREE.Group();
        g.add(props);
        FURNISH[h.id](props, { pal, px, tex, flames, woodMat, trimMat, darkWood, light });
        // cobwebs, shown while the room has no minions
        const webs = new THREE.Group();
        const webMat = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false });
        for (const [x, y, r] of [[-RW / 2 + 0.9, RH - 0.9, 0], [RW / 2 - 0.9, RH - 0.9, Math.PI / 2], [-RW / 2 + 0.9, 0.9, -Math.PI / 2]]) {
            const w = plane(1.8, 1.8, webMat, x, y, -RD / 2 + T / 2 + 0.05, webs);
            w.rotation.z = r;
        }
        g.add(webs);
        return {
            id: h.id, index: i, x: roomX(i), group: g, light, baseLight: 26, webs,
            station: new THREE.Vector3(roomX(i) + 0.4, 0, -0.9),
            overlord: new THREE.Vector3(roomX(i) - 1.9, 0, -0.1),
            props, windows, walls, doors, frames, slots: null,
        };
    });

    const decor = buildDecor(rooms, { pal, px, tex, flames, trimMat, darkWood, woodMat, windowMat });
    // minions stand where nothing else is: measure every piece of furniture, décor (bought or not) and window
    root.updateMatrixWorld(true);
    for (const r of rooms) {
        r.blockers = [r.props, r.frames, ...r.windows, ...Object.values(decor).flat().filter((o) => o.parent === r.group)];
        r.obstacles = obstaclesOf(r);
        r.slots = makeSlots(r.index, r.obstacles, { RW, RD, RH, T });
    }
    return { root, rooms, flames, windowUniforms, decor, pal };
}

/** Room-local boxes around every mesh that blocks a room (flat rugs and carpets don't). */
export function obstaclesOf(r) {
    const out = [], b = new THREE.Box3();
    for (const o of r.blockers) {
        o.traverse((m) => {
            if (!m.isMesh) return;
            b.setFromObject(m);
            if (b.isEmpty() || b.max.y < 0.1) return;
            out.push({ x0: b.min.x - r.x, x1: b.max.x - r.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z, mesh: m });
        });
    }
    return out;
}

let webTex = null;
function webTexture() {
    if (webTex) return webTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(235,230,255,0.55)'; x.lineWidth = 1;
    for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a * 0.3) * 40, Math.sin(a * 0.3) * 40); x.stroke(); }
    for (let r = 6; r < 32; r += 6) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI / 2); x.stroke(); }
    webTex = mkTex(c);
    return webTex;
}

// ---------------------------------------------------------------------------------------------------- furniture
const FURNISH = {
    cook(g, { flames, woodMat, trimMat }) {
        // the hearth, with a fire
        const stone = lam({ color: 0x8a7f90 });
        box(3.2, 3.2, 1.2, stone, -4.2, 1.6, -3.4, g);
        box(2.2, 1.8, 0.4, lam({ color: 0x1a1018 }), -4.2, 1.0, -2.85, g);
        box(3.6, 0.3, 1.4, trimMat, -4.2, 3.3, -3.3, g);
        for (let k = 0; k < 4; k++) { const f = sphere(0.22 - k * 0.03, glow(k % 2 ? 0xffd04a : 0xff6a2a, 3.4), -4.6 + k * 0.28, 0.45 + (k % 2) * 0.15, -2.7, g, 6); f.scale.y = 1.8; flames.push(f); }
        // a counter and a shelf of jars
        box(3.6, 1.1, 1.1, woodMat, 3.9, 0.55, -3.2, g);
        box(3.8, 0.12, 1.3, lam({ color: 0xfff0e0 }), 3.9, 1.15, -3.15, g);
        box(3.6, 0.14, 0.5, woodMat, 3.9, 2.8, -3.6, g);
        const jars = [0xff9ec7, 0x9ae07f, 0xffd36b, 0xb48cff, 0x7fe0d0];
        jars.forEach((c, k) => cyl(0.17, 0.17, 0.42, lam({ color: c }), 2.5 + k * 0.7, 3.1, -3.6, g, 8));
        // hanging copper pots
        const copper = lam({ color: 0xd8864a });
        box(4, 0.08, 0.08, lam({ color: 0x3a3030 }), 0.4, 5.6, -2.6, g);
        for (let k = 0; k < 4; k++) { sphere(0.28, copper, -1.0 + k * 0.95, 5.1 - (k % 2) * 0.2, -2.6, g, 8).scale.y = 0.7; }
        // a little rug
        const rug = plane(3.2, 2, lam({ color: 0xff9ec7 }), 0.4, 0.02, 1.8, g); rug.rotation.x = -Math.PI / 2;
    },
    sew(g, { woodMat, flames }) {
        // the sewing table and machine
        box(2.8, 1.0, 1.2, woodMat, 4.0, 0.5, -2.6, g);
        box(1.0, 0.6, 0.5, lam({ color: 0x2a2236 }), 4.0, 1.3, -2.6, g);
        box(0.3, 0.7, 0.4, lam({ color: 0x2a2236 }), 3.6, 1.45, -2.6, g);
        // bolts of fabric on a shelf
        box(3.6, 0.15, 0.9, woodMat, -3.8, 2.4, -3.4, g);
        box(3.6, 0.15, 0.9, woodMat, -3.8, 4.0, -3.4, g);
        const cols = [0xff7ab0, 0xb48cff, 0x7fe0d0, 0xffd36b, 0x2a2236, 0xc02a52];
        cols.forEach((c, k) => { const b = cyl(0.26, 0.26, 0.85, lam({ color: c }), -5.1 + (k % 3) * 0.95 + 0.4, k < 3 ? 2.75 : 4.35, -3.3, g, 8); b.rotation.x = Math.PI / 2; });
        // yarn balls
        [[-1.2, 2.1, 0xff6fa5], [4.6, 1.9, 0x9aff7a], [-4.8, 1.4, 0x7fb8ff], [2.8, -0.2, 0xffd36b]].forEach(([x, z, c]) => sphere(0.3, lam({ color: c }), x, 0.3, z, g, 8));
        const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16), lam({ color: 0x8a5ab8 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.3, 0.02, 1.6); g.add(rug);
        candle(g, 4.6, 1.0, -2.4, flames);
    },
    deco(g, { px, tex, flames, trimMat, darkWood }) {
        const carpet = plane(2.6, RD, lam({ map: tex(px.carpet, [1, 4]) }), 0.4, 0.02, 0, g); carpet.rotation.x = -Math.PI / 2;
        // a fireplace with a mantel and candelabra
        const stone = lam({ color: 0x9a92a8 });
        box(3.4, 2.8, 1.0, stone, 4.3, 1.4, -3.4, g);
        box(2.2, 1.6, 0.3, lam({ color: 0x140c14 }), 4.3, 0.85, -2.9, g);
        box(3.8, 0.25, 1.2, trimMat, 4.3, 2.9, -3.3, g);
        for (let k = 0; k < 3; k++) { const f = sphere(0.2, glow(k % 2 ? 0xffd04a : 0xff7a3a, 3.2), 3.9 + k * 0.4, 0.35, -2.75, g, 6); f.scale.y = 1.8; flames.push(f); }
        for (const x of [3.4, 4.3, 5.2]) candle(g, x, 3.02, -3.3, flames, 0.45);
        // portraits of ancestors (the living ones are minions; these just glower)
        for (const [x, y, c] of [[-4.6, 4.2, 0x5a2a3a], [-2.4, 4.9, 0x2a3a5a]]) {
            box(1.3, 1.6, 0.12, trimMat, x, y, -RD / 2 + T / 2 + 0.07, g);
            box(1.0, 1.3, 0.05, lam({ color: c }), x, y, -RD / 2 + T / 2 + 0.14, g);
        }
        // tall candelabras
        for (const x of [-4.9, -1.6]) {
            cyl(0.08, 0.2, 2.2, darkWood, x, 1.1, 2.1, g, 6);
            for (const dx of [-0.3, 0, 0.3]) candle(g, x + dx, 2.2, 2.1, flames, 0.3);
        }
    },
    party(g, { px, tex, flames, trimMat, woodMat }) {
        // a little stage with curtains
        box(4.4, 0.6, 2.4, woodMat, 3.6, 0.3, -2.7, g);
        const curtain = lam({ color: 0x9a1a3a, side: THREE.DoubleSide });
        for (const s of [-1, 1]) { const c = plane(1.2, 4.6, curtain, 3.6 + s * 1.9, 3.0, -2.0, g); c.rotation.y = s * 0.2; }
        box(4.6, 0.6, 0.3, curtain, 3.6, 5.4, -2.0, g);
        box(4.6, 0.12, 0.35, trimMat, 3.6, 5.1, -1.95, g);
        // a buffet table
        box(3.0, 1.0, 1.1, lam({ color: 0xf4eefc }), -4.0, 0.5, -3.0, g);
        [0xff9ec7, 0xffd36b, 0x9ae07f, 0xb48cff].forEach((c, k) => { cyl(0.28, 0.2, 0.18, lam({ color: c }), -5.0 + k * 0.7, 1.1, -3.0, g, 8); });
        candle(g, -2.7, 1.0, -3.0, flames, 0.4);
        // strings of lights across the ceiling
        for (let k = 0; k < 9; k++) { const x = -5 + k * 1.25; flames.push(sphere(0.07, glow([0xff6fa5, 0x7fe0d0, 0xffd36b][k % 3], 3), x, 6.1 - Math.sin((k / 8) * Math.PI) * 0.7, -1.2, g, 5)); }
        void px; void tex;
    },
};

// ---------------------------------------------------------------------------------------------------- décor
/** One object per décor piece, hidden until it's bought. Some animate (view.js reads userData.spin / userData.bob). */
function buildDecor(rooms, { pal, px, tex, flames, trimMat, darkWood, woodMat }) {
    const byRoom = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const out = {};
    const put = (id, roomId, obj) => {
        // recentre the group over its own footprint, so its pop-in grows in place instead of sliding away from the room's middle
        obj.updateMatrixWorld(true);
        const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
        c.y = obj.position.y;
        const d = c.clone().sub(obj.position);
        for (const ch of obj.children) ch.position.sub(d);
        obj.position.copy(c);
        obj.visible = false;
        byRoom[roomId].group.add(obj);
        (out[id] ||= []).push(obj);
    };
    const bannerMat = lam({ map: tex(px.banner, 1), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    for (const r of rooms) {
        const g = new THREE.Group();
        for (const x of [-1.7, 1.7]) plane(1.0, 2.0, bannerMat, x, 5.4, -RD / 2 + T / 2 + 0.08, g);
        put('banners', r.id, g);
    }
    {   // black-rose bouquets on pedestals
        const g = new THREE.Group();
        for (const x of [-3.6, 2.8]) {
            cyl(0.35, 0.45, 1.1, lam({ color: 0xe8e0f0 }), x, 0.55, -3.0, g, 8);
            for (let k = 0; k < 7; k++) sphere(0.16, lam({ color: k % 3 ? 0x2a1424 : 0xb02a5a }), x + Math.cos(k) * 0.25, 1.35 + (k % 3) * 0.12, -3.0 + Math.sin(k) * 0.2, g, 6);
        }
        put('roses', 'deco', g);
    }
    {   // the bat chandelier, in the ballroom
        const g = new THREE.Group();
        g.position.set(0.4, 5.6, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 6, 18), trimMat); ring.rotation.x = Math.PI / 2; g.add(ring);
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; candle(g, Math.cos(a) * 1.2, 0.04, Math.sin(a) * 1.2, flames, 0.25); }
        for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 3), lam({ color: 0x2a1f3d })); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.7, 0.6, 0); g.add(w); }
        box(0.05, 1.4, 0.05, darkWood, 0, 0.9, 0, g);
        g.userData.spin = 0.25;
        put('chandelier', 'party', g);
    }
    {   // a brooding pipe organ
        const g = new THREE.Group();
        box(2.6, 1.2, 1.0, woodMat, -1.6, 0.6, -3.3, g);
        for (let k = 0; k < 9; k++) cyl(0.12, 0.12, 2.2 + Math.sin(k / 8 * Math.PI) * 1.6, lam({ color: 0xd8c08a }), -2.7 + k * 0.28, 2.3 + Math.sin(k / 8 * Math.PI) * 0.8, -3.6, g, 6);
        put('organ', 'party', g);
    }
    {   // a cauldron-shaped oven
        const g = new THREE.Group();
        const pot = sphere(0.8, lam({ color: 0x2a2836 }), -1.9, 0.8, -3.1, g, 12); pot.scale.y = 0.85;
        cyl(0.72, 0.72, 0.16, lam({ color: 0x3a3848 }), -1.9, 1.42, -3.1, g, 12);
        const soup = cyl(0.64, 0.64, 0.05, glow(0xff7fb8, 1.6), -1.9, 1.48, -3.1, g, 12); flames.push(soup);
        for (let k = 0; k < 3; k++) { const f = sphere(0.14, glow(0xff8a2a, 3), -2.2 + k * 0.3, 0.12, -2.4, g, 6); f.scale.y = 1.6; flames.push(f); }
        put('oven', 'cook', g);
    }
    {   // the spinning wheel of fate
        const g = new THREE.Group();
        g.position.set(-1.2, 0, -2.8);
        box(0.2, 1.4, 0.2, woodMat, 0, 0.7, 0, g);
        box(1.8, 0.2, 0.5, woodMat, 0, 0.2, 0, g);
        const wheel = new THREE.Group(); wheel.position.y = 1.6; g.add(wheel);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 6, 20), lam({ color: 0xc8843a })); wheel.add(rim);
        for (let k = 0; k < 6; k++) { const s = box(0.05, 1.8, 0.05, woodMat, 0, 0, 0, wheel); s.rotation.z = (k / 6) * Math.PI; }
        wheel.userData.spinZ = 1.4;
        g.userData.wheel = wheel;
        put('wheel', 'sew', g);
    }
    {   // the thunder spire: a lightning rod on the great hall roof
        const g = new THREE.Group();
        cyl(0.12, 0.3, 4, lam({ color: 0x4a4458 }), 0, RH + 2, -RD / 2, g, 6);
        const orb = sphere(0.35, glow(0x9a7aff, 2.6), 0, RH + 4.2, -RD / 2, g, 8); flames.push(orb);
        put('spire', 'deco', g);
    }
    {   // a velvet throne
        const g = new THREE.Group();
        box(1.6, 3.2, 0.3, lam({ color: 0x6a1a3a }), -4.3, 1.6, -3.2, g);
        box(1.6, 0.6, 1.2, lam({ color: 0x8a2a4a }), -4.3, 0.7, -2.7, g);
        box(1.8, 0.2, 0.2, trimMat, -4.3, 3.2, -3.1, g);
        for (const s of [-1, 1]) box(0.25, 0.9, 1.2, trimMat, -4.3 + s * 0.85, 1.0, -2.7, g);
        sphere(0.2, glow(0xff3b6a, 2), -4.3, 3.45, -3.1, g, 6);
        put('throne', 'deco', g);
    }
    {   // a fountain of bubbling punch
        const g = new THREE.Group();
        cyl(1.0, 1.1, 0.5, lam({ color: 0xe8e0f0 }), -2.6, 0.25, 1.6, g, 14);
        cyl(0.9, 0.9, 0.05, glow(0xff6fa5, 1.4), -2.6, 0.5, 1.6, g, 14);
        cyl(0.12, 0.16, 1.2, lam({ color: 0xe8e0f0 }), -2.6, 1.0, 1.6, g, 8);
        cyl(0.45, 0.3, 0.2, lam({ color: 0xe8e0f0 }), -2.6, 1.65, 1.6, g, 10);
        const jet = sphere(0.22, glow(0xff8fc2, 1.8), -2.6, 1.95, 1.6, g, 8); jet.userData.bob = 1;
        put('punch', 'party', g);
    }
    {   // the mirrorball of doom
        const g = new THREE.Group();
        g.position.set(-1.8, 5.4, 0.6);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xcfd6ff, metalness: 0.6, roughness: 0.55, flatShading: true, emissive: 0x2a2a44 }));   // not mirror-polished: a polished ball turning under bloom flickers (game-088)
        g.add(ball);
        box(0.03, 1.2, 0.03, darkWood, 0, 0.9, 0, g);
        g.userData.spin = 0.5;
        put('mirrorball', 'party', g);
    }
    {   // the grand cake display
        const g = new THREE.Group();
        const cols = [0xffd6e8, 0xc9a0ff, 0xff9ec7, 0xfff0f6];
        for (let k = 0; k < 4; k++) cyl(0.62 - k * 0.12, 0.62 - k * 0.12, 0.36, lam({ color: cols[k] }), 4.9, 1.05 + k * 0.36, 1.8, g, 14);
        cyl(0.15, 0.4, 0.9, lam({ color: 0xe8e0f0 }), 4.9, 0.45, 1.8, g, 10);
        candle(g, 4.9, 2.5, 1.8, flames, 0.25);
        put('cakestand', 'cook', g);
    }
    {   // a parade of mannequins
        const g = new THREE.Group();
        [[-4.6, 1.6, 0x2a1630], [-3.4, 2.0, 0xc02a52], [4.8, 1.7, 0x3a5aa8]].forEach(([x, z, c]) => {
            cyl(0.05, 0.05, 0.8, darkWood, x, 0.4, z, g, 5);
            const dress = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), lam({ color: c })); dress.position.set(x, 1.5, z); g.add(dress);
            cyl(0.25, 0.3, 0.6, lam({ color: c }), x, 2.5, z, g, 8);
            sphere(0.22, lam({ color: 0xe8dcc8 }), x, 3.05, z, g, 8);
        });
        put('mannequins', 'sew', g);
    }
    void pal;
    for (const d of DECOR) if (!out[d.id]) out[d.id] = [];
    return out;
}
