/**
 * fx.js — particles, projectiles, telegraph tiles, ambient motes and floating
 * combat text. One additive Points cloud carries every spark, ember, snowflake
 * and puff (CPU-simulated, capped per frame so big chains never white out).
 */

import * as THREE from 'three';
import { scene, camera, toScreen } from './scene.js';
import { glowTexture } from './textures.js';

const MAX = 2600;
const P = {
    pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), col: new Float32Array(MAX * 3),
    size: new Float32Array(MAX), life: new Float32Array(MAX), max: new Float32Array(MAX), grav: new Float32Array(MAX), drag: new Float32Array(MAX),
    alpha: new Float32Array(MAX), next: 0, points: null, geo: null, budget: 0,
};

const vert = `
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
    varying float vAlpha; varying vec3 vColor;
    void main() {
        vAlpha = aAlpha; vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
    }`;
const frag = `
    uniform sampler2D uTex; varying float vAlpha; varying vec3 vColor;
    void main() {
        float a = texture2D(uTex, gl_PointCoord).a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a, a);
    }`;

const tele = { mesh: null, max: 700 };
const proj = [];
let ambient = null;
let numbersEl = null;
const numbers = [];

export function initFx() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(P.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(P.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTexture() } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    P.points = new THREE.Points(geo, mat);
    P.points.frustumCulled = false;
    P.points.renderOrder = 5;
    P.geo = geo;
    scene.add(P.points);

    const tg = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false });
    tele.mesh = new THREE.InstancedMesh(tg, tm, tele.max);
    tele.mesh.count = 0;
    tele.mesh.frustumCulled = false;
    tele.mesh.renderOrder = 3;
    tele.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tele.max * 3), 3);
    scene.add(tele.mesh);

    numbersEl = document.getElementById('numbers');
}

const _c = new THREE.Color();
/** Emit n particles. o: x,y,z, spread, vel, vy, color, size, life, grav, drag, up. */
export function burst(o) {
    const n = Math.min(o.n || 10, P.budget);
    P.budget -= n;
    _c.set(o.color ?? 0xffffff);
    const k = o.bright ?? 1.6;
    for (let i = 0; i < n; i++) {
        const j = P.next; P.next = (P.next + 1) % MAX;
        const sp = o.spread ?? 0.2;
        P.pos[j * 3] = o.x + (Math.random() - 0.5) * sp;
        P.pos[j * 3 + 1] = (o.y ?? 0.5) + (Math.random() - 0.5) * sp * 0.6;
        P.pos[j * 3 + 2] = o.z + (Math.random() - 0.5) * sp;
        const v = o.vel ?? 2;
        const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.6;
        P.vel[j * 3] = Math.cos(a) * Math.cos(e) * v * (0.4 + Math.random() * 0.6) + (o.vx || 0);
        P.vel[j * 3 + 1] = (o.up ?? 1) * Math.abs(Math.sin(e)) * v * (0.4 + Math.random()) + (o.vy || 0);
        P.vel[j * 3 + 2] = Math.sin(a) * Math.cos(e) * v * (0.4 + Math.random() * 0.6) + (o.vz || 0);
        const t = Math.random() * 0.3;
        P.col[j * 3] = _c.r * k * (1 - t * 0.3); P.col[j * 3 + 1] = _c.g * k; P.col[j * 3 + 2] = _c.b * k * (1 + t * 0.2);
        P.size[j] = (o.size ?? 0.18) * (0.6 + Math.random() * 0.8);
        P.max[j] = P.life[j] = (o.life ?? 0.6) * (0.6 + Math.random() * 0.7);
        P.grav[j] = o.grav ?? -4;
        P.drag[j] = o.drag ?? 1.5;
        P.alpha[j] = 1;
    }
}

