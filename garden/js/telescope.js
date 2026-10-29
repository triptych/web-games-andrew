// The Great Telescope under the Star Dome: a brass refractor ten metres long on
// a fork mount, on a geared turret, with cogs, setting circles, gauges, a
// finder scope, counterweights and pistons, pointed up through the dome's slit.
// Its eyepiece hangs at eye height; look through it and scope.js takes over.
// Built at the centre of the top rotunda (the hub frame is the floor's own).

import * as THREE from 'three';
import { lathe, gearShape } from './architecture.js';
import { TAU, damp } from './util.js';
import { canvasTex, glow, motes, emissiveMat, plaqueMesh } from './tower-kit.js';

const V3 = THREE.Vector3;
export const SCOPE_AZ = -110 * (Math.PI / 180);   // the way the telescope points (and the dome's slit faces)
const EL = 50 * (Math.PI / 180);

function gauge(label, color) {
    return canvasTex(128, 128, (x, w) => {
        const c = w / 2;
        x.fillStyle = '#f3e6c4';
        x.beginPath();
        x.arc(c, c, c, 0, TAU);
        x.fill();
        x.strokeStyle = '#3a2a1a';
        x.lineWidth = 3;
        x.beginPath();
        x.arc(c, c, c - 6, Math.PI * 0.75, Math.PI * 2.25);
        x.stroke();
        for (let k = 0; k <= 10; k++) {
            const a = Math.PI * 0.75 + (k / 10) * Math.PI * 1.5;
            x.beginPath();
            x.moveTo(c + Math.cos(a) * (c - 8), c + Math.sin(a) * (c - 8));
            x.lineTo(c + Math.cos(a) * (c - 18), c + Math.sin(a) * (c - 18));
            x.stroke();
        }
        x.strokeStyle = color;
        x.lineWidth = 6;
        x.beginPath();
        x.arc(c, c, c - 12, Math.PI * 1.9, Math.PI * 2.25);
        x.stroke();
        x.fillStyle = '#3a2a1a';
        x.font = 'italic 14px Georgia, serif';
        x.textAlign = 'center';
        x.fillText(label, c, c + 34);
    });
}

