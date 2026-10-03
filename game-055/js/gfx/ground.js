// The ground. Terrain is baked into 512-unit-tall chunks (albedo+material
// and emissive, via MRT) as they scroll into view, decorated with trees and
// huts drawn by the sprite batch, and scarred later by craters and tank
// treads stamped straight into the same textures. Each frame the chunks are
// drawn with a shader that animates water and lava and adds cloud shadows,
// explosion light and the Kestrel's searchlight.

import { program, texture, framebuffer, FS_VS, drawFS } from './gl.js';
import { BAKE_FS } from './terrainGLSL.js';
import { BIOME_IDS, LAND, WATER, seedPhase } from '../sim/terrain.js';
import { hash2 } from '../sim/noise.js';
import { RNG } from '../rng.js';

export const CH = 512;
export const MAX_LIGHTS = 16;

// Per-biome lighting and colour for the runtime ground shader and the post pass.
export const LOOK = {
    coast: { ambient: [1.0, 0.94, 0.86], sky: [0.55, 0.72, 0.9], sun: [1.0, 0.86, 0.7], deep: [0.02, 0.14, 0.28], cloud: 0.5, grade: { lift: [0.0, 0.01, 0.03], gain: [1.04, 1.0, 0.95], sat: 1.08, con: 1.04 }, fog: [0.85, 0.75, 0.7] },
    jungle: { ambient: [0.86, 0.92, 0.82], sky: [0.5, 0.6, 0.55], sun: [0.9, 0.95, 0.8], deep: [0.06, 0.12, 0.08], cloud: 0.7, grade: { lift: [0.0, 0.02, 0.01], gain: [0.95, 1.02, 0.94], sat: 1.05, con: 1.06 }, fog: [0.5, 0.6, 0.5] },
    desert: { ambient: [1.05, 0.88, 0.72], sky: [0.9, 0.7, 0.5], sun: [1.0, 0.8, 0.55], deep: [0.04, 0.26, 0.32], cloud: 0.25, grade: { lift: [0.03, 0.01, 0.0], gain: [1.06, 0.98, 0.88], sat: 1.02, con: 1.05 }, fog: [0.95, 0.72, 0.45] },
    arctic: { ambient: [0.78, 0.84, 0.98], sky: [0.7, 0.8, 0.95], sun: [0.8, 0.85, 1.0], deep: [0.01, 0.06, 0.1], cloud: 0.55, grade: { lift: [0.01, 0.02, 0.05], gain: [0.95, 1.0, 1.06], sat: 0.92, con: 1.06 }, fog: [0.8, 0.86, 0.95] },
    city: { ambient: [0.36, 0.38, 0.58], sky: [0.25, 0.2, 0.45], sun: [0.6, 0.65, 1.0], deep: [0.01, 0.02, 0.05], cloud: 0.3, grade: { lift: [0.02, 0.0, 0.05], gain: [1.0, 0.95, 1.08], sat: 1.15, con: 1.1 }, fog: [0.2, 0.15, 0.35], night: true },
    volcano: { ambient: [0.7, 0.55, 0.52], sky: [0.5, 0.25, 0.15], sun: [1.0, 0.55, 0.35], deep: [0.1, 0.02, 0.0], cloud: 0.4, grade: { lift: [0.04, 0.0, 0.0], gain: [1.08, 0.94, 0.86], sat: 1.1, con: 1.12 }, fog: [0.4, 0.15, 0.08] },
};

