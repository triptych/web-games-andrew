/**
 * level.js (view) — turns a generated map into meshes: the procedural deck
 * floor (one plane, one shader), merged walls with light strips that fade
 * around the marine, sliding blast doors, instanced props, interactive items,
 * the baked lightmap and the decal canvas for acid, blood and scorch marks.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL_H } from '../config.js';
import { T_FLOOR, T_WALL, F_CORRIDOR, F_HAZARD, F_VENT, F_PAD, F_ARENA, PROPS } from '../sim/level.js';
import { LM, patchLit, Q } from './scene.js';

const col = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------ Geometry helpers

/** Box with vertex colours and an emissive-mask attribute. */
export function box(w, h, d, x, y, z, color, glow = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    return paint(g, color, glow);
}
export function cyl(rt, rb, h, seg, x, y, z, color, glow = 0, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return paint(g, color, glow);
}
export function sph(r, x, y, z, color, glow = 0, sx = 1, sy = 1, sz = 1, seg = 10) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    return paint(g, color, glow);
}
export function paint(g, color, glow = 0) {
    const g2 = g.index ? g.toNonIndexed() : g;
    const n = g2.attributes.position.count;
    const c = new THREE.Color(color);
    const cols = new Float32Array(n * 3), gl = new Float32Array(n);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; gl[i] = glow; }
    g2.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g2.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    if (g2.attributes.uv) g2.deleteAttribute('uv');
    return g2;
}
export function merge(list) { return mergeGeometries(list, false); }

// ------------------------------------------------------------------ Lightmap

function bakeLightmap(lv) {
    const { w, h } = lv;
    const data = new Float32Array(w * h * 4);
    const tc = new THREE.Color();
    const opaque = (x, y) => x < 0 || y < 0 || x >= w || y >= h || lv.tiles[y * w + x] !== T_FLOOR;
    const see = (ax, ay, bx, by) => {
        const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
        const n = Math.ceil(d * 2);
        for (let i = 1; i < n; i++) {
            const t = i / n;
            if (opaque(Math.floor(ax + dx * t), Math.floor(ay + dy * t))) return false;
        }
        return true;
    };
    for (const L of lv.lamps) {
        tc.set(L.color);
        const alarmLamp = L.flag === 2 || L.flag === 3;
        const r = L.r, r2 = r * r;
        for (let y = Math.max(0, Math.floor(L.y - r)); y < Math.min(h, Math.ceil(L.y + r)); y++) {
            for (let x = Math.max(0, Math.floor(L.x - r)); x < Math.min(w, Math.ceil(L.x + r)); x++) {
                if (lv.tiles[y * w + x] !== T_FLOOR) continue;
                const dx = x + 0.5 - L.x, dy = y + 0.5 - L.y, d2 = dx * dx + dy * dy;
                if (d2 > r2) continue;
                if (!see(L.x, L.y, x + 0.5, y + 0.5)) continue;
                const f = Math.pow(1 - Math.sqrt(d2) / r, 1.7) * L.power;
                const i = (y * w + x) * 4;
                if (alarmLamp) data[i + 3] += f * 0.9;
                else { data[i] += tc.r * f; data[i + 1] += tc.g * f; data[i + 2] += tc.b * f; }
            }
        }
    }
    // Walls borrow the light of the floor next to them (the shader samples half a tile in front of a face).
    const out = new Float32Array(data);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (lv.tiles[i] === T_FLOOR) continue;
            let n = 0;
            const acc = [0, 0, 0, 0];
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const xx = x + ox, yy = y + oy;
                if (xx < 0 || yy < 0 || xx >= w || yy >= h || lv.tiles[yy * w + xx] !== T_FLOOR) continue;
                const j = (yy * w + xx) * 4;
                for (let k = 0; k < 4; k++) acc[k] += data[j + k];
                n++;
            }
            if (n) for (let k = 0; k < 4; k++) out[i * 4 + k] = acc[k] / n;
        }
    }
    const half = new Uint16Array(out.length);
    for (let i = 0; i < out.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(60000, out[i]));
    const tex = new THREE.DataTexture(half, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

// ------------------------------------------------------------------ Floor

function hashTile(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function floorData(lv) {
    const { w, h } = lv;
    const data = new Uint8Array(w * h * 4);
    const creep = lv.theme.creep;
    // Creep spreads from vents and is thicker in later sectors.
    const vents = [];
    for (const r of lv.rooms) for (const v of r.vents) vents.push(v);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            data[i * 4] = lv.flags[i];
            data[i * 4 + 1] = lv.roomAt[i] < 0 ? 255 : 0; // visited (corridors always shown)
            let c = creep;
            if (creep > 0 && creep < 0.9) {
                let near = 99;
                for (const v of vents) { const d = Math.abs(v.x - x) + Math.abs(v.y - y); if (d < near) near = d; }
                c = Math.min(1, creep * 0.5 + Math.max(0, 1 - near / 7) * (0.35 + creep));
            }
            data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, c)) * 255);
            data[i * 4 + 3] = Math.floor(hashTile(x, y) * 255);
        }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
}

const NOISE_GLSL = /* glsl */`
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; } return s; }
`;

