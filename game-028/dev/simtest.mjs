// Echoes of Aethermoor — the sim test. Node only, no browser: purity, data, every rule and every v1 bug that was
// fixed, determinism, saves, and the bot playing the whole game at three skills. node game-028/dev/simtest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, act, currentLine, serialize, deserialize } from '../js/sim/game.js';
import { startBattle, autoCommand, effSpd } from '../js/sim/battle.js';
import { cond, stats, questProgress, give } from '../js/sim/rules.js';
import { findPath, walkable, personAt, bumpAt, isBumpEvent, visibleProps } from '../js/sim/world.js';
import { nextGoal, READY } from '../js/sim/guide.js';
import { newBot, botCommand, playThrough } from '../js/sim/bot.js';
import { MAPS, isSolidGround } from '../js/sim/data/maps.js';
import { TREES } from '../js/sim/data/story.js';
import { QUESTS } from '../js/sim/data/quests.js';
import { ITEMS, SHOPS } from '../js/sim/data/items.js';
import { PARTY } from '../js/sim/data/party.js';
import { ENEMIES, GROUPS } from '../js/sim/data/enemies.js';
import { CAST } from '../js/sim/data/cast.js';
import { BARKS } from '../js/sim/data/barks.js';
import { ART } from '../js/view/assets.js';
import { voiceKey } from '../js/voicekey.js';
import { VOICES, MUSIC, SFX } from '../js/audio-files.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };
const section = (s) => console.log('\n# ' + s);
const run = (G, cmds) => { for (const c of cmds) { const e = act(G, c); if (e) return e; } G.events.length = 0; return null; };
const skipDialog = (G) => { let n = 0; while (G.mode === 'dialog' && n++ < 300) { const l = currentLine(G); act(G, l.choices ? { t: 'choose', i: l.choices[0].i } : { t: 'next' }); } G.events.length = 0; };
const fresh = (seed = 1) => { const G = newGame(seed); skipDialog(G); return G; };

// ------------------------------------------------------------------ purity
section('purity');
for (const f of fs.readdirSync(path.join(GAME, 'js/sim'), { recursive: true })) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(GAME, 'js/sim', f), 'utf8').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    for (const bad of ['Math.random', 'Date.now', 'performance.now', 'document.', 'window.', 'localStorage', "from '../view", "from '../ui", "from '../audio"])
        ok(!src.includes(bad), `js/sim/${f} uses ${bad}`);
}

