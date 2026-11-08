// SEEDFALL — the simulation's front door. Pure: no DOM, no renderer, no Math.random, no clock.
//   newGame(seed)           a fresh year
//   step(G, inp, dt)        walk the station or drive the bot; time runs
//   act(G, cmd)             everything else: dialogue, terminals, research, splicing, deploying ... -> { ok, why }
//   serialize / deserialize a JSON round trip, mid-mission and mid-sentence included
// The view reads G and drains G.events; it never writes G.

import { ZONES, UPGRADES, HARVESTERS, RES, GENS, RESEARCH } from './data.js';
import { STEP, DAY_SEC, MISSION_DAY_SEC, SPEEDS, WALK, LAUNCH_DAYS, YEAR_DAYS } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { SCENES } from './story.js';
import { SPAWN, TERMINALS, TERM_PANEL, fits, roomAt } from './layout.js';
import { generateZone } from './zonegen.js';
import { startMission, missionStep, endMission, botStats } from './mission.js';
import {
    advanceDays, endYear, canWake, canConcord, cmdResearch, cmdFabricate, cmdUpgrade, cmdBlend, cmdRelease,
    cmdHarvester, cmdColony, cmdCollect, nextDone, blueprintFor, researchState,
} from './station.js';
import { edenIndex, sequenced } from './genetics.js';

export const SAVE_V = 1;

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed),
        day: 0, speed: 1, mode: 'station', over: false, ending: null,
        me: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0, room: 'wake' }, near: null,
        res: { metal: 0, mineral: 0, flora: 0, fauna: 0 },
        samples: {}, kills: {},
        bot: { gen: 0, busy: 0, lv: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) },
        research: { done: {}, active: [] },
        vats: [], strains: [], nextId: 1,
        zones: ZONES.map((z) => ({
            visited: false, toxic: z.base[0], hostile: z.base[1], barren: z.base[2], boss: false,
            harv: Object.fromEntries(HARVESTERS.map((h) => [h.id, 0])), stock: { metal: 0, mineral: 0, flora: 0, fauna: 0 },
            colony: 0, uses: {},
        })),
        echoes: [], final: null,
        flags: {}, said: {}, queue: ['wake'], talk: null,
        mission: null, report: null,
        stats: { missions: 0, deaths: 0, kills: 0, releases: 0, blends: 0 },
        events: [],
    };
    pump(G);
    return G;
}

// ---------------------------------------------------------------- dialogue
/** Start the next queued scene if nothing is being said. Scenes play once each. */
export function pump(G) {
    while (!G.talk && G.queue.length) {
        const id = G.queue.shift();
        if (!id || !SCENES[id] || G.said[id]) continue;
        G.said[id] = true;
        G.talk = { id, i: 0 };
        G.events.push({ type: 'talk', id });
    }
}
export const talkLine = (G) => (G.talk ? SCENES[G.talk.id].lines[G.talk.i] : null);
export const talkChoices = (G) => {
    if (!G.talk) return null;
    const S = SCENES[G.talk.id];
    return S.choices && G.talk.i >= S.lines.length - 1 ? S.choices.map((c) => ({ ...c, ok: !c.need || (c.need === 'concord' && canConcord(G)) })) : null;
};
function talkNext(G) {
    if (!G.talk) return { ok: false, why: 'Nobody is talking.' };
    const S = SCENES[G.talk.id];
    if (G.talk.i < S.lines.length - 1) { G.talk.i++; return { ok: true }; }
    if (S.choices) return { ok: false, why: 'Choose.' };
    G.talk = null;
    pump(G);
    return { ok: true };
}
function talkChoose(G, id) {
    const ch = talkChoices(G);
    const c = ch?.find((x) => x.id === id);
    if (!c) return { ok: false, why: 'Not a choice now.' };
    if (!c.ok) return { ok: false, why: SCENES.no_concord.lines[0].t };
    const then = SCENES[G.talk.id].then;
    G.talk = null;
    if (then === 'final') {
        G.final = id;
        const Z = G.zones[5];
        if (id === 'purge') { Z.hostile = Math.min(Z.hostile, 30); Z.toxic = Math.min(Z.toxic, 70); }
        else {
            Z.hostile = Math.min(Z.hostile, 22); Z.toxic = Math.min(Z.toxic, 55); Z.barren = Math.min(Z.barren, 70);
            for (const o of G.zones) o.hostile = Math.max(4, o.hostile - 8);
        }
        if (G.mission) G.mission.phase = 'run';
        G.events.push({ type: 'final', id });
        G.queue.unshift(id);
    }
    pump(G);
    return { ok: true };
}

