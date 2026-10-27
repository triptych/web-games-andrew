// The automap. Cells appear as they are seen (a straight line of sight, or a lit room) and are
// brighter once walked. Draws into a canvas with EGA colours only.

import { getEdge, cellIdx } from '../sim/dungeon.js';

/** o: { cell } fixed cell size and the view follows the party; otherwise the whole floor is fitted. */
export function drawMap(canvas, G, o = {}) {
    const f = G.floor, ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!f) return;
    const follow = !!o.cell;
    const cs = follow ? o.cell : Math.max(3, Math.floor(Math.min((W - 2) / f.w, (H - 2) / f.h)));
    let ox, oy;
    if (follow) { ox = Math.round(W / 2 - (G.pos.x + 0.5) * cs); oy = Math.round(H / 2 - (G.pos.y + 0.5) * cs); }
    else { ox = Math.floor((W - f.w * cs) / 2); oy = Math.floor((H - f.h * cs) / 2); }
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
    const C = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];
    const x0 = follow ? Math.max(0, Math.floor(-ox / cs) - 1) : 0, x1 = follow ? Math.min(f.w, Math.ceil((W - ox) / cs) + 1) : f.w;
    const y0 = follow ? Math.max(0, Math.floor(-oy / cs) - 1) : 0, y1 = follow ? Math.min(f.h, Math.ceil((H - oy) / cs) + 1) : f.h;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const s = f.seen[cellIdx(f, x, y)];
        if (!s) continue;
        const room = f.room[cellIdx(f, x, y)] >= 0;
        px(x * cs, y * cs, cs, cs, s === 2 ? (room ? C[1] : C[8]) : (room ? '#000055' : '#222222'));
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (!f.seen[cellIdx(f, x, y)]) continue;
        const lw = cs >= 8 ? 2 : 1;
        for (let d = 0; d < 4; d++) {
            const t = getEdge(f, x, y, d);
            if (!t) continue;
            const col = t === 2 ? C[6] : t === 4 ? C[14] : C[15];
            if (d === 0) px(x * cs, y * cs, cs, lw, col);
            else if (d === 2) px(x * cs, (y + 1) * cs - lw, cs, lw, col);
            else if (d === 3) px(x * cs, y * cs, lw, cs, col);
            else px((x + 1) * cs - lw, y * cs, lw, cs, col);
        }
    }
    // things on the floor
    const dot = (x, y, c, big = false) => {
        const m = Math.max(1, Math.floor(cs / 3));
        px(x * cs + Math.floor((cs - m * (big ? 2 : 1)) / 2), y * cs + Math.floor((cs - m * (big ? 2 : 1)) / 2), m * (big ? 2 : 1), m * (big ? 2 : 1), c);
    };
    for (const key of Object.keys(f.feat)) {
        const ft = f.feat[key];
        const [x, y] = key.split(',').map(Number);
        if (!f.seen[cellIdx(f, x, y)]) continue;
        if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
        switch (ft.type) {
            case 'down': dot(x, y, C[14], true); if (cs >= 6) px(x * cs + 1, y * cs + 1, 1, 1, C[0]); break;
            case 'up': dot(x, y, C[11], true); break;
            case 'chest': if (!ft.opened) dot(x, y, C[14]); break;
            case 'gather': if (ft.left > 0) dot(x, y, C[10]); break;
            case 'trap': if (ft.found || ft.sprung) dot(x, y, C[12]); break;
            case 'npc': if (!ft.done) dot(x, y, C[13], true); break;
            case 'spring': if (ft.left > 0) dot(x, y, C[9]); break;
            case 'altar': if (!ft.used) dot(x, y, C[5]); break;
            case 'relic': if (!ft.taken) dot(x, y, C[15], true); break;
            case 'sign': dot(x, y, C[7]); break;
            case 'den': if (!ft.done) dot(x, y, C[4]); break;
            case 'tablet': if (!ft.read) dot(x, y, C[11], true); break;
        }
    }
    // the party
    const p = G.pos, cx = ox + p.x * cs + cs / 2, cy = oy + p.y * cs + cs / 2, r = Math.max(2, cs * 0.45);
    ctx.fillStyle = C[12];
    ctx.beginPath();
    const a = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.d];
    const bx = -a[0] * r * 0.7, by = -a[1] * r * 0.7;
    ctx.moveTo(cx + a[0] * r, cy + a[1] * r);
    ctx.lineTo(cx + bx + a[1] * r * 0.8, cy + by - a[0] * r * 0.8);
    ctx.lineTo(cx + bx - a[1] * r * 0.8, cy + by + a[0] * r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C[14];
    ctx.lineWidth = 1;
    ctx.stroke();
}
