// ============================================================
// Title, overworld map, level card, pause, gadget-get, game over and the
// ending. Immediate-mode: every draw registers its tappable rectangles in
// view.buttons (internal pixel coordinates), and main.js hit-tests taps
// against last frame's list.
// ============================================================

import { WORLDS, LEVEL_NAMES, GADGET_INFO, KEEP_SHARDS, TILE } from './config.js';
import { NES, INK, col } from './art.js';
import { mod } from './rng.js';

const GATE_ICON = { high: 'i_boots', bubble: 'i_frost', shaft: 'i_mitts', red: 'i_rocket' };
const GATE_NEEDS = { high: 'boots', bubble: 'frost', shaft: 'mitts', red: 'rocket' };

function button(R, view, id, label, x, y, w, h, selected, color = NES[0x30]) {
    const fill = selected ? col(0x16) : '#2a1f3d';
    R.panel(x, y, w, h, fill, selected ? NES[0x38] : NES[0x10]);
    R.text(label, x + w / 2, y + Math.round((h - 7) / 2), selected ? NES[0x30] : color, 'c');
    view.buttons.push({ id, x, y, w, h });
}

export function menuButtons(R, view, items, sel, cx, y0, w, h = 14, gap = 4) {
    items.forEach((it, i) => button(R, view, it.id, it.label, Math.round(cx - w / 2), y0 + i * (h + gap), w, h, i === sel, it.color));
}

// ------------------------------------------------------------ title
export function drawTitle(R, view, t, items, sel) {
    const art = R.art;
    const th = art.theme('meadow');
    const W = R.W, H = R.H;
    R.sky('meadow', th.sky);
    const bg = th.bg;
    for (const [img, f] of [[bg.far, 10], [bg.mid, 22], [bg.near, 40]]) {
        const ox = -mod(Math.round(t * f), bg.W);
        for (let X = ox; X < W; X += bg.W) R.x.drawImage(img, X, H - 22 - bg.H + 20);
    }
    // ground strip
    const gy = H - 22;
    const [sx, sy] = th.slots.g1, [fx, fy] = th.slots.g0;
    const off = -mod(Math.round(t * 40), 16);
    for (let X = off; X < W; X += 16) { R.x.drawImage(th.atlas, sx, sy, 16, 16, X, gy, 16, 16); R.x.drawImage(th.atlas, fx, fy, 16, 16, X, gy + 16, 16, 16); }
    // logo
    const scale = W >= 300 ? 3 : 2;
    const ly = Math.round(H * 0.12);
    const bounce = i => Math.round(Math.sin(t * 4 + i * 0.6) * 2);
    const word = (s, y, colors) => {
        const w = R.textWidth(s, scale);
        let x = Math.round(W / 2 - w / 2);
        [...s].forEach((ch, i) => {
            const c = colors[i % colors.length];
            const yy = y + bounce(i);
            for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [2, 2], [1, 2], [2, 1]]) R.text(ch, x + ox, yy + oy, INK, 'l', scale, false);
            R.text(ch, x, yy, c, 'l', scale, false);
            x += 6 * scale;
        });
    };
    word('POPGUN', ly, [NES[0x28], NES[0x27], NES[0x16]]);
    word('PIP', ly + 8 * scale + 4, [NES[0x2a], NES[0x21], NES[0x24]]);
    R.text('A HOP AND POP ADVENTURE', W / 2, ly + 16 * scale + 10, NES[0x30], 'c');
    // Pip hopping along the ground
    const px = Math.round(W * 0.18 + Math.sin(t * 0.7) * W * 0.05);
    const hop = Math.abs(Math.sin(t * 5)) * 18;
    R.spr(hop > 4 ? 'pip_jump_fwd' : 'pip_run' + mod(Math.floor(t * 10), 4) + '_fwd', px, gy - 16 - Math.round(hop));
    R.spr('bug0', W - Math.round(W * 0.2), gy - 16, mod(Math.floor(t * 4), 2) === 1);
    const my = ly + 16 * scale + 26;
    const bw = Math.min(140, W - 40);
    menuButtons(R, view, items, sel, W / 2, Math.min(my, H - 34 - items.length * 18), bw);
}

// ------------------------------------------------------------ map
export function nodePositions(W, H) {
    const out = [];
    for (let i = 0; i < 5; i++) {
        const x = Math.round(W * (0.14 + 0.72 * i / 4));
        const y = Math.round(H * 0.52 + Math.sin(i * 1.9 + 0.5) * H * 0.12);
        out.push([x, y]);
    }
    return out;
}

