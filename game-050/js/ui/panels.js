/**
 * panels.js — every modal panel: build list, building workshops (forge, alchemist,
 * mage tower, scriptorium…), hero (stats / gear / spells), library, quests, the
 * adventure (wings and their maps), pre-battle, results, away summary, help and menu.
 *
 * Panels never change the profile themselves: they call G.* actions, which update the
 * sim, save, play sounds and then refreshPanel().
 */

import { $, h, fmt, costView } from './dom.js';
import { RES_INFO, STATS, STAT_INFO, SPELLS, POTIONS, POTION_IDS, CLASSES, GEM_INFO, MANA, BLESSINGS, xpToNext, MAX_RANK } from '../sim/data.js';
import { BUILDINGS, BUILDING_IDS, isUnlocked, bLevel, levelCap, rate, capacity, capHours, forgeCost, forgeItemLevel, forgeLuck, potionUnlocked, carryLimit, rankCost, maxSpellRank, questSlots, canAfford, prodMult } from '../sim/town.js';
import { BOOKS, BOOK_BY_ID, bookMult, studyCost, studyReq, MAX_TIER, TIER_MULT } from '../sim/books.js';
import { SLOTS, SLOT_INFO, RARITIES, modLines, itemScore } from '../sim/items.js';
import { WINGS, openNodes } from '../sim/regions.js';
import { questProgress, questDone } from '../sim/quests.js';
import { MSPELLS, FAMILIES, MODS } from '../sim/monsters.js';
import { heroStats, wingMap, nodeState, monsterFor, shrineOptions, nodeEvent, canBuild, respecCost, rerollCost, freePlots } from '../sim/game.js';
import { costPips, spellText } from './hud.js';

let current = null;   // { render, opts, el }

export function panelOpen() { return !!current; }
export function panelName() { return current?.opts.name || null; }

export function openPanel(opts) {
    closePanel(true);
    const root = $('panel-root');
    const scrim = h('div.scrim', { onclick: () => { if (opts.dismiss !== false) closePanel(); } });
    const el = h('div.panel' + (opts.cls ? '.' + opts.cls : ''), { role: 'dialog', 'data-name': opts.name || '' });
    root.append(scrim, el);
    current = { opts, el, scrim, tab: opts.tab || (opts.tabs ? opts.tabs[0].id : null) };
    renderCurrent();
    return current;
}

function renderCurrent() {
    const c = current;
    if (!c) return;
    const { opts, el } = c;
    const prevBody = el.querySelector('.panel-body');
    const scroll = prevBody ? prevBody.scrollTop : 0;
    el.innerHTML = '';
    const head = h('div.panel-head',
        opts.icon ? h('span.ph-icon', opts.icon) : null,
        h('div', { style: { flex: 1 } }, h('h2', typeof opts.title === 'function' ? opts.title() : opts.title), opts.sub ? h('div.sub', typeof opts.sub === 'function' ? opts.sub() : opts.sub) : null),
        opts.dismiss === false ? null : h('button.panel-close', { 'aria-label': 'Close', onclick: () => closePanel() }, '✕'));
    el.append(head);
    if (opts.tabs) {
        el.append(h('div.tabs', opts.tabs.map((t) => h('button.tab' + (t.id === c.tab ? '.on' : ''), { onclick: () => { c.tab = t.id; renderCurrent(); } }, t.label))));
    }
    const body = h('div.panel-body');
    el.append(body);
    opts.render(body, c.tab);
    body.scrollTop = scroll;
    if (opts.foot) {
        const f = opts.foot();
        if (f && f.length) el.append(h('div.panel-foot', f));
    }
}

export function refreshPanel() { if (current) renderCurrent(); }

export function closePanel(silent) {
    if (!current) return;
    const c = current;
    current = null;
    c.el.remove(); c.scrim.remove();
    if (!silent) c.opts.onClose?.();
}

// ------------------------------------------------------------------ Shared views

function itemCard(G, it, actions = [], compareTo = null) {
    const p = G.profile;
    const rar = RARITIES[it.rarity];
    let delta = null;
    if (compareTo === null) {
        const eq = p.gear[it.slot];
        if (eq !== it) {
            const d = itemScore(it, p.cls) - itemScore(eq, p.cls);
            delta = h('span.delta.' + (d >= 0 ? 'up' : 'down'), d >= 0 ? `▲ ${Math.round(d)}` : `▼ ${Math.round(-d)}`);
        }
    }
    return h('div.tile.item', { style: { '--rc': rar.color } },
        h('div.row', h('span', SLOT_INFO[it.slot].icon), h('span.iname', it.name), delta),
        h('div.row', h('span.chip', rar.name), h('span.chip', `iLvl ${it.iL}`), h('span.chip.gold', `🪙 ${it.value}`)),
        h('ul', modLines(it.mods).map((l) => h('li', l))),
        actions.length ? h('div.row', actions) : null);
}

function resRow(obj) {
    return h('span.cost', Object.entries(obj).filter(([, v]) => v).map(([k, v]) => h('span', `${RES_INFO[k]?.icon || (k === 'xp' ? '⭐' : k)} ${fmt(v)}`)));
}

const btn = (label, onclick, cls = '', disabled = false) => h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick: disabled ? null : onclick, disabled }, label);

// ------------------------------------------------------------------ Build

