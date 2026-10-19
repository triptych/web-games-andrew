// Every change the apprentice can make, as a pure function of (S, ..., ctx). Each one finishes with settle(),
// which pays one-off awards, raises attributes, completes bounties and laurels, and flags ready quests.
// ctx = { now: ms, today: 'YYYY-MM-DD', hour: 0..23 } comes from main.js; the tests make their own.

import { CALLING_BY_ID, CHAR_FIELDS, STRUCTURE_BY_ID } from './data/guild.js';
import { newId, newProject, newScene, recount, active, findChapterOf, sceneList, bookWords } from './state.js';
import { checkLevel, creditWords, touchToday, scanAwards, scanAttrs, scanLaurels, hasTalent, gainXp, teach, equip, learnTalent } from './progress.js';
import { beginRoad, claimMain, claimSide, rollBounties, scanBounties, mainReady, mainQuest, sideAvailable, sideReady } from './quests.js';
import { draw as oracleDraw } from './oracle.js';
import { XP, LENGTHS } from '../config.js';

const emit = (S, e) => S.events.push(e);
const clean = (s, max = 400) => String(s ?? '').slice(0, max);

/** Run after every action. Cheap enough to call on each autosaved keystroke batch. */
export function settle(S, ctx) {
    touchToday(S, ctx);
    checkLevel(S);
    rollBounties(S, ctx);
    scanAwards(S);
    scanAttrs(S, ctx?.today);
    scanBounties(S, ctx);
    scanLaurels(S, ctx?.today);
    // flag quests that just became ready, once
    const q = mainQuest(S);
    const ready = q && mainReady(S, ctx) ? q.id : null;
    if (ready && S.player.awarded[`ready:${ready}`] !== 1) { S.player.awarded[`ready:${ready}`] = 1; emit(S, { type: 'quest-ready', id: ready, main: true }); }
    for (const sq of sideAvailable(S)) {
        if (sideReady(S, sq.id, ctx) && S.player.awarded[`ready:${sq.id}`] !== 1) { S.player.awarded[`ready:${sq.id}`] = 1; emit(S, { type: 'quest-ready', id: sq.id, main: false }); }
    }
}

// ------------------------------------------------------------------ the prologue

export function setIdentity(S, { name, sigil, calling }, ctx) {
    const p = S.player;
    if (name !== undefined) p.name = clean(name, 40).trim() || 'Apprentice';
    if (sigil) p.sigil = { ...p.sigil, ...sigil };
    if (calling && CALLING_BY_ID[calling] && !p.calling) {
        p.calling = calling;
        p.freeTalent = CALLING_BY_ID[calling].talent;
        emit(S, { type: 'calling', id: calling });
    }
    settle(S, ctx);
}

export function finishPrologue(S, ctx) {
    beginRoad(S);
    if (!S.order.length) createProject(S, {}, ctx);
    settle(S, ctx);
}

// ------------------------------------------------------------------ projects

export function createProject(S, opts, ctx) {
    const P = newProject(S, opts, ctx?.now || 0);
    P.book.author = S.player.name;
    S.projects[P.id] = P;
    S.order.push(P.id);
    S.activeId = P.id;
    emit(S, { type: 'project', id: P.id });
    settle(S, ctx);
    return P;
}

export function selectProject(S, id, ctx) {
    if (!S.projects[id]) return false;
    S.activeId = id;
    settle(S, ctx);
    return true;
}

export function deleteProject(S, id, ctx) {
    if (!S.projects[id]) return false;
    delete S.projects[id];
    S.order = S.order.filter((x) => x !== id);
    if (S.activeId === id) S.activeId = S.order[0] || null;
    emit(S, { type: 'project-deleted', id });
    settle(S, ctx);
    return true;
}

const CHARTER = ['title', 'subtitle', 'genre', 'logline', 'premise', 'theme', 'notes'];
export function editCharter(S, fields, ctx) {
    const P = active(S);
    if (!P) return;
    for (const k of CHARTER) if (fields[k] !== undefined) P[k] = clean(fields[k], k === 'notes' ? 20000 : k === 'premise' ? 4000 : 400);
    P.updated = ctx?.now || P.updated;
    settle(S, ctx);
}

