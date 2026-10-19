// Experience, levels, ranks, attributes, talents, relics, one-off awards and laurels. Pure.
// Everything here pushes events into S.events; the UI turns them into toasts, sounds and scenes.

import { XP, MAX_LEVEL, xpForLevel, FIELD, NOVEL_WORDS } from '../config.js';
import { RANKS, ATTRS, TALENTS, TALENT_BY_ID, RELIC_BY_ID, CALLING_BY_ID, CHAR_FIELDS, FOES, STRUCTURE_BY_ID } from './data/guild.js';
import { LESSONS, LESSON_BY_ID } from './data/lessons.js';
import { countWords } from './text.js';
import { bookWords, streak, sceneList, blankToday } from './state.js';

const emit = (S, e) => S.events.push(e);

// ------------------------------------------------------------------ levels

export function levelFor(xp) {
    let L = 1;
    while (L < MAX_LEVEL && xp >= xpForLevel(L + 1)) L++;
    return L;
}
export function rankFor(level) {
    let r = 0;
    RANKS.forEach((k, i) => { if (level >= k.level) r = i; });
    return r;
}
export const rankName = (S) => RANKS[S.player.rank].name;

/** Progress through the current level, 0..1, with the numbers. */
export function levelProgress(S) {
    const L = S.player.level;
    const lo = xpForLevel(L), hi = xpForLevel(Math.min(MAX_LEVEL, L + 1));
    const xp = S.player.xp;
    return { level: L, xp: Math.floor(xp), lo, hi, frac: hi > lo ? Math.min(1, (xp - lo) / (hi - lo)) : 1 };
}

/** The sum of every worn relic's effects, plus the calling's. */
export function bonuses(S) {
    const b = { wordXp: 0, questXp: 0, codexXp: 0, duelDamage: 0, duelTime: 0, duelRegen: 0 };
    for (const id of Object.values(S.player.equipped)) {
        const r = id && RELIC_BY_ID[id];
        if (r) for (const [k, v] of Object.entries(r.fx)) b[k] += v;
    }
    if (S.player.calling === 'bard') b.wordXp += 0.1;
    if (hasTalent(S, 'd_hourglass')) b.duelTime += 0.15;
    if (hasTalent(S, 'd_ward')) b.duelRegen -= 0.5;
    return b;
}

/** Give XP. kind: 'word' | 'quest' | 'codex' | 'plain'; the calling doubles its own kind of codex work. */
export function gainXp(S, amount, why, kind = 'plain', codexOf = null) {
    if (!(amount > 0)) return 0;
    const b = bonuses(S);
    let mult = 1;
    if (kind === 'word') mult += b.wordXp;
    else if (kind === 'quest') mult += b.questXp;
    else if (kind === 'codex') {
        mult += b.codexXp;
        const c = S.player.calling;
        if ((c === 'heartseer' && codexOf === 'char') || (c === 'loremaster' && codexOf === 'world') || (c === 'weaver' && (codexOf === 'beat' || codexOf === 'loom'))) mult += 1;
    }
    const got = amount * mult;
    S.player.xp += got;
    if (kind !== 'word') emit(S, { type: 'xp', amount: Math.round(got), why });
    checkLevel(S);
    return got;
}

export function checkLevel(S) {
    const p = S.player;
    const L = levelFor(p.xp);
    while (p.level < L) {
        p.level++;
        emit(S, { type: 'level', level: p.level });
        const r = rankFor(p.level);
        if (r !== p.rank) { p.rank = r; emit(S, { type: 'rank', rank: r, name: RANKS[r].name }); }
    }
}

// ------------------------------------------------------------------ talents

export const hasTalent = (S, id) => S.player.freePen || S.player.talents.includes(id) || S.player.freeTalent === id;
export const pointsFree = (S) => (S.player.level - 1) + S.player.bonusPoints - S.player.talents.length;

export function talentStatus(S, id) {
    const t = TALENT_BY_ID[id];
    if (!t) return 'none';
    if (S.player.talents.includes(id) || S.player.freeTalent === id) return 'owned';
    if (S.player.level < t.level) return 'level';
    if (t.req && !(S.player.talents.includes(t.req) || S.player.freeTalent === t.req)) return 'req';
    if (pointsFree(S) < 1) return 'points';
    return 'open';
}

export function learnTalent(S, id) {
    if (talentStatus(S, id) !== 'open') return false;
    S.player.talents.push(id);
    emit(S, { type: 'talent', id });
    return true;
}

// ------------------------------------------------------------------ relics