export function buildPanel(G) {
    openPanel({
        name: 'build', icon: '🏗️', title: 'Build & Upgrade', cls: 'wide',
        sub: () => `Building level cap: ${levelCap(G.profile)} (return books to raise it) · Free plots: ${freePlots(G.profile).length}`,
        render(body) {
            const p = G.profile;
            const grid = h('div.grid');
            for (const id of BUILDING_IDS) {
                const def = BUILDINGS[id];
                const L = bLevel(p, id);
                const unlocked = isUnlocked(p, id);
                const c = canBuild(p, id);
                let req = '';
                if (!unlocked) req = def.unlock.level ? `Unlocks at hero level ${def.unlock.level}` : `Unlocks with ${BOOK_BY_ID[def.unlock.book].title}`;
                const tile = h('div.tile' + (unlocked ? '' : '.locked') + (c.ok ? '.ready' : ''),
                    h('h3', h('span.t-icon', def.icon), def.name, L ? h('span.chip.gold', `Lv ${L}`) : null),
                    h('p', def.desc),
                    unlocked ? h('div.row', costView(c.cost || {}, p.res, RES_INFO)) : h('p', '🔒 ' + req),
                    unlocked ? h('div.row',
                        L ? btn('Open', () => G.openBuilding(id), 'small ghost') : null,
                        L >= levelCap(p) ? h('span.chip', 'At level cap') : btn(L ? 'Upgrade' : 'Build', () => (L ? G.upgrade(id) : G.startPlacing(id)), 'small ' + (c.ok ? 'green' : ''), !c.ok)) : null);
                grid.append(tile);
            }
            body.append(grid);
        },
    });
}

// ------------------------------------------------------------------ Buildings

export function buildingPanel(G, id) {
    const def = BUILDINGS[id];
    openPanel({
        name: 'building:' + id, icon: def.icon, title: () => `${def.name} · Lv ${bLevel(G.profile, id)}`, sub: def.desc,
        render(body) {
            const p = G.profile;
            const L = bLevel(p, id);
            if (def.res) {
                const b = p.town[id];
                const r = rate(p, id), cap = capacity(p, id);
                const icon = def.res === 'xp' ? '⭐' : RES_INFO[def.res].icon;
                body.append(h('div.section-title', 'Production'),
                    h('div.kv', h('span', 'Rate'), h('b', `${icon} ${fmt(r * 60)} / hour`), h('span', 'Basket'), h('b', `${icon} ${fmt(b.basket)} / ${fmt(cap)}`), h('span', 'Stores up to'), h('b', `${capHours(p)} h`), h('span', 'Town bonus'), h('b', `+${Math.round((prodMult(p) - 1) * 100)}%`)),
                    h('div.bar', { style: { margin: '8px 0' } }, h('i', { style: { width: Math.min(100, (b.basket / Math.max(1, cap)) * 100) + '%' } })),
                    btn(`Collect ${icon} ${fmt(Math.floor(b.basket))}`, () => G.collect(id), 'green small', b.basket < 1));
            }
            const c = canBuild(p, id);
            body.append(h('div.section-title', 'Upgrade'),
                L >= levelCap(p) ? h('p.muted', `At the level cap (${levelCap(p)}). Return more books to the Library to raise it.`)
                    : h('div.row', costView(c.cost || {}, p.res, RES_INFO), ' ', btn(`Upgrade to Lv ${L + 1}`, () => G.upgrade(id), 'small green', !c.ok)));
            if (id === 'forge') forgeSection(G, body);
            if (id === 'alchemist') alchemistSection(G, body);
            if (id === 'magetower') towerSection(G, body);
            if (id === 'scriptorium') scriptoriumSection(G, body);
            if (id === 'guild') body.append(h('div.section-title', 'Guild'), h('p.muted', `Quest slots: ${questSlots(p)}. Quest rewards +${12 * L}%.`), btn('Open quests', () => questsPanel(G), 'small'));
            if (id === 'storehouse') body.append(h('div.section-title', 'Storage'), h('p.muted', `Buildings store ${capHours(p)} hours of production.`));
            if (id === 'clocktower') body.append(h('div.section-title', 'Clockwork'), h('p.muted', `All production +${Math.round((prodMult(p) - 1) * 100)}%.`));
        },
    });
}

function forgeSection(G, body) {
    const p = G.profile;
    const cost = forgeCost(p);
    body.append(h('div.section-title', 'Forge gear'),
        h('p.muted', `Forged items are item level ${forgeItemLevel(p)}. Higher Forge levels make rare items likelier (luck ${Math.round(forgeLuck(p) * 100)}).`),
        h('div.row', costView(cost, p.res, RES_INFO)),
        h('div.row', { style: { marginTop: '8px' } }, SLOTS.map((s) => btn(`${SLOT_INFO[s].icon} ${SLOT_INFO[s].name}`, () => G.craft(s), 'small', !canAfford(p, cost)))));
}

function alchemistSection(G, body) {
    const p = G.profile;
    body.append(h('div.section-title', `Potions (carry ${carryLimit(p)} into battle)`));
    const grid = h('div.grid');
    for (const id of POTION_IDS) {
        const d = POTIONS[id];
        const ok = potionUnlocked(p, id);
        grid.append(h('div.tile' + (ok ? '' : '.locked'),
            h('h3', h('span.t-icon', d.icon), d.name, h('span.chip.gold', `×${p.potions[id]}`)),
            h('p', d.desc),
            ok ? h('div.row', costView(d.cost, p.res, RES_INFO), btn('Brew', () => G.brew(id), 'small green', !canAfford(p, d.cost))) : h('p', `🔒 Alchemist level ${d.alch}`)));
    }
    body.append(grid);
}

