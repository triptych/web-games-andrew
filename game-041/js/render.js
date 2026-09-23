// ============================================================
// Everything the player sees, drawn through the WebGL batcher.
// Immediate-mode UI: controls register their hit rects in view.buttons
// as they are drawn, and input.js tests pointers against last frame's list.
// ============================================================

import {
    COLS, ROWS, CORE, TOWERS, TOWER_ORDER, EDGE_COLORS, SURFACE_EDGE, stratumOf,
    upgradeCost, towerValue, SELL_RATE, WAVES_PER_ROUND, CORE_HP,
} from './config.js';
import { DIRT, TUNNEL, DOT_PELLET, DOT_ORE, DOT_GEM, DX, DY } from './world.js';
import { rgba, WHITE } from './gl.js';
import { textWidth } from './font.js';

const SKY = rgba('#0a0f2e');
const TUNNEL_COL = rgba('#07060e');
const PELLET = rgba('#ffe4b8');
const PANEL = rgba('#0a0c1e', 0.88);
const SHADOW = rgba('#000000', 0.55);
const YELLOW = '#ffd820', CYAN = '#4ff0ff', PINK = '#ff3a78', GREEN = '#5aff6a', ORANGE = '#ff8c10';
const HALF_PI = Math.PI / 2;

const hash3 = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % 3;

function box(R, x, y, w, h, lw, col) {
    R.rect(x, y, w, lw, col);
    R.rect(x, y + h - lw, w, lw, col);
    R.rect(x, y + lw, lw, h - lw * 2, col);
    R.rect(x + w - lw, y + lw, lw, h - lw * 2, col);
}

function panel(R, r, colHex, { active = false, enabled = true, lw = 2 } = {}) {
    R.rect(r.x, r.y, r.w, r.h, PANEL);
    if (active) R.rect(r.x, r.y, r.w, r.h, rgba(colHex, 0.28));
    box(R, r.x, r.y, r.w, r.h, lw, rgba(colHex, enabled ? 0.95 : 0.35));
}

/** Largest whole font-pixel size so `str` fits in maxW (and at most `cap`). */
function fitPx(str, maxW, cap) {
    const w = textWidth(str, 1);
    return Math.max(1, Math.min(cap, Math.floor(maxW / Math.max(1, w))));
}

