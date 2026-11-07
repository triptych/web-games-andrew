// Procedural people for the chair across the table: a robe, arms, a head with a face that has moods, hair, a hat.
// Everything is a handful of primitives under one group. Origin is the floor beneath the chair; +z is the way
// they face. buildPerson(look) returns { group, update(dt, t, st) }.

import * as THREE from 'three';

const col = (c) => new THREE.Color(c);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.75, metalness: 0, ...o });
const SEAT_DROP = 0.30;                   // a seated person is this much lower than a standing one

function limb(mesh, a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(mesh.userData.r, len, mesh.userData.r);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

const MOODS = {
    //        inner-brow, brow-height, mouth-curve, mouth-open
    n: [0.0, 0.0, 0.15, 0.0],
    h: [0.0, 0.008, 0.95, 0.0],
    s: [0.34, -0.002, -0.75, 0.0],
    w: [0.26, 0.006, -0.25, 0.0],
    a: [-0.32, -0.004, -0.1, 0.0],
    l: [0.1, 0.004, 0.6, 0.0],
    x: [0.0, 0.02, 0.0, 0.7],
};

export function buildPerson(look) {
    const g = new THREE.Group();
    const skin = std(look.skin, { roughness: 0.55 });
    const robe = std(look.robe, { roughness: 0.8 });
    const trim = std(look.trim || '#e8c14a', { roughness: 0.35, metalness: 0.6 });
    const hairM = std(look.hair || '#222222', { roughness: 0.7 });
    const hatM = std(look.hatc || look.robe, { roughness: 0.8 });
    const dark = std('#1a1014', { roughness: 0.3 });

    const sx = { slim: 0.9, broad: 1.22, small: 0.92, tall: 1.0 }[look.body] ?? 1;
    const sy = { slim: 1, broad: 1, small: 0.9, tall: 1.1 }[look.body] ?? 1;
    const root = new THREE.Group();            // scaled for build
    root.scale.set(sx, sy, sx);
    g.add(root);
    const body = new THREE.Group();            // dropped when seated
    root.add(body);

    // torso: a lathe robe, flared at the floor, narrow at the waist, shoulders at 1.40
    const prof = [[0.0, 0], [0.42, 0], [0.40, 0.18], [0.30, 0.55], [0.22, 0.95], [0.25, 1.22], [0.23, 1.38], [0.12, 1.45], [0.0, 1.47]].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), robe);
    torso.scale.z = 0.72;
    body.add(torso);
    // a sash and a collar in the trim colour
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.022, 8, 28), trim);
    sash.rotation.x = Math.PI / 2; sash.position.y = 0.98; sash.scale.y = 0.72;
    body.add(sash);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.02, 8, 24), trim);
    collar.rotation.x = Math.PI / 2; collar.position.y = 1.44;
    body.add(collar);
    for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), robe);
        sh.position.set(s * 0.225, 1.38, 0); sh.scale.set(1, 0.85, 1);
        body.add(sh);
    }

    // arms: one cylinder each from the shoulder to the hand, plus a cuff and a hand
    const arms = [];
    for (const s of [-1, 1]) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 1, 10), robe);
        a.userData.r = 0.062;
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14), trim);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), skin);
        hand.scale.set(1, 0.55, 1.25);
        body.add(a, cuff, hand);
        arms.push({ s, a, cuff, hand });
    }

    // head
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0.01);
    body.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 10), skin);
    neck.position.set(0, 1.5, 0);
    body.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), skin);
    skull.scale.set(0.93, 1.1, 1.0);
    head.add(skull);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), skin);
        ear.position.set(s * 0.108, -0.005, 0); ear.scale.set(0.5, 1, 0.8);
        head.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), std(look.skin, { roughness: 0.5 }));
    nose.position.set(0, -0.012, 0.115); nose.scale.set(0.9, 1.1, 1.2);
    head.add(nose);
    const eyes = [], brows = [];
    const white = std('#f6f2ee', { roughness: 0.3 });
    for (const s of [-1, 1]) {
        const eg = new THREE.Group();
        eg.position.set(s * 0.042, 0.022, 0.096);
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), white); w.scale.set(1.1, 0.9, 0.7);
        const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 8, 6), dark); ir.position.z = 0.011;
        eg.add(w, ir);
        head.add(eg); eyes.push(eg);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.009, 0.012), hairM);
        b.position.set(s * 0.045, 0.058, 0.1);
        head.add(b); brows.push(b);
    }
    // mouth: a smile arc (curve scales from a smile to a frown) and a dark opening
    const mouth = new THREE.Group();
    mouth.position.set(0, -0.058, 0.098);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 6, 14, Math.PI), std('#8a3a3a', { roughness: 0.4 }));
    lip.rotation.z = Math.PI;                   // a smile when scale.y is positive
    mouth.add(lip);
    const gape = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), std('#3a0a12'));
    gape.scale.set(1, 0.01, 0.4); gape.position.set(0, -0.006, -0.004);
    mouth.add(gape);
    head.add(mouth);

    // hair and a beard
    const hs = look.hs || 'short';
    const cap = (r = 0.122, a = 0.41) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI * a), hairM); m.rotation.x = -0.28; m.position.y = 0.006; return m; };
    if (hs !== 'bald' && hs !== 'hood') head.add(cap());
    if (hs === 'long') {
        const back = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.15, 0.42, 16, 1, true), hairM);
        back.position.set(0, -0.14, -0.045); back.scale.z = 0.8; back.material = hairM.clone(); back.material.side = THREE.DoubleSide;
        head.add(back);
    } else if (hs === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), hairM);
        bun.position.set(0, 0.105, -0.085); head.add(bun);
    } else if (hs === 'curly') {
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2, c = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), hairM);
            c.position.set(Math.cos(a) * 0.11, 0.055 + (i % 2) * 0.03, Math.sin(a) * 0.1 - 0.02); head.add(c);
        }
    }
    if (look.beard) {
        const bd = new THREE.Mesh(new THREE.SphereGeometry(0.098, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hairM);
        bd.position.set(0, -0.015, 0.02); bd.scale.set(1, 1.15, 1.02); head.add(bd);
    }
    if (look.glasses) {
        for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0035, 6, 16), trim); r.position.set(s * 0.045, 0.022, 0.113); head.add(r); }
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), trim); br.position.set(0, 0.026, 0.115); head.add(br);
    }

    // hats
    const hat = look.hat;
    if (hat === 'cap') {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.128, 0.06, 18), hatM); c.position.y = 0.095;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 14, 1, false, -Math.PI / 2, Math.PI), hatM); br.position.set(0, 0.075, 0.1); br.rotation.x = 0.12;
        head.add(c, br);
    } else if (hat === 'wide') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.012, 28), hatM); brim.position.y = 0.075; brim.rotation.z = 0.08;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.13, 18), hatM); crown.position.y = 0.14;
        head.add(brim, crown);
        if (look.feather) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std('#2fe0d0', { emissive: col('#106a64'), roughness: 0.4 }));
            f.scale.set(0.3, 1.8, 0.5); f.position.set(0.1, 0.22, 0.02); f.rotation.z = -0.5; head.add(f);
        }
    } else if (hat === 'kerchief') {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.128, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), hatM); k.rotation.x = -0.3; k.position.y = 0.012;
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hatM); knot.position.set(0, 0.0, -0.13);
        head.add(k, knot);
    } else if (hat === 'helm') {
        const m = std('#aab4c8', { metalness: 0.75, roughness: 0.3 });
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.47), m); h.rotation.x = -0.15; h.position.y = 0.014;
        const nb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.1, 0.012), m); nb.position.set(0, -0.01, 0.12);
        head.add(h, nb);
    } else if (hat === 'veil') {
        const hh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), hatM); hh.position.y = 0.11; head.add(hh);
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.32, 20, 1, true), new THREE.MeshStandardMaterial({ color: col(look.hatc), transparent: true, opacity: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
        v.position.y = -0.06; v.scale.z = 0.95; head.add(v);
    } else if (hat === 'hood') {
        const open = 0.55, hm = new THREE.MeshStandardMaterial({ color: col(look.robe), roughness: 0.9, side: THREE.DoubleSide });
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 16, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.82), hm);
        hd.position.set(0, 0.0, -0.02); hd.scale.set(1.02, 1.1, 1.1);
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.2, 20, 1, true), hm); cowl.position.set(0, -0.12, -0.03);
        head.add(hd, cowl);
    } else if (hat === 'circlet') {
        const ci = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.008, 6, 28), trim); ci.rotation.x = Math.PI / 2; ci.position.y = 0.065; ci.rotation.z = 0;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), std('#ff2e5b', { emissive: col('#a0102a'), roughness: 0.2 }));
        gem.position.set(0, 0.075, 0.118);
        head.add(ci, gem);
    }

    // state, for the animation
    const st = { yaw: 0, pitch: 0, blink: 3, blinkT: 0, mood: 'n', brow: 0, bh: 0, curve: 0.15, open: 0, seat: 0, tmp: new THREE.Vector3(), phase: Math.random() * 6 };
    const sh = { L: new THREE.Vector3(), R: new THREE.Vector3() };
    const rest = (s, seat) => {
        // seated: both hands rest on the table in front; standing: they hang
        const hang = new THREE.Vector3(s * 0.3, 0.86, 0.04);
        const sit = new THREE.Vector3(s * 0.2, 1.14, 0.5);
        return hang.lerp(sit, seat);
    };
    const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();

    /** s: { mood, talking, seat 0..1, walk 0..1 (bob), look: world Vector3 } */
    function update(dt, t, s) {
        st.seat += (s.seat - st.seat) * Math.min(1, dt * 6);
        body.position.y = -SEAT_DROP * st.seat;
        // mood
        const m = MOODS[s.mood] || MOODS.n;
        const k = Math.min(1, dt * 8);
        st.brow += (m[0] - st.brow) * k; st.bh += (m[1] - st.bh) * k; st.curve += (m[2] - st.curve) * k;
        let open = m[3];
        if (s.talking) open = Math.max(open, 0.15 + Math.abs(Math.sin(t * 13 + st.phase) * Math.sin(t * 5.3)) * 0.6);
        st.open += (open - st.open) * Math.min(1, dt * 18);
        brows[0].rotation.z = st.brow; brows[1].rotation.z = -st.brow;
        brows[0].position.y = brows[1].position.y = 0.058 + st.bh;
        mouth.scale.y = st.curve;
        gape.scale.y = 0.01 + st.open * 1.1;
        // blink
        st.blinkT += dt;
        let bl = 1;
        if (st.blinkT > st.blink) { const u = (st.blinkT - st.blink) / 0.14; bl = u < 1 ? Math.abs(1 - u * 2) : 1; if (u >= 1) { st.blinkT = 0; st.blink = 2.5 + Math.random() * 3; } }
        for (const e of eyes) e.scale.y = Math.max(0.08, bl);
        // breathing and a gentle sway; a walker bobs
        const walk = s.walk || 0;
        const br = Math.sin(t * 1.7 + st.phase);
        torso.scale.y = 1 + br * 0.006;
        body.position.y += Math.abs(Math.sin(t * 7)) * 0.03 * walk;
        root.rotation.z = Math.sin(t * 7) * 0.035 * walk;
        head.position.y = 1.62 + br * 0.004 + (s.talking ? Math.sin(t * 9 + st.phase) * 0.0015 : 0);
        // head turns toward the seer
        if (s.look) {
            head.parent.updateWorldMatrix(true, false);
            tv.copy(s.look); head.worldToLocal(tv);                       // direction in head space
            let wantY = Math.atan2(tv.x, tv.z) * 0.55, wantP = -Math.atan2(tv.y, Math.hypot(tv.x, tv.z)) * 0.5;
            wantY = Math.max(-0.5, Math.min(0.5, wantY)); wantP = Math.max(-0.25, Math.min(0.3, wantP));
            if (walk) { wantY *= 0.3; wantP = 0; }
            head.rotation.y += (wantY - head.rotation.y) * Math.min(1, dt * 3);
            head.rotation.x += (wantP - head.rotation.x) * Math.min(1, dt * 3);
        }
        // arms
        for (let i = 0; i < 2; i++) {
            const A = arms[i];
            tv.set(A.s * 0.225, 1.38, 0.0);
            tv2.copy(rest(A.s, st.seat));
            tv2.x += Math.sin(t * 1.3 + i) * 0.004 * st.seat;
            if (walk) tv2.z += Math.sin(t * 7 + i * Math.PI) * 0.12 * walk * (1 - st.seat);
            if (s.talking && st.seat > 0.5) { tv2.y += Math.max(0, Math.sin(t * 2.2 + i * 2)) * 0.06; tv2.z -= Math.max(0, Math.sin(t * 2.2 + i * 2)) * 0.05; }
            limb(A.a, tv, tv2);
            A.hand.position.copy(tv2);
            A.cuff.position.copy(tv2).lerp(tv, 0.12);
            A.cuff.quaternion.copy(A.a.quaternion);
            A.cuff.rotateX(Math.PI / 2);
        }
    }

    return { group: g, update, head, setSeat: (v) => { st.seat = v; }, dispose() { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }); } };
}
