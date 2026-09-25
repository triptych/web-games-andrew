// ============================================================
// The battle scene: drawn on the game canvas, commanded from a
// DOM bar. Plays the sim's event list back one beat at a time.
// ============================================================

import { ITEM } from '../data/items.js';
import { ELEM_ICON, ELEM_HUE } from '../data/monsters.js';
import { SKILLS, INTENT_ICON } from '../sim/combat.js';
import { $, h, clear, iconEl } from './dom.js';

const INTENT_TEXT = { attack: 'will attack', charge: 'is winding up!', unleash: 'is about to unleash a huge hit!', guard: 'is guarding', elemental: 'is gathering power (hits everyone)', heal: 'will heal', debuff: 'will curse', double: 'will strike twice', summon: 'will call for help', stunned: 'is off guard' };
const BG = {
    field: ['#9fd0f0', '#dff0c8', '#6aa84f'], forest: ['#7fb7a0', '#c8e6b8', '#3f7a3a'], downs: ['#a8d8f8', '#f0f0c8', '#8ac060'],
    lake: ['#8fc0e0', '#d0ecf0', '#4f9a8a'], crags: ['#d08060', '#f0c090', '#6a4a3a'], heights: ['#b8c8e8', '#f0f4ff', '#c8d4e8'],
    dungeon: ['#2a2230', '#3e3448', '#4a4050'], cave: ['#1e1a24', '#302838', '#3a3440'],
};

export class BattleView {
    constructor(ui) {
        this.ui = ui; this.game = null;
        this.fx = []; this.queue = []; this.busy = false; this.disp = {}; this.anim = {}; this.t = 0;
        this.logEl = $('#battle-log'); this.cmdEl = $('#battle-cmds');
    }
    start(game, B) {
        this.game = game; this.B = B;
        this.disp = {}; this.anim = {}; this.fx = []; this.queue = []; this.busy = false; this.result = null;
        for (const a of [...B.allies, ...B.foes]) { this.disp[a.ref] = a.hp; this.anim[a.ref] = { lunge: 0, flash: 0, dead: a.hp <= 0 ? 1 : 0 }; }
        this.say(B.firstStrike ? 'You strike first!' : B.boss ? `${B.foes[0].name} blocks the way!` : `${B.foes.map(f => f.name).join(', ')} appear${B.foes.length > 1 ? '' : 's'}!`);
        this.menu();
    }
    say(t) { this.logEl.textContent = t; }

    // ------------------------------------------------------------ commands
    menu() {
        const B = this.B, g = this.game;
        clear(this.cmdEl);
        if (B.over) return this.showResult();
        const intents = B.foes.filter(f => f.hp > 0).map(f => `${f.name} ${INTENT_TEXT[f.intent] ?? ''}`);
        this.say(intents.join(' · '));
        const btn = (label, sub, fn, cls = '') => { const b = h('button', { class: 'btn ' + cls }, label, sub ? h('small', {}, sub) : null); b.onclick = () => { if (!this.busy) fn(); }; this.cmdEl.append(b); return b; };
        btn('⚔ Attack', g.stats.elem !== 'none' ? `${ELEM_ICON[g.stats.elem]} ${g.stats.elem}` : '', () => this.target(t => this.act({ type: 'attack', target: t })), 'primary');
        const skills = SKILLS.filter(s => g.p.level >= s.lv);
        btn('✦ Skills', `${B.allies[0].sp}/${B.allies[0].maxSp} SP`, () => this.skillMenu()).disabled = !skills.length;
        btn('🍎 Items', '', () => this.itemMenu());
        btn('🛡 Guard', '½ damage, +2 SP', () => this.act({ type: 'guard' }));
        if (B.canFlee) btn('🏃 Flee', '', () => this.act({ type: 'flee' }));
    }
    target(fn) {
        const alive = this.B.foes.filter(f => f.hp > 0);
        if (alive.length <= 1) return fn(alive[0]?.ref);
        clear(this.cmdEl);
        this.say('Choose a target');
        for (const f of alive) { const b = h('button', { class: 'btn' }, `${f.name}`, h('small', {}, `${f.hp}/${f.maxHp} ${ELEM_ICON[f.elem] ?? ''}`)); b.onclick = () => fn(f.ref); this.cmdEl.append(b); }
        const back = h('button', { class: 'btn' }, '↩ Back'); back.onclick = () => this.menu(); this.cmdEl.append(back);
    }
    skillMenu() {
        const g = this.game, P = this.B.allies[0];
        clear(this.cmdEl);
        for (const S of SKILLS.filter(s => g.p.level >= s.lv)) {
            const b = h('button', { class: 'btn' }, `${S.name}`, h('small', {}, `${S.sp} SP · ${S.desc}`));
            b.disabled = P.sp < S.sp;
            b.onclick = () => { if (S.target === 'one') this.target(t => this.act({ type: 'skill', skill: S.id, target: t })); else this.act({ type: 'skill', skill: S.id }); };
            this.cmdEl.append(b);
        }
        const back = h('button', { class: 'btn' }, '↩ Back'); back.onclick = () => this.menu(); this.cmdEl.append(back);
    }
    itemMenu() {
        const g = this.game;
        clear(this.cmdEl);
        const seen = new Set();
        let n = 0;
        for (let i = 0; i < g.s.invSize; i++) {
            const s = g.s.inv[i];
            if (!s || seen.has(s.id)) continue;
            const it = ITEM[s.id];
            if (!it.food || (!it.food.hp && !it.food.sp)) continue;
            seen.add(s.id); n++;
            const b = h('button', { class: 'btn' }, iconEl(this.ui.sprites, s.id, 20), ` ${it.name}`, h('small', {}, `×${g.count(s.id)} · ${it.food.hp ? '+' + it.food.hp + ' HP ' : ''}${it.food.sp ? '+' + it.food.sp + ' SP' : ''}`));
            b.onclick = () => this.act({ type: 'item', id: s.id });
            this.cmdEl.append(b);
        }
        if (!n) this.cmdEl.append(h('div', { class: 'muted wide' }, 'No food or potions in your backpack.'));
        const back = h('button', { class: 'btn' }, '↩ Back'); back.onclick = () => this.menu(); this.cmdEl.append(back);
    }
    act(action) {
        if (this.busy) return;
        clear(this.cmdEl);
        const ev = this.game.battleAct(action);
        this.queue.push(...ev);
        this.busy = true;
        this.next();
    }

