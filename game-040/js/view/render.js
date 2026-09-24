/**
 * render.js — the bridge between the simulation and three.js.
 *
 * The sim owns the truth; this module owns meshes. Every frame it pools a mesh
 * per live entity, writes positions, animates the decorative bits (spinning
 * rings, opening petals, engine flicker), and draws. Nothing here feeds back
 * into the sim.
 */

import * as THREE from 'three';
import { COLORS, VIEW } from '../core/config.js';
import { scene, updateCamera, renderFrame, addShake, dollyPunch, disposeObject } from './scene.js';
import { initBackdrop, setBackdrop, updateBackdrop } from './backdrop.js';
import { initBullets, syncBullets } from './bullets.js';
import { ENEMIES } from '../sim/enemies.js';
import { initFx, updateFx, clearFx, spawnExplosion, spawnShockwave, spawnSpark, spawnPopup,
         spawnBanner, spawnTelegraph, spawnFlareBurst, spawnFlash, makeBeamMesh, makeFieldMesh,
         makeWaveMesh } from './fx.js';
import { makePlayerShip, makeEnemyModel, makeBossModel, makeBossPart, makePod,
         makePickup, makeClawHazard, makeDrone, glow } from './models.js';

let root = null;
let playerMesh = null;
let droneMesh = null;
const pools = {
    enemies: new Map(), pods: new Map(), pickups: new Map(),
    hazards: new Map(), beams: new Map(), fields: new Map(), waves: new Map(),
    bossParts: new Map(),
};
let bossMesh = null;
let bossId = null;
let beatPulse = 0;
let vid = 1;
let time = 0;
let hitStop = 0;
let dimT = 0;

export function initRender() {
    root = new THREE.Group();
    scene.add(root);

    initBackdrop();
    initBullets();
    initFx();

    playerMesh = makePlayerShip();
    playerMesh.visible = false;
    root.add(playerMesh);

    droneMesh = makeDrone();
    droneMesh.visible = false;
    root.add(droneMesh);

    return root;
}

export function setLevelVisuals(level) {
    setBackdrop(level.backdrop, level.palette ?? {});
}

function flashShell(radius, color = 0xffffff) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.05, 10, 8),
        glow(color, 0),
    );
    mesh.renderOrder = 12;
    return mesh;
}

// ------------------------------------------------------------------- pooling

function syncPool(pool, list, make, sync) {
    for (const entry of pool.values()) entry.seen = false;
    for (const item of list) {
        if (!item.alive) continue;
        item.__vid ??= vid++;
        let entry = pool.get(item.__vid);
        if (!entry) {
            const obj = make(item);
            root.add(obj);
            entry = { obj, seen: true };
            pool.set(item.__vid, entry);
        }
        entry.seen = true;
        sync(entry.obj, item);
    }
    for (const [key, entry] of pool) {
        if (entry.seen) continue;
        root.remove(entry.obj);
        disposeObject(entry.obj);
        pool.delete(key);
    }
}

// -------------------------------------------------------------------- update

export function renderWorld(world, dt, { paused = false } = {}) {
    time += dt;
    if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); dt *= 0.15; }
    beatPulse = Math.max(0, beatPulse - dt * 3.4);

    syncPlayer(world, dt);
    syncEnemies(world, dt);
    syncBoss(world, dt);
    syncPods(world, dt);
    syncPickups(world, dt);
    syncHazards(world);
    syncBeams(world);
    syncFields(world);
    syncWaves(world);
    syncBullets(world, time);

    updateFx(dt);
    if (dimT > 0) dimT = Math.max(0, dimT - dt);
    updateBackdrop(dt, {
        beat: beatPulse,
        flash: dimT > 0 ? -0.06 : 0,
        speed: world.phase === 'boss' ? 0.65 : 1,
    });
    updateCamera(dt, world.player);
    renderFrame();
}

