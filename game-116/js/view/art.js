// Procedural art, all Canvas 2D paths: card faces and backs, the suit icons, the creature feature,
// the three reels' backdrops and the map icons. 1950s poster style: flat colour, a fat dark outline,
// one highlight. Every function draws around (x, y) and saves/restores the context.

import { CARDS, RANKS, SUITS } from '../sim/data.js';

export const INK = '#1b1226';
export const CREAM = '#f6ecd2';
export const FONT_HEAD = "'Bungee', Impact, 'Arial Black', sans-serif";
export const FONT_BODY = "'Space Mono', ui-monospace, 'Courier New', monospace";

const TAU = Math.PI * 2;
export function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function blob(ctx, x, y, rx, ry, fill, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    ctx.fillStyle = fill; ctx.fill();
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function eye(ctx, x, y, r, look = 0, color = '#fff') {
    blob(ctx, x, y, r, r, color, r * 0.35);
    blob(ctx, x + look * r * 0.35, y + r * 0.1, r * 0.48, r * 0.48, INK, 0);
    blob(ctx, x + look * r * 0.35 - r * 0.15, y - r * 0.1, r * 0.15, r * 0.15, '#fff', 0);
}
function poly(ctx, pts, fill, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, lw, color = INK) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}

// ------------------------------------------------------------------ suit icons
export function suitIcon(ctx, s, x, y, size, color = SUITS[s]?.color || INK) {
    ctx.save();
    ctx.translate(x, y);
    const k = size / 20;
    ctx.scale(k, k);
    const lw = 1.6;
    switch (SUITS[s]?.k) {
        case 'ray': // a zig-zag lightning bolt
            poly(ctx, [3, -10, -6, 1, -1, 1, -4, 10, 7, -2, 1, -2, 5, -10], color, lw);
            break;
        case 'rocket':
            ctx.rotate(0.6);
            poly(ctx, [0, -10, 4, -4, 4, 5, -4, 5, -4, -4], color, lw);
            poly(ctx, [-4, 1, -8, 8, -4, 6], color, lw);
            poly(ctx, [4, 1, 8, 8, 4, 6], color, lw);
            blob(ctx, 0, -2, 1.8, 1.8, CREAM, 1);
            poly(ctx, [-2.5, 6, 0, 11, 2.5, 6], '#ffcf3a', 1);
            break;
        case 'shield':
            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.quadraticCurveTo(8, 6, 0, 10); ctx.quadraticCurveTo(-8, 6, -8, -6); ctx.closePath();
            ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
            line(ctx, 0, -6, 0, 6, 1.4, CREAM);
            break;
        case 'atom':
            ctx.lineWidth = 1.7; ctx.strokeStyle = color;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 3.6, (i * Math.PI) / 3, 0, TAU); ctx.stroke();
            }
            blob(ctx, 0, 0, 2.6, 2.6, color, 1);
            break;
        default: // a star, for wild cards
            star(ctx, 0, 0, 10, 4.5, '#ffcf3a', lw);
    }
    ctx.restore();
}
function star(ctx, x, y, R, r, fill, lw) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r : R;
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    poly(ctx, pts, fill, lw);
}

// ------------------------------------------------------------------ cards
/**
 * A card, centred at (x, y). card: { r, s } for a table card, or a stock card { k, r, s, up }.
 * o: { down, frozen, glow, dim, xray, focus, scale }
 */
export function drawCard(ctx, card, x, y, w, h, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (o.scale && o.scale !== 1) ctx.scale(o.scale, o.scale);
    const r = w * 0.12;
    const lw = Math.max(1.2, w * 0.03);
    // drop shadow
    rrect(ctx, -w / 2 + w * 0.04, -h / 2 + w * 0.06, w, h, r);
    ctx.fillStyle = 'rgba(10,4,20,0.35)';
    ctx.fill();
    if (o.glow) {
        ctx.shadowColor = o.glow;
        ctx.shadowBlur = w * 0.35;
    }
    if (o.down && !o.xray) {
        drawBack(ctx, w, h, r, lw);
    } else {
        const deck = card.k && card.k !== 'plain' && card.src !== 'tab';
        const def = deck ? CARDS[card.k] : null;
        rrect(ctx, -w / 2, -h / 2, w, h, r);
        ctx.fillStyle = def?.junk ? '#cfd8c4' : deck ? '#efe3ff' : CREAM;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = o.glow ? lw * 1.8 : lw;
        ctx.strokeStyle = o.glow || INK;
        ctx.stroke();
        if (o.down) { ctx.globalAlpha = 0.55; }
        const col = card.s >= 0 ? SUITS[card.s].color : def?.static ? '#5d6b5f' : '#7d3cc8';
        if (def?.static) {
            // static: zig-zag TV snow lines
            ctx.strokeStyle = '#4b5a4f'; ctx.lineWidth = Math.max(1, w * 0.025);
            for (let i = -3; i <= 3; i++) {
                ctx.beginPath();
                for (let j = 0; j <= 8; j++) ctx.lineTo(-w * 0.38 + (j * w * 0.76) / 8, i * h * 0.1 + (j % 2 ? -1 : 1) * h * 0.025);
                ctx.stroke();
            }
            label(ctx, '✕', 0, 0, w * 0.5, '#2c3a30');
        } else {
            const rk = card.r ? RANKS[card.r] : '★';
            ctx.fillStyle = col;
            ctx.font = `${Math.round(w * 0.3)}px ${FONT_HEAD}`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(rk, -w / 2 + w * 0.09, -h / 2 + w * 0.07);
            ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
            ctx.fillText(rk, w / 2 - w * 0.09, h / 2 - w * 0.06);
            const iconY = deck ? -h * 0.06 : h * 0.04;
            if (card.s >= 0) suitIcon(ctx, card.s, 0, iconY, w * 0.5);
            else if (def) deckGlyph(ctx, card.k, 0, iconY, w * 0.46);
            if (deck) {
                const name = def.name + (card.up ? '+' : '');
                ctx.fillStyle = INK;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                fitText(ctx, name, 0, h * 0.27, w * 0.86, Math.round(w * 0.13), FONT_BODY, 'bold ');
            }
        }
        ctx.globalAlpha = 1;
    }
    if (o.frozen) {
        rrect(ctx, -w / 2, -h / 2, w, h, r);
        ctx.fillStyle = 'rgba(150,215,255,0.55)';
        ctx.fill();
        ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = lw;
        for (let i = 0; i < 3; i++) {
            const a = (i * Math.PI) / 3;
            line(ctx, Math.cos(a) * w * 0.28, Math.sin(a) * w * 0.28, -Math.cos(a) * w * 0.28, -Math.sin(a) * w * 0.28, lw * 1.3, '#f2fbff');
        }
    }
    if (o.dim) {
        rrect(ctx, -w / 2, -h / 2, w, h, r);
        ctx.fillStyle = 'rgba(20,10,35,0.28)';
        ctx.fill();
    }
    if (o.focus) {
        rrect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 3);
        ctx.lineWidth = 3; ctx.strokeStyle = '#7ff5ff'; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
}

