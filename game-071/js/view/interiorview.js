/**
 * interiorview.js — draws the current interior cell: tile floors and ceilings, walls (rough rock
 * in caves and mines), furniture and dungeon dressing, animated gates, levers, dials and traps,
 * and a small pool of flickering point lights picked nearest the camera.
 */
import * as THREE from 'three';
import { Builder, buildProp, makeStructureMaterial } from './structures.js';
import { SLAYER as S } from './textures.js';
import { mulberry32 } from '../sim/rng.js';
import { SYMBOLS } from '../sim/interiors.js';

const LAYER = { carved: S.carved, masonry: S.masonry, rock: S.field, brass: S.brass, flag: S.flag, dirt: S.turf, plank: S.plank, log: S.log };
const TINT = { rock: [0.55, 0.52, 0.5], dirt: [0.45, 0.38, 0.3], carved: [0.75, 0.78, 0.8], brass: [0.9, 0.75, 0.5] };
const MAX_LIGHTS = 6;

// deterministic jitter so neighbouring wall quads share displaced corners
const jit = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) - 0.5; };

function propMesh(B, p, cell, rnd) {
    B.push();
    B.translate(p.x, p.y, p.z);
    B.rotY(p.rot || 0);
    if (p.s) B.scale(p.s, p.s, p.s);
    B.color(1, 1, 1);
    let handled = true;
    switch (p.type) {
        case 'table': { const L = p.len || 1.8; B.box(0, 0.82, 0, L, 0.08, 0.9, S.plank); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(sx * (L / 2 - 0.12), 0.4, sz * 0.32, 0.1, 0.8, 0.1, S.beam); break; }
        case 'bench': { const L = p.len || 1.6; B.box(0, 0.45, 0, L, 0.08, 0.35, S.plank); B.box(-L / 2 + 0.15, 0.22, 0, 0.1, 0.44, 0.3, S.beam); B.box(L / 2 - 0.15, 0.22, 0, 0.1, 0.44, 0.3, S.beam); break; }
        case 'bed': B.box(0, 0.25, 0, 1.1, 0.5, 2.1, S.plank); B.color(0.85, 0.8, 0.7); B.box(0, 0.55, 0.1, 1.0, 0.12, 1.8, S.cloth); B.color(0.6, 0.45, 0.35); B.box(0, 0.62, 0.35, 1.02, 0.08, 1.2, S.hide); B.color(0.9, 0.88, 0.8); B.box(0, 0.62, -0.75, 0.7, 0.14, 0.35, S.cloth); B.color(1, 1, 1); B.box(0, 0.7, -1.02, 1.1, 0.9, 0.08, S.plank); break;
        case 'bedroll': B.color(0.55, 0.42, 0.3); B.box(0, 0.06, 0, 0.8, 0.12, 1.9, S.hide); B.color(1, 1, 1); break;
        case 'chest': B.box(0, 0.3, 0, 1, 0.6, 0.6, S.plank); B.box(0, 0.62, 0, 1.02, 0.06, 0.62, S.iron); B.box(0, 0.3, 0.31, 0.15, 0.2, 0.02, S.iron); break;
        case 'chest_big': B.color(0.8, 0.7, 0.5); B.box(0, 0.4, 0, 1.4, 0.8, 0.8, S.carved); B.color(1, 1, 1); B.box(0, 0.82, 0, 1.44, 0.08, 0.84, S.brass); B.box(0, 0.4, 0.41, 0.25, 0.3, 0.02, S.brass); break;
        case 'urn': B.color(0.7, 0.68, 0.62); B.cylinder(0, 0, 0, 0.22, 0.32, 0.35, 10, S.carved); B.cylinder(0, 0.35, 0, 0.32, 0.18, 0.35, 10, S.carved); B.cylinder(0, 0.7, 0, 0.16, 0.2, 0.12, 10, S.carved, { cap: true }); B.color(1, 1, 1); break;
        case 'satchel': B.color(0.5, 0.36, 0.22); B.box(0, 0.18, 0, 0.5, 0.36, 0.3, S.hide); B.color(1, 1, 1); break;
        case 'counter': { const L = p.len || 3; B.box(0, 0.52, 0, L, 1.04, 0.7, S.plank); B.box(0, 1.07, 0, L + 0.1, 0.06, 0.8, S.beam); break; }
        case 'shelf': B.box(0, 1, 0, 1.8, 2, 0.4, S.plank, { noFront: true }); for (let i = 0; i < 4; i++) B.box(0, 0.25 + i * 0.5, 0.02, 1.7, 0.04, 0.36, S.beam); for (let i = 0; i < 6; i++) { B.color(0.4 + rnd() * 0.5, 0.3 + rnd() * 0.3, 0.2 + rnd() * 0.3); B.box(-0.7 + i * 0.28, 0.45 + Math.floor(rnd() * 3) * 0.5, 0.05, 0.12, 0.3, 0.2, S.cloth); } B.color(1, 1, 1); break;
        case 'hearth': { const L = p.len || 1.4; B.box(0, 0.18, 0, L + 0.6, 0.36, 1.4, S.flag); B.color(0.2, 0.18, 0.16); B.box(0, 0.37, 0, L, 0.04, 0.9, S.field); B.color(1, 1, 1); for (let i = 0; i < Math.max(2, L * 1.5); i++) { B.push(); B.translate(-L / 2 + 0.3 + rnd() * (L - 0.6), 0.48, (rnd() - 0.5) * 0.5); B.rotY(rnd() * 3); B.rotZ(Math.PI / 2); B.cylinder(0, -0.4, 0, 0.08, 0.08, 0.8, 6, S.log); B.pop(); } break; }
        case 'highseat': B.color(0.7, 0.55, 0.4); B.box(0, 0.5, 0, 1.4, 1, 1.0, S.carved); B.box(0, 1.8, -0.42, 1.4, 2.6, 0.16, S.carved); B.color(0.55, 0.12, 0.1); B.box(0, 1.05, 0.05, 1.1, 0.08, 0.8, S.cloth); B.color(1, 1, 1); B.box(-0.75, 1.4, 0, 0.12, 0.2, 0.9, S.beam); B.box(0.75, 1.4, 0, 0.12, 0.2, 0.9, S.beam); break;
        case 'pillar': B.cylinder(0, 0, 0, 0.35, 0.3, cell.wallH, 10, S.log); break;
        case 'banner_in': B.color(0.55, 0.14, 0.12); B.box(0, cell.wallH * 0.6, 0, 1.2, 2.6, 0.04, S.cloth); B.color(1, 1, 1); break;
        case 'trophy': B.box(0, 2.6, 0, 1.2, 1, 0.1, S.plank); B.color(0.35, 0.25, 0.18); B.box(0, 2.6, 0.25, 0.6, 0.6, 0.5, S.hide); B.color(0.9, 0.86, 0.76); B.beam([0.25, 2.8, 0.3], [0.8, 3.4, 0.5], 0.08, S.plaster); B.beam([-0.25, 2.8, 0.3], [-0.8, 3.4, 0.5], 0.08, S.plaster); B.color(1, 1, 1); break;
        case 'rack': B.box(0, 1, 0, 2, 0.1, 0.3, S.beam); B.box(0, 0.3, 0, 2, 0.1, 0.3, S.beam); for (let i = 0; i < 4; i++) B.box(-0.75 + i * 0.5, 1.0, 0.05, 0.05, 1.6, 0.05, S.iron); break;
        case 'altar': B.color(0.85, 0.85, 0.82); B.box(0, 0.55, 0, 2.4, 1.1, 1, S.carved); B.box(0, 1.12, 0, 2.6, 0.08, 1.15, S.flag); B.color(1, 1, 1); break;
        case 'candles': for (let i = 0; i < 3; i++) { B.color(0.95, 0.92, 0.82); B.cylinder(-0.12 + i * 0.12, 0.88, (i % 2) * 0.08, 0.025, 0.025, 0.12 + i * 0.05, 6, S.plaster, { cap: true }); } B.color(1, 1, 1); break;
        case 'rug': B.color(0.5, 0.18, 0.14); B.box(0, 0.01, 0, 2.6, 0.02, 1.6, S.cloth); B.color(1, 1, 1); break;
        case 'trapdoor': B.box(0, 0.02, 0, 1.2, 0.04, 1.2, S.plank); B.box(0, 0.05, 0, 1.25, 0.03, 0.08, S.iron); break;
        case 'door_frame': B.box(0, 1.2, 0, 1.4, 2.4, 0.12, S.plank); B.box(0, 2.45, 0, 1.7, 0.18, 0.3, S.beam); B.box(0.45, 1.15, 0.08, 0.1, 0.1, 0.06, S.iron); break;
        case 'pillar_broken': { const h = 2 + rnd() * 3; B.color(0.72, 0.72, 0.76); B.cylinder(0, 0, 0, 0.7, 0.62, h, 10, S.carved, { cap: true }); B.box(0, 0.15, 0, 1.8, 0.3, 1.8, S.carved); B.color(1, 1, 1); break; }
        case 'rubble': B.color(0.66, 0.66, 0.7); for (let i = 0; i < 5; i++) B.box((rnd() - 0.5) * 2.4, 0.25, (rnd() - 0.5) * 2.4, 0.4 + rnd() * 0.6, 0.35 + rnd() * 0.4, 0.4 + rnd() * 0.5, S.carved); B.color(1, 1, 1); break;
        case 'door_frame_big': B.color(0.7, 0.7, 0.72); B.box(-1.5, 1.8, 0, 0.6, 3.6, 0.8, S.carved); B.box(1.5, 1.8, 0, 0.6, 3.6, 0.8, S.carved); B.box(0, 3.8, 0, 3.8, 0.6, 0.9, S.carved); B.color(0.45, 0.32, 0.2); B.box(0, 1.6, 0.2, 2.4, 3.2, 0.16, S.plank); B.color(1, 1, 1); B.box(0, 1.6, 0.3, 2.4, 0.12, 0.04, S.iron); break;
        case 'cave_exit': B.color(0.9, 0.85, 0.7); B.box(0, 1.6, 0.4, 2.4, 3.2, 0.05, S.window); B.color(1, 1, 1); break;
        case 'brazier_in': B.cylinder(0, 0, 0, 0.12, 0.08, 0.9, 6, S.iron); B.cylinder(0, 0.9, 0, 0.18, 0.4, 0.3, 10, S.iron); B.color(1, 0.55, 0.2); B.cylinder(0, 1.15, 0, 0.32, 0.2, 0.08, 8, S.window, { cap: true }); B.color(1, 1, 1); break;
        case 'lantern': B.box(0, 2.1, 0.12, 0.05, 0.05, 0.3, S.iron); B.color(1, 0.75, 0.4); B.box(0, 1.95, 0.3, 0.2, 0.3, 0.2, S.window); B.color(1, 1, 1); break;
        case 'brass_lamp': B.box(0, 2.8, 0.1, 0.12, 0.12, 0.3, S.brass); B.color(0.6, 1, 0.65); B.cylinder(0, 2.6, 0.3, 0.2, 0.25, 0.4, 8, S.window, { cap: true }); B.color(1, 1, 1); break;
        case 'glowcaps': for (let i = 0; i < 5; i++) { B.color(0.5, 1, 0.8); const x = (rnd() - 0.5) * 1, z = rnd() * 0.4; B.cylinder(x, 0, z, 0.03, 0.03, 0.15 + rnd() * 0.2, 5, S.plaster); B.cylinder(x, 0.2 + rnd() * 0.2, z, 0.12, 0.01, 0.1, 8, S.window, { cap: true }); } B.color(1, 1, 1); break;
        case 'niche': B.color(0.55, 0.55, 0.58); B.box(0, 1.1, 0.05, 2.2, 0.15, 0.9, S.carved); B.box(0, 2.3, 0.05, 2.2, 0.15, 0.9, S.carved); B.box(-1.05, 1.7, 0.05, 0.15, 1.2, 0.9, S.carved); B.box(1.05, 1.7, 0.05, 0.15, 1.2, 0.9, S.carved); B.color(0.75, 0.72, 0.62); B.box(0, 1.3, 0.15, 1.6, 0.18, 0.4, S.plaster); B.color(1, 1, 1); break;
        case 'coffin': B.color(0.6, 0.6, 0.62); B.box(0, 0.35, 0, 0.9, 0.7, 2.1, S.carved); B.box(0, 0.74, 0, 0.95, 0.1, 2.15, S.flag); B.color(1, 1, 1); break;
        case 'sarcophagus': B.color(0.62, 0.62, 0.66); B.box(0, 0.25, 0, 3, 0.5, 4, S.flag); B.box(0, 0.85, 0, 1.4, 0.7, 2.6, S.carved); B.box(0, 1.25, 0, 1.5, 0.12, 2.7, S.carved); B.color(1, 1, 1); break;
        case 'wyrm_statue': B.color(0.5, 0.48, 0.46); B.box(0, 0.5, 0, 1.6, 1, 1.6, S.carved); B.cylinder(0, 1, 0, 0.5, 0.3, 2.4, 8, S.carved); B.beam([0, 3.2, 0], [0, 3.9, 0.9], 0.45, S.carved); B.beam([0.3, 3.1, 0], [1.4, 3.8, -0.4], 0.12, S.carved); B.beam([-0.3, 3.1, 0], [-1.4, 3.8, -0.4], 0.12, S.carved); B.color(1, 1, 1); break;
        case 'stalagmite': B.color(...TINT.rock); B.cylinder(0, 0, 0, 0.5, 0.02, 1.4 + rnd() * 1.6, 7, S.field); B.color(1, 1, 1); break;
        case 'bones': B.color(0.85, 0.82, 0.72); for (let i = 0; i < 5; i++) B.beam([(rnd() - 0.5), 0.05, (rnd() - 0.5)], [(rnd() - 0.5), 0.05, (rnd() - 0.5)], 0.06, S.plaster); B.cylinder(0.3, 0, 0.2, 0.12, 0.1, 0.18, 7, S.plaster, { cap: true }); B.color(1, 1, 1); break;
        case 'ore_vein': B.color(0.5, 0.45, 0.4); B.box(0, 1.2, 0.1, 1.4, 1.6, 0.5, S.field); B.color(0.9, 0.7, 0.4); for (let i = 0; i < 5; i++) B.box((rnd() - 0.5) * 1.1, 0.6 + rnd() * 1.2, 0.35, 0.18, 0.12, 0.08, S.brass); B.color(1, 1, 1); break;
        case 'support': B.box(-1.6, cell.wallH / 2, 0, 0.3, cell.wallH, 0.3, S.log); B.box(1.6, cell.wallH / 2, 0, 0.3, cell.wallH, 0.3, S.log); B.box(0, cell.wallH - 0.2, 0, 3.6, 0.3, 0.32, S.log); break;
        case 'minecart': B.box(0, 0.55, 0, 0.9, 0.6, 1.3, S.iron); B.color(0.4, 0.35, 0.3); B.box(0, 0.8, 0, 0.75, 0.1, 1.15, S.field); B.color(1, 1, 1); break;
        case 'pipes': for (let i = 0; i < 3; i++) { B.push(); B.translate(-0.6 + i * 0.6, 0, 0.3); B.cylinder(0, 0, 0, 0.14, 0.14, cell.wallH, 8, S.brass); B.pop(); } break;
        case 'gearwork': B.push(); B.translate(0, 1.2, 0); B.rotX(Math.PI / 2); B.cylinder(0, -0.1, 0, 1.1, 1.1, 0.2, 14, S.brass, { cap: true }); B.pop(); B.box(0, 0.4, 0, 0.5, 0.8, 0.5, S.iron); break;
        case 'orrery': B.cylinder(0, 0, 0, 1.6, 1.4, 0.6, 16, S.brass, { cap: true }); B.cylinder(0, 0.6, 0, 0.12, 0.12, 2.4, 8, S.brass); B.color(1, 0.85, 0.5); B.cylinder(0, 2.8, 0, 0.4, 0.4, 0.5, 12, S.window, { cap: true }); B.color(1, 1, 1); for (let i = 0; i < 4; i++) { const a = i * 1.57; B.beam([0, 2.6, 0], [Math.cos(a) * 2, 2.6 + (i % 2) * 0.4, Math.sin(a) * 2], 0.05, S.brass); } break;
        case 'orrery_small': B.cylinder(0, 0, 0, 0.6, 0.5, 0.9, 10, S.brass, { cap: true }); B.color(0.7, 0.8, 1); B.cylinder(0, 1.2, 0, 0.25, 0.25, 0.3, 10, S.window, { cap: true }); B.color(1, 1, 1); break;
        case 'telescope': B.box(0, 0.6, 0, 0.6, 1.2, 0.6, S.plank); B.beam([0, 1.3, 0], [0.4, 2.5, -1.2], 0.18, S.brass); break;
        case 'sigilstone_in': p = { ...p, type: 'sigilstone' }; B.pop(); buildProp(B, { ...p, y: p.y }, () => p.y, rnd); return;
        case 'mural': B.color(0.6, 0.62, 0.66); B.box(0, 2, 0.05, 3, 2.6, 0.12, S.carved); B.color(0.55, 0.8, 1); (p.solution || []).forEach((k, i) => { B.box(-1 + i, 2.2, 0.13, 0.5, 0.5, 0.02, S.window); }); B.color(1, 1, 1); break;
        case 'trap_plate': B.color(0.6, 0.6, 0.6); B.box(0, 0.02, 0, 1.2, 0.05, 1.2, S.flag); B.color(1, 1, 1); break;
        case 'trap_spikes': B.box(0, 0.02, 0, 2.6, 0.04, 2.6, S.iron); break;
        case 'trap_steam': B.cylinder(0, 0, 0, 0.4, 0.3, 0.15, 10, S.brass, { cap: true }); break;
        case 'trap_blades': case 'gate': case 'lever': case 'dial': handled = true; break;   // animated, built separately
        default: handled = false;
    }
    B.pop();
    if (!handled) buildProp(B, p, () => p.y, rnd);
}

