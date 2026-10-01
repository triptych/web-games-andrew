/**
 * main.js — boot, the screen state machine, the campaign flow, saving, the
 * render loop for every non-battle screen, input, and debug hooks.
 *
 * Flow: title → callsign → prologue → carrier hub ⇄ sector map → node
 * (fight / signal / salvage / depot / repair bay) → map … → boss → story → hub.
 */

import * as P from './sim/profile.js';
import { deriveLoadout } from './sim/loadout.js';
import { SCENES, CHAPTER_INFO } from './sim/story.js';
import { nodeById } from './sim/sector.js';
import { EVENTS, pickEvent, choiceOk, choiceCost, resolveChoice } from './sim/events.js';
import { BOOSTERS } from './sim/boosters.js';
import { SYM_IDS } from './sim/symbols.js';
import { fmt } from './sim/format.js';
import { stage, initStage, setQuality } from './view/canvas.js';
import * as F from './view/fx.js';
import { drawBackdrop } from './view/backdrop.js';
import { drawPlayerMech, symbolTile, iconURL, clearTileCache } from './view/art.js';
import { battle, startBattle, endBattleUi, battleFrame, battleResize, clickStage, hoverStage, mainButton, reelAction, selectReel, cycleTarget, toggleAuto, cycleSpeed, setSpeed, act, debugEnd } from './battle.js';
import { initAudio, setMusic, setVolumes, sound } from './audio.js';
import { $, el, show, hide, toast } from './ui/dom.js';
import { playScene, storyNext, storySkip, storyActive, storyScene, drawStoryPortrait, openPanel, closePanel, panelOpen, btn, showRewards, showChoices, showSettings, howToBody, modCard } from './ui/screens.js';
import { initHub, renderHub, tickHub } from './ui/hub.js';
import { renderMap } from './ui/map.js';

const SAVE_KEY = 'spinframe-save-v1';
const SET_KEY = 'spinframe-settings';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const G = {
    p: null, screen: 'title', t: 0, bgChapter: 1,
    settings: { music: 0.55, sfx: 0.8, quality: 'auto', speed: 1, calm: false },
    rain: [], titleCh: 1, slowFrames: 0, fpsAcc: 0, fpsN: 0, autoTier: null,
};

// ------------------------------------------------------------------ persistence

function save() {
    if (!G.p) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.p)); } catch { /* storage full or blocked */ }
}
function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || p.v !== P.SAVE_VERSION) return null;
        return p;
    } catch { return null; }
}
function loadSettings() {
    try { Object.assign(G.settings, JSON.parse(localStorage.getItem(SET_KEY) ?? '{}')); } catch { /* ignore */ }
}
function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(G.settings)); } catch { /* ignore */ }
}

function applySettings() {
    setVolumes({ music: G.settings.music, sfx: G.settings.sfx });
    const q = G.settings.quality === 'auto' ? (G.autoTier ?? (matchMedia('(pointer: coarse)').matches ? 1 : 2)) : G.settings.quality;
    if (q !== stage.quality) { setQuality(q); clearTileCache(); battleResize(); }
    F.setFxQuality(q);
    F.setCalm(G.settings.calm);
    setSpeed(G.settings.speed);
    saveSettings();
}

// ------------------------------------------------------------------ screens

const SCREENS = ['#scr-title', '#scr-callsign', '#scr-story', '#scr-hub', '#scr-map', '#scr-panel'];

function screen(name) {
    for (const s of SCREENS) hide(s);
    if (name !== 'battle') endBattleUi();
    G.screen = name;
    document.body.classList.toggle('in-game', name !== 'title' && name !== 'callsign');
    if (name !== 'battle') F.resetFx();
    if (name === 'title') show('#scr-title');
    if (name === 'callsign') show('#scr-callsign');
    if (name === 'hub') show('#scr-hub');
    if (name === 'map') show('#scr-map');
}

function fade(fn) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => { fn(); f.classList.remove('on'); }, 220);
}

// ------------------------------------------------------------------ title

function toTitle() {
    screen('title');
    G.titleCh = 1;
    setMusic('title', 1);
    const s = loadSave();
    $('#t-continue').classList.toggle('hidden', !s);
    $('#t-new').classList.toggle('primary', !s);
    $('#t-meta').textContent = s ? `${s.callsign} · pilot level ${s.pilot.level} · ${Math.min(7, s.campaign.best)}/7 chapters${s.campaign.graduated ? ' · graduated' : ''}` : 'Mouse, touch or keyboard · every sound and picture made in code';
}

const CALLSIGNS = ['ACE', 'NOVA', 'RAZOR', 'JINX', 'LUCKY', 'VEGA', 'DICE', 'GHOST', 'KESTREL', 'HEX', 'ORBIT', 'BANSHEE', 'TALLY', 'ROOK', 'SPARROW', 'WILDCARD', 'ECHO', 'COMET', 'ZERO', 'FLINT'];

