/**
 * actorsview.js — every actor's on-screen body: builds the right model for its rig, keeps worn
 * gear in sync, drives the procedural animation from sim state, and handles hit flashes,
 * ghostly summons and the dragon burn-away.
 */
import * as THREE from 'three';
import { makeCharacterMaterial } from './rig.js';
import { buildHumanoid, weaponMesh } from './humanoid.js';
import { buildQuad, buildSpider, buildCrab, quadState, animateQuad, animateMultiLeg } from './creatures.js';
import { buildDragon, dragonState, animateDragon } from './dragonmodel.js';
import { Pose, humanoidState, animateHumanoid } from './anim.js';
import { itemDef } from '../sim/items.js';

const SLOTS = ['right', 'left', 'head', 'body', 'hands', 'feet'];
const _v = new THREE.Vector3();

export class ActorsView {
    constructor(scene, world, opts = {}) {
        this.scene = scene;
        this.world = world;
        this.recs = new Map();
        this.root = new THREE.Group();
        this.root.name = 'actors';
        scene.add(this.root);
        this.frame = 0;
        this.shadowCount = opts.shadows ?? 8;
        this.showPlayer = false;
    }

    setQuality(q) { this.shadowCount = q.shadow ? (q.shadow >= 2048 ? 12 : 6) : 0; }

    sig(a) { return SLOTS.map((s) => a.equip?.[s]?.id || '').join('|') + (a.dead ? 'D' : ''); }

    build(a) {
        const mat = makeCharacterMaterial();
        if (a.ghost) { mat.userData.U.uGhost.value = 1; mat.transparent = true; mat.depthWrite = false; }
        if (a.body === 'golem') mat.userData.U.uGlowCol.value.set(a.tpl === 'rime_golem' ? 0x88ccff : 0xff7a22);
        let body, st, anim;
        if (a.rig === 'humanoid') { body = buildHumanoid(a, mat); st = humanoidState(); anim = animateHumanoid; }
        else if (a.rig === 'quad') { body = buildQuad(a, mat); st = quadState(); anim = animateQuad; }
        else if (a.rig === 'spider') { body = buildSpider(a, mat); st = quadState(); anim = animateMultiLeg; }
        else if (a.rig === 'crab') { body = buildCrab(a, mat); st = quadState(); anim = animateMultiLeg; }
        else if (a.rig === 'dragon') { body = buildDragon(a, mat); st = dragonState(); anim = animateDragon; }
        else { body = buildHumanoid(a, mat); st = humanoidState(); anim = animateHumanoid; }
        body.frustumCulled = false;   // skinned bounds are bind-pose; the group is culled by distance instead
        body.castShadow = true;
        body.receiveShadow = true;
        const g = new THREE.Group();
        g.add(body);
        g.name = a.name || a.id;
        const rec = { a, g, body, mat, pose: new Pose(body), st, anim, sig: this.sig(a), items: [], last: { x: a.pos.x, y: a.pos.y, z: a.pos.z }, hit: 0, burn: 0, acc: 0, dist: 0 };
        this.attachItems(rec);
        return rec;
    }

    /** Weapons and shields: in the hands when drawn, sheathed at the hip or slung on the back otherwise. */
    attachItems(rec) {
        for (const it of rec.items) it.mesh.parent?.remove(it.mesh);
        rec.items = [];
        const a = rec.a;
        if (a.rig !== 'humanoid' || a.dead && false) return;
        const r = a.equip?.right && itemDef(a.equip.right);
        const l = a.equip?.left && itemDef(a.equip.left);
        const add = (d, where) => {
            const m = weaponMesh(d.id, rec.mat);
            if (!m) return;
            rec.items.push({ mesh: m, d, where });
        };
        if (r) add(r, r.bow ? 'bow' : 'right');
        if (l) add(l, l.slot === 'shield' ? 'shield' : l.type === 'torch' ? 'torch' : 'left');
        rec.placed = null;
    }

