// DOM side: screens, HUD, radio chatter, banners, story dialog and the menus
// that are generated from data (episodes, squad pick, garage, dossiers).

import { CREW, CREW_ORDER, UPGRADES, TEAM_UPGRADES } from './sim/data.js';
import { LEVELS } from './sim/levels.js';
import { SPEAKERS } from './sim/story.js';
import { parseLevel, buildObjectives } from './sim/level.js';
import { portrait } from './portraits.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ALARM_TXT = { sneak: 'INFILTRATION', caution: 'CAUTION', alert: 'ALERT', evasion: 'EVASION' };
const ALARM_MAX = { caution: 16, alert: 18, evasion: 9 };

export class UI {
    constructor() {
        this.canvas = $('#gl');
        this.current = null;
        this.onAction = () => {};
        this.radioT = 0;
        this.hintKey = '';
        document.addEventListener('click', (e) => {
            const b = e.target.closest('[data-act]');
            if (!b || b.disabled) return;
            e.preventDefault();
            this.onAction(b.dataset.act, b);
        });
        this.touch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
        document.body.classList.toggle('touch', this.touch);
        addEventListener('pointerdown', (e) => {
            const t = e.pointerType === 'touch';
            if (t !== this.touch) { this.touch = t; document.body.classList.toggle('touch', t); }
        }, { capture: true });
    }

    // ------------------------------------------------------------------ screens
    show(id) {
        for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
        this.current = id;
        $('#boot').hidden = true;
        document.querySelectorAll('.focus').forEach((x) => x.classList.remove('focus'));
        this.focusEl = null;
        // keyboard and gamepad start on the screen's main button
        const hot = id && document.querySelector(`#${id} button.hot:not(:disabled)`);
        if (hot) { this.focusEl = hot; hot.classList.add('focus'); }
    }
    hideScreens() { this.show(null); }

    /** Arrow keys / d-pad move a highlight through the visible menu's buttons. */
    navigate(dir) {
        if (!this.current) return false;
        const items = [...document.querySelectorAll(`#${this.current} button:not(:disabled):not(.skip), #${this.current} .pk:not(.locked)`)].filter((b) => b.offsetParent);
        if (!items.length) return false;
        let i = items.indexOf(this.focusEl);
        i = i < 0 ? 0 : (i + dir + items.length) % items.length;
        this.focusEl?.classList.remove('focus');
        this.focusEl = items[i];
        this.focusEl.classList.add('focus');
        this.focusEl.scrollIntoView?.({ block: 'nearest' });
        return true;
    }
    activate() {
        if (this.focusEl && this.focusEl.offsetParent) { this.focusEl.click(); return true; }
        return false;
    }

    setPlaying(on) {
        $('#hud').hidden = !on;
        document.body.classList.toggle('playing', on);
        if (!on) { $('#radio').hidden = true; $('#banner').hidden = true; }
    }

    // ------------------------------------------------------------------ HUD
    hudInit(W, ep) {
        const def = W.def;
        $('#ep-name').innerHTML = `<b>EP ${def.ep}</b>${esc(def.title)}`;
        $('#par-n').textContent = def.par;
        this._objKey = '';
        this._squadKey = '';
        this.hud(W, {});
    }

