// Six bosses, one per operation, each with parts, phases and named patterns.
//
// A boss is an enemy with `boss: true`, a list of parts (hit circles that
// either soak damage themselves or pass it to the boss's phase HP) and a
// phase list. A phase ends when its HP runs out, when its gate parts are all
// destroyed, or when its timer runs out (survival cards). Every phase runs a
// main script plus optional per-part scripts, all generators yielding seconds.

import { shoot, ring, fan, aimed, aimAngle, stack, dens, laser, cancelAll, C } from './bullets.js';
import { TAU, clamp, lerp, angDiff, runGen } from './util.js';

const PHASE_LIMIT = 75;

function part(id, ox, oy, r, hp, o = {}) {
    return { id, ox, oy, x: 0, y: 0, r, hp, maxHp: hp, alive: true, core: !!o.core, gate: !!o.gate, shield: !!o.shield, rot: o.rot ?? Math.PI, flash: 0, script: null, wait: 0, visual: o.visual };
}

const hpScale = (w, b) => w.diff.enemyHp * (1 + 0.35 * (w.endlessLevel || 0)) * (b.bdef.hpMul || 1);

// ------------------------------------------------------------------ LEVIATHAN
const leviathan = {
    name: 'TIDEWARDEN', r: 90, sink: true, hpMul: 0.9,
    init(b, w) {
        b.x = w.W / 2; b.y = -280;
        b.parts = [
            part('t1', -52, -64, 22, 520, { gate: true }), part('t2', 52, -64, 22, 520, { gate: true }),
            part('t3', -52, 74, 22, 520, { gate: true }), part('t4', 52, 74, 22, 520, { gate: true }),
            part('silo', 0, -150, 20, 440, { gate: true, rot: 0 }),
            part('core', 0, 0, 36, 1, { core: true }),
        ];
        w.scrollTarget = 18;
    },
    enter(b, w, dt) { b.y = lerp(b.y, 200, 1 - Math.exp(-dt * 0.9)); return b.t > 4.2; },
    layout(b) {
        for (const p of b.parts) { p.x = b.x + p.ox; p.y = b.y + p.oy; }
    },
    phases: [
        {
            name: 'BROADSIDE', gate: 'parts', hp: 1,
            move(b, w, dt) { b.x = w.W / 2 + Math.sin(b.phaseT * 0.35) * 50; },
            *partScript(p, b, w) {
                if (p.id === 'silo') {
                    yield 2;
                    for (;;) {
                        for (const s of [-1, 1]) {
                            const m = w.spawn('missile', p.x + s * 10, p.y, {});
                            m.data.ang = -Math.PI / 2 + s * 0.9; m.data.spd = 80;
                        }
                        w.ev('missile', { x: p.x, y: p.y });
                        yield 4.2 / w.diff.fireRate;
                    }
                }
                const k = +p.id[1];
                yield 0.6 + k * 0.45;
                for (let n = 0; ; n++) {
                    if (n % 3 === 2) {
                        for (let i = 0; i < 8; i++) { shoot(w, p.x, p.y, p.rot - Math.PI / 2 + Math.sin(i * 0.8) * 0.3, 200, 'rice', C.orange); yield 0.07; }
                    } else {
                        for (let i = 0; i < 3; i++) {
                            aimed(w, p.x, p.y, dens(w, 3, 3), 0.32, 165, 'orb', C.red);
                            w.ev('eshot', { x: p.x, y: p.y, k: 'm', muzzle: p.rot - Math.PI / 2 });
                            yield 0.22;
                        }
                    }
                    yield 1.7 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'TIDAL SPIRAL', spell: 'Tidal Spiral', hp: 2600,
            move(b, w, dt) { b.x = w.W / 2 + Math.sin(b.phaseT * 0.5) * 80; },
            *script(b, w) {
                yield 1;
                let a = 0;
                for (let i = 0; ; i++) {
                    const n = dens(w, 3, 2);
                    for (let k = 0; k < n; k++) shoot(w, b.x, b.y + 10, a + k * TAU / n, 150, 'rice', C.cyan);
                    for (let k = 0; k < n; k++) shoot(w, b.x, b.y + 10, -a * 1.3 + k * TAU / n + 0.5, 120, 'pellet', C.blue);
                    a += 0.19;
                    if (i % 30 === 0) { ring(w, b.x, b.y, dens(w, 14, 8), 95, a, 'big', C.blue); w.ev('eshot', { x: b.x, y: b.y, k: 'l' }); }
                    yield 0.085;
                }
            },
        },
        {
            name: 'MAELSTROM', spell: 'Maelstrom', hp: 2300,
            move(b, w, dt) { b.x = w.W / 2 + Math.sin(b.phaseT * 0.7) * 100; },
            *script(b, w) {
                yield 1;
                for (let i = 0; ; i++) {
                    const s = i % 2 ? 1 : -1;
                    ring(w, b.x, b.y, dens(w, 18, 10), 120, i * 0.17, 'orb', s > 0 ? C.cyan : C.purple, { angVel: s * 0.55 });
                    w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                    if (i % 3 === 2) {
                        for (let k = 0; k < 6; k++) { aimed(w, b.x, b.y + 20, 1, 0, 250, 'needle', C.white); yield 0.06; }
                    }
                    yield 0.62 / w.diff.fireRate;
                }
            },
        },
    ],
};

// ------------------------------------------------------------------ MANTIS
const mantis = {
    name: 'MANTIS', r: 80, hpMul: 1.85,
    init(b, w) {
        b.x = w.W / 2; b.y = -220;
        b.anim = { armL: 0.3, armR: -0.3, step: 0 };
        b.parts = [
            part('armL', -96, 18, 28, 1300, { gate: true }), part('armR', 96, 18, 28, 1300, { gate: true }),
            part('core', 0, -6, 38, 1, { core: true }),
        ];
        w.scrollTarget = 0;
    },
    enter(b, w, dt) { b.y = lerp(b.y, 190, 1 - Math.exp(-dt * 0.7)); b.anim.step += dt * 3; return b.t > 5; },
    layout(b) {
        const a = b.anim;
        for (const p of b.parts) {
            p.x = b.x + p.ox; p.y = b.y + p.oy;
            if (p.id === 'armL') { p.x += Math.sin(a.armL) * 30; p.y += Math.cos(a.armL) * 26; }
            if (p.id === 'armR') { p.x += Math.sin(a.armR) * 30; p.y += Math.cos(a.armR) * 26; }
        }
    },
    phases: [
        {
            name: 'REAPER ARMS', gate: 'parts', hp: 1,
            move(b, w, dt) {
                b.x = w.W / 2 + Math.sin(b.phaseT * 0.4) * 60;
                b.anim.step += dt * 1.2;
                b.anim.armL = Math.sin(b.phaseT * 1.1) * 0.5 + 0.3;
                b.anim.armR = -Math.sin(b.phaseT * 1.1 + 1) * 0.5 - 0.3;
            },
            *partScript(p, b, w) {
                const s = p.id === 'armL' ? -1 : 1;
                yield s < 0 ? 1 : 3;
                for (let n = 0; ; n++) {
                    const a0 = Math.PI / 2 + s * 0.85;
                    laser(w, p.x, p.y + 24, a0, { follow: p, oy: 24, warm: 0.9, dur: 1.8, sweep: -s * 0.5, width: 16, color: C.green });
                    yield 3;
                    for (let i = 0; i < 3; i++) { aimed(w, p.x, p.y + 20, dens(w, 5, 3), 0.6, 190, 'rice', C.green); yield 0.2; }
                    yield 1.4 / w.diff.fireRate;
                }
            },
            *script(b, w) {
                yield 2;
                for (let i = 0; ; i++) {
                    ring(w, b.x, b.y, dens(w, 12, 8), 110, i * 0.3, 'orb', C.yellow);
                    w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                    yield 3.2 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'POLLEN STORM', spell: 'Pollen Storm', hp: 3200,
            move(b, w, dt) {
                b.x = w.W / 2 + Math.sin(b.phaseT * 0.5) * 90;
                b.anim.step += dt * 1.6;
                b.anim.armL = 1.2 + Math.sin(b.phaseT * 3) * 0.1; b.anim.armR = -1.2 - Math.sin(b.phaseT * 3) * 0.1;
            },
            *script(b, w) {
                yield 1;
                for (let i = 0; ; i++) {
                    const s = i % 2 ? 1 : -1;
                    ring(w, b.x, b.y, dens(w, 20, 12), 105, i * 0.11, 'orb', s > 0 ? C.pink : C.yellow, { angVel: s * 0.9, acc: 10, maxSpd: 160 });
                    w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                    if (i % 5 === 4) {
                        for (const fx of [-70, 70]) ring(w, b.x + fx, b.y + 70, dens(w, 24, 12), 150, 0, 'pellet', C.green);
                        w.ev('stomp', { x: b.x, y: b.y + 70 });
                    }
                    yield 0.72 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'HIVE BURST', spell: 'Hive Burst', hp: 2600,
            move(b, w, dt) {
                b.x = w.W / 2 + Math.sin(b.phaseT * 0.8) * 120;
                b.anim.step += dt * 2.2;
                b.anim.armL = Math.sin(b.phaseT * 4) * 0.8; b.anim.armR = Math.sin(b.phaseT * 4 + 2) * 0.8;
            },
            *script(b, w) {
                yield 1;
                let a = 0;
                for (let i = 0; ; i++) {
                    for (let k = 0; k < 3; k++) shoot(w, b.x, b.y, a + k * TAU / 3, 160 + Math.sin(i * 0.1) * 40, 'rice', C.orange);
                    a += 0.13 + Math.sin(i * 0.02) * 0.1;
                    if (i % 26 === 0) {
                        aimed(w, b.x, b.y + 20, 3, 0.7, 120, 'big', C.red, { split: { at: 0.9, n: dens(w, 7, 5), spd: 130, style: 'pellet', color: C.orange } });
                        w.ev('eshot', { x: b.x, y: b.y, k: 'l' });
                    }
                    if (i % 70 === 10) {
                        for (const s of [-1, 1]) w.spawn('hornet', b.x + s * 80, b.y, { mv: { type: 'bez', dur: 2.8, face: true, p: [[b.x + s * 80, b.y], [b.x + s * 260, b.y + 80], [w.player.x, w.H * 0.6], [w.player.x - s * 200, w.H + 60]] } });
                    }
                    yield 0.09;
                }
            },
        },
    ],
};

// ------------------------------------------------------------------ SANDWYRM
const SEGS = 7;
const sandwyrm = {
    name: 'SANDWYRM', r: 40, hpMul: 2.5,
    init(b, w) {
        b.x = w.W / 2; b.y = -120;
        b.trail = [];
        for (let i = 0; i < 160; i++) b.trail.push(w.W / 2, -120 - i * 4);
        b.anim = { burrow: 0, drill: 0 };
        b.parts = [part('core', 0, 0, 34, 1, { core: true })];
        for (let i = 0; i < SEGS; i++) b.parts.push(part('s' + i, 0, 0, 25, 420, { gate: true }));
        b.parts.push(part('tail', 0, 0, 18, 1, { visual: true }));
        w.scrollTarget = 12;
    },
    path(b, t) { return [b.cx + 190 * Math.sin(t * 0.55), 230 + 120 * Math.sin(t * 0.9 + 1)]; },
    enter(b, w, dt) {
        b.cx = w.W / 2;
        const t = b.t - 4.5;
        if (t < 0) { b.y = lerp(-120, 230 + 120 * Math.sin(1), b.t / 4.5); b.x = w.W / 2 + Math.sin(b.t) * 40; }
        return b.t > 4.5;
    },
    layout(b, w) {
        // push the head into the trail when it has moved, then place segments along it
        const tr = b.trail;
        const dx = b.x - tr[0], dy = b.y - tr[1];
        if (dx * dx + dy * dy > 9) { tr.unshift(b.x, b.y); tr.length = Math.min(tr.length, 320); }
        b.parts[0].x = b.x; b.parts[0].y = b.y;
        for (let i = 1; i < b.parts.length; i++) {
            const idx = Math.min(tr.length / 2 - 1, i * 13) * 2;
            const p = b.parts[i];
            p.x = tr[idx]; p.y = tr[idx + 1];
            const j = Math.max(0, idx - 4);
            p.rot = Math.atan2(tr[j + 1] - p.y, tr[j] - p.x) + Math.PI / 2;
        }
        b.rot = Math.atan2(b.y - tr[5], b.x - tr[4]) + Math.PI / 2;
    },
    phases: [
        {
            name: 'DUNE RUN', gate: 'parts', hp: 1,
            move(b, w, dt) { const [x, y] = sandwyrm.path(b, b.phaseT); b.x = x; b.y = y; },
            *partScript(p, b, w) {
                if (!p.id.startsWith('s')) return;
                const k = +p.id.slice(1);
                yield 1 + k * 0.33;
                for (;;) {
                    if (p.y > 0 && p.y < w.H * 0.75) {
                        if (k % 2) aimed(w, p.x, p.y, 1, 0, 160, 'orb', C.orange);
                        else ring(w, p.x, p.y, dens(w, 6, 4), 110, b.t, 'pellet', C.yellow);
                    }
                    yield 2.4 / w.diff.fireRate;
                }
            },
            *script(b, w) {
                yield 1.5;
                for (;;) {
                    aimed(w, b.x, b.y, dens(w, 5, 3), 0.8, 190, 'arrow', C.red);
                    w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                    yield 1.5 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'BURROW', spell: 'Burrow Ambush', hp: 1800,
            move(b, w, dt) {},
            *script(b, w) {
                for (let n = 0; ; n++) {
                    // dive
                    b.submerged = true;
                    w.ev('burrow', { x: b.x, y: b.y });
                    const tx = clamp(w.player.x + w.rng.range(-80, 80), 90, w.W - 90), ty = w.rng.range(140, 280);
                    const x0 = b.x, y0 = b.y;
                    for (let i = 0; i < 20; i++) { b.x = lerp(x0, tx, i / 19); b.y = lerp(y0, ty, i / 19); yield 0.08; }
                    w.ev('bulge', { x: tx, y: ty });
                    yield 0.7;
                    b.submerged = false;
                    w.ev('erupt', { x: b.x, y: b.y });
                    ring(w, b.x, b.y, dens(w, 26, 14), 160, w.rng.float(), 'orb', C.orange);
                    ring(w, b.x, b.y, dens(w, 13, 8), 100, w.rng.float(), 'big', C.red);
                    for (let i = 0; i < 18; i++) {
                        const [x, y] = [b.x + Math.sin(i * 0.3) * 40, b.y + Math.cos(i * 0.2) * 20];
                        b.x = x; b.y = y;
                        if (i % 3 === 0) aimed(w, b.x, b.y, dens(w, 3, 2), 0.3, 220, 'rice', C.yellow);
                        yield 0.18;
                    }
                }
            },
        },
        {
            name: 'DRILL FURY', spell: 'Drill Fury', hp: 2400,
            move(b, w, dt) {
                b.anim.drill += dt * 12;
                b.x = lerp(b.x, w.W / 2 + Math.sin(b.phaseT * 0.6) * 150, 1 - Math.exp(-dt * 2));
                b.y = lerp(b.y, 180 + Math.sin(b.phaseT * 1.1) * 40, 1 - Math.exp(-dt * 2));
            },
            *script(b, w) {
                b.submerged = false;
                yield 1;
                let a = 0;
                for (let i = 0; ; i++) {
                    const n = dens(w, 4, 3);
                    for (let k = 0; k < n; k++) shoot(w, b.x, b.y + 20, a + k * TAU / n, 175, 'rice', C.yellow);
                    a += 0.23;
                    if (i % 18 === 0) { ring(w, b.x, b.y, dens(w, 16, 10), 100, -a, 'big', C.orange); w.ev('eshot', { x: b.x, y: b.y, k: 'l' }); }
                    yield 0.075;
                }
            },
        },
    ],
};

// ------------------------------------------------------------------ BASTION
const PLATES = 8;
const bastion = {
    name: 'BASTION', r: 100, hpMul: 4.2,
    init(b, w) {
        b.x = w.W / 2; b.y = -260;
        b.anim = { plate: 0, plateSpd: 0.55, vent: 0 };
        b.parts = [];
        for (let i = 0; i < PLATES; i++) b.parts.push(part('p' + i, 0, 0, 21, 360, { shield: true }));
        b.parts.push(part('cL', -112, 66, 24, 1000, { gate: true }), part('cR', 112, 66, 24, 1000, { gate: true }));
        b.parts.push(part('core', 0, 0, 40, 1, { core: true }));
        w.scrollTarget = 0;
    },
    enter(b, w, dt) { b.y = lerp(b.y, 200, 1 - Math.exp(-dt * 0.8)); b.anim.plate += dt * b.anim.plateSpd; return b.t > 5; },
    layout(b) {
        for (const p of b.parts) {
            if (p.id[0] === 'p') {
                const a = b.anim.plate + (+p.id.slice(1)) * TAU / PLATES;
                p.x = b.x + Math.cos(a) * 112; p.y = b.y + Math.sin(a) * 112; p.rot = a + Math.PI / 2;
            } else {
                p.x = b.x + p.ox; p.y = b.y + p.oy;
            }
        }
    },
    phases: [
        {
            name: 'FROSTWALL', gate: 'parts', hp: 1,
            move(b, w, dt) { b.anim.plate += dt * b.anim.plateSpd; },
            *partScript(p, b, w) {
                if (p.id !== 'cL' && p.id !== 'cR') return;
                yield p.id === 'cL' ? 1 : 2.2;
                for (;;) {
                    p.rot = aimAngle(w, p.x, p.y) + Math.PI / 2;
                    stack(w, p.x, p.y, aimAngle(w, p.x, p.y), dens(w, 5, 3), 150, 250, 'rice', C.cyan);
                    w.ev('eshot', { x: p.x, y: p.y, k: 'm' });
                    yield 0.4;
                    fan(w, p.x, p.y, dens(w, 7, 4), 1.2, Math.PI / 2, 130, 'pellet', C.white);
                    yield 2.2 / w.diff.fireRate;
                }
            },
            *script(b, w) {
                yield 2;
                for (;;) {
                    aimed(w, b.x, b.y, 1, 0, 140, 'big', C.blue, { split: { at: 1.0, n: dens(w, 10, 6), spd: 120, style: 'orb', color: C.cyan } });
                    w.ev('eshot', { x: b.x, y: b.y, k: 'l' });
                    yield 2.3 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'CRYSTAL LATTICE', spell: 'Crystal Lattice', hp: 3400,
            move(b, w, dt) { b.anim.plate += dt * 0.9; },
            *script(b, w) {
                yield 1;
                for (let n = 0; ; n++) {
                    const a0 = n * 0.29 + w.rng.range(0, 0.2);
                    for (let arm = 0; arm < 6; arm++) {
                        const a = a0 + arm * TAU / 6;
                        for (let k = 0; k < 5; k++) {
                            const spd = 70 + k * 26;
                            shoot(w, b.x, b.y, a, spd, 'star', C.cyan);
                            if (k >= 2) {
                                shoot(w, b.x, b.y, a, spd, 'pellet', C.white, { then: { at: 0.7, dAng: 0.6 } });
                                shoot(w, b.x, b.y, a, spd, 'pellet', C.white, { then: { at: 0.7, dAng: -0.6 } });
                            }
                        }
                    }
                    w.ev('eshot', { x: b.x, y: b.y, k: 'l' });
                    yield 1.55 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'ABSOLUTE ZERO', spell: 'Absolute Zero', hp: 2800,
            move(b, w, dt) { b.anim.plate += dt * 1.4; b.anim.vent = 1; },
            *script(b, w) {
                yield 1;
                for (let n = 0; ; n++) {
                    ring(w, b.x, b.y, dens(w, 22, 12), 170, n * 0.21, 'orb', C.cyan, {
                        then: { at: 0.75, spd: 0, next: { at: 1.9, aim: true, aimOff: 0, spd: 60, acc: 90, maxSpd: 190, color: C.white } },
                    });
                    w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                    yield 0.85 / w.diff.fireRate;
                    if (n % 4 === 3) {
                        fan(w, b.x, b.y, 5, 1.6, Math.PI / 2, 80, 'big', C.blue);
                        yield 0.6;
                    }
                }
            },
        },
    ],
};

// ------------------------------------------------------------------ SERAPH
const seraph = {
    name: 'SERAPH', r: 34, eject: true, hpMul: 4.0,
    init(b, w) {
        b.x = w.W / 2; b.y = -100;
        b.anim = { dash: 0, decoys: [], wing: 0 };
        b.parts = [part('core', 0, 0, 30, 1, { core: true })];
        b.tx = w.W / 2; b.ty = 170;
        w.scrollTarget = 26;
    },
    enter(b, w, dt) { b.y = lerp(b.y, 170, 1 - Math.exp(-dt * 1.5)); return b.t > 3.2; },
    layout(b) { for (const p of b.parts) { p.x = b.x; p.y = b.y; } },
    dashTo(b, w, x, y) { b.tx = x; b.ty = y; b.anim.dash = 0.35; w.ev('dash', { x: b.x, y: b.y }); },
    moveDash(b, w, dt) {
        const k = 1 - Math.exp(-dt * 7);
        b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k;
        b.anim.dash = Math.max(0, b.anim.dash - dt);
        b.rot = clamp((b.tx - b.x) * 0.006, -0.5, 0.5);
    },
    phases: [
        {
            name: 'HALO SWEEP', hp: 2400,
            move(b, w, dt) { seraph.moveDash(b, w, dt); },
            *script(b, w) {
                yield 0.6;
                for (let n = 0; ; n++) {
                    seraph.dashTo(b, w, w.rng.range(110, w.W - 110), w.rng.range(110, 230));
                    yield 0.7;
                    for (let r = 0; r < 3; r++) {
                        ring(w, b.x, b.y, dens(w, 20, 12), 150 + r * 25, r * 0.1 + n, 'rice', C.yellow);
                        w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                        yield 0.18;
                    }
                    if (n % 2) for (const s of [-1, 1]) laser(w, b.x + s * 30, b.y, aimAngle(w, b.x, b.y) + s * 0.25, { follow: b, ox: s * 30, warm: 0.75, dur: 0.7, width: 10, color: C.yellow, aim: true });
                    yield 1.3 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'GILDED CAGE', spell: 'Spell: Gilded Cage', hp: 2800,
            move(b, w, dt) { seraph.moveDash(b, w, dt); },
            *script(b, w) {
                seraph.dashTo(b, w, w.W / 2, 150);
                yield 1;
                for (let n = 0; ; n++) {
                    const N = dens(w, 30, 16);
                    for (let i = 0; i < N; i++) {
                        const a = i * TAU / N + n * 0.1;
                        shoot(w, b.x, b.y, a, 240, 'arrow', C.yellow, { then: { at: 0.55, spd: 0, next: { at: 1.5, aim: true, spd: 40, acc: 60, maxSpd: 150 } } });
                    }
                    w.ev('eshot', { x: b.x, y: b.y, k: 'l' });
                    for (let i = 0; i < 10; i++) { aimed(w, b.x, b.y, 1, 0, 300, 'needle', C.white); yield 0.12; }
                    yield 1.0 / w.diff.fireRate;
                    seraph.dashTo(b, w, w.rng.range(140, w.W - 140), w.rng.range(120, 200));
                    yield 0.4;
                }
            },
        },
        {
            name: 'MIRROR DANCE', spell: 'Spell: Mirror Dance', hp: 3000,
            move(b, w, dt) {
                seraph.moveDash(b, w, dt);
                const d = b.anim.decoys;
                d.length = 2;
                d[0] = { x: w.W - b.x, y: b.y + 40 };
                d[1] = { x: w.W / 2 + (w.W / 2 - b.x) * 0.3, y: 90 + Math.sin(b.phaseT) * 20 };
            },
            *script(b, w) {
                yield 1;
                let a = 0;
                for (let i = 0; ; i++) {
                    const src = [b, ...b.anim.decoys];
                    for (let s = 0; s < src.length; s++) {
                        const o = src[s];
                        if (!o) continue;
                        const n = dens(w, 2, 2);
                        for (let k = 0; k < n; k++) shoot(w, o.x, o.y, (s % 2 ? -a : a) + k * Math.PI, 150, 'orb', s ? C.purple : C.yellow);
                    }
                    a += 0.17;
                    if (i % 40 === 39) seraph.dashTo(b, w, w.rng.range(120, w.W - 120), w.rng.range(120, 220));
                    yield 0.1;
                }
            },
        },
        {
            name: 'FALLEN WING', spell: 'Survive: Fallen Wing', gate: 'time', time: 24, hp: 1,
            move(b, w, dt) { b.anim.decoys.length = 0; seraph.moveDash(b, w, dt); b.tx = w.W / 2 + Math.sin(b.phaseT * 0.8) * 160; b.ty = 120; },
            *script(b, w) {
                b.invuln = true;
                yield 1;
                for (let i = 0; ; i++) {
                    for (let k = 0; k < dens(w, 2, 1); k++) {
                        shoot(w, w.rng.range(10, w.W - 10), -10, Math.PI / 2 + w.rng.range(-0.15, 0.15), w.rng.range(90, 140), 'rice', i % 2 ? C.yellow : C.white, { acc: 30, maxSpd: 220 });
                    }
                    if (i % 24 === 0) { ring(w, b.x, b.y, dens(w, 24, 12), 130, i, 'orb', C.orange); w.ev('eshot', { x: b.x, y: b.y, k: 'l' }); }
                    yield 0.09 / w.diff.fireRate;
                }
            },
        },
    ],
};

// ------------------------------------------------------------------ MERIDIAN
const NODES = 6;
const meridian = {
    name: 'MERIDIAN', r: 60, final: true, hpMul: 4.8,
    init(b, w) {
        b.x = w.W / 2; b.y = -260;
        b.anim = { ring1: 0, ring2: 0, nodeA: 0, eye: 0, charge: 0 };
        b.parts = [];
        for (let i = 0; i < NODES; i++) b.parts.push(part('n' + i, 0, 0, 22, 650, { gate: true }));
        b.parts.push(part('core', 0, 0, 50, 1, { core: true }));
        w.scrollTarget = 0;
    },
    enter(b, w, dt) { b.y = lerp(b.y, 210, 1 - Math.exp(-dt * 0.7)); b.anim.ring1 += dt * 0.4; b.anim.ring2 -= dt * 0.3; return b.t > 5.5; },
    layout(b) {
        for (const p of b.parts) {
            if (p.id[0] === 'n') {
                const a = b.anim.nodeA + (+p.id.slice(1)) * TAU / NODES;
                p.x = b.x + Math.cos(a) * 150; p.y = b.y + Math.sin(a) * 120; p.rot = a;
            } else { p.x = b.x; p.y = b.y; }
        }
    },
    phases: [
        {
            name: 'IRIS', gate: 'parts', hp: 1,
            move(b, w, dt) { b.anim.nodeA += dt * 0.35; b.anim.ring1 += dt * 0.5; b.anim.ring2 -= dt * 0.4; },
            *partScript(p, b, w) {
                if (p.id[0] !== 'n') return;
                const k = +p.id.slice(1);
                yield 1 + k * 0.2;
                for (let i = 0; ; i++) {
                    if (p.y > 0) fan(w, p.x, p.y, 2, Math.PI, p.rot + i * 0.25, 125, 'pellet', k % 2 ? C.red : C.pink);
                    yield 0.3 / w.diff.fireRate;
                }
            },
            *script(b, w) {
                yield 2.5;
                for (;;) {
                    const a = aimAngle(w, b.x, b.y);
                    laser(w, b.x, b.y, a - 0.7, { follow: b, warm: 1.0, dur: 1.6, sweep: 0.42, width: 18, color: C.red });
                    laser(w, b.x, b.y, a + 0.7, { follow: b, warm: 1.0, dur: 1.6, sweep: -0.42, width: 18, color: C.red });
                    yield 6 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'STORM EYE', spell: 'Storm Eye', hp: 4200,
            move(b, w, dt) { b.anim.ring1 += dt * 1.2; b.anim.ring2 -= dt * 0.9; b.anim.eye = Math.sin(b.phaseT * 2); },
            *script(b, w) {
                yield 1;
                let a = 0;
                for (let i = 0; ; i++) {
                    const n = dens(w, 5, 3);
                    for (let k = 0; k < n; k++) shoot(w, b.x, b.y, a + k * TAU / n, 120, 'orb', C.purple, { angVel: 0.35, acc: 20, maxSpd: 190 });
                    a += 0.21;
                    if (i % 22 === 0) {
                        const p = w.player;
                        const sx = clamp(p.x + w.rng.range(-40, 40), 30, w.W - 30), sy = clamp(p.y + w.rng.range(-40, 40), 60, w.H - 40);
                        w.ev('strikeWarn', { x: sx, y: sy, t: 1.1 });
                        ring(w, sx, sy, dens(w, 14, 8), 140, w.rng.float(), 'pellet', C.white, { delay: 1.1 });
                        ring(w, sx, sy, 6, 30, w.rng.float(), 'big', C.cyan, { delay: 1.1, life: 1.1 });
                    }
                    yield 0.12;
                }
            },
        },
        {
            name: 'CLEANSING RAIN', spell: 'Cleansing Rain', hp: 3800,
            move(b, w, dt) { b.anim.ring1 += dt * 0.6; b.anim.ring2 -= dt * 1.4; b.x = w.W / 2 + Math.sin(b.phaseT * 0.5) * 70; },
            *script(b, w) {
                yield 1;
                for (let i = 0; ; i++) {
                    const gap = (Math.sin(i * 0.15) * 0.5 + 0.5) * (w.W - 140) + 70;
                    for (let x = 12; x < w.W; x += 34 / Math.max(0.8, w.dens)) {
                        if (Math.abs(x - gap) < 60) continue;
                        shoot(w, x, -8, Math.PI / 2 + Math.sin(i * 0.4 + x * 0.02) * 0.12, 120, 'rice', C.cyan);
                    }
                    if (i % 3 === 0) {
                        aimed(w, b.x, b.y, 1, 0, 150, 'big', C.purple, { split: { at: 0.8, n: dens(w, 8, 5), spd: 140, style: 'orb', color: C.pink, aim: true } });
                        w.ev('eshot', { x: b.x, y: b.y, k: 'l' });
                    }
                    yield 0.55 / w.diff.fireRate;
                }
            },
        },
        {
            name: 'LAST LIGHT', spell: 'Final: Last Light', hp: 4500, ally: true,
            move(b, w, dt) { b.anim.ring1 += dt * 2; b.anim.ring2 -= dt * 2; b.anim.charge = 1; b.x = w.W / 2 + Math.sin(b.phaseT * 0.4) * 50; },
            *script(b, w) {
                w.spawnAlly();
                yield 1.5;
                let rot = 0;
                for (let n = 0; ; n++) {
                    for (let k = 0; k < 4; k++) laser(w, b.x, b.y, rot + k * Math.PI / 2, { follow: b, warm: 1.2, dur: 3.2, sweep: n % 2 ? 0.32 : -0.32, width: 16, color: C.red });
                    rot += 0.4;
                    for (let i = 0; i < 10; i++) {
                        ring(w, b.x, b.y, dens(w, 16, 10), 110, i * 0.19 + n, i % 2 ? 'orb' : 'rice', i % 2 ? C.pink : C.yellow);
                        if (i % 3 === 0) w.ev('eshot', { x: b.x, y: b.y, k: 'm' });
                        yield 0.42 / w.diff.fireRate;
                    }
                    aimed(w, b.x, b.y, 5, 1.0, 120, 'big', C.red, { split: { at: 1.0, n: dens(w, 6, 4), spd: 150, style: 'pellet', color: C.white } });
                    yield 0.8;
                }
            },
        },
    ],
};

export const BOSSES = { leviathan, mantis, sandwyrm, bastion, seraph, meridian };

// ------------------------------------------------------------------ runtime

const BOSS_DEF = { hp: 1, r: 60, score: 0, salvage: 0, size: 'xl', boss: true };

export function spawnBoss(w, id) {
    const def = BOSSES[id];
    const b = w.spawn('boss', w.W / 2, -200, { def: { ...BOSS_DEF, update: updateBoss } });
    b.bossId = id;
    b.bdef = def;
    b.name = def.name;
    b.boss = true;
    b.entering = true;
    b.invuln = true;
    b.phaseIdx = -1;
    b.phaseCount = def.phases.length;
    b.anim = {};
    b.rot = 0;
    def.init(b, w);
    def.layout(b, w);
    w.ev('bossIntro', { id, name: def.name });
    return b;
}

function startPhase(b, w, i) {
    const def = b.bdef;
    const ph = def.phases[i];
    b.phaseIdx = i;
    b.phase = ph;
    b.phaseT = 0;
    b.maxHp = Math.round(ph.hp * hpScale(w, b));
    b.hp = b.maxHp;
    b.invuln = ph.gate === 'parts' || ph.gate === 'time';
    b.spell = ph.spell || null;
    b.gen = ph.script ? ph.script(b, w) : null;
    b.wait = 0;
    for (const p of b.parts) {
        if (p.gate && i === 0) { p.maxHp = Math.round(p.maxHp * hpScale(w, b)); p.hp = p.maxHp; }
        if (p.shield && i === 0) { p.maxHp = Math.round(p.maxHp * hpScale(w, b)); p.hp = p.maxHp; }
        p.script = ph.partScript && p.alive ? ph.partScript(p, b, w) : null;
        p.wait = 0;
    }
    if (ph.spell) w.ev('spell', { name: ph.spell });
}

function endPhase(b, w, timeout) {
    const def = b.bdef;
    const n = cancelAll(w, 'phase');
    w.ev('bossPhase', { x: b.x, y: b.y, idx: b.phaseIdx, cancelled: n, timeout });
    w.onBossPhase(b, b.phaseIdx);
    // any gate parts that survived a timeout are blown off
    for (const p of b.parts) if (p.gate && p.alive && !p.visual) { p.alive = false; w.ev('partKill', { x: p.x, y: p.y, big: true }); }
    if (b.phaseIdx + 1 < def.phases.length) {
        const lines = w.op && !w.endless ? w.op.bossPhases : null;
        if (lines && lines[b.phaseIdx]) { const [who, text] = lines[b.phaseIdx]; w.ev('comms', { who, text }); }
        b.transT = 1.6;
        b.invuln = true;
        b.gen = null;
        for (const p of b.parts) p.script = null;
    } else {
        b.dying = true;
        b.dieT = 0;
        b.invuln = true;
        b.gen = null;
        w.ev('bossDying', { x: b.x, y: b.y, id: b.bossId });
    }
}

function updateBoss(b, w, dt) {
    const def = b.bdef;
    if (b.dying) {
        b.dieT += dt;
        if (def.sink) b.y += dt * 12;
        if (b.dieT > 3.4) w.bossDefeated(b);
        def.layout(b, w);
        return;
    }
    if (b.entering) {
        if (def.enter(b, w, dt)) { b.entering = false; startPhase(b, w, 0); }
        def.layout(b, w);
        return;
    }
    if (b.transT > 0) {
        b.transT -= dt;
        b.phase.move(b, w, dt);
        def.layout(b, w);
        if (b.transT <= 0) startPhase(b, w, b.phaseIdx + 1);
        return;
    }
    b.phaseT += dt;
    const ph = b.phase;
    ph.move(b, w, dt);
    def.layout(b, w);
    if (w.player.alive) {
        runGen(b, dt);
        for (const p of b.parts) if (p.alive && p.script) {
            const h = { gen: p.script, wait: p.wait };
            runGen(h, dt);
            p.script = h.gen; p.wait = h.wait;
            if (p.alive && p.id[0] === 't' && p.id !== 'tail') p.rot = aimAngle(w, p.x, p.y) + Math.PI / 2;
        }
    }
    let over = false, timeout = false;
    if (ph.gate === 'parts') over = b.parts.every((p) => !p.gate || !p.alive);
    else if (ph.gate === 'time') { b.timeLeft = ph.time - b.phaseT; over = b.phaseT >= ph.time; }
    else over = b.hp <= 0;
    if (!over && b.phaseT > PHASE_LIMIT) { over = true; timeout = true; }
    if (over) endPhase(b, w, timeout);
}

/** Phase HP for the HUD: 0..1 for the current phase. */
export function bossHealth(b) {
    if (!b || !b.phase) return 1;
    const ph = b.phase;
    if (ph.gate === 'parts') {
        let hp = 0, max = 0;
        for (const p of b.parts) if (p.gate) { max += p.maxHp; hp += p.alive ? Math.max(0, p.hp) : 0; }
        return max ? hp / max : 0;
    }
    if (ph.gate === 'time') return Math.max(0, (b.timeLeft ?? ph.time) / ph.time);
    return Math.max(0, b.hp / b.maxHp);
}

export { angDiff };
