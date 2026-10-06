// Panels: backpack + paper doll, character sheet, skills, quests, shops, Kiwirt's gambling,
// the stash, townsfolk dialogue, the Wishing Well, the pause menu, settings and help.
// Every panel re-renders from the game state; actions go through app.* or game.*.

import { $, esc, itemIcon, itemTip, tooltip, statLine, dps, FRUIT_EMOJI, SLOT_NAMES } from './dom.js';
import { CLASSES, SKILLS, MAX_SKILL_RANK } from '../sim/data/classes.js';
import { QUESTS, NPCS, floorName } from '../sim/data/story.js';
import { POTIONS, EQUIP_SLOTS } from '../sim/data/items.js';
import { DIFFICULTIES, STAT_NAMES, RARITY } from '../config.js';
import { equipFromInv, unequip, spendStat, learnSkill, canLearn, usable, potionPrice, computeStats, skillRank, whyNot, itemScore } from '../sim/hero.js';
import { sellPrice, buyPrice, displayName } from '../sim/items.js';

const SIDE = { inv: 'right', char: 'left', skills: 'left', quests: 'left', shop: 'left', gamble: 'left', stash: 'left', dialog: 'center', waypoint: 'center', menu: 'center', settings: 'center', help: 'center' };
const TITLES = { inv: 'Backpack', char: 'Character', skills: 'Skills', quests: 'Quests', stash: 'Stash', waypoint: 'Wishing Well', menu: 'Paused', settings: 'Settings', help: 'How to Play' };
const PORTRAIT = { cane: '🍬', granny: '🍏', grapeswold: '🍇', olivia: '🫒', kiwirt: '🥝' };
const DOLL = [[null, 'head', 'neck'], ['weapon', 'body', 'offhand'], ['ring1', 'hands', 'ring2'], [null, 'feet', null]];

