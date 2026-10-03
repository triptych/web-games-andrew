/**
 * terrain.js — the procedural battlefield for each region.
 *
 * Ground painted on a canvas (noise, flowers, ash, snow…), a PvZ-style lane
 * checker of tiles (the bailey's columns trimmed and lighter, worn paths
 * where the monsters walk), a fence that marks the edge of the bailey,
 * scenery scattered from a seed and merged into one mesh per region (trees,
 * rocks, ruins, gravestones, ice spires, basalt…), distant mountain ridges,
 * and animated water or lava where the biome wants it.
 */

import * as THREE from 'three';
import { Parts, actorMaterial, GLOW_MAT, darker, lighter } from './models.js';
import { makeRng, hashSeed } from '../sim/rng.js';
import { REGIONS, LANES, LANE_W, laneZ } from '../config.js';

const COLS = 10;

function paintGround(R, rng) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = R.ground[0];
    g.fillRect(0, 0, 512, 512);
    const base = new THREE.Color(R.ground[0]);
    for (let i = 0; i < 1400; i++) {
        const x = rng.next() * 512, y = rng.next() * 512, r = 6 + rng.next() * 22;
        const k = 0.88 + rng.next() * 0.22;
        g.fillStyle = `rgba(${Math.round(base.r * 255 * k)},${Math.round(base.g * 255 * k)},${Math.round(base.b * 255 * k)},0.22)`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const spots = {
        greenmarch: ['#f0e86a', '#ffffff', '#e86a8a', '#8ac8ff'], mirefen: ['#3a4a2a', '#5a6a3a', '#2a3a2a'],
        ashen: ['#1a1414', '#5a2a1a', '#ff6a1a'], frostfell: ['#ffffff', '#d0e0f0', '#c0d8ec'],
        gloamhold: ['#2a2a24', '#4a5a3a', '#3a3a3a'], dragonspire: ['#1a1010', '#4a1a10', '#ff4a1a'],
    }[R.id];
    for (let i = 0; i < 260; i++) {
        g.fillStyle = spots[i % spots.length];
        g.globalAlpha = R.id === 'greenmarch' ? 0.7 : 0.35;
        const x = rng.next() * 512, y = rng.next() * 512;
        const s = R.id === 'greenmarch' ? 2 : 3 + rng.next() * 6;
        g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 5);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** Lane tiles: one merged mesh, colours rewritten when the bailey changes. */
function makeTiles(R) {
    const geo = new THREE.BoxGeometry(0.96, 0.04, LANE_W * 0.96).toNonIndexed();
    const per = geo.attributes.position.count;
    const parts = [];
    for (let lane = 0; lane < LANES; lane++) for (let col = 0; col < COLS; col++) {
        const g = geo.clone();
        g.translate(col + 0.5, 0.01, laneZ(lane));
        parts.push(g);
    }
    const pos = new Float32Array(parts.length * per * 3);
    const nor = new Float32Array(parts.length * per * 3);
    parts.forEach((g, i) => { pos.set(g.attributes.position.array, i * per * 3); nor.set(g.attributes.normal.array, i * per * 3); });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(new Float32Array(parts.length * per * 3), 3));
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    mesh.receiveShadow = true;
    const a = new THREE.Color(R.ground[0]), b = new THREE.Color(R.ground[1]), path = new THREE.Color(R.path);
    mesh.userData.paint = (bailey) => {
        const col = merged.attributes.color;
        const c = new THREE.Color();
        for (let lane = 0; lane < LANES; lane++) for (let x = 0; x < COLS; x++) {
            const i = lane * COLS + x;
            c.copy((lane + x) % 2 ? a : b);
            if (x < bailey) c.offsetHSL(0.01, 0.04, 0.05);
            else c.lerp(path, 0.28 + 0.08 * ((x * 7 + lane * 3) % 3));
            for (let v = 0; v < per; v++) col.setXYZ(i * per + v, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
    };
    return mesh;
}

// ------------------------------------------------------------------ Scenery props

function tree(P, rng, x, z, s, kind, R) {
    switch (kind) {
        case 'oak': {
            P.cyl('#6a4a2a', [x, 0.5 * s, z], [0.12 * s, 1.0 * s, 0.12 * s]);
            const cc = ['#4a8a2a', '#5a9a34', '#3e7a24'];
            for (let i = 0; i < 4; i++) P.add('ico', rng.pick(cc), [x + rng.range(-0.35, 0.35) * s, (1.2 + rng.range(0, 0.5)) * s, z + rng.range(-0.35, 0.35) * s], [0.55 * s, 0.45 * s, 0.55 * s]);
            break;
        }
        case 'pine': {
            const snow = R.id === 'frostfell';
            P.cyl('#5a3a2a', [x, 0.3 * s, z], [0.08 * s, 0.6 * s, 0.08 * s]);
            for (let i = 0; i < 3; i++) {
                P.cone(snow ? '#2a5a5a' : '#2e5a2a', [x, (0.75 + i * 0.45) * s, z], [(0.6 - i * 0.14) * s, 0.8 * s, (0.6 - i * 0.14) * s]);
                if (snow) P.cone('#f4f8fc', [x, (0.95 + i * 0.45) * s, z], [(0.34 - i * 0.08) * s, 0.35 * s, (0.34 - i * 0.08) * s]);
            }
            break;
        }
        case 'willow': {
            P.cyl('#4a3a2a', [x, 0.6 * s, z], [0.13 * s, 1.2 * s, 0.13 * s], [0, 0, rng.range(-0.15, 0.15)]);
            P.add('ico', '#5a6a2a', [x, 1.5 * s, z], [0.7 * s, 0.4 * s, 0.7 * s]);
            for (let i = 0; i < 7; i++) { const a = i * 0.9; P.cone('#6a7a3a', [x + Math.cos(a) * 0.55 * s, 1.0 * s, z + Math.sin(a) * 0.55 * s], [0.14 * s, 0.9 * s, 0.14 * s], [Math.PI, 0, 0]); }
            break;
        }
        case 'dead': {
            const c = R.id === 'gloamhold' ? '#3a3430' : R.id === 'ashen' || R.id === 'dragonspire' ? '#1e1a18' : '#5a4a3a';
            P.limb(c, [x, 0, z], [x + rng.range(-0.2, 0.2), 1.3 * s, z], 0.09 * s, 'cone');
            for (let i = 0; i < 4; i++) {
                const y = (0.5 + i * 0.22) * s, a = rng.range(0, 6.28);
                P.limb(c, [x, y, z], [x + Math.cos(a) * 0.5 * s, y + 0.35 * s, z + Math.sin(a) * 0.5 * s], 0.035 * s, 'cone');
            }
            break;
        }
    }
}

function scatterScenery(R, rng) {
    const P = new Parts(hashSeed(rng.int(0, 1e6)));
    const place = [];
    // Background band behind lane 0, foreground band in front of lane 4 (kept low), the far right edge.
    for (let i = 0; i < 70; i++) place.push({ x: rng.range(-8, 18), z: rng.range(-12, -3.6), s: rng.range(0.8, 1.5), band: 'back' });
    for (let i = 0; i < 22; i++) place.push({ x: rng.range(-6, 16), z: rng.range(3.7, 7), s: rng.range(0.5, 0.85), band: 'front' });
    for (let i = 0; i < 26; i++) place.push({ x: rng.range(11.6, 18), z: rng.range(-3.3, 3.3), s: rng.range(0.7, 1.2), band: 'edge' });
    for (const p of place) {
        if (p.x < -1.5 && p.band !== 'back') continue; // keep the castle clear
        if (p.band === 'edge' && Math.abs(p.z) < 3 && p.x < 12.4) continue;
        const r = rng.next();
        switch (R.id) {
            case 'greenmarch':
                if (r < 0.45) tree(P, rng, p.x, p.z, p.s, 'oak', R);
                else if (r < 0.65) tree(P, rng, p.x, p.z, p.s, 'pine', R);
                else if (r < 0.85) P.add('ico', rng.pick(['#4a7a2a', '#5a8a3a']), [p.x, 0.2 * p.s, p.z], [0.4 * p.s, 0.3 * p.s, 0.4 * p.s]);
                else P.add('dod', '#8a8680', [p.x, 0.2 * p.s, p.z], [0.35 * p.s, 0.3 * p.s, 0.3 * p.s], [0, rng.range(0, 3), 0]);
                break;
            case 'mirefen':
                if (r < 0.4) tree(P, rng, p.x, p.z, p.s, 'willow', R);
                else if (r < 0.6) tree(P, rng, p.x, p.z, p.s, 'dead', R);
                else if (r < 0.85) for (let k = 0; k < 6; k++) P.limb(rng.pick(['#6a7a3a', '#5a6a2a']), [p.x + rng.range(-0.2, 0.2), 0, p.z + rng.range(-0.2, 0.2)], [p.x + rng.range(-0.3, 0.3), rng.range(0.4, 0.8) * p.s, p.z + rng.range(-0.3, 0.3)], 0.025, 'cone');
                else { P.cyl('#d8c8a8', [p.x, 0.1, p.z], [0.03, 0.2, 0.03]); P.add('sph', '#c84a3a', [p.x, 0.22, p.z], [0.12, 0.06, 0.12]); P.sph('#a8ff6a', [p.x + 0.05, 0.25, p.z], [0.02, 0.02, 0.02], [0, 0, 0], { glow: true }); }
                break;
            case 'ashen':
                if (r < 0.45) for (let k = 0; k < 4; k++) P.add('cyl6', k % 2 ? '#2a2628' : '#3a3434', [p.x + rng.range(-0.3, 0.3), 0.5 * p.s, p.z + rng.range(-0.3, 0.3)], [0.18 * p.s, rng.range(0.6, 1.6) * p.s, 0.18 * p.s]);
                else if (r < 0.7) tree(P, rng, p.x, p.z, p.s, 'dead', R);
                else P.add('dod', rng.pick(['#3a3030', '#4a3a34']), [p.x, 0.25 * p.s, p.z], [0.45 * p.s, 0.35 * p.s, 0.4 * p.s], [0, rng.range(0, 3), 0]);
                if (rng.chance(0.2)) P.add('oct', '#ff6a1a', [p.x + 0.3, 0.05, p.z], [0.1, 0.05, 0.1], [0, 0, 0], { glow: true });
                break;
            case 'frostfell':
                if (r < 0.5) tree(P, rng, p.x, p.z, p.s, 'pine', R);
                else if (r < 0.75) for (let k = 0; k < 3; k++) P.add('oct', k ? '#bfe6ff' : '#8fd0f0', [p.x + rng.range(-0.3, 0.3), 0.5 * p.s, p.z + rng.range(-0.3, 0.3)], [0.18 * p.s, rng.range(0.6, 1.4) * p.s, 0.18 * p.s], [rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)]);
                else P.sph('#f4f8fc', [p.x, 0.05, p.z], [0.7 * p.s, 0.22 * p.s, 0.55 * p.s]);
                break;
            case 'gloamhold':
                if (r < 0.35) tree(P, rng, p.x, p.z, p.s, 'dead', R);
                else if (r < 0.75) {
                    P.box('#6a6a70', [p.x, 0.3 * p.s, p.z], [0.1, 0.55 * p.s, 0.34 * p.s], [0, rng.range(-0.3, 0.3), rng.range(-0.15, 0.15)]);
                    if (rng.chance(0.4)) P.sph('#8aff8a', [p.x + 0.12, 0.08, p.z], [0.03, 0.05, 0.03], [0, 0, 0], { glow: true });
                } else {
                    P.box('#4a4a50', [p.x, 0.5 * p.s, p.z], [0.9 * p.s, 1.0 * p.s, 0.9 * p.s]);
                    P.cone('#3a3a40', [p.x, 1.25 * p.s, p.z], [0.75 * p.s, 0.55 * p.s, 0.75 * p.s], [0, 0.78, 0]);
                    P.box('#1a1a1a', [p.x + 0.46 * p.s, 0.35 * p.s, p.z], [0.02, 0.5 * p.s, 0.3 * p.s]);
                }
                break;
            case 'dragonspire':
                if (r < 0.5) P.add('cone4', rng.pick(['#1a1416', '#2a2024']), [p.x, 1.0 * p.s, p.z], [0.35 * p.s, rng.range(1.5, 3.2) * p.s, 0.35 * p.s], [0, rng.range(0, 3), rng.range(-0.1, 0.1)]);
                else if (r < 0.7) for (let k = 0; k < 5; k++) P.add('tor', '#d8d0b8', [p.x + k * 0.18, 0.3 * p.s, p.z], [0.35 * p.s, 0.35 * p.s, 0.35 * p.s], [0, Math.PI / 2, 0]);
                else P.add('dod', '#2a2222', [p.x, 0.25 * p.s, p.z], [0.4 * p.s, 0.3 * p.s, 0.4 * p.s]);
                if (rng.chance(0.25)) P.add('oct', '#ff4a1a', [p.x - 0.3, 0.04, p.z], [0.14, 0.04, 0.08], [0, rng.range(0, 3), 0], { glow: true });
                break;
        }
    }
    // Region set pieces
    if (R.id === 'greenmarch') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; P.box('#8a8a84', [14 + Math.cos(a) * 1.4, 0.7, -6 + Math.sin(a) * 1.4], [0.35, 1.4, 0.5], [0, -a, 0]); }
    if (R.id === 'gloamhold') for (let x = -1; x < 11; x += 0.5) P.box('#2a2a2e', [x, 0.35, -3.5], [0.03, 0.7, 0.03]);
    return P.build();
}

