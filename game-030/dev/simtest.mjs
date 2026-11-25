// Coppergate Lane — the sim test. Node only, no browser: purity, data (every map, person, event, tree, quest, art
// file and voice line), every rule and every v1 gap that was filled, determinism, saves, and the bot playing the
// whole game at three skills. node game-030/dev/simtest.mjs   (MEDIA=0 skips the art and audio file checks)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, act, currentLine, serialize, deserialize } from '../js/sim/game.js';
import { startBattle, autoCommand } from '../js/sim/battle.js';
import { cond, stats, questProgress } from '../js/sim/rules.js';
import { findPath, walkable, personAt, bumpAt } from '../js/sim/world.js';
import { nextGoal, sideGoal, READY } from '../js/sim/guide.js';
import { newBot, botCommand } from '../js/sim/bot.js';
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
import { REST_COST } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const MEDIA = process.env.MEDIA !== '0';
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };
const section = (s) => console.log('\n# ' + s);
// Click through a scene: take the choice that gives a quest or a friend, else one that doesn't loop back.
const skipDialog = (G) => {
    let n = 0; const seen = new Set();
    while (G.mode === 'dialog' && n++ < 300) {
        const l = currentLine(G);
        if (!l.choices) { act(G, { t: 'next' }); continue; }
        const node = TREES[G.dialog.tree].nodes[G.dialog.node];
        const useful = l.choices.find((c) => (node.choices[c.i].act || []).some(([v]) => v === 'quest' || v === 'join'));
        const fresh = l.choices.find((c) => !seen.has(G.dialog.tree + '.' + node.choices[c.i].next));
        const pick = useful || fresh || l.choices[0];
        seen.add(G.dialog.tree + '.' + node.choices[pick.i].next);
        act(G, { t: 'choose', i: pick.i });
    }
    G.events.length = 0;
};
const fresh = (seed = 1) => { const G = newGame(seed); skipDialog(G); return G; };
const join = (G, id) => { if (!G.party.includes(id)) { G.party.push(id); G.equip[id] = { weapon: null, armor: null }; } for (const p of G.party) { G.hp[p] = stats(G, p).mhp; G.mp[p] = stats(G, p).mmp; } };
const fight = (G, cmdFor) => { let n = 0; while (!G.battle.over && n++ < 600) act(G, cmdFor ? cmdFor(G) : autoCommand(G, 1)); G.events.length = 0; };

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
    ok(['title', 'lane', 'wilds', 'gully', 'battle', 'boss', 'ending'].includes(m.music) && (!MEDIA || MUSIC.includes(m.music)), `${id}: music ${m.music} is a theme with a track`);
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
        if (ev.who && ev.type === 'fight') ok(ART.enemy.includes(ev.who), `${id}/${ev.id}: enemy art ${ev.who}`);
        if (ev.art) ok(ART.prop.includes(ev.art), `${id}/${ev.id}: prop art ${ev.art}`);
        if (ev.items) for (const it of Object.keys(ev.items)) ok(ITEMS[it], `${id}/${ev.id}: item ${it}`);
        ok(!isSolidGround(m.grid[ev.y][ev.x]), `${id}/${ev.id}: on open ground`);
    }
    if (m.encounters) for (const t of Object.values(m.encounters.table)) for (const g of Object.keys(t)) ok(GROUPS[g], `${id}: group ${g}`);
}
for (const [g, keys] of Object.entries(GROUPS)) for (const k of keys) ok(ENEMIES[k], `group ${g}: ${k}`);
// everything reachable: every person, event and exit from where the player arrives, with the world fully open
{
    const G = newGame(1);
    G.inv.lairkey = 1; G.done.gl_crab = true;
    for (const [id, m] of Object.entries(MAPS)) {
        const entries = Object.values(MAPS).flatMap((mm) => mm.exits.filter((e) => e.to === id).map((e) => [e.tx, e.ty]));
        if (id === 'lane') entries.push([12, 13]);
        const [sx, sy] = entries[0];
        for (const p of m.people) ok(findPath(G, id, sx, sy, p.x, p.y, true) !== null, `${id}: ${p.who} reachable`);
        for (const ev of m.events) {
            const bump = ev.type !== 'scene';
            ok(findPath(G, id, sx, sy, ev.x, ev.y, bump) !== null, `${id}: event ${ev.id} reachable`);
        }
        for (const ex of m.exits) ok(findPath(G, id, sx, sy, ex.x, ex.y) !== null || (ex.x === sx && ex.y === sy), `${id}: exit to ${ex.to} reachable`);
    }
    // the kettle sits behind its crab: it can't be reached until the fight is won
    const H = newGame(1);
    ok(findPath(H, 'gully', 12, 1, 4, 14, true) === null, 'the kettle nook is closed while the crab guards it');
    H.done.gl_crab = true;
    ok(findPath(H, 'gully', 12, 1, 4, 14, true) !== null, 'and open once it is beaten');
}
// dialogue: every reference resolves, every condition parses, every act is known
let spoken = 0, voiced = 0;
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
        if (n.mood) ok(CAST[n.who].moods?.includes(n.mood), `${tid}.${nid}: mood ${n.mood}`);
        if (n.text && n.who && n.who !== 'n') { spoken++; if (VOICES.has(voiceKey(n.who, n.text))) voiced++; }
        for (const [v, a] of [...(n.act || []), ...(n.choices || []).flatMap((c) => c.act || [])]) {
            if (v === 'quest' || v === 'done') ok(QUESTS[a], `${tid}.${nid}: quest ${a}`);
            if (v === 'shop') ok(SHOPS[a], `${tid}.${nid}: shop ${a}`);
            if (v === 'join') ok(PARTY[a], `${tid}.${nid}: join ${a}`);
            if (v === 'give' || v === 'take') for (const it of Object.keys(a)) ok(ITEMS[it], `${tid}.${nid}: item ${it}`);
        }
    }
}
ok(!MEDIA || voiced === spoken, `every spoken dialogue line is voiced (${voiced} of ${spoken})`);
if (MEDIA && VOICES.size) for (const [who, b] of Object.entries(BARKS)) for (const t of Object.values(b)) ok(VOICES.has(voiceKey(who === 'bigbertha' ? 'bertha' : who, t)), `bark ${who}: ${t}`);
// every quest is given somewhere and can be completed
const acts = Object.values(TREES).flatMap((t) => Object.values(t.nodes).flatMap((n) => [...(n.act || []), ...(n.choices || []).flatMap((c) => c.act || [])]));
for (const [id, q] of Object.entries(QUESTS)) {
    ok(acts.some(([v, a]) => v === 'quest' && a === id), `quest ${id} is given`);
    ok(q.auto || acts.some(([v, a]) => v === 'done' && a === id), `quest ${id} is completed`);
}
for (const s of Object.values(SHOPS)) for (const id of s.stock) ok(ITEMS[id]?.buy > 0, `shop item ${id} has a price`);
for (const it of Object.keys(ITEMS)) ok(ART.item.includes(it), `item art ${it}`);
for (const e of Object.keys(ENEMIES)) ok(ART.enemy.includes(e), `enemy art ${e}`);
for (const id of Object.keys(CAST)) if (CAST[id].sprite) ok(ART.chibi.includes(id), `chibi ${id}`);
if (MEDIA) {
    for (const [kind, ids] of Object.entries(ART)) for (const id of ids) ok(fs.existsSync(path.join(GAME, 'art', kind, id + '.webp')), `file art/${kind}/${id}.webp`);
    ok(fs.existsSync(path.join(GAME, 'art/title.webp')), 'title painting');
    for (const m of MUSIC) ok(fs.existsSync(path.join(GAME, 'audio/music', m + '.mp3')), `music ${m}`);
    for (const s of SFX) ok(fs.existsSync(path.join(GAME, 'audio/sfx', s + '.mp3')), `sfx ${s}`);
    for (const v of VOICES) ok(fs.existsSync(path.join(GAME, 'audio/vo', v + '.mp3')), `voice ${v}`);
}

