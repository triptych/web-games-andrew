// The main arc, "The Lattice Signal". Stage predicates are data, re-checked often;
// the relic sites are chosen from the seed.

import { RNG, sub } from '../rng.js';
import { getSystem, lyDist, route, warpRange } from './galaxy.js';
import { hasModule } from './base.js';
import { ITEMS } from '../config.js';

export function storyPlan(galaxy) {
    const rng = new RNG(sub(galaxy.seed, 'story'));
    const S = galaxy.systems;
    const H = S[galaxy.home];
    const hops = (id, range) => { const r = route(galaxy, galaxy.home, id, range); return r ? r.length - 1 : 99; };
    const W1 = warpRange(1), W2 = warpRange(2), W3 = warpRange(3);
    const ok = (s) => s.id !== galaxy.home && s.id !== galaxy.core;
    // Shard 1: low danger, 2–3 jumps with Warp I (the first trip after the warp drive).
    let c1 = S.filter((s) => ok(s) && !s.pirate && s.danger <= 2 && !galaxy.species[s.owner]?.hostile).filter((s) => { const h = hops(s.id, W1); return h >= 2 && h <= 3; });
    if (!c1.length) c1 = S.filter((s) => ok(s) && hops(s.id, W1) <= 3);
    if (!c1.length) c1 = S.filter((s) => ok(s)).sort((a, b) => hops(a.id, W1) - hops(b.id, W1)).slice(0, 1);
    const s1 = rng.pick(c1);
    // Shard 2: a Reaver haven reachable with Warp II, preferring a 3–6 jump trek.
    const havens = S.filter((s) => s.pirate).map((s) => ({ s, h: hops(s.id, W2), h3: hops(s.id, W3) }));
    let c2 = havens.filter((x) => x.h >= 3 && x.h <= 6);
    if (!c2.length) c2 = havens.filter((x) => x.h < 99).sort((a, b) => a.h - b.h).slice(0, 2);
    if (!c2.length) c2 = havens.sort((a, b) => a.h3 - b.h3).slice(0, 1);
    const s2 = c2.length ? rng.pick(c2).s : rng.pick(S.filter((s) => ok(s) && s.danger >= 2));
    // Shard 3: the nearest system in the hostile species' space (by Warp III jumps).
    const hostile = galaxy.species.find((x) => x.hostile);
    let c3 = S.filter((s) => s.owner === hostile.id && s.id !== hostile.home).sort((a, b) => hops(a.id, W3) - hops(b.id, W3) || lyDist(a, H) - lyDist(b, H));
    if (!c3.length) c3 = S.filter((s) => ok(s) && s.danger >= 3).sort((a, b) => lyDist(a, H) - lyDist(b, H));
    const s3 = c3[Math.min(c3.length - 1, rng.int(0, 2))];
    // The friend is the species that runs your local Waypost: the people next door.
    const sites = [s1, s2, s3].map((s, i) => {
        const r = new RNG(sub(galaxy.seed, 'shard', i));
        const a = r.range(0, 6.28), d = r.range(4000, 12000);
        return { system: s.id, pos: { x: Math.cos(a) * d, y: r.range(-200, 200), z: Math.sin(a) * d } };
    });
    return { sites, hostile: hostile.id, friend: H.stationSpecies, warlord: warlordName(rng) };
}

const WARLORDS = ['Queen Ashka of the Molten Fleet', 'Varrow Ninefangs', 'The Tithe-Captain Selk', 'Old Corrin Rustcrown', 'Mother Vexa Coldwake', 'Duke Harrow the Unburied'];
const warlordName = (rng) => rng.pick(WARLORDS);

const sysName = (g, id) => g.systems[id].name;

