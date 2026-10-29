// The ground floor of the Observatory, the Hall of Hours: the Prism
// Conservatory (a prism that fans a beam into a rainbow and wakes glass flowers
// where the colours land), the Hall of Disagreeing Clocks (a grandfather clock
// that makes them all agree, briefly) and the Cabinet of Curiosities (a bottled
// storm, a snow globe, a clockwork beetle and a sleeping star).
// Room-local frame: the door is at +z, the back wall at -z (see tower.js).

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { TAU, damp, clamp, lerp, rng, smoothstep } from './util.js';
import { canvasTex, glow, motes, emissiveMat, plaqueMesh, RAINBOW, ease, textSprite } from './tower-kit.js';

const V3 = THREE.Vector3;

/** A turned pedestal with a plaque on the front. */
export function pedestal(ctx, x, z, h = 1.05, title, sub, key = 'marble') {
    ctx.geo(key, lathe([[0, 0], [0.42, 0], [0.42, 0.1], [0.32, 0.18], [0.26, 0.3], [0.22, h - 0.22], [0.3, h - 0.12], [0.38, h - 0.06], [0.38, h], [0, h]], 24), x, 0, z);
    ctx.collide(x, z, 0.5);
    if (title) {
        const p = plaqueMesh(title, sub, 0.56);
        p.position.set(x, h * 0.55, z + 0.25);
        p.rotation.x = -0.12;
        ctx.add(p);
    }
}

/** A potted fern: a bronze pot with a burst of leaves. */
export function fern(ctx, x, z, s = 1) {
    ctx.geo('bronze', lathe([[0, 0], [0.22, 0], [0.3, 0.38], [0.34, 0.42], [0, 0.42]], 16), x, 0, z, 0, s);
    const leaf = new THREE.SphereGeometry(0.16, 8, 6).scale(0.35, 1.6, 0.14);
    const r = rng('fern' + x + z);
    for (let k = 0; k < 11; k++) {
        const a = (k / 11) * TAU + r() * 0.3;
        ctx.geo('hedge', leaf, x + Math.cos(a) * 0.14 * s, 0.6 * s + r() * 0.1, z + Math.sin(a) * 0.14 * s, -a + Math.PI / 2, s, s, s, 0.7 + r() * 0.3, 0);
    }
    ctx.collide(x, z, 0.35 * s);
}

// ================================================================ the Prism Conservatory

