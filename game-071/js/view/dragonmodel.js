/**
 * dragonmodel.js — the dragon: a scaled body on a long spine, neck and tail chains, horned head,
 * and wing membranes skinned across arm, finger and body bones with barycentric weights so they
 * stretch and fold smoothly. Plus flight, landing, walking, breath and death animation.
 */
import * as THREE from 'three';
import { PartBuilder, M } from './rig.js';
import { lerp, clamp01, ease, v3 } from './anim.js';

const NECK = 5, TAIL = 8;

/** A subdivided, double-sided triangle whose vertices blend between three bones. */
function membrane(B, A, Bc, Cc, color, n = 6, sag = 0) {
    const pts = [A, Bc, Cc];
    const base = B.pos.length / 3;
    const verts = [];
    const c = new THREE.Color(color);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const p = [0, 1, 2].map((k) => pts[0].p[k] * w + pts[1].p[k] * u + pts[2].p[k] * v);
        // billow: push the membrane down a little in the middle, and the trailing edge in
        const bil = sag * w * u * v * 27;
        p[1] -= bil;
        const ws = {};
        ws[pts[0].b] = (ws[pts[0].b] || 0) + w; ws[pts[1].b] = (ws[pts[1].b] || 0) + u; ws[pts[2].b] = (ws[pts[2].b] || 0) + v;
        const ent = Object.entries(ws).sort((a, b) => b[1] - a[1]).slice(0, 4);
        verts.push({ p, ent });
    }
    const idx = (i, j) => { let k = 0; for (let a = 0; a < i; a++) k += n - a + 1; return k + j; };
    const tris = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
        tris.push([idx(i, j), idx(i + 1, j), idx(i, j + 1)]);
        if (j < n - i - 1) tris.push([idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]);
    }
    // face normal for the whole panel
    const e1 = new THREE.Vector3(...Bc.p).sub(new THREE.Vector3(...A.p)), e2 = new THREE.Vector3(...Cc.p).sub(new THREE.Vector3(...A.p));
    const N = e1.cross(e2).normalize();
    for (const flip of [false, true]) {
        for (const t of tris) {
            const tt = flip ? [t[0], t[2], t[1]] : t;
            for (const k of tt) {
                const vtx = verts[k];
                B.pos.push(...vtx.p); B.rest.push(...vtx.p);
                const nn = flip ? N.clone().negate() : N;
                B.nrm.push(nn.x, nn.y, nn.z);
                const jit = 0.9 + 0.1 * Math.sin(vtx.p[0] * 3 + vtx.p[2] * 2);
                B.col.push(c.r * jit, c.g * jit, c.b * jit);
                B.mat.push(M.leather);
                const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
                vtx.ent.forEach(([bn, wt], q) => { si[q] = +bn; sw[q] = wt; });
                const sum = sw.reduce((s, x) => s + x, 0) || 1;
                B.si.push(...si); B.sw.push(...sw.map((x) => x / sum));
                B.idx.push(B.idx.length);
            }
        }
    }
    void base;
}