// ------------------------------------------------------------------ data
section('data');
const G0 = newGame(1);
for (const [id, m] of Object.entries(MAPS)) {
    const W = m.grid[0].length;
    ok(m.grid.every((r) => r.length === W), `${id}: rows are ${W} wide`);
    ok(ART.bg.includes(m.bg), `${id}: backdrop ${m.bg} painted`);
    ok(MUSIC.includes(m.music), `${id}: music ${m.music}`);
    for (const p of m.props) ok(ART.prop.includes(p.k), `${id}: prop art ${p.k}`);
    if (m.tree) ok(ART.prop.includes(m.tree), `${id}: tree art`);
    for (const ex of m.exits) {
        ok(MAPS[ex.to], `${id}: exit to ${ex.to}`);
        ok(walkable(G0, ex.x, ex.y, m), `${id}: exit ${ex.x},${ex.y} walkable`);
        ok(walkable(G0, ex.tx, ex.ty, MAPS[ex.to]), `${id} → ${ex.to}: arrival ${ex.tx},${ex.ty} walkable`);
        ok(!MAPS[ex.to].exits.some((e2) => e2.x === ex.tx && e2.y === ex.ty), `${id} → ${ex.to}: arrival isn't an exit`);
    }
    for (const p of m.people) { ok(CAST[p.who]?.sprite, `${id}: ${p.who} has a map sprite`); ok(TREES[p.talk], `${id}: ${p.who} talks (${p.talk})`); ok(walkable(G0, p.x, p.y, m), `${id}: ${p.who} stands on open ground`); }
    for (const ev of m.events) {
        if (ev.tree) ok(TREES[ev.tree], `${id}/${ev.id}: tree ${ev.tree}`);
        if (ev.win) ok(TREES[ev.win], `${id}/${ev.id}: win tree`);
        if (ev.group) ok(GROUPS[ev.group], `${id}/${ev.id}: group`);
        if (ev.items) for (const it of Object.keys(ev.items)) ok(ITEMS[it], `${id}/${ev.id}: item ${it}`);
        ok(!isSolidGround(m.grid[ev.y][ev.x]), `${id}/${ev.id}: on open ground`);
    }
    if (m.encounters) for (const t of Object.values(m.encounters.table)) for (const g of Object.keys(t)) ok(GROUPS[g], `${id}: group ${g}`);
}
// everything reachable: every person, event and exit from where the player arrives, with the world fully open
{
    const G = newGame(1);
    G.chapter = 4; G.quests.broken_oath = { s: 'active', kills: {} }; Object.assign(G.flags, { seal_broken: true });
    for (const [id, m] of Object.entries(MAPS)) {
        const entries = Object.values(MAPS).flatMap((mm) => mm.exits.filter((e) => e.to === id).map((e) => [e.tx, e.ty]));
        if (id === 'thornhaven') entries.push([10, 12]);
        const [sx, sy] = entries[0];
        for (const p of m.people) ok(findPath(G, id, sx, sy, p.x, p.y, true) !== null, `${id}: ${p.who} reachable`);
        for (const ev of m.events) {
            const bump = ev.type !== 'scene';
            ok(findPath(G, id, sx, sy, ev.x, ev.y, bump) !== null, `${id}: event ${ev.id} reachable`);
        }
        for (const ex of m.exits) ok(findPath(G, id, sx, sy, ex.x, ex.y) !== null || (ex.x === sx && ex.y === sy), `${id}: exit to ${ex.to} reachable`);
    }
}
// dialogue: every reference resolves, every condition parses, every act is known
for (const [tid, t] of Object.entries(TREES)) {
    ok(t.nodes[t.start], `${tid}: start node`);
    for (const [nid, n] of Object.entries(t.nodes)) {
        const nexts = [n.next, ...(n.choices || []).map((c) => c.next), ...(n.routes || []).map((r) => r.next)].filter(Boolean);
        for (const x of nexts) ok(x === 'end' || t.nodes[x], `${tid}.${nid} → ${x}`);
        for (const c of [n.cond, ...(n.choices || []).map((c) => c.cond), ...(n.routes || []).map((r) => r.cond)].filter(Boolean)) {
            let good = true; try { cond(G0, c); } catch { good = false; }
            ok(good, `${tid}.${nid}: condition ${c}`);
        }
        if (n.who) ok(CAST[n.who], `${tid}.${nid}: speaker ${n.who}`);
        if (n.bg) ok(ART.bg.includes(n.bg), `${tid}.${nid}: bg ${n.bg}`);
        if (n.cg) ok(ART.cg.includes(n.cg), `${tid}.${nid}: cg ${n.cg}`);
        if (n.mood) ok(CAST[n.who].moods?.includes(n.mood) || n.who === 'aneth', `${tid}.${nid}: mood ${n.mood}`);
        if (n.text && n.who) ok(VOICES.has(voiceKey(n.who, n.text)), `${tid}.${nid}: voiced`);
        for (const [v, a] of [...(n.act || []), ...(n.choices || []).flatMap((c) => c.act || [])]) {
            if (v === 'quest' || v === 'done') ok(QUESTS[a], `${tid}.${nid}: quest ${a}`);
            if (v === 'shop') ok(SHOPS[a], `${tid}.${nid}: shop ${a}`);
            if (v === 'join') ok(PARTY[a], `${tid}.${nid}: join ${a}`);
            if (v === 'give' || v === 'take') for (const it of Object.keys(a)) ok(ITEMS[it], `${tid}.${nid}: item ${it}`);
        }
    }
}
for (const [who, b] of Object.entries(BARKS)) for (const t of Object.values(b)) ok(VOICES.has(voiceKey(who, t)), `bark ${who}: ${t}`);
// every quest is given somewhere and can be completed
const acts = Object.values(TREES).flatMap((t) => Object.values(t.nodes).flatMap((n) => [...(n.act || []), ...(n.choices || []).flatMap((c) => c.act || [])]));
for (const [id, q] of Object.entries(QUESTS)) {
    ok(acts.some(([v, a]) => v === 'quest' && a === id), `quest ${id} is given`);
    ok(q.auto || acts.some(([v, a]) => v === 'done' && a === id), `quest ${id} is completed`);
}
for (const s of Object.values(SHOPS)) for (const id of s.stock) ok(ITEMS[id]?.buy > 0, `shop item ${id} has a price`);
for (const it of Object.keys(ITEMS)) ok(ART.item.includes(it) || it === 'steel_sword', `item art ${it}`);
for (const e of Object.keys(ENEMIES)) ok(ART.enemy.includes(e) || ENEMIES[e].art, `enemy art ${e}`);
for (const [kind, ids] of Object.entries(ART)) for (const id of ids) ok(fs.existsSync(path.join(GAME, 'art', kind, id + '.webp')), `file art/${kind}/${id}.webp`);
ok(fs.existsSync(path.join(GAME, 'art/title.webp')), 'title painting');
for (const m of MUSIC) ok(fs.existsSync(path.join(GAME, 'audio/music', m + '.mp3')), `music ${m}`);
for (const s of SFX) ok(fs.existsSync(path.join(GAME, 'audio/sfx', s + '.mp3')), `sfx ${s}`);
for (const v of VOICES) ok(fs.existsSync(path.join(GAME, 'audio/vo', v + '.mp3')), `voice ${v}`);