function toCallsign() {
    screen('callsign');
    const i = $('#cs-input');
    i.value = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
    setTimeout(() => i.focus(), 50);
}

function newGame(callsign, seed = (Math.random() * 2 ** 31) | 0) {
    const cs = (callsign || 'ACE').toUpperCase().replace(/[^A-Z0-9 \-]/g, '').trim().slice(0, 14) || 'ACE';
    G.p = P.newProfile(seed, cs);
    P.tickFacilities(G.p, Date.now() / 1000);
    save();
    playQueue(() => toHub('deploy'));
}

function continueGame() {
    G.p = loadSave();
    if (!G.p) { toTitle(); return; }
    const gained = P.tickFacilities(G.p, Date.now() / 1000);
    save();
    playQueue(() => {
        toHub('deploy');
        if (gained >= 1) toast(`The Refinery banked <b>${fmt(gained)}</b> scrap while you were away.`, 'gold');
    });
}

// ------------------------------------------------------------------ story

function playQueue(next) {
    const q = G.p.story.queue;
    if (!q.length) { next(); return; }
    const id = q[0];
    if (!SCENES[id]) { q.shift(); playQueue(next); return; }
    screen('story');
    G.bgChapter = SCENES[id].bg;
    setMusic('story', SCENES[id].bg);
    playScene(id, G.p.callsign, () => {
        q.shift();
        if (!G.p.story.seen.includes(id)) G.p.story.seen.push(id);
        save();
        playQueue(next);
    });
}

function queueScene(id) {
    if (G.p.story.seen.includes(id) || G.p.story.queue.includes(id)) return;
    G.p.story.queue.push(id);
}

// ------------------------------------------------------------------ hub

function toHub(tab = 'deploy') {
    screen('hub');
    G.bgChapter = Math.min(6, G.p.campaign.best);
    setMusic('hub', G.bgChapter);
    renderHub(tab);
    if (!G.p.tutorial.hub) {
        G.p.tutorial.hub = true;
        save();
        setTimeout(() => toast('Welcome aboard the <b>Meridian</b>. Spend scrap on your <b>Frame</b>, learn <b>Pilot</b> skills, and claim <b>Contracts</b>. Then <b>Deploy</b>.', 'good'), 400);
    }
}

function deployChapter(ch, threat) {
    if (G.p.sector) return;
    P.startSector(G.p, ch, threat);
    if (threat === 0) queueScene(`intro${ch}`);
    save();
    sound.open();
    fade(() => playQueue(toMap));
}

function resumeSortie() {
    const s = G.p.sector;
    if (!s) return;
    if (s.pending) { const n = nodeById(s, s.pending.id); if (n) { runNode(n); return; } }
    toMap();
}

// ------------------------------------------------------------------ map & nodes

function toMap() {
    if (!G.p.sector) { toHub('deploy'); return; }
    screen('map');
    G.bgChapter = G.p.sector.chapter;
    setMusic('map', G.bgChapter);
    renderMap(G.p, deriveLoadout(G.p).maxHp, pickNode);
}

function pickNode(id) {
    const n = P.enterNode(G.p, id);
    G.p.sector.pending = { id, type: n.type };
    save();
    runNode(n);
}

function finishNode() {
    if (G.p.sector) G.p.sector.pending = null;
    save();
    toMap();
}

function runNode(n) {
    switch (n.type) {
        case 'battle': case 'elite': case 'boss': nodeFight(n, n.type); break;
        case 'event': nodeEvent(n); break;
        case 'salvage': nodeSalvage(); break;
        case 'depot': nodeDepot(); break;
        case 'rest': nodeRest(); break;
        default: finishNode();
    }
}

const KIND_LABEL = { battle: 'Skirmish', elite: 'Elite', boss: 'Boss' };

function fight({ encounter, kind, title, hp, onWin, onLose }) {
    const L = deriveLoadout(G.p);
    screen('battle');
    G.bgChapter = encounter.chapter;
    startBattle({
        profile: G.p, L, encounter, seed: P.combatSeed(G.p), hp, kind, title,
        onEnd: (res) => { battle.paused = false; closePanel(); (res.won ? onWin : onLose)(res); },
    });
}

