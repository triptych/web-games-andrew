// Stars, planets (one shader for every type), atmospheres, rings and moons.

import * as THREE from 'three';
import { NOISE_GLSL, glowTexture } from './renderer.js';
import { hsl } from './sky.js';

const LOG_V = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const LOG_VM = '\n#include <logdepthbuf_vertex>\n';
const LOG_F = '#include <logdepthbuf_pars_fragment>';
const LOG_FM = '\n#include <logdepthbuf_fragment>\n';

// ------------------------------------------------------------------ star
export function buildStar(sys) {
    const g = new THREE.Group();
    const col = new THREE.Color(sys.star.color);
    const R = sys.star.radius;
    const core = sys.star.cls === 'core';
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCol: { value: col }, uCore: { value: core ? 1 : 0 } },
        vertexShader: `${LOG_V}
            varying vec3 vN; varying vec3 vP; varying vec3 vView;
            void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vView = -mv.xyz; gl_Position = projectionMatrix * mv; ${LOG_VM} }`,
        fragmentShader: `${LOG_F}
            ${NOISE_GLSL}
            uniform float uTime, uCore; uniform vec3 uCol;
            varying vec3 vN; varying vec3 vP; varying vec3 vView;
            void main(){
                ${LOG_FM}
                vec3 p = normalize(vP) * 6.0;
                float n = fbm(p + vec3(uTime * 0.05, uTime * 0.03, 0.0), 5);
                float gran = fbm(p * 4.0 - uTime * 0.12, 3);
                float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
                float limb = pow(mu, 0.45);
                vec3 hot = mix(uCol, vec3(1.0), 0.55);
                vec3 c = mix(uCol * 0.9, hot, n) * (0.75 + gran * 0.5);
                if (uCore > 0.5) c = mix(vec3(0.6, 0.4, 1.0), vec3(1.0, 0.9, 1.0), n) * (0.6 + gran);
                gl_FragColor = vec4(c * limb * 3.2, 1.0);
            }`,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32), mat);
    g.add(sphere);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone().multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    corona.scale.setScalar(R * 5.2);
    g.add(corona);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone().multiplyScalar(0.45), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(R * 16);
    g.add(halo);
    if (core) {
        // The Heart: accretion rings.
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(R * (1.8 + i * 0.7), R * 0.04, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.75 - i * 0.05, 0.9, 0.6).multiplyScalar(2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
            ring.rotation.x = Math.PI / 2 + i * 0.3;
            ring.rotation.y = i * 0.7;
            ring.userData.spin = 0.05 + i * 0.03;
            g.add(ring);
        }
    }
    g.userData.update = (t) => {
        mat.uniforms.uTime.value = t;
        g.children.forEach((c) => { if (c.userData.spin) c.rotation.z += c.userData.spin * 0.016; });
    };
    return g;
}

// ------------------------------------------------------------------ planets
const TYPE_ID = { rocky: 0, desert: 1, lava: 2, terran: 3, ocean: 4, toxic: 5, ice: 6, gas: 7, icegiant: 8 };

function planetColors(p) {
    const h = p.hue, h2 = p.hue2;
    switch (p.type) {
        case 'rocky': return [hsl(0.07 + h * 0.06, 0.12, 0.22), hsl(0.08, 0.1, 0.42), hsl(0.1, 0.08, 0.62)];
        case 'desert': return [hsl(0.05 + h * 0.05, 0.55, 0.32), hsl(0.08 + h * 0.03, 0.6, 0.52), hsl(0.11, 0.45, 0.72)];
        case 'lava': return [hsl(0.02, 0.2, 0.08), hsl(0.03, 0.15, 0.18), hsl(0.05 + h * 0.04, 1, 0.55)];
        case 'terran': return [hsl(0.58 + h * 0.05, 0.7, 0.28), hsl(0.27 + h * 0.08, 0.5, 0.32), hsl(0.1, 0.3, 0.55)];
        case 'ocean': return [hsl(0.55 + h * 0.08, 0.8, 0.25), hsl(0.5 + h * 0.05, 0.6, 0.45), hsl(0.15, 0.3, 0.6)];
        case 'toxic': return [hsl(0.18 + h * 0.12, 0.6, 0.26), hsl(0.22 + h * 0.1, 0.7, 0.45), hsl(0.12, 0.5, 0.6)];
        case 'ice': return [hsl(0.56 + h * 0.06, 0.3, 0.55), hsl(0.55, 0.25, 0.75), hsl(0.6, 0.1, 0.92)];
        case 'gas': return [hsl(0.04 + h * 0.1, 0.55, 0.35), hsl(0.08 + h2 * 0.1, 0.5, 0.62), hsl(0.02 + h * 0.6, 0.4, 0.5)];
        case 'icegiant': return [hsl(0.52 + h * 0.1, 0.6, 0.4), hsl(0.55 + h2 * 0.08, 0.5, 0.65), hsl(0.62, 0.4, 0.55)];
        default: return [hsl(h, 0.3, 0.3), hsl(h2, 0.3, 0.5), hsl(h, 0.2, 0.7)];
    }
}

