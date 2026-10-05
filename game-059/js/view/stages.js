/**
 * stages.js — builds each stage's 3D set from procedural textures.
 *
 * Two groups per stage:
 *   bg  — sky, skyline layers and distant 3D towers, seen by the level
 *         background camera (real parallax as the camera tracks Juno).
 *   fg  — the street: floor, the back wall of storefronts / train windows /
 *         lab panels, signs, props sticking out of the wall, and a few dark
 *         foreground pillars that sweep past the lens.
 * Each segment kind (street, alley, car, roof, market, ...) has a builder;
 * update(dt, t, camX) animates neon flicker, scrolling train windows, the
 * elevator shaft, lightning and so on.
 */

import * as THREE from 'three';
import { ZS } from './scene.js';
import * as T from './textures.js';

export const WALL_Z = -184;
const FLOOR_FRONT = 120;
const FLOOR_D = FLOOR_FRONT - WALL_Z;

function mat(tex, opts = {}) {
    return new THREE.MeshBasicMaterial({ map: tex, transparent: !!opts.transparent, alphaTest: opts.alphaTest ?? (opts.cut ? 0.5 : 0), side: opts.side || THREE.FrontSide, fog: opts.fog ?? true, color: opts.color ?? 0xffffff, depthWrite: opts.depthWrite ?? true, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: opts.opacity ?? 1 });
}
function plane(w, h, m) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); }

const THEMES = {
    neon: { sky: { top: '#05020e', mid: '#1c0a30', bottom: '#5a1a52', stars: 40 }, wall: '#2a2238', neon: ['#ff3fa4', '#3af4ff', '#ffd23a', '#9a6aff'], skyline: ['#140a26', '#1e1034', '#2a1844'], clear: 0x05020e },
    train: { sky: { top: '#020410', mid: '#0a1430', bottom: '#2a3a6a', stars: 60 }, wall: '#22283a', neon: ['#3af4ff', '#ff3fa4', '#ffd23a'], skyline: ['#081024', '#0e1a36', '#142446'], clear: 0x020410 },
    market: { sky: { top: '#0a0408', mid: '#2a0a14', bottom: '#6a1a1a', stars: 30 }, wall: '#3a1e1e', neon: ['#ff3a2a', '#ffb02a', '#ff3fa4', '#3af4ff'], skyline: ['#1a0a10', '#260e16', '#34141c'], clear: 0x0a0408 },
    docks: { sky: { top: '#0c1028', mid: '#3a2a5a', bottom: '#ff9a5a', stars: 15 }, wall: '#2a2e3a', neon: ['#ffd23a', '#3af4ff'], skyline: ['#141428', '#1e1c36', '#2a2644'], clear: 0x0c1028 },
    lab: { sky: { top: '#020806', mid: '#06140e', bottom: '#0a2018', stars: 0 }, wall: '#dfe4ea', neon: ['#3aff8a', '#ff3a3a'], skyline: ['#04100a', '#061810', '#0a2014'], clear: 0x020806 },
    spire: { sky: { top: '#02030c', mid: '#0a1030', bottom: '#3a2a6a', stars: 80 }, wall: '#1a1e2c', neon: ['#ff2d55', '#3af4ff'], skyline: ['#0a0c20', '#10142c', '#161c3a'], clear: 0x02030c },
    zenith: { sky: { top: '#0c0a18', mid: '#3a2448', bottom: '#ff8a6a', stars: 10 }, wall: '#1e1a26', neon: ['#ffd23a', '#ff2d55', '#3af4ff'], skyline: ['#120e1e', '#1a1428', '#241c34'], clear: 0x0c0a18 },
};