export function drawMap(R, view, t, m) {
    // m = { world, sel, unlockedWorlds, levelInfo(i)->{name,state,shards[3],gates,locked}, totalShards, gadgets, walking }
    const art = R.art;
    const W = R.W, H = R.H;
    const wd = WORLDS[m.world - 1];
    const th = art.theme(wd.theme);
    // sea
    R.rect(0, 0, W, H, NES[0x12]);
    for (let y = 0; y < H; y += 6) for (let x = mod(Math.round(t * 8) + y * 3, 24) - 24; x < W; x += 24) R.rect(x, y, 6, 1, NES[0x22]);
    // island blob
    const ctx = R.x;
    const cx = W / 2, cy = H * 0.52, rx = W * 0.47, ry = H * 0.3;
    const blob = (grow, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let a = 0; a <= 64; a++) {
            const ang = a / 64 * Math.PI * 2;
            const wob = 1 + Math.sin(ang * 5 + m.world) * 0.06 + Math.sin(ang * 3 + m.world * 2) * 0.05;
            const x = cx + Math.cos(ang) * (rx + grow) * wob, y = cy + Math.sin(ang) * (ry + grow) * wob;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.fill();
    };
    blob(6, NES[0x31]);
    blob(2, INK);
    blob(0, col(th.th.top[1]));
    ctx.save(); ctx.globalAlpha = 0.5; blob(-10, col(th.th.top[0])); ctx.restore();
    const nodes = nodePositions(W, H);
    // path
    for (let i = 0; i < 4; i++) {
        const [x0, y0] = nodes[i], [x1, y1] = nodes[i + 1];
        const open = !m.levelInfo(i + 2).locked;
        for (let s = 0; s <= 12; s++) {
            const x = x0 + (x1 - x0) * s / 12, y = y0 + (y1 - y0) * s / 12;
            R.rect(x - 1, y - 1, 3, 3, INK);
            R.rect(x, y, 1, 1, open ? NES[0x38] : NES[0x2d]);
        }
    }
    // nodes
    { const [x, y] = nodes[4]; R.spr('castle', x - 24, y - 50); }
    nodes.forEach(([x, y], i) => {
        const info = m.levelInfo(i + 1);
        const r = 7;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 7); ctx.fill();
        ctx.fillStyle = info.locked ? NES[0x2d] : info.cleared ? NES[0x28] : NES[0x16]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        if (info.locked) R.text('?', x, y - 3, NES[0x10], 'c');
        else R.text(String(i === 4 ? 'C' : i + 1), x, y - 3, NES[0x30], 'c');
        // shard pips under the node
        if (i < 4 && !info.locked) for (let k = 0; k < 3; k++) R.spr(info.shards[k] ? 'ss' : 'se', x - 11 + k * 8, y + 10);
        view.buttons.push({ id: 'node' + i, x: x - 14, y: y - 14, w: 28, h: 28 });
    });
    // Pip on the selected node (or walking between two)
    const [px, py] = m.walk ? m.walk : nodes[m.sel];
    R.spr(m.walk ? 'pip_run' + mod(Math.floor(t * 10), 4) + '_none' : 'pip_idle_none', Math.round(px - 8), Math.round(py - 24 - Math.abs(Math.sin(t * 3)) * 3), m.walkDir < 0);

    // header
    R.rect(0, 0, W, 24, 'rgba(26,16,38,0.85)');
    // On narrow screens the header hugs the right edge, clear of the '← Games' link.
    const narrow = W < 320;
    const title = `WORLD ${m.world}  ${wd.name}`;
    const count = `${m.totalShards}/60`;
    const sw = R.textWidth(count) + 10;
    if (narrow) {
        R.text(title, W - 5, 4, NES[0x38], 'r');
        R.spr('ss', W - 5 - sw, 14);
        R.text(count, W - 5, 14, NES[0x30], 'r');
    } else {
        R.text(title, W / 2, 4, NES[0x38], 'c');
        R.spr('ss', Math.round(W / 2 - sw / 2), 14);
        R.text(count, Math.round(W / 2 - sw / 2) + 10, 14);
    }
    let gx = narrow ? W - 8 - sw : W - 6;
    for (const gname of ['rocket', 'mitts', 'frost', 'boots']) {
        if (m.gadgets.has(gname)) { const s = art.spr['i_' + gname]; R.x.drawImage(s.c, gx - 12, 12, 12, 12); gx -= 13; }
    }
    // world arrows
    if (m.world > 1) { button(R, view, 'prevWorld', '<', 2, Math.round(H * 0.45), 16, 22, false); }
    if (m.world < 5 && m.unlockedWorlds >= m.world + 1) { button(R, view, 'nextWorld', '>', W - 18, Math.round(H * 0.45), 16, 22, false); }

    // info panel
    const info = m.levelInfo(m.sel + 1);
    const ph = 44, py0 = H - ph - 4;
    R.panel(4, py0, W - 8, ph, '#1a1026', NES[0x10]);
    const lvlLabel = `${m.world}-${m.sel === 4 ? 'CASTLE' : m.sel + 1}`;
    R.text(lvlLabel, 10, py0 + 5, NES[0x38]);
    R.text(LEVEL_NAMES[wd.theme][m.sel], 10 + R.textWidth(lvlLabel) + 8, py0 + 5, NES[0x30]);
    let lx = 10;
    if (info.locked) {
        R.text(info.lockText || 'LOCKED', 10, py0 + 17, NES[0x2d]);
    } else if (m.sel < 4) {
        for (let k = 0; k < 3; k++) { R.spr(info.shards[k] ? 'ss' : 'se', lx, py0 + 16); lx += 9; }
        lx += 4;
        for (const g of info.gates || []) {
            const s = art.spr[GATE_ICON[g]];
            if (!s) continue;
            const have = m.gadgets.has(GATE_NEEDS[g]);
            // a locked gate still needs to read clearly: it is a to-do, not a nothing
            R.x.globalAlpha = have ? 1 : 0.75;
            R.x.drawImage(s.c, lx, py0 + 14, 12, 12);
            R.x.globalAlpha = 1;
            if (!have) R.text('!', lx + 13, py0 + 17, NES[0x28]);
            lx += have ? 13 : 19;
        }
        if (!info.gates) R.text('NOT VISITED', lx, py0 + 17, NES[0x2d]);
    } else {
        R.text(info.cleared ? 'BOSS DEFEATED' : 'BOSS: ' + bossName(m.world), 10, py0 + 17, info.cleared ? NES[0x2a] : NES[0x26]);
    }
    const bw = 56;
    if (!info.locked) button(R, view, 'play', 'PLAY', W - bw - 10, py0 + ph - 18, bw, 14, true);
    R.text(m.touch ? 'TAP A LEVEL' : 'ARROWS  Z PLAY', 10, py0 + ph - 13, NES[0x10]);
}

