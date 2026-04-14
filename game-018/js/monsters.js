/**
 * monsters.js — Monster spawning, AI, and lifecycle.
 *
 * Exports:
 *   initMonsters(scene) → { monsters, update(dt, playerPos), spawnMonster(type, pos) }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    MONSTER_DEFS, COMMON_MONSTER_TYPES, MONSTER_CAP,
    MONSTER_ZONE_MIN, MONSTER_ZONE_MAX,
    SPAWN_INTERVAL, BOSS_SPAWN_INTERVAL, VILLAGE_RADIUS,
} from './config.js';
import { playMonsterHit, playMonsterDie, playPlayerHurt, playMonsterGrunt } from './sounds.js';

// Reusable quaternion for billboard calculations (avoids per-frame allocation)
const _invParentQ = new THREE.Quaternion();

// ============================================================
// Procedural monster generator
// ============================================================

const _PROC_PALETTES = [
    // [bodyColor, eyeColor, accentColor]
    [0x44cc44, 0xff2222, 0x228822],   // green slimey
    [0xcc4422, 0xffee00, 0x882211],   // red fiery
    [0x4466cc, 0xffffff, 0x224488],   // blue icy
    [0xaa44cc, 0x00ffcc, 0x661188],   // purple void
    [0xcc9922, 0xff4400, 0x886600],   // golden desert
    [0x228888, 0xffff00, 0x115555],   // teal swamp
    [0xdd2277, 0x00ffff, 0x881144],   // pink arcane
    [0x886644, 0xff8800, 0x553311],   // brown earthy
    [0x55aadd, 0xff2299, 0x224466],   // sky blue
    [0xcc6622, 0x88ff00, 0x774411],   // orange beast
];

/**
 * generateProceduralMonster(seed) → def object compatible with MONSTER_DEFS entries.
 *
 * seed (0–1): controls overall power tier (0 = weak, 1 = powerful).
 * Returns a def with: label, color, hp, atk, speed, xp, gold, drops, scale,
 *   plus procedural visual flags: hasHorns, hasWings, hasTail, armCount, legCount.
 */
export function generateProceduralMonster(seed) {
    const rng = _makeRng(seed * 9999 + 137);

    // Power tier 0–1
    const tier = seed;

    // Pick palette
    const pal = _PROC_PALETTES[Math.floor(rng() * _PROC_PALETTES.length)];

    // Stats scale with tier
    const hp    = Math.round(20 + tier * 180 + rng() * 40);
    const atk   = Math.round(5  + tier * 35  + rng() * 8);
    const speed = 2.5 + (1 - tier) * 2.5 + rng() * 1.5;   // weaker = faster
    const scale = 0.5 + tier * 1.0 + rng() * 0.3;
    const xp    = Math.round(hp * 0.4 + atk * 1.5);
    const gold  = Math.round(hp * 0.07 + rng() * 6);

    // Visual features — independent rolls, all features have meaningful presence
    const hasHorns = rng() > 0.3;                          // 70% chance
    const hasWings = tier > 0.45 && rng() > 0.4;           // 60% of mid+ tier
    const hasTail  = rng() > 0.25;                         // 75% chance

    // Arms: always 2 or 4, never 0 — monsters should look like creatures not blobs
    const armCount = rng() > 0.45 ? 4 : 2;

    // Legs: 2 or 4, with a small chance of none (slithering/floating types)
    const legRoll  = rng();
    const legCount = legRoll > 0.8 ? 0 : (legRoll > 0.4 ? 4 : 2);

    // Build a readable label from palette + tier
    const prefixes = ['Shadow', 'Feral', 'Cursed', 'Dire', 'Vile', 'Corrupt', 'Ancient', 'Wild'];
    const suffixes = ['Brute', 'Beast', 'Creeper', 'Fiend', 'Lurker', 'Horror', 'Spawn', 'Ghoul'];
    const label = `${prefixes[Math.floor(rng() * prefixes.length)]} ${suffixes[Math.floor(rng() * suffixes.length)]}`;

    return {
        label,
        color:     pal[0],
        eyeColor:  pal[1],
        accentColor: pal[2],
        hp, atk, speed, scale,
        xp, gold,
        drops: {
            wood:  rng() > 0.6 ? Math.floor(rng() * 3) : 0,
            stone: rng() > 0.6 ? Math.floor(rng() * 3) : 0,
            iron:  rng() > 0.7 ? Math.floor(rng() * 2) : 0,
            herbs: rng() > 0.6 ? Math.floor(rng() * 3) : 0,
        },
        minZone:    tier * 25,
        // Visual flags
        hasHorns, hasWings, hasTail, armCount, legCount,
        isProc: true,
    };
}