function nodeFight(n, kind, bonus = null) {
    const p = G.p;
    const s = p.sector;
    const enc = P.encounterFor(p, { ...n, type: kind });
    const go = () => fight({
        encounter: enc, kind, hp: s.hp,
        title: `${CHAPTER_INFO[s.chapter].name} · ${KIND_LABEL[kind]}${s.threat ? ` · T${s.threat}` : ''}`,
        onWin: (res) => {
            const out = P.applyVictory(p, res, { kind, x: enc.x });
            if (bonus === 'beacon') { p.cores++; out.cores++; }
            save();
            const title = kind === 'boss' ? 'Sector Cleared' : kind === 'elite' ? 'Elite Destroyed' : 'Victory';
            fade(() => {
                if (out.chapterCleared !== null) toHub('deploy'); else toMap();
                showRewards(out, { title, sub: out.chapterCleared !== null ? `Chapter ${out.chapterCleared} — ${CHAPTER_INFO[out.chapterCleared].name} — complete` : '' }, (choice) => {
                    P.takeChoice(p, choice);
                    if (out.chapterCleared !== null) { save(); playQueue(() => toHub('deploy')); }
                    else finishNode();
                });
            });
        },
        onLose: (res) => defeat(res),
    });
    if (kind === 'boss' && s.threat === 0 && !p.story.seen.includes(`boss${s.chapter}`)) { queueScene(`boss${s.chapter}`); playQueue(go); }
    else go();
}

function defeat(res) {
    P.applyDefeat(G.p, res);
    save();
    fade(() => {
        screen('hub');
        G.bgChapter = Math.min(6, G.p.campaign.best);
        openPanel({
            title: 'Frame Down',
            sub: 'Search and rescue pulled you out. The sortie is lost — but everything you banked is still yours.',
            body: el('p', { class: 'dim', html: 'Spend your scrap on the <b>Frame</b>, learn <b>Pilot</b> skills, equip <b>Modules</b> — then deploy again. Every sector is generated fresh.' }),
            foot: [btn('Return to the carrier', () => { closePanel(); toHub('frame'); }, 'menu-btn primary')],
        });
    });
}

function eventCtx() {
    const p = G.p;
    return { p, s: p.sector, rng: P.rngOf(p), x: p.sector.chapter + 5 * p.sector.threat, maxHp: deriveLoadout(p).maxHp };
}

function nodeEvent(n) {
    const p = G.p;
    const s = p.sector;
    screen('map');
    toMap();
    if (!s.pending.event) { s.pending.event = pickEvent(P.rngOf(p), s.chapter); save(); }
    // already chosen (e.g. reloaded on the result): show the result, never the choice again
    if (s.pending.result) { eventResult(n, s.pending.result); return; }
    const ev = EVENTS[s.pending.event];
    const c = eventCtx();
    const choices = el('div', { class: 'ev-choices' });
    for (const ch of ev.choices) {
        const cost = choiceCost(c, ch);
        choices.append(el('button', {
            disabled: !choiceOk(c, ch),
            onclick: () => { sound.click(); eventResult(n, resolveChoice(eventCtx(), ch)); },
        }, ch.label, cost ? el('span', { class: 'cost' }, `(${fmt(cost)} scrap)`) : null));
    }
    openPanel({
        title: ev.title, sub: `Signal · ${CHAPTER_INFO[s.chapter].place}`,
        body: el('div', {}, el('div', { class: 'ev-text' }, ev.text), choices),
        foot: [],
    });
}

function eventResult(n, r) {
    const p = G.p;
    p.sector.pending.result = { text: r.text, mini: r.mini ?? null, battle: r.battle ?? null, bonus: r.bonus ?? null };
    save();
    const body = el('div', {});
    const text = el('div', { class: 'ev-text' }, r.mini ? '' : r.text);
    if (r.mini) {
        const slot = el('div', { class: 'mini-slot' });
        const cells = [0, 1, 2].map(() => el('div', { class: 'spin' }, el('img', { src: iconURL(SYM_IDS[0], '#fff', 60), alt: '' })));
        slot.append(...cells);
        body.append(slot);
        const faces = ['blade', 'cannon', 'core', 'wild', 'scrap', 'glitch', 'missile'];
        let k = 0;
        const iv = setInterval(() => { cells.forEach((c, i) => { c.firstChild.src = symbolTile(faces[(k + i * 2) % faces.length], 60).toDataURL(); }); k++; sound.tick(k); }, 70);
        r.mini.forEach((sym, i) => setTimeout(() => {
            cells[i].classList.remove('spin');
            cells[i].firstChild.src = symbolTile(sym, 60).toDataURL();
            sound.reelStop(i);
            if (i === 2) { clearInterval(iv); text.textContent = r.text; if (r.text.includes('JACKPOT') || r.text.includes('Three of a kind')) sound.jackpot(); }
        }, 600 + i * 450));
        setTimeout(() => clearInterval(iv), 2200);
    }
    body.append(text);
    const foot = r.battle
        ? [btn('Fight!', () => { closePanel(); nodeFight(n, r.battle, r.bonus); }, 'menu-btn primary')]
        : [btn('Continue', () => { closePanel(); finishNode(); }, 'menu-btn primary')];
    openPanel({ title: EVENTS[p.sector.pending.event].title, body, foot });
    toMapHp();
}

