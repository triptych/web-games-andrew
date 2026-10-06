// creatures.js — the denizens of the deep and the animation for every sea event.
// Each play function animates its event and leaves board.items matching the
// simulation's board afterwards (main.js double-checks and resyncs if not).

import * as THREE from 'three';
import { toon, NO_OUTLINE, PALETTE } from './toon.js';
import { createGhost, place } from './ships.js';
import { squarePos } from './board3d.js';
import { tween, wait, ease, lerp, lerpAngle } from './anim.js';
import { setWeather, lightningFlash } from './stage.js';
import { KING, QUEEN } from '../sim/chess.js';

// ------------------------------------------------------------------ tapered tubes
/** A tube whose radius tapers along its length, rebuilt from control points each frame. */
class TaperTube {
    constructor(segs, radial, radiusFn, colorFn, mat) {
        this.segs = segs; this.radial = radial; this.radiusFn = radiusFn;
        const n = (segs + 1) * (radial + 1);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
        const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
        const c = new THREE.Color();
        for (let i = 0; i <= segs; i++) {
            for (let j = 0; j <= radial; j++) {
                const k = i * (radial + 1) + j;
                uv[k * 2] = i / segs; uv[k * 2 + 1] = j / radial;
                colorFn(i / segs, (j / radial) * Math.PI * 2, c);
                col.set([c.r, c.g, c.b], k * 3);
            }
        }
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const idx = [];
        for (let i = 0; i < segs; i++) {
            for (let j = 0; j < radial; j++) {
                const a = i * (radial + 1) + j, b = a + radial + 1;
                idx.push(a, a + 1, b, b, a + 1, b + 1);   // outward: (d/dj) x (d/di) is +normal
            }
        }
        g.setIndex(idx);
        this.geo = g;
        this.mesh = new THREE.Mesh(g, mat);
        this.mesh.frustumCulled = false;
        this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
        this._p = new THREE.Vector3(); this._n = new THREE.Vector3();
    }

    update(points) {
        if (points.some((p) => !Number.isFinite(p.x + p.y + p.z))) return;
        // A fresh curve each time: Curve caches arc lengths, which go stale when points move.
        this.curve = new THREE.CatmullRomCurve3(points);
        const frames = this.curve.computeFrenetFrames(this.segs, false);
        const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array;
        const R = this.radial;
        for (let i = 0; i <= this.segs; i++) {
            const t = i / this.segs;
            this.curve.getPointAt(t, this._p);
            const N = frames.normals[i], B = frames.binormals[i];
            const r = this.radiusFn(t);
            for (let j = 0; j <= R; j++) {
                const a = (j / R) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
                const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
                const k = (i * (R + 1) + j) * 3;
                pos[k] = this._p.x + nx * r; pos[k + 1] = this._p.y + ny * r; pos[k + 2] = this._p.z + nz * r;
                nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
            }
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.normal.needsUpdate = true;
    }
}

const vcol = (soft = false) => toon(0xffffff, { vertexColors: true, soft });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const up = V(0, 1, 0);

function eye(group, x, y, z, r, look = V(0, 0, 1)) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), toon(0xffffff));
    white.position.set(x, y, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.52, 12, 10), toon(0x1a1420));
    pupil.position.copy(look).multiplyScalar(r * 0.62);
    white.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), toon(0xffffff, { outline: NO_OUTLINE }));
    glint.position.copy(look).multiplyScalar(r * 0.95).add(V(r * 0.2, r * 0.25, 0));
    white.add(glint);
    group.add(white);
    return white;
}

