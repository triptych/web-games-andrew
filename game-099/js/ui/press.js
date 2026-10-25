// The Sticker Press: make and change stickers without writing code.
//
// A sticker is a 12×12 picture, a few numbers and a stack of rules. Each rule is an event block
// (gold) with action blocks under it. Tap a block in the strip to add it to the highlighted
// rule, or drag it in. The picture above is a live test stage: change a block and the sticker
// is rebuilt there straight away.

import { $ } from './screens.js';
import { PAL, HEX, ART, LIMITS } from '../config.js';
import { byId } from '../sim/stickers.js';
import { defsFor, paletteList, blankArt, allTags } from '../sim/cart.js';
import {
    HATS, ACTS, CONDS, CATS, TAGS, OPS, WHOS,
    makeHat, makeAct, makeCond, makeRule, holdsOf, countBlocks,
} from '../sim/blocks.js';
import { newWorld } from '../sim/world.js';

const CAT_NAME = { events: 'Events', move: 'Move', fight: 'Fight', look: 'Look', world: 'World', logic: 'Logic' };
const OP_NAME = { '>=': '≥', '<=': '≤', '==': '=' };
const WHO_NAME = { me: 'me', it: 'it', nearest: 'nearest', around: 'all within' };
const clone = (v) => JSON.parse(JSON.stringify(v));

