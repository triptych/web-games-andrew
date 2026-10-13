// The event command catalogue: for each command, its label, category, the
// feature that unlocks adding it, a one-line description for the command list
// and an edit form.
import { h, field, row, toast } from './ui.js';
import { store } from './store.js';
import { pickGraphic, pickPosition, switchOptions, varOptions, dbOptions, switchName, varName, soundField, musicField, spriteThumb } from './pickers.js';

const TW = () => store.TW;
const P = () => store.project;
const nameOf = (list, id) => { const x = (list || []).find((q) => q.id === id); return x ? x.name : '?'; };
const DIRN = { 0: 'keep', 2: 'down', 4: 'left', 6: 'right', 8: 'up' };

export const CATS = [
    ['message', 'Message'], ['flow', 'Flow'], ['state', 'Game state'], ['party', 'Party'], ['move', 'Movement'], ['scene', 'Scene'], ['fx', 'Screen & sound'],
];

export const COMMANDS = {
    text:     { label: 'Show Text', cat: 'message', icon: '💬', f: 'cmd.text' },
    choice:   { label: 'Show Choices', cat: 'message', icon: '🔀', f: 'cmd.choice' },
    comment:  { label: 'Comment', cat: 'message', icon: '📝', f: 'cmd.comment' },
    if:       { label: 'Conditional Branch', cat: 'flow', icon: '❓', f: 'cmd.if' },
    wait:     { label: 'Wait', cat: 'flow', icon: '⏳', f: 'cmd.wait' },
    erase:    { label: 'Erase Event', cat: 'flow', icon: '🫥', f: 'cmd.erase' },
    switch:   { label: 'Control Switch', cat: 'state', icon: '🔘', f: 'cmd.switch' },
    var:      { label: 'Control Variable', cat: 'state', icon: '🔢', f: 'cmd.var' },
    self:     { label: 'Control Self Switch', cat: 'state', icon: '🅰', f: 'cmd.self' },
    gold:     { label: 'Change Gold', cat: 'party', icon: '🪙', f: 'cmd.gold' },
    item:     { label: 'Change Items', cat: 'party', icon: '🎁', f: 'cmd.item' },
    party:    { label: 'Change Party', cat: 'party', icon: '🧑‍🤝‍🧑', f: 'cmd.party' },
    exp:      { label: 'Change EXP', cat: 'party', icon: '⭐', f: 'cmd.exp' },
    heal:     { label: 'Recover All', cat: 'party', icon: '💖', f: 'cmd.heal' },
    transfer: { label: 'Transfer Player', cat: 'move', icon: '🚪', f: 'cmd.transfer' },
    route:    { label: 'Set Move Route', cat: 'move', icon: '👣', f: 'cmd.route' },
    battle:   { label: 'Battle Processing', cat: 'scene', icon: '⚔️', f: 'cmd.battle' },
    shop:     { label: 'Shop Processing', cat: 'scene', icon: '🏪', f: 'cmd.shop' },
    gameover: { label: 'Game Over', cat: 'scene', icon: '💀', f: 'cmd.gameover' },
    end:      { label: 'The End', cat: 'scene', icon: '📜', f: 'cmd.end' },
    fadeout:  { label: 'Fade Out', cat: 'fx', icon: '🌑', f: 'cmd.fadeout' },
    fadein:   { label: 'Fade In', cat: 'fx', icon: '🌕', f: 'cmd.fadein' },
    flash:    { label: 'Flash Screen', cat: 'fx', icon: '⚡', f: 'cmd.flash' },
    shake:    { label: 'Shake Screen', cat: 'fx', icon: '〰️', f: 'cmd.shake' },
    tint:     { label: 'Tint Screen', cat: 'fx', icon: '🎨', f: 'cmd.tint' },
    sfx:      { label: 'Play Sound', cat: 'fx', icon: '🔔', f: 'cmd.sfx' },
    bgm:      { label: 'Play Music', cat: 'fx', icon: '🎵', f: 'cmd.bgm' },
};

