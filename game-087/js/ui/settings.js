// Settings: sound, typing sounds, embers, text size, the daily goal, Free Pen, backups and erasing.

import { h, field, toast } from './dom.js';
import * as A from '../sim/actions.js';
import { VERSION } from '../config.js';

export function openSettings(app) {
    import('./dom.js').then(({ modal }) => modal((card, close) => {
        const s = app.settings, S = app.S;
        const tog = (key, label) => {
            const el = h('input', { type: 'checkbox', id: `set-${key}`, checked: !!s[key] });
            el.addEventListener('change', () => { s[key] = el.checked; app.saveSettings(); });
            return h('label', { class: 'check' }, el, ` ${label}`);
        };
        const size = h('select', { id: 'set-text' }, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']].map(([v, n]) => h('option', { value: v, selected: s.textSize === v }, n)));
        size.addEventListener('change', () => { s.textSize = size.value; app.saveSettings(); });
        const goal = h('input', { type: 'number', id: 'set-goal', min: 50, max: 10000, step: 50, value: S?.player.dailyGoal || 300 });
        goal.addEventListener('change', () => { if (!S) return; A.setGoal(S, goal.value, app.ctx()); app.after(); goal.value = S.player.dailyGoal; });
        const free = h('input', { type: 'checkbox', id: 'set-freepen', checked: !!S?.player.freePen });
        free.addEventListener('change', () => { if (!S) return; A.setFreePen(S, free.checked, app.ctx()); app.after(); app.refresh(); toast(free.checked ? 'Free Pen: every room, talent and foe is open. You still earn XP.' : 'Free Pen is off: the guild’s road gates the rooms again.'); });
        card.append(h('h2', {}, 'Settings'),
            tog('sound', 'Sound'), tog('typing', 'Quill sounds while typing'), tog('motes', 'Drifting embers'),
            field('Text size', size),
            field('Daily goal (words)', goal, 'Your streak counts days at or above this.'),
            h('label', { class: 'check' }, free, ' Free Pen: open every room and talent now'),
            h('p', { class: 'hint' }, 'For writers who want the tools without the climb. XP, quests and laurels still count.'),
            h('h3', {}, 'Your work'),
            h('p', { class: 'hint' }, 'Everything is saved in this browser only. Download a backup now and then, and before you clear your browser’s data.'),
            h('div', { class: 'row-wrap' },
                h('button', { class: 'btn', id: 'set-backup', onclick: () => app.downloadBackup() }, 'Download a backup'),
                h('button', { class: 'btn', id: 'set-import', onclick: async () => { if (await app.importBackup()) close(); } }, 'Import a backup'),
                h('button', { class: 'btn danger', id: 'set-erase', onclick: () => app.eraseAll() }, 'Erase everything')),
            h('p', { class: 'version' }, `Quillsworn v${VERSION}`),
            h('div', { class: 'row-end' }, h('button', { class: 'btn primary', onclick: close }, 'Done')));
    }, { label: 'Settings' }));
}
