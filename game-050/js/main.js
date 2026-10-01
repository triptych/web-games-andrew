/**
 * main.js — Tomebound: boot, the mode machine (title → town ⇄ battle), input, the
 * battle director, and every player action (G.*) the panels call.
 *
 * The simulation (js/sim) decides everything instantly and returns events; the
 * director plays them one at a time (each handler returns how long to wait) and, when
 * the queue drains, snaps the board and HUD to the true state.
 */

import * as THREE from 'three';
import { initScene, setActive, render, town as TS, battle as BS, rectToPlane, planeToScreen, screenToPlane, townToScreen, shake, flash, kick, setQuality, getQuality, brightness, onResize } from './view/scene.js';
import { Fx } from './view/fx.js';
import { BoardView } from './view/board3d.js';
import { MonsterView } from './view/monster3d.js';
import { Backdrop } from './view/backdrop.js';
import { TownView } from './view/town3d.js';
import { initAudio, sfx, startMusic, setSoundOn, setMusicOn } from './audio.js';
import { loadProfile, saveProfile, clearProfile, loadSettings, saveSettings } from './save.js';
import { $, h, toast, floatText, banner, clearBanner, centerOf, fmt } from './ui/dom.js';
import { renderTown, buildBattleHud, updateBattleHud, cardHit, manaBarEl, buildPotions } from './ui/hud.js';
import * as P from './ui/panels.js';
import { initDialog, playScene, dialogOpen, advanceDialog, skipDialog } from './ui/dialog.js';
import {
    newProfile, tick, catchUp, collect, collectAll, build, canBuild, freePlots, craft, brew, rankUpSpell, study, equip, unequip, sell,
    allocate, autoAllocate, respec, setSlots, heroStats, claimQuest, rerollQuest, startBattle, finishBattle, nodeState, wingMap,
    openTreasure, takeBlessing, resolveEvent, nextStory, queueStory, preFightScene, carried, gainXp,
} from './sim/game.js';
import { doSwap, doCast, doPotion, monsterTurn, canCast } from './sim/battle.js';
import { isValidSwap, adjacent } from './sim/board.js';
import { bestMove, botBattleAction } from './sim/bot.js';
import { CLASSES, SPELLS, POTIONS, MANA, GEM_INFO, RES_INFO, BLESSINGS } from './sim/data.js';
import { BUILDINGS, carryLimit, capacity as capOf } from './sim/town.js';
import { MSPELLS } from './sim/monsters.js';
import { BOOK_BY_ID } from './sim/books.js';
import { WINGS } from './sim/regions.js';
import { sceneFor } from './sim/story.js';
import { itemScore } from './sim/items.js';
import { questDone } from './sim/quests.js';
import { SLOTS } from './sim/items.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const clock = new THREE.Clock();
const settings = loadSettings();

const G = {
    profile: null, mode: 'boot', run: null, settings, placing: null,
    queue: [], wait: 0, busyUntilDrain: false, disp: null, monster: null, hintT: 0, aiT: 0, endT: 0,
    lastClear: null, side: 'p', pendingEnd: null, returnTo: null, saveT: 0, tickT: 0,
};
window.addEventListener('error', (e) => console.error('Tomebound error:', e.message));

// ------------------------------------------------------------------ Boot

let townView, boardView, backdrop, townFx, battleFx;

function boot() {
    initScene();
    if (settings.quality !== null && settings.quality !== undefined) setQuality(settings.quality);
    setSoundOn(settings.sound); setMusicOn(settings.music);
    townFx = new Fx(TS.scene, 300);
    townView = new TownView(TS.scene, TS.camera, townFx);
    battleFx = new Fx(BS.scene, 500);
    backdrop = new Backdrop(BS.scene);
    backdrop.setWing(0);
    boardView = new BoardView(BS.scene, battleFx);
    initDialog();
    wireUi();
    initInput();
    G.profile = loadProfile();
    if (G.profile) { townView.sync(G.profile); }
    else {
        // Title backdrop: a pretend village with a few buildings so the island isn't empty.
        townView.sync({ books: { sparks: 1, almanac: 1, ember: 1 }, cls: 'mage', town: { lumber: { level: 3, plot: 5 }, market: { level: 2, plot: 7 }, herbs: { level: 2, plot: 1 }, magetower: { level: 4, plot: 3 }, forge: { level: 2, plot: 9 } } });
    }
    toTitle();
    requestAnimationFrame(frame);
    setTimeout(() => $('fade').classList.remove('on'), 80);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
    window.addEventListener('pagehide', persist);
    window.addEventListener('resize', () => { if (G.mode === 'battle') layoutBattle(); });
}

function persist() { if (G.profile) { if (G.mode !== 'battle') tick(G.profile, Date.now()); saveProfile(G.profile); } }

// ------------------------------------------------------------------ Modes

function show(id, on) { $(id).hidden = !on; }

function toTitle() {
    P.closePanel(true);
    G.mode = 'title';
    setActive('town');
    show('title', true); show('town-ui', false); show('battle-ui', false); show('menu-btn', false);
    $('bubbles').innerHTML = '';
    $('btn-continue').hidden = !loadProfile();
    if (G.profile) townView.sync(G.profile);
    startMusic('title');
}

function enterTown() {
    G.mode = 'town';
    G.run = null;
    setActive('town');
    show('title', false); show('battle-ui', false); show('town-ui', true); show('menu-btn', true);
    clearBanner();
    tick(G.profile, Date.now());
    townView.sync(G.profile);
    renderTown(G.profile);
    startMusic('town');
    updateTownHint();
}

async function drainStory() {
    const p = G.profile;
    let key;
    while ((key = nextStory(p))) {
        const lines = sceneFor(key);
        if (lines) await playScene(lines, storyCtx());
        saveProfile(p);
    }
}

function storyCtx(boss) {
    const p = G.profile;
    return { name: p.name, cls: CLASSES[p.cls].name.toLowerCase(), icon: CLASSES[p.cls].icon, boss };
}

