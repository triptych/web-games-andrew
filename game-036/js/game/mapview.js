/**
 * mapview.js — draws the overmap onto a 2D canvas.
 *
 * Deliberately plain Canvas2D rather than anything routed through the software
 * rasterizer: the map is a flat top-down image with text on it, and the
 * rasterizer has no text, no 2D primitives, and no reason to grow them.
 *
 * One draw routine serves two presentations:
 *   - the full-screen map (M), which fits the whole grid in view and carries
 *     labels, a legend, and a north arrow;
 *   - the corner minimap, which crops to a window around the player and drops
 *     the text so it stays readable at ~150px.
 *
 * The explored grid is composited through a small offscreen canvas — one pixel
 * per map cell, `imageSmoothingEnabled = false`, scaled up on blit. Drawing
 * ~9000 individual `fillRect`s per frame is what a naive version does, and it
 * costs more than the entire 3D scene; a 94x94 `putImageData` plus one scaled
 * `drawImage` is effectively free. The offscreen is only re-rasterized when
 * the explored-cell count changes, so panning the minimap while standing still
 * re-blits without touching the pixels.
 */

import { MAP_CELL } from './mapstate.js';

// Unexplored ground. Not pure black — a faint blue-grey reads as "chart paper
// you have not filled in" rather than as a hole in the UI.
const UNKNOWN_COLOR = [26, 32, 42];

// Per-region pin glyph on the full map. Region labels do the naming; these
// just make a landmark findable at a glance.
//
// Deliberately drawn from a conservative symbol set rather than emoji. Emoji
// render at wildly different sizes across platforms, ignore the monospace
// stack the rest of the map uses, and fall back to tofu boxes where a font is
// missing — none of which is acceptable for a glyph that has to sit centred on
// a 4px pin. These all have coverage in the standard Windows/macOS/Linux
// monospace fonts.
const REGION_GLYPH = {
    lighthouse: '‡', cave: '◒', cemetery: '†', garden: '✿',
    ruins: '∏', library: '▤', museum: '◊',
    shore: '≈', forest: '♣', meadow: '·',
};

export class MapView {
    /** @param mapState MapState instance supplying cells and annotations. */
    constructor(mapState) {
        this.map = mapState;

        // One pixel per map cell; scaled up when blitted.
        this._grid = document.createElement('canvas');
        this._grid.width = mapState.size;
        this._grid.height = mapState.size;
        this._gridCtx = this._grid.getContext('2d');
        this._gridImage = this._gridCtx.createImageData(mapState.size, mapState.size);
        // Tracks the explored-cell count the offscreen was built from, so it is
        // rebuilt exactly when the grid has actually changed.
        this._gridStamp = -1;

        this._fillUnknown();
    }

