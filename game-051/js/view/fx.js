/**
 * fx.js — pooled particles (one draw call), projectiles, slashes, rings,
 * beams, pillars, shields and ambient weather. Every effect lives in the
 * scene passed to createFx() and cleans itself up.
 */

import * as THREE from 'three';
import { ease } from './anim.js';

let spriteTex = null, noteTex = null, starTex = null;
function makeSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}
/** Shapes drawn with paths (no font glyphs, so they look the same on every device). */
function glyphTex(kind, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    const k = size / 64;
    if (kind === 'note') {
        g.beginPath(); g.ellipse(22 * k, 46 * k, 10 * k, 7.5 * k, -0.4, 0, Math.PI * 2); g.fill();
        g.fillRect(29 * k, 12 * k, 5 * k, 34 * k);
        g.beginPath(); g.moveTo(29 * k, 12 * k); g.quadraticCurveTo(46 * k, 14 * k, 50 * k, 30 * k); g.quadraticCurveTo(42 * k, 22 * k, 34 * k, 22 * k); g.closePath(); g.fill();
    } else {
        g.beginPath();
        for (let i = 0; i < 8; i++) { const r = (i % 2 ? 9 : 28) * k, a = (i / 8) * Math.PI * 2 - Math.PI / 2; g.lineTo(32 * k + Math.cos(a) * r, 32 * k + Math.sin(a) * r); }
        g.closePath(); g.fill();
    }
    return new THREE.CanvasTexture(c);
}

const MAX = 2400;