// ---------------------------------------------------------------- the station walker
function walk(G, inp, dt) {
    const m = G.me;
    m.yaw += inp.turn || 0;
    m.pitch = Math.max(-1.2, Math.min(1.2, m.pitch + (inp.pitch || 0)));
    const mx = Math.max(-1, Math.min(1, inp.x || 0)), my = Math.max(-1, Math.min(1, inp.y || 0));
    const len = Math.hypot(mx, my), k = len > 1 ? 1 / len : 1;
    const fx = Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    const dx = (fx * my - fz * mx) * k * WALK.speed * dt, dz = (fz * my + fx * mx) * k * WALK.speed * dt;
    // slide along walls: try both axes, then each alone
    if (fits(m.x + dx, m.z + dz, WALK.radius)) { m.x += dx; m.z += dz; }
    else if (fits(m.x + dx, m.z, WALK.radius)) m.x += dx;
    else if (fits(m.x, m.z + dz, WALK.radius)) m.z += dz;
    const room = roomAt(m.x, m.z);
    if (room && room !== m.room) { m.room = room; G.events.push({ type: 'room', room }); }
    G.near = nearTerminal(G);
}
/** The terminal you'd use: within reach, roughly in front of you. */
export function nearTerminal(G) {
    const m = G.me;
    const fx = Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    let best = null, bs = Infinity;
    for (const t of TERMINALS) {
        const dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz) - t.r;
        if (d > WALK.reach) continue;
        const facing = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
        if (facing < 0.25 && d > 0.6) continue;
        const s = d - facing;
        if (s < bs) { bs = s; best = t.id; }
    }
    return best;
}

// ---------------------------------------------------------------- step
/** inp = { x, y, turn, pitch, a, b, c, r }. Dialogue holds the world still. */
export function step(G, inp, dt) {
    if (G.over || G.talk) return;
    if (G.mode === 'station') {
        walk(G, inp, dt);
        const sp = SPEEDS[G.speed] || 0;
        if (sp) advanceDays(G, dt * sp / DAY_SEC);
    } else if (G.mode === 'mission') {
        missionStep(G, inp, dt);
        if (!G.over) advanceDays(G, dt / MISSION_DAY_SEC);
    }
    pump(G);
}

// ---------------------------------------------------------------- act
export function act(G, cmd) {
    const r = actInner(G, cmd || {});
    pump(G);
    return r;
}
function actInner(G, c) {
    if (c.t === 'next') return talkNext(G);
    if (c.t === 'choose') return talkChoose(G, c.id);
    if (G.over) return { ok: false, why: 'The year is over.' };
    if (G.talk) return { ok: false, why: 'Listen first.' };
    switch (c.t) {
        case 'use': return use(G, c.id);
        case 'speed': G.speed = Math.max(0, Math.min(SPEEDS.length - 1, c.i | 0)); return { ok: true };
        case 'wait': return wait(G, c);
        case 'research': return cmdResearch(G, c.id);
        case 'fabricate': return cmdFabricate(G);
        case 'upgrade': return cmdUpgrade(G, c.id);
        case 'blend': return cmdBlend(G, c.a, c.b, c.r);
        case 'release': return cmdRelease(G, c.id, c.zone);
        case 'harvester': return cmdHarvester(G, c.zone, c.kind);
        case 'colony': return cmdColony(G, c.zone);
        case 'collect': return cmdCollect(G);
        case 'deploy': return deploy(G, c.zone);
        case 'abort': if (G.mode !== 'mission') return { ok: false, why: 'No bot is down.' }; endMission(G, 'dead'); return { ok: true };
        case 'report': G.report = null; return { ok: true };
        case 'wake': if (!canWake(G)) return { ok: false, why: 'Not yet. The planet isn\'t ready.' }; endYear(G, true); return { ok: true };
        default: return { ok: false, why: 'Unknown command.' };
    }
}

const FIRST = { command: 'command', hangar: 'hangar', launch: 'hangar', lab: 'lab', research: 'research', archive: 'stasis', pod: 'pod' };
function use(G, id) {
    id = id || G.near;
    if (G.mode !== 'station') return { ok: false, why: 'Not now.' };
    const t = TERMINALS.find((x) => x.id === id);
    if (!t) return { ok: false, why: 'Nothing to use here.' };
    G.flags[id] = true;
    if (FIRST[id]) G.queue.push(FIRST[id]);
    if (id === 'iris') G.queue.push(G.said.iris ? (G.said.iris_again ? null : 'iris_again') : 'iris');
    G.events.push({ type: 'use', id });
    return { ok: true, panel: TERM_PANEL[id] };
}

