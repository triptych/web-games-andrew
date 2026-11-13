// UFOops! — the simulation. Pure: no DOM, no canvas, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input each step: { x, y, beam, a, drop, cmd }
//   x, y   stick in [-1, 1], y down
//   beam   held: the tractor beam is on while this is true
//   a      pressed since the last step (starts an episode from its title card)
//   drop   pressed since the last step (drops the last specimen aboard)
//   cmd    a menu command: { t: 'go' } | { t: 'upgrade', id } | { t: 'next' }

import { UFO, BEAM, DROP, MOTHER, DEFECT, CEIL, FLOOR, SCORE, GRADES, GRADE_BONUS } from '../config.js';
import { SPECIMENS, LEVELS, UPGRADES, LINES } from './data.js';
import { makeRng, mixSeed } from '../rng.js';
import { startLevel, level, holdCap, hullMax, intakeX, spawnSpecimen } from './world.js';
import { updateSpecimens, updateEnemies, updateShots, updateJets, updatePickups, updateRespawns } from './actors.js';

export { holdCap, hullMax, intakeX, level };

export function newGame(seed = 1, startAt = 0) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(mixSeed(seed)),
        t: 0,
        level: startAt,
        score: 0,
        lives: UFO.lives,
        up: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
        nextId: 1,
        grades: [],
        line: '',
        events: [],                 // { type, ... } since the last drain; never saved
    };
    startLevel(G);
    return G;
}

const NOINPUT = { x: 0, y: 0, beam: false, a: false, drop: false, cmd: null };

/** Advance one fixed step. */
export function step(G, inp = NOINPUT, dt) {
    if (G.phase === 'over' && inp.cmd?.t === 'continue') { continueGame(G); return; }
    if (G.phase === 'over' || G.phase === 'won') return;
    G.t += dt;
    const cmd = inp.cmd;
    if (G.phase === 'brief') {
        if (inp.a || cmd?.t === 'go') { G.phase = 'play'; G.events.push({ type: 'go', level: G.level }); }
        return;
    }
    if (G.phase === 'report') { reportCmd(G, cmd); return; }
    if (G.phase !== 'play') return;

    G.lt += dt;
    G.timeLeft -= dt;
    stepUfo(G, inp, dt);
    updateSpecimens(G, dt);
    updateEnemies(G, dt);
    updateShots(G, dt);
    updateJets(G, dt);
    updatePickups(G, dt);
    updateRespawns(G, dt);
    if (G.phase !== 'play') return;          // a crash may have ended the game
    stepMother(G, dt);
}

