// The game simulation: Thimble's physics, drilling, hazards, the economy and saves.
// Pure: no DOM, no WebGL, no Math.random. The view reads G and drains G.events.

import {
    W, H, T, RIG, ORES, RELICS, ARTIFACTS, UPGRADES, ITEMS, STRATA, BUILDINGS, WAYSTONES,
    FUEL_PRICE, REPAIR_PRICE, RESCUE_FEE, WAYSTONE_MARKUP, HEAT_DEPTH, GATE_ROW, ARENA_TOP, START_X,
} from '../config.js';
import { generateWorld, tileAt, auxAt, stratAt, setTile, hardnessAt, idx, inBounds } from './world.js';
import { makeRng } from '../rng.js';
import { storyEvent, storyTick, newStoryState } from './story.js';
import { updateBoss, startBoss, bossBlast } from './boss.js';

const SKY_CEIL = 11;

export function newGame(seed = 1, name = 'Rook') {
    const world = generateWorld(seed);
    const G = {
        v: 1,
        seed,
        name: (name || 'Rook').slice(0, 16),
        world,
        rng: makeRng(seed * 7 + 3),
        time: 0,
        money: 40,
        up: { drill: 0, hull: 0, tank: 0, vanes: 0, cargo: 0, lantern: 0, ward: 0 },
        items: { blast: 1, great: 0, recall: 0, mend: 0, flask: 0 },
        relics: RELICS.map(() => false),
        waystones: WAYSTONES.map(() => false),
        cargo: ORES.map(() => 0),
        pendingArtifacts: [],
        found: [],                 // artifact ids ever found
        codex: [],                 // lore keys unlocked, in order
        rig: null,
        boulders: [],
        wisps: [],
        boss: null,
        gateOpen: false,
        bossDefeated: false,
        ended: false,
        down: null,                // { reason, t } while waiting for the Guild's rescue
        at: null,                  // building key or 'waystone:N' the rig is parked at
        stats: { dug: 0, ore: 0, earned: 0, deepest: 0, rescues: 0, relics: 0, contracts: 0, time: 0, blasts: 0 },
        story: newStoryState(),
        events: [],
        cool: {},                  // throttles for repeated messages
    };
    const S = derived(G);
    G.rig = {
        x: START_X, y: RIG.halfH, vx: 0, vy: 0, face: 1, grounded: true,
        fuel: S.tank, hull: S.hull, drill: null, thrust: false, iframe: 0, zeroFuel: 0,
        lastStratum: 0, heat: 0,
    };
    markSeen(G);
    return G;
}

// ------------------------------------------------------------------
// Derived stats: upgrades × relics
// ------------------------------------------------------------------
export function derived(G) {
    const u = G.up, R = G.relics;
    const d = UPGRADES.drill.tiers[u.drill];
    return {
        drillPower: d.power + (R[6] ? 1 : 0),
        drillSpeed: d.speed * (R[2] ? 1.4 : 1) * (R[6] ? 1.15 : 1),
        hull: UPGRADES.hull.tiers[u.hull].value,
        tank: UPGRADES.tank.tiers[u.tank].value,
        vanes: UPGRADES.vanes.tiers[u.vanes].value * (R[1] ? 1.1 : 1),
        cargo: Math.round(UPGRADES.cargo.tiers[u.cargo].value * (R[3] ? 1.5 : 1)),
        lantern: UPGRADES.lantern.tiers[u.lantern].value,
        ward: R[4] ? 1 : UPGRADES.ward.tiers[u.ward].value,
        burn: R[5] ? 0.75 : 1,
        featherfall: R[1],
        sense: R[0] ? 6.5 : 0,
        regen: R[5] ? 0.004 : 0,
    };
}

export const cargoCount = (G) => G.cargo.reduce((a, b) => a + b, 0);
export const cargoValue = (G) => G.cargo.reduce((a, n, i) => a + n * ORES[i].value, 0);
export const depthOf = (G) => Math.max(0, Math.floor(-(G.rig.y - RIG.halfH)));
export const rigCell = (G) => ({ c: Math.floor(G.rig.x), r: Math.floor(-G.rig.y) });

function emit(G, type, data = {}) { G.events.push({ type, ...data }); }
export function bark(G, key, text, cooldown = 0) {
    if (cooldown > 0) {
        if ((G.cool[key] ?? -1e9) > G.time - cooldown) return;
        G.cool[key] = G.time;
    }
    emit(G, 'bark', { key, text });
}
function say(G, key, text, cooldown = 4) {
    if ((G.cool[key] ?? -1e9) > G.time - cooldown) return;
    G.cool[key] = G.time;
    emit(G, 'msg', { key, text });
}

// ------------------------------------------------------------------
// Damage, fuel, rescue
// ------------------------------------------------------------------
export function hurt(G, amt, kind = 'hit') {
    const rig = G.rig;
    if (G.down || amt <= 0) return;
    rig.hull = Math.max(0, rig.hull - amt);
    emit(G, 'hurt', { amt, kind });
    if (rig.hull <= 0) goDown(G, kind === 'heat' ? 'heat' : 'wreck');
}

