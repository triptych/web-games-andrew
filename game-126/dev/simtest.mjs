/**
 * simtest.mjs — headless checks of EMBERSPIRE's simulation. No browser.
 *
 *   node game-126/dev/simtest.mjs
 *   ONLY=purity,data,rules node game-126/dev/simtest.mjs
 *   SEEDS=6 DAYS=40 VERBOSE=1 node game-126/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock.
 * 2. data: every monster, boss, hero and NPC has its art; every act and skill a monster or class names exists;
 *    every floor 1..300 builds a valid fight; every scene has a good answer.
 * 3. rules: battle (turn order by speed, damage, weakness, crits, statuses, defend, flee, items, revive, AI),
 *    the climb (rests, checkpoints, defeat), the town (recruit, party, equip, forge, shop, temple, evolve,
 *    ascend), bonds and keepsakes, quests and milestones, the daily bonus and its streak, the idle tithe and cap.
 * 4. determinism: same seed and commands, same game; a save round trip plays on identically.
 * 5. bot: the whole-game bot plays DAYS days on SEEDS seeds with invariants every day; balance bands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const DAYS = +(process.env.DAYS || 30);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ba = await import('../js/sim/battle.js');
const St = await import('../js/sim/stats.js');
const { BIOMES, MONSTERS, biomeOf } = await import('../js/sim/data/biomes.js');
const { HEROES, CLASSES, SKILLS, STATUS } = await import('../js/sim/data/heroes.js');
const { MONSTER_ACTS } = await import('../js/sim/data/acts.js');
const { UNIQUES, GOODS } = await import('../js/sim/data/items.js');
const { SCENES, NPCS, MILESTONES } = await import('../js/sim/data/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const drain = (G) => { const e = G.events.splice(0); return e; };

// ---------------------------------------------------------------- purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''");
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|new Date\(\)/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ---------------------------------------------------------------- data
if (want('data')) {
    section('data');
    const art = (p) => fs.existsSync(path.join(ROOT, 'art', p));
    let n = 0;
    for (const m of Object.values(MONSTERS)) {
        ok(art(`mon/${m.id}.webp`), `${m.id} has a sprite`);
        for (const a of m.acts) ok(!!MONSTER_ACTS[a], `${m.id}'s act ${a} exists`);
        ok(m.m.length === 6 && m.m.every((x) => x > 0), `${m.id} has six positive stat multipliers`);
        n++;
    }
    ok(n === 70, `70 monster designs (${n})`);
    for (const h of HEROES) {
        ok(art(`hero/${h.id}.webp`) && art(`hero/${h.id}-evo.webp`) && art(`por/${h.id}.webp`), `${h.id} has a sprite, an evolved sprite and a portrait`);
        ok(!!CLASSES[h.cls] && CLASSES[h.cls].tier === 1, `${h.id} starts in a base class`);
    }
    for (const id of Object.keys(NPCS)) ok(art(`por/${id}.webp`), `${id} has a portrait`);
    for (const b of BIOMES) ok(art(`bg/${b.id}.webp`), `${b.id} has a backdrop`);
    for (const b of ['title', 'town', 'tavern', 'tavern-night', 'smithy', 'shop', 'guild', 'temple']) ok(art(`bg/${b}.webp`), `${b} backdrop`);
    for (const s of ['gear', 'goods', 'uniques', 'misc']) ok(art(`icons/${s}.webp`), `${s} icon atlas`);
    for (const [cid, c] of Object.entries(CLASSES)) {
        if (c.tier === 1) { ok(c.evo.length === 2 && c.evo.every((e) => CLASSES[e]?.from === cid), `${cid} evolves into two classes that know their origin`); }
        for (const s of c.skills) {
            ok(s.mp >= 0 && s.pow >= 0 && ['enemy', 'enemies', 'ally', 'allies', 'self', 'fallen'].includes(s.tgt), `${s.id} is well formed`);
            for (const k of ['st', 'st2', 'st3', 'st4']) if (s[k]) ok(!!STATUS[s[k].id], `${s.id}.${k} names a real status`);
        }
        if (c.tier === 2) ok(c.skills.some((s) => s.lv >= C.ASCEND_LV), `${cid} has an ascension ultimate`);
    }
    for (const [id, a] of Object.entries(MONSTER_ACTS)) if (a.st) ok(!!STATUS[a.st.id], `act ${id} names a real status`);
    for (const [id, u] of Object.entries(UNIQUES)) ok(u.from ? !!MONSTERS[u.from] : !!u.keepsake, `${id} comes from a boss or a bond`);
    for (const [id, sc] of Object.entries(SCENES)) {
        ok(sc.length === 5, `${id} has five bond scenes`);
        sc.forEach((s, i) => ok(s.choices.some((c) => c[1]), `${id} scene ${i + 1} has a good answer`));
    }
    // every floor builds a fight with the right boss
    const G = Gm.newGame(1);
    let bad = 0;
    for (let f = 1; f <= 300; f++) {
        const list = Ba.makeEnemies(G, f);
        const { biome } = biomeOf(f);
        if (!list.length || list.length > 4 || list.some((e) => !MONSTERS[e.id])) bad++;
        if (f % 10 === 0 && list[0].id !== biome.boss.id) bad++;
        else if (f % 5 === 0 && f % 10 !== 0 && list[0].id !== biome.mini.id) bad++;
        const s = St.enemyStats(list[0].id, f);
        if (!Object.values(s).every(Number.isFinite)) bad++;
    }
    ok(bad === 0, `floors 1..300 build valid fights, a mini boss every 5th and a boss every 10th (${bad} bad)`);
    ok(St.enemyStats('moss_slime', 50).hp > St.enemyStats('moss_slime', 10).hp * 5, 'monsters grow steadily stronger');
    ok(St.enemyStats('moss_slime', 150).hp > St.enemyStats('moss_slime', 50).hp, 'and keep growing past floor 100');
}

// ---------------------------------------------------------------- rules
function fight(G, floor) {
    G.mode = 'tower';
    G.run = { start: floor, floor, gold: 0, xp: 0, kills: 0, floors: 0 };
    return Ba.startBattle(G, floor);
}
function forceTurn(G, uid) {
    const B = G.battle;
    B.turn = uid;
    B.phase = Ba.unit(B, uid).side === 'p' ? 'input' : 'ai';
}

if (want('rules')) {
    section('rules: battle');
    let G = Gm.newGame(11);
    ok(G.party.join() === 'arin,mira' && Gm.joined(G).length === 2, 'a new game starts with Arin and Mira');
    ok(Object.values(G.heroes).filter((h) => h.joined).every((h) => h.eq.weapon && h.eq.armor), 'both start armed and armoured');
    ok(Gm.act(G, { t: 'enter', floor: 1 }) && G.mode === 'tower' && G.battle, 'entering the tower starts floor 1');
    ok(!Gm.act(G, { t: 'enter', floor: 1 }), 'cannot enter twice');
    ok(!Gm.act(G, { t: 'leave' }), 'cannot leave mid-fight');
    let B = G.battle;
    const arin = B.units.find((u) => u.ref === 'arin');
    const foe = B.units.find((u) => u.side === 'e');
    // speed decides turns: a unit twice as fast acts about twice as often
    G = Gm.newGame(12); fight(G, 3); B = G.battle;
    const fast = B.units[0];
    fast.spd *= 3;
    const counts = {};
    for (let i = 0; i < 40 && B.phase !== 'won' && B.phase !== 'lost'; i++) {
        counts[B.turn] = (counts[B.turn] || 0) + 1;
        const u = Ba.unit(B, B.turn);
        Ba.doAction(G, u, { kind: 'defend' });
    }
    const others = Object.entries(counts).filter(([k]) => k !== fast.uid).map(([, v]) => v);
    ok(counts[fast.uid] > Math.max(...others) * 2, `a unit three times as fast acts more than twice as often (${counts[fast.uid]} vs ${Math.max(...others)})`);

    // damage, weakness, resistance
    G = Gm.newGame(13); fight(G, 1); B = G.battle;
    const hero = B.units.find((u) => u.ref === 'arin');
    const slime = { ...B.units.find((u) => u.side === 'e'), weak: ['fire'], resist: ['phys'], guard: false, st: {}, hp: 999, mhp: 999 };
    const base = Ba.estimate(hero, { ...slime, weak: [], resist: [] }, { pow: 1, kind: 'phys', el: 'fire' }).d;
    ok(Math.abs(Ba.estimate(hero, slime, { pow: 1, kind: 'phys', el: 'fire' }).d - base * C.WEAK_MUL) < 1e-6, 'a weakness takes 1.5x damage');
    ok(Math.abs(Ba.estimate(hero, slime, { pow: 1, kind: 'phys', el: 'phys' }).d - base * C.RESIST_MUL) < 1e-6, 'a resistance takes half');
    ok(Ba.estimate(hero, { ...slime, weak: [], resist: [], guard: true }, { pow: 1, kind: 'phys', el: 'fire' }).d < base * 0.51, 'defending halves damage');
    ok(Ba.estimate({ ...hero, st: { atkup: 3 } }, { ...slime, weak: [], resist: [] }, { pow: 1, kind: 'phys', el: 'fire' }).d > base * 1.2, 'Might raises damage');

    // an attack hits and emits events; killing ends the fight with rewards
    G = Gm.newGame(14); fight(G, 1); B = G.battle;
    B.units.filter((u) => u.side === 'e').forEach((u, i) => { if (i) { u.alive = false; u.hp = 0; } });
    const e1 = B.units.find((u) => u.side === 'e' && u.alive);
    e1.hp = 1;
    forceTurn(G, 'p0');
    drain(G);
    ok(Gm.act(G, { t: 'cmd', kind: 'attack', target: e1.uid }), 'Attack is accepted on your turn');
    let ev = drain(G);
    ok(ev.some((e) => e.type === 'hit' && e.uid === e1.uid) && ev.some((e) => e.type === 'down'), 'it hits and the foe goes down');
    ok(B.phase === 'won' && ev.some((e) => e.type === 'won'), 'the last foe down wins the battle');
    ok(B.rewards.xp > 0 && B.rewards.gold > 0 && G.stats.kills >= 1, 'with xp, gold and a kill counted');
    ok(G.run.gold === B.rewards.gold, 'the run records the gold');
    ok(!Gm.act(G, { t: 'cmd', kind: 'attack', target: e1.uid }), 'no commands after the fight');

    // skills cost mana and need the level; statuses tick
    G = Gm.newGame(15); fight(G, 1); B = G.battle;
    const mira = B.units.find((u) => u.ref === 'mira');
    forceTurn(G, mira.uid);
    const mp0 = mira.mp;
    arinHurt(B);
    function arinHurt(B) { const a = B.units.find((u) => u.ref === 'arin'); a.hp = 10; }
    ok(Gm.act(G, { t: 'cmd', kind: 'skill', id: 'heal', target: 'p0' }), 'Mira can cast Heal');
    ok(mira.mp === mp0 - SKILLS.heal.mp && B.units.find((u) => u.ref === 'arin').hp > 10, 'it costs mana and heals');
    G = Gm.newGame(16); fight(G, 1); B = G.battle;
    forceTurn(G, 'p1');
    ok(!Gm.act(G, { t: 'cmd', kind: 'skill', id: 'raise', target: 'p0' }), 'a skill you have not learned is refused');
    const p1 = Ba.unit(B, 'p1'); p1.mp = 0;
    ok(!Gm.act(G, { t: 'cmd', kind: 'skill', id: 'heal', target: 'p0' }), 'a skill you cannot afford is refused');
    // poison
    G = Gm.newGame(17); fight(G, 2); B = G.battle;
    const pz = B.units.find((u) => u.side === 'e');
    pz.st.poison = 3; pz.hp = pz.mhp;
    drain(G);
    forceTurn(G, pz.uid);
    Ba.advance; // turn start ticks happen in advance(); emulate by giving it the next turn
    B.units.forEach((u) => { u.ct = 0; });
    pz.ct = C.CT_FULL - 1;
    B.phase = 'ai';
    Ba.advance(G);
    ev = drain(G);
    ok(ev.some((e) => e.type === 'dot' && e.uid === pz.uid && e.id === 'poison') && pz.hp < pz.mhp, 'poison hurts at the start of the turn');
    // stun skips a turn
    G = Gm.newGame(18); fight(G, 2); B = G.battle;
    const sz = B.units.find((u) => u.side === 'e');
    B.units.forEach((u) => { u.ct = 0; });
    sz.st.stun = 1; sz.ct = C.CT_FULL - 1;
    drain(G);
    Ba.advance(G);
    ev = drain(G);
    ok(ev.some((e) => e.type === 'stunned' && e.uid === sz.uid) && !ev.some((e) => e.type === 'act' && e.uid === sz.uid), 'a stunned unit loses its turn');
    ok(!sz.st.stun, 'and the stun wears off');
    // defend restores some mana
    G = Gm.newGame(19); fight(G, 1); B = G.battle;
    forceTurn(G, 'p1');
    const m1 = Ba.unit(B, 'p1'); m1.mp = 0;
    Gm.act(G, { t: 'cmd', kind: 'defend' });
    ok(m1.mp > 0, 'Defend restores a little mana');
    // items: potion, phoenix, the stock goes down
    G = Gm.newGame(20); fight(G, 1); B = G.battle;
    forceTurn(G, 'p0');
    const a0 = Ba.unit(B, 'p0'); a0.hp = 5;
    const pots = G.inv.potion;
    ok(Gm.act(G, { t: 'cmd', kind: 'item', id: 'potion', target: 'p0' }) && a0.hp > 5 && G.inv.potion === pots - 1, 'a potion heals and is used up');
    G = Gm.newGame(21); fight(G, 1); B = G.battle;
    const dead = Ba.unit(B, 'p1'); dead.alive = false; dead.hp = 0;
    forceTurn(G, 'p0');
    ok(Gm.act(G, { t: 'cmd', kind: 'item', id: 'phoenix', target: 'p1' }) && dead.alive && dead.hp > 0, 'a Phoenix Feather revives');
    G.inv.potion = 0;
    // flee: never from a boss
    G = Gm.newGame(22); fight(G, 10); B = G.battle;
    forceTurn(G, 'p0');
    ok(!Gm.act(G, { t: 'cmd', kind: 'flee' }), 'no fleeing a boss');
    G = Gm.newGame(23); fight(G, 2); B = G.battle;
    let fled = false;
    for (let i = 0; i < 20 && B.phase !== 'fled'; i++) { const u = B.units.find((x) => x.side === 'p' && x.alive); forceTurn(G, u.uid); Gm.act(G, { t: 'cmd', kind: 'flee' }); fled = B.phase === 'fled'; if (!fled) B.units.filter((x) => x.side === 'p').forEach((x) => { x.hp = x.mhp; x.alive = true; }); }
    ok(fled, 'fleeing a normal fight works sometimes');
    // auto battle: the AI drives heroes, and the brain heals the hurt
    G = Gm.newGame(24); fight(G, 2); B = G.battle;
    const pm = B.units.find((u) => u.ref === 'mira');
    B.units.find((u) => u.ref === 'arin').hp = 3;
    const choice = Ba.heroChoose(G, pm);
    ok(choice.kind === 'skill' && choice.id === 'heal' && choice.target === 'p0', 'the auto brain heals a badly hurt ally');
    Gm.act(G, { t: 'auto', on: true });
    ok(G.auto, 'auto battle switches on');
    // step() waits AI_DELAY, holds while the view is busy, then acts
    G = Gm.newGame(25); fight(G, 2); B = G.battle;
    Gm.act(G, { t: 'auto', on: true });
    B.phase = 'ai';
    const before = B.actions;
    for (let i = 0; i < 200; i++) Gm.step(G, { hold: true }, C.STEP);
    ok(B.actions === before, 'the AI waits while the view is busy');
    for (let i = 0; i < Math.ceil(C.AI_DELAY / C.STEP) + 2; i++) Gm.step(G, { hold: false }, C.STEP);
    ok(B.actions > before || B.phase !== 'ai', 'and acts after the delay once it is free');
    // bosses enrage below half
    G = Gm.newGame(26); fight(G, 10); B = G.battle;
    const boss = B.units.find((u) => u.side === 'e' && u.rank === 'boss');
    boss.hp = Math.floor(boss.mhp * 0.49);
    forceTurn(G, 'p0');
    drain(G);
    Gm.act(G, { t: 'cmd', kind: 'defend' });
    ok(boss.enraged && drain(G).some((e) => e.type === 'enrage'), 'a boss below half health enrages');

    section('rules: the climb');
    G = Gm.newGame(30);
    Gm.act(G, { t: 'enter', floor: 1 });
    Gm.autoResolve(G);
    ok(G.battle.phase === 'won', 'the starting party beats floor 1');
    const hpAfter = G.heroes.arin.hp;
    ok(Gm.act(G, { t: 'next' }) && G.battle.floor === 2 && G.best === 1, 'Next climbs to floor 2 and floor 1 counts as cleared');
    ok(G.heroes.arin.hp >= hpAfter, 'the party catches its breath between floors');
    ok(!Gm.checkpoints(G).includes(11), 'no checkpoint at 11 before the floor 10 boss falls');
    G.best = 23;
    ok(Gm.checkpoints(G).join() === '1,11,21', 'checkpoints after every boss (1, 11, 21)');
    // defeat: lose some of the run's gold, back to town in the evening
    G = Gm.newGame(31);
    Gm.act(G, { t: 'enter', floor: 1 });
    G.run.gold = 100; G.gold = 500;
    G.battle.units.filter((u) => u.side === 'p').forEach((u) => { u.hp = 1; });
    G.battle.units.filter((u) => u.side === 'e').forEach((u) => { u.atk *= 100; u.mag *= 100; u.spd *= 50; });
    Gm.autoResolve(G);
    ok(G.battle.phase === 'lost', 'an overwhelmed party loses');
    Gm.act(G, { t: 'leave' });
    ok(G.mode === 'town' && G.phase === 'evening' && G.gold === 500 - 100 * C.DEFEAT_GOLD_LOSS, 'defeat sends you home for the evening, a share of the run\'s gold lost');
    ok(!Gm.act(G, { t: 'enter', floor: 1 }), 'one climb a day: the tower waits until morning');
    ok(Gm.act(G, { t: 'rest' }) && G.phase === 'day' && G.day === 2 && G.heroes.arin.hp > 1, 'resting starts a new day and heals everyone');
    // auto-climb keeps going while healthy
    G = Gm.newGame(32);
    Gm.act(G, { t: 'enter', floor: 1 });
    Gm.act(G, { t: 'auto', on: true });
    Gm.act(G, { t: 'autoClimb', on: true });
    for (let i = 0; i < 60 * 120 && G.mode === 'tower' && (G.battle.floor < 3); i++) Gm.step(G, { hold: false }, C.STEP);
    ok(G.battle?.floor >= 3 || G.best >= 2, 'auto battle and auto-climb climb by themselves');

    section('rules: the town');
    G = Gm.newGame(40);
    ok(!Gm.act(G, { t: 'recruit', id: 'brakka' }), 'Brakka isn\'t at the tavern before floor 2');
    G.best = 2; G.gold = 0;
    ok(!Gm.act(G, { t: 'recruit', id: 'brakka' }), 'and costs gold');
    G.gold = 10000;
    ok(Gm.act(G, { t: 'recruit', id: 'brakka' }) && G.heroes.brakka.joined && G.party.includes('brakka'), 'recruiting adds her to the company and the party');
    ok(G.heroes.brakka.eq.weapon && G.gear[G.heroes.brakka.eq.weapon].type === 'axe', 'with an axe of her own');
    ok(!Gm.act(G, { t: 'party', ids: ['nyx'] }), 'a hero who hasn\'t joined can\'t be in the party');
    ok(Gm.act(G, { t: 'party', ids: ['brakka', 'arin', 'brakka'] }) && G.party.join() === 'brakka,arin', 'the party takes up to four distinct heroes');
    // equip rules
    const axe = G.heroes.brakka.eq.weapon;
    ok(!Gm.act(G, { t: 'equip', id: 'mira', uid: axe }), 'Mira can\'t use an axe');
    const ring = Object.keys(G.gear).length;
    // forge
    G.inv.ore = 500; G.inv.shard = 50; G.gold = 1e9;
    const sw = G.heroes.arin.eq.weapon;
    G.gear[sw].lvl = 10;
    const atk0 = St.heroStats(G, 'arin').atk;
    ok(Gm.act(G, { t: 'upgrade', uid: sw }) && G.gear[sw].plus === 1, 'Hilde upgrades a weapon to +1');
    ok(St.heroStats(G, 'arin').atk > atk0, 'and Arin hits harder');
    for (let i = 0; i < 20; i++) Gm.act(G, { t: 'upgrade', uid: sw });
    ok(G.gear[sw].plus === 10, 'up to +10 for ordinary gear');
    const c5 = Gm.upgradeCost(G, { ...G.gear[sw], plus: 5 });
    ok(c5.shard > 0 && Gm.upgradeCost(G, { ...G.gear[sw], plus: 2 }).shard === 0, 'from +5, upgrades need Ember Shards');
    G.best = 30;
    const lvl0 = G.gear[sw].lvl;
    ok(Gm.act(G, { t: 'reforge', uid: sw }) && G.gear[sw].lvl === 30 && G.gear[sw].plus === 10 && lvl0 < 30, 'reforging raises an old item to your best floor and keeps its upgrades');
    // shop
    G = Gm.newGame(41); G.gold = 1000;
    ok(Gm.act(G, { t: 'buy', id: 'potion', n: 2 }) && G.inv.potion === C.START.potion + 2 && G.gold === 1000 - 2 * GOODS.potion.price, 'buying potions');
    ok(!Gm.act(G, { t: 'buy', id: 'elixir' }), 'Elixirs are not sold until floor 40');
    ok(G.shop.gear.length === C.SHOP_GEAR, 'Zephyrine stocks gear');
    const sg = G.shop.gear[0];
    G.gold = 1e6;
    ok(Gm.act(G, { t: 'buyGear', uid: sg }) && !G.gear[sg].shop && !G.shop.gear.includes(sg), 'buying shop gear');
    ok(Gm.act(G, { t: 'sell', uid: sg }) && !G.gear[sg], 'selling it');
    ok(!Gm.act(G, { t: 'sell', uid: G.heroes.arin.eq.weapon }), 'equipped gear can\'t be sold');
    G.inv.core = 3;
    ok(Gm.act(G, { t: 'coreTrade', type: 'sword' }) && G.inv.core === 0 && Object.values(G.gear).some((g) => g.type === 'sword' && g.rar === 3), 'three cores buy an epic piece');
    // temple: learn, evolve, ascend
    G = Gm.newGame(42);
    const h = G.heroes.arin;
    ok(!Gm.act(G, { t: 'learn', id: 'arin', skill: 'provoke' }), 'Provoke needs level 3');
    h.lv = 3; h.sp = 2;
    ok(Gm.act(G, { t: 'learn', id: 'arin', skill: 'provoke' }) && h.skills.provoke === 1 && h.sp === 1, 'learning costs a skill point');
    ok(Gm.act(G, { t: 'learn', id: 'arin', skill: 'power_strike' }) && h.skills.power_strike === 2 && h.sp === 0, 'ranking up costs the current rank');
    ok(!Gm.act(G, { t: 'evolve', id: 'arin', cls: 'paladin' }), 'evolution waits for level 15');
    h.lv = 15;
    ok(!Gm.act(G, { t: 'evolve', id: 'arin', cls: 'saint' }), 'only into your own class\'s evolutions');
    const hp14 = St.heroStats(G, 'arin').hp;
    ok(Gm.act(G, { t: 'evolve', id: 'arin', cls: 'paladin' }) && h.cls === 'paladin' && h.tier === 2 && h.skills.holy_blade, 'a knight becomes a paladin and learns Holy Blade');
    ok(St.heroStats(G, 'arin').hp > hp14, 'and is stronger for it');
    ok(Gm.skillList(G, 'arin').some((s) => s.id === 'power_strike') && Gm.skillList(G, 'arin').some((s) => s.id === 'aegis'), 'keeping the knight\'s skills and adding the paladin\'s');
    h.lv = 40; G.inv.shard = 5;
    ok(Gm.act(G, { t: 'ascend', id: 'arin' }) && h.tier === 3 && h.skills.dawnbreaker, 'at 40 a paladin ascends and learns Dawnbreaker');

    section('rules: bonds, quests, daily, idle');
    G = Gm.newGame(50);
    ok(!Gm.act(G, { t: 'evening', id: 'mira' }), 'no evenings in the morning');
    G.phase = 'evening';
    ok(!Gm.act(G, { t: 'evening', id: 'arin' }), 'Arin is you: no evening with yourself');
    ok(Gm.act(G, { t: 'evening', id: 'mira' }) && G.scene.kind === 'talk' && G.heroes.mira.bond > 0, 'a quiet evening with Mira grows the bond');
    Gm.act(G, { t: 'choose', i: 0 });
    ok(G.eveningDone && !Gm.act(G, { t: 'evening', id: 'mira' }), 'one evening a day');
    G.eveningDone = false; G.heroes.mira.bond = 100;
    Gm.act(G, { t: 'evening', id: 'mira' });
    ok(G.scene.kind === 'rank' && G.scene.rank === 1, 'a full bond plays a rank scene');
    const bad = SCENES.mira[0].choices.findIndex((c) => !c[1]);
    Gm.act(G, { t: 'choose', i: bad });
    ok(G.heroes.mira.bondLv === 0 && G.heroes.mira.bond < 100, 'the wrong answer costs some bond and the rank waits');
    Gm.act(G, { t: 'choose', i: 0 });
    G.eveningDone = false; G.heroes.mira.bond = 100;
    Gm.act(G, { t: 'evening', id: 'mira' });
    Gm.act(G, { t: 'choose', i: SCENES.mira[0].choices.findIndex((c) => c[1]) });
    ok(G.heroes.mira.bondLv === 1 && G.scene.kind === 'reply', 'the right one ranks the bond up');
    const m0 = Gm.newGame(50); m0.heroes.mira.bondLv = 0;
    const m1s = Gm.newGame(50); m1s.heroes.mira.bondLv = 4;
    ok(St.heroStats(m1s, 'mira').hp > St.heroStats(m0, 'mira').hp, 'a closer bond makes her stronger');
    G.heroes.mira.bondLv = 4; G.heroes.mira.bond = 500; G.eveningDone = false; G.scene = null;
    Gm.act(G, { t: 'evening', id: 'mira' });
    drain(G);
    Gm.act(G, { t: 'choose', i: 0 });
    ok(G.heroes.mira.bondLv === 5 && Object.values(G.gear).some((g) => g.u === 'keepsake_mira') && drain(G).some((e) => e.type === 'keepsake'), 'Soulbound: Mira gives you her Sun Pendant');
    // quests
    G = Gm.newGame(51);
    ok(G.quests.length === 3 && Gm.boardQuests(G).length === 5, 'three daily quests and two milestones on the board');
    const q = G.quests[0];
    ok(!Gm.act(G, { t: 'claim', id: q.id }), 'an unfinished quest can\'t be claimed');
    G.counters[q.kind] += q.need;
    const g0 = G.gold;
    ok(Gm.act(G, { t: 'claim', id: q.id }) && G.gold > g0 && q.claimed, 'a finished quest pays out');
    ok(!Gm.act(G, { t: 'claim', id: q.id }), 'once');
    G.best = 5;
    ok(Gm.act(G, { t: 'claim', id: 'm_f5' }) && G.milestones.m_f5, 'the floor 5 milestone');
    Gm.act(G, { t: 'rest' });
    ok(G.quests.every((x) => !x.claimed) && G.quests[0].id.endsWith('-2'), 'a new day posts new quests');
    // daily bonus and streak
    G = Gm.newGame(52);
    const gd = G.gold;
    ok(Gm.act(G, { t: 'daily', day: '2026-11-10' }) && G.gold > gd && G.daily.streak === 1 && G.blessing, 'the first daily bonus, and a blessing for the day');
    ok(!Gm.act(G, { t: 'daily', day: '2026-11-10' }), 'once a day');
    Gm.act(G, { t: 'daily', day: '2026-11-11' });
    ok(G.daily.streak === 2, 'the next day continues the streak');
    Gm.act(G, { t: 'daily', day: '2026-11-14' });
    ok(G.daily.streak === 1, 'a missed day resets it');
    for (let d = 15; d <= 21; d++) Gm.act(G, { t: 'daily', day: `2026-11-${d}` });
    ok(G.daily.streak === 8 && Object.values(G.gear).some((g) => g.rar === 3), 'day seven brings an epic piece');
    // idle
    G = Gm.newGame(53); G.best = 20;
    Gm.act(G, { t: 'idle', now: 1e12 });
    ok(G.idle.gold === 0, 'the first idle tick only starts the clock');
    Gm.act(G, { t: 'idle', now: 1e12 + 3600e3 });
    const oneHour = G.idle.gold;
    ok(oneHour > 0, 'an hour away earns the tithe');
    Gm.act(G, { t: 'idle', now: 1e12 + 3600e3 * 100 });
    ok(G.idle.gold <= oneHour * C.IDLE.capHours * 1.0001 && G.idle.gold > oneHour * 7, `idle income is capped at ${C.IDLE.capHours} hours`);
    G.gold = 0;
    ok(Gm.act(G, { t: 'collect' }) && G.gold === Math.floor(oneHour * C.IDLE.capHours) && G.idle.gold === 0, 'collecting pays it out');
    G.heroes.lyra.joined = true; G.party = ['arin', 'mira'];
    Gm.act(G, { t: 'errand', id: 'lyra', on: true });
    Gm.act(G, { t: 'idle', now: 1e12 + 3600e3 * 102 });
    ok((G.idle.xp.lyra || 0) > 0 && G.idle.ore > 0, 'a benched hero on errands earns xp and ore');
    ok(!Gm.act(G, { t: 'errand', id: 'arin', on: true }), 'party members don\'t run errands');
}

// ---------------------------------------------------------------- determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, days) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); for (let d = 0; d < days; d++) Bt.playDay(G, b, Bt.dayString(d), d * 86400e3); return G; };
    const a = play(42, 6), b = play(42, 6);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    const G = play(7, 5);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    for (let d = 5; d < 9; d++) { Bt.playDay(G, b1, Bt.dayString(d), d * 86400e3); Bt.playDay(copy, b2, Bt.dayString(d), d * 86400e3); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    // mid-battle save
    const H = Gm.newGame(9);
    Gm.act(H, { t: 'enter', floor: 1 });
    const H2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(H))));
    Gm.autoResolve(H); Gm.autoResolve(H2);
    ok(JSON.stringify(Gm.serialize(H)) === JSON.stringify(Gm.serialize(H2)), 'a save in the middle of a battle resumes identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ---------------------------------------------------------------- bot
if (want('bot')) {
    section(`bot (${SEEDS} seeds x ${DAYS} days)`);
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const dil of [1, 0]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ diligence: dil });
            let bad = null;
            const at = {};
            for (let d = 0; d < DAYS && !bad; d++) {
                Bt.playDay(G, bot, Bt.dayString(d), d * 86400e3);
                // invariants
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = `gold ${G.gold}`;
                for (const [k, v] of Object.entries(G.inv)) if (!Number.isInteger(v) || v < 0) bad = `inventory ${k}=${v}`;
                for (const id of Gm.joined(G)) {
                    const st = St.heroStats(G, id);
                    if (!Object.values(st).every(Number.isFinite)) bad = `${id} stats not finite`;
                    const h = G.heroes[id];
                    if (h.hp > st.hp || h.mp > st.mp) bad = `${id} over max hp/mp`;
                    for (const sl of ['weapon', 'armor', 'acc']) if (h.eq[sl] && !G.gear[h.eq[sl]]) bad = `${id} wears missing gear`;
                }
                if (G.mode !== 'town' || G.battle || G.scene) bad = 'did not end the day in town';
                if ([5, 10, 20, 30].includes(d + 1)) at[d + 1] = G.best;
            }
            ok(!bad, `seed ${s} diligence ${dil}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, dil, best: G.best, roster: Gm.joined(G).length, lv: Math.max(...G.party.map((id) => G.heroes[id].lv)), defeats: G.stats.defeats, ...Object.fromEntries(Object.entries(at).map(([k, v]) => ['d' + k, v])) });
        }
    }
    console.table(rows);
    const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    const dil = rows.filter((r) => r.dil === 1), lazy = rows.filter((r) => r.dil === 0);
    ok(med(dil.map((r) => r.d5)) >= 9, `a diligent player beats the first boss within five days (median best ${med(dil.map((r) => r.d5))})`);
    ok(med(dil.map((r) => r.d5)) <= 30, `but not floor 30 (median ${med(dil.map((r) => r.d5))})`);
    if (DAYS >= 20) ok(med(dil.map((r) => r.d20)) >= 30 && med(dil.map((r) => r.d20)) <= 70, `by day 20, between floors 30 and 70 (median ${med(dil.map((r) => r.d20))})`);
    ok(med(dil.map((r) => r.best)) > med(lazy.map((r) => r.best)) + 10, 'recruiting, the forge and the temple matter: the diligent bot climbs much higher');
    ok(dil.every((r) => r.roster >= 6), 'the diligent bot recruits most of the tavern');
    ok(dil.every((r) => r.defeats > 0), 'and still gets beaten sometimes (the tower is a wall, not a walk)');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
