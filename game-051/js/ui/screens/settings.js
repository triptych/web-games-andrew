/**
 * settings.js — sound, graphics, battle defaults, save export/import, help.
 */

import { h, app, btn, icon, toast, modal, confirmBox } from '../dom.js';
import { G, changed, saveGame, exportSave, importSave, wipeSave } from '../../game.js';
import { go, back } from '../app.js';
import { setQuality, getQuality, isAutoQuality } from '../../view/engine.js';
import { setSound, setMusic, sfx } from '../../audio.js';

function toggle(label, on, fn) {
    return h('div.card.row', h('b.grow', label), btn(on ? 'On' : 'Off', fn, on ? 'gold small' : 'ghost small'));
}

export const settingsScreen = {
    id: 'settings',
    stage: 'citadel',
    enter(root) { this.root = root; this.render(); },
    render() {
        const S = G.S, root = this.root, st = S.settings;
        root.innerHTML = '';
        const wrap = h('div.wrap');
        const q = isAutoQuality() ? 'auto' : getQuality();
        app(wrap,
            h('h2.sec', 'Sound'),
            toggle('Sound effects', st.sound, () => { st.sound = !st.sound; setSound(st.sound); changed('settings'); this.render(); }),
            toggle('Music', st.music, () => { st.music = !st.music; setMusic(st.music); changed('settings'); this.render(); }),
            h('h2.sec', 'Graphics'),
            h('div.card', h('b', 'Quality'), h('p.muted.small', 'Auto lowers resolution if your device struggles.'), h('div.chips', ...[['auto', 'Auto'], [0, 'High'], [1, 'Medium'], [2, 'Low']].map(([v, l]) => h('button.chip', { class: q === v ? 'on' : '', onclick: () => { setQuality(v === 'auto' ? null : v); this.render(); } }, l)))),
            h('h2.sec', 'Battle'),
            toggle('Start battles on Auto', st.auto !== false, () => { st.auto = st.auto === false; changed('settings'); this.render(); }),
            h('div.card', h('b', 'Default speed'), h('div.chips', ...[1, 2, 3].map((v) => h('button.chip', { class: st.speed === v ? 'on' : '', onclick: () => { st.speed = v; changed('settings'); this.render(); } }, `${v}×`)))),
            h('h2.sec', 'How to play'),
            h('div.card', h('p.small', { html: [
                '<b>Summon</b> heroes at the Circle — every one is unique. Mystic Sigils guarantee 3★+, with a 5★ by the 90th pull.',
                '<b>Battle</b> in the Adventure tab. Turns follow speed (the bar at the top). Element advantage: Fire › Wind › Water › Fire; Light and Dark beat each other.',
                '<b>Grow</b> heroes with XP Elixirs, Sigilstones (gear), evolution (max level + same-star fodder), awakening (essences) and skill-ups.',
                '<b>Idle</b>: the Treasury, Training Grounds, Mine miners, Farm and expeditions keep working while you are away.',
                '<b>Overlord</b>: your level gives talent points and spells; cast them in battle with mana.',
            ].join('<br><br>') })),
            h('h2.sec', 'Save'),
            h('div.card', h('p.muted.small', 'Your citadel saves automatically in this browser. Export a backup code to move it to another device.'),
                h('div.btn-row', btn('Export', () => this.export(), ''), btn('Import', () => this.import(), ''))),
            h('div.card', h('div.btn-row',
                btn('Title Screen', () => { saveGame(true); go('title', {}, { noHistory: true, fade: true }); }, 'ghost'),
                btn('Delete Save', async () => { if (await confirmBox('Delete everything and start over? This cannot be undone.', 'Delete', 'Cancel', 'red')) { wipeSave(); location.reload(); } }, 'red'))),
            h('div.card', h('a', { href: '../index.html', style: { color: 'var(--gold-2)' } }, '← Back to the games collection')),
            h('p.muted.small.center', 'Sigilborn · every model, face, icon and sound is generated in code.'));
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Settings')), h('div.sheet-body', wrap)));
    },
    export() {
        saveGame(true);
        const ta = h('textarea.save-box', { readonly: true }, exportSave());
        modal({ title: 'Export Save', body: h('div', h('p.small.muted', 'Copy this code somewhere safe.'), ta), buttons: [{ label: 'Copy', cls: 'gold', onClick: () => { ta.select(); try { navigator.clipboard.writeText(ta.value); toast('Copied!', 'good'); } catch { document.execCommand('copy'); } return false; } }, { label: 'Close', cls: 'ghost' }] });
    },
    import() {
        const ta = h('textarea.save-box', { placeholder: 'Paste a save code…' });
        modal({ title: 'Import Save', body: h('div', h('p.small.muted', 'This replaces your current save.'), ta), buttons: [{ label: 'Cancel', cls: 'ghost' }, { label: 'Import', cls: 'gold', onClick: () => { try { importSave(ta.value); toast('Save imported.', 'good'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That code could not be read.', 'bad'); return false; } } }] });
    },
};
