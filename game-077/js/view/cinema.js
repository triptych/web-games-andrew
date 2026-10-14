// The opening-credits world: a sports car cruising a palm-lined causeway into
// a striped synthwave sun, Miami's deco skyline on the horizon. It is the
// backdrop for the title, the story scenes, the briefings and the ending,
// re-lit for sunset, night, dawn or a hurricane.

import * as THREE from 'three';
import { makeVehicle, makePalm } from './models.js';
import { windowsTex, canvas, tex } from './textures.js';
import { hash01 } from '../rng.js';

const MOODS = {
    sunset: { top: 0x2a0f4a, mid: 0xff5f8a, hor: 0xffb36a, sea: 0x1a1048, sun: true, sunA: 0xfff07a, sunB: 0xff3fa4, stars: 0.2, fog: 0x7a3a6a, light: 0xffb090, amb: 0.7, city: 0.5 },
    night: { top: 0x05030f, mid: 0x1c0f3a, hor: 0x5a2a7a, sea: 0x05081a, sun: false, moon: true, stars: 1, fog: 0x1a0f30, light: 0x8a9aff, amb: 0.45, city: 1 },
    dawn: { top: 0x3a6ab0, mid: 0xf0a0b8, hor: 0xffd8a0, sea: 0x3a5a8a, sun: true, sunA: 0xfff8d0, sunB: 0xffa0b0, stars: 0, fog: 0xd8a8b8, light: 0xfff0e0, amb: 0.9, city: 0.2 },
    storm: { top: 0x0a0c14, mid: 0x1a2030, hor: 0x2a3448, sea: 0x0a1018, sun: false, stars: 0, fog: 0x1a2030, light: 0x8aa0c0, amb: 0.4, city: 0.6, rain: true },
};
// Where the car sits on screen (NDC) for each kind of screen: bottom-left of
// the title menu, mid-screen above the story dialog box.
export const FRAME = { title: { x: -0.5, y: -0.4 }, story: { x: -0.15, y: 0.05 }, brief: { x: -0.62, y: -0.45 } };

const BG_MOOD = { causeway: 'sunset', sunset: 'sunset', marina: 'night', night: 'night', dawn: 'dawn', storm: 'storm' };

