// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x, y, 0): a side-on view, y up, the camera a little above the action.
//
// Look: a retro-futurist sunset. A striped sun on a neon grid horizon, dark metal station parts with
// glowing edges, wireframe rock. Nothing here is a file: shaders, textures and shapes are made in code.

import * as THREE from 'three';
import { FIELD, SLING, ISLANDS, AMMO } from '../config.js';
import { hash3 } from '../rng.js';
import { predict } from '../sim/game.js';

const COL = {
    bg: 0x12062e, magenta: 0xff2bd6, cyan: 0x37e7ff, amber: 0xffb02e, violet: 0x7a3cff,
};
const AMMO_COL = { rock: 0xffb02e, iron: 0x9fb4ff, ice: 0x8ff0ff, bomb: 0xff3b5c };
const STYLE = {
    hull: { color: 0x2b3466, emissive: 0x0c1030, edge: 0x37e7ff, opacity: 1, spark: 0xbfeeff },
    glass: { color: 0x5fe8ff, emissive: 0x0a5060, edge: 0x9ffcff, opacity: 0.28, spark: 0x9ffcff },
    crate: { color: 0x5a2f6e, emissive: 0x1c0a2a, edge: 0xff2bd6, opacity: 1, spark: 0xffa0ee },
    fuel: { color: 0xff7a1a, emissive: 0xff4400, edge: 0xffe14a, opacity: 1, spark: 0xffd060 },
    robot: { color: 0x24334f, emissive: 0x0a1830, edge: 0x37e7ff, opacity: 1, spark: 0x7af4ff },
    rock: { spark: 0xc9b6ff },
};