export class InteriorView {
    constructor(scene, renderer) {
        this.scene = scene;
        this.r = renderer;
        this.group = null;
        this.cell = null;
        const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
        this.black = black;
        this.material = null;
        this.lights = [];
        for (let i = 0; i < MAX_LIGHTS; i++) { const L = new THREE.PointLight(0xffa860, 0, 12, 1.6); L.visible = false; this.lights.push(L); }
        this.hemi = new THREE.HemisphereLight(0x9aa4b4, 0x2a2420, 0);
        this.animated = [];
    }

    ensureMaterial(tex) { if (!this.material) this.material = makeStructureMaterial(tex, this.black); }

    clear() {
        if (this.group) { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
        for (const L of this.lights) { L.visible = false; if (L.parent) L.parent.remove(L); }
        if (this.hemi.parent) this.hemi.parent.remove(this.hemi);
        this.group = null; this.cell = null; this.animated = [];
    }

    build(cell, tex) {
        this.clear();
        this.ensureMaterial(tex);
        this.cell = cell;
        const g = new THREE.Group(); g.name = `interior:${cell.id}`;
        const B = new Builder();
        const ts = cell.ts, H = cell.wallH;
        const wallL = LAYER[cell.wallLayer] ?? S.masonry, floorL = LAYER[cell.floorLayer] ?? S.flag;
        const wt = TINT[cell.wallLayer] || [1, 1, 1], ft = TINT[cell.floorLayer] || [1, 1, 1];
        const org = cell.organic;
        const corner = (x, z) => cell.floorAt(x, z);
        const rnd = mulberry32(cell.id.length * 977 + 13);
        for (let tz = 0; tz < cell.H; tz++) for (let tx = 0; tx < cell.W; tx++) {
            if (!cell.tiles[cell.idx(tx, tz)]) continue;
            const x0 = tx * ts, x1 = x0 + ts, z0 = tz * ts, z1 = z0 + ts;
            const h00 = corner(x0, z0), h10 = corner(x1, z0), h11 = corner(x1, z1), h01 = corner(x0, z1);
            const top = Math.max(h00, h10, h11, h01) + H;
            const cj = (x, z) => org ? jit(x, 1, z) * ts * 0.35 : 0;
            // floor and ceiling
            B.color(...ft);
            B.quad([x0, h01, z1], [x1, h11, z1], [x1, h10, z0], [x0, h00, z0], floorL);
            B.color(...wt.map((v) => v * 0.8));
            if (!cell.open) B.quad([x0, top + cj(x0, z0), z0], [x1, top + cj(x1, z0), z0], [x1, top + cj(x1, z1), z1], [x0, top + cj(x0, z1), z1], wallL);
            // walls on edges that face rock
            B.color(...wt);
            const edges = [[0, -1, [x0, z0], [x1, z0]], [1, 0, [x1, z0], [x1, z1]], [0, 1, [x1, z1], [x0, z1]], [-1, 0, [x0, z1], [x0, z0]]];
            for (const [dx, dz, a, b] of edges) {
                if (cell.tiles[cell.idx(tx + dx, tz + dz)] && tx + dx >= 0 && tz + dz >= 0 && tx + dx < cell.W && tz + dz < cell.H) continue;
                const ya = corner(a[0], a[1]) - 0.4, yb = corner(b[0], b[1]) - 0.4;
                if (cell.open) {   // floating islands: rough rock cliffs hanging under the edge
                    const da = 5 + jit(a[0], 2, a[1]) * 3, db = 5 + jit(b[0], 2, b[1]) * 3;
                    B.quad([a[0], ya + 0.4, a[1]], [a[0] - dx * 0.8, ya - da, a[1] - dz * 0.8], [b[0] - dx * 0.8, yb - db, b[1] - dz * 0.8], [b[0], yb + 0.4, b[1]], wallL);
                    continue;
                }
                if (!org) { B.quad([a[0], ya, a[1]], [b[0], yb, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], wallL); continue; }
                // rough rock: 3 × 3 displaced patches, pushed into the rock by a shared jitter
                const n = 3;
                const P = (u, v) => {
                    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
                    const y = ya + (yb - ya) * u + (top - (ya + (yb - ya) * u)) * v;
                    const push = (u > 0 && u < 1 ? 1 : 0.4) * jit(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4)) * 0.9 + 0.25;
                    return [x + dx * push, y + (v > 0 && v < 1 ? jit(x, y, z) * 0.4 : 0), z + dz * push];
                };
                for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B.quad(P(i / n, j / n), P((i + 1) / n, j / n), P((i + 1) / n, (j + 1) / n), P(i / n, (j + 1) / n), wallL);
            }
        }
        // building walls get beams; halls get roof trusses
        if (cell.kind === 'building' && cell.wallLayer === 'log') {
            for (let x = 2; x < cell.W - 1; x += 3) B.box(x, H - 0.15, cell.H / 2, 0.25, 0.25, cell.H - 2, S.beam);
        }
        for (const p of cell.props) propMesh(B, p, cell, rnd);
        const mesh = new THREE.Mesh(B.geometry(), this.material);
        mesh.receiveShadow = true; mesh.castShadow = false;
        g.add(mesh);
        // animated pieces
        const mk = (build) => { const b = new Builder(); build(b); const m = new THREE.Mesh(b.geometry(), this.material); g.add(m); return m; };
        for (const p of cell.props) {
            if (p.type === 'gate') {
                const m = mk((b) => { for (let i = -3; i <= 3; i++) b.box(i * 0.5, ts * 0.5, 0, 0.1, ts + 1, 0.1, S.iron); b.box(0, ts * 0.85, 0, ts, 0.14, 0.14, S.iron); b.box(0, ts * 0.25, 0, ts, 0.14, 0.14, S.iron); });
                m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot + Math.PI / 2;
                this.animated.push({ kind: 'gate', mesh: m, id: p.gate, y0: p.y, open: 0 });
            } else if (p.type === 'lever') {
                mk((b) => { b.push(); b.translate(p.x, p.y, p.z); b.rotY(p.rot); b.box(0, 1.1, 0.05, 0.4, 0.5, 0.1, S.iron); b.pop(); });
                const m = mk((b) => { b.box(0, 0.25, 0, 0.06, 0.5, 0.06, S.iron); b.color(0.8, 0.2, 0.15); b.box(0, 0.52, 0, 0.12, 0.1, 0.12, S.cloth); });
                m.position.set(p.x + Math.sin(p.rot) * 0.12, p.y + 1.05, p.z + Math.cos(p.rot) * 0.12); m.rotation.order = 'YXZ'; m.rotation.y = p.rot;
                this.animated.push({ kind: 'lever', mesh: m, id: p.gate });
            } else if (p.type === 'dial') {
                const m = mk((b) => { b.push(); b.rotX(Math.PI / 2); b.cylinder(0, -0.06, 0, 0.38, 0.38, 0.12, 6, S.brass, { cap: true }); b.pop(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.color(0.55, 0.8, 1); b.box(Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.07, 0.08, 0.08, 0.02, S.window); } });
                m.position.set(p.x, p.y + 1.4, p.z); m.rotation.order = 'YXZ'; m.rotation.y = p.rot;
                this.animated.push({ kind: 'dial', mesh: m, idx: p.dial, ang: 0 });
            } else if (p.type === 'trap_blades') {
                const m = mk((b) => { b.box(0, -1.6, 0, 0.08, 3.2, 0.08, S.iron); b.push(); b.translate(0, -3.4, 0); b.rotX(Math.PI / 2); b.cylinder(0, -0.04, 0, 0.9, 0.9, 0.08, 16, S.iron, { cap: true }); b.pop(); });
                m.position.set(p.x, p.y + cell.wallH, p.z); m.rotation.order = 'YXZ'; m.rotation.y = p.rot + Math.PI / 2;
                const tr = cell.traps.find((t) => Math.abs(t.x - p.x) < 0.1 && Math.abs(t.z - p.z) < 0.1);
                this.animated.push({ kind: 'blades', mesh: m, trap: tr });
            }
        }
        this.group = g;
        this.scene.add(g);
        this.hemi.intensity = cell.open ? 1.0 : cell.kind === 'building' ? 1.1 : 0.75;
        this.hemi.color.set(cell.kind === 'building' ? 0xffd6a8 : 0x8090a8);
        this.scene.add(this.hemi);
        for (const L of this.lights) this.scene.add(L);
    }

