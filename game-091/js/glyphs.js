// Procedural neon glyphs for the reel symbols, the Constellation's stars and enemy intents.
// Drawn with Canvas 2D: the view bakes them into reel strip textures, the UI uses them as
// <img> data URLs. No image files anywhere.

import { SYMBOLS } from './sim/data.js';

const EXTRA = {
    reel: '#ff7ad9', i_atk: '#ff5c6c', i_block: '#8fa8ff', i_buff: '#ffb347', i_heal: '#7dffa1', i_jam: '#b0b4c8',
};
export const glyphColor = (k) => SYMBOLS[k]?.color || EXTRA[k] || '#ffffff';

/** Draw glyph `k` centred at (cx, cy) in a box of `s` px. */
export function drawGlyph(ctx, k, cx, cy, s) {
    const col = glyphColor(k);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 7;
    const P = (pts, close = true) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (close) ctx.closePath();
    };
    const star = (r1, r2, n = 5, rot = -Math.PI / 2) => {
        const pts = [];
        for (let i = 0; i < n * 2; i++) {
            const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        P(pts);
    };
    switch (k) {
        case 'blade': // a sword, point up
            P([[0, -40], [8, -26], [8, 14], [-8, 14], [-8, -26]]);
            ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            P([[-22, 16], [22, 16]], false); ctx.stroke();
            P([[0, 18], [0, 36]], false); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 40, 5, 0, Math.PI * 2); ctx.fill();
            break;
        case 'comet': {
            // a tapered tail streaming down-left from a bright head
            const hx = 16, hy = -16, r = 17;
            const a = Math.atan2(1, -1);                        // the tail points down-left
            const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
            const tx = hx + Math.cos(a) * 66, ty = hy + Math.sin(a) * 66;
            P([[hx + nx * r, hy + ny * r], [tx, ty], [hx - nx * r, hy - ny * r]]);
            ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff8e0';
            ctx.beginPath(); ctx.arc(hx + 3, hy - 3, r * 0.45, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'hex': // crescent moon with a rune dot
            ctx.beginPath();
            ctx.arc(0, 0, 34, Math.PI * 0.3, Math.PI * 1.7);
            ctx.arc(14, -6, 26, Math.PI * 1.55, Math.PI * 0.45, true);
            ctx.closePath();
            ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            star(10, 4, 4, 0); ctx.translate(0, 0); ctx.fill();
            break;
        case 'shield':
            P([[0, -38], [32, -26], [28, 10], [0, 38], [-28, 10], [-32, -26]]);
            ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            P([[0, -22], [0, 22]], false); ctx.stroke();
            break;
        case 'mend':
            P([[-10, -34], [10, -34], [10, -10], [34, -10], [34, 10], [10, 10], [10, 34], [-10, 34], [-10, 10], [-34, 10], [-34, -10], [-10, -10]]);
            ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            break;
        case 'charge':
            P([[8, -40], [-22, 6], [-2, 6], [-10, 40], [22, -8], [2, -8]]);
            ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            break;
        case 'wild':
            star(40, 17);
            ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            star(14, 6, 4, 0); ctx.fill();
            break;
        case 'static':
            ctx.lineWidth = 6;
            P([[-36, -6], [-24, -20], [-12, 8], [0, -24], [12, 14], [24, -12], [36, 4]], false); ctx.stroke();
            ctx.globalAlpha = 0.5;
            P([[-30, 20], [-14, 12], [2, 26], [18, 14], [30, 24]], false); ctx.stroke();
            break;
        case 'reel': // a little slot window
            ctx.strokeRect(-32, -36, 64, 72);
            for (const x of [-11, 11]) { P([[x, -36], [x, 36]], false); ctx.stroke(); }
            P([[-40, 0], [40, 0]], false); ctx.stroke();
            break;
        case 'i_atk': // three claw marks
            for (const o of [-18, 0, 18]) { P([[o - 10, -30], [o + 8, 30]], false); ctx.stroke(); }
            break;
        case 'i_block':
            P([[0, -34], [28, -24], [25, 8], [0, 34], [-25, 8], [-28, -24]]);
            ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            break;
        case 'i_buff':
            P([[0, -38], [26, -8], [10, -8], [10, 34], [-10, 34], [-10, -8], [-26, -8]]);
            ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            break;
        case 'i_heal':
            P([[-8, -30], [8, -30], [8, -8], [30, -8], [30, 8], [8, 8], [8, 30], [-8, 30], [-8, 8], [-30, 8], [-30, -8], [-8, -8]]);
            ctx.stroke();
            break;
        case 'i_jam':
            P([[-34, -4], [-20, -18], [-6, 10], [8, -22], [22, 12], [34, -6]], false); ctx.stroke();
            break;
        default:
            ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}

const cache = new Map();
/** A data URL of glyph `k`, cached. */
export function glyphURL(k, size = 64) {
    const key = k + '@' + size;
    if (!cache.has(key)) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        drawGlyph(c.getContext('2d'), k, size / 2, size / 2, size * 0.86);
        cache.set(key, c.toDataURL());
    }
    return cache.get(key);
}

/** An <img> tag for inline use in the UI. */
export const glyphImg = (k, cls = 'gl') => `<img class="${cls}" src="${glyphURL(k)}" alt="" aria-hidden="true">`;