export class Panels {
    constructor(app) {
        this.app = app;
        this.root = $('panels');
        this.open_ = new Map();
        this.sel = null;          // { from: 'inv'|'equip'|'stash'|'shop', i }
        this.shopKind = null;
        this.dialog = null;
        this.bindSkill = null;
        this.root.addEventListener('click', (e) => this.onClick(e));
        this.root.addEventListener('dblclick', (e) => this.onDbl(e));
        this.root.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onDbl(e); });
        this.root.addEventListener('pointerover', (e) => this.onHover(e));
        this.root.addEventListener('pointerout', (e) => { if (e.target.closest('.cell')) tooltip.hide(); });
        this.root.addEventListener('input', (e) => this.onInput(e));
        this.root.addEventListener('change', (e) => this.onInput(e));
    }

    get game() { return this.app.game; }
    get hero() { return this.app.game.hero; }
    isOpen(k) { return this.open_.has(k); }
    any() { return this.open_.size > 0; }
    blocking() { return [...this.open_.keys()].some((k) => SIDE[k] === 'center'); }

    open(kind, opts = {}) {
        if (!this.game) return;
        const side = SIDE[kind];
        for (const k of [...this.open_.keys()]) {
            if (k === kind) continue;
            if (SIDE[k] === side || side === 'center' || SIDE[k] === 'center') this.close(k, true);
        }
        Object.assign(this, opts);
        if (!this.open_.has(kind)) {
            const el = document.createElement('div');
            el.className = `panel ${side}`;
            el.dataset.kind = kind;
            this.root.appendChild(el);
            this.open_.set(kind, el);
            this.app.audio.sfx('click');
        }
        this.render(kind);
        this.app.onPanels();
    }
    close(kind, silent = false) {
        const el = this.open_.get(kind);
        if (!el) return;
        el.remove();
        this.open_.delete(kind);
        if (kind === 'shop' || kind === 'gamble') this.shopKind = null;
        if (kind === 'skills') this.bindSkill = null;
        this.sel = null;
        tooltip.hide();
        if (!silent) this.app.onPanels();
    }
    toggle(kind) { if (this.isOpen(kind)) this.close(kind); else this.open(kind); }
    closeAll() { for (const k of [...this.open_.keys()]) this.close(k, true); this.app.onPanels(); }
    refresh() { for (const k of this.open_.keys()) this.render(k); }

    render(kind) {
        const el = this.open_.get(kind);
        if (!el) return;
        const scroll = el.querySelector('.body')?.scrollTop || 0;
        const fn = this['r_' + kind];
        const title = kind === 'shop' ? this.shopTitle() : kind === 'gamble' ? "Kiwirt's Mystery Smoothies" : kind === 'dialog' ? (this.dialog ? this.dialog.name : '') : TITLES[kind];
        const { body, foot = '' } = fn.call(this);
        el.innerHTML = `<h2>${esc(title)}</h2><button class="x" data-act="close" data-k="${kind}" aria-label="Close">✕</button><div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}`;
        const b = el.querySelector('.body'); if (b) b.scrollTop = scroll;
    }

    // ------------------------------------------------------------------ helpers
    cell(it, attrs, extra = '') {
        if (!it) return `<div class="cell" ${attrs}>${extra}</div>`;
        const hero = this.hero;
        const bad = !usable(hero, it) && it.identified ? ' bad' : '';
        const unid = !it.identified ? ' unid' : '';
        const up = it.identified && usable(hero, it) && this.isUpgrade(it) ? '<span class="up">▲</span>' : '';
        const sel = this.sel && attrs.includes(`data-i="${this.sel.i}"`) && attrs.includes(`data-from="${this.sel.from}"`) ? ' sel' : '';
        return `<div class="cell r-${it.rarity}${bad}${unid}${sel}" ${attrs}>${itemIcon(it)}${up}${extra}</div>`;
    }
    isUpgrade(it) {
        const hero = this.hero;
        const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
        return slots.some((s) => itemScore(hero, it) > (hero.equip[s] ? itemScore(hero, hero.equip[s]) : -1) * 1.04 + 0.5);
    }
    selItem() {
        if (!this.sel) return null;
        const h = this.hero, s = this.sel;
        if (s.from === 'inv') return h.inv[s.i];
        if (s.from === 'equip') return h.equip[s.i];
        if (s.from === 'stash') return h.stash[s.i];
        if (s.from === 'shop') return this.game.shop(this.shopKind)[s.i];
        return null;
    }

    // ------------------------------------------------------------------ backpack
    r_inv() {
        const h = this.hero;
        let doll = '<div class="doll">';
        for (const row of DOLL) for (const s of row) {
            if (!s) { doll += '<div></div>'; continue; }
            doll += this.cell(h.equip[s], `data-from="equip" data-i="${s}"`, h.equip[s] ? '' : `<span class="ph">${SLOT_NAMES[s]}</span>`);
        }
        doll += '</div>';
        let grid = '<div class="grid">';
        h.inv.forEach((it, i) => { grid += this.cell(it, `data-from="inv" data-i="${i}"`); });
        grid += '</div>';
        const it = this.selItem();
        let ctx = '<div class="ctx">';
        if (it && (this.sel.from === 'inv' || this.sel.from === 'equip')) {
            const shop = this.isOpen('shop'), stash = this.isOpen('stash');
            if (this.sel.from === 'inv') {
                if (shop) ctx += `<button class="btn small" data-act="sell">Sell (${sellPrice(it)})</button>`;
                if (stash) ctx += `<button class="btn small" data-act="stashput">Stash</button>`;
                ctx += `<button class="btn small${shop || stash ? ' alt' : ''}" data-act="equip" ${whyNot(h, it) ? 'disabled' : ''}>Equip</button>`;
                ctx += `<button class="btn small alt" data-act="drop">Drop</button>`;
            } else ctx += `<button class="btn small" data-act="unequip">Unequip</button>`;
            const w = whyNot(h, it);
            if (w && this.sel.from === 'inv') ctx += `<span style="font-size:12px;color:#ff9aa8;align-self:center">${esc(w)}</span>`;
        } else ctx += `<span style="font-size:12px;color:var(--dim);align-self:center">${this.app.input.isTouch ? 'Tap an item to see it' : 'Click an item for options · double-click or right-click to equip'}${this.isOpen('shop') ? ' / sell' : this.isOpen('stash') ? ' / stash' : ''}.</span>`;
        ctx += '</div>';
        const shop = this.isOpen('shop');
        const foot = `<span class="sugar">🍬 ${h.sugar} sugar</span>${shop ? '<button class="btn small alt" data-act="sellcommon">Sell all Common</button>' : `<span style="font-size:12px;color:var(--dim)">${h.inv.filter(Boolean).length} / ${h.inv.length}</span>`}`;
        return { body: doll + ctx + grid, foot };
    }

    // ------------------------------------------------------------------ character
    r_char() {
        const h = this.hero, c = CLASSES[h.cls];
        const st = this.app.world.hero.st;
        const desc = { str: 'Melee damage, armour', dex: 'Ranged damage, crits, dodge', mag: 'Spell damage, Juice', vit: 'Freshness (health)' };
        let body = `<div class="row"><div class="tt">${FRUIT_EMOJI[h.look.fruit] || ''} ${esc(h.name)}<small>Level ${h.level} ${c.name} · ${DIFFICULTIES[h.difficulty].name}</small></div>${h.statPts ? `<div class="tt" style="text-align:right"><span style="color:var(--green)">${h.statPts} points</span><small>to spend</small></div>` : ''}</div>`;
        body += '<div class="stats">';
        for (const s of ['str', 'dex', 'mag', 'vit']) {
            body += `<div class="nm">${STAT_NAMES[s]}${s === c.main ? ' ★' : ''}<small>${desc[s]}</small></div><div class="vl">${st[s]}</div><button class="plus" data-act="stat" data-s="${s}" ${h.statPts ? '' : 'disabled'}>+</button>`;
        }
        body += '</div>';
        const avg = (st.dmgMin + st.dmgMax) / 2;
        const dpsV = avg * (1 + st.mainStat / 100) * (1 + st.dmgPct / 100) * st.aps * (1 + (st.crit / 100) * (st.critDmg / 100));
        const lvl = this.app.world.lvl;
        const dr = Math.min(75, (st.armor / (st.armor + 11 * lvl + 35)) * 100);
        const rows = [
            ['Freshness', `${Math.ceil(this.app.world.hero.hp)} / ${st.maxHp}`], ['Juice', `${Math.floor(this.app.world.hero.juice)} / ${st.maxJuice}`],
            ['Weapon damage', `${st.dmgMin}–${st.dmgMax}`], ['Damage per second', dpsV.toFixed(1)], ['Attacks per second', st.aps.toFixed(2)],
            ['Critical chance', `${st.crit.toFixed(1)}%`], ['Critical damage', `+${st.critDmg}%`], ['Dodge', `${st.dodge.toFixed(1)}%`],
            ['Armour', `${st.armor} (${dr.toFixed(0)}% here)`], ['Resist Spicy / Frosty', `${st.res.fire}% / ${st.res.cold}%`], ['Resist Fizzy / Mold', `${st.res.light}% / ${st.res.pois}%`],
            ['Freshness regen', `${st.hpRegen.toFixed(1)}/s`], ['Juice regen', `${st.juiceRegen.toFixed(1)}/s`], ['Move speed', `${(st.moveSpeed / 4.3 * 100).toFixed(0)}%`],
            ['Better loot', `+${st.magicFind}%`], ['Extra sugar', `+${st.goldFind}%`],
            ['Squashed', String(h.stats.kills)], ['Times pulped', String(h.stats.deaths)], ['Time played', fmtTime(h.stats.time)],
        ];
        body += `<div class="derived">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>`;
        return { body };
    }

    // ------------------------------------------------------------------ skills
    r_skills() {
        const h = this.hero, c = CLASSES[h.cls];
        const st = this.app.world.hero.st;
        let body = `<div class="row"><div class="tt">${c.icon} ${c.name}<small>One point per level. Bind learned skills to your buttons.</small></div><div class="tt" style="color:${h.skillPts ? 'var(--green)' : 'var(--dim)'}">${h.skillPts} pts</div></div>`;
        for (const id of c.skills) {
            const sk = SKILLS[id];
            const rank = h.skills[id] || 0;
            const eff = skillRank(h, id, st);
            const locked = h.level < sk.lvl;
            const binds = ['LMB', 'RMB', '1', '2', '3', '4'].map((k, i) => `<button data-act="bind" data-sk="${id}" data-slot="${i}" class="${h.bar[i] === id ? 'on' : ''}">${k}</button>`).join('');
            body += `<div class="skill${locked ? ' locked' : ''}"><div class="ic">${sk.icon}</div><div><div class="nm">${sk.name}<small>${locked ? `unlocks at level ${sk.lvl}` : `rank ${rank}${eff > rank ? ` (+${eff - rank})` : ''} / ${MAX_SKILL_RANK}`} · ${sk.cost ? `${sk.cost} juice` : 'free'}${sk.cd ? ` · ${sk.cd}s` : ''}</small></div>
                <div class="ds">${esc(sk.desc(Math.max(1, eff), sk))}</div>${rank ? `<div class="bind">${binds}</div>` : ''}</div>
                <button class="plus" data-act="learn" data-sk="${id}" ${canLearn(h, id) ? '' : 'disabled'}>+</button></div>`;
        }
        return { body };
    }

    // ------------------------------------------------------------------ quests
    r_quests() {
        const h = this.hero;
        let body = '';
        const known = QUESTS.filter((q) => h.quests[q.id] > 0);
        if (!known.length) body += `<p style="color:var(--dim)">No quests yet. Talk to the folk of Tristrawberry — Deckard Cane always has something to say.</p>`;
        for (const q of known) {
            const s = h.quests[q.id];
            const state = s === 3 ? 'Complete' : s === 2 ? `Return to ${NPCS[q.giver].name}` : 'Active';
            body += `<div class="row ${s === 3 ? 'q-done' : 'q-active'}"><div class="tt">${s === 3 ? '✔' : s === 2 ? '❗' : '•'} ${esc(q.name)}<small>${esc(s === 3 ? q.done : s === 2 ? `Done! ${state}.` : q.hint)}</small></div></div>`;
        }
        body += `<div class="sect">Deepest level</div><p>${esc(floorName(h.maxFloor))}</p>`;
        return { body };
    }

    // ------------------------------------------------------------------ shops
    shopTitle() { return { smith: "Grapeswold's Forge", oracle: "Olivia's Curios", granny: "Granny's Pantry" }[this.shopKind] || 'Shop'; }
    r_shop() {
        const g = this.game, h = this.hero;
        let body = '';
        const pots = this.shopKind === 'smith' ? [] : this.shopKind === 'granny' ? ['hp', 'juice'] : ['hp', 'juice', 'pie'];
        if (pots.length) {
            body += '<div class="sect">Potions & pies</div>';
            for (const k of pots) {
                const P = POTIONS[k], p = potionPrice(k, h.level);
                body += `<div class="row"><div class="tt">${P.icon} ${P.name}<small>${p} sugar · you have ${h.potions[k]}</small></div><div><button class="btn small" data-act="buypot" data-k="${k}" data-n="1">Buy</button><button class="btn small alt" data-act="buypot" data-k="${k}" data-n="99">Fill</button></div></div>`;
            }
        }
        const stock = g.shop(this.shopKind);
        if (stock.length) {
            body += '<div class="sect">For sale</div><div class="grid shop">';
            stock.forEach((it, i) => { body += this.cell(it, `data-from="shop" data-i="${i}"`, `<small class="price">${buyPrice(it)}</small>`); });
            body += '</div>';
            const it = this.sel && this.sel.from === 'shop' ? this.selItem() : null;
            body += `<div class="ctx">${it ? `<button class="btn small" data-act="buy" ${h.sugar >= buyPrice(it) ? '' : 'disabled'}>Buy ${esc(displayName(it))} for ${buyPrice(it)}</button>` : '<span style="font-size:12px;color:var(--dim)">Pick something shiny. Sell from your backpack on the right.</span>'}</div>`;
        }
        return { body, foot: `<span class="sugar">🍬 ${h.sugar} sugar</span>` };
    }
    r_gamble() {
        const g = this.game, h = this.hero;
        const kinds = [['weapon', 'Weapon', '⚔️'], ['offhand', 'Offhand', '🛡️'], ['head', 'Helm', '⛑️'], ['body', 'Armour', '👕'], ['hands', 'Gloves', '🧤'], ['feet', 'Boots', '👢'], ['neck', 'Amulet', '📿'], ['ring', 'Ring', '💍']];
        let body = `<p style="color:var(--dim);font-size:13px;margin-bottom:8px">“Mystery smoothies! Could be anything! Probably a sock.” — Every one is a random item for your level. Some are Golden.</p>`;
        for (const [k, n, ic] of kinds) {
            const p = g.gamblePrice(k);
            body += `<div class="row"><div class="tt">${ic} Mystery ${n}<small>${p} sugar</small></div><button class="btn small" data-act="gamble" data-k="${k}" ${h.sugar >= p ? '' : 'disabled'}>Buy</button></div>`;
        }
        if (this.lastGamble) { const t = itemTip(this.lastGamble, { hero: h }); body += `<div class="sect">You got…</div><div class="row" style="display:block">${t.html}</div>`; }
        return { body, foot: `<span class="sugar">🍬 ${h.sugar} sugar</span>` };
    }
    r_stash() {
        const h = this.hero;
        let body = `<p style="color:var(--dim);font-size:13px;margin-bottom:8px">Shared between trips, safe from rot. Click an item to take it.</p><div class="grid">`;
        h.stash.forEach((it, i) => { body += this.cell(it, `data-from="stash" data-i="${i}"`); });
        body += '</div>';
        return { body, foot: `<span style="font-size:12px;color:var(--dim)">${h.stash.filter(Boolean).length} / ${h.stash.length}</span>` };
    }

    // ------------------------------------------------------------------ dialogue
    r_dialog() {
        const d = this.dialog;
        if (!d) return { body: '' };
        const svc = { shop: 'Trade', heal: 'Heal me', identify: 'Identify items', gamble: 'Mystery smoothies', talk: 'Tell me a story', difficulty: `Next difficulty: ${DIFFICULTIES[Math.min(2, this.hero.difficulty + 1)].name}` };
        let buttons = d.services.filter((s) => svc[s]).map((s) => `<button class="btn${s === 'difficulty' ? '' : ' alt'}" data-act="svc" data-s="${s}">${svc[s]}</button>`).join('');
        buttons += `<button class="btn alt" data-act="close" data-k="dialog">Goodbye</button>`;
        const reward = d.reward && d.reward.length ? `<div class="reward">Reward: ${d.reward.map(esc).join(' · ')}</div>` : '';
        const quest = d.quest ? `<div class="sect">${d.quest.state === 3 ? 'Quest complete' : 'New quest'}: ${esc(d.quest.name)}</div>` : '';
        const body = `<div class="dialog"><div class="portrait">${PORTRAIT[d.npc] || '🍎'}</div><div class="speech"><span class="who">${esc(d.name)}<small>${esc(d.title)}</small></span><span class="said">${esc(d.text)}</span></div></div>${quest}${reward}<div class="services">${buttons}</div>`;
        return { body };
    }

    // ------------------------------------------------------------------ waypoints, menu, settings, help
    r_waypoint() {
        const h = this.hero, cur = this.app.world.floor;
        let body = '<p style="color:var(--dim);font-size:13px;margin-bottom:8px">Toss a sugar cube in and think of where you want to be.</p>';
        for (const f of h.waypoints) body += `<div class="row${f === cur ? ' on' : ''}"><div class="tt">${esc(floorName(f))}<small>${f === 0 ? 'Home' : `Monster level ${this.levelOf(f)}`}</small></div>${f === cur ? '<span style="color:var(--dim)">You are here</span>' : `<button class="btn small" data-act="travel" data-f="${f}">Go</button>`}</div>`;
        return { body };
    }
    levelOf(f) { return 1 + Math.round((f - 1) * 1.75) + DIFFICULTIES[this.hero.difficulty].lvl; }
    r_menu() {
        const body = `<div style="display:flex;flex-direction:column;gap:10px;align-items:center;padding:10px">
            <button class="btn" data-act="close" data-k="menu" style="min-width:220px">Resume</button>
            <button class="btn alt" data-act="open" data-k="settings" style="min-width:220px">Settings</button>
            <button class="btn alt" data-act="open" data-k="help" style="min-width:220px">How to play</button>
            <button class="btn alt" data-act="quit" style="min-width:220px">Save & quit to title</button></div>`;
        return { body };
    }
    r_settings() {
        const s = this.app.settings;
        const body = `
            <div class="row"><div class="tt">Music</div><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></div>
            <div class="row"><div class="tt">Sound effects</div><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx"></div>
            <div class="row"><div class="tt">Mute everything<small>M</small></div><input type="checkbox" ${s.muted ? 'checked' : ''} data-set="muted"></div>
            <div class="row"><div class="tt">Graphics<small>Auto lowers quality if the frame rate drops</small></div><select data-set="quality">${['auto', '0', '1', '2', '3'].map((q) => `<option value="${q}" ${String(s.quality) === q ? 'selected' : ''}>${{ auto: 'Auto', 0: 'High', 1: 'Medium', 2: 'Low', 3: 'Potato' }[q]}</option>`).join('')}</select></div>
            <div class="row"><div class="tt">Loot labels<small>Hold Alt to show them when set to "Alt"</small></div><select data-set="labels"><option value="always" ${s.labels === 'always' ? 'selected' : ''}>Always</option><option value="alt" ${s.labels === 'alt' ? 'selected' : ''}>Alt only</option></select></div>
            <div class="row"><div class="tt">Screen shake</div><input type="checkbox" ${s.shake ? 'checked' : ''} data-set="shake"></div>
            <div class="row"><div class="tt">Damage numbers</div><input type="checkbox" ${s.numbers ? 'checked' : ''} data-set="numbers"></div>`;
        return { body, foot: '<span></span><button class="btn small" data-act="open" data-k="menu">Back</button>' };
    }
    r_help() {
        const t = this.app.input.isTouch;
        const body = t ? `<p><b>Move</b> by dragging on the left (a stick appears). <b>Tap</b> a monster to attack it, an item to pick it up, a townsfolk to talk. Walking over an item picks it up too.</p>
            <p><b>⚔️</b> attacks the nearest enemy; with none near it picks up loot or opens a chest. The round buttons are your skills — they aim at the nearest enemy too.</p>
            <p>Tap the 🍓 🍊 🥧 buttons to drink a Strawberry Jam (Freshness), an Orange Juice (Juice) or bake a Portal Pie home.</p>
            <p>🧑‍🌾 character · 🎒 backpack · ✨ skills · 📜 quests · 🗺️ map.</p>` :
            `<p><b>Left click</b> to walk; click a monster to keep whacking it until it pops; hold to keep walking toward the cursor. <b>Shift + click</b> attacks in place.</p>
            <p><b>Right click</b> uses your RMB skill; <b>1–4</b> use the others. They aim at the cursor.</p>
            <p><b>WASD</b> also walks. <b>Q</b> Strawberry Jam · <b>E</b> Orange Juice · <b>R</b> Portal Pie home.</p>
            <p><b>C</b> character · <b>I</b> backpack · <b>K</b> skills · <b>J</b> quests · <b>Tab</b> map · <b>Alt</b> loot labels · <b>Space</b> close panels · <b>Esc</b> menu · <b>M</b> mute · mouse wheel to zoom.</p>`;
        return { body: body + `<p style="margin-top:10px">Break crates, jars and barrels for loot. Soda kegs explode. Smoothie Shrines give a boost. Rare and Golden items drop unidentified — Deckard Cane identifies them for free. The Wishing Well takes you to any level you've reached.</p><p>Freshness is your health: if it runs out you wake up in town a little lighter on sugar. That's it. Nobody's judging.</p>`, foot: '<span></span><button class="btn small" data-act="open" data-k="menu">Back</button>' };
    }

    // ------------------------------------------------------------------ events
    onHover(e) {
        const c = e.target.closest('.cell');
        if (!c || !c.dataset.from) return;
        const it = this.itemAt(c.dataset.from, c.dataset.i);
        if (!it) return;
        const price = c.dataset.from === 'shop' ? 'buy' : c.dataset.from === 'inv' && this.isOpen('shop') ? 'sell' : null;
        const t = itemTip(it, { hero: this.hero, price, equipped: c.dataset.from === 'equip' });
        const r = c.getBoundingClientRect();
        tooltip.show(t.html, r.right, r.top, t.cls);
    }
    itemAt(from, i) {
        const h = this.hero;
        if (from === 'inv') return h.inv[+i];
        if (from === 'equip') return h.equip[i];
        if (from === 'stash') return h.stash[+i];
        if (from === 'shop') return this.game.shop(this.shopKind)[+i];
        return null;
    }
    onDbl(e) {
        const c = e.target.closest('.cell');
        if (!c || !c.dataset.from) return;
        const from = c.dataset.from, i = c.dataset.i;
        this.sel = { from, i: from === 'equip' ? i : +i };
        if (from === 'inv') {
            if (this.isOpen('shop')) this.act('sell');
            else if (this.isOpen('stash')) this.act('stashput');
            else this.act('equip');
        } else if (from === 'equip') this.act('unequip');
        else if (from === 'stash') this.act('stashtake');
        else if (from === 'shop') this.act('buy');
    }
    onClick(e) {
        const c = e.target.closest('.cell');
        if (c && c.dataset.from) {
            const from = c.dataset.from, i = from === 'equip' ? c.dataset.i : +c.dataset.i;
            if (!this.itemAt(from, i)) { this.sel = null; this.refresh(); return; }
            if (from === 'stash') { this.sel = { from, i }; this.act('stashtake'); return; }
            this.sel = { from, i };
            if (this.app.input.isTouch) { const it = this.itemAt(from, i); const t = itemTip(it, { hero: this.hero, price: from === 'shop' ? 'buy' : this.isOpen('shop') && from === 'inv' ? 'sell' : null, equipped: from === 'equip' }); const r = c.getBoundingClientRect(); tooltip.show(t.html, Math.min(r.left, innerWidth - 290), Math.max(8, r.top - 240), t.cls); }
            this.softSelect();
            return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) { if (this.app.input.isTouch) tooltip.hide(); return; }
        this.act(b.dataset.act, b.dataset);
    }
    /** Move the selection highlight and rebuild only the context row (keeps double-click working). */
    softSelect() {
        for (const [k, el] of this.open_) {
            el.querySelectorAll('.cell.sel').forEach((c) => c.classList.remove('sel'));
            if (this.sel) el.querySelectorAll(`.cell[data-from="${this.sel.from}"][data-i="${this.sel.i}"]`).forEach((c) => c.classList.add('sel'));
            const ctx = el.querySelector('.ctx');
            if (!ctx || (k !== 'inv' && k !== 'shop')) continue;
            const tmp = document.createElement('div');
            tmp.innerHTML = this['r_' + k]().body;
            const fresh = tmp.querySelector('.ctx');
            if (fresh) ctx.innerHTML = fresh.innerHTML;
        }
    }

    onInput(e) {
        const el = e.target.closest('[data-set]');
        if (!el) return;
        const k = el.dataset.set;
        const s = this.app.settings;
        if (el.type === 'checkbox') s[k] = el.checked;
        else if (el.type === 'range') s[k] = parseFloat(el.value);
        else s[k] = el.value;
        this.app.applySettings();
    }

    act(a, d = {}) {
        const g = this.game, h = this.hero, app = this.app, w = app.world;
        const it = this.selItem();
        const done = (sound = 'click') => { app.audio.sfx(sound); this.sel = null; tooltip.hide(); app.heroChanged(); this.refresh(); };
        switch (a) {
            case 'close': this.close(d.k); break;
            case 'open': this.open(d.k); break;
            case 'equip': { if (!it) return; const err = equipFromInv(h, this.sel.i); if (err) { app.toast(err, 'warn'); app.audio.sfx('nope'); return; } done('pickup'); break; }
            case 'unequip': { if (!unequip(h, this.sel.i)) { app.toast('Your backpack is full!', 'warn'); return; } done('pickup'); break; }
            case 'drop': { if (!it) return; h.inv[this.sel.i] = null; w.dropItem(it); done('drop'); break; }
            case 'sell': { if (!it) return; const p = g.sell(this.sel.i); app.toast(`Sold for ${p} sugar.`); done('coins'); break; }
            case 'sellcommon': { let n = 0, s = 0; h.inv.forEach((x, i) => { if (x && x.rarity === 'normal') { s += g.sell(i); n++; } }); if (n) app.toast(`Sold ${n} common items for ${s} sugar.`); done('coins'); break; }
            case 'buy': { if (!it) return; const err = g.buy(this.shopKind, this.sel.i); if (err) { app.toast(err, 'warn'); app.audio.sfx('nope'); return; } app.toast(`Bought ${displayName(it)}.`); done('coins'); break; }
            case 'buypot': { const n = g.buyPotion(d.k, +d.n); if (!n) { app.toast(h.potions[d.k] >= (d.k === 'pie' ? 9 : 12) ? 'Your belt is full.' : 'Not enough sugar.', 'warn'); app.audio.sfx('nope'); return; } done('coins'); break; }
            case 'gamble': { const r = g.gamble(d.k); if (r.err) { app.toast(r.err, 'warn'); app.audio.sfx('nope'); return; } this.lastGamble = r.item; app.audio.sfx(r.item.rarity === 'legendary' ? 'legendary' : r.item.rarity === 'rare' ? 'raredrop' : 'coins'); app.audio.speak('Pleasure doing business', 1.3); done('click'); break; }
            case 'stashput': { if (!it) return; if (!g.stashPut(this.sel.i)) { app.toast('The stash is full.', 'warn'); return; } done(); break; }
            case 'stashtake': { if (!g.stashTake(this.sel.i)) { app.toast('Your backpack is full!', 'warn'); return; } done(); break; }
            case 'stat': { spendStat(h, d.s, 1); w.refreshStats(); done(); break; }
            case 'learn': { if (learnSkill(h, d.sk)) { w.refreshStats(); app.audio.sfx('buff'); } this.sel = null; app.heroChanged(); this.refresh(); break; }
            case 'bind': { const slot = +d.slot; const prev = h.bar.indexOf(d.sk); if (prev >= 0 && prev !== slot) h.bar[prev] = h.bar[slot]; h.bar[slot] = d.sk; if (slot === 0 && !h.bar[0]) h.bar[0] = CLASSES[h.cls].skills[0]; app.audio.sfx('click'); this.refresh(); break; }
            case 'travel': { this.closeAll(); app.travel(+d.f); break; }
            case 'svc': this.service(d.s); break;
            case 'quit': app.quitToTitle(); break;
        }
    }

    service(s) {
        const app = this.app, g = this.game, d = this.dialog;
        switch (s) {
            case 'shop': this.open('shop', { shopKind: d.npc === 'grapeswold' ? 'smith' : d.npc === 'olivia' ? 'oracle' : 'granny' }); this.open('inv'); break;
            case 'gamble': this.open('gamble', { shopKind: 'gamble' }); this.open('inv'); break;
            case 'heal': g.heal(); app.toast('Granny patches you up with a hug and a biscuit.'); this.close('dialog'); break;
            case 'identify': { const n = g.identify(); d.text = n ? `Ah yes… yes… I see. ${n} item${n > 1 ? 's' : ''}, identified. Stay a while and glisten!` : 'You have nothing I need to look at. Stay a while anyway?'; if (n) { app.audio.sfx('shrine'); app.heroChanged(); } app.audio.speak(d.text, 0.8); this.render('dialog'); break; }
            case 'talk': { d.text = LORE[d.npc][(this.loreI = (this.loreI || 0) + 1) % LORE[d.npc].length]; app.audio.speak(d.text, VOICE[d.npc]); this.render('dialog'); break; }
            case 'difficulty': if (g.nextDifficulty()) { this.closeAll(); app.toast(`Welcome to ${DIFFICULTIES[g.hero.difficulty].name} difficulty. Everything is riper. And angrier.`, 'quest'); app.worldChanged(); } break;
        }
    }

    showDialog(d) {
        this.dialog = d;
        this.open('dialog');
        this.app.audio.speak(d.text, VOICE[d.npc] || 1);
    }
}

