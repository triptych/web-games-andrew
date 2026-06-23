/**
 * dungeon.js — Tile grid data + level mesh generation (Phase 4 visual polish).
 *
 * Phase 4 additions:
 *  - Procedural canvas-generated wall/floor textures (stone block grid + noise grunge)
 *  - Per-face shading via separate materials for N/S/E/W wall faces
 *  - Wall variant flags: 'crack', 'moss', 'arch', 'torch' carried in variantMap
 *  - Torch sconces: emissive quad sprites + animated PointLight flicker
 *  - Floor/ceiling variety: alternate material on deterministic hash-selected tiles
 *  - Level theme: LEVEL_THEMES config applies palette tints, fog, ambient intensity
 *
 * World mapping: tile (x, z) → worldX = x * TILE_SIZE, worldZ = z * TILE_SIZE
 * Grid lies in the XZ plane; +Z runs "south" (matches DIRS in config.js).
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { TILE_SIZE, WALL_HEIGHT, COLORS, SHADING, LEVEL_THEMES,
         LEVEL_1_LOOT, LEVEL_2_LOOT, LEVEL_3_LOOT } from './config.js';

// ============================================================
// Level data
// ============================================================

// Hand-authored Level 1.
// '#' wall  '.' floor  'S' start  '>' stairs  'M' monster spawn  'C' chest/loot
const LEVEL_1 = [
    '################',
    '#S....#.....>C.#',
    '#.###M#.###.##.#',
    '#C#...#...#..C.#',
    '#.#.#####.#.##.#',
    '#...#..M..#M#..#',
    '###.#.###.#.#.##',
    '#M..#.#.#.#.#C.#',
    '#.###.#.#.#.##.#',
    '#.C...#M..#...C#',
    '################',
];

// Level 2 — Deep Passages (theme 2). Larger, darker, tighter.
const LEVEL_2 = [
    '################',
    '#S..C#......##.#',
    '#.##.#.M###....#',
    '#....#.....C..>#',
    '#.##.#.##.###..#',
    '#M#....#....#..#',
    '#.####.#.M#.#..#',
    '#......#....#..#',
    '#.M###.######..#',
    '#.....C........#',
    '################',
];

// Level 3 — Cold Depths (theme 3). Tight, monster-dense, leads to win tile.
const LEVEL_3 = [
    '################',
    '#S....#...C.#..#',
    '#.##.##.##.##..#',
    '#....#.M...#...#',
    '#.##.######.##.#',
    '#....#...C..#..#',
    '#.M#.#.###..#..#',
    '#...M#....M.#..#',
    '#####.######...#',
    '#......W.......#',   // 'W' = win tile (crypt heart)
    '################',
];

// Wall variant map: 'x,z:face' → variant string ('crack'|'moss'|'arch'|'torch')
// face: 'N'|'S'|'E'|'W' (the outward-facing side of the wall block)
const LEVEL_1_VARIANTS = {
    // torches — spread around the level on corridor walls
    '6,1:W':  'torch',   // west face of wall col 6, row 1 (corridor junction)
    '6,1:E':  'torch',   // east face opposite
    '6,3:W':  'torch',   // further south
    '10,3:E': 'torch',   // east passage
    // moss — damp lower sections
    '0,3:E':  'moss',
    '15,2:W': 'moss',
    '2,4:W':  'moss',
    '15,3:W': 'moss',
    // crack — scattered throughout
    '9,2:S':  'crack',
    '2,4:E':  'crack',
    '1,6:S':  'crack',   // already confirmed valid
    '8,2:N':  'crack',
    // arch — doorway-like openings
    '6,2:W':  'arch',
    '6,2:E':  'arch',
};

export let grid = [];
export let gridW = 0, gridH = 0;
export let startTile = { x: 1, z: 1 };

let _group = null;

// Active loot map for the current level: 'x,z' → item id string.
let _lootMap = {};

export function lootAt(x, z) { return _lootMap[`${x},${z}`] || null; }

// Remove a loot tile after the player picks it up.
export function consumeLootTile(x, z) {
    const key = `${x},${z}`;
    if (_lootMap[key]) {
        delete _lootMap[key];
        if (z >= 0 && z < gridH && x >= 0 && x < gridW) grid[z][x] = '.';
    }
}

// Level layouts and their associated data by depth.
const LEVELS = [
    { layout: LEVEL_1, loot: LEVEL_1_LOOT },
    { layout: LEVEL_2, loot: LEVEL_2_LOOT },
    { layout: LEVEL_3, loot: LEVEL_3_LOOT },
];

// Torch flicker state: array of { light, flameMat, t, baseIntensity, freq }
let _torches = [];

// ============================================================
// Procedural texture generation
// ============================================================

const TEX_SIZE = 128;

/** Stone-block grid with subtle grunge noise. Returns a THREE.CanvasTexture. */
function _makeStoneTexture(baseR, baseG, baseB, variant) {
    const canvas = document.createElement('canvas');
    canvas.width  = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Brick-pattern mortar lines
    const BLOCK_W = 32, BLOCK_H = 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row <= Math.ceil(TEX_SIZE / BLOCK_H); row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * BLOCK_H);
        ctx.lineTo(TEX_SIZE, row * BLOCK_H);
        ctx.stroke();
        const offset = (row % 2 === 0) ? 0 : BLOCK_W / 2;
        for (let col = 0; col <= Math.ceil(TEX_SIZE / BLOCK_W) + 1; col++) {
            ctx.beginPath();
            ctx.moveTo(col * BLOCK_W + offset, row * BLOCK_H);
            ctx.lineTo(col * BLOCK_W + offset, (row + 1) * BLOCK_H);
            ctx.stroke();
        }
    }

    // Grunge noise — deterministic LCG so texture is stable between loads
    const imageData = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
    const data = imageData.data;
    let lcg = (baseR * 3 + baseG * 7 + baseB * 13 + 12345) | 0;
    function rand() { lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0; return (lcg >>> 0) / 0x100000000; }

    for (let i = 0; i < 400; i++) {
        const px = (rand() * TEX_SIZE) | 0;
        const py = (rand() * TEX_SIZE) | 0;
        const idx = (py * TEX_SIZE + px) * 4;
        const delta = (rand() - 0.5) * 60;
        data[idx]   = Math.max(0, Math.min(255, data[idx]   + delta));
        data[idx+1] = Math.max(0, Math.min(255, data[idx+1] + delta));
        data[idx+2] = Math.max(0, Math.min(255, data[idx+2] + delta));
    }
    ctx.putImageData(imageData, 0, 0);

    // Variant overlays painted on top of the base
    if (variant === 'crack') {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(30, 10); ctx.lineTo(50, 40); ctx.lineTo(44, 70); ctx.lineTo(60, 100); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(80, 20); ctx.lineTo(70, 55); ctx.lineTo(85, 90); ctx.stroke();
    } else if (variant === 'moss') {
        ctx.fillStyle = 'rgba(40,80,30,0.35)';
        ctx.fillRect(0, 0, 20, TEX_SIZE);
        ctx.fillRect(0, 108, TEX_SIZE, 20);
        ctx.fillStyle = 'rgba(50,100,35,0.2)';
        ctx.fillRect(60, 0, 24, 64);
    } else if (variant === 'arch') {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(TEX_SIZE / 2, TEX_SIZE, 42, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,180,140,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(TEX_SIZE / 2, TEX_SIZE, 44, Math.PI, 0); ctx.stroke();
    }
    // 'torch' and 'none' use the base texture only (torch geometry is added separately)

    return _finalizeTexture(canvas);
}

