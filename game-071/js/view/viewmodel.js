/**
 * viewmodel.js — the first-person hands. Two forearms (skin, or the worn gauntlets) with the
 * equipped weapon, shield, bow, torch or a spell's glow, drawn in their own scene over the world.
 * Poses are layered: idle sway, walk bob, then the current action (swing, block, draw, cast, sigil).
 */
import * as THREE from 'three';
import { PartBuilder, M, makeCharacterMaterial } from './rig.js';
import { weaponMesh } from './humanoid.js';
import { itemDef } from '../sim/items.js';
import { KIN } from '../sim/stats.js';
import { SPELLS } from '../sim/magic.js';

const MAT_COLOR = { iron: 0x6f6c68, steel: 0xa4a9ae, hill: 0x4f5a3c, deep: 0xb08a45, glimmer: 0xd6b95e, crystal: 0x7fd6a0, night: 0x23252c, dread: 0x3a1210, dragon: 0xd8d0b8, dplate: 0xd8d0b8, plate: 0xb4b8be, hide: 0x7a5a3a, leather: 0x5c3e26, scaled: 0x6b6a5a, dscale: 0x5a7a6a };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function meshFrom(B, material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('mat', new THREE.Float32BufferAttribute(B.mat, 1));
    g.setAttribute('rest', new THREE.Float32BufferAttribute(B.rest, 3));
    return new THREE.Mesh(g, material);
}

/** A forearm reaching from the elbow (origin) along −z to the hand. */
function armMesh(skin, glove, material, side) {
    const B = new PartBuilder();
    B.bone('a', null, 0, 0, 0);
    const sx = side;
    const sleeve = glove ? glove.col : skin;
    const sm = glove ? glove.m : M.skin;
    B.limb('a', [0, 0, 0.1], [0, 0, -0.26], 0.05, 0.038, sleeve, sm, { seg: 10 });
    // hand: palm, fingers curled round a grip, thumb
    B.ellipsoid('a', [0, -0.005, -0.31], [0.042, 0.03, 0.055], glove ? glove.col : skin, sm, { w: 10, h: 7 });
    for (let k = 0; k < 4; k++) B.limb('a', [sx * (-0.025 + k * 0.017), -0.015, -0.355], [sx * (-0.025 + k * 0.017), -0.045, -0.335], 0.011, 0.01, glove ? glove.col : skin, sm, { seg: 6 });
    B.limb('a', [sx * 0.035, 0.0, -0.3], [sx * 0.03, -0.02, -0.345], 0.012, 0.01, glove ? glove.col : skin, sm, { seg: 6 });
    if (glove) B.lathe('a', [[0.046, 0], [0.05, 0.05]], glove.col, glove.m, { pos: [0, 0, -0.2], rot: [Math.PI / 2, 0, 0], seg: 12 });
    return meshFrom(B, material);
}

export class ViewModel {
    constructor(vmScene, vmCamera) {
        this.scene = vmScene;
        this.cam = vmCamera;
        this.material = makeCharacterMaterial();
        this.root = new THREE.Group();
        vmScene.add(this.root);
        vmScene.add(new THREE.HemisphereLight(0xdde6f0, 0x3a3228, 1.4));
        this.sun = new THREE.DirectionalLight(0xfff0dd, 1.6); this.sun.position.set(0.5, 1, 0.3); vmScene.add(this.sun);
        this.sig = '';
        this.arms = {};
        this.t = 0; this.bob = 0; this.swayX = 0; this.swayY = 0;
        this.glows = { R: this.makeGlow(), L: this.makeGlow() };
        this.visible = true;
        this._v = new THREE.Vector3();
    }

    makeGlow() {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.visible = false;
        return m;
    }