// Simple deterministic RNG (xorshift32)
function _makeRng(seed) {
    let s = (Math.floor(seed) >>> 0) || 1234567;  // avoid zero seed
    return function() {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        return ((s >>> 0) / 0xFFFFFFFF);
    };
}

// ---- Shared skin texture generator (also exported for dungeon.js) ----

const _SKIN_STYLES = ['scales', 'spots', 'stripes', 'cracked', 'fur'];

export function makeSkinTexture(baseColor, accentColor, style) {
    const SIZE = 64;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const br = (baseColor >> 16) & 0xff;
    const bg = (baseColor >> 8)  & 0xff;
    const bb =  baseColor        & 0xff;
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const ar = (accentColor >> 16) & 0xff;
    const ag = (accentColor >> 8)  & 0xff;
    const ab =  accentColor        & 0xff;
    const baseLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
    const markLight = baseLum < 128;
    const _mark  = a => markLight ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    const _accent = a => `rgba(${ar},${ag},${ab},${a})`;

    if (style === 'scales') {
        const rows = 7, cols = 5;
        const tw = SIZE / cols, th = SIZE / rows;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const ox = (row % 2) * tw * 0.5;
                const x = col * tw + ox, y = row * th;
                ctx.fillStyle = _mark(0.55);
                ctx.beginPath();
                ctx.ellipse(x + tw*0.5, y + th*0.55, tw*0.44, th*0.46, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = _accent(0.5);
                ctx.beginPath();
                ctx.ellipse(x + tw*0.5, y + th*0.45, tw*0.28, th*0.30, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = _mark(0.3);
                ctx.beginPath();
                ctx.arc(x + tw*0.4, y + th*0.35, tw*0.08, 0, Math.PI*2);
                ctx.fill();
            }
        }
    } else if (style === 'spots') {
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * SIZE, y = Math.random() * SIZE;
            const r = 3 + Math.random() * 6;
            ctx.fillStyle = _accent(0.7);
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = _mark(0.4);
            ctx.beginPath(); ctx.arc(x, y, r*0.45, 0, Math.PI*2); ctx.fill();
        }
    } else if (style === 'stripes') {
        const count = 4 + Math.floor(Math.random() * 3);
        const sw = SIZE / count;
        for (let i = 0; i < count; i += 2) {
            ctx.fillStyle = _accent(0.65);
            ctx.fillRect(i * sw, 0, sw * 0.75, SIZE);
            ctx.fillStyle = _mark(0.25);
            ctx.fillRect(i * sw, 0, 2, SIZE);
        }
    } else if (style === 'cracked') {
        ctx.fillStyle = _mark(0.12);
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(Math.random()*SIZE, Math.random()*SIZE, 8+Math.random()*10, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.strokeStyle = _mark(0.7); ctx.lineWidth = 1.2;
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            let cx = Math.random()*SIZE, cy = Math.random()*SIZE;
            ctx.moveTo(cx, cy);
            for (let j = 0; j < 5; j++) {
                cx += (Math.random()-0.5)*14; cy += (Math.random()-0.5)*14;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }
    } else { // fur
        for (let i = 0; i < 140; i++) {
            const x = Math.random()*SIZE, y = Math.random()*SIZE;
            ctx.strokeStyle = i % 3 === 0 ? _accent(0.6) : _mark(0.35);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random()-0.5)*5, y - 2 - Math.random()*4);
            ctx.stroke();
        }
    }

    // Edge shading for roundness
    const grad = ctx.createRadialGradient(SIZE*0.5, SIZE*0.4, SIZE*0.1, SIZE*0.5, SIZE*0.5, SIZE*0.7);
    grad.addColorStop(0, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// Build mesh for a procedurally-generated monster def
function _buildProceduralMesh(def) {
    const s     = def.scale;
    const group = new THREE.Group();

    const styleIdx = def.color % _SKIN_STYLES.length;
    const skinTex  = makeSkinTexture(def.color, def.accentColor, _SKIN_STYLES[styleIdx]);

    // color 0xffffff so the canvas texture isn't darkened by material tint
    const bodyMat   = new THREE.MeshLambertMaterial({ color: 0xffffff, map: skinTex, transparent: true });
    const eyeMat    = new THREE.MeshBasicMaterial({ color: def.eyeColor });
    const accentMat = new THREE.MeshLambertMaterial({ color: def.accentColor });

    // --- Body ---
    const bodyH = 0.9 * s;
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 * s, bodyH, 0.7 * s),
        bodyMat.clone()
    );
    body.position.y = bodyH * 0.55 + (def.legCount > 0 ? 0.35 * s : 0);
    body.name = 'body';
    body.castShadow = true;
    group.add(body);

    const bodyTopY = body.position.y + bodyH * 0.5;

    // --- Head ---
    const headSize = 0.42 * s;
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(headSize * 1.1, headSize, headSize * 1.0),
        bodyMat.clone()
    );
    head.position.set(0, bodyTopY + headSize * 0.55, -0.05 * s);
    group.add(head);

    const headTopY = head.position.y + headSize * 0.5;

    // --- Eyes ---
    for (const ox of [-0.12 * s, 0.12 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 6, 6), eyeMat);
        eye.position.set(ox, head.position.y, head.position.z - headSize * 0.5 - 0.02);
        group.add(eye);
    }

    // --- Horns ---
    if (def.hasHorns) {
        const hornGeo = new THREE.ConeGeometry(0.07 * s, 0.35 * s, 5);
        for (const ox of [-0.12 * s, 0.12 * s]) {
            const horn = new THREE.Mesh(hornGeo, accentMat.clone());
            horn.position.set(ox, headTopY + 0.15 * s, head.position.z);
            horn.rotation.z = ox < 0 ? 0.25 : -0.25;
            group.add(horn);
        }
    }

    // --- Tail ---
    if (def.hasTail) {
        const tailGeo = new THREE.CylinderGeometry(0.06 * s, 0.02 * s, 0.6 * s, 5);
        const tail = new THREE.Mesh(tailGeo, accentMat.clone());
        tail.position.set(0, body.position.y - 0.05 * s, 0.45 * s);
        tail.rotation.x = 0.7;
        tail.userData.isTail = true;
        group.add(tail);
    }

    // --- Arms ---
    if (def.armCount > 0) {
        const armH = 0.5 * s;
        const armGeo = new THREE.CylinderGeometry(0.07 * s, 0.05 * s, armH, 5);
        const armYOffsets = def.armCount === 4 ? [0, -0.2 * s] : [0];
        for (const yOff of armYOffsets) {
            for (const side of [-1, 1]) {
                const arm = new THREE.Mesh(armGeo, bodyMat.clone());
                arm.position.set(side * (0.5 * s + 0.06 * s), body.position.y + yOff, 0);
                arm.rotation.z = side * 0.6;
                arm.castShadow = true;
                group.add(arm);
            }
        }
    }

    // --- Legs ---
    if (def.legCount > 0) {
        const legH = 0.35 * s;
        const legGeo = new THREE.CylinderGeometry(0.09 * s, 0.06 * s, legH, 5);
        const legXPositions = def.legCount === 4
            ? [-0.22 * s, -0.08 * s, 0.08 * s, 0.22 * s]
            : [-0.2 * s, 0.2 * s];
        for (const lx of legXPositions) {
            const leg = new THREE.Mesh(legGeo, bodyMat.clone());
            leg.position.set(lx, legH * 0.5, 0);
            group.add(leg);
        }
    }

    // --- Wings ---
    // Each wing uses a pivot Group placed at the shoulder so rotation.z flaps from the root.
    // The geometry is offset outward from the pivot so it extends away from the body.
    if (def.hasWings) {
        const wingW = 0.85 * s;   // half-span length
        const wingGeo = new THREE.BoxGeometry(wingW, 0.05 * s, 0.5 * s);
        const wingMat = new THREE.MeshLambertMaterial({
            color: def.accentColor,
            transparent: true, opacity: 0.82,
        });
        const shoulderX = 0.38 * s;   // flush with body edge
        const shoulderY = body.position.y + 0.15 * s;
        for (const sx of [-1, 1]) {
            // Pivot sits at the shoulder joint
            const pivot = new THREE.Group();
            pivot.position.set(sx * shoulderX, shoulderY, 0.05 * s);
            pivot.rotation.z = sx * 0.35;   // resting angle
            pivot.userData.isWing = true;

            // Geometry offset so its inner edge is at the pivot (x=0 in pivot space)
            const wingMesh = new THREE.Mesh(wingGeo, wingMat.clone());
            wingMesh.position.set(sx * wingW * 0.5, 0, 0);  // extends outward
            pivot.add(wingMesh);
            group.add(pivot);
        }
    }

    // Top of the creature: head top + horn tip if present
    const creatureTopY = def.hasHorns
        ? headTopY + 0.15 * s + 0.35 * s   // horn centre + half horn height
        : headTopY;

    _addHpBar(group, s, creatureTopY);
    return group;
}

