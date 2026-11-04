// The Black Nocturne's hull and architecture: the lofted skin, decks and
// stairs, a bulwark of pointed-arch tracery with the gun ports in it, the
// gilt wales, and a stern built like a cathedral front (gable, rose window,
// lancets, pinnacled turrets and flying buttresses).

import * as THREE from 'three';
import { TAU, lerp } from './util.js';
import { S, V, grid, sideX, keel, topAt, beam } from './ship-kit.js';
import { glassTexture, namePlate } from './ship-textures.js';

/** Where the cannons on the main deck stand (the centres of three bulwark panels). */
export const MAIN_BAYS = [];

// the main zone's panels: 7 between the forecastle and the quarterdeck, so the gangway's gap lines up
const MAIN_PANELS = 7;

/** The extruded panel: a slab with a pointed-arch opening. */
function archPanel(w, h, ww, y0, apex) {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.lineTo(w / 2, h);
    sh.lineTo(-w / 2, h);
    sh.closePath();
    const hole = new THREE.Path();
    const sp = apex - ww * 0.62;
    hole.moveTo(-ww / 2, y0);
    hole.lineTo(-ww / 2, sp);
    hole.bezierCurveTo(-ww / 2, sp + ww * 0.3, -ww * 0.12, apex - ww * 0.2, 0, apex);
    hole.bezierCurveTo(ww * 0.12, apex - ww * 0.2, ww / 2, sp + ww * 0.3, ww / 2, sp);
    hole.lineTo(ww / 2, y0);
    hole.closePath();
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.13, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -0.065);
    return g;
}

/** A tall gable front (the stern) with a rose window and two lancets cut out of it. */
function gableFront(halfW, wallH, apexH) {
    const sh = new THREE.Shape();
    sh.moveTo(-halfW, 0);
    sh.lineTo(halfW, 0);
    sh.lineTo(halfW, wallH);
    sh.lineTo(0, apexH);
    sh.lineTo(-halfW, wallH);
    sh.closePath();
    const rose = new THREE.Path();
    rose.absarc(0, wallH + 0.35, 0.78, 0, TAU, true);
    sh.holes.push(rose);
    for (const s of [-1, 1]) {
        const x = s * halfW * 0.57, w = 0.44, y0 = 0.7, y1 = 3.0;
        const p = new THREE.Path();
        p.moveTo(x - w, y0);
        p.lineTo(x - w, y1 - 0.9);
        p.bezierCurveTo(x - w, y1 - 0.4, x - w * 0.25, y1 - 0.15, x, y1);
        p.bezierCurveTo(x + w * 0.25, y1 - 0.15, x + w, y1 - 0.4, x + w, y1 - 0.9);
        p.lineTo(x + w, y0);
        p.closePath();
        sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 8 });
    g.translate(0, 0, -0.17);
    return g;
}

/** A rows-of-y function for a skin zone with top height T. */
function rowY(z, j, nv, T) {
    if (j <= 6) return -keel(z) * (1 - j / 6);
    if (j <= 12) return (S.DECK * (j - 6)) / 6;
    return S.DECK + ((T - S.DECK) * (j - 12)) / (nv - 12);
}

function skin(P, z0, z1, T) {
    const n = Math.max(2, Math.round((z1 - z0) / 0.5));
    const nv = T > S.DECK + 0.01 ? 16 : 12;
    for (const s of [-1, 1]) {
        P.add('hull', grid(n, nv, (i, j) => {
            const z = z0 + ((z1 - z0) * i) / n, y = rowY(z, j, nv, T);
            return [s * sideX(z, y), y, z];
        }, (z1 - z0) * 0.5, 3), null);
    }
}

function cap(P, z, T) {
    const nv = T > S.DECK + 0.01 ? 16 : 12;
    P.add('hull', grid(2, nv, (i, j) => {
        const y = rowY(z, j, nv, T);
        return [(i - 1) * sideX(z, y), y, z];
    }, 2, 3), null);
}