const GROUND_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform vec4 uView;
uniform vec4 uRect;   // chunk: x0, top screen y, width, height (field units)
out vec2 vUV;
out vec2 vField;
void main() {
    vec2 p = uRect.xy + aCorner * uRect.zw;
    vField = p;
    vUV = vec2(aCorner.x, 1.0 - aCorner.y);
    gl_Position = vec4(p * uView.xy + uView.zw, 0.0, 1.0);
}`;

const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vField;
out vec4 o;
uniform sampler2D uAlb;
uniform sampler2D uEm;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uScroll;
uniform float uH;
uniform vec3 uAmbient;
uniform vec3 uSky;
uniform vec3 uSunCol;
uniform vec3 uDeep;
uniform float uCloud;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform int uNumLights;
uniform vec4 uSearch;   // x, y, angle, strength
uniform float uFlash;   // lightning
uniform float uEmMul;
void main() {
    vec4 a = texture(uAlb, vUV);
    vec3 em = texture(uEm, vUV).rgb * 4.0 * uEmMul;
    vec3 base = a.rgb;
    vec3 col = base;
    float mat = a.a;
    vec2 tp = vec2(vField.x, uScroll + uH - vField.y);   // terrain coords
    vec3 extra = vec3(0.0);
    if (mat > 0.25 && mat < 0.85) {
        float depth = clamp((mat - 0.3) / 0.5, 0.0, 1.0);
        vec2 q1 = tp / 210.0 + vec2(uTime * 0.018, uTime * 0.011);
        vec2 q2 = tp / 130.0 - vec2(uTime * 0.013, -uTime * 0.02);
        vec4 n1 = texture(uNoise, q1), n2 = texture(uNoise, q2);
        vec2 nrm = (vec2(n1.r, n1.a) - 0.5) * 0.45 + (vec2(n2.g, n2.r) - 0.5) * 0.25;
        vec3 N = normalize(vec3(nrm, 1.0));
        vec3 L = normalize(vec3(-0.55, 0.6, 0.72));
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(N, H), 0.0), 140.0);
        float fres = 0.3 + 0.4 * (1.0 - N.z) * 6.0;
        col = mix(base, uDeep, smoothstep(0.15, 1.0, depth) * 0.6);
        col *= 0.85 + (nrm.x + nrm.y) * 0.35;
        col += uSky * fres * 0.18;
        extra += uSunCol * spec * 0.45 * (0.3 + depth);
        // caustics in the shallows
        float c = texture(uNoise, tp / 60.0 + vec2(uTime * 0.04, 0.0)).g;
        float c2 = texture(uNoise, tp / 47.0 - vec2(0.0, uTime * 0.03)).r;
        float caus = pow(1.0 - abs(c - c2), 16.0);
        col += vec3(0.8, 1.0, 0.95) * caus * smoothstep(0.35, 0.0, depth) * 0.22;
        // foam along the shore, breathing in and out
        float fn = texture(uNoise, tp / 30.0 + vec2(uTime * 0.03)).g;
        float wave = 0.035 + 0.02 * sin(uTime * 1.6 + fn * 6.0 + tp.x * 0.02);
        float foam = smoothstep(wave, wave * 0.3, depth) * smoothstep(0.35, 0.65, fn + 0.25);
        col = mix(col, vec3(0.9, 0.95, 1.0), foam * 0.7);
    } else if (mat >= 0.85) {
        float heat = (mat - 0.9) / 0.1;
        float f = texture(uNoise, tp / 90.0 + vec2(0.0, uTime * 0.02)).r;
        float f2 = texture(uNoise, tp / 37.0 - vec2(uTime * 0.03, 0.0)).g;
        em *= 0.65 + 0.55 * (f * f2 * 2.0) + 0.15 * sin(uTime * 2.0 + tp.y * 0.05);
    }
    col *= uAmbient;
    // drifting cloud shadows
    float cs = texture(uNoise, tp / 1100.0 + vec2(uTime * 0.006, uTime * 0.01)).a;
    cs = smoothstep(0.45, 0.68, cs) * uCloud;
    col *= 1.0 - cs * 0.4;
    extra *= 1.0 - cs;
    // explosion and muzzle light
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uNumLights) break;
        vec2 d = vField - uLights[i].xy;
        float r = uLights[i].z;
        float f = max(0.0, 1.0 - dot(d, d) / (r * r));
        col += base * uLightCol[i] * f * f * uLights[i].w;
    }
    // searchlight cone
    if (uSearch.w > 0.0) {
        vec2 d = vField - uSearch.xy;
        float dist = length(d);
        vec2 dir = vec2(cos(uSearch.z), sin(uSearch.z));
        float ang = dot(d / max(dist, 1.0), dir);
        float cone = smoothstep(0.86, 0.95, ang) * smoothstep(320.0, 60.0, dist);
        float pool = exp(-dist * dist / 900.0) * 0.5;
        col += base * vec3(1.0, 0.97, 0.85) * (cone * 2.2 + pool) * uSearch.w;
    }
    col += base * uFlash * vec3(0.7, 0.8, 1.0);
    o = vec4(col + extra + em, 1.0);
}`;