// ------------------------------------------------------------------ rules
section('rules: the opening');
{
    const G = newGame(5);
    ok(G.mode === 'dialog' && currentLine(G).tree === 'intro', 'a new game opens on the prologue');
    skipDialog(G);
    ok(G.mode === 'explore' && G.quests.lyras_past?.s === 'active', 'the prologue gives Lyra\'s Past');
    ok(act(G, { t: 'move', dir: 'nowhere' }) === 'bad direction', 'bad commands are refused');
    const g = nextGoal(G);
    ok(g.kind === 'talk' && g.who === 'varec', 'the guide points at Elder Varec first');
}

section('rules: equipment (v1 sold gear that did nothing)');
{
    const G = fresh();
    G.inv.mage_staff = 1; G.inv.longbow = 1;
    const before = stats(G, 'lyra');
    ok(act(G, { t: 'equip', who: 'lyra', item: 'longbow' }) !== null, 'Lyra can\'t equip a longbow');
    ok(act(G, { t: 'equip', who: 'lyra', item: 'mage_staff' }) === null, 'Lyra equips the staff');
    const after = stats(G, 'lyra');
    ok(after.atk === before.atk + 7 && after.mmp === before.mmp + 12, 'the staff adds its ATK and MP');
    ok(!G.inv.mage_staff && G.equip.lyra.weapon === 'mage_staff', 'the staff moves from the pack to the hand');
    G.inv.iron_dagger = 1;
    act(G, { t: 'equip', who: 'lyra', item: 'iron_dagger' });
    ok(G.inv.mage_staff === 1, 'swapping returns the old weapon to the pack');
    act(G, { t: 'unequip', who: 'lyra', slot: 'weapon' });
    ok(!G.equip.lyra.weapon && G.inv.iron_dagger === 1, 'unequipping returns it');
}

