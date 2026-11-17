// The DOM: screens (title, the chapter map, cauldron, skills, journal, shop, level brief, result,
// pause, settings, how to play, the ending), the level HUD and tool bar, banners, toasts, and the
// visual-novel dialog with the fal portraits. Reads the game, never changes it: every change goes
// through the callbacks main.js passes in.

import { N } from './config.js';
import { SHAPES, SHAPE_IDS, RARITY_TIER, CAULDRONS, sizeOf } from './sim/data/shapes.js';
import { ELEMENTS, ELEMENT_IDS } from './sim/data/elements.js';
import { ITEMS, POTIONS, ENHANCEMENTS, GRADE_NAMES } from './sim/data/potions.js';
import { SKILLS, SKILL_IDS } from './sim/data/skills.js';
import { FOES } from './sim/data/foes.js';
import { CHARACTERS, SCRIPTS } from './sim/data/story.js';
import { NODE_META } from './sim/map.js';
import { progress, itemUsable, skillUsable, has, live } from './sim/level.js';
import { choices, nodeOf, canLearn, canTrain, canAfford } from './sim/game.js';
import { ITEM_KEYS } from './play.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHAPTER_NAMES = { 1: 'The Cracked Cauldron', 2: 'The Tin Cauldron', 3: 'The Brass Cauldron' };
export const chapterName = (ch) => CHAPTER_NAMES[ch] || `The Open Road ${ch - 3}`;
const KIND_NAMES = { explore: 'Exploration', refine: 'Refinement', battle: 'Battle' };
const ITEM_KEY = Object.fromEntries(Object.entries(ITEM_KEYS).map(([k, v]) => [v, k.slice(5)]));

