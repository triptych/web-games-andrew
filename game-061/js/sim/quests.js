// Procedural missions. A station's board is a pure function of (station seed, epoch, warp Mk),
// so the same universe offers the same missions at the same moment.

import { RNG, sub } from '../rng.js';
import { ITEMS, RAW, REFINED, GOODS, BOARD_EPOCH, ENEMIES } from '../config.js';
import { TEMPERAMENTS } from './species.js';
import { getSystem, lyDist, warpRange } from './galaxy.js';
import { pirateName } from './names.js';

const TYPE_NAMES = { deliver: 'Delivery', procure: 'Procurement', mining: 'Mining Contract', bounty: 'Bounty', clear: 'Clear the Nest', survey: 'Survey', salvage: 'Salvage', chart: 'Charting', envoy: 'Envoy' };
export const questTypeName = (t) => TYPE_NAMES[t] || t;

// Systems within `hops` jumps at the given range (always includes `from`).
export function nearbySystems(galaxy, from, range, hops = 2) {
    const S = galaxy.systems;
    const out = new Map([[from, 0]]);
    let frontier = [from];
    for (let h = 1; h <= hops && range > 0; h++) {
        const next = [];
        for (const f of frontier) for (const s of S) {
            if (out.has(s.id) || s.id === galaxy.core) continue;
            if (lyDist(S[f], s) <= range) { out.set(s.id, h); next.push(s.id); }
        }
        frontier = next;
    }
    return out;
}

export function boardFor(game, station) {
    const epoch = Math.floor(game.s.time / BOARD_EPOCH);
    const wmk = game.s.ship.comps.warp;
    const key = `${station.id}|${epoch}|${wmk}`;
    if (game._boards?.key === key) return game._boards.list.filter((q) => !game.s.taken[q.id]);
    const list = generateBoard(game, station, epoch, wmk);
    game._boards = { key, list };
    return list.filter((q) => !game.s.taken[q.id]);
}

function generateBoard(game, station, epoch, wmk) {
    const g = game.galaxy;
    const rng = new RNG(sub(station.seed, 'board', epoch, wmk));
    const sp = g.species[station.species];
    const T = TEMPERAMENTS[sp?.temperament || 'nomadic'];
    const sysId = Number(station.id.split(':')[0]);
    const near = nearbySystems(g, sysId, warpRange(wmk), 2);
    const n = rng.int(3, 6);
    const out = [];
    const types = Object.keys(T.missions);
    for (let i = 0; i < n; i++) {
        const type = rng.weighted(types, (t) => T.missions[t]);
        const q = makeQuest(game, station, sp, type, rng, near, `${station.id}:${epoch}:${wmk}:${i}`);
        if (q) { q.reward.credits = Math.round(q.reward.credits * 1.4 / 10) * 10; out.push(q); }
    }
    return out;
}

function pickSystem(g, near, rng, filter, preferFar = false) {
    const list = [...near.entries()].filter(([id]) => filter(g.systems[id]));
    if (!list.length) return null;
    if (preferFar) list.sort((a, b) => b[1] - a[1]);
    return preferFar && rng.chance(0.6) ? list[0][0] : rng.pick(list)[0];
}

