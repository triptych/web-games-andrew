// Quillsworn — boot, the room router, saving, and turning simulation events into toasts, sounds and scenes.
//
// The rules live in js/sim (pure); each room in js/ui/rooms renders into #room and calls actions there.
// After every action the room calls app.after(), which drains S.events and schedules a save.
//
// ?debug=1 exposes window.__qs for the dev harnesses; &fasttext shows Thalion's lines at once.

import { VERSION, NOVEL_WORDS } from './config.js';
import { newGame, active } from './sim/state.js';
import * as A from './sim/actions.js';
import { roomOpen, levelProgress, rankName, deskTheme } from './sim/progress.js';
import { mainQuest, mainReady, MAIN_BY_ID, SIDE_BY_ID, sideAvailable, sideReady } from './sim/quests.js';
import { streak } from './sim/state.js';
import { ROOMS, ROOM_BY_ID, RELIC_BY_ID, TALENT_BY_ID, ATTRS } from './sim/data/guild.js';
import { LESSON_BY_ID } from './sim/data/lessons.js';
import { SCENES, LEVEL_LINES, RANK_LINES } from './sim/data/scenes.js';
import { loadGame, saveCore, saveProject, removeProject, storageOk, loadSettings, saveSettings, clearAll, backupJson, readBackup } from './save.js';
import { Sound } from './audio.js';
import { $, h, toast, modalOpen, closeTopModal, confirmBox, download, pickFile, fmt } from './ui/dom.js';
import { playScene, dialogueOpen, pop } from './ui/dialogue.js';
import { sigilSvg, icon } from './view/art.js';
import { startMotes } from './view/motes.js';
import { ROOM_VIEWS } from './ui/rooms.js';
import { openSettings } from './ui/settings.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

const app = {
    S: null,
    settings: loadSettings(),
    sound: new Sound(),
    storage: storageOk(),
    fastText: DEBUG && params.has('fasttext'),
    clockOffset: 0,
    room: 'hall',
    dirty: new Set(),
    cleanup: null,
    saveFailed: false,
    seenPaste: false,
};

app.ctx = () => {
    const d = new Date(Date.now() + app.clockOffset);
    const pad = (n) => String(n).padStart(2, '0');
    return { now: d.getTime(), today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours() };
};
app.P = () => active(app.S);
app.markDirty = (pid = app.S?.activeId) => { if (pid) app.dirty.add(pid); scheduleSave(); };

// ------------------------------------------------------------------ saving

let saveT = 0;
function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(saveNow, 700);
}
function saveNow() {
    clearTimeout(saveT);
    if (!app.S || !app.S.player.name) return true;
    let ok = saveCore(app.S);
    for (const id of app.dirty) {
        if (app.S.projects[id]) ok = saveProject(app.S.projects[id]) && ok;
        else removeProject(id);
    }
    if (ok) app.dirty.clear();
    if (!ok && app.storage && !app.saveFailed) toast('The guild couldn’t save just now. Download a backup from Settings to be safe.', { kind: 'warn', ms: 8000 });
    app.saveFailed = !ok;
    banner();
    return ok;
}
app.saveNow = saveNow;

function banner() {
    const b = $('banner');
    const show = !app.storage || app.saveFailed;
    b.hidden = !show;
    if (show) {
        b.innerHTML = '';
        b.append(h('span', {}, app.storage ? 'Your last change wasn’t saved.' : 'This browser won’t let the guild save. Your work lasts only until you close the tab.'),
            h('button', { class: 'btn small', onclick: () => downloadBackup() }, 'Download a backup'));
    }
}

export function downloadBackup() {
    const d = app.ctx().today;
    download(`quillsworn-backup-${d}.json`, backupJson(app.S, app.settings), 'application/json');
    toast('Backup downloaded. Keep it somewhere safe.', { icon: icon('bindery') });
}
app.downloadBackup = downloadBackup;