    update(dt, camPos, time) {
        const c = this.cell;
        if (!c) return;
        // nearest lights get the real point lights
        const near = c.lights.filter((l) => l.r > 0).map((l) => ({ l, d: (l.x - camPos.x) ** 2 + (l.z - camPos.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, MAX_LIGHTS);
        this.lights.forEach((L, i) => {
            const n = near[i];
            if (!n) { L.visible = false; return; }
            L.visible = true;
            L.position.set(n.l.x, n.l.y + 0.3, n.l.z);
            L.color.set(n.l.col || c.lightCol || 0xffa860);
            const flick = n.l.fire !== false ? 0.85 + 0.15 * Math.sin(time * 9 + i * 3) * Math.sin(time * 13.7 + i) : 1;
            L.intensity = n.l.i * 30 * flick;
            L.distance = n.l.r * 2.2;
        });
        for (const a of this.animated) {
            if (a.kind === 'gate') { const want = c.state.gates[a.id] ? 1 : 0; a.open += (want - a.open) * Math.min(1, dt * 1.5); a.mesh.position.y = a.y0 + a.open * (c.ts - 0.3); }
            else if (a.kind === 'lever') a.mesh.rotation.x = c.state.gates[a.id] ? 0.7 : -0.7;
            else if (a.kind === 'dial') { const want = c.state.dials[a.idx] / SYMBOLS.length * Math.PI * 2; a.ang += (want - a.ang) * Math.min(1, dt * 6); a.mesh.rotation.z = a.ang; }
            else if (a.kind === 'blades' && a.trap) a.mesh.rotation.z = Math.sin(a.trap.t * 2.4) * 1.2;
        }
    }
}
