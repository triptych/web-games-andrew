// The battle diorama: a tiled floor, a backdrop of scenery and a mood (sky, fog, light) for each place a fight can happen.

import * as THREE from 'three';
import { Geo, G, cyl, cone, blob } from './geo.js';
import { TEX, buildAtlas, tileUV, tileRect, TS } from './texatlas.js';
import { Px } from './pixel.js';
import * as P from './props.js';
import { hash3 } from '../rng.js';

// one tile repeated: a separate small texture per floor
const floorTex = new Map();
export function floorTexture(atlasCanvasGetter, tile) {
    if (floorTex.has(tile)) return floorTex.get(tile);
    const atlas = atlasCanvasGetter();
    const { x: sx, y: sy } = tileRect(tile);
    const c = document.createElement('canvas'); c.width = c.height = TS * 2;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.drawImage(atlas, sx, sy, TS, TS, i * TS, j * TS, TS, TS);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    floorTex.set(tile, t);
    return t;
}

const R = (a, b, c) => hash3(a, b, c);

/** bg → { floor tile, scenery(g, em), mood, outdoor, extras } */
export const BIOMES = {
    grass: { floor: TEX.grass, outdoor: true, trees: 'oak', n: 9, scene: 'meadow' },
    plains: { floor: TEX.grass2, outdoor: true, trees: 'oak', n: 6, scene: 'meadow' },
    forest: { floor: TEX.woods, outdoor: true, trees: 'oak', n: 22, scene: 'forest', tint: 0.85 },
    woods: { floor: TEX.moss, outdoor: false, trees: 'oak', n: 22, scene: 'forest', mood: { top: 0x0e2a18, hor: 0x2a5a38, fog: 0x1a3a26, ambient: 0x7ab88a, ambientI: 0.9, sun: 1.1, sunColor: 0xcfffc0, sunDir: [0.3, 0.9, 0.5], shadow: true, stars: 0, cloud: 0.2, fogNear: 14, fogFar: 46, sunMul: 0.7, glow: 1.4 } },
    mountain: { floor: TEX.dirt, outdoor: true, scene: 'mountain' },
    coast: { floor: TEX.sand, outdoor: true, scene: 'coast' },
    desert: { floor: TEX.sand, outdoor: true, scene: 'desert' },
    snow: { floor: TEX.snow, outdoor: true, scene: 'snow' },
    ash: { floor: TEX.ash, outdoor: true, scene: 'ash' },
    volcano: { floor: TEX.lavarock, outdoor: true, scene: 'ash', lava: true },
    mines: { floor: TEX.dark, outdoor: false, scene: 'cave', mood: { top: 0x06060c, hor: 0x1a1a28, fog: 0x0e0e18, ambient: 0x6a6a88, ambientI: 0.8, sun: 0.9, sunColor: 0xffc890, sunDir: [0.3, 0.8, 0.6], shadow: true, fogNear: 12, fogFar: 40, sunMul: 0.5, glow: 1.7 }, wall: TEX.wallRock },
    temple: { floor: TEX.temple, outdoor: false, scene: 'temple', mood: { top: 0x06203a, hor: 0x1a5a7a, fog: 0x0a3048, ambient: 0x6ab8e8, ambientI: 1.0, sun: 1.0, sunColor: 0xa0e8ff, sunDir: [0.2, 0.9, 0.6], shadow: true, fogNear: 12, fogFar: 42, sunMul: 0.6, glow: 1.6 }, wall: TEX.wallCoral },
    pyramid: { floor: TEX.sandstone, outdoor: false, scene: 'temple', mood: { top: 0x1a1008, hor: 0x5a3a18, fog: 0x2a1a0a, ambient: 0xe8b870, ambientI: 0.9, sun: 1.1, sunColor: 0xffc070, sunDir: [0.3, 0.9, 0.5], shadow: true, fogNear: 12, fogFar: 42, sunMul: 0.6, glow: 1.6 }, wall: TEX.wallSand },
    glacier: { floor: TEX.icefloor, outdoor: false, scene: 'ice', mood: { top: 0x0a1a30, hor: 0x4a7aa0, fog: 0x1a3048, ambient: 0xa0d0ff, ambientI: 1.0, sun: 1.2, sunColor: 0xd0f0ff, sunDir: [0.2, 0.9, 0.6], shadow: true, fogNear: 12, fogFar: 44, sunMul: 0.7, glow: 1.5 }, wall: TEX.wallIce },
    spire: { floor: TEX.dark, outdoor: false, scene: 'spire', mood: { top: 0x080414, hor: 0x2a1850, fog: 0x100820, ambient: 0x8a6ad0, ambientI: 0.9, sun: 1.1, sunColor: 0xb090ff, sunDir: [0.2, 0.9, 0.6], shadow: true, fogNear: 12, fogFar: 44, stars: 0.8, sunMul: 0.6, glow: 1.8 }, wall: TEX.wallObs },
    maw: { floor: TEX.lavarock, outdoor: false, scene: 'ash', lava: true, mood: { top: 0x200606, hor: 0x6a2008, fog: 0x2a0a06, ambient: 0xff9a6a, ambientI: 0.9, sun: 1.2, sunColor: 0xff9a50, sunDir: [0.2, 0.9, 0.6], shadow: true, fogNear: 12, fogFar: 44, sunMul: 0.6, glow: 1.8 }, wall: TEX.wallBasalt },
    town: { floor: TEX.stone, outdoor: true, scene: 'town' },
    harbor: { floor: TEX.wood, outdoor: true, scene: 'coast' },
    chapel: { floor: TEX.temple, outdoor: false, scene: 'temple', mood: { top: 0x101428, hor: 0x4a5a8a, fog: 0x1a2038, ambient: 0xc8d0ff, ambientI: 1.0, sun: 1.2, sunColor: 0xfff0d0, sunDir: [0.2, 0.9, 0.6], shadow: true, fogNear: 12, fogFar: 40, sunMul: 0.7, glow: 1.6 }, wall: TEX.wallDark },
};

