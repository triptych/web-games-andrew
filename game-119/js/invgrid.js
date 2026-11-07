// The wagon's cargo grid as a widget: items sit on cells, drag them to rearrange (R rotates while dragging),
// drop one stack on another to merge, tap to select. Reads G.inv; changes it only through act().

import { h } from './dom.js';
import { itemDef, RARITY, RARITY_COLOR, FAMS } from './sim/data/items.js';
import { fp, canPlaceAt } from './sim/inv.js';
import { iconUrl, GLYPH } from './view/icons.js';

export function invGrid(G, o) {
    const cell = o.cell || 46;
    const inv = G.inv;
    const root = h('div.invgrid', { style: { width: inv.w * cell + 'px', height: inv.h * cell + 'px', '--cell': cell + 'px' }, role: 'group', 'aria-label': 'Wagon cargo grid' });
    const preview = h('div.drop-preview', { hidden: true });
    root.appendChild(preview);
    const els = new Map();
    let suppress = false;
    for (const it of inv.items) {
        const d = itemDef(it.t, it.lv);
        const f = fp(it);
        const dim = o.filter && !o.filter(it);
        const el = h('button.invitem', {
            type: 'button', dataset: { id: it.id },
            class: [o.selected === it.id ? 'sel' : '', dim ? 'dim' : '', it.fav ? 'fav' : '', it.junk ? 'junk' : '', o.mark?.(it) ? 'mark' : ''].join(' '),
            style: { left: it.x * cell + 'px', top: it.y * cell + 'px', width: f.w * cell + 'px', height: f.h * cell + 'px', '--rar': d.gear ? RARITY_COLOR[RARITY[it.lv - 1]] : '#a8946a' },
            title: `${d.name}${d.gear ? ' (level ' + it.lv + ')' : ''}${it.n > 1 ? ' x' + it.n : ''}`,
            'aria-label': `${d.name}${d.gear ? ', level ' + it.lv : ''}, quantity ${it.n}`,
        },
        h('img', { src: iconUrl(it.t, it.lv), alt: '', draggable: false, style: { transform: it.r && d.w !== d.h ? 'rotate(90deg)' : '' } }),
        it.n > 1 && h('span.qty', 'x' + it.n),
        d.gear && h('span.lvl', 'Lv' + it.lv),
        it.fav && h('span.tag.f', { html: GLYPH.fav }),
        it.junk && h('span.tag.j', { html: GLYPH.junk }));
        el.addEventListener('pointerdown', (e) => startDrag(e, it, el));
        // selection is the click (so the keyboard's Enter works too); a drag swallows the click that follows it
        el.addEventListener('click', () => { if (suppress) { suppress = false; return; } o.onSelect?.(it.id); });
        els.set(it.id, el);
        root.appendChild(el);
    }

    function startDrag(e, it, el) {
        if (e.button) return;
        const f0 = fp(it);
        const rect0 = el.getBoundingClientRect();
        const grab = { x: e.clientX - rect0.left, y: e.clientY - rect0.top };
        const st = { x0: e.clientX, y0: e.clientY, on: false, r: it.r, ghost: null, tx: it.x, ty: it.y };
        const onMove = (ev) => {
            if (!st.on && Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) < 7) return;
            if (!st.on) {
                st.on = true;
                st.ghost = el.cloneNode(true);
                st.ghost.classList.add('ghost');
                document.body.appendChild(st.ghost);
                el.classList.add('lifted');
                preview.hidden = false;
            }
            ev.preventDefault();
            const d = itemDef(it.t, it.lv);
            const w = st.r ? d.h : d.w, hh = st.r ? d.w : d.h;
            st.ghost.style.width = w * cell + 'px'; st.ghost.style.height = hh * cell + 'px';
            st.ghost.style.left = ev.clientX - grab.x + 'px'; st.ghost.style.top = ev.clientY - grab.y + 'px';
            const gr = root.getBoundingClientRect();
            st.tx = Math.round((ev.clientX - grab.x - gr.left) / cell); st.ty = Math.round((ev.clientY - grab.y - gr.top) / cell);
            const over = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList?.contains('invitem') && n.dataset.id && +n.dataset.id !== it.id);
            st.merge = over ? +over.dataset.id : 0;
            const ok = canPlaceAt(inv, it.id, st.tx, st.ty, st.r);
            preview.style.cssText = `left:${st.tx * cell}px;top:${st.ty * cell}px;width:${w * cell}px;height:${hh * cell}px`;
            preview.className = 'drop-preview ' + (st.merge ? 'merge' : ok ? 'ok' : 'bad');
        };
        const onKey = (ev) => { if (ev.code === 'KeyR' && st.on) { st.r = st.r ? 0 : 1; ev.preventDefault(); } };
        const end = (ev) => {
            window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('keydown', onKey);
            if (st.ghost) st.ghost.remove();
            el.classList.remove('lifted'); preview.hidden = true;
            if (!st.on) return;
            suppress = true; setTimeout(() => { suppress = false; }, 60);
            if (ev.type === 'pointercancel') return;
            if (st.merge) o.onMerge?.(it.id, st.merge);
            else if (st.tx !== it.x || st.ty !== it.y || st.r !== it.r) o.onMove?.(it.id, st.tx, st.ty, st.r);
        };
        window.addEventListener('pointermove', onMove, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('keydown', onKey);
    }
    return root;
}