function updateTownHint() {
    const p = G.profile, hint = $('town-hint');
    if (!p || G.mode !== 'town') { hint.hidden = true; return; }
    let text = null, extra = null;
    if (G.placing) {
        text = `Tap a glowing plot to build the ${BUILDINGS[G.placing].name}`;
        extra = h('button.mini', { onclick: () => cancelPlacing() }, 'Cancel');
    } else if (!p.town.lumber) text = 'Tap 🏗️ Build and place a Lumber Camp!';
    else if (!p.counters.battles) text = 'Tap 🗺️ Adventure and enter the Sunlit Atrium!';
    else if (!p.flags.collected && Object.values(p.town).some((b) => b.basket >= 1)) text = 'Tap a bubble above a building (or 🧺 Collect) to gather!';
    else if (p.points && !p.flags.allocated) text = 'You have stat points! Tap 🧙 Hero to spend them.';
    hint.hidden = !text;
    hint.innerHTML = '';
    if (text) hint.append(h('span', text), ...(extra ? [extra] : []));
}

// ------------------------------------------------------------------ UI wiring

function wireUi() {
    $('btn-new').addEventListener('click', () => {
        initAudio(); sfx.click();
        if (loadProfile()) P.confirmPanel('Start over?', 'You already have a saved adventure. Starting a new one will erase it.', 'Start fresh', () => P.createPanel(G));
        else P.createPanel(G);
    });
    $('btn-continue').addEventListener('click', () => { initAudio(); sfx.click(); continueGame(); });
    $('btn-help').addEventListener('click', () => { initAudio(); sfx.open(); P.helpPanel(); });
    $('nav-adventure').addEventListener('click', () => { sfx.open(); P.adventurePanel(G); });
    $('nav-build').addEventListener('click', () => { sfx.open(); cancelPlacing(); P.buildPanel(G); });
    $('nav-hero').addEventListener('click', () => { sfx.open(); P.heroPanel(G); });
    $('hero-badge').addEventListener('click', () => { sfx.open(); P.heroPanel(G); });
    $('nav-library').addEventListener('click', () => { sfx.open(); P.libraryPanel(G); });
    $('nav-quests').addEventListener('click', () => { sfx.open(); P.questsPanel(G); });
    $('nav-collect').addEventListener('click', () => G.collectAll());
    $('mute-btn').addEventListener('click', () => { initAudio(); G.toggleSetting('sound'); });
    $('mute-btn').classList.toggle('off', !settings.sound);
    $('menu-btn').addEventListener('click', () => { sfx.open(); P.menuPanel(G); });
    $('battle-menu').hidden = true;
    window.addEventListener('pointerdown', () => initAudio(), { passive: true });
    window.addEventListener('keydown', onKey);
}

function continueGame() {
    G.profile = loadProfile();
    if (!G.profile) return;
    const away = catchUp(G.profile, Date.now());
    enterTown();
    drainStory().then(() => {
        if (away.minutes >= 3 && Object.keys(away.gained).length) P.awayPanel(G, away, () => renderTown(G.profile));
    });
}

// ------------------------------------------------------------------ Actions (called by panels)

const ok = (r, msg) => { if (r && r.ok === false) { sfx.deny(); toast(r.why || msg || 'Not possible'); return false; } return true; };
function changed() { saveProfile(G.profile); renderTown(G.profile); P.refreshPanel(); updateTownHint(); }