export function giveRelic(S, id) {
    if (!RELIC_BY_ID[id] || S.player.relics.includes(id)) return false;
    S.player.relics.push(id);
    emit(S, { type: 'relic', id });
    // wear it if the slot is empty or holds a starting relic
    const slot = RELIC_BY_ID[id].slot;
    const cur = S.player.equipped[slot];
    if (!cur || cur === 'goose' || cur === 'common') S.player.equipped[slot] = id;
    return true;
}

export function equip(S, id) {
    const r = RELIC_BY_ID[id];
    if (!r || !S.player.relics.includes(id)) return false;
    S.player.equipped[r.slot] = S.player.equipped[r.slot] === id && r.slot === 'charm' ? null : id;
    return true;
}

export function deskTheme(S) {
    return RELIC_BY_ID[S.player.equipped.inkwell]?.theme || 'parchment';
}

// ------------------------------------------------------------------ rooms and lessons

export const roomOpen = (S, id) => S.player.freePen || S.player.rooms.includes(id);

export function openRoom(S, id) {
    if (S.player.rooms.includes(id)) return;
    S.player.rooms.push(id);
    emit(S, { type: 'unlock', room: id });
}

export function teach(S, id) {
    if (!LESSON_BY_ID[id] || S.player.lessons.includes(id)) return false;
    S.player.lessons.push(id);
    emit(S, { type: 'lesson', id });
    gainXp(S, XP.lessonRead, 'A lesson learned', 'plain');
    return true;
}

/** Ask Thalion in a room: the next lesson of that room he hasn't taught, else one he has (by turn). */
export function askLesson(S, room, ctx) {
    const p = S.player;
    p.stats.asked++;
    touchToday(S, ctx).asked++;
    const pool = LESSONS.filter((l) => l.room === room);
    const fresh = pool.find((l) => !p.lessons.includes(l.id));
    if (fresh) { teach(S, fresh.id); return { id: fresh.id, fresh: true }; }
    const any = pool.length ? pool : LESSONS;
    return { id: any[p.stats.asked % any.length].id, fresh: false };
}

// ------------------------------------------------------------------ the day

/** Today's counters, reset when the day changes. */
export function touchToday(S, ctx) {
    const p = S.player;
    if (ctx?.today && p.today.date !== ctx.today) p.today = blankToday(ctx.today);
    return p.today;
}

/** Words credited by writing. Pasted words never reach here. */
export function creditWords(S, n, ctx) {
    if (!(n > 0)) return;
    const p = S.player;
    const t = touchToday(S, ctx);
    p.stats.words += n;
    t.words += n;
    if (ctx?.today) p.days[ctx.today] = (p.days[ctx.today] || 0) + n;
    if (ctx?.hour !== undefined) {
        if (ctx.hour >= 0 && ctx.hour < 4) { p.stats.nightWords += n; t.night += n; }
        if (ctx.hour >= 4 && ctx.hour < 7) { p.stats.dawnWords += n; t.dawn += n; }
    }
    gainXp(S, n * XP.perWord, 'words', 'word');
    emit(S, { type: 'words', n });
}

// ------------------------------------------------------------------ fleshed-out checks

export function charFleshed(c) {
    return CHAR_FIELDS.filter((f) => f.core).every((f) => (c[f.id] || '').trim()) && countWords(c.backstory) >= FIELD.fleshWords;
}
export function charFill(c) {
    const fields = CHAR_FIELDS.filter((f) => f.id !== 'notes');
    let n = 0;
    for (const f of fields) if ((c[f.id] || '').trim()) n += f.id === 'backstory' ? Math.min(1, countWords(c.backstory) / FIELD.fleshWords) : 1;
    return n / fields.length;
}
export function worldFleshed(e) {
    if (!(e.name || '').trim() || !(e.summary || '').trim() || countWords(e.details) < FIELD.placeWords) return false;
    if (e.kind === 'magic') return !!((e.cost || '').trim() && (e.limits || '').trim());
    return true;
}
export const beatFilled = (b) => countWords(b?.notes) >= FIELD.beatWords;

