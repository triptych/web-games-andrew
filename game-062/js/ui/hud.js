// The HUD: Freshness and Juice globes, the belt, the skill bar, XP, area name, the hovered
// target, the boss bar, buffs, toasts, banners and the minimap.

import { $, esc, itemIcon } from './dom.js';
import { SKILLS, CLASSES } from '../sim/data/classes.js';
import { ELITE_MODS, MONSTERS } from '../sim/data/monsters.js';
import { NPCS, SHRINES } from '../sim/data/story.js';
import { xpForLevel, skillRank } from '../sim/hero.js';
import { RARITY } from '../config.js';
import { OBJ_NAMES } from '../sim/world.js';
import { displayName } from '../sim/items.js';
import { drawMinimap } from './automap.js';
import { tooltip } from './dom.js';

const KEYS = ['LMB', 'RMB', '1', '2', '3', '4'];

export class HUD {
    constructor(app) {
        this.app = app;
        this.el = $('hud');
        this.mapT = 0;
        this.cache = {};
        this.toastEls = [];
        this.bannerT = 0;
        this.buildSkillbar();
        $('pot-hp').addEventListener('click', () => app.drink('hp'));
        $('pot-juice').addEventListener('click', () => app.drink('juice'));
        $('pot-pie').addEventListener('click', () => app.pie());
        $('mb-char').addEventListener('click', () => app.panels.toggle('char'));
        $('mb-inv').addEventListener('click', () => app.panels.toggle('inv'));
        $('mb-skills').addEventListener('click', () => app.panels.toggle('skills'));
        $('mb-quests').addEventListener('click', () => app.panels.toggle('quests'));
        $('mb-map').addEventListener('click', () => app.toggleMap());
        $('mb-menu').addEventListener('click', () => app.panels.toggle('menu'));
        for (const g of ['g-hp', 'g-juice']) $(g).addEventListener('click', () => $(g).classList.toggle('show'));
    }

    show(on) { this.el.classList.toggle('hidden', !on); }

    buildSkillbar() {
        const bar = $('skillbar');
        bar.innerHTML = KEYS.map((k, i) => `<div class="slot" data-i="${i}"><kbd>${k}</kbd><span class="ic"></span><span class="cost"></span><div class="cd"></div></div>`).join('');
        bar.querySelectorAll('.slot').forEach((el) => {
            el.addEventListener('click', () => this.app.panels.open('skills'));
            el.addEventListener('pointerenter', (e) => {
                const id = this.app.game && this.app.game.hero.bar[+el.dataset.i];
                if (!id) return;
                const sk = SKILLS[id], hero = this.app.game.hero;
                const r = Math.max(1, skillRank(hero, id, this.app.world.hero.st));
                tooltip.show(`<div class="tn" style="color:#ffcc4a">${sk.icon} ${esc(sk.name)}</div><div class="tb2">Rank ${r}${sk.cost ? ` · ${sk.cost} Juice` : ' · free'}${sk.cd ? ` · ${sk.cd}s cooldown` : ''}</div><div>${esc(sk.desc(r, sk))}</div>`, e.clientX, e.clientY - 120);
            });
            el.addEventListener('pointerleave', () => tooltip.hide());
        });
    }