const SKY_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const SKY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uAspect; uniform float uHorizon; uniform float uTime;
void main() {
    vec2 uv = vUv;
    float h = uHorizon;
    vec3 night = vec3(0.016, 0.008, 0.10), mid = vec3(0.16, 0.03, 0.36), glow = vec3(1.0, 0.17, 0.56);
    vec3 col;
    if (uv.y >= h) {
        float t = clamp((uv.y - h) / max(0.0001, 1.0 - h), 0.0, 1.0);
        col = mix(glow, mid, clamp(pow(clamp(t * 1.8, 0.0, 1.0), 0.55), 0.0, 1.0));
        col = mix(col, night, clamp(smoothstep(0.35, 1.0, t), 0.0, 1.0));
    } else {
        col = vec3(0.071, 0.024, 0.18);
    }
    // the sun: a disc on the horizon, striped below its middle
    vec2 sp = vec2((uv.x - 0.70) * uAspect, uv.y - (h + 0.07));
    float r = 0.21;
    float d = length(sp);
    if (d < r) {
        float k = clamp((sp.y + r) / (2.0 * r), 0.0, 1.0);
        vec3 sun = mix(vec3(1.0, 0.18, 0.58), vec3(1.0, 0.86, 0.25), k);
        float stripe = step(0.5, fract(sp.y * 26.0));
        float cut = smoothstep(0.55, 0.15, k);                  // stripes thicken towards the bottom
        float on = 1.0 - cut * (1.0 - stripe);
        col = mix(col, sun, on);
    }
    col += glow * 0.18 * exp(-abs(uv.y - h) * 18.0) * step(h, uv.y);   // haze on the horizon
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const PAN_W = 34;       // world width a narrow screen shows at once
const PAN_HOME = 17;    // where its camera rests while aiming: the sling on the left with room to pull back

const rand = (a = 0, b = 1) => a + Math.random() * (b - a);     // view-only randomness (sparks)

function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(COL.bg);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(COL.bg, 100, 300);
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);
        this.cx = FIELD.x0 + FIELD.w / 2;
        this.cy = FIELD.y0 + FIELD.h / 2;
        this.shake = 0;
        this.calm = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;     // no shake, no scrolling floor
        this.glowTex = glowTexture();
        this.objs = new Map();               // sim body id → { obj, kind, mat… }
        this.fx = [];                        // shockwave rings
        this.previews = {};
        this.geoCache = {};

        this.scene.add(new THREE.HemisphereLight(0xb89cff, 0x20104a, 1.1));
        const key = new THREE.DirectionalLight(0xffd0f0, 1.5);
        key.position.set(-14, 22, 26);
        this.scene.add(key);
        const rim = new THREE.PointLight(0x37e7ff, 90, 70, 1.6);
        rim.position.set(30, 14, 14);
        this.scene.add(rim);

        this.buildBackdrop();
        this.buildIslands();
        this.buildSling();
        this.buildParticles();

        this.tmp = new THREE.Vector3();
        this.ray = new THREE.Raycaster();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    // ------------------------------------------------------------------ static scenery
    buildBackdrop() {
        this.skyU = { uAspect: { value: 1 }, uHorizon: { value: 0.5 }, uTime: { value: 0 } };
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
            vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyU, depthWrite: false, depthTest: false,
        }));
        sky.frustumCulled = false; sky.renderOrder = -100;
        this.scene.add(sky);

        // stars: above the horizon only
        const N = 420, pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i * 3] = hash3(i, 1) * 420 - 170;
            pos[i * 3 + 1] = this.cy + 6 + Math.pow(hash3(i, 2), 1.5) * 150;
            pos[i * 3 + 2] = -150 - hash3(i, 3) * 40;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.8, fog: false }));
        this.scene.add(this.stars);

        // a ringed planet, wireframe over a dark ball
        const planet = new THREE.Group();
        planet.add(new THREE.Mesh(new THREE.SphereGeometry(10, 28, 18), new THREE.MeshStandardMaterial({ color: 0x2a1580, emissive: 0x1a0850, roughness: 0.9, fog: false })));
        planet.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(10.1, 18, 12)),
            new THREE.LineBasicMaterial({ color: COL.magenta, transparent: true, opacity: 0.35, fog: false })));
        const ring = new THREE.Mesh(new THREE.RingGeometry(14, 19, 72),
            new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.32, side: THREE.DoubleSide, fog: false }));
        ring.rotation.x = Math.PI / 2 - 0.35; ring.rotation.y = 0.25;
        planet.add(ring);
        planet.position.set(-4, this.cy + 24, -120);
        this.scene.add(planet);
        this.planet = planet;

        // the neon floor, scrolling towards the camera
        this.grid = new THREE.GridHelper(900, 150, COL.magenta, 0x8a1fb0);
        this.grid.material.transparent = true; this.grid.material.opacity = 0.7;
        this.grid.position.set(this.cx, -11, -420);
        this.scene.add(this.grid);
    }

    buildIslands() {
        for (const isl of ISLANDS) {
            const w = isl.x1 - isl.x0, cx = (isl.x0 + isl.x1) / 2;
            const g = new THREE.Group();
            const slab = new THREE.BoxGeometry(w, 0.8, 4.4);
            const top = new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: 0x1b1440, emissive: 0x0a0620, roughness: 0.7, metalness: 0.3 }));
            top.position.set(cx, isl.top - 0.4, 0);
            g.add(top);
            const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab), new THREE.LineBasicMaterial({ color: COL.cyan }));
            edge.position.copy(top.position);
            g.add(edge);
            // the rock underneath: an upside-down cone, faceted, outlined in magenta
            const cone = new THREE.ConeGeometry(1, 7.5, 7, 3);
            cone.scale(w * 0.52, 1, 2.1);
            const pos = cone.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const k = 1 + (hash3(Math.round(pos.getX(i) * 20), Math.round(pos.getY(i) * 20), Math.round(pos.getZ(i) * 20)) - 0.5) * 0.18;
                pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
            }
            cone.computeVertexNormals();
            const rock = new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ color: 0x24104a, emissive: 0x10042a, flatShading: true, roughness: 0.9 }));
            rock.rotation.x = Math.PI;
            rock.position.set(cx, isl.top - 0.8 - 3.75, 0);
            g.add(rock);
            const wire = new THREE.LineSegments(new THREE.EdgesGeometry(cone, 20), new THREE.LineBasicMaterial({ color: COL.magenta, transparent: true, opacity: 0.55 }));
            wire.rotation.copy(rock.rotation); wire.position.copy(rock.position);
            g.add(wire);
            // a row of lights along the front edge
            const n = Math.floor(w / 2);
            const lights = new THREE.Points(new THREE.BufferGeometry().setFromPoints(
                Array.from({ length: n }, (_, i) => new THREE.Vector3(isl.x0 + 1 + i * ((w - 2) / Math.max(1, n - 1)), isl.top - 0.55, 2.25))),
            new THREE.PointsMaterial({ color: COL.amber, size: 0.32, fog: false }));
            g.add(lights);
            this.scene.add(g);
        }
    }

    buildSling() {
        const g = new THREE.Group();
        const post = (dx, dz) => {
            const geo = new THREE.CylinderGeometry(0.14, 0.2, SLING.y - 3 + 0.25, 8);
            const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a2a7a, emissive: 0x1a0a40, metalness: 0.6, roughness: 0.4 }));
            m.position.set(SLING.x + dx, 3 + (SLING.y - 3 + 0.25) / 2, dz);
            const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: COL.magenta }));
            cap.position.set(SLING.x + dx, SLING.y + 0.25, dz);
            g.add(m, cap);
        };
        post(-0.4, 0.5); post(0.4, -0.5);
        this.postL = new THREE.Vector3(SLING.x - 0.4, SLING.y + 0.25, 0.5);
        this.postR = new THREE.Vector3(SLING.x + 0.4, SLING.y + 0.25, -0.5);
        // two bands as flat ribbons (a line is one pixel wide); their vertices are rewritten each frame
        this.bandGeo = new THREE.BufferGeometry();
        this.bandGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 6 * 3), 3));
        this.band = new THREE.Mesh(this.bandGeo, new THREE.MeshBasicMaterial({ color: COL.magenta, side: THREE.DoubleSide, fog: false }));
        this.band.frustumCulled = false;
        g.add(this.band);
        // the dotted flight path
        this.dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: COL.cyan, size: 0.34, transparent: true, opacity: 0.9, fog: false }));
        this.dots.frustumCulled = false;
        g.add(this.dots);
        this.scene.add(g);
    }

    buildParticles() {
        this.P = { n: 700, i: 0 };
        const n = this.P.n;
        this.P.pos = new Float32Array(n * 3).fill(-999);
        this.P.col = new Float32Array(n * 3);
        this.P.vel = new Float32Array(n * 3);
        this.P.life = new Float32Array(n);
        this.P.max = new Float32Array(n).fill(1);
        this.P.base = new Float32Array(n * 3);
        this.P.grav = new Float32Array(n);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.P.pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.P.col, 3));
        this.parts = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.42, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }));
        this.parts.frustumCulled = false;
        this.scene.add(this.parts);
    }

    // ------------------------------------------------------------------ screen mapping
    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        const cam = this.camera;
        cam.aspect = w / h;
        // Landscape fits the whole field. A narrow screen would make everything a few pixels tall, so
        // it shows a 34-unit window instead and pans: the sling, the asteroid in flight, the station.
        this.pan = cam.aspect < 1.2;
        const visW = this.pan ? PAN_W : FIELD.w;
        const halfH = Math.max(FIELD.h / 2, visW / 2 / cam.aspect) * 1.03;
        this.dist = halfH / Math.tan((cam.fov * Math.PI) / 360);
        this.halfW = halfH * cam.aspect;
        if (this.camX === undefined || !this.pan) this.camX = this.pan ? PAN_HOME : this.cx;
        this.placeCamera(0, 0);
        // Fog and the far plane follow the fitted distance: a portrait phone backs the camera off far
        // enough that fixed fog would hide the whole field.
        cam.far = this.dist * 12;
        this.scene.fog.near = this.dist * 1.6;
        this.scene.fog.far = this.dist * 8;
        cam.updateProjectionMatrix();
        this.skyU.uAspect.value = cam.aspect;
        const hz = this.tmp?.set(this.cx, cam.position.y, -1e5).project(cam) ?? { y: 0 };
        this.skyU.uHorizon.value = Math.min(0.95, Math.max(0.05, hz.y * 0.5 + 0.5));
    }

    placeCamera(sx, sy) {
        this.camera.position.set(this.camX + sx, this.cy + 2.4 + sy, this.dist);
        this.camera.lookAt(this.camX + sx, this.cy - 0.3 + sy, 0);
    }

    /** Ease the camera along the field: home while aiming, after the asteroid in flight, then on the station. */
    panCamera(G, dt) {
        if (!this.pan) return;
        let target = PAN_HOME;
        if (G.state === 'flight') {
            const xs = G.bodies.filter((b) => b.tag === 'proj' || b.tag === 'shard').map((b) => b.x);
            if (xs.length) target = Math.max(PAN_HOME, Math.max(...xs) - 4);
        } else if (G.state !== 'ready') {
            const rs = G.bodies.filter((b) => b.mat === 'robot');
            target = rs.length ? rs.reduce((a, b) => a + b.x, 0) / rs.length : PAN_HOME;
        }
        const lo = FIELD.x0 + this.halfW, hi = FIELD.x0 + FIELD.w - this.halfW;
        target = Math.min(hi, Math.max(lo, target));
        this.camX += (target - this.camX) * (1 - Math.exp(-dt * 2.2));
    }

    /** Client px → the point on the z = 0 plane under it, in sim units. */
    screenToWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
        this.camera.updateMatrixWorld();
        this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
        const o = this.ray.ray.origin, d = this.ray.ray.direction;
        if (Math.abs(d.z) < 1e-6) return null;
        const t = -o.z / d.z;
        return { x: o.x + d.x * t, y: o.y + d.y * t };
    }

    /** Sim point → client px (for floating score text). */
    worldToScreen(x, y) {
        const r = this.canvas.getBoundingClientRect();
        this.camera.updateMatrixWorld();
        const v = this.tmp.set(x, y, 0).project(this.camera);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    }

    // ------------------------------------------------------------------ pieces
    asteroidGeo(ammo, id) {
        const key = ammo + (id % 5);
        if (this.geoCache[key]) return this.geoCache[key];
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const k = 1 + (hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50) + (id % 5) * 977) - 0.5) * (ammo === 'ice' ? 0.12 : 0.34);
            pos.setXYZ(i, x * k, y * k, z * k);
        }
        geo.computeVertexNormals();
        geo.rotateX(0.5);                      // bake the tilt; the mesh only ever spins about z
        return (this.geoCache[key] = geo);
    }

    makeAsteroid(b) {
        const col = AMMO_COL[b.ammo] ?? 0xffffff;
        const g = new THREE.Group();
        const geo = this.asteroidGeo(b.ammo, b.id);
        const mat = new THREE.MeshStandardMaterial({
            color: b.ammo === 'bomb' ? 0x4a0f24 : b.ammo === 'ice' ? 0x6fb8d8 : b.ammo === 'iron' ? 0x4a5c9a : 0x6a3d1a,
            emissive: col, emissiveIntensity: b.ammo === 'bomb' ? 0.5 : 0.18, flatShading: true, roughness: 0.6, metalness: b.ammo === 'iron' ? 0.8 : 0.2,
        });
        const rock = new THREE.Mesh(geo, mat);
        const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 }));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false }));
        glow.scale.setScalar(3.4);
        g.add(rock, wire, glow);
        g.scale.setScalar(b.r);
        return { obj: g, kind: 'ast', mat };
    }

    lines(w, h, z, segs, color) {
        const pts = [];
        for (const [x1, y1, x2, y2] of segs) pts.push(new THREE.Vector3(x1 * w, y1 * h, z), new THREE.Vector3(x2 * w, y2 * h, z));
        return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    }

    makeBlock(b) {
        const st = STYLE[b.mat];
        const w = b.hx * 2, h = b.hy * 2, d = b.mat === 'glass' ? 1.0 : 1.4;
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: st.color, emissive: st.emissive, roughness: 0.45, metalness: b.mat === 'hull' ? 0.7 : 0.3,
            transparent: st.opacity < 1, opacity: st.opacity, depthWrite: st.opacity >= 1,
        });
        const box = new THREE.BoxGeometry(w, h, d);
        g.add(new THREE.Mesh(box, mat), new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: st.edge })));
        const z = d / 2 + 0.01, i = 0.4;
        if (b.mat === 'crate') g.add(this.lines(w, h, z, [[-0.5, -0.5, 0.5, 0.5], [-0.5, 0.5, 0.5, -0.5], [-i, -i, i, -i], [i, -i, i, i], [i, i, -i, i], [-i, i, -i, -i]], st.edge));
        else if (b.mat === 'fuel') g.add(this.lines(w, h, z, [[-0.5, 0.2, 0.5, 0.2], [-0.5, -0.2, 0.5, -0.2], [-0.5, 0, 0.5, 0]], st.edge));
        else if (b.mat === 'glass') g.add(this.lines(w, h, z, [[-0.35, 0.1, -0.1, 0.4], [-0.1, -0.2, 0.25, 0.4]], st.edge));
        else if (b.mat === 'hull') {
            const long = w > h;
            g.add(this.lines(w, h, z, long ? [[-0.5, 0, 0.5, 0]] : [[0, -0.5, 0, 0.5]], st.edge));
        }
        return { obj: g, kind: 'block', mat, base: new THREE.Color(st.emissive), style: st };
    }

    makeRobot(b) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x24334f, emissive: 0x0a1830, roughness: 0.4, metalness: 0.6 });
        const add = (geo, m, x, y, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
        const body = new THREE.BoxGeometry(0.84, 0.6, 0.8), head = new THREE.BoxGeometry(0.68, 0.4, 0.7);
        add(body, bodyMat, 0, -0.22);
        add(head, bodyMat, 0, 0.26);
        for (const [geo, y] of [[body, -0.22], [head, 0.26]]) {
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COL.cyan }));
            e.position.y = y; g.add(e);
        }
        const visorMat = new THREE.MeshBasicMaterial({ color: COL.magenta, fog: false });
        add(new THREE.BoxGeometry(0.5, 0.14, 0.05), visorMat, 0, 0.27, 0.36);
        add(new THREE.BoxGeometry(0.3, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: COL.cyan }), 0, -0.2, 0.41);   // chest light
        const ant = add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5), bodyMat, 0.18, 0.56);
        ant.rotation.z = -0.25;
        add(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: COL.amber }), 0.23, 0.67);
        return { obj: g, kind: 'robot', mat: bodyMat, visor: visorMat, base: new THREE.Color(0x0a1830) };
    }

    // ------------------------------------------------------------------ effects
    burst(x, y, n, color, { speed = 6, life = 0.7, grav = 10, spread = Math.PI * 2, dir = 0, size = 1 } = {}) {
        const P = this.P, c = new THREE.Color(color);
        for (let k = 0; k < n; k++) {
            const i = P.i = (P.i + 1) % P.n;
            const a = dir + (Math.random() - 0.5) * spread, s = speed * rand(0.3, 1);
            P.pos[i * 3] = x + rand(-0.2, 0.2); P.pos[i * 3 + 1] = y + rand(-0.2, 0.2); P.pos[i * 3 + 2] = rand(-0.4, 0.4);
            P.vel[i * 3] = Math.cos(a) * s; P.vel[i * 3 + 1] = Math.sin(a) * s; P.vel[i * 3 + 2] = rand(-1, 1);
            P.life[i] = P.max[i] = life * rand(0.6, 1.1) * size;
            P.base[i * 3] = c.r; P.base[i * 3 + 1] = c.g; P.base[i * 3 + 2] = c.b;
            P.grav[i] = grav;
        }
    }

    ring(x, y, r, color) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56),
            new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        m.position.set(x, y, 0.5);
        this.scene.add(m);
        this.fx.push({ m, r, t: 0, life: 0.55 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'launch':
                    this.shake = Math.max(this.shake, 0.12);
                    this.burst(e.x, e.y, 18, COL.magenta, { speed: 7, life: 0.5, grav: 0, spread: 1.2, dir: G.aim.angle + Math.PI });
                    break;
                case 'hit': {
                    const st = STYLE[e.mat] || STYLE.rock;
                    this.burst(e.x, e.y, Math.min(14, 3 + Math.floor(e.power / 3)), st.spark, { speed: 5 + Math.min(8, e.power / 4), life: 0.45, grav: 14 });
                    if (e.power > 22) this.shake = Math.max(this.shake, Math.min(0.35, e.power / 120));
                    break;
                }
                case 'break': {
                    const st = STYLE[e.mat] || STYLE.hull;
                    this.burst(e.x, e.y, Math.min(34, 8 + Math.round(e.w * e.h * 3)), st.edge, { speed: 8, life: 0.9, grav: 16 });
                    this.burst(e.x, e.y, 8, 0xffffff, { speed: 4, life: 0.4, grav: 6 });
                    this.shake = Math.max(this.shake, 0.18);
                    break;
                }
                case 'robot':
                    this.burst(e.x, e.y, 36, COL.cyan, { speed: 9, life: 1.0, grav: 8 });
                    this.burst(e.x, e.y, 22, COL.magenta, { speed: 6, life: 0.8, grav: 8 });
                    this.burst(e.x, e.y, 10, 0xffffff, { speed: 3, life: 0.5, grav: 0 });
                    this.ring(e.x, e.y, 2.2, COL.cyan);
                    this.shake = Math.max(this.shake, 0.22);
                    break;
                case 'boom':
                    this.burst(e.x, e.y, 60, COL.amber, { speed: 12, life: 0.9, grav: 6 });
                    this.burst(e.x, e.y, 30, 0xffffff, { speed: 7, life: 0.5, grav: 0 });
                    this.burst(e.x, e.y, 24, COL.magenta, { speed: 10, life: 0.8, grav: 4 });
                    this.ring(e.x, e.y, e.r * 1.25, COL.amber);
                    this.shake = Math.max(this.shake, 0.6);
                    break;
                case 'split': case 'boost': case 'slam':
                    this.burst(e.x, e.y, 20, e.type === 'split' ? 0x8ff0ff : COL.amber, { speed: 7, life: 0.5, grav: 0 });
                    this.ring(e.x, e.y, 1.6, e.type === 'split' ? 0x8ff0ff : COL.amber);
                    break;
                case 'over':
                    if (e.won) for (let k = 0; k < 6; k++) {
                        const fx = rand(12, 40), fy = rand(10, 20);
                        this.burst(fx, fy, 40, [COL.magenta, COL.cyan, COL.amber][k % 3], { speed: 8, life: 1.4, grav: 5 });
                    }
                    break;
                default:
            }
        }
    }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, time) {
        this.resize();
        this.skyU.uTime.value = time;
        this.grid.position.z = -420 + (this.calm ? 0 : (time * 5) % 6);       // cells are 6 units: the scroll loops cleanly
        this.stars.material.opacity = 0.75 + Math.sin(time * 0.7) * 0.1;
        this.planet.rotation.y = time * 0.03;

        this.panCamera(G, dt);
        this.syncBodies(G, dt, time);
        this.syncSling(G, time);
        this.updateParticles(dt);
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.t += dt;
            const k = f.t / f.life;
            if (k >= 1) { this.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); this.fx.splice(i, 1); continue; }
            f.m.scale.setScalar(Math.max(0.01, f.r * (1 - (1 - k) ** 2)));
            f.m.material.opacity = (1 - k) * 0.9;
        }
        this.shake = Math.max(0, this.shake - dt * 1.6);
        const sh = this.calm ? 0 : this.shake;
        this.placeCamera(sh ? rand(-1, 1) * sh : 0, sh ? rand(-1, 1) * sh : 0);
        this.renderer.render(this.scene, this.camera);
    }

    syncBodies(G, dt, time) {
        const seen = new Set();
        for (const b of G.bodies) {
            if (b.invMass === 0) continue;
            seen.add(b.id);
            let o = this.objs.get(b.id);
            if (!o) {
                o = b.kind === 'circle' ? this.makeAsteroid(b) : b.mat === 'robot' ? this.makeRobot(b) : this.makeBlock(b);
                this.scene.add(o.obj);
                this.objs.set(b.id, o);
            }
            o.obj.position.set(b.x, b.y, 0);
            o.obj.rotation.z = b.a;
            if (o.kind === 'ast') {
                if (b.tag === 'proj' || b.tag === 'shard') {
                    const sp = Math.hypot(b.vx, b.vy);
                    if (sp > 2) this.burst(b.x, b.y, 1, AMMO_COL[b.ammo], { speed: 0.8, life: 0.45, grav: 0, size: 1 });
                }
                if (b.ammo === 'bomb') o.mat.emissiveIntensity = 0.45 + (b.touched ? 0.5 + Math.sin(time * 9) * 0.12 : Math.sin(time * 5) * 0.08);
            } else {
                const hurt = 1 - Math.max(0, b.hp) / b.maxHp;
                if (o.kind === 'robot') {
                    o.mat.emissive.copy(o.base).lerp(new THREE.Color(0x802020), hurt);
                    o.visor.color.set(hurt > 0.5 ? 0xff3030 : COL.magenta).multiplyScalar(0.8 + 0.2 * Math.sin(time * 3 + b.id));
                } else {
                    o.mat.emissive.copy(o.base).lerp(new THREE.Color(0xff3a1a), hurt * 0.7);
                    if (b.mat === 'fuel') o.mat.emissiveIntensity = 0.8 + Math.sin(time * 2.5 + b.id) * 0.15;
                }
            }
        }
        for (const [id, o] of this.objs) {
            if (seen.has(id)) continue;
            this.scene.remove(o.obj);
            o.obj.traverse((n) => { if (n.material && !n.material.map) n.material.dispose(); });
            this.objs.delete(id);
        }
    }

    preview(type) {
        if (!this.previews[type]) {
            const p = this.makeAsteroid({ ammo: type, id: 0, r: AMMO[type].r });
            p.obj.visible = false;
            this.scene.add(p.obj);
            this.previews[type] = p;
        }
        return this.previews[type];
    }

    syncSling(G, time) {
        for (const p of Object.values(this.previews)) p.obj.visible = false;
        const ready = G.state === 'ready' && G.ammo.length > 0;
        const a = G.aim;
        let pull = { x: SLING.x, y: SLING.y };
        if (ready) {
            const len = a.power * SLING.maxPull * 0.9;
            pull = { x: SLING.x - Math.cos(a.angle) * len, y: Math.max(3.9, SLING.y - Math.sin(a.angle) * len) };
            const p = this.preview(G.ammo[0]);
            p.obj.visible = true;
            p.obj.position.set(pull.x, pull.y, 0);
            p.obj.rotation.z = time * 0.6;
        }
        // the bands: post → pull point → post, as two thin ribbons
        const A = this.postL, B = this.postR, t = 0.07;
        const pos = this.bandGeo.attributes.position;
        const quad = (o, p, q) => {
            const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * t, ny = dx / l * t;
            const v = [[p.x + nx, p.y + ny, p.z], [p.x - nx, p.y - ny, p.z], [q.x + nx, q.y + ny, q.z], [q.x + nx, q.y + ny, q.z], [p.x - nx, p.y - ny, p.z], [q.x - nx, q.y - ny, q.z]];
            v.forEach((c, i) => pos.setXYZ(o + i, c[0], c[1], c[2]));
        };
        const mid = { x: pull.x, y: pull.y, z: 0 };
        quad(0, A, mid); quad(6, mid, B);
        pos.needsUpdate = true;

        // dotted path: only the first stretch, so it helps without solving the shot
        if (ready && a.power >= SLING.minPower) {
            const pts = predict(G, a.angle, a.power, 1.5, 0.07);
            this.dots.geometry.setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)));
            this.dots.visible = true;
        } else this.dots.visible = false;
    }

    updateParticles(dt) {
        const P = this.P;
        for (let i = 0; i < P.n; i++) {
            if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -999; P.col[i * 3] = P.col[i * 3 + 1] = P.col[i * 3 + 2] = 0; continue; }
            P.life[i] -= dt;
            P.vel[i * 3 + 1] -= P.grav[i] * dt;
            P.pos[i * 3] += P.vel[i * 3] * dt;
            P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
            P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
            const f = Math.max(0, P.life[i] / P.max[i]);
            P.col[i * 3] = P.base[i * 3] * f; P.col[i * 3 + 1] = P.base[i * 3 + 1] * f; P.col[i * 3 + 2] = P.base[i * 3 + 2] * f;
        }
        this.parts.geometry.attributes.position.needsUpdate = true;
        this.parts.geometry.attributes.color.needsUpdate = true;
    }
}
