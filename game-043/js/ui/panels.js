// ============================================================
// Modal panels. Each kind renders tabs into #panel-body from the
// Game's state and calls Game methods; they re-render on changes.
// ============================================================

import { ITEM, TOOL_TIERS } from '../data/items.js';
import { RECIPE, RECIPES, STATIONS, ingLabel } from '../data/recipes.js';
import { BUILDING, BUILDINGS, VILLAGE_LEVELS } from '../data/buildings.js';
import { JOBS, BLESSINGS } from '../data/jobs.js';
import { CROP } from '../data/crops.js';
import { GLIMMER_INFO } from '../data/tiles.js';
import { SKILLS } from '../sim/combat.js';
import { ANIMALS, HOUSE_CAP } from '../sim/farm.js';
import { assignChance, postingDays } from '../gen/postings.js';
import { SLOTS, slotMeta, writeSlot, readSlot, deleteSlot, serialize, parseSave } from '../sim/save.js';
import { clockText } from '../sim/state.js';
import { $, h, clear, iconEl, canvasEl } from './dom.js';

const fmtTime = s => { const m = Math.floor(s / 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

export class Panels {
    constructor(ui) {
        this.ui = ui;
        this.el = $('#panel'); this.tabsEl = $('#panel-tabs'); this.body = $('#panel-body');
        $('#panel-close').onclick = () => this.close();
        this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
        this.kind = null; this.data = null; this.tab = null; this.sel = null;
    }
    get game() { return this.ui.game; }
    get sp() { return this.ui.sprites; }
    isOpen() { return !this.el.hidden; }
    open(kind, data = {}) {
        this.kind = kind; this.data = data; this.sel = null; this.swap = null;
        const tabs = this.tabsFor(kind);
        this.tab = data.tab ?? tabs[0]?.[0];
        this.el.hidden = false;
        this.render();
        this.ui.onPanel(true);
    }
    close() {
        if (this.el.hidden) return;
        this.el.hidden = true; this.kind = null;
        this.ui.onPanel(false);
    }
    refresh() { if (!this.el.hidden) this.render(true); }

    tabsFor(kind) {
        const g = this.game, d = this.data;
        switch (kind) {
            case 'menu': return [['bag', '🎒 Bag'], ['journal', '📜 Journal'], ['village', '🏡 Village'], ['me', '⭐ You'], ['recipes', '🍲 Recipes'], ['system', '💾 Save']];
            case 'home': return [['cook', '🍲 Cook'], ['craft', '🔨 Craft'], ['storage', '📦 Chest'], ['sleep', '🛏 Sleep']];
            case 'shopfront': {
                const job = d.job, t = [['talk', '💬 ' + g.people[job].name]];
                if (g.shopFor(job)) t.push(['buy', '🛒 Buy']);
                t.push(['sell', '💰 Sell']);
                const st = BUILDING[d.building].station;
                if (st) t.push(['station', '⚙ ' + STATIONS[st].name]);
                if (job === 'blacksmith') t.push(['smith', '🔨 Forge'], ['upgrade', '⬆ Tools']);
                if (job === 'tailor') t.push(['tailor', '🧵 Sew']);
                if (job === 'rancher') t.push(['buyanimals', '🐔 Animals']);
                if (job === 'bard') t.push(['tavern', '🎵 Tavern']);
                return t;
            }
            case 'shop': return [['buy', '🛒 Buy'], ['sell', '💰 Sell']];
            case 'animals': return [['animals', d.home === 'coop' ? '🐔 Coop' : '🐄 Barn']];
            default: return [[kind, this.titleFor(kind)]];
        }
    }
    titleFor(kind) {
        return { station: 'Station', chest: 'Chest', storehouse: 'Storehouse', ship: 'Shipping Bin', build: 'Build', board: 'Job Board', greenhouse: 'Greenhouse', gift: 'Give a gift', travel: 'Fairy Ring', map: 'Map', stats: 'You' }[kind] ?? kind;
    }

    render(keepScroll) {
        const scroll = this.body.scrollTop;
        clear(this.tabsEl);
        const tabs = this.tabsFor(this.kind);
        if (tabs.length > 1) for (const [id, label] of tabs) { const b = h('button', { class: id === this.tab ? 'on' : '' }, label); b.onclick = () => { this.tab = id; this.sel = null; this.render(); }; this.tabsEl.append(b); }
        else this.tabsEl.append(h('span', { class: 'title' }, tabs[0]?.[1] ?? ''));
        clear(this.body);
        const fn = this['tab_' + this.tab] ?? this['tab_' + this.kind];
        if (fn) fn.call(this, this.body);
        if (keepScroll) this.body.scrollTop = scroll;
    }

    // ------------------------------------------------------------ building blocks
    slot(s, i, opts = {}) {
        const el = h('button', { class: 'slot' + (opts.sel ? ' sel' : '') + (s ? '' : ' empty'), 'aria-label': s ? ITEM[s.id].name : 'empty' });
        if (s) {
            el.append(iconEl(this.sp, s.id));
            if (s.n > 1) el.append(h('span', { class: 'n' }, s.n));
            const t = this.game.p.tools[s.id];
            if (t) el.append(h('span', { class: 'tier' }, TOOL_TIERS[t][0]));
        }
        if (opts.onclick) el.onclick = () => opts.onclick(i);
        return el;
    }
    grid(slots, size, onclick, selIdx) {
        const g = h('div', { class: 'grid' });
        for (let i = 0; i < size; i++) g.append(this.slot(slots[i], i, { onclick, sel: i === selIdx }));
        return g;
    }
    ingList(ing, have) {
        const g = this.game;
        return h('div', { class: 'ings' }, ing.map(([k, n]) => {
            const c = g.count(k);
            const id = k.startsWith('tag:') ? null : k;
            return h('span', { class: 'ing ' + (c >= n ? 'have' : 'miss') }, id ? iconEl(this.sp, id, 16) : '', `${n} ${ingLabel(k)} (${c})`);
        }));
    }
    row(icon, title, sub, buttons = [], cls = '') {
        return h('div', { class: 'row ' + cls }, icon ? (typeof icon === 'string' ? iconEl(this.sp, icon) : icon) : null, h('div', { class: 'main' }, h('b', {}, title), sub ? (sub instanceof Node ? sub : h('small', {}, sub)) : null), ...buttons);
    }
    btn(label, fn, cls = '', disabled = false) { const b = h('button', { class: 'btn ' + cls }, label); b.disabled = disabled; b.onclick = () => { fn(); this.refresh(); }; return b; }

    // ------------------------------------------------------------ BAG
    tab_bag(b) {
        const g = this.game, s = g.s;
        b.append(h('p', { class: 'muted' }, `Tap an item for options. The first 8 slots are your hotbar. ${this.swap !== null && this.swap !== undefined ? 'Now tap where to move it.' : ''}`));
        b.append(this.grid(s.inv, s.invSize, i => {
            if (this.swap != null) { const a = s.inv[this.swap]; s.inv[this.swap] = s.inv[i]; s.inv[i] = a; this.swap = null; this.sel = i; g.emit('inv'); this.refresh(); return; }
            this.sel = i; this.refresh();
        }, this.sel));
        if (this.sel != null && s.inv[this.sel]) b.append(this.itemDetail(this.sel));
        b.append(h('h3', {}, 'Equipment'));
        for (const slot of ['weapon', 'armor', 'charm']) {
            const id = g.p.equip[slot];
            b.append(this.row(id ?? null, id ? ITEM[id].name : `No ${slot}`, id ? this.eqText(ITEM[id].eq) + (slot === 'weapon' && g.p.weaponElem !== 'none' ? ` · ${g.p.weaponElem}` : '') : slot, id && slot !== 'weapon' ? [this.btn('Remove', () => g.unequip(slot))] : []));
        }
        b.append(h('p', { class: 'muted' }, `Watering can: ${g.p.water}/${20 + g.p.tools.can * 10} · Hay in silo: ${s.hay}`));
    }
    eqText(e) { return Object.entries(e).filter(([k]) => k !== 'slot').map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' '); }
    itemDetail(i) {
        const g = this.game, s = g.s.inv[i], it = ITEM[s.id];
        const d = h('div', { class: 'detail' });
        d.append(h('b', {}, `${it.name}${s.n > 1 ? ' ×' + s.n : ''}`));
        const info = [];
        if (it.desc) info.push(it.desc);
        if (it.cat === 'tool') info.push(`${TOOL_TIERS[g.p.tools[s.id] ?? 0]} tier. Energy per use: ${g.energyCost(s.id)}.`);
        if (it.food) info.push([it.food.hp ? `+${it.food.hp} HP` : '', it.food.en ? `+${it.food.en} energy` : '', it.food.sp ? `+${it.food.sp} SP` : '', it.food.buff ? 'Buff: ' + Object.entries(it.food.buff).map(([k, v]) => `${k} +${v}`).join(', ') : ''].filter(Boolean).join(' · '));
        if (it.eq) info.push(this.eqText(it.eq));
        if (it.sell) info.push(`Sells for ${it.sell}g`);
        if (it.cat === 'seed') { const c = CROP[it.crop]; info.push(`${c.seasons === 'any' ? 'Any season' : c.seasons.map(x => ['Spring', 'Summer', 'Fall', 'Winter'][x]).join('/')} · ${c.days} days${c.regrow ? ` · regrows every ${c.regrow}` : ''}`); }
        d.append(h('p', { class: 'muted' }, info.join(' — ')));
        const btns = h('div', { class: 'btns' });
        if (i < 8) btns.append(this.btn('Hold', () => { g.s.sel = i; g.emit('inv'); this.close(); }, 'primary'));
        if (it.food) btns.append(this.btn(it.cat === 'potion' ? 'Drink' : 'Eat', () => g.eat(s.id), 'primary'));
        if (it.eq) btns.append(this.btn('Equip', () => g.equip(s.id), 'primary'));
        if (it.teaches) btns.append(this.btn('Read', () => g.readScroll(s.id), 'primary'));
        btns.append(this.btn('Move', () => { this.swap = i; }));
        if (it.cat !== 'tool' && !it.key) btns.append(this.btn('Discard 1', () => { if (confirm(`Throw away 1 ${it.name}?`)) g.take(s.id, 1); }));
        d.append(btns);
        return d;
    }

    // ------------------------------------------------------------ JOURNAL
    tab_journal(b) {
        const g = this.game, s = g.s;
        b.append(h('h3', {}, g.chapterTitle()));
        b.append(this.row(null, g.objective(), g.s.quests.main.ch >= 6 ? '' : `Heart Shards returned: ${s.heartwood}/5${g.p.shards ? ` · carrying ${g.p.shards}` : ''}`, [], 'ok'));
        const stories = g.residents().filter(j => s.villagers[j].story.active);
        if (stories.length) {
            b.append(h('h3', {}, 'Villager stories'));
            for (const j of stories) b.append(this.row(null, `${g.people[j].name}: ${g.storyState(j).chapter.title}`, g.storyReminder(j), [], g.storyReady(j) ? 'ok' : ''));
        }
        const avail = g.residents().filter(j => g.storyState(j).available);
        if (avail.length) b.append(h('p', { class: 'muted' }, `✦ ${avail.map(j => g.people[j].name).join(', ')} ${avail.length > 1 ? 'have' : 'has'} something to ask you.`));
        b.append(h('h3', {}, 'Board jobs'));
        if (!s.board.taken.length && !s.board.assigned.length) b.append(h('p', { class: 'muted' }, s.village.board ? 'No jobs taken. Visit the Job Board by the plaza.' : 'The Job Board still needs rebuilding.'));
        for (const t of s.board.taken) { const pr = g.postingProgress(t); b.append(this.row(null, t.title, `${pr.have}/${pr.need} · due by day ${t.deadline} · turn in at the board`, [], pr.have >= pr.need ? 'ok' : '')); }
        for (const a of s.board.assigned) b.append(this.row(null, a.title, `${a.jobs.map(j => g.people[j].name).join(' & ')} — back on day ${a.until} (${Math.round(a.chance * 100)}%)`));
        b.append(h('h3', {}, 'Recent'));
        for (const l of s.log.slice(0, 12)) b.append(h('p', { class: 'muted' }, '· ' + l));
    }

    // ------------------------------------------------------------ VILLAGE
    tab_village(b) {
        const g = this.game, v = g.s.village;
        const next = VILLAGE_LEVELS[v.level]?.xp;
        b.append(h('h3', {}, `${g.s.villageName} — ${g.villageTitle()} (level ${v.level})`));
        const bar = h('div', { class: 'bar en', style: 'height:18px;margin-bottom:6px' }, h('i', { style: `width:${next ? Math.min(100, (v.xp - VILLAGE_LEVELS[v.level - 1].xp) / (next - VILLAGE_LEVELS[v.level - 1].xp) * 100) : 100}%` }), h('b', {}, next ? `Coziness ${v.xp} / ${next}` : `Coziness ${v.xp} — fully grown!`));
        b.append(bar);
        if (v.levelReady) b.append(h('p', {}, '★ The Mayor is ready to celebrate a new village level!'));
        b.append(h('h3', {}, 'Villagers'));
        const res = g.residents();
        if (!res.length) b.append(h('p', { class: 'muted' }, 'Nobody has moved in yet.'));
        for (const j of res) {
            const V = g.s.villagers[j], P = g.people[j];
            const face = canvasEl(this.sp.person(P.look, 0, 0), 32, 40);
            const sub = h('small', {}, h('span', { class: 'hearts' }, '♥'.repeat(g.hearts(j)) + '♡'.repeat(10 - g.hearts(j))), ` · ${JOBS[j].name} Lv${V.level} · happy ${V.happiness}${V.away ? ' · away on a job' : ''}${V.gifted === g.day ? ' · gifted today' : ''}`, h('br'), JOBS[j].passive);
            b.append(this.row(face, `${P.name} ${P.surname}`, sub));
        }
        if (g.s.applicants.length) {
            b.append(h('h3', {}, 'Waiting in the plaza'));
            for (const j of g.s.applicants) b.append(this.row(canvasEl(this.sp.person(g.people[j].look, 0, 0), 32, 40), `${g.people[j].name} — ${JOBS[j].name}`, `Needs a ${BUILDING[JOBS[j].building].name}.`));
        }
        b.append(h('h3', {}, 'Animals'));
        if (!g.s.animals.length) b.append(h('p', { class: 'muted' }, 'No animals yet. Build a Coop or a Barn and visit the Rancher.'));
        for (const a of g.s.animals) b.append(h('p', { class: 'muted' }, `${a.name} the ${ANIMALS[a.kind].name.toLowerCase()} — ${'♥'.repeat(Math.round(a.love / 200))}`));
    }

    // ------------------------------------------------------------ YOU
    tab_me(b) {
        const g = this.game, p = g.p, st = g.stats;
        const face = canvasEl(this.sp.person(p.look, 0, 0), 48, 60);
        b.append(this.row(face, `${p.name} — Level ${p.level}`, `XP ${p.xp}/${g.xpToNext()} · ${g.dateText()} · played ${fmtTime(g.s.playtime)}`));
        b.append(h('div', { class: 'stats' },
            h('div', {}, 'HP', h('b', {}, `${p.hp}/${p.maxHp}`)), h('div', {}, 'SP', h('b', {}, `${p.sp}/${p.maxSp}`)),
            h('div', {}, 'Energy', h('b', {}, `${p.energy}/${p.maxEnergy}`)), h('div', {}, 'Gold', h('b', {}, p.gold)),
            h('div', {}, 'Attack', h('b', {}, st.atk)), h('div', {}, 'Defence', h('b', {}, st.def)),
            h('div', {}, 'Speed', h('b', {}, st.spd)), h('div', {}, 'Luck', h('b', {}, st.luck)),
        ));
        b.append(h('h3', {}, 'Skills'));
        b.append(h('div', { class: 'stats' }, Object.entries(p.skills).map(([k, v]) => h('div', {}, k[0].toUpperCase() + k.slice(1), h('b', {}, `Lv ${v.lv}`)))));
        b.append(h('h3', {}, 'Battle skills'));
        for (const S of SKILLS) b.append(h('p', { class: p.level >= S.lv ? '' : 'muted' }, `${p.level >= S.lv ? '✦' : '🔒'} ${S.name} (Lv ${S.lv}, ${S.sp} SP) — ${S.desc}`));
        b.append(h('h3', {}, 'Tools'));
        b.append(h('p', {}, Object.entries(p.tools).map(([k, t]) => `${ITEM[k].name}: ${TOOL_TIERS[t]}`).join(' · ')));
        b.append(h('h3', {}, 'Relics'));
        if (!p.relics.length && !p.shards) b.append(h('p', { class: 'muted' }, 'None yet. Each dungeon hides one.'));
        for (const r of p.relics) b.append(this.row(r, ITEM[r].name, ITEM[r].desc));
        if (p.shards) b.append(this.row('heart_shard', `Heart Shard ×${p.shards}`, 'Take it to the Heartwood!'));
        if (g.s.blessings.length) {
            b.append(h('h3', {}, 'Blessings'));
            const txt = { farm1: 'Crops sometimes grow twice overnight.', energy: '+20 max energy.', cheap: 'Upgrades and buildings are 10% cheaper.', companion: 'Companions hit harder; villagers are happier.', allmagic: 'All glimmers are awake.' };
            for (const k of g.s.blessings) b.append(h('p', { class: 'muted' }, '✦ ' + (BLESSINGS[k] ?? txt[k] ?? k)));
        }
        b.append(h('p', { class: 'muted' }, `World seed: ${g.s.seed} — share it and a friend gets the same land.`));
    }

    // ------------------------------------------------------------ RECIPES
    tab_recipes(b) {
        const g = this.game;
        const known = g.s.known.recipes;
        b.append(h('p', { class: 'muted' }, `${known.length} of ${RECIPES.length} recipes discovered. Recipes are found in chests, glimmers, villagers' stories, the Library and the Café. Cook at your cabin.`));
        for (const r of RECIPES) {
            if (!known.includes(r.id)) { b.append(this.row(null, '??? — undiscovered', `A tier ${r.tier} recipe`, [], 'no')); continue; }
            const it = ITEM[r.id];
            b.append(this.row(r.id, it.name, h('div', {}, h('small', {}, `+${it.food.hp} HP · +${it.food.en} energy${it.food.buff ? ' · ' + Object.entries(it.food.buff).map(([k, v]) => `${k} +${v}`).join(', ') : ''}`), this.ingList(r.ing))));
        }
    }

    // ------------------------------------------------------------ SAVE / SYSTEM
    tab_system(b) {
        const g = this.game, ui = this.ui;
        b.append(h('h3', {}, 'Save'));
        for (const sl of SLOTS) {
            const m = slotMeta(sl);
            const title = sl === 'auto' ? 'Autosave' : `Slot ${sl}`;
            const sub = m ? `${m.name} of ${m.village} · ${m.date} · Lv ${m.level} · ${fmtTime(m.playtime)}` : 'Empty';
            const btns = [];
            if (sl !== 'auto') btns.push(this.btn('Save', () => { if (!m || confirm(`Overwrite ${title}?`)) { ui.toast(writeSlot(sl, g) ? `Saved to ${title}.` : 'Could not save (storage blocked).'); } }, 'primary'));
            if (m) btns.push(this.btn('Load', () => { if (confirm(`Load ${title}? Unsaved progress will be lost.`)) { const st = readSlot(sl); if (st) ui.loadState(st); } }));
            b.append(this.row(null, title, sub, btns));
        }
        b.append(h('p', { class: 'muted' }, 'The game autosaves every time you sleep and when you leave a dungeon.'));
        const exp = this.btn('⬇ Export save file', () => {
            const blob = new Blob([serialize(g)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `glimmerglen-${g.p.name}-day${g.day}.json` });
            document.body.append(a); a.click(); a.remove();
        });
        const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
        file.onchange = async () => { const f = file.files[0]; if (!f) return; const st = parseSave(await f.text()); if (st) ui.loadState(st); else ui.toast("That file isn't a Glimmerglen save."); };
        const imp = this.btn('⬆ Import save file', () => file.click());
        b.append(h('div', { class: 'btns', style: 'display:flex;gap:6px;flex-wrap:wrap' }, exp, imp, file));
        b.append(h('h3', {}, 'Settings'));
        const o = ui.opts;
        const range = (label, key) => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: o[key] }); r.oninput = () => { o[key] = +r.value; ui.applyOpts(); }; return h('div', { class: 'opt' }, label, r); };
        b.append(range('Music', 'music'), range('Sound effects', 'sfx'));
        const tog = (label, key) => { const c = h('input', { type: 'checkbox' }); c.checked = !!o[key]; c.onchange = () => { o[key] = c.checked; ui.applyOpts(); }; return h('div', { class: 'opt' }, label, c); };
        b.append(tog('Screen shake', 'shake'), tog('Always run', 'run'));
        b.append(h('h3', {}, 'Controls'));
        b.append(h('p', { class: 'muted' }, 'Move: WASD / arrows or the left thumb. Action: Space / E or A. Run: Shift or hold B. Hotbar: 1–8, Q / R to cycle. Menu: Esc / I. Map: M. Journal: J.'));
        b.append(h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px' }, this.btn('Games list', () => { location.href = '../index.html'; }), this.btn('Title screen', () => { if (confirm('Return to the title? Unsaved progress since your last sleep will be lost.')) ui.toTitle(); })));
    }

    // ------------------------------------------------------------ HOME
    tab_cook(b) {
        const g = this.game;
        b.append(h('p', { class: 'muted' }, 'Cook with what is in your backpack. Dishes heal more than raw food, and many give a buff for the day.'));
        const known = g.s.known.recipes.map(id => RECIPE[id]).sort((a, b) => (g.canCook(b.id) - g.canCook(a.id)) || a.tier - b.tier);
        for (const r of known) {
            const it = ITEM[r.id], ok = g.canCook(r.id);
            b.append(this.row(r.id, it.name, h('div', {}, h('small', {}, `+${it.food.hp} HP +${it.food.en} EN${it.food.buff ? ' · ' + Object.entries(it.food.buff).map(([k, v]) => `${k}+${v}`).join(' ') : ''} · have ${g.count(r.id)}`), this.ingList(r.ing)), [this.btn('Cook', () => g.cook(r.id), 'primary', !ok)], ok ? 'ok' : 'no'));
        }
    }
    tab_craft(b) {
        const g = this.game;
        b.append(h('p', { class: 'muted' }, 'Placeable items go anywhere in the Glen: select them on the hotbar and press A facing an empty spot.'));
        for (const c of g.craftList()) {
            const ok = !!g.plan(c.in);
            b.append(this.row(c.out, `${ITEM[c.out].name}${c.n > 1 ? ' ×' + c.n : ''}`, h('div', {}, h('small', {}, ITEM[c.out].desc ?? ''), this.ingList(c.in)), [this.btn('Make', () => g.craft(c.out), 'primary', !ok)], ok ? 'ok' : 'no'));
        }
    }
    tab_storage(b) { this.transfer(b, this.game.s.storage, 48); }
    transfer(b, store, size) {
        const g = this.game, s = g.s;
        b.append(h('h3', {}, 'Chest — tap to take'));
        b.append(this.grid(store, size, i => g.moveBetween(store, size, s.inv, s.invSize, i)));
        b.append(h('h3', {}, 'Backpack — tap to store'));
        b.append(this.grid(s.inv, s.invSize, i => { if (ITEM[s.inv[i]?.id]?.cat === 'tool') { this.ui.toast('Keep your tools with you.'); return; } g.moveBetween(s.inv, s.invSize, store, size, i); }));
    }
    tab_sleep(b) {
        const g = this.game;
        b.append(h('p', {}, `It's ${clockText(g.s.time.min)}. Sleeping ends the day and saves your game.`));
        if (g.s.ship.length) b.append(h('p', { class: 'muted' }, `The shipping bin will be collected overnight.`));
        const warn = g.cropsOutOfSeasonTomorrow();
        if (warn) b.append(h('p', {}, `⚠ ${warn} crop${warn > 1 ? 's' : ''} won't survive the change of season tomorrow.`));
        b.append(this.btn('🛏 Sleep until morning', () => { this.close(); this.ui.sleep(); }, 'primary'));
    }

    // ------------------------------------------------------------ SHOPS
    shopKey() { return this.kind === 'shop' ? this.data.shop : this.game.shopFor(this.data.job); }
    tab_buy(b) {
        const g = this.game, shop = this.shopKey();
        if (this.kind === 'shopfront' && !g.keeperHere(this.data.job)) { b.append(h('p', {}, `${g.people[this.data.job].name} isn't here right now. (Open 8am–8pm.)`)); return; }
        b.append(h('p', { class: 'muted' }, `You have ${g.p.gold} gold.`));
        for (const id of g.shopStock(shop)) {
            const it = ITEM[id], price = g.priceOf(id);
            const sub = it.cat === 'seed' ? `${CROP[it.crop].days} days · sells for ${CROP[it.crop].sell}g` : it.desc ?? (it.food ? `+${it.food.hp ?? 0} HP +${it.food.en ?? 0} EN` : `sells for ${it.sell}g`);
            b.append(this.row(id, `${it.name} — ${price}g`, sub, [this.btn('Buy', () => g.buy(shop, id, 1), '', g.p.gold < price), ...(it.cat !== 'scroll' ? [this.btn('×5', () => g.buy(shop, id, 5), '', g.p.gold < price * 5)] : [])]));
        }
    }
    tab_sell(b) {
        const g = this.game, s = g.s;
        b.append(h('p', { class: 'muted' }, `Tap an item to sell one at its base price. (The shipping bin by your cabin pays ${Math.round((g.shipMult() - 1) * 100)}% more overnight.)`));
        b.append(this.grid(s.inv, s.invSize, i => { const it = ITEM[s.inv[i]?.id]; if (!it) return; if (!it.sell || it.cat === 'tool' || it.key) { this.ui.toast("You can't sell that."); return; } g.sell(i, 1); this.ui.toast(`Sold ${it.name} for ${it.sell}g`); this.refresh(); }));
    }
    tab_talk(b) {
        const g = this.game, job = this.data.job;
        const here = g.keeperHere(job);
        b.append(this.row(canvasEl(this.sp.person(g.people[job].look, 0, 0), 32, 40), g.people[job].name, here ? JOBS[job].passive : `Not in right now${g.s.villagers[job]?.away ? ' — away on a job-board task' : ' (open 8am–8pm)'}.`));
        if (here) b.append(this.btn('💬 Talk', () => { this.close(); g.talkVillager(job); }, 'primary'));
    }
    tab_smith(b) { this.gearUI(b, this.game.smithList()); this.socketUI(b); }
    tab_tailor(b) { this.gearUI(b, this.game.tailorList()); }
    gearUI(b, list) {
        const g = this.game;
        if (!g.keeperHere(this.data.job)) { b.append(h('p', {}, 'Come back when the shop is open (8am–8pm).')); return; }
        for (const x of list) {
            const ok = !!g.plan(x.in) && g.p.gold >= x.gold;
            const it = ITEM[x.out];
            b.append(this.row(x.out, `${it.name} — ${x.gold}g`, h('div', {}, h('small', {}, it.eq ? this.eqText(it.eq) : it.desc), this.ingList(x.in)), [this.btn('Make', () => g.makeGear(list, x.out), 'primary', !ok)], ok ? 'ok' : 'no'));
        }
    }
    socketUI(b) {
        const g = this.game;
        b.append(h('h3', {}, 'Set a gem in your weapon'));
        b.append(h('p', { class: 'muted' }, `Current element: ${g.p.weaponElem}. Emerald=leaf, Amethyst=storm, Sapphire=frost, Ruby=ember, Onyx=shadow, Moonstone=light. The gem is used up.`));
        for (const gem of ['emerald', 'amethyst', 'sapphire', 'ruby', 'onyx', 'moonstone']) if (g.count(gem)) b.append(this.row(gem, ITEM[gem].name, `×${g.count(gem)}`, [this.btn('Set', () => g.socketGem(gem), 'primary')]));
    }
    tab_upgrade(b) {
        const g = this.game;
        if (!g.keeperHere('blacksmith')) { b.append(h('p', {}, 'Come back when the forge is open (8am–8pm).')); return; }
        b.append(h('p', { class: 'muted' }, 'Better tools cost less energy, break things in fewer hits, and an Iron pickaxe can crack big rocks. The can holds more water.'));
        for (const tool of ['hoe', 'can', 'axe', 'pick', 'scythe']) {
            const c = g.upgradeCost(tool);
            if (!c) { b.append(this.row(tool, `${ITEM[tool].name} — ${TOOL_TIERS[g.p.tools[tool]]}`, 'Fully upgraded!')); continue; }
            const ok = g.count(c.bar) >= c.n && g.p.gold >= c.gold;
            b.append(this.row(tool, `${ITEM[tool].name}: ${TOOL_TIERS[c.tier - 1]} → ${TOOL_TIERS[c.tier]}`, `${c.n} ${ITEM[c.bar].name} (have ${g.count(c.bar)}) + ${c.gold}g`, [this.btn('Upgrade', () => g.upgradeTool(tool), 'primary', !ok)], ok ? 'ok' : 'no'));
        }
    }
    tab_buyanimals(b) {
        const g = this.game;
        if (!g.keeperHere('rancher')) { b.append(h('p', {}, 'Come back when the ranch is open (8am–8pm).')); return; }
        for (const [k, A] of Object.entries(ANIMALS)) {
            const house = g.hasHouse(A.home), n = g.animalsIn(A.home).length;
            b.append(this.row(canvasEl(this.sp.animal(k, 0, false), 32), `${A.name} — ${A.price}g`, house ? `Lives in the ${A.home} (${n}/${HOUSE_CAP}). Makes ${ITEM[A.produce].name}${A.every > 1 ? ' every other day' : ' daily'}.` : `Needs a ${A.home === 'coop' ? 'Coop' : 'Barn'}.`, [this.btn('Buy', () => g.buyAnimal(k), 'primary', !house || n >= HOUSE_CAP || g.p.gold < A.price)]));
        }
    }
    tab_tavern(b) {
        const g = this.game;
        b.append(h('p', {}, `${g.people.bard.name} is tuning up. A night at the tavern costs 120g: a warm drink, a song, and a buff for the rest of the day (ATK/DEF +2, SPD +1, +40 energy). Everyone there likes you a little more.`));
        b.append(this.btn('🎵 Spend the evening (120g)', () => g.tavernTreat(), 'primary', g.s.flags.tavern === g.day || g.p.gold < 120));
    }

    // ------------------------------------------------------------ STATIONS
    tab_station_placed(b) { this.stationUI(b, this.data.key, this.data.station); }
    stationUI(b, key, kind) {
        const g = this.game, st = g.station(key, kind), now = g.now();
        const S = STATIONS[kind];
        b.append(h('h3', {}, S.name));
        if (st.queue.length) {
            for (const q of st.queue) { const left = q.ready - now; b.append(this.row(q.out, `${q.n} × ${ITEM[q.out].name}`, left <= 0 ? 'Ready!' : `Ready in ${Math.floor(left / 60)}h ${Math.round(left % 60)}m`, [], left <= 0 ? 'ok' : '')); }
            if (st.queue.some(q => q.ready <= now)) b.append(this.btn('Collect', () => g.collectStation(key), 'primary'));
        } else b.append(h('p', { class: 'muted' }, 'Idle.'));
        b.append(h('h3', {}, 'Make'));
        S.recipes.forEach((R, idx) => {
            const one = !!g.plan(R.in), five = !!g.plan(R.in.map(([k, n]) => [k, n * 5]));
            b.append(this.row(R.out, `${R.n} × ${ITEM[R.out].name}`, h('div', {}, h('small', {}, `${Math.round(R.min * g.stationSpeed(key) / 60 * 10) / 10}h each`), this.ingList(R.in)), [this.btn('×1', () => g.refine(key, kind, idx, 1), 'primary', !one || st.queue.length >= 3), this.btn('×5', () => g.refine(key, kind, idx, 5), '', !five || st.queue.length >= 3)], one ? 'ok' : 'no'));
        });
    }

    // ------------------------------------------------------------ misc kinds
    tab_station(b) { if (this.kind === 'station') return this.tab_station_placed(b); const key = 'b:' + this.data.building; this.stationUI(b, key, BUILDING[this.data.building].station); }
    tab_chest(b) { const st = this.game.s.stations[this.data.key]; if (st) this.transfer(b, st.items, 24); }
    tab_storehouse(b) {
        const g = this.game, list = g.s.storehouse;
        b.append(h('p', { class: 'muted' }, 'Villagers leave their daily goods here, and job-board rewards arrive here.'));
        if (!list.length) b.append(h('p', {}, 'Empty.'));
        else b.append(this.btn('Take everything', () => { for (const e of list.slice()) g.takeFromStorehouse(e.id, e.n); }, 'primary'));
        for (const e of list.slice()) b.append(this.row(e.id, `${ITEM[e.id].name} ×${e.n}`, '', [this.btn('Take', () => g.takeFromStorehouse(e.id, e.n))]));
    }
    tab_ship(b) {
        const g = this.game, s = g.s;
        let total = 0; for (const e of s.ship) total += Math.round(ITEM[e.id].sell * e.n * g.shipMult());
        b.append(h('p', { class: 'muted' }, `Items in the bin are sold overnight${g.shipMult() > 1 ? ` (+${Math.round((g.shipMult() - 1) * 100)}%)` : ''}. Tap an item in your backpack to ship the whole stack.`));
        b.append(h('h3', {}, `In the bin — ${total}g`));
        for (const e of s.ship) b.append(this.row(e.id, `${ITEM[e.id].name} ×${e.n}`, `${Math.round(ITEM[e.id].sell * e.n * g.shipMult())}g`, [this.btn('Take back', () => g.unship(e.id))]));
        b.append(h('h3', {}, 'Backpack'));
        b.append(this.grid(s.inv, s.invSize, i => { const it = ITEM[s.inv[i]?.id]; if (!it) return; if (!it.sell || it.cat === 'tool' || it.key) { this.ui.toast("That can't be shipped."); return; } g.shipSlot(i); this.refresh(); }));
    }
    tab_build(b) {
        const g = this.game, lot = this.data.lot;
        b.append(h('p', { class: 'muted' }, `Lot ${lot + 1}. ${g.isResident('carpenter') ? 'The Carpenter takes 20% off.' : ''} Newcomers need their own building to move in.`));
        const types = BUILDINGS.slice().sort((a, b) => a.lvl - b.lvl);
        for (const B of types) {
            if (g.builtTypes().has(B.id)) continue;
            const chk = g.buildable(B.id), cost = g.buildingCost(B.id);
            const who = B.job ? (g.s.applicants.includes(B.job) ? `For ${g.people[B.job].name} the ${JOBS[B.job].name}.` : `For a ${JOBS[B.job].name}.`) : B.animals ? `Home for your ${B.animals === 'coop' ? 'birds' : 'livestock'}.` : B.greenhouse ? 'Grow any crop in any season.' : '';
            const sub = h('div', {}, h('small', {}, `${who} Level ${B.lvl}. ${chk.ok ? '' : '— ' + chk.why}`), this.ingList([...cost.items, ['gold', 0]].filter(x => x[0] !== 'gold')), h('small', {}, `${cost.gold} gold (have ${g.p.gold})`));
            const face = canvasEl(this.sp.building(B.id, {}), 32, 40);
            b.append(this.row(face, B.name, sub, [this.btn('Build', () => { if (g.build(lot, B.id)) this.close(); }, 'primary', !chk.ok)], chk.ok ? 'ok' : 'no'));
        }
    }
    tab_board(b) {
        const g = this.game, B = g.s.board;
        b.append(h('p', { class: 'muted' }, 'Take a job yourself, or send villagers — they’ll be away for a day or more and bring the reward to the Storehouse.'));
        if (B.taken.length) {
            b.append(h('h3', {}, 'Your jobs'));
            for (const t of B.taken) { const pr = g.postingProgress(t); b.append(this.row(t.item ?? null, t.title, `${pr.have}/${pr.need} · due day ${t.deadline} · ${t.reward.gold}g`, [this.btn('Turn in', () => g.turnIn(t.id), 'primary', !g.canTurnIn(t))], g.canTurnIn(t) ? 'ok' : '')); }
        }
        if (B.assigned.length) { b.append(h('h3', {}, 'Villagers out on jobs')); for (const a of B.assigned) b.append(this.row(null, a.title, `${a.jobs.map(j => g.people[j].name).join(' & ')} · back day ${a.until} · ${Math.round(a.chance * 100)}%`)); }
        b.append(h('h3', {}, "Today's postings"));
        if (!B.postings.length) b.append(h('p', { class: 'muted' }, 'Nothing new today. Check back tomorrow.'));
        for (const p of B.postings) {
            const items = (p.reward.items ?? []).map(([id, n]) => `${n} ${ITEM[id].name}`).join(', ');
            const sub = h('div', {}, h('small', {}, h('span', { class: 'stars' }, '★'.repeat(p.stars)), ` ${p.desc} Reward: ${p.reward.gold}g${items ? ', ' + items : ''}, +${p.reward.coz} coziness. ${p.villagerOnly ? '(Villagers only)' : p.playerOnly ? '(You only)' : ''}`));
            const btns = [];
            if (!p.villagerOnly) btns.push(this.btn('Take', () => g.takePosting(p.id), 'primary'));
            if (!p.playerOnly && g.availableHelpers().length) btns.push(this.btn('Assign…', () => { this.assigning = { id: p.id, jobs: [] }; }));
            b.append(this.row(p.item ?? null, p.title, sub, btns));
            if (this.assigning?.id === p.id) b.append(this.assignUI(p));
        }
    }
    assignUI(p) {
        const g = this.game, A = this.assigning;
        const d = h('div', { class: 'detail' });
        d.append(h('b', {}, 'Who should go? (pick 1 or 2)'));
        for (const j of g.availableHelpers()) {
            const on = A.jobs.includes(j);
            const fit = JOBS[j].questFit[p.type] ?? 1;
            d.append(this.row(canvasEl(this.sp.person(g.people[j].look, 0, 0), 28, 35), `${on ? '✔ ' : ''}${g.people[j].name}`, `${JOBS[j].name} Lv${g.s.villagers[j].level} · ${fit > 1.1 ? 'great fit' : fit < 0.95 ? 'poor fit' : 'ok fit'}`, [this.btn(on ? 'Remove' : 'Choose', () => { if (on) A.jobs = A.jobs.filter(x => x !== j); else if (A.jobs.length < 2) A.jobs.push(j); })]));
        }
        const ch = A.jobs.length ? Math.round(g.assignPreview(p.id, A.jobs) * 100) : 0;
        d.append(h('p', {}, A.jobs.length ? `Success chance: ${ch}%. They'll be back in ${postingDays(p)} day${postingDays(p) > 1 ? 's' : ''}.` : 'Choose someone.'));
        d.append(h('div', { class: 'btns' }, this.btn('Send them', () => { g.assignPosting(p.id, A.jobs); this.assigning = null; }, 'primary', !A.jobs.length), this.btn('Cancel', () => { this.assigning = null; })));
        return d;
    }
    tab_animals(b) {
        const g = this.game, home = this.data.home;
        const list = g.animalsIn(home);
        const ready = list.filter(a => a.ready).length;
        b.append(h('p', { class: 'muted' }, `Hay in the silo: ${g.s.hay}. Each animal eats one bale a night${g.isResident('rancher') ? ` — ${g.people.rancher.name} feeds them for you` : ''}. Pet them every day.`));
        const btns = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px' });
        btns.append(this.btn(`Collect goods (${ready})`, () => g.collectProduce(home), 'primary', !ready));
        btns.append(this.btn(`Add hay from bag (${g.count('hay')})`, () => g.addHayToSilo(99), '', !g.count('hay')));
        b.append(btns);
        if (!list.length) b.append(h('p', {}, g.isResident('rancher') ? `Empty. ${g.people.rancher.name} at the Ranch House sells animals.` : 'Empty. A Rancher could sell you animals.'));
        for (const a of list) b.append(this.row(canvasEl(this.sp.animal(a.kind, 0, false), 32), `${a.name} the ${ANIMALS[a.kind].name}`, h('small', {}, h('span', { class: 'hearts' }, '♥'.repeat(Math.round(a.love / 200)) + '♡'.repeat(5 - Math.round(a.love / 200))), a.ready ? ` · has ${ITEM[a.ready].name} for you` : ''), [this.btn(a.petted === g.day ? 'Petted ♥' : 'Pet', () => g.petAnimal(a.id), '', a.petted === g.day)]));
    }
    tab_greenhouse(b) {
        const g = this.game, gh = g.s.greenhouse;
        b.append(h('p', { class: 'muted' }, 'Twelve plots that never need watering and grow in any season.'));
        for (let k = 0; k < 12; k++) {
            const c = gh[k];
            if (!c) {
                const seeds = [...new Set(g.s.inv.slice(0, g.s.invSize).filter(s => s && ITEM[s.id].cat === 'seed').map(s => s.id))];
                b.append(this.row(null, `Plot ${k + 1} — empty`, seeds.length ? '' : 'No seeds in your backpack.', seeds.slice(0, 3).map(id => this.btn(`Plant ${CROP[ITEM[id].crop].name}`, () => g.greenhousePlant(k, id)))));
            } else {
                const C = CROP[c.id], ripe = c.age >= C.days;
                b.append(this.row(c.id, `Plot ${k + 1} — ${C.name}`, ripe ? 'Ready to harvest!' : `${C.days - c.age} day${C.days - c.age > 1 ? 's' : ''} to go`, [this.btn('Harvest', () => g.greenhouseHarvest(k), 'primary', !ripe)], ripe ? 'ok' : ''));
            }
        }
    }
    tab_gift(b) {
        const g = this.game, job = this.data.job, P = g.people[job];
        b.append(h('p', { class: 'muted' }, `What would ${P.name} like? Loved gifts make a big difference. Tap an item to give it.`));
        b.append(this.grid(g.s.inv, g.s.invSize, i => { const s = g.s.inv[i]; if (!s) return; const it = ITEM[s.id]; if (it.cat === 'tool' || it.key) { this.ui.toast("You can't give that."); return; } this.close(); g.giveGift(job, s.id); }));
    }
    tab_travel(b) {
        const g = this.game;
        const rings = g.p.fastTravel.map(id => g.world.glimmers[id]).filter(Boolean);
        b.append(h('p', { class: 'muted' }, 'Step through the ring to any other awakened fairy ring.'));
        for (const r of rings) {
            const name = r.region === 0 ? g.s.villageName : g.world.regions[r.region - 1].name;
            b.append(this.row(null, `Fairy ring — ${name}`, r.id === this.data.from ? 'You are here' : '', r.id === this.data.from ? [] : [this.btn('Travel', () => { this.close(); g.fastTravel(r.id); }, 'primary')]));
        }
    }
    tab_map(b) { this.ui.mapView(b); }
}