// ------------------------------------------------------------------ rules
section('rules: the opening');
{
    const G = newGame(5);
    ok(G.mode === 'dialog' && currentLine(G).tree === 'intro', 'a new game opens on the prologue');
    skipDialog(G);
    ok(G.mode === 'explore' && G.party.length === 1 && G.equip.wick.weapon === 'wrench', 'Wick starts alone with a wrench');
    ok(act(G, { t: 'move', dir: 'nowhere' }) === 'bad direction', 'bad commands are refused');
    const g = nextGoal(G);
    ok(g.kind === 'talk' && g.who === 'trina', 'the guide points at Trina first');
}

section('rules: the Golden Gear is sequenced (v1 let Bertha drop the gear the Mayor was meant to hold)');
{
    const G = fresh(3);
    ok(G.map === 'lane' && !!MAPS.lane.exits.length, 'we start in the lane');
    // the iron door needs the pass, which only the Mayor gives
    G.map = 'gully'; G.x = 25; G.y = 17; G.face = 'up';
    act(G, { t: 'move', dir: 'up' });
    ok(G.map === 'gully' && G.events.some((e) => e.type === 'blocked'), 'the lair door is locked without the pass');
    G.events.length = 0;
    ok(!G.inv.lairkey && !G.flags.briefed, 'no pass and no briefing yet');
    // talk to the Mayor
    G.map = 'lane'; G.x = 5; G.y = 14; G.face = 'up';
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.flags.briefed && G.inv.lairkey === 1 && G.quests.main_gear?.s === 'active', 'the Mayor briefs you, gives the pass and the quest');
    ok(questProgress(G, 'main_gear')[0].ok && !questProgress(G, 'main_gear')[1].ok, 'the journal shows the briefing done and Bertha not yet');
    G.map = 'gully'; G.x = 25; G.y = 17; G.face = 'up';
    act(G, { t: 'move', dir: 'up' });
    ok(G.map === 'lair', 'with the pass the door opens');
    // beat Bertha: the gear comes from her, then goes back to the Mayor
    for (const id of ['trina', 'mabel']) join(G, id);
    G.level = 9; G.equip.wick.weapon = 'sparkrod'; Object.assign(G.inv, { tea: 4, scone: 4, oilcan: 2 }); join(G, 'wick');
    G.x = 8; G.y = 4; G.face = 'up';
    act(G, { t: 'move', dir: 'up' }); skipDialog(G);
    ok(G.mode === 'battle' && G.battle.boss, 'walking into Bertha starts the boss fight');
    fight(G);
    act(G, { t: 'end' });
    skipDialog(G);
    ok(G.flags.bertha_down && G.inv.goldgear === 1, 'beating Bertha gives you the Golden Gear');
    ok(!G.quests.main_gear || G.quests.main_gear.s === 'active', 'the quest is not done until the Mayor has it');
    G.map = 'lane'; G.x = 5; G.y = 14; G.face = 'up';
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.quests.main_gear.s === 'done' && G.flags.gear_returned && !G.inv.goldgear, 'returning it completes the quest and takes the gear');
    ok(G.mode === 'ending' && G.ending === 'cozy', 'and the lane has its ending');
}

