// Folio & Fable — entry point. Boots the views, runs the shop clock in fixed steps while the doors are open,
// routes taps and keys to commands, turns simulation events into story beats, sheets and sounds, and saves.
//
// ?debug=1 exposes window.__ff for the dev/ harnesses; &fast=N runs the shop clock N× faster.

import { STEP, MAX_FRAME, SAVE_KEY, VERSION } from './config.js';
import { CHAPTERS, INSPIRATIONS, SKILLS, HEROES, RARITY, KINDS, MATERIALS } from './sim/data.js';
import { newGame, act, step, book, chapterProgress, shelfBooks, cell } from './sim/game.js';
import { describe, makeBook } from './sim/books.js';
import * as Bot from './sim/bot.js';
import { ShopView } from './view/shop.js';
import { BookStage } from './view/book3d.js';
import { Audio, LINES } from './audio.js';
import { Input } from './input.js';
import { UI, h } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave, saveInfo } from './save.js';
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const settings = loadSettings();
document.documentElement.classList.toggle('calm', !!settings.calm);
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music, settings.voice);
const input = new Input();
const shop = new ShopView($('shop'));
const stage = new BookStage($('stage3d'));
const shelfStage = new BookStage($('shelves-canvas'));

let G = newGame(1);
let mode = 'title';
let acc = 0, last = performance.now(), saveT = 0, speed = 1;
let bot = null;
let insBook = null;
const seen = {};

const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music, s.voice); document.documentElement.classList.toggle('calm', !!s.calm); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
    cmd: (c) => cmd(c),
    inspect: (b) => openInspect(b),
    shelves3d: () => openShelves(),
    onClose: (id) => {
        if (id === 'inspect') { stage.visible = false; insBook = null; }
        if (id === 'shelves3d') shelfStage.visible = false;
        if (id === 'evening' && G.phase === 'evening' && mode === 'play') ui.tip('Tap Sleep 🌙 when you are ready for tomorrow.');
    },
});
ui.G = G;
audio.onSay = (name, text, secs) => { if (!ui.isOpen('story')) ui.caption(text, secs); };

// ------------------------------------------------------------------ commands
/** Run a command, explain a refusal, react to what happened, redraw the sheets. */
function cmd(c) {
    const r = act(G, c);
    if (!r.ok) { audio.ui('nope'); if (r.msg) ui.toast(r.msg); }
    flushEvents();
    ui.refresh(G);
    return r;
}

// ------------------------------------------------------------------ the layout: sized in px from the visual viewport
function fit() {
    const vv = window.visualViewport;
    const hgt = Math.round(vv ? vv.height : innerHeight);
    $('app').style.height = hgt + 'px';
    shop.resize();
}
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);

// ------------------------------------------------------------------ title
function refreshTitle() {
    const info = saveInfo();
    const c = $('btn-continue');
    c.hidden = !info;
    if (info) c.textContent = `Continue · Day ${info.day}`;
}
refreshTitle();
ui.openScreen('title');

const unlock = () => { audio.init(); };
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'new') startGame(newGame((Date.now() % 1e9) | 0), true);
    else if (a === 'continue') { const g = loadGame(); if (g) startGame(g, false); else ui.toast('That save could not be read.'); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});
$('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const a = b.dataset.act;
    if (a === 'resume') ui.closeScreen('pause');
    else if (a === 'quit') { save(); cloudUI.autosave({ force: true }); toTitle(); }
    else if (a === 'journal') { ui.closeScreen('pause'); journal(); }
    else if (a === 'cloud') cloudUI.open();
    else ui.openScreen(a);
});

function startGame(g, fresh) {
    G = g;
    ui.G = G;
    ui.closeAll();
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    $('app').hidden = false;
    fit();
    shop.cam = 0;
    requestAnimationFrame(() => shop.centerOn(2));
    audio.play(G.phase === 'evening' ? 'evening' : 'shop');
    if (fresh) {
        ui.say({ art: 'art/title.webp', text: LINES['vellum-prologue'], voice: 'vellum-prologue' });
        ui.say({ por: 'art/por-tam.webp', name: 'Tam', text: LINES['tam-forme'], voice: 'tam-forme' });
    }
    tellChapter();
    if (G.phase === 'evening') ui.openEvening(G);
    save();
}

function toTitle() {
    ui.closeAll();
    mode = 'title';
    $('app').hidden = true;
    bot = null;
    G = newGame(1);
    ui.G = G;
    refreshTitle();
    audio.play('title');
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    save();
    ui.openScreen('pause');
}

function save() { if (mode === 'play') saveGame(G); }

