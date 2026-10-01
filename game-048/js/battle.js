/**
 * battle.js — the director. Player input calls into the combat sim, which
 * resolves instantly and returns events; the director plays them one at a
 * time (each handler awaits its own animation), then syncs every view to the
 * true state. Input is accepted only while the queue is empty.
 */

import * as C from './sim/combat.js';
import { botNext, applyAction } from './sim/bot.js';
import { SYMBOLS } from './sim/symbols.js';
import { BOOSTERS, BOOSTER_IDS } from './sim/boosters.js';
import { BARKS } from './sim/story.js';
import { fmt } from './sim/format.js';
import { stage, battleLayout } from './view/canvas.js';
import { ReelView } from './view/reels.js';
import { ArenaView } from './view/arena.js';
import * as F from './view/fx.js';
import { drawBackdrop, drawConsole } from './view/backdrop.js';
import { iconURL } from './view/art.js';
import { sound, setMusic, setIntensity } from './audio.js';
import { $, el, show, hide, banner, bark } from './ui/dom.js';

export const battle = {
    st: null, active: false, busy: false, reels: new ReelView(), arena: new ArenaView(),
    auto: false, speed: 1, onEnd: null, chapter: 0, profile: null, poolHp: 1, kind: 'battle',
    selected: -1, ended: false, callsign: 'ACE', lastBark: 0, autoT: 0, title: '', paused: false,
};
const B = battle;
const SPEEDS = [1, 1.6, 2.4];

const symColor = (s) => (s === 'wild' ? '#ffe14d' : SYMBOLS[s]?.color ?? '#ffffff');

// ------------------------------------------------------------------ lifecycle

export function startBattle({ profile, L, encounter, seed, hp, kind, title, onEnd }) {
    const st = C.createCombat({ L, encounter, seed, hp, boosters: profile.boosters });
    B.st = st;
    B.profile = profile;
    B.callsign = profile.callsign;
    B.chapter = encounter.chapter;
    B.kind = kind;
    B.title = title;
    B.onEnd = onEnd;
    B.active = true;
    B.busy = false;
    B.ended = false;
    B.selected = -1;
    B.poolHp = st.enemies.reduce((s, e) => s + e.maxHp, 0);
    F.resetFx();
    B.reels.setup(st);
    B.arena.setup(st, profile.mech, encounter.chapter);
    B.reels.od = 0;
    show('#battle-ui');
    $('#b-title').textContent = title;
    $('#b-loot').textContent = '0';
    layoutNow();
    buildBoosterBar();
    refreshUi();
    setMusic(kind === 'boss' ? 'boss' : 'battle', encounter.chapter);
    setIntensity(kind === 'boss' ? 1 : 0);
    sayBark(kind === 'boss' ? 'boss' : 'start', true);
    if (!profile.tutorial.spin) tip('Press <b>SPIN</b> (or Space). Every symbol that lands will fire.');
}

export function endBattleUi() {
    B.active = false;
    hide('#battle-ui');
    hide('#reel-menu');
    hide('#b-tip');
    hide('#bark');
    hide('#hover-tip');
    $('#banner').innerHTML = '';
    $('#chain').className = 'chain';
    F.resetFx();
}

function layoutNow() {
    const top = $('#b-top').getBoundingClientRect().height;
    const bottom = $('#b-bottom').getBoundingClientRect().height;
    const lay = battleLayout(B.st.cols, B.st.rows, top, bottom);
    B.layout = lay;
    B.reels.layout(lay.reels, lay.cell);
    B.arena.layout(lay.arena);
}
export function battleResize() { if (B.active) layoutNow(); }

// ------------------------------------------------------------------ frame

