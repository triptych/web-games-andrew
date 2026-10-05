// Galaxy and system generation. Pure functions of the seed: the same seed text always
// produces the same stars, planets, belts, stations and points of interest.

import { RNG, hashStr, sub } from '../rng.js';
import { GALAXY, STAR_CLASSES, PLANET_TYPES, ROCK_TYPES, ECONOMIES, COMPONENTS } from '../config.js';
import { generateSpecies } from './species.js';
import { word, catalogName, roman, stationName, FRONTIER_LANG } from './names.js';

export const normSeed = (s) => String(s ?? '').trim().toUpperCase().slice(0, 32) || 'STARWRIGHT';
export const lyDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const warpRange = (mk) => COMPONENTS.warp.stats[mk]?.range ?? 0;

export function generateGalaxy(seedText) {
    const seedStr = normSeed(seedText);
    const seed = hashStr(seedStr);
    const rng = new RNG(sub(seed, 'galaxy'));
    const species = generateSpecies(seed, GALAXY.species);
    const R = GALAXY.radius;
    const pts = [];
    const armOffset = rng.range(0, Math.PI * 2);
    const twist = rng.range(2.4, 3.4);
    const spacing2 = GALAXY.minSpacing * GALAXY.minSpacing;
    const fits = (x, y, sp2 = spacing2) => pts.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= sp2);

    let attempts = 0;
    while (pts.length < GALAXY.systems && attempts++ < 40000) {
        const r = GALAXY.coreVoid + (R - GALAXY.coreVoid) * Math.pow(rng.next(), 0.85);
        let th;
        if (rng.chance(0.78)) {
            const arm = rng.int(0, GALAXY.arms - 1);
            th = armOffset + arm * Math.PI * 2 / GALAXY.arms + twist * (r / R) + rng.gauss() * 0.22;
        } else th = rng.range(0, Math.PI * 2);
        const x = Math.cos(th) * r, y = Math.sin(th) * r;
        if (fits(x, y)) pts.push({ x, y });
    }

    // Home: on the rim, in a reasonably dense patch.
    let homeIdx = 0, best = -1;
    for (let i = 0; i < pts.length; i++) {
        const r = Math.hypot(pts[i].x, pts[i].y);
        if (r < R * 0.78 || r > R * 0.97) continue;
        let n = 0;
        for (const q of pts) if (q !== pts[i] && lyDist(q, pts[i]) < 7) n++;
        const score = n * 10 + rng.next();
        if (score > best) { best = score; homeIdx = i; }
    }
    // Guarantee four Warp-I neighbours.
    const home = pts[homeIdx];
    let tries = 0;
    const nearHome = () => pts.filter((q) => q !== home && lyDist(q, home) < 6.9).length;
    while (nearHome() < 4 && tries++ < 400) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(4.2, 6.6);
        const x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
        if (Math.hypot(x, y) > GALAXY.coreVoid + 2 && Math.hypot(x, y) < R * 1.02 && fits(x, y, 3.4 * 3.4)) pts.push({ x, y });
    }
    // Core reachable only with Warp V: make sure something sits inside 29 ly of the centre.
    if (!pts.some((p) => Math.hypot(p.x, p.y) < 28.5)) {
        const a = rng.range(0, Math.PI * 2);
        pts.push({ x: Math.cos(a) * 26.5, y: Math.sin(a) * 26.5 });
    }
    // Connectivity at Warp III range (16 ly) from home: bridge components until connected.
    const LINK = warpRange(3) - 0.4;
    for (let iter = 0; iter < 200; iter++) {
        const comp = reach(pts, homeIdx, LINK);
        if (comp.size === pts.length) break;
        let bd = Infinity, ba = null, bb = null;
        for (let i = 0; i < pts.length; i++) {
            if (!comp.has(i)) continue;
            for (let j = 0; j < pts.length; j++) {
                if (comp.has(j)) continue;
                const d = lyDist(pts[i], pts[j]);
                if (d < bd) { bd = d; ba = pts[i]; bb = pts[j]; }
            }
        }
        let mx = (ba.x + bb.x) / 2, my = (ba.y + bb.y) / 2;
        const mr = Math.hypot(mx, my);
        if (mr < GALAXY.coreVoid + 1) { const s = (GALAXY.coreVoid + 1) / (mr || 1); mx *= s; my *= s; }
        pts.push({ x: mx, y: my });
    }

    // Core last.
    pts.push({ x: 0, y: 0, core: true });
    const coreIdx = pts.length - 1;

    // Build system records.
    const systems = pts.map((p, i) => ({ id: i, x: p.x, y: p.y, r: Math.hypot(p.x, p.y) }));
    // Species homes by farthest-point sampling among mid/outer systems, hostile species farthest from home.
    const candidates = systems.filter((s) => s.id !== homeIdx && s.id !== coreIdx && s.r > 30 && lyDist(s, home) > 9);
    const homes = [];
    let first = candidates.reduce((a, b) => (lyDist(a, home) < lyDist(b, home) && lyDist(a, home) > 10 ? a : b));
    // The first (friendliest, nearest) species lives 10–20 ly from home.
    const near = candidates.filter((s) => { const d = lyDist(s, home); return d > 10 && d < 20; });
    if (near.length) first = near[Math.floor(rng.next() * near.length)];
    homes.push(first);
    while (homes.length < species.length) {
        let bestS = null, bestD = -1;
        for (const s of candidates) {
            const d = Math.min(...homes.map((h) => lyDist(h, s)));
            if (d > bestD) { bestD = d; bestS = s; }
        }
        homes.push(bestS);
    }
    // Hostile species takes the home farthest from the player's home.
    const hostile = species.find((s) => s.hostile);
    let farthestI = 0;
    for (let i = 1; i < homes.length; i++) if (lyDist(homes[i], home) > lyDist(homes[farthestI], home)) farthestI = i;
    if (hostile.id !== farthestI) {
        // Swap species ids' homes so hostile gets the farthest.
        const tmp = homes[hostile.id]; homes[hostile.id] = homes[farthestI]; homes[farthestI] = tmp;
    }
    // Species 0..n: ensure the near home goes to a non-hostile species (it's homes[0] unless swapped).
    species.forEach((sp, i) => { sp.home = homes[i].id; });
    const nearestSpecies = (s) => {
        let bi = -1, bd = Infinity;
        for (const sp of species) { const d = lyDist(systems[sp.home], s); if (d < bd) { bd = d; bi = sp.id; } }
        return { id: bi, d: bd };
    };

    for (const s of systems) {
        const r = new RNG(sub(seed, 'sysmeta', s.id));
        const ns = nearestSpecies(s);
        s.owner = ns.d < 26 ? ns.id : -1;
        if (s.id === homeIdx || s.id === coreIdx) s.owner = -1;
        const sp = s.owner >= 0 ? species[s.owner] : null;
        s.homeOf = species.findIndex((x) => x.home === s.id);
        s.name = s.homeOf >= 0 ? `${species[s.homeOf].name} Prime`
            : sp ? word(sp.lang, r, 2, 3) : catalogName(r);
        const classes = Object.keys(STAR_CLASSES);
        s.star = r.weighted(classes, (k) => STAR_CLASSES[k].weight);
        const hd = lyDist(s, home);
        let danger = (1 - (s.r - GALAXY.coreVoid) / (R - GALAXY.coreVoid)) * 4.4 + r.range(-0.7, 0.7);
        if (sp?.hostile) danger += 1.6;
        if (hd < 8) danger = Math.min(danger, 0.6);
        else if (hd < 16) danger = Math.min(danger, 1.6);
        s.danger = Math.max(0, Math.min(5, Math.round(danger)));
        s.pirate = false;
        s.richness = 0.8 + s.danger * 0.16 + r.range(0, 0.3);
        const econKeys = Object.keys(ECONOMIES);
        s.economy = sp ? r.weighted(econKeys, (k) => econWeight(k, sp.temperament)) : r.pick(['frontier', 'frontier', 'mining', 'refinery']);
        s.hasStation = s.homeOf >= 0 ? true : sp ? r.chance(sp.hostile ? 0.55 : 0.75) : r.chance(0.22);
        s.stationSpecies = sp ? sp.id : nearestSpecies(s).id;
        if (species[s.stationSpecies]?.hostile && !sp) s.stationSpecies = nonHostileNearest(species, systems, s);
    }
    // Reaver havens among frontier systems with some danger.
    const frontier = systems.filter((s) => s.owner === -1 && s.id !== homeIdx && s.id !== coreIdx && lyDist(s, home) > 14);
    rng.shuffle(frontier);
    for (const s of frontier.slice(0, 9)) { s.pirate = true; s.danger = Math.max(2, s.danger); s.hasStation = false; s.richness += 0.2; }
    // At least one haven 3–6 Warp-II jumps from home, for the warlord chapter.
    const w2hops = hopCounts(systems, homeIdx, warpRange(2));
    const midHaven = (x) => { const hh = w2hops.get(x.id); return hh >= 3 && hh <= 6; };
    if (!systems.some((x) => x.pirate && midHaven(x))) {
        const c = systems.filter((x) => midHaven(x) && x.homeOf < 0 && x.id !== coreIdx && x.id !== homeIdx);
        c.sort((a, b) => (a.owner === -1 ? 0 : 1) - (b.owner === -1 ? 0 : 1) || w2hops.get(a.id) - w2hops.get(b.id));
        const pick = c[Math.floor(rng.next() * Math.min(3, c.length))];
        if (pick) { pick.pirate = true; pick.owner = -1; pick.danger = Math.max(2, pick.danger); pick.hasStation = false; pick.richness += 0.2; }
    }

    const H = systems[homeIdx];
    H.name = new RNG(sub(seed, 'homename')).pick(['Hearthlight', 'Emberfall', 'Kindle', 'Lantern', 'Wick', 'Tinder', 'Brazier', 'Firstfire']);
    H.star = 'G'; H.danger = 0; H.economy = 'frontier'; H.hasStation = true; H.richness = 0.9;
    H.stationSpecies = nonHostileNearest(species, systems, H);
    const C = systems[coreIdx];
    C.name = 'The Heart'; C.star = 'core'; C.danger = 5; C.economy = 'frontier'; C.hasStation = false; C.richness = 2.2; C.owner = -1;

    // Nearest Warp-I neighbour must have a station.
    const neigh = systems.filter((s) => s.id !== homeIdx && lyDist(s, H) < 7).sort((a, b) => lyDist(a, H) - lyDist(b, H));
    if (neigh.length && !neigh.some((s) => s.hasStation)) { neigh[0].hasStation = true; neigh[0].pirate = false; }
    for (const s of neigh) { s.pirate = false; }

    return { seedStr, seed, systems, species, home: homeIdx, core: coreIdx, details: new Map() };
}