    rebuild(p) {
        for (const side of ['R', 'L']) { const a = this.arms[side]; if (a) { this.root.remove(a.pivot); a.mesh.geometry.dispose(); if (a.item) a.item.geometry.dispose(); } }
        const kin = KIN[p.look?.kin] || KIN.norrhen;
        const skin = p.look?.skin ?? new THREE.Color().setRGB(...kin.skin, THREE.SRGBColorSpace).getHex();
        const hd = p.equip.hands ? itemDef(p.equip.hands) : null;
        const glove = hd ? { col: MAT_COLOR[hd.material] ?? hd.color ?? 0x5a4030, m: hd.armorType === 'heavy' ? M.metal : M.leather } : null;
        const r = p.equip.right ? itemDef(p.equip.right) : null, l = p.equip.left ? itemDef(p.equip.left) : null;
        for (const side of ['R', 'L']) {
            const sx = side === 'R' ? 1 : -1;
            const pivot = new THREE.Group();
            const mesh = armMesh(skin, glove, this.material, sx);
            mesh.scale.setScalar(0.62);
            pivot.add(mesh);
            this.root.add(pivot);
            const hand = new THREE.Group(); hand.position.set(0, -0.02, -0.33); mesh.add(hand);
            let item = null, d = side === 'R' ? r : l;
            if (side === 'L' && r?.bow) d = r;            // bows sit in the left hand
            if (side === 'R' && r?.bow) d = null;
            if (d && (d.type === 'weapon' || d.slot === 'shield' || d.type === 'torch')) {
                item = weaponMesh(d.id, this.material);
                if (item) {
                    hand.add(item);
                    if (d.slot === 'shield') { item.rotation.set(0, sx * Math.PI / 2, 0); item.position.set(sx * -0.05, 0, 0.05); }
                    else if (d.bow) { item.rotation.set(0, Math.PI, 0); item.position.set(0, 0, 0); }
                    else { item.rotation.set(-Math.PI / 2 + 0.25, 0, 0); item.position.set(0, -0.01, d.two ? 0.18 : 0); }
                    item.castShadow = false;
                }
            }
            hand.add(this.glows[side]);
            this.arms[side] = { pivot, mesh, hand, item, d };
        }
    }

    sigOf(p) { return ['right', 'left', 'hands'].map((s) => p.equip?.[s]?.id || '').join('|') + (p.look?.kin || ''); }

    /** World position of a hand (for particle effects), given the main camera. */
    handWorld(side, camera, out) {
        const a = this.arms[side === 'handL' ? 'L' : 'R'];
        if (!a) return out.copy(camera.position);
        a.hand.updateWorldMatrix(true, false);
        out.setFromMatrixPosition(a.hand.matrixWorld);   // view-model space ≈ camera space
        return out.applyMatrix4(camera.matrixWorld);
    }