export const VOICE = { cane: 0.75, granny: 1.25, grapeswold: 0.6, olivia: 1.1, kiwirt: 1.5 };
const LORE = {
    cane: ['Long ago, Tristrawberry was just a strawberry. Then it grew a town. Nobody asks how.', 'The Rotten Core lies at the heart of the Great Orchard. When it stinks, everything goes off.', 'Durian the Diabolical was banished once, by a very brave melon with a very large spoon.', 'Stay a while and glisten. That is the whole story, really.'],
    granny: ['Eat your greens. Unless they are trying to eat you.', 'My Grapeswold is a good boy. Bit of a bunch, but good.', 'If you see a Pie Mimic, don\'t lick it. Learned that one the hard way.'],
    grapeswold: ['A rolling pin is just a sword that went to baking school.', 'I hammer, I clang, I occasionally squish. It\'s a living.', 'The Juicer used to work here. We don\'t talk about the Juicer.'],
    olivia: ['The olives speak of a hero. Or a sandwich. They\'re vague.', 'Zest is the essence of all magic. And lemons. Mostly lemons.', 'Beware the fruit punch rivers. They are not a beverage.'],
    kiwirt: ['My leg? Toothpick. Long story. Involves a seagull.', 'Mystery smoothies are 100% mystery, 0% refunds.', 'I once found a Golden pair of boots in a smoothie. Wore them out. Literally.'],
};

function fmtTime(s) { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
export { PORTRAIT, fmtTime, EQUIP_SLOTS, RARITY, statLine, dps, computeStats };