section('rules: companions join through their quests (v1 was solo)');
{
    const G = fresh(4);
    G.map = 'lane'; G.x = 4; G.y = 7; G.face = 'up';
    act(G, { t: 'interact' });
    ok(currentLine(G).tree === 'trina', 'Trina greets you');
    skipDialog(G);
    ok(G.quests.main_gear?.s === 'active' && G.quests.side_scraps?.s === 'active', 'Trina gives the main quest and the scraps errand');
    ok(!G.party.includes('trina'), 'she does not join yet');
    G.inv.scrap = 5;
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.party.includes('trina') && !G.inv.scrap && G.inv.sparkrod === 1, 'five scraps: she joins, takes the scrap and hands over the Spark Rod');
    ok(G.hp.trina === stats(G, 'trina').mhp, 'she arrives at full health');
    ok(!personAt(G, 4, 6) && nextGoal(G).who !== 'trina', 'she leaves the lane and the guide forgets her');
    // Mabel
    G.map = 'lane'; G.x = 22; G.y = 7; G.face = 'up';
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.quests.side_kettle?.s === 'active', 'Mabel asks for her kettle');
    ok(sideGoal(G).id === 'gl_crab', 'the guide sends you to the crab first');
    G.inv.kettle = 1;
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.party.includes('mabel') && !G.inv.kettle && G.inv.scone >= 2, 'the kettle brings Mabel along with scones');
    const lv1 = stats(G, 'mabel');
    G.level = 6;
    ok(stats(G, 'mabel').mhp > lv1.mhp, 'recruits level with the party');
}