/** The current chapter's introduction, once. */
function tellChapter() {
    const p = chapterProgress(G);
    if (!p) return;
    const key = 'ch' + p.ch.n;
    if (G.story.told.includes(key)) return;
    act(G, { t: 'ack', key });
    ui.say({ text: p.ch.intro, voice: `vellum-ch${p.ch.n}-intro` });
}

function journal() {
    const done = CHAPTERS.filter((c) => G.story.ch > c.n);
    const p = chapterProgress(G);
    for (const c of done) ui.say({ text: `Chapter ${c.n}, ${c.name}: ${c.done}` });
    if (p) ui.say({ text: `Now, chapter ${p.ch.n}, ${p.ch.name}. ${p.ch.goal}` });
    else ui.say({ text: 'The story is told, and the shop goes on. Every book you sell adds a page to Larkspur.' });
}

// ------------------------------------------------------------------ the 3D views
function openInspect(b) {
    const bk = typeof b === 'object' ? b : book(G, b);
    if (!bk) return;
    insBook = bk;
    ui.openScreen('inspect');
    stage.visible = true;
    stage.inspect(bk);
    $('ins-title').textContent = bk.title + (bk.plus ? ` +${bk.plus}` : '');
    $('ins-sub').textContent = `${RARITY[bk.rarity].name} ${KINDS[bk.kind].name} · by ${bk.author} · Larkspur, ${bk.year}`;
    const st = $('ins-stats');
    st.replaceChildren(...describe(bk).split(' · ').slice(1).map((s) => h('span', { class: 'tag' }, s)));
    const extra = [];
    if (bk.skill) extra.push(`🎓 ${SKILLS[bk.skill].name}: ${SKILLS[bk.skill].desc} ${SKILLS[bk.skill].who === 'adv' ? '(works while an adventurer carries it)' : '(Tam learns it by reading)'}`);
    if (bk.talk) extra.push('💬 This book talks.');
    extra.push(`Worth about ${bk.value} 🪙.`);
    $('ins-extra').textContent = extra.join(' ');
    const owned = G.books.includes(bk);
    $('ins-talk').hidden = !(bk.talk && owned);
    $('ins-open').textContent = 'Open 📖';
}
$('ins-open').addEventListener('click', () => { const o = stage.toggleOpen(); $('ins-open').textContent = o ? 'Close 📕' : 'Open 📖'; audio.ui('page'); });
$('ins-talk').addEventListener('click', () => { if (insBook) cmd({ t: 'talk', book: insBook.id }); });

function openShelves() {
    audio.ui('open');
    ui.openScreen('shelves3d');
    shelfStage.visible = true;
    const n = shelfStage.shelves(G, G.books);
    if (!n) ui.toast('No shelves yet.');
}
shelfStage.onPick = (id) => { audio.ui('page'); openInspect(id); };

// ------------------------------------------------------------------ the dock, the HUD, the shop floor
for (const t of document.querySelectorAll('#dock .tab')) t.addEventListener('click', () => openTab(t.dataset.tab));
function openTab(tab) {
    audio.ui('open');
    ui.closeAll(['story']);
    if (tab === 'books') ui.openBooks(G);
    else if (tab === 'furniture') ui.openFurniture(G);
    else if (tab === 'bindery') ui.openBindery(G);
    else if (tab === 'heroes') ui.openHeroes(G);
    else if (tab === 'town') ui.openTown(G);
    else if (tab === 'trader') ui.openTrader(G);
}
$('btn-main').addEventListener('click', () => mainAction());
function mainAction() {
    audio.ui('click');
    if (G.phase === 'morning') {
        if (!G.books.some((b) => b.loc && b.loc.row)) ui.toast('The shelves are empty! Customers will only look around.');
        cmd({ t: 'open' });
    } else if (G.phase === 'open') cmd({ t: 'close' });
    else { ui.closeScreen('evening'); cmd({ t: 'next' }); }
}
$('evening-sleep').addEventListener('click', () => { ui.closeScreen('evening'); audio.say('vellum-goodnight'); cmd({ t: 'next' }); });
$('btn-pause').addEventListener('click', () => pause());
$('goal').addEventListener('click', () => { audio.ui('open'); journal(); });
$('btn-shelves3d').addEventListener('click', () => openShelves());
$('btn-speed').addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; $('btn-speed').textContent = speed + '×'; audio.ui('click'); });
$('btn-waiting').addEventListener('click', () => { const cu = G.customers.find((c) => c.state === 'ask' && c.want); if (cu) { audio.ui('open'); ui.openServe(G, cu.id); } });
ui.onBought = () => { shop.arranging = true; };