export function buildPrism(ctx) {
    const { W, D, ceil } = ctx;
    const Y = 1.75;                       // the height the light travels at
    const P = new V3(0, Y, -0.6);         // the prism
    // a skylight of frosted glass, and planters round the walls
    ctx.mat('sky', emissiveMat(0xe8f8ff, 0.9));
    ctx.box('sky', 4, 0.05, 3.2, 0, ceil - 0.02, -0.5);
    for (let k = -1; k <= 1; k++) ctx.box('gold', 0.06, 0.08, 3.3, k * 1.3, ceil - 0.06, -0.5);
    ctx.box('gold', 4.1, 0.08, 0.06, 0, ceil - 0.06, -0.5);
    for (const [x, z] of [[-4.3, 3.6], [4.3, 3.6], [-4.3, -3.8], [4.3, -3.8], [-2.2, -3.9], [2.2, -3.9]]) fern(ctx, x, z, 1.25);

    // the pedestal and the prism
    pedestal(ctx, P.x, P.z, Y - 0.55, 'The Prism of Saint Iris', 'Turn it gently', 'marble');
    const prismMat = new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.42, roughness: 0.02, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: 0x7fa8ff, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    const prismGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.0, 3);
    const prism = new THREE.Group();
    prism.position.copy(P);
    prism.add(new THREE.Mesh(prismGeo, prismMat));
    prism.add(new THREE.LineSegments(new THREE.EdgesGeometry(prismGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })));
    ctx.add(prism);
    const core = glow(0xffffff, 1.6, 0.6);
    core.position.copy(P);
    ctx.add(core);
    ctx.hit(prism.children[0], {
        label: 'The prism · click to turn it',
        onClick: () => {
            turnTarget += 0.62;
            ctx.audio.prism();
            if (!told) {
                told = true;
                ctx.say('The prism drinks the white light and pours out every colour it knows. Where the colours land, the glass flowers wake.');
            }
        },
    });

    // the heliostat: a brass lamp on the left wall throwing a white beam at the prism
    const lampX = -W / 2 + 0.35;
    ctx.geo('brass', new THREE.CylinderGeometry(0.16, 0.34, 0.6, 20).rotateZ(Math.PI / 2), lampX + 0.2, Y, P.z);
    ctx.geo('brass', new THREE.TorusGeometry(0.34, 0.04, 8, 24).rotateY(Math.PI / 2), lampX + 0.5, Y, P.z);
    ctx.box('iron', 0.5, 0.08, 0.08, lampX - 0.05, Y - 0.3, P.z);
    ctx.mat('lampGlass', emissiveMat(0xffffff, 4));
    ctx.geo('lampGlass', new THREE.CircleGeometry(0.3, 24).rotateY(Math.PI / 2), lampX + 0.51, Y, P.z);
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const beamMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const white = new THREE.Mesh(beamGeo, beamMat(0xffffff, 0.45));
    white.position.set(lampX + 0.5, Y, P.z);
    white.rotation.y = Math.PI / 2;
    white.scale.set(0.12, 0.12, P.x - lampX - 0.6);
    ctx.add(white);
    let lampOn = true;
    ctx.proxy(0.9, 0.9, 0.9, lampX + 0.3, Y, P.z, {
        label: () => (lampOn ? 'The heliostat · click to shutter it' : 'The heliostat · click to open it'),
        onClick: () => {
            lampOn = !lampOn;
            ctx.audio.tick();
            ctx.audio.bell(lampOn ? 81 : 69, 0.05, 0.03);
        },
    });

    // the fan of colours
    const beams = RAINBOW.map((c, i) => {
        const m = new THREE.Mesh(beamGeo, beamMat(c, 0.5));
        m.position.copy(P);
        ctx.add(m);
        const splash = glow(c, 1.4, 0.8);
        ctx.add(splash);
        return { m, splash, color: new THREE.Color(c), end: new V3() };
    });

    // glass flowers along the three walls, at the height the light travels
    const flowers = [];
    const petal = new THREE.SphereGeometry(0.16, 10, 8).scale(0.55, 1, 0.22).translate(0, 0.16, 0);
    const spots = [];
    for (let x = -3.8; x <= 3.81; x += 1.27) spots.push([x, -D / 2 + 0.12, 0]);
    for (const s of [-1, 1]) for (let z = -3.2; z <= 2.6; z += 1.45) spots.push([s * (W / 2 - 0.12), z, s * Math.PI / 2 * -1]);
    spots.forEach(([x, z, ry], i) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 1 });
        const g = new THREE.Group();
        g.position.set(x, Y + (i % 2 ? 0.25 : -0.2), z);
        g.rotation.y = ry;
        const head = new THREE.Group();
        for (let k = 0; k < 6; k++) {
            const p = new THREE.Mesh(petal, mat);
            p.rotation.z = (k / 6) * TAU;
            head.add(p);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat);
        head.add(heart);
        head.position.z = 0.12;
        g.add(head);
        ctx.geo('hedge', new THREE.CylinderGeometry(0.015, 0.02, 0.6, 5), x, g.position.y - 0.32, z);
        ctx.add(g);
        flowers.push({ g, head, mat, bloom: 0, color: new THREE.Color(0xffffff), at: new V3(x, g.position.y, z) });
    });
    let turn = 0.35, turnTarget = 0.35, told = false, allBloomTold = false;
    ctx.light(0xfff6e8, 14, 16, 0, ceil - 0.8, 0);
    const fanLight = ctx.light(0xffffff, 0, 8, 0, Y + 0.6, P.z);

    const dir = new V3();
    return {
        update(dt, t) {
            turn = damp(turn, turnTarget, 3, dt);
            prism.rotation.y = turn + Math.sin(t * 0.3) * 0.04;
            white.visible = lampOn;
            core.material.opacity = lampOn ? 0.5 + 0.1 * Math.sin(t * 3) : 0.05;
            const base = turn * 2 - Math.PI / 2;
            let lit = 0;
            for (let i = 0; i < beams.length; i++) {
                const b = beams[i];
                b.m.visible = b.splash.visible = lampOn;
                if (!lampOn) continue;
                const a = base + (i - 3) * 0.085;
                dir.set(Math.sin(a), 0, Math.cos(a));
                // where it meets a wall
                let tt = Infinity;
                for (const [n, o, lim] of [[dir.x, P.x, W / 2 - 0.1], [dir.z, P.z, D / 2 - 0.1]]) {
                    if (Math.abs(n) < 1e-4) continue;
                    const tw = ((n > 0 ? lim : -lim) - o) / n;
                    if (tw > 0) tt = Math.min(tt, tw);
                }
                tt = Math.min(tt, 12);
                b.end.copy(P).addScaledVector(dir, tt);
                b.m.rotation.y = a;
                b.m.scale.set(0.035 + 0.01 * Math.sin(t * 7 + i), 0.035, tt);
                b.splash.position.copy(b.end).addScaledVector(dir, -0.08);
                b.splash.material.opacity = 0.6 + 0.2 * Math.sin(t * 5 + i);
            }
            for (const f of flowers) {
                let hit = null;
                if (lampOn) for (const b of beams) if (b.end.distanceTo(f.at) < 0.75) hit = b;
                if (hit) {
                    f.bloom = Math.min(1, f.bloom + dt * 2.2);
                    f.color.lerp(hit.color, Math.min(1, dt * 4));
                } else f.bloom = Math.max(0, f.bloom - dt * 0.08);
                const k = ease.back(clamp(f.bloom, 0, 1));
                f.head.scale.setScalar(0.25 + 0.75 * k);
                f.head.rotation.z = t * 0.2 * f.bloom;
                f.mat.emissive.copy(f.color).multiplyScalar(f.bloom * 1.4);
                f.mat.color.copy(f.color).lerp(new THREE.Color(0xffffff), 0.5);
                if (f.bloom > 0.6) lit++;
            }
            if (lit >= flowers.length - 1 && !allBloomTold) {
                allBloomTold = true;
                ctx.audio.shimmer();
                ctx.say('The whole conservatory is in flower. Somewhere a bee you cannot see is very pleased.');
            }
            fanLight.intensity = lampOn ? 6 : 0;
            fanLight.color.setHSL(((turn * 0.3) % 1 + 1) % 1, 0.8, 0.6);
        },
    };
}

// ================================================================ the Hall of Disagreeing Clocks