function bossName(w) { return ['CHOMPO', 'SIR SANDSNAKE', 'GLIMMERJAW', 'NIMBUS GRUMP', 'KING GRUMBLEWORT'][w - 1]; }

// ------------------------------------------------------------ card
export function drawCard(R, t, world, index, lives, name, loading) {
    const W = R.W, H = R.H;
    R.rect(0, 0, W, H, '#000000');
    const label = index === 5 ? `WORLD ${world}-CASTLE` : `WORLD ${world}-${index}`;
    R.text(label, W / 2, H * 0.3, NES[0x30], 'c', W > 260 ? 2 : 1);
    R.text(name, W / 2, H * 0.3 + 22, NES[0x38], 'c');
    R.text(WORLDS[world - 1].name, W / 2, H * 0.3 + 34, NES[0x10], 'c');
    R.spr('pip_idle_none', W / 2 - 22, H * 0.58);
    R.text('x ' + lives, W / 2 + 2, H * 0.58 + 5, NES[0x30]);
    if (loading) R.text('...', W / 2, H * 0.8, NES[0x2d], 'c');
}

// ------------------------------------------------------------ overlays
export function drawPause(R, view, items, sel, touch) {
    const W = R.W, H = R.H;
    R.x.globalAlpha = 0.6; R.rect(0, 0, W, H, '#000'); R.x.globalAlpha = 1;
    const pw = Math.min(170, W - 20), ph = 30 + items.length * 18 + (touch ? 4 : 44);
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
    R.panel(px, py, pw, ph);
    R.text('PAUSED', W / 2, py + 8, NES[0x38], 'c');
    menuButtons(R, view, items, sel, W / 2, py + 22, pw - 24);
    if (!touch) {
        const y = py + 26 + items.length * 18;
        R.text('Z JUMP  X SHOOT  C SWAP', W / 2, y, NES[0x10], 'c');
        R.text('UP AIM  DOWN IN AIR POUND', W / 2, y + 10, NES[0x10], 'c');
        R.text('P PAUSE  M MUSIC', W / 2, y + 20, NES[0x10], 'c');
    }
}