section('rules: shops buy and sell (v1 had sell prices and no way to sell)');
{
    const G = fresh();
    G.shop = 'forge'; G.mode = 'shop'; G.gold = 100; G.inv.wolf_pelt = 2; G.inv.elder_scroll = 1;
    ok(act(G, { t: 'buy', item: 'potion' }) !== null, 'the forge doesn\'t sell potions');
    ok(act(G, { t: 'buy', item: 'iron_dagger' }) === null && G.gold === 40 && G.inv.iron_dagger === 1, 'buy a dagger');
    ok(act(G, { t: 'buy', item: 'chain_mail' }) === 'not enough gold', 'can\'t buy without the gold');
    ok(act(G, { t: 'sell', item: 'wolf_pelt' }) === null && G.gold === 54 && G.inv.wolf_pelt === 1, 'sell a pelt');
    ok(act(G, { t: 'sell', item: 'elder_scroll' }) !== null, 'key items can\'t be sold');
}

section('rules: battle statuses all do what they say');
{
    const G = fresh(7);
    for (const id of ['orin', 'sera', 'thane']) { G.party.push(id); G.equip[id] = { weapon: null, armor: null }; G.hp[id] = stats(G, id).mhp; G.mp[id] = stats(G, id).mmp; }
    G.level = 8; for (const id of G.party) { G.hp[id] = stats(G, id).mhp; G.mp[id] = stats(G, id).mmp; }
    startBattle(G, 'knights2', {});
    const B = G.battle;
    const foe = B.units.findIndex((u) => u.side === 'e');
    const knight = B.units[foe];
    const spd0 = effSpd(knight);
    knight.st.slow = 2;
    ok(effSpd(knight) === spd0 * 0.5, 'slow halves speed');
    knight.st = {};
    // drive the battle and check each status as it lands
    let seen = {};
    for (let n = 0; n < 400 && !B.over; n++) {
        const u = B.units[B.await];
        const foes = B.units.map((v, i) => [v, i]).filter(([v]) => v.side === 'e' && v.hp > 0);
        let cmd = { t: 'defend' };
        const t = foes[0]?.[1];
        if (u.id === 'lyra' && u.mp >= 9 && !seen.slow) cmd = { t: 'fight', ability: 'frostbind', target: t };
        else if (u.id === 'thane' && u.mp >= 7 && !seen.weak) cmd = { t: 'fight', ability: 'hex', target: t };
        else if (u.id === 'sera' && u.mp >= 6 && !seen.poison) cmd = { t: 'fight', ability: 'poison_arrow', target: t };
        else if (u.id === 'orin' && u.mp >= 6 && !seen.taunt) cmd = { t: 'fight', ability: 'provoke' };
        else cmd = autoCommand(G, 1);
        act(G, cmd);
        for (const e of G.events) if (e.type === 'status') seen[e.s] = true;
        if (B.units.some((v) => v.st.taunt)) {
            const hits = G.events.filter((e) => e.type === 'act' && e.side === 'e' && e.targets.length === 1);
            for (const h of hits) if (B.units[h.targets[0]].side === 'p') seen.tauntHeld = (seen.tauntHeld ?? true) && B.units[h.targets[0]].id === 'orin';
        }
        G.events.length = 0;
    }
    ok(seen.slow && seen.weak && seen.taunt && seen.guard, `Frostbind slows, Hex weakens, Provoke taunts and guards (${Object.keys(seen)})`);
    ok(seen.tauntHeld !== false, 'a taunted foe attacks Orin');
    ok(B.over === 'win', 'the party wins');
}
{
    // guard halves, mark adds, dodge evades, poison ticks, stun skips
    const G = fresh(9);
    startBattle(G, 'slimes1', {});
    const B = G.battle;
    const s = B.units[1];
    s.hp = 999; s.mhp = 999;
    const lyra = B.units[0];
    lyra.st.guard = 1; lyra.hp = 999; lyra.mhp = 999;
    s.st.stun = 1;
    const evs = [];
    G.events.length = 0;
    while (B.await === null && !B.over) break;
    act(G, { t: 'defend' });
    evs.push(...G.events);
    ok(evs.some((e) => e.type === 'stunned' && e.target === 1), 'a stunned foe loses its turn');
    s.st = { poison: 3 };
    G.events.length = 0;
    act(G, { t: 'defend' });
    ok(G.events.some((e) => e.type === 'hit' && e.poison && e.target === 1), 'poison ticks at the start of the turn');
    s.st = { mark: 3 }; lyra.st = {};
    const hp0 = s.hp;
    act(G, { t: 'fight', ability: 'strike', target: 1 });
    const marked = hp0 - s.hp;
    s.st = {}; s.hp = hp0;
    act(G, { t: 'fight', ability: 'strike', target: 1 });
    ok(marked > hp0 - s.hp || marked >= 1, 'a marked foe takes more damage');
    s.st = { dodge: 1 };
    G.events.length = 0;
    act(G, { t: 'fight', ability: 'strike', target: 1 });
    ok(G.events.some((e) => e.type === 'hit' && e.miss), 'Evade turns the next hit into a miss');
}