section('rules: Bertram sells, buys, rests and has a quest (v1 had a shop and nothing else)');
{
    const G = fresh(6);
    G.map = 'lane'; G.x = 22; G.y = 13; G.face = 'up';
    act(G, { t: 'interact' });
    const choices = () => currentLine(G).choices?.map((c) => c.t);
    while (!choices()) act(G, { t: 'next' });
    ok(choices().length === 4, 'four things to ask: wares, a bed, work, nothing');
    act(G, { t: 'choose', i: 0 });
    skipDialog(G);
    ok(G.mode === 'shop' || G.shop === 'bertram', 'the wares open the shop');
    G.gold = 100; G.mode = 'shop';
    ok(act(G, { t: 'buy', item: 'tea' }) === null && G.gold === 86, 'buy tea');
    ok(act(G, { t: 'buy', item: 'sparkrod' }) !== null, 'the Spark Rod is not for sale');
    ok(act(G, { t: 'sell', item: 'goldgear' }) !== null, 'key items can\'t be sold');
    G.inv.cog = 2;
    ok(act(G, { t: 'sell', item: 'cog' }) === null && G.gold === 94, 'sell a cog');
    act(G, { t: 'close' });
    // a bed
    G.hp.wick = 5; G.mp.wick = 0; G.gold = 100;
    G.map = 'lane'; G.x = 22; G.y = 13; G.face = 'up';
    act(G, { t: 'interact' });
    while (currentLine(G) && !currentLine(G).choices) act(G, { t: 'next' });
    const bed = currentLine(G).choices.find((c) => c.t.includes('bed'));
    act(G, { t: 'choose', i: bed.i }); skipDialog(G);
    ok(G.gold === 100 - REST_COST && G.hp.wick === stats(G, 'wick').mhp && G.mp.wick === stats(G, 'wick').mmp, 'a bed restores everyone for the price');
    G.gold = 5;
    act(G, { t: 'interact' });
    while (currentLine(G) && !currentLine(G).choices) act(G, { t: 'next' });
    ok(!currentLine(G).choices.some((c) => c.t.includes('bed')), 'with no gold the bed is not offered');
    act(G, { t: 'choose', i: currentLine(G).choices.at(-1).i }); skipDialog(G);
    // springs
    G.x = 22; G.y = 13; G.face = 'up';
    act(G, { t: 'interact' });
    while (currentLine(G) && !currentLine(G).choices) act(G, { t: 'next' });
    const help = currentLine(G).choices.find((c) => c.t.includes('help'));
    act(G, { t: 'choose', i: help.i });
    act(G, { t: 'choose', i: 0 }); skipDialog(G);
    ok(G.quests.side_springs?.s === 'active', 'Bertram asks for three springs');
    G.inv.spring = 3;
    act(G, { t: 'interact' }); skipDialog(G);
    ok(G.quests.side_springs.s === 'done' && G.inv.charm === 1 && !G.inv.spring, 'three springs earn the Tinker Charm');
}

