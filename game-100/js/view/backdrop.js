// The party behind the board: a 70s sunburst wall and a chasing dance floor drawn by one sky
// shader, a giant mirrorball with a thousand mirror tiles and twinkling glints, sweeping
// spotlight beams, and coloured lights that glint off the chrome tokens. It reads only simple
// numbers from the game (the beat, Fever, the room), never the sim itself.

import * as THREE from 'three';
import { ROOMS } from '../config.js';

const SkyVS = /* glsl */`
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SkyFS = /* glsl */`
    varying vec3 vDir;
    uniform float uTime, uBeat, uFever, uDim, uHorizon;
    uniform vec3 uPal[4];
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 pal(float i) {
        float k = mod(floor(i), 4.0);
        return k < 0.5 ? uPal[0] : (k < 1.5 ? uPal[1] : (k < 2.5 ? uPal[2] : uPal[3]));
    }
    // the palette read as a loop that flows: no tile ever jumps from one colour to the next
    vec3 flow(float i) { return mix(pal(i), pal(i + 1.0), smoothstep(0.0, 1.0, fract(i))); }
    void main() {
        vec3 d = normalize(vDir);
        float t = uTime;
        float spd = 1.0 + uFever * 1.8;
        vec3 col = vec3(0.0);

        // ---- the wall: concentric colour bands and rays, a rising sun
        vec2 p = d.xy / max(-d.z, 0.08) * 5.4;
        p.y -= 0.5;
        float r = length(p);
        float a = atan(p.y, p.x);
        float rays = smoothstep(0.3, 0.7, 0.5 + 0.5 * sin(a * 11.0 + t * 0.18 * spd));
        float idx = r * 1.25 - t * 0.28 * spd;
        vec3 band = pal(idx);
        float edge = abs(fract(idx) - 0.5) * 2.0;
        col = band * (0.3 + 0.38 * rays);
        col *= 0.85 + 0.15 * smoothstep(0.7, 1.0, edge);                       // a hard dark line between bands
        col = mix(col, pal(0.0) * 1.35, smoothstep(0.95, 0.86, r));            // the sun disc
        col *= 0.38 + 0.62 * smoothstep(4.6, 0.4, r);

        // ---- light spots from the mirrorball, turning slowly
        float ang = t * 0.07 * spd, cs = cos(ang), sn = sin(ang);
        vec2 q = mat2(cs, -sn, sn, cs) * p * 0.95;
        vec2 cell = floor(q), f = fract(q) - 0.5;
        float h = hash(cell), h2 = hash(cell + 13.7);
        float dd = length(f - (vec2(h, h2) - 0.5) * 0.5);
        float on = step(0.55, hash(cell + 3.1)) * (0.45 + 0.55 * sin(t * (0.8 + h * 1.6) + h * 20.0));
        float spot = smoothstep(0.17, 0.06, dd) * max(on, 0.0);
        vec3 dc = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
        col += dc * spot * 0.75 * smoothstep(0.6, 2.2, r);

        // ---- the dance floor: lit tiles chasing each other away from you
        float fl = smoothstep(uHorizon + 0.05, uHorizon - 0.12, d.y);
        if (fl > 0.001) {
            vec2 f2 = d.xz / max(-d.y, 0.03) * 1.1;
            vec2 g = floor(f2);
            vec2 fr = fract(f2);
            float gap = smoothstep(0.0, 0.07, min(min(fr.x, fr.y), min(1.0 - fr.x, 1.0 - fr.y)));
            float chase = 0.5 + 0.5 * sin(t * 2.6 * spd - g.y * 0.9 + g.x * 0.5);
            vec3 tile = flow(g.x + g.y * 2.0 + t * 0.6 * spd) * (0.12 + 0.52 * chase * chase);
            tile *= 1.0 + uBeat * 0.3 * step(0.5, hash(g));
            tile *= gap * smoothstep(34.0, 3.0, length(f2));
            col = mix(col, tile, fl);
        }
        // a glowing horizon where wall meets floor
        col += pal(1.0) * 0.5 * exp(-pow((d.y - uHorizon) * 18.0, 2.0)) * (0.6 + uBeat * 0.4);

        col *= uDim * (1.0 + uBeat * (0.12 + uFever * 0.1));
        gl_FragColor = vec4(col, 1.0);
    }`;

const BeamVS = /* glsl */`
    varying vec3 vN; varying vec3 vV; varying float vT;
    void main() {
        vT = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
    }`;
const BeamFS = /* glsl */`
    uniform vec3 uColor; uniform float uAlpha;
    varying vec3 vN; varying vec3 vV; varying float vT;
    void main() {
        float f = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.6);
        float along = pow(clamp(vT, 0.0, 1.0), 1.4);
        gl_FragColor = vec4(uColor * 1.6, f * along * uAlpha);
    }`;

const GlintVS = /* glsl */`
    attribute float aPhase;
    uniform float uTime, uScale, uAmp;
    varying float vA;
    void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normalize(position));
        float facing = dot(n, normalize(cameraPosition - wp.xyz));
        float tw = pow(max(sin(uTime * 2.2 + aPhase * 40.0), 0.0), 8.0);
        vA = tw * smoothstep(0.1, 0.5, facing) * uAmp;
        vec4 mv = viewMatrix * wp;
        gl_PointSize = max(1.0, (0.5 + 1.3 * tw) * uScale / max(-mv.z, 0.1));
        gl_Position = projectionMatrix * mv;
    }`;
const GlintFS = /* glsl */`
    varying float vA;
    void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float s = exp(-abs(p.x) * 11.0) * exp(-abs(p.y) * 2.0) + exp(-abs(p.y) * 11.0) * exp(-abs(p.x) * 2.0);
        float a = clamp(s + smoothstep(0.4, 0.0, length(p)), 0.0, 1.0) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(2.4, 2.3, 2.6) * a, a);
    }`;

const col3 = (hex) => new THREE.Color(hex);

export class Backdrop {
    constructor(scene, camera, envMap) {
        this.scene = scene;
        this.camera = camera;
        this.room = 0;
        this.palFrom = ROOMS[0].sky.map(col3);
        this.palTo = this.palFrom.map((c) => c.clone());
        this.palMix = 1;
        this.fever = 0;
        this.dim = 0;
        this.uniforms = {
            uTime: { value: 0 }, uBeat: { value: 0 }, uFever: { value: 0 }, uDim: { value: 0 }, uHorizon: { value: -0.1 },
            uPal: { value: this.palFrom.map((c) => c.clone()) },
        };
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
            vertexShader: SkyVS, fragmentShader: SkyFS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
        }));
        this.sky.renderOrder = -10;
        this.sky.frustumCulled = false;
        scene.add(this.sky);

        // ---- the mirrorball
        this.ballRoot = new THREE.Group();
        this.ball = new THREE.Group();
        this.ballRoot.add(this.ball);
        const rows = 30, R = 1;
        const tiles = [];
        for (let i = 1; i < rows; i++) {
            const th = (i / rows) * Math.PI;
            const n = Math.max(5, Math.round(2 * Math.PI * Math.sin(th) * rows / Math.PI));
            for (let j = 0; j < n; j++) tiles.push([th, ((j + (i % 2) * 0.5) / n) * Math.PI * 2, n]);
        }
        const tileGeo = new THREE.BoxGeometry(1, 1, 0.35);
        this.tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, envMap, envMapIntensity: 1.5 }), tiles.length);
        const o = new THREE.Object3D(), c = new THREE.Color();
        const size = (2 * Math.PI * R) / rows * 0.92;
        const up = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3();
        tiles.forEach(([th, ph], k) => {
            nrm.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
            o.position.copy(nrm).multiplyScalar(R);
            o.quaternion.setFromUnitVectors(up, nrm);
            o.scale.set(size, size, size * 0.4);
            o.updateMatrix();
            this.tiles.setMatrixAt(k, o.matrix);
            c.setHSL(0.55 + Math.random() * 0.15, 0.25 * Math.random(), 0.7 + Math.random() * 0.3);
            this.tiles.setColorAt(k, c);
        });
        this.ball.add(this.tiles);
        this.ball.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 24, 16), new THREE.MeshBasicMaterial({ color: 0x120a22 })));
        // twinkling glints on the facets
        const gp = new Float32Array(90 * 3), gph = new Float32Array(90);
        for (let i = 0; i < 90; i++) {
            const th = Math.acos(1 - 2 * Math.random()), ph = Math.random() * Math.PI * 2;
            gp[i * 3] = Math.sin(th) * Math.cos(ph) * R * 1.03; gp[i * 3 + 1] = Math.cos(th) * R * 1.03; gp[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * R * 1.03;
            gph[i] = Math.random();
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
        gg.setAttribute('aPhase', new THREE.BufferAttribute(gph, 1));
        this.glintU = { uTime: { value: 0 }, uScale: { value: 500 }, uAmp: { value: 1 } };
        this.glints = new THREE.Points(gg, new THREE.ShaderMaterial({ vertexShader: GlintVS, fragmentShader: GlintFS, uniforms: this.glintU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.glints.frustumCulled = false;
        this.ball.add(this.glints);
        // the cord
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 40, 4).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0x6a5a88 }));
        this.ballRoot.add(cord);
        scene.add(this.ballRoot);

        // ---- spotlight beams
        this.beams = [];
        const beamGeo = new THREE.CylinderGeometry(0.06, 1.0, 1, 24, 1, true).translate(0, -0.5, 0);
        for (let i = 0; i < 6; i++) {
            const mat = new THREE.ShaderMaterial({
                vertexShader: BeamVS, fragmentShader: BeamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
                uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.3 } },
            });
            const mesh = new THREE.Mesh(beamGeo, mat);
            const pivot = new THREE.Group();
            pivot.add(mesh);
            mesh.renderOrder = -5;
            scene.add(pivot);
            this.beams.push({ pivot, mesh, mat, phase: i * 1.1, side: i % 2 ? 1 : -1, row: Math.floor(i / 2) });
        }

        // ---- lights
        this.hemi = new THREE.HemisphereLight(0xb8a8ff, 0x1c0a30, 0.5);
        this.key = new THREE.DirectionalLight(0xffffff, 1.1);
        this.key.position.set(3, 6, 10);
        scene.add(this.hemi, this.key);
        this.lamps = [0xff2fa8, 0x2de2ff, 0xffd21f].map((hex) => {
            const l = new THREE.PointLight(hex, 70, 40, 2);
            scene.add(l);
            return l;
        });
        this.ballPos = new THREE.Vector3();
        this.ballY = 0.58;
        this.ballSize = 0.2;
    }

    /** Move to the next room's palette (a fade over a second or two). */
    setRoom(i) {
        const room = ROOMS[i % ROOMS.length];
        this.palFrom = this.uniforms.uPal.value.map((c) => c.clone());
        this.palTo = room.sky.map(col3);
        this.palMix = 0;
        this.room = i % ROOMS.length;
    }

    resize(stage, pr = 1) {
        this.glintU.uScale.value = (stage.h * pr) / (2 * Math.tan((stage.fov * Math.PI) / 360)) * 0.06;
    }

    update(dt, time, { beat = 0, fever = 0, dim = 1, dist = 22, camera, ballTop = true, calm = false }) {
        const u = this.uniforms;
        u.uTime.value = time;
        beat *= calm ? 0.2 : 1;                       // calm: the room breathes, it doesn't flash
        u.uBeat.value = beat;
        this.glintU.uAmp.value = calm ? 0 : 1;
        this.tiles.material.roughness = calm ? 0.4 : 0.1;
        this.fever += (fever - this.fever) * Math.min(1, dt * 3);
        u.uFever.value = this.fever;
        this.dim += (dim - this.dim) * Math.min(1, dt * 2.5);
        u.uDim.value = this.dim;
        this.glintU.uTime.value = time;
        this.sky.position.copy(camera.position);
        this.sky.scale.setScalar((camera.far * 0.85) / 120);

        if (this.palMix < 1) {
            this.palMix = Math.min(1, this.palMix + dt * 0.7);
            for (let i = 0; i < 4; i++) u.uPal.value[i].copy(this.palFrom[i]).lerp(this.palTo[i], this.palMix);
        }

        // the ball hangs at the top of the screen, a long way behind the board
        const hv = Math.tan((camera.fov * Math.PI) / 360);
        const zz = -14, depth = dist + 14;
        const kk2 = Math.min(1, dt * 2.5);
        this.ballY += ((ballTop ? 0.72 : 0.1) - this.ballY) * kk2;
        this.ballSize += ((ballTop ? 0.16 : 0.3) - this.ballSize) * kk2;
        const worldTop = new THREE.Vector3(0, this.ballY, 0.5).unproject(camera);
        const dir = worldTop.sub(camera.position).normalize();
        const k = (zz - camera.position.z) / dir.z;
        this.ballPos.copy(camera.position).addScaledVector(dir, k);
        const rad = this.ballSize * 2 * hv * depth * Math.min(1, camera.aspect / 1.25);
        this.ballRoot.visible = this.dim > 0.04;
        this.ballRoot.position.copy(this.ballPos);
        this.ball.scale.setScalar(rad);
        this.ball.rotation.y = time * (calm ? 0.08 : 0.22 + this.fever * 0.5);
        this.ball.rotation.x = 0.12;
        const sparkle = 1 + this.fever * 0.4;
        this.ballRoot.scale.set(1, 1, 1);

        // beams from lamps above the top corners, sweeping
        const palCols = [u.uPal.value[0], u.uPal.value[1], u.uPal.value[2], u.uPal.value[3]];
        const lampY = new THREE.Vector3(0, 1.1, 0.5).unproject(camera).sub(camera.position).normalize();
        const kk = (-8 - camera.position.z) / lampY.z;
        const topY = camera.position.y + lampY.y * kk;
        const spread = hv * (dist + 8) * camera.aspect * 0.95;
        const sw = 0.5 + this.fever * 0.7;
        for (const b of this.beams) {
            b.pivot.position.set(b.side * (spread * (0.55 + b.row * 0.25)), topY, -8 - b.row);
            const swing = Math.sin(time * (0.5 + b.row * 0.17 + this.fever * 0.7) * (calm ? 0.4 : 1) + b.phase) * sw;
            b.pivot.rotation.set(0, 0, b.side * (0.45 + b.row * 0.12) + swing);
            const len = (dist + 14) * 1.7;
            b.mesh.scale.set(1 + b.row * 0.25, len, 1 + b.row * 0.25);
            b.mesh.scale.x *= len * 0.075;
            b.mesh.scale.z = b.mesh.scale.x;
            const col = ROOMS[this.room].beam[(b.row + (b.side > 0 ? 1 : 0)) % 3];
            b.mat.uniforms.uColor.value.set(col);
            if (this.fever > 0.05) b.mat.uniforms.uColor.value.offsetHSL((time * 0.2 + b.phase * 0.2) % 1, 0, 0);
            b.mat.uniforms.uAlpha.value = (0.22 + beat * 0.16 + this.fever * (calm ? 0.06 : 0.2)) * Math.min(1, this.dim);
        }
        // lamps orbit in front of the board
        this.lamps.forEach((l, i) => {
            const a = time * (0.6 + i * 0.23) * (calm ? 0.35 : 1) + i * 2.1;
            l.position.set(Math.cos(a) * 9, Math.sin(a * 1.3) * 7, 7 + Math.sin(a * 0.7) * 2);
            l.intensity = 70 * sparkle * (0.8 + beat * 0.4);
        });
        this.key.intensity = 1.0 + beat * 0.3;
        void palCols;
    }
}