Object.assign(G, {
    idle: () => !G.queue.length && G.wait <= 0 && !boardView.busy() && !G.pendingEnd,
    quality: () => getQuality(),

    newGame(cls, name) {
        clearProfile();
        G.profile = newProfile({ cls, name, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, now: Date.now() });
        saveProfile(G.profile);
        P.closePanel(true);
        $('fade').classList.add('on');
        setTimeout(() => {
            townView.built = {};
            for (const pg of townView.plotGroups) for (const ch of [...pg.g.children]) if (ch !== pg.base && !ch.userData.plot && ch.userData.plot !== 0) pg.g.remove(ch);
            enterTown();
            $('fade').classList.remove('on');
            drainStory().then(updateTownHint);
        }, 380);
    },

    collect(id) {
        const r = collect(G.profile, id);
        if (!r) return;
        G.profile.flags.collected = true;
        popCollect(id, r);
        changed();
    },
    collectAll() {
        tick(G.profile, Date.now());
        const all = collectAll(G.profile);
        if (!all.length) { toast('Nothing to collect yet — the baskets are filling!'); sfx.deny(); return; }
        G.profile.flags.collected = true;
        all.forEach((r, i) => setTimeout(() => popCollect(r.id, r, i), i * 90));
        changed();
    },

    startPlacing(id) {
        const c = canBuild(G.profile, id);
        if (!ok(c)) return;
        if (!freePlots(G.profile).length) { toast('No free plots left!'); return; }
        P.closePanel(true);
        G.placing = id;
        townView.setBuildMode(true, freePlots(G.profile));
        updateTownHint();
    },
    placeAt(plot) {
        const id = G.placing;
        cancelPlacing();
        const r = build(G.profile, id, plot, Date.now());
        if (!ok(r)) return;
        sfx.build();
        townView.sync(G.profile);
        toast(`${BUILDINGS[id].icon} ${BUILDINGS[id].name} built!`);
        changed();
    },
    upgrade(id) {
        const r = build(G.profile, id, undefined, Date.now());
        if (!ok(r)) return;
        sfx.build();
        townView.sync(G.profile);
        toast(`${BUILDINGS[id].icon} ${BUILDINGS[id].name} is now level ${r.level}!`);
        changed();
    },
    openBuilding(id) { sfx.open(); P.buildingPanel(G, id); },
    craft(slot) {
        const r = craft(G.profile, slot);
        if (!ok(r)) return;
        sfx.make();
        toast(`Forged: ${r.item.name}`);
        const eq = G.profile.gear[r.item.slot];
        if (itemScore(r.item, G.profile.cls) > itemScore(eq, G.profile.cls)) toast('▲ Better than what you\'re wearing — equip it from 🧙 Hero → Gear.');
        changed();
    },
    brew(id) { if (ok(brew(G.profile, id))) { sfx.potion(); changed(); } },
    rankUp(id) { const r = rankUpSpell(G.profile, id); if (ok(r)) { sfx.levelUp(); toast(`${SPELLS[id].name} is now rank ${r.rank}!`); changed(); } },
    study(id) { const r = study(G.profile, id); if (ok(r)) { sfx.book(); toast(`${BOOK_BY_ID[id].title} studied to tier ${r.tier}!`); changed(); } },
    equip(uid) { if (equip(G.profile, uid)) { sfx.select(); changed(); } },
    unequip(slot) { if (unequip(G.profile, slot)) { sfx.click(); changed(); } else toast('Your bag is full.'); },
    sell(uid) { const v = sell(G.profile, uid); if (v) { sfx.coin(); changed(); } },
    sellWorse() {
        const p = G.profile;
        let total = 0;
        for (const it of p.bag.slice()) if (itemScore(it, p.cls) <= itemScore(p.gear[it.slot], p.cls)) total += sell(p, it.uid);
        if (total) { sfx.coin(); toast(`Sold for 🪙 ${total}`); }
        changed();
    },
    allocate(s) { if (allocate(G.profile, s)) { G.profile.flags.allocated = true; sfx.select(); changed(); } },
    autoAllocate() { autoAllocate(G.profile); G.profile.flags.allocated = true; sfx.levelUp(); changed(); },
    respec() { if (respec(G.profile)) { sfx.click(); changed(); } },
    toggleSlot(id) {
        const p = G.profile;
        const slots = p.slots.includes(id) ? p.slots.filter((x) => x !== id) : [...p.slots, id];
        if (slots.length > heroStats(p).slots) { toast(`Only ${heroStats(p).slots} spell slots — unequip one first.`); sfx.deny(); return; }
        setSlots(p, slots);
        sfx.select();
        changed();
    },
    claim(qid) {
        const r = claimQuest(G.profile, qid);
        if (!r) return;
        sfx.quest();
        toast(`Quest complete! 🪙 +${r.gold} · ⭐ +${r.xp}${r.item ? ' · 🎁 ' + r.item.name : ''}${r.potion ? ' · ' + POTIONS[r.potion].icon : ''}`, 3200);
        celebrateUps(r.ups);
        changed();
    },
    reroll(qid) { if (rerollQuest(G.profile, qid)) { sfx.click(); changed(); } },
    hunt(qid) { P.preBattlePanel(G, { type: 'bounty', quest: qid }); },
    readBook(id) { sfx.open(); P.bookPanel(G, id); },
    setLoad(id, d) {
        const p = G.profile;
        const total = Object.values(p.loadout).reduce((a, b) => a + b, 0);
        const cur = p.loadout[id] || 0;
        if (d > 0 && (total >= carryLimit(p) || cur >= p.potions[id])) { sfx.deny(); return; }
        p.loadout[id] = Math.max(0, cur + d);
        sfx.click();
        changed();
    },

    enterNode(wi, id) {
        const node = wingMap(G.profile, wi).nodes[id];
        if (nodeState(G.profile, wi, id) !== 'open') return;
        sfx.open();
        if (['battle', 'elite', 'keeper', 'guardian', 'final'].includes(node.kind)) { autoLoadout(); P.preBattlePanel(G, { type: 'node', wing: wi, node: id }); }
        else if (node.kind === 'treasure') {
            const r = openTreasure(G.profile, wi, id);
            if (!r) return;
            sfx.coin(); sfx.make();
            P.rewardPanel(G, 'Treasure!', '🎁', [`🪙 +${r.gold}`, r.sold ? `(Bag full — auto-sold ${r.sold.name})` : ''], r.item, () => P.wingPanel(G, wi));
            changed();
        } else if (node.kind === 'shrine') P.shrinePanel(G, wi, id);
        else if (node.kind === 'event') P.eventPanel(G, wi, id);
    },
    bless(wi, id, b) {
        if (!takeBlessing(G.profile, wi, id, b)) return;
        sfx.heal();
        toast(`${BLESSINGS[b].icon} ${BLESSINGS[b].name}!`);
        changed();
        P.wingPanel(G, wi);
    },
    choose(wi, id, i) {
        const r = resolveEvent(G.profile, wi, id, i);
        if (!r) return;
        if (r.fail) { toast(r.fail); sfx.deny(); return; }
        const lines = [];
        if (r.paid) lines.push(`🪙 −${r.paid}`);
        if (r.gold) lines.push(`🪙 +${r.gold}`);
        if (r.xp) lines.push(`⭐ +${r.xp} XP`);
        for (const k of ['wood', 'stone', 'herbs', 'crystal', 'ink']) if (r[k]) lines.push(`${RES_INFO[k].icon} +${r[k]}`);
        if (r.blessing) lines.push(`${BLESSINGS[r.blessing].icon} ${BLESSINGS[r.blessing].name}`);
        if (r.potion) lines.push(`${POTIONS[r.potion].icon} ${POTIONS[r.potion].name}`);
        sfx.quest();
        celebrateUps(r.ups);
        changed();
        P.rewardPanel(G, 'What luck!', '✨', lines, r.item, () => P.wingPanel(G, wi));
    },
    patrol(wi) { autoLoadout(); P.preBattlePanel(G, { type: 'patrol', wing: wi }); },
    endless() { autoLoadout(); P.preBattlePanel(G, { type: 'endless' }); },
    fight(ctx) { P.closePanel(true); beginBattle(ctx); },

    toggleSetting(k) {
        settings[k] = !settings[k];
        saveSettings(settings);
        setSoundOn(settings.sound); setMusicOn(settings.music);
        $('mute-btn').classList.toggle('off', !settings.sound);
        P.refreshPanel();
    },
    cycleQuality() { const q = (getQuality() + 1) % 3; setQuality(q); settings.quality = q; saveSettings(settings); P.refreshPanel(); },
    toTitle() { persist(); toTitle(); },
    deleteSave() { clearProfile(); G.profile = null; location.reload(); },
    retreat() {
        if (G.mode !== 'battle' || !G.run) return;
        G.queue.length = 0;
        G.run.bt.over = 'lose';
        endBattle();
    },
});