function ringScatter(n, seed, test) {
    const out = [];
    for (let i = 0; i < n * 6 && out.length < n; i++) {
        const x = (R(seed, i, 1) - 0.5) * 34, z = -2.5 - R(seed, i, 2) * 18;
        if (test && !test(x, z)) continue;
        out.push([x, z, i]);
    }
    return out;
}

export function buildScenery(bg, atlas, seed = 5) {
    const B = BIOMES[bg] || BIOMES.grass;
    const g = new Geo(), em = new Geo();
    const extra = new THREE.Group();
    const ground = (x, z) => 0;
    const side = (x, z) => Math.abs(x) > 6.5 || z < -5;
    const sceneName = B.scene;
    if (sceneName === 'meadow' || sceneName === 'forest') {
        const n = B.n * (sceneName === 'forest' ? 2 : 1.4);
        for (const [x, z, i] of ringScatter(Math.round(n * 2), seed, side)) {
            const big = R(seed, i, 7);
            if (R(seed, i, 3) < 0.7) P.oak(g, x, 0, z, seed + i, 1.1 + big * 0.9, sceneName === 'forest' ? 0x9ad084 : 0);
            else if (R(seed, i, 4) < 0.5) P.bush(g, x, 0, z, seed + i, 1.3);
            else P.rock(g, x, 0, z, seed + i, 1.3);
        }
        for (const [x, z, i] of ringScatter(10, seed + 9, (x, z) => z < -1)) em.add(G.ico0, { x, y: 0.25, z, s: 0.07, color: [0xff7ab0, 0xffe44a, 0xffffff][i % 3], tile: TEX.glass });
    } else if (sceneName === 'mountain') {
        for (const [x, z, i] of ringScatter(26, seed, side)) { if (R(seed, i, 3) < 0.55) P.spike(g, x, 0, z, seed + i, 2 + R(seed, i, 5) * 5, 0xe0e0ea, TEX.rock); else P.rock(g, x, 0, z, seed + i, 1.6); }
        for (const [x, z, i] of ringScatter(5, seed + 3, (x, z) => z < -9)) cone(g, { x, y: 0, z, r: 4.5, h: 9 + R(seed, i, 2) * 5, color: 0xd0d0e0, tile: TEX.rock, jitter: 0.08 });
    } else if (sceneName === 'coast') {
        for (const [x, z, i] of ringScatter(10, seed, (x, z) => side(x, z) && z > -9)) P.palm(g, x, 0, z, seed + i, 1.3);
        for (const [x, z, i] of ringScatter(8, seed + 1, side)) P.rock(g, x, 0, z, seed + i, 1.2, 0xf0e0b0, TEX.sand);
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshBasicMaterial({ color: 0x2a78c8 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, -26); sea.renderOrder = -1; extra.add(sea);
        for (let i = 0; i < 3; i++) cone(g, { x: -12 + i * 12, y: 0, z: -14, r: 0.01, h: 0.01, color: 0 });
    } else if (sceneName === 'desert') {
        for (const [x, z, i] of ringScatter(14, seed, side)) { if (R(seed, i, 3) < 0.5) P.cactus(g, x, 0, z, seed + i, 1.5); else P.rock(g, x, 0, z, seed + i, 1.4, 0xf0d8a0, TEX.sand); }
        for (const [x, z, i] of ringScatter(6, seed + 2, (x, z) => z < -8)) blob(g, { x, y: -1, z, ax: 9, ay: 3 + R(seed, i, 2) * 2, az: 5, color: 0xe8cf8c, tile: TEX.sand, jitter: 0.03 });
    } else if (sceneName === 'snow') {
        for (const [x, z, i] of ringScatter(24, seed, side)) P.pine(g, x, 0, z, seed + i, 1.2 + R(seed, i, 5) * 1.0, true);
        for (const [x, z, i] of ringScatter(6, seed + 4, side)) P.rock(g, x, 0, z, seed + i, 1.3, 0xffffff, TEX.snow);
    } else if (sceneName === 'ash') {
        for (const [x, z, i] of ringScatter(14, seed, side)) { if (R(seed, i, 3) < 0.5) P.spike(g, x, 0, z, seed + i, 1.5 + R(seed, i, 5) * 3, 0x9a8a8a, TEX.lavarock); else P.rock(g, x, 0, z, seed + i, 1.4, 0xa09090, TEX.lavarock); }
        for (const [x, z, i] of ringScatter(5, seed + 5, (x, z) => z < -6)) { const lava = new THREE.Mesh(new THREE.PlaneGeometry(4 + R(seed, i, 2) * 4, 1.6), new THREE.MeshBasicMaterial({ color: 0xff6a20, toneMapped: false })); lava.rotation.x = -Math.PI / 2; lava.position.set(x, 0.03, z); extra.add(lava); }
    } else if (sceneName === 'cave') {
        for (const [x, z, i] of ringScatter(18, seed, side)) { if (R(seed, i, 3) < 0.5) P.rock(g, x, 0, z, seed + i, 1.8, 0xb8b8c8, TEX.rock); else P.deco(g, em, { x: Math.round(x), y: Math.round(z), seed: seed + i, kind: ['crate', 'cart', 'pillar'][i % 3] }, 0, {}); }
        for (const x of [-9, 0, 9]) { for (const dx of [-3, 3]) g.add(G.box, { x: x + dx, y: 3, z: -13, sx: 4, sy: 6, sz: 1.5, color: 0x4a4a58, tile: TEX.wallRock, jitter: 0.1 }); }
    } else if (sceneName === 'temple') {
        for (const x of [-9, -5.5, 5.5, 9]) { cyl(g, { x, y: 0, z: -5, r: 0.55, h: 5, color: B.floor === TEX.sandstone ? 0xe0c486 : 0xb8d8e0, tile: B.floor }); g.add(G.box, { x, y: 5, z: -5, sx: 1.4, sy: 0.4, sz: 1.4, color: B.floor === TEX.sandstone ? 0xf0d498 : 0xd8f0f4, tile: B.floor }); }
        g.add(G.box, { x: 0, y: 5.5, z: -5, sx: 22, sy: 0.7, sz: 1.2, color: B.floor === TEX.sandstone ? 0xe0c486 : 0xb8d8e0, tile: B.floor });
        g.add(G.box, { x: 0, y: 3, z: -12, sx: 40, sy: 6, sz: 1, color: 0x6a6a6a, tile: B.wall ?? TEX.wallDark, jitter: 0.1 });
        for (const x of [-7.5, 7.5]) { em.add(G.cone6, { x, y: 1.1, z: -3.5, sx: 0.25, sy: 0.7, sz: 0.25, color: 0xff9a30, tile: TEX.glass }); g.add(G.cyl8, { x, y: 0.5, z: -3.5, sx: 0.25, sy: 1, sz: 0.25, color: 0x3a3440, tile: TEX.trim }); }
    } else if (sceneName === 'ice') {
        for (const [x, z, i] of ringScatter(20, seed, side)) { em.add(G.oct, { x, y: 0.9 + R(seed, i, 2), z, sx: 0.35, sy: 1.2 + R(seed, i, 3) * 1.6, sz: 0.35, rz: (R(seed, i, 4) - 0.5) * 0.5, color: [0x9fe8ff, 0x7fc8ff, 0xcff4ff][i % 3], tile: TEX.glass }); }
        for (const [x, z, i] of ringScatter(10, seed + 2, side)) cone(g, { x, y: 0, z, r: 0.5, h: 2 + R(seed, i, 2) * 3, color: 0xc8f0ff, tile: TEX.ice });
        g.add(G.box, { x: 0, y: 4, z: -12, sx: 40, sy: 8, sz: 1, color: 0x7ab8d8, tile: TEX.wallIce, jitter: 0.1 });
    } else if (sceneName === 'spire') {
        for (const x of [-9, -5, 5, 9]) { g.add(G.box, { x, y: 3.5, z: -5.5, sx: 1.2, sy: 7, sz: 1.2, color: 0x241f3a, tile: TEX.wallObs }); em.add(G.oct, { x, y: 7.6, z: -5.5, sx: 0.3, sy: 0.6, sz: 0.3, color: 0xc08aff, tile: TEX.glass }); }
        for (const [x, z, i] of ringScatter(8, seed, side)) em.add(G.oct, { x, y: 0.7, z, sx: 0.25, sy: 0.9 + R(seed, i, 2), sz: 0.25, color: 0x9a60ff, tile: TEX.glass });
        g.add(G.box, { x: 0, y: 5, z: -12, sx: 40, sy: 10, sz: 1, color: 0x14102a, tile: TEX.wallObs, jitter: 0.08 });
    } else if (sceneName === 'town') {
        const roofs = [0xb84a3a, 0x4a6a9a, 0xc8683a];
        [[-9, -6], [-4, -8], [4, -7], [9, -6]].forEach(([x, z], i) => P.building(g, em, { x: x - 2.5, y: z - 2, w: 5, h: 4, door: [x, z + 2], roof: roofs[i % 3], wall: 0xf0e4cc, seed: seed + i, kind: 'house', floors: 1 + (i % 2) }, 0));
        for (const x of [-7, 7]) P.lamp(g, em, x, 0, -3.5);
    }
    // all sceneries get a few floating motes handled by the director
    return { geo: g, em, extra, B };
}
