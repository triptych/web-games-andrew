// The DOM layer: screens, the HUD, comms, the cut-in, settings. Reads the sim; changes it only through onAct.

import { VERSION, UPGRADES, UPGRADE_MAX, ELEMENTS } from './config.js';
import { BOSSES, LINES } from './sim/data.js';
import { evaluate, upgradeCost, routeAmount, suggestRoute, nextResist, ROUTES } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const EL_NAME = { thermal: 'THERMAL', cryo: 'CRYO', volt: 'VOLT' };
const EL_ICON = { thermal: '🔥', cryo: '❄', volt: 'ϟ' };
const EL_CSS = { thermal: 'var(--thermal)', cryo: 'var(--cryo)', volt: 'var(--volt)' };
const ROUTE_LABEL = { power: '⚡ Power', speed: '» Speed', thermal: '🔥 Thermal', cryo: '❄ Cryo', volt: 'ϟ Volt' };
const PORTRAIT = { juno: 'art/por-juno.webp', mira: 'art/por-mira.webp' };
const WHO = { juno: 'JUNO', mira: 'MIRA' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function resistChip(e, r) {
    const label = r >= 0.05 ? `RES ${Math.round(r * 100)}%` : r <= -0.05 ? `WEAK ×${(1 - r).toFixed(1)}` : 'NEUTRAL';
    return `<span class="chip ${r <= -0.05 ? 'weak' : r >= 0.5 ? 'res' : ''}" style="background:${EL_CSS[e]}">${EL_ICON[e]}<span class="n"> ${EL_NAME[e]}</span> ${label}</span>`;
}

export class UI {
    constructor({ audio, settings, onAct, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.onAct = onAct;
        this.stack = [];
        this.commT = 0;
        this.readoutT = 0;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, calm: calm.checked });
            document.documentElement.classList.toggle('calm', settings.calm);
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, calm]) el.addEventListener('change', changed);
        document.documentElement.classList.toggle('calm', !!settings.calm);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // hangar tabs
        for (const t of document.querySelectorAll('#hangar .tab')) {
            t.addEventListener('click', () => { audio.ui('click'); this.tab(t.dataset.tab); });
        }
        $('sorties').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-level]');
            if (!b || b.disabled) return;
            audio.ui('click');
            onAct({ t: 'start', level: +b.dataset.level });
        });
        $('upgrades').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-buy]');
            if (!b || b.disabled) return;
            onAct({ t: 'buy', id: b.dataset.buy });
        });
        $('route-opts').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-stat]');
            if (b) onAct({ t: 'route', stat: b.dataset.stat });
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack screens in the order they were opened, so Settings opened from Pause sits on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) {
        return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length && !b.closest('[hidden]'));
    }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    tab(name) {
        for (const t of document.querySelectorAll('#hangar .tab')) t.classList.toggle('on', t.dataset.tab === name);
        $('tab-sorties').hidden = name !== 'sorties';
        $('tab-upgrades').hidden = name !== 'upgrades';
    }

    // ------------------------------------------------------------------ layout
    /** Place the board, the gauges and the FIRE button; returns the board rect and the 3D scene's region. */
    layout(full = false) {
        const vv = window.visualViewport;
        const w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
        document.body.classList.toggle('shooting', full);
        const g = $('gauges'), fire = $('btn-fire'), rush = $('rush');
        let board, region, gauges;
        if (w < h * 1.05) {
            const S = Math.round(Math.min(w - 12, h * 0.5, 560));
            board = { x: Math.round((w - S) / 2), y: h - S - 10, size: S };
            g.style.width = S + 'px';
            gauges = { x: board.x, y: board.y - (g.offsetHeight || 78) - 6, w: S };
            region = { x: 0, y: 48, w, h: Math.max(80, gauges.y - 48) };
        } else {
            const S = Math.round(Math.min(h - 64, w * 0.5, 620));
            board = { x: w - S - 12, y: h - S - 10, size: S };
            const gw = Math.min(560, board.x - 22);
            g.style.width = gw + 'px';
            gauges = { x: 10, y: h - (g.offsetHeight || 78) - 10, w: gw };
            region = { x: 0, y: 0, w: board.x, h: gauges.y };
        }
        Object.assign(g.style, { left: gauges.x + 'px', top: gauges.y + 'px', width: gauges.w + 'px' });
        Object.assign(fire.style, { left: Math.round(region.x + region.w / 2 - 75) + 'px', top: Math.round(region.y + region.h - 92) + 'px' });
        Object.assign(rush.style, { left: Math.round(region.x + region.w / 2 - 50) + 'px', top: Math.round(region.y + Math.min(150, region.h * 0.42)) + 'px' });
        // comms sit over the 3D scene, never over the board
        const comm = $('comm');
        const cw = Math.min(440, region.w - 16);
        Object.assign(comm.style, { width: cw + 'px', left: Math.round(region.x + region.w / 2) + 'px' });
        if (full) region = { x: 0, y: 0, w, h };        // the shot gets the whole screen
        this.boardRect = board;
        return { board, region };
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; $('board').hidden = !on; }

    hud(G) {
        const m = G.m;
        if (!m) return;
        const boss = BOSSES[m.level];
        const lance = m.phase === 'lance' || m.phase === 'beam';
        $('hud-round').textContent = lance ? 'MOTHERSHIP EXPOSED' : `ROUND ${Math.min(m.round + 1, m.rounds)}/${m.rounds}`;
        $('hud-wave-name').textContent = lance ? boss.name : boss.waves[Math.min(m.round, m.rounds - 1)].name;
        const clock = Math.ceil(m.clock);
        const ce = $('hud-clock');
        ce.textContent = m.phase === 'round' || m.phase === 'lance' ? clock : '';
        ce.classList.toggle('low', (m.phase === 'round' || m.phase === 'lance') && m.clock <= 6);
        $('bar-hull').querySelector('i').style.transform = `scaleX(${m.hull / m.maxHull})`;
        $('bar-shield').querySelector('i').style.transform = `scaleX(${Math.min(1, m.shield / (60 + 15 * G.up.deflector))})`;
        const wave = boss.waves[Math.min(m.round, m.rounds - 1)];
        $('hud-escorts').textContent = m.phase === 'round' ? `ESCORTS ${wave.count - m.killed}/${wave.count}` : '';
        const ev = evaluate(G);
        for (const el of document.querySelectorAll('.gauge')) {
            const r = ev.ratios[el.dataset.g];
            el.querySelector('.track i').style.width = Math.min(100, r * 50) + '%';
            el.querySelector('b').textContent = r.toFixed(2) + '×';
            el.classList.toggle('met', r >= 1);
        }
        const key = ELEMENTS.map((e) => m.resist[e]).join();
        const shift = boss.shift ? Math.ceil(m.shiftT) : -1;
        const sig = key + '|' + shift;
        if (sig !== this._res) {
            this._res = sig;
            let html = ELEMENTS.map((e) => resistChip(e, m.resist[e])).join('');
            if (boss.shift) {
                const nx = nextResist(G);
                const weak = ELEMENTS.find((e) => nx[e] < 0);
                html += `<span class="shift">shift in ${shift}s → ${EL_ICON[weak]} weak</span>`;
            }
            $('resists').innerHTML = html;
        }
        $('btn-fire').hidden = !(m.phase === 'lance' && !m.fireQueued);
        const rush = $('rush');
        const on = m.rush >= 2 && (m.phase === 'round' || m.phase === 'lance');
        rush.classList.toggle('on', on);
        if (on && rush.dataset.n !== String(m.rush)) {
            rush.dataset.n = m.rush;
            rush.textContent = `RUSH ×${m.rush}`;
            rush.classList.remove('pop'); void rush.offsetWidth; rush.classList.add('pop');
        }
    }

    // ------------------------------------------------------------------ comms, cut-in, readouts
    say(line, audio) {
        if (!line) return;
        $('comm-por').src = PORTRAIT[line.who];
        $('comm-who').textContent = WHO[line.who];
        $('comm-text').textContent = line.text;
        $('comm').hidden = false;
        const d = audio ? audio.voice(line.vo, true) : 0;
        this.commT = Math.max(2.6, d + 0.6);
        window.A11Y?.announce?.(`${WHO[line.who]}: ${line.text}`);
    }
    cutin() {
        const c = $('cutin');
        c.hidden = false;
        for (const el of c.children) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
        clearTimeout(this.cutT);
        this.cutT = setTimeout(() => { c.hidden = true; }, this.settings.calm ? 2000 : 1450);
    }
    readout(text, cls) {
        const r = $('readout');
        r.hidden = false;
        const d = document.createElement('div');
        d.className = 'ln ' + (cls || '');
        d.textContent = text;
        r.appendChild(d);
        this.readoutT = 99;
    }
    clearReadout() { $('readout').innerHTML = ''; $('readout').hidden = true; }

    tick(dt) {
        if (this.commT > 0) { this.commT -= dt; if (this.commT <= 0) $('comm').hidden = true; }
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ screens with content
    renderHangar(G) {
        $('scrap').textContent = G.scrap;
        const next = Math.min(G.unlocked, BOSSES.length - 1);
        $('sorties').innerHTML = BOSSES.map((b, i) => {
            const locked = i > G.unlocked;
            const g = G.best[i];
            return `<button class="sortie ${locked ? 'locked' : ''} ${i === next && !G.ended ? 'next' : ''}" data-level="${i}" ${locked ? 'disabled' : ''}>
                <img src="art/ship-${b.id}.webp" alt="">
                <span><b>${i + 1}. ${locked ? '???' : esc(b.name)}</b><small>${locked ? 'Defeat the mothership before it' : esc(b.title) + ' · ' + b.waves.length + ' waves'}</small></span>
                <span class="grade grade-${g}">${g === '-' ? '' : g}</span></button>`;
        }).join('');
        $('upgrades').innerHTML = UPGRADES.map((u) => {
            const lv = G.up[u.id], cost = upgradeCost(G, u.id);
            const pips = Array.from({ length: UPGRADE_MAX }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
            return `<div class="up"><span><b>${esc(u.name)}</b><span class="pips">${pips}</span><small>${esc(u.desc)}</small></span>
                <button class="btn" data-buy="${u.id}" ${cost > G.scrap ? 'disabled' : ''}>${lv >= UPGRADE_MAX ? 'MAX' : '⬢ ' + cost}</button></div>`;
        }).join('');
        $('hangar-go').textContent = G.ended ? 'Fly Again' : `Sortie ${next + 1}`;
    }

    renderBrief(G) {
        const m = G.m, b = BOSSES[m.level];
        $('brief-num').textContent = `MOTHERSHIP ${m.level + 1} OF ${BOSSES.length}`;
        $('brief-name').textContent = b.name;
        $('brief-sub').textContent = b.title;
        $('brief-intel').textContent = b.intel;
        $('brief-req').innerHTML = `
            <tr><td>Evasion ${b.req.speed}</td><td>needs <b>Speed</b> to hit it</td></tr>
            <tr><td>Barrier ${b.req.barrier}</td><td>needs <b>Elements</b>, after its resistances</td></tr>
            <tr><td>Armor ${b.req.armor}</td><td>needs <b>Power</b> to break through</td></tr>
            <tr><td>Escorts</td><td>${b.waves.length} waves: ${b.waves.map((w) => `${w.count}`).join(' · ')} interceptors</td></tr>`;
        $('brief-res').innerHTML = ELEMENTS.map((e) => resistChip(e, b.resist[e])).join('');
        const mods = [];
        if (b.shift) mods.push(`⚠ The barrier shifts its tuning every ${b.shift.every} s.`);
        if (b.jam) mods.push('⚠ It jams the board with static tiles; match next to them to clear them.');
        $('brief-mods').textContent = mods.join(' ');
        const best = G.best[m.level];
        $('brief-launch').textContent = best === '-' || best === 'F' ? 'Launch' : `Launch (best ${best})`;
    }

    renderRoute(G, ev) {
        const m = G.m;
        const amount = routeAmount(m);
        $('route-head').textContent = ev.cleared ? 'Wave Cleared!' : 'Wave Escaped';
        $('route-text').innerHTML = ev.cleared
            ? `${ev.of}/${ev.of} escorts down with <b>${Math.ceil(ev.spare)} s</b> to spare. MIRA can route <b>+${amount}</b> spare charge into one system:`
            : `${ev.killed}/${ev.of} escorts down; the rest made a final pass. MIRA can route <b>+${amount}</b> into one system:`;
        const sug = suggestRoute(G);
        $('route-opts').innerHTML = ROUTES.map((s) => `<button class="btn ${s === sug ? 'suggest' : ''}" data-stat="${s}">${ROUTE_LABEL[s]}${s === sug ? '<br><small>MIRA suggests</small>' : ''}</button>`).join('');
    }

    renderResult(G) {
        const r = G.m.result;
        const ge = $('result-grade');
        ge.textContent = r.grade;
        ge.className = 'grade-' + r.grade;
        $('result-head').textContent = r.destroyed ? (r.ending ? 'THE THRONE FALLS' : 'MOTHERSHIP DESTROYED') : 'IT SURVIVED';
        const row = (k, name, what) => {
            const v = r.ratios[k];
            return `<tr><td>${name}</td><td>${v.toFixed(2)}× ${what} ${v >= 1 ? '✓' : '✗'}</td></tr>`;
        };
        $('result-ratios').innerHTML = row('speed', 'Speed', 'its evasion') + row('barrier', 'Elements', 'its barrier') + row('armor', 'Power', 'its armor')
            + `<tr><td>Weakest</td><td>${r.min.toFixed(2)}× · S needs 2.0× on all three</td></tr>`;
        const MEDAL = { flawless: '✦ Flawless (no hull damage)', quickdraw: '⚡ Quick Draw (fired with 6 s left)', ace: '★ Ace (every wave shot down)' };
        $('result-medals').innerHTML = r.medals.map((k) => `<span class="medal">${MEDAL[k]}</span>`).join('');
        $('result-scrap').textContent = `+${r.scrap} scrap${r.destroyed && !r.improved ? ' (replay: half)' : ''}`;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'hit') {
                const el = $(e.rest > 0 ? 'bar-hull' : 'bar-shield');
                el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
            }
        }
    }
}

export { LINES };
