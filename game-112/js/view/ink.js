// The hand-drawn look, all in shaders:
//
//   inkMaterial   models: half-Lambert tone turned into pen hatching (one, two, then three layers of
//                 lines as the surface turns from the light), over a thin watercolour wash on paper.
//   groundMaterial the field: paper with grass ticks and stipple, and the hex grid drawn in wobbly ink.
//   washMaterial  hex highlights: a watercolour blot with a darker, bled rim.
//   COMPOSITE     the post pass: ink outlines found from depth and normal edges (jittered so they wobble
//                 like a pen line, and "boiling" a few times a second), paper grain and an old-page vignette.
//
// Colours are written straight through as sRGB (no colour management) so the palette is what is typed.

import * as THREE from 'three';

export const rgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

export const PALETTE = {
    paper: 0xf0e4c4,
    ink: 0x231b14,
    you: 0x3f7f96,          // cerulean wash, the legion
    foe: 0xb5532d,          // burnt orange, the foe
    gold: 0xd8a530,
    olive: 0x6b8a4a,
};

const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

// shared uniforms: every ink material reads the same light, pixel ratio and boil phase
export const SHARED = {
    uLight: { value: new THREE.Vector3(-0.45, 0.85, 0.35).normalize() },
    uPx: { value: 1 },
    uBoil: { value: 0 },
    uInk: { value: rgb(PALETTE.ink) },
    uPaper: { value: rgb(PALETTE.paper) },
};

const INK_VERT = /* glsl */`
varying vec3 vN;
varying vec3 vW;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
}`;

const INK_FRAG = /* glsl */`
uniform vec3 uWash;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uLight;
uniform float uPx;
uniform float uBoil;
uniform float uDensity;
uniform float uHatch;
uniform float uFlash;
uniform vec3 uFlashCol;
uniform float uAlpha;
uniform float uDark;
varying vec3 vN;
varying vec3 vW;
${NOISE}
// distance in px from the nearest of a family of parallel pen lines; 1 on a line, 0 off it
float hatch(vec2 p, float ang, float sp, float w) {
    vec2 d = vec2(cos(ang), sin(ang));
    float t = dot(p, d) / sp + (vnoise(p * 0.035 + uBoil) - 0.5) * 0.7;
    float f = abs(fract(t) - 0.5) * sp;
    // a pen line is not even: let it thin and break along its length
    float br = vnoise(vec2(dot(p, vec2(-d.y, d.x)) * 0.08, floor(t)) + uBoil * 0.3);
    w *= mix(0.55, 1.15, br);
    return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.85, f);
}
void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    float lam = dot(N, uLight) * 0.5 + 0.5;
    float sky = N.y * 0.5 + 0.5;
    float tone = clamp(lam * 0.85 + sky * 0.25 - 0.02 - uDark, 0.0, 1.0);
    vec2 p = gl_FragCoord.xy / uPx;
    float ink = 0.0;
    float h = uHatch;
    ink = max(ink, hatch(p, 0.92, 6.4, mix(0.35, 1.1, smoothstep(0.7, 0.3, tone))) * smoothstep(0.72, 0.56, tone) * h);
    ink = max(ink, hatch(p, -0.62, 6.8, mix(0.35, 1.0, smoothstep(0.45, 0.15, tone))) * smoothstep(0.44, 0.3, tone) * h);
    ink = max(ink, hatch(p, 2.3, 4.6, 0.8) * smoothstep(0.2, 0.08, tone) * h);
    // stipple in the deepest shadow
    float st = step(0.9 - (0.2 - tone) * 1.6, hash(floor(p / 1.6)));
    ink = max(ink, st * smoothstep(0.16, 0.04, tone) * h);
    float grain = vnoise(vW.xz * 2.7 + vW.y * 1.3) * 0.55 + vnoise(p * 0.045) * 0.45;
    vec3 base = mix(uPaper, uWash, clamp(uDensity * (0.7 + 0.45 * grain), 0.0, 1.0));
    base *= mix(0.86, 1.02, tone);
    vec3 col = mix(base, uInk, ink * 0.9);
    col = mix(col, uFlashCol, uFlash);
    gl_FragColor = vec4(col, uAlpha);
}`;