function wait(G, c) {
    if (G.mode !== 'station') return { ok: false, why: 'Not during a drop.' };
    let days = c.days;
    if (c.until === 'next') { const n = nextDone(G); if (n == null) return { ok: false, why: 'Nothing is running.' }; days = n + 0.01; }
    days = Math.max(0, Math.min(days || 0, YEAR_DAYS - G.day));
    const t0 = G.day;
    advanceDays(G, days);
    return { ok: true, days: G.day - t0 };
}

export function deployCheck(G, zone) {
    const Z = G.zones[zone];
    if (!Z) return 'No such zone.';
    if (G.mode !== 'station') return 'A bot is already down.';
    if (G.bot.busy > 0) return `The bot is in the fabricator for ${Math.ceil(G.bot.busy * 24)} more hours.`;
    if (G.bot.gen < ZONES[zone].req) return `${ZONES[zone].name} needs a ${GENS[ZONES[zone].req].mk} ${GENS[ZONES[zone].req].name} or better.`;
    if (G.report) return 'Read the last report first.';
    return null;
}
function deploy(G, zone) {
    const why = deployCheck(G, zone);
    if (why) return { ok: false, why };
    advanceDays(G, LAUNCH_DAYS);
    if (G.over) return { ok: false, why: 'Reveille.' };
    const seed = (hash3(G.seed, zone, G.stats.missions) * 4294967296) >>> 0;
    const M = generateZone(zone, G.zones[zone], seed, { echoFound: G.echoes.includes(ZONES[zone].echo) });
    startMission(G, M);
    G.mode = 'mission';
    G.events.push({ type: 'deploy', zone });
    G.queue.push('land_' + ['meadow', 'rustwood', 'marsh', 'mesa', 'hollow', 'heart'][zone]);
    return { ok: true };
}

// ---------------------------------------------------------------- what to do next
/** The pinned goal: the tutorial first, then a nudge toward whatever is holding the year back. */
export function currentGoal(G) {
    const f = G.flags, eden = edenIndex(G);
    if (G.mode === 'mission') {
        const M = G.mission;
        if (M.p.carry >= M.S.cargo) return { text: 'The hold is full. Head back to the beacon.' };
        if (M.p.limp || M.p.en < 15) return { text: 'Battery low! Get back to the beacon.' };
        return { text: G.stats.missions === 0 ? 'Gather metal, crystal and plants, then return to the beacon' : 'Gather what you can, then hold Gather on the beacon' };
    }
    if (!f.command) return { text: 'Walk north up the spine to the Command Deck', term: 'command' };
    if (!f.hangar && !f.launch) return { text: 'Visit the Bot Hangar, east off the spine', term: 'hangar' };
    if (G.stats.missions === 0) return { text: 'Use the Drop Cradle: send Sprout to Landfall Meadow', term: 'launch' };
    if (G.stats.releases === 0) {
        if (!f.lab) return { text: 'Take the samples to the Gene Lab, west off the spine', term: 'lab' };
        if (G.strains.length) return { text: 'Release your strain on Landfall Meadow (Gene Splicer)', term: 'lab' };
        if (G.vats.length) return { text: 'The vat is incubating. Let time run at the Holo-table', term: 'command' };
        if (sequenced(G).length < 2) return { text: 'Sequence two genomes: drop again and sample more plants and creatures', term: 'launch' };
        return { text: 'Splice your first strain at the Gene Splicer', term: 'lab' };
    }
    if (!f.research) return { text: 'Visit the Research Lab, west off the spine', term: 'research' };
    if (canWake(G)) return { text: 'Cradle is ready. Wake the colonists from the Holo-table', term: 'command' };
    if (G.report) return { text: 'Read the mission report' };
    const nextGen = G.bot.gen + 1;
    if (nextGen < GENS.length) {
        const bp = blueprintFor(nextGen);
        if (G.research.done[bp.id] && G.bot.busy <= 0) return { text: `Fabricate the ${GENS[nextGen].mk} ${GENS[nextGen].name} at the Hangar`, term: 'hangar' };
        if (!G.research.done[bp.id] && !G.research.active.some((r) => r.id === bp.id) && researchState(G, bp.id) !== 'locked') return { text: `Research the ${bp.name}`, term: 'research' };
    }
    if (G.strains.length) return { text: `Release ${G.strains.length === 1 ? 'your strain' : G.strains.length + ' strains'} from the Gene Splicer`, term: 'lab' };
    if (G.bot.gen >= 5 && !G.final) return { text: 'Send the Gardener to the Heartroot', term: 'launch' };
    if (G.research.active.length === 0 && RESEARCH.some((r) => researchState(G, r.id) === 'ready')) return { text: 'The lab benches are idle: queue research', term: 'research' };
    return { text: `Raise the Eden Index to 80 (now ${Math.floor(eden)})`, term: 'launch' };
}

// ---------------------------------------------------------------- saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}
export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { botStats, edenIndex, canWake, canConcord, STEP };
