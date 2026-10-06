// Story scenes: a small diorama for each place (the clubhouse, or a realm) with the cast standing in
// an arc. The speaker steps forward and talks; the camera leans toward them.

import * as THREE from 'three';
import { toonMat, toonMesh, part, cyl, cone, box, sph, gradientMap } from './toon.js';
import { instancedTrees, decorMesh, windmillMesh } from './props.js';
import { buildHumanoid, buildWedgewick, buildBoss, heroLook, CAST } from './chars.js';
import { setPose, animate, animateWedge } from './anim.js';
import { PALETTES, MAP_PALETTE } from './palette.js';
import { LOOKS, OUTFITS } from '../sim/rpg.js';

const STAGE_REALM = { clubhouse: 0, meadow: 0, sand: 1, frost: 2, cinder: 3, sky: 4 };
const BOSS_SCALE = { gopher: 0.95, worm: 0.85, yeti: 0.7, ogre: 0.55, dragon: 0.45 };

export function makeSpeaker(key, profile) {
    if (key === 'hero') { const r = buildHumanoid(heroLook(LOOKS[profile.look] ?? LOOKS[0], OUTFITS[profile.outfit] ?? OUTFITS[0])); r.root.scale.setScalar(1.5); return r; }
    if (key === 'wedge') { const r = buildWedgewick(); r.root.scale.setScalar(1.4); r.float = 1.4; return r; }
    if (CAST[key]) { const r = buildHumanoid(CAST[key]); r.root.scale.setScalar(key === 'bogey' ? 1.7 : 1.5); return r; }
    const r = buildBoss(key);
    r.root.scale.setScalar(BOSS_SCALE[key] ?? 0.8);
    if (key === 'worm') { r.parts.head.position.y = 1.4; }
    if (key === 'ogre') { r.parts.head0.position.set(-1.9, 6.2, 0); r.parts.head1.position.set(1.9, 6.2, 0); }
    if (key === 'dragon') { for (let i = 0; i < 3; i++) r.parts['head' + i].position.set((i - 1) * 3.2, 6.6 + (i === 1 ? 0.8 : 0), 1.0); }
    return r;
}

export class Stage {
    constructor(R, sky, fx) {
        this.R = R; this.sky = sky; this.fx = fx;
        this.root = new THREE.Group();
        R.scene.add(this.root);
        this.cast = new Map();
    }

    clear() { for (const c of [...this.root.children]) this.root.remove(c); this.cast.clear(); }