section('rules: equipment');
{
    const G = fresh();
    G.inv.spanner = 1; G.inv.rollingpin = 1; G.inv.apron = 1; G.inv.charm = 1;
    const before = stats(G, 'wick');
    ok(act(G, { t: 'equip', who: 'wick', item: 'rollingpin' }) !== null, 'Wick can\'t wield Mabel\'s rolling pin');
    ok(act(G, { t: 'equip', who: 'wick', item: 'spanner' }) === null, 'Wick equips the spanner');
    const after = stats(G, 'wick');
    ok(after.atk === before.atk - 4 + 7 && after.spd === before.spd - 1, 'the spanner replaces the wrench\'s ATK and costs a point of speed');
    ok(G.inv.wrench === 1 && !G.inv.spanner, 'swapping returns the old weapon to the pack');
    act(G, { t: 'equip', who: 'wick', item: 'charm' });
    ok(stats(G, 'wick').mhp === before.mhp + 14, 'the charm adds its HP');
    act(G, { t: 'unequip', who: 'wick', slot: 'armor' });
    ok(!G.equip.wick.armor && G.inv.charm === 1, 'unequipping returns it');
}

section('rules: statuses and foe behaviour (each foe plays differently)');
{
    // a Rust Crab shells up (guard) and pinches (rust); a stunned foe loses its turn; a taunted foe goes for the taunter
    const G = fresh(9); join(G, 'trina'); join(G, 'mabel');
    startBattle(G, 'crab', {});
    const B = G.battle;
    for (const u of B.units) if (u.side === 'p') u.hp = u.mhp = 9999;
    const crab = B.units.findIndex((u) => u.side === 'e');
    B.units[crab].hp = B.units[crab].mhp = 9999;
    const used = {}, seen = {};
    for (let n = 0; n < 60 && B.round < 16; n++) {
        for (const e of G.events) { if (e.type === 'act' && e.side === 'e') used[e.ability] = (used[e.ability] || 0) + 1; if (e.type === 'status') seen[e.s] = true; }
        G.events.length = 0;
        act(G, { t: 'defend' });
    }
    ok(used.shell_up > 0 && used.pinch > 0 && used.snip > 0, `the crab uses all three moves (${JSON.stringify(used)})`);
    ok(seen.guard, 'Shell Up puts it on guard');
    ok(B.units.some((u) => u.side === 'p' && u.st.rust) || seen.rust, 'a pinch can rust the party\'s armour');
    {
        const H = fresh(21); join(H, 'trina'); join(H, 'mabel');
        startBattle(H, 'cogs2', {});
        const hb = H.battle; const cog = hb.units.findIndex((u) => u.side === 'e');
        hb.units[cog].st.stun = 1;
        H.events.length = 0;
        act(H, { t: 'defend' });
        ok(H.events.some((e) => e.type === 'stunned' && e.target === cog) || hb.units[cog].st.stun === undefined, 'a stunned foe loses its turn');
    }
    {
        // wolves go for the weakest, and howl
        const H = fresh(22); join(H, 'trina'); join(H, 'mabel'); H.level = 4; join(H, 'wick');
        startBattle(H, 'wolf', {});
        const hb = H.battle;
        hb.units[1].hp = 5;   // Trina is the weakest
        let hitTrina = 0, hitOther = 0, howled = false;
        for (let n = 0; n < 40 && !hb.over; n++) {
            for (const e of H.events) { if (e.type === 'act' && e.side === 'e' && e.ability === 'bite') { if (e.targets[0] === 1) hitTrina++; else hitOther++; } if (e.type === 'act' && e.ability === 'howl') howled = true; }
            H.events.length = 0;
            hb.units[1].hp = Math.max(1, Math.min(hb.units[1].hp, 5)); hb.units[hb.await]?.hp;
            act(H, { t: 'defend' });
        }
        ok(hitTrina >= hitOther, `wolves hunt the weakest (${hitTrina} on Trina, ${hitOther} elsewhere)`);
    }
    // rust actually lowers defence
    const H = fresh(10); join(H, 'trina'); join(H, 'mabel');
    startBattle(H, 'crab', {});
    const hb = H.battle, foe = hb.units.findIndex((u) => u.side === 'e');
    const dmg = (rust) => { hb.units[foe].st = rust ? { rust: 3 } : {}; hb.units[foe].hp = hb.units[foe].mhp = 999; const hp0 = hb.units[foe].hp; const u = hb.units[hb.await]; u.atk = 40; act(H, { t: 'fight', ability: PARTY[u.id].abilities[0].id, target: foe }); return hp0 - hb.units[foe].hp; };
    let rusted = 0, plain = 0;
    for (let k = 0; k < 6 && !hb.over; k++) { if (hb.await === null) break; rusted += dmg(true); H.events.length = 0; if (hb.await === null) break; plain += dmg(false); H.events.length = 0; }
    ok(rusted > plain, `rust raises damage taken (${rusted} vs ${plain})`);
}
{
    // pickpockets: gold is taken, and comes back when the thief falls
    const G = fresh(12); join(G, 'trina'); join(G, 'mabel'); G.level = 6; join(G, 'wick');
    G.gold = 200;
    startBattle(G, 'bandit', {});
    const B = G.battle;
    const thief = B.units.findIndex((u) => u.side === 'e');
    let stole = false, recovered = false;
    for (let n = 0; n < 400 && !B.over; n++) {
        for (const e of G.events) { if (e.type === 'steal') stole = true; if (e.type === 'recover') recovered = true; }
        G.events.length = 0;
        if (B.units[thief].stolen > 0 && !recovered) { ok(G.gold < 200, 'the gold left the purse while the thief holds it'); B.units[thief].hp = 1; }
        act(G, autoCommand(G, 1));
    }
    for (const e of G.events) { if (e.type === 'steal') stole = true; if (e.type === 'recover') recovered = true; }
    // the bandit may never have chosen to steal on this seed; force it in a second pass
    if (!stole) {
        const H = fresh(13); join(H, 'trina'); H.gold = 200; startBattle(H, 'bandit', {});
        const b = H.battle.units.findIndex((u) => u.side === 'e');
        H.battle.units[b].spd = 99; H.battle.units[b].cds = {};
        for (let n = 0; n < 30 && !H.battle.over && !stole; n++) { for (const e of H.events) if (e.type === 'steal') stole = true; H.events.length = 0; act(H, { t: 'defend' }); }
        for (const e of H.events) if (e.type === 'steal') stole = true;
        if (stole) { const t = H.battle.units[b]; const gold = H.gold; t.hp = 1; while (!H.battle.over) { const u = H.battle.units[H.battle.await]; act(H, { t: 'fight', ability: PARTY[u.id].abilities[0].id, target: b }); } ok(H.gold >= gold + t.stolen, 'killing the thief returns the gold'); }
    }
    ok(stole, 'a Lane Bandit picks a pocket');
}
{
    // Bertha: telegraphs a slam, summons cogs when hurt, loses her temper, can't be fled
    let tell = false, summoned = false, slam = false, grew = false, temper = false, won = 0;
    for (let seed = 14; seed < 22; seed++) {
        const G = fresh(seed); join(G, 'trina'); join(G, 'mabel'); G.level = 10; G.equip.wick.weapon = 'sparkrod'; Object.assign(G.inv, { tea: 4, scone: 4, oilcan: 2 }); join(G, 'wick');
        startBattle(G, 'bertha', { boss: true });
        if (seed === 14) { ok(act(G, { t: 'flee' }) === 'cannot flee', 'no fleeing Bertha'); ok(act(G, { t: 'item', item: 'smoke', target: 0 }) !== null, 'and no smoke pellet either'); }
        const scan = () => { for (const e of G.events) { if (e.type === 'tell') tell = true; if (e.type === 'summon') summoned = true; if (e.type === 'act' && e.ability === 'gear_slam') slam = true; if (e.type === 'status' && e.s === 'atkup' && G.battle.units[e.target].side === 'e') temper = true; } G.events.length = 0; };
        for (let n = 0; n < 500 && !G.battle.over; n++) { scan(); act(G, autoCommand(G, 1)); }
        scan();
        if (G.battle.units.length > 4) grew = true;
        if (G.battle.over === 'win') won++;
    }
    ok(tell && slam, 'Bertha winds up, then slams');
    ok(summoned && grew, 'she calls her cogs when she is hurt, and they join the fight');
    ok(temper, 'she loses her temper near the end');
    ok(won >= 6, `a level 10 party with supplies usually beats her (${won}/8)`);
}
{
    // smoke pellets: the whole party flees a normal fight
    const G = fresh(15); G.inv.smoke = 1;
    startBattle(G, 'cogs2', {});
    act(G, { t: 'item', item: 'smoke', target: 0 });
    ok(G.battle.over === 'fled' && !G.inv.smoke, 'a smoke pellet always gets the party away');
    act(G, { t: 'end' });
    ok(G.mode === 'explore', 'back on the map');
    ok(act(G, { t: 'use', item: 'smoke', who: 'wick' }) !== null, 'smoke only works in a fight');
}

