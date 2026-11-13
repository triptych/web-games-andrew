/**
 * simtest.mjs — headless checks of GIANT'S VAULT's simulation. No browser.
 *
 *   node game-132/dev/simtest.mjs                 # everything (about a minute)
 *   ONLY=purity,data,world,rules,skills,loot,determinism,bot node game-132/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-132/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * data         every skill, item, monster and area table is well formed and points at things that exist.
 * world        60 seeds of each generator: start reaches the exit, the waystone, every spawn and lore stone.
 * rules        combat, stagger, kills, levels, masteries, potion, portal, death, waystones, pet, filter, bosses, rifts.
 * skills       every active skill does its thing; every legendary power and hybrid synergy changes what it says.
 * loot         rarity weights, affix ranges, sockets and gems, sets, prices, mythics only in deep rifts.
 * determinism  same seed and inputs → same game; save round trips (mid-fight, through a portal) play on identically.
 * bot          the bot plays the whole campaign and three rift tiers with each class; per-step invariants; the
 *              balance table and its asserted bands (see game-plan.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const W = await import('../js/sim/world.js');
const L = await import('../js/sim/loot.js');
const St = await import('../js/sim/stats.js');
const Sk = await import('../js/sim/skills.js');
const Cb = await import('../js/sim/combat.js');
const Mo = await import('../js/sim/monsters.js');
const Ar = await import('../js/sim/areas.js');
const DM = await import('../js/sim/data/masteries.js');
const DI = await import('../js/sim/data/items.js');
const DMo = await import('../js/sim/data/monsters.js');
const DW = await import('../js/sim/data/world.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = Gm.NONE;
const input = (o = {}) => ({ ...NONE, held: [false, false, false, false, false], press: [false, false, false, false, false], ...o });
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const living = (G) => G.mons.filter((m) => m.life > 0);

/** A test arena: the player in a dungeon with nothing else alive, and a helper to place monsters. */
function arena(cls = 'ironsworn', seed = 7, area = 'temple') {
    const G = Gm.newGame(seed, cls);
    Ar.enterArea(G, area, 'start');
    G.mons.length = 0; G.drops.length = 0; G.events.length = 0;
    G.pet.state = 'away'; G.pet.t = 1e9;           // the pet stays out of the way unless a test wants it
    const P = G.player;
    // an open spot with room around it
    for (const r of G.area.rooms) {
        const x = r.cx, y = r.cy;
        if (W.fits(G.area, x, y, 3) && W.fits(G.area, x + 3, y, 1) && W.fits(G.area, x - 3, y, 1)) { P.x = x; P.y = y; break; }
    }
    return G;
}
const mon = (G, kind, dx, dy, lvl = 5, extra) => Mo.makeMonster(G, kind, G.player.x + dx, G.player.y + dy, lvl, { aggro: true, ...extra });
function learn(G, id, rank = 1) {
    const P = G.player, m = DM.SKILLS[id].mastery;
    if (!P.masteries.includes(m)) P.masteries[1] = m;
    P.bar[m] = Math.max(P.bar[m] || 0, DM.TIER_RANK[DM.SKILLS[id].tier]);
    P.ranks[id] = rank;
    if (DM.SKILLS[id].kind === 'active' && !P.slots.includes(id)) P.slots[P.slots.indexOf(null) >= 0 ? P.slots.indexOf(null) : 4] = id;
    St.recompute(G);
    for (const k of ['rage', 'mana', 'essence']) P.res[k] = P.stats.resMax[k];
}

