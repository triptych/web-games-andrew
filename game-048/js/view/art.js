/**
 * art.js — every picture in the game, drawn in code: reel symbol tiles (cached
 * per size), the player's frame (drawn live so its parts animate and so every
 * installed system shows), the Determinant's units, and comm portraits.
 */

import { SYMBOLS } from '../sim/symbols.js';

const TAU = Math.PI * 2;

function poly(ctx, pts, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (close) ctx.closePath();
}
function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
export { rrect };

export function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(hexA1, hexB, t) {
    const a = parseInt(hexA1.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** Text in unit space: canvas fonts below 1px are unreliable, so draw at 100× and scale down. */
function smallText(ctx, str, x, y, size100, weight, family) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.01, 0.01);
    ctx.font = `${weight} ${size100}px ${family}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, 0, 0);
    ctx.restore();
}

// ------------------------------------------------------------------ symbol glyphs (unit space, -1..1)

const GLYPHS = {
    blade(ctx, col) {
        ctx.rotate(Math.PI / 4);
        const g = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
        g.addColorStop(0, col); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, col);
        ctx.fillStyle = g;
        poly(ctx, [0, -1.0, 0.17, -0.72, 0.17, 0.32, -0.17, 0.32, -0.17, -0.72]);
        ctx.fill();
        ctx.fillStyle = '#c8d4ee';
        rrect(ctx, -0.46, 0.3, 0.92, 0.14, 0.05); ctx.fill();
        ctx.fillStyle = '#4a5878';
        ctx.fillRect(-0.08, 0.44, 0.16, 0.36);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0.86, 0.11, 0, TAU); ctx.fill();
    },
    cannon(ctx, col) {
        ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.arc(0, 0, 0.82, 0, TAU); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate((i * TAU) / 4); ctx.fillStyle = hexA(col, 0.7); ctx.fillRect(-0.04, -0.98, 0.08, 0.26); ctx.restore(); }
        ctx.rotate(Math.PI / 4);
        const g = ctx.createLinearGradient(-0.3, 0, 0.3, 0);
        g.addColorStop(0, mix(col, '#000000', 0.25)); g.addColorStop(0.45, '#fff3d6'); g.addColorStop(1, mix(col, '#000000', 0.35));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-0.27, -0.15); ctx.quadraticCurveTo(-0.26, -0.78, 0, -0.86); ctx.quadraticCurveTo(0.26, -0.78, 0.27, -0.15);
        ctx.lineTo(0.27, 0.6); ctx.lineTo(-0.27, 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mix(col, '#000000', 0.45);
        ctx.fillRect(-0.29, 0.18, 0.58, 0.13);
        ctx.fillStyle = '#d9b071';
        ctx.fillRect(-0.31, 0.58, 0.62, 0.16);
    },
    missile(ctx, col) {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd34d';
        poly(ctx, [-0.15, 0.5, 0, 1.0, 0.15, 0.5]); ctx.fill();
        ctx.fillStyle = '#ff8a2a';
        poly(ctx, [-0.09, 0.5, 0, 0.8, 0.09, 0.5]); ctx.fill();
        const g = ctx.createLinearGradient(-0.22, 0, 0.22, 0);
        g.addColorStop(0, mix(col, '#000000', 0.2)); g.addColorStop(0.5, '#ffe0e6'); g.addColorStop(1, mix(col, '#000000', 0.3));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -0.98); ctx.quadraticCurveTo(0.24, -0.62, 0.21, -0.2); ctx.lineTo(0.21, 0.48); ctx.lineTo(-0.21, 0.48); ctx.lineTo(-0.21, -0.2); ctx.quadraticCurveTo(-0.24, -0.62, 0, -0.98);
        ctx.fill();
        ctx.fillStyle = col;
        poly(ctx, [0.21, 0.1, 0.5, 0.56, 0.21, 0.48]); ctx.fill();
        poly(ctx, [-0.21, 0.1, -0.5, 0.56, -0.21, 0.48]); ctx.fill();
        ctx.fillStyle = '#2a1018';
        ctx.beginPath(); ctx.arc(0, -0.34, 0.09, 0, TAU); ctx.fill();
    },
    arc(ctx, col) {
        const g = ctx.createLinearGradient(0, -1, 0, 1);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, col);
        ctx.fillStyle = g;
        poly(ctx, [0.22, -0.98, -0.52, 0.12, -0.06, 0.12, -0.28, 0.98, 0.56, -0.22, 0.08, -0.22, 0.42, -0.98]);
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05; ctx.stroke();
    },
    shield(ctx, col) {
        const g = ctx.createLinearGradient(0, -0.9, 0, 0.95);
        g.addColorStop(0, '#e6f0ff'); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000000', 0.5));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -0.92); ctx.lineTo(0.72, -0.62); ctx.lineTo(0.64, 0.18); ctx.quadraticCurveTo(0.42, 0.72, 0, 0.96);
        ctx.quadraticCurveTo(-0.42, 0.72, -0.64, 0.18); ctx.lineTo(-0.72, -0.62); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.07; ctx.stroke();
        ctx.strokeStyle = hexA('#ffffff', 0.7); ctx.lineWidth = 0.1;
        poly(ctx, [-0.34, -0.2, 0, 0.12, 0.34, -0.2], false); ctx.stroke();
        poly(ctx, [-0.34, 0.12, 0, 0.44, 0.34, 0.12], false); ctx.stroke();
    },
    repair(ctx, col) {
        const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 0.9);
        g.addColorStop(0, '#eaffef'); g.addColorStop(1, col);
        ctx.fillStyle = g;
        rrect(ctx, -0.24, -0.82, 0.48, 1.64, 0.12); ctx.fill();
        rrect(ctx, -0.82, -0.24, 1.64, 0.48, 0.12); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05;
        ctx.strokeRect(-0.1, -0.1, 0.2, 0.2);
    },
    energy(ctx, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 0.12;
        const hex = [];
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; hex.push(Math.cos(a) * 0.86, Math.sin(a) * 0.86); }
        poly(ctx, hex); ctx.fillStyle = hexA(col, 0.18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fffbe0';
        poly(ctx, [0.1, -0.62, -0.34, 0.08, -0.02, 0.08, -0.14, 0.62, 0.34, -0.12, 0.04, -0.12, 0.22, -0.62]);
        ctx.fill();
    },
    scrap(ctx, col) {
        ctx.fillStyle = col;
        for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((i * TAU) / 8); ctx.fillRect(-0.14, -0.92, 0.28, 0.3); ctx.restore(); }
        const g = ctx.createRadialGradient(-0.2, -0.2, 0.1, 0, 0, 0.7);
        g.addColorStop(0, '#ffe9c4'); g.addColorStop(1, mix(col, '#000000', 0.25));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 0.66, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a1208';
        ctx.beginPath(); ctx.arc(0, 0, 0.24, 0, TAU); ctx.fill();
    },
    wild(ctx) {
        const g = ctx.createLinearGradient(-0.9, -0.9, 0.9, 0.9);
        g.addColorStop(0, '#45f3ff'); g.addColorStop(0.35, '#ff4dff'); g.addColorStop(0.7, '#ffe14d'); g.addColorStop(1, '#46ff9a');
        const pts = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU - Math.PI / 2; const r = i % 4 === 0 ? 0.98 : i % 2 === 0 ? 0.5 : 0.36; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
        poly(ctx, pts); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.06; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        smallText(ctx, 'W', 0, 0.03, 42, 'bold', 'system-ui, sans-serif');
    },
    core(ctx, col) {
        const g = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 0.5);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ffb3ff'); g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 0.44, 0, TAU); ctx.fill();
        ctx.strokeStyle = hexA('#ffd0ff', 0.9); ctx.lineWidth = 0.07;
        for (const a of [-0.6, 0.6, 1.57]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, 0.92, 0.3, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    },
    glitch(ctx, col) {
        const slices = [[-0.7, -0.75, 1.3, 0.22, 0.08], [-0.6, -0.48, 1.1, 0.2, -0.12], [-0.75, -0.2, 1.4, 0.26, 0.14], [-0.5, 0.12, 1.0, 0.18, -0.06], [-0.7, 0.36, 1.25, 0.24, 0.1], [-0.4, 0.66, 0.8, 0.16, -0.14]];
        for (const [x, y, w, h, o] of slices) {
            ctx.fillStyle = hexA('#ff2a44', 0.7); ctx.fillRect(x + o - 0.05, y, w, h);
            ctx.fillStyle = hexA('#2affee', 0.5); ctx.fillRect(x - o + 0.05, y, w, h);
            ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = '#0b0c12';
        smallText(ctx, 'ERR', 0, 0.02, 40, 'bold', 'ui-monospace, monospace');
    },
    emp(ctx, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 0.1;
        for (const r of [0.3, 0.58, 0.86]) { ctx.beginPath(); ctx.arc(0, 0, r, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); }
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 0.14, 0, TAU); ctx.fill();
    },
    patch(ctx, col) {
        ctx.fillStyle = col;
        rrect(ctx, -0.8, -0.34, 1.6, 0.68, 0.3); ctx.fill();
        ctx.fillStyle = '#ffffff';
        for (const [x, y] of [[-0.3, -0.12], [0, 0.12], [0.3, -0.12], [-0.3, 0.12], [0.3, 0.12], [0, -0.12]]) { ctx.beginPath(); ctx.arc(x, y, 0.06, 0, TAU); ctx.fill(); }
    },
};

/** Draw a glyph in a box centred on (x, y) of size s. */
export function drawGlyph(ctx, glyph, x, y, s, col) {
    const f = GLYPHS[glyph];
    if (!f) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 2, s / 2);
    f(ctx, col ?? '#ffffff');
    ctx.restore();
}

const tileCache = new Map();

/**
 * A cached reel tile. variant: 'n' normal, 'lit' highlighted, 'blur' motion-blurred.
 */
export function symbolTile(sym, size, variant = 'n') {
    size = Math.max(8, Math.round(size));
    const key = `${sym}|${size}|${variant}`;
    let c = tileCache.get(key);
    if (c) return c;
    const d = SYMBOLS[sym];
    c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const inset = size * 0.06;
    const lit = variant === 'lit';
    // glass tile
    const g = ctx.createLinearGradient(0, inset, 0, size - inset);
    g.addColorStop(0, lit ? mix(d.color, '#ffffff', 0.15) : '#18203a');
    g.addColorStop(1, lit ? mix(d.color, '#000000', 0.45) : '#0a0e1c');
    ctx.fillStyle = g;
    rrect(ctx, inset, inset, size - inset * 2, size - inset * 2, size * 0.14);
    ctx.fill();
    ctx.strokeStyle = hexA(d.color, lit ? 1 : 0.38);
    ctx.lineWidth = Math.max(1, size * (lit ? 0.045 : 0.025));
    ctx.stroke();
    if (sym === 'glitch') {
        ctx.fillStyle = 'rgba(255,40,70,0.08)';
        ctx.fill();
    }
    // icon with glow
    ctx.save();
    ctx.shadowColor = d.color;
    ctx.shadowBlur = size * (lit ? 0.22 : 0.1);
    drawGlyph(ctx, d.glyph, size / 2, size / 2, size * (sym === 'wild' || sym === 'core' ? 0.7 : 0.62), d.color);
    ctx.restore();
    // glass sheen
    const sh = ctx.createLinearGradient(0, inset, 0, size * 0.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.13)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    rrect(ctx, inset * 1.5, inset * 1.5, size - inset * 3, size * 0.4, size * 0.1);
    ctx.fill();
    if (variant === 'blur') {
        // vertical smear: redraw the tile into itself with offsets
        const tmp = document.createElement('canvas');
        tmp.width = c.width; tmp.height = c.height;
        tmp.getContext('2d').drawImage(c, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        for (let i = -3; i <= 3; i++) {
            ctx.globalAlpha = 0.24 - Math.abs(i) * 0.05;
            ctx.drawImage(tmp, 0, i * c.height * 0.09);
        }
        ctx.globalAlpha = 1;
    }
    tileCache.set(key, c);
    if (tileCache.size > 400) tileCache.delete(tileCache.keys().next().value);
    return c;
}

export function clearTileCache() { tileCache.clear(); }

/** Icon image for DOM use (data URL), cached. */
const iconCache = new Map();
export function iconURL(glyph, color, size = 64) {
    const key = `${glyph}|${color}|${size}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.shadowColor = color; ctx.shadowBlur = size * 0.12;
    if (GLYPHS[glyph]) drawGlyph(ctx, glyph, size / 2, size / 2, size * 0.78, color);
    else drawUiIcon(ctx, glyph, size, color);
    const url = c.toDataURL();
    iconCache.set(key, url);
    return url;
}

