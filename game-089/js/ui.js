// The DOM layer: screens, the board HUD, decision cards, the town, the party and bag, and the
// battle menus. It reads the game and the view; every change to the game goes through act().

import { VERSION, LENGTHS, DEED, PARTY_MAX, VALOR_MAX, xpToNext } from './config.js';
import {
    CLASSES, COMPANIONS, SKILLS, BURSTS, ITEMS, GEAR, MATERIALS, SHARDS, RECIPES, TOWNS, DUNGEONS, FATE, STATUS,
    ELEMENT_ICON, RIVALS, MONSTERS,
} from './sim/data.js';
import { SPACES, SPACE_INFO, DEEDS, regionDeeds } from './sim/board.js';
import { stats, skillsOf, canEquip, gearScore, memberName, ownsSet } from './sim/party.js';
import {
    shopStock, itemPrice, gearPrice, sellPrice, innCost, hireCost, canCraft, forgeDiscount, deedToll, deedIncome,
    upgradeCost, deedValue, salaryFor, standings, dungeonLevel, dungeonOpen, score, rank, dragonLevel,
} from './sim/game.js';
import { whyNot, burstOf, turnOrder } from './sim/battle.js';
import { portrait, monsterPortrait } from './view/portraits.js';
import { COLORS } from './view/boardview.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h = (tag, attrs = {}, html = '') => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (v === true) el.setAttribute(k, '');
        else if (v != null && v !== false) el.setAttribute(k, v);
    }
    if (html) el.innerHTML = html;
    return el;
};
const RIVAL_NAME = Object.fromEntries(RIVALS.map((r) => [r.id, r.short]));
const who = (id) => (id === 'you' ? 'You' : RIVAL_NAME[id] ?? id);
const gearDesc = (g) => {
    const b = g.bonus || {};
    const parts = [];
    for (const k of ['atk', 'mag', 'def', 'res', 'hp', 'spd']) if (b[k]) parts.push(`${b[k] > 0 ? '+' : ''}${b[k]} ${k.toUpperCase()}`);
    if (g.element) parts.push(ELEMENT_ICON[g.element]);
    if (g.desc) parts.push(g.desc);
    return parts.join(' · ');
};
const slotIcon = { weapon: '⚔️', armor: '🛡️', charm: '💍' };
const gearIcon = (g) => (g.slot === 'weapon' ? { blade: '🗡️', bow: '🏹', hammer: '🔨', staff: '🪄', any: '✨' }[g.kind] : g.slot === 'armor' ? '🛡️' : '💍');
const regionName = (id) => ({ meadow: 'Meadowvale', woods: 'Whisperwood', coast: 'Glimmer Coast', frost: 'Frostfang Peaks' }[id] ?? '');

export class UI {
    constructor(o) {
        Object.assign(this, o);       // audio, settings, onSettings, onDeleteSave, act, view
        this.stack = [];
        this.presentKey = '';
        this.cmdState = null;         // battle menu state
        this.townTab = 'shop';
        this.newCls = 'knight';
        this.newLen = 'standard';
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen, .panel'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen, .panel')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { this.audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), bs = $('set-bspeed'), q = $('set-quality'), calm = $('set-calm');
        sfx.value = o.settings.sfx; music.value = o.settings.music; bs.value = String(o.settings.bspeed); q.value = String(o.settings.quality); calm.checked = !!o.settings.calm;
        const changed = () => {
            Object.assign(o.settings, { sfx: +sfx.value, music: +music.value, bspeed: +bs.value, quality: +q.value, calm: calm.checked });
            o.onSettings(o.settings);
        };
        for (const el of [sfx, music, bs, q, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { o.onDeleteSave(); this.toast('Saved game deleted.'); });
        this.buildNewGame();
    }