function nodeSalvage() {
    const p = G.p;
    const s = p.sector;
    screen('map');
    toMap();
    if (!s.pending.choices) { s.pending.choices = P.rewardChoices(p, 0.35 + 0.05 * (s.chapter + 5 * s.threat), false); save(); }
    showChoices('Salvage', 'A wreck worth stripping. Take one.', s.pending.choices, (c) => { P.takeChoice(p, c); finishNode(); });
}

function nodeDepot() {
    const p = G.p;
    const s = p.sector;
    screen('map');
    toMap();
    if (!s.pending.stock) { s.pending.stock = P.depotStock(p); save(); }
    const stock = s.pending.stock;
    const render = () => {
        const body = el('div', {});
        body.append(el('div', { class: 'sec-h' }, 'Boosters', el('span', {}, `you have ${fmt(p.scrap)} scrap`)));
        const g = el('div', { class: 'shop-grid' });
        for (const it of stock.items) {
            const d = BOOSTERS[it.id];
            g.append(el('div', { class: 'row' },
                el('img', { class: 'ic', src: iconURL(d.icon, d.color, 60), alt: '' }),
                el('div', { class: 'grow' }, el('div', { class: 'nm' }, d.name, el('span', { class: 'lv' }, `owned ${p.boosters[it.id] ?? 0}`)), el('div', { class: 'ds' }, d.desc)),
                it.sold ? el('button', { class: 'buy', disabled: true }, 'SOLD') : btn(fmt(it.price), () => { if (P.buy(p, it)) { sound.coins(4); save(); render(); } else sound.deny(); }, 'buy', { disabled: p.scrap < it.price })));
        }
        body.append(g);
        body.append(el('div', { class: 'sec-h' }, 'Modules'));
        const mg = el('div', { class: 'mods' });
        for (const it of stock.mods) {
            mg.append(modCard(it.mod, { actions: [it.sold ? el('button', { class: 'buy', disabled: true }, 'SOLD') : btn(`Buy ${fmt(it.price)}`, () => { if (P.buy(p, it)) { sound.upgrade(); save(); render(); } else sound.deny(); }, 'buy', { disabled: p.scrap < it.price })] }));
        }
        body.append(mg);
        const L = deriveLoadout(p);
        body.append(el('div', { class: 'sec-h' }, 'Field repair'));
        body.append(el('div', { class: 'row' },
            el('img', { class: 'ic', src: iconURL('repair', '#46ff9a', 60), alt: '' }),
            el('div', { class: 'grow' }, el('div', { class: 'nm' }, 'Patch the hull (+30%)'), el('div', { class: 'ds' }, `Hull ${fmt(s.hp)} / ${fmt(L.maxHp)}`)),
            stock.repair.used ? el('button', { class: 'buy', disabled: true }, 'DONE') : btn(fmt(stock.repair.price), () => {
                if (p.scrap < stock.repair.price) return;
                p.scrap -= stock.repair.price; stock.repair.used = true; P.repairSector(p, 0.3); sound.repair(); save(); render(); toMapHp();
            }, 'buy green', { disabled: p.scrap < stock.repair.price || s.hp >= L.maxHp })));
        openPanel({ title: 'Depot', sub: 'A fleet supply depot. Prices scale with the sector.', body, wide: true, foot: [btn('Leave', () => { closePanel(); finishNode(); }, 'menu-btn primary')] });
    };
    render();
}

function nodeRest() {
    const p = G.p;
    const s = p.sector;
    screen('map');
    toMap();
    const L = deriveLoadout(p);
    const body = el('div', {});
    const amt = Math.min(L.maxHp - s.hp, Math.round(L.maxHp * 0.4));
    const grid = el('div', { class: 'choices' });
    grid.append(el('button', { class: 'choice', onclick: () => { P.repairSector(p, 0.4); sound.repair(); closePanel(); finishNode(); } },
        el('div', { class: 'h' }, el('img', { src: iconURL('repair', '#46ff9a', 60), alt: '' }), el('b', {}, 'Repair')),
        el('div', { class: 'desc', style: { fontSize: '12px' } }, `Restore 40% hull (+${fmt(amt)}).`)));
    const tunable = p.equipped.map((u) => p.mods.find((m) => m.uid === u)).filter((m) => m && m.lv < [3, 5, 7, 10][m.rar]);
    grid.append(el('button', { class: 'choice', disabled: !tunable.length, onclick: () => tunePick(tunable) },
        el('div', { class: 'h' }, el('img', { src: iconURL('servos', '#45f3ff', 60), alt: '' }), el('b', {}, 'Tune a module')),
        el('div', { class: 'desc', style: { fontSize: '12px' } }, tunable.length ? 'One equipped module gains a level, free.' : 'No equipped module can be tuned further.')));
    body.append(grid);
    openPanel({ title: 'Repair Bay', sub: `Hull ${fmt(s.hp)} / ${fmt(L.maxHp)}`, body, foot: [] });
}

