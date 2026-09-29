/**
 * tableView.js — meshes for everything on the table except balls and effects:
 * the glass surface, neon rails, slingshots, pop bumpers, flippers, plunger,
 * bricks, falling pickups, laser bolts and the shield bar.
 *
 * All meshes live in `table` (from scene.js), whose local space IS the
 * simulation's coordinate space: x across, y up the table, z = height.
 *
 * Public API:
 *   initTableView(world)       — build the static table for this world
 *   syncTableView(w, dt, t)    — per-frame: flippers, bricks, pickups, lasers...
 *   hitBrick(id) / hitBumper(id) / hitSling(side) / flipperFlash(side)
 *   brickWorldColor(br)        — THREE.Color for a brick (for matching debris)
 */

import * as THREE from 'three';
import { table } from './scene.js';
import { MAX_LIGHTS, writeLightUniforms } from './lights.js';
import { TABLE, FLIPPER, BRICK_COLORS, PICKUPS, COLORS } from '../config.js';

const glow = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

let surfaceMat;
const bumperViews = [];
const slingViews = [];
const flipperViews = [];
const brickViews = new Map();        // brick id → { mesh, mat, born, punch }
const pickupViews = new Map();
const laserViews = new Map();
let shieldMesh, plungerMesh, laneArrows, gateMesh;
let brickGeo, pickupGeo, laserGeo;
const letterTex = new Map();

// Ball glow positions for the surface shader (filled by balls.js via setBallGlows)
const ballUniform = Array.from({ length: 6 }, () => new THREE.Vector3());
const lightPos = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4());
const lightCol = Array.from({ length: MAX_LIGHTS }, () => new THREE.Color());

// ============================================================
// Build
// ============================================================

export function initTableView(w) {
    buildSurface(w);
    buildDecal();
    buildRails(w);
    buildSlings(w);
    buildBumpers(w);
    buildFlippers();
    buildLane();
    buildShield(w);

    brickGeo = new THREE.BoxGeometry(0.9, 0.46, 0.5);
    brickGeo.translate(0, 0, 0.25);
    pickupGeo = new THREE.CapsuleGeometry(0.26, 0.55, 6, 14);
    pickupGeo.rotateZ(Math.PI / 2);
    laserGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6);
}

function buildSurface(w) {
    // Table outline as a 2D shape: the outer boundary polyline closed along the bottom.
    const shape = new THREE.Shape();
    const pts = w.table.outline;
    shape.moveTo(TABLE.left, -1.2);
    for (const [x, y] of pts) shape.lineTo(x, y);
    shape.lineTo(TABLE.laneOuter, -1.2);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 24);

    surfaceMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime:  { value: 0 },
            uBeat:  { value: 0 },
            uBalls: { value: ballUniform },
            uBallCol: { value: new THREE.Color(0x35f2ff) },
            uL:     { value: lightPos },
            uLC:    { value: lightCol },
        },
        vertexShader: /* glsl */`
            varying vec2 vP;
            void main() {
                vP = position.xy;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime, uBeat;
            uniform vec3 uBalls[6];
            uniform vec3 uBallCol;
            uniform vec4 uL[${MAX_LIGHTS}];
            uniform vec3 uLC[${MAX_LIGHTS}];
            varying vec2 vP;
            void main() {
                vec2 q = vP / 0.9;
                vec2 fw = fwidth(q);
                vec2 g = abs(fract(q - 0.5) - 0.5) / max(fw, 1e-4);
                float line = 1.0 - min(min(g.x, g.y), 1.0);

                vec3 col = mix(vec3(0.05, 0.0, 0.14), vec3(0.02, 0.01, 0.07), smoothstep(0.0, 26.0, vP.y));
                col += vec3(0.35, 0.08, 0.7) * line * (0.28 + 0.12 * uBeat);

                // Travelling scan band up the table.
                float band = exp(-pow(fract(uTime * 0.12) * 34.0 - 3.0 - vP.y, 2.0) * 0.4);
                col += vec3(0.5, 0.1, 0.9) * band * line * 0.8;

                for (int i = 0; i < 6; i++) {
                    if (uBalls[i].z <= 0.0) continue;
                    float d = length(vP - uBalls[i].xy);
                    col += uBallCol * (exp(-d * d * 1.4) * 0.18 + line * exp(-d * 1.1) * 0.6) * uBalls[i].z;
                }
                for (int i = 0; i < ${MAX_LIGHTS}; i++) {
                    if (uL[i].w <= 0.0) continue;
                    float d = length(vP - uL[i].xy);
                    float k = uL[i].w * exp(-d * d / (uL[i].z * uL[i].z));
                    col += uLC[i] * min(k, 1.5) * (0.1 + line * 0.8);
                }
                // Glass thins toward the top so the sun glows through behind the bricks.
                gl_FragColor = vec4(col, mix(0.94, 0.5, smoothstep(10.0, 27.0, vP.y)));
            }
        `,
    });
    const mesh = new THREE.Mesh(geo, surfaceMat);
    mesh.renderOrder = 1;
    table.add(mesh);

}

function makeCanvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

function buildDecal() {
    // "PINBREAK" logo + chevrons painted between the slingshots.
    const tex = makeCanvasTexture(1024, 512, (ctx, W, H) => {
        ctx.clearRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Sun disc with stripes.
        const grd = ctx.createLinearGradient(0, 40, 0, 300);
        grd.addColorStop(0, '#ffd23d');
        grd.addColorStop(1, '#ff2fa8');
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, 250, 150, Math.PI, 0);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = grd;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 6; i++) ctx.fillRect(0, 170 + i * 16, W, 4 + i * 1.6);
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = 'italic 900 150px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = '#ff2fa8';
        ctx.shadowColor = '#ff2fa8';
        for (const b of [40, 20]) { ctx.shadowBlur = b; ctx.fillText('PINBREAK', W / 2, 330); }
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffe9ff';
        ctx.strokeText('PINBREAK', W / 2, 330);
        ctx.font = 'bold 44px "Courier New", monospace';
        ctx.fillStyle = '#35f2ff';
        ctx.shadowColor = '#35f2ff';
        ctx.shadowBlur = 16;
        ctx.fillText('· 1 9 8 6 ·', W / 2, 440);
    });
    const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 2.7),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }),
    );
    decal.position.set(0, 7.6, 0.02);
    decal.renderOrder = 2;
    table.add(decal);

    // Chevrons pointing up at the bumpers.
    const chev = makeCanvasTexture(256, 256, (ctx, W, H) => {
        ctx.strokeStyle = '#35f2ff';
        ctx.lineWidth = 18;
        ctx.shadowColor = '#35f2ff';
        ctx.shadowBlur = 20;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(40, 190); ctx.lineTo(128, 90); ctx.lineTo(216, 190);
        ctx.stroke();
    });
    laneArrows = [];
    const mk = (x, y, s) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s),
            new THREE.MeshBasicMaterial({ map: chev, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.position.set(x, y, 0.03);
        m.renderOrder = 2;
        table.add(m);
        return m;
    };
    for (let i = 0; i < 3; i++) laneArrows.push({ mesh: mk(0, 9.1 + i * 0.5, 0.8), lane: false, i });
    for (let i = 0; i < 5; i++) laneArrows.push({ mesh: mk(TABLE.laneX, 3 + i * 1.6, 1.0), lane: true, i });
}

function tubeAlong(points, radius, color, z) {
    const path = new THREE.CurvePath();
    for (let i = 0; i < points.length - 1; i++) {
        path.add(new THREE.LineCurve3(
            new THREE.Vector3(points[i][0], points[i][1], z),
            new THREE.Vector3(points[i + 1][0], points[i + 1][1], z)));
    }
    const geo = new THREE.TubeGeometry(path, points.length * 3, radius, 8, false);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}