function makeQuest(game, station, sp, type, rng, near, id) {
    const g = game.galaxy;
    const sysId = Number(station.id.split(':')[0]);
    const here = g.systems[sysId];
    const giver = { station: station.id, stationName: station.name, species: station.species, system: sysId };
    const spName = sp ? sp.name : 'Guild';
    const base = { id, type, giver, progress: 0, state: 'offer', reward: { credits: 0, standing: 3 } };
    const distFactor = (s) => (s === sysId ? 0 : lyDist(here, g.systems[s]));
    const dangerOf = (s) => g.systems[s].danger;

    if (type === 'deliver') {
        const sid = pickSystem(g, near, rng, (s) => s.hasStation && !g.species[s.stationSpecies]?.hostile, true);
        if (sid == null) return null;
        const sys = getSystem(g, sid);
        const targets = sys.stations.filter((s) => s.id !== station.id && s.kind !== 'hearth');
        if (!targets.length) return null;
        const t = rng.pick(targets);
        const goods = rng.pick(['sealed medical crates', 'diplomatic pouches', 'reactor seed cores', 'cryo-sleeping colonists', 'sealed seed vaults', 'encrypted data spools', 'ceremonial song-stones', 'unlabelled crates (don\'t ask)']);
        const n = rng.int(6, 18);
        const d = distFactor(sid);
        return { ...base, title: `Deliver ${goods} to ${t.name}`, need: 1, cargo: n,
            desc: `${spName} logistics needs ${n} units of ${goods} carried to ${t.name} in the ${g.systems[sid].name} system. Keep them dry.`,
            target: { system: sid, station: t.id, name: t.name },
            reward: { credits: Math.round(120 + n * 14 + d * 55 + dangerOf(sid) * 60), standing: 4 } };
    }
    if (type === 'procure' || type === 'mining') {
        const pool = type === 'mining' ? RAW.filter((r) => ITEMS[r].tier <= Math.min(4, 1 + game.s.ship.comps.mining) && r !== 'exotic' && r !== 'helium3')
            : [...REFINED.filter((r) => ITEMS[r].tier <= Math.min(4, game.s.ship.hull)), ...GOODS.filter((x) => x !== sp?.taboo)];
        const item = rng.pick(pool);
        const price = ITEMS[item].price;
        const n = type === 'mining' ? Math.max(10, Math.round(rng.range(400, 1100) / price)) : Math.max(3, Math.round(rng.range(250, 1100) / price));
        return { ...base, title: `${type === 'mining' ? 'Mine' : 'Procure'} ${n} ${ITEMS[item].name}`, need: n,
            desc: type === 'mining' ? `${station.name} is short of ${ITEMS[item].name}. Cut ${n} units and bring them in.` : `The ${spName} at ${station.name} want ${n} ${ITEMS[item].name}. They'll pay well above market.`,
            target: { system: sysId, station: station.id, item, name: station.name },
            reward: { credits: Math.round(n * price * (type === 'mining' ? 1.6 : 1.45) + 60), standing: 4 } };
    }
    if (type === 'bounty') {
        const sid = pickSystem(g, near, rng, (s) => s.id !== g.home && (s.danger >= 1 || s.pirate));
        if (sid == null) return null;
        const sys = getSystem(g, sid);
        const loc = rng.pick([...sys.belts, ...sys.planets]);
        const who = pirateName(rng);
        const tier = Math.min(5, dangerOf(sid) + 1);
        return { ...base, title: `Bounty: ${who}`, need: 1,
            desc: `${who}, a Reaver captain with a price on their head, was last seen near ${loc.name} in ${g.systems[sid].name}. Bring them down.`,
            target: { system: sid, near: loc.id, name: loc.name, boss: who, pos: anchor(loc, rng) },
            reward: { credits: Math.round(400 + tier * 260 + distFactor(sid) * 40), standing: 7 } };
    }
    if (type === 'clear') {
        const sid = pickSystem(g, near, rng, (s) => s.id !== g.home && getSystem(g, s.id).belts.length > 0);
        if (sid == null) return null;
        const sys = getSystem(g, sid);
        const belt = rng.pick(sys.belts);
        const n = rng.int(3, 6);
        return { ...base, title: `Clear raiders from ${belt.name}`, need: n,
            desc: `Raiders are nesting in ${belt.name}, preying on miners. Destroy ${n} of them.`,
            target: { system: sid, near: belt.id, name: belt.name, pos: anchor(belt, rng), raiders: n },
            reward: { credits: Math.round(180 * n + dangerOf(sid) * 140 + distFactor(sid) * 40), standing: 6 } };
    }
    if (type === 'survey') {
        const sid = pickSystem(g, near, rng, () => true, true);
        const sys = getSystem(g, sid);
        const k = Math.min(sys.planets.length, rng.int(2, 3));
        const ps = rng.shuffle(sys.planets.slice()).slice(0, k);
        return { ...base, title: `Survey ${k} worlds in ${g.systems[sid].name}`, need: k,
            desc: `The ${spName} want fresh survey scans of ${ps.map((p) => p.name).join(', ')}.`,
            target: { system: sid, planets: ps.map((p) => p.id), name: g.systems[sid].name, done: [] },
            reward: { credits: Math.round(140 * k + distFactor(sid) * 45), standing: 4, data: 10 * k } };
    }
    if (type === 'salvage') {
        const sid = pickSystem(g, near, rng, () => true, true);
        const a = rng.range(0, 6.28), d = rng.range(3000, 15000);
        const wreck = rng.pick(['the courier Pale Lantern', 'a Guild survey drone', `a ${spName} pilgrim ship`, 'the ore barge Grinder-9', 'an unregistered yacht']);
        return { ...base, title: `Recover the black box`, need: 1,
            desc: `We lost contact with ${wreck} in ${g.systems[sid].name}. Find the wreck and recover its flight recorder.`,
            target: { system: sid, name: `Wreck of ${wreck}`, pos: { x: Math.cos(a) * d, y: rng.range(-200, 200), z: Math.sin(a) * d }, ambush: rng.chance(0.3 + dangerOf(sid) * 0.1) },
            reward: { credits: Math.round(260 + distFactor(sid) * 50 + dangerOf(sid) * 90), standing: 5 } };
    }
    if (type === 'chart') {
        const sid = pickSystem(g, near, rng, (s) => s.id !== sysId && !game.s.visited.includes(s.id) && getSystem(g, s.id).pois.some((p) => p.kind === 'anomaly' && !p.hidden), true);
        if (sid == null) return null;
        const an = getSystem(g, sid).pois.find((p) => p.kind === 'anomaly' && !p.hidden);
        return { ...base, title: `Chart ${g.systems[sid].name}`, need: 2,
            desc: `No one has charted ${g.systems[sid].name}. Jump in, then scan the ${an.name.toLowerCase()} there.`,
            target: { system: sid, poi: an.id, name: an.name },
            reward: { credits: Math.round(300 + distFactor(sid) * 60), standing: 5, data: 25 } };
    }
    if (type === 'envoy') {
        const others = g.species.filter((x) => x.id !== station.species && !x.hostile && near.has(x.home));
        if (!others.length) return null;
        const to = rng.pick(others);
        const sys = getSystem(g, to.home);
        const st = sys.stations.find((s) => s.kind === 'embassy') || sys.stations[0];
        if (!st) return null;
        return { ...base, title: `Envoy to the ${to.name}`, need: 1, cargo: 1,
            desc: `Carry a sealed message from the ${spName} to the ${to.gov} at ${st.name}. Both peoples will remember the courtesy.`,
            target: { system: to.home, station: st.id, name: st.name, species2: to.id },
            reward: { credits: Math.round(250 + distFactor(to.home) * 50), standing: 6, standing2: 6 } };
    }
    return null;
}

