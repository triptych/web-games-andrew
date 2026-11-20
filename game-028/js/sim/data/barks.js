// Short voiced battle lines: a hero calls an ability out, cheers a win or falls. Rationed in js/audio.js (one at
// a time, and not every turn) so battles don't turn into chatter. Keys are ability ids, plus win and ko.

export const BARKS = {
    lyra: { fireball: 'Burn!', frostbind: 'Hold still!', remedy: 'Hold on, I\'ve got you.', starfall: 'Stars, fall!', win: 'We did it!', ko: 'I can\'t... see...' },
    orin: { shield_bash: 'Down you go!', provoke: 'Face me, coward!', bulwark: 'Behind my shield!', rally: 'For the oath!', win: 'Stand easy.', ko: 'Forgive me...' },
    sera: { triple_shot: 'Three for you!', poison_arrow: 'This one stings.', shadowstep: 'Behind you.', mark: 'Marked.', win: 'Too easy.', ko: 'Tripped on a root...' },
    thane: { soul_drain: 'Your life is mine.', hex: 'Wither.', dark_ritual: 'Kaelthas, I take back what is mine!', win: 'It\'s done.', ko: 'Not... yet...' },
    korvas: { dark_judgment: 'Judgment!', fallen_oath: 'I cannot die!' },
    vaelthas: { void_eclipse: 'Kneel before the void!', reanimate: 'Rise again, my children.', wail: 'Hear the ages weep.' },
};
