// Every texture in CUE VICE is painted at load on a 2D canvas: floors, the
// characters' skins, signs, crates, leaves, icons. Nothing is downloaded.

import * as THREE from 'three';
import { hash01 } from '../rng.js';

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

export function tex(c, { repeat = false, srgb = true, nearest = false } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    if (nearest) { t.magFilter = THREE.NearestFilter; }
    t.anisotropy = 4;
    return t;
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export const cssOf = (c) => (typeof c === 'number' ? hex(c) : c);

function shade(col, k) {
    const c = new THREE.Color(cssOf(col));
    c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
    return '#' + c.getHexString();
}

// ------------------------------------------------------------------ floors
const PX = 64;   // pixels per tile in the floor atlas

/**
 * Paint the whole level floor into one canvas (color) and one emissive canvas.
 * Returns { map, emissive } textures; UV (x / w, 1 - y / h) addresses tile (x, y).
 */
export function paintFloor(L, def, S) {
    const W = L.w * PX, H = L.h * PX;
    const c = canvas(W, H), g = c.getContext('2d');
    const e = canvas(W, H), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
    for (let y = 0; y < L.h; y++) {
        for (let x = 0; x < L.w; x++) {
            const i = y * L.w + x;
            const px = x * PX, py = y * PX;
            const style = L.floor[i];
            paintTile(g, ge, style, px, py, x, y, def);
            const t = S.tiles[i];
            if (t === 11) paintOil(g, px, py, x, y);
        }
    }
    // exit chevrons and markings
    for (const ex of L.exits) {
        const px = (ex.x - 0.5) * PX, py = (ex.y - 0.5) * PX;
        ge.save();
        ge.strokeStyle = '#ff3fa4'; ge.lineWidth = 5; ge.shadowColor = '#ff3fa4'; ge.shadowBlur = 8;
        ge.strokeRect(px + 4, py + 4, PX - 8, PX - 8);
        ge.fillStyle = '#ff60b8';
        for (let k = 0; k < 2; k++) {
            ge.beginPath();
            const cy = py + 18 + k * 18;
            ge.moveTo(px + 16, cy + 10); ge.lineTo(px + 32, cy); ge.lineTo(px + 48, cy + 10); ge.lineTo(px + 48, cy + 16); ge.lineTo(px + 32, cy + 6); ge.lineTo(px + 16, cy + 16);
            ge.fill();
        }
        ge.restore();
        g.fillStyle = 'rgba(255,63,164,0.25)'; g.fillRect(px, py, PX, PX);
    }
    // soft shadow along walls (ambient occlusion)
    g.save();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const t = S.tiles[y * L.w + x];
        if (t !== 1 && t !== 2 && t !== 4) continue;
        const px = x * PX, py = y * PX;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
            const nt = S.tiles[ny * L.w + nx];
            if (nt === 1 || nt === 2 || nt === 4 || nt === 8 || nt === 7) continue;
            const gx0 = ox === 1 ? px + PX : ox === -1 ? px - 18 : px;
            const gy0 = oy === 1 ? py + PX : oy === -1 ? py - 18 : py;
            const grd = g.createLinearGradient(
                ox === 1 ? px + PX : ox === -1 ? px : 0, oy === 1 ? py + PX : oy === -1 ? py : 0,
                ox === 1 ? px + PX + 18 : ox === -1 ? px - 18 : 0, oy === 1 ? py + PX + 18 : oy === -1 ? py - 18 : 0);
            grd.addColorStop(0, 'rgba(0,0,0,0.38)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd;
            g.fillRect(gx0, gy0, ox ? 18 : PX, oy ? 18 : PX);
        }
    }
    g.restore();
    const map = tex(c), emissive = tex(e);
    return { map, emissive, canvas: c, ecanvas: e };
}

function noise(g, px, py, n, col, a, size, seed) {
    g.fillStyle = col;
    for (let k = 0; k < n; k++) {
        const r1 = hash01(seed * 131 + k * 7), r2 = hash01(seed * 17 + k * 13 + 5), r3 = hash01(seed + k * 3 + 9);
        g.globalAlpha = a * (0.4 + r3 * 0.6);
        g.fillRect(px + r1 * PX, py + r2 * PX, size, size);
    }
    g.globalAlpha = 1;
}