// ---- Monster attack arc (swish) ----
function _buildMonsterArcMesh() {
    const segments  = 12;
    const range     = 2.2;
    const halfAngle = Math.PI * 0.4;  // ~72° wide swipe arc
    const vertices  = [];
    const indices   = [];

    vertices.push(0, 0.05, 0);  // centre

    for (let i = 0; i <= segments; i++) {
        const t   = i / segments;
        const ang = -halfAngle + t * halfAngle * 2;
        vertices.push(Math.sin(ang) * range, 0.05, Math.cos(ang) * range);
    }
    for (let i = 0; i < segments; i++) indices.push(0, i + 1, i + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return mesh;
}

// Pre-build shared geometries per monster type (materials built fresh per instance for texture)
const _geos = {};
for (const [type, def] of Object.entries(MONSTER_DEFS)) {
    const s = def.scale;
    _geos[type] = {
        body: new THREE.BoxGeometry(0.8 * s, 0.9 * s, 0.8 * s),
        eye:  new THREE.SphereGeometry(0.08 * s, 6, 6),
    };
}

const _SKIN_STYLE_MAP = {
    slime:  'spots',
    goblin: 'stripes',
    troll:  'cracked',
    wolf:   'fur',
};

// Build single monster mesh — skeleton and dragon get special meshes
function _buildMonsterMesh(type, procDef) {
    if (procDef)             return _buildProceduralMesh(procDef);
    if (type === 'skeleton') return _buildSkeletonMesh();
    if (type === 'dragon')   return _buildDragonMesh();

    const def   = MONSTER_DEFS[type];
    const s     = def.scale;
    const group = new THREE.Group();

    // Apply procedural skin texture if we have a skin style for this type
    const skinStyle = _SKIN_STYLE_MAP[type];
    let bodyMat;
    if (skinStyle && def.accentColor != null) {
        const skinTex = makeSkinTexture(def.color, def.accentColor, skinStyle);
        bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: skinTex, transparent: true });
    } else {
        bodyMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true });
    }

    const body = new THREE.Mesh(_geos[type].body, bodyMat);
    body.name = 'body';
    body.position.y = 0.45 * s;
    body.castShadow = true;
    group.add(body);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    for (const ox of [-0.15 * s, 0.15 * s]) {
        const eye = new THREE.Mesh(_geos[type].eye, eyeMat);
        eye.position.set(ox, 0.6 * s, -0.4 * s);
        group.add(eye);
    }

    _addHpBar(group, s, 0.9 * s);  // body top = 0.45s centre + 0.45s half-height
    return group;
}

