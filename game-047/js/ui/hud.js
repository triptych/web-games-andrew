/**
 * hud.js — the top bar (hero, HP, Ward, gold, level, relics, elixirs), the
 * combat panel (Deals, Redraw, End Turn, piles) and the enemy plates (name,
 * HP, Ward, statuses, intent) that follow each monster on screen.
 *
 * During combat the HUD shows *displayed* values, fed by the event director
 * as it plays events back, so bars move in step with the animation; sync()
 * snaps everything to the true state when the queue drains.
 */

import { $, el, icon, attachTip } from './dom.js';
import { relicName, RELICS, ELIXIRS, healAmt } from '../sim/relics.js';
import { WORLD_DEFS } from '../sim/worlds.js';
import { FLOORS } from '../sim/rules.js';
import { intentInfo, stName } from '../sim/combat.js';
import { passiveInfo } from '../sim/monsters.js';
import { creaturePx } from '../view/stage.js';
import { layout, updatePiles } from '../view/cards3d.js';
import { CHAPTERS } from '../sim/story.js';

export const disp = { hp: 0, maxHp: 1, ward: 0, pst: {}, enemies: new Map() };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function showHud(on) { $('hud').classList.toggle('hidden', !on); document.body.classList.toggle('in-run', on); }
export function showCombatUI(on) { $('combat-ui').classList.toggle('hidden', !on); $('plates').classList.toggle('hidden', !on); if (!on) $('plates').innerHTML = ''; }

// ------------------------------------------------------------------ top bar

export function renderHud(run, handlers) {
    $('hero-initial').textContent = run.name[0];
    $('hud-name').textContent = `${run.name} ${run.epithet}`;
    $('gold-text').textContent = run.gold;
    const lvl = run.world * FLOORS + Math.max(1, run.floor + (run.phase === 'node' ? 1 : 0));
    $('hud-level').innerHTML = `<b>Level ${Math.min(100, lvl)}</b><span class="long"> / 100 · ${ROMAN[run.world]} ${WORLD_DEFS[run.world].short}</span>`;
    setHp(run.hp, run.maxHp);
    setWard(0);
    renderRelics(run);
    renderElixirs(run, handlers?.elixir);
}

export function setHp(hp, max) {
    disp.hp = hp; disp.maxHp = max;
    const f = Math.max(0, Math.min(1, hp / max));
    $('hp-fill').style.width = f * 100 + '%';
    $('hp-lag').style.width = f * 100 + '%';
    $('hp-text').textContent = `${Math.max(0, Math.round(hp))} / ${max}`;
}
export function setWard(w) {
    disp.ward = w;
    $('ward-badge').classList.toggle('hidden', w <= 0);
    $('ward-text').textContent = w;
}
export function setGold(g) { $('gold-text').textContent = g; }

export function renderPlayerStatus(pst) {
    const box = $('p-status');
    box.innerHTML = '';
    for (const k of ['might', 'weak', 'exposed', 'burn', 'regen']) {
        const v = pst?.[k];
        if (v > 0) {
            const s = el('span', { class: `st ${k}`, text: `${stName(k)} ${v}` });
            attachTip(s, statusTip(k, v, true));
            box.append(s);
        }
    }
}

function statusTip(k, v, player) {
    const T = {
        might: `<b>Might ${v}</b><br>${player ? `+${v} chips to every line you fire.` : `+${v} damage on every hit.`}`,
        weak: `<b>Weak ${v}</b><br>${player ? 'Your Blades and Staves deal 25% less.' : 'Deals 25% less damage.'} Lasts ${v} round${v > 1 ? 's' : ''}.`,
        exposed: `<b>Exposed ${v}</b><br>Takes 50% more damage from attacks. Lasts ${v} round${v > 1 ? 's' : ''}.`,
        burn: `<b>Burn ${v}</b><br>Loses ${v} HP at the start of ${player ? 'your' : 'its'} turn, then Burn drops by 1.`,
        regen: `<b>Regen ${v}</b><br>Heals ${v} at the start of ${player ? 'your' : 'its'} turn, then drops by 1.`,
        thorns: `<b>Thorns ${v}</b><br>Blades that strike it are struck back for ${v}.`,
        armored: `<b>Armoured</b><br>Gains ${v} Ward at the start of each of its turns.`,
    };
    return T[k] ?? k;
}

