// The station's rooms and the menu: briefing, Greenhouse (splice and party), market, lounge, rest,
// the compendium, the party and item screens. One panel at a time inside #panel-sheet; every
// action goes through ui.doAct and the panel redraws.

import { h, $, clear, bar, elChip, affRow, skillRow, skillTag, skillCost, portraitImg, raceName } from './dom.js';
import { SKILLS } from '../sim/data/skills.js';
import { ITEMS, GEAR } from '../sim/data/items.js';
import { ZONES, STORY_ZONES } from '../sim/data/zones.js';
import { DAEMONS, daemonList, PERSONALITIES, RACES, RACE_INFO } from '../sim/data/daemons.js';
import { BONDERS, BOND_GATE, BOND_PERKS, CHARS } from '../sim/data/story.js';
import { calc, partyUnits, findUnit } from '../sim/units.js';
import { shopStock, priceOf, unlockedZones } from '../sim/game.js';
import { splicePreview } from '../sim/splice.js';
import { TIDES, tideOf, xpToNext, MAX_LEVEL, EL } from '../config.js';
import { AGENT_G } from '../sim/units.js';

const TIDE_NOTE = ['Hexes are agitated: they hit 10% harder and are harder to recode.', 'A calm tide.', 'A calm tide.', 'A calm tide.', 'The lattice is bright: Hexes listen more easily and hit 8% softer.', 'A calm tide.', 'A calm tide.', 'A calm tide.'];
const FOCUS = { balanced: 'Balanced', blade: 'Blade', mage: 'Mage', quick: 'Quick', guard: 'Guard' };

export class Panels {
    constructor(ui) {
        this.ui = ui;
        this.cur = null;
    }

    get G() { return this.ui.G; }
    get open() { return !!this.cur; }

    open_(kind, opts = {}) {
        this.cur = { kind, tab: opts.tab || null, ...opts };
        this.ui.openScreen('panel');
        this.render();
        const cam = { briefing: 'briefing', greenhouse: 'greenhouse', market: 'market', lounge: 'lounge', rest: 'infirmary' }[kind];
        if (cam && this.ui.G.phase === 'hub') this.ui.view.hub.preset(cam);
    }
    close() {
        if (!this.cur) return;
        this.cur = null;
        if (!$('panel').hidden) this.ui.closeScreen('panel');
        if (this.ui.G.phase === 'hub') this.ui.view.hub.preset('overview');
    }

    render() {
        const c = this.cur;
        if (!c) return;
        const sheet = clear($('panel-sheet'));
        const fn = { menu: this.menu, briefing: this.briefing, greenhouse: this.greenhouse, market: this.market, lounge: this.lounge, rest: this.rest, dex: this.dex }[c.kind];
        fn.call(this, sheet, this.G);
        sheet.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }

    act(a, ok) {
        const err = this.ui.doAct(a);
        if (!err) { this.ui.audio.ui('buy'); ok?.(); }
        this.render();
        return err;
    }

    head(title, G, extra = null) {
        return h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap' }, h('h2', { text: title }), extra || h('div', { html: `<span class="scrap-ic"></span> <b style="color:var(--gold)">${G.scrap}</b> Scrap` }));
    }
    foot(extra = []) { return h('div.sheet-foot', ...extra, h('button.btn.primary', { text: 'Close', onclick: () => { this.ui.audio.ui('close'); this.ui.closeTop(); } })); }

    // ================================================================ unit pieces
    portrait(u, big = false) {
        const v = this.ui.view, G = this.G;
        if (u.agent) return portraitImg(`pc:agent:${G.look || 0}`, () => v.portraits.person('agent', 'neutral', G.look || 0), big ? 'big' : 'pf');
        return portraitImg(big ? `pd:${u.sp}` : `pc:${u.sp}`, () => big ? v.portraits.daemon(u.sp, 160, 200) : v.portraits.daemon(u.sp, 80, 100), big ? 'big' : 'pf');
    }