$('shop').addEventListener('click', (e) => {
    if (mode !== 'play' || ui.anyScreen()) return;
    const p = shop.pick(G, e.clientX, e.clientY);
    if (!p) return;
    if (p.type === 'cust') { audio.ui('open'); ui.openServe(G, p.id); }
    else if (p.type === 'slot') { shop.sel = { slot: p.slot, row: p.row }; audio.ui('open'); ui.openColumn(G, p.slot); }
    else if (p.type === 'counter') {
        const cu = G.customers.find((c) => c.state === 'ask' && c.want);
        if (cu) ui.openServe(G, cu.id);
        else { audio.say('tam-welcome', undefined, { gap: 2 }); ui.toast('Tam and Old Vellum mind the counter.'); }
    }
});

function tip() {
    if (ui.anyScreen()) return ui.tip('');
    const shelved = G.books.some((b) => b.loc && b.loc.row);
    const stored = Object.values(G.stored).some((n) => n > 0);
    if (G.phase === 'open') return ui.tip(G.customers.some((c) => c.state === 'ask' && c.want) ? 'Someone has a wish. Tap 🔔 or the customer with a ?' : '');
    if (stored) return ui.tip('Tap a ＋ in the shop to place your new furniture.');
    if (!shelved) return ui.tip('Tap a bookshelf to put Elowen\'s books on it, or use ✨ Fill shelves in Books.');
    if (G.phase === 'morning') return ui.tip(G.day === 1 ? 'Ready? Open the shop ☀️' : '');
    return ui.tip('');
}

// ------------------------------------------------------------------ input routing
function handlePresses() {
    input.poll();
    const press = input.next();
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        const top = ui.top();
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if (key === 'Escape' || key === 'KeyP') {
            if (top === 'title' || top === 'ending') return;
            if (top === 'story') { $('story-next').click(); return; }
            audio.ui('close'); ui.closeTop();
        } else if ((key === 'Enter' || key === 'Space') && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode !== 'play') return;
    if (key === 'Escape' || key === 'KeyP') pause();
    else if (key === 'KeyO') mainAction();
    else if (/^Digit[1-6]$/.test(key)) openTab(['books', 'furniture', 'bindery', 'heroes', 'town', 'trader'][+key.slice(5) - 1]);
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    shop.onEvents(G, ev);
    audio.onEvents(G, ev);
    for (const e of ev) {
        switch (e.type) {
            case 'chapter': {
                const C = CHAPTERS[e.n - 1];
                ui.say({ text: C.done, voice: `vellum-ch${e.n}-done`, art: e.n === 7 ? 'art/por-elowen.webp' : null });
                if (e.n === 6) ui.say({ por: 'art/por-tam.webp', name: 'Tam', text: LINES['tam-promise'], voice: 'tam-promise' });
                if (e.n < 7) tellChapter();
                break;
            }
            case 'ending':
                ui.say({ por: 'art/por-tam.webp', name: 'Tam', text: LINES['tam-wedidit'], voice: 'tam-wedidit', after: () => { audio.play('title'); ui.openScreen('ending'); } });
                break;
            case 'inspired': {
                const I = INSPIRATIONS.find((x) => x.id === e.id);
                const art = ['guild', 'school', 'bakery', 'theatre', 'tower', 'garden'][I.art];
                ui.say({ art: `art/town-${art}.webp`, por: 'art/por-vellum.webp', name: `Larkspur is inspired: ${I.name}`, text: I.text });
                break;
            }
            case 'returned': ui.showLoot(G, e); break;
            case 'trader': ui.toast('🧳 Ottoline\'s caravan is at the door! See the Trader tab.'); break;
            case 'donation': if (e.books.length) ui.toast(`📦 The donation basket: ${e.books.length} book${e.books.length > 1 ? 's' : ''} left on the step.`); break;
            case 'crafted': {
                const b = book(G, e.book);
                if (b) { ui.toast(`🔨 Bound: ${b.title} (${RARITY[b.rarity].name})`); openInspect(b); }
                break;
            }
            case 'rebound': { const b = book(G, e.book); if (b) ui.toast(`✨ ${b.title} is now +${e.plus}.`); break; }
            case 'read': {
                const b = book(G, e.book);
                ui.toast(e.learned ? `📖 Tam read “${b?.title}” and learned ${SKILLS[e.learned].name}!` : `📖 Tam read “${b?.title}” by lamplight.`);
                break;
            }
            case 'talk': {
                const b = book(G, e.book);
                ui.caption(`“${e.line}” — ${b?.title}`, 5);
                if (e.gift) ui.toast(`🎁 It gave Tam a ${MATERIALS[e.gift].name}.`);
                if (G.stats.talked === 1) audio.say('tam-talking', undefined, { gap: 1 });
                break;
            }
            case 'hired': ui.toast(`🗺️ ${HEROES[e.hero].name} joins the shop!`); break;
            case 'sent': ui.toast('🧭 Off they go!'); break;
            case 'opened': shop.arranging = false; shop.sel = null; audio.play('shop'); break;
            case 'closed':
                audio.play('evening');
                ui.closeAll(['story', 'loot']);
                ui.openEvening(G);
                save();
                cloudUI.autosave();
                break;
            case 'morning':
                audio.play('shop');
                shop.arranging = true;
                save();
                break;
            case 'patron': ui.toast(`🌹 The Duchess sends ${e.gold} 🪙.`); break;
            case 'lapsed': ui.toast(`📜 ${e.name} found a book elsewhere. No hard feelings.`); break;
            case 'gaveUp': ui.toast('A customer wandered off. They\'ll be back another day.'); if (ui.isOpen('serve')) ui.refresh(G); break;
            case 'commissioned': case 'fulfilled': case 'served': ui.dock(G); break;
            default: break;
        }
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handlePresses();
    if (mode === 'play') {
        if (bot) botTick();
        const running = G.phase === 'open' && !ui.anyScreen() && !ui.talking;
        if (running) {
            acc += dt * speed * FAST;
            let n = 0;
            while (acc >= STEP && n < 40 * FAST) {
                step(G, STEP);
                if (bot) Bot.serve(G, bot);
                acc -= STEP;
                n++;
            }
            saveT += dt;
            if (saveT > 20) { saveT = 0; save(); cloudUI.autosave(); }
        } else acc = 0;
        flushEvents();
        shop.arranging = G.phase !== 'open';
        shop.frame(G, dt);
        ui.hud(G);
        ui.goal(G);
        ui.dock(G);
        tip();
    }
    stage.frame(dt);
    shelfStage.frame(dt);
}

/** The bot plays the real game through the same commands (debug autoplay). */
function botTick() {
    if (ui.isOpen('story')) { $('story-next').click(); return; }
    for (const id of ['loot', 'inspect', 'ending', 'serve', 'picker', 'column', 'books', 'furniture', 'bindery', 'heroes', 'town', 'trader']) if (ui.isOpen(id)) ui.closeScreen(id);
    if (G.phase === 'morning') { Bot.morning(G, bot); flushEvents(); ui.closeAll(['story']); cmd({ t: 'open' }); }
    else if (G.phase === 'evening' && !ui.isOpen('story')) { Bot.evening(G, bot); ui.closeScreen('evening'); cmd({ t: 'next' }); }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); pause(); } });