// ======================================================================================================== purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================================================== data
if (want('data')) {
    section('data');
    for (const [id, s] of Object.entries(DM.SKILLS)) {
        ok(DM.MASTERIES[s.mastery], `${id}: mastery exists`);
        ok(s.tier >= 1 && s.tier <= 4 && s.desc && s.art && Number.isInteger(s.icon), `${id}: tier, text, art and icon`);
        ok(!/\{\w+\}/.test(DM.skillText(id, 3)), `${id}: every {field} in its text resolves`);
        if (s.kind === 'active') ok(['arc', 'leap', 'buff', 'channel', 'nova', 'proj', 'chain', 'ground', 'beam', 'blink', 'summon', 'curse'].includes(s.fx.type), `${id}: a known effect type`);
    }
    for (const m of Object.keys(DM.MASTERIES)) {
        const list = DM.SKILLS_BY_MASTERY[m];
        ok(list.length === 7, `${m}: seven skills`);
        ok([1, 2, 3, 4].every((t) => list.some((id) => DM.SKILLS[id].tier === t)), `${m}: a skill in every tier`);
        ok(list.filter((id) => DM.SKILLS[id].tier === 4).length === 1, `${m}: one ultimate`);
    }
    ok(new Set(Object.values(DM.SKILLS).map((s) => s.icon)).size === 21, 'every skill has its own icon');
    for (const a of Object.keys(DM.MASTERIES)) for (const b of Object.keys(DM.MASTERIES)) if (a !== b) ok(DM.HYBRIDS[DM.hybridKey(a, b)], `${a} + ${b} is a named hybrid`);
    for (const [id, c] of Object.entries(DM.CLASSES)) ok(DM.MASTERIES[c.mastery] && DI.BASES[c.weapon], `${id}: mastery and weapon exist`);
    for (const [id, l] of Object.entries(DI.LEGENDARIES)) ok(DI.BASES[l.base] && l.power && l.text, `${id}: base and power`);
    for (const [id, s] of Object.entries(DI.SETS)) ok(s.pieces.length === 4 && s.names.length === 4 && s.bonus[2] && s.bonus[4], `${id}: four pieces and two bonuses`);
    for (const [k, a] of Object.entries(DI.AFFIXES)) ok(a.lo <= a.hi && a.text.includes('{') && (a.slots === 'any' || a.slots.length), `affix ${k} is well formed`);
    for (const [id, m] of Object.entries(DMo.MONSTERS)) ok(['melee', 'ranged', 'caster', 'charger'].includes(m.ai) && m.hp > 0 && m.dmg > 0 && m.model && m.art, `${id}: ai, stats, model, art`);
    for (const [id, b] of Object.entries(DMo.BOSSES)) {
        ok(b.abilities.length >= 3 && b.taunt.length >= 2, `${id}: abilities and taunts`);
        ok(Object.values(DW.AREAS).some((a) => a.boss === id), `${id}: has an area`);
    }
    for (const id of DW.CAMPAIGN) ok(DW.AREAS[id].next && (DW.AREAS[DW.AREAS[id].next] || DW.AREAS[id].next === 'town'), `${id}: leads somewhere`);
    for (const id of DW.CAMPAIGN) ok(DW.LORE[id].length >= 2, `${id}: has lore`);
    ok(DW.QUESTS.length === DW.CAMPAIGN.length + 1, 'a quest line for every area and the rifts');
    // every model and every clip the data asks for exists
    const models = new Set(fs.readdirSync(path.join(ROOT, 'assets/models')).map((f) => f.replace('.glb', '')));
    for (const m of [...Object.values(DMo.MONSTERS), ...Object.values(DMo.BOSSES), ...Object.values(DM.CLASSES), ...Object.values(DW.NPCS)]) ok(models.has(m.model), `model ${m.model} exists`);
    const { MODEL_FILES } = await import('../js/model-files.js');
    ok([...models].every((m) => MODEL_FILES.has(m)) && MODEL_FILES.size === models.size, 'js/model-files.js lists exactly the models on disk');
}

// ======================================================================================================== world
if (want('world')) {
    section('world');
    for (const kind of ['wilds', 'rooms']) {
        let proved = 0, spawns = 0;
        for (let s = 1; s <= 60; s++) {
            const A = W.generateArea(kind, s * 1009, 64, 64, { boss: kind === 'rooms' });
            if (W.proveArea(A)) proved++;
            spawns += A.spawns.length;
            if (s <= 10) { const d = W.flow(A, Math.floor(A.start.x), Math.floor(A.start.y)); ok(d[Math.floor(A.exit.y) * A.w + Math.floor(A.exit.x)] >= 25, `${kind} seed ${s}: the exit is at least 25 steps' walk from the start`); }
        }
        ok(proved === 60, `${kind}: 60 of 60 seeds proved reachable (start → exit, waystone, every spawn, lore)`);
        ok(spawns / 60 > 25, `${kind}: enough spawn points (${(spawns / 60).toFixed(0)} a level)`);
    }
    // the real areas the game builds, entered as the game enters them
    const G = Gm.newGame(11, 'ironsworn');
    for (const id of [...DW.CAMPAIGN, 'town']) {
        Ar.enterArea(G, id, 'start');
        ok(W.proveArea(G.area) || id === 'town', `${id}: proved`);
        ok(W.fits(G.area, G.player.x, G.player.y, C.PLAYER.radius), `${id}: the player starts on open floor`);
        ok(G.mons.every((m) => W.fits(G.area, m.x, m.y, m.radius * 0.8)), `${id}: every monster stands on floor`);
        if (id !== 'town') ok(G.mons.length > 40, `${id}: populated (${G.mons.length} monsters)`);
        if (DW.AREAS[id].boss) ok(G.mons.some((m) => m.boss === DW.AREAS[id].boss), `${id}: its boss is there`);
    }
}

