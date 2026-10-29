// The third floor of the Observatory, the Archive: the Cartographer's Table (a
// map of an island that does not exist yet, which redraws itself in spreading
// ink when you touch it, with globes and a compass that points at you) and the
// Gallery of Watchful Portraits (seven painted sitters whose eyes follow you,
// and who have opinions). The Infinite Library is in tower-library.js.
// Room-local frame: the door is at +z, the back wall at -z (see tower.js).

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { TAU, damp, clamp, lerp, rng, fbm2, smoothstep } from './util.js';
import { canvasTex, glow, emissiveMat, plaqueMesh } from './tower-kit.js';
import { pedestal, fern } from './rooms-hours.js';

const V3 = THREE.Vector3;

// ================================================================ names

const SYL = ['ar', 'bel', 'cor', 'dun', 'el', 'fen', 'gal', 'hav', 'is', 'jor', 'kel', 'lun', 'mor', 'nim', 'or', 'pell', 'quen', 'ros', 'sil', 'tam', 'ul', 'ver', 'wyn', 'yar', 'zan', 'ith', 'ash', 'bri', 'cal', 'dra'];
export function placeName(r) {
    let s = '';
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) s += SYL[Math.floor(r() * SYL.length)];
    if (r() < 0.25) s += ['mouth', 'ford', 'holm', 'wick', 'mere', 'by'][Math.floor(r() * 6)];
    return s[0].toUpperCase() + s.slice(1);
}

// ================================================================ the Cartographer's Table