    unitRow(u, { onclick, sel = false, right = null } = {}) {
        const G = this.G, c = calc(G, u);
        return h('div.item' + (sel ? '.sel' : ''), { tabindex: 0, onclick, onkeydown: (e) => { if (e.key === 'Enter') onclick?.(); } }, this.portrait(u),
            h('div', h('div.t', { text: u.name }), h('div.s', h('span.tag', { text: u.agent ? 'AGENT' : raceName(DAEMONS[u.sp].race) }), ` Lv ${u.lv}`, h('div', bar(u.hp / c.maxhp), bar(u.mp / c.maxmp, 'mp')))),
            h('div.r', { text: right ?? `${u.hp}/${c.maxhp}` }));
    }

    unitDetail(u) {
        const G = this.G, c = calc(G, u), sp = u.agent ? null : DAEMONS[u.sp];
        const d = h('div.detail');
        d.append(this.portrait(u, true), h('h4', { text: u.name }),
            h('div.s', sp ? [h('span.tag', { text: raceName(sp.race) }), ` ${PERSONALITIES[sp.pers].name} temper`] : [h('span.tag.g', { text: 'WARDEN' }), ` growth: ${FOCUS[u.foc] || 'Balanced'}`]),
            h('div.s', { text: `Lv ${u.lv}  ·  XP ${u.xp}/${u.lv >= MAX_LEVEL ? '—' : xpToNext(u.lv)}` }),
            bar(u.hp / c.maxhp), bar(u.mp / c.maxmp, 'mp'),
            h('div.s', { text: `HP ${u.hp}/${c.maxhp}   MP ${u.mp}/${c.maxmp}` }),
            h('div.stats', ...[['St', c.st], ['Ma', c.ma], ['Vi', c.vi], ['Ag', c.ag], ['Lu', c.lu]].map(([k, v]) => h('div', { text: k }, h('b', { text: v })))));
        // affinities: for the Agent, whatever the coat gives; for a daemon, all of them
        const affs = h('div.affs');
        for (const el of ['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex']) {
            const k = c.aff[el];
            const col = { w: '#ffd86a', r: '#8fb0c0', n: '#cfe8ff', d: '#9dffb0', p: '#ff7ae0' }[k] || '#6a8a7e';
            affs.append(h('span.chip', { text: EL[el].tag + (k ? k.toUpperCase() : ''), style: `color:${col};background:${col}22` }));
        }
        d.append(affs);
        const sk = h('div.skl');
        for (const id of u.skills) { const s = SKILLS[id]; sk.append(h('div', { title: s.desc }, skillTag(s), h('span', { text: s.name }), h('small', { text: skillCost(s) }))); }
        d.append(h('div.s', { text: `Skills ${u.skills.length}/${c.slots}`, style: 'margin-top:8px' }), sk);
        return d;
    }

    // ================================================================ menu
    menu(sheet, G) {
        const c = this.cur;
        c.tab = c.tab || 'party';
        const tabs = [['party', 'Party'], ['items', 'Items'], ['daemons', 'Daemons'], ['dex', 'Compendium'], ['story', 'Story'], ['system', 'System']];
        sheet.append(this.head(G.phase === 'hub' ? 'Menu' : 'Field Menu', G));
        sheet.append(h('div.tabs', ...tabs.map(([k, n]) => h('button.btn' + (c.tab === k ? '.on' : ''), { text: n, onclick: () => { c.tab = k; c.sel = null; this.render(); } }))));
        this['m_' + c.tab](sheet, G);
        sheet.append(this.foot());
    }