// ================================================================ world
export function drawWorld(R, g, L, T) {
    const F = L.field, ts = F.tile, w = g.world;
    const sh = g.shake * L.dpr;
    const ox = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    const oy = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    const x0 = F.x + ox, y0 = F.y + oy;
    const X = c => x0 + (c + 0.5) * ts;
    const Y = r => y0 + (r + 0.5) * ts;
    const lw = Math.max(2, Math.round(ts / 12));

    R.clip(F);

    // --- terrain
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const i = w.idx(c, r);
            const px = x0 + c * ts, py = y0 + r * ts;
            if (w.tile[i] === DIRT) R.sprite(`dirt${stratumOf(r)}_${hash3(c, r)}`, px + ts / 2, py + ts / 2, ts, ts);
            else R.rect(px, py, ts, ts, r === 0 ? SKY : TUNNEL_COL);
        }
    }
    // Stars in the sky lane.
    for (let k = 0; k < 9; k++) {
        const sx = x0 + ((k * 137) % COLS + 0.3) * ts, sy = y0 + (0.15 + ((k * 53) % 5) * 0.08) * ts;
        R.rect(sx, sy, Math.max(1, ts / 20), Math.max(1, ts / 20), rgba('#ffffff', 0.25 + 0.25 * Math.sin(T * 2 + k)));
    }

    // --- tunnels being carved right now
    const carve = (fx, fy, tx, ty, t) => {
        const dx = tx - fx, dy = ty - fy, len = t * ts;
        if (dx > 0) R.rect(X(fx) + ts / 2, Y(fy) - ts / 2, len, ts, TUNNEL_COL);
        else if (dx < 0) R.rect(X(fx) - ts / 2 - len, Y(fy) - ts / 2, len, ts, TUNNEL_COL);
        else if (dy > 0) R.rect(X(fx) - ts / 2, Y(fy) + ts / 2, ts, len, TUNNEL_COL);
        else if (dy < 0) R.rect(X(fx) - ts / 2, Y(fy) - ts / 2 - len, ts, len, TUNNEL_COL);
    };
    const p = g.player;
    if (!p.dead && p.digging) carve(p.fx, p.fy, p.tx, p.ty, p.t);
    for (const e of g.enemies) if (e.digging && !e.dead) carve(e.fx, e.fy, e.tx, e.ty, e.t);

    // --- neon tunnel walls
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (w.tile[w.idx(c, r)] !== TUNNEL) continue;
            const col = rgba(r === 0 ? SURFACE_EDGE : EDGE_COLORS[stratumOf(r)]);
            const px = x0 + c * ts, py = y0 + r * ts;
            const wall = (nc, nr) => !w.inb(nc, nr) ? nr >= 0 : w.tile[w.idx(nc, nr)] === DIRT;
            if (wall(c + 1, r)) R.rect(px + ts - lw, py, lw, ts, col);
            if (wall(c - 1, r)) R.rect(px, py, lw, ts, col);
            if (wall(c, r + 1)) R.rect(px, py + ts - lw, ts, lw, col);
            if (r > 0 && wall(c, r - 1)) R.rect(px, py, ts, lw, col);
        }
    }

    // --- dots
    const ps = Math.max(2, Math.round(ts * 0.16));
    for (let r = 1; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const d = w.dot[w.idx(c, r)];
            if (!d) continue;
            const cx = X(c), cy = Y(r);
            if (d === DOT_PELLET) R.rect(Math.round(cx - ps / 2), Math.round(cy - ps / 2), ps, ps, PELLET);
            else if (d === DOT_ORE) {
                const a = 0.45 + 0.4 * Math.max(0, Math.sin(T * 2.2 + c * 1.7 + r * 2.9));
                R.sprite('ore', cx, cy, ts * 6 / 16, ts * 6 / 16, { col: rgba('#ffffff', a) });
            } else if (d === DOT_GEM) {
                if (Math.floor(T * 4) % 2 === 0 || g.phase !== 'play') {
                    const hue = ['#ff40a8', '#4ff0ff', '#ffd820', '#b456ff'][Math.floor(T * 3) % 4];
                    R.sprite('gem', cx, cy, ts * 0.62, ts * 0.62, { col: rgba(hue) });
                }
            }
        }
    }

    // --- the core
    {
        const cx = X(CORE.c), cy = Y(CORE.r);
        R.blend('add');
        const pulse = 0.5 + 0.5 * Math.sin(T * 3);
        R.ring(cx, cy - ts * 0.1, ts * (0.62 + 0.08 * pulse), lw, rgba(g.coreFlash > 0 ? PINK : CYAN, 0.35 + 0.3 * pulse), 28);
        R.blend('alpha');
        const hit = g.coreFlash > 0 && Math.floor(T * 20) % 2 === 0;
        R.sprite(Math.floor(T * 2) % 2 ? 'core1' : 'core0', cx, cy, ts, ts, hit ? { flash: 1, col: rgba(PINK) } : undefined);
    }

    // --- build mode
    if (g.buildType) {
        const def = TOWERS[g.buildType];
        const afford = g.gold >= def.cost;
        const pulse = 0.18 + 0.1 * Math.sin(T * 6);
        for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (!g.canBuild(c, r, null)) continue;
            const px = x0 + c * ts, py = y0 + r * ts;
            R.rect(px + lw, py + lw, ts - lw * 2, ts - lw * 2, rgba(afford ? GREEN : PINK, pulse));
        }
        if (L.hover && g.canBuild(L.hover.c, L.hover.r, null)) {
            const L0 = def.levels[0];
            R.blend('add');
            R.ring(X(L.hover.c), Y(L.hover.r), L0.range * ts, lw, rgba(def.color, 0.8));
            R.blend('alpha');
            R.sprite('towerBase', X(L.hover.c), Y(L.hover.r), ts, ts, { col: rgba('#ffffff', 0.6) });
        }
    }

    // --- rocks
    for (const k of g.rocks) {
        const wob = k.state === 'wobble' ? Math.sin(T * 70) * ts * 0.07 : 0;
        const a = k.state === 'crumble' ? Math.max(0, k.t / 0.5) : 1;
        R.sprite(k.state === 'crumble' ? 'rockCrack' : 'rock', X(k.c) + wob, Y(k.y), ts, ts, { col: rgba('#ffffff', a) });
    }

    // --- towers
    for (const t of g.towers) {
        const def = TOWERS[t.type];
        const cx = X(t.c), cy = Y(t.r);
        const L0 = def.levels[t.lvl];
        if (t.type === 'frost') {
            R.blend('add');
            R.ring(cx, cy, L0.range * ts * (0.92 + 0.08 * Math.sin(T * 3 + t.c)), Math.max(1, lw / 2), rgba(def.color, 0.22), 36);
            R.blend('alpha');
        }
        R.sprite('towerBase', cx, cy, ts, ts);
        const rot = def.rotates ? t.angle : (t.type === 'frost' ? t.spin : 0);
        const scale = t.type === 'arc' ? 0.86 + 0.06 * Math.sin(T * 9 + t.r) : 0.92;
        R.sprite(def.head, cx, cy, ts * scale, ts * scale, t.flash > 0 ? { rot, flash: 1, col: WHITE } : { rot });
        const pw = Math.max(2, Math.round(ts * 0.14)), phh = Math.max(2, Math.round(ts * 0.08));
        for (let i = 0; i <= t.lvl; i++) {
            R.rect(Math.round(x0 + t.c * ts + ts * 0.16 + i * ts * 0.24), Math.round(y0 + t.r * ts + ts - phh - lw), pw, phh, rgba(def.color));
        }
        if (g.selected === t) {
            R.blend('add');
            R.ring(cx, cy, L0.range * ts, lw, rgba(def.color, 0.9));
            R.blend('alpha');
            box(R, x0 + t.c * ts, y0 + t.r * ts, ts, ts, lw, rgba('#ffffff', 0.5 + 0.5 * Math.sin(T * 8)));
        }
    }

    // --- bonus veggie
    if (g.veg && (g.veg.t > 3 || Math.floor(T * 8) % 2)) {
        R.sprite(g.veg.kind, X(g.veg.c), Y(g.veg.r), ts, ts);
    }

    // --- enemies
    for (const e of g.enemies) {
        if (e.dead) continue;
        drawEnemy(R, g, e, X(e.x), Y(e.y), ts, T);
        if (e.state === 'fire') {
            const dir = e.face === 2 ? -1 : 1;
            const fr = Math.floor(T * 14) % 2 ? 'fire1' : 'fire0';
            for (let k = 1; k <= 3; k++) {
                const c = e.fx + dir * k;
                if (c < 0 || c >= COLS) break;
                R.sprite(fr, X(c), Y(e.fy), ts, ts, { flipX: dir < 0 });
            }
        }
    }

    // --- player
    drawPlayer(R, g, X, Y, ts, T, lw);

    // --- projectiles & fx (additive glow)
    R.blend('add');
    for (const s of g.shots) {
        const sz = Math.max(2, ts * 0.14);
        R.rect(X(s.x) - sz, Y(s.y) - sz, sz * 2, sz * 2, rgba(s.col, 0.25));
        R.rect(X(s.x) - sz / 2, Y(s.y) - sz / 2, sz, sz, rgba('#fff4c0'));
    }
    for (const sh of g.shells) {
        const x = sh.x0 + (sh.x1 - sh.x0) * sh.t, y = sh.y0 + (sh.y1 - sh.y0) * sh.t - Math.sin(Math.PI * sh.t) * 1.2;
        R.sprite('disc', X(x), Y(y), ts * 0.32, ts * 0.32, { col: rgba('#ff9a3a') });
        R.sprite('disc', X(x), Y(y), ts * 0.16, ts * 0.16, { col: rgba('#fff0c0') });
    }
    for (const b of g.bolts) drawBolt(R, b, X, Y, ts, lw);
    for (const q of g.rings) R.ring(X(q.x), Y(q.y), q.r * ts, lw, rgba(q.col, Math.max(0, q.life / q.max)), 32);
    for (const q of g.parts) {
        const a = Math.max(0, Math.min(1, q.life / q.max * 1.4));
        const s = Math.max(2, q.size * ts);
        R.rect(X(q.x) - s / 2, Y(q.y) - s / 2, s, s, rgba(q.col, a));
    }
    R.blend('alpha');

    // --- score popups
    const fp = Math.max(1, Math.round(ts / 15));
    for (const q of g.pops) {
        const a = Math.min(1, q.life * 2);
        R.text(q.text, X(q.x) + fp, Y(q.y) + fp, fp, rgba('#000000', a * 0.7), 'center');
        R.text(q.text, X(q.x), Y(q.y), fp, rgba(q.col, a), 'center');
    }

    // --- boss bar
    const king = g.enemies.find(e => e.def.boss && !e.dead);
    if (king) {
        const bw = F.w - ts * 2, bh = Math.max(4, Math.round(ts * 0.22));
        const bx = F.x + ts, by = F.y + F.h - ts * 0.6;
        R.rect(bx, by, bw, bh, rgba('#200010', 0.85));
        R.rect(bx, by, bw * Math.max(0, king.hp / king.maxHp), bh, rgba(PINK));
        box(R, bx, by, bw, bh, Math.max(1, lw / 2), rgba('#ffffff', 0.6));
        R.text('KING', bx, by - fp * 9, fp, rgba(PINK));
    }

    // --- build hint strip on the surface
    if (g.buildType && g.phase === 'play') {
        const def = TOWERS[g.buildType];
        const msg = g.gold >= def.cost ? 'TAP DIRT: ' + def.name : 'NEED ' + def.cost + ' GOLD';
        const hp = fitPx(msg, F.w * 0.9, Math.max(1, Math.round(ts / 10)));
        R.rect(F.x, F.y, F.w, ts, rgba('#000000', 0.6));
        R.text(msg, F.x + F.w / 2, F.y + ts / 2 - hp * 3.5, hp, rgba(g.gold >= def.cost ? GREEN : PINK), 'center');
    }

    R.clip(null);

    // Field frame: a double neon rule, vector-monitor style.
    const fl = Math.max(2, Math.round(lw * 0.75));
    box(R, F.x - fl * 3, F.y - fl * 3, F.w + fl * 6, F.h + fl * 6, fl, rgba('#4ff0ff', 0.9));
    box(R, F.x - fl * 6, F.y - fl * 6, F.w + fl * 12, F.h + fl * 12, Math.max(1, fl / 2), rgba('#b456ff', 0.7));

    drawBanner(R, g, L, T);
}

