/**
 * Procedural background. The 2600 drew its backdrop from a 20-bit playfield
 * register mirrored across the screen centre, which is why so many 2600 games
 * have that distinctive symmetric blocky backdrop. We do the same thing: a
 * seeded 20-bit pattern per row band, mirrored, baked once into a canvas.
 */

import { VIEW_W, VIEW_H, CORE_X, CORE_Y, RING_R } from '../game/constants.js';

const PF_BITS = 20;          // 2600 playfield resolution, half-screen
const BAND_H = 8;            // rows share a pattern for this many scanlines

export function buildPlayfield(rng, pal) {
    const cv = document.createElement('canvas');
    cv.width = VIEW_W;
    cv.height = VIEW_H;
    const g = cv.getContext('2d');

    g.fillStyle = pal.bg;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const cellW = VIEW_W / (PF_BITS * 2);
    const bands = Math.ceil(VIEW_H / BAND_H);

    for (let b = 0; b < bands; b++) {
        const y = b * BAND_H;
        // Density falls off toward the vertical centre so the play area stays
        // readable; the pattern is decoration at the edges, not clutter inside.
        const centreDist = Math.abs(y + BAND_H / 2 - CORE_Y) / (VIEW_H / 2);
        const density = 0.08 + centreDist * 0.42;

        for (let bit = 0; bit < PF_BITS; bit++) {
            if (rng() > density) continue;
            const lit = rng() < 0.3;
            g.fillStyle = lit ? pal.fieldLit : pal.field;
            const x0 = bit * cellW;
            const x1 = VIEW_W - (bit + 1) * cellW;
            g.fillRect(Math.floor(x0), y, Math.ceil(cellW), BAND_H - 1);
            g.fillRect(Math.floor(x1), y, Math.ceil(cellW), BAND_H - 1);
        }
    }

    // Punch a clean circle out of the middle so the playfield pattern never
    // competes with motes and echoes inside the containment ring.
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(CORE_X, CORE_Y, RING_R + 3, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Repaint the hole as flat background.
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.restore();

    return cv;
}

/** Star specks inside the ring, drawn from the seed and kept very sparse. */
export function buildStarfield(rng) {
    const stars = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = 14 + rng() * (RING_R - 18);
        stars.push({
            x: Math.round(CORE_X + Math.cos(a) * r),
            y: Math.round(CORE_Y + Math.sin(a) * r),
            tw: rng() * 6.28,
            speed: 0.6 + rng() * 1.4
        });
    }
    return stars;
}