function updateParticles(dt) {
    for (let j = 0; j < MAX; j++) {
        if (P.life[j] <= 0) { if (P.alpha[j]) P.alpha[j] = 0; continue; }
        P.life[j] -= dt;
        const dr = Math.max(0, 1 - P.drag[j] * dt);
        P.vel[j * 3] *= dr; P.vel[j * 3 + 2] *= dr;
        P.vel[j * 3 + 1] = P.vel[j * 3 + 1] * dr + P.grav[j] * dt;
        P.pos[j * 3] += P.vel[j * 3] * dt; P.pos[j * 3 + 1] += P.vel[j * 3 + 1] * dt; P.pos[j * 3 + 2] += P.vel[j * 3 + 2] * dt;
        if (P.pos[j * 3 + 1] < 0.02) { P.pos[j * 3 + 1] = 0.02; P.vel[j * 3 + 1] *= -0.3; }
        const f = P.life[j] / P.max[j];
        P.alpha[j] = f < 0.3 ? f / 0.3 : 1;
    }
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) P.geo.attributes[k].needsUpdate = true;
}

// ------------------------------------------------------------------ Projectiles

const PROJ = {
    arrow: { col: 0xffe8c0, size: 0.18, speed: 22, trail: 0xffd8a0 }, stone: { col: 0xa09080, size: 0.16, speed: 16 },
    quill: { col: 0xd0d0ff, size: 0.16, speed: 20, trail: 0x8080ff }, bolt: { col: 0xff6040, size: 0.2, speed: 22, trail: 0xff4020 },
    fire: { col: 0xff7020, size: 0.5, speed: 14, trail: 0xff5010 }, ember: { col: 0xffa040, size: 0.34, speed: 16, trail: 0xff7020 },
    frost: { col: 0x9ae0ff, size: 0.4, speed: 14, trail: 0x80d0ff }, arcane: { col: 0xc080ff, size: 0.36, speed: 14, trail: 0xa060ff },
    ink: { col: 0x4a6aff, size: 0.36, speed: 12, trail: 0x2030a0 }, spore: { col: 0xa0ff70, size: 0.3, speed: 11, trail: 0x80ff50 },
    prism: { col: 0xffffff, size: 0.36, speed: 18, trail: 0xff80ff }, wail: { col: 0xd0e0ff, size: 0.45, speed: 13, trail: 0xb0c0ff },
    beam: { col: 0xff4a8a, size: 0.4, speed: 26, trail: 0xff2a6a }, star: { col: 0xffe08a, size: 0.32, speed: 20, trail: 0xffd060 },
    shadow: { col: 0x8a50ff, size: 0.4, speed: 13, trail: 0x4a20a0 }, heal: { col: 0x70ff90, size: 0.3, speed: 12, trail: 0x50ff70 },
    drain: { col: 0x80ff90, size: 0.4, speed: 12, trail: 0x40ff60 }, bomb: { col: 0xff6020, size: 0.34, speed: 11, trail: 0xff8040, arc: 1.4 },
    frostbomb: { col: 0x80e0ff, size: 0.34, speed: 11, trail: 0xa0f0ff, arc: 1.4 },
};

export function shoot(e) {
    const k = PROJ[e.kind] || PROJ.arcane;
    const sm = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(k.col).multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const s = new THREE.Sprite(sm);
    const size = k.size * (e.big ? 1.6 : 1);
    s.scale.set(size, size, 1);
    scene.add(s);
    const d = Math.hypot(e.x - e.fx, e.y - e.fy);
    proj.push({ s, fx: e.fx, fy: e.fy, x: e.x, y: e.y, t: 0, dur: Math.max(0.08, d / k.speed), k, arc: k.arc || 0 });
}

function updateProjectiles(dt) {
    for (let i = proj.length - 1; i >= 0; i--) {
        const p = proj[i];
        p.t += dt / p.dur;
        const t = Math.min(1, p.t);
        const x = p.fx + (p.x - p.fx) * t, z = p.fy + (p.y - p.fy) * t;
        const y = 0.75 + Math.sin(t * Math.PI) * (p.arc || 0.15);
        p.s.position.set(x, y, z);
        if (p.k.trail) burst({ x, y, z, n: 2, color: p.k.trail, vel: 0.3, size: p.s.scale.x * 0.6, life: 0.3, grav: 0, spread: 0.05 });
        if (p.t >= 1) {
            burst({ x: p.x, y: 0.7, z: p.y, n: 10, color: p.k.trail || p.k.col, vel: 2.2, size: 0.14, life: 0.35 });
            scene.remove(p.s); p.s.material.dispose();
            proj.splice(i, 1);
        }
    }
}

