// The scene runner and the quest pointer. Pure.
//
// A scene is a list of ops from data/script.js, run one at a time until one has to wait: a line waits for the player, a
// `wait` for time, a `move` for its actor to arrive, a `battle` for the duel to end. G.scene = { id, i, line, wait, moving }.

import { SCENES } from './data/script.js';
import { MAPS, WORLD, crystalOf } from './data/maps.js';
import { join, healAll, giveItem } from './party.js';
import { startBattle } from './battle.js';
import { loadMap } from './field.js';

/** How long an effect holds the scene, so the view has time to show it. */
const FX_WAIT = { crack: 0.5, shatter: 0.7, fall: 1.1, dragon: 1.3, emerge: 0.8, hushwave: 0.9, rumble: 0.5, vanish: 0.9, seal: 1.1, windmills: 0.7, dragonFall: 1.6, ottoLeave: 0.7, ottoBoot: 0.4, give: 0.3 };

export function startScene(G, id) {
    if (!SCENES[id]) return;
    G.scene = { id, i: 0, line: null, wait: 0, moving: null };
    G.mode = 'scene';
    G.events.push({ type: 'sceneStart', id });
}

export function stepScene(G, inp, dt) {
    const S = G.scene;
    if (!S) { G.mode = 'field'; return; }
    let guard = 0;
    while (G.mode === 'scene' && G.scene === S && guard++ < 200) {
        if (S.line) {
            if (!inp.a) return;
            inp = { ...inp, a: false };            // one press advances one line
            S.line = null;
            continue;
        }
        if (S.wait > 0) { S.wait -= dt; return; }
        if (S.moving) {
            const m = S.moving;
            const a = actorRef(G, m.id);
            const dx = m.x - a.x, dy = m.y - a.y, d = Math.hypot(dx, dy);
            const v = m.speed * dt;
            if (d > 0.001) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            if (d <= v) { a.x = m.x; a.y = m.y; a.walking = false; S.moving = null; }
            else { a.x += (dx / d) * v; a.y += (dy / d) * v; a.walking = true; return; }
            continue;
        }
        const op = SCENES[S.id][S.i++];
        if (!op) { endScene(G); return; }
        runOp(G, S, op);
    }
}

function actorRef(G, id) {
    if (id === 'player') return G.p;
    if (!G.actors[id]) G.actors[id] = { id, x: 0, y: 0, dir: 'down' };
    return G.actors[id];
}

function runOp(G, S, op) {
    const [kind, a, b, c, d] = op;
    switch (kind) {
        case 'say': S.line = { who: a, text: b }; G.events.push({ type: 'say', who: a, text: b }); break;
        case 'wait': S.wait = a; break;
        case 'actor': Object.assign(actorRef(G, a), b); break;
        case 'move': S.moving = { id: a, x: b, y: c, speed: d || 2.4 }; break;
        case 'face': actorRef(G, a).dir = b; break;
        case 'cam': G.cam = a ? { ...a } : null; break;
        case 'fx': G.events.push({ type: 'fx', name: a, args: b || {} }); S.wait = FX_WAIT[a] || 0; break;
        case 'flag': G.flags[a] = b === undefined ? true : b; break;
        case 'join': join(G, a); break;
        case 'heal': healAll(G, 1); break;
        case 'give': giveItem(G, a, b || 1); G.events.push({ type: 'gift', item: a }); break;
        case 'music': G.events.push({ type: 'music', name: a }); break;
        case 'title': G.events.push({ type: 'title', big: a, small: b }); S.wait = 2.8; break;
        case 'fade': G.fade = a; G.events.push({ type: 'fade', dir: a }); S.wait = 0.7; break;
        case 'goto': loadMap(G, a, b, c); break;
        case 'battle': startBattle(G, a, { ...(b || {}), from: 'scene' }); break;
        case 'worldmap': endScene(G); openWorldmap(G); break;
        case 'end': G.mode = 'ending'; G.scene = null; G.flags.cleared = true; G.events.push({ type: 'ending' }); break;
        default: break;
    }
}