// ------------------------------------------------------------------ Kraken
function krakenHead() {
    const g = new THREE.Group();
    const purple = toon(0x8e4cc2);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 20), purple);
    dome.scale.set(1, 1.15, 0.95);
    g.add(dome);
    // spots
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 1.6 - 0.8 + Math.PI, b = 0.5 + (i % 3) * 0.3;
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 2) * 0.05, 10, 8), toon(0xc489f0, { outline: NO_OUTLINE }));
        s.position.set(Math.sin(a) * Math.cos(b) * 0.98, Math.sin(b) * 1.1, Math.cos(a) * Math.cos(b) * 0.92);
        s.scale.set(1, 1, 0.3);
        s.lookAt(s.position.clone().multiplyScalar(2));
        g.add(s);
    }
    const eyes = [eye(g, -0.36, 0.28, 0.78, 0.26), eye(g, 0.36, 0.28, 0.78, 0.26)];
    const browMat = toon(0x5a2a86);
    for (const s of [-1, 1]) {
        const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), browMat);
        brow.position.set(s * 0.36, 0.6, 0.86);
        brow.rotation.z = Math.PI / 2 + s * 0.35;
        g.add(brow);
    }
    g.userData.eyes = eyes;
    return g;
}

const tentacleColor = (t, a, c) => {
    const under = Math.sin(a) > 0.35;
    if (under && Math.sin(t * 60) > 0.1) c.set(0xffc2e6);
    else if (under) c.set(0xf08fc8);
    else c.set(0x8e4cc2).lerp(new THREE.Color(0xb57be0), t);
};

function tentaclePose(base, target, rise, curl, sink, time, i) {
    const dir = new THREE.Vector3(target.x - base.x, 0, target.z - base.z).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const w = Math.sin(time * 3.2 + i * 2) * 0.12;
    const pts = [
        base.clone().add(V(0, -0.9, 0)),
        base.clone().add(V(0, 0.4 * rise, 0)).addScaledVector(dir, -0.12).addScaledVector(perp, w * 0.3),
        base.clone().add(V(0, 1.0 * rise, 0)).addScaledVector(dir, 0.1 + 0.25 * curl).addScaledVector(perp, w),
        new THREE.Vector3().lerpVectors(base.clone().add(V(0, 1.45 * rise, 0)).addScaledVector(dir, 0.05).addScaledVector(perp, w * 1.5),
            target.clone().add(V(0, 0.85, 0)).addScaledVector(dir, 0.15), curl),
        new THREE.Vector3().lerpVectors(base.clone().add(V(0, 1.75 * rise, 0)).addScaledVector(dir, -0.15).addScaledVector(perp, w * 2),
            target.clone().add(V(0, 0.22, 0)).addScaledVector(perp, 0.22 * (i % 2 ? 1 : -1)).addScaledVector(dir, -0.12), curl),
    ];
    for (const p of pts) p.y -= sink * 2.2;
    return pts;
}

async function playKraken(ev, ctx) {
    const { board, fx, sfx, scene, clockT } = ctx;
    const it = board.items.get(ev.sq);
    const target = squarePos(ev.sq);
    sfx?.kraken();
    // The head surfaces beyond the dock on the nearest side, looking at its prey.
    const head = krakenHead();
    // Surface beside the board, never between the camera and the prey.
    const cam = ctx.camera.position;
    const spots = [V(6.4, -2.4, target.z * 0.8), V(-6.4, -2.4, target.z * 0.8), V(target.x * 0.8, -2.4, 6.4), V(target.x * 0.8, -2.4, -6.4)];
    const score = (p) => Math.hypot(p.x - target.x, p.z - target.z) - 0.9 * Math.hypot(p.x - cam.x, p.z - cam.z);
    const hp = spots.sort((a, b) => score(a) - score(b))[0];
    head.position.copy(hp);
    head.lookAt(target.x, -1.5, target.z);
    scene.add(head);
    const tents = [];
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
        const tt = new TaperTube(48, 10, (t) => 0.11 * Math.pow(1 - t, 0.8) + 0.012, tentacleColor, vcol());
        const a = a0 + (i / 3) * Math.PI * 2;
        tt.base = target.clone().add(V(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62));
        tt.update(tentaclePose(tt.base, target, 0, 0, 0, 0, i));
        scene.add(tt.mesh);
        tents.push(tt);
        fx.splash(tt.base, 0.7);
    }
    const st = { rise: 0, curl: 0, sink: 0 };
    const pose = () => tents.forEach((tt, i) => tt.update(tentaclePose(tt.base, target, st.rise, st.curl, st.sink, clockT(), i)));
    const headUp = tween(1.0, (k) => { head.position.y = lerp(-2.4, -0.55, k); }, ease.out);
    await tween(0.9, (k) => { st.rise = k; pose(); }, ease.out);
    await headUp;
    await tween(0.55, (k) => { st.curl = k; pose(); if (it) it.body.rotation.z = Math.sin(k * 20) * 0.08; }, ease.inOut);
    sfx?.splash();
    board.items.delete(ev.sq);
    if (it) {
        it.sinking = true;
        const p0 = it.root.position.clone();
        fx.bubbles(p0, 16, 1.3);
    }
    await tween(1.0, (k) => {
        st.sink = k * k; pose();
        if (it) { it.root.position.y = -k * k * 2.2; it.body.rotation.z = 0.4 * k; it.body.rotation.x = -0.3 * k; }
        if (k > 0.3 && k < 0.34) fx.splash(target, 1.3);
    }, ease.inOut);
    if (it) board.disposeItem(it);
    await tween(0.7, (k) => { head.position.y = lerp(-0.55, -2.6, k); }, ease.in);
    for (const tt of tents) { scene.remove(tt.mesh); tt.geo.dispose(); }
    scene.remove(head);
}