// ------------------------------------------------------------------ the saucer
function stepUfo(G, inp, dt) {
    const u = G.ufo;
    for (const k in u.fx) u.fx[k] = Math.max(0, u.fx[k] - dt);
    u.inv = Math.max(0, u.inv - dt);
    u.dropCd = Math.max(0, u.dropCd - dt);
    u.fullT = Math.max(0, u.fullT - dt);

    if (u.dead > 0) {
        u.dead -= dt;
        u.vy += 14 * dt;                      // the wreck falls
        u.y = Math.min(FLOOR + 1.5, u.y + u.vy * dt);
        if (u.dead <= 0) {
            if (G.lives <= 0) { G.phase = 'over'; G.events.push({ type: 'over', score: G.score }); return; }
            Object.assign(u, { x: intakeX(G), y: 3.2, vx: 0, vy: 0, hull: hullMax(G), energy: 100, lock: false, inv: 2.5, defects: 0, glitch: null });
            G.events.push({ type: 'respawn' });
        }
        return;
    }

    // glitches: the saucer is not quite right
    if (u.glitch) {
        u.glitch.t -= dt;
        if (u.glitch.t <= 0) u.glitch = null;
    } else {
        const p = (DEFECT.base + DEFECT.perDefect * u.defects) * (G.up.tape ? 0.5 : 1);
        if (G.rng() < p * dt) {
            const kind = G.rng.pick(['sputter', 'hiccup', 'honk']);
            u.glitch = { kind, t: kind === 'sputter' ? DEFECT.sputter : kind === 'honk' ? DEFECT.honk : 0.15 };
            if (kind === 'hiccup') {
                u.vy = -DEFECT.hiccup * G.rng.range(0.6, 1);
                u.vx += G.rng.range(-1, 1) * DEFECT.hiccup;
            }
            G.events.push({ type: 'glitch', kind });
        }
    }
    const gk = u.glitch?.kind;

    // the beam
    const wantBeam = !!inp.beam && !u.lock && u.fx.net <= 0 && gk !== 'honk';
    if (wantBeam && !u.beam) G.events.push({ type: 'beamon' });
    if (!wantBeam && u.beam) G.events.push({ type: 'beamoff' });
    u.beam = wantBeam;
    if (u.beam) {
        u.energy -= BEAM.drain * (1 - 0.25 * G.up.coolant) * dt;
        if (u.energy <= 0) {
            u.energy = 0; u.lock = true; u.beam = false;
            G.events.push({ type: 'overheat' });
        }
    } else {
        u.energy = Math.min(100, u.energy + BEAM.recharge * dt);
        if (u.lock && u.energy >= BEAM.relock) u.lock = false;
    }

    // flying
    let ix = inp.x || 0, iy = inp.y || 0;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    if (u.fx.dazzle > 0) { ix = -ix; iy = -iy; }   // seeing spots: everything's backwards
    let speed = UFO.speed * (1 + 0.1 * G.up.speed);
    if (u.fx.turbo > 0) speed *= 1.5;
    if (u.beam) speed *= UFO.beamSlow;
    if (u.fx.net > 0) speed *= 0.45;
    speed *= 1 - UFO.holdSlow * u.hold.length;
    let tx = ix * speed, ty = iy * speed;
    if (gk === 'sputter') { tx = u.vx * 0.5; ty = 4; }
    const k = 1 - Math.exp(-(UFO.accel / UFO.speed) * dt * 3);
    u.vx += (tx - u.vx) * k;
    u.vy += (ty - u.vy) * k;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.x < 1.4) { u.x = 1.4; u.vx = 0; }
    if (u.x > G.W - 1.4) { u.x = G.W - 1.4; u.vx = 0; }
    if (u.y < CEIL) { u.y = CEIL; u.vy = 0; }
    if (u.y > FLOOR) { u.y = FLOOR; u.vy = 0; }

    // dropping a specimen
    if (inp.drop && u.dropCd <= 0) {
        if (u.hold.length) {
            const kind = u.hold.pop();
            spawnSpecimen(G, kind, u.x, { y: u.y + 0.6 + SPECIMENS[kind].h, state: 'fall', vy: 2, noBeam: 0.7, dropped: true });
            u.dropCd = DROP.cooldown;
            G.events.push({ type: 'drop', kind, x: u.x, y: u.y });
        } else G.events.push({ type: 'empty' });
    }
}

// ------------------------------------------------------------------ the Mother Ship
export const canDock = (G) => (level(G).boss ? G.bossDown : G.stats.bankedN >= level(G).quota);
export const inIntake = (G) => Math.abs(G.ufo.x - intakeX(G)) < MOTHER.intakeHalf && G.ufo.y < MOTHER.intakeY;

function bank(G) {
    const u = G.ufo;
    if (!u.hold.length) return;
    let pts = 0;
    for (const kind of u.hold) {
        pts += SPECIMENS[kind].value;
        G.stats.banked[kind] = (G.stats.banked[kind] || 0) + 1;
        G.stats.bankedN++;
    }
    G.score += pts;
    G.events.push({ type: 'bank', n: u.hold.length, pts, kinds: [...u.hold] });
    u.hold = [];
    if (!G.quotaMet && canDock(G)) { G.quotaMet = true; G.events.push({ type: 'quota' }); }
}

function stepMother(G, dt) {
    const u = G.ufo;
    const L = level(G);
    if (L.boss && G.bossDown && !G.quotaMet) { G.quotaMet = true; G.events.push({ type: 'quota' }); }
    if (u.dead <= 0 && inIntake(G)) {
        bank(G);
        if (canDock(G)) {
            u.dockT += dt;
            if (u.dockT >= MOTHER.dockTime) { endLevel(G, true); return; }
        }
    } else u.dockT = Math.max(0, u.dockT - dt * 2);
    if (!G.hurried && G.timeLeft <= 15) { G.hurried = true; G.events.push({ type: 'hurry' }); }
    if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        if (u.dead <= 0) bank(G);            // Mother hauls you up with whatever you've got
        endLevel(G, canDock(G));
    }
}