    m_party(sheet, G) {
        const c = this.cur;
        const sel = findUnit(G, c.sel) || G.agent;
        const left = h('div');
        left.append(h('div.s', { text: 'Field party (up to three daemons)', style: 'color:var(--dim);font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px' }));
        const list = h('div', { style: 'display:grid;gap:6px' });
        for (const u of partyUnits(G)) list.append(this.unitRow(u, { sel: u.uid === sel.uid, onclick: () => { c.sel = u.uid; this.render(); } }));
        left.append(list);
        if (G.party.length < 3 && G.stock.length > G.party.length) left.append(h('div.s', { text: 'Open slots: add daemons under Daemons.', style: 'margin-top:8px;color:var(--dim)' }));
        // equipment
        if (sel.agent) {
            left.append(h('h3', { text: 'Gear' }));
            for (const slot of ['blade', 'sidearm', 'coat', 'charm']) {
                const g = GEAR[G.gear[slot]];
                left.append(h('div.item', { tabindex: 0, onclick: () => { c.gearSlot = slot; this.render(); } }, h('div.pf', { text: { blade: '⚔', sidearm: '⌖', coat: '▥', charm: '✦' }[slot], style: 'display:grid;place-items:center;font-size:24px;color:var(--accent)' }), h('div', h('div.t', { text: g.name }), h('div.s', { text: g.desc })), h('div.r', { text: slot })));
            }
            if (c.gearSlot) {
                left.append(h('h3', { text: `Choose ${c.gearSlot}` }));
                for (const id of G.ownedGear.filter((x) => GEAR[x].slot === c.gearSlot)) left.append(h('div.item' + (G.gear[c.gearSlot] === id ? '.sel' : ''), { tabindex: 0, onclick: () => this.act({ type: 'equip', slot: c.gearSlot, id }, () => { c.gearSlot = null; }) }, h('div.pf'), h('div', h('div.t', { text: GEAR[id].name }), h('div.s', { text: GEAR[id].desc })), h('div.r', { text: G.gear[c.gearSlot] === id ? 'ON' : '' })));
            }
            left.append(h('h3', { text: 'Growth focus' }), h('div.seg', ...Object.keys(AGENT_G).map((f) => h('button.btn.mini' + (G.agent.foc === f ? '.on' : ''), { text: FOCUS[f], onclick: () => this.act({ type: 'focus', f }) }))));
        }
        sheet.append(h('div.two', left, this.unitDetail(sel)));
    }

    m_items(sheet, G) {
        const c = this.cur;
        const list = h('div', { style: 'display:grid;gap:6px' });
        const ids = Object.keys(G.items).filter((id) => G.items[id] > 0 && ITEMS[id]);
        if (!ids.length) list.append(h('div', { text: 'The pack is empty.', style: 'color:var(--dim)' }));
        for (const id of ids) {
            const it = ITEMS[id];
            list.append(h('div.item' + (c.item === id ? '.sel' : ''), { tabindex: 0, onclick: () => { c.item = c.item === id ? null : id; this.render(); } }, h('div.pf', { text: { heal: '✚', mp: '◈', revive: '❀', cure: '⚕', field: '⇧', bomb: '✹', gift: '♥', chip: '▣', seed: '❖', key: '⚿' }[it.kind] || '•', style: 'display:grid;place-items:center;font-size:24px;color:var(--accent)' }), h('div', h('div.t', { text: it.name }), h('div.s', { text: it.desc })), h('div.r', { text: `×${G.items[id]}` })));
        }
        const right = h('div.detail');
        if (c.item && ITEMS[c.item] && G.items[c.item] > 0) {
            const it = ITEMS[c.item];
            right.append(h('h4', { text: it.name }), h('p', { text: it.desc }));
            if (it.kind === 'chip') {
                const ag = G.agent;
                if (ag.skills.includes(it.skill)) right.append(h('p', { text: 'The Agent already knows this.' }));
                else if (ag.skills.length < 10) right.append(h('button.btn.primary', { text: 'Learn it', onclick: () => this.act({ type: 'chip', item: it.id }) }));
                else {
                    right.append(h('p', { text: 'The Agent knows ten skills. Replace one:' }));
                    for (let i = 0; i < ag.skills.length; i++) right.append(h('button.btn.mini', { text: SKILLS[ag.skills[i]].name, onclick: () => this.act({ type: 'chip', item: it.id, replace: i }) }));
                }
            } else if (['heal', 'mp', 'revive', 'cure', 'seed'].includes(it.kind)) {
                right.append(h('p', { text: it.kind === 'seed' ? 'Raise whose stat?' : 'Use on:' }));
                for (const u of (it.kind === 'seed' ? [G.agent, ...G.stock] : partyUnits(G))) right.append(h('div', { style: 'margin:4px 0' }, this.unitRow(u, { onclick: () => this.act({ type: 'use', item: it.id, uid: u.uid }) })));
            } else if (it.id === 'beacon') {
                right.append(G.phase === 'explore' ? h('button.btn.primary', { text: 'Leave the zone now', onclick: () => { this.act({ type: 'use', item: 'beacon' }); this.ui.closeTop(); } }) : h('p', { text: 'Use it in a zone to leave at once.' }));
            } else right.append(h('p', { text: 'Use it in battle.' }));
        } else right.append(h('p', { text: 'Select an item.', style: 'color:var(--dim)' }));
        sheet.append(h('div.two', list, right));
    }