function goDown(G, reason) {
    if (G.down) return;
    G.down = { reason, t: 0 };
    G.rig.drill = null;
    emit(G, 'down', { reason });
}

/** The surface spot nearest the Spire with solid ground under it (the player may have dug the start away). */
export function surfaceSpot(G) {
    for (let d = 0; d < W; d++) {
        for (const sgn of [1, -1]) {
            const c = Math.floor(START_X) + d * sgn;
            if (c >= 0 && c < W && tileAt(G.world, c, 0) !== T.EMPTY) return c + 0.5;
        }
    }
    return START_X;
}
function parkOnSurface(G) {
    Object.assign(G.rig, { x: surfaceSpot(G), y: RIG.halfH, vx: 0, vy: 0, drill: null, grounded: true, zeroFuel: 0 });
}

export function doRescue(G) {
    const S = derived(G);
    const fee = Math.floor(G.money * RESCUE_FEE);
    const lost = cargoCount(G);
    G.money -= fee;
    G.cargo.fill(0);
    const rig = G.rig;
    parkOnSurface(G);
    rig.fuel = Math.max(rig.fuel, S.tank * 0.3);
    rig.hull = Math.max(rig.hull, S.hull * 0.3);
    G.down = null;
    G.wisps.length = 0;
    if (G.boss && !G.bossDefeated) G.boss.active = false;
    G.stats.rescues++;
    emit(G, 'rescued', { fee, lost });
    storyEvent(G, { type: 'rescued' });
}

// ------------------------------------------------------------------
// Main step
// ------------------------------------------------------------------
/**
 * inp: { x: -1..1, up: bool, down: bool }
 */
export function step(G, inp, dt) {
    if (G.ended) return;
    G.time += dt;
    G.stats.time += dt;
    const rig = G.rig;
    const S = derived(G);

    if (G.down) {
        G.down.t += dt;
        if (G.down.t > 2.4) doRescue(G);
        return;
    }

    rig.iframe = Math.max(0, rig.iframe - dt);
    const depth = depthOf(G);
    const underground = rig.y < RIG.halfH - 0.05;

    // --- Drilling in progress ---
    if (rig.drill) {
        updateDrill(G, S, dt);
    } else {
        movement(G, S, inp, dt);
        tryStartDrill(G, S, inp);
    }

    // --- Aether ---
    let burn = 0;
    if (underground) burn += RIG.burnIdle;
    if (rig.thrust) burn += RIG.burnThrust;
    if (rig.drill) burn += RIG.burnDrill;
    if (Math.abs(rig.vx) > 0.4 && rig.grounded && underground) burn += RIG.burnMove;
    rig.fuel = Math.max(0, rig.fuel - burn * S.burn * dt);
    if (rig.fuel <= 0 && underground) {
        rig.zeroFuel += dt;
        if (rig.zeroFuel > 0.6) goDown(G, 'fuel');
    } else rig.zeroFuel = 0;
    if (rig.fuel < S.tank * 0.2 && underground) say(G, 'lowfuel', 'Aether running low — head for the surface.', 12);

    // --- Heat ---
    if (depth >= HEAT_DEPTH && rig.y < 0 && S.ward < 1) {
        const dps = (0.7 + (depth - HEAT_DEPTH) * 0.011) * (1 - S.ward);
        rig.heat = dps;
        hurt(G, dps * dt, 'heat');
        if (dps > 0.25) say(G, 'heat', 'The heat is cooking the hull! Frostward runes would help.', 18);
    } else rig.heat = 0;

    // --- Heart of Kharadun mends ---
    if (S.regen > 0 && rig.hull < S.hull) rig.hull = Math.min(S.hull, rig.hull + S.hull * S.regen * dt);
    if (rig.hull < S.hull * 0.25 && underground) say(G, 'lowhull', 'Hull failing! Get back to Pell\'s Forge.', 14);

    updateBoulders(G, dt);
    updateWisps(G, S, dt, depth);
    if (G.boss) updateBoss(G, dt, { hurt: (a, k) => hurtFromFoe(G, a, k), emit: (t, d) => emit(G, t, d) });
    else if (G.gateOpen && rig.y < -(ARENA_TOP + 1) && !G.bossDefeated) startBoss(G);

    // --- Where are we parked? ---
    G.at = null;
    if (rig.grounded && !rig.drill) {
        if (Math.abs(rig.y - RIG.halfH) < 0.02) {
            const b = BUILDINGS.find((bb) => rig.x >= bb.x0 && rig.x <= bb.x1);
            if (b) G.at = b.key;
        } else {
            const c = Math.floor(rig.x), r = Math.round(-(rig.y - RIG.halfH));
            if (tileAt(G.world, c, r) === T.WAYSTONE) {
                const id = auxAt(G.world, c, r);
                G.at = 'waystone:' + id;
                if (!G.waystones[id]) {
                    G.waystones[id] = true;
                    emit(G, 'waystone', { id });
                    storyEvent(G, { type: 'waystone', id });
                }
            }
        }
    }

    // --- Depth bookkeeping ---
    if (depth > G.stats.deepest) {
        G.stats.deepest = depth;
        storyEvent(G, { type: 'depth', depth });
    }
    const s = rig.y < 0 ? stratAt(G.world, Math.floor(rig.x), Math.floor(-rig.y)) : 0;
    if (s !== rig.lastStratum) {
        rig.lastStratum = s;
        if (rig.y < 0) { emit(G, 'stratum', { s }); storyEvent(G, { type: 'stratum', s }); }
    }

    if ((G._seenT = (G._seenT ?? 0) + dt) > 0.2) { G._seenT = 0; markSeen(G); }
    storyTick(G, dt);
}