function _addHpBar(group, s, topY) {
    const hpBarGeo = new THREE.PlaneGeometry(0.8 * s, 0.1 * s);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
    const hpBar    = new THREE.Mesh(hpBarGeo, hpBarMat);
    // topY is the highest point of the creature geometry; bar floats 0.3 units above it
    hpBar.position.y = (topY ?? (1.0 * s)) + 0.3;
    hpBar.name = 'hpBar';
    group.userData.hpBar = hpBar;
    group.add(hpBar);
}

function _buildSkeletonMesh() {
    const def   = MONSTER_DEFS.skeleton;
    const s     = def.scale;
    const group = new THREE.Group();
    const boneMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true });

    // Ribcage body (thin, taller box)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.7 * s, 0.25 * s), boneMat.clone());
    torso.position.y = 0.55 * s;
    torso.name = 'body';
    torso.castShadow = true;
    group.add(torso);

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.18 * s, 0.22 * s), boneMat.clone());
    pelvis.position.y = 0.18 * s;
    pelvis.name = 'body';
    group.add(pelvis);

    // Skull
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.38 * s, 0.35 * s), boneMat.clone());
    skull.position.y = 1.05 * s;
    group.add(skull);

    // Glowing eye sockets
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    for (const ox of [-0.1 * s, 0.1 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 5, 5), eyeMat);
        eye.position.set(ox, 1.08 * s, -0.18 * s);
        group.add(eye);
    }

    // Arm bones (two thin boxes on sides)
    for (const ox of [-0.38 * s, 0.38 * s]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.55 * s, 0.1 * s), boneMat.clone());
        arm.position.set(ox, 0.5 * s, 0);
        group.add(arm);
    }

    _addHpBar(group, s, 1.05 * s + 0.19 * s);  // skull centre + half skull height
    return group;
}