function makeFloor(lv, decalTex, flagTex) {
    const th = lv.theme;
    const geo = new THREE.PlaneGeometry(lv.w, lv.h, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(lv.w / 2, 0, lv.h / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.5 });
    const uniforms = {
        uFlags: { value: flagTex },
        uDecal: { value: decalTex },
        uFloorA: { value: col(th.floor) },
        uFloorB: { value: col(th.floor2) },
        uAccent: { value: col(th.accent) },
        uStrip: { value: col(th.strip) },
        uCreepCol: { value: col(0x2a0d2a) },
        uVein: { value: col(th.id === 'hive' || th.id === 'escape' ? 0xff3ad0 : th.id === 'labs' ? 0x6aff8a : th.id === 'reactor' ? 0xff6a1a : 0xc04ae0) },
        uPad: { value: new THREE.Vector2(lv.start.x, lv.start.y) },
        uArena: { value: new THREE.Vector2(0, 0) },
        uVentGlow: { value: 0 },
    };
    const arena = lv.rooms.find((r) => r.type === 'boss' || r.type === 'nest' || r.type === 'horde');
    if (arena) uniforms.uArena.value.set(arena.cx, arena.cy);
    const pad = lv.rooms.find((r) => r.type === 'pad');
    if (pad) uniforms.uPad.value.set(pad.cx, pad.cy);
    mat.userData.uniforms = uniforms;
    patchLit(mat, {
        key: 'floor',
        uniforms,
        fragmentPars: `
            uniform sampler2D uFlags; uniform sampler2D uDecal;
            uniform vec3 uFloorA, uFloorB, uAccent, uStrip, uCreepCol, uVein;
            uniform vec2 uPad, uArena; uniform float uVentGlow;
            ${NOISE_GLSL}
            float gEmit; vec3 gEmitCol; float gRough; float gMetal;
        `,
        mapFragment: `
            vec2 wp = vLMW.xz;
            vec2 cell = floor(wp);
            vec4 fd = texture2D(uFlags, (cell + 0.5) / uLMSize);
            float flags = floor(fd.r * 255.0 + 0.5);
            float visited = fd.g;
            float creep = fd.b;
            float rnd = fd.a;
            bool corridor = mod(flags, 2.0) >= 1.0;
            bool hazard = mod(floor(flags / 2.0), 2.0) >= 1.0;
            bool vent = mod(floor(flags / 4.0), 2.0) >= 1.0;
            bool padF = mod(floor(flags / 8.0), 2.0) >= 1.0;
            bool arenaF = mod(floor(flags / 16.0), 2.0) >= 1.0;
            bool doorF = mod(floor(flags / 32.0), 2.0) >= 1.0;
            gEmit = 0.0; gEmitCol = vec3(0.0); gRough = 0.5; gMetal = 0.55;
            vec3 c;
            if (corridor || doorF) {
                // Grating over a dark pit.
                vec2 g = wp * vec2(4.0, 4.0);
                float bar = step(0.72, fract(corridor ? g.x : g.y));
                float cross = step(0.86, fract((corridor ? g.y : g.x) * 0.5));
                c = mix(uFloorB * 0.35, uFloorB * 1.05, max(bar, cross));
                float edge = min(fract(wp.x), 1.0 - fract(wp.x));
                gRough = 0.6; gMetal = 0.7;
            } else {
                // Deck plates: 2×2 m panels with seams, bevels and rivets.
                vec2 pp = wp * 0.5;
                vec2 pid = floor(pp);
                vec2 pf = fract(pp);
                float var = h21(pid);
                c = mix(uFloorA, uFloorB, var * 0.7);
                float seam = min(min(pf.x, 1.0 - pf.x), min(pf.y, 1.0 - pf.y));
                c *= mix(0.45, 1.0, smoothstep(0.0, 0.025, seam));
                c *= 1.0 + 0.12 * smoothstep(0.03, 0.0, abs(seam - 0.04));
                vec2 rv = abs(pf - 0.5);
                float rivet = smoothstep(0.035, 0.02, length(rv - 0.43));
                c = mix(c, uFloorA * 1.5, rivet);
                // Brushed streaks and grime.
                c *= 0.9 + 0.1 * vnoise(vec2(wp.x * 30.0, wp.y * 2.0 + var * 10.0));
                c *= 0.75 + 0.35 * fbm(wp * 0.6);
                gRough = 0.35 + var * 0.3;
            }
            if (hazard) {
                float s = step(0.5, fract((wp.x + wp.y) * 1.3));
                c = mix(c, mix(vec3(0.05), uAccent * 0.9, s), 0.85);
                gRough = 0.6;
            }
            if (vent) {
                vec2 vf = fract(wp);
                float slot = step(0.5, fract(vf.y * 5.0)) * step(0.15, vf.x) * step(vf.x, 0.85) * step(0.1, vf.y) * step(vf.y, 0.9);
                c = mix(c * 0.4, vec3(0.02), slot);
                gEmit += slot * uVentGlow; gEmitCol = uStrip;
            }
            if (padF) {
                float d = length(wp - uPad);
                float ring = smoothstep(0.08, 0.0, abs(d - 2.2)) + smoothstep(0.06, 0.0, abs(d - 1.4));
                c = mix(c, uAccent, ring * 0.8);
                gEmit += ring * 0.25; gEmitCol = uAccent;
            }
            if (arenaF) {
                float d = length(wp - uArena);
                float ring = smoothstep(0.1, 0.0, abs(d - 6.5)) + smoothstep(0.07, 0.0, abs(d - 3.5));
                float a = atan(wp.y - uArena.y, wp.x - uArena.x);
                ring *= step(0.3, fract(a * 3.0));
                c = mix(c, uStrip * 0.6, ring * 0.7);
                gEmit += ring * 0.35; gEmitCol = uStrip;
            }
            // Hive creep: wet membrane with glowing veins.
            if (creep > 0.01) {
                float n = fbm(wp * 0.45 + 3.1);
                float cover = smoothstep(1.0 - creep, 1.0 - creep + 0.12, n + (creep - 0.5) * 0.4);
                float n2 = fbm(wp * 1.7);
                vec3 mem = uCreepCol * (0.6 + 0.8 * n2);
                float vn = fbm(wp * 0.7 + 7.0);
                float vein = smoothstep(0.028, 0.0, abs(vn - 0.5)) * cover * smoothstep(0.35, 0.6, fbm(wp * 0.23 + 1.7));
                c = mix(c, mem, cover);
                c = mix(c, uVein * 0.22, vein * 0.4);
                float pulse = 0.45 + 0.55 * sin(uTime * 1.6 - length(wp - uArena) * 0.35 + n * 6.0);
                gEmit += vein * pulse * 0.16; gEmitCol = mix(gEmitCol, uVein, vein);
                gRough = mix(gRough, 0.18, cover); gMetal = mix(gMetal, 0.05, cover);
            }
            // Decals: acid, blood, scorch.
            vec4 dc = texture2D(uDecal, wp / uLMSize);
            c = mix(c, dc.rgb, dc.a);
            gRough = mix(gRough, 0.15, dc.a * step(0.05, dc.g - dc.r));
            // Unexplored rooms stay dim until visited.
            c *= mix(0.32, 1.0, visited);
            diffuseColor.rgb = c;
        `,
        emissiveFragment: `
            totalEmissiveRadiance += gEmitCol * gEmit;
            // Glowing acid decals.
            totalEmissiveRadiance += vec3(0.3, 1.0, 0.1) * dc.a * smoothstep(0.2, 0.5, dc.g - dc.r - dc.b) * 0.25;
        `,
        onShader: (shader) => {
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = gRough;')
                .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = gMetal;');
        },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'floor';
    return mesh;
}

// ------------------------------------------------------------------ Walls

function makeWalls(lv) {
    const { w, h, tiles } = lv;
    const pos = [], nrm = [], uvs = [];
    const H = WALL_H;
    const face = (ax, az, bx, bz, nx, nz) => {
        // Quad from (ax,0,az) to (bx,H,bz).
        const v = [[ax, 0, az], [bx, 0, bz], [bx, H, bz], [ax, H, az]];
        for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...v[i]); nrm.push(nx, 0, nz); uvs.push(i === 1 || i === 2 ? 1 : 0, v[i][1] / H); }
    };
    const top = (x, z) => {
        const v = [[x, H, z], [x + 1, H, z], [x + 1, H, z + 1], [x, H, z + 1]];
        for (const i of [0, 2, 1, 0, 3, 2]) { pos.push(...v[i]); nrm.push(0, 1, 0); uvs.push(-1, 1); }
    };
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] === T_FLOOR;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (tiles[y * w + x] !== T_WALL) continue;
            top(x, y);
            if (isFloor(x, y - 1)) face(x + 1, y, x, y, 0, -1);
            if (isFloor(x, y + 1)) face(x, y + 1, x + 1, y + 1, 0, 1);
            if (isFloor(x - 1, y)) face(x, y, x, y + 1, -1, 0);
            if (isFloor(x + 1, y)) face(x + 1, y + 1, x + 1, y, 1, 0);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const th = lv.theme;
    const uniforms = {
        uWall: { value: col(th.wall) },
        uStrip: { value: col(th.strip) },
        uPlayer: { value: new THREE.Vector3() },
        uCreep: { value: th.creep },
        uVein: { value: col(th.id === 'hive' || th.id === 'escape' ? 0xff3ad0 : th.strip) },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.45 });
    mat.userData.uniforms = uniforms;
    patchLit(mat, {
        key: 'wall',
        uniforms,
        vertexPars: 'varying vec2 vWUv;',
        vertexEnd: 'vWUv = uv;',
        fragmentPars: `
            uniform vec3 uWall, uStrip, uPlayer, uVein; uniform float uCreep;
            varying vec2 vWUv;
            ${NOISE_GLSL}
            float gE; vec3 gEC;
            float bayer4(vec2 p) {
                vec2 q = mod(floor(p), 4.0);
                float i = q.x + q.y * 4.0;
                return fract(i * 0.4375 + floor(i / 4.0) * 0.3125 + 0.03125);
            }
        `,
        mapFragment: `
            // Fade walls that stand between the camera and the marine.
            {
                float front = vLMW.z - uPlayer.z;
                float side = abs(vLMW.x - uPlayer.x);
                if (front > -0.2 && front < 4.2 && side < 3.6 && vLMW.y > 0.18) {
                    float k = (1.0 - smoothstep(2.4, 3.6, side)) * (1.0 - smoothstep(3.0, 4.2, front));
                    if (bayer4(gl_FragCoord.xy) < k * 0.8) discard;
                }
            }
            vec3 c = uWall;
            gE = 0.0; gEC = uStrip;
            if (vWUv.x < -0.5) {
                // Top cap.
                c = uWall * 0.32;
                vec2 tf = fract(vLMW.xz);
                float e = 1.0 - smoothstep(0.0, 0.06, min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)));
                c += uWall * 0.2 * e;
            } else {
                float hy = vLMW.y;
                float along = vLMW.x + vLMW.z;
                // Panels every 2 m with seams, a kick plate and a light strip.
                float pf = fract(along * 0.5);
                float seam = smoothstep(0.0, 0.015, min(pf, 1.0 - pf));
                c *= mix(0.4, 1.0, seam);
                float var = h21(floor(vec2(along * 0.5, 3.0)));
                c *= 0.8 + var * 0.3;
                float kick = step(hy, 0.32);
                c = mix(c, uWall * 0.45, kick);
                float band = smoothstep(0.02, 0.0, abs(hy - 0.34)) + smoothstep(0.02, 0.0, abs(hy - 1.62));
                c *= 1.0 - band * 0.5;
                // Vent grilles and conduits.
                float grille = step(0.55, pf) * step(pf, 0.85) * step(0.55, hy) * step(hy, 0.95);
                c = mix(c, c * (0.45 + 0.4 * step(0.5, fract(hy * 18.0))), grille * step(0.5, var));
                float strip = smoothstep(0.045, 0.0, abs(hy - 1.38)) * step(0.15, pf) * step(pf, 0.85);
                gE = strip * (0.9 + 0.3 * sin(uTime * 1.5 + along * 0.4));
                c = mix(c, uStrip, strip * 0.6);
                c *= 0.8 + 0.3 * fbm(vec2(along * 1.3, hy * 2.0));
                // Creep crawling up from the floor.
                if (uCreep > 0.05) {
                    float n = fbm(vec2(along * 0.6, hy * 0.8) + 11.0);
                    float cover = smoothstep(0.55, 0.65, n + uCreep * 0.55 - hy * 0.25);
                    c = mix(c, vec3(0.16, 0.05, 0.16) * (0.7 + n), cover);
                    float vein = smoothstep(0.04, 0.0, abs(fbm(vec2(along, hy) * 1.4) - 0.5)) * cover;
                    gE += vein * (0.2 + 0.15 * sin(uTime * 2.2 + along)); gEC = mix(gEC, uVein, vein);
                    gE *= 1.0 - cover * 0.6;
                }
            }
            diffuseColor.rgb = c;
        `,
        emissiveFragment: 'totalEmissiveRadiance += gEC * gE * 1.4;',
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'walls';
    return mesh;
}

// ------------------------------------------------------------------ Shared prop/actor material

/** Vertex-coloured, lightmapped, emissive-masked material; flash via instance attribute. */
export function makeLitMaterial(key, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.4, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
    patchLit(mat, {
        key,
        uniforms: opts.uniforms,
        vertexPars: `attribute float aGlow; varying float vGlow; ${opts.instFlash ? 'attribute float iFlash; varying float vFlash;' : ''} ${opts.vertexPars ?? ''}`,
        vertexBegin: `vGlow = aGlow; ${opts.instFlash ? 'vFlash = iFlash;' : ''} ${opts.vertexBegin ?? ''}`,
        fragmentPars: `varying float vGlow; ${opts.instFlash ? 'varying float vFlash;' : ''} ${opts.fragmentPars ?? ''}`,
        emissiveFragment: `totalEmissiveRadiance += vColor.rgb * vGlow * 2.2; ${opts.instFlash ? 'totalEmissiveRadiance += vec3(1.0, 0.9, 0.8) * vFlash * 1.5;' : ''} ${opts.emissiveFragment ?? ''}`,
        mapFragment: opts.mapFragment,
    });
    mat.userData.u = opts.uniforms ?? {};
    return mat;
}

// ------------------------------------------------------------------ Props

const PROP_GEO = {};
function propGeo(type, th) {
    const key = type + th.id;
    if (PROP_GEO[key]) return PROP_GEO[key];
    const acc = th.accent, wall = th.wall, strip = th.strip;
    let g;
    switch (type) {
    case 'crate': g = merge([
        box(0.86, 0.8, 0.86, 0, 0.4, 0, 0x5a4a30),
        box(0.9, 0.08, 0.9, 0, 0.04, 0, 0x2a2418), box(0.9, 0.08, 0.9, 0, 0.78, 0, 0x2a2418),
        box(0.08, 0.8, 0.9, -0.43, 0.4, 0, 0x2a2418), box(0.08, 0.8, 0.9, 0.43, 0.4, 0, 0x2a2418),
        box(0.5, 0.12, 0.02, 0, 0.5, 0.44, acc, 0.15),
    ]); break;
    case 'barrel': g = merge([
        cyl(0.36, 0.36, 0.95, 14, 0, 0.475, 0, 0xa8221a),
        cyl(0.375, 0.375, 0.09, 14, 0, 0.2, 0, 0x1a1a1a), cyl(0.375, 0.375, 0.09, 14, 0, 0.75, 0, 0x1a1a1a),
        cyl(0.3, 0.3, 0.04, 12, 0, 0.97, 0, 0x6a1a10),
        box(0.3, 0.22, 0.02, 0, 0.5, 0.36, 0xffd23a, 0.5),
    ]); break;
    case 'pillar': g = merge([
        box(0.98, 1.9, 0.98, 0, 0.95, 0, wall),
        box(1.02, 0.18, 1.02, 0, 0.09, 0, 0x202428), box(1.02, 0.12, 1.02, 0, 1.84, 0, 0x202428),
        box(1.0, 0.06, 1.0, 0, 1.3, 0, strip, 0.9),
    ]); break;
    case 'cargo': g = merge([
        box(0.98, 1.4, 0.98, 0, 0.7, 0, 0x2a4a6a),
        ...[-0.36, -0.12, 0.12, 0.36].map((x) => box(0.06, 1.36, 1.0, x, 0.7, 0, 0x203a54)),
        box(0.3, 0.1, 0.02, 0, 1.1, 0.5, acc, 0.4),
    ]); break;
    case 'console': g = merge([
        box(0.9, 0.85, 0.6, 0, 0.425, -0.1, 0x30363c),
        box(0.82, 0.42, 0.06, 0, 0.95, -0.28, 0x14181c), box(0.7, 0.3, 0.02, 0, 0.96, -0.24, strip, 1.0),
        box(0.6, 0.06, 0.25, 0, 0.88, 0.1, 0x202428), box(0.1, 0.04, 0.1, 0.2, 0.92, 0.1, 0xff3a2a, 1),
    ]); break;
    case 'locker': g = merge([
        box(0.9, 1.8, 0.6, 0, 0.9, -0.15, 0x4a5a4a),
        box(0.02, 1.7, 0.6, 0, 0.9, -0.15, 0x1a1a1a),
        ...[0.3, 0.38, 0.46].map((y) => box(0.3, 0.03, 0.02, -0.22, 1.5 + y * 0.3, 0.16, 0x1a1a1a)),
        ...[0.3, 0.38, 0.46].map((y) => box(0.3, 0.03, 0.02, 0.22, 1.5 + y * 0.3, 0.16, 0x1a1a1a)),
    ]); break;
    case 'sandbag': g = merge([
        sph(0.3, -0.22, 0.15, 0, 0x7a6a48, 0, 1, 0.5, 1.3), sph(0.3, 0.22, 0.15, 0, 0x6e5f40, 0, 1, 0.5, 1.3),
        sph(0.3, 0, 0.42, 0, 0x7a6a48, 0, 1.2, 0.5, 1.3),
    ]); break;
    case 'tank': g = merge([
        cyl(0.45, 0.48, 0.25, 16, 0, 0.125, 0, 0x30363c), cyl(0.45, 0.48, 0.2, 16, 0, 1.7, 0, 0x30363c),
        cyl(0.36, 0.36, 1.35, 16, 0, 0.92, 0, 0x2aff9a, 0.55),
        sph(0.18, 0, 0.9, 0, 0x14301e, 0, 1, 1.6, 1, 8),
    ]); break;
    case 'rack': g = merge([
        box(0.9, 1.8, 0.7, 0, 0.9, -0.1, 0x1e2226),
        ...[0.3, 0.6, 0.9, 1.2, 1.5].map((y) => box(0.8, 0.02, 0.02, 0, y, 0.26, 0x0a0a0a)),
        ...[0.4, 0.7, 1.0, 1.3, 1.6].map((y, i) => box(0.05, 0.04, 0.02, -0.3 + i * 0.12, y, 0.26, i % 2 ? 0x3aff6a : strip, 1.2)),
    ]); break;
    case 'pipe': g = merge([
        cyl(0.22, 0.22, 1.9, 10, -0.18, 0.95, -0.15, 0x6a5a4a), cyl(0.16, 0.16, 1.9, 10, 0.22, 0.95, 0.12, 0x5a4a3a),
        cyl(0.26, 0.26, 0.1, 10, -0.18, 0.6, -0.15, 0x2a2420), cyl(0.2, 0.2, 0.1, 10, 0.22, 1.3, 0.12, 0x2a2420),
        box(0.12, 0.12, 0.02, -0.18, 1.0, 0.08, 0xff6a1a, 1.2),
    ]); break;
    case 'cocoon': g = merge([
        sph(0.42, 0, 0.75, 0, 0x4a2448, 0, 1, 1.8, 1, 12),
        sph(0.18, 0.05, 0.95, 0.3, 0xff4ad8, 0.6, 1, 1.4, 0.4, 8),
        sph(0.5, 0, 0.1, 0, 0x2a1028, 0, 1, 0.25, 1, 10),
    ]); break;
    case 'pod': g = merge([
        sph(0.34, 0, 0.32, 0, 0x5a3a3a, 0, 1, 1.15, 1, 10),
        cyl(0.12, 0.2, 0.1, 8, 0, 0.7, 0, 0xff8a3a, 0.8),
    ]); break;
    default: g = box(0.9, 0.9, 0.9, 0, 0.45, 0, 0x777777);
    }
    PROP_GEO[key] = g;
    return g;
}

function makeProps(lv) {
    const byType = {};
    for (const p of lv.props) (byType[p.type] ??= []).push(p);
    const mat = makeLitMaterial('props', { instFlash: true, roughness: 0.5, metalness: 0.35 });
    const meshes = [];
    const lookup = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    for (const type in byType) {
        const list = byType[type];
        const geo = propGeo(type, lv.theme).clone();
        const flash = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1);
        geo.setAttribute('iFlash', flash);
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((p, i) => {
            let rot = p.rot * Math.PI / 2;
            if (PROPS[type].wall) {
                // Face away from the nearest wall.
                const room = lv.rooms[lv.roomAt[p.y * lv.w + p.x]];
                if (room) {
                    if (p.y === room.y) rot = 0; else if (p.y === room.y + room.h - 1) rot = Math.PI;
                    else if (p.x === room.x) rot = Math.PI / 2; else rot = -Math.PI / 2;
                }
            }
            q.setFromAxisAngle(v.set(0, 1, 0), rot);
            m.compose(v.set(p.x + 0.5, 0, p.y + 0.5), q, s);
            mesh.setMatrixAt(i, m);
            lookup.set(p.id, { mesh, i, flash });
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.flash = flash;
        meshes.push(mesh);
    }
    return { meshes, lookup };
}

// ------------------------------------------------------------------ Doors

function stripeTexture(accent) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#3a4048'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2a3036'; g.fillRect(0, 0, 128, 18); g.fillRect(0, 110, 128, 18);
    g.save(); g.beginPath(); g.rect(0, 52, 128, 24); g.clip();
    for (let x = -40; x < 160; x += 24) { g.fillStyle = '#' + new THREE.Color(accent).getHexString(); g.beginPath(); g.moveTo(x, 52); g.lineTo(x + 12, 52); g.lineTo(x + 36, 76); g.lineTo(x + 24, 76); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 8; i++) g.fillRect(8 + i * 15, 28, 6, 14);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function makeDoors(lv) {
    const tex = stripeTexture(lv.theme.accent);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.6 });
    patchLit(mat, { key: 'door' });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x3aff6a });
    const doors = lv.doors.map((d) => {
        const g = new THREE.Group();
        const len = d.vertical ? d.h : d.w;
        const halfGeo = new THREE.BoxGeometry(len / 2, WALL_H, 0.35);
        const a = new THREE.Mesh(halfGeo, mat), b = new THREE.Mesh(halfGeo, mat);
        a.castShadow = b.castShadow = true;
        g.add(a, b);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.04, 0.08), lampMat.clone());
        lamp.position.y = WALL_H / 2 + 0.03;
        g.add(lamp);
        g.position.set(d.cx, WALL_H / 2, d.cy);
        if (d.vertical) g.rotation.y = Math.PI / 2;
        g.userData = { a, b, len, lamp };
        return g;
    });
    return doors;
}