// ======================================================================================================== rules
if (want('rules')) {
    section('rules');
    {
        const G = Gm.newGame(1, 'ironsworn');
        const P = G.player;
        ok(G.area.id === 'town' && P.life === P.stats.maxLife, 'a new warden starts in town at full life');
        ok(G.items[P.equip.weapon]?.base === 'sword' && P.slots[0] === 'cleave' && P.ranks.cleave === 1, 'with the class weapon and its primary skill slotted');
        ok(G.events.some((e) => e.type === 'card' && e.id === 'intro'), 'and the intro card');
        Gm.act(G, { t: 'enter', id: 'gate' });
        ok(G.area.id === 'wilds' && G.events.some((e) => e.type === 'card' && e.id === 'act1'), 'the gate leads to the Wilds and Act I begins');
        const ws = G.features.find((f) => f.kind === 'waystone');
        P.x = ws.x; P.y = ws.y + 0.8;
        Gm.step(G, input(), DT);
        ok(P.waystones.includes('wilds') && G.events.some((e) => e.type === 'waystone'), 'touching a waystone remembers it');
        Gm.act(G, { t: 'travel', area: 'town' });
        ok(G.area.id === 'town', 'a waystone takes you to town');
        const tws = G.features.find((f) => f.kind === 'waystone'); P.x = tws.x; P.y = tws.y + 1;
        Gm.act(G, { t: 'travel', area: 'wilds' });
        ok(G.area.id === 'wilds' && Math.hypot(P.x - G.area.waystone.x, P.y - G.area.waystone.y) < 2, 'and back to the waystone you found');
        ok(Gm.act(G, { t: 'travel', area: 'vault' }) !== '', 'but not to one you haven\'t found');
    }
    {   // damage: armour and resists
        const G = arena();
        const P = G.player, m = mon(G, 'wretch', 1, 0);
        P.life = P.stats.maxLife = 1000;
        const before = P.life;
        Cb.hurtPlayer(G, 100, 'phys', 5, m);
        const plain = before - P.life;
        P.stats.armorTotal = 250; P.life = 1000;
        Cb.hurtPlayer(G, 100, 'phys', 5, m);
        ok(1000 - P.life < plain && Math.abs((1000 - P.life) - 100 * (1 - 250 / (250 + 50 * 5))) <= 1, 'armour reduces a hit by armour / (armour + 50 × level)');
        P.stats.armorTotal = 0; P.stats.res = 75; P.life = 1000;
        Cb.hurtPlayer(G, 100, 'fire', 5, m);
        ok(1000 - P.life === 25, 'resist reduces elemental damage, capped at 75%');
    }
    {   // crits and stagger
        const G = arena();
        const P = G.player;
        P.stats.critPct = 100; P.stats.critDmgPct = 100;
        const m = mon(G, 'sentinel', 2, 0, 5);
        m.life = m.max = 1e6;
        const d = Cb.hitMonster(G, m, 100, { el: 'phys' });
        ok(G.events.some((e) => e.type === 'hit' && e.crit), 'a crit is flagged');
        P.stats.critPct = 0;
        const d2 = Cb.hitMonster(G, m, 100, { el: 'phys', noCrit: true });
        ok(Math.abs(d / d2 - 2) < 0.05, 'and deals 1 + crit damage % more');
        const small = mon(G, 'wretch', -2, 0, 5);
        Cb.hitMonster(G, small, small.max * 0.3, { noCrit: true });
        ok(small.state === 'stagger' || small.life <= 0, 'a big hit staggers a small monster');
        const boss = mon(G, null, 3, 3, 9, { boss: 'skyllith' });
        Cb.hitMonster(G, boss, boss.max * 0.1, { noCrit: true });
        ok(boss.state !== 'stagger', 'but not a boss (poise)');
    }
    {   // kills, experience, levels, points
        const G = arena();
        const P = G.player;
        const m = mon(G, 'wretch', 1, 0, 3);
        P.res.essence = 0;
        Cb.hitMonster(G, m, 1e6, { noCrit: true });
        ok(m.life <= 0 && G.events.some((e) => e.type === 'kill') && P.xp > 0, 'a kill gives experience');
        ok(P.potion.kills === 1, 'and counts toward the next potion charge');
        Cb.gainXp(G, C.xpToNext(1) + C.xpToNext(2));
        ok(P.level === 3 && P.unspent.skill === 1 + 2 * C.SKILL_POINTS_PER_LEVEL && P.unspent.attr === 2 * C.ATTR_POINTS_PER_LEVEL, 'levelling gives skill and attribute points');
        ok(Gm.act(G, { t: 'learnSkill', id: 'warcry' }).includes('rank 4'), 'a tier-2 skill needs mastery rank 4');
        ok(Gm.act(G, { t: 'learnSkill', id: 'chain' }) === 'not your mastery', 'another mastery\'s skill needs that oath');
        const life0 = P.stats.maxLife;
        Gm.act(G, { t: 'attr', k: 'vitality' });
        ok(P.stats.maxLife === life0 + C.PLAYER.lifePerVit, 'a point of Vitality gives life');
        Gm.act(G, { t: 'learnBar', m: 'warfare' });
        ok(P.bar.warfare === 2 && P.stats.maxLife > life0 + C.PLAYER.lifePerVit, 'a Warfare mastery rank gives life');
        ok(Gm.act(G, { t: 'pickMastery', m: 'storm' }) !== '', 'no second oath before level 6');
        Cb.gainXp(G, 1e6);
        ok(Gm.act(G, { t: 'pickMastery', m: 'storm' }) === '' && P.synergy === 'galvanic', 'at 6 a second oath: Warfare + Storm is the Thunderborn');
        ok(Gm.act(G, { t: 'pickMastery', m: 'umbra' }) !== '', 'and only two');
        ok(P.level <= C.LEVEL_CAP, 'levels stop at the cap');
    }
    {   // potion
        const G = arena();
        const P = G.player;
        P.life = 10;
        run(G, input({ potion: true }), 0.02);
        ok(P.potion.charges === C.POTION.charges - 1 && P.potion.cd > 0, 'a potion uses a charge and starts its cooldown');
        run(G, input(), 1.2);
        ok(P.life > 10 + P.stats.maxLife * 0.35, 'and heals 40% over a second');
        const ch = P.potion.charges;
        run(G, input({ potion: true }), DT * 2);
        ok(P.potion.charges === ch, 'it can\'t be drunk again during the cooldown');
    }
    {   // portal: cast, interrupt, snapshot and return
        const G = arena();
        const P = G.player;
        const m = mon(G, 'wretch', 6, 0, 3);
        m.aggro = false;
        const dead = mon(G, 'wretch', -6, 0, 3); Cb.hitMonster(G, dead, 1e6, { noCrit: true });
        run(G, input({ portal: true }), DT);
        ok(P.portalCast > 0, 'the portal channels');
        Cb.hurtPlayer(G, 1, 'phys', 1, m);
        ok(P.portalCast === 0, 'a hit interrupts it');
        const x = P.x, y = P.y, area = G.area.id, n = living(G).length;
        run(G, input({ portal: true }), C.PORTAL.cast + 0.1);
        ok(G.area.id === 'town' && G.features.some((f) => f.kind === 'portal'), 'a finished cast takes you to town, with a door back');
        const door = G.features.find((f) => f.kind === 'portal');
        P.x = door.x; P.y = door.y;
        Gm.step(G, input(), DT);
        ok(G.area.id === area && Math.hypot(P.x - x, P.y - y) < 0.01 && living(G).length === n, 'the door returns you to the same spot, with the dead still dead');
    }
    {   // death
        const G = arena();
        const P = G.player;
        P.gold = 1000;
        const m = mon(G, 'wretch', 1, 0, 3);
        Cb.hurtPlayer(G, 1e6, 'phys', 1, m);
        ok(G.mode === 'dead' && P.gold === 900, 'dying costs 10% of carried gold');
        run(G, input(), C.PLAYER.respawn + 0.1);
        ok(G.mode === 'play' && G.area.id === 'town' && P.life === P.stats.maxLife, 'and you wake in town at full life (no waystone here)');
        Ar.enterArea(G, 'temple', 'start');
        P.waystones.push('temple');
        Cb.hurtPlayer(G, 1e6, 'phys', 1, null);
        run(G, input(), C.PLAYER.respawn + 0.1);
        ok(G.area.id === 'temple' && Math.hypot(P.x - G.area.waystone.x, P.y - G.area.waystone.y) < 2, 'or at this area\'s waystone if you found it');
    }
    {   // pickup, filter, bags
        const G = arena();
        const P = G.player;
        const it = L.rollItem(G, 5, { rarity: 'magic' }); G.items[it.id] = it;
        G.drops.push({ id: G.nextId++, item: it.id, x: P.x, y: P.y });
        Gm.act(G, { t: 'filter', level: 'rare' });
        Gm.step(G, input(), DT);
        ok(G.drops.length === 1, 'with the filter on Rare+, walking over a magic item leaves it');
        Gm.act(G, { t: 'pickup', id: G.drops[0].id });
        ok(P.bag.includes(it.id), 'but it can still be picked up on purpose');
        Gm.act(G, { t: 'filter', level: 'all' });
        G.drops.push({ id: G.nextId++, gold: 50, x: P.x, y: P.y });
        Gm.step(G, input(), DT);
        ok(P.gold >= 50, 'gold is picked up by walking over it');
        P.bag.fill(999);
        G.pet.state = 'follow';
        const it2 = L.rollItem(G, 5, { rarity: 'rare' }); G.items[it2.id] = it2;
        G.drops.push({ id: G.nextId++, item: it2.id, x: P.x, y: P.y });
        Gm.step(G, input(), DT);
        ok(G.pet.bag.includes(it2.id), 'with your bag full, loot goes into Ember\'s pack');
    }
    {   // pet: town trip, downed, spells
        const G = arena();
        const P = G.player;
        G.pet.state = 'follow'; G.pet.t = 0;
        for (let k = 0; k < 3; k++) { const it = L.rollItem(G, 5, { rarity: 'rare' }); G.items[it.id] = it; G.pet.bag[k] = it.id; }
        P.potion.charges = 0;
        const g0 = P.gold;
        Gm.act(G, { t: 'petTown' });
        ok(G.pet.state === 'away' && G.pet.bag.every((x) => !x), 'Ember goes to town with the pack');
        run(G, input(), C.PET.townTrip + 0.1);
        ok(G.pet.state === 'follow' && P.gold > g0 && P.potion.charges === C.POTION.charges, 'and comes back with the gold and full potions');
        G.pet.life = 0;
        run(G, input(), DT * 2);
        ok(G.pet.state === 'down', 'at 0 life Ember is downed, not dead');
        run(G, input(), C.PET.downTime + 0.1);
        ok(G.pet.state === 'follow' && G.pet.life > 0, 'and gets up again');
        P.level = C.PET.mendLevel; St.recompute(G); P.life = P.stats.maxLife * 0.3; G.pet.mend = 0;
        mon(G, 'wretch', 6, 0, 1);
        run(G, input(), DT * 3);
        ok(G.events.some((e) => e.type === 'petSpell' && e.spell === 'mend'), 'Mend heals you when you drop under half life');
        const m = mon(G, 'wretch', 1.5, 0, 1);
        G.pet.x = P.x + 1; G.pet.y = P.y;
        run(G, input(), 3);
        ok(m.life < m.max, 'Ember fights what\'s near you');
    }
    {   // monsters: aggro, telegraph, ranged shoots
        const G = arena();
        const P = G.player;
        const s = mon(G, 'sentinel', 1.6, 0, 5);
        for (let t = 0; t < 3 && !G.zones.some((z) => z.from === 'mon'); t += DT) Gm.step(G, input({ stand: true }), DT);
        ok(G.zones.some((z) => z.from === 'mon'), 'a Bronze Sentinel telegraphs its slam with a ring');
        const z = G.zones.find((q) => q.from === 'mon');
        P.x -= 4;
        const l0 = P.life;
        run(G, input({ stand: true }), z.t + 0.05);
        ok(P.life === l0 || G.mons.some((m) => m.kind === 'sentinel' && Math.hypot(m.x - P.x, m.y - P.y) < 2.5), 'stepping out of the ring avoids the slam');
        const G2 = arena();
        mon(G2, 'archer', 7, 0, 5);
        run(G2, input({ stand: true }), 3);
        ok(G2.events.some((e) => e.type === 'monShoot') || G2.shots.some((b) => b.from === 'mon'), 'a Crypt Archer shoots from range');
    }
    {   // bosses, the campaign's end, rifts
        const G = arena('ironsworn', 3, 'temple');
        const boss = mon(G, null, 4, 0, 9, { boss: 'skyllith' });
        const ex = G.features.find((f) => f.kind === 'exit');
        ok(ex.locked, 'the temple\'s way on is sealed while Skyllith lives');
        Cb.hitMonster(G, boss, boss.max * 0.6, { noCrit: true });
        run(G, input({ stand: true }), C.MON.staggerTime + 0.1);      // a hit that big staggers it first
        ok(G.events.some((e) => e.type === 'bossPhase'), 'a boss changes phase at its threshold');
        Cb.hitMonster(G, boss, 1e9, { noCrit: true });
        run(G, input({ stand: true }), DT);
        ok(!ex.locked && G.player.bossesKilled.includes('skyllith'), 'killing it opens the way');
        ok(G.drops.filter((d) => d.item).length >= C.ITEM.bossDrops[0], 'and it drops a pile of loot');
        const G3 = arena('stormcaller', 4, 'vault');
        const k = mon(G3, null, 4, 0, 27, { boss: 'kolossar' });
        ok(Gm.act(G3, { t: 'riftOpen', tier: 1 }) !== '', 'no rifts before Kolossar');
        Cb.hitMonster(G3, k, 1e9, { noCrit: true });
        run(G3, input({ stand: true }), DT);
        ok(G3.won && G3.events.some((e) => e.type === 'card' && e.id === 'victory'), 'binding Kolossar wins the campaign');
        Ar.enterArea(G3, 'town', 'start');
        ok(!G3.features.find((f) => f.kind === 'obelisk').locked, 'and unlocks the rift obelisk');
        ok(Gm.act(G3, { t: 'riftOpen', tier: 5 }) === '' && G3.rift.tier === 1, 'rift tiers open one at a time');
        ok(G3.rift.need <= G3.mons.length * 2 && G3.rift.mods.length >= 1, 'a rift has modifiers and a bar it can fill');
        G3.rift.progress = G3.rift.need;
        G3.mode = 'play';
        run(G3, input({ stand: true }), DT);
        ok(G3.mons.some((m) => m.guardian), 'a full bar brings the Rift Guardian');
        const gd = G3.mons.find((m) => m.guardian);
        Cb.hitMonster(G3, gd, 1e9, { noCrit: true });
        run(G3, input({ stand: true }), DT);
        ok(G3.player.riftBest === 1 && G3.features.some((f) => f.kind === 'exit' && f.rift), 'killing it clears the tier and opens a way home');
        G3.rift.tier = 4; G3.rift.mods = [];
        const deep = Mo.makeMonster(G3, 'thrall', 0, 0, 30).max;
        G3.rift = null;
        ok(deep > Mo.makeMonster(G3, 'thrall', 0, 0, 30).max, 'tier-4 rift monsters are tougher than campaign ones of the same level');
    }
}