export function buildStage(level, renderer) {
    const theme = THEMES[level.key] || THEMES.neon;
    const fg = new THREE.Group(), bg = new THREE.Group();
    const ups = [];
    const r = T.rng(level.key.length * 977 + 13);
    const ctx = { level, theme, fg, bg, r, ups, length: level.length, flick: [], scrollers: [], lightning: null };
    renderer.clearColor.set(theme.clear);

    buildSky(ctx);
    // pad the ends so the wider far edge of the perspective view never shows a void
    const segs = level.segments.map((sg) => ({ ...sg }));
    segs[0].x0 -= 384; segs[segs.length - 1].x1 += 384;
    for (const seg of segs) (SEG[seg.kind] || SEG.street)(ctx, seg);
    // floor-edge darkness at the very front so the frame has a base
    const lip = plane(level.length + 2000, 60, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    lip.rotation.x = -Math.PI / 2; lip.position.set(level.length / 2, 0.3, FLOOR_FRONT - 20);
    fg.add(lip);

    return {
        fg, bg, theme,
        update(dt, t, camX) {
            for (const u of ups) u(dt, t, camX);
            for (const f of ctx.flick) {
                f.t -= dt;
                if (f.t <= 0) { f.on = !f.on || Math.random() < 0.8; f.t = f.on ? 0.5 + Math.random() * 5 : 0.04 + Math.random() * 0.12; f.mesh.material.color.setScalar(f.on ? 1 : 0.25); }
            }
        },
        lightning: () => ctx.lightning,
    };
}

// ---------------------------------------------------------------- sky
function buildSky(ctx) {
    const { level, theme, bg, ups } = ctx;
    const L = level.length;
    const sky = plane(30000, 9000, mat(T.toTexture(T.skyTex({ ...theme.sky, seed: 3 })), { fog: false }));
    sky.position.set(L / 2, 1800, -7000);
    bg.add(sky);
    const key = level.key;
    if (key === 'lab') return;   // underground: walls go all the way up

    // moon
    if (key === 'market' || key === 'neon' || key === 'spire') {
        const moon = new THREE.Mesh(new THREE.CircleGeometry(150, 20), new THREE.MeshBasicMaterial({ color: key === 'market' ? 0xffd8b0 : 0xe8e4ff, fog: false }));
        moon.position.set(L * 0.5, 2200, -6500); bg.add(moon);
        ups.push((dt, t, camX) => { moon.position.x = camX * 0.9 + 400; });
    }
    // skyline layers (alpha planes), far to near
    const layers = [
        { z: -5200, h: 2400, y: 0, density: 0.12, c: theme.skyline[0], scale: 6, spire: key !== 'zenith' && key !== 'spire' },
        { z: -3400, h: 1500, y: 0, density: 0.2, c: theme.skyline[1], scale: 4 },
        { z: -2000, h: 900, y: 0, density: 0.28, c: theme.skyline[2], scale: 2.6 },
    ];
    const seaLevel = key === 'docks';
    layers.forEach((Ly, i) => {
        const tex = T.toTexture(T.skylineTex({ seed: 11 + i * 7 + level.key.length, body: Ly.c, edge: T.shade(Ly.c, 1.6), win: theme.neon.concat(['#ffd27a', '#ffd27a']), density: Ly.density, spire: !!Ly.spire, minH: 40, maxH: 250 }), { repeat: true });
        const w = 512 * Ly.scale * 4;
        tex.repeat.set(4, 1);
        const m = plane(w, 256 * Ly.scale, mat(tex, { cut: true, fog: false }));
        m.position.set(L / 2, (seaLevel ? 60 : 0) + 128 * Ly.scale - (key === 'spire' ? 900 + i * 200 : 0), Ly.z);
        bg.add(m);
        ctx.scrollers.push({ mesh: m, w: 512 * Ly.scale, speed: [0.25, 0.5, 1][i] });
    });
    if (seaLevel) {
        const sea = plane(30000, 6000, mat(T.toTexture(T.seaTex({ seed: 4 }), { repeat: true }), { fog: false }));
        sea.material.map.repeat.set(200, 40);
        sea.rotation.x = -Math.PI / 2; sea.position.set(L / 2, 40, -3200); bg.add(sea);
        // cranes
        for (let k = 0; k < 6; k++) {
            const g = new THREE.Group();
            const cm = new THREE.MeshBasicMaterial({ color: 0x1a1a2a, fog: false });
            const leg = new THREE.Mesh(new THREE.BoxGeometry(30, 700, 30), cm); leg.position.y = 350; g.add(leg);
            const leg2 = leg.clone(); leg2.position.x = 160; g.add(leg2);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(700, 30, 30), cm); arm.position.set(160, 720, 0); g.add(arm);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: 0xff3a3a, fog: false })); lamp.position.set(500, 740, 0); g.add(lamp);
            g.position.set(k * 900 - 400, 0, -1500 - (k % 2) * 300);
            bg.add(g);
        }
    }
    // 3D mid towers with window textures (real perspective parallax)
    if (key === 'neon' || key === 'market' || key === 'train' || key === 'zenith' || key === 'spire') {
        const n = Math.ceil(L / 260) + 8;
        for (let k = 0; k < n; k++) {
            const w = 120 + ctx.r() * 200, h = 400 + ctx.r() * 900, d = 160;
            const tex = T.toTexture(T.towerTex({ seed: 100 + k, body: T.shade(theme.skyline[2], 1.1 + ctx.r() * 0.3), win: theme.neon.concat(['#ffd27a']), density: 0.25 + ctx.r() * 0.3, sign: ctx.r() < 0.4 ? ctx.r.pick(theme.neon) : null }), { key: `tower-${level.key}-${k % 10}` });
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(tex, { fog: true }));
            m.material.map.wrapS = THREE.RepeatWrapping;
            m.position.set(-800 + k * 300 + ctx.r() * 80, h / 2 - (key === 'spire' ? 1100 : 0), -900 - ctx.r() * 500);
            bg.add(m);
            if (key === 'spire') ctx.scrollers.push({ mesh: m, w: 0, speed: 0, rise: true, y0: m.position.y });
        }
        if (key === 'neon') {
            // giant hologram advert
            const holo = T.hologramTex({ seed: 2, color: '#3af4ff', word: 'AUREX' });
            const ht = T.toTexture(holo);
            const hm = plane(480, 240, mat(ht, { transparent: true, add: true, fog: false, depthWrite: false, opacity: 0.85 }));
            hm.position.set(1500, 700, -1300); bg.add(hm);
            ups.push((dt, t) => { hm.material.opacity = 0.65 + Math.sin(t * 13) * 0.05 + (Math.random() < 0.02 ? -0.4 : 0); });
            const hm2 = hm.clone(); hm2.material = hm.material.clone(); hm2.position.set(3400, 800, -1500); bg.add(hm2);
        }
    }
    // fog colour for distance haze
    ctx.level.fogColor = theme.sky.bottom;
    bgFog(ctx);
    // train / elevator motion
    const moving = key === 'train';
    ups.push((dt, t, camX) => {
        for (const s of ctx.scrollers) {
            if (moving) {
                s.off = ((s.off || 0) + dt * 600 * s.speed) % (s.w || 1);
                s.mesh.position.x = ctx.length / 2 - s.off;
            }
            if (s.rise && ctx.elevatorT !== undefined) s.mesh.position.y = s.y0 - ctx.elevatorT * 60;
        }
    });
}