/** Print a whole HTML document from a hidden frame (the browser's dialog saves it as a PDF). */
app.printHtml = (html) => {
    const f = h('iframe', { class: 'print-frame', title: 'Print', 'aria-hidden': 'true' });
    f.srcdoc = html;
    f.addEventListener('load', () => {
        // give web fonts a moment, then print
        const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (err) { console.warn(err); } setTimeout(() => f.remove(), 60000); };
        (f.contentDocument?.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 250));
    }, { once: true });
    document.body.append(f);
};

app.importBackup = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return false;
    try {
        const { S, settings } = readBackup(await f.text());
        if (app.S?.player.name && !(await confirmBox('Restore this backup?', 'Everything in this browser will be replaced by the backup.', { ok: 'Restore', danger: true }))) return false;
        clearAll();
        app.S = S;
        app.settings = settings;
        saveSettings(settings);
        for (const id of S.order) app.dirty.add(id);
        saveNow();
        applySettings();
        enterGuild();
        toast(`Welcome back, ${S.player.name}.`);
        return true;
    } catch (err) {
        toast(err.message || 'That backup couldn’t be read.', { kind: 'warn', ms: 6000 });
        return false;
    }
};

app.eraseAll = async () => {
    if (!(await confirmBox('Erase everything?', 'Every novel, character and laurel in this browser will be deleted. Download a backup first if you might want them.', { ok: 'Erase it all', danger: true }))) return;
    clearAll();
    location.reload();
};

// ------------------------------------------------------------------ settings

function applySettings() {
    const s = app.settings;
    app.sound.enabled = !!s.sound;
    app.sound.typing = !!s.typing;
    document.documentElement.dataset.text = s.textSize;
    motes?.enable(!!s.motes);
}
app.saveSettings = () => { saveSettings(app.settings); applySettings(); };

// ------------------------------------------------------------------ the shell

function topbar() {
    const S = app.S;
    if (!S?.player.name) return;
    const p = S.player, lp = levelProgress(S), ctx = app.ctx();
    const goal = p.dailyGoal, today = p.today.date === ctx.today ? p.today.words : 0;
    const st = streak(p, ctx.today);
    $('tb-sigil').innerHTML = sigilSvg(p.sigil, { label: `${p.name}’s sigil` });
    $('tb-name').textContent = p.name;
    $('tb-rank').textContent = `${rankName(S)} · Level ${lp.level}`;
    $('tb-xpfill').style.width = `${(lp.frac * 100).toFixed(1)}%`;
    $('tb-xp').textContent = `${fmt(lp.xp)} / ${fmt(lp.hi)} XP`;
    $('tb-today').textContent = `${fmt(today)} / ${fmt(goal)}`;
    $('tb-day').classList.toggle('met', today >= goal);
    $('tb-streak').textContent = st ? `${st}` : '0';
    $('tb-streak-wrap').title = `${st} day${st === 1 ? '' : 's'} in a row at your goal`;
    $('tb-today-ring').style.setProperty('--p', Math.min(1, today / goal));
    document.documentElement.dataset.desk = deskTheme(S);
}
app.topbar = topbar;

function dock() {
    const nav = $('dock');
    nav.innerHTML = '';
    const S = app.S;
    const qReady = mainReady(S, app.ctx());
    const sideR = sideAvailable(S).some((q) => sideReady(S, q.id, app.ctx()));
    for (const r of ROOMS) {
        const open = roomOpen(S, r.id);
        const b = h('button', {
            class: `dock-btn${app.room === r.id ? ' on' : ''}${open ? '' : ' locked'}`, dataset: { room: r.id },
            'aria-label': open ? r.name : `${r.name} (locked)`, 'aria-current': app.room === r.id ? 'page' : null, title: open ? r.name : `${r.name}: not yet open`,
            onclick: () => { if (open) go(r.id); else toast(`${r.name} is still locked. Follow the guild’s road: ${mainQuest(S)?.title || ''}.`, { icon: icon('lock') }); },
        }, h('span', { class: 'dock-ic', html: icon(open ? r.id : 'lock') }), h('span', { class: 'dock-lbl' }, r.short),
        (r.id === 'hall' && qReady) || (r.id === 'board' && sideR) ? h('span', { class: 'badge', 'aria-label': 'ready' }, '!') : null);
        nav.append(b);
    }
}
app.dock = dock;

