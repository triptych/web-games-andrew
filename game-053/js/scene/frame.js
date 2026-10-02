// The frame layer: a camera where 1 unit = 1 CSS pixel at z = 0, so 3D
// geometry lines up with DOM rectangles. Holds the oak header beam, the
// crossed swords and painted shield, the timber frame around the scene
// window, and two torches with shader flames and embers.
import * as THREE from 'three';
import { woodTexture, leatherTexture, shieldTexture, glowTexture } from './textures.js';

const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FLAME_FS = `
uniform float uTime; uniform float uSeed; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 uv = vUv; uv.x = (uv.x - 0.5) * 2.0;
  float t = uTime * 2.2 + uSeed;
  float n = noise(vec2(uv.x * 3.0, uv.y * 4.0 - t * 2.5)) * 0.6 + noise(vec2(uv.x * 7.0, uv.y * 8.0 - t * 4.0)) * 0.4;
  float shape = 1.0 - smoothstep(0.0, 1.0, abs(uv.x) / (0.55 * (1.0 - uv.y) + 0.05));
  float body = shape * smoothstep(1.0, 0.15, uv.y + n * 0.45) * smoothstep(0.0, 0.08, uv.y);
  vec3 col = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.85, 0.35), smoothstep(0.2, 0.9, body));
  col = mix(col, vec3(1.0, 1.0, 0.85), smoothstep(0.75, 1.0, body));
  gl_FragColor = vec4(col * 1.6, smoothstep(0.05, 0.4, body));
}`;

