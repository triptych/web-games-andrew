// The DOM layer: the screen stack, toasts, banners, story dialogue, the battle HUD (commander
// panels, tile and unit cards, the action menu and the forecast), the close-up fight overlay, the
// commander-power cut-in and the results. Reads the sim; never changes it.

import { VERSION, POWER } from '../config.js';
import { ELEMENTS, TERRAIN, SPECIES, UNITS, SKILLS, TRAITS, COS, CLASSES } from '../sim/data.js';
import { SPEAKERS, CHAPTERS } from '../sim/story.js';
import { STAGE_NAMES } from '../sim/dragons.js';
import { starsOf } from '../sim/battle.js';
import { portrait, eggIcon } from './portraits.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { $, esc };

export const elTag = (el) => { const E = ELEMENTS[el] || ELEMENTS.iron; return `<span class="el" style="background:${E.css}">${E.icon} ${E.name}</span>`; };
export const starsTxt = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.talking = null;
        this.starterName = 'your dragon';
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen, .popup, #dialogue'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen, .popup')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el && !el.contains(this.downIn)) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), fights = $('set-fights'), speed = $('set-speed'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; fights.value = settings.fights; speed.value = settings.speed; calm.checked = !!settings.calm;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, fights: fights.value, speed: speed.value, calm: calm.checked }); onSettings(settings); };
        for (const el of [sfx, music, fights, speed, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => {
            if (!confirm('Delete your saved roost? This cannot be undone.')) return;
            onDeleteSave(); this.toast('Saved game deleted.');
        });

        // dialogue
        $('dialogue').addEventListener('click', (e) => { if (e.target.closest('#btn-dlg-skip')) return; this.advance(); });
        $('btn-dlg-skip').addEventListener('click', () => this.skipTalk());
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this._restack();
        this.focusFirst(id);
        this.on?.('screens');
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        this._restack();
        if (this.top()) this.focusFirst(this.top());
        this.on?.('screens');
    }
    _restack() { this.stack.forEach((id, i) => { $(id).style.zIndex = String(50 + i * 2); }); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    /** Screens that cover the map (the hub is a frame round the diorama, not a cover). */
    blocking() { return this.stack.some((s) => s !== 'hub') || !!this.talking; }

    buttons(id) {
        const root = $(id);
        if (!root) return [];
        return [...root.querySelectorAll('button, select, input, .dcard, .chapter')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length);
    }
    focusFirst(id) { const b = this.buttons(id)[0]; if (b && b.focus) b.focus({ preventScroll: true }); }
    moveFocus(dir, id = this.top()) {
        const list = this.buttons(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const n = list[(i + dir + list.length) % list.length];
        n.focus();
        n.scrollIntoView?.({ block: 'nearest' });
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    }

    banner(text, kind = '') {
        const b = $('banner');
        b.className = '';
        void b.offsetWidth;
        b.textContent = text;
        b.className = 'show ' + kind;
    }

    // ------------------------------------------------------------------ dialogue
    /** Play lines of dialogue. Resolves when the last is dismissed (or skipped). */
    talk(lines) {
        if (!lines || !lines.length) return Promise.resolve();
        // scenes queue: one that arrives mid-scene plays after it
        const run = () => this._talk(lines);
        this.talkQ = (this.talkQ || Promise.resolve()).then(run, run);
        return this.talkQ;
    }
    _talk(lines) {
        if (this.skipAll) return Promise.resolve();
        return new Promise((resolve) => {
            this.talking = { lines, i: -1, resolve, typing: null };
            $('dialogue').hidden = false;
            this.advance();
        });
    }
    advance() {
        const T = this.talking;
        if (!T) return;
        if (T.typing) { clearInterval(T.typing.id); T.typing = null; this.$text.textContent = T.full; return; }
        T.i++;
        if (T.i >= T.lines.length) return this._endTalk();
        const [who, raw] = T.lines[T.i];
        const S = SPEAKERS[who] || { name: who, side: 'left' };
        const text = raw.replace(/\{starter\}/g, this.starterName);
        const box = $('dialogue').querySelector('.dlg-box');
        box.className = 'dlg-box ' + (S.side === 'right' ? 'right' : S.side === 'none' ? 'none' : '');
        box.querySelector('.dlg-name').textContent = S.name.replace('{starter}', this.starterName);
        if (S.side !== 'none') box.querySelector('.dlg-face').src = portrait(who === 'starter' ? this.starterSp || 'cinderwing' : who);
        this.$text = box.querySelector('.dlg-text');
        this.$text.textContent = '';
        T.full = text;
        let k = 0;
        const fast = this.settings.calm;
        if (fast) { this.$text.textContent = text; return; }
        T.typing = { id: setInterval(() => {
            k += 2;
            this.$text.textContent = text.slice(0, k);
            if (k % 6 === 0) this.audio.ui('tick');
            if (k >= text.length) { clearInterval(T.typing.id); T.typing = null; }
        }, 22) };
    }
    skipTalk() {
        const T = this.talking;
        if (!T) return;
        this.skipAll = true;
        setTimeout(() => { this.skipAll = false; }, 0);
        if (T.typing) clearInterval(T.typing.id);
        T.i = T.lines.length;
        this._endTalk();
    }
    _endTalk() {
        const T = this.talking;
        this.talking = null;
        this.talkEndAt = performance.now();
        $('dialogue').hidden = true;
        T?.resolve();
        this.on?.('screens');
    }

    // ------------------------------------------------------------------ the battle HUD
    showBattleHud(on) { $('bhud').hidden = !on; if (!on) { this.hidePopups(); $('duel').hidden = true; } }

    /** How much of the screen the HUD covers, for fitting the map. */
    pads() {
        const top = $('bh-top').getBoundingClientRect().bottom + 6;
        const bb = $('bh-bottom').getBoundingClientRect();
        const narrow = innerHeight < 480;
        if (narrow) return { top, bottom: 8, left: 0, right: bb.width + 16 };
        return { top, bottom: Math.max(0, innerHeight - bb.top + 6), left: 0, right: 0 };
    }

    setHeader(B, G) {
        $('bh-turn').textContent = `Turn ${B.turn}${B.limit ? ' / ' + B.limit : ''}${B.phase === 'e' ? ' · The Chain' : ''}`;
        $('bh-obj').textContent = B.objective.text;
        $('funds-p').textContent = B.funds.p;
        $('funds-e').textContent = B.funds.e;
        const pp = B.power.p, pe = B.power.e;
        $('meter-p').style.width = `${(pp.meter / POWER.max) * 100}%`;
        $('meter-p').parentElement.classList.toggle('full', pp.meter >= POWER.max);
        const ready = pp.meter >= POWER.max && !pp.on && B.phase === 'p' && !B.over;
        $('btn-power').disabled = !ready;
        $('btn-power').classList.toggle('ready', ready);
        $('btn-power').title = pp.def ? `${pp.def.name}: ${pp.def.desc}` : '';
        $('co-p-face').src = portrait('kestrel', 80);
        const coE = B.co.e;
        $('co-e-face').src = portrait(coE ? COS[coE].portrait : 'grisk', 80, coE ? null : null);
        $('co-e-face').style.visibility = coE ? 'visible' : 'hidden';
        $('co-e-name').textContent = coE ? COS[coE].name : B.ch < 0 ? 'Poachers' : 'The Chain';
        $('meter-e').style.width = pe.def ? `${(pe.meter / POWER.max) * 100}%` : '0%';
        $('meter-e').parentElement.style.visibility = pe.def ? 'visible' : 'hidden';
        $('btn-end').disabled = B.phase !== 'p' || !!B.over;
    }

    tileCard(B, x, y) {
        const el = $('tilecard');
        if (x == null) { el.innerHTML = ''; el.hidden = true; return; }
        el.hidden = false;
        const i = y * B.w + x;
        const id = B.tiles[i], T = TERRAIN[id];
        const own = B.own[i];
        let s = `<b>${T.name}</b><div>${'★'.repeat(T.def)}${T.def ? '' : '<span class="dim">no cover</span>'}</div>`;
        if (T.prop) s += `<div>${own === 'p' ? '🟦 Yours' : own === 'e' ? '🟥 The Chain\'s' : '⬜ Free'}${B.capt[i] < 20 ? ` · ${B.capt[i]}/20` : ''}</div>`;
        if (T.heal) s += '<div>Heals 20%</div>';
        if (B.treasure[i]) s += '<div>✨ Something glints…</div>';
        el.innerHTML = s;
    }

    unitCard(u, B) {
        const el = $('unitcard');
        if (!u) { el.hidden = true; return; }
        el.hidden = false;
        const def = SPECIES[u.key] || UNITS[u.key];
        const hpPct = Math.round((u.hp / u.hpMax) * 100);
        const sk = u.skill ? SKILLS[u.skill] : null;
        const tags = [];
        if (u.chained) tags.push('⛓️ Chained');
        if (u.boss) tags.push('👑 Commander');
        if (u.guest) tags.push('🤝 Ally');
        if (u.stun > 0) tags.push('💫 Stunned');
        if (u.ward > 0) tags.push('🛡️ Warded');
        if (u.rally > 0) tags.push('📯 Rallied');
        if (u.acted && u.team === B.phase) tags.push('Done');
        const stage = SPECIES[u.key] ? ` · ${STAGE_NAMES[u.stage]}` : '';
        el.innerHTML = `<b>${esc(u.name)}</b> <span class="dim">Lv ${u.lv} ${def ? (SPECIES[u.key] ? SPECIES[u.key].name : CLASSES[u.cls].name) : ''}${stage}</span>
            <div class="bar hp"><div style="width:${hpPct}%"></div></div>
            <div class="mini"><span>❤️ ${u.hp}/${u.hpMax}</span><span>⚔️ ${u.atk}</span><span>🛡️ ${u.def}</span><span>💨 ${u.spd}</span><span>👣 ${u.mv}</span><span>🎯 ${u.rng[0] === u.rng[1] ? u.rng[0] : u.rng.join('–')}${u.indirect ? ' (siege)' : ''}</span></div>
            <div class="mini">${elTag(u.el)} ${u.traits.map((t) => TRAITS[t] ? `<span title="${esc(TRAITS[t].desc)}">${TRAITS[t].icon}${TRAITS[t].name}</span>` : '').join(' ')}</div>
            ${sk ? `<div class="mini"><span title="${esc(sk.desc)}">${sk.icon} ${sk.name}${u.cd > 0 ? ` (rests ${u.cd})` : ''}</span></div>` : ''}
            ${tags.length ? `<div class="mini">${tags.join(' · ')}</div>` : ''}`;
        void starsOf;
    }

    hidePopups() { $('actmenu').hidden = true; $('forecast').hidden = true; }

    /** Place a popup next to a screen point without leaving the screen or covering the HUD. */
    _place(el, px, py) {
        el.hidden = false;
        const r = el.getBoundingClientRect();
        const W = innerWidth, H = innerHeight;
        let x = px + 40, y = py - r.height / 2;
        if (x + r.width > W - 8) x = px - 40 - r.width;
        if (x < 8) x = Math.max(8, (W - r.width) / 2);
        const top = $('bh-top').getBoundingClientRect().bottom + 6;
        const bot = $('bh-bottom').getBoundingClientRect().top - 6;
        y = Math.max(top, Math.min(y, bot - r.height, H - r.height - 8));
        if (y < 8) y = 8;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }

    /** The action menu: options [{ act, label, disabled }]. */
    actMenu(opts, at, onPick) {
        const el = $('actmenu');
        el.innerHTML = opts.map((o) => `<button class="btn${o.act === 'cancel' ? '' : o.primary ? ' primary' : ''}" data-act="${o.act}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`).join('');
        el.onclick = (e) => { const b = e.target.closest('button[data-act]'); if (b && !b.disabled) onPick(b.dataset.act); };
        this._place(el, at.x, at.y);
        const first = el.querySelector('button:not([disabled])');
        first?.focus({ preventScroll: true });
    }

    /** The fight forecast, AW style: what each side will deal, as damage and % of the other's HP. */
    forecast(B, a, d, f, at, { onYes, onNo, note = '' }) {
        const el = $('forecast');
        const pct = (lo, hi, of) => { const a1 = Math.round((lo / of.hpMax) * 100), b1 = Math.round((hi / of.hpMax) * 100); return a1 === b1 ? `${a1}%` : `${a1}–${b1}%`; };
        const twice = (w) => f.strikes.filter((s) => s.by === w).length > 1 ? ' ×2' : '';
        const first = f.strikes[0]?.by === 'd' ? '<div class="fc-note">⚔️ First Strike: it hits first!</div>' : '';
        el.innerHTML = `<div class="fc">
            <div class="side me"><b>${esc(a.name)}</b><div class="big">${pct(f.dmg[0], f.dmg[1], d)}${twice('a')}</div><div class="dim">${f.dmg[0]}–${f.dmg[1]} dmg</div><div>${elTag(a.el)}</div></div>
            <div class="vs">VS</div>
            <div class="side foe"><b>${esc(d.name)}</b><div class="big">${f.counter ? pct(f.cdmg[0], f.cdmg[1], a) + twice('d') : '—'}</div><div class="dim">${f.counter ? `${f.cdmg[0]}–${f.cdmg[1]} back` : 'no counter'}</div><div>${elTag(d.el)}</div></div>
        </div>${first}<div class="fc-note">${note || (f.hpD <= 0 ? '💀 Likely knocks it out' : `It keeps about ${Math.round((f.hpD / d.hpMax) * 100)}%`)} · crit ${Math.round(f.crit * 100)}%</div>
        <div class="sheet-foot" style="margin-top:6px"><button class="btn" data-x="no">Back</button><button class="btn primary" data-x="yes">⚔️ Attack</button></div>`;
        el.onclick = (e) => { const b = e.target.closest('button[data-x]'); if (!b) return; if (b.dataset.x === 'yes') onYes(); else onNo(); };
        this._place(el, at.x, at.y);
        el.querySelector('[data-x="yes"]').focus({ preventScroll: true });
    }

    /** A simple yes/no popup (skills, unchaining). */
    confirmPop(html, yes, at, { onYes, onNo }) {
        const el = $('forecast');
        el.innerHTML = `${html}<div class="sheet-foot" style="margin-top:6px"><button class="btn" data-x="no">Back</button><button class="btn primary" data-x="yes">${yes}</button></div>`;
        el.onclick = (e) => { const b = e.target.closest('button[data-x]'); if (!b) return; if (b.dataset.x === 'yes') onYes(); else onNo(); };
        this._place(el, at.x, at.y);
        el.querySelector('[data-x="yes"]').focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ the close-up fight
    duelOpen(ev) {
        $('duel').hidden = false;
        $('bh-top').style.visibility = $('bh-bottom').style.visibility = 'hidden';
        this.hidePopups();
        const set = (side, s) => {
            const el = $('duel-' + side);
            el.classList.toggle('foe', s.team === 'e');
            el.querySelector('.dn').textContent = `${s.name} · Lv ${s.lv}`;
            this._duelHp(el, s.hp, s.hpMax);
            el.dataset.max = s.hpMax;
        };
        set('a', ev.a); set('d', ev.d);
    }
    _duelHp(el, hp, max) {
        const f = el.querySelector('.fill');
        f.style.width = `${Math.max(0, (hp / max) * 100)}%`;
        f.classList.toggle('low', hp / max < 0.3);
        el.querySelector('.hpn').textContent = `${Math.max(0, hp)} / ${max}`;
    }
    duelHp(side, hp) { const el = $('duel-' + side); this._duelHp(el, hp, +el.dataset.max); }
    duelClose() { $('duel').hidden = true; $('bh-top').style.visibility = $('bh-bottom').style.visibility = ''; }

    powerCut(ev) {
        const el = $('power-cut');
        el.hidden = true;
        void el.offsetWidth;
        el.className = ev.team === 'e' ? 'e' : '';
        el.querySelector('img').src = portrait(ev.team === 'p' ? 'kestrel' : COS[ev.co]?.portrait || 'grisk', 120);
        el.querySelector('.pc-name').textContent = ev.name + '!';
        el.querySelector('.pc-desc').textContent = ev.desc;
        el.hidden = false;
        clearTimeout(this._pcT);
        this._pcT = setTimeout(() => { el.hidden = true; }, 1700);
    }

    // ------------------------------------------------------------------ results
    showResult(G, B) {
        const r = B.result;
        if (!r) return;
        const reasons = {
            rout: 'The Chain is routed.', boss: 'Their commander has fallen.', hq: 'The stronghold is yours.', held: 'You held the line.',
            reach: 'You made it through.', freed: 'The wyrm is free.', tamer: 'Kestrel has fallen. The flock scatters home.',
            retreat: 'You fell back to the roost.', time: 'Out of time: Chain reinforcements arrive.', target: 'The wyrm you came to save has fallen.',
            flock: 'Every dragon is down. Kestrel retreats.',
        };
        $('res-title').textContent = r.win ? 'Victory!' : 'Defeat…';
        $('res-rank').textContent = r.rank || '';
        $('res-rank').hidden = !r.rank;
        let s = `<p>${reasons[r.reason] || ''}</p>`;
        if (r.win) {
            s += `<div class="reward">🪙 <b>${r.gold}</b> gold${r.rank ? ` (rank ${r.rank})` : ''}</div>`;
            for (const sp of r.eggs) s += `<div class="reward"><img src="${eggIcon(sp, 64)}" alt=""> A ${esc(SPECIES[sp].name)} egg!</div>`;
            for (const sp of r.found) s += `<div class="reward"><img src="${eggIcon(sp, 64)}" alt=""> Found: a ${esc(SPECIES[sp].name)} egg</div>`;
            if (r.unlock.includes('breed')) s += '<div class="reward">💞 Breeding unlocked at the roost!</div>';
            if (r.unlock.includes('wild')) s += '<div class="reward">🌲 Wild Hunts unlocked on the Journey map!</div>';
            if (r.song) s += `<div class="reward">🎵 Your Wyrmsong grows stronger!</div>`;
            s += '<div class="reward">🔥 Every incubating egg grew warmer.</div>';
        } else s += '<p class="dim">Your dragons keep the experience they earned. Raise them, breed them, and try again.</p>';
        for (const rid of r.recruited) { const d = G.meta.dragons.find((x) => x.rid === rid); if (d) s += `<div class="reward">⛓️‍💥 ${esc(d.name)} the ${esc(SPECIES[d.sp].name)} joined your roost!</div>`; }
        $('res-body').innerHTML = s;
        $('btn-res-retry').hidden = r.win || B.ch < 0;
        this.openScreen('result');
    }

    storySoFar(G) {
        let s = '';
        for (const C of CHAPTERS) {
            if (!G.meta.cleared[C.id]) continue;
            const last = C.post[C.post.length - 1];
            s += `<h3>${esc(C.title)}</h3><p>${esc((last ? last[1] : '').replace(/\{starter\}/g, this.starterName))}</p>`;
        }
        $('story-body').innerHTML = s || '<p class="dim">Your story has only just begun.</p>';
        this.openScreen('story');
    }
}
