/**
 * The software 3D renderer.
 *
 * Pipeline, per frame:
 *   1. flat-shaded ceiling and floor, banded by row distance
 *   2. wall faces: cull by plane side -> transform -> near-clip ->
 *      project -> perspective-correct textured columns with a per-column
 *      depth buffer
 *   3. billboard sprites, back to front, depth-tested per column
 *
 * The trick that makes step 2 need no polygon sorting: every wall in the
 * dungeon spans the same world-space height, so within a single screen
 * column a nearer wall's vertical extent always contains a farther one's.
 * A one-dimensional depth buffer is therefore an exact visibility
 * solution, in any draw order.
 */

import { SHADES, shadeTable, ditherLevel } from './palette.js';
import { TRANSPARENT } from './framebuffer.js';

const NEAR = 0.02;

/** Face ids, used for per-face brightness and texture variation. */
export const FACE_N = 0, FACE_E = 1, FACE_S = 2, FACE_W = 3;

export class Renderer {
    /**
     * @param {Framebuffer} fb
     * @param {{x:number,y:number,w:number,h:number}} viewport region of the
     *        framebuffer the 3D view occupies (the rest is status bar).
     */
    constructor(fb, viewport) {
        this.fb = fb;
        this.setViewport(viewport);
        this.setFov(62);
        this.lightFalloff = 0.80;                  // shade levels per world unit
        this.faceLight = [0.0, 0.8, 1.5, 0.8];      // N brightest, S darkest
        this.maxCellRadius = 16;
        // Walls step through discrete shade levels the way hand-drawn
        // blobber art did; only the floor and ceiling gradients are
        // dithered, where banding would otherwise be obvious.
        this.ditherWalls = false;
    }

    setViewport(v) {
        this.vp = v;
        this.depth = new Float32Array(v.w);
        this.cx = v.x + v.w / 2;
        this.horizon = v.y + v.h / 2;
    }

    setFov(degrees) {
        this.fov = degrees;
        this.focal = (this.vp.w / 2) / Math.tan((degrees * Math.PI / 180) / 2);
    }

    /**
     * @param {object} world   { width, height, solidAt(x,y), wallTexture(x,y,face),
     *                           floorColor, ceilColor }
     * @param {object} cam     { x, y, angle, pitch }
     * @param {Array}  sprites [{ x, y, bmp, height, yOffset, shadeBoost, fullBright }]
     */
    render(world, cam, sprites = []) {
        this.depth.fill(Infinity);
        this._cam = cam;
        this._sin = Math.sin(cam.angle);
        this._cos = Math.cos(cam.angle);
        this.horizon = this.vp.y + this.vp.h / 2 + (cam.pitch || 0);
        this._drawFloorAndCeiling(world);
        this._drawWalls(world);
        this._drawSprites(sprites);
    }

    // --- camera transform -------------------------------------------------
    // Angle 0 faces north (-y): forward = (sin a, -cos a), right = (cos a, sin a).

    _toCamera(wx, wy, out) {
        const dx = wx - this._cam.x, dy = wy - this._cam.y;
        out.z = dx * this._sin - dy * this._cos;
        out.x = dx * this._cos + dy * this._sin;
        return out;
    }

    // --- floor / ceiling --------------------------------------------------

    _drawFloorAndCeiling(world) {
        const fb = this.fb, vp = this.vp;
        const halfFocal = 0.5 * this.focal;
        const yTop = vp.y, yBot = vp.y + vp.h - 1;
        for (let y = yTop; y <= yBot; y++) {
            const dy = y - this.horizon;
            if (Math.abs(dy) < 0.5) {
                // the horizon row is infinitely far away, so it is black
                fb.hline(vp.x, vp.x + vp.w - 1, y, 0);
                continue;
            }
            const dist = halfFocal / Math.abs(dy);
            const color = dy > 0 ? world.floorColor : world.ceilColor;
            const level = Math.min(SHADES - 1, dist * this.lightFalloff);
            // dither along the row so the bands break into a stipple
            for (let x = vp.x; x < vp.x + vp.w; x++) {
                const l = Math.min(SHADES - 1, ditherLevel(level, x, y));
                fb.pixels[y * fb.width + x] = shadeTable[l * 16 + color];
            }
        }
    }