function mountains(R, rng) {
    const P = new Parts(91);
    const col = new THREE.Color(R.fog).lerp(new THREE.Color(R.sky.top), 0.25);
    for (let layer = 0; layer < 2; layer++) {
        const dist = layer ? 62 : 44;
        const c = '#' + col.clone().multiplyScalar(layer ? 0.95 : 0.78).getHexString();
        for (let i = 0; i < 26; i++) {
            const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9 + rng.range(-0.03, 0.03);
            const h = rng.range(6, 15) * (layer ? 1.3 : 1) * (R.id === 'frostfell' || R.id === 'dragonspire' ? 1.3 : R.id === 'mirefen' ? 0.6 : 1);
            const x = 3 + Math.cos(a) * dist, z = Math.sin(a) * dist;
            P.add(R.id === 'dragonspire' ? 'cone4' : 'cone', c, [x, h / 2 - 1, z], [rng.range(6, 11), h, rng.range(6, 11)], [0, rng.range(0, 3), 0], { rough: 0.04 });
            if (R.id === 'frostfell' || (R.id === 'greenmarch' && h > 12)) P.add('cone', '#f4f8fc', [x, h - 1 - h * 0.12, z], [2.2, h * 0.25, 2.2]);
        }
    }
    return P.build();
}

function waterPlane(R) {
    if (R.id === 'mirefen' || R.id === 'frostfell' || R.id === 'greenmarch') {
        const color = R.id === 'mirefen' ? '#2a4a3a' : R.id === 'frostfell' ? '#bfe0f4' : '#3a7ab8';
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color, roughness: R.id === 'frostfell' ? 0.15 : 0.05, metalness: 0.2, transparent: R.id !== 'frostfell', opacity: 0.85 }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(R.id === 'greenmarch' ? 6 : 4, 0.02, -6.5);
        m.scale.set(R.id === 'greenmarch' ? 3.5 : 6, 2.2, 1);
        m.receiveShadow = true;
        return m;
    }
    if (R.id === 'ashen' || R.id === 'dragonspire') {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 64, 64);
        grd.addColorStop(0, '#b8240a'); grd.addColorStop(0.5, '#ff7a1a'); grd.addColorStop(1, '#b8240a');
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(40,6,0,0.7)'; g.fillRect((i * 37) % 64, (i * 23) % 64, 9, 4); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 1); t.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 1.1), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: 0xbbbbbb }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(4, 0.03, -10.5);
        m.userData.lava = t;
        return m;
    }
    return null;
}