    hud(W, ctx) {
        const S = W.S;
        // objectives
        const objKey = S.objectives.map((o) => (o.done ? 1 : 0)).join('') + W.objectivesLeft();
        if (objKey !== this._objKey) {
            this._objKey = objKey;
            $('#objectives').innerHTML = S.objectives.map((o) => {
                const locked = o.id === 'extract' && W.objectivesLeft() > 0;
                return `<li class="${o.done ? 'done' : ''} ${o.id === 'extract' ? 'extract' : ''}" style="${locked ? 'opacity:0.45' : ''}">${esc(o.text)}</li>`;
            }).join('');
        }
        // alarm
        const A = S.alarm;
        const el = $('#alarm');
        el.className = A.mode;
        $('#alarm-label').textContent = A.mode === 'sneak' ? (W.def.noAlarm ? 'NO ALARMS' : 'INFILTRATION') : `${ALARM_TXT[A.mode]} ${A.t.toFixed(1)}`;
        el.querySelector('i').style.width = A.mode === 'sneak' ? '0%' : `${Math.max(0, Math.min(100, (A.t / ALARM_MAX[A.mode]) * 100))}%`;
        $('#shot-n').textContent = S.stats.shots;
        $('#shots').classList.toggle('over', S.stats.shots > W.def.par);
        const tt = W.L.tapes.length;
        $('#tapes-hud').textContent = tt ? `VICE TAPES ${S.stats.tapes}/${tt}` : '';
        // squad cards
        const crew = W.crew;
        const key = crew.map((b) => `${b.id}:${b.hp}:${b.charges}:${b.downed}:${b.extracted}:${ctx.selected === b.id}:${W.canShoot(b)}`).join('|') + S.phase + S.freeShot;
        if (key !== this._squadKey) {
            this._squadKey = key;
            const sq = $('#squad');
            sq.innerHTML = '';
            crew.forEach((b, i) => {
                const c = CREW[b.who];
                const card = document.createElement('div');
                card.className = `card${ctx.selected === b.id ? ' sel' : ''}${b.downed ? ' down' : ''}${b.extracted ? ' out' : ''}`;
                card.style.setProperty('--c', '#' + c.look.ring.toString(16).padStart(6, '0'));
                const hearts = '♥'.repeat(b.hp) + `<i>${'♥'.repeat(Math.max(0, b.maxHp - b.hp))}</i>`;
                card.innerHTML = `<img src="${portrait(b.who, 108)}" alt=""><div><div class="nm">${c.short}${b.downed ? ' — DOWN' : b.extracted ? ' — OUT' : ''}</div><div class="hp">${hearts}</div><div class="ab">${esc(c.ability)} <b>×${b.charges}</b></div></div><span class="k">${i + 1}</span>`;
                card.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.onAction('select', { id: b.id }); });
                sq.appendChild(card);
            });
        }
        // action buttons
        const active = S.active != null ? W.body(S.active) : null;
        const ab = $('#b-ability');
        const canAb = W.abilityReady();
        ab.disabled = !canAb;
        ab.querySelector('small').textContent = active ? `${CREW[active.who].ability} ×${active.charges}` : '';
        $('#b-rewind').disabled = !W.canRewind() || S.phase !== 'aim';
        $('#b-rewind small').textContent = `×${S.rewinds}`;
        $('#b-wait').disabled = S.phase !== 'aim' && !ctx.waiting;
        $('#b-wait').classList.toggle('held', !!ctx.waiting);
        // hint
        let hint = '';
        if (S.phase === 'aim') {
            if (S.freeShot != null) hint = 'Free shot: line it up';
            else if (ctx.aiming) hint = ctx.aimPower < 0.05 ? 'Pull further back' : 'Let go to shoot';
            else if (S.stats.shots === 0 && W.def.ep <= 2) hint = this.touch ? 'Drag back from a teammate, then let go' : 'Drag back from a teammate and let go';
        } else if (S.phase === 'motion' && canAb && (!ctx.used || CREW[active.who].abilityKey === 'dart')) hint = this.touch ? `Tap for ${CREW[active.who].ability}` : `SPACE / click: ${CREW[active.who].ability}`;
        $('#hint').textContent = hint;
    }

    // ------------------------------------------------------------------ chatter
    radio(speaker, text, ms = 6500) {
        const sp = SPEAKERS[speaker] ?? SPEAKERS[''];
        const r = $('#radio');
        r.querySelector('img').src = portrait(speaker, 112);
        r.querySelector('.who').textContent = sp.name;
        r.querySelector('.who').style.color = sp.color;
        r.querySelector('.txt').textContent = text;
        r.hidden = false;
        r.style.animation = 'none'; void r.offsetWidth; r.style.animation = '';
        clearTimeout(this._radioTO);
        this._radioTO = setTimeout(() => { r.hidden = true; }, ms);
    }
    hideRadio() { $('#radio').hidden = true; }

    banner(html, ms = 1800, cls = '') {
        const b = $('#banner');
        b.innerHTML = html; b.className = cls; b.hidden = false;
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        clearTimeout(this._bannerTO);
        this._bannerTO = setTimeout(() => { b.hidden = true; }, ms);
    }

    toast(text) {
        const t = document.createElement('div');
        t.className = 'toast'; t.textContent = text;
        $('#toasts').appendChild(t);
        setTimeout(() => t.remove(), 2600);
    }

    // ------------------------------------------------------------------ story
    storyLine(scene, line, typed) {
        const [sp, text] = line;
        const S = SPEAKERS[sp] ?? SPEAKERS[''];
        $('#s-story .scene-title').textContent = scene.title;
        const d = $('#s-story .dialog');
        d.classList.toggle('direction', !sp);
        const face = d.querySelector('.face');
        if (sp && sp !== '') face.src = portrait(sp, 208); else face.removeAttribute('src');
        face.hidden = !sp;
        d.querySelector('.name').textContent = S.name;
        d.querySelector('.name').style.color = S.color;
        d.querySelector('.text').textContent = text.slice(0, typed);
    }

    // ------------------------------------------------------------------ menus
    title(data) {
        $('#btn-continue').hidden = !(data.reached > 1 || data.seen.ep1in);
    }

    episodes(data) {
        const list = $('#ep-list');
        list.innerHTML = '';
        for (const l of LEVELS) {
            const b = document.createElement('button');
            b.className = 'ep';
            b.dataset.act = 'pick-ep'; b.dataset.ep = l.ep;
            b.disabled = l.ep > data.reached;
            const best = data.best[l.id];
            const tp = data.tapes[l.id] ?? [];
            const tTot = parseLevel(l).tapes.length;
            b.innerHTML = `<div class="no">EPISODE ${l.ep}</div><div class="t">${esc(l.title)}</div><div class="p">${esc(l.place)}</div>${best ? `<div class="g">${best.grade}</div>` : ''}${tTot ? `<div class="tp">▮ ${tp.filter(Boolean).length}/${tTot}</div>` : ''}`;
            list.appendChild(b);
        }
    }

    brief(def, roster, chosen, required, size, tip) {
        $('#s-brief .ep-no').textContent = `EPISODE ${def.ep}`;
        $('#s-brief .ep-title').textContent = def.title;
        $('#s-brief .ep-place').textContent = `${def.place} · ${def.time === 'storm' ? 'hurricane' : def.time}`;
        const objs = buildObjectives(parseLevel(def));
        $('#brief-objs').innerHTML = objs.map((o) => `<li>${esc(o.text)}</li>`).join('') + (def.noAlarm ? '<li style="color:#ff8a90">Do not raise a single alarm</li>' : '');
        $('#s-brief .par').textContent = `PAR ${def.par} SHOTS`;
        $('#s-brief .tip').textContent = tip ?? '';
        this.pick(roster, chosen, required, size);
    }

    pick(roster, chosen, required, size) {
        const box = $('#pick');
        box.innerHTML = '';
        $('#squad-count').textContent = `${chosen.length}/${size}`;
        for (const w of CREW_ORDER) {
            const c = CREW[w];
            const avail = roster.includes(w);
            const el = document.createElement('div');
            el.className = `pk${chosen.includes(w) ? ' on' : ''}${required.includes(w) ? ' req' : ''}${avail ? '' : ' locked'}`;
            el.dataset.act = avail ? 'toggle-crew' : '';
            el.dataset.who = w;
            el.innerHTML = avail
                ? `<img src="${portrait(w, 220)}" alt=""><div class="nm">${c.short}</div><div class="rl">${c.role}</div><div class="ab">${esc(c.ability)}</div>`
                : `<img src="${portrait(w, 220)}" alt="" style="filter:brightness(0) opacity(0.6)"><div class="nm">???</div><div class="rl">Not met yet</div>`;
            box.appendChild(el);
        }
        $('#btn-go').disabled = chosen.length === 0 || required.some((r) => !chosen.includes(r));
    }

    garage(data, roster) {
        $('#rep').textContent = `$${data.rep.toLocaleString()}`;
        const list = $('#garage-list');
        list.innerHTML = '';
        const team = document.createElement('div');
        team.className = 'gcard';
        team.innerHTML = `<img src="${portrait('dana', 168)}" alt=""><div style="flex:1"><div class="nm">THE WHOLE SQUAD</div><div class="rl">Lt. Price’s budget</div>${Object.entries(TEAM_UPGRADES).map(([k, u]) => {
            const lv = data.teamUp[k] ?? 0, max = lv >= u.max, cost = u.cost[lv];
            return `<button data-act="buy" data-team="1" data-k="${k}" ${max || data.rep < cost ? 'disabled' : ''}>${u.name} ${'●'.repeat(lv)}${'○'.repeat(u.max - lv)}<b>${max ? 'MAX' : '$' + cost}</b><br><small>${u.text}</small></button>`;
        }).join('')}</div>`;
        list.appendChild(team);
        for (const w of roster) {
            const c = CREW[w], up = data.crewUp[w] ?? { hp: 0, charges: 0 };
            const el = document.createElement('div');
            el.className = 'gcard';
            el.innerHTML = `<img src="${portrait(w, 168)}" alt=""><div style="flex:1"><div class="nm">${c.short}</div><div class="rl">${c.role}</div>${Object.entries(UPGRADES).map(([k, u]) => {
                const lv = up[k] ?? 0, max = lv >= u.max, cost = u.cost[lv];
                const label = k === 'charges' && c.abilityKey === 'dart' ? '+3 darts' : u.text;
                return `<button data-act="buy" data-who="${w}" data-k="${k}" ${max || data.rep < cost ? 'disabled' : ''}>${u.name} ${'●'.repeat(lv)}${'○'.repeat(u.max - lv)}<b>${max ? 'MAX' : '$' + cost}</b><br><small>${label}</small></button>`;
            }).join('')}</div>`;
            list.appendChild(el);
        }
    }

    dossier(roster) {
        const list = $('#dossier-list');
        list.innerHTML = '';
        for (const w of CREW_ORDER) {
            const c = CREW[w], met = roster.includes(w);
            const el = document.createElement('div');
            el.className = `dcard${met ? '' : ' locked'}`;
            el.innerHTML = met
                ? `<img src="${portrait(w, 168)}" alt=""><div><div class="nm">${esc(c.name.toUpperCase())}</div><div class="rl">${c.role}</div><p>${esc(c.bio)}</p><p class="ab"><b>${esc(c.ability)}:</b> ${esc(c.abilityText)}</p><p>${esc(c.passive)}</p></div>`
                : `<img src="${portrait(w, 168)}" alt="" style="filter:brightness(0) opacity(0.5)"><div><div class="nm">CLASSIFIED</div><div class="rl">Joins in episode ${c.joins}</div></div>`;
            list.appendChild(el);
        }
    }

    howtoCrew(roster) {
        $('#howto-crew').innerHTML = CREW_ORDER.filter((w) => roster.includes(w)).map((w) => `<li><img src="${portrait(w, 72)}" alt=""><span><b>${CREW[w].short} — ${esc(CREW[w].ability)}:</b> ${esc(CREW[w].abilityText)}</span></li>`).join('') || '<li>Meet the squad as the story goes on.</li>';
    }

    result(res, rep, best) {
        $('#grade').textContent = res.grade;
        const rows = res.rows.filter((r) => r[1] !== 0);
        $('#tally').innerHTML = rows.map(([k, v]) => `<tr class="${v < 0 ? 'neg' : ''}"><td>${esc(k)}</td><td>${v > 0 ? '+' : ''}${v.toLocaleString()}</td></tr>`).join('') + `<tr class="tot"><td>Score${best ? ' — new best!' : ''}</td><td>${res.score.toLocaleString()}</td></tr>`;
        $('#rep-earned').textContent = `+$${rep.toLocaleString()} REP${res.tapesTotal ? ` · VICE TAPES ${res.tapes}/${res.tapesTotal}` : ''}`;
    }

    options(s) {
        const v = { sound: s.sound ? 'On' : 'Off', music: s.music ? 'On' : 'Off', volume: `${Math.round(s.volume * 100)}%`, quality: { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' }[s.quality], shake: s.shake ? 'On' : 'Off', scanlines: s.scanlines ? 'On' : 'Off', patrols: s.patrols ? 'Shown' : 'Hidden' };
        for (const b of document.querySelectorAll('#s-options [data-opt]')) b.querySelector('span').textContent = v[b.dataset.opt];
    }
}