    update(dt, p, world) {
        const show = !p.third && !p.dead && world.cellId !== undefined;
        this.root.visible = show;
        if (!show) return;
        const sig = this.sigOf(p);
        if (sig !== this.sig) { this.sig = sig; this.rebuild(p); }
        this.t += dt;
        const hs = Math.hypot(p.vel.x, p.vel.z);
        if (p.onGround && hs > 0.3) this.bob += dt * hs * 1.7;
        const amp = p.onGround ? Math.min(1, hs / 5) : 0;
        const bx = Math.sin(this.bob * Math.PI) * 0.012 * amp, by = -Math.abs(Math.sin(this.bob * Math.PI)) * 0.016 * amp;
        // sway lags the look
        this.swayX = lerp(this.swayX, -(p.lookDX || 0) * 0.0006, Math.min(1, dt * 8));
        this.swayY = lerp(this.swayY, (p.lookDY || 0) * 0.0006, Math.min(1, dt * 8));
        const breathe = Math.sin(this.t * 1.6) * 0.004;
        const act = p.act || { kind: 'idle' };
        const drawn = p.drawn || act.kind !== 'idle';
        this.drawnK = lerp(this.drawnK ?? 0, drawn ? 1 : 0, Math.min(1, dt * 7));
        const dk = this.drawnK;
        for (const side of ['R', 'L']) {
            const a = this.arms[side]; if (!a) continue;
            const sx = side === 'R' ? 1 : -1;
            // rest pose (lowered) blended to ready pose (raised)
            let x = sx * lerp(0.26, 0.22, dk), y = lerp(-0.42, -0.25, dk), z = lerp(-0.12, -0.2, dk);
            let rx = lerp(-0.6, -0.05, dk), ry = sx * lerp(0.12, 0.18, dk), rz = sx * lerp(0.15, 0.25, dk);
            const has = a.d;
            const two = this.arms.R?.d?.two && !this.arms.R?.d?.bow;
            if (!has && side === 'L' && !(act.kind === 'cast' && act.hand !== 'right') && !two) { y = lerp(-0.6, -0.36, dk); }
            if (two && side === 'L') { x = 0.05; y = lerp(-0.45, -0.3, dk); z = -0.22; ry = 0.6; rz = 0.4; }
            // actions
            if (act.kind === 'attack' && (act.hand === (side === 'R' ? 'right' : 'left') || (two && side === 'L'))) {
                const W = act.wind, S = act.strike, Rc = act.recover;
                const u = act.phase === 'wind' ? act.t / W * 0.4 : act.phase === 'strike' ? 0.4 + act.t / S * 0.25 : 0.65 + act.t / Rc * 0.35;
                const pw = act.power ? 1.4 : 1;
                const up = u < 0.4 ? ease(u / 0.4) : u < 0.65 ? 1 - ease((u - 0.4) / 0.25) * 1.6 : -0.6 + ease((u - 0.65) / 0.35) * 0.6;
                const across = u < 0.4 ? ease(u / 0.4) * 0.5 : u < 0.65 ? 0.5 - ease((u - 0.4) / 0.25) * 1.3 : -0.8 + ease((u - 0.65) / 0.35) * 0.8;
                x += sx * across * 0.18 * pw; y += up * 0.14 * pw; z += Math.max(0, -up) * -0.12;
                rx += up * 0.9 * pw; rz += sx * across * -1.2 * pw; ry += sx * across * 0.5;
            }
            if (act.kind === 'bash' && side === 'L') { const u = act.phase === 'strike' ? 1 : act.phase === 'wind' ? act.t / act.wind : 1 - act.t / act.recover; z -= ease(u) * 0.18; x += 0.08 * ease(u); }
            if (p.blocking && act.kind === 'idle') {
                if (side === 'L' && this.arms.L?.d?.slot === 'shield') { x = -0.12; y = -0.2; z = -0.25; rx = 0; ry = 0.2; rz = 0; }
                else if (side === 'R' && !this.arms.L?.d) { x = 0.02; y = -0.12; z = -0.3; rx = 0.2; ry = 0.6; rz = 1.3; }
            }
            if (act.kind === 'draw' || (this.arms.L?.d?.bow && dk > 0.5)) {
                const draw = act.kind === 'draw' ? Math.min(1, act.t / (act.full || 1)) : 0;
                if (side === 'L') { x = -0.04; y = -0.12; z = -0.42; rx = 0; ry = 0; rz = -0.12; }
                else { x = lerp(0.02, 0.08, draw); y = lerp(-0.13, -0.1, draw); z = lerp(-0.42, -0.08, ease(draw)); rx = 0.05; ry = 0.15 + draw * 0.4; rz = 1.3; }
            }
            const castHere = act.kind === 'cast' && (act.hand === 'both' || act.hand === (side === 'R' ? 'right' : 'left'));
            const sp = castHere ? SPELLS[act.spell] : null;
            if (castHere) { const c = act.conc ? 1 : Math.min(1, act.t / 0.5); x = sx * lerp(0.2, 0.14, c); y = -0.2 + c * 0.03; z = -0.3 - c * 0.08; rx = 0.3; rz = sx * 0.1; }
            if (act.kind === 'sigil' && side === 'R') {
                const a2 = act.t * 7.5, rr = 0.03 + 0.015 * (act.rings || 1);
                if (act.charging) { x = 0.08 + Math.cos(a2) * rr; y = -0.15 + Math.sin(a2) * rr; z = -0.4; rx = 0.9; ry = 0; rz = 0; }
                else { x = 0.05; y = -0.14; z = -0.46; rx = 1.1; ry = 0; rz = 0; }
            }
            // spell in the hand (not casting): a soft glow
            const handSpell = p.hands?.[side === 'R' ? 'right' : 'left'];
            const g = this.glows[side];
            const glowSpell = sp || (handSpell && SPELLS[handSpell]);
            g.visible = !!glowSpell || act.kind === 'sigil' && side === 'R';
            if (g.visible) {
                const col = act.kind === 'sigil' && side === 'R' ? 0x9ac8ff : glowSpell?.elem === 'frost' ? 0x9ad8ff : glowSpell?.elem === 'shock' ? 0xb8c4ff : glowSpell?.elem === 'fire' ? 0xff9a3a : glowSpell?.kind === 'heal' ? 0xffe08a : 0xb08aff;
                g.material.color.set(col);
                const k = castHere ? 1.6 : act.kind === 'sigil' ? 1.4 : 0.8;
                g.scale.setScalar(k * (0.9 + 0.15 * Math.sin(this.t * 9)));
                g.position.set(0, 0.04, -0.03);
            }
            a.pivot.position.set((x + bx + this.swayX) * 0.85, (y + by + this.swayY + breathe) * 0.8, z - 0.06);
            a.pivot.rotation.set(rx, ry, rz, 'YXZ');
        }
    }
}
