/**
 * simtest.mjs — headless checks of Quillsworn's rules. No browser.
 *
 *   node game-087/dev/simtest.mjs            # everything
 *   ONLY=purity,text,rules node game-087/dev/simtest.mjs
 *   VERBOSE=1 node game-087/dev/simtest.mjs
 *
 * purity: js/sim, js/book, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock.
 * text: word counts, the markup parser (always well-formed, crossing markers stay literal), typesetting, the Lens.
 * rules: XP and levels, the high-water mark (no XP twice), pasted words, every quest unlock, talents and points,
 *   relics, duels (damage, recovery, time out, drops), the oracle (seeded, every draw kept), bounties by date,
 *   streaks, laurels, deleting and moving things.
 * data: every scene line's speaker and mood, lessons referenced by quests exist, foes unlock in order, structures.
 * book: HTML, print, manuscript and Markdown outputs; the EPUB is a stored zip with mimetype first, good CRCs,
 *   every manifest item present and every XHTML file well-formed XML.
 * save: core + projects round trip; broken and unknown saves are rejected; ids never collide after a load.
 * bot: an apprentice who writes a fixed number of words a day plays the whole guild road to the finale,
 *   and the table prints the day, words and level at each quest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);

const C = await import('../js/config.js');
const St = await import('../js/sim/state.js');
const A = await import('../js/sim/actions.js');
const Pr = await import('../js/sim/progress.js');
const Q = await import('../js/sim/quests.js');
const D = await import('../js/sim/duel.js');
const T = await import('../js/sim/text.js');
const G = await import('../js/sim/data/guild.js');
const L = await import('../js/sim/data/lessons.js');
const Sc = await import('../js/sim/data/scenes.js');
const B = await import('../js/book/book.js');
const Z = await import('../js/book/zip.js');
const Art = await import('../js/view/art.js');
const Por = await import('../js/view/portrait.js');

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL', m); } else if (process.env.VERBOSE) console.log('  ok', m); return c; };
const section = (n) => console.log(`\n== ${n}`);
const ctxOf = (day, hour = 12, ms = 0) => ({ now: Date.UTC(2026, 9, 1) + day * 86400000 + hour * 3600000 + ms, today: St.dayOffset('2026-10-01', day), hour });
const lorem = (n, seed = 1) => {
    const W = 'the dragon slept beneath ashford while rain fell on silver roofs and a thief named mara counted the bells of the old abbey she had come to rob before dawn broke grey across the marsh'.split(' ');
    const out = [];
    for (let i = 0; i < n; i++) out.push(W[(i * 7 + seed * 13) % W.length]);
    // sentences of varied length
    let s = '', k = 0;
    for (let i = 0; i < out.length; i++) { s += (k === 0 ? out[i][0].toUpperCase() + out[i].slice(1) : out[i]); k++; if (k > 6 + ((i * 5) % 11)) { s += '. '; k = 0; } else s += ' '; }
    return s.trim().replace(/[^.]$/, (c) => c + '.');
};
/** A fresh game past the prologue with a bard calling. */
function started(seed = 7) {
    const S = St.newGame(seed, 0);
    const c = ctxOf(0);
    A.setIdentity(S, { name: 'Wren Ashby', calling: 'bard' }, c);
    A.finishPrologue(S, c);
    S.events.length = 0;
    return S;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js'];
    for (const dir of ['js/sim', 'js/sim/data', 'js/book']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.js')) files.push(`${dir}/${f}`);
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\b(document|window)\.[a-zA-Z]|localStorage|Math\.random|performance\.now|Date\.now|new Date\(\)|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('text')) {
    section('text');
    ok(T.countWords('The dragon’s hoard — forty-two gold coins.') === 6, 'counts words with apostrophes and hyphens, not dashes');
    ok(T.countWords('') === 0 && T.countWords('   ') === 0, 'empty text has no words');
    const bl = T.parseBlocks('First line.\n\n* * *\n> A letter\n> signed, M.\n\nLast line.');
    ok(bl.map((b) => b.type).join() === 'p,break,quote,p', 'blocks: paragraph, break, quote, paragraph');
    ok(bl[2].lines.length === 2, 'consecutive quote lines join');
    ok(T.inlineHtml('a *b* **c**', { smart: false }) === 'a <em>b</em> <strong>c</strong>', 'italic and bold');
    ok(T.inlineHtml('**a *b** c*', { smart: false }) === '**a <em>b** c</em>', 'a crossing marker stays literal');
    ok(T.inlineHtml('*unclosed', { smart: false }) === '*unclosed', 'an unclosed marker stays literal');
    ok(T.inlineHtml('snake_case_name', { smart: false }) === 'snake_case_name', 'underscores inside words stay literal');
    ok(T.inlineHtml('<script>&', { smart: false }) === '&lt;script&gt;&amp;', 'markup is escaped');
    ok(T.typeset('"Hello," she said -- \'twas... fine.') === '“Hello,” she said — ’twas… fine.', 'typographer’s quotes, dashes and ellipses');
    // fuzz: random marker soup must always balance
    let balanced = true;
    for (let i = 0; i < 400; i++) {
        let s = '';
        for (let k = 0; k < 20; k++) s += ['*', '**', '_', 'a', ' b ', '"', 'c_d'][(i * 31 + k * 17 + (i * k) % 7) % 7];
        const h = T.inlineHtml(s);
        const tags = h.match(/<\/?(em|strong)>/g) || [];
        const st = [];
        for (const t of tags) { if (t[1] !== '/') st.push(t); else if (st.pop()?.slice(1) !== t.slice(2)) balanced = false; }
        if (st.length) balanced = false;
    }
    ok(balanced, 'inline markup is always well-formed (400 fuzzed strings)');
    const r = T.analyze('She walked very slowly and quietly. She felt the cold. He exclaimed loudly. The door was opened by the guard. "Run," he said. "Now!" The chosen one sighed.');
    ok(r.adverbs.count >= 3, `adverbs found (${r.adverbs.count})`);
    ok(r.filters.count >= 1 && r.bookisms.count >= 1 && r.passive >= 1, 'filter words, bookisms and passive voice found');
    ok(r.cliches.some((c) => c[0] === 'the Chosen One'), 'clichés found');
    ok(r.dialogue > 0 && r.dialogue < 1, 'dialogue share between 0 and 1');
    const v = T.verdicts(T.analyze(lorem(300)));
    ok(v.length >= 3 && v.every(([tier, mood, line]) => [1, 2, 3].includes(tier) && Por.MOODS.includes(mood) && line.length > 10), 'verdicts have a tier, a known mood and a line');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    ok(Pr.levelFor(0) === 1 && Pr.levelFor(149) === 1 && Pr.levelFor(150) === 2 && Pr.levelFor(C.xpForLevel(10)) === 10, 'level thresholds');
    let S = started();
    let c = ctxOf(0);
    ok(S.player.main === 0 && S.order.length === 1 && S.activeId, 'the prologue starts the road and a first novel');
    ok(S.player.freeTalent === 'q_dialogue', 'the bard’s calling gives the Dialogue Lantern');
    ok(!Pr.roomOpen(S, 'scriptorium'), 'the Scriptorium is closed before the Spark');
    A.editCharter(S, { title: 'The Salt Crown', logline: 'When the sea takes her village, a young smith must forge a crown for a drowned king, or the tide will never turn.', premise: lorem(45) }, c);
    ok(Q.mainReady(S, c) && S.events.some((e) => e.type === 'quest-ready' && e.id === 'q_spark'), 'the Spark is ready and says so');
    const xp0 = S.player.xp;
    ok(A.turnInMain(S, c) === 'q_spark' && Pr.roomOpen(S, 'scriptorium') && Pr.roomOpen(S, 'board') && Pr.roomOpen(S, 'library'), 'turning in the Spark opens three rooms');
    ok(S.player.relics.includes('ribbon') && S.player.equipped.charm === 'ribbon', 'and gives (and wears) Thalion’s ribbon');
    ok(S.player.xp > xp0 + 150, 'quest XP gets the ribbon bonus');
    ok(A.turnInMain(S, c) === null, 'a quest that isn’t ready can’t be turned in');

    const P = St.active(S);
    const sid = P.chapters[0].scenes[0];
    const laurels = { ...S.player.laurels };
    for (const l of Pr.LAURELS) S.player.laurels[l.id] = 'x';   // keep laurel XP out of the sums
    const before = S.player.xp;
    A.writeScene(S, sid, lorem(100), c);
    const gained = S.player.xp - before;
    ok(Math.abs(gained - 100 * 1.1) < 1e-6, `100 words earn 110 XP as a bard (${gained.toFixed(1)})`);
    A.writeScene(S, sid, lorem(50), c);
    A.writeScene(S, sid, lorem(100), c);
    ok(Math.abs(S.player.xp - before - 110) < 1e-6, 'deleting and retyping earns nothing twice');
    A.writeScene(S, sid, lorem(400), c, { pasted: true });
    ok(Math.abs(S.player.xp - before - 110) < 1e-6 && S.player.stats.pasted === 300, 'pasted words earn no XP but are counted');
    ok(St.bookWords(P) === 400 && S.player.days[c.today] === 100, 'the book holds every word; the day only the written ones');
    S.player.laurels = laurels;
    ok(Q.mainReady(S, c), 'First Ink is ready at 150+ words in the book');
    A.turnInMain(S, c);
    ok(Pr.roomOpen(S, 'faces') && Pr.roomOpen(S, 'grounds') && S.player.equipped.quill === 'heron', 'First Ink opens the Hall of Faces and the Proving Grounds, and gives the heron quill');

    // bounties appear from here on, and don't change with a reload of the same day
    A.settle(S, c);
    ok(S.player.bounty.date === c.today && S.player.bounty.ids.length === 3 && S.player.bounty.ids[0] === 'b_goal', 'three bounties today, the first always the daily goal');
    const ids = [...S.player.bounty.ids];
    S.player.bounty.date = '';
    A.settle(S, c);
    ok(JSON.stringify(ids) === JSON.stringify(S.player.bounty.ids), 'the same day rolls the same bounties');

    // characters
    const hero = A.addCharacter(S, { name: 'Mara', role: 'Protagonist' }, c);
    ok(!Pr.charFleshed(hero), 'a new character is not fleshed out');
    const xpA = S.player.xp;
    A.editCharacter(S, hero.id, { want: 'To forge the crown.', need: 'To forgive her father.', flaw: 'She trusts no one.', wound: 'Her father sold her to the guild.', backstory: lorem(45) }, c);
    ok(Pr.charFleshed(hero) && S.player.xp - xpA >= C.XP.characterFleshed, 'a fleshed character pays its XP');
    const xpB = S.player.xp;
    A.editCharacter(S, hero.id, { notes: 'More.' }, c);
    ok(S.player.xp === xpB, '…once');
    const foe = A.addCharacter(S, { name: 'The Drowned King', role: 'Antagonist', want: 'To rule the land as he rules the sea.' }, c);
    A.setRelation(S, hero.id, foe.id, 'Sworn enemy', c);
    ok(S.player.stats.relations === 1, 'a bond is counted');
    ok(Q.mainReady(S, c), 'Faces in the Firelight is ready');
    A.turnInMain(S, c);
    ok(Pr.roomOpen(S, 'loom') && Pr.roomOpen(S, 'well'), 'it opens the Loom and the Well');

    // the loom
    A.chooseStructure(S, 'three', c);
    for (const b of G.STRUCTURE_BY_ID.three.beats.slice(0, 3)) A.editBeat(S, `three:${b.id}`, { notes: lorem(14) }, c);
    ok(Q.mainReady(S, c), 'three filled beats ready the Shape of the Tale');
    A.turnInMain(S, c);
    ok(Pr.roomOpen(S, 'loft') && S.player.equipped.inkwell === 'elvenwood' && Pr.deskTheme(S) === 'elvenwood', 'it opens the Loft and gives (and wears) the Elvenwood inkwell');

    // world and well
    for (const nm of ['Ashford', 'Saltmere']) { const e = A.addWorld(S, 'place', { name: nm, summary: 'A town.' }, c); A.editWorld(S, e.id, { details: lorem(32) }, c); }
    const mg = A.addWorld(S, 'magic', { name: 'Tidecalling', summary: 'Sea magic.', details: lorem(32) }, c);
    ok(!Pr.worldFleshed(mg), 'a magic without cost and limits is not set down');
    A.editWorld(S, mg.id, { cost: 'A memory.', limits: 'Not inland.' }, c);
    ok(Pr.worldFleshed(mg), 'with them, it is');
    const d1 = A.drawWell(S, 'name', { people: 'elven' }, c);
    ok(d1 && d1.kind === 'name' && d1.title.length > 3, 'the Well draws a name');
    ok(A.drawWell(S, 'twist', {}, c) === null, 'a locked draw returns nothing');
    A.keepDraw(S, d1, c);
    ok(St.active(S).characters.some((h) => h.name === d1.data.name), 'keeping a name makes a character');
    ok(Q.mainReady(S, c), 'Where the Road Goes is ready');
    const pts = S.player.bonusPoints;
    A.turnInMain(S, c);
    ok(S.player.bonusPoints === pts + 1, 'and gives a talent point');

    // talents
    ok(Pr.talentStatus(S, 'l_two') === 'level' || Pr.talentStatus(S, 'l_two') === 'req', 'a talent needs its level and prerequisite');
    const lv = Math.max(5, S.player.level + 2);
    S.events.length = 0;
    S.player.xp = C.xpForLevel(lv); A.settle(S, c);
    ok(S.player.level >= lv && S.events.some((e) => e.type === 'level'), 'XP raises the level, with events');
    ok(A.buyTalent(S, 'l_one', c) && Pr.hasTalent(S, 'l_one'), 'learning a talent');
    ok(A.buyTalent(S, 'l_two', c), 'its follower opens after it');
    for (const id of ['q_focus', 'q_goal', 'q_snap', 'd_hourglass', 'o_title', 'q_dialogue', 'o_quirk', 'o_twist', 'o_magic', 'l_three']) if (Pr.pointsFree(S) > 0) A.buyTalent(S, id, c);
    ok(Pr.pointsFree(S) === 0 && !A.buyTalent(S, 'q_find', c), 'no talent without a point');

    // duels
    ok(D.foeOpen(S, 'imp') && D.foeOpen(S, 'goblin') && !D.foeOpen(S, 'golem') && !D.foeOpen(S, 'hydra'), 'foes unlock along the road');
    let t = c.now;
    let duel = D.newDuel(S, 'imp', t);
    ok(duel.hp === 100 && Math.abs(duel.time - 300 * 1.15) < 1, `the imp: 100 hp, 5 minutes (+15% for the hourglass) (${duel.time})`);
    D.duelWrite(S, duel, 40, t += 10000);
    ok(duel.hp === 60, 'each word strikes for one');
    D.duelWrite(S, duel, 20, t += 1000); D.duelWrite(S, duel, 40, t += 1000);
    ok(duel.hp === 60, 'deleted and retyped words don’t strike twice');
    D.duelTick(S, duel, t += 35000);
    ok(duel.hp > 60 && duel.hp < 75, `pausing lets the foe recover (${duel.hp.toFixed(1)})`);
    ok(S.events.some((e) => e.type === 'taunt'), 'and taunt');
    D.duelWrite(S, duel, 140, t += 1000);
    ok(duel.state === 'won' && S.player.bestiary.imp.wins === 1 && S.player.relics.includes('jar'), 'a win records the foe and drops its relic');
    duel = D.newDuel(S, 'wraith', t);
    D.duelWrite(S, duel, 10, t += 1000);
    D.duelTick(S, duel, t += duel.time * 1000 + 1);
    ok(duel.state === 'lost' && S.player.bestiary.wraith.losses === 1, 'running out of time loses');
    duel = D.newDuel(S, 'wraith', t);
    D.duelWrite(S, duel, 260, t += 60000);
    ok(duel.state === 'won' && S.player.relics.includes('raven'), 'the wraith drops the raven quill');
    A.settle(S, c);
    ok(Q.mainReady(S, c), 'two wins ready Steel and Ink');
    A.turnInMain(S, c);
    ok(D.foeOpen(S, 'golem') && S.player.relics.includes('midnight'), 'which wakes the Golem and gives the Midnight inkwell');
    const dum = D.newDuel(S, 'scarecrow', t, { words: 50, minutes: 2 });
    ok(dum.hp === 50 && dum.regen === 0, 'the training dummy takes custom words and never recovers');

    // relics
    A.wear(S, 'raven', c);
    ok(S.player.equipped.quill === 'raven' && Pr.bonuses(S).duelDamage >= 0.15, 'wearing the raven quill adds duel damage');
    ok(!A.wear(S, 'phoenix', c), 'a relic you don’t own can’t be worn');

    // moving and deleting
    const P2 = St.active(S);
    const { ch: ch2 } = A.addChapter(S, 'The Road', c);
    const s2 = A.addScene(S, ch2.id, 'Night', c);
    ok(P2.chapters.length === 2 && ch2.scenes.length === 2, 'chapters and scenes are added');
    A.moveScene(S, ch2.scenes[0], -1, c);
    ok(P2.chapters[0].scenes.length === 2 && ch2.scenes.length === 1, 'moving the first scene up crosses into the previous chapter');
    A.moveChapter(S, ch2.id, -1, c);
    ok(P2.chapters[0] === ch2, 'chapters move');
    A.toggleWeave(S, A.addThread(S, 'The crown', c).id, ch2.id, c);
    A.deleteChapter(S, ch2.id, c);
    ok(P2.chapters.length === 1 && !P2.scenes[s2.id] && P2.threads.every((th) => !th.cells[ch2.id]), 'deleting a chapter removes its scenes and its woven cells');
    ok(!A.deleteChapter(S, P2.chapters[0].id, c), 'the last chapter can’t be deleted');
    A.deleteCharacter(S, foe.id, c);
    ok(P2.characters.every((h) => h.relations.every((r) => r.to !== foe.id)), 'deleting a character removes bonds to them');

    // find and replace never earns XP
    const xr = S.player.xp;
    S.player.talents.push('q_find');
    const nrep = A.replaceAll(S, 'thief', 'great wyrm of the north', {}, c);
    ok(nrep > 0 && S.player.xp === xr, `find and replace (${nrep}) earns no XP`);
    // snapshots
    const sc0 = P2.scenes[P2.chapters[0].scenes[0]];
    ok(A.snapshot(S, sc0.id, 'first', c) && sc0.snaps.length === 1, 'a snapshot');
    const txt = sc0.text;
    A.writeScene(S, sc0.id, 'Gone.', c);
    A.restoreSnapshot(S, sc0.id, 0, c);
    ok(sc0.text === txt && sc0.snaps[0].label === 'Before restoring', 'restoring keeps what was there as a snapshot');

    // streaks
    S = started(9);
    for (let d = 0; d < 7; d++) { S.player.days[ctxOf(d).today] = 400; }
    ok(St.streak(S.player, ctxOf(6).today) === 7 && St.streak(S.player, ctxOf(7).today) === 7, 'a streak counts today, or up to yesterday');
    ok(St.streak(S.player, ctxOf(8).today) === 0, 'a missed day ends it');
    A.settle(S, ctxOf(6));
    ok(S.player.stats.bestStreak === 7 && S.player.laurels.streak7, 'the best streak and its laurel');
    // free pen
    S = started(10);
    A.setFreePen(S, true, ctxOf(0));
    ok(G.ROOMS.every((r) => Pr.roomOpen(S, r.id)) && Pr.hasTalent(S, 'b_map') && D.foeOpen(S, 'critic'), 'Free Pen opens every room, talent and foe');
    // night and dawn
    S = started(11);
    A.writeScene(S, St.active(S).chapters[0].scenes[0], lorem(210), ctxOf(0, 2));
    ok(S.player.stats.nightWords === 210 && S.player.today.night === 210, 'words written at 2am are night words');
}

// ======================================================================
if (want('data')) {
    section('data');
    const lines = Object.values(Sc.SCENES).flat();
    ok(lines.every((l) => l.ask ? ['name', 'sigil', 'calling'].includes(l.ask) : (['thalion', 'narrator'].includes(l.who) && l.text && (l.who !== 'thalion' || Por.MOODS.includes(l.mood)))), `every scene line has a speaker, text and a known mood (${lines.length} lines)`);
    ok(lines.every((l) => !l.text || !/\{(?!name\}|title\}|rank\}|kind\}|level\})[^}]*\}/.test(l.text)), 'placeholders are only {name}, {title}, {rank}, {kind}, {level}');
    for (const q of Q.MAIN) {
        ok(q.reward.lessons.every((id) => L.LESSON_BY_ID[id]), `${q.id}: its lessons exist`);
        ok(!q.reward.relic || G.RELIC_BY_ID[q.reward.relic], `${q.id}: its relic exists`);
        ok(Q.MAIN.indexOf(q) === 0 || Sc.SCENES[`start_${q.id}`], `${q.id}: has a start scene`);
        ok(Sc.SCENES[`done_${q.id}`], `${q.id}: has an end scene`);
    }
    ok(G.FOES.every((f) => Q.MAIN_BY_ID[f.after] && (!f.drop || G.RELIC_BY_ID[f.drop])), 'every foe unlocks after a real quest and drops a real relic');
    ok(G.TALENTS.every((t) => !t.req || G.TALENT_BY_ID[t.req]) && G.CALLINGS.every((c) => G.TALENT_BY_ID[c.talent]), 'talent prerequisites and calling gifts exist');
    ok(new Set(L.LESSONS.map((l) => l.id)).size === L.LESSONS.length && L.LESSONS.every((l) => G.ROOM_BY_ID[l.room] && Por.MOODS.includes(l.mood)), `lessons are unique, in real rooms, with known moods (${L.LESSONS.length})`);
    ok(G.ROOMS.filter((r) => r.id !== 'hall').every((r) => Sc.SCENES[`visit_${r.id}`]), 'every room has a first-visit line');
    ok(G.STRUCTURES.every((s) => s.beats.length >= 4 && new Set(s.beats.map((b) => b.id)).size === s.beats.length), 'structures have unique beats');
    // rooms needed by each quest are open by the time it starts
    const need = { q_first_ink: 'scriptorium', q_faces: 'faces', q_shape: 'loom', q_road: 'loft', q_steel: 'grounds', q_thousand: 'scriptorium', q_binding: 'bindery', q_middle: 'grounds' };
    const opened = new Set(['hall']);
    for (const q of Q.MAIN) {
        if (need[q.id]) ok(opened.has(need[q.id]), `${q.id} starts with the ${need[q.id]} open`);
        for (const r of q.reward.rooms || []) opened.add(r);
    }
    ok(G.ROOMS.every((r) => opened.has(r.id)), 'the road opens every room');
    for (const id of Object.keys(Art.CHARGES)) ok(/^<svg[\s\S]*<\/svg>$/.test(Art.sigilSvg({ charge: id })), `sigil charge ${id} draws`);
    ok(G.FOES.every((f) => Art.foeSvg(f.id).includes('<g class="eyes">')), 'every foe has eyes to blink');
    for (const m of Por.MOODS) ok(Por.thalionSvg(m).startsWith('<svg'), `Thalion: ${m}`);
}

