/**
 * build.js — turns a generated level (gen.js) into three.js meshes.
 *
 * All static surfaces are merged into one mesh per surface type, so a whole
 * level costs ~15 draw calls. Doors are separate meshes (they move). Faces:
 *   floors and ceilings     one quad per open cell (no ceiling under sky)
 *   walls                   where an open cell meets a solid one
 *   step faces              where neighbouring floors differ (stairs, daises, crates, pits)
 *   lintels                 where neighbouring ceilings differ
 * UVs are world-space (one texture repeat per 2 m), so textures run
 * continuously across faces and heights.
 */
import * as THREE from 'three';
import { CELL } from '../config.js';
import { K_CRATE, K_DAIS, K_LIQUID, K_CORRIDOR, W_ALT, W_PILLAR, W_EXIT, W_TERMINAL, W_CORRIDOR } from './gen.js';
import { THEMES, paintTexture } from './textures.js';
import { worldMaterial, glowMaterial, GLOW_GEO, actorMaterial } from '../render/materials.js';
import { KEY_COLORS } from '../config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

class Bucket {
    constructor() { this.p = []; this.n = []; this.uv = []; this.ao = []; }
    /** quad corners in CCW order seen from the front; each corner [x,y,z,u,v,ao] */
    quad(a, b, c, d, nx, ny, nz) {
        for (const v of [a, b, c, a, c, d]) {
            this.p.push(v[0], v[1], v[2]);
            this.n.push(nx, ny, nz);
            this.uv.push(v[3], v[4]);
            this.ao.push(v[5]);
        }
    }
    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
        g.computeBoundingSphere();
        return g;
    }
}

