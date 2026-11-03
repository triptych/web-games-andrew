// The Lighthouse Arcade's screens and marquees. Every cabinet plays its game's
// attract mode, the loop an arcade machine runs while nobody is playing it: a
// demo (the game's own preview picture, panned like a demo reel), the title screen
// with INSERT COIN blinking, and a high-score table, with a burst of static
// between them. All of it comes from three texture atlases drawn once on canvases
// (one cell per game) and one shader on one instanced mesh, so 100-odd screens
// cost a single draw call.

import * as THREE from 'three';
import { rng } from './util.js';

const TW = 160, TH = 120;          // a title or high-score screen: authentically low resolution
const SW = 240, SH = 126;          // a demo still, cropped from the 1200x630 preview picture
const MW = 256, MH = 72;           // a marquee
export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const grid = (n, cw, ch) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt((n * ch) / cw)));
    return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
};

/** Has the pixel font itself arrived (not just a fallback)? */
export function pixelFontLoaded() {
    try {
        for (const f of document.fonts || []) if (/Press Start 2P/.test(f.family) && f.status === 'loaded') return true;
    } catch {
        /* no FontFaceSet */
    }
    return false;
}

/** Waits (briefly) for the pixel font so the first screens are not drawn in Courier. */
export async function pixelFontReady(ms = 2500) {
    if (!document.fonts?.load) return;
    try {
        await Promise.race([document.fonts.load(`8px ${PIXEL_FONT}`), new Promise((r) => setTimeout(r, ms))]);
    } catch {
        /* the fallback is fine */
    }
}

/** Splits a title over at most two lines of `max` characters. */
function wrap(text, max) {
    const words = text.toUpperCase().split(/\s+/);
    const lines = [''];
    for (const w of words) {
        const cur = lines[lines.length - 1];
        if (!cur) lines[lines.length - 1] = w;
        else if ((cur + ' ' + w).length <= max) lines[lines.length - 1] = cur + ' ' + w;
        else lines.push(w);
    }
    if (lines.length > 2) lines.splice(1, lines.length, lines.slice(1).join(' '));
    return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '.' : l));
}

const INITIALS = ['AAA', 'ACE', 'JOY', 'MAX', 'ZAP', 'BOB', 'KAT', 'DOT', 'RAD', 'VIC', 'LOU', 'NED', 'TRI', 'PIX', 'GUS', 'SAM', 'EVE', 'ART', 'WOO', 'BIT', 'ROM', 'JET', 'FOX', 'OWL'];
const RANKS = ['1ST', '2ND', '3RD', '4TH', '5TH'];
const RAINBOW = ['#ff4f6e', '#ffb43a', '#ffe94a', '#5fff8f', '#5fe8ff'];