function anchor(body, rng) {
    if (body.kind === 'belt') { const c = rng.pick(body.clusters); return { ...c.pos }; }
    const a = rng.range(0, 6.28), d = body.radius * 3 + 500;
    return { x: body.pos.x + Math.cos(a) * d, y: body.pos.y, z: body.pos.z + Math.sin(a) * d };
}

// ------------------------------------------------------------------ tracking
// Events: { kind: 'dock', station } | { kind: 'kill', enemy, system, tag } | { kind: 'scan', planet, system }
//         { kind: 'arrive', system } | { kind: 'poi', poi, system } | { kind: 'salvage', quest }
export function questEvent(game, ev) {
    for (const q of game.s.quests) {
        if (q.state !== 'active') continue;
        const t = q.target;
        switch (q.type) {
            case 'bounty':
                if (ev.kind === 'kill' && ev.tag === q.id) complete(game, q);
                break;
            case 'clear':
                if (ev.kind === 'kill' && ev.system === t.system && (ev.tag === q.id || ev.enemyFaction === 'reaver' || ev.enemyFaction === 'swarm')) { q.progress++; if (q.progress >= q.need) complete(game, q); else game.emit('quest', { q, text: `${q.title}: ${q.progress}/${q.need}` }); }
                break;
            case 'survey':
                if (ev.kind === 'scan' && t.planets.includes(ev.planet) && !t.done.includes(ev.planet)) { t.done.push(ev.planet); q.progress = t.done.length; if (q.progress >= q.need) complete(game, q); else game.emit('quest', { q, text: `${q.title}: ${q.progress}/${q.need}` }); }
                break;
            case 'chart':
                if (ev.kind === 'arrive' && ev.system === t.system && q.progress === 0) { q.progress = 1; game.emit('quest', { q, text: `${q.title}: system charted, now scan the anomaly` }); }
                if (ev.kind === 'poi' && ev.poi === t.poi) { q.progress = 2; complete(game, q); }
                break;
            case 'salvage':
                if (ev.kind === 'salvage' && ev.quest === q.id) complete(game, q);
                break;
            case 'deliver': case 'envoy':
                if (ev.kind === 'dock' && ev.station === t.station) {
                    delete game.s.missionCargo[q.id];
                    complete(game, q);
                }
                break;
            default: break;
        }
    }
}

