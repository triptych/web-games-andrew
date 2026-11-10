// The Free Day map of the capital. Each action costs one of the day's FREE_AP actions unless `free` is set.
// `friend` places let you visit that friend (chat, give a gift; heart events open here).

export const PLACES = [
    { id: 'manor', name: 'Emberhold Manor', bg: 'study', icon: '🏠', desc: 'Home. Talk with the prince, or let him rest.',
        actions: [{ id: 'talk', name: 'Talk with the prince' }, { id: 'nap', name: 'Spend a quiet afternoon together', desc: '-10 Stress, +Bond' }] },
    { id: 'castle', name: 'The Royal Castle', bg: 'throne', icon: '🏰', desc: 'The court, the King, and the Duke.',
        actions: [{ id: 'gossip', name: 'Listen to court gossip', desc: 'Learn where the court stands' }, { id: 'petition', name: 'Petition for favour', desc: '+Royal Favor if his Grace and Eloquence impress' }] },
    { id: 'market', name: 'Market Square', bg: 'market', icon: '🛒', desc: 'Shops, stalls and Pip.', friend: 'pip',
        actions: [{ id: 'shop', name: 'Browse the shops', free: true }] },
    { id: 'guild', name: 'Guild Hall', bg: 'guild', icon: '📜', desc: 'The quest board.',
        actions: [{ id: 'board', name: 'Read the quest board', free: true }] },
    { id: 'yard', name: 'Castle Training Yard', bg: 'yard', icon: '⚔️', desc: 'Captain Brannoc\'s squires, and Rowan.', friend: 'rowan',
        actions: [{ id: 'spar', name: 'Watch him spar', desc: '+Combat, +Stress' }] },
    { id: 'spire', name: 'The Arcane Spire', bg: 'spire', icon: '🔮', desc: 'Archmage Velis, and Theo.', friend: 'theo', need: 'met_theo',
        actions: [{ id: 'consult', name: 'Consult the Archmage', desc: 'Velis tells you what she sees in him' }] },
    { id: 'temple', name: 'Temple of the Ember Flame', bg: 'temple', icon: '🕯️', desc: 'Prayer and charity.',
        actions: [{ id: 'pray', name: 'Pray together', desc: '-8 Stress, +Faith' }, { id: 'donate', name: 'Donate 50 gold to the poor', desc: '+Morality, +Renown' }] },
    { id: 'varre', name: 'The Varre Gardens', bg: 'varre', icon: '🌹', desc: 'The Duke\'s estate. Isolde fences here at dawn.', friend: 'isolde', need: 'met_isolde', actions: [] },
    { id: 'harbor', name: 'The Golden Harbor', bg: 'harbor', icon: '⛵', desc: 'Ships from every port, and Saffi.', friend: 'saffi', need: 'met_saffi', actions: [] },
    { id: 'theatre', name: 'The Moonlit Theatre', bg: 'theater', icon: '🎭', desc: 'See a play.',
        actions: [{ id: 'play', name: 'See a play (15 gold)', desc: '-8 Stress, +Artistry' }] },
    { id: 'peaks', name: 'Foot of the Dragon Peaks', bg: 'peaks', icon: '🏔️', desc: 'Lumi waits where the snow begins.', friend: 'lumi', need: 'lumi', actions: [] },
    { id: 'rookery', name: 'The Rookery', bg: 'rookery', icon: '🐦', desc: 'The poorest quarter. Pip\'s orphans live here.', minAge: 11,
        actions: [{ id: 'feed', name: 'Bring food to the orphans (20 gold)', desc: '+Morality, +Pip' }] },
];
export const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));