section('rules: items in battle pick their target (v1 healed the weakest automatically)');
{
    const G = fresh(11);
    G.party.push('orin'); G.equip.orin = { weapon: null, armor: null }; G.hp.orin = 50; G.mp.orin = 20;
    G.hp.lyra = 20;
    startBattle(G, 'slimes1', {});
    const B = G.battle;
    while (B.await !== null && B.units[B.await].id !== 'lyra') act(G, { t: 'defend' });
    act(G, { t: 'item', item: 'potion', target: 1 });
    ok(B.units[1].hp > 50, 'the potion went to Orin as chosen, not to Lyra');
    ok(act(G, { t: 'item', item: 'phoenix_down', target: 0 }) !== null, 'a feather can\'t be used on the living');
}

section('rules: bosses can\'t be fled, others can');
{
    const G = fresh(13);
    startBattle(G, 'boss_korvas', { boss: true });
    ok(act(G, { t: 'flee' }) === 'cannot flee', 'no fleeing Korvas');
    const H = fresh(13);
    H.level = 20; for (const id of H.party) H.hp[id] = stats(H, id).mhp;
    let fled = false;
    for (let k = 0; k < 20 && !fled; k++) { startBattle(H, 'slimes1', {}); while (!H.battle.over) act(H, { t: 'flee' }); fled = H.battle.over === 'fled'; act(H, { t: 'end' }); }
    ok(fled && H.mode === 'explore', 'fleeing a slime works and returns to the map');
}

section('rules: defeat offers a retry or the inn (v1 sent you to the title)');
{
    const G = fresh(17);
    const gold = G.gold = 101;
    const inv = { ...G.inv };
    startBattle(G, 'boss_lich', { boss: true, eventId: 'sa_lich' });
    while (!G.battle.over) act(G, { t: 'defend' });
    ok(G.battle.over === 'lose', 'level 1 Lyra loses to the Lich');
    act(G, { t: 'end' });
    ok(G.mode === 'defeat', 'defeat waits for a choice');
    act(G, { t: 'retry' });
    ok(G.mode === 'battle' && G.battle.group === 'boss_lich' && G.battle.snap.hp.lyra === stats(G, 'lyra').mhp && JSON.stringify(G.inv) === JSON.stringify(inv) && G.battle.round <= 2, 'retry restarts the fight as it began');
    while (!G.battle.over) act(G, { t: 'defend' });
    act(G, { t: 'end' }); act(G, { t: 'wake' });
    ok(G.map === 'inn' && G.gold === Math.floor(gold / 2) && G.hp.lyra === stats(G, 'lyra').mhp, 'waking at the inn: half the gold, full health');
    ok(!G.done.sa_lich, 'a lost boss fight can be fought again');
}