function towerSection(G, body) {
    const p = G.profile;
    body.append(h('div.section-title', `Spell ranks (max rank ${maxSpellRank(p)} of ${MAX_RANK})`));
    const grid = h('div.grid');
    for (const [id, r] of Object.entries(p.spells)) {
        const def = SPELLS[id];
        const cost = rankCost(r);
        grid.append(h('div.tile',
            h('h3', h('span.t-icon', def.icon), def.name, h('span.chip.gold', `Rank ${r}`)),
            h('p', `Each rank: +15% power.`),
            r >= MAX_RANK ? h('span.chip', 'Max rank') : r >= maxSpellRank(p) ? h('p.muted', 'Upgrade the Mage Tower for the next rank.')
                : h('div.row', costView(cost, p.res, RES_INFO), btn('Rank up', () => G.rankUp(id), 'small green', !canAfford(p, cost)))));
    }
    body.append(grid);
}

function scriptoriumSection(G, body) {
    const p = G.profile;
    body.append(h('div.section-title', 'Study the rescued books'));
    const grid = h('div.grid');
    for (const b of BOOKS) {
        const t = p.books[b.id];
        if (!t) continue;
        const next = t + 1;
        const cost = next <= MAX_TIER ? studyCost(b, next) : null;
        const lvlOk = next <= MAX_TIER && bLevel(p, 'scriptorium') >= studyReq(next);
        grid.append(h('div.tile',
            h('h3', h('span.t-icon', b.icon), b.title),
            h('p', `Tier ${t}: ${b.bonus(TIER_MULT[t])}`),
            next > MAX_TIER ? h('span.chip.gold', 'Fully studied') : !lvlOk ? h('p.muted', `Tier ${next} needs Scriptorium level ${studyReq(next)}.`)
                : h('div', h('p', `Tier ${next}: ${b.bonus(TIER_MULT[next])}`), h('div.row', costView(cost, p.res, RES_INFO), btn('Study', () => G.study(b.id), 'small green', !canAfford(p, cost))))));
    }
    if (!grid.children.length) grid.append(h('p.muted', 'No books rescued yet.'));
    body.append(grid);
}

// ------------------------------------------------------------------ Hero

export function heroPanel(G, tab) {
    openPanel({
        name: 'hero', icon: CLASSES[G.profile.cls].icon, cls: 'wide', tab,
        title: () => `${G.profile.name} the ${CLASSES[G.profile.cls].name}`,
        sub: () => `Level ${G.profile.level} · XP ${fmt(G.profile.xp)} / ${fmt(xpToNext(G.profile.level))}`,
        tabs: [{ id: 'stats', label: '📊 Stats' }, { id: 'gear', label: '🎒 Gear' }, { id: 'spells', label: '📖 Spells' }],
        render(body, tabId) {
            const p = G.profile;
            const hs = heroStats(p);
            if (tabId === 'stats') {
                body.append(h('div.split',
                    h('div',
                        h('div.section-title', p.points ? `Stat points: ${p.points}` : 'Stats'),
                        STATS.map((s) => h('div.stat-row', h('span', STAT_INFO[s].icon), h('span', h('b', STAT_INFO[s].name), h('div.muted', STAT_INFO[s].desc)), h('span.sv', String(hs.stats[s])), h('button.plus', { disabled: !p.points, onclick: () => G.allocate(s), 'aria-label': 'Add point to ' + STAT_INFO[s].name }, '+'))),
                        h('div.row', { style: { marginTop: '10px' } }, btn('Auto-assign', () => G.autoAllocate(), 'small', !p.points), btn(`Reset (🪙 ${respecCost(p)})`, () => G.respec(), 'small ghost', p.res.gold < respecCost(p)))),
                    h('div',
                        h('div.section-title', 'In battle'),
                        h('div.kv',
                            h('span', '❤️ Max HP'), h('b', String(hs.maxHp)),
                            h('span', '💀 Damage per skull'), h('b', String(Math.round(hs.skullDmg * 10) / 10)),
                            h('span', '✨ Spell power'), h('b', `×${Math.round(hs.spellPower * 100) / 100}`),
                            h('span', '🔮 Mana capacity'), h('b', String(hs.manaCap)),
                            h('span', '🎯 Skull crit'), h('b', `${Math.round(hs.crit * 1000) / 10}%`),
                            h('span', '🛡 Ward'), h('b', `${Math.round(hs.ward * 100)}%`),
                            hs.lifesteal ? [h('span', '🩸 Lifesteal'), h('b', `${Math.round(hs.lifesteal * 100)}%`)] : null,
                            hs.thorns ? [h('span', '🌵 Thorns'), h('b', String(hs.thorns))] : null,
                            hs.haste ? [h('span', '🐇 Extra-turn chance'), h('b', `${Math.round(hs.haste * 1000) / 10}%`)] : null,
                            h('span', '🪙 Gold bonus'), h('b', `+${Math.round((hs.goldMult - 1) * 100)}%`),
                            h('span', '⭐ XP bonus'), h('b', `+${Math.round((hs.xpMult - 1) * 100)}%`),
                            p.cls === 'mage' ? [h('span', '🧊 Mana Ward (start shield)'), h('b', String(Math.round(hs.maxHp * 0.2)))] : null),
                        p.blessings.length ? [h('div.section-title', 'Blessings'), h('div.row', p.blessings.map((b) => h('span.chip.green', `${BLESSINGS[b.id].icon} ${BLESSINGS[b.id].name} (${b.left})`)))] : null)));
            } else if (tabId === 'gear') {
                body.append(h('div.section-title', 'Equipped'));
                const eq = h('div.grid');
                for (const s of SLOTS) {
                    const it = p.gear[s];
                    eq.append(it ? itemCard(G, it, [btn('Unequip', () => G.unequip(s), 'small ghost')], undefined) : h('div.tile', h('h3', SLOT_INFO[s].icon, SLOT_INFO[s].name), h('div.slot-empty', 'Empty')));
                }
                body.append(eq);
                body.append(h('div.section-title', `Bag (${p.bag.length})`));
                if (p.bag.length) body.append(h('div.row', { style: { marginBottom: '8px' } }, btn('Sell everything worse than equipped', () => G.sellWorse(), 'small ghost')));
                const bag = h('div.grid');
                const sorted = p.bag.slice().sort((a, b) => itemScore(b, p.cls) - itemScore(a, p.cls));
                for (const it of sorted) bag.append(itemCard(G, it, [btn('Equip', () => G.equip(it.uid), 'small green'), btn(`Sell 🪙${it.value}`, () => G.sell(it.uid), 'small ghost')], null));
                if (!p.bag.length) bag.append(h('p.muted', 'Your bag is empty. Monsters, chests, quests and the Forge all drop gear.'));
                body.append(bag);
            } else {
                body.append(h('div.section-title', `Spell slots: ${p.slots.length} / ${hs.slots}`), h('p.muted', 'Tap a spell to equip or unequip it. Equipped spells come with you into battle.'));
                const grid = h('div.grid');
                const all = Object.keys(SPELLS).filter((id) => SPELLS[id].cls === p.cls || SPELLS[id].cls === 'book');
                for (const id of all) {
                    const def = SPELLS[id];
                    const known = !!p.spells[id];
                    const slotted = p.slots.includes(id);
                    const fake = { spellPower: hs.spellPower, fireBoost: hs.fireBoost };
                    grid.append(h('button.tile.spell' + (known ? '.click' : '.locked') + (slotted ? '.slotted' : ''), { onclick: known ? () => G.toggleSlot(id) : null },
                        h('span.s-icon', def.icon),
                        h('span', h('h3', def.name, known ? h('span.chip', `Rank ${p.spells[id]}`) : null, slotted ? h('span.chip.gold', 'Equipped') : null),
                            h('p', known ? spellText(def, fake, p.spells[id]) : def.cls === 'book' ? '🔒 Taught by a lost book' : `🔒 Learn at level ${def.lvl}`),
                            h('div.row', costPips(def.cost), def.quick ? h('span.chip.green', '⚡ Quick') : null))));
                }
                body.append(grid);
            }
        },
    });
}

