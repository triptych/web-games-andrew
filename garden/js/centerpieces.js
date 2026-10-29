// The centrepieces of the Observatory's rotundas, one per floor: a floating
// astrolabe (ground floor), a tree of chiming glass leaves (second), a vortex
// of books over a lectern (third) and a great plasma globe whose tendrils reach
// for you (fourth). The telescope under the top floor's dome is in telescope.js.
// Each is built at the centre of its rotunda (the hub frame is the floor's own).

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { TAU, damp, clamp, lerp, smoothstep } from './util.js';
import { canvasTex, glow, motes, emissiveMat, plaqueMesh, RAINBOW, ease } from './tower-kit.js';
import { PENTA } from './tower-audio.js';

const V3 = THREE.Vector3;

function plinth(ctx, h, r, key = 'marble') {
    ctx.geo(key, lathe([[0, 0], [r + 0.25, 0], [r + 0.25, 0.15], [r, 0.25], [r * 0.75, 0.4], [r * 0.6, h - 0.25], [r * 0.85, h - 0.1], [r * 0.9, h], [0, h]], 32), 0, 0, 0);
    ctx.collide(0, 0, r + 0.3);
}

// ================================================================ the astrolabe

export function buildAstrolabe(ctx) {
    const { audio } = ctx;
    plinth(ctx, 1.1, 0.8);
    const pl = plaqueMesh('The Welcome Astrolabe', 'It knows where you are', 0.7);
    pl.position.set(0, 0.62, 0.72);
    pl.rotation.x = -0.15;
    ctx.add(pl);
    const Y = 2.7;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), emissiveMat(0xffd27a, 3));
    core.position.y = Y;
    ctx.add(core);
    const halo = glow(0xffc060, 2.2, 0.6);
    halo.position.y = Y;
    ctx.add(halo);
    // a zodiac band, flat, with glyphs
    const band = canvasTex(1024, 64, (x, w, h) => {
        x.fillStyle = '#1a1438';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#ffe0a0';
        x.font = '600 40px Georgia, "Segoe UI Symbol", serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        const g = '♈♉♊♋♌♍♎♏♐♑♒♓';
        for (let i = 0; i < 24; i++) x.fillText(g[i % 12], (i + 0.5) * (w / 24), h / 2);
    });
    band.wrapS = THREE.RepeatWrapping;
    const zod = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.16, 64, 1, true), new THREE.MeshStandardMaterial({ map: band, emissive: 0xffffff, emissiveMap: band, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.4 }));
    zod.position.y = Y;
    ctx.add(zod);
    const mats = [ctx.mats.gold, ctx.mats.silver, ctx.mats.copper, ctx.mats.gold];
    const rings = [1.2, 1.0, 0.8, 0.6].map((R, i) => {
        const g = new THREE.Group();
        g.position.y = Y;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 8, 64), mats[i]);
        g.add(ring);
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), emissiveMat(RAINBOW[i * 2], 2));
        bead.position.x = R;
        g.add(bead);
        // tick marks
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU;
            const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), mats[i]);
            t.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
            t.rotation.z = a;
            g.add(t);
        }
        ctx.add(g);
        return { g, ax: new V3(Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 2.1)).normalize(), w: 0.3 + i * 0.17, spin: 0 };
    });
    let align = 0;
    ctx.proxy(3, 2, 3, 0, Y, 0, {
        label: 'The Welcome Astrolabe · give it a spin',
        range: 6,
        onClick: () => {
            align = 4;
            for (const r of rings) r.spin = 6;
            audio.arp([62, 66, 69, 74, 78, 81], 0.08, 0.04);
            audio.whirr(1);
            ctx.say('The astrolabe whirrs, aligns all its rings, and works out exactly where you are: here. It is very pleased with itself.', 5000);
        },
    });
    const q = new THREE.Quaternion();
    return {
        update(dt, t) {
            align = Math.max(0, align - dt);
            for (const r of rings) {
                r.spin = damp(r.spin, 0, 1.2, dt);
                if (align > 0 && align < 2.5) r.g.quaternion.slerp(q.identity(), Math.min(1, dt * 3));
                else {
                    q.setFromAxisAngle(r.ax, (r.w + r.spin) * dt);
                    r.g.quaternion.premultiply(q);
                }
            }
            zod.rotation.y += dt * 0.08;
            core.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
            halo.material.opacity = 0.5 + Math.sin(t * 2) * 0.1 + (align > 0 ? 0.3 : 0);
        },
    };
}

// ================================================================ the glass tree