function bgFog(ctx) {
    // nothing global: scene fog is set by the view from level.fog
}

// ---------------------------------------------------------------- shared pieces
function addFloor(ctx, seg, kind, seed = 1) {
    const tex = T.toTexture(T.floorTex(kind, seed), { repeat: true });
    const w = seg.x1 - seg.x0 + 2;
    tex.repeat.set(w / 128, 1);
    const m = plane(w, FLOOR_D, mat(tex, { fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((seg.x0 + seg.x1) / 2, 0, (FLOOR_FRONT + WALL_Z) / 2);
    ctx.fg.add(m);
    return m;
}

function addWall(ctx, seg, painter, { y0 = 0, h = 128, z = WALL_Z, pw = 128, cut = false } = {}) {
    let k = 0;
    for (let x = seg.x0; x < seg.x1; x += pw, k++) {
        const pix = painter(k, x);
        if (!pix) continue;
        const tex = T.toTexture(pix);
        const m = plane(pw, h, mat(tex, { cut }));
        m.position.set(x + pw / 2, y0 + h / 2, z);
        ctx.fg.add(m);
    }
}

function vSign(ctx, x, y, color, n = 4, z = WALL_Z + 14) {
    const pix = T.verticalSign({ seed: Math.floor(x), color, n });
    const tex = T.toTexture(pix);
    const w = 16, h = pix.h;
    const g = new THREE.Group();
    const front = plane(w, h, mat(tex)); front.position.z = 3; g.add(front);
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), new THREE.MeshBasicMaterial({ color: 0x0c0a14 })); g.add(side);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 16), new THREE.MeshBasicMaterial({ color: 0x3a3448 })); arm.position.set(0, h / 2 - 4, -10); g.add(arm);
    g.position.set(x, y, z);
    ctx.fg.add(g);
    if (ctx.r() < 0.35) ctx.flick.push({ mesh: front, t: ctx.r() * 4, on: true });
    return g;
}

function hSignMesh(ctx, word, color, x, y, z = WALL_Z + 2, scale = 2) {
    const pix = T.hSign({ word, color, scale });
    const m = plane(pix.w, pix.h, mat(T.toTexture(pix)));
    m.position.set(x, y, z);
    ctx.fg.add(m);
    if (ctx.r() < 0.3) ctx.flick.push({ mesh: m, t: ctx.r() * 3, on: true });
    return m;
}

function pillar(ctx, x, color = 0x07060c, h = 300, w = 14, force = false) {
    if (!force) return null;
    // dark foreground silhouette between the camera and the action
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.set(x, h / 2 - 20, FLOOR_FRONT + 30);
    ctx.fg.add(m);
    return m;
}

function lampPost(ctx, x, z, color = 0xffd27a) {
    const g = new THREE.Group();
    const pm = new THREE.MeshBasicMaterial({ color: 0x1a1824 });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(4, 170, 4), pm); pole.position.y = 85; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 3), pm); arm.position.set(14, 168, 0); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 6), new THREE.MeshBasicMaterial({ color })); lamp.position.set(26, 165, 0); g.add(lamp);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(40, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(26, 0.6, 0); g.add(glow);
    g.position.set(x, 0, z);
    ctx.fg.add(g);
    return g;
}

function boxDecor(ctx, x, z, w, h, d, color, y = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y + h / 2, z); ctx.fg.add(m); return m;
}