// ------------------------------------------------------------------ Library

export function libraryPanel(G) {
    openPanel({
        name: 'library', icon: '📚', title: 'The Great Library', cls: 'wide',
        sub: () => `${Object.keys(G.profile.books).length} of ${BOOKS.length} books returned · building level cap ${levelCap(G.profile)}`,
        render(body) {
            const p = G.profile;
            const shelf = h('div.shelf');
            for (const b of BOOKS) {
                const t = p.books[b.id];
                const w = WINGS[b.wing];
                if (t) {
                    shelf.append(h('button.book', { style: { '--bc': b.color }, onclick: () => G.readBook(b.id) },
                        h('span.b-icon', b.icon), h('span.b-title', b.title), h('span.b-tier', '★'.repeat(t) + '☆'.repeat(MAX_TIER - t)), h('span.b-bonus', b.bonus(TIER_MULT[t]))));
                } else {
                    shelf.append(h('div.book.missing', h('span.b-icon', '❔'), h('span.b-title', '???'), h('span.b-bonus', `Held by the ${b.at === 'final' ? 'Unwriter' : b.at === 'keeper' ? 'Keeper' : 'Guardian'} of ${w.name}`)));
                }
            }
            body.append(h('p.muted', { style: { marginBottom: '10px' } }, 'Each returned book grants a permanent bonus and raises every building\'s level cap by one. Study books at the Scriptorium to make them stronger. Tap a book to read it.'), shelf);
        },
    });
}

// ------------------------------------------------------------------ Quests

export function questsPanel(G) {
    openPanel({
        name: 'quests', icon: '📜', title: 'Quest Board',
        sub: () => `${G.profile.quests.active.length} quests · ${questSlots(G.profile)} slots (Guild Hall adds more)`,
        render(body) {
            const p = G.profile;
            const grid = h('div.grid');
            for (const q of p.quests.active) {
                const prog = questProgress(p, q);
                const done = questDone(p, q);
                const reward = { gold: q.reward.gold, xp: q.reward.xp };
                for (const r of ['wood', 'stone', 'herbs', 'crystal']) if (q.reward[r]) reward[r] = q.reward[r];
                grid.append(h('div.tile' + (done ? '.ready' : ''),
                    h('h3', h('span.t-icon', q.icon), q.title),
                    h('p', q.desc),
                    h('div.bar', h('i', { style: { width: (prog / q.target) * 100 + '%' } })),
                    h('div.row', h('span.chip', `${prog} / ${q.target}`), resRow(reward), q.reward.item ? h('span.chip.gold', '🎁 Gear') : null, q.reward.potion ? h('span.chip.gold', POTIONS[q.reward.potion].icon) : null),
                    h('div.row',
                        done ? btn('Claim!', () => G.claim(q.id), 'small primary') : null,
                        q.kind === 'bounty' && !done ? btn('🎯 Hunt', () => G.hunt(q.id), 'small pink') : null,
                        !done ? btn(`Swap (🪙${rerollCost(p)})`, () => G.reroll(q.id), 'small ghost', p.res.gold < rerollCost(p)) : null)));
            }
            body.append(grid);
        },
    });
}

