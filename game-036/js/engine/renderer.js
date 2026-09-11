/**
 * renderer.js — software 3D rasterizer on top of Canvas2D.
 *
 * Pipeline per frame:
 *   1. Caller submits a list of "instances" ({ mesh, pos, rotY, colorMul? }).
 *   2. Each instance is rejected outright if its bounding sphere falls outside
 *      the view frustum (see _sphereInFrustum) — this is the single biggest
 *      win available to a CPU rasterizer, since at a 70deg FOV roughly three
 *      quarters of the loaded world sits behind or beside the camera.
 *   3. Surviving instances have their verts transformed to world space, then
 *      to view space via the camera's view matrix.
 *   4. Triangles are clipped against the near plane — one straddling it
 *      becomes 1 or 2 triangles — then projected to screen space.
 *   5. Backface culling via screen-space winding, then a viewport bounding-box
 *      reject for triangles that survived the near clip but land off-screen.
 *   6. Flat shading: color = triCol * clamp(dot(worldNormal, lightDir)) + ambient.
 *   7. Triangles are sorted back-to-front by average view-space depth
 *      (painter's algorithm — no z-buffer needed at this poly budget)
 *      and filled with ctx.fill().
 *
 * This is deliberately simple (no per-pixel z-buffer, no clipping against the
 * side planes) — it trades perfect correctness for speed and code size, which
 * is fine at the low poly counts a hand-rolled CPU renderer can afford.
 * Distance fog hides most far-plane artifacts.
 *
 * PERFORMANCE NOTES (the non-obvious parts):
 *   - Triangles land in flat typed arrays, not objects. An object per triangle
 *     meant tens of thousands of short-lived allocations per frame; at 60fps
 *     that is pure GC pressure. The sort runs over a Uint32Array of indices so
 *     each swap moves 4 bytes instead of a pointer into scattered heap.
 *   - Vertex transform scratch space is pooled across instances and frames
 *     rather than allocated per instance.
 */

import { v3norm, mat4Perspective, mat4ViewFromYawPitch, clamp } from './math.js';
import { meshBounds } from './mesh.js';

// Grown on demand; sized so a typical frame never has to reallocate.
const INITIAL_TRI_CAPACITY = 65536;

export class Renderer {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.fov = opts.fov ?? (70 * Math.PI / 180);
        this.near = opts.near ?? 0.1;
        this.far = opts.far ?? 140;
        this.lightDir = v3norm(opts.lightDir ?? [0.5, 0.9, 0.3]);
        // Upper bound on backing-store scale. 1.5 was chosen when the renderer
        // redrew every loaded chunk every frame; with frustum culling paying for
        // it, 2.0 is affordable and visibly sharpens distant geometry edges.
        this.maxDpr = opts.maxDpr ?? 2;
        // Lighting model (all additive, clamped in _emitTri()): a flat ambient floor, a
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

        // --- triangle buffer: struct-of-arrays, reused every frame ---
        this._triCap = INITIAL_TRI_CAPACITY;
        this._allocTriBuffers(this._triCap);
        this._triCount = 0;

        this._clipBuffer = []; // reused by _clipTriNear()
        // Vertex transform scratch, grown to fit the largest mesh seen so far.
        this._viewX = new Float64Array(0);
        this._viewY = new Float64Array(0);
        this._viewZ = new Float64Array(0);
        this._worldX = new Float64Array(0);
        this._worldY = new Float64Array(0);
        this._worldZ = new Float64Array(0);

