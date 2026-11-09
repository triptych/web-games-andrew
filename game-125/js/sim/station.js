// The Ark Meridian's year: research, vats, fabrication, harvesters, colonies and the clock. Everything idle runs
// on game days through advanceDays(), in chunks, so an hour at 16× and a bot's `wait 30` are the same arithmetic.

import { ZONES, RESEARCH, RESEARCH_BY_ID, GENS, HARVESTERS, HARV_MAX, COLONY, upgradeMax, upgradeCost, harvesterCost, colonyCost, stockCap, canAfford, pay, RES, SPECIES_BY_ID } from './data.js';
import { YEAR_DAYS, METRIC_FLOOR, BLEND_DAYS, EDEN_WIN, EDEN_HARD } from '../config.js';
import { blendTraits, pairKey, isSequenced, releaseEffect, edenIndex, strainName } from './genetics.js';
import { LOGS } from './story.js';

const emit = (G, e) => G.events.push(e);
const BEATS = [30, 90, 180, 270, 330, 355];

export const labSlots = (G) => 1 + (G.research.done.a2 ? 1 : 0) + (G.research.done.a7 ? 1 : 0);
export const vatSlots = (G) => 1 + (G.research.done.b2 ? 1 : 0) + (G.research.done.b7 ? 1 : 0);
export const canConcord = (G) => G.echoes.length >= 4 && !!G.research.done.b9;
export const canWake = (G) => !!G.final && edenIndex(G) >= EDEN_WIN;
export const logsOpen = (G) => LOGS.filter((l) => G.day >= l.day);

/** Production per day of one zone's harvesters, before the stock cap. */
export function zoneYield(G, zi) {
    const Z = G.zones[zi], out = { metal: 0, mineral: 0, flora: 0, fauna: 0 };
    const rich = 1 + 0.25 * zi, host = 1 - Z.hostile / 170;
    const eff = (G.research.done.a3 ? 1.35 : 1) * (1 + 0.25 * Z.colony * (G.research.done.a8 ? 1.5 : 1));
    for (const h of HARVESTERS) out[h.res] += h.rate * (Z.harv[h.id] || 0) * rich * host * eff;
    if (Z.colony) for (const k of RES) out[k] += 0.6 * Z.colony * (G.research.done.a8 ? 1.5 : 1);
    return out;
}

export function advanceDays(G, days) {
    let left = days;
    while (left > 1e-9 && !G.over) {
        const c = Math.min(0.25, left);
        left -= c;
        const before = G.day;
        G.day += c;
        G.bot.busy = Math.max(0, G.bot.busy - c);
        // research
        for (const r of G.research.active) r.left -= c;
        for (const r of G.research.active.filter((x) => x.left <= 0)) {
            G.research.done[r.id] = true;
            emit(G, { type: 'researched', id: r.id });
        }
        G.research.active = G.research.active.filter((x) => x.left > 0);
        // vats
        for (const v of G.vats) v.left -= c;
        for (const v of G.vats.filter((x) => x.left <= 0)) { G.strains.push(v.strain); emit(G, { type: 'strainReady', name: v.strain.name }); }
        G.vats = G.vats.filter((x) => x.left > 0);
        // harvesters and colonies
        G.zones.forEach((Z, zi) => {
            const y = zoneYield(G, zi), cap = stockCap(Z.colony);
            for (const k of RES) Z.stock[k] = Math.min(cap, Z.stock[k] + y[k] * c);
            if (G.research.done.a4) for (const k of RES) { const n = Math.floor(Z.stock[k]); if (n > 0) { G.res[k] += n; Z.stock[k] -= n; } }
            const tend = 0.05 * Z.colony * (G.research.done.a8 ? 1.5 : 1) + (G.final === 'concord' && Z.visited ? 0.04 : 0);
            if (tend) for (const m of ['toxic', 'hostile', 'barren']) Z[m] = Math.max(METRIC_FLOOR, Z[m] - tend * c);
        });
        // the calendar
        for (const b of BEATS) if (before < b && G.day >= b) G.queue.push('day' + b);
        for (const l of LOGS) if (l.day > 0 && before < l.day && G.day >= l.day) emit(G, { type: 'log', title: l.title });
        if (canWake(G) && !G.said.ready) G.queue.push('ready');
        if (G.day >= YEAR_DAYS) { G.day = YEAR_DAYS; endYear(G); }
    }
}

