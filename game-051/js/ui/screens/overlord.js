/**
 * overlord.js — the Throne Keep: your avatar, level, talents, spells, titles.
 */

import { h, app, btn, icon, num, toast, bar, modal } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { gestures, canvasEl } from '../input.js';
import { olXpToNext, talentPoints, raiseTalent, resetTalents, unlockedSpells, setSpell, maxStamina, spellPower } from '../../sim/overlord.js';
import { spend } from '../../sim/state.js';
import { TALENTS, TALENT_MAX, SPELLS, SPELL_IDS, OVERLORD_MAX_LEVEL } from '../../data/world.js';
import { sfx } from '../../audio.js';

let tab = 'talents';

export const overlordScreen = {
    id: 'overlord',
    stage: 'showcase',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        const st = peekStage('showcase');
        if (G.S.overlord.look) st.showOne({ look: G.S.overlord.look }, { sheet: 0.56, top: 0.14, element: 'dark' });
        this.detach = gestures(canvasEl(), { onDrag: (dx) => st.drag(dx) });
        this.render();
    },
    exit() { if (this.detach) this.detach(); },
    render() {
        const S = G.S, O = S.overlord, root = this.root;
        root.innerHTML = '';
        const top = h('div.hd-top', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }),
            h('div.hd-title', h('div.hd-name', O.name), h('div.hd-epithet', O.title), h('div.chips', { style: { justifyContent: 'center', marginTop: '4px' } }, h('span.chip', `Level ${O.level}`), h('span.chip', { html: `${icon('stamina')} max ${maxStamina(S)}` }))),
            btn('Edit', () => go('creator', { mode: 'overlord' }), 'ghost small'));
        const tabs = h('div.tabs', ...[['talents', 'Talents'], ['spells', 'Spells'], ['titles', 'Titles']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const xp = O.level >= OVERLORD_MAX_LEVEL ? 'MAX' : `${num(O.xp)} / ${num(olXpToNext(O.level))} XP`;
        app(body, h('div', { style: { marginBottom: '10px' } }, bar(O.level >= OVERLORD_MAX_LEVEL ? 1 : O.xp / olXpToNext(O.level), 'purple tall', `Overlord Lv ${O.level} · ${xp}`)));
        if (tab === 'talents') this.talents(body);
        else if (tab === 'spells') this.spells(body);
        else this.titles(body);
        root.append(top, h('div.hd-sheet', tabs, body));
    },
    talents(body) {
        const S = G.S;
        const pts = talentPoints(S);
        app(body, h('div.row', { style: { marginBottom: '8px' } }, h('div.grow', { html: `Talent points: <b style="color:var(--gold-2)">${pts}</b> <span class="muted small">(one per Overlord level)</span>` }),
            btn(`Reset ${icon('gem')}100`, () => { if (!spend(S, { gems: 100 })) { toast('Not enough gems.'); return; } resetTalents(S); changed('talent'); this.render(); }, 'ghost small')));
        for (const [id, T] of Object.entries(TALENTS)) {
            const r = S.overlord.talents[id];
            app(body, h('div.talent', h('div.t-ico', { html: icon(T.icon) }),
                h('div.grow', h('b', `${T.name} ${r}/${TALENT_MAX}`), h('div.small.muted', T.desc), h('div.pips', Array.from({ length: TALENT_MAX }, (_, i) => h('span.pip', { class: i < r ? 'on' : '' })))),
                btn('+', () => { if (raiseTalent(S, id)) { sfx('buff'); changed('talent'); this.render(); } else toast(r >= TALENT_MAX ? 'Maxed.' : 'No talent points — level up your Overlord in battle.'); }, 'gold small', { disabled: !pts || r >= TALENT_MAX, aria: `Raise ${T.name}` })));
        }
    },
    spells(body) {
        const S = G.S, O = S.overlord;
        const un = unlockedSpells(S);
        app(body, h('p.muted.small', `In battle your mana fills as heroes act. Equip two spells; tap them in battle (auto mode casts them for you). Spell power ×${spellPower(S).toFixed(2)} from Sovereignty.`));
        for (const slot of [0, 1]) {
            const id = O.spells[slot];
            app(body, h('div.card.row', h('b.grow', `Slot ${slot + 1}: ${id ? SPELLS[id].name : 'Empty'}`), h('span.small.muted', id ? `${SPELLS[id].cost} mana` : '')));
        }
        app(body, h('h2.sec', 'Spellbook'));
        for (const id of SPELL_IDS) {
            const sp = SPELLS[id];
            const open = un.includes(id);
            const eq = O.spells.indexOf(id);
            app(body, h('div.talent', { style: { opacity: open ? 1 : 0.5 } }, h('div.t-ico', { style: { color: sp.color }, html: icon('summon') }),
                h('div.grow', h('b', `${sp.name} · ${sp.cost} mana`), h('div.small.muted', open ? sp.desc : `Unlocks at Overlord level ${sp.level}`)),
                open ? h('div.row', { style: { gap: '4px' } }, btn('1', () => { setSpell(S, 0, id); changed('spell'); this.render(); }, eq === 0 ? 'gold small' : 'ghost small', { aria: 'Equip in slot 1' }), btn('2', () => { setSpell(S, 1, id); changed('spell'); this.render(); }, eq === 1 ? 'gold small' : 'ghost small', { aria: 'Equip in slot 2' })) : h('span', { html: icon('lock') })));
        }
    },
    titles(body) {
        const S = G.S, O = S.overlord;
        app(body, h('p.muted.small', 'Titles are earned by mastering feats. Wear one with pride.'));
        for (const t of O.titles) app(body, h('div.card.row', h('b.grow', t), O.title === t ? h('span.chip.on', 'Worn') : btn('Wear', () => { O.title = t; changed('title'); this.render(); }, 'small')));
    },
    refresh(what) { if (what !== 'tick') this.render(); },
};