function tunePick(list) {
    const p = G.p;
    const g = el('div', { class: 'mods' });
    for (const m of list) g.append(modCard(m, { equipped: true, actions: [btn('Tune', () => { P.tuneMod(p, m.uid); sound.upgrade(); closePanel(); finishNode(); }, 'buy green')] }));
    openPanel({ title: 'Tune a module', body: g, foot: [btn('Back', () => nodeRest())] });
}

function toMapHp() {
    if (!G.p.sector) return;
    const L = deriveLoadout(G.p);
    $('#map-hp').style.width = `${(100 * G.p.sector.hp) / L.maxHp}%`;
    $('#map-hp-t').textContent = `${fmt(G.p.sector.hp)} / ${fmt(L.maxHp)}`;
}

function mapBoosters() {
    const p = G.p;
    const L = deriveLoadout(p);
    const body = el('div', {});
    for (const id in BOOSTERS) {
        const d = BOOSTERS[id];
        const n = p.boosters[id] ?? 0;
        body.append(el('div', { class: 'row' },
            el('img', { class: 'ic', src: iconURL(d.icon, d.color, 60), alt: '' }),
            el('div', { class: 'grow' }, el('div', { class: 'nm' }, d.name, el('span', { class: 'lv' }, `×${n}`)), el('div', { class: 'ds' }, d.desc)),
            id === 'nanite' ? btn('Use', () => { p.boosters.nanite--; P.repairSector(p, 0.35); sound.repair(); save(); toMapHp(); mapBoosters(); }, 'buy green', { disabled: n <= 0 || p.sector.hp >= L.maxHp }) : null));
    }
    openPanel({ title: 'Boosters', sub: 'Most are used in battle, from the bar under the reels. Nanite Packs also work here.', body, foot: [btn('Close', closePanel, 'menu-btn primary')] });
}

function retreat() {
    openPanel({
        title: 'Retreat?', sub: 'Abandon this sortie and return to the carrier. You keep everything you have banked.',
        foot: [btn('Stay', closePanel), btn('Retreat', () => { closePanel(); G.p.sector = null; save(); toHub('deploy'); }, 'menu-btn primary')],
    });
}

// ------------------------------------------------------------------ Sim Ladder

function ladderStart() {
    const p = G.p;
    if (p.sector) return;
    if (!p.ladder.run) P.startLadder(p);
    save();
    ladderFloor();
}

function ladderFloor() {
    const p = G.p;
    const floor = p.ladder.run.floor;
    const enc = P.ladderEncounter(p, floor);
    fight({
        encounter: enc, kind: enc.kind === 'boss' ? 'boss' : enc.kind === 'elite' ? 'elite' : 'battle', hp: p.ladder.run.hp,
        title: `Sim Ladder · Floor ${floor}`,
        onWin: (res) => {
            const out = P.applyVictory(p, res, { kind: 'ladder', x: enc.x });
            const lw = P.ladderWin(p, res);
            out.cores += lw.cores;
            save();
            fade(() => {
                screen('hub');
                renderHub('deploy');
                showRewards(out, { title: `Floor ${floor} cleared`, sub: `Best floor: ${p.ladder.best}` }, () => {
                    openPanel({
                        title: 'Keep climbing?', sub: `Floor ${p.ladder.run.floor} next · hull ${fmt(p.ladder.run.hp)} / ${fmt(res.maxHp)}`,
                        foot: [btn('Leave the ladder', () => { closePanel(); P.ladderEnd(p); save(); toHub('deploy'); }), btn('Next floor', () => { closePanel(); ladderFloor(); }, 'menu-btn primary')],
                    });
                });
            });
        },
        onLose: (res) => {
            const best = p.ladder.best;
            P.applyDefeat(p, res);
            P.ladderEnd(p);
            save();
            fade(() => {
                toHub('deploy');
                openPanel({ title: 'Simulation ended', sub: `You reached floor ${p.ladder.run?.floor ?? floor}. Best: ${best}.`, foot: [btn('Back to the carrier', closePanel, 'menu-btn primary')] });
            });
        },
    });
}

// ------------------------------------------------------------------ menus