/** Reveille: the pods open, and the year is judged. */
export function endYear(G, early = false) {
    if (G.over) return;
    const eden = edenIndex(G);
    let ending = 'reveille';
    if (G.final && eden >= EDEN_WIN) ending = G.final;
    else if (eden >= EDEN_HARD) ending = 'hard';
    G.over = true;
    G.mission = null;
    G.mode = 'ending';
    G.ending = { kind: ending, eden: Math.round(eden * 10) / 10, day: Math.round(G.day * 10) / 10, early, dog: G.zones[1].hostile <= 30 && isSequenced(G, 'barkhound') };
    emit(G, { type: 'ending', kind: ending });
}

// ---------------------------------------------------------------- commands (station)
const no = (why) => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

export function researchState(G, id) {
    const R = RESEARCH_BY_ID[id];
    if (G.research.done[id]) return 'done';
    if (G.research.active.some((r) => r.id === id)) return 'active';
    if (!R.req.every((q) => G.research.done[q])) return 'locked';
    return canAfford(G.res, R.cost) ? 'ready' : 'poor';
}
export function cmdResearch(G, id) {
    const R = RESEARCH_BY_ID[id];
    if (!R) return no('No such project.');
    const st = researchState(G, id);
    if (st === 'done' || st === 'active') return no('Already ' + st + '.');
    if (st === 'locked') return no('Research ' + R.req.filter((q) => !G.research.done[q]).map((q) => RESEARCH_BY_ID[q].name).join(' and ') + ' first.');
    if (G.research.active.length >= labSlots(G)) return no('Every lab bench is busy.');
    if (st === 'poor') return no('Not enough materials.');
    pay(G.res, R.cost);
    G.research.active.push({ id, left: R.days });
    emit(G, { type: 'researchStart', id });
    return yes();
}

export function blueprintFor(gen) { return RESEARCH.find((r) => r.gen === gen); }
export function cmdFabricate(G) {
    const next = G.bot.gen + 1;
    if (next >= GENS.length) return no('This is the last generation.');
    const bp = blueprintFor(next);
    if (!G.research.done[bp.id]) return no(`Research the ${bp.name} first.`);
    if (G.mode !== 'station') return no('The bot is on the planet.');
    if (G.bot.busy > 0) return no('The fabricator is busy.');
    if (!canAfford(G.res, GENS[next].cost)) return no('Not enough materials.');
    pay(G.res, GENS[next].cost);
    G.bot.gen = next;
    G.bot.busy = 1;
    emit(G, { type: 'fabricated', gen: next });
    G.queue.push('first_gen');
    return yes();
}
export function cmdUpgrade(G, id) {
    const lv = G.bot.lv[id];
    if (lv === undefined) return no('No such part.');
    if (lv >= upgradeMax(G.bot.gen)) return no(`A ${GENS[G.bot.gen].mk} can't take more. Build the next generation.`);
    const cost = upgradeCost(id, lv);
    if (!canAfford(G.res, cost)) return no('Not enough materials.');
    pay(G.res, cost);
    G.bot.lv[id]++;
    emit(G, { type: 'upgraded', id, lv: G.bot.lv[id] });
    return yes();
}