section('rules: items in battle pick their target');
{
    const G = fresh(11); join(G, 'trina');
    G.hp.trina = 10; G.hp.wick = 30; G.inv.tea = 2; G.inv.wakeup = 1;
    startBattle(G, 'cogs2', {});
    const B = G.battle;
    while (B.await !== null && B.units[B.await].id !== 'wick') act(G, { t: 'defend' });
    const hp0 = B.units[1].hp;
    act(G, { t: 'item', item: 'tea', target: 1 });
    ok(B.units[1].hp > hp0, 'the tea went to Trina as chosen');
    ok(act(G, { t: 'item', item: 'wakeup', target: 0 }) !== null, 'a Wake-Up Brew can\'t be used on the living');
}

section('rules: defeat offers a retry or home (v1 only had the soft fail)');
{
    const G = fresh(17);
    G.gold = 100;
    const inv = { ...G.inv };
    startBattle(G, 'bertha', { boss: true, eventId: 'lr_bertha' });
    fight(G, () => ({ t: 'defend' }));
    ok(G.battle.over === 'lose', 'level 1 Wick loses to Bertha');
    act(G, { t: 'end' });
    ok(G.mode === 'defeat', 'defeat waits for a choice');
    act(G, { t: 'retry' });
    ok(G.mode === 'battle' && G.battle.group === 'bertha' && JSON.stringify(G.inv) === JSON.stringify(inv) && G.battle.round <= 2, 'retry restarts the fight as it began');
    fight(G, () => ({ t: 'defend' }));
    act(G, { t: 'end' }); act(G, { t: 'wake' });
    ok(G.map === 'lane' && G.gold === Math.floor(100 * 0.75) && G.hp.wick === stats(G, 'wick').mhp, 'home on the lane: a quarter of the gold gone, full health');
    ok(!G.done.lr_bertha, 'a lost boss fight can be fought again');
}