export class Frame {
    constructor(renderer, envMap) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
        this.envMap = envMap;
        this.scene.environment = envMap;
        this.t = 0;
        this.torches = [];
        this.embers = [];
        this.build();
    }

    build() {
        const s = this.scene;
        s.add(new THREE.AmbientLight(0x6a5040, 1.4));
        const key = new THREE.DirectionalLight(0xffe2b0, 2.2); key.position.set(-0.4, 1, 1.2); s.add(key); this.key = key;
        const rim = new THREE.DirectionalLight(0x6080ff, 0.6); rim.position.set(1, -0.3, 0.6); s.add(rim);

        const oak = woodTexture({ planks: 3, base: [96, 60, 32], seed: 2 });
        oak.map.repeat.set(6, 1); oak.bump.repeat.set(6, 1);
        this.beamMat = new THREE.MeshStandardMaterial({ map: oak.map, bumpMap: oak.bump, bumpScale: 2.5, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 });
        const oak2 = woodTexture({ planks: 2, base: [80, 50, 28], seed: 5 });
        this.frameMat = new THREE.MeshStandardMaterial({ map: oak2.map, bumpMap: oak2.bump, bumpScale: 2, roughness: 0.85, envMapIntensity: 0.3 });
        this.ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.45, metalness: 0.85 });
        this.brassMat = new THREE.MeshStandardMaterial({ color: 0xc8963a, roughness: 0.28, metalness: 1 });
        this.steelMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.18, metalness: 1, envMapIntensity: 1.4 });
        this.leatherMat = new THREE.MeshStandardMaterial({ map: leatherTexture(), roughness: 0.7 });
        this.shieldMat = new THREE.MeshStandardMaterial({ map: shieldTexture(), roughness: 0.55, metalness: 0.15 });

        // header beam (unit box scaled on layout)
        this.beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.beamMat);
        s.add(this.beam);
        this.beamBands = new THREE.Group(); s.add(this.beamBands);

        // crossed swords + shield
        this.crest = new THREE.Group();
        const sw1 = this.makeSword(), sw2 = this.makeSword();
        sw1.rotation.z = Math.PI / 4; sw2.rotation.z = -Math.PI / 4;
        sw1.position.z = -0.12; sw2.position.z = -0.16;
        this.crest.add(sw1, sw2);
        this.shield = this.makeShield();
        this.crest.add(this.shield);
        s.add(this.crest);

        // window frame: 4 beams + corner brackets + rivets
        this.win = new THREE.Group(); s.add(this.win);
        this.winBeams = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.frameMat); this.win.add(m); return m; });
        this.brackets = [0, 1, 2, 3].map(() => { const g = this.makeBracket(); this.win.add(g); return g; });

        // torches
        this.glowTex = glowTexture('rgba(255,170,80,1)', 'rgba(255,120,40,0)');
        for (let i = 0; i < 2; i++) this.torches.push(this.makeTorch(i));

        // embers
        const N = 60;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        this.emberData = Array.from({ length: N }, () => ({ t: Math.random(), side: Math.random() < 0.5 ? 0 : 1, dx: (Math.random() - 0.5) * 20, life: 1 + Math.random() * 1.5 }));
        this.emberPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3, map: glowTexture('rgba(255,200,120,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa040, sizeAttenuation: false }));
        this.emberPts.frustumCulled = false;
        s.add(this.emberPts);
    }

    makeSword() {
        const g = new THREE.Group();
        // blade: extruded diamond-section shape
        const L = 1, W = 0.06;
        const sh = new THREE.Shape();
        sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2 * 0.9, L * 0.85); sh.lineTo(0, L); sh.lineTo(-W / 2 * 0.9, L * 0.85); sh.closePath();
        const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1 }), this.steelMat);
        blade.position.set(0, 0.05, -0.008);
        // fuller
        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, L * 0.65, 0.03), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 1, roughness: 0.3 }));
        fuller.position.set(0, 0.05 + L * 0.36, 0);
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), this.brassMat);
        guard.rotation.z = Math.PI / 2; guard.position.y = 0.04;
        const gEnds = [-1, 1].map((sx) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.brassMat); e.position.set(sx * 0.13, 0.04, 0); return e; });
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.2, 10), this.leatherMat);
        grip.position.y = -0.07;
        const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 1), this.brassMat);
        pommel.position.y = -0.19;
        g.add(blade, fuller, guard, ...gEnds, grip, pommel);
        const holder = new THREE.Group(); g.position.y = -0.4; holder.add(g);
        return holder;
    }

    makeShield() {
        const g = new THREE.Group();
        const sh = new THREE.Shape();
        sh.moveTo(-0.5, 0.55);
        sh.quadraticCurveTo(0, 0.62, 0.5, 0.55);
        sh.lineTo(0.5, 0.05);
        sh.quadraticCurveTo(0.45, -0.45, 0, -0.65);
        sh.quadraticCurveTo(-0.45, -0.45, -0.5, 0.05);
        sh.closePath();
        const face = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 24 });
        // map UVs: planar xy
        const pos = face.attributes.position, uv = face.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.55) / 1.1, (pos.getY(i) + 0.7) / 1.35);
        const m = new THREE.Mesh(face, [this.shieldMat, this.brassMat]);
        // rim
        const pts = sh.getPoints(48).map((p) => new THREE.Vector3(p.x * 1.02, p.y * 1.02, 0.07));
        const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.035, 8, true), this.brassMat);
        // boss studs
        const studs = new THREE.Group();
        for (let i = 0; i < 10; i++) {
            const p = sh.getPoint(i / 10);
            const st = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), this.ironMat);
            st.position.set(p.x * 0.88, p.y * 0.88, 0.085); studs.add(st);
        }
        g.add(m, rim, studs);
        return g;
    }

    makeBracket() {
        const g = new THREE.Group();
        const a = new THREE.Mesh(new THREE.BoxGeometry(1, 0.28, 0.2), this.ironMat);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1, 0.2), this.ironMat);
        a.position.set(0.5 - 0.14, 0, 0); b.position.set(0, -0.5 + 0.14, 0);
        g.add(a, b);
        for (const [x, y] of [[0.7, 0], [0, -0.7], [0.15, -0.15]]) {
            const r = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.brassMat); r.position.set(x, y, 0.12); g.add(r);
        }
        return g;
    }

    makeTorch(i) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 1, 8), this.frameMat);
        shaft.position.y = -0.4;
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.22, 10, 1, true), this.ironMat);
        cup.position.y = 0.12;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), this.ironMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.2;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), this.ironMat); arm.position.set(i === 0 ? -0.25 : 0.25, -0.2, 0);
        const flameMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSeed: { value: i * 7.3 } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), flameMat);
        flame.position.y = 0.72;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
        glow.scale.set(2.6, 2.6, 1); glow.position.y = 0.6;
        const light = new THREE.PointLight(0xff9a40, 1, 0, 1.4);
        light.position.set(0, 0.8, 0.6);
        g.add(shaft, cup, ring, arm, flame, glow, light);
        this.scene.add(g);
        return { g, flame, flameMat, glow, light };
    }

    /** Fit everything to the DOM. rects in CSS px; W,H = canvas CSS size. */
    layout(W, H, topH, win, phone) {
        this.W = W; this.H = H;
        const cam = this.camera;
        cam.aspect = W / H;
        const dist = (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        cam.position.set(W / 2, -H / 2, dist);
        cam.near = dist * 0.3; cam.far = dist * 2;
        cam.lookAt(W / 2, -H / 2, 0);
        cam.updateProjectionMatrix();

        // header beam
        const bh = Math.max(34, topH * 0.62);
        this.beam.scale.set(W + 40, bh, bh * 0.7);
        this.beam.position.set(W / 2, -topH * 0.5, -bh * 0.5);
        this.beamMat.map.repeat.set(Math.max(2, W / 260), 1); this.beamMat.bumpMap.repeat.copy(this.beamMat.map.repeat);
        this.beamBands.clear();
        const bandGeo = new THREE.BoxGeometry(14, bh + 6, bh * 0.75);
        for (let x = 60; x < W; x += phone ? 160 : 240) {
            if (Math.abs(x - W / 2) < topH * 1.4) continue;
            const b = new THREE.Mesh(bandGeo, this.ironMat); b.position.set(x, -topH * 0.5, -bh * 0.5 + 2); this.beamBands.add(b);
            for (const yy of [-bh * 0.32, bh * 0.32]) { const r = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), this.brassMat); r.position.set(x, -topH * 0.5 + yy, bh * 0.36); this.beamBands.add(r); }
        }

        // crest
        const cs = topH * (phone ? 0.9 : 0.82);
        this.crest.position.set(W / 2, -topH * 0.52, 30);
        this.crest.scale.setScalar(cs);
        this.crest.children[0].scale.setScalar(1.45); this.crest.children[1].scale.setScalar(1.45);

        // window frame
        const t = phone ? 9 : 13;
        const x0 = win.left, x1 = win.right, y0 = -win.top, y1 = -win.bottom;
        const w = x1 - x0, h = y0 - y1;
        const z = 6;
        const [top, bot, left, right] = this.winBeams;
        top.scale.set(w + t * 2, t, t * 1.4); top.position.set(x0 + w / 2, y0 + t / 2 - 2, z);
        bot.scale.set(w + t * 2, t, t * 1.4); bot.position.set(x0 + w / 2, y1 - t / 2 + 2, z);
        left.scale.set(t, h + t * 2, t * 1.4); left.position.set(x0 - t / 2 + 2, y1 + h / 2, z);
        right.scale.set(t, h + t * 2, t * 1.4); right.position.set(x1 + t / 2 - 2, y1 + h / 2, z);
        this.frameMat.map.repeat.set(1, 1);
        const bs = t * 2.6;
        const corners = [[x0 - t / 2, y0 + t / 2, 0], [x1 + t / 2, y0 + t / 2, Math.PI / 2 * -1], [x1 + t / 2, y1 - t / 2, Math.PI], [x0 - t / 2, y1 - t / 2, Math.PI / 2]];
        this.brackets.forEach((b, i) => { b.scale.setScalar(bs); b.position.set(corners[i][0] + 2 * (i === 0 || i === 3 ? 1 : -1), corners[i][1] + 2 * (i < 2 ? -1 : 1), z + t * 0.8); b.rotation.z = corners[i][2]; });

        // torches on the inside of the frame near the top
        const ts = phone ? 26 : 38;
        this.torches.forEach((tc, i) => {
            const x = i === 0 ? x0 + ts * 0.55 : x1 - ts * 0.55;
            tc.g.position.set(x, y0 - ts * 1.25 - t, z + 12);
            tc.g.scale.setScalar(ts);
            tc.light.distance = ts * 18;
            tc.baseX = x; tc.baseY = y0 - ts * 1.25 - t; tc.s = ts;
        });
        this.showTorches = h > 110;
        for (const tc of this.torches) tc.g.visible = this.showTorches;
    }

    update(dt, motion) {
        this.t += dt;
        const t = this.t;
        for (const [i, tc] of this.torches.entries()) {
            tc.flameMat.uniforms.uTime.value = t;
            const fl = 0.85 + Math.sin(t * 13 + i) * 0.06 + Math.sin(t * 23.7 + i * 2) * 0.05 + (motion ? (Math.random() - 0.5) * 0.08 : 0);
            tc.light.intensity = fl * 1.6 * (tc.s || 30) * (tc.s || 30) * 0.9;
            tc.glow.material.opacity = 0.45 + fl * 0.15;
            tc.flame.scale.set(1 + (fl - 0.85) * 0.6, fl * 1.05, 1);
        }
        // crest sways gently in torchlight
        if (motion) {
            this.crest.rotation.y = Math.sin(t * 0.35) * 0.08;
            this.crest.rotation.x = Math.sin(t * 0.27) * 0.04;
        }
        // embers rise from torches
        const pos = this.emberPts.geometry.attributes.position;
        const show = this.showTorches && motion;
        this.emberPts.visible = show;
        if (show) {
            this.emberData.forEach((e, i) => {
                e.t += dt / e.life;
                if (e.t > 1) { e.t = 0; e.side = Math.random() < 0.5 ? 0 : 1; e.dx = (Math.random() - 0.5) * 20; }
                const tc = this.torches[e.side];
                const s = tc.s || 30;
                pos.setXYZ(i, tc.baseX + e.dx * e.t + Math.sin(t * 3 + i) * 4, tc.baseY + s * 0.9 + e.t * s * 3.2, tc.g.position.z + 10);
            });
            pos.needsUpdate = true;
            this.emberPts.material.opacity = 0.9;
        }
    }

    setNight(k) { this.key.intensity = 2.2 - k * 0.8; }
}