function autoLoadout() {
    const p = G.profile;
    const total = Object.values(p.loadout).reduce((a, b) => a + b, 0);
    if (total > 0) return;
    let left = carryLimit(p);
    for (const id of ['heal', 'skull', 'bomb', 'mana', 'prism', 'swift']) {
        const n = Math.min(left, id === 'heal' ? 2 : 1, p.potions[id]);
        if (n > 0) { p.loadout[id] = n; left -= n; }
    }
}

function cancelPlacing() {
    G.placing = null;
    townView.setBuildMode(false);
    updateTownHint();
}

function popCollect(id, r, i = 0) {
    const a = townView.buildingAnchor(id);
    if (a) {
        const s = townToScreen(a);
        const icon = r.res === 'xp' ? '⭐' : RES_INFO[r.res].icon;
        floatText(s.x, s.y, `${icon} +${fmt(r.n)}`, r.res === 'xp' ? '#d8a8ff' : RES_INFO[r.res].color, 'small');
        townFx.burst(a, r.res === 'xp' ? 0xc08aff : new THREE.Color(RES_INFO[r.res].color).getHex(), 14, { speed: 5, size: 0.5, up: 3, star: true });
    }
    sfx.collect(i);
    celebrateUps(r.ups);
}

function celebrateUps(ups) {
    if (!ups || !ups.length) return;
    const u = ups[ups.length - 1];
    sfx.levelUp();
    banner(`LEVEL ${u.level}!`, true);
    for (const x of ups) {
        if (x.spells.length) toast(`New spell: ${x.spells.map((id) => SPELLS[id].icon + ' ' + SPELLS[id].name).join(', ')}`, 3500);
        if (x.buildings.length) toast(`New building: ${x.buildings.map((id) => BUILDINGS[id].icon + ' ' + BUILDINGS[id].name).join(', ')}`, 3500);
    }
    if (G.mode === 'town') drainStory();
}

// ------------------------------------------------------------------ Battle

async function beginBattle(ctx) {
    const p = G.profile;
    const pre = preFightScene(p, ctx);
    const run = startBattle(p, ctx);
    G.run = run;
    G.mode = 'battle';
    G.queue.length = 0; G.wait = 0; G.pendingEnd = null; G.hintT = 0; G.aiT = 0;
    G.returnTo = ctx;
    setActive('battle');
    show('town-ui', false); show('battle-ui', true); show('menu-btn', true);
    $('bubbles').innerHTML = '';
    backdrop.setWing(ctx.wing ?? (ctx.type === 'endless' ? 5 : Math.min(5, p.wingOpen)));
    if (G.monster) { BS.scene.remove(G.monster.root); G.monster.dispose(); }
    G.monster = new MonsterView(run.mon.look);
    BS.scene.add(G.monster.root);
    G.monster.intro();
    battleFx.clear();
    boardView.reset(run.bt.board);
    boardView.hint(null);
    G.disp = dispFrom(run.bt);
    buildBattleHud(G, run);
    layoutBattle();
    updateBattleHud(G, run, G.disp);
    startMusic(run.mon.boss ? 'boss' : 'battle');
    G.pendingEnd = 'intro';
    if (pre && !p.story.seen[pre]) {
        p.story.seen[pre] = true;
        await playScene(sceneFor(pre), storyCtx(run.mon.name));
    }
    if (!p.flags.tutorial) {
        p.flags.tutorial = true;
        await playScene(sceneFor('tutorial'), storyCtx());
    }
    G.pendingEnd = null;
    banner(run.mon.boss ? 'BOSS FIGHT!' : 'FIGHT!', run.mon.boss);
    sfx.turn();
}

function dispFrom(bt) {
    const d = {};
    for (const k of ['p', 'e']) { const s = bt.sides[k]; d[k] = { hp: s.hp, shield: s.shield, mana: { ...s.mana } }; }
    return d;
}

function layoutBattle() {
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W * 1.05;
    document.body.classList.toggle('portrait', portrait);
    let board;
    if (portrait) {
        const foeH = Math.round(Math.max(104, Math.min(170, H * 0.17)));
        document.body.style.setProperty('--foeh', foeH + 'px');
        board = Math.min(W - 16, H - foeH - 52 - 160);
    } else {
        const short = H <= 520;
        board = Math.min(H - (short ? 16 : 70), W - 2 * (short ? 180 : 220) - 60);
    }
    board = Math.max(220, Math.floor(board));
    document.body.style.setProperty('--board', board + 'px');
    // measure after the CSS variable applies
    requestAnimationFrame(() => {
        if (!G.run) return;
        const br = $('board-area').getBoundingClientRect();
        boardView.layout(rectToPlane(br));
        const fr = $('foe-area').getBoundingClientRect();
        const rr = rectToPlane(fr);
        const sc = Math.max(0.3, Math.min(rr.h * 0.82 / 2.7, rr.w * 0.8 / 2.4));
        G.monster.root.position.set(rr.cx, rr.cy - rr.h / 2 + rr.h * 0.12, -1.5);
        G.monster.root.rotation.y = Math.atan2(-rr.cx, 31.5);   // face the camera from off-centre
        G.monster.baseScale = sc * (G.run.mon.look.scale > 1.3 ? 1.08 : 1);
        backdrop.placePedestal(rr.cx, rr.cy - rr.h / 2 + rr.h * 0.12, sc * 0.95);
    });
}

function monsterScreen(dy = 1.4) {
    const r = G.monster.root;
    return planeToScreen(r.position.x, r.position.y + dy * G.monster.baseScale, r.position.z);
}

function sideAnchor(key) {
    if (key === 'e') return monsterScreen();
    const c = centerOf($('p-card'));
    return { x: c.x, y: c.y - 30 };
}

function enqueue(ev) {
    G.synced = false;
    for (const e of ev) G.queue.push(e);
    G.hintT = 0;
    boardView.hint(null);
}

function trySwap(a, b) {
    const bt = G.run?.bt;
    if (!bt || bt.over || bt.turn !== 'p' || !G.idle() || dialogOpen()) return;
    if (!adjacent(a, b)) return;
    if (!isValidSwap(bt.board, a, b)) { boardView.bounce(a, b); sfx.invalid(); return; }
    boardView.select(null);
    G.side = 'p';
    enqueue(doSwap(bt, a, b));
}