    // ================================================================== screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        // a screen opened from another goes on top of it
        el.style.zIndex = String(50 + this.stack.length);
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        if (id === 'partyscreen' || id === 'bagscreen') this.presentKey = '';
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) {
        const root = id ? $(id) : null;
        if (!root) return [];
        return [...root.querySelectorAll('button, select, input')].filter((b) => !b.disabled && !b.hidden && b.getClientRects().length);
    }
    focusFirst(id) { const b = this.buttons(id).find((x) => x.classList.contains('primary')) || this.buttons(id)[0]; b?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through whatever is in front: a screen, the decision card or the battle menu. */
    moveFocus(dir) {
        const id = this.top() || (!$('panel').hidden ? 'panel' : !$('cmd').hidden ? 'cmd' : null);
        const list = this.buttons(id);
        if (!list.length) return false;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
        return true;
    }

    toast(text) {
        const el = h('div', { class: 'toast' });
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
    }
    banner(text, sub = '') {
        const b = $('banner');
        b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
        b.classList.remove('show');
        void b.offsetWidth;
        b.classList.add('show');
    }

    // ================================================================== new game
    buildNewGame() {
        const box = $('class-pick');
        box.innerHTML = '';
        for (const [id, C] of Object.entries(CLASSES)) {
            const b = h('button', { class: 'cls', 'data-cls': id, 'aria-pressed': String(id === this.newCls) }, `<div class="por"></div><b>${C.name}</b><small>${C.role}</small>`);
            b.addEventListener('click', () => { this.newCls = id; this.audio.ui('click'); for (const x of box.children) x.setAttribute('aria-pressed', String(x.dataset.cls === id)); });
            box.appendChild(b);
        }
        const seg = $('len-pick');
        seg.innerHTML = '';
        for (const [id, L] of Object.entries(LENGTHS)) {
            const b = h('button', { 'data-len': id, 'aria-pressed': String(id === this.newLen), title: L.note }, L.label);
            b.addEventListener('click', () => { this.newLen = id; this.audio.ui('click'); for (const x of seg.children) x.setAttribute('aria-pressed', String(x.dataset.len === id)); });
            seg.appendChild(b);
        }
    }
    paintClassPortraits() {
        for (const b of $('class-pick').children) b.querySelector('.por').style.backgroundImage = `url(${portrait('hero', b.dataset.cls)})`;
    }

    // ================================================================== HUD
    showHud(mode) {
        $('hud').hidden = mode !== 'board';
        $('bhud').hidden = mode !== 'battle';
        this.hudMode = mode;
    }

    refresh(G) {
        if (!G) return;
        $('lap-n').textContent = Math.min(G.lap, G.laps);
        $('lap-of').textContent = G.laps;
        const meter = $('wyrm-meter');
        let html = '';
        for (let i = 1; i <= G.laps; i++) html += `<i class="${i < G.lap ? 'on' : ''} ${i === G.lap - 1 && G.lap > G.laps - 1 ? 'hot' : ''}"></i>`;
        meter.innerHTML = html;
        this.setGold(G.gold);
        // standings
        const st = standings(G);
        $('standings').innerHTML = st.map((s) => `<div class="stand ${s.id === 'you' ? 'me' : ''}"><span class="dot" style="background:${COLORS[s.id]}"></span>${who(s.id)} <b>${s.worth}</b></div>`).join('');
        // party
        const strip = $('party-strip');
        strip.innerHTML = '';
        G.party.forEach((m) => {
            const s = stats(G, m);
            const pid = m.id === 'hero' ? 'hero' : m.id;
            const c = h('div', { class: 'pcard', title: 'Party' }, `<div class="por" style="background-image:url(${portrait(pid, G.cls)})"></div>
                <div class="nm">${esc(memberName(G, m))}<small>Lv ${G.level}</small></div>
                <div class="bar ${m.hp <= 0 ? 'ko' : m.hp < s.maxhp * 0.3 ? 'low' : ''}"><i style="width:${(m.hp / s.maxhp) * 100}%"></i></div>
                <div class="bar mp"><i style="width:${(m.mp / s.maxmp) * 100}%"></i></div>`);
            c.addEventListener('click', () => this.openParty(G));
            strip.appendChild(c);
        });
        // dice items
        const di = $('dice-items');
        di.innerHTML = '';
        if (G.phase === 'roll' && !this.view.busy) {
            if (G.bag.items.die) di.appendChild(h('button', { class: 'tbtn2', on: { click: () => this.pickDie(G) } }, `🎲 Loaded ×${G.bag.items.die}`));
            if (G.bag.items.boots) di.appendChild(h('button', { class: 'tbtn2', on: { click: () => this.act({ type: 'roll', item: 'boots' }) } }, `👢 Boots ×${G.bag.items.boots}`));
            if (G.bag.items.warp) di.appendChild(h('button', { class: 'tbtn2', on: { click: () => this.pickWarp(G) } }, `📜 Warp ×${G.bag.items.warp}`));
        }
        $('btn-roll').disabled = G.phase !== 'roll' || this.view.busy;
        const badge = document.querySelector('#btn-party .badge');
        const better = this.upgradesWaiting(G);
        badge.hidden = !better; badge.textContent = better ? '!' : '';
    }

    setGold(n) {
        const el = $('gold-n');
        if (el.textContent !== String(n)) {
            el.textContent = n;
            const p = $('hud-gold');
            p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump');
        }
    }

    /** Is there gear in the bag that someone would like better? */
    upgradesWaiting(G) {
        for (const m of [...G.party]) for (const id of Object.keys(G.bag.gear)) {
            if (canEquip(G, m, id) && gearScore(G, m, id) > gearScore(G, m, m.gear[GEAR[id].slot]) + 0.5) return true;
        }
        return false;
    }

    // ================================================================== events
    onEvent(e, G) {
        switch (e.type) {
            case 'lap': if (e.lap <= e.of) this.banner(`Lap ${e.lap}`, e.lap === e.of ? 'The last lap! Pyrrhax stirs…' : `of ${e.of}`); break;
            case 'gold': if (e.why === 'salary') this.toast(`Hearthstone pays you ${e.amt} gold.`); if (e.why === 'income') this.toast(`Your deeds earn ${e.amt} gold.`); break;
            case 'toll': if (e.from === 'you') this.toast(`You pay ${who(e.to)} a ${e.amt}g toll.`); else if (e.to === 'you') this.toast(`${who(e.from)} pays you a ${e.amt}g toll!`); break;
            case 'buy': if (e.who !== 'you') this.toast(`${who(e.who)} buys ${DEEDS.find((d) => d.deed === e.deed).name}.`); else if (e.set) this.banner('Region complete!', `${regionName(DEEDS.find((d) => d.deed === e.deed).region)} is yours: tolls doubled`); break;
            case 'upgrade': if (e.who !== 'you') this.toast(`${who(e.who)} upgrades ${DEEDS.find((d) => d.deed === e.deed).name}.`); break;
            case 'roamerFight': this.banner('Ambushed!', `A wandering ${MONSTERS[e.id].name} blocks the road`); break;
            case 'roamerGone': if (e.by) this.toast(`${who(e.by)} drives off a wandering monster.`); break;
            case 'dragonWakes': this.banner(e.early ? 'To Mount Ember!' : 'Pyrrhax awakens!', e.tries ? 'The second climb. Last chance.' : 'Face the Ember Wyrm'); break;
            case 'b_start': if (e.kind === 'boss') this.banner('Boss Battle!'); else if (e.kind === 'dragon') this.banner('PYRRHAX', 'the Ember Wyrm'); break;
            case 'b_phase': this.banner('Pyrrhax takes flight!'); break;
            case 'shard': this.banner('Dragonbane Shard!', `${e.count} of 4 · the dragon's scales weaken`); break;
            case 'levelup': this.banner(`Level ${e.level}!`, e.learned.length ? 'New skills learned' : ''); break;
            case 'hire': this.toast(`${COMPANIONS[e.id].short} joins ${e.benched ? 'your reserve' : 'the party'}!`); break;
            case 'craft': this.toast(`Forged: ${GEAR[e.gear].name}!`); break;
            case 'inn': this.toast('A good night\'s rest. Everyone is fully healed.'); break;
            case 'blessing': this.toast(`Blessed: ${STATUS[e.buff].icon} ${STATUS[e.buff].name} for your next battle.`); break;
            case 'fountain': if (e.amt) this.toast(`The Fountain of Fortune gives you ${e.amt} gold!`); break;
            case 'say': this.toast(e.text); break;
            case 'retreat': this.toast('You retreat from the dungeon.'); break;
            case 'rivalLap': break;
        }
    }

    // ================================================================== presenting a decision
    hideDecision() {
        $('panel').hidden = true;
        $('cmd').hidden = true;
        $('target-hint').hidden = true;
        $('markers').innerHTML = '';
        this.presentKey = '';
    }

    present(G) {
        const key = G.phase + '|' + JSON.stringify(G.ctx) + '|' + (G.battle?.turn ?? '') + '|' + G.turn + '|' + (this.cmdState ? JSON.stringify(this.cmdState) : '');
        if (key === this.presentKey) return;
        this.presentKey = key;
        const P = $('panel');
        P.hidden = true;
        $('cmd').hidden = true;
        $('target-hint').hidden = true;
        $('markers').innerHTML = '';
        if (G.phase !== 'town' && !$('town').hidden) this.closeScreen('town');
        const card = (html, acts) => {
            P.innerHTML = '';
            const c = h('div', { class: 'card' }, html);
            if (acts?.length) {
                const row = h('div', { class: 'acts' });
                for (const [label, fn, cls = 'btn', dis = false] of acts) row.appendChild(h('button', { class: cls, disabled: dis, on: { click: () => { this.audio.ui('click'); fn(); } } }, label));
                c.appendChild(row);
            }
            P.appendChild(c);
            P.hidden = false;
            if (!this.anyScreen()) this.focusFirst('panel');
            return c;
        };
        const S = SPACES[G.pos];
        switch (G.phase) {
            case 'roll': this.refresh(G); return;
            case 'passTown': {
                if (G.ctx.dungeon) {
                    const D = DUNGEONS[G.ctx.dungeon];
                    card(`<h3><span class="big">🏰</span>${D.name}</h3><p class="sub">${esc(D.blurb)}</p>
                        <dl class="stats"><dt>Monsters</dt><dd>about level ${dungeonLevel(G, G.ctx.dungeon)}</dd><dt>Boss</dt><dd>${MONSTERS[D.boss].name}</dd><dt>Prize</dt><dd>${G.cleared[G.ctx.dungeon] ? 'a treasure hoard' : `${MATERIALS[D.shard].icon} ${MATERIALS[D.shard].name}`}</dd></dl>
                        <p>You are passing the entrance. Stop here?</p>`,
                    [[`Keep going (${G.ctx.left})`, () => this.act({ type: 'go' })], ['Stop here', () => this.act({ type: 'stop' }), 'btn primary']]);
                } else {
                    const T = TOWNS[G.ctx.town];
                    card(`<h3><span class="big">🏘️</span>${T.name}</h3><p class="sub">${esc(T.blurb)}</p><p>Shop, rest, hire and forge. Stop here, or keep walking?</p>`,
                        [[`Keep going (${G.ctx.left})`, () => this.act({ type: 'go' })], ['Stop in town', () => this.act({ type: 'stop' }), 'btn primary']]);
                }
                return;
            }
            case 'dragonOffer':
                card(`<h3><span class="big">🌋</span>Mount Ember rumbles</h3><p>Pyrrhax is stirring. You may climb the mountain now and fight him early, for more fame, or keep adventuring for ${G.laps - (G.lap - 1)} more lap${G.laps - (G.lap - 1) === 1 ? '' : 's'}.</p>
                    <dl class="stats"><dt>Your level</dt><dd>${G.level}</dd><dt>Pyrrhax</dt><dd>level ${dragonLevel(G)}</dd><dt>Shards</dt><dd>${G.shards.length} of 4</dd></dl>`,
                [['Not yet', () => this.act({ type: 'wait' })], ['Climb now!', () => this.act({ type: 'climb' }), 'btn danger']]);
                return;
            case 'buy': {
                const D = DEEDS.find((d) => d.deed === G.ctx.deed);
                const set = regionDeeds(D.region).filter((x) => x.deed !== D.deed)[0];
                const setOwner = G.deeds[set.deed].owner;
                card(`<h3><span class="big">${D.emoji}</span>${D.name}</h3><p class="sub">A deed in ${regionName(D.region)}</p>
                    <dl class="stats"><dt>Price</dt><dd>${D.price}g</dd><dt>Toll</dt><dd>${Math.round(D.price * DEED.toll[0])}g (×2 with ${set.name})</dd><dt>Income</dt><dd>${Math.round(D.price * DEED.income[0])}g a lap</dd>
                    <dt>${set.name}</dt><dd>${setOwner ? `<span class="owner-dot" style="background:${COLORS[setOwner]}"></span>${who(setOwner)}` : 'for sale'}</dd></dl>`,
                [['Pass', () => this.act({ type: 'pass' })], [`Buy for ${D.price}g`, () => this.act({ type: 'buy' }), 'btn primary', G.gold < D.price]]);
                return;
            }
            case 'upgrade': {
                const D = DEEDS.find((d) => d.deed === G.ctx.deed);
                const d = G.deeds[D.deed];
                const cost = upgradeCost(G, D.deed);
                card(`<h3><span class="big">${D.emoji}</span>${D.name}</h3><p class="sub">Your deed · level ${d.level}</p>
                    <dl class="stats"><dt>Toll now</dt><dd>${deedToll(G, D.deed)}g</dd><dt>After</dt><dd>${Math.round(D.price * DEED.toll[d.level + 1] * (ownsSet(G, D.region) ? 2 : 1))}g</dd><dt>Income</dt><dd>${deedIncome(G, D.deed)}g → ${Math.round(D.price * DEED.income[d.level + 1])}g a lap</dd></dl>`,
                [['Not now', () => this.act({ type: 'pass' })], [`Upgrade for ${cost}g`, () => this.act({ type: 'upgrade' }), 'btn primary', G.gold < cost]]);
                return;
            }
            case 'dungeonGate': {
                const id = G.ctx.dungeon, D = DUNGEONS[id];
                const lv = dungeonLevel(G, id);
                card(`<h3><span class="big">🏰</span>${D.name}</h3><p class="sub">${esc(D.blurb)}</p>
                    <dl class="stats"><dt>Floors</dt><dd>${D.floors - 1 === 1 ? 'a battle' : `${D.floors - 1} battles`}, then the boss</dd><dt>Monsters</dt><dd>about level ${lv} (you are ${G.level})</dd><dt>Boss</dt><dd>${MONSTERS[D.boss].name}</dd><dt>Prize</dt><dd>${G.cleared[id] ? 'a treasure hoard' : `${MATERIALS[D.shard].icon} ${MATERIALS[D.shard].name}`}</dd></dl>
                    ${G.level < D.lv ? '<p class="down">This place looks dangerous for your level.</p>' : ''}`,
                [['Not today', () => this.act({ type: 'pass' })], ['Enter', () => this.act({ type: 'enter' }), 'btn primary']]);
                return;
            }
            case 'dungeonCamp': {
                const D = DUNGEONS[G.ctx.dungeon];
                const last = G.ctx.floor + 1 >= D.floors;
                card(`<h3><span class="big">🔥</span>A campfire</h3><p>Floor ${G.ctx.floor} of ${D.name} is clear. You rest a moment (HP and MP +15%).</p><p>${last ? `Ahead: <b>${MONSTERS[D.boss].name}</b>.` : 'More monsters lie deeper in.'}</p>`,
                    [['Retreat', () => this.act({ type: 'retreat' })], [last ? 'Face the boss' : 'Onward', () => this.act({ type: 'onward' }), 'btn primary']]);
                return;
            }
            case 'portal': {
                const c = card(`<h3><span class="big">🌀</span>Wyrm Portal</h3><p>Step through to any space. Tap one on the board, or pick:</p>`);
                const list = h('div', { class: 'list' });
                const groups = [['🏘️ Towns', SPACES.filter((s) => s.type === 'town')], ['🏰 Dungeons', SPACES.filter((s) => s.type === 'dungeon' && dungeonOpen(G, s.dungeon))], ['🏠 Hearthstone & corners', SPACES.filter((s) => s.i % 10 === 0 && s.i !== 30)], ['🏡 Unowned deeds', DEEDS.filter((d) => !G.deeds[d.deed].owner)]];
                for (const [label, sp] of groups) {
                    if (!sp.length) continue;
                    list.appendChild(h('div', { class: 'sub' }, label));
                    for (const s of sp) list.appendChild(h('button', { class: 'btn', on: { click: () => this.act({ type: 'warpTo', to: s.i }) } }, `${s.icon} ${esc(s.name)}${s.i < G.pos ? ' <small>(passes Hearthstone)</small>' : ''}`));
                }
                c.appendChild(list);
                this.pickTile = (i) => { if (i !== 30) this.act({ type: 'warpTo', to: i }); };
                return;
            }
            case 'notice': {
                if (G.ctx.kind === 'fate') {
                    const F = FATE.find((f) => f.id === G.ctx.card);
                    const r = G.ctx.res || {};
                    const bits = [];
                    if (r.gold) bits.push(`+${r.gold} gold`);
                    if (r.lost) bits.push(`−${r.lost} gold`);
                    if (r.xp) bits.push(`+${r.xp} XP`);
                    if (r.items) for (const [k, n] of Object.entries(r.items)) bits.push(`${ITEMS[k].icon} ${ITEMS[k].name} ×${n}`);
                    if (r.mats) for (const [k, n] of Object.entries(r.mats)) bits.push(`${MATERIALS[k].icon} ${MATERIALS[k].name} ×${n}`);
                    if (r.blessing) bits.push(`${STATUS[r.blessing].icon} ${STATUS[r.blessing].name}`);
                    const art = { windfall: '💰', bard: '🎻', fairy: '🧚', tailwind: '🍃', shortcut: '🗺️', pickpocket: '👺', ambush: '⚔️', festival: '🎉', tax: '👑', blessing: '✨', egg: '📦', merchant: '🛒', rumble: '🌋', portal: '🚪', clover: '🍀', storm: '⛈️', dungeonmap: '🗺️', xp: '🧙' }[F.id] ?? '🃏';
                    P.innerHTML = '';
                    const c = h('div', { class: 'card fate-card' }, `<div class="sub">FATE</div><div class="art">${art}</div><h3 style="justify-content:center">${esc(F.title)}</h3><p>${esc(F.text)}</p>${bits.length ? `<div class="loot">${bits.map((b) => `<span>${b}</span>`).join('')}</div>` : ''}`);
                    const row = h('div', { class: 'acts' });
                    row.appendChild(h('button', { class: 'btn primary', on: { click: () => { this.audio.ui('click'); this.act({ type: 'ok' }); } } }, 'OK'));
                    c.appendChild(row);
                    P.appendChild(c);
                    P.hidden = false;
                    this.focusFirst('panel');
                } else {
                    const L = G.ctx.loot;
                    const bits = [`+${L.gold} gold`];
                    for (const [k, n] of Object.entries(L.items)) bits.push(`${ITEMS[k].icon} ${ITEMS[k].name} ×${n}`);
                    for (const [k, n] of Object.entries(L.mats)) bits.push(`${MATERIALS[k].icon} ${MATERIALS[k].name} ×${n}`);
                    if (L.gear) bits.push(`${gearIcon(GEAR[L.gear])} ${GEAR[L.gear].name}`);
                    card(`<h3><span class="big">🎁</span>Treasure!</h3><div class="loot">${bits.map((b) => `<span>${b}</span>`).join('')}</div>`, [['OK', () => this.act({ type: 'ok' }), 'btn primary']]);
                }
                return;
            }
            case 'reward': {
                const C = G.ctx, L = C.loot;
                const bits = [`+${L.xp} XP`, `+${L.gold + (C.hoard || 0)} gold`];
                for (const [k, n] of Object.entries(L.mats)) bits.push(`${MATERIALS[k].icon} ${MATERIALS[k].name} ×${n}`);
                for (const [k, n] of Object.entries(L.items)) bits.push(`${ITEMS[k].icon} ${ITEMS[k].name} ×${n}`);
                const learned = [];
                for (let lv = C.from + 1; lv <= C.to; lv++) for (const m of G.party) {
                    const d = m.id === 'hero' ? CLASSES[G.cls] : COMPANIONS[m.id];
                    for (const s of d.skills) if (SKILLS[s].lv === lv) learned.push(`${memberName(G, m)} learns <b>${SKILLS[s].name}</b>`);
                }
                P.innerHTML = '';
                const c = h('div', { class: 'card reward-card' }, `<h3>Victory!</h3>${C.shard ? `<div class="shard-get">${MATERIALS[C.shard].icon} ${MATERIALS[C.shard].name}!</div>` : ''}<div class="loot">${bits.map((b) => `<span>${b}</span>`).join('')}</div>
                    ${C.to > C.from ? `<p class="levelup">Level up! Now level ${C.to}.</p>` : ''}${learned.length ? `<p style="text-align:center;font-size:14px">${learned.join('<br>')}</p>` : ''}
                    <div class="bar xp" title="XP to next level"><i style="width:${Math.min(100, (G.xp / xpToNext(G.level)) * 100)}%"></i></div>`);
                const row = h('div', { class: 'acts' });
                row.appendChild(h('button', { class: 'btn primary', on: { click: () => { this.audio.ui('click'); this.act({ type: 'ok' }); } } }, 'Continue'));
                c.appendChild(row);
                P.appendChild(c);
                P.hidden = false;
                this.focusFirst('panel');
                return;
            }
            case 'defeat':
                if (G.ctx.dragon) card(`<h3><span class="big">🔥</span>Driven back!</h3><p>Pyrrhax's flames sweep you off the mountain. The villagers of Hearthstone drag you to safety.</p><p><b>You have one more lap to prepare.</b> The next time you pass Hearthstone, the dragon will be waiting.</p>`, [['Continue', () => this.act({ type: 'ok' }), 'btn primary']]);
                else card(`<h3><span class="big">💫</span>Knocked out!</h3><p>Your party wakes at ${SPACES[G.ctx.to].name}, bruised and ${G.ctx.lost} gold lighter.</p>`, [['Continue', () => this.act({ type: 'ok' }), 'btn primary']]);
                return;
            case 'town':
                if ($('town').hidden) { this.townTab = 'shop'; this.openScreen('town'); }
                this.renderTown(G);
                return;
            case 'battle': this.presentBattle(G); return;
            case 'victory': case 'gameover': this.showOver(G); return;
        }
        void S;
    }

    pickDie(G) {
        const P = $('panel');
        P.innerHTML = '';
        const c = h('div', { class: 'card' }, `<h3><span class="big">🎲</span>Loaded Die</h3><p>Choose your roll:</p>`);
        const row = h('div', { class: 'acts' });
        for (let n = 2; n <= 12; n++) row.appendChild(h('button', { class: 'btn', style: 'flex:0 0 auto;min-width:52px', on: { click: () => { P.hidden = true; this.act({ type: 'roll', item: 'die', pick: n }); } } }, String(n)));
        row.appendChild(h('button', { class: 'btn', on: { click: () => { P.hidden = true; this.presentKey = ''; } } }, 'Cancel'));
        c.appendChild(row);
        P.appendChild(c);
        P.hidden = false;
        this.focusFirst('panel');
        void G;
    }

    pickWarp(G) {
        const P = $('panel');
        P.innerHTML = '';
        const c = h('div', { class: 'card' }, `<h3><span class="big">📜</span>Warp Scroll</h3><p>Fly to which town?</p>`);
        const row = h('div', { class: 'list' });
        for (const s of SPACES.filter((x) => x.type === 'town' && x.i !== G.pos)) row.appendChild(h('button', { class: 'btn', on: { click: () => { P.hidden = true; this.act({ type: 'warp', to: s.i }); } } }, `🏘️ ${esc(s.name)}`));
        row.appendChild(h('button', { class: 'btn', on: { click: () => { P.hidden = true; this.presentKey = ''; } } }, 'Cancel'));
        c.appendChild(row);
        P.appendChild(c);
        P.hidden = false;
        this.focusFirst('panel');
    }

    /** A card describing a space, when the player taps a tile on the board. */
    tileInfo(G, i) {
        const s = SPACES[i];
        const box = $('tile-card');
        if (i < 0) { box.hidden = true; return; }
        let body = `<p>${esc(SPACE_INFO[s.type].desc)}</p>`;
        if (s.type === 'deed') {
            const d = G.deeds[s.deed];
            body = `<dl class="stats"><dt>Owner</dt><dd>${d.owner ? `<span class="owner-dot" style="background:${COLORS[d.owner]}"></span>${who(d.owner)} · level ${d.level}` : `for sale, ${s.price}g`}</dd>${d.owner ? `<dt>Toll</dt><dd>${deedToll(G, s.deed)}g</dd>` : ''}</dl>`;
        }
        if (s.type === 'town') body = `<p>${esc(TOWNS[s.town].blurb)}</p><p class="sub">Companion here: ${COMPANIONS[TOWNS[s.town].companion].name}</p>`;
        if (s.type === 'dungeon') body = `<p>${esc(DUNGEONS[s.dungeon].blurb)}</p><p class="sub">Boss: ${MONSTERS[DUNGEONS[s.dungeon].boss].name}${G.cleared[s.dungeon] ? ' · cleared' : ''}</p>`;
        const roam = G.roamers.find((r) => r.i === i);
        if (roam) body += `<p class="down">⚠️ A wandering ${MONSTERS[roam.id].name} blocks this space. Passing it means a fight.</p>`;
        const ahead = (i - G.pos + 40) % 40;
        box.innerHTML = `<div class="card"><h3><span class="big">${s.icon}</span>${esc(s.name)}</h3><div class="sub">${s.region ? regionName(s.region) + ' · ' : ''}${ahead ? `${ahead} space${ahead === 1 ? '' : 's'} ahead` : 'you are here'}</div>${body}</div>`;
        box.hidden = false;
        clearTimeout(this.tileT);
        this.tileT = setTimeout(() => { box.hidden = true; }, 4000);
    }

    // ================================================================== town
    renderTown(G) {
        const town = G.ctx.town;
        if (!town) return;
        const T = TOWNS[town];
        const sheet = $('town-sheet');
        const scroll = sheet.scrollTop;
        sheet.innerHTML = '';
        sheet.appendChild(h('div', { class: 'town-head' }, `<h2 style="margin:0">🏘️ ${T.name}</h2><span class="pill gold-pill"><span class="coin"></span><b>${G.gold}</b></span>`));
        sheet.appendChild(h('p', { class: 'sub' }, esc(T.blurb)));
        const tabs = h('div', { class: 'tabs', role: 'tablist' });
        for (const [id, label] of [['shop', '🛒 Shop'], ['inn', '🛏️ Inn'], ['tavern', '🍺 Tavern'], ['forge', '⚒️ Forge']]) {
            tabs.appendChild(h('button', { 'aria-pressed': String(this.townTab === id), on: { click: () => { this.townTab = id; this.audio.ui('click'); this.renderTown(G); } } }, label));
        }
        sheet.appendChild(tabs);
        const body = h('div');
        sheet.appendChild(body);
        if (this.townTab === 'shop') this.townShop(G, town, body);
        if (this.townTab === 'inn') this.townInn(G, town, body);
        if (this.townTab === 'tavern') this.townTavern(G, town, body);
        if (this.townTab === 'forge') this.townForge(G, body);
        const foot = h('div', { class: 'sheet-foot' });
        foot.appendChild(h('button', { class: 'btn', on: { click: () => this.openParty(G) } }, '🛡️ Party'));
        foot.appendChild(h('button', { class: 'btn primary', id: 'town-leave', on: { click: () => { this.audio.ui('close'); this.closeScreen('town'); this.act({ type: 'leave' }); } } }, 'Leave town ▸'));
        sheet.appendChild(foot);
        sheet.scrollTop = scroll;
    }

    townShop(G, town, body) {
        const st = shopStock(G, town);
        body.appendChild(h('h4', {}, 'Supplies'));
        const list = h('div', { class: 'list' });
        for (const id of st.items) {
            const I = ITEMS[id], price = itemPrice(G, id);
            list.appendChild(this.row(I.icon, I.name, `${I.desc} · you have ${G.bag.items[id] || 0}`, `${price}g`, G.gold < price, () => this.act({ type: 'buyItem', item: id })));
        }
        body.appendChild(list);
        body.appendChild(h('h4', {}, `Arms & armour <small class="sub">(tier ${st.tier})</small>`));
        const gl = h('div', { class: 'list' });
        const party = G.party;
        for (const id of st.gear) {
            const g = GEAR[id], price = gearPrice(G, id);
            const users = party.filter((m) => canEquip(G, m, id));
            if (!users.length) continue;
            const gains = users.map((m) => [m, gearScore(G, m, id) - gearScore(G, m, m.gear[g.slot])]).sort((a, b) => b[1] - a[1]);
            const best = gains[0];
            const tag = best[1] > 0.5 ? `<span class="up">▲ ${esc(memberName(G, best[0]))}</span>` : '<span class="sub">no better</span>';
            gl.appendChild(this.row(gearIcon(g), g.name, `${gearDesc(g)} · ${tag}`, `${price}g`, G.gold < price, () => {
                if (this.act({ type: 'buyGear', gear: id })) return;
                // equip it on whoever gains most, right away
                if (best[1] > 0.5) { this.act({ type: 'equip', member: best[0].id, gear: id }); this.toast(`${memberName(G, best[0])} equips the ${g.name}.`); }
            }));
        }
        body.appendChild(gl);
        const sell = Object.keys(G.bag.gear);
        if (sell.length) {
            body.appendChild(h('h4', {}, 'Sell spare gear'));
            const sl = h('div', { class: 'list' });
            for (const id of sell) sl.appendChild(this.row(gearIcon(GEAR[id]), `${GEAR[id].name} ×${G.bag.gear[id]}`, gearDesc(GEAR[id]), `Sell ${sellPrice(G, id)}g`, false, () => this.act({ type: 'sellGear', gear: id })));
            body.appendChild(sl);
        }
    }

    townInn(G, town, body) {
        const cost = innCost(G, town);
        const hurt = G.party.some((m) => { const s = stats(G, m); return m.hp < s.maxhp || m.mp < s.maxmp; });
        body.appendChild(h('div', { class: 'card' }, `<h3>🛏️ The ${TOWNS[town].name} Inn</h3><p>A warm bed, a hot meal, and everyone wakes fully healed${G.party.some((m) => m.hp <= 0) ? ', even the fallen' : ''}.</p>`));
        const row = h('div', { class: 'acts' });
        row.appendChild(h('button', { class: 'btn primary', disabled: G.gold < cost || !hurt, on: { click: () => this.act({ type: 'inn' }) } }, hurt ? `Rest for ${cost}g` : 'Everyone is well'));
        body.lastChild.appendChild(row);
    }

    townTavern(G, town, body) {
        const id = TOWNS[town].companion, C = COMPANIONS[id];
        const cost = hireCost(G, id);
        const card = h('div', { class: 'card companion' }, `<div class="por" style="background-image:url(${portrait(id)})"></div><div><h3>${C.name}</h3><div class="sub">${C.role}</div><p class="quote">${esc(C.line)}</p></div>`);
        body.appendChild(card);
        const acts = h('div', { class: 'acts' });
        if (!G.hired[id]) acts.appendChild(h('button', { class: 'btn primary', disabled: G.gold < cost, on: { click: () => this.act({ type: 'hire', id }) } }, `Hire for ${cost}g`));
        else acts.appendChild(h('span', { class: 'sub' }, G.party.some((m) => m.id === id) ? 'In your party.' : 'Waiting in reserve.'));
        body.appendChild(acts);
        body.appendChild(h('h4', {}, `Your party (${G.party.length} of ${PARTY_MAX})`));
        const list = h('div', { class: 'list' });
        for (const m of G.party) {
            if (m.id === 'hero') { list.appendChild(this.row('⭐', memberName(G, m), `${CLASSES[G.cls].name}, the leader`, null)); continue; }
            list.appendChild(this.row('🧑', COMPANIONS[m.id].name, COMPANIONS[m.id].role, 'Bench', false, () => this.act({ type: 'swap', out: m.id })));
        }
        for (const m of G.bench) {
            const label = G.party.length < PARTY_MAX ? 'Join' : `Swap in`;
            list.appendChild(this.row('💤', COMPANIONS[m.id].name + ' <small class="sub">(reserve)</small>', COMPANIONS[m.id].role, label, false, () => {
                if (G.party.length < PARTY_MAX) this.act({ type: 'swap', in: m.id });
                else { const out = G.party.find((x) => x.id !== 'hero'); this.act({ type: 'swap', in: m.id, out: out.id }); }
            }));
        }
        body.appendChild(list);
    }

    townForge(G, body) {
        const disc = forgeDiscount(G);
        body.appendChild(h('p', { class: 'sub' }, 'Monsters drop materials. Bring them here and the smith forges gear no shop sells.' + (disc < 1 ? ' (Dwarven Kinship: 25% off.)' : '')));
        const list = h('div', { class: 'list' });
        for (const [i, r] of RECIPES.entries()) {
            const g = GEAR[r.out];
            const have = G.party.some((m) => Object.values(m.gear).includes(r.out)) || G.bag.gear[r.out];
            const mats = Object.entries(r.mats).map(([m, n]) => `<span class="${(G.bag.mats[m] || 0) >= n ? '' : 'miss'}">${MATERIALS[m].icon} ${MATERIALS[m].name} ${G.bag.mats[m] || 0}/${n}</span>`).join('');
            const gold = Math.round(r.gold * disc);
            const el = this.row(gearIcon(g), g.name + (have ? ' <small class="sub">(owned)</small>' : ''), `${gearDesc(g)}<div class="mats" style="margin-top:4px">${mats}</div>`, `Forge ${gold}g`, !canCraft(G, r), () => {
                if (this.act({ type: 'craft', recipe: i })) return;
                const users = G.party.filter((m) => canEquip(G, m, r.out)).map((m) => [m, gearScore(G, m, r.out) - gearScore(G, m, m.gear[g.slot])]).sort((a, b) => b[1] - a[1]);
                if (users[0] && users[0][1] > 0.5) { this.act({ type: 'equip', member: users[0][0].id, gear: r.out }); this.toast(`${memberName(G, users[0][0])} equips the ${g.name}.`); }
            });
            list.appendChild(el);
        }
        body.appendChild(list);
    }

    row(icon, name, desc, btn, disabled = false, fn = null) {
        const r = h('div', { class: 'item-row' }, `<div class="ic">${icon}</div><div><div class="nm">${name}</div><div class="ds">${desc}</div></div>`);
        if (btn) r.appendChild(h('button', { class: 'chip-btn btn', disabled, on: { click: (e) => { this.audio.ui('click'); fn?.(e.currentTarget); } } }, btn));
        else r.appendChild(h('span'));
        return r;
    }

    // ================================================================== party and bag
    openParty(G) {
        this.renderParty(G);
        this.openScreen('partyscreen');
    }

    renderParty(G) {
        const sheet = $('party-sheet');
        const scroll = sheet.scrollTop;
        sheet.innerHTML = `<h2>Your Party</h2><div class="sub">Level ${G.level} · ${G.xp} / ${xpToNext(G.level)} XP · Valor ${Math.floor(G.valor)}%${G.shards.length ? ` · Shards ${G.shards.map((s) => MATERIALS[s].icon).join('')}` : ''}</div>`;
        sheet.appendChild(h('div', { class: 'bar xp', style: 'margin:6px 0 12px' }, `<i style="width:${(G.xp / xpToNext(G.level)) * 100}%"></i>`));
        for (const m of [...G.party, ...G.bench]) {
            const s = stats(G, m);
            const def = m.id === 'hero' ? CLASSES[G.cls] : COMPANIONS[m.id];
            const benched = G.bench.includes(m);
            const el = h('div', { class: 'member' }, `<div class="por" style="background-image:url(${portrait(m.id === 'hero' ? 'hero' : m.id, G.cls)})"></div>
                <div><div class="mname">${esc(memberName(G, m))}${benched ? ' <small class="sub">(reserve)</small>' : ''}</div><div class="role">${m.id === 'hero' ? `${def.name} ${def.title}` : def.role}</div>
                <div class="bar ${m.hp <= 0 ? 'ko' : ''}" style="margin-top:4px"><i style="width:${(m.hp / s.maxhp) * 100}%"></i></div><div class="statline"><span>HP <b>${m.hp}/${s.maxhp}</b></span><span>MP <b>${m.mp}/${s.maxmp}</b></span></div>
                <div class="statline"><span>ATK <b>${s.atk}</b></span><span>MAG <b>${s.mag}</b></span><span>DEF <b>${s.def}</b></span><span>RES <b>${s.res}</b></span><span>SPD <b>${s.spd}</b></span>${s.crit > 0.05 ? `<span>CRIT <b>${Math.round(s.crit * 100)}%</b></span>` : ''}</div>
                <div class="slots"></div>
                <div class="skills">${def.skills.map((k) => `<span class="${SKILLS[k].lv > G.level ? 'locked' : ''}" title="${esc(SKILLS[k].desc)}">${SKILLS[k].name}${SKILLS[k].lv > G.level ? ` (Lv ${SKILLS[k].lv})` : ''}</span>`).join('')}<span title="${esc(BURSTS[def.burst].desc)}">⚡ ${BURSTS[def.burst].name}</span></div></div>`);
            const slots = el.querySelector('.slots');
            for (const slot of ['weapon', 'armor', 'charm']) {
                const g = GEAR[m.gear[slot]];
                const better = Object.keys(G.bag.gear).some((id) => GEAR[id].slot === slot && canEquip(G, m, id) && gearScore(G, m, id) > gearScore(G, m, m.gear[slot]) + 0.5);
                const b = h('button', { class: 'slot' }, `<small>${slotIcon[slot]} ${slot}${better ? ' <span class="up">▲</span>' : ''}</small>${g ? esc(g.name) : '—'}`);
                b.addEventListener('click', () => this.pickGear(G, m, slot));
                slots.appendChild(b);
            }
            sheet.appendChild(el);
        }
        // deeds
        const mine = DEEDS.filter((d) => G.deeds[d.deed].owner === 'you');
        if (mine.length) {
            sheet.appendChild(h('h4', {}, '🏡 Your deeds'));
            const list = h('div', { class: 'list' });
            for (const d of mine) list.appendChild(this.row(d.emoji, `${d.name} <small class="sub">level ${G.deeds[d.deed].level}</small>`, `Toll ${deedToll(G, d.deed)}g · income ${deedIncome(G, d.deed)}g a lap`, `Sell ${deedValue(G, d.deed)}g`, false, (b) => {
                // two taps: the first asks, the second sells
                if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Sure?'; setTimeout(() => { b.classList.remove('confirm'); b.textContent = `Sell ${deedValue(G, d.deed)}g`; }, 2500); return; }
                this.act({ type: 'sellDeed', deed: d.deed }); this.renderParty(G);
            }));
            sheet.appendChild(list);
        }
        const foot = h('div', { class: 'sheet-foot' });
        foot.appendChild(h('button', { class: 'btn', on: { click: () => { this.closeScreen('partyscreen'); this.openBag(G); } } }, '🎒 Bag'));
        foot.appendChild(h('button', { class: 'btn primary', on: { click: () => { this.audio.ui('close'); this.closeScreen('partyscreen'); } } }, 'Done'));
        sheet.appendChild(foot);
        sheet.scrollTop = scroll;
    }

    pickGear(G, m, slot) {
        const sheet = $('party-sheet');
        sheet.innerHTML = `<h2>${slotIcon[slot]} ${esc(memberName(G, m))}'s ${slot}</h2>`;
        const cur = GEAR[m.gear[slot]];
        sheet.appendChild(h('p', { class: 'sub' }, `Now: ${cur ? `${cur.name} (${gearDesc(cur)})` : 'nothing'}`));
        const list = h('div', { class: 'list' });
        const ids = Object.keys(G.bag.gear).filter((id) => GEAR[id].slot === slot && canEquip(G, m, id)).sort((a, b) => gearScore(G, m, b) - gearScore(G, m, a));
        for (const id of ids) {
            const d = gearScore(G, m, id) - gearScore(G, m, m.gear[slot]);
            list.appendChild(this.row(gearIcon(GEAR[id]), GEAR[id].name, `${gearDesc(GEAR[id])} ${d > 0.5 ? '<span class="up">▲ better</span>' : d < -0.5 ? '<span class="down">▼ worse</span>' : ''}`, 'Equip', false, () => { this.act({ type: 'equip', member: m.id, gear: id }); this.renderParty(G); }));
        }
        if (!ids.length) list.appendChild(h('p', { class: 'sub' }, 'Nothing in the bag fits here. Shops and the forge sell more.'));
        sheet.appendChild(list);
        const foot = h('div', { class: 'sheet-foot' });
        if (cur && slot !== 'weapon') foot.appendChild(h('button', { class: 'btn', on: { click: () => { this.act({ type: 'unequip', member: m.id, slot }); this.renderParty(G); } } }, 'Take off'));
        foot.appendChild(h('button', { class: 'btn primary', on: { click: () => this.renderParty(G) } }, 'Back'));
        sheet.appendChild(foot);
        this.focusFirst('partyscreen');
    }

    openBag(G) { this.renderBag(G); this.openScreen('bagscreen'); }

    renderBag(G) {
        const sheet = $('bag-sheet');
        sheet.innerHTML = '<h2>🎒 Bag</h2>';
        const list = h('div', { class: 'list' });
        const its = Object.entries(G.bag.items);
        if (!its.length) list.appendChild(h('p', { class: 'sub' }, 'No items. Towns sell potions and more.'));
        for (const [id, n] of its) {
            const I = ITEMS[id];
            const usable = I.use.includes('field') && !['battle', 'reward', 'defeat'].includes(G.phase);
            list.appendChild(this.row(I.icon, `${I.name} ×${n}`, I.desc + (I.use.includes('board') ? ' · use from the Roll button' : I.use.includes('field') ? '' : ' · battle only'), usable ? 'Use' : null, false, () => this.useOn(G, id)));
        }
        sheet.appendChild(list);
        sheet.appendChild(h('h4', {}, '🧰 Materials'));
        const mats = Object.entries(G.bag.mats);
        sheet.appendChild(h('div', { class: 'mats' }, mats.length ? mats.map(([k, n]) => `<span>${MATERIALS[k].icon} ${MATERIALS[k].name} ×${n}</span>`).join('') : '<span class="sub">None yet. Monsters drop them.</span>'));
        sheet.appendChild(h('h4', {}, '🐉 Dragonbane Shards'));
        sheet.appendChild(h('div', { class: 'mats' }, SHARDS.map((s) => `<span class="${G.shards.includes(s) ? '' : 'miss'}">${MATERIALS[s].icon} ${MATERIALS[s].name}</span>`).join('')));
        sheet.appendChild(h('p', { class: 'sub' }, 'Each shard weakens Pyrrhax\'s scales. All four forge Dragonbane at any forge.'));
        const spare = Object.keys(G.bag.gear);
        if (spare.length) {
            sheet.appendChild(h('h4', {}, '⚔️ Spare gear'));
            sheet.appendChild(h('div', { class: 'mats' }, spare.map((id) => `<span>${gearIcon(GEAR[id])} ${GEAR[id].name} ×${G.bag.gear[id]}</span>`).join('')));
        }
        const foot = h('div', { class: 'sheet-foot' });
        foot.appendChild(h('button', { class: 'btn primary', on: { click: () => { this.audio.ui('close'); this.closeScreen('bagscreen'); } } }, 'Done'));
        sheet.appendChild(foot);
    }

    useOn(G, item) {
        const I = ITEMS[item];
        if (I.target === 'party') { if (!this.act({ type: 'use', item })) this.toast(`${I.name}: everyone is refreshed.`); this.renderBag(G); return; }
        const sheet = $('bag-sheet');
        sheet.innerHTML = `<h2>${I.icon} ${I.name}</h2><p class="sub">On whom?</p>`;
        const list = h('div', { class: 'list' });
        for (const m of G.party) {
            const s = stats(G, m);
            list.appendChild(this.row('🧑', memberName(G, m), `HP ${m.hp}/${s.maxhp} · MP ${m.mp}/${s.maxmp}`, 'Use', false, () => { const why = this.act({ type: 'use', item, target: m.id }); if (!why) this.toast(`${I.name} used on ${memberName(G, m)}.`); this.renderBag(G); }));
        }
        sheet.appendChild(list);
        sheet.appendChild(h('div', { class: 'sheet-foot' }, '')).appendChild(h('button', { class: 'btn', on: { click: () => this.renderBag(G) } }, 'Back'));
        this.focusFirst('bagscreen');
    }

    // ================================================================== battle
    battleRefresh(G) {
        const bv = this.view.battle;
        const B = G.battle;
        if (!B || !bv.units.length) return;
        // enemies
        const el = $('enemy-list');
        let html = '';
        let boss = null;
        bv.units.forEach((u, i) => {
            if (!u || u.side !== 'e') return;
            if (u.boss) boss = u;
            if (u.boss) return;
            const known = MONSTERS[u.eid];
            const weak = (known.weak || []).map((w) => ELEMENT_ICON[w]).join('');
            html += `<div class="enemy ${u.alive ? '' : 'dead'}">${esc(u.name)} <span class="w">${weak ? 'weak ' + weak : ''}</span><div class="bar"><i style="width:${(Math.max(0, u.disp.hp) / u.disp.maxhp) * 100}%"></i></div></div>`;
            void i;
        });
        if (el.innerHTML !== html) el.innerHTML = html;
        const bb = $('boss-bar');
        if (boss) {
            bb.hidden = false;
            const weak = (MONSTERS[boss.eid].weak || []).map((w) => ELEMENT_ICON[w]).join('');
            bb.querySelector('.bname').textContent = `${boss.name}${weak ? '  · weak ' + weak : ''}`;
            bb.querySelector('i').style.width = (Math.max(0, boss.disp.hp) / boss.disp.maxhp) * 100 + '%';
        } else bb.hidden = true;
        // party
        const bp = $('battle-party');
        let ph = '';
        bv.units.forEach((u, i) => {
            if (!u || u.side !== 'p') return;
            const st = Object.keys(u.status).map((k) => STATUS[k]?.icon ?? '').join('');
            ph += `<div class="bmember ${i === bv.active && !this.view.busy ? 'active' : ''} ${u.alive ? '' : 'ko'}"><div class="por" style="background-image:url(${portrait(u.mid === 'hero' ? 'hero' : u.mid, G.cls)})"></div>
                <div class="nm">${esc(u.name)}<small>${Math.max(0, u.disp.hp)}/${u.disp.maxhp}</small></div>
                <div class="bar ${u.disp.hp < u.disp.maxhp * 0.3 ? 'low' : ''}"><i style="width:${(Math.max(0, u.disp.hp) / u.disp.maxhp) * 100}%"></i></div>
                <div class="bar mp"><i style="width:${(u.disp.mp / Math.max(1, u.disp.maxmp)) * 100}%"></i></div><div class="sts">${st}</div></div>`;
        });
        const v = Math.floor(this.dispValor ?? G.valor);
        ph += `<div class="valor ${v >= VALOR_MAX ? 'full' : ''}">VALOR ${v}%<div class="bar"><i style="width:${v}%"></i></div></div>`;
        if (bp.innerHTML !== ph) bp.innerHTML = ph;
        // turn order
        const to = $('turn-order');
        const order = (this.view.busy ? [] : turnOrder(B, 8));
        const oh = order.map((i) => {
            const u = B.units[i];
            const img = u.side === 'p' ? portrait(u.mid === 'hero' ? 'hero' : u.mid, G.cls) : monsterPortrait(u.eid);
            return `<div class="tchip ${u.side}" style="background-image:url(${img})" title="${esc(u.name)}"></div>`;
        }).join('');
        if (to.innerHTML !== oh) to.innerHTML = oh;
    }

    presentBattle(G) {
        const B = G.battle;
        const u = B.units[B.turn];
        if (!u) return;
        const cmd = $('cmd');
        cmd.innerHTML = '';
        cmd.hidden = false;
        const m = G.party[u.mi];
        const st = this.cmdState || { menu: 'root' };
        cmd.appendChild(h('div', { class: 'who' }, `${esc(u.name)}<small>HP ${u.hp}/${u.maxhp} · MP ${u.mp}/${u.maxmp}</small>`));
        const add = (label, fn, opts = {}) => {
            const b = h('button', { disabled: !!opts.disabled, class: opts.cls || '', title: opts.title || '' }, label);
            b.addEventListener('click', () => { this.audio.ui('click'); fn(); });
            cmd.appendChild(b);
            return b;
        };
        const go = (c) => {
            const S = c.cmd === 'skill' ? SKILLS[c.skill] : c.cmd === 'burst' ? BURSTS[c.burst] : c.cmd === 'item' ? ITEMS[c.item] : null;
            const tgt = c.cmd === 'attack' ? 'enemy' : S?.target;
            if (tgt === 'enemy' || tgt === 'ally' || tgt === 'ko') { this.cmdState = { menu: 'target', c, tgt }; this.presentKey = ''; this.present(G); return; }
            this.cmdState = null;
            this.act({ type: 'cmd', ...c });
        };
        if (st.menu === 'root') {
            const burst = burstOf(G, u);
            if (G.valor >= VALOR_MAX) add(`⚡ ${BURSTS[burst].name}<small>BURST</small>`, () => go({ cmd: 'burst', burst }), { cls: 'burst', title: BURSTS[burst].desc });
            add('⚔️ Attack', () => go({ cmd: 'attack' }));
            const sk = skillsOf(G, m);
            add(`✨ Skills<small>${sk.length}</small>`, () => { this.cmdState = { menu: 'skills' }; this.presentKey = ''; this.present(G); }, { disabled: !sk.length });
            const its = Object.entries(G.bag.items).filter(([id]) => ITEMS[id].use.includes('battle'));
            add(`🧪 Items<small>${its.reduce((a, [, n]) => a + n, 0)}</small>`, () => { this.cmdState = { menu: 'items' }; this.presentKey = ''; this.present(G); }, { disabled: !its.length });
            add('🛡️ Defend<small>+MP</small>', () => go({ cmd: 'defend' }));
            if (B.canFlee) add('🏃 Run', () => go({ cmd: 'flee' }));
        } else if (st.menu === 'skills') {
            for (const id of skillsOf(G, m)) {
                const S = SKILLS[id];
                const why = whyNot(G, { cmd: 'skill', skill: id });
                add(`<span>${S.element ? ELEMENT_ICON[S.element] + ' ' : ''}${S.name}<span class="desc">${esc(S.desc)}</span></span><small>${S.mp} MP</small>`, () => go({ cmd: 'skill', skill: id }), { disabled: !!why });
            }
            add('◂ Back', () => { this.cmdState = null; this.presentKey = ''; this.present(G); }, { cls: 'back' });
        } else if (st.menu === 'items') {
            for (const [id, n] of Object.entries(G.bag.items)) {
                const I = ITEMS[id];
                if (!I.use.includes('battle')) continue;
                const why = whyNot(G, { cmd: 'item', item: id });
                add(`<span>${I.icon} ${I.name}<span class="desc">${esc(I.desc)}</span></span><small>×${n}</small>`, () => go({ cmd: 'item', item: id }), { disabled: !!why });
            }
            add('◂ Back', () => { this.cmdState = null; this.presentKey = ''; this.present(G); }, { cls: 'back' });
        } else if (st.menu === 'target') {
            const side = st.tgt === 'enemy' ? 'e' : 'p';
            const list = B.units.map((x, i) => [x, i]).filter(([x]) => x.side === side && (st.tgt === 'ko' ? !x.alive : x.alive));
            const pickT = (i) => { this.cmdState = null; this.act({ type: 'cmd', ...st.c, target: i }); };
            for (const [x, i] of list) add(`${side === 'e' ? '🎯' : '💚'} ${esc(x.name)}<small>${x.hp}/${x.maxhp}</small>`, () => pickT(i));
            add('◂ Back', () => { this.cmdState = null; this.presentKey = ''; this.present(G); }, { cls: 'back' });
            $('target-hint').hidden = false;
            $('target-hint').querySelector('span').textContent = side === 'e' ? 'Choose a target' : 'Choose an ally';
            this.targets = list.map(([, i]) => i);
            this.pickUnit = pickT;
            this.drawMarkers(G, side);
        }
        if (!this.anyScreen()) this.focusFirst('cmd');
    }

    drawMarkers(G, side) {
        const box = $('markers');
        box.innerHTML = '';
        if (!this.targets?.length) return;
        for (const i of this.targets) {
            const m = h('div', { class: 'marker ' + (side === 'p' ? 'ally' : ''), 'data-i': i });
            m.addEventListener('click', () => this.pickUnit?.(i));
            box.appendChild(m);
        }
        this.placeMarkers();
    }

    placeMarkers() {
        const box = $('markers');
        if (!box.children.length) return;
        const st = this.view.stage;
        for (const m of box.children) {
            const p = this.view.battle.screenOf(+m.dataset.i, st.w, st.h, 1.15);
            m.style.left = p.x + 'px';
            m.style.top = p.y + 'px';
        }
    }

    // ================================================================== the end
    showOver(G) {
        const won = G.over === 'win';
        const sheet = $('over-sheet');
        const r = rank(G);
        const stt = G.stats;
        sheet.innerHTML = `<div class="over-head">${won ? `<h2>Pyrrhax is defeated!</h2><p>The Ember Wyrm crashes into his crater and the lava cools to stone. Emberwyld Isle cheers for <b>${esc(G.heroName)}</b>.</p><div class="sub">RANK</div><div class="rank">${r}</div>` : `<h2>The island burns…</h2><p>Pyrrhax has driven you off the mountain twice. Rest, regroup, and try again.</p>`}</div>
            <div class="over-grid">
                <div><span>Score</span><b>${score(G)}</b></div><div><span>Level</span><b>${G.level}</b></div>
                <div><span>Turns</span><b>${G.turn}</b></div><div><span>Laps</span><b>${G.lap - 1} of ${G.laps}</b></div>
                <div><span>Battles won</span><b>${stt.wins}</b></div><div><span>Dungeons cleared</span><b>${Object.values(G.cleared).filter(Boolean).length} of 4</b></div>
                <div><span>Shards</span><b>${G.shards.length} of 4</b></div><div><span>Deeds</span><b>${DEEDS.filter((d) => G.deeds[d.deed].owner === 'you').length}</b></div>
                <div><span>Gold earned</span><b>${stt.goldEarned}</b></div><div><span>Tolls earned</span><b>${stt.tollsEarned}</b></div>
                <div><span>Gear forged</span><b>${stt.crafted}</b></div><div><span>Fame</span><b>${G.fame}</b></div>
            </div>`;
        const foot = h('div', { class: 'sheet-foot' });
        foot.appendChild(h('button', { class: 'btn', id: 'over-title', on: { click: () => this.onTitle?.() } }, 'Title'));
        foot.appendChild(h('button', { class: 'btn primary', id: 'over-again', on: { click: () => this.onAgain?.() } }, 'Play again'));
        sheet.appendChild(foot);
        this.openScreen('over');
    }
}
