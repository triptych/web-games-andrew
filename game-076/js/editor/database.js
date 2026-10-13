// The Database: heroes, items, skills, enemies, troops, switches & variables
// and the system settings. Works on a copy; OK writes it back as one undo step.
import { h, modal, field, row, section, tabs, toast, clear, confirmDialog } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';
import { pickGraphic, pickIcon, spriteThumb, iconThumb, monsterThumb, dbOptions, musicField } from './pickers.js';

const TW = () => store.TW;
const KEYS = ['actors', 'items', 'skills', 'enemies', 'troops', 'switches', 'variables', 'system', 'meta'];
const STAT_LABEL = { hp: 'HP', mp: 'MP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD' };
const ELEM = ['fire', 'ice', 'bolt', 'holy', 'dark', 'wind'];

export function openDatabase(tab) {
    if (!meta.has('db')) { toast('The Database: ' + meta.why('db'), 'warn'); return; }
    const p = store.project;
    const d = {};
    for (const k of KEYS) d[k] = JSON.parse(JSON.stringify(p[k]));
    const created = [];
    const tabList = [
        { id: 'actors', label: '🧝 Heroes', f: 'db.actors', render: (el) => listTab(el, 'actors', actorForm, () => TW().schema.actor(next('actors'), 'New Hero', 'villager')) },
        { id: 'items', label: '🧪 Items', f: 'db.items', render: (el) => listTab(el, 'items', itemForm, () => TW().schema.item(next('items'), 'New Item')) },
        { id: 'skills', label: '✨ Skills', f: 'db.skills', render: (el) => listTab(el, 'skills', skillForm, () => TW().schema.skill(next('skills'), 'New Skill')) },
        { id: 'enemies', label: '👾 Enemies', f: 'db.enemies', render: (el) => listTab(el, 'enemies', enemyForm, () => TW().schema.enemy(next('enemies'), 'New Enemy')) },
        { id: 'troops', label: '⚔️ Troops', f: 'db.troops', render: (el) => listTab(el, 'troops', troopForm, () => TW().schema.troop(next('troops'), 'New Troop', d.enemies[0] ? [{ enemy: d.enemies[0].id, x: 160, y: 150 }] : [])) },
        { id: 'switches', label: '🔘 Switches & Variables', f: 'db.switches', render: (el) => switchesTab(el) },
        { id: 'system', label: '⚙️ System', f: 'db.system', render: (el) => systemTab(el) },
    ].map((t) => Object.assign(t, { locked: meta.has(t.f) ? null : t.label.replace(/^\S+ /, '') + ': ' + meta.why(t.f) }));
    const next = (k) => TW().schema.nextId(d[k]);
    const sel = {};

    function listTab(el, key, formFn, make) {
        const list = d[key];
        const left = h('div.dblist');
        const right = h('div.dbform');
        const drawList = () => {
            clear(left);
            const ul = h('ul', { role: 'listbox' });
            for (const x of list) ul.appendChild(h('li' + (sel[key] === x.id ? '.on' : ''), { role: 'option', on: { click: () => { sel[key] = x.id; drawList(); drawForm(); } } }, thumbFor(key, x), h('span', { text: String(x.id).padStart(3, '0') + ' ' + x.name })));
            left.appendChild(h('div.dbtools',
                h('button.small.primary', { text: '+ New', on: { click: () => { if (list.length >= 999) return; const x = make(); list.push(x); created.push(key); sel[key] = x.id; drawList(); drawForm(); } } }),
                h('button.small', { text: 'Copy', on: { click: () => { const cur = list.find((x) => x.id === sel[key]); if (!cur) return; const c = JSON.parse(JSON.stringify(cur)); c.id = next(key); c.name += ' 2'; list.push(c); created.push(key); sel[key] = c.id; drawList(); drawForm(); } } }),
                h('button.small.danger', { text: 'Delete', on: { click: async () => { const cur = list.find((x) => x.id === sel[key]); if (!cur) return; if (!(await confirmDialog('Delete', 'Delete "' + cur.name + '"? Commands that use it will show "?".', 'Delete', true))) return; list.splice(list.indexOf(cur), 1); sel[key] = list[0] && list[0].id; drawList(); drawForm(); } } })));
            left.appendChild(ul);
            if (!list.length) left.appendChild(h('p.hint', { text: 'Nothing here yet. Press + New.' }));
        };
        const drawForm = () => {
            clear(right);
            const cur = list.find((x) => x.id === sel[key]);
            if (!cur) return;
            right.appendChild(formFn(cur, () => drawList(), () => drawForm()));
        };
        if (!list.some((x) => x.id === sel[key])) sel[key] = list[0] && list[0].id;
        drawList(); drawForm();
        el.appendChild(h('div.dbsplit', left, right));
    }

    function thumbFor(key, x) {
        try {
            if (key === 'actors') return spriteThumb(x.sprite, 1);
            if (key === 'items') return iconThumb(x.icon, 1);
            if (key === 'enemies') return monsterThumb(x.look, 20);
        } catch { /* missing art */ }
        return h('span.dot');
    }

    // ── heroes ──
    function actorForm(a, relist, redraw) {
        const prev = h('div.preview', walkPreview(a.sprite));
        const statRows = h('table.stats', h('tr', h('th'), h('th', { text: 'Level 1' }), h('th', { text: '+ per level' }), h('th', { text: 'at 20' })));
        for (const k of Object.keys(STAT_LABEL)) {
            const at20 = h('td.dim');
            const upd = () => { at20.textContent = Math.floor(a.stats[k] + a.gain[k] * 19); };
            upd();
            statRows.appendChild(h('tr', h('th', { text: STAT_LABEL[k] }),
                h('td', field('', 'number', a.stats[k], (v) => { a.stats[k] = v; upd(); }, { min: 0, max: 9999 })),
                h('td', field('', 'number', a.gain[k], (v) => { a.gain[k] = v; upd(); }, { min: 0, max: 999, step: 0.1 })), at20));
        }
        const skillBox = h('div');
        const drawSkills = () => {
            clear(skillBox);
            a.skills.forEach((s, i) => skillBox.appendChild(row(field('Skill', 'select', s.skill, (v) => { s.skill = v; }, { numeric: true, options: dbOptions(d.skills) }), field('Learned at level', 'number', s.level, (v) => { s.level = v; }, { min: 1, max: 99 }), h('button.small.danger', { text: '✕', on: { click: () => { a.skills.splice(i, 1); drawSkills(); } } }))));
            skillBox.appendChild(h('button.small', { text: '+ Add skill', disabled: !d.skills.length, title: d.skills.length ? '' : 'Make skills in the Skills tab first', on: { click: () => { a.skills.push({ skill: d.skills[0].id, level: 1 }); drawSkills(); } } }));
        };
        drawSkills();
        const eqOpts = (kind) => dbOptions(d.items.filter((i) => i.kind === kind), true);
        return h('div.form',
            h('div.formtop', prev, h('div.grow',
                row(field('Name', 'text', a.name, (v) => { a.name = v; relist(); }, { max: 48 }), field('Class', 'text', a.cls, (v) => { a.cls = v; }, { max: 48 })),
                row(h('button', { text: 'Choose sprite…', on: { click: () => pickGraphic({ kind: 'char', id: a.sprite }, (g) => { if (g.kind === 'char') { a.sprite = g.id; relist(); redraw(); } }, { charsOnly: true, noDir: true, title: 'Hero sprite' }) } }), field('Starting level', 'number', a.level, (v) => { a.level = v; }, { min: 1, max: 99 })))),
            section('Stats', statRows),
            section('Skills', skillBox),
            meta.has('equipment') ? section('Starting equipment', row(
                field('Weapon', 'select', a.equip.weapon, (v) => { a.equip.weapon = v; }, { numeric: true, options: eqOpts('weapon') }),
                field('Armour', 'select', a.equip.armor, (v) => { a.equip.armor = v; }, { numeric: true, options: eqOpts('armor') }),
                field('Accessory', 'select', a.equip.acc, (v) => { a.equip.acc = v; }, { numeric: true, options: eqOpts('accessory') }))) : h('p.hint', { text: 'Equipment: ' + meta.why('equipment') }));
    }

    // ── items ──
    function itemForm(it, relist, redraw) {
        const eq = it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'accessory';
        const kinds = [['consumable', 'Consumable'], ['key', 'Key item']].concat(['weapon', 'armor', 'accessory'].map((k) => { const ok = meta.has('equipment') || it.kind === k; return [k, k[0].toUpperCase() + k.slice(1) + (ok ? '' : ' 🔒'), !ok]; }));
        return h('div.form',
            h('div.formtop', h('button.iconpick', { title: 'Choose an icon', on: { click: () => pickIcon(it.icon, (ic) => { it.icon = ic; relist(); redraw(); }) } }, iconThumb(it.icon, 4)), h('div.grow',
                row(field('Name', 'text', it.name, (v) => { it.name = v; relist(); }, { max: 48 }), field('Kind', 'select', it.kind, (v) => { it.kind = v; redraw(); }, { options: kinds })),
                row(field('Price', 'number', it.price, (v) => { it.price = v; }, { min: 0, max: 999999 }), field('Description', 'text', it.desc, (v) => { it.desc = v; }, { max: 200 })))),
            it.kind === 'consumable' ? section('Effect',
                row(field('Restore HP', 'number', it.hp, (v) => { it.hp = v; }, { min: 0, max: 99999 }), field('Restore MP', 'number', it.mp, (v) => { it.mp = v; }, { min: 0, max: 99999 }), field('As % of max', 'check', it.pct, (v) => { it.pct = v; })),
                row(field('Revives the fallen', 'check', it.revive, (v) => { it.revive = v; }), field('Affects', 'select', it.scope, (v) => { it.scope = v; }, { options: [['one', 'One target'], ['all', 'Everyone']] })),
                row(field('Damage to enemies', 'number', it.dmg, (v) => { it.dmg = v; }, { min: 0, max: 99999 }), field('Element', 'select', it.element, (v) => { it.element = v; }, { options: TW().schema.ELEMENTS })),
                row(field('Usable in battle', 'check', it.battle, (v) => { it.battle = v; }), field('Usable from the menu', 'check', it.menu, (v) => { it.menu = v; }))) : null,
            eq ? section('Bonuses when equipped', row(...['atk', 'def', 'mag', 'spd'].map((k) => field(STAT_LABEL[k], 'number', it[k], (v) => { it[k] = v; }, { min: -999, max: 999 })))) : null,
            it.kind === 'key' ? h('p.hint', { text: 'Key items can\'t be used or sold. Check for them with a Conditional Branch or a page condition.' }) : null);
    }

    // ── skills ──
    function skillForm(s, relist) {
        return h('div.form',
            row(field('Name', 'text', s.name, (v) => { s.name = v; relist(); }, { max: 48 }), field('MP cost', 'number', s.mp, (v) => { s.mp = v; }, { min: 0, max: 999 })),
            row(field('Kind', 'select', s.kind, (v) => { s.kind = v; }, { options: [['damage', 'Damage'], ['heal', 'Heal'], ['revive', 'Revive'], ['buffAtk', 'Raise ATK'], ['buffDef', 'Raise DEF']] }), field('Power', 'number', s.power, (v) => { s.power = v; }, { min: 0, max: 9999 })),
            row(field('Element', 'select', s.element, (v) => { s.element = v; }, { options: TW().schema.ELEMENTS }), field('Scope', 'select', s.scope, (v) => { s.scope = v; }, { options: [['enemy', 'One enemy'], ['allEnemies', 'All enemies'], ['ally', 'One ally'], ['allAllies', 'All allies'], ['self', 'Self']] })),
            field('Animation', 'select', s.anim, (v) => { s.anim = v; }, { options: TW().schema.ANIMS }),
            h('p.hint', { text: 'Damage ≈ power + MAG × 2 − DEF ÷ 2, ×1.5 against a weakness. Heals ≈ power + MAG × 1.5.' }));
    }

    // ── enemies ──
    function enemyForm(e, relist, redraw) {
        const fams = TW().sprites.FAMILIES;
        const famOpts = Object.keys(fams).map((k) => { const ok = !fams[k].pack || meta.has(fams[k].pack) || e.look.family === k; return [k, fams[k].name + (ok ? '' : ' 🔒'), !ok]; });
        const pal = h('div.swatches');
        TW().sprites.PALETTES.forEach((c, i) => pal.appendChild(h('button.swatch' + (e.look.palette === i ? '.on' : ''), { title: 'Palette ' + (i + 1), style: { background: 'linear-gradient(135deg,' + c[0] + ' 50%,' + c[1] + ' 50%)' }, on: { click: () => { e.look.palette = i; relist(); redraw(); } } })));
        pal.appendChild(h('button.small' + (e.look.palette < 0 ? '.on' : ''), { text: 'Default', on: { click: () => { e.look.palette = -1; relist(); redraw(); } } }));
        const drops = h('div');
        for (let i = 0; i < 3; i++) {
            const dr = e.drops[i] || { item: 0, chance: 0 };
            drops.appendChild(row(field('Drop ' + (i + 1), 'select', dr.item, (v) => { dr.item = v; if (!e.drops.includes(dr)) e.drops.push(dr); e.drops = e.drops.filter((x) => x.item); }, { numeric: true, options: dbOptions(d.items, true) }), field('Chance %', 'number', dr.chance, (v) => { dr.chance = v; if (!e.drops.includes(dr) && dr.item) e.drops.push(dr); }, { min: 0, max: 100 })));
        }
        const skills = h('div.checklist');
        for (const s of d.skills) skills.appendChild(field(s.name, 'check', e.skills.includes(s.id), (v) => { e.skills = e.skills.filter((x) => x !== s.id); if (v) e.skills.push(s.id); }));
        const el = (key) => h('div.checklist.inline', ...ELEM.map((x) => field(x, 'check', e[key].includes(x), (v) => { e[key] = e[key].filter((y) => y !== x); if (v) e[key].push(x); })));
        return h('div.form',
            h('div.formtop', h('div.preview.monster', monsterThumb(e.look, 128)), h('div.grow',
                field('Name', 'text', e.name, (v) => { e.name = v; relist(); }, { max: 48 }),
                row(field('Family', 'select', e.look.family, (v) => { e.look.family = v; relist(); redraw(); }, { options: famOpts }), field('Size', 'select', e.look.size, (v) => { e.look.size = v; relist(); redraw(); }, { options: [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']] })),
                h('div.field', h('span', { text: 'Colours' }), pal))),
            section('Stats', h('div.row.wrap', ...Object.keys(STAT_LABEL).map((k) => field(STAT_LABEL[k], 'number', e.stats[k], (v) => { e.stats[k] = v; }, { min: k === 'hp' ? 1 : 0, max: 99999 }))),
                row(field('EXP', 'number', e.exp, (v) => { e.exp = v; }, { min: 0 }), field('Gold', 'number', e.gold, (v) => { e.gold = v; }, { min: 0 }))),
            section('Drops', drops),
            section('Skills it uses', d.skills.length ? skills : h('p.hint', { text: 'No skills yet.' })),
            section('Weak to (×1.5)', el('weak')), section('Resists (×0.5)', el('resist')));
    }

    // ── troops ──
    function troopForm(t, relist, redraw) {
        const cv = h('canvas.troopfield');
        cv.width = 320; cv.height = 170;
        const draw = () => {
            const g = cv.getContext('2d');
            const bd = TW().tiles.BACKDROPS.grass;
            g.fillStyle = bd[0]; g.fillRect(0, 0, 320, 100); g.fillStyle = bd[2]; g.fillRect(0, 100, 320, 70);
            g.imageSmoothingEnabled = false;
            t.members.forEach((m, i) => {
                const en = d.enemies.find((x) => x.id === m.enemy);
                if (!en) return;
                const s = TW().sprites.monster(en.look);
                const x = m.x || ((i + 1) * 320) / (t.members.length + 1), y = Math.min(m.y || 150, 156);
                g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
            });
        };
        let drag = null;
        cv.addEventListener('pointerdown', (e) => {
            const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 320, y = (e.clientY - r.top) / r.height * 170;
            let best = -1, bd = 40;
            t.members.forEach((m, i) => { const mx = m.x || ((i + 1) * 320) / (t.members.length + 1), my = (m.y || 150) - 20; const dd = Math.hypot(mx - x, my - y); if (dd < bd) { bd = dd; best = i; } });
            if (best >= 0) { drag = best; cv.setPointerCapture(e.pointerId); }
        });
        cv.addEventListener('pointermove', (e) => {
            if (drag === null) return;
            const r = cv.getBoundingClientRect();
            t.members[drag].x = Math.round(Math.max(10, Math.min(310, (e.clientX - r.left) / r.width * 320)));
            t.members[drag].y = Math.round(Math.max(60, Math.min(156, (e.clientY - r.top) / r.height * 170 + 20)));
            draw();
        });
        cv.addEventListener('pointerup', () => { drag = null; });
        const mem = h('div');
        const drawMem = () => {
            clear(mem);
            t.members.forEach((m, i) => mem.appendChild(row(field('Enemy ' + (i + 1), 'select', m.enemy, (v) => { m.enemy = v; draw(); }, { numeric: true, options: dbOptions(d.enemies) }), h('button.small.danger', { text: '✕', on: { click: () => { t.members.splice(i, 1); drawMem(); draw(); } } }))));
            if (t.members.length < 6) mem.appendChild(h('button.small', { text: '+ Add enemy', disabled: !d.enemies.length, on: { click: () => { t.members.push({ enemy: d.enemies[0].id, x: 0, y: 0 }); t.members.forEach((m, i) => { m.x = Math.round(((i + 1) * 320) / (t.members.length + 1)); m.y = 150; }); drawMem(); draw(); } } }));
            if (!d.enemies.length) mem.appendChild(h('p.hint', { text: 'Make enemies in the Enemies tab first.' }));
        };
        drawMem(); draw();
        return h('div.form',
            row(field('Name', 'text', t.name, (v) => { t.name = v; relist(); }, { max: 48 }), musicField('Battle music', t.music, (v) => { t.music = v; }, '(system default)')),
            h('div.field', h('span', { text: 'Battlefield — drag enemies to arrange them' }), cv),
            section('Members', mem));
    }

    // ── switches & variables ──
    function switchesTab(el) {
        const col = (key, label) => {
            const box = h('div.namelist');
            const draw = () => {
                clear(box);
                for (let i = 1; i < d[key].length; i++) box.appendChild(h('label.nameRow', h('span', { text: String(i).padStart(4, '0') }), field('', 'text', d[key][i], (v) => { d[key][i] = v; }, { max: 48, placeholder: '(unnamed)' })));
                if (d[key].length < 101) box.appendChild(h('button.small', { text: '+ 20 more', on: { click: () => { for (let k = 0; k < 20 && d[key].length < 101; k++) d[key].push(''); draw(); } } }));
            };
            draw();
            return h('div.namecol', h('h3', { text: label }), box);
        };
        el.appendChild(h('p.hint', { text: 'Switches are ON/OFF flags ("Met the Elder"). Variables are numbers ("Apples collected"). Names make your events read like sentences.' }));
        el.appendChild(h('div.namecols', col('switches', 'Switches'), col('variables', 'Variables')));
    }

    // ── system ──
    function systemTab(el) {
        const s = d.system;
        const prev = h('canvas.titleprev');
        prev.width = 320; prev.height = 240;
        let raf = 0, t0 = performance.now();
        const loop = () => {
            if (!prev.isConnected) { cancelAnimationFrame(raf); return; }
            const g = prev.getContext('2d');
            g.imageSmoothingEnabled = false;
            try { TW().drawTitleBg(g, s.titleStyle, (performance.now() - t0) / 1000, { project: Object.assign({}, store.project, { system: s }) }); } catch { /* preview only */ }
            g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#ffd860'; g.strokeStyle = '#0a061e'; g.lineWidth = 3;
            g.strokeText(s.title, 160, 80, 300); g.fillText(s.title, 160, 80, 300);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        const skins = TW().ui.SKINS;
        const skinOpts = Object.keys(skins).map((k) => { const ok = !skins[k].pack || meta.has(skins[k].pack) || s.windowSkin === k; return [k, skins[k].name + (ok ? '' : ' 🔒'), !ok]; });
        const party = h('div.checklist');
        for (const a of d.actors) party.appendChild(field(a.name, 'check', s.party.includes(a.id), (v, input) => { s.party = s.party.filter((x) => x !== a.id); if (v) { if (s.party.length >= 4) { input.checked = false; toast('A party has at most four heroes.', 'warn'); return; } s.party.push(a.id); } }));
        el.appendChild(h('div.form.system',
            h('div.formtop', h('div.preview', prev), h('div.grow',
                field('Game title', 'text', s.title, (v) => { s.title = v; d.meta.title = v; }, { max: 80 }),
                field('Subtitle', 'text', s.subtitle, (v) => { s.subtitle = v; }, { max: 120 }),
                field('Author', 'text', d.meta.author, (v) => { d.meta.author = v; }, { max: 80 }),
                row(field('Title screen', 'select', s.titleStyle, (v) => { s.titleStyle = v; }, { options: Object.entries(TW().TITLE_STYLES) }), musicField('Title music', s.titleMusic, (v) => { s.titleMusic = v; })))),
            section('Party', h('div.field', h('span', { text: 'Starting party (up to 4)' }), party), row(field('Starting gold', 'number', s.gold, (v) => { s.gold = v; }, { min: 0, max: 9999999 }), field('Currency', 'text', s.currency, (v) => { s.currency = v; }, { max: 8 }))),
            section('Look & sound', row(field('Window skin', 'select', s.windowSkin, (v) => { s.windowSkin = v; }, { options: skinOpts }), musicField('Battle music', s.battleMusic, (v) => { s.battleMusic = v; }), musicField('Victory music', s.victoryMusic, (v) => { s.victoryMusic = v; }))),
            field('Game over text', 'text', s.gameOverText, (v) => { s.gameOverText = v; }, { max: 200 })));
    }

    const tw = tabs(tabList, tab && tabList.find((t) => t.id === tab && !t.locked) ? tab : null);
    modal({
        title: 'Database', full: true, body: tw, cls: 'dbmodal',
        buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: () => {
            for (const k of KEYS) p[k] = d[k];
            if (!p.system.party.length && p.actors.length) p.system.party = [p.actors[0].id];
            p.system.party = p.system.party.filter((id) => p.actors.some((a) => a.id === id));
            store.commit('Database');
            for (const k of created) bus.emit('edit', { kind: 'dbCreate', db: k });
            bus.emit('edit', { kind: 'dbEdit' });
            bus.emit('db-changed');
        } }],
        onClose: () => TW().audio.stopMusic(),
    });
}

function walkPreview(id) {
    const c = h('canvas.walk');
    c.width = 16 * 4 * 2 + 12; c.height = 20 * 2;
    let f = 0;
    const draw = () => {
        if (!c.isConnected && f > 0) return;
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.imageSmoothingEnabled = false;
        g.scale(2, 2);
        [2, 4, 6, 8].forEach((dir, i) => store.TW.sprites.drawChar(g, id, dir, [1, 0, 1, 2][f % 4], i * 17, 0));
        f++;
        setTimeout(draw, 220);
    };
    draw();
    return c;
}
export { walkPreview };