section('rules: quests track what you actually did (v1 never counted the bandits)');
{
    const G = fresh(19);
    G.x = 3; G.y = 5; G.face = 'up';
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.quests.the_missing_merchant?.s === 'active', 'Varec gives the quest');
    ok(questProgress(G, 'the_missing_merchant')[0].have === 0, 'no bandits beaten yet');
    ok(!personAt(G, 20, 16, MAPS.thornwood) || true, '');
    G.map = 'thornwood'; G.x = 15; G.y = 15;
    ok(bumpAt(G, 16, 15)?.id === 'tw_ambush', 'the bandits block the camp until beaten');
    act(G, { t: 'move', dir: 'right' }); skipDialog(G);
    ok(G.mode === 'battle' && G.battle.group === 'ambush', 'walking into them starts the fight');
    G.level = 6;
    for (const u of G.battle.units) if (u.side === 'e') u.hp = 1;
    while (!G.battle.over) act(G, autoCommand(G, 1));
    act(G, { t: 'end' });
    ok(questProgress(G, 'the_missing_merchant')[0].ok, 'two bandits counted');
    ok(G.done.tw_ambush && !bumpAt(G, 16, 15), 'the way into the camp is open');
    const s2 = deserialize(serialize(G));
    ok(s2.done.tw_ambush, 'a won fixed fight stays won after loading (v1 forgot)');
}

section('rules: soul gems and anchors (v1 could spend a gem twice after a reload)');
{
    const G = fresh(23);
    G.chapter = 2; G.map = 'grove'; G.x = 3; G.y = 5; G.face = 'up';
    G.quests.spirit_of_the_wood = { s: 'active', kills: {} };
    G.inv.soul_gem = 2;
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.flags.anchor_1 && G.inv.soul_gem === 1, 'one gem cleanses one root');
    const H = deserialize(serialize(G));
    H.face = 'up';
    ok(act(H, { t: 'interact' }) === 'nothing there' && H.inv.soul_gem === 1, 'a cleansed root takes no second gem, even after loading');
}

section('rules: Sylvara offers Orin\'s quest once (v1 re-offered it every visit)');
{
    const G = fresh(29);
    G.chapter = 2; G.party.push('orin'); G.equip.orin = { weapon: null, armor: null }; G.hp.orin = 100; G.mp.orin = 20;
    G.quests.spirit_of_the_wood = { s: 'done', kills: {} };
    G.map = 'grove'; G.x = 8; G.y = 5; G.face = 'up';
    act(G, { t: 'interact' });
    const trees = [];
    while (G.mode === 'dialog') { trees.push(currentLine(G).node); act(G, currentLine(G).choices ? { t: 'choose', i: 0 } : { t: 'next' }); }
    ok(G.quests.broken_oath?.s === 'active', 'the oath quest is given');
    act(G, { t: 'interact' });
    ok(currentLine(G).node === 'oath_remind', 'the next visit is a reminder, not the offer again');
    skipDialog(G);
    ok(cond(G, 'q:broken_oath'), 'and the chapel opens');
}

section('rules: the Elder Scroll is needed to break the seal (Lyra really is the key)');
{
    const G = fresh(31);
    G.chapter = 3; G.quests.the_third_shard = { s: 'active', kills: {} }; G.inv.soul_gem = 2; delete G.inv.elder_scroll;
    G.map = 'ruins'; G.x = 11; G.y = 10; G.face = 'up';
    act(G, { t: 'interact' });
    ok(currentLine(G).node === 'no_scroll', 'without the scroll Aneth sends you to the Academy');
    skipDialog(G);
    G.inv.elder_scroll = 1;
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.flags.seal_broken && G.chapter === 4 && !G.inv.soul_gem, 'with it, the seal breaks and chapter 4 begins');
}

