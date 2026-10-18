// Small pictures for the scrapbook: monsters, Wardens, travellers, Grandmother and the towns, drawn with the
// same code as the road, on a little backdrop in the colours of the region. Something not yet met is drawn
// as a dark silhouette.

import { FAMILIES, REGIONS, CLASSES, TOWN } from '../sim/data.js';
import { drawCreature } from './creatures.js';
import { drawWalker, drawHouse, drawProp, mix } from './sprites.js';

const SKY = ['#bfe0ff', '#f6dfb0', '#cfe4d8', '#eef4ff', '#f0b89a', '#c8b8f0'];
const GROUND = ['#7fbf5a', '#e2b56a', '#4f8a6a', '#e8f0f8', '#5a3a30', '#3a3466'];
const SHADOW = ['#2a2630', '#2a2630', '#2a2630'];

/** spec: { kind: 'monster'|'warden'|'person'|'odessa'|'town', key, region, unknown } */
export function drawPortrait(canvas, spec) {
    const css = canvas.clientWidth || 96;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * css / 100, 0, 0, dpr * css / 100, 0, 0);   // draw in a 100 × 100 box
    const r = Math.max(0, Math.min(5, spec.region ?? 0));
    const g = ctx.createLinearGradient(0, 0, 0, 100);
    g.addColorStop(0, spec.unknown ? '#8a8478' : SKY[r]);
    g.addColorStop(0.68, spec.unknown ? '#a09a8c' : mix(SKY[r], '#ffffff', 0.3));
    g.addColorStop(0.69, spec.unknown ? '#6a6458' : GROUND[r]);
    g.addColorStop(1, spec.unknown ? '#5a5448' : mix(GROUND[r], '#000000', 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 100, 100);
    const anim = { t: 0.4, flash: 0, dead: 0 };
    if (spec.kind === 'monster') {
        const F = FAMILIES[spec.key];
        const f = spec.unknown ? { ...F, col: SHADOW } : F;
        const tall = { flyer: 0.09, drake: 0.08, brute: 0.085, golem: 0.08, serpent: 0.09, crawler: 0.13, blob: 0.14 }[F.shape] || 0.11;
        drawCreature(ctx, f, 50, 92, tall, anim, false);
    } else if (spec.kind === 'warden') {
        const W = REGIONS[spec.key].warden;
        const f = { shape: W.shape, col: spec.unknown ? SHADOW : W.col, deco: W.deco, warden: !spec.unknown };
        drawCreature(ctx, f, 50, 94, W.shape === 'beast' ? 0.12 : 0.085, anim, false);
    } else if (spec.kind === 'person') {
        const C = CLASSES[spec.key];
        drawWalker(ctx, 50, 92, 0.14, spec.key, spec.unknown ? '#2a2630' : C.color, spec.unknown ? '#2a2630' : C.cloth, 0, false, 0);
    } else if (spec.kind === 'odessa') {
        drawWalker(ctx, 50, 92, 0.14, 'captain', '#e8e8f0', '#6a4a7a', 0, false, 0);
        ctx.fillStyle = '#ffd36a';
        ctx.beginPath(); ctx.ellipse(76, 58, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(66, 66); ctx.lineTo(76, 51); ctx.stroke();
    } else if (spec.kind === 'town') {
        const T = TOWN[spec.key];
        const pal = { walls: ['#e8dcc0', '#d8c8a8', '#c8b898'], roofs: ['#a84a3a', '#5a6a8a', '#7a4a3a'] };
        if (spec.unknown) { pal.walls = ['#5a5448']; pal.roofs = ['#3a3630']; }
        drawHouse(ctx, 26, 90, 0.05, 3, pal, false);
        drawHouse(ctx, 74, 92, 0.055, 9, pal, false);
        drawHouse(ctx, 50, 96, 0.065, 6, pal, false);
        if (T.capital) drawProp(ctx, 'waystone', 88, 96, 0.05, spec.lit ? 1 : 0, false);
    }
}