function nonHostileNearest(species, systems, s) {
    let bi = 0, bd = Infinity;
    for (const sp of species) if (!sp.hostile) { const d = lyDist(systems[sp.home], s); if (d < bd) { bd = d; bi = sp.id; } }
    return bi;
}

function econWeight(k, temp) {
    const W = {
        mercantile: { agri: 2, mining: 1, industry: 2, hitech: 2, refinery: 1, military: 0.5, tourism: 2, frontier: 0.5 },
        scholarly: { agri: 1, mining: 1, industry: 1, hitech: 4, refinery: 1, military: 0.3, tourism: 1, frontier: 0.5 },
        martial: { agri: 1, mining: 2, industry: 2, hitech: 1, refinery: 1, military: 4, tourism: 0.2, frontier: 1 },
        mystic: { agri: 2, mining: 0.5, industry: 0.5, hitech: 1, refinery: 1, military: 0.3, tourism: 3, frontier: 1 },
        hive: { agri: 2, mining: 3, industry: 3, hitech: 0.5, refinery: 2, military: 1, tourism: 0.1, frontier: 0.5 },
        nomadic: { agri: 1, mining: 1, industry: 1, hitech: 1, refinery: 2, military: 0.5, tourism: 1, frontier: 3 },
    };
    return (W[temp] || W.nomadic)[k] ?? 1;
}

