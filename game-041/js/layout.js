// ============================================================
// Screen layout, in DEVICE pixels. Two shapes:
//
//  PORTRAIT (phones held upright, narrow windows)
//   +-----------------------------+
//   | <-Games  1UP 000000  HI  [II]|  HUD, row 1 (link budget: 88 css px)
//   | $045  W2/6  CORE ####  vvv  |  HUD, row 2
//   |                             |
//   |        13 x 18 field        |
//   |                             |
//   | [BLS][FRS][ARC][BMR][ GO ]  |  build tray
//   |   (drag to move)    (PUMP)  |  left thumb / right thumb
//   +-----------------------------+
//
//  LANDSCAPE (phones on their side, desktops)
//   +---------+-----------+---------+
//   | <-Games |           |    [II] |
//   | HUD     |   field   | tray x2 |
//   | (drag)  |           |  (PUMP) |
//   +---------+-----------+---------+
//
// Every touch control is >= 44 css px. The tile size is a whole number of
// device pixels so the grid never drifts against the pixel art.
// ============================================================

import { COLS, ROWS } from './config.js';

const LINK_W = 88;      // css px reserved for the "<- Games" link
const LINK_H = 40;

export function computeLayout(cssW, cssH, dpr, safe = { top: 0, right: 0, bottom: 0, left: 0 }) {
    const s = v => Math.round(v * dpr);
    const W = Math.max(1, Math.round(cssW * dpr)), H = Math.max(1, Math.round(cssH * dpr));
    const portrait = cssW < cssH * 1.25;
    const L = { W, H, dpr, portrait, cssW, cssH, safe };
    const minBtn = 44;

    if (portrait) {
        const hudH = 72;       // row 1 beside the link, row 2 below it
        const ctrlMin = Math.min(260, Math.max(196, cssH * 0.27));
        let tile = Math.min((cssW - safe.left - safe.right - 6) / COLS,
                            (cssH - safe.top - safe.bottom - hudH - ctrlMin) / ROWS);
        tile = Math.max(10, tile);
        const ts = Math.max(8, Math.floor(tile * dpr));
        const fw = ts * COLS, fh = ts * ROWS;
        L.field = { x: Math.round((W - fw) / 2), y: s(safe.top + hudH), w: fw, h: fh, tile: ts };
        L.hud = { x: s(safe.left + 8), y: s(safe.top), w: W - s(safe.left + safe.right + 16), h: s(hudH), rowH: s(24), linkW: s(LINK_W) };
        L.pause = { x: W - s(safe.right + 6 + 44), y: s(safe.top + 4), w: s(44), h: s(44) };

        const top = L.field.y + fh + s(8);
        const bottom = H - s(safe.bottom + 8);
        const avail = (bottom - top) / dpr;
        const trayH = Math.max(minBtn + 8, Math.min(68, avail * 0.36));
        const gap = 6;
        const tw = (cssW - safe.left - safe.right - 16 - gap * 4) / 5;
        L.tray = [];
        for (let i = 0; i < 5; i++) {
            L.tray.push({ x: s(safe.left + 8 + i * (tw + gap)), y: top, w: s(tw), h: s(trayH) });
        }
        const padTop = top + s(trayH + 8);
        const padH = bottom - padTop;
        const pr = Math.min(s(62), padH / 2 - s(4));
        L.pump = { x: W - s(safe.right + 16) - pr, y: padTop + padH / 2, r: Math.max(s(minBtn / 2 + 4), pr) };
        L.stick = { x: s(safe.left), y: padTop - s(4), w: L.pump.x - L.pump.r - s(safe.left + 12), h: bottom - padTop + s(12) };
    } else {
        let tile = Math.min((cssH - safe.top - safe.bottom - 8) / ROWS, (cssW * 0.6) / COLS);
        tile = Math.max(10, tile);
        const ts = Math.max(8, Math.floor(tile * dpr));
        const fw = ts * COLS, fh = ts * ROWS;
        L.field = { x: Math.round((W - fw) / 2), y: Math.round((H - fh) / 2), w: fw, h: fh, tile: ts };
        const leftW = L.field.x - s(safe.left + 12);
        const rightX = L.field.x + fw + s(12);
        const rightW = W - s(safe.right + 10) - rightX;
        L.hud = { x: s(safe.left + 12), y: s(safe.top + LINK_H + 12), w: leftW, h: s(170), rowH: s(26), stacked: true };
        L.pause = { x: W - s(safe.right + 8 + 44), y: s(safe.top + 8), w: s(44), h: s(44) };

        // Tray: 2 columns x 3 rows under the pause button.
        const gap = s(6);
        const colW = Math.max(s(minBtn), Math.floor((rightW - gap) / 2));
        const rowH = Math.max(s(minBtn + 4), Math.min(s(64), Math.floor((H - s(safe.top + 60) - s(150)) / 3) - gap));
        const trayTop = L.pause.y + L.pause.h + s(8);
        L.tray = [];
        for (let i = 0; i < 5; i++) {
            const cx = i % 2, cy = Math.floor(i / 2);
            L.tray.push({ x: rightX + cx * (colW + gap), y: trayTop + cy * (rowH + gap), w: colW, h: rowH });
        }
        // GO spans the last row.
        L.tray[4].w = colW * 2 + gap;
        const trayBottom = trayTop + 3 * (rowH + gap);
        const bottom = H - s(safe.bottom + 8);
        const pr = Math.max(s(minBtn / 2 + 4), Math.min(s(62), (bottom - trayBottom) / 2 - s(4), rightW / 2));
        L.pump = { x: rightX + rightW / 2, y: Math.max(trayBottom + pr + s(4), bottom - pr), r: pr };
        const stickTop = L.hud.y + L.hud.h + s(8);
        L.stick = { x: s(safe.left), y: stickTop, w: L.field.x - s(safe.left + 4), h: H - stickTop };
    }
    // Sprite-pixel pitch, for scanlines that line up with the art.
    L.px = L.field.tile / 16;
    return L;
}

export function inRect(r, x, y) {
    return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}