/** An island on parchment: coast, forests, mountains, towns, a route, a compass and a sea serpent. */
export function islandMap(seed, w = 1024, h = 640) {
    const r = rng('isle' + seed);
    const ox = r() * 100, oy = r() * 100;
    const lobes = Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ x: 0.3 + r() * 0.4, y: 0.3 + r() * 0.4, s: 0.15 + r() * 0.2 }));
    const title = `The Isle of ${placeName(r)}`;
    const towns = [];
    const tex = canvasTex(w, h, (x) => {
        // parchment
        const g = x.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
        g.addColorStop(0, '#f1e2bc');
        g.addColorStop(1, '#c9a86a');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        const S = 4, gw = Math.ceil(w / S), gh = Math.ceil(h / S);
        const height = new Float32Array(gw * gh);
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
            const u = i / gw, v = j / gh;
            let land = 0;
            for (const l of lobes) land = Math.max(land, 1 - Math.hypot((u - l.x) * 1.4, v - l.y) / (l.s + 0.18));
            const n = fbm2(u * 5 + ox, v * 3.2 + oy, 5) * 0.55;
            height[j * gw + i] = land * 0.9 + n - 0.25;
        }
        const img = x.getImageData(0, 0, w, h);
        const d = img.data;
        for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
            const hv = height[Math.floor(y / S) * gw + Math.floor(xx / S)];
            const k = (y * w + xx) * 4;
            let c = null;
            if (hv < -0.08) c = [120, 160, 170, 0.18];
            else if (hv < 0) c = [90, 150, 170, 0.45];
            else if (hv < 0.04) c = [232, 214, 160, 0.9];
            else if (hv < 0.25) c = [150, 176, 100, 0.75];
            else if (hv < 0.42) c = [100, 140, 80, 0.8];
            else if (hv < 0.58) c = [170, 145, 100, 0.8];
            else c = [240, 236, 226, 0.9];
            const a = c[3];
            d[k] = d[k] * (1 - a) + c[0] * a;
            d[k + 1] = d[k + 1] * (1 - a) + c[1] * a;
            d[k + 2] = d[k + 2] * (1 - a) + c[2] * a;
        }
        x.putImageData(img, 0, 0);
        const at = (u, v) => height[Math.floor(v * gh) * gw + Math.floor(u * gw)] ?? -1;
        // coastline in ink
        x.strokeStyle = 'rgba(60,40,20,0.8)';
        x.lineWidth = 2;
        for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
            const a = height[j * gw + i] >= 0, b = height[j * gw + i + 1] >= 0, c = height[(j + 1) * gw + i] >= 0;
            if (a !== b || a !== c) x.fillRect(i * S, j * S, 2.5, 2.5);
        }
        // hatching on the sea near the coast
        x.strokeStyle = 'rgba(60,90,110,0.35)';
        x.lineWidth = 1;
        for (let k = 0; k < 900; k++) {
            const u = r(), v = r(), hv = at(u, v);
            if (hv < -0.01 && hv > -0.12) {
                x.beginPath();
                x.moveTo(u * w - 5, v * h);
                x.lineTo(u * w + 5, v * h);
                x.stroke();
            }
        }
        // forests and mountains
        x.fillStyle = 'rgba(40,80,40,0.85)';
        for (let k = 0; k < 1400; k++) {
            const u = r(), v = r(), hv = at(u, v);
            if (hv > 0.25 && hv < 0.42 && r() < 0.5) {
                const px = u * w, py = v * h;
                x.beginPath();
                x.moveTo(px, py - 8);
                x.lineTo(px + 4, py);
                x.lineTo(px - 4, py);
                x.fill();
            }
            if (hv > 0.45 && r() < 0.3) {
                const px = u * w, py = v * h;
                x.strokeStyle = 'rgba(70,50,30,0.9)';
                x.lineWidth = 1.6;
                x.beginPath();
                x.moveTo(px - 9, py + 4);
                x.lineTo(px, py - 9);
                x.lineTo(px + 9, py + 4);
                x.stroke();
                if (hv > 0.58) {
                    x.fillStyle = '#ffffff';
                    x.beginPath();
                    x.moveTo(px - 3, py - 5);
                    x.lineTo(px, py - 9);
                    x.lineTo(px + 3, py - 5);
                    x.fill();
                    x.fillStyle = 'rgba(40,80,40,0.85)';
                }
            }
        }
        // towns and the road between them
        for (let k = 0; k < 400 && towns.length < 6; k++) {
            const u = 0.12 + r() * 0.76, v = 0.15 + r() * 0.7, hv = at(u, v);
            if (hv > 0.04 && hv < 0.3 && towns.every((t) => Math.hypot(t.u - u, (t.v - v) * 0.6) > 0.12)) towns.push({ u, v, name: placeName(r) });
        }
        x.setLineDash([6, 6]);
        x.strokeStyle = 'rgba(150,40,30,0.8)';
        x.lineWidth = 2.5;
        x.beginPath();
        towns.forEach((t, i) => (i ? x.lineTo(t.u * w, t.v * h) : x.moveTo(t.u * w, t.v * h)));
        x.stroke();
        x.setLineDash([]);
        x.font = 'italic 600 22px Georgia, serif';
        x.textAlign = 'left';
        towns.forEach((t, i) => {
            x.fillStyle = '#7a1a10';
            x.beginPath();
            x.arc(t.u * w, t.v * h, i === 0 ? 7 : 5, 0, TAU);
            x.fill();
            x.fillStyle = '#2a1a0a';
            x.fillText(t.name, t.u * w + 10, t.v * h - 6);
        });
        if (towns.length) {
            const t = towns[towns.length - 1];
            x.fillStyle = '#b02010';
            x.font = '700 30px Georgia, serif';
            x.fillText('✕', t.u * w - 9, t.v * h + 10);
        }
        // a compass rose
        const cx = w - 100, cy = h - 110;
        x.strokeStyle = '#3a2a1a';
        x.fillStyle = '#3a2a1a';
        x.lineWidth = 1.5;
        x.beginPath();
        x.arc(cx, cy, 48, 0, TAU);
        x.stroke();
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU - Math.PI / 2, L = k % 2 ? 30 : 58;
            x.beginPath();
            x.moveTo(cx, cy);
            x.lineTo(cx + Math.cos(a - 0.2) * 12, cy + Math.sin(a - 0.2) * 12);
            x.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
            x.closePath();
            k % 2 ? x.stroke() : x.fill();
        }
        x.font = '700 22px Georgia, serif';
        x.textAlign = 'center';
        x.fillText('N', cx, cy - 64);
        // a sea serpent, as is traditional
        const sx = 80 + r() * 200, sy = h - 90;
        x.strokeStyle = '#2a4a3a';
        x.lineWidth = 6;
        x.lineCap = 'round';
        x.beginPath();
        for (let k = 0; k < 4; k++) x.arc(sx + k * 34, sy, 15, Math.PI, 0, k % 2 === 1);
        x.stroke();
        x.fillStyle = '#2a4a3a';
        x.beginPath();
        x.arc(sx - 18, sy - 6, 10, 0, TAU);
        x.fill();
        x.font = 'italic 18px Georgia, serif';
        x.fillStyle = '#3a2a1a';
        x.fillText(['Here be teapots', 'Here be dragons (small)', 'Here be nothing much', 'Here be a sea serpent named Gwen'][Math.floor(r() * 4)], sx + 50, sy + 38);
        // the cartouche
        x.fillStyle = 'rgba(245,232,200,0.92)';
        x.strokeStyle = '#5a3a1a';
        x.lineWidth = 3;
        x.beginPath();
        x.roundRect?.(w / 2 - 230, 18, 460, 62, 14);
        x.fill();
        x.stroke();
        x.fillStyle = '#3a1a0a';
        x.font = '700 34px Georgia, serif';
        x.fillText(title, w / 2, 60, 440);
        // a deckled border
        x.strokeStyle = 'rgba(90,60,30,0.7)';
        x.lineWidth = 8;
        x.strokeRect(6, 6, w - 12, h - 12);
    });
    return { tex, title, towns };
}

/** A globe's skin: continents on a blue sea, equirectangular. */
function globeTex(seed, sea = '#3a6a9a', land = '#c8b070') {
    return canvasTex(512, 256, (x, w, h) => {
        const r = rng('globe' + seed);
        const ox = r() * 50;
        x.fillStyle = sea;
        x.fillRect(0, 0, w, h);
        const img = x.getImageData(0, 0, w, h);
        const L = new THREE.Color(land), d = img.data;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const lon = (i / w) * TAU, lat = (j / h - 0.5) * Math.PI;
            const n = fbm2(Math.cos(lon) * 1.6 + ox, Math.sin(lon) * 1.6 + lat * 1.4, 5);
            if (n > 0.08) {
                const k = (j * w + i) * 4;
                d[k] = L.r * 255 * (0.85 + n);
                d[k + 1] = L.g * 255 * (0.85 + n);
                d[k + 2] = L.b * 255 * (0.85 + n);
            }
        }
        x.putImageData(img, 0, 0);
        x.strokeStyle = 'rgba(255,255,255,0.25)';
        for (let k = 1; k < 6; k++) {
            x.beginPath();
            x.moveTo(0, (k / 6) * h);
            x.lineTo(w, (k / 6) * h);
            x.stroke();
        }
    });
}