function paintTile(g, ge, style, px, py, x, y, def) {
    const seed = x * 73856093 ^ y * 19349663;
    const r = (k) => hash01(seed + k * 977);
    switch (style) {
        case 'asphalt': {
            g.fillStyle = shade('#3a3846', 0.9 + r(1) * 0.15); g.fillRect(px, py, PX, PX);
            noise(g, px, py, 60, '#6a6878', 0.5, 2, seed);
            noise(g, px, py, 30, '#1a1820', 0.6, 2, seed + 1);
            if (r(2) < 0.08) { g.strokeStyle = 'rgba(10,10,14,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + r(3) * PX, py); g.lineTo(px + r(4) * PX, py + PX); g.stroke(); }
            if (x % 3 === 0 && def.id !== 'causeway') { g.fillStyle = 'rgba(255,255,240,0.55)'; g.fillRect(px, py + 6, 3, PX - 12); }
            if (def.id === 'causeway' && (y === 7 || y === 11) && x % 2 === 0) { g.fillStyle = '#fff4c0'; g.fillRect(px + 6, py + PX - 4, PX - 12, 5); }
            if (def.id === 'causeway' && y === 8 && true) { g.fillStyle = '#ffd040'; g.fillRect(px, py + PX - 6, PX, 3); g.fillRect(px, py + PX - 1, PX, 1); }
            break;
        }
        case 'dock': {
            g.fillStyle = '#8a6448'; g.fillRect(px, py, PX, PX);
            for (let k = 0; k < 4; k++) {
                const yy = py + k * 16;
                g.fillStyle = shade('#a07856', 0.8 + hash01(seed + k * 31) * 0.35);
                g.fillRect(px, yy + 1, PX, 14);
                g.fillStyle = 'rgba(60,36,24,0.35)';
                for (let q = 0; q < 3; q++) g.fillRect(px + hash01(seed + k * 5 + q) * PX, yy + 4 + q * 3, 18, 1);
                g.fillStyle = '#3a281c'; g.fillRect(px + ((x + k) % 2) * 32 + 2, yy + 6, 2, 2);
            }
            break;
        }
        case 'deck': {
            g.fillStyle = '#d8b890'; g.fillRect(px, py, PX, PX);
            for (let k = 0; k < 5; k++) {
                g.fillStyle = shade('#e8c8a0', 0.88 + hash01(seed + k * 11) * 0.18);
                g.fillRect(px + k * 13, py, 12, PX);
            }
            break;
        }
        case 'concrete': {
            g.fillStyle = shade('#a8a4ac', 0.92 + r(1) * 0.1); g.fillRect(px, py, PX, PX);
            noise(g, px, py, 40, '#7a7680', 0.5, 2, seed);
            g.strokeStyle = 'rgba(60,56,64,0.45)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, PX - 1, PX - 1);
            if (r(5) < 0.06) { g.fillStyle = 'rgba(30,24,30,0.35)'; g.beginPath(); g.ellipse(px + 32, py + 32, 18, 10, r(6) * 3, 0, 7); g.fill(); }
            break;
        }
        case 'checker': {
            const cols = ['#ff3fa4', '#2ff2e0', '#b44cff', '#ffe45c'];
            for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
                const ci = Math.floor(hash01(seed + qx * 3 + qy * 7) * 4);
                const on = (x * 2 + qx + y * 2 + qy) % 2 === 0;
                g.fillStyle = on ? shade(cols[ci], 0.45) : '#140818';
                g.fillRect(px + qx * 32 + 1, py + qy * 32 + 1, 30, 30);
                if (on) { ge.fillStyle = shade(cols[ci], 0.55); ge.fillRect(px + qx * 32 + 3, py + qy * 32 + 3, 26, 26); }
            }
            break;
        }
        case 'club': {
            g.fillStyle = '#24102e'; g.fillRect(px, py, PX, PX);
            const cols = ['#ff3fa4', '#2ff2e0', '#ffe45c', '#b44cff'];
            for (let k = 0; k < 3; k++) {
                g.strokeStyle = cols[Math.floor(r(k + 10) * 4)]; g.globalAlpha = 0.35; g.lineWidth = 2;
                g.beginPath();
                const sx = px + r(k + 20) * PX, sy = py + r(k + 30) * PX;
                g.moveTo(sx, sy);
                g.bezierCurveTo(sx + 10, sy - 12, sx + 16, sy + 12, sx + 26, sy);
                g.stroke();
                g.fillStyle = cols[Math.floor(r(k + 40) * 4)];
                g.fillRect(px + r(k + 50) * PX, py + r(k + 60) * PX, 4, 4);
            }
            g.globalAlpha = 1;
            break;
        }
        case 'marble': {
            g.fillStyle = shade('#f4ece8', 0.96 + r(1) * 0.05); g.fillRect(px, py, PX, PX);
            g.strokeStyle = 'rgba(200,170,190,0.55)'; g.lineWidth = 1.2;
            for (let k = 0; k < 2; k++) {
                g.beginPath(); g.moveTo(px, py + r(k + 3) * PX);
                g.quadraticCurveTo(px + 32, py + r(k + 5) * PX, px + PX, py + r(k + 7) * PX); g.stroke();
            }
            g.strokeStyle = 'rgba(160,140,150,0.4)'; g.strokeRect(px + 0.5, py + 0.5, PX - 1, PX - 1);
            break;
        }
        case 'tile': {
            const a = '#f4c8d8', b = '#c8f0e4';
            for (let qy = 0; qy < 4; qy++) for (let qx = 0; qx < 4; qx++) {
                g.fillStyle = (qx + qy) % 2 ? a : b;
                g.fillRect(px + qx * 16, py + qy * 16, 16, 16);
            }
            g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
            for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(px + k * 16, py); g.lineTo(px + k * 16, py + PX); g.moveTo(px, py + k * 16); g.lineTo(px + PX, py + k * 16); g.stroke(); }
            break;
        }
        case 'lino': {
            g.fillStyle = def.id === 'hospital' ? '#a8dccf' : def.id === 'precinct' ? '#b8b4a0' : '#9aa0b8';
            g.fillRect(px, py, PX, PX);
            noise(g, px, py, 50, '#ffffff', 0.35, 2, seed);
            noise(g, px, py, 30, '#506070', 0.3, 2, seed + 3);
            g.strokeStyle = 'rgba(80,90,100,0.25)'; g.strokeRect(px + 0.5, py + 0.5, PX - 1, PX - 1);
            break;
        }
        case 'carpet': {
            const base = def.id === 'hospital' ? '#5a7aa0' : def.id === 'station' ? '#3a2a5a' : '#6a2a3a';
            g.fillStyle = base; g.fillRect(px, py, PX, PX);
            noise(g, px, py, 80, shade(base, 1.4), 0.4, 2, seed);
            g.strokeStyle = shade(base, 1.6); g.globalAlpha = 0.4; g.lineWidth = 2;
            g.beginPath(); g.moveTo(px, py + 32); g.lineTo(px + 32, py); g.lineTo(px + 64, py + 32); g.lineTo(px + 32, py + 64); g.closePath(); g.stroke();
            g.globalAlpha = 1;
            break;
        }
        case 'grass': {
            const stripe = Math.floor(x / 2) % 2;
            g.fillStyle = stripe ? '#4a9a52' : '#3f8a48'; g.fillRect(px, py, PX, PX);
            noise(g, px, py, 70, '#6ac070', 0.5, 2, seed);
            noise(g, px, py, 40, '#2a6a30', 0.5, 2, seed + 7);
            break;
        }
        case 'sand': {
            g.fillStyle = shade('#e8d0a0', 0.95 + r(1) * 0.08); g.fillRect(px, py, PX, PX);
            noise(g, px, py, 70, '#c8a878', 0.5, 2, seed);
            noise(g, px, py, 30, '#fff4dc', 0.6, 2, seed + 1);
            if (r(8) < 0.1) { g.fillStyle = '#f4f0e8'; g.beginPath(); g.ellipse(px + r(9) * PX, py + r(10) * PX, 4, 3, 0, 0, 7); g.fill(); }
            break;
        }
        case 'metal': {
            g.fillStyle = '#7a8088'; g.fillRect(px, py, PX, PX);
            g.fillStyle = '#9aa0a8';
            for (let qy = 0; qy < 8; qy++) for (let qx = 0; qx < 8; qx++) {
                if ((qx + qy) % 2) continue;
                g.save(); g.translate(px + qx * 8 + 4, py + qy * 8 + 4); g.rotate(qy % 2 ? 0.7 : -0.7); g.fillRect(-3, -1, 6, 2); g.restore();
            }
            break;
        }
        default:
            g.fillStyle = '#888'; g.fillRect(px, py, PX, PX);
    }
}