const CLOCK_STYLES = [
    { face: '#f6ecd2', ink: '#2a1a0a', rim: 0xd9b46a, nums: 'roman', name: 'Greenwich-ish Mean Time', rate: 1 / 60 },
    { face: '#ffd6e8', ink: '#7a1a4a', rim: 0xff6fa8, nums: 'arabic', name: 'Runs backwards on purpose', rate: -1 / 30 },
    { face: '#d6f6ff', ink: '#0a3a5a', rim: 0x3fb8e8, nums: 'dots', name: 'Tide Time · always nearly high', rate: 1 / 180 },
    { face: '#1a1a3a', ink: '#ffe08a', rim: 0x7a5cff, nums: 'moons', name: 'Moon Time · for werewolves and bakers', rate: 1 / 400 },
    { face: '#fff4c8', ink: '#5a3a0a', rim: 0xffb02e, nums: 'seven', name: 'A seven-hour clock · for very short days', rate: 1 / 20 },
    { face: '#e8ffe0', ink: '#1a4a1a', rim: 0x5cd86a, nums: 'arabic', name: 'Garden Time · it stops when it rains', rate: 0 },
    { face: '#ffe6d0', ink: '#6a2a0a', rim: 0xff7a3a, nums: 'reverse', name: 'Tomorrow’s clock · it is always slightly ahead', rate: 1 / 50 },
    { face: '#f0e0ff', ink: '#3a1a6a', rim: 0xc45cff, nums: 'qmarks', name: 'Nobody knows what this one measures', rate: 0.4 },
    { face: '#f6f6f6', ink: '#111111', rim: 0x2a2a2a, nums: 'roman', name: 'Exact Time · it has never once been wrong. It is wrong now.', rate: 1 / 60 },
    { face: '#fff0f0', ink: '#a01a1a', rim: 0xe8463c, nums: 'emoji', name: 'Teatime · it is always teatime', rate: 0.003 },
    { face: '#e0f0ff', ink: '#1a2a6a', rim: 0x5b6dff, nums: 'dots', name: 'Cat Time · mostly naps', rate: 1 / 600 },
    { face: '#fff8d8', ink: '#4a3a0a', rim: 0xd8c050, nums: 'arabic', name: 'Wedding-anniversary Time · set by somebody nervous', rate: 1 / 25 },
    { face: '#d8fff0', ink: '#0a4a3a', rim: 0x2fd0a0, nums: 'roman', name: 'Snail Time · patience', rate: 1 / 3000 },
];