// ------------------------------------------------------------------ Mermaid
function mermaidModel() {
    const g = new THREE.Group();
    const skin = toon(0xf6c8a6);
    const tail = new TaperTube(28, 10, (t) => 0.075 * (1 - t * 0.78) + 0.01 * Math.sin(t * Math.PI),
        (t, a, c) => { c.set(0x2fc4a5).lerp(new THREE.Color(0x1f8fb8), t); if (Math.sin(t * 50 + Math.sin(a * 3) * 2) > 0.6) c.lerp(new THREE.Color(0xa6f5e0), 0.6); }, vcol(true));
    tail.update([V(0, 0.02, 0), V(0, -0.15, 0.04), V(0, -0.32, 0.14), V(0, -0.42, 0.32), V(0, -0.4, 0.45)]);
    g.add(tail.mesh);
    const finMat = toon(0x55e0c4, { side: THREE.DoubleSide });
    const fins = new THREE.Group();
    for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 3), finMat);
        fin.scale.set(1, 1, 0.25);
        fin.position.set(s * 0.07, 0, 0.08);
        fin.rotation.set(Math.PI / 2 - 0.2, 0, s * 0.7);
        fins.add(fin);
    }
    fins.position.set(0, -0.38, 0.46);
    g.add(fins);
    g.userData.fins = fins;
    const prof = [V(0.0, 0, 0), V(0.075, 0.0, 0), V(0.07, 0.06, 0), V(0.085, 0.15, 0), V(0.075, 0.2, 0), V(0.03, 0.235, 0), V(0.0, 0.24, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), skin);
    torso.scale.z = 0.8;
    g.add(torso);
    for (const s of [-1, 1]) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xc59be6));
        shell.position.set(s * 0.035, 0.14, -0.05);
        shell.rotation.x = -Math.PI / 2;
        g.add(shell);
    }
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.012, 6, 18), toon(0xffd166));
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = 0.8;
    belt.position.y = 0.01;
    g.add(belt);
    const headG = new THREE.Group();
    headG.position.y = 0.31;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), skin);
    headG.add(head);
    eye(headG, -0.026, 0.008, -0.062, 0.016, V(0, 0, -1));
    eye(headG, 0.026, 0.008, -0.062, 0.016, V(0, 0, -1));
    const blush = toon(0xff9aa8, { outline: NO_OUTLINE });
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), blush); b.position.set(s * 0.045, -0.02, -0.058); b.scale.z = 0.3; headG.add(b); }
    const hairMat = vcol(true);
    for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.2;
        const h = new TaperTube(16, 6, (t) => 0.03 * (1 - t) + 0.008, (t, _, c) => c.set(0xff6f61).lerp(new THREE.Color(0xff9f5a), t), hairMat);
        h.update([V(Math.sin(a) * 0.05, 0.06, 0.01), V(Math.sin(a) * 0.08, 0.02, 0.06), V(Math.sin(a) * 0.1, -0.08, 0.1), V(Math.sin(a) * 0.09, -0.2, 0.12 + Math.cos(a) * 0.02)]);
        headG.add(h.mesh);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), toon(0xffe066));
    star.position.set(0.05, 0.06, -0.03);
    headG.add(star);
    g.add(headG);
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new TaperTube(12, 6, (t) => 0.02 - t * 0.008, (t, _, c) => c.set(0xf6c8a6), vcol());
        arm.side = s;
        g.add(arm.mesh);
        arms.push(arm);
    }
    g.userData.arms = arms;
    g.userData.pose = (time) => {
        for (const arm of arms) {
            const s = arm.side;
            const wave = s > 0 ? Math.sin(time * 6) * 0.05 : 0;
            arm.update(s > 0
                ? [V(0.075, 0.2, 0), V(0.13, 0.27, -0.02), V(0.15 + wave, 0.38, -0.04), V(0.13 + wave * 1.5, 0.46, -0.05)]
                : [V(-0.075, 0.2, 0), V(-0.12, 0.13, -0.02), V(-0.1, 0.06, -0.08), V(-0.05, 0.05, -0.1)]);
        }
        headG.rotation.z = Math.sin(time * 1.7) * 0.12;
        fins.rotation.x = Math.sin(time * 3) * 0.3;
    };
    g.userData.pose(0);
    g.scale.setScalar(1.9);
    return g;
}