function movement(G, S, inp, dt) {
    const rig = G.rig;
    const hw = RIG.halfW, hh = RIG.halfH;
    const ix = Math.max(-1, Math.min(1, inp.x || 0));
    if (ix !== 0) rig.face = ix > 0 ? 1 : -1;
    const maxRun = RIG.maxRun * (0.75 + 0.25 * S.vanes);
    if (ix !== 0) {
        rig.vx += ix * RIG.accel * dt;
        rig.vx = Math.max(-maxRun, Math.min(maxRun, rig.vx));
    } else {
        const f = (rig.grounded ? RIG.friction : RIG.airDrag) * dt;
        rig.vx = Math.abs(rig.vx) <= f ? 0 : rig.vx - Math.sign(rig.vx) * f;
    }
    rig.thrust = !!inp.up && rig.fuel > 0;
    if (rig.thrust) {
        rig.vy += RIG.thrust * S.vanes * dt;
        rig.vy = Math.min(rig.vy, RIG.maxUp * Math.sqrt(S.vanes));
    }
    rig.vy -= RIG.gravity * dt * (S.featherfall && rig.vy < 0 && !inp.down ? 0.8 : 1);
    rig.vy = Math.max(rig.vy, -RIG.maxFall * (S.featherfall ? 0.75 : 1));

    // X axis
    rig.x += rig.vx * dt;
    if (rig.x - hw < 0) { rig.x = hw; rig.vx = 0; }
    if (rig.x + hw > W) { rig.x = W - hw; rig.vx = 0; }
    {
        const r0 = Math.floor(-(rig.y + hh) + 1e-6), r1 = Math.floor(-(rig.y - hh) - 1e-6);
        const c0 = Math.floor(rig.x - hw), c1 = Math.floor(rig.x + hw - 1e-9);
        for (let r = r0; r <= r1; r++) {
            if (rig.vx > 0 && solidForRig(G, c1, r)) { rig.x = c1 - hw; rig.vx = 0; }
            else if (rig.vx < 0 && solidForRig(G, c0, r)) { rig.x = c0 + 1 + hw; rig.vx = 0; }
        }
    }
    // Y axis
    const vyBefore = rig.vy;
    rig.y += rig.vy * dt;
    if (rig.y + hh > SKY_CEIL) { rig.y = SKY_CEIL - hh; rig.vy = Math.min(0, rig.vy); }
    rig.grounded = false;
    {
        const c0 = Math.floor(rig.x - hw + 1e-6), c1 = Math.floor(rig.x + hw - 1e-6);
        const r0 = Math.floor(-(rig.y + hh) + 1e-9), r1 = Math.floor(-(rig.y - hh) - 1e-9);
        for (let c = c0; c <= c1; c++) {
            if (rig.vy <= 0 && solidForRig(G, c, r1)) {
                rig.y = -r1 + hh;
                if (vyBefore < -RIG.fallSafe && !S.featherfall) {
                    hurt(G, (-vyBefore - RIG.fallSafe) * RIG.fallDmg, 'fall');
                }
                if (vyBefore < -3) emit(G, 'land', { v: -vyBefore });
                rig.vy = 0;
                rig.grounded = true;
            } else if (rig.vy > 0 && solidForRig(G, c, r0)) {
                rig.y = -(r0 + 1) - hh;
                rig.vy = 0;
                emit(G, 'bonk', {});
            }
        }
    }
    // Standing exactly on a floor counts as grounded even with zero velocity.
    if (!rig.grounded && rig.vy <= 0) {
        const feet = rig.y - hh;
        const r = Math.round(-feet);
        if (Math.abs(-feet - r) < 1e-4) {
            const c0 = Math.floor(rig.x - hw + 1e-6), c1 = Math.floor(rig.x + hw - 1e-6);
            for (let c = c0; c <= c1; c++) if (solidForRig(G, c, r)) { rig.grounded = true; rig.vy = 0; }
        }
    }
}

function solidForRig(G, c, r) {
    if (r < 0) return false;
    return tileAt(G.world, c, r) !== T.EMPTY;
}