    placeItems(rec, drawn) {
        const key = drawn ? 'd' : 's';
        if (rec.placed === key) return;
        rec.placed = key;
        const B = rec.body.userData.bones, s = rec.body.userData.s || 1;
        for (const it of rec.items) {
            const m = it.mesh, d = it.d;
            m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
            const inHand = drawn || it.where === 'torch';
            if (inHand) {
                const bone = it.where === 'right' ? B.handR : B.handL;
                bone.add(m);
                m.rotation.set(-Math.PI / 2, 0, 0);
                // fist centre along the fingers (-y in the hand's frame); two-handers held near the guard
                m.position.set(0, -0.06 * s, d.two && !d.bow ? 0.2 * s : 0);
                if (it.where === 'shield') m.position.set(-0.02, -0.06 * s, 0);
            } else if (it.where === 'shield' || d.two || d.bow || d.wtype === 'staff') {
                B.chest.add(m);
                if (it.where === 'shield') { m.position.set(0, -0.08 * s, 0.17 * s); m.rotation.set(Math.PI / 2, 0, 0); }
                else { m.position.set(0, -0.05 * s, 0.15 * s); m.rotation.set(Math.PI, 0, d.bow ? 0.75 : -0.75); }
            } else {
                B.pelvis.add(m);
                const side = it.where === 'left' ? 1 : -1;
                m.position.set(side * 0.2 * s, 0.02 * s, 0.02);
                m.rotation.set(Math.PI - 0.55, 0, side * -0.1);
            }
        }
    }

    add(a) {
        if (this.recs.has(a.id)) return;
        const rec = this.build(a);
        this.recs.set(a.id, rec);
        this.root.add(rec.g);
    }
    remove(a) {
        const rec = this.recs.get(a.id);
        if (!rec) return;
        this.root.remove(rec.g);
        rec.body.geometry.dispose();
        for (const it of rec.items) it.mesh.geometry.dispose();
        rec.mat.dispose();
        this.recs.delete(a.id);
    }

    onEvent(e) {
        if (e.type === 'actorAdded') this.add(e.actor);
        else if (e.type === 'actorRemoved') this.remove(e.actor);
        else if (e.type === 'hit') { const r = this.recs.get(e.target?.id); if (r && !e.blocked) r.hit = 1; }
        else if (e.type === 'roar' || e.type === 'dragonArrive') { const r = this.recs.get(e.actor?.id); if (r) r.roarT = 1.2; }
        else if (e.type === 'dragonDeath') { const r = this.recs.get(e.actor?.id); if (r) r.burning = true; }
    }

    /** Make sure every live actor has a body (after loads and cell changes). */
    syncAll() {
        const live = new Set();
        for (const a of this.world.actors) { live.add(a.id); if (!this.recs.has(a.id)) this.add(a); }
        for (const [id, rec] of this.recs) if (!live.has(id)) this.remove(rec.a);
    }