// ------------------------------------------------------------------ the report card
export function gradeFor(G, success) {
    if (!success) return 'F';
    const L = level(G), st = G.stats;
    let pts = 1;
    pts += st.hits === 0 ? 2 : st.hits <= 2 ? 1 : 0;
    if (L.boss) {
        pts += 2;
        pts += G.timeLeft > 60 ? 2 : G.timeLeft > 25 ? 1 : 0;
    } else {
        const variety = Object.keys(st.banked).length;
        pts += variety >= 4 ? 2 : variety >= 3 ? 1 : 0;
        if (L.order && st.banked[L.order]) pts += 1;
        pts += Math.min(2, Math.floor(Math.max(0, st.bankedN - L.quota) / 2));
    }
    return pts >= 7 ? 'A+' : pts >= 5 ? 'A' : pts >= 4 ? 'B' : pts >= 2 ? 'C' : 'D';
}

function endLevel(G, success) {
    const L = level(G), st = G.stats;
    const grade = gradeFor(G, success);
    const timeBonus = success ? Math.floor(G.timeLeft) * SCORE.timeBonus : 0;
    const extras = L.boss ? 0 : Math.max(0, st.bankedN - L.quota);
    const gradeBonus = GRADE_BONUS[grade];
    G.score += timeBonus + gradeBonus + extras * SCORE.extra;
    if (!success) G.lives--;
    const last = success && G.level === LEVELS.length - 1;
    G.report = {
        level: G.level, grade, success, quota: L.quota, bankedN: st.bankedN, banked: { ...st.banked },
        variety: Object.keys(st.banked).length, hits: st.hits, bonks: st.bonks, crashes: st.crashes,
        order: L.order, orderMet: !!(L.order && st.banked[L.order]), extras, timeLeft: Math.floor(G.timeLeft),
        timeBonus, gradeBonus, extraBonus: extras * SCORE.extra, last, gameOver: !success && G.lives <= 0,
        line: G.rng.pick(LINES.grade[grade]),
    };
    if (success) G.grades.push(grade);
    G.offers = success && !last ? offerUpgrades(G) : [];
    G.phase = 'report';
    G.ufo.beam = false;
    G.events.push({ type: 'report', grade, success });
}

function offerUpgrades(G) {
    const open = Object.keys(UPGRADES).filter((k) => G.up[k] < UPGRADES[k].max);
    const out = [];
    while (out.length < 3 && open.length) out.push(open.splice(Math.floor(G.rng() * open.length), 1)[0]);
    return out;
}

function reportCmd(G, cmd) {
    if (!cmd) return;
    const r = G.report;
    if (r.success) {
        if (G.offers.length) {
            if (cmd.t !== 'upgrade' || !G.offers.includes(cmd.id)) return;
            G.up[cmd.id]++;
            if (cmd.id === 'warranty') G.lives++;
            G.events.push({ type: 'upgrade', id: cmd.id });
        } else if (cmd.t !== 'next' && cmd.t !== 'upgrade') return;
        if (r.last) { G.phase = 'won'; G.events.push({ type: 'won', score: G.score }); return; }
        G.level++;
    } else {
        if (cmd.t !== 'next') return;
        if (r.gameOver) { G.phase = 'over'; G.events.push({ type: 'over', score: G.score }); return; }
    }
    startLevel(G);
    G.events.push({ type: 'level', level: G.level });
}

/** Arcade-style continue: the same episode again with fresh saucers, at the cost of half the score. */
export function continueGame(G) {
    if (G.phase !== 'over') return;
    G.lives = UFO.lives;
    G.score = Math.floor(G.score / 2);
    G.continues = (G.continues || 0) + 1;
    startLevel(G);
    G.events.push({ type: 'continue', level: G.level });
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.specs) || !d.ufo || typeof d.level !== 'number' || !LEVELS[d.level]) {
        throw new Error('unknown or damaged save');
    }
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
