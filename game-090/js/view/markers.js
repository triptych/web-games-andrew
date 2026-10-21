// Things you walk up to on a floor: the gate up, the stairs down, the Sprout anchor, chests, the
// boss dais and the exit portal. Each is a small group with an update(t) for its idle motion.

import * as THREE from 'three';
import { K, merge, part, glow } from './toon.js';

export function gateUp() {
    const g = new THREE.Group();
    g.add(part(merge([K.box(0.25, 3.2, 0.25, { c: '#5a6a7a', p: [-1.1, 1.6, 0] }), K.box(0.25, 3.2, 0.25, { c: '#5a6a7a', p: [1.1, 1.6, 0] }), K.box(2.6, 0.3, 0.3, { c: '#7a8a9a', p: [0, 3.2, 0] }), K.box(2.0, 0.08, 1.6, { c: '#3a4a5a', p: [0, 0.04, 0] })]), { outline: 0.02 }));
    const sheet = glow(new THREE.PlaneGeometry(2.0, 3.0), '#7affd0', { opacity: 0.28, side: THREE.DoubleSide, p: [0, 1.6, 0] });
    g.add(sheet);
    g.add(glow(new THREE.TorusGeometry(0.9, 0.04, 6, 24), '#7affd0', { p: [0, 1.6, 0] }));
    return { root: g, update: (t) => { sheet.material.opacity = 0.2 + Math.sin(t * 2) * 0.08; } };
}
export function stairsDown() {
    const g = new THREE.Group();
    const steps = [];
    for (let i = 0; i < 5; i++) steps.push(K.box(2.4 - i * 0.1, 0.2, 0.6, { c: i % 2 ? '#3a3a46' : '#4a4a58', p: [0, -i * 0.2 + 0.06, -0.8 + i * 0.5] }));
    g.add(part(merge([...steps, K.box(2.8, 0.12, 3.0, { c: '#2a2a34', p: [0, -0.2, 0.2] })]), { outline: 0.02 }));
    const arrow = glow(new THREE.ConeGeometry(0.4, 0.7, 4), '#ffb060', { p: [0, 0.2, 0.6] });
    arrow.rotation.x = Math.PI / 2; arrow.rotation.z = Math.PI;
    g.add(arrow);
    const ringM = glow(new THREE.TorusGeometry(1.0, 0.04, 6, 24), '#ffb060', { p: [0, 0.1, 0.4] }); ringM.rotation.x = Math.PI / 2;
    g.add(ringM);
    return { root: g, update: (t) => { arrow.position.y = 0.4 + Math.sin(t * 3) * 0.12; ringM.scale.setScalar(1 + Math.sin(t * 2) * 0.05); } };
}
export function anchor() {
    const g = new THREE.Group();
    const base = part(merge([K.cyl(0.8, 0.9, 0.16, { c: '#3a4a3a', p: [0, 0.08, 0] }, 10), K.cyl(0.1, 0.16, 1.0, { c: '#6a4a2a', p: [0, 0.6, 0] }), K.sph(0.5, { c: '#3a9a4a', g: '#8aff7a', p: [0, 1.3, 0] }), K.sph(0.3, { c: '#4aa84a', p: [0.4, 1.0, 0] }), K.sph(0.3, { c: '#4aa84a', p: [-0.4, 1.05, 0.1] })]), { outline: 0.02 });
    g.add(base);
    const ringM = glow(new THREE.TorusGeometry(0.85, 0.03, 6, 28), '#9dffb0', { p: [0, 0.2, 0] }); ringM.rotation.x = Math.PI / 2;
    g.add(ringM);
    const fruit = glow(new THREE.SphereGeometry(0.14, 8, 6), '#fff0a0', { p: [0, 1.7, 0] });
    g.add(fruit);
    const pl = new THREE.PointLight('#9dffb0', 6, 9, 1.6); pl.position.y = 1.4; g.add(pl);
    return { root: g, update: (t, used) => { ringM.scale.setScalar(1 + Math.sin(t * 2) * 0.06); fruit.position.y = 1.7 + Math.sin(t * 2.5) * 0.06; fruit.visible = !used; pl.intensity = used ? 2 : 6; ringM.material.color.set(used ? '#4a6a52' : '#9dffb0'); } };
}
export function chest() {
    const g = new THREE.Group();
    g.add(part(merge([K.box(1.0, 0.55, 0.65, { c: '#7a4a2a', g: '#a8743a', p: [0, 0.28, 0] }), K.box(1.04, 0.1, 0.7, { c: '#d8b848', p: [0, 0.3, 0] }), K.box(0.12, 0.5, 0.7, { c: '#d8b848', p: [-0.4, 0.28, 0] }), K.box(0.12, 0.5, 0.7, { c: '#d8b848', p: [0.4, 0.28, 0] })]), { outline: 0.02 }));
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.55, -0.32);
    lidPivot.add(part(merge([K.cyl(0.33, 0.33, 1.0, { c: '#8a5a32', g: '#a8743a', p: [0, 0.0, 0.32], r: [0, 0, Math.PI / 2], s: [1, 1, 1] }, 10), K.sph(0.07, { c: '#ffe8a0', p: [0, -0.05, 0.64] })]), { outline: 0.018 }));
    lidPivot.children[0].scale.set(1, 1, 1);
    g.add(lidPivot);
    const gl = glow(new THREE.SphereGeometry(0.5, 10, 8), '#ffd86a', { opacity: 0.22, p: [0, 0.6, 0] });
    g.add(gl);
    return { root: g, update: (t, open, k) => { lidPivot.rotation.x = -open * 1.7; gl.visible = open < 0.5; gl.scale.setScalar(1 + Math.sin(t * 3) * 0.1); } };
}
export function bossDais(color = '#d24bff') {
    const g = new THREE.Group();
    g.add(part(merge([K.cyl(3.2, 3.4, 0.25, { c: '#22202c', p: [0, 0.12, 0] }, 12), K.cyl(2.2, 2.4, 0.12, { c: '#2c2838', p: [0, 0.3, 0] }, 12)]), { outline: 0.02 }));
    const r1 = glow(new THREE.TorusGeometry(3.0, 0.05, 6, 48), color, { p: [0, 0.3, 0] }); r1.rotation.x = Math.PI / 2;
    const r2 = glow(new THREE.TorusGeometry(2.0, 0.04, 6, 36), color, { p: [0, 0.4, 0] }); r2.rotation.x = Math.PI / 2;
    g.add(r1, r2);
    const pl = new THREE.PointLight(color, 14, 14, 1.5); pl.position.y = 2; g.add(pl);
    return { root: g, update: (t) => { r1.rotation.z = t * 0.4; r2.rotation.z = -t * 0.6; r1.scale.setScalar(1 + Math.sin(t * 1.5) * 0.02); } };
}
export function portal(color = '#7affd0') {
    const g = new THREE.Group();
    const ringM = glow(new THREE.TorusGeometry(1.2, 0.08, 8, 32), color, { p: [0, 1.4, 0] });
    const disc = glow(new THREE.CircleGeometry(1.15, 24), color, { opacity: 0.3, side: THREE.DoubleSide, p: [0, 1.4, 0] });
    const base = part(K.cyl(1.4, 1.5, 0.15, { c: '#2a3a3a', p: [0, 0.07, 0] }, 12), { outline: 0.02 });
    g.add(ringM, disc, base);
    const pl = new THREE.PointLight(color, 9, 12, 1.5); pl.position.y = 1.5; g.add(pl);
    return { root: g, update: (t) => { ringM.rotation.z = t; disc.material.opacity = 0.25 + Math.sin(t * 3) * 0.1; } };
}
/** The "!" that pops over a Hex that has noticed you. */
export function alertSprite() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ff2a6a'; g.beginPath(); g.moveTo(32, 2); g.lineTo(60, 52); g.lineTo(4, 52); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 36);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false, toneMapped: false }));
    s.scale.set(0.7, 0.7, 1);
    s.renderOrder = 20;
    return s;
}
