// Draws the game into the 2D screen canvas at S× the 320 × 240 native
// resolution: the room (a cached static layer per room plus animated tiles),
// everything in it, the darkness of the catacombs, the HUD and the effects.
// It reads the world and never writes to it.

import { W, H, PF_Y, T, RW, RH, ROOM_W, ROOM_H, FLOOR, WALL, GATE, CHASM, CRACK, FACADE, BARRIER } from '../config.js';
import { drawText, textWidth } from './font.js';
import { bakeAll, KEY_HUE } from './sprites.js';
import { FX } from './fx.js';

export const STYLES = {
    sunset:  { floor: ['#16061c', '#240a2a'], grid: '#ff3aa8', wall: ['#3c0c3e', '#5e1652', '#2a0628'], edge: '#ff5ad2', edge2: '#ffb03a', hud: '#ff5ad2', name: '#ffb03a', decal: 'palm' },
    grid:    { floor: ['#030818', '#071236'], grid: '#1a5aff', wall: ['#0a1450', '#1a2c90', '#060c36'], edge: '#29e6ff', edge2: '#3a6aff', hud: '#29e6ff', name: '#7ab0ff', decal: 'cross' },
    static:  { floor: ['#07070b', '#0e0e16'], grid: '#50506a', wall: ['#1c1c28', '#2e2e3e', '#101018'], edge: '#c8d4e8', edge2: '#7a8090', hud: '#c8d4e8', name: '#c8d4e8', decal: 'dust' },
    river:   { floor: ['#02121a', '#04222c'], grid: '#00b8c8', wall: ['#0a2a3a', '#164a5e', '#061a24'], edge: '#5af0ff', edge2: '#e0eaff', hud: '#5af0ff', name: '#a0f8ff', decal: 'wave' },
    vapor:   { floor: ['#1a0a26', '#2a1040'], grid: '#ff7ad8', wall: ['#3a1a5a', '#5c2c7c', '#24103a'], edge: '#7affea', edge2: '#ff9ae8', hud: '#7affea', name: '#ff9ae8', decal: 'checker' },
    citadel: { floor: ['#0a0a12', '#151524'], grid: '#a0a8c8', wall: ['#2a2e3e', '#4a5068', '#1a1c28'], edge: '#e8f0ff', edge2: '#ffd040', hud: '#e8f0ff', name: '#ffd040', decal: 'plate' },
};

export const CASTLE = {
    sunset: ['#ff5a8a', '#8a1a5a', '#ffd23a'], gold: ['#ffc21a', '#8a5a0a', '#fff27a'], onyx: ['#3a3e52', '#14161e', '#9aa0c0'],
    pearl: ['#e8e4f8', '#8a84b0', '#ffffff'], neon: ['#2ae8c0', '#0a6a58', '#c0fff0'], violet: ['#9a5aff', '#3a1480', '#e0c8ff'], chrome: ['#b8c4dc', '#4a5468', '#ffffff'],
};

const DRAGON_GLOW = { aurix: '#ffb000', verdox: '#20ff80', scarlax: '#ff2a40', cryovex: '#40e0ff', luma: '#ff40e0', nox: '#a060ff' };

