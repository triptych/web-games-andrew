// Quests as pure checks: every step is a function of the state that returns [done, of]. A quest whose steps
// are all full is ready; Thalion (main) or the Quest Board (side) turns it in. Bounties complete themselves.

import { NOVEL_WORDS, FIELD } from '../config.js';
import { FOES, STRUCTURE_BY_ID } from './data/guild.js';
import { countWords } from './text.js';
import { active, bookWords, sceneList, streak } from './state.js';
import { charFleshed, worldFleshed, beatFilled, gainXp, giveRelic, openRoom, teach, hasTalent, touchToday } from './progress.js';
import { hashString, makeRng } from '../rng.js';

const emit = (S, e) => S.events.push(e);
const n = (v, of) => [Math.min(v, of), of];
const P_ = (S) => active(S);
const words = (S) => bookWords(P_(S));
const wins = (S, id) => S.player.bestiary[id]?.wins || 0;
const duelWins = (S) => FOES.filter((f) => !f.training).reduce((a, f) => a + wins(S, f.id), 0);
const roleOf = (c) => (c.role || '').toLowerCase();

/** The guild's road, in order. Steps read the active novel; XP and duels are the apprentice's own. */
export const MAIN = [
    {
        id: 'q_spark', title: 'The Spark', blurb: 'Found your novel: a title, a kind of fantasy, a logline and a premise.',
        where: 'Open the Novel Charter from the Great Hall.',
        steps: [
            ['Name your novel', (S) => n(P_(S) && P_(S).title.trim() && P_(S).title !== 'Untitled' ? 1 : 0, 1)],
            [`Write a logline of ${FIELD.loglineWords}+ words`, (S) => n(countWords(P_(S)?.logline), FIELD.loglineWords)],
            [`Write a premise of ${FIELD.premiseWords}+ words`, (S) => n(countWords(P_(S)?.premise), FIELD.premiseWords)],
        ],
        reward: { xp: 150, rooms: ['scriptorium', 'board', 'library'], relic: 'ribbon', lessons: ['logline'] },
    },
    {
        id: 'q_first_ink', title: 'First Ink', blurb: 'Write the first 150 words of your novel in the Scriptorium.',
        where: 'The Scriptorium.',
        steps: [['Write 150 words', (S) => n(words(S), 150)]],
        reward: { xp: 150, rooms: ['faces', 'grounds'], relic: 'heron', lessons: ['badly'] },
    },
    {
        id: 'q_faces', title: 'Faces in the Firelight', blurb: 'Flesh out your protagonist, and give your antagonist a want.',
        where: 'The Hall of Faces.',
        steps: [
            ['Flesh out a protagonist (every core field and a backstory)', (S) => n((P_(S)?.characters || []).some((c) => roleOf(c) === 'protagonist' && charFleshed(c)) ? 1 : 0, 1)],
            ['Give an antagonist a want', (S) => n((P_(S)?.characters || []).some((c) => roleOf(c) === 'antagonist' && (c.want || '').trim()) ? 1 : 0, 1)],
        ],
        reward: { xp: 250, rooms: ['loom', 'well'], lessons: ['wantneed', 'villain'] },
    },
    {
        id: 'q_shape', title: 'The Shape of the Tale', blurb: 'Choose a structure on the Plot Loom and fill three of its beats.',
        where: 'The Plot Loom.',
        steps: [
            ['Choose a structure', (S) => n(P_(S)?.outline.structure ? 1 : 0, 1)],
            ['Fill three beats', (S) => {
                const P = P_(S), st = P && STRUCTURE_BY_ID[P.outline.structure];
                return n(st ? st.beats.filter((b) => beatFilled(P.outline.beats[`${st.id}:${b.id}`])).length : 0, 3);
            }],
        ],
        reward: { xp: 250, rooms: ['loft'], relic: 'elvenwood', lessons: ['tryfail'] },
    },
    {
        id: 'q_road', title: 'Where the Road Goes', blurb: 'Set down two places and a magic with a cost and a limit, and draw from the Muse’s Well.',
        where: 'The Cartographer’s Loft and the Muse’s Well.',
        steps: [
            ['Set down two places', (S) => n((P_(S)?.world || []).filter((e) => e.kind === 'place' && worldFleshed(e)).length, 2)],
            ['Set down a magic, with its cost and its limits', (S) => n((P_(S)?.world || []).some((e) => e.kind === 'magic' && worldFleshed(e)) ? 1 : 0, 1)],
            ['Keep something drawn from the Well', (S) => n(S.player.stats.kept, 1)],
        ],
        reward: { xp: 300, lessons: ['cost', 'iceberg'], points: 1 },
    },
    {
        id: 'q_steel', title: 'Steel and Ink', blurb: 'Win two ink duels in the Proving Grounds.',
        where: 'The Proving Grounds.',
        steps: [['Win two duels', (S) => n(duelWins(S), 2)]],
        reward: { xp: 300, relic: 'midnight', lessons: ['sprint'] },
    },
    {
        id: 'q_thousand', title: 'A Thousand Words', blurb: 'Write a thousand words, across at least three scenes and two chapters.',
        where: 'The Scriptorium.',
        steps: [
            ['Write 1,000 words', (S) => n(words(S), 1000)],
            ['Three scenes with words in them', (S) => n(P_(S) ? sceneList(P_(S)).filter(({ sc }) => sc.words > 0).length : 0, 3)],
            ['Two chapters with words in them', (S) => n(P_(S) ? P_(S).chapters.filter((c) => c.scenes.some((id) => P_(S).scenes[id]?.words > 0)).length : 0, 2)],
        ],
        reward: { xp: 400, rooms: ['bindery'], lessons: ['scene'] },
    },
    {
        id: 'q_binding', title: 'The First Binding', blurb: 'Bind your book in the Bindery, as a web page, an EPUB or a PDF, even unfinished.',
        where: 'The Bindery.',
        steps: [['Bind the book once', (S) => { const e = S.player.stats.exports; return n(e.html + e.epub + e.pdf + e.md + e.manuscript > 0 ? 1 : 0, 1); }]],
        reward: { xp: 300, points: 1, lessons: ['revision'] },
    },
    {
        id: 'q_middle', title: 'The Sagging Middle', blurb: 'Reach ten thousand words, and drain the Mire-Hydra’s swamp.',
        where: 'The Scriptorium and the Proving Grounds.',
        steps: [
            ['Write 10,000 words', (S) => n(words(S), 10000)],
            ['Defeat the Mire-Hydra of the Sagging Middle', (S) => n(wins(S, 'hydra') ? 1 : 0, 1)],
        ],
        reward: { xp: 800, lessons: ['middle'], points: 1 },
    },
    {
        id: 'q_critic', title: 'The Inner Critic', blurb: 'Reach twenty-five thousand words, and face the Critic.',
        where: 'The Scriptorium and the Proving Grounds.',
        steps: [
            ['Write 25,000 words', (S) => n(words(S), 25000)],
            ['Defeat the Inner Critic', (S) => n(wins(S, 'critic') ? 1 : 0, 1)],
        ],
        reward: { xp: 1200, relic: 'moonsilver', lessons: ['critic'] },
    },
    {
        id: 'q_revision', title: 'Revision’s Fire', blurb: 'Revise five scenes (mark them revised), and keep three snapshots of your drafts.',
        where: 'The Scriptorium. Snapshots need the Chronicle of Drafts talent.',
        steps: [
            ['Revise five scenes of 100+ words', (S) => n(P_(S) ? sceneList(P_(S)).filter(({ sc }) => (sc.status === 'revised' || sc.status === 'final') && sc.words >= 100).length : 0, 5)],
            ['Keep three snapshots', (S) => n(P_(S) ? sceneList(P_(S)).reduce((a, { sc }) => a + sc.snaps.length, 0) : 0, 3)],
        ],
        reward: { xp: 900, lessons: ['aloud', 'kill'], points: 1 },
    },
    {
        id: 'q_last_page', title: 'The Last Page', blurb: `Finish the novel: ${NOVEL_WORDS.toLocaleString('en')} words, and the words “The End” in your heart. Mark it complete in the Charter.`,
        where: 'The Novel Charter.',
        steps: [
            [`Write ${NOVEL_WORDS.toLocaleString('en')} words`, (S) => n(words(S), NOVEL_WORDS)],
            ['Mark the novel complete', (S) => n(P_(S)?.status === 'complete' ? 1 : 0, 1)],
        ],
        reward: { xp: 3000, relic: 'lamp', lessons: ['endings', 'finish'], points: 2 },
    },
];
export const MAIN_BY_ID = Object.fromEntries(MAIN.map((q, i) => [q.id, { ...q, index: i }]));