export function editBook(S, fields, ctx) {
    const P = active(S);
    if (!P) return;
    for (const [k, v] of Object.entries(fields)) if (k in P.book) P.book[k] = typeof P.book[k] === 'boolean' ? !!v : clean(v, 2000);
    settle(S, ctx);
}

/** The name a finished work earns, by its length. */
export const lengthName = (words) => LENGTHS.filter((l) => words >= l.min).pop().name;

export function setComplete(S, done, ctx) {
    const P = active(S);
    if (!P) return false;
    if (done && P.status !== 'complete') {
        if (bookWords(P) < 100) return false;
        P.status = 'complete';
        P.completedAt = ctx?.today || '';
        S.player.stats.booksDone++;
        emit(S, { type: 'book-done', id: P.id, kind: lengthName(bookWords(P)), words: bookWords(P) });
        gainXp(S, Math.min(2000, Math.round(bookWords(P) / 20)), `${P.title} is finished`, 'quest');
    } else if (!done && P.status === 'complete') {
        P.status = 'draft';
        P.completedAt = null;
    }
    settle(S, ctx);
    return true;
}

// ------------------------------------------------------------------ chapters and scenes

export function addChapter(S, title, ctx) {
    const P = active(S);
    const sc = newScene(S, 'New scene');
    P.scenes[sc.id] = sc;
    const ch = { id: newId(S, 'c'), title: clean(title, 120) || `Chapter ${P.chapters.length + 1}`, scenes: [sc.id] };
    P.chapters.push(ch);
    settle(S, ctx);
    return { ch, sc };
}

export function addScene(S, chapterId, title, ctx) {
    const P = active(S);
    const ch = P.chapters.find((c) => c.id === chapterId) || P.chapters[P.chapters.length - 1];
    if (!ch) return addChapter(S, '', ctx).sc;
    const sc = newScene(S, clean(title, 120) || `Scene ${ch.scenes.length + 1}`);
    P.scenes[sc.id] = sc;
    ch.scenes.push(sc.id);
    settle(S, ctx);
    return sc;
}

export function renameChapter(S, id, title, ctx) {
    const ch = active(S).chapters.find((c) => c.id === id);
    if (ch) ch.title = clean(title, 120);
    settle(S, ctx);
}