const cx = (e) => e.x + e.w / 2;
const cy = (e) => e.y + e.h / 2;

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function hash(n) { n = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); n ^= n >>> 13; n = Math.imul(n, 0xC2B2AE35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

export class Renderer {
    constructor(canvas) {
        this.c = canvas;
        this.ctx = canvas.getContext('2d');
        this.A = bakeAll();
        this.fx = new FX();
        this.cache = new Map();
        this.trail = [];
        this.trans = null;
        this.banner = null;
        this.msgs = [];
        this.pulse = 0;
        this.time = 0;
        this.prevRoom = -1;
        this.prevWorld = null;
        this.shakeOn = true;
        this.hi = 0;
        this.credits = 0;
        this.setScale(3);
        this.squireGlow = this.makeSquareGlow();
    }

    setScale(S) {
        this.S = S;
        this.c.width = W * S; this.c.height = H * S;
        this.cache.clear();
        this.snap = mk(W * S, ROOM_H * S);
        this.dark = mk(ROOM_W * S, ROOM_H * S);
        this.flow = null;
    }

    makeSquareGlow() {
        const c = mk(40 * 3, 40 * 3), g = c.getContext('2d');
        const gr = g.createRadialGradient(60, 60, 4, 60, 60, 60);
        gr.addColorStop(0, 'rgba(120,240,255,0.9)'); gr.addColorStop(0.25, 'rgba(41,230,255,0.35)'); gr.addColorStop(1, 'rgba(41,230,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 120, 120);
        return c;
    }

    reset() { this.cache.clear(); this.trail.length = 0; this.trans = null; this.banner = null; this.msgs.length = 0; this.prevRoom = -1; this.fx.clear(); }

    message(text, color = '#fff', dur = 2, sub = '') { this.msgs.push({ text, color, t: dur, dur, sub }); if (this.msgs.length > 3) this.msgs.shift(); }

    // ================================================================== room bake
    roomSig(M, room) {
        let h = 0;
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) h = (Math.imul(h, 31) + M.at(room.x0 + x, room.y0 + y)) | 0;
        return h;
    }

    bakeRoom(w, i) {
        const M = w.map, room = M.rooms[i];
        const sig = this.roomSig(M, room);
        const hit = this.cache.get(i);
        if (hit && hit.sig === sig && hit.S === this.S) return hit;
        const S = this.S;
        const st = STYLES[M.realm.style];
        const c = hit && hit.S === S ? hit.canvas : mk(ROOM_W * S, ROOM_H * S);
        const g = c.getContext('2d');
        g.setTransform(S, 0, 0, S, 0, 0);
        g.clearRect(0, 0, ROOM_W, ROOM_H);
        const at = (x, y) => M.at(room.x0 + x, room.y0 + y);
        const solid = (t) => t === WALL || t === CRACK || t === FACADE;

        // floor
        const fg = g.createLinearGradient(0, 0, 0, ROOM_H);
        fg.addColorStop(0, st.floor[1]); fg.addColorStop(1, st.floor[0]);
        g.fillStyle = fg; g.fillRect(0, 0, ROOM_W, ROOM_H);
        const rg = g.createRadialGradient(ROOM_W / 2, ROOM_H / 2, 10, ROOM_W / 2, ROOM_H / 2, 200);
        rg.addColorStop(0, st.grid + '22'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(0, 0, ROOM_W, ROOM_H);
        this.floorDecal(g, st, room, at);
        g.globalAlpha = 0.16; g.strokeStyle = st.grid; g.lineWidth = 1 / S;
        g.beginPath();
        for (let x = 0; x <= ROOM_W; x += 16) { g.moveTo(x + 0.5 / S, 0); g.lineTo(x + 0.5 / S, ROOM_H); }
        for (let y = 0; y <= ROOM_H; y += 16) { g.moveTo(0, y + 0.5 / S); g.lineTo(ROOM_W, y + 0.5 / S); }
        g.stroke();
        g.globalAlpha = 1;

        // the rooms' set dressing
        this.decorate(g, w, room, st);

        // walls
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
            const t = at(x, y);
            if (t !== WALL && t !== CRACK) continue;
            const px = x * T, py = y * T;
            g.fillStyle = t === CRACK ? '#3a2418' : st.wall[0];
            g.fillRect(px, py, T, T);
            g.fillStyle = t === CRACK ? '#5a3a24' : st.wall[1];
            g.fillRect(px + 1, py + 1, T - 2, T - 2);
            g.fillStyle = t === CRACK ? '#24140c' : st.wall[2];
            g.fillRect(px + 1, py + T - 2, T - 2, 1);
            if (!solid(at(x, y - 1))) { g.fillStyle = '#ffffff22'; g.fillRect(px, py, T, 1); }
            if (t === CRACK) {
                g.strokeStyle = '#ff9a40'; g.lineWidth = 0.6;
                g.beginPath();
                const r = hash(room.i * 999 + x * 31 + y);
                g.moveTo(px + 1 + r * 3, py); g.lineTo(px + 4, py + 3 + r * 2); g.lineTo(px + 2 + r * 4, py + T);
                g.moveTo(px + 4, py + 3 + r * 2); g.lineTo(px + T, py + 4);
                g.stroke();
            }
        }
        // neon edges where wall meets floor
        const edges = (color, blur, width, filter) => {
            g.save();
            g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'square';
            if (blur) { g.shadowColor = color; g.shadowBlur = blur * S; }
            g.beginPath();
            for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
                const t = at(x, y);
                if (!filter(t)) continue;
                const px = x * T, py = y * T;
                const open = (tt) => tt === FLOOR || tt === GATE || tt === CHASM || tt === BARRIER;
                if (open(at(x, y - 1)) && y > 0) { g.moveTo(px, py + 0.5); g.lineTo(px + T, py + 0.5); }
                if (open(at(x, y + 1)) && y < RH - 1) { g.moveTo(px, py + T - 0.5); g.lineTo(px + T, py + T - 0.5); }
                if (open(at(x - 1, y)) && x > 0) { g.moveTo(px + 0.5, py); g.lineTo(px + 0.5, py + T); }
                if (open(at(x + 1, y)) && x < RW - 1) { g.moveTo(px + T - 0.5, py); g.lineTo(px + T - 0.5, py + T); }
            }
            g.stroke();
            g.restore();
        };
        edges(st.edge, 5, 1, (t) => t === WALL);
        edges('#ffb060', 4, 0.8, (t) => t === CRACK);
        edges('#ffffffaa', 0, 1 / S, (t) => t === WALL);

        // castle
        if (room.facade) this.drawCastle(g, room, st);

        // chasm base
        const chasm = [];
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (at(x, y) === CHASM) chasm.push([x, y]);
        let chasmRect = null;
        if (chasm.length) {
            const xs = chasm.map((p) => p[0]), ys = chasm.map((p) => p[1]);
            chasmRect = { x: Math.min(...xs) * T, y: Math.min(...ys) * T, w: (Math.max(...xs) - Math.min(...xs) + 1) * T, h: (Math.max(...ys) - Math.min(...ys) + 1) * T, vert: room.chasm === 'v' };
            g.fillStyle = '#00141c'; g.fillRect(chasmRect.x, chasmRect.y, chasmRect.w, chasmRect.h);
            g.save(); g.strokeStyle = '#5af0ff'; g.shadowColor = '#5af0ff'; g.shadowBlur = 6 * S; g.lineWidth = 1;
            g.strokeRect(chasmRect.x + 0.5, chasmRect.y + 0.5, chasmRect.w - 1, chasmRect.h - 1);
            g.restore();
        }
        const entry = { canvas: c, sig, S, chasm: chasmRect };
        this.cache.set(i, entry);
        return entry;
    }

    floorDecal(g, st, room, at) {
        const n = 10 + Math.floor(hash(room.i + 77) * 8);
        for (let k = 0; k < n; k++) {
            const x = 16 + hash(room.i * 131 + k) * (ROOM_W - 32), y = 16 + hash(room.i * 977 + k * 7) * (ROOM_H - 32);
            if (at(Math.floor(x / T), Math.floor(y / T)) !== FLOOR) continue;
            g.globalAlpha = 0.18 + hash(k + room.i) * 0.12;
            g.strokeStyle = st.grid; g.fillStyle = st.grid; g.lineWidth = 0.7;
            if (st.decal === 'palm') {
                g.beginPath(); g.moveTo(x, y + 6); g.quadraticCurveTo(x + 1, y + 1, x, y - 2);
                for (const a of [-2.4, -1.8, -1.2, -0.6, 0]) { g.moveTo(x, y - 2); g.quadraticCurveTo(x + Math.cos(a) * 3, y - 3 + Math.sin(a) * 3, x + Math.cos(a) * 6, y - 1 + Math.sin(a) * 2); }
                g.stroke();
            } else if (st.decal === 'cross') { g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); }
            else if (st.decal === 'dust') { g.fillRect(x, y, 1, 1); g.fillRect(x + 3, y + 1, 1, 1); }
            else if (st.decal === 'wave') { g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x - 2, y - 2, x, y); g.quadraticCurveTo(x + 2, y + 2, x + 5, y); g.stroke(); }
            else if (st.decal === 'plate') { g.strokeRect(x - 4, y - 3, 8, 6); g.fillRect(x - 3, y - 2, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
        }
        g.globalAlpha = 1;
        if (st.decal === 'checker') {
            g.globalAlpha = 0.07;
            for (let y = 0; y < ROOM_H; y += 16) for (let x = 0; x < ROOM_W; x += 16) if (((x + y) / 16) & 1) { g.fillStyle = '#7affea'; g.fillRect(x, y, 16, 16); }
            g.globalAlpha = 1;
        }
    }

    decorate(g, w, room, st) {
        const S = this.S;
        const ch = room.ch;
        const M = w.map;
        const ccx = ROOM_W / 2, ccy = ROOM_H / 2;
        g.save();
        if (ch === 'h') {
            // the altar of the Sunset Keep
            for (let r = 46; r > 10; r -= 9) {
                g.strokeStyle = r % 2 ? '#ff5ad2' : '#ffb03a'; g.globalAlpha = 0.45; g.lineWidth = 1;
                g.shadowColor = g.strokeStyle; g.shadowBlur = 6 * S;
                g.beginPath(); g.arc(ccx, ccy, r, 0, Math.PI * 2); g.stroke();
            }
            g.globalAlpha = 1; g.shadowBlur = 0;
            const sun = g.createLinearGradient(0, ccy - 14, 0, ccy + 14);
            sun.addColorStop(0, '#fff27a'); sun.addColorStop(0.5, '#ff8a1a'); sun.addColorStop(1, '#ff2ece');
            g.fillStyle = sun; g.beginPath(); g.arc(ccx, ccy, 14, 0, Math.PI * 2); g.fill();
            g.fillStyle = st.floor[0];
            for (let k = 0; k < 4; k++) g.fillRect(ccx - 15, ccy + 2 + k * 3.2, 30, 1 + k * 0.3);
            drawText(g, 'BRING THE CHALICE HERE', ccx, ccy + 26, '#ffb03a', { align: 'center' });
        } else if (ch === 'v') {
            g.fillStyle = '#ffffff10'; g.fillRect(ccx - 20, ccy - 14, 40, 28);
            g.strokeStyle = st.edge2; g.globalAlpha = 0.6; g.lineWidth = 1;
            g.strokeRect(ccx - 20.5, ccy - 14.5, 41, 29);
            g.strokeRect(ccx - 12.5, ccy - 8.5, 25, 17);
        } else if (ch === 'A') {
            g.globalAlpha = 0.35; g.strokeStyle = '#e8f0ff'; g.lineWidth = 1;
            for (let r = 20; r < 100; r += 16) { g.beginPath(); g.ellipse(ccx, ccy + 4, r * 1.6, r, 0, 0, Math.PI * 2); g.stroke(); }
            for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(ccx, ccy + 4); g.lineTo(ccx + Math.cos(a / 12 * Math.PI * 2) * 160, ccy + 4 + Math.sin(a / 12 * Math.PI * 2) * 100); g.stroke(); }
        } else if (ch === 'S') {
            g.globalAlpha = 1;
            drawText(g, 'IN 1979 WARREN ROBINETT', ccx, 40, '#9098a8', { align: 'center' });
            drawText(g, 'HID HIS NAME IN A ROOM', ccx, 50, '#9098a8', { align: 'center' });
            drawText(g, 'BEHIND A WALL ONLY A', ccx, 60, '#9098a8', { align: 'center' });
            drawText(g, 'GREY DOT COULD OPEN.', ccx, 70, '#9098a8', { align: 'center' });
            drawText(g, 'THIS ROOM IS FOR HIM.', ccx, 88, '#ff5ad2', { align: 'center', glow: '#ff5ad2' });
        }
        // teleport pads, laser emitters, the charge dispenser
        for (const p of M.pads) {
            if (p.room !== room.i) continue;
            const x = p.x - room.x0 * T, y = p.y - room.y0 * T;
            g.globalAlpha = 1; g.fillStyle = '#0a0418'; g.fillRect(x, y, p.w, p.h);
            g.strokeStyle = '#ff5ad2'; g.lineWidth = 1; g.shadowColor = '#ff5ad2'; g.shadowBlur = 5 * S;
            g.strokeRect(x + 0.5, y + 0.5, p.w - 1, p.h - 1);
            g.strokeRect(x + 4.5, y + 4.5, p.w - 9, p.h - 9);
            g.shadowBlur = 0;
        }
        if (M.dispenser && M.dispenser.room === room.i) {
            const d = M.dispenser, x = d.x - room.x0 * T - 4, y = d.y - room.y0 * T - 4;
            g.globalAlpha = 1; g.fillStyle = '#1a0a0a'; g.fillRect(x, y, 16, 16);
            g.strokeStyle = '#ff2a50'; g.shadowColor = '#ff2a50'; g.shadowBlur = 5 * S; g.strokeRect(x + 0.5, y + 0.5, 15, 15); g.shadowBlur = 0;
            drawText(g, 'CHARGE', x + 8, y + 18, '#ff2a50', { align: 'center' });
        }
        g.restore();
    }

    drawCastle(g, room, st) {
        const S = this.S;
        const f = room.facade;
        const col = CASTLE[room.castle] || CASTLE.gold;
        const x0 = (f.x - room.x0) * T, y0 = (f.y - room.y0) * T, fw = f.w * T, fh = f.h * T;
        const gx = 18 * T, gw = 4 * T;   // the gate passage
        g.save();
        const body = (x, y, w, h) => {
            const gr = g.createLinearGradient(0, y, 0, y + h);
            gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
            g.fillStyle = gr; g.fillRect(x, y, w, h);
            // bricks
            g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1 / S;
            g.beginPath();
            for (let yy = y + 5; yy < y + h; yy += 5) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
            for (let yy = y, r = 0; yy < y + h; yy += 5, r++) for (let xx = x + (r & 1) * 4; xx < x + w; xx += 8) { g.moveTo(xx, yy); g.lineTo(xx, yy + 5); }
            g.stroke();
            // battlements
            g.fillStyle = col[0];
            for (let xx = x; xx < x + w - 2; xx += 6) g.fillRect(xx, y - 4, 4, 4);
        };
        // back wall, towers and the keep over the gate
        body(x0 + 28, y0 + 22, fw - 56, fh - 22);
        body(x0, y0 + 6, 28, fh - 6);
        body(x0 + fw - 28, y0 + 6, 28, fh - 6);
        body(gx - 16, y0 + 8, gw + 32, fh - 8);
        // the passage through the keep
        g.fillStyle = '#05030a'; g.fillRect(gx, 0, gw, y0 + fh);
        g.beginPath(); g.arc(gx + gw / 2, y0 + 48, gw / 2, Math.PI, 0); g.fill();
        // windows
        for (const [wx, wy] of [[x0 + 10, y0 + 22], [x0 + 10, y0 + 46], [x0 + fw - 18, y0 + 22], [x0 + fw - 18, y0 + 46], [gx - 10, y0 + 24], [gx + gw + 4, y0 + 24], [x0 + 44, y0 + 40], [x0 + fw - 50, y0 + 40]]) {
            g.fillStyle = '#ffe680'; g.shadowColor = '#ffb030'; g.shadowBlur = 5 * S;
            g.fillRect(wx, wy, 6, 8); g.shadowBlur = 0;
            g.fillStyle = col[1]; g.fillRect(wx + 2.5, wy, 1, 8);
        }
        // the name over the gate
        // neon outline of the whole silhouette
        g.strokeStyle = col[2]; g.lineWidth = 1; g.shadowColor = col[2]; g.shadowBlur = 6 * S;
        g.beginPath();
        g.moveTo(x0, y0 + fh); g.lineTo(x0, y0 + 6); g.lineTo(x0 + 28, y0 + 6); g.lineTo(x0 + 28, y0 + 22); g.lineTo(gx - 16, y0 + 22); g.lineTo(gx - 16, y0 + 8);
        g.lineTo(gx, y0 + 8);
        g.moveTo(gx + gw, y0 + 8); g.lineTo(gx + gw + 16, y0 + 8); g.lineTo(gx + gw + 16, y0 + 22); g.lineTo(x0 + fw - 28, y0 + 22); g.lineTo(x0 + fw - 28, y0 + 6); g.lineTo(x0 + fw, y0 + 6); g.lineTo(x0 + fw, y0 + fh);
        g.moveTo(gx, 0); g.lineTo(gx, y0 + fh); g.moveTo(gx + gw, 0); g.lineTo(gx + gw, y0 + fh);
        g.stroke();
        // pennants on the towers
        for (const tx of [x0 + 14, x0 + fw - 14]) {
            g.strokeStyle = col[2]; g.shadowBlur = 0; g.beginPath(); g.moveTo(tx, y0 + 2); g.lineTo(tx, y0 - 12); g.stroke();
            g.fillStyle = room.castle === 'sunset' ? '#ff5ad2' : col[2]; g.shadowColor = g.fillStyle; g.shadowBlur = 4 * S;
            g.beginPath(); g.moveTo(tx, y0 - 12); g.lineTo(tx + 9, y0 - 9); g.lineTo(tx, y0 - 6); g.fill();
        }
        g.shadowBlur = 0;
        const label = { sunset: 'SUNSET', gold: 'GOLD', onyx: 'ONYX', pearl: 'PEARL', neon: 'NEON', violet: 'VIOLET', chrome: 'CITADEL' }[room.castle];
        drawText(g, label, gx + gw / 2, y0 + fh + 2 + 15, col[2], { align: 'center', shadow: '#000' });
        g.restore();
    }

    // ================================================================== frame
    draw(w, dt) {
        const ctx = this.ctx, S = this.S;
        this.time += dt;
        this.fx.update(dt);
        for (const m of this.msgs) m.t -= dt;
        this.msgs = this.msgs.filter((m) => m.t > 0);
        if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W * S, H * S);

        // room change → slide
        if (w !== this.prevWorld) { this.prevWorld = w; this.prevRoom = w.room; this.trans = null; this.trail.length = 0; }
        if (w.room !== this.prevRoom) {
            const C = w.map.cols;
            const dc = (w.room % C) - (this.prevRoom % C), dr = ((w.room / C) | 0) - ((this.prevRoom / C) | 0);
            const g = this.snap.getContext('2d');
            g.clearRect(0, 0, this.snap.width, this.snap.height);
            g.drawImage(this.c, 0, PF_Y * S, W * S, ROOM_H * S, 0, 0, W * S, ROOM_H * S);
            this.trans = Math.abs(dc) + Math.abs(dr) === 1 && !w.player.dead ? { dx: dc, dy: dr, t: 0, dur: 0.3 } : { flash: true, t: 0, dur: 0.25 };
            this.prevRoom = w.room;
            this.trail.length = 0;
            const R = w.map.rooms[w.room];
            if (R) this.banner = { text: R.name, t: 1.8 };
        }
        const [sx, sy] = this.fx.offset(this.shakeOn);
        let ox = 0, oy = 0;
        if (this.trans) {
            this.trans.t += dt;
            const e = Math.min(1, this.trans.t / this.trans.dur);
            const k = 1 - (1 - e) * (1 - e) * (1 - e);
            if (!this.trans.flash) {
                ox = this.trans.dx * ROOM_W * (1 - k); oy = this.trans.dy * ROOM_H * (1 - k);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.save();
                ctx.beginPath(); ctx.rect(0, PF_Y * S, W * S, ROOM_H * S); ctx.clip();
                ctx.drawImage(this.snap, Math.round((ox - this.trans.dx * ROOM_W) * S), Math.round((PF_Y + oy - this.trans.dy * ROOM_H) * S));
                ctx.restore();
            }
            if (e >= 1) this.trans = null;
        }
        this.drawPlayfield(w, sx + ox, sy + oy);
        if (this.trans && this.trans.flash) {
            ctx.setTransform(S, 0, 0, S, 0, 0);
            ctx.globalAlpha = 1 - this.trans.t / this.trans.dur;
            ctx.drawImage(this.snap, 0, PF_Y, W, ROOM_H);
            ctx.globalAlpha = 1;
        }
        ctx.setTransform(S, 0, 0, S, 0, 0);
        this.drawHUD(w);
        this.drawMessages();
        if (this.fx.flashA > 0) {
            ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC;
            ctx.fillRect(0, PF_Y, W, ROOM_H); ctx.globalAlpha = 1;
        }
    }

    drawPlayfield(w, offX, offY) {
        const ctx = this.ctx, S = this.S, M = w.map;
        const room = M.rooms[w.room];
        const rx = room.x0 * T, ry = room.y0 * T;
        const bx = Math.round((offX - rx) * S) / S, by = Math.round((PF_Y + offY - ry) * S) / S;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath(); ctx.rect(0, PF_Y * S, W * S, ROOM_H * S); ctx.clip();
        ctx.setTransform(S, 0, 0, S, bx * S, by * S);
        ctx.imageSmoothingEnabled = false;
        const bake = this.bakeRoom(w, w.room);
        ctx.drawImage(bake.canvas, rx, ry, ROOM_W, ROOM_H);
        const st = STYLES[M.realm.style];
        // the floor grid breathes with the kick drum
        if (this.pulse > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = this.pulse * 0.22;
            ctx.strokeStyle = st.grid; ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (let x = rx; x <= rx + ROOM_W; x += 16) { ctx.moveTo(x, ry); ctx.lineTo(x, ry + ROOM_H); }
            for (let y = ry; y <= ry + ROOM_H; y += 16) { ctx.moveTo(rx, y); ctx.lineTo(rx + ROOM_W, y); }
            ctx.stroke();
            ctx.restore();
        }
        if (bake.chasm) this.drawRiver(ctx, rx + bake.chasm.x, ry + bake.chasm.y, bake.chasm.w, bake.chasm.h, bake.chasm.vert);
        this.drawGates(ctx, w, room);
        this.drawBarrier(ctx, w, room);
        this.drawPads(ctx, w, room);
        this.drawLasers(ctx, w, room, false);
        this.drawPickups(ctx, w, room);
        this.drawItems(ctx, w, room, false);
        this.drawDragons(ctx, w, room);
        this.drawBoss(ctx, w, room);
        this.drawPlayer(ctx, w);
        this.drawItems(ctx, w, room, true);
        if (w.bat) this.drawBat(ctx, w);
        this.drawProjectiles(ctx, w);
        this.drawMinis(ctx, w);
        this.drawLasers(ctx, w, room, true);
        this.drawNull(ctx, w);
        this.fx.draw(ctx, drawText);
        if (room.dark) this.drawDark(ctx, w, room);
        // room name banner
        if (this.banner) {
            const a = Math.min(1, this.banner.t * 2);
            ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#000';
            const tw = textWidth(this.banner.text) + 12;
            ctx.fillRect(rx + ROOM_W / 2 - tw / 2, ry + 18, tw, 11);
            ctx.globalAlpha = a;
            drawText(ctx, this.banner.text, rx + ROOM_W / 2, ry + 20, st.name, { align: 'center' });
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    drawRiver(ctx, x, y, w, h, vert) {
        const t = this.time;
        ctx.save();
        ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const len = vert ? h : w, across = vert ? w : h;
        for (let lane = 0; lane < across; lane += 3) {
            const sp = 22 + hash(lane * 7) * 40;
            const off = (t * sp + hash(lane) * 400) % 24;
            for (let s = -24; s < len + 24; s += 24) {
                const p = s + off;
                const bright = hash(lane * 13 + Math.floor((s - t * sp) / 24)) ;
                ctx.globalAlpha = 0.25 + bright * 0.6;
                ctx.fillStyle = bright > 0.8 ? '#ffffff' : bright > 0.4 ? '#5af0ff' : '#1a8aff';
                const l = 2 + bright * 6;
                if (vert) ctx.fillRect(x + lane + 0.5, y + p, 1, l); else ctx.fillRect(x + p, y + lane + 0.5, l, 1);
            }
        }
        ctx.restore();
    }

    drawGates(ctx, w, room) {
        for (const g of w.map.gates) {
            if (g.room !== room.i || g.open >= 1) continue;
            const col = CASTLE[g.color] || CASTLE.gold;
            const x = g.x * T, y = g.y * T, gw = g.w * T, gh = g.h * T;
            const drop = gh * (1 - g.open);
            ctx.save();
            ctx.strokeStyle = col[2];
            ctx.beginPath();
            for (let bx = x + 2; bx < x + gw; bx += 4) { ctx.moveTo(bx + 0.5, y - 32 * g.open); ctx.lineTo(bx + 0.5, y + drop); }
            for (let k = 1; k <= 3; k++) { const yy = y + drop - k * 5; if (yy > y - 32 * g.open - 1) { ctx.moveTo(x, yy); ctx.lineTo(x + gw, yy); } }
            ctx.globalAlpha = 0.35; ctx.lineWidth = 2.4; ctx.stroke();
            ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = col[2];
            for (let bx = x + 2; bx < x + gw; bx += 4) ctx.fillRect(bx - 0.5, y + drop - 1, 2, 2);
            ctx.restore();
            // a lock icon
            if (g.open <= 0 && g.color !== 'chrome' && !g.home) {
                const kh = KEY_HUE[g.color] || KEY_HUE.gold;
                ctx.fillStyle = kh[0]; ctx.fillRect(x + gw / 2 - 2, y + 6, 4, 4); ctx.strokeStyle = kh[0]; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(x + gw / 2, y + 6, 1.6, Math.PI, 0); ctx.stroke();
            }
            if (g.color === 'chrome' && g.open <= 0) {
                drawText(ctx, `${w.shards}/3`, x + gw / 2, y + 4, '#e8f0ff', { align: 'center', shadow: '#000' });
            }
        }
    }

    drawBarrier(ctx, w, room) {
        const b = w.map.barrier;
        if (!b || b.broken || b.room !== room.i) return;
        const x = b.x * T, y = b.y * T;
        for (let j = 0; j < b.h * T; j += 1) for (let i = 0; i < b.w * T; i += 1) {
            const v = Math.random();
            if (v < 0.5) continue;
            ctx.fillStyle = v > 0.92 ? '#ff5ad2' : v > 0.84 ? '#29e6ff' : `rgba(200,200,220,${v * 0.8})`;
            ctx.fillRect(x + i, y + j, 1, 1);
        }
    }

    drawPads(ctx, w, room) {
        for (const p of w.map.pads) {
            if (p.room !== room.i) continue;
            const x = cx(p), y = cy(p);
            ctx.save();
            ctx.translate(x, y);
            ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 3; k++) {
                ctx.rotate(this.time * (0.8 + k * 0.5) * (k & 1 ? -1 : 1));
                ctx.strokeStyle = ['#ff5ad2', '#29e6ff', '#fff'][k]; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8;
                const r = 11 - k * 3.5;
                ctx.strokeRect(-r, -r, r * 2, r * 2);
            }
            ctx.restore();
            if (p.link >= 0 && w.player.padT > 0 && Math.abs(cx(w.player) - x) < 16 && Math.abs(cy(w.player) - y) < 16) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (w.player.padT / 0.4)); ctx.stroke();
            }
        }
    }

    drawLasers(ctx, w, room, beams) {
        for (const l of w.map.lasers) {
            if (l.room !== room.i) continue;
            const vert = l.h > l.w;
            if (!beams) {
                ctx.fillStyle = '#2a0a12'; ctx.strokeStyle = '#ff2a50'; ctx.lineWidth = 0.8;
                const e = vert ? [[l.x - 2, l.y - 4], [l.x - 2, l.y + l.h]] : [[l.x - 4, l.y - 2], [l.x + l.w, l.y - 2]];
                for (const [ex, ey] of e) { ctx.fillRect(ex, ey, vert ? 6 : 4, vert ? 4 : 6); ctx.strokeRect(ex + 0.5, ey + 0.5, (vert ? 6 : 4) - 1, (vert ? 4 : 6) - 1); }
                continue;
            }
            const ph = ((w.t + l.phase) % l.period) / l.period;
            const on = ph < l.duty;
            const warn = !on && ph > 1 - 0.35 / l.period;
            if (!on && !warn) continue;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            if (warn) {
                ctx.globalAlpha = (Math.sin(this.time * 60) > 0 ? 0.5 : 0.15);
                ctx.fillStyle = '#ff2a50';
                ctx.fillRect(l.x + (vert ? 0.5 : 0), l.y + (vert ? 0 : 0.5), vert ? 1 : l.w, vert ? l.h : 1);
            } else {
                const fl = 0.85 + Math.random() * 0.15;
                ctx.globalAlpha = 0.5 * fl; ctx.fillStyle = '#ff2a50';
                ctx.fillRect(l.x - (vert ? 2 : 0), l.y - (vert ? 0 : 2), vert ? 6 : l.w, vert ? l.h : 6);
                ctx.globalAlpha = 0.9 * fl; ctx.fillStyle = '#ff8090';
                ctx.fillRect(l.x, l.y, l.w, l.h);
                ctx.globalAlpha = fl; ctx.fillStyle = '#fff';
                ctx.fillRect(l.x + (vert ? 0.66 : 0), l.y + (vert ? 0 : 0.66), vert ? 0.7 : l.w, vert ? l.h : 0.7);
            }
            ctx.restore();
        }
    }

    inRoom(e, room) { const R = { x: room.x0 * T - 24, y: room.y0 * T - 24, w: ROOM_W + 48, h: ROOM_H + 48 }; return cx(e) > R.x && cx(e) < R.x + R.w && cy(e) > R.y && cy(e) < R.y + R.h; }

    drawPickups(ctx, w, room) {
        const A = this.A;
        for (const p of w.pickups) {
            if (p.taken || !this.inRoom(p, room)) continue;
            const bob = Math.round(Math.sin(this.time * 4 + p.id) * 1 * 3) / 3;
            const img = A.items[p.kind];
            const gl = A.glows[p.kind];
            if (gl) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 5 + p.id);
                ctx.drawImage(gl, p.x - gl.pad, p.y - gl.pad + bob, gl.width / 3, gl.height / 3); ctx.restore();
            }
            ctx.drawImage(img, p.x, p.y + bob);
            if (p.kind === 'gem' || p.kind === 'biggem') {
                if (((this.time * 3 + p.id * 0.7) % 3) < 0.15) { ctx.fillStyle = '#fff'; ctx.fillRect(p.x + 1, p.y + 1 + bob, 1, 1); }
            }
        }
    }

    itemImg(it) {
        const A = this.A;
        if (it.kind === 'key') return [A.keys[it.color] || A.keys.gold, A.glows['key:' + it.color]];
        if (it.kind === 'chalice') return [it.chrome ? A.chromeChalice : A.chalice[Math.floor(this.time * 10) % A.chalice.length], A.glows.chalice];
        return [A.items[it.kind], A.glows[it.kind]];
    }

    drawItems(ctx, w, room, heldPass) {
        for (const it of w.items) {
            const held = it.holder === 'player';
            if (held !== heldPass) continue;
            if (it.holder === 'bat') continue;
            if (!this.inRoom(it, room)) continue;
            this.drawItem(ctx, it);
        }
        // the magnet's pull
        const mag = w.items.find((i) => i.kind === 'magnet');
        if (mag && !heldPass && w.roomOf(mag) === room.i) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff4060'; ctx.lineWidth = 0.5;
            for (const o of [...w.items, ...w.pickups]) {
                if (o === mag || o.taken || o.holder || !o.pulled || w.roomOf(o) !== room.i) continue;
                ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.time * 20);
                ctx.setLineDash([2, 2]); ctx.lineDashOffset = -this.time * 20;
                ctx.beginPath(); ctx.moveTo(cx(mag), cy(mag)); ctx.lineTo(cx(o), cy(o)); ctx.stroke();
            }
            ctx.restore();
        }
    }

    drawItem(ctx, it) {
        if (it.kind === 'bridge') { this.drawBridge(ctx, it); return; }
        const [img, gl] = this.itemImg(it);
        const x = Math.round(it.x * 3) / 3, y = Math.round(it.y * 3) / 3;
        if (gl) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = it.kind === 'chalice' ? 0.9 : 0.6;
            ctx.drawImage(gl, x - gl.pad, y - gl.pad, gl.width / 3, gl.height / 3); ctx.restore();
        }
        if (it.kind === 'pixel') { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.time * 7); }
        ctx.drawImage(img, x, y);
        ctx.globalAlpha = 1;
        if (it.kind === 'charge' && it.fuse > 0) {
            if (Math.sin(this.time * (10 + (2 - it.fuse) * 16)) > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y + 3, 2, 2); }
            ctx.strokeStyle = '#ff2a50'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(x + 4, y + 4, 8 + it.fuse * 6, 0, Math.PI * 2); ctx.stroke();
        }
        if (it.kind === 'lamp' && it.flare > 0) this.fx.ring(cx(it), cy(it), '#fff27a', 60, 0.3, 1);
    }

    drawBridge(ctx, it) {
        const v = it.orient === 'v' || it.h > it.w;
        ctx.save();
        if (it.laid) { ctx.shadowColor = '#ffd040'; ctx.shadowBlur = 4 * this.S; }
        ctx.fillStyle = '#3a2410';
        ctx.fillRect(it.x + (v ? 2 : 0), it.y + (v ? 0 : 2), it.w - (v ? 4 : 0), it.h - (v ? 0 : 4));
        ctx.fillStyle = '#c08040';
        if (v) for (let y = it.y + 1; y < it.y + it.h - 1; y += 4) ctx.fillRect(it.x + 3, y, it.w - 6, 2);
        else for (let x = it.x + 1; x < it.x + it.w - 1; x += 4) ctx.fillRect(x, it.y + 3, 2, it.h - 6);
        ctx.fillStyle = '#ffd040';
        if (v) { ctx.fillRect(it.x, it.y, 2, it.h); ctx.fillRect(it.x + it.w - 2, it.y, 2, it.h); }
        else { ctx.fillRect(it.x, it.y, it.w, 2); ctx.fillRect(it.x, it.y + it.h - 2, it.w, 2); }
        ctx.restore();
    }

    drawDragons(ctx, w, room) {
        const A = this.A;
        for (const d of w.dragons) {
            if (d.dead || !this.inRoom(d, room)) continue;
            const set = A.dragons[d.kind];
            const fi = d.mouth > 0.3 || d.tell > 0 || d.lunge > 0.36 ? 2 : Math.floor(d.anim * 6) % 2;
            const fr = set.frames[fi];
            const x = Math.round((cx(d) - 12) * 3) / 3, y = Math.round((d.y + d.h - 22) * 3) / 3;
            ctx.save();
            // shadow
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath(); ctx.ellipse(cx(d), d.y + d.h, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
            const flip = d.face < 0;
            ctx.translate(flip ? x + 24 : x, y);
            if (flip) ctx.scale(-1, 1);
            if (d.full > 0) { const s = 1 + Math.sin(this.time * 12) * 0.06; ctx.translate(12, 12); ctx.scale(s * 1.08, s); ctx.translate(-12, -12); }
            if (d.blink > 0) ctx.globalAlpha = 0.3 + 0.4 * Math.random();
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= d.tell > 0 ? 0.9 + Math.sin(this.time * 40) * 0.3 : 0.5;
            ctx.drawImage(fr.glow, -fr.glow.pad, -fr.glow.pad, fr.glow.width / 3, fr.glow.height / 3); ctx.restore();
            ctx.drawImage(d.hurt > 0 && Math.floor(d.hurt * 20) % 2 === 0 ? fr.white : fr.img, 0, 0);
            if (d.full > 0 && Math.floor(this.time * 8) % 2 === 0) { ctx.fillStyle = '#29e6ff'; ctx.fillRect(9, 13, 4, 4); }
            if (d.tell > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = d.cfg.ice ? '#a0f0ff' : '#ffb030'; ctx.globalAlpha = 0.6 + Math.sin(this.time * 50) * 0.4; ctx.fillRect(21, 8, 3, 3); }
            ctx.restore();
            if (d.biteT > 0 && Math.floor(this.time * 16) % 2 === 0) drawText(ctx, '!', cx(d), d.y - 12, '#ff2a50', { align: 'center' });
            if (d.shard) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
                ctx.drawImage(this.A.items.shard, cx(d) - 3, d.y - 10 + Math.sin(this.time * 4) * 1); ctx.restore();
            }
        }
    }

    drawBoss(ctx, w, room) {
        const b = w.boss;
        if (!b || !b.active || room.i !== b.room) return;
        const set = b.dull ? this.A.bossDull : this.A.boss;
        const p = w.player;
        const fi = b.state === 'diveTell' || b.state === 'laserTell' || b.state === 'laser' ? 2 : Math.floor(this.time * 5) % 2;
        const fr = set.frames[fi];
        const flip = cx(p) < cx(b);
        const x = cx(b) - 20, y = cy(b) - 22;
        ctx.save();
        if (b.state === 'rise') { ctx.globalAlpha = Math.max(0, 1 - b.t / 1.6); }
        if (b.dead) { ctx.globalAlpha = Math.max(0, b.dyingT / 2.2); }
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx(b), b.y + b.h + 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(flip ? x + 40 : x, y);
        if (flip) ctx.scale(-1, 1);
        if (b.state === 'diveTell' && Math.floor(this.time * 20) % 2) ctx.translate((Math.random() - 0.5) * 2, 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= b.dull ? 0.25 : 0.6 + 0.3 * Math.sin(this.time * 6);
        ctx.drawImage(fr.glow, -fr.glow.pad, -fr.glow.pad, fr.glow.width / 3, fr.glow.height / 3); ctx.restore();
        ctx.drawImage(b.hurt > 0 && Math.floor(b.hurt * 24) % 2 === 0 ? fr.white : fr.img, 0, 0);
        // chrome sheen: a bright band sweeping across
        if (!b.dull) {
            ctx.globalCompositeOperation = 'lighter';
            const sx = ((this.time * 30) % 80) - 20;
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 4, 0); ctx.lineTo(sx - 10, 40); ctx.lineTo(sx - 14, 40); ctx.fill();
        }
        ctx.restore();
        if (b.state === 'laserTell' || b.state === 'laser') {
            const R = w.roomRect(b.room);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            if (b.state === 'laserTell') { ctx.globalAlpha = Math.sin(this.time * 40) > 0 ? 0.6 : 0.2; ctx.fillStyle = '#ff2ece'; ctx.fillRect(R.x + 16, b.laserY - 0.5, ROOM_W - 32, 1); }
            else {
                ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff2ece'; ctx.fillRect(R.x + 16, b.laserY - 6, ROOM_W - 32, 12);
                ctx.globalAlpha = 0.9; ctx.fillStyle = '#ff9af0'; ctx.fillRect(R.x + 16, b.laserY - 3, ROOM_W - 32, 6);
                ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(R.x + 16, b.laserY - 1, ROOM_W - 32, 2);
            }
            ctx.restore();
        }
        if (b.dull && Math.floor(this.time * 4) % 2 === 0) drawText(ctx, 'NOW!', cx(b), b.y - 14, '#fff27a', { align: 'center', shadow: '#000' });
    }

    drawPlayer(ctx, w) {
        const p = w.player;
        if (p.dead) { this.trail.length = 0; return; }
        this.trail.push({ x: p.x, y: p.y, t: this.time, dash: p.dashT > 0 });
        while (this.trail.length && this.time - this.trail[0].t > (p.dashT > 0 ? 0.2 : 0.12)) this.trail.shift();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const tr of this.trail) {
            const a = 1 - (this.time - tr.t) / 0.2;
            ctx.globalAlpha = Math.max(0, a) * (tr.dash ? 0.5 : 0.22);
            ctx.fillStyle = tr.dash ? '#ff5ad2' : '#29e6ff';
            ctx.fillRect(tr.x, tr.y, 8, 8);
        }
        ctx.globalAlpha = 0.7 + this.pulse * 0.3;
        ctx.drawImage(this.squireGlow, cx(p) - 20, cy(p) - 20, 40, 40);
        ctx.restore();
        if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
        const x = Math.round(p.x * 3) / 3, y = Math.round(p.y * 3) / 3;
        ctx.fillStyle = '#0a4a6a'; ctx.fillRect(x, y, 8, 8);
        const g = ctx.createLinearGradient(x, y, x + 8, y + 8);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#7af4ff'); g.addColorStop(1, '#1aa8e0');
        ctx.fillStyle = p.slowT > 0 ? '#c0f0ff' : g; ctx.fillRect(x + 0.66, y + 0.66, 6.67, 6.67);
        // eyes
        const fx = p.face.x, fy = p.face.y;
        const ex = 4 + fx * 1.6, ey = 4 + fy * 1.6;
        const pxp = -fy, pyp = fx;
        ctx.fillStyle = '#04121e';
        ctx.fillRect(x + ex + pxp * 1.5 - 0.5, y + ey + pyp * 1.5 - 0.5, 1, 1.33);
        ctx.fillRect(x + ex - pxp * 1.5 - 0.5, y + ey - pyp * 1.5 - 0.5, 1, 1.33);
        // the slash
        const sb = w.slashBox();
        if (sb) {
            const k = 1 - p.slashT / 0.22;
            const a0 = Math.atan2(p.face.y, p.face.x);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath(); ctx.arc(cx(p), cy(p), 13, a0 - 1.3 + k * 0.4, a0 - 1.3 + 2.6 * Math.min(1, k * 1.6));
            ctx.strokeStyle = '#29e6ff'; ctx.globalAlpha = 0.45; ctx.lineWidth = 5 * (1 - k) + 1.5; ctx.stroke();
            ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1; ctx.lineWidth = 2.2 * (1 - k) + 0.6; ctx.stroke();
            ctx.restore();
        }
    }

    drawBat(ctx, w) {
        const b = w.bat;
        const room = w.map.rooms[w.room];
        if (!this.inRoom(b, room)) return;
        const fr = this.A.bat[b.stun > 0 ? 1 : Math.floor(this.time * 9) % 2];
        const x = Math.round((cx(b) - 8) * 3) / 3, y = Math.round((cy(b) - 5) * 3) / 3;
        ctx.save();
        if (b.carry) this.drawItem(ctx, b.carry);
        if (b.stun > 0) {
            ctx.globalAlpha = 0.6;
            ctx.translate(x + 8, y + 5); ctx.scale(1, -1); ctx.translate(-x - 8, -y - 5);
            ctx.drawImage(fr.img, x, y);
            ctx.restore();
            if (Math.floor(this.time * 2) % 2) drawText(ctx, 'Z', cx(b) + 6, b.y - 10, '#7affea');
            return;
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5; ctx.drawImage(fr.glow, x - fr.glow.pad, y - fr.glow.pad, fr.glow.width / 3, fr.glow.height / 3);
        // the glitch: RGB split copies
        if (Math.random() < 0.25) { ctx.globalAlpha = 0.5; ctx.drawImage(fr.img, x - 1, y); ctx.drawImage(fr.img, x + 1, y); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(fr.img, x, y);
        ctx.restore();
    }

    drawProjectiles(ctx, w) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of w.projectiles) {
            const col = s.kind === 'ice' ? ['#40e0ff', '#e0f8ff'] : s.kind === 'bossfire' ? ['#ff2ece', '#ffd0f8'] : ['#ff6a10', '#fff27a'];
            const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.6);
            g.addColorStop(0, col[1]); g.addColorStop(0.35, col[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 0.7, s.y - 0.7, 1.4, 1.4);
            if (Math.random() < 0.5) this.fx.trail(s.x, s.y, col[0], 1, 2);
        }
        ctx.restore();
    }

    drawMinis(ctx, w) {
        for (const m of w.minis) {
            for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
                const v = Math.random();
                if (v < 0.35) continue;
                ctx.fillStyle = v > 0.85 ? '#ff2ece' : v > 0.7 ? '#29e6ff' : '#e8f0ff';
                ctx.fillRect(m.x + i, m.y + j, 1, 1);
            }
        }
    }

    drawNull(ctx, w) {
        const n = w.nul;
        if (!n.active) return;
        const room = w.map.rooms[w.room];
        if (!this.inRoom(n, room)) return;
        const x = Math.round(n.x), y = Math.round(n.y);
        ctx.save();
        ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, n.w + 2, n.h + 2);
        for (let j = 0; j < n.h; j++) {
            const shift = Math.random() < 0.15 ? (Math.random() - 0.5) * 8 : 0;
            for (let i = 0; i < n.w; i++) {
                const v = Math.random();
                if (v < 0.3) continue;
                ctx.fillStyle = v > 0.94 ? '#ff2ece' : v > 0.88 ? '#29e6ff' : v > 0.6 ? '#ffffff' : '#606070';
                ctx.fillRect(x + i + shift, y + j, 1, 1);
            }
        }
        // tearing lines
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
            const yy = y + Math.random() * n.h;
            ctx.globalAlpha = 0.4; ctx.fillStyle = Math.random() < 0.5 ? '#ff2ece' : '#29e6ff';
            ctx.fillRect(x - 20 - Math.random() * 30, yy, 40 + n.w + Math.random() * 40, 0.66);
        }
        ctx.restore();
        if (n.stun > 0 && Math.floor(this.time * 6) % 2) drawText(ctx, 'STUN', cx(n), y - 10, '#29e6ff', { align: 'center' });
    }

    drawDark(ctx, w, room) {
        const S = this.S;
        const g = this.dark.getContext('2d');
        const rx = room.x0 * T, ry = room.y0 * T;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, this.dark.width, this.dark.height);
        g.fillStyle = 'rgba(2,0,6,0.93)';
        g.fillRect(0, 0, this.dark.width, this.dark.height);
        g.setTransform(S, 0, 0, S, -rx * S, -ry * S);
        g.globalCompositeOperation = 'destination-out';
        const hole = (x, y, r, a = 1) => {
            const gr = g.createRadialGradient(x, y, r * 0.15, x, y, r);
            gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.75})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        };
        const p = w.player;
        const lamp = w.items.find((i) => i.kind === 'lamp');
        const flick = 1 + Math.sin(this.time * 13) * 0.03 + Math.sin(this.time * 7.3) * 0.03;
        if (!p.dead) hole(cx(p), cy(p), (lamp && lamp.holder === 'player' ? 72 : 26) * flick);
        if (lamp && lamp.holder !== 'player' && w.roomOf(lamp) === room.i) hole(cx(lamp), cy(lamp), 62 * flick);
        if (lamp && lamp.flare > 0) hole(cx(lamp), cy(lamp), 130 * Math.min(1, lamp.flare));
        for (const s of w.projectiles) hole(s.x, s.y, 16, 0.8);
        for (const it of w.items) if (it.kind === 'chalice' && w.roomOf(it) === room.i) hole(cx(it), cy(it), 18, 0.7);
        for (const l of w.map.lasers) if (l.room === room.i && w.laserOn(l)) hole(l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h) / 2, 0.5);
        ctx.drawImage(this.dark, rx, ry, ROOM_W, ROOM_H);
        // dragon eyes glow in the dark
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const d of w.dragons) {
            if (d.dead || w.roomOf(d) !== room.i) continue;
            const ex = d.face > 0 ? cx(d) + 6.5 : cx(d) - 7.5, ey = d.y + d.h - 22 + 6;
            ctx.fillStyle = DRAGON_GLOW[d.kind]; ctx.globalAlpha = 0.8;
            ctx.fillRect(ex, ey, 1.4, 1.2);
            ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(ex + 0.7, ey + 0.6, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // ================================================================== HUD
    drawHUD(w) {
        const ctx = this.ctx;
        const s = w.session;
        const st = STYLES[w.map.realm.style];
        ctx.fillStyle = '#05020a'; ctx.fillRect(0, 0, W, PF_Y);
        const lg = ctx.createLinearGradient(0, 0, W, 0);
        lg.addColorStop(0, '#ff2ece'); lg.addColorStop(0.5, '#ffb03a'); lg.addColorStop(1, '#29e6ff');
        ctx.fillStyle = lg; ctx.fillRect(0, PF_Y - 1, W, 1);
        ctx.fillStyle = '#05020a'; ctx.fillRect(0, PF_Y + ROOM_H, W, H - PF_Y - ROOM_H);
        ctx.fillStyle = lg; ctx.fillRect(0, PF_Y + ROOM_H, W, 1 / 3);

        if (Math.floor(this.time * 2.5) % 2 === 0 || w.player.dead) drawText(ctx, '1UP', 4, 3, '#ff5ad2');
        drawText(ctx, String(s.score).padStart(7, '0'), 26, 3, '#ffffff');
        drawText(ctx, 'HI', 84, 3, '#ffb03a');
        drawText(ctx, String(Math.max(this.hi, s.score)).padStart(7, '0'), 98, 3, '#ffe680');
        const realmLabel = `REALM ${w.realmIndex + 1}${w.loop > 1 ? '-' + w.loop : ''}`;
        drawText(ctx, realmLabel, 186, 3, st.hud);

        // lives
        for (let i = 0; i < Math.min(s.lives, 6); i++) { ctx.fillStyle = '#29e6ff'; ctx.fillRect(4 + i * 7, 14, 5, 5); ctx.fillStyle = '#fff'; ctx.fillRect(4 + i * 7, 14, 2, 2); }
        if (s.lives > 6) drawText(ctx, `+${s.lives - 6}`, 46, 13, '#29e6ff');
        // shield pips
        drawText(ctx, 'SH', 60, 13, '#7a8090');
        for (let i = 0; i < 3; i++) {
            const on = i < w.player.pips;
            ctx.fillStyle = on ? (w.player.pips === 1 ? (Math.floor(this.time * 6) % 2 ? '#ff2a50' : '#ff8090') : '#3aff7a') : '#1a2a1e';
            ctx.fillRect(74 + i * 7, 14, 5, 5);
        }
        // held item
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = 1; ctx.strokeRect(101.5, 11.5, 24, 16);
        const h = w.player.held;
        if (h) {
            if (h.kind === 'bridge') { ctx.fillStyle = '#ffd040'; ctx.fillRect(106, 15, 14, 2); ctx.fillRect(106, 21, 14, 2); ctx.fillStyle = '#c08040'; for (let x = 107; x < 120; x += 3) ctx.fillRect(x, 17, 2, 4); }
            else { const [img] = this.itemImg(h); ctx.drawImage(img, Math.round(113.5 - img.width / 2), Math.round(19.5 - img.height / 2)); }
        }
        // room name and status
        const R = w.map.rooms[w.room];
        drawText(ctx, R ? R.name : '', 4, 23, st.name);
        let status = '', scol = '#fff';
        if (w.collapseT > 0) { status = `COLLAPSE ${Math.ceil(w.collapseT)}`; scol = Math.floor(this.time * 4) % 2 ? '#ff2a50' : '#fff27a'; }
        else if (w.nul.active) { status = 'THE NULL HUNTS'; scol = Math.floor(this.time * 3) % 2 ? '#ff2ece' : '#29e6ff'; }
        else if (w.t > w.parT - 30) { status = `GLITCH IN ${Math.max(0, Math.ceil(w.parT - w.t))}`; scol = Math.floor(this.time * 3) % 2 ? '#ff2ece' : '#ffffff'; }
        else if (w.realm.boss && w.shards < 3) { status = `SHARDS ${w.shards}/3`; scol = '#e8f0ff'; }
        else { const left = Math.max(0, Math.ceil(w.parT - w.t)); status = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; scol = '#7a8090'; }
        drawText(ctx, status, 130, 13, scol);

        // minimap
        const M = w.map;
        const cw = 7, chh = 4;
        const mx = W - 4 - M.cols * (cw + 1), my = 12;
        const chal = w.items.find((i) => i.kind === 'chalice');
        M.rooms.forEach((r, i) => {
            if (!r) return;
            const x = mx + r.c * (cw + 1), y = my + r.r * (chh + 1);
            const seen = w.visited[i];
            ctx.fillStyle = seen ? (r.ch === 'h' ? '#ffb03a' : r.castle ? (CASTLE[r.castle] || CASTLE.gold)[0] : st.hud + '88') : '#1a1424';
            ctx.fillRect(x, y, cw, chh);
            if (i === w.room && Math.floor(this.time * 4) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, cw, chh); }
        });
        if (chal && w.chaliceSeen) {
            const ci = w.roomOf(chal), r = M.rooms[ci];
            if (r) { ctx.fillStyle = Math.floor(this.time * 8) % 2 ? '#fff27a' : '#ff2ece'; ctx.fillRect(mx + r.c * (cw + 1) + 3, my + r.r * (chh + 1) + 1, 2, 2); }
        }

        // bottom ticker
        drawText(ctx, `CREDIT ${this.credits}`, 4, 233, '#7a8090');
        let hint = w.realm.blurb[0];
        if (h && h.kind === 'chalice') hint = 'CARRY THE CHALICE TO THE SUNSET KEEP';
        else if (w.boss && w.boss.active && !w.boss.dead) hint = 'STRIKE WHEN HIS CHROME GOES DULL';
        else if (Math.floor(this.time / 6) % 2) hint = w.realm.blurb[1];
        drawText(ctx, hint, W - 4, 233, '#a090b8', { align: 'right' });
    }

    drawMessages() {
        const ctx = this.ctx;
        let y = PF_Y + 70;
        for (const m of this.msgs) {
            const a = Math.min(1, m.t * 2, (m.dur - m.t) * 6);
            ctx.globalAlpha = a;
            const pop = 1;
            drawText(ctx, m.text, W / 2, y, m.color, { align: 'center', scale: 2 * pop, shadow: '#000', glow: m.color });
            if (m.sub) drawText(ctx, m.sub, W / 2, y + 18, '#ffffff', { align: 'center', shadow: '#000' });
            y += m.sub ? 32 : 22;
        }
        ctx.globalAlpha = 1;
    }
}