const INK_FRAG = /* glsl */ `
uniform sampler2D uOld; uniform sampler2D uNew; uniform float uP; uniform float uLight;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
    float m = n(vUv * 6.0) * 0.6 + n(vUv * 23.0) * 0.4;
    float d = length((vUv - 0.5) * vec2(1.6, 1.0));
    float k = smoothstep(uP * 1.6 - 0.25, uP * 1.6, m * 0.5 + d);
    vec3 a = texture2D(uOld, vUv).rgb, b = texture2D(uNew, vUv).rgb;
    float edge = smoothstep(0.0, 0.08, abs(k - 0.5)) ;
    vec3 col = mix(b, a, k);
    col = mix(vec3(0.12, 0.07, 0.03), col, 0.35 + 0.65 * edge);
    gl_FragColor = vec4(col * uLight, 1.0);
    #include <colorspace_fragment>
}`;

export function buildMaps(ctx) {
    const { W, D, ceil, audio } = ctx;
    const r = ctx.rng;
    // the great table
    const TZ = -0.7, TH = 0.95;
    ctx.box('darkWood', 3.0, 0.1, 1.9, 0, TH - 0.05, TZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.geo('darkWood', lathe([[0, 0], [0.09, 0], [0.06, 0.2], [0.1, 0.45], [0.06, 0.8], [0.08, TH - 0.1], [0, TH - 0.1]], 10), sx * 1.35, 0, TZ + sz * 0.8);
    ctx.box('gold', 3.04, 0.03, 1.94, 0, TH, TZ);
    ctx.collideBox(0, TZ, 3.0, 1.9);
    let seed = 1;
    let cur = islandMap(seed);
    const U = { uOld: { value: cur.tex }, uNew: { value: cur.tex }, uP: { value: 1 }, uLight: { value: 1 } };
    const map = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.69).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: INK_FRAG }));
    map.position.set(0, TH + 0.02, TZ);
    ctx.add(map);
    // weights, an inkwell and a quill
    for (const [x, z] of [[-1.3, TZ - 0.78], [1.3, TZ - 0.78], [-1.3, TZ + 0.78], [1.3, TZ + 0.78]]) ctx.geo('brass', new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), x, TH + 0.06, z);
    ctx.geo('black', new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), 1.2, TH + 0.08, TZ + 0.55);
    const quill = new THREE.Group();
    quill.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6).scale(0.3, 3.2, 0.06), ctx.mats.white));
    quill.position.set(1.2, TH + 0.3, TZ + 0.55);
    quill.rotation.z = -0.4;
    ctx.add(quill);
    let ink = 0;
    let next = null;
    const redraw = () => {
        if (ink > 0) return;
        seed++;
        next = islandMap(seed);
        U.uOld.value = cur.tex;
        U.uNew.value = next.tex;
        U.uP.value = 0;
        ink = 1e-4;
        audio.scratch();
        ctx.say(`The ink unpicks itself and runs into a new shape: ${next.title}. ${next.towns.length ? `Its capital is ${next.towns[0].name}.` : 'Nobody lives there yet.'}`, 6000);
    };
    ctx.hit(map, { label: () => `${cur.title} · click to unmake it`, range: 5, onClick: redraw });

    // globes on stands, which spin when you push them
    const globes = [];
    for (const [x, z, sea, land] of [[-3.6, -2.6, '#2a5a8a', '#d8c088'], [3.6, -2.6, '#1a3a4a', '#c8e0a0'], [3.6, 2.4, '#6a2a3a', '#f0d0a0']]) {
        ctx.geo('darkWood', lathe([[0, 0], [0.32, 0], [0.32, 0.06], [0.06, 0.12], [0.05, 0.8], [0, 0.8]], 16), x, 0, z);
        const g = new THREE.Group();
        g.position.set(x, 1.25, z);
        g.rotation.z = 0.41;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.MeshStandardMaterial({ map: globeTex(x * 10 + z, sea, land), roughness: 0.4 }));
        g.add(ball);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.018, 6, 40), ctx.mats.brass);
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
        ctx.add(g);
        ctx.box('brass', 0.03, 0.4, 0.03, x, 0.95, z);
        ctx.collide(x, z, 0.45);
        const gl = { ball, spin: 0.15 };
        globes.push(gl);
        ctx.hit(ball, { label: 'A globe of somewhere · give it a spin', onClick: () => {
            gl.spin = 9;
            audio.whoosh();
        } });
    }
    // a compass on a pedestal whose needle always finds you
    pedestal(ctx, -3.4, 2.2, 1.0, 'The Wishing Compass', 'Points at what you want most', 'darkWood');
    ctx.geo('brass', new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), -3.4, 1.03, 2.2);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x, w) => {
        x.fillStyle = '#f3e6c4';
        x.fillRect(0, 0, w, w);
        x.fillStyle = '#3a2a1a';
        x.font = '700 34px Georgia, serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        ['N', 'E', 'S', 'W'].forEach((l, k) => x.fillText(l, 128 + Math.sin((k * TAU) / 4) * 96, 128 - Math.cos((k * TAU) / 4) * 96));
        x.font = 'italic 18px Georgia, serif';
        x.fillText('you', 128, 166);
    }), roughness: 0.6 }));
    face.position.set(-3.4, 1.065, 2.2);
    ctx.add(face);
    const needle = new THREE.Group();
    const nm = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 4).rotateX(Math.PI / 2), emissiveMat(0xe8463c, 0.8, { color: 0xe8463c }));
    nm.position.z = 0.1;
    needle.add(nm);
    needle.position.set(-3.4, 1.09, 2.2);
    ctx.add(needle);
    let compassTold = false;
    ctx.proxy(0.7, 0.4, 0.7, -3.4, 1.1, 2.2, { label: 'The Wishing Compass', onClick: () => {
        audio.bell(81, 0, 0.04);
        ctx.say(compassTold ? 'Still you. It is very sure about this.' : 'It points to whatever you want most in the world. At the moment, that appears to be you.', 4500);
        compassTold = true;
    } });

    // framed maps on the walls, a barrel of scrolls
    for (const [x, z, ry, s] of [[-W / 2 + 0.06, -1.0, Math.PI / 2, 11], [W / 2 - 0.06, -0.4, -Math.PI / 2, 12], [-2.4, -D / 2 + 0.06, 0, 13], [2.4, -D / 2 + 0.06, 0, 14]]) {
        const m = islandMap(s * 7, 512, 320);
        const frame = new THREE.Group();
        frame.position.set(x, 2.6, z);
        frame.rotation.y = ry;
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: m.tex, roughness: 0.8 }));
        pic.position.z = 0.03;
        frame.add(pic);
        frame.add(new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.15, 0.04), ctx.mats.gold));
        ctx.add(frame);
    }
    ctx.geo('darkWood', lathe([[0, 0], [0.32, 0], [0.38, 0.4], [0.32, 0.8], [0, 0.8]], 16), 3.7, 0, 0.4);
    for (const y of [0.15, 0.65]) ctx.geo('iron', new THREE.TorusGeometry(0.35, 0.02, 6, 24).rotateX(Math.PI / 2), 3.7, y, 0.4);
    for (let k = 0; k < 7; k++) ctx.geo('paper', new THREE.CylinderGeometry(0.045, 0.045, 0.9, 10), 3.7 + Math.cos(k) * 0.16, 1.0, 0.4 + Math.sin(k) * 0.16, 0, 1, 1, 1, Math.cos(k * 3) * 0.2, Math.sin(k * 2) * 0.2);
    ctx.collide(3.7, 0.4, 0.42);
    // a lamp low over the table
    ctx.box('iron', 0.02, ceil - 2.6, 0.02, 0, (ceil + 2.6) / 2, TZ);
    ctx.geo('brass', new THREE.ConeGeometry(0.4, 0.3, 20, 1, true), 0, 2.45, TZ);
    ctx.mat('bulb', emissiveMat(0xffd890, 3));
    ctx.geo('bulb', new THREE.SphereGeometry(0.1, 12, 8), 0, 2.32, TZ);
    ctx.light(0xffd8a0, 14, 12, 0, 2.2, TZ);
    fern(ctx, -4.2, 3.4);

    return {
        update(dt, t) {
            if (ink > 0) {
                ink += dt / 2.4;
                U.uP.value = Math.min(1, ink);
                quill.rotation.z = -0.4 + Math.sin(t * 18) * 0.15;
                if (ink >= 1) {
                    ink = 0;
                    cur.tex.dispose();
                    cur = next;
                    U.uOld.value = cur.tex;
                }
            } else quill.rotation.z = -0.4;
            for (const g of globes) {
                g.ball.rotation.y += g.spin * dt;
                g.spin = damp(g.spin, 0.15, 0.6, dt);
            }
            // the needle turns to the player
            const p = ctx.player();
            const want = Math.atan2(p.x - -3.4, p.z - 2.2);
            needle.rotation.y += (Math.atan2(Math.sin(want - needle.rotation.y), Math.cos(want - needle.rotation.y))) * Math.min(1, dt * 3) + Math.sin(t * 7) * 0.003;
        },
    };
}