export function createPress(host) {
    const { audio, input } = host;
    let cart = null, id = null, def = null;
    let cat = 'events';
    let active = null;                 // the list new blocks go into
    let sbTimer = 0, restartAt = 0;
    let color = 2, artTool = 'paint', mirror = false;

    // ------------------------------------------------------------------ the test stage
    function build() {
        const defs = defsFor(cart);
        const sb = { ...cart, stickers: { ...cart.stickers, [id]: { ...def, builtin: false } } };
        const hero = def.tags.includes('hero') ? null : 'princess';
        const items = [];
        const at = (sid, x, y) => { if (sid !== id) items.push({ sid, x, y }); };
        if (hero) at(hero, 4.5, 7.5);
        const s = def.size === 2 ? 1 : 0.5;
        items.push({ sid: id, x: def.tags.includes('hero') ? 5.5 : 13 + s, y: 7 + s });
        at('goblin', 20.5, 4.5); at('slime', 19.5, 10.5);
        at('tree', 9.5, 3.5); at('tree', 9.5, 11.5); at('chest', 16.5, 12.5); at('coin', 12.5, 12.5);
        sb.scenes = [{ name: 'Test', bg: 'meadow', items }];
        void defs;
        const w = newWorld(sb, 0, 5);
        host.setWorld(w);
        return w;
    }
    function restart() { build(); }
    function touch() {
        if (cart.stickers[id] !== def) {
            def.override = !!byId[id];
            if (byId[id]) def.cat = byId[id].cat;
            cart.stickers[id] = def;
        }
        host.persist();
        clearTimeout(sbTimer);
        sbTimer = setTimeout(build, 160);
    }

    // ------------------------------------------------------------------ entering
    function enter(c, stickerId) {
        cart = c; id = stickerId;
        const stored = cart.stickers[id];
        def = stored || clone(byId[id] || defsFor(cart)[id]);
        def.tags = def.tags || [];
        active = def.rules.length ? def.rules[def.rules.length - 1].body : null;
        $('pr-name').value = def.name;
        $('pr-reset').hidden = !(byId[id] && cart.stickers[id]);
        $('pr-del').hidden = !!byId[id];
        renderAll();
        build();
    }

    function renderAll() {
        renderSwatches(); drawArt(); renderStats(); renderTags(); renderTabs(); renderStrip(); renderRules();
    }

    // ------------------------------------------------------------------ header
    $('pr-name').addEventListener('input', (e) => { def.name = e.target.value.slice(0, LIMITS.name) || 'Sticker'; touch(); });
    $('pr-reset').addEventListener('click', () => {
        if (!confirm('Put this sticker back to how it came?')) return;
        delete cart.stickers[id];
        host.persist();
        enter(cart, id);
    });
    $('pr-del').addEventListener('click', () => {
        if (!confirm(`Delete "${def.name}" and take it off every scene?`)) return;
        delete cart.stickers[id];
        for (const sc of cart.scenes) sc.items = sc.items.filter((it) => it.sid !== id);
        host.persist();
        $('pr-done').click();
    });
    $('pr-restart').addEventListener('click', () => { audio.ui('click'); restart(); });
    for (const b of $('pr-pad').querySelectorAll('[data-dx]')) input.bindPad(b, +b.dataset.dx, +b.dataset.dy);
    for (const b of $('pr-pad').querySelectorAll('[data-btn]')) input.bindButton(b, b.dataset.btn);

    // ------------------------------------------------------------------ pixel art
    const art = $('pr-art');
    const actx = art.getContext('2d');
    function renderSwatches() {
        const box = $('pr-swatches');
        box.textContent = '';
        PAL.forEach((hex, i) => {
            const b = document.createElement('button');
            b.style.background = hex;
            b.setAttribute('aria-label', `Colour ${i + 1}`);
            if (i === color) b.className = 'on';
            b.addEventListener('click', () => { color = i; artTool = 'paint'; syncArtTools(); renderSwatches(); });
            box.append(b);
        });
    }
    function syncArtTools() {
        for (const b of $('pr-arttools').children) {
            const t = b.dataset.t;
            b.classList.toggle('on', t === artTool || (t === 'mirror' && mirror));
        }
    }
    function drawArt() {
        actx.clearRect(0, 0, ART, ART);
        for (let y = 0; y < ART; y++) {
            for (let x = 0; x < ART; x++) {
                const ch = def.art[y][x];
                if (ch === '.') continue;
                actx.fillStyle = PAL[HEX.indexOf(ch)];
                actx.fillRect(x, y, 1, 1);
            }
        }
        syncArtTools();
    }
    function setPx(x, y, ch) {
        if (x < 0 || y < 0 || x >= ART || y >= ART) return;
        const row = def.art[y];
        if (row[x] === ch) return;
        def.art[y] = row.slice(0, x) + ch + row.slice(x + 1);
    }
    function paintAt(e) {
        const r = art.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * ART), y = Math.floor(((e.clientY - r.top) / r.height) * ART);
        const ch = artTool === 'erase' ? '.' : HEX[color];
        setPx(x, y, ch);
        if (mirror) setPx(ART - 1 - x, y, ch);
        drawArt();
    }
    let painting = false;
    art.addEventListener('pointerdown', (e) => { painting = true; try { art.setPointerCapture(e.pointerId); } catch { /* synthetic */ } paintAt(e); e.preventDefault(); });
    art.addEventListener('pointermove', (e) => { if (painting) paintAt(e); });
    const endPaint = () => { if (painting) { painting = false; touch(); } };
    art.addEventListener('pointerup', endPaint);
    art.addEventListener('pointercancel', endPaint);
    $('pr-arttools').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const t = b.dataset.t;
        if (t === 'paint' || t === 'erase') artTool = t;
        else if (t === 'mirror') mirror = !mirror;
        else if (t === 'flip') def.art = def.art.map((r) => [...r].reverse().join(''));
        else if (t === 'clear') { if (!confirm('Wipe the picture?')) return; def.art = blankArt(); }
        drawArt();
        if (t === 'flip' || t === 'clear') touch();
    });

    // ------------------------------------------------------------------ stats and tags
    function stepper(host_, value, min, max, step, onSet) {
        host_.textContent = '';
        const fmt = (v) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(v));
        const out = document.createElement('b');
        const set = (v) => { v = Math.min(max, Math.max(min, Math.round(v / step) * step)); value = +v.toFixed(2); out.textContent = fmt(value); onSet(value); };
        const mk = (t, d, label) => {
            const b = document.createElement('button');
            b.textContent = t; b.setAttribute('aria-label', label); b.type = 'button';
            b.addEventListener('click', () => set(value + d * step));
            return b;
        };
        out.textContent = fmt(value);
        host_.append(mk('−', -1, 'less'), out, mk('+', 1, 'more'));
    }
    function renderStats() {
        $('pr-size').value = String(def.size);
        $('pr-solid').checked = !!def.solid;
        stepper($('pr-hp'), def.hp, 1, 99, 1, (v) => { def.hp = v; touch(); });
        stepper($('pr-speed'), def.speed, 0, 9, 0.5, (v) => { def.speed = v; touch(); });
    }
    $('pr-size').addEventListener('change', (e) => { def.size = e.target.value === '2' ? 2 : 1; touch(); });
    $('pr-solid').addEventListener('change', (e) => { def.solid = e.target.checked; touch(); });

    function renderTags() {
        const box = $('pr-tags');
        box.textContent = '';
        const list = [...new Set([...TAGS, ...allTags(cart).filter((t) => t !== 'solid'), ...def.tags])];
        for (const t of list) {
            const b = document.createElement('button');
            b.textContent = t; b.type = 'button';
            const on = def.tags.includes(t);
            b.className = on ? 'on' : '';
            b.setAttribute('aria-pressed', String(on));
            b.addEventListener('click', () => {
                def.tags = on ? def.tags.filter((x) => x !== t) : [...def.tags, t].slice(0, 8);
                touch(); renderTags(); renderRules();
            });
            box.append(b);
        }
    }
    $('pr-addtag').addEventListener('click', () => {
        const el = $('pr-newtag');
        const t = el.value.trim().toLowerCase();
        if (!/^[a-z0-9_]{1,12}$/.test(t)) { host.toast('Tags are letters and numbers, up to 12.'); return; }
        if (!def.tags.includes(t) && def.tags.length < 8) def.tags.push(t);
        el.value = '';
        touch(); renderTags();
    });

    // ------------------------------------------------------------------ the block strip
    const chipText = (spec) => spec.label.map((t) => (t.startsWith('$') ? '…' : t)).join(' ').replace(/(… ?){2,}/g, '… ');

    function renderTabs() {
        const box = $('bk-tabs');
        box.textContent = '';
        for (const c of CATS) {
            const b = document.createElement('button');
            b.dataset.cat = c; b.textContent = CAT_NAME[c]; b.type = 'button';
            b.className = c === cat ? 'on' : '';
            b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(c === cat));
            b.addEventListener('click', () => { cat = c; renderTabs(); renderStrip(); });
            box.append(b);
        }
    }
    function renderStrip() {
        const box = $('bk-palette');
        box.textContent = '';
        const entries = cat === 'events'
            ? Object.entries(HATS).map(([t, s]) => ['hat', t, s])
            : Object.entries(ACTS).filter(([, s]) => s.cat === cat && !s.hidden).map(([t, s]) => ['act', t, s]);
        for (const [kind, t, spec] of entries) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `chip cat-${spec.cat}`;
            b.style.background = 'var(--c)';
            b.textContent = chipText(spec);
            b.dataset.block = t;
            b.addEventListener('pointerdown', (e) => beginDrag(e, { kind: 'new', block: kind, t }, chipText(spec), spec.cat));
            b.addEventListener('click', (e) => { if (e.detail === 0) addBlock(kind, t); });   // keyboard
            box.append(b);
        }
        $('bk-hint').textContent = def.rules.length
            ? 'Tap a block to add it to the lit rule, or drag it into one.'
            : 'Start with a gold Event block: it says when something happens.';
    }

    // ------------------------------------------------------------------ adding blocks
    function addBlock(kind, t, list = null, index = null) {
        if (kind === 'hat') {
            if (def.rules.length >= LIMITS.rules) { host.toast(`A sticker holds ${LIMITS.rules} rules.`); return; }
            const rule = { hat: makeHat(t), body: [] };
            def.rules.push(rule);
            active = rule.body;
        } else {
            list = list || active;
            if (!list) {
                if (!def.rules.length) { def.rules.push(makeRule('always')); }
                list = active = def.rules[def.rules.length - 1].body;
            }
            const rule = def.rules.find((r) => ownsList(r.body, list));
            if (rule && countBlocks(rule.body) >= LIMITS.blocks) { host.toast('That rule is full.'); return; }
            if (depthOf(list) >= LIMITS.depth) { host.toast('Blocks nest only so deep.'); return; }
            const b = makeAct(t);
            if (index == null) list.push(b); else list.splice(index, 0, b);
            if (t === 'if' || t === 'repeat') active = holdsOf(b)[0][1];
        }
        audio.ui('place');
        touch(); renderRules();
        requestAnimationFrame(() => $('rules').querySelector('.slot.active')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    }
    const ownsList = (root, list) => root === list || root.some((b) => holdsOf(b).some(([, sub]) => ownsList(sub, list)));
    function depthOf(list) {
        let d = 0;
        for (const r of def.rules) {
            const walk = (l, depth) => {
                if (l === list) { d = depth; return true; }
                return l.some((b) => holdsOf(b).some(([, sub]) => walk(sub, depth + 1)));
            };
            if (walk(r.body, 0)) break;
        }
        return d;
    }

    // ------------------------------------------------------------------ drag and drop (pointer based, so touch works)
    let drag = null;
    function beginDrag(e, payload, text, catName) {
        if (e.button) return;
        drag = { payload, sx: e.clientX, sy: e.clientY, started: false, text, cat: catName, ghost: null, over: null, id: e.pointerId };
        window.addEventListener('pointermove', dragMove);
        window.addEventListener('pointerup', dragEnd);
        window.addEventListener('pointercancel', dragCancel);
    }
    function slotAt(x, y) {
        const el = document.elementFromPoint(x, y);
        return el?.closest?.('.slot') || null;
    }
    function dragMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.started) {
            if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
            drag.started = true;
            const g = document.createElement('div');
            g.className = `blk cat-${drag.cat} dragghost`;
            g.textContent = drag.text;
            document.body.append(g);
            drag.ghost = g;
        }
        e.preventDefault();
        drag.ghost.style.left = e.clientX + 'px';
        drag.ghost.style.top = e.clientY + 'px';
        const s = slotAt(e.clientX, e.clientY);
        if (s !== drag.over) { drag.over?.classList.remove('over'); drag.over = s; s?.classList.add('over'); }
    }
    function cleanup() {
        window.removeEventListener('pointermove', dragMove);
        window.removeEventListener('pointerup', dragEnd);
        window.removeEventListener('pointercancel', dragCancel);
        drag?.ghost?.remove();
        drag?.over?.classList.remove('over');
    }
    function dragCancel() { cleanup(); drag = null; }
    function dragEnd(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        cleanup();
        drag = null;
        const p = d.payload;
        if (!d.started) {                                   // a tap
            if (p.kind === 'new') addBlock(p.block, p.t);
            return;
        }
        const slot = slotAt(e.clientX, e.clientY);
        if (p.kind === 'new') {
            if (p.block === 'hat') { if ($('rules').contains(slot) || document.elementFromPoint(e.clientX, e.clientY)?.closest('#rules')) addBlock('hat', p.t); return; }
            if (!slot) return;
            addBlock('act', p.t, slot._list, insertIndex(slot, e.clientY));
        } else if (p.kind === 'move' && slot) {
            const moved = p.list[p.index];
            const target = slot._list;
            if (holdsOf(moved).some(([, sub]) => ownsList(sub, target))) { host.toast('A block cannot go inside itself.'); return; }
            let at = insertIndex(slot, e.clientY);
            p.list.splice(p.index, 1);
            if (target === p.list && p.index < at) at--;
            target.splice(at, 0, moved);
            active = target;
            audio.ui('place');
            touch(); renderRules();
        }
    }
    function insertIndex(slot, y) {
        const kids = [...slot.children].filter((k) => k.classList.contains('blkwrap'));
        let i = 0;
        for (const k of kids) { const r = k.getBoundingClientRect(); if (r.top + r.height / 2 < y) i++; }
        return i;
    }

    // ------------------------------------------------------------------ parameter controls
    function opt(options, value, onSet, names = {}) {
        const s = document.createElement('select');
        for (const o of options) s.add(new Option(names[o] ?? o, o));
        if (!options.includes(value)) s.add(new Option(String(value), value));
        s.value = value;
        s.addEventListener('change', () => { onSet(s.value); touch(); });
        return s;
    }
    const tagOptions = () => [...new Set([...allTags(cart), ...Object.keys(defsFor(cart)).map((k) => k.toLowerCase())])];
    const stickerOptions = () => paletteList(cart).map((d) => d.id);

    function control(p, obj, key, rerender) {
        switch (p.type) {
            case 'num': {
                const h = document.createElement('span');
                h.className = 'stepper';
                stepper(h, obj[key], p.min, p.max, p.step, (v) => { obj[key] = v; touch(); });
                return h;
            }
            case 'opt': return opt(p.opts, obj[key], (v) => { obj[key] = v; }, OP_NAME);
            case 'tag': return opt(tagOptions(), obj[key], (v) => { obj[key] = v; });
            case 'sid': {
                const names = Object.fromEntries(paletteList(cart).map((d) => [d.id, d.name]));
                return opt(stickerOptions(), obj[key], (v) => { obj[key] = v; }, names);
            }
            case 'text': {
                const i = document.createElement('input');
                i.type = 'text'; i.maxLength = LIMITS.text; i.value = obj[key]; i.setAttribute('aria-label', 'Words');
                i.addEventListener('input', () => { obj[key] = i.value.replace(/[<>]/g, ''); touch(); });
                return i;
            }
            case 'who': {
                const w = obj[key];
                const span = document.createElement('span');
                span.className = 'cond';
                span.append(opt(WHOS, w.m, (v) => { w.m = v; rerender(); }, WHO_NAME));
                if (w.m === 'nearest' || w.m === 'around') span.append(opt(tagOptions(), w.tag, (v) => { w.tag = v; }));
                if (w.m === 'around') {
                    const st = document.createElement('span');
                    st.className = 'stepper';
                    stepper(st, w.r, 1, 12, 0.5, (v) => { w.r = v; touch(); });
                    span.append(st);
                }
                return span;
            }
            default: return document.createTextNode('?');
        }
    }

    function labelParts(spec, obj, rerender, parent) {
        for (const tok of spec.label) {
            if (!tok.startsWith('$')) {
                const s = document.createElement('span');
                s.textContent = tok;
                parent.append(s);
                continue;
            }
            const k = tok.slice(1);
            if (k === 'c') parent.append(condEditor(obj, rerender));
            else parent.append(control(spec.params[k], obj, k, rerender));
        }
    }

    function condEditor(b, rerender) {
        const wrap = document.createElement('span');
        wrap.className = 'cond';
        const c = b.c;
        const not = document.createElement('label');
        not.className = 'not';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = c.neg;
        cb.addEventListener('change', () => { c.neg = cb.checked; touch(); });
        not.append(cb, document.createTextNode('not'));
        const kinds = Object.keys(CONDS);
        const names = Object.fromEntries(kinds.map((k) => [k, CONDS[k].label.filter((t) => !t.startsWith('$')).join(' ') || k]));
        const sel = opt(kinds, c.t, (v) => { b.c = { ...makeCond(v), neg: c.neg }; rerender(); }, names);
        wrap.append(not, sel);
        const spec = CONDS[c.t];
        for (const tok of spec.label.slice(1)) {
            if (!tok.startsWith('$')) { const s = document.createElement('span'); s.textContent = tok; wrap.append(s); }
            else wrap.append(control(spec.params[tok.slice(1)], c, tok.slice(1), rerender));
        }
        return wrap;
    }

    // ------------------------------------------------------------------ rules
    function makeSlot(list) {
        const slot = document.createElement('div');
        slot.className = 'slot' + (list === active ? ' active' : '');
        slot._list = list;
        slot.setAttribute('aria-label', 'Blocks go here');
        list.forEach((b, i) => slot.append(renderBlock(b, list, i)));
        if (!list.length) {
            const e = document.createElement('div');
            e.className = 'empty';
            e.textContent = 'drop blocks here';
            slot.append(e);
        }
        slot.addEventListener('click', (e) => {
            if (e.target === slot || e.target.classList.contains('empty')) { active = list; markActive(); }
        });
        return slot;
    }
    function markActive() {
        for (const s of $('rules').querySelectorAll('.slot')) s.classList.toggle('active', s._list === active);
    }

    function renderBlock(b, list, i) {
        const spec = ACTS[b.t];
        const wrap = document.createElement('div');
        wrap.className = 'blkwrap';
        const el = document.createElement('div');
        el.className = `blk cat-${spec.cat}`;
        const grip = document.createElement('button');
        grip.className = 'grip'; grip.type = 'button'; grip.textContent = '⠿';
        grip.setAttribute('aria-label', 'Drag to move');
        grip.addEventListener('pointerdown', (e) => beginDrag(e, { kind: 'move', list, index: list.indexOf(b) }, chipText(spec), spec.cat));
        el.append(grip);
        labelParts(spec, b, renderRules, el);
        const x = document.createElement('button');
        x.className = 'x'; x.type = 'button'; x.textContent = '✕';
        x.setAttribute('aria-label', 'Remove block');
        x.addEventListener('click', () => { list.splice(list.indexOf(b), 1); if (active && !ownsAny(active)) active = null; audio.ui('erase'); touch(); renderRules(); });
        el.append(x);
        wrap.append(el);
        for (const [name, sub] of holdsOf(b)) {
            if (name === 'else') { const l = document.createElement('div'); l.className = 'dim'; l.style.marginLeft = '14px'; l.textContent = 'otherwise'; wrap.append(l); }
            wrap.append(makeSlot(sub));
        }
        return wrap;
    }
    const ownsAny = (list) => def.rules.some((r) => ownsList(r.body, list));

    function renderRules() {
        const box = $('rules');
        const scroll = $('press-panel').scrollTop;
        box.textContent = '';
        if (active && !ownsAny(active)) active = null;
        def.rules.forEach((rule, ri) => box.append(renderRule(rule, ri)));
        if (!def.rules.length) {
            const p = document.createElement('p');
            p.className = 'dim';
            p.textContent = 'This sticker does nothing yet. Add an Event block, like “always”, then give it actions.';
            box.append(p);
        }
        $('bk-hint').textContent = def.rules.length
            ? 'Tap a block to add it to the lit rule, or drag it into one.'
            : 'Start with a gold Event block: it says when something happens.';
        $('press-panel').scrollTop = scroll;
    }

    function renderRule(rule, ri) {
        const card = document.createElement('div');
        card.className = 'rule';
        const head = document.createElement('div');
        head.className = 'rule-head';
        const hat = document.createElement('div');
        hat.className = 'blk hat cat-events';
        labelParts(HATS[rule.hat.t], rule.hat, renderRules, hat);
        head.append(hat);
        const tools = document.createElement('div');
        tools.className = 'rule-tools';
        const tool = (t, label, fn) => {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', label);
            b.addEventListener('click', fn);
            tools.append(b);
        };
        tool('▲', 'Move rule up', () => { if (ri > 0) { [def.rules[ri - 1], def.rules[ri]] = [def.rules[ri], def.rules[ri - 1]]; touch(); renderRules(); } });
        tool('▼', 'Move rule down', () => { if (ri < def.rules.length - 1) { [def.rules[ri + 1], def.rules[ri]] = [def.rules[ri], def.rules[ri + 1]]; touch(); renderRules(); } });
        tool('✕', 'Remove rule', () => { def.rules.splice(ri, 1); audio.ui('erase'); touch(); renderRules(); });
        head.append(tools);
        card.append(head, makeSlot(rule.body));
        card.addEventListener('pointerdown', (e) => {
            const s = e.target.closest('.slot');
            active = s && card.contains(s) ? s._list : rule.body;
            markActive();
        }, true);
        return card;
    }

    return {
        enter, restart,
        get def() { return def; },
        get id() { return id; },
        /** For tests: add a block the way a tap on the strip does. */
        addBlock,
    };
}
