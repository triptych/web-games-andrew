/**
 * creatures.js — four-legged beasts (one parametric body: wolf, fox, bear, fangcat cat, giantrat,
 * elk, goat, cow, horse, mammoth, walrus), rime spiders and mudclaws; and their gaits.
 */
import * as THREE from 'three';
import { PartBuilder, M } from './rig.js';
import { lerp, clamp01, ease, v3 } from './anim.js';

// L body length, H shoulder height, W half-width between legs, G girth, N neck length, nUp neck angle (0 flat, 1 upright)
const SPECIES = {
    wolf:    { L: 0.95, H: 0.72, W: 0.12, G: 0.2, N: 0.32, nUp: 0.35, head: 'canine', snout: 0.2, tail: 0.5, tailUp: -0.4, ears: 'point', fur: true, leg: 0.05 },
    fox:     { L: 0.95, H: 0.65, W: 0.11, G: 0.18, N: 0.3, nUp: 0.35, head: 'canine', snout: 0.22, tail: 0.75, tailBush: 1.6, tailUp: -0.25, ears: 'point', fur: true, leg: 0.04 },
    bear:    { L: 1.25, H: 0.95, W: 0.22, G: 0.42, N: 0.22, nUp: 0.1, head: 'bear', snout: 0.16, tail: 0.1, tailUp: -0.5, ears: 'round', fur: true, leg: 0.11, hump: true },
    cat:     { L: 1.15, H: 0.8, W: 0.15, G: 0.27, N: 0.25, nUp: 0.2, head: 'cat', snout: 0.1, tail: 0.75, tailUp: -0.6, ears: 'round', fur: true, leg: 0.075, fangcat: true, stripes: true },
    rat:     { L: 0.95, H: 0.42, W: 0.12, G: 0.22, N: 0.2, nUp: 0.1, head: 'canine', snout: 0.24, tail: 1.0, tailThin: true, tailUp: -0.2, ears: 'round', fur: true, leg: 0.045 },
    elk:     { L: 1.3, H: 1.25, W: 0.15, G: 0.3, N: 0.62, nUp: 0.75, head: 'deer', snout: 0.22, tail: 0.12, tailUp: 0.3, ears: 'point', antlers: true, leg: 0.045, hoof: true },
    goat:    { L: 0.9, H: 0.78, W: 0.12, G: 0.25, N: 0.35, nUp: 0.6, head: 'goat', snout: 0.16, tail: 0.1, tailUp: 0.6, ears: 'point', horns: 'curl', leg: 0.04, hoof: true, beard: true, fur: true },
    cow:     { L: 1.55, H: 1.15, W: 0.2, G: 0.46, N: 0.35, nUp: 0.3, head: 'cow', snout: 0.2, tail: 0.75, tailThin: true, tailUp: -1.2, ears: 'side', horns: 'short', leg: 0.07, hoof: true },
    horse:   { L: 1.5, H: 1.45, W: 0.17, G: 0.36, N: 0.75, nUp: 0.65, head: 'horse', snout: 0.32, tail: 0.85, tailHair: true, tailUp: -0.9, ears: 'point', mane: true, leg: 0.06, hoof: true },
    mammoth: { L: 2.6, H: 2.7, W: 0.55, G: 1.15, N: 0.25, nUp: 0.25, head: 'mammoth', snout: 0, tail: 0.5, tailThin: true, tailUp: -1.2, ears: 'side', trunk: true, tusks: true, leg: 0.32, fur: true, hump: true },
    walrus:  { L: 1.7, H: 0.5, W: 0.3, G: 0.48, N: 0.25, nUp: 0.3, head: 'seal', snout: 0.12, tail: 0.25, tailUp: 0, ears: null, tusks: 'small', leg: 0.1, flippers: true },
};