// Stage definitions. `check(game)` returns true when complete. `goals(game)` lists objective lines.
export const STAGES = [
    { id: 'firstlight', title: 'First Light',
        text: (g) => `Welcome to ${sysName(g, g.home)}, Wright. Hearth is a cold shell, but her core still hums. Fly to the asteroid belt, hold Q (or right-click) on a rock to mine it, then dock at Hearth (E) and unload 20 Ferrite.`,
        goals: (G) => [[`Unload Ferrite at Hearth`, Math.min(20, G.s.stats.unloaded.ferrite || 0), 20]],
        check: (G) => (G.s.stats.unloaded.ferrite || 0) >= 20, reward: { credits: 400 },
        nav: (G) => (G.s.location.docked ? null : G.cargoOf('ferrite') >= 20 ? { system: G.galaxy.home, id: `${G.galaxy.home}:S0` } : { system: G.galaxy.home, id: `${G.galaxy.home}:B0` }) },
    { id: 'foundations', title: 'Foundations',
        text: () => `Raw ore is only half the story. Open the Hearth menu, go to BUILD and construct a Refinery. It will turn ore into the plate and wafer every upgrade needs.`,
        goals: (G) => [['Build a Refinery', hasModule(G.s.base, 'refinery') ? 1 : 0, 1]],
        check: (G) => hasModule(G.s.base, 'refinery'), reward: { credits: 400 },
        nav: (G) => ({ system: G.galaxy.home, id: `${G.galaxy.home}:S0` }) },
    { id: 'business', title: 'Open for Business',
        text: (g) => `Credits make the galaxy turn. The ${g.species[g.systems[g.home].stationSpecies].name} run a trading post in this system: the Waypost. Fly there, dock and sell something. Watch for goods they crave; those pay extra.`,
        goals: (G) => [['Sell goods at a station', Math.min(1, G.s.stats.salesCount || 0), 1]],
        check: (G) => (G.s.stats.salesCount || 0) >= 1, reward: { credits: 300 },
        nav: (G) => ({ system: G.galaxy.home, id: `${G.galaxy.home}:S1` }) },
    { id: 'eyes', title: 'Eyes on the Sky',
        text: () => `To reach other stars we need to understand them. Build a Research Lab at Hearth, then fly close to planets and hold E to scan them. Survey data becomes research.`,
        goals: (G) => [['Build a Research Lab', hasModule(G.s.base, 'lab') ? 1 : 0, 1], ['Scan planets', Math.min(3, G.s.stats.planetsScanned || 0), 3]],
        check: (G) => hasModule(G.s.base, 'lab') && (G.s.stats.planetsScanned || 0) >= 3, reward: { credits: 500, data: 10 },
        nav: (G) => { const p = G.system?.planets.find((x) => !G.s.scanned[x.id]); return p && G.s.location.system === G.galaxy.home ? { system: G.galaxy.home, id: p.id } : { system: G.galaxy.home, id: `${G.galaxy.home}:S0` }; } },
    { id: 'bubble', title: 'Breaking the Bubble',
        text: () => `Convert your data to research and study Warp Theory at the Lab. Then build a Warp Drive at the Shipyard, fill the tank with Warp Cells, open the Galaxy Map (G) and jump to a neighbouring star.`,
        goals: (G) => [['Research Warp Theory', G.hasTech('warp') ? 1 : 0, 1], ['Install a Warp Drive', G.s.ship.comps.warp >= 1 ? 1 : 0, 1], ['Warp to another system', Math.min(1, G.s.stats.jumps || 0), 1]],
        check: (G) => G.hasTech('warp') && G.s.ship.comps.warp >= 1 && (G.s.stats.jumps || 0) >= 1, reward: { credits: 600, items: { fuelcell: 4 } },
        nav: (G) => ({ system: G.galaxy.home, id: `${G.galaxy.home}:S0` }) },
    { id: 'echoes', title: 'Echoes',
        text: (g, P) => `As your drive spooled down you heard it: the Lattice Signal, the faint chord every species has heard. Your scanner has triangulated one source: a precursor site in the ${sysName(g, P.sites[0].system)} system. Go and see.`,
        goals: (G) => [['Recover the first Precursor Shard', Math.min(1, G.s.story.shards), 1]],
        check: (G) => G.s.story.shards >= 1, reward: { credits: 800, data: 30 },
        nav: (G) => ({ system: G.plan.sites[0].system, id: 'SHARD:0' }) },
    { id: 'friends', title: 'Friends Next Door',
        text: (g, P) => `The shard sings in harmony with two others. The ${g.species[P.friend].gov}, who run the Waypost, have charted the Signal for centuries, but they share their charts only with friends. Earn Friendly standing with them: trade, run their missions, and hunt the raiders who prey on their space.`,
        goals: (G) => [[`Standing with the ${G.galaxy.species[G.plan.friend].name}`, Math.max(0, Math.min(25, Math.floor(G.standing(G.plan.friend)))), 25]],
        check: (G) => G.standing(G.plan.friend) >= 25, reward: { credits: 1200 },
        nav: (G) => ({ system: G.galaxy.home, id: `${G.galaxy.home}:S1` }) },
    { id: 'warlord', title: "The Warlord's Hoard",
        text: (g, P) => `The charts are clear: the second shard is in the hoard of ${P.warlord}, a Reaver warlord holding the ${sysName(g, P.sites[1].system)} system. Upgrade your weapons and shields. This one will not go quietly.`,
        goals: (G) => [['Recover the second Precursor Shard', Math.min(1, Math.max(0, G.s.story.shards - 1)), 1]],
        check: (G) => G.s.story.shards >= 2, reward: { credits: 3000, items: { alloy: 10 } },
        nav: (G) => ({ system: G.plan.sites[1].system, id: 'SHARD:1' }) },
    { id: 'deep', title: 'Deep Signal',
        text: (g, P) => `The last shard is buried in the space of the ${g.species[P.hostile].gov}, hidden in the folds of the ${sysName(g, P.sites[2].system)} system. Only a Mk III scanner can see it. The Swarm will not welcome you.`,
        goals: (G) => [['Scanner Mk III', G.s.ship.comps.scanner >= 3 ? 1 : 0, 1], ['Recover the third Precursor Shard', Math.min(1, Math.max(0, G.s.story.shards - 2)), 1]],
        check: (G) => G.s.story.shards >= 3, reward: { credits: 5000, data: 60 },
        nav: (G) => ({ system: G.plan.sites[2].system, id: 'SHARD:2' }) },
    { id: 'key', title: 'The Key',
        text: () => `Three shards, one shape. Research Exotic Physics at Hearth and fabricate the Lattice Key from the shards, three Void Cores and four Iridium Lattices.`,
        goals: (G) => [['Research Exotic Physics', G.hasTech('exotic') ? 1 : 0, 1], ['Forge the Lattice Key', G.s.story.key ? 1 : 0, 1]],
        check: (G) => G.s.story.key, reward: { credits: 5000 },
        nav: (G) => ({ system: G.galaxy.home, id: `${G.galaxy.home}:S0` }) },
    { id: 'heart', title: 'Heart of the Galaxy',
        text: () => `Only a Warp Drive Mk V can cross the void around the core. Jump to The Heart, survive its Wardens, and bring the Key to the Lattice.`,
        goals: (G) => [['Warp Drive Mk V', G.s.ship.comps.warp >= 5 ? 1 : 0, 1], ['Activate the Lattice', G.s.story.done ? 1 : 0, 1]],
        check: (G) => G.s.story.done, reward: { credits: 20000 },
        nav: (G) => ({ system: G.galaxy.core, id: `${G.galaxy.core}:L0` }) },
];