function syncPlayer(world, dt) {
    const p = world.player;
    playerMesh.visible = p.alive && p.respawnTimer <= 0;
    if (!playerMesh.visible) { droneMesh.visible = false; return; }

    playerMesh.position.set(p.x, p.y, 0);
    playerMesh.rotation.z = -p.tilt * 0.55;
    playerMesh.rotation.y = p.tilt * 0.35;

    // invulnerability reads as a flicker, not as a health bar
    if (p.invuln > 0) playerMesh.visible = Math.floor(time * 18) % 2 === 0;

    const ud = playerMesh.userData;
    const thrust = 0.75 + Math.sin(time * 40) * 0.12 + (p.odActive > 0 ? 0.6 : 0);
    for (const e of ud.engines) {
        e.scale.set(1, thrust * (p.focus ? 0.6 : 1.2), 1);
        e.material.opacity = 0.55 + thrust * 0.35;
        e.material.color.set(p.odActive > 0 ? 0xffd166 : COLORS.player);
    }
    // --- boost visuals -------------------------------------------------
    // Shield: brightness tracks how many layers are left, and it flares white
    // for a moment when one pops.
    const shieldOn = p.shield > 0;
    const popped = p.shieldFlash > 0 ? p.shieldFlash / 0.35 : 0;
    ud.shieldBubble.material.opacity = shieldOn
        ? 0.1 + 0.05 * p.shield + Math.sin(time * 4) * 0.03 + popped * 0.5 : popped * 0.5;
    ud.shieldRing.material.opacity = shieldOn
        ? 0.35 + 0.18 * p.shield + Math.sin(time * 7) * 0.12 + popped * 0.6 : popped * 0.6;
    ud.shieldRing.rotation.z += dt * 1.6;
    ud.shieldBubble.scale.setScalar(1 + popped * 0.35);

    // Invulnerability: two rings tumbling in opposite directions. They blink
    // out over the last second so the end of the window is never a surprise.
    const invOn = p.invulnBoost > 0;
    const invFade = invOn ? Math.min(1, p.invulnBoost) : 0;
    const invBlink = p.invulnBoost > 0 && p.invulnBoost < 1.2
        ? (Math.floor(time * 12) % 2 === 0 ? 1 : 0.25) : 1;
    for (const [i, ring] of ud.invulnRings.entries()) {
        ring.material.opacity = invOn ? (0.55 + Math.sin(time * 8 + i) * 0.2) * invFade * invBlink : 0;
        ring.rotation.z += dt * (i ? -2.6 : 2.6);
        ring.rotation.x += dt * (i ? 1.4 : -1.0);
    }

    // Speed: a stretched exhaust cone that only exists while boosted.
    const spdOn = p.speedT > 0;
    ud.speedTrail.material.opacity = spdOn
        ? (0.35 + Math.sin(time * 30) * 0.12) * Math.min(1, p.speedT) : 0;
    ud.speedTrail.scale.set(1, spdOn ? 1 + Math.sin(time * 22) * 0.18 : 1, 1);

    // Rocket pods: lit while armed, and they flash on each launch.
    const rockOn = p.rocketT > 0;
    for (const [i, pod] of ud.rocketPods.entries()) {
        pod.material.opacity = rockOn
            ? (0.6 + Math.sin(time * 16 + i * Math.PI) * 0.3) * Math.min(1, p.rocketT) : 0;
    }

    ud.dot.material.opacity = p.focus ? 1 : 0.35;
    ud.dot.scale.setScalar(p.focus ? 1.15 + Math.sin(time * 9) * 0.1 : 0.85);
    ud.focusRing.material.opacity = p.focus ? 0.55 + Math.sin(time * 6) * 0.15 : 0;
    ud.focusRing.rotation.z += dt * 2.2;
    ud.hook.rotation.z += dt * (p.firing ? 3 : 1.2);

    droneMesh.visible = !!p.drone;
    if (p.drone) {
        droneMesh.position.set(p.drone.x, p.drone.y, 0);
        droneMesh.userData.ring.rotation.z += dt * 3;
        droneMesh.userData.body.rotation.y += dt * 2;
        droneMesh.userData.ring.material.opacity = p.drone.blockCd > 0 ? 0.25 : 0.85;
    }
}

