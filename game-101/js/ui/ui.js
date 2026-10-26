// The DOM layer: party cards, message log, command panel, battle menus, screens and the event
// playback queue. Reads the sim; every change goes back through ctx.act(). Never mutates G.

import { h, row, portrait, itemName, canvasEl, bar, icon } from './dom.js';
import { calc, SKILLS, skillsFor, CLASSES } from '../sim/party.js';
import { autoCmds, battleLiveEnemies } from '../sim/battle.js';
import { POTIONS, WANDS } from '../sim/items.js';
import { totalPending } from '../sim/town.js';
import { drawMap } from '../view/map.js';
import { PLACES } from '../view/town3d.js';
import { monsterCanvas } from '../view/sprites.js';
import { THEMES } from '../sim/dungeon.js';
import { SCREENS } from './screens.js';
import { DIR_NAMES, ELEM_COL } from '../config.js';

const $ = (id) => document.getElementById(id);
const STATUS_ICON = { poison: ['P', 2], sleep: ['Z', 9], stun: ['S', 14], curse: ['C', 5] };

export class UI {
    constructor({ ctx, audio, stage, settings }) {
        this.ctx = ctx; this.audio = audio; this.stage = stage; this.settings = settings;
        this.stack = [];
        this.q = []; this.wait = 0;
        this.over = {};                 // hp shown mid-playback: over[i] = { hp }
        this.eover = {};                // enemy hp shown mid-playback
        this.bs = null; this.auto = false; this.lastCmds = null;
        this.floorRef = null; this.instant = false;
        this.resultsShown = false;
        this.el = { app: $('app'), party: $('party'), cmd: $('cmd'), log: $('log'), toast: $('toastlog'), overlay: $('overlay'), mini: $('mini'), screens: $('screens'), info: $('info'), tags: $('tags') };
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        this.logLines = [];
    }

    get G() { return this.ctx.G(); }
    get mode() { return this.G.floor ? 'dungeon' : 'town'; }
    get busy() { return this.q.length > 0 || this.wait > 0; }
    reduced() { return !!this.settings.calm; }

