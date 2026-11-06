// Paints the view through each window: eight stations, each in an early and a late (small-hours)
// version, and every curio, all with Canvas 2D shapes. No image files.
//
// Scenes are painted once into a 480 × 360 canvas (40 px a world unit) and cached. The look is
// soft and low-detail on purpose: the view scales it up with smoothing, adds grain, and puts mist
// over it, which is the lo-fi part.

import { STATIONS } from '../sim/scenes.js';
import { makeRng } from '../rng.js';

export const SW = 480, SH = 360, U = 40;

const cache = new Map();

/** The scene canvas for a station (index), early or late. Cached. */
export function paintScene(station, late, seed = 1) {
    const key = `${station}:${late ? 1 : 0}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const c = makeCanvas(SW, SH);
    const ctx = c.getContext('2d');
    const s = STATIONS[station];
    const rng = makeRng(seed * 7919 + station * 31 + (late ? 5 : 0));
    THEMES[s.theme](ctx, rng, late, s);
    // curios on top, at the places the sim checks
    for (const cu of s.curios) CURIO_ART[cu.id]?.(ctx, cu.x * U, cu.y * U, late, rng);
    if (late) CURIO_ART[s.rare.id]?.(ctx, s.rare.x * U, s.rare.y * U, late, rng);
    // a touch of lo-fi: lift the blacks and warm everything slightly
    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = late ? '#120f1e' : '#1a1422';
    ctx.fillRect(0, 0, SW, SH);
    ctx.globalCompositeOperation = 'source-over';
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    cache.set(key, c);
    return c;
}

export function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

// ------------------------------------------------------------------ helpers

function sky(ctx, stops, y1 = SH) {
    const g = ctx.createLinearGradient(0, 0, 0, y1);
    stops.forEach(([at, col]) => g.addColorStop(at, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, y1);
}

function stars(ctx, rng, n, yMax, a = 0.8) {
    for (let i = 0; i < n; i++) {
        const x = rng() * SW, y = rng() ** 1.4 * yMax, r = rng() < 0.08 ? 1.3 : 0.7;
        ctx.globalAlpha = a * (0.3 + rng() * 0.7);
        ctx.fillStyle = rng() < 0.2 ? '#ffe9c4' : '#e8eeff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function glow(ctx, x, y, r, col, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
}

function disc(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function moon(ctx, x, y, r, phase = 0.35) {
    glow(ctx, x, y, r * 5, 'rgba(220,230,255,0.35)');
    disc(ctx, x, y, r, '#f4f0dc');
    ctx.globalAlpha = 0.18;
    disc(ctx, x - r * 0.3, y - r * 0.2, r * 0.25, '#b8b4a0');
    disc(ctx, x + r * 0.35, y + r * 0.3, r * 0.18, '#b8b4a0');
    ctx.globalAlpha = 1;
    if (phase) { ctx.globalAlpha = 0.85; disc(ctx, x + r * (1 - phase) * 1.4, y - r * 0.15, r * 0.95, ctx.__skyAt || '#1a2040'); ctx.globalAlpha = 1; }
}

/** A smooth ridge line across the canvas, filled down to `bottom`. */
function ridge(ctx, rng, base, amp, col, { freq = 1, bottom = SH, jag = 0 } = {}) {
    const p1 = rng() * 6, p2 = rng() * 6, p3 = rng() * 6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= SW; x += 4) {
        const t = x / SW;
        let y = base - amp * (0.55 * Math.sin(t * 5 * freq + p1) + 0.3 * Math.sin(t * 11 * freq + p2) + 0.15 * Math.sin(t * 23 * freq + p3));
        if (jag) y -= jag * Math.abs(((t * 9 * freq + p1) % 2) - 1) * 2 - jag;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(SW, bottom);
    ctx.closePath();
    ctx.fill();
}

function ridgeY(rng, base, amp, freq = 1) {
    const p1 = rng() * 6, p2 = rng() * 6, p3 = rng() * 6;
    return (x) => { const t = x / SW; return base - amp * (0.55 * Math.sin(t * 5 * freq + p1) + 0.3 * Math.sin(t * 11 * freq + p2) + 0.15 * Math.sin(t * 23 * freq + p3)); };
}

function pine(ctx, x, y, h, col, snow = null) {
    const w = h * 0.42;
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) {
        const ty = y - h + i * h * 0.2, by = y - h * 0.62 + i * h * 0.2, ww = w * (0.45 + i * 0.2);
        ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + ww, by); ctx.lineTo(x - ww, by); ctx.closePath(); ctx.fill();
        if (snow) {
            ctx.fillStyle = snow;
            ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + ww * 0.45, ty + (by - ty) * 0.45); ctx.lineTo(x - ww * 0.45, ty + (by - ty) * 0.45); ctx.closePath(); ctx.fill();
            ctx.fillStyle = col;
        }
    }
    ctx.fillRect(x - h * 0.03, y - h * 0.08, h * 0.06, h * 0.08);
}

function roundTree(ctx, x, y, r, col, trunk) {
    ctx.fillStyle = trunk || col;
    ctx.fillRect(x - r * 0.1, y - r * 1.2, r * 0.2, r * 1.2);
    disc(ctx, x, y - r * 1.5, r, col);
    disc(ctx, x - r * 0.6, y - r * 1.2, r * 0.7, col);
    disc(ctx, x + r * 0.6, y - r * 1.25, r * 0.72, col);
}

/** A little house: wall, pitched roof, windows (some lit). */
function house(ctx, rng, x, y, w, h, { wall, roof, lit = '#ffcf7a', dark = 'rgba(0,0,0,0.35)', snow = null, chance = 0.6, win = 2 } = {}) {
    ctx.fillStyle = wall;
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(x - w * 0.08, y - h); ctx.lineTo(x + w / 2, y - h - w * 0.45); ctx.lineTo(x + w * 1.08, y - h); ctx.closePath(); ctx.fill();
    if (snow) {
        ctx.fillStyle = snow;
        ctx.beginPath(); ctx.moveTo(x - w * 0.1, y - h + 2); ctx.lineTo(x + w / 2, y - h - w * 0.45); ctx.lineTo(x + w * 1.1, y - h + 2); ctx.lineTo(x + w * 1.1, y - h - 1); ctx.lineTo(x + w / 2, y - h - w * 0.36); ctx.lineTo(x - w * 0.1, y - h - 1); ctx.closePath(); ctx.fill();
    }
    const ww = w / (win * 2 + 1);
    for (let i = 0; i < win; i++) {
        const wx = x + ww * (1 + i * 2), wy = y - h * 0.68;
        const on = rng() < chance;
        if (on) glow(ctx, wx + ww / 2, wy + ww / 2, ww * 3, hexA(lit, 0.35));
        ctx.fillStyle = on ? lit : dark;
        ctx.fillRect(wx, wy, ww, ww * 1.2);
    }
}

function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function water(ctx, y0, y1, top, bot) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, SW, y1 - y0);
}

/** Broken horizontal glints: the reflection of a light on water. */
function reflection(ctx, rng, x, y0, y1, col, w = 10) {
    ctx.fillStyle = col;
    for (let y = y0; y < y1; y += 3 + rng() * 3) {
        const k = 1 - (y - y0) / (y1 - y0) * 0.5;
        const ww = w * k * (0.4 + rng() * 0.8);
        ctx.globalAlpha = 0.25 + rng() * 0.45 * k;
        ctx.fillRect(x - ww / 2 + (rng() - 0.5) * 4, y, ww, 1.5);
    }
    ctx.globalAlpha = 1;
}

function mist(ctx, y, h, a, col = '255,255,255') {
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h, SW, h * 2);
}

function grassTufts(ctx, rng, y0, y1, n, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
        const x = rng() * SW, y = y0 + rng() * (y1 - y0), h = 3 + rng() * 6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1, y - h * 0.6, x + (rng() - 0.5) * 4, y - h); ctx.stroke();
    }
}

function cloud(ctx, x, y, w, col, a = 0.6) {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.15, y - w * 0.07, w * 0.22, w * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.12, y - w * 0.09, w * 0.18, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ themes

const THEMES = {
    willow(ctx, rng, late) {
        sky(ctx, late ? [[0, '#0b1030'], [0.45, '#25285a'], [0.62, '#4a3d6e']] : [[0, '#3b3a6e'], [0.32, '#8a5a86'], [0.5, '#d27a7a'], [0.62, '#f4b47c']]);
        if (late) { stars(ctx, rng, 120, 200); ctx.__skyAt = '#151a44'; moon(ctx, 3.4 * U, 1.3 * U, 11, 0.3); }
        else { glow(ctx, 7.4 * U, 5.1 * U, 120, 'rgba(255,214,150,0.75)'); disc(ctx, 7.4 * U, 5.15 * U, 14, '#ffe2b0'); cloud(ctx, 3 * U, 2.2 * U, 150, '#f0a8a0', 0.35); cloud(ctx, 9.4 * U, 1.5 * U, 120, '#c88aa8', 0.3); }
        ridge(ctx, rng, 5.15 * U, 14, late ? '#22234c' : '#7a5a86');
        // farmhouse on the far hill
        const hy = 5.05 * U;
        ridge(ctx, rng, 5.6 * U, 18, late ? '#18203a' : '#4f5a64', { freq: 0.7 });
        house(ctx, rng, 9.6 * U, hy + 6, 34, 20, { wall: late ? '#2a2a3e' : '#8a6a6a', roof: late ? '#1a1a2a' : '#5a3a46', chance: 1, win: 1, lit: '#ffd27a' });
        roundTree(ctx, 11.0 * U, hy + 8, 9, late ? '#141a2a' : '#3a4a4a');
        // hay bales
        for (const bx of [5.2, 5.8, 6.7]) { disc(ctx, bx * U, 5.55 * U, 6, late ? '#2a2a30' : '#b08a5a'); ctx.globalAlpha = 0.4; disc(ctx, bx * U - 1.5, 5.55 * U - 1, 3, late ? '#3a3a40' : '#d0aa70'); ctx.globalAlpha = 1; }
        ridge(ctx, rng, 6.4 * U, 10, late ? '#121a26' : '#3e4e46', { freq: 0.6 });
        // pond
        ctx.save();
        ctx.beginPath(); ctx.ellipse(8.2 * U, 7.45 * U, 2.3 * U, 0.6 * U, 0, 0, Math.PI * 2); ctx.clip();
        water(ctx, 6.8 * U, 8.1 * U, late ? '#2a2c5a' : '#e0a088', late ? '#14183a' : '#8a5a7a');
        if (!late) reflection(ctx, rng, 7.4 * U, 7.0 * U, 8.0 * U, '#ffe6c0', 26);
        else reflection(ctx, rng, 9.4 * U, 7.0 * U, 8.0 * U, '#e8e8ff', 10);
        ctx.restore();
        // fence
        ctx.fillStyle = late ? '#0e1420' : '#2e3a34';
        for (let x = 4.4; x < 6.4; x += 0.45) ctx.fillRect(x * U, 6.15 * U, 2, 14);
        ctx.fillRect(4.4 * U, 6.25 * U, 2 * U, 1.5); ctx.fillRect(4.4 * U, 6.45 * U, 2 * U, 1.5);
        // foreground grass
        ridge(ctx, rng, 7.9 * U, 6, late ? '#0c1218' : '#2a3a30', { freq: 0.5 });
        grassTufts(ctx, rng, 6.2 * U, SH, 260, late ? '#1a2630' : '#4a5e48');
        // the willow
        const tx = 2.1 * U, ty = 6.5 * U;
        ctx.fillStyle = late ? '#0c1016' : '#2a2a26';
        ctx.beginPath(); ctx.moveTo(tx - 8, ty); ctx.quadraticCurveTo(tx - 2, ty - 50, tx - 10, ty - 110); ctx.lineTo(tx + 4, ty - 112); ctx.quadraticCurveTo(tx + 6, ty - 50, tx + 10, ty); ctx.closePath(); ctx.fill();
        const leaf = late ? '#18242a' : '#56704a', leaf2 = late ? '#223038' : '#7a8e5a';
        for (let i = 0; i < 70; i++) {
            const a = rng() * Math.PI * 2, rr = rng() * 46;
            const sx = tx + Math.cos(a) * rr * 1.3, sy = ty - 120 + Math.sin(a) * rr * 0.6;
            ctx.strokeStyle = rng() < 0.4 ? leaf2 : leaf; ctx.lineWidth = 2 + rng() * 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (rng() - 0.5) * 10, sy + 40, sx + (rng() - 0.5) * 8, sy + 60 + rng() * 50); ctx.stroke();
        }
    },

    quay(ctx, rng, late) {
        sky(ctx, late ? [[0, '#080a1c'], [0.5, '#141634'], [0.6, '#24203e']] : [[0, '#1c2046'], [0.4, '#3e3a70'], [0.58, '#8a5a7e']]);
        stars(ctx, rng, late ? 90 : 40, 140, late ? 0.8 : 0.5);
        // far rooftops behind the bridge
        ctx.fillStyle = late ? '#12122a' : '#2a2648';
        for (let x = 3.4 * U; x < 9.8 * U; x += 22 + rng() * 14) {
            const h = 30 + rng() * 40;
            ctx.fillRect(x, 4.6 * U - h, 22, h + 10);
            if (rng() < 0.7) { ctx.fillStyle = '#ffbf6a'; ctx.fillRect(x + 6, 4.6 * U - h + 8, 4, 5); ctx.fillStyle = late ? '#12122a' : '#2a2648'; }
        }
        // the canal
        water(ctx, 5.4 * U, SH, late ? '#141a36' : '#2a2c5a', late ? '#080c1c' : '#14183a');
        // bridge
        const bc = late ? '#1e1a2e' : '#4a3a4e';
        ctx.fillStyle = bc;
        ctx.beginPath();
        ctx.moveTo(3.4 * U, 4.95 * U); ctx.lineTo(9.8 * U, 4.95 * U); ctx.lineTo(9.8 * U, 5.6 * U);
        ctx.quadraticCurveTo(6.6 * U, 4.2 * U, 3.4 * U, 5.6 * U); ctx.closePath(); ctx.fill();
        ctx.fillRect(3.4 * U, 4.82 * U, 6.4 * U, 3);
        for (let x = 3.6; x < 9.8; x += 0.4) ctx.fillRect(x * U, 4.6 * U, 1.5, 0.22 * U);
        ctx.fillRect(3.4 * U, 4.58 * U, 6.4 * U, 1.5);
        // buildings left and right
        const facade = (x0, x1, top, wall, side) => {
            ctx.fillStyle = wall;
            ctx.fillRect(x0, top, x1 - x0, 6.2 * U - top);
            for (let y = top + 14; y < 5.8 * U; y += 28) {
                for (let x = x0 + 10; x < x1 - 14; x += 26) {
                    const on = rng() < (late ? 0.35 : 0.55);
                    if (on) glow(ctx, x + 5, y + 7, 22, 'rgba(255,190,110,0.35)');
                    ctx.fillStyle = on ? '#ffc777' : 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x, y, 10, 14);
                }
            }
            ctx.fillStyle = side;
            ctx.fillRect(side === '#000' ? x1 : x0, top, 4, 6.2 * U - top);
        };
        facade(0, 3.4 * U, 1.9 * U, late ? '#1e1830' : '#5a3a46', 'rgba(0,0,0,0.2)');
        facade(9.8 * U, SW, 2.4 * U, late ? '#1a1830' : '#4a3650', 'rgba(0,0,0,0.2)');
        // roof edges
        ctx.fillStyle = late ? '#120e1e' : '#2e2030';
        ctx.fillRect(0, 1.8 * U, 3.5 * U, 6); ctx.fillRect(9.7 * U, 2.3 * U, SW, 6);
        // quay walls
        ctx.fillStyle = late ? '#141220' : '#3a2e3a';
        ctx.fillRect(0, 6.2 * U, 3.6 * U, 10); ctx.fillRect(9.6 * U, 6.2 * U, 3 * U, 10);
        // strings of lanterns
        const cols = ['#ff7a5a', '#ffb05a', '#ffd27a', '#ff5a7a'];
        for (const [y0, sag] of [[2.4, 0.7], [3.1, 0.5]]) {
            ctx.strokeStyle = 'rgba(20,10,20,0.8)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(3.4 * U, y0 * U); ctx.quadraticCurveTo(6.6 * U, (y0 + sag * 2) * U, 9.8 * U, (y0 + 0.4) * U); ctx.stroke();
            for (let t = 0.06; t < 1; t += 0.085) {
                const x = 3.4 * U + t * 6.4 * U;
                const y = (1 - t) ** 2 * y0 * U + 2 * (1 - t) * t * (y0 + sag * 2) * U + t * t * (y0 + 0.4) * U;
                const c = cols[Math.floor(rng() * cols.length)];
                glow(ctx, x, y + 5, 18, hexA(c, 0.45));
                ctx.fillStyle = c;
                ctx.beginPath(); ctx.ellipse(x, y + 5, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
                reflection(ctx, rng, x, 5.6 * U + (y - 2 * U) * 0.4, 5.6 * U + (y - 2 * U) * 0.4 + 30, c, 5);
            }
        }
        // reflections of the windows on the canal
        for (let i = 0; i < 6; i++) reflection(ctx, rng, rng() < 0.5 ? rng() * 3 * U : 10 * U + rng() * 2 * U, 6.5 * U, 8.8 * U, '#ffbf6a', 8);
    },

    pine(ctx, rng, late) {
        sky(ctx, late ? [[0, '#050a18'], [0.5, '#0e1a2e'], [0.65, '#1c2c40']] : [[0, '#0c1628'], [0.45, '#1e3048'], [0.62, '#3a5470']]);
        stars(ctx, rng, late ? 160 : 90, 200);
        if (!late) { ctx.__skyAt = '#142236'; moon(ctx, 9.6 * U, 1.5 * U, 10, 0.45); }
        // mountains
        ctx.fillStyle = late ? '#141e30' : '#2a3c56';
        ctx.beginPath(); ctx.moveTo(0, 5 * U);
        const peaks = [[0, 4.2], [1.6, 3.1], [3.0, 3.9], [4.6, 2.6], [6.4, 3.8], [8.0, 2.9], [9.6, 3.6], [11.2, 3.0], [12, 3.5]];
        for (const [x, y] of peaks) ctx.lineTo(x * U, y * U);
        ctx.lineTo(SW, 5 * U); ctx.closePath(); ctx.fill();
        ctx.fillStyle = late ? '#3a4a60' : '#a8bcd4';
        for (const [x, y] of peaks.slice(1, -1)) {
            if (y > 3.5) continue;
            ctx.beginPath(); ctx.moveTo(x * U, y * U); ctx.lineTo(x * U + 12, y * U + 12); ctx.lineTo(x * U + 4, y * U + 10); ctx.lineTo(x * U - 3, y * U + 14); ctx.lineTo(x * U - 12, y * U + 12); ctx.closePath(); ctx.fill();
        }
        mist(ctx, 4.8 * U, 30, 0.35, '170,190,215');
        for (let i = 0; i < 40; i++) pine(ctx, rng() * SW, 5.2 * U + rng() * 10, 26 + rng() * 14, late ? '#0e1828' : '#1a2c40');
        mist(ctx, 5.5 * U, 24, 0.3, '170,190,215');
        // clearing
        ridge(ctx, rng, 6.3 * U, 6, late ? '#0a1220' : '#162638', { freq: 0.4 });
        // the cabin
        const cx = 5.6 * U, cy = 6.35 * U;
        ctx.fillStyle = late ? '#1e1a20' : '#4a3428';
        ctx.fillRect(cx, cy - 34, 64, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = cy - 30; y < cy; y += 6) ctx.fillRect(cx, y, 64, 1);
        ctx.fillStyle = late ? '#141016' : '#2e2220';
        ctx.beginPath(); ctx.moveTo(cx - 8, cy - 34); ctx.lineTo(cx + 32, cy - 62); ctx.lineTo(cx + 72, cy - 34); ctx.closePath(); ctx.fill();
        ctx.fillRect(cx + 46, cy - 66, 8, 22);
        for (const wx of [cx + 10, cx + 42]) { glow(ctx, wx + 6, cy - 20, 30, 'rgba(255,180,90,0.45)'); ctx.fillStyle = '#ffc06a'; ctx.fillRect(wx, cy - 26, 12, 11); }
        ctx.fillStyle = '#2a1a14'; ctx.fillRect(cx + 26, cy - 22, 10, 22);
        // smoke
        for (let i = 0; i < 9; i++) { ctx.globalAlpha = 0.18 - i * 0.015; disc(ctx, cx + 50 + Math.sin(i) * 6 + i * 3, cy - 74 - i * 9, 5 + i * 1.6, '#c8d0dc'); }
        ctx.globalAlpha = 1;
        // near pines frame the view
        const near = late ? '#060c14' : '#0b1420';
        pine(ctx, 0.3 * U, SH + 10, 230, near); pine(ctx, 1.4 * U, SH, 180, near);
        pine(ctx, 11.4 * U, SH + 10, 240, near); pine(ctx, 10.4 * U, SH, 170, near);
        // the owl's branch
        ctx.strokeStyle = near; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0.4 * U, 3.95 * U); ctx.lineTo(2.4 * U, 3.85 * U); ctx.stroke();
        ridge(ctx, rng, 8.4 * U, 4, late ? '#060c14' : '#0c1624', { freq: 0.3 });
    },

    mill(ctx, rng, late) {
        sky(ctx, late ? [[0, '#081226'], [0.5, '#16264a'], [0.64, '#2a3a5e']] : [[0, '#1c2c5a'], [0.4, '#3a5a8e'], [0.64, '#9ab0d0']]);
        stars(ctx, rng, late ? 120 : 30, 160, late ? 0.8 : 0.4);
        if (late) { ctx.__skyAt = '#101e3c'; moon(ctx, 8.8 * U, 1.2 * U, 9, 0.5); }
        // treeline
        for (let i = 0; i < 26; i++) roundTree(ctx, rng() * SW, 5.4 * U + rng() * 6, 10 + rng() * 8, late ? '#0e1a30' : '#2c3e60');
        ctx.fillStyle = late ? '#0e1a30' : '#2c3e60'; ctx.fillRect(0, 5.3 * U, SW, 0.7 * U);
        // river
        water(ctx, 5.95 * U, SH, late ? '#1a2a4e' : '#7a92c0', late ? '#0a142a' : '#2a3a62');
        for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#d0dcf0'; ctx.fillRect(rng() * SW, 6 * U + rng() * 3 * U, 8 + rng() * 20, 1); }
        ctx.globalAlpha = 1;
        // banks
        ctx.fillStyle = late ? '#0c1626' : '#26364e';
        ctx.beginPath(); ctx.moveTo(0, 6.0 * U); ctx.lineTo(4.6 * U, 6.0 * U); ctx.lineTo(4.2 * U, 6.5 * U); ctx.lineTo(0, 6.9 * U); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(SW, 6.2 * U); ctx.lineTo(9.2 * U, 6.3 * U); ctx.lineTo(9.6 * U, 6.7 * U); ctx.lineTo(SW, 7.1 * U); ctx.closePath(); ctx.fill();
        // the mill
        const mx = 0.6 * U, my = 6.0 * U;
        ctx.fillStyle = late ? '#2a2a3a' : '#7a7480';
        ctx.fillRect(mx, my - 70, 76, 70);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = my - 66; y < my; y += 8) for (let x = mx + (y % 16 ? 0 : 6); x < mx + 76; x += 12) ctx.fillRect(x, y, 10, 1);
        ctx.fillStyle = late ? '#1a1a26' : '#4a3a42';
        ctx.beginPath(); ctx.moveTo(mx - 8, my - 70); ctx.lineTo(mx + 38, my - 104); ctx.lineTo(mx + 84, my - 70); ctx.closePath(); ctx.fill();
        glow(ctx, mx + 26, my - 42, 34, 'rgba(255,190,110,0.5)');
        ctx.fillStyle = '#ffc878'; ctx.fillRect(mx + 20, my - 50, 13, 15);
        ctx.fillStyle = late ? '#141420' : '#3a3440'; ctx.fillRect(mx + 46, my - 50, 13, 15);
        // reeds
        ctx.strokeStyle = late ? '#0e1a22' : '#2e4038'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 60; i++) {
            const x = 4.6 * U + rng() * 3 * U, y = 6.1 * U + rng() * 10, h = 10 + rng() * 18;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 2, y - h / 2, x + (rng() - 0.3) * 6, y - h); ctx.stroke();
            if (rng() < 0.2) { ctx.fillStyle = late ? '#2a2018' : '#5a4030'; ctx.fillRect(x - 1, y - h * 0.8, 2.5, 6); }
        }
        // window reflection
        reflection(ctx, rng, mx + 26, 6.1 * U, 7.4 * U, '#ffc878', 10);
        mist(ctx, 6.1 * U, 14, late ? 0.15 : 0.25, '200,215,235');
    },

    harbor(ctx, rng, late) {
        sky(ctx, late ? [[0, '#03060f'], [0.5, '#0a1428'], [0.58, '#16243e']] : [[0, '#070c1e'], [0.45, '#14223e'], [0.58, '#2c3e60']]);
        stars(ctx, rng, late ? 200 : 110, 200);
        ctx.__skyAt = late ? '#08101e' : '#0e1830';
        moon(ctx, 3.4 * U, 1.5 * U, 12, late ? 0 : 0.25);
        // sea
        water(ctx, 5.2 * U, SH, late ? '#0e1a30' : '#162640', late ? '#04080f' : '#070e1c');
        reflection(ctx, rng, 3.4 * U, 5.25 * U, SH, '#e8ecff', 30);
        // far shore with town lights
        ctx.fillStyle = late ? '#060a14' : '#0c1424';
        ctx.fillRect(0, 5.05 * U, 7 * U, 0.2 * U);
        for (let i = 0; i < 26; i++) { const x = rng() * 6.6 * U; ctx.fillStyle = rng() < 0.7 ? '#ffcf7a' : '#cfe2ff'; ctx.fillRect(x, 5.08 * U, 1.6, 1.6); }
        // the cliff and the lighthouse
        ctx.fillStyle = late ? '#080c16' : '#101828';
        ctx.beginPath(); ctx.moveTo(8.2 * U, SH); ctx.lineTo(8.6 * U, 5.2 * U); ctx.quadraticCurveTo(9.2 * U, 4.2 * U, 9.6 * U, 3.95 * U); ctx.lineTo(SW, 3.8 * U); ctx.lineTo(SW, SH); ctx.closePath(); ctx.fill();
        // beam
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createLinearGradient(10 * U, 0, 3 * U, 0);
        bg.addColorStop(0, 'rgba(255,240,200,0.32)'); bg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.moveTo(10 * U, 2.65 * U); ctx.lineTo(2.5 * U, 1.7 * U); ctx.lineTo(2.5 * U, 3.3 * U); ctx.closePath(); ctx.fill();
        ctx.restore();
        // fishing boats moored on the left, with lights
        for (const [x, y] of [[2.6, 5.7], [3.6, 5.85]]) {
            ctx.fillStyle = '#0a0e18';
            ctx.beginPath(); ctx.moveTo(x * U - 16, y * U); ctx.lineTo(x * U + 16, y * U); ctx.lineTo(x * U + 12, y * U + 6); ctx.lineTo(x * U - 12, y * U + 6); ctx.closePath(); ctx.fill();
            ctx.fillRect(x * U - 1, y * U - 26, 2, 26);
            glow(ctx, x * U, y * U - 26, 10, 'rgba(255,220,140,0.8)');
            reflection(ctx, rng, x * U, y * U + 8, y * U + 40, '#ffd890', 6);
        }
        // the jetty
        ctx.fillStyle = late ? '#120e10' : '#2a2020';
        ctx.fillRect(0, 6.75 * U, 3.0 * U, 5);
        for (let x = 0.2; x < 3.0; x += 0.55) ctx.fillRect(x * U, 6.75 * U, 4, SH);
        ctx.fillRect(1.82 * U, 6.55 * U, 6, 0.3 * U);
        // waves
        ctx.strokeStyle = 'rgba(160,190,230,0.15)'; ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) { const x = rng() * SW, y = 5.6 * U + rng() * 3.4 * U; ctx.beginPath(); ctx.arc(x, y + 6, 6 + rng() * 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    },

    snow(ctx, rng, late) {
        sky(ctx, late ? [[0, '#070c1c'], [0.5, '#14203c'], [0.6, '#26344e']] : [[0, '#0f1730'], [0.45, '#26385c'], [0.6, '#4c5c7c']]);
        stars(ctx, rng, late ? 140 : 70, 170);
        // far hills
        ridge(ctx, rng, 4.9 * U, 14, late ? '#5a6a88' : '#8494b4', { freq: 0.8 });
        // the village on the hill
        const hill = ridgeY(rng, 5.7 * U, 10, 0.6);
        ctx.fillStyle = late ? '#8090ac' : '#aebcd6';
        ctx.beginPath(); ctx.moveTo(0, SH); for (let x = 0; x <= SW; x += 4) ctx.lineTo(x, hill(x)); ctx.lineTo(SW, SH); ctx.closePath(); ctx.fill();
        // church
        const chx = 6.0 * U, chy = hill(chx) + 4;
        ctx.fillStyle = late ? '#3a3e52' : '#6a6e84';
        ctx.fillRect(chx - 10, chy - 52, 20, 52);
        ctx.beginPath(); ctx.moveTo(chx - 12, chy - 52); ctx.lineTo(chx, chy - 86); ctx.lineTo(chx + 12, chy - 52); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd890'; ctx.fillRect(chx - 3, chy - 44, 6, 9);
        glow(ctx, chx, chy - 40, 20, 'rgba(255,210,140,0.4)');
        const houses = [[3.6, 26, 18], [4.6, 22, 16], [7.0, 28, 18], [8.1, 22, 15], [2.4, 24, 16], [9.2, 26, 17]];
        for (const [x, w, h] of houses) house(ctx, rng, x * U, hill(x * U + w / 2) + 6, w, h, { wall: late ? '#3a3448' : '#6a5a6a', roof: late ? '#2a2638' : '#4a3a4a', snow: late ? '#c8d2e8' : '#eef2fa', chance: late ? 0.5 : 0.85, win: 1 });
        for (let i = 0; i < 14; i++) { const x = rng() * SW; pine(ctx, x, hill(x) + 8, 18 + rng() * 14, late ? '#18243a' : '#2a3c54', '#e4ecf8'); }
        // ridge on the right
        ctx.fillStyle = late ? '#9aa8c4' : '#c4d0e6';
        ctx.beginPath(); ctx.moveTo(8.8 * U, SH); ctx.quadraticCurveTo(9.6 * U, 4.6 * U, 12 * U, 4.4 * U); ctx.lineTo(SW, SH); ctx.closePath(); ctx.fill();
        // foreground snow
        ctx.fillStyle = late ? '#c4cee4' : '#e6eef8';
        ctx.beginPath(); ctx.moveTo(0, 6.6 * U); ctx.quadraticCurveTo(4 * U, 6.1 * U, 7 * U, 6.6 * U); ctx.quadraticCurveTo(10 * U, 7.0 * U, SW, 6.7 * U); ctx.lineTo(SW, SH); ctx.lineTo(0, SH); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(90,110,150,0.18)';
        for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(rng() * SW, 7 * U + rng() * 2 * U, 10 + rng() * 20, 2, 0, 0, Math.PI * 2); ctx.fill(); }
        // falling snow
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 140; i++) { ctx.globalAlpha = 0.3 + rng() * 0.5; disc(ctx, rng() * SW, rng() * SH, 0.6 + rng() * 1.2, '#fff'); }
        ctx.globalAlpha = 1;
    },

    city(ctx, rng, late) {
        sky(ctx, late ? [[0, '#06070f'], [0.4, '#141226'], [0.62, '#2a1e32']] : [[0, '#0d0f22'], [0.4, '#221c3c'], [0.62, '#4a2e48']]);
        glow(ctx, 6 * U, 5 * U, 260, 'rgba(255,140,90,0.18)');
        // far towers
        for (let x = -10; x < SW; x += 16 + rng() * 22) {
            const h = 50 + rng() * 120, w = 14 + rng() * 22;
            ctx.fillStyle = late ? '#0e0e1c' : '#1a1a32';
            ctx.fillRect(x, 4.6 * U - h, w, h + 40);
            for (let y = 4.6 * U - h + 6; y < 4.6 * U; y += 7) for (let wx = x + 3; wx < x + w - 3; wx += 5) {
                if (rng() < (late ? 0.12 : 0.25)) { ctx.fillStyle = rng() < 0.8 ? '#ffcf7a' : '#9ad0ff'; ctx.fillRect(wx, y, 2, 3); }
            }
            if (rng() < 0.2) { ctx.fillStyle = '#ff4a4a'; ctx.fillRect(x + w / 2, 4.6 * U - h - 4, 2, 2); }
        }
        // mid rooftops
        const roofs = [[0, 3.6 * U, 5.3 * U], [2.0 * U, 5.2 * U, 4.75 * U], [5.2 * U, 7.2 * U, 5.6 * U], [7.2 * U, 9.6 * U, 5.25 * U], [9.6 * U, SW, 4.9 * U]];
        roofs.forEach(([x0, x1, top], i) => {
            ctx.fillStyle = late ? ['#16121e', '#1a1622', '#141020', '#18141e', '#120e1a'][i] : ['#2a2234', '#33283c', '#2a2032', '#2e2436', '#261e2e'][i];
            ctx.fillRect(x0, top, x1 - x0, SH - top);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0, top, x1 - x0, 3);
            for (let y = top + 16; y < 6.3 * U; y += 24) for (let x = x0 + 8; x < x1 - 12; x += 22) {
                if (rng() < (late ? 0.25 : 0.45)) { glow(ctx, x + 4, y + 6, 16, 'rgba(255,180,100,0.3)'); ctx.fillStyle = '#ffbd6e'; } else ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fillRect(x, y, 8, 11);
            }
        });
        // water tower
        ctx.fillStyle = late ? '#0c0a12' : '#1a1420';
        ctx.fillRect(0.8 * U, 3.5 * U, 30, 26);
        ctx.beginPath(); ctx.moveTo(0.75 * U, 3.5 * U); ctx.lineTo(0.8 * U + 15, 3.1 * U); ctx.lineTo(0.85 * U + 30, 3.5 * U); ctx.closePath(); ctx.fill();
        for (const lx of [0.85, 1.4]) ctx.fillRect(lx * U, 4.15 * U, 2, 1.2 * U);
        // antenna
        ctx.fillRect(10.6 * U, 3.6 * U, 2, 1.3 * U); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(10.6 * U - 1, 3.55 * U, 4, 3);
        // street: wet, with reflections
        ctx.fillStyle = late ? '#0a0810' : '#16101c';
        ctx.fillRect(0, 7.3 * U, SW, SH);
        for (let i = 0; i < 10; i++) reflection(ctx, rng, rng() * SW, 7.35 * U, SH, rng() < 0.5 ? '#ffbd6e' : '#ff6ab0', 8);
        // rain
        ctx.strokeStyle = 'rgba(200,210,255,0.12)'; ctx.lineWidth = 1;
        for (let i = 0; i < 160; i++) { const x = rng() * SW, y = rng() * SH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10); ctx.stroke(); }
    },

    dawn(ctx, rng, late) {
        sky(ctx, late ? [[0, '#121838'], [0.35, '#3a3466'], [0.56, '#a8667a']] : [[0, '#3c4c8e'], [0.3, '#8a74a8'], [0.46, '#ee9488'], [0.56, '#ffd28a']]);
        if (late) stars(ctx, rng, 60, 120, 0.6);
        cloud(ctx, 2.2 * U, 1.3 * U, 180, late ? '#6a5a8a' : '#ffb4a8', 0.4);
        cloud(ctx, 9.6 * U, 3.3 * U, 160, late ? '#8a5a7a' : '#ffc4a0', 0.45);
        cloud(ctx, 6.8 * U, 0.9 * U, 120, late ? '#4a4a7a' : '#d4a4c4', 0.35);
        // sea
        water(ctx, 5.0 * U, SH, late ? '#5a4a6a' : '#e8a08a', late ? '#1a1a34' : '#5a5a8a');
        reflection(ctx, rng, 6 * U, 5.05 * U, 7.8 * U, late ? '#e8a0a0' : '#fff0c0', 50);
        // headland
        ctx.fillStyle = late ? '#2a2440' : '#6a5a7a';
        ctx.beginPath(); ctx.moveTo(8.6 * U, 5.02 * U); ctx.quadraticCurveTo(10 * U, 4.4 * U, SW, 4.5 * U); ctx.lineTo(SW, 5.02 * U); ctx.closePath(); ctx.fill();
        // the platform
        const py = 7.7 * U;
        ctx.fillStyle = late ? '#1e1a2a' : '#3e3448';
        ctx.fillRect(0, py, SW, SH - py);
        ctx.fillStyle = late ? '#c8b45a' : '#f0d070'; ctx.fillRect(0, py, SW, 3);
        // lamp post and sign
        ctx.fillStyle = late ? '#14101c' : '#2a2030';
        ctx.fillRect(10.5 * U, 5.4 * U, 4, py - 5.4 * U);
        ctx.fillRect(10.5 * U - 8, 5.4 * U, 20, 4);
        glow(ctx, 10.5 * U + 2, 5.5 * U, 30, late ? 'rgba(255,210,140,0.7)' : 'rgba(255,230,180,0.3)');
        ctx.fillStyle = late ? '#14101c' : '#2a2030';
        ctx.fillRect(0.6 * U, 6.4 * U, 3, py - 6.4 * U); ctx.fillRect(2.4 * U, 6.4 * U, 3, py - 6.4 * U);
        ctx.fillStyle = late ? '#1e3a2e' : '#2a5a46';
        ctx.fillRect(0.5 * U, 6.0 * U, 2.1 * U, 0.5 * U);
        ctx.fillStyle = '#f0ead4'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('TERMINUS', 1.55 * U, 6.34 * U);
        // bench
        ctx.fillStyle = late ? '#1a141c' : '#3a2a30';
        ctx.fillRect(6.6 * U, 7.35 * U, 1.4 * U, 4); ctx.fillRect(6.6 * U, 7.15 * U, 1.4 * U, 3);
        ctx.fillRect(6.7 * U, 7.35 * U, 3, 0.35 * U); ctx.fillRect(7.85 * U, 7.35 * U, 3, 0.35 * U);
    },
};

// ------------------------------------------------------------------ curios (x, y in scene px)

const CURIO_ART = {
    'willow.heron'(ctx, x, y, late) {
        const c = late ? '#7a84a4' : '#5a5a70';
        ctx.strokeStyle = c; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 2, y + 2); ctx.lineTo(x - 3, y + 14); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + 3, y + 14); ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y - 1, 8, 4.5, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x + 5, y - 3); ctx.quadraticCurveTo(x + 10, y - 8, x + 6, y - 12); ctx.quadraticCurveTo(x + 3, y - 16, x + 7, y - 18); ctx.stroke();
        disc(ctx, x + 7.5, y - 18.5, 2.5, c);
        ctx.strokeStyle = '#e0b060'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x + 9, y - 18.5); ctx.lineTo(x + 15, y - 17); ctx.stroke();
        ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y + 14, 8, 1.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    },
    'willow.fox'(ctx, x, y, late) {
        const c = late ? '#8a5a3a' : '#d8743a';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - 12, y + 1, 7, 3, 0.4, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x - 18, y + 3, 2.5, '#f4ecdc');
        ctx.beginPath(); ctx.moveTo(x + 7, y - 2); ctx.lineTo(x + 14, y - 4); ctx.lineTo(x + 16, y - 1); ctx.lineTo(x + 9, y + 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 9, y - 3); ctx.lineTo(x + 10, y - 9); ctx.lineTo(x + 12, y - 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1a14'; disc(ctx, x + 16, y - 1, 1, '#1a1010');
        ctx.fillRect(x - 5, y + 3, 2, 5); ctx.fillRect(x + 5, y + 3, 2, 5);
        grassTufts(ctx, makeRng(9), y - 2, y + 10, 30, late ? '#1a2630' : '#4a5e48');
    },
    'willow.kite'(ctx, x, y, late) {
        ctx.fillStyle = late ? '#8a4a5a' : '#e85a6a';
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = late ? '#c0a050' : '#ffd25a';
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 8, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(240,230,210,0.6)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.quadraticCurveTo(x + 6, y + 22, x - 2, y + 32); ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#ffd25a' : '#e85a6a'; ctx.fillRect(x + 3 - i * 2, y + 18 + i * 5, 3, 2); }
    },
    'willow.star'(ctx, x, y) {
        const g = ctx.createLinearGradient(x - 50, y - 20, x, y);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,250,230,0.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 50, y - 20); ctx.lineTo(x, y); ctx.stroke();
        glow(ctx, x, y, 12, 'rgba(255,250,220,0.9)');
        disc(ctx, x, y, 2, '#fff');
    },

    'quay.boat'(ctx, x, y, late, rng) {
        ctx.fillStyle = late ? '#1e1418' : '#4a2a26';
        ctx.beginPath(); ctx.moveTo(x - 24, y - 3); ctx.quadraticCurveTo(x, y + 8, x + 24, y - 5); ctx.lineTo(x + 20, y + 3); ctx.quadraticCurveTo(x, y + 10, x - 20, y + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = late ? '#2a2026' : '#6a3e30'; ctx.fillRect(x - 18, y - 3, 36, 2);
        ctx.fillStyle = '#1a1214'; ctx.fillRect(x + 14, y - 22, 1.5, 20);
        glow(ctx, x + 15, y - 22, 20, 'rgba(255,190,100,0.7)');
        disc(ctx, x + 15, y - 21, 3, '#ffd27a');
        reflection(ctx, rng, x + 15, y + 6, y + 34, '#ffd27a', 6);
        ctx.fillStyle = late ? '#141014' : '#2a1e22'; ctx.fillRect(x - 6, y - 12, 6, 9); disc(ctx, x - 3, y - 14, 3.5, late ? '#141014' : '#2a1e22');
    },
    'quay.cat'(ctx, x, y, late) {
        // a lit window with a cat sitting in it
        glow(ctx, x, y - 4, 26, 'rgba(255,190,110,0.45)');
        ctx.fillStyle = '#ffcf80'; ctx.fillRect(x - 9, y - 14, 18, 18);
        ctx.fillStyle = late ? '#120e14' : '#1e1418';
        ctx.fillRect(x - 11, y + 4, 22, 3);
        ctx.beginPath(); ctx.ellipse(x - 1, y - 1, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x - 1, y - 8, 3.6, ctx.fillStyle);
        ctx.beginPath(); ctx.moveTo(x - 4.5, y - 9); ctx.lineTo(x - 4, y - 13.5); ctx.lineTo(x - 1.5, y - 10.5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 2.5, y - 9); ctx.lineTo(x + 2, y - 13.5); ctx.lineTo(x - 0.5, y - 10.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.quadraticCurveTo(x + 10, y + 3, x + 8, y + 12); ctx.stroke();
    },
    'quay.umbrella'(ctx, x, y, late) {
        ctx.fillStyle = late ? '#120e18' : '#1e1624';
        ctx.fillRect(x - 2.5, y - 2, 5, 12);
        disc(ctx, x, y - 4, 2.6, ctx.fillStyle);
        ctx.fillStyle = late ? '#a0303a' : '#e8404a';
        ctx.beginPath(); ctx.arc(x + 1, y - 8, 10, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e1624'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 1, y - 8); ctx.lineTo(x + 1, y + 1); ctx.stroke();
    },
    'quay.lantern'(ctx, x, y) {
        glow(ctx, x, y, 36, 'rgba(255,170,80,0.55)');
        ctx.fillStyle = '#ffb86a';
        ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x + 6, y - 8); ctx.lineTo(x + 4.5, y + 8); ctx.lineTo(x - 4.5, y + 8); ctx.closePath(); ctx.fill();
        disc(ctx, x, y + 6, 2.5, '#fff2c0');
    },

    'pine.owl'(ctx, x, y, late) {
        const c = late ? '#4a4038' : '#6a5a48';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 6, y - 7); ctx.lineTo(x - 5, y - 12); ctx.lineTo(x - 2, y - 8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 6, y - 7); ctx.lineTo(x + 5, y - 12); ctx.lineTo(x + 2, y - 8); ctx.closePath(); ctx.fill();
        disc(ctx, x - 3, y - 4, 2.8, '#f0c84a'); disc(ctx, x + 3, y - 4, 2.8, '#f0c84a');
        disc(ctx, x - 3, y - 4, 1.2, '#1a1008'); disc(ctx, x + 3, y - 4, 1.2, '#1a1008');
        ctx.fillStyle = '#c09040'; ctx.beginPath(); ctx.moveTo(x - 1, y - 1.5); ctx.lineTo(x + 1, y - 1.5); ctx.lineTo(x, y + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    },
    'pine.deer'(ctx, x, y, late) {
        const c = late ? '#3a3040' : '#6a5050';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y, 11, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        for (const lx of [-7, -4, 5, 8]) ctx.fillRect(x + lx, y + 2, 1.8, 11);
        ctx.beginPath(); ctx.moveTo(x + 7, y - 2); ctx.lineTo(x + 12, y - 13); ctx.lineTo(x + 15, y - 12); ctx.lineTo(x + 11, y + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 15, y - 13, 4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x + 13, y - 15); ctx.lineTo(x + 10, y - 23); ctx.lineTo(x + 7, y - 25); ctx.moveTo(x + 10, y - 21); ctx.lineTo(x + 13, y - 24);
        ctx.moveTo(x + 15, y - 15); ctx.lineTo(x + 17, y - 23); ctx.lineTo(x + 20, y - 25); ctx.moveTo(x + 17, y - 20); ctx.lineTo(x + 14, y - 23); ctx.stroke();
        disc(ctx, x - 11, y - 2, 2, 'rgba(240,230,220,0.6)');
    },
    'pine.fire'(ctx, x, y) {
        glow(ctx, x, y, 50, 'rgba(255,140,60,0.5)');
        ctx.fillStyle = '#3a2418';
        ctx.save(); ctx.translate(x, y + 5); ctx.rotate(0.3); ctx.fillRect(-11, -2, 22, 4); ctx.rotate(-0.6); ctx.fillRect(-11, -2, 22, 4); ctx.restore();
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x - 6, y - 6, x, y - 14); ctx.quadraticCurveTo(x + 5, y - 6, x + 7, y + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd25a';
        ctx.beginPath(); ctx.moveTo(x - 3.5, y + 4); ctx.quadraticCurveTo(x - 3, y - 2, x, y - 7); ctx.quadraticCurveTo(x + 3, y - 2, x + 3.5, y + 4); ctx.closePath(); ctx.fill();
        for (const [dx, dy] of [[-4, -18], [3, -22], [0, -27]]) disc(ctx, x + dx, y + dy, 0.9, '#ffc06a');
    },
    'pine.aurora'(ctx, x, y) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 70; i++) {
            const t = i / 70;
            const ax = x - 180 + t * 360, ay = y + Math.sin(t * 7) * 14 + Math.sin(t * 17) * 4;
            const g = ctx.createLinearGradient(0, ay - 40, 0, ay + 30);
            g.addColorStop(0, 'rgba(120,80,200,0)'); g.addColorStop(0.5, `rgba(90,240,180,${0.1 + 0.08 * Math.sin(t * 30)})`); g.addColorStop(1, 'rgba(60,200,160,0)');
            ctx.fillStyle = g;
            ctx.fillRect(ax, ay - 40, 6, 70);
        }
        ctx.restore();
    },

    'mill.wheel'(ctx, x, y, late) {
        const c = late ? '#2a2026' : '#5a4038';
        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.stroke();
            ctx.fillStyle = c; ctx.fillRect(x + Math.cos(a) * 22 - 3, y + Math.sin(a) * 22 - 3, 6, 6);
        }
        disc(ctx, x, y, 3.5, c);
        ctx.fillStyle = 'rgba(200,220,255,0.35)';
        for (let i = 0; i < 8; i++) disc(ctx, x + 10 + i * 2, y + 22 - i * 0.5 + (i % 2) * 2, 1.5, ctx.fillStyle);
    },
    'mill.ducks'(ctx, x, y, late) {
        for (const [dx, dy, k] of [[-12, 0, 1], [2, 3, 0.9], [14, -1, 0.8]]) {
            const cx = x + dx, cy = y + dy;
            ctx.fillStyle = late ? '#4a4a40' : '#8a7a5a';
            ctx.beginPath(); ctx.ellipse(cx, cy, 7 * k, 3.5 * k, 0, 0, Math.PI * 2); ctx.fill();
            disc(ctx, cx + 4 * k, cy - 2.5 * k, 2.6 * k, late ? '#2a4a3a' : '#3a7a5a');
            ctx.globalAlpha = 0.35; ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.ellipse(cx, cy + 3, 9 * k, 1.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        }
    },
    'mill.angler'(ctx, x, y, late) {
        const c = late ? '#0e1420' : '#1e2638';
        ctx.fillStyle = c;
        ctx.fillRect(x - 4, y - 8, 8, 10);
        disc(ctx, x, y - 11, 3.2, c);
        ctx.fillStyle = late ? '#3a3020' : '#6a5030'; ctx.beginPath(); ctx.arc(x, y - 12, 4.5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = c; ctx.fillRect(x - 6, y + 1, 12, 3);
        ctx.strokeStyle = c; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x - 26, y - 22); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,230,255,0.4)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x - 26, y - 22); ctx.lineTo(x - 30, y + 12); ctx.stroke();
        disc(ctx, x - 30, y + 12, 1.4, '#ff6a4a');
    },
    'mill.fireflies'(ctx, x, y, late, rng) {
        for (let i = 0; i < 16; i++) {
            const fx = x + (rng() - 0.5) * 50, fy = y + (rng() - 0.5) * 30;
            glow(ctx, fx, fy, 6, 'rgba(220,255,120,0.8)');
            disc(ctx, fx, fy, 1, '#f4ffc0');
        }
    },

    'harbor.light'(ctx, x, y, late) {
        ctx.fillStyle = '#e8e4dc';
        ctx.beginPath(); ctx.moveTo(x - 7, y + 26); ctx.lineTo(x - 4.5, y - 10); ctx.lineTo(x + 4.5, y - 10); ctx.lineTo(x + 7, y + 26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c84a4a';
        ctx.fillRect(x - 6.4, y + 14, 12.8, 5); ctx.fillRect(x - 5.4, y, 10.8, 5);
        ctx.fillStyle = '#2a2a34'; ctx.fillRect(x - 6, y - 12, 12, 2); ctx.fillRect(x - 4, y - 20, 8, 2);
        glow(ctx, x, y - 15, 28, 'rgba(255,240,180,0.9)');
        ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 3.5, y - 18, 7, 6);
        ctx.fillStyle = '#2a2a34'; ctx.beginPath(); ctx.moveTo(x - 5, y - 20); ctx.lineTo(x, y - 25); ctx.lineTo(x + 5, y - 20); ctx.closePath(); ctx.fill();
    },
    'harbor.sail'(ctx, x, y, late, rng) {
        ctx.fillStyle = '#0a0e18';
        ctx.beginPath(); ctx.moveTo(x - 14, y + 4); ctx.lineTo(x + 14, y + 4); ctx.lineTo(x + 10, y + 9); ctx.lineTo(x - 10, y + 9); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 0.8, y - 22, 1.6, 26);
        ctx.fillStyle = late ? '#8a94b0' : '#c4cce0';
        ctx.beginPath(); ctx.moveTo(x + 1, y - 21); ctx.lineTo(x + 12, y + 2); ctx.lineTo(x + 1, y + 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 1, y - 16); ctx.lineTo(x - 9, y + 2); ctx.lineTo(x - 1, y + 2); ctx.closePath(); ctx.fill();
        glow(ctx, x, y - 22, 8, 'rgba(255,90,90,0.9)');
        reflection(ctx, rng, x, y + 10, y + 30, '#c4cce0', 10);
    },
    'harbor.gull'(ctx, x, y, late) {
        ctx.fillStyle = late ? '#c8ccd8' : '#eef0f4';
        ctx.beginPath(); ctx.ellipse(x, y - 4, 6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x + 4.5, y - 7, 2.4, ctx.fillStyle);
        ctx.fillStyle = '#6a7080'; ctx.beginPath(); ctx.ellipse(x - 1.5, y - 4.5, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0b040'; ctx.fillRect(x + 6.5, y - 7.2, 3, 1);
        ctx.fillStyle = '#e09040'; ctx.fillRect(x - 1, y - 1, 1, 3); ctx.fillRect(x + 1.5, y - 1, 1, 3);
    },
    'harbor.whale'(ctx, x, y) {
        ctx.fillStyle = '#1a2436';
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 4); ctx.quadraticCurveTo(x - 1, y - 6, x - 3, y - 10);
        ctx.quadraticCurveTo(x - 14, y - 12, x - 18, y - 20); ctx.quadraticCurveTo(x - 6, y - 18, x, y - 14);
        ctx.quadraticCurveTo(x + 6, y - 18, x + 18, y - 20); ctx.quadraticCurveTo(x + 14, y - 12, x + 3, y - 10);
        ctx.quadraticCurveTo(x + 1, y - 6, x + 2, y + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y + 4, 14, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(220,235,255,0.5)';
        for (let i = 0; i < 6; i++) disc(ctx, x - 14 + i * 1.2, y - 18 + i * 3, 0.9, ctx.fillStyle);
    },

    'snow.snowman'(ctx, x, y) {
        disc(ctx, x, y + 6, 10, '#f4f8ff');
        disc(ctx, x, y - 7, 7, '#f4f8ff');
        ctx.fillStyle = 'rgba(120,140,180,0.25)'; ctx.beginPath(); ctx.arc(x + 2, y + 7, 9, -0.5, 1.6); ctx.fill();
        ctx.fillStyle = '#2a2a34'; ctx.fillRect(x - 6, y - 15, 12, 2); ctx.fillRect(x - 4, y - 22, 8, 7);
        disc(ctx, x - 2.5, y - 8, 1, '#1a1a1a'); disc(ctx, x + 2.5, y - 8, 1, '#1a1a1a');
        ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y - 5); ctx.lineTo(x, y - 4.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8404a'; ctx.fillRect(x - 6, y - 2, 12, 2.5); ctx.fillRect(x + 2, y - 1, 2.5, 7);
        ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 8, y + 1); ctx.lineTo(x - 16, y - 6); ctx.moveTo(x + 8, y + 1); ctx.lineTo(x + 16, y - 5); ctx.stroke();
    },
    'snow.sled'(ctx, x, y) {
        ctx.fillStyle = '#b04a3a';
        ctx.fillRect(x - 13, y - 5, 24, 4);
        ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 14, y + 1); ctx.lineTo(x + 12, y + 1); ctx.quadraticCurveTo(x + 17, y + 1, x + 16, y - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 9, y - 1); ctx.lineTo(x - 9, y + 1); ctx.moveTo(x + 6, y - 1); ctx.lineTo(x + 6, y + 1); ctx.stroke();
        ctx.strokeStyle = '#c4a060'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x + 14, y - 4); ctx.quadraticCurveTo(x + 22, y + 2, x + 26, y - 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(100,120,160,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 14, y + 3); ctx.lineTo(x - 60, y - 6); ctx.moveTo(x + 2, y + 3); ctx.lineTo(x - 44, y - 6); ctx.stroke();
    },
    'snow.hare'(ctx, x, y) {
        ctx.fillStyle = '#f8faff';
        ctx.beginPath(); ctx.ellipse(x, y, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x + 5, y - 3, 3, '#f8faff');
        ctx.beginPath(); ctx.ellipse(x + 4.5, y - 9, 1.2, 4, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 6.5, y - 9, 1.2, 4, 0.2, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x + 6.5, y - 3.5, 0.8, '#2a2a3a');
        ctx.fillStyle = 'rgba(100,120,160,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4.5, 7, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    },
    'snow.reindeer'(ctx, x, y) {
        const c = '#3a2e2e';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        for (const lx of [-7, -4, 5, 8]) ctx.fillRect(x + lx, y + 2, 1.8, 10);
        ctx.beginPath(); ctx.moveTo(x + 6, y - 2); ctx.lineTo(x + 10, y - 12); ctx.lineTo(x + 13, y - 11); ctx.lineTo(x + 10, y + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 13, y - 12, 4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 11, y - 14); ctx.lineTo(x + 6, y - 24); ctx.moveTo(x + 8, y - 19); ctx.lineTo(x + 4, y - 20); ctx.moveTo(x + 7, y - 22); ctx.lineTo(x + 10, y - 26);
        ctx.moveTo(x + 13, y - 14); ctx.lineTo(x + 16, y - 25); ctx.moveTo(x + 15, y - 21); ctx.lineTo(x + 19, y - 23);
        ctx.stroke();
        disc(ctx, x + 16.5, y - 11.5, 1.3, '#ff5a4a');
    },

    'city.reader'(ctx, x, y) {
        glow(ctx, x, y, 40, 'rgba(255,190,110,0.5)');
        ctx.fillStyle = '#ffcf86'; ctx.fillRect(x - 14, y - 12, 28, 22);
        ctx.fillStyle = '#e0a060'; ctx.fillRect(x - 14, y - 12, 28, 3);
        ctx.fillStyle = '#2a1e22';
        ctx.fillRect(x - 15, y - 13, 30, 1.5); ctx.fillRect(x - 15, y + 10, 30, 2); ctx.fillRect(x - 0.6, y - 12, 1.2, 22);
        // the reader in an armchair
        ctx.fillStyle = '#5a3a3a'; ctx.fillRect(x - 11, y - 1, 9, 11);
        ctx.fillStyle = '#2a1e22'; disc(ctx, x - 6, y - 4, 2.8, '#2a1e22'); ctx.fillRect(x - 8, y - 1, 5, 8);
        ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 4, y - 1, 4, 3);
        // lamp
        ctx.fillStyle = '#2a1e22'; ctx.fillRect(x + 8, y - 4, 1, 14);
        ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.moveTo(x + 5, y - 3); ctx.lineTo(x + 12, y - 3); ctx.lineTo(x + 10, y - 8); ctx.lineTo(x + 7, y - 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a7a4a'; disc(ctx, x + 4, y + 5, 2, '#4a7a4a');
    },
    'city.cat'(ctx, x, y) {
        ctx.fillStyle = '#08060c';
        ctx.beginPath(); ctx.ellipse(x - 2, y + 1, 5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
        disc(ctx, x - 2, y - 7, 3.8, '#08060c');
        ctx.beginPath(); ctx.moveTo(x - 5.5, y - 8); ctx.lineTo(x - 5, y - 13); ctx.lineTo(x - 2.5, y - 10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 1.5, y - 8); ctx.lineTo(x + 1, y - 13); ctx.lineTo(x - 1.5, y - 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#08060c'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x + 2, y + 5); ctx.quadraticCurveTo(x + 10, y + 6, x + 9, y + 14); ctx.stroke();
        disc(ctx, x - 3.4, y - 7.5, 0.8, '#d0f060'); disc(ctx, x - 0.6, y - 7.5, 0.8, '#d0f060');
    },
    'city.cafe'(ctx, x, y) {
        glow(ctx, x, y + 6, 60, 'rgba(255,120,190,0.35)');
        ctx.fillStyle = '#ffd8a0'; ctx.fillRect(x - 22, y + 2, 44, 16);
        ctx.fillStyle = '#2a1e2a'; ctx.fillRect(x - 24, y, 48, 2); ctx.fillRect(x - 1, y + 2, 2, 16);
        ctx.fillStyle = '#4a2a2a'; disc(ctx, x - 12, y + 12, 2.6, '#3a2228'); ctx.fillRect(x - 14, y + 13, 5, 5);
        disc(ctx, x + 12, y + 11, 2.4, '#3a2228'); ctx.fillRect(x + 10, y + 12, 5, 6);
        ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center';
        ctx.shadowColor = '#ff5ab0'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffb4e0'; ctx.fillText('CAFÉ', x, y - 5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#c84a5a';
        for (let i = 0; i < 6; i++) ctx.fillRect(x - 24 + i * 8, y - 1, 4, 3);
    },
    'city.balloon'(ctx, x, y) {
        ctx.strokeStyle = 'rgba(230,230,240,0.6)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.quadraticCurveTo(x + 5, y + 18, x - 2, y + 28); ctx.stroke();
        ctx.fillStyle = '#e8384a';
        ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(x - 2.5, y - 3, 1.6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    },

    'dawn.sun'(ctx, x, y, late) {
        if (late) {
            glow(ctx, x, y + 4, 90, 'rgba(255,170,140,0.5)');
            ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - 40, 80, 40 + 0.25 * U); ctx.clip();
            disc(ctx, x, y + 14, 16, '#ffb08a'); ctx.restore();
            return;
        }
        glow(ctx, x, y, 140, 'rgba(255,230,160,0.8)');
        ctx.save(); ctx.beginPath(); ctx.rect(x - 60, y - 60, 120, 60 + 0.25 * U); ctx.clip();
        disc(ctx, x, y + 6, 22, '#fff2c8'); ctx.restore();
    },
    'dawn.balloon'(ctx, x, y, late) {
        const stripes = late ? ['#a85a6a', '#d0b070', '#5a7aa0'] : ['#ff6a5a', '#ffd25a', '#5ab0e8'];
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = stripes[i % 3];
            ctx.beginPath(); ctx.ellipse(x, y, 13 - i * 2.6, 15, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = stripes[0];
        ctx.beginPath(); ctx.moveTo(x - 9, y + 9); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x + 3, y + 18); ctx.lineTo(x - 3, y + 18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x - 3, y + 18); ctx.lineTo(x - 3, y + 22); ctx.moveTo(x + 3, y + 18); ctx.lineTo(x + 3, y + 22); ctx.stroke();
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 3.5, y + 22, 7, 5);
    },
    'dawn.birds'(ctx, x, y, late) {
        ctx.strokeStyle = late ? '#2a2440' : '#4a3a5a'; ctx.lineWidth = 1.3;
        for (const [dx, dy, s] of [[-14, 4, 1], [-6, -2, 1.1], [3, 6, 0.9], [10, -4, 1], [17, 2, 0.8], [-1, 12, 0.8]]) {
            const bx = x + dx, by = y + dy;
            ctx.beginPath(); ctx.moveTo(bx - 4 * s, by - 2 * s); ctx.quadraticCurveTo(bx - 2 * s, by - 3 * s, bx, by); ctx.quadraticCurveTo(bx + 2 * s, by - 3 * s, bx + 4 * s, by - 2 * s); ctx.stroke();
        }
    },
    'dawn.rainbow'(ctx, x, y) {
        const cols = ['255,90,90', '255,170,80', '255,230,110', '120,220,120', '100,170,255', '170,120,230'];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        cols.forEach((c, i) => {
            ctx.strokeStyle = `rgba(${c},0.22)`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(x, y + 120, 120 - i * 4, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        });
        ctx.restore();
    },
};

export const CURIO_IDS = Object.keys(CURIO_ART);