// ------------------------------------------------------------------ Telegraphs

const TELE_COL = { slam: 0xff3020, burrow: 0xff5020, poison: 0x60ff40, rune: 0x6080ff, fire: 0xff6010, beam: 0xff40c0, ice: 0x80d8ff, void: 0xa040ff, charge: 0xff3030, meteor: 0xffb020, arcane: 0xd080ff };
const _m = new THREE.Matrix4();

function updateTelegraphs(run, time) {
    const w = run.lv.w;
    let n = 0;
    const put = (i, col, a, y) => {
        if (n >= tele.max) return;
        _m.makeTranslation(i % w, y, (i / w) | 0);
        tele.mesh.setMatrixAt(n, _m);
        _c.set(col).multiplyScalar(a);
        tele.mesh.setColorAt(n, _c);
        n++;
    };
    const pulse = 0.55 + Math.sin(time * 9) * 0.3;
    for (const h of run.hazards) {
        const col = h.friendly ? TELE_COL.meteor : TELE_COL[h.kind] || 0xff3030;
        for (const i of h.tiles) if (run.lv.seen[i]) put(i, col, pulse * (h.friendly ? 0.7 : 1), 0.045);
    }
    for (const f of run.fields) {
        const col = TELE_COL[f.kind] || 0x60ff40;
        for (const i of f.tiles) if (run.lv.seen[i]) put(i, col, 0.28 + Math.sin(time * 3 + i) * 0.06, 0.04);
    }
    tele.mesh.count = n;
    tele.mesh.instanceMatrix.needsUpdate = true;
    if (tele.mesh.instanceColor) tele.mesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ Ambient

const AMBIENT = {
    dust: { col: 0xd0b890, n: 50, vy: 0.05, size: 0.06 }, spores: { col: 0x80ffd0, n: 70, vy: 0.12, size: 0.07 },
    pages: { col: 0xfff0c0, n: 30, vy: -0.04, size: 0.06 }, embers: { col: 0xff7020, n: 70, vy: 0.5, size: 0.06 },
    sparkles: { col: 0xd0b0ff, n: 60, vy: 0.04, size: 0.06 }, ash: { col: 0x9a9aa0, n: 60, vy: -0.08, size: 0.05 },
    steam: { col: 0xffe8c0, n: 40, vy: 0.2, size: 0.09 }, snow: { col: 0xffffff, n: 110, vy: -0.45, size: 0.06 },
    stars: { col: 0xc0b0ff, n: 80, vy: 0.02, size: 0.05 },
};
let ambT = 0;
export function setAmbient(kind) { ambient = AMBIENT[kind] || AMBIENT.dust; }
function updateAmbient(dt, focus) {
    if (!ambient) return;
    ambT += dt * ambient.n / 10;
    while (ambT >= 1) {
        ambT -= 1;
        burst({ x: focus.x + (Math.random() - 0.5) * 18, y: Math.random() * 2.5 + 0.3, z: focus.z + (Math.random() - 0.5) * 14, n: 1, color: ambient.col, vel: 0.15, vy: ambient.vy, up: 0, grav: 0, drag: 0.1, size: ambient.size * (1 + Math.random()), life: 4, bright: 0.9, spread: 0 });
    }
}

// ------------------------------------------------------------------ Floating text

export function floatText(x, y, text, cls = '', h = 1.2) {
    if (!numbersEl) return;
    const el = document.createElement('div');
    el.className = 'num ' + cls;
    el.textContent = text;
    numbersEl.appendChild(el);
    // Stack texts that pop at the same spot in the same moment instead of overprinting them.
    const stacked = numbers.filter((n) => n.t < 0.35 && Math.abs(n.x - x) < 0.8 && Math.abs(n.y - y) < 0.8).length;
    numbers.push({ el, x: x + (Math.random() - 0.5) * 0.3, y, h: h + stacked * 0.42, t: -stacked * 0.08, dx: (Math.random() - 0.5) * 20 });
    if (numbers.length > 40) { const o = numbers.shift(); o.el.remove(); }
}

function updateNumbers(dt) {
    for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.t += dt;
        const s = toScreen(n.x, n.y, n.h + Math.max(0, n.t) * 0.9);
        const a = n.t < 0 ? 0 : n.t < 0.15 ? n.t / 0.15 : Math.max(0, 1 - (n.t - 0.6) / 0.5);
        const sc = n.t < 0.12 ? 0.6 + n.t * 4 : 1.08 - Math.min(0.08, (n.t - 0.12) * 0.4);
        n.el.style.transform = `translate(${s.x + n.dx * n.t - 30}px, ${s.y}px) scale(${sc})`;
        n.el.style.opacity = a;
        if (n.t > 1.15) { n.el.remove(); numbers.splice(i, 1); }
    }
}