function deckStrip(P, z0, z1, y) {
    const n = Math.max(2, Math.round((z1 - z0) / 0.6));
    P.add('deck', grid(n, 1, (i, j) => {
        const z = z0 + ((z1 - z0) * i) / n;
        return [(j ? 1 : -1) * (sideX(z, y) - 0.1), y, z];
    }, (z1 - z0) * 0.3, 2), null);
}

/** Wales: gilt bands running the length of the hull. */
function wale(P, y, z0, z1, r) {
    for (const s of [-1, 1]) {
        const pts = [];
        const n = Math.round((z1 - z0) / 1.2);
        for (let i = 0; i <= n; i++) {
            const z = z0 + ((z1 - z0) * i) / n;
            pts.push(V(s * (sideX(z, y) + 0.03), y, z));
        }
        P.tube('trim', pts, r, { seg: 4 });
    }
}

/** A pinnacle: a square post topped with a spire and a bud. */
function pinnacle(P, x, y, z, h = 0.42, r = 0.1) {
    P.cone('trim', r, h, x, y + h / 2, z, { seg: 4, ry: Math.PI / 4 });
    P.sph('trim', r * 0.55, x, y + h + r * 0.4, z);
}

/** One bulwark run along a zone, both sides. Returns the panel centres of the first side. */
function bulwark(P, ctx, z0, z1, base, h, n, { gap, gunPanels = [] } = {}) {
    const step = (z1 - z0) / n;
    const pan = archPanel(step + 0.08, h, step * 0.46, h * 0.22, h * 0.9);
    const gun = archPanel(step + 0.08, h, step * 0.6, h * 0.13, h * 0.88);
    const centres = [];
    for (const s of [-1, 1]) {
        const posts = [];
        for (let k = 0; k <= n; k++) {
            const z = z0 + step * k;
            const x = s * (sideX(z, base + h * 0.4) - 0.1);
            // the port side's gangway has taller gate posts either side of a gap
            const gate = s < 0 && !!gap && (Math.abs(z - gap[0]) < 0.2 || Math.abs(z - gap[1]) < 0.2);
            const tall = gate ? 0.7 : 0;
            P.box('hull', 0.22, h + 0.2 + tall, 0.22, x, base + (h + tall) / 2 + 0.05, z);
            P.box('trim', 0.27, 0.07, 0.27, x, base + h + tall + 0.12, z);
            pinnacle(P, x, base + h + tall + 0.15, z, gate ? 0.7 : 0.4, gate ? 0.13 : 0.1);
            posts.push({ x, z, gate });
        }
        // the rail between posts, a tube per unbroken run
        let run = [];
        posts.forEach((p, k) => {
            run.push(V(p.x, base + h + 0.12, p.z));
            const next = posts[k + 1];
            const gapNext = p.gate && next?.gate && s < 0 && Math.abs(p.z - gap[0]) < 0.2 && Math.abs(next.z - gap[1]) < 0.2;
            if (gapNext || !next) {
                if (run.length > 1) P.tube('trim', run, 0.06, { seg: 4 });
                run = [];
            }
        });
        for (let k = 0; k < n; k++) {
            const a = posts[k], b = posts[k + 1];
            const zc = (a.z + b.z) / 2;
            if (s === -1) centres.push(zc);
            // in the gangway's gap there is no panel
            if (a.gate && b.gate && s < 0 && Math.abs(a.z - gap[0]) < 0.2 && Math.abs(b.z - gap[1]) < 0.2) continue;
            const dx = b.x - a.x, dz = b.z - a.z, ln = Math.hypot(dx, dz);
            const psi = Math.atan2(-dz / ln, dx / ln);
            const g = (gunPanels.includes(k) ? gun : pan).clone();
            g.scale(ln / (step + 0.08), 1, 1);
            P.add('hullRed', g, new THREE.Matrix4().compose(V((a.x + b.x) / 2, base, zc), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, psi, 0)), V(1, 1, 1)));
            P.rod('trim', V(a.x, base + 0.05, a.z), V(b.x, base + 0.05, b.z), 0.04);
            // a quatrefoil boss above each arch
            if (!gunPanels.includes(k)) P.cyl('trim', 0.06, 0.06, 0.03, (a.x + b.x) / 2 + s * 0.07, base + h * 0.93, zc, { rz: Math.PI / 2, seg: 6 });
        }
    }
    return centres;
}