async function playMermaid(ev, ctx) {
    const { board, fx, sfx, scene, clockT } = ctx;
    const it = board.items.get(ev.from);
    const a = squarePos(ev.from), b = squarePos(ev.to);
    const dir = b.clone().sub(a).normalize();
    const m = mermaidModel();
    const start = b.clone().addScaledVector(dir, 0.55);
    m.position.set(start.x, -1.0, start.z);
    // Face mostly towards the camera (so she's seen singing), a little towards her ship.
    const toShip = Math.atan2(dir.x, dir.z);
    const toCam = Math.atan2(-(ctx.camera.position.x - start.x), -(ctx.camera.position.z - start.z));
    m.rotation.y = lerpAngle(toShip, toCam, 0.75);
    scene.add(m);
    sfx?.mermaid();
    fx.splash(start, 0.6);
    let noteT = 0;
    await tween(0.8, (k, raw) => { m.position.y = lerp(-1.0, -0.05, k); m.userData.pose(clockT()); }, ease.out);
    await tween(1.0, () => {
        m.userData.pose(clockT());
        if ((noteT++ % 9) === 0) fx.notes(m.position.clone().add(V(0, 0.8, 0)));
    }, ease.linear);
    if (it) {
        const sailing = board.sail(it, ev.to, { dur: 1.5, faceHome: true });
        await tween(1.5, (k) => {
            m.userData.pose(clockT());
            m.position.x = lerp(start.x, start.x + dir.x * 0.5, k);
            m.position.z = lerp(start.z, start.z + dir.z * 0.5, k);
            if ((noteT++ % 10) === 0) fx.notes(m.position.clone().add(V(0, 0.8, 0)));
        }, ease.inOut);
        await sailing;
        board.rekey([{ item: it, to: ev.to }]);
    }
    // Dive: tip forward, flick the tail and vanish.
    sfx?.splash();
    const ry = m.rotation.y;
    await tween(0.9, (k) => {
        m.userData.pose(clockT());
        m.rotation.set(-k * 1.4, ry + Math.PI * Math.min(1, k * 3), 0, 'YXZ');
        m.position.y = -0.05 - k * k * 1.4;
        if (k > 0.55 && k < 0.6) fx.splash(m.position, 0.8);
    }, ease.in);
    scene.remove(m);
}

