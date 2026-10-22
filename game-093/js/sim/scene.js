// The scene runner: dialogue, cutscene commands, choices, and the hand-off to battles. Story beats, villagers, chests and
// shops all speak through this, so every conversation in the game is the same machinery.

import { CHARS } from './data/classes.js';
import { ACTORS, BEATS } from './data/story.js';
import { ENEMIES } from './data/enemies.js';
import { ITEMS } from './data/items.js';
import { addItem, removeItem, recruit, fullHeal } from './party.js';
import { startBattle } from './battle.js';
import { curMap, enterMap } from './state.js';
import { anchorPos, refreshActors } from './world/maps.js';

const ALIASES = {
    'Elder Aldric': { actor: 'aldric' }, 'Hollow Herald': { actor: 'herald' }, 'Town Guard': { actor: 'guard' }, 'Sister Elara': { char: 'elara' },
    'Warden Vael': { actor: 'warden' }, Malachar: { actor: 'malachar' }, 'Harbor Enforcer': { actor: 'bruteA' }, Gnarlroot: { enemy: 'gnarlroot' },
    Boldur: { enemy: 'boldur' }, Nerezza: { enemy: 'kraken' }, "Ra'Khet": { enemy: 'pharaoh' }, Glacivar: { enemy: 'wyrm' }, Ignaroth: { enemy: 'pyrelord' },
};

export function faceFor(G, name) {
    if (!name || name === '*') return null;
    for (const c of Object.values(CHARS)) if (c.name === name) return { char: c.id };
    const al = ALIASES[name];
    if (al?.char) return { char: al.char };
    if (al?.enemy) return { enemy: al.enemy };
    if (al?.actor) { const a = ACTORS[al.actor]; return a.char ? { char: a.char } : a.enemy ? { enemy: a.enemy, pal: a.pal } : { look: a.look }; }
    for (const a of Object.values(ACTORS)) if (a.name === name) return a.char ? { char: a.char } : a.enemy ? { enemy: a.enemy } : { look: a.look };
    const n = curMap(G).npcs.find((x) => x.name === name);
    if (n?.look) return { look: n.look };
    if (n?.enemy) return { enemy: n.enemy };
    return null;
}

export function startScene(G, cmds, opts = {}) {
    if (G.scene) { G.scene.cmds.splice(G.scene.i, 0, ...cmds); return; }
    G.scene = { cmds: cmds.slice(), i: 0, wait: 0, line: null, choice: null, battle: false, beat: opts.beat || null, onEnd: opts.onEnd || null };
    G.mode = 'scene';
    G.events.push({ type: 'scene_start', beat: opts.beat || null });
    run(G);
}

export function sceneAdvance(G) {
    const S = G.scene;
    if (!S || !S.line) return false;
    S.line = null;
    G.events.push({ type: 'say_end' });
    run(G);
    return true;
}

export function sceneChoose(G, i) {
    const S = G.scene;
    if (!S || !S.choice || !S.choice[i]) return false;
    const opt = S.choice[i];
    S.choice = null;
    G.events.push({ type: 'choice_end', i });
    if (opt.do) S.cmds.splice(S.i, 0, ...opt.do);
    run(G);
    return true;
}

export function sceneUpdate(G, dt) {
    const S = G.scene;
    if (!S) return;
    if (S.wait > 0) { S.wait -= dt; if (S.wait <= 0) { S.wait = 0; run(G); } }
}

/** After a scene battle: the scene goes on if the party won (or the script ended it). */
export function sceneBattleDone(G, result) {
    const S = G.scene;
    if (!S) return;
    S.battle = false;
    if (result === 'defeat') { G.scene = null; return; }
    run(G);
}

function endScene(G) {
    const S = G.scene;
    G.scene = null;
    if (G.mode === 'scene') G.mode = 'field';
    if (S.beat) {
        const b = BEATS.find((x) => x.id === S.beat);
        if (b && BEATS[G.story.i] === b) G.story.i++;
        G.flags['beat_' + S.beat] = 1;
        G.events.push({ type: 'beat_done', beat: S.beat });
    }
    G.events.push({ type: 'scene_end' });
    G.events.push({ type: 'look', target: null });
    S.onEnd?.(G);
}

function position(G, ref, dx = 0, dy = 0) {
    const m = curMap(G);
    if (Array.isArray(ref)) return [ref[0] + dx, ref[1] + dy];
    return anchorPos(m, ref, dx, dy);
}

function run(G) {
    const S = G.scene;
    let guard = 0;
    while (S && G.scene === S && !S.line && !S.choice && S.wait <= 0 && !S.battle && guard++ < 500) {
        if (S.i >= S.cmds.length) { endScene(G); return; }
        const c = S.cmds[S.i++];
        exec(G, S, c);
    }
}