// ---------------------------------------------------------------- noise texture

function makeNoiseData(N = 256) {
    // four octaves of periodic value noise in RGBA
    const data = new Uint8Array(N * N * 4);
    const freqs = [8, 16, 32, 4];
    for (let c = 0; c < 4; c++) {
        const f = freqs[c];
        const cellv = new Float32Array(f * f);
        for (let i = 0; i < f * f; i++) cellv[i] = hash2(i % f, Math.floor(i / f), 4000 + c);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            let v = 0, amp = 0.5, norm = 0;
            for (let o = 0; o < 3; o++) {
                const ff = f << o;
                const gx = x / N * ff, gy = y / N * ff;
                const ix = Math.floor(gx), iy = Math.floor(gy);
                const fx = gx - ix, fy = gy - iy;
                const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
                const h = (a, b) => hash2(((a % ff) + ff) % ff, ((b % ff) + ff) % ff, 4000 + c * 10 + o);
                const s = h(ix, iy) * (1 - ux) * (1 - uy) + h(ix + 1, iy) * ux * (1 - uy) + h(ix, iy + 1) * (1 - ux) * uy + h(ix + 1, iy + 1) * ux * uy;
                v += s * amp; norm += amp; amp *= 0.5;
            }
            data[(y * N + x) * 4 + c] = Math.round(v / norm * 255);
        }
    }
    return data;
}

// ---------------------------------------------------------------- decor rules

