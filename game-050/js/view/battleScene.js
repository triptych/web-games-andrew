/**
 * battleScene.js — the 3D arena: biome ground, sky, props, formations,
 * actors for every unit, camera framing for portrait and landscape, shake.
 */

import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { skyDome, setSky, blobShadow, standardLights, size } from './engine.js';
import { makeProp, groundDisc } from './props.js';
import { toonMat } from './toon.js';
import { buildCharacter } from './chars.js';
import { buildMonster } from './monsters.js';
import { Actor } from './anim.js';
import { createFx } from './fx.js';
import { auraFor } from './aura.js';

export const BIOMES = {
    meadow:  { ground: '#6fbf4a', ground2: '#4f9a36', sky: ['#7cc6ff', '#e6f6ff'], fog: '#cfeeff', props: ['tree', 'tree', 'bush', 'rock', 'flower', 'flower'], particles: 'pollen', light: '#fff4e0' },
};

function rebuildEnvironment(st, biome, seed) {
    if (st.env) { st.scene.remove(st.env); st.env.traverse((o) => { if (o.geometry && !o.userData.keep) o.geometry.dispose?.(); }); }
    const env = new THREE.Group();
    st.env = env;
    const rng = new Rng(seed);
    const gmat = toonMat({ vertexColors: true, steps: 4 });
    const ground = new THREE.Mesh(groundDisc(26, biome.ground, biome.ground2, seed), gmat);
    env.add(ground);
    // a slightly raised arena platform
    const plat = new THREE.Mesh(groundDisc(5.2, biome.ground2, biome.ground, seed + 1, 48), gmat);
    plat.position.y = 0.01;
    env.add(plat);
    const props = biome.props;
    const opts = { leaf: biome.leaf, rock: biome.rock, stone: biome.stone, crystal: biome.crystal, snow: biome.snow };
    for (let i = 0; i < 46; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(6.2, 17);
        const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85 - 2;
        if (z > 3.5 && Math.abs(x) < 9) continue; // keep the camera's foreground clear
        const kind = rng.pick(props);
        const m = makeProp(kind, rng.seed(), opts);
        m.position.set(x, 0, z);
        m.rotation.y = rng.range(0, Math.PI * 2);
        m.scale.setScalar(rng.range(0.9, 1.6) * (r > 11 ? 1.4 : 1));
        env.add(m);
    }
    st.scene.add(env);
    setSky(st.sky, biome.sky[0], biome.sky[1], biome.horizon || biome.sky[1]);
    st.scene.fog.color.set(biome.fog);
    st.lights.sun.color.set(biome.light || '#fff4e0');
    st.lights.hemi.color.set(biome.skyLight || '#dfefff');
    st.lights.hemi.intensity = biome.dark ? 0.85 : 1.15;
    st.lights.sun.intensity = biome.dark ? 1.4 : 2.1;
    st.fx.clear();
    if (biome.particles) st.fx.ambient(biome.particles, { w: 18, h: 5, d: 12, y: 0, z: 0 });
}

/**
 * Formation slots. Landscape: side-on, allies left facing right, enemies mirrored.
 * Portrait: a diagonal — allies bottom-left, enemies top-right — so both fit a narrow screen.
 */
function slots(n, side, portrait) {
    const s = side === 'A' ? -1 : 1;
    const order = n === 1 ? [0] : n === 2 ? [1, 2] : n === 3 ? [0, 1, 2] : n === 4 ? [1, 2, 3, 4] : [0, 1, 2, 3, 4];
    if (portrait) {
        // allies fan out toward the camera (bottom of the screen), enemies away from it (top)
        const P = [[0.75, 1.15], [1.65, 0.25], [0.25, 2.55], [1.35, 3.35], [2.0, 1.75]];
        return order.map((i) => new THREE.Vector3(s * P[i][0], 0, -s * P[i][1]));
    }
    const P = [[1.6, 0.15], [2.4, -1.3], [2.5, 1.55], [3.6, -0.25], [3.7, 2.2]];
    return order.map((i) => new THREE.Vector3(s * P[i][0], 0, P[i][1]));
}