function syncEnemies(world, dt) {
    syncPool(pools.enemies, world.enemies,
        (e) => {
            const g = makeEnemyModel(e.type, ENEMIES[e.type].color);
            const shell = flashShell(e.r, 0xffffff);
            g.add(shell);
            g.userData.flashShell = shell;
            if (e.isMidboss) g.scale.setScalar(1.6);
            return g;
        },
        (obj, e) => {
            obj.position.set(e.x, e.y, 0);
            const ud = obj.userData;
            if (ud.flashShell) {
                ud.flashShell.material.opacity = Math.min(0.85, e.hitFlash * 0.7
                    + (e.windup > 0 ? 0.35 + Math.sin(time * 30) * 0.2 : 0));
                ud.flashShell.material.color.set(e.windup > 0 ? 0xff5a5a : 0xffffff);
            }
            // per-archetype flourishes
            switch (e.type) {
                case 'turret':
                    if (ud.barrel) {
                        const a = Math.atan2(world.player.y - e.y, world.player.x - e.x) + Math.PI / 2;
                        ud.barrel.parent.rotation.z = a;
                    }
                    break;
                case 'weaver':
                    ud.ring.rotation.z += dt * 2.4;
                    ud.core.rotation.y += dt * 3;
                    break;
                case 'popper':
                    ud.body.scale.setScalar(1 + Math.sin(time * 7 + e.seedPhase) * 0.09);
                    break;
                case 'bloom': {
                    const open = e.windup > 0 ? 1.55 : 1;
                    for (const [i, petal] of ud.petals.entries()) {
                        const a = (i / ud.petals.length) * Math.PI * 2;
                        petal.position.set(Math.cos(a) * 0.5 * open, Math.sin(a) * 0.5 * open, 0);
                    }
                    ud.core.rotation.z += dt * 1.4;
                    break;
                }
                case 'choirling':
                    ud.body.rotation.z += dt * 1.6;
                    ud.halo.scale.setScalar(1 + beatPulse * 0.35);
                    break;
                case 'shieldbearer':
                    ud.shield.material.opacity = e.shieldHp > 0 ? 0.35 + 0.3 * (e.shieldHp / (e.def.shieldHp || 1)) : 0;
                    break;
                case 'seraph':
                    ud.core.rotation.y += dt * 2;
                    for (const [i, wing] of ud.wings.entries()) {
                        wing.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(time * 1.6) * 0.1);
                    }
                    break;
                case 'reaver':
                    obj.rotation.z = Math.atan2(e.cvy ?? -1, e.cvx ?? 0) + Math.PI / 2;
                    break;
                default:
                    obj.rotation.z = Math.sin(time * 1.5 + e.seedPhase) * 0.12;
            }
        });
}

function syncBoss(world, dt) {
    const b = world.boss;
    if (!b || !b.alive) {
        if (bossMesh) {
            root.remove(bossMesh);
            disposeObject(bossMesh);
            bossMesh = null;
            bossId = null;
            for (const [k, entry] of pools.bossParts) {
                root.remove(entry.obj); disposeObject(entry.obj); pools.bossParts.delete(k);
            }
        }
        return;
    }
    if (bossId !== b.id) {
        if (bossMesh) { root.remove(bossMesh); disposeObject(bossMesh); }
        bossMesh = makeBossModel(b.id, b.def.color);
        const shell = flashShell(b.r * 0.9, 0xffffff);
        bossMesh.add(shell);
        bossMesh.userData.flashShell = shell;
        root.add(bossMesh);
        bossId = b.id;
    }

    bossMesh.position.set(b.x, b.y, -0.6);
    bossMesh.visible = !b.hidden;
    const ud = bossMesh.userData;
    if (ud.flashShell) {
        ud.flashShell.material.opacity = Math.min(0.9,
            b.hitFlash * 0.55 + (b.windup > 0 ? 0.35 + Math.sin(time * 26) * 0.22 : 0)
            + (b.state === 'transition' ? 0.5 : 0));
        ud.flashShell.material.color.set(b.windup > 0 ? 0xff4d6d : 0xffffff);
    }
    ud.core?.scale.setScalar(1 + Math.sin(time * 4) * 0.08 + beatPulse * 0.25);
    ud.rings?.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.22) * (i % 2 ? -1 : 1); });
    ud.vanes?.forEach((v, i) => { v.rotation.z += dt * 0.6; });
    ud.disc && (ud.disc.rotation.y += dt * 0.5);
    ud.tendrils?.forEach((t, i) => { t.rotation.z += Math.sin(time * 2 + i) * dt * 0.6; });
    ud.chambers?.forEach((c, i) => {
        c.scale.setScalar(1 + Math.sin(time * 2.4 + i * 1.3) * 0.08 + beatPulse * 0.14);
    });
    ud.arms?.forEach((arm, i) => {
        arm.rotation.z = Math.sin(time * 1.2 + i * Math.PI) * 0.22 + (b.windup > 0 ? 0.25 : 0);
    });
    ud.shell?.forEach((s, i) => {
        s.visible = b.hp / b.maxHp > i / (ud.shell.length + 1);
        s.rotation.y += dt * 1.1;
    });

    // destructible parts
    syncPool(pools.bossParts, b.parts.map((p) => ({ ...p, alive: p.alive, __vid: p.__vid ??= vid++, ref: p })),
        () => makeBossPart(b.def.color),
        (obj, part) => {
            obj.position.set(b.x + part.dx, b.y + part.dy, 0.2);
            const hurt = 1 - part.ref.hp / part.ref.maxHp;
            obj.userData.light.material.color.set(hurt > 0.6 ? 0xffd166 : 0xff6b6b);
            obj.userData.light.material.opacity = 0.6 + part.ref.hitFlash * 0.4;
        });
}

