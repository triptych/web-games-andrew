/**
 * TunnelRenderer.js — draws the psychedelic ring-tunnel backdrop every
 * frame using Phaser.GameObjects.Graphics (no shaders, fully verified API).
 *
 * Visual approach: concentric rings of a warped polygon (like looking down
 * a corrugated tube), radial facet lines matching the gameplay lanes, and a
 * slowly rotating rainbow palette that shifts faster as ship speed increases
 * (mirrors N2O's "the game gets more hectic" mechanic). Reads live
 * viewport.js values so it adapts to any canvas size.
 */

import { RING_SEGMENTS } from './config.js';
import { projectRadius } from './tunnel.js';
import { viewport } from './viewport.js';

const RING_COUNT = 14;

export class TunnelRenderer {
    constructor(scene) {
        this.scene = scene;
        this.gfx = scene.add.graphics();
        this.gfx.setDepth(-100);
        this.scrollZ = 0;   // accumulated depth scroll, drives ring animation
        this.hue = 0;       // 0..1, rotates with speed
        this.time = 0;
    }

    update(dt, forwardSpeed) {
        this.time += dt;
        this.scrollZ = (this.scrollZ + forwardSpeed * dt * 0.6) % 1;
        this.hue = (this.hue + dt * 0.05 * (0.5 + forwardSpeed)) % 1;
        this._draw(forwardSpeed);
    }

    _draw(forwardSpeed) {
        const g = this.gfx;
        g.clear();

        // Deep background fill — covers the full live viewport
        g.fillStyle(0x03000a, 1);
        g.fillRect(0, 0, viewport.width, viewport.height);

        const wobbleAmt = Math.min(1, forwardSpeed / 1.6);
        const wobX = Math.sin(this.time * 0.35) * 10 * wobbleAmt;
        const wobY = Math.cos(this.time * 0.28) * 10 * wobbleAmt;
        const cx = viewport.centerX + wobX;
        const cy = viewport.centerY + wobY;

        // Concentric warped rings, drawn far-to-near so near rings paint over far ones
        for (let i = RING_COUNT; i >= 1; i--) {
            const zRaw = (i / RING_COUNT + this.scrollZ) % 1;
            const r = projectRadius(zRaw);
            const hue = (this.hue + zRaw * 0.5) % 1;
            const color = hsvToHex(hue, 0.85, 0.25 + zRaw * 0.55);

            g.lineStyle(Math.max(1.5, 5 * (1 - zRaw)), color, 0.85);
            g.beginPath();
            const pts = 48;
            for (let p = 0; p <= pts; p++) {
                const a = (p / pts) * Math.PI * 2;
                // subtle organic warp so it isn't a perfect circle (corrugated tube look)
                const warp = 1 + Math.sin(a * 5 + this.time * 1.4) * 0.035 * (1 + wobbleAmt);
                const rr = r * warp;
                const x = cx + Math.cos(a) * rr;
                const y = cy + Math.sin(a) * rr;
                if (p === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.strokePath();
        }

        // Radial facet lines — matches the RING_SEGMENTS gameplay lanes
        const accentHue = (this.hue + 0.5) % 1;
        const accentColor = hsvToHex(accentHue, 0.7, 0.9);
        g.lineStyle(1, accentColor, 0.35);
        for (let s = 0; s < RING_SEGMENTS; s++) {
            const a = (s / RING_SEGMENTS) * Math.PI * 2;
            const rOuter = viewport.maxR * 1.1;
            const rInner = projectRadius(1);
            g.beginPath();
            g.moveTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
            g.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
            g.strokePath();
        }

        // Bright vanishing-point core
        g.fillStyle(hsvToHex((this.hue + 0.5) % 1, 0.4, 1), 0.9);
        g.fillCircle(cx, cy, 6 + wobbleAmt * 3);
    }
}

// --- color helper ---
function hsvToHex(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    const ri = Math.round(r * 255), gi = Math.round(g * 255), bi = Math.round(b * 255);
    return (ri << 16) | (gi << 8) | bi;
}