function texBox(ctx, x, z, w, h, d, tex, y = 0, side = 0x202024) {
    const sm = new THREE.MeshBasicMaterial({ color: side });
    const fm = mat(tex);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sm, sm, sm, sm, fm, sm]);
    m.position.set(x, y + h / 2, z); ctx.fg.add(m); return m;
}

function glowPool(ctx, x, z, r, color, op = 0.14) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.scale.y = 0.6; m.position.set(x, 0.5, z); ctx.fg.add(m); return m;
}

// ---------------------------------------------------------------- segment builders
const SEG = {
    street(ctx, seg) {
        const { theme, r } = ctx;
        addFloor(ctx, seg, 'street', 1);
        addWall(ctx, seg, (k) => T.storefront({ seed: 40 + k * 3, wall: k % 3 === 2 ? T.shade(theme.wall, 1.2) : theme.wall, neon: theme.neon, kind: r() < 0.15 ? 'shutter' : 'shop' }));
        // upper floors on some panels, so the skyline peeks through the gaps
        addWall(ctx, seg, (k) => (k % 3 === 1 ? null : T.towerTex({ seed: 70 + k, w: 128, h: 64, body: T.shade(theme.wall, 0.8), win: ['#ffd27a', '#ff9ad0', '#9af0ff'], density: 0.35 })), { y0: 128, h: 64 });
        for (let x = seg.x0 + 90; x < seg.x1; x += 180 + r() * 120) vSign(ctx, x, 120 + r() * 30, r.pick(theme.neon), 3 + Math.floor(r() * 3));
        for (let x = seg.x0 + 200; x < seg.x1; x += 420) lampPost(ctx, x, WALL_Z + 30, 0xffb0e0);
        for (let x = seg.x0 + 300; x < seg.x1; x += 640) pillar(ctx, x);
        for (let x = seg.x0 + 60; x < seg.x1; x += 250) glowPool(ctx, x + r() * 60, WALL_Z + 50, 50, new THREE.Color(r.pick(theme.neon)).getHex(), 0.08);
        // power lines
        const wire = new THREE.Mesh(new THREE.BoxGeometry(seg.x1 - seg.x0, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0812 }));
        wire.position.set((seg.x0 + seg.x1) / 2, 200, WALL_Z + 60); ctx.fg.add(wire);
    },
    alley(ctx, seg) {
        const { theme, r } = ctx;
        addFloor(ctx, seg, 'alley', 2);
        addWall(ctx, seg, (k) => T.storefront({ seed: 90 + k, wall: '#3a2228', neon: theme.neon, kind: 'alley' }));
        const brick = T.toTexture(T.brickWall({ seed: 5, color: '#3a2228' }), { repeat: true });
        brick.repeat.set((seg.x1 - seg.x0) / 64, 1);
        const up = plane(seg.x1 - seg.x0, 64, mat(brick)); up.position.set((seg.x0 + seg.x1) / 2, 160, WALL_Z); ctx.fg.add(up);
        for (let x = seg.x0 + 100; x < seg.x1; x += 240) { boxDecor(ctx, x, WALL_Z + 18, 50, 30, 26, 0x2a4a3a); boxDecor(ctx, x, WALL_Z + 18, 52, 3, 28, 0x1a2a22, 30); }
        // laundry lines
        for (let x = seg.x0 + 40; x < seg.x1; x += 200) {
            const ln = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0a10 })); ln.position.set(x + 60, 180, WALL_Z + 40); ctx.fg.add(ln);
            for (let k = 0; k < 4; k++) boxDecor(ctx, x + 20 + k * 26, WALL_Z + 40, 12, 16, 1, new THREE.Color(r.pick(['#a83a4a', '#3a6aa8', '#d8d0c0', '#5a8a3a'])).getHex(), 162);
        }
        for (let x = seg.x0 + 150; x < seg.x1; x += 300) pillar(ctx, x, 0x07060c, 300, 22);
        hSignMesh(ctx, 'RUSTBELT', '#ff6a2a', seg.x0 + 330, 150, WALL_Z + 2, 2);
    },
    garage(ctx, seg) {
        const { theme } = ctx;
        addFloor(ctx, seg, 'garage', 3);
        addWall(ctx, seg, (k) => T.storefront({ seed: 120 + k, wall: '#3a3438', neon: ['#ff6a2a', '#ffd23a'], kind: 'shutter' }));
        const fence = T.toTexture(T.fenceTex(), { repeat: true }); fence.repeat.set((seg.x1 - seg.x0) / 32, 2);
        const f = plane(seg.x1 - seg.x0, 64, mat(fence, { cut: true, side: THREE.DoubleSide })); f.position.set((seg.x0 + seg.x1) / 2, 160, WALL_Z); ctx.fg.add(f);
        hSignMesh(ctx, 'RUSTBELT KINGS', '#ff6a2a', (seg.x0 + seg.x1) / 2, 150, WALL_Z + 3, 2);
        // wrecked car
        boxDecor(ctx, seg.x0 + 120, WALL_Z + 30, 110, 26, 46, 0x5a2a2a); boxDecor(ctx, seg.x0 + 125, WALL_Z + 30, 60, 18, 40, 0x3a1a1a, 26);
        for (let x = seg.x0 + 300; x < seg.x1; x += 70) boxDecor(ctx, x, WALL_Z + 14, 16, 26, 16, 0x7a3a2a);
        glowPool(ctx, (seg.x0 + seg.x1) / 2, -70, 140, 0xff6a2a, 0.06);
        void theme;
    },
    car(ctx, seg) {
        addFloor(ctx, seg, 'car', 4);
        // the window band is transparent: the scrolling city in the bg shows through
        addWall(ctx, seg, (k) => T.trainWall({ seed: k }), { h: 128, cut: true });
        const ceil = plane(seg.x1 - seg.x0, 70, new THREE.MeshBasicMaterial({ color: 0x3a3e4a })); ceil.position.set((seg.x0 + seg.x1) / 2, 163, WALL_Z); ctx.fg.add(ceil);
        for (let x = seg.x0; x < seg.x1; x += 64) { const l = boxDecor(ctx, x + 32, WALL_Z + 60, 30, 2, 8, 0xd8d0b0, 186); ctx.flick.push({ mesh: l, t: ctx.r() * 6, on: true }); }
        // car doors every 600
        for (let x = seg.x0 + 580; x < seg.x1; x += 600) { boxDecor(ctx, x, WALL_Z + 4, 60, 128, 8, 0x8a8e9a); boxDecor(ctx, x, WALL_Z + 9, 20, 40, 2, 0x2a3040, 60); pillar(ctx, x, 0x14161e, 300, 40); }
    },
    roof(ctx, seg) {
        addFloor(ctx, seg, 'roof', 5);
        // the far edge of the roof, then nothing but city rushing past
        const edge = boxDecor(ctx, (seg.x0 + seg.x1) / 2, WALL_Z + 2, seg.x1 - seg.x0, 8, 6, 0x3a3e48);
        void edge;
        for (let x = seg.x0 + 100; x < seg.x1; x += 300) boxDecor(ctx, x, WALL_Z + 30, 40, 12, 30, 0x4a505c);
        // speed lines
        const lines = [];
        for (let k = 0; k < 40; k++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(40 + ctx.r() * 80, 1, 1), new THREE.MeshBasicMaterial({ color: 0x8aa0d8, transparent: true, opacity: 0.5 }));
            m.position.set(seg.x0 + ctx.r() * (seg.x1 - seg.x0), 10 + ctx.r() * 160, WALL_Z - 20 + ctx.r() * 280);
            ctx.fg.add(m); lines.push(m);
        }
        ctx.ups.push((dt, t, camX) => {
            const on = camX > seg.x0 + 100;
            for (const m of lines) { m.visible = on; m.position.x -= dt * 900; if (m.position.x < camX - 400) m.position.x = camX + 400 + Math.random() * 200; }
        });
    },
    market(ctx, seg) {
        const { theme, r } = ctx;
        addFloor(ctx, seg, 'market', 6);
        addWall(ctx, seg, (k) => T.storefront({ seed: 200 + k * 5, wall: k % 2 ? '#3a1e1e' : '#2a1a22', neon: theme.neon, kind: 'shop' }));
        addWall(ctx, seg, (k) => T.towerTex({ seed: 210 + k, w: 128, h: 64, body: '#24121a', win: ['#ffb02a', '#ff6a3a'], density: 0.3, sign: k % 2 ? '#ff3a2a' : null }), { y0: 128, h: 64 });
        // lantern strings across the street
        const lt = T.toTexture(T.lanternRow({ seed: 9 }), { repeat: true });
        for (let x = seg.x0; x < seg.x1; x += 128) {
            const m = plane(128, 24, mat(lt, { cut: true, side: THREE.DoubleSide })); m.position.set(x + 64, 178, -40); ctx.fg.add(m);
        }
        for (let x = seg.x0 + 80; x < seg.x1; x += 260) {
            // stall: awning + counter
            const ac = r.pick(['#c02a2a', '#2a6a3a', '#c08a2a', '#2a4a8a']);
            const aw = plane(70, 30, mat(T.toTexture(T.awningTex(ac), { repeat: true }), { cut: true, side: THREE.DoubleSide }));
            aw.material.map.repeat.set(2, 1); aw.rotation.x = -0.6; aw.position.set(x, 92, WALL_Z + 30); ctx.fg.add(aw);
            boxDecor(ctx, x, WALL_Z + 30, 66, 34, 24, 0x5a2a1a); boxDecor(ctx, x, WALL_Z + 30, 66, 3, 26, 0x8a4a2a, 34);
            for (let k = 0; k < 4; k++) boxDecor(ctx, x - 24 + k * 16, WALL_Z + 36, 10, 6, 10, new THREE.Color(r.pick(['#f0c060', '#e07040', '#80c050', '#ff4a4a'])).getHex(), 37);
            glowPool(ctx, x, WALL_Z + 60, 60, 0xff8a3a, 0.1);
        }
        for (let x = seg.x0 + 150; x < seg.x1; x += 220) vSign(ctx, x, 130, r.pick(theme.neon), 4);
        for (let x = seg.x0 + 400; x < seg.x1; x += 700) pillar(ctx, x, 0x0a0406);
    },
    rooftop(ctx, seg) {
        const { theme, r } = ctx;
        addFloor(ctx, seg, 'rooftop', 7);
        const rt = T.toTexture(T.roofTiles({ seed: 3 }), { repeat: true }); rt.repeat.set((seg.x1 - seg.x0) / 64, 1);
        const roofEdge = plane(seg.x1 - seg.x0, 32, mat(rt)); roofEdge.position.set((seg.x0 + seg.x1) / 2, 16, WALL_Z); ctx.fg.add(roofEdge);
        for (let x = seg.x0 + 120; x < seg.x1; x += 340) {
            // water tank on stilts
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 50, 10), new THREE.MeshBasicMaterial({ color: 0x5a3a2a })); tank.position.set(x, 90, WALL_Z + 20); ctx.fg.add(tank);
            const top = new THREE.Mesh(new THREE.ConeGeometry(28, 16, 10), new THREE.MeshBasicMaterial({ color: 0x3a2418 })); top.position.set(x, 123, WALL_Z + 20); ctx.fg.add(top);
            for (const dx of [-18, 18]) boxDecor(ctx, x + dx, WALL_Z + 20, 3, 65, 3, 0x2a1a14);
        }
        for (let x = seg.x0 + 260; x < seg.x1; x += 420) {
            // neon billboard frame
            const word = r.pick(['ONI', 'NEO', 'DRINK', 'LOVE', 'HOTEL']);
            hSignMesh(ctx, word, r.pick(theme.neon), x, 120, WALL_Z + 6, 3);
            boxDecor(ctx, x - 20, WALL_Z + 6, 3, 100, 3, 0x2a2430); boxDecor(ctx, x + 20, WALL_Z + 6, 3, 100, 3, 0x2a2430);
        }
    },
    docks(ctx, seg) {
        const { r } = ctx;
        addFloor(ctx, seg, 'docks', 8);
        const colors = ['#a83a2a', '#2a5a8a', '#3a7a4a', '#c08a2a', '#6a3a7a', '#2a7a7a'];
        // container stacks along the back
        for (let x = seg.x0; x < seg.x1; x += 140) {
            const stack = 1 + Math.floor(r() * 3);
            for (let s = 0; s < stack; s++) {
                const c = r.pick(colors);
                texBox(ctx, x + 70, WALL_Z + 10, 128, 64, 50, T.toTexture(T.containerTex(c, Math.floor(x + s)), { key: `cont-${c}-${s}` }), s * 64, new THREE.Color(T.shade(c, 0.6)).getHex());
            }
        }
        for (let x = seg.x0 + 80; x < seg.x1; x += 200) boxDecor(ctx, x, WALL_Z + 50, 10, 14, 10, 0x2a2a2e);   // bollards
        for (let x = seg.x0 + 200; x < seg.x1; x += 520) lampPost(ctx, x, WALL_Z + 44, 0xffd27a);
        for (let x = seg.x0 + 350; x < seg.x1; x += 760) pillar(ctx, x, 0x0a0a10, 300, 18);
    },
    warehouse(ctx, seg) {
        addFloor(ctx, seg, 'warehouse', 9);
        addWall(ctx, seg, (k) => T.storefront({ seed: 300 + k, wall: '#3a3a44', neon: ['#ffd23a'], kind: k % 2 ? 'shutter' : 'alley' }));
        const up = plane(seg.x1 - seg.x0, 80, new THREE.MeshBasicMaterial({ color: 0x24242c })); up.position.set((seg.x0 + seg.x1) / 2, 168, WALL_Z); ctx.fg.add(up);
        for (let x = seg.x0; x < seg.x1; x += 160) {
            boxDecor(ctx, x, WALL_Z + 60, 6, 200, 6, 0x3a3a44);
            const lamp = boxDecor(ctx, x + 80, -40, 22, 4, 10, 0xfff0c0, 196);
            glowPool(ctx, x + 80, -40, 70, 0xfff0c0, 0.07);
            ctx.flick.push({ mesh: lamp, t: ctx.r() * 8, on: true });
        }
        const beam = boxDecor(ctx, (seg.x0 + seg.x1) / 2, -40, seg.x1 - seg.x0, 6, 8, 0x2a2a32, 200); void beam;
        for (let x = seg.x0 + 60; x < seg.x1; x += 260) { for (let s = 0; s < 3; s++) boxDecor(ctx, x + s * 26, WALL_Z + 20, 24, 24, 24, 0x7a5a32, 0); boxDecor(ctx, x + 13, WALL_Z + 20, 24, 24, 24, 0x6a4a2a, 24); }
        // steam vents (the sim's steam hazards sit on these)
        for (const h of ctx.level.hazards || []) if (h.type === 'steam') { const v = boxDecor(ctx, h.x, -h.z * ZS, 30, 1, 16, 0x1a1c22); void v; }
    },
    lab(ctx, seg) {
        addFloor(ctx, seg, 'lab', 10);
        addWall(ctx, seg, (k) => T.labWall({ seed: 400 + k }), { h: 128 });
        addWall(ctx, seg, () => T.labWall({ seed: 1 }), { y0: 128, h: 128 });
        for (let x = seg.x0 + 140; x < seg.x1; x += 300) {
            // big specimen tanks
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 110, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x3affb0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
            glass.position.set(x, 70, WALL_Z + 30); ctx.fg.add(glass);
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(8, 30, 3, 8), new THREE.MeshBasicMaterial({ color: 0x9a6a6a })); body.position.set(x, 70, WALL_Z + 30); ctx.fg.add(body);
            boxDecor(ctx, x, WALL_Z + 30, 56, 14, 56, 0x5a6070); boxDecor(ctx, x, WALL_Z + 30, 56, 10, 56, 0x5a6070, 124);
            ctx.ups.push((dt, t) => { body.position.y = 70 + Math.sin(t * 0.8 + x) * 4; body.rotation.z = Math.sin(t * 0.5 + x) * 0.1; });
        }
        for (let x = seg.x0 + 60; x < seg.x1; x += 180) { const l = boxDecor(ctx, x, -60, 60, 2, 12, 0xc8e0d8, 210); ctx.flick.push({ mesh: l, t: ctx.r() * 10, on: true }); }
        for (const h of ctx.level.hazards || []) if (h.type === 'laser' && h.x >= seg.x0 && h.x < seg.x1) {
            boxDecor(ctx, h.x, WALL_Z + 6, 10, 150, 10, 0x3a4050);
            boxDecor(ctx, h.x, FLOOR_FRONT - 30, 10, 20, 10, 0x3a4050);
        }
    },
    vault(ctx, seg) {
        addFloor(ctx, seg, 'vault', 11);
        addWall(ctx, seg, (k) => T.labWall({ seed: 500 + k, dark: true }), { h: 128 });
        addWall(ctx, seg, () => T.labWall({ seed: 2, dark: true }), { y0: 128, h: 128 });
        const cx = (seg.x0 + seg.x1) / 2 + 200;
        const big = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 150, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
        big.position.set(cx, 85, WALL_Z + 6); ctx.fg.add(big);
        boxDecor(ctx, cx, WALL_Z + 6, 80, 12, 30, 0x2a2e36); boxDecor(ctx, cx, WALL_Z + 6, 80, 10, 30, 0x2a2e36, 158);
        // red alarm beacons
        for (let x = seg.x0 + 80; x < seg.x1; x += 260) {
            const b = boxDecor(ctx, x, WALL_Z + 4, 10, 10, 6, 0xff2a2a, 150);
            const glow = glowPool(ctx, x, WALL_Z + 40, 80, 0xff2a2a, 0.0);
            ctx.ups.push((dt, t) => { const v = (Math.sin(t * 6 + x) + 1) / 2; b.material.color.setRGB(0.4 + v * 0.6, 0.05, 0.05); glow.material.opacity = v * 0.12; });
        }
    },
    lobby(ctx, seg) {
        addFloor(ctx, seg, 'lobby', 12);
        addWall(ctx, seg, (k) => T.marbleWall({ seed: 600 + k }), { h: 128 });
        addWall(ctx, seg, (k) => T.marbleWall({ seed: 610 + k }), { y0: 128, h: 128 });
        hSignMesh(ctx, 'AUREX DYNAMICS', '#ff2d55', (seg.x0 + seg.x1) / 2, 140, WALL_Z + 2, 3);
        boxDecor(ctx, seg.x0 + 300, WALL_Z + 40, 140, 30, 30, 0x5a5668); boxDecor(ctx, seg.x0 + 300, WALL_Z + 40, 140, 3, 32, 0xd8b860, 30);
        for (let x = seg.x0 + 100; x < seg.x1; x += 400) { boxDecor(ctx, x, WALL_Z + 30, 20, 20, 20, 0x6a6678); const p = new THREE.Mesh(new THREE.SphereGeometry(18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a6a3a })); p.position.set(x, 38, WALL_Z + 30); ctx.fg.add(p); }
    },
    elevator(ctx, seg) {
        addFloor(ctx, seg, 'elevator', 13);
        // glass shaft: frame posts and passing floor slabs; the city drops away behind
        for (let x = seg.x0; x < seg.x1; x += 128) boxDecor(ctx, x, WALL_Z, 6, 260, 6, 0x2a2e3a);
        const rail = boxDecor(ctx, (seg.x0 + seg.x1) / 2, WALL_Z + 2, seg.x1 - seg.x0, 4, 4, 0xff2d55, 110); void rail;
        const slabs = [];
        for (let k = 0; k < 3; k++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(seg.x1 - seg.x0 + 400, 24, 40), new THREE.MeshBasicMaterial({ color: 0x1a1e2a }));
            s.position.set((seg.x0 + seg.x1) / 2, 100 + k * 220, WALL_Z - 30); ctx.fg.add(s); slabs.push(s);
            const strip = new THREE.Mesh(new THREE.BoxGeometry(seg.x1 - seg.x0 + 400, 2, 2), new THREE.MeshBasicMaterial({ color: 0x3af4ff })); strip.position.y = -12; s.add(strip);
        }
        ctx.elevatorT = 0;
        ctx.ups.push((dt, t, camX) => {
            if (camX < seg.x0 + 200) return;
            ctx.elevatorT += dt;
            for (const s of slabs) { s.position.y -= dt * 260; if (s.position.y < -60) s.position.y += 660; }
        });
    },
    penthouse(ctx, seg) {
        addFloor(ctx, seg, 'penthouse', 14);
        addWall(ctx, seg, (k) => T.glassWall({ seed: k }), { h: 128, cut: true });
        addWall(ctx, seg, (k) => T.marbleWall({ seed: 700 + k, dark: true }), { y0: 128, h: 128 });
        for (let x = seg.x0 + 200; x < seg.x1; x += 400) {
            boxDecor(ctx, x, WALL_Z + 20, 20, 160, 20, 0x2a2434);
            boxDecor(ctx, x, WALL_Z + 21, 22, 4, 22, 0xd8b860, 156);
        }
        for (let x = seg.x0 + 400; x < seg.x1; x += 800) {
            // a gaudy portrait of the CEO
            const frame = boxDecor(ctx, x, WALL_Z + 6, 60, 70, 4, 0xd8b860, 140); void frame;
            boxDecor(ctx, x, WALL_Z + 9, 52, 62, 2, 0x2a2232, 144);
        }
        stormLightning(ctx);
    },
    helipad(ctx, seg) {
        addFloor(ctx, seg, 'helipad', 15);
        const edge = boxDecor(ctx, (seg.x0 + seg.x1) / 2, WALL_Z + 4, seg.x1 - seg.x0, 14, 6, 0x3a3644); void edge;
        // big H and landing lights
        const cx = (seg.x0 + seg.x1) / 2 + 150;
        const hm = new THREE.MeshBasicMaterial({ color: 0xa8a8b4 });
        const legs = [[-30, 0, 8, 90], [30, 0, 8, 90], [0, 0, 60, 8]];
        for (const [dx, , w, d] of legs) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), hm); m.rotation.x = -Math.PI / 2; m.position.set(cx + dx, 0.6, -70); ctx.fg.add(m); }
        const ring = new THREE.Mesh(new THREE.RingGeometry(80, 86, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a })); ring.rotation.x = -Math.PI / 2; ring.scale.y = 1; ring.position.set(cx, 0.5, -70); ctx.fg.add(ring);
        const lights = [];
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const l = boxDecor(ctx, cx + Math.cos(a) * 110, -70 + Math.sin(a) * 110, 4, 3, 4, 0xff2d55); lights.push(l); }
        ctx.ups.push((dt, t) => lights.forEach((l, k) => l.material.color.setScalar(((Math.floor(t * 8) + k) % 12) < 2 ? 1 : 0.2).multiply(new THREE.Color(1, 0.2, 0.3))));
        for (let x = seg.x0 + 120; x < seg.x1; x += 500) { const b = boxDecor(ctx, x, WALL_Z + 20, 6, 60, 6, 0x2a2434); const lamp = boxDecor(ctx, x, WALL_Z + 20, 10, 6, 10, 0xff2d55, 60); ctx.ups.push((dt, t) => lamp.material.color.setRGB((Math.sin(t * 3 + x) > 0.6) ? 1 : 0.25, 0.1, 0.15)); void b; }
        stormLightning(ctx);
    },
};

function stormLightning(ctx) {
    if (ctx.lightning) return;
    ctx.lightning = { t: 3, flash: 0 };
    ctx.ups.push((dt) => {
        const L = ctx.lightning;
        L.t -= dt; L.flash = Math.max(0, L.flash - dt * 4);
        if (L.t <= 0) { L.t = 4 + Math.random() * 7; L.flash = 1; }
    });
}