    update(dt) {
        const app = this.app, g = app.game, w = app.world;
        if (!g || !w) return;
        const h = w.hero, hero = g.hero;
        const set = (key, el, v, prop = 'textContent') => { if (this.cache[key] !== v) { this.cache[key] = v; el[prop] = v; } };
        // Globes.
        const hpK = Math.max(0, h.hp / h.maxHp), jK = Math.max(0, h.juice / h.maxJuice);
        $('g-hp').querySelector('.liquid').style.height = `${(hpK * 100).toFixed(1)}%`;
        $('g-juice').querySelector('.liquid').style.height = `${(jK * 100).toFixed(1)}%`;
        set('hpT', $('g-hp-t'), `${Math.ceil(h.hp)} / ${h.maxHp}`);
        set('jT', $('g-juice-t'), `${Math.floor(h.juice)} / ${h.maxJuice}`);
        // Belt.
        for (const k of ['hp', 'juice', 'pie']) { set('p' + k, $(`pot-${k}-n`), String(hero.potions[k])); $(`pot-${k}`).classList.toggle('empty', hero.potions[k] <= 0); }
        // Skill bar (desktop) and touch buttons.
        const slots = $('skillbar').children;
        for (let i = 0; i < 6; i++) {
            const id = hero.bar[i];
            const el = slots[i];
            const sk = id && SKILLS[id];
            set('sk' + i, el.querySelector('.ic'), sk ? sk.icon : '·');
            el.classList.toggle('empty', !sk);
            if (!sk) continue;
            const cost = Math.round(sk.cost * (1 - h.st.costReduce / 100));
            set('skc' + i, el.querySelector('.cost'), cost ? String(cost) : '');
            el.classList.toggle('nojuice', h.juice < cost && !h.buffs.shrine_free);
            const cdMax = sk.cd * (1 - h.st.cdr / 100);
            const cd = h.cds[id] > 0 && cdMax ? (h.cds[id] / cdMax) * 100 : 0;
            el.querySelector('.cd').style.setProperty('--cd', `${cd.toFixed(1)}%`);
        }
        if (app.input.isTouch) {
            for (let s = 1; s <= 5; s++) {
                const b = document.querySelector(`.tb[data-slot="${s}"]`);
                const id = hero.bar[s];
                const sk = id && SKILLS[id];
                b.classList.toggle('empty', !sk);
                if (!sk) continue;
                if (b.dataset.sk !== id) { b.dataset.sk = id; b.innerHTML = `${sk.icon}<div class="cd"></div>`; }
                const cost = Math.round(sk.cost * (1 - h.st.costReduce / 100));
                b.classList.toggle('nojuice', h.juice < cost && !h.buffs.shrine_free);
                const cdMax = sk.cd * (1 - h.st.cdr / 100);
                const cd = h.cds[id] > 0 && cdMax ? (h.cds[id] / cdMax) * 100 : 0;
                b.querySelector('.cd').style.setProperty('--cd', `${cd.toFixed(1)}%`);
            }
        }
        // XP.
        const need = xpForLevel(hero.level);
        $('xp').firstElementChild.style.width = `${Math.min(100, (hero.xp / need) * 100).toFixed(1)}%`;
        set('xpT', $('xp-t'), `Level ${hero.level} · ${hero.xp} / ${need} XP`);
        // Notification dots.
        $('mb-char').querySelector('.dot').classList.toggle('hidden', hero.statPts <= 0);
        $('mb-skills').querySelector('.dot').classList.toggle('hidden', hero.skillPts <= 0);
        // Target.
        this.updateTarget(w);
        // Boss bar.
        const b = w.boss();
        const bossOn = b && !b.dead && b.state !== 'sleep';
        $('bossbar').classList.toggle('hidden', !bossOn);
        if (bossOn) { set('bbN', $('bb-name'), `${b.name}`); $('bb-bar').firstElementChild.style.width = `${Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1)}%`; }
        // Buffs.
        const bk = Object.keys(h.buffs).map((k) => `${k}:${Math.ceil(h.buffs[k].t)}`).join(',');
        if (bk !== this.cache.buffs) {
            this.cache.buffs = bk;
            $('buffs').innerHTML = Object.entries(h.buffs).map(([k, v]) => `<div class="buff" title="${esc(v.name || k)}">${k === 'juiceup' ? '💪' : { shrine_dmg: '🗡️', shrine_armor: '🛡️', shrine_speed: '💨', shrine_xp: '⭐', shrine_free: '🫧' }[k] || '✨'}<small>${Math.ceil(v.t)}</small></div>`).join('');
        }
        // Minimap.
        this.mapT -= dt;
        if (this.mapT <= 0) { this.mapT = 0.12; drawMinimap($('minimap'), w); }
        // Banner timeout.
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.add('hidden'); }
    }

    updateTarget(w) {
        const t = this.app.view.hover;
        const el = $('target');
        if (!t) { el.classList.add('hidden'); return; }
        let name = '', color = '#fff', sub = '', hp = null;
        if (t.kind === 'mon') {
            const m = w.monById(t.id);
            if (!m || m.dead || (m.boss && m.state !== 'sleep')) { el.classList.add('hidden'); return; }
            name = m.name; color = m.boss ? '#ff8a5a' : m.elite === 'champion' ? '#6fa8ff' : m.elite ? '#ffcc4a' : '#fff';
            sub = `Level ${m.lvl}${m.mods.length ? ' · ' + m.mods.map((k) => ELITE_MODS[k].name).join(', ') : ''}${m.boss ? ' · ' + (m.def.title || '') : ''}`;
            hp = m.hp / m.maxHp;
        } else if (t.kind === 'npc') { const n = w.npcById(t.id); name = n.name; sub = NPCS[n.npc].title; color = '#7dffa6'; }
        else if (t.kind === 'obj') { const o = w.objById(t.id); if (!o) { el.classList.add('hidden'); return; } name = o.type === 'shrine' ? SHRINES[o.shrine].name : o.type === 'portal' ? (w.town ? 'Portal back down' : 'Portal to Tristrawberry') : OBJ_NAMES[o.type]; sub = o.type === 'well' ? 'Travel to any level you have reached' : o.type === 'keg' ? 'Explodes. Obviously.' : ''; }
        else if (t.kind === 'item') { const gi = w.itemById(t.id); if (!gi) { el.classList.add('hidden'); return; } if (gi.item) { name = displayName(gi.item); color = (RARITY[gi.item.rarity] || RARITY.normal).color; } else name = gi.sugar ? `${gi.sugar} Sugar` : gi.potion ? 'Potion' : 'Quest item'; }
        el.classList.remove('hidden');
        const key = `${t.id}:${name}:${sub}`;
        if (this.cache.tKey !== key) { this.cache.tKey = key; $('t-name').textContent = name; $('t-name').style.color = color; $('t-sub').textContent = sub; }
        $('t-bar').classList.toggle('hidden', hp === null);
        if (hp !== null) $('t-bar').firstElementChild.style.width = `${(hp * 100).toFixed(1)}%`;
    }

    setArea(name, sub) { $('area-name').textContent = name; $('area-sub').textContent = sub || ''; }

    toast(text, kind = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + kind;
        el.textContent = text;
        $('toasts').appendChild(el);
        this.toastEls.push(el);
        while (this.toastEls.length > 4) this.toastEls.shift().remove();
        setTimeout(() => { el.remove(); this.toastEls = this.toastEls.filter((x) => x !== el); }, kind === 'quest' ? 5200 : 3200);
    }

    banner(t1, t2 = '', cls = '', dur = 3) {
        const b = $('banner');
        b.className = cls;
        b.querySelector('.b1').textContent = t1;
        b.querySelector('.b2').textContent = t2;
        b.classList.remove('hidden');
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        this.bannerT = dur;
    }
}

export { KEYS, itemIcon, MONSTERS, CLASSES };
