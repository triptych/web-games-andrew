// Monsters, drawn in code as billboards facing the caravan. One function per body shape; the family's three
// colours (body, dark, eyes) make each one. s is pixels per world unit; a wolf is ~500 units tall.

import { shade } from './sprites.js';

const TAU = Math.PI * 2;
function el(ctx, x, y, rx, ry, fill, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}
function eyes(ctx, x, y, gap, r, col) {
    el(ctx, x - gap, y, r, r, col); el(ctx, x + gap, y, r, r, col);
    el(ctx, x - gap, y, r * 0.4, r * 0.4, '#000');
    el(ctx, x + gap, y, r * 0.4, r * 0.4, '#000');
}

/**
 * f = { shape, col: [body, dark, eye], warden, elite }, anim = { t, flash (0..1), dead (0..1) }.
 */
export function drawCreature(ctx, f, x, y, s, anim, night) {
    const [b0, d0, eye] = f.col;
    const dim = night ? -0.35 : 0;
    const body = anim.flash > 0 ? shade(b0, 0.7 * anim.flash) : shade(b0, dim), dark = shade(d0, dim);
    const t = anim.t;
    ctx.save();
    if (anim.dead > 0) {
        ctx.globalAlpha = Math.max(0, 1 - anim.dead);
        y += anim.dead * 120 * s;
    }
    // shadow
    el(ctx, x, y, 320 * s, 70 * s, 'rgba(0,0,0,0.25)');
    if (f.elite || f.warden) {
        const g = ctx.createRadialGradient(x, y - 300 * s, 0, x, y - 300 * s, 700 * s);
        g.addColorStop(0, f.warden ? 'rgba(255,80,80,0.25)' : 'rgba(255,220,80,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 700 * s, y - 1000 * s, 1400 * s, 1400 * s);
    }
    const bob = Math.sin(t * 5) * 14 * s;
    switch (f.shape) {
        case 'beast': {
            // a four-legged thing coming at you: haunches, chest, head low
            for (const dx of [-150, 150]) { ctx.fillStyle = dark; ctx.fillRect(x + dx * s - 30 * s, y - 200 * s, 60 * s, 200 * s); }
            el(ctx, x, y - 300 * s + bob, 240 * s, 170 * s, body);
            for (const dx of [-90, 90]) { ctx.fillStyle = dark; ctx.fillRect(x + dx * s - 32 * s, y - 180 * s, 64 * s, 180 * s); }
            el(ctx, x, y - 330 * s + bob, 150 * s, 130 * s, shade(b0, dim + 0.1));
            // ears or horns
            ctx.fillStyle = dark;
            for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 60 * s, y - 420 * s + bob); ctx.lineTo(x + k * 120 * s, y - 540 * s + bob); ctx.lineTo(x + k * 120 * s, y - 400 * s + bob); ctx.fill(); }
            el(ctx, x, y - 260 * s + bob, 60 * s, 40 * s, dark);
            eyes(ctx, x, y - 360 * s + bob, 55 * s, 20 * s, eye);
            if (f.warden) { ctx.strokeStyle = '#f0e6c8'; ctx.lineWidth = 22 * s; ctx.beginPath(); ctx.moveTo(x - 60 * s, y - 240 * s); ctx.quadraticCurveTo(x - 180 * s, y - 240 * s, x - 190 * s, y - 360 * s); ctx.moveTo(x + 60 * s, y - 240 * s); ctx.quadraticCurveTo(x + 180 * s, y - 240 * s, x + 190 * s, y - 360 * s); ctx.stroke(); }
            break;
        }
        case 'biped': case 'king': {
            const k = f.shape === 'king';
            ctx.fillStyle = dark;
            ctx.fillRect(x - 70 * s, y - 260 * s, 50 * s, 260 * s); ctx.fillRect(x + 20 * s, y - 260 * s, 50 * s, 260 * s);
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.moveTo(x - 110 * s, y - 240 * s); ctx.lineTo(x + 110 * s, y - 240 * s); ctx.lineTo(x + 90 * s, y - 540 * s + bob); ctx.lineTo(x - 90 * s, y - 540 * s + bob); ctx.closePath(); ctx.fill();
            if (k) { ctx.fillStyle = shade(d0, dim); ctx.beginPath(); ctx.moveTo(x - 160 * s, y); ctx.lineTo(x - 100 * s, y - 520 * s); ctx.lineTo(x + 100 * s, y - 520 * s); ctx.lineTo(x + 160 * s, y); ctx.closePath(); ctx.globalAlpha *= 0.7; ctx.fill(); ctx.globalAlpha = anim.dead > 0 ? Math.max(0, 1 - anim.dead) : 1; }
            el(ctx, x, y - 610 * s + bob, 75 * s, 80 * s, shade(b0, dim + 0.12));
            eyes(ctx, x, y - 620 * s + bob, 30 * s, 13 * s, eye);
            // weapon arm
            ctx.strokeStyle = dark; ctx.lineWidth = 34 * s; ctx.lineCap = 'round';
            const sw = Math.sin(t * 3) * 0.3;
            ctx.beginPath(); ctx.moveTo(x + 90 * s, y - 500 * s + bob); ctx.lineTo(x + 170 * s, y - 380 * s); ctx.stroke();
            ctx.strokeStyle = '#d0d4dc'; ctx.lineWidth = 16 * s;
            ctx.beginPath(); ctx.moveTo(x + 170 * s, y - 380 * s); ctx.lineTo(x + 170 * s + Math.sin(sw) * 260 * s, y - 380 * s - Math.cos(sw) * 260 * s); ctx.stroke();
            if (k) {
                ctx.fillStyle = eye;
                ctx.beginPath(); ctx.moveTo(x - 80 * s, y - 680 * s + bob); ctx.lineTo(x - 80 * s, y - 780 * s + bob); ctx.lineTo(x - 40 * s, y - 720 * s + bob); ctx.lineTo(x, y - 800 * s + bob); ctx.lineTo(x + 40 * s, y - 720 * s + bob); ctx.lineTo(x + 80 * s, y - 780 * s + bob); ctx.lineTo(x + 80 * s, y - 680 * s + bob); ctx.closePath(); ctx.fill();
            }
            break;
        }
        case 'brute': {
            ctx.fillStyle = dark;
            ctx.fillRect(x - 130 * s, y - 280 * s, 90 * s, 280 * s); ctx.fillRect(x + 40 * s, y - 280 * s, 90 * s, 280 * s);
            el(ctx, x, y - 500 * s + bob, 260 * s, 270 * s, body);
            el(ctx, x, y - 470 * s + bob, 170 * s, 180 * s, shade(b0, dim + 0.12));
            for (const k of [-1, 1]) el(ctx, x + k * 280 * s, y - 380 * s + bob * k, 80 * s, 200 * s, dark, k * 0.2);
            el(ctx, x, y - 760 * s + bob, 90 * s, 80 * s, body);
            eyes(ctx, x, y - 770 * s + bob, 36 * s, 14 * s, eye);
            break;
        }
        case 'spirit': {
            const sc = f.warden ? 1.2 : 1;
            const g = ctx.createRadialGradient(x, y - 420 * s, 0, x, y - 420 * s, 380 * s * sc);
            g.addColorStop(0, shade(b0, 0.3)); g.addColorStop(0.6, body); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x - 200 * s * sc, y - 420 * s + bob);
            ctx.quadraticCurveTo(x, y - 900 * s * sc + bob, x + 200 * s * sc, y - 420 * s + bob);
            for (let i = 4; i >= 0; i--) ctx.lineTo(x - 200 * s * sc + i * 100 * s * sc, y - 150 * s + Math.sin(t * 6 + i) * 40 * s + (i % 2) * 60 * s);
            ctx.closePath(); ctx.fill();
            eyes(ctx, x, y - 520 * s * sc + bob, 50 * s, 18 * s, eye);
            break;
        }
        case 'crawler': {
            ctx.strokeStyle = dark; ctx.lineWidth = 24 * s; ctx.lineCap = 'round';
            for (let i = 0; i < 4; i++) for (const k of [-1, 1]) {
                const ph = Math.sin(t * 8 + i + (k > 0 ? 1.5 : 0)) * 30 * s;
                ctx.beginPath(); ctx.moveTo(x + k * 100 * s, y - 180 * s); ctx.lineTo(x + k * (220 + i * 40) * s, y - 260 * s + ph); ctx.lineTo(x + k * (280 + i * 50) * s, y); ctx.stroke();
            }
            el(ctx, x, y - 200 * s + bob, 200 * s, 130 * s, body);
            el(ctx, x, y - 240 * s + bob, 120 * s, 80 * s, shade(b0, dim + 0.1));
            for (let i = 0; i < 3; i++) eyes(ctx, x, y - 260 * s - i * 26 * s + bob, (30 + i * 12) * s, 9 * s, eye);
            if (f.shape === 'crawler' && f.col[0] === '#c8803a') {
                // the scorpion's tail over its back
                ctx.strokeStyle = body; ctx.lineWidth = 40 * s;
                ctx.beginPath(); ctx.moveTo(x, y - 300 * s); ctx.quadraticCurveTo(x - 30 * s, y - 650 * s, x + 120 * s, y - 600 * s); ctx.stroke();
                el(ctx, x + 140 * s, y - 590 * s, 40 * s, 30 * s, dark);
            }
            break;
        }
        case 'serpent': {
            for (let i = 6; i >= 0; i--) {
                const yy = y - 60 * s - i * 90 * s, xx = x + Math.sin(t * 3 + i * 0.8) * 90 * s;
                el(ctx, xx, yy, (130 - i * 8) * s, 70 * s, i % 2 ? body : shade(b0, dim + 0.1));
            }
            const hx = x + Math.sin(t * 3 + 6 * 0.8) * 90 * s, hy = y - 680 * s;
            el(ctx, hx, hy, 130 * s, 100 * s, body);
            el(ctx, hx, hy + 50 * s, 80 * s, 30 * s, dark);
            eyes(ctx, hx, hy - 20 * s, 50 * s, 16 * s, eye);
            break;
        }
        case 'flyer': case 'drake': {
            const dr = f.shape === 'drake';
            const flap = Math.sin(t * (dr ? 4 : 9));
            const lift = dr ? 200 : 360;
            ctx.fillStyle = dark;
            for (const k of [-1, 1]) {
                ctx.beginPath(); ctx.moveTo(x + k * 60 * s, y - (lift + 160) * s);
                ctx.lineTo(x + k * (dr ? 560 : 360) * s, y - (lift + 260 + flap * 160) * s);
                ctx.lineTo(x + k * (dr ? 460 : 300) * s, y - (lift + 60 + flap * 80) * s);
                ctx.lineTo(x + k * 80 * s, y - (lift + 40) * s); ctx.closePath(); ctx.fill();
            }
            el(ctx, x, y - (lift + 120) * s + bob, (dr ? 200 : 120) * s, (dr ? 220 : 140) * s, body);
            el(ctx, x, y - (lift + (dr ? 380 : 290)) * s + bob, (dr ? 110 : 80) * s, (dr ? 100 : 80) * s, shade(b0, dim + 0.1));
            eyes(ctx, x, y - (lift + (dr ? 390 : 300)) * s + bob, (dr ? 45 : 32) * s, 14 * s, eye);
            if (dr) { ctx.fillStyle = shade(b0, 0.2); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 60 * s, y - (lift + 450) * s); ctx.lineTo(x + k * 120 * s, y - (lift + 600) * s); ctx.lineTo(x + k * 20 * s, y - (lift + 470) * s); ctx.fill(); } }
            break;
        }
        case 'blob': {
            const sq = 1 + Math.sin(t * 4) * 0.08;
            el(ctx, x, y - 200 * s * sq, 240 * s / sq, 200 * s * sq, body);
            el(ctx, x - 60 * s, y - 280 * s * sq, 70 * s, 50 * s, shade(b0, dim + 0.25));
            eyes(ctx, x, y - 240 * s * sq, 60 * s, 22 * s, eye);
            break;
        }
        case 'golem': {
            ctx.fillStyle = dark;
            ctx.fillRect(x - 170 * s, y - 300 * s, 120 * s, 300 * s); ctx.fillRect(x + 50 * s, y - 300 * s, 120 * s, 300 * s);
            ctx.fillStyle = body;
            ctx.fillRect(x - 230 * s, y - 720 * s + bob, 460 * s, 440 * s);
            ctx.fillRect(x - 380 * s, y - 680 * s + bob, 140 * s, 360 * s); ctx.fillRect(x + 240 * s, y - 680 * s + bob, 140 * s, 360 * s);
            ctx.fillRect(x - 110 * s, y - 900 * s + bob, 220 * s, 180 * s);
            ctx.strokeStyle = eye; ctx.lineWidth = 16 * s;
            ctx.beginPath(); ctx.moveTo(x - 180 * s, y - 650 * s + bob); ctx.lineTo(x - 40 * s, y - 520 * s + bob); ctx.lineTo(x + 60 * s, y - 610 * s + bob); ctx.lineTo(x + 190 * s, y - 380 * s + bob); ctx.stroke();
            eyes(ctx, x, y - 820 * s + bob, 50 * s, 18 * s, eye);
            break;
        }
    }
    ctx.restore();
}

/** How tall a creature stands, in world units: for placing damage numbers over its head. */
export function creatureHeight(f) {
    const h = { beast: 560, biped: 720, king: 820, brute: 860, spirit: 800, crawler: 380, serpent: 800, flyer: 720, drake: 900, blob: 450, golem: 920 }[f.shape] || 600;
    return h;
}