/** The fence posts that mark the edge of the bailey. */
function baileyFence(bailey, R) {
    const P = new Parts(5);
    const wood = R.id === 'frostfell' ? '#6a5a4a' : R.id === 'gloamhold' ? '#3a3a40' : '#7a5a3a';
    for (let lane = 0; lane <= LANES; lane++) {
        const z = (lane - LANES / 2) * LANE_W;
        P.cyl(wood, [bailey + 0.02, 0.2, z], [0.04, 0.4, 0.04]);
        P.cone(lighter(wood), [bailey + 0.02, 0.44, z], [0.045, 0.08, 0.045]);
        if (lane < LANES) P.box('#c83a3a', [bailey + 0.02, 0.32, z + LANE_W / 2], [0.02, 0.06, 0.18]);
    }
    return P.build();
}

export function buildTerrain(regionIdx, seed, obstacles, obstacleModel) {
    const R = REGIONS[regionIdx];
    const rng = makeRng(hashSeed(seed, regionIdx, 77));
    const group = new THREE.Group();
    const gtex = paintGround(R, rng);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(3, 0, 0);
    ground.receiveShadow = true;
    group.add(ground);
    const tiles = makeTiles(R);
    group.add(tiles);
    const mat = actorMaterial({ rough: 0.9 });
    const sc = scatterScenery(R, rng);
    if (sc.solid) { const m = new THREE.Mesh(sc.solid, mat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    if (sc.glow) group.add(new THREE.Mesh(sc.glow, GLOW_MAT));
    const mt = mountains(R, rng);
    const mm = new THREE.Mesh(mt.solid, actorMaterial({ rough: 1 }));
    group.add(mm);
    const water = waterPlane(R);
    if (water) group.add(water);
    const obs = new THREE.Group();
    for (const o of obstacles) {
        const m = obstacleModel(o.kind);
        m.position.set(o.col + 0.5, 0.02, laneZ(o.lane));
        m.rotation.y = o.rot;
        m.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
        obs.add(m);
    }
    group.add(obs);
    let fence = null;
    const api = {
        group, region: R,
        setBailey(n) {
            tiles.userData.paint(n);
            if (fence) { group.remove(fence); fence.geometry.dispose(); }
            const b = baileyFence(n, R);
            fence = new THREE.Mesh(b.solid, mat);
            fence.castShadow = true;
            group.add(fence);
        },
        update(t) {
            if (water?.userData.lava) water.userData.lava.offset.x = t * 0.05;
        },
        dispose() {
            group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
            gtex.dispose();
        },
    };
    return api;
}