/** Award one-off XP for anything newly fleshed, summarised, revised, pinned or woven. Idempotent. */
export function scanAwards(S) {
    const p = S.player, aw = p.awarded;
    for (const P of Object.values(S.projects)) {
        for (const c of P.characters) {
            const k = `char:${P.id}:${c.id}`;
            if (!aw[k] && charFleshed(c)) {
                aw[k] = 1; p.stats.charsFleshed++;
                gainXp(S, XP.characterFleshed, `${c.name} is fleshed out`, 'codex', 'char');
                emit(S, { type: 'fleshed', what: 'character', name: c.name });
            }
            for (const r of c.relations || []) {
                const rk = `rel:${P.id}:${c.id}:${r.to}`;
                if (!aw[rk] && r.to && (r.label || '').trim()) { aw[rk] = 1; p.stats.relations++; gainXp(S, 10, 'A bond between characters', 'codex', 'char'); }
            }
        }
        for (const e of P.world) {
            const k = `world:${P.id}:${e.id}`;
            if (!aw[k] && worldFleshed(e)) {
                aw[k] = 1; p.stats.worldFleshed++;
                gainXp(S, XP.placeFleshed, `${e.name} is set down in the codex`, 'codex', 'world');
                emit(S, { type: 'fleshed', what: e.kind, name: e.name });
            }
        }
        for (const [bid, b] of Object.entries(P.outline.beats)) {
            const k = `beat:${P.id}:${bid}`;
            if (!aw[k] && beatFilled(b)) { aw[k] = 1; p.stats.beatsFilled++; gainXp(S, XP.beatFilled, 'A beat on the Loom', 'codex', 'beat'); }
        }
        for (const { sc } of sceneList(P)) {
            const ks = `sum:${P.id}:${sc.id}`;
            if (!aw[ks] && countWords(sc.summary) >= 8) { aw[ks] = 1; p.stats.summaries++; gainXp(S, XP.sceneSummary, 'A scene summarised', 'codex', 'beat'); }
            const kr = `rev:${P.id}:${sc.id}`;
            if (!aw[kr] && (sc.status === 'revised' || sc.status === 'final') && sc.words >= 100) { aw[kr] = 1; p.stats.revised++; gainXp(S, XP.sceneRevised, 'A scene revised', 'codex', 'beat'); }
        }
        for (const pin of P.map.pins) {
            const k = `pin:${P.id}:${pin.id}`;
            if (!aw[k]) { aw[k] = 1; p.stats.pins++; gainXp(S, 15, 'A place on the map', 'codex', 'world'); }
        }
        for (const th of P.threads) for (const [cid, on] of Object.entries(th.cells)) {
            const k = `loom:${P.id}:${th.id}:${cid}`;
            if (on && !aw[k]) { aw[k] = 1; p.stats.loomCells++; gainXp(S, XP.loomCell, 'A thread woven', 'codex', 'loom'); }
        }
    }
}

// ------------------------------------------------------------------ attributes

export function attrCounts(S, today) {
    const st = S.player.stats;
    const cur = today ? streak(S.player, today) : 0;
    if (cur > st.bestStreak) st.bestStreak = cur;
    return {
        voice: st.words,
        empathy: st.charsFleshed + Math.floor(st.relations / 2),
        imagination: st.worldFleshed + Math.floor(st.oracle / 5) + st.pins,
        craft: st.beatsFilled + st.summaries + st.revised + Math.floor(st.loomCells / 5),
        discipline: st.bestStreak + st.duelsWon,
    };
}

export function attrLevel(steps, n) {
    let L = 1;
    steps.forEach((s, i) => { if (n >= s) L = i + 1; });
    return L;
}

export function scanAttrs(S, today) {
    const counts = attrCounts(S, today);
    for (const a of ATTRS) {
        const L = attrLevel(a.steps, counts[a.id]);
        if (L > S.player.attrs[a.id]) {
            S.player.attrs[a.id] = L;
            emit(S, { type: 'attr', id: a.id, level: L });
        }
    }
    return counts;
}

// ------------------------------------------------------------------ laurels

const foesBeaten = (S) => FOES.filter((f) => !f.training && S.player.bestiary[f.id]?.wins > 0).length;
const anyWords = (S) => Math.max(0, ...Object.values(S.projects).map(bookWords));
const fullStructure = (S) => Object.values(S.projects).some((P) => {
    const st = STRUCTURE_BY_ID[P.outline.structure];
    return st && st.beats.every((b) => beatFilled(P.outline.beats[`${st.id}:${b.id}`]));
});