    // --- walls ------------------------------------------------------------

    _drawWalls(world) {
        const cam = this._cam;
        const R = this.maxCellRadius;
        const minX = Math.max(0, Math.floor(cam.x) - R);
        const maxX = Math.min(world.width - 1, Math.floor(cam.x) + R);
        const minY = Math.max(0, Math.floor(cam.y) - R);
        const maxY = Math.min(world.height - 1, Math.floor(cam.y) + R);
        const fwdX = this._sin, fwdY = -this._cos;

        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                if (!world.solidAt(cx, cy)) continue;
                // reject cells wholly behind the camera
                const ccx = cx + 0.5 - cam.x, ccy = cy + 0.5 - cam.y;
                if (ccx * fwdX + ccy * fwdY < -1.0) continue;

                // Endpoints are ordered so that a projects left of b for a
                // viewer on the visible side; anything else is a back face.
                if (cam.y < cy && !world.solidAt(cx, cy - 1))
                    this._face(world, cx, cy, FACE_N, cx + 1, cy, cx, cy);
                if (cam.y > cy + 1 && !world.solidAt(cx, cy + 1))
                    this._face(world, cx, cy, FACE_S, cx, cy + 1, cx + 1, cy + 1);
                if (cam.x < cx && !world.solidAt(cx - 1, cy))
                    this._face(world, cx, cy, FACE_W, cx, cy, cx, cy + 1);
                if (cam.x > cx + 1 && !world.solidAt(cx + 1, cy))
                    this._face(world, cx, cy, FACE_E, cx + 1, cy + 1, cx + 1, cy);
            }
        }
    }

    _face(world, cellX, cellY, face, ax, ay, bx, by) {
        const A = this._toCamera(ax, ay, { x: 0, z: 0 });
        const B = this._toCamera(bx, by, { x: 0, z: 0 });
        let ua = 0, ub = 1;

        if (A.z < NEAR && B.z < NEAR) return;
        if (A.z < NEAR) {
            const t = (NEAR - A.z) / (B.z - A.z);
            A.x += (B.x - A.x) * t; ua += (ub - ua) * t; A.z = NEAR;
        } else if (B.z < NEAR) {
            const t = (NEAR - B.z) / (A.z - B.z);
            B.x += (A.x - B.x) * t; ub += (ua - ub) * t; B.z = NEAR;
        }

        const f = this.focal;
        const sxa = this.cx + (A.x * f) / A.z;
        const sxb = this.cx + (B.x * f) / B.z;
        if (sxa >= sxb) return;   // degenerate or back-facing after projection

        const vp = this.vp;
        let x0 = Math.ceil(sxa - 0.5), x1 = Math.ceil(sxb - 0.5) - 1;
        if (x1 < vp.x || x0 >= vp.x + vp.w) return;
        if (x0 < vp.x) x0 = vp.x;
        if (x1 >= vp.x + vp.w) x1 = vp.x + vp.w - 1;

        const tex = world.wallTexture(cellX, cellY, face);
        if (!tex) return;
        const invA = 1 / A.z, invB = 1 / B.z;
        const uaZ = ua * invA, ubZ = ub * invB;
        const span = sxb - sxa;
        const faceShade = this.faceLight[face];

        for (let x = x0; x <= x1; x++) {
            const t = (x + 0.5 - sxa) / span;
            const invZ = invA + (invB - invA) * t;
            const z = 1 / invZ;
            const di = x - vp.x;
            if (z >= this.depth[di]) continue;
            const u = (uaZ + (ubZ - uaZ) * t) * z;
            const half = (0.5 * f) * invZ;
            const level = Math.min(SHADES - 1, z * this.lightFalloff + faceShade);
            this._texColumn(x, this.horizon - half, this.horizon + half, tex, u, level);
            this.depth[di] = z;
        }
    }

    /** One perspective-correct textured wall column, vertically clipped. */
    _texColumn(x, yTop, yBot, tex, u, level) {
        const fb = this.fb, vp = this.vp;
        const height = yBot - yTop;
        if (height <= 0) return;
        let col = ((u * tex.w) | 0) % tex.w;
        if (col < 0) col += tex.w;
        const step = tex.h / height;
        let y0 = Math.ceil(yTop), y1 = Math.ceil(yBot) - 1;
        const clipTop = vp.y, clipBot = vp.y + vp.h - 1;
        let v = (y0 - yTop) * step;
        if (y0 < clipTop) { v += (clipTop - y0) * step; y0 = clipTop; }
        if (y1 > clipBot) y1 = clipBot;
        const w = fb.width, px = fb.pixels, data = tex.data, th = tex.h;
        if (this.ditherWalls) {
            for (let y = y0; y <= y1; y++, v += step) {
                let ty = v | 0;
                if (ty >= th) ty = th - 1; else if (ty < 0) ty = 0;
                const l = Math.min(SHADES - 1, ditherLevel(level, x, y));
                px[y * w + x] = shadeTable[l * 16 + data[ty * tex.w + col]];
            }
        } else {
            const row = (Math.min(SHADES - 1, Math.round(level)) | 0) * 16;
            for (let y = y0; y <= y1; y++, v += step) {
                let ty = v | 0;
                if (ty >= th) ty = th - 1; else if (ty < 0) ty = 0;
                px[y * w + x] = shadeTable[row + data[ty * tex.w + col]];
            }
        }
    }

    // --- sprites ----------------------------------------------------------

    _drawSprites(sprites) {
        const view = [];
        for (const s of sprites) {
            const p = this._toCamera(s.x, s.y, { x: 0, z: 0 });
            if (p.z < 0.08) continue;
            view.push({ s, cx: p.x, z: p.z });
        }
        view.sort((a, b) => b.z - a.z);   // far to near
        for (const v of view) this._sprite(v.s, v.cx, v.z);
    }

    _sprite(s, camX, z) {
        const fb = this.fb, vp = this.vp, f = this.focal;
        const bmp = s.bmp;
        const worldH = s.height ?? 0.7;
        const worldW = worldH * (bmp.w / bmp.h);
        const scale = f / z;
        const screenX = this.cx + camX * scale;
        // feet rest on the floor plane (world y = -0.5) unless lifted
        const footY = -0.5 + (s.yOffset || 0);
        const yBot = this.horizon - footY * scale;
        const yTop = yBot - worldH * scale;
        const halfW = (worldW * scale) / 2;
        const x0 = Math.ceil(screenX - halfW - 0.5), x1 = Math.ceil(screenX + halfW - 0.5) - 1;
        if (x1 < vp.x || x0 >= vp.x + vp.w) return;
        const level = s.fullBright ? 0
            : Math.min(SHADES - 1, z * this.lightFalloff + (s.shadeBoost || 0));
        const drawX0 = Math.max(x0, vp.x), drawX1 = Math.min(x1, vp.x + vp.w - 1);
        const spanW = (halfW * 2) || 1;
        const height = yBot - yTop;
        if (height <= 0) return;
        const stepV = bmp.h / height;
        const clipTop = vp.y, clipBot = vp.y + vp.h - 1;
        let ry0 = Math.ceil(yTop), ry1 = Math.ceil(yBot) - 1;
        let v0 = (ry0 - yTop) * stepV;
        if (ry0 < clipTop) { v0 += (clipTop - ry0) * stepV; ry0 = clipTop; }
        if (ry1 > clipBot) ry1 = clipBot;
        if (ry1 < ry0) return;
        const w = fb.width, px = fb.pixels, data = bmp.data;

        for (let x = drawX0; x <= drawX1; x++) {
            if (z >= this.depth[x - vp.x]) continue;
            let tx = (((x + 0.5 - (screenX - halfW)) / spanW) * bmp.w) | 0;
            if (tx < 0) tx = 0; else if (tx >= bmp.w) tx = bmp.w - 1;
            let v = v0;
            for (let y = ry0; y <= ry1; y++, v += stepV) {
                let ty = v | 0;
                if (ty >= bmp.h) ty = bmp.h - 1; else if (ty < 0) ty = 0;
                const c = data[ty * bmp.w + tx];
                if (c === TRANSPARENT) continue;
                const l = Math.min(SHADES - 1, ditherLevel(level, x, y));
                px[y * w + x] = shadeTable[l * 16 + c];
            }
        }
    }
}