// Breadth-first jump counts from `from` with a given range.
export function hopCounts(pts, from, range) {
    const out = new Map([[from, 0]]);
    let frontier = [from];
    while (frontier.length) {
        const next = [];
        for (const i of frontier) for (let j = 0; j < pts.length; j++) {
            if (out.has(j) || pts[j].core || pts[j].star === 'core') continue;
            if (lyDist(pts[i], pts[j]) <= range) { out.set(j, out.get(i) + 1); next.push(j); }
        }
        frontier = next;
    }
    return out;
}

export function reach(pts, from, range) {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
        const i = stack.pop();
        for (let j = 0; j < pts.length; j++) {
            if (seen.has(j) || pts[j].core) continue;
            if (lyDist(pts[i], pts[j]) <= range) { seen.add(j); stack.push(j); }
        }
    }
    return seen;
}

// Systems reachable from `from` with a given jump range (hops of ≤ range). Used for missions + tests.
export function reachable(galaxy, from, range) {
    const pts = galaxy.systems.map((s) => ({ x: s.x, y: s.y, core: false }));
    return reach(pts, from, range);
}

// Shortest route (fewest jumps, then distance) with jump range.
export function route(galaxy, from, to, range) {
    const S = galaxy.systems;
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const open = [from];
    while (open.length) {
        open.sort((a, b) => dist.get(a) - dist.get(b));
        const cur = open.shift();
        if (cur === to) break;
        for (const s of S) {
            if (s.id === cur) continue;
            const d = lyDist(S[cur], s);
            if (d > range) continue;
            const nd = dist.get(cur) + 1000 + d; // hop penalty dominates
            if (!dist.has(s.id) || nd < dist.get(s.id)) { dist.set(s.id, nd); prev.set(s.id, cur); open.push(s.id); }
        }
    }
    if (!dist.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0]));
    return path;
}