function go(room) {
    if (!ROOM_BY_ID[room] && room !== 'sheet') room = 'hall';
    if (room !== 'sheet' && !roomOpen(app.S, room)) room = 'hall';
    if (location.hash.slice(1) !== room) history.pushState(null, '', `#${room}`);
    render(room);
}
app.go = go;

function render(room, { keepScroll = false } = {}) {
    const main = $('room');
    const y = keepScroll ? main.scrollTop : 0;
    if (app.cleanup) { try { app.cleanup(); } catch (e) { console.error(e); } app.cleanup = null; }
    const changed = app.room !== room;
    app.room = room;
    main.innerHTML = '';
    main.dataset.room = room;
    const view = ROOM_VIEWS[room] || ROOM_VIEWS.hall;
    app.cleanup = view(app, main) || null;
    main.scrollTop = y;
    dock();
    topbar();
    if (changed) {
        document.title = room === 'hall' ? 'Quillsworn' : `${ROOM_BY_ID[room]?.name || 'Your Sheet'} · Quillsworn`;
        if (room !== 'hall' && room !== 'sheet' && !app.S.player.awarded[`visit:${room}`]) {
            app.S.player.awarded[`visit:${room}`] = 1;
            const line = SCENES[`visit_${room}`]?.[0];
            if (line) pop(app, line.text, line.mood);
            scheduleSave();
        }
        app.sound.page();
    }
}
app.refresh = () => render(app.room, { keepScroll: true });

window.addEventListener('popstate', () => { if (app.S?.player.main >= 0) render(location.hash.slice(1) || 'hall'); });

// ------------------------------------------------------------------ events

const QUEUE = [];
app.after = (opts = {}) => {
    const S = app.S;
    if (!S) return;
    if (opts.dirty !== false) app.markDirty();
    else scheduleSave();
    const ev = S.events.splice(0);
    for (const e of ev) handle(e);
    topbar();
    if (ev.some((e) => ['quest-ready', 'unlock', 'quest-done', 'bounty'].includes(e.type))) dock();
    if (QUEUE.length && !dialogueOpen()) setTimeout(drainQueue, 400);
    return ev;
};

