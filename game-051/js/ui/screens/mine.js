/**
 * mine.js — dig the rock face, descend layers, manage idle miners.
 */

import * as THREE from 'three';
import { h, app, btn, icon, num, toast, modal, heroCard, showRewards, describe, $ } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { gestures, canvasEl } from '../input.js';
import { toScreen } from '../../view/engine.js';
import { ensureGrid, canHit, strike, canDescend, descend, tickEnergy, maxEnergy, energyNext, pickPower, minerSlots, minersPending, collectMiners, setMiners, minerRate, CELL } from '../../sim/mine.js';
import { heroById } from '../../sim/state.js';
import { heroBusy } from '../../sim/idle.js';
import { ORES } from '../../data/items.js';
import { dur } from '../../core/fmt.js';
import { sfx } from '../../audio.js';

export const mineScreen = {
    id: 'mine',
    stage: 'mine',
    enter(root) {
        this.root = root;
        const S = G.S;
        ensureGrid(S);
        const st = peekStage('mine');
        this.sync();
        st.setMiners(S.mine.miners.map((id) => heroById(S, id)).filter(Boolean).map((x) => x.look));
        this.detach = gestures(canvasEl(), { onTap: (x, y) => this.tap(x, y) });
        this.render();
    },
    exit() { if (this.detach) this.detach(); },
    sync() {
        const S = G.S;
        peekStage('mine').setGrid(S.mine.grid, S.mine.depth, (r, c) => canHit(S, r, c));
    },
    render() {
        const S = G.S, root = this.root;
        tickEnergy(S);
        root.innerHTML = '';
        const next = energyNext(S);
        const pend = minersPending(S);
        const hud = h('div.scene-hud',
            h('div.hud-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }),
                h('div.grow', h('div.hud-title', `The Mine · Depth ${S.mine.depth}`), h('div.small', { html: `${icon('pick')} <b>${S.mine.energy}/${maxEnergy(S)}</b> energy${next > 0 ? ` · +1 in ${dur(next)}` : ''} · power ${pickPower(S)}` }))),
            h('div.hud-bottom',
                h('div.hud-card.row', h('div.grow.small', { html: `Miners ${S.mine.miners.length}/${minerSlots(S)} · ${num(pend)} ore waiting` }),
                    btn('Collect', () => { const r = collectMiners(S); if (!r) { toast('Nothing yet — miners dig while you are away.'); return; } sfx('coin'); changed('mine'); showRewards('Miners Report', r); this.render(); }, 'gold small', { disabled: pend < 1 }),
                    btn('Miners', () => this.minerPicker(), 'small')),
                h('div.row', { style: { gap: '8px' } },
                    btn('Descend ▼', () => { if (!descend(S)) { toast('Dig a path to the bottom row first.'); return; } sfx('crumble'); changed('mine'); this.sync(); this.render(); toast(`Depth ${S.mine.depth}: richer ore ahead.`, 'good'); }, canDescend(S) ? 'gold grow' : 'grow', { disabled: !canDescend(S) }),
                    btn(`${icon('hammer')} Forge`, () => go('forge', { tab: 'craft' }), 'ghost'))));
        root.append(hud);
        if (!S.story.tips.mine) {
            S.story.tips.mine = 1;
            modal({ title: 'The Mine', body: h('div', h('p', 'Tap a bright block next to open space to strike it with your pick. Each strike costs 1 energy; tougher rock takes more hits.'), h('p.muted.small', 'Ore veins, jewels, geodes, chests, fossils, essence crystals and sigil caches hide in the rock. Break through to the bottom row to descend — deeper layers hold rarer ore. Assign miners to dig for you while you are away.')), buttons: [{ label: 'Dig!', cls: 'gold' }] });
        }
    },
    tap(x, y) {
        const S = G.S;
        const st = peekStage('mine');
        const cell = st.cellAt(x, y);
        if (!cell) return;
        const [r, c] = cell;
        const target = S.mine.grid[r][c];
        if (target.open) return;
        if (target.k === 'bedrock') { sfx('error'); toast('Bedrock — too hard to break. Go around it.'); return; }
        if (!canHit(S, r, c)) { sfx('error'); toast('Reach it from an open space first.'); return; }
        const res = strike(S, r, c);
        if (!res.ok) { sfx('error'); toast(res.reason === 'energy' ? 'Out of pick energy — it refills over time.' : 'Blocked.'); return; }
        sfx(res.broken ? 'crumble' : 'pick');
        const col = target.k === 'ore' ? ORES[target.x].color : CELL[target.k].color;
        st.strikeFx(r, c, res.broken, col);
        if (res.broken) {
            this.loot(st.cellPos(r, c), res.items);
            if (res.special) sfx('reward');
            this.sync();
        } else this.sync();
        changed('mine');
        this.render();
    },
    loot(p, items) {
        const s = toScreen(p, peekStage('mine').camera);
        if (!s || !items) return;
        items.forEach((e, i) => {
            const d = describe(e);
            const el = h('div.loot-pop', { html: `${d.ico || ''}+${num(d.n)} ${d.gear ? d.label : ''}` });
            el.style.left = s.x + 'px'; el.style.top = s.y - i * 26 + 'px';
            el.style.animationDelay = i * 120 + 'ms';
            $('#labels').append(el);
            setTimeout(() => el.remove(), 1500 + i * 120);
        });
    },
    minerPicker() {
        const S = G.S;
        const sel = S.mine.miners.slice();
        const slots = minerSlots(S);
        const cands = S.heroes.filter((x) => !heroBusy(S, x.id) || S.mine.miners.includes(x.id)).sort((a, b) => (b.traits.includes('miner') ? 1 : 0) - (a.traits.includes('miner') ? 1 : 0) || a.star - b.star);
        const grid = h('div.hero-grid');
        const info = h('div.notice');
        const draw = () => {
            grid.innerHTML = '';
            for (const c of cands) grid.append(heroCard(c, { selected: sel.includes(c.id), tag: c.traits.includes('miner') ? 'MINER ×2' : null, onClick: () => { const i = sel.indexOf(c.id); if (i >= 0) sel.splice(i, 1); else if (sel.length < slots) sel.push(c.id); else toast(`Only ${slots} miner slot${slots > 1 ? 's' : ''} — upgrade the Mine.`); draw(); } }));
            const rate = sel.reduce((a, id) => a + minerRate(S, heroById(S, id)), 0);
            info.innerHTML = `${sel.length}/${slots} miners · ~${num(rate)} ore per hour (up to 24h stored)`;
        };
        draw();
        modal({ title: 'Assign Miners', body: h('div', info, h('p.muted.small', 'Miners keep digging while you are away. Heroes with the Miner trait dig twice as fast. Miners can still fight.'), grid), cls: 'wide', buttons: [{ label: 'Save', cls: 'gold', onClick: () => { setMiners(S, sel); changed('mine'); peekStage('mine').setMiners(sel.map((id) => heroById(S, id)).filter(Boolean).map((x) => x.look)); this.render(); } }] });
    },
    tick() { this.render(); },
};
