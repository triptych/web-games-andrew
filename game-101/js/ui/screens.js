// Every full screen and window: title, party creation, the camp menu (party, equipment, items,
// quests, journal, map, system), event dialogs and battle results. Each is a function
// (ui, G, params) → { title, body, foot, wide }. They are re-run whenever the sim changes, so they
// hold no state of their own except `params` (the open tab, the selected member).

import { h, row, portrait, icon, itemName, itemStats, bar, canvasEl, money, tabs, hr, rarityClass } from './dom.js';
import { calc, CLASSES, CLASS_IDS, SKILLS, skillsFor, xpNeed, canEquip, slotFor, TRAITS } from '../sim/party.js';
import { SLOTS, SLOT_NAMES, DIR_NAMES, VERSION } from '../config.js';
import { describe } from '../sim/items.js';
import { progress, isReady } from '../sim/quests.js';
import { REG, completion } from '../sim/journal.js';
import { ACHIEVEMENTS } from '../sim/achievements.js';
import { fxText } from '../sim/uniques.js';
import { personName } from '../sim/names.js';
import { makeRng } from '../rng.js';
import { monsterCanvas, featureCanvas, npcCanvas } from '../view/sprites.js';
import { drawMap } from '../view/map.js';
import { townScreens } from './screens-town.js';

const roll = () => makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

// ------------------------------------------------------------------ small pieces
function compareText(m, it) {
    const slot = slotFor(m, it);
    if (!slot) return null;
    const before = calc(m);
    const after = calc({ ...m, eq: { ...m.eq, [slot]: it } });
    const out = [];
    for (const [k, label] of [['atk', 'ATK'], ['mag', 'MAG'], ['def', 'DEF'], ['mdef', 'MDF'], ['maxhp', 'HP'], ['maxmp', 'MP'], ['agi', 'AGI'], ['luk', 'LUK']]) {
        const d = after[k] - before[k];
        if (d) out.push(h('span', { class: d > 0 ? 'up' : 'down' }, `${label} ${d > 0 ? '+' : ''}${d}`));
    }
    return out.length ? out.flatMap((x, i) => (i ? [' ', x] : [x])) : h('span', { class: 'dim' }, 'no change');
}
const memberChips = (G, cur, onPick) => h('div', { class: 'chips' }, G.party.map((m, i) => h('button', { class: `chip ${i === cur ? 'on' : ''}`, onclick: () => onPick(i) }, portrait(m, 20), m.name)));

// ------------------------------------------------------------------ title and setup
function title(ui) {
    const has = ui.ctx.hasSave();
    return {
        title: '', noClose: true, cls: 'titlesheet',
        body: h('div', { class: 'titlebox' },
            h('h1', { class: 'logo', 'aria-label': 'PixelCrypt' }, h('span', { class: 'c12' }, 'PIXEL'), h('span', { class: 'c14' }, 'CRYPT')),
            h('div', { class: 'tag-line' }, 'a dungeon without a bottom'),
            h('nav', { class: 'menu' },
                has ? h('button', { class: 'btn primary', onclick: () => ui.ctx.continueGame() }, 'Continue') : null,
                h('button', { class: `btn ${has ? '' : 'primary'}`, onclick: () => (has ? ui.open('confirm', { text: 'Start a new game? Your saved game will be replaced when you save again.', yes: () => ui.open('create', { slots: null }) }) : ui.open('create', { slots: null })) }, 'New Game'),
                h('button', { class: 'btn', onclick: () => ui.open('howto') }, 'How to Play'),
                h('button', { class: 'btn', onclick: () => ui.open('settings') }, 'Settings')),
            h('div', { class: 'version' }, `v${VERSION} · 16 colours · no asset files`)),
    };
}

