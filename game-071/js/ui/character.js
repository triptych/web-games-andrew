/**
 * character.js — the Magic menu (spells by school, equip to a hand; the Sigils tab with rings
 * and Storm Charge costs) and the Skills menu (three rune pillars, each skill's perk ladder,
 * level progress and trainers).
 */
import { h, Panel, ListView } from './ui.js';
import { SPELLS, SIGILS, RINGS, spellCost, TIERS } from '../sim/magic.js';
import { SKILLS, SKILL_IDS, PERKS, canTakePerk, takePerk, xpToNext, charXpToNext } from '../sim/stats.js';
import { effectText } from '../sim/effects.js';
import { trainCost } from '../sim/crafting.js';

const SCHOOLS = [['all', 'All'], ['destruction', 'Evocation'], ['restoration', 'Mending'], ['alteration', 'Shaping'], ['conjuration', 'Summoning'], ['illusion', 'Glamour'], ['sigils', 'Sigils']];

export class MagicPanel extends Panel {
    constructor(ui) {
        super(ui);
        this.school = 'all';
        this.title('Magic');
        this.tabs = h('div.tabs');
        SCHOOLS.forEach(([k, t]) => this.tabs.appendChild(h('button.tab', { text: t, 'data-k': k, on: { click: () => this.setSchool(k) } })));
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.equip(r, 'right'), onAlt: (r) => this.equip(r, 'left') });
        this.detail = h('div.detail.scroll');
        this.foot = h('div.foot');
        this.box.append(this.tabs, h('div.split', {}, this.list.el, this.detail), this.foot);
        this.setSchool('all');
    }
    setSchool(k) { this.school = k; [...this.tabs.children].forEach((t) => t.classList.toggle('on', t.dataset.k === k)); this.refresh(); }
    refresh() {
        const p = this.app.world.player;
        const rows = [];
        if (this.school === 'sigils') {
            for (const [id, sg] of Object.entries(SIGILS)) {
                const n = p.storm.rings[id] || 0;
                if (!n) continue;
                rows.push({ key: id, label: sg.name, value: `${n}/3`, mark: p.storm.equipped === id ? '◆' : '', data: { sigil: id } });
            }
            if (!rows.length) rows.push({ key: 'none', label: 'You know no sigils yet. Find a sigil stone.', cls: 'dim' });
        } else {
            for (const id of p.spells) {
                const sp = SPELLS[id]; if (!sp) continue;
                if (this.school !== 'all' && sp.school !== this.school) continue;
                const cost = spellCost(sp, p.sheet.skills[sp.school], p.sheet.perks);
                const mark = p.hands.right === id && p.hands.left === id ? '◆◆' : p.hands.right === id ? 'R' : p.hands.left === id ? 'L' : p.favorites.includes(id) ? '★' : '';
                rows.push({ key: id, label: sp.name, value: cost, mark, data: { spell: id } });
            }
            if (!rows.length) rows.push({ key: 'none', label: 'No spells', cls: 'dim' });
        }
        this.list.set(rows);
        this.foot.innerHTML = '';
        this.foot.append(h('span.stat', { html: `Mana <b>${Math.round(p.mp)}</b> / ${Math.round(p.mpMax)}` }), h('span.stat', { html: `Storm Charge <b>${Math.round(p.storm.charge)}</b> / ${p.storm.chargeMax}` }), h('span.sp'),
            h('span.hint2', { text: this.school === 'sigils' ? 'E: ready this sigil' : 'E right hand · R left hand · X both · F favourite' }));
    }
    show(r) {
        this.detail.innerHTML = '';
        if (!r?.data) return;
        const p = this.app.world.player;
        const card = h('div.card');
        if (r.data.sigil) {
            const sg = SIGILS[r.data.sigil], n = p.storm.rings[r.data.sigil] || 0;
            card.append(h('h3', { text: sg.name }), h('p', { text: sg.desc }));
            sg.rings.forEach((ring, i) => card.appendChild(h('p', { cls: i < n ? '' : 'faint', html: `<b>${RINGS[`${r.data.sigil}:${i}`].name}</b> — ring ${i + 1} · costs ${sg.cost[i]} charge${i < n ? '' : ' · <i>not yet learned</i>'}` })));
            card.appendChild(h('p.faint', { text: 'Hold the Sigil key to trace more rings; release to unleash.' }));
            card.appendChild(h('div.row', {}, h('button.mbtn.gold', { text: p.storm.equipped === r.data.sigil ? 'Readied' : 'Ready', on: { click: () => this.equip(r) } })));
        } else {
            const sp = SPELLS[r.data.spell];
            const cost = spellCost(sp, p.sheet.skills[sp.school], p.sheet.perks);
            card.append(h('h3', { text: sp.name }), h('div.stats', {}, h('div', {}, h('b', { text: String(cost) }), sp.kind === 'conc' ? 'Mana / s' : 'Mana'), h('div', {}, h('b', { text: TIERS[sp.tier]?.split(' ')[0] || '—' }), 'Circle'), h('div', {}, h('b', { text: SKILLS[sp.school].name }), 'School')));
            if (sp.desc) card.appendChild(h('p', { text: sp.desc }));
            if (sp.effects) for (const ef of sp.effects) card.appendChild(h('p', { text: effectText(ef.id, ef.mag, ef.dur) }));
            card.appendChild(h('div.row', {}, h('button.mbtn.gold', { text: 'Right hand', on: { click: () => this.equip(r, 'right') } }), h('button.mbtn', { text: 'Left hand', on: { click: () => this.equip(r, 'left') } }), h('button.mbtn', { text: 'Both', on: { click: () => this.equip(r, 'both') } })));
        }
        this.detail.appendChild(card);
    }
    equip(r, hand = 'right') {
        if (!r?.data) return;
        const p = this.app.world.player;
        if (r.data.sigil) { p.storm.equipped = r.data.sigil; this.refresh(); return; }
        const id = r.data.spell;
        const set = (hd) => {
            p.hands[hd] = id;
            const e = p.equip[hd];
            if (e) p.equip[hd] = null;
            if (hd === 'left' && p.equip.right && p.equip.right.id && this.isTwo(p.equip.right)) p.equip.right = null;
        };
        if (hand === 'both') { set('right'); set('left'); } else set(hand);
        p.dirty = true;
        this.app.audio?.ui('equipSpell');
        this.refresh();
    }
    isTwo(e) { return !!e && (e.two || false); }
    fav(r) { if (!r?.data?.spell) return; const f = this.app.world.player.favorites, id = r.data.spell; const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); this.refresh(); }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.equip(this.list.current, 'right'); return true; }
        if (a === 'alt') { this.equip(this.list.current, 'left'); return true; }
        if (a === 'alt2') { this.equip(this.list.current, 'both'); return true; }
        if (a === 'fav') { this.fav(this.list.current); return true; }
        const i = SCHOOLS.findIndex(([k]) => k === this.school);
        if (a === 'right' || a === 'nextTab') { this.setSchool(SCHOOLS[(i + 1) % SCHOOLS.length][0]); return true; }
        if (a === 'left' || a === 'prevTab') { this.setSchool(SCHOOLS[(i - 1 + SCHOOLS.length) % SCHOOLS.length][0]); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ skills: three rune pillars
const PATHS = [['warrior', 'The Shield'], ['thief', 'The Shadow'], ['mage', 'The Storm']];
export class SkillsPanel extends Panel {
    /** trainer: optional { npc, skill } — buy levels instead of perks */
    constructor(ui, trainer = null) {
        super(ui);
        this.trainer = trainer;
        const p = ui.app.world.player;
        this.head = this.title(trainer ? `Training — ${trainer.npc.name}` : 'Skills');
        this.lvl = h('div.foot');
        this.pillars = h('div.pillars');
        this.perkBox = h('div.detail.scroll', { style: { maxWidth: '420px' } });
        this.sel = trainer?.skill || SKILL_IDS[0];
        this.box.append(h('div.split', {}, h('div.scroll', { style: { flex: '1.6', display: 'flex' } }, this.pillars), this.perkBox), this.lvl);
        this.render();
        this.p = p;
    }
    render() {
        const p = this.app.world.player, sh = p.sheet;
        this.pillars.innerHTML = '';
        for (const [tree, name] of PATHS) {
            const col = h('div.pillar', {}, h('h4', { text: name }));
            for (const id of SKILL_IDS.filter((s) => SKILLS[s].tree === tree)) {
                const L = sh.skills[id];
                const frac = L >= 100 ? 1 : sh.skillXp[id] / xpToNext(L);
                const el = h('div.skill', { cls: this.sel === id ? 'sel' : '', on: { click: () => { this.sel = id; this.render(); } } },
                    h('div.row1', {}, h('span', { text: SKILLS[id].name }), h('b', { text: String(L) })),
                    h('div.meter', {}, h('i', { style: { width: `${(frac * 100).toFixed(1)}%` } })));
                if (this.trainer && this.trainer.skill !== id) el.classList.add('dim');
                col.appendChild(el);
            }
            this.pillars.appendChild(col);
        }
        // perk ladder for the selected skill
        this.perkBox.innerHTML = '';
        const s = this.sel;
        this.perkBox.appendChild(h('div.card', {}, h('h3', { text: SKILLS[s].name }), h('p.dim', { text: `Level ${sh.skills[s]}${sh.skills[s] < 100 ? ` · ${Math.round(sh.skillXp[s])} / ${Math.round(xpToNext(sh.skills[s]))} to the next` : ' (mastered)'}` })));
        if (this.trainer) {
            const cost = trainCost(sh.skills[s]);
            const left = 5 - (sh.trainedThisLevel || 0);
            this.perkBox.appendChild(h('p', { text: `Training costs ${cost} gold. ${left} sessions left this level.` }));
            this.perkBox.appendChild(h('button.mbtn.gold', { text: `Train (${cost} gold)`, disabled: p.gold < cost || left <= 0 || sh.skills[s] >= Math.min(100, (this.trainer.npc.trainMax || 75)) ? '' : null, on: { click: () => this.train() } }));
        } else {
            const ladder = h('div.perks');
            for (const pk of Object.values(PERKS).filter((x) => x.skill === s)) {
                const have = !!sh.perks[pk.id], can = canTakePerk(sh, pk.id);
                ladder.appendChild(h('div.perk', { cls: have ? 'have' : can ? 'can' : sh.skills[s] < pk.req ? 'locked' : '', on: { click: () => { if (can) { takePerk(sh, pk.id); p.dirty = true; this.app.audio?.ui('perk'); this.render(); } } } },
                    h('div.rune', {}, h('span', { text: pk.req ? String(pk.req) : '·' })), h('div.t', {}, h('b', { text: pk.name }), h('small', { text: pk.desc }))));
            }
            this.perkBox.appendChild(ladder);
        }
        const xp = sh.xp, need = charXpToNext(sh.level);
        this.lvl.innerHTML = '';
        this.lvl.append(h('span.stat', { html: `Level <b>${sh.level}</b>` }), h('div.meter', { style: { width: '160px' } }, h('i', { style: { width: `${Math.min(100, xp / need * 100)}%` } })), h('span.stat', { html: `Perk points <b class="goldt">${sh.perkPoints}</b>` }),
            h('span.stat', { html: `Health <b>${Math.round(p.hpMax)}</b> · Mana <b>${Math.round(p.mpMax)}</b> · Stamina <b>${Math.round(p.spMax)}</b>` }), h('span.sp'), h('span.hint2', { text: this.trainer ? 'E: train' : 'Click a lit rune to take that perk' }));
    }
    train() {
        const w = this.app.world, p = w.player, sh = p.sheet, s = this.sel;
        const cost = trainCost(sh.skills[s]);
        if (p.gold < cost || (sh.trainedThisLevel || 0) >= 5) return;
        p.gold -= cost;
        sh.trainedThisLevel = (sh.trainedThisLevel || 0) + 1;
        w.skillUse(p, s, 9999 / 4.5);   // one full level
        this.render();
    }
    move(dir) {
        const order = PATHS.flatMap(([t]) => SKILL_IDS.filter((s) => SKILLS[s].tree === t));
        const i = order.indexOf(this.sel);
        if (dir === 'up' || dir === 'down') this.sel = order[(i + (dir === 'down' ? 1 : -1) + order.length) % order.length];
        else { const step = dir === 'right' ? 6 : -6; this.sel = order[(i + step + order.length) % order.length]; }
        this.render();
    }
    action(a) {
        if (['up', 'down', 'left', 'right'].includes(a)) { if (!this.trainer) this.move(a); return true; }
        if (a === 'ok') {
            if (this.trainer) { this.train(); return true; }
            const sh = this.app.world.player.sheet;
            const pk = Object.values(PERKS).find((x) => x.skill === this.sel && canTakePerk(sh, x.id));
            if (pk) { takePerk(sh, pk.id); this.app.world.player.dirty = true; this.render(); }
            return true;
        }
        return false;
    }
}
