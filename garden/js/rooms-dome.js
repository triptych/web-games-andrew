// The rooms off the Star Dome, the top floor of the Observatory: the
// Constellation Chamber (a planetarium dome; touch the sky and a constellation
// draws itself and gets a name), the Comet Kennel (home of Pip, a small and
// very good comet who eats stardust from a bowl) and the Aurora Chamber (an
// organ that plays the northern lights, under falling indoor snow).
// Room-local frame: the door is at +z, the back wall at -z (see tower.js).

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { TAU, damp, clamp, lerp, rng, smoothstep } from './util.js';
import { canvasTex, glow, motes, colorMotes, emissiveMat, plaqueMesh, textSprite, RAINBOW, ease } from './tower-kit.js';
import { PENTA } from './tower-audio.js';
import { pedestal, fern } from './rooms-hours.js';

const V3 = THREE.Vector3;

// ================================================================ the Constellation Chamber

const C_ADJ = ['Lesser', 'Greater', 'Sleeping', 'Dancing', 'Forgotten', 'Northern', 'Hungry', 'Patient', 'Upside-down', 'Distant', 'Bashful', 'Wandering', 'Polite', 'Tiny', 'Enormous', 'Startled'];
const C_NOUN = ['Teapot', 'Umbrella', 'Cat', 'Mitten', 'Lighthouse Keeper', 'Herring', 'Kettle', 'Accordion', 'Snail', 'Wheelbarrow', 'Owl', 'Biscuit Tin', 'Harp', 'Hedgehog', 'Lantern', 'Bicycle', 'Whale', 'Spoon', 'Gardener', 'Moth'];
const C_LORE = [
    'Sailors once steered by it, mostly into teashops.',
    'It rises in autumn and sets whenever it feels like it.',
    'Farmers say that when it is bright, the jam will set.',
    'Its brightest star is called Gerald.',
    'It is only visible to people who have just yawned.',
    'Astronomers argue about whether it is pointing at something.',
    'On clear nights you can hear it humming, very faintly.',
    'It was lost for three hundred years, under a cloud.',
];

const STAR_VERT = /* glsl */ `
attribute float aSize; attribute float aPh; attribute vec3 aCol;
uniform float uTime; varying vec3 vCol; varying float vTw;
void main() {
    vCol = aCol;
    vTw = 0.65 + 0.35 * sin(uTime * (1.5 + aPh) + aPh * 20.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * vTw * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol; varying float vTw;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = exp(-d * d * 28.0) + max(0.0, 1.0 - abs(p.x) * 30.0) * max(0.0, 1.0 - d * 2.2) * 0.4 + max(0.0, 1.0 - abs(p.y) * 30.0) * max(0.0, 1.0 - d * 2.2) * 0.4;
    gl_FragColor = vec4(vCol * a * vTw * 1.6, 1.0);
}`;

