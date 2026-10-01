/**
 * creator.js — the character creator. Builds the Overlord at the start of
 * a new game and doubles as the Wardrobe for any hero. Every option rebuilds
 * the 3D model live; Randomize respects per-group locks.
 */

import { h, app, btn, icon, toast, modal } from '../dom.js';
import { G, changed, saveGame } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { gestures, canvasEl } from '../input.js';
import { Rng } from '../../core/rng.js';
import { RACES, RACE_IDS, ELEMENTS, ELEMENT } from '../../data/core.js';
import { CLASS_IDS, WEAPONS, WEAPON_NAME, OUTFITS, OUTFIT_NAME, HEADWEAR, HEADWEAR_NAME } from '../../data/classes.js';
import { EYE_STYLES, BROWS, MOUTHS, MARKS, SCARS, HAIR_STYLES, EAR_TYPES, EAR_NAME, HORNS, TAILS, WINGS, BEARDS, CAPES, SHOULDERS, AURAS, HAIR_COLORS, EYE_COLORS, METALS, ELEMENT_PALETTE, GLOW_COLORS } from '../../data/looks.js';
import { generateLook, randomName } from '../../sim/heroes.js';
import { heroById } from '../../sim/state.js';
import { invalidatePortrait } from '../portraits.js';
import { invalidateOverlordPortrait } from '../hud.js';
import { sfx, playMusic } from '../../audio.js';
import { showIntro } from './title.js';

const SKIN_EXTRA = ['#ffe8d6', '#f0c8a8', '#d8a078', '#a8704a', '#6a4430', '#c8d8c0', '#b8c8e8', '#e8b8d8', '#8fbf6a', '#e86a6a', '#9b5ad6', '#d0d0d8'];
const CLOTH = ['#d8402a', '#e8902a', '#f0d040', '#5ac05a', '#2a8a5a', '#3aa0e8', '#2a5ab8', '#7a4ad0', '#c84aa0', '#f4f0e4', '#8a8a96', '#3a3040', '#14101a', '#6a4a2a', '#c8a050', '#e8c8a0'];

let tab = 'body';
const locks = new Set();

const GROUPS = {
    race: ['race', 'skin', 'ears', 'build', 'height', 'head'],
    face: ['eyes', 'eyeColor', 'brows', 'mouth', 'blush', 'marks', 'markColor', 'scar'],
    hair: ['hair', 'hairColor', 'hairTip', 'beard'],
    feat: ['horns', 'hornColor', 'tail', 'wings', 'wingColor', 'tusks'],
    outfit: ['outfit', 'c1', 'c2', 'c3', 'cape', 'headwear', 'shoulders'],
    weapon: ['weapon', 'shield', 'metal', 'glow'],
    aura: ['aura'],
};