// ======================================================================
/** A tiny XML well-formedness checker: tags balance, attributes are quoted, entities are known. */
function wellFormed(xml) {
    const s = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/i, '').replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    const re = /<\/?([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<|&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);|&/gi;
    let m;
    while ((m = re.exec(s))) {
        if (m[0] === '<') return `stray < at ${m.index}: ${s.slice(m.index, m.index + 40)}`;
        if (m[0] === '&') return `bare & at ${m.index}: ${s.slice(m.index, m.index + 30)}`;
        if (m[0][0] === '&') continue;
        if (m[0][1] === '/') { if (stack.pop() !== m[1]) return `mismatched </${m[1]}>`; } else if (!m[3]) stack.push(m[1]);
    }
    return stack.length ? `unclosed <${stack.pop()}>` : '';
}

if (want('book')) {
    section('book');
    const S = started(21);
    const c = ctxOf(0);
    A.editCharter(S, { title: 'The Salt & the "Crown"', subtitle: 'Book <One>', logline: 'A smith & a king.' }, c);
    const P = St.active(S);
    A.writeScene(S, P.chapters[0].scenes[0], `"Begin," she said. *The tide* came in, **hard** & fast.\n* * *\n> A letter\n> from the sea\nAnd then -- silence... ${lorem(80)}`, c);
    const { ch } = A.addChapter(S, 'The Drowned Bell', c);
    A.writeScene(S, ch.scenes[0], lorem(120), c);
    A.addChapter(S, 'Chapter Three', c);  // empty: left out of the book
    A.addCharacter(S, { name: 'Mara <the smith>', role: 'Protagonist', appearance: 'Burn scars & a loud laugh. Tall.' }, c);
    A.addWorld(S, 'place', { name: 'Saltmere', summary: 'A port of bells.' }, c);
    A.editBook(S, { dedication: 'For R. & the cat.', epigraph: 'All tides return.', epigraphBy: 'Old saying', dramatis: true, glossary: true }, c);
    const m = B.bookModel(P, { illum: true, appendices: true, sigilSvg: Art.sigilSvg(S.player.sigil), today: '2026-10-19' });
    ok(m.chapters.length === 2, 'empty chapters are left out');
    ok(m.chapters[0].label === 'Chapter One' && m.chapters[0].title === '' && m.chapters[1].title === 'The Drowned Bell', 'generic titles become labels; real ones are kept');
    ok(m.dramatis.length === 1 && m.dramatis[0].line === 'Burn scars & a loud laugh.' && m.glossary.length === 1, 'dramatis personae and glossary');
    const html = B.buildHtml(m);
    ok(html.startsWith('<!DOCTYPE html>') && html.includes('<span class="dc">') && html.includes('&amp; the “Crown”'), 'HTML: doctype, a drop cap and escaped, typeset title');
    ok(!/<script/i.test(html), 'HTML has no scripts');
    const body = html.slice(html.indexOf('<main>'), html.indexOf('</main>') + 7);
    ok(wellFormed(body) === '', `HTML body is well-formed (${wellFormed(body)})`);
    const pr = B.buildPrint(m);
    ok(/@page \{ size: 6in 9in/.test(pr) && /counter\(page\)/.test(pr), 'print: page size and page numbers');
    const ms = B.buildManuscript(m);
    ok(ms.includes('About 200 words') && ms.includes('THE END') && /@top-right/.test(ms), 'manuscript: word count, header and THE END');
    const md = B.buildMarkdown(m);
    ok(md.startsWith('# The Salt & the "Crown"') && md.includes('## Chapter Two: The Drowned Bell') && md.includes('* * *'), 'Markdown');
    ok(B.numberWords(42) === 'Forty-Two' && B.roman(14) === 'XIV', 'number words and roman numerals');

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const epub = B.buildEpub(m, { mapPng: new Uint8Array(png), modified: '2026-10-19T00:00:00Z' });
    const files = Z.unzip(epub);
    ok(files[0].name === 'mimetype' && files[0].method === 0 && files[0].extra === 0 && new TextDecoder().decode(files[0].data) === 'application/epub+zip', 'EPUB: mimetype first, stored, no extra field');
    ok(files.every((f) => f.crcOk && f.method === 0), 'EPUB: every CRC is right');
    const byName = Object.fromEntries(files.map((f) => [f.name, new TextDecoder().decode(f.data)]));
    ok(byName['META-INF/container.xml'].includes('OEBPS/content.opf'), 'EPUB: container points at the package');
    const opf = byName['OEBPS/content.opf'];
    const hrefs = [...opf.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
    ok(hrefs.every((h) => byName[`OEBPS/${h}`] !== undefined), `EPUB: every manifest item is in the zip (${hrefs.length})`);
    ok([...opf.matchAll(/idref="([^"]+)"/g)].every((x) => opf.includes(`id="${x[1]}"`)), 'EPUB: every spine item is in the manifest');
    ok(/properties="nav"/.test(opf) && /properties="cover-image"/.test(opf) && /dcterms:modified">2026-10-19T00:00:00Z/.test(opf), 'EPUB: nav, cover image and modified date');
    for (const [name, text] of Object.entries(byName)) {
        if (!/\.(xhtml|opf|ncx|xml|svg)$/.test(name)) continue;
        const w = wellFormed(text);
        ok(w === '', `EPUB: ${name} is well-formed${w ? ` (${w})` : ''}`);
    }
    ok(byName['OEBPS/chapter-001.xhtml'].includes('<blockquote><p>A letter<br/>from the sea</p></blockquote>'), 'EPUB: quotations keep their lines');
    // a real zip tool must agree, if one is installed
    const tmp = path.join(HERE, 'shots');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'test.epub'), epub);
    const { spawnSync } = await import('node:child_process');
    const unz = spawnSync('unzip', ['-t', path.join(tmp, 'test.epub')], { encoding: 'utf8' });
    if (unz.status !== null && !unz.error) ok(unz.status === 0 && /No errors/.test(unz.stdout), 'EPUB: unzip -t finds no errors');
    else console.log('  (no unzip installed; skipped the external zip check)');
}

// ======================================================================
if (want('save')) {
    section('save');
    const S = started(31);
    const c = ctxOf(0);
    A.editCharter(S, { title: 'Round Trip' }, c);
    A.writeScene(S, St.active(S).chapters[0].scenes[0], lorem(60), c);
    A.addCharacter(S, { name: 'Ash' }, c);
    const core = JSON.parse(JSON.stringify(St.serializeCore(S)));
    const projects = Object.fromEntries(S.order.map((id) => [id, JSON.parse(JSON.stringify(St.serializeProject(S.projects[id])))]));
    const R = St.deserialize(core, projects);
    ok(JSON.stringify(St.serializeCore(R)) === JSON.stringify(St.serializeCore(S)), 'the core round-trips');
    ok(JSON.stringify(R.projects) === JSON.stringify(S.projects), 'the novels round-trip');
    let threw = false;
    try { St.deserialize({ v: 99, player: {} }, {}); } catch { threw = true; }
    ok(threw, 'an unknown version is rejected');
    threw = false;
    try { St.deserialize({ v: 1 }, {}); } catch { threw = true; }
    ok(threw, 'a save with no apprentice is rejected');
    const R2 = St.deserialize({ ...core, order: [...core.order, 'p999'] }, projects);
    ok(R2.order.length === core.order.length, 'a missing novel is dropped from the list, not half-loaded');
    const R3 = St.deserialize({ ...core, nextId: 1 }, projects);
    const fresh = St.newId(R3, 's');
    ok(!JSON.stringify(R3.projects).includes(`"id":"${fresh}"`), 'ids never collide with a saved novel’s, even from an old core');
    const old = JSON.parse(JSON.stringify(core));
    delete old.player.stats.relations; delete old.player.attrs;
    const R4 = St.deserialize(old, projects);
    ok(R4.player.stats.relations === 0 && R4.player.attrs.voice >= 1, 'fields a later version added are filled in');
    const tampered = JSON.parse(JSON.stringify(projects));
    const pid = core.order[0];
    tampered[pid].scenes[tampered[pid].chapters[0].scenes[0]].words = 99999;
    const R5 = St.deserialize(core, tampered);
    ok(St.bookWords(R5.projects[pid]) === 60, 'word counts are recounted from the text on load');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    // An apprentice who writes PER_DAY words a day, does whatever the current quest asks, and buys talents.
    for (const PER_DAY of [1700, 800]) {
        const S = St.newGame(77, 0);
        let day = 0;
        A.setIdentity(S, { name: 'Bot', calling: 'weaver' }, ctxOf(0));
        A.finishPrologue(S, ctxOf(0));
        const rows = [];
        let guard = 0;
        let chapterWordsLeft = 0;
        const P = () => St.active(S);
        const write = (n, c) => {
            // add a chapter every ~3,000 words and a scene every ~1,000
            let cur = P().chapters[P().chapters.length - 1];
            if (chapterWordsLeft <= 0) { if (St.bookWords(P()) > 0) cur = A.addChapter(S, '', c).ch; chapterWordsLeft = 3000; }
            let sc = P().scenes[cur.scenes[cur.scenes.length - 1]];
            if (sc.words > 1000) sc = A.addScene(S, cur.id, '', c);
            A.writeScene(S, sc.id, (sc.text ? sc.text + '\n' : '') + lorem(n, day), c);
            chapterWordsLeft -= n;
        };
        const duel = (id, c) => {
            const f = G.FOE_BY_ID[id];
            const d = D.newDuel(S, id, c.now);
            // the bot writes 40 words a minute
            let t = c.now, w = 0;
            while (d.state === 'on') { t += 15000; w += 10; D.duelWrite(S, d, w, t); }
            // the duel's words go into the book
            write(Math.min(w, f.hp), c);
            return d.state === 'won';
        };
        while (S.player.main < Q.MAIN.length && guard++ < 400) {
            const c = ctxOf(day, 9);
            A.settle(S, c);
            const q = Q.mainQuest(S);
            if (q.id === 'q_spark') A.editCharter(S, { title: 'The Bot’s Tale', logline: lorem(14), premise: lorem(45) }, c);
            if (q.id === 'q_faces') {
                const h = A.addCharacter(S, { name: 'Hero', role: 'Protagonist', want: 'a', need: 'b', flaw: 'c', wound: 'd', backstory: lorem(45) }, c);
                A.addCharacter(S, { name: 'Villain', role: 'Antagonist', want: 'Everything.' }, c);
                if (!h) break;
            }
            if (q.id === 'q_shape') { A.chooseStructure(S, 'journey', c); for (const b of G.STRUCTURE_BY_ID.journey.beats.slice(0, 3)) A.editBeat(S, `journey:${b.id}`, { notes: lorem(14) }, c); }
            if (q.id === 'q_road') {
                for (const nm of ['A', 'B']) A.addWorld(S, 'place', { name: nm, summary: 's', details: lorem(32) }, c);
                A.addWorld(S, 'magic', { name: 'M', summary: 's', details: lorem(32), cost: 'c', limits: 'l' }, c);
                A.keepDraw(S, A.drawWell(S, 'place', {}, c), c);
            }
            if (q.id === 'q_steel') { duel('imp', c); duel('wraith', c); }
            if (q.id === 'q_binding') A.noteExport(S, 'epub', c);
            if (q.id === 'q_middle' && St.bookWords(P()) >= 10000 && !S.player.bestiary.hydra?.wins) duel('hydra', c);
            if (q.id === 'q_critic' && St.bookWords(P()) >= 25000 && !S.player.bestiary.critic?.wins) duel('critic', c);
            if (q.id === 'q_revision') {
                if (!Pr.hasTalent(S, 'q_snap')) A.buyTalent(S, 'q_snap', c);
                const list = St.sceneList(P()).slice(0, 5);
                for (const { sc } of list) { A.editScene(S, sc.id, { status: 'revised' }, c); A.snapshot(S, sc.id, 'r', c); }
            }
            if (q.id === 'q_last_page' && St.bookWords(P()) >= C.NOVEL_WORDS) A.setComplete(S, true, c);
            // spend points, cheapest level first
            for (const t of [...G.TALENTS].sort((a, b) => a.level - b.level)) A.buyTalent(S, t.id, c);
            if (Q.mainReady(S, c)) {
                const id = A.turnInMain(S, c);
                rows.push({ quest: id, day, words: St.bookWords(P()), level: S.player.level, rank: Pr.rankName(S) });
                continue;      // same day: the next quest may already be done
            }
            write(PER_DAY, c);
            day++;
        }
        ok(S.player.main === Q.MAIN.length, `${PER_DAY} words a day: the bot finishes the guild road (${day} days)`);
        ok(S.player.relics.includes('lamp') && P().status === 'complete', 'with the Lamp of Vellmere and a finished novel');
        ok(G.ROOMS.every((r) => Pr.roomOpen(S, r.id)), 'every room opened along the way');
        ok(S.player.laurels.novel && S.player.laurels.critic, 'the Novelist and Silenced Critic laurels');
        const at = (id) => rows.find((r) => r.quest === id);
        ok(at('q_first_ink').day <= 1 && at('q_thousand').day <= 5, 'the early road takes a few days');
        ok(S.player.level >= 25 && S.player.level <= 45, `a novel lands between levels 25 and 45 (level ${S.player.level}, ${Pr.rankName(S)})`);
        ok(Pr.pointsFree(S) >= 0 && G.TALENTS.every((t) => Pr.hasTalent(S, t.id)), 'every talent learned by the end');
        console.log(`  ${PER_DAY} words/day`.padEnd(18) + rows.map((r) => `${r.quest.replace('q_', '')} d${r.day} L${r.level}`).join(' · '));
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
