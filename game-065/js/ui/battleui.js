// The battle screen: gauges, the message box, command and technique menus, team and bag pickers,
// and the playback loop that walks the engine's events through the 3D stage (js/view/battleview.js)
// and the text box together.

import { $, esc, typeChip, statusChip, bar, botImg, focusFirst } from './dom.js';
import { SPECIES } from '../sim/dex.js';
import { MOVES, moveDesc } from '../sim/data/moves.js';
import { ITEMS } from '../sim/data/items.js';
import { TYPE_INFO, effAgainst } from '../sim/data/types.js';
import { calcStats, name as unitName } from '../sim/unit.js';
import { xpForLevel, STATUS } from '../config.js';
import { traitName } from '../sim/data/traits.js';

export class BattleUI {
    constructor(app) {
        this.app = app;
        this.root = $('battle');
        this.playing = false;
        this.skip = false;
        this.menu = null;
        this.gauge = [null, null];
    }
    get open() { return !this.root.classList.contains('hidden'); }

    show(spec) {
        this.spec = spec;
        this.root.innerHTML = `
            <div class="gauge foe hidden" id="g1"></div>
            <div class="gauge me hidden" id="g0"></div>
            <div class="bnums" id="bnums"></div>
            <div class="bbox"><div class="bmsg" id="bmsg"></div><div class="bmenu hidden" id="bmenu"></div></div>`;
        this.root.classList.remove('hidden');
        this.gauge = [null, null];
        this.root.querySelector('.bbox').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) this.press(); });
    }
    hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.menu = null; }

    // ------------------------------------------------------------------ gauges
    setGauge(side, s) {
        this.gauge[side] = s ? { ...s } : null;
        this.drawGauge(side);
    }
    drawGauge(side) {
        const s = this.gauge[side];
        const el = $(`g${side}`);
        if (!el) return;
        if (!s) { el.innerHTML = ''; el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        const S = SPECIES[s.sp];
        const owned = side === 1 && this.app.game.state.owned[s.sp];
        const f = s.hp / s.max;
        let xp = '';
        if (side === 0) {
            const u = this.app.game.state.party.find((x) => x.uid === s.uid);
            if (u) { const a = xpForLevel(u.lv), b = xpForLevel(u.lv + 1); xp = bar((u.xp - a) / Math.max(1, b - a), 'xp'); }
        }
        el.innerHTML = `
            <div class="grow"><span class="gname">${esc(s.name)}${s.gilded ? ' <span class="gild">✦</span>' : ''}</span>${owned ? '<span class="gown" title="Registered">⚙</span>' : ''}<span class="glv">Lv${s.lv}</span></div>
            <div class="gtypes">${S.types.map((t) => typeChip(t, true)).join('')}${statusChip(s.st)}</div>
            <div class="ghp"><span>HULL</span>${bar(f)}</div>
            ${side === 0 ? `<div class="gnum">${Math.max(0, Math.ceil(s.hp))} / ${s.max}</div>${xp}` : ''}`;
    }
    animHp(side, to, max) {
        const s = this.gauge[side];
        if (!s) return;
        const from = s.hp;
        const t0 = performance.now();
        const dur = Math.min(700, 200 + Math.abs(from - to) * 6) / this.app.fast;
        const step = () => {
            const k = Math.min(1, (performance.now() - t0) / dur);
            s.hp = from + (to - from) * k;
            if (max) s.max = max;
            this.drawGauge(side);
            if (k < 1 && this.gauge[side] === s) requestAnimationFrame(step);
        };
        step();
    }
    floatNum(side, text, cls) {
        const a = this.app.view.bv.anchor(side);
        const d = document.createElement('div');
        d.className = `fnum ${cls}`;
        d.textContent = text;
        d.style.left = `${a.x}px`; d.style.top = `${a.y}px`;
        $('bnums').appendChild(d);
        setTimeout(() => d.remove(), 1200);
    }

    // ------------------------------------------------------------------ playback
    async play(events) {
        this.playing = true;
        this.hideMenu();
        const app = this.app;
        for (const e of events) {
            if (!this.open) break;
            if (e.t === 'msg') { await this.say(e.text); continue; }
            if (e.t === 'needSwitch') continue;
            const d = app.view.bv.handle(e);
            this.uiEvent(e);
            app.sound(e);
            if (d > 0) await this.wait(d);
        }
        this.playing = false;
    }

    uiEvent(e) {
        switch (e.t) {
            case 'send': this.setGauge(e.side, e); break;
            case 'recall': this.setGauge(e.side, null); break;
            case 'hit': {
                this.animHp(e.side, e.hp, e.max);
                if (!e.chip) this.floatNum(e.side, `-${e.dmg}`, e.eff >= 2 ? 'super' : e.eff < 1 ? 'weak' : e.crit ? 'crit' : '');
                else this.floatNum(e.side, `-${e.dmg}`, 'chip');
                break;
            }
            case 'heal': this.animHp(e.side, e.hp, e.max); this.floatNum(e.side, '+', 'heal'); break;
            case 'status': if (this.gauge[e.side]) { this.gauge[e.side].st = e.st; this.drawGauge(e.side); } break;
            case 'faint': if (this.gauge[e.side]) { this.gauge[e.side].hp = 0; this.drawGauge(e.side); setTimeout(() => this.setGauge(e.side, null), 900 / this.app.fast); } break;
            case 'xp': case 'level':
                if (e.active && this.gauge[0]) {
                    if (e.t === 'level') { this.gauge[0].lv = e.lv; this.gauge[0].hp = e.hp; this.gauge[0].max = e.max; this.floatNum(0, `Lv ${e.lv}!`, 'level'); }
                    this.drawGauge(0);
                }
                break;
            case 'stat': this.floatNum(e.side, `${{ atk: 'TRQ', def: 'PLT', spa: 'ARC', spd: 'SHD', spe: 'CLK', acc: 'ACC', eva: 'EVA', crit: 'AIM' }[e.stat]} ${e.n > 0 ? '▲' : '▼'}`, e.n > 0 ? 'up' : 'down'); break;
            case 'trait': this.floatNum(e.side, `${traitName(e.trait)}`, 'trait'); break;
            case 'miss': this.floatNum(e.side, 'MISS', 'miss'); break;
            case 'immune': this.floatNum(e.side, 'NO EFFECT', 'miss'); break;
        }
    }

    say(text) {
        return new Promise((res) => {
            const el = $('bmsg');
            if (!el) { res(); return; }
            el.textContent = '';
            let i = 0;
            this.skip = false;
            const speed = this.app.settings.textSpeed === 'instant' ? 9999 : 90 * this.app.fast;
            let done = false;
            const t0 = performance.now();
            const finish = () => { if (done) return; done = true; el.textContent = text; const hold = this.app.settings.battleText === 'manual' ? 1e9 : (520 + text.length * 14) / this.app.fast; this.waitOrPress(hold).then(res); };
            const step = () => {
                if (done) return;
                if (this.skip) { finish(); return; }
                i = Math.min(text.length, ((performance.now() - t0) / 1000) * speed);
                el.textContent = text.slice(0, Math.floor(i));
                if (i >= text.length) finish(); else requestAnimationFrame(step);
            };
            step();
        });
    }
    wait(s) { return this.waitOrPress((s * 1000) / this.app.fast); }
    waitOrPress(ms) {
        return new Promise((res) => {
            this.skip = false;
            const t0 = performance.now();
            const chk = () => { if (this.skip || performance.now() - t0 >= ms || !this.open) { this.skip = false; res(); } else requestAnimationFrame(chk); };
            chk();
        });
    }
    press() { this.skip = true; }

    // ------------------------------------------------------------------ menus
    hideMenu() { const m = $('bmenu'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } this.menu = null; }
    showMenu(kind, html) {
        const m = $('bmenu');
        m.innerHTML = html;
        m.classList.remove('hidden');
        m.className = `bmenu ${kind}`;
        this.menu = kind;
        focusFirst(m);
    }

    /** Ask the player for an action. */
    command() {
        const b = this.app.game.battle;
        if (!b) return;
        const u = b.act(0);
        $('bmsg').textContent = `What will ${unitName(u)} do?`;
        const wild = b.kind === 'wild';
        this.showMenu('cmd', `
            <button class="cmd fight default" data-a="fight">⚔ Fight</button>
            <button class="cmd team" data-a="team">⚙ Team</button>
            <button class="cmd bag" data-a="bag">🎒 Bag</button>
            <button class="cmd run" data-a="run" ${wild ? '' : 'disabled'}>💨 Run</button>`);
        $('bmenu').querySelectorAll('button').forEach((x) => x.addEventListener('click', () => {
            this.app.audio.sfx('select');
            const a = x.dataset.a;
            if (a === 'fight') this.moves();
            else if (a === 'team') this.team(false);
            else if (a === 'bag') this.bag();
            else if (a === 'run') this.app.battleChoose({ k: 'run' });
        }));
    }

    moves() {
        const b = this.app.game.battle;
        const u = b.act(0), foe = b.act(1);
        const all0 = u.moves.every((m) => m.pp <= 0);
        const html = u.moves.map((m, i) => {
            const mv = MOVES[m.id];
            const T = TYPE_INFO[mv.type];
            const eff = mv.cat === 'U' ? null : effAgainst(mv.type, SPECIES[foe.sp].types);
            const effTxt = eff === null ? '' : eff === 0 ? '<i class="eff none">no effect</i>' : eff >= 2 ? '<i class="eff up">super</i>' : eff < 1 ? '<i class="eff down">weak</i>' : '';
            const known = this.app.game.state.seen[foe.sp];
            return `<button class="mv${i === 0 ? ' default' : ''}" data-i="${i}" style="--tc:${T.color}" ${m.pp <= 0 && !all0 ? 'disabled' : ''} title="${esc(moveDesc(mv))}">
                <span class="mvn">${esc(mv.name)}</span>
                <span class="mvi">${T.icon} ${mv.cat === 'K' ? 'Kinetic' : mv.cat === 'E' ? 'Energy' : 'Utility'}${mv.pow > 1 ? ` · ${mv.pow}` : ''} ${known ? effTxt : ''}</span>
                <span class="mvp">${m.pp}/${mv.pp}</span></button>`;
        }).join('') + '<button class="back" data-a="back">◂ Back</button>';
        $('bmsg').textContent = moveDesc(MOVES[u.moves[0].id]);
        this.showMenu('moves', html);
        const menu = $('bmenu');
        menu.querySelectorAll('.mv').forEach((x) => {
            x.addEventListener('click', () => { this.app.audio.sfx('select'); this.app.battleChoose({ k: 'move', i: +x.dataset.i }); });
            x.addEventListener('focus', () => { const mv = MOVES[u.moves[+x.dataset.i].id]; $('bmsg').textContent = moveDesc(mv); });
            x.addEventListener('pointerenter', () => { const mv = MOVES[u.moves[+x.dataset.i].id]; $('bmsg').textContent = moveDesc(mv); });
        });
        menu.querySelector('.back').addEventListener('click', () => { this.app.audio.sfx('back'); this.command(); });
    }

    team(forced) {
        const b = this.app.game.battle;
        const P = b.side[0].units;
        $('bmsg').textContent = forced ? 'Choose the next COM-bot to send out.' : 'Switch to which COM-bot?';
        const html = P.map((u, i) => {
            const st = calcStats(u);
            const act = i === b.side[0].active;
            return `<button class="tm${act ? ' active' : ''}" data-i="${i}" ${u.hp <= 0 || act ? 'disabled' : ''}>
                ${botImg(u.sp, u.gilded, 'tmimg')}
                <span class="tmn">${esc(unitName(u))} <small>Lv${u.lv}</small></span>
                ${bar(u.hp / st.hp)}<span class="tmh">${u.hp}/${st.hp} ${statusChip(u.st)}</span></button>`;
        }).join('') + (forced ? '' : '<button class="back" data-a="back">◂ Back</button>');
        this.showMenu('team', html);
        const menu = $('bmenu');
        menu.querySelectorAll('.tm').forEach((x) => x.addEventListener('click', () => { this.app.audio.sfx('select'); this.app.battleChoose({ k: 'switch', i: +x.dataset.i }); }));
        const bk = menu.querySelector('.back');
        if (bk) bk.addEventListener('click', () => { this.app.audio.sfx('back'); this.command(); });
    }

    bag(pocket = null) {
        const g = this.app.game, b = g.battle;
        const bagItems = Object.entries(g.state.bag).filter(([id, n]) => n > 0 && ITEMS[id]);
        const pockets = [['repair', '🩹 Repair'], ['spike', '📍 Spikes'], ['battle', '🟥 Chips']];
        if (!pocket) pocket = b.kind === 'wild' && bagItems.some(([id]) => ITEMS[id].pocket === 'spike') ? 'spike' : 'repair';
        const list = bagItems.filter(([id]) => ITEMS[id].pocket === pocket && !ITEMS[id].field);
        const html = `<div class="tabs">${pockets.map(([p, l]) => `<button class="tab${p === pocket ? ' on' : ''}" data-p="${p}">${l}</button>`).join('')}</div>
            <div class="ilist">${list.length ? list.map(([id, n], i) => `<button class="it${i === 0 ? ' default' : ''}" data-id="${id}" ${pocket === 'spike' && !b.canCatch ? 'disabled' : ''}><span class="ii">${ITEMS[id].icon}</span><span class="in">${esc(ITEMS[id].name)}</span><span class="ic">×${n}</span></button>`).join('') : '<div class="empty">Nothing in this pocket.</div>'}</div>
            <button class="back" data-a="back">◂ Back</button>`;
        $('bmsg').textContent = pocket === 'spike' && !b.canCatch ? 'Spikes only work on wild COM-bots.' : 'Use which item?';
        this.showMenu('bag', html);
        const menu = $('bmenu');
        menu.querySelectorAll('.tab').forEach((x) => x.addEventListener('click', () => this.bag(x.dataset.p)));
        menu.querySelectorAll('.it').forEach((x) => {
            const it = ITEMS[x.dataset.id];
            x.addEventListener('focus', () => { $('bmsg').textContent = it.desc; });
            x.addEventListener('click', () => {
                this.app.audio.sfx('select');
                if (it.pocket === 'spike') this.app.battleChoose({ k: 'spike', id: it.id });
                else if (it.boost) this.app.battleChoose({ k: 'item', id: it.id });
                else this.itemTarget(it);
            });
        });
        menu.querySelector('.back').addEventListener('click', () => { this.app.audio.sfx('back'); this.command(); });
    }

    itemTarget(it) {
        const b = this.app.game.battle;
        const P = b.side[0].units;
        $('bmsg').textContent = `Use the ${it.name} on which bot?`;
        const html = P.map((u, i) => {
            const st = calcStats(u);
            const ok = it.revive ? u.hp <= 0 : u.hp > 0;
            return `<button class="tm" data-i="${i}" ${ok ? '' : 'disabled'}>${botImg(u.sp, u.gilded, 'tmimg')}<span class="tmn">${esc(unitName(u))} <small>Lv${u.lv}</small></span>${bar(u.hp / st.hp)}<span class="tmh">${u.hp}/${st.hp} ${statusChip(u.st)}</span></button>`;
        }).join('') + '<button class="back">◂ Back</button>';
        this.showMenu('team', html);
        const menu = $('bmenu');
        menu.querySelectorAll('.tm').forEach((x) => x.addEventListener('click', () => this.app.battleChoose({ k: 'item', id: it.id, target: +x.dataset.i })));
        menu.querySelector('.back').addEventListener('click', () => this.bag(it.pocket));
    }

    back() {
        if (this.playing) { this.press(); return true; }
        if (this.menu && this.menu !== 'cmd') {
            const bk = $('bmenu').querySelector('.back');
            if (bk) { bk.click(); return true; }
        }
        return false;
    }
}

export { STATUS };