    update(dt, camera, opts = {}) {
        this.frame++;
        const w = this.world, p = w.player;
        const cam = camera.position;
        const terrain = w.space;   // exterior or interior: both answer ground()
        const near = [];
        for (const rec of this.recs.values()) {
            const a = rec.a;
            // visibility
            const dx = a.pos.x - cam.x, dz = a.pos.z - cam.z;
            const dist = Math.hypot(dx, dz);
            rec.dist = dist;
            const maxD = a.rig === 'dragon' ? 2500 : a.rig === 'humanoid' ? 220 : 180;
            const isPlayer = a === p;
            const vis = dist < maxD && (!isPlayer || this.showPlayer) && a.cell === w.cellId;
            rec.g.visible = vis;
            if (!vis) { rec.last.x = a.pos.x; rec.last.y = a.pos.y; rec.last.z = a.pos.z; continue; }
            near.push(rec);
            // equipment changed?
            const sig = this.sig(a);
            if (sig !== rec.sig && a.rig === 'humanoid') {
                const old = rec.body;
                const nb = buildHumanoid(a, rec.mat);
                nb.frustumCulled = false; nb.castShadow = true; nb.receiveShadow = true;
                rec.g.remove(old); old.geometry.dispose();
                rec.g.add(nb);
                rec.body = nb; rec.pose = new Pose(nb);
                rec.sig = sig;
                this.attachItems(rec);
            }
            // animation level of detail: far actors animate at a lower rate
            rec.acc += dt;
            const every = dist < 40 ? 1 : dist < 90 ? 2 : 4;
            if ((this.frame + rec.a.id.length) % every !== 0 && rec.updated) { this.place(rec); continue; }
            const step = rec.acc; rec.acc = 0;
            rec.updated = true;
            // derived motion
            const vx = (a.pos.x - rec.last.x) / Math.max(step, 1e-3), vz = (a.pos.z - rec.last.z) / Math.max(step, 1e-3), vy = (a.pos.y - rec.last.y) / Math.max(step, 1e-3);
            rec.last.x = a.pos.x; rec.last.y = a.pos.y; rec.last.z = a.pos.z;
            let speed = Math.hypot(vx, vz);
            if (speed > 40 && a.rig !== 'dragon') speed = 0;   // teleports
            const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw);
            const lvx = vx * cy - vz * sy, lvz = vx * sy + vz * cy;
            // what to look at
            let lookYaw = 0, lookPitch = 0;
            const tgt = a.ai?.target ? w.byId(a.ai.target) : (!isPlayer && a.rig === 'humanoid' && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < 5 ? p : null);
            if (tgt && !a.dead) {
                const tx = tgt.pos.x - a.pos.x, tz = tgt.pos.z - a.pos.z, ty = (tgt.pos.y + tgt.h * 0.85) - (a.pos.y + a.h * 0.9);
                const lx = tx * cy - tz * sy, lz = tx * sy + tz * cy;
                lookYaw = Math.atan2(-lx, -lz);
                lookPitch = Math.atan2(ty, Math.hypot(tx, tz));
                if (Math.abs(lookYaw) > 1.8) lookYaw = 0;
            }
            if (isPlayer) { lookPitch = a.camPitch || 0; }
            const sc = a.scale || 1;
            const ground = terrain && a.onGround && !a.swim && dist < 45 && a.rig !== 'dragon' || (a.rig === 'dragon' && !a.fly && terrain)
                ? (lx, lz) => {
                    const wx = a.pos.x + (lx * cy + lz * sy) * sc, wz = a.pos.z + (-lx * sy + lz * cy) * sc;
                    const h = terrain.ground(wx, wz, a.pos.y + 0.6) - a.pos.y;
                    return Math.max(-0.5, Math.min(0.5, h)) / sc;
                }
                : null;
            const items = a.rig === 'humanoid' ? this.held(a) : {};
            const drawn = isPlayer ? !!a.drawn || a.act.kind !== 'idle' : (a.ai?.state === 'combat' || (a.act && a.act.kind !== 'idle' && a.act.kind !== 'stagger' && a.act.kind !== 'knock'));
            const ctx = { a, dt: Math.min(step, 0.1), speed: speed / sc, lvx: lvx / sc, lvz: lvz / sc, vy, lookYaw, lookPitch, aimPitch: isPlayer ? (a.camPitch || 0) : lookPitch * 0.8, ground, rightItem: items.r, leftItem: items.l, drawn, roar: rec.roarT > 0 };
            rec.roarT = Math.max(0, (rec.roarT || 0) - step);
            try { rec.anim(rec.pose, rec.st, ctx); } catch (err) { if (!rec.errd) { rec.errd = true; console.error('anim', a.tpl, err); } }
            if (a.rig === 'humanoid') this.placeItems(rec, drawn);
            // hit flash, burn-away
            const U = rec.mat.userData.U;
            rec.hit = Math.max(0, rec.hit - step * 5);
            U.uHit.value = rec.hit * 0.8;
            if (rec.burning) { rec.burn = Math.min(1, rec.burn + step * 0.09); U.uBurn.value = rec.burn; }
            this.place(rec);
        }
        // only the closest few cast shadows
        near.sort((x, y) => x.dist - y.dist);
        near.forEach((rec, i) => {
            const cs = i < this.shadowCount && rec.dist < 60 || rec.a.rig === 'dragon';
            if (rec.body.castShadow !== cs) { rec.body.castShadow = cs; for (const it of rec.items) it.mesh.castShadow = cs; }
        });
    }

    place(rec) {
        const a = rec.a;
        rec.g.position.set(a.pos.x, a.pos.y, a.pos.z);
        rec.g.rotation.set(0, a.yaw, 0);
        rec.g.scale.setScalar(a.scale || 1);
    }

    held(a) {
        const r = a.equip?.right ? itemDef(a.equip.right) : null;
        const l = a.equip?.left ? itemDef(a.equip.left) : null;
        return { r: r && r.type === 'weapon' ? r : null, l: l && (l.type === 'weapon' || l.slot === 'shield' || l.type === 'torch') ? l : null };
    }

    /** World position of a bone (for effects: breath from a dragon's mouth, spells from hands). */
    bonePos(actor, bone, out = _v) {
        const rec = this.recs.get(actor.id);
        const b = rec?.body.userData.bones[bone];
        if (!b) return out.set(actor.pos.x, actor.pos.y + actor.h * 0.8, actor.pos.z);
        b.updateWorldMatrix(true, false);
        return out.setFromMatrixPosition(b.matrixWorld);
    }
}