function drawEnemy(R, g, e, cx, cy, ts, T) {
    const f = Math.floor(e.anim * (e.type === 'skitter' ? 11 : 6)) % 2;
    let name, size = ts, h = ts;
    const o = { flipX: e.face === 2 };
    if (e.ghost) {
        name = 'eyes';
        o.col = rgba('#ffffff', 0.55 + 0.35 * Math.sin(T * 12));
    } else if (e.frightened) {
        const flash = g.fright < 2 && Math.floor(T * 5) % 2 === 0;
        name = (flash ? 'scaredW' : 'scared') + f;
    } else if (e.type === 'king') {
        name = 'king' + f; size = ts * 2; h = ts * 2.5; cy -= ts * 0.45;
    } else {
        name = e.type + f;
        if (e.type === 'borer' && (e.dir === 1 || e.dir === 3)) {
            o.rot = e.dir === 1 ? HALF_PI : -HALF_PI;
            o.flipX = false;
            o.flipY = e.face === 2;
        }
    }
    if (e.state === 'charge' && Math.floor(T * 16) % 2) { o.flash = 1; o.col = rgba('#ff5020'); }
    if (e.hitT > 0) { o.flash = 1; o.col = WHITE; }
    let sc = 1;
    if (e.inflate > 0) {
        sc = 1 + e.inflate * (e.def.boss ? 0.05 : 0.17);
        sc += Math.sin(T * 30) * 0.02 * e.inflate;
    }
    R.sprite(name, cx, cy, size * sc, h * sc, o);
    if (!e.def.boss && !e.ghost && e.hp < e.maxHp && e.hp > 0) {
        const bw = ts * 0.7, bh = Math.max(2, Math.round(ts * 0.07));
        const bx = cx - bw / 2, by = cy - ts * 0.56 * sc;
        const k = Math.max(0, e.hp / e.maxHp);
        R.rect(bx, by, bw, bh, rgba('#000000', 0.7));
        R.rect(bx, by, bw * k, bh, rgba(k > 0.5 ? GREEN : k > 0.25 ? YELLOW : PINK));
    }
}