// ------------------------------------------------------------------
// Drilling
// ------------------------------------------------------------------
function tryStartDrill(G, S, inp) {
    const rig = G.rig;
    if (!rig.grounded || rig.fuel <= 0) return;
    const hw = RIG.halfW, hh = RIG.halfH;
    let c, r, dir;
    if (inp.down && !inp.up && Math.abs(inp.x || 0) < 0.5) {
        c = Math.floor(rig.x);
        r = Math.round(-(rig.y - hh));
        dir = 'down';
    } else if (Math.abs(inp.x || 0) >= 0.5) {
        const sx = Math.sign(inp.x);
        const probe = sx > 0 ? rig.x + hw + 0.03 : rig.x - hw - 0.03;
        c = Math.floor(probe);
        r = Math.floor(-rig.y);
        if (c === Math.floor(rig.x)) return;
        if (c < 0 || c >= W) return;
        dir = sx > 0 ? 'right' : 'left';
    } else return;
    const t = tileAt(G.world, c, r);
    if (t === T.EMPTY || r < 0) return;

    const hard = hardnessAt(G.world, c, r);
    if (t === T.GATE) {
        if (!G.relics[6]) { say(G, 'gate', 'The Rune Gate. The runes say: only star-iron may pass.', 5); storyEvent(G, { type: 'gate-touch' }); return; }
    } else if (t === T.SHARD) {
        if (!G.relics[6]) { say(G, 'shard', 'The shard hums. Only star-iron could break it.', 5); return; }
    } else if (t === T.HEART) {
        // the end of the road
    } else if (!Number.isFinite(hard)) {
        if (t === T.RUNESTONE) say(G, 'rune', 'Warded runestone — only a Blast Rune will break it.');
        else if (t === T.BOULDER) say(G, 'boulder', 'A loose boulder. Blast it, or dig around it.');
        else if (t === T.WAYSTONE) return;
        else say(G, 'bedrock', 'Bedrock. Nothing breaks this.');
        return;
    } else if (hard > S.drillPower + 1) {
        say(G, 'hard', `Too hard for the ${UPGRADES.drill.tiers[G.up.drill].name}. Fennick's Forge has better augers.`, 5);
        emit(G, 'too-hard', { c, r });
        return;
    }

    let dur = (RIG.drillBase + RIG.drillPerHard * Math.min(hard, 7)) / S.drillSpeed;
    if (t === T.SHARD) dur = 2.6;
    if (t === T.GATE) dur = 1.5;
    if (t === T.HEART) dur = 0.6;
    if (t === T.ORE) dur *= 1 + ORES[auxAt(G.world, c, r)].id * 0.015;
    dur = Math.max(0.22, dur);

    const toX = c + 0.5;
    const toY = dir === 'down' ? -(r + 1) + hh : rig.y;
    rig.drill = { c, r, t: 0, dur, fromX: rig.x, fromY: rig.y, toX, toY, dir, tile: t, strat: stratAt(G.world, c, r) };
    rig.vx = 0; rig.vy = 0;
    if (dir !== 'down') rig.face = dir === 'right' ? 1 : -1;
    emit(G, 'drill-start', { c, r, tile: t, hard, dir, dur });
}

function updateDrill(G, S, dt) {
    const rig = G.rig, d = rig.drill;
    rig.thrust = false;
    d.t += dt;
    const p = Math.min(1, d.t / d.dur);
    // grind in place for the first third, then push through
    const m = p < 0.35 ? 0 : (p - 0.35) / 0.65;
    const e = m * m * (3 - 2 * m);
    rig.x = d.fromX + (d.toX - d.fromX) * e;
    rig.y = d.fromY + (d.toY - d.fromY) * e;
    if (p < 1) return;
    rig.drill = null;
    rig.x = d.toX; rig.y = d.toY;
    rig.grounded = d.dir !== 'down' || tileAt(G.world, d.c, d.r + 1) !== T.EMPTY;
    digOut(G, S, d.c, d.r, true);
}

