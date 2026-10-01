/**
 * aura.js — continuous particle auras for high-rarity, awakened and Radiant
 * characters. auraFor(look, fx) → tick(dt, pos, height).
 */

import * as THREE from 'three';

const AURA = {
    1: { color: '#fff4b0', color2: '#ffffff', rate: 6, shape: 'sparkle' },   // sparkles
    2: { color: '#ff6a2a', color2: '#ffd04a', rate: 14, shape: 'flame' },    // flames
    3: { color: '#9fe8ff', color2: '#ffffff', rate: 9, shape: 'frost' },     // frost
    4: { color: '#8a4aff', color2: '#2a1050', rate: 10, shape: 'shadow' },   // shadow
    5: { color: '#ffe27a', color2: '#ffffff', rate: 9, shape: 'holy' },      // holy
};

export function auraFor(look, fx) {
    const A = AURA[look.aura];
    if (!A) return null;
    let acc = 0;
    const p = new THREE.Vector3();
    const radiant = look.radiant;
    return (dt, pos, h) => {
        acc += dt * A.rate * (radiant ? 1.6 : 1);
        while (acc >= 1) {
            acc--;
            const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.2;
            p.set(pos.x + Math.cos(a) * r, pos.y + Math.random() * h * (A.shape === 'flame' ? 0.4 : 1), pos.z + Math.sin(a) * r);
            const rad = radiant && Math.random() < 0.4;
            fx.emit({ pos: p, count: 1, color: rad ? '#ffffff' : A.color, color2: rad ? '#ff8ad8' : A.color2, speed: 0.2, up: A.shape === 'frost' ? -0.2 : 0.9, life: A.shape === 'flame' ? 0.6 : 1.0, size: A.shape === 'shadow' ? 0.22 : 0.12, gravity: A.shape === 'flame' ? 1.5 : 0, drag: 0.5 });
        }
    };
}