/** A flight of steps up from yFrom at zFrom to yTo at zTo, on both sides of the ship. */
function stairs(P, zFrom, zTo, yFrom, yTo) {
    const n = 7;
    for (const s of [-1, 1]) {
        const cx = s * (S.STAIR_IN + S.STAIR_OUT) / 2, w = S.STAIR_OUT - S.STAIR_IN;
        for (let k = 0; k < n; k++) {
            const t0 = k / n, t1 = (k + 1) / n;
            const top = lerp(yFrom, yTo, t1);
            const zc = lerp(zFrom, zTo, (t0 + t1) / 2);
            const run = Math.abs(zTo - zFrom) / n;
            const h = top - Math.min(yFrom, yTo);
            P.box('deck', w, h, run + 0.02, cx, Math.min(yFrom, yTo) + h / 2, zc);
        }
        // stringers and a rail with newel posts
        for (const ex of [-1, 1]) {
            const x = cx + ex * (w / 2 + 0.05);
            const a = V(x, yFrom + 0.9, zFrom), b = V(x, yTo + 0.9, zTo);
            P.rod('trim', a, b, 0.035);
            P.rod('hull', V(x, yFrom, zFrom), V(x, yTo, zTo), 0.06);
            for (const e of [a, b]) {
                P.box('hull', 0.12, 0.9, 0.12, x, e.y - 0.45, e.z);
                pinnacle(P, x, e.y, e.z, 0.26, 0.07);
            }
        }
    }
}

/** A turret: an octagonal tower with a pointed roof, crockets and a lantern at its tip. */
function turret(P, ctx, x, z, y0, h) {
    P.cyl('stone', 0.5, 0.58, h, x, y0 + h / 2, z, { seg: 8 });
    P.cyl('trim', 0.6, 0.6, 0.07, x, y0 + h - 0.05, z, { seg: 8 });
    P.cyl('stone', 0.64, 0.5, 0.35, x, y0 + h + 0.15, z, { seg: 8 });
    P.cone('hull', 0.7, 2.4, x, y0 + h + 1.5, z, { seg: 8 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        P.cone('trim', 0.055, 0.22, x + Math.sin(a) * 0.36, y0 + h + 1.0 + (i % 2) * 0.25, z + Math.cos(a) * 0.36, { seg: 4, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 });
    }
    // narrow lancet slits that glow
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        P.box('lamp', 0.1, 0.8, 0.04, x + Math.sin(a) * 0.5, y0 + h * 0.55, z + Math.cos(a) * 0.5, a);
    }
    P.cyl('trim', 0.025, 0.025, 0.5, x, y0 + h + 2.95, z, { seg: 4 });
    P.sph('ecto', 0.16, x, y0 + h + 2.75, z);
    ctx.lights.push({ x, y: y0 + h + 2.75, z, kind: 'ecto' });
}