function drawPlayer(R, g, X, Y, ts, T, lw) {
    const p = g.player;
    const cx = X(p.x), cy = Y(p.y);
    if (p.dead) {
        if (p.deadT < 1.1) {
            const k = Math.min(1, p.deadT / 1.1);
            R.sprite('player0', cx, cy, ts * (1 - k * 0.9), ts * (1 - k * 0.9), { rot: k * 16 });
        }
        return;
    }
    const h = p.harpoon;
    if (h) {
        const ex = cx + DX[p.dir] * h.len * ts, ey = cy + DY[p.dir] * h.len * ts;
        const sx = cx + DX[p.dir] * ts * 0.35, sy = cy + DY[p.dir] * ts * 0.35;
        R.line(sx, sy, ex, ey, Math.max(2, lw * 0.8), rgba('#e0e0ff'));
        R.sprite('harpoon', ex, ey, ts * 0.5, ts * 0.5, { rot: [0, HALF_PI, Math.PI, -HALF_PI][p.dir] });
    }
    if (p.inv > 0 && Math.floor(T * 14) % 2) return;
    const frame = p.moving ? Math.floor(p.anim * 8) % 2 : 0;
    const o = {};
    if (p.dir === 2) o.flipX = true;
    else if (p.dir === 3) { o.rot = -HALF_PI; o.flipY = p.face === 2; }
    else if (p.dir === 1) { o.rot = HALF_PI; o.flipY = p.face === 2; }
    // A little squash on each pump.
    let sw = ts, sh = ts;
    if (h && h.state === 'attached' && p.pumpCd > 0.12) { sw = ts * 1.08; sh = ts * 0.9; }
    R.sprite('player' + frame, cx, cy, sw, sh, o);
}

function drawBolt(R, b, X, Y, ts, lw) {
    const a = Math.max(0, b.life / 0.2);
    let s = b.seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
    for (let i = 0; i + 3 < b.pts.length; i += 2) {
        let px = b.pts[i], py = b.pts[i + 1];
        const qx = b.pts[i + 2], qy = b.pts[i + 3];
        for (let k = 1; k <= 4; k++) {
            let nx = px + (qx - b.pts[i]) / 4, ny = py + (qy - b.pts[i + 1]) / 4;
            if (k < 4) { nx += rnd() * 0.35; ny += rnd() * 0.35; } else { nx = qx; ny = qy; }
            R.line(X(px), Y(py), X(nx), Y(ny), lw * 2.4, rgba('#b456ff', 0.35 * a));
            R.line(X(px), Y(py), X(nx), Y(ny), Math.max(1, lw * 0.8), rgba('#f4e0ff', a));
            px = nx; py = ny;
        }
    }
}

function drawBanner(R, g, L, T) {
    const b = g.banner;
    if (!b || b.t <= 0) return;
    const F = L.field, ts = F.tile;
    const fp = fitPx(b.text, F.w * 0.9, Math.max(2, Math.round(ts / 5)));
    const sp = b.sub ? fitPx(b.sub, F.w * 0.9, Math.max(1, Math.round(ts / 9))) : 0;
    const sp2 = b.sub2 ? fitPx(b.sub2, F.w * 0.9, Math.max(1, Math.round(ts / 11))) : 0;
    const cy = F.y + F.h * 0.42;
    const bandH = fp * 7 + (sp ? sp * 11 : 0) + (sp2 ? sp2 * 11 : 0) + ts * 0.8;
    const a = Math.min(1, b.t * 3);
    R.rect(F.x, cy - ts * 0.4, F.w, bandH, rgba('#000000', 0.62 * a));
    R.rect(F.x, cy - ts * 0.4, F.w, Math.max(2, fp / 2), rgba(b.col, 0.8 * a));
    R.rect(F.x, cy - ts * 0.4 + bandH - Math.max(2, fp / 2), F.w, Math.max(2, fp / 2), rgba(b.col, 0.8 * a));
    R.text(b.text, F.x + F.w / 2 + fp, cy + fp, fp, rgba('#000000', a), 'center');
    R.text(b.text, F.x + F.w / 2, cy, fp, rgba(b.col, a), 'center');
    let y = cy + fp * 7 + sp * 3;
    if (b.sub) {
        const blink = b.sub === 'READY!' ? (Math.floor(T * 4) % 2 ? 1 : 0.35) : 1;
        R.text(b.sub, F.x + F.w / 2, y, sp, rgba('#ffffff', a * blink), 'center');
        y += sp * 11;
    }
    if (b.sub2) R.text(b.sub2, F.x + F.w / 2, y, sp2, rgba(YELLOW, a), 'center');
}

// ================================================================ HUD
function pad6(n) { return String(Math.floor(n)).padStart(6, '0'); }

function corePips(R, x, y, h, hp, lw, T, flash) {
    const pw = Math.max(2, Math.round(h * 0.42)), gap = Math.max(1, Math.round(h * 0.14));
    for (let i = 0; i < CORE_HP; i++) {
        const on = i < hp;
        const col = on ? (hp <= 3 && Math.floor(T * 4) % 2 ? PINK : CYAN) : '#203040';
        R.rect(x + i * (pw + gap), y, pw, h, rgba(flash > 0 && on ? '#ffffff' : col, on ? 1 : 0.8));
    }
    return CORE_HP * (pw + gap);
}

