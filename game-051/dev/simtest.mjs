/**
 * simtest.mjs — headless checks on the pure simulation (js/sim, js/data, js/core).
 *
 *   node game-051/dev/simtest.mjs            # invariants + distributions + determinism
 *   BOT=1 DAYS=14 node game-051/dev/simtest.mjs   # also: a bot plays N days, prints progress per day
 *
 * Exits non-zero on the first failed assertion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'js');
const T = await import('../js/core/time.js');
let clock = Date.UTC(2026, 9, 1, 8, 0, 0);
T.setNow(() => clock);

const { newState, migrate, heroById, gearLookup, grant } = await import('../js/sim/state.js');
const { generateHero, addXp, maxLevel, RADIANT_CHANCE } = await import('../js/sim/heroes.js');
const { heroStats, heroPower } = await import('../js/sim/stats.js');
const { generateGear, upgrade } = await import('../js/sim/gear.js');
const { summon, HARD_PITY } = await import('../js/sim/summon.js');
const { createBattle, runAuto, nextTurn, act, aiChoose, drainEvents, autoSpell, living } = await import('../js/sim/battle.js');
const C = await import('../js/sim/content.js');
const I = await import('../js/sim/idle.js');
const Mi = await import('../js/sim/mine.js');
const F = await import('../js/sim/farm.js');
const E = await import('../js/sim/expeditions.js');
const Q = await import('../js/sim/quests.js');
const Sh = await import('../js/sim/shop.js');
const A = await import('../js/sim/actions.js');
const O = await import('../js/sim/overlord.js');
const { Rng } = await import('../js/core/rng.js');
const { MAX_LEVEL } = await import('../js/data/core.js');
const { TOTAL_STAGES } = await import('../js/data/world.js');

let passed = 0;
function ok(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exit(1); }
    passed++;
}
const finite = (o) => Object.values(o).every((v) => typeof v !== 'number' || Number.isFinite(v));

// ------------------------------------------------------------ purity
{
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const dir of ['sim', 'data', 'core']) {
        for (const f of walk(path.join(ROOT, dir))) {
            const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
            ok(!/from ['"]three['"]/.test(src), `${f} must not import three.js`);
            ok(!/\b(document|window|localStorage)\b/.test(src), `${f} must not touch the DOM`);
            ok(!/Math\.random/.test(src), `${f} must not call Math.random`);
        }
    }
    console.log('purity ok');
}

// ------------------------------------------------------------ heroes
{
    const grades = {}, races = {}, classes = {};
    let radiant = 0;
    for (let i = 0; i < 3000; i++) {
        const h = generateHero({ seed: 1000 + i, rarity: 1 + (i % 5) });
        ok(h.name && h.name.length >= 2, 'hero has a name');
        ok(h.skills.length >= 2 && h.skills.every((s) => s.n), 'hero has named skills');
        ok(h.look && h.look.skin && h.look.c1, 'hero has a look');
        if (h.nat >= 3) ok(!!h.passive, '3★+ has a passive');
        if (h.nat >= 4) ok(!!h.leader, '4★+ has a leader skill');
        const st = heroStats(h, {});
        ok(finite(st) && st.hp > 0 && st.atk > 0 && st.spd > 50, 'stats finite and positive');
        grades[h.grade] = (grades[h.grade] || 0) + 1;
        races[h.race] = 1; classes[h.cls] = 1;
        if (h.radiant) radiant++;
        // same seed → same hero
        if (i < 50) ok(JSON.stringify(generateHero({ seed: 1000 + i, rarity: 1 + (i % 5) })) === JSON.stringify(h), 'generation is deterministic');
    }
    ok(Object.keys(races).length === 10 && Object.keys(classes).length === 12, 'all races and classes appear');
    ok(Math.abs(radiant / 3000 - RADIANT_CHANCE) < 0.012, `radiant rate ~2% (got ${(radiant / 30).toFixed(1)}%)`);
    // max-level stats grow with stars
    const h = generateHero({ seed: 7, rarity: 1 });
    let prev = 0;
    for (let s = 1; s <= 6; s++) {
        h.star = s; h.level = MAX_LEVEL[s];
        const p = heroPower(h);
        ok(p > prev, `power grows with star (${s}★ max = ${p})`);
        h.level = 1;
        ok(heroPower(h) > prev * 0.85, `a fresh evolve keeps most power (${s}★ L1 = ${heroPower(h)})`);
        prev = p;
    }
    console.log('heroes ok — grades', grades, 'radiants', radiant);
}

// ------------------------------------------------------------ summons & pity
{
    const S = newState(99);
    S.res.sigils.mystic = 20000;
    const counts = [0, 0, 0, 0, 0, 0];
    let since = 0, maxSince = 0;
    const out = summon(S, 'mystic', 20000);
    for (const h of out) {
        counts[h.nat]++;
        since = h.nat === 5 ? 0 : since + 1;
        maxSince = Math.max(maxSince, since);
    }
    ok(maxSince < HARD_PITY, `hard pity holds (longest dry streak ${maxSince})`);
    const five = counts[5] / 20000;
    ok(five > 0.02 && five < 0.05, `effective 5★ rate with soft pity ${(five * 100).toFixed(2)}%`);
    ok(counts[1] === 0 && counts[2] === 0, 'mystic never gives 1–2★');
    const S2 = newState(5);
    S2.res.sigils.common = 5000;
    const c2 = [0, 0, 0, 0, 0, 0];
    for (const h of summon(S2, 'common', 5000)) c2[h.nat]++;
    ok(c2[1] > 2500 && c2[2] > 1500, 'common sigils are mostly 1–2★');
    // ten-pull guarantee
    const S3 = newState(17); S3.summon.first = false; S3.res.sigils.mystic = 1000;
    for (let i = 0; i < 100; i++) ok(summon(S3, 'mystic', 10).some((h) => h.nat >= 4), 'ten-pull has a 4★+');
    console.log('summons ok — mystic', counts.slice(3), `5★ ${(five * 100).toFixed(2)}%`, 'common', c2.slice(1));
}

// ------------------------------------------------------------ gear
{
    const rng = new Rng(3);
    let fifteen = 0;
    for (let i = 0; i < 2000; i++) {
        const g = generateGear(rng, { tier: 1 + (i % 6) });
        ok(g.subs.length <= 4 && !g.subs.some((s) => s.s === g.main), 'subs valid');
        for (let k = 0; k < 40 && g.level < 15; k++) upgrade(rng, g);
        if (g.level === 15) fifteen++;
        ok(g.subs.length <= 4 && new Set(g.subs.map((s) => s.s)).size === g.subs.length, 'no duplicate subs after upgrades');
        ok(g.subs.every((s) => Number.isFinite(s.v) && s.v > 0), 'sub values finite');
    }
    ok(fifteen > 100, `some gear reaches +15 within 40 tries (${fifteen})`);
    console.log('gear ok');
}

// ------------------------------------------------------------ battles
function team(S, n, rarity, star, level) {
    const ids = [];
    for (let i = 0; i < n; i++) {
        const h = generateHero({ seed: 500 + i * 13 + rarity, rarity });
        h.star = star; h.level = level;
        S.heroes.push({ ...h, id: S.nextHeroId++ });
        ids.push(S.nextHeroId - 1);
    }
    return ids;
}
{
    const S = newState(1);
    const ids = team(S, 5, 4, 4, 20);
    let wins = 0, maxTurns = 0;
    for (let idx = 0; idx < TOTAL_STAGES; idx += 3) {
        S.counters.battles = idx;
        const cfg = C.buildBattle(S, 'campaign', { idx }, ids);
        const B = createBattle(cfg);
        for (let step = 0; step < 5000 && !B.over; step++) {
            autoSpell(B);
            const { unit, skip } = nextTurn(B);
            if (!skip && unit) act(B, unit, ...aiChoose(B, unit));
            for (const e of drainEvents(B)) {
                if (e.t === 'dmg' || e.t === 'heal') ok(Number.isFinite(e.v) && e.v >= 0 && Number.isFinite(e.hp), `event numbers finite (${JSON.stringify(e)})`);
            }
            for (const u of B.units.values()) ok(Number.isFinite(u.hp) && u.hp >= 0 && u.hp <= u.maxHp + 1e-6, 'hp in range');
        }
        ok(B.over, 'battle ends');
        if (B.win) wins++;
        maxTurns = Math.max(maxTurns, B.turn);
        // determinism
        const B2 = createBattle(C.buildBattle(S, 'campaign', { idx }, ids));
        runAuto(B2);
        const B3 = createBattle(C.buildBattle(S, 'campaign', { idx }, ids));
        runAuto(B3);
        ok(B2.win === B3.win && B2.turn === B3.turn, 'same seed → same battle');
    }
    // spire and arena configs build and finish
    for (const f of [1, 5, 10, 33, 60, 75, 120]) { const B = createBattle(C.buildBattle(S, 'spire', { floor: f }, ids)); runAuto(B); ok(B.over, `spire ${f} ends`); }
    C.ensureRivals(S);
    for (let r = 0; r < 5; r++) { const B = createBattle(C.buildBattle(S, 'arena', { rival: r }, ids)); runAuto(B); ok(B.over, 'arena ends'); }
    for (const id of ['fire', 'gold', 'gear']) for (let t = 1; t <= 10; t++) { const B = createBattle(C.buildBattle(S, 'rift', { id, tier: t }, ids)); runAuto(B); ok(B.over, 'rift ends'); }
    console.log(`battles ok — 4★ L20 team won ${wins} sampled stages, longest ${maxTurns} turns`);
}

// ------------------------------------------------------------ idle systems + save round-trip
{
    const S = newState(77);
    clock += 5 * 60 * 60 * 1000;
    const p = I.treasuryPending(S);
    ok(p.gold > 0 && p.mins > 299, 'treasury accrues');
    const got = I.collectTreasury(S);
    ok(got && got.length, 'treasury collects');
    ok(I.treasuryPending(S).mins < 1, 'treasury resets');
    // mine: dig straight down a column until the layer can be descended
    S.mine.energy = 500;
    let strikes = 0;
    for (let r = 0; r < Mi.MINE_H; r++) {
        let c = 3;
        const g = Mi.ensureGrid(S);
        if (g[r][c].k === 'bedrock') c = [2, 4, 1, 5, 0, 6].find((x) => g[r][x].k !== 'bedrock' && (r === 0 || g[r - 1][x].open)) ?? c;
        for (let k = 0; k < 20 && !g[r][c].open; k++) {
            const res = Mi.strike(S, r, c);
            if (!res.ok) { // dig sideways to reach the column
                for (let x = 0; x < Mi.MINE_W && !g[r][c].open; x++) if (Mi.canHit(S, r, x)) Mi.strike(S, r, x);
            }
            strikes++;
        }
    }
    ok(Mi.canDescend(S) || S.mine.grid.some((row) => row.some((c) => c.open)), 'mine is diggable');
    // farm
    F.ensurePlots(S);
    ok(F.plant(S, 0, 'wheat'), 'plant');
    ok(F.water(S, 0), 'water');
    ok(!F.water(S, 0), 'only once per stage');
    clock += 6 * 60 * 1000;
    ok(F.harvest(S, 0), 'harvest after growth');
    // expeditions
    summon(S, 'mystic', 3);
    E.refreshBoard(S);
    const ex = S.expeditions.board[0];
    ok(E.sendExpedition(S, ex.id, [S.heroes[0].id]), 'send expedition');
    clock += ex.mins * 60 * 1000 + 1000;
    const res = E.claimExpedition(S, ex.id);
    ok(res && res.story, 'expedition resolves with a story');
    // quests
    Q.ensureQuests(S);
    ok(S.quests.daily.length === Q.DAILY_COUNT, 'dailies assigned');
    // shop / wheel
    Sh.ensureShop(S);
    ok(S.shop.stock.length === 6, 'shop stocked');
    ok(Sh.spinWheel(S), 'free wheel spin');
    // save round trip
    const json = JSON.stringify(S);
    const S2 = migrate(JSON.parse(json));
    ok(JSON.stringify(S2) === json, 'save round-trips exactly');
    const old = JSON.parse(json); delete old.wheel; delete old.mine.miners;
    const S3 = migrate(old);
    ok(S3.wheel && Array.isArray(S3.mine.miners), 'migration fills missing keys');
    console.log('idle systems ok');
}

console.log(`\n${passed} assertions passed`);

// ------------------------------------------------------------ progression bot
if (process.env.BOT) {
    const DAYS = +(process.env.DAYS || 14);
    const S = newState(+(process.env.SEED || 2026));
    const HOUR = 3600 * 1000;
    const sessions = +(process.env.SESSIONS || 4);
    const gl = () => gearLookup(S);
    const power = (h) => heroPower(h, { gearOf: gl(), talents: S.overlord.talents });
    let topCache = null;
    const top = (n = 5) => (topCache ||= S.heroes.slice().sort((a, b) => power(b) - power(a))).slice(0, n);
    function fight(mode, params) {
        const ids = top().map((h) => h.id);
        S.teams.main = ids;
        const cost = C.staminaCost(mode, params);
        if (S.res.stamina < cost) return null;
        S.res.stamina -= cost;
        const B = createBattle(C.buildBattle(S, mode, params, ids));
        runAuto(B);
        const allies = B.allies;
        const hpFrac = allies.reduce((s, u) => s + u.hp / u.maxHp, 0) / allies.length;
        C.finishBattle(S, mode, params, ids, { win: B.win, deaths: allies.filter((u) => !u.alive).length, hpFrac });
        return B.win;
    }
    for (let day = 1; day <= DAYS; day++) {
        for (let s = 0; s < sessions; s++) {
            const ph = (n) => { topCache = null; if (process.env.TRACE) console.error('  phase', n); };
            I.tickStamina(S); I.tickTickets(S); I.tickTraining(S);
            I.collectTreasury(S);
            ph('farm');
            // farm
            F.ensurePlots(S);
            F.harvestAll(S);
            S.farm.plots.forEach((p, i) => { if (!p.crop) { const c = ['sunberry', 'pumpkin', 'carrot', 'wheat'].find((x) => S.res.seeds[x] > 0); if (c) F.plant(S, i, c); } });
            for (const r of ['stew', 'snack', 'tart']) while (F.canCook(S, r)) F.cook(S, r);
            ph('mine');
            // mine
            Mi.tickEnergy(S);
            for (let k = 0; k < 200 && S.mine.energy > 0; k++) {
                const g = Mi.ensureGrid(S);
                let did = false;
                for (let r = 0; r < Mi.MINE_H && !did; r++) for (let c = 0; c < Mi.MINE_W && !did; c++) if (Mi.canHit(S, r, c)) { Mi.strike(S, r, c); did = true; }
                if (Mi.canDescend(S)) Mi.descend(S);
                if (!did) break;
            }
            ph('summons');
            // summons
            for (const sg of ['legend', 'ld', 'mystic', 'common']) while (S.res.sigils[sg] > 0) summon(S, sg, 1);
            while (S.res.gems >= 900) summon(S, 'mystic', 10, 'gems');
            while (S.res.shards >= 50) { S.res.shards -= 50; S.res.sigils.mystic++; }
            ph('heroes: level');
            // heroes: level the top team, evolve when possible
            for (const h of top()) A.autoLevel(S, h.id);
            // evolve anything maxed (top heroes first), feeding the weakest same-star heroes
            for (const h of S.heroes.slice().sort((a, b) => power(b) - power(a))) {
                if (!heroById(S, h.id) || h.level < maxLevel(h) || h.star >= 6) continue;
                const need = A.evolveHero.length && (h.star === 5 ? 4 : h.star === 4 ? 3 : h.star);
                const fod = S.heroes.filter((f) => f.id !== h.id && f.star === h.star && !top().includes(f) && A.fodderOk(S, f)).sort((a, b) => power(a) - power(b)).slice(0, need);
                if (fod.length === need) { A.evolveHero(S, h.id, fod.map((f) => f.id)); topCache = null; }
            }
            ph('feed low');
            // feed low heroes to the trainer so fodder grows
            const fodder = S.heroes.filter((h) => !top().includes(h) && h.level < maxLevel(h) && A.fodderOk(S, h)).sort((a, b) => b.star - a.star || b.level - a.level);
            for (let i = 0; i < I.trainingSlots(S); i++) if (!S.training.slots[i] && fodder[i]) I.setTrainee(S, i, fodder[i].id);
            S.training.slots = S.training.slots.filter((sl) => { const h = heroById(S, sl.heroId); return h && h.level < maxLevel(h); });
            for (const h of top()) { A.autoEquip(S, h.id); if (!h.awake) A.awakenHero(S, h.id); }
            ph('enhance');
            // enhance equipped gear with spare gold
            for (const h of top()) for (const gid of Object.values(h.gear)) { const g = S.gear.find((x) => x.id === gid); while (g && g.level < 12 && S.res.gold > 40000) A.enhance(S, gid); }
            ph('talents');
            // talents
            while (O.talentPoints(S) > 0) O.raiseTalent(S, ['might', 'fortitude', 'celerity', 'bastion', 'fortune', 'sovereignty'][S.overlord.level % 6]) || O.raiseTalent(S, 'might') || O.raiseTalent(S, 'fortitude') || O.raiseTalent(S, 'bastion') || O.raiseTalent(S, 'celerity') || O.raiseTalent(S, 'fortune') || O.raiseTalent(S, 'sovereignty') || (S.overlord.level = S.overlord.level);
            ph('buildings');
            // buildings
            for (const b of ['treasury', 'training', 'mine', 'farm', 'forge', 'tavern']) if (S.res.gold > 60000) I.upgradeBuilding(S, b);
            ph('campaign push');
            // campaign push, then farm the best stage with leftovers
            let fails = 0;
            while (S.campaign.cleared < TOTAL_STAGES && fails < 2) { const w = fight('campaign', { idx: S.campaign.cleared }); if (w === null) break; if (!w) fails++; }
            ph('spire');
            // spire
            for (let k = 0; k < 6; k++) { if (S.spire.offer) { S.spire.blessings.push(S.spire.offer[0]); S.spire.offer = null; } if (!fight('spire', { floor: S.spire.floor })) break; }
            ph('rifts');
            // rifts
            for (const id of ['fire', 'water', 'wind', 'gear']) { const t = Math.min(10, (S.rifts.best[id] || 0) + 1); if (C.isRiftUnlocked(S, id, t)) fight('rift', { id, tier: t }); }
            while (S.res.stamina >= 8 && S.campaign.cleared > 0) if (fight('campaign', { idx: S.campaign.cleared - 1 }) === null) break;
            ph('arena');
            // arena
            C.ensureRivals(S);
            while (S.arena.tickets > 0) { S.arena.tickets--; const r = S.arena.rivals.findIndex((x) => !x.beaten); fight('arena', { rival: Math.max(0, r) }); }
            ph('expeditions');
            // expeditions
            E.refreshBoard(S);
            for (const a of S.expeditions.active.slice()) E.claimExpedition(S, a.id);
            const free = S.heroes.filter((h) => !I.heroBusy(S, h.id) && !top().includes(h));
            while (S.expeditions.active.length < E.expeditionSlots(S) && S.expeditions.board.length && free.length) E.sendExpedition(S, S.expeditions.board[0].id, free.splice(0, 3).map((h) => h.id));
            ph('quests');
            // quests
            Q.ensureQuests(S);
            S.quests.daily.forEach((q, i) => Q.claimQuest(S, i));
            S.quests.weekly.forEach((q, i) => Q.claimQuest(S, i, true));
            for (let i = 0; i < 3; i++) { Q.claimChest(S, i); Q.claimChest(S, i, true); }
            while (Q.claimMain(S)) { /* claim all */ }
            for (const a of Q.ACHIEVEMENTS) Q.claimAchievement(S, a.id);
            if (Sh.freeSpinAvailable(S)) Sh.spinWheel(S);
            clock += (24 / sessions) * HOUR;
        }
        const t5 = top();
        console.log(`day ${String(day).padStart(2)}: stage ${C.stageInfo(Math.min(63, S.campaign.cleared)).label.padEnd(4)} (${S.campaign.cleared}/${TOTAL_STAGES})  spire ${String(S.spire.best).padStart(3)}  OL ${String(S.overlord.level).padStart(2)}  team ${t5.map((h) => `${h.star}★${h.level}${h.awake ? 'A' : ''}`).join(' ')}  heroes ${S.heroes.length}  gold ${Math.round(S.res.gold / 1000)}k  gems ${S.res.gems}  arena ${S.arena.points}  mine d${S.mine.depth}`);
    }
}
