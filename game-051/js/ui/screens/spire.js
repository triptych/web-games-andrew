/**
 * spire.js — the Endless Spire: the next floor, rewards, blessings.
 */

import { h, app, btn, icon, num, toast, modal, stars, rewardGrid } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { spireInfo, spireWaves, blessingText } from '../../sim/content.js';
import { BLESSINGS, BLESSING_RARITY, BOSSES, SPECIES } from '../../data/world.js';
import { sfx, playMusic } from '../../audio.js';

export const spireScreen = {
    id: 'spire',
    stage: 'spire',
    enter(root) {
        this.root = root;
        peekStage('spire').setFloor(G.S.spire.floor);
        playMusic('summon');
        this.render();
        if (G.S.spire.offer) setTimeout(() => this.offer(), 300);
    },
    render() {
        const S = G.S, root = this.root;
        root.innerHTML = '';
        const f = S.spire.floor;
        const info = spireInfo(f);
        const wave = spireWaves(f)[0];
        const foes = wave.map((r) => r.boss ? BOSSES[r.boss].name : SPECIES[r.species].name);
        const rew = [{ kind: 'spireTokens', n: info.tokens }, { kind: 'gold', n: info.gold }];
        if (info.gems) rew.push({ kind: 'gems', n: info.gems });
        if (info.legend) rew.push({ kind: 'sigils', id: 'legend', n: 1 });
        else if (info.boss) rew.push({ kind: 'sigils', id: 'mystic', n: 1 });
        const blist = h('div.chips');
        for (const b of S.spire.blessings) {
            const def = BLESSINGS.find((x) => x.id === b.id);
            blist.append(h('span.chip', { style: { borderColor: BLESSING_RARITY[b.rar].color } }, `${def.name}: ${blessingText(b)}`));
        }
        const hud = h('div.scene-hud',
            h('div.hud-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('div.grow', h('div.hud-title', `Endless Spire`), h('div.small', `Best floor ${S.spire.best}`))),
            h('div.hud-bottom',
                h('div.hud-card',
                    h('div.row', h('div.grow', h('div', { style: { fontFamily: 'var(--title)', fontSize: '24px', color: info.boss ? '#ff8a9a' : 'var(--gold-2)' } }, `Floor ${f}${info.boss ? ' · Guardian' : ''}`), h('div.small.muted', { html: `${stars(info.star)} enemies, level ${info.level}${info.diff > 1.5 ? ` · ×${info.diff.toFixed(2)} might` : ''}` })),
                        btn('Climb', () => go('team', { mode: 'spire', floor: f }), 'gold')),
                    h('div.small.muted', { style: { margin: '6px 0' } }, `Foes: ${foes.join(', ')}`),
                    rewardGrid(rew),
                    h('div.small.muted', { style: { marginTop: '6px' } }, 'Floors are free to attempt. Every 5th floor grants a Spire Blessing; every 10th is guarded; every 50th holds a Legendary Sigil.')),
                S.spire.blessings.length ? h('div.hud-card', h('div.small', { style: { marginBottom: '4px' } }, `Blessings (${S.spire.blessings.length}) — active in the Spire only`), blist) : null));
        root.append(hud);
    },
    offer() {
        const S = G.S;
        const offer = S.spire.offer;
        if (!offer) return;
        const body = h('div.list');
        let m;
        for (const b of offer) {
            const def = BLESSINGS.find((x) => x.id === b.id);
            const R = BLESSING_RARITY[b.rar];
            body.append(h('button.card', { type: 'button', style: { width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: R.color, boxShadow: `0 0 12px ${R.color}55` }, onclick: () => {
                S.spire.blessings.push(b);
                S.spire.offer = null;
                sfx('buff');
                changed('blessing');
                peekStage('spire').celebrate();
                m.close();
                this.render();
            } }, h('div', { style: { color: R.color, fontSize: '13px', fontWeight: 900 } }, R.name.toUpperCase()), h('b', def.name), h('div.small.muted', blessingText(b))));
        }
        m = modal({ title: 'Spire Blessing — choose one', body, dismiss: false });
    },
    refresh(what) { if (what !== 'tick') { peekStage('spire').setFloor(G.S.spire.floor); this.render(); } },
};