/** Remove a tile and handle whatever was in it. byDrill: Thimble collected it (vs a blast). */
function digOut(G, S, c, r, byDrill) {
    const t = tileAt(G.world, c, r);
    const a = auxAt(G.world, c, r);
    const strat = stratAt(G.world, c, r);
    if (t === T.EMPTY) return;
    if (t === T.GATE) { openGate(G); return; }
    setTile(G.world, c, r, T.EMPTY);
    G.stats.dug++;
    emit(G, 'dug', { c, r, tile: t, aux: a, strat, byDrill });

    switch (t) {
        case T.ORE: collectOre(G, S, a); break;
        case T.GAS: explode(G, c, r); break;
        case T.LAVA: {
            if (byDrill) {
                const dmg = 16 * (1 + r / 260) * (G.relics[4] ? 0.5 : 1);
                hurt(G, dmg, 'lava');
                say(G, 'lava', 'Magma! It splashes across the hull.', 3);
            }
            break;
        }
        case T.ARTIFACT: {
            G.pendingArtifacts.push(a);
            G.found.push(a);
            emit(G, 'artifact', { id: a });
            storyEvent(G, { type: 'artifact', id: a });
            break;
        }
        case T.CACHE: {
            const amount = Math.round((60 + r * 9) * (0.7 + G.rng() * 0.6) / 10) * 10;
            G.money += amount;
            G.stats.earned += amount;
            emit(G, 'cache', { amount, c, r });
            break;
        }
        case T.RELIC: {
            G.relics[a] = true;
            G.stats.relics++;
            emit(G, 'relic', { id: a });
            // a new relic may raise the hull/tank caps; top them up as a little gift
            const S2 = derived(G);
            G.rig.fuel = Math.min(S2.tank, G.rig.fuel + S2.tank * 0.25);
            storyEvent(G, { type: 'relic', id: a });
            break;
        }
        case T.SHARD: {
            if (G.boss) G.boss.shardBroken(G, c, r);
            break;
        }
        case T.WRECK: {
            storyEvent(G, { type: 'wreck' });
            break;
        }
        case T.HEART: {
            G.ended = true;
            emit(G, 'heart', {});
            storyEvent(G, { type: 'heart' });
            break;
        }
        default: break;
    }
    checkBoulderAbove(G, c, r);
}

function collectOre(G, S, id) {
    if (cargoCount(G) >= S.cargo) {
        emit(G, 'ore', { id, lost: true });
        say(G, 'full', 'The hold is full! That ore is lost. Sell at Sedge\'s Assay House.', 6);
        return;
    }
    G.cargo[id]++;
    G.stats.ore++;
    emit(G, 'ore', { id, lost: false });
    storyEvent(G, { type: 'ore', id });
    if (cargoCount(G) >= S.cargo) say(G, 'fullnow', 'Cargo hold full.', 8);
}

function openGate(G) {
    if (G.gateOpen) return;
    G.gateOpen = true;
    for (let c = 0; c < W; c++) setTile(G.world, c, GATE_ROW, T.EMPTY);
    emit(G, 'gate-open', {});
    storyEvent(G, { type: 'gate-open' });
}

function explode(G, c, r) {
    const rig = G.rig;
    emit(G, 'explode', { x: c + 0.5, y: -(r + 0.5), size: 1.6 });
    const dx = rig.x - (c + 0.5), dy = rig.y + (r + 0.5);
    const dist = Math.hypot(dx, dy);
    if (dist < 2.3) {
        hurt(G, 20 * (1 + r / 170) * (1 - dist / 3.2), 'gas');
        say(G, 'gas', 'Bogwind! A pocket of marsh-gas went up.', 3);
        rig.vx += Math.sign(dx || 1) * 4;
        rig.vy += 3;
    }
    const chain = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const t = tileAt(G.world, c + dc, r + dr);
            if (t === T.SOIL || t === T.ORE || t === T.LAVA) {
                setTile(G.world, c + dc, r + dr, T.EMPTY);
                emit(G, 'dug', { c: c + dc, r: r + dr, tile: t, aux: 0, strat: stratAt(G.world, c + dc, r + dr), byDrill: false });
                checkBoulderAbove(G, c + dc, r + dr);
            } else if (t === T.GAS) chain.push([c + dc, r + dr]);
        }
    }
    for (const [cc, rr] of chain) { setTile(G.world, cc, rr, T.EMPTY); explode(G, cc, rr); }
}

// ------------------------------------------------------------------
// Boulders
// ------------------------------------------------------------------
function checkBoulderAbove(G, c, r) {
    if (r <= 0) return;
    if (tileAt(G.world, c, r - 1) === T.BOULDER) {
        setTile(G.world, c, r - 1, T.EMPTY);
        G.boulders.push({ c, y: r - 1, vy: 0, warn: 0.45 });
        emit(G, 'boulder-loose', { c, r: r - 1 });
        checkBoulderAbove(G, c, r - 1);
    }
}

function updateBoulders(G, dt) {
    const rig = G.rig;
    for (let i = G.boulders.length - 1; i >= 0; i--) {
        const b = G.boulders[i];
        if (b.warn > 0) { b.warn -= dt; continue; }   // a shudder before it drops
        b.vy = Math.min(14, b.vy + 20 * dt);
        b.y += b.vy * dt;
        // hit Thimble?
        const bx = b.c + 0.5, by = -(b.y + 0.5);
        if (Math.abs(rig.x - bx) < 0.4 + RIG.halfW && Math.abs(rig.y - by) < 0.42 + RIG.halfH && !rig.drill) {
            hurt(G, 14 * (1 + b.y / 220), 'boulder');
            emit(G, 'boulder-hit', { x: bx, y: by });
            G.boulders.splice(i, 1);
            continue;
        }
        const below = Math.floor(b.y) + 1;
        if (tileAt(G.world, b.c, below) !== T.EMPTY || below >= H) {
            const row = below - 1;
            if (tileAt(G.world, b.c, row) === T.EMPTY) setTile(G.world, b.c, row, T.BOULDER);
            emit(G, 'boulder-land', { x: bx, y: -(row + 0.5) });
            G.boulders.splice(i, 1);
        }
    }
}