/** Commands with no fields are added without opening a form. */
export const NO_FORM = new Set(['erase', 'heal', 'gameover']);

function condText(c) {
    if (!c) return '?';
    switch (c.kind) {
        case 'switch': return 'Switch [' + switchName(c.id) + '] is ' + (c.value !== false ? 'ON' : 'OFF');
        case 'var': return 'Variable [' + varName(c.id) + '] ' + (c.op || '>=') + ' ' + (c.src === 'var' ? 'Variable [' + varName(c.value) + ']' : c.value);
        case 'self': return 'Self Switch ' + (c.key || 'A') + ' is ' + (c.value !== false ? 'ON' : 'OFF');
        case 'item': return 'Party ' + (c.value !== false ? 'has' : 'lacks') + ' [' + nameOf(P().items, c.id) + ']';
        case 'gold': return 'Gold ' + (c.op || '>=') + ' ' + c.value;
        case 'actor': return '[' + nameOf(P().actors, c.id) + '] is ' + (c.value !== false ? 'in' : 'not in') + ' the party';
        default: return '?';
    }
}

/** One-line description of a command for the list. */
export function describe(c) {
    const p = P();
    const L = (COMMANDS[c.t] || { label: c.t }).label;
    switch (c.t) {
        case 'text': return L + ': ' + (c.speaker ? '[' + c.speaker + '] ' : '') + (c.text || '').replace(/\n/g, ' ⏎ ');
        case 'choice': return L + ': ' + (c.options || []).join(', ');
        case 'comment': return '// ' + (c.text || '');
        case 'if': return 'If ' + condText(c.cond);
        case 'wait': return L + ': ' + c.sec + ' s';
        case 'switch': return L + ': [' + switchName(c.id) + '] = ' + (c.value || 'on').toUpperCase();
        case 'var': {
            const ops = { set: '=', add: '+=', sub: '-=', mul: '*=', div: '/=', mod: '%=' };
            const v = c.src === 'var' ? 'Variable [' + varName(c.value) + ']' : c.src === 'rand' ? 'Random ' + c.value + '..' + c.max : c.value;
            return L + ': [' + varName(c.id) + '] ' + (ops[c.op] || '=') + ' ' + v;
        }
        case 'self': return L + ': ' + c.key + ' = ' + (c.value ? 'ON' : 'OFF');
        case 'gold': return L + ': ' + (c.amount >= 0 ? '+' : '') + c.amount;
        case 'item': return L + ': [' + nameOf(p.items, c.item) + '] ' + (c.amount >= 0 ? '+' : '') + c.amount;
        case 'party': return L + ': ' + (c.op === 'remove' ? 'Remove ' : 'Add ') + '[' + nameOf(p.actors, c.actor) + ']';
        case 'exp': return L + ': ' + (c.actor ? '[' + nameOf(p.actors, c.actor) + ']' : 'Entire party') + ' ' + (c.amount >= 0 ? '+' : '') + c.amount;
        case 'transfer': return L + ': [' + nameOf(p.maps, c.map) + '] (' + c.x + ', ' + c.y + ')' + (c.dir ? ' facing ' + DIRN[c.dir] : '');
        case 'route': return L + ': ' + (c.target === 'player' ? 'Player' : c.target === 'this' ? 'This event' : 'Event ' + c.target) + ' — ' + (c.steps || []).join(' ') + (c.wait ? ' (wait)' : '');
        case 'battle': return L + ': [' + nameOf(p.troops, c.troop) + ']' + (c.escape ? ', can escape' : '') + (c.lose === 'continue' ? ', defeat continues' : '');
        case 'shop': return L + ': ' + (c.goods || []).map((id) => nameOf(p.items, id)).join(', ');
        case 'end': return L + ': ' + (c.text || '').replace(/\n/g, ' ');
        case 'fadeout': case 'fadein': return L + ': ' + c.sec + ' s';
        case 'flash': return L + ': ' + c.color + ', ' + c.sec + ' s';
        case 'shake': return L + ': power ' + c.power + ', ' + c.sec + ' s';
        case 'tint': return L + ': ' + c.color + ', ' + c.sec + ' s';
        case 'sfx': return L + ': ' + c.name;
        case 'bgm': return L + ': ' + (c.name === 'none' ? '(silence)' : ((TW().audio.THEMES[c.name] || {}).name || c.name));
        default: return L;
    }
}