    _fillUnknown() {
        const d = this._gridImage.data;
        const [r, g, b] = UNKNOWN_COLOR;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        }
    }

    /** Re-rasterize the offscreen grid, but only if cells were revealed since. */
    _refreshGrid() {
        const stamp = this.map._seenCount;
        if (stamp === this._gridStamp) return;
        this._gridStamp = stamp;

        const { size, cells, colors } = this.map;
        const d = this._gridImage.data;
        const [ur, ug, ub] = UNKNOWN_COLOR;
        for (let i = 0, p = 0; i < cells.length; i++, p += 4) {
            if (cells[i]) {
                const c = colors[i];
                d[p] = (c >> 16) & 255;
                d[p + 1] = (c >> 8) & 255;
                d[p + 2] = c & 255;
            } else {
                d[p] = ur; d[p + 1] = ug; d[p + 2] = ub;
            }
            d[p + 3] = 255;
        }
        this._gridCtx.putImageData(this._gridImage, 0, 0);
    }

    /**
     * Draw the map.
     *
     * @param ctx        destination 2D context
     * @param w,h        destination size in CSS pixels
     * @param camera     FirstPersonCamera — position and facing for the marker
     * @param opts.mode  'full' (whole island, labelled) or 'mini' (cropped,
     *                   unlabelled, player-centred)
     * @param opts.viewRadius  world-unit half-width of the crop in 'mini' mode
     */
    draw(ctx, w, h, camera, opts = {}) {
        const mode = opts.mode || 'full';
        const mini = mode === 'mini';
        this._refreshGrid();

        const px = camera.pos[0], pz = camera.pos[2];
        const half = this.map.halfExtent;

        // World->screen: uniform scale, +x right and +z down, so the map's
        // orientation matches the world axes and north (-z) is up.
        let scale, originX, originZ; // world coords at the destination's top-left
        if (mini) {
            const viewR = opts.viewRadius || 70;
            scale = Math.min(w, h) / (viewR * 2);
            originX = px - w / (2 * scale);
            originZ = pz - h / (2 * scale);
        } else {
            scale = Math.min(w, h) / (half * 2);
            originX = -w / (2 * scale);
            originZ = -h / (2 * scale);
        }
        const toX = (wx) => (wx - originX) * scale;
        const toY = (wz) => (wz - originZ) * scale;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // --- explored grid ---
        // Blit the whole offscreen through the same transform; the destination
        // clip discards whatever falls outside, which is cheaper than working
        // out a sub-rectangle and lets 'mini' overhang the grid edge safely.
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        const gx = toX(-half), gy = toY(-half);
        const gs = this.map.size * MAP_CELL * scale;
        ctx.drawImage(this._grid, gx, gy, gs, gs);
        ctx.imageSmoothingEnabled = true;

        // --- grid lines ---
        // The brief was a grid-based map, and the lines also give a sense of
        // distance. Spaced in world units so they mean something (each line is
        // a fixed number of paces apart) and skipped when they would alias into
        // a solid wash.
        const gridStep = mini ? MAP_CELL * 4 : MAP_CELL * 8;
        if (gridStep * scale > 7) {
            ctx.strokeStyle = 'rgba(255,255,255,0.055)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const x0 = Math.ceil(originX / gridStep) * gridStep;
            for (let wx = x0; toX(wx) < w; wx += gridStep) {
                const sx = Math.round(toX(wx)) + 0.5;
                ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
            }
            const z0 = Math.ceil(originZ / gridStep) * gridStep;
            for (let wz = z0; toY(wz) < h; wz += gridStep) {
                const sy = Math.round(toY(wz)) + 0.5;
                ctx.moveTo(0, sy); ctx.lineTo(w, sy);
            }
            ctx.stroke();
        }

        // --- item pins ---
        for (const item of this.map.visibleItems()) {
            const sx = toX(item.pos[0]), sy = toY(item.pos[1]);
            if (sx < -8 || sy < -8 || sx > w + 8 || sy > h + 8) continue;
            this._drawItemPin(ctx, sx, sy, item, mini);
        }

        // --- region annotations ---
        // Labels are placed in two passes: pins first so no label is painted
        // under a pin, then the text with collision nudging.
        const labels = [];
        for (const reg of this.map.discoveredRegions()) {
            const sx = toX(reg.x), sy = toY(reg.z);
            if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue;
            this._drawRegionGlyph(ctx, sx, sy, reg, mini);
            if (!mini) labels.push({ reg, sx, sy });
        }
        // The player marker is passed in as an obstacle so a region name cannot
        // be written across the one thing on the map you always need to find.
        if (!mini) this._drawRegionLabels(ctx, labels, { x: toX(px), y: toY(pz) });

        // --- player marker ---
        this._drawPlayer(ctx, toX(px), toY(pz), camera.yaw, mini);

        if (!mini) this._drawFullChrome(ctx, w, h);

        ctx.restore();
    }

    /**
     * Collected items stay on the map as hollow, dimmed marks: the pin is a
     * record of the place, and erasing it would lose the only trace that you
     * already cleared that corner of the island.
     */
    _drawItemPin(ctx, sx, sy, item, mini) {
        const r = mini ? 2.6 : 4.2;
        const book = item.kind === 'book';
        const color = book ? '#ffcf5c' : '#7fe3c8';

        ctx.lineWidth = mini ? 1 : 1.5;
        ctx.beginPath();
        if (book) {
            ctx.rect(sx - r, sy - r, r * 2, r * 2);
        } else {
            ctx.moveTo(sx, sy - r * 1.2);
            ctx.lineTo(sx + r * 1.1, sy + r * 0.9);
            ctx.lineTo(sx - r * 1.1, sy + r * 0.9);
            ctx.closePath();
        }
        if (item.collected) {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.stroke();
        } else {
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            ctx.stroke();
        }
    }

    _drawRegionGlyph(ctx, sx, sy, reg, mini) {
        if (mini) {
            // No text at minimap scale — a dot is all that fits legibly.
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        ctx.font = '13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(6,10,14,0.8)';
        const glyph = REGION_GLYPH[reg.type] || '◆';
        ctx.strokeText(glyph, sx, sy - 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(glyph, sx, sy - 1);
    }

    /**
     * Region names, nudged apart where they would collide.
     *
     * Region anchors are placed independently and can end up a few world units
     * apart (regions.js walks each one inland until the terrain suits it, which
     * can converge two of them on the same shelf), so at map scale their names
     * overlap into unreadable mush. A single greedy pass — sort by importance,
     * then push each label down past whatever is already occupying its slot —
     * is enough here: there are at most ~20 labels and the map is static while
     * open, so there is no risk of the arrangement jittering frame to frame.
     */
    _drawRegionLabels(ctx, labels, playerMark) {
        const LINE_H = 12;
        // Landmarks claim their preferred position first; scenery labels move.
        const ordered = [...labels].sort((a, b) => (b.reg.unique ? 1 : 0) - (a.reg.unique ? 1 : 0));
        const placed = [];
        // Reserve the player marker's box up front, so it participates in the
        // same nudging pass as the labels rather than being drawn over.
        if (playerMark) {
            const r = 9;
            placed.push({ ty: playerMark.y - r, x0: playerMark.x - r, x1: playerMark.x + r });
            placed.push({ ty: playerMark.y, x0: playerMark.x - r, x1: playerMark.x + r });
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (const item of ordered) {
            const { reg, sx } = item;
            ctx.font = reg.unique ? 'bold 11px "Courier New", monospace' : '10px "Courier New", monospace';
            const halfW = ctx.measureText(reg.name).width / 2 + 3;
            let ty = item.sy + 8;
            // Step down until this box clears every box already placed.
            for (let guard = 0; guard < 24; guard++) {
                const clash = placed.some(p =>
                    Math.abs(p.ty - ty) < LINE_H && sx - halfW < p.x1 && sx + halfW > p.x0);
                if (!clash) break;
                ty += LINE_H;
            }
            placed.push({ ty, x0: sx - halfW, x1: sx + halfW });

            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(6,10,14,0.85)';
            ctx.strokeText(reg.name, sx, ty);
            ctx.fillStyle = reg.unique ? '#e8f4ff' : 'rgba(226,240,255,0.62)';
            ctx.fillText(reg.name, sx, ty);
        }
    }

    _drawPlayer(ctx, sx, sy, yaw, mini) {
        // yaw 0 faces -Z (see camera.forwardXZ), which is up on the map.
        const size = mini ? 5 : 7;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(yaw);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.68, size * 0.75);
        ctx.lineTo(0, size * 0.35);
        ctx.lineTo(-size * 0.68, size * 0.75);
        ctx.closePath();
        ctx.fillStyle = '#ff5d4d';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        ctx.restore();
    }

    /** North arrow, scale bar, and legend — full map only. */
    _drawFullChrome(ctx, w, h) {
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // North arrow
        const nx = w - 30, ny = 30;
        ctx.beginPath();
        ctx.moveTo(nx, ny - 12);
        ctx.lineTo(nx + 5, ny + 4);
        ctx.lineTo(nx - 5, ny + 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(232,244,255,0.85)';
        ctx.fill();
        ctx.fillText('N', nx, ny + 14);

        // Scale bar: 50 world units, measured through the same scale factor the
        // grid was drawn with so it stays honest if the map is resized.
        const scale = Math.min(w, h) / (this.map.halfExtent * 2);
        const barW = 50 * scale;
        const bx = 24, by = h - 26;
        ctx.strokeStyle = 'rgba(232,244,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + barW, by);
        ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
        ctx.moveTo(bx + barW, by - 4); ctx.lineTo(bx + barW, by + 4);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.font = '11px "Courier New", monospace';
        ctx.fillStyle = 'rgba(232,244,255,0.8)';
        ctx.fillText('50 paces', bx, by - 12);

        // Legend
        const items = [
            ['#ffcf5c', 'square', 'Book'],
            ['#7fe3c8', 'triangle', 'Artifact'],
            [null, 'hollow', 'Already collected'],
        ];
        let ly = h - 96;
        ctx.textBaseline = 'middle';
        for (const [color, shape, text] of items) {
            const cx = bx + 6;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (shape === 'triangle') {
                ctx.moveTo(cx, ly - 4.5);
                ctx.lineTo(cx + 4.5, ly + 3.5);
                ctx.lineTo(cx - 4.5, ly + 3.5);
                ctx.closePath();
            } else {
                ctx.rect(cx - 4, ly - 4, 8, 8);
            }
            if (color) {
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            }
            ctx.stroke();
            ctx.fillStyle = 'rgba(232,244,255,0.8)';
            ctx.fillText(text, cx + 12, ly);
            ly += 18;
        }
    }
}