G.cast = (i) => {
    const bt = G.run?.bt;
    if (!bt || bt.turn !== 'p' || !G.idle() || dialogOpen()) return;
    if (!canCast(bt, 'p', i)) { sfx.deny(); const sp = bt.sides.p.spells[i]; if (sp) toast(`Not enough mana for ${SPELLS[sp.id].name}.`); return; }
    G.side = 'p';
    enqueue(doCast(bt, i));
};
G.potion = (id) => {
    const bt = G.run?.bt;
    if (!bt || bt.turn !== 'p' || !G.idle() || dialogOpen()) return;
    const ev = doPotion(bt, id);
    if (!ev.length) return;
    G.side = 'p';
    enqueue(ev);
    buildPotions(G, G.run);
};

const SPELL_EL = (id) => { const d = SPELLS[id]; if (!d) return null; const o = d.ops.find((x) => x.el); if (o) return o.el; return Object.keys(d.cost)[0]; };
const EL_COLOR = { fire: 0xff5a2a, water: 0x3fa8ff, leaf: 0x46e07a, spark: 0xffe04a };

function handle(e) {
    const bt = G.run.bt, d = G.disp;
    switch (e.k) {
        case 'swap': sfx.swap(); if (G.side === 'e') G.monster.attack(); return boardView.play(e);
        case 'clear': {
            G.lastClear = e;
            const t = boardView.play(e);
            sfx.match(e.step, e.cells.length);
            if (e.blasts.some((b) => b.kind === 'bomb')) { sfx.bomb(); shake(0.35); }
            if (e.blasts.some((b) => b.kind === 'lineH' || b.kind === 'lineV')) { sfx.line(); shake(0.15); }
            if (e.prism || e.blasts.some((b) => b.kind === 'prism')) { sfx.prism(); flash(0.25, 0xffaaff); }
            if (e.step >= 3) floatText(...Object.values(planeToScreen(boardView.group.position.x, boardView.group.position.y + 1)), `${e.step}× CHAIN!`, '#ffe46a', e.step >= 5 ? 'big' : '');
            return t;
        }
        case 'make': sfx.make(); return boardView.play(e);
        case 'fall': case 'morph': return boardView.play(e);
        case 'shuffle': toast('No moves left — shuffling!'); return boardView.play(e);
        case 'gain': {
            const key = e.side;
            const cells = G.lastClear?.cells || [];
            for (const c of MANA) {
                const n = e.mana[c];
                if (!n) continue;
                const src = cells.find((x) => x.t === MANA.indexOf(c)) || { x: 3.5, y: 3.5 };
                const bar = manaBarEl(key, c);
                const target = bar ? screenToPlane(...Object.values(centerOf(bar))) : { x: 0, y: 0 };
                const amount = n;
                battleFx.orbs(boardView.cellWorld(src.x, src.y), new THREE.Vector3(target.x, target.y, 2), EL_COLOR[c], Math.min(5, 1 + Math.floor(n / 2)), {
                    onArrive: () => { d[key].mana[c] = Math.min(bt.sides[key].manaCap, d[key].mana[c] + amount); bar?.classList.remove('pulse'); void bar?.offsetWidth; bar?.classList.add('pulse'); },
                });
                if (key === 'p') sfx.mana(c);
            }
            if (e.gold > 0) { const t = screenToPlane(...Object.values(centerOf($('loot-gold')))); battleFx.orbs(boardView.cellWorld(3.5, 3.5), new THREE.Vector3(t.x, t.y, 2), 0xffc23a, 4); sfx.coin(); }
            if (e.gold < 0) { const c = centerOf($('loot-gold')); floatText(c.x, c.y + 30, `🪙 ${e.gold} stolen!`, '#ff8a9a', 'small'); }
            if (e.xp > 0) { const t = screenToPlane(...Object.values(centerOf($('loot-xp')))); battleFx.orbs(boardView.cellWorld(3.5, 3.5), new THREE.Vector3(t.x, t.y, 2), 0xc08aff, 3); sfx.star(); }
            return 0.05;
        }
        case 'dmg': {
            const key = e.side;
            d[key].hp = e.hp; d[key].shield = e.shield;
            const a = sideAnchor(key);
            const total = e.n + e.absorbed;
            const txt = (e.crit ? 'CRIT! ' : '') + (e.n ? `-${e.n}` : '') + (e.absorbed ? ` 🛡${e.absorbed}` : '') + (e.weak ? ' 💥' : '');
            floatText(a.x + (Math.random() - 0.5) * 40, a.y, txt || '0', key === 'e' ? '#ffe46a' : '#ff6a7a', e.crit || total > bt.sides[key].maxHp * 0.15 ? 'big' : '');
            const frac = total / bt.sides[key].maxHp;
            if (key === 'e') {
                G.monster.hurt();
                if (e.kind === 'skull') {
                    const from = boardView.cellWorld(3.5, 3.5);
                    const r = G.monster.root.position;
                    battleFx.orbs(from, new THREE.Vector3(r.x, r.y + G.monster.baseScale, r.z + 1), 0xffffff, 4, { time: 0.3 });
                    sfx.skull(total);
                } else sfx.skull(total * 0.5);
                battleFx.burst(new THREE.Vector3(G.monster.root.position.x, G.monster.root.position.y + G.monster.baseScale * 1.2, 1), e.crit ? 0xffe46a : 0xffffff, 16, { speed: 6, size: 0.5 });
                if (e.crit) sfx.crit();
                kick(Math.min(1, frac * 4));
            } else {
                cardHit('p');
                sfx.hurt();
                flash(Math.min(0.5, frac * 2), 0xff2244);
            }
            shake(Math.min(0.8, frac * 2.5 + (e.crit ? 0.2 : 0)));
            updateBattleHud(G, G.run, d);
            return e.kind === 'burn' ? 0.35 : 0.28;
        }
        case 'heal': { d[e.side].hp = e.hp; const a = sideAnchor(e.side); floatText(a.x, a.y, `+${e.n}`, '#7dffa4'); sfx.heal(); return 0.25; }
        case 'shield': { d[e.side].shield = e.total; const a = sideAnchor(e.side); floatText(a.x, a.y, `🛡 +${e.n}`, '#7fd8ff'); sfx.shield(); return 0.25; }
        case 'cast': {
            const el = SPELL_EL(e.spell) || (e.side === 'e' ? G.run.mon.side.color : 'spark');
            const a = sideAnchor(e.side);
            floatText(a.x, a.y - 30, `${e.icon} ${e.name}!`, '#fff', 'big');
            sfx.cast(el);
            if (e.side === 'e') G.monster.cast(EL_COLOR[el] || 0xffffff);
            else {
                const c = centerOf($('p-card'));
                const from = screenToPlane(c.x, c.y);
                const r = G.monster.root.position;
                battleFx.orbs(new THREE.Vector3(from.x, from.y, 2), new THREE.Vector3(r.x, r.y + G.monster.baseScale, r.z + 1), EL_COLOR[el] || 0xffffff, 10, { time: 0.45, size: 0.8 });
            }
            flash(0.18, EL_COLOR[el] || 0xffffff);
            // the mana was spent: take the cost off the display now
            const def = SPELLS[e.spell] || MSPELLS[e.spell];
            if (def) for (const [c, n] of Object.entries(def.cost)) d[e.side].mana[c] = Math.max(0, d[e.side].mana[c] - n);
            return 0.55;
        }
        case 'potion': { const a = sideAnchor('p'); floatText(a.x, a.y - 20, `${e.icon} ${e.name}`, '#fff'); sfx.potion(); return 0.35; }
        case 'burn': { const a = sideAnchor(e.side); floatText(a.x, a.y, `🔥 Burning!`, '#ff9a5a', 'small'); return 0.2; }
        case 'stun': { const a = sideAnchor(e.side); floatText(a.x, a.y, e.skipped ? '💫 Stunned — turn skipped' : '💫 Stunned!', '#ffe46a', 'small'); sfx.stun(); return e.skipped ? 0.6 : 0.25; }
        case 'resist': { const a = sideAnchor(e.side); floatText(a.x, a.y, 'Shrugs off the stun!', '#fff', 'small'); return 0.2; }
        case 'buff': { const a = sideAnchor(e.side); floatText(a.x, a.y, e.key === 'haste' ? '🥤 Swift!' : e.key === 'skullMult' ? `💀×${e.n}!` : `💀+${e.n}!`, '#7dffa4', 'small'); sfx.extra(); return 0.25; }
        case 'drain': { const a = sideAnchor(e.side); floatText(a.x, a.y + 20, '🌀 Mana drained!', '#b48cff', 'small'); d[e.side].mana = { ...bt.sides[e.side].mana }; return 0.25; }
        case 'haste': banner('LUCKY TURN!'); sfx.extra(); return 0.4;
        case 'extra': banner(e.side === 'p' ? 'EXTRA TURN!' : 'FOE GOES AGAIN!', e.side === 'p'); sfx.extra(); return 0.5;
        case 'quick': return 0;
        case 'turn': {
            G.side = e.side;
            if (e.side === 'p') sfx.turn(); else sfx.enemyTurn();
            updateBattleHud(G, G.run, d);
            return 0.12;
        }
        case 'over': return 0;
        default: return 0;
    }
}