    m_daemons(sheet, G) {
        const c = this.cur;
        const sel = findUnit(G, c.sel) || G.stock[0];
        const list = h('div', { style: 'display:grid;gap:6px' });
        sheet.append(h('div.s', { text: `${G.stock.length}/24 in the Greenhouse · ${G.party.length}/3 in the field party`, style: 'color:var(--dim);margin-bottom:8px' }));
        if (!G.stock.length) { sheet.append(h('p', { text: 'No daemons yet. Recode a Hex in battle to bring one home.' })); return; }
        for (const u of G.stock) list.append(this.unitRow(u, { sel: sel && u.uid === sel.uid, onclick: () => { c.sel = u.uid; this.render(); }, right: G.party.includes(u.uid) ? 'ACTIVE' : '' }));
        const right = h('div');
        if (sel) {
            right.append(this.unitDetail(sel));
            const inParty = G.party.includes(sel.uid);
            const foot = h('div.sheet-foot');
            if (G.phase === 'hub' || G.phase === 'explore') foot.append(h('button.btn' + (inParty ? '' : '.primary'), { text: inParty ? 'Remove from party' : 'Add to party', disabled: !inParty && G.party.length >= 3, onclick: () => this.act({ type: 'party', uids: inParty ? G.party.filter((x) => x !== sel.uid) : [...G.party, sel.uid] }) }));
            if (G.phase === 'hub') foot.append(h('button.btn.danger.mini', { text: `Release (+${10 + sel.lv * 2})`, onclick: () => { if (c.confirmRelease === sel.uid) { this.act({ type: 'release', uid: sel.uid }, () => { c.sel = null; c.confirmRelease = null; }); } else { c.confirmRelease = sel.uid; this.ui.toast('Press again to release ' + sel.name + '.'); } } }));
            right.append(foot);
        }
        sheet.append(h('div.two', list, right));
    }

    m_dex(sheet, G) { this.dexBody(sheet, G); }

    m_story(sheet, G) {
        const cur = G.currents;
        sheet.append(h('div.cur', ...[['hearth', 'Hearth', 'rebuild what was'], ['wild', 'Wild', 'let the green take it'], ['graft', 'Graft', 'make something new']].map(([k, n, s]) => h('div', { text: n }, h('b', { text: cur[k] }), h('small', { text: s, style: 'text-transform:none;letter-spacing:0;color:var(--dim)' })))));
        sheet.append(h('p', { text: `Day ${G.day} · ${TIDES[tideOf(G.day)].name}. ${TIDE_NOTE[tideOf(G.day)]}` }));
        sheet.append(h('h3', { text: 'Bonds' }));
        for (const b of BONDERS) {
            const r = G.bonds[b];
            const perks = BOND_PERKS[b];
            sheet.append(h('div.item', { style: 'cursor:default' }, portraitImg(`vn:${b}:neutral:0`, () => this.ui.view.portraits.person(b, 'neutral', 0), 'pf'), h('div', h('div.t', { text: CHARS[b].name }), h('div.rank', ...[1, 2, 3, 4].map((i) => h('i' + (i <= r ? '.on' : ''))))), h('div.s', { text: r ? perks[r - 1].replace('{name}', G.name) : 'Hang out in the Lounge to begin.' })));
        }
        sheet.append(h('h3', { text: 'Record' }), h('p', { text: `Wardens' report: ${Object.keys(G.flags).filter((f) => f.startsWith('boss_')).length} guardians quieted · ${G.stock.length} daemons home · ${Object.values(G.dex).filter((d) => d.recoded > 0).length} kinds recoded.` }));
    }