export const LAURELS = [
    { id: 'first', name: 'First Ink', blurb: 'Write your first word.', check: (S) => S.player.stats.words >= 1 },
    { id: 'w1k', name: 'A Thousand Words', blurb: 'Write 1,000 words.', check: (S) => S.player.stats.words >= 1000 },
    { id: 'w10k', name: 'Ten Thousand', blurb: 'Write 10,000 words.', check: (S) => S.player.stats.words >= 10000 },
    { id: 'w25k', name: 'The Long Road', blurb: 'Write 25,000 words.', check: (S) => S.player.stats.words >= 25000 },
    { id: 'w50k', name: 'Fifty Thousand', blurb: 'Write 50,000 words, the length of a winter’s novel.', check: (S) => S.player.stats.words >= 50000 },
    { id: 'w100k', name: 'The Hundred Thousand', blurb: 'Write 100,000 words.', check: (S) => S.player.stats.words >= 100000 },
    { id: 'day1k', name: 'A Thousand Before Supper', blurb: 'Write 1,000 words in one day.', check: (S) => Object.values(S.player.days).some((n) => n >= 1000) },
    { id: 'day3k', name: 'The Fever', blurb: 'Write 3,000 words in one day.', check: (S) => Object.values(S.player.days).some((n) => n >= 3000) },
    { id: 'streak3', name: 'Kindling', blurb: 'Meet your daily goal three days in a row.', check: (S) => S.player.stats.bestStreak >= 3 },
    { id: 'streak7', name: 'The Small Daily Fire', blurb: 'Meet your daily goal seven days in a row.', check: (S) => S.player.stats.bestStreak >= 7 },
    { id: 'streak30', name: 'The Fire That Never Goes Out', blurb: 'Meet your daily goal thirty days in a row.', check: (S) => S.player.stats.bestStreak >= 30 },
    { id: 'cast5', name: 'A Full Table', blurb: 'Flesh out five characters.', check: (S) => S.player.stats.charsFleshed >= 5 },
    { id: 'world10', name: 'Worldsmith', blurb: 'Set down ten entries in the Cartographer’s Loft.', check: (S) => S.player.stats.worldFleshed >= 10 },
    { id: 'beats', name: 'The Whole Shape', blurb: 'Fill every beat of a structure.', check: fullStructure },
    { id: 'duel1', name: 'Blooded', blurb: 'Win your first ink duel.', check: (S) => S.player.stats.duelsWon >= 1 },
    { id: 'duelall', name: 'Monster Hunter', blurb: 'Defeat every foe in the Proving Grounds.', check: (S) => foesBeaten(S) >= FOES.filter((f) => !f.training).length },
    { id: 'critic', name: 'The Silenced Critic', blurb: 'Defeat the Inner Critic.', check: (S) => S.player.bestiary.critic?.wins > 0 },
    { id: 'owl', name: 'Owl’s Hours', blurb: 'Write 500 words between midnight and four.', check: (S) => S.player.stats.nightWords >= 500 },
    { id: 'lark', name: 'Before the Lark', blurb: 'Write 500 words between four and seven in the morning.', check: (S) => S.player.stats.dawnWords >= 500 },
    { id: 'oracle25', name: 'Deep Water', blurb: 'Draw from the Muse’s Well 25 times.', check: (S) => S.player.stats.oracle >= 25 },
    { id: 'html', name: 'The Web of Pages', blurb: 'Bind a book as a web page.', check: (S) => S.player.stats.exports.html > 0 },
    { id: 'epub', name: 'The Traveller’s Edition', blurb: 'Bind a book as an EPUB.', check: (S) => S.player.stats.exports.epub > 0 },
    { id: 'pdf', name: 'The Printer’s Proof', blurb: 'Bind a book for print.', check: (S) => S.player.stats.exports.pdf > 0 },
    { id: 'novella', name: 'Teller of Tales', blurb: 'Finish a work of any length.', check: (S) => S.player.stats.booksDone >= 1 },
    { id: 'novel', name: 'Novelist', blurb: `Finish a work of ${NOVEL_WORDS.toLocaleString('en')} words or more.`, check: (S) => Object.values(S.projects).some((P) => P.status === 'complete' && bookWords(P) >= NOVEL_WORDS) },
    { id: 'shelf3', name: 'A Shelf of One’s Own', blurb: 'Finish three books.', check: (S) => S.player.stats.booksDone >= 3 },
    { id: 'attr10', name: 'Paragon', blurb: 'Raise an attribute to 10.', check: (S) => Object.values(S.player.attrs).some((v) => v >= 10) },
    { id: 'talents', name: 'Many-Gifted', blurb: 'Learn every talent.', check: (S) => !S.player.freePen && TALENTS.every((t) => S.player.talents.includes(t.id) || S.player.freeTalent === t.id) },
    { id: 'lessons', name: 'Student of the Craft', blurb: 'Learn every lesson in the Tomes of Craft.', check: (S) => S.player.lessons.length >= LESSONS.length },
    { id: 'drafts', name: 'Keeper of Drafts', blurb: 'Take ten snapshots.', check: (S) => S.player.stats.snapshots >= 10 },
    { id: 'big', name: 'Doorstopper', blurb: 'A single book of 100,000 words.', check: (S) => anyWords(S) >= 100000 },
];

export function scanLaurels(S, today) {
    for (const l of LAURELS) {
        if (S.player.laurels[l.id] || !l.check(S)) continue;
        S.player.laurels[l.id] = today || '1';
        emit(S, { type: 'laurel', id: l.id, name: l.name });
        gainXp(S, 50, `Laurel: ${l.name}`, 'plain');
    }
}

export { CALLING_BY_ID };