export function updateDoors(doorMeshes, lv) {
    lv.doors.forEach((d, i) => {
        const g = doorMeshes[i];
        const { a, b, len, lamp } = g.userData;
        const o = d.open;
        const off = len / 4 + o * (len / 2 - 0.05);
        a.position.x = -off; b.position.x = off;
        a.visible = b.visible = o < 0.98;
        lamp.visible = !d.target;
        lamp.material.color.setHex(0xff2a1a);
    });
}

// ------------------------------------------------------------------ Items

function holoSprite(glyph, color, size = 0.9) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, color + 'aa'); grd.addColorStop(1, color + '00');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 16;
    g.fillText(glyph, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1);
    return s;
}

function textCanvas(lines, color, w = 256, h = 128) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#031008'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.font = 'bold 22px monospace';
    lines.forEach((l, i) => g.fillText(l, 10, 30 + i * 26));
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, w, 1); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const SHOP_GLYPH = { medkit: ['✚', '#ff5a5a'], armor: ['⬢', '#5ad8ff'], ammo: ['▤', '#ffd23a'], grenade: ['●', '#ffa83a'], pulse: ['◉', '#a98bff'], mod: ['⬆', '#6aff8a'], stim: ['?', '#ff6ae0'] };

export function makeItem(it, th, weaponModel) {
    const g = new THREE.Group();
    g.position.set(it.x, 0, it.y);
    const mat = makeLitMaterial('items', { roughness: 0.45, metalness: 0.5 });
    const ud = { kind: it.kind, anim: [] };
    switch (it.kind) {
    case 'chest': {
        const base = new THREE.Mesh(merge([
            box(1.4, 0.55, 0.85, 0, 0.275, 0, 0x2e3a2a), box(1.46, 0.08, 0.9, 0, 0.05, 0, 0x14180f),
            box(1.2, 0.06, 0.02, 0, 0.3, 0.43, th.accent, 1), box(0.06, 0.45, 0.88, -0.5, 0.28, 0, 0x14180f), box(0.06, 0.45, 0.88, 0.5, 0.28, 0, 0x14180f),
        ]), mat);
        const lid = new THREE.Mesh(merge([box(1.42, 0.22, 0.87, 0, 0.11, 0.43, 0x36452f), box(1.2, 0.04, 0.02, 0, 0.12, 0.87, 0xffd23a, 1)]), mat);
        lid.position.set(0, 0.55, -0.43);
        g.add(base, lid);
        const glow = holoSprite('★', '#ffd23a', 1.1);
        glow.position.y = 1.5;
        g.add(glow);
        ud.lid = lid; ud.glow = glow;
        break;
    }
    case 'shopterm': {
        const m = new THREE.Mesh(merge([box(2.4, 2.2, 0.5, 0, 1.1, 0, 0x2a3036), box(2.6, 0.14, 0.6, 0, 2.25, 0, 0x14181c)]), mat);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1), new THREE.MeshBasicMaterial({ map: textCanvas(['REQUISITION', '> SALVAGE ACCEPTED', '> SELECT ITEM'], '#ffd23a'), toneMapped: false }));
        scr.position.set(0, 1.35, 0.26);
        g.add(m, scr);
        break;
    }
    case 'shopitem': {
        const ped = new THREE.Mesh(merge([cyl(0.42, 0.5, 0.7, 12, 0, 0.35, 0, 0x2a3036), cyl(0.44, 0.44, 0.05, 12, 0, 0.72, 0, th.accent, 1.2)]), mat);
        g.add(ped);
        let holo;
        if (it.item === 'weapon' && weaponModel) {
            holo = weaponModel(it.weapon);
            holo.scale.setScalar(1.3);
            holo.position.y = 1.25;
        } else {
            const [gl, c] = SHOP_GLYPH[it.item] ?? ['?', '#fff'];
            holo = holoSprite(gl, c, 0.85);
            holo.position.y = 1.25;
        }
        g.add(holo);
        ud.holo = holo;
        break;
    }
    case 'med': {
        const m = new THREE.Mesh(merge([
            box(1.2, 1.0, 0.8, 0, 0.5, 0, 0xd8dee0), box(1.26, 0.1, 0.86, 0, 1.02, 0, 0x8a9294),
            box(0.5, 0.14, 0.02, 0, 0.62, 0.41, 0xff2a2a, 1.5), box(0.14, 0.5, 0.02, 0, 0.62, 0.41, 0xff2a2a, 1.5),
            cyl(0.3, 0.3, 0.06, 16, 0, 1.08, 0, 0x6affd0, 1.2),
        ]), mat);
        g.add(m);
        const s = holoSprite('✚', '#ff5a5a', 1.0);
        s.position.y = 1.7;
        g.add(s);
        ud.glow = s;
        break;
    }
    case 'terminal': {
        const m = new THREE.Mesh(merge([box(1.0, 1.1, 0.5, 0, 0.55, 0, 0x2a3036), box(0.9, 0.5, 0.1, 0, 1.25, -0.1, 0x14181c)]), mat);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42), new THREE.MeshBasicMaterial({ map: textCanvas(['DATA LOG', '> ' + (it.log + 1) + '/3', '> PRESS USE'], '#6aff8a', 192, 100), toneMapped: false }));
        scr.position.set(0, 1.25, -0.04);
        scr.rotation.x = -0.25;
        g.add(m, scr);
        if (it.wall) g.rotation.y = 0;
        const s = holoSprite('▣', '#6aff8a', 0.7);
        s.position.y = 1.9;
        g.add(s);
        ud.glow = s;
        break;
    }
    case 'elevator': {
        const m = new THREE.Mesh(merge([
            cyl(1.5, 1.6, 0.16, 24, 0, 0.08, 0, 0x30363c),
            cyl(1.3, 1.3, 0.04, 24, 0, 0.18, 0, th.strip, 1.4),
            ...[0, 1, 2, 3].map((i) => box(0.12, 2.4, 0.12, Math.cos(i * Math.PI / 2 + 0.78) * 1.5, 1.2, Math.sin(i * Math.PI / 2 + 0.78) * 1.5, 0x30363c)),
        ]), mat);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: th.strip, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = 2;
        const s = holoSprite('▼', '#' + new THREE.Color(th.strip).getHexString(), 1.2);
        s.position.y = 2.8;
        g.add(m, beam, s);
        ud.glow = s; ud.beam = beam;
        break;
    }
    case 'pad': {
        const m = new THREE.Mesh(merge([
            ...[0, 1, 2, 3].map((i) => box(0.3, 0.12, 0.3, Math.cos(i * Math.PI / 2 + 0.78) * 2.6, 0.06, Math.sin(i * Math.PI / 2 + 0.78) * 2.6, th.accent, 1.5)),
        ]), mat);
        g.add(m);
        break;
    }
    case 'dropship': {
        const hull = new THREE.Mesh(merge([
            box(2.6, 1.3, 5.2, 0, 1.4, 0, 0x4a5058), box(1.8, 0.9, 1.6, 0, 1.6, -3.0, 0x3a4048),
            box(1.4, 0.5, 0.9, 0, 1.95, -3.4, 0x6affd8, 0.7),
            box(6.4, 0.25, 1.8, 0, 1.5, 0.6, 0x3a4048), box(0.9, 0.9, 1.6, -3.0, 1.3, 0.8, 0x30363c), box(0.9, 0.9, 1.6, 3.0, 1.3, 0.8, 0x30363c),
            cyl(0.42, 0.42, 0.2, 12, -3.0, 1.3, 1.65, 0x3ad8ff, 1.6, Math.PI / 2), cyl(0.42, 0.42, 0.2, 12, 3.0, 1.3, 1.65, 0x3ad8ff, 1.6, Math.PI / 2),
            box(2.0, 0.08, 1.4, 0, 0.7, 2.4, 0x2a3036), box(0.12, 0.7, 0.12, -1.0, 0.35, -1.6, 0x2a3036), box(0.12, 0.7, 0.12, 1.0, 0.35, -1.6, 0x2a3036), box(0.12, 0.7, 0.12, 0, 0.35, 1.6, 0x2a3036),
            box(0.3, 0.06, 0.06, -1.3, 2.1, 0, 0xff2a2a, 2), box(0.3, 0.06, 0.06, 1.3, 2.1, 0, 0x3aff6a, 2),
        ]), mat);
        hull.rotation.y = Math.PI;
        g.add(hull);
        const s = holoSprite('⇪', '#6affd8', 1.4);
        s.position.y = 3.6;
        g.add(s);
        ud.glow = s; ud.hull = hull;
        break;
    }
    case 'cocoon': {
        const m = new THREE.Mesh(merge([
            sph(0.75, 0, 1.1, 0, 0x4a2448, 0, 1, 1.7, 0.9, 14),
            sph(0.35, 0, 1.25, 0.45, 0xffd27a, 0.4, 0.8, 1.6, 0.5, 10),
            sph(0.9, 0, 0.15, 0, 0x2a1028, 0, 1.2, 0.3, 1, 12),
        ]), mat);
        g.add(m);
        const s = holoSprite('♥', '#ffd27a', 1.1);
        s.position.y = 2.7;
        g.add(s);
        ud.glow = s;
        break;
    }
    default: break;
    }
    g.userData = ud;
    return g;
}