export function buildQuad(actor, material) {
    const sp = SPECIES[actor.body] || SPECIES.wolf;
    const B = new PartBuilder();
    const { L, H, W, G, N } = sp;
    const col = actor.color || 0x7a6a5a;
    const c = new THREE.Color(col);
    const belly = c.clone().lerp(new THREE.Color(0xe8e0d0), sp.head === 'cat' || sp.head === 'canine' ? 0.4 : 0.15).getHex();
    const dark = c.clone().multiplyScalar(0.55).getHex();
    const skinM = sp.fur ? M.fur : M.skin;
    const zH = L * 0.5, zC = -L * 0.5;
    B.bone('root', null, 0, 0, 0);
    B.bone('hips', 'root', 0, H * 0.98, zH);
    B.bone('chest', 'hips', 0, H, zC);
    const nx = Math.cos(sp.nUp * 1.2), ny = Math.sin(sp.nUp * 1.2);
    const neckBase = [0, H * 1.04, zC - 0.08];
    B.bone('neck', 'chest', ...neckBase);
    const headP = [0, neckBase[1] + ny * N, neckBase[2] - nx * N];
    B.bone('head', 'neck', ...headP);
    const hl = sp.head === 'mammoth' ? 0.55 : sp.head === 'horse' ? 0.3 : sp.head === 'bear' ? 0.2 : 0.16;
    B.bone('jaw', 'head', headP[0], headP[1] - 0.04 * H, headP[2] - hl * 0.3);
    B.bone('snoutEnd', 'head', headP[0], headP[1], headP[2] - hl - sp.snout);
    // tail chain
    let tp = [0, H * 0.98, zH + G * 0.7], tparent = 'hips';
    for (let i = 0; i < 4; i++) {
        B.bone(`tail${i}`, tparent, ...tp);
        tparent = `tail${i}`;
        const seg = sp.tail / 3;
        tp = [0, tp[1] + Math.sin(sp.tailUp) * seg, tp[2] + Math.cos(sp.tailUp) * seg];
    }
    // legs
    const legs = [['FR', 1, zC + G * 0.15, 'chest'], ['FL', -1, zC + G * 0.15, 'chest'], ['HR', 1, zH - G * 0.2, 'hips'], ['HL', -1, zH - G * 0.2, 'hips']];
    for (const [n, sx, z, par] of legs) {
        const front = n[0] === 'F';
        B.bone(`up${n}`, par, sx * W, H * 0.92, z);
        B.bone(`lo${n}`, `up${n}`, sx * W, H * 0.48, z + (front ? 0.04 : -0.06) * H);
        B.bone(`ft${n}`, `lo${n}`, sx * W, 0.06 * H, z);
        B.bone(`toe${n}`, `ft${n}`, sx * W, 0.0, z - 0.1 * H);
    }

    // ---- body
    const segs = 5;
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const z = lerp(zH + G * 0.25, zC - G * 0.15, t);
        const r = G * (0.82 + 0.25 * Math.sin(t * Math.PI)) * (sp.hump && t > 0.6 ? 1.08 : 1) * (sp.head === 'cat' && t < 0.5 ? 0.85 : 1);
        const ry = r * (sp.head === 'walrus' ? 0.75 : 1.05);
        B.ellipsoid(t < 0.5 ? 'hips' : 'chest', [0, H * (t > 0.6 && sp.hump ? 1.0 : 0.96), z], [r * 0.95, ry, G * 0.75], col, skinM, { w: 12, h: 9, blend: t < 0.5 ? 'chest' : 'hips', blendFrom: t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2, vary: 0.08 });
        B.ellipsoid(t < 0.5 ? 'hips' : 'chest', [0, H * 0.96 - ry * 0.35, z], [r * 0.85, ry * 0.7, G * 0.7], belly, skinM, { w: 10, h: 6, t0: Math.PI * 0.5 });
    }
    if (sp.hump) B.ellipsoid('chest', [0, H * 1.12, zC + G * 0.3], [G * 0.6, G * 0.5, G * 0.7], col, skinM);
    if (sp.mane) for (let i = 0; i < 6; i++) { const t = i / 5; B.box('neck', [0, lerp(neckBase[1], headP[1], t) + 0.06, lerp(neckBase[2], headP[2], t) + 0.05], [0.04, 0.12, 0.13], dark, M.hair, { blend: 'head', blendFrom: 0.2 }); }
    if (sp.fur && (actor.body === 'mammoth' || actor.body === 'bear' || actor.body === 'wolf')) {
        for (let i = 0; i < 3; i++) B.ellipsoid('chest', [0, H * 0.82 - i * 0.05 * H, zC - G * 0.5 + i * 0.02], [G * 0.7, G * 0.45, G * 0.35], col, M.fur, { vary: 0.25 });   // ruff
    }
    // neck
    B.limb('neck', neckBase, headP, G * (actor.body === 'mammoth' ? 0.7 : 0.55), G * (actor.body === 'mammoth' ? 0.55 : 0.32), col, skinM, { seg: 10, blend: 'head', blendFrom: 0.5 });

    // ---- head
    const hy = headP[1], hz = headP[2];
    const hr = sp.head === 'mammoth' ? 0.55 : sp.head === 'bear' ? 0.22 : sp.head === 'horse' ? 0.15 : sp.head === 'cow' ? 0.19 : sp.head === 'seal' ? 0.22 : sp.head === 'cat' ? 0.15 : 0.12 * (H / 0.72) ** 0.5;
    B.ellipsoid('head', [0, hy, hz], [hr, hr * 0.95, hr * 1.05], col, skinM, { w: 12, h: 9 });
    const snz = hz - hr * 0.8 - sp.snout * 0.5;
    if (sp.snout > 0) {
        const tipR = sp.head === 'horse' || sp.head === 'cow' ? hr * 0.62 : hr * 0.42;
        B.limb('head', [0, hy - hr * 0.15, hz - hr * 0.5], [0, hy - hr * 0.3, hz - hr * 0.7 - sp.snout], hr * 0.65, tipR, col, skinM, { seg: 10 });
        B.ellipsoid('head', [0, hy - hr * 0.22, hz - hr * 0.72 - sp.snout - tipR * 0.6], [tipR * 0.45, tipR * 0.32, tipR * 0.3], 0x1a1614, M.dark, { w: 8, h: 6 });   // nose
        // jaw
        B.limb('jaw', [0, hy - hr * 0.55, hz - hr * 0.3], [0, hy - hr * 0.5, hz - hr * 0.7 - sp.snout * 0.85], hr * 0.4, tipR * 0.6, belly, skinM, { seg: 8 });
        if (sp.head === 'canine' || sp.head === 'cat' || sp.head === 'bear') for (const sx of [1, -1]) B.limb('jaw', [sx * tipR * 0.5, hy - hr * 0.5, hz - hr * 0.7 - sp.snout * 0.75], [sx * tipR * 0.5, hy - hr * 0.62, hz - hr * 0.7 - sp.snout * 0.75], 0.012, 0.002, 0xeee8d8, M.bone, { seg: 4 });
    }
    // eyes
    for (const sx of [1, -1]) {
        B.ellipsoid('head', [sx * hr * 0.6, hy + hr * 0.25, hz - hr * 0.62], [hr * 0.15, hr * 0.13, hr * 0.13], sp.head === 'cat' || sp.head === 'canine' ? 0xd8a838 : 0x161210, M.eye, { w: 7, h: 5 });
        B.ellipsoid('head', [sx * hr * 0.66, hy + hr * 0.26, hz - hr * 0.7], [hr * 0.07, hr * 0.09, hr * 0.06], 0x050403, M.eye, { w: 6, h: 4 });
    }
    // ears
    for (const sx of [1, -1]) {
        if (sp.ears === 'point') B.limb('head', [sx * hr * 0.55, hy + hr * 0.7, hz + hr * 0.2], [sx * hr * 0.75, hy + hr * 1.5, hz + hr * 0.3], hr * 0.28, hr * 0.03, col, skinM, { seg: 5, flat: 0.4 });
        else if (sp.ears === 'round') B.ellipsoid('head', [sx * hr * 0.65, hy + hr * 0.8, hz + hr * 0.15], [hr * 0.25, hr * 0.25, hr * 0.1], col, skinM, { w: 7, h: 5 });
        else if (sp.ears === 'side') B.ellipsoid('head', [sx * hr * (actor.body === 'mammoth' ? 1.0 : 1.05), hy + hr * 0.2, hz + hr * 0.25], actor.body === 'mammoth' ? [hr * 0.15, hr * 0.6, hr * 0.5] : [hr * 0.35, hr * 0.12, hr * 0.18], col, skinM, { w: 8, h: 6 });
    }
    if (sp.antlers && (actor.tpl !== 'deer')) {
        for (const sx of [1, -1]) {
            const base = [sx * hr * 0.4, hy + hr * 0.8, hz + hr * 0.1];
            const mid = [sx * hr * 1.8, hy + hr * 3.2, hz + hr * 0.9];
            const top = [sx * hr * 2.6, hy + hr * 5.0, hz + hr * 0.3];
            B.limb('head', base, mid, hr * 0.13, hr * 0.1, 0xd8c8a8, M.bone, { seg: 6 });
            B.limb('head', mid, top, hr * 0.1, hr * 0.05, 0xd8c8a8, M.bone, { seg: 6 });
            for (let i = 0; i < 3; i++) { const t = 0.3 + i * 0.3; const p0 = [lerp(base[0], top[0], t), lerp(base[1], top[1], t), lerp(base[2], top[2], t)]; B.limb('head', p0, [p0[0] + sx * hr * 0.3, p0[1] + hr * 1.1, p0[2] - hr * 0.8], hr * 0.07, hr * 0.02, 0xd8c8a8, M.bone, { seg: 5 }); }
        }
    }
    if (sp.horns === 'curl') for (const sx of [1, -1]) { let p0 = [sx * hr * 0.35, hy + hr * 0.75, hz]; for (let i = 0; i < 5; i++) { const a = i * 0.7; const p1 = [sx * hr * (0.45 + i * 0.18), hy + hr * (0.75 + Math.cos(a) * 0.9), hz + hr * (0.2 + Math.sin(a) * 1.0)]; B.limb('head', p0, p1, hr * (0.22 - i * 0.035), hr * (0.19 - i * 0.035), 0x8a8070, M.bone, { seg: 6 }); p0 = p1; } }
    if (sp.horns === 'short') for (const sx of [1, -1]) B.limb('head', [sx * hr * 0.6, hy + hr * 0.7, hz], [sx * hr * 1.3, hy + hr * 1.2, hz - hr * 0.2], hr * 0.15, hr * 0.03, 0xd8d0b8, M.bone, { seg: 6 });
    if (sp.beard) B.limb('jaw', [0, hy - hr * 0.6, hz - hr * 0.6], [0, hy - hr * 1.3, hz - hr * 0.7], hr * 0.15, hr * 0.04, 0xe0dcd0, M.hair, { seg: 6 });
    if (sp.fangcat) for (const sx of [1, -1]) B.limb('head', [sx * hr * 0.25, hy - hr * 0.3, hz - hr * 0.85 - sp.snout], [sx * hr * 0.28, hy - hr * 1.15, hz - hr * 0.8 - sp.snout], hr * 0.1, hr * 0.01, 0xf0e8d8, M.bone, { seg: 6 });
    if (sp.trunk) {
        let p0 = [0, hy - hr * 0.1, hz - hr * 0.85];
        for (let i = 0; i < 5; i++) { const p1 = [0, p0[1] - hr * 0.45, p0[2] - hr * 0.12 + i * 0.06 * hr]; B.limb('jaw', p0, p1, hr * (0.32 - i * 0.04), hr * (0.28 - i * 0.04), col, M.skin, { seg: 8 }); p0 = p1; }
    }
    if (sp.tusks) {
        const big = sp.tusks === true;
        for (const sx of [1, -1]) {
            let p0 = [sx * hr * 0.35, hy - hr * 0.4, hz - hr * 0.7];
            for (let i = 0; i < 5; i++) { const a = i * 0.45; const sc = big ? 1 : 0.25; const p1 = [sx * hr * (0.35 + i * 0.12 * sc), p0[1] - hr * 0.4 * sc * Math.cos(a) + (i > 2 ? hr * 0.25 * sc : 0), p0[2] - hr * 0.4 * sc]; B.limb('head', p0, p1, hr * (0.12 - i * 0.02) * (big ? 1 : 0.6), hr * (0.1 - i * 0.02) * (big ? 1 : 0.5), 0xece4d0, M.bone, { seg: 6 }); p0 = p1; }
        }
    }

    // ---- tail
    const tailCol = sp.tailHair ? dark : col;
    for (let i = 0; i < 3; i++) {
        const a = B.bones[B.byName[`tail${i}`]].pos, b = B.bones[B.byName[`tail${i + 1}`]].pos;
        const r0 = sp.tailThin ? 0.025 * H : sp.tailHair ? 0.05 * H : G * 0.18 * (sp.tailBush || 1) * (i === 1 ? 1.2 : 1);
        const r1 = sp.tailThin ? 0.012 * H : sp.tailHair ? 0.07 * H : G * 0.14 * (sp.tailBush || 1) * (i === 2 ? 0.4 : 1);
        if (sp.tail > 0.15) B.limb(`tail${i}`, a, b, r0, r1, i === 2 && actor.body === 'fox' ? 0xf0ece4 : tailCol, sp.tailHair ? M.hair : skinM, { seg: 7, blend: `tail${i + 1}`, blendFrom: 0.5 });
        else if (i === 0) B.ellipsoid('tail0', a, [G * 0.15, G * 0.15, sp.tail], col, skinM);
    }

    // ---- legs
    for (const [n, sx, z] of legs) {
        const front = n[0] === 'F';
        const lg = sp.leg * (front ? 1 : 1.1) * (H / 0.72) ** 0.4;
        const top = [sx * W, H * 0.92, z];
        const knee = [sx * W, H * 0.48, z + (front ? 0.04 : -0.06) * H];
        const foot = [sx * W, 0.06 * H, z];
        if (sp.flippers) {
            B.ellipsoid(`up${n}`, [sx * (W + 0.05), H * 0.45, z], [0.06, 0.25, 0.12], col, M.skin);
            B.box(`ft${n}`, [sx * (W + 0.1), 0.04, z - 0.05], [0.18, 0.04, 0.25], dark, M.skin);
            continue;
        }
        B.limb(`up${n}`, top, knee, lg * (front ? 1.7 : 2.1), lg * 1.1, col, skinM, { seg: 8, bulge: 0.15 });
        B.limb(`lo${n}`, knee, foot, lg * 1.05, lg * 0.8, sp.hoof ? col : col, skinM, { seg: 7 });
        if (sp.hoof) B.limb(`ft${n}`, [foot[0], foot[1] + 0.03, foot[2]], [foot[0], 0.0, foot[2] - 0.01], lg * 0.95, lg * 1.05, 0x2a2420, M.bone, { seg: 7 });
        else { B.ellipsoid(`ft${n}`, [foot[0], 0.035 * H, foot[2] - 0.04 * H], [lg * 1.25, 0.04 * H, lg * 1.6], col, skinM, { w: 8, h: 5 }); for (let k = -1; k <= 1; k++) B.limb(`ft${n}`, [foot[0] + k * lg * 0.6, 0.03 * H, foot[2] - lg * 1.5], [foot[0] + k * lg * 0.6, 0.0, foot[2] - lg * 2.1], lg * 0.2, lg * 0.05, 0x1a1614, M.bone, { seg: 4 }); }
    }
    if (actor.ghost) material.userData.U.uGhost.value = 1;
    const mesh = B.finish(material);
    mesh.userData.kind = 'quad';
    mesh.userData.sp = sp;
    return mesh;
}

