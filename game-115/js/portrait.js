// Small face-and-body pictures of people for the lists: a frame of their pixel sprite, scaled up
// and kept as a data URL so the markup stays the same string between refreshes.

import { charStrip, heroLook, villagerLook, heroKey, villagerKey, FW, FH } from './view/chars.js';
import { ITEMS } from './sim/data/items.js';

const cache = new Map();
/** kind 'h' for a hero (or a recruit), 'v' for a villager (or a newcomer). */
export function portrait(p, kind, G) {
    let key, opts;
    if (kind === 'h') {
        const wt = p.equip?.weapon ? ITEMS[p.equip.weapon].tier : 0, at = p.equip?.armor ? ITEMS[p.equip.armor].tier : 0, ct = p.equip?.charm ? ITEMS[p.equip.charm].tier : 0;
        key = heroKey(p, wt, at, ct); opts = () => heroLook(p, wt, at, ct);
    } else { key = villagerKey(p); opts = () => villagerLook(p, p.special); }
    let u = cache.get(key);
    if (u) return u;
    const strip = charStrip(key, opts());
    const c = document.createElement('canvas');
    c.width = FW; c.height = FH;
    c.getContext('2d').drawImage(strip, 0, 0, FW, FH, 0, 0, FW, FH);
    u = c.toDataURL();
    cache.set(key, u);
    return u;
}