function syncPods(world, dt) {
    syncPool(pools.pods, world.pods, () => makePod(), (obj, pod) => {
        obj.position.set(pod.x, pod.y, 0);
        obj.rotation.z += dt * pod.spin * 0.6;
        const ud = obj.userData;
        ud.beacon.material.opacity = 0.45 + 0.55 * (Math.sin(time * 6) * 0.5 + 0.5);
        ud.window.material.color.set(pod.hitFlash > 0.1 ? COLORS.podHurt : COLORS.pod);
        if (pod.burn > 0) {
            const k = 1 - pod.burn / 12;
            ud.burnRing.material.opacity = 0.25 + k * 0.7;
            ud.burnRing.scale.setScalar(1.4 - k * 0.55);
        } else {
            ud.burnRing.material.opacity = 0;
        }
    });
}

function syncPickups(world, dt) {
    syncPool(pools.pickups, world.pickups, (it) => makePickup(it.type), (obj, it) => {
        obj.position.set(it.x, it.y, 0);
        obj.userData.body.rotation.y += dt * 2.6;
        obj.userData.body.rotation.z += dt * 1.1;
        const blink = it.life < 3 ? (Math.floor(time * 10) % 2 === 0) : true;
        obj.visible = blink;
    });
}

function syncHazards(world) {
    syncPool(pools.hazards, world.hazards, () => makeClawHazard(), (obj, h) => {
        obj.position.set(h.x, h.y, 0.1);
        obj.rotation.z = Math.atan2(h.vy ?? 0, h.vx ?? 1);
        obj.scale.setScalar(h.r / 1.5);
    });
}

function syncBeams(world) {
    syncPool(pools.beams, world.beams, () => makeBeamMesh(), (obj, bm) => {
        const firing = bm.t > bm.warn;
        const len = bm.length;
        obj.position.set(bm.x + Math.cos(bm.ang) * len / 2, bm.y + Math.sin(bm.ang) * len / 2, 0.2);
        obj.rotation.z = bm.ang;
        const width = firing ? bm.width : bm.width * 0.16;
        obj.scale.set(len, width, 1);
        obj.material.color.set(firing ? 0xffffff : COLORS.warn);
        obj.material.opacity = firing
            ? 0.75 + Math.sin(time * 40) * 0.2
            : 0.25 + 0.35 * (bm.t / Math.max(0.01, bm.warn));
    });
}

function syncFields(world) {
    syncPool(pools.fields, world.fields, () => makeFieldMesh(), (obj, f) => {
        obj.position.set(f.x, f.y, 0.05);
        obj.scale.setScalar(f.r);
        obj.rotation.z += 0.02;
        obj.material.opacity = 0.2 + 0.35 * Math.max(0, f.life / 3);
    });
}

function syncWaves(world) {
    syncPool(pools.waves, world.waves, () => makeWaveMesh(), (obj, wv) => {
        obj.position.set(wv.x, wv.y, 0.3);
        obj.scale.setScalar(wv.r);
        obj.material.opacity = 0.8 * (1 - wv.r / wv.maxR);
    });
}

// ------------------------------------------------------- simulation -> visuals

/**
 * Label, popup colour and ring colour for each timed boost. Kept next to the
 * event handler so adding a boost is one table entry, not a switch arm.
 */
const BOOST_FX = {
    shield: { label: 'SHIELD',     css: '#66ffd9', color: COLORS.shieldItem },
    invuln: { label: 'INVULN',     css: '#c4ff5c', color: COLORS.invulnItem },
    speed:  { label: '2x SPEED',   css: '#3cffcf', color: COLORS.speedItem },
    rocket: { label: 'ROCKETS',    css: '#a8ff3c', color: COLORS.rocketItem },
};

/**
 * Translate one queued simulation event into visuals. main.js also hands the
 * same event to the audio and UI layers, so this only does pictures.
 */
