// Builds a map's world: floors, walls, ceilings, liquids, themed blockers, props, lights, sky and
// particles, from the same ASCII grid the sim walks on. Cells are 2 m; cell (x, y) is centred at
// world ((x+.5)·2, 0, (y+.5)·2).

import * as THREE from 'three';
import { CELL } from '../config.js';
import { MAPS, legendAt } from '../sim/data/maps.js';
import * as TX from './textures.js';
import { waterMaterial, lavaMaterial, skyMaterial, shaftMaterial } from './shaders.js';
import { PROPS, pillar, tree, wallLantern, banner, chandelier, mushroomCluster, flame } from './props.js';
import { Particles } from './fx.js';

export const THEMES = {
    clinic: {
        H: 3.4, fog: [0x1a120c, 0.035], bg: 0x120c08, hemi: [0xffd8a8, 0x2a1a10, 0.35], key: [0xffe0b0, 0.35],
        grade: { tint: [1.04, 0.98, 0.9], lift: [0.02, 0.012, 0.0], sat: 1.05, vignette: 0.5, grain: 0.03, exposure: 1.05, bloom: 0.55, threshold: 0.85 },
        lights: { color: 0xffb070, intensity: 1.6, dist: 9, max: 4 }, particles: 'dust', music: 'clinic',
    },
    forest: {
        H: 5, fog: [0x10202a, 0.045], bg: 0x0a1424, hemi: [0x8ab0ff, 0x1a2a10, 0.45], key: [0xa0c0ff, 0.7], sky: [0x070c24, 0x23405a],
        grade: { tint: [0.92, 1.0, 1.05], lift: [0.0, 0.015, 0.03], sat: 0.95, vignette: 0.55, grain: 0.04, exposure: 1.15, bloom: 0.7, threshold: 0.75 },
        lights: { color: 0x9affb0, intensity: 1.0, dist: 8, max: 3 }, particles: 'fireflies', music: 'forest',
    },
    crypt: {
        H: 4, fog: [0x081418, 0.055], bg: 0x05090c, hemi: [0x6ab0c0, 0x0a0a14, 0.3], key: [0x80c0d0, 0.25],
        grade: { tint: [0.88, 1.0, 1.04], lift: [0.0, 0.025, 0.035], sat: 0.85, vignette: 0.55, grain: 0.045, exposure: 1.45, bloom: 0.75, threshold: 0.72 },
        lights: { color: 0xffc890, intensity: 1.4, dist: 8, max: 4 }, particles: 'wisps', music: 'crypt',
    },
    forge: {
        H: 6, fog: [0x1a0805, 0.04], bg: 0x0a0302, hemi: [0xff9050, 0x1a0804, 0.35], key: [0xff8040, 0.3],
        grade: { tint: [1.08, 0.95, 0.85], lift: [0.03, 0.005, 0.0], sat: 1.1, vignette: 0.55, grain: 0.04, exposure: 1.0, bloom: 0.85, threshold: 0.8 },
        lights: { color: 0xff6a20, intensity: 2.2, dist: 10, max: 4 }, particles: 'embers', music: 'forge',
    },
    citadel: {
        H: 5.5, fog: [0x120a1c, 0.05], bg: 0x08040e, hemi: [0xa080ff, 0x140a1a, 0.3], key: [0xb090ff, 0.25],
        grade: { tint: [0.98, 0.92, 1.08], lift: [0.02, 0.01, 0.035], sat: 0.92, vignette: 0.55, grain: 0.04, exposure: 1.4, bloom: 0.75, threshold: 0.75 },
        lights: { color: 0xc090ff, intensity: 1.6, dist: 10, max: 4 }, particles: 'spores', music: 'citadel',
    },
};

const centre = (x, y) => new THREE.Vector3((x + 0.5) * CELL, 0, (y + 0.5) * CELL);

