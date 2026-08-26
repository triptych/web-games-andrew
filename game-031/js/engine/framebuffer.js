/**
 * A palette-indexed software framebuffer.
 *
 * Every pixel the game ever draws goes through here as a 0-15 palette
 * index; only at present() time is the whole buffer expanded to RGBA in
 * one pass. That is what keeps palette effects (damage flash, fade to
 * black, the pickup blink) free — they are changes to the lookup table,
 * not to the pixels.
 */

import { paletteLUT } from './palette.js';

/** Palette index used to mean "transparent" inside sprite bitmaps. */
export const TRANSPARENT = 255;

export class Framebuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.pixels = new Uint8Array(width * height);
        this._canvas = document.createElement('canvas');
        this._canvas.width = width;
        this._canvas.height = height;
        this._ctx = this._canvas.getContext('2d');
        this._image = this._ctx.createImageData(width, height);
        this._rgba = new Uint32Array(this._image.data.buffer);
        this._lut = paletteLUT();
    }

    clear(color = 0) {
        this.pixels.fill(color);
    }

    pset(x, y, color) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        this.pixels[y * this.width + x] = color;
    }

    pget(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.pixels[y * this.width + x];
    }

    hline(x0, x1, y, color) {
        if (y < 0 || y >= this.height) return;
        if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
        if (x1 < 0 || x0 >= this.width) return;
        if (x0 < 0) x0 = 0;
        if (x1 >= this.width) x1 = this.width - 1;
        this.pixels.fill(color, y * this.width + x0, y * this.width + x1 + 1);
    }

    vline(x, y0, y1, color) {
        if (x < 0 || x >= this.width) return;
        if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
        if (y1 < 0 || y0 >= this.height) return;
        if (y0 < 0) y0 = 0;
        if (y1 >= this.height) y1 = this.height - 1;
        const w = this.width;
        for (let y = y0; y <= y1; y++) this.pixels[y * w + x] = color;
    }

    fillRect(x, y, w, h, color) {
        for (let i = 0; i < h; i++) this.hline(x, x + w - 1, y + i, color);
    }

    /** Single-pixel outline. */
    strokeRect(x, y, w, h, color) {
        this.hline(x, x + w - 1, y, color);
        this.hline(x, x + w - 1, y + h - 1, color);
        this.vline(x, y, y + h - 1, color);
        this.vline(x + w - 1, y, y + h - 1, color);
    }

    /** A 1px bevelled panel, the way every DOS game drew its status bar. */
    panel(x, y, w, h, fill, light, dark) {
        this.fillRect(x, y, w, h, fill);
        this.hline(x, x + w - 1, y, light);
        this.vline(x, y, y + h - 1, light);
        this.hline(x, x + w - 1, y + h - 1, dark);
        this.vline(x + w - 1, y, y + h - 1, dark);
    }

    /**
     * Blit a bitmap ({ w, h, data }) with TRANSPARENT skipped, optionally
     * scaled by integer-free nearest sampling and recoloured through a
     * shade table row.
     */
    blit(bmp, dx, dy, scale = 1, shadeRow = null) {
        const dw = Math.max(1, Math.round(bmp.w * scale));
        const dh = Math.max(1, Math.round(bmp.h * scale));
        const sx = bmp.w / dw, sy = bmp.h / dh;
        for (let y = 0; y < dh; y++) {
            const py = dy + y;
            if (py < 0 || py >= this.height) continue;
            const row = (y * sy) | 0;
            for (let x = 0; x < dw; x++) {
                const px = dx + x;
                if (px < 0 || px >= this.width) continue;
                let c = bmp.data[row * bmp.w + ((x * sx) | 0)];
                if (c === TRANSPARENT) continue;
                if (shadeRow) c = shadeRow[c];
                this.pixels[py * this.width + px] = c;
            }
        }
    }

    /** Swap the palette lookup — used for flashes and fades. */
    setPalette(brightness, tint) {
        this._lut = paletteLUT(brightness, tint);
    }

    /** Expand indices to RGBA and draw into a destination 2D context. */
    present(ctx) {
        const px = this.pixels, out = this._rgba, lut = this._lut;
        for (let i = 0; i < px.length; i++) out[i] = lut[px[i]];
        this._ctx.putImageData(this._image, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}
