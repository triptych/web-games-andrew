// The simulation entry points. Pure: no DOM, no renderer, no Math.random, no clock.
//   newGame(seed)  step(G, inp, dt)  act(G, action)  objective(G)  serialize / deserialize
// The view reads G and drains G.events; the UI and the bot change the game only through act() and step().

import { DAY_SECONDS } from '../config.js';
import { LOCS } from './world/locations.js';
import { anchorPos, getMap } from './world/maps.js';
import { BEATS } from './data/story.js';
import { ITEMS } from './data/items.js';
import { newGame, serialize, deserialize, curMap, enterMap, party } from './state.js';
import { startScene, sceneAdvance, sceneChoose, sceneUpdate, sceneBattleDone, beginBattle } from './scene.js';
import { movePlayer, updateNpcs, updateMobs, checkExits, checkEncounter, checkBeat, checkOptional, interact, rest, buy, sell } from './field.js';
import { playerAct, endBattle, startBattle } from './battle.js';
import { equip, unequip, swapActive, memberStats, fullHeal, addItem, removeItem, count, clampHpMp, knownSkills } from './party.js';
import * as Q from './quests.js';
import { ENEMIES } from './data/enemies.js';

export { newGame, serialize, deserialize, curMap, enterMap };

const NONE = { x: 0, y: 0, a: false };

export function step(G, inp = NONE, dt) {
    if (G.mode === 'ending' || G.mode === 'gameover') return;
    G.t += dt; G.stats.playtime += dt;
    const map = curMap(G);
    if (map.kind !== 'dungeon') G.clock = (G.clock + dt / DAY_SECONDS) % 1;
    if (G.warp) {
        const w = G.warp; w.t += dt;
        if (w.t >= 0.35 && !w.done) { w.done = true; enterMap(G, w.to, w.x, w.y, w.dir); G.events.push({ type: 'fade', dir: 'in', t: 0.35 }); }
        if (w.t >= 0.72) G.warp = null;
        return;
    }
    if (G.pending) {
        G.pending.t -= dt;
        if (G.pending.t <= 0) { const p = G.pending; G.pending = null; G.battleSource = { mob: p.mob || null }; beginBattle(G, p.spec); }
        return;
    }
    if (G.mode === 'scene') { sceneUpdate(G, dt); return; }
    if (G.mode !== 'field') return;

    checkBeat(G);
    if (G.mode !== 'field') return;
    checkOptional(G);
    if (G.mode !== 'field') return;
    const moved = movePlayer(G, inp, dt);
    if (inp.a) interact(G);
    if (G.mode !== 'field') return;
    updateNpcs(G, dt);
    const mob = updateMobs(G, dt);
    if (mob && !G.pending) {
        G.pending = { spec: { enemies: mob.form, bg: map.theme, zone: map.zone }, t: 0.7, kind: 'mob', mob: mob.id };
        G.events.push({ type: 'encounter', boss: false, mob: mob.id });
        return;
    }
    checkEncounter(G, moved);
    checkExits(G);
}

// ------------------------------------------------------------------ actions
export function act(G, a) {
    switch (a.type) {
        case 'advance': return sceneAdvance(G);
        case 'choose': return sceneChoose(G, a.i);
        case 'b': return G.battle ? playerAct(G, a.cmd) : false;
        case 'battleDone': return finishBattle(G);
        case 'retry': return retryBattle(G);
        case 'buy': return buy(G, a.item, a.n || 1);
        case 'sell': return sell(G, a.item, a.n || 1);
        case 'closeShop': G.mode = 'field'; G.shop = null; return true;
        case 'closeBoard': G.mode = 'field'; G.board = null; return true;
        case 'acceptQuest': { const list = Q.ensureBoard(G, G.board?.town || G.map); const q = list[a.idx]; return q ? Q.accept(G, q) : false; }
        case 'turnIn': { const q = G.quests.active.find((x) => x.id === a.id); return q ? Q.complete(G, q) : false; }
        case 'useItem': return useItem(G, a.item, a.target);
        case 'equip': return equip(G, a.id, a.item);
        case 'unequip': return unequip(G, a.id, a.slot);
        case 'swap': return swapActive(G, a.out, a.in);
        case 'rest': rest(G); return true;
        case 'endingDone': return endingDone(G);
        case 'abandon': G.quests.active = G.quests.active.filter((q) => q.id !== a.id); return true;
    }
    return false;
}