// ------------------------------------------------------------------
// Gloam wisps
// ------------------------------------------------------------------
function updateWisps(G, S, dt, depth) {
    const rig = G.rig;
    const inGloam = depth >= 290 && depth < GATE_ROW - 1 && rig.y < 0;
    if (inGloam && !G.boss) {
        G._wispT = (G._wispT ?? 4) - dt;
        const cap = 2 + Math.floor((depth - 290) / 30);
        if (G._wispT <= 0 && G.wisps.length < cap) {
            G._wispT = 6 + G.rng() * 6;
            const a = G.rng() * Math.PI * 2;
            G.wisps.push({ x: rig.x + Math.cos(a) * 9, y: rig.y + Math.sin(a) * 7, life: 26, phase: G.rng() * 6 });
            if (G.wisps.length === 1) say(G, 'wisp', 'Something cold drifts through the rock toward the light…', 30);
        }
    }
    const R = S.lantern * 0.6;
    for (let i = G.wisps.length - 1; i >= 0; i--) {
        const w = G.wisps[i];
        w.life -= dt;
        w.phase += dt;
        const dx = rig.x - w.x, dy = rig.y - w.y;
        const d = Math.hypot(dx, dy) || 1;
        let sp = 1.35 + Math.min(1.2, (depth - 290) / 100);
        if (G.relics[5] && d < R) sp = -1.2;    // the Heart's light drives them back
        w.x += (dx / d) * sp * dt + Math.cos(w.phase * 2.3) * 0.6 * dt;
        w.y += (dy / d) * sp * dt + Math.sin(w.phase * 1.7) * 0.6 * dt;
        if (d < 0.6 && rig.iframe <= 0) {
            hurt(G, 6, 'wisp');
            rig.fuel = Math.max(0, rig.fuel - 1.5);
            rig.iframe = 0.6;
            emit(G, 'wisp-pop', { x: w.x, y: w.y, hit: true });
            G.wisps.splice(i, 1);
            continue;
        }
        if (w.life <= 0 || !inGloam) { emit(G, 'wisp-pop', { x: w.x, y: w.y, hit: false }); G.wisps.splice(i, 1); }
    }
}

function hurtFromFoe(G, amt, kind) {
    if (G.rig.iframe > 0) return false;
    hurt(G, amt, kind);
    G.rig.iframe = 0.9;
    return true;
}

// ------------------------------------------------------------------
// Items
// ------------------------------------------------------------------
export function useItem(G, key) {
    if (G.down || G.ended) return false;
    if (!G.items[key]) { say(G, 'noitem', 'None left. Mirabel sells more at Runes & Remedies.', 1.5); return false; }
    const rig = G.rig, S = derived(G);
    switch (key) {
        case 'blast': case 'great': {
            if (rig.drill) return false;
            const rad = key === 'blast' ? 1 : 2;
            const { c, r } = rigCell(G);
            G.items[key]--;
            G.stats.blasts++;
            emit(G, 'blast', { x: rig.x, y: rig.y, size: rad + 0.6 });
            const gas = [];
            for (let dr = -rad; dr <= rad; dr++) {
                for (let dc = -rad; dc <= rad; dc++) {
                    const cc = c + dc, rr = r + dr;
                    if (rr < 0 || !inBounds(cc, rr)) continue;
                    const t = tileAt(G.world, cc, rr);
                    if (t === T.EMPTY || t === T.BEDROCK || t === T.GATE || t === T.SHARD || t === T.WAYSTONE ||
                        t === T.RELIC || t === T.HEART || t === T.WRECK || t === T.ARTIFACT) continue;
                    if (t === T.GAS) { gas.push([cc, rr]); continue; }
                    if (t === T.ORE) collectOre(G, S, auxAt(G.world, cc, rr));
                    if (t === T.CACHE) { digOut(G, S, cc, rr, false); continue; }
                    setTile(G.world, cc, rr, T.EMPTY);
                    emit(G, 'dug', { c: cc, r: rr, tile: t, aux: 0, strat: stratAt(G.world, cc, rr), byDrill: false });
                }
            }
            for (const [cc, rr] of gas) { setTile(G.world, cc, rr, T.EMPTY); explode(G, cc, rr); }
            for (let dc = -rad; dc <= rad; dc++) checkBoulderAbove(G, c + dc, r - rad);
            for (let i = G.wisps.length - 1; i >= 0; i--) {
                const w = G.wisps[i];
                if (Math.hypot(w.x - rig.x, w.y - rig.y) < rad + 3) { emit(G, 'wisp-pop', { x: w.x, y: w.y, hit: false }); G.wisps.splice(i, 1); }
            }
            G.boulders = G.boulders.filter((b) => Math.abs(b.c + 0.5 - rig.x) > rad + 0.5 || Math.abs(-(b.y + 0.5) - rig.y) > rad + 0.5);
            if (G.boss) bossBlast(G, rig.x, rig.y, rad + 2.5);
            rig.grounded = false;
            return true;
        }
        case 'recall': {
            G.items.recall--;
            emit(G, 'recall', { fromX: rig.x, fromY: rig.y });
            parkOnSurface(G);
            G.wisps.length = 0;
            if (G.boss && !G.bossDefeated) G.boss.active = false;
            return true;
        }
        case 'mend': {
            if (rig.hull >= S.hull - 0.5) { say(G, 'fullhull', 'The hull is already sound.', 1.5); return false; }
            G.items.mend--;
            rig.hull = Math.min(S.hull, rig.hull + S.hull * 0.4);
            emit(G, 'mend', {});
            return true;
        }
        case 'flask': {
            if (rig.fuel >= S.tank - 0.1) { say(G, 'fulltank', 'The tank is already full.', 1.5); return false; }
            G.items.flask--;
            rig.fuel = Math.min(S.tank, rig.fuel + S.tank * 0.4);
            emit(G, 'flask', {});
            return true;
        }
        default: return false;
    }
}

