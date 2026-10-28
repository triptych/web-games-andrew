// The shop: a cramped workshop in the Lowtide ring, rain on the window, neon outside. Plus the
// neon environment map that gives every piece of metal on the bench something to reflect.

import * as THREE from 'three';
import { Builder, mat, accentMat, colorMat, ledMat } from './kit.js';
import * as TX from './textures.js';
import { Rain } from './fx.js';
import { BENCH } from '../config.js';

const PI = Math.PI;

/** A tiny generated scene: dark indigo sky, a teal horizon, neon strips. PMREM turns it into reflections. */
export function makeEnvironment(renderer) {
    const sc = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec3 vP; void main(){
            float h = normalize(vP).y;
            vec3 top = vec3(0.05,0.04,0.12), mid = vec3(0.10,0.30,0.38), bot = vec3(0.02,0.02,0.04);
            vec3 c = h > 0.0 ? mix(mid, top, clamp(pow(clamp(h,0.0,1.0), 0.5), 0.0, 1.0)) : mix(mid, bot, clamp(-h*2.0, 0.0, 1.0));
            gl_FragColor = vec4(c, 1.0); }`,
    }));
    sc.add(sky);
    const strip = (w, h, x, y, z, color, intensity = 6) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
    };
    strip(18, 1.4, -10, 6, -14, 0xff2a8a, 5);      // magenta neon
    strip(14, 1.2, 14, 3, -10, 0x20d8ff, 5);       // cyan neon
    strip(5, 5, 0, 22, 2, 0xffd9a0, 4);            // the work lamp
    strip(10, 0.8, 0, 8, 18, 0x6a5cff, 2.5);
    strip(2, 12, -22, 4, 6, 0xffa04d, 2.5);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.03);
    pm.dispose();
    sky.geometry.dispose(); sky.material.dispose();
    return rt.texture;
}

function glassShader() {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { time: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float time;
        float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        void main(){
            float a = 0.0;
            for (int L = 0; L < 3; L++) {
                float fl = float(L);
                vec2 sc = vec2(9.0 + fl*7.0, 6.0 + fl*5.0);
                vec2 uv = vUv*sc + vec2(fl*3.1, 0.0);
                vec2 id = floor(uv);
                float r = h21(id + fl*17.0);
                float sp = 0.04 + r*0.08;
                float cy = fract(r*7.0 + time*sp*(0.4+fl*0.3));
                vec2 f = fract(uv) - vec2(0.2 + 0.6*h21(id+3.0), 1.0 - cy);
                float d = length(f * vec2(1.0, 0.8));
                float drop = smoothstep(0.17 + 0.05*r, 0.05, d);
                float trail = smoothstep(0.045, 0.0, abs(f.x)) * smoothstep(0.0, 0.5, f.y) * smoothstep(0.55, 0.0, f.y) * 0.5;
                if (r < 0.55) a += drop*0.8 + trail*0.35;
            }
            a = clamp(a, 0.0, 1.0);
            vec3 tint = mix(vec3(0.55,0.75,1.0), vec3(1.0,0.5,0.8), vUv.x);
            gl_FragColor = vec4(tint, a*0.3 + 0.02);
        }`,
    });
}

