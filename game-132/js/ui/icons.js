// Icons cut from the fal 4×4 sheets in art/ (see dev/art/README.md) with CSS background-position.
// Every icon has a stand-in: if a sheet fails to load the button still shows its colour and a glyph.

import { SKILLS, MASTERIES } from '../sim/data/masteries.js';
import { BASES, LEGENDARIES, SETS, GEMS } from '../sim/data/items.js';

/** CSS for cell i (0..15) of a sheet. */
export function cell(sheet, i) {
    const c = i % 4, r = Math.floor(i / 4);
    return `background-image:url(art/icons-${sheet}.webp);background-position:${c * 33.3333}% ${r * 33.3333}%`;
}

export function skillIcon(id) {
    const i = SKILLS[id].icon;
    return i < 16 ? cell('skills-a', i) : cell('skills-b', i - 16);
}
export const masteryIcon = (m) => cell('skills-b', 5 + Object.keys(MASTERIES).indexOf(m));
export const EXTRA = {
    potion: cell('skills-b', 8), portal: cell('skills-b', 9), howl: cell('skills-b', 10), petTown: cell('skills-b', 11),
    mend: cell('skills-b', 12), gold: cell('skills-b', 13), scroll: cell('skills-b', 14), bag: cell('skills-b', 15),
    hybrid: (k) => cell('sets', 4 + ['galvanic', 'bloodpact', 'voidcurrent'].indexOf(k)),
};

export function itemIcon(it) {
    if (!it) return '';
    if (it.gem) return cell('items', GEMS[it.gem].icon);
    if (it.uniq) return cell('legendary', LEGENDARIES[it.uniq].icon);
    if (it.set) return it.set === 'asters' ? cell('legendary', SETS.asters.icons[it.setIdx]) : cell('sets', it.setIdx);
    return cell('items', BASES[it.base].icon);
}