function _finalizeTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function _makeFloorTexture(baseR, baseG, baseB, alt) {
    const canvas = document.createElement('canvas');
    canvas.width  = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const PAVE = 40;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r <= TEX_SIZE; r += PAVE) {
        ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(TEX_SIZE, r); ctx.stroke();
        for (let c = 0; c <= TEX_SIZE; c += PAVE) {
            ctx.beginPath(); ctx.moveTo(c, r); ctx.lineTo(c, r + PAVE); ctx.stroke();
        }
    }

    if (alt) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(30, 30, 18, 12, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(90, 80, 22, 14, 1.1, 0, Math.PI * 2); ctx.fill();
    }

    return _finalizeTexture(canvas);
}

// ============================================================
// Material cache
// ============================================================

const _matCache = new Map();

function _hexToRGB(hex) {
    return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function _applyTint(baseHex, tintHex) {
    return {
        r: Math.round(((baseHex >> 16) & 0xff) * ((tintHex >> 16) & 0xff) / 255),
        g: Math.round(((baseHex >>  8) & 0xff) * ((tintHex >>  8) & 0xff) / 255),
        b: Math.round(( baseHex        & 0xff) * ( tintHex        & 0xff) / 255),
    };
}

/** Returns (cached) MeshStandardMaterial for the given face config. */
function _getMat(face, theme, variant) {
    const key = `${face}:${theme.name}:${variant}`;
    if (_matCache.has(key)) return _matCache.get(key);

    const shadingKey = {
        N: 'wallNorth', S: 'wallSouth', E: 'wallEast', W: 'wallWest',
        floor: 'floor', floorAlt: 'floorAlt', ceil: 'ceiling',
        stairs: 'stairsTile', loot: 'stairsTile', win: 'stairsTile',
    }[face] || 'floor';
    const shade = SHADING[shadingKey];

    let mat;

    if (face === 'stairs') {
        const rgb = _hexToRGB(COLORS.accent);
        mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255),
            roughness: 0.6,
            emissive: new THREE.Color(0x0a2030),
        });
    } else if (face === 'loot') {
        mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.55, 0.42, 0.12),
            roughness: 0.5,
            emissive: new THREE.Color(0x1a1000),
        });
    } else if (face === 'win') {
        mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.6, 0.5, 0.1),
            roughness: 0.4,
            emissive: new THREE.Color(0x2a1800),
            emissiveIntensity: 0.6,
        });
    } else if (face === 'floor' || face === 'floorAlt' || face === 'ceil') {
        const baseTintHex = (face === 'ceil') ? theme.ceilTint : theme.floorTint;
        const baseHex     = (face === 'ceil') ? COLORS.ceiling : COLORS.floor;
        const tinted = _applyTint(baseHex, baseTintHex);
        const r = Math.round(tinted.r * shade);
        const g = Math.round(tinted.g * shade);
        const b = Math.round(tinted.b * shade);
        mat = new THREE.MeshStandardMaterial({
            map: _makeFloorTexture(r, g, b, face === 'floorAlt'),
            roughness: 1.0,
        });
    } else {
        // Wall face (N/S/E/W) — DoubleSide so the plane is visible regardless of normal orientation
        const tinted = _applyTint(COLORS.wall, theme.wallTint);
        const r = Math.round(tinted.r * shade);
        const g = Math.round(tinted.g * shade);
        const b = Math.round(tinted.b * shade);
        mat = new THREE.MeshStandardMaterial({
            map: _makeStoneTexture(r, g, b, variant || 'none'),
            roughness: 0.95,
            side: THREE.DoubleSide,
        });
    }

    _matCache.set(key, mat);
    return mat;
}