// ------------------------------------------------------------------ Adventure

export function adventurePanel(G) {
    openPanel({
        name: 'adventure', icon: '🗺️', title: 'The Library Wings', cls: 'wide',
        sub: 'Choose a wing. Each holds two lost books.',
        render(body) {
            const p = G.profile;
            const grid = h('div.wings');
            WINGS.forEach((w, i) => {
                const open = i <= p.wingOpen;
                const books = BOOKS.filter((b) => b.wing === i);
                const got = books.filter((b) => p.books[b.id]).length;
                const card = h('button.wing-card' + (open ? '' : '.locked') + (i === p.wingOpen && !p.won ? '.current' : ''),
                    { style: { background: `linear-gradient(160deg, ${w.sky[0]}, ${w.sky[1]})` }, onclick: open ? () => wingPanel(G, i) : null },
                    h('span.w-icon', open ? w.icon : '🔒'), h('span.w-name', w.name),
                    h('span.w-sub', w.final ? `Level ${w.lo}` : `Levels ${w.lo}–${w.hi}`),
                    h('span.w-sub', books.map((b) => (p.books[b.id] ? b.icon : '❔')).join(' '), ` ${got}/${books.length}`));
                grid.append(card);
            });
            body.append(grid);
            if (p.won) body.append(h('div.section-title', 'The Endless Stacks'), h('p.muted', `Floor ${p.endless.floor} · best ${p.endless.best}. Monsters grow stronger forever; rewards too.`), btn(`Descend to floor ${p.endless.floor}`, () => G.endless(), 'pink'));
        },
    });
}

const NODE_ICON = { battle: '⚔️', elite: '💀', treasure: '🎁', shrine: '⛩️', event: '❓', keeper: '📕', guardian: '📘', final: '✒️' };
const NODE_NAME = { battle: 'Battle', elite: 'Elite', treasure: 'Treasure', shrine: 'Shrine', event: 'Event', keeper: 'Keeper', guardian: 'Guardian', final: 'The Unwriter' };

