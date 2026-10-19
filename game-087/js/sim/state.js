// The whole game is one plain object, S: the apprentice, their novels and the queue of events since the
// last drain. Pure: no DOM, no clock (time arrives as ctx = { now, today, hour }), no Math.random.

import { SAVE_VERSION, WRITING } from '../config.js';
import { countWords } from './text.js';

export function newGame(seed = 1, now = 0) {
    return {
        v: SAVE_VERSION,
        seed: seed >>> 0,
        nextId: 1,
        created: now,
        player: {
            name: '',
            sigil: { field: '#24496b', tincture: '#e8c565', charge: 'quill', shape: 'heater' },
            calling: null,
            xp: 0,
            level: 1,
            rank: 0,
            talents: [],          // bought with points
            freeTalent: null,     // the calling's gift
            bonusPoints: 0,
            relics: ['goose', 'common'],
            equipped: { quill: 'goose', inkwell: 'common', charm: null },
            laurels: {},          // id → day earned
            lessons: [],
            bestiary: {},         // foe id → { wins, losses, best }
            main: -1,             // index into MAIN; -1 until the prologue is done
            sideDone: [],
            bounty: { date: '', ids: [], done: [] },
            awarded: {},          // one-off rewards already given, by key
            days: {},             // day → words written that day
            today: blankToday(''),
            stats: {
                words: 0, pasted: 0, duelsWon: 0, duelsLost: 0, oracle: 0, kept: 0, keptProphecy: 0, snapshots: 0,
                exports: { html: 0, epub: 0, pdf: 0, md: 0, manuscript: 0 }, asked: 0, nightWords: 0, dawnWords: 0,
                charsFleshed: 0, worldFleshed: 0, beatsFilled: 0, summaries: 0, revised: 0, pins: 0, relations: 0, loomCells: 0,
                bestStreak: 0, booksDone: 0,
            },
            attrs: { voice: 1, empathy: 1, imagination: 1, craft: 1, discipline: 1 },
            rooms: ['hall'],
            dailyGoal: WRITING.dailyGoal,
            freePen: false,
            oracleN: 0,
            finale: false,
            snapDay: { date: '', n: 0 },
        },
        projects: {},
        order: [],
        activeId: null,
        events: [],
    };
}

export function blankToday(date) {
    return { date, words: 0, duels: 0, kept: 0, charEdits: 0, worldEdits: 0, beatEdits: 0, scenes: [], lens: 0, asked: 0, dawn: 0, night: 0 };
}

export function newId(S, prefix) {
    return prefix + (S.nextId++);
}

export function newScene(S, title = 'Untitled scene') {
    return { id: newId(S, 's'), title, text: '', words: 0, peak: 0, pov: '', place: '', status: 'draft', summary: '', notes: '', snaps: [] };
}

export function newProject(S, { title = 'Untitled', genre = 'epic' } = {}, now = 0) {
    const sc = newScene(S, 'The first scene');
    const ch = { id: newId(S, 'c'), title: 'Chapter One', scenes: [sc.id] };
    return {
        id: newId(S, 'p'),
        title, subtitle: '', genre, logline: '', premise: '', theme: '', notes: '',
        created: now, updated: now, status: 'draft', completedAt: null,
        chapters: [ch],
        scenes: { [sc.id]: sc },
        characters: [],
        world: [],
        outline: { structure: null, beats: {} },
        threads: [],
        map: { seed: (S.seed ^ (S.nextId * 2654435761)) >>> 0, pins: [] },
        book: {
            author: '', dedication: '', epigraph: '', epigraphBy: '',
            toc: true, smart: true, dropcaps: true, fleuron: '❦', headings: 'words', sceneTitles: false,
            typeface: 'garamond', size: 'trade', map: false, dramatis: false, glossary: false, lang: 'en',
        },
    };
}

// ------------------------------------------------------------------ reading the state

export const active = (S) => (S.activeId ? S.projects[S.activeId] : null);