/** A sky of twinkling stars on a sphere about `c`, above `minY`. */
function starSphere(n, R, c, minY, seed) {
    const r = rng(seed);
    const pos = [], size = [], ph = [], col = [];
    const pts = [];
    while (pts.length < n) {
        const u = r() * 2 - 1, a = r() * TAU;
        const s = Math.sqrt(1 - u * u);
        const v = new V3(Math.cos(a) * s, Math.abs(u), Math.sin(a) * s).multiplyScalar(R).add(c);
        if (v.y < minY) continue;
        const bright = Math.pow(r(), 3);
        pts.push({ v, bright });
        pos.push(v.x, v.y, v.z);
        size.push(0.15 + bright * 0.9);
        ph.push(r() * 6);
        const t = r();
        const cc = new THREE.Color().setHSL(t < 0.3 ? 0.6 : t < 0.5 ? 0.08 : 0.12, t < 0.6 ? 0.6 : 0.1, 0.8);
        col.push(cc.r, cc.g, cc.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    const U = { uTime: { value: 0 } };
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.frustumCulled = false;
    return { mesh: m, U, pts };
}

export function buildConstellations(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    const C = new V3(0, 0.2, 0), R = 7.05;
    // the planetarium dome, deep blue, and a low ceiling-band where it meets the walls
    const domeTex = canvasTex(1024, 512, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#04061a');
        g.addColorStop(0.7, '#0a1238');
        g.addColorStop(1, '#1a1a48');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        // a faint river of milk
        for (let i = 0; i < 1800; i++) {
            const u = Math.random();
            const v = 0.45 + Math.sin(u * TAU * 2) * 0.12 + (Math.random() - 0.5) * 0.12;
            x.fillStyle = `rgba(180,170,255,${Math.random() * 0.06})`;
            x.beginPath();
            x.arc(u * w, v * h, 4 + Math.random() * 14, 0, TAU);
            x.fill();
        }
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide }));
    dome.position.copy(C);
    ctx.add(dome);
    const sky = starSphere(ctx.low ? 500 : 900, R - 0.1, C, 1.6, 'planetarium');
    ctx.add(sky.mesh);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(R - 0.2, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false, side: THREE.BackSide }));
    hit.position.copy(C);
    ctx.add(hit);
    // a brass star-projector in the middle
    pedestal(ctx, 0, -0.4, 0.95, 'The Star Projector', 'Touch the sky anywhere', 'darkWood');
    const proj = new THREE.Group();
    proj.position.set(0, 1.45, -0.4);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, metalness: 0.8, roughness: 0.3, flatShading: true }));
    proj.add(ball);
    for (let k = 0; k < 30; k++) {
        const v = new V3(r() - 0.5, r() - 0.5, r() - 0.5).setLength(0.345);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), emissiveMat(0xfff0c8, 3));
        dot.position.copy(v);
        proj.add(dot);
    }
    proj.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 40), ctx.mats.gold));
    const glo = glow(0x9ab8ff, 1.6, 0.35);
    proj.add(glo);
    ctx.add(proj);
    const projLight = ctx.light(0x8aa8ff, 7, 14, 0, 2.2, -0.4);

    const drawn = [];
    let told = false;
    const lineMat = () => new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    function constellation(at) {
        // the stars nearest the touch, chained nearest-first
        const near = sky.pts.filter((p) => p.bright > 0.1).map((p) => ({ p, d: p.v.distanceTo(at) })).sort((a, b) => a.d - b.d).slice(0, 6 + Math.floor(r() * 3)).map((o) => o.p);
        if (near.length < 3) return;
        const chain = [near.shift()];
        while (near.length) {
            const last = chain[chain.length - 1];
            near.sort((a, b) => a.v.distanceTo(last.v) - b.v.distanceTo(last.v));
            chain.push(near.shift());
        }
        const segs = [];
        for (let i = 1; i < chain.length; i++) segs.push([chain[i - 1].v.clone(), chain[i].v.clone()]);
        if (chain.length > 4 && r() < 0.6) segs.push([chain[chain.length - 1].v.clone(), chain[1 + Math.floor(r() * 2)].v.clone()]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs.length * 6), 3));
        const lines = new THREE.LineSegments(geo, lineMat());
        lines.frustumCulled = false;
        ctx.add(lines);
        const name = `The ${C_ADJ[Math.floor(r() * C_ADJ.length)]} ${C_NOUN[Math.floor(r() * C_NOUN.length)]}`;
        const cen = new V3();
        for (const c of chain) cen.add(c.v);
        cen.multiplyScalar(1 / chain.length).sub(C).multiplyScalar(0.9).add(C);
        const label = textSprite(name, { size: 0.42 });
        label.position.copy(cen).add(new V3(0, -0.4, 0));
        label.material.opacity = 0;
        ctx.add(label);
        const halos = chain.map((c) => {
            const h = glow(0xd8e8ff, 0.5, 0);
            h.position.copy(c.v);
            ctx.add(h);
            return h;
        });
        drawn.push({ lines, geo, segs, label, halos, t: 0 });
        if (drawn.length > 3) kill(drawn.shift());
        audio.arp(chain.map((_, i) => PENTA[6 + ((i * 2) % 9)]), 0.16, 0.04);
        ctx.say(`You found ${name}, ${chain.length} stars. ${C_LORE[Math.floor(r() * C_LORE.length)]}${told ? '' : ' Touch anywhere on the dome for another.'}`, 6000);
        told = true;
    }
    function kill(c) {
        for (const o of [c.lines, c.label, ...c.halos]) ctx.group.remove(o);
        c.geo.dispose();
        c.lines.material.dispose();
        c.label.material.map.dispose();
        c.label.material.dispose();
    }
    const local = new V3();
    ctx.hit(hit, {
        label: 'The night sky · touch it to find a constellation',
        range: 99,
        onClick: (h) => {
            local.set(h.local.x, h.point.y, h.local.z);
            constellation(local);
        },
    });
    ctx.hit(ball, {
        label: 'The star projector · click for a constellation',
        range: 6,
        onClick: () => {
            const a = r() * TAU, e = 0.5 + r() * 0.8;
            constellation(new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(R).add(C));
            spin = 1;
        },
    });
    let spin = 0;
    // benches round the projector
    for (const a of [0.9, -0.9, Math.PI]) {
        const x = Math.sin(a) * 2.6, z = -0.4 + Math.cos(a) * 2.6;
        ctx.box('velvet', 1.4, 0.12, 0.45, x, 0.45, z, a);
        ctx.box('darkWood', 1.3, 0.38, 0.35, x, 0.19, z, a);
        ctx.collide(x, z, 0.55);
    }

    return {
        update(dt, t) {
            sky.U.uTime.value = t;
            spin = Math.max(0, spin - dt * 0.5);
            proj.rotation.y += dt * (0.2 + spin * 3);
            glo.material.opacity = 0.3 + spin * 0.4 + Math.sin(t * 2) * 0.05;
            projLight.intensity = 6 + spin * 8;
            for (const c of drawn) {
                c.t += dt;
                const k = Math.min(1, c.t / 1.6);
                const p = c.geo.attributes.position;
                const n = c.segs.length;
                c.segs.forEach(([a, b], i) => {
                    const kk = clamp(k * n - i, 0, 1);
                    p.setXYZ(i * 2, a.x, a.y, a.z);
                    p.setXYZ(i * 2 + 1, lerp(a.x, b.x, kk), lerp(a.y, b.y, kk), lerp(a.z, b.z, kk));
                });
                p.needsUpdate = true;
                const fade = c.t > 14 ? Math.max(0, 1 - (c.t - 14) / 2) : 1;
                c.lines.material.opacity = 0.85 * fade;
                c.label.material.opacity = smoothstep(1.2, 2.0, c.t) * fade;
                c.halos.forEach((h, i) => (h.material.opacity = clamp(k * n - i + 1, 0, 1) * 0.7 * fade));
            }
            while (drawn.length && drawn[0].t > 16) kill(drawn.shift());
        },
    };
}