// ------------------------------------------------------------------ spider
export function buildSpider(actor, material) {
    const B = new PartBuilder();
    const col = actor.color || 0xc8ccc8;
    const dark = new THREE.Color(col).multiplyScalar(0.35).getHex();
    B.bone('root', null, 0, 0, 0);
    B.bone('body', 'root', 0, 0.5, 0);
    B.bone('abdomen', 'body', 0, 0.58, 0.25);
    B.bone('head', 'body', 0, 0.5, -0.32);
    const hips = [];
    for (let i = 0; i < 4; i++) for (const sx of [1, -1]) {
        const n = `${i}${sx > 0 ? 'R' : 'L'}`;
        const z = -0.22 + i * 0.13;
        const ang = (-0.9 + i * 0.6);
        const out = [Math.cos(ang * 0.6) * sx, Math.sin(ang * 0.6)];
        B.bone(`fe${n}`, 'body', sx * 0.12, 0.52, z);
        B.bone(`ti${n}`, `fe${n}`, sx * (0.12 + 0.5 * out[0] * sx), 0.95, z + 0.5 * out[1]);
        B.bone(`tip${n}`, `ti${n}`, sx * (0.12 + 1.05 * out[0] * sx), 0.0, z + 1.05 * out[1]);
        hips.push([n, sx, z, out]);
    }
    B.ellipsoid('body', [0, 0.5, -0.12], [0.24, 0.17, 0.28], col, M.bone, { vary: 0.15 });
    B.ellipsoid('abdomen', [0, 0.66, 0.5], [0.42, 0.36, 0.52], col, M.fur, { vary: 0.2 });
    for (let i = 0; i < 4; i++) B.ellipsoid('abdomen', [0, 0.92 - i * 0.02, 0.25 + i * 0.16], [0.14, 0.05, 0.06], dark, M.dark);
    B.ellipsoid('head', [0, 0.5, -0.42], [0.16, 0.13, 0.13], col, M.bone);
    for (let i = 0; i < 4; i++) B.ellipsoid('head', [(i - 1.5) * 0.06, 0.58 + (i % 2) * 0.03, -0.52], [0.025, 0.025, 0.02], 0x1a0c0c, M.eye);
    for (const sx of [1, -1]) B.limb('head', [sx * 0.06, 0.42, -0.52], [sx * 0.04, 0.24, -0.6], 0.04, 0.008, 0x1a1414, M.bone, { seg: 6 });
    for (const [n, sx, z, out] of hips) {
        const knee = [sx * (0.12 + 0.5 * out[0] * sx), 0.95, z + 0.5 * out[1]];
        const tip = [sx * (0.12 + 1.05 * out[0] * sx), 0.0, z + 1.05 * out[1]];
        B.limb(`fe${n}`, [sx * 0.12, 0.52, z], knee, 0.05, 0.04, col, M.fur, { seg: 6 });
        B.limb(`ti${n}`, knee, tip, 0.04, 0.012, dark, M.bone, { seg: 6 });
    }
    const mesh = B.finish(material);
    mesh.userData.kind = 'spider';
    mesh.userData.legs = hips;
    return mesh;
}

