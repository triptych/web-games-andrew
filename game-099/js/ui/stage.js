// The Stage: where stickers are stuck into scenes. The picture shows an un-stepped world built
// from the scene's items, so what you see is exactly what the game starts with. Tap to stick,
// drag to move, rub to erase; ▶ Play runs the cart from the first scene.

import { $ } from './screens.js';
import { THEMES, LIMITS } from '../config.js';
import { iconCanvas } from '../view/sprites.js';
import { paletteList, defsFor, snap, newScene } from '../sim/cart.js';
import { newWorld } from '../sim/world.js';

const GROUPS = [['hero', 'Heroes'], ['friend', 'Friends'], ['foe', 'Foes'], ['place', 'Places'], ['prop', 'Props'], ['item', 'Items'], ['magic', 'Magic'], ['mine', 'Mine']];

export function createStage(host) {
    const { view, audio } = host;
    let cart = null, idx = 0, tool = 'place', sel = null, selSid = 'tree';
    let hover = null, down = false, lastKey = '', dragging = null, world = null, saveTimer = 0;

    const scene = () => cart.scenes[idx];
    const defs = () => defsFor(cart);

    function changed(soft = false) {
        world = newWorld(cart, idx, 1);
        host.setWorld(world);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => host.persist(), 250);
        if (!soft) renderSel();
    }

    // ------------------------------------------------------------------ panel
    function renderTabs() {
        const t = $('scene-tabs');
        t.textContent = '';
        cart.scenes.forEach((sc, i) => {
            const b = document.createElement('button');
            b.textContent = String(i + 1);
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-label', `Scene ${i + 1}: ${sc.name}`);
            b.setAttribute('aria-selected', String(i === idx));
            if (i === idx) b.className = 'on';
            b.addEventListener('click', () => { audio.ui('click'); goScene(i); });
            t.append(b);
        });
        if (cart.scenes.length < LIMITS.scenes) {
            const b = document.createElement('button');
            b.textContent = '＋';
            b.setAttribute('aria-label', 'Add a scene');
            b.addEventListener('click', () => {
                audio.ui('click');
                cart.scenes.push(newScene(`Scene ${cart.scenes.length + 1}`, THEMES[cart.scenes.length % THEMES.length]));
                goScene(cart.scenes.length - 1);
            });
            t.append(b);
        }
    }

    function renderPalette() {
        const p = $('palette');
        p.textContent = '';
        const all = paletteList(cart);
        for (const [cat, title] of GROUPS) {
            const mine = all.filter((d) => (d.builtin ? d.cat : 'mine') === cat);
            if (!mine.length) continue;
            const h = document.createElement('h4');
            h.textContent = title;
            p.append(h);
            for (const d of mine) {
                const b = document.createElement('button');
                b.className = 'stk' + (d.id === selSid ? ' on' : '') + (d.builtin ? '' : ' mine');
                b.dataset.sid = d.id;
                b.setAttribute('aria-label', d.name);
                b.setAttribute('aria-pressed', String(d.id === selSid));
                b.append(iconCanvas(d, 36));
                const t = document.createElement('span');
                t.textContent = d.name;
                b.append(t);
                b.addEventListener('click', () => { audio.ui('click'); selSid = d.id; setTool('place'); renderPalette(); });
                p.append(b);
            }
        }
    }

    function renderSettings() {
        $('st-cartname').value = cart.name;
        $('st-goal').value = cart.goal;
        $('st-scname').value = scene().name;
        $('st-bg').value = scene().bg;
        $('st-delscene').disabled = cart.scenes.length < 2;
    }

    function renderSel() {
        const it = sel != null ? scene().items[sel] : null;
        $('st-sel').hidden = !it;
        if (it) $('st-selname').textContent = defs()[it.sid]?.name || it.sid;
    }

    function setTool(t) {
        tool = t;
        for (const b of $('tool-seg').children) { b.classList.toggle('on', b.dataset.tool === t); b.setAttribute('aria-pressed', String(b.dataset.tool === t)); }
        if (t !== 'move') sel = null;
        renderSel();
    }

    function goScene(i) {
        idx = i; sel = null;
        renderTabs(); renderSettings(); changed();
    }

    function enter(c, sceneIdx = 0) {
        cart = c;
        idx = Math.min(sceneIdx, cart.scenes.length - 1);
        sel = null; hover = null; down = false;
        if (!defs()[selSid]) selSid = 'tree';
        const bg = $('st-bg');
        if (!bg.options.length) for (const t of THEMES) bg.add(new Option(t[0].toUpperCase() + t.slice(1), t));
        renderTabs(); renderPalette(); renderSettings(); setTool('place');
        changed();
    }

    // ------------------------------------------------------------------ picture
    const reach = (sid) => (defs()[sid]?.size === 2 ? 1.1 : 0.65);
    function pick(c) {
        let best = null, bd = Infinity;
        scene().items.forEach((it, i) => {
            const d = Math.hypot(it.x - c.x, it.y - c.y);
            if (d < reach(it.sid) && d <= bd) { bd = d; best = i; }
        });
        return best;
    }

    function stick(c) {
        const def = defs()[selSid];
        if (!def) return;
        const p = snap(c.x, c.y, def.size);
        const key = `${selSid}@${p.x},${p.y}`;
        if (key === lastKey) return;
        lastKey = key;
        if (scene().items.some((it) => it.sid === selSid && it.x === p.x && it.y === p.y)) return;
        if (scene().items.length >= LIMITS.items) { host.toast(`A scene holds ${LIMITS.items} stickers.`); return; }
        scene().items.push({ sid: selSid, x: p.x, y: p.y });
        audio.ui('place');
        changed();
    }

    function erase(c) {
        const i = pick(c);
        if (i == null) return;
        scene().items.splice(i, 1);
        audio.ui('erase');
        sel = null;
        changed();
    }

    function onDown(e) {
        if (host.mode !== 'stage' || (e.button && e.button !== 0)) return;
        const c = view.toCell(e.clientX, e.clientY);
        if (!c) return;
        e.preventDefault();
        down = true; lastKey = '';
        try { $('view').setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        if (tool === 'place') { hover = null; stick(c); }
        else if (tool === 'erase') erase(c);
        else {
            sel = pick(c);
            dragging = sel;
            renderSel();
        }
    }
    function onMove(e) {
        if (host.mode !== 'stage') return;
        const c = view.toCell(e.clientX, e.clientY);
        if (tool === 'place') {
            const def = defs()[selSid];
            hover = c && !down && def && e.pointerType !== 'touch' ? { sid: selSid, ...snap(c.x, c.y, def.size) } : null;
        } else hover = null;
        if (!down || !c) return;
        if (tool === 'place') stick(c);
        else if (tool === 'erase') erase(c);
        else if (dragging != null) {
            const it = scene().items[dragging];
            const p = snap(c.x, c.y, defs()[it.sid]?.size || 1);
            if (p.x !== it.x || p.y !== it.y) { it.x = p.x; it.y = p.y; changed(true); }
        }
    }
    function onUp() { down = false; dragging = null; hover = null; host.persist(); }
    const cv = $('view');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', () => { hover = null; });
    cv.addEventListener('contextmenu', (e) => {
        if (host.mode !== 'stage') return;
        e.preventDefault();
        const c = view.toCell(e.clientX, e.clientY);
        if (c) erase(c);
    });
    window.addEventListener('keydown', (e) => {
        if (host.mode !== 'stage' || sel == null) return;
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.code === 'Delete' || e.code === 'Backspace') $('st-del').click();
    });

    // ------------------------------------------------------------------ controls
    for (const b of $('tool-seg').children) b.addEventListener('click', () => { audio.ui('click'); setTool(b.dataset.tool); });
    $('st-play').addEventListener('click', () => {
        audio.ui('click');
        if (!cart.scenes[0].items.some((it) => defs()[it.sid]?.tags.includes('hero'))) host.toast('Tip: put a hero in the first scene.');
        host.persist();
        host.playCart(cart, 'stage');
    });
    $('st-edit').addEventListener('click', () => {
        const it = scene().items[sel];
        if (it) { audio.ui('click'); host.openPress(it.sid, 'stage'); }
    });
    $('st-dup').addEventListener('click', () => {
        const it = scene().items[sel];
        if (!it || scene().items.length >= LIMITS.items) return;
        const p = snap(it.x + 1, it.y, defs()[it.sid]?.size || 1);
        scene().items.push({ sid: it.sid, x: p.x, y: p.y });
        sel = scene().items.length - 1;
        audio.ui('place');
        changed();
    });
    $('st-del').addEventListener('click', () => {
        if (sel == null) return;
        scene().items.splice(sel, 1);
        sel = null;
        audio.ui('erase');
        changed();
    });
    $('st-newstk').addEventListener('click', () => { audio.ui('click'); host.persist(); host.newSticker('stage'); });
    $('st-cartname').addEventListener('input', (e) => { cart.name = e.target.value.slice(0, LIMITS.name) || 'My Cart'; $('bar-sub').textContent = cart.name; changed(true); });
    $('st-goal').addEventListener('input', (e) => { cart.goal = e.target.value.slice(0, LIMITS.goal); changed(true); });
    $('st-scname').addEventListener('input', (e) => { scene().name = e.target.value.slice(0, LIMITS.name) || `Scene ${idx + 1}`; renderTabs(); changed(true); });
    $('st-bg').addEventListener('change', (e) => { scene().bg = e.target.value; changed(true); });
    $('st-clear').addEventListener('click', () => {
        if (!scene().items.length || !confirm('Take every sticker off this scene?')) return;
        scene().items.length = 0; sel = null; audio.ui('erase'); changed();
    });
    $('st-delscene').addEventListener('click', () => {
        if (cart.scenes.length < 2 || !confirm(`Delete scene "${scene().name}"?`)) return;
        cart.scenes.splice(idx, 1);
        goScene(Math.min(idx, cart.scenes.length - 1));
    });

    return {
        enter,
        get sceneIndex() { return idx; },
        get cart() { return cart; },
        overlay: () => ({ sel, hover, grid: true }),
        refreshPalette: () => { if (cart) renderPalette(); },
    };
}