// ================================================================ the Gallery of Watchful Portraits

const SITTERS = [
    {
        name: 'Professor Hoot', title: 'Professor Hoot, D.Phil. (Nocturnal)', bg: ['#2a3a5a', '#101828'], eyes: [[0.4, 0.4], [0.6, 0.4]], eyeR: 0.07, iris: '#ffb02e',
        lines: ['Do keep your voice down. The books upstairs are sleeping.', 'I have read every book in the library. Twice. The second time upside down.', 'Who? Ah. You.'],
        draw(x, w, h) {
            x.fillStyle = '#6a4a2a';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.7, w * 0.34, h * 0.36, 0, 0, TAU);
            x.fill();
            x.fillStyle = '#c8a878';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.42, w * 0.3, h * 0.2, 0, 0, TAU);
            x.fill();
            x.fillStyle = '#6a4a2a';
            for (const s of [-1, 1]) {
                x.beginPath();
                x.moveTo(w * (0.5 + s * 0.22), h * 0.3);
                x.lineTo(w * (0.5 + s * 0.3), h * 0.14);
                x.lineTo(w * (0.5 + s * 0.12), h * 0.27);
                x.fill();
            }
            x.fillStyle = '#e8a030';
            x.beginPath();
            x.moveTo(w * 0.47, h * 0.47);
            x.lineTo(w * 0.53, h * 0.47);
            x.lineTo(w * 0.5, h * 0.55);
            x.fill();
            x.strokeStyle = '#d9b46a';
            x.lineWidth = 4;
            for (const s of [-1, 1]) {
                x.beginPath();
                x.arc(w * (0.5 + s * 0.1), h * 0.4, w * 0.1, 0, TAU);
                x.stroke();
            }
            x.fillStyle = '#111';
            x.fillRect(w * 0.28, h * 0.12, w * 0.44, h * 0.04);
            x.fillRect(w * 0.38, h * 0.16, w * 0.24, h * 0.06);
            x.strokeStyle = '#ffd84a';
            x.beginPath();
            x.moveTo(w * 0.7, h * 0.14);
            x.lineTo(w * 0.76, h * 0.26);
            x.stroke();
            x.fillStyle = '#8a6a4a';
            for (let i = 0; i < 18; i++) {
                x.beginPath();
                x.arc(w * (0.3 + (i % 6) * 0.08), h * (0.68 + Math.floor(i / 6) * 0.07), 6, 0, Math.PI);
                x.fill();
            }
        },
    },
    {
        name: 'The Duchess of Moth', title: 'Her Grace the Duchess of Moth', bg: ['#4a2a4a', '#1a0c1a'], eyes: [[0.44, 0.33], [0.56, 0.33]], eyeR: 0.045, iris: '#1a1a1a',
        lines: ['Is that a lamp in your pocket, or are you simply delighted to see me?', 'One does not flutter, darling. One drifts.', 'I was painted by candlelight. I ate three of the candles.'],
        draw(x, w, h) {
            const wing = (s, c1, c2) => {
                const g = x.createRadialGradient(w * (0.5 + s * 0.25), h * 0.5, 4, w * (0.5 + s * 0.25), h * 0.5, w * 0.3);
                g.addColorStop(0, c1);
                g.addColorStop(1, c2);
                x.fillStyle = g;
                x.beginPath();
                x.ellipse(w * (0.5 + s * 0.24), h * 0.45, w * 0.24, h * 0.2, s * 0.5, 0, TAU);
                x.fill();
                x.beginPath();
                x.ellipse(w * (0.5 + s * 0.18), h * 0.68, w * 0.16, h * 0.13, -s * 0.4, 0, TAU);
                x.fill();
                x.fillStyle = '#2a1a2a';
                x.beginPath();
                x.arc(w * (0.5 + s * 0.28), h * 0.44, w * 0.05, 0, TAU);
                x.fill();
                x.fillStyle = '#ffe0f0';
                x.beginPath();
                x.arc(w * (0.5 + s * 0.28), h * 0.44, w * 0.025, 0, TAU);
                x.fill();
            };
            wing(-1, '#ffd8f0', '#b07ad0');
            wing(1, '#ffd8f0', '#b07ad0');
            x.fillStyle = '#e8d8c8';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.6, w * 0.07, h * 0.22, 0, 0, TAU);
            x.fill();
            x.beginPath();
            x.arc(w * 0.5, h * 0.34, w * 0.1, 0, TAU);
            x.fill();
            x.strokeStyle = '#e8d8c8';
            x.lineWidth = 3;
            for (const s of [-1, 1]) {
                x.beginPath();
                x.moveTo(w * 0.5, h * 0.27);
                x.quadraticCurveTo(w * (0.5 + s * 0.06), h * 0.12, w * (0.5 + s * 0.16), h * 0.1);
                x.stroke();
            }
            x.fillStyle = '#fff';
            for (let i = 0; i < 9; i++) {
                x.beginPath();
                x.arc(w * (0.42 + i * 0.02), h * (0.43 + Math.sin((i / 8) * Math.PI) * 0.03), 4, 0, TAU);
                x.fill();
            }
            x.fillStyle = '#ffd84a';
            x.beginPath();
            x.moveTo(w * 0.44, h * 0.25);
            x.lineTo(w * 0.47, h * 0.2);
            x.lineTo(w * 0.5, h * 0.24);
            x.lineTo(w * 0.53, h * 0.2);
            x.lineTo(w * 0.56, h * 0.25);
            x.fill();
        },
    },
    {
        name: 'Sir Whiskerton', title: 'Sir Whiskerton, Astronomer Royal', bg: ['#1a2a5a', '#0a1028'], eyes: [[0.42, 0.38], [0.58, 0.38]], eyeR: 0.055, iris: '#7ad84a',
        lines: ['I discovered a comet once. I named it after myself. It did not come when called.', 'The stars are just very distant cats, you know. Sitting very still.', 'Mrrrp. Pardon me. Astronomical hiccup.'],
        draw(x, w, h) {
            x.fillStyle = '#ffe8a0';
            for (let i = 0; i < 30; i++) x.fillRect((i * 97) % w, (i * 53) % (h * 0.5), 2, 2);
            x.fillStyle = '#3a2a7a';
            x.beginPath();
            x.moveTo(w * 0.15, h);
            x.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.85, h);
            x.fill();
            x.fillStyle = '#ffd84a';
            for (let i = 0; i < 14; i++) x.fillRect(w * (0.25 + (i * 0.37) % 0.5), h * (0.7 + (i * 0.13) % 0.25), 4, 4);
            x.fillStyle = '#e8a050';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.42, w * 0.22, h * 0.17, 0, 0, TAU);
            x.fill();
            for (const s of [-1, 1]) {
                x.beginPath();
                x.moveTo(w * (0.5 + s * 0.2), h * 0.34);
                x.lineTo(w * (0.5 + s * 0.2), h * 0.16);
                x.lineTo(w * (0.5 + s * 0.06), h * 0.28);
                x.fill();
            }
            x.fillStyle = '#ffd0c0';
            x.beginPath();
            x.moveTo(w * 0.47, h * 0.47);
            x.lineTo(w * 0.53, h * 0.47);
            x.lineTo(w * 0.5, h * 0.5);
            x.fill();
            x.strokeStyle = '#fff';
            x.lineWidth = 1.5;
            for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
                x.beginPath();
                x.moveTo(w * (0.5 + s * 0.05), h * 0.49);
                x.lineTo(w * (0.5 + s * 0.3), h * (0.45 + k * 0.04));
                x.stroke();
            }
            x.fillStyle = '#d9b46a';
            x.save();
            x.translate(w * 0.72, h * 0.72);
            x.rotate(-0.7);
            x.fillRect(-8, -60, 16, 120);
            x.fillRect(-11, -66, 22, 12);
            x.restore();
        },
    },
    {
        name: 'Lady Croak', title: 'Lady Croak of the Lower Pond', bg: ['#2a4a2a', '#0c1a0c'], eyes: [[0.38, 0.3], [0.62, 0.3]], eyeR: 0.065, iris: '#d8a020',
        lines: ['Ribbit is so common. I prefer “indeed”.', 'In my youth I was kissed by a prince. He turned into a frog. We are very happy.', 'Mind the lily pads, dear. They bruise.'],
        draw(x, w, h) {
            x.fillStyle = '#f6f0e0';
            for (let k = 0; k < 14; k++) {
                const a = (k / 14) * TAU;
                x.beginPath();
                x.ellipse(w * 0.5 + Math.cos(a) * w * 0.22, h * 0.66 + Math.sin(a) * h * 0.06, w * 0.08, h * 0.04, a, 0, TAU);
                x.fill();
            }
            x.fillStyle = '#5aa04a';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.17, 0, 0, TAU);
            x.fill();
            for (const s of [-1, 1]) {
                x.beginPath();
                x.arc(w * (0.5 + s * 0.12), h * 0.32, w * 0.1, 0, TAU);
                x.fill();
            }
            x.strokeStyle = '#2a4a1a';
            x.lineWidth = 3;
            x.beginPath();
            x.arc(w * 0.5, h * 0.48, w * 0.18, 0.2, Math.PI - 0.2);
            x.stroke();
            x.fillStyle = '#8a2a6a';
            x.beginPath();
            x.moveTo(w * 0.2, h);
            x.lineTo(w * 0.3, h * 0.72);
            x.lineTo(w * 0.7, h * 0.72);
            x.lineTo(w * 0.8, h);
            x.fill();
            x.fillStyle = '#ffd84a';
            x.beginPath();
            x.arc(w * 0.5, h * 0.78, 9, 0, TAU);
            x.fill();
        },
    },
    {
        name: 'Captain Teapot', title: 'Captain Teapot, retired (of the S.S. Darjeeling)', bg: ['#5a2a1a', '#200c08'], eyes: [[0.42, 0.5], [0.58, 0.5]], eyeR: 0.05, iris: '#2a5aa0',
        lines: ['Steady as she pours!', 'I sailed the seven saucers. All of them chipped.', 'Never trust a man who takes his tea with mustard. Never.'],
        draw(x, w, h) {
            x.fillStyle = '#e8eef8';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.58, w * 0.28, h * 0.22, 0, 0, TAU);
            x.fill();
            x.strokeStyle = '#3a6ac0';
            x.lineWidth = 4;
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.58, w * 0.22, h * 0.16, 0, 0, TAU);
            x.stroke();
            x.fillStyle = '#e8eef8';
            x.beginPath();
            x.moveTo(w * 0.76, h * 0.6);
            x.quadraticCurveTo(w * 0.92, h * 0.55, w * 0.9, h * 0.38);
            x.lineTo(w * 0.86, h * 0.4);
            x.quadraticCurveTo(w * 0.86, h * 0.52, w * 0.74, h * 0.52);
            x.fill();
            x.lineWidth = 8;
            x.strokeStyle = '#e8eef8';
            x.beginPath();
            x.arc(w * 0.22, h * 0.58, w * 0.08, Math.PI * 0.5, Math.PI * 1.5);
            x.stroke();
            x.fillStyle = '#5a3a1a';
            x.beginPath();
            x.moveTo(w * 0.36, h * 0.58);
            x.quadraticCurveTo(w * 0.5, h * 0.52, w * 0.5, h * 0.6);
            x.quadraticCurveTo(w * 0.5, h * 0.52, w * 0.64, h * 0.58);
            x.quadraticCurveTo(w * 0.5, h * 0.66, w * 0.36, h * 0.58);
            x.fill();
            x.fillStyle = '#1a2a4a';
            x.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.08);
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.3, w * 0.16, h * 0.08, 0, Math.PI, TAU);
            x.fill();
            x.fillStyle = '#ffd84a';
            x.beginPath();
            x.arc(w * 0.5, h * 0.28, 7, 0, TAU);
            x.fill();
        },
    },
    {
        name: 'The Moon', title: 'The Moon (a self-portrait)', bg: ['#0a0a2a', '#000010'], eyes: [[0.42, 0.44], [0.58, 0.44]], eyeR: 0.045, iris: '#3a3a5a',
        lines: ['I painted this myself, with my good side towards you. I only have the one side.', 'Every night I come round and nobody ever asks how my day was.', 'Shhh. I am waning.'],
        draw(x, w, h) {
            const g = x.createRadialGradient(w * 0.45, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.36);
            g.addColorStop(0, '#fffbe8');
            g.addColorStop(1, '#d8d0b0');
            x.fillStyle = g;
            x.beginPath();
            x.arc(w * 0.5, h * 0.5, w * 0.34, 0, TAU);
            x.fill();
            x.fillStyle = 'rgba(160,150,120,0.4)';
            for (const [cx, cy, rr] of [[0.35, 0.36, 0.06], [0.64, 0.62, 0.08], [0.4, 0.68, 0.04], [0.66, 0.34, 0.03]]) {
                x.beginPath();
                x.arc(w * cx, h * cy, w * rr, 0, TAU);
                x.fill();
            }
            x.strokeStyle = '#8a7a5a';
            x.lineWidth = 3;
            x.beginPath();
            x.arc(w * 0.5, h * 0.54, w * 0.1, 0.3, Math.PI - 0.3);
            x.stroke();
            x.fillStyle = 'rgba(255,150,150,0.35)';
            for (const s of [-1, 1]) {
                x.beginPath();
                x.arc(w * (0.5 + s * 0.15), h * 0.54, 10, 0, TAU);
                x.fill();
            }
            x.fillStyle = '#fff';
            for (let i = 0; i < 40; i++) x.fillRect((i * 71) % w, (i * 113) % h, 1.5, 1.5);
        },
    },
    {
        name: 'Gerald', title: 'Gerald, a Very Small Dragon', bg: ['#4a2a5a', '#180a20'], eyes: [[0.41, 0.38], [0.57, 0.38]], eyeR: 0.05, iris: '#ff6a1a',
        lines: ['I am fearsome. I am terrible. I am four inches tall.', 'I would breathe fire at you, but the frame is varnished.', 'Bring me treasure! Or a biscuit. A biscuit would be fine.'],
        draw(x, w, h) {
            x.fillStyle = '#5ab07a';
            x.beginPath();
            x.ellipse(w * 0.5, h * 0.75, w * 0.24, h * 0.2, 0, 0, TAU);
            x.fill();
            x.beginPath();
            x.ellipse(w * 0.49, h * 0.42, w * 0.2, h * 0.15, 0, 0, TAU);
            x.fill();
            x.beginPath();
            x.ellipse(w * 0.6, h * 0.48, w * 0.14, h * 0.08, 0.2, 0, TAU);
            x.fill();
            x.fillStyle = '#f0e0a0';
            for (const s of [-1, 1]) {
                x.beginPath();
                x.moveTo(w * (0.49 + s * 0.1), h * 0.3);
                x.lineTo(w * (0.49 + s * 0.14), h * 0.16);
                x.lineTo(w * (0.49 + s * 0.04), h * 0.28);
                x.fill();
            }
            x.fillStyle = '#3a7a5a';
            x.beginPath();
            x.moveTo(w * 0.2, h * 0.65);
            x.lineTo(w * 0.05, h * 0.45);
            x.lineTo(w * 0.15, h * 0.5);
            x.lineTo(w * 0.1, h * 0.35);
            x.lineTo(w * 0.3, h * 0.6);
            x.fill();
            x.fillStyle = 'rgba(200,200,200,0.6)';
            for (let i = 0; i < 4; i++) {
                x.beginPath();
                x.arc(w * (0.76 + i * 0.05), h * (0.44 - i * 0.05), 6 + i * 3, 0, TAU);
                x.fill();
            }
            x.fillStyle = '#1a3a2a';
            x.beginPath();
            x.arc(w * 0.68, h * 0.47, 3, 0, TAU);
            x.fill();
        },
    },
];