// ------------------------------------------------------------------ mudclaw
export function buildCrab(actor, material) {
    const B = new PartBuilder();
    const col = actor.color || 0x6a5a40;
    B.bone('root', null, 0, 0, 0);
    B.bone('body', 'root', 0, 0.35, 0);
    const legs = [];
    for (let i = 0; i < 3; i++) for (const sx of [1, -1]) {
        const n = `${i}${sx > 0 ? 'R' : 'L'}`;
        const z = -0.12 + i * 0.16;
        B.bone(`fe${n}`, 'body', sx * 0.3, 0.33, z);
        B.bone(`ti${n}`, `fe${n}`, sx * 0.62, 0.5, z + 0.05);
        B.bone(`tip${n}`, `ti${n}`, sx * 0.85, 0.0, z + 0.1);
        legs.push([n, sx, z]);
    }
    for (const sx of [1, -1]) {
        const s = sx > 0 ? 'R' : 'L';
        B.bone(`cl${s}`, 'body', sx * 0.25, 0.38, -0.3);
        B.bone(`pin${s}`, `cl${s}`, sx * 0.35, 0.42, -0.62);
        B.bone(`pinT${s}`, `pin${s}`, sx * 0.35, 0.42, -0.95);
    }
    B.ellipsoid('body', [0, 0.38, 0], [0.48, 0.17, 0.4], col, M.bone, { vary: 0.2 });
    B.ellipsoid('body', [0, 0.44, 0], [0.42, 0.14, 0.34], new THREE.Color(col).multiplyScalar(1.15).getHex(), M.scale, { t1: Math.PI * 0.5 });
    for (const sx of [1, -1]) B.limb('body', [sx * 0.1, 0.45, -0.32], [sx * 0.12, 0.6, -0.36], 0.015, 0.02, 0x1a1410, M.dark, { seg: 5 });
    for (const [n, sx, z] of legs) {
        B.limb(`fe${n}`, [sx * 0.3, 0.33, z], [sx * 0.62, 0.5, z + 0.05], 0.05, 0.04, col, M.bone, { seg: 6 });
        B.limb(`ti${n}`, [sx * 0.62, 0.5, z + 0.05], [sx * 0.85, 0.0, z + 0.1], 0.04, 0.01, col, M.bone, { seg: 6 });
    }
    for (const sx of [1, -1]) {
        const s = sx > 0 ? 'R' : 'L';
        B.limb(`cl${s}`, [sx * 0.25, 0.38, -0.3], [sx * 0.35, 0.42, -0.62], 0.07, 0.08, col, M.bone, { seg: 7 });
        B.ellipsoid(`pin${s}`, [sx * 0.35, 0.42, -0.75], [0.11, 0.08, 0.16], col, M.bone);
        B.limb(`pin${s}`, [sx * 0.32, 0.42, -0.85], [sx * 0.33, 0.42, -1.0], 0.04, 0.01, col, M.bone, { seg: 5 });
        B.limb(`pin${s}`, [sx * 0.4, 0.42, -0.85], [sx * 0.37, 0.42, -0.98], 0.035, 0.01, col, M.bone, { seg: 5 });
    }
    const mesh = B.finish(material);
    mesh.userData.kind = 'crab';
    mesh.userData.legs = legs;
    return mesh;
}