function create(ui, G, p) {
    if (!p.slots) p.slots = ['warrior', 'rogue', 'cleric', 'mage'].map((c) => ({ cls: c, name: personName(roll()) }));
    const body = h('div', null,
        h('p', { class: 'dim' }, 'Choose your four adventurers. Two more can be recruited at the Inn.'),
        p.slots.map((s, i) => h('div', { class: 'slot' },
            h('div', { class: 'slotp' }, portrait({ cls: s.cls, face: i * 5 + s.name.length }, 40)),
            h('div', { class: 'slotc' },
                h('div', { class: 'slotrow' },
                    h('select', { 'aria-label': `Class ${i + 1}`, onchange: (e) => { s.cls = e.target.value; ui.render(ui.top()); } }, CLASS_IDS.map((c) => h('option', { value: c, selected: c === s.cls }, CLASSES[c].name))),
                    h('input', { type: 'text', value: s.name, maxlength: 12, 'aria-label': `Name ${i + 1}`, onchange: (e) => { s.name = e.target.value.trim() || s.name; } }),
                    h('button', { class: 'btn', 'aria-label': 'New name', onclick: () => { s.name = personName(roll()); ui.render(ui.top()); } }, '↻')),
                h('div', { class: 'dim small' }, CLASSES[s.cls].desc)))));
    return {
        title: 'Your Party', body, foot: [
            h('button', { class: 'btn', onclick: () => ui.close() }, 'Back'),
            h('button', { class: 'btn primary', onclick: () => ui.ctx.newGame({ classes: p.slots.map((s) => s.cls), names: p.slots.map((s) => s.name) }) }, 'Descend'),
        ],
    };
}