function handle(e) {
    const s = app.sound;
    switch (e.type) {
        case 'xp': toast(`+${fmt(e.amount)} XP · ${e.why}`, { icon: '✦', ms: 2600 }); s.xp(); break;
        case 'level': {
            s.level();
            const line = LEVEL_LINES[e.level % LEVEL_LINES.length];
            setTimeout(() => pop(app, line.replace('{level}', e.level), 'proud'), 300);
            toast(`Level ${e.level}! A talent point to spend on your Sheet.`, { kind: 'gold', icon: '★', ms: 4500 });
            break;
        }
        case 'rank': setTimeout(() => pop(app, RANK_LINES[e.name] || `${e.name}.`, 'proud', { ms: 9000 }), 900); toast(`New rank: **${e.name}**`, { kind: 'gold', icon: '♛', ms: 6000 }); s.fanfare(); break;
        case 'unlock': toast(`A door opens: **${ROOM_BY_ID[e.room].name}**`, { kind: 'gold', icon: icon(e.room), ms: 5000 }); s.unlockDoor(); break;
        case 'relic': toast(`Relic: **${RELIC_BY_ID[e.id].name}**. ${RELIC_BY_ID[e.id].blurb}`, { kind: 'gold', icon: '◆', ms: 6000 }); break;
        case 'lesson': toast(`Lesson learned: *${LESSON_BY_ID[e.id].title}* (kept in the Library)`, { icon: icon('library'), ms: 4000 }); break;
        case 'laurel': toast(`Laurel: **${e.name}**`, { kind: 'gold', icon: '❦', ms: 5000 }); s.xp(); break;
        case 'bounty': toast(`Bounty done: ${e.text}`, { icon: '✓', ms: 4000 }); s.xp(); break;
        case 'attr': toast(`${ATTRS.find((a) => a.id === e.id).name} rises to ${e.level}`, { icon: '▲', ms: 3500 }); break;
        case 'talent': toast(`Talent learned: **${TALENT_BY_ID[e.id].name}**`, { icon: '✧' }); s.unlockDoor(); break;
        case 'points': toast(`+${e.n} talent point${e.n > 1 ? 's' : ''}, on the guild`, { icon: '✧' }); break;
        case 'quest-ready':
            if (e.main) toast(`Quest ready: **${MAIN_BY_ID[e.id].title}**. Speak with Thalion in the Great Hall.`, { kind: 'gold', icon: '!', ms: 6000 });
            else toast(`Side quest ready: **${SIDE_BY_ID[e.id].title}**. Turn it in at the Quest Board.`, { icon: '!', ms: 5000 });
            s.unlockDoor();
            break;
        case 'pasted':
            if (!app.seenPaste) { app.seenPaste = true; pop(app, 'Borrowed ink earns no glory, {name}, but it’s in your book all the same. Pasted words earn no XP.', 'wry'); }
            break;
        case 'book-done':
            // the finale tells the story of the guild's novel; any other finished book gets its own scene
            if (!(mainQuest(app.S)?.id === 'q_last_page' && e.words >= NOVEL_WORDS)) QUEUE.push(e);
            break;
        default: break;
    }
}

/** Speak with Thalion: turn in a ready quest (with its scenes), or hear where the road goes next. */
app.speak = async () => {
    const S = app.S, ctx = app.ctx();
    if (mainReady(S, ctx)) {
        const q = mainQuest(S);
        const id = A.turnInMain(S, ctx);
        app.sound.fanfare();
        const extra = { title: app.P()?.title || 'your book' };
        await playScene(SCENES[`done_${id}`], app, extra);
        app.after();
        const next = mainQuest(S);
        if (next) await playScene(SCENES[`start_${next.id}`], app, extra);
        if (id === 'q_last_page') { A.finale(S, app.ctx()); app.after(); }
        app.refresh();
        return q.id;
    }
    return null;
};

async function drainQueue() {
    while (QUEUE.length) {
        const e = QUEUE.shift();
        await playScene(SCENES[e.kind === 'novel' ? 'book_done' : 'book_done_short'], app, { kind: e.kind });
    }
}
app.drain = drainQueue;

// ------------------------------------------------------------------ title and prologue

function titleScreen() {
    const t = $('title');
    t.hidden = false;
    t.innerHTML = '';
    const loaded = app.loadResult;
    const has = app.S?.player.name;
    t.append(h('div', { class: 'title-card' },
        h('div', { class: 'title-crest', html: icon('scriptorium', 'ic crest') }),
        h('h1', { class: 'logo' }, 'Quillsworn'),
        h('p', { class: 'tagline' }, 'The Storytellers’ Guild of Vellmere'),
        h('p', { class: 'title-blurb' }, 'Write a fantasy novel and level up doing it. Thalion Silverquill, Master of the Guild, will teach you the craft: characters, worlds, plots, ink duels against the foes of every writer, and the binding of finished books.'),
        loaded?.error ? h('p', { class: 'warn-box' }, 'A saved guild was found but couldn’t be read. It has been left untouched. You can import a backup, or begin again.') : null,
        h('div', { class: 'title-menu' },
            has ? h('button', { class: 'btn primary big', id: 'btn-continue', onclick: () => { app.sound.unlock(); app.sound.click(); enterGuild(); } }, `Continue as ${app.S.player.name}`) : null,
            h('button', { class: `btn ${has ? '' : 'primary'} big`, id: 'btn-new', onclick: () => beginNew() }, has ? 'A new apprenticeship' : 'Climb the stair'),
            h('button', { class: 'btn ghost', id: 'btn-import', onclick: () => { app.sound.unlock(); app.importBackup(); } }, 'Import a backup')),
        !app.storage ? h('p', { class: 'warn-box' }, 'This browser is blocking storage, so nothing you write here will be saved after you close the tab. You can still play, and download a backup from Settings.') : null,
        h('p', { class: 'version' }, `v${VERSION} · everything is saved in this browser`)));
}

