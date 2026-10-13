// Quick event templates: ready-made events an apprentice can drop on the map
// and then edit. Each needs a feature, like the commands it is built from.
import { store } from './store.js';
import { pickPosition } from './pickers.js';
import { modal, field, h } from './ui.js';

const S = () => store.TW.schema;
const C = (t, o) => Object.assign(S().command(t), o || {});
const pageWith = (o) => Object.assign(S().page(), o);
const cond = (o) => Object.assign(S().page().cond, o);

export const TEMPLATES = [
    { id: 'npc', label: 'NPC', icon: '🧑', f: 'tpl.npc', make: () => [pageWith({ gfx: { kind: 'char', id: 'villager', dir: 2 }, list: [C('text', { speaker: 'Villager', face: 'villager', text: 'Hello there, traveller!' })] })] },
    { id: 'sign', label: 'Sign', icon: '🪧', f: 'tpl.sign', make: () => [pageWith({ gfx: { kind: 'obj', id: 'sign', dir: 2 }, list: [C('text', { text: 'Welcome to our village!' })] })] },
    { id: 'chest', label: 'Treasure Chest', icon: '🧰', f: 'tpl.chest', make: () => {
        const it = store.project.items[0];
        return [
            pageWith({ gfx: { kind: 'obj', id: 'chest', dir: 2 }, list: [C('sfx', { name: 'open' }), C('text', { text: it ? 'Found \\c[4]' + it.name + '\\c[0]!' : 'Found 50 gold!' }), it ? C('item', { item: it.id, amount: 1 }) : C('gold', { amount: 50 }), C('self', { key: 'A', value: true })] }),
            pageWith({ gfx: { kind: 'obj', id: 'chest_open', dir: 2 }, cond: cond({ self: 'A' }), list: [] }),
        ];
    } },
    { id: 'door', label: 'Door / Exit', icon: '🚪', f: 'tpl.door', ask: 'position', make: (pos) => [pageWith({ trigger: 'touch', priority: 'below', list: [C('transfer', { map: pos.map, x: pos.x, y: pos.y, dir: 0, fade: true })] })] },
    { id: 'shop', label: 'Shopkeeper', icon: '🏪', f: 'tpl.shop', make: () => [pageWith({ gfx: { kind: 'char', id: 'merchant', dir: 2 }, list: [C('text', { speaker: 'Merchant', face: 'merchant', text: 'Take a look at my wares!' }), C('shop', { goods: store.project.items.filter((i) => i.kind !== 'key').slice(0, 6).map((i) => i.id) })] })] },
    { id: 'inn', label: 'Innkeeper', icon: '🛏️', f: 'tpl.inn', make: () => [pageWith({ gfx: { kind: 'char', id: 'innkeeper', dir: 2 }, list: [
        C('text', { speaker: 'Innkeeper', face: 'innkeeper', text: 'A night\'s rest is 10 ' + store.project.system.currency + '. Will you stay?' }),
        C('choice', { options: ['Stay', 'Leave'], cancel: 1, branches: [[C('if', { cond: { kind: 'gold', op: '>=', value: 10, id: 0, src: 'const', key: 'A' }, then: [C('gold', { amount: -10 }), C('fadeout', { sec: 0.6 }), C('heal'), C('sfx', { name: 'heal' }), C('wait', { sec: 0.6 }), C('fadein', { sec: 0.6 }), C('text', { speaker: 'Innkeeper', face: 'innkeeper', text: 'Good morning!' })], else: [C('text', { speaker: 'Innkeeper', face: 'innkeeper', text: 'You don\'t have enough money.' })] })], [C('text', { speaker: 'Innkeeper', face: 'innkeeper', text: 'Come again!' })]] }),
    ] })] },
    { id: 'monster', label: 'Monster', icon: '👾', f: 'tpl.monster', ask: 'troop', make: (troop) => [
        pageWith({ gfx: { kind: 'char', id: 'slime', dir: 2 }, trigger: 'touch', move: 'random', speed: 2, list: [C('battle', { troop, escape: true, lose: 'gameover', win: [C('self', { key: 'A', value: true })] })] }),
        pageWith({ cond: cond({ self: 'A' }), list: [] }),
    ] },
    { id: 'spring', label: 'Healing Spring', icon: '⛲', f: 'tpl.spring', make: () => [pageWith({ gfx: { kind: 'obj', id: 'spring', dir: 2 }, list: [C('heal'), C('sfx', { name: 'heal' }), C('flash', { color: '#a8ffc8', sec: 0.5 }), C('text', { text: 'The water restores your strength!' })] })] },
    { id: 'save', label: 'Save Crystal', icon: '💎', f: 'tpl.save', make: () => [pageWith({ gfx: { kind: 'obj', id: 'crystal', dir: 2 }, list: [C('sfx', { name: 'save' }), C('text', { text: 'The crystal hums. Open the menu (Cancel) and choose Save to record your journey.' })] })] },
];

/** Create a template event at (x, y). Calls done(event) or nothing if cancelled. */
export function makeTemplate(id, map, x, y, done) {
    const t = TEMPLATES.find((q) => q.id === id);
    if (!t) return;
    const build = (arg) => {
        const ev = S().event(S().nextId(map.events), x, y, t.label);
        ev.pages = t.make(arg);
        done(ev);
    };
    if (t.ask === 'position') pickPosition({ map: map.id, x, y }, (pos) => build(pos));
    else if (t.ask === 'troop') {
        const troops = store.project.troops;
        if (!troops.length) { modal({ title: 'No troops yet', body: h('p', { text: 'Make an enemy and a troop in the Database first (Database ▸ Enemies, then Troops).' }), buttons: [{ label: 'OK', primary: true }] }); return; }
        let pick = troops[0].id;
        modal({ title: 'Which troop?', body: field('Troop', 'select', pick, (v) => { pick = v; }, { numeric: true, options: troops.map((q) => [q.id, q.name]) }), buttons: [{ label: 'Cancel' }, { label: 'Place', primary: true, onClick: () => build(pick) }] });
    } else build();
}