export class UI {
    constructor({ audio, art, settings, onSettings, onDelete, onItem, onSkill }) {
        this.audio = audio;
        this.art = art;
        this.settings = settings;
        this.stack = [];
        this.onItem = onItem;
        this.onSkill = onSkill;
        this.hudKey = '';
        this.toolKey = '';
        this.dlg = null;

        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeScreen(b.closest('.screen').id); });
        }
        $('set-sfx').value = settings.sfx;
        $('set-music').value = settings.music;
        $('set-calm').value = settings.calm;
        const changed = () => {
            settings.sfx = +$('set-sfx').value;
            settings.music = +$('set-music').value;
            settings.calm = $('set-calm').value;
            onSettings(settings);
        };
        for (const id of ['set-sfx', 'set-music', 'set-calm']) $(id).addEventListener('input', changed);
        $('set-delete').addEventListener('click', () => {
            if (!confirm('Forget this apprenticeship? Your cauldron, skills, stores and story will be lost.')) return;
            onDelete();
            this.toast('Apprenticeship forgotten.');
        });
        $('tools').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.item) this.onItem(b.dataset.item);
            else if (b.dataset.skill) this.onSkill(b.dataset.skill);
        });
        $('dialog').addEventListener('click', (e) => { if (!e.target.closest('button')) this.dlgNext(); });
    }

    // ------------------------------------------------------------------ screens

    openScreen(id) {
        const el = $(id);
        if (!el) return;
        if (!this.stack.includes(id)) this.stack.push(id);
        el.hidden = false;
        el.scrollTop = 0;
        const first = el.querySelector('.btn.primary:not([hidden]), button:not([hidden]):not(:disabled)');
        if (first && document.activeElement !== first) first.focus({ preventScroll: true });
    }
    closeScreen(id) {
        const el = $(id);
        if (el) el.hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        document.activeElement?.blur?.();
        if (id === 'map') return;
        const top = this.top();
        if (top) $(top).querySelector('button:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
    }
    closeTop() { const t = this.top(); if (t) this.closeScreen(t); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0 || !!this.dlg; }
    is(id) { return this.stack.includes(id); }
    /** Arrow keys walk focus through the top screen's buttons. */
    moveFocus(d) {
        const top = this.top();
        if (!top) return;
        const els = [...$(top).querySelectorAll('button:not([hidden]):not(:disabled), a.btn, input, select')].filter((e) => e.offsetParent !== null);
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        els[(i + d + els.length) % els.length].focus();
        this.audio.ui('move');
    }

    toast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        $('toasts').appendChild(t);
        setTimeout(() => t.classList.add('out'), 2600);
        setTimeout(() => t.remove(), 3200);
    }
    hint(msg) { const h = $('hint'); h.hidden = !msg; if (msg) h.textContent = msg; }

    img(name, cls = 'icon', alt = '') {
        const u = this.art.url(name);
        return u ? `<img class="${cls}" src="${u}" alt="${esc(alt)}" loading="lazy">` : `<span class="${cls} noart"></span>`;
    }
    elIcon(e, n = null) {
        return `<span class="el" title="${ELEMENTS[e].name}">${this.img('el-' + e, 'icon', ELEMENTS[e].name)}${n !== null ? `<b>${n}</b>` : ''}</span>`;
    }
    cost(c) { return Object.entries(c).map(([e, n]) => this.elIcon(e, n)).join('') || '<span class="dim">free</span>'; }

    title(hasSave) {
        $('btn-continue').hidden = !hasSave;
        $('btn-new').textContent = hasSave ? 'Begin a New Apprenticeship' : 'Begin an Apprenticeship';
        $('btn-new').classList.toggle('primary', !hasSave);
    }

    // ------------------------------------------------------------------ the map

    renderMap(G, { onSelect, sel }) {
        const M = G.map;
        $('map-chapter').textContent = G.chapter <= 3 ? `Chapter ${G.chapter}: ${chapterName(G.chapter)}` : chapterName(G.chapter);
        $('map-sub').textContent = G.chapter > 3 ? ` · ${CAULDRONS[G.tier].name}` : '';
        $('map-resolve').innerHTML = `<span class="lbl">Resolve</span> ${'♥'.repeat(G.resolve)}<span class="dim">${'♡'.repeat(Math.max(0, 3 - G.resolve))}</span>`;
        $('map-gold').innerHTML = `${this.img('coin', 'icon small')} ${G.gold}`;
        $('map-xp').innerHTML = `<span class="lbl">XP</span> ${G.xp}`;
        const portrait = innerHeight > innerWidth * 1.1;
        const pos = (n) => (portrait ? { x: 12 + n.y * 76, y: 92 - n.x * 84 } : { x: 6 + n.x * 88, y: 10 + n.y * 80 });
        const open = new Set(choices(G));
        const field = $('map-field');
        field.classList.toggle('portrait', portrait);
        let edges = '';
        for (const e of M.edges) {
            const a = pos(nodeOf(G, e.from)), b = pos(nodeOf(G, e.to));
            const walked = G.path.includes(e.from) && G.path.includes(e.to);
            const next = G.at === e.from && open.has(e.to);
            edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : next ? 'next' : ''}"/>`;
        }
        const svg = $('map-edges');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.innerHTML = edges;
        let nodes = '';
        for (const layer of M.layers) for (const n of layer) {
            const p = pos(n);
            const meta = NODE_META[n.type];
            const state = G.at === n.id ? 'here' : G.path.includes(n.id) ? 'done' : open.has(n.id) ? 'open' : 'locked';
            nodes += `<button class="node ${n.type} ${state} ${sel === n.id ? 'sel' : ''}" data-id="${n.id}" style="left:${p.x}%;top:${p.y}%" aria-label="${meta.label}${state === 'open' ? ' (you can go here)' : ''}" ${state === 'open' ? '' : 'tabindex="-1"'}><span>${meta.icon}</span></button>`;
        }
        $('map-nodes').innerHTML = nodes;
        $('map-nodes').onclick = (e) => {
            const b = e.target.closest('.node');
            if (b) onSelect(b.dataset.id);
        };
    }

    /** The panel for a chosen node: what it is, and (for a refinement) the enhancements to bring. */
    mapInfo(G, id, { enh, onToggle, onGo, onClose }) {
        const box = $('map-info');
        if (!id) { box.hidden = true; return; }
        const n = nodeOf(G, id);
        const meta = NODE_META[n.type];
        const open = choices(G).includes(id);
        let extra = '';
        if (n.type === 'refine' && open) {
            extra = '<div class="enh"><div class="dim">Bring enhancements (paid from your stores):</div>' + Object.values(ENHANCEMENTS).map((E) => {
                const on = enh.includes(E.id);
                const ok = on || canAfford(G, Object.entries(E.cost).reduce((c, [k, v]) => { c[k] = (c[k] || 0) + v; return c; }, enh.reduce((c, x) => { for (const [k, v] of Object.entries(ENHANCEMENTS[x].cost)) c[k] = (c[k] || 0) + v; return c; }, {})));
                return `<button class="chip ${on ? 'on' : ''}" data-enh="${E.id}" ${ok ? '' : 'disabled'}>${on ? '✓ ' : ''}${E.name} ${this.cost(E.cost)}<small>${E.desc}</small></button>`;
            }).join('') + '</div>';
        }
        if (n.type === 'boss') {
            const kind = { 1: 'warden', 2: 'serpent', 3: 'homunculus' }[Math.min(3, G.chapter)];
            extra = `<div class="boss-art">${this.img('foe-' + kind, 'foe-big', FOES[kind].name)}<b>${FOES[kind].name}</b></div>`;
        }
        box.innerHTML = `<div class="info-head"><span class="node-icon ${n.type}">${meta.icon}</span><div><b>${meta.label}</b><div class="dim">${meta.desc}</div></div>
            <button class="ibtn close" aria-label="Close">✕</button></div>${extra}
            ${open ? `<button class="btn primary go">${n.type === 'shop' ? 'Visit the stall' : n.type === 'cache' ? 'Open the cache' : 'Travel here'}</button>` : `<div class="dim">${G.path.includes(id) ? 'Already cleared.' : 'Not reachable from where you stand.'}</div>`}`;
        box.hidden = false;
        box.onclick = (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.classList.contains('close')) onClose();
            else if (b.classList.contains('go')) onGo();
            else if (b.dataset.enh) onToggle(b.dataset.enh);
        };
        box.querySelector('.go')?.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ cauldron, skills, journal, shop

    stores(G) {
        return ELEMENT_IDS.map((e) => `<div class="store">${this.img('el-' + e, 'icon big', ELEMENTS[e].name)}<div><b>${ELEMENTS[e].name}</b> <span class="dim">${ELEMENTS[e].tier}</span><div class="num">${G.stores[e]}</div></div></div>`).join('');
    }

    cauldron(G, onLearn) {
        $('cauldron-tier').textContent = `· ${CAULDRONS[G.tier].name}`;
        $('stores').innerHTML = this.stores(G);
        $('shape-grid').innerHTML = SHAPE_IDS.map((id) => {
            const s = SHAPES[id];
            const known = G.shapes.includes(id);
            const tierOk = RARITY_TIER[s.rarity] <= G.tier;
            const can = canLearn(G, id);
            const state = known ? 'known' : !tierOk ? 'sealed' : can ? 'can' : 'cant';
            return `<div class="shape ${state}">${this.mini(s.cells)}<div class="shape-name">${s.name} <span class="dim">${s.rarity}</span></div>
                ${known ? '<div class="dim">Known</div>' : !tierOk ? `<div class="dim">Needs the ${CAULDRONS[RARITY_TIER[s.rarity]].name}</div>` : `<div class="recipe">${this.cost(s.recipe)}</div><button class="btn small" data-learn="${id}" ${can ? '' : 'disabled'}>Learn</button>`}</div>`;
        }).join('');
        $('shape-grid').onclick = (e) => { const b = e.target.closest('[data-learn]'); if (b) onLearn(b.dataset.learn); };
    }

    mini(cells) {
        const { w, h } = sizeOf(cells);
        const set = new Set(cells.map(([x, y]) => `${x},${y}`));
        let s = `<div class="mini" style="grid-template-columns:repeat(${w},1fr)">`;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s += `<i class="${set.has(`${x},${y}`) ? 'on' : ''}"></i>`;
        return s + '</div>';
    }

    skills(G, onTrain) {
        $('skills-xp').textContent = `· ${G.xp} XP to spend`;
        const branches = {};
        for (const id of SKILL_IDS) (branches[SKILLS[id].branch] ||= []).push(SKILLS[id]);
        $('skill-tree').innerHTML = Object.entries(branches).map(([b, list]) => `<div class="branch"><h3>${b}</h3>${list.map((s) => {
            const have = G.skills.includes(s.id);
            const can = canTrain(G, s.id);
            const locked = !s.req.every((r) => G.skills.includes(r));
            return `<div class="skill ${have ? 'have' : can ? 'can' : locked ? 'locked' : 'cant'}"><b>${s.name}</b>${s.active ? ' <span class="tag">active</span>' : ''}<div class="dim">${s.desc}</div>
                ${have ? '<div class="ok">Learned</div>' : `<button class="btn small" data-train="${s.id}" ${can ? '' : 'disabled'}>${s.cost} XP${locked ? ` · needs ${SKILLS[s.req[0]].name}` : ''}</button>`}</div>`;
        }).join('')}</div>`).join('');
        $('skill-tree').onclick = (e) => { const b = e.target.closest('[data-train]'); if (b) onTrain(b.dataset.train); };
    }

    journal(G) {
        const items = Object.entries(G.items).filter(([, n]) => n > 0);
        const pots = Object.values(POTIONS).map((p) => {
            const have = G.potions[p.id];
            return `<div class="potion ${have ? '' : 'unknown'}">${have ? this.img('potion-' + p.id, 'icon big', p.name) : '<span class="icon big noart">?</span>'}<div><b>${have ? p.name : 'Unbrewed'}</b>${have ? `<div class="dim">×${have.n} · best ${GRADE_NAMES[have.best]}</div>` : ''}</div></div>`;
        }).join('');
        const S = G.stats;
        $('journal-body').innerHTML = `<h3>Stores</h3><div class="stores">${this.stores(G)}</div>
            <h3>Satchel</h3><div class="satchel">${items.length ? items.map(([id, n]) => `<div class="item">${this.img('item-' + id, 'icon big', ITEMS[id].name)}<div><b>${ITEMS[id].name}</b> ×${n}<div class="dim">${ITEMS[id].desc}</div></div></div>`).join('') : '<p class="dim">Empty. Pellerin sells useful things.</p>'}</div>
            <h3>The Potion Shelf</h3><div class="shelf">${pots}</div>
            <h3>The Record</h3><p class="dim">${S.levels} levels cleared, ${S.fails} lost · ${S.lines} lines · ${S.harvests} deposits harvested · ${S.potions} potions brewed · ${S.foes} foes faced · ${G.shapes.length} tile types known · ${G.skills.length} skills.</p>`;
    }

    shop(G, onBuy) {
        $('shop-face').src = this.art.url('cast-vendor-warm');
        $('shop-line').textContent = ['Browse at your leisure. The grid will wait.', 'The good alchemists buy three. The great ones buy five.', 'Everything here has saved someone from a jam.'][G.path.length % 3];
        $('shop-gold').innerHTML = `${this.img('coin', 'icon small')} ${G.gold}`;
        $('shop-stock').innerHTML = (G.shop?.stock || []).map((s) => {
            const I = ITEMS[s.id];
            const ok = s.left > 0 && G.gold >= s.price;
            return `<div class="ware">${this.img('item-' + s.id, 'icon big', I.name)}<div class="ware-text"><b>${I.name}</b> <span class="dim">(you have ${G.items[s.id] || 0})</span><div class="dim">${I.desc}</div></div>
                <button class="btn small" data-buy="${s.id}" ${ok ? '' : 'disabled'}>${s.left > 0 ? `${s.price} gold` : 'Sold out'}</button></div>`;
        }).join('');
        $('shop-stock').onclick = (e) => { const b = e.target.closest('[data-buy]'); if (b) onBuy(b.dataset.buy); };
    }

    // ------------------------------------------------------------------ a level: brief, HUD, tools, result

    objectiveText(L) {
        const o = L.objective;
        if (o.kind === 'lines') return `Clear ${o.target} lines`;
        if (o.kind === 'score') return `Score ${o.target}`;
        if (o.kind === 'harvest') return `Harvest ${o.ids.length === 1 ? 'the deposit' : `all ${o.ids.length} deposits`}`;
        if (o.kind === 'brew') return `Brew ${POTIONS[L.refine.potion].name}`;
        if (o.kind === 'defeat') return L.battle.foes.length === 1 ? `Defeat ${L.battle.foes[0].name}` : `Defeat all ${L.battle.foes.length} foes`;
        return '';
    }
    condText(c) {
        if (c.type === 'lines') return `${this.elIcon(c.el)} Clear ${c.target} ${ELEMENTS[c.el].name.toLowerCase()} line${c.target > 1 ? 's' : ''} <span class="dim">(3+ ${ELEMENTS[c.el].name.toLowerCase()} in the line)</span> ${c.n}/${c.target}`;
        if (c.type === 'combo') return c.target <= 1 ? 'Clear a line' : `Clear ${c.target} lines with one tile`;
        if (c.type === 'streak') return c.target <= 1 ? 'Clear a line' : `Clear lines on ${c.target} placements in a row`;
        if (c.type === 'forbid') return `${this.elIcon(c.el)} No line with 3+ ${ELEMENTS[c.el].name.toLowerCase()}${c.violated ? ` <b class="bad">✗ ${c.violated}</b>` : ''}`;
        return '';
    }

    brief(L) {
        $('brief-kind').textContent = (L.boss ? 'Boss · ' : L.elite ? 'Elite · ' : '') + KIND_NAMES[L.kind];
        $('brief-name').textContent = L.name;
        let b = `<p class="goal">${esc(this.objectiveText(L))}</p><p class="dim">Supply: ${L.supply.length + L.hand.filter(Boolean).length} tiles.</p>`;
        if (L.kind === 'explore') {
            b += '<div class="deps">' + L.deposits.map((d) => `<div class="dep">${has(L, 'sight') ? this.elIcon(d.el, d.qty) : '<span class="el"><span class="icon noart">?</span></span>'} <span class="dim">${d.layers} layer${d.layers > 1 ? 's' : ''}</span></div>`).join('') + '</div>';
            b += '<p class="dim">Deposits lie under stone slabs. Clear a line through one to peel off a layer.</p>';
        }
        if (L.refine) {
            const P = POTIONS[L.refine.potion];
            b += `<div class="recipe-card">${this.img('potion-' + P.id, 'icon huge', P.name)}<ul>${L.refine.conds.map((c) => `<li>${this.condText(c)}</li>`).join('')}</ul></div>`;
            b += '<p class="dim">Lines through the golden rings count double toward quality.</p>';
        }
        if (L.battle) {
            b += '<div class="foes">' + L.battle.foes.map((f) => `<div class="foe">${this.img('foe-' + (f.kind === 'tail' ? 'serpent' : f.kind), 'icon huge', f.name)}<b>${f.name}</b><span class="dim">♥ ${f.hp} · armour ${f.armor} · hits ${f.dmg}</span></div>`).join('') + '</div>';
            b += `<p class="dim">Your health: ${L.battle.hp}. Foes act every ${L.battle.every} placements.</p>`;
        }
        $('brief-body').innerHTML = b;
    }

    /** The HUD: called every frame, rebuilt only when something it shows has changed. */
    hud(L) {
        const pr = progress(L);
        const key = [L.name, L.score, L.lines, L.supply.length, L.streak, pr.have, L.status, L.deposits.map((d) => d.cover).join(), L.refine && JSON.stringify(L.refine), L.battle && JSON.stringify(L.battle.foes.map((f) => [f.hp, f.armor, f.timer, f.cells.length])) + L.battle.hp].join('|');
        if (key === this.hudKey) return;
        this.hudKey = key;
        $('hud-name').textContent = (L.boss ? 'Boss · ' : L.elite ? 'Elite · ' : '') + L.name;
        const o = L.objective;
        $('hud-obj').textContent = this.objectiveText(L) + (o.kind === 'lines' || o.kind === 'score' || o.kind === 'harvest' || o.kind === 'defeat' ? ` · ${pr.have} / ${pr.need}` : '');
        $('hud-bar').style.width = `${Math.round((pr.have / Math.max(1, pr.need)) * 100)}%`;
        $('hud-supply').textContent = L.supply.length;
        $('hud-score').textContent = L.score;
        $('hud-streak').textContent = L.streak;
        let p = '';
        if (L.kind === 'explore' && L.deposits.length) {
            p = '<div class="deps">' + L.deposits.map((d) => `<div class="dep ${d.harvested ? 'done' : ''}">${has(L, 'sight') || d.harvested ? this.elIcon(d.el) : '<span class="el"><span class="icon noart">?</span></span>'}<span>${d.harvested ? '✓' : '▮'.repeat(d.cover)}</span></div>`).join('') + '</div>';
        }
        if (L.refine) {
            const R = L.refine;
            p = `<ul class="conds">${R.conds.map((c) => `<li class="${c.met && c.type !== 'forbid' ? 'met' : ''}">${c.met && c.type !== 'forbid' ? '✓ ' : ''}${this.condText(c)}</li>`).join('')}</ul>
                <div class="quality"><span class="lbl">Quality</span><div class="bar"><span style="width:${R.quality}%"></span></div><span>${R.quality >= 85 ? 'Masterwork' : R.quality >= 60 ? 'Pure' : R.quality >= 35 ? 'Fine' : 'Crude'}</span></div>`;
        }
        if (L.battle) {
            const B = L.battle;
            p = `<div class="hp"><span class="lbl">You</span><div class="bar hpbar"><span style="width:${(B.hp / B.maxHp) * 100}%"></span></div><b>${B.hp}</b></div><div class="foe-list">` + B.foes.map((f) => {
                const next = f.pattern[f.step % f.pattern.length];
                return `<div class="foe-row ${f.hp <= 0 ? 'dead' : ''}">${this.img('foe-' + (f.kind === 'tail' ? 'serpent' : f.kind), 'icon', f.name)}<div><b>${f.name}</b><div class="bar hpbar"><span style="width:${(f.hp / f.maxHp) * 100}%"></span></div></div>
                    ${f.hp > 0 ? `<span class="intent" title="Acts in ${f.timer}">${{ attack: '⚔', advance: '➜', harden: '⛨' }[next]} ${f.timer}</span>` : '<span class="intent">✓</span>'}</div>`;
            }).join('') + '</div>';
        }
        $('hud-panel').innerHTML = p;
        $('stuck').hidden = L.status !== 'stuck';
    }

    tools(L) {
        const items = Object.keys(ITEMS).filter((id) => L.items[id] > 0 || (id === 'tonic' ? !!L.battle && L.items[id] > 0 : false));
        const skills = ['swap', 'affinity', 'reclaim'].filter((s) => has(L, s));
        const key = items.map((id) => id + L.items[id] + itemUsable(L, id)).join() + '|' + skills.map((s) => s + skillUsable(L, s) + L.swapCd).join() + L.status;
        if (key === this.toolKey) return;
        this.toolKey = key;
        const el = $('tools');
        el.innerHTML = items.map((id) => `<button class="tool ${itemUsable(L, id) ? '' : 'off'}" data-item="${id}" aria-label="${ITEMS[id].name} (${L.items[id]})" title="${ITEMS[id].name}: ${ITEMS[id].desc} [${ITEM_KEY[id]}]">${this.img('item-' + id, 'icon', ITEMS[id].name)}<b>${L.items[id]}</b></button>`).join('')
            + skills.map((s) => `<button class="tool skill ${skillUsable(L, s) ? '' : 'off'}" data-skill="${s}" aria-label="${SKILLS[s].name}" title="${SKILLS[s].name}: ${SKILLS[s].desc}">${{ swap: '↻', affinity: '♺', reclaim: '↺' }[s]}${s === 'swap' && L.swapCd > 0 ? `<b>${L.swapCd}</b>` : ''}</button>`).join('');
        el.hidden = !live(L) || (!items.length && !skills.length);
    }

    showHud(on) { $('hud').hidden = !on; if (!on) { $('tools').hidden = true; $('stuck').hidden = true; this.hint(null); } this.hudKey = ''; this.toolKey = ''; }

    result(R, G) {
        const els = Object.entries(R.elements || {}).map(([e, n]) => this.elIcon(e, n)).join('');
        if (R.cache) {
            $('result-head').textContent = 'A Cache';
            $('result-body').innerHTML = `<p>Someone left this for you.</p><div class="loot">${this.img('coin', 'icon')} +${R.gold} gold ${els} ${Object.keys(R.items).map((id) => `${this.img('item-' + id, 'icon', ITEMS[id].name)} ${ITEMS[id].name}`).join('')}</div>`;
            return;
        }
        if (R.won) {
            $('result-head').textContent = R.ending ? 'The Homunculus Falls' : R.tier ? 'Chapter Complete' : R.kind === 'refine' ? 'Brewed!' : R.kind === 'battle' ? 'Victory' : 'Cleared';
            let b = '';
            if (R.potion) b += `<div class="recipe-card">${this.img('potion-' + R.potion, 'icon huge', POTIONS[R.potion].name)}<div><b>${POTIONS[R.potion].name}</b><div class="grade ${R.grade}">${GRADE_NAMES[R.grade]}</div></div></div>`;
            b += `<div class="loot">${this.img('coin', 'icon')} +${R.gold} gold · +${R.xp} XP ${els}</div>`;
            if (R.tier) b += `<p class="goal">Your cauldron is now the ${CAULDRONS[R.tier].name}. New tile types can be learned.</p>`;
            b += `<p class="dim">Score ${R.score}.</p>`;
            $('result-body').innerHTML = b;
        } else {
            $('result-head').textContent = { jammed: 'The Lattice Jammed', out: 'Out of Tiles', defeated: 'Defeated', conceded: 'You Stepped Back' }[R.reason] || 'Lost';
            const why = { jammed: 'Nothing in your hand fit anywhere.', out: 'The supply ran dry before the goal was met.', defeated: 'The foes wore you down.', conceded: 'You set the level aside.' }[R.reason] || '';
            $('result-body').innerHTML = `<p>${why}</p><p>${R.reset ? 'Your resolve is spent: the chapter\'s map is redrawn. You keep every tile type, skill, element and coin.' : `Resolve left this chapter: ${'♥'.repeat(G.resolve)}. Choose your path again.`}</p><div class="loot">+${R.xp} XP</div>`;
        }
    }

    // ------------------------------------------------------------------ dialog

    /** Play a scene; onDone() once it ends. */
    play(id, onDone) {
        const beats = SCRIPTS[id];
        if (!beats) { onDone(); return; }
        this.dlg = { id, beats, i: 0, onDone };
        $('dialog').hidden = false;
        this.dlgShow();
    }
    dlgShow() {
        const d = this.dlg;
        const b = d.beats[d.i];
        if (!b || b.end) { this.dlgEnd(); return; }
        if (b.choice) {
            $('dlg-choices').innerHTML = b.choice.map((c, k) => `<button class="btn" data-k="${k}">${esc(c.label)}</button>`).join('');
            $('dlg-more').hidden = true;
            $('dlg-choices').onclick = (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const c = b.choice[+btn.dataset.k];
                this.audio.ui('click');
                d.i = d.beats.findIndex((x) => x.id === c.next);
                if (d.i < 0) d.i = d.beats.length;
                $('dlg-choices').innerHTML = '';
                this.dlgShow();
            };
            $('dlg-choices').querySelector('button')?.focus({ preventScroll: true });
            return;
        }
        const C = CHARACTERS[b.speaker];
        const face = `cast-${b.speaker}-${b.portrait || C.expressions[0]}`;
        $('dlg-face').src = this.art.url(face);
        $('dlg-face').alt = C.name;
        $('dlg-face').className = 'dlg-face ' + (b.speaker === 'player' ? 'left' : 'right');
        $('dlg-name').textContent = C.name;
        $('dlg-text').innerHTML = b.text ? esc(b.text).replace(/\*(.+?)\*/g, '<em>$1</em>') : '<span class="dim">…</span>';
        $('dlg-choices').innerHTML = '';
        $('dlg-more').hidden = false;
        // the next beat's portrait, so it is there when we get to it
        const nb = d.beats[d.i + 1];
        if (nb?.speaker) this.art.load(`cast-${nb.speaker}-${nb.portrait || CHARACTERS[nb.speaker].expressions[0]}`);
    }
    dlgNext() {
        const d = this.dlg;
        if (!d) return;
        const b = d.beats[d.i];
        if (b?.choice) return;
        this.audio.ui('click');
        d.i++;
        // a branch ends at its own { end }
        this.dlgShow();
    }
    dlgEnd() {
        const d = this.dlg;
        this.dlg = null;
        $('dialog').hidden = true;
        d?.onDone();
    }
    /** Keyboard in a dialog. */
    dlgKey(key) {
        if (!this.dlg) return;
        const b = this.dlg.beats[this.dlg.i];
        if (b?.choice) {
            if (key === 'ArrowDown' || key === 'ArrowRight') this.moveIn($('dlg-choices'), 1);
            else if (key === 'ArrowUp' || key === 'ArrowLeft') this.moveIn($('dlg-choices'), -1);
            else if (key === 'Enter' || key === 'Space') document.activeElement?.closest('#dlg-choices') && document.activeElement.click();
            return;
        }
        if (key === 'Space' || key === 'Enter' || key === 'KeyZ' || key === 'ArrowRight') this.dlgNext();
        else if (key === 'Escape') { while (this.dlg && !this.dlg.beats[this.dlg.i]?.choice && this.dlg.beats[this.dlg.i] && !this.dlg.beats[this.dlg.i].end) this.dlg.i++; if (this.dlg) this.dlgShow(); }
    }
    moveIn(box, d) {
        const els = [...box.querySelectorAll('button')];
        const i = els.indexOf(document.activeElement);
        els[(i + d + els.length) % els.length]?.focus();
    }
}

export { N, KIND_NAMES };