function pauseMenu() {
    if (storyActive()) return;
    const foot = [btn('Resume', () => { battle.paused = false; closePanel(); }, 'menu-btn primary')];
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        btn('Settings', () => settingsPanel(pauseMenu)),
        btn('How to Play', () => howTo(pauseMenu)));
    if (G.screen === 'battle') {
        body.append(btn('Abandon fight', () => {
            closePanel();
            battle.paused = false;
            if (!debugEnd(false)) sound.deny();
        }));
    }
    if (G.screen === 'map') body.append(btn('Retreat to the carrier', retreat));
    body.append(btn('Save & quit to title', () => { save(); closePanel(); battle.paused = false; toTitle(); }));
    battle.paused = true;
    openPanel({ title: 'Paused', body, foot });
}

function settingsPanel(back) {
    const extra = [];
    if (G.p || loadSave()) {
        extra.push(el('div', { class: 'set-row' }, el('span', { class: 'dim' }, 'Erase your cadet and start over'), btn('Erase save', () => {
            openPanel({ title: 'Erase save?', sub: 'This cannot be undone.', foot: [btn('Cancel', () => settingsPanel(back)), btn('Erase', () => { localStorage.removeItem(SAVE_KEY); G.p = null; closePanel(); toTitle(); }, 'menu-btn primary')] });
        }, 'small-btn')));
    }
    openPanel({ title: 'Settings', body: showSettings(G.settings, applySettings, extra), foot: [btn('Done', () => { if (back) back(); else closePanel(); }, 'menu-btn primary')] });
}

function howTo(back) {
    openPanel({ title: 'How to Play', body: howToBody(), wide: true, foot: [btn('Got it', () => { if (back) back(); else closePanel(); }, 'menu-btn primary')] });
}

// ------------------------------------------------------------------ backgrounds