// ------------------------------------------------------------------
// Shops (called by the UI; return a result the UI can show)
// ------------------------------------------------------------------
export function sellAll(G) {
    let total = 0;
    const lines = [];
    G.cargo.forEach((n, i) => {
        if (n > 0) { total += n * ORES[i].value; lines.push({ id: i, n, value: n * ORES[i].value }); }
    });
    const arts = [];
    for (const a of G.pendingArtifacts) {
        total += ARTIFACTS[a].value;
        arts.push({ id: a, value: ARTIFACTS[a].value });
    }
    G.pendingArtifacts = [];
    G.cargo.fill(0);
    G.money += total;
    G.stats.earned += total;
    if (total > 0) {
        emit(G, 'sell', { amount: total });
        storyEvent(G, { type: 'sell', amount: total, lines });
    }
    return { total, lines, arts };
}

export function fuelCost(G, fill = true) {
    const S = derived(G);
    const need = Math.max(0, S.tank - G.rig.fuel);
    return Math.ceil(need * FUEL_PRICE * (G.at && G.at.startsWith('waystone') ? WAYSTONE_MARKUP : 1));
}

export function buyFuel(G) {
    const S = derived(G);
    const mul = G.at && G.at.startsWith('waystone') ? WAYSTONE_MARKUP : 1;
    const need = S.tank - G.rig.fuel;
    if (need <= 0.01) return { ok: false, why: 'full' };
    const afford = G.money / (FUEL_PRICE * mul);
    const amt = Math.min(need, afford);
    if (amt <= 0.01) return { ok: false, why: 'cash' };
    const cost = Math.ceil(amt * FUEL_PRICE * mul);
    G.money = Math.max(0, G.money - cost);
    G.rig.fuel += amt;
    if (G.rig.fuel > S.tank - 0.02) G.rig.fuel = S.tank;
    emit(G, 'buy', { what: 'fuel' });
    return { ok: true, cost, amt };
}

export function repairCost(G) {
    const S = derived(G);
    const mul = G.at && G.at.startsWith('waystone') ? WAYSTONE_MARKUP : 1;
    return Math.ceil(Math.max(0, S.hull - G.rig.hull) * REPAIR_PRICE * mul);
}

export function repair(G) {
    const S = derived(G);
    const mul = G.at && G.at.startsWith('waystone') ? WAYSTONE_MARKUP : 1;
    const need = S.hull - G.rig.hull;
    if (need <= 0.01) return { ok: false, why: 'full' };
    const amt = Math.min(need, G.money / (REPAIR_PRICE * mul));
    if (amt <= 0.01) return { ok: false, why: 'cash' };
    const cost = Math.ceil(amt * REPAIR_PRICE * mul);
    G.money = Math.max(0, G.money - cost);
    G.rig.hull += amt;
    if (G.rig.hull > S.hull - 0.02) G.rig.hull = S.hull;
    emit(G, 'buy', { what: 'repair' });
    return { ok: true, cost };
}

export function buyUpgrade(G, key) {
    const line = UPGRADES[key];
    const next = line.tiers[G.up[key] + 1];
    if (!next) return { ok: false, why: 'max' };
    if (G.money < next.price) return { ok: false, why: 'cash' };
    const before = derived(G);
    G.money -= next.price;
    G.up[key]++;
    const after = derived(G);
    // a bigger tank or hull arrives full of what you had, plus the difference
    G.rig.fuel = Math.min(after.tank, G.rig.fuel + Math.max(0, after.tank - before.tank));
    G.rig.hull = Math.min(after.hull, G.rig.hull + Math.max(0, after.hull - before.hull));
    emit(G, 'upgrade', { key, tier: G.up[key] });
    storyEvent(G, { type: 'upgrade', key, tier: G.up[key] });
    return { ok: true };
}

