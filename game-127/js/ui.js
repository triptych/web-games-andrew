// The DOM: the HUD, the panel for each phase of the month (Free Day map and places, planner, periods,
// expeditions, the festival, Starfall Night), the status sheet, the album and the small screens. It reads G and
// sends commands through main.js; it never writes G. The visual novel box is js/vn.js.

import { PERIODS, MONTHS, SEASON, HEARTS, FREE_AP, SLOTS } from './config.js';
import { ART } from './assets.js';
import { CAST, FRIENDS, portrait } from './sim/data/cast.js';
import { ACTIVITIES, ACT } from './sim/data/activities.js';
import { ITEMS, ITEM } from './sim/data/items.js';
import { QUEST } from './sim/data/quests.js';
import { REGIONS, REGION, APPROACH } from './sim/data/adventures.js';
import { CONTESTS, TALK_TOPICS } from './sim/data/events.js';
import { PLACES, PLACE } from './sim/data/places.js';
import { ENDINGS, ENDING } from './sim/data/endings.js';
import { STORY } from './sim/data/story.js';
import { HEART_SCENES } from './sim/data/hearts.js';
import { STAT_NAMES, questChance, power } from './sim/rules.js';
import { placeOpen, heartReady, canDo, advStep, advChance, advFoe, contestOpen } from './sim/game.js';
import { sceneDef } from './sim/scenes.js';
import { CGS } from './assets.js';
import { FACES } from './faces.js';
import { MUSIC } from './audio.js';
import { esc } from './vn.js';

const $ = (id) => document.getElementById(id);
const SHORT = { str: 'Str', vit: 'Vit', int: 'Int', grc: 'Grace', cha: 'Charm', mor: 'Moral', fth: 'Faith', art: 'Art', cmb: 'Combat', mag: 'Magic', elo: 'Elo', com: 'Comm', cun: 'Cunning', drc: 'Dragon', fame: 'Renown', fav: 'Favor', sts: 'Stress', bond: 'Bond' };
const STAT_GROUPS = [
    ['Body', ['str', 'vit', 'cmb']], ['Mind', ['int', 'mag', 'elo']], ['Refinement', ['grc', 'cha', 'art']],
    ['Spirit', ['mor', 'fth', 'bond']], ['Worldly', ['com', 'cun']], ['Standing', ['fame', 'fav']], ['Blood', ['drc', 'sts']],
];
const KIND_TABS = [['lesson', 'Lessons'], ['job', 'Work'], ['rest', 'Rest'], ['quest', 'Quests'], ['adv', 'Expeditions']];
const VERDICT = { great: 'Splendid', ok: 'Done', fail: 'It went badly', rebel: 'He ran off', sick: 'Ill in bed', broke: 'No money', retreat: 'Turned back' };
const r1 = (v) => Math.round(v * 10) / 10;

export function fxChips(fx = {}, gold = 0) {
    const out = [];
    if (gold) out.push(`<span class="fx gold">${gold > 0 ? '+' : ''}${Math.round(gold)} 🪙</span>`);
    for (const k in fx) {
        const v = r1(fx[k]);
        if (!v) continue;
        if (k.startsWith('aff.')) { out.push(`<span class="fx love">${v > 0 ? '+' : ''}${v} ♥ ${esc(CAST[k.slice(4)]?.name || '')}</span>`); continue; }
        const bad = k === 'sts' ? v > 0 : v < 0;
        out.push(`<span class="fx ${bad ? 'down' : 'up'}">${v > 0 ? '+' : ''}${v} ${SHORT[k] || k}</span>`);
    }
    return out.join(' ');
}

function hearts(n) { return `<span class="hearts">${'♥'.repeat(n)}<span class="off">${'♥'.repeat(4 - n)}</span></span>`; }
function face(id, age) {
    const k = portrait(id, 'neutral', age);
    if (!k) return '';
    const f = FACES[k];
    return `style="background-image:url('${ART.por(k)}')${f ? `;--fx:${f[0]};--fy:${f[1]};--fw:${f[2]}` : ''}"`;
}

export class UI {
    constructor({ audio, settings, send, vn, onSettings, onAlbumReplay, onSlot }) {
        this.audio = audio;
        this.settings = settings;
        this.send = send;
        this.vn = vn;
        this.onSettings = onSettings;
        this.onAlbumReplay = onAlbumReplay;
        this.onSlot = onSlot;
        this.stack = [];
        this.place = null;          // the open place on the Free Day
        this.sub = null;            // a place's sub-view: 'shop' | 'board' | 'talk'
        this.gift = null;           // the gift picked for a visit
        this.planSlots = [];
        this.planTab = 'lesson';
        this.results = [];          // period results not yet shown (UI only)
        this.encounter = null;      // the last expedition encounter, until dismissed
        this.album = null;
        this.albumTab = 'scenes';
        this.lastPanelKey = '';
        this._wire();
    }