function drawScene(ctx, dt) {
    const W = stage.w, H = stage.h;
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    const t = G.t;
    if (G.screen === 'title' || G.screen === 'callsign') {
        G.titleCh = Math.floor(t / 14) % 6 + 1;
        const floor = { x: 0, y: H * 0.45, w: W, h: H * 0.55 };
        drawBackdrop(ctx, W, H, stage.dpr, G.titleCh, t, floor, { od: 0 });
        // slot rain
        if (G.rain.length < 26 && Math.random() < dt * 6) {
            const sym = ['blade', 'cannon', 'missile', 'arc', 'shield', 'repair', 'energy', 'scrap', 'wild', 'core'][Math.floor(Math.random() * 10)];
            G.rain.push({ sym, x: Math.random() * W, y: -60, v: 40 + Math.random() * 80, s: 28 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 1.2 });
        }
        for (let i = G.rain.length - 1; i >= 0; i--) {
            const d = G.rain[i];
            d.y += d.v * dt; d.r += d.vr * dt;
            if (d.y > H + 60) { G.rain.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.translate(d.x, d.y); ctx.rotate(d.r);
            ctx.drawImage(symbolTile(d.sym, d.s), -d.s / 2, -d.s / 2, d.s, d.s);
            ctx.restore();
        }
        const mh = Math.min(H * 0.5, W * 0.35);
        drawPlayerMech(ctx, W * 0.14 + mh * 0.1, H * 0.94, mh, { mech: G.p?.mech ?? { reels: 3, matrix: 6, reactor: 6, servos: 5, core: 8, chassis: 4, armor: 25, blade: 20, cannon: 20, missile: 10, arc: 10, shield: 10, repair: 10 }, t, cols: 5 });
    } else if (G.screen === 'hub') {
        const floor = { x: 0, y: H * 0.42, w: W, h: H * 0.58 };
        drawBackdrop(ctx, W, H, stage.dpr, G.bgChapter, t, floor, { od: 0 });
        // hangar light beams
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
            const x = W * (0.08 + i * 0.12);
            const g = ctx.createLinearGradient(x, 0, x, H);
            g.addColorStop(0, 'rgba(120,200,255,0.10)'); g.addColorStop(1, 'rgba(120,200,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 120, H); ctx.lineTo(x - 120, H); ctx.fill();
        }
        ctx.restore();
        const wide = W > 900;
        const mh = wide ? Math.min(H * 0.62, W * 0.26) : Math.min(H * 0.3, W * 0.5);
        const mx = wide ? W * 0.16 : W * 0.5, my = wide ? H * 0.92 : H * 0.97;
        G.mechAt = { x: mx, y: my - mh * 0.7, h: mh };
        if (Math.random() < dt * 1.5) F.burst(mx + (Math.random() - 0.5) * mh * 0.6, my - mh * Math.random(), '#ffd36a', 5, 160, { grav: 500 });
        drawPlayerMech(ctx, mx, my, mh, { mech: G.p.mech, t, cols: G.p.mech.reels + 2, flash: G.mechFlash ?? 0 });
        G.mechFlash = Math.max(0, (G.mechFlash ?? 0) - dt * 3);
    } else {
        drawBackdrop(ctx, W, H, stage.dpr, G.bgChapter, t, G.screen === 'map' ? { x: 0, y: H * 0.55, w: W, h: H * 0.45 } : null, { od: 0 });
    }
    F.drawFx(ctx);
    F.drawScreenFx(ctx, W, H);
}

function hubFx(kind, n) {
    const m = G.mechAt;
    if (!m) return;
    G.mechFlash = 1;
    if (kind === 'upgrade' || kind === 'skill') {
        F.burst(m.x, m.y, kind === 'skill' ? '#ff4dff' : '#45f3ff', 40, 380);
        F.ring(m.x, m.y, kind === 'skill' ? '#ff4dff' : '#45f3ff', m.h * 0.7, 0.5, 4);
        F.shake(0.15);
    } else if (kind === 'collect' || kind === 'claim') {
        const r = $('#hub-scrap').getBoundingClientRect();
        F.coins(stage.w / 2, stage.h / 2, 30, r.left + r.width / 2, r.top + r.height / 2);
    } else F.burst(m.x, m.y, '#ffffff', 16, 220);
}

// ------------------------------------------------------------------ loop

let last = performance.now();
function frame(now) {
    const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    G.t += raw;
    const ctx = stage.ctx;
    // one bad draw must never stop the loop: the fx clock drives every battle animation
    try {
        if (G.screen === 'battle') battleFrame(ctx, raw);
        else {
            F.updateFx(raw);
            drawScene(ctx, raw);
        }
        if (storyActive()) drawStoryPortrait(G.t);
    } catch (err) {
        if (!G.drawErr) { G.drawErr = true; console.error('frame', err); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // refinery ticks live
    if (G.p && Math.floor(G.t * 2) !== Math.floor((G.t - raw) * 2)) {
        P.tickFacilities(G.p, Date.now() / 1000);
        if (G.screen === 'hub') tickHub();
    }
    autoQuality(raw);
    requestAnimationFrame(frame);
}

function autoQuality(dt) {
    if (DEBUG || G.settings.quality !== 'auto' || !dt) return;
    G.fpsAcc += dt; G.fpsN++;
    if (G.fpsAcc < 2) return;
    const fps = G.fpsN / G.fpsAcc;
    G.fpsAcc = 0; G.fpsN = 0;
    if (fps < 40) G.slowFrames++; else G.slowFrames = 0;
    if (G.slowFrames >= 3 && stage.quality > 0) {
        G.slowFrames = 0;
        G.autoTier = stage.quality - 1;
        applySettings();
    }
}

// ------------------------------------------------------------------ input

function wire() {
    const on = (sel, fn) => $(sel).addEventListener('click', (e) => { initAudio(); fn(e); });
    on('#t-continue', () => { sound.click(); fade(continueGame); });
    on('#t-new', () => {
        sound.click();
        if (loadSave()) openPanel({ title: 'Start a new cadet?', sub: 'Your current save will be replaced.', foot: [btn('Cancel', closePanel), btn('New cadet', () => { closePanel(); toCallsign(); }, 'menu-btn primary')] });
        else toCallsign();
    });
    on('#t-how', () => { sound.click(); howTo(); });
    on('#t-settings', () => { sound.click(); settingsPanel(); });
    on('#cs-roll', () => { sound.click(); $('#cs-input').value = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]; });
    on('#cs-back', () => { sound.click(); toTitle(); });
    on('#cs-go', () => { sound.click(); fade(() => newGame($('#cs-input').value)); });
    $('#cs-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { initAudio(); fade(() => newGame($('#cs-input').value)); } e.stopPropagation(); });
    on('#story-next', storyNext);
    on('#story-skip', storySkip);
    $('#scr-story').addEventListener('click', (e) => { if (e.target.closest('button')) return; initAudio(); storyNext(); });
    on('#hub-menu', pauseMenu);
    on('#b-menu', pauseMenu);
    on('#b-spin', mainButton);
    on('#b-auto', toggleAuto);
    on('#b-speed', () => { G.settings.speed = cycleSpeed(); saveSettings(); });
    on('#rm-up', () => reelAction('up'));
    on('#rm-down', () => reelAction('down'));
    on('#rm-respin', () => reelAction('respin'));
    on('#rm-hold', () => reelAction('hold'));
    on('#rm-purge', () => reelAction('purge'));
    on('#map-retreat', () => { sound.click(); retreat(); });
    on('#map-boost', () => { sound.click(); mapBoosters(); });
    const cv = stage.el;
    cv.addEventListener('pointerdown', (e) => { initAudio(); if (G.screen === 'battle') clickStage(e.clientX, e.clientY); });
    cv.addEventListener('pointermove', (e) => { if (G.screen === 'battle' && e.pointerType === 'mouse') hoverStage(e.clientX, e.clientY); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => {
        battleResize();
        if (G.screen === 'map' && G.p?.sector) renderMap(G.p, deriveLoadout(G.p).maxHp, pickNode);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

function onKey(e) {
    if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    initAudio();
    const k = e.key;
    if (storyActive()) {
        if (k === ' ' || k === 'Enter' || k === 'ArrowRight') { e.preventDefault(); storyNext(); }
        if (k === 'Escape') storySkip();
        return;
    }
    if (panelOpen()) {
        if (k === 'Escape') {
            const f = $('#panel-foot .menu-btn.primary');
            if (f && G.screen !== 'title') f.click(); else closePanel();
            battle.paused = false;
        }
        return;
    }
    if (k === 'Escape') { if (G.screen === 'battle' || G.screen === 'hub' || G.screen === 'map') pauseMenu(); return; }
    if (G.screen !== 'battle') return;
    const st = battle.st;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); mainButton(); return; }
    if (/^[1-5]$/.test(k)) { const c = Number(k) - 1; if (st && c < st.cols && st.phase === 'landed') selectReel(battle.selected === c ? -1 : c); return; }
    if (k === 'ArrowUp') { e.preventDefault(); reelAction('up'); return; }
    if (k === 'ArrowDown') { e.preventDefault(); reelAction('down'); return; }
    if (k === 'r' || k === 'R') reelAction('respin');
    if (k === 'h' || k === 'H') reelAction('hold');
    if (k === 'p' || k === 'P') reelAction('purge');
    if (k === 't' || k === 'T' || k === 'Tab') { e.preventDefault(); cycleTarget(); }
    if (k === 'a' || k === 'A') toggleAuto();
    if (k === 's' || k === 'S') { G.settings.speed = cycleSpeed(); saveSettings(); }
}

// ------------------------------------------------------------------ boot

function boot() {
    initStage($('#stage'));
    loadSettings();
    if (DEBUG && params.get('quality')) G.settings.quality = Number(params.get('quality'));
    applySettings();
    // the hub reads G.p through a getter so a new game is picked up
    const hubCtx = { get profile() { return G.p; }, save, tab: 'deploy', onDeploy: deployChapter, onContinue: resumeSortie, onLadder: ladderStart, onFx: hubFx };
    initHub(hubCtx);
    wire();
    toTitle();
    requestAnimationFrame(frame);
    if (DEBUG) installDebug();
}

function installDebug() {
    window.__sf = {
        get p() { return G.p; },
        get screen() { return G.screen; },
        get battle() { return battle; },
        get story() { return storyScene(); },
        newGame(cs = 'TEST', seed = 1234, skipStory = true) {
            initAudio();
            G.p = P.newProfile(seed, cs);
            P.tickFacilities(G.p, Date.now() / 1000);
            if (skipStory) { G.p.story.queue = []; G.p.tutorial.hub = true; }
            save();
            playQueue(() => toHub('deploy'));
        },
        give(scrap = 0, cores = 0) { G.p.scrap += scrap; G.p.cores += cores; save(); if (G.screen === 'hub') renderHub(); },
        best(n) { G.p.campaign.best = n; save(); if (G.screen === 'hub') renderHub(); },
        mech(o) { Object.assign(G.p.mech, o); save(); if (G.screen === 'hub') renderHub(); },
        deploy(ch, threat = 0) { G.p.sector = null; G.p.story.seen.push(`intro${ch}`, `boss${ch}`); deployChapter(ch, threat); },
        goto(type) {
            const s = G.p.sector;
            const n = s.nodes.find((q) => q.type === type && !s.done.includes(q.id));
            if (!n) return false;
            closePanel();
            pickNode(n.id);
            return true;
        },
        win() { return debugEnd(true); },
        lose() { return debugEnd(false); },
        idle() { return G.screen === 'battle' && !battle.busy && (battle.st.phase === 'ready' || battle.st.phase === 'landed'); },
        act(a) { act(a); },
        reelPx(c) { const r = battle.reels.rect; return { x: r.x + (c + 0.5) * battle.reels.cell, y: r.y + r.h / 2 }; },
        enemyPx(id) { return battle.arena.enemyCenter(id); },
        mod(id, rar = 2, lv = 3) { const m = P.newMod(G.p, 0); Object.assign(m, { id, rar, lv }); P.addMod(G.p, m); if (!G.p.equipped.includes(m.uid)) G.p.equipped.push(m.uid); save(); return m; },
        story(id) { G.p.story.queue.push(id); playQueue(() => toHub('deploy')); },
        quality(q) { G.settings.quality = q; applySettings(); },
        save, toHub, toMap,
    };
}

boot();
