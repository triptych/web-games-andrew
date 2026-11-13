/**
 * simtest.mjs — headless checks of Lanternhall's simulation. No browser.
 *
 *   node game-133/dev/simtest.mjs
 *   ONLY=purity,scripts,rules,petitions,minigames,determinism,endings,bot node game-133/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-133/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock.
 * scripts      every scene: known directives and speakers, labels exist and are unique, every backdrop, picture,
 *              tune and sound is listed; four heart events for each of five romances; sixteen endings.
 * rules        grading, fees, assigning, reports, experience and rank-ups, visits and hearts, reviews, upgrades,
 *              the till, the debt, the raid, the vote.
 * petitions    2,000 petitions: the words alone give the true rank (the Handbook is sufficient).
 * minigames    route maps are always solvable within budget; stamp, brew, dice and spar rules.
 * determinism  same seed and commands, same game; a save round trip mid-game plays on identically.
 * endings      each of the sixteen endings is reached by its route through real play; rule order holds.
 * bot          whole games at three skills with per-command invariants, and the balance table with asserted bands.
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
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ru = await import('../js/sim/rules.js');
const Sc = await import('../js/sim/scene.js');
const Mg = await import('../js/sim/minigames.js');
const Pt = await import('../js/sim/petition.js');
const { ALL_SCENES, STORY } = await import('../js/sim/scenes.js');
const { CAST, CAST_IDS, PLACES, ROMANCE } = await import('../js/sim/data/cast.js');
const { HEARTS } = await import('../js/sim/data/hearts.js');
const { ENDINGS, EPILOGUES, CGS } = await import('../js/sim/data/endings.js');
const { MUSIC, SFX } = await import('../js/sim/data/media.js');
const { ROSTER } = await import('../js/sim/data/adventurers.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
/** Play scenes to their end, taking the first answer (or the one with a tag). */
const skip = (G, tag) => {
    let n = 0;
    while (G.scene && n++ < 2000) {
        const ch = G.scene.cur.choice;
        if (ch) Gm.act(G, { t: 'choose', i: (ch.find((o) => o.tag === tag) || ch[0]).i }); else Gm.act(G, { t: 'next' });
    }
    return G;
};
const fresh = (seed = 1) => skip(Gm.newGame(seed, { name: 'Wren', gender: 'f' }));
const adv = (G, id) => G.advs.find((a) => a.id === id);