    m_system(sheet, G) {
        sheet.append(h('div.menu',
            h('button.btn', { text: 'Save game', onclick: () => { this.ui.save(); this.ui.toast('Saved.'); } }),
            h('button.btn', { text: 'Settings', onclick: () => this.ui.openScreen('settings') }),
            h('button.btn', { text: 'How to play', onclick: () => this.ui.openScreen('howto') }),
            h('button.btn', { text: 'Save & quit to title', onclick: () => this.ui.quit() })));
    }

    // ================================================================ compendium
    dex(sheet, G) {
        sheet.append(this.head('Compendium', G, h('div', { text: `${Object.values(G.dex).filter((d) => d.recoded > 0).length} recoded · ${Object.keys(G.dex).length} met` })));
        this.dexBody(sheet, G);
        sheet.append(this.foot());
    }
    dexBody(sheet, G) {
        const c = this.cur;
        const all = daemonList().filter((d) => !d.final);
        const sel = c.dexSel && DAEMONS[c.dexSel] ? c.dexSel : null;
        const grid = h('div', { style: 'display:grid;gap:5px;grid-template-columns:repeat(auto-fill,minmax(112px,1fr))' });
        for (const race of RACES) {
            for (const d of all.filter((x) => x.race === race)) {
                const dex = G.dex[d.id];
                const seen = !!dex, own = !!(dex && dex.recoded);
                grid.append(h('div.item' + (sel === d.id ? '.sel' : '') + (seen ? '' : '.off'), { tabindex: 0, style: 'grid-template-columns:1fr;padding:4px;text-align:center', onclick: () => { c.dexSel = d.id; this.render(); } },
                    seen ? portraitImg(`pd:${d.id}`, () => this.ui.view.portraits.daemon(d.id, 160, 200), 'big') : h('div.big', { text: '?', style: 'display:grid;place-items:center;font-size:40px;color:#5a7a70' }),
                    h('div.t', { text: seen ? d.name : '???', style: 'font-size:12px' }), h('div.s', { text: own ? '● recoded' : seen ? 'met' : raceName(d.race), style: own ? 'color:var(--accent)' : '' })));
            }
        }
        const right = h('div.detail');
        if (sel) {
            const d = DAEMONS[sel], dex = G.dex[sel];
            right.append(dex ? portraitImg(`pd:${sel}`, () => this.ui.view.portraits.daemon(sel, 160, 200), 'big') : h('div.big', { text: '?', style: 'display:grid;place-items:center;font-size:60px' }), h('h4', { text: dex ? d.name : '???' }),
                h('div.s', h('span.tag', { text: raceName(d.race) }), ` base Lv ${d.lv}`, d.boss ? h('span.tag.m', { text: 'GUARDIAN' }) : null, d.special ? h('span.tag.g', { text: 'SPLICE ONLY' }) : null),
                h('p', { text: dex ? d.desc : 'Not yet met.' }));
            if (dex) {
                right.append(h('div.s', { text: dex.pers || dex.recoded ? `Temper: ${PERSONALITIES[d.pers].name}` : 'Temper: unknown (recode one to learn it)' }), affRow(G, sel, !!dex.recoded));
                const sk = h('div.skl');
                if (dex.recoded || dex.scanned) for (const id of [...d.skills, ...d.learn.map((x) => x[1])]) { const s = SKILLS[id]; sk.append(h('div', skillTag(s), h('span', { text: s.name }), h('small', { text: skillCost(s) }))); }
                else sk.append(h('div', { text: 'Skills unknown. Scan or recode it.', style: 'color:var(--dim)' }));
                right.append(sk);
            }
        } else right.append(h('p', { text: 'Select a daemon.', style: 'color:var(--dim)' }));
        sheet.append(h('div.two', grid, right));
    }