// ======================================================================================================== skills
if (want('skills')) {
    section('skills');
    // every active skill, at rank 1, in an arena with a pack in front
    for (const [id, S] of Object.entries(DM.SKILLS)) {
        if (S.kind !== 'active') continue;
        const cls = { warfare: 'ironsworn', storm: 'stormcaller', umbra: 'shadebinder' }[S.mastery];
        const G = arena(cls, 21);
        learn(G, id, 1);
        const P = G.player;
        const pack = [mon(G, 'wretch', 1.6, 0, 4), mon(G, 'wretch', 2.2, 0.8, 4), mon(G, 'wretch', 2.2, -0.8, 4)];
        for (const m of pack) { m.life = m.max = 1e5; m.cd = 99; }
        const aim = { x: pack[0].x, y: pack[0].y };
        const why = Sk.useSkill(G, id, aim);
        ok(why === '', `${id}: can be used (${why || 'ok'})`);
        const buffNow = P.buffs.length > 0 || pack.some((m) => m.taunt > 0 || m.curse);
        if (S.cd) ok(P.cds[id] > 0, `${id}: goes on cooldown`);
        if (S.channel) { run(G, input({ held: P.slots.map((s) => s === id) }), 1.0); }
        else run(G, input({ stand: true }), 1.5);
        const hurt = pack.some((m) => m.life < m.max);
        const effect = {
            buff: () => buffNow,
            summon: () => G.minions.length > 0,
            blink: () => buffNow,
            curse: () => buffNow,
        }[S.fx.type];
        ok(effect ? effect() : hurt, `${id}: does what it says (${S.fx.type})`);
    }
    // resources
    {
        const G = arena('ironsworn');
        const P = G.player;
        P.res.rage = 0;
        mon(G, 'wretch', 1.4, 0, 3).life = 1e5;
        Sk.useSkill(G, 'cleave', { x: P.x + 1, y: P.y });
        ok(P.res.rage > 5, 'Cleave builds Rage');
        G.mons.length = 0; P.combatT = 0;
        run(G, input({ stand: true }), 5);
        ok(P.res.rage < 5, 'Rage drains away out of combat');
        learn(G, 'wrath'); P.res.rage = 30;
        ok(Sk.useSkill(G, 'wrath', null) === 'not enough rage', 'Giant\'s Wrath needs 50 Rage');
    }
    {   // legendary powers
        const G = arena('stormcaller');
        const P = G.player;
        learn(G, 'thunderstrike');
        const m = mon(G, 'wretch', 3, 0, 4); m.life = m.max = 1e6; m.cd = 99;
        P.stats.powers.thunderThrice = true;
        Sk.useSkill(G, 'thunderstrike', { x: m.x, y: m.y });
        ok(G.zones.filter((z) => z.from === 'player').length === 3, 'Stormcaller\'s Circlet: Thunderstrike falls three times');
        learn(G, 'chain');
        const pack = [];
        for (let k = 0; k < 8; k++) { const q = mon(G, 'wretch', 2 + k * 0.9, (k % 2) * 0.8, 4); q.life = q.max = 1e6; q.cd = 99; pack.push(q); }
        G.events.length = 0;
        P.stats.powers.chainMore = false;
        Sk.useSkill(G, 'chain', { x: pack[0].x, y: pack[0].y });
        const plain = G.events.filter((e) => e.type === 'arc').length;
        G.events.length = 0; P.busy = 0; P.res.mana = 999;
        P.stats.powers.chainMore = true;
        Sk.useSkill(G, 'chain', { x: pack[0].x, y: pack[0].y });
        ok(G.events.filter((e) => e.type === 'arc').length >= plain + 3, 'Grasp of the Drowned: Chain Lightning jumps three more times');
        const G2 = arena('ironsworn');
        learn(G2, 'leap');
        G2.player.stats.powers.leapFree = true; G2.player.res.rage = 0;
        ok(Sk.useSkill(G2, 'leap', { x: G2.player.x + 3, y: G2.player.y }) === '', 'Giant\'s Tread: Leap Slam costs no Rage');
        const G3 = arena('shadebinder');
        learn(G3, 'shade', 1);
        G3.player.stats.powers.shadeArmy = true;
        for (let k = 0; k < 5; k++) { G3.player.cds.shade = 0; G3.player.busy = 0; G3.player.res.essence = 999; Sk.useSkill(G3, 'shade', null); }
        ok(G3.minions.filter((s) => s.kind === 'shade').length === 4, 'Ossuary Crown: two more Shades at once');
    }
    {   // equipping a legendary and a set turns its power on
        const G = arena('ironsworn');
        const P = G.player;
        const it = L.rollItem(G, 10, { rarity: 'legendary', uniq: 'gianttread' }); G.items[it.id] = it; P.bag[0] = it.id;
        Gm.act(G, { t: 'equip', id: it.id });
        ok(P.stats.powers.leapFree, 'equipping a legendary switches its power on');
        let n = 0;
        for (const piece of ['helm', 'chest']) { const s = L.rollItem(G, 10, { rarity: 'set', set: 'asters', base: piece }); G.items[s.id] = s; P.bag[1] = s.id; Gm.act(G, { t: 'equip', id: s.id }); n++; }
        ok(P.stats.setCount.asters === 2 && P.stats.armorPct >= 40, 'two set pieces give the 2-piece bonus');
        ok(!P.stats.powers.bulwark, 'but not the 4-piece power');
    }
    {   // synergies
        const G = arena('ironsworn');
        const P = G.player;
        P.level = 6; Gm.act(G, { t: 'pickMastery', m: 'umbra' });
        ok(P.synergy === 'bloodpact', 'Warfare + Umbra is the Reaver (Blood Pact)');
        P.res.rage = 0; P.res.essence = 0;
        const m = mon(G, 'wretch', 1, 0, 3);
        Cb.hitMonster(G, m, 1e6, { noCrit: true });
        ok(P.res.rage >= 4 && P.res.essence >= 7, 'Blood Pact: a kill gives Rage and Essence');
        const G2 = arena('stormcaller');
        G2.player.level = 6; Gm.act(G2, { t: 'pickMastery', m: 'umbra' });
        learn(G2, 'shade'); Sk.useSkill(G2, 'shade', null);
        const t = mon(G2, 'wretch', 5, 0, 3); t.life = t.max = 1e6; t.cd = 99;
        run(G2, input({ stand: true }), 2.5);
        ok(G2.player.synergy === 'voidcurrent' && G2.events.some((e) => e.type === 'shotEnd' && e.kind === 'spark' && e.from === 'player') || G2.shots.length, 'Void Current: Shades throw Spark Bolts');
    }
}