function _buildDragonMesh() {
    const def   = MONSTER_DEFS.dragon;
    const s     = def.scale;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true });
    const scaleMat = new THREE.MeshLambertMaterial({ color: 0x881100 });
    const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xffee00 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.8 * s, 1.6 * s), bodyMat.clone());
    body.position.y = 0.7 * s;
    body.name = 'body';
    body.castShadow = true;
    group.add(body);

    // Neck + head
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.6 * s, 0.4 * s), bodyMat.clone());
    neck.position.set(0, 1.3 * s, -0.65 * s);
    neck.rotation.x = -0.4;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.45 * s, 0.7 * s), bodyMat.clone());
    head.position.set(0, 1.7 * s, -1.1 * s);
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.22 * s, 0.4 * s), scaleMat.clone());
    snout.position.set(0, 1.6 * s, -1.5 * s);
    group.add(snout);

    // Eyes
    for (const ox of [-0.18 * s, 0.18 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 6, 6), eyeMat);
        eye.position.set(ox, 1.82 * s, -1.15 * s);
        group.add(eye);
    }

    // Wings (flat planes angled out)
    const wingGeo = new THREE.BoxGeometry(1.5 * s, 0.06 * s, 0.9 * s);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x992200, transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeo, wingMat.clone());
        wing.position.set(sx * 1.1 * s, 1.0 * s, 0.1 * s);
        wing.rotation.z = sx * 0.45;
        wing.userData.isWing = true;
        group.add(wing);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.25 * s, 1.0 * s), bodyMat.clone());
    tail.position.set(0, 0.6 * s, 1.1 * s);
    tail.rotation.x = 0.25;
    group.add(tail);

    _addHpBar(group, s, 1.7 * s + 0.225 * s);  // head centre + half head height
    group.userData.wingTimer = 0;
    return group;
}

// Monster class
class Monster {
    /**
     * @param {THREE.Scene} scene
     * @param {string} type  — key from MONSTER_DEFS, or 'proc' for procedural
     * @param {THREE.Vector3} pos
     * @param {object|null} procDef — procedural def from generateProceduralMonster(), or null
     */
    constructor(scene, type, pos, procDef = null) {
        this.type     = type;
        this.def      = procDef ?? MONSTER_DEFS[type];
        this.hp       = this.def.hp;
        this.maxHp    = this.def.hp;
        this.alive    = true;
        this.scene    = scene;
        this.atkCd    = 0;
        this.flashTimer = 0;
        this.dying    = false;
        this.deathTimer = 0;
        this.state    = 'patrol';  // 'patrol' | 'chase' | 'attack'
        this.aggroRange = 22 + Math.random() * 14;  // 22–36, varies per monster
        this.loseRange  = 45;
        this.arcMesh  = null;
        this.arcTimer = 0;

        // Knockback velocity (XZ plane)
        this.knockVx = 0;
        this.knockVz = 0;

        // Patrol state — orbit a fixed home point with slight variation
        this.homePos     = pos.clone();
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolRadius = 4 + Math.random() * 6;
        this.patrolSpeed  = 0.35 + Math.random() * 0.25;  // angular speed rad/s
        // Each monster pauses occasionally
        this.patrolPauseTimer = 0;
        this.patrolPauseDur   = 0;
        // Small wander drift so orbits don't look perfectly circular
        this.wanderAngle = 0;

        this.mesh = _buildMonsterMesh(type, procDef);
        this.mesh.position.copy(pos);
        this.mesh.position.y = 0;
        scene.add(this.mesh);
    }

