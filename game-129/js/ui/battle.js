// HOLLOWDEEP — the battle screen. The sim resolves a whole round at once; this plays its events back one by one
// (who acts, what hits, the numbers, the sounds and the voices) and then shows the command menu for the next hero.
// It never changes G: commands go out through send().

import { $, el, monUrl, floatText, statusText, icon } from './common.js';
import { SKILLS, CLASSES } from '../sim/data/classes.js';
import { CONSUMABLES } from '../sim/data/items.js';
import { knownSkills, heroStats } from '../sim/stats.js';
import { MONSTERS } from '../sim/data/monsters.js';
import { validCommand, party } from '../sim/battle.js';
import { HERO_LINE } from '../voices.js';

const EL_SFX = { fire: 'fire', ice: 'ice', bolt: 'bolt', holy: 'holy', dark: 'dark' };
const DT = { act: 480, hit: 260, miss: 260, heal: 300, status: 200, resist: 160, down: 420, dot: 260, skip: 380, summon: 420, flee: 600, stolen: 400, steal: 400, revive: 420, mp: 0, round: 0 };

export class BattleUI {
    constructor({ audio, hud, send, sizes }) {
        this.audio = audio; this.hud = hud; this.send = send; this.sizes = sizes || {};
        this.queue = [];
        this.wait = 0;
        this.speed = 1;
        this.menu = null;       // { stage: 'top'|'skill'|'item'|'target', ... }
        this.foeEls = {};
        this.active = false;
        this.G = null;
        // tap a monster to target it
        $('foes').addEventListener('click', (e) => {
            const f = e.target.closest('.foe');
            if (!f || !this.menu || this.menu.stage !== 'target' || this.menu.tgt !== 'enemy') return;
            this._pick(f.dataset.uid);
        });
    }

    get busy() { return this.queue.length > 0 || this.wait > 0; }

    // ------------------------------------------------------------ events in
    onEvents(G, events) {
        this.G = G;
        for (const e of events) {
            if (e.type === 'battle') this._start(G, e);
            if (this.active || e.type === 'battle') this.queue.push(e);
        }
    }

    _start(G, e) {
        this.active = true;
        this.won = false;
        document.body.classList.add('inbattle');
        $('battle').hidden = false;
        $('battle-log').textContent = '';
        const box = $('foes');
        box.textContent = '';
        this.foeEls = {};
        for (const f of e.foes) this._addFoe(f);
        this.audio.fx('encounter');
        if (e.kind === 'boss') {
            this.audio.play('boss');
            this.audio.fx('roar');
            const mid = e.foes[0].mid;
            setTimeout(() => this.audio.say(mid, 0, { force: true }), 700);
        } else if (e.kind === 'reaper') {
            this.audio.play('boss');
            this.audio.fx('bell');
            setTimeout(() => this.audio.say('reaper', 0, { force: true }), 600);
        } else this.audio.play('battle');
        this.wait = 650;
        this.menu = null;
        this._renderMenu();
    }

    _addFoe(f) {
        const m = MONSTERS[f.mid];
        const sz = this.sizes[f.mid] || [300, 300];
        const big = m.boss ? 1 : m.elite ? 0.85 : 0.62 + Math.min(0.3, sz[1] / 380 * 0.3);
        const node = el('div.foe' + (m.fly ? '.fly' : '') + (m.boss ? '.boss' : ''), { 'data-uid': f.uid, style: `height:${Math.round(big * 100)}%;` }, [
            el('div.tag', { text: f.name }),
            el('img', { src: monUrl(f.mid), alt: f.name, draggable: 'false' }),
            el('div.fbar', {}, el('i', { style: 'width:100%' })),
            el('div.st'),
        ]);
        if (f.cycle) node.querySelector('img').style.filter = `hue-rotate(${(f.cycle * 70) % 360}deg) saturate(1.2) drop-shadow(0 6px 10px rgba(0,0,0,0.7))`;
        $('foes').append(node);
        this.foeEls[f.uid] = node;
    }