function directorStep(dt) {
    if (!G.run) return;
    const bt = G.run.bt;
    if (G.wait > 0) { G.wait -= dt; return; }
    let guard = 0;
    while (G.queue.length && G.wait <= 0 && guard++ < 40) {
        const e = G.queue.shift();
        G.wait += handle(e);
    }
    if (G.queue.length || G.wait > 0 || boardView.busy()) return;
    if (G.pendingEnd) return;
    // drained: snap the view to the truth
    if (!G.synced) {
        G.synced = true;
        boardView.sync(bt.board);
        G.disp = dispFrom(bt);
        updateBattleHud(G, G.run, G.disp);
    }
    if (bt.over) { G.pendingEnd = 'over'; setTimeout(endBattle, 450); return; }
    if (bt.turn === 'e' && !dialogOpen()) {
        G.aiT += dt;
        if (G.aiT > 0.55) { G.aiT = 0; G.side = 'e'; G.synced = false; enqueue(monsterTurn(bt)); }
        return;
    }
    G.aiT = 0;
    G.hintT += dt;
    if (G.hintT > 8 && !boardView.hintCells) boardView.hint(bestMove(bt, 'p'));
}

async function endBattle() {
    const run = G.run;
    if (!run || G.pendingEnd === 'done') return;
    G.pendingEnd = 'done';
    const win = run.bt.over === 'win';
    if (win) { G.monster.die(); sfx.victory(); banner('VICTORY!', true); battleFx.burst(new THREE.Vector3(G.monster.root.position.x, G.monster.root.position.y + 1, 1), 0xffe46a, 60, { speed: 10, size: 0.7, life: 1.2, star: true, hueJitter: 0.5 }); }
    else { sfx.defeat(); banner('DEFEAT'); }
    await new Promise((r) => setTimeout(r, 1300));
    const out = finishBattle(G.profile, run);
    saveProfile(G.profile);
    if (out.book) { sfx.book(); flash(0.6, 0xffffff); }
    P.resultPanel(G, run, out, async () => {
        const ctx = run.ctx;
        enterTown();
        if (out.book) {
            townView.sync(G.profile);
            banner('A BOOK RETURNS!', true);
        }
        await drainStory();
        renderTown(G.profile);
        if (G.profile.won && out.book === 'first') { P.adventurePanel(G); return; }
        if (ctx.type === 'node' || ctx.type === 'patrol') {
            const wi = G.profile.wingOpen > ctx.wing && ctx.type === 'node' && wingMap(G.profile, ctx.wing).nodes[ctx.node]?.kind === 'guardian' ? G.profile.wingOpen : ctx.wing;
            if (wi !== ctx.wing) { toast(`A new wing is open: ${WINGS[wi].icon} ${WINGS[wi].name}!`, 3500); P.adventurePanel(G); }
            else P.wingPanel(G, wi);
        } else if (ctx.type === 'bounty') P.questsPanel(G);
        else if (ctx.type === 'endless') P.adventurePanel(G);
    });
    if (out.ups.length) { sfx.levelUp(); }
}

// ------------------------------------------------------------------ Input

