/**
 * battle.js — one combat, from the player's side of the table.
 *
 * The simulation (sim/combat.js) resolves every action instantly and leaves a
 * list of events. This module is the "director": it plays those events back
 * one at a time — card flights, line flares, motes streaming to their target,
 * hits, deaths, curses — each handler returning how long to wait before the
 * next. Input is accepted only while the queue is empty, and when it drains
 * the whole view is reconciled with the true state.
 */

import * as THREE from 'three';
import * as C from './sim/combat.js';
import * as R from './sim/run.js';
import { HANDS, SUIT_INFO } from './sim/rules.js';
import { ARCANA, cardName } from './sim/cards.js';
import { ELIXIRS } from './sim/relics.js';
import { view, px2card, card2px, gradePass } from './view/scene.js';
import * as K from './view/cards3d.js';
import { stage, setMode, clearCreatures, addCreature, creature, creaturePx, heroPx, markDying, pickCreature, kickShake, arrange } from './view/stage.js';
import { burst, motes, beam, worldBurst, worldRise, worldRing } from './view/fx.js';
import * as H from './ui/hud.js';
import { $, el, floatNum, banner, toast, cardTipHTML, showTip, hideTip } from './ui/dom.js';
import { sfx, setMusic } from './audio/audio.js';

let B = null;
const post = { flash: new THREE.Vector3(), aberr: 0, dim: 0 };

export function battleActive() { return !!B; }
export function battleState() { return B?.st ?? null; }

export function flash(r, g, b, a = 1) { post.flash.set(post.flash.x + r * a, post.flash.y + g * a, post.flash.z + b * a); }

export function startBattle(run, { onEnd, settings }) {
    const st = C.createCombat(R.combatOptions(run));
    B = {
        st, run, onEnd, settings, queue: [], wait: 0.35, visHand: [], selected: -1, press: null, drag: null,
        arc: null, cursor: 12, hoverCell: -1, ended: false, endT: 0, synced: false, tutorial: run.stats.lines === 0 && run.world === 0,
        tutStep: 0,
    };
    setMode('combat');
    clearCreatures();
    for (const e of st.enemies) addCreature(e, { spawn: true });
    arrange(true);
    K.clearAllCards();
    K.setTableVisible(true);
    K.computeLayout();
    H.showCombatUI(true);
    H.buildPlates(st, (eid) => doTarget(eid));
    H.setHp(st.player.hp, st.player.maxHp);
    H.setWard(0);
    H.renderPlayerStatus(st.player.st);
    H.renderElixirs(run, (i) => useElixirSlot(i));
    const boss = st.enemies.some((e) => e.boss);
    setMusic(run.world, boss ? 'boss' : 'battle');
    if (boss) { banner(st.enemies[0].name, st.enemies[0].title ?? '', 'enemy'); sfx.phase(); }
    else if (st.kind === 'elite') banner('Elite', st.enemies[0].name + (st.enemies[0].title ? ' ' + st.enemies[0].title : ''), 'enemy');
    pull();
    $('btn-end').onclick = () => { sfx.click(); doEndTurn(); };
    $('btn-redraw').onclick = () => { sfx.click(); if (B.selected >= 0) doRedraw(B.selected); else H.hint('Select a card in your hand first.'); };
    $('btn-cast').onclick = () => { sfx.click(); castSelected(); };
    return st;
}

export function endBattle() {
    if (!B) return;
    K.clearAllCards();
    K.setTableVisible(false);
    K.clearCellFx('hover'); K.clearCellFx('seal'); K.clearCellFx('frost'); K.clearCellFx('threat');
    H.showCombatUI(false);
    $('preview').classList.add('hidden');
    $('suit-pick').classList.add('hidden');
    $('cast-bar').classList.add('hidden');
    clearCreatures();
    B = null;
}

// ------------------------------------------------------------------ helpers

function pull() {
    if (!B) return;
    B.queue.push(...B.st.events);
    B.st.events.length = 0;
    B.synced = false;
}
const idle = () => B && !B.queue.length && B.wait <= 0 && !B.ended;
const canAct = () => idle() && B.st.phase === 'player';

function findCard(uid) {
    const st = B.st;
    for (const z of [st.hand, st.discard, st.draw, st.exhaust]) { const c = z.find((x) => x.uid === uid); if (c) return c; }
    for (const b of st.board) if (b.card?.uid === uid) return b.card;
    return null;
}

function layoutVisHand() {
    const cards = B.visHand.map((u) => findCard(u) ?? K.getView(u)?.card).filter(Boolean);
    K.layoutHand(cards);
}

