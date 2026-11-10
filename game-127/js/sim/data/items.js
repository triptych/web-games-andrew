// The market. Gifts are given to friends on the Free Day; tonics are used at once; keepsakes are kept and make
// one kind of lesson or job a little better. `icon` is the emoji shown in the shop (no image files needed).

export const ITEMS = [
    // gifts
    { id: 'sweets', name: 'Honey Sweets', kind: 'gift', price: 15, icon: '🍯', desc: 'Sticky, golden, beloved by children and dragons.' },
    { id: 'pie', name: 'Mutton Pie', kind: 'gift', price: 12, icon: '🥧', desc: 'Hot from the Thistle & Crumb. Practical food.' },
    { id: 'tea', name: 'Qasiri Tea', kind: 'gift', price: 25, icon: '🍵', desc: 'Smoky, fragrant, imported at great expense.' },
    { id: 'book', name: 'Leather-bound Book', kind: 'gift', price: 40, icon: '📕', desc: 'Poems, histories or adventures. Always welcome on the right shelf.' },
    { id: 'ribbon', name: 'Silk Ribbon', kind: 'gift', price: 20, icon: '🎀', desc: 'Bright and cheerful.' },
    { id: 'silk', name: 'Bolt of Moonsilk', kind: 'gift', price: 70, icon: '🧵', desc: 'Shimmers like water at night.' },
    { id: 'perfume', name: 'Rose Perfume', kind: 'gift', price: 45, icon: '🌹', desc: 'Very fashionable at court. Divisive elsewhere.' },
    { id: 'dice', name: 'Bone Dice', kind: 'gift', price: 10, icon: '🎲', desc: 'Almost certainly not loaded.' },
    { id: 'whetstone', name: 'Dwarven Whetstone', kind: 'gift', price: 35, icon: '🪨', desc: 'For a blade that never dulls.' },
    { id: 'lockpicks', name: 'Fine Lockpicks', kind: 'gift', price: 50, icon: '🗝️', desc: '"For locksmithing." Of course.' },
    { id: 'starchart', name: 'Star Chart', kind: 'gift', price: 55, icon: '🌌', desc: 'Every constellation, including the Dragon.' },
    { id: 'crystal', name: 'Singing Crystal', kind: 'gift', price: 60, icon: '💎', desc: 'Hums when the wind blows across it.' },
    { id: 'musicbox', name: 'Music Box', kind: 'gift', price: 80, icon: '🎶', desc: 'Plays a lullaby from across the sea.' },
    { id: 'frog', name: 'A Frog in a Jar', kind: 'gift', price: 3, icon: '🐸', desc: 'It is a very good frog.' },
    { id: 'rapier', name: 'Engraved Rapier', kind: 'gift', price: 140, icon: '🤺', desc: 'Balanced, beautiful, deadly.' },
    { id: 'hawkfeather', name: 'Silver Hawk Feather', kind: 'gift', price: 90, icon: '🪶', desc: 'A jeweller\'s piece. Matches a certain hair clip.' },

    // used at once
    { id: 'calm', name: 'Chamomile Draught', kind: 'tonic', price: 40, icon: '🫖', fx: { sts: -15 }, desc: 'Removes 15 Stress.' },
    { id: 'tonic', name: 'Healer\'s Tonic', kind: 'tonic', price: 60, icon: '🧪', fx: { vit: 2, sts: -5 }, desc: '+2 Vitality, -5 Stress.' },
    { id: 'emberwine', name: 'Emberwine', kind: 'tonic', price: 75, icon: '🍷', fx: { drc: 3, sts: -8 }, desc: 'Dragon-pepper cordial. +3 Draconity, -8 Stress.', minAge: 14 },
    { id: 'novel', name: 'Penny Novel', kind: 'tonic', price: 20, icon: '📗', fx: { art: 1, sts: -6 }, desc: '+1 Artistry, -6 Stress.' },

    // keepsakes: +20% gains in the named activities
    { id: 'k_sword', name: 'Steel Practice Sword', kind: 'keepsake', price: 220, icon: '🗡️', boosts: ['sword', 'watch'], desc: 'Swordsmanship and Night Watch improve 20%.' },
    { id: 'k_staff', name: 'Apprentice Staff', kind: 'keepsake', price: 260, icon: '🪄', boosts: ['arcane'], desc: 'Arcane Studies improve 20%.' },
    { id: 'k_lute', name: 'Rosewood Lute', kind: 'keepsake', price: 200, icon: '🪕', boosts: ['music', 'stage'], desc: 'Music & Theatre improve 20%.' },
    { id: 'k_ledger', name: 'Gilded Ledger', kind: 'keepsake', price: 200, icon: '📒', boosts: ['commerce', 'stall'], desc: 'Ledgers & Trade improve 20%.' },
    { id: 'k_gown', name: 'Court Attire', kind: 'keepsake', price: 280, icon: '👑', boosts: ['etiquette', 'rhetoric'], desc: 'Etiquette and Rhetoric improve 20%.' },
    { id: 'k_prayer', name: 'Ember Rosary', kind: 'keepsake', price: 120, icon: '📿', boosts: ['theology', 'chores'], desc: 'Temple lessons and chores improve 20%.' },
    { id: 'k_cloak', name: 'Shadowsilk Cloak', kind: 'keepsake', price: 300, icon: '🦇', boosts: ['shadow', 'cards'], desc: 'Shadow Arts and the card den improve 20%.', minAge: 14 },
    { id: 'k_spectacles', name: 'Scholar\'s Spectacles', kind: 'keepsake', price: 160, icon: '👓', boosts: ['library', 'clerk', 'strategy'], desc: 'Library, clerk work and strategy improve 20%.' },
];

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
