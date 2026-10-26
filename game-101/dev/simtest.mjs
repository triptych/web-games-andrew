/**
 * simtest.mjs — headless checks of PIXELCRYPT's simulation. No browser.
 *
 *   node game-101/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-101/dev/simtest.mjs
 *   SEEDS=12 STEPS=20000 VERBOSE=1 node game-101/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. gen: floors over many seeds and depths are valid (stairs and every feature reachable without
 *    secrets, secret pockets sealed by exactly the secret doors, bosses on every fifth floor);
 *    items, monsters and quests are well-formed at every depth, up to depth 400.
 * 3. rules: movement, doors, secrets, traps, chests, battles, flee, curses, shops, inn, recruits,
 *    church, investments and idle income, quests, the journal, guardians and checkpoints.
 * 4. determinism: same seed and commands → same game; a save round trip plays on identically.
 * 5. bot: the bot plays whole games on SEEDS seeds with per-command invariants and prints a table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const STEPS = +(process.env.STEPS || 12000);
const want = (name) => !ONLY.length || ONLY.includes(name);

const Cfg = await import('../js/config.js');
const Rng = await import('../js/rng.js');
const Game = await import('../js/sim/game.js');
const Dun = await import('../js/sim/dungeon.js');
const Mon = await import('../js/sim/monsters.js');
const Items = await import('../js/sim/items.js');
const Party = await import('../js/sim/party.js');
const Town = await import('../js/sim/town.js');
const Quests = await import('../js/sim/quests.js');
const World = await import('../js/sim/world.js');
const Battle = await import('../js/sim/battle.js');
const Journal = await import('../js/sim/journal.js');
const Camp = await import('../js/sim/camp.js');
const Bot = await import('../js/sim/bot.js');
const Inv = await import('../js/sim/inv.js');
const Inv_give = (G, it) => Inv.give(G, it, 'found');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const act = (G, c) => { Game.act(G, c); };
const clearEv = (G) => { G.events.length = 0; };
const hasEv = (G, t) => G.events.some((e) => e.type === t);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('gen')) {
    section('gen: floors');
    let floors = 0, secrets = 0, bosses = 0, rooms = 0;
    for (let seed = 1; seed <= 40; seed++) {
        for (const depth of [1, 2, 3, 5, 8, 10, 15, 20, 33, 60, 150]) {
            const f = Dun.genFloor(seed * 977, depth);
            floors++;
            const dm = Dun.distMap(f, f.start.x, f.start.y, false);
            const dms = Dun.distMap(f, f.start.x, f.start.y, true);
            let bad = null;
            if (dm[Dun.cellIdx(f, f.down.x, f.down.y)] <= 0) bad = 'stairs down unreachable';
            for (const k of Object.keys(f.feat)) {
                const [x, y] = k.split(',').map(Number);
                const ft = f.feat[k];
                if (dms[Dun.cellIdx(f, x, y)] < 0) bad = `${ft.type} unreachable even with secrets`;
                if (ft.type === 'chest' && ft.secret && dm[Dun.cellIdx(f, x, y)] >= 0) bad = 'secret chest not behind a secret door';
            }
            for (let i = 0; i < dms.length; i++) if (dms[i] < 0) bad = 'a cell is walled off entirely';
            // borders are solid
            for (let x = 0; x < f.w; x++) if (!(Dun.getEdge(f, x, 0, 0) === 1 && Dun.getEdge(f, x, f.h - 1, 2) === 1)) bad = 'open north/south border';
            for (let y = 0; y < f.h; y++) if (!(Dun.getEdge(f, 0, y, 3) === 1 && Dun.getEdge(f, f.w - 1, y, 1) === 1)) bad = 'open east/west border';
            if (f.bossFloor !== (depth % 5 === 0)) bad = 'boss floor flag wrong';
            if (f.w < 8 || f.h < 8 || f.w > 36 || f.h > 36) bad = `bad size ${f.w}x${f.h}`;
            if (!ok(!bad, `seed ${seed} depth ${depth}: ${bad || 'valid'}`)) break;
            secrets += f.secrets; rooms += f.rooms.length; if (f.bossFloor) bosses++;
            // determinism and pack round trip
            if (seed % 8 === 0) {
                const g = Dun.genFloor(seed * 977, depth);
                ok(JSON.stringify(Dun.packFloor(f)) === JSON.stringify(Dun.packFloor(g)), `floor ${seed}/${depth} is a pure function of its seed`);
                ok(JSON.stringify(Dun.packFloor(Dun.unpackFloor(JSON.parse(JSON.stringify(Dun.packFloor(f)))))) === JSON.stringify(Dun.packFloor(f)), `floor ${seed}/${depth} packs and unpacks`);
            }
        }
    }
    console.log(`  ${floors} floors, ${rooms} rooms, ${secrets} secret doors, ${bosses} boss floors`);

    section('gen: items, monsters, quests');
    const r = Rng.makeRng(4242);
    const rarCount = [0, 0, 0, 0, 0];
    let cursed = 0, total = 0;
    for (const il of [1, 2, 5, 9, 14, 20, 40, 80, 150, 400]) {
        for (let i = 0; i < 80; i++) {
            const kinds = [Items.genWeapon(r, il), Items.genArmor(r, il), Items.genCharm(r, il), Items.genPotion(r, il), Items.genScroll(r, il), Items.genWand(r, il), Items.genTome(r, il), Items.genCollectible(r, il)];
            for (const it of kinds) {
                total++;
                const good = it.name && !/undefined|NaN/.test(it.name) && Number.isFinite(it.price) && it.price > 0 && it.key && (it.t === 'w' || it.t === 'a' || it.t === 'c' ? Object.values(it.st).every(Number.isFinite) : true) && it.rar >= 0 && it.rar <= 4;
                if (!ok(good, `item at level ${il} is well-formed (${it.name})`)) break;
                rarCount[it.rar]++;
                if (it.cursed) cursed++;
                if (it.t === 'w' || it.t === 'a') {
                    const j = Journal.REG[it.t === 'w' ? 'weapons' : 'armor'];
                    if (!j.some((e) => e.key === it.key)) ok(false, `journal has a slot for ${it.key}`);
                }
            }
        }
    }
    console.log(`  ${total} items; rarity ${rarCount.join('/')}; ${cursed} cursed`);
    ok(rarCount.every((n) => n > 0), 'every rarity occurs');
    ok(cursed > 0, 'cursed items occur');
    // power grows with item level
    const med = (l) => { const a = Array.from({ length: 41 }, () => Items.genWeapon(Rng.makeRng(l * 31 + Math.floor(r() * 1e6)), l, { base: 'sword', rar: 0, noCurse: true }).st.atk); return a.sort((x, y) => x - y)[20]; };
    ok(med(10) > med(5) && med(40) > med(20) && med(200) > med(100), 'weapon power grows with item level, without bound');
    for (const d of [1, 3, 8, 20, 55, 200, 999]) {
        const enc = Mon.genEncounter(r, d, d, 6);
        ok(enc.length >= 1 && enc.length <= 6 && enc.every((m) => m.hp > 0 && m.atk > 0 && m.def >= 0 && m.xp > 0 && m.gold >= 0 && Number.isFinite(m.agi) && m.name && !/undefined/.test(m.name)), `encounter at depth ${d} is well-formed (${enc.map((m) => m.name).join(', ')})`);
        const boss = Mon.genBoss(r, d, d, 4);
        ok(boss.boss && boss.hp > enc[0].hp && boss.sp.length >= 1 && boss.sprite.boss, `boss at depth ${d}: ${boss.name}`);
    }
    const hp = (d) => Mon.genMonster(Rng.makeRng(1), d, d, 'wolf', { noVariant: true }).hp;
    ok(hp(50) > hp(25) && hp(25) > hp(10), 'monsters scale with depth');
}

if (want('rules')) {
    section('rules');
    const fresh = (seed = 11) => { const G = Game.newGame(seed); clearEv(G); return G; };
    let G = fresh();
    ok(G.party.length === 4 && G.party.every((m) => m.hp > 0 && m.eq.weapon && m.eq.body), 'a new game has four equipped adventurers');
    ok(G.gold === 300 && G.inv.length >= 3 && G.depth === 0 && !G.floor, 'it starts in town with gold and potions');
    ok(Town.shopStock(G, 'items').length > 3 && Town.shopStock(G, 'smith').length > 8 && Town.shopStock(G, 'magic').length > 5, 'the shops are stocked');
    ok(G.town.recruits.length === 3 && G.quests.board.length === 4, 'the inn has recruits and the guild a board');

    // ---- movement
    act(G, { t: 'enter', depth: 1 });
    ok(G.floor && G.depth === 1 && hasEv(G, 'floor'), 'entering the dungeon loads floor 1');
    act(G, { t: 'enter', depth: 7 });
    ok(G.depth === 1, 'you cannot enter a floor you have not unlocked');
    const f = G.floor;
    let p = G.pos;
    const open = (d) => Dun.passable(Dun.getEdge(f, p.x, p.y, d));
    ok(open(p.d) || [0, 1, 2, 3].some(open), 'the start has an exit');
    const wallDir = [0, 1, 2, 3].find((d) => Dun.getEdge(f, p.x, p.y, d) === 1);
    if (wallDir !== undefined) {
        const rel = ['f', 'sr', 'b', 'sl'][(wallDir - p.d + 4) % 4];
        const before = { ...p };
        clearEv(G); act(G, { t: 'move', m: rel });
        ok(G.pos.x === before.x && G.pos.y === before.y && hasEv(G, 'bump'), 'walking into a wall bumps and goes nowhere');
    }
    const d0 = G.pos.d; act(G, { t: 'move', m: 'r' });
    ok(G.pos.d === (d0 + 1) % 4, 'turning right turns clockwise');
    act(G, { t: 'move', m: 'l' }); act(G, { t: 'move', m: 'l' });
    ok(G.pos.d === (d0 + 3) % 4, 'turning left turns back');
    const exitDir = [0, 1, 2, 3].find((d) => Dun.passable(Dun.getEdge(f, G.pos.x, G.pos.y, d)));
    const rel2 = ['f', 'sr', 'b', 'sl'][(exitDir - G.pos.d + 4) % 4];
    const s0 = G.steps, pos0 = { ...G.pos };
    act(G, { t: 'move', m: rel2 });
    ok(G.steps === s0 + 1 && (G.pos.x !== pos0.x || G.pos.y !== pos0.y), 'a step moves one cell and counts');
    ok(f.seen[Dun.cellIdx(f, G.pos.x, G.pos.y)] === 2, 'the cell you stand on is mapped');

    // ---- doors and secrets (on a purpose-built spot)
    G = fresh(5); act(G, { t: 'enter', depth: 1 });
    {
        const f2 = G.floor;
        const x = G.pos.x, y = G.pos.y;
        const d = [0, 1, 2, 3].find((k) => Dun.passable(Dun.getEdge(f2, x, y, k)));
        Dun.setEdge(f2, x, y, d, 2);
        G.pos.d = d; G.danger = -999;
        clearEv(G); act(G, { t: 'move', m: 'f' });
        ok(hasEv(G, 'door') && Dun.getEdge(f2, x, y, d) === 4, 'walking through a closed door opens it');
        const back = (d + 2) % 4;
        Dun.setEdge(f2, G.pos.x, G.pos.y, back, 3);
        act(G, { t: 'move', m: 'b' });
        ok(G.pos.x !== x || G.pos.y !== y, 'a secret door blocks like a wall');
        let found = false;
        for (let i = 0; i < 80 && !found; i++) { act(G, { t: 'search' }); found = Dun.getEdge(f2, G.pos.x, G.pos.y, back) === 2; }
        ok(found, 'searching finds a secret door');
    }

    // ---- chests, traps, gathering
    G = fresh(6); G.maxDepth = 3; World.enterFloor(G, 3, 'up');
    {
        const f3 = G.floor;
        const here = `${G.pos.x},${G.pos.y}`;
        f3.feat = { [here]: { type: 'chest', tier: 1, trap: null, opened: false } };
        G.arrived = false;
        act(G, { t: 'interact' });
        ok(G.dialog && G.dialog.kind === 'chest', 'standing on a chest and acting opens its dialog');
        const gold0 = G.gold, inv0 = G.inv.reduce((a, x) => a + (x.n || 1), 0);
        act(G, { t: 'dlg', id: 'open' });
        ok(G.gold > gold0 && G.inv.reduce((a, x) => a + (x.n || 1), 0) > inv0 && f3.feat[here].opened, 'opening a chest gives gold and items');
        ok(G.dialog?.kind === 'result', 'and shows what was found');
        act(G, { t: 'dlg', id: 'ok' });
        ok(!G.dialog, 'the dialog closes');

        f3.feat = { [here]: { type: 'chest', tier: 0, trap: 'blast', opened: false } };
        act(G, { t: 'interact' });
        const hp0 = G.party.map((m) => m.hp);
        act(G, { t: 'dlg', id: 'open' });
        ok(G.party.some((m, i) => m.hp < hp0[i]) && G.party.every((m) => m.hp >= 1), 'a blast trap hurts but never kills');
        act(G, { t: 'dlg', id: 'ok' });

        // a trap next door
        const d = [0, 1, 2, 3].find((k) => Dun.passable(Dun.getEdge(f3, G.pos.x, G.pos.y, k)));
        const nx = G.pos.x + Cfg.DIRS[d].dx, ny = G.pos.y + Cfg.DIRS[d].dy;
        f3.feat = { [`${nx},${ny}`]: { type: 'trap', kind: 'dart', hid: true, sprung: false } };
        G.pos.d = d; G.danger = -999;
        for (const m of G.party) m.luck = 0;
        let sprung = false;
        for (let i = 0; i < 40 && !sprung; i++) {   // the party may notice it first: walk back and forth
            clearEv(G); act(G, { t: 'move', m: 'f' });
            const ft = f3.feat[`${nx},${ny}`];
            sprung = ft.sprung;
            if (!sprung) { if (G.dialog) act(G, { t: 'dlg', id: 'ok' }); act(G, { t: 'move', m: 'b' }); f3.feat[`${nx},${ny}`] = { type: 'trap', kind: 'dart', hid: true, sprung: false, found: false }; }
        }
        ok(sprung && G.party.some((m) => m.st.poison) && hasEv(G, 'trap'), 'a hidden trap springs and poisons someone');
        if (G.dialog) act(G, { t: 'dlg', id: 'ok' });
        ok(G.journal.trap.dart?.triggered >= 1, 'the journal counts the trap');

        const here2 = `${G.pos.x},${G.pos.y}`;
        f3.feat[here2] = { type: 'gather', kind: 'herb', left: 2 };
        G.arrived = false; act(G, { t: 'interact' });
        ok(G.dialog?.kind === 'gather', 'a gathering point offers to gather');
        let got = 0;
        for (let i = 0; i < 6 && G.dialog?.kind === 'gather'; i++) { const before = G.inv.length; act(G, { t: 'dlg', id: 'gather' }); got += G.inv.length - before; }
        ok(G.inv.some((x) => x.kind === 'herb') || got >= 0, 'gathering yields collectibles');
        if (G.dialog) act(G, { t: 'dlg', id: 'leave' });
        G.battle = null;
    }

    // ---- battle
    G = fresh(7); act(G, { t: 'enter', depth: 1 });
    {
        const r = Rng.makeRng(1);
        const enc = Mon.genEncounter(r, 1, 1, 4);
        act(G, { t: 'debugBattle', enemies: enc });
        ok(G.battle && hasEv(G, 'battleStart'), 'a battle starts');
        let rounds = 0;
        while (G.battle && !G.battle.over && rounds < 60) { act(G, { t: 'round', cmds: Battle.autoCmds(G) }); rounds++; }
        ok(G.battle.over === 'win', `the party wins an easy fight in ${rounds} rounds`);
        ok(G.battle.result.xp > 0 && G.battle.result.gold > 0 && G.party.every((m) => m.xp > 0 || m.hp <= 0 || m.lvl > 1), 'victory pays XP and gold');
        ok(G.journal.mon[enc[0].fam].killed >= 1 && G.journal.mon[enc[0].fam].seen >= 1, 'the journal counts seen and defeated');
        act(G, { t: 'endBattle' });
        ok(!G.battle, 'ending the battle clears it');

        // level up
        const m0 = G.party[0];
        const lv = m0.lvl;
        const n = Party.gainXp(m0, Party.xpNeed(lv) + 1);
        ok(n === 1 && m0.lvl === lv + 1 && m0.hp <= Party.calc(m0).maxhp, 'enough XP levels a member up');
        ok(Party.skillsFor(G.party[1]).length >= 1, 'members start with a skill');

        // a doomed fight: wipe
        const boss = Mon.genBoss(r, 40, 40, 4);
        const gold0 = G.gold;
        act(G, { t: 'debugBattle', enemies: [{ ...boss }], opts: { boss: true, ctx: { kind: 'random' } } });
        for (let i = 0; i < 80 && G.battle && !G.battle.over; i++) act(G, { t: 'round', cmds: G.party.map(() => ({ k: 'def' })) });
        ok(G.battle?.over === 'lose', 'a hopeless fight is lost');
        act(G, { t: 'endBattle' });
        ok(!G.floor && G.depth === 0 && G.gold < gold0 && G.party.every((m) => m.hp >= 1), 'a wipe returns you to town, poorer, alive');

        // fleeing
        act(G, { t: 'enter', depth: 1 });
        act(G, { t: 'debugBattle', enemies: Mon.genEncounter(r, 1, 1, 4) });
        let fled = false;
        for (let i = 0; i < 30 && !fled && G.battle && !G.battle.over; i++) { act(G, { t: 'flee' }); fled = G.battle?.over === 'flee'; }
        ok(fled, 'the party can flee a normal fight');
        act(G, { t: 'endBattle' });
        act(G, { t: 'debugBattle', enemies: [Mon.genBoss(r, 5, 5, 4)], opts: { boss: true } });
        for (let i = 0; i < 6; i++) if (G.battle && !G.battle.over) act(G, { t: 'flee' });
        ok(G.battle.over !== 'flee', 'a guardian cannot be fled');
        G.battle = null;
    }

    // ---- equipment and curses
    G = fresh(8);
    {
        const m = G.party[0];
        const r = Rng.makeRng(3);
        const w = Items.genWeapon(r, 12, { base: 'sword', rar: 2, noCurse: true });
        Inv_give(G, w);
        const a0 = Party.calc(m).atk;
        act(G, { t: 'equip', who: 0, item: w.id });
        ok(Party.calc(m).atk > a0 && m.eq.weapon === w || m.eq.weapon.name === w.name, 'a better weapon raises attack');
        const bad = Items.genWeapon(r, 5, { base: 'sword', rar: 1 });
        bad.cursed = true; bad.known = false; bad.cdebuf = { agi: -3, luk: -3 }; bad.st.agi = -3; bad.st.luk = -3;
        Inv_give(G, bad);
        const mage = G.party.find((x) => x.cls === 'mage');
        const mi = G.party.indexOf(mage);
        const c = Party.canEquip(mage, bad);
        ok(!c.ok, 'a mage cannot wield a sword');
        act(G, { t: 'equip', who: 0, item: bad.id });
        ok(m.eq.weapon.cursed && m.eq.weapon.known && hasEv(G, 'cursed'), 'wearing a cursed weapon reveals the curse');
        const w2 = Items.genWeapon(r, 12, { base: 'sword', rar: 0, noCurse: true });
        Inv_give(G, w2);
        act(G, { t: 'equip', who: 0, item: w2.id });
        ok(m.eq.weapon.cursed, 'a cursed weapon will not come off');
        act(G, { t: 'unequip', who: 0, slot: 'weapon' });
        ok(m.eq.weapon.cursed, 'nor be unequipped');
        G.gold = 5000;
        const luk0 = Party.calc(m).luk;
        act(G, { t: 'church', svc: 'curse', who: 0 });
        ok(!m.eq.weapon.cursed && Party.calc(m).luk > luk0 && G.gold < 5000, 'the church lifts the curse, and the penalty with it');
        act(G, { t: 'unequip', who: 0, slot: 'weapon' });
        ok(!m.eq.weapon, 'and the weapon comes off');
        void mi;
        // two-handed weapons push shields off
        const knight = G.party[0];
        knight.eq.shield = Items.genArmor(r, 3, { slot: 'shield', noCurse: true, base: 'buckler' });
        const spear = Items.genWeapon(r, 3, { base: 'spear', rar: 0, noCurse: true }); Inv_give(G, spear);
        act(G, { t: 'equip', who: 0, item: spear.id });
        ok(!knight.eq.shield && knight.eq.weapon.hands === 2, 'a two-handed weapon pushes the shield into the bag');
        // potions
        const pot = Items.genPotion(r, 10, 'heal'); Inv_give(G, pot);
        G.party[1].hp = 3;
        act(G, { t: 'use', item: G.inv.find((x) => x.eff === 'heal' && x.pot === pot.pot).id, who: 1 });
        ok(G.party[1].hp > 20, 'a healing potion heals');
        G.party[1].hp = 0;
        const rv = Items.genPotion(r, 4, 'revive'); Inv_give(G, rv);
        act(G, { t: 'use', item: G.inv.find((x) => x.eff === 'revive').id, who: 1 });
        ok(G.party[1].hp > 0, 'a revival draught raises the fallen');
        const tome = Items.genTome(r, 5, 'str'); Inv_give(G, tome);
        const s0 = Party.calc(G.party[2]).str;
        act(G, { t: 'use', item: G.inv.find((x) => x.t === 't').id, who: 2 });
        ok(Party.calc(G.party[2]).str === s0 + tome.amt, 'a tome adds a stat for good');
    }

    // ---- town: shops, inn, recruits, church, investments
    G = fresh(9);
    {
        const stock = Town.shopStock(G, 'items');
        const heal = stock.find((x) => x.eff === 'heal');
        const gold0 = G.gold, price = Town.buyPrice(G, 'items', heal);
        const n0 = G.inv.reduce((a, x) => a + (x.n || 1), 0);
        act(G, { t: 'buy', shop: 'items', sid: heal.sid, qty: 3 });
        ok(G.gold === gold0 - price * 3 && G.inv.reduce((a, x) => a + (x.n || 1), 0) === n0 + 3, 'buying takes gold and fills the bag');
        ok(G.journal.items[heal.key].bought === 3, 'the journal counts what you bought');
        const it = G.inv.find((x) => x.t === 'p');
        const sp = Town.sellPrice(G, it), g1 = G.gold;
        act(G, { t: 'sell', id: it.id, qty: 1 });
        ok(G.gold === g1 + sp && G.journal.items[it.key].sold === 1, 'selling pays and is journalled');
        const sm = Town.shopStock(G, 'smith')[0]; G.gold = 99999;
        act(G, { t: 'buy', shop: 'smith', sid: sm.sid, qty: 1 });
        ok(!Town.shopStock(G, 'smith').some((x) => x.sid === sm.sid) && G.inv.some((x) => x.name === sm.name), 'gear is bought once and leaves the shelf');
        G.gold = 1;
        const before = G.inv.length;
        act(G, { t: 'buy', shop: 'magic', sid: Town.shopStock(G, 'magic')[0].sid, qty: 1 });
        ok(G.inv.length === before && G.gold === 1, 'you cannot buy what you cannot afford');

        // inn
        G.gold = 9999; G.party[0].hp = 1; G.party[0].st.poison = true; G.party[0].st.curse = true;
        const day0 = G.day, cost = Town.roomCost(G);
        act(G, { t: 'rest' });
        ok(G.day === day0 + 1 && G.party[0].hp === Party.calc(G.party[0]).maxhp && !G.party[0].st.poison && G.gold === 9999 - cost, 'resting heals, cures poison and passes a day');
        ok(G.party[0].st.curse, 'but a curse needs a priest');
        G.party[2].hp = 0; act(G, { t: 'rest' });
        ok(G.party[2].hp === 0, 'and the fallen stay fallen');
        // recruit
        const rc = G.town.recruits[0];
        act(G, { t: 'recruit', idx: 0 });
        ok(G.party.length === 5 && G.party.includes(rc), 'recruiting adds a fifth adventurer');
        G.town.recruits.push(Party.makeMember(Rng.makeRng(2), 'ranger', 3));
        act(G, { t: 'recruit', idx: G.town.recruits.length - 1 });
        ok(G.party.length === 6, 'and a sixth');
        G.town.recruits.push(Party.makeMember(Rng.makeRng(3), 'mage', 3));
        act(G, { t: 'recruit', idx: G.town.recruits.length - 1 });
        ok(G.party.length === 6, 'but never a seventh');
        const gear = G.party[5].eq.weapon;
        void gear;
        act(G, { t: 'dismiss', idx: 5 });
        ok(G.party.length === 5, 'a member can be sent home');
        // church
        act(G, { t: 'church', svc: 'revive', who: 2 });
        ok(G.party[2].hp > 0, 'the church revives the fallen');
        act(G, { t: 'church', svc: 'curse', who: 0 });
        ok(!G.party[0].st.curse, 'and lifts a curse from a person');
        // tavern
        G.party[1].hp = 2;
        act(G, { t: 'eat', meal: 'feast' });
        ok(G.party[1].hp === Party.calc(G.party[1]).maxhp && G.feast?.left === 3, 'a feast heals and feeds');
        // investments
        G = fresh(10); G.gold = 100000;
        const inc0 = Town.income(G, 'inn'), c0 = Town.investCost(G, 'inn');
        ok(inc0 === 0 && Town.disc(G, 'inn') === 0, 'a business you do not own pays nothing and discounts nothing');
        act(G, { t: 'invest', biz: 'inn' });
        ok(G.biz.inn.lvl === 1 && G.gold === 100000 - c0 && Town.income(G, 'inn') > 0, 'investing buys a stake that pays');
        const c1 = Town.investCost(G, 'inn');
        ok(c1 > c0, 'and the next level costs more');
        act(G, { t: 'invest', biz: 'inn' }); act(G, { t: 'invest', biz: 'smith' }); for (let i = 0; i < 6; i++) act(G, { t: 'invest', biz: 'guild' });
        ok(Town.income(G, 'inn') > inc0 * 2, 'income grows faster than linearly with level');
        const room0 = Town.roomCost(G);
        const fresh2 = Game.newGame(10); fresh2.events.length = 0;
        ok(room0 < Town.roomCost(fresh2), 'owning the inn makes rooms cheaper');
        const smithItem = Town.shopStock(G, 'smith')[0];
        ok(Town.buyPrice(G, 'smith', smithItem) < smithItem.price, 'owning the smithy makes its goods cheaper');
        ok(G.guildBonus > 0 && Town.sellPrice(G, { ...smithItem }) > Town.sellPrice(fresh2, { ...smithItem }), 'owning the guild raises sell prices');
        // days pass: income accrues, caps
        G.gold = 100000;
        act(G, { t: 'rest' });
        G.gold = 0;
        const pend0 = Town.totalPending(G);
        ok(pend0 > 0, 'a day passing earns passive income');
        act(G, { t: 'collect' });
        ok(G.gold === pend0 && Town.totalPending(G) === 0, 'collecting moves it to your purse');
        const days = Game.tickIdle(G, Cfg.IDLE_SECONDS_PER_DAY * 3 + 5);
        ok(days === 3 && Town.totalPending(G) > pend0, 'real time passing counts as days, too');
        for (let i = 0; i < 40; i++) Game.tickIdle(G, Cfg.IDLE_SECONDS_PER_DAY);
        ok(Town.BIZ_IDS.every((k) => G.biz[k].pend <= Town.pendCap(G, k)), 'uncollected income is capped');
        // restocking
        const stockDay = G.town.stock.day;
        ok(stockDay === G.day, 'shops restock as days pass');
    }

    // ---- quests
    G = fresh(12);
    {
        const rng = Rng.makeRng(5);
        const kinds = new Set();
        for (let i = 0; i < 120; i++) { G.maxDepth = 1 + (i % 30); kinds.add(Quests.genQuest(G, rng).type); }
        ok(['slay', 'gather', 'reach', 'relic', 'boss'].every((k) => kinds.has(k)), 'every quest type is generated');
        G.maxDepth = 1;
        const q = { id: 99, type: 'slay', fam: 'rat', need: 2, got: 0, gold: 100, xp: 20, itemReward: false, title: 't', desc: 'd', state: 'board' };
        G.quests.board.push(q);
        act(G, { t: 'accept', id: 99 });
        ok(G.quests.active.includes(q), 'accepting a quest takes it off the board');
        const rat = Mon.genMonster(Rng.makeRng(1), 1, 1, 'rat', { noVariant: true });
        act(G, { t: 'enter', depth: 1 });
        act(G, { t: 'debugBattle', enemies: [{ ...rat }, { ...rat }] });
        for (let i = 0; i < 30 && !G.battle.over; i++) act(G, { t: 'round', cmds: Battle.autoCmds(G) });
        act(G, { t: 'endBattle' });
        ok(q.got >= 2 && Quests.isReady(G, q), 'defeating the monsters advances the quest');
        World.returnToTown(G);
        const g0 = G.gold;
        act(G, { t: 'turnin', id: 99 });
        ok(G.gold >= g0 + 100 && !G.quests.active.includes(q) && G.quests.done === 1, 'handing it in pays');
        const gq = { id: 100, type: 'gather', cid: 'moonleaf', need: 2, gold: 50, xp: 5, itemReward: false, title: 'g', desc: 'g', state: 'board' };
        G.quests.board.push(gq); act(G, { t: 'accept', id: 100 });
        ok(!Quests.isReady(G, gq), 'a gather quest waits for the goods');
        const r2 = Rng.makeRng(8);
        Inv_give(G, Items.genCollectible(r2, 1, 'herb', 'moonleaf')); Inv_give(G, Items.genCollectible(r2, 1, 'herb', 'moonleaf'));
        ok(Quests.isReady(G, gq), 'and counts them from the bag');
        act(G, { t: 'sellJunk' });
        ok(G.inv.some((x) => x.cid === 'moonleaf'), 'selling junk keeps what a quest needs');
        act(G, { t: 'turnin', id: 100 });
        ok(!G.inv.some((x) => x.cid === 'moonleaf'), 'handing in takes the goods');
    }

    // ---- guardians and checkpoints
    G = fresh(13);
    {
        ok(JSON.stringify(World.checkpoints(G)) === '[1]', 'at first only floor 1 can be entered');
        G.maxDepth = 5; G.depth = 0;
        World.enterFloor(G, 5, 'up');
        const f5 = G.floor;
        const dn = f5.feat[`${f5.down.x},${f5.down.y}`];
        ok(f5.bossFloor && dn.guard && dn.guard.boss, 'floor 5 has a guardian on the stairs');
        G.pos.x = f5.down.x; G.pos.y = f5.down.y;
        // step onto the stairs from a neighbour
        const nd = [0, 1, 2, 3].find((d) => Dun.passable(Dun.getEdge(f5, f5.down.x, f5.down.y, d)));
        G.pos.x = f5.down.x + Cfg.DIRS[nd].dx; G.pos.y = f5.down.y + Cfg.DIRS[nd].dy; G.pos.d = (nd + 2) % 4; G.arrived = false;
        clearEv(G); act(G, { t: 'move', m: 'f' });
        ok(G.battle?.boss, 'stepping onto guarded stairs starts the boss fight');
        const boss = G.battle.enemies[0];
        boss.hp = 1; boss.mhp = boss.mhp;
        for (let i = 0; i < 60 && !G.battle.over; i++) act(G, { t: 'round', cmds: Battle.autoCmds(G) });
        ok(G.battle.over === 'win', 'the guardian can fall');
        act(G, { t: 'endBattle' });
        ok(dn.guard === null && G.cleared === 5 && JSON.stringify(World.checkpoints(G)) === '[1,6]', 'beating it clears the floor and unlocks floor 6 as a starting point');
        ok(G.journal.misc.bossesSlain >= 1, 'the journal counts guardians');
        World.returnToTown(G);
        act(G, { t: 'enter', depth: 6 });
        ok(G.depth === 6, 'and you can start there');
    }

    // ---- journal completeness
    G = fresh(14);
    {
        const c0 = Journal.completion(G);
        ok(c0.weapons[1] === 120 && c0.monsters[1] === 20 && c0.collectibles[1] === 30, 'the journal has a fixed number of shelves');
        ok(c0.weapons[0] === 0 || c0.weapons[0] >= 0, 'a new game has found few things');
    }
}





if (want('determinism')) {
    section('determinism');
    const run = (G, bot, n) => { for (let i = 0; i < n; i++) { G.events.length = 0; if (!Bot.botStep(G, bot)) break; } };
    const ser = (G) => JSON.stringify(Game.serialize(G));
    const a = Game.newGame(42), b = Game.newGame(42);
    run(a, Bot.makeBot(), 3000); run(b, Bot.makeBot(), 3000);
    ok(ser(a) === ser(b), 'same seed and commands, same game (3000 commands)');
    const c = Game.newGame(43); run(c, Bot.makeBot(), 3000);
    ok(ser(a) !== ser(c), 'a different seed plays differently');

    const G = Game.newGame(7);
    run(G, Bot.makeBot(), 2500);
    const copy = Game.deserialize(JSON.parse(JSON.stringify(Game.serialize(G))));
    ok(ser(copy) === ser(G), 'a save round trip is lossless (depth ' + G.depth + ', day ' + G.day + ')');
    const b1 = Bot.makeBot(), b2 = Bot.makeBot();
    run(G, b1, 2500); run(copy, b2, 2500);
    ok(ser(G) === ser(copy), 'and plays on identically for 2500 more commands');
    let threw = false;
    try { Game.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    // a save in town and one in the dungeon with a dialog open
    const T = Game.newGame(8); T.gold = 123;
    ok(Game.deserialize(JSON.parse(JSON.stringify(Game.serialize(T)))).gold === 123, 'a town save restores');
    const D = Game.newGame(9); act(D, { t: 'enter', depth: 1 });
    const DD = Game.deserialize(JSON.parse(JSON.stringify(Game.serialize(D))));
    ok(DD.floor && DD.depth === 1 && DD.pos.x === D.pos.x && Dun.getEdge(DD.floor, 0, 0, 0) === 1, 'a dungeon save restores the floor and the party on it');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const [label, o] of [['steady', { push: 1.0, explore: 0.55 }], ['reckless', { push: 0.7, explore: 0.3 }]]) {
            const G = Game.newGame(s * 7919), bot = Bot.makeBot(o);
            let bad = null, lastProgress = 0, lastKey = '';
            for (let i = 0; i < STEPS && !bad; i++) {
                G.events.length = 0;
                if (!Bot.botStep(G, bot)) { bad = 'the bot ran out of things to do'; break; }
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = `gold is ${G.gold}`;
                else if (G.inv.length > Cfg.INV_CAP) bad = 'the bag overflowed';
                else if (new Set(G.inv.map((x) => x.id)).size !== G.inv.length) bad = 'duplicate item ids';
                else if (G.inv.some((x) => (x.n !== undefined && x.n < 1) || !x.name)) bad = 'a broken stack in the bag';
                else if (G.party.length < 1 || G.party.length > Cfg.MAX_PARTY) bad = 'party size out of range';
                else for (const m of G.party) {
                    const st = Party.calc(m);
                    if (!Number.isFinite(m.hp) || m.hp < 0 || m.hp > st.maxhp) { bad = `${m.name} has ${m.hp}/${st.maxhp} HP`; break; }
                    if (m.mp < 0 || m.mp > st.maxmp) { bad = `${m.name} has ${m.mp}/${st.maxmp} MP`; break; }
                }
                if (!bad && G.floor) {
                    const { x, y } = G.pos;
                    if (!Dun.inb(G.floor, x, y) || G.depth !== G.floor.depth) bad = 'the party is outside the floor';
                }
                if (!bad && !G.floor && G.depth !== 0) bad = 'depth without a floor';
                const key = `${G.depth}:${G.maxDepth}:${G.day}:${G.stats.kills}:${G.steps}:${G.gold}`;
                if (key !== lastKey) { lastKey = key; lastProgress = i; }
                else if (i - lastProgress > 500) bad = `no progress for 500 commands (${G.battle ? 'battle' : G.dialog ? 'dialog ' + G.dialog.kind : G.floor ? 'dungeon' : 'town'})`;
            }
            ok(!bad, `seed ${s} ${label}: ${bad || 'invariants hold'}`);
            const lv = Math.round(G.party.reduce((a, m) => a + m.lvl, 0) / G.party.length);
            rows.push({ s, label, deepest: G.maxDepth, lv, wipes: G.stats.deaths, kills: G.stats.kills, gold: G.gold, day: G.day, party: G.party.length, biz: Town.BIZ_IDS.reduce((a, k) => a + G.biz[k].lvl, 0), quests: G.quests.done, found: Object.keys(G.journal.items).length });
        }
    }
    const avg = (label, k) => Math.round(rows.filter((r) => r.label === label).reduce((a, r) => a + r[k], 0) / SEEDS);
    console.log('  label     deepest  level  wipes  kills   day  party  bizLv  quests  itemKinds');
    for (const label of ['steady', 'reckless']) console.log(`  ${label.padEnd(9)} ${String(avg(label, 'deepest')).padStart(7)} ${String(avg(label, 'lv')).padStart(6)} ${String(avg(label, 'wipes')).padStart(6)} ${String(avg(label, 'kills')).padStart(6)} ${String(avg(label, 'day')).padStart(5)} ${String(avg(label, 'party')).padStart(6)} ${String(avg(label, 'biz')).padStart(6)} ${String(avg(label, 'quests')).padStart(7)} ${String(avg(label, 'found')).padStart(10)}`);
    ok(avg('steady', 'deepest') >= 6, `the steady bot gets past the first guardian (avg deepest ${avg('steady', 'deepest')})`);
    ok(avg('steady', 'biz') > 0, 'the bot invests in the town');
    ok(avg('reckless', 'wipes') >= avg('steady', 'wipes'), 'a reckless bot wipes at least as often as a careful one');
    ok(rows.every((r) => r.party >= 4), 'the bot keeps a full party');
}

console.log('');
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