export function drawHUD(R, g, L, T) {
    const H = L.hud, d = L.dpr;
    const white = rgba('#ffffff'), dim = rgba('#8890b8');
    if (!H.stacked) {
        // Portrait: row 1 beside the "<- Games" link, row 2 below it (the link is ~31 css px
        // tall at top 8). Row 1 budget at 390 css: link 88 + "1UP 000000" ~105 +
        // "HI 000000" ~95 + pause 50 = 338.
        const fp = Math.max(1, Math.round(1.75 * d));
        const y1 = H.y + Math.round(16 * d), y2 = H.y + Math.round(46 * d);
        let x = H.x + H.linkW;
        x += R.text('1UP', x, y1, fp, rgba(PINK)) + fp * 6;
        R.text(pad6(g.score), x, y1, fp, white);
        R.text('HI ' + pad6(Math.max(g.hi, g.score)), L.pause.x - Math.round(8 * d), y1, fp, dim, 'right');

        x = H.x;
        const ic = fp * 7;
        R.sprite('coin', x + ic / 2, y2 + ic / 2, ic, ic);
        x += ic + fp * 2;
        x += R.text(String(g.gold), x, y2, fp, rgba(YELLOW)) + fp * 7;
        x += R.text('W' + Math.max(1, g.wave) + '/' + WAVES_PER_ROUND, x, y2, fp, white) + fp * 7;
        R.sprite('coreIcon', x + ic / 2, y2 + ic / 2, ic, ic);
        x += ic + fp * 2;
        x += corePips(R, x, y2, ic, g.coreHp, 2, T, g.coreFlash) + fp * 5;
        for (let i = 0; i < Math.min(5, g.lives); i++) R.sprite('heart', x + ic / 2 + i * (ic + fp), y2 + ic / 2, ic, ic);
    } else {
        const fp = Math.max(1, Math.round(2 * d));
        const lh = fp * 11;
        let y = H.y;
        const x = H.x;
        R.text('1UP', x, y, fp, rgba(PINK)); y += fp * 9;
        R.text(pad6(g.score), x, y, fp, white); y += lh;
        R.text('HI ' + pad6(Math.max(g.hi, g.score)), x, y, fp, dim); y += lh + fp * 2;
        const ic = fp * 7;
        R.sprite('coin', x + ic / 2, y + ic / 2, ic, ic);
        R.text(String(g.gold), x + ic + fp * 3, y, fp, rgba(YELLOW)); y += lh;
        R.text('ROUND ' + g.round + '  W' + Math.max(1, g.wave) + '/' + WAVES_PER_ROUND, x, y, fp, white); y += lh;
        R.sprite('coreIcon', x + ic / 2, y + ic / 2, ic, ic);
        corePips(R, x + ic + fp * 3, y, ic, g.coreHp, 2, T, g.coreFlash); y += lh;
        for (let i = 0; i < Math.min(6, g.lives); i++) R.sprite('heart', x + ic / 2 + i * (ic + fp * 2), y + ic / 2, ic, ic);
        H.h = y + ic - H.y;
    }
}

// ================================================================ controls
function towerIcon(R, type, cx, cy, s) {
    R.sprite('towerBase', cx, cy, s, s);
    R.sprite(TOWERS[type].head, cx, cy, s * 0.92, s * 0.92, { rot: TOWERS[type].rotates ? -Math.PI / 4 : 0 });
}

