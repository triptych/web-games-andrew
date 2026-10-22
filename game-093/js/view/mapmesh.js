// Turns a map into geometry: stepped terrain columns with cliff faces and baked ambient occlusion, a cutaway for dungeon walls,
// animated water and lava, thousands of swaying grass tufts, and every static prop merged into one mesh per chunk.

import * as THREE from 'three';
import { T, WALKABLE } from '../sim/world/tiles.js';
import { LEVEL_H } from '../config.js';
import { LOCS, ZONE_KEYS } from '../sim/world/locations.js';
import { TEX, tileUV, tuftTexture } from './texatlas.js';
import { Geo, G as UG } from './geo.js';
import * as P from './props.js';
import { hash3 } from '../rng.js';
import { dungeonTheme } from '../sim/world/dungeon.js';

const CH = 16;
const FLOOR_TEX = {
    [T.GRASS]: [TEX.grass, TEX.grass2, TEX.grass3], [T.FLOWERS]: [TEX.flowers], [T.FOREST]: [TEX.forest], [T.WOODS]: [TEX.woods], [T.SAND]: [TEX.sand, TEX.sand2], [T.SNOW]: [TEX.snow, TEX.snow2],
    [T.ROCK]: [TEX.rock], [T.DIRT]: [TEX.dirt, TEX.dirt2], [T.STONE]: [TEX.stone, TEX.stone2], [T.WOOD]: [TEX.wood], [T.ICE]: [TEX.ice], [T.SWAMP]: [TEX.swamp], [T.ASH]: [TEX.ash],
    [T.BRICK]: [TEX.brick], [T.CARPET]: [TEX.carpet], [T.DARK]: [TEX.dark, TEX.dark2], [T.MOSS]: [TEX.moss], [T.TEMPLE]: [TEX.temple], [T.SANDSTONE]: [TEX.sandstone], [T.ICEFLOOR]: [TEX.icefloor],
    [T.WALL]: [TEX.walltop], [T.BRIDGE]: [TEX.bridge], [T.DEEP]: [TEX.bed], [T.SHALLOW]: [TEX.bedsand], [T.LAVA]: [TEX.lavarock],
};
const WALL_TINT = { rock: [0.95, 0.95, 1.1], hedge: [0.45, 0.75, 0.45], coral: [0.5, 0.9, 1.0], sandstone: [1.1, 0.92, 0.62], ice: [0.75, 0.92, 1.15], obsidian: [0.7, 0.55, 1.1], basalt: [1.05, 0.6, 0.5] };
const WALL_TEX = { rock: TEX.wallRock, hedge: TEX.wallHedge, coral: TEX.wallCoral, sandstone: TEX.wallSand, ice: TEX.wallIce, obsidian: TEX.wallObs, basalt: TEX.wallBasalt };
const cliffFor = (t) => (t === T.SAND || t === T.SANDSTONE ? TEX.cliffSand : t === T.SNOW || t === T.ICE || t === T.ICEFLOOR ? TEX.cliffIce : t === T.ROCK || t === T.ASH || t === T.DARK || t === T.TEMPLE || t === T.LAVA || t === T.STONE || t === T.BRICK || t === T.MOSS ? TEX.cliffRock : TEX.cliffEarth);

const SEA = -0.55;
export const WATER_Y = 0.2;