// ======================================================================================================== loot
if (want('loot')) {
    section('loot');
    const G = arena();
    const counts = {};
    for (let i = 0; i < 4000; i++) { const it = L.rollItem(G, 12); counts[it.rarity] = (counts[it.rarity] || 0) + 1; }
    ok(counts.common > counts.magic && counts.magic > counts.rare && counts.rare > (counts.legendary || 0), `rarer is rarer (${JSON.stringify(counts)})`);
    ok(!counts.mythic, 'no mythics outside deep rifts');
    const mf = {};
    for (let i = 0; i < 4000; i++) { const it = L.rollItem(G, 12, { mf: 200 }); mf[it.rarity] = (mf[it.rarity] || 0) + 1; }
    ok((mf.legendary || 0) + (mf.rare || 0) > (counts.legendary || 0) + (counts.rare || 0), 'magic find raises the share of good drops');
    let deep = 0;
    for (let i = 0; i < 6000; i++) if (L.rollItem(G, 30, { riftTier: 8 }).rarity === 'mythic') deep++;
    ok(deep > 0, `mythics drop in deep rifts (${deep} in 6000)`);
    let inRange = true, slotOk = true, maxAff = true;
    for (let i = 0; i < 3000; i++) {
        const ilvl = 1 + (i % 30), it = L.rollItem(G, ilvl);
        const slot = DI.BASES[it.base].slot;
        const pre = it.affixes.filter((a) => DI.AFFIXES[a.k].pre).length;
        if (pre > 3 || it.affixes.length - pre > 3) maxAff = false;
        for (const a of it.affixes) {
            const A = DI.AFFIXES[a.k], t = A.flat ? 1 : C.ITEM.tier(ilvl);
            if (a.v < Math.max(1, Math.round(A.lo * t)) - 1 || a.v > Math.round(A.hi * t) + 1) inRange = false;
            if (!(A.slots === 'any' || A.slots.includes(slot) || (A.slots.includes('jewel') && (slot === 'amulet' || slot === 'ring')))) slotOk = false;
        }
    }
    ok(inRange, 'every affix rolls inside [lo, hi] × its item-level tier');
    ok(slotOk, 'affixes only roll where they are allowed');
    ok(maxAff, 'at most three prefixes and three suffixes');
    const leg = L.rollItem(G, 10, { rarity: 'legendary' });
    ok(leg.uniq && DI.LEGENDARIES[leg.uniq].base === leg.base, 'a legendary is its own base with its power');
    const myth = L.rollItem(G, 30, { rarity: 'mythic' });
    ok(myth.affixes.every((a) => a.q === 1) && myth.sockets.length === (DI.MAX_SOCKETS[DI.BASES[myth.base].slot] || 0), 'a mythic has perfect rolls and full sockets');
    // gems and sockets
    const P = G.player;
    const helm = L.rollItem(G, 10, { rarity: 'rare', base: 'helm' }); helm.sockets = [null]; G.items[helm.id] = helm; P.bag[0] = helm.id;
    Gm.act(G, { t: 'equip', id: helm.id });
    const life0 = P.stats.maxLife;
    const gem = L.rollGem(G, 2, 'ruby'); G.items[gem.id] = gem; P.bag[1] = gem.id;
    ok(Gm.act(G, { t: 'socket', item: helm.id, gem: gem.id }) === '' && P.stats.maxLife > life0, 'a Ruby in a helm adds life');
    Ar.enterArea(G, 'town', 'start');
    P.gold = 1e4;
    for (let k = 0; k < 3; k++) { const g = L.rollGem(G, 0, 'topaz'); G.items[g.id] = g; P.bag[2 + k] = g.id; }
    ok(Gm.act(G, { t: 'combine', gem: 'topaz', grade: 0 }) === '' && P.bag.some((id) => id && G.items[id].gem === 'topaz' && G.items[id].grade === 1), 'three Chipped Topazes make a Flawed one');
    const junk = L.rollItem(G, 5, { rarity: 'common' }); G.items[junk.id] = junk; P.bag[10] = junk.id;
    const g0 = P.gold;
    Gm.act(G, { t: 'sellJunk' });
    ok(P.gold > g0 && !P.bag.includes(junk.id), 'Sell all junk sells the commons');
    ok(L.itemPrice(L.rollItem(G, 20, { rarity: 'legendary' })) > L.itemPrice(L.rollItem(G, 20, { rarity: 'magic' })), 'a legendary is worth more than a magic item');
    const g1 = P.gold;
    Gm.act(G, { t: 'gamble', base: 'ring' });
    ok(P.gold < g1 && P.bag.some((id) => id && G.items[id].base === 'ring'), 'gambling buys an unknown ring');
}