    // ================================================================ briefing
    briefing(sheet, G) {
        sheet.append(this.head('Briefing', G, h('div', { text: `Day ${G.day} · ${TIDES[tideOf(G.day)].name}` })));
        sheet.append(h('p', { text: 'The Wardens\' table maps every Hex signal Wren can find. Choose where to go. Each trip takes a day.' }));
        const open = unlockedZones(G);
        const list = h('div', { style: 'display:grid;gap:8px' });
        for (const id of [...STORY_ZONES, 'rift']) {
            const Z = ZONES[id];
            const ok = open.includes(id);
            const done = id !== 'rift' && G.flags['boss_' + Z.boss];
            const lvl = id === 'rift' ? `Lv ~${Math.max(1, G.agent.lv - 2)}–${G.agent.lv + 3}` : `Lv ${Z.lv[0]}–${Z.lv[1]}`;
            list.append(h('div.item' + (ok ? '' : '.off'), { tabindex: ok ? 0 : -1, style: 'grid-template-columns:48px 1fr auto', onclick: () => ok && this.confirmDeploy(id) },
                h('div.pf', { text: { underpass: '≋', galleria: '❦', orchard: '▤', cathedral: '✠', skyrail: '≈', spire: '▲', rift: '✺' }[id], style: 'display:grid;place-items:center;font-size:28px;color:' + (ok ? Z.accent : '#456') }),
                h('div', h('div.t', { text: ok ? Z.name : '??? Signal not found' }), h('div.s', { text: ok ? Z.blurb : (id === 'rift' ? 'Wren needs more data to find rifts.' : 'Clear the previous signal first.') })),
                h('div.r', { text: ok ? (done ? 'CLEARED · ' : '') + lvl : 'LOCKED' })));
        }
        sheet.append(list, this.foot());
    }

    confirmDeploy(id) {
        const Z = ZONES[id];
        const m = $('modal-sheet');
        clear(m).append(h('h2', { text: Z.name }), h('p', { text: Z.blurb }), h('p', { text: 'Check your party and pack. Healing is free at the Sprout on each floor (once per floor).' }),
            h('div.sheet-foot', h('button.btn', { text: 'Not yet', onclick: () => this.ui.closeScreen('modal') }), h('button.btn.primary', { text: 'Deploy', onclick: () => { this.ui.closeScreen('modal'); this.ui.closeScreen('panel'); this.cur = null; this.ui.deploy(id); } })));
        this.ui.openScreen('modal');
    }

    // ================================================================ greenhouse
    greenhouse(sheet, G) {
        const c = this.cur;
        c.tab = c.tab || 'splice';
        sheet.append(this.head('The Greenhouse', G));
        sheet.append(h('div.tabs', ...[['splice', 'Splice'], ['party', 'Party']].map(([k, n]) => h('button.btn' + (c.tab === k ? '.on' : ''), { text: n, onclick: () => { c.tab = k; this.render(); } }))));
        if (c.tab === 'splice') this.spliceBody(sheet, G); else { c.tab = 'party'; this.m_daemons(sheet, G); }
        sheet.append(this.foot());
    }

