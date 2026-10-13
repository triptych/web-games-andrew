// Pickers used by the event editor and the database: sprites and objects,
// icons, monster looks, map positions, sounds, music and database selects.
import { h, modal, field, clear, toast } from './ui.js';
import { store } from './store.js';
import { meta } from '../meta/progress.js';

const TW = () => store.TW;

/** Which sprite presets need a feature (beyond the hero). */
export function spriteFeature(id) {
    const s = TW().sprites;
    const pr = s.PRESETS[id];
    if (!pr) return null;           // Forge sprites: always usable once made
    if (id === 'hero' || id === 'heroine') return null;
    const body = pr.parts.body;
    if (body && body !== 'human') return 'sprites.critters';
    return 'sprites.villagers';
}

/** A small canvas showing a character's standing frame. */
export function spriteThumb(id, scale, dir) {
    const c = h('canvas.thumb');
    c.width = 16 * (scale || 2); c.height = 20 * (scale || 2);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(scale || 2, scale || 2);
    try { TW().sprites.drawChar(g, id, dir || 2, 1, 0, 0); } catch { /* unknown sprite */ }
    return c;
}
export function objectThumb(id, scale) {
    const c = h('canvas.thumb');
    c.width = 16 * (scale || 2); c.height = 16 * (scale || 2);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(TW().sprites.object(id, 0), 0, 0, c.width, c.height);
    return c;
}
export function iconThumb(name, scale) {
    const c = h('canvas.thumb');
    c.width = 12 * (scale || 2); c.height = 12 * (scale || 2);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(TW().sprites.icon(name), 0, 0, c.width, c.height);
    return c;
}
export function monsterThumb(look, max) {
    const src = TW().sprites.monster(look);
    const s = Math.max(1, Math.floor((max || 96) / src.width));
    const c = h('canvas.thumb');
    c.width = src.width * s; c.height = src.height * s;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
}

/** Graphic chooser: { kind: none|char|obj, id, dir }. onPick(gfx). */
export function pickGraphic(cur, onPick, opts) {
    opts = opts || {};
    const sp = TW().sprites;
    let sel = Object.assign({ kind: 'none', id: '', dir: 2 }, cur);
    const grid = h('div.pickgrid');
    const dirs = h('div.dirs');
    const render = () => {
        clear(grid);
        const tile = (kind, id, label, thumb, feat) => {
            const locked = feat && !meta.has(feat) && !(cur && cur.kind === kind && cur.id === id);
            const b = h('button.pick' + (sel.kind === kind && sel.id === id ? '.on' : '') + (locked ? '.locked' : ''), { title: locked ? label + ' — ' + meta.why(feat) : label, on: { click: () => { if (locked) { toast(meta.why(feat), 'warn'); return; } sel = { kind, id, dir: sel.dir || 2 }; render(); } } }, thumb, h('span', { text: label }));
            grid.appendChild(b);
        };
        if (!opts.charsOnly) tile('none', '', '(none)', h('div.nothumb', { text: '∅' }));
        grid.appendChild(h('div.pickhead', { text: 'Characters' }));
        for (const s of sp.allSprites()) tile('char', s.id, s.name, spriteThumb(s.id, 2, sel.kind === 'char' && sel.id === s.id ? sel.dir : 2), spriteFeature(s.id));
        if (!opts.charsOnly) {
            grid.appendChild(h('div.pickhead', { text: 'Objects' }));
            for (const id of Object.keys(sp.OBJECTS)) tile('obj', id, sp.OBJECTS[id].name, objectThumb(id, 2), 'objects');
        }
        clear(dirs);
        if (sel.kind === 'char' && !opts.noDir) {
            dirs.appendChild(h('span', { text: 'Facing: ' }));
            for (const [d, l] of [[2, '↓ Down'], [4, '← Left'], [6, '→ Right'], [8, '↑ Up']]) dirs.appendChild(h('button.small' + (sel.dir === d ? '.on' : ''), { text: l, on: { click: () => { sel.dir = d; render(); } } }));
        }
    };
    render();
    modal({ title: opts.title || 'Choose a graphic', wide: true, body: h('div', grid, dirs), buttons: [{ label: 'Cancel' }, { label: 'Choose', primary: true, onClick: () => onPick(sel) }] });
}

export function pickIcon(cur, onPick) {
    const grid = h('div.pickgrid.icons');
    let sel = cur;
    const render = () => {
        clear(grid);
        for (const ic of TW().sprites.ICONS) grid.appendChild(h('button.pick' + (sel === ic ? '.on' : ''), { title: ic, on: { click: () => { sel = ic; render(); } } }, iconThumb(ic, 3), h('span', { text: ic })));
    };
    render();
    modal({ title: 'Choose an icon', body: grid, buttons: [{ label: 'Cancel' }, { label: 'Choose', primary: true, onClick: () => onPick(sel) }] });
}