export function battleFrame(ctx, rawDt) {
    if (!B.active) return;
    if (!B.layout || stage.layout !== B.layout) { layoutNow(); stage.layout = B.layout; }
    const dt = F.updateFx(rawDt * B.speed);
    B.reels.update(dt);
    B.reels.tick(dt);
    B.arena.update(dt);
    const W = stage.w, H = stage.h;
    ctx.save();
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    const z = 1 + F.fx.zoom * 0.04;
    ctx.translate(W / 2 + F.fx.sx, H / 2 + F.fx.sy);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    drawBackdrop(ctx, W, H, stage.dpr, B.chapter, B.reels.time, B.layout.arena, { od: B.reels.od });
    const rb = B.layout.reelBox;
    drawConsole(ctx, rb.x, rb.y, rb.w, rb.h + 200, stage.dpr, B.chapter);
    B.arena.draw(ctx, {});
    B.reels.draw(ctx, { lines: B.st.lines });
    F.drawFx(ctx);
    ctx.restore();
    ctx.save();
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    if (F.fx.aberr > 0.02) {
        // ghost the frame sideways in two tints: cheap chromatic aberration
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = F.fx.aberr * 0.25;
        const o = F.fx.aberr * 6;
        ctx.drawImage(stage.el, 0, 0, stage.el.width, stage.el.height, o, 0, W, H);
        ctx.drawImage(stage.el, 0, 0, stage.el.width, stage.el.height, -o, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
    F.drawScreenFx(ctx, W, H);
    ctx.restore();
    B.reels.od = Math.max(0, B.reels.od - (B.st.overdrive > 0 || B.st.bonus ? 0 : rawDt));
    // AUTO
    if (B.auto && !B.paused && !B.busy && !B.ended && (B.st.phase === 'ready' || B.st.phase === 'landed')) {
        B.autoT -= rawDt * B.speed;
        if (B.autoT <= 0) {
            B.autoT = 0.35;
            const a = botNext(B.st, { saveBoosters: true });
            if (a) act(a);
        }
    }
}

// ------------------------------------------------------------------ input

export function act(a) {
    if (B.busy || B.ended || !B.st) return;
    const st = B.st;
    if (a.kind === 'target') { C.setTarget(st, a.id); B.arena.target = st.target; sound.click(); return; }
    const before = st.phase;
    const ev = applyAction(st, a);
    if (!ev.length) { if (a.kind !== 'spin' && a.kind !== 'engage') sound.deny(); return; }
    if (a.kind === 'spin' && !B.profile.tutorial.spin) { B.profile.tutorial.spin = true; hide('#b-tip'); }
    hide('#reel-menu');
    B.selected = -1;
    B.reels.selected = -1;
    if (before === 'landed' && a.kind === 'engage') hide('#b-tip');
    play(ev);
}

async function play(events) {
    B.busy = true;
    refreshUi();
    for (const e of events) {
        const h = H[e.t];
        if (h) {
            try { await h(e); } catch (err) { console.error('battle event', e.t, err); }
        }
    }
    syncAll();
    B.busy = false;
    refreshUi();
    if (B.st.phase === 'landed') {
        B.reels.preview = B.st.preview.wins;
        if (!B.profile.tutorial.tweak && !B.auto) {
            tip('Dashed traces show the lines you will hit. <b>Tap a reel</b> to nudge, respin or hold it with energy ⚡ — or press <b>ENGAGE</b>.');
            B.profile.tutorial.tweak = true;
        }
    } else B.reels.preview = [];
    if ((B.st.phase === 'won' || B.st.phase === 'lost') && !B.ended) {
        B.ended = true;
        await F.wait(B.st.phase === 'won' ? 1.1 : 1.6);
        const res = C.combatResult(B.st);
        const cb = B.onEnd;
        B.onEnd = null;
        if (cb) cb(res);
    }
}

function syncAll() {
    const st = B.st;
    B.arena.sync(st);
    B.reels.syncFlags(st);
    if (st.phase === 'landed' || st.phase === 'ready') {
        for (let c = 0; c < st.cols; c++) if (!B.reels.reels[c].anim) B.reels.setColumn(c, st.grid[c]);
    }
}

export function clickStage(x, y) {
    if (!B.active || B.ended) return;
    const id = B.arena.hitTest(x, y);
    if (id >= 0) { act({ kind: 'target', id }); return; }
    const c = B.reels.reelAt(x, y);
    if (c >= 0 && c < B.st.cols) {
        if (B.busy || B.st.phase !== 'landed') {
            if (B.st.phase === 'ready' && !B.busy) act({ kind: 'spin' });
            return;
        }
        selectReel(B.selected === c ? -1 : c);
        return;
    }
    selectReel(-1);
}

export function hoverStage(x, y) {
    if (!B.active) return;
    const id = B.arena.hitTest(x, y);
    B.arena.hover = id;
    const tipEl = $('#hover-tip');
    if (id >= 0) {
        const e = B.st.enemies.find((q) => q.id === id);
        const L = C.intentLabel(e.intent);
        tipEl.innerHTML = `<b>${e.name}</b><br>${fmt(e.hp)}/${fmt(e.maxHp)} hull${e.shield ? ` · ${fmt(e.shield)} shield` : ''}${e.armor > 0.5 ? ` · ${fmt(e.armor)} armor` : ''}<br><span class="intent">Next: ${L.text}${L.value ? ` (${L.value})` : ''}</span>${e.affixes.length ? `<br><span class="affix">${e.affixes.join(', ')}</span>` : ''}`;
        tipEl.style.left = `${Math.min(stage.w - 230, x + 14)}px`;
        tipEl.style.top = `${y + 14}px`;
        show(tipEl);
    } else hide(tipEl);
}

export function selectReel(c) {
    B.selected = c;
    B.reels.selected = c;
    const menu = $('#reel-menu');
    if (c < 0) { hide(menu); return; }
    const st = B.st;
    const R = B.reels.rect;
    const x = R.x + (c + 0.5) * B.reels.cell;
    show(menu);
    const top = $('#b-top').getBoundingClientRect().bottom;
    const beside = R.y - 70 < top;
    menu.classList.toggle('beside', beside);
    if (beside) {
        // no room above the cabinet (landscape phones): hang it off the cabinet's left edge
        menu.style.left = `${R.x - 14}px`;
        menu.style.top = `${R.y + R.h / 2}px`;
    } else {
        const w = menu.getBoundingClientRect().width || 240;
        menu.style.left = `${Math.max(w / 2 + 6, Math.min(stage.w - w / 2 - 6, x))}px`;
        menu.style.top = `${R.y - 8}px`;
    }
    const L = st.L;
    const nc = C.nudgeCost(st);
    const jam = st.reels[c].jammed;
    const setBtn = (id, ok, label) => { const b = $(id); b.disabled = !ok; b.querySelector('small').textContent = label; b.classList.toggle('hidden', id === '#rm-purge' ? !jam : jam); };
    setBtn('#rm-up', C.canAct(st, 'nudge', c), nc ? `${nc}⚡` : 'free');
    setBtn('#rm-down', C.canAct(st, 'nudge', c), nc ? `${nc}⚡` : 'free');
    setBtn('#rm-respin', C.canAct(st, 'respin', c), `${L.respinCost}⚡`);
    setBtn('#rm-hold', C.canAct(st, 'hold', c), st.reels[c].hold ? 'release' : L.holdCost ? `${L.holdCost}⚡` : 'free');
    setBtn('#rm-purge', C.canAct(st, 'purge', c), `${L.purgeCost}⚡`);
    $('#rm-hold').classList.toggle('on', st.reels[c].hold);
    show(menu);
}

export function reelAction(kind) {
    const c = B.selected;
    if (c < 0) return;
    if (kind === 'up') act({ kind: 'nudge', reel: c, dir: -1 });
    else if (kind === 'down') act({ kind: 'nudge', reel: c, dir: 1 });
    else if (kind === 'respin') act({ kind: 'respin', reel: c });
    else if (kind === 'hold') act({ kind: 'hold', reel: c });
    else if (kind === 'purge') act({ kind: 'purge', reel: c });
    if (B.st.phase === 'landed' && kind !== 'respin' && kind !== 'purge') setTimeout(() => { if (!B.busy && B.st.phase === 'landed') selectReel(c); }, 10);
}

export function mainButton() {
    if (!B.active || B.busy) return;
    if (B.st.phase === 'ready') act({ kind: 'spin' });
    else if (B.st.phase === 'landed') act({ kind: 'engage' });
}

export function cycleTarget() {
    const a = C.alive(B.st);
    if (!a.length) return;
    const i = a.findIndex((e) => e.id === B.st.target);
    act({ kind: 'target', id: a[(i + 1) % a.length].id });
}

export function toggleAuto() {
    B.auto = !B.auto;
    B.autoT = 0.2;
    $('#b-auto').classList.toggle('on', B.auto);
    sound.click();
}
export function cycleSpeed() {
    const i = SPEEDS.indexOf(B.speed);
    B.speed = SPEEDS[(i + 1) % SPEEDS.length];
    $('#b-speed').textContent = `${B.speed}×`;
    sound.click();
    return B.speed;
}
export function setSpeed(s) { B.speed = SPEEDS.includes(s) ? s : 1; $('#b-speed').textContent = `${B.speed}×`; }

// ------------------------------------------------------------------ UI

function buildBoosterBar() {
    const bar = $('#b-boosters');
    bar.innerHTML = '';
    for (const id of BOOSTER_IDS) {
        const d = BOOSTERS[id];
        const b = el('button', { class: 'boost', 'data-id': id, title: `${d.name}: ${d.desc}`, 'aria-label': d.name, onclick: () => act({ kind: 'boost', id }) },
            el('img', { src: iconURL(d.icon, d.color, 48), alt: '' }), el('span', { class: 'n' }, '0'));
        bar.append(b);
    }
}

export function refreshUi() {
    const st = B.st;
    if (!st) return;
    const p = st.player;
    // energy pips
    const en = $('#b-energy');
    const max = Math.max(p.maxEnergy, p.energy);
    if (en.children.length !== max) { en.innerHTML = ''; for (let i = 0; i < max; i++) en.append(el('i')); }
    [...en.children].forEach((pip, i) => { pip.className = i < p.energy ? 'on' : ''; });
    $('#b-free').textContent = p.freeNudges > 0 ? `${p.freeNudges} free nudge${p.freeNudges > 1 ? 's' : ''}` : '';
    // boosters
    for (const b of document.querySelectorAll('#b-boosters .boost')) {
        const id = b.dataset.id;
        const n = st.boosters[id] ?? 0;
        b.querySelector('.n').textContent = n;
        b.classList.toggle('none', n <= 0);
        b.disabled = B.busy || !C.canBoost(st, id);
    }
    // main button
    const btn = $('#b-spin');
    btn.classList.remove('engage', 'bonus');
    if (st.phase === 'landed') {
        const n = st.preview.wins.length;
        btn.innerHTML = `ENGAGE<small>${n ? `${n} line${n > 1 ? 's' : ''}` : 'no lines'}${st.preview.cores >= 3 ? ' · OVERDRIVE' : ''}</small>`;
        btn.classList.add('engage');
    } else if (st.overdrive > 0 || st.bonus) {
        btn.innerHTML = `BONUS SPIN<small>${st.overdrive} left · ×${st.overdriveMult}</small>`;
        btn.classList.add('bonus');
    } else btn.innerHTML = `SPIN<small>turn ${st.turn}</small>`;
    btn.disabled = B.busy || (st.phase !== 'ready' && st.phase !== 'landed');
    $('#b-loot').textContent = fmt(st.loot.scrap);
    if (B.selected >= 0 && st.phase === 'landed' && !B.busy) selectReel(B.selected);
}

function tip(html) {
    const t = $('#b-tip');
    t.innerHTML = html;
    // sit just above the reel cabinet, or under the top bar if the arena is beside the reels
    const R = B.reels.rect;
    const A = B.layout?.arena;
    t.style.top = B.layout?.side ? `${Math.round(A.y + 110)}px` : `${Math.round(R.y - 18)}px`;
    t.style.left = B.layout?.side ? `${Math.round(A.x + A.w / 2)}px` : '';
    t.style.maxWidth = B.layout?.side ? `${Math.round(A.w - 16)}px` : '';
    show(t);
}

function sayBark(kind, force = false) {
    const now = performance.now();
    if (!force && now - B.lastBark < 4500) return;
    if (!force && Math.random() < 0.45) return;
    B.lastBark = now;
    const list = BARKS[kind];
    if (!list) return;
    bark(list[Math.floor(Math.random() * list.length)].replaceAll('{cs}', B.callsign));
}

function domPoint(sel) {
    const r = $(sel)?.getBoundingClientRect();
    if (!r || !r.width) return { x: stage.w / 2, y: stage.h - 40 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ------------------------------------------------------------------ event handlers

const W = (s) => F.wait(s);
const cellsCenter = (cells) => {
    let x = 0, y = 0;
    for (const [c, r] of cells) { const p = B.reels.cellCenter(c, r); x += p.x; y += p.y; }
    return { x: x / cells.length, y: y / cells.length };
};

const H = {
    async spin(e) {
        const R = B.reels;
        R.clearWins();
        R.preview = [];
        R.marquee = 1;
        R.pinned = e.sticky ?? [];
        B.arena.player.spinning = true;
        sound.spinStart();
        if (e.bonus) { banner(`BONUS SPIN <small>×${B.st.overdriveMult}</small>`, 'od', 700); R.od = 1; }
        const proms = [];
        let coresSoFar = 0;
        const tickTimer = setInterval(() => sound.tick(Math.floor(Math.random() * 3)), 55);
        for (let c = 0; c < B.st.cols; c++) {
            if (e.jammed.includes(c)) {
                R.reels[c].jammed = true;
                R.setColumn(c, e.grid[c]);
                R.reels[c].shake = 1;
                continue;
            }
            if (e.held.includes(c)) { R.setColumn(c, e.grid[c]); R.reels[c].glow = 1; continue; }
            const antic = coresSoFar >= 2;
            const dur = 0.5 + c * 0.17 + (antic ? 0.9 : 0);
            const col = c;
            proms.push(R.spinTo(c, e.pos[c], dur, { antic, final: e.grid[c] }).then(() => {
                sound.reelStop(col);
                R.reels[col].glow = 0.6;
                F.shake(0.05);
                const rect = R.rect;
                F.burst(rect.x + (col + 0.5) * R.cell, rect.y + rect.h, '#9cc4ff', 6, 140, { dir: -Math.PI / 2, spread: 1 });
                for (let r = 0; r < B.st.rows; r++) {
                    const s = e.grid[col][r];
                    if (s === 'core') { const p = R.cellCenter(col, r); F.ring(p.x, p.y, '#ff4dff', R.cell * 0.6, 0.4); F.glow(p.x, p.y, '#ff4dff', R.cell * 0.6, 0.4); }
                }
            }));
            if (antic) setTimeout(() => sound.antic(c), (dur - 0.9) * 1000 / B.speed);
            coresSoFar += e.grid[c].filter((s) => s === 'core').length;
        }
        if (e.jammed.length) sound.jam();
        await Promise.all(proms);
        clearInterval(tickTimer);
        R.marquee = 0;
        R.pinned = [];
        B.arena.player.spinning = false;
        R.setGrid(e.grid);
        const cores = e.grid.flat().filter((s) => s === 'core').length;
        if (cores === 2) { banner('2 CORES… <small>one more for Overdrive</small>', 'info', 900); }
        if (B.st.preview.wins.length === 0 && cores < 3) sayBark('whiff');
    },

    async nudge(e) {
        sound.nudge();
        await B.reels.nudge(e.reel, e.pos, e.dir, e.grid[e.reel]);
        B.reels.setGrid(e.grid);
    },
    async respin(e) { sound.spinStart(); await B.reels.spinTo(e.reel, e.pos, 0.55, { final: e.grid[e.reel] }); sound.reelStop(e.reel); B.reels.setGrid(e.grid); },
    async purge(e) {
        B.reels.reels[e.reel].jammed = false;
        const p = B.reels.cellCenter(e.reel, 1);
        F.shards(p.x, p.y, '#ff3355', 14);
        sound.glitch();
        await B.reels.spinTo(e.reel, e.pos, 0.55, { final: e.grid[e.reel] });
        sound.reelStop(e.reel);
        B.reels.setGrid(e.grid);
    },
    async hold(e) { sound.hold(); B.reels.reels[e.reel].hold = e.on; B.reels.reels[e.reel].glow = 0.8; },
    async coin(e) {
        sound.jackpot();
        B.reels.setGrid(e.grid);
        for (const [c, r] of e.cells) { const p = B.reels.cellCenter(c, r); F.burst(p.x, p.y, '#ffffff', 20, 260); F.ring(p.x, p.y, '#ffe14d', B.reels.cell * 0.7); }
        await W(0.3);
    },
    async booster(e) {
        const d = BOOSTERS[e.id];
        sound.upgrade();
        banner(d.name.toUpperCase(), 'info', 700);
        const P = B.arena.chest();
        F.burst(P.x, P.y, d.color, 20, 240);
        await W(0.15);
    },
    async patch(e) { sound.repair(); B.reels.reels.forEach((v) => { v.glow = 1; }); if (e.n) banner(`${e.n} GLITCH${e.n > 1 ? 'ES' : ''} ERASED`, 'info', 900); await W(0.2); },
    async unjam(e) { for (const c of e.reels) { B.reels.reels[c].jammed = false; B.reels.reels[c].lockNext = false; B.reels.reels[c].glow = 1; } if (e.grid) B.reels.setGrid(e.grid); await W(0.1); },

    async engage(e) {
        B.reels.preview = [];
        B.reels.dimTarget = 0.5;
        B.chainShown = 0;
        if (e.bonus) B.reels.od = 1;
    },
    async seventh(e) { banner(`SEVENTH HEAVEN ×${e.mult}`, 'od', 900); sound.overdrive(); F.flash('#ffe14d', 0.3); await W(0.3); },
    async expand(e) {
        const R = B.reels;
        R.reels[e.reel].glow = 1;
        for (let r = 0; r < B.st.rows; r++) { const p = R.cellCenter(e.reel, r); F.burst(p.x, p.y, '#ffffff', 10, 200); }
        sound.shield();
        banner('EXPANDING WILD', 'info', 600);
        await W(0.25);
    },
    async grid(e) { B.reels.setGrid(e.grid); },

    async line(e) {
        const col = symColor(e.sym);
        B.reels.highlight(e.cells, col, 1.3);
        B.reels.trace(e.cells, col, 1.1);
        sound.line(e.chain, e.len);
        const end = B.reels.cellCenter(...e.cells[e.cells.length - 1]);
        const label = e.kind === 'cluster' ? `CLUSTER ${e.len}` : `${e.len}× ${SYMBOLS[e.sym].name.toUpperCase()}`;
        F.text(end.x, end.y - B.reels.cell * 0.35, label, { size: 15, color: col, life: 1, vy: -40 });
        for (const [c, r] of e.cells) { const p = B.reels.cellCenter(c, r); F.burst(p.x, p.y, col, 6, 160); }
        if (e.len >= 5) { banner(`FIVE OF A KIND!`, 'big', 900); F.flash(col, 0.3); F.shake(0.25); }
        if (e.chain >= 2) chainCounter(e.chain);
        await W(e.chain > 6 ? 0.16 : 0.26);
    },
    async loose(e) {
        const col = symColor(e.sym);
        B.reels.highlight(e.cells, col, 0.5);
        await W(0.05);
    },
    async echo(e) {
        B.reels.trace(e.cells, '#ffffff', 0.8);
        banner('ECHO', 'info', 600);
        await W(0.2);
    },
    async fire(e) { await fireFx(e); },

    async hit(e) {
        const ad = B.arena.enemies.get(e.id);
        if (!ad) return;
        const c = B.arena.enemyCenter(e.id);
        ad.hp = e.hp; ad.shield = e.shield;
        ad.flash = 1; ad.shake = Math.min(1, 0.3 + e.dmg / ad.maxHp);
        const col = e.sym === 'thorns' || e.sym === 'shield' ? '#4d8dff' : symColor(e.sym === 'overkill' ? 'blade' : e.sym === 'emp' ? 'arc' : e.sym);
        F.burst(c.x, c.y, col, e.crit ? 22 : 10, e.crit ? 340 : 240);
        F.burst(c.x, c.y, '#ffffff', 4, 200);
        if (e.absorbed > 0) { F.ring(c.x, c.y, '#4d8dff', ad.h * 0.6, 0.3); if (e.shield === 0) { F.shards(c.x, c.y, '#7fb0ff', 10); F.text(c.x, c.y - 30, 'SHIELD BROKEN', { size: 13, color: '#9cc4ff' }); } }
        const frac = e.dmg / ad.maxHp;
        const size = Math.min(54, 18 + frac * 60) * (e.crit ? 1.35 : 1);
        F.text(c.x, c.y - ad.h * 0.25, e.crit ? `${fmt(e.dmg)}!` : fmt(e.dmg), { size, color: e.crit ? '#ffe14d' : e.absorbed >= e.dmg ? '#9cc4ff' : '#ffffff', life: 1 });
        if (e.crit) { F.text(c.x, c.y - ad.h * 0.25 - size, 'CRIT', { size: 14, color: '#ff4d6d' }); F.hitstop(0.05); }
        if (frac > 0.3) { F.hitstop(0.06); F.shake(0.18); F.punch(0.5); }
        else F.shake(0.04);
        sound.hit(e.crit);
        await W(0.035);
    },

    async kill(e) {
        const ad = B.arena.enemies.get(e.id);
        if (!ad) return;
        const c = B.arena.enemyCenter(e.id);
        ad.dead = true; ad.deathT = 0;
        const big = e.boss ? 2.6 : e.elite ? 1.6 : 1;
        F.explosion(c.x, c.y, big, e.boss ? '#ff4d6d' : '#ffa53a');
        F.shards(c.x, c.y, '#5a6078', Math.round(14 * big));
        const tgt = domPoint('#b-loot');
        F.coins(c.x, c.y, Math.min(30, 6 + Math.round(e.bounty / Math.max(1, B.st.reward) / 3)), tgt.x, tgt.y);
        F.text(c.x, c.y - 40, `+${fmt(e.bounty)}`, { size: 16, color: '#ffd36a', vy: -50 });
        sound.kill(e.boss);
        setTimeout(() => sound.coins(6), 500);
        F.shake(e.boss ? 0.9 : 0.35);
        F.flash(e.boss ? '#ffffff' : '#ffa53a', e.boss ? 0.9 : 0.25);
        if (e.boss) { F.slowmo(1.2, 0.3); F.aberrate(1); banner('TARGET DESTROYED', 'win', 1600); }
        else sayBark('kill');
        B.arena.place();
        await W(e.boss ? 1.0 : 0.22);
    },
    async drop(e) {
        const c = B.arena.enemyCenter(e.id);
        const d = BOOSTERS[e.booster];
        F.text(c.x, c.y - 70, `+ ${d.name}`, { size: 14, color: d.color, life: 1.4, vy: -30 });
        const bt = domPoint(`#b-boosters .boost[data-id="${e.booster}"]`);
        await F.shoot(c.x, c.y, bt.x, bt.y, { color: d.color, size: 7, dur: 0.6, arc: 0.3 });
        sound.upgrade();
        refreshUi();
    },
    async gain(e) {
        const P = B.arena.player;
        const chest = B.arena.chest();
        const from = e.cells ? cellsCenter(e.cells) : null;
        if (e.what === 'shield') {
            if (from) await orbsTo(e.cells, chest, '#4d8dff', 0.22);
            P.shield = e.shield; P.bubble = 1;
            F.motes(chest.x, chest.y, '#9cc4ff', 12, P.h * 0.4, -20);
            F.text(chest.x, chest.y - P.h * 0.5, `+${fmt(e.amt)} SHIELD`, { size: 16, color: '#7fb0ff' });
            sound.shield();
            if (e.src === 'emergency') banner('EMERGENCY SHIELD', 'info', 900);
        } else if (e.what === 'heal') {
            if (from) await orbsTo(e.cells, chest, '#46ff9a', 0.22);
            P.hp = e.hp;
            F.motes(chest.x, chest.y + 20, '#46ff9a', 14, P.h * 0.3, -90);
            F.text(chest.x, chest.y - P.h * 0.5, `+${fmt(e.amt)}`, { size: 18, color: '#46ff9a' });
            sound.repair();
        } else if (e.what === 'energy') {
            const tgt = domPoint('#b-energy');
            if (from) await F.shoot(from.x, from.y, tgt.x, tgt.y, { color: '#ffe14d', size: 6, dur: 0.3 });
            sound.energy();
            B.st && refreshEnergy(e.energy);
            if (e.amt > 0) F.text(tgt.x, tgt.y - 20, `+${e.amt}⚡`, { size: 15, color: '#ffe14d', vy: -40 });
        } else if (e.what === 'scrap') {
            const tgt = domPoint('#b-loot');
            const p = from ?? { x: stage.w / 2, y: stage.h / 2 };
            F.coins(p.x, p.y, Math.min(24, 3 + (e.cells?.length ?? 6) * 2), tgt.x, tgt.y);
            F.text(p.x, p.y - 20, `+${fmt(e.amt)}`, { size: 15, color: '#ffd36a', vy: -40 });
            sound.coins(5);
            $('#b-loot').textContent = fmt(e.total);
            await W(0.08);
        }
    },
    async cascade(e) {
        const R = B.reels;
        for (const [c, r] of e.removed) { const p = R.cellCenter(c, r); F.shards(p.x, p.y, '#b0c8ff', 5, 200); F.burst(p.x, p.y, '#ffffff', 5, 180); }
        sound.glitch();
        await W(0.1);
        const byCol = {};
        for (const [c, r] of e.removed) (byCol[c] ??= []).push(r);
        R.clearWins();
        R.dimTarget = 0.5;
        for (let c = 0; c < B.st.cols; c++) {
            if (byCol[c]) R.drop(c, e.grid[c], byCol[c]);
            else R.setColumn(c, e.grid[c]);
        }
        banner(`CASCADE${e.n > 1 ? ` ×${e.n}` : ''}`, 'chain', 700);
        await W(0.38);
        sound.reelStop(1);
    },
    async overdrive(e) {
        banner(`OVERDRIVE <small>${e.spins} bonus spins · ×${e.mult} · enemies frozen</small>`, 'od', 1800);
        F.flash('#ff4dff', 0.7); F.aberrate(1); F.shake(0.5); F.punch(1);
        B.reels.od = 1; B.reels.celebrate = 1.5;
        B.arena.player.charge = 1;
        const P = B.arena.chest();
        F.ring(P.x, P.y, '#ff4dff', 220, 0.6, 6);
        sound.overdrive();
        setIntensity(2);
        sayBark('overdrive', true);
        await W(0.7);
    },
    async jackpot(e) {
        banner(`JACKPOT <small>${e.cores} CORES</small>`, 'jackpot', 2400);
        sound.jackpot();
        F.flash('#ffffff', 1); F.shake(1); F.slowmo(1.4, 0.4); F.aberrate(1); F.punch(1);
        B.reels.celebrate = 3;
        for (let i = 0; i < 6; i++) F.coins(stage.w * Math.random(), -10, 20, domPoint('#b-loot').x, domPoint('#b-loot').y);
        sayBark('jackpot', true);
        await W(0.9);
    },
    async streak(e) { F.text(B.reels.rect.x + B.reels.rect.w / 2, B.reels.rect.y - 22, `HOT STREAK ×${e.n}`, { size: 15, color: '#ff8a3d' }); },
    async spinTotal(e) {
        B.reels.dimTarget = 0;
        hide('#chain');
        if (!e.dmg) return;
        const r = e.dmg / Math.max(1, B.poolHp);
        let tier = null;
        if (r >= 1.6 || e.chain >= 10) tier = ['EPIC WIN', 3];
        else if (r >= 0.9 || e.chain >= 7) tier = ['MEGA WIN', 2];
        else if (r >= 0.45 || e.chain >= 4) tier = ['BIG WIN', 1];
        if (tier) {
            banner(`${tier[0]}<small><span class="count" data-to="${Math.round(e.dmg)}">0</span> damage</small>`, 'big', 1500 + tier[1] * 300);
            const n = document.querySelector('#banner .bn:last-child .count');
            if (n) countTo(n, e.dmg, 700);
            sound.bigWin(tier[1]);
            B.reels.celebrate = 1 + tier[1];
            F.flash('#ffe14d', 0.2 * tier[1]);
            if (e.chain >= 3) sayBark('bigChain');
            await W(0.35 + tier[1] * 0.15);
        } else if (e.chain >= 1) {
            F.text(B.reels.rect.x + B.reels.rect.w / 2, B.reels.rect.y - 26, `${fmt(e.dmg)} DAMAGE`, { size: 16, color: '#ffffff', vy: -30 });
        }
    },
    async victory() {
        B.reels.clearWins();
        banner(B.kind === 'boss' ? 'SECTOR CLEARED' : 'VICTORY', 'win', 1600);
        sound.victory();
        B.reels.celebrate = 2;
        sayBark('win', true);
        setIntensity(0);
        await W(0.5);
    },
    async defeat() {
        banner('FRAME DOWN', 'lose', 2000);
        sound.defeat();
        const P = B.arena.chest();
        F.explosion(P.x, P.y, 2, '#ff4d6d');
        F.shake(1); F.vignette('#ff0030', 1); F.slowmo(1.2, 0.3);
        setIntensity(0);
        await W(0.8);
    },
    async enemyPhase() {
        B.reels.clearWins();
        B.reels.od = Math.max(0, B.reels.od - 0.5);
        B.arena.player.charge = 0;
        await W(0.15);
    },
    async eact(e) {
        const ad = B.arena.enemies.get(e.id);
        if (!ad) return;
        ad.lunge = 1;
        if (e.k === 'atk') sound.enemyFire(e.heavy);
        await W(0.12);
    },
    async phit(e) {
        const P = B.arena.player;
        const chest = B.arena.chest();
        if (e.from >= 0 && B.arena.enemies.get(e.from)) {
            const s = B.arena.enemyCenter(e.from);
            await F.shoot(s.x, s.y, chest.x + 10, chest.y, { color: '#ff3355', size: 6, dur: 0.25, arc: 0.12 });
        }
        P.hp = e.hp; P.shield = e.shield;
        if (e.absorbed > 0) {
            P.bubble = 1;
            F.ring(chest.x, chest.y, '#7fb0ff', P.h * 0.6, 0.3, 4);
            F.burst(chest.x + P.h * 0.3, chest.y, '#9cc4ff', 12, 260, { dir: Math.PI, spread: 1 });
            F.text(chest.x, chest.y - P.h * 0.45, e.absorbed >= e.dmg ? 'BLOCKED' : `-${fmt(e.absorbed)}`, { size: 15, color: '#9cc4ff' });
        }
        const rest = e.dmg - e.absorbed;
        if (rest > 0) {
            P.flash = 1;
            F.burst(chest.x, chest.y, '#ff6a3a', 14, 260);
            F.text(chest.x - 20, chest.y - P.h * 0.3, `-${fmt(rest)}`, { size: Math.min(46, 18 + (rest / P.maxHp) * 80), color: '#ff4d6d' });
            F.shake(Math.min(0.7, 0.15 + (rest / P.maxHp) * 1.5));
            F.vignette('#ff0030', Math.min(1, 0.3 + rest / P.maxHp * 2));
            if (rest / P.maxHp > 0.15) F.hitstop(0.05);
        }
        sound.phit(e.absorbed > 0 && rest === 0);
        if (e.hp > 0 && e.hp < P.maxHp * 0.25) sayBark('lowHp', true);
        await W(0.12);
    },
    async charge(e) {
        const c = B.arena.enemyCenter(e.id);
        F.glow(c.x, c.y, '#ffe14d', 50, 0.5);
        F.text(c.x, c.y - 50, e.k === 'aim' ? 'AIMING' : 'CHARGING', { size: 12, color: '#ffe14d' });
        await W(0.15);
    },
    async eshield(e) {
        const ad = B.arena.enemies.get(e.id);
        if (!ad) return;
        ad.shield = e.shield;
        const c = B.arena.enemyCenter(e.id);
        F.ring(c.x, c.y, '#4d8dff', ad.h * 0.6, 0.5, 4);
        F.text(c.x, c.y - 40, `+${fmt(e.amt)}`, { size: 14, color: '#7fb0ff' });
        sound.shield();
        await W(0.1);
    },
    async eheal(e) {
        const ad = B.arena.enemies.get(e.id);
        if (!ad) return;
        ad.hp = e.hp;
        const c = B.arena.enemyCenter(e.id);
        F.motes(c.x, c.y, '#46ff9a', 10, 30, -60);
        F.text(c.x, c.y - 40, `+${fmt(e.amt)}`, { size: 14, color: '#46ff9a' });
        await W(0.1);
    },
    async jam(e) {
        const s = B.arena.enemyCenter(e.id);
        const R = B.reels;
        for (const c of e.reels) {
            const p = R.cellCenter(c, 0);
            F.bolt(s.x, s.y, p.x, R.rect.y + 6, '#ff3355', 0.35, 3);
            R.reels[c].lockNext = true;
            R.reels[c].shake = 1;
        }
        sound.jam();
        F.shake(0.2);
        if (e.zero) banner('ZERO VARIANCE', 'phase', 1200);
        else if (e.tide) banner('THE TIDE RISES', 'phase', 900);
        sayBark('jam');
        await W(0.3);
    },
    async glitch(e) {
        const s = B.arena.enemyCenter(e.id);
        const R = B.reels;
        const cols = [...new Set(e.spots.map(([c]) => c))];
        for (const c of cols) { const p = R.cellCenter(c, Math.floor(B.st.rows / 2)); F.bolt(s.x, s.y, p.x, p.y, '#c46bff', 0.3, 2); F.burst(p.x, p.y, '#c46bff', 8, 160); R.reels[c].shake = 0.8; }
        sound.glitch();
        if (e.certainty) banner('CERTAINTY', 'phase', 1000);
        if (e.spots.length) F.text(s.x, s.y - 50, `+${e.spots.length} GLITCH`, { size: 13, color: '#c46bff' });
        sayBark('glitch');
        await W(0.3);
    },
    async drain(e) {
        const s = B.arena.enemyCenter(e.id);
        const p = domPoint('#b-energy');
        if (e.amt > 0) { F.shoot(p.x, p.y, s.x, s.y, { color: '#ffe14d', size: 5, dur: 0.4 }); F.text(p.x, p.y - 20, `-${e.amt}⚡`, { size: 15, color: '#ff8a3d' }); }
        sound.drain();
        refreshEnergy(e.energy);
        await W(0.2);
    },
    async summon(e) {
        const d = B.arena.addEnemy(e.enemy, true);
        B.arena.place();
        const c = { x: d.tx, y: d.ty - d.h * 0.5 };
        F.ring(c.x, c.y, '#ff3355', d.h, 0.5, 4);
        F.burst(c.x, c.y, '#ff3355', 16, 220);
        sound.phase();
        await W(0.25);
    },
    async phase(e) {
        const c = B.arena.enemyCenter(e.id);
        F.flash('#ff3355', 0.6); F.shake(0.6); F.aberrate(1);
        F.ring(c.x, c.y, '#ff3355', 260, 0.8, 8);
        sound.phase();
        banner(e.line ? `<small>${e.line}</small>` : 'PHASE SHIFT', 'phase', 2200);
        await W(0.8);
    },
    async explode(e) {
        const c = B.arena.enemyCenter(e.id);
        F.explosion(c.x, c.y, 1.8, '#ff6a3a');
        banner('VOLATILE!', 'phase', 700);
        await W(0.2);
    },
    async turn(e) {
        B.reels.od = e.overdrive > 0 ? 1 : 0;
        B.arena.player.shield = e.shield;
        refreshEnergy(e.energy);
        if (!e.bonus) setIntensity(B.kind === 'boss' ? 1 : 0);
        for (const c of e.locks) { B.reels.reels[c].lockNext = true; }
    },
};

function refreshEnergy(v) {
    const en = $('#b-energy');
    [...en.children].forEach((pip, i) => { pip.className = i < v ? 'on' : ''; });
}

function chainCounter(n) {
    const c = $('#chain');
    c.innerHTML = `CHAIN <b>×${n}</b>`;
    c.className = `chain lv${Math.min(5, Math.floor(n / 2))}`;
    void c.offsetWidth;
    c.classList.add('pop');
    sound.chainUp(n);
    F.shake(0.03 * Math.min(6, n));
}

function countTo(node, to, ms) {
    const t0 = performance.now();
    const step = (t) => {
        const u = Math.min(1, (t - t0) / ms);
        node.textContent = fmt(to * (1 - Math.pow(1 - u, 3)));
        if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

async function orbsTo(cells, to, color, dur) {
    const ps = cells.slice(0, 6).map(([c, r], i) => {
        const p = B.reels.cellCenter(c, r);
        return F.shoot(p.x, p.y, to.x, to.y, { color, size: 5, dur, delay: i * 0.02, arc: 0.18 });
    });
    await Promise.all(ps);
}

/** Symbols fly up from the reels into the frame, then it fires. */
async function fireFx(e) {
    const A = B.arena;
    const P = A.player;
    const targets = e.targets.filter((id) => A.enemies.get(id));
    if (!targets.length) return;
    const col = e.sym === 'emp' ? '#7fe8ff' : symColor(e.sym);
    const loose = e.kind === 'loose';
    if (e.cells?.length && e.kind !== 'twin' && e.kind !== 'volley') await orbsTo(e.cells, A.chest(), col, loose ? 0.16 : 0.2);
    const big = e.kind === 'line' || e.kind === 'echo' || e.kind === 'jackpot';
    switch (e.sym) {
        case 'blade':
        case 'wild': {
            const t = A.enemyCenter(targets[0]);
            P.slash = 1;
            const m = A.muzzle();
            F.beam(m.x, m.y, t.x, t.y, '#45f3ff', big ? 5 : 3, 0.12);
            F.slash(t.x, t.y, A.enemies.get(targets[0]).h * (big ? 0.55 : 0.4), '#45f3ff');
            sound.blade();
            await W(0.08);
            break;
        }
        case 'cannon': {
            const t = A.enemyCenter(targets[0]);
            const m = A.muzzle();
            P.recoil = 1;
            F.glow(m.x, m.y, '#ffa53a', big ? 46 : 30, 0.15);
            sound.cannon();
            await F.shoot(m.x, m.y, t.x, t.y, { color: '#ffd08a', size: big ? 7 : 5, dur: 0.14, arc: 0.02, kind: 'shell' });
            F.beam(m.x, m.y, t.x, t.y, '#ffa53a', big ? 4 : 2, 0.1);
            if (big) F.shake(0.12);
            break;
        }
        case 'missile': {
            const pod = A.pod();
            sound.missile();
            const n = big ? 2 : 1;
            const shots = [];
            targets.forEach((id, i) => {
                const t = A.enemyCenter(id);
                for (let k = 0; k < n; k++) shots.push(F.shoot(pod.x, pod.y, t.x, t.y, { color: '#ff7a5a', size: 5, dur: 0.45, delay: (i * n + k) * 0.05, arc: 0.4, lift: 120, kind: 'missile', side: -1 }));
            });
            await Promise.all(shots);
            for (const id of targets) { const t = A.enemyCenter(id); F.explosion(t.x, t.y, big ? 0.8 : 0.5, '#ff6a3a'); }
            F.shake(big ? 0.25 : 0.1);
            break;
        }
        case 'arc': {
            const m = A.muzzle();
            let prev = m;
            sound.arc();
            for (const id of targets) {
                const t = A.enemyCenter(id);
                F.bolt(prev.x, prev.y, t.x, t.y, '#b98cff', 0.3, big ? 3 : 2);
                F.burst(t.x, t.y, '#d8c0ff', 8, 200);
                prev = t;
                await W(0.05);
            }
            break;
        }
        case 'core': {
            // the Jackpot: a beam from the heavens on every target
            for (const id of targets) {
                const t = A.enemyCenter(id);
                F.beam(t.x, A.rect.y - 40, t.x, t.y, '#ff4dff', 26, 0.6);
                F.explosion(t.x, t.y, 1.6, '#ff4dff');
            }
            F.flash('#ff4dff', 0.8);
            await W(0.2);
            break;
        }
        case 'emp': {
            const c = A.chest();
            F.ring(c.x, c.y, '#7fe8ff', stage.w * 0.6, 0.6, 8);
            F.flash('#7fe8ff', 0.4);
            sound.arc();
            await W(0.2);
            break;
        }
        case 'energy': {
            const t = A.enemyCenter(targets[0]);
            const m = A.muzzle();
            F.beam(m.x, m.y, t.x, t.y, '#ffe14d', 8, 0.3);
            sound.energy();
            banner('OVERHEAT VENT', 'info', 600);
            await W(0.1);
            break;
        }
        default: {
            const t = A.enemyCenter(targets[0]);
            const c = A.chest();
            F.beam(c.x, c.y, t.x, t.y, '#4d8dff', 4, 0.2);
            await W(0.06);
        }
    }
}

// ------------------------------------------------------------------ debug

/** Test hook: end the fight as a win or a loss through the normal end path. */
export function debugEnd(win) {
    if (!B.active || B.ended || B.busy) return false;
    const st = B.st;
    if (win) {
        for (const e of st.enemies) e.hp = 0;
        st.phase = 'won';
        play([{ t: 'victory', loot: st.loot }]);
    } else {
        st.player.hp = 0;
        st.phase = 'lost';
        play([{ t: 'defeat' }]);
    }
    return true;
}