if (want('purity')) {
    section('purity');
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]));
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim')];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.\w|\bwindow\.\w|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '(\.\.\/)+(vn|ui|audio|art|input|save|main)/.test(src), `${f} never imports the UI, audio, art or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('scripts')) {
    section('scripts');
    let lines = 0, choices = 0;
    for (const s of ALL_SCENES) {
        const errs = Sc.lintScript(s.lines, CAST_IDS);
        const labels = s.lines.filter((l) => typeof l === 'string' && l.startsWith('@label '));
        if (new Set(labels).size !== labels.length) errs.push('a label is used twice (a goto would take the first)');
        for (const raw of s.lines) {
            const L = Sc.parseLine(raw);
            if (L.kind === 'say') { lines++; if (/\{(?!name|lass|miss|partner|they|them|their)\w*\}/.test(L.text)) errs.push('unknown {token} in: ' + L.text); }
            if (L.kind === 'choice') {
                choices++;
                if (!L.opts.some((o) => !o.if)) errs.push('a choice whose every answer is conditional');
                for (const o of L.opts) {
                    if (o.fx) try { Ru.applyFx(fresh(1), o.fx); } catch (e) { errs.push(e.message); }
                    if (o.if) try { Ru.evalCond(fresh(1), o.if); } catch (e) { errs.push(e.message); }
                }
            }
            if (L.kind !== 'dir') continue;
            if (L.cmd === 'bg' && !PLACES[L.arg]) errs.push('unknown backdrop ' + L.arg);
            if (L.cmd === 'cg' && L.arg && !CGS[L.arg] && !ENDINGS.some((e) => 'end-' + e.id === L.arg)) errs.push('unknown picture ' + L.arg);
            if (L.cmd === 'music' && !MUSIC[L.arg]) errs.push('unknown music ' + L.arg);
            if (L.cmd === 'sfx' && !SFX[L.arg]) errs.push('unknown sound ' + L.arg);
            if (L.cmd === 'fx') try { Ru.applyFx(fresh(1), L.arg); } catch (e) { errs.push(e.message); }
            if (L.cmd === 'if') try { Ru.evalCond(fresh(1), L.arg.replace(/\s+goto\s+\S+$/, '')); } catch (e) { errs.push(e.message); }
        }
        ok(errs.length === 0, `${s.id}: ${errs.join('; ') || 'clean'}`);
    }
    ok(ROMANCE.length >= 4, `at least four romances (${ROMANCE.length})`);
    for (const who of ROMANCE) {
        ok(HEARTS[who]?.length === 4, `${who} has four heart events`);
        ok(HEARTS[who][3].lines.some((l) => l.choice?.some((o) => o.tag === 'commit')), `${who}'s fourth heart can end in a confession`);
        ok(EPILOGUES[who] && CAST[who].talk?.length >= 3 && PLACES[CAST[who].room], `${who} has an epilogue, small talk and a room`);
    }
    ok(ENDINGS.length >= 11, `at least eleven endings (${ENDINGS.length})`);
    ok(ENDINGS.every((e) => Ru.ENDING_RULES.some(([id]) => id === e.id)) && Ru.ENDING_RULES.length === ENDINGS.length, 'every ending has a rule and every rule an ending');
    ok(STORY.filter((s) => s.day).every((s) => s.day >= 1 && s.day <= C.DAYS), 'story days are inside the month');
    console.log(`  ${ALL_SCENES.length} scenes, ${lines} lines of dialogue, ${choices} choices`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(3, { name: 'Wren', gender: 'f' });
    ok(G.scene?.id === 'prologue' && G.name === 'Wren' && G.gender === 'f', 'a new game opens on the prologue with your name and gender');
    ok(!Gm.act(G, { t: 'call' }) && !Gm.act(G, { t: 'endday' }), 'nothing else can be done during a scene');
    skip(G);
    ok(!G.scene && G.flags.met_bram && G.queue.length === 2, 'after the prologue: two petitioners wait, Bram is met');
    ok(Gm.newGame(3, { gender: 'x' }).gender === 'n', 'an unknown gender falls back to they/them');

    // grading
    ok(Gm.act(G, { t: 'call' }) && G.pet, 'call brings a petitioner to the desk');
    ok(!Gm.act(G, { t: 'endday' }), 'the day cannot end with someone at the desk');
    let q = G.pet, m0 = G.merit;
    Gm.act(G, { t: 'grade', rank: q.rank });
    ok(G.board.length === 1 && G.board[0].posted === q.rank && G.merit === m0 + 1 && !G.pet, 'a right grade posts the quest and earns merit');
    Gm.act(G, { t: 'call' }); q = G.pet;
    const t0 = G.trust[q.type === 'adv' ? 'fellow' : q.type];
    Gm.act(G, { t: 'grade', rank: (q.rank + 2) % 5 });
    ok(G.trust[q.type === 'adv' ? 'fellow' : q.type] < t0, 'a grade two ranks out loses that petitioner\'s trust');

    // assigning and reports
    G = fresh(4);
    Gm.act(G, { t: 'call' }); Gm.act(G, { t: 'grade', rank: G.pet.rank });
    q = G.board[0];
    ok(!Gm.act(G, { t: 'assign', quest: q.id, party: [] }) && !Gm.act(G, { t: 'assign', quest: q.id, party: ['garrick', 'kael', 'sera', 'nyx'] }), 'a party is one to three');
    ok(Gm.act(G, { t: 'assign', quest: q.id, party: ['garrick', 'kael'] }), 'assign sends a party');
    ok(adv(G, 'kael').state === 'away' && !G.board.length && G.out.length === 1, 'they are away and the job leaves the board');
    const gold0 = G.gold;
    while (G.queue.length) { Gm.act(G, { t: 'call' }); Gm.act(G, { t: 'grade', rank: G.pet.rank }); }
    for (let d = 0; d < q.days; d++) { skip(G); Gm.act(G, { t: 'endday' }); skip(G); }
    ok(adv(G, 'kael').state !== 'away' && G.reports.length >= 1, 'the party comes home with a report');
    ok(G.reports[0].res !== 'win' || G.gold > gold0 - 200, 'a win pays the fee');
    ok(Gm.questChance(G, { kind: 'mgt', rank: 0 }, ['garrick']) > Gm.questChance(G, { kind: 'mgt', rank: 4 }, ['garrick']), 'harder jobs are less likely');
    ok(Gm.questChance(G, { kind: 'mgt', rank: 3 }, ['kael', 'garrick']) > Gm.questChance(G, { kind: 'arc', rank: 3 }, ['kael', 'garrick']), 'a fighter suits a fight better than a warding');
    ok(Gm.questChance(G, { kind: 'mgt', rank: 4 }, ['pip']) === 0.05 && Gm.questChance(G, { kind: 'mgt', rank: 0 }, ['garrick', 'kael', 'sera']) === 0.97, 'chances are clamped to 5%..97%');

    // experience
    G = fresh(5);
    Ru.addXp(G, 'pip', C.XP_NEXT[0] + 5);
    ok(adv(G, 'pip').rank === 1 && adv(G, 'pip').xp === 5 && G.events.some((e) => e.type === 'rankup'), 'enough experience raises a rank and keeps the rest');
    Ru.addXp(G, 'garrick', 999);
    ok(adv(G, 'garrick').rank === 4, 'Platinum is the top');

    // visits and hearts
    G = fresh(6);
    ok(!Gm.act(G, { t: 'visit', who: 'kael' }), 'you cannot visit someone you have not met');
    ok(Gm.act(G, { t: 'visit', who: 'bram' }) && G.scene?.id === 'talk_bram' && G.ap === C.AP_PER_DAY - 1, 'a visit costs an action and plays small talk');
    skip(G);
    G.aff.bram = 30; G.day = 9;
    Gm.act(G, { t: 'visit', who: 'bram' });
    ok(G.scene?.id === 'bram_h1' && G.hearts.bram === 1, 'with enough affection a visit plays the next heart event');
    skip(G, 'love');
    ok(!Gm.act(G, { t: 'visit', who: 'bram' }), 'no actions left, no visit');
    G.hearts.bram = 3; G.aff.bram = 80; G.day = 22; G.ap = 1;
    Gm.act(G, { t: 'visit', who: 'bram' }); skip(G, 'commit');
    ok(G.partner === 'bram', 'the fourth heart can make them your partner');
    G.hearts.kael = 3; G.aff.kael = 80; G.flags.met_kael = true; G.ap = 1;
    Gm.act(G, { t: 'visit', who: 'kael' });
    while (G.scene && !G.scene.cur.choice) Gm.act(G, { t: 'next' });
    ok(!G.scene.cur.choice.some((o) => o.tag === 'commit'), 'someone already spoken for is not offered a second confession');
    skip(G);
    ok(G.partner === 'bram', 'and the partner does not change');

    // reviews
    G = fresh(7); G.day = 6; G.merit = C.MERIT[1]; Gm.act(G, { t: 'endday' });
    ok(G.rank === 1 && G.flags.promoted, 'enough merit at a review is a promotion');
    skip(G);
    G = fresh(7); G.day = 6; G.merit = C.MERIT[1] - 1; Gm.act(G, { t: 'endday' });
    ok(G.rank === 0 && !G.flags.promoted, 'one merit short is not');
    skip(G);
    G.day = 12; G.merit = C.MERIT[2]; Gm.act(G, { t: 'endday' });
    ok(G.rank === 2, 'a missed promotion can be caught up at the next review');

    // rooms and the till
    G = fresh(8); G.gold = 1000;
    ok(Gm.act(G, { t: 'upgrade', fac: 'tavern' }) && G.fac.tavern === 1 && G.gold === 1000 - C.FAC.tavern.cost[0], 'a room can be improved for its price');
    G.gold = 0;
    ok(!Gm.act(G, { t: 'upgrade', fac: 'tavern' }), 'not without the gold');
    Gm.step(G, 30);
    ok(Math.abs(G.till - 10) < 1e-6, 'the till fills at a coin every three seconds');
    Gm.step(G, 99999);
    ok(Math.abs(G.tillDay - C.TILL.cap[1]) < 1e-6, 'and stops at the day\'s cap');
    Gm.act(G, { t: 'till' });
    ok(G.gold === C.TILL.cap[1] && G.till < 1, 'collecting it adds whole coins');
    const g1 = G.gold;
    while (G.queue.length) { Gm.act(G, { t: 'call' }); Gm.act(G, { t: 'decline' }); }
    Gm.act(G, { t: 'endday' });
    ok(G.gold === g1 + C.FAC.tavern.income[1] - C.UPKEEP.base, 'each night: tavern takings in, upkeep out');
    ok(G.tillDay === 0 && G.day === 2, 'a new day resets the till');

    // potions
    G = fresh(9); adv(G, 'pip').state = 'hurt'; adv(G, 'pip').until = 9; G.potions = 1;
    ok(Gm.act(G, { t: 'heal', adv: 'pip' }) && adv(G, 'pip').state === 'ready' && G.potions === 0, 'a draught mends a hurt adventurer');

    // the debt
    G = fresh(10); G.flags.debt_ext = true; G.gold = 100;
    ok(!Gm.act(G, { t: 'paydebt' }), 'the late debt needs the gold');
    G.gold = 600;
    ok(Gm.act(G, { t: 'paydebt' }) && G.flags.debt_paid && G.gold === 100, 'and can be paid from the guild rooms');

    // the raid
    G = fresh(11); G.day = 27; G.queue = []; Gm.act(G, { t: 'endday' }); skip(G);
    ok(G.day === 28 && G.phase === 'raid' && G.queue.length === 0, 'day 28 is the raid: no petitioners');
    ok(!Gm.act(G, { t: 'endday' }) && !Gm.act(G, { t: 'raid', party: [] }), 'the raid must be sent before anything else');
    const five = ['garrick', 'kael', 'sera', 'fenna', 'mirelle'];
    const p0 = Gm.raidPower(G, five, false).total;
    G.flags.dragon_ally = true;
    ok(Gm.raidPower(G, five, false).total === p0 + C.RAID.dragon, 'the dragon adds her strength');
    G.trust.crown = C.RAID.at;
    ok(Gm.raidPower(G, five, true).total === p0 + C.RAID.dragon + C.RAID.crown + C.RAID.lead, 'so do the lancers, and you');
    Gm.act(G, { t: 'raid', party: five, lead: true });
    ok(G.flags.raid_won && G.flags.went_afield && G.scene?.id === 'raid_result' && G.phase === 'desk', 'a strong party relights the lantern');
    G = fresh(11); G.day = 27; G.queue = []; Gm.act(G, { t: 'endday' }); skip(G);
    Gm.act(G, { t: 'raid', party: ['pip'] }); skip(G);
    ok(G.over && G.ending.id === 'ruin', 'one squire does not, and the story ends there');

    // the vote
    G = fresh(12); G.trust = { folk: 50, crown: 49, wild: 50, fellow: 10 }; G.integ = 50;
    ok(Ru.votes(G) === 3, 'three of five votes at trust 50');
    G.day = 28; G.rank = 4; G.flags.raid_won = true; G.queue = []; Gm.act(G, { t: 'endday' }); skip(G, 'honest');
    ok(G.rank === 5 && G.flags.gm, 'with three votes a Vice-Guildmaster who stands becomes Guildmaster');
    G = fresh(12); G.trust = { folk: 50, crown: 49, wild: 49, fellow: 10 }; G.integ = 50;
    G.day = 28; G.rank = 4; G.queue = []; Gm.act(G, { t: 'endday' }); skip(G, 'honest');
    ok(G.rank === 4 && !G.flags.gm, 'with two, not');

    // the end
    G = fresh(13); G.day = 30; G.queue = []; Gm.act(G, { t: 'endday' });
    ok(G.ending?.id === 'quiet' && G.scene?.id === 'end_quiet' && !G.over, 'the thirtieth night plays an ending');
    skip(G);
    ok(G.over && !Gm.act(G, { t: 'endday' }), 'and then the game is over');
    G = fresh(13); G.day = 30; G.queue = []; G.partner = 'nyx'; G.aff.nyx = 90; Gm.act(G, { t: 'endday' });
    const ids = []; while (G.scene) { ids.push(G.scene.id); skip({ ...G, scene: null }); const id = G.scene.id; while (G.scene && G.scene.id === id) Gm.act(G, G.scene.cur.choice ? { t: 'choose', i: G.scene.cur.choice[0].i } : { t: 'next' }); }
    ok(ids.join() === 'end_quiet,epi_nyx', 'a partner adds their epilogue');
}

