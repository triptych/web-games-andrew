/**
 * lightmap.js — bakes the level's static lighting into two floating-point
 * textures laid over the map's XZ plane (LIGHTMAP_RES texels per cell).
 *
 *   main    RGB = steady light, A = ambient occlusion (openness)
 *   flicker RGB = light from flickering fixtures and glowing liquids,
 *           A = a phase so neighbouring lamps don't flicker in lockstep
 *
 * Each light is a 2D flood with hard line-of-sight against solid cells, then
 * the result is blurred once and dilated into the walls so that bilinear
 * sampling right next to a wall never pulls in black.
 */
import * as THREE from 'three';
import { CELL, LIGHTMAP_RES } from '../config.js';

export function bakeLightmap(L, theme) {
    const R = LIGHTMAP_RES;
    const TW = L.W * R, TH = L.H * R, TN = TW * TH;
    const main = new Float32Array(TN * 3);
    const flick = new Float32Array(TN * 3);
    const phase = new Float32Array(TN);
    const phaseW = new Float32Array(TN);
    const ao = new Float32Array(TN);
    const W = L.W;

    const solidAt = (cx, cy) => {
        const x = Math.floor(cx), y = Math.floor(cy);
        if (x < 0 || y < 0 || x >= L.W || y >= L.H) return true;
        return !L.open[y * W + x];
    };
    // line of sight in cell units (DDA through the grid)
    const los = (x0, y0, x1, y1) => {
        let x = Math.floor(x0), y = Math.floor(y0);
        const tx = Math.floor(x1), ty = Math.floor(y1);
        const dx = x1 - x0, dy = y1 - y0;
        const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
        const tdx = Math.abs(1 / (dx || 1e-9)), tdy = Math.abs(1 / (dy || 1e-9));
        let mx = (dx > 0 ? x + 1 - x0 : x0 - x) * tdx;
        let my = (dy > 0 ? y + 1 - y0 : y0 - y) * tdy;
        for (let n = 0; n < 64; n++) {
            if (x === tx && y === ty) return true;
            if (mx < my) { mx += tdx; x += sx; } else { my += tdy; y += sy; }
            if (x === tx && y === ty) return true;
            if (x < 0 || y < 0 || x >= L.W || y >= L.H || !L.open[y * W + x]) return false;
        }
        return true;
    };

    const addLight = (lt, target, ph) => {
        const lx = lt.x, lz = lt.z;
        const rC = lt.radius / CELL;
        const x0 = Math.max(0, Math.floor((lx - rC) * R)), x1 = Math.min(TW - 1, Math.ceil((lx + rC) * R));
        const y0 = Math.max(0, Math.floor((lz - rC) * R)), y1 = Math.min(TH - 1, Math.ceil((lz + rC) * R));
        const col = lt.color, I = lt.intensity;
        for (let ty = y0; ty <= y1; ty++) {
            const pz = (ty + 0.5) / R;
            for (let tx = x0; tx <= x1; tx++) {
                const px = (tx + 0.5) / R;
                if (solidAt(px, pz)) continue;
                const cell = Math.floor(pz) * W + Math.floor(px);
                const dxm = (px - lx) * CELL, dzm = (pz - lz) * CELL;
                const dv = lt.y !== undefined ? (lt.y - (L.floor[cell] + 1.2)) * 0.45 : 0;
                const d = Math.sqrt(dxm * dxm + dzm * dzm + dv * dv);
                if (d >= lt.radius) continue;
                if (!lt.noShadow && !los(lx, lz, px, pz)) continue;
                const f = 1 - d / lt.radius;
                const a = I * f * f * (1.0 + 0.6 / (1 + d * d * 0.5));
                const k = (ty * TW + tx);
                target[k * 3] += col[0] * a; target[k * 3 + 1] += col[1] * a; target[k * 3 + 2] += col[2] * a;
                if (ph !== undefined) { phase[k] += ph * a; phaseW[k] += a; }
            }
        }
    };

    // per-theme gain: the foundry's rust and brick soak up light
    const gain = { foundry: 1.4, station: 1.0, hell: 1.0, throne: 0.9 }[L.theme] ?? 1;
    let ph = 0;
    for (const lt0 of L.lights) {
        const lt = { ...lt0, intensity: lt0.intensity * gain };
        if (lt.flicker) { addLight(lt, flick, (ph = (ph + 0.618) % 1)); }
        else addLight(lt, main);
    }
    // glowing liquids
    const LL = theme.liquidLight;
    for (let i = 0; i < L.open.length; i++) {
        if (!L.liquid[i]) continue;
        const x = i % W, y = (i / W) | 0;
        addLight({ x: x + 0.5, z: y + 0.5, radius: 4.2, intensity: 0.32, color: LL, noShadow: true }, flick, ((x * 0.37 + y * 0.21) % 1));
    }

    // ambient occlusion: how much of the neighbourhood is open
    const OFF = [];
    for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        OFF.push([Math.cos(ang) * 0.4, Math.sin(ang) * 0.4], [Math.cos(ang + 0.26) * 0.85, Math.sin(ang + 0.26) * 0.85]);
    }
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
        const px = (tx + 0.5) / R, pz = (ty + 0.5) / R;
        if (solidAt(px, pz)) { ao[ty * TW + tx] = -1; continue; }
        let s = 0;
        for (const [ox, oz] of OFF) if (solidAt(px + ox, pz + oz)) s++;
        ao[ty * TW + tx] = 1 - (s / OFF.length) * 0.85;
    }

    // blur once (3×3), ignoring solid texels
    const blur = (arr, ch) => {
        const out = new Float32Array(arr.length);
        for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
            const k = ty * TW + tx;
            if (ao[k] < 0) continue;
            for (let c = 0; c < ch; c++) {
                let s = 0, n = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const x = tx + dx, y = ty + dy;
                    if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
                    const kk = y * TW + x;
                    if (ao[kk] < 0) continue;
                    const w = dx === 0 && dy === 0 ? 2 : 1;
                    s += arr[kk * ch + c] * w; n += w;
                }
                out[k * ch + c] = n ? s / n : arr[k * ch + c];
            }
        }
        return out;
    };
    const mainB = blur(main, 3), flickB = blur(flick, 3);
    const aoB = blur(ao.map((v) => Math.max(v, 0)), 1);

    // dilate into solid texels (3 passes)
    const solid = new Uint8Array(TN);
    for (let k = 0; k < TN; k++) solid[k] = ao[k] < 0 ? 1 : 0;
    for (let pass = 0; pass < 3; pass++) {
        const done = [];
        for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
            const k = ty * TW + tx;
            if (!solid[k]) continue;
            let n = 0; const s = [0, 0, 0, 0, 0, 0, 0];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                const x = tx + dx, y = ty + dy;
                if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
                const kk = y * TW + x;
                if (solid[kk]) continue;
                for (let c = 0; c < 3; c++) { s[c] += mainB[kk * 3 + c]; s[3 + c] += flickB[kk * 3 + c]; }
                s[6] += aoB[kk];
                n++;
            }
            if (n) done.push([k, s.map((v) => v / n)]);
        }
        for (const [k, s] of done) {
            for (let c = 0; c < 3; c++) { mainB[k * 3 + c] = s[c]; flickB[k * 3 + c] = s[3 + c]; }
            aoB[k] = s[6];
            solid[k] = 0;
        }
    }

    // pack into half-float RGBA
    const toHalf = THREE.DataUtils.toHalfFloat;
    const mainD = new Uint16Array(TN * 4), flickD = new Uint16Array(TN * 4);
    // soft-clip so stacked lights saturate instead of blowing out
    const soft = (x) => x / (1 + x * 0.22);
    for (let k = 0; k < TN * 3; k++) { mainB[k] = soft(mainB[k]); flickB[k] = soft(flickB[k]); }
    for (let k = 0; k < TN; k++) {
        for (let c = 0; c < 3; c++) {
            mainD[k * 4 + c] = toHalf(Math.min(mainB[k * 3 + c], 8));
            flickD[k * 4 + c] = toHalf(Math.min(flickB[k * 3 + c], 8));
        }
        mainD[k * 4 + 3] = toHalf(aoB[k]);
        flickD[k * 4 + 3] = toHalf(phaseW[k] > 0 ? phase[k] / phaseW[k] : 0);
    }
    const mk = (d) => {
        const t = new THREE.DataTexture(d, TW, TH, THREE.RGBAFormat, THREE.HalfFloatType);
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        return t;
    };

    /** CPU lookup of the steady light (world metres) for the viewmodel and HUD. */
    const sample = (wx, wz) => {
        const tx = Math.max(0, Math.min(TW - 1, Math.floor((wx / CELL) * R)));
        const ty = Math.max(0, Math.min(TH - 1, Math.floor((wz / CELL) * R)));
        const k = ty * TW + tx;
        return [mainB[k * 3] + flickB[k * 3] * 0.8, mainB[k * 3 + 1] + flickB[k * 3 + 1] * 0.8, mainB[k * 3 + 2] + flickB[k * 3 + 2] * 0.8];
    };

    return { main: mk(mainD), flicker: mk(flickD), sample, size: [TW, TH] };
}
