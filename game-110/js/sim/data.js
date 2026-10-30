// Content tables: hobbies, minions, upgrades, décor, abilities, visitors, schemes, heirlooms, perks, lairs and trophies.
// Pure data (plus a few pure tests on G); the rules that read them are in game.js.
//
// Effects are small records ({ k: kind, ... }) folded together by game.js `mods()`; requirements are records too
// ({ own: [id, n] }, { run: charm }, ...), so the whole store can be listed, tested and saved by id.

export const HOBBIES = [
    { id: 'cook', name: 'Cooking', room: 'Kitchen', icon: '🧁', color: '#ff9ec7', craft: 'Bake', verb: 'baking' },
    { id: 'sew', name: 'Sewing', room: 'Sewing Loft', icon: '🧵', color: '#b48cff', craft: 'Stitch', verb: 'sewing' },
    { id: 'deco', name: 'Decorating', room: 'Great Hall', icon: '🕯️', color: '#ffcf6b', craft: 'Arrange', verb: 'decorating' },
    { id: 'party', name: 'Entertaining', room: 'Ballroom', icon: '🎻', color: '#7fe0d0', craft: 'Host', verb: 'entertaining' },
];
export const HOBBY = Object.fromEntries(HOBBIES.map((h) => [h.id, h]));

// Twelve minions, three per hobby. Cost and charm per second climb together; payback stretches from
// two and a half minutes to a few days, which the upgrades then claw back.
export const MINIONS = [
    { id: 'imp', hobby: 'cook', name: 'Imp Sous-Chef', icon: '😈', cost: 15, cps: 0.1, desc: 'Stirs, tastes, stirs again. Only bites the burnt ones.', tiers: ['Tiny Toques', 'Fireproof Mittens', 'Pitchfork Whisks', 'Union of Small Flames'] },
    { id: 'cauldron', hobby: 'cook', name: 'Bubbling Cauldron', icon: '🍲', cost: 150, cps: 0.8, desc: 'Once for curses. Now strictly for soup.', tiers: ['Copper Bottoms', 'Bottomless Ladles', 'Seven-Spice Brew', 'The Eternal Simmer'] },
    { id: 'golem', hobby: 'cook', name: 'Gingerbread Golem', icon: '🍪', cost: 1800, cps: 6, desc: 'Twelve feet of spiced menace. Smells wonderful.', tiers: ['Royal-Icing Mortar', 'Gumdrop Buttons', 'A Molasses Heart', 'Candy-Cane Cudgels'] },
    { id: 'spider', hobby: 'sew', name: 'Spider Seamstress', icon: '🕷️', cost: 22000, cps: 40, desc: 'Eight hands. Zero dropped stitches.', tiers: ['Silken Spools', 'Eight Thimbles Each', 'Web-Lace Patterns', 'Widow’s Couture'] },
    { id: 'loom', hobby: 'sew', name: 'Haunted Loom', icon: '🧶', cost: 280000, cps: 240, desc: 'Weaves by itself at midnight. And at noon. It just likes weaving.', tiers: ['A Ghostly Shuttle', 'Moonlit Warp Threads', 'Possessed Pedals', 'Tapestry of Whispers'] },
    { id: 'bat', hobby: 'sew', name: 'Bat-Wing Atelier', icon: '🦇', cost: 3.6e6, cps: 1400, desc: 'A boutique run by bats. Velvet capes for any wingspan.', tiers: ['Echolocation Fittings', 'Velvet by the Night', 'Upside-Down Hems', 'Haute Chiroptera'] },
    { id: 'gargoyle', hobby: 'deco', name: 'Gargoyle Florist', icon: '🗿', cost: 4.8e7, cps: 8000, desc: 'Arranges black roses with a stony glare. Very artful.', tiers: ['Thornless Shears', 'Granite Vases', 'Brooding Bouquets', 'Petrified Petals'] },
    { id: 'wraith', hobby: 'deco', name: 'Candle Wraith', icon: '🕯️', cost: 6.5e8, cps: 46000, desc: 'Lights every candle in the keep. The mood: impeccable.', tiers: ['Lavender Wicks', 'Dripping Elegance', 'Ten Thousand Tapers', 'Eternal Ambience'] },
    { id: 'portrait', hobby: 'deco', name: 'Living Portrait', icon: '🖼️', cost: 9e9, cps: 260000, desc: 'Paintings that redecorate the room while you aren’t looking.', tiers: ['Gilded Frames', 'Wandering Eyes', 'Self-Hanging Hooks', 'A Gallery of Glares'] },
    { id: 'skeleton', hobby: 'party', name: 'Skeleton Quartet', icon: '💀', cost: 1.3e11, cps: 1.5e6, desc: 'They only play waltzes. Their bones keep perfect time.', tiers: ['Rosin & Marrow', 'Xylophone Ribs', 'Graveside Encores', 'Danse Macabre'] },
    { id: 'mimic', hobby: 'party', name: 'Mimic Buffet', icon: '🧰', cost: 1.9e12, cps: 8.6e6, desc: 'A treasure chest that is mostly appetisers. Mostly.', tiers: ['Tongue-Shaped Platters', 'Bottomless Bites', 'Gilded Canapés', 'A Feast That Bites Back'] },
    { id: 'lich', hobby: 'party', name: 'Lich Party Planner', icon: '🧙', cost: 2.8e13, cps: 5e7, desc: 'Has planned every party for nine hundred years. Never once been invited.', tiers: ['Phylactery Guest List', 'Undying RSVPs', 'Necro-Napkins', 'The Eternal Soirée'] },
];
export const MINION = Object.fromEntries(MINIONS.map((m, i) => [m.id, { ...m, index: i }]));

