/**
 * simtest.mjs — headless checks of Dragonroll's simulation. No browser.
 *
 *   node game-089/dev/simtest.mjs                     # everything
 *   ONLY=purity,rules node game-089/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-089/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. board: forty spaces, four corners, every region's deeds, town and dungeon.
 * 3. rules: dice and laps, deeds and tolls, towns, battles (every skill and burst, items, flee,
 *    win and loss), dungeons and shards, roaming monsters, every fate card, the dragon.
 * 4. determinism: same seed and choices, same game; save round trips (on the board and mid-battle)
 *    play on identically; an unknown save version is rejected.
 * 5. fuzz: random legal actions for thousands of steps with invariants after each one.
 * 6. bot: bots play whole games for every class at two skills; prints the balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Bd = await import('../js/sim/board.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/battle.js');
const Pt = await import('../js/sim/party.js');
const Bot = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const fresh = (seed = 1, o = {}) => { const G = Gm.newGame(seed, { cls: 'knight', ...o }); G.events.length = 0; return G; };
const act = (G, a) => { const why = Gm.act(G, a); return why; };
/** Win the current battle with a strong bot. */
function winBattle(G) {
    const bot = Bot.makeBot({ skill: 1, seed: 3 });
    let n = 0;
    while (G.phase === 'battle' && n++ < 800) { const why = act(G, { type: 'cmd', ...Bot.battleCommand(G, bot) }); if (why) throw new Error(why); }
}
function strong(G, lv = 20) {
    G.level = lv;
    for (const m of G.party) { const s = Pt.stats(G, m); m.hp = s.maxhp; m.mp = s.maxmp; }
}

// ================================================================== purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
        // strip comments and string literals, so a sentence never trips the grep
        const src = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|new Date\b/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(raw) && !/from 'three'/.test(raw), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ================================================================== board
if (want('board')) {
    section('board');
    const S = Bd.SPACES;
    ok(S.length === C.BOARD_SIZE, `${C.BOARD_SIZE} spaces`);
    ok(S[0].type === 'start' && S[10].type === 'shrine' && S[20].type === 'fountain' && S[30].type === 'portal', 'the four corners');
    for (const r of D.REGIONS) {
        const side = S.filter((s) => s.region === r.id);
        ok(side.length === 9, `${r.name} has nine spaces`);
        ok(side.filter((s) => s.type === 'deed').length === 2, `${r.name} has two deeds`);
        ok(side.filter((s) => s.type === 'town').length === 1 && side.filter((s) => s.type === 'dungeon').length === 1, `${r.name} has a town and a dungeon`);
        ok(side.filter((s) => s.type === 'battle').length >= 3, `${r.name} has at least three encounters`);
    }
    ok(Object.keys(D.DUNGEONS).every((k) => S.some((s) => s.dungeon === k)), 'every dungeon is on the board');
    ok(Object.keys(D.TOWNS).every((k) => S.some((s) => s.town === k)), 'every town is on the board');
    ok(Object.values(D.TOWNS).every((t) => D.COMPANIONS[t.companion]?.town !== undefined), 'every town has a companion');
    ok(D.RECIPES.every((r) => D.GEAR[r.out] && Object.keys(r.mats).every((m) => D.MATERIALS[m])), 'every recipe makes real gear from real materials');
    ok(Object.values(D.MONSTERS).every((m) => m.skills.every(([s]) => D.ESKILLS[s]) && (m.skills2 || []).every(([s]) => D.ESKILLS[s])), 'every monster skill exists');
    ok(Object.values(D.MONSTERS).every((m) => m.drops.every(([mat]) => D.MATERIALS[mat])), 'every drop is a material');
    const classes = [...Object.values(D.CLASSES), ...Object.values(D.COMPANIONS)];
    ok(classes.every((c) => c.skills.every((s) => D.SKILLS[s]) && D.BURSTS[c.burst]), 'every member has real skills and a burst');
    ok(classes.every((c) => D.GEAR[c.start.weapon] && D.GEAR[c.start.armor] && c.weapons.includes(D.GEAR[c.start.weapon].kind)), 'every member starts with gear they can hold');
    // each region's dungeon drops something its own forge recipes need, and shards are all reachable
    ok(D.SHARDS.every((s) => Object.values(D.DUNGEONS).some((d) => d.shard === s)), 'every shard is guarded by a dungeon');
}