export function buildDragon(actor, material) {
    const B = new PartBuilder();
    const col = actor.color || 0x6a5a40;
    const C = new THREE.Color(col);
    const belly = C.clone().lerp(new THREE.Color(0xd8c8a0), 0.45).getHex();
    const dark = C.clone().multiplyScalar(0.5).getHex();
    const wingCol = C.clone().lerp(new THREE.Color(0x8a5a40), 0.3).multiplyScalar(0.8).getHex();
    const horn = 0xd8ccb0;
    const eyeCol = actor.tpl === 'vyrthax' ? 0xff3010 : 0xffb030;
    B.bone('root', null, 0, 0, 0);
    B.bone('pelvis', 'root', 0, 2.3, 1.5);
    B.bone('spine', 'pelvis', 0, 2.5, 0);
    B.bone('chest', 'spine', 0, 2.6, -1.5);
    let prev = 'chest', p = [0, 2.8, -2.2];
    const neckPts = [];
    for (let i = 0; i < NECK; i++) {
        B.bone(`neck${i}`, prev, ...p);
        neckPts.push(p);
        prev = `neck${i}`;
        p = [0, p[1] + 0.42 - i * 0.04, p[2] - 0.62];
    }
    B.bone('head', prev, ...p);
    const hp = p;
    B.bone('jaw', 'head', hp[0], hp[1] - 0.15, hp[2] - 0.1);
    B.bone('snout', 'head', hp[0], hp[1] - 0.1, hp[2] - 1.5);
    prev = 'pelvis'; p = [0, 2.3, 2.6];
    const tailPts = [];
    for (let i = 0; i < TAIL; i++) {
        B.bone(`tail${i}`, prev, ...p);
        tailPts.push(p);
        prev = `tail${i}`;
        p = [0, p[1] - 0.18 + i * 0.012, p[2] + 0.95 - i * 0.03];
    }
    B.bone('tailEnd', prev, ...p);
    tailPts.push(p);
    for (const [side, sx] of [['R', 1], ['L', -1]]) {
        B.bone(`sh${side}`, 'chest', sx * 0.75, 3.0, -1.4);
        B.bone(`el${side}`, `sh${side}`, sx * 2.8, 3.25, -0.7);
        B.bone(`wr${side}`, `el${side}`, sx * 5.0, 3.35, -1.5);
        B.bone(`f1${side}`, `wr${side}`, sx * 5.0, 3.35, -1.5);
        B.bone(`f1t${side}`, `f1${side}`, sx * 8.8, 3.1, -0.6);
        B.bone(`f2${side}`, `wr${side}`, sx * 5.0, 3.35, -1.5);
        B.bone(`f2t${side}`, `f2${side}`, sx * 7.6, 2.9, 1.6);
        B.bone(`f3${side}`, `wr${side}`, sx * 5.0, 3.35, -1.5);
        B.bone(`f3t${side}`, `f3${side}`, sx * 5.4, 2.8, 3.0);
        B.bone(`th${side}`, 'pelvis', sx * 0.85, 2.15, 1.7);
        B.bone(`sn${side}`, `th${side}`, sx * 0.95, 1.15, 1.2);
        B.bone(`ft${side}`, `sn${side}`, sx * 0.95, 0.25, 1.75);
        B.bone(`toe${side}`, `ft${side}`, sx * 0.95, 0.0, 1.05);
    }
    const bi = (n) => B.byName[n];

    // ---- body
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const z = lerp(2.4, -2.0, t);
        const r = 0.75 + Math.sin(t * Math.PI) * 0.45 - (t > 0.85 ? 0.15 : 0);
        const bone = t < 0.33 ? 'pelvis' : t < 0.7 ? 'spine' : 'chest';
        const blend = t < 0.33 ? 'spine' : t < 0.7 ? (t < 0.5 ? 'pelvis' : 'chest') : 'spine';
        B.ellipsoid(bone, [0, lerp(2.3, 2.6, t), z], [r * 0.95, r * 0.88, 0.95], col, M.scale, { w: 14, h: 10, blend, blendFrom: 0.2, vary: 0.1 });
        B.ellipsoid(bone, [0, lerp(2.3, 2.6, t) - r * 0.35, z], [r * 0.85, r * 0.62, 0.9], belly, M.bone, { w: 12, h: 6, t0: Math.PI * 0.5, blend, blendFrom: 0.2 });
        // back spikes
        B.limb(bone, [0, lerp(2.3, 2.6, t) + r * 0.8, z], [0, lerp(2.3, 2.6, t) + r * 0.8 + 0.45, z + 0.3], 0.1, 0.01, horn, M.bone, { seg: 5, caps: false });
    }
    // neck
    for (let i = 0; i < NECK; i++) {
        const a = neckPts[i], b = i < NECK - 1 ? neckPts[i + 1] : hp;
        const r0 = lerp(0.62, 0.32, i / NECK), r1 = lerp(0.62, 0.32, (i + 1) / NECK);
        B.limb(`neck${i}`, a, b, r0, r1, col, M.scale, { seg: 10, blend: i < NECK - 1 ? `neck${i + 1}` : 'head', blendFrom: 0.5 });
        B.ellipsoid(`neck${i}`, [a[0], a[1] - r0 * 0.4, a[2]], [r0 * 0.75, r0 * 0.6, 0.4], belly, M.bone, { t0: Math.PI * 0.5 });
        B.limb(`neck${i}`, [a[0], a[1] + r0 * 0.85, a[2]], [a[0], a[1] + r0 * 0.85 + 0.32, a[2] + 0.25], 0.07, 0.01, horn, M.bone, { seg: 5, caps: false });
    }
    // head: skull, snout, brow ridges, horns, eyes, teeth, lower jaw
    const [hx, hy, hz] = hp;
    B.ellipsoid('head', [0, hy + 0.05, hz - 0.2], [0.42, 0.34, 0.5], col, M.scale, { w: 14, h: 10 });
    B.limb('head', [0, hy, hz - 0.45], [0, hy - 0.08, hz - 1.45], 0.3, 0.17, col, M.scale, { seg: 10, flat: 0.75 });
    for (const sx of [1, -1]) {
        B.ellipsoid('head', [sx * 0.24, hy + 0.2, hz - 0.45], [0.12, 0.08, 0.3], dark, M.scale);
        B.ellipsoid('head', [sx * 0.26, hy + 0.12, hz - 0.55], [0.06, 0.05, 0.08], eyeCol, M.glow, { w: 8, h: 6 });
        // swept horns
        let h0 = [sx * 0.25, hy + 0.25, hz - 0.1];
        for (let k = 0; k < 4; k++) { const h1 = [h0[0] + sx * 0.12, h0[1] + 0.12 - k * 0.03, h0[2] + 0.45]; B.limb('head', h0, h1, 0.11 - k * 0.025, 0.08 - k * 0.025, horn, M.bone, { seg: 6, caps: k === 0 }); h0 = h1; }
        B.limb('head', [sx * 0.35, hy - 0.05, hz - 0.05], [sx * 0.6, hy - 0.1, hz + 0.4], 0.06, 0.005, horn, M.bone, { seg: 5, caps: false });
        B.limb('jaw', [sx * 0.3, hy - 0.2, hz], [sx * 0.45, hy - 0.3, hz + 0.35], 0.05, 0.005, horn, M.bone, { seg: 5, caps: false });
        for (let k = 0; k < 5; k++) B.limb('head', [sx * 0.14, hy - 0.16, hz - 0.65 - k * 0.17], [sx * 0.14, hy - 0.28, hz - 0.67 - k * 0.17], 0.025, 0.003, 0xf0e8d0, M.bone, { seg: 4, caps: false });
        B.ellipsoid('head', [sx * 0.09, hy - 0.02, hz - 1.4], [0.03, 0.03, 0.02], 0x0a0806, M.dark);
    }
    B.limb('jaw', [0, hy - 0.22, hz - 0.15], [0, hy - 0.28, hz - 1.35], 0.24, 0.12, belly, M.bone, { seg: 9, flat: 0.55 });
    B.ellipsoid('jaw', [0, hy - 0.2, hz - 0.8], [0.15, 0.04, 0.45], 0x6a1a1a, M.skin);   // tongue / mouth
    // tail
    for (let i = 0; i < TAIL; i++) {
        const a = tailPts[i], b = tailPts[i + 1];
        const r0 = lerp(0.72, 0.06, i / TAIL), r1 = lerp(0.72, 0.06, (i + 1) / TAIL);
        B.limb(`tail${i}`, a, b, r0, r1, col, M.scale, { seg: 10, blend: i < TAIL - 1 ? `tail${i + 1}` : 'tailEnd', blendFrom: 0.5 });
        B.limb(`tail${i}`, [a[0], a[1] + r0 * 0.85, a[2]], [a[0], a[1] + r0 * 0.85 + 0.3 - i * 0.03, a[2] + 0.25], 0.08 - i * 0.008, 0.01, horn, M.bone, { seg: 5, caps: false });
    }
    B.ellipsoid('tailEnd', tailPts[TAIL], [0.25, 0.04, 0.5], dark, M.bone);   // tail blade
    // legs
    for (const [side, sx] of [['R', 1], ['L', -1]]) {
        B.limb(`th${side}`, [sx * 0.85, 2.15, 1.7], [sx * 0.95, 1.15, 1.2], 0.48, 0.28, col, M.scale, { seg: 10, bulge: 0.2 });
        B.limb(`sn${side}`, [sx * 0.95, 1.15, 1.2], [sx * 0.95, 0.25, 1.75], 0.24, 0.16, col, M.scale, { seg: 8 });
        B.ellipsoid(`ft${side}`, [sx * 0.95, 0.15, 1.45], [0.22, 0.14, 0.42], col, M.scale);
        for (let k = -1; k <= 1; k++) B.limb(`ft${side}`, [sx * 0.95 + k * 0.12, 0.12, 1.1], [sx * 0.95 + k * 0.14, 0.0, 0.85], 0.05, 0.01, 0x1a1612, M.bone, { seg: 5, caps: false });
        // wing arm
        B.limb(`sh${side}`, [sx * 0.75, 3.0, -1.4], [sx * 2.8, 3.25, -0.7], 0.32, 0.2, col, M.scale, { seg: 9 });
        B.limb(`el${side}`, [sx * 2.8, 3.25, -0.7], [sx * 5.0, 3.35, -1.5], 0.2, 0.13, col, M.scale, { seg: 8 });
        B.ellipsoid(`wr${side}`, [sx * 5.0, 3.35, -1.5], [0.17, 0.16, 0.17], col, M.scale);
        B.limb(`wr${side}`, [sx * 5.0, 3.35, -1.5], [sx * 5.1, 2.95, -1.9], 0.08, 0.01, horn, M.bone, { seg: 5, caps: false });   // thumb claw
        for (const f of ['f1', 'f2', 'f3']) {
            const a = B.bones[bi(`${f}${side}`)].pos, b = B.bones[bi(`${f}t${side}`)].pos;
            B.limb(`${f}${side}`, a, b, 0.09, 0.03, dark, M.bone, { seg: 6, blend: `${f}t${side}`, blendFrom: 0.6 });
        }
        // membrane panels (corner = { p, b }, b = bone index)
        const P = (n) => ({ p: B.bones[bi(n)].pos, b: bi(n) });
        const wr = P(`wr${side}`), el = P(`el${side}`), sh = P(`sh${side}`);
        const f1 = P(`f1t${side}`), f2 = P(`f2t${side}`), f3 = P(`f3t${side}`);
        const body1 = { p: [sx * 0.7, 2.75, 0.2], b: bi('spine') };
        const body2 = { p: [sx * 0.75, 2.45, 1.7], b: bi('pelvis') };
        const tw = (sx > 0) ? (a, b, c) => [a, b, c] : (a, b, c) => [a, c, b];
        membrane(B, ...tw(wr, f2, f1), wingCol, 7, 0.25);
        membrane(B, ...tw(wr, f3, f2), wingCol, 7, 0.25);
        membrane(B, ...tw(el, f3, wr), wingCol, 6, 0.15);
        membrane(B, ...tw(el, body1, f3), wingCol, 6, 0.2);
        membrane(B, ...tw(body1, body2, f3), wingCol, 5, 0.15);
        membrane(B, ...tw(sh, body1, el), wingCol, 4, 0.05);
    }
    const mesh = B.finish(material);
    mesh.userData.kind = 'dragon';
    return mesh;
}