export class Cinema {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 900);
        this.t = 0;
        this.speed = 22;
        this.mood = null;
        this._build();
        this.setMood('causeway');
    }

    _build() {
        const s = this.scene;
        // sky dome
        this.skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } },
            vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `uniform vec3 uTop, uMid, uHor; uniform float uStars, uTime, uFlash; varying vec3 vD;
                float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
                void main(){
                    float y = vD.y;
                    vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.12, y));
                    c = mix(c, uTop, smoothstep(0.1, 0.55, y));
                    vec3 q = floor(vD * 300.0);
                    float st = step(0.997, h(q)) * smoothstep(0.08, 0.4, y) * uStars;
                    c += st * (0.6 + 0.4 * sin(uTime * 3.0 + h(q) * 40.0));
                    c += uFlash * vec3(0.7, 0.8, 1.0);
                    gl_FragColor = vec4(c, 1.0);
                    #include <colorspace_fragment>
                }`,
        });
        s.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat));
        // sun
        this.sunMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uTime: { value: 0 }, uMoon: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `uniform vec3 uA, uB; uniform float uTime, uMoon; varying vec2 vUv;
                void main(){
                    vec2 p = vUv * 2.0 - 1.0; float d = length(p);
                    float disk = smoothstep(1.0, 0.98, d);
                    float glow = smoothstep(1.6, 0.6, d) * 0.35;
                    vec3 c = mix(uB, uA, smoothstep(-0.8, 0.8, p.y));
                    float y = p.y;
                    float bands = step(0.0, sin((y + uTime * 0.04) * 38.0 + 3.0 * (y + 1.0))) ;
                    float cut = (y < 0.05 && uMoon < 0.5) ? mix(1.0, bands, smoothstep(0.05, -0.6, y) * 0.9 + 0.1) : 1.0;
                    float a = disk * cut + glow;
                    if (uMoon > 0.5) { c = vec3(0.85, 0.9, 1.0); a = disk + glow * 0.5; c -= 0.08 * step(0.7, fract(sin(dot(floor(p * 6.0), vec2(12.1, 7.7))) * 437.5)); }
                    gl_FragColor = vec4(c * (1.0 + glow), a);
                    #include <colorspace_fragment>
                }`,
        });
        this.sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.sunMat);
        this.sun.scale.set(150, 150, 1);
        this.sun.position.set(0, 40, -520);
        s.add(this.sun);
        // sea with a sun-glitter column
        this.seaMat = new THREE.ShaderMaterial({
            uniforms: { uSea: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uTime: { value: 0 }, uHor: { value: new THREE.Color() }, uSunOn: { value: 1 } },
            vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: `uniform vec3 uSea, uSun, uHor; uniform float uTime, uSunOn; varying vec3 vW;
                void main(){
                    float dist = clamp(-vW.z / 520.0, 0.0, 1.0);
                    vec3 c = mix(uSea, uHor * 0.7, pow(dist, 1.6));
                    float col = exp(-pow(vW.x / (5.0 + dist * 45.0), 2.0));
                    float glit = step(0.7, sin(vW.z * 1.4 + uTime * 3.0 + sin(vW.x * 0.6) * 2.0)) * col;
                    c += uSun * glit * 0.7 * uSunOn;
                    c += 0.03 * sin(vW.x * 0.8 + vW.z * 0.3 + uTime) * (1.0 - dist);
                    c += uHor * col * 0.15 * uSunOn;
                    gl_FragColor = vec4(c, 1.0);
                    #include <colorspace_fragment>
                }`,
        });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.seaMat);
        sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.2, -300);
        s.add(sea);
        // causeway deck
        const c = canvas(64, 256), g = c.getContext('2d');
        g.fillStyle = '#2a2632'; g.fillRect(0, 0, 64, 256);
        for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(200,200,220,${hash01(k) * 0.15})`; g.fillRect(hash01(k + 1) * 64, hash01(k + 2) * 256, 1.5, 1.5); }
        g.fillStyle = '#fff4d0';
        for (const x of [21, 42]) for (let y = 0; y < 256; y += 64) g.fillRect(x - 1, y, 2, 32);
        g.fillStyle = '#ffd040'; g.fillRect(2, 0, 2, 256); g.fillRect(60, 0, 2, 256);
        this.roadTex = tex(c, { repeat: true });
        this.roadTex.repeat.set(1, 60);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 600), new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.85 }));
        road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -280);
        road.receiveShadow = true;
        s.add(road);
        const side = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.8, 600), new THREE.MeshStandardMaterial({ color: 0xd8d0c8, roughness: 0.8 }));
        side.position.set(0, -0.42, -280);
        s.add(side);
        this.railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3fa4).multiplyScalar(2) });
        for (const x of [-6.2, 6.2]) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 600), this.railMat);
            r.position.set(x, 0.55, -280);
            s.add(r);
        }
        // recycled palms and lamps
        this.movers = [];
        for (let i = 0; i < 24; i++) {
            const p = makePalm(i * 31 + 7, 4 + hash01(i) * 1.5);
            p.position.set(i % 2 ? 7.4 : -7.4, 0, -i * 12);
            p.userData.crown.scale.setScalar(1.6);
            s.add(p);
            this.movers.push(p);
        }
        for (let i = 0; i < 12; i++) {
            const lamp = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), new THREE.MeshStandardMaterial({ color: 0x30303a }));
            pole.position.y = 2.5; lamp.add(pole);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(2.5) }));
            head.position.set(i % 2 ? -0.5 : 0.5, 5, 0); lamp.add(head);
            lamp.position.set(i % 2 ? 6.4 : -6.4, 0, -i * 24 - 6);
            s.add(lamp);
            this.movers.push(lamp);
        }
        // skyline
        this.city = new THREE.Group();
        const pastel = [0xf4b8c8, 0xa8e8e0, 0xf8e0a8, 0xc8b8f0, 0xffffff, 0x98d0f0];
        this.cityMats = [];
        for (let i = 0; i < 46; i++) {
            const w = 8 + hash01(i * 3) * 18, h = 10 + Math.pow(hash01(i * 5), 2) * 70;
            const x = -260 + i * 11.5 + hash01(i * 7) * 8;
            if (Math.abs(x) < 50 && h > 40) continue;
            const wt = windowsTex(0.35, i);
            wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(Math.round(w / 3), Math.round(h / 4));
            const mat = new THREE.MeshStandardMaterial({ color: pastel[i % pastel.length], emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.8, roughness: 0.8, fog: true });
            this.cityMats.push(mat);
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
            b.position.set(x, h / 2 - 1, -380 - hash01(i * 11) * 40);
            this.city.add(b);
            if (hash01(i * 13) < 0.4) {
                const top = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.8, w * 1.02), new THREE.MeshBasicMaterial({ color: new THREE.Color([0xff3fa4, 0x2ff2e0, 0xffe45c, 0xb44cff][i % 4]).multiplyScalar(2) }));
                top.position.set(x, h - 1.4, b.position.z);
                this.city.add(top);
            }
        }
        s.add(this.city);
        // the car
        this.car = makeVehicle('car', 0xfff4f8);
        this.car.scale.setScalar(1.7);
        this.car.rotation.y = Math.PI;   // facing -Z, into the sunset
        this.car.position.set(-2.2, 0, 0);
        s.add(this.car);
        // lights
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x302040, 0.8);
        s.add(this.hemi);
        this.dir = new THREE.DirectionalLight(0xffffff, 1.4);
        this.dir.position.set(-20, 30, -60);
        s.add(this.dir);
        this.headL = new THREE.SpotLight(0xfff0d0, 30, 40, 0.5, 0.5, 1.2);
        this.headL.position.set(-2.2, 1.2, -2);
        this.headL.target.position.set(-2.2, 0, -20);
        s.add(this.headL, this.headL.target);
        s.fog = new THREE.Fog(0x7a3a6a, 120, 520);
        // rain
        const n = 1800, pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const x = (hash01(i) - 0.5) * 60, y = hash01(i + 3) * 30, z = -hash01(i + 7) * 80 + 10;
            pos.set([x, y, z, x + 0.15, y + 1.2, z], i * 6);
        }
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xa0b8e0, transparent: true, opacity: 0.45 }));
        this.rain.frustumCulled = false;
        s.add(this.rain);
        this.flash = 0;
    }

    setMood(bg) {
        const key = BG_MOOD[bg] ?? 'sunset';
        if (this.mood === key) return;
        this.mood = key;
        const m = MOODS[key];
        const u = this.skyMat.uniforms;
        u.uTop.value.set(m.top); u.uMid.value.set(m.mid); u.uHor.value.set(m.hor); u.uStars.value = m.stars;
        this.sun.visible = m.sun || !!m.moon;
        this.sunMat.uniforms.uMoon.value = m.moon ? 1 : 0;
        this.sun.scale.setScalar(m.moon ? 50 : 150);
        this.sun.position.set(m.moon ? 120 : 0, m.moon ? 140 : 40, -520);
        this.sunMat.uniforms.uA.value.set(m.sunA ?? 0xffffff); this.sunMat.uniforms.uB.value.set(m.sunB ?? 0xffffff);
        this.seaMat.uniforms.uSea.value.set(m.sea); this.seaMat.uniforms.uHor.value.set(m.hor);
        this.seaMat.uniforms.uSun.value.set(m.moon ? 0x8aa0ff : (m.sunA ?? 0xffffff));
        this.seaMat.uniforms.uSunOn.value = m.sun ? 1 : m.moon ? 0.4 : 0;
        this.scene.fog.color.set(m.fog);
        this.hemi.color.set(m.light); this.hemi.intensity = m.amb;
        this.dir.color.set(m.light); this.dir.intensity = m.sun ? 1.6 : 0.6;
        for (const mt of this.cityMats) mt.emissiveIntensity = 0.3 + m.city * 0.9;
        this.rain.visible = !!m.rain;
        this.headL.intensity = m.sun ? 10 : 40;
    }

    resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

    /**
     * A slow orbit from behind the car round to its side, aimed so the car
     * always lands at the same spot on screen (opts.frame, in NDC). Aiming down
     * the road instead lost the car whenever the orbit swung wide.
     */
    placeCamera(t, opts = {}) {
        const car = this.car.position, cam = this.camera;
        const a = opts.angle ?? (Math.sin(t * 0.07) * 0.9 + 0.5);
        // narrow (portrait) screens pull back so the whole car fits across
        const r = (opts.dist ?? 11) * Math.max(1, 0.95 / cam.aspect);
        cam.position.set(car.x + Math.sin(a) * r, opts.height ?? 2.6, car.z + Math.cos(a) * r);
        cam.lookAt(car.x, 0.6, car.z);
        const fr = opts.frame ?? FRAME.title;
        const ty = Math.tan((cam.fov * Math.PI) / 360), tx = ty * cam.aspect;
        cam.rotateY(Math.atan(fr.x * tx));
        cam.rotateX(-Math.atan(fr.y * ty));
        cam.updateMatrixWorld();
    }

    update(dt, opts = {}) {
        this.t += dt;
        const t = this.t;
        const speed = this.speed * (opts.slow ? 0.4 : 1);
        this.roadTex.offset.y += dt * speed / 10;
        for (const m of this.movers) {
            m.position.z += speed * dt;
            if (m.position.z > 16) m.position.z -= m.userData.crown ? 288 : 288;
            if (m.userData.crown) m.userData.crown.rotation.y = Math.sin(t * 0.8 + m.position.x) * 0.06;
        }
        for (const w of this.car.userData.wheels ?? []) w.rotation.z -= speed * dt / 0.3;
        this.car.position.x = -2.2 + Math.sin(t * 0.35) * 0.5;
        this.car.position.y = Math.sin(t * 7) * 0.01;
        this.headL.position.x = this.car.position.x; this.headL.target.position.x = this.car.position.x;
        this.placeCamera(t, opts);
        this.skyMat.uniforms.uTime.value = t; this.sunMat.uniforms.uTime.value = t; this.seaMat.uniforms.uTime.value = t;
        if (this.rain.visible) {
            const p = this.rain.geometry.attributes.position.array;
            for (let i = 0; i < p.length; i += 6) {
                p[i + 1] -= dt * 40; p[i + 4] -= dt * 40;
                if (p[i + 1] < -1) { p[i + 1] += 30; p[i + 4] += 30; }
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
            if (Math.random() < dt * 0.25) this.flash = 1;
        }
        this.flash = Math.max(0, this.flash - dt * 3);
        this.skyMat.uniforms.uFlash.value = this.flash * (0.5 + Math.random() * 0.5);
    }
}
