// The town's windows: the Descent, the three shops, the Inn, the Church, the Tavern and the Guild.

import { calc, CLASSES, itemScore, canEquip, slotFor } from '../sim/party.js';
import {
    shopStock, buyPrice, sellPrice, disc, BIZ, BIZ_IDS, investCost, income, discount, pendCap, totalPending, totalIncome, roomCost, recruitCost,
    churchPrice, cursedGear, MEALS, mealPrice, rechargeCost,
} from '../sim/town.js';
import { checkpoints } from '../sim/world.js';
import { progress, isReady } from '../sim/quests.js';
import { RUMORS } from '../sim/names.js';
import { IDLE_SECONDS_PER_DAY, MAX_PARTY } from '../config.js';
import { describe } from '../sim/items.js';
import { TRAITS } from '../sim/party.js';
import { CHAPTERS, chapter, storyProgress, storyReady } from '../sim/story.js';

export function townScreens(K) {
    const { h, row, portrait, icon, itemName, itemStats, bar, money, tabs } = K;
    const close = (ui) => h('button', { class: 'btn primary', onclick: () => ui.close() }, 'Leave');
    const perk = (G, id) => {
        const d = disc(G, id);
        return h('div', { class: 'perk' }, h('span', null, `You own level ${G.biz[id].lvl} of this business`), d > 0 ? h('span', { class: 'c10' }, ` · −${Math.round(d * 100)}% prices`) : h('span', { class: 'dim' }, ' · invest at the Guild for discounts'));
    };

    // best upgrade for anyone in the party, for the ▲ marker in the smithy
    const upgradeFor = (G, it) => {
        let best = null;
        for (const [i, m] of G.party.entries()) {
            if (!['w', 'a', 'c'].includes(it.t) || !canEquip(m, it).ok) continue;
            const sl = it.t === 'c' ? (m.eq.acc1 ? (m.eq.acc2 ? 'acc1' : 'acc2') : 'acc1') : slotFor(m, it);
            const gain = itemScore(it) - itemScore(m.eq[sl]);
            if (gain > 0 && (!best || gain > best.gain)) best = { i, gain, m };
        }
        return best;
    };

    function shop(id, title) {
        return (ui, G, p) => {
            const tab = p.tab || 'buy';
            const stock = shopStock(G, id);
            const buyTab = h('div', { class: 'list' }, stock.map((it) => {
                const price = buyPrice(G, id, it);
                const up = upgradeFor(G, it);
                const stack = it.sig != null;
                return h('div', { class: 'shoprow' },
                    row({
                        ic: icon(it), label: [itemName(it), up ? h('span', { class: 'up' }, ` ▲ ${up.m.name}`) : ''],
                        sub: it.t === 'p' || it.t === 's' || it.t === 'm' || it.t === 't' ? describe(it).join(' ') : itemStats(it), right: money(price),
                        disabled: G.gold < price, onClick: () => ui.do({ t: 'buy', shop: id, sid: it.sid, qty: 1 }),
                    }),
                    stack ? h('button', { class: 'btn small x5', disabled: G.gold < price * 5, onclick: () => ui.do({ t: 'buy', shop: id, sid: it.sid, qty: 5 }) }, '×5') : null);
            }));
            const sellList = G.inv.map((it) => h('div', { class: 'shoprow' },
                row({ ic: icon(it), label: itemName(it), sub: it.t === 'm' ? `${it.charges}/${it.max} charges` : itemStats(it), right: money(sellPrice(G, it)), onClick: () => ui.do({ t: 'sell', id: it.id, qty: 1 }) }),
                it.n > 1 ? h('button', { class: 'btn small x5', onclick: () => ui.do({ t: 'sell', id: it.id, qty: it.n }) }, 'all') : null));
            const wands = G.inv.filter((x) => x.t === 'm' && x.charges < x.max);
            const body = h('div', null, perk(G, id), tabs([['buy', 'Buy'], ['sell', 'Sell']], tab, (t) => { p.tab = t; ui.render(ui.top()); }),
                tab === 'buy' ? [buyTab, id === 'magic' && wands.length ? h('div', null, h('h3', null, 'Recharge'), h('div', { class: 'list' }, wands.map((w) => row({ ic: icon(w), label: itemName(w), sub: `${w.charges}/${w.max}`, right: money(rechargeCost(G, w)), disabled: G.gold < rechargeCost(G, w), onClick: () => ui.do({ t: 'recharge', id: w.id }) })))) : null]
                    : [h('div', { class: 'list' }, sellList.length ? sellList : h('div', { class: 'dim pad' }, 'Your bag is empty.')),
                        h('div', { class: 'cmdrow' }, h('button', { class: 'btn', onclick: () => ui.do({ t: 'sellJunk' }) }, 'Sell all finds'))]);
            return { title, wide: true, body: h('div', null, h('div', { class: 'gline' }, 'Gold ', money(G.gold)), body), foot: [close(ui)] };
        };
    }

    function gate(ui, G) {
        const cps = checkpoints(G);
        return {
            title: 'The Descent',
            body: h('div', null,
                h('p', null, `Deepest floor reached: B${G.maxDepth}F. Guardians defeated up to B${G.cleared}F.`),
                h('p', { class: 'dim' }, 'Every fifth floor holds a guardian. Defeat one and the floor below becomes a place you can start from.'),
                h('div', { class: 'list' }, cps.map((d) => row({
                    label: d === 1 ? 'B1F - The Old Dungeon' : `B${d}F - below the guardian of B${d - 1}F`, sub: `Party level ${Math.round(G.party.reduce((a, m) => a + m.lvl, 0) / G.party.length)}`, right: 'Enter',
                    onClick: () => { ui.do({ t: 'enter', depth: d }); ui.closeAll(); },
                }))),
                G.party.some((m) => m.hp < calc(m).maxhp * 0.5) ? h('p', { class: 'c12' }, 'Some of your party are badly hurt. The Inn is across the square.') : null),
            foot: [close(ui)],
        };
    }

    function inn(ui, G, p) {
        const cost = roomCost(G);
        const full = G.party.length >= MAX_PARTY;
        return {
            title: 'The Inn', wide: true,
            body: h('div', null, perk(G, 'inn'), h('div', { class: 'gline' }, 'Gold ', money(G.gold)),
                h('h3', null, 'A bed for the night'),
                h('p', { class: 'dim' }, 'Restores HP, MP and ailments (not curses or the fallen), and a day passes: your businesses pay out and the shops restock.'),
                h('button', { class: 'btn primary', disabled: G.gold < cost, onclick: () => ui.do({ t: 'rest' }) }, 'Rest — ', money(cost)),
                h('h3', null, `Adventurers for hire (${G.party.length}/${MAX_PARTY} in your party)`),
                h('div', { class: 'list' }, G.town.recruits.length ? G.town.recruits.map((r, i) => {
                    const c = recruitCost(G, r), tr = r.trait ? TRAITS[r.trait] : null;
                    return row({
                        ic: portrait(r, 40), label: [h('b', { class: `c${CLASSES[r.cls].col}` }, r.name), ` the ${CLASSES[r.cls].name}, level ${r.lvl}`],
                        sub: [tr ? `${tr.name}: ${tr.desc}` : 'No special trait', h('div', { class: 'small dim' }, r.eq.weapon ? `Wields ${r.eq.weapon.name}` : '')], right: money(c), disabled: full || G.gold < c, onClick: () => ui.do({ t: 'recruit', idx: i }),
                    });
                }) : h('div', { class: 'dim pad' }, 'Nobody is looking for work today. Come back tomorrow.')),
                h('h3', null, 'Send someone home'),
                h('div', { class: 'list' }, G.party.map((m, i) => row({ ic: portrait(m, 28), label: m.name, sub: `${CLASSES[m.cls].name} level ${m.lvl}`, right: 'Dismiss', disabled: G.party.length <= 1, onClick: () => ui.open('confirm', { text: `Send ${m.name} away? Their gear goes back in your bag.`, yes: () => ui.do({ t: 'dismiss', idx: i }) }) })))),
            foot: [close(ui)],
        };
    }

    function church(ui, G) {
        const rows = G.party.map((m, i) => {
            const s = calc(m), gear = cursedGear(m);
            const btns = [];
            if (m.hp <= 0) btns.push(h('button', { class: 'btn small', disabled: G.gold < churchPrice(G, 'revive', m), onclick: () => ui.do({ t: 'church', svc: 'revive', who: i }) }, 'Revive ', money(churchPrice(G, 'revive', m))));
            if (m.hp > 0 && (m.st.poison || m.st.sleep || m.st.stun)) btns.push(h('button', { class: 'btn small', disabled: G.gold < churchPrice(G, 'cure', m), onclick: () => ui.do({ t: 'church', svc: 'cure', who: i }) }, 'Cure ', money(churchPrice(G, 'cure', m))));
            if (m.st.curse || gear.length) btns.push(h('button', { class: 'btn small primary', disabled: G.gold < churchPrice(G, 'curse', m), onclick: () => ui.do({ t: 'church', svc: 'curse', who: i }) }, 'Lift curse ', money(churchPrice(G, 'curse', m))));
            if (m.hp > 0 && (m.hp < s.maxhp || m.mp < s.maxmp)) btns.push(h('button', { class: 'btn small', disabled: G.gold < churchPrice(G, 'heal', m), onclick: () => ui.do({ t: 'church', svc: 'heal', who: i }) }, 'Restore ', money(churchPrice(G, 'heal', m))));
            return h('div', { class: 'crow' }, h('div', { class: 'cinfo' }, portrait(m, 32), h('div', null, h('b', null, m.name), h('div', { class: 'small' }, m.hp <= 0 ? h('span', { class: 'c12' }, 'Fallen') : `${m.hp}/${s.maxhp} HP`, Object.keys(m.st).length ? h('span', { class: 'c5' }, '  ' + Object.keys(m.st).join(', ')) : '', gear.length ? h('span', { class: 'c12' }, `  cursed: ${gear.map((g) => g.name).join(', ')}`) : ''))),
                h('div', { class: 'cbtns' }, btns.length ? btns : h('span', { class: 'dim small' }, 'Fine.')));
        });
        return {
            title: 'Church of the Lantern', wide: true,
            body: h('div', null, perk(G, 'church'), h('div', { class: 'gline' }, 'Gold ', money(G.gold)),
                h('p', { class: 'dim' }, 'The priests will raise the fallen, cure the sick and lift curses, from people and from the things they carry.'),
                rows,
                h('h3', null, 'A blessing'),
                h('button', { class: 'btn', disabled: G.gold < churchPrice(G, 'bless'), onclick: () => ui.do({ t: 'church', svc: 'bless', who: 0 }) }, '+20% gold from battles for ten fights  ', money(churchPrice(G, 'bless')))),
            foot: [close(ui)],
        };
    }

    function tavern(ui, G, p) {
        return {
            title: 'Hearth & Hound Tavern',
            body: h('div', null, perk(G, 'tavern'), h('div', { class: 'gline' }, 'Gold ', money(G.gold)),
                h('div', { class: 'list' }, Object.keys(MEALS).map((id) => row({ label: MEALS[id].name, sub: MEALS[id].desc, right: money(mealPrice(G, id)), disabled: G.gold < mealPrice(G, id), onClick: () => ui.do({ t: 'eat', meal: id }) }))),
                G.feast ? h('p', { class: 'c10' }, `Well fed: +15% attack and defence for ${G.feast.left} more battles.`) : null,
                h('h3', null, 'Overheard'),
                h('p', { class: 'rumor' }, `"${RUMORS[(G.day * 7 + G.seed) % RUMORS.length]}"`)),
            foot: [close(ui)],
        };
    }

    function guild(ui, G, p) {
        const tab = p.tab || 'quests';
        const pend = totalPending(G);
        let content;
        if (tab === 'story') {
            const S = G.story, c = chapter(G), [a, b] = storyProgress(G);
            const done = CHAPTERS.slice(0, S.ch);
            content = h('div', null,
                h('p', { class: 'dim' }, 'Optional. The Chronicler tells the tale of the Lantern, one chapter at a time. Each one asks for something the dungeon already holds, and pays for it.'),
                !S.on ? h('div', { class: 'chapter cur' }, h('h3', null, 'The Chronicler'), h('p', null, 'An old woman with ink to the elbows looks up from a ledger. "You are the ones who go down," she says. "Sit. I have a story, and no one left to tell it to."'), h('button', { class: 'btn primary', onclick: () => ui.do({ t: 'storyStart' }) }, 'Hear the tale')) : null,
                S.on ? done.map((d, i) => h('div', { class: 'chapter' }, h('h3', null, `${i + 1}. ${d.title}`), h('p', { class: 'dim small' }, d.outro))) : null,
                S.on && c ? h('div', { class: 'chapter cur' }, h('h3', null, `${S.ch + 1}. ${c.title}`), h('p', null, c.intro),
                    h('p', { class: 'c14' }, c.obj.text), bar(a / b, a >= b ? 10 : 11, 'tiny'), h('div', { class: 'small dim' }, `${a}/${b}`),
                    h('button', { class: 'btn primary', disabled: !storyReady(G), onclick: () => ui.do({ t: 'storyClaim' }) }, storyReady(G) ? 'Tell her what you found' : 'Not yet')) : null,
                S.done ? h('div', { class: 'chapter cur' }, h('h3', null, 'The tale is told'), h('p', null, 'The Chronicler closes her book and, for the first time, smiles. The dungeon, naturally, goes on.')) : null);
        } else if (tab === 'quests') {
            const active = G.quests.active, board = G.quests.board;
            content = h('div', null,
                h('h3', null, `Your quests (${active.length}/5)`),
                h('div', { class: 'list' }, active.length ? active.map((q) => { const [a, b] = progress(G, q); const ok = isReady(G, q); return h('div', { class: 'shoprow' }, row({ label: [q.title, ok ? h('span', { class: 'c10' }, '  READY') : ''], sub: [q.desc, bar(a / b, ok ? 10 : 11, 'tiny')], right: ok ? 'Hand in' : `${a}/${b}`, disabled: !ok, onClick: () => ui.do({ t: 'turnin', id: q.id }) }), h('button', { class: 'btn small x5', onclick: () => ui.do({ t: 'abandon', id: q.id }) }, '✕')); }) : h('div', { class: 'dim pad' }, 'None yet. Pick something below.')),
                h('h3', null, 'Today\'s board'),
                h('div', { class: 'list' }, board.length ? board.map((q) => row({ label: q.title, sub: q.desc, right: [money(Math.round(q.gold * (1 + G.guildBonus))), ` +${q.xp}xp`], disabled: active.length >= 5, onClick: () => ui.do({ t: 'accept', id: q.id }) })) : h('div', { class: 'dim pad' }, 'The board is bare. Come back tomorrow.')));
        } else {
            const next = Math.max(0, Math.ceil(IDLE_SECONDS_PER_DAY - G.idleAcc));
            content = h('div', null,
                h('p', { class: 'dim' }, 'Buy a stake in the town. Every business pays you daily, even while you are away, and gives you a discount where it matters. Upgrades cost more each time and pay back more.'),
                h('div', { class: 'ledger' }, h('div', null, 'Income per day ', money(totalIncome(G))), h('div', null, 'Waiting to collect ', money(pend)),
                    h('div', { class: 'dim small' }, `Next day in ${next}s while you play (or when you rest or explore).`),
                    h('button', { class: 'btn primary', disabled: pend <= 0, onclick: () => ui.do({ t: 'collect' }) }, `Collect ${pend}g`)),
                h('div', { class: 'list' }, BIZ_IDS.map((id) => {
                    const b = G.biz[id], B = BIZ[id], cost = investCost(G, id);
                    const d0 = discount(b.lvl), d1 = discount(b.lvl + 1);
                    return h('div', { class: 'biz' },
                        h('div', { class: 'bname' }, h('b', null, B.name), h('span', { class: 'lvl' }, ` Lv ${b.lvl}`)),
                        h('div', { class: 'small' }, b.lvl ? `${income(G, id).toLocaleString('en-US')}g/day` : '', b.lvl ? ` → ${income(G, id, b.lvl + 1).toLocaleString('en-US')}g · cap ${pendCap(G, id).toLocaleString('en-US')}g` : `Pays ${income(G, id, 1).toLocaleString('en-US')}g a day once you own it`),
                        h('div', { class: 'small' }, `${B.perk}: −${Math.round(d0 * 100)}%`, h('span', { class: 'c10' }, ` → −${Math.round(d1 * 100)}%`)),
                        b.pend ? bar(b.pend / Math.max(1, pendCap(G, id)), 14, 'tiny') : null,
                        h('button', { class: 'btn small', disabled: G.gold < cost, onclick: () => ui.do({ t: 'invest', biz: id }) }, b.lvl ? 'Upgrade ' : 'Buy ', money(cost)));
                })));
        }
        return {
            title: "Adventurers' Guild", wide: true,
            body: h('div', null, h('div', { class: 'gline' }, 'Gold ', money(G.gold)), tabs([['quests', 'Quests'], ['story', 'Story', storyReady(G) ? '!' : ''], ['invest', 'Investments', pend > 0 ? `+${pend}g` : '']], tab, (t) => { p.tab = t; ui.render(ui.top()); }), content),
            foot: [close(ui)],
        };
    }

    return { gate, items: shop('items', 'Item Shop'), smith: shop('smith', 'Weaponsmith'), magic: shop('magic', 'Magic Emporium'), inn, church, tavern, guild };
}