    build(stageKey, castKeys, profile) {
        this.clear();
        const realm = STAGE_REALM[stageKey] ?? 0;
        const P = stageKey === 'clubhouse' ? MAP_PALETTE : PALETTES[realm];
        this.R.setPalette(P);
        this.sky.apply(P, new THREE.Vector3(0, 0, 0), 60, 3 + realm);
        this.fx.setAmbient(P.snowfall ? 'snow' : P.embers ? 'embers' : P.key === 'sky' ? 'sparkles' : 'pollen');
        // ground disc
        const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: stageKey === 'clubhouse' ? '#7fd04c' : P.rough[1], gradientMap: gradientMap(3) }));
        ground.receiveShadow = true;
        this.root.add(ground);
        const fair = new THREE.Mesh(new THREE.CircleGeometry(9, 40).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: P.fairway[0], gradientMap: gradientMap(3) }));
        fair.position.y = 0.02; fair.receiveShadow = true;
        this.root.add(fair);
        // backdrop
        const style = { 0: 'oak', 1: 'palm', 2: 'pine', 3: 'spire', 4: 'column' }[realm];
        const trees = [];
        for (let i = 0; i < 18; i++) { const a = -1.3 + (i / 17) * 2.6; const r = 20 + (i % 3) * 6; trees.push({ x: Math.sin(a) * r, z: -Math.cos(a) * r, y: 0, s: 1 + (i % 4) * 0.15, style: realm === 1 && i % 3 === 0 ? 'cactus' : style, rot: i }); }
        this.root.add(instancedTrees(trees, P));
        if (stageKey === 'clubhouse') {
            const ch = toonMesh([
                part(box(14, 6, 6), '#fff2dc', [0, 3, 0]),
                part(new THREE.ConeGeometry(10, 4.5, 4), '#3a6ac8', [0, 8.2, 0], [0, Math.PI / 4, 0], [1, 1, 0.6]),
                ...[-1, 1].map((sx) => part(cyl(2, 2.2, 10, 10), '#fff2dc', [sx * 7.5, 5, 0])),
                ...[-1, 1].map((sx) => part(cone(2.6, 4, 10), '#3a6ac8', [sx * 7.5, 12, 0])),
                part(box(2.6, 3.8, 0.3), '#7a4a2a', [0, 1.9, 3.1]),
            ], { outline: 0.08 });
            ch.position.set(0, 0, -16);
            this.root.add(ch);
            const tee = toonMesh([part(cyl(0.35, 0.15, 1.6, 10), '#ffd040', [0, 0.8, 0]), part(cyl(0.8, 0.8, 0.2, 14), '#ffd040', [0, 1.65, 0])], { outline: 0.04, emissive: '#a06000', emissiveIntensity: 0.6 });
            tee.position.set(5.5, 0, -6);
            this.root.add(tee);
            this.tee = tee;
        } else {
            const deco = { meadow: [['cottage', -12, -14], ['sheep', 8, -6], ['sheep', 10, -8]], sand: [['tent', -10, -12], ['obelisk', 9, -10], ['camel', 12, -6]], frost: [['igloo', -10, -12], ['snowman', 9, -7]], cinder: [['forge', -10, -10], ['brazier', 7, -5], ['brazier', -6, -5]], sky: [['arch', 0, -14], ['statue', 10, -9], ['statue', -10, -9]] }[stageKey] ?? [];
            for (const [k, x, z] of deco) { const m = decorMesh(k, P); if (m) { m.position.set(x, 0, z); m.rotation.y = -x * 0.05; this.root.add(m); } }
            if (stageKey === 'meadow') { const w = windmillMesh(); w.position.set(16, 0, -20); w.rotation.y = -0.5; w.scale.setScalar(0.8); this.root.add(w); this.mill = w; }
        }
        // the cast in an arc
        const n = castKeys.length;
        castKeys.forEach((k, i) => {
            const rig = makeSpeaker(k, profile);
            const a = n === 1 ? 0 : -0.55 + (i / (n - 1)) * 1.1;
            const big = rig.kind !== 'humanoid' && rig.kind !== 'wedge';
            const r = big ? 9 : 7;
            rig.root.position.set(Math.sin(a) * r, rig.float ?? 0, -Math.cos(a) * r + 6);
            rig.home = rig.root.position.clone();
            rig.root.rotation.y = -a * 0.8;
            if (rig.kind === 'humanoid') { rig.phase = i * 1.7; setPose(rig, k === 'bogey' ? 'float' : 'idle'); }
            this.root.add(rig.root);
            this.cast.set(k, rig);
        });
        this.speaker = null;
        this.camPos = new THREE.Vector3(0, 4.2, 15);
        this.camLook = new THREE.Vector3(0, 1.8, 0);
    }

    speak(key, mood) {
        this.speaker = key;
        for (const [k, rig] of this.cast) {
            const talking = k === key;
            if (rig.kind === 'humanoid') {
                const pose = k === 'bogey' ? 'float' : talking ? (mood === 'happy' ? 'cheer' : mood === 'surprised' ? 'surprised' : mood === 'sad' ? 'slump' : 'talk') : 'idle';
                if (rig.pose !== pose) setPose(rig, pose);
            }
            const ex = talking ? (mood === 'smug' ? 'smug' : mood ?? 'normal') : rig.expr === 'blink' ? 'blink' : 'normal';
            rig.setExpr?.(talking ? ex : 'normal');
        }
    }

    update(dt, t, dir) {
        for (const [k, rig] of this.cast) {
            const talking = k === this.speaker;
            if (rig.kind === 'humanoid') {
                animate(rig, dt, t);
                const fwd = talking ? 1.2 : 0;
                rig.root.position.z += (rig.home.z + fwd - rig.root.position.z) * Math.min(1, dt * 4);
            } else if (rig.kind === 'wedge') {
                animateWedge(rig, dt, t, talking);
                rig.root.position.y = rig.home.y + 1.2;
            } else {
                const bob = talking ? Math.abs(Math.sin(t * 6)) * 0.25 : Math.sin(t * 1.5) * 0.08;
                rig.root.position.y = rig.home.y + bob;
                rig.root.rotation.z = talking ? Math.sin(t * 7) * 0.04 : 0;
            }
        }
        if (this.mill) this.mill.userData.hub.rotation.z = -t;
        if (this.tee) this.tee.rotation.y = t;
        // lean the camera toward the speaker
        const sp = this.cast.get(this.speaker);
        const tx = sp ? sp.root.position.x * 0.35 : 0;
        dir.mode = 'focus';
        dir.focusFrom = new THREE.Vector3(tx, 4.6, 16);
        dir.focusAt = new THREE.Vector3(tx * 0.9, 2.2, 0);
        dir.k = 2.5;
    }
}