/** Gothic windows on the transom and the gable, as glass planes. */
function glass(ctx, tex, w, h, x, y, z, ry = 0) {
    const mat = ctx.glassMat(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    ctx.group.add(m);
    return m;
}

export function buildHull(P, ctx) {
    const { col } = ctx;

    // ---- the skin, in three zones, closed fore and aft
    skin(P, -S.HL, S.FORE_Z, S.FORE);
    skin(P, S.FORE_Z, S.QUARTER_Z, S.DECK);
    skin(P, S.QUARTER_Z, S.HL, S.QUARTER);
    cap(P, -S.HL, S.FORE);
    cap(P, S.HL, S.QUARTER);
    // gilt wales: two bands on the hull and one at the deck line of each castle
    wale(P, 0.55, -S.HL + 0.5, S.HL - 0.1, 0.07);
    wale(P, 1.45, -S.HL + 1.2, S.HL - 0.1, 0.05);
    wale(P, S.DECK + 0.02, S.FORE_Z, S.QUARTER_Z, 0.06);

    // ---- decks
    deckStrip(P, -S.HL + 0.3, S.FORE_Z, S.FORE);
    deckStrip(P, S.FORE_Z, S.QUARTER_Z, S.DECK);
    deckStrip(P, S.QUARTER_Z, S.HL - 0.2, S.QUARTER);

    // ---- the bulkheads under the castles: solid in the middle, the stairs at the sides
    for (const [z, y0, y1] of [[S.QUARTER_Z, S.DECK, S.QUARTER], [S.FORE_Z, S.DECK, S.FORE]]) {
        const h = y1 - y0;
        P.box('hullRed', S.STAIR_IN * 2, h, 0.3, 0, y0 + h / 2, z);
        for (const s of [-1, 1]) {
            const x0 = S.STAIR_OUT, x1 = sideX(z, y1) - 0.1;
            P.box('hullRed', x1 - x0, h, 0.3, s * (x0 + x1) / 2, y0 + h / 2, z);
        }
        // a pointed doorway on the face toward the main deck, with a lamp beside it
        const fz = z + (z === S.QUARTER_Z ? -0.17 : 0.17);
        P.box('black', 0.8, 1.25, 0.04, 0, y0 + 0.65, fz);
        P.box('lamp', 0.3, 0.45, 0.04, 0, y0 + 1.35, fz);
        P.cone('trim', 0.4, 0.5, 0, y0 + 1.5, fz, { seg: 3, rx: Math.PI / 2 });
        for (const s of [-1, 1]) {
            P.rod('trim', V(s * 0.45, y0 + 0.02, fz), V(s * 0.45, y0 + 1.3, fz), 0.03);
            P.cyl('trim', 0.07, 0.07, 0.2, s * 0.85, y0 + 1.15, fz + (z === S.QUARTER_Z ? -0.1 : 0.1), { seg: 6 });
            P.sph('lamp', 0.09, s * 0.85, y0 + 1.15, fz + (z === S.QUARTER_Z ? -0.1 : 0.1));
        }
        for (let x = -S.STAIR_IN + 0.15; x < S.STAIR_IN; x += 0.3) col.push({ x, z, r: 0.28 });
    }
    // the side parts of the bulkheads are covered by the hull: colliders keep people out of the gaps between stairs and sides
    stairs(P, S.QUARTER_STAIR_Z, S.QUARTER_Z, S.DECK, S.QUARTER);
    stairs(P, S.FORE_STAIR_Z, S.FORE_Z, S.DECK, S.FORE);

    // ---- bulwarks of tracery
    const mainC = bulwark(P, ctx, S.FORE_Z, S.QUARTER_Z, S.DECK, 1.15, MAIN_PANELS, { gap: S.GANG_Z, gunPanels: [2, 3, 4] });
    bulwark(P, ctx, -S.HL + 0.3, S.FORE_Z, S.FORE, 1.05, 2);
    const qC = bulwark(P, ctx, S.QUARTER_Z, S.HL - 0.3, S.QUARTER, 1.05, 5, { gunPanels: [1] });
    ctx.qbays = [qC[1]];
    MAIN_BAYS.length = 0;
    MAIN_BAYS.push(...mainC.filter((_, k) => k >= 2 && k <= 4));
    ctx.bays = [...MAIN_BAYS];
    // a bulwark across the bow joins the two sides
    {
        const z = -S.HL + 0.3, y = S.FORE, x = sideX(z, y) - 0.1;
        P.box('hullRed', x * 2 + 0.1, 1.0, 0.13, 0, y + 0.5, z + 0.02);
        P.rod('trim', V(-x, y + 1.05, z), V(x, y + 1.05, z), 0.06);
    }

    // ---- the gangway's gate on the port side: a pointed arch of two posts and a hoop
    {
        const [za, zb] = S.GANG_Z;
        const x = -(sideX((za + zb) / 2, S.DECK + 0.5) - 0.1);
        ctx.gate = { x, z: (za + zb) / 2, y: S.DECK };
        for (let k = 0; k < 6; k++) {
            const t = k / 5;
            P.rod('trim', V(x, S.DECK + 0.1, za + 0.05 + (zb - za - 0.1) * t), V(x, S.DECK + 1.0, za + 0.05 + (zb - za - 0.1) * t), 0.02);
        }
        P.rod('rope', V(x, S.DECK + 0.95, za + 0.05), V(x, S.DECK + 0.95, zb - 0.05), 0.03);
    }

    // ---- the stern: a cathedral front with turrets, buttresses and a gallery
    {
        const zF = 11.95, y0 = S.QUARTER;
        const halfW = 2.2;
        P.add('stone', gableFront(halfW, 3.3, 5.7), new THREE.Matrix4().makeTranslation(0, y0, zF));
        // stained glass behind the openings
        glass(ctx, ctx.tex.rose, 1.44, 1.44, 0, y0 + 3.3 + 0.35, zF - 0.1);
        for (const s of [-1, 1]) glass(ctx, ctx.tex.lancet, 0.9, 2.45, s * halfW * 0.57, y0 + 0.7 + 1.22, zF - 0.1);
        // a cornice, a gilt cross and crockets up the gable
        P.box('trim', halfW * 2 + 0.2, 0.1, 0.5, 0, y0 + 0.02, zF - 0.1);
        for (let i = 0; i < 7; i++) {
            const t = i / 6;
            for (const s of [-1, 1]) {
                const x = s * halfW * (1 - t), y = y0 + 3.3 + 2.4 * t;
                P.cone('trim', 0.07, 0.3, x - s * 0.03, y + 0.2, zF + 0.2, { seg: 4, rz: -s * 0.55 });
            }
        }
        P.rod('trim', V(0, y0 + 5.65, zF), V(0, y0 + 6.9, zF), 0.06);
        P.rod('trim', V(-0.4, y0 + 6.45, zF), V(0.4, y0 + 6.45, zF), 0.05);
        P.sph('trim', 0.1, 0, y0 + 6.95, zF);
        for (const s of [-1, 1]) {
            turret(P, ctx, s * 2.3, 11.7, y0, 3.9);
            // flying buttresses: arcs from each turret's waist to the gable's shoulder
            const pts = [V(s * 2.0, y0 + 2.6, 11.75), V(s * 2.05, y0 + 3.3, 11.1), V(s * 1.7, y0 + 3.7, 10.5), V(s * 1.15, y0 + 3.4, 10.55)];
            const bt = [V(s * 1.9, y0 + 3.0, 11.2), V(s * 1.95, y0 + 3.5, 10.6), V(s * 1.9, y0 + 3.55, 10.4)];
            P.tube('stone', [V(s * 2.15, y0 + 2.9, 11.5), V(s * 2.3, y0 + 3.2, 12.6), V(s * 2.0, y0 + 3.15, 13.25)], 0.09, { seg: 5 });
            P.rod('stone', V(s * 2.25, y0 + 0.2, 11.3), V(s * 2.22, y0 + 2.9, 11.6), 0.1);
            void pts; void bt;
            col.push({ x: s * 2.3, z: 11.7, r: 0.7 });
        }
        // a rail walling the helm's back: the colliders for the façade
        for (let x = -2.0; x <= 2.0; x += 0.4) col.push({ x, z: zF - 0.1, r: 0.35 });

        // the stern gallery: three lancets on the transom, a balcony and a name plate
        for (const x of [-1.25, 0, 1.25]) {
            glass(ctx, ctx.tex.lancet, 0.7, 1.35, x, 2.85, S.HL + 0.04);
            P.box('trim', 0.82, 0.07, 0.1, x, 2.15, S.HL + 0.07);
        }
        P.box('hull', 4.2, 0.14, 0.9, 0, 2.2, S.HL + 0.4);
        for (let x = -1.95; x <= 1.96; x += 0.25) P.cyl('trim', 0.03, 0.03, 0.55, x, 2.55, S.HL + 0.8, { seg: 5 });
        P.rod('trim', V(-2.0, 2.85, S.HL + 0.8), V(2.0, 2.85, S.HL + 0.8), 0.05);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshStandardMaterial({ map: namePlate('THE BLACK NOCTURNE', 'Delvers’ Wharf'), roughness: 0.5, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
        plate.position.set(0, 1.35, S.HL + 0.045);
        ctx.group.add(plate);
        // a skull boss under the balcony
        P.sph('bone', 0.2, 0, 1.95, S.HL + 0.3, 1, 1.1, 0.9);
    }

    // ---- bow: the stem, the bowsprit and the beak
    {
        const stem = [V(0, -0.1, -S.HL + 0.4), V(0, 0.9, -S.HL - 0.35), V(0, 2.3, -S.HL - 0.55), V(0, 3.35, -S.HL - 0.1)];
        P.tube('trim', stem, 0.2, { seg: 6 });
        P.tube('hull', stem.map((p) => p.clone().add(V(0, 0, 0.1))), 0.26, { seg: 6 });
        const a = V(0, 3.75, -S.HL + 0.5), b = V(0, 5.9, -S.HL - 6.4);
        P.rod('hull', a, b, 0.26, 0.15, 7);
        P.rod('trim', V(0, 3.9, -S.HL + 0.3), V(0, 3.9, -S.HL - 1.0), 0.3);
        ctx.bowsprit = { a, b };
        // knee braces under the bowsprit (gothic flying braces)
        for (const s of [-1, 1]) {
            P.tube('hull', [V(s * 0.35, 2.2, -S.HL + 0.2), V(s * 0.55, 2.7, -S.HL - 1.6), V(s * 0.1, 4.0, -S.HL - 3.2)], 0.09, { seg: 5 });
        }
        col.push({ x: 0, z: -S.HL + 0.5, r: 0.5 });
    }

    // ---- rudder, keel and a ram of iron at the waterline
    P.box('hull', 0.2, 2.0, 1.1, 0, -0.4, S.HL + 0.55);
    P.rod('iron', V(0, -1.35, -S.HL + 1.5), V(0, -1.6, S.HL), 0.1);

    // ---- the quarterdeck rail's lamps: tall posts at the front corners
    for (const s of [-1, 1]) {
        const x = s * (sideX(5, S.QUARTER) - 0.4), z = S.QUARTER_Z + 0.4;
        P.rod('iron', V(x, S.QUARTER, z), V(x, S.QUARTER + 1.9, z), 0.05);
        P.sph('lamp', 0.17, x, S.QUARTER + 1.95, z, 1, 1.4, 1);
        P.cone('iron', 0.2, 0.28, x, S.QUARTER + 2.3, z, { seg: 6 });
        ctx.lights.push({ x, y: S.QUARTER + 1.95, z, kind: 'lamp' });
    }

    void beam; void topAt;
}

export function glassMaterial(tex) {
    return new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35,
        alphaTest: 0.5, side: THREE.DoubleSide,
    });
}

export function glassTextures() {
    return { lancet: glassTexture('lancet'), rose: glassTexture('rose') };
}