/** Side quests from the Quest Board, offered once the main road reaches `after` (a main quest id, turned in). */
export const SIDE = [
    { id: 's_logline', title: 'One Breath', after: 'q_spark', blurb: 'Ask Thalion for three lessons, in any rooms.', xp: 120,
        check: (S) => n(S.player.stats.asked, 3) },
    { id: 's_company', title: 'The Company', after: 'q_faces', blurb: 'Flesh out five characters in one novel.', xp: 350,
        check: (S) => n((P_(S)?.characters || []).filter(charFleshed).length, 5) },
    { id: 's_web', title: 'A Web of Hearts', after: 'q_faces', blurb: 'Write four bonds between characters (in their Bonds).', xp: 200,
        check: (S) => n((P_(S)?.characters || []).reduce((a, c) => a + (c.relations || []).filter((r) => r.to && (r.label || '').trim()).length, 0), 4) },
    { id: 's_villain_pov', title: 'The Other Side', after: 'q_faces', blurb: 'Write a scene of 300+ words from your antagonist’s point of view.', xp: 300,
        check: (S) => { const P = P_(S); if (!P) return n(0, 1); const ant = new Set(P.characters.filter((c) => roleOf(c) === 'antagonist').map((c) => c.id)); return n(sceneList(P).some(({ sc }) => ant.has(sc.pov) && sc.words >= 300) ? 1 : 0, 1); } },
    { id: 's_silence', title: 'No One Speaks', after: 'q_first_ink', blurb: 'Write a scene of 300+ words with no dialogue at all.', xp: 200,
        check: (S) => n(P_(S) && sceneList(P_(S)).some(({ sc }) => sc.words >= 300 && !/["“”]/.test(sc.text)) ? 1 : 0, 1) },
    { id: 's_talk', title: 'All Talk', after: 'q_first_ink', blurb: 'Write a scene of 200+ words that is mostly dialogue.', xp: 200,
        check: (S) => n(P_(S) && sceneList(P_(S)).some(({ sc }) => sc.words >= 200 && dialogueShare(sc.text) >= 0.5) ? 1 : 0, 1) },
    { id: 's_sword', title: 'A Blade With a Name', after: 'q_shape', blurb: 'Set down an artifact in the Cartographer’s Loft.', xp: 150,
        check: (S) => n((P_(S)?.world || []).some((e) => e.kind === 'artifact' && worldFleshed(e)) ? 1 : 0, 1) },
    { id: 's_pantheon', title: 'Gods and Grudges', after: 'q_shape', blurb: 'Set down a faction, a culture and a piece of lore.', xp: 300,
        check: (S) => n(['faction', 'culture', 'lore'].filter((k) => (P_(S)?.world || []).some((e) => e.kind === k && worldFleshed(e))).length, 3) },
    { id: 's_atlas', title: 'The Atlas', after: 'q_shape', blurb: 'Pin five places on your map.', xp: 250,
        check: (S) => n(P_(S)?.map.pins.length || 0, 5) },
    { id: 's_threads', title: 'The Weaver’s Pride', after: 'q_faces', blurb: 'Weave three threads, each through three chapters or more.', xp: 300,
        check: (S) => n((P_(S)?.threads || []).filter((t) => Object.values(t.cells).filter(Boolean).length >= 3).length, 3) },
    { id: 's_full', title: 'Every Beat', after: 'q_shape', blurb: 'Fill every beat of your chosen structure.', xp: 500,
        check: (S) => { const P = P_(S), st = P && STRUCTURE_BY_ID[P.outline.structure]; return st ? n(st.beats.filter((b) => beatFilled(P.outline.beats[`${st.id}:${b.id}`])).length, st.beats.length) : n(0, 1); } },
    { id: 's_ten', title: 'Ten Doors', after: 'q_thousand', blurb: 'Ten chapters with words in them.', xp: 400,
        check: (S) => n(P_(S) ? P_(S).chapters.filter((c) => c.scenes.some((id) => P_(S).scenes[id]?.words > 0)).length : 0, 10) },
    { id: 's_streak', title: 'The Small Daily Fire', after: 'q_first_ink', blurb: 'Meet your daily goal seven days in a row.', xp: 500,
        check: (S, ctx) => n(Math.max(S.player.stats.bestStreak, ctx?.today ? streak(S.player, ctx.today) : 0), 7) },
    { id: 's_hunter', title: 'Monster Hunter', after: 'q_steel', blurb: 'Defeat five different foes in the Proving Grounds.', xp: 400,
        check: (S) => n(FOES.filter((f) => !f.training && wins(S, f.id) > 0).length, 5) },
    { id: 's_student', title: 'A Student of the Craft', after: 'q_spark', blurb: 'Learn twenty lessons from Thalion.', xp: 400,
        check: (S) => n(S.player.lessons.length, 20) },
    { id: 's_epub', title: 'The Traveller’s Edition', after: 'q_thousand', blurb: 'Bind your book as an EPUB, for readers who travel.', xp: 150,
        check: (S) => n(S.player.stats.exports.epub > 0 ? 1 : 0, 1) },
    { id: 's_pdf', title: 'The Printer’s Proof', after: 'q_thousand', blurb: 'Bind your book for print, as a PDF.', xp: 150,
        check: (S) => n(S.player.stats.exports.pdf > 0 ? 1 : 0, 1) },
    { id: 's_prophecy', title: 'As Was Foretold', after: 'q_faces', blurb: 'Keep a prophecy from the Muse’s Well (it needs the Prophecy Engine).', xp: 200,
        check: (S) => n(S.player.stats.keptProphecy, 1) },
    { id: 's_lark', title: 'Before the Lark', after: 'q_first_ink', blurb: 'Write 200 words between four and seven in the morning.', xp: 250,
        check: (S) => n(S.player.stats.dawnWords, 200) },
    { id: 's_owl', title: 'Owl’s Hours', after: 'q_first_ink', blurb: 'Write 200 words between midnight and four.', xp: 250,
        check: (S) => n(S.player.stats.nightWords, 200) },
    { id: 's_another', title: 'Another Lamp', after: 'q_last_page', blurb: 'Finish a second book. The Hollow is never truly gone.', xp: 2000,
        check: (S) => n(S.player.stats.booksDone, 2) },
];
export const SIDE_BY_ID = Object.fromEntries(SIDE.map((q) => [q.id, q]));

function dialogueShare(text) {
    let q = 0;
    for (const m of (text || '').matchAll(/["“]([^"”\n]*)["”]/g)) q += m[1].length;
    return q / Math.max(1, (text || '').replace(/\s/g, '').length);
}

// ------------------------------------------------------------------ status

export const mainQuest = (S) => (S.player.main >= 0 && S.player.main < MAIN.length ? MAIN[S.player.main] : null);
const mainDone = (S, id) => S.player.main > (MAIN_BY_ID[id]?.index ?? 99);

export function progressOf(steps, S, ctx) {
    return steps.map(([label, f]) => { const [d, of] = f(S, ctx); return { label, done: d, of, full: d >= of }; });
}
export function mainReady(S, ctx) {
    const q = mainQuest(S);
    return !!q && progressOf(q.steps, S, ctx).every((s) => s.full);
}

export function sideAvailable(S) {
    return SIDE.filter((q) => mainDone(S, q.after) && !S.player.sideDone.includes(q.id));
}
export function sideReady(S, id, ctx) {
    const q = SIDE_BY_ID[id];
    if (!q || S.player.sideDone.includes(id) || !mainDone(S, q.after)) return false;
    const [d, of] = q.check(S, ctx);
    return d >= of;
}

function payReward(S, r, label) {
    if (r.xp) gainXp(S, r.xp, label, 'quest');
    for (const room of r.rooms || []) openRoom(S, room);
    if (r.relic) giveRelic(S, r.relic);
    for (const id of r.lessons || []) teach(S, id);
    if (r.points) { S.player.bonusPoints += r.points; emit(S, { type: 'points', n: r.points }); }
}

/** Begin the road after the prologue. */
export function beginRoad(S) {
    if (S.player.main >= 0) return;
    S.player.main = 0;
    emit(S, { type: 'quest-start', id: MAIN[0].id });
}

/** Turn in the current main quest. Returns its id, or null if it isn't ready. */
export function claimMain(S, ctx) {
    const q = mainQuest(S);
    if (!q || !mainReady(S, ctx)) return null;
    S.player.main++;
    emit(S, { type: 'quest-done', id: q.id, main: true });
    payReward(S, q.reward, `Quest: ${q.title}`);
    const next = mainQuest(S);
    if (next) emit(S, { type: 'quest-start', id: next.id });
    return q.id;
}

export function claimSide(S, id, ctx) {
    if (!sideReady(S, id, ctx)) return false;
    const q = SIDE_BY_ID[id];
    S.player.sideDone.push(id);
    emit(S, { type: 'quest-done', id, main: false });
    gainXp(S, q.xp, `Quest: ${q.title}`, 'quest');
    return true;
}

// ------------------------------------------------------------------ daily bounties

/** Templates. need(S) says whether it can be offered; check reads today's counters. */
export const BOUNTIES = [
    { id: 'b_goal', text: (S) => `Write ${S.player.dailyGoal} words today`, xp: 80, need: () => true, check: (S) => n(S.player.today.words, S.player.dailyGoal) },
    { id: 'b_double', text: (S) => `Write ${S.player.dailyGoal * 2} words today`, xp: 160, need: () => true, check: (S) => n(S.player.today.words, S.player.dailyGoal * 2) },
    { id: 'b_two', text: () => 'Write in two different scenes today', xp: 60, need: () => true, check: (S) => n(S.player.today.scenes.length, 2) },
    { id: 'b_duel', text: () => 'Win an ink duel today', xp: 100, need: (S) => S.player.rooms.includes('grounds'), check: (S) => n(S.player.today.duels, 1) },
    { id: 'b_char', text: () => 'Work on a character today', xp: 60, need: (S) => S.player.rooms.includes('faces'), check: (S) => n(S.player.today.charEdits, 1) },
    { id: 'b_world', text: () => 'Add to the world today', xp: 60, need: (S) => S.player.rooms.includes('loft'), check: (S) => n(S.player.today.worldEdits, 1) },
    { id: 'b_beat', text: () => 'Work on the Loom today', xp: 60, need: (S) => S.player.rooms.includes('loom'), check: (S) => n(S.player.today.beatEdits, 1) },
    { id: 'b_well', text: () => 'Keep two draws from the Muse’s Well today', xp: 60, need: (S) => S.player.rooms.includes('well'), check: (S) => n(S.player.today.kept, 2) },
    { id: 'b_lens', text: () => 'Have the Lens read a scene today', xp: 50, need: (S) => hasTalent(S, 'l_one'), check: (S) => n(S.player.today.lens, 1) },
    { id: 'b_lesson', text: () => 'Ask Thalion for a lesson today', xp: 40, need: () => true, check: (S) => n(S.player.today.asked, 1) },
];
export const BOUNTY_BY_ID = Object.fromEntries(BOUNTIES.map((b) => [b.id, b]));

/** Today's three bounties, chosen by the seed and the date so they don't change on reload. */
export function rollBounties(S, ctx) {
    const b = S.player.bounty;
    if (!ctx?.today || b.date === ctx.today || S.player.main < 2) return;
    const rng = makeRng(hashString(`${S.seed}:${ctx.today}`));
    const pool = BOUNTIES.filter((t) => t.need(S) && t.id !== 'b_goal');
    const ids = ['b_goal'];
    while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
    S.player.bounty = { date: ctx.today, ids, done: [] };
    emit(S, { type: 'bounties', ids });
}

export function scanBounties(S, ctx) {
    const b = S.player.bounty;
    if (b.date !== ctx?.today) return;
    for (const id of b.ids) {
        if (b.done.includes(id)) continue;
        const t = BOUNTY_BY_ID[id];
        const [d, of] = t.check(S);
        if (d >= of) {
            b.done.push(id);
            emit(S, { type: 'bounty', id, text: t.text(S) });
            gainXp(S, t.xp, 'Bounty', 'quest');
        }
    }
}

export { touchToday };