window.addEventListener('pagehide', () => { save(); cloudUI.autosave({ keepalive: true }); });

// cloud saves (lib/core/cloud.js + cloud-ui.js): one sign-in for every game on the site; this game's rows are 'game-150'.
// The save is everything stored under SAVE_KEY (settings stay on the device); loading writes it back and reloads.
const cloud = makeCloud({ game: 'game-150' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { save(); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const s = snapValue(snap, SAVE_KEY); return s?.data ? `Day ${s.day} · Chapter ${Math.min(7, s.ch)}` : 'A bookshop in Larkspur'; },
    hasGame: () => mode === 'play' || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
audio.play('title');
requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.__ff = {
        get G() { return G; },
        get mode() { return mode; },
        get speed() { return speed; },
        seen, ui, shop, stage, shelfStage, audio, input, bot: Bot,
        start(seed = 1, { story = false } = {}) {
            startGame(newGame(seed), story);
            if (!story) { ui.dialogs.length = 0; ui.closeScreen('story'); }
            return G;
        },
        autoplay(on = true) { bot = on ? Bot.makeBot({ seed: 3 }) : null; },
        /** Play whole days with the bot, synchronously; events reach the views as usual. */
        ff(days = 1) {
            const b = Bot.makeBot({ seed: 5 });
            for (let d = 0; d < days && !G.ending; d++) { ui.closeAll(); Bot.playDay(G, b); flushEvents(); }
            ui.dialogs.length = 0; ui.closeAll();
            return G.day;
        },
        cmd: (c) => cmd(c),
        /** Add n procedural books to the back room (tests and screenshots). */
        give(n = 1, opts = {}) { for (let i = 0; i < n; i++) G.books.push(makeBook(G.nextId++, (G.rng() * 2 ** 31) | 0, { rarity: i % 5, ...opts })); ui.refresh(G); return G.books.length; },
        skipStory() { ui.dialogs.length = 0; ui.closeScreen('story'); },
        inspect: (id) => openInspect(id),
        shelves: () => openShelves(),
        save: () => saveGame(G),
        hasSave,
        shelfBooks: (row, s) => shelfBooks(G, row, s),
        cell: (row, s) => cell(G, row, s),
    };
}