export function blendCost(a, b, r) {
    const A = SPECIES_BY_ID[a], B = SPECIES_BY_ID[b];
    const c = { mineral: 3 + Math.max(A.zone, B.zone), flora: 0, fauna: 0 };
    c[A.kind] += Math.max(1, Math.round((6 + 3 * A.zone) * r));
    c[B.kind] += Math.max(1, Math.round((6 + 3 * B.zone) * (1 - r)));
    for (const k in c) if (!c[k]) delete c[k];
    return c;
}
export function cmdBlend(G, a, b, r) {
    r = Math.round(Math.max(0, Math.min(1, r)) * 10) / 10;
    if (!SPECIES_BY_ID[a] || !SPECIES_BY_ID[b]) return no('Pick two genomes.');
    if (a === b) return no('Blend two different genomes.');
    if (!isSequenced(G, a) || !isSequenced(G, b)) return no('Both genomes must be sequenced.');
    if (G.vats.length >= vatSlots(G)) return no('Every vat is full.');
    const cost = blendCost(a, b, r);
    if (!canAfford(G.res, cost)) return no('Not enough materials.');
    pay(G.res, cost);
    const strain = { id: G.nextId++, a, b, r, traits: blendTraits(G, a, b, r), key: pairKey(a, b), name: strainName(a, b, r) };
    G.vats.push({ strain, left: BLEND_DAYS });
    G.stats.blends++;
    emit(G, { type: 'blend', name: strain.name });
    return yes({ strain });
}
export function cmdRelease(G, sid, zone) {
    const i = G.strains.findIndex((s) => s.id === sid);
    if (i < 0) return no('That strain isn\'t ready.');
    const Z = G.zones[zone];
    if (!Z || !Z.visited) return no('Land a bot there first, so the pod has a beacon to aim at.');
    if (ZONES[zone].boss && !Z.boss) return no('The Rootmother tears every pod apart. Deal with her first.');
    const s = G.strains[i];
    const fx = releaseEffect(G, s, zone);
    Z.toxic += fx.toxic; Z.hostile += fx.hostile; Z.barren += fx.barren;
    Z.uses[s.key] = (Z.uses[s.key] || 0) + 1;
    G.strains.splice(i, 1);
    G.stats.releases++;
    emit(G, { type: 'release', zone, name: s.name, fx });
    G.queue.push('first_release');
    return yes({ fx });
}
export function cmdHarvester(G, zone, kind) {
    const Z = G.zones[zone];
    if (!G.research.done.a1) return no('Research Harvester Rigs first.');
    if (!Z?.visited) return no('Land a bot there first.');
    if (ZONES[zone].boss && !Z.boss) return no('Nothing survives the Heartroot yet.');
    const lv = Z.harv[kind];
    if (lv === undefined) return no('No such rig.');
    if (lv >= HARV_MAX) return no('Fully upgraded.');
    const cost = harvesterCost(zone, lv);
    if (!canAfford(G.res, cost)) return no('Not enough materials.');
    pay(G.res, cost);
    Z.harv[kind]++;
    emit(G, { type: 'harvester', zone, kind, lv: Z.harv[kind] });
    return yes();
}
export function cmdColony(G, zone) {
    const Z = G.zones[zone];
    if (!G.research.done.a5) return no('Research Colony Seeds first.');
    if (!Z?.visited) return no('Land a bot there first.');
    if (Z.colony >= COLONY.length) return no('Already a Hive.');
    const st = COLONY[Z.colony];
    if (Z.hostile > st.host) return no(`Calm the fauna first: hostility must be ${st.host} or less (it is ${Math.round(Z.hostile)}).`);
    const cost = colonyCost(zone, Z.colony);
    if (!canAfford(G.res, cost)) return no('Not enough materials.');
    pay(G.res, cost);
    Z.colony++;
    emit(G, { type: 'colony', zone, stage: Z.colony });
    return yes();
}
export function cmdCollect(G) {
    let n = 0;
    for (const Z of G.zones) for (const k of RES) { const v = Math.floor(Z.stock[k]); G.res[k] += v; Z.stock[k] -= v; n += v; }
    emit(G, { type: 'collect', n });
    return yes({ n });
}
/** Days until the next thing finishes (research, a vat, the fabricator), or null. */
export function nextDone(G) {
    const xs = [...G.research.active.map((r) => r.left), ...G.vats.map((v) => v.left)];
    if (G.bot.busy > 0) xs.push(G.bot.busy);
    return xs.length ? Math.min(...xs) : null;
}