// ------------------------------------------------------------------ Storm
async function playStorm(ev, ctx) {
    const { board, fx, sfx, scene } = ctx;
    const wind = {
        north: V(0, 0, -1), south: V(0, 0, 1), east: V(1, 0, 0), west: V(-1, 0, 0),
    }[ev.wind];
    sfx?.storm();
    const clouds = new THREE.Group();
    const cm = toon(0x77808f, { soft: true });
    // A ring of thunderheads around the dock, never between the camera and the board.
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2, d = 9 + Math.random() * 4;
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random() * 1.2, 1), cm);
        c.position.set(Math.cos(a) * d, 4.5 + Math.random() * 2.5, Math.sin(a) * d);
        c.scale.y = 0.6;
        clouds.add(c);
    }
    clouds.position.copy(wind).multiplyScalar(-14);
    scene.add(clouds);
    fx.setRain(true, wind.clone().multiplyScalar(4));
    const darken = setWeather(1, 0.9);
    await tween(1.0, (k) => { clouds.position.copy(wind).multiplyScalar(-14 * (1 - k)); }, ease.out);
    await darken;
    const bolt = async () => {
        sfx?.thunder();
        const pts = [];
        let p = V((Math.random() - 0.5) * 8, 6.5, (Math.random() - 0.5) * 8);
        for (let i = 0; i < 9; i++) { pts.push(p.clone()); p = p.clone().add(V((Math.random() - 0.5) * 0.8, -0.8, (Math.random() - 0.5) * 0.8)); }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfffbd0 }));
        line.material.userData.outlineParameters = NO_OUTLINE;
        scene.add(line);
        await lightningFlash(1);
        scene.remove(line);
    };
    await bolt();
    const items = ev.changes.map((c) => ({ c, it: board.items.get(c.from) })).filter((x) => x.it);
    let s = 0;
    const along = Math.abs(wind.z) > 0;
    await Promise.all([
        ...items.map(({ c, it }) => {
            if (along) it.pitch = 0; else it.lean = 0;
            return board.sail(it, c.to, { dur: 1.1, turn: false, wake: true, lean: (along ? 0 : 0.25 * -wind.x) });
        }),
        tween(1.1, () => {
            if ((s++ % 2) === 0) for (let i = 0; i < 2; i++) fx.streak(V((Math.random() - 0.5) * 9, 0.4 + Math.random() * 1.5, (Math.random() - 0.5) * 9), wind);
        }, ease.linear),
    ]);
    board.rekey(items.map(({ c, it }) => ({ item: it, to: c.to })));
    bolt();
    await wait(0.4);
    fx.setRain(false);
    const clear = setWeather(0, 1.2);
    await tween(1.2, (k) => { clouds.position.copy(wind).multiplyScalar(16 * k); }, ease.in);
    await clear;
    scene.remove(clouds);
}