/** Simple line icons for systems, intents, tabs. Drawn in a size×size box. */
function drawUiIcon(ctx, name, s, col) {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.scale(s / 2, s / 2);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const L = (pts) => { poly(ctx, pts, false); ctx.stroke(); };
    switch (name) {
        case 'reels': for (let i = -1; i <= 1; i++) { rrect(ctx, i * 0.6 - 0.24, -0.7, 0.48, 1.4, 0.1); ctx.stroke(); } break;
        case 'matrix': for (const y of [-0.5, 0, 0.5]) L([-0.8, y, 0.8, y]); L([-0.8, -0.6, 0.8, 0.6]); break;
        case 'reactor': ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, TAU); ctx.stroke(); poly(ctx, [0.1, -0.5, -0.25, 0.08, 0, 0.08, -0.1, 0.5, 0.25, -0.08, 0, -0.08]); ctx.fill(); break;
        case 'servos': ctx.beginPath(); ctx.arc(0, 0, 0.35, 0, TAU); ctx.stroke(); L([0, -0.85, 0, -0.5]); L([0, 0.5, 0, 0.85]); L([-0.85, 0, -0.5, 0]); L([0.5, 0, 0.85, 0]); break;
        case 'chassis': rrect(ctx, -0.7, -0.6, 1.4, 1.2, 0.15); ctx.stroke(); for (const x of [-0.35, 0, 0.35]) { ctx.fillRect(x - 0.1, -0.1, 0.2, 0.2); } break;
        case 'armor': poly(ctx, [-0.7, -0.5, 0, -0.85, 0.7, -0.5, 0.6, 0.4, 0, 0.85, -0.6, 0.4]); ctx.stroke(); L([-0.7, -0.1, 0.7, -0.1]); break;
        case 'atk': L([-0.6, 0.6, 0.6, -0.6]); L([0.1, -0.6, 0.6, -0.6, 0.6, -0.1]); break;
        case 'heavy': L([-0.7, 0.4, 0.5, -0.6]); L([-0.4, 0.7, 0.7, -0.3]); L([0.2, -0.6, 0.7, -0.6, 0.7, -0.1]); break;
        case 'charge': ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, TAU * 0.75); ctx.stroke(); L([0.7, -0.3, 0.7, 0, 0.4, 0]); break;
        case 'aim': ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, TAU); ctx.stroke(); L([0, -0.9, 0, -0.3]); L([0, 0.3, 0, 0.9]); L([-0.9, 0, -0.3, 0]); L([0.3, 0, 0.9, 0]); break;
        case 'eshield': poly(ctx, [0, -0.85, 0.65, -0.55, 0.55, 0.3, 0, 0.85, -0.55, 0.3, -0.65, -0.55]); ctx.stroke(); break;
        case 'eheal': ctx.fillRect(-0.18, -0.7, 0.36, 1.4); ctx.fillRect(-0.7, -0.18, 1.4, 0.36); break;
        case 'jam': rrect(ctx, -0.5, -0.1, 1, 0.8, 0.1); ctx.fill(); ctx.beginPath(); ctx.arc(0, -0.1, 0.35, Math.PI, 0); ctx.stroke(); break;
        case 'drain': poly(ctx, [0.1, -0.7, -0.35, 0.08, 0, 0.08, -0.1, 0.7, 0.35, -0.08, 0, -0.08]); ctx.stroke(); L([-0.8, 0.8, 0.8, -0.8]); break;
        case 'summon': for (const x of [-0.45, 0.45]) { ctx.beginPath(); ctx.arc(x, 0.1, 0.3, 0, TAU); ctx.stroke(); } L([0, -0.8, 0, -0.3]); L([-0.25, -0.55, 0.25, -0.55]); break;
        case 'none': break;
        case 'refinery': rrect(ctx, -0.7, -0.2, 1.4, 0.9, 0.1); ctx.stroke(); L([-0.4, -0.2, -0.4, -0.8]); L([0.3, -0.2, 0.3, -0.6]); break;
        case 'drones': ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); ctx.stroke(); for (const [x, y] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) { ctx.beginPath(); ctx.arc(x, y, 0.2, 0, TAU); ctx.stroke(); L([x * 0.5, y * 0.5, x * 0.7, y * 0.7]); } break;
        case 'archive': for (const y of [-0.55, 0, 0.55]) { rrect(ctx, -0.7, y - 0.2, 1.4, 0.4, 0.08); ctx.stroke(); } break;
        case 'forge': ctx.beginPath(); ctx.arc(0, 0.1, 0.55, 0, Math.PI); ctx.stroke(); L([-0.7, 0.1, 0.7, 0.1]); ctx.beginPath(); ctx.arc(0, -0.35, 0.22, 0, TAU); ctx.fill(); break;
        case 'cascade': for (const [x, y] of [[-0.45, -0.55], [0.1, -0.1], [0.55, 0.45]]) { rrect(ctx, x - 0.2, y - 0.2, 0.4, 0.4, 0.06); ctx.stroke(); } break;
        case 'expand': rrect(ctx, -0.25, -0.8, 0.5, 1.6, 0.1); ctx.stroke(); L([0, -0.35, 0, 0.35]); L([-0.15, -0.2, 0, -0.35, 0.15, -0.2]); L([-0.15, 0.2, 0, 0.35, 0.15, 0.2]); break;
        case 'sticky': ctx.beginPath(); ctx.arc(0, -0.1, 0.5, 0, TAU); ctx.stroke(); L([0, 0.4, 0, 0.85]); break;
        case 'mirror': L([0, -0.85, 0, 0.85]); L([-0.8, 0, -0.25, -0.4, -0.25, 0.4, -0.8, 0]); L([0.8, 0, 0.25, -0.4, 0.25, 0.4, 0.8, 0]); break;
        case 'cluster': for (const [x, y] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { rrect(ctx, x - 0.25, y - 0.25, 0.5, 0.5, 0.06); ctx.stroke(); } break;
        case 'seven': smallText(ctx, '7', 0, 0.08, 140, 'bold', 'system-ui'); break;
        case 'echo': for (const r of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(-0.4, 0, r, -0.9, 0.9); ctx.stroke(); } break;
        case 'crit': ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 0.15, 0, TAU); ctx.fill(); L([0, -0.95, 0, -0.65]); L([0.95, 0, 0.65, 0]); break;
        case 'quest': rrect(ctx, -0.6, -0.8, 1.2, 1.6, 0.12); ctx.stroke(); L([-0.3, -0.35, 0.3, -0.35]); L([-0.3, 0, 0.3, 0]); L([-0.3, 0.35, 0.1, 0.35]); break;
        case 'pilot': ctx.beginPath(); ctx.arc(0, -0.3, 0.35, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0.9, 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); break;
        case 'deploy': poly(ctx, [-0.6, 0.6, 0, -0.8, 0.6, 0.6, 0, 0.25]); ctx.stroke(); break;
        case 'ladder': L([-0.45, -0.85, -0.45, 0.85]); L([0.45, -0.85, 0.45, 0.85]); for (const y of [-0.5, 0, 0.5]) L([-0.45, y, 0.45, y]); break;
        case 'mech': rrect(ctx, -0.4, -0.75, 0.8, 0.7, 0.1); ctx.stroke(); L([-0.25, -0.05, -0.35, 0.8]); L([0.25, -0.05, 0.35, 0.8]); L([-0.4, -0.5, -0.8, -0.1]); L([0.4, -0.5, 0.85, -0.5]); break;
        default: ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
}

