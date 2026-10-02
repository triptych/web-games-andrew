// Grimbold's Arms, the Gilded Gauntlet, and the Counting House.
import { R, fmt, clamp } from '../rng.js';
import { h } from '../engine/ui.js';
import * as S from '../engine/state.js';
import { weaponList, armorList, GEAR_COST } from '../data/items.js';
import * as W from '../engine/world.js';

function tradeIn(level) { return level > 0 ? Math.round(GEAR_COST[level - 1] * 0.75) : 0; }

function shop(g, kind) {
    const p = g.p;
    const isW = kind === 'weapon';
    const list = isW ? weaponList(p.dk) : armorList(p.dk);
    const cur = isW ? p.weapon : p.armor;
    const curName = isW ? S.weaponLabel(p) : S.armorLabel(p);
    const ti = tradeIn(cur);
    if (isW) {
        g.title('`QGrimbold\'s Arms', { view: 'weapons', area: 'village' });
        g.text('The heat hits you at the door. `QGrimbold`0, a dwarf with a beard braided into three forks and forearms like anvils, is hammering something orange-hot. Racks of blades, axes and things you can\'t name line the walls, every one of them sharp enough to shave with.');
        g.say('`QGrimbold:', cur ? `That ${curName} of yours? I'll give you \`^${fmt(ti)}\`0 gold for it, against anything on the wall.` : 'Fighting with your FISTS? Gods. Pick something. Anything.');
    } else {
        g.title('`#The Gilded Gauntlet', { view: 'armor', area: 'village' });
        g.text('Polished breastplates gleam on wooden stands, mail hangs from hooks like silver curtains, and the whole shop smells of oil and leather. `#Pell`0, the armourer, a tall woman with a measuring cord around her neck, eyes you critically.');
        g.say('`#Pell:', cur ? `I'll take that ${curName} in trade for \`^${fmt(ti)}\`0. Let's get you into something that'll actually stop a blade.` : 'Rags. You came in here wearing rags. Let me help you.');
    }
    const rows = list.map((it, i) => {
        const lvl = i + 1;
        const net = it.cost - ti;
        const owned = lvl === cur;
        const can = !owned && p.gold >= net;
        const btn = owned ? h('span', { class: 'c7' }, 'Equipped') : g.button(net > 0 ? `Buy (${fmt(net)})` : `Swap (+${fmt(-net)})`, () => {
            if (p.gold < net) return;
            p.gold -= net;
            if (isW) p.weapon = lvl; else p.armor = lvl;
            g.spend(10);
            g.audio?.sfx('buy');
            g.flash(isW ? `\`QGrimbold\`0 takes your old ${curName} and hands you the \`^${it.name}\`0. "Treat it well."` : `\`#Pell\`0 buckles you into the \`^${it.name}\`0 and tugs every strap twice. "There. Now you look like a warrior."`);
            if (lvl >= p.level + 1 || lvl >= 5) g.react('gear', { item: it.name });
        }, can ? 'small primary' : 'small');
        if (!can && !owned) btn.disabled = true;
        return { cls: owned ? 'owned' : (lvl > p.level + 3 ? 'dim' : ''), cells: [`${lvl}`, `${owned ? '`^' : ''}${it.name}`, isW ? `${it.dmg}` : `${it.def}`, `\`6${fmt(it.cost)}`, btn] };
    });
    g.table(['', isW ? 'Weapon' : 'Armour', isW ? 'Damage' : 'Defence', 'Price', ''], rows, 'shop');
    g.note(`You have \`6${fmt(p.gold)}\`0 gold. Trade-in value of your ${curName}: \`6${fmt(ti)}\`0.`);
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

export const weapons = (g) => shop(g, 'weapon');
export const armor = (g) => shop(g, 'armor');

export function bank(g) {
    const p = g.p;
    g.title('`6Quill & Ledger Counting House', { view: 'bank', area: 'village' });
    g.text('Behind a counter of polished oak, on a stool on a box on another stool, sits `6Ezra Quill`0, a gnome in half-moon spectacles who has never once, in two hundred years, made an arithmetical error. Behind him, a vault door the size of a cart is studded with iron. It may have teeth.');
    g.say('`6Ezra Quill:', p.bank >= 0
        ? `Your balance stands at \`^${fmt(p.bank)}\`0 gold. You are carrying \`^${fmt(p.gold)}\`0. Gold in the vault does not die with you, I remind all my clients.`
        : `You owe the house \`$${fmt(-p.bank)}\`0 gold. Interest accrues daily. We are very patient. We are also very, very thorough.`);
    const limit = p.level * 150 + p.dk * 300;
    g.amount({ label: 'Gold:', max: p.gold, buttons: [
        { label: 'Deposit', cls: 'primary', fn: (v) => { v = clamp(v, 0, p.gold); if (!v) return; p.gold -= v; p.bank += v; g.audio?.sfx('coin'); g.flash(`\`6Ezra counts out \`^${fmt(v)}\`6 gold with lightning fingers and notes it in the ledger.`); if (p.bank >= 10000) g.deed('rich'); } },
        { label: 'Deposit all', all: p.gold, fn: (v) => { if (!v) return; p.gold -= v; p.bank += v; g.audio?.sfx('coin'); g.flash(`\`6You deposit everything: \`^${fmt(v)}\`6 gold.`); if (p.bank >= 10000) g.deed('rich'); } },
        { label: 'Withdraw', fn: (v) => { v = clamp(v, 0, Math.max(0, p.bank)); if (!v) return; p.bank -= v; p.gold += v; g.audio?.sfx('coin'); g.flash(`\`6Ezra slides \`^${fmt(v)}\`6 gold across the counter.`); } },
        { label: 'Withdraw all', all: Math.max(0, p.bank), fn: (v) => { if (!v) return; p.bank -= v; p.gold += v; g.audio?.sfx('coin'); g.flash(`\`6You withdraw \`^${fmt(v)}\`6 gold.`); } },
    ] });
    g.heading('Loans');
    g.text(`\`7Ezra will lend up to \`^${fmt(limit)}\`7 gold to a warrior of your standing, at 5% a day.`);
    g.amount({ label: 'Borrow:', buttons: [{ label: 'Borrow', fn: (v) => {
        if (p.bank > 0) { g.flash('`6"You have money in your account. Withdraw that first."'); return; }
        v = clamp(v, 0, Math.max(0, limit + p.bank));
        if (v <= 0) { g.flash('`6"I\'m afraid your credit is exhausted."'); return; }
        p.bank -= v; p.gold += v; g.flash(`\`6Ezra lends you \`^${fmt(v)}\`6 gold, and writes something in red ink.`);
    } }] });
    g.heading('Transfers');
    g.text('`7Send gold to another warrior\'s account. (Up to ' + fmt(p.level * 500 + p.dk * 200) + ' a day.)');
    const sel = h('select', { 'aria-label': 'Recipient' }, g.w.npcs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((n) => h('option', { value: n.id }, `${n.name} (lvl ${n.level})`)));
    g.add(h('div', { class: 'formrow' }, h('label', {}, 'To:'), sel));
    g.amount({ label: 'Gold:', buttons: [{ label: 'Transfer', fn: (v) => {
        const cap = p.level * 500 + p.dk * 200 - (p.flags.transferred || 0);
        v = clamp(v, 0, Math.min(p.gold, cap));
        if (!v) { g.flash('`6"Nothing to transfer, or you\'ve reached today\'s limit."'); return; }
        const n = W.findNpc(g.w, sel.value); if (!n) return;
        p.gold -= v; n.bank += v; p.flags.transferred = (p.flags.transferred || 0) + v;
        g.flash(`\`6Ezra sends \`^${fmt(v)}\`6 gold to ${n.name}'s account.`);
        g.mailLater(R.i(15, 45) * 1000, { from: n.name, fromId: n.id, subject: 'Thank you!', body: n.pers === 'braggart' ? 'huh. thanks i guess. still not going easy on you' : n.pers === 'roleplayer' ? 'Thy generosity shall not be forgotten, friend. My thanks.' : `wow, thanks for the ${fmt(v)} gold! that's really kind of you.` });
    } }] });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}