const ptr = { down: false, x: 0, y: 0, cell: null, moved: false, pinch: null, id: null, touches: new Map() };

function initInput() {
    const cv = document.getElementById('game-canvas');
    const area = $('board-area');
    // Board input lives on #board-area (sits over the board in the HUD layer).
    area.addEventListener('pointerdown', (e) => {
        if (G.mode !== 'battle') return;
        area.setPointerCapture?.(e.pointerId);
        const pt = screenToPlane(e.clientX, e.clientY);
        const c = boardView.pick(pt.x, pt.y);
        ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.cell = c; ptr.moved = false;
    });
    area.addEventListener('pointermove', (e) => {
        if (!ptr.down || !ptr.cell || G.mode !== 'battle') return;
        const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
        const cellPx = ($('board-area').getBoundingClientRect().width / 8.7);
        if (Math.hypot(dx, dy) > cellPx * 0.35) {
            const b = Math.abs(dx) > Math.abs(dy) ? { x: ptr.cell.x + Math.sign(dx), y: ptr.cell.y } : { x: ptr.cell.x, y: ptr.cell.y + Math.sign(dy) };
            ptr.moved = true;
            const a = ptr.cell;
            ptr.cell = null;
            if (b.x >= 0 && b.y >= 0 && b.x < 8 && b.y < 8) trySwap(a, b);
        }
    });
    const up = () => {
        if (!ptr.down) return;
        ptr.down = false;
        if (ptr.moved || !ptr.cell || G.mode !== 'battle') return;
        const c = { x: ptr.cell.x, y: ptr.cell.y };
        const sel = boardView.selected;
        if (sel && adjacent(sel, c)) { trySwap(sel, c); return; }
        if (sel && sel.x === c.x && sel.y === c.y) { boardView.select(null); return; }
        boardView.select(c);
        sfx.select();
    };
    area.addEventListener('pointerup', up);
    area.addEventListener('pointercancel', () => { ptr.down = false; });

    // Town: drag to orbit, tap to pick, wheel / pinch to zoom.
    cv.addEventListener('pointerdown', (e) => {
        if (G.mode !== 'town' && G.mode !== 'title') return;
        ptr.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = false; ptr.sx = e.clientX; ptr.sy = e.clientY;
        if (ptr.touches.size === 2) { const [a, b] = [...ptr.touches.values()]; ptr.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', (e) => {
        if (G.mode !== 'town' && G.mode !== 'title') return;
        if (ptr.touches.has(e.pointerId)) ptr.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptr.touches.size === 2 && ptr.pinch) {
            const [a, b] = [...ptr.touches.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            townView.zoomBy(ptr.pinch / d);
            ptr.pinch = d; ptr.moved = true;
            return;
        }
        if (!ptr.down) return;
        const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
        if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 8) ptr.moved = true;
        if (ptr.moved && G.mode === 'town') townView.orbitBy(dx, dy);
        ptr.x = e.clientX; ptr.y = e.clientY;
    });
    const tup = (e) => {
        ptr.touches.delete(e.pointerId);
        if (ptr.touches.size < 2) ptr.pinch = null;
        if (!ptr.down) return;
        ptr.down = false;
        if (ptr.moved || G.mode !== 'town' || P.panelOpen() || dialogOpen()) return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1, ny = -(e.clientY / window.innerHeight) * 2 + 1;
        const hit = townView.pick(nx, ny);
        if (!hit) return;
        onTownPick(hit);
    };
    cv.addEventListener('pointerup', tup);
    cv.addEventListener('pointercancel', (e) => { ptr.touches.delete(e.pointerId); ptr.down = false; });
    cv.addEventListener('wheel', (e) => { if (G.mode === 'town') { townView.zoomBy(e.deltaY > 0 ? 1.08 : 0.92); e.preventDefault(); } }, { passive: false });
}

function onTownPick(hit) {
    const p = G.profile;
    if (hit.library) { sfx.open(); P.libraryPanel(G); return; }
    if (hit.plot === undefined) return;
    const id = Object.keys(p.town).find((k) => p.town[k].plot === hit.plot);
    if (G.placing) {
        if (id) { toast('That plot is taken — pick a glowing one.'); sfx.deny(); return; }
        G.placeAt(hit.plot);
        return;
    }
    if (id) {
        if (BUILDINGS[id].res && p.town[id].basket >= 1) { G.collect(id); return; }
        G.openBuilding(id);
    } else { sfx.open(); P.buildPanel(G); }
}

function onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key;
    if (dialogOpen()) { if (k === ' ' || k === 'Enter') { advanceDialog(); e.preventDefault(); } if (k === 'Escape') skipDialog(); return; }
    if (k === 'Escape') { if (P.panelOpen()) { if (P.panelName() !== 'result' && P.panelName() !== 'create') P.closePanel(); } else if (G.placing) cancelPlacing(); else if (G.mode === 'town' || G.mode === 'battle') P.menuPanel(G); return; }
    if (P.panelOpen()) return;
    if (G.mode === 'battle') {
        if (k >= '1' && k <= '5') G.cast(+k - 1);
        const pots = Object.keys(G.run?.bt.potions || {}).filter((id) => G.run.bt.potions[id] > 0);
        const pi = { q: 0, w: 1, e: 2, r: 3 }[k.toLowerCase()];
        if (pi !== undefined && pots[pi]) G.potion(pots[pi]);
        if (k.toLowerCase() === 'h' && G.run) boardView.hint(bestMove(G.run.bt, 'p'));
    } else if (G.mode === 'town') {
        const map = { a: 'nav-adventure', b: 'nav-build', c: 'nav-hero', l: 'nav-library', q: 'nav-quests', e: 'nav-collect' };
        const id = map[k.toLowerCase()];
        if (id) $(id).click();
    }
}

// ------------------------------------------------------------------ Town bubbles