async function beginNew() {
    app.sound.unlock();
    app.sound.click();
    if (app.S?.player.name && !(await confirmBox('Begin a new apprenticeship?', 'Your current progress and novels in this browser will be erased. Download a backup first if you want to keep them.', { ok: 'Begin again', danger: true }))) return;
    if (app.S?.player.name) clearAll();
    app.S = newGame((Date.now() % 2147483647) >>> 0, Date.now());
    $('title').hidden = true;
    document.body.classList.add('in-prologue');
    await playScene(SCENES.prologue, app);
    document.body.classList.remove('in-prologue');
    A.finishPrologue(app.S, app.ctx());
    app.after();
    saveNow();
    enterGuild();
}

async function enterGuild() {
    $('title').hidden = true;
    if (app.S.player.main < 0) {
        // a reload in the middle of the prologue: finish what it still needs, then begin the road
        const missing = [];
        if (!app.S.player.name) missing.push({ ask: 'name' });
        if (!app.S.player.calling) missing.push({ who: 'thalion', mood: 'smile', text: 'Where were we? Ah, yes. Your calling.' }, { ask: 'calling' });
        if (missing.length) await playScene(missing, app);
        A.finishPrologue(app.S, app.ctx());
        app.after();
        saveNow();
    }
    $('shell').hidden = false;
    applySettings();
    banner();
    const want = location.hash.slice(1);
    render(roomOpen(app.S, want) || want === 'sheet' ? want : 'hall');
    A.settle(app.S, app.ctx());
    app.after({ dirty: false });
}

// ------------------------------------------------------------------ keys

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        app.flushWriting?.();
        if (saveNow()) toast('Saved.', { ms: 1400 });
        return;
    }
    if (e.key === 'Escape' && !dialogueOpen()) {
        if (closeTopModal()) { e.preventDefault(); return; }
        if (document.body.classList.contains('focus-mode')) { app.exitFocus?.(); e.preventDefault(); }
    }
});
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => app.sound.unlock(), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { app.flushWriting?.(); saveNow(); } });
window.addEventListener('pagehide', () => { app.flushWriting?.(); saveNow(); });

$('tb-sheet').addEventListener('click', () => go('sheet'));
$('tb-settings').addEventListener('click', () => openSettings(app));

// ------------------------------------------------------------------ boot

const motes = startMotes($('motes'));
const loaded = loadGame();
app.loadResult = loaded;
app.S = loaded && !loaded.error ? loaded : null;
applySettings();
if (app.S?.player.name && app.S.player.main >= 0 && location.hash && !params.has('title')) { enterGuild(); } else titleScreen();

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__qs = {
        app,
        get S() { return app.S; },
        get room() { return app.room; },
        A,
        go,
        modalOpen,
        dialogueOpen,
        saveNow,
        /** Shift the clock by days (for streaks and bounties). */
        days(n) { app.clockOffset += n * 86400000; A.settle(app.S, app.ctx()); app.after(); },
        /** Give XP, as a quest would. */
        xp(n) { app.S.player.xp += n; A.settle(app.S, app.ctx()); app.after(); },
        /** Skip the prologue with a ready-made apprentice. */
        quickStart(name = 'Tester', calling = 'bard') {
            app.S = newGame(12345, Date.now());
            A.setIdentity(app.S, { name, calling }, app.ctx());
            A.finishPrologue(app.S, app.ctx());
            app.after();
            saveNow();
            enterGuild();
        },
    };
}