function segMesh(s, radius, color, z) {
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), new THREE.MeshBasicMaterial({ color }));
    cyl.position.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, z);
    cyl.rotation.z = Math.atan2(s.by - s.ay, s.bx - s.ax) - Math.PI / 2;
    g.add(cyl);
    for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), cyl.material);
        cap.position.set(x, y, z);
        g.add(cap);
    }
    return g;
}

function buildRails(w) {
    const outline = [[TABLE.left, TABLE.funnelY], ...w.table.outline.slice(1)];
    // Two stacked neon rails plus a translucent wall between them.
    table.add(tubeAlong(outline, 0.13, glow(COLORS.pink, 1.5), 0.2));
    table.add(tubeAlong(outline, 0.06, glow(COLORS.cyan, 1.3), 0.75));

    const wallMat = new THREE.MeshBasicMaterial({
        color: 0x8a2cff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < outline.length - 1; i++) {
        const [ax, ay] = outline[i], [bx, by] = outline[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.75), wallMat);
        m.position.set((ax + bx) / 2, (ay + by) / 2, 0.45);
        // Stand the plane up (X), then turn it along the segment (Z).
        m.rotation.set(Math.PI / 2, 0, Math.atan2(by - ay, bx - ax), 'ZXY');
        table.add(m);
    }

    for (const s of w.table.walls) {
        if (!s.visible || s.group === 'outer' || s.group === 'sling' || s.group === 'slingBack') continue;
        if (s.kind === 'gate') {
            gateMesh = segMesh(s, 0.1, glow(COLORS.gold, 1.4), 0.3);
            table.add(gateMesh);
            continue;
        }
        const col = s.group === 'drain' ? glow(COLORS.purple, 0.9) : glow(COLORS.cyan, 1.3);
        table.add(segMesh(s, s.r, col, 0.25));
        table.add(segMesh(s, 0.05, glow(COLORS.pink, 1.2), 0.7));
    }
}

function buildSlings(w) {
    for (const sl of w.table.slings) {
        const shape = new THREE.Shape();
        shape.moveTo(...sl.A); shape.lineTo(...sl.B); shape.lineTo(...sl.C); shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
        const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            color: 0x1a0638, emissive: 0x3a0a70, emissiveIntensity: 0.6, transparent: true, opacity: 0.85,
            roughness: 0.3, metalness: 0.2,
        }));
        table.add(body);
        const kickSeg = { ax: sl.A[0], ay: sl.A[1], bx: sl.C[0], by: sl.C[1] };
        const kickMat = new THREE.MeshBasicMaterial({ color: glow(COLORS.pink, 1.4) });
        const kicker = segMesh(kickSeg, 0.15, kickMat.color, 0.3);
        kicker.traverse((o) => { if (o.material) o.material = kickMat; });
        table.add(kicker);
        const back1 = segMesh({ ax: sl.A[0], ay: sl.A[1], bx: sl.B[0], by: sl.B[1] }, 0.07, glow(COLORS.cyan, 1.1), 0.56);
        const back2 = segMesh({ ax: sl.B[0], ay: sl.B[1], bx: sl.C[0], by: sl.C[1] }, 0.07, glow(COLORS.cyan, 1.1), 0.56);
        table.add(back1, back2);
        // Normal of the kicking face (pointing out of the triangle) for the punch animation.
        const face = w.table.walls.find((s) => s.kind === 'sling' && s.side === sl.side);
        slingViews.push({ side: sl.side, kicker, kickMat, body, flash: 0, nx: face.nx, ny: face.ny });
    }
}