export function fitText(ctx, text, x, y, maxW, size, family, weight = '') {
    let s = size;
    ctx.font = `${weight}${s}px ${family}`;
    while (s > 7 && ctx.measureText(text).width > maxW) { s--; ctx.font = `${weight}${s}px ${family}`; }
    ctx.fillText(text, x, y);
}
function label(ctx, t, x, y, size, color) {
    ctx.fillStyle = color; ctx.font = `${Math.round(size)}px ${FONT_HEAD}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
}

function drawBack(ctx, w, h, r, lw) {
    rrect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fillStyle = '#1f8a8a';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save();
    rrect(ctx, -w / 2 + w * 0.08, -h / 2 + w * 0.08, w * 0.84, h - w * 0.16, r * 0.6);
    ctx.clip();
    ctx.fillStyle = '#156a6f';
    for (let i = -6; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(-w, i * h * 0.12); ctx.lineTo(w, i * h * 0.12 - w * 0.8); ctx.lineTo(w, i * h * 0.12 - w * 0.8 + h * 0.05); ctx.lineTo(-w, i * h * 0.12 + h * 0.05);
        ctx.fill();
    }
    ctx.restore();
    // a little saucer in the middle
    ctx.save();
    ctx.scale(w / 60, w / 60);
    blob(ctx, 0, -3, 9, 7, '#9fe8e0', 1.4);
    blob(ctx, 0, 2, 20, 6, '#e8b04a', 1.6);
    for (let i = -2; i <= 2; i++) blob(ctx, i * 7, 2.5, 1.6, 1.6, '#fff4b0', 0);
    ctx.restore();
}

/** The glyph in the middle of one of your special cards. */
export function deckGlyph(ctx, k, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    const u = s / 20;
    ctx.scale(u, u);
    const lw = 1.5;
    switch (k) {
        case 'death_ray': poly(ctx, [-9, 3, 2, -1, 2, -4, 10, 0, 2, 4, 2, 1, -9, 5], '#d23b2a', lw); blob(ctx, -9, 4, 3, 4, '#555', lw); break;
        case 'force_field': for (let i = 3; i >= 1; i--) blob(ctx, 0, 0, i * 3.4, i * 3.4, i % 2 ? '#7fc0ff' : '#2b6cc9', lw); break;
        case 'atomic_pile': suitIcon(ctx, 3, 0, 0, 20); break;
        case 'jet_boots': poly(ctx, [-5, -9, 2, -9, 2, 3, 8, 3, 8, 7, -5, 7], '#c0392b', lw); poly(ctx, [-4, 7, 0, 12, 4, 7], '#ffcf3a', 1); break;
        case 'ration': rrect(ctx, -7, -6, 14, 13, 2); ctx.fillStyle = '#8ab04a'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); line(ctx, -7, -2, 7, -2, 1.2); break;
        case 'reflector': blob(ctx, 0, 0, 9, 9, '#cfe4ef', lw); line(ctx, -5, -5, 5, 5, 1.6, '#fff'); break;
        case 'wild': star(ctx, 0, 0, 10, 4.5, '#ffcf3a', lw); break;
        case 'meteor': for (let i = 0; i < 3; i++) { line(ctx, -9 + i * 5, -9 + i * 2, -3 + i * 5, -1 + i * 2, 2, '#ff9b3a'); blob(ctx, -2 + i * 5, 0 + i * 2, 2.6, 2.6, '#7a5a3a', 1); } break;
        case 'booster': poly(ctx, [0, -10, 4, 0, 1, 0, 3, 10, -4, -2, -1, -2], '#ff4d6d', lw); line(ctx, 6, -6, 9, -9, 1.4); line(ctx, 6, 0, 10, 0, 1.4); break;
        case 'chain_rx': for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(i * 6, 0, 4, 6, 0.4, 0, TAU); ctx.lineWidth = 2.2; ctx.strokeStyle = '#22955a'; ctx.stroke(); } break;
        case 'radar': ctx.beginPath(); ctx.arc(0, 4, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 2.2; ctx.strokeStyle = '#555'; ctx.stroke(); line(ctx, 0, 4, 0, -4, 1.5); blob(ctx, 0, -5, 1.8, 1.8, '#d23b2a', 1); line(ctx, -4, 9, 4, 9, 2); break;
        case 'rocket_fuel': rrect(ctx, -5, -8, 10, 16, 2); ctx.fillStyle = '#e2861b'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); suitIcon(ctx, 1, 0, 0, 9, '#fff4b0'); break;
        case 'hypno': ctx.beginPath(); for (let a = 0; a < 18; a += 0.3) ctx.lineTo(Math.cos(a) * a * 0.55, Math.sin(a) * a * 0.55); ctx.lineWidth = 1.8; ctx.strokeStyle = '#7d3cc8'; ctx.stroke(); break;
        case 'shrink': poly(ctx, [-9, -2, 0, -2, 0, -5, 6, 0, 0, 5, 0, 2, -9, 2], '#2fbfa0', lw); blob(ctx, 8, 0, 2, 2, '#2fbfa0', 1); break;
        case 'flying_saucer': drawSaucer(ctx, 0, 0, 1, 0); break;
        case 'slime': blob(ctx, 0, 2, 9, 6, '#7bd34a', lw); eye(ctx, -3, 0, 2.2); eye(ctx, 3, 0, 2.2); break;
        default: suitIcon(ctx, -1, 0, 0, 20);
    }
    ctx.restore();
}

/** A flying saucer about 40 px wide at s = 1. */
export function drawSaucer(ctx, x, y, s, t, lights = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    blob(ctx, 0, -5, 9, 7.5, '#a8f0e8', 1.5);
    blob(ctx, -2.5, -7.5, 2.5, 1.8, 'rgba(255,255,255,0.8)', 0);
    blob(ctx, 0, 0, 20, 6, '#c9ccd6', 1.8);
    blob(ctx, 0, 1.6, 14, 2.4, '#8b8fa0', 0);
    if (lights) for (let i = 0; i < 6; i++) {
        const on = Math.floor(t * 6 + i) % 3 === 0;
        blob(ctx, -15 + i * 6, 0.8, 1.5, 1.5, on ? '#ffe66b' : '#b8862e', 0.6);
    }
    ctx.restore();
}

// ------------------------------------------------------------------ the creature feature
// Each drawer works in a 100-unit box (about -50..50 across, -60..40 down) around (0, 0).
const ART = {
    ant(ctx, t, def) {
        const c = '#8c2b1e', lw = 3;
        for (let i = -1; i <= 1; i++) {   // legs
            line(ctx, i * 12, 8, i * 26 - 10, 30 + Math.sin(t * 8 + i) * 3, lw);
            line(ctx, i * 12, 8, i * 26 + 10, 30 + Math.cos(t * 8 + i) * 3, lw);
        }
        blob(ctx, 30, 8, 22, 15, c, lw);
        blob(ctx, 0, 6, 12, 10, c, lw);
        blob(ctx, -26, -6, 15, 13, c, lw);
        line(ctx, -32, -16, -44, -36, 2.5); line(ctx, -24, -18, -28, -40, 2.5);
        blob(ctx, -44, -36, 3, 3, c, 2); blob(ctx, -28, -40, 3, 3, c, 2);
        eye(ctx, -32, -8, 5, -1, '#ffd23a'); eye(ctx, -20, -9, 5, -1, '#ffd23a');
        line(ctx, -38, 4, -44, 10, 3); line(ctx, -30, 5, -34, 12, 3);
    },
    robot(ctx, t, def) {
        const c = def.crown ? '#c9a640' : def.antenna ? '#7a8ea8' : '#a9b3bf', lw = 3;
        rrect(ctx, -22, -6, 44, 40, 6); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
        rrect(ctx, -12, 4, 24, 14, 3); ctx.fillStyle = '#2a2f3a'; ctx.fill(); ctx.stroke();
        for (let i = 0; i < 4; i++) blob(ctx, -8 + i * 5.3, 11, 1.8, 1.8, Math.floor(t * 5 + i) % 2 ? '#ff5a3a' : '#3aff9a', 0);
        line(ctx, -22, 4, -36, 18 + Math.sin(t * 3) * 4, 6); line(ctx, 22, 4, 36, 18 - Math.sin(t * 3) * 4, 6);
        blob(ctx, -37, 22 + Math.sin(t * 3) * 4, 6, 5, c, lw); blob(ctx, 37, 22 - Math.sin(t * 3) * 4, 6, 5, c, lw);
        rrect(ctx, -16, -40, 32, 30, 8); ctx.fillStyle = c; ctx.fill(); ctx.stroke();
        rrect(ctx, -11, -32, 22, 10, 4); ctx.fillStyle = '#251a33'; ctx.fill(); ctx.stroke();
        const sweep = Math.sin(t * 2.4) * 6;
        blob(ctx, sweep, -27, 3.5, 3, '#ff3a3a', 0);
        if (def.antenna) { line(ctx, 0, -40, 0, -54, 2.5); blob(ctx, 0, -56, 4, 4, Math.floor(t * 2) % 2 ? '#ff3a3a' : '#ffd23a', 2); }
        if (def.crown) poly(ctx, [-16, -40, -16, -54, -8, -46, 0, -58, 8, -46, 16, -54, 16, -40], '#ffd23a', 2.5);
        if (def.crest) poly(ctx, [-4, -40, 0, -52, 4, -40], '#d23b2a', 2);
        line(ctx, -10, 34, -10, 42, 7); line(ctx, 10, 34, 10, 42, 7);
    },
    blob(ctx, t, def) {
        const wob = Math.sin(t * 3) * 3;
        ctx.beginPath();
        ctx.moveTo(-38, 30);
        ctx.bezierCurveTo(-48 - wob, -10, -24, -44 - wob, 0, -40 + wob);
        ctx.bezierCurveTo(26, -44 + wob, 46 + wob, -8, 38, 30);
        ctx.closePath();
        ctx.fillStyle = '#d6365e'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        blob(ctx, -14, -20, 8, 5, 'rgba(255,255,255,0.35)', 0);
        for (let i = 0; i < 4; i++) blob(ctx, -20 + i * 13, 16 + (i % 2) * 6, 3, 3, '#a8173f', 0);
        eye(ctx, -10, -8, 7, Math.sin(t)); eye(ctx, 12, -12, 5, Math.sin(t));
        ctx.beginPath(); ctx.arc(0, 6, 9, 0.2, Math.PI - 0.2); ctx.lineWidth = 3; ctx.stroke();
    },
    saucer(ctx, t, def) {
        // a beam below, then the ship
        const g = ctx.createLinearGradient(0, 0, 0, 40);
        g.addColorStop(0, 'rgba(160,255,200,0.55)'); g.addColorStop(1, 'rgba(160,255,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(30, 40); ctx.lineTo(-30, 40); ctx.fill();
        drawSaucer(ctx, 0, -6, 2.1, t);
        eye(ctx, -5, -18, 4, Math.sin(t * 2), '#d6ffcf'); eye(ctx, 5, -18, 4, Math.sin(t * 2), '#d6ffcf');
    },
    scorpion(ctx, t, def) {
        const c = '#3a8f3a', lw = 3;
        for (let i = 0; i < 3; i++) { line(ctx, -8 + i * 10, 14, -18 + i * 10, 32, lw); line(ctx, -8 + i * 10, 14, 2 + i * 14, 32, lw); }
        blob(ctx, 0, 12, 28, 12, c, lw);
        // tail curling up over the back
        ctx.beginPath(); ctx.moveTo(24, 8); ctx.bezierCurveTo(52, 0, 46, -48, 16, -40 + Math.sin(t * 3) * 3);
        ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke();
        poly(ctx, [16, -46 + Math.sin(t * 3) * 3, 4, -38, 16, -34 + Math.sin(t * 3) * 3], '#c9f25a', 2.5);
        for (const sx of [-1, 1]) {
            line(ctx, -22, 6, -40, -8 * sx - 4, 5);
            blob(ctx, -44, -10 * sx - 6, 8, 5, c, lw);
        }
        eye(ctx, -16, 2, 3.6, -1, '#ffe14a'); eye(ctx, -8, 1, 3.6, -1, '#ffe14a');
        // a glowing atomic heart
        blob(ctx, 4, 12, 5, 5, `rgba(200,255,90,${0.5 + 0.4 * Math.sin(t * 4)})`, 0);
    },
    lizard(ctx, t, def) {
        const c = '#c8742a', lw = 3.2;
        // a tail off to the right, a huge head roaring at us
        ctx.beginPath(); ctx.moveTo(10, 24); ctx.quadraticCurveTo(50, 30, 52, 4 + Math.sin(t * 2) * 4);
        ctx.lineWidth = 15; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 10; ctx.strokeStyle = c; ctx.stroke();
        blob(ctx, 0, 14, 30, 22, c, lw);
        for (let i = 0; i < 5; i++) blob(ctx, -20 + i * 10, 10 + (i % 2) * 8, 4, 3, '#8a3f17', 0);
        line(ctx, -22, 26, -28, 40, 8); line(ctx, 18, 26, 24, 40, 8);
        const jaw = 6 + Math.max(0, Math.sin(t * 1.7)) * 8;
        poly(ctx, [-44, -20, -6, -34, 12, -18, -4, -10, -44, -10], c, lw);
        poly(ctx, [-44, -10 + jaw * 0.3, -4, -10 + jaw * 0.2, 4, -2 + jaw, -40, 0 + jaw], '#b5621f', lw);
        for (let i = 0; i < 5; i++) poly(ctx, [-40 + i * 7, -10, -37 + i * 7, -5, -34 + i * 7, -10], '#fff', 1);
        eye(ctx, -12, -24, 5.5, -1, '#ffe14a');
        for (let i = 0; i < 5; i++) poly(ctx, [-8 + i * 9, -10 - (i === 0 ? 20 : 4), -4 + i * 9, -22 - (i === 0 ? 14 : 0), 0 + i * 9, -10 - (i === 0 ? 20 : 4)], '#e8b04a', 2);
    },
    crab(ctx, t, def) {
        const c = '#d9532c', lw = 3;
        for (let i = 0; i < 3; i++) { line(ctx, -14 - i * 6, 10, -36 - i * 4, 30, lw); line(ctx, 14 + i * 6, 10, 36 + i * 4, 30, lw); }
        blob(ctx, 0, 6, 32, 18, c, lw);
        for (const sx of [-1, 1]) {
            const k = Math.sin(t * 3 + sx) * 4;
            line(ctx, sx * 26, 0, sx * 40, -20, 6);
            poly(ctx, [sx * 38, -18, sx * 52, -34 - k, sx * 46, -18, sx * 52, -6 + k], c, lw);
        }
        line(ctx, -8, -8, -10, -24, 3); line(ctx, 8, -8, 10, -24, 3);
        eye(ctx, -10, -26, 5, 0, '#e0ffd0'); eye(ctx, 10, -26, 5, 0, '#e0ffd0');
        // a moon-dust helmet bubble
        ctx.beginPath(); ctx.arc(0, -16, 24, Math.PI, 0); ctx.strokeStyle = 'rgba(200,240,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    },
    moth(ctx, t, def) {
        const f = Math.sin(t * 9) * 0.25;
        for (const sx of [-1, 1]) {
            ctx.save(); ctx.scale(sx, 1); ctx.rotate(f * sx * 0);
            ctx.save(); ctx.rotate(-f);
            poly(ctx, [0, -10, 46, -42, 54, -6, 8, 6], '#cfd6e8', 3);
            blob(ctx, 34, -20, 9, 9, '#5c6ab0', 2); blob(ctx, 34, -20, 4, 4, '#ffe66b', 0);
            poly(ctx, [4, 6, 38, 28, 22, 40, 2, 16], '#aeb7d4', 3);
            ctx.restore(); ctx.restore();
        }
        blob(ctx, 0, 4, 8, 22, '#8a7a5e', 3);
        blob(ctx, 0, -20, 9, 8, '#8a7a5e', 3);
        eye(ctx, -5, -21, 4, 0, '#ff7a3a'); eye(ctx, 5, -21, 4, 0, '#ff7a3a');
        line(ctx, -3, -28, -12, -44, 2); line(ctx, 3, -28, 12, -44, 2);
    },
    leech(ctx, t, def) {
        const c = '#6b3d8a';
        ctx.beginPath(); ctx.moveTo(-40, 28);
        for (let i = 0; i <= 10; i++) ctx.lineTo(-40 + i * 7, 28 - i * 6 + Math.sin(t * 4 + i) * 3);
        ctx.lineWidth = 26; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 20; ctx.strokeStyle = c; ctx.stroke();
        for (let i = 1; i < 10; i += 2) blob(ctx, -40 + i * 7, 28 - i * 6 + Math.sin(t * 4 + i) * 3, 3, 3, '#9d6bc2', 0);
        const hx = 30, hy = -32 + Math.sin(t * 4 + 10) * 3;
        blob(ctx, hx, hy, 15, 15, '#e9a3c8', 3);
        // a brain on top, wrinkles
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx - 6 + i * 6, hy - 4, 5, Math.PI, 0); ctx.lineWidth = 1.6; ctx.strokeStyle = '#a0507a'; ctx.stroke(); }
        blob(ctx, hx - 12, hy + 6, 6, 6, INK, 0);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; line(ctx, hx - 12 + Math.cos(a) * 3, hy + 6 + Math.sin(a) * 3, hx - 12 + Math.cos(a) * 6, hy + 6 + Math.sin(a) * 6, 1.2, '#fff'); }
    },
    ape(ctx, t, def) {
        const c = '#3a2a24', lw = 3;
        blob(ctx, 0, 10, 30, 28, c, lw);
        line(ctx, -26, 0, -40, 30 + Math.sin(t * 4) * 3, 12); line(ctx, 26, 0, 40, 30 - Math.sin(t * 4) * 3, 12);
        line(ctx, -26, 0, -40, 30 + Math.sin(t * 4) * 3, 7, c); line(ctx, 26, 0, 40, 30 - Math.sin(t * 4) * 3, 7, c);
        blob(ctx, 0, -26, 18, 16, c, lw);
        blob(ctx, 0, -22, 11, 9, '#8a6a52', 2);
        eye(ctx, -6, -28, 3.5); eye(ctx, 6, -28, 3.5);
        // the diving helmet
        ctx.beginPath(); ctx.arc(0, -26, 24, 0, TAU); ctx.fillStyle = 'rgba(190,230,255,0.25)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        blob(ctx, -10, -38, 6, 3.5, 'rgba(255,255,255,0.6)', 0);
        rrect(ctx, -26, -6, 52, 7, 3); ctx.fillStyle = '#c9a640'; ctx.fill(); ctx.stroke();
        line(ctx, 18, -44, 26, -58, 2.5); blob(ctx, 27, -60, 3, 3, '#ff5a3a', 1.5);
    },
    cyclops(ctx, t, def) {
        const c = '#6aa84f', lw = 3;
        blob(ctx, 0, 14, 26, 26, '#7a5230', lw);
        blob(ctx, 0, -20, 26, 26, c, lw);
        poly(ctx, [-6, -46, 0, -60, 6, -46], '#f2e6c8', 2.5);
        const blink = Math.sin(t * 0.9) > 0.97 ? 0.15 : 1;
        ctx.save(); ctx.translate(0, -22); ctx.scale(1, blink);
        eye(ctx, 0, 0, 13, Math.sin(t * 1.3), '#fffbe0');
        ctx.restore();
        ctx.beginPath(); ctx.arc(0, -4, 10, 0.3, Math.PI - 0.3); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        poly(ctx, [-6, -2, -3, 4, 0, -2], '#fff', 1); poly(ctx, [2, -2, 5, 4, 8, -2], '#fff', 1);
        line(ctx, -24, 4, -44, 24, 10); line(ctx, 24, 4, 44, 24, 10);
        line(ctx, 44, 24, 48, -8, 6, '#7a5230');
    },
    brain(ctx, t, def) {
        // a big brain in a jar on a pedestal, with a spinal cord dangling
        rrect(ctx, -26, 22, 52, 16, 4); ctx.fillStyle = '#4a4f5a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        for (let i = 0; i < 4; i++) blob(ctx, -15 + i * 10, 30, 2.4, 2.4, Math.floor(t * 4 + i) % 2 ? '#3aff9a' : '#ff5a3a', 0);
        ctx.beginPath(); ctx.ellipse(0, -10, 34, 34, 0, 0, TAU); ctx.fillStyle = 'rgba(130,255,200,0.18)'; ctx.fill(); ctx.stroke();
        const p = 1 + Math.sin(t * 2) * 0.04;
        ctx.save(); ctx.translate(0, -12); ctx.scale(p, p);
        blob(ctx, 0, 0, 24, 18, '#f09ab8', 3);
        ctx.strokeStyle = '#b8507a'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 9, -12); ctx.bezierCurveTo(-24 + i * 9, -4, -12 + i * 9, 0, -18 + i * 9, 10); ctx.stroke(); }
        line(ctx, 0, -16, 0, 14, 2, '#b8507a');
        ctx.restore();
        line(ctx, 0, 8, Math.sin(t * 2) * 4, 22, 4, '#f09ab8');
        eye(ctx, -9, -12, 4.5, Math.sin(t), '#fff'); eye(ctx, 9, -12, 4.5, Math.sin(t), '#fff');
        blob(ctx, -16, -34, 6, 3, 'rgba(255,255,255,0.5)', 0);
    },
    martian(ctx, t, def) {
        const c = def.gun ? '#6fae3c' : def.helmet ? '#4f9a5a' : '#7ccf4a', lw = 3;
        rrect(ctx, -16, -4, 32, 38, 8); ctx.fillStyle = def.helmet ? '#8b3a3a' : '#5a3a8b'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
        line(ctx, -16, 6, -30, 22, 6); line(ctx, 16, 6, 30, 18, 6);
        if (def.gun) {
            poly(ctx, [26, 10, 50, 4, 50, 12, 30, 20], '#c9ccd6', 2.5);
            blob(ctx, 50, 8, 4, 4, Math.sin(t * 6) > 0 ? '#ff3a3a' : '#ffd23a', 1.5);
        }
        blob(ctx, 0, -26, 20, 24, c, lw);           // the big head
        eye(ctx, -8, -24, 6, Math.sin(t * 1.5), '#111'); eye(ctx, 8, -24, 6, Math.sin(t * 1.5), '#111');
        blob(ctx, -10, -27, 2, 1.4, '#fff', 0); blob(ctx, 6, -27, 2, 1.4, '#fff', 0);
        line(ctx, -6, -10, 6, -10, 2);
        if (def.helmet) { ctx.beginPath(); ctx.arc(0, -26, 27, 0, TAU); ctx.fillStyle = 'rgba(190,230,255,0.2)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
        else { line(ctx, -8, -48, -14, -60, 2); line(ctx, 8, -48, 14, -60, 2); blob(ctx, -14, -61, 3, 3, '#ffd23a', 1.5); blob(ctx, 14, -61, 3, 3, '#ffd23a', 1.5); }
        line(ctx, -8, 34, -8, 42, 6); line(ctx, 8, 34, 8, 42, 6);
    },
    tentacle(ctx, t, def) {
        const c = '#3d7f8f';
        for (let i = 0; i < 6; i++) {
            const bx = -30 + i * 12;
            ctx.beginPath(); ctx.moveTo(bx, 20);
            for (let j = 1; j <= 6; j++) ctx.lineTo(bx + Math.sin(t * 2 + i + j * 0.8) * 8 + (i - 2.5) * j * 1.5, 20 + j * 4 - (j > 3 ? (j - 3) * 2 : 0));
            ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 5.5; ctx.strokeStyle = c; ctx.stroke();
        }
        // two big ones raised
        for (const sx of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(sx * 20, 0); ctx.bezierCurveTo(sx * 50, -10, sx * 40, -50, sx * (46 + Math.sin(t * 2) * 4), -56);
            ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = c; ctx.stroke();
        }
        blob(ctx, 0, -8, 30, 30, c, 3);
        for (let i = 0; i < 5; i++) blob(ctx, -16 + i * 8, 10, 2.5, 2.5, '#b8f0ff', 0);
        eye(ctx, 0, -14, 12, Math.sin(t * 1.2), '#ffef9a');
        eye(ctx, -18, -26, 5, Math.sin(t * 1.2), '#ffef9a'); eye(ctx, 18, -26, 5, Math.sin(t * 1.2), '#ffef9a');
    },
    queen(ctx, t, def) {
        // a Venusian queen: tall collar, beehive hair, a ray-gun sceptre
        poly(ctx, [-26, 40, -14, -2, 14, -2, 26, 40], '#b02a6a', 3);
        poly(ctx, [-30, -6, 0, 6, 30, -6, 20, -22, -20, -22], '#ffd23a', 2.5);
        blob(ctx, 0, -28, 13, 15, '#9ae0c8', 3);
        blob(ctx, 0, -54, 15, 16, '#ff7ab2', 3);
        eye(ctx, -5, -29, 3.4, Math.sin(t), '#fff'); eye(ctx, 5, -29, 3.4, Math.sin(t), '#fff');
        line(ctx, -4, -19, 4, -19, 2, '#b02a6a');
        poly(ctx, [-10, -40, -6, -48, 0, -42, 6, -48, 10, -40], '#ffd23a', 2);
        line(ctx, 22, 4, 36, -36, 3.5, '#c9ccd6');
        blob(ctx, 36, -40, 5, 5, `rgba(255,90,200,${0.6 + Math.sin(t * 3) * 0.3})`, 2);
    },
    overlord(ctx, t, def) {
        // a giant brain in a dome on a throne-robot, many eyes
        rrect(ctx, -34, 4, 68, 34, 8); ctx.fillStyle = '#5a3a8b'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        for (let i = 0; i < 6; i++) blob(ctx, -25 + i * 10, 22, 3, 3, Math.floor(t * 3 + i) % 3 ? '#ff3a6a' : '#ffd23a', 0);
        line(ctx, -34, 14, -50, 34, 8); line(ctx, 34, 14, 50, 34, 8);
        poly(ctx, [-50, 34, -58, 44, -44, 44], '#c9ccd6', 2); poly(ctx, [50, 34, 58, 44, 44, 44], '#c9ccd6', 2);
        const p = 1 + Math.sin(t * 1.6) * 0.035;
        ctx.save(); ctx.translate(0, -22); ctx.scale(p, p);
        blob(ctx, 0, 0, 34, 26, '#e687c0', 3);
        ctx.strokeStyle = '#a04a80'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 10, -18); ctx.bezierCurveTo(-34 + i * 10, -6, -18 + i * 10, 2, -26 + i * 10, 16); ctx.stroke(); }
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0, -20, 40, 36, 0, Math.PI, 0); ctx.lineTo(40, 2); ctx.lineTo(-40, 2); ctx.closePath();
        ctx.fillStyle = 'rgba(160,255,230,0.16)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        blob(ctx, -20, -44, 8, 4, 'rgba(255,255,255,0.5)', 0);
        const ey = [[-16, -16, 5], [0, -24, 7], [16, -16, 5], [-8, -4, 3.5], [8, -4, 3.5]];
        for (const [x, y, r] of ey) eye(ctx, x, y, r, Math.sin(t * 1.4 + x), '#fffbe0');
    },
};

/** Draw a creature with its feet about at (x, y + 40·s); `def` is its ENEMIES entry. */
export function drawEnemy(ctx, def, x, y, s, t, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // a ground shadow
    blob(ctx, 0, 44, 46, 7, 'rgba(10,0,20,0.35)', 0);
    if (o.lunge) ctx.translate(0, o.lunge * 10), ctx.scale(1 + o.lunge * 0.12, 1 + o.lunge * 0.12);
    if (o.shake) ctx.translate(Math.sin(t * 90) * o.shake * 4, 0);
    if (o.flash) ctx.filter = `brightness(${1 + o.flash * 1.6})`;
    (ART[def.art] || ART.blob)(ctx, t, def);
    ctx.filter = 'none';
    ctx.restore();
}
export const ART_KINDS = Object.keys(ART);

// ------------------------------------------------------------------ backdrops
/** Paint a reel's backdrop into ctx at w×h (baked once per resize). */
export function paintBackdrop(ctx, scene, w, h, seed = 1) {
    let a = seed * 9301 + 49297;
    const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (scene === 'moon') { sky.addColorStop(0, '#05040d'); sky.addColorStop(1, '#1c1838'); }
    else if (scene === 'ship') { sky.addColorStop(0, '#120a1e'); sky.addColorStop(1, '#2a1640'); }
    else { sky.addColorStop(0, '#1a0f3a'); sky.addColorStop(0.55, '#5b2a6e'); sky.addColorStop(1, '#d9774a'); }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (scene !== 'ship') {
        for (let i = 0; i < (w * h) / 2600; i++) {
            const x = rnd() * w, y = rnd() * h * (scene === 'moon' ? 0.85 : 0.6), r = rnd() * 1.4 + 0.3;
            ctx.fillStyle = `rgba(255,255,240,${0.3 + rnd() * 0.6})`;
            ctx.fillRect(x, y, r, r);
        }
    }
    const horizon = h * 0.78;
    if (scene === 'desert') {
        // a big low moon, mesas, saguaros and a drive-in screen
        blob(ctx, w * 0.78, h * 0.26, h * 0.09, h * 0.09, '#ffe9b0', 0);
        blob(ctx, w * 0.78 + h * 0.02, h * 0.25, h * 0.02, h * 0.015, 'rgba(200,170,110,0.5)', 0);
        ctx.fillStyle = '#3a1e3f';
        ctx.beginPath(); ctx.moveTo(0, horizon);
        let x = 0;
        while (x < w) { const mw = 60 + rnd() * 160, mh = 30 + rnd() * h * 0.12; ctx.lineTo(x + 18, horizon - mh); ctx.lineTo(x + mw - 18, horizon - mh); ctx.lineTo(x + mw, horizon); x += mw + rnd() * 80; ctx.lineTo(x, horizon); }
        ctx.lineTo(w, horizon); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        ctx.fillStyle = '#5a2c3a'; ctx.fillRect(0, horizon, w, h - horizon);
        ctx.fillStyle = '#25122a';
        for (let i = 0; i < Math.max(3, w / 240); i++) {
            const cx = rnd() * w, ch = 30 + rnd() * 40, cy = horizon + 10 + rnd() * (h - horizon - 20);
            ctx.fillRect(cx - 4, cy - ch, 8, ch);
            ctx.fillRect(cx - 16, cy - ch * 0.7, 6, ch * 0.35); ctx.fillRect(cx - 16, cy - ch * 0.7, 14, 5);
            ctx.fillRect(cx + 10, cy - ch * 0.85, 6, ch * 0.4); ctx.fillRect(cx + 2, cy - ch * 0.55, 14, 5);
        }
        const sx = w * 0.12;
        ctx.fillStyle = '#2a1430'; ctx.fillRect(sx - 3, horizon - 70, 4, 70); ctx.fillRect(sx + 83, horizon - 70, 4, 70);
        ctx.fillStyle = '#2a1430'; ctx.fillRect(sx - 14, horizon - 124, 112, 64);
        ctx.fillStyle = 'rgba(200,220,255,0.16)'; ctx.fillRect(sx - 10, horizon - 120, 104, 56);
    } else if (scene === 'moon') {
        // Earth in the sky and a cratered grey horizon, a dome base
        blob(ctx, w * 0.2, h * 0.2, h * 0.07, h * 0.07, '#3a7ad9', 0);
        ctx.save(); ctx.beginPath(); ctx.arc(w * 0.2, h * 0.2, h * 0.07, 0, TAU); ctx.clip();
        ctx.fillStyle = '#4caf5a'; ctx.beginPath(); ctx.ellipse(w * 0.2 - h * 0.02, h * 0.19, h * 0.03, h * 0.04, 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(5,4,13,0.55)'; ctx.fillRect(w * 0.2 + h * 0.02, h * 0.1, h * 0.1, h * 0.2);
        ctx.restore();
        ctx.fillStyle = '#6e6a7a';
        ctx.beginPath(); ctx.moveTo(0, horizon);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, horizon - Math.sin(x * 0.01) * 10 - rnd() * 4);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        for (let i = 0; i < w / 90; i++) {
            const cx = rnd() * w, cy = horizon + 10 + rnd() * (h - horizon), r = 8 + rnd() * 26;
            blob(ctx, cx, cy, r, r * 0.3, '#57536a', 0); blob(ctx, cx, cy - r * 0.06, r * 0.8, r * 0.2, '#4a4659', 0);
        }
        const dx = w * 0.84;
        ctx.beginPath(); ctx.arc(dx, horizon + 4, 46, Math.PI, 0); ctx.fillStyle = 'rgba(180,220,255,0.25)'; ctx.fill();
        ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#c9ccd6'; ctx.fillRect(dx + 54, horizon - 40, 5, 44); blob(ctx, dx + 56, horizon - 44, 9, 4, '#c9ccd6', 0);
    } else {
        // the Mothership interior: riveted plates, a porthole and glowing tubes
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
        for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let x = 0; x < w; x += 80) for (let y = 0; y < h; y += 70) { ctx.fillRect(x + 6, y + 6, 3, 3); ctx.fillRect(x + 70, y + 6, 3, 3); }
        const px = w * 0.5, py = h * 0.22, pr = Math.min(w, h) * 0.12;
        blob(ctx, px, py, pr + 10, pr + 10, '#4a3a5a', 0);
        blob(ctx, px, py, pr, pr, '#02020a', 0);
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip();
        blob(ctx, px - pr * 0.3, py + pr * 0.9, pr * 1.2, pr * 0.8, '#3a7ad9', 0);
        for (let i = 0; i < 30; i++) ctx.fillStyle = '#fff', ctx.fillRect(px - pr + rnd() * pr * 2, py - pr + rnd() * pr, 1.2, 1.2);
        ctx.restore();
        for (let i = 0; i < 4; i++) {
            const tx = (i + 0.5) * (w / 4), g = ctx.createLinearGradient(tx - 8, 0, tx + 8, 0);
            g.addColorStop(0, 'rgba(120,255,180,0)'); g.addColorStop(0.5, 'rgba(120,255,180,0.18)'); g.addColorStop(1, 'rgba(120,255,180,0)');
            ctx.fillStyle = g; ctx.fillRect(tx - 10, 0, 20, h);
        }
        ctx.fillStyle = '#1a1028'; ctx.fillRect(0, horizon, w, h - horizon);
        ctx.fillStyle = 'rgba(255,90,200,0.2)'; ctx.fillRect(0, horizon, w, 3);
    }
}

// ------------------------------------------------------------------ map icons
export function nodeIcon(ctx, type, x, y, r, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    const k = r / 22;
    ctx.scale(k, k);
    const plate = { fight: '#3a6b8f', elite: '#a8321f', boss: '#5a2a8b', rest: '#2f8a5a', shop: '#c98a1f', event: '#6a4a9a', treasure: '#c9a640' }[type] || '#555';
    blob(ctx, 0, 0, 22, 22, plate, 3);
    blob(ctx, -6, -9, 9, 5, 'rgba(255,255,255,0.18)', 0);
    switch (type) {
        case 'fight': drawSaucer(ctx, 0, 2, 0.75, t, true); break;
        case 'elite':
            blob(ctx, 0, 0, 3, 3, '#ffd23a', 1);
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 13, i * (TAU / 3) - 0.5, i * (TAU / 3) + 0.5); ctx.closePath(); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
            blob(ctx, 0, 0, 4, 4, plate, 1.5);
            break;
        case 'boss':
            blob(ctx, 0, -2, 13, 15, '#7ccf4a', 2);
            eye(ctx, -5, -3, 4.5, 0, '#111'); eye(ctx, 5, -3, 4.5, 0, '#111');
            break;
        case 'rest':
            rrect(ctx, -9, -6, 15, 14, 3); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
            ctx.beginPath(); ctx.arc(8, 1, 4, -1.2, 1.2); ctx.lineWidth = 2.5; ctx.stroke();
            for (let i = 0; i < 2; i++) line(ctx, -4 + i * 5, -10, -2 + i * 5, -15 + Math.sin(t * 3 + i) * 1.5, 1.6, '#fff');
            break;
        case 'shop': label(ctx, '$', 0, 2, 24, '#fff4b0'); break;
        case 'event': label(ctx, '?', 0, 2, 24, '#e8d8ff'); break;
        case 'treasure':
            rrect(ctx, -11, -4, 22, 13, 2); ctx.fillStyle = '#8a5a2a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, -14, 11, -4); ctx.fillStyle = '#a8703a'; ctx.fill(); ctx.stroke();
            blob(ctx, 0, -2, 2.5, 3, '#ffd23a', 1.2);
            break;
    }
    ctx.restore();
}
