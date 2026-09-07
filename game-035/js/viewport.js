/**
 * viewport.js — mutable live viewport dimensions.
 *
 * The game canvas is responsive (Phaser Scale.RESIZE) so it fills whatever
 * space the device gives it — wide on desktop, tall on portrait phones.
 * Everything that used to read fixed GAME_WIDTH/GAME_HEIGHT/CENTER_X/etc.
 * from config.js now reads these live values instead, updated once per
 * resize event from main.js.
 */

import { SHIP_RADIUS_FRAC, VANISH_RADIUS_FRAC } from './config.js';

export const viewport = {
    width: 960,
    height: 720,
    centerX: 480,
    centerY: 360,
    maxR: 360,       // decorative-only radius (tunnel background may reach into corners)
    fitR: 360,       // gameplay radius — always fits inside the shorter screen dimension
    shipR: 360 * SHIP_RADIUS_FRAC,
    vanishR: 360 * VANISH_RADIUS_FRAC,
};

export function setViewportSize(width, height) {
    viewport.width = width;
    viewport.height = height;
    viewport.centerX = width / 2;
    viewport.centerY = height / 2;
    // maxR: use the larger of half-width/half-height so the tunnel BACKGROUND
    // art reaches into the corners on ultra-wide screens (purely decorative).
    viewport.maxR = Math.max(width, height) / 2;
    // fitR: gameplay geometry (ship ring, entities) must use the SMALLER
    // half-dimension, or on a wide desktop window the ship's ring radius is
    // sized off the width and ends up taller than the viewport — clipping
    // the ship off the top/bottom edges.
    viewport.fitR = Math.min(width, height) / 2;
    viewport.shipR = viewport.fitR * SHIP_RADIUS_FRAC;
    viewport.vanishR = viewport.fitR * VANISH_RADIUS_FRAC;
}