// ---------------------------------------------------------------------------------------------------- upgrades
const TIER_AT = [1, 5, 25, 50, 100, 150, 200, 250];
const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function buildUpgrades() {
    const U = [];
    // every minion: doubled at 1, 5, 25, 50, 100 ... owned
    for (const m of MINIONS) {
        TIER_AT.forEach((n, t) => {
            U.push({
                id: `${m.id}${t}`, icon: m.icon, group: 'minion',
                name: m.tiers[t] || `${m.name} ${ROMAN[t]}`,
                desc: `${m.name}s are twice as productive.`,
                cost: m.cost * TIER_COST[t], req: { own: [m.id, n] }, fx: [{ k: 'minion', id: m.id, x: 2 }],
            });
        });
    }
    // hobby mastery: ×1.5 to a whole room
    const HOBBY_UP = {
        cook: ['Grandmother’s Recipe Book', 'Butter. More Butter.', 'Seven-Layer Ambition'],
        sew: ['Pinking Shears of Peril', 'Bias-Cut Brilliance', 'Couture of Doom'],
        deco: ['Feng Shui of Fear', 'An Accent Wall of Shadows', 'Maximalist Gothic'],
        party: ['A Seating Chart of Destiny', 'Signature Cocktail (Bubbling)', 'The Party of the Century'],
    };
    for (const h of HOBBIES) {
        const first = MINIONS.find((m) => m.hobby === h.id);
        [10, 50, 150].forEach((n, t) => U.push({
            id: `h_${h.id}${t}`, icon: h.icon, group: 'hobby', name: HOBBY_UP[h.id][t],
            desc: `All ${h.name.toLowerCase()} is 50% more charming.`,
            cost: first.cost * [400, 4e4, 4e7][t], req: { hobby: [h.id, n] }, fx: [{ k: 'hobby', h: h.id, x: 1.5 }],
        }));
    }
    // synergies between rooms
    const SYN = [
        ['imp', 'spider', 'Cupcakes on Lace Doilies'],
        ['cauldron', 'wraith', 'Candlelit Soup Course'],
        ['golem', 'gargoyle', 'Gingerbread Gargoyles'],
        ['loom', 'skeleton', 'Ballgown Fittings'],
        ['portrait', 'mimic', 'Still Life with Buffet'],
        ['bat', 'lich', 'Bat-Wing Bunting'],
    ];
    for (const [a, b, name] of SYN) {
        const A = MINION[a], B = MINION[b];
        U.push({
            id: `syn_${a}_${b}`, icon: '💞', group: 'synergy', name,
            desc: `${A.name}s +1% for every ${B.name}; ${B.name}s +0.2% for every ${A.name}.`,
            cost: (A.cost + B.cost) * 300, req: { both: [a, b, 15] }, fx: [{ k: 'syn', a, b }],
        });
    }
    // crafting by hand
    const CLICKS = [
        ['Velvet Oven Mitts', 100, { k: 'click', x: 2 }, 'Crafting by hand is twice as charming.'],
        ['A Silver Thimble', 600, { k: 'click', x: 2 }, 'Crafting by hand is twice as charming.'],
        ['Lace Gauntlets', 12000, { k: 'click', x: 2 }, 'Crafting by hand is twice as charming.'],
        ['The Wicked Whisk', 2e5, { k: 'clickPct', x: 0.01 }, 'Each craft also earns 1% of your charm per second.'],
        ['An Embroidered Gauntlet', 2e7, { k: 'clickPct', x: 0.01 }, 'Each craft earns another 1% of your charm per second.'],
        ['A Sequined Scepter', 2e9, { k: 'clickPct', x: 0.01 }, 'Each craft earns another 1% of your charm per second.'],
        ['The Diamond Ladle', 2e11, { k: 'clickPct', x: 0.01 }, 'Each craft earns another 1% of your charm per second.'],
        ['Ladle of the Abyss', 2e13, { k: 'clickPct', x: 0.01 }, 'Each craft earns another 1% of your charm per second.'],
        ['Ladle of Eternity', 2e15, { k: 'clickPct', x: 0.01 }, 'Each craft earns another 1% of your charm per second.'],
    ];
    CLICKS.forEach(([name, cost, fx, desc], i) => U.push({ id: `click${i}`, icon: '🧤', group: 'click', name, desc, cost, req: i < 3 ? { own: ['imp', i ? i * 5 : 1] } : { run: cost * 0.3 }, fx: [fx] }));
    // everything else, gated on charm made this run
    const MISC = [
        ['flow0', '🎵', 'Rhythm of the Whisk', 'Flow crafting bonus is 50% stronger.', 5000, [{ k: 'flowBonus', x: 1.5 }]],
        ['flow1', '🎼', 'Crescendo', 'Flow fades half as fast.', 5e6, [{ k: 'flowDecay', x: 0.5 }]],
        ['dread0', '🌑', 'Ominous Lighting', 'Your reputation fades 20% more slowly.', 3000, [{ k: 'decay', x: 0.8 }]],
        ['dread1', '🔊', 'Echoing Halls', 'Cackles are 50% more dreadful.', 30000, [{ k: 'cackle', x: 1.5 }]],
        ['dread2', '💰', 'A Thunderous Tax Code', 'Tribute is doubled.', 3e5, [{ k: 'tribute', x: 2 }]],
        ['dread3', '🖤', 'Black Lace Everything', 'Each sewing minion adds a whisper of dread (+0.002/s).', 3e6, [{ k: 'emit', h: 'sew', x: 0.002 }], { own: ['spider', 10] }],
        ['dread4', '🦹', 'Dramatic Capes', 'Cackle cooldown is 40% shorter.', 1e7, [{ k: 'cd', ab: 'cackle', x: 0.6 }]],
        ['dread5', '🗿', 'Gargoyle Night Watch', 'Gargoyle Florists glare at passers-by (+0.01 dread/s each).', 5e8, [{ k: 'emit', id: 'gargoyle', x: 0.01 }], { own: ['gargoyle', 10] }],
        ['dread6', '☠️', 'Skull Garnish', 'Each cooking minion adds a hint of menace (+0.0005/s).', 1e9, [{ k: 'emit', h: 'cook', x: 0.0005 }]],
        ['dread7', '😱', 'Fear Itself', 'Feared and Dreaded bonuses are 50% bigger.', 1e10, [{ k: 'tierBoost', x: 1.5 }]],
        ['dread8', '👏', 'Thunderous Applause', 'Entertaining minions roar with dread (+0.02/s each).', 1e13, [{ k: 'emit', h: 'party', x: 0.02 }], { own: ['skeleton', 10] }],
        ['vis0', '🐾', 'Catnip in the Moat', 'Visitors call 15% more often.', 77777, [{ k: 'vFreq', x: 1.15 }]],
        ['vis1', '🚪', 'A Spiked Welcome Mat', 'Visitors linger 50% longer.', 7.7e6, [{ k: 'vLife', x: 1.5 }]],
        ['vis2', '📖', 'The Guest Book of Doom', 'Visitors call 15% more often.', 7.7e8, [{ k: 'vFreq', x: 1.15 }]],
        ['vis3', '🐈‍⬛', 'Lucky Black Cat Statue', 'Cuddle Frenzies last twice as long.', 7.7e10, [{ k: 'kittenDur', x: 2 }]],
        ['ab0', '🥄', 'The Tasting Spoon', 'Unlocks Taste Test: crafting by hand ×10 for 15 seconds.', 2000, [{ k: 'unlock', ab: 'taste' }]],
        ['ab1', '⛈️', 'A Weather Machine', 'Unlocks Thunderstorm: instant maximum dread, and it holds for 45 seconds.', 1.5e5, [{ k: 'unlock', ab: 'storm' }]],
        ['ab2', '💌', 'Engraved Invitations', 'Unlocks Grand Soirée: all charm ×3 for a minute — but the guests see you being lovely.', 5e7, [{ k: 'unlock', ab: 'soiree' }]],
        ['ab3', '🍽️', 'Second Helpings', 'Taste Test cooldown halved.', 5e9, [{ k: 'cd', ab: 'taste', x: 0.5 }]],
        ['off0', '🌙', 'Night-Shift Contracts', 'Minions work +25% harder while you’re away.', 5e5, [{ k: 'offRate', x: 0.25 }]],
        ['off1', '😴', 'Sleepwalking Minions', 'Time away counts for 8 more hours.', 5e7, [{ k: 'offCap', x: 8 * 3600 }]],
        ['off2', '🛌', 'The Dream Kitchen', 'Minions work +25% harder while you’re away.', 5e9, [{ k: 'offRate', x: 0.25 }]],
        ['hench0', '🪪', 'Henchman Union Cards', 'Schemes finish 25% faster.', 1e6, [{ k: 'schemeDur', x: 0.75 }]],
        ['hench1', '🗺️', 'A Very Detailed Map', 'Schemes finish 25% faster.', 1e10, [{ k: 'schemeDur', x: 0.75 }]],
    ];
    for (const [id, icon, name, desc, cost, fx, req] of MISC) U.push({ id, icon, group: 'misc', name, desc, cost, req: req || { run: cost * 0.3 }, fx });
    return U;
}
export const UPGRADES = buildUpgrades();
export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ---------------------------------------------------------------------------------------------------- décor (gold)
// Bought with gold, kept for one lair, and every piece appears in the castle.
export const DECOR = [
    { id: 'banners', room: 'all', icon: '🚩', name: 'Gloom Banners', cost: 25, desc: 'All charm +5%, and a steady +0.02 dread/s.', fx: [{ k: 'all', x: 1.05 }, { k: 'dreadPs', x: 0.02 }] },
    { id: 'roses', room: 'deco', icon: '🥀', name: 'Black-Rose Bouquets', cost: 70, desc: 'Decorating +30%.', fx: [{ k: 'hobby', h: 'deco', x: 1.3 }] },
    { id: 'chandelier', room: 'party', icon: '🦇', name: 'The Bat Chandelier', cost: 160, desc: 'Crafting by hand +25%.', fx: [{ k: 'click', x: 1.25 }] },
    { id: 'organ', room: 'party', icon: '🎹', name: 'A Brooding Pipe Organ', cost: 320, desc: 'Reputation fades 15% slower; Entertaining +20%.', fx: [{ k: 'decay', x: 0.85 }, { k: 'hobby', h: 'party', x: 1.2 }] },
    { id: 'oven', room: 'cook', icon: '🔥', name: 'Cauldron-Shaped Oven', cost: 600, desc: 'Cooking +30%.', fx: [{ k: 'hobby', h: 'cook', x: 1.3 }] },
    { id: 'wheel', room: 'sew', icon: '🎡', name: 'Spinning Wheel of Fate', cost: 1000, desc: 'Sewing +30%.', fx: [{ k: 'hobby', h: 'sew', x: 1.3 }] },
    { id: 'spire', room: 'all', icon: '⚡', name: 'The Thunder Spire', cost: 1600, desc: '+0.06 dread/s, and lightning on demand.', fx: [{ k: 'dreadPs', x: 0.06 }] },
    { id: 'throne', room: 'deco', icon: '👑', name: 'A Velvet Throne', cost: 2500, desc: 'All charm +10%; every ability cools down 15% faster.', fx: [{ k: 'all', x: 1.1 }, { k: 'cd', ab: '*', x: 0.85 }] },
    { id: 'punch', room: 'party', icon: '🍹', name: 'A Fountain of Bubbling Punch', cost: 3800, desc: 'Visitors call 20% more often.', fx: [{ k: 'vFreq', x: 1.2 }] },
    { id: 'mirrorball', room: 'party', icon: '🪩', name: 'The Mirrorball of Doom', cost: 5500, desc: 'Entertaining +40%; all charm +5%.', fx: [{ k: 'hobby', h: 'party', x: 1.4 }, { k: 'all', x: 1.05 }] },
    { id: 'cakestand', room: 'cook', icon: '🎂', name: 'The Grand Cake Display', cost: 8000, desc: 'Cooking +40%.', fx: [{ k: 'hobby', h: 'cook', x: 1.4 }] },
    { id: 'mannequins', room: 'sew', icon: '👗', name: 'A Mannequin Parade', cost: 12000, desc: 'Sewing +40%.', fx: [{ k: 'hobby', h: 'sew', x: 1.4 }] },
];
export const DECOR_BY = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// ---------------------------------------------------------------------------------------------------- abilities
export const ABILITIES = [
    { id: 'cackle', icon: '😈', name: 'Cackle', key: '1', cd: 5, desc: 'An evil laugh that echoes through the kingdom. +dread, and it frightens off any hero at the gate.' },
    { id: 'taste', icon: '🥄', name: 'Taste Test', key: '2', cd: 300, dur: 15, desc: 'Crafting by hand ×10 for 15 seconds.' },
    { id: 'storm', icon: '⛈️', name: 'Thunderstorm', key: '3', cd: 600, dur: 45, desc: 'Dread to the maximum, and it holds for 45 seconds. Gold rains down.' },
    { id: 'soiree', icon: '💃', name: 'Grand Soirée', key: '4', cd: 900, dur: 60, desc: 'All charm ×3 for a minute. Costs 20 dread: the guests see you being lovely.' },
];
export const ABILITY = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