function clockFace(style, seed) {
    return canvasTex(256, 256, (x, w) => {
        const c = w / 2;
        x.fillStyle = style.face;
        x.beginPath();
        x.arc(c, c, c, 0, TAU);
        x.fill();
        const g = x.createRadialGradient(c, c, c * 0.2, c, c, c);
        g.addColorStop(0, 'rgba(255,255,255,0.25)');
        g.addColorStop(1, 'rgba(0,0,0,0.15)');
        x.fillStyle = g;
        x.fill();
        x.strokeStyle = style.ink;
        x.fillStyle = style.ink;
        x.lineWidth = 3;
        x.beginPath();
        x.arc(c, c, c - 14, 0, TAU);
        x.stroke();
        const n = style.nums === 'seven' ? 7 : 12;
        const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        const moons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
        const emo = ['☕', '🍰', '🫖', '🍪', '🧁', '🥐', '☕', '🍰', '🫖', '🍪', '🧁', '🥐'];
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU - Math.PI / 2;
            const px = c + Math.cos(a) * (c - 44), py = c + Math.sin(a) * (c - 44);
            x.beginPath();
            x.moveTo(c + Math.cos(a) * (c - 16), c + Math.sin(a) * (c - 16));
            x.lineTo(c + Math.cos(a) * (c - 26), c + Math.sin(a) * (c - 26));
            x.stroke();
            let label;
            if (style.nums === 'roman') label = R[i];
            else if (style.nums === 'arabic') label = String(i === 0 ? 12 : i);
            else if (style.nums === 'seven') label = String(i === 0 ? 7 : i);
            else if (style.nums === 'reverse') label = String(i === 0 ? 12 : 12 - i);
            else if (style.nums === 'qmarks') label = '?';
            else if (style.nums === 'moons') label = moons[i % 8];
            else if (style.nums === 'emoji') label = emo[i];
            if (style.nums === 'dots') {
                x.beginPath();
                x.arc(px, py, i % 3 ? 5 : 10, 0, TAU);
                x.fill();
            } else if (label) {
                x.font = `${style.nums === 'roman' ? 600 : 700} ${style.nums === 'roman' ? 26 : 32}px Georgia, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
                x.fillText(label, px, py);
            }
        }
        x.font = 'italic 16px Georgia, serif';
        x.fillText(['Tempus Fidget', 'Est. Whenever', 'Wm. Tock & Sons', 'Hora Incerta', 'Do Not Wind'][seed % 5], c, c + 52);
    });
}

function makeClock(ctx, style, seed, size) {
    const g = new THREE.Group();
    const faceMat = new THREE.MeshStandardMaterial({ map: clockFace(style, seed), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.08 });
    faceMat.emissiveMap = faceMat.map;
    const rimMat = new THREE.MeshStandardMaterial({ color: style.rim, roughness: 0.3, metalness: 0.6 });
    const shape = seed % 4;
    const face = new THREE.Mesh(new THREE.CircleGeometry(size, shape === 1 ? 8 : 40), faceMat);
    g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.09, 8, shape === 1 ? 8 : 40), rimMat);
    if (shape === 1) rim.rotation.z = Math.PI / 8;
    g.add(rim);
    if (shape === 2) {
        // a sunburst of rays
        for (let k = 0; k < 16; k++) {
            const ray = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.5, 4), rimMat);
            const a = (k / 16) * TAU;
            ray.position.set(Math.cos(a) * size * 1.3, Math.sin(a) * size * 1.3, -0.02);
            ray.rotation.z = a - Math.PI / 2;
            g.add(ray);
        }
    }
    if (shape === 3) {
        const back = new THREE.Mesh(new THREE.BoxGeometry(size * 2.3, size * 2.8, 0.08), new THREE.MeshStandardMaterial({ color: style.rim, roughness: 0.6 }));
        back.position.set(0, -size * 0.25, -0.05);
        g.add(back);
    }
    const handMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.ink), roughness: 0.4, metalness: 0.5 });
    const hand = (len, w) => {
        const pivot = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.015).translate(0, len / 2 - len * 0.12, 0), handMat);
        pivot.add(m);
        pivot.position.z = 0.02;
        g.add(pivot);
        return pivot;
    };
    const hh = hand(size * 0.5, size * 0.09), mh = hand(size * 0.78, size * 0.05);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 0.07, 8, 6), rimMat);
    cap.position.z = 0.03;
    g.add(cap);
    ctx.add(g);
    return { g, hh, mh, face, style, m: seed * 1.7, spin: 0 };
}

export function buildClocks(ctx) {
    const { W, D, ceil } = ctx;
    const r = ctx.rng;
    const clocks = [];
    // the back wall either side of the grandfather clock, and both side walls
    const spots = [
        [-2.2, 3.4, -D / 2 + 0.06, 0, 0.42], [-3.7, 2.2, -D / 2 + 0.06, 0, 0.5], [-2.6, 1.6, -D / 2 + 0.06, 0, 0.3], [2.4, 3.3, -D / 2 + 0.06, 0, 0.5], [3.8, 2.0, -D / 2 + 0.06, 0, 0.36], [2.6, 1.7, -D / 2 + 0.06, 0, 0.28],
        [-W / 2 + 0.06, 2.6, -2.4, Math.PI / 2, 0.55], [-W / 2 + 0.06, 3.9, -0.6, Math.PI / 2, 0.38], [-W / 2 + 0.06, 2.3, 1.2, Math.PI / 2, 0.42],
        [W / 2 - 0.06, 3.7, -2.4, -Math.PI / 2, 0.4], [W / 2 - 0.06, 2.4, 1.6, -Math.PI / 2, 0.5], [W / 2 - 0.06, 4.1, 2.8, -Math.PI / 2, 0.3], [-W / 2 + 0.06, 4.2, 2.8, Math.PI / 2, 0.33],
    ];
    spots.forEach(([x, y, z, ry, s], i) => {
        const c = makeClock(ctx, CLOCK_STYLES[i % CLOCK_STYLES.length], i, s);
        c.g.position.set(x, y, z);
        c.g.rotation.y = ry;
        clocks.push(c);
        ctx.hit(c.face, {
            label: c.style.name,
            range: 7,
            onClick: () => {
                c.spin = 2.2;
                for (let k = 0; k < 10; k++) ctx.audio.tick(k * 0.08);
                ctx.say(`“${c.style.name}.” It spins, considers, and carries on exactly as before.`, 4200);
            },
        });
    });

    // the grandfather clock
    const gz = -D / 2 + 0.4;
    ctx.box('darkWood', 1.1, 0.3, 0.6, 0, 0.15, gz);
    ctx.box('darkWood', 0.86, 1.9, 0.46, 0, 1.25, gz);
    ctx.box('darkWood', 1.04, 0.95, 0.56, 0, 2.65, gz);
    ctx.geo('darkWood', new THREE.CylinderGeometry(0.52, 0.52, 0.56, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), 0, 3.12, gz);
    ctx.geo('gold', new THREE.SphereGeometry(0.08, 10, 8), 0, 3.72, gz);
    for (const s of [-1, 1]) ctx.geo('gold', new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), s * 0.46, 2.65, gz + 0.27);
    ctx.mat('caseGlass', new THREE.MeshStandardMaterial({ color: 0x0a0808, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.5 }));
    ctx.box('caseGlass', 0.62, 1.5, 0.02, 0, 1.3, gz + 0.24);
    ctx.collideBox(0, gz, 1.1, 0.6);
    const big = makeClock(ctx, { face: '#fbf1d8', ink: '#1a1008', rim: 0xd9b46a, nums: 'roman', name: 'The Grandfather', rate: 1 / 60 }, 96, 0.36);
    big.g.position.set(0, 2.68, gz + 0.29);
    const pend = new THREE.Group();
    pend.position.set(0, 2.05, gz + 0.1);
    pend.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 0.02).translate(0, -0.55, 0), ctx.mats.brass));
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 24).rotateX(Math.PI / 2), ctx.mats.gold);
    bob.position.y = -1.1;
    pend.add(bob);
    ctx.add(pend);
    let sync = 0, told = 0;
    ctx.proxy(1.1, 3.6, 0.8, 0, 1.8, gz + 0.2, {
        label: 'The grandfather clock · click to make them all agree',
        range: 7,
        onClick: () => {
            if (sync > 0) return;
            sync = 7.5;
            ctx.audio.clockChime();
            ctx.audio.cuckoo(3.4);
            cuckoo = -3.4;
            ctx.say(told++ % 2 ? 'Again they agree. Again, it will not last.' : 'For one moment, every clock in the tower agrees on the time. It does not last.');
        },
    });

    // a cuckoo clock on the right-hand wall
    const cx = W / 2 - 0.25, cz = -0.4, cy = 2.9;
    const house = new THREE.Group();
    house.position.set(cx, cy, cz);
    house.rotation.y = -Math.PI / 2;
    const wood = ctx.mats.wood;
    house.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.36), wood));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.62, 0.42, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.65), ctx.mats.darkWood);
    roof.position.y = 0.52;
    house.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), ctx.mats.darkWood);
    door.position.set(0, 0.17, 0.181);
    house.add(door);
    const bird = new THREE.Group();
    const bmat = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5, emissive: 0x3a2a00 });
    bird.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), bmat));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff7a1a }));
    beak.position.z = 0.09;
    bird.add(beak);
    bird.position.set(0, 0.17, 0.05);
    house.add(bird);
    const cface = makeClock(ctx, CLOCK_STYLES[5], 7, 0.2);
    house.add(cface.g);
    cface.g.position.set(0, -0.12, 0.185);
    clocks.push(cface);
    for (const s of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8), ctx.mats.bronze);
        cone.position.set(s * 0.15, -0.9, 0);
        house.add(cone);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 4), ctx.mats.brass);
        chain.position.set(s * 0.15, -0.55, 0);
        house.add(chain);
    }
    ctx.add(house);
    let cuckoo = null;   // seconds since the bird was due out, or null
    ctx.proxy(0.8, 1.0, 0.8, cx - 0.2, cy, cz, {
        label: 'A cuckoo clock',
        onClick: () => {
            if (cuckoo !== null) return;
            cuckoo = 0;
            ctx.audio.cuckoo(0);
        },
    });

    // a long low bench and a rug
    ctx.box('velvet', 2.4, 0.1, 0.7, 0, 0.45, 1.2);
    ctx.box('darkWood', 2.5, 0.08, 0.75, 0, 0.38, 1.2);
    for (const s of [-1, 1]) ctx.box('darkWood', 0.08, 0.38, 0.6, s * 1.1, 0.19, 1.2);
    ctx.collideBox(0, 1.2, 2.5, 0.75);
    ctx.light(0xffc890, 14, 14, 0, ceil - 0.6, 0);

    return {
        update(dt, t) {
            if (sync > 0) sync -= dt;
            const agreeing = sync > 0 && sync < 6.9;
            for (const c of clocks.concat(big)) {
                const rate = c.style.rate * (c.spin > 0 ? 60 : 1);
                if (c.spin > 0) c.spin -= dt;
                if (agreeing) c.m = damp(c.m, Math.round(c.m / TAU) * TAU, 3, dt);
                else c.m += rate * TAU * dt;
                c.mh.rotation.z = -c.m;
                c.hh.rotation.z = -c.m / 12 - (agreeing ? 0 : c.style.rate === 0 ? 1.3 : 0);
            }
            pend.rotation.z = Math.sin(t * 2.6) * 0.18;
            // the bird pops out and back twice
            if (cuckoo !== null) {
                cuckoo += dt;
                const k = cuckoo;
                const out = k > 0 && k < 1.4 ? Math.sin(Math.min(1, (k % 0.7) / 0.35) * Math.PI * 0.5) * (k % 0.7 < 0.55 ? 1 : 0) : 0;
                bird.position.z = 0.05 + out * 0.25;
                door.rotation.y = -out * 1.6;
                door.position.x = -out * 0.1;
                if (k > 1.6) cuckoo = null;
            }
        },
    };
}

// ================================================================ the Cabinet of Curiosities

export function buildCabinet(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    // glass-fronted cabinets along both side walls, full of small strange things
    ctx.mat('shelfGlow', emissiveMat(0xffe8b8, 0.6));
    const gemMats = ['#ff4f6a', '#4fd8ff', '#ffe14d', '#9a5cff', '#5cf27a', '#ff9a3c'].map((c) => ctx.mat('gem' + c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.3 })));
    gemMats.forEach((m, i) => (ctx.roomMats['gem' + i] = m));
    for (const s of [-1, 1]) {
        const x = s * (W / 2 - 0.35);
        for (const z of [-2.4, 0.3, 2.6]) {
            ctx.box('darkWood', 0.6, 3.2, 2.2, x, 1.6, z);
            ctx.box('shelfGlow', 0.5, 2.9, 2.0, x - s * 0.06, 1.62, z);
            for (let k = 0; k < 4; k++) {
                const y = 0.45 + k * 0.72;
                ctx.box('darkWood', 0.5, 0.04, 2.0, x - s * 0.04, y, z);
                for (let j = 0; j < 4; j++) {
                    const ox = x - s * 0.08, oz = z - 0.75 + j * 0.5 + r() * 0.1;
                    const kind = Math.floor(r() * 5);
                    const gm = 'gem' + Math.floor(r() * 6);
                    if (kind === 0) ctx.geo(gm, new THREE.OctahedronGeometry(0.09, 0), ox, y + 0.11, oz, r() * 3, 1, 1.4, 1);
                    else if (kind === 1) ctx.geo('bronze', new THREE.ConeGeometry(0.08, 0.2, 9, 1).rotateZ(0.3), ox, y + 0.1, oz);
                    else if (kind === 2) ctx.geo('white', new THREE.SphereGeometry(0.08, 10, 8).scale(1, 1.3, 1), ox, y + 0.1, oz);
                    else if (kind === 3) {
                        ctx.geo('brass', new THREE.TorusGeometry(0.05, 0.012, 6, 14), ox, y + 0.16, oz, Math.PI / 2);
                        ctx.geo('brass', new THREE.BoxGeometry(0.02, 0.14, 0.02), ox, y + 0.06, oz);
                    } else ctx.geo('glassClear', new THREE.CylinderGeometry(0.05, 0.07, 0.22, 10), ox, y + 0.11, oz);
                }
            }
            ctx.box('glassClear', 0.02, 2.9, 2.0, x - s * 0.31, 1.62, z);
            ctx.collideBox(x, z, 0.6, 2.2);
        }
    }
    ctx.mat('rug', new THREE.MeshStandardMaterial({ color: 0x7a1a2a, roughness: 1 }));
    ctx.box('rug', 7.4, 0.02, 3.4, 0, 0.01, -0.6);
    ctx.box('gold', 7.6, 0.015, 3.6, 0, 0.005, -0.6);

    const PZ = -0.9, PH = 1.05;
    const xs = [-3, -1, 1, 3];
    pedestal(ctx, xs[0], PZ, PH, 'A Bottled Storm', 'Caught off Cape Wrath, 1891', 'darkWood');
    pedestal(ctx, xs[1], PZ, PH, 'The Snow Globe', 'Shake well before use', 'darkWood');
    pedestal(ctx, xs[2], PZ, PH, 'A Clockwork Beetle', 'Fully wound · bites a little', 'darkWood');
    pedestal(ctx, xs[3], PZ, PH, 'A Sleeping Star', 'Fell in the orchard, 1907. Do not wake.', 'darkWood');
    const jar = (x, h, rad) => {
        ctx.geo('glassClear', new THREE.CylinderGeometry(rad, rad, h, 28, 1, true), x, PH + h / 2, PZ);
        ctx.geo('glassClear', new THREE.SphereGeometry(rad, 28, 10, 0, TAU, 0, Math.PI / 2), x, PH + h, PZ);
        ctx.geo('brass', new THREE.TorusGeometry(rad, 0.02, 6, 28).rotateX(Math.PI / 2), x, PH + 0.01, PZ);
    };

    // 1. the storm
    jar(xs[0], 0.75, 0.3);
    const cloud = new THREE.Group();
    const cmat = new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 1, emissive: 0x202838, emissiveIntensity: 0.4 });
    for (let k = 0; k < 7; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.08 + r() * 0.05, 10, 8), cmat);
        m.position.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.06, (r() - 0.5) * 0.2);
        cloud.add(m);
    }
    cloud.position.set(xs[0], PH + 0.72, PZ);
    ctx.add(cloud);
    const rainN = 40;
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rainN * 6), 3));
    const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.6 }));
    rain.frustumCulled = false;
    ctx.add(rain);
    const drops = Array.from({ length: rainN }, () => ({ x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.3, y: r() * 0.6, v: 1 + r() }));
    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
    const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xe8f4ff }));
    bolt.frustumCulled = false;
    ctx.add(bolt);
    const boltGlow = glow(0xbfe0ff, 1.6, 0);
    boltGlow.position.set(xs[0], PH + 0.4, PZ);
    ctx.add(boltGlow);
    // the room's light doubles as the storm's flash
    const flash = ctx.light(0xffe0b0, 14, 15, 0, ceil - 0.6, 0.5);
    const warm = new THREE.Color(0xffe0b0), blue = new THREE.Color(0xd8ecff);
    let strikes = 0, strikeT = 0, nextIdle = 3;
    const strike = () => {
        const p = boltGeo.attributes.position;
        let x = xs[0] + (r() - 0.5) * 0.1, z = PZ;
        for (let i = 0; i < 9; i++) {
            p.setXYZ(i, x, PH + 0.66 - i * 0.075, z);
            x += (r() - 0.5) * 0.1;
            z += (r() - 0.5) * 0.06;
        }
        p.needsUpdate = true;
    };
    ctx.proxy(0.7, 1.0, 0.7, xs[0], PH + 0.45, PZ, {
        label: 'A bottled storm · click to tap the glass',
        onClick: () => {
            strikes = 4;
            strikeT = 0;
            audio.thunder(1);
            ctx.say('Somewhere inside the jar it is a dark and stormy night. It always has been.', 4200);
        },
    });

    // 2. the snow globe
    const GY = PH + 0.42, GR = 0.36;
    ctx.geo('darkWood', new THREE.CylinderGeometry(0.3, 0.36, 0.14, 24), xs[1], PH + 0.07, PZ);
    ctx.geo('gold', new THREE.TorusGeometry(0.3, 0.02, 6, 24).rotateX(Math.PI / 2), xs[1], PH + 0.14, PZ);
    const globe = new THREE.Group();
    globe.position.set(xs[1], PH + 0.14, PZ);
    ctx.add(globe);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(GR, 32, 20), ctx.mats.glassClear);
    shell.position.y = GR - 0.06;
    globe.add(shell);
    const mini = new THREE.Group();
    mini.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 12).translate(0, 0.15, 0), ctx.mats.granite));
    const mdome = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8, 0, TAU, 0, Math.PI / 2), ctx.mats.copper);
    mdome.position.y = 0.3;
    mini.add(mdome);
    const snowGround = new THREE.Mesh(new THREE.CircleGeometry(GR * 0.95, 24).rotateX(-Math.PI / 2), ctx.mats.white);
    snowGround.position.y = 0.0;
    mini.add(snowGround);
    for (const [tx, tz] of [[0.16, 0.08], [-0.15, 0.1], [0.05, -0.18]]) {
        const tree = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 7).translate(0, 0.08, 0), ctx.mats.hedge);
        tree.position.set(tx, 0, tz);
        mini.add(tree);
    }
    const windowGlow = glow(0xffd080, 0.2, 0.9);
    windowGlow.position.set(0, 0.2, 0.07);
    mini.add(windowGlow);
    globe.add(mini);
    const SN = 90;
    const snow = motes(SN, 0xffffff, 0.035, 0.95);
    globe.add(snow);
    const flakes = Array.from({ length: SN }, () => ({ p: new V3((r() - 0.5) * 0.4, r() * 0.02, (r() - 0.5) * 0.4), v: new V3() }));
    let shake = 0;
    ctx.proxy(0.8, 0.9, 0.8, xs[1], PH + 0.4, PZ, {
        label: 'The snow globe · click to shake it',
        onClick: () => {
            shake = 1;
            for (const f of flakes) f.v.set((r() - 0.5) * 1.4, 0.8 + r() * 1.6, (r() - 0.5) * 1.4);
            audio.noise(0.4, 3000, 0.7, 0.05);
            audio.shimmer();
        },
    });

    // 3. the clockwork beetle
    const beetle = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x2fae8a, roughness: 0.2, metalness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12).scale(1, 0.55, 1.35), shellMat);
    body.position.y = 0.07;
    beetle.add(body);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.075, 0.3), ctx.mats.gold);
    seam.position.set(0, 0.09, -0.01);
    beetle.add(seam);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), ctx.mats.brass);
    head.position.set(0, 0.06, 0.17);
    beetle.add(head);
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), emissiveMat(0xff3a3a, 2));
        eye.position.set(s * 0.03, 0.08, 0.215);
        beetle.add(eye);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4), ctx.mats.brass);
        ant.position.set(s * 0.035, 0.14, 0.24);
        ant.rotation.x = 0.8;
        ant.rotation.z = -s * 0.3;
        beetle.add(ant);
    }
    const legs = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const leg = new THREE.Group();
        leg.position.set(s * 0.09, 0.05, -0.08 + k * 0.09);
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.13, 4).translate(0, -0.065, 0), ctx.mats.brass);
        seg.rotation.z = s * 1.0;
        leg.add(seg);
        beetle.add(leg);
        legs.push({ leg, ph: k * 2.1 + (s > 0 ? Math.PI : 0) });
    }
    const keyG = new THREE.Group();
    keyG.position.set(0, 0.14, -0.08);
    keyG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), ctx.mats.gold));
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 14), ctx.mats.gold);
    bow.position.y = 0.06;
    keyG.add(bow);
    beetle.add(keyG);
    beetle.position.set(xs[2], PH, PZ);
    beetle.scale.setScalar(1.25);
    ctx.add(beetle);
    // its walk: down off the pedestal, a loop of the room, and back up
    const loop = new THREE.CatmullRomCurve3([
        new V3(xs[2], PH, PZ), new V3(xs[2] + 0.45, 0.02, PZ + 0.7), new V3(2.5, 0.02, 2.4), new V3(0, 0.02, 3.0), new V3(-2.6, 0.02, 2.2), new V3(-3.9, 0.02, 0.8),
        new V3(-3.9, 0.02, -1.7), new V3(-2.0, 0.02, -2.7), new V3(0, 0.02, -2.9), new V3(2.2, 0.02, -2.3), new V3(1.6, 0.02, -1.6), new V3(xs[2], PH, PZ),
    ]);
    let walk = -1;
    ctx.proxy(0.6, 0.5, 0.6, xs[2], PH + 0.2, PZ, {
        label: 'A clockwork beetle · click to wind it',
        onClick: () => {
            if (walk >= 0) return;
            walk = 0;
            audio.ratchet(10);
            ctx.say('Tick-tick-tick. The beetle is off on its rounds. It has somewhere to be.', 3800);
        },
    });

    // 4. the sleeping star
    jar(xs[3], 0.55, 0.26);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 24), ctx.mats.brass);
    const LID_Y = PH + 0.55 + 0.26 + 0.02;
    lid.position.set(xs[3], LID_Y, PZ);
    ctx.add(lid);
    const star = new THREE.Group();
    const starMat = emissiveMat(0xffe08a, 2.2);
    star.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), starMat));
    const s2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), starMat);
    s2.rotation.set(0.6, 0.6, 0);
    star.add(s2);
    const halo = glow(0xffd070, 1.0, 0.6);
    star.add(halo);
    const home = new V3(xs[3], PH + 0.32, PZ);
    star.position.copy(home);
    ctx.add(star);
    const zzz = [0, 1, 2].map((i) => {
        const z = textSprite('z', { size: 0.16, color: '#ffe8a0', font: 'italic 700 60px Georgia, serif' });
        ctx.add(z);
        return z;
    });
    const trail = motes(60, 0xffe08a, 0.08, 0.9);
    ctx.add(trail);
    const trailPts = Array.from({ length: 60 }, () => new V3(0, -10, 0));
    let wake = -1, trailI = 0;
    const starLight = ctx.light(0xffd890, 0, 7, xs[3], PH + 0.5, PZ);
    ctx.proxy(0.6, 1.0, 0.6, xs[3], PH + 0.4, PZ, {
        label: 'A sleeping star · do not wake it',
        onClick: () => {
            if (wake >= 0) return;
            wake = 0;
            audio.wake();
            ctx.say('Oh dear. You woke it. The star yawns, stretches and goes for a little fly round the room.', 4800);
        },
    });

    const tmp = new V3();
    return {
        update(dt, t) {
            // storm: rain always, lightning on a tap and now and then by itself
            const rp = rainGeo.attributes.position;
            drops.forEach((d, i) => {
                d.y -= d.v * dt;
                if (d.y < 0) d.y = 0.6;
                rp.setXYZ(i * 2, xs[0] + d.x, PH + d.y, PZ + d.z);
                rp.setXYZ(i * 2 + 1, xs[0] + d.x, PH + d.y - 0.05, PZ + d.z);
            });
            rp.needsUpdate = true;
            nextIdle -= dt;
            if (nextIdle < 0 && strikes === 0) {
                strikes = 1;
                strikeT = 0;
                nextIdle = 4 + r() * 6;
                audio.thunder(0.25);
            }
            strikeT -= dt;
            if (strikes > 0 && strikeT <= 0) {
                strike();
                strikes--;
                strikeT = 0.12 + r() * 0.15;
                bolt.visible = true;
                boltGlow.material.opacity = 1;
                flash.intensity = 45;
                flash.color.copy(blue);
            }
            if (strikeT < 0.06) bolt.visible = false;
            boltGlow.material.opacity = Math.max(0, boltGlow.material.opacity - dt * 6);
            flash.intensity = Math.max(14, flash.intensity - dt * 200);
            if (flash.intensity <= 14.01) flash.color.copy(warm);
            cloud.rotation.y = t * 0.2;

            // snow: falls inside the sphere, swirls when shaken
            shake = Math.max(0, shake - dt * 0.9);
            globe.rotation.z = Math.sin(t * 22) * 0.12 * shake * shake;
            const sp = snow.geometry.attributes.position;
            flakes.forEach((f, i) => {
                f.v.y -= dt * 0.35;
                f.v.multiplyScalar(1 - dt * 1.4);
                f.v.x += Math.sin(t * 1.3 + i) * dt * 0.05;
                f.p.addScaledVector(f.v, dt);
                if (f.p.y < 0.005) {
                    f.p.y = 0.005;
                    f.v.set(0, 0, 0);
                }
                tmp.set(f.p.x, f.p.y - (GR - 0.06), f.p.z);
                if (tmp.length() > GR * 0.9) {
                    tmp.setLength(GR * 0.9);
                    f.p.set(tmp.x, tmp.y + GR - 0.06, tmp.z);
                    f.v.multiplyScalar(-0.3);
                }
                sp.setXYZ(i, f.p.x, f.p.y, f.p.z);
            });
            sp.needsUpdate = true;

            // beetle
            if (walk >= 0) {
                walk += dt / 16;
                const k = Math.min(1, walk);
                loop.getPointAt(k, beetle.position);
                const ahead = loop.getPointAt(Math.min(1, k + 0.005), tmp);
                const dx = ahead.x - beetle.position.x, dz = ahead.z - beetle.position.z;
                if (dx * dx + dz * dz > 1e-8) beetle.rotation.y = Math.atan2(dx, dz);
                for (const l of legs) l.leg.rotation.x = Math.sin(t * 26 + l.ph) * 0.5;
                keyG.rotation.y -= dt * 6;
                if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) audio.tick();
                if (walk >= 1) {
                    walk = -1;
                    beetle.position.set(xs[2], PH, PZ);
                    beetle.rotation.y = 0;
                }
            } else {
                for (const l of legs) l.leg.rotation.x = 0;
                keyG.rotation.y = Math.sin(t * 0.5) * 0.2;
            }

            // star: breathing in its jar, or flying round the room
            if (wake >= 0) {
                wake += dt;
                const W8 = 9;
                lid.position.y = LID_Y + Math.min(1, wake * 3) * 0.35 * (wake < W8 - 0.6 ? 1 : Math.max(0, (W8 - wake) / 0.6));
                const fly = smoothstep(0.4, 1.4, wake) * (1 - smoothstep(W8 - 1.6, W8 - 0.2, wake));
                const a = (wake - 0.4) * 0.9;
                tmp.set(Math.sin(a) * 3.4, 3.2 + Math.sin(a * 2.3) * 0.6, -0.3 + Math.cos(a) * 2.6);
                star.position.copy(home).lerp(tmp, fly);
                starMat.emissiveIntensity = 2.2 + fly * 3;
                halo.scale.setScalar(1 + fly * 1.5);
                starLight.intensity = fly * 10;
                if (fly > 0.05) {
                    trailPts[trailI].copy(star.position);
                    trailI = (trailI + 1) % trailPts.length;
                }
                if (wake > W8) wake = -1;
            } else {
                star.position.copy(home);
                starMat.emissiveIntensity = 1.2 + Math.sin(t * 0.8) * 0.6;
                halo.material.opacity = 0.35 + Math.sin(t * 0.8) * 0.15;
                halo.scale.setScalar(0.9);
                starLight.intensity = 0;
            }
            star.rotation.y += dt * (wake >= 0 ? 4 : 0.3);
            const tp = trail.geometry.attributes.position;
            trailPts.forEach((p, i) => {
                p.y -= dt * 0.15;
                tp.setXYZ(i, p.x, p.y, p.z);
            });
            tp.needsUpdate = true;
            trail.material.opacity = wake >= 0 ? 0.9 : Math.max(0, trail.material.opacity - dt);
            zzz.forEach((z, i) => {
                const k = (t * 0.3 + i / 3) % 1;
                z.visible = wake < 0;
                z.position.set(xs[3] + 0.08 + k * 0.15, PH + 0.95 + k * 0.6, PZ);
                z.material.opacity = Math.sin(k * Math.PI);
            });
        },
    };
}