/** Pick a tile on a map: onPick({ map, x, y }). */
export function pickPosition(cur, onPick) {
    const p = store.project;
    let mapId = cur && cur.map && p.maps.some((m) => m.id === cur.map) ? cur.map : p.maps[0].id;
    let x = cur ? cur.x | 0 : 0, y = cur ? cur.y | 0 : 0;
    const cv = h('canvas.posmap');
    const info = h('div.posinfo');
    const wrap = h('div.poswrap', cv);
    const draw = () => {
        const m = p.maps.find((q) => q.id === mapId);
        const s = Math.max(1, Math.min(3, Math.floor(560 / (m.w * 16) * 2) / 2 || 1));
        cv.width = m.w * 16; cv.height = m.h * 16;
        cv.style.width = m.w * 16 * s + 'px'; cv.style.height = m.h * 16 * s + 'px';
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        TW().tiles.drawLayers(g, m, 0, [0, 1, 2]);
        for (const e of m.events) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.strokeRect(e.x * 16 + 0.5, e.y * 16 + 0.5, 15, 15); }
        g.strokeStyle = '#ff3a6a'; g.lineWidth = 2; g.strokeRect(x * 16 + 1, y * 16 + 1, 14, 14);
        info.textContent = m.name + ' — (' + x + ', ' + y + ')';
    };
    cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        const m = p.maps.find((q) => q.id === mapId);
        x = Math.max(0, Math.min(m.w - 1, Math.floor((e.clientX - r.left) / r.width * m.w)));
        y = Math.max(0, Math.min(m.h - 1, Math.floor((e.clientY - r.top) / r.height * m.h)));
        draw();
    });
    const sel = field('Map', 'select', mapId, (v) => { mapId = v; const m = p.maps.find((q) => q.id === mapId); x = Math.min(x, m.w - 1); y = Math.min(y, m.h - 1); draw(); }, { options: p.maps.map((m) => [m.id, m.name]), numeric: true });
    draw();
    modal({ title: 'Choose a destination', wide: true, body: h('div', sel, info, wrap), buttons: [{ label: 'Cancel' }, { label: 'Choose', primary: true, onClick: () => onPick({ map: mapId, x, y }) }] });
}

// ── selects built from the database ─────────────────────────────────────────
const pad = (n) => String(n).padStart(4, '0');
export function switchOptions(none) {
    const p = store.project;
    const out = none ? [[0, '(none)']] : [];
    const n = Math.max(20, p.switches.length - 1);
    for (let i = 1; i <= Math.min(100, n); i++) out.push([i, pad(i) + ': ' + (p.switches[i] || '')]);
    return out;
}
export function varOptions(none) {
    const p = store.project;
    const out = none ? [[0, '(none)']] : [];
    const n = Math.max(20, p.variables.length - 1);
    for (let i = 1; i <= Math.min(100, n); i++) out.push([i, pad(i) + ': ' + (p.variables[i] || '')]);
    return out;
}
export const dbOptions = (list, none) => (none ? [[0, none === true ? '(none)' : none]] : []).concat((list || []).map((x) => [x.id, pad(x.id) + ': ' + x.name]));
export const switchName = (i) => pad(i) + ': ' + (store.project.switches[i] || '');
export const varName = (i) => pad(i) + ': ' + (store.project.variables[i] || '');

export function soundField(label, value, onChange) {
    const TWx = TW();
    const f = field(label, 'select', value, onChange, { options: TWx.audio.SFX_NAMES });
    const play = h('button.small.icon', { title: 'Listen', text: '▶', on: { click: (e) => { e.preventDefault(); TWx.audio.unlock(); TWx.audio.sfx(f.input.value); } } });
    f.appendChild(h('div.inline', f.input, play));
    return f;
}
export function musicOptions(withNone, cur) {
    const th = TW().audio.THEMES;
    const out = withNone ? [['', withNone === true ? '(keep current)' : withNone], ['none', '(silence)']] : [['none', '(silence)']];
    for (const id of Object.keys(th)) {
        const owned = !th[id].pack || meta.has(th[id].pack) || cur === id;
        out.push([id, th[id].name + (owned ? '' : ' 🔒'), !owned]);
    }
    return out;
}
let previewing = null;
export function musicField(label, value, onChange, withNone) {
    const TWx = TW();
    const f = field(label, 'select', value, onChange, { options: musicOptions(withNone, value) });
    const play = h('button.small.icon', { title: 'Listen', text: '▶', on: { click: (e) => {
        e.preventDefault();
        TWx.audio.unlock();
        const v = f.input.value;
        if (previewing === v || !v || v === 'none') { TWx.audio.stopMusic(); previewing = null; play.textContent = '▶'; return; }
        TWx.audio.playMusic(v); previewing = v; play.textContent = '■';
    } } });
    f.appendChild(h('div.inline', f.input, play));
    return f;
}
export function stopPreview() { if (previewing) { TW().audio.stopMusic(); previewing = null; } }