function holoAd() {
    const tex = TX.canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#05060c'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#35e0ff'; g.lineWidth = 3;
        for (let i = 1; i < 6; i++) { g.beginPath(); g.arc(120, 128, i * 18, 0, 6.3); g.stroke(); }
        g.fillStyle = '#ffffff'; g.font = 'bold 56px "Arial Black", Arial, sans-serif'; g.textBaseline = 'middle';
        g.fillText('MERIDIAN', 220, 82);
        g.fillStyle = '#35e0ff'; g.font = 'bold 22px monospace';
        g.fillText('PEACE OF MIND,', 224, 140); g.fillText('BUILT IN.', 224, 168);
        g.fillStyle = '#ff3d8b'; g.fillRect(224, 196, 240, 6);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { map: { value: tex }, time: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform sampler2D map; uniform float time;
        void main(){
            vec4 t = texture2D(map, vUv);
            float scan = 0.65 + 0.35*sin(vUv.y*220.0 - time*6.0);
            float flick = 0.85 + 0.15*sin(time*31.0)*sin(time*7.3);
            float edge = smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)*smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.92,vUv.y);
            gl_FragColor = vec4(t.rgb*scan*flick*1.4, edge*0.8);
        }`,
    }));
}

export class Room {
    constructor(scene) {
        this.scene = scene;
        this.g = new THREE.Group();
        scene.add(this.g);
        this.t = 0;
        this.flick = 1;
        this.talk = 0;
        this.build();
    }

    build() {
        const g = this.g;
        const floorM = new THREE.MeshStandardMaterial({ color: 0x5b6070, map: TX.concreteTex(), roughness: 0.38, metalness: 0.35, envMapIntensity: 1.2 });
        const wallM = new THREE.MeshStandardMaterial({ color: 0x6a7080, map: TX.concreteTex(), roughness: 0.9, metalness: 0.1 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorM);
        floor.rotation.x = -PI / 2; floor.position.y = -9; floor.receiveShadow = true; g.add(floor);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), wallM);
        ceil.rotation.x = PI / 2; ceil.position.y = 15; g.add(ceil);

        // walls: the back one has a window cut out
        const Z = -12;
        const addWall = (w, h, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), wallM); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m; };
        addWall(40, 24, -27, 3, Z); addWall(40, 24, 27, 3, Z);                  // left/right of the window
        addWall(14, 6, 0, 12.5, Z);                                             // above
        addWall(14, 10.5, 0, -3.75, Z);                                         // below (the sill is the table's far edge)
        addWall(40, 24, -18, 3, 0, PI / 2);                                     // left wall
        addWall(40, 24, 18, 3, 0, -PI / 2);                                     // right wall
        addWall(40, 24, 0, 3, 28);                                              // front (behind the camera)
        // window frame
        const fb = new Builder();
        fb.box(mat('darkSteel'), 14.6, 0.5, 0.7, 0, 7.5 - 0.0 + 0.25, Z + 0.1);
        fb.box(mat('darkSteel'), 14.6, 0.5, 0.7, 0, 1.0, Z + 0.1);
        fb.box(mat('darkSteel'), 0.5, 6.5, 0.7, -7.1, 4.25, Z + 0.1);
        fb.box(mat('darkSteel'), 0.5, 6.5, 0.7, 7.1, 4.25, Z + 0.1);
        fb.box(mat('darkSteel'), 0.3, 6.5, 0.5, 0, 4.25, Z + 0.1);
        fb.box(mat('darkSteel'), 14, 0.3, 0.5, 0, 4.25, Z + 0.1);
        g.add(fb.build());
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 6.4), glassShader());
        glass.position.set(0, 4.25, Z + 0.25); glass.renderOrder = 8; g.add(glass); this.glass = glass;
        // the city
        const city = (layer, z, w, y, op) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshBasicMaterial({ map: TX.skylineTex(layer), transparent: layer > 0, opacity: op, fog: false, toneMapped: false }));
            m.position.set(0, y, z); g.add(m); return m;
        };
        city(0, -46, 120, 18, 1);
        this.nearCity = city(1, -24, 64, 6.6, 0.95);
        this.nearCity.scale.x = 1;
        // holographic ad
        this.ad = holoAd(); this.ad.position.set(7, 11, -20); this.ad.rotation.y = -0.18; g.add(this.ad);
        // flying cars
        this.cars = [];
        for (let i = 0; i < 7; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.3), ledMat(i % 2 ? 0xffe9b0 : 0xff4a40));
            const tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe9b0 : 0xff4a40, transparent: true, opacity: 0.25, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
            tail.position.x = i % 2 ? -1.6 : 1.6; m.add(tail);
            m.userData = { v: (i % 2 ? 1 : -1) * (3 + i * 0.9), z: -17 - (i % 4) * 4.4, y: 5 + (i * 2.3) % 9 };
            m.position.set(-30 + i * 9, m.userData.y, m.userData.z); g.add(m); this.cars.push(m);
        }
        // rain
        this.rain = new Rain(700); g.add(this.rain.lines);

        // neon sign in the window (mirrored: it faces the street)
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.1), new THREE.MeshBasicMaterial({ map: TX.neonTex('FIX ANYTHING', '#ff3d8b', { w: 512, h: 160, size: 84 }), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
        sign.position.set(-1.2, 6.2, Z + 0.6); g.add(sign); this.sign = sign;
        const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ map: TX.neonTex('OPEN', '#35e0ff', { w: 256, h: 100, size: 64 }), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
        sign2.position.set(4.6, 2.8, Z + 0.6); g.add(sign2); this.sign2 = sign2;
        // neon wash into the room
        this.pink = new THREE.PointLight(0xff3d8b, 120, 40, 1.6); this.pink.position.set(-1.2, 6, Z + 3); g.add(this.pink);
        this.cyan = new THREE.PointLight(0x35e0ff, 70, 36, 1.6); this.cyan.position.set(9, 4, Z + 3); g.add(this.cyan);

        this.buildBench(g);
        this.buildWalls(g);
        this.buildLamp(g);
        this.buildSpanner(g);
        this.buildCosmetics(g);
        // only the bench's own things cast the lamp's shadows (the room's furniture would stripe the mat)
        g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
        this.spanner.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }

    buildBench(g) {
        const b = new Builder();
        const cx = (BENCH.x0 + BENCH.x1) / 2, cz = (BENCH.z0 + BENCH.z1) / 2;
        b.box(colorMat(0x3a2c22, { roughness: 0.75, metalness: 0.1 }), 23, 1.1, 16.4, cx, -0.58, cz);
        b.box(mat('darkSteel'), 23.4, 0.2, 16.8, cx, -1.2, cz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(mat('gunmetal'), 0.9, 8, 0.9, sx * 10.4, -5.2, cz + sz * 7.2);
        b.box(mat('gunmetal'), 22, 0.4, 0.5, cx, -7, cz - 7.2); b.box(mat('gunmetal'), 22, 0.4, 0.5, cx, -7, cz + 7.2);
        g.add(b.build());
        const w = BENCH.x1 - BENCH.x0, d = BENCH.z1 - BENCH.z0;
        const mt = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, d + 0.4), mat('mat'));
        mt.rotation.x = -PI / 2; mt.position.set(cx, 0.012, cz); mt.receiveShadow = true; g.add(mt);
        this.mat = mt;
    }

    buildWalls(g) {
        // pegboard of tools on the left wall
        const peg = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshStandardMaterial({
            map: TX.canvasTex(256, 160, (c, w, h) => {
                c.fillStyle = '#1c2a2e'; c.fillRect(0, 0, w, h); c.fillStyle = '#0c1214';
                for (let y = 8; y < h; y += 14) for (let x = 8; x < w; x += 14) { c.beginPath(); c.arc(x, y, 2, 0, 6.3); c.fill(); }
            }), roughness: 0.8,
        }));
        peg.position.set(-17.6, 4.5, -2); peg.rotation.y = PI / 2; g.add(peg);
        const tb = new Builder();
        const rnd = (i) => ((i * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < 14; i++) {
            const z = -7.5 + (i % 7) * 2.0 + 0.2, y = 2.2 + Math.floor(i / 7) * 3.6 + rnd(i) * 1.0;
            const len = 1.2 + rnd(i + 3) * 1.6;
            if (i % 3 === 0) { tb.box(mat('steel'), 0.1, len, 0.18, -17.2, y, z); tb.box(accentMat([0xff8a3d, 0x35e0ff, 0xffc24d][i % 3 + (i % 2)]), 0.2, 0.7, 0.34, -17.2, y - len * 0.6, z); }
            else if (i % 3 === 1) { tb.tor(mat('steel'), 0.5, 0.07, -17.2, y, z, 0, PI / 2, 0, 6, 18); tb.box(mat('steel'), 0.1, 0.9, 0.14, -17.2, y - 1.0, z); }
            else { tb.box(mat('plasticGrey'), 0.4, 0.5, 0.9, -17.1, y, z); tb.box(mat('chrome'), 0.1, 0.9, 0.1, -17.1, y + 0.6, z); }
        }
        g.add(tb.build());
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 13), ledMat(0x35e0ff));
        strip.position.set(-17.5, 9.2, -2); g.add(strip);
        // shelves with bins on the right wall
        const sb = new Builder();
        for (let r = 0; r < 3; r++) {
            sb.box(mat('gunmetal'), 3.4, 0.2, 14, 16.2, 1.5 + r * 3.2, -1);
            for (let i = 0; i < 6; i++) {
                const hh = 1.2 + rnd(i + r * 7) * 0.8;
                sb.box(colorMat([0x2f6f8f, 0x8f4f2f, 0x4f8f4f, 0x7f2f5f, 0x8f8f2f][(i + r) % 5], { roughness: 0.6, metalness: 0.2 }), 2.2, hh, 1.7, 16.0, 1.6 + r * 3.2 + hh / 2, -6.5 + i * 2.2);
                sb.box(mat('chrome'), 0.05, 0.3, 1.0, 14.88, 1.8 + r * 3.2 + hh * 0.5, -6.5 + i * 2.2);
            }
        }
        g.add(sb.build());
        // a CRT with Meridian's slogan
        const crtTex = TX.canvasTex(256, 192, (c, w, h) => {
            c.fillStyle = '#04100c'; c.fillRect(0, 0, w, h);
            c.fillStyle = '#59ffb4'; c.font = 'bold 22px monospace'; c.fillText('MERIDIAN', 20, 50);
            c.font = '14px monospace'; c.fillText('COMPLIANCE NOTICE 12-B', 20, 86); c.fillText('ALL GOVERNORS MUST BE', 20, 108); c.fillText('PRESENT AND ACCOUNTED.', 20, 128);
            c.fillStyle = '#ff3d5e'; c.fillText('> NON-COMPLIANCE FINES', 20, 160);
        });
        const crt = new THREE.Group();
        const cb = new Builder(); cb.box(colorMat(0xb8b09a, { roughness: 0.6 }), 2.6, 2.2, 2.2, 0, 1.1, 0); crt.add(cb.build());
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false }));
        scr.position.set(-1.31, 1.2, 0); scr.rotation.y = -PI / 2; crt.add(scr);
        crt.position.set(16.1, 11.5 - 0.4, 3.2); g.add(crt);
        // ceiling pipes and a hanging cable
        const pb = new Builder();
        for (let i = 0; i < 3; i++) pb.cylc(mat('darkSteel'), 0.35, 0.35, 40, 14, 0, 13.6 - i * 0.2, -6 + i * 5, 0, 0, PI / 2);
        pb.tor(mat('copper'), 0.4, 0.06, -6, 13.6, -6, 0, PI / 2, 0, 6, 16);
        // ceiling things live in one group so they can be hidden when the camera looks down from above them
        this.ceilG = new THREE.Group(); g.add(this.ceilG);
        this.ceilG.add(pb.build());
        // fluorescent tube over the counter
        this.tube = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.4), ledMat(0xcfe8ff));
        this.tube.position.set(0, 13.4, 5); this.ceilG.add(this.tube);
        this.tubeLight = new THREE.PointLight(0xbfd8ff, 30, 30, 1.8); this.tubeLight.position.set(0, 12.8, 5); this.ceilG.add(this.tubeLight);
    }

    buildLamp(g) {
        const b = new Builder();
        b.cyl(mat('gunmetal'), 0.9, 1.1, 0.4, 16, -10.2, 0, -5.4);
        b.cyl(mat('darkSteel'), 0.22, 0.22, 10.4, 8, -10.2, 0.4, -5.4);
        b.sph(mat('brass'), 0.34, -10.2, 10.6, -5.4);
        b.box(mat('darkSteel'), 11.6, 0.32, 0.32, -4.5, 10.6, -5.2, 0, 0.0, -0.01);
        b.box(mat('darkSteel'), 0.3, 0.3, 2.4, 1.3, 10.6, -4.2);
        g.add(b.build());
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.6, 1.8, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b3a3a, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
        shade.position.set(1.3, 10.9, -3.4); g.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), ledMat(0xfff0d0));
        bulb.position.set(1.3, 10.4, -3.4); g.add(bulb); this.bulb = bulb;
        // a faint cone of light in the dust
        const cone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 8, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.025, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
        cone.position.set(1.3, 5.5, -1.5); g.add(cone); this.cone = cone;
    }

    buildSpanner(g) {
        const s = new THREE.Group();
        const b = new Builder();
        b.cylc(mat('rubber'), 1.0, 1.0, 0.7, 22, 0, 1.0, 0, 0, 0, PI / 2);
        b.cylc(accentMat(0xffd23d), 0.55, 0.55, 0.78, 18, 0, 1.0, 0, 0, 0, PI / 2);
        b.sph(colorMat(0xb59b5a, { metalness: 0.7, roughness: 0.4 }), 1.0, 0, 2.4, 0, 1, 1.1, 0.95, 20, 14);
        b.box(mat('darkSteel'), 1.5, 0.12, 1.3, 0, 2.2, 0.0);
        b.cyl(mat('chrome'), 0.06, 0.06, 1.5, 6, 0.5, 3.0, 0);
        s.add(b.build());
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), ledMat(0xffe27a));
        eye.position.set(0, 3.9, 0.4); s.add(eye); this.eye = eye;
        const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), mat('chrome'));
        lampArm.position.set(0, 3.35, 0.2); s.add(lampArm);
        s.position.set(9.8, 0, -5.2); s.scale.setScalar(0.62); s.rotation.y = -0.4;
        s.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        g.add(s); this.spanner = s;
        this.spanLight = new THREE.PointLight(0xffe27a, 6, 8, 2); this.spanLight.position.set(9.2, 3, -4.4); g.add(this.spanLight);
    }

    buildCosmetics(g) {
        // fern in a mug
        const p = new THREE.Group();
        const b = new Builder();
        b.cyl(colorMat(0xd8d0c0, { roughness: 0.5 }), 0.5, 0.42, 0.8, 16, 0, 0, 0);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; b.add(new THREE.ConeGeometry(0.12, 1.5, 4), colorMat(0x3ea05a, { roughness: 0.7 }), Math.cos(a) * 0.3, 1.5, Math.sin(a) * 0.3, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
        p.add(b.build()); p.position.set(-10.4, 0, -5.4); p.visible = false; g.add(p); this.plant = p;
        // robot cat
        const c = new THREE.Group();
        const cb = new Builder();
        const cm = colorMat(0x8a93a2, { metalness: 0.7, roughness: 0.35 });
        cb.sph(cm, 0.7, 0, 0.7, 0, 1.3, 0.9, 0.9); cb.sph(cm, 0.45, 0.85, 1.15, 0); cb.add(new THREE.ConeGeometry(0.16, 0.34, 4), cm, 0.95, 1.6, 0.2); cb.add(new THREE.ConeGeometry(0.16, 0.34, 4), cm, 0.95, 1.6, -0.2);
        c.add(cb.build());
        const eyeM = new THREE.MeshBasicMaterial({ color: 0x59ffb4, toneMapped: false });
        const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM), e2 = e1.clone();
        e1.position.set(1.26, 1.2, 0.16); e2.position.set(1.26, 1.2, -0.16); c.add(e1, e2); this.catEyes = [e1, e2];
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), cm); tail.position.set(-1.0, 1.0, 0); tail.rotation.z = 0.7; c.add(tail); this.catTail = tail;
        c.position.set(-5.2, 0, -5.6); c.rotation.y = 0.5; c.visible = false; g.add(c); this.cat = c;
        // holo-frame
        const h = new THREE.Group();
        const hb = new Builder(); hb.cyl(mat('darkSteel'), 0.6, 0.7, 0.2, 16, 0, 0, 0); hb.cyl(mat('chrome'), 0.05, 0.05, 0.3, 6, 0, 0.2, 0); h.add(hb.build());
        const hp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({
            map: TX.canvasTex(128, 96, (c2, w, hh) => {
                c2.fillStyle = '#0a2a30'; c2.fillRect(0, 0, w, hh); c2.fillStyle = '#35e0ff';
                c2.beginPath(); c2.arc(46, 40, 12, 0, 6.3); c2.fill(); c2.fillRect(34, 54, 24, 36);
                c2.beginPath(); c2.arc(82, 52, 9, 0, 6.3); c2.fill(); c2.fillRect(73, 63, 18, 28);
            }), transparent: true, opacity: 0.7, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }));
        hp.position.y = 1.3; h.add(hp); h.position.set(-10.4, 0, -2.4); h.rotation.y = 0.6; h.visible = false; g.add(h); this.holo = h; this.holoPic = hp;
    }

    setUpgrades(up) {
        this.plant.visible = !!up.plant; this.cat.visible = !!up.cat; this.holo.visible = !!up.holo;
    }

    update(dt, t, st) {
        this.t = t;
        this.ceilG.visible = (st.camY ?? 0) < 12.5;
        this.rain.update(dt);
        this.glass.material.uniforms.time.value = t;
        this.ad.material.uniforms.time.value = t;
        this.ad.position.y = 11 + Math.sin(t * 0.4) * 0.3;
        // neon buzz
        const buzz = Math.sin(t * 61) * Math.sin(t * 7.3) > 0.93 ? 0.4 : 1;
        this.sign.material.opacity = (0.82 + Math.sin(t * 2.1) * 0.08) * buzz;
        this.sign2.material.opacity = Math.sin(t * 1.3) > 0.9 ? 0.25 : 0.95;
        this.pink.intensity = 110 * (0.85 + 0.15 * buzz);
        const tubeBuzz = Math.sin(t * 43) * Math.sin(t * 3.1) > 0.97 ? 0.3 : 1;
        this.tubeLight.intensity = 26 * tubeBuzz; this.tube.material.color.setHex(tubeBuzz < 1 ? 0x405060 : 0xcfe8ff);
        for (const c of this.cars) {
            c.position.x += c.userData.v * dt;
            if (c.position.x > 40) c.position.x = -40; if (c.position.x < -40) c.position.x = 40;
        }
        // Spanner idles, blinks and pulses when he talks
        const talk = this.talk > 0 ? (0.6 + 0.4 * Math.sin(t * 30)) : 1;
        this.talk = Math.max(0, this.talk - dt);
        const blink = (Math.sin(t * 0.9) > 0.985) ? 0.1 : 1;
        this.eye.scale.set(1, blink, 1);
        this.eye.material.color.setHex(0xffe27a).multiplyScalar(0.8 + 0.5 * talk);
        this.spanLight.intensity = 5 + 5 * talk;
        this.spanner.position.y = Math.sin(t * 1.6) * 0.06;
        this.spanner.rotation.y = -0.4 + Math.sin(t * 0.5) * 0.18 + (st.lookX || 0) * 0.5;
        if (this.cat.visible) {
            this.catTail.rotation.z = 0.7 + Math.sin(t * 2.2) * 0.3;
            for (const e of this.catEyes) e.scale.y = Math.sin(t * 0.7 + 2) > 0.97 ? 0.1 : 1;
        }
        if (this.holo.visible) { this.holoPic.rotation.y = Math.sin(t * 0.8) * 0.15; this.holoPic.material.opacity = 0.55 + Math.sin(t * 9) * 0.1; }
        if (this.plant.visible) this.plant.rotation.y = Math.sin(t * 0.4) * 0.05;
    }
}