// ======================================================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed, 'stormcaller'); const b = Bt.makeBot(); let mt = 0; for (let t = 0; t < secs; t += DT) { if ((mt -= DT) <= 0) { mt = 0.5; Bt.botManage(G, b); } Gm.step(G, Bt.botInput(G, b), DT); G.events.length = 0; } return G; };
    const a = play(42, 90), b = play(42, 90);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game (90 s with the bot)');
    // a round trip mid-fight: both copies play on identically
    const G = play(7, 60);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    let mt = 0;
    for (let t = 0; t < 30; t += DT) {
        if ((mt -= DT) <= 0) { mt = 0.5; Bt.botManage(G, b1); Bt.botManage(copy, b2); }
        Gm.step(G, Bt.botInput(G, b1), DT); Gm.step(copy, Bt.botInput(copy, b2), DT);
        G.events.length = 0; copy.events.length = 0;
    }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-fight plays on identically');
    // and through a portal
    const H = arena('ironsworn', 9);
    mon(H, 'wretch', 5, 0, 3);
    Gm.act(H, { t: 'portal' });
    const H2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(H))));
    ok(H2.area.id === 'town' && H2.portalBack && H2.portalBack.mons.length === 1, 'the portal\'s snapshot survives a save');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(JSON.stringify(Gm.serialize(Gm.newGame(1))).length < 400000, 'a save is a reasonable size');
}