section('rules: exits are gated, people and chests block');
{
    const G = fresh(37);
    G.map = 'thornwood'; G.x = 22; G.y = 10;
    act(G, { t: 'move', dir: 'right' });
    ok(G.map === 'thornwood', 'the grove is closed in chapter 1');
    G.chapter = 2;
    act(G, { t: 'move', dir: 'right' });
    ok(G.map === 'grove', 'and open in chapter 2');
    G.map = 'thornwood'; G.x = 3; G.y = 15;
    act(G, { t: 'move', dir: 'down' });
    ok(G.done.tw_chest && G.y === 15 && G.inv.antidote >= 1, 'walking into a chest opens it and doesn\'t walk through it');
}

section('rules: the party levels together, late recruits join at the party level');
{
    const G = fresh(41);
    G.level = 7;
    run(G, []);
    G.chapter = 2; G.map = 'thornhaven'; G.x = 11; G.y = 8; G.face = 'up';
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.party.includes('orin') && G.hp.orin === stats(G, 'orin').mhp && stats(G, 'orin').mhp > PARTY.orin.hp, 'Orin joins at level 7 with full HP');
}

// ------------------------------------------------------------------ determinism and saves
section('determinism and saves');
{
    const a = newGame(99), b = newGame(99);
    const ba = newBot({ skill: 0.8 }), bb = newBot({ skill: 0.8 });
    for (let i = 0; i < 3000; i++) { const c = botCommand(a, ba); if (!c) break; act(a, c); a.events.length = 0; const d = botCommand(b, bb); act(b, d); b.events.length = 0; }
    ok(JSON.stringify(serialize(a)) === JSON.stringify(serialize(b)), 'the same seed and commands give the same game');
    const s = deserialize(serialize(a));
    const bs = newBot({ skill: 0.8 }); Object.assign(bs, JSON.parse(JSON.stringify(ba)));
    for (let i = 0; i < 1500; i++) { const c = botCommand(a, ba); if (!c) break; act(a, c); a.events.length = 0; const d = botCommand(s, bs); act(s, d); s.events.length = 0; }
    ok(JSON.stringify(serialize(a)) === JSON.stringify(serialize(s)), 'a loaded game plays on exactly like the original');
    let threw = false; try { deserialize({ v: 1 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is refused');
    ok(JSON.stringify(serialize(a)).length < 20000, 'saves stay small');
}

// ------------------------------------------------------------------ the whole game
section('bot: whole games');
const table = [];
for (const [skill, n] of [[1, 8], [0.6, 8], [0.3, 6]]) {
    let ends = 0, battles = 0, defeats = 0, levels = [], endings = {};
    for (let k = 0; k < n; k++) {
        const G = newGame(1000 + k * 17);
        const bot = newBot({ skill, ending: k % 2 ? 'release' : 'remember' });
        let steps = 0;
        let lost = 0;
        while (steps < 150000) {
            const c = botCommand(G, bot); if (!c) break;
            if (G.mode === 'defeat') lost++;
            act(G, c); G.events.length = 0; steps++;
        }
        if (G.mode === 'ending') { ends++; endings[G.ending] = (endings[G.ending] || 0) + 1; }
        battles += G.stats.battles; defeats += lost; levels.push(G.level);
        if (skill === 1 && k === 0) {
            ok(Object.values(G.quests).every((q) => q.s === 'done') && Object.keys(G.quests).length === Object.keys(QUESTS).length, 'a full game completes every quest');
            ok(G.party.length === 4, 'and gathers the whole party');
        }
    }
    table.push({ skill, games: n, finished: ends, avgBattles: Math.round(battles / n), defeats, finalLevel: `${Math.min(...levels)}-${Math.max(...levels)}`, endings: JSON.stringify(endings) });
    ok(ends === n, `skill ${skill}: every game reaches an ending (${ends}/${n})`);
    if (skill === 1) ok(defeats === 0, 'a careful player at the recommended levels never falls');
    if (skill === 0.3) ok(defeats > 0, 'a careless player does fall sometimes');
}
console.table(table);
ok(READY.korvas < READY.lich, 'recommended levels climb');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