        // Per-frame stats, useful with ?debug=1 and for tuning draw distance.
        this.stats = { instances: 0, instancesCulled: 0, tris: 0, trisDrawn: 0 };
    }

    _allocTriBuffers(cap) {
        this._tsx = new Float32Array(cap * 6); // screen verts, 6 floats per tri
        this._tdepth = new Float32Array(cap);
        this._tcolor = new Uint32Array(cap);   // packed 0x00RRGGBB
        this._torder = new Uint32Array(cap);
    }

    _growTriBuffers() {
        const cap = this._triCap * 2;
        const tsx = new Float32Array(cap * 6); tsx.set(this._tsx);
        const td = new Float32Array(cap); td.set(this._tdepth);
        const tc = new Uint32Array(cap); tc.set(this._tcolor);
        this._tsx = tsx;
        this._tdepth = td;
        this._tcolor = tc;
        this._torder = new Uint32Array(cap);
        this._triCap = cap;
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        this.canvas.width = Math.max(1, Math.floor(w * dpr));
        this.canvas.height = Math.max(1, Math.floor(h * dpr));
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.aspect = this.width / this.height;
        this.proj = mat4Perspective(this.fov, this.aspect, this.near, this.far);
        this._updateFrustumPlanes();
    }

    onResize() { this._resize(); }

    /** clear the frame to sky/fog color (fallback behind the sky dome). */
    clear() {
        const [r, g, b] = this.fogColor;
        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Recompute the six frustum half-spaces in VIEW space for the current
     * projection. View space looks down -Z, so the planes depend only on the
     * FOV, aspect and near/far distances — never on where the camera is or
     * which way it points. That is why this runs on resize, not per frame:
     * instead of transforming planes into world space each frame, we transform
     * each instance's bounding sphere into view space (one point, cheap) and
     * test it against these fixed planes.
     *
     * Each plane is (nx, ny, nz, d); a point is inside when dot(n,p) + d >= 0.
     */
    _updateFrustumPlanes() {
        const halfV = this.fov / 2;
        const sinV = Math.sin(halfV), cosV = Math.cos(halfV);
        // Horizontal half-angle follows from the vertical one and the aspect ratio.
        const tanH = Math.tan(halfV) * this.aspect;
        const invH = 1 / Math.sqrt(1 + tanH * tanH);
        const sinH = tanH * invH, cosH = invH;
        this._planes = new Float64Array([
            // near: -z >= near   ->  -z - near >= 0
            0, 0, -1, -this.near,
            // far:  -z <= far    ->   z + far  >= 0
            0, 0, 1, this.far,
            // left / right: normals tilt inward from the -Z axis
            cosH, 0, -sinH, 0,
            -cosH, 0, -sinH, 0,
            // top / bottom
            0, cosV, -sinV, 0,
            0, -cosV, -sinV, 0,
        ]);
    }

    /**
     * Test a view-space bounding sphere against the frustum. Conservative:
     * returns false only when the sphere lies wholly outside some plane, so a
     * sphere straddling a corner may pass and be rejected later per triangle.
     *
     * `skipFar` exempts backdrop geometry (ocean, clouds) from the far plane,
     * matching the per-triangle noFarCull behaviour in _emitTri.
     */
    _sphereInFrustum(cx, cy, cz, r, skipFar) {
        const p = this._planes;
        for (let i = 0; i < 6; i++) {
            if (skipFar && i === 1) continue;
            const o = i * 4;
            if (p[o] * cx + p[o + 1] * cy + p[o + 2] * cz + p[o + 3] < -r) return false;
        }
        return true;
    }

    /**
     * Bounding sphere for a mesh in its own local space, computed once and
     * cached on the mesh. Chunk meshes are rebuilt into a fresh object on LOD
     * change, so the cache can never go stale.
     */
    _meshBounds(mesh) {
        let b = mesh._bounds;
        if (b === undefined) {
            b = mesh.verts.length ? meshBounds(mesh) : { center: [0, 0, 0], radius: 0 };
            mesh._bounds = b;
        }
        return b;
    }

    /** Ensure the per-vertex scratch arrays hold at least `n` entries. */
    _ensureVertScratch(n) {
        if (this._viewX.length >= n) return;
        const cap = 1 << (32 - Math.clz32(n - 1)); // next power of two
        this._viewX = new Float64Array(cap);
        this._viewY = new Float64Array(cap);
        this._viewZ = new Float64Array(cap);
        this._worldX = new Float64Array(cap);
        this._worldY = new Float64Array(cap);
        this._worldZ = new Float64Array(cap);
    }

    /**
     * Render a batch of instances against a camera.
     * camera: { pos:[x,y,z], yaw, pitch }
     * instances: [{ mesh, pos:[x,y,z], rotY, colorMul:[r,g,b] }]
     */
    render(camera, instances) {
        const m = mat4ViewFromYawPitch(camera.pos, camera.yaw, camera.pitch);
        const half = this.height / 2;
        const halfW = this.width / 2;
        this._triCount = 0;

        const stats = this.stats;
        stats.instances = instances.length;
        stats.instancesCulled = 0;
        stats.tris = 0;

        const farNeg = -this.far;

        for (const inst of instances) {
            const mesh = inst.mesh;
            if (!mesh || mesh.verts.length === 0) continue;
            const rotY = inst.rotY || 0;
            const cy = Math.cos(rotY), sy = Math.sin(rotY);
            const ox = inst.pos[0], oy = inst.pos[1], oz = inst.pos[2];
            const cmul = inst.colorMul || [1, 1, 1];
            const scale = inst.scale ?? 1;

            // --- whole-instance frustum reject ---
            // Transform the local bounding-sphere centre exactly as a vertex would
            // be, then test in view space. Uniform scale simply scales the radius;
            // rotation about Y leaves it unchanged.
            const bounds = this._meshBounds(mesh);
            const bc = bounds.center;
            const bwx = (bc[0] * cy + bc[2] * sy) * scale + ox;
            const bwy = bc[1] * scale + oy;
            const bwz = (-bc[0] * sy + bc[2] * cy) * scale + oz;
            const bvx = m[0] * bwx + m[4] * bwy + m[8] * bwz + m[12];
            const bvy = m[1] * bwx + m[5] * bwy + m[9] * bwz + m[13];
            const bvz = m[2] * bwx + m[6] * bwy + m[10] * bwz + m[14];
            if (!this._sphereInFrustum(bvx, bvy, bvz, bounds.radius * scale, inst.noFarCull)) {
                stats.instancesCulled++;
                continue;
            }

            // Transform verts to view space once per instance.
            const verts = mesh.verts;
            const vcount = verts.length;
            this._ensureVertScratch(vcount);
            const vx = this._viewX, vy = this._viewY, vz = this._viewZ;
            const wxA = this._worldX, wyA = this._worldY, wzA = this._worldZ;
            for (let i = 0; i < vcount; i++) {
                const v = verts[i];
                const v0 = v[0], v1 = v[1], v2 = v[2];
                const wx = (v0 * cy + v2 * sy) * scale + ox;
                const wy = v1 * scale + oy;
                const wz = (-v0 * sy + v2 * cy) * scale + oz;
                wxA[i] = wx; wyA[i] = wy; wzA[i] = wz;
                vx[i] = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
                vy[i] = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
                vz[i] = m[2] * wx + m[6] * wy + m[10] * wz + m[14];
            }

            const tris = mesh.tris;
            const noFarCull = !!inst.noFarCull;
            stats.tris += tris.length;
            for (let t = 0; t < tris.length; t++) {
                const tri = tris[t];
                const ia = tri[0], ib = tri[1], ic = tri[2];

                const azv = vz[ia], bzv = vz[ib], czv = vz[ic];
                // Cheap whole-triangle far reject before any clipping work.
                if (!noFarCull && azv < farNeg && bzv < farNeg && czv < farNeg) continue;

                // Near-plane clipping. View space looks down -Z, so a vertex is visible
                // when z <= -near. Dropping the whole triangle when ANY vertex fails
                // punches a hole in precisely the geometry nearest the camera: ground
                // quads span several world units while the eye sits ~1.7 units up, so
                // the triangle under the player almost always has one vertex behind the
                // plane. The terrain you're standing on then vanishes and you see through
                // to the ocean/sky backdrop. Clip to the visible side instead and fan the
                // resulting 3- or 4-gon.
                const poly = this._clipTriNear(
                    vx[ia], vy[ia], azv,
                    vx[ib], vy[ib], bzv,
                    vx[ic], vy[ic], czv,
                );
                if (poly.length < 9) continue;

                // Shading and winding are recomputed per output triangle, but always from
                // the ORIGINAL world-space verts: a clipped face is still flat, so its
                // normal is unchanged, and using the clipped verts would make the fan's
                // pieces shade inconsistently.
                const count = poly.length / 3;
                for (let f = 0; f + 2 < count; f++) {
                    const i1 = (f + 1) * 3, i2 = (f + 2) * 3;
                    this._emitTri(
                        poly[0], poly[1], poly[2],
                        poly[i1], poly[i1 + 1], poly[i1 + 2],
                        poly[i2], poly[i2 + 1], poly[i2 + 2],
                        wxA[ia], wyA[ia], wzA[ia],
                        wxA[ib], wyA[ib], wzA[ib],
                        wxA[ic], wyA[ic], wzA[ic],
                        tri[3], cmul, inst, halfW, half,
                    );
                }
            }
        }

        this._drawBuffer();
    }

    /**
     * Painter's algorithm: sort far-to-near, then fill. The sort runs over an
     * index array rather than the triangle records themselves, so each swap
     * moves 4 bytes and the vertex data stays put in its typed array.
     */
    _drawBuffer() {
        const n = this._triCount;
        this.stats.trisDrawn = n;
        if (n === 0) return;
        const depth = this._tdepth;
        // subarray() is a view, so sort() reorders only the live prefix.
        const order = this._torder.subarray(0, n);
        for (let i = 0; i < n; i++) order[i] = i;
        order.sort((a, b) => depth[b] - depth[a]);

        const ctx = this.ctx;
        const tsx = this._tsx;
        const tcolor = this._tcolor;
        // Each triangle is both filled and stroked in its own colour. Canvas2D
        // antialiases fill edges to partial coverage, so two triangles sharing an
        // edge blend with whatever was underneath instead of meeting exactly —
        // which shows up as a hairline wireframe over the whole terrain. Stroking
        // the same path widens coverage by half a pixel on each side and closes
        // the seam without needing a supersampled buffer.
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1;
        // Stroking is ~30% of rasterizer time, so it is spent only where it buys
        // something. A seam is a half-pixel gap along an edge, so its visual cost
        // scales with edge LENGTH, while the stroke's cost is per triangle. Tiny
        // triangles — distant terrain, foliage, grass — are the overwhelming
        // majority of the buffer and their seams are sub-pixel, so they are
        // filled only. Large near-field faces, where a hairline would actually
        // read as a wireframe, still get the extra half pixel of coverage.
        const STROKE_MIN_EXTENT = 12; // px bounding-box extent, in device pixels
        // fillStyle and strokeStyle are tracked separately: fill is set for every
        // colour run, stroke only when a large triangle actually needs it, so the
        // two fall out of step.
        let prevColor = -1, strokeColor = -1, fillStyleStr = '';
        for (let i = 0; i < n; i++) {
            const t = order[i];
            const packed = tcolor[t];
            // Adjacent triangles very often share a colour (a terrain quad, a tree
            // canopy, a wall panel), and assigning fillStyle/strokeStyle is one of
            // the more expensive Canvas2D state changes. Skipping the redundant
            // sets — and the string build that feeds them — is a measurable win at
            // these triangle counts.
            if (packed !== prevColor) {
                fillStyleStr = `rgb(${(packed >> 16) & 255},${(packed >> 8) & 255},${packed & 255})`;
                ctx.fillStyle = fillStyleStr;
                prevColor = packed;
            }
            const o = t * 6;
            const x0 = tsx[o], y0 = tsx[o + 1];
            const x1 = tsx[o + 2], y1 = tsx[o + 3];
            const x2 = tsx[o + 4], y2 = tsx[o + 5];
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.closePath();
            ctx.fill();
            const ex = Math.max(x0, x1, x2) - Math.min(x0, x1, x2);
            const ey = Math.max(y0, y1, y2) - Math.min(y0, y1, y2);
            if (ex > STROKE_MIN_EXTENT || ey > STROKE_MIN_EXTENT) {
                if (packed !== strokeColor) { ctx.strokeStyle = fillStyleStr; strokeColor = packed; }
                ctx.stroke();
            }
        }
    }

    /**
     * Clip a view-space triangle against the near plane (Sutherland-Hodgman on a
     * single plane). The visible half-space is z <= -near; returns a flat array
     * of 0, 9 or 12 numbers (x,y,z triples) in the input winding order, with new
     * verts landing exactly on the plane.
     *
     * The returned array is reused between calls — fan over it before clipping again.
     */
    _clipTriNear(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const near = this.near;
        // Signed distance into the visible half-space; positive means inside.
        const da = -az - near, db = -bz - near, dc = -cz - near;

        // Fast paths: fully inside (the common case) needs no lerps, fully
        // outside is rejected outright.
        const out = this._clipBuffer;
        out.length = 0;
        if (da >= 0 && db >= 0 && dc >= 0) {
            out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
            return out;
        }
        if (da < 0 && db < 0 && dc < 0) return out;

        const px = [ax, bx, cx], py = [ay, by, cy], pz = [az, bz, cz];
        const dists = [da, db, dc];
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const dCur = dists[i], dNxt = dists[j];
            if (dCur >= 0) out.push(px[i], py[i], pz[i]);
            // An edge crossing the plane in either direction contributes its
            // intersection point, which keeps the output polygon closed.
            if ((dCur >= 0) !== (dNxt >= 0)) {
                const t = dCur / (dCur - dNxt);
                out.push(
                    px[i] + (px[j] - px[i]) * t,
                    py[i] + (py[j] - py[i]) * t,
                    pz[i] + (pz[j] - pz[i]) * t,
                );
            }
        }
        return out;
    }

    /**
     * Project one already-near-clipped view-space triangle, cull and shade it,
     * then push it into the draw buffer. The wa/wb/wc components are the source
     * face's unclipped world-space verts, used only for the flat normal.
     */
    _emitTri(ax, ay, avz, bx, by, bvz, cx, cy, cvz,
        wax, way, waz, wbx, wby, wbz, wcx, wcy, wcz,
        color, cmul, inst, halfW, half) {
        const az = -avz, bz = -bvz, cz = -cvz;

        // Project using the projection matrix's scale term directly (cheaper than a
        // full mat4 multiply per vertex). proj[5] = 1/tan(fov/2) = vertical scale;
        // the horizontal scale is the same value, since dividing by aspect and then
        // multiplying by halfW (= halfH * aspect) cancels the aspect term out.
        const f = this.proj[5] * half;
        const sax = halfW + (ax / az) * f;
        const say = half - (ay / az) * f;
        const sbx = halfW + (bx / bz) * f;
        const sby = half - (by / bz) * f;
        const scx = halfW + (cx / cz) * f;
        const scy = half - (cy / cz) * f;

        // Backface cull via screen-space signed area (CW/CCW).
        // Double-sided instances skip this: procedurally traced surfaces like
        // stream ribbons follow arbitrary headings, so their winding isn't
        // known ahead of time and consistent culling can't be relied on.
        const area = (sbx - sax) * (scy - say) - (sby - say) * (scx - sax);
        if (area === 0) return;
        const backFacing = area > 0;
        if (!inst.doubleSided && backFacing) return; // front faces wind negative here

        // Viewport bounding-box reject. Only the near plane is clipped against, so
        // a triangle well off to one side arrives here fully intact and would still
        // cost a path build and a rasterizer call. Four comparisons remove it. This
        // matters more at the larger draw distance: open sightlines put a lot of
        // geometry just outside the horizontal FOV.
        const minX = sax < sbx ? (sax < scx ? sax : scx) : (sbx < scx ? sbx : scx);
        if (minX > this.width) return;
        const maxX = sax > sbx ? (sax > scx ? sax : scx) : (sbx > scx ? sbx : scx);
        if (maxX < 0) return;
        const minY = say < sby ? (say < scy ? say : scy) : (sby < scy ? sby : scy);
        if (minY > this.height) return;
        const maxY = say > sby ? (say > scy ? say : scy) : (sby > scy ? sby : scy);
        if (maxY < 0) return;

        const depth = (az + bz + cz) / 3;
        // Backdrop instances (ocean, clouds) opt out of the far-plane cull so the
        // horizon still reads as water/sky instead of showing the void past the
        // last loaded chunk. They're a fixed handful of triangles, so drawing them
        // at any distance costs nothing; terrain chunks stay culled for framerate.
        if (depth > this.far && !inst.noFarCull) return;

        // Flat shading from the world-space face normal, inlined: this is the
        // hottest arithmetic in the frame, and the vector helpers each allocate a
        // fresh array per call.
        const e1x = wbx - wax, e1y = wby - way, e1z = wbz - waz;
        const e2x = wcx - wax, e2y = wcy - way, e2z = wcz - waz;
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nlen; ny /= nlen; nz /= nlen;
        // On a double-sided face we may be looking at the back, where the geometric
        // normal points away and would shade the surface as if it were unlit.
        // Flip it to face the viewer so both sides light consistently.
        if (inst.doubleSided && backFacing) { nx = -nx; ny = -ny; nz = -nz; }
        // Half-Lambert ("wrap") key light + hemisphere sky fill.
        //
        // A plain max(dot(n,L),0) key light makes this scene read as mud: in a
        // first-person walker the faces you're looking at are usually the ones
        // turned away from the sun, so they'd collapse to the ambient floor and
        // every pale material (lighthouse render, museum marble) would look brown.
        // Half-Lambert remaps dot from [-1,1] to [0,1] instead of clamping, so
        // light wraps around the form and unlit faces keep their hue.
        const L = this.lightDir;
        const wrap = (nx * L[0] + ny * L[1] + nz * L[2]) * 0.5 + 0.5;
        const skyFill = (ny * 0.5 + 0.5) * this.fillLight;
        const shade = clamp(this.ambient + skyFill + wrap * this.keyLight, 0, 1.15);

        const fogT = inst.noFogFade
            ? 0
            : clamp((depth - this.fogNear) / (this.fogFar - this.fogNear), 0, 1);

        let r = color[0] * shade, g = color[1] * shade, bl = color[2] * shade;
        if (cmul[0] !== 1 || cmul[1] !== 1 || cmul[2] !== 1) {
            r *= cmul[0]; g *= cmul[1]; bl *= cmul[2];
        }
        if (fogT > 0) {
            const fc = this.fogColor;
            r = r + (fc[0] - r) * fogT;
            g = g + (fc[1] - g) * fogT;
            bl = bl + (fc[2] - bl) * fogT;
        }

        if (this._triCount >= this._triCap) this._growTriBuffers();
        const i = this._triCount++;
        const o = i * 6;
        const tsx = this._tsx;
        tsx[o] = sax; tsx[o + 1] = say;
        tsx[o + 2] = sbx; tsx[o + 3] = sby;
        tsx[o + 4] = scx; tsx[o + 5] = scy;
        // Sort depth may be biased away from true depth. The painter's sort keys
        // on a triangle's AVERAGE depth, which is wrong for very large, very
        // oblique faces: the ocean surface stretches from just offshore out to
        // the horizon, so a sea quad beyond the island can average nearer than
        // the hillside in front of it and paint straight over the landscape.
        // A positive bias pushes a surface to the back of the order, which is
        // exactly right for a ground-plane backdrop that nothing is ever behind.
        // A small negative bias does the reverse, letting a decal-like surface
        // that sits just above the ground (streams) win the near-tie against the
        // terrain it drapes over instead of being overpainted by it.
        this._tdepth[i] = inst.depthBias ? depth + inst.depthBias : depth;
        // shade can exceed 1 (ambient + fill + key), so clamp before packing to bytes
        const ri = r > 255 ? 255 : r | 0;
        const gi = g > 255 ? 255 : g | 0;
        const bi = bl > 255 ? 255 : bl | 0;
        this._tcolor[i] = (ri << 16) | (gi << 8) | bi;
    }
}