function paintOil(g, px, py, x, y) {
    const grd = g.createRadialGradient(px + 32, py + 32, 4, px + 32, py + 32, 34);
    grd.addColorStop(0, 'rgba(10,8,14,0.95)'); grd.addColorStop(0.6, 'rgba(30,20,50,0.85)'); grd.addColorStop(0.85, 'rgba(80,40,140,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(px + 32, py + 32, 34, 28, hash01(x * 7 + y) * 3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,220,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(px + 28, py + 30, 14, 8, 0.3, 0, 5); g.stroke();
    g.strokeStyle = 'rgba(255,120,220,0.3)';
    g.beginPath(); g.ellipse(px + 36, py + 36, 10, 5, -0.2, 0, 5); g.stroke();
}

// ------------------------------------------------------------------ characters
/**
 * Equirectangular skin for a ball-shaped character. The face is centred at
 * u = 0.25 (three.js SphereGeometry's +Z), the top row is the crown.
 */
export function paintBallSkin(look, kind) {
    const W = 512, H = 256;
    const c = canvas(W, H), g = c.getContext('2d');
    const F = 128;   // face centre x
    // rows map to the angle from the crown: row r is r/256*180 degrees. The
    // camera looks down ~33 degrees off vertical, so the face sits between
    // rows 30 and 90 and the collar right below it, where the camera sees them.
    const NECK = 96;
    const suit = look.jacket ?? look.suit ?? '#888';
    const shirt = look.shirt ?? '#fff';
    const sg = g.createLinearGradient(0, NECK, 0, H);
    sg.addColorStop(0, shade(suit, 1.08)); sg.addColorStop(1, shade(suit, 0.7));
    g.fillStyle = sg; g.fillRect(0, NECK - 2, W, H - NECK + 2);
    // v-neck shirt at the front, lapels either side
    g.fillStyle = shirt;
    g.beginPath(); g.moveTo(F - 50, NECK); g.lineTo(F + 50, NECK); g.lineTo(F, NECK + 80); g.closePath(); g.fill();
    g.fillStyle = shade(suit, 0.78);
    g.beginPath(); g.moveTo(F - 56, NECK); g.lineTo(F - 36, NECK); g.lineTo(F - 6, NECK + 72); g.lineTo(F - 26, NECK + 72); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(F + 56, NECK); g.lineTo(F + 36, NECK); g.lineTo(F + 6, NECK + 72); g.lineTo(F + 26, NECK + 72); g.closePath(); g.fill();
    // a pocket square and buttons
    g.fillStyle = shirt; g.fillRect(F + 60, NECK + 34, 16, 8);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (const y of [NECK + 90, NECK + 112]) { g.beginPath(); g.arc(F, y, 3, 0, 7); g.fill(); }
    if (look.chain) {
        g.strokeStyle = '#ffd040'; g.lineWidth = 4;
        g.beginPath(); g.arc(F, NECK - 8, 40, 0.35, Math.PI - 0.35); g.stroke();
        g.fillStyle = '#ffe890'; g.beginPath(); g.arc(F, NECK + 32, 6, 0, 7); g.fill();
    }
    if (kind === 'cop') {
        g.fillStyle = '#ffd040'; star(g, F + 34, NECK + 30, 9); g.fill();
        g.fillStyle = '#c8d0ff'; g.fillRect(F - 54, NECK + 40, 20, 6);
    }
    if (kind === 'vip') {
        g.fillStyle = '#c8e0ff'; g.fillRect(0, NECK, W, H - NECK);
        g.fillStyle = '#7aa0d8';
        for (let k = 0; k < 90; k++) { g.beginPath(); g.arc(hash01(k) * W, NECK + 6 + hash01(k + 50) * 150, 3, 0, 7); g.fill(); }
    }
    if (look.fin) {
        g.globalAlpha = 0.22;
        for (let k = 0; k < 48; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#404858'; g.fillRect(0, NECK + k * 3.4, W, 1.5); }
        g.globalAlpha = 1;
    }
    // head
    g.fillStyle = look.skin ?? '#d8a080';
    g.fillRect(0, 0, W, NECK);
    const sk = g.createLinearGradient(0, NECK - 16, 0, NECK);
    sk.addColorStop(0, 'rgba(0,0,0,0)'); sk.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = sk; g.fillRect(0, NECK - 16, W, 16);
    // hair: a cap over the crown, longer at the back, a fringe at the front
    const hair = look.hair ?? '#222';
    g.fillStyle = hair;
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 8) {
        const dxF = Math.min(Math.abs(x - F), W - Math.abs(x - F));
        const front = Math.max(0, 1 - dxF / 80);
        let yy = 22 + (1 - front) * 30 - front * 4;
        if (look.hairStyle === 'big' || look.hairStyle === 'pony') yy += (1 - front) * 22;
        if (look.hairStyle === 'mohawk' || look.hairStyle === 'cap') yy = 16 + (1 - front) * 14;
        if (look.hairStyle === 'flat') yy = 18 + (1 - front) * 22;
        g.lineTo(x, yy + Math.sin(x * 0.3) * 1.5);
    }
    g.lineTo(W, 0); g.closePath(); g.fill();
    g.fillRect(F - 64, 18, 9, 30); g.fillRect(F + 55, 18, 9, 30);
    // face
    const eyesY = 44;
    if (look.stubble) { g.fillStyle = 'rgba(40,20,10,0.25)'; g.beginPath(); g.ellipse(F, 76, 46, 14, 0, 0, 7); g.fill(); }
    if (look.beard) { g.fillStyle = hair; g.beginPath(); g.ellipse(F, 78, 54, 18, 0, 0, Math.PI); g.fill(); g.fillRect(F - 54, 66, 108, 12); }
    if (look.blush || look.earrings) { g.fillStyle = 'rgba(255,90,140,0.35)'; g.beginPath(); g.arc(F - 34, 62, 9, 0, 7); g.arc(F + 34, 62, 9, 0, 7); g.fill(); }
    if (!look.glasses && !look.shades) {
        for (const s2 of [-1, 1]) {
            g.fillStyle = '#fff'; g.beginPath(); g.ellipse(F + s2 * 20, eyesY, 9, 8, 0, 0, 7); g.fill();
            g.fillStyle = '#1a1420'; g.beginPath(); g.arc(F + s2 * 20, eyesY + 1, 5, 0, 7); g.fill();
            g.fillStyle = '#fff'; g.fillRect(F + s2 * 20 + 1, eyesY - 2, 2, 2);
            g.strokeStyle = shade(hair, 0.8); g.lineWidth = 3.5; g.beginPath(); g.moveTo(F + s2 * 11, eyesY - 13 + (kind === 'foe' ? 4 : 0)); g.lineTo(F + s2 * 30, eyesY - 14); g.stroke();
        }
    } else paintGlasses(g, look.glasses ?? 'shades', F, eyesY);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(F + 2, 57, 5, 6, 0, 0, 7); g.fill();
    g.strokeStyle = kind === 'foe' ? '#5a2a20' : '#7a3030'; g.lineWidth = 3;
    g.beginPath();
    if (kind === 'foe') { g.moveTo(F - 12, 72); g.lineTo(F + 12, 69); }
    else { g.arc(F, 64, 13, 0.35, Math.PI - 0.35); }
    g.stroke();
    if (look.earrings) { g.fillStyle = '#ffe45c'; g.beginPath(); g.arc(F - 66, 58, 6, 0, 7); g.arc(F + 66, 58, 6, 0, 7); g.fill(); }
    return tex(c);
}

function paintGlasses(g, type, F, y) {
    g.save();
    if (type === 'aviator' || type === 'shades') {
        for (const s of [-1, 1]) {
            const grd = g.createLinearGradient(0, y - 10, 0, y + 12);
            grd.addColorStop(0, '#2a1a3a'); grd.addColorStop(0.5, '#0a0610'); grd.addColorStop(1, '#ff3fa4');
            g.fillStyle = grd;
            g.beginPath();
            if (type === 'aviator') g.ellipse(F + s * 21, y + 1, 15, 12, s * 0.15, 0, 7);
            else g.rect(F + s * 21 - 16, y - 9, 32, 17);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(F + s * 21 - 8, y - 5, 6, 2);
        }
        g.strokeStyle = '#d8c8a0'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(F - 7, y - 4); g.lineTo(F + 7, y - 4); g.stroke();
        g.beginPath(); g.moveTo(F - 36, y - 2); g.lineTo(F - 60, y - 4); g.moveTo(F + 36, y - 2); g.lineTo(F + 60, y - 4); g.stroke();
    } else if (type === 'round') {
        g.strokeStyle = '#3a2a20'; g.lineWidth = 3;
        for (const s of [-1, 1]) {
            g.fillStyle = '#fff'; g.beginPath(); g.ellipse(F + s * 20, y, 8, 6, 0, 0, 7); g.fill();
            g.fillStyle = '#1a1420'; g.beginPath(); g.arc(F + s * 20, y + 1, 4, 0, 7); g.fill();
            g.beginPath(); g.arc(F + s * 20, y, 13, 0, 7); g.stroke();
        }
        g.beginPath(); g.moveTo(F - 7, y); g.lineTo(F + 7, y); g.stroke();
    } else if (type === 'visor') {
        const grd = g.createLinearGradient(F - 50, 0, F + 50, 0);
        grd.addColorStop(0, '#ff8a3a'); grd.addColorStop(0.5, '#ffe45c'); grd.addColorStop(1, '#ff3fa4');
        g.fillStyle = grd; g.fillRect(F - 50, y - 9, 100, 16);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(F - 40, y - 6, 30, 3);
    } else if (type === 'star') {
        for (const s of [-1, 1]) {
            g.fillStyle = '#ff3fa4'; star(g, F + s * 21, y, 15); g.fill();
            g.fillStyle = '#2a0a20'; star(g, F + s * 21, y, 10); g.fill();
        }
    }
    g.restore();
}

function star(g, x, y, r) {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
}

// ------------------------------------------------------------------ text & icons
const textCache = new Map();
/** A glowing neon text texture. Returns { tex, aspect }. */
export function neonText(text, color = '#ff3fa4', { font = '900 120px "Monoton", "Arial Black", sans-serif', pad = 50, core = '#fff', glow = true } = {}) {
    const key = `${text}|${color}|${font}|${core}|${glow}`;
    if (textCache.has(key)) return textCache.get(key);
    const m = canvas(8, 8).getContext('2d');
    m.font = font;
    const tw = Math.ceil(m.measureText(text).width);
    const fh = parseInt(font.match(/(\d+)px/)[1], 10);
    const c = canvas(tw + pad * 2, fh + pad * 2), g = c.getContext('2d');
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const cx = c.width / 2, cy = c.height / 2 + fh * 0.05;
    if (glow) {
        g.fillStyle = color; g.shadowColor = color;
        for (const b of [40, 22, 10]) { g.shadowBlur = b; g.fillText(text, cx, cy); }
    }
    g.shadowBlur = 0;
    g.fillStyle = core; g.fillText(text, cx, cy);
    if (glow) { g.strokeStyle = color; g.lineWidth = 2; g.strokeText(text, cx, cy); }
    const out = { tex: tex(c), aspect: c.width / c.height };
    textCache.set(key, out);
    return out;
}

const iconCache = new Map();
/** Square icon textures for status markers above heads. */
export function icon(kind) {
    if (iconCache.has(kind)) return iconCache.get(kind);
    const c = canvas(128, 128), g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const glowText = (t, col, size = 96) => {
        g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
        g.fillStyle = col; g.shadowColor = col;
        for (const b of [24, 10]) { g.shadowBlur = b; g.fillText(t, 64, 70); }
        g.shadowBlur = 0; g.lineWidth = 6; g.strokeStyle = '#1a0010'; g.strokeText(t, 64, 70); g.fillStyle = '#fff'; g.fillText(t, 64, 70);
        g.fillStyle = col; g.globalAlpha = 0.5; g.fillText(t, 64, 70); g.globalAlpha = 1;
    };
    switch (kind) {
        case '!': glowText('!', '#ff2e3e'); break;
        case '?': glowText('?', '#ffe45c'); break;
        case 'zzz': g.font = '900 44px "Arial Black", sans-serif'; g.fillStyle = '#9ad8ff'; g.shadowColor = '#4fd8ff'; g.shadowBlur = 12; g.fillText('z', 44, 88); g.font = '900 60px "Arial Black", sans-serif'; g.fillText('Z', 82, 50); break;
        case 'star': g.fillStyle = '#ffe45c'; g.shadowColor = '#ffe45c'; g.shadowBlur = 16; star(g, 64, 64, 46); g.fill(); break;
        case 'heart': g.fillStyle = '#ff3f6a'; g.shadowColor = '#ff3f6a'; g.shadowBlur = 16; g.beginPath(); g.moveTo(64, 104); g.bezierCurveTo(10, 64, 20, 18, 64, 42); g.bezierCurveTo(108, 18, 118, 64, 64, 104); g.fill(); break;
        case 'cross': g.fillStyle = '#8dff8a'; g.shadowColor = '#8dff8a'; g.shadowBlur = 16; g.fillRect(48, 20, 32, 88); g.fillRect(20, 48, 88, 32); break;
        case 'note': g.fillStyle = '#ffe45c'; g.shadowColor = '#ff3fa4'; g.shadowBlur = 14; g.font = '900 90px serif'; g.fillText('♫', 64, 64); break;
        case 'help': glowText('HELP', '#ff4fa8', 40); break;
        case 'dot': { const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); break; }
        case 'ring': g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); break;
        case 'lock': g.fillStyle = '#ff2e3e'; g.shadowColor = '#ff2e3e'; g.shadowBlur = 12; g.fillRect(30, 58, 68, 50); g.lineWidth = 12; g.strokeStyle = '#ff2e3e'; g.beginPath(); g.arc(64, 56, 22, Math.PI, 0); g.stroke(); break;
        default: glowText(kind, '#fff', 60);
    }
    const t = tex(c);
    iconCache.set(kind, t);
    return t;
}