function toCardXY(px) { return px2card(px.x, px.y); }
function enemyTargetXY(eid) {
    const p = H.plateAnchor(eid) ?? creaturePx(eid, 'mid');
    return p ? toCardXY({ x: p.x, y: p.y + 30 }) : { x: 0, y: view.h / 2 };
}
function heroTargetXY() {
    const p = heroPx('mid');
    if (p && !view.portrait) return toCardXY(p);
    const r = $('hp-bar').getBoundingClientRect();
    return toCardXY({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
}
function hudHpPx() { const r = $('hp-bar').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 14 }; }
function heroNumPx() { return (!view.portrait && heroPx('top')) || hudHpPx(); }

function worldPosOf(eid, frac = 0.55) {
    const c = creature(eid);
    if (!c) return null;
    const p = c.root.position.clone();
    p.y += c.top * frac;
    return p;
}

// ------------------------------------------------------------------ the director

export function updateBattle(dt) {
    // post effects decay regardless
    post.flash.multiplyScalar(Math.exp(-dt * 5));
    post.aberr *= Math.exp(-dt * 4);
    gradePass.uniforms.uFlash.value.copy(post.flash);
    gradePass.uniforms.uAberr.value = post.aberr;
    if (!B) return;
    const speed = Number(B.settings.speed ?? 1) * (B.fast ? 2.5 : 1);
    if (B.wait > 0) B.wait -= dt * speed;
    let guard = 0;
    while (B.wait <= 0 && B.queue.length && guard++ < 60) {
        const ev = B.queue.shift();
        B.wait += handle(ev) || 0;
    }
    if (!B.queue.length && B.wait <= 0 && !B.synced) sync();
    H.positionPlates();
    if (!B.queue.length && B.wait <= 0 && (B.st.phase === 'won' || B.st.phase === 'lost') && !B.ended) {
        B.endT += dt;
        if (B.endT > 0.9) {
            B.ended = true;
            const res = C.combatResult(B.st);
            const cb = B.onEnd;
            cb(res, B.st);
        }
    }
    updateHoverFx();
}

function sync() {
    const st = B.st;
    B.synced = true;
    B.visHand = st.hand.map((c) => c.uid);
    if (B.selected >= st.hand.length) B.selected = -1;
    K.handState.selected = B.selected;
    K.reconcile(st);
    K.syncBoardFx(st, C.threatenedCells(st));
    for (const e of st.enemies) H.disp.enemies.set(e.eid, { hp: e.hp, maxHp: e.maxHp, ward: e.ward });
    H.renderAllPlates(st, { fromDisp: false });
    H.setHp(st.player.hp, st.player.maxHp);
    H.setWard(st.player.ward);
    H.setGold(st.gold);
    H.renderPlayerStatus(st.player.st);
    H.renderTurnPanel(st, false);
    H.renderElixirs(B.run.elixirs ? { ...B.run, elixirs: st.elixirs } : B.run, (i) => useElixirSlot(i));
    for (const e of st.enemies) creature(e.eid)?.setTargeted(e.eid === C.currentTarget(st)?.eid);
    updateCastBar();
    tutorial();
}

function handle(ev) {
    const st = B.st;
    const T = K;
    switch (ev.type) {
        case 'combatStart': return 0;
        case 'turnStart':
            B.visHand = B.visHand.filter((u) => st.hand.some((c) => c.uid === u) || findCard(u));
            banner(`Turn ${ev.turn}`, 'Your move', 'turn');
            sfx.turn();
            H.setWard(st.turn === ev.turn ? H.disp.ward : 0);
            return 0.45;
        case 'draw': {
            const c = findCard(ev.uid);
            if (!c) return 0;
            const d = T.pilePos('deck');
            const v = T.spawnCard(c, d.x, d.y, { faceDown: true });
            v.at(d.x, d.y, 30, Math.PI, 0, T.layout.hand.cw * 0.8 / T.layout.cw);
            if (!B.visHand.includes(ev.uid)) B.visHand.push(ev.uid);
            layoutVisHand();
            v.fly(0.38, 90);
            sfx.draw();
            return 0.07;
        }
        case 'reshuffle':
            sfx.shuffle();
            floatNum(T.layout.deck.x, T.layout.deck.y - 60, 'Reshuffled', 'status');
            return 0.3;
        case 'place': {
            const c = findCard(ev.uid);
            let v = T.getView(ev.uid);
            if (!v && c) v = T.spawnCard(c, 0, 0);
            if (v) { T.toCell(v, ev.cell); v.pulse = 1; }
            B.visHand = B.visHand.filter((u) => u !== ev.uid);
            layoutVisHand();
            sfx.place();
            const p = T.cellPos(ev.cell);
            burst(p.x, p.y, 0xd8c8a0, 10, { speed: 140, size: 7, life: 0.4 });
            return 0.14;
        }
        case 'redraw': {
            const v = T.getView(ev.uid);
            if (v) T.toPile(v, 'discard', { dur: 0.3 });
            B.visHand = B.visHand.filter((u) => u !== ev.uid);
            layoutVisHand();
            sfx.redraw();
            return 0.1;
        }
        case 'fire': return fireLine(ev);
        case 'hitEnemy': {
            const c = creature(ev.eid);
            const d = H.disp.enemies.get(ev.eid);
            if (d) { d.hp = ev.hp; d.ward = Math.max(0, d.ward - ev.blocked); }
            const e = C.enemyByEid(st, ev.eid);
            if (e) H.renderPlate(st, e);
            const p = creaturePx(ev.eid, 'mid');
            const big = ev.loss >= 40 || (e && ev.loss >= e.maxHp * 0.3);
            if (c && ev.source !== 'burn') c.hit(big ? 2 : 1);
            if (p) {
                if (ev.loss > 0) floatNum(p.x + (Math.random() - 0.5) * 50, p.y, String(ev.loss), big ? 'big' : ev.source === 'burn' ? 'status' : 'dmg');
                if (ev.blocked > 0) floatNum(p.x + 30, p.y - 30, `⛨${ev.blocked}`, 'blocked');
            }
            const wp = worldPosOf(ev.eid);
            if (wp && ev.source !== 'burn') worldBurst(wp, ev.source === 'staves' ? SUIT_INFO.C.hex : ev.source === 'blades' ? 0xffffff : 0xffa040, big ? 40 : 18, { speed: big ? 6 : 4 });
            if (ev.source === 'blades') { sfx.blades(); sfx.hitEnemy(big); } else if (ev.source === 'staves') sfx.staves(); else if (ev.source === 'burn') sfx.hitEnemy(false); else sfx.hitEnemy(big);
            if (big) { kickShake(0.35); post.aberr += 0.6; }
            return ev.source === 'staves' ? 0.06 : ev.source === 'burn' ? 0.25 : 0.14;
        }
        case 'thorns': return 0;
        case 'death': {
            markDying(ev.eid);
            const wp = worldPosOf(ev.eid);
            if (wp) { worldBurst(wp, creature(ev.eid)?.look.glow ?? 0xffffff, ev.boss ? 120 : 60, { speed: 7, size: 7, life: 1.3 }); worldRing(wp, 0xffd070, { size: 6 }); }
            sfx.death(ev.boss);
            if (ev.boss) { kickShake(1); flash(1, 0.9, 0.6, 0.5); }
            const e = C.enemyByEid(st, ev.eid);
            if (e) { const d = H.disp.enemies.get(ev.eid); if (d) d.hp = 0; H.renderPlate(st, e); }
            setTimeout(() => arrange(), 900);
            return ev.boss ? 1.4 : 0.45;
        }
        case 'flee': markDying(ev.eid); return 0.15;
        case 'clear':
            for (const uid of ev.uids) {
                const v = T.getView(uid);
                if (!v) continue;
                const col = T.suitColor(v.card.suit);
                burst(v.pos.x, v.pos.y, col, 14, { speed: 320, size: 11, life: 0.6 });
                T.toPile(v, 'discard', { dur: 0.35, delay: Math.random() * 0.08 });
            }
            return 0.22;
        case 'vanish': { const v = T.getView(ev.uid); if (v) { burst(v.pos.x, v.pos.y, 0xb0a0ff, 16, { speed: 200 }); T.removeCard(ev.uid); } B.visHand = B.visHand.filter((u) => u !== ev.uid); return 0.05; }
        case 'shatter': { const v = T.getView(ev.uid); if (v) burst(v.pos.x, v.pos.y, 0xc8f4ff, 40, { speed: 420, size: 8 }); toast('A Glass card shattered!'); return 0.15; }
        case 'ward': {
            if (ev.who === 'player') {
                H.setWard(ev.total);
                const p = heroNumPx();
                floatNum(p.x, p.y, `+${ev.n} Ward`, 'ward');
                sfx.ward();
                const hp = stage.hero && stage.hero.root.visible ? stage.hero.root.position : null;
                if (hp) worldRing(hp, SUIT_INFO.D.hex, { size: 3.5 });
            } else {
                const d = H.disp.enemies.get(ev.who);
                if (d) d.ward = ev.total;
                const e = C.enemyByEid(st, ev.who);
                if (e) H.renderPlate(st, e);
                const p = creaturePx(ev.who, 'mid');
                if (p) floatNum(p.x, p.y - 20, `+${ev.n} Ward`, 'ward');
                sfx.ward();
            }
            return 0.12;
        }
        case 'healPlayer': {
            H.setHp(ev.hp, st.player.maxHp);
            const p = heroNumPx();
            floatNum(p.x, p.y + 20, `+${ev.n}`, 'heal');
            sfx.heal();
            if (stage.hero?.root.visible) worldRise(stage.hero.root.position, 0x70ff90, 24);
            return ev.why === 'regen' ? 0.25 : 0.14;
        }
        case 'healEnemy': {
            const d = H.disp.enemies.get(ev.eid);
            if (d) d.hp = ev.hp;
            const e = C.enemyByEid(st, ev.eid);
            if (e) H.renderPlate(st, e);
            const p = creaturePx(ev.eid, 'mid');
            if (p) floatNum(p.x, p.y, `+${ev.n}`, 'heal');
            const wp = worldPosOf(ev.eid, 0.1);
            if (wp) worldRise(wp, 0x70ff90, 20);
            return 0.2;
        }
        case 'status': {
            if (ev.who === 'player') {
                H.renderPlayerStatus(st.player.st);
            } else {
                const e = C.enemyByEid(st, ev.who);
                if (e) H.renderPlate(st, e);
                const p = creaturePx(ev.who, 'top');
                if (p && ev.v > 0) floatNum(p.x, p.y + 50, `${C.stName(ev.key)} ${ev.v}`, 'status');
            }
            return 0.08;
        }
        case 'turnEnd':
            banner('Enemy Turn', '', 'turn enemy');
            sfx.endTurn();
            B.selected = -1; K.handState.selected = -1;
            layoutVisHand();
            return 0.55;
        case 'enemyAct': {
            const c = creature(ev.eid);
            const attack = ['attack', 'multi', 'attackDebuff', 'drain', 'tax'].includes(ev.t) || (ev.t === 'steal' || ev.t === 'frost');
            if (c) { if (attack) c.lunge(c.root.position.x > 0 ? 1 : -1); else c.cast(); }
            const p = creaturePx(ev.eid, 'top');
            if (p && ev.move) floatNum(p.x, p.y + 30, ev.move, 'status');
            if (attack) sfx.enemyAttack(); else if (['seal', 'ash', 'scramble', 'mirage', 'flood', 'void', 'frost'].includes(ev.t)) sfx.curse(); else sfx.enemyCast();
            return 0.42;
        }
        case 'hitPlayer': {
            H.setHp(ev.hp, st.player.maxHp);
            H.setWard(Math.max(0, H.disp.ward - ev.blocked));
            const p = heroNumPx();
            if (ev.loss > 0) floatNum(p.x + (Math.random() - 0.5) * 40, p.y + 10, `-${ev.loss}`, 'player');
            if (ev.blocked > 0) floatNum(p.x + 40, p.y - 20, `⛨${ev.blocked}`, 'blocked');
            stage.hero?.hit();
            if (ev.loss > 0) { sfx.hitPlayer(); kickShake(Math.min(1, 0.25 + ev.loss / st.player.maxHp * 2)); flash(0.5, 0, 0, Math.min(1, 0.3 + ev.loss / st.player.maxHp)); post.aberr += 0.5; } else sfx.blocked();
            return 0.22;
        }
        case 'seal': for (const i of ev.cells) T.setCellFx(i, 'seal', true); sfx.seal(); return 0.35;
        case 'unseal': T.setCellFx(ev.cell, 'seal', false); return 0;
        case 'frost': for (const i of ev.cells) T.setCellFx(i, 'frost', true); sfx.frost(); return 0.3;
        case 'thaw': T.setCellFx(ev.cell, 'frost', false); return 0;
        case 'steal': {
            const v = T.getView(ev.uid);
            if (v) { const t = enemyTargetXY(ev.eid); v.to(t.x, t.y, 200, { s: 0.3, rz: 3 }); v.fly(0.45, 120); v.removeAt = 0.5; }
            sfx.curse();
            return 0.45;
        }
        case 'scramble': {
            ev.board.forEach((uid, i) => { if (uid) { const v = T.getView(uid); if (v && (v.cell !== i || v.zone !== 'table')) T.toCell(v, i); } });
            sfx.shuffle();
            return 0.45;
        }
        case 'mirage':
            for (const ch of ev.changes) { const v = T.getView(ch.uid); if (v) { v.setCard(v.card); v.pulse = 1; v.rot.y = Math.PI; burst(v.pos.x, v.pos.y, 0xffffff, 10, { speed: 160 }); } }
            sfx.shuffle();
            return 0.35;
        case 'wipe': {
            for (const uid of ev.uids) { const v = T.getView(uid); if (v) { burst(v.pos.x, v.pos.y, ev.how === 'flood' ? 0x40d0ff : 0x8040ff, 22, { speed: 300 }); T.toPile(v, 'discard', { dur: 0.4 }); } }
            banner(ev.how === 'flood' ? 'The Tide Rises' : 'The Void Hungers', 'a line is lost', 'enemy');
            sfx.curse();
            kickShake(0.4);
            return 0.7;
        }
        case 'ashed':
            floatNum(T.layout.discard.x, T.layout.discard.y - 70, `+${ev.n} Ash`, 'status');
            burst(T.pilePos('discard').x, T.pilePos('discard').y, 0x888080, 30, { speed: 200 });
            return 0.35;
        case 'summon': {
            const e = C.enemyByEid(st, ev.eid);
            if (e) { addCreature(e, { spawn: true }); H.addPlate(st, e, (eid) => doTarget(eid)); }
            sfx.enemyCast();
            return 0.5;
        }
        case 'phase': {
            banner(ev.name, C.enemyByEid(st, ev.eid)?.name ?? '', 'enemy');
            sfx.phase();
            kickShake(0.8);
            flash(0.6, 0.2, 0.1, 0.6);
            const wp = worldPosOf(ev.eid, 0.2);
            if (wp) worldRing(wp, 0xff6040, { size: 9, life: 0.9 });
            const e = C.enemyByEid(st, ev.eid);
            if (e) { const d = H.disp.enemies.get(ev.eid); if (d) d.ward = e.ward; H.renderPlate(st, e); }
            return 1.3;
        }
        case 'charge': { const p = creaturePx(ev.eid, 'mid'); if (p) floatNum(p.x, p.y, 'Gathering…', 'status'); return 0.2; }
        case 'fizzle': { const p = creaturePx(ev.eid, 'mid'); if (p) floatNum(p.x, p.y, 'Fizzles', 'status'); return 0.15; }
        case 'gold': { H.setGold(B.run.gold + st.goldGained - st.goldLost); const p = hudHpPx(); floatNum(p.x + 140, p.y, `+${ev.n}g`, 'gold'); sfx.gold(); return 0.04; }
        case 'goldLost': { H.setGold(B.run.gold + st.goldGained - st.goldLost); const p = creaturePx(ev.eid, 'mid'); if (p) floatNum(p.x, p.y, `-${ev.n} gold`, 'gold'); sfx.curse(); return 0.3; }
        case 'arcana': {
            const v = T.getView(ev.uid);
            const c = v?.card;
            B.visHand = B.visHand.filter((u) => u !== ev.uid);
            layoutVisHand();
            if (v) {
                const ctr = px2card(T.layout.tableCx, T.layout.tableCy);
                v.to(ctr.x, ctr.y, 300, { s: 2.2 });
                v.glowTarget = 1; v.glowColor.set(0xb8a0ff);
                v.removeAt = 0.7;
                setTimeout(() => burst(v.pos.x, v.pos.y, 0xc0a0ff, 50, { speed: 420, size: 12 }), 450);
            }
            if (c) banner(ARCANA[c.id].name + (c.up ? '+' : ''), ARCANA[c.id].text(c.up ? ARCANA[c.id].un : ARCANA[c.id].n), 'turn');
            sfx.arcana();
            stage.hero?.cast();
            return 0.6;
        }
        case 'exhaust': return 0;
        case 'conjure': {
            const c = findCard(ev.uid);
            if (c) {
                const ctr = px2card(T.layout.tableCx, T.layout.tableCy);
                T.spawnCard(c, ctr.x, ctr.y, { z: 200 });
                if (!B.visHand.includes(ev.uid)) B.visHand.push(ev.uid);
                layoutVisHand();
            }
            sfx.arcana();
            return 0.25;
        }
        case 'deals': { const p = { x: view.w - 120, y: view.h * 0.55 }; floatNum(p.x, p.y, `+${ev.n} Deal${ev.n > 1 ? 's' : ''}`, 'gold'); return 0.15; }
        case 'swap': for (const i of ev.cells) { const b = st.board[i].card; const v = b && T.getView(b.uid); if (v) T.toCell(v, i); } sfx.shuffle(); return 0.3;
        case 'ascend': { const v = T.getView(ev.uid); if (v) { v.setCard(v.card); v.pulse = 1; burst(v.pos.x, v.pos.y, 0xffe080, 20, { speed: 180 }); } sfx.relic(); return 0.3; }
        case 'sweep': { const v = T.getView(ev.uid); if (v) { burst(v.pos.x, v.pos.y, 0xffffff, 16); T.toPile(v, 'discard'); } return 0.25; }
        case 'favour': { floatNum(view.w / 2, view.h * 0.35, 'Next line ×2', 'gold'); return 0.2; }
        case 'elixir': {
            sfx.elixir();
            const E = ELIXIRS[ev.id];
            banner(E.name, E.text(st.world), 'turn');
            H.renderElixirs({ ...B.run, elixirs: st.elixirs }, (i) => useElixirSlot(i));
            return 0.35;
        }
        case 'storm': banner('Crown of Storms', 'lightning answers the Cross', 'turn'); flash(0.4, 0.4, 0.8, 0.5); return 0.35;
        case 'revive': banner('The Phoenix Rises', '', 'turn'); H.setHp(ev.hp, st.player.maxHp); flash(1, 0.6, 0.2, 0.7); sfx.relic(); return 1.0;
        case 'target':
            for (const e of st.enemies) { creature(e.eid)?.setTargeted(e.eid === ev.eid); H.renderPlate(st, e); }
            return 0;
        case 'intents': H.renderAllPlates(st); return 0;
        case 'win':
            banner('Victory', '', '');
            sfx.victory();
            setMusic(B.run.world, 'victory');
            return 0.8;
        case 'lose':
            banner('Fallen', 'the cards slip from your hand', 'enemy');
            sfx.defeat();
            setMusic(B.run.world, 'defeat');
            return 1.2;
        default: return 0;
    }
}

function fireLine(ev) {
    const T = K;
    const st = B.st;
    const tier = HANDS[ev.hand].tier;
    const color = ev.hand === 'royalFlush' ? 0xffffff : T.suitColor(ev.per.reduce((best, p) => (p.chips > (best?.chips ?? -1) ? p : best), null)?.suit ?? 'S');
    // flare the line's cards
    ev.per.forEach((p, k) => {
        const v = T.getView(p.uid);
        if (!v) return;
        v.glowTarget = 1;
        v.glowColor.set(T.suitColor(p.suit));
        v.to(v.t.x, v.t.y, 60, { s: 1.12 });
        setTimeout(() => {
            v.pulse = 1;
            const px = card2px(v.pos.x, v.pos.y);
            if (p.chips > 0) floatNum(px.x, px.y - 20, `+${p.chips}`, 'chip');
            sfx.chip(k + tier);
        }, k * 70);
    });
    const a = T.cellPos(ev.cells[0]), b = T.cellPos(ev.cells[ev.cells.length - 1]);
    beam(a.x, a.y, b.x, b.y, color, { width: T.layout.cw * 0.9, life: 0.7 });
    const bon = ev.bonuses.length ? ` · ${ev.bonuses.join(' · ')}` : '';
    banner(`${ev.reap ? 'Reap: ' : ''}${ev.name}`, `×${Math.round(ev.mult * 100) / 100}${bon}`, ev.hand === 'royalFlush' ? 'royal' : '');
    sfx.fire(tier);
    stage.hero?.cast();
    if (tier >= 6) { flash(0.5, 0.42, 0.2, 0.35 + (tier - 6) * 0.12); post.aberr += 0.4; }
    if (tier >= 8) kickShake(0.5);
    // motes: each card streams toward what its suit does
    const tgt = ev.target;
    const alive = st.enemies.filter((e) => e.alive || H.disp.enemies.get(e.eid)?.hp > 0);
    setTimeout(() => {
        ev.per.forEach((p, k) => {
            if (!p.chips || !p.suit) return;
            const v = T.getView(p.uid);
            if (!v) return;
            const n = Math.min(10, 3 + Math.round(p.chips / 4));
            const col = T.suitColor(p.suit);
            if (p.suit === 'S' && tgt) motes(v.pos.x, v.pos.y, enemyTargetXY(tgt), col, n, null, { delay: k * 0.03 });
            else if (p.suit === 'C') for (const e of alive) motes(v.pos.x, v.pos.y, enemyTargetXY(e.eid), col, Math.ceil(n / 2), null, { delay: k * 0.03 });
            else motes(v.pos.x, v.pos.y, heroTargetXY(), col, n, null, { delay: k * 0.03, size: p.suit === 'H' ? 10 : 12 });
        });
    }, 330);
    return 0.95 + ev.bonuses.length * 0.08;
}

// ------------------------------------------------------------------ actions

function doTarget(eid) {
    if (!B || B.ended) return;
    const e = C.enemyByEid(B.st, eid);
    if (!e || !e.alive) return;
    C.setTarget(B.st, eid);
    sfx.click();
    // an enemy-targeted arcana casts on click
    if (B.selected >= 0) {
        const c = B.st.hand[B.selected];
        if (c?.kind === 'arcana' && ARCANA[c.id].target === 'enemy' && canAct()) { castSelected(); return; }
    }
    pull();
}

function place(hi, cell) {
    if (!canAct()) return false;
    const c = B.st.hand[hi];
    if (!c || c.kind === 'arcana') return false;
    if (B.st.deals <= 0) { H.hint('No Deals left — End Turn to draw and refresh.'); return false; }
    if (!C.canPlace(B.st, cell)) { H.hint(B.st.board[cell].seal > 0 ? 'That cell is sealed.' : 'That cell is taken.'); return false; }
    const ok = C.placeCard(B.st, hi, cell);
    if (ok) {
        B.selected = -1; K.handState.selected = -1;
        hidePreview();
        pull();
        if (B.tutorial && B.tutStep === 0) B.tutStep = 1;
    }
    return ok;
}

function doRedraw(hi) {
    if (!canAct()) return;
    if (B.st.redraws <= 0) { H.hint('No Redraws left this turn.'); return; }
    if (C.redraw(B.st, hi)) { B.selected = -1; K.handState.selected = -1; pull(); }
}

function doEndTurn() {
    if (!canAct()) return;
    clearArc();
    B.selected = -1; K.handState.selected = -1;
    hidePreview();
    C.endTurn(B.st);
    pull();
}

function useElixirSlot(i) {
    if (!canAct()) { H.hint('Wait for your turn.'); return; }
    if (C.useElixir(B.st, i)) { B.run.elixirs[i] = null; pull(); }
}

function castSelected(target = {}) {
    if (!canAct()) return;
    const c = B.st.hand[B.selected];
    if (!c || c.kind !== 'arcana') return;
    const a = ARCANA[c.id];
    if (C.effectiveCost(B.st, c) > B.st.deals) { H.hint('Not enough Deals to cast that.'); return; }
    if (a.target === 'enemy' && !target.eid) target = { eid: C.currentTarget(B.st)?.eid };
    if (!C.arcanaTargetOk(B.st, c, target)) {
        if (a.target === 'grid' || a.target === 'gridSuit') H.hint('Tap a card on the table.');
        else if (a.target === 'grid2') H.hint('Tap two cards on the table.');
        return;
    }
    if (C.playArcana(B.st, B.selected, target)) {
        B.selected = -1; K.handState.selected = -1;
        clearArc();
        pull();
    }
}

function clearArc() {
    B.arc = null;
    $('suit-pick').classList.add('hidden');
    for (const v of K.allViews().values()) if (v.zone === 'table') v.glowTarget = 0;
}

function selectCard(i) {
    if (!B || B.ended) return;
    if (B.selected === i) { B.selected = -1; } else B.selected = i;
    K.handState.selected = B.selected;
    clearArc();
    const c = B.st.hand[B.selected];
    if (c) {
        sfx.pickup();
        if (c.kind === 'arcana') {
            const t = ARCANA[c.id].target;
            if (t === 'grid' || t === 'grid2' || t === 'gridSuit') {
                B.arc = { need: t, picked: [] };
                for (const v of K.allViews().values()) if (v.zone === 'table' && v.card.kind === 'play') { v.glowTarget = 0.7; v.glowColor.set(0xb8a0ff); }
                H.hint(t === 'grid2' ? 'Tap two table cards to swap.' : 'Tap a table card to target.', 0);
            }
        } else if (B.tutorial && B.tutStep === 0) H.hint('Now tap an empty cell on the table (or drag the card there).', 0);
    }
    layoutVisHand();
    updateCastBar();
}

function updateCastBar() {
    const bar = $('cast-bar');
    const c = B && B.selected >= 0 ? B.st.hand[B.selected] : null;
    if (!c || c.kind !== 'arcana' || B.arc) { bar.classList.add('hidden'); return; }
    const cost = C.effectiveCost(B.st, c);
    bar.classList.remove('hidden');
    $('btn-cast').textContent = `Cast · ${cost} Deal${cost === 1 ? '' : 's'}`;
    $('btn-cast').disabled = cost > B.st.deals || !canAct();
    $('cast-hint').textContent = ARCANA[c.id].text(c.up ? ARCANA[c.id].un : ARCANA[c.id].n);
    const v = K.getView(c.uid);
    const y = v ? card2px(v.t.x, v.t.y).y - K.layout.hand.cw * 1.45 * K.ASPECT * 0.75 : view.h * 0.6;
    bar.style.top = Math.max(60, y - 70) + 'px';
}

function tutorial() {
    if (!B.tutorial) return;
    const st = B.st;
    if (B.tutStep === 0 && st.turn === 1 && st.deals === st.dealsMax) H.hint('Drag a card onto the table — or tap a card, then tap a cell.', 0);
    else if (B.tutStep === 1) { H.hint('Fill a whole row or column (5 cards) to fire it as a poker hand.', 6000); B.tutStep = 2; }
    else if (B.tutStep === 2 && st.stats.lines > 0) { H.hint('♠ Blades hit your target · ♣ Staves hit everyone · ♦ Coins give Ward · ♥ Hearts heal', 8000); B.tutStep = 3; }
    else if (B.tutStep >= 1 && st.deals === 0 && st.phase === 'player' && B.tutStep < 4) { H.hint('Out of Deals — press End Turn. Unplaced cards stay in your hand.', 5000); if (B.tutStep === 3) B.tutStep = 4; }
}

// ------------------------------------------------------------------ pointer input

function updateHoverFx() {
    if (!B) return;
    for (let i = 0; i < 25; i++) K.setCellFx(i, 'hover', false);
    if (B.hoverCell >= 0 && canAct()) {
        const hi = B.drag ? B.drag.index : B.selected;
        const c = B.st.hand[hi];
        if (c && c.kind !== 'arcana' && C.canPlace(B.st, B.hoverCell)) {
            K.setCellFx(B.hoverCell, 'hover', true);
            const pr = C.previewPlacement(B.st, hi, B.hoverCell);
            if (pr && pr.length) for (const r of pr) for (const i of r.cells) K.setCellFx(i, 'hover', true);
        }
    }
}

function showPreview(hi, cell) {
    const pr = C.previewPlacement(B.st, hi, cell);
    const box = $('preview');
    if (!pr || !pr.length) { box.classList.add('hidden'); return; }
    box.innerHTML = '';
    for (const r of pr) {
        const o = r.out;
        box.append(el('div', { class: 'ph', text: `${r.name} ×${Math.round(r.total * 100) / 100}` }));
        if (r.bonuses.length) box.append(el('div', { class: 'pm', text: r.bonuses.join(' · ') }));
        const outs = el('div', { class: 'out' });
        if (o.dmg) outs.append(el('span', { class: 'o-dmg', text: `⚔ ${o.dmg}` }));
        if (o.aoe) outs.append(el('span', { class: 'o-aoe', text: `✦ ${o.aoe} all` }));
        if (o.ward) outs.append(el('span', { class: 'o-ward', text: `⛨ ${o.ward}` }));
        if (o.heal) outs.append(el('span', { class: 'o-heal', text: `♥ ${o.heal}` }));
        box.append(outs);
    }
    const p = K.cellPx(cell);
    box.style.left = p.x + 'px';
    box.style.top = (p.y - K.layout.ch * 0.6) + 'px';
    box.classList.remove('hidden');
}
function hidePreview() { $('preview').classList.add('hidden'); }

export function pointerDown(px, py, e) {
    if (!B || B.ended) return false;
    hideTip();
    const st = B.st;
    const hi = K.handHit(px, py, st.hand);
    if (hi >= 0 && idle()) {
        if (e.button === 2) { doRedraw(hi); return true; }
        B.press = { i: hi, x: px, y: py, uid: st.hand[hi].uid, t: performance.now() };
        return true;
    }
    const cell = K.cellHit(px, py, 0.3);
    if (cell >= 0 && canAct()) {
        if (B.arc) { arcCell(cell, px, py); return true; }
        if (B.selected >= 0 && st.hand[B.selected]?.kind !== 'arcana') { place(B.selected, cell); return true; }
        const tc = st.board[cell].card;
        if (tc) { showTip(cardTipHTML(tc), px, py); setTimeout(hideTip, 1600); }
        return true;
    }
    const eid = pickCreature(px, py);
    if (eid) { doTarget(eid); return true; }
    if (K.inTable(px, py)) return true;
    if (B.selected >= 0) { B.selected = -1; K.handState.selected = -1; clearArc(); layoutVisHand(); updateCastBar(); }
    return false;
}

function arcCell(cell, px, py) {
    const st = B.st;
    const c = st.hand[B.selected];
    const tc = st.board[cell].card;
    if (!c || !tc || tc.kind !== 'play') { H.hint('Choose a card on the table.'); return; }
    if (B.arc.need === 'grid') castSelected({ cell });
    else if (B.arc.need === 'grid2') {
        B.arc.picked.push(cell);
        const v = K.getView(tc.uid); if (v) { v.glowTarget = 1; v.glowColor.set(0xffe080); }
        if (B.arc.picked.length === 2) castSelected({ cells: B.arc.picked });
        else H.hint('Now the second card.', 0);
    } else if (B.arc.need === 'gridSuit') {
        const sp = $('suit-pick');
        sp.innerHTML = '';
        for (const s of ['S', 'C', 'D', 'H']) {
            if (s === tc.suit) continue;
            sp.append(el('button', { style: `color:${SUIT_INFO[s].color}`, title: SUIT_INFO[s].name, onclick: (ev) => { ev.stopPropagation(); castSelected({ cell, suit: s }); } }, SUIT_INFO[s].glyph));
        }
        const p = K.cellPx(cell);
        sp.style.left = p.x + 'px'; sp.style.top = (p.y - K.layout.ch * 0.4) + 'px';
        sp.classList.remove('hidden');
    }
    void px; void py;
}

export function pointerMove(px, py) {
    if (!B || B.ended) return;
    K.setPointerLight(px, py);
    const st = B.st;
    if (B.press && !B.drag) {
        if (Math.hypot(px - B.press.x, py - B.press.y) > 10) {
            B.drag = { uid: B.press.uid, index: B.press.i, lx: px, ly: py };
            K.handState.drag = B.drag;
            B.selected = -1; K.handState.selected = -1;
            clearArc();
            updateCastBar();
            sfx.pickup();
        }
    }
    if (B.drag) {
        const v = K.getView(B.drag.uid);
        if (v) {
            const p = px2card(px, py);
            v.to(p.x, p.y + K.layout.ch * 0.15, 260, { s: 1.15, rz: 0 });
            v.tilt.x = Math.max(-0.5, Math.min(0.5, (py - B.drag.ly) * 0.02));
            v.tilt.y = Math.max(-0.5, Math.min(0.5, (px - B.drag.lx) * 0.02));
            B.drag.lx += (px - B.drag.lx) * 0.3; B.drag.ly += (py - B.drag.ly) * 0.3;
        }
        const cell = K.cellHit(px, py, 0.8);
        B.hoverCell = cell;
        if (cell >= 0 && st.hand[B.drag.index]?.kind !== 'arcana') showPreview(B.drag.index, cell); else hidePreview();
        return;
    }
    // hover
    const hi = idle() ? K.handHit(px, py, st.hand) : -1;
    if (hi !== K.handState.hover) {
        K.handState.hover = hi;
        if (hi >= 0) sfx.hover();
        layoutVisHand();
    }
    const cell = K.cellHit(px, py, 0.3);
    B.hoverCell = cell;
    if (cell >= 0 && B.selected >= 0 && st.hand[B.selected]?.kind !== 'arcana') showPreview(B.selected, cell); else hidePreview();
}

export function pointerUp(px, py) {
    if (!B || B.ended) return;
    const st = B.st;
    if (B.drag) {
        const d = B.drag;
        const v = K.getView(d.uid);
        if (v) { v.tilt.x = 0; v.tilt.y = 0; }
        B.drag = null;
        K.handState.drag = null;
        hidePreview();
        const c = st.hand[d.index];
        const cell = K.cellHit(px, py, 0.8);
        if (c && c.kind !== 'arcana' && cell >= 0) {
            if (!place(d.index, cell)) layoutVisHand();
        } else if (c && c.kind === 'arcana') {
            const t = ARCANA[c.id].target;
            const handTop = K.layout.hand.y - K.layout.hand.cw * K.ASPECT * 0.7;
            B.selected = d.index; K.handState.selected = d.index;
            if ((t === 'none' || t === 'enemy') && py < handTop) {
                const eid = pickCreature(px, py);
                castSelected(eid ? { eid } : {});
            } else if (cell >= 0 && st.board[cell].card && (t === 'grid' || t === 'gridSuit' || t === 'grid2')) {
                B.arc = { need: t, picked: [] };
                arcCell(cell, px, py);
            } else { B.selected = -1; K.handState.selected = -1; }
            layoutVisHand();
            updateCastBar();
        } else layoutVisHand();
        B.press = null;
        return;
    }
    if (B.press) {
        const i = B.press.i;
        B.press = null;
        selectCard(i);
    }
}

export function pointerCancel() {
    if (!B) return;
    if (B.drag) { const v = K.getView(B.drag.uid); if (v) { v.tilt.x = 0; v.tilt.y = 0; } }
    B.drag = null; B.press = null; K.handState.drag = null;
    hidePreview();
    if (B) layoutVisHand();
}

// ------------------------------------------------------------------ keyboard

export function battleKey(e) {
    if (!B || B.ended) return false;
    const st = B.st;
    const k = e.key;
    if (k === ' ' && !canAct()) { B.fast = true; return true; }
    if (/^[1-8]$/.test(k)) { const i = Number(k) - 1; if (i < st.hand.length) selectCard(i); return true; }
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        const r = Math.floor(B.cursor / 5), c = B.cursor % 5;
        const nr = Math.max(0, Math.min(4, r + (k === 'ArrowDown') - (k === 'ArrowUp')));
        const nc = Math.max(0, Math.min(4, c + (k === 'ArrowRight') - (k === 'ArrowLeft')));
        B.cursor = nr * 5 + nc;
        B.hoverCell = B.cursor;
        if (B.selected >= 0) showPreview(B.selected, B.cursor);
        return true;
    }
    if (k === 'Enter' || k === ' ') {
        if (B.selected < 0) return true;
        const c = st.hand[B.selected];
        if (c.kind === 'arcana') {
            if (B.arc) arcCell(B.cursor, 0, 0); else castSelected();
        } else place(B.selected, B.cursor);
        return true;
    }
    if (k === 'Tab') {
        e.preventDefault();
        const al = st.enemies.filter((x) => x.alive);
        if (al.length) { const cur = al.findIndex((x) => x.eid === C.currentTarget(st)?.eid); doTarget(al[(cur + 1) % al.length].eid); }
        return true;
    }
    if (k === 'r' || k === 'R') { if (B.selected >= 0) doRedraw(B.selected); return true; }
    if (k === 'e' || k === 'E') { doEndTurn(); return true; }
    return false;
}
export function battleKeyUp(e) { if (B && e.key === ' ') B.fast = false; }

/** For debug hooks / tests. */
export const battleApi = {
    place: (hi, cell) => place(hi, cell),
    endTurn: () => doEndTurn(),
    idle: () => idle(),
    B: () => B,
    win: () => { if (!B) return; for (const e of B.st.enemies) if (e.alive) C.damageEnemy(B.st, e, 1e6, 'spell'); pull(); },
    select: (i) => selectCard(i),
    cast: (t) => castSelected(t),
    /** CSS-pixel centre of hand card i (its resting slot) and of table cell c. */
    handPx: (i) => { const v = B && K.getView(B.st.hand[i]?.uid); return v ? card2px(v.t.x, v.t.y) : null; },
    cellPx: (c) => K.cellPx(c),
    hurtPlayer: (hp) => { if (B) { B.st.player.hp = hp; B.st.player.ward = 0; } },
};
export { cardName };

/** Re-lay the table after a resize. */
export function battleResize() { if (B) B.synced = false; }
