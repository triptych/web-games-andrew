/**
 * stage.js — the actors in the world (hero, monsters) and the world camera.
 *
 * In combat the camera is solved every frame so the enemy group fills the
 * layout's enemy region at any aspect ratio: distance from the group's size
 * and the region's share of the screen, then setViewOffset() moves the
 * principal point onto the region's centre. The hero stands on the same
 * ground line, found by casting a ray through its screen spot (landscape only).
 * Outside combat the camera drifts slowly around the hero.
 */

import * as THREE from 'three';
import { worldScene, worldCam, view, world2px } from './scene.js';
import { buildWorld, updateWorld, worldState } from './world.js';
import { setCardEnv, layout } from './cards3d.js';
import { Creature, Hero } from './creatures.js';

export const stage = {
    mode: 'title', hero: null, heroLook: null, creatures: new Map(), world: -1,
    shake: 0, t: 0, cam: { pos: new THREE.Vector3(0, 3, 14), look: new THREE.Vector3(0, 1.5, 0), off: { x: 0, y: 0 } },
    groupW: 4, groupH: 4,
};

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function setWorld(w, seed = 1) {
    if (stage.world === w && worldState.current) return;
    stage.world = w;
    const { env } = buildWorld(w, seed);
    setCardEnv(env);
}

export function setHero(look) {
    if (stage.hero) { worldScene.remove(stage.hero.root); stage.hero.dispose(); }
    stage.hero = look ? new Hero(look) : null;
    stage.heroLook = look;
    if (stage.hero) worldScene.add(stage.hero.root);
}

export function setMode(mode, focus = 'side') { stage.mode = mode; stage.focus = focus; }

export function clearCreatures() {
    for (const c of stage.creatures.values()) { worldScene.remove(c.root); c.dispose(); }
    stage.creatures.clear();
}

export function addCreature(e, { spawn = false } = {}) {
    const c = new Creature(e.look, { boss: !!e.boss });
    c.eid = e.eid;
    c.boss = !!e.boss;
    worldScene.add(c.root);
    stage.creatures.set(e.eid, c);
    if (spawn) c.spawn();
    arrange(true);
    return c;
}

export function creature(eid) { return stage.creatures.get(eid); }

/** Spread living creatures left→right; bosses take more room. */
export function arrange(snapNew = false) {
    const list = [...stage.creatures.values()].filter((c) => !c.dying);
    const widths = list.map((c) => (c.boss ? 3.6 : 2.3) * Math.max(0.8, c.s));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    let maxH = 3;
    list.forEach((c, i) => {
        const cx = x + widths[i] / 2;
        x += widths[i];
        const z = c.boss ? -0.8 : (i % 2 ? -0.7 : 0.2);
        c.base.set(cx, 0, z);
        if (snapNew && !c.placed) { c.root.position.copy(c.base); c.placed = true; }
        maxH = Math.max(maxH, c.top + 1.3);
    });
    stage.groupW = Math.max(4.5, total + 1);
    stage.groupH = maxH;
}

export function markDying(eid) {
    const c = stage.creatures.get(eid);
    if (c) { c.dying = true; c.die(); }
}

// ------------------------------------------------------------------ camera

function combatCamera() {
    const R = layout.enemyRegion;
    const w = view.w, h = view.h;
    const tan = Math.tan((worldCam.fov * Math.PI) / 360);
    const rw = (R.x1 - R.x0) / w, rh = (R.y1 - R.y0) / h;
    const W = stage.groupW, H = stage.groupH;
    const d = Math.max(W / (2 * tan * (w / h) * rw), H / (2 * tan * rh), 7);
    const lookY = H * 0.45;
    return {
        pos: new THREE.Vector3(Math.sin(stage.t * 0.15) * 0.3, lookY + d * 0.13, d),
        look: new THREE.Vector3(0, lookY, 0),
        off: { x: w / 2 - (R.x0 + R.x1) / 2, y: h / 2 - (R.y0 + R.y1) / 2 },
    };
}

function idleCamera() {
    const t = stage.t;
    if (stage.mode === 'title') {
        return { pos: new THREE.Vector3(Math.sin(t * 0.05) * 6, 4 + Math.sin(t * 0.07) * 0.6, 16 + Math.cos(t * 0.05) * 3), look: new THREE.Vector3(0, 3.2, -10), off: { x: 0, y: 0 } };
    }
    const a = Math.sin(t * 0.06) * 0.5;
    const side = stage.focus === 'center' || view.portrait ? 0 : view.w * 0.36;
    return { pos: new THREE.Vector3(Math.sin(a) * 8, 2.8, Math.cos(a) * 8), look: new THREE.Vector3(0, 1.6, 0), off: { x: side, y: view.portrait ? -view.h * 0.12 : 0 } };
}

