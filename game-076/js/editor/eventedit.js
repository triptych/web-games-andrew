// The event editor: pages (conditions, graphic, trigger, priority, movement)
// and the command tree. Edits a copy; OK writes it back as one undo step.
import { h, modal, field, row, section, toast, clear, confirmDialog } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';
import { COMMANDS, CATS, NO_FORM, describe, branches, form } from './commands.js';
import { pickGraphic, spriteThumb, objectThumb, switchOptions, varOptions, dbOptions } from './pickers.js';
import { hasConditions, pageWarning, nextSelfKey } from './pages.js';

const TW = () => store.TW;
let clipboard = null;       // a copied command
let pageClip = null;        // a copied page

export function openEventEditor(map, ev, opts) {
    opts = opts || {};
    const S = TW().schema;
    const draft = JSON.parse(JSON.stringify(ev));
    let pi = 0;
    let sel = 0;
    let added = [];   // command types added in this session, for quests

    const root = h('div.evedit');
    const m = modal({
        title: 'Event ' + ev.id + ' — ' + (ev.name || ''), full: true, body: root, cls: 'evmodal',
        buttons: [
            { label: 'Delete event', danger: true, onClick: () => {
                confirmDialog('Delete event', 'Delete "' + draft.name + '" and all its pages?', 'Delete', true).then((yes) => {
                    if (!yes) return;
                    map.events = map.events.filter((e) => e !== ev && e.id !== ev.id);
                    store.commit('Delete event');
                    bus.emit('edit', { kind: 'eventDelete' });
                    if (opts.onSave) opts.onSave(null);
                    m.close('deleted');
                });
                return false;
            } },
            { label: 'Cancel' },
            { label: 'OK', primary: true, onClick: () => {
                // a later page with no conditions silently replaces the ones before it: ask first
                const warn = pageWarning(draft);
                if (!warn) { save(); return true; }
                confirmDialog('Check your pages', warn + ' Save it like this anyway?', 'Save anyway').then((yes) => { if (yes) { save(); m.close('ok'); } });
                return false;
            } },
        ],
    });

    function save() {
        const i = map.events.findIndex((e) => e.id === ev.id);
        if (i >= 0) map.events[i] = draft; else map.events.push(draft);
        store.commit('Edit event', { event: draft.id });
        for (const t of added) bus.emit('edit', { kind: 'commandAdd', type: t });
        bus.emit('edit', { kind: 'eventEdit', event: draft });
        if (opts.onSave) opts.onSave(draft);
    }

    function render() {
        clear(root);
        const page = draft.pages[pi];
        // header: name and page tabs
        const name = field('Name', 'text', draft.name, (v) => { draft.name = v; m.el.querySelector('.modal-head h2').textContent = 'Event ' + draft.id + ' — ' + v; }, { max: 48 });
        const tabsBar = h('div.pagetabs');
        draft.pages.forEach((pg, i) => {
            const risky = i > 0 && !hasConditions(pg);
            tabsBar.appendChild(h('button.tab' + (i === pi ? '.on' : '') + (risky ? '.warn' : ''), { text: 'Page ' + (i + 1) + (risky ? ' ⚠' : ''), title: risky ? 'No conditions: this page always replaces the pages before it' : '', on: { click: () => { pi = i; sel = 0; render(); } } }));
        });
        const canPages = meta.has('pages');
        tabsBar.appendChild(h('button.small', { text: '+ New page', title: canPages ? 'Add a page' : meta.why('pages'), disabled: !canPages || draft.pages.length >= 20, on: { click: () => {
            // a new page waits for the next free self switch, so it can't silently hide the pages before it
            const pg = S.page();
            const key = nextSelfKey(draft);
            pg.cond.self = key;
            draft.pages.push(pg); pi = draft.pages.length - 1; sel = 0; render();
            toast('Page ' + draft.pages.length + ' appears once Self Switch ' + key + ' is ON. Turn it on with Control Self Switch.', 'ok', { ms: 5000 });
            bus.emit('edit', { kind: 'pageAdd' });
        } } }));
        tabsBar.appendChild(h('button.small', { text: 'Copy page', on: { click: () => { pageClip = JSON.parse(JSON.stringify(page)); toast('Page copied'); } } }));
        tabsBar.appendChild(h('button.small', { text: 'Paste page', disabled: !pageClip || !canPages, on: { click: () => { draft.pages.splice(pi + 1, 0, JSON.parse(JSON.stringify(pageClip))); pi++; render(); } } }));
        tabsBar.appendChild(h('button.small.danger', { text: 'Delete page', disabled: draft.pages.length < 2, on: { click: () => { draft.pages.splice(pi, 1); pi = Math.max(0, pi - 1); sel = 0; render(); } } }));
        root.appendChild(h('div.evhead', name, h('span.pos', { text: '(' + draft.x + ', ' + draft.y + ')' }), tabsBar));
        const warn = pageWarning(draft);
        if (warn) root.appendChild(h('div.pagewarn', { role: 'alert' }, h('b', { text: '⚠ ' }), warn + ' Give it a condition (such as a self switch) or delete it.'));

        // left column: page settings
        const left = h('div.evleft');
        left.appendChild(conditions(page));
        left.appendChild(graphic(page));
        left.appendChild(behaviour(page));
        // right column: command list
        const right = h('div.evright', commandList(page));
        root.appendChild(h('div.evcols', left, right));
    }

    function lockOpt(value, label, feat, cur) {
        const ok = !feat || meta.has(feat) || cur === value;
        return [value, label + (ok ? '' : ' 🔒'), !ok];
    }

    function conditions(page) {
        const c = page.cond;
        const can = meta.has('conditions');
        const used = c.sw1 || c.sw2 || c.var || c.item || c.actor;
        const sec = section('Conditions');
        if (!can && !used) sec.appendChild(h('p.hint', { text: 'Pages that wait for switches, variables and items: ' + meta.why('conditions') + '.' }));
        if (can || used) {
            sec.appendChild(row(field('Switch', 'select', c.sw1, (v) => { c.sw1 = v; }, { numeric: true, options: switchOptions(true) }), field('Switch', 'select', c.sw2, (v) => { c.sw2 = v; }, { numeric: true, options: switchOptions(true) })));
            sec.appendChild(row(field('Variable', 'select', c.var, (v) => { c.var = v; }, { numeric: true, options: varOptions(true) }), field('', 'select', c.varOp, (v) => { c.varOp = v; }, { options: ['>=', '<=', '=', '!=', '>', '<'] }), field('Value', 'number', c.varVal, (v) => { c.varVal = v; })));
            sec.appendChild(row(field('Item held', 'select', c.item, (v) => { c.item = v; }, { numeric: true, options: dbOptions(store.project.items, true) }), field('Hero in party', 'select', c.actor, (v) => { c.actor = v; }, { numeric: true, options: dbOptions(store.project.actors, true) })));
        }
        sec.appendChild(field('Self switch', 'select', c.self, (v) => { c.self = v; }, { options: [['', '(none)']].concat(['A', 'B', 'C', 'D'].map((k) => lockOpt(k, k + ' is ON', 'pages', c.self))) }));
        sec.appendChild(h('p.hint', { text: 'The game shows the last page whose conditions are all true.' }));
        if (pi > 0 && !hasConditions(page)) sec.appendChild(h('p.hint.warn', { text: 'This page has no conditions, so it is always true and the pages before it are never used.' }));
        return sec;
    }

    function graphic(page) {
        const g = page.gfx;
        const thumb = g.kind === 'char' ? spriteThumb(g.id, 3, g.dir) : g.kind === 'obj' ? objectThumb(g.id, 3) : h('div.nothumb.big', { text: '∅' });
        const label = g.kind === 'char' ? TW().sprites.spriteName(g.id) : g.kind === 'obj' ? (TW().sprites.OBJECTS[g.id] || {}).name : 'None (invisible)';
        return section('Graphic', h('div.gfxrow', h('button.gfxbtn', { title: 'Choose a graphic', on: { click: () => pickGraphic(g, (n) => { page.gfx = n; render(); }) } }, thumb), h('div', h('div', { text: label || '' }), h('button.small', { text: 'Choose…', on: { click: () => pickGraphic(g, (n) => { page.gfx = n; render(); }) } }))));
    }

    function behaviour(page) {
        const sec = section('Trigger & movement');
        sec.appendChild(row(
            field('Trigger', 'select', page.trigger, (v) => { page.trigger = v; }, { options: [lockOpt('action', 'Action (press OK)'), lockOpt('touch', 'Touch (walk into it)'), lockOpt('autorun', 'Autorun', 'trigger.auto', page.trigger), lockOpt('parallel', 'Parallel', 'trigger.auto', page.trigger)] }),
            field('Priority', 'select', page.priority, (v) => { page.priority = v; }, { options: [['same', 'Same as hero (blocks)'], ['below', 'Below hero (walk over)'], ['above', 'Above hero']] })));
        sec.appendChild(row(
            field('Movement', 'select', page.move, (v) => { page.move = v; }, { options: [lockOpt('fixed', 'Fixed'), lockOpt('random', 'Random (wanders)', 'movement', page.move), lockOpt('approach', 'Approach the hero', 'movement', page.move)] }),
            field('Speed', 'select', page.speed, (v) => { page.speed = v; }, { numeric: true, options: [[1, '1 slowest'], [2, '2 slow'], [3, '3 normal'], [4, '4 fast'], [5, '5 fastest']] })));
        sec.appendChild(h('div.row.checks',
            field('Walking animation', 'check', page.walkAnim, (v) => { page.walkAnim = v; }),
            field('Step in place', 'check', page.stepAnim, (v) => { page.stepAnim = v; }),
            field('Direction fix', 'check', page.dirFix, (v) => { page.dirFix = v; }, { title: 'Don\'t turn to face the hero' }),
            field('Through', 'check', page.through, (v) => { page.through = v; }, { title: 'Walks through walls and others' })));
        if (page.trigger === 'autorun') sec.appendChild(h('p.hint.warn', { text: 'Autorun events run again and again while this page is active. End with a switch or self switch that changes the page, or Erase Event.' }));
        return sec;
    }

    // ── the command tree ──
    function flatten(list, depth, out) {
        list.forEach((c, i) => {
            out.push({ kind: 'cmd', list, i, depth, c });
            const br = branches(c);
            if (br.length) {
                for (const [label, key, idx] of br) {
                    const sub = idx === undefined ? c[key] : c[key][idx];
                    if (!sub) continue;
                    out.push({ kind: 'branch', depth, label });
                    flatten(sub, depth + 1, out);
                }
                out.push({ kind: 'close', depth, label: c.t === 'if' ? 'End' : c.t === 'choice' ? 'End Choices' : 'End Battle' });
            }
        });
        out.push({ kind: 'end', list, i: list.length, depth });
        return out;
    }

    function commandList(page) {
        const rows = flatten(page.list, 0, []);
        sel = Math.max(0, Math.min(sel, rows.length - 1));
        while (rows[sel] && (rows[sel].kind === 'branch' || rows[sel].kind === 'close')) sel++;
        const box = h('div.cmdlist', { tabindex: 0, role: 'listbox', 'aria-label': 'Commands' });
        rows.forEach((r, k) => {
            let el;
            const pad = { paddingLeft: 8 + r.depth * 18 + 'px' };
            if (r.kind === 'cmd') {
                const meta2 = COMMANDS[r.c.t] || {};
                el = h('div.crow.cmd' + (k === sel ? '.sel' : ''), { style: pad, role: 'option', 'data-t': r.c.t }, h('span.cicon', { text: meta2.icon || '◆' }), h('span.ctext', { text: describe(r.c) }));
            } else if (r.kind === 'end') el = h('div.crow.end' + (k === sel ? '.sel' : ''), { style: pad, role: 'option', title: 'Insert here' }, h('span.cicon', { text: '◆' }), h('span.ctext.dim', { text: '' }));
            else el = h('div.crow.' + r.kind, { style: { paddingLeft: 8 + r.depth * 18 + 'px' } }, h('span.ctext', { text: (r.kind === 'branch' ? ': ' : ': ') + r.label }));
            if (r.kind === 'cmd' || r.kind === 'end') {
                el.addEventListener('click', () => { sel = k; for (const x of box.children) x.classList.remove('sel'); el.classList.add('sel'); });
                el.addEventListener('dblclick', () => { sel = k; if (r.kind === 'end') insert(); else edit(); });
            }
            box.appendChild(el);
        });
        box.addEventListener('keydown', (e) => {
            const move = (d) => { let k = sel + d; while (rows[k] && rows[k].kind !== 'cmd' && rows[k].kind !== 'end') k += d; if (rows[k]) { sel = k; render(); focusList(); } };
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rows[sel].kind === 'end' ? insert() : edit(); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copy(); }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); paste(); }
            else if (e.key === 'Insert') { e.preventDefault(); insert(); }
        });
        const cur = () => rows[sel];
        function insertAt(c) {
            const r = cur();
            if (!r || (r.kind !== 'cmd' && r.kind !== 'end')) return;
            r.list.splice(r.i, 0, c);
            added.push(c.t);
            sel++;
            if (branches(c).length) sel = rows.indexOf(r) + 1; // land inside the new branch next time
            render(); focusList();
        }
        function insert() {
            pickCommand((t) => {
                const c = S.command(t);
                if (t === 'transfer' && !c.map) { c.map = map.id; c.x = draft.x; c.y = draft.y; }
                if (t === 'text' && page.gfx.kind === 'char') { c.face = page.gfx.id; c.speaker = draft.name.startsWith('EV') ? '' : draft.name; }
                if (NO_FORM.has(t)) insertAt(c);
                else editForm(c, (done) => insertAt(done), true);
            });
        }
        function edit() {
            const r = cur();
            if (!r || r.kind !== 'cmd') { insert(); return; }
            if (NO_FORM.has(r.c.t)) return;
            editForm(JSON.parse(JSON.stringify(r.c)), (done) => { r.list[r.i] = done; render(); focusList(); });
        }
        function del() { const r = cur(); if (!r || r.kind !== 'cmd') return; r.list.splice(r.i, 1); render(); focusList(); }
        function copy() { const r = cur(); if (r && r.kind === 'cmd') { clipboard = JSON.parse(JSON.stringify(r.c)); toast('Command copied'); } }
        function paste() {
            if (!clipboard) return;
            const f = (COMMANDS[clipboard.t] || {}).f;
            if (f && !meta.has(f)) { toast('That command is locked: ' + meta.why(f), 'warn'); return; }
            insertAt(JSON.parse(JSON.stringify(clipboard)));
        }
        function shift(d) {
            const r = cur();
            if (!r || r.kind !== 'cmd') return;
            const j = r.i + d;
            if (j < 0 || j >= r.list.length) return;
            const [c] = r.list.splice(r.i, 1);
            r.list.splice(j, 0, c);
            render();
            const rows2 = flatten(page.list, 0, []);
            sel = rows2.findIndex((x) => x.kind === 'cmd' && x.c === c);
            render(); focusList();
        }
        const tools = h('div.cmdtools',
            h('button.primary.small', { text: '+ Insert', title: 'Insert a command above the selection (Insert / double-click ◆)', on: { click: insert } }),
            h('button.small', { text: 'Edit', title: 'Edit (Enter / double-click)', on: { click: edit } }),
            h('button.small', { text: '↑', title: 'Move up', on: { click: () => shift(-1) } }),
            h('button.small', { text: '↓', title: 'Move down', on: { click: () => shift(1) } }),
            h('button.small', { text: 'Copy', on: { click: copy } }),
            h('button.small', { text: 'Paste', on: { click: paste } }),
            h('button.small.danger', { text: 'Delete', on: { click: del } }));
        return h('div.cmdwrap', h('div.cmdhead', h('b', { text: 'Commands' }), tools), box);
    }
    function focusList() { setTimeout(() => { const b = root.querySelector('.cmdlist'); if (b) { b.focus(); const s = b.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' }); } }, 0); }

    function editForm(c, onOk, isNew) {
        const meta2 = COMMANDS[c.t] || { label: c.t };
        modal({ title: (isNew ? 'New: ' : 'Edit: ') + meta2.label, body: form(c, { map, event: draft }), wide: c.t === 'route' || c.t === 'text', buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: () => onOk(c) }] });
    }

    render();
    focusList();
    return m;
}

/** The command picker, grouped by category, with locks. */
export function pickCommand(onPick) {
    const body = h('div.cmdpicker');
    let mm = null;
    for (const [cat, label] of CATS) {
        const grid = h('div.cmdgrid');
        for (const [t, c] of Object.entries(COMMANDS)) {
            if (c.cat !== cat) continue;
            const ok = meta.has(c.f);
            grid.appendChild(h('button.cmdbtn' + (ok ? '' : '.locked'), { title: ok ? c.label : c.label + ' — ' + meta.why(c.f), 'data-cmd': t, on: { click: () => { if (!ok) { toast(c.label + ': ' + meta.why(c.f), 'warn'); return; } mm.close('pick'); onPick(t); } } }, h('span.cicon', { text: c.icon }), h('span', { text: c.label }), ok ? null : h('span.lock', { text: '🔒' })));
        }
        body.appendChild(h('div.cmdcat', h('h3', { text: label }), grid));
    }
    mm = modal({ title: 'Insert a command', wide: true, body });
}
