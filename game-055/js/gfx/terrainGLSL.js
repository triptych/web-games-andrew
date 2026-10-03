// The terrain baker's fragment shader. The noise functions and the
// land/water/lava tests at the top are line-for-line twins of sim/noise.js
// and sim/terrain.js; everything after "colouring" is GPU-only decoration.
//
// Output 0: lit albedo (rgb) + material in alpha (0 land, 0.3..0.8 water by
// depth, 0.9..1 lava by heat). Output 1: emissive light (neon, lava, lamps).

export const BAKE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 oAlb;
layout(location = 1) out vec4 oEm;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform int uSeed;
uniform int uBiome;
uniform float uPhase;
uniform float uPlatformY;
uniform float uTexel;

// ------------------------------------------------ shared with sim/noise.js
float hash2(int ix, int iy, int s) {
    uint h = uint(ix + 1073741824) * 374761393u + uint(iy + 1073741824) * 668265263u + uint(s) * 1442695041u;
    h = (h ^ (h >> 13u)) * 1274126177u;
    h = h ^ (h >> 16u);
    return float(h) / 4294967296.0;
}
float vnoise(vec2 p, int s) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    int ix = int(i.x), iy = int(i.y);
    float a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
    float c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
float fbm(vec2 p, int s, int oct) {
    float sum = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (i >= oct) break;
        sum += amp * vnoise(p, s + i * 17);
        norm += amp;
        p = vec2(1.6 * p.x - 1.2 * p.y, 1.2 * p.x + 1.6 * p.y);
        amp *= 0.5;
    }
    return sum / norm;
}
float ridged(vec2 p, int s, int oct) {
    float sum = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (i >= oct) break;
        sum += amp * (1.0 - abs(2.0 * vnoise(p, s + i * 17) - 1.0));
        norm += amp;
        p = vec2(1.6 * p.x - 1.2 * p.y, 1.2 * p.x + 1.6 * p.y);
        amp *= 0.5;
    }
    return sum / norm;
}

// ------------------------------------------------ shared with sim/terrain.js
float coastH(vec2 p) { return fbm(p / 380.0, uSeed, 5) + 0.35 * (vnoise(p / 1500.0, uSeed + 101) - 0.5); }
float riverCX(float y) { return 270.0 + 150.0 * sin(y / 520.0 + uPhase) + 120.0 * (vnoise(vec2(1.5, y / 600.0), uSeed + 31) - 0.5); }
float roadX(float y) { return 270.0 + 380.0 * (vnoise(vec2(7.5, y / 900.0), uSeed + 51) - 0.5); }
float arcticH(vec2 p) { return fbm(p / 360.0, uSeed, 5) + 0.3 * (vnoise(p / 1400.0, uSeed + 101) - 0.5); }
float canalX(float y) { return 270.0 + 130.0 * sin(y / 900.0 + uPhase); }

// ------------------------------------------------ colouring helpers (GPU only)
const vec3 SUN = normalize(vec3(-0.55, 0.6, 0.72));
float shade(float h, float hx, float hy, float k) {
    vec3 n = normalize(vec3(-(hx - h) * k, -(hy - h) * k, 1.0));
    return clamp(dot(n, SUN), 0.0, 1.0);
}
float cell(vec2 p, int s, out vec2 id) { // F2 - F1 Voronoi edge distance
    vec2 i = floor(p), f = p - i;
    float d1 = 9.0, d2 = 9.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        int cx = int(i.x) + x, cy = int(i.y) + y;
        vec2 o = vec2(hash2(cx, cy, s), hash2(cx, cy, s + 7));
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
    }
    return d2 - d1;
}
float h1(vec2 c, int s) { return hash2(int(c.x), int(c.y), s); }