function howto(ui) {
    const K = (a, b) => h('tr', null, h('td', null, a), h('td', null, b));
    return {
        title: 'How to Play', wide: true,
        body: h('div', { class: 'howto' },
            h('p', null, 'Lead up to six adventurers through an endless dungeon. Every floor is new, every monster is a little different, and the loot is never the same. Come home, spend, upgrade, and go deeper.'),
            h('table', null,
                K('↑ / W', 'Step forward'), K('↓ / S', 'Step back'), K('← → / A D', 'Turn'), K('Q / E', 'Sidestep'),
                K('Space / F', 'Interact with what you stand on, or search for secrets'), K('M', 'Map'), K('I / Esc', 'Menu'), K('1-4', 'Pick a battle command'), K('Enter', 'Press the selected button')),
            h('ul', null,
                h('li', null, h('b', null, 'Search'), ' dead ends: walls lie. Rogues and the lucky find more.'),
                h('li', null, h('b', null, 'Cursed gear'), ' looks normal until worn, then it will not come off. The church can lift curses.'),
                h('li', null, h('b', null, 'Guardians'), ' wait on every fifth floor. Beat one to unlock a new starting floor at the Descent.'),
                h('li', null, h('b', null, 'Invest'), ' at the Guild: every shop you own pays you each day and gives you a discount. Days pass when you rest, explore, and (slowly) just by leaving the game open.'),
                h('li', null, h('b', null, 'The journal'), ' records everything you meet, beat, find, buy and sell.')),
            h('p', { class: 'dim' }, 'Touch: use the pad under the view. Gamepad: d-pad or stick, A to press, B to go back.')),
        foot: [h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Got it')],
    };
}

function settings(ui, G, p) {
    const s = ui.settings;
    const upd = () => ui.ctx.applySettings();
    const slider = (label, key) => h('label', { class: 'setrow' }, label, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], oninput: (e) => { s[key] = +e.target.value; upd(); }, onchange: () => ui.audio.sfxPlay('click') }));
    const check = (label, key, hint) => h('label', { class: 'setrow' }, h('span', null, label, hint ? h('small', { class: 'dim' }, ` ${hint}`) : null), h('input', { type: 'checkbox', checked: !!s[key], onchange: (e) => { s[key] = e.target.checked; upd(); } }));
    return {
        title: 'Settings',
        body: h('div', null,
            slider('Sound', 'sfx'), slider('Music', 'music'),
            h('label', { class: 'setrow' }, 'Touch pad', h('select', { onchange: (e) => { s.touch = e.target.value; upd(); } }, [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Never']].map(([v, l]) => h('option', { value: v, selected: s.touch === v }, l)))),
            check('Scanlines', 'scan', '(CRT look)'),
            check('Calm mode', 'calm', '(no shake, flashes or bob)'),
            check('Fast battles', 'fast', '(shorter pauses)'),
            h('button', { class: 'btn danger', onclick: () => ui.open('confirm', { text: 'Delete the saved game for good?', yes: () => { ui.ctx.deleteSave(); ui.close(); } }) }, 'Delete saved game')),
        foot: [h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Done')],
    };
}

let confirmYes = null;
function confirm(ui, G, p) {
    confirmYes = p.yes;
    return {
        title: 'Are you sure?', body: h('p', null, p.text), noClose: false,
        foot: [h('button', { class: 'btn', onclick: () => ui.close() }, 'No'), h('button', { class: 'btn primary', onclick: () => { const y = confirmYes; ui.close(); y?.(); } }, 'Yes')],
    };
}

// ------------------------------------------------------------------ camp
function camp(ui, G, p) {
    const tab = p.tab || 'party';
    const list = [['party', 'Party'], ['items', 'Items', G.inv.length], ['quests', 'Quests', G.quests.active.length || ''], ['journal', 'Journal'], ['awards', 'Awards', `${Object.keys(G.ach).length}/${ACHIEVEMENTS.length}`], ...(G.floor ? [['map', 'Map']] : []), ['system', 'System']];
    const go = (t) => { p.tab = t; ui.render(ui.top()); };
    const body = { party: campParty, items: campItems, quests: campQuests, journal: campJournal, awards: campAwards, map: campMap, system: campSystem }[tab](ui, G, p);
    return { title: 'Camp', wide: true, body: h('div', null, tabs(list, tab, go), body), cls: 'camp' };
}

function campParty(ui, G, p) {
    if (p.who === undefined || !G.party[p.who]) p.who = 0;
    const m = G.party[p.who];
    const s = calc(m);
    const need = xpNeed(m.lvl);
    const act = (c) => ui.do(c);
    let right;
    if (p.slot) right = equipPicker(ui, G, p, m);
    else right = h('div', { class: 'detail' },
        h('div', { class: 'dhead' }, portrait(m, 56),
            h('div', null, h('div', { class: 'dname' }, m.name), h('div', { class: `c${CLASSES[m.cls].col}` }, `${CLASSES[m.cls].name} · Level ${m.lvl}${m.trait ? ' · ' + TRAITS[m.trait].name : ''}`),
                h('div', { class: 'small dim' }, `XP ${m.xp}/${need}`), bar(m.xp / need, 11, 'tiny'))),
        h('div', { class: 'vitals' }, h('span', null, `HP ${m.hp}/${s.maxhp}`), bar(m.hp / s.maxhp, 10), h('span', null, `MP ${m.mp}/${s.maxmp}`), bar(m.mp / Math.max(1, s.maxmp), 9)),
        h('div', { class: 'stats' }, [['STR', s.str], ['VIT', s.vit], ['AGI', s.agi], ['INT', s.int], ['LUK', s.luk], ['ATK', s.atk], ['MAG', s.mag], ['DEF', s.def], ['MDF', s.mdef], ['CRT', Math.round(s.crit * 100) + '%']].map(([k, v]) => h('div', null, h('span', { class: 'dim' }, k), ' ', v))),
        Object.keys(m.st).length ? h('div', { class: 'c12' }, 'Afflicted: ' + Object.keys(m.st).join(', ')) : null,
        h('h3', null, 'Equipment'),
        h('div', { class: 'list' }, SLOTS.map((sl) => { const it = m.eq[sl]; return row({ ic: it ? icon(it) : h('span', { class: 'emptyic' }), label: it ? itemName(it) : h('span', { class: 'dim' }, `— ${SLOT_NAMES[sl]} —`), sub: it ? itemStats(it) : SLOT_NAMES[sl], right: it?.cursed && it.known ? '☠' : '', onClick: () => { p.slot = sl; ui.render(ui.top()); } }); })),
        h('div', { class: 'cmdrow' },
            h('button', { class: 'btn', onclick: () => act({ t: 'autoequip', who: p.who }) }, 'Auto-equip'),
            h('button', { class: 'btn', onclick: () => act({ t: 'row', who: p.who, row: m.row ? 0 : 1 }) }, m.row === 0 ? 'Front row → Back' : 'Back row → Front'),
            h('button', { class: 'btn', disabled: p.who === 0, onclick: () => { act({ t: 'swap', who: p.who, dir: -1 }); p.who--; } }, '▲'),
            h('button', { class: 'btn', disabled: p.who === G.party.length - 1, onclick: () => { act({ t: 'swap', who: p.who, dir: 1 }); p.who++; } }, '▼')),
        h('h3', null, 'Skills'),
        h('div', { class: 'list' }, skillsFor(m).map((k) => {
            const field = k.field;
            return row({ label: k.name, sub: k.desc, right: `${k.mp} MP`, disabled: !field || m.mp < k.mp || m.hp <= 0, cls: field ? '' : 'passive', onClick: () => castField(ui, G, p, k) });
        })),
        m.lvl < 30 ? h('div', { class: 'small dim' }, 'Next skill at level ' + (Object.values(SKILLS).filter((k) => k.cls === m.cls && k.lvl > m.lvl).map((k) => k.lvl)[0] || '—')) : null);
    return h('div', { class: 'split' }, h('div', { class: 'side-list' }, memberChips(G, p.who, (i) => { p.who = i; p.slot = null; ui.render(ui.top()); })), right);
}
function castField(ui, G, p, k) {
    if (k.tg === 'aa' || k.tg === 's') return ui.do({ t: 'skill', who: p.who, skill: k.id, target: p.who });
    p.cast = k;
    ui.open('pickmember', { k, who: p.who });
}
function pickmember(ui, G, p) {
    const k = p.k;
    return {
        title: `${k.name}: who?`, body: h('div', { class: 'list' }, G.party.map((m, i) => row({ ic: portrait(m, 28), label: m.name, sub: `${m.hp}/${calc(m).maxhp} HP`, onClick: () => { ui.do({ t: 'skill', who: p.who, skill: k.id, target: i }); ui.close(); } }))),
    };
}

function equipPicker(ui, G, p, m) {
    const slot = p.slot;
    const cur = m.eq[slot];
    const cands = G.inv.filter((it) => ['w', 'a', 'c'].includes(it.t) && slotFor(m, it) === slot || (it.t === 'c' && slot.startsWith('acc')));
    const rows = cands.map((it) => {
        const c = canEquip(m, it);
        return row({ ic: icon(it), label: itemName(it), sub: c.ok ? [compareText(m, it), h('div', { class: 'small dim' }, itemStats(it))] : c.why, right: it.price ? `${it.price}g` : '', disabled: !c.ok, onClick: () => { ui.do({ t: 'equip', who: p.who, item: it.id }); p.slot = null; ui.render(ui.top()); } });
    });
    return h('div', { class: 'detail' },
        h('h3', null, `${m.name}: ${SLOT_NAMES[slot]}`),
        cur ? row({ ic: icon(cur), label: [itemName(cur), h('span', { class: 'dim' }, '  (equipped)')], sub: itemStats(cur), right: cur.cursed && cur.known ? 'cursed' : 'Remove', disabled: cur.cursed, onClick: () => { ui.do({ t: 'unequip', who: p.who, slot }); p.slot = null; ui.render(ui.top()); } }) : h('div', { class: 'dim' }, 'Nothing equipped.'),
        h('div', { class: 'list' }, rows.length ? rows : h('div', { class: 'dim pad' }, 'No suitable items in the bag.')),
        h('button', { class: 'btn', onclick: () => { p.slot = null; ui.render(ui.top()); } }, '◂ Back'));
}

const FILTERS = [['all', 'All'], ['gear', 'Gear'], ['use', 'Potions'], ['magic', 'Magic'], ['coll', 'Finds']];
function campItems(ui, G, p) {
    const f = p.filter || 'all';
    const pass = (it) => f === 'all' || (f === 'gear' && ['w', 'a', 'c'].includes(it.t)) || (f === 'use' && it.t === 'p') || (f === 'magic' && ['s', 'm', 't'].includes(it.t)) || (f === 'coll' && it.t === 'x');
    const items = G.inv.filter(pass);
    const listEl = h('div', { class: 'list' }, items.length ? items.map((it) => row({
        ic: icon(it), label: itemName(it), sub: it.t === 'm' ? `${describe(it)[0]}` : itemStats(it) || describe(it).join(' '), right: it.price ? `${it.price}g` : '',
        cls: '', onClick: () => ui.open('item', { id: it.id }),
    })) : h('div', { class: 'dim pad' }, 'Nothing here.'));
    return h('div', null,
        h('div', { class: 'chips' }, FILTERS.map(([id, l]) => h('button', { class: `chip ${f === id ? 'on' : ''}`, onclick: () => { p.filter = id; ui.render(ui.top()); } }, l)), h('span', { class: 'dim small spacer' }, `${G.inv.length}/80`)),
        listEl);
}
function itemDetail(ui, G, p, it) {
    const lines = describe(it);
    const body = [
        h('div', { class: 'dhead' }, icon(it), h('div', null, h('div', { class: 'dname' }, itemName(it)), h('div', { class: 'small dim' }, `${['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][it.rar] || ''} · item level ${it.ilvl || 1}`))),
        h('div', null, lines.map((l) => h('div', null, l))),
    ];
    if (it.lore) body.push(h('div', { class: 'c11 small' }, `"${it.lore}"`));
    if (it.cursed && it.known) body.push(h('div', { class: 'c12' }, 'Cursed! It cannot be removed once worn (until the church lifts the curse).'));
    const needsMember = ['w', 'a', 'c', 'p', 't', 'm'].includes(it.t) && !(it.t === 'm' && it.skill !== 'heal');
    if (needsMember) {
        body.push(h('div', { class: 'small dim' }, it.t === 'w' || it.t === 'a' || it.t === 'c' ? 'Equip on:' : 'Use on:'));
        body.push(h('div', { class: 'list' }, G.party.map((m, i) => {
            if (['w', 'a', 'c'].includes(it.t)) {
                const c = canEquip(m, it);
                return row({ ic: portrait(m, 28), label: m.name, sub: c.ok ? compareText(m, it) : c.why, disabled: !c.ok, onClick: () => ui.do({ t: 'equip', who: i, item: it.id }) });
            }
            return row({ ic: portrait(m, 28), label: m.name, sub: `${m.hp}/${calc(m).maxhp} HP · ${m.mp}/${calc(m).maxmp} MP`, onClick: () => ui.do({ t: 'use', item: it.id, who: i }) });
        })));
    } else if (it.t === 's') {
        body.push(h('button', { class: 'btn primary', onclick: () => ui.do({ t: 'use', item: it.id, who: 0 }) }, 'Read'));
    }
    body.push(h('button', { class: 'btn danger small', onclick: () => ui.open('confirm', { text: `Throw away ${it.name}?`, yes: () => { ui.do({ t: 'drop', item: it.id }); ui.close('item', true); } }) }, 'Drop'));
    return h('div', { class: 'detail' }, body);
}

/** Tapping an item in the bag opens this: what it is, and who can use or wear it. */
function item(ui, G, p) {
    const it = G.inv.find((x) => x.id === p.id);
    if (!it) { queueMicrotask(() => ui.close('item', true)); return { title: 'Item', body: h('div', { class: 'dim' }, 'Gone.'), foot: [h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Back')] }; }
    return { title: 'Item', body: itemDetail(ui, G, p, it), foot: [h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Back')] };
}

function campQuests(ui, G) {
    const q = G.quests.active;
    return h('div', null,
        h('p', { class: 'dim' }, `${q.length}/5 active quests. Take new ones, and hand in finished ones, at the Guild.`),
        h('div', { class: 'list' }, q.length ? q.map((x) => { const [a, b] = progress(G, x); const ok = isReady(G, x); return row({ label: [x.title, ok ? h('span', { class: 'c10' }, '  READY') : ''], sub: [x.desc, h('div', null, bar(a / b, ok ? 10 : 11, 'tiny'))], right: `${a}/${b}`, onClick: () => { } }); }) : h('div', { class: 'dim pad' }, 'No quests. Visit the Guild.')),
        h('div', { class: 'dim small' }, `Quests completed: ${G.quests.done}`));
}

function campMap(ui, G) {
    const c = h('canvas', { class: 'bigmap', width: 400, height: 320 });
    queueMicrotask(() => drawMap(c, G));
    return h('div', null, h('div', { class: 'where' }, G.floor ? `${G.floor.name} · facing ${DIR_NAMES[G.pos.d]}` : ''), c,
        h('div', { class: 'legend small' }, h('span', { class: 'c14' }, '◆ stairs down'), ' ', h('span', { class: 'c11' }, '◆ stairs up'), ' ', h('span', { class: 'c14' }, '▪ chest'), ' ', h('span', { class: 'c10' }, '▪ gather'), ' ', h('span', { class: 'c13' }, '◆ stranger'), ' ', h('span', { class: 'c12' }, '▪ trap')));
}
function map(ui, G) {
    return { title: G.floor?.name || 'Map', wide: true, body: campMap(ui, G), foot: [h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Close')] };
}

function campAwards(ui, G) {
    const done = Object.keys(G.ach).length;
    const rows = ACHIEVEMENTS.slice().sort((a, b) => (G.ach[b[0]] ? 1 : 0) - (G.ach[a[0]] ? 1 : 0)).map(([id, name, desc, tier, cur, goal]) => {
        const got = !!G.ach[id], v = Math.min(goal, cur(G));
        return h('div', { class: `award ${tier} ${got ? '' : 'locked'}` }, h('div', { class: 'medal' }, got ? '★' : '·'),
            h('div', null, h('div', null, got ? name : h('span', { class: 'dim' }, name)), h('div', { class: 'small dim' }, desc), got ? null : bar(v / goal, tier === 'gold' ? 14 : 11, 'tiny')),
            h('div', { class: 'small gold' }, got ? `Day ${G.ach[id]}` : goal > 1 ? `${Math.min(v, 999999).toLocaleString('en-US')}/${goal.toLocaleString('en-US')}` : ''));
    });
    return h('div', null, h('div', { class: 'jsum' }, h('span', null, `${done}/${ACHIEVEMENTS.length} earned`), bar(done / ACHIEVEMENTS.length, 14, 'tiny')), h('div', { class: 'list' }, rows));
}

function campSystem(ui, G) {
    return h('div', { class: 'menu' },
        h('button', { class: 'btn', onclick: () => { ui.ctx.save(true); } }, 'Save game'),
        h('button', { class: 'btn', onclick: () => ui.open('settings') }, 'Settings'),
        h('button', { class: 'btn', onclick: () => ui.open('howto') }, 'How to Play'),
        h('button', { class: 'btn danger', onclick: () => ui.open('confirm', { text: 'Save and return to the title screen?', yes: () => ui.ctx.toTitle() }) }, 'Save & Quit to Title'),
        h('div', { class: 'dim small' }, `Seed ${G.seed} · day ${G.day} · ${G.stats.steps.toLocaleString('en-US')} steps · deepest B${G.journal.misc.deepest || 1}F`));
}

// ------------------------------------------------------------------ journal
const JTABS = [['monsters', 'Monsters'], ['artifacts', 'Artifacts'], ['weapons', 'Weapons'], ['armor', 'Armor'], ['charms', 'Charms'], ['potions', 'Potions'], ['magic', 'Magic'], ['finds', 'Finds'], ['world', 'World'], ['record', 'Record']];
function campJournal(ui, G, p) {
    const j = G.journal, jt = p.jt || 'monsters';
    const comp = completion(G);
    const pct = (a) => `${a[0]}/${a[1]}`;
    const cnt = (e) => (e ? Object.entries({ F: e.found, B: e.bought, S: e.sold, U: e.used, E: e.equipped }).filter(([, v]) => v).map(([k, v]) => `${k}${v}`).join(' ') : '');
    const showAll = !!p.all;
    const itemRows = (list) => {
        const have = list.filter((e) => j.items[e.key]);
        const rest = list.filter((e) => !j.items[e.key]);
        const rows = [...have.map((e) => row({ label: e.name, right: cnt(j.items[e.key]), cls: 'jrow' })), ...(showAll ? rest : rest.slice(0, 5)).map((e) => row({ label: h('span', { class: 'dim' }, '???' + (showAll ? '  ' + e.name : '')), right: '', cls: 'jrow unk' }))];
        if (!showAll && rest.length > 5) rows.push(h('div', { class: 'dim small pad' }, `…and ${rest.length - 5} more to find.`));
        return rows;
    };
    let content;
    if (jt === 'monsters') {
        content = REG.monsters.map((e) => {
            const r = j.mon[e.key];
            const vs = r?.v ? Object.entries(r.v).sort((a, b) => (b[1].killed || 0) - (a[1].killed || 0)).slice(0, 8).map(([n, x]) => `${n} ${x.killed || 0}/${x.seen || 0}`).join(' · ') : '';
            return row({
                ic: r ? canvasEl(monsterCanvas({ fam: e.key, seed: 3, pal: e.fam.pal, boss: false }), 'px icon', 32, 32) : h('span', { class: 'emptyic' }),
                label: r ? e.name : h('span', { class: 'dim' }, '???'), sub: r ? [`Seen ${r.seen || 0} · Defeated ${r.killed || 0}${e.fam.weak.length ? ' · weak: ' + e.fam.weak.join(', ') : ''}`, vs ? h('div', { class: 'small dim' }, vs) : null] : `Appears from floor ${e.fam.minD}`, cls: 'jrow',
            });
        });
    } else if (jt === 'artifacts') {
        content = REG.uniques.map((e) => {
            const have = !!j.items[e.key];
            return row({ label: have ? h('span', { class: 'r3 uniq' }, '★ ' + e.name) : h('span', { class: 'dim' }, '???'), sub: have ? [e.u.lore, h('div', { class: 'small c11' }, fxText(e.u.fx).join(' · '))] : `Somewhere below floor ${e.u.minD}, or in a Chronicler's gift.`, right: have ? 'found' : '', cls: 'jrow' });
        });
    } else if (jt === 'weapons') content = itemRows(REG.weapons);
    else if (jt === 'armor') content = itemRows(REG.armor);
    else if (jt === 'charms') content = itemRows(REG.charms);
    else if (jt === 'potions') content = itemRows(REG.potions);
    else if (jt === 'magic') content = itemRows([...REG.scrolls, ...REG.wands, ...REG.tomes]);
    else if (jt === 'finds') content = itemRows(REG.collectibles);
    else if (jt === 'world') {
        content = [
            h('h3', null, 'Strangers'), ...REG.npcs.map((e) => row({ label: j.npc[e.key] ? e.name : h('span', { class: 'dim' }, '???'), right: j.npc[e.key] ? `met ${j.npc[e.key].met || 0}` : '', cls: 'jrow' })),
            h('h3', null, 'Traps'), ...REG.traps.map((e) => row({ label: j.trap[e.key] ? e.name : h('span', { class: 'dim' }, '???'), right: j.trap[e.key] ? `found ${j.trap[e.key].found || 0} · sprung ${j.trap[e.key].triggered || 0}` : '', cls: 'jrow' })),
            h('h3', null, 'Gathering'), ...REG.gathers.map((e) => row({ label: j.gather[e.key] ? e.name : h('span', { class: 'dim' }, '???'), right: j.gather[e.key] ? `met ${j.gather[e.key].met || 0} · gathered ${j.gather[e.key].gathered || 0}` : '', cls: 'jrow' })),
        ];
    } else {
        const m = j.misc, S = G.stats;
        const kv = [['Deepest floor', m.deepest || 1], ['Guardians slain', m.bossesSlain || 0], ['Monsters defeated', S.kills], ['Battles', m.battles || 0], ['Fled', m.fled || 0], ['Party wipes', S.deaths], ['Chests opened', m.chests || 0],
            ['Traps sprung', m.trapsSprung || 0], ['Secret doors found', m.secretsFound || 0], ['Potions used', m.potionsUsed || 0], ['Curses lifted', m.dispelled || 0], ['Quests done', m.quests || 0], ['Days passed', S.days],
            ['Steps taken', S.steps], ['Gold earned', S.goldEarned], ['Gold spent', S.goldSpent], ['Passive income collected', m.collected || 0]];
        content = [...kv.map(([k, v]) => row({ label: k, right: Number(v).toLocaleString('en-US'), cls: 'jrow' })),
            ...Object.entries(j.best).map(([k, v]) => row({ label: `Best ${{ w: 'weapon', a: 'armour', c: 'charm' }[k]}`, right: v.name, cls: 'jrow' }))];
    }
    const summary = { monsters: comp.monsters, artifacts: comp.uniques, weapons: comp.weapons, armor: comp.armor, charms: comp.charms, potions: comp.potions, magic: [comp.scrolls[0] + comp.wands[0] + comp.tomes[0], comp.scrolls[1] + comp.wands[1] + comp.tomes[1]], finds: comp.collectibles }[jt];
    return h('div', null,
        h('div', { class: 'chips' }, JTABS.map(([id, l]) => h('button', { class: `chip ${jt === id ? 'on' : ''}`, onclick: () => { p.jt = id; ui.render(ui.top()); } }, l))),
        summary ? h('div', { class: 'jsum' }, h('span', null, `Collected ${pct(summary)}`), bar(summary[0] / summary[1], 14, 'tiny'), ['weapons', 'armor', 'magic', 'finds', 'charms', 'potions'].includes(jt) ? h('button', { class: 'chip', onclick: () => { p.all = !p.all; ui.render(ui.top()); } }, p.all ? 'Hide unknown' : 'Show all') : null) : null,
        jt !== 'monsters' && jt !== 'world' && jt !== 'record' ? h('div', { class: 'small dim' }, 'F found · B bought · S sold · U used · E equipped') : null,
        h('div', { class: 'list' }, content));
}

// ------------------------------------------------------------------ dialogs and results
function dialog(ui, G) {
    const D = G.dialog;
    if (!D) return { title: '', body: h('div') };
    const pic = D.kind === 'chest' ? featureCanvas('chest') : D.npc ? npcCanvas(D.npc, D.seed || 1) : null;
    const ft = D.key && G.floor ? G.floor.feat[D.key] : null;
    const primary = (id) => ['ok', 'open', 'go', 'gather', 'drink', 'accept', 'rescue'].includes(id);
    let body = h('div', { class: 'dlg' }, pic ? canvasEl(pic, 'px dlgpic', 64, D.npc ? 80 : 64) : null, D.lines.map((l) => h('p', null, l)));
    let foot = D.opts.map((o) => h('button', { class: `btn ${primary(o.id) ? 'primary' : ''}`, disabled: !!o.off, onclick: () => ui.do({ t: 'dlg', id: o.id }) }, o.label));
    if (D.kind === 'merchant' && ft?.stock) {
        body = h('div', { class: 'dlg' }, pic ? canvasEl(pic, 'px dlgpic', 64, 80) : null, D.lines.map((l) => h('p', null, l)),
            h('div', { class: 'list' }, ft.stock.filter((it) => !it.bought).map((it) => row({ ic: icon(it), label: itemName(it), sub: itemStats(it) || describe(it).join(' '), right: money(it.price), disabled: G.gold < it.price, onClick: () => ui.do({ t: 'dlg', id: 'buy' + it.sid }) }))));
        foot = [h('button', { class: 'btn primary', onclick: () => ui.do({ t: 'dlg', id: 'leave' }) }, 'Farewell')];
    }
    return { title: D.title, onX: () => ui.do({ t: 'closeDlg' }), wide: D.kind === 'merchant', body, foot };
}

function results(ui, G) {
    const B = G.battle;
    if (!B) return { title: '', body: h('div') };
    if (B.over === 'lose') {
        return { title: 'Defeat', noClose: true, body: h('div', null, h('p', null, 'The party has fallen. The Guild drags you back to town, a little poorer.')), foot: [h('button', { class: 'btn primary', onclick: () => { ui.close('results', true); ui.do({ t: 'endBattle' }); } }, 'Return to town')] };
    }
    const r = B.result || { xp: 0, gold: 0, items: [], levelups: [] };
    return {
        title: r.boss ? 'Guardian Slain!' : 'Victory!', noClose: true,
        body: h('div', { class: 'results' },
            h('div', null, h('span', { class: 'c10' }, `+${r.xp} XP each`), '   ', money(r.gold)),
            r.levelups.map((l) => h('div', { class: 'c14' }, `★ ${l.name} reached level ${l.lvl}!`, l.skills.length ? h('span', { class: 'c11' }, ` Learned ${l.skills.join(', ')}.`) : '')),
            r.items.length ? h('div', null, h('h3', null, 'Spoils'), r.items.map((n) => h('div', null, n))) : h('div', { class: 'dim' }, 'No drops.')),
        foot: [h('button', { class: 'btn primary', onclick: () => { ui.close('results', true); ui.do({ t: 'endBattle' }); } }, 'Continue')],
    };
}

export const SCREENS = { title, create, howto, settings, confirm, camp, item, pickmember, map, dialog, results, ...townScreens({ h, row, portrait, icon, itemName, itemStats, bar, money, tabs, hr, canvasEl, compareText, memberChips, rarityClass }) };
