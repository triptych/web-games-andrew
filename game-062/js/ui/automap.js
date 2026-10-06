// Diablo-style automap (Tab) and the round minimap, drawn from the tiles the hero has seen.

import { T, walkable, opaque } from '../sim/tiles.js';

const COL = { wall: 'rgba(255, 214, 140, 0.9)', floor: 'rgba(120, 80, 110, 0.35)', jam: 'rgba(200, 30, 80, 0.55)', punch: 'rgba(255, 90, 60, 0.7)', grass: 'rgba(90, 160, 80, 0.4)', path: 'rgba(220, 200, 160, 0.45)' };

function drawTiles(g, world, ox, oy, s, x0, y0, x1, y1) {
    const map = world.map, seen = world.seen, W = map.w;
    for (let y = Math.max(0, y0); y < Math.min(map.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        if (!seen[y * W + x] && !world.town) continue;
        const t = map.t[y * W + x];
        const px = ox + x * s, py = oy + y * s;
        if (walkable(t)) {
            g.fillStyle = t === T.JAM ? COL.jam : t === T.GRASS ? COL.grass : t === T.PATH ? COL.path : COL.floor;
            g.fillRect(px, py, s + 0.5, s + 0.5);
        } else if (t === T.PUNCH) { g.fillStyle = COL.punch; g.fillRect(px, py, s + 0.5, s + 0.5); }
        else if (opaque(t)) {
            // Draw wall edges facing open floor, like Diablo's line map.
            g.fillStyle = world.town ? 'rgba(60, 120, 50, 0.7)' : COL.wall;
            const e = Math.max(1, s * 0.28);
            if (walkable(map.at(x, y + 1)) || map.at(x, y + 1) === T.PUNCH) g.fillRect(px, py + s - e, s + 0.5, e);
            if (walkable(map.at(x, y - 1)) || map.at(x, y - 1) === T.PUNCH) g.fillRect(px, py, s + 0.5, e);
            if (walkable(map.at(x + 1, y)) || map.at(x + 1, y) === T.PUNCH) g.fillRect(px + s - e, py, e, s + 0.5);
            if (walkable(map.at(x - 1, y)) || map.at(x - 1, y) === T.PUNCH) g.fillRect(px, py, e, s + 0.5);
            if (t === T.BLOCK) { g.fillRect(px + s * 0.25, py + s * 0.25, s * 0.5, s * 0.5); }
        }
    }
}

function drawMarks(g, world, ox, oy, s) {
    const dot = (x, y, c, r) => { g.fillStyle = c; g.beginPath(); g.arc(ox + x * s, oy + y * s, r, 0, 6.283); g.fill(); };
    const W = world.map.w;
    const seenAt = (x, y) => world.town || world.seen[Math.floor(y) * W + Math.floor(x)];
    for (const o of world.objs) {
        if (!seenAt(o.x, o.y)) continue;
        if (o.type === 'down' || o.type === 'cellar') dot(o.x, o.y, '#a88aff', Math.max(3, s * 0.9));
        else if (o.type === 'up') dot(o.x, o.y, '#ffd08a', Math.max(3, s * 0.8));
        else if (o.type === 'portal') dot(o.x, o.y, '#ff9a5a', Math.max(3, s * 0.9));
        else if (o.type === 'well') dot(o.x, o.y, '#6ad8ff', Math.max(3, s * 0.9));
        else if (o.type === 'shrine' && o.state === 'idle') dot(o.x, o.y, '#ff9ae8', Math.max(2, s * 0.6));
        else if ((o.type === 'chest' || o.type === 'bigchest') && o.state === 'idle') dot(o.x, o.y, '#ffcc4a', Math.max(2, s * 0.5));
        else if ((o.type === 'lectern' || o.type === 'anvil') && o.state === 'idle') dot(o.x, o.y, '#7dffa6', Math.max(3, s * 0.8));
    }
    for (const n of world.npcs) dot(n.x, n.y, '#7dffa6', Math.max(2.5, s * 0.6));
    for (const m of world.mons) if (!m.dead && !m.burrowed && world.visibleTile(m.x, m.y)) dot(m.x, m.y, m.boss ? '#ff6a3a' : m.elite ? '#ffcc4a' : '#ff4a5a', Math.max(1.6, s * (m.boss ? 0.8 : 0.4)));
    const h = world.hero;
    g.save(); g.translate(ox + h.x * s, oy + h.y * s); g.rotate(h.face);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    const r = Math.max(4, s * 0.9);
    g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(-r * 0.8, r * 0.8); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.8, -r * 0.8); g.closePath(); g.fill(); g.stroke();
    g.restore();
}

export function drawMinimap(canvas, world) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, 6.283); g.clip();
    g.fillStyle = 'rgba(10, 4, 8, 0.55)'; g.fillRect(0, 0, W, H);
    const s = world.town ? 4 : 4.5;
    const h = world.hero;
    const ox = W / 2 - h.x * s, oy = H / 2 - h.y * s;
    const rad = Math.ceil(W / 2 / s) + 1;
    drawTiles(g, world, ox, oy, s, Math.floor(h.x) - rad, Math.floor(h.y) - rad, Math.floor(h.x) + rad, Math.floor(h.y) + rad);
    drawMarks(g, world, ox, oy, s);
    g.restore();
}

export function drawAutomap(canvas, world) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.floor(innerWidth * dpr), H = Math.floor(innerHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8, 2, 6, 0.45)'; g.fillRect(0, 0, W, H);
    const map = world.map;
    const s = Math.min((W * 0.86) / map.w, (H * 0.8) / map.h);
    const ox = (W - map.w * s) / 2, oy = (H - map.h * s) / 2;
    drawTiles(g, world, ox, oy, s, 0, 0, map.w, map.h);
    drawMarks(g, world, ox, oy, s);
}
