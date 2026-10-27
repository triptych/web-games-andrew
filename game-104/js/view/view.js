// The picture pane: draws the current scene at 320×136, thresholded to one bit, and scales it
// up in CSS with hard pixels. Reads G through sceneOf(); never changes it. A room change plays
// a dither dissolve, the way the old games wiped between rooms.

import { VIRT } from '../config.js';
import { drawScene, drawActors, finish } from './art.js';
import { sceneOf } from '../sim/game.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        canvas.width = VIRT.w; canvas.height = VIRT.h;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.time = 0;
        this.wipe = 0;           // seconds into a room change dissolve, or 0
        this.title = true;
        this.calm = false;
        this.shown = null;
    }

    onRoom() { if (!this.calm) this.wipe = 0.001; }

    frame(G, dt) {
        this.time += dt;
        const S = this.title ? { art: 'title', npcs: [], dread: 0 } : sceneOf(G);
        const t = this.calm ? 2 : this.time;
        drawScene(this.ctx, S, t);
        if (!this.title) drawActors(this.ctx, S, t);
        finish(this.ctx, S, t);
        if (this.wipe > 0) {
            this.wipe += dt;
            const p = Math.min(1, this.wipe / 0.45);
            const lvl = Math.round((1 - p) * 16);
            const im = this.ctx.getImageData(0, 0, VIRT.w, VIRT.h), px = im.data;
            for (let y = 0; y < VIRT.h; y++) for (let x = 0; x < VIRT.w; x++) {
                if (BAYER[(y & 3) * 4 + (x & 3)] < lvl) { const i = (y * VIRT.w + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
            }
            this.ctx.putImageData(im, 0, 0);
            if (p >= 1) this.wipe = 0;
        }
    }
}
