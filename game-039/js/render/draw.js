/**
 * The frame. Everything is drawn into the 160x192 buffer at integer pixel
 * positions — no antialiasing, no gradients, no sub-pixel placement — and the
 * buffer is scaled up with nearest-neighbour by main.js.
 */

import {
    VIEW_W, VIEW_H, CORE_X, CORE_Y, CORE_R, RING_R, ECHO_LIFE, ECHO_FADE,
    MOTE_KIND, FLUX_MAX
} from '../game/constants.js';
import { polColor } from './palette.js';
import { drawText } from './sprites.js';
import { getEchoes } from '../game/wake.js';
import { getMotes } from '../game/motes.js';

/**
 * Pick an animation frame from an elapsed time.
 *
 * JavaScript `%` is a remainder, not a modulo: it keeps the sign of the
 * dividend, so a time that lands a hair below zero through floating-point
 * accumulation yields index -1 and an undefined sprite. Every cyclic frame
 * lookup goes through here so that cannot happen.
 */
function frameIndex(t, len) {
    if (!Number.isFinite(t) || len <= 0) return 0;
    const i = Math.floor(t) % len;
    return i < 0 ? i + len : i;
}

/** Transient sparks: purely cosmetic, spawned by game events. */
const sparks = [];

export function addSpark(x, y, color, count = 5, speed = 26) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        sparks.push({
            x, y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: 0.3 + Math.random() * 0.25,
            t: 0,
            color
        });
    }
}

export function clearSparks() {
    sparks.length = 0;
}

export function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.t += dt;
        if (s.t >= s.life) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
    }
}

/** Screen shake driven by core hits. */
let shakeT = 0;
let shakeMag = 0;
export function addShake(mag) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = 0.28;
}

function shakeOffset(dt) {
    if (shakeT <= 0) return [0, 0];
    shakeT -= dt;
    if (shakeT <= 0) { shakeMag = 0; return [0, 0]; }
    const m = shakeMag * (shakeT / 0.28);
    return [
        Math.round((Math.random() - 0.5) * 2 * m),
        Math.round((Math.random() - 0.5) * 2 * m)
    ];
}

/**
 * Draw one frame of the live board.
 * `view` carries everything the renderer needs without reaching into game state.
 */
export function drawFrame(g, view, dt) {
    const { pal, sprites, playfield, stars, probe, score, run, time } = view;

    const [sx, sy] = shakeOffset(dt);
    g.save();
    g.translate(sx, sy);

    // --- backdrop ---
    g.fillStyle = pal.bg;
    g.fillRect(-4, -4, VIEW_W + 8, VIEW_H + 8);
    g.drawImage(playfield, 0, 0);

    drawStars(g, pal, stars, time);
    drawRing(g, pal, run, time);
    drawWake(g, pal);
    drawCore(g, pal, sprites, run, time);
    drawMotes(g, pal, sprites, time);
    drawProbe(g, pal, sprites, probe, time);
    drawSparks(g);

    g.restore();

    drawHud(g, pal, probe, score, run);
}

function drawStars(g, pal, stars, time) {
    for (const s of stars) {
        const tw = Math.sin(time * s.speed + s.tw);
        if (tw < 0.2) continue;
        g.fillStyle = tw > 0.85 ? pal.hud : pal.hudDim;
        g.fillRect(s.x, s.y, 1, 1);
    }
}

/**
 * The containment ring. Drawn as discrete blocks around the circle rather than
 * a stroked arc, so it reads as chunky hardware rather than vector art.
 */
function drawRing(g, pal, run, time) {
    const segments = 64;
    const damaged = 1 - run.containment / run.containmentMax;
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        // Missing blocks show accumulated damage.
        const gap = ((i * 7919) % 100) / 100 < damaged * 0.55;
        if (gap && Math.sin(time * 4 + i) > 0) continue;
        const x = Math.round(CORE_X + Math.cos(a) * RING_R);
        const y = Math.round(CORE_Y + Math.sin(a) * RING_R);
        g.fillStyle = gap ? pal.warn : (i % 4 === 0 ? pal.wallHot : pal.wall);
        g.fillRect(x - 1, y - 1, 2, 2);
    }
}