export function buildGlassTree(ctx) {
    const { audio } = ctx;
    const r = ctx.rng;
    // a stone planter, a twisted brass trunk and branches
    ctx.geo('stone', lathe([[0, 0], [1.2, 0], [1.25, 0.5], [1.15, 0.55], [0, 0.55]], 40), 0, 0, 0);
    ctx.mat('soil', new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 }));
    ctx.geo('soil', new THREE.CylinderGeometry(1.12, 1.12, 0.04, 40), 0, 0.54, 0);
    ctx.collide(0, 0, 1.35);
    const branchTips = [];
    const tube = (pts, rad) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rad, 8, false);
    const trunk = [new V3(0, 0.5, 0), new V3(0.1, 1.4, 0.05), new V3(-0.08, 2.2, -0.05), new V3(0.05, 3.0, 0)];
    ctx.geo('bronze', tube(trunk, 0.16), 0, 0, 0);
    for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + r() * 0.4, y0 = 1.6 + r() * 1.3, len = 1.0 + r() * 0.8;
        const p0 = new V3(0, y0, 0);
        const p1 = new V3(Math.cos(a) * len * 0.5, y0 + 0.4, Math.sin(a) * len * 0.5);
        const p2 = new V3(Math.cos(a) * len, y0 + 0.7 + r() * 0.5, Math.sin(a) * len);
        ctx.geo('bronze', tube([p0, p1, p2], 0.05), 0, 0, 0);
        branchTips.push(p1, p2);
    }
    // leaves of coloured glass, clustered round the branch tips
    const N = 260;
    const leafGeo = new THREE.OctahedronGeometry(0.11, 0).scale(1, 1.6, 0.25);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85, emissive: 0xffffff, emissiveIntensity: 0.0 });
    leafMat.onBeforeCompile = (sh) => {
        // let each leaf's instance colour glow as well as tint
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance = vColor * 0.55;\n#endif');
    };
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
    const L = [];
    const o = new THREE.Object3D();
    const glass = ['#3fffb0', '#2fd0ff', '#8a5cff', '#ff6fa8', '#ffd84a', '#b8ff6a'];
    for (let i = 0; i < N; i++) {
        const tip = branchTips[Math.floor(r() * branchTips.length)];
        const p = tip.clone().add(new V3((r() - 0.5) * 0.7, (r() - 0.5) * 0.5, (r() - 0.5) * 0.7));
        const c = new THREE.Color(glass[Math.floor(r() * glass.length)]);
        L.push({ p, rot: new THREE.Euler(r() * 3, r() * 3, r() * 3), c, base: c.clone(), ph: r() * TAU, lit: 0 });
        leaves.setColorAt(i, c);
    }
    ctx.add(leaves);
    const shine = motes(40, 0xffffff, 0.08, 0.8);
    ctx.add(shine);
    let ripple = -1;
    ctx.hit(leaves, {
        label: 'The glass tree · its leaves chime',
        range: 6,
        onClick: () => {
            ripple = 0;
            audio.shimmer();
            ctx.say('A breeze you cannot feel runs up the glass tree, and every leaf rings its own small note.', 4500);
        },
    });
    const pl = plaqueMesh('The Glass Tree', 'Planted 1832 · watered with light', 0.6);
    pl.position.set(0, 0.32, 1.27);
    ctx.add(pl);
    const white = new THREE.Color(0xffffff);
    let notesPlayed = 0;
    return {
        update(dt, t) {
            if (ripple >= 0) {
                const prev = ripple;
                ripple += dt * 1.6;
                // a ripple climbing from the roots, with a chime at each step
                if (Math.floor(ripple * 6) !== Math.floor(prev * 6) && notesPlayed < 12) {
                    audio.bell(PENTA[4 + notesPlayed] + 12, 0, 0.025);
                    notesPlayed++;
                }
                if (ripple > 3) {
                    ripple = -1;
                    notesPlayed = 0;
                }
            }
            const sp = shine.geometry.attributes.position;
            L.forEach((l, i) => {
                const front = ripple >= 0 ? ripple * 1.6 + 0.4 : -9;
                if (Math.abs(l.p.y - front) < 0.3) l.lit = 1;
                l.lit = Math.max(0, l.lit - dt * 0.8);
                o.position.copy(l.p);
                o.position.x += Math.sin(t * 0.8 + l.ph) * 0.02;
                o.rotation.set(l.rot.x + Math.sin(t * 1.3 + l.ph) * 0.2, l.rot.y + t * 0.1, l.rot.z);
                o.scale.setScalar(1 + l.lit * 0.5);
                o.updateMatrix();
                leaves.setMatrixAt(i, o.matrix);
                l.c.copy(l.base).lerp(white, l.lit * 0.7).multiplyScalar(1 + l.lit * 2);
                leaves.setColorAt(i, l.c);
                if (i < 40) {
                    const k = (t * 0.2 + i / 40) % 1;
                    sp.setXYZ(i, l.p.x, l.p.y - k * 2.5, l.p.z);
                }
            });
            leaves.instanceMatrix.needsUpdate = true;
            leaves.instanceColor.needsUpdate = true;
            sp.needsUpdate = true;
        },
    };
}