// ================================================================== rules
if (want('rules')) {
    section('rules: dice and laps');
    let G = fresh(1);
    const pos0 = G.pos;
    ok(G.phase === 'roll' && G.gold === C.START_GOLD && G.party.length === 1, 'a new game: rolling, starting gold, a party of one');
    ok(G.roamers.length === Gm.roamerCap(G), 'roaming monsters are out from the start');
    G.roamers.length = 0;
    act(G, { type: 'roll' });
    const dice = G.events.find((e) => e.type === 'dice' && e.who === 'you');
    ok(dice && dice.dice.length === 2 && dice.dice.every((d) => d >= 1 && d <= 6), 'two six-sided dice');
    const steps = G.events.filter((e) => e.type === 'step' && e.who === 'you').length;
    ok(steps >= 2 && steps <= 12 && (G.pos === (pos0 + steps) % 40 || G.phase === 'passTown'), 'the token walks the total, one step at a time');
    // passing Hearthstone
    G = fresh(2); G.roamers.length = 0; G.pos = 38;
    const gold0 = G.gold;
    act(G, { type: 'roll', item: undefined });
    ok(G.lap === 2 && G.gold > gold0 && G.events.some((e) => e.type === 'lap'), 'passing Hearthstone starts lap 2 and pays a salary');
    // a loaded die
    G = fresh(3); G.roamers.length = 0; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 4 });
    ok(G.pos === 4 || (G.phase === 'passTown' && G.pos < 4), 'the loaded die rolls what you choose');
    ok(!G.bag.items.die, 'and is used up');
    // three dice with boots
    G = fresh(4); G.roamers.length = 0; G.bag.items.boots = 1;
    act(G, { type: 'roll', item: 'boots' });
    ok(G.events.find((e) => e.type === 'dice').dice.length === 3, 'Swift Boots roll three dice');
    // doubles roll again
    let dbl = false;
    for (let s = 1; s < 200 && !dbl; s++) {
        G = fresh(s); G.roamers.length = 0;
        act(G, { type: 'roll' });
        const d = G.events.find((e) => e.type === 'dice');
        if (d.doubles) {
            while (G.phase !== 'roll' && !G.over) {
                const o = Gm.options(G);
                const pref = o.find((x) => ['go', 'pass', 'leave', 'ok', 'wait'].includes(x.type)) ?? (G.phase === 'battle' ? null : o[0]);
                if (G.phase === 'battle') { strong(G); winBattle(G); continue; }
                act(G, pref);
            }
            dbl = G.extraRoll && G.turn === 1;
        }
    }
    ok(dbl, 'doubles give another roll in the same turn');

    section('rules: deeds and tolls');
    G = fresh(5); G.roamers.length = 0;
    G.pos = 1; G.move = { left: 1 }; G.phase = 'moving';
    // land on the orchard (space 2)
    G.pos = 1; act(G, { type: 'roll', item: 'die', pick: 0 });   // refused: no die
    G.bag.items.die = 1; act(G, { type: 'roll', item: 'die', pick: 2 });   // lands on 3? pick=2 from 1 → 3
    G = fresh(6); G.roamers.length = 0; G.pos = 0; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 2 });
    ok(G.phase === 'buy' && G.ctx.deed === 'orchard', 'landing on an unowned deed offers it');
    const g0 = G.gold;
    act(G, { type: 'buy' });
    ok(G.deeds.orchard.owner === 'you' && G.gold === g0 - 110, 'buying a deed takes its price');
    // a rival lands on it
    const baron = G.rivals[0];
    const t0 = G.gold;
    ok(Gm.deedToll(G, 'orchard') === Math.round(110 * C.DEED.toll[0]), 'toll at level 0');
    G.deeds.windmill = { owner: 'you', level: 0 };
    ok(Gm.deedToll(G, 'orchard') === Math.round(110 * C.DEED.toll[0] * 2), 'owning the whole region doubles the toll');
    ok(Pt.ownsSet(G, 'meadow') && Gm.salaryFor(G) > Math.round(C.SALARY.base), 'and Meadowvale\'s set raises your salary');
    baron.gold = 500;
    // force the baron onto the orchard: put him one short and roll his dice by hand
    const tollPaid = (() => { const before = baron.gold; G.events.length = 0; const deed = 'orchard'; /* payToll is internal; land a rival via rivalTurn is random */ return before; })();
    void tollPaid;
    // landing on a rival's deed
    G = fresh(7); G.roamers.length = 0; G.deeds.orchard = { owner: 'mira', level: 1 }; G.bag.items.die = 1;
    const gm = G.gold, mg = G.rivals[1].gold;
    act(G, { type: 'roll', item: 'die', pick: 2 });
    const toll = Math.round(110 * C.DEED.toll[1]);
    ok(G.gold === gm - toll && G.rivals[1].gold >= mg + toll, 'landing on a rival\'s deed pays them the toll');
    // upgrading your own
    G = fresh(8); G.roamers.length = 0; G.deeds.orchard = { owner: 'you', level: 0 }; G.bag.items.die = 1; G.gold = 1000;
    act(G, { type: 'roll', item: 'die', pick: 2 });
    ok(G.phase === 'upgrade', 'landing on your own deed offers an upgrade');
    act(G, { type: 'upgrade' });
    ok(G.deeds.orchard.level === 1, 'upgrades raise its level');
    ok(act(G, { type: 'sellDeed', deed: 'orchard' }) === '' && !G.deeds.orchard.owner, 'a deed can be sold back to the bank');

    section('rules: towns');
    G = fresh(9); G.roamers.length = 0; G.bag.items.die = 1; G.gold = 2000;
    act(G, { type: 'roll', item: 'die', pick: 5 });
    ok(G.phase === 'town' && G.ctx.town === 'brookhollow', 'landing on a town opens it');
    act(G, { type: 'buyItem', item: 'potion' });
    ok(G.bag.items.potion === 4, 'buying a potion');
    ok(act(G, { type: 'buyItem', item: 'flask' }) !== '', 'a town only sells its own stock');
    act(G, { type: 'hire', id: 'pip' });
    ok(G.party.length === 2 && G.party[1].id === 'pip', 'hiring Pip at Brookhollow');
    ok(act(G, { type: 'hire', id: 'bram' }) !== '', 'Bram is not here');
    const st = Gm.shopStock(G, 'brookhollow');
    const blade = st.gear.find((g) => D.GEAR[g].kind === 'blade' && D.GEAR[g].tier === 2) ?? st.gear.find((g) => D.GEAR[g].kind === 'blade');
    act(G, { type: 'buyGear', gear: blade });
    ok(G.bag.gear[blade] === 1, 'buying a sword puts it in the bag');
    act(G, { type: 'equip', member: 'hero', gear: blade });
    ok(G.party[0].gear.weapon === blade && G.bag.gear.blade1 === 1, 'equipping swaps the old one into the bag');
    ok(act(G, { type: 'equip', member: 'pip', gear: 'blade1' }) !== '', 'Pip cannot hold a sword');
    G.party[0].hp = 1;
    act(G, { type: 'inn' });
    ok(G.party[0].hp === Pt.stats(G, G.party[0]).maxhp, 'the inn heals everyone');
    Object.assign(G.bag.mats, { hide: 3 });
    act(G, { type: 'craft', recipe: D.RECIPES.findIndex((r) => r.out === 'boarjerkin') });
    ok(G.bag.gear.boarjerkin === 1 && !G.bag.mats.hide, 'the forge turns boar hide into a jerkin');
    ok(act(G, { type: 'craft', recipe: D.RECIPES.findIndex((r) => r.out === 'dragonbane') }) !== '', 'Dragonbane needs every shard');
    G.bench.push(Pt.newMember(G, 'sylva')); G.hired.sylva = true;
    act(G, { type: 'swap', in: 'sylva', out: 'pip' });
    ok(G.party[1].id === 'sylva' && G.bench[0].id === 'pip', 'swapping companions at a tavern');
    act(G, { type: 'leave' });
    ok(G.phase === 'roll' && G.turn === 2, 'leaving town ends the turn');

    section('rules: battles');
    G = fresh(10); strong(G, 5);
    G.after = { k: 'endTurn' };
    Gm.beginBattle(G, { kind: 'encounter', region: 'meadow', enemies: [{ id: 'slime', lv: 1 }, { id: 'goblin', lv: 1 }] });
    const B = G.battle;
    ok(B.turn >= 0 && B.units[B.turn].side === 'p', 'a battle waits on a party member');
    const foe = B.units.findIndex((u) => u.side === 'e');
    const hp0 = B.units[foe].hp;
    act(G, { type: 'cmd', cmd: 'attack', target: foe });
    ok(B.units[foe].hp < hp0 || !B.units[foe].alive, 'Attack hurts the target');
    ok(G.events.some((e) => e.type === 'b_hit'), 'and records a hit');
    // skills cost MP
    while (G.phase === 'battle' && B.units[B.turn]?.side !== 'p') break;
    if (G.phase === 'battle') {
        const u = B.units[B.turn];
        const mp = u.mp;
        act(G, { type: 'cmd', cmd: 'skill', skill: 'bash', target: B.units.findIndex((x) => x.side === 'e' && x.alive) });
        ok(u.mp === mp - D.SKILLS.bash.mp || G.phase !== 'battle', 'a skill costs its MP');
        if (G.phase === 'battle') {
            B.units[B.turn].mp = 0;
            ok(Bt.whyNot(G, { cmd: 'skill', skill: 'bash' }) === 'not enough MP', 'no MP, no skill');
            ok(Bt.whyNot(G, { cmd: 'skill', skill: 'cleave' }) === 'not learned', 'skills unlock with levels');
            ok(Bt.whyNot(G, { cmd: 'burst' }) !== '', 'Burst needs a full Valor gauge');
        }
    }
    winBattle(G);
    ok(G.phase === 'reward' && G.ctx.loot.xp > 0, 'winning gives a reward card with XP');
    const lv0 = G.level;
    act(G, { type: 'ok' });
    ok(G.phase === 'roll' && G.battle === null, 'the reward card ends the turn');
    void lv0;
    // every skill and burst runs
    for (const [cls] of Object.entries(D.CLASSES)) {
        G = fresh(11, { cls }); strong(G, 20);
        for (const c of ['pip', 'sylva']) { G.party.push(Pt.newMember(G, c)); G.hired[c] = true; }
        strong(G, 20);
        G.after = { k: 'endTurn' };
        Gm.beginBattle(G, { kind: 'boss', region: 'coast', enemies: [{ id: 'brinetooth', lv: 30 }, { id: 'crab', lv: 30 }] });
        const used = new Set();
        let guard = 0;
        while (G.phase === 'battle' && guard++ < 300) {
            const u = G.battle.units[G.battle.turn];
            const m = G.party[u.mi];
            u.mp = u.maxmp;
            const list = Pt.skillsOf(G, m).filter((s) => !used.has(s));
            G.valor = guard % 5 === 0 ? 100 : G.valor;
            let cmd;
            if (G.valor >= 100) cmd = { cmd: 'burst', burst: Bt.burstOf(G, u) };
            else if (list.length) { used.add(list[0]); const S = D.SKILLS[list[0]]; cmd = { cmd: 'skill', skill: list[0], target: S.target === 'ko' ? G.battle.units.findIndex((x) => x.side === 'p' && !x.alive) : undefined }; if (S.target === 'ko' && cmd.target < 0) { cmd = { cmd: 'defend' }; } }
            else cmd = { cmd: 'attack' };
            const why = act(G, { type: 'cmd', ...cmd });
            if (why) { act(G, { type: 'cmd', cmd: 'defend' }); }
        }
        const all = [...D.CLASSES[cls].skills, ...D.COMPANIONS.pip.skills, ...D.COMPANIONS.sylva.skills].filter((s) => s !== 'revive');
        ok(all.every((s) => used.has(s)), `${cls}: every skill of the party ran`);
    }
    // items
    G = fresh(12); strong(G, 3);
    G.bag.items = { potion: 1, bomb: 1, smoke: 1, phoenix: 1 };
    G.after = { k: 'endTurn' };
    Gm.beginBattle(G, { kind: 'encounter', region: 'meadow', enemies: [{ id: 'slime', lv: 1 }, { id: 'slime', lv: 1 }] });
    const hb = G.battle;
    hb.units[0].hp = 10;
    act(G, { type: 'cmd', cmd: 'item', item: 'potion', target: 0 });
    ok(hb.units[0].hp > 10 && !G.bag.items.potion, 'a potion heals and is used up');
    if (G.phase === 'battle') { act(G, { type: 'cmd', cmd: 'item', item: 'bomb' }); ok(G.events.filter((e) => e.type === 'b_hit').length >= 1, 'a fire bomb hits'); }
    if (G.phase === 'battle') { act(G, { type: 'cmd', cmd: 'item', item: 'smoke' }); ok(G.phase !== 'battle' && G.stats.fled === 1, 'a smoke bomb escapes'); }
    // flee is refused in boss fights
    G = fresh(13); G.after = { k: 'endTurn' };
    Gm.beginBattle(G, { kind: 'boss', region: 'meadow', enemies: [{ id: 'grubnose', lv: 3 }], canFlee: false });
    ok(Bt.whyNot(G, { cmd: 'flee' }) === 'no escape', 'no running from a boss');
    // losing
    G = fresh(14); G.pos = 15; G.gold = 100;
    G.after = { k: 'endTurn' };
    Gm.beginBattle(G, { kind: 'encounter', region: 'woods', enemies: [{ id: 'treant', lv: 25 }, { id: 'treant', lv: 25 }] });
    let guard = 0;
    while (G.phase === 'battle' && guard++ < 200) act(G, { type: 'cmd', cmd: 'defend' });
    ok(G.phase === 'defeat' && G.ctx.lost === 20, 'a loss costs a fifth of your gold');
    act(G, { type: 'ok' });
    ok(G.pos === 10 && G.party[0].hp > 0, 'and you wake at the corner behind you');

    section('rules: dungeons and shards');
    G = fresh(15); G.roamers.length = 0;
    for (const c of ['pip', 'bram']) { G.party.push(Pt.newMember(G, c)); G.hired[c] = true; }
    strong(G, 12);
    G.pos = 8; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 2 })   // 2 dice minimum: 8 + 2 = 10, passes 9
    ;
    ok(G.phase === 'passTown' && G.ctx.dungeon === 'warren', 'passing a dungeon offers a stop');
    act(G, { type: 'stop' });
    ok(G.phase === 'dungeonGate', 'stopping at a dungeon');
    act(G, { type: 'enter' });
    let floors = 0;
    guard = 0;
    while (G.phase !== 'roll' && guard++ < 50) {
        if (G.phase === 'battle') { if (G.battle.dungeon) floors = Math.max(floors, G.battle.dungeon.floor); strong(G, 12); winBattle(G); }
        else if (G.phase === 'reward') act(G, { type: 'ok' });
        else if (G.phase === 'dungeonCamp') act(G, { type: 'onward' });
        else act(G, Gm.options(G)[0]);
    }
    ok(floors === D.DUNGEONS.warren.floors, 'a dungeon is a battle and then its boss');
    ok(G.shards.includes('shardEmber') && G.bag.mats.shardEmber === 1, 'its boss guards a Dragonbane Shard');
    ok(G.cleared.warren === 1 && !Gm.dungeonOpen(G, 'warren'), 'a cleared dungeon is quiet until the next lap');
    G.lap++;
    ok(Gm.dungeonOpen(G, 'warren'), 'and restocks the lap after');
    // all four shards forge Dragonbane
    for (const s of D.SHARDS) G.bag.mats[s] = 1;
    G.phase = 'town'; G.ctx = { town: 'hammerhold' }; G.gold = 5000;
    act(G, { type: 'craft', recipe: D.RECIPES.findIndex((r) => r.out === 'dragonbane') });
    ok(G.bag.gear.dragonbane === 1, 'all four shards forge Dragonbane');
    ok(Pt.canEquip(G, G.party[0], 'dragonbane'), 'which anyone can wield');

    section('rules: roaming monsters');
    G = fresh(16); G.roamers = [{ i: 3, id: 'boar' }]; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 7 });
    ok(G.phase === 'battle' && G.pos === 3 && G.battle.roamer === 3, 'walking into a roaming monster stops you for a fight');
    strong(G, 15); winBattle(G);
    ok(!G.roamers.some((r) => r.i === 3), 'beating it clears the road');

    section('rules: fate cards');
    const seenCards = new Set();
    for (let s = 1; s < 400; s++) {
        G = fresh(s); G.roamers.length = 0; G.lap = 1 + (s % 4); strong(G, 10); G.gold = 300;
        G.pos = 1; G.bag.items.die = 1;
        act(G, { type: 'roll', item: 'die', pick: 2 });   // Meadowvale's fate space is space 3
        if (G.phase !== 'notice' || G.ctx.kind !== 'fate') continue;
        seenCards.add(G.ctx.card);
        let g2 = 0;
        while (G.phase !== 'roll' && !G.over && g2++ < 400) {
            if (G.phase === 'battle') { strong(G, 15); winBattle(G); continue; }
            const o = Gm.options(G);
            const a = o.find((x) => ['ok', 'go', 'pass', 'leave', 'wait', 'retreat'].includes(x.type)) ?? o[0];
            if (act(G, a)) break;
        }
        if (G.phase !== 'roll' && !G.over) { ok(false, `fate card ${[...seenCards].pop()} left the game in ${G.phase}`); break; }
    }
    ok(D.FATE.every((f) => seenCards.has(f.id)), `every fate card was drawn and resolved (${seenCards.size}/${D.FATE.length})`);

    section('rules: the dragon');
    G = fresh(17, { length: 'short' }); G.roamers.length = 0;
    G.lap = G.laps; G.pos = 39; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 3 });
    ok(G.phase === 'battle' && G.battle.kind === 'dragon', 'when the laps run out, passing Hearthstone wakes the dragon');
    guard = 0;
    while (G.phase === 'battle' && guard++ < 400) act(G, { type: 'cmd', cmd: 'defend' });
    ok(G.phase === 'defeat' && G.ctx.dragon && G.dragon.tries === 1, 'losing to him the first time is not the end');
    act(G, { type: 'ok' });
    G.pos = 38; G.roamers.length = 0; G.bag.items.die = 1;
    act(G, { type: 'roll', item: 'die', pick: 2 });
    ok(G.phase === 'battle' && G.battle.kind === 'dragon', 'the next pass of Hearthstone is the rematch');
    guard = 0;
    while (G.phase === 'battle' && guard++ < 400) act(G, { type: 'cmd', cmd: 'defend' });
    ok(G.over === 'lose' && G.phase === 'gameover', 'a second loss ends the game');
    // early climb
    G = fresh(18); G.roamers.length = 0; G.lap = G.early + 1 - 1; G.pos = 39; G.bag.items.die = 1;
    G.lap = G.early;   // completing this lap makes `early` laps done
    act(G, { type: 'roll', item: 'die', pick: 3 });
    ok(G.phase === 'dragonOffer', 'after enough laps you may climb early');
    act(G, { type: 'wait' });
    ok(G.phase !== 'dragonOffer' && G.phase !== 'battle', 'or keep adventuring');
    // a win
    G = fresh(19); G.roamers.length = 0;
    for (const c of ['pip', 'grumli']) { G.party.push(Pt.newMember(G, c)); G.hired[c] = true; }
    strong(G, 24);
    for (const m of G.party) m.gear.weapon = 'dragonbane';
    G.shards = [...D.SHARDS];
    Gm.startDragon(G, true);
    const allEv = [];
    { const bot2 = Bot.makeBot({ skill: 1, seed: 3 }); let n2 = 0; while (G.phase === 'battle' && n2++ < 800) { act(G, { type: 'cmd', ...Bot.battleCommand(G, bot2) }); allEv.push(...G.events.splice(0)); } }
    G.events.push(...allEv);
    ok(G.over === 'win' && G.phase === 'victory' && Gm.rank(G) !== 'C', 'slaying Pyrrhax wins the game, with a rank');
    ok(G.events.some((e) => e.type === 'b_phase'), 'he takes to the air at half health');
    ok(G.events.some((e) => e.type === 'b_summon'), 'and hatches whelps');
}