function materialsFor(theme) {
    switch (theme) {
        case 'clinic': return {
            floor: TX.texMat(TX.planks, { color: 0xc8a888, rough: 0.7, repeat: [1, 1] }),
            alt: TX.texMat(TX.planks, { color: 0xb08a70, rough: 0.8, repeat: [1, 1] }),
            wall: TX.texMat(TX.plaster, { rough: 0.95, repeat: [1, 1.7] }),
            ceil: TX.texMat(TX.planks, { color: 0x6a4a38, rough: 0.9, repeat: [1, 1] }),
        };
        case 'forest': return {
            floor: TX.texMat(TX.moss, { repeat: [1, 1] }),
            alt: TX.texMat(TX.moss, { color: 0xb8d090, repeat: [1, 1] }),
            wall: TX.texMat(TX.rock, { repeat: [1, 2.5] }),
        };
        case 'crypt': return {
            floor: TX.texMat(TX.flags, { color: 0x8a96a0, rough: 0.6, repeat: [1, 1] }),
            alt: TX.texMat(TX.flags, { color: 0x5a6a72, rough: 0.35, repeat: [1, 1] }),
            wall: TX.texMat(TX.blocks, { color: 0x7a8494, repeat: [1, 2] }),
            ceil: TX.texMat(TX.blocks, { color: 0x3a4048, repeat: [1, 1] }),
        };
        case 'forge': return {
            floor: TX.texMat(TX.ash, { repeat: [1, 1] }),
            alt: TX.texMat(TX.basalt, { repeat: [1, 1], emissive: 0xffffff, emissiveIntensity: 0.4 }),
            wall: TX.texMat(TX.basalt, { repeat: [1, 3], emissive: 0xffffff, emissiveIntensity: 0.3 }),
            ceil: TX.texMat(TX.basalt, { color: 0x555555, repeat: [1, 1] }),
        };
        default: return {
            floor: TX.texMat(TX.marble, { rough: 0.3, repeat: [1, 1], envIntensity: 1 }),
            alt: TX.texMat(TX.carpet, { repeat: [1, 1] }),
            wall: TX.texMat(TX.blocks, { color: 0x6a5a80, repeat: [1, 2.75] }),
            ceil: TX.texMat(TX.blocks, { color: 0x2a2234, repeat: [1, 1] }),
        };
    }
}

/** Instanced planes/boxes at a list of matrices. */
function instanced(geo, mat, mats, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.count = mats.length;
    im.receiveShadow = true;
    im.castShadow = shadow;
    im.instanceMatrix.needsUpdate = true;
    return im;
}

const mat4 = (pos, rotX = 0, rotY = 0, scale = null) => {
    const o = new THREE.Object3D();
    o.position.copy(pos);
    o.rotation.set(rotX, rotY, 0);
    if (scale) o.scale.copy(scale);
    o.updateMatrix();
    return o.matrix.clone();
};