// ================================================================ the Comet Kennel

export function buildComet(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    // Pip's things: a cushion bed, a bowl of stardust and a ball of moonbeam
    const BED = new V3(-3.0, 0, -3.0), BOWL = new V3(2.6, 0, -2.8);
    ctx.mat('cushion', new THREE.MeshStandardMaterial({ color: 0x7a4ad8, roughness: 0.9 }));
    ctx.geo('cushion', new THREE.CylinderGeometry(0.95, 1.0, 0.28, 32), BED.x, 0.14, BED.z);
    ctx.geo('cushion', new THREE.TorusGeometry(0.95, 0.2, 10, 32).rotateX(Math.PI / 2), BED.x, 0.3, BED.z);
    ctx.geo('gold', new THREE.TorusGeometry(1.0, 0.03, 6, 40).rotateX(Math.PI / 2), BED.x, 0.15, BED.z);
    ctx.collide(BED.x, BED.z, 1.1);
    const name = plaqueMesh('PIP', 'A very good comet', 0.6);
    name.position.set(BED.x, 0.9, -D / 2 + 0.05);
    ctx.add(name);
    ctx.geo('silver', lathe([[0, 0], [0.32, 0], [0.42, 0.18], [0.44, 0.2], [0.36, 0.2], [0.3, 0.06], [0, 0.06]], 24), BOWL.x, 0, BOWL.z);
    ctx.collide(BOWL.x, BOWL.z, 0.55);
    const dustN = 50;
    const dust = colorMotes(dustN, 0.09, 0.95);
    const dc = dust.geometry.attributes.color;
    for (let i = 0; i < dustN; i++) {
        const c = new THREE.Color(RAINBOW[i % RAINBOW.length]).lerp(new THREE.Color(0xffffff), 0.4);
        dc.setXYZ(i, c.r, c.g, c.b);
    }
    ctx.add(dust);
    const dustPts = Array.from({ length: dustN }, () => ({ a: r() * TAU, d: Math.sqrt(r()) * 0.3, y: r() * 0.15, eaten: 0 }));
    const toy = new THREE.Group();
    toy.position.set(1.6, 0.18, 1.8);
    toy.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), emissiveMat(0xd8f0ff, 0.8)));
    for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.012, 6, 30), emissiveMat(0x9ad8ff, 1.5));
        t.rotation.set(k, k * 1.3, 0);
        toy.add(t);
    }
    ctx.add(toy);
    // Pip, and Pip's tail
    const pip = new THREE.Group();
    const headMat = emissiveMat(0xbffff0, 3, { color: 0xffffff });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), headMat);
    pip.add(head);
    const halo = glow(0x8affea, 1.5, 0.8);
    pip.add(halo);
    // two little eyes, so it is clearly a pet
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), ctx.mats.black);
        e.position.set(s * 0.06, 0.04, 0.14);
        pip.add(e);
    }
    ctx.add(pip);
    const TN = ctx.low ? 50 : 90;
    const tail = colorMotes(TN, 0.16, 0.9);
    ctx.add(tail);
    const hist = Array.from({ length: TN }, () => new V3(0, 3, 0));
    const pipLight = ctx.light(0x8affea, 9, 8, 0, 3, 0);
    ctx.light(0xc8b8ff, 9, 14, 0, ceil - 0.5, 1.5);
    const TAILS = ['#8affea', '#ff8af0', '#ffd84a', '#8aa8ff', '#9aff6a', '#ff8a5a'];
    let tailCol = new THREE.Color(TAILS[0]), tailI = 0, tailLen = 0.5;
    let mode = 'roam', modeT = 0, told = false;
    const pos = new V3(0, 3, 0), target = new V3(), cam = new V3(), prevPos = new V3();
    const setMode = (m) => {
        mode = m;
        modeT = 0;
    };
    ctx.proxy(1.0, 0.6, 1.0, BOWL.x, 0.3, BOWL.z, {
        label: 'A bowl of stardust · feed Pip',
        range: 5,
        onClick: () => {
            if (mode === 'eat') return;
            setMode('eat');
            audio.whoosh();
            for (const d of dustPts) d.eaten = 0;
        },
    });
    ctx.hit(head, {
        label: 'Pip, the comet · say hello',
        range: 12,
        onClick: () => {
            setMode('visit');
            audio.purr();
            ctx.say(['Pip zooms over and loops round your head, delighted. Good comet!', 'Pip does a lap of you and leaves a little sparkle in your hair.', 'Pip purrs (comets purr; nobody knows how).'][Math.floor(r() * 3)], 4200);
        },
    });
    ctx.proxy(2.2, 0.8, 2.2, BED.x, 0.3, BED.z, {
        label: 'Pip’s bed · time for a nap?',
        range: 6,
        onClick: () => {
            setMode('nap');
            audio.arp([74, 69, 66, 62], 0.2, 0.03);
            ctx.say('Pip curls up on the cushion, glowing softly, and is asleep almost at once.', 4200);
        },
    });
    ctx.hit(toy.children[0], {
        label: 'A ball of moonbeam · throw it',
        range: 5,
        onClick: () => {
            setMode('fetch');
            toyV.set((r() - 0.5) * 6, 5, -3 - r() * 2);
            audio.whoosh();
        },
    });
    const toyV = new V3(), toyHome = toy.position.clone();
    let zzz = textSprite('z z z', { size: 0.3, color: '#d8f0ff' });
    ctx.add(zzz);

    return {
        update(dt, t) {
            modeT += dt;
            ctx.camLocal(cam);
            prevPos.copy(pos);
            let speed = 3;
            if (mode === 'roam') {
                target.set(Math.sin(t * 0.42) * 3.3, 3.2 + Math.sin(t * 0.73) * 1.0, Math.sin(t * 0.61) * 2.7 + 0.2);
            } else if (mode === 'eat') {
                target.set(BOWL.x, 0.55, BOWL.z);
                speed = 5;
                if (pos.distanceTo(target) < 0.25) {
                    // munch: the stardust streams up into Pip
                    let left = 0;
                    for (const d of dustPts) {
                        if (d.eaten < 1 && Math.random() < dt * 4) d.eaten += dt * 3;
                        if (d.eaten < 1) left++;
                    }
                    if (Math.floor(modeT * 6) !== Math.floor((modeT - dt) * 6)) audio.bell(PENTA[10 + Math.floor(Math.random() * 5)], 0, 0.02);
                    if (left === 0 || modeT > 6) {
                        tailI = (tailI + 1) % TAILS.length;
                        tailCol = new THREE.Color(TAILS[tailI]);
                        tailLen = Math.min(1.6, tailLen + 0.25);
                        audio.purr();
                        ctx.say(told ? `Pip’s tail turns ${['seafoam', 'pink', 'gold', 'periwinkle', 'lime', 'tangerine'][tailI]}, and grows a little longer.` : 'Pip gobbles the stardust, purrs, and its tail grows longer and changes colour. What a good comet.', 4500);
                        told = true;
                        setMode('happy');
                        for (const d of dustPts) d.eaten = 0;
                    }
                }
            } else if (mode === 'happy') {
                const a = modeT * 5;
                target.set(BOWL.x - 1.2 + Math.cos(a) * 1.2, 1.5 + Math.sin(a) * 1.2, BOWL.z + 1);
                speed = 8;
                if (modeT > 2.6) setMode('roam');
            } else if (mode === 'visit') {
                const a = modeT * 3.2;
                target.set(cam.x + Math.cos(a) * 1.0, cam.y + 0.2 + Math.sin(a * 2) * 0.2, cam.z + Math.sin(a) * 1.0);
                speed = 9;
                if (modeT > 4.5) setMode('roam');
            } else if (mode === 'nap') {
                target.set(BED.x, 0.55, BED.z);
                speed = 2.5;
                if (modeT > 9) setMode('roam');
            } else if (mode === 'fetch') {
                // the toy flies, Pip chases it and brings it home
                if (modeT < 1.6) {
                    toyV.y -= dt * 7;
                    toy.position.addScaledVector(toyV, dt);
                    if (toy.position.y < 0.18) {
                        toy.position.y = 0.18;
                        toyV.multiplyScalar(0.5);
                        toyV.y = Math.abs(toyV.y);
                    }
                    toy.position.x = clamp(toy.position.x, -W / 2 + 0.4, W / 2 - 0.4);
                    toy.position.z = clamp(toy.position.z, -D / 2 + 0.4, D / 2 - 0.4);
                    target.copy(toy.position);
                    speed = 7;
                } else {
                    target.copy(toyHome).setY(0.6);
                    toy.position.copy(pos).setY(pos.y - 0.25);
                    speed = 4;
                    if (pos.distanceTo(target) < 0.3) {
                        toy.position.copy(toyHome);
                        audio.purr();
                        setMode('happy');
                    }
                }
            }
            const d = target.clone().sub(pos);
            const step = Math.min(d.length(), speed * dt);
            if (d.length() > 1e-4) pos.addScaledVector(d.normalize(), step);
            pip.position.copy(pos);
            pip.position.y += Math.sin(t * 3) * 0.04;
            const vel = pos.clone().sub(prevPos);
            if (vel.lengthSq() > 1e-6) pip.lookAt(pip.position.clone().add(vel));
            else pip.lookAt(cam);
            const napping = mode === 'nap' && modeT > 1.5;
            headMat.emissiveIntensity = napping ? 1.2 + Math.sin(t * 1.2) * 0.4 : 3;
            halo.material.color.copy(tailCol);
            halo.scale.setScalar(napping ? 1.0 : 1.4 + Math.sin(t * 5) * 0.1);
            pipLight.position.set(ctx.toFloor(pos.x, pos.z).x, pos.y, ctx.toFloor(pos.x, pos.z).z);
            pipLight.color.copy(tailCol);
            pipLight.intensity = napping ? 3 : 9;
            zzz.visible = napping;
            zzz.position.set(BED.x + 0.3, 0.9 + ((t * 0.4) % 1) * 0.5, BED.z);
            zzz.material.opacity = Math.sin(((t * 0.4) % 1) * Math.PI);
            // the tail: a trail of the last positions, spread out by how long the tail has grown
            hist.unshift(hist.pop().copy(pip.position));
            const tp = tail.geometry.attributes.position, tc = tail.geometry.attributes.color;
            const spacing = Math.max(1, Math.round(tailLen * 1.4));
            for (let i = 0; i < TN; i++) {
                const h = hist[Math.min(TN - 1, Math.floor(i * spacing * 0.5))];
                const k = i / TN;
                tp.setXYZ(i, h.x + Math.sin(i * 1.7 + t * 4) * 0.03 * k, h.y + Math.sin(i * 2.3 + t * 3) * 0.03 * k, h.z);
                const c = tailCol.clone().lerp(new THREE.Color(0xffffff), (1 - k) * 0.4).multiplyScalar((1 - k) * (napping ? 0.3 : 1));
                tc.setXYZ(i, c.r, c.g, c.b);
            }
            tp.needsUpdate = true;
            tc.needsUpdate = true;
            const dp = dust.geometry.attributes.position;
            dustPts.forEach((p, i) => {
                const a = p.a + t * 0.6;
                const bx = BOWL.x + Math.cos(a) * p.d, bz = BOWL.z + Math.sin(a) * p.d, by = 0.24 + p.y + Math.sin(t * 2 + i) * 0.03;
                const k = Math.min(1, p.eaten);
                dp.setXYZ(i, lerp(bx, pos.x, k), k >= 1 ? -10 : lerp(by, pos.y, k), lerp(bz, pos.z, k));
            });
            dp.needsUpdate = true;
            toy.rotation.y += dt;
        },
    };
}