function buildBumpers(w) {
    for (const bp of w.table.bumpers) {
        const g = new THREE.Group();
        g.position.set(bp.x, bp.y, 0);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x220640, emissive: 0x5a0f8a, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.25 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(bp.r * 1.12, bp.r * 1.12, 0.18, 32), baseMat);
        base.rotation.x = Math.PI / 2;
        base.position.z = 0.09;
        const bodyMat = new THREE.MeshBasicMaterial({ color: glow(COLORS.pink, 1.0) });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(bp.r * 0.8, bp.r, 0.62, 32, 1, true), bodyMat);
        body.rotation.x = Math.PI / 2;
        body.position.z = 0.45;
        const capMat = new THREE.MeshBasicMaterial({ color: glow(COLORS.cyan, 1.2) });
        const cap = new THREE.Mesh(new THREE.CircleGeometry(bp.r * 0.8, 32), capMat);
        cap.position.z = 0.77;
        const star = new THREE.Mesh(new THREE.RingGeometry(bp.r * 0.25, bp.r * 0.45, 5, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        star.position.z = 0.78;
        const ringMat = new THREE.MeshBasicMaterial({ color: glow(COLORS.gold, 1.3) });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(bp.r * 1.02, 0.06, 8, 40), ringMat);
        ring.position.z = 0.2;
        g.add(base, body, cap, star, ring);
        table.add(g);
        bumperViews.push({ g, bodyMat, capMat, ringMat, star, flash: 0, punch: 0 });
    }
}

function flipperShape(len) {
    // Tapered capsule from the pivot (origin) along +x.
    const s = new THREE.Shape();
    const r0 = FLIPPER.r0, r1 = FLIPPER.r1;
    const a = Math.asin((r0 - r1) / len);
    // The shared tangent lines touch both circles at ±(90° - a), leaning toward the tip.
    s.absarc(0, 0, r0, Math.PI / 2 - a, Math.PI * 1.5 + a, false);
    s.absarc(len, 0, r1, -Math.PI / 2 + a, Math.PI / 2 - a, false);
    s.closePath();
    return s;
}

function buildFlippers() {
    for (const side of [-1, 1]) {
        const geo = new THREE.ExtrudeGeometry(flipperShape(FLIPPER.len), {
            depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2,
        });
        if (side > 0) {
            geo.scale(-1, 1, 1);
            geo.computeVertexNormals();
        }
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: new THREE.Color(COLORS.pink), emissiveIntensity: 0.8,
            metalness: 0.4, roughness: 0.25, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30),
            new THREE.LineBasicMaterial({ color: glow(COLORS.cyan, 1.5) }));
        const g = new THREE.Group();
        g.add(mesh, edges);
        g.position.set(side * FLIPPER.pivotX, FLIPPER.pivotY, 0.05);
        const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 12), new THREE.MeshBasicMaterial({ color: glow(COLORS.gold, 2) }));
        pivot.rotation.x = Math.PI / 2;
        pivot.position.set(side * FLIPPER.pivotX, FLIPPER.pivotY, 0.35);
        table.add(g, pivot);
        flipperViews.push({ g, mat, flash: 0 });
    }
}

function buildLane() {
    // Plunger: a spring rod under the ball in the launch lane.
    plungerMesh = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), new THREE.MeshBasicMaterial({ color: glow(COLORS.cyan, 1.8) }));
    rod.position.y = -0.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: glow(COLORS.pink, 2.2) }));
    plungerMesh.add(rod, head);
    plungerMesh.position.set(TABLE.laneX, 0.45, 0.3);
    table.add(plungerMesh);
}

function buildShield(w) {
    const s = w.table.shield;
    const len = s.bx - s.ax;
    shieldMesh = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.16, 0.45),
        new THREE.MeshBasicMaterial({ color: glow(0x3dff8a, 1.5), transparent: true, opacity: 0.9 }));
    shieldMesh.position.set((s.ax + s.bx) / 2, s.ay, 0.25);
    shieldMesh.visible = false;
    table.add(shieldMesh);
}

// ============================================================
// Bricks
// ============================================================