export function buildMap(map, atlas, opts = {}) {
    const W = map.w, H = map.h;
    const th = map.kind === 'dungeon' ? dungeonTheme(map.id) : null;
    const wallTexBase = th ? WALL_TEX[th.wall] ?? TEX.wallDark : TEX.wallDark;
    const hAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : map.hgt[y * W + x]);
    const tAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.ROCK : map.tile[y * W + x]);
    // wall heights come from the floors beside them
    const wallTop = new Float32Array(W * H), wallCut = new Float32Array(W * H);
    if (map.kind === 'dungeon') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (map.tile[y * W + x] !== T.WALL) continue;
            let mx = -1, mn = 99;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = tAt(x + dx, y + dy); if (t !== T.WALL && t !== T.ROCK) { const hh = hAt(x + dx, y + dy); mx = Math.max(mx, hh); mn = Math.min(mn, hh); } }
            wallTop[y * W + x] = mx < 0 ? 4 * LEVEL_H : (mx + 3.2) * LEVEL_H;
            wallCut[y * W + x] = mn > 90 ? 0.4 : mn * LEVEL_H + 0.2;
        }
    }
    const topY = (x, y) => {
        const t = tAt(x, y), h = hAt(x, y);
        if (h === null) return SEA;
        if (t === T.DEEP) return -0.45;
        if (t === T.SHALLOW) return -0.12;
        if (t === T.LAVA) return h * LEVEL_H - 0.12;
        if (t === T.WALL) return wallTop[y * W + x];
        return h * LEVEL_H;
    };

    const chunks = new Map();
    const chunk = (x, y) => {
        const k = (x >> 4) + ',' + (y >> 4);
        let c = chunks.get(k);
        if (!c) { c = { pos: [], nor: [], uv: [], col: [], cut: [], idx: 0, wpos: [], wsh: [], lpos: [], geo: new Geo(), em: new Geo(), cx: x >> 4, cy: y >> 4 }; chunks.set(k, c); }
        return c;
    };
    const quad = (c, p0, p1, p2, p3, n, uvr, cols, cutv) => {
        // p0..p3 counter-clockwise seen from the normal side; uv u0v0 at p0, u1v0 at p1, u1v1 at p2, u0v1 at p3
        const base = c.idx;
        for (let i = 0; i < 4; i++) { const p = [p0, p1, p2, p3][i]; c.pos.push(p[0], p[1], p[2]); c.nor.push(n[0], n[1], n[2]); const col = cols[i]; c.col.push(col[0], col[1], col[2]); c.cut.push(cutv); }
        c.uv.push(uvr.u0, uvr.v0, uvr.u1, uvr.v0, uvr.u1, uvr.v1, uvr.u0, uvr.v1);
        c.idx += 4;
        (c.ind || (c.ind = [])).push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, t = map.tile[i], c = chunk(x, y);
        const top = topY(x, y);
        const vh = hash3(x, y, 77);
        const variants = FLOOR_TEX[t] || [TEX.grass];
        let tile = variants[Math.floor(hash3(x, y, 5) * variants.length)];
        if (t === T.WALL) tile = TEX.walltop;
        const tint = 0.94 + vh * 0.1;
        // ambient occlusion: a corner darkens for each higher neighbour touching it
        const higher = (dx, dy) => { const hh = topY(x + dx, y + dy); return hh > top + 0.05 && tAt(x + dx, y + dy) !== T.DEEP; };
        const ao = (a, b, d) => 1 - 0.13 * ((a ? 1 : 0) + (b ? 1 : 0) + (d && !a && !b ? 1 : 0));
        const n = higher(0, -1), s = higher(0, 1), w = higher(-1, 0), e = higher(1, 0);
        const cNW = ao(n, w, higher(-1, -1)) * tint, cNE = ao(n, e, higher(1, -1)) * tint, cSE = ao(s, e, higher(1, 1)) * tint, cSW = ao(s, w, higher(-1, 1)) * tint;
        const cut = t === T.WALL ? wallCut[i] : -1000;
        const rc = tileUV(tile);
        // snow/dust tint by region is baked into the textures; the sea bed is blue
        const wt = t === T.WALL ? (WALL_TINT[th?.wall] || [1, 1, 1]) : [1, 1, 1];
        const tr = (v) => [v * wt[0], v * wt[1], v * wt[2]];
        quad(c, [x, top, y + 1], [x + 1, top, y + 1], [x + 1, top, y], [x, top, y], [0, 1, 0], rc, [tr(cSW), tr(cSE), tr(cNE), tr(cNW)], cut);
        // cliffs and walls
        const sides = [[0, 1, [x, y + 1], [x + 1, y + 1], [0, 0, 1], 1.0], [1, 0, [x + 1, y + 1], [x + 1, y], [1, 0, 0], 0.86], [0, -1, [x + 1, y], [x, y], [0, 0, -1], 0.7], [-1, 0, [x, y], [x, y + 1], [-1, 0, 0], 0.8]];
        for (const [dx, dy, a, b, nrm, shade] of sides) {
            const nt = topY(x + dx, y + dy), ntt = tAt(x + dx, y + dy);
            let bottom = nt;
            if (t === T.WALL && ntt === T.WALL) continue;
            if (ntt === T.WALL && t !== T.WALL) continue;
            if (bottom >= top - 0.001) continue;
            if (t === T.DEEP || t === T.SHALLOW) continue;
            const isWall = t === T.WALL;
            const ctile = isWall ? wallTexBase : cliffFor(t);
            const sideTr = (v) => (isWall ? [v * (WALL_TINT[th?.wall]?.[0] ?? 1) * 1.25, v * (WALL_TINT[th?.wall]?.[1] ?? 1) * 1.25, v * (WALL_TINT[th?.wall]?.[2] ?? 1) * 1.25] : [v, v, v]);
            const steps = Math.max(1, Math.round((top - bottom) / LEVEL_H));
            const rr = tileUV(ctile), vm = (rr.v1 - rr.v0);
            for (let k = 0; k < steps; k++) {
                const y1 = top - k * (top - bottom) / steps, y0 = top - (k + 1) * (top - bottom) / steps;
                const f1 = shade * (isWall ? 1 : 1 - 0.04 * k), f0 = shade * (isWall ? 1 : 1 - 0.04 * (k + 1)) * (k === steps - 1 && !isWall ? 0.78 : 1);
                const half = { u0: rr.u0, u1: rr.u1, v0: rr.v0, v1: rr.v0 + vm * 0.5 };
                quad(c, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], nrm, half, [sideTr(f0), sideTr(f0), sideTr(f1), sideTr(f1)], isWall ? wallCut[i] : -1000);
            }
        }
        // water and lava surfaces
        if (t === T.DEEP || t === T.SHALLOW) {
            let shore = 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nt = tAt(x + dx, y + dy); if (nt !== T.DEEP && nt !== T.SHALLOW && nt !== T.BRIDGE) shore = 1; }
            const sh = t === T.SHALLOW ? 0.5 + shore * 0.5 : shore;
            c.wpos.push(x, 0, y + 1, x + 1, 0, y + 1, x + 1, 0, y, x, 0, y, sh, t === T.DEEP ? 1 : 0.25);
        } else if (t === T.LAVA) c.lpos.push(x, top + 0.07, y + 1, x + 1, top + 0.07, y + 1, x + 1, top + 0.07, y, x, top + 0.07, y);
    }

    // ---- props
    const gyAt = (x, y) => (hAt(Math.floor(x), Math.floor(y)) ?? 0) * LEVEL_H;
    const dyn = [];   // props that change or move are handled by the view
    const zoneOf = (x, y) => (map.zone ? ZONE_KEYS[map.zone[y * W + x]] : null);
    const lightsOut = [...(map.lights || [])];
    if (map.kind === 'over') {
        // places
        for (const p of map.props) {
            if (p.type !== 'loc') continue;
            const L = LOCS[p.loc], c = chunk(p.x, p.y), gy = gyAt(p.x, p.y);
            if (L.kind === 'town') P.townMarker(c.geo, c.em, p.x + 0.5, gy, p.y + 0.5, p.x * 31 + p.y, L.theme);
            else P.dungeonMarker(c.geo, c.em, L.id, p.x + 0.5, gy, p.y + 0.5, p.x);
            lightsOut.push({ x: p.x + 0.5, y: p.y + 1.2, z: 1.4, color: L.kind === 'town' ? 0xffc070 : 0xb0a0ff, intensity: 1.6, r: 5, night: L.kind === 'town', kind: 'place' });
        }
        // scenery grown from the terrain
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const i = y * W + x, t = map.tile[i], r = hash3(x, y, 31), r2 = hash3(x, y, 32), z = zoneOf(x, y);
            if (map.blk[i] || Math.hypot(x - 0, y - 0) < 0) continue;
            const c = chunk(x, y), gy = gyAt(x, y), jx = x + 0.2 + r * 0.6, jz = y + 0.2 + r2 * 0.6;
            if (t === T.WOODS && r < 0.6) (z === 'snow' ? P.pine : P.oak)(c.geo, jx, gy, jz, x * 97 + y, 0.9 + r2 * 0.4);
            else if (t === T.FOREST) { P.oak(c.geo, x + 0.5, gy, y + 0.5, x * 97 + y, 1.2 + r2 * 0.5, 0x8ac478); if (r < 0.5) P.oak(c.geo, x + 0.1 + r2 * 0.4, gy, y + 0.9, x * 31 + y, 0.9, 0x98d084); }
            else if (t === T.SNOW && r < 0.07) P.pine(c.geo, jx, gy, jz, x * 97 + y, 0.9 + r2 * 0.5, true);
            else if (t === T.SAND && z === 'coast' && r < 0.05) P.palm(c.geo, jx, gy, jz, x * 97 + y, 0.95 + r2 * 0.3);
            else if (t === T.SAND && z === 'desert' && r < 0.035) P.cactus(c.geo, jx, gy, jz, x * 7 + y, 0.9 + r2 * 0.5);
            else if (t === T.ROCK) { if (hAt(x, y) >= 6 && r < 0.3) P.spike(c.geo, x + 0.5, gy, y + 0.5, x * 13 + y, 0.5 + r2 * 0.9 + (hAt(x, y) - 6) * 0.08, z === 'snow' || hAt(x, y) >= 9 ? 0xffffff : z === 'volcano' ? 0xb0a0a0 : 0xdcdce6, z === 'snow' || hAt(x, y) >= 9 ? TEX.snow : TEX.rock); else if (r < 0.1) P.rock(c.geo, jx, gy, jz, x * 13 + y, 1.1); }
            else if ((t === T.GRASS || t === T.DIRT || t === T.ASH) && r < 0.025) P.rock(c.geo, jx, gy, jz, x * 13 + y, 0.8, t === T.ASH ? 0xb8b0b4 : 0xdcdce6);
            else if (t === T.GRASS && r > 0.975) P.bush(c.geo, jx, gy, jz, x * 5 + y, 0.9);
        }
    } else if (map.kind === 'town') {
        for (const p of map.props) {
            const c = chunk(p.x, p.y), gy = gyAt(p.x, p.y), cx = p.x + 0.5, cz = p.y + 0.5;
            switch (p.type) {
                case 'building': P.building(c.geo, c.em, p, gyAt(p.x + (p.w >> 1), p.y + (p.h >> 1))); break;
                case 'tree': { const ty = gy; const f = p.kind === 'palm' ? P.palm : p.kind === 'pine' ? ((g, x, y, z, s, sc) => P.pine(g, x, y, z, s, sc, true)) : P.oak; f(c.geo, cx + (hash3(p.seed, 1, 1) - 0.5) * 0.3, ty, cz, p.seed, (p.border ? 1.35 : 1) * (0.9 + hash3(p.seed, 2, 2) * 0.3)); break; }
                case 'bush': P.bush(c.geo, cx, gy, cz, p.seed, 1); break;
                case 'flowers': for (let k = 0; k < 4; k++) c.em && c.geo.add(UG.ico0, { x: cx + (hash3(p.seed, k, 1) - 0.5) * 0.7, y: gy + 0.1, z: cz + (hash3(p.seed, k, 2) - 0.5) * 0.7, s: 0.08, color: [0xff7ab0, 0xffe44a, 0xffffff, 0xff9a4a][k], tile: TEX.forest }); break;
                case 'crate': P.crate(c.geo, cx, gy, cz, p.seed); break;
                case 'barrel': P.barrel(c.geo, cx, gy, cz); break;
                case 'bench': P.bench(c.geo, cx, gy, cz); break;
                case 'lamp': P.lamp(c.geo, c.em, cx, gy, cz); break;
                case 'fountain': P.fountain(c.geo, c.em, p.x + 1, gy, p.y + 1); break;
                case 'board': P.board(c.geo, cx, gy, cz); break;
                case 'gate': P.gate(c.geo, p.x + 1, gy, cz, p.w + 1.2); break;
                case 'shrine': P.shrine(c.geo, c.em, p.x + 2, gy, p.y + 1.5); break;
            }
        }
    } else {
        const dth = { pillar: th.wall === 'sandstone' ? 0xd8b868 : th.wall === 'ice' ? 0xb8eaff : th.wall === 'obsidian' ? 0x3a3450 : 0xa8a49a, light: th.light, rock: th.wall === 'basalt' ? 0x3a2a2a : 0x6a6a76 };
        for (const p of map.props) {
            if (p.type !== 'deco') continue;
            const c = chunk(p.x, p.y);
            P.deco(c.geo, c.em, p, gyAt(p.x, p.y), dth);
        }
    }
    for (const p of map.props) if (['chest', 'crack', 'save', 'spark', 'portal'].includes(p.type)) dyn.push(p);

    // ---- build meshes
    const terrainMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 1, metalness: 0 });
    const uniforms = { uPlayer: { value: new THREE.Vector2() }, uFwd: { value: new THREE.Vector2(0, -1) }, uTime: { value: 0 } };
    terrainMat.onBeforeCompile = (sh) => {
        sh.uniforms.uPlayer = uniforms.uPlayer; sh.uniforms.uFwd = uniforms.uFwd;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCut; uniform vec2 uPlayer; uniform vec2 uFwd;')
            .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
if (aCut > -900.0) {
  vec2 d = position.xz - uPlayer; float along = dot(d, uFwd); vec2 lat = d - uFwd * along;
  float f = (1.0 - smoothstep(1.6, 3.0, length(lat))) * (1.0 - smoothstep(-1.5, -0.3, along)) * (1.0 - smoothstep(-8.0, -11.0, along));
  transformed.y = mix(position.y, min(position.y, aCut), f);
}`);
    };
    const propMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const emMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
    const group = new THREE.Group();
    const meshes = [], waterMeshes = [], lavaMeshes = [];
    const waterMat = makeWaterMat(), lavaMat = makeLavaMat();
    for (const c of chunks.values()) {
        if (c.pos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(c.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(c.col, 3)); g.setAttribute('aCut', new THREE.Float32BufferAttribute(c.cut, 1));
            g.setIndex(c.ind);
            g.computeBoundingSphere();
            const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; m.castShadow = map.kind !== 'dungeon'; group.add(m); meshes.push(m);
            if (map.kind === 'dungeon') { m.frustumCulled = false; }
        }
        const pg = c.geo.build();
        if (pg) { const m = new THREE.Mesh(pg, propMat); m.castShadow = true; m.receiveShadow = true; group.add(m); meshes.push(m); }
        const eg = c.em.build();
        if (eg) { const m = new THREE.Mesh(eg, emMat); group.add(m); meshes.push(m); }
        if (c.wpos.length) {
            const wp = [], sh = [], dp = [];
            for (let k = 0; k < c.wpos.length; k += 14) {
                const q = c.wpos.slice(k, k + 14), s = q[12], d = q[13];
                for (const v of [0, 1, 2, 0, 2, 3]) { wp.push(q[v * 3], WATER_Y, q[v * 3 + 2]); sh.push(s); dp.push(d); }
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(sh, 1)); g.setAttribute('aDeep', new THREE.Float32BufferAttribute(dp, 1));
            const m = new THREE.Mesh(g, waterMat); m.renderOrder = 2; group.add(m); waterMeshes.push(m);
        }
        if (c.lpos.length) {
            const lp = [];
            for (let k = 0; k < c.lpos.length; k += 12) { const q = c.lpos.slice(k, k + 12); for (const v of [0, 1, 2, 0, 2, 3]) lp.push(q[v * 3], q[v * 3 + 1], q[v * 3 + 2]); }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
            const m = new THREE.Mesh(g, lavaMat); group.add(m); lavaMeshes.push(m);
        }
    }

    // ---- grass tufts and flowers: instanced crossed quads that sway
    const tufts = [];
    const tuftKinds = { grass: tuftTexture('grass'), snow: tuftTexture('snow'), sand: tuftTexture('sand'), ash: tuftTexture('ash'), flower: tuftTexture('flower') };
    const tuftList = { grass: [], snow: [], sand: [], ash: [], flower: [] };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, t = map.tile[i];
        if (map.blk[i]) continue;
        const r = hash3(x, y, 41), gy = gyAt(x, y);
        let kind = null;
        if (t === T.GRASS || t === T.WOODS || t === T.MOSS) kind = r < 0.7 ? 'grass' : null; else if (t === T.FLOWERS) kind = r < 0.55 ? 'flower' : 'grass'; else if (t === T.SNOW) kind = r < 0.25 ? 'snow' : null; else if (t === T.SAND && map.kind === 'over' && r < 0.2) kind = 'sand'; else if (t === T.ASH && r < 0.2) kind = 'ash';
        if (map.kind === 'dungeon' && t !== T.MOSS) kind = null;
        if (!kind) continue;
        const n = kind === 'flower' ? 2 : 1 + (r > 0.35 ? 1 : 0);
        for (let k = 0; k < n; k++) tuftList[kind].push([x + 0.15 + hash3(x, y, 50 + k) * 0.7, gy, y + 0.15 + hash3(x, y, 60 + k) * 0.7, 0.45 + hash3(x, y, 70 + k) * 0.35]);
    }
    for (const [kind, list] of Object.entries(tuftList)) {
        if (!list.length) continue;
        const plane = new THREE.PlaneGeometry(1, 1); plane.translate(0, 0.5, 0);
        const cross = new THREE.PlaneGeometry(1, 1); cross.translate(0, 0.5, 0); cross.rotateY(Math.PI / 2);
        const geo = mergeTwo(plane, cross);
        const mat = new THREE.MeshLambertMaterial({ map: tuftKinds[kind], alphaTest: 0.5, side: THREE.FrontSide });
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = uniforms.uTime;
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
transformed.x += sin(uTime * 2.2 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3) * 0.12 * position.y;
transformed.z += cos(uTime * 1.9 + instanceMatrix[3].z * 1.9) * 0.08 * position.y;`);
        };
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
        list.forEach(([x, y, z, s], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash3(k, 3, 3) * 3); sc.set(s * 1.1, s, s * 1.1); ps.set(x, y, z); m4.compose(ps, q, sc); im.setMatrixAt(k, m4); });
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
        group.add(im); tufts.push(im);
    }

    const update = (st) => {
        uniforms.uTime.value = st.time;
        uniforms.uPlayer.value.set(st.px, st.pz); uniforms.uFwd.value.set(st.fwdX, st.fwdZ);
        waterMat.uniforms.uTime.value = st.time; lavaMat.uniforms.uTime.value = st.time;
        waterMat.uniforms.uSun.value = st.sunMul; waterMat.uniforms.uTint.value.copy(st.skyTint);
        lavaMat.uniforms.uSun.value = 1;
        emMat.color.setScalar(st.glow);
    };
    const dispose = () => { for (const m of meshes) m.geometry.dispose(); terrainMat.dispose(); propMat.dispose(); emMat.dispose(); waterMat.dispose(); lavaMat.dispose(); for (const t of tufts) { t.geometry.dispose(); t.material.dispose(); } };
    return { group, update, dispose, lights: lightsOut, dyn, uniforms, wallTop, topY };
}