function atmoColor(p) {
    switch (p.type) {
        case 'terran': case 'ocean': return new THREE.Color(0.35, 0.65, 1.0);
        case 'toxic': return new THREE.Color(0.75, 1.0, 0.35);
        case 'desert': return new THREE.Color(1.0, 0.7, 0.45);
        case 'lava': return new THREE.Color(1.0, 0.35, 0.15);
        case 'gas': return new THREE.Color(1.0, 0.85, 0.6);
        case 'icegiant': return new THREE.Color(0.5, 0.85, 1.0);
        case 'ice': return new THREE.Color(0.75, 0.9, 1.0);
        default: return new THREE.Color(0.5, 0.5, 0.55);
    }
}

export function buildPlanet(p, tier) {
    const g = new THREE.Group();
    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    const [c1, c2, c3] = planetColors(p);
    const atm = atmoColor(p);
    const seg = tier >= 2 ? 40 : 64;
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uType: { value: TYPE_ID[p.type] ?? 0 }, uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 }, uAtm: { value: atm },
            uSeed: { value: (p.seed % 1000) * 0.0173 }, uTime: { value: 0 }, uLights: { value: p.inhabited ? 1 : 0 },
            uOct: { value: tier >= 2 ? 4 : 6 },
        },
        vertexShader: `${LOG_V}
            varying vec3 vN; varying vec3 vObj; varying vec3 vWorld; varying vec3 vView;
            void main(){
                vObj = normalize(position);
                vN = normalize(mat3(modelMatrix) * normal);
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vView = cameraPosition - w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
                ${LOG_VM}
            }`,
        fragmentShader: `${LOG_F}
            ${NOISE_GLSL}
            uniform int uType, uOct; uniform vec3 uC1, uC2, uC3, uAtm; uniform float uSeed, uTime, uLights;
            varying vec3 vN; varying vec3 vObj; varying vec3 vWorld; varying vec3 vView;
            void main(){
                ${LOG_FM}
                vec3 N = normalize(vN);
                vec3 L = normalize(-vWorld);
                vec3 V = normalize(vView);
                vec3 p = vObj * 2.0 + uSeed * 7.0;
                vec3 col; float emis = 0.0; float spec = 0.0; vec3 emisCol = uC3;
                float lat = vObj.y;
                if (uType == 7 || uType == 8) {
                    float warp = fbm(p * vec3(1.0, 3.0, 1.0) + uTime * 0.01, 4);
                    float bands = sin(lat * (uType == 7 ? 22.0 : 12.0) + warp * 4.0 + uSeed * 10.0);
                    float storms = smoothstep(0.72, 0.8, fbm(p * 3.0 + vec3(uTime * 0.02, 0.0, 0.0), 3));
                    col = mix(uC1, uC2, bands * 0.5 + 0.5);
                    col = mix(col, uC3, smoothstep(0.3, 1.0, fbm(p * 6.0 + warp, 3)) * 0.5);
                    col = mix(col, vec3(1.0, 0.95, 0.9), storms * 0.4);
                } else {
                    float h = fbm(p * 1.4, uOct);
                    float hr = ridged(p * 2.2, 4);
                    if (uType == 3 || uType == 4) {
                        float sea = uType == 4 ? 0.6 : 0.5;
                        float land = smoothstep(sea, sea + 0.02, h);
                        vec3 ocean = mix(uC1 * 0.6, uC1, smoothstep(sea - 0.2, sea, h));
                        vec3 ground = mix(uC2, uC3, smoothstep(sea + 0.05, sea + 0.25, h) + hr * 0.2);
                        col = mix(ocean, ground, land);
                        spec = (1.0 - land) * 0.6;
                        float ice = smoothstep(0.78, 0.86, abs(lat) + h * 0.15);
                        col = mix(col, vec3(0.92, 0.95, 1.0), ice);
                        float cl = smoothstep(0.52, 0.72, fbm(p * 2.5 + vec3(uTime * 0.008, 0.0, uTime * 0.004), 5));
                        col = mix(col, vec3(1.0), cl * 0.85);
                    } else if (uType == 2) {
                        col = mix(uC1, uC2, h);
                        float cracks = smoothstep(0.82, 0.95, hr);
                        emis = cracks * (0.8 + 0.4 * sin(uTime * 1.5 + h * 20.0));
                    } else if (uType == 5) {
                        float sw = fbm(p * 2.0 + fbm(p * 3.0 + uTime * 0.01, 3) * 2.0, 5);
                        col = mix(uC1, uC2, sw);
                        col = mix(col, uC3, smoothstep(0.6, 0.8, sw));
                    } else if (uType == 6) {
                        col = mix(uC1, uC3, h);
                        col = mix(col, uC1 * 0.6, smoothstep(0.85, 0.95, hr) * 0.8);
                        spec = 0.3;
                    } else {
                        col = mix(uC1, uC2, smoothstep(0.3, 0.7, h));
                        col = mix(col, uC3, smoothstep(0.65, 0.85, h + hr * 0.15));
                        float crater = smoothstep(0.6, 0.62, vnoise(p * 9.0)) * 0.25;
                        col *= 1.0 - crater;
                    }
                }
                float ndl = dot(N, L);
                float diff = smoothstep(-0.08, 0.6, ndl);
                vec3 lit = col * (0.025 + diff * 1.15);
                vec3 H = normalize(L + V);
                lit += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 40.0) * spec * diff;
                // night-side city lights
                if (uLights > 0.5) {
                    float city = smoothstep(0.78, 0.92, vnoise(vObj * 60.0 + uSeed)) * smoothstep(0.55, 0.62, fbm(p * 1.4, 4));
                    lit += vec3(1.0, 0.75, 0.4) * city * smoothstep(0.1, -0.2, ndl) * 1.6;
                }
                lit += emisCol * emis * 1.8;
                // atmosphere rim
                float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
                lit += uAtm * fres * smoothstep(-0.3, 0.5, ndl) * 0.9;
                gl_FragColor = vec4(lit, 1.0);
            }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, seg, Math.round(seg * 0.6)), mat);
    mesh.rotation.z = p.tilt;
    g.add(mesh);

    // Halo shell
    const halo = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.12, 48, 24), new THREE.ShaderMaterial({
        side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uAtm: { value: atm }, uStr: { value: p.type === 'rocky' ? 0.25 : 0.9 } },
        vertexShader: `${LOG_V}
            varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; ${LOG_VM} }`,
        fragmentShader: `${LOG_F}
            uniform vec3 uAtm; uniform float uStr; varying vec3 vN; varying vec3 vW;
            void main(){ ${LOG_FM}
                vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); vec3 L = normalize(-vW);
                float k = clamp(-dot(N, V), 0.0, 1.0);
                float a = pow(smoothstep(0.0, 0.5, k), 2.0);
                a *= smoothstep(-0.35, 0.4, dot(N, L));
                gl_FragColor = vec4(uAtm * a * uStr * 1.4, 1.0);
            }`,
    }));
    g.add(halo);

    if (p.rings) {
        const rg = new THREE.RingGeometry(p.radius * 1.35, p.radius * 2.4, 128, 1);
        const rc = hsl(p.ringHue, 0.25, 0.6);
        const rmat = new THREE.ShaderMaterial({
            side: THREE.DoubleSide, transparent: true, depthWrite: false,
            uniforms: { uR0: { value: p.radius * 1.35 }, uR1: { value: p.radius * 2.4 }, uCol: { value: rc }, uSeed: { value: p.seed % 100 }, uPR: { value: p.radius }, uPC: { value: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z) } },
            vertexShader: `${LOG_V}
                varying vec3 vL; varying vec3 vW; void main(){ vL = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; ${LOG_VM} }`,
            fragmentShader: `${LOG_F}
                ${NOISE_GLSL}
                uniform float uR0, uR1, uSeed, uPR; uniform vec3 uCol, uPC; varying vec3 vL; varying vec3 vW;
                void main(){ ${LOG_FM}
                    float r = length(vL.xy);
                    float t = (r - uR0) / (uR1 - uR0);
                    float bands = vnoise(vec3(t * 60.0, uSeed, 0.0)) * 0.6 + vnoise(vec3(t * 180.0, uSeed, 1.0)) * 0.4;
                    float a = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t) * (0.25 + bands * 0.75);
                    a *= step(0.08, abs(t - 0.62));
                    // planet shadow on the ring
                    vec3 L = normalize(-uPC);
                    vec3 rel = vW - uPC;
                    float along = dot(rel, -L);
                    float perp = length(rel + L * along);
                    float shadow = (along > 0.0 && perp < uPR) ? 0.15 : 1.0;
                    gl_FragColor = vec4(uCol * (0.4 + bands) * shadow, a * 0.85);
                }`,
        });
        const ring = new THREE.Mesh(rg, rmat);
        ring.rotation.x = Math.PI / 2 + p.ringTilt;
        g.add(ring);
    }

    const moons = [];
    for (const m of p.moons) {
        const mm = new THREE.Mesh(new THREE.SphereGeometry(m.r, 20, 14), new THREE.MeshStandardMaterial({ color: hsl(m.hue, 0.12, 0.5), roughness: 1, metalness: 0 }));
        g.add(mm);
        moons.push({ mesh: mm, ...m });
    }
    g.userData.update = (t) => {
        mesh.rotation.y += p.spin * 0.016;
        mat.uniforms.uTime.value = t;
        for (const m of moons) {
            const a = m.a + t * m.speed;
            m.mesh.position.set(Math.cos(a) * m.d, Math.sin(a * 0.7) * m.d * 0.15, Math.sin(a) * m.d);
        }
    };
    return g;
}