// ------------------------------------------------------------------ animation
export function quadState() { return { phase: Math.random() * 6, speed: 0, fall: 0, idleT: Math.random() * 10, head: 0, lvx: 0, lvz: 0 }; }

export function animateQuad(P, st, ctx) {
    const a = ctx.a, dt = ctx.dt, sp = P.mesh.userData.sp;
    const H = sp.H;
    P.reset();
    st.speed = lerp(st.speed, ctx.speed, 1 - Math.exp(-dt * 8));
    st.idleT += dt;
    st.fall = a.dead || a.act?.kind === 'knock' ? Math.min(1, st.fall + dt * 2) : Math.max(0, st.fall - dt);
    const v = st.speed / (a.scale || 1);
    const gallop = clamp01((v - 4.5) / 2);
    const stride = (sp.L * 0.55 + gallop * sp.L * 0.4);
    st.phase += v * dt / Math.max(0.2, stride) * Math.PI;
    const ph = st.phase;
    const mv = clamp01(v / 0.8);
    // body
    const bob = Math.sin(ph * 2) * 0.03 * H * mv + gallop * Math.sin(ph) * 0.06 * H;
    P.b.hips.position.y += bob + Math.sin(st.idleT * 1.6) * 0.004;
    const pitch = gallop * Math.cos(ph) * 0.12;
    P.rot('hips', pitch, 0, 0);
    P.rot('chest', -pitch * 1.5, 0, 0);
    // head: look, graze when idle, bite on attack
    const act = a.act || { kind: 'idle' };
    let neckX = 0, neckY = THREE.MathUtils.clamp(ctx.lookYaw || 0, -0.8, 0.8) * 0.6, jaw = 0;
    const grazer = a.faction === 'prey' || a.tpl === 'horse' || a.tpl === 'cow' || a.tpl === 'mammoth';
    if (grazer && v < 0.2 && a.ai?.state !== 'flee') { const g = Math.max(0, Math.sin(st.idleT * 0.3 + (st.phase % 1))); neckX = ease(g * 1.4) * (0.9 + sp.nUp); }
    if (act.kind === 'attack') {
        const tt = act.phase === 'wind' ? act.t / act.wind * 0.4 : act.phase === 'strike' ? 0.4 + act.t / act.strike * 0.3 : 0.7 + act.t / act.recover * 0.3;
        const lunge = tt < 0.4 ? -ease(tt / 0.4) * 0.3 : tt < 0.7 ? lerp(-0.3, 0.45, ease((tt - 0.4) / 0.3)) : lerp(0.45, 0, ease((tt - 0.7) / 0.3));
        neckX += lunge; jaw = tt > 0.3 && tt < 0.75 ? 0.6 : tt < 0.3 ? tt * 2 : 0;
        P.b.hips.position.z -= Math.max(0, lunge) * 0.4 * H;
        if (a.body === 'bear' && act.power) { P.rot('chest', -0.9 * Math.sin(clamp01(tt) * Math.PI), 0, 0); }
    }
    if (ctx.roar) jaw = 0.7;
    P.syncFrom('hips');
    P.rot('neck', neckX * 0.6 + Math.sin(ph * 2) * 0.04 * mv, neckY, 0);
    P.rot('head', neckX * 0.4 - (ctx.lookPitch || 0) * 0.3, neckY * 0.5, 0);
    P.rot('jaw', jaw, 0, 0);
    // tail sway
    const wag = Math.sin(st.idleT * (a.tpl === 'dog' ? 9 : 2.2)) * (a.tpl === 'dog' ? 0.5 : 0.15) + Math.sin(ph) * 0.1 * mv;
    for (let i = 0; i < 3; i++) if (P.b[`tail${i}`]) P.rot(`tail${i}`, (i === 0 ? -0.1 * gallop : 0.08), wag * (i + 1) * 0.5, 0);
    // legs: trot pairs (FL+HR, FR+HL); gallop pairs front and hind
    const offs = gallop > 0.5 ? { FR: 0, FL: 0.4, HR: Math.PI, HL: Math.PI + 0.4 } : { FR: 0, HL: 0, FL: Math.PI, HR: Math.PI };
    const lift = (0.14 + gallop * 0.12) * H * mv;
    let lowest = 0;
    const targets = {};
    for (const n of ['FR', 'FL', 'HR', 'HL']) {
        const fp = ph + offs[n];
        const along = -Math.cos(fp) * stride * 0.5 * mv;
        const up = Math.max(0, Math.sin(fp)) * lift;
        const bx = (n[1] === 'R' ? 1 : -1) * sp.W;
        const bz = B_z(P, n);
        const g = ctx.ground ? ctx.ground(bx, bz + along) : 0;
        lowest = Math.min(lowest, g);
        targets[n] = v3(bx, 0.06 * H + up + g, bz + along);
    }
    if (lowest < 0) { P.b.hips.position.y += Math.max(lowest, -0.3 * H); P.syncFrom('hips'); }
    for (const n of ['FR', 'FL', 'HR', 'HL']) {
        P.ik(`up${n}`, `lo${n}`, `ft${n}`, targets[n], n[0] === 'F' ? v3(0, 0, -1) : v3(0, 0, 1));
        P.orient(`ft${n}`, v3(0, 0, -1), v3(0, 1, 0));
    }
    // death: roll onto the side
    if (st.fall > 0) { const f = ease(st.fall); P.b.root.rotation.set(0, 0, f * Math.PI * 0.5 * 0.95); P.b.root.position.set(-f * H * 0.1, f * 0.05 * H, 0); }
    else { P.b.root.rotation.set(0, 0, 0); P.b.root.position.set(0, 0, 0); }
}
function B_z(P, n) {
    // bind z of the foot
    return P.mesh.userData.footZ?.[n] ?? (P.mesh.userData.footZ = Object.fromEntries(['FR', 'FL', 'HR', 'HL'].map((k) => [k, footBindZ(P, k)])))[n];
}
function footBindZ(P, n) {
    // walk the rest offsets from root to the foot
    let z = 0, b = P.b[`ft${n}`];
    while (b && b.isBone) { z += P.rest[b.name].z; b = b.parent; }
    return z;
}