function renderRelics(run) {
    const box = $('relics');
    box.innerHTML = '';
    for (const id of run.relics) {
        const r = RELICS[id];
        if (!r) continue;
        const d = el('div', { class: `relic ${r.rarity === 'crown' ? 'crown' : r.rarity === 'hero' ? 'hero' : ''}`, html: icon(r.icon) });
        d.style.color = r.rarity === 'crown' ? '#ffe080' : r.rarity === 3 ? '#ff9ad8' : r.rarity === 2 ? '#9ad0ff' : '#e8d8b0';
        attachTip(d, () => `<b>${relicName(id, run.seed)}</b><br>${r.text}<br><span class="dim">${r.rarity === 'crown' ? 'Warden\'s Crown' : r.rarity === 'hero' ? 'Starting relic' : ['', 'Common', 'Uncommon', 'Rare'][r.rarity]}</span>`);
        box.append(d);
    }
}

export function renderElixirs(run, onUse) {
    const box = $('elixirs');
    box.innerHTML = '';
    run.elixirs.forEach((id, i) => {
        if (!id) { box.append(el('div', { class: 'elixir empty', title: 'Empty elixir slot' }, el('div', { class: 'flask', style: 'color:#555' }))); return; }
        const E = ELIXIRS[id];
        const d = el('button', { class: 'elixir', 'aria-label': E.name }, el('div', { class: 'flask', style: `color:${E.color}` }));
        attachTip(d, () => `<b>${E.name}</b><br>${E.text(run.world)}<br><span class="dim">${onUse ? 'Click to drink (combat only).' : 'Usable in combat.'}</span>`);
        if (onUse) d.addEventListener('click', () => onUse(i));
        box.append(d);
    });
}

// ------------------------------------------------------------------ combat panel

export function renderTurnPanel(st, busy) {
    const deals = $('deals');
    deals.innerHTML = '';
    const total = Math.max(st.deals, st.dealsMax);
    deals.append(el('span', { text: 'Deals' }));
    for (let i = 0; i < total; i++) deals.append(el('div', { class: `gem ${i < st.deals ? '' : 'spent'}` }));
    $('redraw-n').textContent = st.redraws;
    $('btn-redraw').disabled = busy || st.redraws <= 0 || st.phase !== 'player';
    const end = $('btn-end');
    end.disabled = busy || st.phase !== 'player';
    end.classList.toggle('pulse', !busy && st.phase === 'player' && (st.deals <= 0 || !st.hand.some((c) => c.kind !== 'arcana')));
    placePiles(st);
}

export function placePiles(st) {
    const d = $('pile-draw'), x = $('pile-discard');
    const up = layout.hand.cw * 1.406 * 0.4 + 16;
    d.style.left = layout.deck.x + 'px'; d.style.top = (layout.deck.y - up) + 'px';
    x.style.left = layout.discard.x + 'px'; x.style.top = (layout.discard.y - up) + 'px';
    if (st) { d.firstChild.textContent = st.draw.length; x.firstChild.textContent = st.discard.length; updatePiles(st.draw.length, st.discard.length); }
    // hand-name banners sit over the table
    const b = document.getElementById('banner');
    if (layout.landscape) { b.style.left = (layout.tableCx - 400) + 'px'; b.style.right = 'auto'; b.style.width = '800px'; b.style.top = (layout.tableCy - layout.tableH * 0.32) + 'px'; } else { b.style.left = '0'; b.style.right = '0'; b.style.width = 'auto'; b.style.top = (layout.tableCy - layout.tableH * 0.3) + 'px'; }
    const tp = $('turn-panel');
    if (layout.landscape) {
        tp.style.right = '16px';
        tp.style.bottom = `calc(${Math.round(window.innerHeight - layout.discard.y + layout.hand.cw * 1.35)}px + var(--safe-b))`;
    } else {
        tp.style.right = '8px';
        tp.style.bottom = `calc(${Math.round(window.innerHeight - layout.hand.y + layout.hand.cw * 1.25)}px + var(--safe-b))`;
    }
    $('hint-bar').style.bottom = `${Math.round(window.innerHeight - layout.hand.y + layout.hand.cw * 1.05)}px`;
}

let hintTimer = null;
export function hint(text, ms = 2600) {
    const h = $('hint-bar');
    h.textContent = text;
    h.classList.add('on');
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(() => h.classList.remove('on'), ms);
}

// ------------------------------------------------------------------ enemy plates

const plates = new Map();

export function buildPlates(st, onTarget) {
    $('plates').innerHTML = '';
    plates.clear();
    disp.enemies.clear();
    for (const e of st.enemies) addPlate(st, e, onTarget);
}