// ------------------------------------------------------------------ props
export function crateTex() {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#b08050'; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 6; k++) { g.fillStyle = shade('#c09060', 0.85 + hash01(k) * 0.3); g.fillRect(0, k * 21 + 1, 128, 19); }
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
    g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke();
    g.fillStyle = 'rgba(40,20,10,0.75)'; g.font = '900 18px "Arial Black", sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(64, 70); g.rotate(-0.1); g.fillText('FRAGILE', 0, 0); g.restore();
    return tex(c);
}

export function crackTex(base) {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = cssOf(base); g.fillRect(0, 0, 128, 128);
    noise(g, 0, 0, 200, '#000', 0.08, 3, 5);
    g.strokeStyle = 'rgba(30,10,20,0.85)'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
        g.beginPath();
        let x = 20 + k * 40, y = 0;
        g.moveTo(x, y);
        while (y < 128) { x += (hash01(k * 31 + y) - 0.5) * 36; y += 14 + hash01(y + k) * 12; g.lineTo(x, y); }
        g.stroke();
    }
    g.strokeStyle = 'rgba(255,200,120,0.5)'; g.lineWidth = 1; g.stroke();
    return tex(c);
}

export function leafTex() {
    const c = canvas(64, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 64, 256);
    g.strokeStyle = '#2a5a20'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
    for (let y = 8; y < 250; y += 6) {
        const w = Math.sin((y / 256) * Math.PI) * 30 + 2;
        g.strokeStyle = y % 12 ? '#3f8a3a' : '#5aa848'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y + 14); g.moveTo(32, y); g.lineTo(32 + w, y + 14); g.stroke();
    }
    return tex(c);
}