// ============================================================
// Torch sconce
// ============================================================

function _addTorch(group, wx, wz, face) {
    // 0.52 pushes just past the face plane (which sits at 0.5 * TILE_SIZE from wall centre)
    const offset = TILE_SIZE * 0.52;
    let sx = wx, sz = wz;
    if (face === 'N') sz -= offset;
    else if (face === 'S') sz += offset;
    else if (face === 'E') sx += offset;
    else if (face === 'W') sx -= offset;
    const sy = WALL_HEIGHT * 0.62;

    // Flame quad
    const flameGeo = new THREE.PlaneGeometry(0.3, 0.4);
    const flameMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(1.0, 0.7, 0.2),
        emissive: new THREE.Color(1.0, 0.55, 0.1),
        emissiveIntensity: 1.8,
        roughness: 1.0,
        side: THREE.DoubleSide,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(sx, sy, sz);
    if (face === 'S') flame.rotation.y = Math.PI;
    else if (face === 'E') flame.rotation.y = -Math.PI / 2;
    else if (face === 'W') flame.rotation.y =  Math.PI / 2;

    // Sconce bracket
    const bracketGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x555050, roughness: 0.9 });
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    bracket.position.set(sx, sy - 0.22, sz);

    // Warm point light
    const light = new THREE.PointLight(0xffa040, 3.5, 8, 2);
    light.position.set(sx, sy + 0.05, sz);

    group.add(flame, bracket, light);

    // LCG seed based on position for desync'd flicker phase
    const seed = (sx * 17 + sz * 31 + face.charCodeAt(0) * 7) | 0;
    let lcg = (seed + 99991) | 0;
    function rand() { lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0; return (lcg >>> 0) / 0x100000000; }

    _torches.push({
        light,
        flameMat,
        t: rand() * 100,
        baseIntensity: 3.5,
        freq: 2.8 + rand() * 1.4,
    });
}

// ============================================================
// Level build
// ============================================================

export function initDungeon() {
    buildLevelByDepth(1);
}

// Build the level for the given depth (1-indexed). Clamps to the available set.
export function buildLevelByDepth(depth) {
    const idx   = Math.max(0, Math.min(depth - 1, LEVELS.length - 1));
    const entry = LEVELS[idx];
    _lootMap = { ...entry.loot };
    buildLevel(entry.layout, LEVEL_1_VARIANTS, depth);
}

export function isWalkable(x, z) {
    if (z < 0 || z >= gridH || x < 0 || x >= gridW) return false;
    const ch = grid[z][x];
    return ch !== '#';   // '#' = wall; everything else is walkable
}

// Remove an 'M' spawn tile after it has been consumed (monster entered combat).
export function clearSpawnTile(x, z) {
    if (z >= 0 && z < gridH && x >= 0 && x < gridW && grid[z][x] === 'M') {
        grid[z][x] = '.';
    }
}

export function tileAt(x, z) {
    if (z < 0 || z >= gridH || x < 0 || x >= gridW) return '#';
    return grid[z][x];
}