export function createFx(scene) {
    spriteTex ||= makeSprite();
    noteTex ||= glyphTex('note');
    starTex ||= glyphTex('star');
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), siz = new Float32Array(MAX), alp = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: spriteTex }, uScale: { value: 300 } },
        vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
            void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);

    const P = []; // live particles
    const free = [];
    for (let i = MAX - 1; i >= 0; i--) free.push(i);
    const effects = [];
    const emitters = [];
    const tmpC = new THREE.Color();

    function spawn(p) {
        if (!free.length) return;
        const i = free.pop();
        p.i = i;
        P.push(p);
    }

    /**
     * emit({ pos, count, color, color2, speed, spread, life, size, gravity, drag, shape, radius, up, dir })
     */
    function emit(o) {
        const n = o.count ?? 12;
        const c1 = new THREE.Color(o.color || '#ffffff'), c2 = new THREE.Color(o.color2 || o.color || '#ffffff');
        for (let k = 0; k < n; k++) {
            const v = new THREE.Vector3();
            let p0 = o.pos.clone();
            if (o.shape === 'ring') {
                const a = Math.random() * Math.PI * 2;
                p0.x += Math.cos(a) * (o.radius || 0.5); p0.z += Math.sin(a) * (o.radius || 0.5);
                v.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar((o.speed ?? 1) * (0.5 + Math.random() * 0.5));
                v.y = (o.up ?? 0.5) * Math.random();
            } else if (o.shape === 'column') {
                const a = Math.random() * Math.PI * 2, r = Math.random() * (o.radius || 0.4);
                p0.x += Math.cos(a) * r; p0.z += Math.sin(a) * r; p0.y += Math.random() * (o.height || 0.2);
                v.set(0, (o.speed ?? 1) * (0.6 + Math.random() * 0.6), 0);
            } else if (o.shape === 'box') {
                p0.x += (Math.random() - 0.5) * (o.w || 1); p0.y += Math.random() * (o.h || 1); p0.z += (Math.random() - 0.5) * (o.d || 1);
                v.set((Math.random() - 0.5) * 0.2, (o.speed ?? 0.3) * (Math.random() - 0.3), (Math.random() - 0.5) * 0.2);
            } else {
                v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar((o.speed ?? 2) * (0.3 + Math.random() * 0.7));
                if (o.up) v.y += o.up;
                if (o.dir) v.addScaledVector(o.dir, o.dirSpeed || 1);
            }
            const life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
            spawn({ p: p0, v, life, age: 0, size: (o.size ?? 0.18) * (0.6 + Math.random() * 0.7), c: c1.clone().lerp(c2, Math.random()), g: o.gravity ?? 0, drag: o.drag ?? 1.5, fade: o.fade ?? 1 });
        }
    }

    function addEffect(obj, dur, fn, done) {
        scene.add(obj);
        return new Promise((res) => effects.push({ obj, dur, t: 0, fn, res: () => { if (done) done(); res(); } }));
    }

    const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

    /** A glowing orb flying from a to b (arc height h). Resolves on impact. */
    function projectile(a, b, o = {}) {
        const color = o.color || '#ffffff';
        const grp = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(o.size || 0.12, 12, 10), glowMat('#ffffff'));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.glyph === 'note' ? noteTex : spriteTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar((o.size || 0.12) * (o.glyph === 'note' ? 4 : 6));
        if (o.glyph !== 'note') grp.add(core); else core.visible = false;
        grp.add(halo);
        if (o.arrow) {
            core.geometry = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6);
            core.geometry.rotateX(Math.PI / 2);
            halo.scale.setScalar(0.3);
        }
        const dur = o.dur ?? Math.max(0.18, a.distanceTo(b) / (o.speed || 12));
        const h = o.arc ?? 0.6;
        const prev = new THREE.Vector3().copy(a);
        return addEffect(grp, dur, (k) => {
            grp.position.lerpVectors(a, b, k);
            grp.position.y += Math.sin(k * Math.PI) * h;
            if (o.arrow) grp.lookAt(prev.clone().lerp(grp.position, 2));
            prev.copy(grp.position);
            if (Math.random() < 0.8) emit({ pos: grp.position, count: 1, color, speed: 0.3, life: 0.35, size: (o.size || 0.12) * 1.6 });
        }, () => scene.remove(grp));
    }

    /** A crescent slash at pos facing the camera-ish direction. */
    function slash(pos, color = '#ffffff', o = {}) {
        const geo = new THREE.RingGeometry(0.35 * (o.scale || 1), 0.55 * (o.scale || 1), 24, 1, -0.2, Math.PI * 0.9);
        const m = new THREE.Mesh(geo, glowMat(color, 0.95));
        m.position.copy(pos);
        m.rotation.set(o.rx ?? -0.3, o.ry ?? 0, o.rz ?? (Math.random() - 0.5) * 1.5);
        const s0 = 0.6;
        return addEffect(m, 0.26, (k) => {
            m.scale.setScalar(s0 + k * 0.7);
            m.material.opacity = 0.95 * (1 - k);
            m.rotation.z += 0.12;
        }, () => { scene.remove(m); geo.dispose(); m.material.dispose(); });
    }

    function ring(pos, color = '#ffffff', o = {}) {
        const geo = new THREE.RingGeometry(0.8, 1, 48);
        const m = new THREE.Mesh(geo, glowMat(color, 0.9));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(pos); m.position.y += 0.05;
        const r0 = o.from ?? 0.2, r1 = o.to ?? 1.6;
        return addEffect(m, o.dur ?? 0.5, (k) => {
            m.scale.setScalar(r0 + (r1 - r0) * ease.out(k));
            m.material.opacity = 0.9 * (1 - k);
        }, () => { scene.remove(m); geo.dispose(); m.material.dispose(); });
    }

    function beam(a, b, color = '#ffffff', o = {}) {
        const len = a.distanceTo(b);
        const geo = new THREE.CylinderGeometry(1, 1, len, 12, 1, true);
        geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, glowMat(color, 0.9));
        const core = new THREE.Mesh(geo, glowMat('#ffffff', 0.9));
        m.add(core);
        m.position.copy(a);
        m.lookAt(b);
        const w = o.width || 0.12;
        return addEffect(m, o.dur ?? 0.45, (k) => {
            const s = w * Math.sin(Math.min(1, k * 1.4) * Math.PI);
            m.scale.set(s, s, 1);
            core.scale.set(0.4, 0.4, 1);
            if (Math.random() < 0.6) emit({ pos: a.clone().lerp(b, Math.random()), count: 1, color, speed: 0.6, life: 0.4, size: 0.15 });
        }, () => { scene.remove(m); geo.dispose(); });
    }

    function pillar(pos, color = '#ffffff', o = {}) {
        const h = o.height || 4;
        const geo = new THREE.CylinderGeometry(o.radius || 0.6, (o.radius || 0.6) * 1.2, h, 24, 1, true);
        geo.translate(0, h / 2, 0);
        const cnv = document.createElement('canvas'); cnv.width = 4; cnv.height = 64;
        const g = cnv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
        g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
        const tex = new THREE.CanvasTexture(cnv);
        const mat = glowMat(color, 0.9); mat.map = tex; mat.alphaMap = tex;
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        const dur = o.dur ?? 0.9;
        return addEffect(m, dur, (k) => {
            const s = Math.sin(Math.min(1, k * 1.2) * Math.PI);
            m.scale.set(0.3 + s, 1, 0.3 + s);
            m.material.opacity = 0.9 * s;
            m.rotation.y += 0.05;
            if (Math.random() < 0.7) emit({ pos, count: 2, color, shape: 'column', radius: o.radius || 0.6, speed: 3, life: 0.6, size: 0.18 });
        }, () => { scene.remove(m); geo.dispose(); tex.dispose(); mat.dispose(); });
    }

    function shield(pos, color = '#9fe7ff', o = {}) {
        const geo = new THREE.SphereGeometry(o.radius || 0.75, 24, 18);
        const mat = new THREE.ShaderMaterial({
            uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: 1 } },
            vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
            fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uC, (0.08 + f * 0.9) * uA); }',
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        return addEffect(m, o.dur ?? 0.8, (k) => {
            m.scale.setScalar(0.6 + ease.back(Math.min(1, k * 2.5)) * 0.4);
            mat.uniforms.uA.value = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        }, () => { scene.remove(m); geo.dispose(); mat.dispose(); });
    }

    function burst(pos, color, n = 24, o = {}) { emit({ pos, count: n, color, color2: o.color2 || '#ffffff', speed: o.speed ?? 3, life: o.life ?? 0.55, size: o.size ?? 0.2, gravity: o.gravity ?? -2, up: o.up ?? 0.5 }); }
    function sparkle(pos, color, n = 10) { emit({ pos, count: n, color, color2: '#ffffff', speed: 1.2, life: 0.9, size: 0.14, up: 1, gravity: 0.5 }); }
    function rise(pos, color, n = 14, o = {}) { emit({ pos, count: n, color, shape: 'column', radius: o.radius ?? 0.45, height: 0.6, speed: o.speed ?? 1.5, life: 0.9, size: 0.16 }); }
    function notes(pos, color, n = 4) { for (let i = 0; i < n; i++) setTimeout(() => projectile(pos.clone(), pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6)), { color, glyph: 'note', size: 0.12, arc: 0.2, speed: 3 }), i * 80); }

    function vine(at, color = '#4fd36a') {
        const pts = [];
        for (let i = 0; i < 6; i++) pts.push(new THREE.Vector3(Math.sin(i * 1.4) * 0.15, i * 0.22, Math.cos(i * 1.4) * 0.15));
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 24, 0.05, 6);
        const grp = new THREE.Group();
        for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color }));
            m.rotation.y = k * 2.1; m.position.set(Math.cos(k * 2.1) * 0.3, 0, Math.sin(k * 2.1) * 0.3);
            grp.add(m);
        }
        grp.position.copy(at); grp.position.y = 0;
        return addEffect(grp, 0.7, (k) => {
            const s = k < 0.4 ? ease.back(k / 0.4) : 1 - (k - 0.4) / 0.6;
            grp.scale.set(1, Math.max(0.001, s), 1);
        }, () => { scene.remove(grp); geo.dispose(); });
    }

    async function meteor(target, color = '#ff7a3a', o = {}) {
        const from = target.clone().add(new THREE.Vector3(-2.5, 7, -1.5));
        await projectile(from, target, { color, size: o.size || 0.32, arc: 0, speed: 16 });
        burst(target, color, 40, { speed: 5, size: 0.3 });
        ring(target, color, { to: 2.4 });
    }

    function ambient(kind, area = { w: 16, h: 6, d: 12, y: 0 }) {
        const em = { kind, area, acc: 0 };
        emitters.push(em);
        return () => emitters.splice(emitters.indexOf(em), 1);
    }
    const AMB = {
        pollen: { rate: 10, color: '#fff6a0', size: 0.08, speed: 0.15, life: 5 },
        embers: { rate: 16, color: '#ff8a3a', color2: '#ffd04a', size: 0.09, speed: 0.6, life: 3, up: true },
        bubbles: { rate: 8, color: '#bfefff', size: 0.1, speed: 0.4, life: 4, up: true },
        motes: { rate: 10, color: '#fff0b0', size: 0.09, speed: 0.2, life: 4 },
        wisps: { rate: 6, color: '#a07aff', color2: '#7af0ff', size: 0.14, speed: 0.2, life: 5 },
        snow: { rate: 22, color: '#ffffff', size: 0.08, speed: -0.6, life: 6, fall: true },
        sparkles: { rate: 12, color: '#c8a0ff', color2: '#7af0ff', size: 0.09, speed: 0.15, life: 3 },
        stars: { rate: 4, color: '#ffffff', size: 0.06, speed: 0.05, life: 6 },
    };

    function update(dt) {
        for (const e of [...effects]) {
            e.t += dt;
            const k = Math.min(1, e.t / e.dur);
            e.fn(k, dt);
            if (k >= 1) { effects.splice(effects.indexOf(e), 1); e.res(); }
        }
        for (const em of emitters) {
            const A = AMB[em.kind];
            if (!A) continue;
            em.acc += A.rate * dt;
            while (em.acc >= 1) {
                em.acc--;
                const a = em.area;
                const p = new THREE.Vector3((Math.random() - 0.5) * a.w, (a.y || 0) + (A.fall ? a.h : Math.random() * a.h), (Math.random() - 0.5) * a.d + (a.z || 0));
                spawn({ p, v: new THREE.Vector3((Math.random() - 0.5) * 0.2, A.fall ? A.speed : A.up ? Math.abs(A.speed) : (Math.random() - 0.5) * A.speed, (Math.random() - 0.5) * 0.2), life: A.life, age: 0, size: A.size * (0.6 + Math.random() * 0.8), c: new THREE.Color(A.color).lerp(new THREE.Color(A.color2 || A.color), Math.random()), g: 0, drag: 0, fade: 1, wobble: true });
            }
        }
        for (let n = P.length - 1; n >= 0; n--) {
            const p = P[n];
            p.age += dt;
            if (p.age >= p.life) {
                alp[p.i] = 0; siz[p.i] = 0;
                free.push(p.i);
                P[n] = P[P.length - 1]; P.pop();
                continue;
            }
            p.v.y += p.g * dt;
            if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
            if (p.wobble) p.v.x += Math.sin(p.age * 2 + p.i) * 0.002;
            p.p.addScaledVector(p.v, dt);
            const i = p.i;
            pos[i * 3] = p.p.x; pos[i * 3 + 1] = p.p.y; pos[i * 3 + 2] = p.p.z;
            col[i * 3] = p.c.r; col[i * 3 + 1] = p.c.g; col[i * 3 + 2] = p.c.b;
            const lifeK = p.age / p.life;
            alp[i] = p.wobble ? Math.sin(lifeK * Math.PI) : (1 - lifeK * p.fade);
            siz[i] = p.size;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
    }

    function setScale(h) { mat.uniforms.uScale.value = h * 0.55; }

    function clear() {
        for (const p of P) { alp[p.i] = 0; free.push(p.i); }
        P.length = 0;
        for (const e of effects) { scene.remove(e.obj); e.res(); }
        effects.length = 0;
        emitters.length = 0;
    }

    return { emit, projectile, slash, ring, beam, pillar, shield, burst, sparkle, rise, notes, vine, meteor, ambient, update, setScale, clear, points };
}