    spliceBody(sheet, G) {
        const c = this.cur;
        if (G.stock.length < 2) { sheet.append(h('p', { text: G.bonds.maple ? 'You need two daemons to splice. Recode some Hexes first.' : 'Maple smiles from among the seedlings. "Bring me two friends, and I will show you what they become." (You need two daemons.)' })); return; }
        sheet.append(h('p', { text: 'Pick two daemons. The race of the result comes from the splice table; its level from their average. Both parents are consumed.' }));
        const pick = (slot) => {
            const list = h('div', { style: 'display:grid;gap:5px;max-height:300px;overflow-y:auto;padding-right:4px' });
            for (const u of G.stock) list.append(this.unitRow(u, { sel: c[slot] === u.uid, onclick: () => { c[slot] = c[slot] === u.uid ? null : u.uid; if (c.a === c.b) c[slot === 'a' ? 'b' : 'a'] = null; c.keep = []; this.render(); }, right: `Lv${u.lv}` }));
            return h('div', h('h3', { text: slot === 'a' ? 'First' : 'Second' }), list);
        };
        sheet.append(h('div.two', pick('a'), pick('b')));
        const pv = c.a && c.b ? splicePreview(G, c.a, c.b) : null;
        const out = h('div.splice-out');
        if (!pv) out.append(h('div', { text: 'Choose two daemons to preview the result.', style: 'color:var(--dim)' }));
        else if (!pv.ok) out.append(h('div', { text: pv.why }));
        else {
            const d = DAEMONS[pv.out];
            c.keep = (c.keep || []).filter((s) => pv.inherit.includes(s)).slice(0, pv.slots);
            out.append(h('div', { style: 'display:grid;grid-template-columns:96px 1fr;gap:12px' }, portraitImg(`pd:${pv.out}`, () => this.ui.view.portraits.daemon(pv.out, 160, 200), 'big'), h('div', h('h4', { text: `${d.name}  Lv ${pv.lv}` }), h('div.s', h('span.tag', { text: raceName(d.race) }), ` ${PERSONALITIES[d.pers].name}`), pv.recipe ? h('div.s', { text: `Special recipe: ${pv.recipe}`, style: 'color:var(--gold)' }) : null, affRow(G, pv.out, true), h('div.s', { text: `Cost ${pv.cost} Scrap`, style: 'color:var(--gold)' }))));
            out.append(h('h3', { text: `Inherit up to ${pv.slots} skills` }));
            const inh = h('div.skl');
            for (const id of pv.inherit) {
                const s = SKILLS[id], on = c.keep.includes(id);
                inh.append(h('div', { style: `cursor:pointer;box-shadow:${on ? 'inset 0 0 0 1px var(--accent)' : 'none'};min-height:32px`, onclick: () => { c.keep = on ? c.keep.filter((x) => x !== id) : [...c.keep, id].slice(-pv.slots); this.render(); } }, skillTag(s), h('span', { text: (on ? '✓ ' : '') + s.name }), h('small', { text: skillCost(s) })));
            }
            if (!pv.inherit.length) inh.append(h('div', { text: 'Nothing the result does not already know.', style: 'color:var(--dim)' }));
            out.append(inh, h('div.sheet-foot', h('button.btn.primary', { text: 'Splice', disabled: !pv.afford, onclick: () => this.ui.splice(c.a, c.b, c.keep, () => { c.a = c.b = null; c.keep = []; this.render(); }) })));
            if (!pv.afford) out.append(h('div.s', { text: 'Not enough Scrap.', style: 'color:var(--danger)' }));
        }
        sheet.append(out);
    }

