// Painted surfaces, made in code: the face (re-drawn per mood), hair with strands and a highlight
// ring, woven cloth, and the creature skins (fur, scale, plate, bark, slime, stone...). Drawn at
// 256–512 px and filtered smoothly, like a PS2 game's hand-painted maps.

import * as THREE from 'three';
import { hash3 } from '../rng.js';

const TAU = Math.PI * 2;

export function rgb(c) {
    const v = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const css = (r, g, b, a = 1) => `rgba(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0},${a})`;
export function shade(c, k, a = 1) { const [r, g, b] = rgb(c); return css(r * k, g * k, b * k, a); }
export function mix(a, b, t, al = 1) { const A = rgb(a), B = rgb(b); return css(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, al); }
export function hexShade(c, k) { const [r, g, b] = rgb(c); const h = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`; }

function canvas(w, h = w) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function texture(cv, { repeat = false, nearest = false } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; }
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
}

// ================================================================ the face
// Head-local metres → canvas pixels. The head is projected flat: u = x / FACE_W + 0.5.
export const FACE = { w: 0.30, h: 0.38, cy: 0.17 };

const MOODS = {
    //            brow: [inner, outer] raise    tilt  lid   mouth            iris
    neutral: { browIn: 0, browOut: 0.0, lid: 0.16, tilt: 0.1, mouth: 'flat', iris: 1 },
    smile: { browIn: 0.004, browOut: 0.006, lid: 0.0, tilt: 0.1, mouth: 'smile', iris: 1, happy: true },
    smirk: { browIn: 0, browOut: 0, lid: 0.28, tilt: 0.1, mouth: 'smirk', iris: 1, browL: 0.012 },
    angry: { browIn: -0.016, browOut: 0.01, lid: 0.34, tilt: -0.05, mouth: 'frown', iris: 0.9, slant: 1 },
    sad: { browIn: 0.016, browOut: -0.008, lid: 0.3, tilt: 0.18, mouth: 'sad', iris: 1.05, slant: -1 },
    shock: { browIn: 0.02, browOut: 0.02, lid: -0.06, tilt: 0.1, mouth: 'open', iris: 0.78 },
};

/** A face that can be re-drawn: { tex, draw(mood) }. look: skin, hair, accent, eye, beard. */
export function faceTexture(look, size = 512) {
    const cv = canvas(size), g = cv.getContext('2d');
    const tex = texture(cv);
    const K = size / FACE.w;
    const X = (x) => (x / FACE.w + 0.5) * size;
    const Y = (y) => (1 - ((y - FACE.cy) / FACE.h + 0.5)) * size;
    const hairC = look.hair || '#222';
    const iris = look.eye || look.accent || '#4a8';
    const lash = hexShade(hairC === '#e8e8f0' ? '#777788' : hairC, 0.32);

    function eye(sd, M, side) {
        // sd: +1 for the eye at +x. side picks per-eye mood tweaks.
        const cx = X(sd * 0.054), cy = Y(0.184);
        const w = 0.066 * K, h = 0.05 * K * (M.iris < 0.85 ? 1.2 : 1);
        const inner = [cx - sd * w / 2, cy + h * 0.1 + (M.slant === 1 ? h * 0.18 : M.slant === -1 ? -h * 0.1 : 0)];
        const outer = [cx + sd * w / 2, cy - h * (0.12 + M.tilt) + (M.slant === -1 ? h * 0.28 : 0)];
        const topC = [cx, cy - h * 0.72 - (M.lid < 0 ? h * 0.2 : 0)], botC = [cx, cy + h * 0.5];
        g.save();
        if (M.happy) {
            // a closed, smiling eye: an upward arc with a lash flick
            g.strokeStyle = lash; g.lineWidth = 0.0075 * K; g.lineCap = 'round';
            g.beginPath(); g.moveTo(cx - sd * w * 0.5, cy + h * 0.05); g.quadraticCurveTo(cx, cy - h * 0.9, cx + sd * w * 0.5, cy + h * 0.05); g.stroke();
            g.restore(); return;
        }
        const path = () => { g.beginPath(); g.moveTo(...inner); g.bezierCurveTo(inner[0] + (topC[0] - inner[0]) * 0.5, topC[1] - h * 0.1, topC[0] + (outer[0] - topC[0]) * 0.5, topC[1] - h * 0.05, ...outer); g.bezierCurveTo(outer[0] + (botC[0] - outer[0]) * 0.5, botC[1] + h * 0.1, botC[0] + (inner[0] - botC[0]) * 0.5, botC[1] + h * 0.1, ...inner); g.closePath(); };
        // socket shade
        const sg = g.createRadialGradient(cx, cy - h * 0.2, h * 0.3, cx, cy - h * 0.2, w * 0.95);
        sg.addColorStop(0, 'rgba(120,60,50,0.0)'); sg.addColorStop(1, 'rgba(120,60,50,0.0)');
        // white
        path(); g.fillStyle = '#f7f2ee'; g.fill();
        g.clip();
        // iris
        const ir = h * 0.64 * M.iris, ix = cx - sd * w * 0.02, iy = cy + h * 0.02;
        const ig = g.createLinearGradient(0, iy - ir, 0, iy + ir);
        ig.addColorStop(0, hexShade(iris, 0.3)); ig.addColorStop(0.5, hexShade(iris, 0.85)); ig.addColorStop(1, hexShade(iris, 1.45));
        g.fillStyle = ig; g.beginPath(); g.ellipse(ix, iy, ir * 0.92, ir * 1.08, 0, 0, TAU); g.fill();
        g.strokeStyle = hexShade(iris, 0.28); g.lineWidth = 0.0025 * K; g.stroke();
        g.fillStyle = '#0a0d14'; g.beginPath(); g.ellipse(ix, iy, ir * 0.4, ir * 0.5, 0, 0, TAU); g.fill();
        // lid shadow on the white and iris
        const lg = g.createLinearGradient(0, topC[1], 0, cy);
        lg.addColorStop(0, 'rgba(40,20,30,0.55)'); lg.addColorStop(1, 'rgba(40,20,30,0)');
        g.fillStyle = lg; g.fillRect(cx - w, topC[1] - h * 0.3, w * 2, h * 1.1);
        // catch-lights
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - ir * 0.32 * sd * -0.0 - ir * 0.28, iy - ir * 0.42, ir * 0.24, ir * 0.27, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.85; g.beginPath(); g.ellipse(ix + ir * 0.34, iy + ir * 0.46, ir * 0.11, ir * 0.12, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
        // a lid that hangs over the eye for tired, angry or sly looks
        if (M.lid > 0) {
            const drop = h * M.lid * 1.25;
            const slantIn = M.slant === 1 ? drop * 0.9 : 0, slantOut = M.slant === -1 ? drop * 0.9 : 0;
            g.fillStyle = shade(look.skin, 0.94);
            g.beginPath();
            g.moveTo(inner[0] - sd * w * 0.3, topC[1] - h * 1.4); g.lineTo(outer[0] + sd * w * 0.3, topC[1] - h * 1.4);
            g.lineTo(outer[0] + sd * w * 0.3, outer[1] - h * 0.05);
            g.lineTo(...outer);
            g.bezierCurveTo(topC[0] + (outer[0] - topC[0]) * 0.5, topC[1] + drop + slantOut * 0.6, inner[0] + (topC[0] - inner[0]) * 0.5, topC[1] + drop + slantIn, inner[0], inner[1] + slantIn * 0.4);
            g.lineTo(inner[0] - sd * w * 0.3, inner[1]);
            g.closePath(); g.fill();
        }
        g.restore();
        g.save();
        // upper lash line: thick, flicking at the outer corner
        g.strokeStyle = lash; g.lineCap = 'round'; g.lineJoin = 'round';
        g.lineWidth = 0.0078 * K;
        g.beginPath(); g.moveTo(...inner);
        const drop2 = M.lid > 0 ? h * M.lid * 1.25 : 0, sIn = M.slant === 1 ? drop2 * 0.9 : 0, sOut = M.slant === -1 ? drop2 * 0.9 : 0;
        g.bezierCurveTo(inner[0] + (topC[0] - inner[0]) * 0.5, topC[1] + drop2 + sIn - h * 0.1, topC[0] + (outer[0] - topC[0]) * 0.5, topC[1] + drop2 + sOut * 0.6 - h * 0.05, ...outer);
        g.stroke();
        g.lineWidth = 0.0055 * K; g.beginPath(); g.moveTo(...outer); g.lineTo(outer[0] + sd * w * 0.18, outer[1] - h * 0.3); g.stroke();
        // lower lid, light
        g.strokeStyle = shade(look.skin, 0.62, 0.7); g.lineWidth = 0.0028 * K;
        g.beginPath(); g.moveTo(inner[0] + sd * w * 0.12, inner[1] + h * 0.15); g.bezierCurveTo(inner[0] + (botC[0] - inner[0]) * 0.5, botC[1] + h * 0.18, botC[0] + (outer[0] - botC[0]) * 0.5, botC[1] + h * 0.15, outer[0] - sd * w * 0.06, outer[1] + h * 0.18); g.stroke();
        // eyelid crease
        g.strokeStyle = shade(look.skin, 0.7, 0.55); g.lineWidth = 0.003 * K;
        g.beginPath(); g.moveTo(inner[0] + sd * w * 0.15, topC[1] - h * 0.42); g.quadraticCurveTo(cx, topC[1] - h * 0.62, outer[0], outer[1] - h * 0.45); g.stroke();
        g.restore();
    }

    function brow(sd, M, raise) {
        const bx = 0.054, by = 0.226 + raise;
        const x0 = X(sd * (bx - 0.027)), x1 = X(sd * (bx + 0.034));
        const yIn = Y(by + M.browIn), yOut = Y(by + M.browOut + 0.004);
        const col = hexShade(hairC === '#e8e8f0' ? '#8a8a96' : hairC, 0.78);
        g.save(); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
        const t = 0.0075 * K;
        g.beginPath();
        g.moveTo(x0, yIn - t * 0.5);
        g.quadraticCurveTo((x0 + x1) / 2, Math.min(yIn, yOut) - t * 1.2, x1, yOut - t * 0.2);
        g.lineTo(x1, yOut + t * 0.2);
        g.quadraticCurveTo((x0 + x1) / 2, Math.min(yIn, yOut) + t * 0.1, x0, yIn + t * 0.6);
        g.closePath(); g.fill();
        g.restore();
    }

    function mouth(kind) {
        const cx = X(0), cy = Y(0.082), w = 0.05 * K;
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        const dark = '#6a2a30', lipc = shade(look.skin, 0.8);
        // lower lip highlight
        g.fillStyle = 'rgba(255,170,160,0.16)'; g.beginPath(); g.ellipse(cx, cy + 0.011 * K, w * 0.32, 0.0055 * K, 0, 0, TAU); g.fill();
        g.strokeStyle = dark; g.lineWidth = 0.0058 * K;
        if (kind === 'flat') { g.beginPath(); g.moveTo(cx - w * 0.42, cy + 0.001 * K); g.quadraticCurveTo(cx, cy + 0.004 * K, cx + w * 0.42, cy + 0.001 * K); g.stroke(); }
        else if (kind === 'smile') {
            g.fillStyle = '#7a2a34'; g.beginPath(); g.moveTo(cx - w * 0.55, cy - 0.004 * K); g.quadraticCurveTo(cx, cy + 0.034 * K, cx + w * 0.55, cy - 0.004 * K); g.quadraticCurveTo(cx, cy + 0.0 * K, cx - w * 0.55, cy - 0.004 * K); g.fill();
            g.fillStyle = '#f4efe8'; g.beginPath(); g.moveTo(cx - w * 0.42, cy - 0.001 * K); g.quadraticCurveTo(cx, cy + 0.008 * K, cx + w * 0.42, cy - 0.001 * K); g.quadraticCurveTo(cx, cy + 0.0 * K, cx - w * 0.42, cy - 0.001 * K); g.fill();
            g.beginPath(); g.moveTo(cx - w * 0.55, cy - 0.004 * K); g.quadraticCurveTo(cx, cy + 0.034 * K, cx + w * 0.55, cy - 0.004 * K); g.stroke();
        } else if (kind === 'smirk') { g.beginPath(); g.moveTo(cx - w * 0.4, cy + 0.004 * K); g.quadraticCurveTo(cx + w * 0.1, cy + 0.008 * K, cx + w * 0.5, cy - 0.01 * K); g.stroke(); }
        else if (kind === 'frown') { g.beginPath(); g.moveTo(cx - w * 0.42, cy + 0.007 * K); g.quadraticCurveTo(cx, cy - 0.006 * K, cx + w * 0.42, cy + 0.007 * K); g.stroke(); }
        else if (kind === 'sad') { g.beginPath(); g.moveTo(cx - w * 0.3, cy + 0.006 * K); g.quadraticCurveTo(cx, cy - 0.005 * K, cx + w * 0.3, cy + 0.006 * K); g.stroke(); }
        else if (kind === 'open') {
            g.fillStyle = '#4a1820'; g.beginPath(); g.ellipse(cx, cy + 0.006 * K, w * 0.2, 0.017 * K, 0, 0, TAU); g.fill();
            g.fillStyle = '#c0606a'; g.beginPath(); g.ellipse(cx, cy + 0.014 * K, w * 0.13, 0.007 * K, 0, 0, TAU); g.fill();
            g.stroke();
        }
        g.restore();
    }

    function draw(mood = 'neutral') {
        const M = MOODS[mood] || MOODS.neutral;
        g.clearRect(0, 0, size, size);
        // skin with a soft form shade: lighter forehead and nose, darker at the jaw and temples
        g.fillStyle = look.skin; g.fillRect(0, 0, size, size);
        let gr = g.createLinearGradient(0, Y(0.34), 0, Y(0.0));
        gr.addColorStop(0, 'rgba(255,240,230,0.10)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,20,20,0.22)');
        g.fillStyle = gr; g.fillRect(0, 0, size, size);
        gr = g.createRadialGradient(X(0), Y(0.17), 0.05 * K, X(0), Y(0.17), 0.17 * K);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,30,30,0.28)');
        g.fillStyle = gr; g.fillRect(0, 0, size, size);
        // blush
        for (const sd of [-1, 1]) {
            gr = g.createRadialGradient(X(sd * 0.07), Y(0.11), 0, X(sd * 0.07), Y(0.11), 0.04 * K);
            gr.addColorStop(0, `rgba(255,110,110,${mood === 'smile' ? 0.26 : 0.14})`); gr.addColorStop(1, 'rgba(255,110,110,0)');
            g.fillStyle = gr; g.fillRect(0, 0, size, size);
        }
        // nose: a soft shadow on one side, a nostril pair, a bridge highlight
        g.fillStyle = 'rgba(80,30,25,0.18)'; g.beginPath(); g.ellipse(X(0.012), Y(0.13), 0.006 * K, 0.026 * K, 0.1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(70,25,20,0.4)'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(X(sd * 0.0095), Y(0.112), 0.0036 * K, 0.0024 * K, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(X(-0.003), Y(0.158), 0.004 * K, 0.02 * K, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(80,30,25,0.35)'; g.lineWidth = 0.003 * K; g.beginPath(); g.moveTo(X(-0.012), Y(0.113)); g.quadraticCurveTo(X(0), Y(0.104), X(0.012), Y(0.113)); g.stroke();
        // beard shadow on the jaw
        if (look.beard) {
            g.fillStyle = hexShade(hairC, 0.9); g.globalAlpha = 0.9;
            g.beginPath(); g.moveTo(X(-0.15), Y(0.14)); g.quadraticCurveTo(X(-0.11), Y(0.07), X(-0.045), Y(0.095)); g.quadraticCurveTo(X(0), Y(0.085), X(0.045), Y(0.095)); g.quadraticCurveTo(X(0.11), Y(0.07), X(0.15), Y(0.14)); g.lineTo(X(0.15), Y(-0.02)); g.lineTo(X(-0.15), Y(-0.02)); g.closePath(); g.fill();
            g.globalAlpha = 1;
        }
        eye(-1, M); eye(1, M);
        brow(-1, M, 0); brow(1, M, M.browL || 0);
        mouth(M.mouth);
        tex.needsUpdate = true;
    }
    draw('neutral');
    return { tex, draw };
}

// ================================================================ hair and cloth
const hairCache = new Map();
/** Strands along v with a soft highlight ring: the anime sheen. */
export function hairTexture(color, strand = 1) {
    const key = color + strand;
    if (hairCache.has(key)) return hairCache.get(key);
    const W = 128, H = 256, cv = canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x++) {
        const h = hash3(x, 1, 77);
        g.fillStyle = h > 0.5 ? `rgba(255,255,255,${(h - 0.5) * 0.16 * strand})` : `rgba(0,0,0,${(0.5 - h) * 0.3 * strand})`;
        g.fillRect(x, 0, 1 + (h > 0.85 ? 1 : 0), H);
    }
    // the ring of light
    const band = g.createLinearGradient(0, H * 0.22, 0, H * 0.46);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.34)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band; g.fillRect(0, H * 0.22, W, H * 0.24);
    const t = texture(cv, { repeat: true });
    hairCache.set(key, t);
    return t;
}

const clothCache = new Map();
/** A neutral twill weave that multiplies against vertex colour. */
export function clothTexture(kind = 'twill') {
    if (clothCache.has(kind)) return clothCache.get(kind);
    const S = 64, cv = canvas(S), g = cv.getContext('2d');
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    if (kind === 'twill') {
        for (let i = -S; i < S * 2; i += 3) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const h = hash3(x, y, 5); if (h > 0.9) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, 1, 1); } else if (h < 0.1) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 1, 1); } }
    } else if (kind === 'leather') {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const h = hash3(x >> 1, y >> 1, 9); g.fillStyle = `rgba(${h > 0.5 ? '255,255,255' : '0,0,0'},${Math.abs(h - 0.5) * 0.28})`; g.fillRect(x, y, 1, 1); }
    } else if (kind === 'knit') {
        for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 1, y, 1, 4); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, 1, 4); }
    }
    const t = texture(cv, { repeat: true });
    t.repeat.set(3, 3);
    clothCache.set(kind, t);
    return t;
}

// ================================================================ creature skins
const surfCache = new Map();
function dots(g, S, n, seed, fn) { for (let i = 0; i < n; i++) fn(hash3(i, 1, seed) * S, hash3(i, 2, seed) * S, hash3(i, 3, seed), hash3(i, 4, seed)); }

/** A full-colour creature skin. kind: fur scale plate bark slime stone leaf ghost metal cloth bone. */
export function surface(kind, c1, c2, size = 128) {
    const key = `${kind}|${c1}|${c2}|${size}`;
    if (surfCache.has(key)) return surfCache.get(key);
    const S = size, cv = canvas(S), g = cv.getContext('2d');
    const gradV = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, S, S); };
    gradV(c2, c1);
    if (kind === 'fur') {
        dots(g, S, S * 9, 3, (x, y, a, b) => { g.strokeStyle = a > 0.5 ? shade(c1, 0.7 + b * 0.5, 0.45) : shade(c2, 0.85 + b * 0.5, 0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (b - 0.5) * 3, y + 5 + a * 6); g.stroke(); });
    } else if (kind === 'scale') {
        const r = S / 8;
        for (let row = -1; row < 12; row++) for (let col = -1; col < 10; col++) {
            const x = col * r * 1.0 + (row % 2) * r / 2, y = row * r * 0.62, h = hash3(col, row, 11);
            g.fillStyle = shade(h > 0.5 ? c1 : c2, 0.8 + h * 0.4); g.beginPath(); g.ellipse(x + r / 2, y + r / 2, r * 0.52, r * 0.46, 0, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.ellipse(x + r * 0.42, y + r * 0.34, r * 0.22, r * 0.12, -0.4, 0, TAU); g.fill();
        }
    } else if (kind === 'plate' || kind === 'metal') {
        const n = 3;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const x = (i * S) / n, y = (j * S) / n, h = hash3(i, j, 13);
            g.fillStyle = shade(h > 0.5 ? c1 : c2, 0.85 + h * 0.3); g.fillRect(x + 1, y + 1, S / n - 2, S / n - 2);
            g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, S / n - 2, S / n - 2);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 3, y + 3, S / n - 6, 2);
            g.fillStyle = 'rgba(0,0,0,0.5)'; for (const [dx, dy] of [[5, 5], [S / n - 7, 5], [5, S / n - 7], [S / n - 7, S / n - 7]]) g.fillRect(x + dx, y + dy, 2, 2);
        }
        if (kind === 'metal') for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(255,255,255,${hash3(1, y, 4) * 0.07})`; g.fillRect(0, y, S, 1); }
        dots(g, S, 14, 21, (x, y, a, b) => { g.strokeStyle = 'rgba(160,80,30,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + a * 10, y + b * 14); g.stroke(); });
    } else if (kind === 'bark') {
        for (let x = 0; x < S; x += 2) { const h = hash3(x, 1, 31); g.fillStyle = `rgba(${h > 0.5 ? '255,235,200' : '0,0,0'},${0.1 + Math.abs(h - 0.5) * 0.4})`; g.fillRect(x, 0, 1 + (h > 0.7), S); }
        dots(g, S, 12, 33, (x, y, a) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 3 + a * 4, 7 + a * 8, 0, 0, TAU); g.fill(); });
    } else if (kind === 'slime') {
        dots(g, S, 26, 41, (x, y, a, b) => { g.fillStyle = shade(c2, 1 + b * 0.5, 0.33); g.beginPath(); g.arc(x, y, 3 + a * 10, 0, TAU); g.fill(); });
        dots(g, S, 12, 43, (x, y, a) => { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 2 + a * 5, 3.6, 5.2); g.stroke(); });
    } else if (kind === 'stone') {
        dots(g, S, 60, 51, (x, y, a, b) => { g.fillStyle = a > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x, y, 4 + b * 12, 3 + a * 8, a * 3, 0, TAU); g.fill(); });
        dots(g, S, 6, 53, (x, y, a, b) => { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (a - 0.5) * 40, y + 14 + b * 20); g.lineTo(x + (b - 0.5) * 30, y + 30 + a * 20); g.stroke(); });
        dots(g, S, 18, 57, (x, y, a) => { g.fillStyle = shade('#5aa040', 0.8 + a * 0.4, 0.55); g.beginPath(); g.arc(x, y, 2 + a * 5, 0, TAU); g.fill(); });
    } else if (kind === 'leaf') {
        g.strokeStyle = shade(c2, 1.3, 0.55); g.lineWidth = 2; g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
        for (let y = 6; y < S; y += 12) for (const sd of [-1, 1]) { g.lineWidth = 1; g.beginPath(); g.moveTo(S / 2, y); g.lineTo(S / 2 + sd * S * 0.42, y + 14); g.stroke(); }
    } else if (kind === 'ghost') {
        dots(g, S, 40, 61, (x, y, a, b) => { const rg = g.createRadialGradient(x, y, 0, x, y, 8 + a * 18); rg.addColorStop(0, shade(c2, 1.4, 0.3)); rg.addColorStop(1, shade(c2, 1.4, 0)); g.fillStyle = rg; g.fillRect(x - 30, y - 30, 60, 60); });
    } else if (kind === 'cloth') {
        for (let i = -S; i < S * 2; i += 4) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
        dots(g, S, 8, 71, (x, y, a, b) => { g.fillStyle = shade(c2, 1.2, 0.5); g.fillRect(x, y, 6 + a * 14, 3 + b * 6); });
    } else if (kind === 'bone') {
        dots(g, S, 40, 81, (x, y, a, b) => { g.fillStyle = a > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(90,60,30,0.16)'; g.beginPath(); g.ellipse(x, y, 2 + b * 6, 5 + a * 9, 0, 0, TAU); g.fill(); });
    }
    // everywhere: a little grain
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const h = hash3(x, y, 9); if (h > 0.93) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, 1, 1); } else if (h < 0.07) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x, y, 1, 1); } }
    const t = texture(cv, { repeat: true });
    surfCache.set(key, t);
    return t;
}

/** A glow map: lines of light for emissive seams and circuit traces. rows of [x0,y0,x1,y1] in 0..1. */
export function glowTexture(color, lines, size = 128) {
    const cv = canvas(size), g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
    g.strokeStyle = color; g.lineWidth = 2; g.lineCap = 'round';
    for (const [a, b, c, d] of lines) { g.beginPath(); g.moveTo(a * size, b * size); g.lineTo(c * size, d * size); g.stroke(); }
    return texture(cv, { repeat: true });
}