// ================================================================ the Aurora Chamber

const AURORA_VERT = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 0.6 + uTime * 0.4) * 0.6 + sin(p.x * 1.7 - uTime * 0.7) * 0.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const AURORA_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uLow; uniform vec3 uHigh; uniform float uGain; uniform float uSeed;
varying vec2 vUv;
float h(float x) { return fract(sin(x * 127.1) * 43758.5); }
float n(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() {
    float x = vUv.x * 40.0 + uSeed * 10.0;
    float streak = n(x + uTime * 0.6) * 0.6 + n(x * 2.7 - uTime * 0.9) * 0.4;
    float fold = 0.5 + 0.5 * sin(vUv.x * 9.0 + uTime * 0.3 + uSeed);
    float bottom = smoothstep(0.0, 0.12, vUv.y);
    float top = 1.0 - smoothstep(0.35, 1.0, vUv.y);
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    vec3 col = mix(uLow, uHigh, smoothstep(0.1, 0.9, vUv.y));
    float a = streak * fold * bottom * top * edge * uGain;
    gl_FragColor = vec4(col * a * 1.6, 1.0);
}`;
const PALETTES = [
    { name: 'Emerald', low: '#2aff8a', high: '#7a3aff', chord: [50, 57, 62, 66, 69] },
    { name: 'Rose', low: '#ff4ac8', high: '#3ad8ff', chord: [52, 59, 64, 67, 71] },
    { name: 'Gold', low: '#ffd23a', high: '#ff4a6a', chord: [55, 62, 66, 69, 74] },
    { name: 'Ice', low: '#5ad8ff', high: '#c8b8ff', chord: [47, 54, 59, 62, 66] },
];

export function buildAurora(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    // a night sky for a ceiling
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, D + 0.6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x02040a }));
    sky.position.y = ceil + 0.01;
    ctx.add(sky);
    const stars = starSphere(400, 1, new V3(0, 0, 0), -1, 'aurora-sky');
    // flatten the hemisphere of stars onto the ceiling
    const sp = stars.mesh.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) * (W / 2 - 0.1), ceil - 0.05, sp.getZ(i) * (D / 2 - 0.1));
    ctx.add(stars.mesh);
    // the curtains
    const U = { uTime: { value: 0 }, uLow: { value: new THREE.Color(PALETTES[0].low) }, uHigh: { value: new THREE.Color(PALETTES[0].high) }, uGain: { value: 1 } };
    const curtains = [];
    for (let k = 0; k < 5; k++) {
        const u = { ...U, uSeed: { value: k * 1.7 } };
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 3.2, 80, 1), new THREE.ShaderMaterial({ uniforms: u, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        m.position.set((r() - 0.5) * 1.5, ceil - 1.7 - r() * 0.6, -3.4 + k * 1.6);
        m.rotation.y = (r() - 0.5) * 0.6;
        m.rotation.x = -0.25;
        m.frustumCulled = false;
        ctx.add(m);
        curtains.push(m);
    }
    // indoor snow
    const SN = ctx.low ? 160 : 320;
    const snow = motes(SN, 0xffffff, 0.06, 0.9);
    const flakes = Array.from({ length: SN }, () => ({ x: (r() - 0.5) * (W - 0.4), y: r() * ceil, z: (r() - 0.5) * (D - 0.4), v: 0.25 + r() * 0.35, ph: r() * TAU }));
    ctx.add(snow);
    // drifts, pines and a bench
    ctx.mat('snowy', new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9, emissive: 0x1a2a3a }));
    for (let k = 0; k < 10; k++) {
        const side = k % 2 ? 1 : -1;
        const x = side * (W / 2 - 0.5), z = -D / 2 + 0.8 + (k >> 1) * 2.0;
        if (z > D / 2 - 1.2) continue;
        ctx.geo('snowy', new THREE.SphereGeometry(0.9, 16, 8, 0, TAU, 0, Math.PI / 2), x, 0, z, 0, 1, 0.35 + r() * 0.25, 1.4);
    }
    for (const [x, z] of [[-4.0, -4.0], [4.0, -4.0], [-4.2, 3.2], [4.2, 3.2]]) {
        for (let k = 0; k < 3; k++) ctx.geo('hedge', new THREE.ConeGeometry(0.75 - k * 0.2, 1.0, 9), x, 0.7 + k * 0.6, z);
        ctx.geo('snowy', new THREE.ConeGeometry(0.3, 0.4, 9), x, 2.25, z);
        ctx.collide(x, z, 0.75);
    }
    ctx.box('darkWood', 1.8, 0.1, 0.5, 0, 0.45, 2.2);
    ctx.box('snowy', 1.8, 0.06, 0.5, 0, 0.53, 2.2);
    for (const sx of [-1, 1]) ctx.box('iron', 0.08, 0.45, 0.4, sx * 0.8, 0.22, 2.2);
    ctx.collideBox(0, 2.2, 1.8, 0.5);
    // the aurora organ: pipes and four keys
    const OZ = -D / 2 + 0.7;
    ctx.box('darkWood', 3.2, 1.0, 0.8, 0, 0.5, OZ);
    ctx.collideBox(0, OZ, 3.2, 0.8);
    const pipes = [];
    for (let k = 0; k < 11; k++) {
        const h = 1.6 + Math.sin((k / 10) * Math.PI) * 1.8;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, h, 12), new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 1, roughness: 0.25, emissive: 0x000000 }));
        m.position.set(-1.5 + k * 0.3, 1.0 + h / 2, OZ - 0.2);
        ctx.add(m);
        pipes.push(m);
    }
    const keys = PALETTES.map((p, i) => {
        const g = new THREE.Group();
        g.position.set(-1.05 + i * 0.7, 1.02, OZ + 0.25);
        const key = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.45), emissiveMat(p.low, 1.1, { color: p.low }));
        key.position.z = 0.05;
        g.add(key);
        ctx.add(g);
        const lab = plaqueMesh(p.name, null, 0.4);
        lab.position.set(-1.05 + i * 0.7, 0.78, OZ + 0.41);
        ctx.add(lab);
        const k = { g, key, p, press: 0 };
        ctx.hit(key, {
            label: `The ${p.name} key · play the sky`,
            range: 4.5,
            onClick: () => press(i),
        });
        return k;
    });
    const auroraLight = ctx.light(PALETTES[0].low, 8, 14, 0, ceil - 2, -1);
    ctx.light(0x8ad8ff, 5, 14, 0, 3, 3);
    const lowT = new THREE.Color(PALETTES[0].low), highT = new THREE.Color(PALETTES[0].high);
    let flare = 0, cur = 0, told = false;
    function press(i) {
        const k = keys[i];
        k.press = 1;
        cur = i;
        lowT.set(k.p.low);
        highT.set(k.p.high);
        flare = 1;
        audio.chord(k.p.chord, 0.045);
        audio.shimmer();
        if (!told) {
            told = true;
            ctx.say('The organ has no sound of its own. It plays the sky instead, and the sky sings back.', 5000);
        }
    }
    for (const c of curtains) ctx.hit(c, { label: 'The aurora · touch it', range: 99, onClick: () => {
        flare = 1;
        audio.arp([86, 90, 93], 0.06, 0.02);
    } });

    return {
        update(dt, t) {
            stars.U.uTime.value = t;
            flare = Math.max(0, flare - dt * 0.5);
            U.uTime.value = t;
            U.uLow.value.lerp(lowT, Math.min(1, dt * 1.2));
            U.uHigh.value.lerp(highT, Math.min(1, dt * 1.2));
            U.uGain.value = 0.85 + 0.15 * Math.sin(t * 0.7) + flare * 1.2;
            auroraLight.color.copy(U.uLow.value);
            auroraLight.intensity = 7 + flare * 10 + Math.sin(t * 0.9) * 2;
            for (const k of keys) {
                k.press = Math.max(0, k.press - dt * 3);
                k.g.position.y = 1.02 - k.press * 0.06;
                k.key.material.emissiveIntensity = 1.1 + k.press * 2 + (keys[cur] === k ? 0.6 : 0);
            }
            pipes.forEach((m, i) => {
                m.material.emissive.copy(U.uLow.value).multiplyScalar(0.25 + flare * 0.8 * Math.max(0, Math.sin(t * 6 - i * 0.6)));
            });
            const p = snow.geometry.attributes.position;
            flakes.forEach((f, i) => {
                f.y -= f.v * dt;
                if (f.y < 0) f.y = ceil - 0.3;
                p.setXYZ(i, f.x + Math.sin(t * 0.7 + f.ph) * 0.3, f.y, f.z + Math.cos(t * 0.5 + f.ph) * 0.2);
            });
            p.needsUpdate = true;
        },
    };
}
