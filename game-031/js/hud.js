/**
 * The status bar, message line and automap — all drawn into the same
 * 320x200 indexed framebuffer as the 3D view, so nothing on screen is
 * DOM chrome.
 */

import * as P from './engine/palette.js';
import * as S from './engine/sprites.js';
import { drawText, drawTextCentered } from './engine/font.js';
import { DOOR, DOOR_OPEN, STAIRS, LOCKED, STAIRS_UP } from './dungeon.js';

export const SCREEN_W = 320, SCREEN_H = 200;
export const VIEW = { x: 4, y: 4, w: 312, h: 148 };
export const MSG_Y = 154;
export const BAR_Y = 164;

const FACING_LABEL = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

/** A framed meter, the way every DOS RPG drew hit points. */
export function drawBar(fb, x, y, w, h, frac, color, label) {
    fb.fillRect(x, y, w, h, P.BLACK);
    fb.strokeRect(x, y, w, h, P.DKGRAY);
    const fill = Math.max(0, Math.min(1, frac));
    const inner = w - 2;
    const filled = Math.round(inner * fill);
    if (filled > 0) fb.fillRect(x + 1, y + 1, filled, h - 2, color);
    if (label) drawText(fb, x + 2, y + (h - 7) / 2 | 0, label, P.WHITE, P.BLACK);
}

/** The compass rose in the corner of the bar. */
function drawCompass(fb, x, y, facing, accent) {
    fb.panel(x, y, 32, 32, P.BLACK, P.DKGRAY, P.DKGRAY);
    const cx = x + 16, cy = y + 16;
    drawText(fb, cx - 2, y + 1, 'N', facing === 0 ? accent : P.DKGRAY);
    drawText(fb, cx - 2, y + 24, 'S', facing === 2 ? accent : P.DKGRAY);
    drawText(fb, x + 2, cy - 3, 'W', facing === 3 ? accent : P.DKGRAY);
    drawText(fb, x + 25, cy - 3, 'E', facing === 1 ? accent : P.DKGRAY);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dy] = dirs[facing];
    for (let i = 0; i <= 5; i++) fb.pset(cx + dx * i, cy + dy * i, P.YELLOW);
    fb.pset(cx + dx * 5 - dy, cy + dy * 5 - dx, P.YELLOW);
    fb.pset(cx + dx * 5 + dy, cy + dy * 5 + dx, P.YELLOW);
    fb.pset(cx, cy, P.WHITE);
}

/**
 * The portrait. Which face shows is a function of how much health is
 * left, with a wince held for a moment after a hit — the trick every
 * status-bar face in the genre used to make damage feel like it landed.
 */
function drawPortrait(fb, game) {
    const s = game.stats;
    const frac = s.hp / s.hpMax;
    let face;
    if (game.state === 'dead' || s.hp <= 0) face = S.FACE_DEAD;
    else if (game.hurtTimer > 0.8 || frac < 0.25) face = S.FACE_BAD;
    else if (frac < 0.6 || game.hurtTimer > 0) face = S.FACE_HURT;
    else face = S.FACE_OK;
    fb.panel(3, BAR_Y + 4, 28, 28, P.BLACK, P.DKGRAY, P.LTGRAY);
    fb.blit(face, 5, BAR_Y + 7, 1);
}

export function drawStatusBar(fb, game) {
    const accent = game.theme ? game.theme.accent : P.LTGREEN;

    // message line sits above the panel, over the black border
    fb.fillRect(0, MSG_Y - 2, SCREEN_W, 10, P.BLACK);
    const msg = game.messages[game.messages.length - 1];
    if (msg) drawText(fb, 4, MSG_Y, msg.text.slice(0, 51), msg.color ?? P.LTGRAY);

    fb.panel(0, BAR_Y, SCREEN_W, SCREEN_H - BAR_Y, P.DKGRAY, P.LTGRAY, P.BLACK);
    drawPortrait(fb, game);
    drawCompass(fb, 284, BAR_Y + 2, game.player.facing, accent);

    const s = game.stats;
    const col = 36;
    if (s) {
        drawText(fb, col, BAR_Y + 4, 'HP', P.LTRED, P.BLACK);
        drawBar(fb, col + 16, BAR_Y + 3, 74, 9, s.hp / s.hpMax, P.RED,
            `${Math.max(0, Math.ceil(s.hp))}/${s.hpMax}`);
        drawText(fb, col, BAR_Y + 16, 'MP', P.LTBLUE, P.BLACK);
        drawBar(fb, col + 16, BAR_Y + 15, 74, 9, s.mana / s.manaMax, P.BLUE,
            `${Math.max(0, Math.floor(s.mana))}/${s.manaMax}`);
        drawText(fb, col, BAR_Y + 27, `LVL ${s.level}  XP ${s.xp}/${s.xpNext}`, P.LTGRAY, P.BLACK);

        if (s.pack) {
            const counts = [
                [s.pack.potion || 0, P.LTRED],
                [s.pack.mana || 0, P.LTBLUE],
                [s.pack.scroll || 0, P.LTCYAN]
            ];
            counts.forEach(([n, c], i) =>
                drawText(fb, 140, BAR_Y + 4 + i * 10, `${i + 1}:${n}`, n ? c : P.DKGRAY, P.BLACK));
        }
    }

    const right = 172;
    drawText(fb, right, BAR_Y + 4, `DEPTH ${game.depth}`, accent, P.BLACK);
    drawText(fb, right, BAR_Y + 15, FACING_LABEL[game.player.facing], P.LTGRAY, P.BLACK);
    if (s) {
        drawText(fb, right, BAR_Y + 26, `GOLD ${s.gold}`, P.YELLOW, P.BLACK);
        if (s.keys > 0) drawText(fb, right + 62, BAR_Y + 26, `KEYS ${s.keys}`, P.LTCYAN, P.BLACK);
    }
}