// ------------------------------------------------------------------ Frame

export function updateFx(run, dt, time, focus, actorPos) {
    P.budget = 320;
    updateAmbient(dt, focus);
    // Status auras on visible actors.
    const W = run.lv.w;
    for (const m of [run.p, ...run.mons]) {
        if (!m.st || m.dead) continue;
        if (m.id !== 0 && !run._t.vis[m.y * W + m.x]) continue;
        const p = actorPos(m.id);
        if (!p) continue;
        if (m.st.burn && Math.random() < dt * 18) burst({ x: p.x, y: 0.5, z: p.z, n: 1, color: 0xff6010, vel: 0.4, vy: 1.6, grav: 0, size: 0.28, life: 0.5, spread: 0.4 });
        if (m.st.poison && Math.random() < dt * 8) burst({ x: p.x, y: 0.6, z: p.z, n: 1, color: 0x70ff40, vel: 0.2, vy: 0.8, grav: 0, size: 0.14, life: 0.7, spread: 0.4 });
        if (m.st.frozen && Math.random() < dt * 8) burst({ x: p.x, y: 0.8, z: p.z, n: 1, color: 0xc0f0ff, vel: 0.4, grav: -1, size: 0.1, life: 0.8, spread: 0.5 });
        if (m.st.shield && Math.random() < dt * 10) burst({ x: p.x, y: 0.7, z: p.z, n: 1, color: 0x80c0ff, vel: 0.8, grav: 0, size: 0.12, life: 0.5, spread: 0.8 });
        if (m.st.haste && Math.random() < dt * 10) burst({ x: p.x, y: 0.3, z: p.z, n: 1, color: 0x60e0ff, vel: 0.3, grav: 0, size: 0.1, life: 0.4, spread: 0.5 });
        if (m.st.mark && Math.random() < dt * 4) burst({ x: p.x, y: 1.5, z: p.z, n: 1, color: 0xff3060, vel: 0.2, grav: 0, size: 0.2, life: 0.5, spread: 0.1 });
    }
    // Embers off the hero's lantern.
    const hp = actorPos(0);
    if (hp && Math.random() < dt * 5) burst({ x: hp.x + 0.2, y: 0.8, z: hp.z + 0.1, n: 1, color: 0xffb050, vel: 0.15, vy: 0.5, grav: 0, size: 0.06, life: 1.2, spread: 0.1 });
    updateProjectiles(dt);
    updateParticles(dt);
    updateTelegraphs(run, time);
    updateNumbers(dt);
}

export function clearFx() {
    for (const p of proj) { scene.remove(p.s); p.s.material.dispose(); }
    proj.length = 0;
    P.life.fill(0); P.alpha.fill(0);
    for (const n of numbers) n.el.remove();
    numbers.length = 0;
}

export { camera };