function decorFor(terrain, x, y, r) {
    const k = terrain.kind(x, y);
    if (k !== LAND) return null;
    const m = terrain.moisture(x, y);
    switch (terrain.biome) {
        case 'coast': {
            const h = terrain.height(x, y);
            if (h < 0.535) return r.chance(0.05) ? ['palm', 0.9 + r.float() * 0.4] : null;
            if (h > 0.66) return r.chance(0.25) ? ['rock' + r.int(0, 1), 0.7 + r.float() * 0.6] : null;
            const village = hash2(Math.floor(x / 90), Math.floor(y / 90), terrain.seed + 5) < 0.12;
            if (village && h < 0.6 && r.chance(0.45)) return [r.chance(0.6) ? 'house' : 'hut', 0.9 + r.float() * 0.3, true];
            if (m > 0.5 && r.chance(0.85)) return ['tree' + r.int(0, 2), 0.8 + r.float() * 0.6];
            if (m > 0.42 && r.chance(0.3)) return ['bush', 0.8 + r.float() * 0.6];
            return r.chance(0.04) ? ['tree2', 0.8] : null;
        }
        case 'jungle': {
            const d = Math.abs(x - terrain.riverCX(y));
            if (d < 90) return r.chance(0.08) ? ['palm', 0.9 + r.float() * 0.5] : null;
            if (m > 0.55 && r.chance(0.5)) return ['jtree', 0.8 + r.float() * 0.7];
            if (r.chance(0.12)) return [r.chance(0.5) ? 'palm' : 'tree1', 0.9 + r.float() * 0.4];
            if (hash2(Math.floor(x / 120), Math.floor(y / 120), terrain.seed + 9) < 0.08 && r.chance(0.4)) return ['hut', 1, true];
            return null;
        }
        case 'desert': {
            if (terrain.roadDist(x, y) < 44) return r.chance(0.006) ? ['wreck', 1, true] : null;
            const h = terrain.height(x, y);
            if (h < 0.3) return r.chance(0.3) ? ['palm', 0.8 + r.float() * 0.5] : null;
            if (h > 0.64) return r.chance(0.15) ? ['rock1', 0.8 + r.float() * 0.8] : null;
            if (r.chance(0.03)) return ['cactus', 0.8 + r.float() * 0.5];
            if (r.chance(0.012)) return ['tent', 1, true];
            return r.chance(0.02) ? ['rock1', 0.5 + r.float() * 0.4] : null;
        }
        case 'arctic': {
            const h = terrain.height(x, y);
            if (h < 0.47) return null;
            if (h > 0.68) return r.chance(0.18) ? ['rock0', 0.8 + r.float() * 0.8] : null;
            if (m > 0.5 && r.chance(0.7)) return ['snowpine', 0.8 + r.float() * 0.6];
            return r.chance(0.05) ? ['snowpine', 0.7] : null;
        }
        case 'city': {
            if (terrain.street(x, y)) return null;
            const mx = (x + 2000) % 150, my = y % 150;
            const blk = [Math.floor((x + 2000) / 150), Math.floor(y / 150)];
            const split = hash2(blk[0], blk[1], terrain.seed + 801);
            const lots = split < 0.33 ? [2, 2] : split < 0.66 ? [3, 2] : [2, 3];
            const lc = [Math.floor((mx - 24) / (126 / lots[0])), Math.floor((my - 24) / (126 / lots[1]))];
            const kind = hash2(blk[0] * 4 + lc[0], blk[1] * 4 + lc[1], terrain.seed + 821);
            return kind < 0.08 && r.chance(0.7) ? ['tree' + r.int(0, 1), 0.8 + r.float() * 0.5] : null;
        }
        case 'volcano': {
            if (y >= terrain.platformY) return null;
            return r.chance(0.025) ? [r.chance(0.6) ? 'deadtree' : 'rockd', 0.8 + r.float() * 0.6] : null;
        }
    }
    return null;
}

// ---------------------------------------------------------------- Ground

export class Ground {
    constructor(gl, batch, hdr) {
        this.gl = gl;
        this.batch = batch;
        this.bake = program(gl, FS_VS, BAKE_FS, 'bake');
        this.draw_ = program(gl, GROUND_VS, GROUND_FS, 'ground');
        this.noise = texture(gl, 256, 256, { data: makeNoiseData(), wrap: gl.REPEAT });
        this.chunks = new Map();
        this.pool = [];
        this.emFormat = hdr ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : {};
        const quad = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        this.terrain = null;
        this.x0 = -200; this.cw = 940; this.density = 1;
        this.lights = new Float32Array(MAX_LIGHTS * 4);
        this.lightCol = new Float32Array(MAX_LIGHTS * 3);
        this.nLights = 0;
        this.bakedThisFrame = 0;
    }

    setTerrain(terrain) {
        this.terrain = terrain;
        this.look = LOOK[terrain.biome];
        this.flush();
    }

    /** Visible terrain width (field units) and texel density; rebakes if they change much. */
    layout(x0, cw, density) {
        const changed = Math.abs(cw - this.cw) > 8 || Math.abs(density - this.density) > 0.2 || Math.abs(x0 - this.x0) > 4;
        this.x0 = x0; this.cw = cw; this.density = density;
        if (changed) this.flush(true);
    }

    flush(freeAll = false) {
        for (const c of this.chunks.values()) this.release(c, freeAll);
        this.chunks.clear();
        if (freeAll) {
            for (const c of this.pool) this.destroy(c);
            this.pool.length = 0;
        }
    }