/** Move a chapter (dir -1 or 1). */
export function moveChapter(S, id, dir, ctx) {
    const list = active(S).chapters;
    const i = list.findIndex((c) => c.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    settle(S, ctx);
    return true;
}

/** Move a scene up or down, across chapter edges if it is first or last. */
export function moveScene(S, id, dir, ctx) {
    const P = active(S);
    const ch = findChapterOf(P, id);
    if (!ch) return false;
    const i = ch.scenes.indexOf(id), j = i + dir;
    if (j >= 0 && j < ch.scenes.length) {
        [ch.scenes[i], ch.scenes[j]] = [ch.scenes[j], ch.scenes[i]];
    } else {
        const ci = P.chapters.indexOf(ch), cj = ci + dir;
        if (cj < 0 || cj >= P.chapters.length) return false;
        ch.scenes.splice(i, 1);
        if (dir > 0) P.chapters[cj].scenes.unshift(id); else P.chapters[cj].scenes.push(id);
    }
    settle(S, ctx);
    return true;
}

export function deleteScene(S, id, ctx) {
    const P = active(S);
    const ch = findChapterOf(P, id);
    if (!ch) return false;
    ch.scenes = ch.scenes.filter((x) => x !== id);
    delete P.scenes[id];
    settle(S, ctx);
    return true;
}

export function deleteChapter(S, id, ctx) {
    const P = active(S);
    if (P.chapters.length <= 1) return false;
    const ch = P.chapters.find((c) => c.id === id);
    if (!ch) return false;
    for (const sid of ch.scenes) delete P.scenes[sid];
    P.chapters = P.chapters.filter((c) => c !== ch);
    for (const t of P.threads) delete t.cells[id];
    for (const b of Object.values(P.outline.beats)) b.chapters = (b.chapters || []).filter((x) => x !== id);
    settle(S, ctx);
    return true;
}

const SCENE_META = ['title', 'pov', 'place', 'status', 'summary', 'notes'];
export function editScene(S, id, fields, ctx) {
    const sc = active(S)?.scenes[id];
    if (!sc) return;
    for (const k of SCENE_META) if (fields[k] !== undefined) sc[k] = clean(fields[k], k === 'notes' || k === 'summary' ? 4000 : 200);
    settle(S, ctx);
}

/**
 * The scene's text is now `text`. New words above the scene's high-water mark are credited (deleting and
 * retyping earns nothing twice); pasted words go into the book but earn no XP.
 */
export function writeScene(S, id, text, ctx, { pasted = false } = {}) {
    const P = active(S);
    const sc = P?.scenes[id];
    if (!sc) return 0;
    sc.text = String(text ?? '');
    recount(sc);
    P.updated = ctx?.now || P.updated;
    const fresh = sc.words - sc.peak;
    let credited = 0;
    if (fresh > 0) {
        sc.peak = sc.words;
        if (pasted) { S.player.stats.pasted += fresh; emit(S, { type: 'pasted', n: fresh }); } else {
            creditWords(S, fresh, ctx);
            credited = fresh;
            const t = touchToday(S, ctx);
            if (!t.scenes.includes(id)) t.scenes.push(id);
        }
    }
    settle(S, ctx);
    return credited;
}

/** Find and replace through every scene (the Seeker's Glass). Returns the number of replacements. */
export function replaceAll(S, find, repl, { matchCase = false, wholeWord = false } = {}, ctx) {
    const P = active(S);
    if (!P || !find || !hasTalent(S, 'q_find')) return 0;
    const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(wholeWord ? `\\b${esc}\\b` : esc, matchCase ? 'g' : 'gi');
    let total = 0;
    for (const { sc } of sceneList(P)) {
        const m = sc.text.match(re);
        if (!m) continue;
        total += m.length;
        sc.text = sc.text.replace(re, repl);
        recount(sc);
        // the high-water mark follows the edit, so a replacement never earns XP
        sc.peak = Math.max(sc.peak, sc.words);
    }
    settle(S, ctx);
    return total;
}

export function snapshot(S, id, label, ctx) {
    const sc = active(S)?.scenes[id];
    if (!sc || !hasTalent(S, 'q_snap')) return false;
    sc.snaps.unshift({ t: ctx?.now || 0, label: clean(label, 80) || 'Snapshot', text: sc.text, words: sc.words });
    if (sc.snaps.length > 20) sc.snaps.length = 20;
    S.player.stats.snapshots++;
    const d = S.player.snapDay;
    if (d.date !== ctx?.today) { d.date = ctx?.today || ''; d.n = 0; }
    if (d.n++ < 10) gainXp(S, XP.snapshot, 'A draft kept', 'codex', 'beat');
    emit(S, { type: 'snapshot', id });
    settle(S, ctx);
    return true;
}

export function restoreSnapshot(S, id, index, ctx) {
    const sc = active(S)?.scenes[id];
    const snap = sc?.snaps[index];
    if (!snap) return false;
    // keep what was there as a snapshot too, so a restore is never a loss
    sc.snaps.unshift({ t: ctx?.now || 0, label: 'Before restoring', text: sc.text, words: sc.words });
    sc.text = snap.text;
    recount(sc);
    settle(S, ctx);
    return true;
}

export function deleteSnapshot(S, id, index, ctx) {
    const sc = active(S)?.scenes[id];
    if (!sc?.snaps[index]) return false;
    sc.snaps.splice(index, 1);
    settle(S, ctx);
    return true;
}

export function noteLens(S, ctx) {
    touchToday(S, ctx).lens++;
    settle(S, ctx);
}

// ------------------------------------------------------------------ characters

export function addCharacter(S, fields = {}, ctx) {
    const P = active(S);
    const c = { id: newId(S, 'h'), relations: [] };
    for (const f of CHAR_FIELDS) c[f.id] = clean(fields[f.id] ?? '', f.big ? 20000 : f.long ? 4000 : 200);
    if (!c.name) c.name = 'Someone new';
    if (!c.role) c.role = P.characters.length ? 'Ally' : 'Protagonist';
    P.characters.push(c);
    touchToday(S, ctx).charEdits++;
    settle(S, ctx);
    return c;
}

export function editCharacter(S, id, fields, ctx) {
    const c = active(S)?.characters.find((x) => x.id === id);
    if (!c) return;
    for (const f of CHAR_FIELDS) if (fields[f.id] !== undefined) c[f.id] = clean(fields[f.id], f.big ? 20000 : f.long ? 4000 : 200);
    touchToday(S, ctx).charEdits++;
    settle(S, ctx);
}

export function deleteCharacter(S, id, ctx) {
    const P = active(S);
    P.characters = P.characters.filter((c) => c.id !== id);
    for (const c of P.characters) c.relations = c.relations.filter((r) => r.to !== id);
    for (const { sc } of sceneList(P)) if (sc.pov === id) sc.pov = '';
    settle(S, ctx);
}

export function setRelation(S, id, to, label, ctx) {
    const c = active(S)?.characters.find((x) => x.id === id);
    if (!c || id === to) return;
    const r = c.relations.find((x) => x.to === to);
    if (!label) c.relations = c.relations.filter((x) => x.to !== to);
    else if (r) r.label = clean(label, 80);
    else c.relations.push({ to, label: clean(label, 80) });
    touchToday(S, ctx).charEdits++;
    settle(S, ctx);
}

// ------------------------------------------------------------------ the world

const WORLD_FIELDS = ['name', 'summary', 'details', 'source', 'cost', 'limits', 'tags'];
export function addWorld(S, kind, fields = {}, ctx) {
    const P = active(S);
    const e = { id: newId(S, 'w'), kind };
    for (const k of WORLD_FIELDS) e[k] = clean(fields[k] ?? '', k === 'details' ? 20000 : 600);
    if (!e.name) e.name = 'Unnamed';
    P.world.push(e);
    touchToday(S, ctx).worldEdits++;
    settle(S, ctx);
    return e;
}

export function editWorld(S, id, fields, ctx) {
    const e = active(S)?.world.find((x) => x.id === id);
    if (!e) return;
    for (const k of [...WORLD_FIELDS, 'kind']) if (fields[k] !== undefined) e[k] = clean(fields[k], k === 'details' ? 20000 : 600);
    touchToday(S, ctx).worldEdits++;
    settle(S, ctx);
}

export function deleteWorld(S, id, ctx) {
    const P = active(S);
    P.world = P.world.filter((e) => e.id !== id);
    P.map.pins = P.map.pins.filter((p) => p.id !== id);
    for (const { sc } of sceneList(P)) if (sc.place === id) sc.place = '';
    settle(S, ctx);
}

/** Put (or move) a world entry's pin on the map; x, y in 0..1. */
export function pin(S, id, x, y, ctx) {
    const P = active(S);
    if (!P.world.find((e) => e.id === id)) return;
    const p = P.map.pins.find((q) => q.id === id);
    const cx = Math.max(0, Math.min(1, x)), cy = Math.max(0, Math.min(1, y));
    if (p) { p.x = cx; p.y = cy; } else P.map.pins.push({ id, x: cx, y: cy });
    touchToday(S, ctx).worldEdits++;
    settle(S, ctx);
}

export function unpin(S, id, ctx) {
    const P = active(S);
    P.map.pins = P.map.pins.filter((p) => p.id !== id);
    settle(S, ctx);
}

export function rerollMap(S, ctx) {
    const P = active(S);
    P.map.seed = (P.map.seed * 1664525 + 1013904223) >>> 0;
    settle(S, ctx);
}

// ------------------------------------------------------------------ the loom

export function chooseStructure(S, id, ctx) {
    const P = active(S);
    if (!STRUCTURE_BY_ID[id]) return;
    P.outline.structure = id;
    touchToday(S, ctx).beatEdits++;
    settle(S, ctx);
}

export function editBeat(S, beatKey, fields, ctx) {
    const P = active(S);
    const b = (P.outline.beats[beatKey] ||= { notes: '', chapters: [] });
    if (fields.notes !== undefined) b.notes = clean(fields.notes, 6000);
    if (fields.chapters) b.chapters = fields.chapters.filter((id) => P.chapters.some((c) => c.id === id));
    touchToday(S, ctx).beatEdits++;
    settle(S, ctx);
}

const THREAD_COLORS = ['#d9a441', '#6fb3a6', '#c46b6b', '#8f7cc9', '#6b9fd4', '#b7c46b', '#d48fb4', '#e08a4f'];
export function addThread(S, name, ctx) {
    const P = active(S);
    const t = { id: newId(S, 't'), name: clean(name, 80) || 'A thread', color: THREAD_COLORS[P.threads.length % THREAD_COLORS.length], cells: {} };
    P.threads.push(t);
    touchToday(S, ctx).beatEdits++;
    settle(S, ctx);
    return t;
}
export function editThread(S, id, fields, ctx) {
    const t = active(S)?.threads.find((x) => x.id === id);
    if (!t) return;
    if (fields.name !== undefined) t.name = clean(fields.name, 80);
    if (fields.color) t.color = /^#[0-9a-f]{6}$/i.test(fields.color) ? fields.color : t.color;
    settle(S, ctx);
}
export function toggleWeave(S, threadId, chapterId, ctx) {
    const t = active(S)?.threads.find((x) => x.id === threadId);
    if (!t) return;
    t.cells[chapterId] = !t.cells[chapterId];
    if (!t.cells[chapterId]) delete t.cells[chapterId];
    touchToday(S, ctx).beatEdits++;
    settle(S, ctx);
}
export function deleteThread(S, id, ctx) {
    const P = active(S);
    P.threads = P.threads.filter((t) => t.id !== id);
    settle(S, ctx);
}

// ------------------------------------------------------------------ the well

export function drawWell(S, kind, opts, ctx) {
    const r = oracleDraw(S, kind, opts);
    settle(S, ctx);
    return r;
}

/** Keep a draw: into the codex where it fits, else into the novel's notes on the charter. */
export function keepDraw(S, d, ctx) {
    const P = active(S);
    if (!P || !d) return null;
    let made = null;
    if (d.kind === 'name') made = addCharacter(S, { name: d.data.name, people: d.data.people, role: P.characters.length ? 'Ally' : 'Protagonist' }, ctx);
    else if (d.kind === 'quirk') made = addCharacter(S, { name: 'Someone with a secret', voice: `They ${d.data.habit}.`, secret: `They ${d.data.secret}.`, notes: `A contradiction: ${d.data.contra}.`, role: 'Other' }, ctx);
    else if (d.kind === 'place') made = addWorld(S, 'place', { name: d.data.name, summary: d.data.summary }, ctx);
    else if (d.kind === 'magic') made = addWorld(S, 'magic', { name: d.data.name, summary: `Power ${d.data.source.charAt(0).toLowerCase() + d.data.source.slice(1)}`, source: d.data.source, cost: d.data.cost, limits: d.data.limits }, ctx);
    else if (d.kind === 'prophecy') made = addWorld(S, 'lore', { name: 'A prophecy', summary: d.text.split('\n')[0], details: d.text }, ctx);
    else if (d.kind === 'seed') { if (!P.premise.trim()) P.premise = d.data.premise; addNote(P, d.text); made = { premise: d.data.premise }; }
    else addNote(P, d.text);
    const t = touchToday(S, ctx);
    t.kept++;
    S.player.stats.kept++;
    if (d.kind === 'prophecy') S.player.stats.keptProphecy++;
    gainXp(S, XP.oracleKeep, 'Kept from the Well', 'codex', 'world');
    settle(S, ctx);
    return made;
}

function addNote(P, text) {
    P.notes = ((P.notes || '') + (P.notes ? '\n\n' : '') + text).slice(0, 20000);
}

// ------------------------------------------------------------------ the guild

export function turnInMain(S, ctx) {
    const id = claimMain(S, ctx);
    settle(S, ctx);
    return id;
}
export function turnInSide(S, id, ctx) {
    const ok = claimSide(S, id, ctx);
    settle(S, ctx);
    return ok;
}
export function buyTalent(S, id, ctx) {
    const ok = learnTalent(S, id);
    settle(S, ctx);
    return ok;
}
export function wear(S, id, ctx) {
    const ok = equip(S, id);
    settle(S, ctx);
    return ok;
}
export function noteExport(S, kind, ctx) {
    if (!(kind in S.player.stats.exports)) return;
    S.player.stats.exports[kind]++;
    emit(S, { type: 'export', kind });
    settle(S, ctx);
}
export function setGoal(S, n, ctx) {
    S.player.dailyGoal = Math.max(50, Math.min(10000, Math.round(+n || 300)));
    settle(S, ctx);
}
export function setFreePen(S, on, ctx) {
    S.player.freePen = !!on;
    settle(S, ctx);
}
export function finale(S, ctx) {
    S.player.finale = true;
    settle(S, ctx);
}
export { teach };