export function handleFxEvent(ev, world) {
    switch (ev.type) {
        case 'beat':
            beatPulse = 1;
            break;
        case 'dim':
            dimT = ev.duration ?? 2;
            break;
        case 'hit':
            spawnSpark(ev.x, ev.y, ev.boss ? 0xffd166 : COLORS.player);
            break;
        case 'deflect':
            spawnSpark(ev.x, ev.y, 0x8fb4ff);
            break;
        case 'shieldHit':
            spawnSpark(ev.x, ev.y, 0x9fd0ff);
            break;
        case 'shieldBroken':
            spawnShockwave(ev.x, ev.y, { color: 0x9fd0ff, maxR: 2.6, life: 0.45 });
            break;
        case 'enemyDeath':
            spawnExplosion(ev.x, ev.y, {
                color: ENEMIES[ev.enemy]?.color ?? 0xffb347,
                scale: ev.big ? 2.0 : 1,
                count: ev.big ? 46 : 22,
            });
            if (ev.big) { addShake(0.5); hitStop = VIEW.hitStop; }
            break;
        case 'midbossDefeated':
            spawnBanner('MIDBOSS DOWN', '#ffd166', { y: 4, scale: 1.8, life: 1.8 });
            addShake(0.8);
            break;
        case 'mineBurst':
            spawnShockwave(ev.x, ev.y, { color: 0xffd166, maxR: 1.8, life: 0.3 });
            break;
        case 'podRescued':
            spawnPopup(ev.x, ev.y, `+${ev.cadets}`, '#7dffd4', { scale: 1.0 });
            spawnShockwave(ev.x, ev.y, { color: COLORS.pod, maxR: 2.2, life: 0.5 });
            break;
        case 'podLost':
            spawnExplosion(ev.x, ev.y, { color: COLORS.podHurt, scale: 1.3, count: 30 });
            spawnPopup(ev.x, ev.y, 'LOST', '#ff6b6b', { scale: 1.1 });
            addShake(0.35);
            break;
        case 'podHit':
            spawnSpark(ev.x, ev.y, COLORS.podHurt);
            break;
        case 'powerUp':
            spawnPopup(ev.x, ev.y, `POWER ${ev.power}`, '#9dff4d');
            spawnShockwave(ev.x, ev.y, { color: COLORS.powerItem, maxR: 2.2, life: 0.4 });
            break;

        // --- timed boosts --------------------------------------------------
        case 'boostStart': {
            const b = BOOST_FX[ev.boost];
            if (!b) break;
            spawnPopup(ev.x, ev.y, b.label, b.css, { scale: 1.15 });
            spawnShockwave(ev.x, ev.y, { color: b.color, maxR: 4.2, life: 0.55, width: 0.1 });
            spawnShockwave(ev.x, ev.y, { color: 0xffffff, maxR: 2.4, life: 0.32 });
            spawnFlash(ev.x, ev.y, { color: b.color, scale: 2.0, life: 0.22 });
            break;
        }
        case 'boostEnd':
            spawnShockwave(ev.x, ev.y, {
                color: BOOST_FX[ev.boost]?.color ?? 0xffffff, maxR: 2.0, life: 0.35,
            });
            break;
        case 'shieldPop':
            spawnShockwave(ev.x, ev.y, { color: COLORS.shield, maxR: 5.0, life: 0.5, width: 0.08 });
            spawnFlash(ev.x, ev.y, { color: 0xffffff, scale: 2.4, life: 0.2 });
            spawnPopup(ev.x, ev.y, ev.left > 0 ? 'SHIELD HIT' : 'SHIELD DOWN', '#66ffd9');
            addShake(0.5);
            hitStop = VIEW.hitStop;
            break;
        case 'invulnDeflect':
            spawnSpark(ev.x, ev.y, COLORS.invulnItem);
            break;
        case 'rocketFire':
            spawnSpark(ev.x, ev.y, COLORS.rocket);
            break;
        case 'rocketBlast':
            spawnExplosion(ev.x, ev.y, { color: COLORS.rocket, scale: 1.15, count: 22, speed: 11 });
            addShake(0.18);
            break;
        case 'weaponSwap':
            spawnPopup(ev.x, ev.y, 'WEAPON', '#00ffa8');
            break;
        case 'flarePickup':
            spawnPopup(ev.x, ev.y, 'FLARE', '#5cffb0');
            break;
        case 'lifePickup':
            spawnPopup(ev.x, ev.y, '1UP', '#d8ff5c', { scale: 1.3 });
            spawnShockwave(ev.x, ev.y, { color: COLORS.lifeItem, maxR: 3.4, life: 0.6 });
            break;
        case 'patchwork':
            spawnPopup(ev.x, ev.y, 'PATCHED', '#7dffd4', { scale: 0.8 });
            break;
        case 'flare':
            spawnFlareBurst(ev.x, ev.y);
            addShake(0.9);
            break;
        case 'odStart':
            spawnShockwave(ev.x, ev.y, { color: 0xffd166, maxR: 6, life: 0.6 });
            spawnBanner('OVERDRIVE', '#ffd166', { y: -6, scale: 1.4, life: 1.2 });
            break;
        case 'playerDeath':
            spawnExplosion(ev.x, ev.y, { color: 0x7ef2ff, scale: 2.6, count: 60 });
            addShake(1.4);
            dollyPunch(2.5);
            hitStop = 0.12;
            break;
        case 'playerRespawn':
            spawnShockwave(ev.x, ev.y, { color: COLORS.player, maxR: 3.5, life: 0.6 });
            break;
        case 'windup':
            if (ev.duration > 0.3) spawnTelegraph(ev.x, ev.y, ev.duration, 0xff9f6e, 2.2);
            break;
        case 'bossWindup':
            spawnTelegraph(ev.x, ev.y, ev.duration, COLORS.warn, 4.5);
            break;
        case 'bossWarning':
            spawnBanner(ev.name, '#ff4d6d', { y: 2, scale: 2.4, life: 3.0 });
            addShake(0.6);
            break;
        case 'midbossWarning':
            spawnBanner('WARNING', '#ffd166', { y: 4, scale: 1.8, life: 1.6 });
            break;
        case 'bossPhaseFlash':
            spawnShockwave(ev.x, ev.y, { color: 0xffffff, maxR: 14, life: 0.9, width: 0.05 });
            spawnBanner(ev.phase, '#ffffff', { y: 5, scale: 1.5, life: 2.0 });
            addShake(1.0);
            dollyPunch(2);
            hitStop = 0.1;
            break;
        case 'bossVanish':
            spawnShockwave(ev.x, ev.y, { color: 0xffd98a, maxR: 5, life: 0.5 });
            break;
        case 'bossAppear':
            spawnShockwave(ev.x, ev.y, { color: 0xfff2d0, maxR: 4, life: 0.4 });
            break;
        case 'bossBlink':
            spawnShockwave(ev.x, ev.y, { color: 0x9fe8ff, maxR: 3.5, life: 0.35 });
            break;
        case 'bossRam':
            addShake(0.7);
            break;
        case 'flareWave':
            spawnShockwave(ev.x, ev.y, { color: 0x9fe8ff, maxR: 6, life: 0.5 });
            break;
        case 'bossDying':
            addShake(1.6);
            for (let i = 0; i < 10; i++) {
                setTimeout(() => spawnExplosion(
                    ev.x + (Math.random() - 0.5) * 6,
                    ev.y + (Math.random() - 0.5) * 5,
                    { color: 0xffd166, scale: 2, count: 40 }), i * 180);
            }
            break;
        case 'bossDefeated':
            spawnBanner('CLEAR', '#7dffd4', { y: 2, scale: 2.6, life: 3.2 });
            addShake(2.0);
            dollyPunch(4);
            break;
        case 'partDestroyed':
            spawnExplosion(ev.x, ev.y, { color: 0xffd166, scale: 1.6, count: 34 });
            spawnPopup(ev.x, ev.y, 'TURRET DOWN', '#ffd166', { scale: 1.0 });
            addShake(0.6);
            break;
        case 'bulletsCleared':
            if (ev.count > 20) spawnShockwave(ev.x, ev.y, { color: 0xffe9b0, maxR: 8, life: 0.5 });
            break;
        default:
            break;
    }
}

/** Leaving a level: drop every pooled mesh and any explosion still in flight. */
export function resetRender() {
    clearFx();
    for (const pool of Object.values(pools)) {
        for (const entry of pool.values()) { root.remove(entry.obj); disposeObject(entry.obj); }
        pool.clear();
    }
    if (bossMesh) { root.remove(bossMesh); disposeObject(bossMesh); bossMesh = null; bossId = null; }
}

export { addShake, spawnBanner, spawnPopup };