/**
 * The wake. This is the most important thing on screen, so echoes are drawn as
 * solid polarity-coloured pixels that dim as they age, with a faint field halo
 * on the youngest ones so the player can see the lattice they are building.
 */
function drawWake(g, pal) {
    const echoes = getEchoes();
    for (const e of echoes) {
        const remaining = ECHO_LIFE - e.age;
        const fading = remaining < ECHO_FADE;
        // Fading echoes blink out, the classic 2600 way to show expiry.
        if (fading && Math.floor(remaining * 12) % 2 === 0) continue;

        const x = Math.round(e.x);
        const y = Math.round(e.y);

        if (e.age < 0.6) {
            // A just-shed echo flares briefly.
            g.fillStyle = pal.white;
            g.fillRect(x - 1, y - 1, 3, 3);
        }

        g.fillStyle = fading
            ? polColor(pal, e.pol, 'faint')
            : (e.age < 3 ? polColor(pal, e.pol) : polColor(pal, e.pol, 'dim'));
        g.fillRect(x - 1, y - 1, 2, 2);
    }
}

function drawCore(g, pal, sprites, run, time) {
    const frame = sprites.coreFrames[frameIndex(time * 6, sprites.coreFrames.length)];
    const w = sprites.coreW;
    const h = sprites.coreH;
    g.drawImage(frame, Math.round(CORE_X - w / 2), Math.round(CORE_Y - h / 2));

    // Containment bars orbit the core: the clearest read on how close to death.
    const total = run.containmentMax;
    for (let i = 0; i < total; i++) {
        const a = -Math.PI / 2 + (i / total) * Math.PI * 2 + time * 0.35;
        const r = CORE_R + 4;
        const x = Math.round(CORE_X + Math.cos(a) * r);
        const y = Math.round(CORE_Y + Math.sin(a) * r);
        const alive = i < run.containment;
        if (!alive && Math.sin(time * 8) < 0) continue;
        g.fillStyle = alive ? pal.good : pal.warn;
        g.fillRect(x - 1, y - 1, 2, 2);
    }
}

function drawMotes(g, pal, sprites, time) {
    for (const m of getMotes()) {
        const set = sprites.mote[m.kind];
        if (!set) continue;

        let img;
        if (m.kind === MOTE_KIND.ANCHOR) {
            img = set.neutral;
        } else if (m.kind === MOTE_KIND.INVERTER && m.flipT < 0.4) {
            // Telegraph the imminent self-flip by strobing between families.
            img = Math.floor(time * 20) % 2 ? set.pos : set.neg;
        } else {
            img = m.pol > 0 ? set.pos : set.neg;
        }

        const x = Math.round(m.x - set.w / 2);
        const y = Math.round(m.y - set.h / 2);
        g.drawImage(img, x, y);

        // A leech locked onto an echo draws a dotted tether to its prey.
        if (m.kind === MOTE_KIND.LEECH && m.hasTarget) {
            drawDottedLine(g, m.x, m.y, m.targetX, m.targetY, pal.warn, time);
        }
    }
}

function drawDottedLine(g, x0, y0, x1, y1, color, time) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.floor(len / 3);
    g.fillStyle = color;
    for (let i = 1; i < steps; i++) {
        if ((i + Math.floor(time * 10)) % 2) continue;
        const t = i / steps;
        g.fillRect(Math.round(x0 + dx * t), Math.round(y0 + dy * t), 1, 1);
    }
}