// ------------------------------------------------------------------ the player's frame

/**
 * Draw the cadet's frame standing at (x, y) (feet), height h px, facing right.
 * a: { mech, t, recoil (0..1), slash (0..1), flash (0..1), charge (0..1), cols }
 */
export function drawPlayerMech(ctx, x, y, h, a) {
    const m = a.mech;
    const t = a.t;
    const s = h;
    const bob = Math.sin(t * 2.2) * 0.008;
    const W = '#dfe7f5', W2 = '#aab6cc', D = '#2a3550', D2 = '#1a2238', OR = '#ff8a3d', CY = '#45f3ff';
    const fl = a.flash ?? 0;
    const C = (c) => (fl > 0.01 ? mix(c, '#ffffff', fl) : c);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0.02, 0, 0.32, 0.045, 0, 0, TAU); ctx.fill();
    // thruster glow under
    const thr = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.fillStyle = hexA(CY, 0.12 + 0.06 * thr);
    ctx.beginPath(); ctx.ellipse(-0.18, -0.52, 0.12, 0.2, 0, 0, TAU); ctx.fill();

    ctx.translate(0, bob);
    // back leg
    leg(ctx, -0.08, C(D), C(W2), t, 1);
    // arc coil on the back
    if (m.arc > 0) {
        ctx.fillStyle = C(D);
        ctx.fillRect(-0.3, -0.98, 0.08, 0.3);
        for (let i = 0; i < 3; i++) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 8 + i);
            ctx.strokeStyle = hexA('#b98cff', 0.5 + 0.5 * pulse);
            ctx.lineWidth = 0.025;
            ctx.beginPath(); ctx.ellipse(-0.26, -1.0 + i * 0.07, 0.07, 0.022, 0, 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = '#e8dcff';
        ctx.beginPath(); ctx.arc(-0.26, -1.08, 0.025 + 0.01 * Math.sin(t * 13), 0, TAU); ctx.fill();
    }
    // reactor pack
    const rl = m.reactor;
    ctx.fillStyle = C(D2);
    rrect(ctx, -0.34, -0.78, 0.16, 0.3, 0.03); ctx.fill();
    ctx.fillStyle = hexA('#ffe14d', 0.4 + 0.08 * rl + 0.2 * thr);
    for (let i = 0; i < Math.min(6, rl); i++) ctx.fillRect(-0.315, -0.75 + i * 0.045, 0.1, 0.025);
    // back arm with blade
    ctx.save();
    ctx.translate(-0.12, -0.72);
    ctx.rotate(-0.5 + (a.slash ?? 0) * 2.2 + Math.sin(t * 2) * 0.03);
    ctx.fillStyle = C(W2); rrect(ctx, -0.04, 0, 0.09, 0.26, 0.03); ctx.fill();
    ctx.fillStyle = C(D); ctx.fillRect(-0.035, 0.24, 0.08, 0.06);
    // the blade
    const bl = ctx.createLinearGradient(-0.02, 0, 0.04, 0);
    bl.addColorStop(0, '#45f3ff'); bl.addColorStop(0.5, '#ffffff'); bl.addColorStop(1, '#45f3ff');
    ctx.fillStyle = bl;
    ctx.globalAlpha = 0.85 + 0.15 * thr;
    poly(ctx, [-0.015, 0.3, 0.045, 0.3, 0.035, 0.74, 0.012, 0.8]); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    // torso
    ctx.fillStyle = C(D);
    poly(ctx, [-0.2, -0.46, 0.17, -0.46, 0.2, -0.56, -0.22, -0.56]); ctx.fill();
    const tg = ctx.createLinearGradient(0, -0.92, 0, -0.5);
    tg.addColorStop(0, C(W)); tg.addColorStop(1, C(W2));
    ctx.fillStyle = tg;
    poly(ctx, [-0.24, -0.9, 0.16, -0.92, 0.26, -0.78, 0.22, -0.56, -0.22, -0.54, -0.27, -0.72]); ctx.fill();
    ctx.strokeStyle = C(D); ctx.lineWidth = 0.012; ctx.stroke();
    // accent stripe by armor tier
    const tier = Math.min(3, Math.floor(m.armor / 10));
    ctx.fillStyle = C(['#ff8a3d', '#45f3ff', '#c46bff', '#ffd84d'][tier]);
    poly(ctx, [-0.24, -0.62, 0.22, -0.64, 0.22, -0.6, -0.23, -0.58]); ctx.fill();
    // chest slot window: one tiny reel per installed reel
    const cols = a.cols ?? m.reels + 2;
    const ww = 0.05 * cols + 0.03;
    ctx.fillStyle = '#05070f';
    rrect(ctx, -0.02 - ww / 2 + 0.02, -0.82, ww, 0.12, 0.02); ctx.fill();
    const syms = ['#45f3ff', '#ffa53a', '#ff4d6d', '#b98cff', '#46ff9a'];
    for (let i = 0; i < cols; i++) {
        const k = Math.floor(t * 6 * (a.spinning ? 4 : 0.4) + i * 1.7) % syms.length;
        ctx.fillStyle = syms[(k + syms.length) % syms.length];
        ctx.fillRect(-0.02 - ww / 2 + 0.035 + i * 0.05, -0.8, 0.035, 0.08);
    }
    // cockpit canopy
    ctx.fillStyle = hexA(OR, 0.85);
    poly(ctx, [0.05, -0.9, 0.17, -0.91, 0.24, -0.8, 0.12, -0.79]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    poly(ctx, [0.07, -0.89, 0.13, -0.895, 0.16, -0.86, 0.1, -0.855]); ctx.fill();
    // head
    ctx.fillStyle = C(W);
    rrect(ctx, -0.08, -1.03, 0.16, 0.12, 0.03); ctx.fill();
    ctx.fillStyle = CY;
    ctx.shadowColor = CY; ctx.shadowBlur = 10;
    ctx.fillRect(0.0, -0.99, 0.1, 0.03);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C(D);
    ctx.fillRect(-0.06, -1.07, 0.015, 0.05);
    // missile pod on the shoulder
    if (m.missile > 0) {
        ctx.fillStyle = C(D);
        rrect(ctx, -0.18, -1.06, 0.22, 0.14, 0.02); ctx.fill();
        ctx.fillStyle = C('#ff4d6d');
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(-0.14 + i * 0.07, -1.03 + j * 0.06, 0.018, 0, TAU); ctx.fill(); }
    }
    // front leg
    leg(ctx, 0.07, C(W2), C(W), t, 0);
    // shoulder pauldron, bigger with armor
    const pa = 0.11 + 0.008 * Math.min(6, Math.floor(m.armor / 5));
    ctx.fillStyle = C(W);
    ctx.beginPath(); ctx.ellipse(0.14, -0.84, pa, pa * 0.7, -0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = C(D); ctx.lineWidth = 0.012; ctx.stroke();
    if (m.armor >= 20) { ctx.fillStyle = C(OR); poly(ctx, [0.14, -0.84 - pa * 0.7, 0.18, -0.84 - pa * 1.1, 0.2, -0.84 - pa * 0.6]); ctx.fill(); }
    // front arm: cannon
    const rc = (a.recoil ?? 0) * 0.06;
    ctx.save();
    ctx.translate(0.15 - rc, -0.8);
    ctx.rotate(-0.06 + (a.aim ?? 0));
    ctx.fillStyle = C(W2); rrect(ctx, -0.04, -0.04, 0.16, 0.1, 0.03); ctx.fill();
    ctx.fillStyle = C(D); rrect(ctx, 0.1, -0.06, 0.24, 0.13, 0.03); ctx.fill();
    ctx.fillStyle = C('#3a4766'); ctx.fillRect(0.33, -0.035, 0.1, 0.07);
    ctx.fillStyle = C('#ffa53a'); ctx.fillRect(0.14, -0.06, 0.04, 0.13);
    if ((a.recoil ?? 0) > 0.5) {
        ctx.fillStyle = hexA('#ffe7b0', a.recoil);
        ctx.beginPath(); ctx.arc(0.47, 0, 0.06 * a.recoil + 0.02, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // charge glow (Overdrive)
    if ((a.charge ?? 0) > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -0.7, 0.05, 0, -0.7, 0.7);
        g.addColorStop(0, hexA('#ff4dff', 0.45 * a.charge)); g.addColorStop(1, 'rgba(255,77,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, -0.7, 0.7, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
}

function leg(ctx, ox, c1, c2, t, phase) {
    const sway = Math.sin(t * 2.2 + phase * 3) * 0.01;
    ctx.fillStyle = c1;
    poly(ctx, [ox - 0.06, -0.5, ox + 0.06, -0.5, ox + 0.08 + sway, -0.28, ox - 0.03 + sway, -0.26]); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.arc(ox + 0.025 + sway, -0.27, 0.045, 0, TAU); ctx.fill();
    ctx.fillStyle = c1;
    poly(ctx, [ox - 0.02 + sway, -0.27, ox + 0.08 + sway, -0.27, ox + 0.06, -0.04, ox - 0.04, -0.04]); ctx.fill();
    ctx.fillStyle = c2;
    poly(ctx, [ox - 0.09, -0.05, ox + 0.12, -0.05, ox + 0.15, 0, ox - 0.1, 0]); ctx.fill();
}

// ------------------------------------------------------------------ the Determinant's units

function enemyPalette(e, chapter, flash) {
    let base = '#1d2030', mid = '#3a4058', edge = '#7b84a8', eye = '#ff2a44';
    if (e.elite) edge = '#ffc843';
    if (e.boss) {
        const B = [['#10303a', '#2a6878', '#7ff0ff', '#ff2a44'], ['#2a1a14', '#5a3a2a', '#ffa53a', '#ff2a44'], ['#2a1f10', '#6b4a1e', '#e8a840', '#ff5a2a'], ['#0a2430', '#1d5468', '#7fe0ff', '#4dfff0'],
            ['#2a0f14', '#6b2a2a', '#ff8a5c', '#ff1a3a'], ['#200a2a', '#4a1f5a', '#e0a0ff', '#ff2a8a'], ['#1a0408', '#4a0a14', '#ff5a6a', '#ffffff']][Math.min(6, chapter)];
        [base, mid, edge, eye] = B;
    }
    if (chapter === 0 && !e.boss) { base = 'rgba(30,120,150,0.55)'; mid = 'rgba(60,200,230,0.55)'; edge = '#7ff6ff'; eye = '#ffffff'; }
    if (flash > 0.01) { const f = (c) => (c.startsWith('#') ? mix(c, '#ffffff', flash) : `rgba(255,255,255,${0.5 + 0.5 * flash})`); base = f(base); mid = f(mid); edge = f(edge); }
    return { base, mid, edge, eye };
}

/**
 * Draw enemy e at (x, y) (feet / hover anchor), size h. a: { t, flash, lunge, chapter }.
 */
export function drawEnemy(ctx, e, x, y, h, a) {
    const P = enemyPalette(e, a.chapter, a.flash ?? 0);
    const t = a.t + (e.seed % 100) * 0.13;
    const lunge = (a.lunge ?? 0) * -0.12;
    ctx.save();
    ctx.translate(x + lunge * h, y);
    ctx.scale(h, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.32, 0.04, 0, 0, TAU); ctx.fill();
    const glowEye = (ex, ey, r) => {
        ctx.save();
        ctx.shadowColor = P.eye; ctx.shadowBlur = 14;
        ctx.fillStyle = P.eye;
        ctx.beginPath(); ctx.arc(ex, ey, r * (0.85 + 0.15 * Math.sin(t * 5)), 0, TAU); ctx.fill();
        ctx.restore();
    };
    const body = BODIES[e.body] ?? BODIES.orb;
    body(ctx, P, t, glowEye, e);
    ctx.restore();
}

const BODIES = {
    orb(ctx, P, t, eye) {
        const by = -0.55 + Math.sin(t * 2.4) * 0.04;
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.34, by - 0.05, -0.5, by - 0.25, -0.26, by - 0.15]); ctx.fill();
        poly(ctx, [-0.34, by + 0.05, -0.5, by + 0.25, -0.26, by + 0.15]); ctx.fill();
        const g = ctx.createRadialGradient(-0.08, by - 0.1, 0.05, 0, by, 0.32);
        g.addColorStop(0, P.mid); g.addColorStop(1, P.base);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, by, 0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, by, 0.2, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
        eye(-0.14, by, 0.07);
    },
    mite(ctx, P, t, eye) {
        const by = -0.2;
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.025;
        for (let i = 0; i < 3; i++) {
            const k = Math.sin(t * 10 + i * 2) * 0.04;
            ctx.beginPath(); ctx.moveTo(-0.1 + i * 0.1, by); ctx.lineTo(-0.2 + i * 0.12 + k, 0); ctx.stroke();
        }
        ctx.fillStyle = P.base;
        ctx.beginPath(); ctx.ellipse(0, by, 0.2, 0.12, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.stroke();
        eye(-0.14, by - 0.02, 0.05);
    },
    walker(ctx, P, t, eye) {
        const k = Math.sin(t * 2) * 0.02;
        // digitigrade legs
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.14, -0.5, -0.04, -0.5, -0.1, -0.26, 0.0, 0, -0.12, 0, -0.18, -0.27]); ctx.fill();
        poly(ctx, [0.04, -0.5, 0.14, -0.5, 0.1, -0.26, 0.18, 0, 0.06, 0, 0.0, -0.27]); ctx.fill();
        ctx.fillStyle = P.edge;
        for (const jx of [-0.14, 0.05]) { ctx.beginPath(); ctx.arc(jx, -0.27, 0.03, 0, TAU); ctx.fill(); }
        // hull
        const g = ctx.createLinearGradient(0, -0.95, 0, -0.48);
        g.addColorStop(0, P.mid); g.addColorStop(1, P.base);
        ctx.fillStyle = g;
        poly(ctx, [-0.24, -0.9 + k, -0.1, -0.98 + k, 0.2, -0.94 + k, 0.26, -0.62, 0.16, -0.48, -0.18, -0.48, -0.26, -0.6]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        // panel seams and a glowing vent
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.012;
        poly(ctx, [-0.2, -0.7 + k, 0.22, -0.72 + k], false); ctx.stroke();
        poly(ctx, [0.02, -0.95 + k, 0.04, -0.72 + k], false); ctx.stroke();
        ctx.fillStyle = P.eye;
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4);
        for (let i = 0; i < 3; i++) ctx.fillRect(0.06 + i * 0.045, -0.64 + k, 0.025, 0.08);
        ctx.globalAlpha = 1;
        // shoulder plate
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.3, -0.92 + k, -0.12, -0.96 + k, -0.1, -0.8 + k, -0.3, -0.76 + k]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.015; ctx.stroke();
        // lance arm with an energy tip
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.2, -0.8 + k, -0.66, -0.74 + k, -0.66, -0.69 + k, -0.2, -0.72 + k]); ctx.fill();
        ctx.save();
        ctx.shadowColor = P.eye; ctx.shadowBlur = 10;
        ctx.fillStyle = P.edge;
        poly(ctx, [-0.66, -0.76 + k, -0.86, -0.715 + k, -0.66, -0.67 + k]); ctx.fill();
        ctx.restore();
        eye(-0.14, -0.86 + k, 0.05);
    },
    wasp(ctx, P, t, eye) {
        const by = -0.65 + Math.sin(t * 3) * 0.05;
        ctx.fillStyle = 'rgba(180,200,255,0.25)';
        const f = Math.sin(t * 40) * 0.08;
        ctx.beginPath(); ctx.ellipse(0.05, by - 0.18, 0.28, Math.abs(0.08 + f) + 0.005, -0.3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0.12, by - 0.12, 0.24, Math.abs(0.06 - f) + 0.005, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = P.base;
        ctx.beginPath(); ctx.ellipse(0.05, by, 0.3, 0.1, 0.1, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.1, by - 0.08); ctx.lineTo(-0.2, by - 0.34); ctx.stroke();
        ctx.fillStyle = P.eye; ctx.beginPath(); ctx.arc(-0.2, by - 0.36, 0.025, 0, TAU); ctx.fill();
        eye(-0.2, by, 0.05);
    },
    crawler(ctx, P, t, eye) {
        ctx.strokeStyle = P.mid; ctx.lineWidth = 0.035;
        for (let i = 0; i < 4; i++) {
            const k = Math.sin(t * 6 + i) * 0.03;
            const x = -0.3 + i * 0.2;
            ctx.beginPath(); ctx.moveTo(x, -0.25); ctx.lineTo(x - 0.06, -0.38 + k); ctx.lineTo(x - 0.1, 0); ctx.stroke();
        }
        ctx.fillStyle = P.base;
        poly(ctx, [-0.42, -0.24, -0.3, -0.42, 0.34, -0.42, 0.42, -0.24, 0.3, -0.16, -0.3, -0.16]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = '#b05cff';
        for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i); ctx.fillRect(-0.15 + i * 0.12, -0.38, 0.06, 0.06); }
        ctx.globalAlpha = 1;
        eye(-0.36, -0.3, 0.045);
    },
    tank(ctx, P, t, eye) {
        ctx.fillStyle = P.mid;
        rrect(ctx, -0.42, -0.2, 0.84, 0.2, 0.08); ctx.fill();
        ctx.fillStyle = P.edge;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-0.33 + i * 0.13, -0.1, 0.04, 0, TAU); ctx.fill(); }
        ctx.fillStyle = P.base;
        poly(ctx, [-0.36, -0.2, -0.3, -0.55, 0.3, -0.55, 0.36, -0.2]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        // tower shield
        ctx.fillStyle = 'rgba(120,150,255,0.25)';
        ctx.strokeStyle = 'rgba(160,190,255,0.8)';
        rrect(ctx, -0.6, -0.78, 0.14, 0.7, 0.04); ctx.fill(); ctx.stroke();
        eye(-0.2, -0.42, 0.05);
    },
    spider(ctx, P, t, eye) {
        const by = -0.4;
        ctx.strokeStyle = P.mid; ctx.lineWidth = 0.03;
        for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
            const k = Math.sin(t * 5 + i * 2 + s) * 0.04;
            ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(s * (0.22 + i * 0.12), by - 0.18 + k); ctx.lineTo(s * (0.32 + i * 0.12), 0); ctx.stroke();
        }
        ctx.fillStyle = P.base;
        ctx.beginPath(); ctx.ellipse(0, by, 0.2, 0.14, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = '#ffe14d';
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 6);
        ctx.beginPath(); ctx.arc(0.05, by - 0.02, 0.06, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        eye(-0.14, by, 0.045);
    },
    turret(ctx, P, t, eye) {
        ctx.strokeStyle = P.mid; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.lineTo(0, -0.3); ctx.lineTo(0.2, 0); ctx.stroke();
        ctx.fillStyle = P.base;
        ctx.beginPath(); ctx.arc(0, -0.38, 0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.save(); ctx.translate(0, -0.42); ctx.rotate(-2.2);
        ctx.fillStyle = P.mid; ctx.fillRect(0, -0.06, 0.42, 0.12);
        ctx.fillStyle = P.edge; ctx.fillRect(0.38, -0.08, 0.06, 0.16);
        ctx.restore();
        eye(-0.1, -0.36, 0.045);
    },
    halo(ctx, P, t, eye) {
        const by = -0.6 + Math.sin(t * 1.8) * 0.04;
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.ellipse(0, by - 0.25, 0.22, 0.06, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = P.base;
        poly(ctx, [0, by - 0.18, 0.16, by, 0, by + 0.25, -0.16, by]); ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#46ff9a';
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3);
        ctx.beginPath(); ctx.arc(0, by + 0.02, 0.05, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        eye(-0.06, by - 0.05, 0.035);
    },
    sniper(ctx, P, t, eye) {
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.06, -0.6, -0.02, -0.6, 0.05, 0, 0.0, 0]); ctx.fill();
        poly(ctx, [0.03, -0.6, 0.07, -0.6, 0.14, 0, 0.09, 0]); ctx.fill();
        ctx.fillStyle = P.base;
        poly(ctx, [-0.1, -0.95, 0.1, -0.95, 0.12, -0.6, -0.12, -0.6]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = P.mid; ctx.fillRect(-0.85, -0.86, 0.8, 0.04);
        ctx.fillStyle = P.eye; ctx.globalAlpha = 0.6; ctx.fillRect(-1.6, -0.845, 0.75, 0.008); ctx.globalAlpha = 1;
        eye(-0.06, -0.88, 0.04);
    },
    titan(ctx, P, t, eye) {
        const k = Math.sin(t * 1.5) * 0.015;
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.22, -0.55, -0.08, -0.55, -0.04, 0, -0.26, 0]); ctx.fill();
        poly(ctx, [0.08, -0.55, 0.22, -0.55, 0.26, 0, 0.04, 0]); ctx.fill();
        ctx.fillStyle = P.base;
        poly(ctx, [-0.34, -1.05 + k, 0.3, -1.05 + k, 0.38, -0.78, 0.28, -0.52, -0.3, -0.52, -0.4, -0.78]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = P.mid;
        ctx.beginPath(); ctx.ellipse(-0.36, -0.95 + k, 0.14, 0.1, 0, 0, TAU); ctx.fill();
        poly(ctx, [-0.4, -0.88 + k, -0.95, -0.8 + k, -0.95, -0.74 + k, -0.4, -0.78 + k]); ctx.fill();
        ctx.fillStyle = P.edge;
        poly(ctx, [-0.95, -0.82 + k, -1.15, -0.77 + k, -0.95, -0.72 + k]); ctx.fill();
        ctx.fillStyle = P.base;
        rrect(ctx, -0.12, -1.2 + k, 0.24, 0.16, 0.04); ctx.fill(); ctx.stroke();
        eye(-0.05, -1.12 + k, 0.05);
    },
    matriarch(ctx, P, t, eye) {
        ctx.strokeStyle = P.mid; ctx.lineWidth = 0.05;
        for (let i = 0; i < 5; i++) {
            const k = Math.sin(t * 3 + i) * 0.04;
            const x = -0.5 + i * 0.25;
            ctx.beginPath(); ctx.moveTo(x, -0.35); ctx.lineTo(x - 0.1, -0.55 + k); ctx.lineTo(x - 0.16, 0); ctx.stroke();
        }
        ctx.fillStyle = P.base;
        poly(ctx, [-0.62, -0.35, -0.45, -0.75, 0.45, -0.75, 0.62, -0.35, 0.4, -0.25, -0.4, -0.25]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.025; ctx.stroke();
        // crane arms
        for (const s of [0, 1]) {
            const k = Math.sin(t * 2 + s * 2) * 0.1;
            ctx.strokeStyle = P.edge; ctx.lineWidth = 0.04;
            ctx.beginPath(); ctx.moveTo(-0.2 + s * 0.3, -0.75); ctx.lineTo(-0.5 + s * 0.2, -1.15 + k); ctx.lineTo(-0.8 + s * 0.2, -0.85 + k); ctx.stroke();
            ctx.fillStyle = P.mid; ctx.beginPath(); ctx.arc(-0.8 + s * 0.2, -0.82 + k, 0.06, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffb04d';
        for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 5 + i); ctx.fillRect(-0.3 + i * 0.17, -0.62, 0.09, 0.12); }
        ctx.globalAlpha = 1;
        eye(-0.52, -0.5, 0.06);
    },
    serpent(ctx, P, t, eye) {
        for (let i = 7; i >= 0; i--) {
            const x = -0.55 + i * 0.16;
            const y = -0.55 + Math.sin(t * 2 + i * 0.8) * 0.18 + i * 0.03;
            const r = 0.2 - i * 0.012;
            ctx.fillStyle = i % 2 ? P.base : P.mid;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            ctx.strokeStyle = P.edge; ctx.lineWidth = 0.018; ctx.stroke();
            if (i === 0) {
                ctx.fillStyle = P.edge;
                poly(ctx, [x - 0.1, y - 0.15, x - 0.02, y - 0.38, x + 0.08, y - 0.16]); ctx.fill();
                eye(x - 0.08, y - 0.02, 0.05);
            }
        }
        ctx.fillStyle = 'rgba(120,230,255,0.25)';
        ctx.fillRect(-0.9, -0.08, 1.8, 0.08);
    },
    valkyrie(ctx, P, t, eye) {
        const k = Math.sin(t * 2) * 0.02;
        // wings
        ctx.fillStyle = 'rgba(255,90,60,0.35)';
        for (const s of [0, 1]) {
            poly(ctx, [0.1, -0.9 + k, 0.7 + s * 0.15, -1.25 + s * 0.15 + k, 0.55 + s * 0.15, -0.95 + s * 0.15 + k, 0.65, -0.7 + k]); ctx.fill();
        }
        ctx.fillStyle = P.mid;
        poly(ctx, [-0.12, -0.5, -0.03, -0.5, -0.06, 0, -0.16, 0]); ctx.fill();
        poly(ctx, [0.05, -0.5, 0.14, -0.5, 0.16, 0, 0.06, 0]); ctx.fill();
        ctx.fillStyle = P.base;
        poly(ctx, [-0.22, -0.95 + k, 0.2, -0.95 + k, 0.24, -0.6, 0.14, -0.48, -0.16, -0.48, -0.26, -0.62]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02; ctx.stroke();
        // the old academy stripe, cracked
        ctx.fillStyle = '#ff8a3d';
        poly(ctx, [-0.24, -0.66 + k, 0.22, -0.68 + k, 0.22, -0.64 + k, -0.24, -0.62 + k]); ctx.fill();
        ctx.strokeStyle = '#ff1a3a'; ctx.lineWidth = 0.012;
        poly(ctx, [-0.1, -0.9 + k, -0.04, -0.78 + k, -0.12, -0.7 + k, -0.05, -0.56 + k], false); ctx.stroke();
        // gun arm
        ctx.fillStyle = P.mid; ctx.fillRect(-0.62, -0.84 + k, 0.44, 0.08);
        ctx.fillStyle = P.base;
        rrect(ctx, -0.09, -1.1 + k, 0.18, 0.14, 0.04); ctx.fill();
        eye(-0.04, -1.03 + k, 0.045);
    },
    arbiter(ctx, P, t, eye) {
        const by = -0.75 + Math.sin(t * 1.2) * 0.04;
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.02;
        for (let i = 0; i < 3; i++) {
            ctx.save(); ctx.translate(0, by); ctx.rotate(t * (0.4 + i * 0.25) * (i % 2 ? -1 : 1));
            ctx.beginPath(); ctx.ellipse(0, 0, 0.5 + i * 0.1, 0.16 + i * 0.03, 0, 0, TAU); ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle = P.base;
        poly(ctx, [0, by - 0.55, 0.2, by - 0.1, 0.14, by + 0.4, 0, by + 0.6, -0.14, by + 0.4, -0.2, by - 0.1]); ctx.fill();
        ctx.strokeStyle = P.edge; ctx.stroke();
        ctx.fillStyle = P.mid;
        poly(ctx, [0, by - 0.4, 0.08, by - 0.1, 0, by + 0.3, -0.08, by - 0.1]); ctx.fill();
        eye(0, by - 0.1, 0.07);
    },
    determinant(ctx, P, t, eye) {
        const by = -0.85;
        // pylons
        ctx.fillStyle = P.mid;
        for (const s of [-1, 1]) poly(ctx, [s * 0.55, 0, s * 0.68, -1.4, s * 0.74, -1.4, s * 0.7, 0]), ctx.fill();
        ctx.strokeStyle = P.edge; ctx.lineWidth = 0.015;
        for (let i = 0; i < 4; i++) {
            ctx.save(); ctx.translate(0, by); ctx.rotate(t * 0.3 * (i + 1) * (i % 2 ? 1 : -1));
            ctx.setLineDash([0.08, 0.05]);
            ctx.beginPath(); ctx.arc(0, 0, 0.35 + i * 0.12, 0, TAU); ctx.stroke();
            ctx.restore();
        }
        ctx.setLineDash([]);
        const g = ctx.createRadialGradient(0, by, 0.02, 0, by, 0.32);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ff5a6a'); g.addColorStop(1, P.base);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, by, 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.ellipse(0, by, 0.04, 0.16, 0, 0, TAU); ctx.fill();
        eye(0, by, 0.025);
    },
};

/** Approximate visual height multiplier of a body (so bars sit above heads). */
export function bodyTop(body) {
    return { orb: 0.9, mite: 0.35, walker: 1.0, wasp: 0.95, crawler: 0.5, tank: 0.85, spider: 0.6, turret: 0.75, halo: 0.95, sniper: 1.0, titan: 1.25, matriarch: 1.25, serpent: 0.95, valkyrie: 1.25, arbiter: 1.45, determinant: 1.5 }[body] ?? 1;
}

// ------------------------------------------------------------------ portraits

/** A comm portrait in a w×h box. */
export function drawPortrait(ctx, who, w, h, t, talk = 0) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const bgc = { kismet: '#3a2f06', varga: '#3a1a0c', juno: '#08283a', dace: '#16300a', det: '#2a0408', null: '#2a0408', pell: '#1f0f3a' }[who] ?? '#101420';
    const g = ctx.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, bgc); g.addColorStop(1, '#05060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h * 0.58);
    const s = Math.min(w, h) / 2;
    ctx.scale(s, s);
    const mouth = talk > 0 ? Math.abs(Math.sin(t * 18)) * 0.06 : 0;
    switch (who) {
        case 'kismet': {
            ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 0.04;
            for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(t * (0.5 + i * 0.3) * (i % 2 ? -1 : 1)); ctx.beginPath(); ctx.ellipse(0, -0.15, 0.6 - i * 0.12, 0.6 - i * 0.12, 0, i, i + 4.5); ctx.stroke(); ctx.restore(); }
            ctx.fillStyle = '#ffd84d';
            ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 20;
            const blink = Math.sin(t * 0.7) > 0.97 ? 0.1 : 1;
            for (const x of [-0.18, 0.18]) { ctx.beginPath(); ctx.ellipse(x, -0.22, 0.07, 0.1 * blink, 0, 0, TAU); ctx.fill(); }
            ctx.beginPath(); ctx.ellipse(0, 0.08, 0.16, 0.03 + mouth, 0, 0, TAU); ctx.fill();
            break;
        }
        case 'det':
        case 'null': {
            if (who === 'null') bust(ctx, '#3a2a2a', '#6b2a2a', '#ff1a3a', true, t, mouth);
            else {
                ctx.strokeStyle = '#ff2a44'; ctx.lineWidth = 0.02;
                for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, -0.15, 0.2 + i * 0.12, 0, TAU); ctx.globalAlpha = 0.6 - i * 0.1; ctx.stroke(); }
                ctx.globalAlpha = 1;
                const g2 = ctx.createRadialGradient(0, -0.15, 0.01, 0, -0.15, 0.25);
                g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.4, '#ff2a44'); g2.addColorStop(1, '#300008');
                ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, -0.15, 0.25, 0, TAU); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -0.15, 0.03, 0.14, 0, 0, TAU); ctx.fill();
            }
            break;
        }
        case 'varga': bust(ctx, '#c9a08a', '#4a3a30', '#ff8a5c', false, t, mouth, { hair: '#c8ccd4', scar: true }); break;
        case 'juno': bust(ctx, '#5a3a28', '#1a3a5a', '#5cc8ff', false, t, mouth, { hair: '#1a1210', short: true, headset: true }); break;
        case 'dace': bust(ctx, '#c48a64', '#2a3a1a', '#9cff6b', false, t, mouth, { hair: '#5a3a22', beard: true, cap: true }); break;
        case 'pell': bust(ctx, '#e0b090', '#2a1a4a', '#c49cff', false, t, mouth, { hair: '#2a1a3a', bun: true }); break;
        default: bust(ctx, '#c8a080', '#203048', '#45f3ff', false, t, mouth, {});
    }
    ctx.restore();
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