// ================================================================ the vortex of books

const QUOTES = [
    '“Every book is a door. Some of them are also doorstops.”',
    '“Chapter Nine, in which nothing happens, beautifully.”',
    '“The end. (Please turn over.)”',
    '“It was a dark and stormy night, so I stayed in and read.”',
    '“Footnote 412: see footnote 411.”',
    '“Here begins the Book of Everything. Abridged.”',
];

export function buildBookSwirl(ctx) {
    const { audio } = ctx;
    const r = ctx.rng;
    // a lectern with an enormous open book
    ctx.geo('darkWood', lathe([[0, 0], [0.7, 0], [0.7, 0.1], [0.25, 0.2], [0.18, 1.0], [0.3, 1.1], [0, 1.1]], 20), 0, 0, 0);
    ctx.box('darkWood', 1.3, 0.08, 0.9, 0, 1.18, 0, 0, -0.25);
    ctx.collide(0, 0, 0.9);
    const pages = new THREE.Group();
    pages.position.set(0, 1.26, 0.02);
    pages.rotation.x = -0.25;
    for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.78), ctx.mats.paper);
        p.position.x = s * 0.3;
        p.rotation.z = s * 0.06;
        pages.add(p);
    }
    const glowPage = glow(0xffe8b0, 1.6, 0.5);
    glowPage.position.y = 0.2;
    pages.add(glowPage);
    ctx.add(pages);
    // the vortex
    const N = 26;
    const books = [];
    for (let i = 0; i < N; i++) {
        const g = new THREE.Group();
        const c = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(r(), 0.5, 0.35), roughness: 0.7, side: THREE.DoubleSide });
        const halves = [-1, 1].map((s) => {
            const h = new THREE.Group();
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.3).translate(s * 0.11, 0, 0), c);
            h.add(m);
            const pg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.27).translate(s * 0.1, 0.015, 0), ctx.mats.paper);
            h.add(pg);
            g.add(h);
            return h;
        });
        ctx.add(g);
        books.push({ g, halves, a: (i / N) * TAU * 2.5, h: (i / N), sp: 0.4 + r() * 0.3, ph: r() * TAU, burst: 0 });
    }
    const pl = plaqueMesh('The Book of Everything', 'Abridged', 0.6);
    pl.position.set(0, 0.6, 0.62);
    pl.rotation.x = -0.1;
    ctx.add(pl);
    let scatter = 0, qi = 0;
    ctx.proxy(2.4, 3.2, 2.4, 0, 2.6, 0, {
        label: 'The Book of Everything · read a line',
        range: 6,
        onClick: () => {
            scatter = 1;
            audio.page();
            audio.flutter();
            ctx.say(QUOTES[qi++ % QUOTES.length], 4500);
        },
    });
    const L = ctx.light(0xffe0a0, 4, 6, 0, 2.2, 0);
    return {
        update(dt, t) {
            scatter = Math.max(0, scatter - dt * 0.6);
            const out = ease.out(scatter);
            for (const b of books) {
                const a = b.a + t * b.sp;
                const rad = 0.6 + b.h * 1.2 + out * 1.5;
                const y = 1.9 + b.h * 3.2 + Math.sin(t + b.ph) * 0.1 + out * 0.4;
                b.g.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
                b.g.rotation.set(0.3, -a, Math.sin(t * 2 + b.ph) * 0.3);
                const flap = 0.5 + Math.sin(t * (6 + scatter * 10) + b.ph) * 0.45;
                b.halves[0].rotation.z = flap;
                b.halves[1].rotation.z = -flap;
            }
            glowPage.material.opacity = 0.4 + Math.sin(t * 1.5) * 0.15 + scatter * 0.4;
            L.intensity = 4 + scatter * 6;
        },
    };
}

// ================================================================ the plasma globe