function placeHero() {
    const hero = stage.hero;
    if (!hero) return;
    if (stage.mode === 'combat') {
        if (!layout.heroRegion || view.portrait) { hero.root.visible = false; return; }
        hero.root.visible = true;
        const feet = world2px(new THREE.Vector3(0, 0, 0));
        const hx = (layout.heroRegion.x0 + layout.heroRegion.x1) / 2;
        const ndc = new THREE.Vector2((hx / view.w) * 2 - 1, -((Math.min(feet.y, view.h * 0.82)) / view.h) * 2 + 1);
        _ray.setFromCamera(ndc, worldCam);
        if (_ray.ray.intersectPlane(ground, _v)) {
            hero.root.position.lerp(_v, 0.25);
            hero.root.rotation.y = 0.75;
            hero.root.scale.setScalar(1);
        }
    } else {
        hero.root.visible = stage.mode !== 'title';
        hero.root.position.lerp(_v.set(0, 0, 0), 0.1);
        hero.root.rotation.y = 0.2;
        hero.root.scale.setScalar(1);
    }
}

export function kickShake(amount) { stage.shake = Math.min(1.2, stage.shake + amount); }

export function updateStage(dt, t) {
    stage.t = t;
    updateWorld(dt, t);
    const target = stage.mode === 'combat' ? combatCamera() : idleCamera();
    const k = 1 - Math.exp(-dt * 3);
    stage.cam.pos.lerp(target.pos, k);
    stage.cam.look.lerp(target.look, k);
    stage.cam.off.x += (target.off.x - stage.cam.off.x) * k;
    stage.cam.off.y += (target.off.y - stage.cam.off.y) * k;
    worldCam.position.copy(stage.cam.pos);
    if (stage.shake > 0) {
        stage.shake = Math.max(0, stage.shake - dt * 2.5);
        const s = stage.shake * stage.shake * 0.25;
        worldCam.position.x += (Math.random() - 0.5) * s;
        worldCam.position.y += (Math.random() - 0.5) * s;
    }
    worldCam.lookAt(stage.cam.look);
    worldCam.setViewOffset(view.w, view.h, stage.cam.off.x, stage.cam.off.y, view.w, view.h);
    worldCam.updateProjectionMatrix();

    for (const [eid, c] of stage.creatures) {
        c.update(dt);
        c.root.position.lerp(c.base, 1 - Math.exp(-dt * 5));
        if (c.dead) { worldScene.remove(c.root); c.dispose(); stage.creatures.delete(eid); }
    }
    placeHero();
    if (stage.hero) stage.hero.update(dt);
}

// ------------------------------------------------------------------ queries

/** Screen position of a creature: 'top' (for plates), 'mid' (for hits), 'feet'. */
export function creaturePx(eid, where = 'mid') {
    const c = stage.creatures.get(eid);
    if (!c) return null;
    const p = c.root.position.clone();
    const h = c.top;
    p.y += where === 'top' ? h + 0.35 : where === 'mid' ? h * 0.55 : 0;
    return world2px(p);
}

export function heroPx(where = 'mid') {
    const hero = stage.hero;
    if (!hero || !hero.root.visible) return null;
    const p = hero.root.position.clone();
    p.y += (where === 'top' ? 2.9 : 1.3) * hero.root.scale.x;
    return world2px(p);
}

/** Which creature is under this CSS pixel, if any. */
export function pickCreature(px, py) {
    let best = null, bd = Infinity;
    for (const [eid, c] of stage.creatures) {
        if (c.dying) continue;
        const top = creaturePx(eid, 'top'), feet = creaturePx(eid, 'feet');
        if (!top || !feet) continue;
        const hgt = feet.y - top.y;
        const wid = hgt * (c.boss ? 0.75 : 0.6);
        const cx = feet.x;
        if (px > cx - wid / 2 && px < cx + wid / 2 && py > top.y && py < feet.y + 20) {
            const d = Math.abs(px - cx);
            if (d < bd) { bd = d; best = eid; }
        }
    }
    return best;
}