section('rules: lost gold is part of the retry snapshot');
{
    const G = fresh(18); G.gold = 100;
    startBattle(G, 'bandit', {});
    G.gold = 40;   // as if the thief had been at work
    fight(G, () => ({ t: 'defend' }));
    ok(G.battle.over === 'lose', 'the careless lose');
    act(G, { t: 'end' }); act(G, { t: 'retry' });
    ok(G.gold === 100, 'a retry gets the stolen gold back');
}

section('rules: events live in the save (v1 forgot chests and fights)');
{
    const G = fresh(19);
    G.map = 'wilds'; G.x = 23; G.y = 3; G.face = 'right';
    act(G, { t: 'move', dir: 'right' });
    ok(G.done.wl_chest && G.inv.oilcan === 2 && G.gold === 85, 'walking into the chest opens it and does not walk through');
    const H = deserialize(serialize(G));
    H.x = 23; H.y = 3;
    act(H, { t: 'move', dir: 'right' });
    ok(H.inv.oilcan === 2 && H.done.wl_chest && H.x === 23 && !currentLine(H), 'it stays opened after loading');
    // walking into it again (a held key does, the next frame) just stops; Space gets a short note, not a dialogue
    H.events.length = 0;
    act(H, { t: 'move', dir: 'right' });
    ok(H.mode === 'explore' && !H.dialog && H.events.some((e) => e.type === 'bonk') && H.inv.oilcan === 2, 'walking into an opened chest again just stops: no "empty" dialogue');
    H.events.length = 0;
    act(H, { t: 'interact' });
    ok(H.mode === 'explore' && !H.dialog && H.events.some((e) => e.type === 'say' && /cobwebs/.test(e.text)), 'Space at an opened chest gives a short note, not a dialogue');
    // the kettle crab
    G.map = 'gully'; G.x = 6; G.y = 14; G.face = 'left'; G.mode = 'explore'; G.dialog = null;
    act(G, { t: 'move', dir: 'left' }); skipDialog(G);
    ok(G.mode === 'battle' && G.battle.group === 'kettle_crab', 'the crab guards the nook');
    G.level = 6; join(G, 'trina'); join(G, 'wick');
    fight(G); act(G, { t: 'end' });
    ok(G.done.gl_crab && !bumpAt(G, 5, 14), 'beat it and the way in is open');
    const s2 = deserialize(serialize(G));
    ok(s2.done.gl_crab, 'a won fixed fight stays won after loading');
}

