/**
 * renderer.js — software 3D rasterizer on top of Canvas2D.
 *
 * Pipeline per frame:
 *   1. Caller submits a list of "instances" ({ mesh, pos, rotY, colorMul? }).
 *   2. Each instance's verts are transformed to world space, then to
 *      view space via the camera's view matrix.
 *   3. Triangles are clipped against the near plane — one straddling it
 *      becomes 1 or 2 triangles — then projected to screen space.
 *   4. Backface culling via screen-space winding.
 *   5. Flat shading: color = triCol * clamp(dot(worldNormal, lightDir)) + ambient.
 *   6. Triangles are sorted back-to-front by average view-space depth
 *      (painter's algorithm — no z-buffer needed at this poly budget)
 *      and filled with ctx.fill() using Path2D.
 *
 * This is deliberately simple (no per-pixel z-buffer, no clipping against the
 * side planes) — it trades perfect correctness for speed and code size, which
 * is fine at the low poly counts a hand-rolled CPU renderer can afford.
 * Distance fog hides most far-plane artifacts.
 */

import { v3sub, v3cross, v3norm, v3dot, v3transformMat4, mat4Perspective, mat4ViewFromYawPitch, clamp } from './math.js';

export class Renderer {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.fov = opts.fov ?? (70 * Math.PI / 180);
        this.near = opts.near ?? 0.1;
        this.far = opts.far ?? 140;
        this.lightDir = v3norm(opts.lightDir ?? [0.5, 0.9, 0.3]);
        // Lighting model (all additive, clamped in render()): a flat ambient floor, a
        // hemisphere "sky bounce" fill weighted by how upward-facing a face is, and a
        // half-Lambert key light (see _emitTri() for why it wraps rather than clamps).
        // Because the wrap term never reaches 0, ambient only has to catch the fully
        // back-lit case; tuned so shade lands ~0.62 at worst and ~1.05 fully lit.
        this.ambient = opts.ambient ?? 0.38;
        this.fillLight = opts.fillLight ?? 0.14;
        this.keyLight = opts.keyLight ?? 0.55;
        this.fogColor = opts.fogColor ?? [176, 205, 224];
        // Fog only kicks in near the far plane — it exists to hide chunk pop-in and the
        // hard draw-distance edge, not to tint the mid-ground. Starting it early washes
        // the whole scene (the ocean in particular) out to sky color.
        this.fogNear = opts.fogNear ?? this.far * 0.82;
        this.fogFar = opts.fogFar ?? this.far;
        this._resize();
        this._triBuffer = []; // reused each frame to avoid GC churn
        this._clipBuffer = []; // reused by _clipTriNear() for the same reason
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        this.canvas.width = Math.max(1, Math.floor(w * dpr));
        this.canvas.height = Math.max(1, Math.floor(h * dpr));
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.aspect = this.width / this.height;
        this.proj = mat4Perspective(this.fov, this.aspect, this.near, this.far);
    }

    onResize() { this._resize(); }

    /** clear the frame to sky/fog color (fallback behind the sky dome). */
    clear() {
        const [r, g, b] = this.fogColor;
        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Render a batch of instances against a camera.
     * camera: { pos:[x,y,z], yaw, pitch }
     * instances: [{ mesh, pos:[x,y,z], rotY, colorMul:[r,g,b] }]
     */
    render(camera, instances) {
        const view = mat4ViewFromYawPitch(camera.pos, camera.yaw, camera.pitch);
        const half = this.height / 2;
        const halfW = this.width / 2;
        const buf = this._triBuffer;
        buf.length = 0;

        for (const inst of instances) {
            const mesh = inst.mesh;
            const cy = Math.cos(inst.rotY || 0), sy = Math.sin(inst.rotY || 0);
            const ox = inst.pos[0], oy = inst.pos[1], oz = inst.pos[2];
            const cmul = inst.colorMul || [1, 1, 1];
            const scale = inst.scale ?? 1;

            // Transform verts to view space once per instance.
            const vcount = mesh.verts.length;
            const viewVerts = new Array(vcount);
            const worldVerts = new Array(vcount);
            for (let i = 0; i < vcount; i++) {
                const v = mesh.verts[i];
                const wx = (v[0] * cy + v[2] * sy) * scale + ox;
                const wy = v[1] * scale + oy;
                const wz = (-v[0] * sy + v[2] * cy) * scale + oz;
                worldVerts[i] = [wx, wy, wz];
                const t = v3transformMat4([wx, wy, wz], view);
                viewVerts[i] = t;
            }

            for (const tri of mesh.tris) {
                const [ia, ib, ic, color] = tri;
                const a = viewVerts[ia], b = viewVerts[ib], c = viewVerts[ic];

                // Near-plane clipping. View space looks down -Z, so a vertex is visible
                // when z <= -near. Dropping the whole triangle when ANY vertex fails
                // punches a hole in precisely the geometry nearest the camera: ground
                // quads span several world units while the eye sits ~1.7 units up, so
                // the triangle under the player almost always has one vertex behind the
                // plane. The terrain you're standing on then vanishes and you see through
                // to the ocean/sky backdrop. Clip to the visible side instead and fan the
                // resulting 3- or 4-gon.
                const poly = this._clipTriNear(a, b, c);
                if (poly.length < 3) continue;

                // Shading and winding are recomputed per output triangle, but always from
                // the ORIGINAL world-space verts: a clipped face is still flat, so its
                // normal is unchanged, and using the clipped verts would make the fan's
                // pieces shade inconsistently.
                const wa = worldVerts[ia], wb = worldVerts[ib], wc = worldVerts[ic];
                for (let f = 0; f + 2 < poly.length; f++) {
                    this._emitTri(poly[0], poly[f + 1], poly[f + 2],
                        wa, wb, wc, color, cmul, inst, halfW, half, buf);
                }
            }
        }

        // Painter's algorithm: far to near
        buf.sort((t1, t2) => t2.depth - t1.depth);

        const ctx = this.ctx;
        // Each triangle is both filled and stroked in its own colour. Canvas2D
        // antialiases fill edges to partial coverage, so two triangles sharing an
        // edge blend with whatever was underneath instead of meeting exactly —
        // which shows up as a hairline wireframe over the whole terrain. Stroking
        // the same path widens coverage by half a pixel on each side and closes
        // the seam without needing a supersampled buffer.
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1;
        for (let i = 0; i < buf.length; i++) {
            const t = buf[i];
            const style = `rgb(${t.r},${t.g},${t.b})`;
            ctx.fillStyle = style;
            ctx.strokeStyle = style;
            ctx.beginPath();
            ctx.moveTo(t.sax, t.say);
            ctx.lineTo(t.sbx, t.sby);
            ctx.lineTo(t.scx, t.scy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * Clip a view-space triangle against the near plane (Sutherland-Hodgman on a
     * single plane). The visible half-space is z <= -near; returns 0, 3 or 4 verts
     * in the input winding order, with new verts landing exactly on the plane.
     *
     * The returned array is reused between calls — fan over it before clipping again.
     */
    _clipTriNear(a, b, c) {
        const near = this.near;
        // Signed distance into the visible half-space; positive means inside.
        const da = -a.z - near, db = -b.z - near, dc = -c.z - near;

        // Fast paths: fully inside (the common case) needs no allocation or lerps,
        // fully outside is rejected outright.
        const out = this._clipBuffer;
        out.length = 0;
        if (da >= 0 && db >= 0 && dc >= 0) {
            out.push(a, b, c);
            return out;
        }
        if (da < 0 && db < 0 && dc < 0) return out;

        const verts = [a, b, c], dists = [da, db, dc];
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const cur = verts[i], nxt = verts[j];
            const dCur = dists[i], dNxt = dists[j];
            if (dCur >= 0) out.push(cur);
            // An edge crossing the plane in either direction contributes its
            // intersection point, which keeps the output polygon closed.
            if ((dCur >= 0) !== (dNxt >= 0)) {
                const t = dCur / (dCur - dNxt);
                out.push({
                    x: cur.x + (nxt.x - cur.x) * t,
                    y: cur.y + (nxt.y - cur.y) * t,
                    z: cur.z + (nxt.z - cur.z) * t,
                    w: cur.w + (nxt.w - cur.w) * t,
                });
            }
        }
        return out;
    }

    /**
     * Project one already-near-clipped view-space triangle, cull and shade it, then
     * push it into the draw buffer. wa/wb/wc are the source face's unclipped
     * world-space verts, used only for the flat normal.
     */
    _emitTri(a, b, c, wa, wb, wc, color, cmul, inst, halfW, half, buf) {
        const az = -a.z, bz = -b.z, cz = -c.z;
        const pax = (a.x / az), pay = (a.y / az);
        const pbx = (b.x / bz), pby = (b.y / bz);
        const pcx = (c.x / cz), pcy = (c.y / cz);

        // Project using the projection matrix's scale terms directly (cheaper than a
        // full mat4 multiply per vertex). proj[5] = 1/tan(fov/2) = vertical scale;
        // the horizontal scale is the same value, since dividing by aspect and then
        // multiplying by halfW (= halfH * aspect) cancels the aspect term out.
        const f = this.proj[5];
        const sax = halfW + pax * f * half;
        const say = half - pay * f * half;
        const sbx = halfW + pbx * f * half;
        const sby = half - pby * f * half;
        const scx = halfW + pcx * f * half;
        const scy = half - pcy * f * half;

        // Backface cull via screen-space signed area (CW/CCW).
        // Double-sided instances skip this: procedurally traced surfaces like
        // stream ribbons follow arbitrary headings, so their winding isn't
        // known ahead of time and consistent culling can't be relied on.
        const area = (sbx - sax) * (scy - say) - (sby - say) * (scx - sax);
        if (area === 0) return;
        if (!inst.doubleSided && area > 0) return; // front faces wind negative here

        // Flat shading from world-space face normal
        const e1 = v3sub(wb, wa), e2 = v3sub(wc, wa);
        let n = v3norm(v3cross(e1, e2));
        // On a double-sided face we may be looking at the back, where the geometric
        // normal points away and would shade the surface as if it were unlit.
        // Flip it to face the viewer so both sides light consistently.
        if (inst.doubleSided && area > 0) n = [-n[0], -n[1], -n[2]];
        // Half-Lambert ("wrap") key light + hemisphere sky fill.
        //
        // A plain max(dot(n,L),0) key light makes this scene read as mud: in a
        // first-person walker the faces you're looking at are usually the ones
        // turned away from the sun, so they'd collapse to the ambient floor and
        // every pale material (lighthouse render, museum marble) would look brown.
        // Half-Lambert remaps dot from [-1,1] to [0,1] instead of clamping, so
        // light wraps around the form and unlit faces keep their hue.
        const wrap = v3dot(n, this.lightDir) * 0.5 + 0.5;
        const skyFill = (n[1] * 0.5 + 0.5) * this.fillLight;
        const shade = clamp(this.ambient + skyFill + wrap * this.keyLight, 0, 1.15);

        const depth = (az + bz + cz) / 3;
        // Backdrop instances (ocean, clouds) opt out of the far-plane cull so the
        // horizon still reads as water/sky instead of showing the void past the
        // last loaded chunk. They're a fixed handful of triangles, so drawing them
        // at any distance costs nothing; terrain chunks stay culled for framerate.
        if (depth > this.far && !inst.noFarCull) return;

        const fogT = inst.noFogFade
            ? 0
            : clamp((depth - this.fogNear) / (this.fogFar - this.fogNear), 0, 1);

        let r = color[0] * shade, g = color[1] * shade, bl = color[2] * shade;
        if (cmul[0] !== 1 || cmul[1] !== 1 || cmul[2] !== 1) {
            r *= cmul[0]; g *= cmul[1]; bl *= cmul[2];
        }
        if (fogT > 0) {
            r = r + (this.fogColor[0] - r) * fogT;
            g = g + (this.fogColor[1] - g) * fogT;
            bl = bl + (this.fogColor[2] - bl) * fogT;
        }

        buf.push({
            depth,
            sax, say, sbx, sby, scx, scy,
            // shade can exceed 1 (ambient + fill + key), so clamp before packing to bytes
            r: r > 255 ? 255 : r | 0,
            g: g > 255 ? 255 : g | 0,
            b: bl > 255 ? 255 : bl | 0,
        });
    }
}