export function drawControls(R, g, L, view, input, T) {
    const d = L.dpr, btns = view.buttons;
    const lw = Math.max(2, Math.round(1.5 * d));
    const fp = Math.max(1, Math.round(1.6 * d));
    const playing = g.phase === 'play' || g.phase === 'ready';

    // --- pause
    const P = L.pause;
    panel(R, P, CYAN, { lw });
    const bw = Math.max(2, Math.round(P.w * 0.12)), bh = Math.round(P.h * 0.42);
    R.rect(P.x + P.w * 0.34, P.y + (P.h - bh) / 2, bw, bh, rgba(CYAN));
    R.rect(P.x + P.w * 0.66 - bw, P.y + (P.h - bh) / 2, bw, bh, rgba(CYAN));
    btns.push({ id: 'pause', ...P });

    // --- tray
    const sel = g.selected;
    for (let i = 0; i < 5; i++) {
        const r = L.tray[i];
        if (i === 4) { drawGo(R, g, r, lw, fp, T, btns); continue; }
        if (sel) { drawSelSlot(R, g, sel, i, r, lw, fp, T, btns); continue; }
        const type = TOWER_ORDER[i], def = TOWERS[type];
        const afford = g.gold >= def.cost;
        const active = g.buildType === type;
        panel(R, r, def.color, { active, enabled: afford || active, lw });
        const s = Math.min(r.h * 0.52, r.w * 0.5);
        const wide = r.w > r.h * 1.7;
        const iconX = wide ? r.x + s * 0.5 + r.w * 0.12 : r.x + r.w / 2;
        const iconY = wide ? r.y + r.h / 2 : r.y + r.h * 0.38;
        towerIcon(R, type, iconX, iconY, s);
        if (!afford && !active) R.rect(r.x + lw, r.y + lw, r.w - lw * 2, r.h - lw * 2, rgba('#000000', 0.45));
        const label = String(def.cost);
        const ty = wide ? r.y + r.h / 2 - fp * 3.5 : r.y + r.h - fp * 9;
        const tx = wide ? iconX + s * 0.7 : r.x + r.w / 2 + fp * 4;
        const ic = fp * 7;
        if (wide) {
            R.sprite('coin', tx + ic / 2, ty + ic / 2, ic, ic);
            R.text(label, tx + ic + fp * 2, ty, fp, rgba(afford ? YELLOW : '#806040'));
            if (r.w > s * 3.6) R.text(def.name, tx, ty - fp * 10, Math.max(1, fp - 1), rgba(def.color, 0.9));
        } else {
            const tw = textWidth(label, fp) + ic + fp * 2;
            R.sprite('coin', r.x + (r.w - tw) / 2 + ic / 2, ty + ic / 2, ic, ic);
            R.text(label, r.x + (r.w - tw) / 2 + ic + fp * 2, ty, fp, rgba(afford ? YELLOW : '#806040'));
        }
        if (playing) btns.push({ id: 'build:' + type, ...r });
    }

    // --- pump
    const U = L.pump;
    const held = input.pumpButton !== null || input.pumpKey;
    R.sprite('disc', U.x, U.y, U.r * 2, U.r * 2, { col: rgba(held ? '#ff3a78' : '#2a0818', held ? 0.55 : 0.75) });
    R.sprite('ring', U.x, U.y, U.r * 2, U.r * 2, { col: rgba(PINK, 0.95) });
    const pf = fitPx('PUMP', U.r * 1.3, Math.max(1, Math.round(U.r / 14)));
    R.text('PUMP', U.x, U.y - pf * 3.5, pf, rgba('#ffffff'), 'center');
    btns.push({ id: 'pump', x: U.x - U.r, y: U.y - U.r, w: U.r * 2, h: U.r * 2, hold: true });

    // --- stick
    const S = L.stick;
    const st = input.stick;
    const rim = input.rim * d;
    if (st) {
        R.sprite('ring', st.ax, st.ay, rim * 2, rim * 2, { col: rgba(CYAN, 0.7) });
        let kx = st.x - st.ax, ky = st.y - st.ay;
        const kd = Math.hypot(kx, ky);
        if (kd > rim) { kx = kx / kd * rim; ky = ky / kd * rim; }
        R.sprite('disc', st.ax + kx, st.ay + ky, rim * 0.9, rim * 0.9, { col: rgba(CYAN, 0.55) });
        const dir = input.stickDir();
        if (dir >= 0) {
            const ax = st.ax + DX[dir] * rim * 1.35, ay = st.ay + DY[dir] * rim * 1.35;
            R.sprite('disc', ax, ay, rim * 0.3, rim * 0.3, { col: rgba(CYAN, 0.9) });
        }
    } else if (input.touchSeen || view.touch || L.portrait) {
        const cx = S.x + S.w / 2, cy = S.y + S.h / 2;
        R.sprite('ring', cx, cy, rim * 2, rim * 2, { col: rgba(CYAN, 0.25) });
        for (let k = 0; k < 4; k++) {
            R.sprite('harpoon', cx + DX[k] * rim * 0.62, cy + DY[k] * rim * 0.62, rim * 0.4, rim * 0.4,
                { rot: [0, HALF_PI, Math.PI, -HALF_PI][k], col: rgba(CYAN, 0.35) });
        }
        const msg = 'DRAG TO DIG';
        const mp = fitPx(msg, S.w * 0.8, fp);
        R.text(msg, cx, cy + rim + mp * 4, mp, rgba(CYAN, 0.45), 'center');
    } else {
        const lines = ['ARROWS/WASD  MOVE', 'SPACE  PUMP', 'CLICK TRAY  BUILD', '1-4  PICK TOWER', 'B  BUILD AHEAD', 'N  NEXT WAVE', 'P  PAUSE  M  MUTE'];
        const kp = fitPx(lines[0], S.w * 0.85, fp);
        let y = Math.max(S.y, L.hud.y + L.hud.h) + kp * 8;
        for (const ln of lines) { R.text(ln, S.x + S.w / 2, y, kp, rgba('#8890b8'), 'center'); y += kp * 11; }
    }
}

function drawGo(R, g, r, lw, fp, T, btns) {
    const waiting = !g.waveActive && g.phase === 'play';
    const glow = waiting ? 0.5 + 0.5 * Math.sin(T * 5) : 0;
    panel(R, r, GREEN, { active: waiting && glow > 0.5, enabled: waiting, lw });
    const big = Math.max(1, Math.min(fp + 1, Math.floor(r.w / 20)));
    if (waiting) {
        const secs = Math.ceil(g.countdown);
        R.text('GO!', r.x + r.w / 2, r.y + r.h * 0.28 - big * 3.5, big, rgba(GREEN), 'center');
        R.text('+' + secs, r.x + r.w / 2, r.y + r.h * 0.7 - fp * 3.5, fp, rgba(YELLOW), 'center');
        btns.push({ id: 'go', ...r });
    } else {
        const left = g.queue.length + g.enemies.filter(e => !e.dead).length;
        const t1 = g.phase === 'ready' ? 'READY' : g.wave >= WAVES_PER_ROUND ? 'BOSS' : 'WAVE';
        const t2 = g.phase === 'ready' ? '' : left + ' LEFT';
        const p1 = fitPx(t1, r.w * 0.85, fp);
        R.text(t1, r.x + r.w / 2, r.y + r.h * 0.3 - p1 * 3.5, p1, rgba(GREEN, 0.7), 'center');
        if (t2) {
            const p2 = fitPx(t2, r.w * 0.85, fp);
            R.text(t2, r.x + r.w / 2, r.y + r.h * 0.7 - p2 * 3.5, p2, rgba('#ffffff', 0.7), 'center');
        }
    }
}