    takeDamage(amount, fromPos) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - amount);

        // Update HP bar
        const pct = this.hp / this.maxHp;
        const bar  = this.mesh.userData.hpBar;
        if (bar) {
            bar.scale.x = pct;
            bar.position.x = -(1 - pct) * 0.4 * this.def.scale;
            const col = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffaa00 : 0xee2222;
            bar.material.color.setHex(col);
        }

        playMonsterHit();
        playMonsterGrunt(this.def.scale);

        // Knockback — push away from attacker
        if (fromPos) {
            const kx = this.mesh.position.x - fromPos.x;
            const kz = this.mesh.position.z - fromPos.z;
            const klen = Math.sqrt(kx * kx + kz * kz) || 1;
            const force = 4.5 / (this.def.scale || 1);  // lighter monsters fly further
            this.knockVx = (kx / klen) * force;
            this.knockVz = (kz / klen) * force;
        }

        // Aggro — if patrolling, snap to chase
        if (this.state === 'patrol') this.state = 'chase';

        // Flash white
        this.flashTimer = 0.14;
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) bodyMesh.material.color.setHex(0xffffff);

        events.emit('message', `Hit ${this.def.label} for ${amount} dmg!`, '#ffcc88');

        if (this.hp <= 0) this._die();
    }

    _die() {
        this.alive = false;
        this.dying = true;
        this.deathTimer = 0.6;
        playMonsterDie();
        if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
        this.arcTimer = 0;

        // Rewards (immediate — don't delay feedback)
        state.addXp(this.def.xp);
        state.addGold(this.def.gold);
        events.emit('playerGoldChanged', state.gold);

        for (const [res, amt] of Object.entries(this.def.drops)) {
            if (amt > 0) state.addResource(res, amt);
        }

        const dropStr = Object.entries(this.def.drops)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');

        events.emit('message',
            `${this.def.label} slain! +${this.def.xp} XP, +${this.def.gold} gold${dropStr ? ', +' + dropStr : ''}.`,
            this.def.isBoss ? '#ffcc00' : '#88ddff'
        );
        events.emit('monsterDied', this.def, this.mesh.position.clone());
        events.emit('monsterKilled', this.type);  // quest tracking
    }

    updateDeath(dt) {
        this.deathTimer -= dt;
        const progress = Math.max(0, 1 - this.deathTimer / 0.6);
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) {
            bodyMesh.material.opacity = 1 - progress;
            bodyMesh.material.color.setHex(this.def.color);
        }
        this.mesh.scale.setScalar(1 - progress * 0.4);
        if (this.deathTimer <= 0) {
            this.scene.remove(this.mesh);
            this.dying = false;
        }
    }

    update(dt, playerPos, camera) {
        if (!this.alive) return;

        const dist = this.mesh.position.distanceTo(playerPos);

        // ---- State machine ----
        if (this.state === 'patrol') {
            if (dist < this.aggroRange) {
                // Spotted the player — give a short delay before full chase so it feels reactive
                this.state = 'chase';
            } else {
                this._updatePatrol(dt);
            }
        } else if (this.state === 'chase') {
            if (dist > this.loseRange) {
                // Lost the player — return home and resume patrol
                this.state = 'patrol';
                this.patrolPauseTimer = 0.8;  // short pause before resuming route
            } else {
                this._updateChase(dt, playerPos);
                if (dist < 1.6) this.state = 'attack';
            }
        } else if (this.state === 'attack') {
            if (dist > 2.5) { this.state = 'chase'; return; }

            // Always face player while attacking
            const dir2 = new THREE.Vector3()
                .subVectors(playerPos, this.mesh.position)
                .setY(0)
                .normalize();
            this.mesh.rotation.y = Math.atan2(dir2.x, dir2.z) + Math.PI;

            this.atkCd -= dt;
            if (this.atkCd <= 0) {
                this.atkCd = 1.2 + Math.random() * 0.8;
                const dmg  = this.def.atk + Math.floor(Math.random() * 5);
                state.takeDamage(dmg);
                playPlayerHurt();
                events.emit('message', `${this.def.label} hit you for ${dmg} damage!`, '#ff8888');

                // Spawn attack swish arc
                if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
                this.arcMesh = _buildMonsterArcMesh();
                this.arcMesh.position.set(
                    this.mesh.position.x,
                    this.mesh.position.y + 0.05,
                    this.mesh.position.z
                );
                this.arcMesh.rotation.y = Math.atan2(dir2.x, dir2.z);
                this.scene.add(this.arcMesh);
                this.arcTimer = 0.22;
            }
        }

        // ---- Knockback decay ----
        if (this.knockVx !== 0 || this.knockVz !== 0) {
            const decay = Math.exp(-12 * dt);  // fast exponential falloff
            const nx = this.mesh.position.x + this.knockVx * dt;
            const nz = this.mesh.position.z + this.knockVz * dt;
            const dv = Math.sqrt(nx * nx + nz * nz);
            if (dv >= VILLAGE_RADIUS * 0.5) {
                this.mesh.position.x = nx;
                this.mesh.position.z = nz;
            }
            this.knockVx *= decay;
            this.knockVz *= decay;
            if (Math.abs(this.knockVx) < 0.05 && Math.abs(this.knockVz) < 0.05) {
                this.knockVx = 0; this.knockVz = 0;
            }
        }

        // Wing flap animation (dragon + procedural winged monsters)
        if (this.type === 'dragon' || (this.def.isProc && this.def.hasWings)) {
            this.mesh.userData.wingTimer = (this.mesh.userData.wingTimer || 0) + dt * 3;
            for (const child of this.mesh.children) {
                if (child.userData.isWing) {
                    const side = child.position.x > 0 ? 1 : -1;
                    child.rotation.z = side * (0.35 + Math.sin(this.mesh.userData.wingTimer) * 0.28);
                }
            }
        }

        // Billboard HP bar to always face camera (world-space quaternion copy)
        const bar = this.mesh.userData.hpBar;
        if (bar && camera) {
            // Undo the parent group's world rotation so the bar faces the camera in world space
            this.mesh.getWorldQuaternion(_invParentQ).invert();
            bar.quaternion.multiplyQuaternions(_invParentQ, camera.quaternion);
        }

        // Restore flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                const bodyMesh = this.mesh.children.find(c => c.name === 'body');
                if (bodyMesh) bodyMesh.material.color.setHex(this.def.color);
            }
        }

        // Fade out attack arc
        if (this.arcTimer > 0) {
            this.arcTimer -= dt;
            if (this.arcMesh) {
                this.arcMesh.material.opacity = Math.max(0, 0.55 * (this.arcTimer / 0.22));
                if (this.arcTimer <= 0) {
                    this.scene.remove(this.arcMesh);
                    this.arcMesh = null;
                }
            }
        }
    }

    // Orbit home position, pause occasionally, wander slightly
    _updatePatrol(dt) {
        // Pausing
        if (this.patrolPauseTimer > 0) {
            this.patrolPauseTimer -= dt;
            return;
        }

        // Advance orbit angle
        this.patrolAngle += this.patrolSpeed * dt;

        // Wander: slowly shift the orbit center so routes feel organic, not perfect circles
        this.wanderAngle += dt * 0.18;
        const wx = Math.cos(this.wanderAngle) * 2.5;
        const wz = Math.sin(this.wanderAngle * 0.7) * 2.5;

        const tx = this.homePos.x + wx + Math.cos(this.patrolAngle) * this.patrolRadius;
        const tz = this.homePos.z + wz + Math.sin(this.patrolAngle) * this.patrolRadius;

        const dx = tx - this.mesh.position.x;
        const dz = tz - this.mesh.position.z;
        const d  = Math.sqrt(dx * dx + dz * dz) || 1;

        // Patrol at ~40% of combat speed
        const spd = this.def.speed * 0.4 * dt;
        const nx  = this.mesh.position.x + (dx / d) * spd;
        const nz  = this.mesh.position.z + (dz / d) * spd;

        const distToVillage = Math.sqrt(nx * nx + nz * nz);
        if (distToVillage >= VILLAGE_RADIUS * 0.5) {
            this.mesh.position.x = nx;
            this.mesh.position.z = nz;
            this.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
        }

        // Random pause every ~6–12 s (checked once per orbit completion)
        if (Math.random() < dt * 0.08) {
            this.patrolPauseTimer = 0.8 + Math.random() * 1.8;
        }
    }

    // Move directly toward player, stay out of village
    _updateChase(dt, playerPos) {
        const dir = new THREE.Vector3()
            .subVectors(playerPos, this.mesh.position)
            .setY(0)
            .normalize();

        const speed = this.def.speed * dt;
        const nx    = this.mesh.position.x + dir.x * speed;
        const nz    = this.mesh.position.z + dir.z * speed;

        const distToVillage = Math.sqrt(nx * nx + nz * nz);
        if (distToVillage >= VILLAGE_RADIUS * 0.5) {
            this.mesh.position.x = nx;
            this.mesh.position.z = nz;
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
        }
    }
}