export function createBattleStage() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#cfeeff', 18, 48);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
    const sky = skyDome('#7cc6ff', '#e6f6ff');
    scene.add(sky);
    const lights = standardLights(scene);
    const fx = createFx(scene);
    const st = { scene, camera, sky, lights, fx, env: null, actors: new Map(), shakeT: 0, shakeAmp: 0, zoom: 0, zoomTarget: null, portrait: false, camBase: new THREE.Vector3(), lookBase: new THREE.Vector3(), time: 0 };

    st.setBiome = (biome, seed = 1) => rebuildEnvironment(st, biome, seed);

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        st.portrait = portrait;
        if (portrait) {
            camera.fov = 46;
            st.camBase.set(0, 11.5, 12.6);
            st.lookBase.set(0, 0.3, -0.2);
        } else {
            camera.fov = 32;
            // fit both formations (|x| ≤ ~5.4) whatever the aspect
            const d = Math.max(8.2, 5.6 / (Math.tan((camera.fov * Math.PI) / 360) * (size.w / size.h)));
            st.camBase.set(0, d * 0.44, d);
            st.lookBase.set(0, 0.75, 0.35);
        }
        camera.updateProjectionMatrix();
        fx.setScale(size.h);
        // re-home everyone into the right formation for this aspect
        for (const side of ['A', 'E']) {
            const list = [...st.actors.values()].filter((a) => a.side === side && !a.removed);
            const sl = slots(list.length, side, portrait);
            list.forEach((a, i) => {
                const p = a.boss ? (portrait ? new THREE.Vector3(0.9, 0, -2.4) : new THREE.Vector3(side === 'A' ? -2.2 : 2.6, 0, 0.6)) : sl[i];
                a.actor.home.copy(p);
                if (!a.actor.tasks.length) { a.actor.root.position.copy(p); a.actor.facing = facingFor(side); a.actor.root.rotation.y = a.actor.facing; }
            });
        }
    };
    st.resize = () => st.frame();

    function facingFor(side) {
        if (st.portrait) return side === 'A' ? Math.atan2(1, 0.3) : Math.atan2(-1, 0.75);
        return side === 'A' ? Math.atan2(1, 0.55) : Math.atan2(-1, 0.55);
    }
    st.facingFor = facingFor;

    /** Adds actors for a list of { uid, side, view, boss } and returns them. */
    st.addUnits = (units) => {
        const out = [];
        for (const u of units) {
            const v = u.view;
            const rig = v.kind === 'hero' ? buildCharacter(v.look) : buildMonster(v);
            if (v.kind === 'hero' && v.size) { rig.root.scale.setScalar(v.size); rig.height *= v.size; rig.headY *= v.size; }
            const actor = new Actor(rig);
            const shadow = blobShadow(0.45 * (v.size || 1) * (v.kind === 'hero' ? 1 : 1.2));
            scene.add(shadow);
            scene.add(rig.root);
            const entry = { uid: u.uid, side: u.side, boss: !!u.boss, actor, rig, shadow, view: v, aura: null };
            if (v.kind === 'hero' && v.look && v.look.aura) entry.aura = auraFor(v.look, fx);
            st.actors.set(u.uid, entry);
            out.push(entry);
        }
        st.frame();
        for (const e of out) {
            e.actor.place(e.actor.home, facingFor(e.side));
            e.actor.facing = facingFor(e.side);
        }
        return out;
    };

    st.removeSide = (side) => {
        for (const [uid, e] of [...st.actors]) {
            if (e.side !== side) continue;
            scene.remove(e.rig.root); scene.remove(e.shadow);
            st.actors.delete(uid);
        }
    };

    st.clear = () => {
        for (const e of st.actors.values()) { scene.remove(e.rig.root); scene.remove(e.shadow); }
        st.actors.clear();
        fx.clear();
    };

    st.get = (uid) => st.actors.get(uid);

    /** World anchor on a unit: 'head' (above), 'chest', 'feet'. */
    st.anchor = (uid, where = 'chest', out = new THREE.Vector3()) => {
        const e = st.actors.get(uid);
        if (!e) return out.set(0, 0, 0);
        out.copy(e.actor.root.position);
        const h = e.rig.height;
        if (where === 'head') out.y += h + 0.15;
        else if (where === 'chest') out.y += h * 0.55;
        return out;
    };

    st.shake = (amp = 0.15, dur = 0.3) => { st.shakeAmp = Math.max(st.shakeAmp, amp); st.shakeT = Math.max(st.shakeT, dur); };
    /** Pulls the camera toward a point for dramatic moments (null = reset). */
    st.focus = (pt, amount = 0.25) => { st.zoomTarget = pt ? { pt: pt.clone(), amount } : null; };

    st.timeScale = 1;
    st.update = (dt0, t) => {
        const dt = dt0 * (st.timeScale || 1);
        st.time += dt0;
        for (const e of st.actors.values()) {
            e.actor.update(dt);
            e.shadow.position.set(e.actor.root.position.x, 0.015, e.actor.root.position.z);
            e.shadow.visible = e.actor.root.visible;
            if (e.aura && e.actor.root.visible && !e.actor.dead) e.aura(dt, e.actor.root.position, e.rig.height);
        }
        fx.update(dt);
        // camera
        const cam = camera.position.copy(st.camBase);
        const look = st.lookBase.clone();
        const zt = st.zoomTarget;
        st.zoom += ((zt ? 1 : 0) - st.zoom) * Math.min(1, dt * 4);
        if (st.zoom > 0.001 && (zt || st.lastZoom)) {
            const z = zt || st.lastZoom;
            st.lastZoom = z;
            cam.lerp(z.pt.clone().add(new THREE.Vector3(0, 3, 7)), z.amount * st.zoom);
            look.lerp(z.pt, z.amount * st.zoom * 1.2);
        }
        cam.x += Math.sin(st.time * 0.3) * 0.15;
        if (st.shakeT > 0) {
            st.shakeT -= dt;
            const a = st.shakeAmp * Math.max(0, st.shakeT) * 3;
            cam.x += (Math.random() - 0.5) * a; cam.y += (Math.random() - 0.5) * a;
            if (st.shakeT <= 0) st.shakeAmp = 0;
        }
        camera.lookAt(look);
        // flicker lamps/braziers
        if (st.env) st.env.traverse((o) => { if (o.userData.flicker) o.scale.set(1 + Math.sin(st.time * 17 + o.id) * 0.08, 1 + Math.sin(st.time * 23 + o.id) * 0.15, 1); });
    };

    st.frame();
    return st;
}