const bubbleEls = {};
function updateBubbles() {
    const p = G.profile;
    const box = $('bubbles');
    if (G.mode !== 'town' || !p || P.panelOpen()) { if (box.childElementCount) { box.innerHTML = ''; for (const k in bubbleEls) delete bubbleEls[k]; } return; }
    for (const [id, b] of Object.entries(p.town)) {
        const def = BUILDINGS[id];
        if (!def.res) continue;
        let el = bubbleEls[id];
        const n = Math.floor(b.basket);
        if (n < 1) { if (el) { el.remove(); delete bubbleEls[id]; } continue; }
        if (!el) {
            el = h('button.bubble', { onclick: (e) => { e.stopPropagation(); G.collect(id); }, title: `Collect from ${def.name}` }, h('span.bi', def.res === 'xp' ? '⭐' : RES_INFO[def.res].icon), h('span.bn', ''));
            box.append(el);
            bubbleEls[id] = el;
        }
        const a = townView.buildingAnchor(id);
        if (!a) continue;
        const s = townToScreen(a);
        el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
        el.style.display = s.ok ? '' : 'none';
        el.querySelector('.bn').textContent = fmt(n);
        el.classList.toggle('full', b.basket >= capacityOf(id) - 1);
    }
    for (const id of Object.keys(bubbleEls)) if (!p.town[id]) { bubbleEls[id].remove(); delete bubbleEls[id]; }
}
const capacityOf = (id) => capOf(G.profile, id);

// ------------------------------------------------------------------ Frame

let fpsT = 0, fpsN = 0, slow = 0;
function frame() {
    requestAnimationFrame(frame);
    // Debug runs (software GL in tests, a few fps) may take bigger steps so animations keep pace.
    const dt = Math.min(clock.getDelta(), DEBUG ? 0.2 : 0.05);
    try {
        if (G.mode === 'battle' && G.run) {
            if (G.queue.length) G.synced = false;
            directorStep(dt);
            boardView.update(dt);
            G.monster?.update(dt);
            backdrop.update(dt);
            battleFx.update(dt);
            updateBattleHud(G, G.run, G.disp);
        } else {
            townView.update(dt, { attract: G.mode === 'title' });
            townFx.update(dt);
            if (G.mode === 'town' && G.profile) {
                G.tickT += dt;
                if (G.tickT > 1) { G.tickT = 0; tick(G.profile, Date.now()); renderTown(G.profile); }
                updateBubbles();
            }
        }
        if (G.profile && G.mode !== 'title') {
            G.saveT += dt;
            if (G.saveT > 20 && G.mode === 'town') { G.saveT = 0; persist(); }
            G.profile.playMs = (G.profile.playMs || 0) + dt * 1000;
        }
        render(dt);
    } catch (err) {
        console.error('Tomebound frame error:', err && err.stack || err);
    }
    // auto quality
    fpsT += dt; fpsN++;
    if (fpsT >= 2) {
        const fps = fpsN / fpsT;
        fpsT = 0; fpsN = 0;
        if (!DEBUG && fps < 32 && getQuality() < 2 && settings.quality === null) { if (++slow >= 3) { setQuality(getQuality() + 1); slow = 0; } } else slow = 0;
    }
}

// ------------------------------------------------------------------ Debug hooks

if (DEBUG) {
    window.__tb = {
        G, boardView, townView,
        brightness,
        state: () => ({ mode: G.mode, panel: P.panelName(), dialog: dialogOpen(), turn: G.run?.bt.turn, over: G.run?.bt.over, idle: G.mode === 'battle' ? G.idle() : null, queue: G.queue.length }),
        newGame: (cls = 'mage', name = 'Tester') => G.newGame(cls, name),
        skipStory: () => { while (dialogOpen()) skipDialog(); },
        give: (res) => { Object.entries(res).forEach(([k, v]) => { G.profile.res[k] = (G.profile.res[k] || 0) + v; }); changed(); },
        xp: (n) => { celebrateUps(gainXp(G.profile, n)); changed(); },
        books: (n) => { const ids = Object.keys(BOOK_BY_ID).slice(0, n); for (const id of ids) G.profile.books[id] = 1; G.profile.wingOpen = Math.min(6, Math.floor(n / 2)); townView.sync(G.profile); changed(); },
        fight: (ctx) => G.fight(ctx),
        botMove: () => { const bt = G.run?.bt; if (!bt || bt.turn !== 'p' || !G.idle()) return false; const a = botBattleAction(bt); if (a.potion) G.potion(a.potion); else if (a.cast !== undefined) G.cast(a.cast); else trySwap(a.move.a, a.move.b); return true; },
        win: () => { const bt = G.run.bt; bt.sides.e.hp = 1; bt.sides.e.shield = 0; },
        lose: () => { const bt = G.run.bt; bt.sides.p.hp = 1; bt.sides.p.shield = 0; },
        god: () => { G.run.bt.sides.p.maxHp = 99999; G.run.bt.sides.p.hp = 99999; },
        swapAt: (a, b) => trySwap(a, b),
        cellCenter: (x, y) => planeToScreen(boardView.cellWorld(x, y).x, boardView.cellWorld(x, y).y),
        layout: () => layoutBattle(),
        quality: (q) => setQuality(q),
        resize: () => onResize(),
        plotScreen: (i) => townToScreen(townView.plotAnchor(i)),
        best: () => { const m = bestMove(G.run.bt, 'p'); return { a: m.a, b: m.b, pa: __tb.cellCenter(m.a.x, m.a.y), pb: __tb.cellCenter(m.b.x, m.b.y) }; },
        mana: (n = 30) => { const s = G.run.bt.sides.p; for (const c of MANA) s.mana[c] = Math.min(s.manaCap, n); G.disp = dispFrom(G.run.bt); },
        clearTo: (wi, kind) => { const map = wingMap(G.profile, wi); G.profile.wingOpen = Math.max(G.profile.wingOpen, wi); for (const n of map.nodes) { if (n.kind === kind) return n.id; G.profile.wings[wi].cleared[n.id] = true; } return null; },
        basket: (id, n) => { G.profile.town[id].basket = n; G.profile.town[id].t = Date.now(); },
        age: (ms) => { G.profile.t -= ms; for (const b of Object.values(G.profile.town)) b.t -= ms; saveProfile(G.profile); },
        save: () => saveProfile(G.profile),
        snap: () => { townView.yaw = townView.wantYaw; townView.dist = townView.wantDist; },
        SLOTS, questDone, carried, queueStory,
    };
}

boot();