export function currentStage(game) { return STAGES[game.s.story.stage] || null; }

export function checkStory(game) {
    let guard = 0;
    while (guard++ < 12) {
        const st = currentStage(game);
        if (!st || !st.check(game)) return;
        const r = st.reward || {};
        game.s.credits += r.credits || 0;
        if (r.data) game.s.data += r.data;
        if (r.items) for (const [k, n] of Object.entries(r.items)) game.s.base.storage[k] = (game.s.base.storage[k] || 0) + n;
        game.s.story.stage++;
        const next = currentStage(game);
        game.emit('story', { done: st, next, text: `${st.title} complete${r.credits ? `  +${r.credits} cr` : ''}${r.items ? '  +' + Object.entries(r.items).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(', ') + ' (at Hearth)' : ''}` });
        if (next?.id === 'echoes') game.s.story.signal = true;
    }
}

// Story points of interest in the current system.
export function storySpawns(game, systemId) {
    const out = [];
    const st = game.s.story;
    game.plan.sites.forEach((site, i) => {
        if (site.system !== systemId) return;
        const active = st.stage >= 5 + (i === 0 ? 0 : i === 1 ? 2 : 3) && st.shards === i;
        if (!active) return;
        if (i === 2 && game.s.ship.comps.scanner < 3) return; // hidden
        out.push({ id: `SHARD:${i}`, kind: i === 1 ? 'hoard' : 'precursor', name: i === 1 ? `${game.plan.warlord}'s hoard` : 'Precursor site', pos: site.pos, shard: i });
    });
    return out;
}

export function storyNav(game) {
    const st = currentStage(game);
    return st?.nav ? st.nav(game) : null;
}