// ================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, steps, G = fresh(seed), bot = Bot.makeBot({ skill: 1, seed })) => {
        for (let i = 0; i < steps && !G.over; i++) { const a = Bot.botAction(G, bot); if (!a || act(G, a)) break; G.events.length = 0; }
        return G;
    };
    const a = play(42, 400), b = play(42, 400);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and choices, same game');
    // a save round trip on the board and mid-battle
    for (const target of ['roll', 'battle']) {
        const G = fresh(7);
        const bot = Bot.makeBot({ skill: 1, seed: 7 });
        let n = 0;
        while (n++ < 2000 && !(G.phase === target && n > 60)) { const x = Bot.botAction(G, bot); if (act(G, x)) break; G.events.length = 0; }
        ok(G.phase === target, `reached a ${target} phase to save in`);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bot.makeBot({ skill: 1, seed: 99 }), b2 = Bot.makeBot({ skill: 1, seed: 99 });
        play(0, 300, G, b1); play(0, 300, copy, b2);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip ${target === 'battle' ? 'mid-battle ' : ''}plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ================================================================== fuzz
function invariants(G) {
    if (!Number.isFinite(G.gold) || G.gold < 0) return 'gold ' + G.gold;
    if (!(G.pos >= 0 && G.pos < 40)) return 'pos ' + G.pos;
    for (const m of G.party) {
        const s = Pt.stats(G, m);
        if (!(m.hp >= 0 && m.hp <= s.maxhp)) return `${m.id} hp ${m.hp}/${s.maxhp}`;
        if (!(m.mp >= 0 && m.mp <= s.maxmp)) return `${m.id} mp ${m.mp}/${s.maxmp}`;
    }
    if (G.party.length > C.PARTY_MAX) return 'party too big';
    for (const r of G.rivals) if (!(r.gold >= 0) || !(r.pos >= 0 && r.pos < 40)) return 'rival ' + r.id;
    if (G.battle && !G.battle.over) for (const u of G.battle.units) if (!(u.hp >= 0 && u.hp <= u.maxhp) || !Number.isFinite(u.next)) return 'unit ' + u.name;
    if (G.phase === 'battle' && !G.battle) return 'battle phase with no battle';
    if (Object.values(G.bag.items).some((n) => !(n > 0))) return 'empty item stack';
    return null;
}

if (want('fuzz')) {
    section('fuzz');
    let steps = 0, bad = null;
    const rnd = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; };
    for (let s = 1; s <= SEEDS * 3 && !bad; s++) {
        const R = rnd(s);
        const G = fresh(s * 31, { cls: ['knight', 'ranger', 'mage'][s % 3], length: ['short', 'standard', 'long'][s % 3] });
        const bot = Bot.makeBot({ skill: 1, seed: s });
        for (let i = 0; i < 1500 && !G.over; i++) {
            let a;
            if (G.phase === 'battle') {
                // random but legal-ish commands, with the bot's choice half the time
                const B = G.battle, u = B.units[B.turn];
                const m = G.party[u.mi];
                const r = R();
                const sk = Pt.skillsOf(G, m);
                if (r < 0.5) a = { type: 'cmd', ...Bot.battleCommand(G, bot) };
                else if (r < 0.7 && sk.length) a = { type: 'cmd', cmd: 'skill', skill: sk[Math.floor(R() * sk.length)], target: Math.floor(R() * B.units.length) };
                else if (r < 0.8) a = { type: 'cmd', cmd: 'item', item: Object.keys(G.bag.items)[0] ?? 'potion', target: Math.floor(R() * B.units.length) };
                else a = { type: 'cmd', cmd: R() < 0.1 ? 'flee' : 'attack', target: Math.floor(R() * B.units.length) };
                if (act(G, a)) act(G, { type: 'cmd', cmd: 'defend' });
            } else {
                const o = Gm.options(G);
                if (R() < 0.15) {
                    // a field action: equip, use, sell
                    const ids = Object.keys(G.bag.gear);
                    if (ids.length) act(G, { type: 'equip', member: G.party[Math.floor(R() * G.party.length)].id, gear: ids[0] });
                }
                a = R() < 0.6 ? Bot.botAction(G, bot) : o[Math.floor(R() * o.length)];
                if (!a || act(G, a)) { const b = Bot.botAction(G, bot); if (b) act(G, b); }
            }
            G.events.length = 0;
            steps++;
            const why = invariants(G);
            if (why) { bad = `seed ${s} step ${i} (${G.phase}): ${why}`; break; }
        }
    }
    ok(!bad, bad || `${steps} random steps, invariants hold`);
}

