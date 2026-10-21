// Procedural animation for the chibi rigs. Every pose is a function of time; animate() blends
// toward the current pose so switching never pops. Models face +z: raising an arm forward is a
// negative x rotation (it swings the hanging arm toward +z).
//
// Poses: idle, ready (battle stance), walk, hop, attack, shoot, cast, item, defend, hurt, ko,
// victory, wave, sleep.

const lerp = (a, b, k) => a + (b - a) * k;

export function setPose(rig, pose, opts = {}) {
    if (!rig) return;
    rig.pose = pose;
    rig.poseOpts = opts;
    rig.poseT = 0;
}

export function animate(rig, dt, t) {
    if (!rig || rig.kind !== 'humanoid') return;
    rig.poseT = (rig.poseT ?? 0) + dt;
    const k = 1 - Math.exp(-16 * dt);
    const P = rig.pose ?? 'idle', o = rig.poseOpts ?? {}, pt = rig.poseT;
    const T = { rootY: 0, hipsY: rig.hipY, bodyX: 0, bodyY: 0, bodyZ: 0, headX: 0, headY: 0, headZ: 0, aRx: 0, aRz: -0.14, aLx: 0, aLz: 0.14, lL: 0, lR: 0, cape: 0.12, rootRotX: 0 };
    const ph = t + (rig.phase ?? 0);
    switch (P) {
        case 'idle':
            T.hipsY += Math.sin(ph * 2.2) * 0.012;
            T.headX = Math.sin(ph * 0.7) * 0.05; T.headZ = Math.sin(ph * 0.5) * 0.06;
            T.aLz = 0.16 + Math.sin(ph * 2.2) * 0.03; T.aRz = -0.16 - Math.sin(ph * 2.2) * 0.03;
            break;
        case 'ready': {
            const b = Math.sin(ph * 4.5);
            T.rootY = Math.abs(b) * 0.04;
            T.bodyX = 0.12; T.headX = -0.08;
            T.aRx = -0.7 + b * 0.05; T.aRz = -0.3; T.aLx = -0.5; T.aLz = 0.4;
            T.lL = 0.25; T.lR = -0.2;
            T.cape = 0.25 + b * 0.05;
            break;
        }
        case 'walk': {
            const s = Math.sin(ph * 10);
            T.lL = s * 0.7; T.lR = -s * 0.7;
            T.aLx = -s * 0.7; T.aRx = s * 0.7;
            T.rootY = Math.abs(Math.cos(ph * 10)) * 0.06;
            T.bodyY = s * 0.08; T.cape = 0.45;
            break;
        }
        case 'hop': {
            // one hop per o.dur seconds; the view moves the token along the arc
            const u = Math.min(1, pt / (o.dur ?? 0.3));
            T.lL = -0.6 * Math.sin(u * Math.PI); T.lR = -0.6 * Math.sin(u * Math.PI);
            T.aLz = 0.8; T.aRz = -0.8;
            T.bodyX = 0.1; T.cape = 0.7;
            break;
        }
        case 'attack': {
            // wind up (0–0.25), strike (0.25–0.4), hold
            const u = pt;
            const wind = Math.min(1, u / 0.22), strike = Math.max(0, Math.min(1, (u - 0.22) / 0.12));
            T.aRx = lerp(-0.4, -2.9, wind) + strike * 2.7;
            T.aRz = -0.3;
            T.bodyY = lerp(0, 0.5, wind) - strike * 1.0;
            T.bodyX = 0.1 + strike * 0.25;
            T.lL = 0.4; T.lR = -0.3;
            T.aLx = -0.5; T.aLz = 0.5;
            T.cape = 0.6;
            break;
        }
        case 'shoot': {
            const u = Math.min(1, pt / 0.3);
            T.aLx = -1.55; T.aLz = 0.05;
            T.aRx = -1.5 + u * 0.3; T.aRz = 0.35 + u * 0.4;
            T.bodyY = -0.5; T.headY = 0.4;
            T.lL = 0.3; T.lR = -0.3;
            break;
        }
        case 'cast': {
            const w = Math.sin(ph * 14) * 0.08;
            T.aRx = -2.6 + w; T.aRz = -0.2; T.aLx = -1.3; T.aLz = 0.6 - w;
            T.headX = -0.25; T.bodyX = -0.08;
            T.rootY = Math.min(0.12, pt * 0.4);
            T.cape = 0.6 + w;
            break;
        }
        case 'item':
            T.aRx = -2.2; T.aRz = -0.15; T.headX = -0.2;
            break;
        case 'defend':
            T.hipsY = rig.hipY * 0.85; T.bodyX = 0.3; T.headX = 0.05;
            T.aLx = -1.4; T.aLz = 0.1; T.aRx = -0.9; T.aRz = -0.5;
            T.lL = 0.5; T.lR = -0.4;
            break;
        case 'hurt': {
            const u = Math.min(1, pt / 0.35);
            const s = Math.sin(u * Math.PI);
            T.bodyX = -0.45 * s; T.headX = -0.4 * s;
            T.aLz = 0.9 * s + 0.15; T.aRz = -0.9 * s - 0.15;
            T.rootY = 0.05 * s;
            break;
        }
        case 'ko':
            T.hipsY = 0.12; T.bodyX = 1.25; T.headX = 0.3;
            T.aLz = 0.35; T.aRz = -0.35; T.aLx = -1.2; T.aRx = -1.2;
            T.lL = -1.4; T.lR = -1.4;
            T.cape = 1.2;
            break;
        case 'victory': {
            const j = Math.abs(Math.sin(ph * 6));
            T.rootY = j * 0.3;
            T.aRx = -2.9; T.aRz = -0.2 + Math.sin(ph * 12) * 0.15;
            T.aLz = 1.2 + Math.sin(ph * 12) * 0.2;
            T.headX = -0.25; T.lL = -0.3 * j; T.lR = -0.3 * j;
            break;
        }
        case 'wave':
            T.aRx = -0.4; T.aRz = -2.4 + Math.sin(ph * 9) * 0.35; T.headZ = Math.sin(ph * 3) * 0.1;
            break;
        case 'sleep':
            T.hipsY = rig.hipY * 0.6; T.bodyX = 0.5; T.headX = 0.5; T.headZ = 0.3;
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
    const fast = P === 'attack' ? 1 - Math.exp(-40 * dt) : k;
    R.arms[0].rotation.x = lerp(R.arms[0].rotation.x, T.aRx, fast);
    R.arms[0].rotation.z = lerp(R.arms[0].rotation.z, T.aRz, fast);
    R.arms[1].rotation.x = lerp(R.arms[1].rotation.x, T.aLx, k);
    R.arms[1].rotation.z = lerp(R.arms[1].rotation.z, T.aLz, k);
    R.legs[0].rotation.x = lerp(R.legs[0].rotation.x, T.lR, k);
    R.legs[1].rotation.x = lerp(R.legs[1].rotation.x, T.lL, k);
    if (R.cape) R.cape.rotation.x = lerp(R.cape.rotation.x, T.cape + Math.sin(t * 3 + 1) * 0.04, k);
    // blinking (and asleep or knocked out, eyes stay shut)
    if (P === 'sleep' || P === 'ko') { if (R.expr !== 'blink' && R.expr !== 'hurt') R.setExpr(P === 'ko' ? 'hurt' : 'blink'); return; }
    R.blinkT = (R.blinkT ?? 3) - dt;
    if (R.blinkT <= 0 && (R.expr === 'normal' || R.expr === 'blink')) {
        if (R.expr === 'blink') { R.setExpr('normal'); R.blinkT = 2 + ((ph * 7.31) % 3); }
        else { R.setExpr('blink'); R.blinkT = 0.12; }
    }
}