// ---- Init ----
export function initMonsters(scene) {
    const monsters = [];
    let spawnTimer = 0;
    let bossTimer  = 0;
    let bossAlive  = false;

    function spawnMonster(type, pos) {
        let procDef = null;
        let def;

        if (type === 'proc') {
            // Generate a procedural monster with tier based on distance from village
            const tier = pos
                ? Math.min(1, Math.max(0, (pos.length() - MONSTER_ZONE_MIN) / (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN)))
                : Math.random();
            procDef = generateProceduralMonster(tier * 0.7 + Math.random() * 0.3);
            def = procDef;
        } else {
            def = MONSTER_DEFS[type];
        }

        if (!pos) {
            const minR  = Math.max(MONSTER_ZONE_MIN, def.minZone ?? 0);
            const maxR  = MONSTER_ZONE_MAX;
            const angle = Math.random() * Math.PI * 2;
            const r     = minR + Math.random() * (maxR - minR);
            pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        }
        const m = new Monster(scene, type, pos, procDef);
        monsters.push(m);
        if (type === 'dragon') bossAlive = true;
        return m;
    }

    // Track boss death
    events.on('monsterKilled', (type) => {
        if (type === 'dragon') bossAlive = false;
    });

    // Initial spawn — a few close to village edge, rest farther out
    const closeTypes = ['slime', 'slime', 'goblin', 'proc', 'wolf'];
    for (let i = 0; i < closeTypes.length; i++) {
        const angle = (i / closeTypes.length) * Math.PI * 2;
        const r     = VILLAGE_RADIUS + 4 + Math.random() * 6;
        const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        spawnMonster(closeTypes[i], pos);
    }
    // More in the general zone (no bosses on initial spawn) — 40% procedural
    for (let i = 0; i < 10; i++) {
        const useProc = Math.random() < 0.4;
        if (useProc) {
            spawnMonster('proc');
        } else {
            const type = COMMON_MONSTER_TYPES[Math.floor(Math.random() * COMMON_MONSTER_TYPES.length)];
            spawnMonster(type);
        }
    }

    function update(dt, playerPos, camera) {
        for (const m of monsters) {
            if (m.dying) { m.updateDeath(dt); continue; }
            if (m.alive) m.update(dt, playerPos, camera);
        }

        const aliveCount = monsters.filter(m => m.alive).length;
        if (aliveCount < MONSTER_CAP) {
            spawnTimer += dt;
            if (spawnTimer >= SPAWN_INTERVAL) {
                spawnTimer = 0;
                // 35% chance to spawn a procedural monster
                if (Math.random() < 0.35) {
                    spawnMonster('proc');
                } else {
                    const type = COMMON_MONSTER_TYPES[Math.floor(Math.random() * COMMON_MONSTER_TYPES.length)];
                    spawnMonster(type);
                }
            }
        }

        // Boss dragon spawns periodically if not alive
        if (!bossAlive) {
            bossTimer += dt;
            if (bossTimer >= BOSS_SPAWN_INTERVAL) {
                bossTimer = 0;
                spawnMonster('dragon');
                events.emit('message', 'A Dragon has been spotted in the distance!', '#ff4400');
            }
        }
    }

    return { monsters, update, spawnMonster };
}