const matCache = new Map();
/**
 * A hatched ink material with a watercolour wash. density: how much of the wash shows (0 = bare paper,
 * like polished steel or a white robe). Cached: same colour and density, same material.
 */
export function inkMaterial(wash = PALETTE.paper, density = 0.4, { hatch = 1, dark = 0, cache = true, transparent = false } = {}) {
    const k = `${wash}:${density}:${hatch}:${dark}`;
    if (cache && !transparent && matCache.has(k)) return matCache.get(k);
    const m = new THREE.ShaderMaterial({
        uniforms: {
            ...SHARED,
            uWash: { value: rgb(wash) },
            uDensity: { value: density },
            uHatch: { value: hatch },
            uDark: { value: dark },
            uFlash: { value: 0 },
            uFlashCol: { value: new THREE.Vector3(1, 1, 1) },
            uAlpha: { value: 1 },
        },
        vertexShader: INK_VERT,
        fragmentShader: INK_FRAG,
        side: THREE.DoubleSide,
        transparent,
    });
    if (cache && !transparent) matCache.set(k, m);
    return m;
}

/** A private copy of a material, so one figure can flash or fade without the rest. */
export function ownMaterial(m) {
    const c = m.clone();
    c.uniforms = THREE.UniformsUtils.clone(m.uniforms);
    for (const k of Object.keys(SHARED)) c.uniforms[k] = SHARED[k];
    c.transparent = true;
    return c;
}

// ---------------------------------------------------------------------------------------------
const GROUND_FRAG = /* glsl */`
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uWash;
uniform float uPx;
uniform float uBoil;
uniform vec2 uBoard;     // cols, rows
varying vec3 vN;
varying vec3 vW;
${NOISE}
const float SQ3 = 1.7320508;
float hexSd(vec2 p) { p = abs(p); return max(p.x, p.x * 0.5 + p.y * SQ3 * 0.5) - SQ3 * 0.5; }
void main() {
    vec2 q = vW.xz;
    // the nearest hex centre (odd rows pushed half a hex right)
    float bestD = 1e9; vec2 bestC = vec2(0.0); vec2 cell = vec2(-1.0);
    float r0 = floor(q.y / 1.5);
    for (int i = 0; i < 2; i++) {
        float r = r0 + float(i);
        float odd = mod(r, 2.0);
        float c0 = floor(q.x / SQ3 - 0.5 * odd);
        for (int j = 0; j < 2; j++) {
            float c = c0 + float(j);
            vec2 ctr = vec2(SQ3 * (c + 0.5 * odd), 1.5 * r);
            float d = hexSd(q - ctr);
            if (d < bestD) { bestD = d; bestC = ctr; cell = vec2(c, r); }
        }
    }
    bool inside = cell.x >= 0.0 && cell.y >= 0.0 && cell.x < uBoard.x && cell.y < uBoard.y;
    vec2 p = gl_FragCoord.xy / uPx;
    // paper with a faint wash of the land, blotchy like watercolour
    float blot = fbm(q * 0.18 + 3.1);
    vec3 col = mix(uPaper, uWash, 0.12 + 0.2 * smoothstep(0.35, 0.75, blot));
    // grass ticks: short slanted strokes scattered over the field
    vec2 g = q * 2.4;
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    float rnd = hash(gi);
    vec2 off = vec2(hash(gi + 7.0), hash(gi + 3.0)) - 0.5;
    vec2 lp = gf - off * 0.5;
    float ang = 1.2 + rnd * 0.6;
    vec2 dir = vec2(cos(ang), sin(ang));
    float along = dot(lp, dir), across = dot(lp, vec2(-dir.y, dir.x));
    float tick = (1.0 - smoothstep(0.012, 0.03, abs(across))) * (1.0 - smoothstep(0.08, 0.11, abs(along)));
    tick *= step(0.62, rnd) * smoothstep(0.3, 0.6, blot + 0.2);
    // stipple, densest in the low places
    float st = step(0.988 - blot * 0.02, hash(floor(p / 1.5)));
    float ink = max(tick * 0.75, st * 0.4);
    if (inside) {
        // the hex grid: a wobbly pen line on every edge
        float wob = (vnoise(q * 3.0 + uBoil) - 0.5) * 0.035;
        float e = -bestD + wob;
        float w = 0.028 + 0.012 * vnoise(q * 7.0);
        float line = 1.0 - smoothstep(w, w + 0.022, e);
        ink = max(ink, line * 0.8);
        // a dot at the centre of each hex, like a printed board
        float dotc = 1.0 - smoothstep(0.035, 0.06, length(q - bestC));
        ink = max(ink, dotc * 0.35);
        col = mix(col, uPaper, 0.35);
    }
    // the board's double frame
    vec2 lo = vec2(-SQ3 * 0.5 - 0.25, -1.0 - 0.25);
    vec2 hi = vec2(SQ3 * (uBoard.x - 0.5) + SQ3 * 0.5 + 0.25, 1.5 * (uBoard.y - 1.0) + 1.0 + 0.25);
    vec2 dd = min(q - lo, hi - q);
    float fr = min(dd.x, dd.y);
    float wob2 = (vnoise(q * 2.0 + uBoil) - 0.5) * 0.05;
    if (fr > -0.05) {
        ink = max(ink, (1.0 - smoothstep(0.03, 0.06, abs(fr + wob2))) * 0.95);
        ink = max(ink, (1.0 - smoothstep(0.015, 0.035, abs(fr - 0.16 + wob2))) * 0.7);
    }
    col = mix(col, uInk, ink * 0.88);
    gl_FragColor = vec4(col, 1.0);
}`;

