// The game state: its shape, saving and loading, and the map you are in.

import { makeRng } from '../rng.js';
import { newMember, memberStats, clampHpMp } from './party.js';
import { newQuestState, setNpcLookup } from './quests.js';
import { getMap, anchorPos, refreshActors } from './world/maps.js';
import { townNpcs } from './npcs.js';
import { genTown } from './world/town.js';
import { LOCS } from './world/locations.js';
import { STEP } from '../config.js';

export const SAVE_VERSION = 1;

export function newGame(seed = 1) {
    const G = {
        v: SAVE_VERSION, seed, rng: makeRng(seed ^ 0x9e3779b9), t: 0, clock: 0.12, mode: 'field',
        map: 'emberfield', px: 22.5, py: 31.5, dir: 'up', moving: false, anim: 0,
        gold: 120, inv: { potion: 3 }, flags: {}, story: { i: 0, light: 0.95 },
        party: { members: { kael: newMember('kael', 1) }, active: ['kael'], reserve: [] },
        quests: newQuestState(), mapState: {}, visited: { emberfield: 1 }, bestiary: {}, talk: {},
        stats: { steps: 0, battles: 0, kills: 0, questsDone: 0, playtime: 0, chests: 0, flees: 0, deaths: 0 },
        events: [], scene: null, battle: null, shop: null, warp: null, pending: null, trail: [], encDist: 0, encNext: 40, lockHint: 0,
        talkTarget: null, ending: null,
    };
    wireLookups(G);
    const m = getMap(G, 'emberfield');
    const s = anchorPos(m, 'plaza', 0, 5) || m.spawn;
    G.px = s[0]; G.py = s[1];
    G.events.push({ type: 'map', id: G.map, first: true });
    return G;
}

export function wireLookups(G) {
    setNpcLookup((town) => townNpcs(G.seed, town, townMapFor(G, town)));
}
function townMapFor(G, town) {
    return (G._maps && G._maps[town]) || genTown(G.seed, town);
}

export const curMap = (G) => getMap(G, G.map);
export const party = (G) => G.party.active.map((id) => G.party.members[id]);
export const leader = (G) => G.party.members[G.party.active[0]];

export function enterMap(G, id, x, y, dir = 'down', opts = {}) {
    const prev = G.map;
    if (G._maps && prev !== id && LOCS[prev]?.kind === 'dungeon') delete G._maps[prev];
    if (G._maps && prev !== id && LOCS[prev]?.kind === 'town') { /* keep towns cached: villagers keep their spots */ }
    G.map = id; G.px = x; G.py = y; G.dir = dir; G.trail = []; G.moving = false;
    const m = getMap(G, id);
    G.visited[id] = (G.visited[id] || 0) + 1;
    G.encDist = 0;
    G.events.push({ type: 'map', id, first: G.visited[id] === 1, name: m.name, kind: m.kind, silent: !!opts.silent });
    return m;
}

export function placeAt(G, id, tx, ty) { const m = curMap(G); G.px = tx; G.py = ty; G.trail = []; return m; }

export function serialize(G) {
    return JSON.parse(JSON.stringify({
        v: G.v, seed: G.seed, rngState: G.rng.state(), t: G.t, clock: G.clock, map: G.map, px: G.px, py: G.py, dir: G.dir, gold: G.gold, inv: G.inv, flags: G.flags,
        story: G.story, party: G.party, quests: G.quests, mapState: G.mapState, visited: G.visited, bestiary: G.bestiary, talk: G.talk, stats: G.stats,
        encNext: G.encNext, ending: G.ending,
    }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION || !d.party?.members) throw new Error('unknown save version');
    const G = newGame(d.seed);
    const copy = JSON.parse(JSON.stringify(d));
    for (const k of ['t', 'clock', 'map', 'px', 'py', 'dir', 'gold', 'inv', 'flags', 'story', 'party', 'quests', 'mapState', 'visited', 'bestiary', 'talk', 'stats', 'encNext', 'ending']) if (copy[k] !== undefined) G[k] = copy[k];
    G.rng.setState(copy.rngState);
    G._maps = {};
    G.events = [];
    wireLookups(G);
    for (const id of Object.keys(G.party.members)) clampHpMp(G.party.members[id]);
    // after a load the party stands where it saved; a scene never saves
    const m = getMap(G, G.map);
    G.events.push({ type: 'map', id: G.map, first: false, name: m.name, kind: m.kind, silent: true });
    return G;
}
export { STEP };
