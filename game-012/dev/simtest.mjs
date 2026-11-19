/**
 * simtest.mjs — Arcana Pull's rules, headless in Node (a few seconds). No framework: plain asserts and a tally.
 *
 *   purity       js/sim/, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock
 *   data         78 cards (22 / 8 / 12 / 16 / 20 by rarity), every skill effect known, every Hollow and Threshold
 *                well formed; every picture, effect, theme and voice clip the game names is on disk, and every
 *                voice clip is a line the game speaks
 *   rules        the Well (costs, the ten-draw's Rare, pity and soft pity, the featured Major, copies, stars,
 *                spare stardust), the spread, battles won and lost, lives, the Readings and their omens, charms,
 *                the ending and Ascension
 *   battle       elements, resonance, shields and their cap, taunt, revive, execute, undying, The World's phases,
 *                the candle, and the same timeline from the same seed
 *   determinism  same seed and commands → same run; save round trips mid-run play on identically
 *   bot          whole runs on SEEDS seeds for three styles, invariants after every command, the balance table,
 *                and its bands asserted
 *
 *   node game-012/dev/simtest.mjs
 *   ONLY=purity,data,rules,battle,determinism,bot SEEDS=60 VERBOSE=1 node game-012/dev/simtest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, act, serialize, deserialize, legal, battleMods, foeSpecs, allySpec, bestParty, legendaryRate, omenFor } from '../js/sim/game.js';
import { resolve, elemMult, resonance, cardStats } from '../js/sim/battle.js';
import { CARDS, CARD_IDS, BY_RARITY } from '../js/sim/data/cards.js';
import { ENEMIES, TRIALS } from '../js/sim/data/enemies.js';
import { ITEMS, BLESSINGS, CURSES } from '../js/sim/data/omens.js';
import { LINE_IDS } from '../js/sim/data/lines.js';
import { playRun, botCommand } from '../js/sim/bot.js';
import { makeRng } from '../js/rng.js';
import { ALL_ART, SFX, MUSIC } from '../js/media.js';
import * as C from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 40);
const VERBOSE = !!process.env.VERBOSE;
const want = (s) => !ONLY.length || ONLY.includes(s);
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗', msg); } };
const section = (s) => console.log(`\n— ${s}`);
const drain = (G) => G.events.splice(0);
const give = (G, ids, star = 1) => { for (const id of ids) G.owned[id] = { star, copies: 0 }; };

// ------------------------------------------------------------------ purity
if (want('purity')) {
    section('purity');
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
    walk(path.join(GAME, 'js/sim'));
    files.push(path.join(GAME, 'js/rng.js'), path.join(GAME, 'js/config.js'));
    const banned = [/\bdocument\b/, /\bwindow\b/, /localStorage/, /Math\.random/, /Date\.now/, /performance\.now/, /requestAnimationFrame/, /\bfetch\(/];
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
            .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");   // words inside strings (art lines) are not code
        for (const b of banned) ok(!b.test(src), `${path.relative(GAME, f)} uses ${b}`);
    }
    ok(files.length >= 9, 'sim files found');
}

// ------------------------------------------------------------------ data
if (want('data')) {
    section('data');
    ok(CARD_IDS.length === 78, '78 cards');
    const counts = Object.fromEntries(Object.entries(BY_RARITY).map(([r, a]) => [r, a.length]));
    ok(counts.L === 22 && counts.E === 8 && counts.R === 12 && counts.U === 16 && counts.C === 20, 'rarity counts ' + JSON.stringify(counts));
    const KNOWN = new Set(['dmg', 'heal', 'shield', 'buff', 'debuff', 'burn', 'stun', 'blind', 'cleanse', 'revive', 'execute', 'delay', 'dodge', 'taunt', 'wheel']);
    const fxOk = (fx) => Array.isArray(fx) && fx.every((f) => KNOWN.has(f.k));
    for (const id of CARD_IDS) {
        const c = CARDS[id];
        ok(c.name && c.art && c.el && c.skill?.name && c.skill.cost >= 2 && fxOk(c.skill.fx) && c.skill.text, `card ${id} well formed`);
        const s = cardStats(id, 1), s5 = cardStats(id, 5);
        ok(s.hp > 50 && s.atk > 5 && s.spd > 5 && s5.hp > s.hp * 1.7, `card ${id} numbers`);
    }
    for (const [id, e] of Object.entries(ENEMIES)) {
        ok(e.name && e.art && e.hp > 0 && e.atk > 0 && e.spd > 0 && (!e.skill || fxOk(e.skill.fx)) && (!e.opener || fxOk(e.opener)), `Hollow ${id} well formed`);
        if (e.phases) for (const p of e.phases) ok(fxOk(p.fx) && p.below > 0 && p.below < 1, `${id} phase ${p.name}`);
    }
    ok(TRIALS.length === C.TRIAL_COUNT && TRIALS.every((t, i) => t.id === i + 1 && t.foes.every((f) => ENEMIES[f]) && t.foes.length <= 5 && t.realm), 'ten Thresholds, every Hollow known');
    ok(C.TRIAL_HP.length === 10 && C.TRIAL_ATK.length === 10, 'per-Threshold knobs');
    for (const s of Object.keys(BLESSINGS)) ok(CURSES[s], `omens for ${s}`);
    // media on disk
    const exists = (p) => fs.existsSync(path.join(GAME, p));
    const missing = ALL_ART.filter((p) => !exists(p));
    ok(!missing.length, 'every picture on disk ' + missing.slice(0, 5).join(', '));
    ok(SFX.every((n) => exists(`audio/sfx-${n}.mp3`)), 'every effect on disk');
    ok(Object.values(MUSIC).every(exists), 'every theme on disk');
    ok(LINE_IDS.every((id) => exists(`audio/vo-${id}.mp3`)), 'every line has a clip');
    const clips = fs.readdirSync(path.join(GAME, 'audio')).filter((f) => f.startsWith('vo-')).map((f) => f.slice(3, -4));
    ok(clips.every((id) => LINE_IDS.includes(id)), 'every clip is a line: ' + clips.filter((id) => !LINE_IDS.includes(id)).join(','));
    const takes = JSON.parse(fs.readFileSync(path.join(HERE, 'audio/voices.json'), 'utf8'));
    ok(Object.values(takes).flatMap((t) => t.lines).sort().join() === [...LINE_IDS].sort().join(), 'voices.json covers exactly the lines');
    const used = new Set(fs.readdirSync(path.join(GAME, 'art')).map((f) => 'art/' + f));
    ok([...used].every((f) => ALL_ART.includes(f)), 'no stray pictures');
}

// ------------------------------------------------------------------ rules
if (want('rules')) {
    section('rules');
    // the Well
    let G = newGame(11);
    drain(G);
    ok(G.phase === 'hub' && G.dust === C.START_DUST && G.lives === C.LIVES && G.trial === 1 && G.featured && CARDS[G.featured].rarity === 'L', 'a new run');
    ok(!act(G, { t: 'fight' }) && drain(G).some((e) => e.type === 'deny' && e.why === 'party'), 'no fight with an empty spread');
    ok(act(G, { t: 'pull', n: 1 }) && G.dust === C.START_DUST - C.PULL_COST && Object.keys(G.owned).length === 1, 'a single draw');
    ok(G.party.filter(Boolean).length === 1, 'the first card is placed for you');
    let ev = drain(G);
    ok(ev.some((e) => e.type === 'pulled' && e.cards.length === 1), 'pulled event');
    G.dust = 100; ok(!act(G, { t: 'pull', n: 10 }), 'a ten-draw needs 540');
    // the ten-draw always holds a Rare or better
    let tenOk = true;
    for (let s = 1; s <= 200; s++) {
        const g = newGame(s); g.dust = 540; act(g, { t: 'pull', n: 10 });
        const cards = g.events.find((e) => e.type === 'pulled').cards;
        if (cards.length !== 10 || !cards.some((c) => ['R', 'E', 'L'].includes(c.rarity))) tenOk = false;
    }
    ok(tenOk, 'every ten-draw in 200 holds a Rare or better');
    // pity: a Legendary at the 40th draw at the latest, and soft pity climbs
    G = newGame(5); G.pity = C.PITY - 1; G.dust = 60; act(G, { t: 'pull', n: 1 });
    ok(drain(G).find((e) => e.type === 'pulled').cards[0].rarity === 'L' && G.pity === 0, 'the 40th draw is Legendary');
    G.pity = 0; ok(legendaryRate(G) === C.RATES.L, 'base Legendary rate');
    G.pity = C.SOFT_PITY + 3; ok(legendaryRate(G) === C.RATES.L + 4 * C.SOFT_STEP, 'soft pity climbs');
    let maxGap = 0, legs = 0, feat = 0;
    for (let s = 1; s <= 30; s++) {
        const g = newGame(s * 31); let gap = 0;
        for (let k = 0; k < 150; k++) { g.dust = 60; act(g, { t: 'pull', n: 1 }); const c = drain(g).find((e) => e.type === 'pulled').cards[0]; gap++; if (c.rarity === 'L') { legs++; if (c.featured) feat++; maxGap = Math.max(maxGap, gap); gap = 0; } }
    }
    ok(maxGap <= C.PITY, `never more than ${C.PITY} draws without a Legendary (${maxGap})`);
    ok(feat / legs > 0.4 && feat / legs < 0.75, `about half of Legendaries are featured (${(feat / legs).toFixed(2)} of ${legs})`);
    // copies, stars, spare stardust
    G = newGame(3); give(G, ['w05']); G.owned.w05.copies = 1;
    ok(act(G, { t: 'starUp', id: 'w05' }) && G.owned.w05.star === 2 && G.owned.w05.copies === 0, 'star up spends copies');
    ok(!act(G, { t: 'starUp', id: 'w05' }), 'star up needs the copies');
    G.owned.w05 = { star: 5, copies: 0 };
    const spare0 = G.dust;
    for (let k = 0; k < 400 && G.dust >= spare0 - 60 * 50; k++) { G.dust += 60; act(G, { t: 'pull', n: 1 }); const c = drain(G).find((e) => e.type === 'pulled').cards[0]; if (c.id === 'w05') { ok(c.spare === C.SPARE_DUST && G.owned.w05.copies === 0, 'a ★5 copy turns to stardust'); break; } }
    // the spread
    G = newGame(4); give(G, ['p10', 'w10', 'c10', 's10', 'm00']);
    ok(act(G, { t: 'place', slot: 0, id: 'p10' }) && G.party[0] === 'p10', 'place');
    ok(act(G, { t: 'place', slot: 2, id: 'p10' }) && G.party[2] === 'p10' && G.party[0] === null, 'placing a placed card moves it');
    ok(act(G, { t: 'swap', a: 0, b: 2 }) && G.party[0] === 'p10', 'swap');
    ok(!act(G, { t: 'place', slot: 1, id: 'w01' }), 'cannot place a card you do not own');
    ok(act(G, { t: 'auto' }) && G.party.filter(Boolean).length === 4 && new Set(G.party).size === 4, 'auto fills four different cards');
    const tough = (id) => { const s = cardStats(id, 1); return s.hp / (1 - s.def); };
    ok(tough(G.party[0]) >= Math.max(...G.party.slice(1).map(tough)), 'auto puts the toughest card in front');
    // a battle won: stardust, score, the next Threshold
    G = newGame(8); give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' }); drain(G);
    const d0 = G.dust;
    ok(act(G, { t: 'fight' }) && G.phase === 'won' && G.dust === d0 + C.winDust(1) && G.score > 0, 'a battle won pays stardust and score');
    ev = drain(G);
    const be = ev.find((e) => e.type === 'battle');
    ok(be && be.won && be.log.length > 5 && be.start.allies.length === 4 && be.start.foes.length === TRIALS[0].foes.length, 'the battle event carries the timeline');
    ok(!act(G, { t: 'pull', n: 1 }), 'no drawing on the result screen');
    ok(act(G, { t: 'next' }) && G.trial === 2 && G.phase === 'hub', 'onward to Threshold 2');
    // a battle lost: a life, consolation, the same Threshold
    G = newGame(9); give(G, ['c02']); act(G, { t: 'place', slot: 0, id: 'c02' }); G.trial = 7; drain(G);
    const d1 = G.dust;
    act(G, { t: 'fight' });
    ok(G.phase === 'lost' && G.lives === C.LIVES - 1 && G.dust === d1 + C.LOSS_DUST, 'a battle lost costs a life and pays a little');
    act(G, { t: 'next' }); ok(G.phase === 'hub' && G.trial === 7, 'try the same Threshold again');
    act(G, { t: 'fight' }); act(G, { t: 'next' }); act(G, { t: 'fight' });
    ok(G.phase === 'over' && G.lives === 0 && drain(G).some((e) => e.type === 'over'), 'the third loss ends the run');
    ok(!act(G, { t: 'next' }) && legal(G).length === 0, 'nothing to do after the end');
    // Readings after 3, 6, 9
    for (const after of [3, 6, 9]) {
        G = newGame(20 + after); give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' }); G.trial = after; drain(G);
        act(G, { t: 'fight' }); act(G, { t: 'next' });
        ok(G.phase === 'reading' && G.reading.cards.length === 3 && new Set(G.reading.cards).size === 3, `a Reading after Threshold ${after}`);
    }
    G = newGame(30); give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' }); G.trial = 4; act(G, { t: 'fight' }); act(G, { t: 'next' });
    ok(G.phase === 'hub' && G.trial === 5, 'no Reading after Threshold 4');
    // omens: upright about 70%, curses apply, they last three battles
    let rev = 0, n = 0;
    for (let s = 1; s <= 300; s++) {
        const g = newGame(s); g.phase = 'reading'; g.reading = { cards: ['w02', 'c02', 's02'], picked: -1 };
        act(g, { t: 'pick', i: s % 3 }); const e = g.events.find((x) => x.type === 'omen'); n++; if (e.reversed) rev++;
        if (s === 1) ok(g.omen && g.omen.left === C.OMEN_FIGHTS && g.phase === 'hub', 'an omen for three battles');
    }
    ok(rev / n > 0.22 && rev / n < 0.38, `about three in ten reversed (${(rev / n).toFixed(2)})`);
    ok(omenFor('w03').up.id === 'blaze' && omenFor('w03').down.id === 'weakened' && omenFor('m10').up.id === 'fortune', 'suits decide omens');
    G = newGame(1); G.omen = { id: 'blaze', fx: BLESSINGS.wands, left: 3 };
    ok(Math.abs(battleMods(G).atk - (1 + BLESSINGS.wands.atk)) < 1e-9, 'Blaze raises ATK');
    G.omen = { id: 'hexed', fx: CURSES.pentacles, left: 3 }; give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' }); act(G, { t: 'fight' });
    ok(G.result.dust === Math.round(C.winDust(1) * 0.5) && G.omen.left === 2, 'Hexed halves stardust, and the omen counts down');
    G.omen = { id: 'cursed', fx: CURSES.major, left: 3, pityFrozen: true }; G.phase = 'hub'; G.pity = 5; G.dust = 60; act(G, { t: 'pull', n: 1 });
    ok(G.pity === 5 || drain(G).find((e) => e.type === 'pulled')?.cards[0].rarity === 'L', 'Cursed freezes the pity count');
    // Fortune: a charm and stardust at once, no lasting omen
    let fortuneSeen = false;
    for (let s = 1; s <= 60 && !fortuneSeen; s++) {
        const g = newGame(s); g.phase = 'reading'; g.reading = { cards: ['m01', 'm02', 'm03'], picked: -1 }; const d = g.dust;
        act(g, { t: 'pick', i: 0 }); const e = g.events.find((x) => x.type === 'omen');
        if (!e.reversed) { fortuneSeen = true; ok(g.items.length === 1 && g.dust === d + 200 && !g.omen, 'Fortune: a charm and 200 stardust'); }
    }
    // charms
    G = newGame(2); G.items = ['sun_sigil', 'moon_shard', 'star_vial']; give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' });
    ok(act(G, { t: 'arm', item: 'moon_shard' }) && act(G, { t: 'arm', item: 'star_vial' }), 'arm charms');
    const m = battleMods(G);
    ok(m.foeAtk === 0.8 && m.shield >= 0.35, 'Moon Shard and Star Vial in the battle numbers');
    ok(foeSpecs(G)[0].atk < foeSpecs(newGame(2))[0].atk, 'Moon Shard softens the Hollows');
    ok(act(G, { t: 'disarm', item: 'star_vial' }) && G.armed.length === 1, 'disarm');
    act(G, { t: 'arm', item: 'sun_sigil' }); act(G, { t: 'fight' });
    ok(G.result.won && G.result.dust === C.winDust(1) * 2 && G.items.length === 1 && G.armed.length === 0, 'Sun Sigil doubles stardust; armed charms are spent');
    G = newGame(2); G.items = ['wheel_token']; const p0 = G.stats.pulls; const dd = G.dust;
    ok(act(G, { t: 'arm', item: 'wheel_token' }) && G.stats.pulls === p0 + 10 && G.dust === dd && !G.items.length, 'the Wheel Token: ten free draws');
    // the ending and Ascension
    G = newGame(40); give(G, ['m21', 'm20', 'm19', 'm04'], 5); act(G, { t: 'auto' }); G.trial = 10; drain(G);
    act(G, { t: 'fight' });
    if (G.phase === 'won') {
        act(G, { t: 'next' });
        ok(G.phase === 'ending' && drain(G).some((e) => e.type === 'ending'), 'the ending after The World');
        const owned = Object.keys(G.owned).length;
        ok(act(G, { t: 'ascend' }) && G.asc === 1 && G.trial === 1 && G.lives === C.LIVES && Object.keys(G.owned).length === owned, 'Ascend keeps every card');
        ok(foeSpecs(G)[0].hp > foeSpecs(newGame(40))[0].hp, 'Ascension strengthens the Hollows');
    } else ok(false, 'a ★5 Major spread beats The World');
}

// ------------------------------------------------------------------ battle
if (want('battle')) {
    section('battle');
    ok(elemMult('water', 'fire') === C.ADVANTAGE && elemMult('fire', 'water') === C.DISADVANTAGE && elemMult('fire', 'fire') === 1 && elemMult('air', 'spirit') === 1, 'the element wheel');
    ok(elemMult('fire', 'air') > 1 && elemMult('air', 'earth') > 1 && elemMult('earth', 'water') > 1, 'Fire > Air > Earth > Water > Fire');
    const r2 = resonance(['w01', 'w02', 'c01', null]), r3 = resonance(['s01', 's02', 's03', 'm00']), rm = resonance(['m00', 'm01', 'p02', 'p03']);
    ok(r2.atk === 0.1 && r2.heal === 0, 'two Wands');
    ok(r3.spd === 0.2 && r3.crit === 0.1, 'three Swords');
    ok(rm.charge === 1 && rm.def === 0.06, 'two Majors and two Pentacles');
    const G = newGame(77);
    const ally = (id, star = 1, extra = {}) => ({ ...allySpec({ owned: { [id]: { star } } }, id, battleMods({ ...G, party: [id], armed: [], omen: null })), ...extra });
    const dummy = (o = {}) => ({ id: 'stray_page', name: 'Dummy', el: 'air', hp: 400, atk: 10, spd: 10, def: 0, ...o });
    // the same seed gives the same timeline
    const a1 = resolve([ally('w05'), ally('c05')], [dummy()], makeRng(5)), a2 = resolve([ally('w05'), ally('c05')], [dummy()], makeRng(5));
    ok(JSON.stringify(a1.log) === JSON.stringify(a2.log), 'the same seed, the same timeline');
    ok(a1.log.at(-1).e === 'end' && a1.log.every((e, i) => i === 0 || e.t >= a1.log[i - 1].t), 'the timeline runs forward and ends');
    // shields never pass the cap
    const sh = resolve([ally('p14', 5), ally('p13', 5)], [dummy({ hp: 5000, atk: 1 })], makeRng(1));
    ok(sh.log.some((e) => e.e === 'shield'), 'Pentacles shield');
    // follow each card's shield through the timeline: it never holds more than SHIELD_CAP of its max HP
    const maxHp = Object.fromEntries(sh.allies.map((u) => [u.key, u.maxHp]));
    const held = {}; let peakOk = true;
    for (const e of sh.log) {
        if (e.e === 'shield' && maxHp[e.b]) held[e.b] = (held[e.b] || 0) + e.v;
        if (e.e === 'hit' && maxHp[e.b]) held[e.b] = Math.max(0, (held[e.b] || 0) - e.v);
        if (e.e === 'die' && maxHp[e.b]) held[e.b] = 0;
        for (const k in held) if (held[k] > C.SHIELD_CAP * maxHp[k] + 1) peakOk = false;
    }
    ok(peakOk, 'shields stay within the cap');
    // taunt: Hollows strike the taunting card
    const tl = resolve([ally('w05'), ally('p05', 3)], [dummy({ hp: 3000 })], makeRng(2)).log;
    const tauntAt = tl.findIndex((e) => e.e === 'taunt' && e.a === 'a1');
    const nextFoeHit = tl.slice(tauntAt).find((e) => e.e === 'hit' && e.a === 'f0');
    ok(tauntAt >= 0 && nextFoeHit && nextFoeHit.b === 'a1', 'a taunt draws the next blow');
    // revive once: The Star raises a fallen card
    const st = resolve([ally('c02', 1, { hp: 20 }), ally('m17', 5)], [dummy({ atk: 40, hp: 3000 })], makeRng(3)).log;
    ok(st.filter((e) => e.e === 'rise' && e.a === 'a1').length === 1, 'The Star raises a fallen card, once');
    // execute: Death ends a low Hollow
    const de = resolve([ally('m13', 5)], [dummy({ hp: 2000, atk: 1 })], makeRng(4)).log;
    ok(de.some((e) => e.e === 'hit' && e.execute), 'Death executes a weakened Hollow');
    // undying: a Bone Strider rises once
    const ud = resolve([ally('m16', 5), ally('m01', 5)], [{ ...dummy({ hp: 200 }), undying: 0.3 }], makeRng(5)).log;
    ok(ud.filter((e) => e.e === 'rise' && e.b === 'f0').length === 1 && ud.at(-1).won, 'undying rises once, then falls');
    // The World's phases come in order
    const g10 = newGame(6); give(g10, ['m21', 'm20', 'm19', 'm04'], 5); g10.party = ['m04', 'm21', 'm20', 'm19']; g10.trial = 10;
    const wl = resolve(g10.party.map((id) => allySpec(g10, id, battleMods(g10))), foeSpecs(g10), makeRng(9)).log;
    const ph = wl.filter((e) => e.e === 'phase').map((e) => e.el);
    ok(ph.length >= 1 && ['fire', 'water', 'air'].slice(0, ph.length).join() === ph.join(), 'The World changes element in order: ' + ph.join(','));
    // the candle: a stalemate is a loss
    const tm = resolve([ally('p02', 5, { atk: 0 })], [dummy({ atk: 0, hp: 100000 })], makeRng(7));
    ok(!tm.won && tm.log.some((e) => e.e === 'timeout') && tm.t <= C.BATTLE_CAP, 'the candle burns out');
    // elements matter: water beats a fire Hollow faster than fire does
    const dmg = (a, b) => resolve([ally(a, 1)], [dummy({ el: b, hp: 100000, atk: 0 })], makeRng(1)).log.find((e) => e.e === 'hit' && e.a === 'a0' && !e.crit).v;
    ok(dmg('w04', 'air') > dmg('w04', 'fire') && dmg('w04', 'water') < dmg('w04', 'fire'), 'Fire hits Air harder and Water softer');
}

// ------------------------------------------------------------------ determinism
if (want('determinism')) {
    section('determinism');
    const runOf = (seed, cut = -1) => {
        let G = newGame(seed);
        const rng = makeRng(seed + 1);
        for (let k = 0; k < 600; k++) {
            if (k === cut) G = deserialize(serialize(G));
            const c = botCommand(G, 'careful', rng);
            if (!c) break;
            act(G, c);
            G.events.length = 0;
        }
        return serialize(G);
    };
    ok(runOf(123) === runOf(123), 'the same seed and commands give the same run');
    ok(runOf(123) !== runOf(124), 'different seeds differ');
    for (const cut of [5, 40, 120]) ok(runOf(321, cut) === runOf(321), `a save round trip at command ${cut} plays on identically`);
    const G = newGame(3);
    ok(!('rng' in JSON.parse(serialize(G))) && !('events' in JSON.parse(serialize(G))), 'the rng and events are not saved');
    let bad = false; try { deserialize('{"v":1}'); } catch { bad = true; }
    ok(bad, 'an old save is refused');
}

// ------------------------------------------------------------------ bot
if (want('bot')) {
    section('bot');
    const table = {};
    for (const style of ['careful', 'casual', 'random']) {
        let wins = 0, lost = 0, pulls = 0, legs = 0, fights = 0, cleared = 0, inv = true;
        const reach = Array(11).fill(0);
        for (let s = 1; s <= SEEDS; s++) {
            const G = newGame(s * 7919);
            const r = playRun(G, style, {
                rng: makeRng(s),
                onStep: (g) => {
                    if (g.dust < 0 || g.lives < 0 || g.lives > C.LIVES || g.party.some((id) => id && !g.owned[id]) || g.items.length > C.MAX_ITEMS || g.pity >= C.PITY) inv = false;
                },
            });
            if (r.won) wins++;
            lost += C.LIVES - G.lives; pulls += G.stats.pulls; legs += G.stats.legendaries; fights += G.stats.fights;
            const c = r.won ? 10 : G.trial - 1; cleared += c; reach[c]++;
        }
        ok(inv, `${style}: invariants hold after every command`);
        table[style] = { win: wins / SEEDS, cleared: cleared / SEEDS, lost: lost / SEEDS, pulls: pulls / SEEDS, legs: legs / SEEDS, fights: fights / SEEDS, reach };
    }
    console.log('  style    win%  cleared  lives lost  draws  legendaries  battles  reached (0..10)');
    for (const [s, t] of Object.entries(table)) console.log(`  ${s.padEnd(8)} ${(t.win * 100).toFixed(0).padStart(4)}  ${t.cleared.toFixed(1).padStart(7)}  ${t.lost.toFixed(2).padStart(10)}  ${t.pulls.toFixed(0).padStart(5)}  ${t.legs.toFixed(1).padStart(11)}  ${t.fights.toFixed(1).padStart(7)}  ${t.reach.join(',')}`);
    ok(table.careful.win >= 0.7, 'a careful player usually saves the World');
    ok(table.careful.lost <= 1.3, 'and loses about one life or fewer');
    ok(table.casual.win >= 0.3 && table.casual.win <= table.careful.win, 'a casual player sometimes does, never more often');
    ok(table.random.win <= 0.1, 'a random spread almost never does');
    ok(table.careful.cleared > table.casual.cleared && table.casual.cleared > table.random.cleared, 'skill shows in how far each gets');
    ok(table.careful.legs >= 1.5, 'a whole run sees at least one or two Legendaries');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