// ---------------------------------------------------------------------------------------------------- visitors
export const VISITORS = [
    { id: 'kitten', name: 'A Lost Kitten', icon: '🐈', weight: 34, desc: 'Cuddle Frenzy: all charm ×7.' },
    { id: 'critic', name: 'A Food Critic', icon: '🧐', weight: 30, desc: 'A rave review: a lump of charm.' },
    { id: 'bard', name: 'A Wandering Bard', icon: '🪕', weight: 16, desc: 'Encore: crafting by hand ×13.' },
    { id: 'hero', name: 'A Hero at the Gate', icon: '🗡️', weight: 20, desc: 'Scare them off (or Cackle) before they see the doilies.' },
];
export const VISITOR_BY = Object.fromEntries(VISITORS.map((v) => [v.id, v]));

// ---------------------------------------------------------------------------------------------------- schemes
// Evil schemes keep up appearances and fetch gold; secret commissions are the Overlord's anonymous craft shop.
export const SCHEMES = [
    { id: 'turnip', kind: 'evil', name: 'Menace the Turnip Festival', need: 1, dur: 45, dread: 18, gold: 5 },
    { id: 'mountain', kind: 'evil', name: 'Rename a Mountain “Mount Doom”', need: 1, dur: 90, dread: 24, gold: 9 },
    { id: 'spoons', kind: 'evil', name: 'Steal Every Spoon in the Kingdom', need: 2, dur: 180, dread: 14, gold: 26 },
    { id: 'bridge', kind: 'evil', name: 'Curse a Bridge (Gently)', need: 2, dur: 240, dread: 45, gold: 8 },
    { id: 'fog', kind: 'evil', name: 'An Ominous Fog Rollout', need: 3, dur: 420, dread: 40, gold: 30 },
    { id: 'tribute', kind: 'evil', name: 'Demand Tribute, Politely', need: 3, dur: 600, dread: 10, gold: 70 },
    { id: 'tower', kind: 'evil', name: 'Raise an Unnecessarily Spooky Tower', need: 4, dur: 900, dread: 60, gold: 55 },
    { id: 'bakesale', kind: 'secret', name: 'An Anonymous Bake Sale', need: 1, dur: 60, charm: 300, heir: 0.03 },
    { id: 'pie', kind: 'secret', name: 'Win the Village Pie Contest (in a Fake Moustache)', need: 2, dur: 300, charm: 1200, gold: 12, heir: 0.07, dread: -4 },
    { id: 'sweaters', kind: 'secret', name: 'Knit Sweaters for the Orphanage', need: 2, dur: 200, charm: 900, heir: 0.06, dread: -3 },
    { id: 'dress', kind: 'secret', name: 'Commission: the Princess’s Wedding Dress', need: 3, dur: 480, charm: 2400, heir: 0.12, dread: -5 },
    { id: 'guild', kind: 'secret', name: 'Redecorate the Heroes’ Guild (Incognito)', need: 3, dur: 600, charm: 3000, heir: 0.12, dread: -6 },
    { id: 'ball', kind: 'secret', name: 'Cater the Royal Ball (Disguised as a Duchess)', need: 4, dur: 900, charm: 5000, gold: 20, heir: 0.2, dread: -10 },
];
export const SCHEME_BY = Object.fromEntries(SCHEMES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------------- heirlooms
// Found on secret commissions; kept forever, through every relocation.
export const HEIRLOOMS = [
    { id: 'pin', icon: '🪵', name: 'Grandmother’s Rolling Pin', desc: 'Cooking +10%.', fx: [{ k: 'hobby', h: 'cook', x: 1.1 }] },
    { id: 'doily', icon: '🕸️', name: 'The First Doily', desc: 'Sewing +10%.', fx: [{ k: 'hobby', h: 'sew', x: 1.1 }] },
    { id: 'candelabra', icon: '🕎', name: 'A Cursed Candelabra', desc: 'Decorating +10%.', fx: [{ k: 'hobby', h: 'deco', x: 1.1 }] },
    { id: 'castanets', icon: '🦴', name: 'Bone Castanets', desc: 'Entertaining +10%.', fx: [{ k: 'hobby', h: 'party', x: 1.1 }] },
    { id: 'crown', icon: '👑', name: 'The Crown of Mild Menace', desc: 'Reputation fades 10% slower.', fx: [{ k: 'decay', x: 0.9 }] },
    { id: 'cape', icon: '🧛', name: 'Cape of Dramatic Exits', desc: 'Cackles +20%.', fx: [{ k: 'cackle', x: 1.2 }] },
    { id: 'locket', icon: '📿', name: 'A Locket with a Kitten in It', desc: 'Visitors call 10% more often.', fx: [{ k: 'vFreq', x: 1.1 }] },
    { id: 'ledger', icon: '📒', name: 'The Ledger of Tributes', desc: 'Tribute +25%.', fx: [{ k: 'tribute', x: 1.25 }] },
    { id: 'thimble', icon: '🪡', name: 'Thimble of Infinite Patience', desc: 'Crafting by hand +20%.', fx: [{ k: 'click', x: 1.2 }] },
    { id: 'spoon', icon: '🥄', name: 'Spoon of the Underworld', desc: 'All charm +5%.', fx: [{ k: 'all', x: 1.05 }] },
    { id: 'hourglass', icon: '⏳', name: 'Hourglass of Long Naps', desc: 'Minions work +10% harder while you’re away.', fx: [{ k: 'offRate', x: 0.1 }] },
    { id: 'mother', icon: '🖼️', name: 'Portrait of Mother', desc: 'All charm +5%. She’d be so proud. Of the evil. Not the doilies.', fx: [{ k: 'all', x: 1.05 }] },
];
export const HEIRLOOM = Object.fromEntries(HEIRLOOMS.map((h) => [h.id, h]));

// ---------------------------------------------------------------------------------------------------- the Grimoire (legend perks)
export const PERKS = [
    { id: 'headstart', icon: '🏁', name: 'Head Start', cost: 1, desc: 'Every new lair starts with 10 Imp Sous-Chefs and 2 Cauldrons.', fx: [] },
    { id: 'repute', icon: '🦹', name: 'An Old Reputation', cost: 1, desc: 'Every lair starts at 80 dread, and dread never falls below 10.', fx: [] },
    { id: 'ladle', icon: '🥄', name: 'The Golden Ladle', cost: 3, desc: 'Each craft also earns 1% of your charm per second.', fx: [{ k: 'clickPct', x: 0.01 }] },
    { id: 'owl', icon: '🦉', name: 'Night Owl', cost: 3, desc: 'Minions work +25% harder while you’re away.', fx: [{ k: 'offRate', x: 0.25 }] },
    { id: 'nap', icon: '🛏️', name: 'The Long Nap', cost: 5, desc: 'Time away counts for 16 more hours.', fx: [{ k: 'offCap', x: 16 * 3600 }] },
    { id: 'whisper', icon: '🐈', name: 'Kitten Whisperer', cost: 5, desc: 'Visitors call 30% more often.', fx: [{ k: 'vFreq', x: 1.3 }] },
    { id: 'linger', icon: '🫖', name: 'Lingering Guests', cost: 10, desc: 'Visitors linger 50% longer.', fx: [{ k: 'vLife', x: 1.5 }] },
    { id: 'scowl', icon: '😠', name: 'The Eternal Scowl', cost: 10, desc: 'Reputation fades 25% slower.', fx: [{ k: 'decay', x: 0.75 }] },
    { id: 'hoard', icon: '💰', name: 'A Hoard of Tribute', cost: 15, desc: 'Tribute ×2, and every lair starts with 50 gold.', fx: [{ k: 'tribute', x: 2 }] },
    { id: 'seasoned', icon: '🎖️', name: 'Seasoned Hobbyist', cost: 25, desc: 'Mastery bonuses are 50% bigger.', fx: [{ k: 'mastery', x: 1.5 }] },
    { id: 'union', icon: '🪪', name: 'The Henchman Union', cost: 40, desc: 'Every lair starts with 3 henchmen.', fx: [] },
    { id: 'bargain', icon: '🏷️', name: 'Bargain Hunter', cost: 60, desc: 'Minions cost 10% less.', fx: [{ k: 'cost', x: 0.9 }] },
    { id: 'eternal', icon: '🌌', name: 'Overlord Eternal', cost: 100, desc: 'All charm +25%.', fx: [{ k: 'all', x: 1.25 }] },
];
export const PERK = Object.fromEntries(PERKS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------------------------------- lairs
// The heroes always storm the castle eventually. By then you've moved somewhere with better light.
export const LAIRS = [
    { id: 'gloom', name: 'Gloomspire Keep', desc: 'A perfectly ordinary haunted castle.', fx: [], bonus: 'No bonus. It has character.' },
    { id: 'cinder', name: 'Cinder Caldera', desc: 'A lair inside a volcano. Wonderful for baking.', fx: [{ k: 'hobby', h: 'cook', x: 1.5 }], bonus: 'Cooking +50%.' },
    { id: 'frost', name: 'Frostfang Spire', desc: 'An ice tower. Everyone needs a sweater.', fx: [{ k: 'hobby', h: 'sew', x: 1.5 }], bonus: 'Sewing +50%.' },
    { id: 'mire', name: 'Mirewood Manor', desc: 'A swamp mansion with endless room for ferns.', fx: [{ k: 'hobby', h: 'deco', x: 1.5 }], bonus: 'Decorating +50%.' },
    { id: 'eclipse', name: 'The Eclipse Citadel', desc: 'A floating fortress. The parties are legendary.', fx: [{ k: 'hobby', h: 'party', x: 1.5 }], bonus: 'Entertaining +50%.' },
];

// ---------------------------------------------------------------------------------------------------- the cemetery
// Gravestones in the castle grounds, each a mini-game. Their progress is kept forever, through every relocation.
// need(G, R) → [have, want] for the unlock; a grave with no game yet is still being dug.
export const GRAVES = [
    { id: 'skull', name: 'Skull Swap', icon: '💀', epitaph: 'Here lies a match made in heaven. Well. Nearby.', desc: 'A match-three of skulls, cupcakes, candles and teacups. Clear levels for charm and gold.',
        needText: 'Employ 25 minions', need: (G, R) => [R.minions, 25] },
    { id: 'soon1', name: 'Not Yet Dug', icon: '🪦', epitaph: 'Reserved for a future amusement.', soon: true },
    { id: 'soon2', name: 'Not Yet Dug', icon: '🪦', epitaph: 'Do not disturb. Not yet.', soon: true },
    { id: 'soon3', name: 'Not Yet Dug', icon: '🪦', epitaph: 'Something is being planned here.', soon: true },
    { id: 'soon4', name: 'Not Yet Dug', icon: '🪦', epitaph: 'The groundskeeper is still digging.', soon: true },
];
export const GRAVE = Object.fromEntries(GRAVES.map((g) => [g.id, g]));
/** Skull Swap pays out a share of charm per second and gold scaled like tribute. */
export const M3_REWARD = { charmSec: [0, 90, 150, 240], gold: 3, goldPerLevel: 0.6 };

// ---------------------------------------------------------------------------------------------------- trophies
// Each one is +1% charm. test(G, R) reads the game state and its derived rates only.
function buildAchievements() {
    const A = [];
    const add = (id, icon, name, desc, test) => A.push({ id, icon, name, desc, test });
    const NAMES = ['A Pinch of Charm', 'Charming', 'Delightful', 'Utterly Adorable', 'Suspiciously Sweet', 'Cosy Beyond Reason', 'A Menace of Manners', 'The Sweetest Evil', 'Doilies Across the Land', 'Charm Incarnate', 'Lovely to the Core', 'The Kingdom Is Smitten'];
    NAMES.forEach((name, i) => { const n = 10 ** (3 + i * 2); add(`charm${i}`, '💗', name, `Make ${n.toExponential(0).replace('e+', 'e')} charm in all.`, (G) => G.charmAll >= n); });
    const CPS = ['Busy Little Bees', 'A Cottage Industry', 'A Well-Run Keep', 'The Kingdom’s Pantry', 'A Charm Engine', 'Unstoppable Hospitality', 'An Empire of Niceness', 'Cosmic Coziness'];
    CPS.forEach((name, i) => { const n = 10 ** (1 + i * 2); add(`cps${i}`, '⚙️', name, `Reach ${n.toExponential(0).replace('e+', 'e')} charm per second.`, (G) => G.stats.bestCps >= n); });
    for (const m of MINIONS) {
        [[1, ''], [50, 'A Crowd of '], [100, 'A Legion of ']].forEach(([n, pre], j) => {
            add(`own_${m.id}${j}`, m.icon, j ? `${pre}${m.name}s` : `Hired: ${m.name}`, `Own ${n} ${m.name}${n > 1 ? 's' : ''}.`, (G) => G.owned[m.id] >= n);
        });
    }
    [[100, 'Busy Hands'], [1000, 'Crafty'], [10000, 'Handmade with Malice'], [50000, 'Calloused Claws']].forEach(([n, name], i) => add(`clicks${i}`, '🧤', name, `Craft ${n} times by hand.`, (G) => G.stats.clicks >= n));
    [[1, 'Mwahaha'], [100, 'A Practised Cackle'], [1000, 'Laughing All the Way'], [5000, 'Throat Lozenges']].forEach(([n, name], i) => add(`cackle${i}`, '😈', name, `Cackle ${n} time${n > 1 ? 's' : ''}.`, (G) => G.stats.cackles >= n));
    [[1, 'Company!'], [25, 'Open House'], [100, 'Hostess with the Mostest'], [400, 'Everyone Drops By']].forEach(([n, name], i) => add(`visit${i}`, '🚪', name, `Greet ${n} visitor${n > 1 ? 's' : ''}.`, (G) => G.stats.visitors >= n));
    [[1, 'Boo!'], [25, 'Hero Repellent'], [100, 'The Guild Is Worried']].forEach(([n, name], i) => add(`hero${i}`, '🗡️', name, `Scare off ${n} hero${n > 1 ? 'es' : ''}.`, (G) => G.stats.heroes >= n));
    add('dreadmax', '☠️', 'Absolutely Terrifying', 'Reach 100 dread.', (G) => G.dread >= 99.99);
    add('suspect', '🫣', 'Caught in an Apron', 'Let your dread fall below 5.', (G) => G.stats.lowDread);
    [[1, 'A Small Errand'], [25, 'Scheming Regularly'], [100, 'Mastermind']].forEach(([n, name], i) => add(`scheme${i}`, '🗺️', name, `Finish ${n} scheme${n > 1 ? 's' : ''}.`, (G) => G.stats.schemes >= n));
    [[1, 'Something Old'], [6, 'Family Treasures'], [12, 'The Whole Attic']].forEach(([n, name], i) => add(`heir${i}`, '📿', name, `Find ${n} heirloom${n > 1 ? 's' : ''}.`, (G) => Object.keys(G.heirlooms).length >= n));
    [[1, 'A Change of Scenery'], [3, 'Serial Relocator'], [5, 'Every Lair in the Brochure'], [10, 'Professional Mover']].forEach(([n, name], i) => add(`move${i}`, '🧳', name, `Relocate ${n} time${n > 1 ? 's' : ''}.`, (G) => G.runs >= n));
    add('decorall', '🏰', 'House Proud', 'Own every piece of décor in one lair.', (G) => DECOR.every((d) => G.decor[d.id]));
    add('hench', '🦹', 'A Full Payroll', `Employ every henchman.`, (G) => G.hench >= 10);
    [[1, 'Grave Matters'], [10, 'Skull Collector'], [25, 'Bone Idol'], [50, 'Rest in Pieces']].forEach(([n, name], i) => add(`m3_${i}`, '💀', name, `Clear level ${n} of Skull Swap.`, (G) => G.yard.m3.best >= n));
    add('m3stars', '⭐', 'Three Little Skulls', 'Clear ten Skull Swap levels with three stars.', (G) => G.yard.m3.three >= 10);
    for (const h of HOBBIES) add(`mast_${h.id}`, h.icon, `${h.name} Virtuoso`, `Reach mastery 10 in ${h.name.toLowerCase()}.`, (G, R) => R.mastery[h.id] >= 10);
    return A;
}
export const ACHIEVEMENTS = buildAchievements();