if (want('petitions')) {
    section('petitions');
    let n = 0, bad = 0, ranks = [0, 0, 0, 0, 0];
    for (let s = 1; s <= 50; s++) {
        const G = fresh(s); G.flags.met_ren = G.flags.met_moss = true;
        for (const day of [1, 8, 14, 20, 26]) {
            G.day = day;
            for (let i = 0; i < 8; i++) {
                const q = Pt.makePetition(G, Gm.chapterOf(day));
                const r = Pt.readPetition(q.text);
                n++; ranks[q.rank]++;
                if (!r || r.rank !== q.rank || r.tier !== q.tier || r.cnt !== q.cnt || r.site !== q.site || r.omen !== q.omen) { bad++; if (bad < 4) console.log('    unreadable:', q.text, q, r); }
                if (day < 13 && q.omen) bad++;
            }
        }
    }
    ok(bad === 0, `${n} petitions: the words alone give the creature, the number, the place, the omen and so the rank`);
    ok(ranks.every((c) => c > 0), `every rank turns up (${ranks.join(' / ')})`);
}

if (want('minigames')) {
    section('minigames');
    let worst = 0;
    for (let s = 1; s <= 60; s++) {
        const G = fresh(s);
        Gm.act(G, { t: 'play', game: 'route' });
        const mg = G.mg, sol = Mg.routeSolve(mg);
        if (sol.cost !== mg.best || sol.cost > mg.budget) worst++;
        for (const d of sol.path) Gm.act(G, { t: 'mg', a: d });
        if (!(mg.done && mg.result.stars === 3 && G.charts === 2)) worst++;
    }
    ok(worst === 0, '60 route maps: each is solvable, and walking the best road wins two charts');
    let G = fresh(2); Gm.act(G, { t: 'play', game: 'route' });
    for (let i = 0; i < 80 && !G.mg.done; i++) for (const d of ['u', 'd']) Gm.act(G, { t: 'mg', a: d });
    ok(G.mg.done && G.mg.result.stars === 0 && G.charts === 0, 'wandering runs out of supplies and charts nothing');

    G = fresh(3); const ap = G.ap, m0 = G.merit; Gm.act(G, { t: 'play', game: 'stamp' });
    ok(G.ap === ap - 1 && !Gm.act(G, { t: 'endday' }), 'a mini-game costs an action and holds the desk');
    while (!G.mg.done) Gm.act(G, { t: 'mg', a: Mg.formValid(G.mg.forms[G.mg.i]) ? 'ok' : 'no' });
    ok(G.mg.right === C.MG.stamp.forms && G.mg.result.stars === 3 && G.merit === m0 + 2, 'eight right stamps is three stars and merit');
    ok(Gm.act(G, { t: 'mgclose' }) && !G.mg, 'closing the result returns to the desk');
    G.ap = 1; Gm.act(G, { t: 'play', game: 'stamp' });
    while (!G.mg.done) Gm.act(G, { t: 'mg', a: Mg.formValid(G.mg.forms[G.mg.i]) ? 'no' : 'ok' });
    ok(G.mg.wrong === C.MG.stamp.strikes && G.mg.i === 3, 'three wrong stamps ends it');
    Gm.act(G, { t: 'mgclose' }); G.ap = 1; Gm.act(G, { t: 'play', game: 'stamp' });
    Gm.step(G, C.MG.stamp.time + 1);
    ok(G.mg.done, 'so does the sand-glass');
    ok(!Mg.formValid({ seal: true, sign: true, paid: true, q: 2, p: 1, site: 0 }) && !Mg.formValid({ seal: true, sign: true, paid: true, q: 1, p: 1, site: 2, counter: false })
        && Mg.formValid({ seal: true, sign: true, paid: true, q: 1, p: 1, site: 2, counter: true }), 'the checklist: rank, and a countersign on cursed ground');

    G = fresh(4); Gm.act(G, { t: 'play', game: 'brew' });
    const p0 = G.potions;
    while (!G.mg.done) Gm.act(G, { t: 'mg', a: G.mg.seq[G.mg.pos] });
    ok(G.potions === p0 + 3, 'three remembered recipes bottle three draughts');
    Gm.act(G, { t: 'mgclose' }); G.ap = 1; Gm.act(G, { t: 'play', game: 'brew' });
    Gm.act(G, { t: 'mg', a: (G.mg.seq[0] + 1) % 4 });
    ok(G.mg.done && G.potions === p0 + 3, 'a wrong ingredient spoils the pot');

    G = fresh(5); G.gold = 5;
    ok(!Gm.act(G, { t: 'play', game: 'dice' }) && G.ap === C.AP_PER_DAY, 'no stake, no dice (and no action spent)');
    G.gold = 50; Gm.act(G, { t: 'play', game: 'dice' });
    ok(G.gold === 40, 'the stake is paid up front');
    ok(!Gm.act(G, { t: 'mg', a: 'bank' }), 'an empty pot cannot be banked');
    let guard = 0; while (!G.mg.done && guard++ < 200) Gm.act(G, { t: 'mg', a: G.mg.pot >= 12 ? 'bank' : 'roll' });
    ok(G.mg.done && G.gold === 40 + Math.min(C.MG.dice.cap, G.mg.banked), 'what you banked is what you win');

    G = fresh(6); Gm.act(G, { t: 'play', game: 'spar', arg: 'pip' });
    const x0 = adv(G, 'pip').xp + adv(G, 'pip').rank * 1000;
    while (!G.mg.done) Gm.act(G, { t: 'mg', a: Object.keys(Mg.BEATS).find((k) => Mg.BEATS[k] === G.mg.move) });
    ok(G.mg.wins === 5 && adv(G, 'pip').xp + adv(G, 'pip').rank * 1000 > x0, 'reading every exchange trains the adventurer');
    ok(Object.values(Mg.TELLS).flat().length === new Set(Object.values(Mg.TELLS).flat()).size, 'every tell means one thing');
}