export function wingPanel(G, wi) {
    const w = WINGS[wi];
    openPanel({
        name: 'wing:' + wi, icon: w.icon, title: w.name, sub: w.blurb,
        render(body) {
            const p = G.profile;
            const map = wingMap(p, wi);
            const rows = map.rows;
            const Wd = 360, Hd = Math.max(180, rows * 82 + 46);
            const pos = (n) => ({ x: 30 + n.x * (Wd - 60), y: Hd - 52 - n.row * 82 });
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
            svg.classList.add('map-svg');
            const defs = document.createElementNS(svgNS, 'defs');
            defs.innerHTML = `<linearGradient id="mapbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w.sky[0]}"/><stop offset="1" stop-color="${w.sky[1]}"/></linearGradient>`;
            svg.append(defs);
            const bg = document.createElementNS(svgNS, 'rect');
            Object.entries({ x: 0, y: 0, width: Wd, height: Hd, rx: 18, fill: 'url(#mapbg)' }).forEach(([k, v]) => bg.setAttribute(k, v));
            svg.append(bg);
            const open = openNodes(map, p.wings[wi].cleared);
            for (const n of map.nodes) for (const c of n.next) {
                const a = pos(n), b = pos(map.nodes[c]);
                const l = document.createElementNS(svgNS, 'path');
                l.setAttribute('d', `M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y}`);
                l.setAttribute('stroke', p.wings[wi].cleared[n.id] ? '#fff' : 'rgba(255,255,255,0.45)');
                l.setAttribute('stroke-width', p.wings[wi].cleared[n.id] ? 5 : 3);
                l.setAttribute('stroke-dasharray', p.wings[wi].cleared[n.id] ? '' : '6 6');
                l.setAttribute('fill', 'none');
                l.setAttribute('stroke-linecap', 'round');
                svg.append(l);
            }
            for (const n of map.nodes) {
                const st = nodeState(p, wi, n.id);
                const { x, y } = pos(n);
                const g = document.createElementNS(svgNS, 'g');
                g.classList.add('node-btn');
                g.setAttribute('data-node', n.id);
                g.setAttribute('role', 'button');
                g.setAttribute('tabindex', '0');
                const big = n.kind === 'keeper' || n.kind === 'guardian' || n.kind === 'final';
                const r = big ? 30 : 24;
                const circ = document.createElementNS(svgNS, 'circle');
                Object.entries({ cx: x, cy: y, r, fill: st === 'cleared' ? '#46e07a' : st === 'open' ? '#ffdd55' : 'rgba(40,20,80,0.55)', stroke: st === 'open' ? '#fff' : 'rgba(255,255,255,0.6)', 'stroke-width': st === 'open' ? 4 : 2 }).forEach(([k, v]) => circ.setAttribute(k, v));
                if (st === 'open') { const an = document.createElementNS(svgNS, 'animate'); an.setAttribute('attributeName', 'r'); an.setAttribute('values', `${r};${r + 4};${r}`); an.setAttribute('dur', '1.2s'); an.setAttribute('repeatCount', 'indefinite'); circ.append(an); }
                g.append(circ);
                const t = document.createElementNS(svgNS, 'text');
                Object.entries({ x, y: y + (big ? 10 : 8), 'text-anchor': 'middle', 'font-size': big ? 28 : 22 }).forEach(([k, v]) => t.setAttribute(k, v));
                t.textContent = st === 'cleared' && !big ? '✔' : NODE_ICON[n.kind];
                if (st === 'locked') t.setAttribute('opacity', '0.55');
                g.append(t);
                const lv = document.createElementNS(svgNS, 'text');
                Object.entries({ x, y: y + r + 14, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#fff', stroke: 'rgba(0,0,0,0.5)', 'stroke-width': 3, 'paint-order': 'stroke' }).forEach(([k, v]) => lv.setAttribute(k, v));
                lv.textContent = ['battle', 'elite', 'keeper', 'guardian', 'final'].includes(n.kind) ? `${NODE_NAME[n.kind]} · Lv ${n.level + (n.kind === 'guardian' ? 1 : 0)}` : NODE_NAME[n.kind];
                g.append(lv);
                if (st === 'open') g.addEventListener('click', () => G.enterNode(wi, n.id));
                svg.append(g);
            }
            body.append(h('div.map-wrap', svg),
                h('div.map-legend', h('span', '⚔️ battle'), h('span', '💀 elite'), h('span', '🎁 treasure'), h('span', '⛩️ shrine'), h('span', '❓ event'), h('span', '📕📘 book keepers')),
                w.final ? null : h('div.row', { style: { marginTop: '10px', justifyContent: 'center' } }, btn('🔁 Patrol (fight a wandering monster)', () => G.patrol(wi), 'small')));
            void rows; void open;
        },
        foot: () => [btn('← All wings', () => adventurePanel(G), 'small ghost')],
    });
}

// ------------------------------------------------------------------ Pre-battle

export function preBattlePanel(G, ctx) {
    const p = G.profile;
    const mon = monsterFor(p, ctx);
    const s = mon.side;
    const hideWeak = !p.books.bestiary;
    openPanel({
        name: 'prebattle', icon: mon.boss ? '👑' : mon.rank === 'elite' ? '⭐' : '⚔️', title: mon.name,
        sub: `Level ${mon.level} ${mon.rank === 'normal' ? '' : mon.rank[0].toUpperCase() + mon.rank.slice(1) + ' '}${FAMILIES[mon.family].name}${mon.mods.length ? ' · ' + mon.mods.map((m) => MODS[m].name).join(', ') : ''}`,
        render(body) {
            const carry = carryLimit(p);
            const loadN = Object.values(p.loadout).reduce((a, b) => a + b, 0);
            body.append(h('div.foe-preview',
                h('div',
                    h('div.section-title', 'The foe'),
                    h('div.kv', h('span', '❤️ HP'), h('b', String(s.maxHp)), h('span', '💀 Per skull'), h('b', String(s.skullDmg)), s.shield ? [h('span', '🛡 Shield'), h('b', String(s.shield))] : null,
                        h('span', 'Weak to'), h('b', hideWeak ? '???' : `${GEM_INFO[MANA.indexOf(s.weak)].icon} ${GEM_INFO[MANA.indexOf(s.weak)].name}`),
                        h('span', 'Resists'), h('b', hideWeak ? '???' : `${GEM_INFO[MANA.indexOf(s.resist)].icon} ${GEM_INFO[MANA.indexOf(s.resist)].name}`),
                        h('span', 'Rewards'), h('b', `⭐ ${mon.xp} · 🪙 ${mon.gold}`)),
                    h('div.section-title', 'Its spells'),
                    s.spells.map((sp) => { const d = MSPELLS[sp.id]; return h('div.tile', { style: { marginBottom: '6px', padding: '8px' } }, h('div.row', h('b', `${d.icon} ${d.name}`), costPips(d.cost)), h('p', spellText(d, s, 1))); })),
                h('div',
                    h('div.section-title', `Potions (${loadN}/${carry})`),
                    POTION_IDS.filter((id) => p.potions[id] > 0).length ? POTION_IDS.filter((id) => p.potions[id] > 0).map((id) => h('div.row', { style: { marginBottom: '6px' } },
                        h('span', { style: { fontSize: '22px' } }, POTIONS[id].icon), h('span', { style: { flex: 1 } }, `${POTIONS[id].name} (have ${p.potions[id]})`),
                        h('button.mini', { onclick: () => G.setLoad(id, -1) }, '−'), h('b', String(p.loadout[id] || 0)), h('button.mini', { onclick: () => G.setLoad(id, 1) }, '+'))) : h('p.muted', 'No potions. Brew them at the Alchemist.'),
                    h('div.section-title', 'Spells'),
                    h('div.row', p.slots.map((id) => h('span.chip', `${SPELLS[id].icon} ${SPELLS[id].name}`))),
                    h('p.muted', { style: { marginTop: '6px' } }, 'Change spells and gear from the Hero screen.'),
                    p.blessings.length ? h('div.row', { style: { marginTop: '6px' } }, p.blessings.map((b) => h('span.chip.green', `${BLESSINGS[b.id].icon} ${BLESSINGS[b.id].name}`))) : null)));
        },
        foot: () => [btn('🧙 Hero', () => heroPanel(G, 'spells'), 'small ghost'), btn('⚔️ Fight!', () => G.fight(ctx), 'primary big')],
    });
}

// ------------------------------------------------------------------ Results

export function resultPanel(G, run, out, onDone) {
    const win = out.win;
    openPanel({
        name: 'result', icon: win ? '🏆' : '💫', title: win ? 'Victory!' : 'Knocked out!', dismiss: false,
        sub: win ? `${run.mon.name} is defeated.` : 'You wake up back in town, a little embarrassed. Half the loot you grabbed came with you.',
        render(body) {
            body.append(h('div.row', { style: { justifyContent: 'center', gap: '24px', fontSize: '22px', fontWeight: 900 } }, h('span', `⭐ +${out.xp} XP`), h('span', `🪙 +${out.gold} gold`)));
            if (out.book) {
                const b = BOOK_BY_ID[out.book];
                body.append(h('div.section-title', 'A lost book returns!'), h('div.shelf', h('div.book', { style: { '--bc': b.color, minHeight: '120px' } }, h('span.b-icon', b.icon), h('span.b-title', b.title), h('span.b-bonus', b.bonus(1)))));
            }
            for (const u of out.ups) body.append(h('div.tile.ready', { style: { marginTop: '10px' } }, h('h3', '🎉 Level ', String(u.level), '!'), h('p', `+3 stat points${u.spells.length ? ' · New spell: ' + u.spells.map((id) => SPELLS[id].name).join(', ') : ''}${u.buildings.length ? ' · New building: ' + u.buildings.map((id) => BUILDINGS[id].name).join(', ') : ''}`)));
            if (out.items.length) { body.append(h('div.section-title', 'Loot')); for (const it of out.items) body.append(itemCard(G, it, [], null)); }
            if (out.sold.length) body.append(h('p.muted', `Bag full — auto-sold ${out.sold.map((i) => i.name).join(', ')}.`));
            if (!win) body.append(h('div.section-title', 'Tips'), h('p.muted', 'Spend stat points, equip better gear, brew healing potions, rank up spells — or patrol the wing for XP first.'));
        },
        foot: () => [btn('Continue', () => { closePanel(true); onDone(); }, 'primary big')],
    });
}

export function rewardPanel(G, title, icon, lines, item, onDone) {
    openPanel({
        name: 'reward', icon, title, dismiss: false,
        render(body) {
            for (const l of lines) body.append(h('p', { style: { fontSize: '17px', fontWeight: 800, margin: '6px 0' } }, l));
            if (item) body.append(itemCard(G, item, [], null));
        },
        foot: () => [btn('Nice!', () => { closePanel(true); onDone?.(); }, 'primary')],
    });
}

export function shrinePanel(G, wi, id) {
    const opts = shrineOptions(G.profile, wi, id);
    openPanel({
        name: 'shrine', icon: '⛩️', title: 'A Quiet Shrine', sub: 'Choose one blessing. It lasts for your next 4 battles.',
        render(body) {
            body.append(h('div.grid', opts.map((b) => h('button.tile.click', { onclick: () => G.bless(wi, id, b) }, h('h3', h('span.t-icon', BLESSINGS[b].icon), BLESSINGS[b].name), h('p', BLESSINGS[b].desc)))));
        },
    });
}

export function eventPanel(G, wi, id) {
    const ev = nodeEvent(G.profile, wi, id);
    openPanel({
        name: 'event', icon: ev.icon, title: ev.title,
        render(body) {
            body.append(h('p', { style: { fontSize: '16px', lineHeight: 1.5, marginBottom: '12px' } }, ev.text));
            body.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, ev.choices.map((c, i) => btn(c.label, () => G.choose(wi, id, i), i ? 'ghost' : ''))));
        },
    });
}