export function groundMaterial(cols, rows, wash) {
    return new THREE.ShaderMaterial({
        uniforms: { ...SHARED, uWash: { value: rgb(wash) }, uBoard: { value: new THREE.Vector2(cols, rows) } },
        vertexShader: INK_VERT,
        fragmentShader: GROUND_FRAG,
    });
}

// ---------------------------------------------------------------------------------------------
const WASH_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WASH_FRAG = /* glsl */`
uniform vec3 uWash;
uniform vec3 uInk;
uniform float uAlpha;
uniform float uBoil;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vW;
${NOISE}
void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float n = fbm(vW.xz * 2.2 + uBoil * 0.2);
    float edge = 0.86 + (n - 0.5) * 0.22;
    if (r > edge) discard;
    // pigment pools at the edge of a watercolour blot
    float rim = smoothstep(edge - 0.2, edge, r);
    float a = (0.38 + 0.4 * rim + 0.12 * n) * uAlpha * (0.85 + 0.15 * uPulse);
    vec3 col = mix(uWash, uWash * 0.62, rim);
    gl_FragColor = vec4(col, a);
}`;
export function washMaterial(color, alpha = 1) {
    return new THREE.ShaderMaterial({
        uniforms: { uWash: { value: rgb(color) }, uInk: SHARED.uInk, uAlpha: { value: alpha }, uBoil: SHARED.uBoil, uPulse: { value: 0 } },
        vertexShader: WASH_VERT, fragmentShader: WASH_FRAG,
        transparent: true, depthWrite: false,
    });
}