// ------------------------------------------------------------------ system detail
export function getSystem(galaxy, id) {
    if (!galaxy.details.has(id)) galaxy.details.set(id, generateSystem(galaxy, id));
    return galaxy.details.get(id);
}

function generateSystem(galaxy, id) {
    const S = galaxy.systems[id];
    const rng = new RNG(sub(galaxy.seed, 'system', id));
    const isHome = id === galaxy.home, isCore = id === galaxy.core;
    const sp = S.owner >= 0 ? galaxy.species[S.owner] : null;
    const lang = sp ? sp.lang : FRONTIER_LANG;
    const starDef = STAR_CLASSES[S.star] || { color: '#f2e6ff', radius: 650, lum: 1.8, name: 'Lattice Heart' };
    const star = { cls: S.star, color: starDef.color, radius: starDef.radius * rng.range(0.9, 1.1), lum: starDef.lum, name: starDef.name };
    const frost = 5200 * Math.sqrt(star.lum);

    const sky = {
        hue1: rng.next(), hue2: rng.next(), density: rng.range(0.35, 1), band: Math.atan2(S.y, S.x),
        seed: rng.int(1, 1e6),
    };

    // Planets
    const planets = [];
    let nP = isHome ? 5 : isCore ? 3 : rng.int(2, 8);
    let orbit = star.radius * 3.2 + rng.range(1500, 2400);
    for (let i = 0; i < nP && orbit < 26000; i++) {
        const pr = new RNG(sub(galaxy.seed, 'planet', id, i));
        let type;
        const t = orbit / frost;
        if (isCore) type = pr.pick(['ice', 'rocky', 'lava']);
        else if (t < 0.38) type = pr.pick(['lava', 'lava', 'desert', 'rocky']);
        else if (t < 0.95) type = pr.weighted(['desert', 'rocky', 'terran', 'ocean', 'toxic'], (k) => ({ desert: 2, rocky: 2, terran: t > 0.55 ? 2.4 : 0.6, ocean: t > 0.6 ? 2 : 0.4, toxic: 1.3 })[k]);
        else type = pr.weighted(['ice', 'gas', 'icegiant', 'rocky'], (k) => ({ ice: 2, gas: t < 2.2 ? 3 : 1.5, icegiant: t > 1.6 ? 2.5 : 0.8, rocky: 0.6 })[k]);
        if (isHome && i === 1) type = 'terran';
        if (isHome && i === 3) type = 'gas';
        const giant = PLANET_TYPES[type].giant;
        const radius = giant ? pr.range(150, 260) : pr.range(42, 115);
        const ang = pr.range(0, Math.PI * 2);
        const y = pr.gauss() * orbit * 0.02;
        const p = {
            id: `${id}:P${i}`, idx: i, kind: 'planet', type, radius,
            name: sp && pr.chance(0.4) ? word(lang, pr, 2, 3) : `${S.name} ${roman(i + 1)}`,
            orbit, angle: ang,
            pos: { x: Math.cos(ang) * orbit, y, z: Math.sin(ang) * orbit },
            tilt: pr.range(-0.5, 0.5), spin: pr.range(0.01, 0.05) * pr.sign(),
            rings: giant && pr.chance(0.45), ringTilt: pr.range(-0.6, 0.6), ringHue: pr.next(),
            moons: Array.from({ length: giant ? pr.int(0, 3) : pr.int(0, 1) }, (_, m) => ({ r: pr.range(8, 26), d: radius * pr.range(1.9, 3.4), a: pr.range(0, 6.28), speed: pr.range(0.02, 0.08), hue: pr.next() })),
            hue: pr.next(), hue2: pr.next(), seed: pr.int(1, 1e6),
            inhabited: false,
            scanValue: Math.round((giant ? 34 : 22) * PLANET_TYPES[type].scan * (0.8 + S.richness * 0.3)),
        };
        planets.push(p);
        orbit *= rng.range(1.38, 1.72);
        if (orbit < 1800 + (i + 1) * 1600) orbit = 1800 + (i + 1) * 1600;
    }

    // Belts: radii in the gaps between planet orbits.
    const belts = [];
    const nB = isHome ? 2 : isCore ? 1 : rng.weighted([0, 1, 1, 2, 2, 3], () => 1);
    const used = planets.map((p) => p.orbit);
    for (let b = 0; b < nB; b++) {
        let br = 0;
        for (let k = 0; k < 40; k++) {
            const cand = isHome ? (planets[b + 1].orbit + planets[b + 2].orbit) / 2 + rng.range(-200, 200) : rng.range(2600, 22000);
            if (used.every((u) => Math.abs(u - cand) > 900)) { br = cand; break; }
        }
        if (!br) continue;
        used.push(br);
        const outer = isHome ? b === 1 : br > frost;
        const comp = beltComposition(outer, S.danger, isHome, isCore, rng);
        const width = rng.range(500, 1000);
        const nC = Math.max(10, Math.round((Math.PI * 2 * br) / 1500));
        const clusters = [];
        const off = rng.range(0, Math.PI * 2);
        for (let c = 0; c < nC; c++) {
            const a = off + (c / nC) * Math.PI * 2 + rng.range(-0.08, 0.08);
            const rr = br + rng.gauss() * width * 0.25;
            clusters.push({ idx: c, pos: { x: Math.cos(a) * rr, y: rng.gauss() * 30, z: Math.sin(a) * rr }, count: rng.int(16, 34), spread: rng.range(240, 400), seed: rng.int(1, 1e9) });
        }
        belts.push({ id: `${id}:B${b}`, idx: b, kind: 'belt', name: `${S.name} ${['Inner', 'Outer', 'Far'][b] || ''} Belt`.replace('  ', ' '), radius: br, width, comp, clusters, outer });
    }

    // Stations
    const stations = [];
    const placeNear = (p, r, k) => {
        const a = r.range(0, Math.PI * 2);
        const d = p.radius * 2.4 + 220 + k * 60;
        return { x: p.pos.x + Math.cos(a) * d, y: p.pos.y + r.range(-40, 40), z: p.pos.z + Math.sin(a) * d };
    };
    if (isHome) {
        const hp = planets[1];
        stations.push({ id: `${id}:S0`, kind: 'hearth', name: 'Hearth', species: -1, planet: hp.id, pos: placeNear(hp, rng, 0), seed: rng.int(1, 1e9), economy: 'frontier' });
        const wp = planets[2] || planets[0];
        stations.push({ id: `${id}:S1`, kind: 'hub', name: `${galaxy.species[S.stationSpecies].name} Waypost`, species: S.stationSpecies, planet: wp.id, pos: placeNear(wp, rng, 1), seed: rng.int(1, 1e9), economy: 'frontier' });
        hp.inhabited = true;
    } else if (S.hasStation && planets.length) {
        const kinds = S.homeOf >= 0 ? ['hub', 'shipyard', 'embassy'] : rng.weighted([['outpost'], ['hub'], ['hub', 'outpost'], ['refinery', 'hub'], ['shipyard', 'outpost'], ['hub', 'refinery', 'shipyard']], (o) => [3, 3, 2, 1.5, 1.2, 0.5][['outpost', 'hub', 'hub,outpost', 'refinery,hub', 'shipyard,outpost', 'hub,refinery,shipyard'].indexOf(o.join(','))]);
        kinds.forEach((kind, k) => {
            const p = planets[(rng.int(0, planets.length - 1) + k) % planets.length];
            const spId = S.stationSpecies;
            const spc = galaxy.species[spId];
            p.inhabited = p.inhabited || !PLANET_TYPES[p.type].giant;
            stations.push({ id: `${id}:S${k}`, kind, name: stationName(spc.lang, rng, kind), species: spId, planet: p.id, pos: placeNear(p, rng, k), seed: rng.int(1, 1e9), economy: S.economy });
        });
    }

    // Points of interest
    const pois = [];
    const randPos = (r, lo = 2600, hi = 19000) => { const a = r.range(0, Math.PI * 2), d = r.range(lo, hi); return { x: Math.cos(a) * d, y: r.range(-260, 260), z: Math.sin(a) * d }; };
    const nDer = isHome ? 1 : rng.int(0, 2);
    for (let i = 0; i < nDer; i++) pois.push({ id: `${id}:D${i}`, kind: 'derelict', name: `Derelict ${rng.pick(['freighter', 'hauler', 'survey ship', 'yacht', 'gunboat', 'colony barge'])}`, pos: randPos(rng), seed: rng.int(1, 1e9), trap: !isHome && rng.chance(0.18 + S.danger * 0.05) });
    if (!isHome && rng.chance(0.45 + S.danger * 0.08)) pois.push({ id: `${id}:A0`, kind: 'anomaly', name: rng.pick(['Spatial anomaly', 'Gravitic shear', 'Chroniton bloom', 'Singing void', 'Prismatic rift']), pos: randPos(rng), seed: rng.int(1, 1e9), hidden: false });
    if (!isHome && rng.chance(0.3 + S.danger * 0.06)) pois.push({ id: `${id}:A1`, kind: 'anomaly', name: rng.pick(['Faint resonance', 'Ghost signal', 'Folded space']), pos: randPos(rng), seed: rng.int(1, 1e9), hidden: true });
    if (rng.chance(isHome ? 1 : 0.35)) pois.push({ id: `${id}:C0`, kind: 'cache', name: 'Resource cache', pos: randPos(rng, 3000, isHome ? 9000 : 16000), seed: rng.int(1, 1e9) });
    if (!isHome && rng.chance(0.28)) pois.push({ id: `${id}:N0`, kind: 'beacon', name: 'Nav beacon', pos: randPos(rng, 2500, 9000), seed: rng.int(1, 1e9) });
    if (isCore) pois.push({ id: `${id}:L0`, kind: 'lattice', name: 'The Lattice', pos: { x: 0, y: 0, z: star.radius * 4.2 }, seed: 1 });

    // Arrival point for warps: on the edge, facing the star.
    const aa = rng.range(0, Math.PI * 2);
    const arriveR = Math.min(9000, Math.max(5200, (planets[planets.length - 1]?.orbit || 8000) * 0.6));
    const arrival = { x: Math.cos(aa) * arriveR, y: 120, z: Math.sin(aa) * arriveR };

    // Ambient NPC traffic routes (inhabited systems)
    const traffic = [];
    if (stations.length && !isCore) {
        const n = Math.min(5, 1 + stations.length + (S.homeOf >= 0 ? 2 : 0));
        for (let i = 0; i < n; i++) traffic.push({ seed: rng.int(1, 1e9), species: stations[i % stations.length].species < 0 ? S.stationSpecies : stations[i % stations.length].species });
    }

    return { id, name: S.name, star, frost, sky, planets, belts, stations, pois, arrival, traffic, danger: S.danger, richness: S.richness, owner: S.owner, pirate: S.pirate, economy: S.economy };
}

