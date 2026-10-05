/**
 * portraits.js — frontal head-and-shoulders portraits for dialogue, in the
 * same palette-indexed pixel style as the sprites (same rasterizer, same
 * hue-shifted ramps). A portrait is a small recipe: hair style, eyes, mouth,
 * extras; drawn into a 72x72 buffer and shown scaled up 3-4x.
 */

import { IndexBuffer, capsule, ellipse, polygon, dot, closeOutline, matBase, OUTLINE } from './raster.js';
import { ramp, hexToRgb } from './chars.js';

const W = 72, H = 72;

const SPECS = {
    juno: { skin: '#f0bd98', hair: '#ff3f9e', suit: '#353f5e', plate: '#7584a8', glow: '#44f2ff', eye: '#3a2a4a', lip: '#c86a7a', style: 'ponytail', eyes: 'visorUp', collar: true, core: true },
    mika: { skin: '#f3c6a5', hair: '#1d1a28', suit: '#e4e2ec', plate: '#a9aec2', glow: '#ff2d55', eye: '#3a2030', lip: '#c87080', style: 'bob', eyes: 'visor', collar: true, streak: true },
    mikaFree: { skin: '#f3c6a5', hair: '#1d1a28', suit: '#e4e2ec', plate: '#a9aec2', glow: '#59ffd0', eye: '#2a3a3a', lip: '#c87080', style: 'bob', eyes: 'normal', collar: true, streak: true },
    echo: { skin: '#1c4a66', hair: '#0e2232', suit: '#2b6e93', plate: '#2b6e93', glow: '#5ff6ff', eye: '#5ff6ff', lip: '#5ff6ff', style: 'holo', eyes: 'holo', scan: true },
    punk: { skin: '#d8a07a', hair: '#7dff4a', suit: '#4a2f2a', plate: '#b9c0cc', glow: '#7dff4a', eye: '#2a1a1a', lip: '#a05a4a', style: 'mohawk', eyes: 'angry', piercing: true },
    bruiser: { skin: '#c48660', hair: '#3a2418', suit: '#d8d0c0', plate: '#b0b6c0', glow: '#ffb02a', eye: '#202430', lip: '#8a4a3a', style: 'bald', eyes: 'shades', beard: true, wide: 1.25 },
    jackhammer: { skin: '#b07850', hair: '#e8e0d0', suit: '#e0b020', plate: '#7a8090', glow: '#ff8a1a', eye: '#2a1a10', lip: '#8a4a3a', style: 'flattop', eyes: 'goggle', beard: true, wide: 1.3, scar: true },
    viper: { skin: '#e8c0a0', hair: '#1aa86a', suit: '#16241e', plate: '#2a5a42', glow: '#ffd23a', eye: '#1a3a2a', lip: '#a03a5a', style: 'viper', eyes: 'visor', collar: true },
    kuroda: { skin: '#606878', hair: '#2a2a30', suit: '#5a1a1e', plate: '#d8a83a', glow: '#ffea3a', eye: '#ffea3a', lip: '#3a3a44', style: 'oni', eyes: 'glow', wide: 1.15 },
    rourke: { skin: '#d0a080', hair: '#7a7a7a', suit: '#5a6248', plate: '#a8ae90', glow: '#3ac8ff', eye: '#2a3040', lip: '#8a5a4a', style: 'buzz', eyes: 'normal', headset: true, scar: true, wide: 1.1 },
    varga: { skin: '#ecd0c0', hair: '#c8c8d0', suit: '#e8eef4', plate: '#9aa4b4', glow: '#3aff8a', eye: '#3a4a5a', lip: '#a06070', style: 'bun', eyes: 'glasses', coat: true },
    goliath: { skin: '#8aa07a', hair: '#5a6a7a', suit: '#c07080', plate: '#e8dcc0', glow: '#b6ff2a', eye: '#b6ff2a', lip: '#4a5a3a', style: 'tubes', eyes: 'glowOne', wide: 1.4 },
    magnus: { skin: '#e6c0a0', hair: '#d8dce4', suit: '#202232', plate: '#f0f0f6', glow: '#c8a03a', eye: '#3a4a6a', lip: '#a07060', style: 'slick', eyes: 'cold', tie: true },
    magnus2: { skin: '#e6c0a0', hair: '#d8dce4', suit: '#e8e2d0', plate: '#d8a83a', glow: '#ffd23a', eye: '#ffd23a', lip: '#a07060', style: 'slick', eyes: 'glow', crown: true, wide: 1.1 },
    guard: { skin: '#c99272', hair: '#2c3a52', suit: '#2c3a52', plate: '#8c9ab4', glow: '#ffb43a', eye: '#000000', lip: '#000000', style: 'helmet', eyes: 'visorWide' },
    ninja: { skin: '#e8b898', hair: '#1a1a26', suit: '#1a1a26', plate: '#d02a4a', glow: '#ff2a8a', eye: '#ff2a8a', lip: '#000000', style: 'ninja', eyes: 'glow' },
    synth: { skin: '#dfe4ee', hair: '#9aa4bc', suit: '#3a3e4c', plate: '#dfe4ee', glow: '#3affd2', eye: '#3affd2', lip: '#000000', style: 'synth', eyes: 'slit' },
    knifer: { skin: '#c99272', hair: '#3b3f4a', suit: '#3b3f4a', plate: '#d7dde8', glow: '#ff3a5a', eye: '#ff3a5a', lip: '#5a3a3a', style: 'hood', eyes: 'angry' },
    gunner: { skin: '#e2b490', hair: '#1a1a22', suit: '#3a3448', plate: '#7a1a2a', glow: '#ff3a3a', eye: '#000000', lip: '#8a5040', style: 'slick', eyes: 'shades', tie: false },
};
const MATS = ['skin', 'hair', 'suit', 'plate', 'glow', 'eye', 'lip', 'white'];
const M = Object.fromEntries(MATS.map((n, i) => [n, i]));