const brickVert = /* glsl */`
    varying vec2 vUv;
    varying vec3 vN;
    void main() {
        vUv = uv;
        vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const brickFrag = /* glsl */`
    uniform vec3 uColor;
    uniform float uHit, uTime, uKind, uGhost, uHpFrac, uSeed;
    varying vec2 vUv;
    varying vec3 vN;
    void main() {
        float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float rim = smoothstep(0.1, 0.0, e);
        float top = step(0.5, vN.z);
        vec3 col = uColor * (0.28 + 0.14 * top + rim * 1.15);
        // Diagonal sheen sweeping across the top face.
        float sweep = fract(uTime * 0.35 + uSeed);
        float sheen = exp(-pow((vUv.x + vUv.y * 0.5) - sweep * 2.2 + 0.4, 2.0) * 40.0);
        col += uColor * sheen * top * 0.6;
        // Cracks appear as the brick loses hit points.
        float crack = (1.0 - uHpFrac) * top * smoothstep(0.04, 0.0, abs(fract((vUv.x * 3.1 + vUv.y * 1.7 + uSeed) * 2.0) - 0.5) - 0.44);
        col = mix(col, vec3(0.02), crack * 0.8);
        if (uKind > 0.5 && uKind < 1.5) {
            // Explosive: pulsing hazard core and a bright X.
            float p = 0.5 + 0.5 * sin(uTime * 9.0 + uSeed * 6.0);
            vec2 c = vUv - 0.5;
            float x = min(abs(c.x * 0.5 - c.y), abs(c.x * 0.5 + c.y));
            col += vec3(1.0, 0.8, 0.3) * smoothstep(0.08, 0.0, x) * top * (0.7 + p * 0.8);
            col += uColor * p * 0.3;
        } else if (uKind > 1.5) {
            // Power-up brick: rainbow shimmer.
            vec3 rb = 0.5 + 0.5 * cos(6.2831 * (vUv.x + uTime * 0.6 + vec3(0.0, 0.33, 0.67)));
            col += rb * top * 0.5;
        }
        col += vec3(1.0) * uHit * 1.2;
        gl_FragColor = vec4(col, mix(1.0, 0.28 + 0.1 * sin(uTime * 30.0), uGhost));
    }
