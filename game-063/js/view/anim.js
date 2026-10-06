// Procedural animation for the chibi rigs. Every pose is a function of time and a few parameters;
// anim(rig, dt) blends toward the current pose so switching never pops.
//
// Golf: the golfer stands with the target to their left; the swing pivot (shoulders) rotates about the
// golfer's forward axis, so −angle is the backswing and +angle the follow-through.

const lerp = (a, b, k) => a + (b - a) * k;

export function setPose(rig, pose, opts = {}) { rig.pose = pose; rig.poseOpts = opts; rig.poseT = 0; }

export function animate(rig, dt, t) {
    if (!rig || rig.kind !== 'humanoid') return;
    rig.poseT = (rig.poseT ?? 0) + dt;
    const k = 1 - Math.exp(-14 * dt);
    const P = rig.pose ?? 'idle', o = rig.poseOpts ?? {};
    const T = { hipsY: 0.34, bodyX: 0, bodyY: 0, bodyZ: 0, headX: 0, headY: 0, headZ: 0, swing: 0, swingX: 0, aLz: 0.12, aRz: -0.12, aLx: 0, aRx: 0, lL: 0, lR: 0, lLz: 0, lRz: 0, club: false, rootY: 0, cape: 0.12 };
    const ph = t * 1.0 + (rig.phase ?? 0);
    switch (P) {
        case 'idle':
            T.hipsY += Math.sin(ph * 2.2) * 0.012;
            T.headX = Math.sin(ph * 0.7) * 0.05; T.headZ = Math.sin(ph * 0.5) * 0.06;
            T.aLz = 0.14 + Math.sin(ph * 2.2) * 0.03; T.aRz = -0.14 - Math.sin(ph * 2.2) * 0.03;
            T.club = !!o.club;
            break;
        case 'walk': {
            const s = Math.sin(ph * 9);
            T.lL = s * 0.7; T.lR = -s * 0.7;
            T.aLx = -s * 0.7; T.aRx = s * 0.7;
            T.rootY = Math.abs(Math.cos(ph * 9)) * 0.06;
            T.bodyY = s * 0.08; T.cape = 0.4;
            break;
        }
        case 'address': // over the ball, a little waggle
            T.hipsY = 0.31; T.bodyX = 0.22; T.headX = -0.05;
            T.lLz = 0.12; T.lRz = -0.12;
            T.aLz = -0.55; T.aRz = 0.55; T.aLx = -0.25; T.aRx = -0.25;
            T.swing = Math.sin(ph * 2.5) * 0.06;
            T.club = true;
            break;
        case 'swing': { // o.angle from −2.5 (top) to +2.3 (finish)
            const a = o.angle ?? 0;
            T.hipsY = 0.31; T.bodyX = 0.22 - Math.max(0, a) * 0.1; T.headX = -0.05 - Math.max(0, a) * 0.1;
            T.bodyY = a * 0.22; T.headY = -a * 0.12;
            T.lLz = 0.12; T.lRz = -0.12 - Math.max(0, a) * 0.08;
            T.aLz = -0.55; T.aRz = 0.55; T.aLx = -0.25; T.aRx = -0.25;
            T.swing = a;
            T.club = true;
            break;
        }
        case 'cheer': {
            const j = Math.abs(Math.sin(ph * 6));
            T.rootY = j * 0.35; T.aLz = 2.6 + Math.sin(ph * 12) * 0.2; T.aRz = -2.6 - Math.sin(ph * 12) * 0.2;
            T.headX = -0.2; T.lL = -0.3 * j; T.lR = -0.3 * j;
            break;
        }
        case 'slump':
            T.hipsY = 0.32; T.bodyX = 0.3; T.headX = 0.5; T.aLz = 0.05; T.aRz = -0.05; T.aLx = 0.2; T.aRx = 0.2;
            break;
        case 'talk':
            T.headX = Math.sin(ph * 7) * 0.06; T.headZ = Math.sin(ph * 2.3) * 0.08;
            T.aRz = -0.5 - Math.sin(ph * 4) * 0.25; T.aRx = -0.6; T.aLz = 0.15;
            T.hipsY += Math.sin(ph * 3) * 0.01;
            break;
        case 'point':
            T.aRz = -1.2; T.aRx = -1.3; T.headX = -0.05;
            break;
        case 'surprised':
            T.rootY = Math.max(0, Math.sin(Math.min(1, rig.poseT * 4) * Math.PI)) * 0.25;
            T.aLz = 1.0; T.aRz = -1.0; T.headX = -0.15;
            break;
        case 'float':
            T.rootY = 0.3 + Math.sin(ph * 1.8) * 0.15;
            T.aLz = 0.6 + Math.sin(ph * 2) * 0.1; T.aRz = -0.9; T.aRx = -0.5; T.headZ = Math.sin(ph) * 0.08;
            T.cape = 0.5 + Math.sin(ph * 3) * 0.15;
            break;
    }
    const R = rig;
    R.pivot.position.y = lerp(R.pivot.position.y, T.rootY, k);
    R.hips.position.y = lerp(R.hips.position.y, T.hipsY, k);
    R.body.rotation.x = lerp(R.body.rotation.x, T.bodyX, k);
    R.body.rotation.y = lerp(R.body.rotation.y, T.bodyY, k);
    R.body.rotation.z = lerp(R.body.rotation.z, T.bodyZ, k);
    R.head.rotation.x = lerp(R.head.rotation.x, T.headX, k);
    R.head.rotation.y = lerp(R.head.rotation.y, T.headY, k);
    R.head.rotation.z = lerp(R.head.rotation.z, T.headZ, k);
    // the swing itself must track the meter exactly
    R.swing.rotation.z = P === 'swing' ? T.swing : lerp(R.swing.rotation.z, T.swing, k);
    R.arms[0].rotation.z = lerp(R.arms[0].rotation.z, T.aRz, k);   // arms[0] is the right arm (−x)
    R.arms[1].rotation.z = lerp(R.arms[1].rotation.z, T.aLz, k);
    R.arms[0].rotation.x = lerp(R.arms[0].rotation.x, T.aRx, k);
    R.arms[1].rotation.x = lerp(R.arms[1].rotation.x, T.aLx, k);
    R.legs[0].rotation.x = lerp(R.legs[0].rotation.x, T.lR, k);
    R.legs[1].rotation.x = lerp(R.legs[1].rotation.x, T.lL, k);
    R.legs[0].rotation.z = lerp(R.legs[0].rotation.z, T.lRz, k);
    R.legs[1].rotation.z = lerp(R.legs[1].rotation.z, T.lLz, k);
    if (R.cape) R.cape.rotation.x = lerp(R.cape.rotation.x, T.cape + Math.sin(t * 3 + 1) * 0.04, k);
    R.club.visible = T.club;
    // blinking
    R.blinkT = (R.blinkT ?? 3) - dt;
    if (R.blinkT <= 0 && (R.expr === 'normal' || R.expr === 'blink')) {
        if (R.expr === 'blink') { R.setExpr('normal'); R.blinkT = 2 + Math.random() * 3; }
        else { R.setExpr('blink'); R.blinkT = 0.12; }
    }
}

// Wedgewick bobs beside the hero and tilts toward whoever he's talking to.
export function animateWedge(rig, dt, t, talking = false) {
    rig.inner.position.y = Math.sin(t * 2.0) * 0.12;
    rig.inner.rotation.z = Math.sin(t * 1.3) * 0.15 + (talking ? Math.sin(t * 9) * 0.08 : 0);
    rig.inner.rotation.y = Math.sin(t * 0.7) * 0.3;
}

// Monsters: hops and wobbles; t is world time, hop from the sim.
export function animateMonster(rig, t, hop, hurt = 0) {
    const b = rig.body;
    switch (rig.kind) {
        case 'slime': { const sq = 1 + Math.sin(t * 6.8) * 0.08; b.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); break; }
        case 'scarab': b.rotation.z = Math.sin(t * 18) * 0.05; break;
        case 'penguin': b.rotation.z = Math.sin(t * 5) * 0.18; break;
        case 'imp': b.rotation.x = Math.sin(t * 8) * 0.1; break;
        case 'wisp': b.rotation.z = Math.sin(t * 2) * 0.12; b.scale.setScalar(1 + Math.sin(t * 3) * 0.04); break;
    }
    rig.flash.value = hurt;
}