function drawProbe(g, pal, sprites, probe, time) {
    const w = sprites.probeW;
    const h = sprites.probeH;
    const x = Math.round(probe.x - w / 2);
    const y = Math.round(probe.y - h / 2);

    // Silent running: the probe becomes a dim outline, visibly shedding nothing.
    if (probe.silent && Math.floor(time * 14) % 2 === 0) {
        g.fillStyle = polColor(pal, probe.pol, 'faint');
        g.fillRect(x + 2, y + 2, w - 4, h - 4);
        return;
    }

    const img = probe.flashT > 0
        ? sprites.probeFlash
        : (probe.pol > 0 ? sprites.probePos : sprites.probeNeg);
    g.drawImage(img, x, y);

    // Field indicator: a sparse ring of pixels showing this probe's reach and
    // sign — outward ticks for positive, inward for negative.
    const ticks = 8;
    for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2 + time * (probe.pol > 0 ? 1.2 : -1.2);
        const r = 7 + Math.sin(time * 5 + i) * 1.2;
        const px = Math.round(probe.x + Math.cos(a) * r);
        const py = Math.round(probe.y + Math.sin(a) * r);
        g.fillStyle = polColor(pal, probe.pol, 'dim');
        g.fillRect(px, py, 1, 1);
    }
}

function drawSparks(g) {
    for (const s of sparks) {
        const k = 1 - s.t / s.life;
        if (k < 0.3 && Math.random() < 0.5) continue;
        g.fillStyle = s.color;
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function drawHud(g, pal, probe, score, run) {
    // --- score, top left ---
    drawText(g, String(score.score).padStart(6, '0'), 4, 4, pal.hud, 1, 1);

    // --- wave, top right ---
    const waveStr = 'W' + run.wave;
    drawText(g, waveStr, VIEW_W - 4 - waveStr.length * 4, 4, pal.hud, 1, 1);

    // --- drain grace countdown ---
    // Once a wave has finished spawning, the player has a limited window to
    // clear what is left. That deadline drives the decision to harvest a trap
    // now or keep banking, so it has to be on screen.
    if (run.phase === 'draining' && run.drainT !== undefined && run.drainT < 8) {
        const urgent = run.drainT < 3.5;
        const label = 'CLEAR ' + Math.max(0, Math.ceil(run.drainT));
        const w = label.length * 4;
        const colour = urgent && Math.floor(run.drainT * 6) % 2 ? pal.warn : pal.hudDim;
        drawText(g, label, Math.round(VIEW_W / 2 - w / 2), VIEW_H - 15, colour, 1, 1);
    }

    // --- chain multiplier, top centre, only while live ---
    if (score.chain > 1) {
        const s = 'x' + score.chain;
        const w = s.length * 4;
        const colour = score.chainT < 0.6 ? pal.warn : pal.good;
        drawText(g, s, Math.round(VIEW_W / 2 - w / 2), 4, colour, 1, 1);
        // Chain timer drains as a bar under the multiplier.
        const barW = Math.round((score.chainT / 2.4) * 20);
        g.fillStyle = colour;
        g.fillRect(Math.round(VIEW_W / 2 - 10), 11, Math.max(0, barW), 1);
    }

    // --- flux bar along the bottom: the resource that gates everything ---
    const barX = 4;
    const barY = VIEW_H - 7;
    const barW = VIEW_W - 8;
    g.fillStyle = pal.hudDim;
    g.fillRect(barX, barY, barW, 3);
    const fill = Math.round((probe.flux / FLUX_MAX) * (barW - 2));
    g.fillStyle = probe.flux < 12 ? pal.warn : polColor(pal, probe.pol);
    g.fillRect(barX + 1, barY + 1, Math.max(0, fill), 1);

    // Tick marks at the cost of a flip, so the player can read affordability.
    g.fillStyle = pal.hud;
    for (let i = 1; i < 4; i++) {
        g.fillRect(barX + Math.round((barW * i) / 4), barY, 1, 3);
    }
}

/** A centred banner used for wave announcements and warnings. */
export function drawBanner(g, pal, text, y, color, scale = 1) {
    const w = text.length * (3 * scale + 1) - 1;
    const x = Math.round(VIEW_W / 2 - w / 2);
    g.fillStyle = pal.bg;
    g.fillRect(x - 3, y - 2, w + 6, 5 * scale + 4);
    drawText(g, text, x, y, color, scale, 1);
}