function exec(G, S, c) {
    if (typeof c === 'string') {
        const k = c.indexOf(': ');
        const who = k > 0 ? c.slice(0, k) : '*';
        const text = k > 0 ? c.slice(k + 2) : c;
        S.line = { who, text, face: faceFor(G, who) };
        G.events.push({ type: 'say', who, text, face: S.line.face });
        return;
    }
    if (c.if !== undefined) { const ok = typeof c.if === 'function' ? c.if(G) : !!G.flags[c.if]; S.cmds.splice(S.i, 0, ...(ok ? c.then || [] : c.else || [])); return; }
    if (c.fade) { G.events.push({ type: 'fade', dir: c.fade, t: c.t ?? 0.5 }); S.wait = c.t ?? 0.5; return; }
    if (c.wait) { S.wait = c.wait; return; }
    if (c.shake !== undefined) { G.events.push({ type: 'shake', n: c.shake }); return; }
    if (c.flash) { G.events.push({ type: 'flash', color: c.flash }); S.wait = 0.2; return; }
    if (c.flag) { G.flags[c.flag] = c.v === undefined ? true : c.v; G.events.push({ type: 'flag', flag: c.flag }); refreshActors(G, curMap(G)); return; }
    if (c.music) { G.events.push({ type: 'music', name: c.music }); return; }
    if (c.light !== undefined) { G.story.light = c.light; G.events.push({ type: 'light', v: c.light }); return; }
    if (c.banner) { G.events.push({ type: 'banner', text: c.banner, sub: c.sub }); S.wait = 2.8; return; }
    if (c.look !== undefined) { G.events.push({ type: 'look', target: lookTarget(G, c.look) }); return; }
    if (c.recruit) {
        const m = recruit(G, c.recruit);
        if (m) { G.flags['has_' + c.recruit] = true; G.events.push({ type: 'recruit', id: c.recruit }); refreshActors(G, curMap(G)); S.wait = 0.9; }
        return;
    }
    if (c.give) { const n = c.n || 1; addItem(G, c.give, n); G.events.push({ type: 'get', item: c.give, n, key: ITEMS[c.give]?.type === 'key' }); S.wait = 0.9; return; }
    if (c.take) { removeItem(G, c.take, c.n || 1); return; }
    if (c.gold) { G.gold += c.gold; G.events.push({ type: 'get', gold: c.gold }); return; }
    if (c.heal) { for (const id of G.party.active.concat(G.party.reserve)) fullHeal(G.party.members[id]); G.events.push({ type: 'heal_all' }); return; }
    if (c.choice) { S.choice = c.choice; G.events.push({ type: 'choice', options: c.choice.map((o) => o.text) }); return; }
    if (c.place) {
        for (const [who, ref] of Object.entries(c.place)) {
            if (who === 'kael' || who === 'player') { const p = position(G, ref[0], ref[1], ref[2]); if (p) { G.px = p[0]; G.py = p[1]; G.trail = []; G.events.push({ type: 'snap' }); } }
        }
        return;
    }
    if (c.spawn) {
        const m = curMap(G), A = ACTORS[c.spawn.id];
        const p = position(G, c.spawn.anchor || c.spawn.at, c.spawn.dx, c.spawn.dy);
        if (!A || !p) return;
        const npc = { id: c.spawn.id, name: A.name, kind: A.enemy ? 'boss' : 'story', temp: true, enemy: A.enemy || null, scale: A.enemy ? ENEMIES[A.enemy].scale : 1, actor: c.spawn.id, look: A.look || null, char: A.char || null, pal: A.pal || ENEMIES[A.enemy]?.pal, x: p[0], y: p[1], hx: p[0], hy: p[1], dir: 'down', state: 'idle', timer: 0, wander: 0, speed: 1 };
        (G._temp || (G._temp = [])).push({ map: G.map, npc });
        m.npcs.push(npc);
        G.events.push({ type: 'spawn', id: npc.id });
        S.wait = 0.4;
        return;
    }
    if (c.despawn) {
        const m = curMap(G);
        m.npcs = m.npcs.filter((n) => n.id !== c.despawn);
        G._temp = (G._temp || []).filter((t) => t.npc.id !== c.despawn);
        G.events.push({ type: 'despawn', id: c.despawn });
        return;
    }
    if (c.warp) {
        enterMap(G, c.warp.map, c.warp.x, c.warp.y, c.warp.dir || 'down', { silent: true });
        return;
    }
    if (c.battle) {
        const spec = { ...c.battle, enemies: c.battle.enemies.map((e) => ({ ...e })) };
        S.battle = true;
        G.battleSource = { scene: true };
        beginBattle(G, spec);
        return;
    }
    if (c.end) {
        G.mode = 'ending';
        G.ending = { choice: G.flags.ending_sacrifice ? 'sacrifice' : 'shared', t: 0 };
        G.flags.game_complete = true;
        G.events.push({ type: 'ending', choice: G.ending.choice });
        G.scene = null;
        return;
    }
    if (c.fn) { c.fn(G); return; }
}

function lookTarget(G, t) {
    if (t === null || t === 'player') return null;
    const m = curMap(G);
    if (t === 'boss') { const n = m.npcs.find((x) => x.kind === 'boss'); return n ? { x: n.x, y: n.y } : null; }
    const n = m.npcs.find((x) => x.id === t);
    return n ? { x: n.x, y: n.y } : null;
}

/** Snapshot the party (so a lost fight can be retried) and start the fight. */
export function beginBattle(G, spec) {
    G.battleSnap = JSON.parse(JSON.stringify({ members: G.party.members, inv: G.inv, gold: G.gold, bestiary: G.bestiary, rng: G.rng.state() }));
    G.stats.battles++;
    startBattle(G, spec);
}