// ---------------------------------------------------------------------------------------------
export const COMPOSITE = {
    uniforms: {
        tColor: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPx: SHARED.uPx,
        uBoil: SHARED.uBoil,
        uInk: SHARED.uInk,
        uPaper: SHARED.uPaper,
        uNear: { value: 0.1 },
        uFar: { value: 200 },
        uLine: { value: 1 },
        uFade: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uPx;
uniform float uBoil;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uNear;
uniform float uFar;
uniform float uLine;
uniform float uFade;
varying vec2 vUv;
${NOISE}
float linDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
float edgeAt(vec2 uv, float w) {
    vec2 px = w / uRes;
    float d0 = linDepth(uv);
    float d1 = linDepth(uv + vec2(px.x, 0.0)), d2 = linDepth(uv - vec2(px.x, 0.0));
    float d3 = linDepth(uv + vec2(0.0, px.y)), d4 = linDepth(uv - vec2(0.0, px.y));
    float dd = (abs(d1 + d2 - 2.0 * d0) + abs(d3 + d4 - 2.0 * d0)) / max(d0, 0.001);
    float de = smoothstep(0.012, 0.03, dd);
    // an object against the empty page
    float far0 = step(uFar * 0.98, d0);
    float far1 = max(max(step(uFar * 0.98, d1), step(uFar * 0.98, d2)), max(step(uFar * 0.98, d3), step(uFar * 0.98, d4)));
    de = max(de, abs(far0 - far1));
    vec3 n0 = nrm(uv);
    float nd = 0.0;
    nd += 1.0 - dot(n0, nrm(uv + vec2(px.x, 0.0)));
    nd += 1.0 - dot(n0, nrm(uv - vec2(px.x, 0.0)));
    nd += 1.0 - dot(n0, nrm(uv + vec2(0.0, px.y)));
    nd += 1.0 - dot(n0, nrm(uv - vec2(0.0, px.y)));
    float ne = smoothstep(0.7, 1.5, nd);
    return max(de, ne);
}
void main() {
    vec2 p = vUv * uRes / uPx;
    // jitter where the edges are looked for: the outline wobbles like a pen line and boils
    vec2 j = vec2(vnoise(p * 0.045 + uBoil), vnoise(p * 0.045 + 17.0 + uBoil)) - 0.5;
    vec2 uv = vUv + j * 2.6 * uPx / uRes;
    vec3 col = texture2D(tColor, vUv).rgb;
    float e = max(edgeAt(uv, 1.0 * uPx), edgeAt(uv, 1.8 * uPx) * 0.6);
    // pen pressure: lines thicken and thin along their length
    float pressure = mix(0.65, 1.0, vnoise(p * 0.02 + 5.0));
    float line = e * pressure * uLine;
    col = mix(col, uInk, clamp(line, 0.0, 1.0) * 0.92);
    // paper: fibres and grain, fixed to the page
    float grain = fbm(p * 0.6) * 0.5 + fbm(p * 0.07) * 0.5;
    float fibre = smoothstep(0.7, 0.76, vnoise(vec2(p.x * 0.02 + p.y * 0.01, p.y * 0.2)));
    col *= 0.94 + 0.07 * grain;
    col = mix(col, col * 0.93, fibre * 0.12);
    // an old page: foxing at the corners, darker toward the edges
    vec2 c = vUv - 0.5;
    float v = smoothstep(0.38, 0.75, length(c * vec2(1.0, 1.15)));
    col = mix(col, col * vec3(0.78, 0.66, 0.5), v * 0.55);
    float fox = smoothstep(0.7, 0.85, fbm(p * 0.012 + 9.0)) * v;
    col = mix(col, vec3(0.6, 0.42, 0.25), fox * 0.25);
    col = mix(col, uPaper, uFade);
    gl_FragColor = vec4(col, 1.0);
}`,
};

// ---------------------------------------------------------------------------------------------
// Canvas-drawn sprites for effects: ink splats, scribbled stars, flames, sparkles. Drawn once.
const spriteCache = new Map();
function inkCanvas(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    draw(g, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
}
function seeded(n) { let a = n * 9301 + 49297; return () => ((a = (a * 9301 + 49297) % 233280) / 233280); }

export function spriteTex(kind) {
    if (spriteCache.has(kind)) return spriteCache.get(kind);
    const ink = '#231b14';
    const R = seeded(kind.length * 31 + kind.charCodeAt(0));
    let t;
    switch (kind) {
        case 'splat': t = inkCanvas(128, (g, s) => {
            g.fillStyle = ink;
            g.beginPath(); g.arc(s / 2, s / 2, s * 0.16, 0, 7); g.fill();
            for (let i = 0; i < 14; i++) { const a = R() * 7, d = s * (0.16 + R() * 0.3), r = s * (0.015 + R() * 0.05); g.beginPath(); g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, 0, 7); g.fill(); }
            for (let i = 0; i < 8; i++) { const a = R() * 7; g.lineWidth = 2 + R() * 3; g.strokeStyle = ink; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * 0.38, s / 2 + Math.sin(a) * s * 0.38); g.stroke(); }
        }); break;
        case 'star': t = inkCanvas(128, (g, s) => {
            g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round';
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + R() * 0.2, l = s * (i % 2 ? 0.25 : 0.44); g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.08, s / 2 + Math.sin(a) * s * 0.08); g.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); g.stroke(); }
        }); break;
        case 'flame': t = inkCanvas(128, (g, s) => {
            g.fillStyle = '#e8762c'; g.strokeStyle = ink; g.lineWidth = 4;
            g.beginPath(); g.moveTo(s * 0.5, s * 0.06);
            g.bezierCurveTo(s * 0.78, s * 0.35, s * 0.9, s * 0.6, s * 0.5, s * 0.94);
            g.bezierCurveTo(s * 0.1, s * 0.6, s * 0.22, s * 0.35, s * 0.5, s * 0.06);
            g.fill(); g.stroke();
            g.fillStyle = '#f6c84a'; g.beginPath(); g.ellipse(s * 0.5, s * 0.66, s * 0.14, s * 0.2, 0, 0, 7); g.fill();
            g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.42, s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.3, s * 0.56, s * 0.24); g.stroke();
        }); break;
        case 'frost': t = inkCanvas(128, (g, s) => {
            g.strokeStyle = ink; g.lineWidth = 4; g.fillStyle = '#9fd0e0';
            g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42); g.lineTo(s / 2 + Math.cos(a + 0.52) * s * 0.14, s / 2 + Math.sin(a + 0.52) * s * 0.14); } g.closePath(); g.fill(); g.stroke();
        }); break;
        case 'spark': t = inkCanvas(64, (g, s) => {
            g.fillStyle = '#f6d05a'; g.strokeStyle = ink; g.lineWidth = 3;
            g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = i % 2 ? s * 0.16 : s * 0.46; g.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); } g.closePath(); g.fill(); g.stroke();
        }); break;
        case 'heal': t = inkCanvas(64, (g, s) => {
            g.fillStyle = '#9cc46a'; g.strokeStyle = ink; g.lineWidth = 3;
            g.beginPath(); g.rect(s * 0.38, s * 0.12, s * 0.24, s * 0.76); g.rect(s * 0.12, s * 0.38, s * 0.76, s * 0.24); g.fill(); g.stroke();
        }); break;
        case 'hex': t = inkCanvas(128, (g, s) => {
            g.strokeStyle = '#6a4a8a'; g.lineWidth = 5; g.lineCap = 'round';
            g.beginPath(); for (let i = 0; i < 90; i++) { const a = i * 0.25, r = s * 0.04 + i * s * 0.0045; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.stroke();
            g.strokeStyle = ink; g.lineWidth = 2; g.stroke();
        }); break;
        case 'ward': t = inkCanvas(128, (g, s) => {
            g.strokeStyle = ink; g.lineWidth = 5;
            g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, 7); g.stroke();
            g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, 0, 7); g.stroke();
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.36, s / 2 + Math.sin(a) * s * 0.36); g.lineTo(s / 2 + Math.cos(a + 0.2) * s * 0.42, s / 2 + Math.sin(a + 0.2) * s * 0.42); g.stroke(); }
        }); break;
        case 'puff': t = inkCanvas(128, (g, s) => {
            g.strokeStyle = ink; g.lineWidth = 3; g.fillStyle = 'rgba(240,228,196,0.9)';
            for (let i = 0; i < 6; i++) { const a = i / 6 * 7, d = s * 0.18; g.beginPath(); g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * 0.17, 0, 7); g.fill(); g.stroke(); }
        }); break;
        case 'rock': t = inkCanvas(64, (g, s) => {
            g.fillStyle = '#9a958a'; g.strokeStyle = ink; g.lineWidth = 3;
            g.beginPath(); g.moveTo(s * 0.2, s * 0.3); g.lineTo(s * 0.7, s * 0.15); g.lineTo(s * 0.88, s * 0.6); g.lineTo(s * 0.45, s * 0.88); g.lineTo(s * 0.12, s * 0.62); g.closePath(); g.fill(); g.stroke();
        }); break;
        case 'note': t = inkCanvas(64, (g, s) => {
            g.fillStyle = ink; g.beginPath(); g.ellipse(s * 0.35, s * 0.72, s * 0.14, s * 0.1, -0.4, 0, 7); g.fill();
            g.fillRect(s * 0.46, s * 0.16, s * 0.05, s * 0.56); g.fillRect(s * 0.46, s * 0.16, s * 0.28, s * 0.06);
        }); break;
        default: t = inkCanvas(16, (g, s) => { g.fillStyle = ink; g.fillRect(0, 0, s, s); });
    }
    spriteCache.set(kind, t);
    return t;
}