if (want('determinism')) {
    section('determinism');
    const a = Bt.playThrough(42, { until: 12 }), b = Bt.playThrough(42, { until: 12 });
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(Bt.playThrough(43, { until: 12 }))), 'a different seed, a different game');
    for (const stop of [3, 9, 16, 22]) {
        const G = Bt.playThrough(7, { until: stop });
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const end1 = Bt.playThrough(7, { G, bot: Bt.makeBot({ route: 'golden', seed: 99 }) });
        const end2 = Bt.playThrough(7, { G: copy, bot: Bt.makeBot({ route: 'golden', seed: 99 }) });
        ok(JSON.stringify(Gm.serialize(end1)) === JSON.stringify(Gm.serialize(end2)), `a save on day ${stop} plays on to the same ending (${end1.ending.id})`);
    }
    // mid-scene and mid-mini-game
    let G = Gm.newGame(5); Gm.act(G, { t: 'next' }); Gm.act(G, { t: 'next' });
    let copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    skip(G); skip(copy);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save in the middle of a scene resumes on the same line');
    Gm.act(G, { t: 'visit', who: 'bram' });
    copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(Gm.sceneLines(copy)?.length === Gm.sceneLines(G).length && copy.scene.id === 'talk_bram', 'small talk made up on the spot survives a save');
    skip(G); Gm.act(G, { t: 'play', game: 'route' });
    copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(JSON.stringify(copy.mg) === JSON.stringify(G.mg), 'so does a mini-game in progress');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('endings')) {
    section('endings');
    const N = Math.max(6, SEEDS);
    const reached = new Set();
    for (const route of Bt.ROUTE_IDS) {
        const got = {};
        for (let s = 1; s <= N; s++) { const id = Bt.playThrough(s, { route }).ending.id; got[id] = (got[id] || 0) + 1; reached.add(id); }
        ok((got[route] || 0) >= Math.ceil(N / 2), `the "${route}" route reaches its ending on most seeds (${JSON.stringify(got)})`);
    }
    ok(reached.size === ENDINGS.length, `all ${ENDINGS.length} endings are reached through real play (${reached.size})`);
    // rule order
    const G = fresh(1);
    ok(Ru.chooseEnding(G) === 'quiet', 'nothing special: the quiet desk');
    G.rank = 4; ok(Ru.chooseEnding(G) === 'steady', 'Vice-Guildmaster: the steady hand');
    G.rank = 5; ok(Ru.chooseEnding(G) === 'keeper', 'Guildmaster: keeper of the lamp');
    G.trust.folk = 85; ok(Ru.chooseEnding(G) === 'folk', 'beloved of the town');
    G.trust.crown = 60; ok(Ru.chooseEnding(G) === 'crown', 'the Crown outranks the town');
    G.trust.wild = 75; G.flags.dragon_ally = true; ok(Ru.chooseEnding(G) === 'wild', 'the compact outranks the Crown');
    G.flags.raid_won = true; ok(Ru.chooseEnding(G) === 'golden', 'all three and a clean raid: golden');
    G.flags.raid_pyrrhic = true; ok(Ru.chooseEnding(G) === 'wild', 'a costly raid is not golden');
    G.flags.bribed = true; ok(Ru.chooseEnding(G) === 'puppet', 'a bribed Guildmaster is a puppet');
    G.flags.raid_lost = true; ok(Ru.chooseEnding(G) === 'ruin', 'a lost raid is ruin whatever else is true');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.6, 0.3]) {
        for (let s = 1; s <= SEEDS; s++) {
            let bad = null;
            const G = Bt.playThrough(s * 31, { route: 'keeper', skill, onStep: (g) => {
                if (bad) return;
                for (const k of ['gold', 'merit', 'renown', 'integ', 'till', 'potions', 'charts', 'ap']) if (!Number.isFinite(g[k])) bad = k + ' is not a number';
                for (const k in g.trust) if (!(g.trust[k] >= 0 && g.trust[k] <= 100)) bad = 'trust out of range';
                for (const k in g.aff) if (!(g.aff[k] >= 0 && g.aff[k] <= 100)) bad = 'affection out of range';
                if (g.ap < 0 || g.potions < 0 || g.charts < 0 || g.merit < 0) bad = 'a counter went negative';
                if (g.advs.some((a) => a.rank < 0 || a.rank > 4 || !['ready', 'away', 'hurt'].includes(a.state))) bad = 'a bad adventurer';
                if (new Set(g.out.flatMap((o) => o.party)).size !== g.advs.filter((a) => a.state === 'away').length) bad = 'away adventurers and parties disagree';
                if (g.events.length > 400) bad = 'events pile up';
            } });
            ok(!bad && G.over, `seed ${s} skill ${skill}: ${bad || 'invariants hold to the end'}`);
            rows.push({ skill, rank: G.rank, merit: G.merit, gold: G.gold, wins: G.count.wins || 0, fails: G.count.fails || 0, ending: G.ending.id, plat: Ru.platCount(G) });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const avg = (k, f) => of(k).reduce((a, r) => a + f(r), 0) / SEEDS;
    console.log('  skill  rank  merit  gold  wins  fails  endings');
    for (const k of [1, 0.6, 0.3]) {
        const ends = {}; for (const r of of(k)) ends[r.ending] = (ends[r.ending] || 0) + 1;
        console.log(`  ${String(k).padEnd(5)}  ${avg(k, (r) => r.rank).toFixed(1).padEnd(4)}  ${avg(k, (r) => r.merit).toFixed(0).padEnd(5)}  ${avg(k, (r) => r.gold).toFixed(0).padEnd(4)}  ${avg(k, (r) => r.wins).toFixed(0).padEnd(4)}  ${avg(k, (r) => r.fails).toFixed(1).padEnd(5)}  ${JSON.stringify(ends)}`);
    }
    ok(avg(1, (r) => r.rank) >= 4.5, 'a careful clerk reaches the top of the ladder');
    ok(avg(0.3, (r) => r.rank) < avg(1, (r) => r.rank) - 0.5, 'a careless one does not get as far');
    ok(avg(1, (r) => r.merit) > avg(0.6, (r) => r.merit) && avg(0.6, (r) => r.merit) > avg(0.3, (r) => r.merit), 'merit follows care');
    ok(avg(0.3, (r) => r.fails) > avg(1, (r) => r.fails), 'misgraded jobs get people hurt');
    ok(avg(1, (r) => r.gold) > 0 && avg(1, (r) => r.gold) < 1200, 'honest work pays the bills without making anyone rich');
    ok(ROSTER.some((a) => a.rank === 0) && ROSTER.some((a) => a.rank === 4), 'the roster runs from Copper beginners to a Platinum legend');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
