// Words for things: card, gadget, souvenir and intent descriptions. Pure, shared by the UI and the view,
// so a card's text is made from the same numbers the rules use and can never disagree with them.

import { CARDS, GADGETS, RELICS, SUITS, rankName } from './data.js';

export function cardName(c) {
    if (c.k === 'plain' && c.r) return `${rankName(c.r)} of ${SUITS[c.s]?.name ?? 'Ray'}s${c.up ? '+' : ''}`;
    return CARDS[c.k].name + (c.up ? '+' : '');
}

export function cardText(c) {
    const d = CARDS[c.k];
    const fx = (c.up ? d.up : d.fx) || {};
    const out = [];
    if (d.wild) out.push('Wild: any card fits on it.');
    if (d.static) out.push('Nothing fits on it. Burns up when covered.');
    if (fx.dmg) out.push(fx.hits > 1 ? `Deal ${fx.dmg} damage ${fx.hits} times.` : `Deal ${fx.dmg} damage.`);
    if (fx.block) out.push(`Gain ${fx.block} block.`);
    if (fx.charge) out.push(`+${fx.charge} charge.`);
    if (fx.heal) out.push(`Heal ${fx.heal}.`);
    if (fx.weak) out.push(`Daze the creature for ${fx.weak} turns.`);
    if (fx.strDown) out.push(`The creature loses ${fx.strDown} strength.`);
    if (fx.reveal) out.push('X-ray the whole table.');
    if (fx.rayBonus) out.push(`Rays and Rockets deal +${fx.rayBonus} this turn.`);
    if (fx.chainBase) out.push(`Your chain jumps by ${fx.chainBase}.`);
    if (fx.selfDmg) out.push(`You take ${fx.selfDmg} damage.${c.temp ? ' Burns up when covered.' : ''}`);
    if (fx.quick) out.push('Quick: gives the draw back.');
    if (!out.length) out.push(c.k === 'plain' ? 'No effect. Just a number to chain from.' : 'No effect.');
    return out.join(' ');
}

/** "7" or "★" or "–": the rank shown on a stock card. */
export function cardRank(c) {
    if (CARDS[c.k].wild) return '★';
    if (CARDS[c.k].static) return '✕';
    if (c.k === 'slime' && !c.r) return '?';
    return rankName(c.r);
}

export function upgradeText(c) {
    const d = CARDS[c.k];
    if (c.up || d.junk) return '';
    return cardText({ ...c, up: true });
}

export function gadgetText(k) { const g = GADGETS[k]; return `${g.name} (${g.cost} charge): ${g.text}`; }
export function relicText(k) { const r = RELICS[k]; return `${r.name}: ${r.text}`; }
export const suitText = (s) => `${SUITS[s].name}: ${SUITS[s].text}.`;

/** The intent badge, worked out by battle.intentInfo. */
export function intentText(it) {
    if (!it) return '';
    switch (it.t) {
        case 'stun': return 'Frozen solid: skips its move';
        case 'atk': return it.hits > 1 ? `Attacks ${it.dmg} × ${it.hits}` : `Attacks for ${it.dmg}`;
        case 'atkblock': return `Attacks for ${it.dmg} and shields ${it.b}`;
        case 'block': return `Shields up: ${it.n} block`;
        case 'buff': return `Grows: +${it.str} strength${it.block ? `, ${it.block} block` : ''}`;
        case 'jam': return `Jams ${it.count} ${it.junk === 'static' ? 'Martian Static' : 'Space Slime'} into your stock${it.dmg ? `, hits for ${it.dmg}` : ''}`;
        case 'freeze': return `Freezes ${it.count} cards${it.dmg ? `, hits for ${it.dmg}` : ''}`;
        case 'drain': return `Drains ${it.dmg} HP`;
        case 'wind': return 'Winding up something big...';
    }
    return '';
}