export function screenTex(lines, color = '#4dff8a', bg = '#04140a') {
    const c = canvas(128, 96), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 96);
    g.fillStyle = color; g.font = 'bold 14px monospace';
    lines.forEach((l, i) => g.fillText(l, 6, 18 + i * 16));
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 128, 1);
    return tex(c);
}

export function stripeTex(a, b, n = 8, vertical = false) {
    const c = canvas(64, 64), g = c.getContext('2d');
    for (let k = 0; k < n; k++) {
        g.fillStyle = k % 2 ? cssOf(a) : cssOf(b);
        if (vertical) g.fillRect((k * 64) / n, 0, 64 / n + 1, 64);
        else g.fillRect(0, (k * 64) / n, 64, 64 / n + 1);
    }
    return tex(c);
}

export function windowsTex(lit = 0.5, seed = 1, warm = '#ffe0a0') {
    const c = canvas(64, 128), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) {
        const r = hash01(seed * 97 + y * 13 + x);
        if (r > lit) continue;
        g.fillStyle = r < lit * 0.2 ? '#ff7ad0' : r < lit * 0.35 ? '#7af0ff' : warm;
        g.fillRect(x * 16 + 3, y * 8 + 2, 10, 4);
    }
    return tex(c);
}

export function flagTex() {
    const c = canvas(96, 64), g = c.getContext('2d');
    for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#fff' : '#c8283a'; g.fillRect(0, (k * 64) / 13, 96, 64 / 13 + 1); }
    g.fillStyle = '#1a2a6a'; g.fillRect(0, 0, 42, 34);
    return tex(c);
}

export function labelTex(text, bg = '#ff3fa4', fg = '#fff') {
    const c = canvas(128, 48), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 48);
    g.fillStyle = fg; g.font = '900 22px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 25);
    return tex(c);
}