// ================================================================== bots and balance
if (want('bot')) {
    section('bot');
    const table = [];
    for (const skill of [1, 0.5]) for (const cls of Object.keys(D.CLASSES)) {
        const rows = [];
        for (let s = 1; s <= SEEDS; s++) {
            const G = fresh(s * 7919 + skill * 13, { cls });
            const bot = Bot.makeBot({ skill, seed: s });
            let n = 0, err = null;
            while (!G.over && n++ < 30000) {
                const a = Bot.botAction(G, bot);
                const why = act(G, a);
                if (why) { err = `${G.phase}: ${JSON.stringify(a)} → ${why}`; break; }
                G.events.length = 0;
                const inv = invariants(G);
                if (inv) { err = inv; break; }
            }
            if (!ok(!err && G.over, `${cls} skill ${skill} seed ${s}: ${err || (G.over ? 'finished' : 'did not finish')}`)) continue;
            rows.push(G);
        }
        const avg = (f) => rows.reduce((a, G) => a + f(G), 0) / Math.max(1, rows.length);
        const r = { skill, cls, win: rows.filter((G) => G.over === 'win').length, n: rows.length, lv: avg((G) => G.level).toFixed(1), turns: avg((G) => G.turn).toFixed(0), battles: avg((G) => G.stats.battles).toFixed(0), ko: avg((G) => G.stats.ko).toFixed(1), shards: avg((G) => G.shards.length).toFixed(1), deeds: avg((G) => Object.values(G.deeds).filter((d) => d.owner === 'you').length).toFixed(1), tries: avg((G) => G.dragon.tries).toFixed(1), early: rows.filter((G) => G.dragon.early && G.over === 'win').length };
        table.push(r);
        console.log(`  ${cls.padEnd(7)} skill ${skill}: won ${r.win}/${r.n} (early ${r.early}) · level ${r.lv} · ${r.turns} turns · ${r.battles} battles · knocked out ${r.ko} · shards ${r.shards} · deeds ${r.deeds} · dragon tries ${r.tries}`);
    }
    const rate = (skill) => { const rs = table.filter((r) => r.skill === skill); return rs.reduce((a, r) => a + r.win, 0) / Math.max(1, rs.reduce((a, r) => a + r.n, 0)); };
    ok(rate(1) >= 0.8, `a strong player usually slays the dragon (${Math.round(rate(1) * 100)}%)`);
    ok(rate(0.5) >= 0.4, `a casual player often does (${Math.round(rate(0.5) * 100)}%)`);
    ok(rate(1) > rate(0.5) || rate(1) === 1, 'playing well helps');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