export function buildPlasma(ctx) {
    const { audio } = ctx;
    const r = ctx.rng;
    plinth(ctx, 1.0, 0.7, 'iron');
    const Y = 2.0, R = 0.9;
    ctx.geo('copper', new THREE.TorusGeometry(0.75, 0.06, 8, 40).rotateX(Math.PI / 2), 0, 1.0, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshPhysicalMaterial({ color: 0xeef0ff, transparent: true, opacity: 0.14, roughness: 0.02, clearcoat: 1, depthWrite: false }));
    shell.position.y = Y;
    ctx.add(shell);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), emissiveMat(0xffb0ff, 3));
    core.position.y = Y;
    ctx.add(core);
    const coreGlow = glow(0xff6ad8, 1.4, 0.7);
    coreGlow.position.y = Y;
    ctx.add(coreGlow);
    const shellGlow = glow(0x8a5cff, 3.6, 0.15);
    shellGlow.position.y = Y;
    ctx.add(shellGlow);
    // tesla rings above, and coils at the foot
    for (let k = 0; k < 3; k++) ctx.geo('copper', new THREE.TorusGeometry(0.25 - k * 0.05, 0.03, 6, 24).rotateX(Math.PI / 2), 0, Y + R + 0.1 + k * 0.12, 0);
    ctx.geo('copper', new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), 0, Y + R + 0.2, 0);
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), ctx.mats.silver);
    topBall.position.y = Y + R + 0.5;
    ctx.add(topBall);
    // the tendrils: jagged lines from the core to the glass
    const NT = 10, SEG = 14;
    const tendrils = [];
    for (let i = 0; i < NT; i++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
        const col = new THREE.Color().setHSL(0.78 + r() * 0.15, 1, 0.7);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        line.frustumCulled = false;
        ctx.add(line);
        const tip = glow(col, 0.35, 0.8);
        ctx.add(tip);
        tendrils.push({ line, geo, tip, dir: new V3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), ph: r() * TAU });
    }
    const L = ctx.light(0xc86aff, 6, 8, 0, Y, 0);
    let zap = 0, told = false;
    const zapDir = new V3(0, 0, 1);
    ctx.proxy(2, 2, 2, 0, Y, 0, {
        label: 'The plasma globe · touch it',
        range: 5,
        onClick: (h) => {
            zap = 1;
            zapDir.set(h.local.x, h.point.y - Y, h.local.z).normalize();
            audio.noise(0.3, 4000, 1, 0.08);
            audio.noise(0.6, 900, 2, 0.05, 0.05);
            audio.arp([86, 93, 98], 0.03, 0.02);
            if (!told) {
                told = true;
                ctx.say('Every tendril of lightning in the globe rushes to meet your hand. It tickles.', 4000);
            }
        },
    });
    const pl = plaqueMesh('The Lightning Lantern', 'Please touch · it likes you', 0.6);
    pl.position.set(0, 0.55, 0.6);
    pl.rotation.x = -0.12;
    ctx.add(pl);
    const cam = new V3(), toCam = new V3(), tmp = new V3(), side = new V3();
    return {
        update(dt, t) {
            zap = Math.max(0, zap - dt * 1.4);
            ctx.camLocal(cam);
            toCam.set(cam.x, cam.y - Y, cam.z);
            const near = smoothstep(4.5, 1.5, toCam.length());
            toCam.normalize();
            for (const td of tendrils) {
                // wander, but lean toward the player when they are close, and all rush to a touch
                td.dir.x += Math.sin(t * 1.3 + td.ph) * dt * 0.8;
                td.dir.y += Math.cos(t * 1.1 + td.ph * 2) * dt * 0.8;
                td.dir.z += Math.sin(t * 0.9 + td.ph * 3) * dt * 0.8;
                td.dir.normalize();
                tmp.copy(td.dir).lerp(toCam, near * 0.55).lerp(zapDir, zap * 0.85).normalize();
                const p = td.geo.attributes.position;
                side.set(-tmp.z, 0.3, tmp.x).normalize();
                for (let i = 0; i < SEG; i++) {
                    const k = i / (SEG - 1);
                    const j = Math.sin(k * Math.PI) * 0.12;
                    const jx = (Math.random() - 0.5) * j, jy = (Math.random() - 0.5) * j, jz = (Math.random() - 0.5) * j;
                    p.setXYZ(i, tmp.x * R * 0.98 * k + jx + side.x * Math.sin(k * 7 + t * 9) * 0.04, Y + tmp.y * R * 0.98 * k + jy, tmp.z * R * 0.98 * k + jz);
                }
                p.needsUpdate = true;
                td.tip.position.set(tmp.x * R * 0.98, Y + tmp.y * R * 0.98, tmp.z * R * 0.98);
                td.line.material.opacity = 0.65 + Math.random() * 0.35;
            }
            coreGlow.scale.setScalar(1.3 + Math.sin(t * 13) * 0.08 + zap * 0.8);
            shellGlow.material.opacity = 0.12 + near * 0.08 + zap * 0.3;
            L.intensity = 6 + zap * 14 + Math.random() * 1.5;
        },
    };
}