    // ================================================================ market
    market(sheet, G) {
        const c = this.cur;
        c.tab = c.tab || 'buy';
        const st = shopStock(G);
        const disc = G.bonds.quill >= 4 ? 25 : G.bonds.quill >= 2 ? 15 : 0;
        sheet.append(this.head('Quill\'s Market', G));
        sheet.append(h('p', { text: G.bonds.quill ? `"Customer! Always a pleasure."${disc ? ` Your discount: ${disc}%.` : ''}` : '"Look around! Everything is a bargain. Everything is also nailed down."' }));
        sheet.append(h('div.tabs', ...[['buy', 'Items'], ['gear', 'Gear'], ['chips', 'Chips'], ['sell', 'Sell']].map(([k, n]) => h('button.btn' + (c.tab === k ? '.on' : ''), { text: n, onclick: () => { c.tab = k; this.render(); } }))));
        const grid = h('div.grid');
        if (c.tab === 'buy' || c.tab === 'chips') {
            const ids = st.items.filter((id) => (ITEMS[id].kind === 'chip') === (c.tab === 'chips'));
            for (const id of ids) {
                const it = ITEMS[id];
                const price = priceOf(G, id);
                const known = it.kind === 'chip' && G.agent.skills.includes(it.skill);
                grid.append(h('div.item' + (G.scrap < price || known ? '.off' : ''), { tabindex: 0, onclick: () => !known && this.act({ type: 'buy', id }) }, h('div.pf', { text: it.kind === 'chip' ? '▣' : { heal: '✚', mp: '◈', revive: '❀', cure: '⚕', field: '⇧', bomb: '✹', gift: '♥' }[it.kind] || '•', style: 'display:grid;place-items:center;font-size:24px;color:var(--accent)' }), h('div', h('div.t', { text: it.name }), h('div.s', { text: known ? 'The Agent knows this.' : it.desc })), h('div.r', { text: `${price}`, }, h('div', { text: `own ${G.items[id] || 0}`, style: 'color:var(--dim);font-size:11px' }))));
            }
        } else if (c.tab === 'gear') {
            for (const id of st.gear) {
                const g = GEAR[id], own = G.ownedGear.includes(id), price = priceOf(G, id);
                grid.append(h('div.item' + (own || G.scrap < price ? '.off' : ''), { tabindex: 0, onclick: () => !own && this.act({ type: 'buy', id }) }, h('div.pf', { text: { blade: '⚔', sidearm: '⌖', coat: '▥', charm: '✦' }[g.slot], style: 'display:grid;place-items:center;font-size:24px;color:var(--accent)' }), h('div', h('div.t', { text: g.name }), h('div.s', { text: g.desc })), h('div.r', { text: own ? 'OWNED' : `${price}` })));
            }
        } else {
            for (const id of Object.keys(G.items).filter((x) => G.items[x] > 0 && ITEMS[x] && ITEMS[x].kind !== 'key')) {
                grid.append(h('div.item', { tabindex: 0, onclick: () => this.act({ type: 'sell', id }) }, h('div.pf'), h('div', h('div.t', { text: ITEMS[id].name }), h('div.s', { text: `own ${G.items[id]}` })), h('div.r', { text: `+${priceOf(G, id, false)}` })));
            }
            if (!grid.children.length) grid.append(h('p', { text: 'Nothing to sell.' }));
        }
        sheet.append(grid, this.foot());
    }

    // ================================================================ lounge
    lounge(sheet, G) {
        sheet.append(this.head('The Lounge', G, h('div', { text: 'Spend the evening with someone. It takes the day.' })));
        const list = h('div', { style: 'display:grid;gap:8px' });
        for (const b of BONDERS) {
            const r = G.bonds[b];
            const next = r + 1;
            const gated = next <= 4 && G.chapter < BOND_GATE[next];
            const maxed = r >= 4;
            list.append(h('div.item', { style: 'grid-template-columns:56px 1fr auto;cursor:default' }, portraitImg(`vn:${b}:neutral:0`, () => this.ui.view.portraits.person(b, 'neutral', 0), 'pf'),
                h('div', h('div.t', { text: CHARS[b].name }), h('div.rank', ...[1, 2, 3, 4].map((i) => h('i' + (i <= r ? '.on' : '')))), h('div.s', { text: r ? BOND_PERKS[b][r - 1].replace('{name}', G.name) : 'You have not spent time together yet.' })),
                h('button.btn.mini' + (maxed || gated ? '' : '.primary'), { text: maxed ? 'Max' : gated ? 'Later' : 'Hang out', disabled: maxed || gated, title: gated ? 'The story has to go further first.' : '', onclick: () => { this.ui.closeTop(); this.ui.doAct({ type: 'hangout', who: b }); } })));
        }
        sheet.append(list, this.foot());
    }

    // ================================================================ rest
    rest(sheet, G) {
        const t = tideOf(G.day), n = TIDES[(t + 1) % 8];
        sheet.append(this.head('Infirmary', G));
        sheet.append(h('p', { text: 'The infirmary has already healed everyone. Sleeping through the night passes a day, and the tide of the lattice turns.' }),
            h('div.detail', h('h4', { text: `Today: ${TIDES[t].name}` }), h('p', { text: TIDE_NOTE[t] }), h('h4', { text: `Tomorrow: ${n.name}` }), h('p', { text: TIDE_NOTE[(t + 1) % 8] })),
            h('div.sheet-foot', h('button.btn.primary', { text: 'Sleep until morning', onclick: () => { this.ui.closeTop(); this.ui.doAct({ type: 'rest' }); this.ui.toast('A new day.'); } })), this.foot());
    }
}