export const creatorScreen = {
    id: 'creator',
    stage: 'showcase',
    chrome: 'none',
    enter(root, params) {
        this.root = root;
        this.mode = params.mode || 'overlord';
        this.first = !!params.first;
        this.rng = new Rng((Date.now() ^ 0x2468) >>> 0);
        if (this.mode === 'hero') {
            const hero = heroById(G.S, params.id);
            this.hero = hero;
            this.look = structuredClone(hero.look);
            this.name = hero.name;
        } else {
            const S = G.S;
            this.look = S.overlord.look ? structuredClone(S.overlord.look) : this.randomLook();
            this.name = S.overlord.look ? S.overlord.name : randomName(this.rng, this.look.race);
        }
        const st = peekStage('showcase');
        this.detach = gestures(canvasEl(), { onDrag: (dx) => st.drag(dx) });
        playMusic('citadel');
        this.rebuild();
        this.render();
    },
    exit() { if (this.detach) this.detach(); },
    randomLook(keep) {
        const r = this.rng;
        const race = keep && locks.has('race') ? this.look.race : this.mode === 'hero' ? this.hero.race : r.pick(RACE_IDS);
        const el = r.pick(ELEMENTS);
        const look = generateLook(r, race, r.pick(CLASS_IDS), el, r.int(4, 6));
        if (this.mode === 'overlord') { look.cape = look.cape || 2; look.aura = look.aura || r.pick([1, 2, 3, 4, 5]); }
        if (keep) for (const g of locks) for (const k of GROUPS[g] || []) look[k] = this.look[k];
        if (this.mode === 'hero') look.race = this.hero.race;
        look.radiant = this.mode === 'hero' ? this.hero.radiant : !!look.radiant;
        return look;
    },
    rebuild() {
        const st = peekStage('showcase');
        const angle = st.spin;
        st.showOne({ look: this.look }, { sheet: 0.5, top: 0.09, element: this.mode === 'hero' ? this.hero.el : 'dark', angle });
    },
    set(k, v) {
        this.look[k] = v;
        if (k === 'race' && this.mode === 'overlord') {
            const R = RACES[v];
            this.look.skin = R.skins[0];
            this.look.ears = R.ears[0];
            this.look.height = +((R.height[0] + R.height[1]) / 2).toFixed(3);
            this.look.head = +((R.head[0] + R.head[1]) / 2).toFixed(3);
            this.look.build = R.build || 1;
        }
        sfx('click');
        this.rebuild();
        this.render();
    },
    render() {
        const root = this.root;
        const keepScroll = root.querySelector('.creator-panel .sheet-body');
        const scroll = keepScroll ? keepScroll.scrollTop : 0;
        root.innerHTML = '';
        const L = this.look;
        const nameIn = h('input.name-input', { value: this.name, maxlength: 18, 'aria-label': 'Name', oninput: (e) => { this.name = e.target.value; } });
        const top = h('div.creator-top',
            this.first ? null : btn(icon('back'), () => back(this.mode === 'hero' ? 'heroes' : 'overlord'), 'ghost small', { aria: 'Back' }),
            nameIn,
            btn(icon('dice'), () => { this.name = randomName(this.rng, L.race); nameIn.value = this.name; sfx('click'); }, 'ghost small', { aria: 'Random name', title: 'Random name' }));
        const tabs = h('div.tabs', ...[['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['feat', 'Features'], ['outfit', 'Outfit'], ['weapon', 'Weapon'], ['aura', 'Aura']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const o = (label, group, opts, cur, fn) => this.optRow(label, group, opts, cur, fn);
        const sw = (label, group, colors, cur, fn, extra = {}) => this.swatchRow(label, group, colors, cur, fn, extra);
        const sl = (label, k, min, max, step) => h('div.opt-group', h('div.opt-label', `${label}: ${Number(L[k]).toFixed(2)}`), h('input.range', { type: 'range', min, max, step, value: L[k], oninput: (e) => { L[k] = +e.target.value; e.target.previousSibling.textContent = `${label}: ${(+e.target.value).toFixed(2)}`; clearTimeout(this._t); this._t = setTimeout(() => this.rebuild(), 60); } }));
        switch (tab) {
            case 'body':
                if (this.mode === 'overlord') app(body, o('Race', 'race', RACE_IDS.map((r) => [r, RACES[r].name]), L.race, (v) => this.set('race', v)));
                app(body, sw('Skin', 'race', [...new Set([...RACES[L.race].skins, ...SKIN_EXTRA])], L.skin, (v) => this.set('skin', v), { custom: true }),
                    sl('Build', 'build', 0.8, 1.35, 0.01), sl('Height', 'height', 0.75, 1.2, 0.01), sl('Head size', 'head', 0.88, 1.18, 0.01));
                break;
            case 'face':
                app(body, o('Eyes', 'face', EYE_STYLES.map((n, i) => [i, n]), L.eyes, (v) => this.set('eyes', v)),
                    sw('Eye colour', 'face', EYE_COLORS, L.eyeColor, (v) => this.set('eyeColor', v), { custom: true }),
                    o('Brows', 'face', BROWS.map((n, i) => [i, n]), L.brows, (v) => this.set('brows', v)),
                    o('Mouth', 'face', MOUTHS.map((n, i) => [i, n]), L.mouth, (v) => this.set('mouth', v)),
                    o('Blush', 'face', [[true, 'On'], [false, 'Off']], !!L.blush, (v) => this.set('blush', v)),
                    o('Markings', 'face', MARKS.map((n, i) => [i, n]), L.marks, (v) => this.set('marks', v)),
                    sw('Marking colour', 'face', ['#c03030', '#2a2a3a', '#ffffff', '#3a8aff', '#ffd84a', '#a65cff', '#4fd36a'], L.markColor, (v) => this.set('markColor', v), { custom: true }),
                    o('Scar', 'face', SCARS.map((n, i) => [i, n]), L.scar, (v) => this.set('scar', v)));
                break;
            case 'hair':
                app(body, o('Style', 'hair', HAIR_STYLES.map((n, i) => [i, n]), L.hair, (v) => this.set('hair', v)),
                    sw('Colour', 'hair', HAIR_COLORS, L.hairColor, (v) => this.set('hairColor', v), { custom: true }),
                    sw('Tips', 'hair', ['#ffffff', '#ffd84a', '#ff6a3d', '#3da5ff', '#4fd36a', '#a65cff', '#ff8ad8'], L.hairTip, (v) => this.set('hairTip', v), { none: true, custom: true }),
                    o('Beard', 'hair', BEARDS.map((n, i) => [i, n]), L.beard, (v) => this.set('beard', v)));
                break;
            case 'feat':
                app(body, o('Ears', 'feat', EAR_TYPES.map((e) => [e, EAR_NAME[e]]), L.ears, (v) => this.set('ears', v)),
                    o('Horns', 'feat', HORNS.map((n, i) => [i, n]), L.horns, (v) => this.set('horns', v)),
                    sw('Horn colour', 'feat', ['#f4ead8', '#3a2a2a', '#c8a070', '#2a2238', '#7a1e0c', '#0b3a73', '#ffd24a'], L.hornColor, (v) => this.set('hornColor', v), { custom: true }),
                    o('Tail', 'feat', TAILS.map((n, i) => [i, n]), L.tail, (v) => this.set('tail', v)),
                    o('Wings', 'feat', WINGS.map((n, i) => [i, n]), L.wings, (v) => this.set('wings', v)),
                    sw('Wing colour', 'feat', ['#2a2230', '#f4f0f8', '#bff0ff', '#ffd0f0', '#7a1e0c', '#0b3a73', '#3a1470', '#155f2a'], L.wingColor, (v) => this.set('wingColor', v), { custom: true }),
                    o('Tusks', 'feat', [[true, 'Yes'], [false, 'No']], !!L.tusks, (v) => this.set('tusks', v)));
                break;
            case 'outfit':
                app(body, o('Armour', 'outfit', OUTFITS.map((x) => [x, OUTFIT_NAME[x]]), L.outfit, (v) => this.set('outfit', v)),
                    sw('Primary', 'outfit', [...new Set([...ELEMENTS.flatMap((e) => ELEMENT_PALETTE[e].c1), ...CLOTH])], L.c1, (v) => this.set('c1', v), { custom: true }),
                    sw('Secondary', 'outfit', [...new Set([...ELEMENTS.flatMap((e) => ELEMENT_PALETTE[e].c2), ...CLOTH])], L.c2, (v) => this.set('c2', v), { custom: true }),
                    sw('Trim', 'outfit', [...new Set([...ELEMENTS.flatMap((e) => ELEMENT_PALETTE[e].c3), '#ffffff', '#c0c0c8'])], L.c3, (v) => this.set('c3', v), { custom: true }),
                    o('Cape', 'outfit', CAPES.map((n, i) => [i, n]), L.cape, (v) => this.set('cape', v)),
                    o('Headwear', 'outfit', HEADWEAR.map((x) => [x, HEADWEAR_NAME[x]]), L.headwear, (v) => this.set('headwear', v)),
                    o('Shoulders', 'outfit', SHOULDERS.map((n, i) => [i, n]), L.shoulders, (v) => this.set('shoulders', v)));
                break;
            case 'weapon':
                app(body, o('Weapon', 'weapon', WEAPONS.map((w) => [w, WEAPON_NAME[w]]), L.weapon, (v) => this.set('weapon', v)),
                    o('Shield', 'weapon', [[true, 'Yes'], [false, 'No']], !!L.shield, (v) => this.set('shield', v)),
                    sw('Metal', 'weapon', METALS, L.metal, (v) => this.set('metal', v), { custom: true }),
                    sw('Glow', 'weapon', GLOW_COLORS, L.glow, (v) => this.set('glow', v), { custom: true }));
                if (this.mode === 'hero') app(body, h('p.muted.small', 'The weapon is cosmetic: skills stay with the class.'));
                break;
            case 'aura':
                app(body, o('Aura', 'aura', AURAS.map((n, i) => [i, n]), L.aura, (v) => this.set('aura', v)),
                    h('p.muted.small', 'Auras shimmer around the character in battle and on the pedestal.'));
                break;
            default: break;
        }
        const foot = h('div.sheet-foot', h('div.btn-row',
            btn(`${icon('dice')} Randomize`, () => { this.look = this.randomLook(true); if (!locks.has('race') && this.mode === 'overlord') this.name = randomName(this.rng, this.look.race); sfx('page'); this.rebuild(); this.render(); }, 'ghost'),
            btn(this.first ? 'Begin Reign' : 'Save', () => this.save(), 'gold')));
        const panel = h('div.creator-panel', tabs, body, foot);
        app(root, h('div.creator', top, panel));
        const nb = root.querySelector('.creator-panel .sheet-body');
        if (nb) nb.scrollTop = scroll;
    },
    lockBtn(group) {
        const on = locks.has(group);
        return h('button.icon-btn.lock-btn', { type: 'button', title: on ? 'Locked for Randomize' : 'Lock for Randomize', 'aria-label': 'Lock', style: { width: '34px', height: '34px', color: on ? 'var(--gold)' : 'var(--dim)' }, html: icon('lock'), onclick: () => { if (on) locks.delete(group); else locks.add(group); this.render(); } });
    },
    optRow(label, group, opts, cur, fn) {
        const row = h('div.opt-row');
        for (const [v, l] of opts) app(row, h('button.opt', { type: 'button', class: v === cur ? 'on' : '', onclick: () => fn(v) }, l));
        return h('div.opt-group', h('div.opt-label', label, this.lockBtn(group)), row);
    },
    swatchRow(label, group, colors, cur, fn, extra) {
        const row = h('div.opt-row');
        if (extra.none) app(row, h('button.opt', { type: 'button', class: !cur ? 'on' : '', onclick: () => fn(null) }, 'None'));
        for (const c of colors) app(row, h('button.swatch', { type: 'button', class: c === cur ? 'on' : '', style: { background: c }, 'aria-label': c, onclick: () => fn(c) }));
        if (extra.custom) {
            const input = h('input', { type: 'color', value: cur || '#ffffff', 'aria-label': 'Custom colour', onchange: (e) => fn(e.target.value) });
            app(row, h('label.swatch.custom', { class: cur && !colors.includes(cur) ? 'on' : '', title: 'Custom colour' }, input));
        }
        return h('div.opt-group', h('div.opt-label', label, this.lockBtn(group)), row);
    },
    save() {
        const S = G.S;
        const name = (this.name || '').trim().slice(0, 18) || 'Overlord';
        if (this.mode === 'hero') {
            const hero = this.hero;
            invalidatePortrait(hero);
            hero.look = this.look;
            hero.name = name;
            changed('wardrobe');
            toast(`${name}'s new look is saved.`, 'good');
            back('heroes');
            return;
        }
        S.overlord.look = this.look;
        S.overlord.name = name;
        S.story.created = true;
        invalidateOverlordPortrait();
        changed('overlord');
        saveGame(true);
        sfx('reward');
        if (this.first) go('citadel', { first: true }, { fade: true, noHistory: true });
        else back('overlord');
    },
};