function beltComposition(outer, danger, isHome, isCore, rng) {
    if (isCore) return { void: 4, iridium: 3, titanic: 1 };
    if (isHome) return outer ? { icy: 4, carbon: 2.6, stony: 0.6 } : { stony: 2.6, metallic: 2.6, titanic: 2, cupric: 1.4, carbon: 0.3 };
    const c = outer
        ? { icy: 4, carbon: 2, stony: 1, titanic: 0.5, cupric: 0.3 }
        : { stony: 2.6, metallic: 2.6, titanic: 1.8 + danger * 0.3, cupric: 1.4 + danger * 0.2, carbon: 0.6, icy: 0.2 };
    if (danger >= 2) c.iridium = 0.8 + danger * 0.4;
    if (danger >= 3) c.void = 0.45 * danger;
    // A little per-belt flavour.
    const fav = rng.pick(Object.keys(c));
    c[fav] *= 1.8;
    return c;
}

// Rocks of one cluster — deterministic, generated lazily by the world.
export function clusterRocks(sysId, belt, cluster, richness) {
    const r = new RNG(cluster.seed);
    const out = [];
    const types = Object.keys(belt.comp);
    for (let i = 0; i < cluster.count; i++) {
        const type = r.weighted(types, (k) => belt.comp[k]);
        const big = r.chance(0.12);
        const radius = big ? r.range(26, 44) : r.range(7, 24);
        const ore = Math.round(radius * (1.05 + richness * 0.35) * (ROCK_TYPES[type].hard >= 3 ? 0.8 : 1));
        const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * cluster.spread;
        out.push({
            id: `${belt.id}:${cluster.idx}:${i}`,
            pos: { x: cluster.pos.x + Math.cos(a) * d, y: cluster.pos.y + r.gauss() * 35, z: cluster.pos.z + Math.sin(a) * d },
            radius, type, ore, maxOre: ore, hard: ROCK_TYPES[type].hard,
            shape: r.int(0, 7), rot: { x: r.range(0, 6.28), y: r.range(0, 6.28), z: r.range(0, 6.28) }, spin: r.range(-0.3, 0.3),
        });
    }
    return out;
}

export const allBodies = (sys) => [...sys.planets, ...sys.stations, ...sys.pois.filter((p) => !p.hidden)];