// ======================================================================================================== bot
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const cls of Object.keys(DM.CLASSES)) {
        for (let s = 1; s <= SEEDS; s++) {
            for (const skill of [1, 0.4]) {
                const G = Gm.newGame(s * 31 + 1, cls), bot = Bt.makeBot({ skill, rifts: 3 });
                let t = 0, mt = 0, bad = null;
                const at = {};
                while (t < 3600 && !(G.won && G.player.riftBest >= 3)) {
                    if ((mt -= DT) <= 0) { mt = 0.5; Bt.botManage(G, bot); }
                    Gm.step(G, Bt.botInput(G, bot), DT);
                    t += DT;
                    for (const e of G.events) if (e.type === 'bossDead') at[e.boss] = { t: Math.round(t), lvl: G.player.level };
                    G.events.length = 0;
                    const P = G.player;
                    if (!Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.life)) bad = 'non-finite player';
                    else if (P.life > P.stats.maxLife + 1e-6) bad = 'life above max';
                    else if (G.mode === 'play' && !W.isFloor(G.area, P.x, P.y)) bad = 'player inside a wall';
                    else if (G.mons.some((m) => !Number.isFinite(m.x) || !Number.isFinite(m.life))) bad = 'non-finite monster';
                    else if (Object.values(P.res).some((v) => !Number.isFinite(v) || v < 0)) bad = 'bad resource';
                    if (bad) break;
                }
                const P = G.player;
                ok(!bad, `${cls} seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
                rows.push({ cls, seed: s, skill, won: G.won, t: Math.round(t), lvl: P.level, deaths: G.stats.deaths, kills: G.stats.kills, rift: P.riftBest, gold: P.gold, at, dodge: Math.round(G.stats.dodgeable / Math.max(1, G.stats.taken) * 100) });
            }
        }
    }
    console.log('\n  class        seed skill  won  rift  lvl  deaths  kills  dodge%  Skyllith   Morwen     Kolossar   time');
    for (const r of rows) {
        const b = (k) => (r.at[k] ? `${r.at[k].t}s L${r.at[k].lvl}`.padEnd(10) : '—'.padEnd(10));
        console.log(`  ${r.cls.padEnd(12)} ${String(r.seed).padStart(4)} ${String(r.skill).padStart(5)}  ${r.won ? 'yes' : 'no '}  ${String(r.rift).padStart(4)} ${String(r.lvl).padStart(4)} ${String(r.deaths).padStart(7)} ${String(r.kills).padStart(6)} ${String(r.dodge).padStart(7)}  ${b('skyllith')} ${b('morwen')} ${b('kolossar')} ${r.t}s`);
    }
    const perfect = rows.filter((r) => r.skill === 1), weak = rows.filter((r) => r.skill !== 1);
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    ok(perfect.every((r) => r.won), 'the perfect bot binds Kolossar with every class on every seed');
    ok(perfect.every((r) => r.rift >= 3), 'and clears rift tier 3');
    ok(weak.filter((r) => r.won).length >= weak.length * 0.6, 'a weak bot (skill 0.4) usually finishes too');
    const kl = perfect.map((r) => r.at.kolossar?.lvl || 0);
    ok(med(kl) >= 18 && med(kl) <= 28, `the perfect bot meets Kolossar around level 18–28 (median ${med(kl)})`);
    const kt = perfect.map((r) => r.at.kolossar?.t || 9999);
    ok(med(kt) >= 400 && med(kt) <= 1800, `the campaign takes the perfect bot 400–1800 s of game time (median ${med(kt)} s)`);
    // the skill dial: dodge% is the share of damage taken that came from telegraphs and slow shots. Even the perfect
    // bot takes some (about 44%): a ring that appears while it is locked in a 0.5–0.7 s cast lands before it can move,
    // which is the rule for a human too. The weak bot misses 60% of rings on top of that (about 56%).
    const share = (a) => a.reduce((n, r) => n + r.dodge, 0) / a.length;
    ok(share(weak) > share(perfect) * 1.15, `the weak bot eats more telegraphed damage than the perfect one (${share(weak).toFixed(0)}% vs ${share(perfect).toFixed(0)}% of damage taken)`);
    ok(weak.reduce((n, r) => n + r.deaths, 0) >= perfect.reduce((n, r) => n + r.deaths, 0), 'and dies at least as often');
    ok(med(perfect.map((r) => r.deaths)) <= 6, `the perfect bot rarely dies (median ${med(perfect.map((r) => r.deaths))})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