function drawSelSlot(R, g, t, i, r, lw, fp, T, btns) {
    const def = TOWERS[t.type];
    const center = (s, y, col, p = fp) => {
        const pp = fitPx(s, r.w * 0.86, p);
        R.text(s, r.x + r.w / 2, y - pp * 3.5, pp, col, 'center');
    };
    if (i === 0) {
        panel(R, r, def.color, { active: true, lw });
        const s = Math.min(r.h * 0.5, r.w * 0.45);
        towerIcon(R, t.type, r.x + r.w / 2, r.y + r.h * 0.38, s);
        center('LV' + (t.lvl + 1), r.y + r.h * 0.82, rgba(def.color));
    } else if (i === 1) {
        const max = t.lvl >= 2;
        const cost = max ? 0 : upgradeCost(t.type, t.lvl);
        const ok = !max && g.gold >= cost;
        panel(R, r, GREEN, { enabled: ok, lw });
        center(max ? 'MAX' : 'UPG', r.y + r.h * 0.32, rgba(ok ? GREEN : '#406040'));
        if (!max) center(String(cost), r.y + r.h * 0.72, rgba(ok ? YELLOW : '#806040'));
        btns.push({ id: 'upgrade', ...r });
    } else if (i === 2) {
        const refund = Math.floor(towerValue(t.type, t.lvl) * SELL_RATE);
        panel(R, r, ORANGE, { lw });
        center('SELL', r.y + r.h * 0.32, rgba(ORANGE));
        center('+' + refund, r.y + r.h * 0.72, rgba(YELLOW));
        btns.push({ id: 'sell', ...r });
    } else if (i === 3) {
        panel(R, r, '#8890b8', { lw });
        center('X', r.y + r.h / 2, rgba('#ffffff'), fp + 1);
        btns.push({ id: 'deselect', ...r });
    }
}

// ================================================================ screens
function neonGrid(R, L, T, horizonY, col) {
    const W = L.W, H = L.H;
    const lw = Math.max(1, Math.round(L.dpr));
    R.blend('add');
    // receding horizontals
    for (let i = 0; i < 14; i++) {
        const z = ((i + (T * 0.6) % 1) / 14);
        const y = horizonY + (H - horizonY) * z * z;
        R.rect(0, y, W, lw, rgba(col, 0.15 + 0.5 * z));
    }
    // converging verticals
    const vx = W / 2;
    for (let i = -10; i <= 10; i++) {
        const bx = vx + i * W / 9;
        R.line(vx + i * W / 90, horizonY, bx, H, lw, rgba(col, 0.28));
    }
    R.blend('alpha');
}

export function drawTitle(R, L, T, hi, view) {
    const W = L.W, H = L.H, d = L.dpr;
    // stars
    for (let k = 0; k < 70; k++) {
        const x = (k * 7919 % 1000) / 1000 * W, y = (k * 104729 % 1000) / 1000 * H * 0.55;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(T * (0.5 + k % 5 * 0.3) + k));
        const sz = Math.max(1, Math.round(d * (k % 7 === 0 ? 2 : 1)));
        R.rect(x, y, sz, sz, rgba('#ffffff', tw * 0.8));
    }
    neonGrid(R, L, T, H * 0.62, '#b456ff');

    // logo
    const line1 = 'BURROW', line2 = 'GUARD';
    const lp = fitPx(line1, W * 0.84, Math.round(18 * d));
    const ly = Math.round(H * (L.portrait ? 0.1 : 0.07));
    for (const [txt, yy, col] of [[line1, ly, YELLOW], [line2, ly + lp * 9, CYAN]]) {
        R.text(txt, W / 2 + lp, yy + lp, lp, rgba('#ff3a78'), 'center');
        R.text(txt, W / 2, yy, lp, rgba(col), 'center');
    }
    const tp = fitPx('DIG  DEFEND  DEVOUR', W * 0.8, Math.round(2.4 * d));
    let y = ly + lp * 18 + tp * 3;
    R.text('DIG  DEFEND  DEVOUR', W / 2, y, tp, rgba('#ffffff'), 'center');

    // parade: they chase you, then you eat a gem and chase them.
    const ts = Math.round(Math.min(W / 11, 44 * d));
    const py = y + tp * 7 + ts * 1.1;
    const cycle = 9, ph = (T % cycle) / cycle;
    const chase = ph < 0.5;
    const k = chase ? ph / 0.5 : (ph - 0.5) / 0.5;
    const span = W + ts * 8;
    const lead = chase ? -ts * 2 + k * span : W + ts * 2 - k * span;
    const f = Math.floor(T * 8) % 2;
    R.sprite('player' + f, lead, py, ts, ts, { flipX: !chase });
    const crew = ['grub', 'skitter', 'drake', 'stalker', 'borer'];
    // Both halves keep the crew to the miner's left: behind him while he runs,
    // ahead of him while he hunts them back.
    crew.forEach((c, i) => {
        const ex = lead - (i + 1.6) * ts * 1.15;
        const nm = chase ? c + f : (Math.floor(T * 5) % 2 && k > 0.7 ? 'scaredW' : 'scared') + f;
        R.sprite(nm, ex, py, ts, ts, { flipX: !chase });
    });
    if (!chase && k < 0.08) R.sprite('gem', lead, py - ts, ts * 0.6, ts * 0.6, { col: rgba('#ff40a8') });

    // how to play
    const hp = fitPx('THEY WALK THE TUNNELS YOU DIG', W * 0.86, Math.round(1.9 * d));
    y = py + ts * 1.1;
    const lines = [
        ['DIG DIRT AND EAT DOTS FOR GOLD', '#ffffff'],
        ['BUILD TOWERS IN THE DIRT', YELLOW],
        ['THEY WALK THE TUNNELS YOU DIG', ORANGE],
        ['PUMP THEM  CRUSH THEM  EAT THEM', PINK],
        ['GUARD THE CORE', CYAN],
    ];
    for (const [ln, col] of lines) { R.text(ln, W / 2, y, hp, rgba(col), 'center'); y += hp * 11; }

    // tower legend
    y += hp * 4;
    const lts = Math.round(Math.min(W / 10, 34 * d));
    const types = TOWER_ORDER;
    const colW = Math.min(W / 4.4, lts * 3.2);
    types.forEach((t, i) => {
        const cx = W / 2 + (i - 1.5) * colW;
        towerIcon(R, t, cx, y + lts / 2, lts);
        const np = fitPx(TOWERS[t].name, colW * 0.95, Math.max(1, Math.round(1.4 * d)));
        R.text(TOWERS[t].name, cx, y + lts + np * 3, np, rgba(TOWERS[t].color), 'center');
    });

    // prompt
    const pp = fitPx('TAP TO START', W * 0.7, Math.round(3 * d));
    const promptY = Math.min(H - pp * 22, Math.max(y + lts + pp * 12, H * 0.8));
    if (Math.floor(T * 2.5) % 2 === 0) R.text(view.touch ? 'TAP TO START' : 'CLICK OR PRESS ENTER', W / 2, promptY, view.touch ? pp : fitPx('CLICK OR PRESS ENTER', W * 0.7, pp), rgba(YELLOW), 'center');
    const hs = Math.max(1, Math.round(2 * d));
    R.text('HI ' + pad6(hi), W / 2, promptY + pp * 11, hs, rgba('#8890b8'), 'center');
    const sm = Math.max(1, Math.round(1.25 * d));
    R.text('VANILLA JS + WEBGL  NO ASSETS', W / 2, H - sm * 12 - Math.round(L.safe.bottom * d), sm, rgba('#505880'), 'center');
}

