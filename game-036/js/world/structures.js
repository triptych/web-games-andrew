/**
 * structures.js — procedural buildings and man-made features.
 * Each builder returns a local-space mesh (origin at ground level, +Y up)
 * ready to be placed by world/chunk.js at a region's anchor point.
 */

import { makeMesh, mergeMesh, buildBox, buildCylinder, buildCone, buildPlane } from '../engine/mesh.js';

const STONE = [150, 146, 132];
const STONE_DARK = [108, 104, 94];
const WOOD = [104, 76, 48];
const ROOF_RED = [140, 62, 48];

export function buildLighthouse(rng) {
    const m = makeMesh();
    const baseR = 2.4, towerH = 16;
    mergeMesh(m, buildCylinder(baseR, 1.2, 12, STONE_DARK, true, true, baseR * 0.95), 0, 0.6, 0);
    mergeMesh(m, buildCylinder(baseR * 0.85, towerH, 12, [214, 206, 188], true, false, baseR * 0.55), 0, 1.2 + towerH / 2, 0);
    // red stripe band
    mergeMesh(m, buildCylinder(baseR * 0.7, 1.6, 12, ROOF_RED, false, false, baseR * 0.62), 0, 1.2 + towerH * 0.55, 0);
    // lantern room
    const lanternY = 1.2 + towerH + 0.6;
    mergeMesh(m, buildCylinder(baseR * 0.55, 1.2, 10, [70, 90, 110], true, true, baseR * 0.5), 0, lanternY, 0);
    mergeMesh(m, buildCone(baseR * 0.62, 1.0, 10, STONE_DARK), 0, lanternY + 1.1, 0);
    return m;
}

/** A ruined stretch of ancient wall — segments of varying height with gaps, plus a rubble pile. */
export function buildRuinedWallSegment(rng) {
    const m = makeMesh();
    const len = 2.4;
    const h = 1.0 + rng() * 1.8;
    mergeMesh(m, buildBox(len, h, 0.6, STONE), 0, h / 2, 0);
    if (rng() < 0.4) {
        mergeMesh(m, buildBox(0.5, 0.3, 0.7, STONE_DARK), (rng() - 0.5) * len, 0.15, 0);
    }
    return m;
}

/** A short tunnel arch prop used to dress cave/ruins entrances (the real cave tube is in cave.js). */
export function buildStoneArch(rng) {
    const m = makeMesh();
    mergeMesh(m, buildBox(0.6, 2.4, 0.6, STONE_DARK), -1.5, 1.2, 0);
    mergeMesh(m, buildBox(0.6, 2.4, 0.6, STONE_DARK), 1.5, 1.2, 0);
    mergeMesh(m, buildBox(3.6, 0.6, 0.7, STONE_DARK), 0, 2.6, 0);
    return m;
}

export function buildCemeteryGate(rng) {
    const m = makeMesh();
    mergeMesh(m, buildBox(0.5, 2.6, 0.5, STONE_DARK), -2, 1.3, 0);
    mergeMesh(m, buildBox(0.5, 2.6, 0.5, STONE_DARK), 2, 1.3, 0);
    mergeMesh(m, buildBox(4.4, 0.4, 0.4, STONE_DARK), 0, 2.7, 0);
    mergeMesh(m, buildCone(0.35, 0.5, 6, STONE_DARK), -2, 2.9, 0);
    mergeMesh(m, buildCone(0.35, 0.5, 6, STONE_DARK), 2, 2.9, 0);
    return m;
}

/** Wall thickness for enterable buildings. Thin enough to read as a wall, thick
 *  enough that the player can't see through the seam at a grazing angle. */
const WALL_T = 0.35;

/** Width of the doorway gap punched through the front wall. */
const DOOR_W = 2.6;

/**
 * Rectangular gabled-roof building the player can walk into.
 *
 * Returns `{ exterior, interior, footprint }` rather than one mesh, because the
 * renderer has no depth buffer: with painter's-algorithm sorting, the ground
 * quads around the building average *nearer* than its wall triangles (a 6-unit
 * ground quad straddling the wall plane out-sorts the wall itself) and paint
 * straight over it. So the inside has to be drawn as its own exclusive scene,
 * exactly like the cave tunnel — see world.js getVisibleInstances().
 *
 *   exterior  — walls + roof as seen from outside, with a doorway gap
 *   interior  — inward-facing walls, floor and ceiling, drawn only when inside
 *   footprint — { w, d, wallH } for the containment query and collision
 *
 * The front wall (+Z) is split into two panels either side of the doorway so
 * there's a real opening to walk through instead of a painted-on door.
 */