/** Branch labels for branching commands: [[label, listKey, index?]] */
export function branches(c) {
    if (c.t === 'choice') return (c.options || []).map((o, i) => ['When [' + o + ']', 'branches', i]);
    if (c.t === 'if') return [['Then', 'then']].concat(c.else ? [['Else', 'else']] : []);
    if (c.t === 'battle') return [['If Win', 'win'], ['If Lose', 'loseList']];
    return [];
}

/**
 * Build an edit form for a command. `c` is edited in place; ctx = { map, event }.
 * Returns an element.
 */
export function form(c, ctx) {
    const p = P();
    const set = (k) => (v) => { c[k] = v; };
    switch (c.t) {
        case 'text': {
            const faceBox = h('div.facebox');
            const drawFace = () => { faceBox.replaceChildren(c.face ? spriteThumb(c.face, 3) : h('div.nothumb', { text: 'no face' })); };
            drawFace();
            const ta = field('Text', 'textarea', c.text, set('text'), { rows: 5, hint: 'Codes: \\p leader · \\n[1] hero 1 · \\v[1] variable · \\g gold · \\i[1] item · \\c[2] red … \\c[0] · \\. pause · \\! wait for a key' });
            return h('div.form',
                row(field('Speaker', 'text', c.speaker, set('speaker'), { placeholder: 'Name tag (optional)' }), field('Position', 'select', c.pos, set('pos'), { options: [['bottom', 'Bottom'], ['middle', 'Middle'], ['top', 'Top']] })),
                row(h('div.field', h('span', { text: 'Face' }), h('div.row', faceBox, h('button.small', { text: 'Choose…', on: { click: (e) => { e.preventDefault(); pickGraphic({ kind: 'char', id: c.face }, (g) => { c.face = g.kind === 'char' ? g.id : ''; drawFace(); }, { charsOnly: true, noDir: true, title: 'Choose a face' }); } } }), h('button.small', { text: 'None', on: { click: (e) => { e.preventDefault(); c.face = ''; drawFace(); } } })))),
                ta);
        }
        case 'choice': {
            const wrap = h('div.form');
            const render = () => {
                wrap.replaceChildren();
                c.options.forEach((o, i) => wrap.appendChild(row(field('Option ' + (i + 1), 'text', o, (v) => { c.options[i] = v; }, { max: 60 }), c.options.length > 2 ? h('button.small.danger', { text: '✕', title: 'Remove option', on: { click: (e) => { e.preventDefault(); c.options.splice(i, 1); c.branches.splice(i, 1); if (c.cancel >= c.options.length) c.cancel = c.options.length - 1; render(); } } }) : null)));
                if (c.options.length < 4) wrap.appendChild(h('button.small', { text: '+ Add option', on: { click: (e) => { e.preventDefault(); c.options.push('Option ' + (c.options.length + 1)); c.branches.push([]); render(); } } }));
                wrap.appendChild(field('On Cancel', 'select', c.cancel, (v) => { c.cancel = v; }, { numeric: true, options: [[-1, 'Not allowed']].concat(c.options.map((o, i) => [i, 'Choose "' + o + '"'])) }));
            };
            render();
            return wrap;
        }
        case 'comment': return h('div.form', field('Comment', 'textarea', c.text, set('text'), { rows: 3 }));
        case 'if': {
            const k = c.cond;
            const wrap = h('div.form');
            const render = () => {
                wrap.replaceChildren();
                wrap.appendChild(field('Condition', 'select', k.kind, (v) => { k.kind = v; if (v === 'switch' || v === 'item' || v === 'actor' || v === 'self') k.value = true; else k.value = 0; render(); }, { options: [['switch', 'Switch'], ['var', 'Variable'], ['self', 'Self Switch'], ['item', 'Item'], ['gold', 'Gold'], ['actor', 'Hero in party']] }));
                if (k.kind === 'switch') wrap.appendChild(row(field('Switch', 'select', k.id || 1, (v) => { k.id = v; }, { numeric: true, options: switchOptions() }), field('is', 'select', k.value === false ? 'off' : 'on', (v) => { k.value = v === 'on'; }, { options: [['on', 'ON'], ['off', 'OFF']] })));
                if (k.kind === 'var') {
                    wrap.appendChild(row(field('Variable', 'select', k.id || 1, (v) => { k.id = v; }, { numeric: true, options: varOptions() }), field('', 'select', k.op || '>=', (v) => { k.op = v; }, { options: ['>=', '<=', '=', '!=', '>', '<'] })));
                    wrap.appendChild(row(field('Compare with', 'select', k.src || 'const', (v) => { k.src = v; render(); }, { options: [['const', 'A number'], ['var', 'Another variable']] }),
                        k.src === 'var' ? field('Variable', 'select', k.value || 1, (v) => { k.value = v; }, { numeric: true, options: varOptions() }) : field('Number', 'number', k.value | 0, (v) => { k.value = v; })));
                }
                if (k.kind === 'self') wrap.appendChild(row(field('Self Switch', 'select', k.key || 'A', (v) => { k.key = v; }, { options: ['A', 'B', 'C', 'D'] }), field('is', 'select', k.value === false ? 'off' : 'on', (v) => { k.value = v === 'on'; }, { options: [['on', 'ON'], ['off', 'OFF']] })));
                if (k.kind === 'item') wrap.appendChild(row(field('Item', 'select', k.id, (v) => { k.id = v; }, { numeric: true, options: dbOptions(p.items, 'choose an item') }), field('Party', 'select', k.value === false ? 'off' : 'on', (v) => { k.value = v === 'on'; }, { options: [['on', 'has it'], ['off', 'does not have it']] })));
                if (k.kind === 'gold') wrap.appendChild(row(field('Gold', 'select', k.op || '>=', (v) => { k.op = v; }, { options: ['>=', '<=', '=', '<', '>'] }), field('Amount', 'number', k.value | 0, (v) => { k.value = v; }, { min: 0 })));
                if (k.kind === 'actor') wrap.appendChild(row(field('Hero', 'select', k.id, (v) => { k.id = v; }, { numeric: true, options: dbOptions(p.actors) }), field('is', 'select', k.value === false ? 'off' : 'on', (v) => { k.value = v === 'on'; }, { options: [['on', 'in the party'], ['off', 'not in the party']] })));
                wrap.appendChild(field('Add an Else branch', 'check', !!c.else, (v) => { c.else = v ? (c.else || []) : null; }));
            };
            render();
            return wrap;
        }
        case 'wait': return h('div.form', field('Seconds', 'number', c.sec, set('sec'), { step: 0.1, min: 0, max: 60 }));
        case 'switch': return h('div.form', row(field('Switch', 'select', c.id, set('id'), { numeric: true, options: switchOptions() }), field('Set to', 'select', c.value, set('value'), { options: [['on', 'ON'], ['off', 'OFF'], ['toggle', 'Toggle']] })), h('p.hint', { text: 'Name your switches in Database ▸ Switches & Variables.' }));
        case 'var': {
            const wrap = h('div.form');
            const render = () => {
                wrap.replaceChildren(
                    row(field('Variable', 'select', c.id, set('id'), { numeric: true, options: varOptions() }), field('Operation', 'select', c.op, set('op'), { options: [['set', 'Set ='], ['add', 'Add +'], ['sub', 'Subtract −'], ['mul', 'Multiply ×'], ['div', 'Divide ÷'], ['mod', 'Remainder %']] })),
                    row(field('Value', 'select', c.src, (v) => { c.src = v; render(); }, { options: [['const', 'A number'], ['var', 'Another variable'], ['rand', 'A random number']] }),
                        c.src === 'var' ? field('Variable', 'select', c.value || 1, (v) => { c.value = v; }, { numeric: true, options: varOptions() }) : field(c.src === 'rand' ? 'From' : 'Number', 'number', c.value, (v) => { c.value = v; }),
                        c.src === 'rand' ? field('To', 'number', c.max, (v) => { c.max = v; }) : null));
            };
            render();
            return wrap;
        }
        case 'self': return h('div.form', row(field('Self Switch', 'select', c.key, set('key'), { options: ['A', 'B', 'C', 'D'] }), field('Set to', 'select', c.value ? 'on' : 'off', (v) => { c.value = v === 'on'; }, { options: [['on', 'ON'], ['off', 'OFF']] })), h('p.hint', { text: 'Each event has its own A–D. Add a page that needs this self switch to change how the event looks or acts.' }));
        case 'gold': return h('div.form', field('Amount (negative takes gold)', 'number', c.amount, set('amount'), { min: -9999999, max: 9999999 }));
        case 'item': return h('div.form', row(field('Item', 'select', c.item, set('item'), { numeric: true, options: dbOptions(p.items, p.items.length ? 'choose an item' : 'no items yet — make one in the Database') }), field('Amount', 'number', c.amount, set('amount'), { min: -99, max: 99 })));
        case 'party': return h('div.form', row(field('Hero', 'select', c.actor, set('actor'), { numeric: true, options: dbOptions(p.actors, 'choose a hero') }), field('', 'select', c.op, set('op'), { options: [['add', 'Add to party'], ['remove', 'Remove from party']] })));
        case 'exp': return h('div.form', row(field('Who', 'select', c.actor, set('actor'), { numeric: true, options: dbOptions(p.actors, 'Entire party') }), field('EXP', 'number', c.amount, set('amount'), { min: -999999, max: 999999 })));
        case 'transfer': {
            const info = h('div.posinfo');
            const show = () => { info.textContent = nameOf(p.maps, c.map) + ' (' + c.x + ', ' + c.y + ')'; };
            if (!c.map) { c.map = ctx && ctx.map ? ctx.map.id : p.maps[0].id; }
            show();
            return h('div.form', h('div.field', h('span', { text: 'Destination' }), h('div.row', info, h('button.small', { text: 'Choose on the map…', on: { click: (e) => { e.preventDefault(); pickPosition(c, (r) => { c.map = r.map; c.x = r.x; c.y = r.y; show(); }); } } }))),
                row(field('Facing', 'select', c.dir, set('dir'), { numeric: true, options: [[0, 'Keep'], [2, 'Down'], [4, 'Left'], [6, 'Right'], [8, 'Up']] }), field('Fade', 'check', c.fade, set('fade'))));
        }
        case 'route': {
            const steps = h('div.routesteps');
            const show = () => { steps.textContent = c.steps.length ? c.steps.join(' ') : '(empty)'; };
            show();
            const B = (label, s) => h('button.small', { text: label, on: { click: (e) => { e.preventDefault(); if (c.steps.length < 200) c.steps.push(s); show(); } } });
            const evs = ctx && ctx.map ? ctx.map.events.map((e) => [e.id, 'Event ' + e.id + ': ' + e.name]) : [];
            return h('div.form',
                field('Who moves', 'select', c.target, (v) => { c.target = /^\d+$/.test(v) ? Number(v) : v; }, { options: [['player', 'Player'], ['this', 'This event']].concat(evs) }),
                h('div.field', h('span', { text: 'Steps' }), steps),
                h('div.btnrow', B('↑ Up', 'u'), B('↓ Down', 'd'), B('← Left', 'l'), B('→ Right', 'r')),
                h('div.btnrow', B('Face ↑', 'tu'), B('Face ↓', 'td'), B('Face ←', 'tl'), B('Face →', 'tr'), B('Face player', 'tp')),
                h('div.btnrow', B('Wait', 'w'), B('Jump', 'j'), B('Hide', 'hide'), B('Show', 'show'), h('button.small.danger', { text: '⌫ Undo step', on: { click: (e) => { e.preventDefault(); c.steps.pop(); show(); } } }), h('button.small.danger', { text: 'Clear', on: { click: (e) => { e.preventDefault(); c.steps = []; show(); } } })),
                field('Wait for completion', 'check', c.wait, set('wait')));
        }
        case 'battle': return h('div.form', field('Troop', 'select', c.troop, set('troop'), { numeric: true, options: dbOptions(p.troops, p.troops.length ? 'choose a troop' : 'no troops yet — make one in the Database') }), row(field('Can escape', 'check', c.escape, set('escape')), field('If defeated', 'select', c.lose, set('lose'), { options: [['gameover', 'Game Over'], ['continue', 'Continue (run the Lose branch)']] })));
        case 'shop': {
            const box = h('div.checklist');
            for (const it of p.items) {
                if (it.kind === 'key') continue;
                const f = field(it.name + ' (' + it.price + ' ' + p.system.currency + ')', 'check', (c.goods || []).includes(it.id), (v) => { c.goods = c.goods.filter((g) => g !== it.id); if (v) c.goods.push(it.id); });
                box.appendChild(f);
            }
            if (!box.children.length) box.appendChild(h('p.hint', { text: 'Make some items in the Database first.' }));
            return h('div.form', h('div.field', h('span', { text: 'Goods for sale' }), box));
        }
        case 'end': return h('div.form', field('Closing text', 'textarea', c.text, set('text'), { rows: 4 }), h('p.hint', { text: 'Shows THE END, this text and your credits, then returns to the title.' }));
        case 'fadeout': case 'fadein': return h('div.form', field('Seconds', 'number', c.sec, set('sec'), { step: 0.1, min: 0, max: 10 }));
        case 'flash': return h('div.form', row(field('Colour', 'color', c.color, set('color')), field('Seconds', 'number', c.sec, set('sec'), { step: 0.1, min: 0, max: 10 })));
        case 'shake': return h('div.form', row(field('Power (1–12)', 'number', c.power, set('power'), { min: 1, max: 12 }), field('Seconds', 'number', c.sec, set('sec'), { step: 0.1, min: 0, max: 10 })));
        case 'tint': {
            const al = Math.round(parseInt((c.color + 'ff').slice(7, 9), 16) || 0);
            let rgb = c.color.slice(0, 7), a = c.color.length >= 9 ? al : 255;
            const upd = () => { c.color = rgb + Math.round(a).toString(16).padStart(2, '0'); };
            return h('div.form', row(field('Colour', 'color', rgb, (v) => { rgb = v; upd(); }), field('Strength', 'range', a / 255, (v) => { a = v * 255; upd(); }, { min: 0, max: 1, step: 0.05 })), field('Seconds', 'number', c.sec, set('sec'), { step: 0.1, min: 0, max: 10 }),
                h('div.btnrow', h('button.small', { text: 'Dusk', on: { click: (e) => { e.preventDefault(); c.color = '#ff7a3a40'; toast('Tint set to dusk'); } } }), h('button.small', { text: 'Night', on: { click: (e) => { e.preventDefault(); c.color = '#0a1040a0'; toast('Tint set to night'); } } }), h('button.small', { text: 'Normal', on: { click: (e) => { e.preventDefault(); c.color = '#00000000'; toast('Tint cleared'); } } })));
        }
        case 'sfx': return h('div.form', soundField('Sound', c.name, set('name')));
        case 'bgm': return h('div.form', musicField('Music', c.name, set('name')));
        default: return h('p', { text: 'This command has no settings.' });
    }
}