// Procure/mining: hand items over while docked at the giver.
export function canTurnIn(game, q) {
    if (q.state !== 'active' || (q.type !== 'procure' && q.type !== 'mining')) return false;
    return game.s.location.docked === q.target.station && game.have(q.target.item, 'ship') >= q.need;
}
export function turnIn(game, q) {
    if (!canTurnIn(game, q)) return false;
    game.take(q.target.item, q.need, 'ship');
    complete(game, q);
    return true;
}

export function complete(game, q) {
    q.state = 'done';
    q.progress = q.need;
    const r = q.reward;
    game.s.credits += r.credits || 0;
    if (r.data) game.s.data += r.data;
    if (r.standing && q.giver.species >= 0) game.addStanding(q.giver.species, r.standing);
    if (r.standing2 && q.target.species2 != null) game.addStanding(q.target.species2, r.standing2);
    game.s.stats.quests = (game.s.stats.quests || 0) + 1;
    game.s.quests = game.s.quests.filter((x) => x !== q);
    game.s.questLog.unshift({ title: q.title, credits: r.credits, t: game.s.time });
    game.s.questLog.length = Math.min(game.s.questLog.length, 30);
    game.emit('questDone', { q, text: `Mission complete: ${q.title}  +${r.credits} cr` });
}

export function accept(game, station, q) {
    if (game.s.quests.length >= 6) return { ok: false, why: 'Mission log full (6 active)' };
    if (q.cargo && game.cargoFree() < q.cargo) return { ok: false, why: `Needs ${q.cargo} free cargo space` };
    const copy = JSON.parse(JSON.stringify(q));
    copy.state = 'active';
    copy.accepted = game.s.time;
    if (copy.cargo) game.s.missionCargo[copy.id] = copy.cargo;
    game.s.quests.push(copy);
    game.s.taken[q.id] = true;
    if (copy.type === 'chart' && game.s.location.system === copy.target.system) copy.progress = 1;
    return { ok: true, q: copy };
}

export function abandon(game, qid) {
    const q = game.s.quests.find((x) => x.id === qid);
    if (!q) return;
    delete game.s.missionCargo[qid];
    if (q.giver.species >= 0) game.addStanding(q.giver.species, -3);
    game.s.quests = game.s.quests.filter((x) => x !== q);
}

// World hooks: quest-spawned things in a system.
export function questSpawns(game, systemId) {
    const out = [];
    for (const q of game.s.quests) {
        if (q.state !== 'active' || q.target.system !== systemId) continue;
        if (q.type === 'salvage') out.push({ id: `Q:${q.id}`, kind: 'wreck', name: q.target.name, pos: q.target.pos, quest: q.id, ambush: q.target.ambush });
        if (q.type === 'bounty') out.push({ id: `QB:${q.id}`, kind: 'bountyZone', name: q.target.boss, pos: q.target.pos, quest: q.id, boss: q.target.boss });
        if (q.type === 'clear' && q.progress < q.need) out.push({ id: `QC:${q.id}`, kind: 'nest', name: `Raider nest (${q.target.name})`, pos: q.target.pos, quest: q.id, count: q.need - q.progress });
    }
    return out;
}

// Where should the nav marker point for a quest? { system, pos?, id? }
export function questNav(game, q) {
    const t = q.target;
    if (q.type === 'procure' || q.type === 'mining') return { system: q.giver.system, id: q.giver.station };
    if (t.station) return { system: t.system, id: t.station };
    if (q.type === 'salvage') return { system: t.system, id: `Q:${q.id}` };
    if (q.type === 'bounty') return { system: t.system, id: `QB:${q.id}` };
    if (q.type === 'clear') return { system: t.system, id: `QC:${q.id}` };
    if (q.type === 'chart') return { system: t.system, id: q.progress >= 1 ? t.poi : null };
    if (q.type === 'survey') { const left = t.planets.find((p) => !t.done.includes(p)); return { system: t.system, id: left }; }
    return { system: t.system };
}

export { ENEMIES };