    _foe(uid) { return this.G?.battle?.foes.find((f) => f.uid === uid) || null; }
    _hero(uid) { return this.G?.roster.find((c) => 'h' + c.id === uid) || null; }
    _name(uid) { return uid?.[0] === 'h' ? this._hero(uid)?.name : (this._foe(uid)?.name || this._lastFoeName?.[uid] || 'It'); }

    _pointOf(uid) {
        if (uid?.[0] === 'h') {
            const r = this.hud.cardRect(+uid.slice(1));
            return r ? { x: r.left + r.width / 2, y: r.top + 8 } : { x: innerWidth / 2, y: innerHeight - 120 };
        }
        const n = this.foeEls[uid];
        const r = n?.querySelector('img')?.getBoundingClientRect() || n?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.4 } : { x: innerWidth / 2, y: innerHeight / 3 };
    }

    // ------------------------------------------------------------ playback
    frame(G, dtMs) {
        this.G = G;
        if (!this.active) return;
        this.wait -= dtMs * this.speed;
        while (this.wait <= 0 && this.queue.length) {
            const e = this.queue.shift();
            this.wait += (DT[e.type] ?? 0);
            this._play(G, e);
        }
        if (this.wait < 0) this.wait = 0;
        if (!this.busy && this.active) {
            if (G.mode === 'battle' && G.battle.phase === 'input') this._ensureMenu(G);
            else if (G.mode !== 'battle') this._end();
        }
    }

    _log(t) { $('battle-log').textContent = t; }

    _play(G, e) {
        const fx = (n, o) => this.audio.fx(n, o);
        switch (e.type) {
            case 'act': {
                const who = this._name(e.src);
                this._log(e.name === 'Attack' ? `${who} attacks!` : e.name === 'Defend' ? `${who} defends.` : `${who}: ${e.name}`);
                if (e.src[0] === 'e') { const n = this.foeEls[e.src]; n?.classList.remove('acting'); void n?.offsetWidth; n?.classList.add('acting'); }
                else this.hud.party(G, { active: +e.src.slice(1) });
                if (e.el && EL_SFX[e.el]) { const b = $('battle'); b.className = ''; void b.offsetWidth; b.classList.add('flash-' + e.el); fx(EL_SFX[e.el]); }
                if (e.src[0] === 'h' && e.skill && e.kind !== 'heal') {
                    const c = this._hero(e.src);
                    if (c) this.audio.say(c.por, HERO_LINE.cry, { chance: 0.3 });
                }
                if (e.kind === 'heal' || e.kind === 'revive') fx('heal');
                break;
            }
            case 'hit': {
                const p = this._pointOf(e.tgt);
                floatText(p.x, p.y, e.instant ? 'SLAIN' : String(e.dmg), [e.crit ? 'crit' : '', e.weak ? 'weak' : '', e.tgt[0] === 'h' ? 'small' : ''].filter(Boolean).join(' '));
                if (e.tgt[0] === 'h') { this.hud.flashCard(+e.tgt.slice(1), 'hit'); fx('hurt'); }
                else {
                    const n = this.foeEls[e.tgt];
                    n?.classList.remove('hit'); void n?.offsetWidth; n?.classList.add('hit');
                    const f = this._foe(e.tgt);
                    if (f && n) n.querySelector('.fbar i').style.width = `${Math.max(0, f.hp / f.mhp * 100)}%`;
                    if (!e.el || e.el === 'phys') fx(e.crit ? 'crit' : 'hit');
                }
                if (e.weak) this._log(`${this._name(e.tgt)} is weak to that!`);
                this.hud.party(G);
                break;
            }
            case 'miss': { const p = this._pointOf(e.tgt); floatText(p.x, p.y, 'miss', 'miss'); fx('miss'); break; }
            case 'heal': { if (e.amt > 0) { const p = this._pointOf(e.tgt); floatText(p.x, p.y, '+' + e.amt, 'heal'); if (e.tgt[0] === 'h') this.hud.flashCard(+e.tgt.slice(1), 'heal'); } this.hud.party(G); this._foeBars(); break; }
            case 'dot': { const p = this._pointOf(e.tgt); floatText(p.x, p.y, String(e.dmg), 'small'); this.hud.party(G); this._foeBars(); break; }
            case 'status': case 'resist': {
                const p = this._pointOf(e.tgt);
                if (e.type === 'resist') floatText(p.x, p.y, 'resisted', 'miss');
                else if (e.on) floatText(p.x, p.y + 24, e.id, 'miss');
                this.hud.party(G);
                if (e.tgt[0] === 'e') { const n = this.foeEls[e.tgt]; const f = this._foe(e.tgt); if (n && f) n.querySelector('.st').textContent = statusText(f.st); }
                break;
            }
            case 'skip': this._log(`${this._name(e.tgt)} is ${e.why === 'sleep' ? 'asleep' : e.why === 'stun' ? 'stunned' : 'paralysed'}.`); break;
            case 'down': {
                if (e.tgt[0] === 'e') {
                    const n = this.foeEls[e.tgt];
                    n?.classList.add('dead');
                    fx('down');
                    const f = this._foe(e.tgt);
                    if (f?.boss) this.audio.say(f.mid, 1, { force: true });
                    if (f?.mid === 'reaper') this.audio.say('reaper', 1, { force: true });
                } else {
                    const c = this._hero(e.tgt);
                    this._log(`${c?.name} falls!`);
                    if (c) this.audio.say(c.por, HERO_LINE.down, { force: true });
                    this.hud.party(G);
                }
                break;
            }
            case 'revive': this._log(`${this._name(e.tgt)} rises!`); this.hud.party(G); break;
            case 'summon': this._addFoe({ uid: e.uid, mid: e.mid, name: e.name }); this._log(`${e.name} rises from the frost!`); break;
            case 'flee': this._log(e.ok ? 'The party escapes!' : e.why === 'boss' ? 'There is no escape!' : 'Couldn\'t get away!'); break;
            case 'stolen': this._log(`${this._name(e.src)} stole ${e.gold} gold!`); break;
            case 'steal': this._log(`Pilfered ${e.gold} gold!`); this.audio.fx('coins'); break;
            case 'won': {
                this.won = true;
                this._log(`Victory! ${e.xp} XP, ${e.gold} gold.`);
                this.audio.play('victory');
                const alive = party(G).filter((c) => c.hp > 0);
                if (alive.length) this.audio.say(alive[Math.floor(Math.random() * alive.length)].por, HERO_LINE.win, { chance: 0.6 });
                this.wait += 1300;
                break;
            }
            case 'wipe': this._log('The party has fallen...'); this.audio.play('defeat'); this.wait += 1800; break;
            case 'battle_end': this.wait += e.result === 'won' ? 500 : 200; break;
            case 'levelup': {
                const c = G.roster.find((x) => x.id === e.cid);
                const r = this.hud.cardRect(e.cid);
                if (r) floatText(r.left + r.width / 2, r.top, `LEVEL ${e.lv}`, 'heal');
                this.audio.fx('levelup');
                if (e.learned.length) this._log(`${c?.name} learned ${e.learned.join(', ')}!`);
                this.wait += 350;
                break;
            }
            default: break;
        }
    }

    _foeBars() {
        for (const [uid, n] of Object.entries(this.foeEls)) { const f = this._foe(uid); if (f) n.querySelector('.fbar i').style.width = `${Math.max(0, f.hp / f.mhp * 100)}%`; }
    }

    _end() {
        this.active = false;
        document.body.classList.remove('inbattle');
        $('battle').hidden = true;
        $('battle-menu').hidden = true;
        this.menu = null;
        this.hud.party(this.G);
        this.onEnd?.(this.won);
    }

    // ------------------------------------------------------------ the command menu
    _ensureMenu(G) {
        const B = G.battle;
        const cid = B.order[B.cursor];
        if (!this.menu || this.menu.cid !== cid || this.menu.round !== B.round) {
            this.menu = { stage: 'top', cid, round: B.round };
            this._renderMenu();
        } else if ($('battle-menu').hidden) this._renderMenu();
    }

    _renderMenu() {
        const box = $('battle-menu'), list = $('bm-list');
        const G = this.G;
        if (!this.menu || !G?.battle || this.busy) { box.hidden = true; return; }
        box.hidden = false;
        list.textContent = '';
        const c = G.roster.find((x) => x.id === this.menu.cid);
        if (!c) { box.hidden = true; return; }
        this.hud.party(G, { active: c.id });
        const st = heroStats(c);
        $('bm-who').innerHTML = '';
        $('bm-who').append(el('span', { text: `${c.name} — ${CLASSES[c.cls].name}` }), el('span.dim', { text: `HP ${c.hp}/${st.hp}${st.mp ? `  MP ${c.mp}/${st.mp}` : ''}` }));
        const add = (label, sub, fn, { disabled = false, key, title } = {}) => {
            const b = el('button.btn', { onclick: () => { this.audio.ui('ok'); fn(); }, title }, [label, sub ? el('small', { text: sub }) : null]);
            if (disabled) b.disabled = true;
            if (key) b.dataset.key = key;
            list.append(b);
            return b;
        };
        const m = this.menu;
        this._targetable(false);
        if (m.stage === 'top') {
            $('bm-hint').textContent = 'Keys 1–6 · Esc goes back to the previous hero';
            add('⚔ Attack', null, () => { this.menu = { ...m, stage: 'target', tgt: 'enemy', cmd: { a: 'attack' } }; this._renderMenu(); }, { key: '1' });
            const sk = knownSkills(c);
            add('✦ Skills', sk.length ? `${sk.length} known` : 'none yet', () => { this.menu = { ...m, stage: 'skill' }; this._renderMenu(); }, { disabled: !sk.length, key: '2' });
            add('🛡 Defend', 'halve damage this round', () => this.send({ t: 'cmd', a: 'defend' }), { key: '3' });
            const items = G.inv.filter((e) => CONSUMABLES[e.id] && !CONSUMABLES[e.id].escape);
            add('⚗ Items', items.length ? `${items.reduce((a, e) => a + (e.n || 1), 0)} carried` : 'none', () => { this.menu = { ...m, stage: 'item' }; this._renderMenu(); }, { disabled: !items.length, key: '4' });
            add('🏃 Flee', G.battle.kind === 'boss' ? 'not from a guardian' : 'the whole party runs', () => this.send({ t: 'flee' }), { disabled: G.battle.kind === 'boss', key: '5' });
            add('⟳ Auto', 'everyone does the sensible thing', () => this.send({ t: 'auto' }), { key: '6' });
        } else if (m.stage === 'skill') {
            $('bm-hint').textContent = 'Esc: back';
            for (const s of knownSkills(c)) {
                const can = validCommand(G, c, { a: 'skill', skill: s.id, target: s.tgt === 'dead' ? this._firstDead(G) : null }) && (s.tgt !== 'dead' || this._firstDead(G));
                add(s.name, `${s.mp ? s.mp + ' MP · ' : s.hpCost ? Math.round(s.hpCost * 100) + '% HP · ' : ''}${s.desc}`, () => this._chooseSkill(s), { disabled: !can });
            }
            add('↩ Back', null, () => { this.menu = { ...m, stage: 'top' }; this._renderMenu(); });
        } else if (m.stage === 'item') {
            $('bm-hint').textContent = 'Esc: back';
            for (const e of G.inv) {
                const it = CONSUMABLES[e.id];
                if (!it || it.escape) continue;
                const b = add(`${it.name} ×${e.n || 1}`, it.desc, () => {
                    const tgt = it.tgt === 'enemies' ? null : it.tgt === 'dead' ? 'dead' : 'ally';
                    if (!tgt) this.send({ t: 'cmd', a: 'item', item: e.id });
                    else { this.menu = { ...m, stage: 'target', tgt, cmd: { a: 'item', item: e.id } }; this._renderMenu(); }
                }, { disabled: !validCommand(G, c, { a: 'item', item: e.id }) });
                b.prepend(icon(e.id));
            }
            add('↩ Back', null, () => { this.menu = { ...m, stage: 'top' }; this._renderMenu(); });
        } else if (m.stage === 'target') {
            if (m.tgt === 'enemy') {
                $('bm-hint').textContent = 'Tap a monster, or pick one here · Esc: back';
                this._targetable(true);
                for (const f of G.battle.foes.filter((x) => x.alive)) add(f.name, `HP ${Math.round(f.hp / f.mhp * 100)}%`, () => this._pick(f.uid));
            } else {
                $('bm-hint').textContent = 'Choose who · Esc: back';
                for (const x of party(G)) {
                    const dead = x.hp <= 0;
                    if (m.tgt === 'dead' ? !dead : dead) continue;
                    const s = heroStats(x);
                    add(x.name, `HP ${x.hp}/${s.hp}${s.mp ? ` · MP ${x.mp}/${s.mp}` : ''}${statusText(x.st) ? ' · ' + statusText(x.st) : ''}`, () => this._pick('h' + x.id));
                }
            }
            add('↩ Back', null, () => { this.menu = { ...m, stage: m.cmd.a === 'item' ? 'item' : m.cmd.a === 'skill' ? 'skill' : 'top' }; this._renderMenu(); });
        }
        const first = list.querySelector('button:not([disabled])');
        if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
    }

    _firstDead(G) { const d = party(G).find((x) => x.hp <= 0); return d ? 'h' + d.id : null; }

    _chooseSkill(s) {
        const m = this.menu;
        const cmd = { a: 'skill', skill: s.id };
        if (s.tgt === 'enemy') { this.menu = { ...m, stage: 'target', tgt: 'enemy', cmd }; this._renderMenu(); }
        else if (s.tgt === 'ally') { this.menu = { ...m, stage: 'target', tgt: 'ally', cmd }; this._renderMenu(); }
        else if (s.tgt === 'dead') { this.menu = { ...m, stage: 'target', tgt: 'dead', cmd }; this._renderMenu(); }
        else this.send({ t: 'cmd', ...cmd, target: null });
    }

    _pick(uid) {
        const m = this.menu;
        if (!m?.cmd) return;
        this._targetable(false);
        this.send({ t: 'cmd', ...m.cmd, target: uid });
    }

    _targetable(on) { for (const n of Object.values(this.foeEls)) n.classList.toggle('targetable', on && !n.classList.contains('dead')); }

    /** After a command was accepted (or refused), redraw. */
    refresh() { this.menu = null; $('battle-menu').hidden = true; }

    /** Keyboard: number keys and Escape. Returns true if handled. */
    key(code) {
        if (!this.active || !this.menu || this.busy) return false;
        const list = $('bm-list');
        if (code === 'Escape' || code === 'Backspace') {
            if (this.menu.stage === 'top') { this.send({ t: 'back' }); }
            else { this.menu = { ...this.menu, stage: this.menu.stage === 'target' && this.menu.cmd?.a === 'skill' ? 'skill' : this.menu.stage === 'target' && this.menu.cmd?.a === 'item' ? 'item' : 'top' }; this._renderMenu(); }
            this.audio.ui('back');
            return true;
        }
        const m = /^Digit([1-9])$/.exec(code);
        if (m) {
            const btns = [...list.querySelectorAll('button')];
            const b = this.menu.stage === 'top' ? list.querySelector(`[data-key="${m[1]}"]`) : btns[+m[1] - 1];
            if (b && !b.disabled) b.click();
            return true;
        }
        if (code === 'ArrowDown' || code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowRight') {
            const btns = [...list.querySelectorAll('button:not([disabled])')];
            if (!btns.length) return true;
            const i = btns.indexOf(document.activeElement);
            const step = code === 'ArrowDown' ? 2 : code === 'ArrowUp' ? -2 : code === 'ArrowRight' ? 1 : -1;
            btns[(i + step + btns.length * 2) % btns.length].focus();
            this.audio.ui('move');
            return true;
        }
        return false;
    }
}

export { SKILLS };