export function addPlate(st, e, onTarget) {
    const p = el('div', { class: `plate ${e.boss ? 'boss' : ''}` });
    const intent = el('div', { class: 'intent' });
    const name = el('div', { class: 'plate-name', html: `${e.name}${e.title ? ` <span class="title">${e.title}</span>` : ''}` });
    const shield = el('div', { class: 'shield hidden' });
    const bar = el('div', { class: 'ehp' }, el('div', { class: 'fill' }), el('div', { class: 'txt' }));
    const sts = el('div', { class: 'statuses' });
    p.append(intent, name, el('div', { class: 'hprow' }, shield, bar), sts);
    p.addEventListener('click', (ev) => { ev.stopPropagation(); onTarget?.(e.eid); });
    attachTip(intent, () => intentTip(st, e));
    $('plates').append(p);
    plates.set(e.eid, { p, intent, bar, shield, sts, name });
    disp.enemies.set(e.eid, { hp: e.hp, maxHp: e.maxHp, ward: e.ward });
    renderPlate(st, e);
}

function intentTip(st, e) {
    const it = intentInfo(st, e);
    let h = it ? `<b>${it.name}</b><br>${it.text}` : '';
    if (e.passive) { const pi = passiveInfo(e.passive); if (pi) h += `<br><span class="dim">${pi.name}: ${pi.text}</span>`; }
    return h || e.name;
}

export function renderPlate(st, e, { fromDisp = true } = {}) {
    const P = plates.get(e.eid);
    if (!P) return;
    const d = disp.enemies.get(e.eid) ?? { hp: e.hp, maxHp: e.maxHp, ward: e.ward };
    const hp = fromDisp ? d.hp : e.hp, ward = fromDisp ? d.ward : e.ward;
    P.bar.firstChild.style.width = Math.max(0, hp / e.maxHp) * 100 + '%';
    P.bar.lastChild.textContent = `${Math.max(0, hp)} / ${e.maxHp}`;
    P.shield.classList.toggle('hidden', ward <= 0);
    P.shield.textContent = ward;
    P.p.classList.toggle('dead', !e.alive && d.hp <= 0);
    P.p.classList.toggle('targeted', st.target === e.eid || (!st.enemies.some((x) => x.eid === st.target && x.alive) && st.enemies.find((x) => x.alive) === e));
    const it = intentInfo(st, e);
    P.intent.className = `intent ${it?.kind === 'attack' || it?.kind === 'attackDebuff' ? 'attack' : it?.curse ? 'curse' : it?.kind ?? ''}`;
    if (it && e.alive) {
        const ic = it.kind === 'attackDebuff' ? 'attack' : it.kind;
        const num = it.dmg ? (it.hits > 1 ? `${it.dmg}×${it.hits}` : `${it.dmg}`) : '';
        P.intent.innerHTML = icon(ic) + (num ? `<span>${num}</span>` : '');
        P.intent.style.visibility = 'visible';
    } else P.intent.style.visibility = 'hidden';
    P.sts.innerHTML = '';
    for (const k of ['might', 'weak', 'exposed', 'burn', 'regen']) {
        if (e.st[k] > 0) { const s = el('span', { class: `st ${k}`, text: `${stName(k)} ${e.st[k]}` }); attachTip(s, statusTip(k, e.st[k], false)); P.sts.append(s); }
    }
    if (e.thorns) { const s = el('span', { class: 'st thorns', text: `Thorns ${e.thorns}` }); attachTip(s, statusTip('thorns', e.thorns)); P.sts.append(s); }
    if (e.armored) { const s = el('span', { class: 'st armored', text: 'Armoured' }); attachTip(s, statusTip('armored', e.armored)); P.sts.append(s); }
    if (e.passive && e.passive !== 'thorns' && e.passive !== 'armored') { const pi = passiveInfo(e.passive); const s = el('span', { class: 'st passive', text: pi.name }); attachTip(s, `<b>${pi.name}</b><br>${pi.text}`); P.sts.append(s); }
}

export function renderAllPlates(st, opts) { for (const e of st.enemies) renderPlate(st, e, opts); }

/** Follow each monster on screen. */
export function positionPlates() {
    for (const [eid, P] of plates) {
        const s = creaturePx(eid, 'top');
        if (!s) continue;
        P.p.style.left = s.x + 'px';
        P.p.style.top = Math.max(layout.landscape ? 90 : 70, s.y) + 'px';
    }
}

export function plateAnchor(eid) {
    const P = plates.get(eid);
    if (!P) return null;
    const r = P.bar.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
}

export function levelLabel(run) {
    return `Chapter ${CHAPTERS[run.world].numeral} · ${CHAPTERS[run.world].title}`;
}

export { healAmt };
