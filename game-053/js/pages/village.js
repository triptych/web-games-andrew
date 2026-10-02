// Hollowmere village square: the hub.
import { R, fmt } from '../rng.js';
import * as S from '../engine/state.js';

const SQUARE = [
    'The village square bustles. Carts rattle over the cobbles, a dog barks at a pigeon, and the smell of fresh bread drifts from somewhere. Nobody pays you much attention. Shops and taverns line the streets, a weathered standing stone leans in one corner, and in every direction, beyond the rooftops and the palisade, the dark line of the Gloamwood waits.',
    'Lanterns are being lit along the main street. Folk hurry home with their shopping, a pair of guards argue about dice by the gate, and the old well in the middle of the square creaks as somebody draws water. Beyond the palisade, the Gloamwood is a black wall against the sky.',
    'Hollowmere is quiet at this hour. A cat sleeps on the well\'s edge, a cart of turnips sits unattended, and from the open door of the Crooked Antler comes the sound of laughter and a lute. Past the gate, mist is rising from the forest.',
];

export function village(g) {
    const p = g.p;
    if (!p.alive) return g.goto('shades');
    const clock = g.clockMinutes() % 1440;
    g.title('`@Hollowmere Village Square', { view: 'village', area: 'village' });
    g.text(clock > 1140 || clock < 300 ? SQUARE[2] : clock > 1020 ? SQUARE[1] : SQUARE[0]);
    g.text(`\`7The clock on the Crooked Antler reads \`&${g.clockLabel()}\`7.${p.pacing === 'classic' ? ` The next day dawns in ${fmtDurShort(g.msToDawn())}.` : ''}`);
    if (p.turns <= 0) g.note('`7You have no forest fights left today. When you\'re ready, sleep at the Crooked Antler or in the fields to begin a new day.');
    const unread = p.mail.filter((m) => !m.read).length;
    if (unread) g.note(`\`^You have ${unread} unread letter${unread === 1 ? '' : 's'} waiting at the Rookery.`);
    if (g.w.bounties.you) g.note(`\`$There is a bounty of ${fmt(g.w.bounties.you)} gold on your head. Sleep at the inn.`);

    g.nav('City Gates', 'The Gloamwood', 'forest', { key: 'f' });
    g.nav('City Gates', 'Hunt other warriors', 'pvp', { key: 's', badge: p.pvp });
    g.nav('City Gates', 'The fields (sleep)', 'fields', { key: 'q' });
    g.nav('Market Street', 'The Proving Yard', 'training', { key: 'y' });
    g.nav('Market Street', 'Grimbold\'s Arms', 'weapons', { key: 'w' });
    g.nav('Market Street', 'The Gilded Gauntlet', 'armor', { key: 'a' });
    g.nav('Market Street', 'Quill & Ledger Counting House', 'bank', { key: 'b' });
    g.nav('Market Street', 'Odric\'s Stables', 'stables', { key: 'o' });
    g.nav('Market Street', 'Madame Zorya\'s Tent', 'gypsy', { key: 'z' });
    g.nav('Tavern Street', 'The Crooked Antler', 'inn', { key: 'i' });
    g.nav('Tavern Street', 'The Moonlit Gardens', 'gardens', { key: 'd' });
    g.nav('Tavern Street', 'The Standing Stone', 'stone', { key: 'k' });
    g.nav('Tavern Street', 'Guildhall Row', 'guilds', { key: 'u' });
    g.nav('Tavern Street', 'The Deedkeeper\'s Lodge', 'lodge', { key: 'l' });
    g.nav('Information', 'The Hollowmere Herald', 'news', { key: 'n' });
    g.nav('Information', 'Hall of Heroes', 'hof', { key: 'h' });
    g.nav('Information', 'Roll of Warriors', 'list', { key: 'r' });
    g.nav('Information', 'The Rookery (mail)', 'mail', { key: 'm', badge: unread || null });
    g.nav('Other', 'Preferences & saves', 'prefs', { key: 'p' });
    g.nav('Other', 'Help & FAQ', 'help', { key: '?' });
    g.chat('village', '`@Village Square — the townsfolk chatter');
}

function fmtDurShort(ms) { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