export function buildLevel(L, opts = {}) {
    const theme = THEMES[L.theme];
    const S = theme.surfaces;
    const texSize = opts.texSize ?? 256;
    const group = new THREE.Group();
    group.name = 'level';
    const buckets = {};
    const B = (name) => (buckets[name] ??= new Bucket());
    const { W } = L;

    const wallSurface = (wt) => (wt === W_ALT ? 'alt' : wt === W_PILLAR ? 'pillar' : wt === W_CORRIDOR ? 'corridor' : 'wall');

    /** vertical face on the boundary of cell (x,y) towards direction (dx,dy), facing back into the cell */
    const vface = (bucket, x, y, dx, dy, y0, y1, aoBot = 0.72, aoTop = 0.95, uvMode = 'world') => {
        if (y1 - y0 < 0.001) return;
        const nx = -dx, nz = -dy;
        // right vector = up × n (so the quad winds CCW seen from the front)
        const rx = nz, rz = -nx;
        const mx = (x + 0.5 + dx * 0.5) * CELL, mz = (y + 0.5 + dy * 0.5) * CELL;
        const h = CELL / 2;
        const blx = mx - rx * h, blz = mz - rz * h, brx = mx + rx * h, brz = mz + rz * h;
        let u0, u1, v0, v1;
        if (uvMode === 'panel') { u0 = 0; u1 = 1; v0 = 0; v1 = 1; }
        else {
            u0 = (blx * rx + blz * rz) / CELL; u1 = u0 + 1;
            v0 = y0 / CELL; v1 = y1 / CELL;
        }
        const tall = y1 - y0 > 5;
        const aT = tall ? 0.6 : aoTop;
        bucket.quad([blx, y0, blz, u0, v0, aoBot], [brx, y0, brz, u1, v0, aoBot], [brx, y1, brz, u1, v1, aT], [blx, y1, blz, u0, v1, aT], nx, 0, nz);
    };

    for (let y = 0; y < L.H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!L.open[i]) continue;
        const f = L.floor[i], c = L.ceil[i];
        const x0 = x * CELL, x1 = (x + 1) * CELL, z0 = y * CELL, z1 = (y + 1) * CELL;
        // floor
        const k = L.kind[i];
        const fb = L.liquid[i] ? 'liquid' : k === K_CRATE ? 'crate' : k === K_DAIS ? 'floorAlt' : k === K_CORRIDOR ? 'floorAlt' : 'floor';
        const fuv = (px, pz) => [px / CELL, pz / CELL];
        const fq = (px, pz) => [px, f, pz, ...fuv(px, pz), 1];
        B(fb).quad(fq(x0, z0), fq(x0, z1), fq(x1, z1), fq(x1, z0), 0, 1, 0);
        // ceiling
        if (!L.sky[i]) {
            const cq = (px, pz) => [px, c, pz, px / CELL, pz / CELL, 0.85];
            B('ceil').quad(cq(x0, z0), cq(x1, z0), cq(x1, z1), cq(x0, z1), 0, -1, 0);
        }
        // sides
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            const j = ny * W + nx;
            if (nx < 0 || ny < 0 || nx >= W || ny >= L.H || !L.open[j]) {
                const wt = L.wtex[j] ?? 0;
                if (wt === W_EXIT || wt === W_TERMINAL) {
                    const top = Math.min(c, f + 2.4);
                    vface(B(wt === W_EXIT ? 'exit' : 'terminal'), x, y, dx, dy, f, top, 0.9, 0.95, 'panel');
                    vface(B('wall'), x, y, dx, dy, top, c);
                } else {
                    vface(B(wallSurface(wt)), x, y, dx, dy, f, c);
                }
                continue;
            }
            // lower neighbour → step face on our side, facing it
            const fj = L.floor[j];
            if (fj < f - 0.001) {
                const sb = k === K_CRATE ? 'crate' : L.liquid[j] && !L.liquid[i] ? 'alt' : 'step';
                // faces belong to the neighbour's boundary: build from j's perspective
                vface(B(sb), nx, ny, -dx, -dy, fj, f, 0.8, 1);
            }
            // higher neighbour ceiling → lintel on its side, facing it
            const cj = L.ceil[j];
            if (cj > c + 0.001) {
                const tb = L.door[i] >= 0 || L.kind[i] === K_CORRIDOR ? 'corridor' : 'wall';
                vface(B(tb), nx, ny, -dx, -dy, c, cj, 0.9, 0.95);
            }
        }
    }

    const tex = (name) => paintTexture(name, texSize, opts.anisotropy ?? 4);
    const SURF_OPTS = {
        liquid: { liquid: true, bump: 0.02 },
        exit: { emitBoost: 2.2 },
        terminal: { emitBoost: 1.8 },
        ceil: { emitBoost: 1.6 },
        floor: { spec: 0.7 },
    };
    const meshes = {};
    for (const [name, bucket] of Object.entries(buckets)) {
        if (!bucket.p.length) continue;
        const painter = S[name];
        const m = new THREE.Mesh(bucket.geometry(), worldMaterial(tex(painter), SURF_OPTS[name] ?? {}));
        m.name = 'surf-' + name;
        m.matrixAutoUpdate = false;
        group.add(m);
        meshes[name] = m;
    }

    // ------------------------------------------------------------ doors
    const doorMeshes = [];
    const doorTex = tex(S.door);
    const doorMats = {};
    const doorMat = (key) => (doorMats[key ?? 'none'] ??= worldMaterial(doorTex, { tint: key ? new THREE.Color(KEY_COLORS[key]).lerp(new THREE.Color(1, 1, 1), 0.55) : 0xffffff }));
    const secretMat = worldMaterial(tex(S.wall), {});
    for (const d of L.doors) {
        const i = d.cell;
        const f = L.floor[i], c = L.ceil[i];
        const h = c - f;
        let mesh;
        const cx = (d.x + 0.5) * CELL, cz = (d.y + 0.5) * CELL;
        if (d.secret) {
            mesh = new THREE.Mesh(boxGeo(CELL, h, CELL, true), secretMat);
        } else {
            const thick = 0.42;
            const geo = d.alongX ? boxGeo(thick, h, CELL, false) : boxGeo(CELL, h, thick, false);
            mesh = new THREE.Mesh(geo, doorMat(d.key));
            if (d.key) {
                // glowing key-colour strips on both faces
                const glowMat = actorMaterial({ tint: KEY_COLORS[d.key], glow: KEY_COLORS[d.key], unlit: true, rim: 0 });
                const strip = new THREE.Mesh(d.alongX ? colorBox(thick + 0.04, 0.16, CELL * 0.8, 1) : colorBox(CELL * 0.8, 0.16, thick + 0.04, 1), glowMat);
                strip.position.y = h * 0.18 - h / 2 + 0.6;
                mesh.add(strip);
                const strip2 = strip.clone();
                strip2.position.y = h / 2 - 0.5;
                mesh.add(strip2);
            }
        }
        mesh.position.set(cx, f + h / 2, cz);
        mesh.userData = { door: d, baseY: f + h / 2, h };
        group.add(mesh);
        doorMeshes[d.id] = mesh;
    }

    // ------------------------------------------------------------ light fixtures + halos
    const fixtures = new THREE.Group();
    const fixMat = actorMaterial({ tint: 0x777a80, glow: 0xffffff, rim: 0.1 });
    const lampGeo = colorBox(0.5, 0.22, 0.14, 0);
    const halos = [];
    for (const lt of L.lights) {
        if (lt.fixture === 'none') continue;
        const col = new THREE.Color(lt.color[0], lt.color[1], lt.color[2]);
        const halo = new THREE.Mesh(GLOW_GEO, glowMaterial(col.clone().multiplyScalar(0.55), col.clone().lerp(new THREE.Color(1, 1, 1), 0.6), 1.0, 2.6));
        if (lt.fixture === 'wall') {
            const lamp = new THREE.Mesh(lampGeo, fixMat);
            const wx = (lt.x - lt.nx * 0.12) * CELL, wz = (lt.z - lt.nz * 0.12) * CELL;
            lamp.position.set(wx + lt.nx * 0.07, lt.y, wz + lt.nz * 0.07);
            lamp.rotation.y = Math.atan2(lt.nx, lt.nz);
            fixtures.add(lamp);
            halo.position.set(wx + lt.nx * 0.22, lt.y, wz + lt.nz * 0.22);
            halo.scale.setScalar(1.3);
        } else {
            halo.position.set(lt.x * CELL, lt.y - 0.05, lt.z * CELL);
            halo.scale.setScalar(1.6);
        }
        halo.userData = { flicker: lt.flicker, base: 1, phase: Math.random() * 10 };
        halos.push(halo);
        fixtures.add(halo);
    }
    group.add(fixtures);

    return { group, meshes, doorMeshes, halos, theme };
}

/** Box with world-scale UVs (one repeat per 2 m) or 0..1 per face. */
export function boxGeo(w, h, d, worldUV) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (worldUV) {
        const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
        for (let i = 0; i < uv.count; i++) {
            const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
            let u, v;
            if (ay > 0.5) { u = p.getX(i); v = p.getZ(i); }
            else if (ax > 0.5) { u = p.getZ(i); v = p.getY(i) + h / 2; }
            else { u = p.getX(i); v = p.getY(i) + h / 2; }
            uv.setXY(i, u / CELL, v / CELL);
        }
    } else {
        // stretch the door texture over the panel's broad faces only
        const uv = g.attributes.uv;
        uv.needsUpdate = true;
    }
    const ao = new Float32Array(g.attributes.position.count).fill(1);
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    return g;
}

/** Box for the actor shader: needs colour + glow attributes. */
export function colorBox(w, h, d, glow = 0, color = [1, 1, 1]) {
    const g = new THREE.BoxGeometry(w, h, d);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(color, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
    return g;
}