function palette(spec) {
    const pal = new Uint8Array(32 * 4);
    pal.set([...hexToRgb('#0c0810'), 255], 4);
    MATS.forEach((n, i) => {
        const tones = ramp(n === 'white' ? '#f4f0ec' : spec[n]);
        if (n === 'skin') tones[0] = tones[0].map((v, k) => Math.round(v * 0.45 + tones[1][k] * 0.55));
        for (let t = 0; t < 3; t++) pal.set([...tones[t], 255], (2 + i * 3 + t) * 4);
    });
    return pal;
}

export function renderPortrait(key) {
    const s = SPECS[key] || SPECS.punk;
    const b = new IndexBuffer(W, H);
    const wd = s.wide || 1;
    const cx = 36, cy = 30;
    const hrx = 11.5 * Math.min(1.15, wd), hry = 13.5;
    const g = (id) => ({ group: id });
    const C = (ax, ay, bx, by, r1, r2, m, o) => capsule(b, ax, ay, bx, by, r1, r2, M[m], o);
    const E = (x, y, rx, ry, m, o, rot = 0) => ellipse(b, x, y, rx, ry, rot, M[m], o);
    const Pp = (pts, m, o) => polygon(b, pts, M[m], o);

    // --- behind the head
    if (s.style === 'ponytail') { C(cx + 9, cy - 8, cx + 18, cy + 6, 4, 5, 'hair', g(1)); C(cx + 18, cy + 6, cx + 20, cy + 26, 5, 3, 'hair', g(1)); C(cx + 20, cy + 26, cx + 17, cy + 38, 3, 1, 'hair', g(1)); }
    if (s.style === 'bob') E(cx, cy + 2, hrx + 4, hry + 2, 'hair', g(1));
    if (s.style === 'viper') { C(cx - 6, cy - 8, cx - 16, cy + 30, 4, 2, 'hair', g(1)); }
    if (s.style === 'hood') E(cx, cy + 2, hrx + 6, hry + 5, 'hair', g(1));
    if (s.style === 'tubes') { C(cx - 14, cy - 6, cx - 24, cy + 24, 2.5, 2.5, 'hair', g(1)); C(cx + 14, cy - 6, cx + 24, cy + 24, 2.5, 2.5, 'hair', g(1)); }
    if (s.crown) { for (const dx of [-10, 0, 10]) Pp([[cx + dx - 4, cy - 14], [cx + dx, cy - 30 + Math.abs(dx) * 0.6], [cx + dx + 4, cy - 14]], 'glow', { ...g(1), mode: 'glow' }); }

    // --- shoulders
    const sw = 30 * wd;
    E(cx, H + 2, sw, 26, 'suit', g(2));
    if (s.coat) { Pp([[cx - 8, H - 25], [cx, H], [cx + 8, H - 25]], 'plate', g(2)); }
    if (s.collar) { C(cx - 12, H - 23, cx - 3, H - 20, 3, 2.5, 'plate', g(2)); C(cx + 12, H - 23, cx + 3, H - 20, 3, 2.5, 'plate', g(2)); }
    if (s.tie) { Pp([[cx - 7, H - 25], [cx, H - 10], [cx + 7, H - 25]], 'plate', g(2)); Pp([[cx - 2, H - 23], [cx + 2, H - 23], [cx + 3, H], [cx - 3, H]], 'glow', g(2)); }
    if (s.core) E(cx, H - 10, 3, 3, 'glow', { ...g(2), mode: 'glow' });
    if (s.style === 'oni' || s.style === 'helmet' || s.style === 'synth') { E(cx - sw * 0.7, H - 14, 10, 8, 'plate', g(2)); E(cx + sw * 0.7, H - 14, 10, 8, 'plate', g(2)); }

    // --- neck & head
    C(cx, cy + 10, cx, cy + 19, 5 * wd, 6 * wd, 'skin', g(3));
    if (s.style !== 'holo') { E(cx - hrx + 0.5, cy + 2, 2.4, 3.6, 'skin', g(4)); E(cx + hrx - 0.5, cy + 2, 2.4, 3.6, 'skin', g(4)); }
    E(cx, cy, hrx, hry, s.style === 'holo' ? 'plate' : 'skin', g(4));
    // jaw shape
    if (wd > 1.1) E(cx, cy + 7, hrx * 0.9, 7, 'skin', g(4));

    // --- face
    const ey = cy + 1, ex = 4.6;
    const eyesNormal = (col = 'eye', brow = 'hair', angry = false, cold = false) => {
        for (const d of [-1, 1]) {
            E(cx + d * ex, ey, 2.4, 1.6, 'white', { group: 5, mode: 'flat', ring: false });
            E(cx + d * ex + (cold ? 0 : d * 0.2), ey + 0.2, 1.2, 1.4, col, { group: 5, mode: 'flat', ring: false });
            dot(b, cx + d * ex + 0.4, ey - 0.6, matBase(M.white) + 2);
            C(cx + d * (ex - 2.6), ey - 3.6 + (angry ? 1 : 0), cx + d * (ex + 2.4), ey - 3.8 - (angry ? 1 : 0), 0.7, 0.6, brow, { group: 5, mode: 'dark', ring: false });
        }
    };
    switch (s.eyes) {
        case 'normal': eyesNormal(); break;
        case 'angry': eyesNormal('eye', 'hair', true); break;
        case 'cold': eyesNormal('eye', 'hair', false, true); break;
        case 'visorUp': eyesNormal(); C(cx - 10, cy - 7, cx + 10, cy - 7, 1.6, 1.6, 'glow', { group: 6, mode: 'glow' }); break;
        case 'visor': C(cx - 10, ey, cx + 10, ey, 2.2, 2.2, 'glow', { group: 6, mode: 'glow' }); break;
        case 'visorWide': C(cx - 11, ey - 1, cx + 11, ey - 1, 3.4, 3.4, 'glow', { group: 6, mode: 'glow' }); break;
        case 'shades': C(cx - 9, ey, cx - 2, ey, 2.2, 2.2, 'eye', { group: 6, mode: 'flat' }); C(cx + 2, ey, cx + 9, ey, 2.2, 2.2, 'eye', { group: 6, mode: 'flat' }); C(cx - 2, ey, cx + 2, ey, 0.6, 0.6, 'eye', g(6)); dot(b, cx - 7, ey - 1, matBase(M.white) + 2); dot(b, cx + 4, ey - 1, matBase(M.white) + 2); break;
        case 'goggle': E(cx - 5, ey, 3.4, 3, 'plate', g(6)); E(cx + 5, ey, 3.4, 3, 'plate', g(6)); E(cx - 5, ey, 2, 1.8, 'glow', { group: 7, mode: 'glow' }); E(cx + 5, ey, 2, 1.8, 'glow', { group: 7, mode: 'glow' }); break;
        case 'glasses': eyesNormal(); for (const d of [-1, 1]) { E(cx + d * ex, ey, 3.4, 2.8, 'plate', { group: 6, mode: 'flat', ring: true }); E(cx + d * ex, ey, 2.4, 1.8, 'white', { group: 7, mode: 'flat', ring: false }); E(cx + d * ex, ey, 1.1, 1.2, 'eye', { group: 7, mode: 'flat', ring: false }); } break;
        case 'glow': for (const d of [-1, 1]) E(cx + d * ex, ey, 2.2, 1.2, 'glow', { group: 6, mode: 'glow' }); break;
        case 'glowOne': E(cx - ex, ey, 2.4, 1.8, 'glow', { group: 6, mode: 'glow' }); C(cx + ex - 2, ey - 1, cx + ex + 2, ey + 1, 0.6, 0.6, 'eye', { group: 6, mode: 'dark', ring: false }); break;
        case 'slit': C(cx - 9, ey, cx + 9, ey, 1, 1, 'glow', { group: 6, mode: 'glow' }); break;
        case 'holo': C(cx - 9, ey, cx + 9, ey, 1.8, 1.8, 'glow', { group: 6, mode: 'glow' }); break;
        default: eyesNormal();
    }
    // nose & mouth
    if (!['helmet', 'synth', 'ninja', 'oni', 'holo'].includes(s.style)) {
        C(cx + 0.5, ey + 3, cx + 1, ey + 6, 0.6, 0.8, 'skin', { group: 8, mode: 'dark', ring: false });
        C(cx - 3, cy + 9.5, cx + 3, cy + 9.5, 0.7, 0.7, 'lip', { group: 8, mode: 'flat', ring: false });
    }
    if (s.style === 'holo') { C(cx - 3, cy + 8, cx + 3, cy + 8, 0.6, 0.6, 'glow', { group: 8, mode: 'glow', ring: false }); }
    if (s.beard) { E(cx, cy + 10, hrx * 0.85, 6, 'hair', g(9)); C(cx - 3, cy + 8.5, cx + 3, cy + 8.5, 0.7, 0.7, 'lip', { group: 9, mode: 'flat', ring: false }); }
    if (s.scar) C(cx + 6, cy - 6, cx + 3, cy + 6, 0.5, 0.5, 'lip', { group: 9, mode: 'flat', ring: false });
    if (s.piercing) { dot(b, cx - hrx + 1, cy + 4, matBase(M.plate) + 2); dot(b, cx + 3, cy + 10, matBase(M.plate) + 2); }

    // --- hair / headgear over the head
    switch (s.style) {
        case 'ponytail':
            E(cx, cy - 7, hrx + 1.5, 8, 'hair', g(10));
            Pp([[cx - 12, cy - 5], [cx - 4, cy - 12], [cx + 2, cy - 5], [cx - 6, cy - 1]], 'hair', g(10));
            Pp([[cx + 1, cy - 11], [cx + 12, cy - 6], [cx + 12, cy + 2], [cx + 6, cy - 4]], 'hair', g(10));
            break;
        case 'bob':
            E(cx, cy - 7, hrx + 2, 8, 'hair', g(10));
            Pp([[cx - 13, cy - 6], [cx + 13, cy - 6], [cx + 12, cy - 2], [cx - 12, cy - 2]], 'hair', g(10));
            C(cx - 12, cy - 4, cx - 12, cy + 10, 3, 2.5, 'hair', g(10)); C(cx + 12, cy - 4, cx + 12, cy + 10, 3, 2.5, 'hair', g(10));
            if (s.streak) C(cx + 4, cy - 12, cx + 7, cy - 2, 0.9, 0.9, 'white', { group: 11, mode: 'flat', ring: false });
            break;
        case 'mohawk':
            for (let k = -2; k <= 2; k++) Pp([[cx - 3 + k * 0.5, cy - 11], [cx + k * 3, cy - 24 + Math.abs(k) * 2], [cx + 3 + k * 0.5, cy - 11]], 'hair', g(10));
            C(cx - 10, cy - 6, cx - 6, cy - 11, 1.2, 1.2, 'hair', { group: 10, mode: 'dark', ring: false }); C(cx + 10, cy - 6, cx + 6, cy - 11, 1.2, 1.2, 'hair', { group: 10, mode: 'dark', ring: false });
            break;
        case 'bald': E(cx - 3, cy - 9, 3, 1.6, 'skin', { group: 10, mode: 'light', ring: false }); break;
        case 'flattop': Pp([[cx - 11, cy - 6], [cx - 11, cy - 16], [cx + 11, cy - 16], [cx + 11, cy - 6]], 'hair', g(10)); break;
        case 'buzz': E(cx, cy - 8, hrx + 0.5, 6, 'hair', { group: 10, mode: 'cel' }); break;
        case 'slick': E(cx, cy - 8, hrx + 1, 7, 'hair', g(10)); Pp([[cx - 12, cy - 8], [cx + 6, cy - 15], [cx + 13, cy - 6], [cx + 12, cy - 2], [cx + 2, cy - 9]], 'hair', g(10)); break;
        case 'bun': E(cx, cy - 8, hrx + 1, 7, 'hair', g(10)); E(cx, cy - 17, 5, 4, 'hair', g(10)); break;
        case 'viper':
            Pp([[cx - 13, cy - 2], [cx - 12, cy - 12], [cx, cy - 18], [cx + 12, cy - 12], [cx + 13, cy - 2], [cx + 8, cy - 8], [cx - 8, cy - 8]], 'plate', g(10));
            Pp([[cx - 2, cy - 18], [cx, cy - 26], [cx + 2, cy - 18]], 'plate', g(10));
            break;
        case 'hood': Pp([[cx - 15, cy + 12], [cx - 14, cy - 10], [cx, cy - 18], [cx + 14, cy - 10], [cx + 15, cy + 12], [cx + 10, cy + 2], [cx + 10, cy - 8], [cx - 10, cy - 8], [cx - 10, cy + 2]], 'hair', g(10)); C(cx - 9, cy + 7, cx + 9, cy + 7, 3, 3, 'suit', { group: 11, mode: 'dark' }); break;
        case 'helmet': E(cx, cy - 3, hrx + 3, hry + 1, 'hair', g(10)); C(cx - 11, ey - 1, cx + 11, ey - 1, 3.4, 3.4, 'glow', { group: 11, mode: 'glow' }); C(cx - 6, cy + 10, cx + 6, cy + 10, 2.5, 2.5, 'plate', g(11)); break;
        case 'synth': E(cx, cy - 2, hrx + 1, hry + 1, 'plate', g(10)); C(cx - 9, ey, cx + 9, ey, 1, 1, 'glow', { group: 11, mode: 'glow' }); C(cx - 8, cy - 9, cx + 8, cy - 9, 0.6, 0.6, 'hair', { group: 11, mode: 'flat', ring: false }); break;
        case 'ninja': E(cx, cy - 2, hrx + 1, hry + 1, 'hair', g(10)); C(cx - 9, ey, cx + 9, ey, 2.4, 2.4, 'skin', { group: 11 }); for (const d of [-1, 1]) E(cx + d * ex, ey, 2, 1.1, 'glow', { group: 12, mode: 'glow' }); C(cx - 13, cy - 6, cx + 13, cy - 6, 1.6, 1.6, 'plate', g(12)); break;
        case 'oni':
            E(cx, cy - 4, hrx + 3, hry, 'hair', g(10));
            Pp([[cx - 10, cy - 10], [cx - 20, cy - 26], [cx - 6, cy - 13]], 'plate', g(11)); Pp([[cx + 10, cy - 10], [cx + 20, cy - 26], [cx + 6, cy - 13]], 'plate', g(11));
            Pp([[cx - 11, cy - 3], [cx + 11, cy - 3], [cx + 10, cy + 12], [cx, cy + 15], [cx - 10, cy + 12]], 'suit', g(11));
            for (const d of [-1, 1]) E(cx + d * ex, ey, 2.4, 1.2, 'glow', { group: 12, mode: 'glow' });
            for (let k = -3; k <= 3; k++) dot(b, cx + k * 2, cy + 10, matBase(M.white) + 1);
            break;
        case 'tubes': E(cx - 6, cy - 9, 3, 2, 'plate', g(10)); E(cx + 7, cy + 7, 2, 1.6, 'glow', { group: 10, mode: 'glow' }); break;
        case 'holo': E(cx, cy - 4, hrx + 1.5, hry - 2, 'suit', g(10)); C(cx - 10, ey, cx + 10, ey, 1.8, 1.8, 'glow', { group: 11, mode: 'glow' }); break;
        default: break;
    }
    if (s.headset) { C(cx - hrx - 1, cy - 2, cx - hrx - 1, cy + 6, 2, 2, 'plate', g(13)); C(cx - hrx - 1, cy + 6, cx - 4, cy + 10, 0.7, 0.7, 'plate', g(13)); dot(b, cx - 4, cy + 10, matBase(M.glow) + 2); }
    if (key === 'juno') { E(cx - hrx - 0.5, cy + 1, 2.4, 2.4, 'plate', g(13)); dot(b, cx - hrx - 0.5, cy + 1, matBase(M.glow) + 2); }
    closeOutline(b);

    // to RGBA
    const pal = palette(s);
    const out = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        const v = b.idx[i];
        if (!v) continue;
        out.set([pal[v * 4], pal[v * 4 + 1], pal[v * 4 + 2], 255], i * 4);
    }
    // ECHO is a hologram: scanlines
    if (s.scan) for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (out[i + 3]) out[i + 3] = 150; }
    void OUTLINE;
    return { w: W, h: H, data: out };
}

export const PORTRAIT_KEYS = Object.keys(SPECS);