section('rules: exits are gated, people and chests block');
{
    const G = fresh(37);
    ok(!walkable(G, 3, 3) , 'buildings block');
    G.map = 'lane'; G.x = 4; G.y = 7; G.face = 'up';
    act(G, { t: 'move', dir: 'up' });
    ok(G.mode === 'dialog', 'walking into a person talks to them');
    skipDialog(G);
    ok(G.y === 7, 'and does not walk through them');
    G.map = 'lane'; G.x = 12; G.y = 16;
    act(G, { t: 'move', dir: 'down' });
    ok(G.map === 'wilds' && G.x === 12 && G.y === 1, 'the south road leads to the Wilds');
    ok(G.grace > 0, 'with a few safe steps after a map change');
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
    ok(threw, 'an unknown save version is refused (a v1 save is ignored cleanly)');
    ok(JSON.stringify(serialize(a)).length < 20000, 'saves stay small');
}

// ------------------------------------------------------------------ the whole game
section('bot: whole games');
const table = [];
for (const [skill, n] of [[1, 10], [0.6, 8], [0.3, 6]]) {
    let ends = 0, battles = 0, defeats = 0, levels = [], full = 0;
    for (let k = 0; k < n; k++) {
        const G = newGame(1000 + k * 17);
        const bot = newBot({ skill });
        let steps = 0, lost = 0;
        while (steps < 150000) {
            const c = botCommand(G, bot); if (!c) break;
            if (G.mode === 'defeat') lost++;
            act(G, c); G.events.length = 0; steps++;
        }
        if (G.mode === 'ending') ends++;
        if (Object.values(G.quests).every((q) => q.s === 'done') && Object.keys(G.quests).length === Object.keys(QUESTS).length && G.party.length === 3) full++;
        battles += G.stats.battles; defeats += lost; levels.push(G.level);
    }
    table.push({ skill, games: n, finished: ends, allQuests: full, avgBattles: Math.round(battles / n), defeats, finalLevel: `${Math.min(...levels)}-${Math.max(...levels)}` });
    ok(ends === n, `skill ${skill}: every game reaches the ending (${ends}/${n})`);
    if (skill === 1) { ok(full === n, 'a full game completes every quest and gathers the whole party'); ok(defeats <= 1, `a careful player at the recommended levels (almost) never falls (${defeats} falls)`); }
    if (skill === 0.3) ok(defeats > 0, 'a careless player does fall sometimes');
}
console.table(table);
ok(READY.bertha >= 5, 'Bertha is recommended at level 5 or above');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
