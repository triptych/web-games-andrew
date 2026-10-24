// The DOM layer: screens, the battle HUD, the sanctum (campaign, summoning, roster), toasts and
// settings. Reads the sim; never changes it. Actions go out through `ui.on(name, data)`.

import { VERSION, GACHA, PARTY_MAX, BOND } from './config.js';
import { ELEMENTS, UNITS, ABILITIES, CHAPTERS, statsOf, STAT_KEYS } from './sim/data.js';
import { diagram } from './sim/moves.js';
import { eff, forecast, expected } from './sim/battle.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A chess glyph for each silhouette: the roster has no portraits, only pieces. */
const GLYPH = {
    pawn: '♟', rook: '♜', bishop: '♝', knight: '♞', king: '♚', queen: '♛', wazir: '♙', alfil: '♗', rider: '♞', cannon: '♖',
    dancer: '♕', hopper: '♘', witch: '♕', archbishop: '♝', empress: '♖', champion: '♔', wraith: '☠', gargoyle: '♘',
};
export const glyphOf = (key) => GLYPH[UNITS[key].model] || '♟';
const TITLES = new Set(['Lady', 'Sister', 'Brother', 'Count']);
const shortName = (n) => { const w = n.split(' '); return TITLES.has(w[0]) ? w.slice(0, 2).join(' ') : w[0]; };
const stars = (n) => '★'.repeat(n);
const elBadge = (el) => `<span class="el el-${el}" title="${ELEMENTS[el].name}">${ELEMENTS[el].glyph}</span>`;
const STAT_LABEL = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', skl: 'SKL' };

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.on = () => {};                // set by main: (name, data) => void
        this.chSel = 0;
        this.rosterSel = null;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), calm = $('set-calm'), quick = $('set-quick');
        sfx.value = settings.sfx; music.value = settings.music; calm.checked = !!settings.calm; quick.checked = !!settings.quick;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, calm: calm.checked, quick: quick.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, calm, quick]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this._layer();
        this.focusFirst(id);
        this.on('screens');
    }
    closeScreen(id) {
        $(id).hidden = true;
        $(id).style.visibility = '';
        this.stack = this.stack.filter((s) => s !== id);
        this._layer();
        if (this.top()) this.focusFirst(this.top());
        this.on('screens');
    }
    /** Each screen sits above the one that opened it, and hides the ones it covers (they are see-through). */
    _layer() {
        this.stack.forEach((s, i) => {
            $(s).style.zIndex = String(50 + i);
            $(s).style.visibility = i < this.stack.length - 1 ? 'hidden' : '';
        });
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) { $(id).hidden = true; $(id).style.visibility = ''; } this.stack = []; this.on('screens'); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }

    // ------------------------------------------------------------------ the sanctum
    renderHub(G) {
        const m = G.meta;
        $('hub-shards').textContent = m.shards;
        const done = CHAPTERS.filter((c) => m.cleared[c.id]).length;
        $('hub-prog').textContent = `${done} / ${CHAPTERS.length} chapters cleared`;
        $('hub-party').innerHTML = m.party.map((rid, i) => {
            const r = m.roster.find((x) => x.rid === rid);
            if (!r) return '';
            return `<div class="chip el-${UNITS[r.key].el}" title="${esc(UNITS[r.key].name)}"><span class="glyph">${glyphOf(r.key)}</span><small>Lv ${r.lv}</small></div>`;
        }).join('');
    }

    renderCampaign(G, sel = this.chSel) {
        this.chSel = sel;
        const m = G.meta;
        $('chapter-list').innerHTML = CHAPTERS.map((c, i) => {
            const locked = i > 0 && !m.cleared[CHAPTERS[i - 1].id];
            const cleared = !!m.cleared[c.id];
            return `<button class="chapter ${i === sel ? 'sel' : ''} ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}" data-ch="${i}" ${locked ? 'aria-disabled="true"' : ''}>
                <span class="num">${i + 1}</span><span class="cname">${esc(c.name)}</span><span class="cstat">${locked ? '🔒' : cleared ? '✔' : '⚔'}</span></button>`;
        }).join('');
        const c = CHAPTERS[sel];
        const lv = Math.round(c.enemies.reduce((a, e) => a + e.lv, 0) / c.enemies.length);
        const locked = sel > 0 && !m.cleared[CHAPTERS[sel - 1].id];
        const first = !m.cleared[c.id];
        const foes = [...new Set(c.enemies.map((e) => e.u))].map((k) => `<span class="chip el-${UNITS[k].el}" title="${esc(UNITS[k].name)}"><span class="glyph">${glyphOf(k)}</span></span>`).join('');
        const party = m.party.slice(0, c.slots).length;
        $('chapter-detail').innerHTML = `
            <h3>${esc(c.name)}</h3>
            <p class="small">${esc(c.blurb)}</p>
            <div class="kv"><span>Objective</span><b>${c.victory === 'boss' ? 'Slay the marked lord' : 'Rout every enemy'}</b></div>
            <div class="kv"><span>Enemy level</span><b>~${lv}</b></div>
            <div class="kv"><span>Deploys</span><b>${party} of ${c.slots} pieces</b></div>
            <div class="kv"><span>Reward</span><b>◆ ${c.reward.shards}${first ? '' : ' → ◆ ' + Math.round(c.reward.shards * 0.4) + ' (replay)'}${c.enemies.some((e) => e.recruit) ? ' + a recruit' : ''}</b></div>
            <div class="foes">${foes}</div>`;
        $('btn-march').disabled = locked;
        $('btn-march').textContent = locked ? 'Locked' : first ? 'March' : 'Replay';
    }

    renderSummon(G) {
        const m = G.meta;
        $('sm-shards').textContent = m.shards;
        $('btn-sum1').disabled = m.shards < GACHA.single;
        $('btn-sum10').disabled = m.shards < GACHA.ten;
        $('sm-pity').innerHTML = `<span>★★★★★ in ${GACHA.pity5 - m.pity.p5}</span><span>★★★★+ in ${GACHA.pity4 - m.pity.p4}</span>`;
    }

    showSummonResults(pulls) {
        $('pulls').classList.remove('all');
        $('pulls').innerHTML = pulls.map((p, i) => {
            const d = UNITS[p.key];
            const tag = p.isNew ? '<span class="tag new">NEW</span>' : p.refund ? `<span class="tag">+◆${p.refund}</span>` : `<span class="tag">Bond ${p.bond}</span>`;
            return `<div class="pull star${p.star} el-${d.el}" style="--i:${i}">
                <div class="back">♜</div>
                <div class="front"><div class="stars">${stars(p.star)}</div><div class="glyph">${glyphOf(p.key)}</div>
                <div class="pname">${esc(d.name)}</div><div class="ptitle">${esc(d.title)}</div>${tag}</div></div>`;
        }).join('');
        this.openScreen('summon-result');
    }

    /** The roster grid and the detail of the selected piece. */
    renderRoster(G) {
        const m = G.meta;
        const sel = m.roster.find((r) => r.rid === this.rosterSel) || m.roster[0];
        this.rosterSel = sel.rid;
        $('roster-note').textContent = `Party ${m.party.length}/${PARTY_MAX}. The first pieces in the party deploy; later chapters take more.`;
        const sorted = m.roster.slice().sort((a, b) => UNITS[b.key].star - UNITS[a.key].star || b.lv - a.lv);
        $('roster-grid').innerHTML = sorted.map((r) => {
            const d = UNITS[r.key], slot = m.party.indexOf(r.rid);
            return `<button class="ucard star${d.star} el-${d.el} ${r.rid === sel.rid ? 'sel' : ''}" data-rid="${r.rid}">
                <span class="glyph">${glyphOf(r.key)}</span><span class="uname">${esc(shortName(d.name))}</span>
                <span class="stars">${stars(d.star)}</span><small>Lv ${r.lv}</small>
                ${slot >= 0 ? `<span class="slot">${slot + 1}</span>` : ''}</button>`;
        }).join('');

        const d = UNITS[sel.key], s = statsOf(sel.key, sel.gains, sel.bond), ab = d.ability ? ABILITIES[d.ability] : null;
        const inParty = m.party.includes(sel.rid);
        const g = diagram(sel.key);
        const cells = g.map((row, y) => row.map((c, x) => `<i class="dg ${x === 4 && y === 4 ? 'me' : c}"></i>`).join('')).join('');
        const beats = ELEMENTS[d.el].beats;
        $('roster-detail').innerHTML = `
            <div class="rd-head el-${d.el}"><span class="glyph big">${glyphOf(sel.key)}</span>
                <div><h3>${esc(d.name)}</h3><div class="small">${esc(d.title)} · ${elBadge(d.el)} ${ELEMENTS[d.el].name} · ${stars(d.star)}</div></div></div>
            <div class="kv"><span>Level</span><b>${sel.lv}${sel.lv >= 20 ? ' (max)' : ` · ${sel.xp}/100 xp`}</b></div>
            <div class="kv"><span>Bond</span><b>${'◆'.repeat(sel.bond)}${'◇'.repeat(BOND.max - sel.bond)}</b></div>
            <div class="stat-grid">${STAT_KEYS.map((k) => `<div><small>${STAT_LABEL[k]}</small><b>${s[k]}</b></div>`).join('')}</div>
            <div class="ability-box"><b>${ab ? esc(d.abilityName || ab.name) : 'No ability'}</b>${ab ? ` <small>rests ${ab.cd}</small><div class="small">${esc(ab.desc)}</div>` : ''}</div>
            <div class="move-wrap"><div class="diagram big">${cells}</div>
                <div class="legend small"><i class="dg m"></i> moves <i class="dg c"></i> captures <i class="dg b"></i> both <i class="dg j"></i> leaps</div></div>
            <p class="small bio">${esc(d.bio || '')}</p>
            <p class="small">${elBadge(d.el)} edge over ${elBadge(beats)}${d.el === 'umbra' || d.el === 'lumen' ? ' (and each other)' : ''}</p>
            <div class="rd-btns">
                <button class="btn ${inParty ? '' : 'primary'}" data-party="${sel.rid}" ${!inParty && m.party.length >= PARTY_MAX ? 'disabled' : ''}>${inParty ? 'Remove from party' : 'Add to party'}</button>
                ${inParty && m.party.indexOf(sel.rid) > 0 ? `<button class="btn" data-up="${sel.rid}">Deploy earlier ↑</button>` : ''}
            </div>`;
    }

    // ------------------------------------------------------------------ battle HUD
    showBattleHud(on) { $('bhud').hidden = !on; }

    setHeader(B, G) {
        $('bh-chapter').textContent = CHAPTERS[B.ch].name;
        $('bh-turn').textContent = `Turn ${B.turn}`;
        const ph = $('bh-phase');
        ph.textContent = B.over ? (B.over === 'win' ? 'Victory' : 'Defeat') : B.phase === 'p' ? 'Your Phase' : 'Enemy Phase';
        ph.className = 'phase ' + (B.phase === 'e' && !B.over ? 'enemy' : 'player');
    }

    banner(text, kind = '') {
        const el = $('banner');
        $('banner-text').textContent = text;
        $('banner-sub').textContent = '';
        el.className = 'b-' + kind;
        el.hidden = false;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        clearTimeout(this._bt);
        this._bt = setTimeout(() => { el.hidden = true; }, 1300);
    }

    /** The unit card: stats, ability, mods and the movement diagram. u = a battle unit, or null. */
    showCard(u) {
        this._card = u && u.id;
        if (!u) {
            $('bh-card').classList.add('empty');
            $('uc-name').textContent = 'Select a piece';
            $('uc-title').textContent = 'Tap one of yours to see where it can go.';
            $('uc-glyph').textContent = '✦'; $('uc-glyph').className = 'glyph';
            $('uc-lv').textContent = '';
            $('uc-hp').style.width = '0%'; $('uc-hptext').textContent = '';
            $('uc-stats').innerHTML = ''; $('uc-ability').textContent = ''; $('uc-mods').innerHTML = ''; $('uc-move').innerHTML = '';
            return;
        }
        const d = UNITS[u.key], E = eff(u);
        $('bh-card').classList.remove('empty');
        $('bh-card').classList.toggle('foe', u.team === 'e');
        $('uc-glyph').textContent = glyphOf(u.key);
        $('uc-glyph').className = `glyph el-${u.el}`;
        $('uc-name').textContent = u.name + (u.boss ? ' ♛' : '');
        $('uc-title').innerHTML = `${esc(d.title)} · ${elBadge(u.el)} ${ELEMENTS[u.el].name}`;
        $('uc-lv').textContent = `Lv ${u.lv}`;
        $('uc-hp').style.width = `${Math.max(0, (u.hp / u.hpMax) * 100)}%`;
        $('uc-hp').className = u.team === 'e' ? 'foe' : '';
        $('uc-hptext').textContent = `${u.hp} / ${u.hpMax}`;
        const col = (k) => (E[k] > u[k] ? 'up' : E[k] < u[k] ? 'down' : '');
        $('uc-stats').innerHTML = ['atk', 'def', 'spd', 'skl'].map((k) => `<span class="${col(k)}"><small>${STAT_LABEL[k]}</small><b>${E[k]}</b></span>`).join('');
        const ab = u.ability ? ABILITIES[u.ability] : null;
        $('uc-ability').innerHTML = ab ? `${ab.icon} <b>${esc(d.abilityName || ab.name)}</b> <small>${u.cd > 0 ? `rests ${u.cd}` : 'ready'}</small>` : '<small>No ability</small>';
        $('uc-mods').innerHTML = u.mods.map((m) => `<span class="mod ${m.good ? 'good' : 'bad'}">${esc(m.name)} ${m.turns}</span>`).join('') + (u.acted ? '<span class="mod">acted</span>' : '');
        const g = diagram(u.key);
        const rows = u.team === 'e' ? g.slice().reverse() : g;
        $('uc-move').innerHTML = rows.map((row, y) => row.map((c, x) => `<i class="dg ${x === 4 && y === 4 ? 'me' : c}"></i>`).join('')).join('');
    }

    setActions({ ability = null, wait = false, end = false, abilityOn = false } = {}) {
        const a = $('btn-ability');
        a.disabled = !ability || !ability.enabled;
        a.textContent = ability ? ability.label : 'Ability';
        a.classList.toggle('on', abilityOn);
        $('btn-wait').disabled = !wait;
        $('btn-end').disabled = !end;
    }

    showForecast(B, a, d, stop) {
        const f = forecast(B, a, d, stop);
        const ex = expected(f, a.hp, d.hp);
        const side = (u, s, other, mine) => {
            const n = f.seq.filter((q) => q === mine).length;
            const arrow = s.adv > 0 ? '<span class="adv up">▲ element edge</span>' : s.adv < 0 ? '<span class="adv down">▼ element weak</span>' : '';
            return `<div class="fc-name">${elBadge(u.el)} ${esc(u.name)}</div>
                <div class="fc-hp">HP <b>${u.hp}</b>/${u.hpMax}</div>
                <div class="fc-row"><small>DMG</small><b>${s.dmg}${n > 1 ? ' ×' + n : ''}</b></div>
                <div class="fc-row"><small>HIT</small><b>${s.hit}%</b></div>
                <div class="fc-row"><small>CRIT</small><b>${s.crit}%</b></div>${arrow}`;
        };
        $('fc-a').innerHTML = side(a, f.a, d, 'a');
        $('fc-d').innerHTML = side(d, f.d, a, 'd');
        $('fc-note').textContent = ex.kills ? 'Likely to fall: you take its square.' : ex.dies ? 'Dangerous: this piece may fall.' : 'If it survives, your piece falls back.';
        $('forecast').hidden = false;
        $('bh-card').hidden = true;
        $('bh-actions').hidden = true;
    }
    hideForecast() { $('forecast').hidden = true; $('bh-card').hidden = false; $('bh-actions').hidden = false; }

    /** How much of the screen the HUD covers, for the camera to fit the board into the rest. */
    pads() {
        const vw = innerWidth, vh = innerHeight;
        if ($('bhud').hidden) return { top: 52, bottom: 0, left: 0, right: 0 };
        const top = $('bh-top').getBoundingClientRect().bottom + 4;
        const dock = $('bh-dock').getBoundingClientRect();
        if (dock.width < vw * 0.7) return { top, bottom: 0, left: dock.right + 6, right: 0 };
        return { top, bottom: vh - dock.top + 4, left: 0, right: 0 };
    }

    // ------------------------------------------------------------------ the duel cut-in
    battleOpen(ev) {
        const side = (u, s, mine) => {
            const n = ev.f.seq.filter((q) => q === mine).length;
            return `<div class="cut-name">${elBadge(u.el)} <b>${esc(u.name)}</b></div>
                <div class="hpbar"><i class="${u.team === 'e' ? 'foe' : ''}" style="width:${(u.hp / u.hpMax) * 100}%"></i><b>${u.hp} / ${u.hpMax}</b></div>
                <div class="cut-stats"><span>DMG <b>${s.dmg}${n > 1 ? '×' + n : ''}</b></span><span>HIT <b>${s.hit}</b></span><span>CRT <b>${s.crit}</b></span></div>`;
        };
        $('cut-a').innerHTML = side(ev.a, ev.f.a, 'a');
        $('cut-d').innerHTML = side(ev.d, ev.f.d, 'd');
        this._cutMax = { a: ev.a.hpMax, d: ev.d.hpMax };
        $('cut').hidden = false;
        $('bhud').classList.add('dueling');
    }
    battleHp(side, hp) {
        const el = $(side === 'a' ? 'cut-a' : 'cut-d');
        el.querySelector('.hpbar i').style.width = `${Math.max(0, (hp / this._cutMax[side]) * 100)}%`;
        el.querySelector('.hpbar b').textContent = `${hp} / ${this._cutMax[side]}`;
    }
    battleClose() { $('cut').hidden = true; $('bhud').classList.remove('dueling'); }

    levelup(ev) {
        const gains = Object.entries(ev.gains).map(([k, v]) => `${STAT_LABEL[k]} +${v}`).join('  ') || 'no gains';
        this.toast(`${ev.name} reaches Lv ${ev.lv}!  ${gains}`, 'lvup');
    }

    // ------------------------------------------------------------------ results
    showResult(G, ev) {
        const B = G.battle;
        const win = ev.type === 'win';
        $('res-title').textContent = win ? 'Victory' : 'Defeat';
        $('res-title').className = win ? 'win' : 'lose';
        $('res-text').textContent = win ? CHAPTERS[B.ch].name + ' is silent once more.' : ev.why;
        const parts = [];
        if (win) {
            const r = ev.rewards;
            parts.push(`<div class="kv"><span>Soul shards</span><b>◆ ${r.shards}</b></div>`);
            if (r.recruit) {
                const d = UNITS[r.recruit.key];
                parts.push(`<div class="kv recruit"><span>Recruited</span><b>${glyphOf(r.recruit.key)} ${esc(d.name)}${r.recruit.isNew ? ' — joins your roster!' : r.recruit.refund ? ` (+◆${r.recruit.refund})` : ` — Bond ${r.recruit.bond}`}</b></div>`);
            }
        } else parts.push('<p class="small">No piece is lost for good. Summon, level up and return.</p>');
        parts.push(`<div class="kv"><span>Enemies felled</span><b>${ev.stats.kills}</b></div>`);
        parts.push(`<div class="kv"><span>Pieces lost</span><b>${ev.stats.losses}</b></div>`);
        for (const l of ev.stats.levelups) parts.push(`<div class="kv lv"><span>${esc(l.name)}</span><b>Lv ${l.lv} ${Object.entries(l.gains).map(([k, v]) => `${STAT_LABEL[k]}+${v}`).join(' ')}</b></div>`);
        $('res-body').innerHTML = parts.join('');
        const next = win && B.ch + 1 < CHAPTERS.length;
        $('btn-res-next').hidden = !next;
        this.openScreen('result');
    }
}