// ------------------------------------------------------------------ animation
export function dragonState() { return { flap: Math.random() * 6, phase: 0, speed: 0, fly: 1, fall: 0, pitch: 0, bank: 0, lastYaw: null, idleT: 0, breathe: 0, jaw: 0, vy: 0 }; }

export function animateDragon(P, st, ctx) {
    const a = ctx.a, dt = ctx.dt;
    P.reset();
    st.idleT += dt;
    st.speed = lerp(st.speed, ctx.speed, 1 - Math.exp(-dt * 4));
    st.vy = lerp(st.vy, ctx.vy || 0, 1 - Math.exp(-dt * 3));
    st.fly = lerp(st.fly, a.fly && !a.dead ? 1 : 0, 1 - Math.exp(-dt * 2.5));
    st.fall = a.dead ? Math.min(1, st.fall + dt * 0.8) : 0;
    // banking from yaw rate
    if (st.lastYaw == null) st.lastYaw = a.yaw;
    let dy = a.yaw - st.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    st.lastYaw = a.yaw;
    st.bank = lerp(st.bank, THREE.MathUtils.clamp(-dy / Math.max(dt, 1e-3) * 0.5, -0.7, 0.7) * st.fly, 1 - Math.exp(-dt * 3));
    const hover = a.hovering ? 1 : clamp01(1 - st.speed / 10) * st.fly;
    const glide = clamp01((st.speed - 14) / 6) * st.fly * (st.vy < 1 ? 1 : 0.3);
    st.pitch = lerp(st.pitch, (THREE.MathUtils.clamp(-st.vy * 0.05, -0.5, 0.5) - hover * 0.35) * st.fly, 1 - Math.exp(-dt * 2));
    // flap: faster when hovering or climbing, held out while gliding
    const rate = (1.25 + hover * 0.8 + Math.max(0, st.vy) * 0.05) * (1 - glide * 0.85);
    st.flap += dt * rate * Math.PI * 2;
    const fl = Math.sin(st.flap);
    const breath = a.breath > 0;
    st.jaw = lerp(st.jaw, breath ? 0.75 : (a.act?.kind === 'attack' ? 0.6 : ctx.roar ? 0.8 : 0.05 + Math.max(0, Math.sin(st.idleT * 0.4)) * 0.05), 1 - Math.exp(-dt * 10));

    // ---- root: pitch and bank in flight, rest on the ground
    const root = P.b.root;
    root.rotation.set(st.pitch, 0, st.bank, 'YXZ');
    root.position.set(0, st.fly * (fl * 0.25 * (1 - glide)) + (1 - st.fly) * 0, 0);
    P.sync('root');
    P.syncFrom('root');
    // spine undulation
    const und = Math.sin(st.idleT * (1 + st.fly) + 1) * 0.04;
    P.rot('pelvis', 0, und, 0);
    P.rot('spine', -st.fly * 0.02, und, 0);
    P.rot('chest', st.fly * 0.05 - (1 - st.fly) * 0.05, und, 0);

    // ---- neck and head: aim at the target (breath aims precisely)
    const lookY = THREE.MathUtils.clamp(ctx.lookYaw || 0, -1.2, 1.2);
    const lookP = THREE.MathUtils.clamp(ctx.lookPitch || 0, -0.9, 0.6);
    for (let i = 0; i < NECK; i++) {
        const w = (i + 1) / NECK;
        const sway = Math.sin(st.idleT * 1.1 - i * 0.5) * 0.05;
        const lunge = a.act?.kind === 'attack' ? Math.sin(clamp01(a.act.t / 0.5) * Math.PI) * 0.12 : 0;
        P.rot(`neck${i}`, -lookP * 0.22 + (st.fly ? -st.pitch * 0.2 : 0) + lunge + (breath ? 0.06 : 0), lookY * 0.2 + sway, 0);
        void w;
    }
    P.rot('head', -lookP * 0.15 + (breath ? -0.15 : 0), lookY * 0.1, 0);
    P.rot('jaw', st.jaw, 0, 0);

    // ---- tail: trails in flight, sweeps on the ground
    for (let i = 0; i < TAIL; i++) {
        const sw = Math.sin(st.idleT * 1.4 - i * 0.6) * (0.06 + (1 - st.fly) * 0.05) - st.bank * 0.06;
        const tailAttack = a.act?.kind === 'bash' ? Math.sin(clamp01(a.act.t / 0.6) * Math.PI) * 0.25 : 0;
        P.rot(`tail${i}`, st.fly * (0.04 + st.pitch * 0.1) - (1 - st.fly) * (i < 2 ? 0.06 : -0.03), sw + tailAttack, 0);
    }

    // ---- wings: flight is a flap about the body axis; on the ground the wing-arms fold into front legs
    const folded = 1 - st.fly;
    st.phase += (st.speed * dt) / 2.2 * Math.PI;
    const mv = clamp01(st.speed / 1.5) * folded;
    for (const side of ['R', 'L']) {
        const sx = side === 'R' ? 1 : -1;
        const up = fl * 0.75 * (1 - glide) + glide * 0.08;
        P.rot(`sh${side}`, 0, sx * fl * 0.15 * (1 - glide), sx * up);
        P.rot(`el${side}`, 0, -sx * fl * 0.12, -sx * up * 0.4);
        P.rot(`wr${side}`, 0, sx * 0.08 * fl, -sx * up * 0.35);
        if (folded > 0.01) {
            // walk on the wrist: two-bone IK from shoulder to a foot-fall ahead of the shoulder
            const fp = st.phase + (side === 'R' ? Math.PI : 0);
            const along = -Math.cos(fp) * 0.9 * mv, lift = Math.max(0, Math.sin(fp)) * 0.45 * mv;
            const g = ctx.ground ? ctx.ground(sx * 2.1, -1.3 + along) : 0;
            const flightWrist = P.mp[`wr${side}`].clone();
            const T = v3(sx * 2.1, 0.12 + lift + g, -1.3 + along).lerp(flightWrist, 1 - folded);
            P.ik(`sh${side}`, `el${side}`, `wr${side}`, T, v3(sx * 0.6, 0.7, 0.6));
            // fingers fold back and up along the flank like a closed fan
            const dirs = [[0.15, 0.75, 0.65], [0.1, 0.6, 0.8], [0.05, 0.45, 0.9]];
            ['f1', 'f2', 'f3'].forEach((f, k) => {
                const cur = P.mp[`${f}t${side}`].clone().sub(P.mp[`${f}${side}`]).normalize();
                const want = v3(sx * dirs[k][0], dirs[k][1], dirs[k][2]).normalize();
                P.sync(`${f}${side}`);
                P.aim(`${f}${side}`, `${f}t${side}`, cur.lerp(want, folded).normalize());
                P.sync(`${f}t${side}`);
            });
        }
        if (st.fall > 0) { const f = ease(st.fall); P.rot(`sh${side}`, 0, sx * 0.3 * f, sx * -0.35 * f); }
    }
    // ---- hind legs
    for (const side of ['R', 'L']) {
        const sx = side === 'R' ? 1 : -1;
        const fp = st.phase + (side === 'R' ? 0 : Math.PI);
        const along = -Math.cos(fp) * 1.0 * mv, lift = Math.max(0, Math.sin(fp)) * 0.4 * mv;
        const g = folded > 0.01 && ctx.ground ? ctx.ground(sx * 0.95, 1.55 + along) : 0;
        const T = v3(sx * 0.95, 0.25 + lift + g, 1.6 + along).lerp(v3(sx * 0.95, 1.1, 2.5), st.fly);
        P.ik(`th${side}`, `sn${side}`, `ft${side}`, T, v3(0, 0, -1));
        P.orient(`ft${side}`, v3(0, 0, -1), v3(0, 1, 0));
    }
    // ---- death: slump to the ground, neck limp
    if (st.fall > 0) {
        const f = ease(st.fall);
        P.b.pelvis.position.y -= f * 1.3; P.syncFrom('pelvis');
        for (let i = 0; i < NECK; i++) P.rot(`neck${i}`, f * 0.18, f * 0.15, 0);
        P.rot('jaw', 0.35 * f, 0, 0);
        root.rotation.set(0, 0, f * 0.25);
    }
}