    release(c, destroy) { if (destroy) this.destroy(c); else this.pool.push(c); }
    destroy(c) { const gl = this.gl; gl.deleteTexture(c.alb); gl.deleteTexture(c.em); gl.deleteFramebuffer(c.fb); }

    alloc() {
        const gl = this.gl;
        const tw = Math.min(4096, Math.ceil(this.cw * this.density)), th = Math.min(2048, Math.ceil(CH * this.density));
        let c = this.pool.find((p) => p.tw === tw && p.th === th);
        if (c) { this.pool.splice(this.pool.indexOf(c), 1); return c; }
        const alb = texture(gl, tw, th);
        const em = texture(gl, tw, th, this.emFormat);
        const fb = framebuffer(gl, [alb, em]);
        return { alb, em, fb, tw, th };
    }

    bakeChunk(k) {
        const gl = this.gl;
        const c = this.alloc();
        c.k = k;
        const y0 = k * CH;
        const t = this.terrain;
        gl.bindFramebuffer(gl.FRAMEBUFFER, c.fb);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.viewport(0, 0, c.tw, c.th);
        gl.disable(gl.BLEND);
        const P = this.bake;
        gl.useProgram(P.p);
        gl.uniform2f(P.u.uOrigin, this.x0, y0);
        gl.uniform2f(P.u.uSize, this.cw, CH);
        gl.uniform1i(P.u.uSeed, t.seed);
        gl.uniform1i(P.u.uBiome, BIOME_IDS.indexOf(t.biome));
        gl.uniform1f(P.u.uPhase, seedPhase(t.seed));
        gl.uniform1f(P.u.uPlatformY, Number.isFinite(t.platformY) ? t.platformY : 1e9);
        gl.uniform1f(P.u.uTexel, 1 / this.density);
        gl.bindVertexArray(null);
        drawFS(gl);
        // decor
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
        gl.colorMask(true, true, true, false);
        const B = this.batch;
        const r = new RNG((t.seed * 7919 + k * 104729) >>> 0);
        B.layers.decor.n = 0;
        const step = 15;
        const shadows = [];
        for (let y = y0 + step / 2; y < y0 + CH; y += step) {
            for (let x = this.x0 + step / 2; x < this.x0 + this.cw; x += step) {
                const px = x + r.range(-6, 6), py = y + r.range(-6, 6);
                const d = decorFor(t, px, py, r);
                if (!d) continue;
                const s = B.spr(d[0]);
                const sc = d[1];
                const rot = d[2] ? r.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + r.range(-0.15, 0.15) : r.float() * Math.PI * 2;
                const sy = y0 + CH - py;
                shadows.push([s, px + 2.5 * sc, sy + 3.5 * sc, rot, sc]);
                B.push('decor', s, px, sy, rot, sc, sc);
            }
        }
        const view = [2 / this.cw, -2 / CH, -1 - 2 * this.x0 / this.cw, 1];
        if (shadows.length) {
            const L = B.layers.decor;
            const n = L.n;
            const keep = L.data.slice(0, n * 16);
            L.n = 0;
            for (const [s, x, y, rot, sc] of shadows) B.push('decor', s, x, y, rot, sc * 1.05, sc * 1.05, 1, 1, 1, 0.45, 0, 1);
            B.begin(view);
            B.drawLayer('decor');
            L.data.set(keep); L.n = n;
            B.drawLayer('decor');
            L.n = 0;
        }
        gl.colorMask(true, true, true, true);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.chunks.set(k, c);
        return c;
    }

    /** Make sure every chunk under the view exists; prefetch one ahead. */
    update(scroll, H, prefetch = true) {
        this.bakedThisFrame = 0;
        const k0 = Math.floor((scroll - 40) / CH), k1 = Math.floor((scroll + H + 40) / CH);
        for (const [k, c] of this.chunks) if (k < k0 - 1 || k > k1 + 2) { this.chunks.delete(k); this.release(c, false); }
        for (let k = k0; k <= k1; k++) if (!this.chunks.has(k)) { this.bakeChunk(k); this.bakedThisFrame++; }
        if (prefetch && !this.chunks.has(k1 + 1) && this.bakedThisFrame === 0) this.bakeChunk(k1 + 1);
        while (this.pool.length > 3) this.destroy(this.pool.pop());
    }

