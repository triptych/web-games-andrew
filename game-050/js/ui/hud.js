/**
 * hud.js — the town HUD (resources, hero badge, nav pips) and the battle HUD
 * (hero and monster cards, mana bars, spell buttons, potions, status chips).
 *
 * The battle HUD shows a *display* copy of each side (hp, shield, mana) that the
 * battle director moves in step with the event stream, then snaps to the truth.
 */

import { $, h, fmt } from './dom.js';
import { RES, RES_INFO, MANA, SPELLS, POTIONS, CLASSES, xpToNext, GEM_INFO } from '../sim/data.js';
import { MSPELLS } from '../sim/monsters.js';
import { spellPower, canCast } from '../sim/battle.js';
import { questDone } from '../sim/quests.js';
import { BUILDINGS } from '../sim/town.js';

// ------------------------------------------------------------------ Town

const resEls = {};
export function renderTown(p) {
    const bar = $('res-bar');
    if (!bar.children.length) {
        for (const r of RES) {
            const el = h('div.res', { title: RES_INFO[r].name }, h('span.ri', RES_INFO[r].icon), h('span.rv', '0'));
            resEls[r] = el;
            bar.append(el);
        }
    }
    for (const r of RES) {
        const v = fmt(p.res[r]);
        const el = resEls[r];
        const rv = el.querySelector('.rv');
        if (rv.textContent !== v) { rv.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
        // hide resources the player can't produce or use yet (keeps the phone bar short)
        el.hidden = r !== 'gold' && r !== 'wood' && !p.res[r] && !Object.keys(p.town).some((id) => BUILDINGS[id].res === r);
    }
    $('hb-icon').textContent = CLASSES[p.cls].icon;
    $('hb-name').textContent = p.name;
    $('hb-level').textContent = `Lv ${p.level}`;
    $('hb-xp-fill').style.width = `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`;
    $('hb-points').hidden = !p.points;
    $('hb-points').textContent = p.points ? '+' + p.points : '';
    $('pip-hero').hidden = !p.points;
    $('pip-hero').textContent = p.points || '';
    const claim = p.quests.active.filter((q) => questDone(p, q)).length;
    $('pip-quests').hidden = !claim;
    $('pip-quests').textContent = claim || '';
    const ready = Object.entries(p.town).filter(([id, b]) => BUILDINGS[id].res && b.basket >= 1).length;
    $('pip-collect').hidden = !ready;
    $('pip-collect').textContent = ready || '';
}

// ------------------------------------------------------------------ Battle

export function spellText(def, s, rank = 1) {
    const pw = s ? spellPower(s, def, rank) : 1;
    let d = def.desc;
    for (const o of def.ops) {
        if (o.op === 'dmg') d = d.replace('{dmg}', Math.round(o.n * pw));
        if (o.op === 'heal') d = d.replace('{heal}', Math.round(o.n * pw));
        if (o.op === 'shield') d = d.replace('{shield}', Math.round(o.n * pw));
        if (o.op === 'burn') d = d.replace('{burn}', Math.max(1, Math.round(o.n * pw)));
        if (o.op === 'destroyColor') d = d.replace('{per}', Math.round(o.per * pw * 10) / 10);
    }
    return d;
}

export function costPips(cost) {
    return h('span.pips', Object.entries(cost).map(([c, n]) => h('span.pipc.' + c, GEM_INFO[MANA.indexOf(c)].icon, String(n))));
}

const CARD = {};
export function buildBattleHud(G, run) {
    const bt = run.bt;
    const P = bt.sides.p, E = bt.sides.e;
    $('p-icon').textContent = CLASSES[G.profile.cls].icon;
    $('p-name').textContent = P.name;
    $('p-lvl').textContent = `Lv ${P.level}`;
    $('e-icon').textContent = run.mon.boss ? '👑' : run.mon.rank === 'elite' ? '⭐' : '👾';
    $('e-name').textContent = run.mon.name;
    $('e-lvl').textContent = `Lv ${run.mon.level}`;
    for (const key of ['p', 'e']) {
        const mana = $(key + '-mana');
        mana.innerHTML = '';
        CARD[key] = { mana: {} };
        for (const c of MANA) {
            const bar = h('div.mbar.' + c, { title: GEM_INFO[MANA.indexOf(c)].name + ' mana' }, h('i'), h('span'));
            mana.append(bar);
            CARD[key].mana[c] = bar;
        }
    }
    // Player spells
    const ps = $('p-spells');
    ps.innerHTML = '';
    P.spells.forEach((sp, i) => {
        const def = SPELLS[sp.id];
        const b = h('button.spell-btn', { 'data-spell': i, title: def.name, onclick: () => G.cast(i) },
            h('span.si', def.icon),
            h('span', h('div.sn', def.name, sp.rank > 1 ? ` ${'★'.repeat(sp.rank - 1)}` : '', def.quick ? ' ⚡' : ''), h('div.sd', spellText(def, P, sp.rank)), costPips(def.cost)),
            h('span.key', String(i + 1)));
        ps.append(b);
    });
    if (!P.spells.length) ps.append(h('div.muted', 'No spells equipped.'));
    // Enemy spells
    const es = $('e-spells');
    es.innerHTML = '';
    E.spells.forEach((sp) => {
        const def = MSPELLS[sp.id] || sp.def;
        es.append(h('div.spell-btn', { title: def.name }, h('span.si', def.icon), h('span', h('div.sn', def.name), h('div.sd', spellText(def, E, 1)), costPips(def.cost))));
    });
    const weak = $('e-weak');
    if (E.weakHidden) weak.textContent = 'Weakness: ??? (find the Bestiary)';
    else weak.innerHTML = `Weak to ${GEM_INFO[MANA.indexOf(E.weak)]?.icon || '—'} · resists ${GEM_INFO[MANA.indexOf(E.resist)]?.icon || '—'}`;
    buildPotions(G, run);
}

export function buildPotions(G, run) {
    const box = $('potions');
    box.innerHTML = '';
    const bt = run.bt;
    for (const [id, n] of Object.entries(bt.potions)) {
        if (n <= 0) continue;
        const def = POTIONS[id];
        box.append(h('button.pot-btn', { title: `${def.name}: ${def.desc}`, onclick: () => G.potion(id) }, def.icon, h('span.n', String(n))));
    }
    box.hidden = !box.children.length;
}

/** Update bars from display values; refresh which spells glow. */
export function updateBattleHud(G, run, disp) {
    const bt = run.bt;
    for (const key of ['p', 'e']) {
        const s = bt.sides[key], d = disp[key];
        const hpP = Math.max(0, Math.min(100, (d.hp / s.maxHp) * 100));
        $(key + '-hp').style.width = hpP + '%';
        $(key + '-lag').style.width = hpP + '%';
        $(key + '-sh').style.width = Math.min(100, (d.shield / s.maxHp) * 100) + '%';
        $(key + '-hpt').textContent = `${Math.ceil(d.hp)} / ${s.maxHp}${d.shield > 0 ? `  🛡${Math.round(d.shield)}` : ''}`;
        for (const c of MANA) {
            const bar = CARD[key]?.mana[c];
            if (!bar) continue;
            const v = d.mana[c];
            bar.querySelector('i').style.width = Math.min(100, (v / s.manaCap) * 100) + '%';
            const t = `${Math.floor(v)}`;
            const sp = bar.querySelector('span');
            if (sp.textContent !== t) sp.textContent = t;
        }
        const st = $(key + '-status');
        const chips = [];
        if (s.stun > 0) chips.push(h('span.chip.red', '💫 Stunned'));
        if (s.burn) chips.push(h('span.chip.red', `🔥 ${s.burn.n}×${s.burn.turns}`));
        for (const b of s.buffs) chips.push(h('span.chip.green', b.key === 'skullMult' ? `💀×${b.n} (${b.turns})` : `💀+${b.n} (${b.turns})`));
        if (key === 'p' && bt.haste) chips.push(h('span.chip.gold', '🥤 Swift'));
        if (s.ward > 0) chips.push(h('span.chip', `🛡 Ward ${Math.round(s.ward * 100)}%`));
        const html = chips.map((c) => c.outerHTML).join('');
        if (st.innerHTML !== html) st.innerHTML = html;
    }
    const myTurn = bt.turn === 'p' && !bt.over && G.idle();
    $('p-card').classList.toggle('active', bt.turn === 'p' && !bt.over);
    $('e-card').classList.toggle('active', bt.turn === 'e' && !bt.over);
    document.querySelectorAll('#p-spells .spell-btn').forEach((b) => {
        const i = +b.dataset.spell;
        b.classList.toggle('ready', myTurn && canCast(bt, 'p', i));
        b.disabled = !myTurn;
    });
    bt.sides.e.spells.forEach((sp, i) => {
        const el = $('e-spells').children[i];
        if (el) el.classList.toggle('ready', canCast(bt, 'e', i));
    });
    document.querySelectorAll('#potions .pot-btn').forEach((b) => { b.disabled = !myTurn; b.style.opacity = myTurn ? 1 : 0.5; });
    $('loot-gold').textContent = `🪙 ${bt.loot.gold}`;
    $('loot-xp').textContent = `⭐ ${bt.loot.xp}`;
    const tb = $('turn-banner');
    tb.classList.toggle('enemy', bt.turn === 'e');
    $('turn-text').textContent = bt.over ? (bt.over === 'win' ? 'Victory!' : 'Defeat') : bt.turn === 'p' ? 'Your turn' : `${run.mon.name.split(',')[0]}'s turn`;
}

export function cardHit(key) {
    const el = $(key === 'p' ? 'p-card' : 'e-card');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
}

export function manaBarEl(key, color) { return CARD[key]?.mana[color]; }