    // ------------------------------------------------------------------ screens
    open(name, params = {}) {
        const top = this.top();
        if (top && top.name === name && JSON.stringify(top.params) === JSON.stringify(params)) return;
        this.audio.sfxPlay('open');
        const scr = h('div', { class: 'screen', 'data-screen': name, style: `z-index:${50 + this.stack.length}` });
        scr.addEventListener('click', (e) => { if (e.detail && this.downIn !== scr) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        const entry = { name, params, el: scr, scroll: 0 };
        this.stack.push(entry);
        this.el.screens.appendChild(scr);
        this.render(entry);
        const first = scr.querySelector('.sheet-body button:not([disabled]), .sheet-foot button:not([disabled])');
        first?.focus({ preventScroll: true });
        return entry;
    }
    top() { return this.stack[this.stack.length - 1] || null; }
    has(name) { return this.stack.some((s) => s.name === name); }
    close(name = null, silent = false) {
        let i = name ? this.stack.map((s) => s.name).lastIndexOf(name) : this.stack.length - 1;
        if (i < 0) return;
        const [e] = this.stack.splice(i, 1);
        e.el.remove();
        if (!silent) this.audio.sfxPlay('close');
        e.onClose?.();
        const t = this.top();
        if (t) this.render(t);
        document.activeElement?.blur?.();
    }
    closeAll() { while (this.stack.length) this.close(null, true); }
    anyScreen() { return this.stack.length > 0; }

    render(entry) {
        const def = SCREENS[entry.name];
        if (!def) return;
        const focusIdx = this.focusIndex(entry);
        const old = entry.el.querySelector('.sheet-body');
        const scroll = old ? old.scrollTop : 0;
        const r = def(this, this.G, entry.params, entry);
        entry.onClose = r.onClose;
        const sheet = h('div', { class: `sheet ${r.wide ? 'wide' : ''} ${r.cls || ''}`, role: 'dialog', 'aria-label': r.title },
            h('div', { class: 'sheet-head' }, h('h2', null, r.title), r.noClose ? null : h('button', { class: 'x', 'aria-label': 'Close', onclick: () => { r.onX ? r.onX() : this.close(); } }, '✕')),
            h('div', { class: 'sheet-body' }, r.body),
            r.foot ? h('div', { class: 'sheet-foot' }, r.foot) : null);
        entry.el.replaceChildren(sheet);
        sheet.querySelector('.sheet-body').scrollTop = scroll;
        this.restoreFocus(entry, focusIdx);
        entry.noClose = r.noClose;
    }
    focusables(entry) { return [...entry.el.querySelectorAll('button:not([disabled]), select, input')]; }
    focusIndex(entry) { const a = document.activeElement; if (!a || !entry.el.contains(a)) return -1; return this.focusables(entry).indexOf(a); }
    restoreFocus(entry, i) { if (i < 0) return; const l = this.focusables(entry); (l[Math.min(i, l.length - 1)])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const t = this.top();
        const list = t ? this.focusables(t) : [...this.el.cmd.querySelectorAll('button:not([disabled])')];
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    pick(n) {   // number keys press the nth button of the command panel or the top screen
        const t = this.top();
        const list = t ? [...t.el.querySelectorAll('.sheet-body button.row:not([disabled]), .sheet-foot button:not([disabled])')] : [...this.el.cmd.querySelectorAll('button:not([disabled])')];
        list[n]?.click();
    }

    // ------------------------------------------------------------------ act + refresh
    do(cmd) {
        this.ctx.act(cmd);
    }
    refresh() {
        this.renderParty();
        this.renderCmd();
        this.renderInfo();
        const t = this.top();
        if (t) this.render(t);
    }

    // ------------------------------------------------------------------ HUD: party cards
    renderParty() {
        const G = this.G;
        const cards = G.party.map((m, i) => {
            const s = calc(m);
            const hp = this.over[i]?.hp ?? m.hp;
            const dead = hp <= 0;
            const st = Object.keys(m.st).filter((k) => STATUS_ICON[k]);
            return h('button', { class: `card ${dead ? 'dead' : ''} ${m.row === 0 ? 'front' : 'back'} ${this.bs && this.bs.who === i && G.battle && !G.battle.over && !this.busy ? 'active' : ''}`, 'data-i': i,
                onclick: () => this.open('camp', { tab: 'party', who: i }), 'aria-label': `${m.name}, ${CLASSES[m.cls].name} level ${m.lvl}, ${hp} of ${s.maxhp} HP` },
                h('div', { class: 'cportrait' }, portrait(m, 34)),
                h('div', { class: 'cbody' },
                    h('div', { class: 'cname' }, h('span', { class: `c${CLASSES[m.cls].col}` }, CLASSES[m.cls].icon), ' ', m.name),
                    h('div', { class: 'cmeta' }, `Lv${m.lvl} ${m.row === 0 ? 'F' : 'B'}`, st.map((k) => h('span', { class: `st c${STATUS_ICON[k][1]}`, title: k }, STATUS_ICON[k][0]))),
                    bar(hp / s.maxhp, hp / s.maxhp < 0.3 ? 12 : 10, 'hp'),
                    h('div', { class: 'cnum' }, dead ? 'DOWN' : `${hp}/${s.maxhp}`),
                    bar(m.mp / Math.max(1, s.maxmp), 9, 'mp')));
        });
        this.el.party.replaceChildren(...cards);
    }

    // ------------------------------------------------------------------ HUD: info strip + command panel
    renderInfo() {
        const G = this.G;
        const f = G.floor;
        const parts = [];
        parts.push(h('span', { class: 'gold' }, `${G.gold.toLocaleString('en-US')}g`));
        parts.push(h('span', null, `Day ${G.day}`));
        if (f) parts.push(h('span', { class: 'c11' }, `B${G.depth}F`));
        if (G.bless) parts.push(h('span', { class: 'c14', title: 'Blessed' }, `✚${G.bless.left}`));
        if (G.feast) parts.push(h('span', { class: 'c10', title: 'Well fed' }, `♨${G.feast.left}`));
        this.el.info.replaceChildren(...parts);
    }

    /** What the command panel would show. When it hasn't changed we keep the buttons: a tap that lands
     *  mid-refresh must not lose its target. */
    cmdSig() {
        const G = this.G, B = G.battle, bs = this.bs;
        return [this.mode, B ? `${B.round}/${B.over}/${B.enemies.map((e) => (e.hp > 0 ? 1 : 0)).join('')}` : '-', bs ? `${bs.step}/${bs.who}/${bs.pend ? bs.pend.side : ''}` : '-', this.busy, this.auto, !!this.lastCmds,
            totalPending(G), G.inv.length, G.party.map((m) => `${m.hp > 0 ? 1 : 0}${m.mp}`).join(','), this.eover ? Object.keys(this.eover).length : 0].join('|');
    }
    renderCmd() {
        const G = this.G, el = this.el.cmd;
        const sig = this.cmdSig();
        if (sig === this.lastCmdSig && el.firstChild) return;
        this.lastCmdSig = sig;
        el.replaceChildren();
        el.className = `cmd ${G.battle ? 'battle' : this.mode}`;
        if (G.battle) return this.renderBattleCmd();
        const pend = totalPending(G);
        if (this.mode === 'town') {
            const list = PLACES.map((pl, i) => h('button', {
                class: 'place', 'data-i': i,
                onfocus: () => this.stage.town.select(i), onmouseenter: () => this.stage.town.select(i),
                onclick: () => { this.stage.town.select(i); this.openPlace(pl.id); },
            }, h('span', { class: 'pn' }, i + 1), pl.name, pl.id === 'guild' && pend > 0 ? h('span', { class: 'badge' }, `+${pend}g`) : null));
            el.append(h('div', { class: 'places' }, list));
            el.append(h('div', { class: 'cmdrow' },
                pend > 0 ? h('button', { class: 'btn primary', onclick: () => this.do({ t: 'collect' }) }, `Collect ${pend}g`) : null,
                h('button', { class: 'btn', onclick: () => this.open('camp', { tab: 'items' }) }, 'Menu'),
                h('button', { class: 'btn', onclick: () => this.ctx.save(true) }, 'Save')));
            return;
        }
        el.append(h('div', { class: 'cmdrow' },
            h('button', { class: 'btn', onclick: () => this.open('camp', { tab: 'items' }) }, 'Menu'),
            h('button', { class: 'btn', onclick: () => this.open('map') }, 'Map'),
            h('button', { class: 'btn', onclick: () => this.do({ t: 'interact' }) }, 'Search'),
            h('button', { class: 'btn', onclick: () => this.ctx.save(true) }, 'Save')));
    }

    openPlace(id) {
        if (this.G.floor) return;
        this.open(id === 'dungeon' ? 'gate' : id);
    }

    // ------------------------------------------------------------------ battle UI
    ensureBs() {
        const G = this.G, B = G.battle;
        if (!B || B.over) { this.bs = null; return; }
        if (!this.bs || this.bs.round !== B.round) {
            const first = G.party.findIndex((m) => m.hp > 0);
            this.bs = { round: B.round, who: first, cmds: new Array(G.party.length).fill(null), step: 'top', pend: null };
        }
    }
    nextWho(from) {
        const G = this.G;
        for (let i = from + 1; i < G.party.length; i++) if (G.party[i].hp > 0) return i;
        return -1;
    }
    prevWho(from) {
        const G = this.G;
        for (let i = from - 1; i >= 0; i--) if (G.party[i].hp > 0) return i;
        return -1;
    }
    setCmd(c) {
        const bs = this.bs;
        bs.cmds[bs.who] = c;
        const n = this.nextWho(bs.who);
        if (n < 0) return this.submit();
        bs.who = n; bs.step = 'top'; bs.pend = null;
        this.refresh();
    }
    submit(cmds = null) {
        cmds = cmds || this.bs.cmds;
        this.lastCmds = cmds.map((c) => (c ? { ...c } : c));
        this.audio.sfxPlay('click');
        this.ctx.act({ t: 'round', cmds });
    }
    renderBattleCmd() {
        const G = this.G, B = G.battle, el = this.el.cmd;
        this.ensureBs();
        if (B.over) { el.append(h('div', { class: 'dim' }, B.over === 'win' ? 'Victory!' : B.over === 'lose' ? 'Defeat...' : 'Escaped.')); return; }
        if (this.busy) { el.append(h('div', { class: 'dim wait' }, '...')); return; }
        if (this.auto) {
            el.append(h('div', { class: 'dim' }, 'Auto-battle'), h('button', { class: 'btn danger', onclick: () => { this.auto = false; this.refresh(); } }, 'Stop auto'));
            return;
        }
        const bs = this.bs, m = G.party[bs.who];
        if (!m) return;
        el.append(h('div', { class: 'who' }, portrait(m, 28), h('span', null, h('b', { class: `c${CLASSES[m.cls].col}` }, m.name), ` — Round ${B.round + 1}`)));
        const btn = (label, fn, o = {}) => h('button', { class: `btn ${o.cls || ''}`, onclick: fn, disabled: o.off, title: o.title }, label);
        const back = () => btn('◂ Back', () => { bs.step = 'top'; bs.pend = null; this.refresh(); });
        if (bs.step === 'top') {
            el.append(h('div', { class: 'grid2' },
                btn('1 Attack', () => this.chooseTarget({ k: 'atk' }, 'e')),
                btn('2 Skill', () => { bs.step = 'skill'; this.refresh(); }, { off: !skillsFor(m).length }),
                btn('3 Item', () => { bs.step = 'item'; this.refresh(); }),
                btn('4 Defend', () => this.setCmd({ k: 'def' }))));
            el.append(h('div', { class: 'cmdrow small' },
                btn('Fight ↻', () => this.repeat(), { off: !this.lastCmds, title: 'Repeat last round' }),
                btn('Auto', () => { this.auto = true; this.autoStep(); }),
                bs.who !== G.party.findIndex((x) => x.hp > 0) ? btn('◂ Prev', () => { bs.who = this.prevWho(bs.who); bs.step = 'top'; this.refresh(); }) : null,
                btn('Flee', () => { this.audio.sfxPlay('click'); this.ctx.act({ t: 'flee' }); }, { cls: 'danger' })));
        } else if (bs.step === 'skill') {
            const list = skillsFor(m).map((k) => row({
                label: k.name, sub: k.desc, right: `${k.mp} MP`, disabled: k.mp > m.mp,
                onClick: () => this.pickSkill(k),
            }));
            el.append(h('div', { class: 'list' }, list), back());
        } else if (bs.step === 'item') {
            const items = G.inv.filter((it) => ['p', 's', 'm'].includes(it.t) && !(it.t === 's' && !['dmg', 'status', 'escape'].includes(require_k(it))) && !(it.t === 'p' && POTIONS[it.eff].k === 'buff' && false));
            const list = items.map((it) => row({ ic: icon(it), label: itemName(it), sub: it.t === 'm' ? `${it.charges}/${it.max} charges` : '', onClick: () => this.pickItem(it), disabled: it.t === 'm' && it.charges <= 0 }));
            el.append(h('div', { class: 'list' }, list.length ? list : h('div', { class: 'dim pad' }, 'Nothing to use.')), back());
        } else if (bs.step === 'target') {
            const p = bs.pend;
            el.append(h('div', { class: 'dim' }, p.side === 'e' ? 'Choose a target' : 'Choose an ally'));
            if (p.side === 'e') {
                B.enemies.forEach((e, i) => { if (e.hp > 0) el.append(row({ ic: canvasEl(monsterCanvas(e.sprite), 'px icon', 28, 28), label: e.name, sub: `Lv${e.lvl}`, right: `${this.eover[i]?.hp ?? e.hp}/${e.mhp}`, onClick: () => this.pickTarget(i), cls: 'tgt' })); });
            } else {
                G.party.forEach((a, i) => { const dead = a.hp <= 0; if (dead === !!p.dead) el.append(row({ ic: portrait(a, 28), label: a.name, right: `${a.hp}/${calc(a).maxhp}`, onClick: () => this.pickTarget(i), cls: 'tgt' })); });
            }
            el.append(back());
        }
    }
    chooseTarget(base, side, dead = false) {
        const G = this.G, bs = this.bs;
        if (side === 'e') {
            const live = battleLiveEnemies(G.battle);
            if (live.length === 1) return this.setCmd({ ...base, tg: { side: 'e', i: live[0] } });
        }
        bs.step = 'target'; bs.pend = { base, side, dead };
        this.refresh();
    }
    pickTarget(i) {
        const p = this.bs.pend;
        this.setCmd({ ...p.base, tg: { side: p.side, i } });
    }
    pickSkill(k) {
        const base = { k: 'skill', s: k.id };
        if (k.tg === 'e') this.chooseTarget(base, 'e');
        else if (k.tg === 'a') this.chooseTarget(base, 'p');
        else if (k.tg === 'd') this.chooseTarget(base, 'p', true);
        else this.setCmd(base);
    }
    pickItem(it) {
        const base = { k: 'item', it: it.id };
        if (it.t === 'p') this.chooseTarget(base, 'p', POTIONS[it.eff].k === 'revive');
        else if (it.t === 'm') { const sk = SKILLS[it.skill]; if (sk.tg === 'e') this.chooseTarget(base, 'e'); else if (sk.tg === 'a') this.chooseTarget(base, 'p'); else this.setCmd(base); }
        else this.setCmd(base);
    }
    repeat() {
        const G = this.G;
        const cmds = G.party.map((m, i) => (m.hp > 0 ? (this.lastCmds[i] || { k: 'atk' }) : null));
        this.submit(cmds);
    }
    autoStep() {
        const G = this.G;
        if (!this.auto || !G.battle || G.battle.over || this.busy) return;
        this.submit(autoCmds(G));
    }
    /** Click on an enemy tag over the 3D view. */
    tagClick(i) {
        if (this.bs?.step === 'target' && this.bs.pend.side === 'e' && !this.busy) this.pickTarget(i);
    }

    renderTags() {
        const G = this.G, B = G.battle, el = this.el.tags;
        if (!B || this.stage.mode !== 'dungeon') { el.replaceChildren(); return; }
        const targeting = this.bs?.step === 'target' && this.bs.pend.side === 'e' && !this.busy;
        const list = B.enemies.map((e, i) => {
            const hp = this.eover[i]?.hp ?? e.hp;
            if (hp <= 0 && this.stage.enemies[i]?.die === -2) return null;
            const pos = this.stage.enemyScreen(i);
            const dead = hp <= 0;
            return h('button', { class: `tag ${targeting && !dead ? 'pick' : ''} ${dead ? 'gone' : ''}`, style: `left:${pos.x * 100}%;top:${Math.min(94, (pos.y + (e.boss ? 0.36 : 0.18)) * 100)}%`, onclick: () => this.tagClick(i), tabindex: -1, 'aria-hidden': !targeting },
                h('span', null, e.name), bar(hp / e.mhp, hp / e.mhp < 0.3 ? 12 : 10, 'tiny'));
        });
        el.replaceChildren(...list.filter(Boolean));
    }

    // ------------------------------------------------------------------ log
    addLog(text, c = 15) {
        const line = h('div', { class: `ln c${c}` }, text);
        this.el.log.appendChild(line);
        while (this.el.log.childNodes.length > 120) this.el.log.firstChild.remove();
        this.el.log.scrollTop = this.el.log.scrollHeight;
        const t = h('div', { class: `tl c${c}` }, text);
        this.el.toast.appendChild(t);
        while (this.el.toast.childNodes.length > 3) this.el.toast.firstChild.remove();
        setTimeout(() => t.remove(), 7000);
    }
    popup(text, fx, fy, cls = '') {
        const p = h('div', { class: `pop ${cls}`, style: `left:${fx * 100}%;top:${fy * 100}%` }, text);
        this.el.overlay.appendChild(p);
        setTimeout(() => p.remove(), 1100);
    }
    cardPop(i, text, cls) {
        const c = this.el.party.children[i];
        if (!c) return;
        const r = c.getBoundingClientRect();
        const p = h('div', { class: `cardpop ${cls}`, style: `left:${r.left + r.width / 2}px;top:${r.top}px` }, text);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
        c.classList.add('hit');
        setTimeout(() => c.classList.remove('hit'), 300);
    }

    // ------------------------------------------------------------------ events → playback queue
    events(evs) {
        const G = this.G;
        for (const e of evs) {
            const entry = this.playback(e, G);
            if (entry) this.q.push(entry);
        }
        this.q.push({ fn: () => this.afterPlayback(), d: 0 });
    }
    msgDelay() { return this.G.battle && !this.G.battle.over ? 0.34 : this.G.battle ? 0.2 : 0; }
    playback(e, G) {
        const A = this.audio, S = this.stage;
        const bat = !!G.battle;
        switch (e.type) {
            case 'msg': { const d = bat ? 0.3 : 0; return { fn: () => this.addLog(e.text, e.c), d }; }
            case 'step': return { fn: () => { A.sfxPlay('step'); }, d: 0 };
            case 'turn': return { fn: () => A.sfxPlay('turn'), d: 0 };
            case 'bump': return { fn: () => { A.sfxPlay('bump'); S.doBump(); }, d: 0 };
            case 'door': return { fn: () => A.sfxPlay('door'), d: 0 };
            case 'secret': return { fn: () => A.sfxPlay('secret'), d: 0 };
            case 'found': return { fn: () => A.sfxPlay('found'), d: 0 };
            case 'search': return { fn: () => A.sfxPlay('search'), d: 0 };
            case 'trap': return { fn: () => { A.sfxPlay('trap'); S.doShake(1); S.flash([1, 0.2, 0.2], 0.3); }, d: 0.1 };
            case 'hurt': return { fn: () => { A.sfxPlay('hurt'); S.doShake(0.6); S.flash([1, 0, 0], 0.25); }, d: 0 };
            case 'chest': return { fn: () => A.sfxPlay('chest'), d: 0 };
            case 'item': return { fn: () => A.sfxPlay('item'), d: 0 };
            case 'gold': return { fn: () => A.sfxPlay('gold'), d: 0 };
            case 'heal': return { fn: () => { A.sfxPlay('heal'); S.flash([0.3, 1, 0.3], 0.25); }, d: 0 };
            case 'teleport': return { fn: () => { A.sfxPlay('tele'); this.instant = true; S.flash([1, 1, 1], 0.4); }, d: 0 };
            case 'spin': return { fn: () => { A.sfxPlay('turn'); this.instant = true; }, d: 0 };
            case 'equip': return { fn: () => A.sfxPlay('click'), d: 0 };
            case 'cursed': return { fn: () => { A.sfxPlay('curse'); S.flash([0.7, 0, 0.7], 0.5); }, d: 0 };
            case 'buy': return { fn: () => A.sfxPlay('buy'), d: 0 };
            case 'sell': return { fn: () => A.sfxPlay('sell'), d: 0 };
            case 'church': case 'bless': return { fn: () => A.sfxPlay('holy'), d: 0 };
            case 'eat': return { fn: () => A.sfxPlay('heal'), d: 0 };
            case 'invest': return { fn: () => A.sfxPlay('invest'), d: 0 };
            case 'recruit': return { fn: () => A.sfxPlay('levelup'), d: 0 };
            case 'rest': return { fn: () => { A.sfxPlay('rest'); S.fadeOut(); }, d: 0 };
            case 'day': return { fn: () => A.sfxPlay('day'), d: 0 };
            case 'stairs': return { fn: () => { A.sfxPlay('stairs'); S.fadeOut(); }, d: 0 };
            case 'floor': return { fn: () => { this.instant = true; this.ctx.onFloor?.(G); }, d: 0 };
            case 'town': return { fn: () => { this.ctx.onTown?.(G); }, d: 0 };
            case 'wipe': return { fn: () => { A.sfxPlay('lose'); }, d: 0.2 };
            case 'bossDown': return { fn: () => { A.sfxPlay('win'); }, d: 0 };
            case 'levelup': return { fn: () => { A.sfxPlay('levelup'); }, d: bat ? 0.3 : 0 };
            case 'battleStart': return { fn: () => { A.sfxPlay(e.boss ? 'bossIn' : 'encounter'); S.setBattle(G.battle.enemies); S.flash([1, 1, 1], 0.3); A.setMusic(e.boss ? 'boss' : 'battle', G.depth); this.auto = this.auto && false; this.bs = null; this.resultsShown = false; }, d: 0.45 };
            case 'b_round': return { fn: () => { this.addLog(`— Round ${e.round} —`, 8); }, d: 0.12 };
            case 'b_cast': return {
                fn: () => {
                    if (e.side === 'e') { S.lungeEnemy(e.i); A.sfxPlay(e.elem !== 'phys' ? e.elem : 'miss'); }
                    else if (e.skill !== 'attack' && e.skill !== 'item') A.sfxPlay(e.elem !== 'phys' ? e.elem : (SKILLS[e.skill]?.k === 'h' ? 'heal' : 'spell'));
                    else if (e.skill === 'item') A.sfxPlay('item');
                }, d: 0.12,
            };
            case 'b_hit': return {
                fn: () => {
                    if (e.side === 'e') {
                        S.hitEnemy(e.i, e.crit); this.eover[e.i] = { hp: e.hp };
                        const p = S.enemyScreen(e.i);
                        this.popup(String(e.dmg), p.x, p.y - 0.05, `dmg ${e.crit ? 'crit' : ''} ${e.weak ? 'weak' : ''}`);
                        A.sfxPlay(e.crit ? 'crit' : 'hit');
                        this.renderTags();
                    } else {
                        this.over[e.i] = { hp: e.hp };
                        this.cardPop(e.i, `-${e.dmg}`, e.crit ? 'crit' : '');
                        A.sfxPlay('hurt'); S.doShake(e.crit ? 1 : 0.5); S.flash([1, 0, 0], 0.18);
                        this.renderParty();
                    }
                }, d: 0.2,
            };
            case 'b_miss': return { fn: () => { A.sfxPlay('miss'); if (e.side === 'e') { const p = S.enemyScreen(e.i); this.popup('miss', p.x, p.y, 'miss'); } }, d: 0.05 };
            case 'b_heal': return {
                fn: () => {
                    if (e.side === 'p') { this.over[e.i] = { hp: e.hp }; if (e.amt) this.cardPop(e.i, `+${e.amt}`, 'heal'); this.renderParty(); } else { this.eover[e.i] = { hp: e.hp }; }
                }, d: 0.15,
            };
            case 'b_die': return { fn: () => { if (e.side === 'e') { S.killEnemy(e.i); this.renderTags(); A.sfxPlay('die'); } else { A.sfxPlay('die'); this.renderParty(); } }, d: 0.3 };
            case 'b_status': return { fn: () => A.sfxPlay('dark'), d: 0.1 };
            case 'b_buff': return { fn: () => A.sfxPlay('buff'), d: 0.1 };
            case 'b_rage': return { fn: () => { S.doShake(1); A.sfxPlay('bossIn'); S.flash([1, 0, 0], 0.4); }, d: 0.3 };
            case 'b_win': return { fn: () => { A.sfxPlay('win'); }, d: 0.2 };
            case 'b_lose': return { fn: () => { A.sfxPlay('lose'); S.flash([1, 0, 0], 0.8); }, d: 0.4 };
            case 'b_flee': return { fn: () => A.sfxPlay('flee'), d: 0.1 };
            default: return null;
        }
    }
    afterPlayback() {
        this.over = {}; this.eover = {};
        this.syncWorld();
        this.sync();
        this.refresh();
        this.renderTags();
    }
    pump(dt) {
        if (this.wait > 0) { this.wait -= dt; if (this.wait > 0) return; }
        while (this.q.length) {
            const e = this.q.shift();
            e.fn();
            if (e.d > 0) { this.wait = e.d; break; }
        }
    }

    /** Make the 3D stage match G (floor, pose, features). */
    syncWorld() {
        const G = this.G, S = this.stage;
        if (G.floor) {
            if (this.floorRef !== G.floor) {
                this.floorRef = G.floor;
                S.loadFloor(G.floor);
                S.setPose(G.pos.x, G.pos.y, G.pos.d, true);
                S.setMode('dungeon');
                S.fadeOut();
                this.audio.setMusic('dungeon', G.floor.theme * 7 + (G.depth % 7));
                this.instant = false;
            } else {
                S.setPose(G.pos.x, G.pos.y, G.pos.d, this.instant);
                this.instant = false;
            }
            S.syncFeatures();
            if (!G.battle && S.enemies.length) S.setBattle(null);
        } else if (this.floorRef) {
            this.floorRef = null;
            S.setMode('town');
            S.setBattle(null);
            S.fadeOut();
            this.audio.setMusic('town', 3);
        }
    }

    /** After the sim has moved on and the queue is empty: open what the sim is waiting on. */
    sync() {
        const G = this.G;
        if (G.battle) {
            this.ensureBs();
            if (G.battle.over) {
                if (!this.resultsShown && G.battle.over !== 'flee') { this.resultsShown = true; this.open('results'); }
                else if (G.battle.over === 'flee') { this.resultsShown = true; this.ctx.act({ t: 'endBattle' }); }
            } else if (this.auto) {
                setTimeout(() => this.autoStep(), 120);
            }
        } else {
            if (this.has('results')) this.close('results', true);
            if (this.stage.enemies.length) { this.stage.setBattle(null); this.audio.setMusic(G.floor ? 'dungeon' : 'town', G.floor ? G.floor.theme * 7 + (G.depth % 7) : 3); }
            this.bs = null; this.auto = false;
        }
        const top = this.top();
        if (G.dialog) {
            if (!top || top.name !== 'dialog') this.open('dialog');
            else this.render(top);
        } else if (top && top.name === 'dialog') this.close('dialog', true);
    }

    // ------------------------------------------------------------------ per frame
    frame(dt, G) {
        this.pump(dt);
        const f = G.floor;
        if (f && !this.top() && this.mode === 'dungeon') this.drawMini(G);
        const o = this.el.overlay;
        if (!this.compass) {
            this.compass = h('div', { class: 'compass' }); this.where = h('div', { class: 'where' });
            o.append(this.compass, this.where);
        }
        const txt = f ? DIR_NAMES[G.pos.d][0] : '';
        if (this.compass.textContent !== txt) this.compass.textContent = txt;
        const wh = f ? `${f.name}  (${G.pos.x},${G.pos.y})` : G.battle ? '' : 'Town';
        if (this.where.textContent !== wh) this.where.textContent = wh;
        this.el.app.classList.toggle('in-battle', !!G.battle);
        this.el.app.classList.toggle('in-dungeon', !!f);
    }
    drawMini(G) {
        const c = this.el.mini;
        if (c.width !== 160) { c.width = 160; c.height = 112; }
        drawMap(c, G, { cell: 12 });
    }
}
function require_k(it) {
    return ({ fire: 'dmg', ice: 'dmg', shock: 'dmg', holy: 'dmg', sleep: 'status', escape: 'escape', map: 'map', teleport: 'tele' })[it.eff];
}
export { WANDS, ELEM_COL, THEMES };
