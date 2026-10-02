// The Herald, the Hall of Heroes, the Roll of Warriors, the Lodge and the Rookery.
import { R, fmt, clamp } from '../rng.js';
import { h } from '../engine/ui.js';
import { colorize, esc } from '../colors.js';
import * as S from '../engine/state.js';
import * as W from '../engine/world.js';
import { DEEDS } from '../engine/game.js';
import { titleFor } from '../data/classes.js';

const back = (g) => (g.p.alive ? 'village' : 'shades');

export function news(g, day) {
    const w = g.w;
    const d = day ?? w.day;
    g.title('`^The Hollowmere Herald', { view: g.p.alive ? 'notice' : 'shades', area: g.p.alive ? 'village' : 'shades' });
    g.text(`\`7News for day \`^${Math.max(0, d)}\`7 of the realm${d === w.day ? ' (today)' : ''}. The Herald is pinned to the board outside the Crooked Antler, and everyone reads it.`);
    const items = w.news.filter((n) => n.day === d).slice().reverse();
    if (!items.length) g.text('`7Nothing of note has happened. Yet.');
    else g.add(h('ul', { class: 'newslist' }, items.map((n) => h('li', { html: colorize(n.text) }))));
    if (d > Math.max(0, w.day - 30) && w.news.some((n) => n.day < d)) g.nav('The Herald', 'Previous day', () => g.goto('news', d - 1), { key: 'p' });
    if (d < w.day) g.nav('The Herald', 'Next day', () => g.goto('news', d + 1), { key: 'n' });
    if (d !== w.day) g.nav('The Herald', 'Today\'s news', () => g.goto('news', w.day), { key: 't' });
    g.nav('Leave', 'Return', back(g), { key: 'r' });
}

function everyone(g) {
    const p = g.p;
    const me = { id: 'you', name: p.name, color: p.lodge.color || '`%', dk: p.dk, level: p.level, gold: p.gold + p.bank, gems: p.gems, charm: p.charm, pvpWins: p.stats.pvpWins, sex: p.sex, you: true, title: S.title(p) };
    const npcs = g.w.npcs.map((n) => ({ id: n.id, name: n.name, color: n.color, dk: n.dk, level: n.level, gold: n.gold + n.bank, gems: n.gems, charm: n.charm, pvpWins: n.pvpWins, sex: n.sex, title: titleFor(n.dk, n.sex), n }));
    return [me, ...npcs];
}

const HOF = {
    dk: { label: 'Wyrm kills', sort: (a, b) => b.dk - a.dk || b.level - a.level, val: (x) => `${x.dk} kills, level ${x.level}` },
    rich: { label: 'Wealth', sort: (a, b) => b.gold - a.gold, val: (x) => `${fmt(x.gold)} gold` },
    gems: { label: 'Gems', sort: (a, b) => b.gems - a.gems, val: (x) => `${fmt(x.gems)} gems` },
    charm: { label: 'Charm', sort: (a, b) => b.charm - a.charm, val: (x) => `${x.charm} charm` },
    pvp: { label: 'Field victories', sort: (a, b) => b.pvpWins - a.pvpWins, val: (x) => `${x.pvpWins} victories` },
};