function mergeTwo(a, b) {
    // two crossed quads, each drawn from both sides with an upward normal so the light never turns the back black
    const g = new THREE.BufferGeometry();
    const pos = [], uv = [], nor = [], idx = [];
    let off = 0;
    for (const s of [a, b]) {
        const p = s.attributes.position, u = s.attributes.uv;
        for (let side = 0; side < 2; side++) {
            for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nor.push(0, 1, 0); }
            const arr = s.index.array;
            for (let k = 0; k < arr.length; k += 3) { if (side) idx.push(arr[k + 2] + off, arr[k + 1] + off, arr[k] + off); else idx.push(arr[k] + off, arr[k + 1] + off, arr[k + 2] + off); }
            off += p.count;
        }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
}

function makeWaterMat() {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSun: { value: 1 }, uTint: { value: new THREE.Color(0xffffff) } }]),
        vertexShader: `attribute float aShore; attribute float aDeep; varying float vShore; varying float vDeep; varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vShore = aShore; vDeep = aDeep; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vW = position; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform float uTime; uniform float uSun; uniform vec3 uTint; varying float vShore; varying float vDeep; varying vec3 vW;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz;
  float w1 = n(p * 1.6 + vec2(uTime * 0.35, uTime * 0.2)), w2 = n(p * 3.1 - vec2(uTime * 0.28, uTime * 0.4));
  float wave = (w1 + w2) * 0.5;
  vec3 deep = vec3(0.07, 0.24, 0.52), shallow = vec3(0.22, 0.62, 0.74);
  vec3 c = mix(shallow, deep, vDeep) * (0.85 + wave * 0.35);
  float glint = smoothstep(0.78, 0.9, w1 * w2 * 1.9 + 0.1) * 0.9;
  c += vec3(glint) * vec3(1.0, 0.95, 0.85);
  float foam = smoothstep(0.55, 1.0, vShore) * (0.55 + 0.45 * sin(uTime * 1.5 + p.x * 3.0 + p.y * 2.0 + wave * 6.0));
  float foamMask = smoothstep(0.5, 0.9, vShore) * step(0.55, wave + foam * 0.35);
  c = mix(c, vec3(0.95, 0.99, 1.0), foamMask * 0.8);
  c *= uSun * uTint;
  float a = mix(0.62, 0.92, vDeep) + foamMask * 0.1;
  gl_FragColor = vec4(c, a);
#include <fog_fragment>
}`,
    });
}

function makeLavaMat() {
    return new THREE.ShaderMaterial({
        fog: true, toneMapped: false,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSun: { value: 1 } }]),
        vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vW = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform float uTime; varying vec3 vW;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz * 1.5;
  float a = n(p + vec2(uTime * 0.12, 0.0)), b = n(p * 2.1 - vec2(0.0, uTime * 0.18));
  float v = a * 0.6 + b * 0.4;
  vec3 c = mix(vec3(0.55, 0.06, 0.0), vec3(1.6, 0.62, 0.08), smoothstep(0.25, 0.8, v));
  c = mix(c, vec3(2.0, 1.5, 0.5), smoothstep(0.78, 0.95, v));
  c = mix(vec3(0.18, 0.02, 0.0), c, smoothstep(0.1, 0.4, v + 0.15));
  gl_FragColor = vec4(c, 1.0);
#include <fog_fragment>
}`,
    });
}