function bust(ctx, skin, suit, accent, corrupted, t, mouth, o = {}) {
    // shoulders / suit
    ctx.fillStyle = suit;
    ctx.beginPath(); ctx.moveTo(-0.9, 0.5); ctx.quadraticCurveTo(-0.8, 0.05, -0.3, 0.02); ctx.lineTo(0.3, 0.02); ctx.quadraticCurveTo(0.8, 0.05, 0.9, 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(-0.5, 0.12, 0.25, 0.05);
    // neck
    ctx.fillStyle = mix(skin.startsWith('#') ? skin : '#c8a080', '#000000', 0.2);
    ctx.fillRect(-0.12, -0.05, 0.24, 0.12);
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(0, -0.32, 0.3, 0.36, 0, 0, TAU); ctx.fill();
    // hair
    if (o.hair) {
        ctx.fillStyle = o.hair;
        ctx.beginPath(); ctx.ellipse(0, -0.5, 0.32, o.short ? 0.2 : 0.24, 0, Math.PI, TAU); ctx.fill();
        if (!o.short) { ctx.fillRect(-0.32, -0.5, 0.08, 0.3); ctx.fillRect(0.24, -0.5, 0.08, 0.3); }
        if (o.bun) { ctx.beginPath(); ctx.arc(0, -0.74, 0.1, 0, TAU); ctx.fill(); }
    }
    if (o.cap) { ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.ellipse(0, -0.55, 0.33, 0.16, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-0.05, -0.56, 0.42, 0.05); }
    // eyes or visor
    if (corrupted) {
        ctx.fillStyle = '#220';
        ctx.fillRect(-0.3, -0.42, 0.6, 0.14);
        ctx.fillStyle = '#ff1a3a'; ctx.shadowColor = '#ff1a3a'; ctx.shadowBlur = 16;
        ctx.fillRect(-0.26, -0.38, 0.52, 0.06 + Math.abs(Math.sin(t * 9)) * 0.02);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ff1a3a'; ctx.lineWidth = 0.015;
        poly(ctx, [0.1, -0.6, 0.05, -0.45, 0.14, -0.3, 0.08, -0.1], false); ctx.stroke();
    } else {
        const blink = Math.sin(t * 0.9 + skin.length) > 0.97 ? 0.15 : 1;
        ctx.fillStyle = '#10141c';
        for (const x of [-0.11, 0.11]) { ctx.beginPath(); ctx.ellipse(x, -0.34, 0.045, 0.04 * blink, 0, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.025;
        for (const x of [-0.11, 0.11]) { ctx.beginPath(); ctx.moveTo(x - 0.07, -0.42); ctx.lineTo(x + 0.06, -0.41); ctx.stroke(); }
    }
    if (o.scar) { ctx.strokeStyle = '#a0505a'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.16, -0.46); ctx.lineTo(0.22, -0.22); ctx.stroke(); }
    if (o.beard) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(0, -0.12, 0.24, 0.16, 0, 0, Math.PI); ctx.fill(); }
    // mouth
    ctx.fillStyle = corrupted ? '#ff1a3a' : '#5a2a2a';
    ctx.beginPath(); ctx.ellipse(0, -0.16, 0.07, 0.012 + mouth, 0, 0, TAU); ctx.fill();
    if (o.headset) {
        ctx.strokeStyle = '#d0d8e0'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(0, -0.36, 0.33, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        ctx.fillStyle = accent; ctx.fillRect(0.28, -0.4, 0.07, 0.14);
        ctx.strokeStyle = accent; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.3, -0.26); ctx.quadraticCurveTo(0.25, -0.12, 0.08, -0.14); ctx.stroke();
    }
}

const iconCanvasCache = new Map();
/** An icon (glyph or UI line icon) as a cached canvas, for drawing inside the stage. */
export function iconCanvas(name, color, size) {
    size = Math.round(size);
    const key = `${name}|${color}|${size}`;
    let c = iconCanvasCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    if (GLYPHS[name]) drawGlyph(ctx, name, size / 2, size / 2, size * 0.8, color);
    else drawUiIcon(ctx, name, size, color);
    iconCanvasCache.set(key, c);
    return c;
}
