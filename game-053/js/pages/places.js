// Odric's Stables, Madame Zorya's Tent, the Moonlit Gardens, the Standing Stone.
import { R, fmt, clamp } from '../rng.js';
import { h } from '../engine/ui.js';
import * as S from '../engine/state.js';
import { MOUNTS, POTIONS } from '../data/items.js';
import { SPECIALTIES } from '../data/classes.js';
import { FORTUNES } from '../data/text.js';
import { colorize } from '../colors.js';

export function stables(g) {
    const p = g.p;
    const m = S.mount(p);
    g.title('`6Odric\'s Stables', { view: 'stables', area: 'village' });
    g.text('Straw, leather and the warm smell of horses. `6Odric`0, a lanky man with a limp and a voice so soft the animals lean in to hear it, is brushing down a grey mare. Stalls line both sides of the barn, and something in the far one is breathing smoke.');
    const tradeIn = m ? Math.round(m.gold * 0.66) : 0;
    if (m) {
        g.say('`6Odric:', `How's your ${m.name}? Looks well. I'd give you \`^${fmt(tradeIn)}\`0 gold for it in trade, if you're looking to move up.`);
        const feed = 25 * p.level;
        g.nav('Your mount', `Feed your ${m.name} (${fmt(feed)} gold)`, () => {
            if (p.flags.fed) { g.flash('`6"It\'s eaten already. You\'ll make it sick."'); return; }
            if (!m.buff || p.gold < feed) return;
            p.gold -= feed; p.flags.fed = true;
            p.buffs = p.buffs.filter((b) => b.id !== 'mount'); p.buffs.push({ id: 'mount', ...m.buff });
            g.flash(`\`6Your ${m.name} munches happily and looks ready for anything. (\`^${m.buff.name}\`6 renewed)`);
        }, { key: 'f', disabled: !m.buff || p.gold < feed || !!p.flags.fed });
        g.nav('Your mount', `Sell your ${m.name} (${fmt(tradeIn)} gold)`, async () => {
            if (!(await g.ui.confirm('Sell your mount?', `Sell your ${m.name} to Odric for ${fmt(tradeIn)} gold?`, 'Sell'))) return;
            p.gold += tradeIn; p.mount = null; p.buffs = p.buffs.filter((b) => b.id !== 'mount');
            g.flash(`\`6Odric leads your ${m.name} away. You feel a little sad.`);
            return 'stables';
        }, { key: 's' });
    } else g.say('`6Odric:', 'No mount? You\'ll lose half your day just walking to the good part of the forest. Have a look around.');
    const rows = MOUNTS.map((x) => {
        const owned = m && m.id === x.id;
        const netGold = x.gold - tradeIn;
        const can = !owned && p.gold >= netGold && p.gems >= x.gems;
        const b = owned ? h('span', { class: 'c7' }, 'Yours') : g.button(`Buy`, () => {
            if (!can) return;
            p.gold -= netGold; p.gems -= x.gems; p.mount = x.id;
            p.buffs = p.buffs.filter((b) => b.id !== 'mount');
            if (x.buff) p.buffs.push({ id: 'mount', ...x.buff });
            g.deed('mount'); g.audio?.sfx('buy');
            g.flash(`\`6Odric hands you the reins of your new \`^${x.name}\`6. It regards you thoughtfully.`);
            g.react('gear', { item: x.name.toLowerCase() });
        }, can ? 'small primary' : 'small');
        if (!can && !owned) b.disabled = true;
        const perks = [`+${x.turns} forest fight${x.turns === 1 ? '' : 's'}`];
        if (x.buff) perks.push(x.buff.name);
        return { cls: owned ? 'owned' : '', cells: [h('div', {}, h('b', {}, x.name), h('div', { class: 'small c7', text: x.desc })), perks.join(', '), `\`6${fmt(x.gold)}\`0 + \`5${x.gems}💎`, b] };
    });
    g.table(['Mount', 'Perks', 'Price', ''], rows, 'shop');
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

export function gypsy(g) {
    const p = g.p;
    g.title('`5Madame Zorya\'s Tent', { view: 'gypsy', area: 'gypsy' });
    g.text('Inside the striped tent the air is thick with incense. Silk scarves hang from the ceiling, a crystal ball glows on a table draped in velvet, and `5Madame Zorya`0 sits behind it, rings on every finger, eyes like a cat\'s in the candlelight.');
    g.say('`5Madame Zorya:', 'Ah. I wondered when you would come. Sit. The spirits have been talking about you.');
    const seance = 15 * p.level;
    const fortune = 10 * p.level;
    const gemSell = 250 + p.level * 30;
    const gemBuy = 900 + p.level * 60;
    g.nav('The Spirits', `Speak with the dead (${fmt(seance)} gold)`, () => { if (p.gold < seance) return; p.gold -= seance; return 'seance'; }, { key: 's', disabled: p.gold < seance });
    g.nav('The Spirits', `Have your fortune told (${fmt(fortune)} gold)`, () => {
        if (p.gold < fortune) return; p.gold -= fortune;
        g.flash('`5Zorya turns a card, and her voice drops:`0 "' + R.pick(FORTUNES) + '"');
        g.spend(10);
    }, { key: 'f', disabled: p.gold < fortune });
    g.nav('Gems', `Sell a gem (${fmt(gemSell)} gold)`, () => { if (p.gems < 1) return; p.gems--; p.gold += gemSell; g.audio?.sfx('coin'); g.flash(`\`5Zorya holds the gem to the light, smiles, and pays you \`^${fmt(gemSell)}\`5 gold.`); }, { key: 'g', disabled: p.gems < 1 });
    g.nav('Gems', `Buy a gem (${fmt(gemBuy)} gold)`, () => { if (p.gold < gemBuy) return; p.gold -= gemBuy; g.gainGems(1); g.flash('`5Zorya produces a gem from somewhere about her person. You decide not to ask where.'); }, { key: 'b', disabled: p.gold < gemBuy });
    for (const po of POTIONS) {
        g.nav('Potions (gems)', `${po.name} — ${po.gems}💎`, () => {
            if (p.gems < po.gems) return;
            if (po.id === 'forget') return 'lethe';
            p.gems -= po.gems;
            if (po.id === 'charm') p.charm++;
            if (po.id === 'vitality') { p.vitality++; p.hp++; }
            if (po.id === 'heal') p.hp = S.maxHp(p);
            if (po.id === 'vigor') p.turns += 2;
            g.audio?.sfx('magic');
            g.flash(`\`5You drink the ${po.name}. ${po.desc}`);
        }, { tip: po.desc, disabled: p.gems < po.gems || (po.id === 'heal' && p.hp >= S.maxHp(p)) });
    }
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
}

export function seance(g) {
    g.title('`5The Crystal Ball', { view: 'gypsy', area: 'shades' });
    g.text('Zorya passes her hands over the crystal ball. It clouds, then clears, and you see a grey shore under a grey sky, and grey figures wandering. Their voices drift up out of the glass, thin and far away...');
    g.chat('shades', '`7Voices from the Pale Shore', { canPost: false, note: '`7The living cannot speak to the dead. Only listen.' });
    g.nav('Leave', 'Back to Zorya', 'gypsy', { key: 'b' });
}

export function lethe(g) {
    const p = g.p;
    g.title('`5Lethe Water', { view: 'gypsy', area: 'gypsy' });
    g.text('Zorya sets a small vial of perfectly clear water on the velvet. "Drink, and forget who you were taught to be. Choose again." It costs four gems.');
    for (const [id, sp] of Object.entries(SPECIALTIES)) {
        if (id === p.spec) continue;
        g.nav('Become', `${sp.icon} ${sp.name}`, () => {
            if (p.gems < 4) return;
            p.gems -= 4; p.spec = id; p.buffs = p.buffs.filter((b) => !['bones', 'hex', 'wither', 'mend', 'stonefist', 'drain', 'aegis', 'taunt', 'venom', 'vanish'].includes(b.id));
            g.flash(`\`5The world goes white for a heartbeat. When it returns, you know the ways of \`^${sp.name}\`5 as if you had always known them.`);
            return 'gypsy';
        }, { tip: sp.blurb.replace(/`./g, '') });
    }
    g.nav('Leave', 'Changed my mind', 'gypsy', { key: 'b' });
}

export function gardens(g) {
    const p = g.p;
    g.title('`2The Moonlit Gardens', { view: 'gardens', area: 'gardens' });
    g.text('Beyond a gate of wrought-iron roses lie the Moonlit Gardens: winding paths between hedges, beds of silver moonflowers, a willow trailing its branches into a still pond. Couples stroll arm in arm. Someone is reading poetry aloud, badly. The noise of the village seems very far away.');
    g.nav('The Gardens', 'Take a long stroll', () => {
        if (p.flags.garden) { g.flash('`2You\'ve already walked every path today. The roses are starting to recognise you.'); return; }
        p.flags.garden = true; g.spend(30);
        if (R.chance(0.6)) { p.charm++; g.flash('`2The walk does you good. You come back calm, bright-eyed and somehow more attractive. `^+1 charm`2.'); }
        else g.flash('`2A peaceful walk. You feel refreshed, if no more charming than before.');
    }, { key: 't', disabled: !!p.flags.garden });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
    g.chat('garden', '`2Whispers among the roses');
}

export function stone(g) {
    const p = g.p;
    g.title('`7The Standing Stone', { view: 'stone', area: 'village' });
    if (p.dk < 1) {
        g.text('In the corner of the square stands a tall, weathered stone, older than the village itself. Faint runes cover it, too worn to read. You put your hand on it. It is cold and silent. Somehow you get the feeling it is waiting for something — for you to `@do`0 something.');
        g.note('`7(Only those who have slain the Jade Wyrm may hear the Stone.)');
        g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
        return;
    }
    g.text('You lay your palm on the Standing Stone and it `#hums`0. The runes kindle with pale green light, and the square around you fades into mist. You stand in a circle of stones under an endless twilight, and you are not alone: other slayers of the Wyrm sit on the fallen stones, talking quietly.');
    g.text('`7The names of every Wyrmslayer are carved here. Yours glows among them, ' + p.dk + ' time' + (p.dk === 1 ? '' : 's') + ' over.');
    g.nav('The Circle', 'Ask the Stone for its boon', () => {
        if (p.flags.stone) { g.flash('`7The Stone is quiet. It has given you all it will today.'); return; }
        p.flags.stone = true;
        const r = R.i(1, 3);
        if (r === 1) { p.turns++; g.flash('`#The Stone\'s hum fills your bones. `^+1 forest fight`#.'); }
        else if (r === 2) { p.hp = S.maxHp(p); g.flash('`#Green light washes over you. Every wound closes.'); }
        else { g.gainGems(1); g.flash('`#A gem pushes out of the stone like a seed, and drops into your palm.'); }
    }, { key: 'a', disabled: !!p.flags.stone });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
    g.chat('stone', '`7The circle of Wyrmslayers');
}