/** Scenes in reading order, each with its chapter. */
export function sceneList(P) {
    const out = [];
    for (const ch of P.chapters) for (const id of ch.scenes) if (P.scenes[id]) out.push({ ch, sc: P.scenes[id] });
    return out;
}

export const bookWords = (P) => (P ? P.chapters.reduce((a, ch) => a + chapterWords(P, ch), 0) : 0);
export const chapterWords = (P, ch) => ch.scenes.reduce((a, id) => a + (P.scenes[id]?.words || 0), 0);
export const findChapterOf = (P, sid) => P.chapters.find((c) => c.scenes.includes(sid)) || null;

export function recount(sc) {
    sc.words = countWords(sc.text);
    return sc.words;
}

// ------------------------------------------------------------------ days (strings, 'YYYY-MM-DD')

export function dayOffset(day, k) {
    const [y, m, d] = day.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + k));
    return t.toISOString().slice(0, 10);
}

/** Days in a row at or above the goal, ending today (or yesterday, if today isn't there yet). */
export function streak(player, today) {
    const ok = (d) => (player.days[d] || 0) >= player.dailyGoal;
    let d = ok(today) ? today : dayOffset(today, -1);
    let n = 0;
    while (ok(d) && n < 4000) { n++; d = dayOffset(d, -1); }
    return n;
}

// ------------------------------------------------------------------ save

/** The apprentice without the novels (each novel is saved under its own key). */
export function serializeCore(S) {
    const { events, projects, ...rest } = S;
    return JSON.parse(JSON.stringify(rest));
}
export function serializeProject(P) {
    return JSON.parse(JSON.stringify(P));
}

/** Rebuild S from a core and its projects. Throws on a save it can't trust. */
export function deserialize(core, projects = {}) {
    if (!core || typeof core !== 'object' || core.v !== SAVE_VERSION) throw new Error('unknown save version');
    if (!core.player || typeof core.player !== 'object') throw new Error('no apprentice in save');
    const fresh = newGame(core.seed, core.created);
    const S = { ...fresh, ...JSON.parse(JSON.stringify(core)), events: [], projects: {} };
    // fill fields a later version added, so an old save still opens
    S.player = { ...fresh.player, ...S.player };
    S.player.stats = { ...fresh.player.stats, ...S.player.stats, exports: { ...fresh.player.stats.exports, ...(S.player.stats?.exports || {}) } };
    S.player.today = { ...blankToday(''), ...S.player.today };
    S.player.attrs = { ...fresh.player.attrs, ...S.player.attrs };
    S.order = (S.order || []).filter((id) => projects[id]);
    for (const id of S.order) S.projects[id] = normalizeProject(projects[id], S);
    if (S.activeId && !S.projects[S.activeId]) S.activeId = S.order[0] || null;
    // never hand out an id a saved novel already uses, even if the core was saved before the novel
    const ids = JSON.stringify(S.projects).match(/"id":"[a-z]+(\d+)"/g) || [];
    for (const m of ids) S.nextId = Math.max(S.nextId, +m.match(/(\d+)"$/)[1] + 1);
    return S;
}

function normalizeProject(raw, S) {
    const base = newProject({ nextId: 0, seed: S.seed }, {});
    const P = { ...base, ...JSON.parse(JSON.stringify(raw)) };
    P.book = { ...base.book, ...(P.book || {}) };
    P.outline = { structure: null, beats: {}, ...(P.outline || {}) };
    P.map = { ...base.map, ...(P.map || {}) };
    P.scenes = P.scenes || {};
    P.chapters = (P.chapters || []).map((c) => ({ ...c, scenes: (c.scenes || []).filter((id) => P.scenes[id]) }));
    for (const sc of Object.values(P.scenes)) {
        sc.text = typeof sc.text === 'string' ? sc.text : '';
        sc.snaps = Array.isArray(sc.snaps) ? sc.snaps : [];
        recount(sc);
        sc.peak = Math.max(sc.peak || 0, sc.words);
    }
    for (const k of ['characters', 'world', 'threads']) P[k] = Array.isArray(P[k]) ? P[k] : [];
    return P;
}