export function buildGabledBuilding(w, d, wallH, wallColor, roofColor) {
    const exterior = makeMesh();
    const hw = w / 2, hd = d / 2;

    // --- walls (four panels, front one split around the doorway) ---
    // Back (-Z) and the two sides are solid.
    mergeMesh(exterior, buildBox(w, wallH, WALL_T, wallColor), 0, wallH / 2, -hd);
    mergeMesh(exterior, buildBox(WALL_T, wallH, d, wallColor), -hw, wallH / 2, 0);
    mergeMesh(exterior, buildBox(WALL_T, wallH, d, wallColor), hw, wallH / 2, 0);
    // Front (+Z): two panels flanking the door, plus a lintel above it.
    const sideW = (w - DOOR_W) / 2;
    const doorH = Math.min(2.8, wallH - 0.6);
    mergeMesh(exterior, buildBox(sideW, wallH, WALL_T, wallColor), -(DOOR_W / 2 + sideW / 2), wallH / 2, hd);
    mergeMesh(exterior, buildBox(sideW, wallH, WALL_T, wallColor), (DOOR_W / 2 + sideW / 2), wallH / 2, hd);
    mergeMesh(exterior, buildBox(DOOR_W, wallH - doorH, WALL_T, wallColor), 0, doorH + (wallH - doorH) / 2, hd);

    // --- roof ---
    const roofH = 1.6;
    mergeMesh(exterior, buildBox(w * 1.05, 0.3, d * 1.05, roofColor), 0, wallH + 0.15, 0);
    mergeMesh(exterior, buildCone(Math.max(w, d) * 0.62, roofH, 4, roofColor), 0, wallH + roofH / 2 + 0.3, 0, 0);

    // --- interior ---
    // Drawn only while the camera is inside, so it needs its own floor and
    // ceiling; the exterior's roof is invisible from below once we stop drawing
    // it. Walls are double-sided at submit time rather than re-wound here, which
    // keeps this builder simple and costs nothing at these triangle counts.
    const interior = makeMesh();
    const iw = w - WALL_T * 2, id = d - WALL_T * 2;
    const floorColor = [120, 96, 66];   // warm boards
    const ceilColor = [96, 88, 78];     // lighter than the floor so "up" reads as up
    mergeMesh(interior, buildPlane(iw, id, floorColor), 0, 0.02, 0);
    mergeMesh(interior, buildPlane(iw, id, ceilColor), 0, wallH - 0.02, 0);
    // Inner wall faces, inset so they sit just inside the exterior shell.
    const inWall = [wallColor[0] * 0.94, wallColor[1] * 0.94, wallColor[2] * 0.94];
    mergeMesh(interior, buildBox(iw, wallH, 0.08, inWall), 0, wallH / 2, -id / 2);
    mergeMesh(interior, buildBox(0.08, wallH, id, inWall), -iw / 2, wallH / 2, 0);
    mergeMesh(interior, buildBox(0.08, wallH, id, inWall), iw / 2, wallH / 2, 0);
    // Front wall, again split so the doorway stays open from the inside too.
    const iSideW = (iw - DOOR_W) / 2;
    mergeMesh(interior, buildBox(iSideW, wallH, 0.08, inWall), -(DOOR_W / 2 + iSideW / 2), wallH / 2, id / 2);
    mergeMesh(interior, buildBox(iSideW, wallH, 0.08, inWall), (DOOR_W / 2 + iSideW / 2), wallH / 2, id / 2);
    mergeMesh(interior, buildBox(DOOR_W, wallH - doorH, 0.08, inWall), 0, doorH + (wallH - doorH) / 2, id / 2);

    return { exterior, interior, footprint: { w, d, wallH, doorW: DOOR_W, wallT: WALL_T } };
}

export function buildLibraryShell(rng) {
    return buildGabledBuilding(12, 9, 4.2, [188, 176, 148], STONE_DARK);
}

export function buildMuseumShell(rng) {
    const b = buildGabledBuilding(14, 11, 4.8, [214, 210, 198], [120, 116, 108]);
    // Columns across the front, set clear of the doorway so they don't block it.
    for (let x = -5.5; x <= 5.5; x += 2.75) {
        if (Math.abs(x) < DOOR_W / 2 + 0.5) continue;
        mergeMesh(b.exterior, buildCylinder(0.35, 4.4, 8, [230, 226, 214], true, true), x, 2.2, 5.6);
    }
    return b;
}

/** A wooden pier extending from shore into the water, for the shore region. */
export function buildPier(rng, length = 8) {
    const m = makeMesh();
    mergeMesh(m, buildBox(2, 0.3, length, WOOD), 0, -0.05, length / 2);
    for (let z = 0.5; z < length; z += 1.6) {
        mergeMesh(m, buildCylinder(0.12, 1.4, 6, WOOD, false, false), -0.9, -0.6, z);
        mergeMesh(m, buildCylinder(0.12, 1.4, 6, WOOD, false, false), 0.9, -0.6, z);
    }
    return m;
}

/** A simple garden fountain — cylinder basin + center spout. */
export function buildFountain(rng) {
    const m = makeMesh();
    mergeMesh(m, buildCylinder(1.6, 0.5, 12, STONE, true, true, 1.6), 0, 0.25, 0);
    mergeMesh(m, buildCylinder(0.9, 0.4, 12, STONE, false, true, 0.9), 0, 0.55, 0);
    mergeMesh(m, buildCylinder(0.18, 1.1, 8, STONE_DARK, true, true), 0, 1.0, 0);
    return m;
}

/** Museum pedestal for an artifact. */
export function buildPedestal(rng) {
    const m = makeMesh();
    mergeMesh(m, buildBox(0.8, 1.0, 0.8, [222, 218, 206]), 0, 0.5, 0);
    mergeMesh(m, buildBox(0.95, 0.12, 0.95, STONE_DARK), 0, 1.02, 0);
    return m;
}

/** Library bookshelf (empty slots filled visually elsewhere via item state, shelf itself is static). */
export function buildBookshelf(rng) {
    const m = makeMesh();
    mergeMesh(m, buildBox(1.8, 2.2, 0.4, WOOD), 0, 1.1, 0);
    for (let i = 0; i < 4; i++) {
        mergeMesh(m, buildBox(1.7, 0.06, 0.38, [70, 50, 32]), 0, 0.3 + i * 0.5, 0);
    }
    return m;
}