export function buildLevel(mapId, quality = 1) {
    const M = MAPS[mapId];
    const T = THEMES[M.theme];
    const theme = M.theme;
    const grid = M.grid;
    const W = grid[0].length, Hh = grid.length;
    const root = new THREE.Group();
    const updaters = [];
    const ents = new Map();
    const mats = materialsFor(theme);
    const H = T.H;
    const at = (x, y) => (y >= 0 && y < Hh && x >= 0 && x < W ? grid[y][x] : '#');
    const isWall = (ch) => ch === '#' || ch === 'X';
    const open = (x, y) => !isWall(at(x, y)) && at(x, y) !== '~';

    // ---------------- floors and ceilings
    const floorA = [], floorB = [], ceil = [], liquid = [];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const ch = at(x, y);
        if (isWall(ch)) continue;
        const c = centre(x, y);
        if (ch === '~') { liquid.push(mat4(c.clone().setY(theme === 'forge' ? -0.35 : -0.2), -Math.PI / 2)); continue; }
        (ch === ',' && theme !== 'clinic' ? floorB : floorA).push(mat4(c, -Math.PI / 2));
    }
    const plane = new THREE.PlaneGeometry(CELL, CELL);
    root.add(instanced(plane, mats.floor, floorA, false));
    if (floorB.length) root.add(instanced(plane, mats.alt, floorB, false));
    if (mats.ceil) {
        const cm = mats.ceil.clone();
        cm.map = mats.ceil.map.clone(); cm.map.repeat.set(W, Hh); cm.map.needsUpdate = true;
        cm.normalMap = mats.ceil.normalMap.clone(); cm.normalMap.repeat.set(W, Hh); cm.normalMap.needsUpdate = true;
        cm.roughnessMap = null;
        const cp = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, Hh * CELL), cm);
        cp.rotation.x = Math.PI / 2;
        cp.position.set(W * CELL / 2, H, Hh * CELL / 2);
        root.add(cp);
    }
    if (liquid.length) {
        const lm = theme === 'forge' ? lavaMaterial() : waterMaterial(theme === 'forest' ? 0x0a2030 : 0x082a30, theme === 'forest' ? 0x6ac0ff : 0x40e0c8);
        root.add(instanced(plane, lm, liquid, false));
        // basin walls under the floor edge so the drop doesn't show the void
        const basin = [];
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (at(x, y) === '~') basin.push(mat4(centre(x, y).setY(-0.6)));
        root.add(instanced(new THREE.BoxGeometry(CELL, 0.8, CELL), new THREE.MeshStandardMaterial({ color: theme === 'forge' ? 0x1a0804 : 0x0a1418, roughness: 1, side: THREE.BackSide }), basin, false));
    }
    // clinic rugs
    if (theme === 'clinic') {
        const seen = new Set();
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            if (at(x, y) !== ',' || seen.has(`${x},${y}`)) continue;
            // one rug per connected patch of ',' cells, sized to the patch's bounding box (furniture
            // standing in it just stands on the rug); never two rugs over the same cells, or they z-fight
            let x1 = x, y1 = y, x0 = x, y0 = y;
            const stack = [[x, y]];
            seen.add(`${x},${y}`);
            while (stack.length) {
                const [cx, cy] = stack.pop();
                x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
                    if (at(nx, ny) === ',' && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
                }
            }
            const w = (x1 - x0 + 1) * CELL - 0.4, d = (y1 - y0 + 1) * CELL - 0.4;
            // the gold border is a ring around the rug, not a plane under it: two coplanar layers a few
            // millimetres apart z-fight on a phone's depth buffer. Both sit on a polygon offset so they
            // always win over the floor.
            const cx = (x0 + x1 + 1) / 2 * CELL, cz = (y0 + y1 + 1) / 2 * CELL;
            const iw = w - 0.35, id = d - 0.35;
            const border = new THREE.Shape();
            border.moveTo(-w / 2, -d / 2); border.lineTo(w / 2, -d / 2); border.lineTo(w / 2, d / 2); border.lineTo(-w / 2, d / 2); border.lineTo(-w / 2, -d / 2);
            const hole = new THREE.Path();
            hole.moveTo(-iw / 2, -id / 2); hole.lineTo(-iw / 2, id / 2); hole.lineTo(iw / 2, id / 2); hole.lineTo(iw / 2, -id / 2); hole.lineTo(-iw / 2, -id / 2);
            border.holes.push(hole);
            const frameM = new THREE.MeshStandardMaterial({ color: 0x9a7030, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
            const frame = new THREE.Mesh(new THREE.ShapeGeometry(border), frameM);
            frame.rotation.x = -Math.PI / 2;
            frame.position.set(cx, 0.02, cz);
            frame.receiveShadow = true;
            root.add(frame);
            const rugM = TX.texMat(TX.rug, { repeat: [iw / 1.6, id / 1.6] });
            Object.assign(rugM, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
            const rug = new THREE.Mesh(new THREE.PlaneGeometry(iw, id), rugM);
            rug.rotation.x = -Math.PI / 2;
            rug.position.set(cx, 0.02, cz);
            rug.receiveShadow = true;
            root.add(rug);
        }
    }

    // ---------------- walls
    const walls = [];
    const wallTop = [];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        if (!isWall(at(x, y))) continue;
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy) || at(x + dx, y + dy) === '~') near = true;
        if (!near) continue;
        walls.push(mat4(centre(x, y).setY(H / 2)));
        if (theme === 'clinic') wallTop.push(mat4(centre(x, y).setY(0.55), 0, 0, new THREE.Vector3(1.05, 1, 1.05)));
    }
    root.add(instanced(new THREE.BoxGeometry(CELL, H, CELL), mats.wall, walls, true));
    if (wallTop.length) {
        root.add(instanced(new THREE.BoxGeometry(CELL, 1.1, CELL), TX.texMat(TX.planks, { color: 0x8a5a40, repeat: [1, 0.55] }), wallTop, false));
    }

    // ---------------- themed blockers and dressing
    let seed = 0;
    const addU = (o) => { if (o.userData.update) updaters.push(o); };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const ch = at(x, y);
        const c = centre(x, y);
        if (legendAt(mapId, ch)) continue;
        if (ch === 'o') { const p = pillar(theme); p.position.copy(c); root.add(p); addU(p); }
        else if (ch === 'T') { const t = tree(theme, seed++); t.position.copy(c); t.rotation.y = seed * 1.3; root.add(t); addU(t); }
    }
    // forest: trees growing on the cliff tops, grass and glowing mushrooms on the floor
    if (theme === 'forest') {
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            if (at(x, y) !== '#') continue;
            if (((x * 7 + y * 13) % 3) !== 0) continue;
            const t = tree('forest', x + y);
            t.position.copy(centre(x, y)).setY(H - 0.3);
            t.scale.setScalar(0.8);
            root.add(t);
        }
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            if (at(x, y) === ',' && (x * 3 + y * 5) % 4 === 0) { const mc = mushroomCluster(x + y); mc.position.copy(centre(x, y)).add(new THREE.Vector3(0.6, 0, -0.5)); root.add(mc); }
        }
    }
    if (theme === 'crypt' || theme === 'forge' || theme === 'clinic' || theme === 'citadel') {
        // lanterns and candles on walls facing open cells
        let k = 0;
        for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
            if (!open(x, y) || legendAt(mapId, at(x, y))) continue;
            for (const [dx, dy, ry] of [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]]) {
                if (at(x + dx, y + dy) !== '#') continue;
                if ((k++ % (theme === 'clinic' ? 5 : 4)) !== 0) continue;
                const c = centre(x, y).add(new THREE.Vector3(dx * (CELL / 2 - 0.05), 0, dy * (CELL / 2 - 0.05)));
                let o;
                if (theme === 'citadel' && k % 3 === 0) { o = banner(k % 2 ? 0x4a1a6a : 0x2a1a4a); o.position.copy(c).setY(H - 1.6); }
                else { o = wallLantern(theme === 'citadel' ? [1.4, 0.8, 2.2] : theme === 'crypt' ? [1.2, 1.8, 1.6] : [2.2, 1.3, 0.5]); o.position.copy(c).setY(2.2); }
                o.rotation.y = ry + Math.PI;
                root.add(o); addU(o);
            }
        }
    }
    if (theme === 'crypt') {
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            if (!open(x, y) || legendAt(mapId, at(x, y)) || (x * 11 + y * 7) % 6) continue;
            const g = new THREE.Group();
            for (let i = 0; i < 3; i++) { const f = flame(0.9); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12 + i * 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 })); s.position.set(i * 0.1, (0.12 + i * 0.08) / 2, (i % 2) * 0.08); f.position.set(i * 0.1, 0.12 + i * 0.08, (i % 2) * 0.08); g.add(s); g.add(f); updaters.push(f); }
            g.position.copy(centre(x, y)).add(new THREE.Vector3(0.7, 0, 0.7));
            root.add(g);
        }
    }
    if (theme === 'citadel') {
        for (let y = 2; y < Hh - 1; y += 4) for (let x = 3; x < W - 1; x += 6) {
            if (!open(x, y)) continue;
            const ch = chandelier(); ch.position.copy(centre(x, y)).setY(H - 1.6); root.add(ch); addU(ch);
        }
    }

    // ---------------- legend entities (props, chests, traps, gates, exits)
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const ch = at(x, y);
        const L = legendAt(mapId, ch);
        if (!L) continue;
        const c = centre(x, y);
        // face an open neighbour (the room side)
        let ry = 0;
        for (const [dx, dy, r] of [[0, 1, 0], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, -1, Math.PI]]) {
            const n = at(x + dx, y + dy);
            if (!isWall(n) && n !== '~' && !(legendAt(mapId, n)?.solid && n !== 'w')) { ry = r; break; }
        }
        let obj = null;
        switch (L.kind) {
            case 'prop': obj = PROPS[L.prop]?.(); break;
            case 'cot': obj = PROPS.cot(); break;
            case 'grimoire': obj = PROPS.grimoire(); break;
            case 'shop': obj = PROPS.shop(); break;
            case 'table': obj = PROPS.table(); break;
            case 'lens': obj = PROPS.lens(); break;
            case 'exit': obj = mapId === 'clinic' ? PROPS.door() : PROPS.cart(); break;
            case 'chest': obj = PROPS.chest(); break;
            case 'trap': obj = PROPS.trap(theme); break;
            case 'gate': obj = PROPS.gate(theme); break;
            case 'evidence': obj = PROPS.evidence(); break;
            default: break;
        }
        if (!obj) continue;
        obj.position.copy(c);
        obj.rotation.y = ry;
        // a gate that runs east–west across a north–south corridor
        if (L.kind === 'gate') obj.rotation.y = (at(x, y - 1) === '#' || at(x, y + 1) === '#') && at(x - 1, y) !== '#' ? Math.PI / 2 : 0;
        if (L.kind === 'gate' && at(x - 1, y) === 'G') obj.visible = true;
        root.add(obj);
        addU(obj);
        ents.set(`${x},${y}`, obj);
    }

    // ---------------- lights
    const lights = new THREE.Group();
    root.add(lights);
    lights.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
    const key = new THREE.DirectionalLight(T.key[0], T.key[1]);
    key.position.set(W * CELL * 0.3, 30, Hh * CELL * 0.2);
    key.target.position.set(W * CELL / 2, 0, Hh * CELL / 2);
    if (quality >= 2) {
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        const s = key.shadow.camera;
        s.left = -W * CELL * 0.7; s.right = W * CELL * 0.7; s.top = Hh * CELL * 0.7; s.bottom = -Hh * CELL * 0.7; s.near = 1; s.far = 80;
        key.shadow.bias = -0.0005;
        key.shadow.normalBias = 0.04;
    }
    lights.add(key, key.target);
    // point lights spread over the open floor, farthest-first
    const picks = [];
    const opens = [];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (open(x, y)) opens.push([x, y]);
    if (opens.length) picks.push(opens[Math.floor(opens.length / 2)]);
    while (picks.length < T.lights.max && opens.length) {
        let best = null, bd = -1;
        for (const o of opens) { const d = Math.min(...picks.map((p) => (p[0] - o[0]) ** 2 + (p[1] - o[1]) ** 2)); if (d > bd) { bd = d; best = o; } }
        picks.push(best);
    }
    for (const [x, y] of picks) {
        const pl = new THREE.PointLight(T.lights.color, T.lights.intensity, T.lights.dist * 1.4, 1.5);
        pl.position.copy(centre(x, y)).setY(Math.min(H - 0.6, 3));
        lights.add(pl);
    }
    // light shafts through the clinic windows / forest canopy
    if (theme === 'forest' || theme === 'citadel') {
        for (let i = 0; i < 4; i++) {
            const [x, y] = opens[Math.floor((i + 0.5) / 4 * opens.length)];
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.8, H * 2, 16, 1, true), shaftMaterial(theme === 'forest' ? 0xa0c8ff : 0xc0a0ff, 0.06));
            shaft.position.copy(centre(x, y)).setY(H);
            shaft.rotation.z = 0.2;
            shaft.renderOrder = 2;
            root.add(shaft);
        }
    }

    // ---------------- sky and particles
    if (T.sky) {
        const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), skyMaterial(T.sky[0], T.sky[1]));
        sky.position.set(W * CELL / 2, 0, Hh * CELL / 2);
        sky.frustumCulled = false;
        sky.renderOrder = -1;
        root.add(sky);
    }
    const bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(W * CELL, H, Hh * CELL));
    const parts = new Particles(T.particles, bounds, quality >= 1 ? 260 : 120);
    root.add(parts.points);

    return {
        root, ents, theme: T, themeId: theme,
        fog: new THREE.FogExp2(T.fog[0], T.fog[1]), bg: new THREE.Color(T.bg),
        update(t, states) {
            for (const o of updaters) o.userData.update(t, states.get(o) ?? null);
            parts.update(t);
        },
    };
}