export function buildLevel(layout, variantMap, depth) {
    _disposeLevel();
    _torches = [];

    grid  = layout.map(row => row.split(''));
    gridH = grid.length;
    gridW = grid[0].length;

    const theme = LEVEL_THEMES[depth] || LEVEL_THEMES[1];

    // Apply theme fog (scene is a live ESM binding, always defined by the time buildLevel runs)
    scene.fog.color.setHex(theme.fogColor);
    scene.fog.near = theme.fogNear;
    scene.fog.far  = theme.fogFar;

    _group = new THREE.Group();

    const floorGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const ceilGeo  = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

    // One PlaneGeometry per wall face direction (shared across all wall tiles)
    const wallFaceGeos = {
        N: new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
        S: new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
        E: new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
        W: new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
    };

    for (let z = 0; z < gridH; z++) {
        for (let x = 0; x < gridW; x++) {
            const ch = grid[z][x];
            const wx = x * TILE_SIZE;
            const wz = z * TILE_SIZE;

            if (ch === 'S') startTile = { x, z };

            if (ch === '#') {
                _buildWallFaces(x, z, wx, wz, wallFaceGeos, variantMap, theme);
            } else {
                const isAlt = (x * 7 + z * 13) % 5 === 0;
                const floorMat = (ch === '>') ? _getMat('stairs', theme, null)
                               : (ch === 'C') ? _getMat('loot', theme, null)
                               : (ch === 'W') ? _getMat('win', theme, null)
                               : _getMat(isAlt ? 'floorAlt' : 'floor', theme, null);
                const floor = new THREE.Mesh(floorGeo, floorMat);
                floor.rotation.x = -Math.PI / 2;
                floor.position.set(wx, 0, wz);
                _group.add(floor);

                const cAlt = (x * 11 + z * 5) % 7 === 0;
                const ceil = new THREE.Mesh(ceilGeo, _getMat(cAlt ? 'floorAlt' : 'ceil', theme, null));
                ceil.rotation.x = Math.PI / 2;
                ceil.position.set(wx, WALL_HEIGHT, wz);
                _group.add(ceil);
            }
        }
    }

    scene.add(_group);
}

// PlaneGeometry default normal is (0,0,+1). Rotate so the normal points toward the open neighbor.
// N face: open tile is north (z-1), normal must point -Z → ry = Math.PI
// S face: open tile is south (z+1), normal must point +Z → ry = 0
// E face: open tile is east  (x+1), normal must point +X → ry = -Math.PI/2
// W face: open tile is west  (x-1), normal must point -X → ry = +Math.PI/2
const FACE_DEFS = [
    { face: 'N', ndx:  0, ndz: -1, ry: Math.PI,       offX:  0,           offZ: -TILE_SIZE/2 },
    { face: 'S', ndx:  0, ndz:  1, ry: 0,              offX:  0,           offZ:  TILE_SIZE/2 },
    { face: 'E', ndx:  1, ndz:  0, ry: -Math.PI / 2,   offX:  TILE_SIZE/2, offZ:  0           },
    { face: 'W', ndx: -1, ndz:  0, ry:  Math.PI / 2,   offX: -TILE_SIZE/2, offZ:  0           },
];

function _buildWallFaces(x, z, wx, wz, geos, variantMap, theme) {
    for (const { face, ndx, ndz, ry, offX, offZ } of FACE_DEFS) {
        const nx = x + ndx, nz = z + ndz;
        if (nz < 0 || nz >= gridH || nx < 0 || nx >= gridW) continue;
        if (grid[nz][nx] === '#') continue;   // neighbor is wall — face is hidden

        const vKey = `${x},${z}:${face}`;
        const variant = (variantMap && variantMap[vKey]) || 'none';
        const mat = _getMat(face, theme, variant);
        const mesh = new THREE.Mesh(geos[face], mat);
        mesh.position.set(wx + offX, WALL_HEIGHT / 2, wz + offZ);
        mesh.rotation.y = ry;
        _group.add(mesh);

        if (variant === 'torch') {
            _addTorch(_group, wx, wz, face);
        }
    }
}

function _disposeLevel() {
    if (!_group) return;
    scene.remove(_group);
    _group.traverse(obj => { if (obj.isMesh) obj.geometry.dispose(); });
    _group = null;
}

// ============================================================
// Torch flicker update — call from main.js animate() each frame
// ============================================================

export function updateTorches(dt) {
    for (const torch of _torches) {
        torch.t += dt;
        const flicker = 0.82 + 0.18 * Math.sin(torch.t * torch.freq * Math.PI * 2)
                             + 0.08 * Math.sin(torch.t * torch.freq * 1.7 * Math.PI * 2);
        torch.light.intensity = torch.baseIntensity * flicker;
        const g = 0.45 + 0.18 * flicker;
        const b = 0.05 + 0.08 * flicker;
        torch.light.color.setRGB(1.0, g, b);
        torch.flameMat.emissiveIntensity = 1.4 + 0.6 * flicker;
    }
}
