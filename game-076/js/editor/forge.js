// The Sprite Forge: build characters from parts and see all four facings walk.
// Forge sprites are saved in the project as parts, not pixels.
import { h, modal, field, row, section, toast, clear, confirmDialog } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';

const TW = () => store.TW;
const LABELS = { body: 'Body', hair: 'Hair', eyes: 'Eyes', outfit: 'Outfit', head: 'Headgear', acc: 'Accessory' };

export function openForge() {
    if (!meta.has('forge')) { toast('The Sprite Forge: ' + meta.why('forge'), 'warn'); return; }
    const p = store.project;
    const list = JSON.parse(JSON.stringify(p.sprites));
    let cur = list[0] ? list[0].id : null;
    let made = 0;
    const left = h('div.dblist');
    const right = h('div.forgeform');
    const PARTS = TW().sprites.PARTS, PACKS = TW().sprites.PACKS;

    const drawList = () => {
        clear(left);
        left.appendChild(h('div.dbtools',
            h('button.small.primary', { text: '+ New sprite', on: { click: () => { if (list.length >= 200) return; const id = 'f' + (Math.max(0, ...list.map((s) => +String(s.id).slice(1) || 0)) + 1); const base = TW().sprites.PRESETS.villager.parts; list.push({ id, name: 'Sprite ' + id.slice(1), parts: JSON.parse(JSON.stringify(base)) }); cur = id; made++; drawList(); drawForm(); } } }),
            h('button.small', { text: 'Copy', on: { click: () => { const s = list.find((x) => x.id === cur); if (!s) return; const id = 'f' + (Math.max(0, ...list.map((q) => +String(q.id).slice(1) || 0)) + 1); list.push({ id, name: s.name + ' 2', parts: JSON.parse(JSON.stringify(s.parts)) }); cur = id; made++; drawList(); drawForm(); } } }),
            h('button.small.danger', { text: 'Delete', on: { click: async () => { const s = list.find((x) => x.id === cur); if (!s || !(await confirmDialog('Delete sprite', 'Delete "' + s.name + '"? Events using it will look like villagers.', 'Delete', true))) return; list.splice(list.indexOf(s), 1); cur = list[0] && list[0].id; drawList(); drawForm(); } } })));
        const ul = h('ul');
        for (const s of list) {
            const c = h('canvas.thumb'); c.width = 16; c.height = 20;
            const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
            TW().sprites.setCustom([s]); TW().sprites.drawChar(g, s.id, 2, 1, 0, 0);
            ul.appendChild(h('li' + (s.id === cur ? '.on' : ''), { on: { click: () => { cur = s.id; drawList(); drawForm(); } } }, c, h('span', { text: s.name })));
        }
        TW().sprites.setCustom(list);
        left.appendChild(ul);
        if (!list.length) left.appendChild(h('p.hint', { text: 'No Forge sprites yet. Press + New sprite.' }));
        left.appendChild(h('div.pickhead', { text: 'Start from a preset' }));
        const presets = h('div.presetgrid');
        for (const [id, pr] of Object.entries(TW().sprites.PRESETS)) {
            const c = h('canvas.thumb'); c.width = 16; c.height = 20;
            const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
            TW().sprites.drawChar(g, id, 2, 1, 0, 0);
            presets.appendChild(h('button.pick.tiny', { title: 'Copy ' + pr.name + ' into the Forge', on: { click: () => { const s = list.find((x) => x.id === cur); if (!s) { toast('Make a sprite first (+ New sprite).'); return; } s.parts = JSON.parse(JSON.stringify(pr.parts)); drawList(); drawForm(); } } }, c));
        }
        left.appendChild(presets);
    };

    let anim = null;
    const drawForm = () => {
        clear(right);
        const s = list.find((x) => x.id === cur);
        if (!s) { right.appendChild(h('p.hint', { text: 'Make a sprite to start forging.' })); return; }
        const pv = h('canvas.forgeprev');
        pv.width = 16 * 4 * 4 + 36; pv.height = 20 * 4;
        let f = 0;
        clearInterval(anim);
        const paint = () => {
            TW().sprites.setCustom(list);
            const g = pv.getContext('2d');
            g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pv.width, pv.height); g.imageSmoothingEnabled = false; g.scale(4, 4);
            [2, 4, 6, 8].forEach((dir, i) => TW().sprites.drawChar(g, s.id, dir, [1, 0, 1, 2][f % 4], i * 18, 0));
            f++;
        };
        anim = setInterval(() => { if (!pv.isConnected) { clearInterval(anim); return; } paint(); }, 200);
        paint();
        const P = s.parts;
        const sel = (key) => {
            const opts = PARTS[key].map((v) => { const pk = PACKS[v]; const ok = !pk || meta.has(pk) || P[key] === v; return [v, v + (ok ? '' : ' 🔒'), !ok]; });
            return field(LABELS[key], 'select', P[key], (v) => { P[key] = v; paint(); }, { options: opts });
        };
        const swatches = (key, label) => {
            const box = h('div.swatches');
            const choices = key === 'skin' ? PARTS.skin : key === 'hairColor' ? PARTS.hairColor : PARTS.colors;
            const draw = () => {
                clear(box);
                for (const c of choices) box.appendChild(h('button.swatch' + (P[key] === c ? '.on' : ''), { title: c, style: { background: c }, on: { click: () => { P[key] = c; draw(); paint(); } } }));
                const ci = h('input', { type: 'color', value: P[key], title: 'Any colour', on: { input: (e) => { P[key] = e.target.value; paint(); } } });
                box.appendChild(ci);
            };
            draw();
            return h('div.field', h('span', { text: label }), box);
        };
        const random = () => {
            const r = (a) => a[Math.floor(Math.random() * a.length)];
            const ok = (key) => PARTS[key].filter((v) => !PACKS[v] || meta.has(PACKS[v]));
            Object.assign(P, { body: 'human', hair: r(ok('hair')), outfit: r(ok('outfit')), head: Math.random() < 0.4 ? r(ok('head')) : 'none', acc: Math.random() < 0.3 ? r(ok('acc')) : 'none', eyes: r(ok('eyes')), skin: r(PARTS.skin.slice(0, 5)), hairColor: r(PARTS.hairColor), c1: r(PARTS.colors), c2: r(PARTS.colors), hc: r(PARTS.colors), ac: r(PARTS.colors) });
            drawForm();
        };
        right.append(
            h('div.formtop', h('div.preview', pv), h('div.grow', field('Name', 'text', s.name, (v) => { s.name = v; }, { max: 48 }), h('button', { text: '🎲 Surprise me', on: { click: random } }))),
            section('Shape', h('div.row.wrap', sel('body'), sel('hair'), sel('eyes'), sel('outfit'), sel('head'), sel('acc'))),
            section('Colours', swatches('skin', 'Skin'), swatches('hairColor', 'Hair'), swatches('c1', 'Outfit'), swatches('c2', 'Trim / trousers'), swatches('hc', 'Headgear'), swatches('ac', 'Accessory')));
    };

    drawList(); drawForm();
    modal({
        title: 'Sprite Forge', full: true, body: h('div.dbsplit', left, right), cls: 'forgemodal',
        buttons: [{ label: 'Cancel' }, { label: 'Save sprites', primary: true, onClick: () => {
            p.sprites = list.map((s) => ({ id: s.id, name: s.name, parts: TW().schema.parts(s.parts) }));
            TW().sprites.setCustom(p.sprites);
            store.commit('Sprite Forge');
            for (let i = 0; i < made; i++) bus.emit('edit', { kind: 'forge' });
            bus.emit('edit', { kind: 'forgeSave', count: p.sprites.length });
            bus.emit('db-changed');
        } }],
        onClose: () => { clearInterval(anim); TW().sprites.setCustom(p.sprites); },
    });
}
