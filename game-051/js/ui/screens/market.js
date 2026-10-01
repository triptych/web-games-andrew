/**
 * market.js — the daily rotating shop, token counters, and the Fortune Wheel.
 */

import { h, app, btn, icon, num, toast, modal, showRewards, rewardGrid, heroCard, gearCard, costLine, stars } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { ensureShop, refreshShop, refreshCost, buyOffer, offerHero, COUNTERS, buyCounter, WHEEL, WHEEL_COST, spinWheel, freeSpinAvailable } from '../../sim/shop.js';
import { canAfford } from '../../sim/state.js';
import { msToNextDay } from '../../core/time.js';
import { dur } from '../../core/fmt.js';
import { sfx } from '../../audio.js';
import { describeReward } from './quests.js';

let tab = 'daily';

function drawWheel(canvas) {
    const g = canvas.getContext('2d');
    const W = canvas.width, R = W / 2;
    g.clearRect(0, 0, W, W);
    const n = WHEEL.length;
    g.save(); g.translate(R, R);
    for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 - Math.PI / n, a1 = a0 + (Math.PI * 2) / n;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 8, a0, a1); g.closePath();
        g.fillStyle = WHEEL[i].color; g.fill();
        g.strokeStyle = '#2a1804'; g.lineWidth = 3; g.stroke();
        g.save(); g.rotate((a0 + a1) / 2);
        g.fillStyle = '#1a1030'; g.font = `900 ${Math.round(W / 24)}px Nunito, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(WHEEL[i].label, R - 22, 0);
        g.restore();
    }
    g.beginPath(); g.arc(0, 0, R - 6, 0, Math.PI * 2); g.lineWidth = 10; g.strokeStyle = '#c8901c'; g.stroke();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6), 4, 0, Math.PI * 2); g.fillStyle = i % 2 ? '#fff6d0' : '#ffd24a'; g.fill(); }
    g.beginPath(); g.arc(0, 0, R * 0.14, 0, Math.PI * 2); g.fillStyle = '#c84a4a'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffd24a'; g.stroke();
    g.restore();
}

export const marketScreen = {
    id: 'market',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        if (params.tab) tab = params.tab;
        this.spinning = false;
        this.rot = 0;
        ensureShop(G.S);
        this.render();
    },
    render() {
        const S = G.S, root = this.root;
        root.innerHTML = '';
        const tabs = h('div.tabs', ...[['daily', 'Daily'], ['wheel', 'Wheel'], ['gems', 'Gems'], ['arena', 'Arena'], ['spire', 'Spire'], ['dust', 'Dust']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { if (this.spinning) return; tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        const wrap = h('div.wrap');
        body.append(wrap);
        if (tab === 'daily') this.daily(wrap);
        else if (tab === 'wheel') this.wheel(wrap);
        else this.counter(wrap, tab);
        const bal = { gems: `${icon('gem')}${num(S.res.gems)}`, arena: `${icon('arena')}${num(S.res.arenaTokens)}`, spire: `${icon('spire')}${num(S.res.spireTokens)}`, dust: `${icon('dust')}${num(S.res.dust)}`, daily: `${icon('gold')}${num(S.res.gold)}`, wheel: `${icon('gem')}${num(S.res.gems)}` }[tab];
        root.append(h('div.sheet', h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', 'Market'), h('span.chip', { html: bal })), tabs, body));
    },
    daily(wrap) {
        const S = G.S;
        app(wrap, h('div.row', { style: { marginBottom: '8px' } }, h('div.muted.small.grow', `New stock in ${dur(msToNextDay())}`), btn(`Refresh ${icon('gem')}${refreshCost(S)}`, () => { if (!refreshShop(S)) { sfx('error'); toast('Not enough gems.'); return; } sfx('page'); changed('shop'); this.render(); }, 'ghost small')));
        const grid = h('div.gear-grid');
        S.shop.stock.forEach((o, i) => {
            const card = h('div.card', { style: { opacity: o.sold ? 0.45 : 1 } });
            if (o.kind === 'hero') {
                const hero = offerHero(o);
                app(card, h('div.row', h('div', { style: { width: '80px', flex: 'none' } }, heroCard(hero, { compact: true })), h('div.grow', h('b', `${hero.name}`), h('div.small.muted', `${hero.epithet} · grade ${hero.grade}`), h('div.small', { html: stars(hero.nat) }))));
            } else if (o.kind === 'gear') app(card, gearCard(o.gear, { compact: false }));
            else app(card, h('div.row', h('div.grow', h('b', o.label)), rewardGrid(describeReward(o.give))));
            app(card, h('div', { style: { marginTop: '8px' } }, o.sold ? h('div.chip', 'Sold out') : btn(`Buy · ${costLine(o.price, S)}`, () => {
                const got = buyOffer(S, i);
                if (!got) { sfx('error'); toast('Not enough currency.'); return; }
                sfx('coin'); changed('shop'); showRewards('Purchased', got); this.render();
            }, canAfford(S, o.price) ? 'gold small wide' : 'small wide')));
            grid.append(card);
        });
        wrap.append(grid);
    },
    counter(wrap, which) {
        const S = G.S;
        const notes = { gems: 'Gems come from quests, feats, first clears, Overlord levels and the Treasury.', arena: 'Arena tokens come from Arena battles.', spire: 'Spire tokens come from climbing the Endless Spire.', dust: 'Soul Dust comes from releasing heroes.' };
        app(wrap, h('p.muted.small', notes[which]));
        if (which === 'gems') app(wrap, h('div.notice', { style: { marginBottom: '8px' } }, 'Mystic Sigils for gems are in the Summoning Circle.'));
        COUNTERS[which].forEach((o, i) => {
            app(wrap, h('div.card.row', h('div.grow', h('b', o.label)), btn(costLine(o.price, S), () => {
                const got = buyCounter(S, which, i);
                if (!got) { sfx('error'); toast('Not enough currency.'); return; }
                sfx('coin'); changed('shop'); showRewards('Purchased', got); this.render();
            }, canAfford(S, o.price) ? 'gold small' : 'small')));
        });
    },
    wheel(wrap) {
        const S = G.S;
        const free = freeSpinAvailable(S);
        const cv = h('canvas', { width: 560, height: 560 });
        drawWheel(cv);
        cv.style.transform = `rotate(${this.rot}deg)`;
        const box = h('div.wheel-wrap', h('div.wheel-ptr'), cv);
        app(wrap, h('p.center.muted.small', 'One free spin every day. Extra spins cost gems. The jackpot holds a Legendary Sigil.'), box,
            h('div', { style: { marginTop: '12px' } }, btn(free ? 'Free Spin!' : `Spin · ${icon('gem')}${WHEEL_COST}`, () => this.spin(cv), 'gold wide', { disabled: this.spinning || (!free && S.res.gems < WHEEL_COST) })),
            h('h2.sec', 'Prizes'), h('div.chips', WHEEL.map((w) => h('span.chip', { style: { borderColor: w.color } }, `${w.label} · ${(w.w / WHEEL.reduce((a, b) => a + b.w, 0) * 100).toFixed(1)}%`))));
    },
    spin(cv) {
        if (this.spinning) return;
        const S = G.S;
        const res = spinWheel(S);
        if (!res) { sfx('error'); toast('Not enough gems.'); return; }
        this.spinning = true;
        changed('wheel');
        const n = WHEEL.length;
        const target = 360 * 6 + (360 - (res.index / n) * 360) + (Math.random() - 0.5) * (300 / n);
        this.rot = (Math.floor(this.rot / 360) * 360) + target;
        cv.style.transform = `rotate(${this.rot}deg)`;
        let ticks = 0;
        const tk = setInterval(() => { sfx('spin'); if (++ticks > 28) clearInterval(tk); }, 140);
        setTimeout(() => {
            this.spinning = false;
            sfx(res.index === n - 1 ? 'reveal5' : 'reward');
            showRewards(res.index === n - 1 ? 'JACKPOT!' : WHEEL[res.index].label, res.items);
            this.rot %= 360;
            this.render();
        }, 4400);
    },
    refresh(what) { if (what !== 'tick' && !this.spinning) this.render(); },
};