/** The title screen: score line, the game's icon, its name, its genre and INSERT COIN. */
function drawTitle(ctx, ox, oy, game, genre, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, TW, TH);
    ctx.clip();
    ctx.fillStyle = '#04030a';
    ctx.fillRect(ox, oy, TW, TH);
    // a synthwave floor: a horizon line and a grid running to it
    const hy = oy + 84;
    ctx.strokeStyle = genre.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) {
        ctx.beginPath();
        ctx.moveTo(ox + TW / 2 + k * 6, hy);
        ctx.lineTo(ox + TW / 2 + k * 40, oy + TH);
        ctx.stroke();
    }
    for (let k = 0; k < 5; k++) {
        const y = hy + Math.pow(k / 5, 1.8) * (TH - 84);
        ctx.beginPath();
        ctx.moveTo(ox, Math.round(y) + 0.5);
        ctx.lineTo(ox + TW, Math.round(y) + 0.5);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // stars
    for (let k = 0; k < 34; k++) {
        ctx.fillStyle = r() < 0.2 ? genre.accent2 : '#ffffff';
        ctx.globalAlpha = 0.3 + r() * 0.7;
        ctx.fillRect(ox + Math.floor(r() * TW), oy + 12 + Math.floor(r() * 66), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.fillStyle = '#ff4f6e';
    ctx.fillText('1UP', ox + 4, oy + 3);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText('HI ' + String(10000 + Math.floor(r() * 89999)).padStart(6, '0'), ox + TW - 4, oy + 3);
    // the game's icon
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `26px ${EMOJI}`;
    ctx.fillText(game.icon, ox + TW / 2, oy + 32);
    // its name: a drop shadow in the second accent, then the accent
    const lines = wrap(game.title, 18);
    ctx.font = `8px ${PIXEL_FONT}`;
    lines.forEach((line, i) => {
        const y = oy + (lines.length === 1 ? 60 : 55 + i * 11);
        ctx.fillStyle = genre.accent2;
        ctx.fillText(line, ox + TW / 2 + 1, y + 1);
        ctx.fillStyle = genre.accent;
        ctx.fillText(line, ox + TW / 2, y);
    });
    ctx.fillStyle = '#bfc6ff';
    ctx.fillText(genre.short.toUpperCase().slice(0, 19), ox + TW / 2, oy + 76);
    // INSERT COIN (the shader blinks this band) over the grid
    ctx.fillStyle = '#04030a';
    ctx.fillRect(ox + 28, oy + 93, TW - 56, 13);
    ctx.fillStyle = '#ffe94a';
    ctx.fillText('INSERT COIN', ox + TW / 2, oy + 100);
    ctx.fillStyle = '#8a8fb0';
    ctx.fillText('CREDIT 0', ox + TW / 2, oy + 113);
    ctx.restore();
}

/** The high-score table, seeded by the game so it is always the same names. */
function drawScores(ctx, ox, oy, game, genre, r) {
    ctx.save();
    ctx.fillStyle = '#04030a';
    ctx.fillRect(ox, oy, TW, TH);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.fillStyle = genre.accent;
    ctx.fillText('HIGH SCORES', ox + TW / 2, oy + 12);
    ctx.fillStyle = genre.accent2;
    ctx.fillRect(ox + 30, oy + 20, TW - 60, 1);
    let score = 50000 + Math.floor(r() * 50000);
    for (let k = 0; k < 5; k++) {
        const y = oy + 34 + k * 15;
        ctx.fillStyle = RAINBOW[k];
        ctx.textAlign = 'left';
        ctx.fillText(RANKS[k], ox + 10, y);
        ctx.fillText(INITIALS[Math.floor(r() * INITIALS.length)], ox + 52, y);
        ctx.textAlign = 'right';
        ctx.fillText(String(score).padStart(6, '0'), ox + TW - 10, y);
        score = Math.floor(score * (0.55 + r() * 0.3) / 10) * 10;
    }
    ctx.fillStyle = '#8a8fb0';
    ctx.textAlign = 'center';
    ctx.font = `14px ${EMOJI}`;
    ctx.fillText(game.icon, ox + TW / 2, oy + TH - 12);
    ctx.restore();
}

/** The lit sign over the screen. */
function drawMarquee(ctx, ox, oy, game, genre) {
    ctx.save();
    const g = ctx.createLinearGradient(ox, oy, ox + MW, oy + MH);
    g.addColorStop(0, genre.accent);
    g.addColorStop(1, genre.accent2);
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, MW, MH);
    // sunburst stripes
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 12; k++) {
        ctx.beginPath();
        ctx.moveTo(ox + MW / 2, oy + MH);
        ctx.lineTo(ox + (k / 12) * MW * 1.4 - MW * 0.2, oy);
        ctx.lineTo(ox + ((k + 0.5) / 12) * MW * 1.4 - MW * 0.2, oy);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(ox, oy, MW, 4);
    ctx.fillRect(ox, oy + MH - 4, MW, 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `20px ${EMOJI}`;
    ctx.fillText(game.icon, ox + 18, oy + MH / 2);
    const lines = wrap(game.title, 12);
    let size = 18;
    ctx.font = `${size}px ${PIXEL_FONT}`;
    const room = MW - 44, tall = MH - 14;
    const fits = () => Math.max(...lines.map((l) => ctx.measureText(l).width)) <= room && lines.length * size + (lines.length - 1) * 5 <= tall;
    while (size > 8 && !fits()) ctx.font = `${--size}px ${PIXEL_FONT}`;
    lines.forEach((line, i) => {
        const y = oy + MH / 2 + (lines.length === 1 ? 0 : (i - 0.5) * (size + 5));
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#120818';
        ctx.strokeText(line, ox + MW / 2 + 16, y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line, ox + MW / 2 + 16, y);
    });
    ctx.restore();
}

function atlasTexture(cnv, nearest) {
    const t = new THREE.CanvasTexture(cnv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    return t;
}

/**
 * Draws every cabinet's title, high-score and marquee cells, and fetches the demo
 * stills in the background. `cabinets[i].id === i` is the cell index.
 */
export function buildAtlases(cabinets) {
    const n = cabinets.length;
    const tg = grid(n, TW, TH * 2), sg = grid(n, SW, SH), mg = grid(n, MW, MH);
    const tc = canvas(tg.cols * TW, tg.rows * TH * 2);
    const sc = canvas(sg.cols * SW, sg.rows * SH);
    const mc = canvas(mg.cols * MW, mg.rows * MH);
    const tx = tc.getContext('2d'), sx = sc.getContext('2d'), mx = mc.getContext('2d');
    sx.fillStyle = '#000';
    sx.fillRect(0, 0, sc.width, sc.height);
    for (const cab of cabinets) {
        const r = rng('attract-' + cab.game.id);
        const tcol = cab.id % tg.cols, trow = Math.floor(cab.id / tg.cols);
        drawTitle(tx, tcol * TW, trow * TH * 2, cab.game, cab.genre, r);
        drawScores(tx, tcol * TW, trow * TH * 2 + TH, cab.game, cab.genre, r);
        drawMarquee(mx, (cab.id % mg.cols) * MW, Math.floor(cab.id / mg.cols) * MH, cab.game, cab.genre);
    }
    const titles = atlasTexture(tc, true), shots = atlasTexture(sc, false), marquees = atlasTexture(mc, false);
    const has = new Float32Array(n);
    const out = { titles, shots, marquees, tg, sg, mg, has, loaded: 0, onShot: null, disposed: false };

    // the demo stills are the Library's preview pictures; whichever arrive are drawn in as they come
    let dirty = false, timer = 0;
    const flush = () => {
        timer = 0;
        if (!dirty || out.disposed) return;
        dirty = false;
        shots.needsUpdate = true;
        out.onShot?.();
    };
    out.load = () => {
        let i = 0;
        const next = () => {
            if (out.disposed || i >= n) return;
            const cab = cabinets[i++];
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                if (out.disposed) return;
                const col = cab.id % sg.cols, row = Math.floor(cab.id / sg.cols);
                const ar = img.width / img.height, want = SW / SH;
                let w = img.width, h = img.height, x = 0, y = 0;
                if (ar > want) (w = h * want), (x = (img.width - w) / 2);
                else (h = w / want), (y = (img.height - h) / 2);
                sx.drawImage(img, x, y, w, h, col * SW, row * SH, SW, SH);
                has[cab.id] = 1;
                out.loaded++;
                dirty = true;
                timer ||= setTimeout(flush, 400);
                next();
            };
            img.onerror = () => next();
            img.src = `garden/img/games/${encodeURIComponent(cab.game.id)}.jpg`;
        };
        // a few at a time
        for (let k = 0; k < 4; k++) next();
    };
    out.dispose = () => {
        out.disposed = true;
        titles.dispose();
        shots.dispose();
        marquees.dispose();
    };
    return out;
}

const SCREEN_VS = /* glsl */ `
attribute float aId;
attribute float aSeed;
attribute float aHas;
varying vec2 vUv;
varying float vId;
varying float vSeed;
varying float vHas;
void main() {
    vUv = uv;
    vId = aId;
    vSeed = aSeed;
    vHas = aHas;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const SCREEN_FS = /* glsl */ `
uniform sampler2D uTitles;
uniform sampler2D uShots;
uniform vec2 uTG;
uniform vec2 uSG;
uniform float uTime;
uniform float uHover;
uniform float uPower;
varying vec2 vUv;
varying float vId;
varying float vSeed;
varying float vHas;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// uv (0..1, v up) inside cell 'id' of an atlas whose canvas rows run downward
vec2 cell(vec2 uv, vec2 g, float id, float sub, float subs) {
    float col = mod(id, g.x), row = floor(id / g.x);
    uv = clamp(uv, 0.004, 0.996);
    float vy = (sub + 1.0 - uv.y) / subs;   // down from the top of the cell
    return vec2((col + uv.x) / g.x, 1.0 - (row + vy) / g.y);
}

void main() {
    // the curved glass of a CRT
    vec2 q = vUv * 2.0 - 1.0;
    q *= 1.0 + 0.06 * dot(q.yx, q.yx);
    vec2 uv = q * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    float P = 17.0;
    float demo = vHas > 0.5 ? 7.0 : 0.0;
    float t = mod(uTime + vSeed * P, P);
    float t1 = demo + (P - demo) * 0.6;
    vec3 col;
    float edge;
    if (t < demo) {
        // the demo: the preview picture, panned and gently zoomed like an attract reel
        float w = (4.0 / 3.0) / (240.0 / 126.0);
        float pan = 0.5 + 0.5 * sin(t * 0.45 + vSeed * 31.0);
        float z = 0.92 + 0.08 * sin(t * 0.3 + vSeed * 7.0);
        vec2 s = vec2((uv.x - 0.5) * w * z + 0.5 * w + pan * (1.0 - w), (uv.y - 0.5) * z + 0.5);
        col = texture2D(uShots, cell(s, uSG, vId, 0.0, 1.0)).rgb;
        // posterise a touch, like an old palette
        col = floor(col * 14.0) / 14.0;
        edge = min(t, demo - t);
    } else if (t < t1) {
        col = texture2D(uTitles, cell(uv, uTG, vId, 0.0, 2.0)).rgb;
        // INSERT COIN blinks
        if (uv.y > 0.1 && uv.y < 0.22 && fract(uTime * 0.9 + vSeed) > 0.6) col *= 0.0;
        edge = min(t - demo, t1 - t);
    } else {
        col = texture2D(uTitles, cell(uv, uTG, vId, 1.0, 2.0)).rgb;
        edge = P - t;
    }
    // a burst of static where one part of the loop cuts to the next
    float st = 1.0 - smoothstep(0.0, 0.22, edge);
    float n = hash(floor(uv * vec2(160.0, 120.0)) + floor(uTime * 30.0));
    col = mix(col, vec3(n), st * 0.9);

    // scanlines, a little phosphor shimmer and the vignette of the tube
    float scan = 0.72 + 0.28 * sin(uv.y * 120.0 * 3.14159 * 2.0);
    float flick = 0.97 + 0.03 * sin(uTime * 53.0 + vSeed * 40.0);
    float vig = 1.0 - smoothstep(0.4, 1.45, length(q));   // edge0 < edge1: reversed edges are undefined in GLSL
    float hover = abs(uHover - vId) < 0.5 ? 1.45 : 1.0;
    col *= scan * flick * vig * hover * uPower * 1.55;
    gl_FragColor = vec4(col, 1.0);
}`;

/** The attract-mode shader for the instanced screens. */
export function screenMaterial(atl) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTitles: { value: atl.titles },
            uShots: { value: atl.shots },
            uTG: { value: new THREE.Vector2(atl.tg.cols, atl.tg.rows) },
            uSG: { value: new THREE.Vector2(atl.sg.cols, atl.sg.rows) },
            uTime: { value: 0 },
            uHover: { value: -1 },
            uPower: { value: 1 },
        },
        vertexShader: SCREEN_VS,
        fragmentShader: SCREEN_FS,
        toneMapped: false,
    });
}

const MARQ_FS = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uG;
uniform float uTime;
uniform float uHover;
varying vec2 vUv;
varying float vId;
varying float vSeed;
void main() {
    float col = mod(vId, uG.x), row = floor(vId / uG.x);
    vec2 uv = clamp(vUv, 0.003, 0.997);
    vec3 c = texture2D(uMap, vec2((col + uv.x) / uG.x, 1.0 - (row + 1.0 - uv.y) / uG.y)).rgb;
    // fluorescent tubes behind the plastic: brighter in the middle, a rare flicker
    float glow = 0.75 + 0.35 * (1.0 - abs(vUv.y - 0.5) * 1.4);
    float f = fract(sin(floor(uTime * 12.0) + vSeed * 91.0) * 43758.5);
    float flick = f > 0.985 ? 0.55 : 1.0;
    float hover = abs(uHover - vId) < 0.5 ? 1.5 : 1.0;
    gl_FragColor = vec4(c * glow * flick * hover * 1.25, 1.0);
}`;

export function marqueeMaterial(atl) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uMap: { value: atl.marquees },
            uG: { value: new THREE.Vector2(atl.mg.cols, atl.mg.rows) },
            uTime: { value: 0 },
            uHover: { value: -1 },
        },
        vertexShader: SCREEN_VS,
        fragmentShader: MARQ_FS,
        toneMapped: false,
    });
}

/** A neon sign: glowing tube letters on a transparent canvas. */
export function neonTexture(text, color, { w = 1024, h = 256, font = PIXEL_FONT, size = 0.34, sub = '', subColor = '#ffffff' } = {}) {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let px = h * size;
    ctx.font = `${px}px ${font}`;
    while (ctx.measureText(text).width > w * 0.92 && px > 8) ctx.font = `${(px -= 2)}px ${font}`;
    const y = sub ? h * 0.4 : h * 0.5;
    for (const [blur, alpha] of [[h * 0.16, 0.9], [h * 0.06, 1]]) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillText(text, w / 2, y);
    if (sub) {
        ctx.font = `${h * 0.14}px ${font}`;
        ctx.shadowColor = subColor;
        ctx.shadowBlur = h * 0.06;
        ctx.fillStyle = subColor;
        ctx.fillText(sub, w / 2, h * 0.76);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