/**
 * Overhead automap of everything the player has seen. Drawn over the 3D
 * view, keeping the status bar visible underneath.
 */
export function drawAutomap(fb, level, player, theme) {
    fb.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, P.BLACK);
    const top = VIEW.y + 11, bottom = VIEW.y + VIEW.h - 12;
    const availW = VIEW.w - 8, availH = bottom - top;

    // Never shrink below 3px a cell: a map you cannot read is not a map.
    // If the floor will not fit at that size, centre it on the player and
    // let the edges run off, the way a paper map on a small table does.
    const scale = Math.max(3, Math.min(6,
        Math.min(Math.floor(availW / level.width), Math.floor(availH / level.height))));

    // Each axis is decided on its own: a floor can easily fit across but
    // not down, and pinning both together threw the map into a corner.
    const axis = (span, avail, origin, cell) => {
        const size = span * scale;
        if (size <= avail) return origin + ((avail - size) >> 1);
        const centred = origin + (avail >> 1) - (cell * scale + (scale >> 1));
        return Math.max(origin + avail - size, Math.min(origin, centred));
    };
    const ox = axis(level.width, availW, VIEW.x + 4, player.cellX);
    const oy = axis(level.height, availH, top, player.cellY);

    const plot = (cx, cy, color, inset = 0) => {
        const px = ox + cx * scale + inset, py = oy + cy * scale + inset;
        if (px + scale <= VIEW.x || px >= VIEW.x + VIEW.w) return;
        if (py + scale <= top - scale || py > bottom) return;
        fb.fillRect(Math.max(VIEW.x, px), Math.max(top - scale + 1, py),
            scale - inset * 2, scale - inset * 2, color);
    };

    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            if (!level.hasSeen(x, y)) continue;
            const t = level.at(x, y);
            let c = null;
            if (t === STAIRS) c = theme ? theme.accent : P.LTGREEN;
            else if (t === STAIRS_UP) c = P.LTCYAN;
            else if (t === LOCKED) c = P.LTRED;
            else if (t === DOOR) c = P.BROWN;
            else if (t === DOOR_OPEN) c = P.YELLOW;
            else if (level.walkable(x, y)) c = P.DKGRAY;
            else {
                // only draw rock that touches somewhere we have been
                let touches = false;
                for (let dy = -1; dy <= 1 && !touches; dy++)
                    for (let dx = -1; dx <= 1 && !touches; dx++)
                        if (level.hasSeen(x + dx, y + dy) && level.walkable(x + dx, y + dy)) touches = true;
                if (touches) c = P.LTGRAY;
            }
            if (c !== null) plot(x, y, c);
        }
    }

    // anything still lying on the floor that we have already walked past
    for (const it of level.items) {
        if (!level.hasSeen(it.x, it.y)) continue;
        plot(it.x, it.y, it.kind === 'key' ? P.LTCYAN : P.YELLOW, scale > 3 ? 1 : 0);
    }

    // player marker: a wedge pointing the way we face
    const px = ox + player.cellX * scale + (scale >> 1);
    const py = oy + player.cellY * scale + (scale >> 1);
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][player.facing];
    fb.fillRect(px - 1, py - 1, 3, 3, P.YELLOW);
    for (let i = 1; i <= scale; i++) fb.pset(px + dx * i, py + dy * i, P.WHITE);

    drawTextCentered(fb, SCREEN_W / 2, VIEW.y + 2, `LEVEL ${level.depth} MAP`, P.WHITE, P.BLACK);
    fb.fillRect(VIEW.x, VIEW.y + VIEW.h - 11, VIEW.w, 11, P.BLACK);
    drawText(fb, VIEW.x + 2, VIEW.y + VIEW.h - 9, 'TAB CLOSE', P.DKGRAY);
    drawText(fb, VIEW.x + 70, VIEW.y + VIEW.h - 9, 'DOWN', theme ? theme.accent : P.LTGREEN);
    drawText(fb, VIEW.x + 118, VIEW.y + VIEW.h - 9, 'UP', P.LTCYAN);
    drawText(fb, VIEW.x + 152, VIEW.y + VIEW.h - 9, 'GATE', P.LTRED);
    drawText(fb, VIEW.x + 196, VIEW.y + VIEW.h - 9, 'DOOR', P.BROWN);
    drawText(fb, VIEW.x + 240, VIEW.y + VIEW.h - 9, 'LOOT', P.YELLOW);
}

/** A centred modal box with a title and lines of body text. */
export function drawPanel(fb, title, lines, opts = {}) {
    const w = opts.width || 240;
    const lineH = 9;
    const h = 24 + lines.length * lineH;
    const x = (SCREEN_W - w) >> 1;
    const y = opts.y ?? Math.max(VIEW.y + 2, ((VIEW.h - h) >> 1) + VIEW.y);
    fb.panel(x, y, w, h, P.BLACK, P.LTGRAY, P.DKGRAY);
    fb.strokeRect(x + 2, y + 2, w - 4, h - 4, P.DKGRAY);
    drawTextCentered(fb, SCREEN_W / 2, y + 6, title, opts.titleColor ?? P.YELLOW);
    lines.forEach((line, i) => {
        const text = typeof line === 'string' ? line : line.text;
        const color = typeof line === 'string' ? P.LTGRAY : (line.color ?? P.LTGRAY);
        if (opts.center) drawTextCentered(fb, SCREEN_W / 2, y + 18 + i * lineH, text, color);
        else drawText(fb, x + 10, y + 18 + i * lineH, text, color);
    });
    return { x, y, w, h };
}
