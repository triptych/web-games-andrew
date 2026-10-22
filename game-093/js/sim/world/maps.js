// Builds (and caches, per game) the map you are standing in: terrain, villagers, story actors, bosses, monsters.

import { overworld } from './overworld.js';
import { genTown } from './town.js';
import { genDungeon } from './dungeon.js';
import { LOCS } from './locations.js';
import { townNpcs } from '../npcs.js';
import { STORY_NPCS, BOSSES, ACTORS } from '../data/story.js';
import { ENEMIES } from '../data/enemies.js';

export function getMap(G, id) {
    const cache = G._maps || (G._maps = {});
    if (cache[id]) return cache[id];
    let m;
    if (id === 'over') m = overworld();
    else if (LOCS[id].kind === 'town') {
        m = genTown(G.seed, id);
        m.npcs = townNpcs(G.seed, id, m).map((n) => ({ ...n, hx: n.x, hy: n.y, dir: 'down', state: 'idle', timer: 0, tx: n.x, ty: n.y, moving: false }));
    } else {
        m = genDungeon(G.seed, id);
        const st = G.mapState[id] || {};
        // chests already opened and walls already broken
        for (const p of m.props) {
            if (p.type === 'chest') { p.open = !!st.opened?.[p.id]; }
            if (p.type === 'crack' && st.cracked?.[p.id]) { p.broken = true; m.blk[p.y * m.w + p.x] = 0; }
        }
        m.mobs = m.mobs.map((mb) => ({ ...mb }));
        // quest pickups for any recover quest set in this dungeon
        for (const q of G.quests.active) {
            if (q.p.type !== 'recover' || q.p.dungeon !== id || G.inv[q.p.item]) continue;
            const spots = m.anchors.spots;
            if (!spots.length) continue;
            const [x, y] = spots[q.p.spot % spots.length];
            m.props.push({ type: 'spark', x, y, quest: q.id, item: q.p.item });
        }
    }
    cache[id] = m;
    if (m.kind !== 'over') refreshActors(G, m);
    return m;
}

export function anchorPos(map, name, dx = 0, dy = 0) {
    const a = map.anchors?.[name];
    if (!a) return null;
    return [a[0] + 0.5 + dx, a[1] + 0.5 + dy];
}

/** Show or hide the story characters and bosses whose time has come or gone. */
export function refreshActors(G, map) {
    map.npcs = map.npcs.filter((n) => !n.managed);
    for (const s of STORY_NPCS) {
        if (s.map !== map.id || !s.show(G)) continue;
        const pos = anchorPos(map, s.anchor, s.dx, s.dy);
        if (!pos) continue;
        const A = ACTORS[s.id];
        map.npcs.push({ id: s.id, name: A.name, kind: 'story', managed: true, actor: s.id, look: A.look || null, char: A.char || null, x: pos[0], y: pos[1], hx: pos[0], hy: pos[1], dir: 'down', state: 'idle', timer: 0, wander: 0, speed: 1 });
    }
    const B = BOSSES[map.id];
    if (B && !G.flags[B.flag]) {
        const pos = anchorPos(map, B.anchor);
        const e = ENEMIES[B.enemy];
        map.npcs.push({ id: 'boss:' + map.id, name: e.name, kind: 'boss', managed: true, enemy: B.enemy, scale: e.scale, x: pos[0], y: pos[1], hx: pos[0], hy: pos[1], dir: 'down', state: 'idle', timer: 0, wander: 0, speed: 1 });
    }
    // temporary scene actors survive a refresh
    for (const t of G._temp || []) if (t.map === map.id) map.npcs.push(t.npc);
}
