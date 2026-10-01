/**
 * summonScene.js — the Summoning Circle at night: a rune platform ringed by
 * crystal pillars. Plays the charge → tease → pillar → reveal sequence.
 */

import * as THREE from 'three';
import { skyDome, blobShadow, standardLights, size } from './engine.js';
import { toonMat, toonMesh, part, glowMat, merge, paint, paintGradient, shade, disposeObject } from './toon.js';
import { cyl, cone, tor, box } from './chars.js';
import { buildCharacter } from './chars.js';
import { Actor, ease } from './anim.js';
import { createFx } from './fx.js';
import { runeTexture } from './showcase.js';
import { makeProp } from './props.js';
import { auraFor } from './aura.js';

export const RARITY_COLOR = { 1: '#b9c2cc', 2: '#6ee07a', 3: '#53b4ff', 4: '#c879ff', 5: '#ffc94a', 6: '#ff5d8f' };

export function createSummonStage() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#140c2a', 16, 50);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    const sky = skyDome('#1a0e3a', '#05030c', '#3a1a6a');
    scene.add(sky);
    const lights = standardLights(scene, { hemi: 0.7, sunI: 0.9, sky: '#8a7aff', ground: '#1a1030', sun: '#c8b8ff' });
    const fx = createFx(scene);
    fx.ambient('stars', { w: 30, h: 12, d: 20, y: 1, z: -6 });

    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), toonMat({ color: '#1e1636' }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const plat = toonMesh([
        part(paintGradient(cyl(3.2, 3.5, 0.4, 56), '#3a305a', '#5a4e80', 1), null, [0, 0.2, 0]),
        part(tor(3.25, 0.08, 8, 64), '#d8b060', [0, 0.4, 0], [Math.PI / 2, 0, 0]),
        part(paintGradient(cyl(4.2, 4.4, 0.18, 56), '#2a2244', '#3a305a', 1), null, [0, 0.09, 0]),
    ], { outline: 0.03 });
    scene.add(plat);
    const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture('#ffffff'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, color: '#7ab8ff' });
    const rune = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), runeMat);
    rune.rotation.x = -Math.PI / 2; rune.position.y = 0.41;
    scene.add(rune);
    const rune2 = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.1, 64), new THREE.MeshBasicMaterial({ color: '#7ab8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    rune2.rotation.x = -Math.PI / 2; rune2.position.y = 0.2;
    scene.add(rune2);
    // pillars with floating crystals
    const crystals = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.cos(a) * 5.4, z = Math.sin(a) * 5.4;
        if (z > 3.5) continue;
        const pil = toonMesh([part(cyl(0.32, 0.4, 3.2, 10), '#4a4070', [0, 1.6, 0]), part(cyl(0.5, 0.5, 0.25, 10), '#5a5080', [0, 3.25, 0]), part(cyl(0.55, 0.55, 0.25, 10), '#5a5080', [0, 0.12, 0])], { outline: 0.03 });
        pil.position.set(x, 0, z);
        scene.add(pil);
        const c = new THREE.Mesh(paintGradient(new THREE.OctahedronGeometry(0.35), '#6a8aff', '#e0f0ff', 1), glowMat());
        c.position.set(x, 4.1, z); c.scale.set(1, 1.6, 1);
        scene.add(c);
        crystals.push(c);
    }
    for (let i = 0; i < 10; i++) {
        const m = makeProp(i % 2 ? 'crystal' : 'rock', 40 + i, { crystal: '#8a7aff', rock: '#3a3050' });
        const a = (i / 10) * Math.PI * 2 + 0.3, r = 9 + (i % 3) * 3;
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 3);
        m.scale.setScalar(1.6 + (i % 3) * 0.6);
        scene.add(m);
    }
    const glowLight = new THREE.PointLight('#7ab8ff', 2, 14, 1.5);
    glowLight.position.set(0, 2.5, 0);
    scene.add(glowLight);

    const st = { scene, camera, fx, time: 0, charge: 0, color: new THREE.Color('#7ab8ff'), hero: null, camK: 0, spinSpeed: 0.1 };

    st.setColor = (hex) => {
        st.color.set(hex);
        runeMat.color.set(hex);
        rune2.material.color.set(hex);
        glowLight.color.set(hex);
        for (const c of crystals) c.material.color && c.material.color.set('#ffffff');
    };

    st.clearHero = () => {
        if (st.hero) { scene.remove(st.hero.rig.root); scene.remove(st.hero.shadow); disposeObject(st.hero.rig.root); disposeObject(st.hero.shadow); st.hero = null; }
    };

    st.showHero = (hero) => {
        st.clearHero();
        const rig = buildCharacter(hero.look);
        rig.root.scale.setScalar(1.35);
        rig.height *= 1.35;
        const actor = new Actor(rig);
        actor.place(new THREE.Vector3(0, 0.41, 0.2), 0);
        const shadow = blobShadow(0.6, 0.5); shadow.position.set(0, 0.42, 0.2);
        scene.add(rig.root, shadow);
        st.hero = { rig, actor, shadow, aura: hero.look.aura ? auraFor(hero.look, fx) : null, spin: 0 };
        actor.spawn(0);
        actor.victory();
        setTimeout(() => { if (st.hero && st.hero.actor === actor) { actor.state = 'idle'; rig.setExpression('normal'); } }, 1600);
        return st.hero;
    };

    /** Charge-up: colours step through each rarity up to `rarity`. Resolves when the pillar fires. */
    st.charge = async (rarity, radiant, speed = 1) => {
        const sp = typeof speed === 'function' ? speed : () => speed;
        st.clearHero();
        const steps = [3, 4, 5].filter((r) => r <= Math.max(3, rarity));
        if (rarity < 3) steps.splice(0, steps.length, rarity);
        st.spinSpeed = 1.2;
        for (let i = 0; i < steps.length; i++) {
            const col = RARITY_COLOR[steps[i]];
            st.setColor(col);
            const dur = i === steps.length - 1 ? 900 : 700;
            let prog = 0, last = performance.now();
            while (prog < dur) {
                const nowT = performance.now();
                prog += (nowT - last) * sp();
                last = nowT;
                const a = Math.random() * Math.PI * 2, r = 3.2 + Math.random() * 1.5;
                const p = new THREE.Vector3(Math.cos(a) * r, 0.5 + Math.random() * 2, Math.sin(a) * r);
                fx.emit({ pos: p, count: 1, color: col, color2: '#ffffff', speed: 0.1, dir: p.clone().multiplyScalar(-1).normalize(), dirSpeed: 4, life: 0.7, size: 0.22, drag: 0 });
                st.camK = Math.min(1, st.camK + 0.02);
                await new Promise((r2) => setTimeout(r2, 16));
            }
            if (i < steps.length - 1) { fx.ring(new THREE.Vector3(0, 0.45, 0), RARITY_COLOR[steps[i + 1]], { to: 5, dur: 0.5 }); }
        }
        const col = radiant ? '#ff8ad8' : RARITY_COLOR[rarity];
        st.setColor(col);
        fx.pillar(new THREE.Vector3(0, 0.4, 0.2), col, { radius: 1.1, height: 14, dur: 1.4 });
        fx.burst(new THREE.Vector3(0, 1.2, 0.2), col, 80, { speed: 7, size: 0.28 });
        fx.ring(new THREE.Vector3(0, 0.45, 0), col, { to: 8, dur: 0.8 });
        st.spinSpeed = 0.2;
    };

    st.reset = () => { st.clearHero(); st.setColor('#7ab8ff'); st.camK = 0; st.spinSpeed = 0.1; };

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        camera.fov = portrait ? 50 : 38;
        camera.updateProjectionMatrix();
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    st.update = (dt) => {
        st.time += dt;
        rune.rotation.z += dt * st.spinSpeed;
        rune2.rotation.z -= dt * st.spinSpeed * 0.6;
        crystals.forEach((c, i) => { c.position.y = 4.1 + Math.sin(st.time * 1.5 + i) * 0.15; c.rotation.y += dt; });
        runeMat.opacity = 0.5 + Math.sin(st.time * 3) * 0.1 + st.spinSpeed * 0.2;
        const portrait = size.w / size.h < 0.9;
        const k = ease.inOut(Math.min(1, st.camK));
        const far = portrait ? new THREE.Vector3(0, 5.6, 12.5) : new THREE.Vector3(0, 4.6, 11);
        const near = portrait ? new THREE.Vector3(0, 2.6, 6.8) : new THREE.Vector3(0, 2.4, 6.2);
        camera.position.lerpVectors(far, near, st.hero ? 1 : k * 0.4);
        camera.lookAt(0, st.hero ? (portrait ? 0.9 : 1.3) : 1.1, 0);
        if (st.hero) {
            st.hero.actor.update(dt);
            st.hero.spin += dt * 0.4;
            st.hero.actor.root.rotation.y = Math.sin(st.hero.spin) * 0.5;
            if (st.hero.aura) st.hero.aura(dt, st.hero.actor.root.position, st.hero.rig.height);
        }
        fx.update(dt);
    };
    st.frame();
    return st;
}