void main() {
    vec2 p = uOrigin + vUV * uSize;
    vec3 alb = vec3(0.5);
    vec3 em = vec3(0.0);
    float mat = 0.0;
    float e = max(uTexel, 1.0) * 1.5;
    float det = fbm(p / 9.0, uSeed + 900, 3);        // fine grain
    float det2 = fbm(p / 45.0, uSeed + 950, 3);

    if (uBiome == 0) { // ---------------------------------------------- coast
        float sea = p.y > uPlatformY ? min(0.5, (p.y - uPlatformY) / 500.0) : 0.0;
        float h = coastH(p) - sea;
        float hx = coastH(p + vec2(e, 0.0)) - sea, hy = coastH(p + vec2(0.0, e)) - sea;
        if (h < 0.5) {
            float depth = clamp((0.5 - h) * 6.0, 0.0, 1.0);
            alb = mix(vec3(0.36, 0.72, 0.68), vec3(0.02, 0.14, 0.28), smoothstep(0.0, 0.6, depth));
            alb *= 0.9 + det * 0.2;
            mat = 0.3 + 0.5 * depth;
        } else {
            float m = fbm(p / 170.0, uSeed + 200, 3);
            float s = shade(h * 60.0, hx * 60.0, hy * 60.0, 1.0 / e * 6.0);
            vec3 sand = vec3(0.88, 0.80, 0.58) * (0.92 + det * 0.16);
            vec3 grass = mix(vec3(0.36, 0.55, 0.22), vec3(0.47, 0.62, 0.28), det2) * (0.85 + det * 0.3);
            vec3 forest = mix(vec3(0.12, 0.30, 0.12), vec3(0.2, 0.4, 0.16), det) ;
            vec3 rock = mix(vec3(0.48, 0.46, 0.41), vec3(0.62, 0.6, 0.55), det);
            float b = smoothstep(0.5, 0.505, h) * (1.0 - smoothstep(0.515, 0.535, h));
            alb = mix(grass, forest, smoothstep(0.5, 0.62, m));
            alb = mix(alb, rock, smoothstep(0.64, 0.7, h));
            alb = mix(alb, sand, smoothstep(0.535, 0.515, h));
            alb *= mix(vec3(0.75, 0.75, 0.8), vec3(1.0), smoothstep(0.5, 0.507, h)); // wet sand
            alb *= 0.55 + 0.6 * s;
            // fields near the coast
            if (h > 0.54 && h < 0.6 && m < 0.42) {
                vec2 q = p / 34.0;
                float rows = step(0.5, fract(q.x * 2.0 + floor(q.y) * 0.37));
                alb *= mix(0.92, 1.06, rows);
            }
        }
    } else if (uBiome == 1) { // --------------------------------------- jungle
        float cx = riverCX(p.y);
        float rw = 48.0 + 26.0 * vnoise(vec2(3.5, p.y / 350.0), uSeed + 37);
        float d = abs(p.x - cx) + (fbm(p / 90.0, uSeed + 41, 3) - 0.5) * 40.0;
        float h = fbm(p / 300.0, uSeed, 4);
        if (d < rw || h < 0.28) {
            float depth = d < rw ? clamp((rw - d) / rw * 1.6, 0.0, 1.0) : clamp((0.28 - h) * 8.0, 0.0, 1.0);
            alb = mix(vec3(0.42, 0.44, 0.28), vec3(0.08, 0.16, 0.13), smoothstep(0.0, 0.8, depth));
            mat = 0.3 + 0.5 * depth;
        } else {
            float bank = 1.0 - smoothstep(rw, rw + 16.0, d);
            float can = fbm(p / 13.0, uSeed + 300, 4);
            float canx = fbm((p + vec2(e, 0.0)) / 13.0, uSeed + 300, 4), cany = fbm((p + vec2(0.0, e)) / 13.0, uSeed + 300, 4);
            float s = shade(can * 14.0, canx * 14.0, cany * 14.0, 1.0 / e * 1.5);
            vec3 jung = mix(vec3(0.06, 0.2, 0.07), vec3(0.24, 0.48, 0.14), smoothstep(0.35, 0.75, can));
            jung = mix(jung, vec3(0.32, 0.42, 0.12), smoothstep(0.62, 0.8, det2) * 0.5);
            float clear = smoothstep(0.6, 0.66, fbm(p / 220.0, uSeed + 500, 3));
            vec3 field = mix(vec3(0.44, 0.5, 0.24), vec3(0.47, 0.36, 0.22), det);
            alb = mix(jung * (0.45 + 0.85 * s), field * (0.85 + 0.25 * det2), clear);
            alb = mix(alb, vec3(0.38, 0.31, 0.2) * (0.85 + det * 0.3), bank);
            // ruined stone platforms in clearings
            vec2 bc = floor(p / 70.0);
            if (clear > 0.5 && h1(bc, uSeed + 77) < 0.35) {
                vec2 f = fract(p / 70.0) - 0.5;
                float sq = max(abs(f.x), abs(f.y));
                if (sq < 0.36) { alb = mix(vec3(0.5, 0.5, 0.44), vec3(0.62, 0.6, 0.52), det) * (sq > 0.31 ? 0.7 : 1.0); }
                vec2 t = fract(p / 7.0);
                if (sq < 0.31 && (t.x < 0.08 || t.y < 0.08)) alb *= 0.8;
            }
        }
    } else if (uBiome == 2) { // --------------------------------------- desert
        float h = fbm(p / 420.0, uSeed, 5);
        float rd = abs(p.x - roadX(p.y));
        if (h < 0.26) {
            float depth = clamp((0.26 - h) * 9.0, 0.0, 1.0);
            alb = mix(vec3(0.55, 0.8, 0.7), vec3(0.05, 0.3, 0.38), depth);
            mat = 0.3 + 0.5 * depth;
        } else {
            vec2 dp = vec2(p.x * 0.8 + p.y * 0.6, -p.x * 0.6 + p.y * 0.8);
            float dune = ridged(dp / vec2(220.0, 90.0), uSeed + 400, 3);
            float dunex = ridged((dp + vec2(e * 0.8, -e * 0.6)) / vec2(220.0, 90.0), uSeed + 400, 3);
            float duney = ridged((dp + vec2(e * 0.6, e * 0.8)) / vec2(220.0, 90.0), uSeed + 400, 3);
            float rip = sin(dp.x / 5.0 + det2 * 9.0) * 0.012;
            float s = shade(dune * 20.0 + rip * 20.0, dunex * 20.0, duney * 20.0, 1.0 / e * 2.0);
            alb = mix(vec3(0.82, 0.62, 0.38), vec3(0.93, 0.78, 0.52), det2) * (0.94 + det * 0.12);
            alb *= 0.6 + 0.55 * s;
            // mesas: terraced rock
            if (h > 0.64) {
                float q = floor(h * 40.0) / 40.0;
                float edge = fract(h * 40.0);
                vec3 rock = mix(vec3(0.58, 0.34, 0.2), vec3(0.72, 0.46, 0.28), det) * (edge < 0.25 ? 0.62 : 1.0 - q * 0.2);
                alb = mix(alb, rock, smoothstep(0.64, 0.66, h));
            }
            // dry wadi
            if (h < 0.31) { vec2 id; float c = cell(p / 9.0, uSeed + 61, id); alb = mix(alb, vec3(0.6, 0.48, 0.34) * (c < 0.08 ? 0.7 : 1.0), smoothstep(0.31, 0.28, h)); }
            // highway and pipeline
            if (rd < 17.0) {
                alb = mix(vec3(0.17, 0.16, 0.15), vec3(0.24, 0.22, 0.2), det);
                if (rd < 1.4 && mod(p.y, 46.0) < 24.0) alb = vec3(0.9, 0.72, 0.2);
                if (rd > 13.5) alb = vec3(0.75, 0.72, 0.65) * 0.8;
                alb = mix(alb, vec3(0.82, 0.64, 0.4), smoothstep(0.55, 0.8, det2) * 0.6);
            }
            float pd = abs(rd - 34.0);
            if (pd < 2.6) { alb = mix(vec3(0.35, 0.33, 0.3), vec3(0.6, 0.58, 0.52), pd < 0.8 ? 1.0 : 0.0); }
            if (pd < 5.0 && mod(p.y, 30.0) < 2.5) alb = vec3(0.25, 0.24, 0.22);
            if (pd > 2.6 && pd < 6.0) alb *= 0.8;
        }
    } else if (uBiome == 3) { // --------------------------------------- arctic
        float h = arcticH(p);
        float hx = arcticH(p + vec2(e, 0.0)), hy = arcticH(p + vec2(0.0, e));
        if (h < 0.41) {
            float depth = clamp((0.41 - h) * 7.0, 0.0, 1.0);
            alb = mix(vec3(0.32, 0.55, 0.62), vec3(0.02, 0.09, 0.14), smoothstep(0.0, 0.6, depth));
            mat = 0.3 + 0.5 * depth;
            // ice floes (visual only)
            float fl = fbm(p / 26.0, uSeed + 610, 3);
            if (fl > 0.66 && h > 0.31) { alb = mix(vec3(0.78, 0.88, 0.94), vec3(0.95, 0.98, 1.0), det) * (fl < 0.68 ? 0.75 : 1.0); mat = 0.0; }
        } else {
            float s = shade(h * 60.0 + det * 0.6, hx * 60.0 + det * 0.6, hy * 60.0 + det * 0.6, 1.0 / e * 5.0);
            vec3 snow = mix(vec3(0.82, 0.88, 0.97), vec3(1.0), det2);
            alb = snow;
            if (h < 0.47) {
                vec2 id; float c = cell(p / 38.0, uSeed + 620, id);
                vec3 ice = mix(vec3(0.6, 0.78, 0.9), vec3(0.78, 0.9, 0.97), h1(id, uSeed + 5));
                ice = mix(ice * 0.75, ice, smoothstep(0.0, 0.06, c));
                alb = mix(ice, snow, smoothstep(0.455, 0.47, h));
            }
            if (h > 0.66) { vec3 rock = mix(vec3(0.24, 0.26, 0.3), vec3(0.38, 0.4, 0.44), det); alb = mix(alb, rock, smoothstep(0.66, 0.7, h) * (1.0 - smoothstep(0.55, 0.85, s))); }
            alb *= mix(vec3(0.55, 0.65, 0.85), vec3(1.0), s);
        }
    } else if (uBiome == 4) { // --------------------------------------- city (night)
        float m = p.y - 150.0 * floor(p.y / 150.0);
        float cxd = abs(p.x - canalX(p.y));
        float mx = (p.x + 2000.0) - 150.0 * floor((p.x + 2000.0) / 150.0);
        bool street = mx < 24.0 || m < 24.0;
        vec2 blk = floor(vec2(p.x + 2000.0, p.y) / 150.0);
        if (cxd < 30.0 && m >= 24.0) {
            alb = vec3(0.03, 0.05, 0.08);
            mat = 0.3 + 0.5 * clamp((30.0 - cxd) / 18.0, 0.0, 1.0);
        } else if (street) {
            alb = mix(vec3(0.07, 0.07, 0.09), vec3(0.11, 0.11, 0.13), det);
            float lx = mx < 24.0 ? mx : m;
            if (abs(lx - 12.0) < 0.6 && mod((mx < 24.0 ? p.y : p.x), 18.0) < 9.0) alb = vec3(0.5, 0.48, 0.4);
            // street lamps
            float along = mx < 24.0 ? p.y : p.x;
            vec2 lp = vec2(abs(lx - 12.0) - 10.5, mod(along, 40.0) - 20.0);
            float lamp = exp(-dot(lp, lp) / 6.0);
            em += vec3(1.0, 0.62, 0.25) * lamp * 1.4;
            alb += vec3(0.9, 0.55, 0.25) * exp(-dot(lp, lp) / 90.0) * 0.25;
            if (cxd < 34.0) alb = vec3(0.16, 0.15, 0.15); // bridge deck
        } else {
            // lots inside the block
            vec2 f = vec2(mx - 24.0, m - 24.0); // 0..126
            float split = h1(blk, uSeed + 801);
            vec2 lots = split < 0.33 ? vec2(2.0, 2.0) : split < 0.66 ? vec2(3.0, 2.0) : vec2(2.0, 3.0);
            vec2 lc = floor(f / (126.0 / lots));
            vec2 lf = fract(f / (126.0 / lots));
            vec2 lid = blk * 4.0 + lc;
            float lh = h1(lid, uSeed + 811);
            float kind = h1(lid, uSeed + 821);
            vec2 lsz = 126.0 / lots;
            vec2 lp = lf * lsz;
            float edge = min(min(lp.x, lsz.x - lp.x), min(lp.y, lsz.y - lp.y));
            if (kind < 0.08) { // park
                alb = mix(vec3(0.05, 0.12, 0.06), vec3(0.09, 0.2, 0.1), det2);
            } else {
                vec3 roof = kind < 0.4 ? vec3(0.2, 0.21, 0.24) : kind < 0.7 ? vec3(0.13, 0.13, 0.15) : kind < 0.88 ? vec3(0.08, 0.16, 0.2) : vec3(0.24, 0.2, 0.2);
                roof *= 0.8 + det * 0.4;
                alb = roof * (edge < 3.0 ? 1.45 : 1.0);
                // roof clutter: AC units and vents
                vec2 g = floor(lp / 14.0);
                float r = h1(lid * 7.0 + g, uSeed + 831);
                vec2 gf = fract(lp / 14.0);
                if (edge > 6.0 && r < 0.18 && max(abs(gf.x - 0.5), abs(gf.y - 0.5)) < 0.3) alb = vec3(0.32, 0.33, 0.35) * (gf.x + gf.y > 1.0 ? 0.7 : 1.1);
                // tall towers: helipad and roof light
                if (lh > 0.82 && edge > 8.0) {
                    float c = length(lp - lsz * 0.5);
                    if (abs(c - 13.0) < 1.2) { alb = vec3(0.8, 0.8, 0.8); em += vec3(0.3, 0.9, 1.0) * 0.5; }
                    if (abs(c - 1.0) < 0.6) em += vec3(1.0, 0.1, 0.15) * 3.0;
                }
                // neon trim
                float neon = h1(lid, uSeed + 841);
                if (neon < 0.45 && edge < 1.4) {
                    vec3 nc = neon < 0.15 ? vec3(1.0, 0.18, 0.62) : neon < 0.3 ? vec3(0.2, 0.9, 1.0) : vec3(0.65, 0.3, 1.0);
                    em += nc * 1.7;
                    alb += nc * 0.15;
                }
                // billboards
                if (neon > 0.85 && lp.y > lsz.y * 0.3 && lp.y < lsz.y * 0.45 && lp.x > 6.0 && lp.x < lsz.x - 6.0) {
                    float stripes = step(0.5, fract(lp.x / 6.0 + lp.y * 0.02));
                    em += mix(vec3(1.0, 0.3, 0.6), vec3(0.3, 0.8, 1.0), stripes) * 0.8;
                }
                // a few lit windows on the lower roof edges (seen at an angle)
                if (edge < 4.0 && h1(floor(p / 4.0), uSeed + 851) < 0.25) em += vec3(1.0, 0.85, 0.55) * 0.35;
            }
            // shadow from taller neighbours (sun is the moon here)
            vec2 sp = p + vec2(10.0, -14.0);
            float smx = (sp.x + 2000.0) - 150.0 * floor((sp.x + 2000.0) / 150.0);
            float smy = sp.y - 150.0 * floor(sp.y / 150.0);
            if (smx >= 24.0 && smy >= 24.0) {
                vec2 sblk = floor(vec2(sp.x + 2000.0, sp.y) / 150.0);
                float ss = h1(sblk, uSeed + 801);
                vec2 sl = ss < 0.33 ? vec2(2.0, 2.0) : ss < 0.66 ? vec2(3.0, 2.0) : vec2(2.0, 3.0);
                vec2 slc = floor(vec2(smx - 24.0, smy - 24.0) / (126.0 / sl));
                float sh = h1(sblk * 4.0 + slc, uSeed + 811);
                if (sh > lh + 0.15) alb *= 0.55;
            }
        }
    } else { // ------------------------------------------------------------ volcano
        if (p.y >= uPlatformY) {
            vec2 g = p / 24.0;
            vec2 gf = fract(g);
            float seam = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
            float tone = h1(floor(g), uSeed + 901);
            alb = mix(vec3(0.24, 0.27, 0.32), vec3(0.34, 0.37, 0.43), tone) * (0.9 + det * 0.2);
            if (seam < 0.04) alb *= 0.5;
            if (length(gf - 0.15) < 0.05 || length(gf - 0.85) < 0.05) alb *= 1.5;
            vec2 big = mod(p, 96.0);
            if (abs(big.x - 48.0) < 1.2 || abs(big.y - 48.0) < 1.2) { em += vec3(0.1, 0.8, 1.0) * 0.9; alb = vec3(0.2, 0.5, 0.6); }
            float dy = p.y - uPlatformY;
            if (dy < 26.0) { float st = step(0.5, fract((p.x + p.y) / 16.0)); alb = mix(vec3(0.1), vec3(0.95, 0.75, 0.1), st); }
            vec2 c = p - vec2(270.0, uPlatformY + 560.0);
            float r = length(c);
            if (abs(r - 150.0) < 2.0 || abs(r - 230.0) < 1.5) { em += vec3(1.0, 0.1, 0.2) * 1.3; alb = vec3(0.4, 0.1, 0.1); }
            float a = atan(c.y, c.x);
            if (r > 160.0 && r < 220.0 && abs(fract(a / 6.2831 * 24.0) - 0.5) < 0.05) alb *= 0.6;
        } else {
            float h = fbm(p / 340.0, uSeed, 4);
            float rg = ridged(p / 260.0, uSeed + 61, 4);
            if (h < 0.27 || rg > 0.86) {
                float heat = h < 0.27 ? clamp((0.27 - h) * 10.0, 0.0, 1.0) : clamp((rg - 0.86) * 12.0, 0.0, 1.0);
                float crust = fbm(p / 14.0, uSeed + 700, 4);
                alb = mix(vec3(0.15, 0.04, 0.02), vec3(0.05, 0.03, 0.03), smoothstep(0.55, 0.7, crust));
                em += mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.85, 0.35), heat) * (1.0 - smoothstep(0.5, 0.72, crust) * 0.85) * (0.8 + heat * 0.8);
                mat = 0.9 + 0.1 * heat;
            } else {
                float hx = fbm((p + vec2(e, 0.0)) / 60.0, uSeed + 710, 4), hy = fbm((p + vec2(0.0, e)) / 60.0, uSeed + 710, 4), hh = fbm(p / 60.0, uSeed + 710, 4);
                float s = shade(hh * 18.0, hx * 18.0, hy * 18.0, 1.0 / e * 1.5);
                alb = mix(vec3(0.1, 0.09, 0.1), vec3(0.2, 0.17, 0.17), det) * (0.5 + 0.8 * s);
                float ash = smoothstep(0.58, 0.66, fbm(p / 200.0, uSeed + 800, 3));
                alb = mix(alb, vec3(0.36, 0.34, 0.32) * (0.8 + det * 0.3) * (0.6 + 0.5 * s), ash);
                // glow near lava
                float near = max(smoothstep(0.32, 0.27, h), smoothstep(0.8, 0.86, rg));
                em += vec3(1.0, 0.3, 0.05) * near * near * 0.6;
                alb = mix(alb, vec3(0.25, 0.08, 0.04), near * 0.5);
                // glowing fissures
                float fis = ridged(p / 50.0, uSeed + 720, 3);
                if (fis > 0.93 && ash < 0.5) em += vec3(1.0, 0.35, 0.06) * (fis - 0.93) * 18.0;
            }
        }
    }
    oAlb = vec4(clamp(alb, 0.0, 1.0), mat);
    oEm = vec4(em * 0.25, 1.0);
}`;