export function animateItem(g, it, t) {
    const ud = g.userData;
    if (ud.glow) { ud.glow.position.y += Math.sin(t * 2.4 + it.x) * 0.002; ud.glow.material.opacity = it.used ? 0 : 0.7 + 0.3 * Math.sin(t * 3); }
    if (ud.holo) {
        ud.holo.rotation.y = t * 1.2;
        ud.holo.visible = !it.used;
        if (ud.holo.material) ud.holo.material.opacity = 0.75 + 0.25 * Math.sin(t * 4 + it.x);
    }
    if (ud.lid) ud.lid.rotation.x += ((it.used ? -1.9 : 0) - ud.lid.rotation.x) * 0.15;
    if (ud.beam) ud.beam.material.opacity = 0.1 + 0.05 * Math.sin(t * 5);
}

// ------------------------------------------------------------------ Decals

export class Decals {
    constructor(lv) {
        this.res = Q.decalRes;
        this.canvas = document.createElement('canvas');
        this.canvas.width = lv.w * this.res;
        this.canvas.height = lv.h * this.res;
        this.g = this.canvas.getContext('2d');
        this.tex = new THREE.CanvasTexture(this.canvas);
        this.tex.colorSpace = THREE.SRGBColorSpace;
        this.tex.flipY = false;
        this.tex.minFilter = THREE.LinearFilter;
        this.tex.generateMipmaps = false;
        this.dirty = false;
        this.timer = 0;
        this.count = 0;
    }
    splat(x, y, r, color, alpha = 0.8, blobs = 6, seed = Math.random()) {
        const g = this.g, R = this.res;
        let s = seed * 9973;
        const rnd = () => { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; };
        g.fillStyle = color;
        for (let i = 0; i < blobs; i++) {
            const a = rnd() * Math.PI * 2, d = rnd() * r * 0.9;
            const br = r * (0.25 + rnd() * 0.5);
            g.globalAlpha = alpha * (0.5 + rnd() * 0.5);
            g.beginPath();
            g.ellipse((x + Math.cos(a) * d) * R, (y + Math.sin(a) * d) * R, br * R, br * R * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
            g.fill();
        }
        // Droplets.
        for (let i = 0; i < blobs; i++) {
            const a = rnd() * Math.PI * 2, d = r * (1 + rnd() * 1.2);
            g.globalAlpha = alpha * 0.7;
            g.beginPath();
            g.arc((x + Math.cos(a) * d) * R, (y + Math.sin(a) * d) * R, R * r * 0.08 * (1 + rnd()), 0, Math.PI * 2);
            g.fill();
        }
        g.globalAlpha = 1;
        this.dirty = true;
        this.count++;
    }
    scorch(x, y, r) {
        const g = this.g, R = this.res;
        const grd = g.createRadialGradient(x * R, y * R, 0, x * R, y * R, r * R);
        grd.addColorStop(0, 'rgba(8,6,5,0.85)'); grd.addColorStop(0.6, 'rgba(12,10,8,0.5)'); grd.addColorStop(1, 'rgba(12,10,8,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x * R, y * R, r * R, 0, Math.PI * 2); g.fill();
        this.dirty = true;
    }
    update(dt) {
        this.timer -= dt;
        if (this.dirty && this.timer <= 0) { this.tex.needsUpdate = true; this.dirty = false; this.timer = 0.12; }
    }
    dispose() { this.tex.dispose(); }
}

// ------------------------------------------------------------------ Build

export function buildLevel(lv, weaponModel) {
    const group = new THREE.Group();
    group.name = 'level';
    const lm = bakeLightmap(lv);
    LM.uLM.value = lm;
    LM.uLMSize.value.set(lv.w, lv.h);
    const flagTex = floorData(lv);
    const decals = new Decals(lv);
    const floor = makeFloor(lv, decals.tex, flagTex);
    const walls = makeWalls(lv);
    const props = makeProps(lv);
    const doors = makeDoors(lv);
    group.add(floor, walls, ...props.meshes, ...doors);
    // A void plane beneath so gaps never show the clear colour.
    const voidM = new THREE.Mesh(new THREE.PlaneGeometry(lv.w + 80, lv.h + 80), new THREE.MeshBasicMaterial({ color: 0x010102 }));
    voidM.rotation.x = -Math.PI / 2;
    voidM.position.set(lv.w / 2, -0.05, lv.h / 2);
    group.add(voidM);
    return {
        group, floor, walls, props, doors, decals, flagTex, lightmap: lm,
        setVisited(room) {
            const d = flagTex.image.data;
            for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) d[(y * lv.w + x) * 4 + 1] = 255;
            // Door tiles and the strip just outside.
            for (const id of room.doors) { const dr = lv.doors[id]; for (let y = dr.y; y < dr.y + dr.h; y++) for (let x = dr.x; x < dr.x + dr.w; x++) d[(y * lv.w + x) * 4 + 1] = 255; }
            flagTex.needsUpdate = true;
        },
        dispose() {
            group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
            lm.dispose(); flagTex.dispose(); decals.dispose();
        },
    };
}