export function drawGadget(R, view, t, item, touch) {
    const W = R.W, H = R.H;
    R.x.globalAlpha = 0.75; R.rect(0, 0, W, H, '#000'); R.x.globalAlpha = 1;
    const info = GADGET_INFO[item] || { name: 'THE SUN CORE', lines: ['THE SUN CAN SHINE AGAIN!'], icon: 'i_sun' };
    const pw = Math.min(220, W - 16), ph = 96 + info.lines.length * 10;
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
    R.panel(px, py, pw, ph, '#1a1026', NES[0x38]);
    R.text('YOU GOT', W / 2, py + 8, NES[0x30], 'c');
    const s = R.art.spr[info.icon];
    const glow = 16 + Math.sin(t * 5) * 3;
    R.x.fillStyle = NES[0x27]; R.x.globalAlpha = 0.35; R.x.beginPath(); R.x.arc(W / 2, py + 38, glow, 0, 7); R.x.fill(); R.x.globalAlpha = 1;
    if (s) R.x.drawImage(s.c, Math.round(W / 2 - 16), py + 22, 32, 32);
    R.text(info.name, W / 2, py + 60, NES[0x38], 'c');
    info.lines.forEach((l, i) => R.text(l, W / 2, py + 74 + i * 10, NES[0x30], 'c'));
    if (t > 0.8) {
        const label = touch ? 'TAP TO GO ON' : 'PRESS Z TO GO ON';
        if (mod(Math.floor(t * 2), 2)) R.text(label, W / 2, py + ph - 12, NES[0x10], 'c');
        view.buttons.push({ id: 'ok', x: 0, y: 0, w: W, h: H });
    }
}

export function drawGameOver(R, view, t, touch) {
    const W = R.W, H = R.H;
    R.rect(0, 0, W, H, '#000');
    R.text('GAME OVER', W / 2, H * 0.35, NES[0x16], 'c', 2);
    R.text('YOUR PROGRESS IS SAFE', W / 2, H * 0.35 + 26, NES[0x30], 'c');
    R.spr('pip_hurt', W / 2 - 8, H * 0.55);
    if (t > 1.2) menuButtons(R, view, [{ id: 'continue', label: 'CONTINUE' }], 0, W / 2, Math.round(H * 0.72), 100);
    void touch;
}

export function drawEnding(R, view, t, stats) {
    const W = R.W, H = R.H;
    const ctx = R.x;
    const k = Math.min(1, t / 6);
    // sky brightening from night to day
    const top = k < 0.5 ? NES[0x02] : NES[0x21], bot = k < 0.5 ? NES[0x13] : NES[0x31];
    R.rect(0, 0, W, H / 2, top); R.rect(0, H / 2, W, H / 2, bot);
    const sunY = H * 0.75 - k * H * 0.45;
    ctx.fillStyle = NES[0x28]; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(W / 2, sunY, 34 + Math.sin(t * 3) * 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    R.x.drawImage(R.art.spr.sun.c, Math.round(W / 2 - 16), Math.round(sunY - 16), 32, 32);
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + t * 0.4;
        R.rect(W / 2 + Math.cos(a) * (40 + k * 10), sunY + Math.sin(a) * (40 + k * 10), 2, 2, NES[0x38]);
    }
    R.rect(0, H - 24, W, 24, NES[0x1a]);
    R.rect(0, H - 24, W, 2, NES[0x2a]);
    R.spr('pip_happy', W / 2 - 8 + Math.round(Math.sin(t * 2) * 30), H - 40 - Math.round(Math.abs(Math.sin(t * 6)) * 8));
    if (t > 3) {
        R.text('THE SUN SHINES AGAIN!', W / 2, 16, NES[0x30], 'c');
        R.text('KING GRUMBLEWORT SAYS SORRY.', W / 2, 28, NES[0x38], 'c');
    }
    if (t > 5) {
        R.text(`SHARDS ${stats.shards}/60   SCORE ${stats.score}`, W / 2, 44, NES[0x30], 'c');
        R.text(`POPS ${stats.kills}   OOPSES ${stats.deaths}`, W / 2, 54, NES[0x30], 'c');
        R.text('THANKS FOR PLAYING POPGUN PIP', W / 2, 70, NES[0x2a], 'c');
    }
    if (t > 7) menuButtons(R, view, [{ id: 'keepplaying', label: 'KEEP EXPLORING' }, { id: 'totitle', label: 'TITLE' }], stats.sel || 0, W / 2, Math.round(H * 0.5), 130);
}

export { TILE };