export function buildPortraits(ctx) {
    const { W, D, ceil, audio } = ctx;
    const spots = [
        [-3.0, 2.7, -D / 2 + 0.07, 0], [0, 2.9, -D / 2 + 0.07, 0], [3.0, 2.7, -D / 2 + 0.07, 0],
        [-W / 2 + 0.07, 2.7, -1.6, Math.PI / 2], [-W / 2 + 0.07, 2.7, 1.5, Math.PI / 2],
        [W / 2 - 0.07, 2.7, -1.6, -Math.PI / 2], [W / 2 - 0.07, 2.7, 1.5, -Math.PI / 2],
    ];
    const PW = 1.25, PH = 1.6;
    const sitters = SITTERS.map((s, i) => {
        const [x, y, z, ry] = spots[i];
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = ry;
        const tex = canvasTex(320, 410, (c, w, h) => {
            const bg = c.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, s.bg[0]);
            bg.addColorStop(1, s.bg[1]);
            c.fillStyle = bg;
            c.fillRect(0, 0, w, h);
            const v = c.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h / 2, h * 0.7);
            v.addColorStop(0, 'rgba(255,240,200,0.18)');
            v.addColorStop(1, 'rgba(0,0,0,0.4)');
            c.fillStyle = v;
            c.fillRect(0, 0, w, h);
            s.draw(c, w, h);
            // the painted eye sockets, covered by the real eyes
            c.fillStyle = 'rgba(0,0,0,0.5)';
            for (const [u, vv] of s.eyes) {
                c.beginPath();
                c.arc(u * w, vv * h, s.eyeR * w * 1.25, 0, TAU);
                c.fill();
            }
            // craquelure
            c.strokeStyle = 'rgba(0,0,0,0.08)';
            for (let k = 0; k < 60; k++) {
                c.beginPath();
                c.moveTo(Math.random() * w, Math.random() * h);
                c.lineTo(Math.random() * w, Math.random() * h);
                c.stroke();
            }
        });
        const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), canvasMat);
        pic.position.z = 0.06;
        g.add(pic);
        // the gilt frame
        const fm = ctx.mats.gold;
        for (const [fw, fh, fx, fy] of [[PW + 0.32, 0.16, 0, PH / 2 + 0.08], [PW + 0.32, 0.16, 0, -PH / 2 - 0.08], [0.16, PH, -PW / 2 - 0.08, 0], [0.16, PH, PW / 2 + 0.08, 0]]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.12), fm);
            b.position.set(fx, fy, 0.06);
            g.add(b);
        }
        const name = plaqueMesh(s.name, null, 0.6);
        name.position.set(0, -PH / 2 - 0.3, 0.04);
        g.add(name);
        // a picture light
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 10).rotateZ(Math.PI / 2), emissiveMat(0xffe0a0, 2));
        pl.position.set(0, PH / 2 + 0.28, 0.2);
        g.add(pl);
        // the eyes, which follow you
        const eyes = s.eyes.map(([u, v]) => {
            const R = s.eyeR * PW;
            const e = new THREE.Group();
            e.position.set((u - 0.5) * PW, (0.5 - v) * PH, 0.06);
            e.add(new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), ctx.mats.white));
            const iris = new THREE.Mesh(new THREE.CircleGeometry(R * 0.55, 16), new THREE.MeshStandardMaterial({ color: s.iris, roughness: 0.3 }));
            const pupil = new THREE.Mesh(new THREE.CircleGeometry(R * 0.28, 12), ctx.mats.black);
            pupil.position.z = 0.002;
            const gleam = new THREE.Mesh(new THREE.CircleGeometry(R * 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            gleam.position.set(R * 0.12, R * 0.14, 0.004);
            // the iris sits on the eyeball's surface and turns about its centre
            const pivot = new THREE.Group();
            const look = new THREE.Group();
            look.add(iris, pupil, gleam);
            look.position.z = R * 0.99;
            pivot.add(look);
            e.add(pivot);
            g.add(e);
            return { e, pivot };
        });
        ctx.add(g);
        const sitter = { s, g, eyes, said: 0, glow: 0, blink: 2 + Math.random() * 5, bob: 0 };
        ctx.hit(pic, {
            label: s.title,
            range: 7,
            onClick: () => {
                const line = s.lines[sitter.said++ % s.lines.length];
                sitter.glow = 1;
                sitter.bob = 1;
                audio.murmur(i === 6 ? 1.6 : i === 0 ? 0.8 : 1 + i * 0.07);
                ctx.say(`${s.name}: “${line}”`, 5600);
            },
        });
        return sitter;
    });
    // a velvet bench to sit and be watched on, and a rope
    ctx.box('velvet', 2.2, 0.14, 0.6, 0, 0.5, 0.4);
    for (const sx of [-1, 1]) ctx.geo('gold', new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), sx * 1.0, 0.22, 0.4);
    ctx.collideBox(0, 0.4, 2.2, 0.6);
    for (const [x, z] of [[-4.2, 3.2], [4.2, 3.2]]) fern(ctx, x, z, 1.2);
    ctx.light(0xffe0c0, 13, 14, 0, ceil - 0.6, -0.5);

    const cam = new V3();
    return {
        update(dt, t) {
            ctx.camLocal(cam);
            for (const st of sitters) {
                st.glow = Math.max(0, st.glow - dt);
                st.bob = Math.max(0, st.bob - dt * 1.5);
                st.g.children[0].material.emissiveIntensity = 0.12 + st.glow * 0.35;
                st.blink -= dt;
                const closing = st.blink < 0.14 ? Math.sin((st.blink / 0.14) * Math.PI) : 0;
                if (st.blink < 0) st.blink = 2 + Math.random() * 6;
                const ry = st.g.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
                const dx = cam.x - st.g.position.x, dz = cam.z - st.g.position.z;
                const gx = dx * c - dz * sn, gz = dx * sn + dz * c;
                for (const e of st.eyes) {
                    const lx = gx - e.e.position.x, lz = gz - e.e.position.z, ly = cam.y - st.g.position.y - e.e.position.y;
                    const yaw = clamp(Math.atan2(lx, Math.max(0.2, lz)), -0.8, 0.8);
                    const pitch = clamp(Math.atan2(ly, Math.max(0.2, Math.hypot(lx, lz))), -0.6, 0.6);
                    e.pivot.rotation.set(-pitch, yaw, 0, 'YXZ');
                    e.e.scale.y = 1 - closing * 0.92 + st.bob * Math.sin(t * 30) * 0.08;
                }
            }
        },
    };
}
