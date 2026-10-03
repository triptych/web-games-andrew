/**
 * viewmodels.js — the guns in your hands, modelled in code.
 *
 * Rendered in their own scene/camera on top of the world (so they never clip
 * into walls), with real PBR materials, a small generated environment map
 * for the metal, and lights that take their colour from the lightmap where
 * you stand — so the gun is red in a red room and flares with every shot.
 *
 * Every weapon is a THREE.Group facing -Z with named moving parts (slide,
 * pump, barrels, spinner, chamber…). The controller in weapons.js drives
 * bob, sway, recoil and switching; per-weapon actions animate the parts.
 */
import * as THREE from 'three';
import { paintTexture } from '../level/textures.js';

let MATS = null;

function envMap(renderer) {
    const scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(5, 32, 16);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec3 vD; void main(){
            float h = vD.y;
            vec3 c = mix(vec3(0.05,0.05,0.06), vec3(0.5,0.52,0.6), smoothstep(-0.2, 0.9, h));
            c += vec3(1.0,0.85,0.6) * pow(max(dot(vD, normalize(vec3(-0.5,0.7,0.4))),0.0), 30.0) * 3.0;
            c += vec3(0.4,0.6,1.0) * pow(max(dot(vD, normalize(vec3(0.7,0.2,-0.5))),0.0), 12.0) * 1.2;
            c += vec3(0.25) * step(0.92, fract(vD.x * 6.0)) * step(0.0, h);
            gl_FragColor = vec4(c,1.0); }`,
    });
    scene.add(new THREE.Mesh(geo, mat));
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(scene, 0.03);
    pm.dispose();
    return rt.texture;
}

function mats(renderer) {
    if (MATS) return MATS;
    const env = envMap(renderer);
    const gm = paintTexture('gunmetal', 256, 4);
    const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.9, ...o });
    MATS = {
        metal: std({ color: 0x8a8e96, map: gm.map, metalness: 0.85, roughness: 0.38 }),
        dark: std({ color: 0x3a3c42, map: gm.map, metalness: 0.7, roughness: 0.5 }),
        black: std({ color: 0x18191c, metalness: 0.3, roughness: 0.7 }),
        polymer: std({ color: 0x2a2c2e, metalness: 0.05, roughness: 0.85 }),
        wood: std({ color: 0x6a3a1c, metalness: 0.0, roughness: 0.6 }),
        brass: std({ color: 0xc89a4a, metalness: 1.0, roughness: 0.3 }),
        red: std({ color: 0x9a1a10, metalness: 0.4, roughness: 0.5 }),
        hazard: std({ color: 0xd8a020, metalness: 0.3, roughness: 0.5 }),
        glove: std({ color: 0x2a2620, metalness: 0.0, roughness: 0.9 }),
        sleeve: std({ color: 0x3a4632, metalness: 0.0, roughness: 0.95 }),
        glowCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.2) }),
        glowPurple: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.6, 2.6) }),
        glowOrange: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.0, 0.3) }),
        glowRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.2, 0.1) }),
        glowGreen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 0.6) }),
        env,
    };
    return MATS;
}

const M = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
    return m;
};
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const Z = [Math.PI / 2, 0, 0];

function hand(mt, left = false) {
    const g = new THREE.Group();
    // forearm: from the wrist down and back, out of the bottom of the screen
    const arm = new THREE.Group();
    arm.add(M(Cyl(0.034, 0.042, 0.3, 10), mt.sleeve, [0, -0.15, 0]));
    arm.add(M(Cyl(0.036, 0.036, 0.04, 10), mt.glove, [0, -0.01, 0]));
    arm.rotation.set(-0.55, 0, left ? -0.45 : 0.35);
    g.add(arm);
    g.add(M(new THREE.SphereGeometry(0.036, 12, 8), mt.glove, [0, 0.005, -0.008], [0, 0, 0], [1.05, 0.95, 1.3]));
    for (let k = 0; k < 4; k++) g.add(M(Cyl(0.009, 0.008, 0.045, 6), mt.glove, [(k - 1.5) * 0.014 * (left ? -1 : 1), 0.022, -0.04], [0.7, 0, 0]));
    g.add(M(Cyl(0.01, 0.009, 0.04, 6), mt.glove, [left ? -0.03 : 0.03, 0.02, -0.02], [0.4, 0, left ? -0.5 : 0.5]));
    return g;
}

/** Muzzle flash: two crossed additive planes. */
function flash(color, size) {
    const g = new THREE.Group();
    const tex = flashTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
        if (k === 1) m.rotation.y = Math.PI / 2;
        if (k === 2) { m.rotation.x = Math.PI / 2; m.scale.setScalar(0.6); }
        g.add(m);
    }
    g.visible = false;
    g.userData.mat = mat;
    return g;
}
let _flashTex = null;
function flashTexture() {
    if (_flashTex) return _flashTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.2, 'rgba(255,220,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,120,30,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.strokeStyle = 'rgba(255,200,120,0.6)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); g.stroke();
    }
    _flashTex = new THREE.CanvasTexture(c);
    _flashTex.colorSpace = THREE.SRGBColorSpace;
    return _flashTex;
}

// ------------------------------------------------------------------ builders

const BUILD = {
    blade(mt) {
        const g = new THREE.Group();
        const R = hand(mt); R.position.set(0, -0.01, 0.0); g.add(R);
        const blade = new THREE.Group();
        blade.add(M(Cyl(0.017, 0.019, 0.13, 10), mt.polymer, [0, -0.02, 0]));
        for (let k = 0; k < 4; k++) blade.add(M(Cyl(0.02, 0.02, 0.008, 10), mt.metal, [0, -0.07 + k * 0.03, 0]));
        blade.add(M(Box(0.08, 0.022, 0.035), mt.metal, [0, 0.055, 0]));
        blade.add(M(Box(0.006, 0.02, 0.03), mt.glowCyan, [0.037, 0.055, 0]));
        blade.add(M(Box(0.01, 0.36, 0.045), mt.metal, [0, 0.25, 0]));
        const edgeMat = mt.glowCyan.clone();
        const edge = M(Box(0.004, 0.36, 0.008), edgeMat, [0, 0.25, 0.024]);
        blade.add(edge);
        blade.add(M(Box(0.004, 0.36, 0.008), edgeMat, [0, 0.25, -0.024]));
        blade.add(M(new THREE.ConeGeometry(0.023, 0.07, 4), mt.metal, [0, 0.465, 0], [0, Math.PI / 4, 0], [0.45, 1, 1]));
        blade.position.set(0, 0.02, -0.02);
        blade.rotation.set(-0.35, 0.2, -0.35);
        g.add(blade);
        g.userData = { blade, glow: edge, muzzle: new THREE.Vector3(0, 0.3, -0.3), rest: [0.22, -0.27, -0.5] };
        return g;
    },
    pistol(mt) {
        const g = new THREE.Group();
        // frame, grip, trigger guard
        g.add(M(Box(0.036, 0.03, 0.17), mt.polymer, [0, -0.025, -0.02]));
        g.add(M(Box(0.034, 0.1, 0.05), mt.polymer, [0, -0.08, 0.055], [0.28, 0, 0]));
        for (let k = 0; k < 5; k++) g.add(M(Box(0.036, 0.004, 0.044), mt.black, [0, -0.06 - k * 0.016, 0.06 + k * 0.004], [0.28, 0, 0]));
        g.add(M(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), mt.polymer, [0, -0.045, 0.0], [0, Math.PI / 2, Math.PI]));
        g.add(M(Box(0.03, 0.008, 0.06), mt.dark, [0, -0.04, -0.09]));
        // self-charging cell on the side
        g.add(M(Box(0.004, 0.012, 0.07), mt.glowCyan, [-0.019, -0.022, -0.03]));
        const slide = new THREE.Group();
        slide.add(M(Box(0.04, 0.036, 0.19), mt.metal, [0, 0.008, -0.02]));
        for (let k = 0; k < 6; k++) slide.add(M(Box(0.041, 0.028, 0.004), mt.black, [0, 0.008, 0.045 + k * 0.008]));
        slide.add(M(Box(0.026, 0.006, 0.08), mt.dark, [0, 0.027, -0.03]));
        slide.add(M(Box(0.006, 0.01, 0.006), mt.glowGreen, [0, 0.033, -0.105]));
        for (const s of [-1, 1]) slide.add(M(Box(0.005, 0.01, 0.006), mt.glowGreen, [s * 0.009, 0.033, 0.065]));
        g.add(slide);
        g.add(M(Cyl(0.008, 0.008, 0.012, 10), mt.black, [0, 0.006, -0.118], Z));
        const R = hand(mt); R.position.set(0, -0.085, 0.07); g.add(R);
        g.userData = { slide, muzzle: new THREE.Vector3(0, 0.006, -0.13), rest: [0.2, -0.2, -0.46] };
        return g;
    },
    shotgun(mt) {
        const g = new THREE.Group();
        g.add(M(Cyl(0.015, 0.015, 0.5, 14), mt.metal, [0, 0.015, -0.27], Z));
        g.add(M(Cyl(0.017, 0.017, 0.02, 14), mt.dark, [0, 0.015, -0.515], Z));
        g.add(M(Cyl(0.013, 0.013, 0.42, 12), mt.dark, [0, -0.018, -0.23], Z));
        g.add(M(Box(0.05, 0.065, 0.19), mt.dark, [0, -0.004, 0.05]));
        g.add(M(Box(0.012, 0.012, 0.01), mt.brass, [0, 0.03, -0.52]));
        // side saddle with spare shells
        g.add(M(Box(0.006, 0.03, 0.09), mt.polymer, [-0.028, 0.0, 0.05]));
        for (let k = 0; k < 4; k++) {
            g.add(M(Cyl(0.0075, 0.0075, 0.035, 8), mt.red, [-0.034, 0.0, 0.015 + k * 0.022]));
            g.add(M(Cyl(0.008, 0.008, 0.008, 8), mt.brass, [-0.034, -0.02, 0.015 + k * 0.022]));
        }
        g.add(M(Box(0.034, 0.08, 0.05), mt.polymer, [0, -0.07, 0.13], [0.35, 0, 0]));
        g.add(M(Box(0.04, 0.05, 0.14), mt.wood, [0, -0.03, 0.22], [-0.1, 0, 0]));
        const pump = new THREE.Group();
        pump.add(M(Cyl(0.024, 0.024, 0.13, 12), mt.wood, [0, -0.018, 0], Z));
        for (let k = 0; k < 5; k++) pump.add(M(Cyl(0.025, 0.025, 0.006, 12), mt.black, [0, -0.018, -0.05 + k * 0.025], Z));
        const L = hand(mt, true); L.position.set(0, -0.055, 0.0); pump.add(L);
        pump.position.z = -0.24;
        g.add(pump);
        const R = hand(mt); R.position.set(0, -0.08, 0.13); g.add(R);
        g.userData = { pump, muzzle: new THREE.Vector3(0, 0.015, -0.53), rest: [0.2, -0.22, -0.55] };
        return g;
    },
    ssg(mt) {
        const g = new THREE.Group();
        const barrels = new THREE.Group();
        for (const s of [-1, 1]) {
            barrels.add(M(Cyl(0.018, 0.018, 0.44, 14), mt.metal, [s * 0.019, 0, -0.24], Z));
            barrels.add(M(Cyl(0.012, 0.012, 0.01, 12), mt.black, [s * 0.019, 0, -0.462], Z));
        }
        barrels.add(M(Box(0.012, 0.012, 0.42), mt.dark, [0, 0.02, -0.24]));
        barrels.add(M(Box(0.006, 0.008, 0.006), mt.brass, [0, 0.03, -0.44]));
        barrels.add(M(Box(0.06, 0.03, 0.2), mt.wood, [0, -0.028, -0.16]));
        const L = hand(mt, true); L.position.set(0, -0.055, -0.17); barrels.add(L);
        barrels.position.set(0, 0.01, 0.03);
        g.add(barrels);
        g.add(M(Box(0.064, 0.055, 0.1), mt.dark, [0, 0.0, 0.08]));
        g.add(M(Box(0.01, 0.02, 0.02), mt.metal, [0, 0.035, 0.11]));
        g.add(M(Box(0.04, 0.07, 0.05), mt.wood, [0, -0.06, 0.15], [0.35, 0, 0]));
        g.add(M(Box(0.046, 0.06, 0.16), mt.wood, [0, -0.03, 0.24], [-0.1, 0, 0]));
        const shells = new THREE.Group();
        for (const s of [-1, 1]) shells.add(M(Cyl(0.015, 0.015, 0.06, 10), mt.red, [s * 0.019, 0, 0], Z));
        shells.position.set(0, 0.01, 0.0);
        shells.visible = false;
        g.add(shells);
        const R = hand(mt); R.position.set(0, -0.085, 0.15); g.add(R);
        g.userData = { barrels, shells, muzzle: new THREE.Vector3(0, 0.01, -0.46), rest: [0.2, -0.23, -0.55] };
        return g;
    },
    chaingun(mt) {
        const g = new THREE.Group();
        g.add(M(Box(0.09, 0.085, 0.2), mt.dark, [0, -0.01, 0.06]));
        for (let k = 0; k < 4; k++) g.add(M(Box(0.092, 0.008, 0.012), mt.black, [0, 0.02, 0.0 + k * 0.03]));
        g.add(M(Box(0.093, 0.012, 0.18), mt.hazard, [0, -0.045, 0.06]));
        g.add(M(Box(0.016, 0.03, 0.12), mt.metal, [0, 0.05, 0.06]));
        g.add(M(Box(0.05, 0.012, 0.03), mt.metal, [0, 0.07, 0.06]));
        g.add(M(Cyl(0.042, 0.042, 0.06, 16), mt.metal, [0, 0, -0.07], Z));
        const spinner = new THREE.Group();
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            spinner.add(M(Cyl(0.0085, 0.0085, 0.34, 8), mt.metal, [Math.cos(a) * 0.026, Math.sin(a) * 0.026, -0.17], Z));
        }
        spinner.add(M(Cyl(0.04, 0.04, 0.012, 16), mt.black, [0, 0, -0.32], Z));
        spinner.add(M(Cyl(0.04, 0.04, 0.012, 16), mt.black, [0, 0, -0.12], Z));
        spinner.add(M(Cyl(0.01, 0.01, 0.36, 8), mt.dark, [0, 0, -0.17], Z));
        spinner.position.z = -0.1;
        g.add(spinner);
        // ammo drum + belt on the left
        g.add(M(Cyl(0.045, 0.045, 0.05, 16), mt.sleeve, [-0.075, -0.04, 0.08], [0, 0, Math.PI / 2]));
        for (let k = 0; k < 6; k++) g.add(M(Box(0.008, 0.024, 0.008), mt.brass, [-0.045, -0.02 + k * 0.006, 0.02 - k * 0.012], [0.4, 0, 0.3]));
        g.add(M(Box(0.032, 0.08, 0.04), mt.polymer, [0, -0.085, 0.11], [0.3, 0, 0]));
        const R = hand(mt); R.position.set(0, -0.11, 0.13); g.add(R);
        const L = hand(mt, true); L.position.set(-0.06, 0.06, 0.0); L.rotation.set(0.2, 0.6, 1.4); g.add(L);
        g.userData = { spinner, muzzle: new THREE.Vector3(0, 0, -0.45), rest: [0.21, -0.25, -0.55] };
        return g;
    },
    rocket(mt) {
        const g = new THREE.Group();
        g.add(M(Cyl(0.048, 0.048, 0.56, 20), mt.dark, [0, 0.02, -0.1], Z));
        for (const z of [-0.3, -0.05, 0.12]) g.add(M(Cyl(0.051, 0.051, 0.02, 20), mt.black, [0, 0.02, z], Z));
        g.add(M(Cyl(0.06, 0.05, 0.07, 20), mt.metal, [0, 0.02, -0.4], Z));
        g.add(M(Cyl(0.052, 0.058, 0.05, 20), mt.hazard, [0, 0.02, 0.2], Z));
        g.add(M(new THREE.TorusGeometry(0.04, 0.006, 8, 20), mt.glowRed, [0, 0.02, 0.226]));
        // optic
        g.add(M(Box(0.026, 0.034, 0.1), mt.black, [-0.004, 0.085, -0.06]));
        g.add(M(Cyl(0.014, 0.014, 0.01, 12), mt.glowRed, [-0.004, 0.09, -0.112], Z));
        g.add(M(Box(0.01, 0.02, 0.02), mt.metal, [-0.004, 0.065, -0.03]));
        const warhead = M(new THREE.ConeGeometry(0.034, 0.08, 12), mt.red, [0, 0.02, -0.43], [-Math.PI / 2, 0, 0]);
        g.add(warhead);
        g.add(M(Box(0.034, 0.08, 0.04), mt.polymer, [0, -0.06, 0.02], [0.3, 0, 0]));
        g.add(M(Box(0.03, 0.06, 0.035), mt.polymer, [0, -0.05, -0.2], [0.1, 0, 0]));
        const R = hand(mt); R.position.set(0, -0.09, 0.04); g.add(R);
        const L = hand(mt, true); L.position.set(0, -0.08, -0.2); L.scale.setScalar(0.9); g.add(L);
        g.userData = { warhead, muzzle: new THREE.Vector3(0, 0.02, -0.45), rest: [0.21, -0.24, -0.62] };
        return g;
    },
    plasma(mt) {
        const g = new THREE.Group();
        g.add(M(Box(0.07, 0.07, 0.3), mt.dark, [0, 0, -0.02]));
        g.add(M(Box(0.072, 0.02, 0.28), mt.metal, [0, 0.042, -0.02]));
        g.add(M(Box(0.074, 0.01, 0.2), mt.glowCyan, [0, -0.03, -0.02]));
        const coils = new THREE.Group();
        for (let k = 0; k < 5; k++) coils.add(M(new THREE.TorusGeometry(0.038, 0.008, 8, 20), mt.glowCyan, [0, 0.0, -0.2 - k * 0.04]));
        g.add(coils);
        g.add(M(Cyl(0.018, 0.018, 0.26, 12), mt.glowCyan, [0, 0, -0.27], Z));
        g.add(M(Cyl(0.032, 0.032, 0.24, 14, true), new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.22, roughness: 0.05, envMap: mt.env }), [0, 0, -0.27], Z));
        for (const s of [-1, 1]) g.add(M(Box(0.01, 0.018, 0.12), mt.metal, [s * 0.03, 0, -0.42]));
        // battery cell on the side
        g.add(M(Cyl(0.02, 0.02, 0.09, 12), mt.metal, [-0.05, -0.01, 0.04], Z));
        g.add(M(Cyl(0.014, 0.014, 0.092, 12), mt.glowCyan, [-0.05, -0.01, 0.04], Z));
        g.add(M(Box(0.032, 0.08, 0.04), mt.polymer, [0, -0.07, 0.08], [0.3, 0, 0]));
        const R = hand(mt); R.position.set(0, -0.11, 0.1); g.add(R);
        const L = hand(mt, true); L.position.set(-0.02, -0.06, -0.12); L.rotation.set(0, 0, 0.4); g.add(L);
        g.userData = { coils, muzzle: new THREE.Vector3(0, 0, -0.42), rest: [0.2, -0.23, -0.52] };
        return g;
    },
    rail(mt) {
        const g = new THREE.Group();
        g.add(M(Box(0.07, 0.08, 0.22), mt.dark, [0, -0.015, 0.06]));
        for (const s of [-1, 1]) {
            g.add(M(Box(0.014, 0.036, 0.52), mt.metal, [s * 0.026, 0.008, -0.27]));
            g.add(M(Box(0.016, 0.006, 0.52), mt.black, [s * 0.026, 0.028, -0.27]));
        }
        const core = M(Box(0.016, 0.012, 0.5), mt.glowPurple.clone(), [0, 0.008, -0.27]);
        g.add(core);
        for (let k = 0; k < 4; k++) g.add(M(Box(0.07, 0.008, 0.012), mt.dark, [0, -0.012, -0.1 - k * 0.12]));
        const lights = new THREE.Group();
        for (let k = 0; k < 6; k++) lights.add(M(Box(0.006, 0.01, 0.014), mt.glowPurple.clone(), [0.037, 0.01, 0.13 - k * 0.025]));
        g.add(lights);
        g.add(M(Box(0.034, 0.04, 0.12), mt.black, [0, 0.065, 0.03]));
        g.add(M(Cyl(0.014, 0.014, 0.008, 12), mt.glowPurple, [0, 0.065, -0.032], Z));
        g.add(M(Box(0.032, 0.08, 0.04), mt.polymer, [0, -0.085, 0.12], [0.3, 0, 0]));
        const R = hand(mt); R.position.set(0, -0.12, 0.14); g.add(R);
        g.userData = { core, lights, muzzle: new THREE.Vector3(0, 0.008, -0.53), rest: [0.2, -0.22, -0.55] };
        return g;
    },
    bfg(mt) {
        const g = new THREE.Group();
        g.add(M(Box(0.13, 0.11, 0.26), mt.dark, [0, -0.03, 0.06]));
        g.add(M(Box(0.132, 0.016, 0.24), mt.hazard, [0, -0.09, 0.06]));
        for (let k = 0; k < 4; k++) g.add(M(Box(0.134, 0.01, 0.014), mt.black, [0, 0.0, -0.03 + k * 0.05]));
        const chamber = new THREE.Group();
        chamber.add(M(new THREE.SphereGeometry(0.075, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x8866aa, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0, envMap: mt.env })));
        const core = M(new THREE.IcosahedronGeometry(0.038, 1), mt.glowPurple);
        chamber.add(core);
        for (let k = 0; k < 3; k++) chamber.add(M(new THREE.TorusGeometry(0.085, 0.005, 6, 28), mt.metal, [0, 0, 0], [k * 1.05, k * 0.6, 0]));
        chamber.position.set(0, 0.0, -0.14);
        g.add(chamber);
        for (const s of [-1, 1]) {
            g.add(M(Box(0.02, 0.04, 0.2), mt.metal, [s * 0.055, -0.01, -0.27]));
            g.add(M(Box(0.012, 0.012, 0.02), mt.glowPurple, [s * 0.055, -0.01, -0.375]));
        }
        g.add(M(Box(0.032, 0.08, 0.04), mt.polymer, [0, -0.12, 0.13], [0.3, 0, 0]));
        const R = hand(mt); R.position.set(0, -0.15, 0.15); g.add(R);
        const L = hand(mt, true); L.position.set(-0.08, -0.04, -0.06); L.rotation.set(0, 0.4, 1.0); g.add(L);
        g.userData = { chamber, core, muzzle: new THREE.Vector3(0, -0.01, -0.4), rest: [0.21, -0.25, -0.56] };
        return g;
    },
};

const FLASH = { pistol: [0xffd090, 0.18], shotgun: [0xffb070, 0.32], ssg: [0xffa060, 0.42], chaingun: [0xffd080, 0.26], rocket: [0xffa050, 0.3], plasma: [0x60d0ff, 0.22], rail: [0xb080ff, 0.3], bfg: [0xb070ff, 0.5] };

export class ViewModels {
    constructor(renderer, scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mt = mats(renderer);
        this.root = new THREE.Group();
        camera.add(this.root);
        scene.add(camera);
        this.hemi = new THREE.HemisphereLight(0xbbbbcc, 0x332a22, 1.2);
        scene.add(this.hemi);
        this.key = new THREE.DirectionalLight(0xffffff, 1.6);
        this.key.position.set(-1, 2, 1.5);
        scene.add(this.key);
        this.rim = new THREE.DirectionalLight(0x88aaff, 1.2);
        this.rim.position.set(1.5, 0.8, -2);
        scene.add(this.rim);
        this.flashLight = new THREE.PointLight(0xffaa55, 0, 3, 1.5);
        this.flashLight.position.set(0.2, -0.1, -0.7);
        camera.add(this.flashLight);
        this.models = {};
        this.flashes = {};
        for (const id of Object.keys(BUILD)) {
            const g = BUILD[id](this.mt);
            g.visible = false;
            g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
            this.root.add(g);
            this.models[id] = g;
            if (FLASH[id]) {
                const f = flash(FLASH[id][0], FLASH[id][1]);
                f.position.copy(g.userData.muzzle);
                g.add(f);
                this.flashes[id] = f;
            }
        }
        this.current = null;
    }

    show(id) {
        for (const [k, g] of Object.entries(this.models)) g.visible = k === id;
        this.current = id;
    }

    /** ambient: [r,g,b] light where the player stands */
    setLighting(ambient, flashIntensity, flashColor) {
        const a = ambient;
        const l = Math.min(1.6, (a[0] + a[1] + a[2]) / 3 + 0.12);
        this.hemi.color.setRGB(Math.min(2, a[0] * 1.4 + 0.12), Math.min(2, a[1] * 1.4 + 0.12), Math.min(2, a[2] * 1.4 + 0.14));
        this.hemi.groundColor.setRGB(a[0] * 0.4 + 0.04, a[1] * 0.4 + 0.04, a[2] * 0.4 + 0.04);
        this.hemi.intensity = 1.0 + l * 0.8;
        this.key.intensity = 0.9 + l * 1.8;
        this.rim.intensity = 0.8 + l;
        this.key.color.setRGB(Math.min(1, a[0] + 0.4), Math.min(1, a[1] + 0.4), Math.min(1, a[2] + 0.4));
        this.flashLight.intensity = flashIntensity;
        if (flashColor !== undefined) this.flashLight.color.set(flashColor);
    }

    /** pose: {x, y, z, rx, ry, rz} offsets added to the weapon's rest pose */
    pose(id, p) {
        const g = this.models[id];
        if (!g) return;
        // portrait screens are narrow: bring the gun in from the edge so it stays in view
        const a = this.camera.aspect;
        this.root.position.set(a < 1 ? (a - 1) * 0.22 : 0, a < 1 ? 0.02 : 0, 0);
        const r = g.userData.rest;
        g.position.set(r[0] + p.x, r[1] + p.y, r[2] + p.z);
        // toe the barrel in a little so it points at the crosshair
        g.rotation.set(p.rx + 0.02, p.ry + 0.05, p.rz);
    }

    /** Phase Cloak: the gun and hands turn to glass. */
    setCloak(on) {
        if (this._cloak === on) return;
        this._cloak = on;
        for (const m of Object.values(this.mt)) {
            if (!m || !m.isMaterial || m.isMeshBasicMaterial) continue;
            if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
            m.transparent = on || m.userData.baseOpacity < 1;
            m.opacity = on ? 0.28 : m.userData.baseOpacity;
            m.depthWrite = !on;
            m.needsUpdate = true;
        }
    }

    flash(id, on) {
        const f = this.flashes[id];
        if (!f) return;
        f.visible = on;
        if (on) { f.rotation.z = Math.random() * Math.PI; f.scale.setScalar(0.8 + Math.random() * 0.5); }
    }

    get(id) { return this.models[id]; }
}