    // ------------------------------------------------------------ playback
    next() {
        const e = this.queue.shift();
        if (!e) { this.busy = false; this.menu(); return; }
        const B = this.B, sfx = n => this.ui.audio.sfx(n);
        const name = ref => this.game.actorByRef(B, ref)?.name ?? '';
        let wait = 420;
        switch (e.t) {
            case 'hit': {
                if (this.anim[e.a]) this.anim[e.a].lunge = 1;
                this.disp[e.target] = Math.max(0, (this.disp[e.target] ?? 0) - e.dmg);
                if (this.anim[e.target]) this.anim[e.target].flash = 1;
                this.float(e.target, `${e.dmg}${e.crit ? '!' : ''}`, e.weak ? '#ffd24a' : e.resist ? '#b0b0c0' : '#fff');
                this.say(`${name(e.a)} hits ${name(e.target)} for ${e.dmg}${e.crit ? ' — critical!' : ''}${e.weak ? ' It\'s super effective!' : e.resist ? ' It resists.' : ''}`);
                sfx(e.crit ? 'crit' : e.target === 'p' || e.target === 'c' ? 'hurt' : 'hit');
                if (e.elem && e.elem !== 'none') this.sparks(e.target, ELEM_HUE[e.elem]);
                if (e.target === 'p') this.ui.shake(0.25);
                break;
            }
            case 'skill': this.say(`${name(e.a)} uses ${e.name}!`); sfx('skill'); wait = 380; break;
            case 'guard': this.say(`${name(e.a)} guards.`); sfx('guard'); wait = 280; break;
            case 'charge': this.say(`${name(e.a)} is winding up a big attack! 💢`); sfx('charge'); if (this.anim[e.a]) this.anim[e.a].flash = 0.6; break;
            case 'cast': this.say(`${name(e.a)} unleashes ${e.elem} power!`); sfx('cast'); this.sparks('p', ELEM_HUE[e.elem]); wait = 350; break;
            case 'heal': this.disp[e.target] = Math.min(this.game.actorByRef(B, e.target).maxHp, (this.disp[e.target] ?? 0) + e.amt); this.float(e.target, '+' + e.amt, '#8ef08a'); this.say(`${name(e.target)} recovers ${e.amt} HP${e.item ? ` (${e.item})` : ''}.`); sfx('heal'); break;
            case 'sp': this.float(e.target, '+' + e.amt + ' SP', '#9ac3ff'); sfx('heal'); break;
            case 'buff': this.say(`${name(e.target)}: ${e.text}`); sfx('buff'); break;
            case 'debuff': this.say(`${name(e.target)}: ${e.text}`); sfx('debuff'); this.float(e.target, e.text, '#d8a0ff'); break;
            case 'burn': this.disp[e.target] = Math.max(0, (this.disp[e.target] ?? 0) - e.dmg); this.float(e.target, `${e.dmg}`, '#d8a0ff'); wait = 300; break;
            case 'die': this.anim[e.target].dying = 1; this.say(`${name(e.target)} ${e.target[0] === 'f' ? 'is defeated!' : 'falls!'}`); sfx(e.target[0] === 'f' ? 'defeat' : 'faint'); wait = 500; break;
            case 'summon': this.disp[e.foe] = this.game.actorByRef(B, e.foe).hp; this.anim[e.foe] = { lunge: 0, flash: 1, dead: 0 }; this.say(`${name(e.a)} calls a ${e.name}!`); sfx('summon'); break;
            case 'flee-ok': this.say('You got away safely!'); sfx('flee'); break;
            case 'flee-fail': this.say("Couldn't get away!"); sfx('deny'); break;
            case 'text': this.say(e.text); break;
            case 'win': this.result = e; wait = 200; break;
            case 'lose': this.result = e; wait = 200; break;
        }
        setTimeout(() => this.next(), wait);
    }
    showResult() {
        const B = this.B;
        clear(this.cmdEl);
        let text;
        if (B.over === 'win') {
            const r = B.rewards ?? { xp: 0, gold: 0, drops: [] };
            text = `Victory! +${r.xp} XP, +${r.gold} gold${r.drops.length ? ', ' + r.drops.map(([id, n]) => `${n} ${ITEM[id].name}`).join(', ') : ''}.`;
            this.ui.audio.sfx('victory');
        } else if (B.over === 'lose') { text = 'You collapse… Everything goes dark.'; this.ui.audio.sfx('faint'); }
        else text = 'You got away.';
        this.say(text);
        const b = h('button', { class: 'btn primary wide' }, 'Continue');
        b.onclick = () => this.ui.endBattle();
        this.cmdEl.append(b);
        setTimeout(() => b.focus?.(), 50);
    }
    float(ref, text, color) { this.fx.push({ ref, text, color, t: 0 }); }
    sparks(ref, hue) { for (let k = 0; k < 10; k++) this.fx.push({ ref, spark: true, hue, t: 0, a: Math.random() * 6.28, v: 20 + Math.random() * 30 }); }