export function animateMultiLeg(P, st, ctx) {
    const a = ctx.a, dt = ctx.dt;
    P.reset();
    st.speed = lerp(st.speed, ctx.speed, 1 - Math.exp(-dt * 8));
    st.idleT += dt;
    st.fall = a.dead ? Math.min(1, st.fall + dt * 2) : 0;
    const v = st.speed / (a.scale || 1);
    const crab = P.mesh.userData.kind === 'crab';
    st.phase += v * dt * (crab ? 9 : 7);
    const mv = clamp01(v / 0.5);
    const legs = P.mesh.userData.legs;
    const act = a.act || { kind: 'idle' };
    let rear = 0;
    if (act.kind === 'attack') { const tt = act.phase === 'wind' ? act.t / act.wind * 0.4 : act.phase === 'strike' ? 0.4 + act.t / act.strike * 0.3 : 0.7 + act.t / act.recover * 0.3; rear = Math.sin(clamp01(tt) * Math.PI); }
    P.b.body.position.y += Math.sin(st.idleT * 2) * 0.01 - st.fall * 0.25 + Math.abs(Math.sin(st.phase)) * 0.02 * mv;
    P.rot('body', -rear * 0.35, 0, Math.sin(st.phase) * 0.04 * mv);
    if (P.b.abdomen) P.rot('abdomen', Math.sin(st.idleT * 1.3) * 0.05, 0, 0);
    for (const [n, sx, z] of legs) {
        const i = +n[0];
        const off = ((i + (sx > 0 ? 0 : 1)) % 2) * Math.PI;
        const fp = st.phase + off;
        const tip = P.b[`tip${n}`];
        let wx = 0, wz = 0;
        let bb = tip; while (bb && bb.isBone) { wx += P.rest[bb.name].x; wz += P.rest[bb.name].z; bb = bb.parent; }
        const along = -Math.cos(fp) * (crab ? 0.12 : 0.22) * mv;
        const up = Math.max(0, Math.sin(fp)) * 0.14 * mv;
        const T = crab ? v3(wx + along * sx, up, wz) : v3(wx, up, wz + along);
        if (st.fall > 0) { T.y = 0.5; T.x *= 0.5; T.z = z; }
        if (rear > 0 && i === 0 && !crab) { T.y += rear * 0.7; T.z -= rear * 0.3; }
        P.ik(`fe${n}`, `ti${n}`, `tip${n}`, T, v3(sx * 0.3, 1, 0));
    }
    if (crab) for (const s of ['R', 'L']) { const sx = s === 'R' ? 1 : -1; const snap = rear * 0.6 + Math.max(0, Math.sin(st.idleT * 1.5 + sx)) * 0.15; P.rot(`cl${s}`, -snap, sx * 0.2, 0); }
}