`;

export function brickColor(br) {
    if (br.kind === 'x') return BRICK_COLORS.x;
    if (br.kind === 'p') return BRICK_COLORS.p;
    return BRICK_COLORS[Math.max(1, Math.min(4, br.hp))];
}

function addBrickView(br, w) {
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        vertexShader: brickVert,
        fragmentShader: brickFrag,
        uniforms: {
            uColor:  { value: new THREE.Color(brickColor(br)) },
            uHit:    { value: 0 },
            uTime:   { value: 0 },
            uKind:   { value: br.kind === 'x' ? 1 : br.kind === 'p' ? 2 : 0 },
            uGhost:  { value: 0 },
            uHpFrac: { value: 1 },
            uSeed:   { value: Math.random() },
        },
    });
    const mesh = new THREE.Mesh(brickGeo, mat);
    mesh.position.set(br.x, br.y, 0);
    mesh.scale.setScalar(0.001);
    table.add(mesh);
    // Stagger the materialise-in animation row by row from the top.
    const delay = br.row * 0.06 + Math.abs(br.col - 5) * 0.025;
    brickViews.set(br.id, { mesh, mat, age: -delay, punch: 0, hp: br.hp });
}

function removeBrickView(id) {
    const v = brickViews.get(id);
    if (!v) return;
    table.remove(v.mesh);
    v.mat.dispose();
    brickViews.delete(id);
}

export function hitBrick(id) {
    const v = brickViews.get(id);
    if (v) { v.mat.uniforms.uHit.value = 1; v.punch = 1; }
}

// ============================================================
// Pickups & lasers
// ============================================================

function letterTexture(letter, color) {
    const key = letter + color;
    if (letterTex.has(key)) return letterTex.get(key);
    const tex = makeCanvasTexture(128, 128, (ctx, W, H) => {
        ctx.font = '900 92px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillText(letter, W / 2, H / 2 + 6);
    });
    letterTex.set(key, tex);
    return tex;
}

function addPickupView(p) {
    const def = PICKUPS[p.kind];
    const g = new THREE.Group();
    const body = new THREE.Mesh(pickupGeo, new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: new THREE.Color(def.color), emissiveIntensity: 1.3, metalness: 0.5, roughness: 0.2,
    }));
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(def.letter, def.color), depthTest: false, transparent: true }));
    label.scale.set(0.75, 0.75, 1);
    label.position.z = 0.55;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 32), new THREE.MeshBasicMaterial({
        color: glow(def.color, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.add(body, label, halo);
    g.position.set(p.x, p.y, 0.45);
    table.add(g);
    pickupViews.set(p.id, { g, body, halo, age: 0 });
}

function removePickupView(id) {
    const v = pickupViews.get(id);
    if (!v) return;
    table.remove(v.g);
    v.body.material.dispose();
    v.halo.material.dispose();
    v.halo.geometry.dispose();
    pickupViews.delete(id);
}

function addLaserView(l) {
    const m = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: glow(0xff2d55, 2) }));
    m.position.set(l.x, l.y, 0.4);
    table.add(m);
    laserViews.set(l.id, m);
}

// ============================================================
// Flash hooks for the juice director
// ============================================================

export function hitBumper(id) {
    const v = bumperViews[id];
    if (v) { v.flash = 1; v.punch = 1; }
}
export function hitSling(side) {
    const v = slingViews.find((s) => s.side === side);
    if (v) v.flash = 1;
}
export function flipperFlash(side) {
    const v = flipperViews[side < 0 ? 0 : 1];
    if (v) v.flash = 1;
}

export function setBallGlows(balls) {
    for (let i = 0; i < 6; i++) {
        const b = balls[i];
        if (b && !b.held) ballUniform[i].set(b.x, b.y, 1);
        else ballUniform[i].set(0, 0, 0);
    }
}

export function setBallGlowColor(hex) { surfaceMat.uniforms.uBallCol.value.set(hex); }

// ============================================================
// Per-frame sync
// ============================================================

const PINK = new THREE.Color(COLORS.pink);
const WHITE = new THREE.Color(0xffffff);
const tmpC = new THREE.Color();

export function syncTableView(w, dt, time, beat) {
    surfaceMat.uniforms.uTime.value = time;
    surfaceMat.uniforms.uBeat.value = beat;
    writeLightUniforms(lightPos, lightCol);

    // --- Flippers ---
    w.flippers.forEach((f, i) => {
        const v = flipperViews[i];
        v.g.rotation.z = f.side < 0 ? f.angle : -f.angle;
        v.g.scale.x = f.len / FLIPPER.len;
        v.flash = Math.max(0, v.flash - dt * 5);
        v.mat.emissiveIntensity = 0.8 + v.flash * 1.6 + (w.tilted ? -0.7 : 0);
        v.mat.emissive.copy(PINK).lerp(WHITE, v.flash * 0.6);
    });

    // --- Bumpers ---
    for (const v of bumperViews) {
        v.flash = Math.max(0, v.flash - dt * 4);
        v.punch = Math.max(0, v.punch - dt * 7);
        const s = 1 + Math.sin(v.punch * Math.PI) * 0.18;
        v.g.scale.set(s, s, 1 + v.punch * 0.4);
        v.bodyMat.color.copy(PINK).lerp(tmpC.set(0xffffff).multiplyScalar(2.2), v.flash);
        v.capMat.color.set(COLORS.cyan).multiplyScalar(1.1 + v.flash * 2 + beat * 0.3);
        v.star.rotation.z += dt * (1 + v.flash * 12);
    }

    // --- Slings ---
    for (const v of slingViews) {
        v.flash = Math.max(0, v.flash - dt * 6);
        v.kickMat.color.set(COLORS.pink).multiplyScalar(1.4).lerp(tmpC.set(0xffffff).multiplyScalar(2.5), v.flash);
        v.kicker.position.set(v.nx * v.flash * 0.25, v.ny * v.flash * 0.25, 0);
        v.body.material.emissiveIntensity = 0.6 + v.flash * 2;
    }

    // --- Plunger & lane arrows ---
    const held = w.balls.some((b) => b.held);
    plungerMesh.position.y = 0.45 - w.plunger * 0.45;
    for (const a of laneArrows) {
        const on = a.lane ? held : true;
        const phase = (time * (a.lane ? 3 : 1.6) - a.i * 0.35) % 1;
        const k = on ? (phase < 0.3 ? 1 : 0.18) : 0.08;
        a.mesh.material.opacity = k;
    }

    // --- Shield ---
    shieldMesh.visible = w.power.shield > 0 && (w.power.shield > 3 || Math.floor(time * 10) % 2 === 0);
    if (shieldMesh.visible) shieldMesh.scale.y = 1 + Math.sin(time * 20) * 0.25;

    // --- Bricks: add new ones, drop dead ones, animate the rest ---
    const alive = new Set();
    for (const br of w.bricks) {
        if (!br.alive) continue;
        alive.add(br.id);
        if (!brickViews.has(br.id)) addBrickView(br, w);
        const v = brickViews.get(br.id);
        v.age += dt;
        const grow = v.age <= 0 ? 0.001 : Math.min(1, v.age / 0.35);
        const ease = grow < 1 ? 1 - Math.pow(1 - grow, 3) * Math.cos(grow * 9) : 1;
        v.punch = Math.max(0, v.punch - dt * 6);
        const s = Math.max(0.001, ease * (1 + Math.sin(v.punch * Math.PI) * 0.22));
        v.mesh.scale.set(s, s, s);
        v.mesh.position.z = (1 - Math.min(1, Math.max(0, v.age) / 0.35)) * 3;
        const u = v.mat.uniforms;
        u.uTime.value = time;
        u.uHit.value = Math.max(0, u.uHit.value - dt * 7);
        u.uGhost.value = br.ghost ? 1 : 0;
        u.uHpFrac.value = br.hp / br.maxHp;
        if (v.hp !== br.hp) { v.hp = br.hp; u.uColor.value.set(brickColor(br)); }
    }
    for (const id of brickViews.keys()) if (!alive.has(id)) removeBrickView(id);

    // --- Pickups ---
    const livePick = new Set();
    for (const p of w.pickups) {
        livePick.add(p.id);
        if (!pickupViews.has(p.id)) addPickupView(p);
        const v = pickupViews.get(p.id);
        v.age += dt;
        v.g.position.set(p.x, p.y, 0.45 + Math.sin(v.age * 6) * 0.12);
        v.body.rotation.x += dt * 5;
        const hs = 1 + 0.25 * Math.sin(v.age * 10);
        v.halo.scale.set(hs, hs, 1);
        v.g.scale.setScalar(Math.min(1, v.age * 4));
    }
    for (const id of pickupViews.keys()) if (!livePick.has(id)) removePickupView(id);

    // --- Lasers ---
    const liveL = new Set();
    for (const l of w.lasers) {
        liveL.add(l.id);
        if (!laserViews.has(l.id)) addLaserView(l);
        laserViews.get(l.id).position.set(l.x, l.y, 0.4);
    }
    for (const [id, m] of laserViews) {
        if (!liveL.has(id)) { table.remove(m); m.material.dispose(); laserViews.delete(id); }
    }
}

/** Remove every dynamic mesh (used when a fresh world replaces the old one). */
export function resetTableView() {
    for (const id of [...brickViews.keys()]) removeBrickView(id);
    for (const id of [...pickupViews.keys()]) removePickupView(id);
    for (const [id, m] of laserViews) { table.remove(m); m.material.dispose(); laserViews.delete(id); }
}