export function useItem(G, id, targetId) {
    const it = ITEMS[id];
    if (!it?.use || it.battleOnly || count(G, id) < 1) return false;
    if (it.use.rest) { if (!removeItem(G, id)) return false; rest(G); G.events.push({ type: 'rest', tent: true }); return true; }
    const m = G.party.members[targetId];
    if (!m) return false;
    const s = memberStats(m);
    const U = it.use;
    if (U.revive) { if (m.hp > 0) return false; m.hp = Math.max(1, Math.round(s.mhp * U.revive)); }
    else if (m.hp <= 0) return false;
    else {
        let used = false;
        if (U.hp && m.hp < s.mhp) { m.hp = Math.min(s.mhp, m.hp + U.hp); used = true; }
        if (U.mp && m.mp < s.mmp) { m.mp = Math.min(s.mmp, m.mp + U.mp); used = true; }
        if (U.maxhp) { m.bonus.hp += U.maxhp; m.hp += U.maxhp; used = true; }
        if (U.maxmp) { m.bonus.mp += U.maxmp; m.mp += U.maxmp; used = true; }
        if (U.atk) { m.bonus.atk += U.atk; m.bonus.mag += U.mag || 0; used = true; }
        if (U.cleanse) used = true;
        if (!used) return false;
    }
    removeItem(G, id);
    clampHpMp(m);
    G.events.push({ type: 'item_used', item: id, target: targetId });
    return true;
}

// ------------------------------------------------------------------ battles
function finishBattle(G) {
    const B = G.battle;
    if (!B || !B.result) return false;
    const src = G.battleSource || {};
    const result = B.result;
    if (result === 'victory' || result === 'script') {
        for (const u of B.units) if (u.side === 'enemy' && u.hp <= 0 && !u.summoned) { Q.onKill(G, u.ref); G.stats.kills++; }
    }
    const info = endBattle(G);
    const map = curMap(G);
    if (src.mob) {
        const mi = map.mobs.findIndex((m) => m.id === src.mob);
        if (mi >= 0) {
            if (result === 'victory') map.mobs.splice(mi, 1);
            else { map.mobs[mi].stun = 3.5; map.mobs[mi].state = 'return'; }
        }
    }
    if (result === 'fled') G.stats.flees++;
    if (result === 'defeat') {
        G.mode = 'gameover'; G.stats.deaths++;
        G.battle = B; // kept for the game over screen and the retry
        G.events.push({ type: 'gameover' });
        return true;
    }
    G.battleSource = null;
    G.events.push({ type: 'battle_over', result });
    if (G.scene?.battle) sceneBattleDone(G, result);
    return true;
}

function retryBattle(G) {
    if (G.mode !== 'gameover' || !G.battleSnap) return false;
    const spec = G.battle.spec, snap = JSON.parse(JSON.stringify(G.battleSnap));
    G.party.members = snap.members; G.inv = snap.inv; G.gold = snap.gold; G.bestiary = snap.bestiary; G.rng.setState(snap.rng);
    for (const id of G.party.active) { const m = G.party.members[id]; if (m.hp <= 0) m.hp = Math.max(1, Math.round(memberStats(m).mhp * 0.5)); }
    G.battle = null; G.mode = 'field';
    startBattle(G, spec);
    return true;
}

function endingDone(G) {
    if (G.mode !== 'ending') return false;
    G.mode = 'field';
    for (const id of Object.keys(G.party.members)) fullHeal(G.party.members[id]);
    enterMap(G, 'emberfield', 0, 0, 'down', { silent: true });
    const m = curMap(G);
    const p = anchorPos(m, 'plaza', 0, 1);
    G.px = p[0]; G.py = p[1];
    G.story.light = 1;
    G.clock = 0.15;
    G.events.push({ type: 'music', name: 'town' });
    startScene(G, [{ fade: 'in', t: 1 }, { banner: 'Epilogue', sub: 'A year later' }, 'Lyra: The sun keeps rising, and I keep forgetting to be amazed.', 'Kael: I never will. Come on — the world is big, and there are still some places left to see.', '*: Optional: Cinder Maw, far to the north-west, burns again. Every town\'s notice board is open for new work.', { flag: 'open_maw' }]);
    return true;
}

// ------------------------------------------------------------------ guidance
/** Where the story wants you next, in the map you are in now. */
export function objective(G) {
    const b = BEATS[G.story.i];
    if (!b) return null;
    const o = b.obj;
    const here = G.map === o.map;
    let x, y, kind = 'goal';
    const map = curMap(G);
    if (here) {
        const p = anchorPos(map, o.anchor);
        if (!p) return null;
        x = p[0]; y = p[1] + (b.trig.t === 'talk' ? 0.8 : b.trig.t === 'near' ? 1.0 : 0);
    } else if (map.kind === 'over') {
        const L = LOCS[o.map];
        x = L.x + 0.5; y = L.y + 1.5; kind = 'travel';
    } else {
        const e = map.exits[0];
        x = e.x + (e.w || 1) / 2; y = e.y + 0.5; kind = 'leave';
    }
    return { x, y, kind, text: o.text, rec: b.rec, beat: b.id, here, target: o.map };
}

export function currentHint(G) { return BEATS[G.story.i]?.hint || null; }