    // ------------------------------------------------------------ screens
    openScreen(id) {
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((x) => x !== id);
        this.stack.push(id);
        el.dataset.opened = String(performance.now());
        requestAnimationFrame(() => {
            const f = el.querySelector('.btn.primary:not([hidden]), .btn:not([hidden]), button:not([hidden])');
            if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true });
        });
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((x) => x !== id);
    }
    closeTop() { const t = this.top(); if (t && t !== 'title' && t !== 'ending') this.closeScreen(t); }
    top() { return this.stack[this.stack.length - 1] || null; }
    isOpen(id) { return this.stack.includes(id); }

    _wire() {
        // a sheet ignores the click from a press that began outside it, so the tap that opened it can't close it
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (performance.now() - (+el.dataset.opened || 0) < 250) return;
                const c = e.target.closest('[data-close]');
                if (c) { this.audio.ui('click'); this.closeScreen(el.id); }
                else if (e.target === el && el.classList.contains('modal')) this.closeScreen(el.id);
            });
        }
        // settings
        const s = this.settings;
        const bind = (id, key, num = true) => {
            const el = $(id);
            if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = String(s[key]);
            el.addEventListener('input', () => { s[key] = el.type === 'checkbox' ? el.checked : num ? +el.value : el.value; this.onSettings(s); });
        };
        bind('set-music', 'music'); bind('set-sfx', 'sfx'); bind('set-voice', 'voice'); bind('set-speed', 'speed'); bind('set-auto', 'auto'); bind('set-narr', 'narr');
        $('album-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            this.albumTab = b.dataset.tab;
            this.renderAlbum();
        });
        $('album-body').addEventListener('click', (e) => this._albumClick(e));
        $('viewer').addEventListener('click', () => { $('viewer').hidden = true; });
        $('panel').addEventListener('click', (e) => this._panelClick(e));
        $('slots-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-slot]');
            if (b) this.onSlot(this.slotMode, +b.dataset.slot);
        });
    }

    toast(text, cls = '') {
        const t = document.createElement('div');
        t.className = 'toast ' + cls;
        t.innerHTML = text;
        $('toasts').appendChild(t);
        setTimeout(() => t.remove(), 3500);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }

    popup(title, html, foot = null) {
        $('popup-title').textContent = title;
        $('popup-body').innerHTML = html;
        $('popup-foot').innerHTML = foot || '<button class="btn primary" data-close>OK</button>';
        this.openScreen('popup');
    }

    // ------------------------------------------------------------ HUD
    hud(G) {
        $('hud').hidden = !G;
        if (!G) return;
        $('hud-age').textContent = `Age ${G.age}`;
        $('hud-month').textContent = MONTHS[G.month - 1];
        $('hud-gold').textContent = G.gold.toLocaleString();
        $('hud-sts').style.width = `${Math.min(100, G.stats.sts)}%`;
    }

    // ------------------------------------------------------------ the phase panel
    /** Render the panel for the current state. Returns what it shows ('result', 'scene', a phase...). */
    render(G) {
        const panel = $('panel');
        if (this.encounter && G.phase !== 'adventure' && !this.results.length && !G.scene) this.encounter = null;
        let what;
        if (this.encounter) what = 'encounter';
        else if (this.results.length) what = 'result';
        else if (G.scene) what = 'scene';
        else what = G.phase;
        panel.hidden = what === 'scene';
        // the expedition's creature: the danger being faced, or the one just met while its outcome is shown
        const foe = what === 'adventure' ? advFoe(G) : what === 'encounter' ? this.encounter.foe : null;
        this.setFoe(foe, what === 'encounter' ? (this.encounter.ok ? 'won' : 'lost') : 'idle', what === 'encounter' ? this.encounter.a : null);
        panel.classList.toggle('bottom', !!foe);
        if (what === 'scene') { this.lastPanelKey = ''; return what; }
        this.vn.clearStage();
        $('dlg').hidden = true;
        let html = '';
        switch (what) {
            case 'encounter': html = this._encounter(G); break;
            case 'result': html = this._result(G); break;
            case 'free': html = this.place ? this._place(G) : this._free(G); break;
            case 'plan': html = this._plan(G); break;
            case 'run': html = this._run(G); break;
            case 'adventure': html = this._adventure(G); break;
            case 'festival': html = this._festival(G); break;
            case 'starfall': html = this._starfall(G); break;
            default: html = '';
        }
        const key = what + '|' + html.length + '|' + html.slice(0, 200) + html.slice(-200);
        if (key !== this.lastPanelKey) {
            this.lastPanelKey = key;
            const keepScroll = panel.dataset.what === what ? panel.scrollTop : 0;
            panel.innerHTML = `<div class="wrap">${html}</div>`;
            panel.scrollTop = keepScroll;
            panel.dataset.what = what;
        }
        if (foe) this.placeFoe();
        return what;
    }

    /** Show an expedition creature (or none). `mode` is idle, won (struck, fades back) or lost (lunges). */
    setFoe(id, mode = 'idle', approach = null) {
        const el = $('foe');
        if (!id) { if (!el.hidden) { el.hidden = true; el.dataset.id = ''; el.dataset.mode = ''; } return; }
        const img = el.querySelector('img');
        if (el.dataset.id !== id) {
            el.dataset.id = id;
            el.dataset.mode = '';
            img.src = ART.foe(id);
            el.className = 'layer';
            el.hidden = false;
            void el.offsetWidth;             // restart the entrance animation
            el.classList.add('enter');
        }
        el.hidden = false;
        el.classList.toggle('boss', id.endsWith('-boss'));
        if (el.dataset.mode !== mode) {
            el.dataset.mode = mode;
            el.classList.remove('won', 'lost');
            if (mode !== 'idle') {
                el.style.setProperty('--hit', { dragon: 'rgba(255,140,60,.95)', magic: 'rgba(190,150,255,.95)', faith: 'rgba(255,240,170,.95)', sneak: 'rgba(150,170,200,.8)' }[approach] || 'rgba(255,220,150,.9)');
                void el.offsetWidth;
                el.classList.add(mode);
            }
        }
    }

    /** Keep the creature between the HUD and the top of the choices card. */
    placeFoe() {
        const el = $('foe');
        const card = $('panel').querySelector('.result');
        if (el.hidden || !card) return;
        const app = $('app').getBoundingClientRect();
        const r = card.getBoundingClientRect();
        if (r.left - app.left > app.width * 0.3) {
            // side by side (short landscape screens): the creature fills the space left of the card
            el.style.bottom = '6px';
            el.style.right = Math.max(0, app.right - r.left + 8) + 'px';
        } else {
            el.style.right = '0';
            el.style.bottom = Math.max(0, app.bottom - r.top + 4) + 'px';
        }
    }

    _panelClick(e) {
        const b = e.target.closest('[data-k]');
        if (!b || b.disabled || b.classList.contains('off')) return;
        const [k, a, c] = b.dataset.k.split(':');
        this.audio.ui('click');
        const G = this.G;
        switch (k) {
            case 'place': this.place = a; this.sub = null; this.gift = null; break;
            case 'back': if (this.sub) this.sub = null; else { this.place = null; } break;
            case 'sub': this.sub = a; break;
            case 'endFree': this.send({ t: 'endFree' }); this.planSlots = []; return;
            case 'gift': this.gift = this.gift === a ? null : a; break;
            case 'visit': this.send({ t: 'visit', who: a, gift: this.gift || undefined }); this.gift = null; return;
            case 'talk': this.send({ t: 'talk', topic: a }); this.sub = null; return;
            case 'do': this.send({ t: 'do', place: a, action: c }); return;
            case 'buy': if (this.send({ t: 'buy', item: a })) this.audio.ui('buy'); return;
            case 'use': this.send({ t: 'use', item: a }); return;
            case 'accept': this.send({ t: 'accept', quest: a }); return;
            case 'drop': this.send({ t: 'drop', quest: a }); return;
            case 'tab': this.planTab = a; break;
            case 'pick': {
                const id = b.dataset.k.slice(5);
                if (this.planSlots.length < PERIODS) this.planSlots.push(id);
                break;
            }
            case 'unslot': this.planSlots.splice(+a, 1); break;
            case 'repeat': this.planSlots = (G.lastPlan || []).filter((s) => canDo(G, s)).slice(0, PERIODS); break;
            case 'clear': this.planSlots = []; break;
            case 'plan': if (this.send({ t: 'plan', slots: this.planSlots })) this.planSlots = []; return;
            case 'next': this.send({ t: 'next' }); return;
            case 'dismiss': {
                this.results.shift();
                this.lastPanelKey = '';
                // straight on to the next period when there is one
                if (!this.results.length && c === 'go' && G.phase === 'run' && !G.scene) { this.send({ t: 'next' }); return; }
                break;
            }
            case 'enc': this.encounter = null; break;
            case 'approach': this.send({ t: 'approach', a }); return;
            case 'retreat': this.send({ t: 'retreat' }); return;
            case 'contest': this.send({ t: 'contest', id: a === '-' ? null : a }); return;
            case 'starfall': this.send({ t: 'starfall', who: a === '-' ? null : a }); return;
            case 'status': this.openStatus(G); return;
        }
        this.refresh();
    }

    /** Redraw after a panel click. Goes through main.js, because the click can leave a scene playing (the last
     *  period's Continue at the start of a month with a story scene), and only main draws the VN layer. */
    refresh() { if (this.G) { this.lastPanelKey = ''; if (this.onRefresh) this.onRefresh(); else this.render(this.G); } }

    // ---------------------------------------------------------------- Free Day
    _free(G) {
        this.vn.setBg('city'); this.vn.dim(true);
        const ap = Array.from({ length: FREE_AP }, (_, i) => `<i class="${i < G.ap ? 'on' : ''}"></i>`).join('');
        const cards = PLACES.filter((p) => placeOpen(G, p.id)).map((p) => {
            let badge = '';
            if (p.friend && G.flags['met_' + p.friend]) {
                if (G.done['visit:' + p.friend]) badge = `<span class="badge done">visited</span>`;
                else if (heartReady(G, p.friend)) badge = `<span class="badge">♥ ${esc(CAST[p.friend].name)}</span>`;
            }
            return `<button class="card" data-k="place:${p.id}"><span class="t"><span class="ico">${p.icon}</span>${esc(p.name)}</span><span class="d">${esc(p.desc)}</span>${badge}</button>`;
        }).join('');
        return `<div class="head"><div><h2>Free Day</h2><div class="sub">${MONTHS[G.month - 1]} · ${esc(G.name)} is ${G.age} · ${SEASON[G.month - 1]} in Aurelmere</div></div>
            <span class="ap">Actions ${ap}</span></div>
            <div class="grid">${cards}</div>
            <div class="actions sticky-foot"><button class="btn" data-k="status">Status</button><button class="btn primary" data-k="endFree">Plan the month →</button></div>`;
    }

    _place(G) {
        const P = PLACE[this.place];
        this.vn.setBg(P.bg); this.vn.dim(true);
        const noAp = G.ap <= 0;
        let body = '';
        // the friend who can be found here
        const f = P.friend;
        if (f && G.flags['met_' + f]) {
            const C = CAST[f];
            const k = G.hearts[f];
            const ready = heartReady(G, f);
            const visited = G.done['visit:' + f];
            const gifts = Object.entries(G.inv).filter(([id, n]) => n > 0 && ITEM[id]?.kind === 'gift');
            const giftRow = gifts.length ? `<div class="gift-row">${gifts.map(([id, n]) => `<button class="gift ${this.gift === id ? 'sel' : ''}" data-k="gift:${id}">${ITEM[id].icon} ${esc(ITEM[id].name)} ×${n}</button>`).join('')}</div>`
                : '<p class="dim">No gifts to give. The market sells them.</p>';
            const next = k < 4 ? `Next heart scene: ${HEARTS[k].aff} affection, age ${HEARTS[k].age}+` : 'All four heart scenes seen.';
            body += `<div class="panel-box"><div class="place-head"><div class="face" ${face(f, G.age)}></div><div style="flex:1">
                <b style="font-family:var(--display);color:var(--gold-hi)">${esc(C.full || C.name)}</b> ${hearts(k)}${G.partner === f ? ' <span class="fx love">betrothed</span>' : ''}
                <div class="stat"><span>Affection</span><span class="bar aff"><span style="width:${G.aff[f]}%"></span></span><span class="v">${Math.round(G.aff[f])}</span></div>
                <div class="dim" style="font-size:14px">${esc(C.blurb)}</div><div class="dim" style="font-size:13px">${next}${ready ? ' · <b style="color:var(--love)">ready now</b>' : ''}</div></div></div>
                <h3>Bring a gift?</h3>${giftRow}
                <div class="actions"><button class="btn primary" data-k="visit:${f}" ${visited || noAp ? 'disabled' : ''}>${visited ? 'Visited today' : `Visit ${esc(C.name)}${this.gift ? ' with ' + esc(ITEM[this.gift].name) : ''}`}</button></div></div>`;
        } else if (f) {
            body += `<p class="dim">Someone lives here whom the prince hasn't met yet.</p>`;
        }
        // the manor: talk with the prince
        if (this.place === 'manor') {
            const done = G.done.talk;
            body += `<div class="panel-box" style="margin-top:10px"><h3>Talk with ${esc(G.name)}</h3><div class="grid small">${TALK_TOPICS.map((t) => `<button class="card ${done || noAp ? 'off' : ''}" data-k="talk:${t.id}"><span class="t">${esc(t.name)}</span><span class="d">${esc(t.desc)}</span></button>`).join('')}</div>${done ? '<p class="dim">You have already talked today.</p>' : ''}</div>`;
        }
        // shop and quest board
        if (this.place === 'market') body += this._shop(G);
        if (this.place === 'guild') body += this._board(G);
        // the place's own actions
        const acts = P.actions.filter((a) => !a.free && a.id !== 'talk');
        if (acts.length) {
            body += `<div class="panel-box" style="margin-top:10px"><div class="grid small">${acts.map((a) => {
                const done = G.done[this.place + ':' + a.id];
                return `<button class="card ${done || noAp ? 'off' : ''}" data-k="do:${this.place}:${a.id}"><span class="t">${esc(a.name)}</span><span class="d">${esc(a.desc || '')}${done ? ' · done today' : ''}</span></button>`;
            }).join('')}</div></div>`;
        }
        const ap = Array.from({ length: FREE_AP }, (_, i) => `<i class="${i < G.ap ? 'on' : ''}"></i>`).join('');
        return `<div class="head"><div><h2>${P.icon} ${esc(P.name)}</h2><div class="sub">${esc(P.desc)}</div></div><span class="ap">Actions ${ap}</span></div>
            ${body}
            <div class="actions sticky-foot"><button class="btn" data-k="back">← Back to the city</button><button class="btn primary" data-k="endFree">Plan the month →</button></div>`;
    }

    _shop(G) {
        const rows = ITEMS.filter((it) => !(it.minAge && G.age < it.minAge)).map((it) => {
            const owned = it.kind === 'keepsake' ? !!G.keep[it.id] : (G.inv[it.id] || 0);
            const can = G.gold >= it.price && !(it.kind === 'keepsake' && owned);
            const use = it.kind === 'tonic' && owned ? `<button class="btn small" data-k="use:${it.id}">Use (${owned})</button>` : '';
            const kind = it.kind === 'gift' ? 'Gift' : it.kind === 'tonic' ? 'Tonic, used at once' : 'Keepsake: +20% to ' + (it.boosts || []).map((b) => ACT[b]?.name).join(', ');
            return `<div class="shop-item"><span class="ico">${it.icon}</span><div class="info"><b>${esc(it.name)}</b> <span class="fx gold">${it.price} 🪙</span>${it.kind === 'gift' && owned ? ` <span class="fx">have ${owned}</span>` : ''}
                <div>${esc(it.desc)} <i>${esc(kind)}</i></div></div>${use}<button class="btn small" data-k="buy:${it.id}" ${can ? '' : 'disabled'}>${it.kind === 'keepsake' && owned ? 'Owned' : 'Buy'}</button></div>`;
        }).join('');
        return `<div class="panel-box" style="margin-top:10px"><h3>The market stalls</h3><p class="dim">Buying costs no actions.</p>${rows}</div>`;
    }

    _board(G) {
        const qcard = (id, taken) => {
            const q = QUEST[id];
            const ch = Math.round(questChance(G, q) * 100);
            const need = Object.entries(q.check).map(([k, v]) => `<span class="fx ${G.stats[k] >= v ? 'up' : 'down'}">${SHORT[k]} ${v}</span>`).join(' ');
            return `<div class="card"><span class="t">📜 ${esc(q.name)}</span><span class="d">${esc(q.text)} <i>— ${esc(q.giver)}</i></span>
                <span class="m">Needs ${need} · chance <b class="odds">${ch}%</b></span><span class="m">Reward ${fxChips(Object.fromEntries(Object.entries(q.reward).filter(([k]) => k !== 'gold' && k !== 'aff')), q.reward.gold || 0)}</span>
                <span class="actions" style="margin-top:4px">${taken ? `<button class="btn small" data-k="drop:${id}">Give up</button>` : `<button class="btn small" data-k="accept:${id}" ${G.quests.length >= 2 ? 'disabled' : ''}>Accept</button>`}</span></div>`;
        };
        return `<div class="panel-box" style="margin-top:10px"><h3>The quest board</h3><p class="dim">Accept up to two. Each takes one period of the month: schedule it in the planner.</p>
            ${G.quests.length ? `<h3>Accepted</h3><div class="grid">${G.quests.map((q) => qcard(q, true)).join('')}</div>` : ''}
            <h3>Posted this month</h3><div class="grid">${G.board.length ? G.board.map((q) => qcard(q, false)).join('') : '<p class="dim">Nothing new.</p>'}</div></div>`;
    }

    // ---------------------------------------------------------------- the planner
    _catalogue(G) {
        const t = this.planTab;
        const list = [];
        if (t === 'quest') {
            for (const q of G.quests) list.push({ id: 'quest:' + q, name: QUEST[q].name, d: QUEST[q].text, m: `chance ${Math.round(questChance(G, QUEST[q]) * 100)}%`, ok: !this.planSlots.includes('quest:' + q) });
            if (!list.length) return '<p class="dim">No quests accepted. Take one from the Guild Hall board on the Free Day.</p>';
        } else if (t === 'adv') {
            for (const R of REGIONS) {
                const ok = canDo(G, 'adv:' + R.id);
                const why = !ok ? (G.age < R.minAge ? `from age ${R.minAge}` : 'needs wings') : '';
                list.push({ id: 'adv:' + R.id, name: R.name, d: R.desc, m: ok ? `Danger ${R.base} · four encounters` : why, ok });
            }
        } else {
            for (const A of ACTIVITIES) {
                if (A.kind !== t) continue;
                const ok = canDo(G, A.id);
                let why = '';
                if (!ok) why = G.age < A.minAge ? `from age ${A.minAge}` : A.months ? 'summer only' : 'not yet unlocked';
                const fx = fxChips(Object.fromEntries(Object.entries(A.fx).map(([k, v]) => [k, v])));
                const money = A.cost ? `<span class="fx down">−${A.cost} 🪙</span>` : A.pay ? `<span class="fx gold">~${A.pay} 🪙</span>` : A.gamble ? '<span class="fx gold">a gamble</span>' : '';
                const st = A.sts ? `<span class="fx ${A.sts > 0 ? 'down' : 'up'}">${A.sts > 0 ? '+' : ''}${A.sts} Stress</span>` : '';
                list.push({ id: A.id, name: A.name, d: A.desc, m: ok ? `${money} ${st} ${fx}` : why, ok, raw: true });
            }
        }
        return `<div class="grid">${list.map((x) => `<button class="card ${x.ok && this.planSlots.length < PERIODS ? '' : 'off'}" data-k="pick:${x.id}"><span class="t">${esc(x.name)}</span><span class="d">${esc(x.d)}</span><span class="m">${x.raw ? x.m : esc(x.m)}</span></button>`).join('')}</div>`;
    }

    _plan(G) {
        this.vn.setBg('study'); this.vn.dim(true);
        const label = (id) => id.startsWith('quest:') ? '📜 ' + QUEST[id.slice(6)].name : id.startsWith('adv:') ? '🗺️ ' + REGION[id.slice(4)].name : ACT[id].name;
        const slots = Array.from({ length: PERIODS }, (_, i) => {
            const id = this.planSlots[i];
            return id ? `<button class="slot filled" data-k="unslot:${i}"><span class="n">Period ${i + 1}</span><b>${esc(label(id))}</b><span class="dim" style="font-size:12px">tap to remove</span></button>`
                : `<div class="slot"><span class="n">Period ${i + 1}</span><span class="dim">choose below</span></div>`;
        }).join('');
        const cost = this.planSlots.reduce((a, id) => a + (ACT[id]?.cost || 0), 0);
        const canRepeat = G.lastPlan && G.lastPlan.every((s) => canDo(G, s));
        const tabs = KIND_TABS.map(([k, n]) => `<button class="tab ${this.planTab === k ? 'on' : ''}" data-k="tab:${k}">${n}${k === 'quest' && G.quests.length ? ` (${G.quests.length})` : ''}</button>`).join('');
        const sts = G.stats.sts;
        const warn = sts >= 60 ? `<p style="color:var(--bad)">He is badly stressed (${Math.round(sts)}). Without rest he may skip lessons, fall ill, or lose control of his fire.</p>`
            : sts >= 40 ? `<p class="dim">Stress ${Math.round(sts)}: a rest period would do him good.</p>` : '';
        return `<div class="head"><div><h2>Plan ${MONTHS[G.month - 1]}</h2><div class="sub">Three periods of ten days. Lessons cost gold; jobs earn it.</div></div></div>
            <div class="panel-box"><div class="slots">${slots}</div>
            <div class="plan-sum"><span>Gold <b style="color:var(--gold-hi)">${G.gold}</b></span><span>Lessons cost <b style="color:${cost > G.gold ? 'var(--bad)' : 'var(--gold-hi)'}">${cost}</b></span>
            ${canRepeat ? '<button class="btn small" data-k="repeat">Same as last month</button>' : ''}<button class="btn small" data-k="clear">Clear</button><button class="btn small" data-k="status">Status</button></div>${warn}</div>
            <nav class="tabs" style="margin-top:10px">${tabs}</nav>
            ${this._catalogue(G)}
            <div class="actions sticky-foot"><button class="btn primary" data-k="plan" ${this.planSlots.length === PERIODS ? '' : 'disabled'}>Begin the month →</button></div>`;
    }

    // ---------------------------------------------------------------- the periods
    _art(id) {
        if (id.startsWith('adv:')) return ART.bg(REGION[id.slice(4)].bg);
        if (id.startsWith('quest:')) return ART.bg('guild');
        const A = ACT[id];
        return A && A.art ? ART.act(id) : ART.bg(A?.bg || 'study');
    }
    _label(id) {
        return id.startsWith('quest:') ? QUEST[id.slice(6)].name : id.startsWith('adv:') ? REGION[id.slice(4)].name : ACT[id]?.name || id;
    }

    _run(G) {
        const id = G.plan[G.period];
        this.vn.setBg(id.startsWith('adv:') ? REGION[id.slice(4)].bg : ACT[id]?.bg || 'study'); this.vn.dim(true);
        return `<div class="result panel-box"><div class="vignette" style="background-image:url('${this._art(id)}')"></div>
            <div class="verdict ok">Period ${G.period + 1} of ${PERIODS}</div><h2 style="margin:4px 0">${esc(this._label(id))}</h2>
            <p class="dim">${esc(id.startsWith('adv:') ? REGION[id.slice(4)].desc : id.startsWith('quest:') ? QUEST[id.slice(6)].text : ACT[id].desc)}</p>
            <div class="actions"><button class="btn primary" data-k="next">${id.startsWith('adv:') ? 'Set out' : 'Begin'} →</button></div></div>`;
    }

    _result(G) {
        const r = this.results[0];
        const id = r.id;
        const title = r.quest ? QUEST[r.quest].name : this._label(id);
        const more = G.phase === 'run' && this.results.length === 1 && !G.scene;
        const nextId = more ? G.plan[G.period] : null;
        const go = more ? `Next: ${esc(this._label(nextId))} →` : 'Continue';
        let log = '';
        if (r.log) log = `<div class="dim" style="font-size:14px">${r.log.map((e) => `${e.ok ? '✔' : '✘'} ${esc(e.text)}`).join('<br>')}</div>`;
        return `<div class="result panel-box"><div class="vignette" style="background-image:url('${this._art(id)}')"></div>
            <div class="verdict ${r.outcome}">${VERDICT[r.outcome] || r.outcome}</div><h2 style="margin:4px 0">${esc(title)}</h2>
            <p class="story">${esc(r.text)}</p>${log}
            <div class="m">${fxChips(r.fx, r.gold)}</div>${r.sickNext ? '<p style="color:var(--bad)">He is worn out and falls ill.</p>' : ''}
            <div class="actions"><button class="btn primary" data-k="dismiss::${more ? 'go' : ''}">${go}</button></div></div>`;
    }

    // ---------------------------------------------------------------- expeditions
    _adventure(G) {
        const A = G.adv, R = REGION[A.region];
        const step = advStep(G);
        const boss = A.k >= 3;
        this.vn.setBg(R.bg); this.vn.dim(true);
        const opts = step.opts.map((a) => {
            const P = APPROACH[a];
            const ch = Math.round(advChance(G, a) * 100);
            return `<button class="card" data-k="approach:${a}"><span class="t"><span class="ico">${P.icon}</span>${P.name}</span><span class="m">Chance <b class="odds">${ch}%</b> · ${Object.keys(P.stats).map((k) => SHORT[k]).join(' + ')}</span></button>`;
        }).join('');
        return `<div class="result panel-box"><div class="verdict ${boss ? 'fail' : 'ok'}">${boss ? 'The master of ' + esc(R.name) : `Danger ${A.k + 1} of 4`}</div>
            <h2 style="margin:4px 0">${boss ? esc(step.name) : esc(R.name)}</h2><p class="adv-step">${esc(step.text)}</p>
            <div class="grid small">${opts}</div>
            <div class="actions"><span class="dim" style="margin-right:auto">Won so far: ${A.won} · ${A.gold} 🪙</span><button class="btn" data-k="retreat">Turn back</button></div></div>`;
    }

    _encounter(G) {
        const e = this.encounter;
        return `<div class="result panel-box"><div class="verdict ${e.ok ? 'great' : 'fail'}">${e.ok ? 'Success' : 'Setback'} · ${APPROACH[e.a].icon} ${APPROACH[e.a].name}</div>
            <p class="story">${esc(e.text)}</p><div class="m">${fxChips(e.fx, e.gold || 0)}</div>
            <div class="actions"><button class="btn primary" data-k="enc">Continue →</button></div></div>`;
    }

    // ---------------------------------------------------------------- the festival and Starfall Night
    _festival(G) {
        this.vn.setBg('festival'); this.vn.dim(true);
        const cards = CONTESTS.map((C) => {
            const ok = contestOpen(G, C.id);
            const me = Math.round(power(G, C.stats));
            const field = Math.round(Math.max(...C.rivals.map((r) => r[2])) + (G.age - 10) * 6.2 + 6);
            return `<button class="card ${ok ? '' : 'off'}" data-k="contest:${C.id}"><span class="t">${esc(C.name)}</span>
                <span class="d">${Object.keys(C.stats).map((k) => STAT_NAMES[k]).join(', ')}. Rivals: ${C.rivals.map((r) => esc(r[0])).join(', ')}.</span>
                <span class="m">His skill <b class="odds">${me}</b> vs the best rival ~<b class="odds">${field}</b>${ok ? '' : ' · from age ' + C.minAge}</span></button>`;
        }).join('');
        return `<div class="head"><div><h2>The Harvest Festival</h2><div class="sub">Enter one contest. Winning brings fame, royal favour and a purse of gold.</div></div></div>
            <div class="grid">${cards}</div><div class="actions"><button class="btn" data-k="contest:-">Just enjoy the fair</button></div>`;
    }

    _starfall(G) {
        this.vn.setBg('rooftops'); this.vn.dim(true);
        const cards = FRIENDS.filter((f) => G.flags['met_' + f]).map((f) => {
            const ok = G.aff[f] >= 20;
            return `<button class="card ${ok ? '' : 'off'}" data-k="starfall:${f}"><span class="place-head"><span class="face" ${face(f, G.age)}></span><span><span class="t">${esc(CAST[f].name)}</span> ${hearts(G.hearts[f])}
                <span class="d" style="display:block">${ok ? 'Would love to watch the stars with him.' : 'Not close enough yet.'}</span></span></span></button>`;
        }).join('');
        return `<div class="head"><div><h2>Starfall Night</h2><div class="sub">Once a year the sky falls. Who does he watch it with?</div></div></div>
            <div class="grid">${cards}</div><div class="actions"><button class="btn" data-k="starfall:-">Watch from the manor garden with you</button></div>`;
    }

    // ---------------------------------------------------------------- status
    openStatus(G) {
        const s = G.stats;
        const bar = (k) => `<div class="stat"><span>${STAT_NAMES[k]}</span><span class="bar ${k}"><span style="width:${Math.min(100, s[k])}%"></span></span><span class="v">${Math.round(s[k])}</span></div>`;
        const groups = STAT_GROUPS.map(([g, ks]) => `<div><h3>${g}</h3>${ks.map(bar).join('')}</div>`).join('');
        const friends = FRIENDS.filter((f) => G.flags['met_' + f]).map((f) => `<div class="friend"><div class="face" ${face(f, G.age)}></div><div class="who"><b>${esc(CAST[f].name)}</b> ${hearts(G.hearts[f])}${G.partner === f ? ' <span class="fx love">betrothed</span>' : ''}
            <div class="stat" style="grid-template-columns:1fr 34px"><span class="bar aff"><span style="width:${G.aff[f]}%"></span></span><span class="v">${Math.round(G.aff[f])}</span></div>
            <div class="dim" style="font-size:12px">${esc(CAST[f].blurb.split('. ')[0])}.</div></div></div>`).join('') || '<p class="dim">He hasn\'t made any friends yet.</p>';
        const inv = Object.entries(G.inv).filter(([, n]) => n > 0).map(([id, n]) => `${ITEM[id].icon} ${esc(ITEM[id].name)} ×${n}`).join(' · ') || 'nothing';
        const keep = Object.keys(G.keep).map((id) => `${ITEM[id].icon} ${esc(ITEM[id].name)}`).join(' · ') || 'none';
        const por = ART.por(portrait('cael', s.sts >= 60 ? 'sad' : s.bond >= 60 ? 'happy' : 'neutral', G.age));
        $('status-title').textContent = `Prince ${G.name}`;
        $('status-body').innerHTML = `<div class="status-top"><div class="por" style="background-image:url('${por}')"></div><div class="info">
            <p><b style="color:var(--gold-hi)">Age ${G.age}</b>, ${MONTHS[G.month - 1]}. Raised by ${esc(G.gname)}, whom he calls ${esc(G.title)}.</p>
            <p>Gold ${G.gold} · Royal stipend ${Math.round(60 + s.fav)} a month</p>
            <p class="dim" style="font-size:14px">Bag: ${inv}<br>Keepsakes: ${keep}</p>
            <p class="dim" style="font-size:14px">${G.age < 18 ? `${18 - G.age} year${18 - G.age === 1 ? '' : 's'} until the court's judgment.` : ''}</p></div></div>
            <div class="stat-grid">${groups}</div><h3>Friends</h3><div class="friends">${friends}</div>`;
        this.openScreen('status');
    }

    // ---------------------------------------------------------------- album
    /** Every scene the album can hold, in order: [key, id, args, title]. */
    albumScenes() {
        const out = [];
        for (const s of STORY) out.push([s.id, s.id, {}, s.title]);
        for (const f of FRIENDS) for (const h of HEART_SCENES[f]) out.push([h.id, h.id, {}, h.title]);
        for (const f of FRIENDS) out.push([`starfall:${f}`, 'starfall', { friend: f, grown: true }, `Starfall Night with ${CAST[f].name}`]);
        for (const C of CONTESTS) out.push([`festival:${C.id}`, 'festival', { contest: C.id, won: true, rank: 1, rivals: C.rivals.map((r) => [r[0], r[1]]) }, `${C.name}: Victory`]);
        for (const E of ENDINGS) out.push([`ending:${E.id}`, 'ending', { ending: E.id, partner: null }, E.title]);
        return out;
    }

    static albumKey(id, args) {
        if (id === 'starfall') return `starfall:${args.friend}`;
        if (id === 'festival') return `festival:${args.contest}`;
        if (id === 'ending') return `ending:${args.ending}`;
        return id;
    }

    thumbOf(id, args) {
        try {
            const lines = sceneDef(id, args).lines;
            const cg = lines.find((l) => typeof l === 'string' && l.startsWith('@cg ') && l.length > 4);
            if (cg) return ART.cg(cg.slice(4).trim());
            const bg = lines.find((l) => typeof l === 'string' && l.startsWith('@bg '));
            if (bg) return ART.bg(bg.slice(4).trim());
        } catch { /* */ }
        return ART.bg('study');
    }

    openAlbum(album) {
        this.album = album;
        this.renderAlbum();
        this.openScreen('album');
    }

    renderAlbum() {
        const A = this.album;
        for (const b of $('album-tabs').children) b.classList.toggle('on', b.dataset.tab === this.albumTab);
        let html = '';
        if (this.albumTab === 'scenes') {
            const all = this.albumScenes();
            const have = all.filter(([k]) => A.scenes[k]).length;
            html = `<p class="dim">${have} of ${all.length} cutscenes. Tap one to watch it again.</p><div class="thumbs">${all.map(([k, id, args, title]) => {
                const rec = A.scenes[k];
                if (!rec) return `<div class="thumb locked"><span>???</span></div>`;
                return `<button class="thumb" data-replay="${esc(k)}" style="background-image:url('${this.thumbOf(rec.id, rec.args)}')"><span>${esc(rec.title || title)}</span></button>`;
            }).join('')}</div>`;
        } else if (this.albumTab === 'cgs') {
            const have = CGS.filter((c) => A.cgs.includes(c)).length;
            html = `<p class="dim">${have} of ${CGS.length} illustrations.</p><div class="thumbs">${CGS.map((c) => A.cgs.includes(c)
                ? `<button class="thumb" data-view="${c}" style="background-image:url('${ART.cg(c)}')"><span></span></button>` : '<div class="thumb locked"><span>???</span></div>').join('')}</div>`;
        } else if (this.albumTab === 'endings') {
            html = `<p class="dim">${A.endings.length} of ${ENDINGS.length} endings.</p><div class="thumbs">${ENDINGS.map((E) => A.endings.includes(E.id)
                ? `<button class="thumb" data-view="${E.cg}" data-cap="${esc(E.title)}" style="background-image:url('${ART.cg(E.cg)}')"><span>${esc(E.title)}</span></button>`
                : `<div class="thumb locked"><span>${E.bad ? '???' : '??? · ' + esc(E.hint.split(/[.!?]/)[0].slice(0, 60))}…</span></div>`).join('')}</div>`;
        } else {
            html = `<p class="dim">Music composed with ElevenLabs.</p>${MUSIC.map((m) => `<div class="track"><span>${m[0].toUpperCase() + m.slice(1)}</span><button class="btn small" data-music="${m}">${this.audio.current === m ? '♪ Playing' : 'Play'}</button></div>`).join('')}`;
        }
        $('album-body').innerHTML = html;
    }

    _albumClick(e) {
        const r = e.target.closest('[data-replay]');
        if (r) { this.audio.ui('click'); this.onAlbumReplay(this.album.scenes[r.dataset.replay]); return; }
        const v = e.target.closest('[data-view]');
        if (v) {
            const viewer = $('viewer');
            viewer.querySelector('.pic').style.backgroundImage = `url('${ART.cg(v.dataset.view)}')`;
            viewer.querySelector('.cap').textContent = v.dataset.cap || '';
            viewer.hidden = false;
            return;
        }
        const m = e.target.closest('[data-music]');
        if (m) { this.audio.play(m.dataset.music); this.renderAlbum(); }
    }

    // ---------------------------------------------------------------- slots
    openSlots(mode, list) {
        this.slotMode = mode;
        $('slots-title').textContent = mode === 'save' ? 'Save' : 'Load';
        $('slots-list').innerHTML = list.map((s, i) => {
            if (mode === 'save' && i === 0) return '';
            const name = i === 0 ? 'Autosave' : `Slot ${i}`;
            if (!s) return `<div class="slot-row"><div class="info"><b>${name}</b><div class="dim">Empty</div></div>${mode === 'save' ? `<button class="btn small" data-slot="${i}">Save here</button>` : ''}</div>`;
            const d = new Date(s.savedAt);
            const sum = s.sum || {};
            const what = sum.over ? `Ending: ${esc(ENDING[sum.ending]?.title || '')}` : `Age ${sum.age}, ${MONTHS[(sum.month || 1) - 1]} · ${sum.gold} 🪙`;
            return `<div class="slot-row"><div class="info"><b>${name}</b> · ${esc(sum.name || '')}<div class="dim">${what} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
                <button class="btn small ${mode === 'load' ? 'primary' : ''}" data-slot="${i}">${mode === 'save' ? 'Overwrite' : 'Load'}</button></div>`;
        }).join('') || '<p class="dim">No saved games.</p>';
        this.openScreen('slots');
    }

    openLog(log) {
        $('log-body').innerHTML = log.map((l) => `<div class="ln ${l.narr ? 'narr' : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}${esc(l.text)}</div>`).join('') || '<p class="dim">Nothing yet.</p>';
        this.openScreen('log');
        requestAnimationFrame(() => { const b = $('log').querySelector('.sheet'); b.scrollTop = b.scrollHeight; });
    }

    moveFocus(dir) {
        const top = this.top();
        const root = top ? $(top) : $('panel').hidden ? $('dlg') : $('panel');
        const els = [...root.querySelectorAll('button:not([disabled]):not(.off), input, select')].filter((e) => !e.closest('[hidden]') && e.getClientRects().length);
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        const n = els[(i + dir + els.length) % els.length];
        n.focus();
        n.scrollIntoView({ block: 'nearest' });
    }
}