    /**
     * Stamp decals into the terrain: list of [spriteName, x, terrainY, rot, scale, alpha].
     * Uses the batch's 'decor' layer.
     */
    stamp(list) {
        if (!list.length) return;
        const gl = this.gl, B = this.batch;
        const byChunk = new Map();
        for (const st of list) {
            const s = B.spr(st[0]);
            if (!s) continue;
            const reach = Math.max(s.w, s.h) * st[4] * 0.75;
            const ka = Math.floor((st[2] - reach) / CH), kb = Math.floor((st[2] + reach) / CH);
            for (let k = ka; k <= kb; k++) {
                if (!this.chunks.has(k)) continue;
                if (!byChunk.has(k)) byChunk.set(k, []);
                byChunk.get(k).push(st);
            }
        }
        for (const [k, sts] of byChunk) {
            const c = this.chunks.get(k);
            gl.bindFramebuffer(gl.FRAMEBUFFER, c.fb);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
            gl.viewport(0, 0, c.tw, c.th);
            gl.colorMask(true, true, true, false);
            B.layers.decor.n = 0;
            const y0 = k * CH;
            for (const [name, x, ty, rot, sc, a] of sts) B.push('decor', B.spr(name), x, y0 + CH - ty, rot, sc, sc, 1, 1, 1, a, 0, 0);
            B.begin([2 / this.cw, -2 / CH, -1 - 2 * this.x0 / this.cw, 1]);
            B.drawLayer('decor');
            B.layers.decor.n = 0;
            gl.colorMask(true, true, true, true);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setLights(lights) {
        const n = Math.min(MAX_LIGHTS, lights.length);
        for (let i = 0; i < n; i++) {
            const l = lights[i];
            this.lights.set([l.x, l.y, l.r, l.i], i * 4);
            this.lightCol.set(l.c, i * 3);
        }
        this.nLights = n;
    }

    draw(view, scroll, H, time, o) {
        const gl = this.gl;
        const P = this.draw_;
        const look = this.look;
        gl.useProgram(P.p);
        gl.disable(gl.BLEND);
        gl.uniform4fv(P.u.uView, view);
        gl.uniform1f(P.u.uTime, time);
        gl.uniform1f(P.u.uScroll, scroll);
        gl.uniform1f(P.u.uH, H);
        gl.uniform3fv(P.u.uAmbient, look.ambient.map((v) => v * (1 + o.flash * 0.6)));
        gl.uniform3fv(P.u.uSky, look.sky);
        gl.uniform3fv(P.u.uSunCol, look.sun);
        gl.uniform3fv(P.u.uDeep, look.deep);
        gl.uniform1f(P.u.uCloud, look.cloud);
        gl.uniform4fv(P.u.uLights, this.lights);
        gl.uniform3fv(P.u.uLightCol, this.lightCol);
        gl.uniform1i(P.u.uNumLights, this.nLights);
        gl.uniform4fv(P.u.uSearch, o.search || [0, 0, 0, 0]);
        gl.uniform1f(P.u.uFlash, o.flash || 0);
        gl.uniform1f(P.u.uEmMul, o.emMul ?? 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.noise);
        gl.uniform1i(P.u.uNoise, 2);
        gl.uniform1i(P.u.uAlb, 0);
        gl.uniform1i(P.u.uEm, 1);
        gl.bindVertexArray(this.vao);
        for (const [k, c] of this.chunks) {
            const top = scroll + H - (k + 1) * CH;
            if (top > H + 10 || top + CH < -10) continue;
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.alb);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.em);
            gl.uniform4f(P.u.uRect, this.x0, top, this.cw, CH);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.bindVertexArray(null);
    }
}