export function endScene(G) {
    const S = G.scene;
    G.scene = null;
    G.cam = null;
    if (G.mode === 'scene') G.mode = 'field';
    // actors placed by the scene leave with it (the map's own people are not scene actors)
    for (const id of Object.keys(G.actors)) if (!G.actors[id].keep) delete G.actors[id];
    if (G.pendingPush) { G.p.x = G.pendingPush[0]; G.p.y = G.pendingPush[1]; G.pendingPush = null; }
    G.p.pose = null;
    G.safeT = Math.max(G.safeT || 0, 0.8);
    if (S) G.events.push({ type: 'sceneEnd', id: S.id });
}

// ---------------------------------------------------------------- the route map
export const unlockedNodes = (G) => Object.keys(WORLD).filter((k) => G.flags[WORLD[k].need]);

export function openWorldmap(G) {
    G.mode = 'worldmap';
    G.wm = { from: G.map };
    G.events.push({ type: 'worldmap' });
}
export function pickNode(G, id) {
    if (G.mode !== 'worldmap' || !WORLD[id] || !G.flags[WORLD[id].need]) return false;
    if (WORLD[id].map === G.map) { G.mode = 'field'; G.wm = null; return true; }
    G.mode = 'travel';
    G.travel = { from: G.map, to: id, t: 0, dur: 2.6 };
    G.wm = null;
    G.events.push({ type: 'travel', to: id });
    return true;
}
export function stepTravel(G, dt) {
    const T = G.travel;
    T.t += dt;
    if (T.t >= T.dur) {
        const n = WORLD[T.to];
        G.travel = null;
        loadMap(G, n.map, n.at[0], n.at[1]);
        G.mode = 'field';
        G.events.push({ type: 'arrive', to: T.to });
    }
}

// ---------------------------------------------------------------- the quest pointer
/**
 * What to do next: { text, map, kind: 'npc' | 'sign' | 'trigger' | 'exit', id?, x, y }. Shown in the HUD and followed by the bot.
 */
export function objective(G) {
    const f = G.flags;
    const npc = (map, id, text) => { const n = MAPS[map].npcs.find((x) => x.id === id); return { text, map, kind: 'npc', id, x: n.x, y: n.y }; };
    const trig = (map, scene, text) => { const t = MAPS[map].triggers.find((x) => x.scene === scene); return { text, map, kind: 'trigger', x: t.x + t.w / 2, y: t.y + t.h / 2 }; };
    if (!f.awake) return null;
    if (!f.metOtto) return npc('beach', 'otto', 'Find the light glowing by the water.');
    if (!f.surface) return { text: 'Meet Otto at the Great Lift in the drowned city.', map: 'aurelune', kind: 'sign', x: 11.5, y: 1.5 };
    if (!f.seraJoined) return npc('marisonde', 'sera', 'Find the Princess of the Melody in Marisonde.');
    if (!f.maelstraBeaten) return trig('marisonde', 'maelstraBoss', 'Defeat Maelstra in the Drowned Grotto (east).');
    if (!f.mariJoined) return npc('sunreach', 'mari', 'Find the Princess of the Word in Sunreach.');
    if (!f.hollowhayBeaten) return trig('sunreach', 'hollowhayBoss', 'Face Baron Hollowhay in the far east field.');
    if (!f.ingridJoined) return npc('frosthold', 'ingrid', 'Find the Princess of Harmony in Frosthold.');
    if (!f.rimefangBeaten) return trig('frosthold', 'rimefangBoss', 'Break the frozen gate guarded by Rimefang.');
    if (!f.wardenBeaten) return trig('spire', 'wardenBoss', 'Climb the Hush Spire.');
    if (!f.cleared) return trig('spire', 'throne', 'Face Vorthrax at the top of the Spire.');
    return null;
}

/** The last Song Crystal the band touched, or the map's own, or its spawn. */
export function warpToCrystal(G) {
    const lc = G.lastCrystal;
    const map = lc?.map || G.map;
    const c = crystalOf(map);
    const at = lc ? [lc.x, lc.y] : c ? [c.x + 0.5, c.y + 1.5] : MAPS[map].spawn;
    loadMap(G, map, at[0], at[1]);
    healAll(G, 1);
    G.mode = 'field';
    G.safeT = 2;
}