    // ------------------------------------------------------------ drawing
    layout(W, H) {
        const reserve = this.ui.battleReserve?.() ?? 0;
        const HH = Math.max(120, H - reserve);
        const s = Math.max(2, Math.min(5, Math.floor(Math.min(W / 4, HH / 3.2) / 16)));
        return { HH, s };
    }
    pos(ref, W, H) {
        const B = this.B, { HH, s } = this.layout(W, H);
        const top = Math.max(56, HH * 0.28);
        if (ref[0] === 'f') {
            const alive = B.foes; const k = +ref.slice(1), n = alive.length;
            const span = HH - top - 20;
            const y = top + span * ((k + 1) / (n + 1)) + (n > 1 ? 0 : 10);
            return { x: W * 0.3 + (k % 2) * s * 8, y, s: B.foes[k].boss ? s * 2 : s };
        }
        const k = ref === 'p' ? 0 : 1;
        return { x: W * 0.7 + k * s * 10, y: top + (HH - top - 20) * (k ? 0.72 : 0.42), s };
    }
    draw(g, W, H, dt, ov) {
        const T = (x, y, str, o) => ov?.text(x, y, str, o);
        const B = this.B; if (!B) return;
        this.t += dt;
        const { HH } = this.layout(W, H);
        const pal = BG[B.bg] ?? BG.field;
        const sky = g.createLinearGradient(0, 0, 0, HH);
        sky.addColorStop(0, pal[0]); sky.addColorStop(0.55, pal[1]); sky.addColorStop(0.56, pal[2]); sky.addColorStop(1, shadeHex(pal[2], -0.3));
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let k = 0; k < 7; k++) { const y = HH * 0.6 + k * 9; g.fillRect(0, y, W, 1); }
        const sp = this.ui.sprites, game = this.game;
        // foes
        for (const f of B.foes) {
            const a = this.anim[f.ref]; if (!a) continue;
            if (a.dying) a.dead = Math.min(1, a.dead + dt * 2.5);
            if (a.dead >= 1 && f.hp <= 0) continue;
            const p = this.pos(f.ref, W, H);
            const c = sp.monster(game.species[f.species], Math.floor(this.t * 2.5) % 2);
            const size = c.width * p.s;
            const lx = a.lunge > 0 ? Math.sin(a.lunge * Math.PI) * 10 : 0;
            a.lunge = Math.max(0, a.lunge - dt * 3);
            g.globalAlpha = 1 - a.dead;
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(p.x, p.y + 2, size * 0.4, size * 0.1, 0, 0, 7); g.fill();
            g.drawImage(c, Math.round(p.x - size / 2 + lx), Math.round(p.y - size), size, size);
            if (a.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a.flash * 0.8; g.drawImage(c, Math.round(p.x - size / 2 + lx), Math.round(p.y - size), size, size); g.globalCompositeOperation = 'source-over'; a.flash = Math.max(0, a.flash - dt * 4); }
            g.globalAlpha = 1;
            if (f.hp > 0 || this.disp[f.ref] > 0) {
                this.hpBar(g, p.x - 20, p.y - size - 12, 40, this.disp[f.ref] / f.maxHp, '#e05a6a');
                T(p.x, p.y - size - 16, `${f.name} ${ELEM_ICON[f.elem] ?? ''}`, { size: 11 });
                if (!B.over && f.intent) T(p.x + 26, p.y - size - 2 + Math.sin(this.t * 5) * 1.5, INTENT_ICON[f.intent] ?? '', { size: 15, stroke: null });
            }
        }
        // allies
        for (const al of B.allies) {
            const a = this.anim[al.ref]; if (!a) continue;
            const p = this.pos(al.ref, W, H);
            const look = al.ref === 'p' ? game.p.look : game.people[al.job].look;
            const frame = a.lunge > 0 ? 3 : (B.over === 'lose' && al.ref === 'p' ? 0 : Math.floor(this.t * 2) % 2 ? 0 : 0);
            const c = sp.person(look, 2, frame);
            const w = c.width * p.s, hh = c.height * p.s;
            const lx = a.lunge > 0 ? -Math.sin(a.lunge * Math.PI) * 10 : 0;
            a.lunge = Math.max(0, a.lunge - dt * 3);
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(p.x, p.y + 2, w * 0.35, w * 0.1, 0, 0, 7); g.fill();
            g.globalAlpha = al.hp <= 0 ? 0.4 : 1;
            g.drawImage(c, Math.round(p.x - w / 2 + lx), Math.round(p.y - hh), w, hh);
            if (a.flash > 0) { g.fillStyle = `rgba(255,80,80,${a.flash * 0.35})`; g.fillRect(p.x - w / 2, p.y - hh, w, hh); a.flash = Math.max(0, a.flash - dt * 4); }
            g.globalAlpha = 1;
            if (al.status.guard) T(p.x - w / 2 - 6, p.y - hh / 2, '🛡', { size: 16, stroke: null });
            this.hpBar(g, p.x - 22, p.y - hh - 10, 44, this.disp[al.ref] / al.maxHp, '#6fce6a');
            if (al.ref === 'p') this.hpBar(g, p.x - 22, p.y - hh - 5, 44, al.sp / al.maxSp, '#6f9ae8');
            T(p.x, p.y - hh - 14, `${al.name} ${Math.max(0, Math.round(this.disp[al.ref]))}/${al.maxHp}`, { size: 11 });
        }
        // effects
        this.fx = this.fx.filter(f => (f.t += dt) < (f.spark ? 0.5 : 1.1));
        for (const f of this.fx) {
            const p = this.pos(f.ref, W, H);
            if (f.spark) { g.fillStyle = `hsla(${f.hue},90%,65%,${1 - f.t * 2})`; g.fillRect(p.x + Math.cos(f.a) * f.v * f.t * 2, p.y - 16 + Math.sin(f.a) * f.v * f.t * 2, 2, 2); continue; }
            const k = this.fx.filter(o => !o.spark && o.ref === f.ref && o.t < f.t).length;
            T(p.x, p.y - 44 - f.t * 18 - k * 12, f.text, { size: 16, color: f.color, alpha: Math.min(1, 2 - f.t * 1.8) });
        }
    }
    hpBar(g, x, y, w, f, col) {
        g.fillStyle = '#2d2418'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, w + 2, 5);
        g.fillStyle = '#5a4a36'; g.fillRect(Math.round(x), Math.round(y), w, 3);
        g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w * Math.max(0, Math.min(1, f)))), 3);
    }
}

function shadeHex(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