// ------------------------------------------------------------------ Misc

export function awayPanel(G, summary, onDone) {
    const p = G.profile;
    const mins = Math.round(summary.minutes);
    openPanel({
        name: 'away', icon: '🌙', title: 'While you were away…',
        sub: `${mins >= 120 ? Math.floor(mins / 60) + ' hours ' : ''}${mins % 60 || mins < 120 ? (mins % 60) + ' minutes' : ''} passed in Lumenhall.`,
        render(body) {
            const grid = h('div.grid');
            for (const [id, n] of Object.entries(summary.gained)) {
                const r = BUILDINGS[id].res;
                grid.append(h('div.tile', h('h3', h('span.t-icon', BUILDINGS[id].icon), BUILDINGS[id].name), h('p', `${r === 'xp' ? '⭐' : RES_INFO[r].icon} +${fmt(n)}${(p.town[id].basket >= capacity(p, id) - 1) ? ' (basket full!)' : ''}`)));
            }
            body.append(grid);
        },
        foot: () => [btn('🧺 Collect all', () => { closePanel(true); G.collectAll(); onDone?.(); }, 'primary')],
        onClose: onDone,
    });
}

export function helpPanel(onClose) {
    openPanel({
        name: 'help', icon: '❓', title: 'How to Play', cls: 'wide', onClose,
        render(body) {
            body.append(h('div.help',
                h('h3', '💎 Gem duels'),
                h('p', 'You and a monster take turns on the same board. Swap two neighbouring gems to make a line of 3 or more. Every gem you match is one the monster can\'t have!'),
                h('div.gem-legend', GEM_INFO.slice(0, 7).map((g, i) => h('div', `${g.icon} `, h('b', g.name), ' — ', ['Fire mana', 'Water mana', 'Leaf mana', 'Spark mana', 'Damage!', 'Gold', 'Experience'][i]))),
                h('ul', h('li', 'Match 4 or more → an extra turn.'), h('li', '4 in a line → a Line gem (clears its row or column). L or T shape → a Bomb (3×3). 5 in a line → a Prism: swap it with any gem to clear every gem of that type.'),
                    h('li', 'Spend mana on spells (they glow when ready). Most spells end your turn; ⚡ Quick spells and potions don\'t.'),
                    h('li', 'Monsters are weak to one colour and resist another. The Bestiary of Bright Beasts reveals which.')),
                h('h3', '🏡 The village'),
                h('ul', h('li', 'Buildings work in real time — even while the game is closed. Tap the bubbles (or 🧺 Collect) to gather.'),
                    h('li', 'Gold, wood and stone build and upgrade buildings. Higher hero levels and returned books unlock new ones.'),
                    h('li', 'The Forge makes gear, the Alchemist brews potions, the Mage Tower ranks up spells, the Training Yard trains you, the Scriptorium studies books.')),
                h('h3', '📚 The lost books'),
                h('ul', h('li', 'Each wing of the Library hides two books, held by its Keeper and its Guardian.'), h('li', 'Every book returned grants a permanent bonus and raises the building level cap.'), h('li', 'Recover all thirteen to face the Unwriter.')),
                h('h3', '🎮 Controls'),
                h('ul', h('li', 'Drag or swipe a gem, or tap two neighbours.'), h('li', 'Keys: 1–5 spells · Q/W/E potions · H hint · Esc menu · A adventure · B build · C hero · L library · E collect.'))));
        },
    });
}