export function buyItem(G, key) {
    const it = ITEMS.find((i) => i.key === key);
    if (!it) return { ok: false };
    if (G.items[key] >= it.max) return { ok: false, why: 'max' };
    if (G.money < it.price) return { ok: false, why: 'cash' };
    G.money -= it.price;
    G.items[key]++;
    emit(G, 'buy', { what: key });
    return { ok: true };
}

/** Waystone travel. dest: 'surface' or a waystone id. */
export function travel(G, dest) {
    const rig = G.rig;
    if (dest === 'surface') {
        parkOnSurface(G);
    } else {
        const p = G.world.waystonePos.find((w) => w.id === dest);
        if (!p || !G.waystones[dest]) return false;
        Object.assign(rig, { x: p.c + 0.5, y: -p.r + RIG.halfH, vx: 0, vy: 0, drill: null, grounded: true });
    }
    G.wisps.length = 0;
    emit(G, 'travel', { dest });
    markSeen(G);
    return true;
}

/** After the ending's last card: back to the surface, the world open for free delving. */
export function finishEnding(G) {
    G.ended = false;
    G.story.flags.ending = true;
    parkOnSurface(G);
    const S = derived(G);
    G.rig.fuel = S.tank; G.rig.hull = S.hull;
    emit(G, 'travel', { dest: 'surface' });
}

// ------------------------------------------------------------------
// Fog of war
// ------------------------------------------------------------------
export function markSeen(G) {
    const rig = G.rig;
    const S = derived(G);
    const R = Math.max(S.lantern, 3) + 0.5;
    const cx = rig.x, cy = -rig.y;
    const r0 = Math.max(0, Math.floor(cy - R)), r1 = Math.min(H - 1, Math.ceil(cy + R));
    const c0 = Math.max(0, Math.floor(cx - R)), c1 = Math.min(W - 1, Math.ceil(cx + R));
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            if ((c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2 <= R * R) G.world.seen[idx(c, r)] = 1;
        }
    }
    if (rig.y > -8) for (let r = 0; r < 4; r++) for (let c = 0; c < W; c++) G.world.seen[idx(c, r)] = 1;
}

// ------------------------------------------------------------------
// Save / load
// ------------------------------------------------------------------
function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
function unb64(str, n) {
    const s = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
    const u8 = new Uint8Array(n);
    for (let i = 0; i < Math.min(n, s.length); i++) u8[i] = s.charCodeAt(i);
    return u8;
}

export function serialize(G) {
    const r = G.rig;
    return {
        v: G.v, seed: G.seed, name: G.name, time: G.time, money: Math.floor(G.money),
        up: { ...G.up }, items: { ...G.items }, relics: [...G.relics], waystones: [...G.waystones],
        cargo: [...G.cargo], pendingArtifacts: [...G.pendingArtifacts], found: [...G.found], codex: [...G.codex],
        gateOpen: G.gateOpen, bossDefeated: G.bossDefeated, ended: G.ended,
        stats: { ...G.stats }, story: JSON.parse(JSON.stringify(G.story)),
        rig: { x: r.x, y: r.y, fuel: r.fuel, hull: r.hull, face: r.face },
        tiles: b64(G.world.tiles), aux: b64(G.world.aux), seen: b64(G.world.seen),
        boss: G.boss ? { shards: G.boss.shards.map((s) => s.broken) } : null,
    };
}

export function deserialize(data) {
    const G = newGame(data.seed, data.name);
    const n = W * H;
    G.world.tiles = unb64(data.tiles, n);
    G.world.aux = unb64(data.aux, n);
    G.world.seen = unb64(data.seen, n);
    for (const k of ['time', 'money', 'gateOpen', 'bossDefeated', 'ended']) if (k in data) G[k] = data[k];
    Object.assign(G.up, data.up);
    Object.assign(G.items, data.items);
    G.relics = RELICS.map((_, i) => !!data.relics?.[i]);
    G.waystones = WAYSTONES.map((_, i) => !!data.waystones?.[i]);
    G.cargo = ORES.map((_, i) => data.cargo?.[i] | 0);
    G.pendingArtifacts = [...(data.pendingArtifacts || [])];
    G.found = [...(data.found || [])];
    G.codex = [...(data.codex || [])];
    Object.assign(G.stats, data.stats);
    if (data.story) G.story = Object.assign(newStoryState(), data.story);
    // Always resume parked on the surface or where the rig was, safely grounded.
    Object.assign(G.rig, { x: data.rig.x, y: data.rig.y, fuel: data.rig.fuel, hull: data.rig.hull, face: data.rig.face || 1 });
    if (G.ended) G.ended = false;          // after the ending the world stays open for free delving
    if (data.boss && G.gateOpen && !G.bossDefeated) G._bossShards = data.boss.shards;
    G.events.length = 0;
    return G;
}

export { STRATA };