export function hof(g, cat = 'dk') {
    const H = HOF[cat] || HOF.dk;
    g.title('`^The Hall of Heroes', { view: g.p.alive ? 'notice' : 'shades', area: g.p.alive ? 'village' : 'shades' });
    g.text('Banners hang from the rafters of the old hall, and the names of the realm\'s greatest are painted in gold on the walls. Ranked by `^' + H.label.toLowerCase() + '`0:');
    const list = everyone(g).sort(H.sort);
    const myRank = list.findIndex((x) => x.you) + 1;
    g.table(['#', 'Warrior', H.label], list.slice(0, 25).map((x, i) => ({ cls: x.you ? 'owned' : '', cells: [String(i + 1), `${x.color}${x.title} ${x.name}${x.you ? ' `7(you)' : ''}`, H.val(x)] })));
    if (myRank > 25) g.note(`\`7You are ranked \`^#${myRank}\`7.`);
    for (const [k, v] of Object.entries(HOF)) g.nav('Rankings', v.label, () => g.goto('hof', k), { disabled: k === cat });
    g.nav('Leave', 'Return', back(g), { key: 'r' });
}

export function list(g) {
    const on = new Set(g.online.map((n) => n.id));
    g.title('`^The Roll of Warriors', { view: 'notice', area: 'village' });
    g.text(`\`7Every warrior registered in Hollowmere: \`^${g.w.npcs.length + 1}\`7 in all, \`@${g.online.length}\`7 online now. Tap a name for their profile.`);
    const all = g.w.npcs.slice().sort((a, b) => (on.has(b.id) - on.has(a.id)) || b.dk - a.dk || b.level - a.level);
    const rows = all.map((n) => [
        h('span', { class: 'dot ' + (on.has(n.id) ? (n.alive ? 'on' : 'dead') : 'off') }),
        h('button', { type: 'button', class: 'linkbtn', html: colorize(`${n.color}${W.npcFull(n)}`), onclick: () => g.showProfile(n) }),
        String(n.level), String(n.dk), S.race({ race: n.race }).name, n.alive ? (on.has(n.id) ? n.loc : n.sleep === 'inn' ? 'inn' : 'fields') : '`4dead',
    ]);
    g.table(['', 'Name', 'Lvl', '★', 'Race', 'Where'], rows, 'roll');
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

const COLORS = [['`%', 'Rose'], ['`#', 'Sky'], ['`@', 'Jade'], ['`^', 'Gold'], ['`Q', 'Amber'], ['`!', 'Azure'], ['`&', 'White'], ['`5', 'Violet'], ['`$', 'Crimson']];

export function lodge(g) {
    const p = g.p;
    g.title('`6The Deedkeeper\'s Lodge', { view: 'lodge', area: 'village' });
    g.text('A long, low hall of dark timber. Trophies cover every wall — antlers, scales, a stuffed goose with a plaque reading `iNEVER FORGET`i. An old scribe with an ink-stained beard keeps the Book of Deeds, and pays in renown for every one recorded there.');
    g.text(`\`6You have \`^${p.renown}\`6 renown to spend.`);
    const earned = DEEDS.filter((d) => p.deeds[d.id]).length;
    g.heading(`Book of Deeds (${earned}/${DEEDS.length})`);
    g.add(h('ul', { class: 'deeds' }, DEEDS.map((d) => h('li', { class: p.deeds[d.id] ? 'got' : '' },
        h('span', { class: 'di' }, p.deeds[d.id] ? '🏆' : '·'), h('b', {}, d.name), ' ', h('small', {}, `${d.desc} (${d.pts})`)))));
    g.heading('Spend renown');
    const turnCost = 60 + p.lodge.turns * 60;
    g.nav('The Lodge', `Permanent extra forest fight (${turnCost} renown)`, () => {
        if (p.renown < turnCost || p.lodge.turns >= 5) return;
        p.renown -= turnCost; p.lodge.turns++; p.turns++;
        g.flash(`\`6The scribe inks a mark beside your name. You will have \`^${p.lodge.turns}\`6 extra forest fight${p.lodge.turns === 1 ? '' : 's'} every day.`);
    }, { key: 'f', disabled: p.renown < turnCost || p.lodge.turns >= 5 });
    const colorRow = h('div', { class: 'btnrow' }, COLORS.map(([c, n]) => g.button(`${c}${n}`, () => {
        if (p.renown < 20) { g.flash('`6Name colours cost 20 renown.'); return; }
        p.renown -= 20; p.lodge.color = c; g.flash(`\`6Your name will now be written in ${c}${n}\`6.`);
    }, 'small' + (p.lodge.color === c ? ' primary' : ''))));
    g.text('`7Name colour (20 renown):');
    g.add(colorRow);
    g.text('`7Custom title, replacing your Wyrm-kill title (40 renown; leave empty to restore it):');
    const inp = h('input', { type: 'text', maxlength: 24, value: p.lodge.title, placeholder: S.title({ ...p, lodge: { ...p.lodge, title: '' } }), 'aria-label': 'Custom title' });
    g.add(h('div', { class: 'formrow' }, inp, g.button('Set title', () => {
        const v = inp.value.replace(/`/g, '').trim();
        if (!v) { p.lodge.title = ''; g.flash('`6Your proper title is restored.'); return; }
        if (p.renown < 40) { g.flash('`6A custom title costs 40 renown.'); return; }
        p.renown -= 40; p.lodge.title = v; g.flash(`\`6You will be known as \`^${v} ${p.name}\`6.`);
    })));
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

// ------------------------------------------------------------- mail
export function mail(g, arg = {}) {
    const p = g.p, w = g.w;
    g.title('`^The Rookery', { view: p.alive ? 'notice' : 'shades', area: p.alive ? 'village' : 'shades', banner: '`^The Rookery' });
    if (arg.read != null) {
        const m = p.mail.find((x) => x.id === arg.read);
        if (!m) return g.goto('mail');
        m.read = true;
        g.add(h('div', { class: 'letter' },
            h('div', { class: 'letter-head' }, h('b', { html: colorize('From: `^' + m.from) }), h('span', {}, ` · day ${m.day}`)),
            h('h3', { class: 'sub', text: m.subject }),
            h('div', { class: 'letter-body', text: m.body })));
        if ((m.gold || m.gems) && !m.claimed) {
            g.nav('Letter', `Take the enclosed ${m.gold ? fmt(m.gold) + ' gold' : ''}${m.gold && m.gems ? ' and ' : ''}${m.gems ? m.gems + ' gem' + (m.gems === 1 ? '' : 's') : ''}`, () => { m.claimed = true; p.gold += m.gold; if (m.gems) g.gainGems(m.gems); g.audio?.sfx('coin'); }, { key: 't', cls: 'primary' });
        }
        if (m.fromId) g.nav('Letter', 'Reply', () => g.goto('mail', { compose: m.fromId, subject: 'Re: ' + m.subject }), { key: 'y' });
        g.nav('Letter', 'Delete', () => { p.mail = p.mail.filter((x) => x !== m); return 'mail'; }, { key: 'd' });
        g.nav('Leave', 'Back to the inbox', () => g.goto('mail'), { key: 'b' });
        return;
    }
    if (arg.compose !== undefined) {
        g.text('`7A raven hops along its perch and cocks its head at you, waiting.');
        const sel = h('select', { 'aria-label': 'To' }, w.npcs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((n) => h('option', { value: n.id, selected: n.id === arg.compose ? true : null }, n.name)));
        sel.prepend(h('option', { value: '__admin', selected: arg.compose === '__admin' ? true : null }, `${w.admin} (petition the Keeper)`));
        if (arg.compose === '__admin') sel.value = '__admin';
        const subj = h('input', { type: 'text', maxlength: 60, value: arg.subject || '', placeholder: 'Subject', 'aria-label': 'Subject' });
        const body = h('textarea', { rows: 6, maxlength: 1000, placeholder: 'Write your letter…', 'aria-label': 'Message' });
        g.add(h('div', { class: 'compose' }, h('div', { class: 'formrow' }, h('label', {}, 'To:'), sel), h('div', { class: 'formrow' }, h('label', {}, 'Subject:'), subj), body,
            h('div', { class: 'btnrow' }, g.button('`^Send the raven', () => {
                const txt = body.value.trim(); if (!txt) { g.flash('`7The raven waits. You haven\'t written anything.'); return; }
                if (sel.value === '__admin') { g.petition(txt); g.flash('`7The raven flies off toward the Keeper\'s tower.'); return 'mail'; }
                const n = W.findNpc(w, sel.value); if (!n) return;
                g.deed('raven');
                g.flash(`\`7The raven takes your letter and flaps away toward ${n.name}.`);
                const replyChance = n.pers === 'lurker' ? 0.4 : 1;
                if (R.chance(replyChance)) g.mailLater(R.i(25, 120) * 1000, { from: n.name, fromId: n.id, subject: 'Re: ' + (subj.value || 'your letter'), body: W.mailReply(n) });
                return 'mail';
            }, 'primary'))));
        g.nav('Leave', 'Back to the inbox', () => g.goto('mail'), { key: 'b' });
        return;
    }
    g.text('Ravens shuffle on their perches in the drafty tower. Each one carries letters between the warriors of Hollowmere — and the occasional reply.');
    if (!p.mail.length) g.text('`7Your pigeonhole is empty.');
    else g.add(h('ul', { class: 'inbox' }, p.mail.map((m) => h('li', { class: m.read ? '' : 'unread' },
        h('button', { type: 'button', class: 'linkbtn', onclick: () => { g.audio?.sfx('click'); g.goto('mail', { read: m.id }); } },
            h('span', { class: 'mfrom', text: m.from }), h('span', { class: 'msub', text: m.subject }), h('small', {}, `day ${m.day}${m.gold || m.gems ? (m.claimed ? '' : ' · 🎁') : ''}`))))));
    g.nav('The Rookery', 'Write a letter', () => g.goto('mail', { compose: null }), { key: 'w' });
    if (p.mail.length) g.nav('The Rookery', 'Delete read letters', () => { p.mail = p.mail.filter((m) => !m.read || ((m.gold || m.gems) && !m.claimed)); }, { key: 'd' });
    g.nav('Leave', 'Return', back(g), { key: 'r' });
}
