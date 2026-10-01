/**
 * showcase.js — a lit pedestal stage for looking at heroes: hero details,
 * the character creator, the team line-up and the title screen.
 */

import * as THREE from 'three';
import { skyDome, setSky, blobShadow, standardLights, size } from './engine.js';
import { toonMat, toonMesh, part, glowMat, merge, paint, paintGradient, shade, disposeObject } from './toon.js';
import { cyl, tor } from './chars.js';
import { buildCharacter } from './chars.js';
import { buildMonster } from './monsters.js';
import { Actor } from './anim.js';
import { createFx } from './fx.js';
import { auraFor } from './aura.js';
import { ELEMENT } from '../data/core.js';

function runeTexture(color = '#ffe08a') {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.translate(256, 256);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 240, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 206, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath(); g.moveTo(Math.cos(a) * 206, Math.sin(a) * 206); g.lineTo(Math.cos(a + Math.PI * 2 / 3) * 206, Math.sin(a + Math.PI * 2 / 3) * 206); g.stroke();
    }
    g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.save(); g.rotate(a); g.fillText(runes[i % runes.length], 0, -223); g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
export { runeTexture };

export function createShowcase() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#1a1236', 14, 40);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const sky = skyDome('#3a2a6a', '#120c24', '#6a4aa0');
    scene.add(sky);
    const lights = standardLights(scene, { hemi: 1.05, sunI: 2.0, sky: '#e8e0ff', ground: '#3a3060' });
    const spot = new THREE.PointLight('#ffe8c0', 6, 8, 1.6);
    spot.position.set(0, 3.2, 1.4);
    scene.add(spot);
    const fx = createFx(scene);
    fx.ambient('sparkles', { w: 10, h: 4, d: 6, y: 0, z: -1 });

    // floor + pedestals
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), toonMat({ color: '#241a44' }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const runeTex = runeTexture('#ffe08a');
    const pedestals = [];
    function pedestal(r) {
        const grp = new THREE.Group();
        grp.add(toonMesh([
            part(paintGradient(cyl(r, r * 1.12, 0.28, 40), '#3a2e5a', '#6a5a9a', 1), null, [0, 0.14, 0]),
            part(tor(r * 1.02, 0.04, 8, 48), '#d8b060', [0, 0.28, 0], [Math.PI / 2, 0, 0]),
        ], { outline: 0.02 }));
        const rune = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 48), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffe08a' }));
        rune.rotation.x = -Math.PI / 2;
        rune.position.y = 0.285;
        grp.add(rune);
        grp.userData.rune = rune;
        return grp;
    }
    // backdrop: arches
    const back = new THREE.Group();
    for (let i = -3; i <= 3; i++) {
        const x = i * 2.6, z = -6 - Math.abs(i) * 0.6;
        back.add(toonMesh([part(cyl(0.25, 0.3, 4.5, 10), '#3a2e5a', [x, 2.25, z]), part(cyl(0.4, 0.4, 0.3, 10), '#4a3e6a', [x, 4.6, z])], { outline: 0.02 }));
    }
    scene.add(back);

    const st = { scene, camera, sky, fx, actors: [], spin: 0, spinVel: 0, mode: 'single', time: 0, focusY: 1, sheet: 0.5 };

    st.clear = () => {
        for (const a of st.actors) { scene.remove(a.root); scene.remove(a.shadow); disposeObject(a.root); disposeObject(a.shadow); }
        for (const p of pedestals) { scene.remove(p); disposeObject(p); }
        pedestals.length = 0;
        st.actors = [];
    };

    function add(entity, x, z, scale = 1) {
        const v = entity.view;
        const rig = v && v.kind === 'monster' ? buildMonster({ ...v, size: 1 }) : buildCharacter(entity.look || v.look);
        rig.root.scale.multiplyScalar(scale);
        rig.height *= scale; rig.headY *= scale;
        const actor = new Actor(rig);
        actor.place(new THREE.Vector3(x, 0.28, z), 0);
        const shadow = blobShadow(0.42 * scale, 0.4);
        shadow.position.set(x, 0.29, z);
        scene.add(rig.root, shadow);
        const a = { actor, rig, root: rig.root, shadow, aura: (entity.look || (v && v.look) || {}).aura ? auraFor(entity.look || v.look, fx) : null };
        st.actors.push(a);
        return a;
    }

    /** One hero, big, centred above the bottom sheet. sheet = fraction of screen covered by UI at the bottom. */
    st.showOne = (entity, opts = {}) => {
        st.clear();
        st.mode = 'single';
        st.sheet = opts.sheet ?? 0.5;
        st.top = opts.top ?? 0.12;
        const p = pedestal(0.95); scene.add(p); pedestals.push(p);
        const a = add(entity, 0, 0, 1);
        a.actor.root.rotation.y = st.spin = opts.angle ?? 0.25;
        st.focusY = 0.24 + a.rig.height * 0.5;
        st.needH = a.rig.height + 0.42;
        st.subject = a;
        if (opts.element) st.setTheme(opts.element);
        st.frame();
        return a;
    };

    /** Up to five heroes in a shallow arc (team line-up / title). */
    st.showMany = (entities, opts = {}) => {
        st.clear();
        st.mode = 'many';
        st.sheet = opts.sheet ?? 0.45;
        const n = entities.length;
        const xs = [0, -1.3, 1.3, -2.5, 2.5];
        entities.forEach((e, i) => {
            if (!e) return;
            const x = n === 1 ? 0 : xs[i], z = -Math.abs(xs[i]) * 0.25;
            const p = pedestal(0.55); p.position.set(x, 0, z); p.scale.setScalar(0.9); scene.add(p); pedestals.push(p);
            const a = add(e, x, z, 0.92);
            a.actor.root.rotation.y = -x * 0.12;
            a.actor.root.position.y = 0.25;
        });
        st.focusY = 0.8;
        st.subject = null;
        st.frame();
    };

    st.setTheme = (el) => {
        const E = ELEMENT[el] || ELEMENT.dark;
        setSky(sky, shade(E.dark, -0.3), '#0e0a1c', shade(E.color, -0.35));
        scene.fog.color.set(shade(E.dark, -0.55));
        spot.color.set(E.glow);
        for (const p of pedestals) p.userData.rune.material.color.set(E.glow);
    };

    st.frame = () => {
        const portrait = size.w / size.h < 0.9;
        if (st.mode === 'single') {
            // keep the hero in the visible strip above the sheet
            // fit the hero (plus pedestal and headroom) into the strip between the top HUD and the sheet
            camera.fov = portrait ? 34 : 28;
            const tanH = Math.tan((camera.fov * Math.PI / 180) / 2);
            const T = st.top ?? 0.12;
            const vis = Math.max(0.2, 1 - st.sheet - T);
            const need = st.needH || st.focusY * 2 + 0.3;
            const dist = Math.max(2.6, need / (vis * 2 * tanH));
            const c = T + vis / 2;
            const lookY = st.focusY + (c - 0.5) * 2 * tanH * dist;
            camera.position.set(0, lookY + 0.25, dist);
            camera.lookAt(0, lookY, 0);
        } else {
            const dist = portrait ? 9.2 : 6.6;
            camera.fov = portrait ? 38 : 30;
            const vis = 1 - st.sheet;
            const shift = (1 - vis) * 0.5 * 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
            camera.position.set(0, 1.6 - shift * 0.6, dist);
            camera.lookAt(0, st.focusY - shift, 0);
        }
        camera.updateProjectionMatrix();
        fx.setScale(size.h);
    };
    st.resize = () => st.frame();

    st.drag = (dx) => { st.spinVel = dx * 0.012; };
    st.subjectActor = () => st.subject && st.subject.actor;

    st.update = (dt) => {
        st.time += dt;
        if (st.mode === 'single' && st.subject) {
            st.spin += st.spinVel;
            st.spinVel *= Math.pow(0.02, dt);
            st.subject.actor.root.rotation.y = st.spin;
        }
        for (const a of st.actors) {
            a.actor.update(dt);
            if (a.aura) a.aura(dt, a.actor.root.position, a.rig.height);
        }
        for (const p of pedestals) p.userData.rune.rotation.z += dt * 0.15;
        fx.update(dt);
    };

    st.frame();
    return st;
}
