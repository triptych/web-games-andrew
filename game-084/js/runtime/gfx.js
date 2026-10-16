// VESTA-8 runtime: the framebuffer, the palette and the drawing primitives.
// The screen is 160 × 120 palette indices in a Uint8Array. Nothing here touches the DOM: a host
// turns the framebuffer into pixels (a canvas, a three.js texture, or nothing at all in a test).

export function gfx(V) {
    const W = 160, H = 120;
    V.W = W;
    V.H = H;
    V.TILE = 8;
    V.SHEET_COLS = 8;              // the sheet is 8 × 8 sprites of 8 × 8 pixels
    V.NSPR = 64;

    // The VESTA-8 palette. 0 is transparent in sprites; the first four are the phosphor ramp the
    // console boots with, and the rest come back as the colour DAC is restored.
    V.PALETTE = [
        '#0b0b14', '#26305a', '#2fb8b0', '#f4f1e1',
        '#e8394d', '#ff8a2a', '#ffd23f', '#5fd35a',
        '#1a4f8c', '#7a3fb0', '#ff5fb4', '#ffb38a',
        '#8a5a3b', '#1f7a4a', '#63c6ff', '#9aa0b8',
    ];
    V.PAL_RGB = V.PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    // A damaged colour DAC shows everything as green phosphor: each colour's brightness picks a shade.
    V.PHOSPHOR = V.PAL_RGB.map(([r, g, b]) => {
        const l = (0.3 * r + 0.55 * g + 0.15 * b) / 255;
        const k = Math.round(Math.min(1, l * 1.25) * 3) / 3;
        return [Math.round(16 + 70 * k), Math.round(28 + 210 * k), Math.round(20 + 90 * k)];
    });

    V.makeFB = () => new Uint8Array(W * H);

    /** Decode the cart's sprite strings (64 × 64 hex digits) into one 64 × 64 sheet. */
    V.decodeSheet = (sprites) => {
        const sheet = new Uint8Array(64 * 64);
        for (let n = 0; n < 64; n++) {
            const s = (sprites && sprites[n]) || '';
            const ox = (n % 8) * 8, oy = Math.floor(n / 8) * 8;
            for (let i = 0; i < 64; i++) {
                const v = parseInt(s[i] || '0', 16) || 0;
                sheet[(oy + (i >> 3)) * 64 + ox + (i & 7)] = v;
            }
        }
        return sheet;
    };

    /** The opaque bounds of each sprite: { x, y, w, h } in pixels, or null when it is empty. */
    V.spriteBounds = (sheet) => {
        const out = [];
        for (let n = 0; n < 64; n++) {
            const ox = (n % 8) * 8, oy = Math.floor(n / 8) * 8;
            let x0 = 8, y0 = 8, x1 = -1, y1 = -1;
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
                if (sheet[(oy + y) * 64 + ox + x]) {
                    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
                }
            }
            out.push(x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
        }
        return out;
    };

    const clip = { x0: 0, y0: 0, x1: W, y1: H };

    V.pset = (fb, x, y, c) => {
        x = Math.floor(x); y = Math.floor(y);
        if (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1) return;
        fb[y * W + x] = c & 15;
    };

    V.cls = (fb, c) => { fb.fill(c & 15); };

    V.rectfill = (fb, x, y, w, h, c) => {
        let x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.floor(x + w), y1 = Math.floor(y + h);
        if (x0 < clip.x0) x0 = clip.x0; if (y0 < clip.y0) y0 = clip.y0;
        if (x1 > clip.x1) x1 = clip.x1; if (y1 > clip.y1) y1 = clip.y1;
        c &= 15;
        for (let yy = y0; yy < y1; yy++) fb.fill(c, yy * W + x0, yy * W + Math.max(x0, x1));
    };

    V.rect = (fb, x, y, w, h, c) => {
        V.rectfill(fb, x, y, w, 1, c);
        V.rectfill(fb, x, y + h - 1, w, 1, c);
        V.rectfill(fb, x, y, 1, h, c);
        V.rectfill(fb, x + w - 1, y, 1, h, c);
    };

    V.line = (fb, x0, y0, x1, y1, c) => {
        x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy, n = 0;
        for (;;) {
            V.pset(fb, x0, y0, c);
            if ((x0 === x1 && y0 === y1) || ++n > 1000) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    };

    V.circ = (fb, cx, cy, r, c, fill) => {
        cx = Math.floor(cx); cy = Math.floor(cy); r = Math.max(0, Math.floor(r));
        let x = r, y = 0, err = 1 - r;
        while (x >= y) {
            if (fill) {
                V.rectfill(fb, cx - x, cy + y, 2 * x + 1, 1, c);
                V.rectfill(fb, cx - x, cy - y, 2 * x + 1, 1, c);
                V.rectfill(fb, cx - y, cy + x, 2 * y + 1, 1, c);
                V.rectfill(fb, cx - y, cy - x, 2 * y + 1, 1, c);
            } else {
                V.pset(fb, cx + x, cy + y, c); V.pset(fb, cx - x, cy + y, c);
                V.pset(fb, cx + x, cy - y, c); V.pset(fb, cx - x, cy - y, c);
                V.pset(fb, cx + y, cy + x, c); V.pset(fb, cx - y, cy + x, c);
                V.pset(fb, cx + y, cy - x, c); V.pset(fb, cx - y, cy - x, c);
            }
            y++;
            if (err < 0) err += 2 * y + 1;
            else { x--; err += 2 * (y - x) + 1; }
        }
    };

    /** Draw sprite n at (x, y). pal, if given, maps colours (used to flash a sprite one colour). */
    V.spr = (fb, sheet, n, x, y, flipx, flipy, pal) => {
        n = Math.floor(n);
        if (!(n >= 0 && n < 64)) return;
        x = Math.floor(x); y = Math.floor(y);
        if (x >= clip.x1 || y >= clip.y1 || x + 8 <= clip.x0 || y + 8 <= clip.y0) return;
        const ox = (n % 8) * 8, oy = Math.floor(n / 8) * 8;
        for (let j = 0; j < 8; j++) {
            const py = y + j;
            if (py < clip.y0 || py >= clip.y1) continue;
            const sy = oy + (flipy ? 7 - j : j);
            for (let i = 0; i < 8; i++) {
                const px = x + i;
                if (px < clip.x0 || px >= clip.x1) continue;
                let c = sheet[sy * 64 + ox + (flipx ? 7 - i : i)];
                if (!c) continue;
                if (pal) c = pal[c];
                fb[py * W + px] = c;
            }
        }
    };

    /** Draw text; returns its width in pixels. \n starts a new line. */
    V.text = (fb, str, x, y, c) => {
        str = String(str);
        x = Math.floor(x); y = Math.floor(y);
        let cx = x, cy = y, maxw = 0;
        for (const ch of str) {
            if (ch === '\n') { cx = x; cy += V.CHAR_H; continue; }
            const g = V.glyph(ch);
            for (let i = 0; i < g.length; i += 2) V.pset(fb, cx + g[i], cy + g[i + 1], c);
            cx += V.CHAR_W;
            if (cx - x > maxw) maxw = cx - x;
        }
        return maxw;
    };
    V.textWidth = (str) => {
        let w = 0, m = 0;
        for (const ch of String(str)) { if (ch === '\n') { w = 0; continue; } w += V.CHAR_W; if (w > m) m = w; }
        return m;
    };
    /** Text with a one-pixel outline, for HUDs over busy scenes. */
    V.textOutlined = (fb, str, x, y, c, o) => {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) V.text(fb, str, x + dx, y + dy, o);
        return V.text(fb, str, x, y, c);
    };

    V.setClip = (x0, y0, x1, y1) => { clip.x0 = x0; clip.y0 = y0; clip.x1 = x1; clip.y1 = y1; };
    V.resetClip = () => V.setClip(0, 0, W, H);

    /** Fill out (RGBA bytes, length W*H*4) from the framebuffer using a palette of [r, g, b]. */
    V.toRGBA = (fb, out, pal) => {
        pal = pal || V.PAL_RGB;
        for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
            const p = pal[fb[i]];
            out[j] = p[0]; out[j + 1] = p[1]; out[j + 2] = p[2]; out[j + 3] = 255;
        }
        return out;
    };
}