function menuButton(R, L, id, label, col, cx, y, w, h, btns, fp) {
    const r = { x: Math.round(cx - w / 2), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    panel(R, r, col, { lw: Math.max(2, Math.round(1.5 * L.dpr)) });
    R.text(label, cx, r.y + r.h / 2 - fp * 3.5, fp, rgba(col), 'center');
    btns.push({ id, ...r });
}

export function drawPause(R, L, view, soundOn, quality) {
    const W = L.W, H = L.H, d = L.dpr;
    R.rect(0, 0, W, H, rgba('#000000', 0.72));
    const fp = fitPx('PAUSED', W * 0.7, Math.round(6 * d));
    let y = H * 0.24;
    R.text('PAUSED', W / 2 + fp, y + fp, fp, rgba(PINK), 'center');
    R.text('PAUSED', W / 2, y, fp, rgba(YELLOW), 'center');
    y += fp * 14;
    const bw = Math.min(W * 0.8, 260 * d), bh = 52 * d, gap = 14 * d;
    const bp = Math.max(1, Math.round(2.2 * d));
    menuButton(R, L, 'resume', 'RESUME', GREEN, W / 2, y, bw, bh, view.buttons, bp); y += bh + gap;
    menuButton(R, L, 'sound', soundOn ? 'SOUND: ON' : 'SOUND: OFF', CYAN, W / 2, y, bw, bh, view.buttons, bp); y += bh + gap;
    menuButton(R, L, 'quality', quality === 'high' ? 'FX: HIGH' : 'FX: LOW', '#b456ff', W / 2, y, bw, bh, view.buttons, bp); y += bh + gap;
    menuButton(R, L, 'quit', 'QUIT', PINK, W / 2, y, bw, bh, view.buttons, bp);
}

export function drawGameOver(R, g, L, T, view) {
    const W = L.W, H = L.H, d = L.dpr;
    const a = Math.min(1, g.phaseT * 1.5);
    R.rect(0, 0, W, H, rgba('#000000', 0.7 * a));
    const fp = fitPx('GAME OVER', W * 0.86, Math.round(7 * d));
    let y = H * 0.2;
    R.text('GAME OVER', W / 2 + fp, y + fp, fp, rgba('#000000', a), 'center');
    R.text('GAME OVER', W / 2, y, fp, rgba(PINK, a), 'center');
    y += fp * 11;
    const sp = Math.max(1, Math.round(2 * d));
    const why = g.overReason === 'core' ? 'THE CORE WAS BROKEN' : 'OUT OF MINERS';
    R.text(why, W / 2, y, fitPx(why, W * 0.86, sp), rgba('#ffffff', a), 'center');
    y += sp * 16;
    const bp = Math.max(1, Math.round(3.2 * d));
    R.text(pad6(g.score), W / 2, y, bp, rgba(YELLOW, a), 'center');
    y += bp * 10;
    if (g.newHi && Math.floor(T * 4) % 2 === 0) R.text('NEW HI SCORE!', W / 2, y, sp, rgba(CYAN, a), 'center');
    y += sp * 14;
    const s = g.stats;
    const rows = [
        ['ROUND', g.round + '  WAVE ' + Math.max(1, g.wave)],
        ['MONSTERS', s.kills], ['POPPED', s.popped], ['EATEN', s.eaten], ['CRUSHED', s.crushed],
        ['DOTS', s.dots], ['TOWERS', s.built],
    ];
    const cw = Math.min(W * 0.8, 280 * d);
    for (const [k, v] of rows) {
        R.text(k, W / 2 - cw / 2, y, sp, rgba('#8890b8', a));
        R.text(String(v), W / 2 + cw / 2, y, sp, rgba('#ffffff', a), 'right');
        y += sp * 11;
    }
    if (g.phaseT > 1.5 && Math.floor(T * 2.5) % 2 === 0) {
        const tp = fitPx('TAP TO CONTINUE', W * 0.7, Math.round(2.6 * d));
        R.text(view.touch ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE', W / 2, Math.min(H - tp * 16, y + tp * 8), tp, rgba(YELLOW), 'center');
    }
}

export function drawBackdrop(R, L, T) {
    // Behind the field: a faint vector grid so the side panels aren't dead black.
    const W = L.W, H = L.H, step = Math.max(8, Math.round(L.field.tile));
    const col = rgba('#1a1840', 0.9);
    const lw = Math.max(1, Math.round(L.dpr / 2));
    const off = Math.round((T * 6 * L.dpr) % step);
    for (let x = (L.field.x % step); x < W; x += step) R.rect(x, 0, lw, H, col);
    for (let y = -step + off; y < H; y += step) R.rect(0, y, W, lw, col);
}