export function buildTelescope(ctx) {
    const { audio } = ctx;
    const dir = new V3(Math.cos(EL) * Math.sin(SCOPE_AZ), Math.sin(EL), Math.cos(EL) * Math.cos(SCOPE_AZ));
    const P = new V3(0, 4.6, 0);   // the declination axis
    const UP = 6.6, DOWN = 3.6;    // tube lengths either side of the axis
    const eye = P.clone().addScaledVector(dir, -DOWN - 0.3);
    const back = new V3(-Math.sin(SCOPE_AZ), 0, -Math.cos(SCOPE_AZ));   // horizontal, toward the eyepiece side

    // ---- the turret: a stepped drum with a toothed ring, turning on rollers
    ctx.geo('stone', lathe([[0, 0], [3.0, 0], [3.0, 0.25], [2.75, 0.3], [2.75, 0.55], [0, 0.55]], 64), 0, 0, 0);
    const turret = new THREE.Group();
    turret.position.y = 0.55;
    turret.rotation.y = SCOPE_AZ;
    ctx.add(turret);
    const brass = ctx.mats.brass, gold = ctx.mats.gold, iron = ctx.mats.iron, copper = ctx.mats.copper;
    const enamel = new THREE.MeshStandardMaterial({ color: 0x1a2a6a, roughness: 0.25, metalness: 0.6 });
    turret.add(new THREE.Mesh(lathe([[0, 0], [2.4, 0], [2.45, 0.1], [2.4, 0.42], [2.2, 0.5], [0, 0.5]], 64), iron));
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(2.5, 72, 0.1, 2.3), { depth: 0.18, bevelEnabled: false, curveSegments: 2 }).rotateX(-Math.PI / 2), brass);
    ring.position.y = 0.08;
    turret.add(ring);
    // the fork: two great arms up to the axis
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, P.y - 0.9, 1.0), enamel);
        arm.position.set(s * 0.85, (P.y - 0.55) / 2 + 0.25, 0);
        turret.add(arm);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 1.04), gold);
        for (const y of [0.9, 2.2, P.y - 0.9]) {
            const t2 = trim.clone();
            t2.position.set(s * 0.85, y, 0);
            turret.add(t2);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 32).rotateZ(Math.PI / 2), gold);
        hub.position.set(s * 0.85, P.y - 0.55, 0);
        turret.add(hub);
    }
    // the elevation gear: a big sector on the left arm, turning with the tube
    const elevG = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(1.3, 40, 0.08, 0.3), { depth: 0.06, bevelEnabled: false, curveSegments: 3 }).rotateY(Math.PI / 2), brass);
    elevG.position.set(-1.06, P.y - 0.55, 0);
    turret.add(elevG);

    // ---- the tube
    const tube = new THREE.Group();
    tube.position.set(0, P.y - 0.55, 0);
    tube.rotation.x = Math.PI / 2 - EL;   // tilt the +y axis forward to the elevation
    turret.add(tube);
    // along +y from -DOWN to +UP
    const seg = (r0, r1, y0, y1, mat, segs = 40) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, segs, 1, true), mat);
        m.position.y = (y0 + y1) / 2;
        tube.add(m);
        return m;
    };
    seg(0.42, 0.5, -DOWN + 0.6, 0, enamel);
    seg(0.5, 0.62, 0, UP - 1.3, enamel);
    seg(0.68, 0.68, UP - 1.3, UP, brass);
    for (const y of [-DOWN + 0.6, -1.5, 0, 1.6, 3.2, UP - 1.3, UP]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.47 + Math.max(0, y) * 0.022, 0.05, 8, 40).rotateX(Math.PI / 2), gold);
        band.position.y = y;
        tube.add(band);
    }
    // the objective: a great lens with starlight in it
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40).rotateX(-Math.PI / 2), emissiveMat(0x6a9aff, 1.4, { color: 0x6a9aff, metalness: 0.4 }));
    lens.position.y = UP - 0.25;
    tube.add(lens);
    const lensGlow = glow(0x8ab8ff, 2.4, 0.35);
    lensGlow.position.y = UP - 0.1;
    tube.add(lensGlow);
    // the eyepiece end: a focusing drum, a diagonal and an eyecup
    seg(0.3, 0.42, -DOWN + 0.25, -DOWN + 0.6, brass);
    const focus = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 24), copper);
    focus.position.y = -DOWN + 0.12;
    tube.add(focus);
    for (let k = 0; k < 12; k++) {
        const knurl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.03), gold);
        const a = (k / 12) * TAU;
        knurl.position.set(Math.cos(a) * 0.225, 0, Math.sin(a) * 0.225);
        focus.add(knurl);
    }
    // the eyecup sticks straight out of the tube's lower end
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.32, 16), iron);
    cup.position.set(0, -DOWN - 0.12, 0);
    tube.add(cup);
    const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 16).rotateX(Math.PI / 2), gold);
    cupRim.position.set(0, -DOWN - 0.28, 0);
    tube.add(cupRim);
    const eyeGlow = glow(0x9ad8ff, 0.4, 0.8);
    eyeGlow.position.set(0, -DOWN - 0.3, 0);
    tube.add(eyeGlow);
    // a finder scope and a counterweight bar
    const finder = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 16), brass);
    finder.position.set(0.62, 1.2, 0.3);
    tube.add(finder);
    for (const y of [0.4, 2.0]) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), gold);
        bracket.position.set(0.52, y, 0.24);
        tube.add(bracket);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10).rotateX(Math.PI / 2), iron);
    bar.position.set(0, -0.6, -1.2);
    tube.add(bar);
    for (const z of [-2.0, -2.35]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24).rotateX(Math.PI / 2), iron);
        w.position.set(0, -0.6, z);
        tube.add(w);
    }
    // a setting circle that turns, an orrery of little rings riding the tube
    const circle = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.8, 36, 0.05, 0.55), { depth: 0.05, bevelEnabled: false, curveSegments: 3 }).rotateX(Math.PI / 2), gold);
    circle.position.y = 1.0;
    tube.add(circle);
    const rings = [0.95, 1.1].map((R, i) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 6, 48), i ? copper : gold);
        r.position.y = 2.4;
        tube.add(r);
        return r;
    });

    // ---- cogs, pistons, gauges and pipes round the base
    const cogs = [];
    const cog = (R, teeth, x, y, z, ry, speed, mat = brass) => {
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(R, teeth, R * 0.16, R * 0.2), { depth: 0.08, bevelEnabled: false, curveSegments: 3 }), mat);
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = ry;
        g.add(m);
        turret.add(g);
        cogs.push({ m, speed });
    };
    cog(0.55, 14, 1.12, 1.5, 0.2, Math.PI / 2, 1.0);
    cog(0.32, 9, 1.12, 2.15, -0.25, Math.PI / 2, -1.7);
    cog(0.24, 7, 1.12, 1.0, -0.42, Math.PI / 2, 2.3, copper);
    cog(0.5, 13, -1.12, 1.4, 0.35, Math.PI / 2, -1.1);
    cog(0.28, 8, -1.12, 2.05, -0.1, Math.PI / 2, 2.0, copper);
    cog(0.34, 10, 0, 0.9, -0.62, 0, 1.5);
    cog(0.2, 6, 0.4, 1.3, -0.62, 0, -2.5, copper);
    const pistons = [];
    for (const s of [-1, 1]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 14), copper);
        cyl.position.set(s * 0.5, 1.0, 0.55);
        turret.add(cyl);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), ctx.mats.silver);
        rod.position.set(s * 0.5, 1.6, 0.55);
        turret.add(rod);
        pistons.push({ rod, ph: s > 0 ? 0 : Math.PI });
    }
    const needles = [];
    [['Focus', '#e8463c'], ['Wonder', '#5cd86a'], ['Steam', '#3fb8e8']].forEach(([lab, col], i) => {
        const g = new THREE.Group();
        g.position.set(0.6 - i * 0.6, 0.75, -1.3);
        g.rotation.set(-0.3, Math.PI, 0, 'YXZ');
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), new THREE.MeshStandardMaterial({ map: gauge(lab, col), roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.15 }));
        face.material.emissiveMap = face.material.map;
        g.add(face);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 28), gold);
        g.add(rim);
        const n = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.01).translate(0, 0.07, 0.01), ctx.mats.black);
        g.add(n);
        turret.add(g);
        needles.push({ n, ph: i * 2 });
    });
    for (const s of [-1, 1]) {
        const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(s * 2.2, 0.5, 0.6), new V3(s * 1.8, 1.4, 0.8), new V3(s * 1.2, 2.2, 0.6), new V3(s * 1.0, 3.0, 0.2)]), 20, 0.05, 8, false), copper);
        turret.add(pipe);
    }
    // a little railed platform with a stool at the eyepiece
    const plat = back.clone().multiplyScalar(2.95);
    ctx.geo('iron', new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), plat.x, 0.04, plat.z);
    ctx.geo('velvet', new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), plat.x + back.x * 0.55, 0.62, plat.z + back.z * 0.55);
    ctx.geo('brass', new THREE.CylinderGeometry(0.04, 0.06, 0.58, 8), plat.x + back.x * 0.55, 0.29, plat.z + back.z * 0.55);
    const sign = plaqueMesh('The Great Telescope', 'Look through the eyepiece', 0.8);
    sign.position.set(Math.sin(SCOPE_AZ + 0.55) * 2.75, 0.4, Math.cos(SCOPE_AZ + 0.55) * 2.75);
    sign.rotation.y = SCOPE_AZ + 0.55;
    ctx.add(sign);
    ctx.collide(0, 0, 2.62);

    // steam that puffs from a valve now and then
    const steam = motes(30, 0xffffff, 0.35, 0.35);
    turret.add(steam);
    const puffs = Array.from({ length: 30 }, () => ({ p: new V3(0, -10, 0), life: 0 }));
    let nextPuff = 2;

    const eyeW = eye.clone();   // in floor coordinates
    const stand = { x: eye.x + back.x * 0.75, z: eye.z + back.z * 0.75 };
    stand.yaw = Math.atan2(-(eye.x - stand.x), -(eye.z - stand.z));
    stand.pitch = Math.atan2(eye.y - 1.65, 0.75) * 0.6;
    const hitOpts = {
        label: 'The Great Telescope · look through the eyepiece',
        range: 1.6,
        stand: { x: stand.x, z: stand.z },
        onClick: () => ctx.tower.onScope?.(),
    };
    ctx.proxy(0.9, 0.9, 0.9, eye.x, eye.y, eye.z, hitOpts);
    // the whole tube can be clicked too, from anywhere on the floor
    for (const m of tube.children.slice(0, 3)) ctx.hit(m, { ...hitOpts });

    let busy = 0;
    return {
        stand,
        eye: eyeW,
        dir,
        setBusy(on) {
            busy = on ? 1 : 0;
        },
        update(dt, t) {
            const sp = 1 + busy * 6;
            for (const c of cogs) c.m.rotation.z += dt * c.speed * 0.4 * sp;
            ring.rotation.y += dt * 0.02 * sp;
            elevG.rotation.x += dt * 0.05 * sp;
            circle.rotation.y += dt * 0.15 * sp;
            rings[0].rotation.x += dt * 0.3;
            rings[1].rotation.z += dt * 0.25;
            focus.rotation.y += dt * 0.5 * sp;
            for (const p of pistons) p.rod.position.y = 1.55 + Math.sin(t * 2 * sp + p.ph) * 0.12;
            needles.forEach((n, i) => (n.n.rotation.z = -1.1 + Math.sin(t * (0.6 + i * 0.3) + n.ph) * 0.6 + busy * 0.8));
            lensGlow.material.opacity = 0.3 + Math.sin(t * 1.3) * 0.08 + busy * 0.3;
            eyeGlow.material.opacity = 0.6 + Math.sin(t * 3) * 0.2;
            nextPuff -= dt;
            if (nextPuff < 0) {
                nextPuff = 4 + Math.random() * 5;
                puffs.forEach((p, i) => {
                    p.p.set(1.25 + Math.random() * 0.1, 3.0 + i * 0.01, 0.2);
                    p.life = 1 + Math.random() * 1.5;
                    p.v = new V3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
                });
                audio.noise(0.8, 3000, 0.6, 0.03);
            }
            const s = steam.geometry.attributes.position;
            puffs.forEach((p, i) => {
                if (p.life > 0) {
                    p.life -= dt;
                    p.p.addScaledVector(p.v, dt);
                }
                s.setXYZ(i, p.p.x, p.life > 0 ? p.p.y : -10, p.p.z);
            });
            s.needsUpdate = true;
        },
    };
}