export function confirmPanel(title, text, yes, onYes) {
    openPanel({
        name: 'confirm', icon: '❔', title, cls: 'narrow',
        render(body) { body.append(h('p', text)); },
        foot: () => [btn('Cancel', () => closePanel(), 'ghost small'), btn(yes, () => { closePanel(true); onYes(); }, 'pink small')],
    });
}

export function menuPanel(G) {
    const inBattle = G.mode === 'battle';
    openPanel({
        name: 'menu', icon: '⚙', title: inBattle ? 'Battle Menu' : 'Menu', cls: 'narrow',
        render(body) {
            const S = G.settings;
            body.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                btn(`Sound: ${S.sound ? 'On' : 'Off'}`, () => G.toggleSetting('sound'), 'ghost'),
                btn(`Music: ${S.music ? 'On' : 'Off'}`, () => G.toggleSetting('music'), 'ghost'),
                btn(`Graphics: ${['High', 'Medium', 'Low'][G.quality()]}`, () => G.cycleQuality(), 'ghost'),
                btn('How to play', () => helpPanel(), 'ghost'),
                inBattle ? btn('🏳️ Retreat to town', () => confirmPanel('Retreat?', 'Leave this battle? It counts as a loss (you keep half the loot you picked up).', 'Retreat', () => G.retreat()), 'pink') : null,
                !inBattle ? btn('Back to title', () => G.toTitle(), 'ghost') : null,
                !inBattle ? btn('Delete save…', () => confirmPanel('Delete your save?', 'This erases your hero, your village and every rescued book. It cannot be undone.', 'Delete', () => G.deleteSave()), 'ghost') : null));
        },
    });
}

export function createPanel(G) {
    let cls = 'mage';
    let name = '';
    openPanel({
        name: 'create', icon: '✨', title: 'A New Hero', dismiss: false,
        sub: 'Fresh from the Academy, ready to rescue some books.',
        render(body) {
            body.append(h('div.grid', Object.values(CLASSES).map((c) => h('button.tile.click' + (cls === c.id ? '.ready' : ''), { onclick: () => { cls = c.id; refreshPanel(); } },
                h('h3', h('span.t-icon', c.icon), c.name, cls === c.id ? h('span.chip.green', 'Chosen') : null), h('p', c.blurb),
                h('p', c.id === 'mage' ? 'Starts with Firebolt and Frost Ward. Begins every battle behind a Mana Ward shield.' : 'Starts with Cleave and Second Wind. Big skull damage and lots of HP.')))));
            const input = h('input', { type: 'text', maxLength: 16, placeholder: CLASSES[cls].startName, value: name, style: { width: '100%', minHeight: '48px', marginTop: '14px', borderRadius: '14px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '18px', padding: '8px 14px', fontFamily: 'inherit', userSelect: 'text' }, oninput: (e) => { name = e.target.value; } });
            body.append(h('div.section-title', { style: { marginTop: '14px' } }, 'Your name'), input);
        },
        foot: () => [btn('Begin the adventure!', () => G.newGame(cls, name.trim() || CLASSES[cls].startName), 'primary big')],
    });
}

export function bookPanel(G, id) {
    const b = BOOK_BY_ID[id];
    const t = G.profile.books[id];
    openPanel({
        name: 'book', icon: b.icon, title: b.title, cls: 'narrow',
        render(body) {
            body.append(h('p', { style: { fontSize: '16px', lineHeight: 1.5, fontStyle: 'italic' } }, b.blurb),
                h('div.section-title', `Tier ${t}`), h('p', b.bonus(TIER_MULT[t])),
                t < MAX_TIER ? h('p.muted', `Study it at the Scriptorium (level ${studyReq(t + 1)}) for: ${b.bonus(TIER_MULT[t + 1])}`) : null);
        },
        foot: () => [btn('Back to the shelves', () => libraryPanel(G), 'small ghost')],
    });
}

export { bookMult };