// ------------------------------------------------------------------ Whirlpool
function whirlDisk() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uT: { value: 0 }, uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
            uniform float uT, uA; varying vec2 vUv;
            void main(){
                vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
                float a = atan(p.y, p.x);
                float s = sin(a * 4.0 + log(r + 0.02) * 9.0 + uT * 6.0);
                vec3 col = mix(vec3(0.05, 0.28, 0.45), vec3(0.2, 0.55, 0.75), r);
                if (s > 0.55) col = vec3(0.92, 0.98, 1.0);
                float alpha = smoothstep(1.0, 0.75, r) * uA;
                gl_FragColor = vec4(col, alpha * 0.9);
                #include <colorspace_fragment>
            }`,
    });
    mat.userData.outlineParameters = NO_OUTLINE;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2), mat);
    m.position.y = 0.015;
    m.renderOrder = 3;
    return m;
}

async function playWhirlpool(ev, ctx) {
    const { board, fx, sfx, scene } = ctx;
    const c = squarePos(ev.centre);
    const disk = whirlDisk();
    disk.position.x = c.x; disk.position.z = c.z;
    scene.add(disk);
    sfx?.whirl();
    let t = 0;
    await tween(0.6, (k) => { disk.material.uniforms.uA.value = k; disk.scale.setScalar(0.2 + 0.8 * k); disk.material.uniforms.uT.value = (t += 0.016); }, ease.out);
    const items = ev.changes.map((ch) => ({ ch, it: board.items.get(ch.from) })).filter((x) => x.it);
    const centreItem = board.items.get(ev.centre);
    const paths = items.map(({ ch, it }) => {
        const a = squarePos(ch.from), b = squarePos(ch.to);
        return { it, ch, a0: Math.atan2(a.z - c.z, a.x - c.x), a1: Math.atan2(b.z - c.z, b.x - c.x), r0: Math.hypot(a.x - c.x, a.z - c.z), r1: Math.hypot(b.x - c.x, b.z - c.z), y0: it.root.rotation.y };
    });
    await tween(1.5, (k) => {
        disk.material.uniforms.uT.value = (t += 0.016);
        disk.rotation.y = -k * 3;
        for (const p of paths) {
            const ang = lerpAngle(p.a0, p.a1, k), r = lerp(p.r0, p.r1, k) - Math.sin(Math.PI * k) * 0.18;
            p.it.root.position.set(c.x + Math.cos(ang) * r, -Math.sin(Math.PI * k) * 0.08, c.z + Math.sin(ang) * r);
            p.it.root.rotation.y = p.y0 - k * Math.PI * 2;
        }
        if (centreItem) centreItem.root.rotation.y = -k * Math.PI * 4;
    }, ease.inOut);
    for (const p of paths) { p.it.root.rotation.y = 0; p.it.root.position.y = 0; }
    if (centreItem) centreItem.root.rotation.y = 0;
    board.rekey(paths.map((p) => ({ item: p.it, to: p.ch.to })));
    fx.splash(c, 0.6);
    await tween(0.5, (k) => { disk.material.uniforms.uA.value = 1 - k; disk.material.uniforms.uT.value = (t += 0.016); }, ease.in);
    scene.remove(disk);
}

// ------------------------------------------------------------------ Dolphins
function dolphinModel() {
    const prof = [[0, 0], [0.02, 0.02], [0.025, 0.06], [0.045, 0.1], [0.075, 0.16], [0.085, 0.25], [0.07, 0.36], [0.045, 0.45], [0.022, 0.53], [0.012, 0.58]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.LatheGeometry(prof, 18);
    body.rotateX(Math.PI / 2);         // nose at z = 0, tail along +z
    body.translate(0, 0, -0.3);
    const pos = body.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        c.set(pos.getY(i) > -0.015 ? 0x5b9fd6 : 0xe9f4fb);
        col.set([c.r, c.g, c.b], i * 3);
    }
    body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body, vcol()));
    const blue = toon(0x5b9fd6);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 3), blue);
    dorsal.scale.z = 0.3; dorsal.position.set(0, 0.1, -0.02); dorsal.rotation.x = -0.4; dorsal.rotation.y = Math.PI / 2;
    g.add(dorsal);
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 3), blue);
    fluke.scale.set(1.6, 1, 0.25); fluke.rotation.x = Math.PI / 2; fluke.position.set(0, 0, 0.3);
    g.add(fluke);
    for (const s of [-1, 1]) {
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 3), blue);
        fl.scale.z = 0.3; fl.position.set(s * 0.07, -0.04, -0.12); fl.rotation.set(0.6, 0, s * 1.2);
        g.add(fl);
    }
    eye(g, -0.04, 0.015, -0.2, 0.012, V(-1, 0, 0));
    eye(g, 0.04, 0.015, -0.2, 0.012, V(1, 0, 0));
    g.scale.setScalar(1.6);
    return g;
}

async function playDolphins(ev, ctx) {
    const { board, fx, sfx, scene } = ctx;
    const it = board.items.get(ev.from);
    const a = squarePos(ev.from), b = squarePos(ev.to);
    const fwd = b.clone().sub(a).normalize();
    const side = V(-fwd.z, 0, fwd.x);
    const pods = [0.42, -0.42].map((s) => {
        const d = dolphinModel();
        scene.add(d);
        return { d, s };
    });
    sfx?.dolphin();
    const jumps = pods.map(({ d, s }, i) => (async () => {
        await wait(i * 0.25);
        const p0 = a.clone().addScaledVector(side, s).addScaledVector(fwd, -0.9);
        const p1 = b.clone().addScaledVector(side, s).addScaledVector(fwd, 0.9);
        fx.splash(p0, 0.5);
        await tween(1.25, (k) => {
            const p = new THREE.Vector3().lerpVectors(p0, p1, k);
            p.y = Math.sin(Math.PI * k) * 0.95 - 0.25;
            d.position.copy(p);
            const vy = Math.cos(Math.PI * k);
            // lookAt aims +z; the nose is -z, so aim +z backwards along the velocity.
            d.lookAt(p.clone().sub(fwd).add(V(0, -vy * 0.9, 0)));
        }, ease.linear);
        fx.splash(p1, 0.6);
        scene.remove(d);
    })());
    if (it) {
        await wait(0.3);
        await board.sail(it, ev.to, { dur: 1.0, turn: false });
        board.rekey([{ item: it, to: ev.to }]);
    }
    await Promise.all(jumps);
    const promo = ev.changes.find((c) => c.k === 'promote');
    if (promo) {
        sfx?.promote();
        const cur = board.items.get(promo.sq);
        if (cur) await board.transform(cur, promo.to);
    }
}

// ------------------------------------------------------------------ Ghost ship
let ghostMat = null;
async function playGhost(ev, ctx) {
    const { board, fx, sfx, scene } = ctx;
    if (!ghostMat) {
        ghostMat = new THREE.MeshToonMaterial({ color: 0xbaffdf, emissive: 0x3cffa0, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
        ghostMat.userData.outlineParameters = { thickness: 0.004, color: [0.2, 0.75, 0.5], alpha: 0.6 };
    }
    const ghost = createGhost(KING, 1, ghostMat);
    const z = 3.5 - ev.rank;
    const dir = ev.dir || 1;
    ghost.root.scale.setScalar(1.25);
    ghost.root.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    ghost.root.position.set(-dir * 6.4, 0.18, z);
    scene.add(ghost.root);
    sfx?.ghost();
    const pending = ev.changes.map((c) => ({ c, it: board.items.get(c.from), x: squarePos(c.from).x, started: null }));
    let m = 0;
    await tween(3.2, (k, raw) => {
        const x = lerp(-dir * 6.4, dir * 6.4, raw);
        ghost.root.position.x = x;
        ghost.root.position.y = 0.2 + Math.sin(raw * 12) * 0.05;
        ghost.body.rotation.z = Math.sin(raw * 9) * 0.06;
        if ((m++ % 4) === 0) fx.mist(ghost.root.position.clone().add(V(-dir * 0.5, 0.2, 0)), 1);
        for (const p of pending) {
            if (p.started || !p.it) continue;
            if ((x - p.x) * dir > -0.9) {
                p.it.lean = 0;
                p.started = board.sail(p.it, p.c.to, { dur: 0.55, turn: false, ease: ease.out });
                sfx?.creak();
            }
        }
    }, ease.linear);
    await Promise.all(pending.map((p) => p.started));
    board.rekey(pending.filter((p) => p.it).map((p) => ({ item: p.it, to: p.c.to })));
    scene.remove(ghost.root);
}

// ------------------------------------------------------------------ Salvage
async function playSalvage(ev, ctx) {
    const { board, fx, sfx } = ctx;
    const p = squarePos(ev.sq);
    sfx?.salvage();
    fx.bubbles(p, 24, 1.2);
    await wait(0.8);
    const it = board.makeItem(ev.piece, ev.sq);
    board.items.set(ev.sq, it);
    await board.rise(it, 1.1);
    fx.sparkle(p, 22);
    await wait(0.3);
}

// ------------------------------------------------------------------ Sea serpent
function serpentHead() {
    const g = new THREE.Group();
    const green = toon(0x2fb36f);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), green);
    head.scale.set(0.85, 0.75, 1.3);
    g.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), toon(0x45c985));
    snout.scale.set(0.9, 0.6, 1.1);
    snout.position.set(0, -0.03, -0.17);
    g.add(snout);
    eye(g, -0.08, 0.07, -0.08, 0.05, V(-0.6, 0.2, -0.8).normalize());
    eye(g, 0.08, 0.07, -0.08, 0.05, V(0.6, 0.2, -0.8).normalize());
    const finMat = toon(0xffc24a, { side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 3), finMat);
        fin.scale.z = 0.25; fin.rotation.y = Math.PI / 2; fin.rotation.x = -0.5;
        fin.position.set(0, 0.13 - i * 0.02, 0.02 + i * 0.09);
        g.add(fin);
    }
    for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), toon(0xfff1c2));
        horn.position.set(s * 0.08, 0.13, 0.08); horn.rotation.x = 0.8;
        g.add(horn);
    }
    return g;
}

async function playSerpent(ev, ctx) {
    const { board, fx, sfx, scene } = ctx;
    const A = squarePos(ev.a), C = squarePos(ev.c);
    const dir = C.clone().sub(A).normalize();
    const perp = V(-dir.z, 0, dir.x);
    const len = 3.2;
    const start = A.clone().addScaledVector(dir, -1.4).addScaledVector(perp, 0.55);
    const end = C.clone().addScaledVector(dir, 1.4 + len).addScaledVector(perp, 0.55);
    // Banded rather than striped: the tube's frame twists, so a belly stripe would wander to the top.
    const body = new TaperTube(72, 12, (t) => 0.03 + 0.12 * Math.pow(t, 0.55),
        (t, a, c) => {
            const band = Math.sin(t * 46);
            c.set(band > 0.72 ? 0xffd35a : 0x2fb36f);
            if (band < -0.6 && Math.sin(a * 3) > 0.3) c.set(0x1f8a55);
        }, vcol());
    const head = serpentHead();
    head.scale.setScalar(1.45);
    scene.add(body.mesh, head);
    sfx?.serpent();
    const itA = board.items.get(ev.a), itC = board.items.get(ev.c);
    let swapped = null;
    const pathAt = (s, phase, depth) => {
        const p = new THREE.Vector3().lerpVectors(start, end, s);
        p.y = Math.sin(s * 22 - phase) * 0.42 - 0.1 - depth;
        return p;
    };
    let splashT = 0;
    await tween(3.0, (k, raw) => {
        const headS = lerp(0.0, 1.0, raw);
        const depth = raw < 0.12 ? (0.12 - raw) * 6 : raw > 0.85 ? (raw - 0.85) * 7 : 0;
        const pts = [];
        for (let i = 0; i <= 7; i++) {
            const s = headS - (len / start.distanceTo(end)) * (1 - i / 7);
            pts.push(pathAt(s, raw * 8, depth));
        }
        const hp = pts[pts.length - 1];
        // The head rides above the waves even when the body dips into a trough,
        // and the neck (the last control point) rises to meet it.
        head.position.copy(hp);
        head.position.y = Math.max(hp.y, 0.08 - depth * 1.5) + 0.16;
        head.lookAt(head.position.clone().addScaledVector(dir, -1).add(V(0, 0.05, 0)));
        pts[pts.length - 1] = head.position.clone().add(V(0, -0.1, 0)).addScaledVector(dir, -0.12);
        body.update(pts);
        if ((splashT++ % 14) === 0) fx.splash(V(hp.x, 0, hp.z), 0.35);
        if (!swapped && raw > 0.42) {
            swapped = Promise.all([
                itA ? board.sail(itA, ev.c, { dur: 1.0, arc: 0.6, turn: false }) : null,
                itC ? board.sail(itC, ev.a, { dur: 1.0, arc: 0.35, turn: false }) : null,
            ]);
        }
    }, ease.linear);
    await swapped;
    const list = [];
    if (itA) list.push({ item: itA, to: ev.c });
    if (itC) list.push({ item: itC, to: ev.a });
    board.rekey(list);
    scene.remove(body.mesh, head);
    body.geo.dispose();
}

export const EVENT_PLAYERS = {
    kraken: playKraken, mermaid: playMermaid, storm: playStorm, whirlpool: playWhirlpool,
    dolphins: playDolphins, ghost: playGhost, salvage: playSalvage, serpent: playSerpent,
};

export async function playEvent(ev, ctx) {
    const fn = EVENT_PLAYERS[ev.type];
    if (fn) await fn(ev, ctx);
}

/** Build every creature once so their shaders compile before the first event. */
export function warmCreatures(scene, renderer, camera) {
    const g = new THREE.Group();
    g.add(krakenHead(), mermaidModel(), dolphinModel(), serpentHead(), whirlDisk());
    g.position.y = -50;
    scene.add(g);
    renderer.compile(scene, camera);
    scene.remove(g);
}
